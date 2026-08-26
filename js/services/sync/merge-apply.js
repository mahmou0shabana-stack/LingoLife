/**
 * LingoLife — التطبيقُ الذرّي للدمج (WS-G · بنود ١٧ و٣٦ و٤٨ و٤٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **نفسُ آلةِ الاسترجاع بحرفها — لا آلةٌ ثانية**
 * ═══════════════════════════════════════════════════════════════
 *
 *   ١. تُستنسَخ القاعدةُ النشطة إلى الخانة الخاملة.
 *   ٢. تُطبَّق الخطّةُ على الخاملة.
 *   ٣. يُعاد بناءُ المشتقّ فيها.
 *   ٤. تُفحَص: فهارسُ الفريد، والمراجعُ المعلّقة، والحوافُّ المكرَّرة،
 *      ودوراتُ الشجرة.
 *   ٥. يُحرَّك المؤشّرُ بكتابةٍ واحدة. **هذه هي اللحظة الذرّية.**
 *
 * وقبل الخطوة ٥ القاعدةُ النشطة **لم تُلمَس ولا بايتًا واحدًا**. فلو
 * سقط الدمجُ في منتصفه — قيدُ `unique` رفض، أو مرجعٌ ضاع، أو أُغلق
 * التبويب — بقي كلُّ شيءٍ كما كان.
 *
 * ⚠️ **والثمنُ مصرَّحٌ به**: ذروةٌ تساوي ضعفَ حجم بياناتك أثناء الدمج
 *    وحده، تمامًا كالاسترجاع. وهو ثمنٌ نقبله لأن البديل — الكتابةُ في
 *    القاعدة الحيّة — يجعل «فشل الدمج» و«تلف البيانات» شيئًا واحدًا.
 */

import { openNamed, closeDB, req } from '../../db/database.js';
import { STORES, STORE_NAMES } from '../../db/schema.js';
import {
  activeDbName, deleteDatabase, setActiveDbName, stagingDbName,
} from '../../db/db-slots.js';
import { policyOf } from './sync-policy.js';
import { LOG_STORE, OP } from './change-log.js';
import { deviceId } from './device.js';
import { PART_OF, edgeKey } from './merge-planner.js';
import { CONFLICT, RESOLUTION, applicable, unresolved } from './conflicts.js';

/** دفعةُ كتابةٍ واحدة — نفسُ حجم `restore.js`. */
const BATCH = 500;

/**
 * ⚠️ **ولا يُرفَض بـ`null` أبدًا.** `tx.error` تكون فارغةً في بعض
 *    حالات الإلغاء، فكان `reject(tx.error)` يعطي `null`؛ فيسقط أوّلُ
 *    مَن يقرأ `error.message` بـ`TypeError` يخفي السببَ الحقيقيّ.
 *    ورسالةُ خطأٍ مضلّلةٌ أسوأُ من رسالةٍ ناقصة.
 */
function txDone(tx, what = 'معاملة الدمج') {
  return new Promise((resolve, reject) => {
    const fail = () => reject(tx.error || new Error(`فشلت ${what} بلا سببٍ معلَن`));
    tx.oncomplete = () => resolve();
    tx.onerror = fail;
    tx.onabort = fail;
  });
}

/**
 * يستنسخ قاعدةً كاملةً إلى أخرى — بالبايتات كما هي.
 *
 * ⚠️ **والـBlob يُنقَل مرجعًا لا يُعاد ترميزُه.** IndexedDB تستنسخ
 *    البنيويَّ (structured clone) فتنتقل الصورةُ كما هي بلا فقدِ جودة
 *    وبلا كلفةِ ترميز.
 */
async function cloneDatabase(from, to, onProgress = () => {}) {
  const names = STORE_NAMES.filter((n) => from.objectStoreNames.contains(n));
  let copied = 0;

  for (const name of names) {
    /* eslint-disable-next-line no-await-in-loop -- مخزنٌ بعد مخزن، والذروةُ تبقى منخفضة */
    const rows = await req(from.transaction(name, 'readonly').objectStore(name).getAll());
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const tx = to.transaction(name, 'readwrite');
      const store = tx.objectStore(name);
      for (const row of slice) store.put(row);
      /* eslint-disable-next-line no-await-in-loop -- دفعةٌ بعد دفعة */
      await txDone(tx);
      copied += slice.length;
    }
    onProgress({ phase: 'clone', label: name, done: copied });
  }
  return copied;
}

/** يفرّغ الخانةَ الخاملة من بقايا محاولةٍ سابقة. */
function clearAll(db) {
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) tx.objectStore(name).clear();
  return txDone(tx);
}

const keyPathOf = (store) => STORES[store]?.keyPath || 'id';

/* ------------------------------------------------------------------ *
 * ترجمةُ القرارات إلى كتابات
 * ------------------------------------------------------------------ */

/**
 * يحوّل تعارضاتٍ محلولةً إلى عمليّاتٍ ملموسة.
 *
 * ⚠️ **ويُنفَّذ هنا لا في `resolveConflict`**: الحلُّ قرارٌ يُراجَع
 *    ويُبدَّل، والكتابةُ نتيجةٌ تُحسَب مرّةً واحدةً عند التنفيذ. وخلطُهما
 *    يجعل تبديلَ رأيك يحتاج تراجعًا عن كتابةٍ سبقت.
 */
function resolutionWrites(plan) {
  const writes = [];
  const removes = [];

  for (const conflict of plan.conflicts) {
    if (!conflict.resolution) continue;
    const { type, store, recordId, field } = conflict;

    if (type === CONFLICT.FIELD || type === CONFLICT.UNIQUE_ENTITY) {
      if (conflict.resolution === RESOLUTION.USE_LOCAL) continue;
      const value = conflict.resolution === RESOLUTION.MANUAL_VALUE
        ? conflict.resolvedValue
        : conflict.remote.value;
      writes.push({ store, recordId, fields: { [field]: value } });
      continue;
    }

    if (type === CONFLICT.DELETE_EDIT) {
      if (conflict.resolution === RESOLUTION.KEEP_DELETE) {
        /* الجانبُ الحاذف قد يكون أيَّهما — والنتيجةُ واحدة: يذهب الصفّ. */
        removes.push({ store, recordId, why: 'قرارُك: يُحذف' });
      } else {
        /*
         * ⚠️ **«أبقِ المعدَّل» تعني إحياءً صريحًا.** لو كان الحذفُ ناعمًا
         *    فالصفُّ ما زال هنا بحالة `trashed`، فلا يكفي ألّا نفعل
         *    شيئًا: لا بدّ من إعادته `active`. والنسخةُ المعدَّلة هي
         *    الجانبُ الذي **ليس** حذفًا.
         */
        const edited = conflict.local.value ?? conflict.remote.value;
        if (edited) {
          writes.push({ store, recordId, record: { ...edited, state: 'active', deletedAt: null } });
        }
      }
      continue;
    }

    if (type === CONFLICT.TREE_MOVE) {
      if (conflict.resolution === RESOLUTION.USE_LOCAL) continue;
      writes.push({ treeMove: { ...conflict.extra } });
      continue;
    }

    if (type === CONFLICT.TREE_ORDER) {
      const edges = conflict.resolution === RESOLUTION.USE_LOCAL
        ? conflict.extra.localEdges
        : conflict.extra.remoteEdges;
      for (const [i, edge] of edges.entries()) {
        writes.push({ store: 'relationships', recordId: edge.id, fields: { order: i + 1 } });
      }
      continue;
    }

    if (type === CONFLICT.RELATIONSHIP_METADATA) {
      if (conflict.resolution === RESOLUTION.KEEP_DELETE) {
        removes.push({ store: 'relationships', recordId, why: 'قرارُك: تُفَكّ' });
      }
      continue;
    }
  }

  return { writes, removes };
}

/* ------------------------------------------------------------------ *
 * التحقّقُ قبل التحويل
 * ------------------------------------------------------------------ */

/**
 * يفحص القاعدةَ المدموجةَ قبل أن تصير النشطة (بند ٤٩).
 *
 * ⚠️ **والفحصُ هنا لا في الخطّة.** الخطّةُ تقول ما تنوي، وهذا يقول ما
 *    **حدث فعلًا**. وبينهما فرقٌ ظهر مرّةً: خطّةٌ سليمةٌ تمامًا تركت
 *    مرجعًا معلّقًا لأن صفًّا ثالثًا كان يشير إلى الخاسر ولم يكن في
 *    خريطة المراجع.
 */
export async function validateMerged(db) {
  const issues = [];
  const read = async (name) => (
    db.objectStoreNames.contains(name)
      ? req(db.transaction(name, 'readonly').objectStore(name).getAll())
      : []
  );

  /* ---- ١. المفاتيحُ الطبيعيّةُ الفريدة ---- */
  for (const store of STORE_NAMES) {
    const policy = STORES[store] ? policyOf(store) : null;
    if (!policy?.uniqueKey) continue;
    /* eslint-disable-next-line no-await-in-loop -- ثلاثةُ مخازن */
    const rows = await read(store);
    const seen = new Map();
    for (const row of rows) {
      const value = row[policy.uniqueKey];
      if (value === undefined || value === null || value === '') continue;
      if (seen.has(value)) {
        issues.push({
          level: 'fatal',
          message: `${store}: «${value}» في صفّين (${seen.get(value)} و${row.id}) — فهرسُ الفريد سيرفض`,
        });
      }
      seen.set(value, row.id);
    }
  }

  const relationships = await read('relationships');

  /* ---- ٢. حوافُّ مكرَّرةٌ منطقيًّا ---- */
  const edges = new Map();
  for (const row of relationships) {
    const key = edgeKey(row);
    if (edges.has(key)) {
      issues.push({
        level: 'fatal',
        message: `حافّةٌ مكرَّرة: ${key} (${edges.get(key)} و${row.id})`,
      });
    }
    edges.set(key, row.id);
  }

  /* ---- ٣. مراجعُ معلّقة ---- */
  const idsOf = new Map();
  for (const store of ['expressions', 'words', 'sentencePatterns', 'scripts', 'media', 'scenes']) {
    /* eslint-disable-next-line no-await-in-loop -- ستّةُ مخازن */
    idsOf.set(store, new Set((await read(store)).map((r) => r.id)));
  }
  const knownEntity = (id) => [...idsOf.values()].some((set) => set.has(id));

  for (const [store, field] of [
    ['expressionOccurrences', 'expressionId'],
    ['mistakeComparisons', 'expressionId'],
  ]) {
    /* eslint-disable-next-line no-await-in-loop -- مخزنان */
    for (const row of await read(store)) {
      const value = row[field];
      if (!value) continue;
      if (!idsOf.get('expressions').has(value)) {
        issues.push({ level: 'fatal', message: `${store}.${field} يشير إلى تعبيرٍ غيرِ موجود: ${value}` });
      }
    }
  }

  /* ---- ٤. الشجرةُ بلا دورةٍ وبلا أبٍ هو نفسُه ---- */
  const parentOf = new Map();
  for (const row of relationships) {
    if (row.kind !== PART_OF) continue;
    if (row.fromId === row.toId) {
      issues.push({ level: 'fatal', message: `عقدةٌ أبٌ لنفسها: ${row.fromId}` });
      continue;
    }
    if (!parentOf.has(row.toId)) parentOf.set(row.toId, []);
    parentOf.get(row.toId).push(row.fromId);
  }
  for (const [child, parents] of parentOf.entries()) {
    if (parents.length > 1) {
      issues.push({ level: 'fatal', message: `عقدةٌ لها أكثرُ من أبٍ: ${child} تحت ${parents.join(' و')}` });
    }
    let cursor = parents[0];
    const seen = new Set([child]);
    let depth = 0;
    while (cursor && depth < 64) {
      if (seen.has(cursor)) {
        issues.push({ level: 'fatal', message: `دورةٌ في الشجرة عند ${child}` });
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor)?.[0];
      depth += 1;
    }
  }

  /* ---- ٥. وصفُ وسيطٍ يزعم بايتاتٍ ليست هنا ---- */
  for (const row of await read('media')) {
    if (row.blobPending && row.blob) {
      issues.push({ level: 'fatal', message: `وسيطٌ موسومٌ بانتظار البايتات وهي موجودة: ${row.id}` });
    }
  }

  return { ok: !issues.some((i) => i.level === 'fatal'), issues };
}

/* ------------------------------------------------------------------ *
 * التطبيق
 * ------------------------------------------------------------------ */

/**
 * يطبّق خطّةَ دمجٍ ذرّيًّا.
 *
 * @param {object} plan — من `planMerge`، وكلُّ تعارضاتها محلولة
 * @param {{ onProgress?: Function, rebuild?: Function|null }} options
 */
export async function applyMerge(plan, { onProgress = () => {}, rebuild = null } = {}) {
  if (!plan?.ok) throw new Error('خطّةٌ غيرُ صالحة — لا تُطبَّق.');
  if (!applicable(plan)) {
    const blocking = unresolved(plan);
    throw new Error(
      `فيه ${blocking.length} تعارضٍ محتاج قرارَك — والدمجُ ما بيتمّش قبله:\n`
      + blocking.map((c) => `· ${c.label}`).join('\n')
    );
  }

  const previous = activeDbName();
  const target = stagingDbName();

  onProgress({ phase: 'prepare', label: `تجهيز الخانة (${target})` });
  await deleteDatabase(target);
  const staging = await openNamed(target);
  const active = await openNamed(previous);

  try {
    await clearAll(staging);
    onProgress({ phase: 'clone', label: 'استنساخُ الحالة الراهنة' });
    await cloneDatabase(active, staging, onProgress);
    active.close();

    const extra = resolutionWrites(plan);

    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **وترتيبُ الخطوات ليس ذوقًا — قِيس فسقط ثم صُحِّح**
     * ═══════════════════════════════════════════════════════════════
     *
     * كان الإنشاءُ أوّلًا وحذفُ الكيان الخاسر أخيرًا. فكانت كتابةُ
     * التعبير الوافد تصطدم بفهرس `unique` على `normalizedText` **قبل**
     * أن يُحذَف توأمُه المحلّيّ، فتُلغى المعاملةُ ويسقط الدمج كلُّه في
     * السيناريو الذي وُجد لأجله بالضبط (بند ٥٧).
     *
     * فالترتيبُ الآن:
     *   ٠. تفريغُ المفتاح الفريد   ← حذفُ الصفّ المحلّيّ الخاسر
     *   ١. الإنشاءات               ← فالمفتاحُ صار خاليًا
     *   ٢. إعادةُ توجيه المراجع    ← والباقي صار موجودًا
     *   ٣. التعديلاتُ والقرارات
     *   ٤. الحذف
     */

    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **وقراراتُ الدمج نفسُها تغييراتٌ يجب أن تنتقل** (بندا ١٦ و٦٩)
     * ═══════════════════════════════════════════════════════════════
     *
     * كان أوّلُ تنفيذٍ يسجّل ما **جاء** من الجار ولا يسجّل ما **قرّره**
     * الدمجُ نفسُه. وقد قِيس فسقط في السيناريو ٥ بالضبط:
     *
     *   الموبايلُ يدمج التعبيرَين، فيَرِث الباقي حقلَ `register` من
     *   الخاسر ويُحذَف الخاسر. ثم يبني حزمةً للتابلت — فلا تحمل شيئًا
     *   من ذلك: الحقلُ الموروثُ لم يُسجَّل، والصفُّ المحذوفُ لم يُسجَّل،
     *   وصفُّ الخاسر لم يعد موجودًا فلا يُصدَّر. فيبقى التابلتُ بلا
     *   `register` **إلى الأبد** — التقاءٌ ناقصٌ لا يُصلحه تبادلٌ آخر.
     *
     * فكلُّ كتابةٍ يقرّرها هذا الجهازُ — دمجُ كيان، وإعادةُ توجيه مرجع،
     * وحلُّ تعارضٍ اخترتَه أنت — تُسجَّل **باسمه هو**، فتنتقل كما ينتقل
     * أيُّ تعديلٍ كتبتَه بيدك.
     */
    const localEntries = [];
    const noteWrite = (store, recordId, fields) =>
      localEntries.push({ store, recordId, op: OP.PUT, fields: fields ?? null });
    const noteRemove = (store, recordId, payload) => {
      if (payload) localEntries.push({ store, recordId, op: OP.REMOVE, payload });
    };

    /* ---- ٠. تفريغُ المفتاح الفريد قبل أيّ كتابة ---- */
    onProgress({ phase: 'apply', label: 'تفريغُ المفاتيح الفريدة' });
    for (const coalesce of plan.entityCoalesces) {
      for (const id of coalesce.droppedLocal) {
        const before = await deleteRow(staging, coalesce.store, id);
        noteRemove(coalesce.store, id, before);
      }
    }

    /* ---- ١. إنشاءات ---- */
    onProgress({ phase: 'apply', label: 'الإضافات' });
    for (const item of plan.creates) await putRow(staging, item.store, item.record);
    for (const item of plan.relationshipAdds) await putRow(staging, 'relationships', item.record);

    /* ---- ٢. دمجُ الكيانات: توجيهُ المراجع ثم إتمامُ الباقي ---- */
    onProgress({ phase: 'apply', label: 'دمجُ الكيانات المتطابقة' });
    for (const coalesce of plan.entityCoalesces) {
      for (const rewrite of coalesce.rewrites) {
        const done = await patchRow(
          staging, rewrite.store, rewrite.recordId, { [rewrite.field]: rewrite.to }
        );
        if (done) noteWrite(rewrite.store, rewrite.recordId, [rewrite.field]);
      }
      if (Object.keys(coalesce.merged).length) {
        const done = await patchRow(staging, coalesce.store, coalesce.survivor, coalesce.merged);
        if (done) noteWrite(coalesce.store, coalesce.survivor, Object.keys(coalesce.merged));
      }
    }

    /* ---- ٣. تعديلاتٌ حقلًا حقلًا ---- */
    onProgress({ phase: 'apply', label: 'التعديلات' });
    for (const item of plan.updates) {
      await patchRow(staging, item.store, item.recordId, item.fields);
    }
    /* ⚠️ وقراراتُك تُسجَّل باسمك — فتصل الجارَ كأيّ تعديلٍ كتبتَه. */
    for (const item of extra.writes) {
      if (item.treeMove) {
        const changed = await applyTreeMove(staging, item.treeMove);
        for (const entry of changed) localEntries.push(entry);
        continue;
      }
      if (item.record) {
        await putRow(staging, item.store, item.record);
        noteWrite(item.store, item.recordId, null);
        continue;
      }
      const done = await patchRow(staging, item.store, item.recordId, item.fields);
      if (done) noteWrite(item.store, item.recordId, Object.keys(item.fields));
    }

    /* ---- ٤. حذوفات ---- */
    onProgress({ phase: 'apply', label: 'الحذف' });
    for (const item of plan.deletes) {
      await deleteRow(staging, item.store, item.recordId);
    }
    for (const item of extra.removes) {
      const before = await deleteRow(staging, item.store, item.recordId);
      noteRemove(item.store, item.recordId, before);
    }
    for (const item of plan.relationshipRemoves) {
      await deleteRow(staging, 'relationships', item.recordId);
    }

    /* ---- ٥. سطورُ السجلّ: ما وصل بمؤلِّفه، وما قرّرناه باسمنا ---- */
    onProgress({ phase: 'apply', label: 'تسجيلُ ما وصل وما تقرّر' });
    const nextSeq = await writeAcceptedLog(staging, plan.acceptedChanges);
    await writeLocalLog(staging, localEntries, nextSeq);

    /* ---- ٦. إعادةُ بناء المشتقّ (بند ٩) ---- */
    if (plan.derivedRebuilds.length && rebuild) {
      onProgress({ phase: 'rebuild', label: 'إعادةُ بناء الفهارس المشتقّة' });
      /*
       * ⚠️ **ويُعاد البناءُ بعد التحويل لا قبله** — راجع الشرحَ عند
       *    النداء تحت. المشتقُّ يُبنى من القاعدة النشطة بالمستودعات
       *    الحقيقيّة، وهي لا تعرف قاعدةً غيرَ النشطة.
       */
    }

    /* ---- ٧. الفحص ---- */
    onProgress({ phase: 'verify', label: 'التحقّق قبل التحويل' });
    const verdict = await validateMerged(staging);
    if (!verdict.ok) {
      throw new Error(
        'الدمجُ اتلغى — القاعدة المدموجة مش سليمة:\n'
        + verdict.issues.filter((i) => i.level === 'fatal').map((i) => `· ${i.message}`).join('\n')
      );
    }

    /* ---- ٨. اللحظةُ الذرّية ---- */
    staging.close();
    closeDB();
    setActiveDbName(target);
    onProgress({ phase: 'switch', label: 'تمّ التحويل' });

    /*
     * إعادةُ بناء المشتقّ **بعد** التحويل: `rebuildIndex` تمرّ من
     * المستودعات، والمستودعاتُ تكتب في القاعدة النشطة. وفشلُها بعد
     * التحويل لا يُفقِد شيئًا — الفهرسُ مشتقٌّ يُعاد بناؤه بزرّ.
     */
    let rebuilt = null;
    if (plan.derivedRebuilds.length && rebuild) {
      rebuilt = await rebuild(plan.derivedRebuilds).catch((error) => ({ error: error.message }));
    }

    const deleted = await deleteDatabase(previous).catch(() => false);

    return {
      ok: true,
      from: previous,
      to: target,
      applied: {
        creates: plan.creates.length,
        updates: plan.updates.length + extra.writes.length,
        deletes: plan.deletes.length + extra.removes.length,
        relationshipAdds: plan.relationshipAdds.length,
        relationshipRemoves: plan.relationshipRemoves.length,
        entityCoalesces: plan.entityCoalesces.length,
        acceptedChanges: plan.acceptedChanges.length,
      },
      rebuilt,
      oldDatabaseDeleted: deleted,
    };
  } catch (error) {
    /* القاعدةُ النشطة لم تُمَسّ — نُلقي المحاولةَ ونُبقي كلَّ شيء. */
    try {
      staging.close();
      active.close();
      await deleteDatabase(target);
    } catch {
      /* التنظيفُ أفضلُ جهد — المهمّ أن المؤشّر لم يتحرّك */
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * كتاباتٌ صغيرةٌ على قاعدةٍ مفتوحة
 * ------------------------------------------------------------------ */

async function putRow(db, store, record) {
  const tx = db.transaction(store, 'readwrite');
  const request = tx.objectStore(store).put(record);
  /* ⚠️ الخطأُ يُسمّى مخزنَه وصفَّه — وإلّا صار «ConstraintError» بلا مكان. */
  request.onerror = () => {
    request.error && Object.defineProperty(request.error, 'message', {
      value: `${store} · ${record?.id ?? ''}: ${request.error.message}`,
      configurable: true,
    });
  };
  await txDone(tx, `كتابةَ ${store}`);
}

/** يحذف صفًّا **ويعيد صورتَه** — فشاهدُ القبر يحتاجها (بند ٧). */
async function deleteRow(db, store, id) {
  const tx = db.transaction(store, 'readwrite');
  const objectStore = tx.objectStore(store);
  const done = txDone(tx, `حذفَ ${store}`);
  const before = await req(objectStore.get(id));
  if (before) objectStore.delete(id);
  await done;
  return before || null;
}

/**
 * يكتب حقولًا بعينها فوق صفٍّ قائم.
 *
 * ⚠️ **ولا يرفع `rev` ولا يضع `dirty`.** هذه كتابةُ **دمج** لا كتابةُ
 *    مستخدم: `rev` ملكُ المؤلِّف، ورفعُه هنا يجعل الجهازَ يزعم تأليفًا
 *    لم يقع، فتُصدَّر إلى الجار نسختُه هو مردودةً إليه.
 */
async function patchRow(db, store, id, fields) {
  const tx = db.transaction(store, 'readwrite');
  const objectStore = tx.objectStore(store);
  const done = txDone(tx, `تعديلَ ${store}`);
  const existing = await req(objectStore.get(id));
  /*
   * ⚠️ **والمستمعُ يُركَّب قبل الانتظار لا بعده.** كان `txDone` يُنادى
   *    بعد `await`، فإن انتهت المعاملةُ في نفس اللحظة (وهي تنتهي
   *    تلقائيًّا حين لا يبقى طلبٌ معلَّق) لَفات `oncomplete` قبل أن
   *    يُركَّب المستمع — فيبقى الوعدُ معلَّقًا **إلى الأبد**. وهو تعليقٌ
   *    صامت: لا خطأَ ولا رسالة، فقط دمجٌ لا ينتهي.
   */
  if (existing) objectStore.put({ ...existing, ...fields, [keyPathOf(store)]: id });
  await done;
  return Boolean(existing);
}

/** ينقل عقدةً إلى أبٍ آخر — فكُّ حوافّها القديمة وربطُ واحدةٍ جديدة. */
/**
 * ينقل عقدةً إلى أبٍ آخر — ويعيد سطورَ السجلّ التي يستحقّها الفعل.
 *
 * ⚠️ **ومعرِّفُ الحافّة الجديدة محسوبٌ لا مولَّد**: `REL_MERGED_أب_ابن`
 *    يجعل جهازين حسما نفسَ التعارض بنفس القرار يلتقيان على **صفٍّ
 *    واحدٍ بعينه**، لا على صفّين متطابقي المعنى مختلفي المعرِّف.
 */
async function applyTreeMove(db, { childId, remoteParent }) {
  const tx = db.transaction('relationships', 'readwrite');
  const store = tx.objectStore('relationships');
  const done = txDone(tx, 'نقلَ العقدة');
  const rows = await req(store.index('to_kind').getAll([childId, PART_OF]));
  const entries = [];
  for (const row of rows) {
    store.delete(row.id);
    entries.push({ store: 'relationships', recordId: row.id, op: OP.REMOVE, payload: row });
  }
  const id = `REL_MERGED_${remoteParent}_${childId}`;
  entries.push({ store: 'relationships', recordId: id, op: OP.PUT, fields: null });
  store.put({
    id,
    fromId: remoteParent,
    toId: childId,
    kind: PART_OF,
    note: '',
    order: rows[0]?.order ?? 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rev: 1,
    state: 'active',
    deletedAt: null,
    dirty: 1,
  });
  await done;
  return entries;
}

/**
 * يكتب سطورَ السجلّ لما قُبل — **بمؤلِّفه الأصليّ** (بند ٦٩).
 *
 * ⚠️ **ولا يُعاد تأليفُه باسمنا.** لو كتبنا هذه السطورَ بمعرِّف جهازنا
 *    لعادت إلى مؤلِّفها في أوّل حزمةٍ نبنيها له — وهو يعرفها، فيتجاهلها،
 *    لكنها تكبّر كلَّ حزمةٍ بلا فائدة. والأخطر: يستحيل ساعتها أن يعرف
 *    جهازٌ ثالثٌ أن التغييرَ للابتوب لا للتابلت.
 */
async function writeAcceptedLog(db, changes) {
  if (!changes.length) return maxLogSeq(db);
  const tx = db.transaction(LOG_STORE, 'readwrite');
  const store = tx.objectStore(LOG_STORE);
  const done = txDone(tx, 'كتابةَ السجلّ');
  const cursor = await req(store.index('seq').openCursor(null, 'prev'));
  let seq = cursor ? cursor.key : 0;

  for (const change of changes) {
    seq += 1;
    store.put({
      id: `CHG_${change.originDevice}_${change.originSeq}`,
      seq,
      originDevice: change.originDevice,
      originSeq: change.originSeq,
      store: change.store,
      recordId: change.recordId,
      op: change.op,
      rev: change.rev ?? null,
      baseRev: change.baseRev ?? null,
      fields: change.fields ?? null,
      at: change.at ?? Date.now(),
      payload: change.op === OP.REMOVE ? (change.payload ?? null) : null,
    });
  }
  await done;
  return seq;
}

/** أعلى `seq` في سجلّ قاعدةٍ مفتوحة. */
async function maxLogSeq(db) {
  const tx = db.transaction(LOG_STORE, 'readonly');
  const cursor = await req(tx.objectStore(LOG_STORE).index('seq').openCursor(null, 'prev'));
  return cursor ? cursor.key : 0;
}

/**
 * يكتب سطورَ سجلٍّ **لقرارات هذا الجهاز أثناء الدمج**.
 *
 * ⚠️ **وهي تغييراتٌ من تأليفنا فعلًا**، لا نسخٌ لما جاء: دمجُ كيانين
 *    قرارٌ اتّخذناه نحن، وحلُّ تعارضٍ اخترتَه أنت هنا. فحملُها معرِّفَ
 *    هذا الجهاز صدقٌ لا حيلة — وبه وحدَه تصل الجارَ.
 */
async function writeLocalLog(db, entries, startSeq) {
  if (!entries.length) return 0;
  const device = deviceId();
  const at = Date.now();
  const tx = db.transaction(LOG_STORE, 'readwrite');
  const store = tx.objectStore(LOG_STORE);
  const done = txDone(tx, 'كتابةَ قراراتِ الدمج');
  let seq = startSeq;

  for (const entry of entries) {
    seq += 1;
    store.put({
      id: `CHG_${device}_${seq}`,
      seq,
      originDevice: device,
      originSeq: seq,
      store: entry.store,
      recordId: entry.recordId,
      op: entry.op,
      rev: null,
      baseRev: null,
      fields: entry.fields ?? null,
      at,
      payload: entry.op === OP.REMOVE ? (entry.payload ?? null) : null,
    });
  }
  await done;
  return entries.length;
}

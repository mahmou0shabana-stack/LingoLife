/**
 * LingoLife — مخطِّطُ الدمج (WS-G · بنود ١١…٢٨ و٣٦…٣٩ و٥٠ و٥١)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **يقرأ ولا يكتب — ولا حرفًا واحدًا** (بندا ٣٦ و٣٨)
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ قرارٍ يُتَّخذ هنا ويُوضَع في **خطّة**: كائنٌ يمكن طبعُه وفحصُه
 * والاعتراضُ عليه وإلقاؤه. والكتابةُ خطوةٌ واحدةٌ لاحقةٌ في
 * `merge-apply.js`.
 *
 * والبديلُ الذي رُفض: أن يقرّر المحرّكُ ويكتبَ في نفس المرور. وهو ما
 * يجعل «اعرض لي قبل ما تعمل» مستحيلًا، ويجعل تعارضًا يُكتشَف في
 * المنتصف يترك قاعدةً نصفَ مدموجة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الأساسُ المشترك: «ما لا يعرفه الجار»، لا «ما هو أحدث»**
 * ═══════════════════════════════════════════════════════════════
 *
 * الدمجُ ثلاثيُّ الأطراف يحتاج أساسًا. وأساسُنا **متّجهُ الجار**
 * (`sourceVector`): كلُّ سطرِ سجلٍّ عندي لا يغطّيه متّجهُه هو تغييرٌ
 * **افترقتُ به عنه**. ولا ساعةَ في هذا الحساب ولا `updatedAt` (بند ٣٢)
 * — عدّادُ كلِّ مؤلِّفٍ عند نفسه، والمقارنةُ بينه وبين نفسه.
 *
 * وهو ما يميّز الحالتين اللتين يخلطهما «الأحدثُ يغلب»:
 *
 *   «كلانا عدّل منذ آخر لقاء»     ← يحتاج قرارًا
 *   «عنده نسخةٌ أحدثُ من تعديلي أنا» ← يُطبَّق بلا سؤال
 */

import { withTx, req } from '../../db/database.js';
import { STATE, STORES } from '../../db/schema.js';
import { membershipKind } from '../link-service.js';
import {
  LOG_STORE, OP, STAMP_FIELDS, sameValue, vectorOf,
} from './change-log.js';
import {
  CATEGORY, REFERENCES, UNIQUE_STORES, policyOf, syncable,
} from './sync-policy.js';
import { validateSyncPackage } from './sync-package.js';
import { CONFLICT, makeConflict, side } from './conflicts.js';
import { deviceId } from './device.js';

/** نوعُ حافّةِ الشجرة — نفسُ ما يبنيه `organize-service`، ويحرسه اختبار. */
export const PART_OF = membershipKind('script', 'script');

/** الحقولُ التي لا تدخل حسابَ «ما تغيّر» أبدًا. */
const IGNORED = new Set([...STAMP_FIELDS, 'id']);

/**
 * هُويّةُ الحافّة المنطقيّة (بند ٢٢).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا يجوز أن تكون معرِّفَ الصفّ**
 * ═══════════════════════════════════════════════════════════════
 *
 * الجهازان ينشئان `REL_...` مختلفَين لنفس الرابط بالضبط. فلو كانت
 * الهُويّةُ معرِّفَ الصفّ لصار «ربطتُ الصوتَ بالجزء ٣» على الجهازين
 * **رابطين** في قاعدةٍ واحدة.
 *
 * ⚠️ **والطرفان غيرُ مرتَّبين** — وهذا ليس اختيارًا حرًّا: `findLink()`
 *    في `link-service` تبحث في الاتّجاهين معًا وتعتبر `link(b, a, k)`
 *    تكرارًا لـ`link(a, b, k)`. فالهُويّةُ هنا تُطابق ما يفعله التطبيقُ
 *    نفسُه؛ ولو رتّبناهما لأنشأنا رابطين حيث يرى التطبيقُ واحدًا.
 */
export function edgeKey(row) {
  const a = String(row?.fromId ?? '');
  const b = String(row?.toId ?? '');
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${row?.kind ?? ''}|${lo}|${hi}`;
}

/** أصغرُ معرِّفٍ نصًّا — قاعدةُ بقاءٍ حتميّةٌ يحسبها الجهازان بنفس النتيجة. */
export function survivorId(ids) {
  return [...ids].sort()[0];
}

/** حقولُ صفٍّ التي تعني شيئًا في الدمج. */
function meaningfulFields(record) {
  return Object.keys(record || {}).filter((k) => !IGNORED.has(k)).sort();
}

/** هل هذه الكتابةُ حذفٌ ناعم؟ */
function isTrashMark(record, fields) {
  return fields.includes('state') && record?.state === STATE.TRASHED;
}

/** حقولٌ خارج الحذف الناعم — «هل عدّل شيئًا حقيقيًّا؟» */
const beyondTrash = (fields) => fields.filter((f) => f !== 'state' && f !== 'deletedAt');

/* ------------------------------------------------------------------ *
 * قراءةُ ما افترقتُ به
 * ------------------------------------------------------------------ */

/** كلُّ سطورِ سجلّي عن مخزنٍ بعينه — بمدًى مفهرسٍ لا بمسحٍ كامل. */
async function logRowsForStore(tx, store) {
  const range = IDBKeyRange.bound([store], [store, []]);
  return req(tx.objectStore(LOG_STORE).index('record').getAll(range));
}

/**
 * يبني خريطةَ «ما لا يعرفه الجار» لكلّ صفٍّ لمستُه أنا.
 *
 * @returns {Map<string, {fields: string[]|null, ops: string[], entries: object[]}>}
 *          المفتاح `store recordId`.
 */
function divergenceMap(logRows, sourceVector) {
  const out = new Map();
  for (const row of logRows) {
    if ((row.originSeq ?? 0) <= Number(sourceVector?.[row.originDevice] ?? 0)) continue;
    const key = `${row.store} ${row.recordId}`;
    const prior = out.get(key) || { fields: [], ops: [], entries: [] };
    prior.entries.push(row);
    prior.ops.push(row.op);
    if (prior.fields === null || row.fields === null) prior.fields = null;
    else prior.fields = [...new Set([...prior.fields, ...row.fields])];
    out.set(key, prior);
  }
  for (const value of out.values()) {
    if (value.fields) value.fields.sort();
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * الخطّة
 * ------------------------------------------------------------------ */

function emptyPlan(pkg) {
  return {
    ok: true,
    packageId: pkg?.packageId ?? null,
    sourceDeviceId: pkg?.sourceDeviceId ?? null,
    sourceDeviceLabel: pkg?.sourceDeviceLabel ?? '',
    localDeviceId: deviceId(),
    issues: [],
    creates: [],
    updates: [],
    deletes: [],
    relationshipAdds: [],
    relationshipRemoves: [],
    relationshipCoalesces: [],
    entityCoalesces: [],
    conflicts: [],
    derivedRebuilds: [],
    blobNeeds: [],
    /** سطورُ سجلٍّ تُكتَب عند التطبيق — بمؤلِّفها الأصليّ (بند ٦٩). */
    acceptedChanges: [],
    noops: [],
    sourceVector: pkg?.sourceVector ?? {},
  };
}

/**
 * يخطّط دمجَ حزمةٍ في القاعدة النشطة — **بلا كتابة**.
 *
 * @param {object} pkg
 * @returns {Promise<object>} خطّةٌ قابلةٌ للفحص والحلّ والتطبيق
 */
export async function planMerge(pkg) {
  const plan = emptyPlan(pkg);

  const validation = validateSyncPackage(pkg);
  if (!validation.ok) {
    plan.ok = false;
    plan.issues = validation.issues;
    return plan;
  }

  const touched = [...new Set(pkg.changes.map((c) => c.store))];
  /*
   * ⚠️ **ومخازنُ المراجع تدخل المعاملةَ وإن لم تُلمَس.** دمجُ كيانٍ فريد
   *    يقرأ `expressionOccurrences` و`mistakeComparisons` ليجد ما يشير
   *    إلى الخاسر — ومعاملةٌ لا تشملها ترمي `NotFoundError` في منتصف
   *    التخطيط.
   */
  const refStores = Object.values(REFERENCES).flat().map(([store]) => store);
  const stores = [
    ...new Set([
      LOG_STORE, 'relationships', ...touched,
      ...UNIQUE_STORES.map((u) => u.store), ...refStores,
    ]),
  ].filter((name) => STORES[name]);

  await withTx(stores, 'readonly', async (tx) => {
    const localVector = await vectorOf(tx);
    const sourceVector = pkg.sourceVector || {};

    /* سطورُ سجلّي للمخازن الملموسة + العلاقات (تحتاجها كشوفُ الشجرة). */
    const logRows = [];
    for (const store of [...new Set([...touched, 'relationships'])]) {
      /* eslint-disable-next-line no-await-in-loop -- مخزنٌ بعد مخزنٍ داخل معاملةٍ واحدة */
      logRows.push(...await logRowsForStore(tx, store));
    }
    const diverged = divergenceMap(logRows, sourceVector);
    const divOf = (store, id) => diverged.get(`${store} ${id}`) || null;

    /* كلُّ العلاقات المحلّيّة مفهرسةً بالحافّة المنطقيّة. */
    const localRels = await req(tx.objectStore('relationships').getAll());
    const relByEdge = new Map();
    const relById = new Map();
    for (const row of localRels) {
      relById.set(row.id, row);
      const key = edgeKey(row);
      if (!relByEdge.has(key)) relByEdge.set(key, []);
      relByEdge.get(key).push(row);
    }

    /* ---------- ١. التغييراتُ المعروفةُ سلفًا تسقط هنا (بندا ٥٠ و٦٦) ---------- */
    const fresh = [];
    for (const change of pkg.changes) {
      const known = Number(localVector[change.originDevice] ?? 0) >= change.originSeq;
      if (known) {
        plan.noops.push({
          store: change.store,
          recordId: change.recordId,
          why: 'تغييرٌ مطبَّقٌ من قبل — إعادةُ تسليمٍ لا إعادةُ عمل',
        });
        continue;
      }
      fresh.push(change);
    }

    /*
     * ⚠️ **ولا يُقبَل تغييرٌ من هذا الجهاز نفسِه.** حزمةٌ عادت إلينا
     *    (ثلاثةُ أجهزةٍ في حلقة) تحمل تأليفَنا نحن؛ وتطبيقُه يعني أن
     *    نكتب فوق أحدثِ حالٍ عندنا بنسخةٍ أقدمَ من أنفسنا.
     */
    const me = deviceId();
    const usable = fresh.filter((change) => {
      if (change.originDevice !== me) return true;
      plan.noops.push({
        store: change.store,
        recordId: change.recordId,
        why: 'تغييرٌ من تأليف هذا الجهاز عاد إليه',
      });
      return false;
    });

    /* ---------- ٢. كشفُ نقلِ العُقَد قبل أيّ قرارٍ على الحوافّ ---------- */
    const treeMoves = detectTreeMoves(usable, diverged, relById, sourceVector);
    for (const conflict of treeMoves.conflicts) plan.conflicts.push(conflict);

    /* ---------- ٣. المرورُ العامّ ---------- */
    for (const change of usable) {
      const policy = policyOf(change.store);
      plan.acceptedChanges.push(logEntryOf(change));

      if (change.store === 'relationships') {
        planRelationship(plan, change, { relByEdge, relById, divOf, treeMoves });
        continue;
      }

      /* eslint-disable-next-line no-await-in-loop -- صفٌّ بعد صفٍّ داخل معاملةٍ واحدة */
      const localRow = await req(tx.objectStore(change.store).get(change.recordId));
      planRecord(plan, change, localRow, divOf(change.store, change.recordId), policy);
    }

    /* ---------- ٤. ترتيبُ الأشقّاء: تعارضٌ واحدٌ لكلّ أبٍ لا لكلّ حافّة ---------- */
    foldOrderConflicts(plan, relById, localRels, usable);

    /* ---------- ٥. دمجُ الكيانات ذاتِ المفتاح الفريد ---------- */
    for (const { store, field } of UNIQUE_STORES) {
      /* eslint-disable-next-line no-await-in-loop -- ثلاثةُ مخازنَ لا أكثر */
      const rows = await req(tx.objectStore(store).getAll());
      planCoalesce(plan, store, field, rows);
    }
    await resolveRewrites(plan, tx);

    /* ---------- ٦. المشتقُّ يُعاد بناؤه لا يُنقَل (بند ٩) ---------- */
    const rebuildSources = ['scripts', 'studyDrafts', 'conversationParts', 'contentBlocks'];
    const writes = plan.creates.length + plan.updates.length + plan.deletes.length
      + plan.relationshipAdds.length + plan.relationshipRemoves.length
      + plan.entityCoalesces.length;
    if (writes && [...touched, 'relationships'].some((s) => rebuildSources.includes(s))) {
      plan.derivedRebuilds.push('memory');
    }
  });

  plan.counts = {
    creates: plan.creates.length,
    updates: plan.updates.length,
    deletes: plan.deletes.length,
    relationshipAdds: plan.relationshipAdds.length,
    relationshipRemoves: plan.relationshipRemoves.length,
    entityCoalesces: plan.entityCoalesces.length,
    conflicts: plan.conflicts.length,
    noops: plan.noops.length,
    accepted: plan.acceptedChanges.length,
  };
  return plan;
}

/** سطرُ سجلٍّ يُكتَب عند التطبيق — بمؤلِّفه الأصليّ لا بمؤلِّفنا. */
function logEntryOf(change) {
  return {
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
  };
}

/* ------------------------------------------------------------------ *
 * صفٌّ عاديّ
 * ------------------------------------------------------------------ */

function planRecord(plan, change, localRow, div, policy) {
  const { store, recordId } = change;
  const remoteDevice = change.originDevice;

  /* ---- حذفٌ صلبٌ عند الجار ---- */
  if (change.op === OP.REMOVE) {
    if (!localRow) {
      plan.noops.push({ store, recordId, why: 'محذوفٌ عند الطرفين — شاهدُ قبرٍ واحد (بند ٢٠)' });
      return;
    }
    if (!div) {
      plan.deletes.push({ store, recordId, why: 'حُذف هناك ولم يُمَسّ هنا (بند ١٨)' });
      return;
    }
    plan.conflicts.push(makeConflict({
      type: CONFLICT.DELETE_EDIT,
      store, recordId,
      label: `${store} · ${recordId}`,
      local: side({ value: localRow, rev: localRow.rev, note: 'عُدِّل هنا' }),
      remote: side({ value: null, device: remoteDevice, note: 'حُذف هناك' }),
    }));
    return;
  }

  const remoteFields = change.fields === null
    ? meaningfulFields(change.record)
    : change.fields.filter((f) => !IGNORED.has(f));

  /* ---- صفٌّ لا وجودَ له هنا ---- */
  if (!localRow) {
    if (div?.ops.includes(OP.REMOVE)) {
      plan.conflicts.push(makeConflict({
        type: CONFLICT.DELETE_EDIT,
        store, recordId,
        label: `${store} · ${recordId}`,
        local: side({ value: null, note: 'حُذف هنا' }),
        remote: side({ value: change.record, device: remoteDevice, rev: change.rev, note: 'عُدِّل هناك' }),
      }));
      return;
    }
    const record = { ...change.record };
    /*
     * ⚠️ **ولا يُزعَم أن البايتات هنا** (بندا ٣١ و٧٦). وصفُ الوسيط وصل
     *    والملفُّ لم يصل، فيُكتَب الصفُّ بعلامةٍ صريحة. والزعمُ بالسكوت
     *    أسوأُ من النقص: صورةٌ في القائمة لا تفتح ولا تقول لماذا.
     */
    if (policy.category === CATEGORY.BLOB_METADATA) {
      record.blob = null;
      record.thumbBlob = null;
      record.blobPending = 1;
      plan.blobNeeds.push({ mediaId: recordId, bytes: record.bytes ?? null, mime: record.mime ?? null });
    }
    plan.creates.push({ store, recordId, record });
    return;
  }

  /* ---- الصفُّ عند الطرفين ---- */
  const localFields = div
    ? (div.fields === null ? meaningfulFields(localRow) : div.fields)
    : [];

  const remoteTrash = isTrashMark(change.record, remoteFields);
  const localTrash = localRow.state === STATE.TRASHED && localFields.includes('state');

  if (remoteTrash && !localTrash && beyondTrash(localFields).length) {
    plan.conflicts.push(makeConflict({
      type: CONFLICT.DELETE_EDIT,
      store, recordId,
      label: `${store} · ${recordId}`,
      local: side({ value: localRow, rev: localRow.rev, note: 'عُدِّل هنا' }),
      remote: side({ value: change.record, device: remoteDevice, rev: change.rev, note: 'نُقل للسلّة هناك' }),
    }));
    return;
  }
  if (localTrash && !remoteTrash && beyondTrash(remoteFields).length) {
    plan.conflicts.push(makeConflict({
      type: CONFLICT.DELETE_EDIT,
      store, recordId,
      label: `${store} · ${recordId}`,
      local: side({ value: localRow, rev: localRow.rev, note: 'نُقل للسلّة هنا' }),
      remote: side({ value: change.record, device: remoteDevice, rev: change.rev, note: 'عُدِّل هناك' }),
    }));
    return;
  }

  const write = {};
  let converged = 0;

  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **حذفٌ مقابلَ حذفٍ التقاءٌ لا تعارض** (بند ٢٠)
   * ═══════════════════════════════════════════════════════════════
   *
   * الجهازان نقلا الصفَّ نفسَه إلى السلّة — وهذا اتّفاقٌ تامّ. لكنّ
   * `deletedAt` عندهما يختلف بمللي ثانية، فتقاطعُ الحقول غيرُ فارغ
   * والمقارنةُ الساذجة تُنتج **تعارضًا على لحظةِ الحذف**.
   *
   * وهو سؤالٌ لا معنى له: «حذفتَه الساعةَ ١٠:٠٠:٠٠٫١٢٣ أم
   * ١٠:٠٠:٠٠٫٤٥٦؟» — والجوابُ لا يغيّر شيئًا في بياناتك.
   *
   * فشاهدُ القبر واحد، ولحظتُه **الأسبق** حتميًّا: الجهازان يحسبان
   * `min` من نفس الرقمين فيلتقيان بلا كلام.
   */
  const bothTrashed = remoteTrash && localTrash;
  if (bothTrashed) {
    const at = Math.min(
      Number(localRow.deletedAt ?? Infinity),
      Number(change.record.deletedAt ?? Infinity)
    );
    if (Number.isFinite(at) && localRow.deletedAt !== at) write.deletedAt = at;
    converged += 1;
  }

  for (const field of remoteFields) {
    if (bothTrashed && (field === 'state' || field === 'deletedAt')) continue;
    if (!localFields.includes(field)) {
      /* حقلٌ لمسه هو ولم ألمسه أنا — يُدمَج بلا سؤال (بند ١١). */
      write[field] = change.record[field];
      continue;
    }
    if (sameValue(localRow[field], change.record[field])) {
      converged += 1;
      continue;
    }
    plan.conflicts.push(makeConflict({
      type: CONFLICT.FIELD,
      store, recordId, field,
      label: `${store} · ${recordId} · ${field}`,
      local: side({ value: localRow[field], rev: localRow.rev, note: 'هنا' }),
      remote: side({ value: change.record[field], device: remoteDevice, rev: change.rev, note: 'هناك' }),
    }));
  }

  if (Object.keys(write).length) {
    plan.updates.push({ store, recordId, fields: write, rev: change.rev ?? null });
  } else if (!plan.conflicts.some((c) => c.recordId === recordId && c.store === store)) {
    plan.noops.push({
      store, recordId,
      why: converged ? 'الجهازان كتبا نفسَ القيمة' : 'لا جديدَ في هذا الصفّ',
    });
  }
}

/* ------------------------------------------------------------------ *
 * الحوافّ
 * ------------------------------------------------------------------ */

function planRelationship(plan, change, { relByEdge, relById, divOf, treeMoves }) {
  const recordId = change.recordId;

  if (change.op === OP.REMOVE) {
    const payload = change.payload;
    if (!payload) {
      plan.noops.push({ store: 'relationships', recordId, why: 'شاهدُ قبرٍ بلا صورةٍ للحافّة' });
      return;
    }
    const key = edgeKey(payload);
    if (treeMoves.blockedChildren.has(payload.toId) && payload.kind === PART_OF) return;

    const matches = (relByEdge.get(key) || []);
    if (!matches.length) {
      plan.noops.push({ store: 'relationships', recordId, why: 'الحافّةُ غيرُ موجودةٍ هنا أصلًا (بند ٢٠)' });
      return;
    }
    for (const row of matches) {
      const div = divOf('relationships', row.id);
      /*
       * ⚠️ **ولا تُبعَث حافّةٌ فُكَّت عمدًا** (بند ٢٤): لو كنتُ غيّرتُ
       *    بياناتِ الحافّة (ترتيبَها أو ملاحظتَها) وفكّها هو، فالسؤالُ
       *    لك. والسكوتُ هنا يعني أحدَ شرّين: إمّا أن يعود الرابطُ الذي
       *    فككتَه، وإمّا أن يضيع ترتيبٌ رتّبتَه.
       */
      if (div && div.ops.includes(OP.PUT)) {
        plan.conflicts.push(makeConflict({
          type: CONFLICT.RELATIONSHIP_METADATA,
          store: 'relationships',
          recordId: row.id,
          label: `${row.kind} · ${row.fromId} → ${row.toId}`,
          local: side({ value: row, note: 'عُدِّلت بياناتُها هنا' }),
          remote: side({ value: null, device: change.originDevice, note: 'فُكَّت هناك' }),
        }));
        continue;
      }
      plan.relationshipRemoves.push({ recordId: row.id, edge: key, why: 'فُكَّت هناك ولم تُمَسّ هنا' });
    }
    return;
  }

  /* ---- إضافةٌ أو تعديل ---- */
  const record = change.record;
  const key = edgeKey(record);
  if (treeMoves.blockedChildren.has(record.toId) && record.kind === PART_OF) return;

  const sameId = relById.get(recordId);
  if (sameId) {
    /* نفسُ الصفّ — يُدمَج حقلًا حقلًا كأيّ صفّ. */
    planRecord(plan, change, sameId, divOf('relationships', recordId), policyOf('relationships'));
    return;
  }

  const twins = (relByEdge.get(key) || []);
  if (!twins.length) {
    plan.relationshipAdds.push({ recordId, record, edge: key });
    return;
  }

  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **نفسُ الحافّة بمعرِّفين — والباقي أصغرُهما نصًّا** (بند ٢٢)
   * ═══════════════════════════════════════════════════════════════
   *
   * ربطتَ الصوتَ بالجزء ٣ على الجهازين، فصار `REL_A` هنا و`REL_B`
   * هناك. والاتّحادُ الساذج يعطيك رابطين حيث يرى التطبيقُ واحدًا.
   *
   * والقاعدةُ **حتميّةٌ لا اعتباطيّة**: أصغرُ المعرِّفين نصًّا يبقى.
   * وحتميّتُها هي المقصود — الجهازان يحسبان النتيجةَ نفسَها بلا أن
   * يتكلّما، فيلتقيان على صفٍّ واحدٍ بعينه لا على «أحدهما».
   */
  const ids = [recordId, ...twins.map((t) => t.id)];
  const keep = survivorId(ids);
  plan.relationshipCoalesces.push({
    edge: key,
    survivor: keep,
    dropped: ids.filter((id) => id !== keep),
  });
  if (keep === recordId) {
    plan.relationshipAdds.push({ recordId, record, edge: key });
    for (const twin of twins) {
      plan.relationshipRemoves.push({ recordId: twin.id, edge: key, why: 'حافّةٌ مكرَّرةٌ — بقي أصغرُ المعرِّفات' });
    }
  } else {
    plan.noops.push({
      store: 'relationships', recordId,
      why: `الحافّةُ موجودةٌ هنا بمعرِّفٍ أصغر (${keep})`,
    });
  }
}

/* ------------------------------------------------------------------ *
 * نقلُ العُقَد
 * ------------------------------------------------------------------ */

/**
 * يكشف «نُقلت العقدةُ على الجهازين إلى أبوين مختلفين» (بند ٢٨).
 *
 * ⚠️ **والنقلُ ليس حقلًا** — هو فكُّ حافّةٍ وربطُ أخرى. فلا يظهر في أيّ
 *    مقارنةِ حقول، ويحتاج قراءةَ الحوافّ معًا.
 *
 * ⚠️ **ونقلٌ هنا وتعديلُ نصٍّ هناك ليسا تعارضًا** (بندا ٢٧ و٥٨): الأوّلُ
 *    يكتب في `relationships` والثاني في `scripts`، ولا يلتقيان.
 *    والخلطُ بينهما لمجرّد أنهما يخصّان نفسَ العقدة تعارضٌ مخترَع.
 */
function detectTreeMoves(changes, diverged, relById, sourceVector) {
  const remote = new Map();
  for (const change of changes) {
    if (change.store !== 'relationships') continue;
    const row = change.op === OP.REMOVE ? change.payload : change.record;
    if (!row || row.kind !== PART_OF) continue;
    const entry = remote.get(row.toId) || { added: new Set(), removed: new Set() };
    if (change.op === OP.REMOVE) entry.removed.add(row.fromId);
    else entry.added.add(row.fromId);
    remote.set(row.toId, entry);
  }

  const local = new Map();
  for (const [key, div] of diverged.entries()) {
    if (!key.startsWith('relationships ')) continue;
    const id = key.slice('relationships '.length);
    for (const entry of div.entries) {
      const row = entry.op === OP.REMOVE ? entry.payload : relById.get(id);
      if (!row || row.kind !== PART_OF) continue;
      const bucket = local.get(row.toId) || { added: new Set(), removed: new Set() };
      if (entry.op === OP.REMOVE) bucket.removed.add(row.fromId);
      else if (entry.baseRev === null) bucket.added.add(row.fromId);
      local.set(row.toId, bucket);
    }
  }

  const conflicts = [];
  const blockedChildren = new Set();
  for (const [childId, r] of remote.entries()) {
    const l = local.get(childId);
    const remoteMoved = r.removed.size && r.added.size;
    const localMoved = Boolean(l?.removed.size && l?.added.size);
    if (!remoteMoved || !localMoved) continue;

    const remoteParent = [...r.added][0];
    const localParent = [...l.added][0];
    if (remoteParent === localParent) continue;

    blockedChildren.add(childId);
    conflicts.push(makeConflict({
      type: CONFLICT.TREE_MOVE,
      store: 'relationships',
      recordId: childId,
      label: `نقلُ العقدة ${childId}`,
      local: side({ value: localParent, note: 'نُقلت تحته هنا' }),
      remote: side({ value: remoteParent, note: 'نُقلت تحته هناك' }),
      base: side({ value: [...r.removed][0] ?? null, note: 'كانت تحته' }),
      extra: { childId, localParent, remoteParent },
    }));
  }

  /* `sourceVector` مقروءٌ في `divergenceMap` — ويُمرَّر هنا للتوثيق لا للحساب. */
  void sourceVector;
  return { conflicts, blockedChildren };
}

/* ------------------------------------------------------------------ *
 * ترتيبُ الأشقّاء
 * ------------------------------------------------------------------ */

/**
 * يطوي تعارضاتِ `order` على حوافّ الشجرة إلى **تعارضٍ واحدٍ لكلّ أب**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا لا يُدمَج الترتيبُ آليًّا؟** (بندا ٢٥ و٦٠)
 * ═══════════════════════════════════════════════════════════════
 *
 * الأساسُ `A B C`. هنا صار `B A C`، وهناك صار `A C B`. وأيُّ «دمجٍ»
 * ينتج ترتيبًا لم يطلبه أحدُهما — وهو أسوأُ من السؤال، لأنه يبدو
 * قرارًا وهو قُرعة. فالجواب: **تعارضٌ يعرض الترتيبين كاملين**.
 *
 * ⚠️ **وتعارضٌ واحدٌ لا أربعة**: الترتيبُ خاصّةُ **قائمةٍ** لا خاصّةُ
 *    حافّة. وعرضُ «الحافّة ٢: ٣ أم ٢؟» أربعَ مرّاتٍ يطلب من الإنسان أن
 *    يعيد تركيبَ القائمة في رأسه — وهو ما لا يفعله أحد.
 */
function foldOrderConflicts(plan, relById, localRels, changes) {
  const orderConflicts = plan.conflicts.filter(
    (c) => c.type === CONFLICT.FIELD && c.store === 'relationships' && c.field === 'order'
      && relById.get(c.recordId)?.kind === PART_OF
  );
  if (!orderConflicts.length) return;

  const byParent = new Map();
  for (const conflict of orderConflicts) {
    const parent = relById.get(conflict.recordId)?.fromId;
    if (!parent) continue;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(conflict);
  }

  plan.conflicts = plan.conflicts.filter((c) => !orderConflicts.includes(c));

  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **وترتيبُ الجار يُقرأ من صفوف الحزمة لا من قائمة التعارضات**
   * ═══════════════════════════════════════════════════════════════
   *
   * أوّلُ تنفيذٍ بنى ترتيبَ الجار من التعارضات وحدَها. وقد قِيس فسقط:
   * الأساسُ `أ ب ج`، وهذا رتّبه `ب أ ج`، وذاك `أ ج ب` — والناتج
   * المزعوم `أ ب ج`، أي ترتيبٌ لم يطلبه أحد.
   *
   * والسببُ أن **الحافّةَ قد تُكتَب بلا أن يتغيّر رقمُها**: في `ب أ ج`
   * تبقى `ج` في موضعها الثالث، فلا تدخل قائمةَ الحقول المتغيّرة، فلا
   * تصير تعارضًا — فيبقى موضعُها عند الجار **مجهولًا** للمخطِّط،
   * فيستعمل موضعَها المحلّيّ (٢) فيتساوى مع غيره ويُحسَم التساوي
   * عشوائيًّا بترتيب المصفوفة.
   *
   * أمّا صفُّ الحزمة فيحمل `order` **كاملًا** لكلّ حافّةٍ لمسها الجار،
   * تغيّرت أو لم تتغيّر. فمنه يُقرأ الترتيبُ كما هو عنده بالضبط —
   * وهو ما جعله `resequence` ممكنًا حين صار يكتب القائمةَ كوحدة.
   */
  const remoteOrder = new Map();
  for (const change of changes) {
    if (change.store !== 'relationships' || change.op !== OP.PUT) continue;
    if (change.record?.kind !== PART_OF) continue;
    remoteOrder.set(change.recordId, change.record.order ?? 0);
  }

  for (const [parent, group] of byParent.entries()) {
    void group;
    const siblings = localRels
      .filter((row) => row.kind === PART_OF && row.fromId === parent)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const remoteList = [...siblings]
      .sort((a, b) => (remoteOrder.get(a.id) ?? a.order ?? 0) - (remoteOrder.get(b.id) ?? b.order ?? 0));

    plan.conflicts.push(makeConflict({
      type: CONFLICT.TREE_ORDER,
      store: 'relationships',
      recordId: parent,
      label: `ترتيبُ أبناء ${parent}`,
      local: side({ value: siblings.map((r) => r.toId), note: 'الترتيبُ هنا' }),
      remote: side({ value: remoteList.map((r) => r.toId), note: 'الترتيبُ هناك' }),
      extra: {
        parent,
        localEdges: siblings.map((r) => ({ id: r.id, toId: r.toId, order: r.order ?? 0 })),
        remoteEdges: remoteList.map((r, i) => ({ id: r.id, toId: r.toId, order: i + 1 })),
      },
    }));
  }
}

/* ------------------------------------------------------------------ *
 * دمجُ الكيانات ذاتِ المفتاح الفريد
 * ------------------------------------------------------------------ */

/**
 * يخطّط دمجَ كيانين يحملان نفسَ المفتاح الطبيعيّ (بنود ١٥…١٧).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وهذا ليس دمجَ صفّين — بل دمجُ كيانين**
 * ═══════════════════════════════════════════════════════════════
 *
 * أنشأتَ «согласование» على التابلت فأخذ `EXP_A`، وعلى الموبايل فأخذ
 * `EXP_B`. والاتّحادُ الساذج يكتب الصفّين، ففهرسُ `unique` على
 * `normalizedText` **يرفض المعاملة كلَّها** — أي أن الدمجَ يسقط، لا
 * أن يُنتج تكرارًا.
 *
 * فالباقي أصغرُ المعرِّفات نصًّا (حتميّةٌ يحسبها الجهازان معًا)،
 * و**كلُّ ما يشير إلى الآخر يُعاد توجيهُه** — وإلّا صار ظهورٌ وغلطةٌ
 * ووسمُ سياقٍ معلّقةً على معرِّفٍ لا صفَّ له.
 *
 * ⚠️ **وحقولُ الخاسر لا تُهدَر**: ما كان فارغًا عند الباقي يُملأ منه.
 *    وما كان مكتوبًا عند الاثنين بقيمتين مختلفتين **تعارضٌ يُعرَض**
 *    لا اختيارٌ صامت — «شكرًا جزيلًا» عندك و«شكرًا كتير» عندي معنيان
 *    كتبتَهما، ولا يجوز أن يبتلع أحدُهما الآخر.
 */
function planCoalesce(plan, store, field, rows) {
  const pending = plan.creates.filter((c) => c.store === store).map((c) => c.record);
  const all = [...rows, ...pending];

  const groups = new Map();
  for (const row of all) {
    const value = row?.[field];
    if (value === undefined || value === null || value === '') continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }

  for (const [value, members] of groups.entries()) {
    const unique = new Map(members.map((m) => [m.id, m]));
    if (unique.size < 2) continue;

    const ids = [...unique.keys()];
    const keep = survivorId(ids);
    const survivor = unique.get(keep);
    const dropped = ids.filter((id) => id !== keep);

    const merged = {};
    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **ولا يُسأل الإنسانُ عن طوابعَ لم يكتبها**
     * ═══════════════════════════════════════════════════════════════
     *
     * أوّلُ صياغةٍ قارنت **كلَّ** حقلٍ بين الكيانين، فكان `createdAt`
     * يختلف حتمًا (أنشأتَهما في لحظتين) — فيصير كلُّ دمجِ كيانٍ
     * تعارضًا على سؤالٍ بلا معنى: «أنشأتَه ١٠:٠٠ أم ١٠:٠٥؟».
     *
     * والصوابُ أن هذه ثلاثةُ حقولٍ لها جوابٌ حتميٌّ لا رأيَ فيه:
     *   `createdAt`  **الأسبق** — فالكيانُ وُجد أوّلَ مرّةٍ حين وُجد.
     *   `state` و`deletedAt`  للباقي — لأن حالتَه هي حالةُ الكيان.
     */
    const decided = new Set(['createdAt', 'state', 'deletedAt']);
    const earliest = Math.min(
      ...ids.map((id) => Number(unique.get(id)?.createdAt ?? Infinity))
    );
    if (Number.isFinite(earliest) && survivor.createdAt !== earliest) {
      merged.createdAt = earliest;
    }

    for (const id of dropped) {
      const loser = unique.get(id);
      for (const key of meaningfulFields(loser)) {
        if (key === field || decided.has(key)) continue;
        const mine = survivor[key];
        const theirs = loser[key];
        const empty = mine === undefined || mine === null || mine === '';
        if (empty) {
          if (!(theirs === undefined || theirs === null || theirs === '')) merged[key] = theirs;
          continue;
        }
        if (sameValue(mine, theirs)) continue;
        if (theirs === undefined || theirs === null || theirs === '') continue;
        plan.conflicts.push(makeConflict({
          type: CONFLICT.UNIQUE_ENTITY,
          store, recordId: keep, field: key,
          label: `${store} «${value}» · ${key}`,
          local: side({ value: mine, note: `من ${keep}` }),
          remote: side({ value: theirs, note: `من ${id}` }),
          extra: { survivor: keep, dropped: id, uniqueValue: value },
        }));
      }
    }

    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **والخاسرُ لا يُكتَب أصلًا — لا يُكتَب ثم يُحذَف**
     * ═══════════════════════════════════════════════════════════════
     *
     * أوّلُ تنفيذٍ ترك الإنشاءَ في الخطّة وأجّل الحذفَ إلى خطوةٍ تالية.
     * والنتيجةُ قِيست: كتابةُ الصفّ الوافد تصطدم بفهرس `unique` على
     * `normalizedText` **قبل** أن تصل خطوةُ الحذف، فتُلغى المعاملة —
     * أي أن الدمجَ يسقط في المكان الذي وُجد ليعالجه بالضبط.
     *
     * فالتصحيحُ في الخطّة لا في الترتيب: الخاسرُ يُشطَب من الإنشاءات،
     * وصفُّه المحلّيُّ (إن وُجد) يُحذَف **قبل** أيّ إنشاء.
     */
    const pendingIds = new Set(pending.map((row) => row.id));
    plan.creates = plan.creates.filter(
      (item) => !(item.store === store && dropped.includes(item.recordId))
    );
    plan.updates = plan.updates.filter(
      (item) => !(item.store === store && dropped.includes(item.recordId))
    );

    plan.entityCoalesces.push({
      store,
      field,
      value,
      survivor: keep,
      dropped,
      /** ما يجب حذفُه فعلًا — الوافدُ الملغى ليس له صفٌّ يُحذَف. */
      droppedLocal: dropped.filter((id) => !pendingIds.has(id)),
      /** هل الباقي وافدٌ لم يُكتَب بعد؟ — يحدّد ترتيبَ الكتابة. */
      survivorIsNew: pendingIds.has(keep),
      merged,
      /* يُملأ في `resolveRewrites` بقراءةٍ حقيقيّةٍ من القاعدة ومن الوافد. */
      rewrites: [],
    });
  }
}

/**
 * يجد كلَّ ما يشير إلى المعرِّفات الخاسرة — **من خريطةٍ معلنةٍ لا تخمين**.
 *
 * ⚠️ والاختبارُ يمسح الكودَ بحثًا عن أيّ حقلٍ باسم `<كيان>Id` لا سطرَ
 *    له في `REFERENCES`، فحقلٌ يُضاف غدًا يُسقط الاختبارَ بدل أن يترك
 *    مرجعًا معلّقًا.
 */
async function resolveRewrites(plan, tx) {
  for (const coalesce of plan.entityCoalesces) {
    const refs = REFERENCES[coalesce.store] || [];
    const dropped = new Set(coalesce.dropped);
    for (const [refStore, refField] of refs) {
      if (!STORES[refStore] || !syncable(refStore)) continue;
      /* eslint-disable-next-line no-await-in-loop -- مرجعٌ بعد مرجعٍ داخل معاملةٍ واحدة */
      const local = await req(tx.objectStore(refStore).getAll());
      /*
       * ═══════════════════════════════════════════════════════════
       * ⚠️ **والوافدُ يُمسَح كما يُمسَح المحلّيّ**
       * ═══════════════════════════════════════════════════════════
       *
       * أوّلُ تنفيذٍ قرأ صفوفَ القاعدة وحدَها. وهذا يترك أخطرَ حالةٍ
       * بلا علاج: **ظهورٌ وافدٌ مع كيانه الخاسر**. التابلت يرسل
       * التعبيرَ `EXP_A` ومعه ظهورًا يشير إليه؛ فإن كان `EXP_A` هو
       * الخاسر، كُتب الظهورُ مشيرًا إلى معرِّفٍ حُذف في نفس الدمج —
       * أي **مرجعٌ معلّقٌ صنعه الدمجُ بيده** (بند ١٦).
       *
       * والوافدُ ليس في القاعدة بعد، فلا تراه قراءةٌ منها. فيُمسَح من
       * الخطّة نفسِها.
       */
      const incoming = plan.creates
        .filter((item) => item.store === refStore)
        .map((item) => item.record);

      for (const row of [...local, ...incoming]) {
        if (!dropped.has(row[refField])) continue;
        coalesce.rewrites.push({
          store: refStore, recordId: row.id, field: refField, to: coalesce.survivor,
        });
      }
    }
  }
}

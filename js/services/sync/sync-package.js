/**
 * LingoLife — حزمةُ المزامنة (WS-G · بنود ٣٤ و٣٥ و٧٠ و٧١ و٧٥ و٧٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **حيادُ النقل شرطٌ لا تفصيلة** (بندا ٩١ و٩٢)
 * ═══════════════════════════════════════════════════════════════
 *
 * لا سطرَ هنا يعرف Google Drive ولا خادمًا ولا شبكة. الحزمةُ **قيمةٌ**
 * — كائنٌ عاديٌّ قابلٌ للـ`JSON` — تُسلَّم كيفما شئت: ملفًّا، أو لصقًا،
 * أو رفعًا غدًا. والمرحلةُ الثانية تنقلها ولا تعيد التفكير في شيءٍ ممّا
 * هنا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وليست نسخةً احتياطيّة** (بند ٤٧)
 * ═══════════════════════════════════════════════════════════════
 *
 *   `.llife`            حالةٌ كاملةٌ ببايتاتها — إنقاذٌ من كارثة
 *   `lingolife-sync`    **ما تغيّر** بلا بايتات — التقاءُ جهازين
 *
 * وخلطُهما هو الخطأُ الذي يجعل «المزامنة» تعني «استبدال الكل».
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والبايتاتُ لا تدخل** (بند ٧٥)
 * ═══════════════════════════════════════════════════════════════
 *
 * صورةٌ واحدةٌ بالهاتف تساوي ألفَ سكريبت. فحزمةٌ تحمل الوصفَ تُقاس
 * بالكيلوبايت، وحزمةٌ تحمل البايتات تُقاس بالمئات من الميجابايت —
 * والذي نختبره هنا **دلالةُ الدمج** لا قدرةُ النقل. فالبيانُ يصف، ولا
 * يدّعي أن ما يصفه موجودٌ عند من يقرؤه.
 */

import { withTx, req } from '../../db/database.js';
import { STORES } from '../../db/schema.js';
import { deviceId, deviceLabel } from './device.js';
import { changesSince, LOG_STORE, OP, vectorOf } from './change-log.js';
import { policyOf, syncable } from './sync-policy.js';

export const SYNC_FORMAT = 'lingolife-sync';
export const SYNC_VERSION = 1;

/** بادئةُ معرِّف الحزمة. */
const PKG_PREFIX = 'PKG';

/** مفتاحُ الصفّ في مخزنٍ ما — `settings` مفتاحُه `key` لا `id`. */
function keyPathOf(store) {
  return STORES[store]?.keyPath || 'id';
}

/**
 * يقصّ الحقولَ التي لا تغادر الجهاز.
 *
 * ⚠️ **وهذا هو الحارسُ ضدّ بند ٧٧ في المصدر لا في الوجهة.** موضعُ
 *    قراءتك و بايتاتُ صورتك لا تُحذَف عند الاستقبال — لا تُرسَل أصلًا.
 *    والفرقُ أن الأوّل يعتمد على أن يتذكّر المستقبِل، والثاني لا يعتمد
 *    على أحد.
 */
export function stripLocal(store, record) {
  if (!record) return record;
  const local = policyOf(store).localFields || [];
  if (!local.length) return { ...record };
  const out = { ...record };
  for (const field of local) delete out[field];
  return out;
}

/** بيانُ وسيطٍ — وصفٌ لا بايتات (بند ٧٦). */
function blobEntries(record) {
  const out = [];
  if (record.bytes || record.mime) {
    out.push({
      mediaId: record.id,
      role: 'original',
      bytes: record.bytes ?? null,
      mime: record.mime ?? null,
      /*
       * ⚠️ **ولا بصمةَ محتوًى اليوم — بصراحة.** فهرسُ `media.contentHash`
       *    معلَنٌ في الـschema منذ v1 ولا سطرَ واحدٌ يكتبه. وحسابُ بصمةٍ
       *    لكلّ ملفٍّ في كلّ تصديرٍ كلفةٌ حقيقيّةٌ لحقلٍ لا يقرؤه شيء.
       *    فالمرحلةُ الثانية — حين تحتاج إزالةَ التكرار فعلًا — تملؤه.
       */
      hash: record.contentHash ?? null,
    });
  }
  if (record.thumbBlob) {
    out.push({ mediaId: record.id, role: 'thumbnail', bytes: null, mime: 'image/webp', hash: null });
  }
  return out;
}

/**
 * يبني حزمةً بكلّ ما لا يعرفه متّجهُ الجار.
 *
 * @param {{ peerVector?: Record<string, number>, peerId?: string|null }} options
 * @returns {Promise<object>} حزمةٌ قابلةٌ للـ`JSON` بلا بايتات
 */
export async function createSyncPackage({ peerVector = {}, peerId = null } = {}) {
  const me = deviceId();

  /*
   * ⚠️ **معاملةٌ واحدةٌ للقراءة كلِّها.** الصفوفُ تُقرأ بعد السجلّ، ولو
   *    فُتحت معاملةٌ ثانيةٌ لأمكن أن يتغيّر صفٌّ بينهما فتحمل الحزمةُ
   *    نسخةً لا يصفها أيُّ سطرِ سجلّ.
   */
  const stores = [LOG_STORE, ...Object.keys(STORES).filter(syncable)];

  const built = await withTx(stores, 'readonly', async (tx) => {
    const entries = await changesSince(tx, peerVector);
    const vector = await vectorOf(tx);

    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **الطيُّ: سطورٌ كثيرةٌ لصفٍّ واحدٍ تصير تغييرًا واحدًا**
     * ═══════════════════════════════════════════════════════════
     *
     * تعديلُ نصِّ سكريبتٍ عشرَ مرّاتٍ يكتب عشرةَ سطور. وإرسالُها
     * عشرةَ تغييراتٍ يعني عشرَ نسخٍ من النصّ نفسِه في الحزمة، وتسعُ
     * كتاباتٍ عند الجار يُلغي بعضُها بعضًا.
     *
     * فالطيُّ **بمفتاح (المؤلِّف، المخزن، الصفّ)** — ولا يُطوى مؤلِّفان
     * معًا أبدًا، لأن ترتيبَ كلِّ مؤلِّفٍ عدّادُه هو، وطيُّهما يُفقد
     * أحدَهما من متّجه الجار.
     *
     * والناتجُ يحمل: آخرَ عمليّة، و**اتّحادَ** الحقول المتغيّرة (فلو
     * غيّرتَ العنوان ثم النصَّ فقد غيّرتَهما معًا)، و**أقدمَ**
     * `baseRev` (فهو أساسُ المقارنة الحقيقيّ).
     */
    const folded = new Map();
    for (const entry of entries) {
      const key = `${entry.originDevice} ${entry.store} ${entry.recordId}`;
      const prior = folded.get(key);
      if (!prior) {
        folded.set(key, { ...entry, fields: entry.fields ? [...entry.fields] : null });
        continue;
      }
      /* أقدمُ أساسٍ يبقى — وهو أوّلُ سطرٍ لأن الترتيب تصاعديّ. */
      const baseRev = prior.baseRev;
      const fields =
        prior.fields === null || entry.fields === null
          ? null
          : [...new Set([...prior.fields, ...entry.fields])].sort();
      folded.set(key, { ...entry, baseRev, fields });
    }

    const changes = [];
    const blobs = [];
    const skipped = [];

    for (const entry of [...folded.values()]) {
      const policy = policyOf(entry.store);
      const local = policy.localFields || [];

      /*
       * ═══════════════════════════════════════════════════════════
       * ⚠️ **والحقلُ المحلّيُّ يُقصّ من قائمة الحقول كما يُقصّ من الصفّ**
       * ═══════════════════════════════════════════════════════════
       *
       * عيبٌ كامنٌ من WS-G كُشف وأنا أصمّم النقل، ولم يكن يظهر لأن لا
       * أحدَ كان يعدّل حقلًا محلّيًّا وحدَه:
       *
       *   تغيّر `shadowSessions.currentSegmentIndex` وحدَه
       *     → سطرُ سجلٍّ `fields: ['currentSegmentIndex']`
       *     → `stripLocal` تحذفه من `record` ولا تحذفه من `fields`
       *     → الجارُ يقرأ `change.record['currentSegmentIndex']`
       *       فيجدها `undefined` **ويكتبها فوق قيمته الصحيحة**.
       *
       * أي أن موضعَ قراءتك على الموبايل كان سيُمحى كلّما حرّكتَ موضعَك
       * على التابلت — وهو نفسُ ما يمنعه بند ٧٧، من الباب الخلفيّ.
       *
       * ⚠️ **وتغييرٌ لم يبقَ منه حقلٌ واحد لا يُرسَل أصلًا**: هو خبرٌ عن
       *    هذا الجهاز وحدَه، وإرسالُه يكبّر الحزمةَ بلا معنًى.
       */
      const publicFields = entry.fields === null
        ? null
        : entry.fields.filter((field) => !local.includes(field));

      if (entry.op === OP.PUT && publicFields !== null && publicFields.length === 0) {
        skipped.push({
          store: entry.store,
          recordId: entry.recordId,
          why: 'لم يتغيّر إلا حقلٌ محلّيّ — خبرٌ لا يخصّ أحدًا غير هذا الجهاز',
        });
        continue;
      }

      const change = {
        originDevice: entry.originDevice,
        originSeq: entry.originSeq,
        store: entry.store,
        recordId: entry.recordId,
        op: entry.op,
        rev: entry.rev ?? null,
        baseRev: entry.baseRev ?? null,
        fields: publicFields,
        at: entry.at,
      };

      if (entry.op === OP.REMOVE) {
        change.payload = stripLocal(entry.store, entry.payload);
        changes.push(change);
        continue;
      }

      /* eslint-disable-next-line no-await-in-loop -- صفٌّ بعد صفّ داخل معاملةٍ واحدة */
      const row = await req(tx.objectStore(entry.store).get(entry.recordId));
      if (!row) {
        /*
         * ⚠️ **ولا يُختلَق صفٌّ غائب.** سطرُ `put` بلا صفٍّ حيٍّ يعني أن
         *    الصفَّ مُحيَ بعده — وسطرُ `remove` موجودٌ في السجلّ ويكفي.
         *    وتخطّيه هنا يُبقي الحزمةَ صادقة.
         */
        skipped.push({ store: entry.store, recordId: entry.recordId, why: 'الصفُّ لم يعد موجودًا' });
        continue;
      }

      change.record = stripLocal(entry.store, row);
      if (policy.category === 'BLOB_METADATA') blobs.push(...blobEntries(row));
      changes.push(change);
    }

    return { changes, blobs, vector, skipped };
  });

  return {
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    packageId: `${PKG_PREFIX}_${me}_${Date.now()}`,
    sourceDeviceId: me,
    sourceDeviceLabel: deviceLabel(),
    createdAt: Date.now(),
    /** ما كان يعرفه الجارُ حين بُنيت — أساسُ المقارنة عنده. */
    baseVector: { ...peerVector },
    /** ما يعرفه المصدرُ الآن — يُحدِّث معرفةَ الجار به. */
    sourceVector: built.vector,
    forPeer: peerId,
    changes: built.changes,
    blobManifest: built.blobs,
    skipped: built.skipped,
    counts: {
      changes: built.changes.length,
      blobs: built.blobs.length,
      stores: [...new Set(built.changes.map((c) => c.store))].length,
    },
  };
}

/* ------------------------------------------------------------------ *
 * التحقّق — قبل أيّ تخطيطٍ وقبل أيّ كتابة
 * ------------------------------------------------------------------ */

/**
 * يفحص حزمةً فحصًا صارمًا.
 *
 * ⚠️ **ولا تطبيقَ جزئيّ** (بند ٧٠): تغييرٌ واحدٌ فاسدٌ يُبطل الحزمةَ
 *    كلَّها. لأن الحزمةَ **وحدةُ معنًى**: نصفُها المطبَّق قد يكون
 *    عقدةً بلا أبٍ أو رابطًا إلى صفٍّ لم يصل.
 *
 * @returns {{ ok: boolean, issues: {level: string, message: string}[] }}
 */
export function validateSyncPackage(pkg) {
  const issues = [];
  const fatal = (message) => issues.push({ level: 'fatal', message });
  const warn = (message) => issues.push({ level: 'warn', message });

  if (!pkg || typeof pkg !== 'object') {
    fatal('الحزمة ليست كائنًا');
    return { ok: false, issues };
  }
  if (pkg.format !== SYNC_FORMAT) fatal(`صيغةٌ غير معروفة: ${pkg.format}`);
  if (pkg.version !== SYNC_VERSION) {
    fatal(`إصدارُ حزمةٍ غيرُ مدعوم: ${pkg.version} (المدعوم ${SYNC_VERSION})`);
  }
  if (!pkg.sourceDeviceId) fatal('الحزمة بلا جهازٍ مصدر');
  if (!pkg.packageId) fatal('الحزمة بلا معرِّف');
  if (!Array.isArray(pkg.changes)) fatal('التغييرات ليست مصفوفة');

  if (issues.some((i) => i.level === 'fatal')) return { ok: false, issues };

  const seen = new Set();
  for (const [i, change] of pkg.changes.entries()) {
    const at = `التغيير ${i + 1}`;
    if (!change.originDevice || !Number.isInteger(change.originSeq)) {
      fatal(`${at}: بلا مؤلِّفٍ أو ترتيب`);
      continue;
    }
    const identity = `${change.originDevice}:${change.originSeq}`;
    if (seen.has(identity)) fatal(`${at}: معرِّفُ تغييرٍ مكرَّرٌ داخل الحزمة (${identity})`);
    seen.add(identity);

    if (!change.store || !STORES[change.store]) {
      fatal(`${at}: مخزنٌ مجهول (${change.store})`);
      continue;
    }
    if (!syncable(change.store)) {
      fatal(`${at}: مخزنٌ لا يُزامَن أصلًا (${change.store}) — حزمةٌ لا يبنيها هذا التطبيق`);
      continue;
    }
    if (change.op !== OP.PUT && change.op !== OP.REMOVE) {
      fatal(`${at}: عمليّةٌ مجهولة (${change.op})`);
      continue;
    }
    if (!change.recordId) {
      fatal(`${at}: بلا معرِّفِ صفّ`);
      continue;
    }

    const keyPath = keyPathOf(change.store);
    if (change.op === OP.PUT) {
      if (!change.record || typeof change.record !== 'object') {
        fatal(`${at}: عمليّةُ كتابةٍ بلا صفّ`);
      } else if (change.record[keyPath] !== change.recordId) {
        fatal(`${at}: معرِّفُ الصفّ لا يطابق محتواه`);
      }
      const local = policyOf(change.store).localFields || [];
      for (const field of local) {
        if (field in (change.record || {})) {
          /*
           * ⚠️ **حارسُ بند ٧٧ عند الاستقبال أيضًا.** المصدرُ يقصّ،
           *    وهذا يتأكّد — فحزمةٌ فيها بايتاتُ صورةٍ أو موضعُ قراءةٍ
           *    ليست حزمةً بناها هذا التطبيق، ولا تُطبَّق.
           */
          fatal(`${at}: حقلٌ محلّيٌّ تسلّل إلى الحزمة (${change.store}.${field})`);
        }
      }
    } else if (change.payload && change.payload[keyPath] !== change.recordId) {
      fatal(`${at}: شاهدُ قبرٍ لا يطابق معرِّفَه`);
    }

    if (change.fields != null && !Array.isArray(change.fields)) {
      fatal(`${at}: قائمةُ الحقول ليست مصفوفة`);
    }
  }

  if (Array.isArray(pkg.blobManifest)) {
    for (const blob of pkg.blobManifest) {
      if (blob && ('blob' in blob || 'data' in blob || 'bytes64' in blob)) {
        fatal('بيانُ الوسائط يحمل بايتاتٍ — والحزمةُ تصف ولا تحمل (بند ٧٥)');
      }
    }
  } else if (pkg.blobManifest !== undefined) {
    warn('بيانُ الوسائط ليس مصفوفة — يُتجاهَل');
  }

  return { ok: !issues.some((i) => i.level === 'fatal'), issues };
}

/** ملخّصٌ للقراءة قبل التخطيط — بلا أيّ لمسٍ للقاعدة. */
export function inspectSyncPackage(pkg) {
  const { ok, issues } = validateSyncPackage(pkg);
  const byStore = {};
  if (ok) {
    for (const change of pkg.changes) {
      byStore[change.store] = (byStore[change.store] || 0) + 1;
    }
  }
  return {
    ok,
    issues,
    packageId: pkg?.packageId ?? null,
    sourceDeviceId: pkg?.sourceDeviceId ?? null,
    sourceDeviceLabel: pkg?.sourceDeviceLabel ?? '',
    createdAt: pkg?.createdAt ?? null,
    changes: ok ? pkg.changes.length : 0,
    byStore,
    blobs: Array.isArray(pkg?.blobManifest) ? pkg.blobManifest.length : 0,
  };
}

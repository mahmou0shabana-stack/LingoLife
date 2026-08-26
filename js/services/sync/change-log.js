/**
 * LingoLife — سجلُّ التغيير (WS-G · بنود ٥…٧ و٣٣ و٦٨)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **يُكتَب في نفس معاملةِ البيانات — أو لا يُكتَب شيء**
 * ═══════════════════════════════════════════════════════════════
 *
 * لو كُتب الصفُّ في معاملةٍ وسطرُ السجلّ في أخرى، لأمكن أن ينجح الأوّل
 * ويسقط الثاني: تغييرٌ في قاعدتك لا يعرفه أحد، ولن يعرفه أحدٌ أبدًا —
 * لأن السجلَّ هو **المصدرُ الوحيد** لما يُصدَّر. فربطُ الاثنين في معاملةٍ
 * واحدة ليس تحسينًا: هو الضمانةُ الوحيدة أن «كلُّ تغييرٍ له سطر».
 *
 * ولذلك تأخذ دوالُّ الكتابة هنا `tx` **مفتوحةً من الخارج** ولا تفتح
 * لنفسها واحدة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا لا يحمل السطرُ نسخةَ الصفّ؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن الصفَّ الحيَّ موجود. حملُ نسخةٍ في كلّ سطرٍ يعني أن تعديلَ نصِّ
 * سكريبتٍ عشرَ مرّاتٍ يخزّن النصَّ إحدى عشرة مرّة — ومسودّةٌ طويلةٌ
 * تُكتَب على مهلٍ تصير ميجابايتات. والتصديرُ يقرأ **الحالةَ الآن**،
 * والمزامنةُ تلتقي عند آخر حالٍ لا عند كلّ حالٍ مرّ.
 *
 * ⚠️ **إلّا الحذفَ الصلب.** `relationships.destroy` تمحو الصفَّ، فلا
 *    يبقى ما يُقرأ. فسطرُ `remove` — وحدَه — يحمل `payload`: صورةَ ما
 *    حُذف. وهو صغيرٌ دائمًا (صفُّ علاقةٍ أو صفُّ فهرس)، ولولاه لأعاد
 *    الجهازُ الآخر إنشاءَ ما فككتَه عمدًا.
 */

import { req } from '../../db/database.js';
import { deviceId } from './device.js';

/** اسمُ المخزن — مكتوبٌ مرّةً فلا يتفرّق في الملفّ. */
export const LOG_STORE = 'changeLog';

/** العملياتُ المعروفة (بند ٧). */
export const OP = Object.freeze({
  /** إنشاءٌ أو تعديل — الفرقُ بينهما `baseRev === null`. */
  PUT: 'put',
  /** حذفٌ صلبٌ لا رجعةَ فيه — الصفُّ غادر المخزن. */
  REMOVE: 'remove',
});

/**
 * الحقولُ التي يختمها المستودعُ على كلّ صفّ — تُستثنى من «ما تغيّر».
 *
 * ⚠️ **ولولا هذا الاستثناء لتعارض كلُّ تعديلٍ مع كلّ تعديل**: `rev` و
 *    `updatedAt` و`dirty` تتغيّر في **كلّ** كتابةٍ على الجهازين معًا،
 *    فيصير تقاطعُ «الحقول المتغيّرة» غيرَ فارغٍ أبدًا — أي تعارضٌ دائم.
 */
export const STAMP_FIELDS = Object.freeze(['rev', 'updatedAt', 'dirty']);

/** مقارنةٌ تكفي لقيم IndexedDB — بلا مكتبة، وبلا ادّعاءِ عمقٍ لا نحتاجه. */
export function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (a instanceof Blob || b instanceof Blob) return false;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * أيُّ حقولٍ تغيّرت فعلًا بين صفّين — لا أيُّ حقولٍ **طُلب** تغييرُها.
 *
 * ⚠️ والفرقُ يظهر يوم تحفظ نصًّا كما هو: `update(id, {text: نفسُه})`
 *    يطلب `text` ولا يغيّره. وعدُّه متغيّرًا يصنع تعارضًا من لا شيء.
 */
export function changedFields(before, after) {
  const out = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    if (STAMP_FIELDS.includes(key)) continue;
    if (!sameValue(before?.[key], after?.[key])) out.push(key);
  }
  return out.sort();
}

/* ------------------------------------------------------------------ *
 * الكتابة — داخل معاملةِ البيانات
 * ------------------------------------------------------------------ */

/**
 * أعلى `seq` في السجلّ — قراءةُ مؤشّرٍ واحدةٍ على فهرسٍ مرتَّب.
 *
 * ⚠️ **ولا عدّادَ في الذاكرة.** عدّادٌ محفوظٌ خارج المعاملة يفقد ذاته
 *    عند إعادة التحميل أو عند تبويبين مفتوحين، فيُعيد ترقيمًا سبق —
 *    وفهرسُ `origin` الفريد يرفض، فتسقط كتابةُ المستخدم. القراءةُ من
 *    الفهرس نفسِه **داخل** المعاملة لا تكذب أبدًا.
 */
export async function maxSeq(tx) {
  const index = tx.objectStore(LOG_STORE).index('seq');
  const cursor = await req(index.openCursor(null, 'prev'));
  return cursor ? cursor.key : 0;
}

/**
 * يكتب سطورَ سجلٍّ لتغييراتٍ **ألّفها هذا الجهاز**.
 *
 * @param {IDBTransaction} tx — معاملةٌ تشمل `changeLog` ومخزنَ البيانات
 * @param {{store: string, recordId: string, op: string, rev?: number|null,
 *          baseRev?: number|null, fields?: string[]|null, payload?: object|null}[]} entries
 */
export async function appendLocal(tx, entries) {
  if (!entries?.length) return [];
  const device = deviceId();
  const at = Date.now();
  let seq = await maxSeq(tx);
  const store = tx.objectStore(LOG_STORE);

  const rows = entries.map((entry) => {
    seq += 1;
    return {
      id: `CHG_${device}_${seq}`,
      seq,
      /* المؤلِّفُ وترتيبُه عنده = هُويّةُ التغيير في العالم كلِّه. */
      originDevice: device,
      originSeq: seq,
      store: entry.store,
      recordId: entry.recordId,
      op: entry.op,
      rev: entry.rev ?? null,
      baseRev: entry.baseRev ?? null,
      /* `null` تعني «الصفُّ كلُّه» — أي إنشاءً أو حذفًا. */
      fields: entry.fields ?? null,
      at,
      payload: entry.payload ?? null,
    };
  });

  await Promise.all(rows.map((row) => req(store.put(row))));
  return rows;
}

/* ------------------------------------------------------------------ *
 * القراءة — بلا معاملةٍ خارجيّة
 * ------------------------------------------------------------------ */

/** كلُّ المؤلِّفين الذين يعرفهم هذا السجلّ — بمؤشّرٍ فريد. */
export async function originDevices(tx) {
  const index = tx.objectStore(LOG_STORE).index('originDevice');
  const out = [];
  await new Promise((resolve, reject) => {
    const request = index.openKeyCursor(null, 'nextunique');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      out.push(cursor.key);
      cursor.continue();
    };
  });
  return out;
}

/**
 * متّجهُ الإصدارات: أعلى `originSeq` لكلّ مؤلِّف.
 *
 * ⚠️ **وهذا هو «ما أعرفه»** — الأساسُ المشترك في الدمج ثلاثيّ الأطراف
 *    (بند ٣٣). وهو لا يعتمد على ساعةٍ ولا على `updatedAt` (بند ٣٢):
 *    عدّادُ كلِّ مؤلِّفٍ عند نفسه، والمقارنةُ بينه وبين نفسه فقط.
 */
export async function vectorOf(tx) {
  const devices = await originDevices(tx);
  const index = tx.objectStore(LOG_STORE).index('origin');
  const vector = {};
  for (const device of devices) {
    /*
     * ⚠️ `[device, []]` حدٌّ أعلى لا رقمٌ كبير: ترتيبُ مفاتيح IndexedDB
     *    يضع **المصفوفةَ بعد كلّ رقم**، فهذا يغطّي أيَّ `originSeq`
     *    مهما بلغ. و`Infinity` مفتاحٌ مقبولٌ نظريًّا لكنه رهانٌ على
     *    تفصيلةٍ لا داعيَ للرهان عليها.
     */
    const range = IDBKeyRange.bound([device], [device, []]);
    /* eslint-disable-next-line no-await-in-loop -- مؤلِّفٌ بعد مؤلِّف، وعددُهم أجهزتُك */
    const cursor = await req(index.openCursor(range, 'prev'));
    vector[device] = cursor ? cursor.key[1] : 0;
  }
  return vector;
}

/**
 * التغييراتُ التي لا يعرفها متّجهُ الجار.
 *
 * ⚠️ **ولا مسحَ للقاعدة كلِّها** (بند ٧٤): مدًى مفهرسٌ لكلّ مؤلِّف يبدأ
 *    من حيث انتهى، فحزمةٌ فيها ثلاثةُ تغييراتٍ تقرأ ثلاثةَ صفوفٍ لا
 *    عشرةَ آلاف.
 */
export async function changesSince(tx, peerVector = {}) {
  const devices = await originDevices(tx);
  const index = tx.objectStore(LOG_STORE).index('origin');
  const out = [];

  for (const device of devices) {
    const from = Number(peerVector?.[device] ?? 0);
    const range = IDBKeyRange.bound([device, from], [device, []], true, false);
    /* eslint-disable-next-line no-await-in-loop -- مؤلِّفٌ بعد مؤلِّف */
    const rows = await req(index.getAll(range));
    out.push(...rows);
  }

  /* ترتيبٌ حتميّ: المؤلِّفُ ثم ترتيبُه. لا `at` — الساعاتُ لا تُؤتمَن. */
  return out.sort((a, b) =>
    a.originDevice === b.originDevice
      ? a.originSeq - b.originSeq
      : a.originDevice < b.originDevice ? -1 : 1
  );
}

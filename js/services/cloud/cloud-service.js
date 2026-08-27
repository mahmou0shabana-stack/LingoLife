/**
 * LingoLife — واجهةُ السحابة (WS-H · بنود ٣ و٢٧ و٣٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الشاشاتُ تنادي هذا الملفَّ ولا تنادي ناقلًا أبدًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * وهو حدٌّ يحرسه اختبارٌ يمسح `js/views/` و`js/modals/` بحثًا عن
 * استيرادِ أيّ ناقل. والسببُ أن Drive سيتبدّل يومًا، وشاشةٌ تناديه
 * مباشرةً تصير عائقًا في وجه ذلك التبديل.
 *
 * ⚠️ **ولا يُربَط شيءٌ عند الإقلاع.** التطبيقُ يفتح ويعمل بلا سحابةٍ
 *    ولا حساب (بند ٣): هذا الملفّ **خامدٌ تمامًا** حتى تضغط «اربط».
 */

import { createCloudSync } from './cloud-sync.js';
import { createTransferManager } from './media-transfer.js';
import { createBlobUploader } from './media-upload.js';
import { assertTransport } from './transport.js';
import { setCloudFetcher } from '../media-service.js';
import { SYNC, SYNC_TEXT } from './sync-state.js';
import { journalCounts } from './sync-journal.js';

let active = null;

/** هل رُبطت سحابةٌ في هذه الجلسة؟ */
export function isCloudActive() {
  return Boolean(active);
}

/** الحالةُ للعرض — تعمل حتى بلا ربط. */
export function cloudSnapshot() {
  return active
    ? active.sync.snapshot()
    : { state: SYNC.DISCONNECTED, text: SYNC_TEXT[SYNC.DISCONNECTED] };
}

/**
 * يركّب ناقلًا ويصير هو السحابةَ الفعّالة.
 *
 * ⚠️ **والناقلُ يُمرَّر ولا يُختار هنا.** التطبيقُ يمرّر Drive،
 *    والاختبارُ يمرّر المحاكي، **وباقي السطور واحدة**. ولو اختار هذا
 *    الملفُّ ناقلَه بنفسه لصار للاختبار مسارٌ يوازي مسارَ الإنتاج.
 */
export function attachCloud(transport, options = {}) {
  assertTransport(transport);
  const transfers = createTransferManager(transport);
  const uploads = createBlobUploader(transport);

  /*
   * ⚠️ **والرافعُ يُمرَّر إلى المنسّق — وهذا هو ما كان ناقصًا.**
   *    كان الثلاثةُ يُبنَون هنا جنبًا إلى جنبٍ بلا أن يعرف المنسّقُ
   *    بالرافع، فترفع الدورةُ السجلّاتِ وتترك البايتات. الشرحُ كاملًا
   *    فوق `pushMedia` في `cloud-sync.js`.
   */
  const sync = createCloudSync(transport, { ...options, uploader: uploads });

  /*
   * ⚠️ **وهنا يُغلَق آخرُ خيط**: خدمةُ الوسائط تتعلّم كيف تجلب بايتةً
   *    غائبة، بلا أن تعرف من أين. فصورةٌ سحابيّةٌ تُفتَح بنفس العارض،
   *    وصوتٌ سحابيٌّ يُشغَّل بنفس المشغّل.
   */
  setCloudFetcher((mediaId, role) => transfers.ensureLocal(mediaId, { role }));

  active = { transport, sync, transfers, uploads };
  return active;
}

/** يفكّ الارتباط — البياناتُ كلُّها تبقى (بند ٢٠). */
export async function detachCloud() {
  if (!active) return false;
  await active.sync.disconnect().catch(() => {});
  setCloudFetcher(null);
  active = null;
  return true;
}

/** الوصولُ المضبوط — يرمي بدل أن يعيد `undefined` صامتًا. */
function need() {
  if (!active) throw new Error('Google Drive مش متصل');
  return active;
}

export const cloud = {
  get sync() { return need().sync; },
  get transfers() { return need().transfers; },
  get uploads() { return need().uploads; },
  get transport() { return need().transport; },
  /** مثلُ `sync` لكنه لا يرمي — للشاشات التي تُرسَم قبل الربط. */
  peek() { return active; },
};

/**
 * تشخيصٌ بلا أسرار (بند ٣٥).
 *
 * ⚠️ **ولا رمزَ وصولٍ ولا ترويسةَ تفويضٍ هنا ولا في أيّ سطرٍ يُصدَّر.**
 *    ويحرسه اختبارٌ يمسح ناتجَ هذه الدالّة نفسِه بحثًا عن مفاتيحَ
 *    محظورة — فحقلٌ يُضاف غدًا بلا انتباهٍ يُسقط البناء.
 */
export async function cloudDiagnostics() {
  if (!active) {
    return { connected: false, state: SYNC.DISCONNECTED, note: 'مفيش ربط في الجلسة دي' };
  }
  const base = await active.sync.diagnostics();
  return {
    connected: true, ...base,
    transfers: active.transfers.summary(),
    uploads: active.uploads.summary(),
    /* ملخّصُ الدفتر — والتفاصيلُ تُقرأ من `journalRows`/`journalText`. */
    journal: journalCounts(),
  };
}

/**
 * الدفترُ نصًّا — هذا ما يُنسَخ من الجهاز الحقيقيّ ويُرسَل.
 *
 * ⚠️ **ويعمل بلا ربطٍ أيضًا.** أهمُّ ما يُقرأ أحيانًا هو دفترُ محاولةِ
 *    ربطٍ **فشلت** — ولو اشترطنا `active` لَما أمكن قراءتُه ساعتها.
 */
export { journalText, journalRows, journalCounts, journalClear } from './sync-journal.js';

/*
 * ⚠️ **حارسُ الأسرار انتقل إلى `secrets.js` — ورقةٌ بلا استيراد.**
 *    السببُ حلقةُ استيرادٍ حقيقيّة: `sync-journal` يحتاج القائمةَ ليُنقّي
 *    كلَّ سطرٍ يُكتَب، وهو مستورَدٌ من `cloud-sync` المستورَد من هنا.
 *    ويُعاد التصديرُ كما هو فلا ينكسر مستورِدٌ قائمٌ ولا اختبار.
 */
export { FORBIDDEN_KEYS, findSecrets } from './secrets.js';

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
  const sync = createCloudSync(transport, options);
  const transfers = createTransferManager(transport);
  const uploads = createBlobUploader(transport);

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
  };
}

/** مفاتيحُ ممنوعةٌ في أيّ ناتجِ تشخيصٍ أو حزمةٍ أو نسخة. */
export const FORBIDDEN_KEYS = Object.freeze([
  'access_token', 'accessToken', 'refresh_token', 'refreshToken',
  'client_secret', 'clientSecret', 'authorization', 'Authorization',
  'api_key', 'apiKey', 'id_token', 'idToken',
]);

/** يفحص أيَّ كائنٍ بحثًا عن سرٍّ تسرّب — يُستعمَل في الاختبار وقبل الرفع. */
export function findSecrets(value, path = '$', found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((item, i) => findSecrets(item, `${path}[${i}]`, found));
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key)) found.push(`${path}.${key}`);
    findSecrets(child, `${path}.${key}`, found);
  }
  return found;
}

/**
 * LingoLife — حارسُ الأسرار (WS-H · بند ٣٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ورقةٌ في الشجرة — لا تستورد شيئًا، عمدًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * كان هذا كلُّه في `cloud-service.js`، فلمّا جاء `sync-journal.js`
 * يحتاجه صارت الدائرة:
 *
 *     cloud-service → cloud-sync → sync-journal → cloud-service
 *
 * وحلقاتُ الاستيراد في وحدات ES «تعمل» أحيانًا: الرابطةُ تُقرأ وقتَ
 * النداء لا وقتَ التحميل، فتمرّ. لكنها تنكسر يومَ ينتقل نداءٌ إلى
 * أعلى الوحدة — بلا رسالةٍ مفهومة. وحارسُ أسرارٍ ينكسر صامتًا أسوأُ
 * من ألّا يكون.
 *
 * فالقائمةُ هنا، في ملفٍّ **بلا استيرادٍ واحد**، يستورده مَن شاء بلا
 * أن يصنع حلقة. و`cloud-service` يعيد تصديره فلا ينكسر مستورِدٌ قائم.
 */

/**
 * مفاتيحُ ممنوعةٌ في أيّ ناتجِ تشخيصٍ أو حزمةٍ أو نسخةٍ أو دفتر.
 *
 * ⚠️ **وبكلّ صياغةٍ محتملة.** `access_token` و`accessToken` شيءٌ واحد،
 *    والفرقُ حرفُ شرطةٍ لا ينتبه له أحدٌ وقت الكتابة.
 */
export const FORBIDDEN_KEYS = Object.freeze([
  'access_token', 'accessToken', 'refresh_token', 'refreshToken',
  'client_secret', 'clientSecret', 'authorization', 'Authorization',
  'api_key', 'apiKey', 'id_token', 'idToken',
]);

/**
 * يفحص أيَّ كائنٍ بحثًا عن سرٍّ تسرّب — يُستعمَل في الاختبار وقبل الرفع.
 *
 * ⚠️ **ويمشي في العمق كلِّه.** سرٌّ في الجذر يُلمَح بالعين؛ والذي يقتل
 *    هو سرٌّ في `detail.response.headers` على بُعد أربع طبقات.
 */
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

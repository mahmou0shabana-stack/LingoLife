/**
 * LingoLife — هُويّةُ الصوت بحسب المزوّد (Voice Center V1.0C · الخطوة ١)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لِمَ لا يكفي `voiceId` واحد
 * ═══════════════════════════════════════════════════════════════
 *
 * `voiceId` حقلٌ مسطَّحٌ واحدٌ على الجلسة. واسمُ الصوت لا معنى له إلّا
 * داخل مزوّده: «Milena» صوتُ جهاز، و`ru_RU-irina-medium` نموذجُ Piper.
 * فحقلٌ واحدٌ لكلّ المزوّدين يعني أنّ تبديلَ المحرّك يُبقي اسمَ صوتٍ
 * يخصّ محرّكًا آخر — ويُسلِّمه له.
 *
 * فصار الحقلُ خريطةً: `voiceByProvider = { [providerId]: voiceId }`.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والقديمُ يُقرأ ولا يُمحى
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ `voiceId` مكتوبٍ حتّى اليوم كتبه **منتقي «صوت الجهاز»** وحدَه،
 * وكلُّ قارئٍ له يسلّمه لنطق المتصفّح (`speechSynthesis`). فالقيمةُ
 * القديمةُ صوتُ مزوّد المتصفّح بلا لبس — وتُقرأ على أنّها كذلك.
 *
 *   ⚠️ **والترحيلُ عند القراءة لا في القاعدة**: لا كتابةَ ولا حذف.
 *      الحقلُ القديمُ يبقى كما هو في كلّ صفّ، ويُكتَب معه بعد اليوم
 *      مرآةً لمدخل المتصفّح — فنسخةٌ أقدمُ من التطبيق، أو نسخةٌ
 *      احتياطيّةٌ، أو جهازٌ ثانٍ يُزامِن، تقرأ ما كانت تقرؤه بالحرف.
 *
 *   ⚠️ **والخريطةُ تغلب حين تحمل مدخلَ المتصفّح** — ولو كان `null`
 *      (اخترتَ «الافتراضيّ»)، فلا يُبعَث القديمُ ليحلّ محلّ اختيارٍ
 *      صريح. والقديمُ يملأ **الغيابَ وحدَه**.
 *
 * ⚠️ **وهذه الوحدةُ خالصة**: لا قاعدةَ ولا مزوّدَ ولا نطق. تأخذ
 *    إعداداتٍ وتعيد قيمةً أو رقعةً تُحفَظ — فتُختبَر بمعزل.
 */

import { BROWSER_PROVIDER_ID } from './tts/browser-provider.js';

/** المزوّدُ الذي يخصّه الحقلُ القديمُ المسطَّح — منتقي «صوت الجهاز». */
export const LEGACY_VOICE_PROVIDER = BROWSER_PROVIDER_ID;

/**
 * خريطةُ الأصوات — مُرحَّلةً عند القراءة، بلا مسٍّ للمُدخَل.
 *
 * @param {{voiceByProvider?: object, voiceId?: string|null}|null} settings
 * @returns {Record<string, string|null>} نسخةٌ جديدةٌ دائمًا
 */
export function voiceMapOf(settings) {
  const stored = settings?.voiceByProvider;
  const map = stored && typeof stored === 'object' && !Array.isArray(stored)
    ? { ...stored }
    : {};
  const legacy = settings?.voiceId;
  /* القديمُ يملأ الغيابَ وحدَه — `in` لا القيمة، كي يبقى `null` الصريحُ صريحًا. */
  if (legacy && !Object.prototype.hasOwnProperty.call(map, LEGACY_VOICE_PROVIDER)) {
    map[LEGACY_VOICE_PROVIDER] = legacy;
  }
  return map;
}

/**
 * صوتُ مزوّدٍ بعينه — وافتراضًا مزوّدُ المتصفّح، وهو ما يقرؤه كلُّ قارئٍ اليوم.
 *
 * @returns {string|null}
 */
export function voiceFor(settings, providerId = LEGACY_VOICE_PROVIDER) {
  return voiceMapOf(settings)[providerId] || null;
}

/**
 * الرقعةُ التي تُحفَظ حين يُختار صوتٌ لمزوّد.
 *
 * ⚠️ **ولمزوّد المتصفّح يُكتَب الحقلُ القديمُ معها** مرآةً — وهو ما
 *    يجعل «لا تحذف القديم» صادقًا بعد أوّل اختيارٍ لا قبله فقط.
 *
 * @returns {{voiceByProvider: Record<string, string|null>, voiceId?: string|null}}
 */
export function voicePatch(settings, providerId, voiceId) {
  const value = voiceId || null;
  const patch = { voiceByProvider: { ...voiceMapOf(settings), [providerId]: value } };
  if (providerId === LEGACY_VOICE_PROVIDER) patch.voiceId = value;
  return patch;
}

/**
 * LingoLife — هُويّةُ الجهاز (WS-G · بند ٤)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **معرِّفُ تركيبٍ لا معرِّفُ إنسان**
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا الرقم يقول «أيُّ نسخةٍ مُثبَّتةٍ كتبت هذا التغيير»، ولا يقول من
 * أنت. ولا يُشتقّ من `userAgent` ولا من طرازٍ ولا من بصمةِ متصفّح —
 * فتلك تُعرِّف **الجهاز** لأيّ موقعٍ يقرؤها، وهذه تُعرِّف **التركيب**
 * لنفسها وحدها.
 *
 * ⚠️ **وليس سرًّا ولا إثباتَ ثقة** (بند ٧١): من يملك الحزمةَ يقرأ
 *    المعرِّفَ فيها. طبقةُ النقل القادمة هي التي تُثبت وتؤمّن؛ وتسميةُ
 *    هذا «مصادقة» كذبٌ على النفس.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا `localStorage` لا `settings` في القاعدة؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن الهُويّةَ خاصّةُ **التركيب** لا خاصّةُ **البيانات**. ولو عاشت في
 * القاعدة لَحملَتها النسخةُ الاحتياطية، فيسترجعُها الموبايلُ من التابلت
 * فيصير للجهازين معرِّفٌ واحد — ومتّجهُ الإصدارات ساعتها يزعم أن كلّ
 * ما كتبه أحدُهما كتبه الآخر، فيتوقّف كلٌّ منهما عن طلب شيء.
 *
 * وهي نفسُ حُجّة مؤشّر الخانات في `db-slots.js` حرفًا بحرف.
 */

import { newId } from '../../utils/ids.js';

const ID_KEY = 'lingolife.deviceId';
const LABEL_KEY = 'lingolife.deviceLabel';

/** بادئةُ معرِّفات الأجهزة — تُقرأ في الحزم وفي التقارير. */
export const DEVICE_PREFIX = 'DEV';

/**
 * ذاكرةٌ احتياطيّةٌ حين يُمنَع `localStorage` (تصفّحٌ خاصّ، إعداداتٌ
 * صارمة). الجلسةُ ساعتها لها هُويّةٌ تعيش بحياتها — وهو أصدقُ من
 * الرمي، وأصدقُ من هُويّةٍ ثابتةٍ مزعومةٍ لا تُحفَظ.
 */
let memoryId = null;
let memoryLabel = null;

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * معرِّفُ هذا التركيب — يُولَّد مرّةً ويبقى.
 *
 * ⚠️ **ولا يُولَّد في كلّ جلسة**: نداءان في نفس الجلسة أو بعد إعادة
 *    التشغيل يعطيان نفسَ القيمة. ولو تغيّر لصار كلُّ فتحِ تطبيقٍ
 *    «جهازًا جديدًا» في متّجه الإصدارات، فينمو المتّجه بلا حدّ.
 */
export function deviceId() {
  const stored = read(ID_KEY);
  if (stored) return stored;
  if (memoryId) return memoryId;

  const fresh = newId(DEVICE_PREFIX);
  if (!write(ID_KEY, fresh)) memoryId = fresh;
  return fresh;
}

/** هل نجحت كتابةُ الهُويّة على القرص؟ — يُعرَض في شاشة المزامنة. */
export function devicePersisted() {
  return Boolean(read(ID_KEY));
}

/** اسمٌ بشريٌّ اختياريّ — «التابلت»، «الموبايل». زينةٌ لا هُويّة. */
export function deviceLabel() {
  return read(LABEL_KEY) || memoryLabel || '';
}

/** يسمّي هذا الجهاز. لا أثرَ له على الدمج إطلاقًا. */
export function setDeviceLabel(label) {
  const clean = String(label || '').trim().slice(0, 60);
  if (!write(LABEL_KEY, clean)) memoryLabel = clean;
  return clean;
}

/** بطاقةُ الجهاز كما تدخل الحزمة. */
export function localDevice() {
  return { id: deviceId(), label: deviceLabel(), persisted: devicePersisted() };
}

/**
 * ⚠️ **للاختبار وحده** — يفرض هُويّةً بعينها على هذه الجلسة.
 *
 * محاكي الجهازين يحتاج أن يكتب بهُويّة «التابلت» ثم بهُويّة «الموبايل»
 * في نفس المتصفّح. وبلا هذا الباب لكان الاختبارُ سيبني هُويّتين وهميّتين
 * لا يمرّان بالمسار الحقيقيّ — أي أنه يختبر نفسَه لا التطبيق.
 */
export function __forceDeviceId(id) {
  memoryId = id || null;
  if (id) write(ID_KEY, id);
}

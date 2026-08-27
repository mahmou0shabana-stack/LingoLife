/**
 * LingoLife — مخزنُ التركيب (WS-H)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ما يخصّ التركيبَ لا يخصّ البيانات**
 * ═══════════════════════════════════════════════════════════════
 *
 * ثلاثةُ أشياءَ تعيش خارج القاعدة لأنها خاصّةُ **هذه النسخة المثبَّتة**
 * لا خاصّةُ ذكرياتك:
 *
 *   معرِّفُ الجهاز       `device.js`
 *   مؤشّرُ خانة القاعدة   `db-slots.js`
 *   وما هنا: الكونُ السحابيّ، وآخرُ متّجهٍ رأته المزامنة
 *
 * ولو عاشت في القاعدة لحملتها النسخةُ الاحتياطية، فيسترجعُها جهازٌ آخر
 * فيرث هُويّةَ غيره — وهو ما تمنعه ترويسةُ `device.js` بالتفصيل.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والنطاقُ قابلٌ للتبديل — لسببٍ اكتشفه الاختبار**
 * ═══════════════════════════════════════════════════════════════
 *
 * في الحياة كلُّ جهازٍ متصفّحٌ مستقلٌّ بـ`localStorage` مستقلّ. أمّا
 * محاكي الأجهزة فيشغّلها في متصفّحٍ واحد — وقد قِيس فسقط: «التابلت»
 * و«الموبايل» كانا يتشاركان **نفسَ الكون ونفسَ نقطة التفتيش**، فيرى
 * أحدُهما أن الآخرَ رفع فيظنّ أنه هو من رفع.
 *
 * فالنطاقُ يتبدّل مع الجهاز، كما يتبدّل مؤشّرُ الخانة تمامًا
 * (`db-slots.useSlots`) ولنفس السبب بحرفه. والإنتاجُ لا يتغيّر: النطاقُ
 * الافتراضيّ فارغ، ولا سطرَ في التطبيق ينادي `useInstallNamespace`.
 */

let namespace = '';

/** ⚠️ للاختبار وحده — يعزل مفاتيحَ تركيبٍ عن آخر. */
export function useInstallNamespace(value = '') {
  namespace = value ? `${value}.` : '';
  return namespace;
}

/** المفتاحُ الكامل بعد النطاق. */
export const installKey = (key) => `lingolife.${namespace}${key}`;

export function readInstall(key) {
  try {
    return localStorage.getItem(installKey(key));
  } catch {
    return null;
  }
}

export function writeInstall(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(installKey(key));
    else localStorage.setItem(installKey(key), value);
    return true;
  } catch {
    return false;
  }
}

/** يمحو كلَّ مفاتيح هذا التركيب — يُنادى في الاختبار وعند فكِّ الارتباط. */
export function clearInstall(keys) {
  for (const key of keys) writeInstall(key, null);
}

/** أسماءُ المفاتيح — مكتوبةٌ مرّةً فلا تتفرّق حروفُها بين ملفّين. */
export const INSTALL = Object.freeze({
  UNIVERSE: 'sync.universe',
  VECTOR_SEEN: 'sync.vectorSeen',
});

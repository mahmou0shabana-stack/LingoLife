/**
 * LingoLife — نسخة البناء الجارية
 *
 * ⚠️ تُقرأ من **عامل الخدمة** لا من ثابتٍ في الكود. الثابت يتقادم بلا
 *    أن يشتكي — وهو الدرس نفسه الذي كلّفنا `SCHEMA_VERSION`: كان
 *    مكتوبًا يدويًّا بـ1 والقاعدة على v2، فكان كل تصدير يختم نفسه
 *    بإصدارٍ خاطئ.
 *
 *    و`__BUILD__` في `service-worker.js` تُستبدَل وقت النشر، فهي
 *    المصدر الوحيد الذي لا يكذب.
 *
 * ⚠️ ولا يُخترَع بديلٌ عند الفشل. لو لم يُسجَّل عاملُ خدمةٍ بعد — أو
 *    كنتَ تفتح من `file://` — يُرجَّع فراغ، والتصدير يحذف السطر بدل
 *    أن يكتب «غير معروف» فيبدو كأنه قيمة.
 */

let cached = null;

/** نسخة البناء، أو `''` إن تعذّرت — بلا تخمين. */
export async function appBuild() {
  if (cached !== null) return cached;

  cached = await new Promise((resolve) => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return resolve('');

    const channel = new MessageChannel();
    /*
     * مهلةٌ قصيرة: عاملُ خدمةٍ لا يردّ يجب ألّا يُعلّق حفظ ملاحظة.
     * تسجيل الملاحظة أهمّ من معرفة رقم البناء.
     */
    const timer = setTimeout(() => resolve(''), 400);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      const value = event.data?.build || '';
      // `__BUILD__` حرفيًّا تعني أن الاستبدال لم يحدث — وهي ليست نسخة.
      resolve(value === '__BUILD__' ? '' : value);
    };

    try {
      worker.postMessage({ type: 'GET_BUILD' }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve('');
    }
  });

  return cached;
}

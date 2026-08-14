/**
 * LingoLife — الحالة العابرة وإعادة العرض
 *
 * ثلاثة أشياء كانت حبيسة `app.js` بينما يحتاجها كل نموذج وكل عارض:
 * حالة الشاشة الجارية، وإعادة رسم المشهد بعد تعديل، وتحديث بطاقة
 * التخزين.
 *
 * وُضعت هنا لتكون **الوصلة** التي تسمح بتقسيم `app.js` بلا دورات
 * استيراد: الوحدات المقسَّمة تستورد من هنا، وهذه الوحدة لا تستورد من
 * أيٍّ منها. لو بقيت في `app.js` لاحتاج كل نموذجٍ أن يستورده،
 * واحتاج `app.js` أن يستورد كل نموذج — وهي الدورة بعينها.
 */

import { $, formatBytes } from './utils/dom.js';
import { getCurrentRoute, navigate } from './router.js';
import { estimateStorage, storageLevel } from './services/storage-service.js';
import { renderScene } from './views/scene-view.js';

/**
 * حالة عابرة للشاشة الحالية — أي سكريبت معروض مثلًا.
 * تموت مع الشاشة عمدًا: ما يستحقّ البقاء مكانه القاعدة.
 */
export const ui = { activeScriptId: null };

/** بطاقة التخزين في الشريط الجانبي — أرقام حقيقية لا تقديرات. */
export async function refreshStorageCard() {
  const card = $('#storage-card');
  if (!card) return;
  try {
    const { usage, quota, percent } = await estimateStorage();
    const bar = card.querySelector('.meter');
    const text = card.querySelector('[data-storage-text]');
    if (percent !== null) {
      bar.className = `meter ${storageLevel(percent) === 'ok' ? '' : storageLevel(percent)}`;
      bar.firstElementChild.style.width = `${Math.max(percent, 1)}%`;
      text.innerHTML = `<bdi>${formatBytes(usage)}</bdi> من <bdi>${formatBytes(quota)}</bdi>`;
    } else {
      text.textContent = 'غير متاح';
    }
  } catch {
    /* غير حرج */
  }
}

/**
 * يعيد عرض المشهد الحالي بعد تعديل.
 *
 * وإن كنت خارج شاشة المشهد ينتقل إليها — فالتعديل الذي أجريته من
 * مكانٍ آخر يستحقّ أن تراه.
 */
export async function reloadScene(sceneId) {
  const path = getCurrentRoute()?.path || '';
  if (path.startsWith('/scene/')) {
    await renderScene($('#app-main'), sceneId, ui);
    refreshStorageCard();
  } else {
    navigate(`/scene/${sceneId}`);
  }
}

/**
 * يُنعش شاشة المشهد **إن كانت هي المعروضة** — ولا ينتقل إليها أبدًا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا لا تكفي `reloadScene` أعلاه؟
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن فرعَها الآخر **ينقلك**. وهو صحيحٌ لتعديلٍ أجريتَه من مكانٍ
 * آخر: عدّلتَ عنوان ذكرى من النهر فتستحقّ أن ترى النتيجة.
 *
 * وهو **كارثيٌّ لإغلاق طبقة**. عارضُ الصور ينادي `reloadScene` عند
 * إغلاقه، فإن فتحتَه من داخل كتاب الظلّ — وقد صار ذلك ممكنًا في
 * WS25 — كان إغلاقُ الصورة **يقذفك خارج الجلسة** إلى شاشة الذكرى.
 *
 * ⚠️ **بلاغُك**: «لما باجي أفتح الصورة في صفحة الشادوينج مبعرفش
 *    أخرج منها… كل حاجة بتبوظ». وهو لم يكن تعذّرَ خروجٍ بل خروجًا
 *    إلى المكان الخطأ: الصورةُ تُغلَق، والجلسةُ تُهدَم معها.
 *
 * فالقاعدة: **إغلاقُ طبقةٍ لا ينقل أحدًا**. طبقةٌ تُرفَع تُعيدك إلى
 * ما تحتها، أيًّا كان.
 */
export async function refreshSceneIfShowing(sceneId) {
  const path = getCurrentRoute()?.path || '';
  if (!sceneId || !path.startsWith('/scene/')) return;
  await renderScene($('#app-main'), sceneId, ui);
  refreshStorageCard();
}

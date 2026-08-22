/**
 * LingoLife — الحذف كمبدأ واحد
 *
 * لا يوجد في هذا التطبيق زرّ حذف يمشي بلا سؤال، ولا حذفٌ يمضي بلا
 * طريق رجوع. القاعدة سطران:
 *
 *   1. **تأكيد قبله** — يذكر ما ستفقده بالاسم، لا «هل أنت متأكد؟».
 *   2. **استعادة بعده** — إشعار فيه «تراجع» يعيد الأمر كما كان.
 *
 * ما يجعل هذا ممكنًا أن الحذف من الواجهة **نقلٌ إلى السلة** لا محو:
 * `repo.trash(id)` يضع علامة ويحفظ `deletedAt`، و`repo.restore(id)`
 * يرجعها. المحو الفعلي (`destroy`) لا يحدث إلا من شاشة السلة، بتأكيد
 * ثانٍ يقول صراحةً إنه بلا رجعة.
 *
 * الصور والأصوات لها فرقٌ واحد: ملفّها في `media` والرابط الذي يربطها
 * بالذكرى في `sceneMediaLinks`. نُلغي الرابط ونُبقي الملف — فالاستعادة
 * لا تحتاج أن تجد الـ Blob من جديد.
 */

import { confirmAction } from '../components/modal.js';
import { toast, toastError } from '../components/toast.js';
import { esc } from '../utils/dom.js';

/**
 * نصّ رسالة التأكيد.
 * `detail` نصّ خامّ من بياناتك (عنوان سكريبت، اسم متحدّث) — يُهرَّب
 * قبل الحقن، فلا يتحوّل عنوان فيه `<` إلى وسم.
 */
function confirmBody(detail, tail) {
  return `${detail ? `${esc(detail)}<br><br>` : ''}${tail}`;
}

/**
 * يحذف سجلًا بتأكيدٍ قبله وإشعار استعادة بعده.
 *
 * @param {object} options
 * @param {{ trash: Function, restore: Function }} options.repo المستودع
 * @param {string} options.id
 * @param {string} options.what اسم النوع في السؤال — «الصورة دي»
 * @param {string} [options.detail] ما سيُفقَد بالتحديد، سطر واحد
 * @param {string} [options.confirmLabel]
 * @param {() => any} [options.after] يُنادى بعد الحذف وبعد الاستعادة
 * @returns {Promise<boolean>} هل حُذف فعلًا؟
 */
export async function deleteWithUndo({
  repo,
  id,
  what,
  detail = '',
  confirmLabel = 'احذف',
  after = null,
  cascade = null,
}) {
  const ok = await confirmAction({
    title: `تحذف ${what}؟`,
    message: confirmBody(detail, 'هتروح لسلة المهملات، وتقدر ترجّعها في أي وقت.'),
    confirmLabel,
    danger: true,
  });
  if (!ok) return false;

  try {
    await repo.trash(id);
    /*
     * ⚠️ **وما تحت السجلّ يذهب معه — وإلّا بقي معلّقًا بلا باب** (WS57).
     *
     * السكريبتُ صار قد يحمل تحته رحلةَ تدريبٍ كاملة: عُقَدٌ هي سكريبتات
     * بـ`sceneId: null`، لا يراها الوضعُ القديم **بالتصميم**. فحذفُ
     * الأب وحدَه كان يترك عشرات العُقَد نشطةً في القاعدة لا يصل إليها
     * أحد — لا الوضعُ القديم ولا الجديد ولا السلة.
     *
     * ⚠️ **والتراجعُ يُرجعها كلَّها.** لو رجّعنا الأبَ وحدَه لكان
     *    «التراجع» كذبًا: تضغطه فيعود السكريبتُ فارغًا من رحلته.
     */
    await cascade?.trash?.();
  } catch (err) {
    toastError(err.message || 'مقدرناش نحذف');
    return false;
  }

  await after?.();

  // صيغة المتكلّم الجمع لأنها بلا جنس: «نقلنا الصورة دي» و«نقلنا
  // التعبير ده» صحيحتان معًا، بخلاف «اتشالت/اتشال».
  toast(`نقلنا ${what} للسلة`, {
    actionLabel: 'تراجع',
    onAction: async () => {
      try {
        await repo.restore(id);
        await cascade?.restore?.();
        await after?.();
        toast('تمّ التراجع', { type: 'ok' });
      } catch (err) {
        toastError(err.message || 'مقدرناش نرجّعها');
      }
    },
  });

  return true;
}

/**
 * نفس المبدأ لعملية لا يملكها مستودع واحد.
 *
 * تمرّر `remove` و`restore` بنفسك، ويتكفّل هو بالتأكيد والإشعار —
 * فلا يتفلّت مسار حذفٍ من القاعدة لمجرّد أن شكله مختلف.
 *
 * @param {object} options
 * @param {() => Promise<any>} options.remove
 * @param {() => Promise<any>} options.restore
 * @param {string} options.what
 * @param {string} [options.detail]
 * @param {string} [options.confirmLabel]
 * @param {() => any} [options.after]
 * @returns {Promise<boolean>}
 */
export async function actWithUndo({
  remove,
  restore,
  what,
  detail = '',
  confirmLabel = 'احذف',
  after = null,
}) {
  const ok = await confirmAction({
    title: `تحذف ${what}؟`,
    message: confirmBody(detail, 'تقدر ترجّعها من الإشعار اللي هيظهر بعد الحذف.'),
    confirmLabel,
    danger: true,
  });
  if (!ok) return false;

  try {
    await remove();
  } catch (err) {
    toastError(err.message || 'مقدرناش نحذف');
    return false;
  }

  await after?.();

  // بلا جنس — انظر التعليق في `deleteWithUndo`.
  toast(`شيلنا ${what}`, {
    actionLabel: 'تراجع',
    onAction: async () => {
      try {
        await restore();
        await after?.();
        toast('تمّ التراجع', { type: 'ok' });
      } catch (err) {
        toastError(err.message || 'مقدرناش نرجّعها');
      }
    },
  });

  return true;
}

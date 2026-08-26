/**
 * LingoLife — Modal
 * ورقة سفلية على الهاتف، نافذة مركزية على الشاشات الأكبر.
 * يدعم Escape، النقر خارج النافذة، وحبس التركيز.
 */

import { pushLayer, dropLayer } from './layers.js';

/**
 * مكدّس النوافذ.
 *
 * كان متغيّرًا واحدًا، فكانت كل نافذة جديدة تغلق التي قبلها. لكن بعض
 * الطرق تمرّ بنافذتين: تفتح «ذكرى جديدة» ← «أنواع» ← «ادمج». إغلاق
 * الأولى عند فتح الثانية كان يبتلع ما كتبته.
 */
const stack = [];

/**
 * يفتح نافذة.
 * @param {{ title: string, body: string, actions?: {label,value,variant}[],
 *           onSubmit?: (formData: object, close: Function) => void|Promise<void> }} options
 * @returns {Promise<string|null>} قيمة الزر المضغوط، أو null عند الإلغاء
 */
/**
 * @param {{title, body, actions, onSubmit, submitLabel,
 *          onMount?: (modal: HTMLElement) => void, wide?: boolean}} config
 *
 * `wide` لنصٍّ طويل — النصّ الأصلي أطولُ ما يُكتب في التطبيق، ومربّعٌ
 * بعرض النموذج العادي يجعلك تكتب أقلّ ممّا تذكر *(A6)*.
 *
 * `onMount` تُنادى بعد إلحاق النافذة بالصفحة: حقلٌ حيّ داخل نموذج
 * (منتقي المتحدّث مثلًا) يحتاج أن يربط مستمعيه، ولا يمكنه ذلك قبل
 * وجود عناصره في الـDOM.
 */
export function showModal({
  title, body, actions, onSubmit, submitLabel = 'حفظ', onMount, wide = false,
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const buttons = actions || [
      { label: 'إلغاء', value: null, variant: 'ghost' },
      { label: submitLabel, value: 'submit', variant: 'primary' },
    ];

    overlay.innerHTML = `
      <div class="modal${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        <h2>${title}</h2>
        <form data-modal-form>
          ${body}
          <div class="modal-actions">
            ${buttons
              .map(
                (b) =>
                  `<button type="${b.value === 'submit' ? 'submit' : 'button'}"
                     class="btn btn-${b.variant || 'ghost'}"
                     data-value="${b.value ?? ''}">${b.label}</button>`
              )
              .join('')}
          </div>
        </form>
      </div>`;

    /*
     * ⚠️ **الطبقة تُرفَع مع النافذة.** بدونها يبقى في التاريخ مدخلٌ
     *    ميّتٌ لكل نافذةٍ فتحتَها، فتضغط رجوع فلا يحدث شيء.
     */
    let layer = null;
    const finish = (value) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      const index = stack.indexOf(overlay);
      if (index >= 0) stack.splice(index, 1);
      if (layer) dropLayer(layer);
      resolve(value);
    };

    /*
     * ⚠️ **بابُ إغلاقٍ برمجيٌّ لمن هو داخلَ النافذة** (WS-C2).
     *    كان زرٌّ داخل النافذة يريد إغلاقَها فيبحث عن زرِّ الصفّ
     *    السفليّ و«ينقره» — نقرٌ ملفَّقٌ يعتمد على مُحدِّدٍ قد يتغيّر،
     *    ولا يخبرك إن فشل. وهنا الإغلاقُ هو `finish` نفسُها: الطبقةُ
     *    تنزل، والوعدُ يُحلّ، والمستمعون يُرفَعون.
     */
    overlay.__close = finish;

    const onKey = (event) => {
      // Escape يغلق الأعلى فقط، لا المكدّس كلّه.
      if (event.key === 'Escape' && stack[stack.length - 1] === overlay) finish(null);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(null);
    });

    const form = overlay.querySelector('[data-modal-form]');

    // أزرار الإغلاق هي أزرار الصفّ السفلي وحدها. كان الاستعلام يشمل
    // كل `button[type="button"]` في النافذة، فأيّ زرّ أداة داخل النموذج
    // (مثل «أنواع») كان يغلقها ويبتلع ما كُتب فيها.
    overlay.querySelectorAll('.modal-actions button[type="button"]').forEach((button) => {
      button.addEventListener('click', () => finish(button.dataset.value || null));
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (onSubmit) {
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
          await onSubmit(data, () => finish('submit'));
        } catch (err) {
          submitButton.disabled = false;
          throw err;
        }
      } else {
        finish('submit');
      }
    });

    document.addEventListener('keydown', onKey);
    /* زرُّ رجوع النظام يقفلها هي لا الصفحة اللي تحتها. */
    layer = pushLayer(() => finish(null), { id: 'modal' });
    // كل طبقة أعلى من التي تحتها، وإلا اختفت خلفها.
    overlay.style.zIndex = `calc(var(--z-overlay) + ${stack.length})`;
    document.body.append(overlay);
    stack.push(overlay);

    // قبل التركيز: `onMount` قد تُخفي حقلًا أو تُظهره، والتركيز على
    // حقلٍ مخفيّ لا يعمل.
    onMount?.(overlay.querySelector('.modal'));

    const firstField = overlay.querySelector(
      'input:not([hidden]), textarea:not([hidden]), select:not([hidden])'
    );
    firstField?.focus();
  });
}

/**
 * يغلق النافذةَ التي يقع فيها هذا العنصر — من داخل محتواها.
 *
 * تُستعمَل حين يكون فعلُ الزرِّ **مغادرةَ** النافذة إلى شيءٍ خلفها
 * (مثل «تدرّب على الصح»: تُغلَق ذاكرةُ الكلمة ثم يدخل التصحيحُ
 * المشغّل). والقيمةُ المُحلَّلة `null` — أي «انصرفتُ» لا «حفظتُ».
 *
 * @param {Element|null} node عنصرٌ داخل النافذة
 * @returns {boolean} هل وُجدت نافذةٌ وأُغلقت فعلًا
 */
export function closeOverlayOf(node) {
  const overlay = node?.closest?.('.overlay');
  if (!overlay || typeof overlay.__close !== 'function') return false;
  overlay.__close(null);
  return true;
}

/** يغلق كل النوافذ المفتوحة. */
export function closeModal() {
  while (stack.length) stack.pop().remove();
}

/**
 * يُدخل طبقةً بُنيت خارج `showModal` في نفس المكدّس.
 *
 * لوحة الأنواع تبني طبقتها بنفسها (لأنها ليست نموذجًا يُرسَل)، ومع
 * ذلك يجب أن تعرف ترتيبها: تعلو نموذج الذكرى الذي فُتحت منه، وتقبع
 * تحت نافذة الدمج التي تفتحها.
 *
 * @param {HTMLElement} overlay
 * @returns {() => void} نداء الإخراج — استدعِه عند الإغلاق
 */
export function registerOverlay(overlay) {
  overlay.style.zIndex = `calc(var(--z-overlay) + ${stack.length})`;
  stack.push(overlay);
  return () => {
    const index = stack.indexOf(overlay);
    if (index >= 0) stack.splice(index, 1);
  };
}

/** هل هذه الطبقة هي الأعلى الآن؟ — لتوجيه Escape للأعلى فقط. */
export function isTopOverlay(overlay) {
  return stack[stack.length - 1] === overlay;
}

/**
 * تأكيد قبل إجراء خطر.
 * الحذف النهائي لا يمرّ بدونه (بند 52).
 */
export async function confirmAction({ title, message, confirmLabel = 'تأكيد', danger = false }) {
  const value = await showModal({
    title,
    body: `<p style="color:var(--ink-soft);line-height:1.8">${message}</p>`,
    actions: [
      { label: 'إلغاء', value: null, variant: 'ghost' },
      { label: confirmLabel, value: 'submit', variant: danger ? 'danger' : 'primary' },
    ],
  });
  return value === 'submit';
}

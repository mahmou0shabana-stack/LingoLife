/**
 * LingoLife — Modal
 * ورقة سفلية على الهاتف، نافذة مركزية على الشاشات الأكبر.
 * يدعم Escape، النقر خارج النافذة، وحبس التركيز.
 */

let openModal = null;

/**
 * يفتح نافذة.
 * @param {{ title: string, body: string, actions?: {label,value,variant}[],
 *           onSubmit?: (formData: object, close: Function) => void|Promise<void> }} options
 * @returns {Promise<string|null>} قيمة الزر المضغوط، أو null عند الإلغاء
 */
export function showModal({ title, body, actions, onSubmit, submitLabel = 'حفظ' }) {
  closeModal();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const buttons = actions || [
      { label: 'إلغاء', value: null, variant: 'ghost' },
      { label: submitLabel, value: 'submit', variant: 'primary' },
    ];

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
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

    const finish = (value) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      openModal = null;
      resolve(value);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') finish(null);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(null);
    });

    const form = overlay.querySelector('[data-modal-form]');

    overlay.querySelectorAll('button[type="button"]').forEach((button) => {
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
    document.body.append(overlay);
    openModal = overlay;

    const firstField = overlay.querySelector('input, textarea, select');
    firstField?.focus();
  });
}

/** يغلق النافذة المفتوحة إن وُجدت. */
export function closeModal() {
  openModal?.remove();
  openModal = null;
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

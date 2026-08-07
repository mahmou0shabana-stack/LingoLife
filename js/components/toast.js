/**
 * LingoLife — Toast
 * إشعارات قصيرة، مع دعم "تراجع" للإجراءات المهمة (بند 53).
 */

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement('div');
  host.className = 'toast-host';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  document.body.append(host);
  return host;
}

/**
 * يعرض إشعارًا.
 * @param {string} message
 * @param {{ type?: 'info'|'ok'|'err', duration?: number,
 *           actionLabel?: string, onAction?: () => void }} options
 */
export function toast(message, options = {}) {
  const { type = 'info', duration = 3200, actionLabel, onAction } = options;
  const node = document.createElement('div');
  node.className = `toast${type === 'info' ? '' : ` ${type}`}`;

  const text = document.createElement('span');
  text.textContent = message;
  node.append(text);

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    node.classList.add('leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
  };

  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.className = 'toast-action';
    button.textContent = actionLabel;
    button.addEventListener('click', () => {
      dismiss();
      onAction();
    });
    node.append(button);
  }

  ensureHost().append(node);
  timer = setTimeout(dismiss, actionLabel ? Math.max(duration, 6000) : duration);
  return dismiss;
}

export const toastOk = (msg, opts) => toast(msg, { ...opts, type: 'ok' });
export const toastError = (msg, opts) => toast(msg, { ...opts, type: 'err', duration: 5000 });

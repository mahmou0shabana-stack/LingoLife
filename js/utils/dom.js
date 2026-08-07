/**
 * LingoLife — مساعدات DOM
 *
 * قاعدة أمان: كل نص يأتي من المستخدم يمرّ على `esc` قبل الحقن في HTML.
 * ولتفادي النسيان: استخدم القالب الموسوم `html` — يهرّب تلقائيًا.
 */

/** يهرّب نصًا ليكون آمنًا داخل HTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * قالب موسوم يهرّب كل القيم المُدرجة تلقائيًا.
 * لإدراج HTML مبني مسبقًا بأمان، مرّره عبر `raw()`.
 *
 *   html`<h1>${userTitle}</h1>${raw(builtMarkup)}`
 */
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => {
    if (i === 0) return str;
    const value = values[i - 1];
    let rendered;
    if (value instanceof RawHtml) rendered = value.value;
    else if (Array.isArray(value)) {
      rendered = value.map((v) => (v instanceof RawHtml ? v.value : esc(v))).join('');
    } else rendered = esc(value);
    return out + rendered + str;
  }, '');
}

class RawHtml {
  constructor(value) {
    this.value = value ?? '';
  }
}

/** يمنع تهريب قيمة — استخدمها فقط مع HTML بنيته أنت. */
export function raw(value) {
  return new RawHtml(value);
}

/** يعرض القيمة أو بديلًا إن كانت فارغة. */
export function or(value, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : value;
}

/* ------------------------------------------------------------
   اختيار العناصر
   ------------------------------------------------------------ */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * تفويض الأحداث — نربط مستمعًا واحدًا على الجذر بدل مستمع لكل زر.
 * ضروري لأن الشاشات تُعاد كتابتها بالكامل عند كل render.
 *
 * @param {Element} root
 * @param {string} eventName
 * @param {string} selector
 * @param {(event: Event, target: Element) => void} handler
 */
export function delegate(root, eventName, selector, handler) {
  root.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

/** ينشئ عنصرًا بخصائصه وأبنائه. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(key, value === true ? '' : value);
    }
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

/* ------------------------------------------------------------
   تنسيق
   ------------------------------------------------------------ */

/** حجم بالبايت إلى نص مقروء. */
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} بايت`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

/** مدة بالملّي ثانية إلى "04:21". */
export function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** ينسخ نصًا إلى الحافظة، مع بديل للمتصفحات القديمة. */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** ينزّل Blob كملف. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // نمهل المتصفح قليلًا قبل تحرير الرابط وإلا قد يُلغى التنزيل.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

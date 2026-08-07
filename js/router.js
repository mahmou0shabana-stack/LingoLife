/**
 * LingoLife — التوجيه
 *
 * Hash routing متعمّد: يعمل على GitHub Pages تحت مسار فرعي
 * بلا أي إعادة كتابة على الخادم، ويعمل من file:// أيضًا.
 *
 * المسارات:
 *   #/                  → الآن
 *   #/life              → حياتي
 *   #/language          → لغتي
 *   #/scene/SC_xxx      → مشهد
 *   #/search            → بحث
 *   #/trash             → السلة
 *   #/settings          → الإعدادات
 */

const routes = [];
let notFoundHandler = null;
let currentRoute = null;

/**
 * يسجّل مسارًا.
 * @param {string} pattern — مثل '/scene/:id'
 * @param {(params: object) => void | Promise<void>} handler
 */
export function route(pattern, handler) {
  const paramNames = [];
  const regexSource = pattern
    .replace(/\/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '/([^/]+)';
    })
    .replace(/\//g, '\\/');

  routes.push({
    pattern,
    regex: new RegExp(`^${regexSource}$`),
    paramNames,
    handler,
  });
}

/** معالج المسار غير الموجود. */
export function notFound(handler) {
  notFoundHandler = handler;
}

/** المسار الحالي من الـ hash. */
export function currentPath() {
  const hash = window.location.hash.slice(1);
  return hash.startsWith('/') ? hash : '/';
}

/** انتقال برمجي. */
export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (replace) {
    window.location.replace(target);
  } else {
    window.location.hash = target;
  }
}

/** رجوع خطوة. */
export function back() {
  if (window.history.length > 1) window.history.back();
  else navigate('/');
}

/** معلومات المسار الحالي — تُستخدم لتحديد زر التنقّل النشط. */
export function getCurrentRoute() {
  return currentRoute;
}

/** يحلّ المسار الحالي ويشغّل معالجه. */
async function resolve() {
  const path = currentPath();

  for (const entry of routes) {
    const match = path.match(entry.regex);
    if (!match) continue;

    const params = {};
    entry.paramNames.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1]);
    });

    currentRoute = { pattern: entry.pattern, path, params };
    try {
      await entry.handler(params);
    } catch (err) {
      console.error(`[router] فشل عرض المسار ${path}`, err);
      throw err;
    }
    return;
  }

  currentRoute = { pattern: null, path, params: {} };
  if (notFoundHandler) await notFoundHandler(path);
}

/** يبدأ الاستماع لتغيّر الـ hash ويحلّ المسار الحالي. */
export function startRouter() {
  window.addEventListener('hashchange', () => {
    resolve();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });

  if (!window.location.hash) {
    window.location.replace('#/');
    return;
  }
  return resolve();
}

/** يعيد عرض المسار الحالي (بعد تغيّر في البيانات). */
export function refresh() {
  return resolve();
}

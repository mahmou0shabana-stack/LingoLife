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
 * كم تنقُّلًا حدث **داخل التطبيق** منذ فتحه.
 *
 * ⚠️ هذا ما يجعل «رجوع» صادقًا. `window.history.length` يعدّ تاريخ
 *    التبويب كلّه — بما فيه الصفحات قبل التطبيق — فزرُّ رجوعٍ يعتمد
 *    عليه يخرجك من التطبيق إلى موقعٍ آخر. وهو خروجٌ لا رجوع.
 */
let depth = 0;

/** هل هناك موضعٌ داخل التطبيق نرجع إليه؟ */
export function canGoBack() {
  return depth > 0;
}

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

/**
 * المسار الحالي من الـ hash — **بلا ما بعد `?`**.
 *
 * ⚠️ `#/scene/SC_1?at=CP_9` مسارُه `/scene/SC_1` و«موضعُه» `at=CP_9`.
 *    والفصل ضروريّ: بدونه لا يطابق أيَّ مسارٍ مسجَّل، فتفتح شاشةُ
 *    «مش موجود» بدل الذكرى.
 */
export function currentPath() {
  const hash = window.location.hash.slice(1).split('?')[0];
  return hash.startsWith('/') ? hash : '/';
}

/**
 * ما بعد `?` في المسار — **موضعٌ داخل الشاشة لا وجهةٌ أخرى**.
 *
 * به يقول البحثُ «افتح الذكرى **وانزل على الجملة دي**»، فلا تصل إلى
 * أوّل الصفحة وتبحث بعينك عمّا ضغطتَ عليه.
 */
export function currentQuery() {
  const hash = window.location.hash.slice(1);
  const at = hash.indexOf('?');
  return at < 0 ? {} : Object.fromEntries(new URLSearchParams(hash.slice(at + 1)));
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

/**
 * رجوع خطوة — **داخل التطبيق**.
 *
 * ⚠️ وإن لم يكن هناك موضعٌ داخليّ فإلى «دلوقتي» لا إلى خارج التطبيق.
 */
export function back() {
  if (depth > 0) {
    depth -= 1;
    window.history.back();
    return;
  }
  navigate('/', { replace: true });
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

    if (currentRoute && currentRoute.path !== path) depth += 1;
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

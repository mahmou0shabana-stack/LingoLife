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
 * **الأثر** — المسارات التي جئتَ منها، آخرُها أوّلُ ما ترجع إليه.
 *
 * ⚠️ هذا ما يجعل «رجوع» صادقًا. `window.history.length` يعدّ تاريخ
 *    التبويب كلّه — بما فيه الصفحات قبل التطبيق — فزرُّ رجوعٍ يعتمد
 *    عليه يخرجك من التطبيق إلى موقعٍ آخر. وهو خروجٌ لا رجوع.
 *
 * ⚠️ **وكان عدّادًا فصار قائمة** (WS23). العدّاد يقول «فيه رجوع» ولا
 *    يقول **إلى أين** — وبلاغُك كان «مش عارف فين بيودّي على فين»، فلا
 *    يُجاب عنه برقم. والقائمة تُصلح معه عطبًا كان فيه: العدّاد يزيد مع
 *    كل `resolve` ولا ينقص أبدًا، لأن `back()` تُنقصه ثم يزيده
 *    الـ`hashchange` الناتج عنها. فكان «فيه رجوع» صحيحًا إلى الأبد ولو
 *    عدتَ إلى أوّل شاشةٍ فتحتها.
 */
let trail = [];

/**
 * يسجّل انتقالًا من مسارٍ إلى مسار.
 *
 * الرجوعُ يُعرَف بأثره لا بمن ناداه: إن كان الوصولُ إلى **آخر** ما في
 * الأثر فهو رجوع، فيُرفَع. وهذا يشمل زرَّ رجوعِ المتصفّح نفسه — ولا
 * سبيل لمعرفته غير هذا.
 *
 * ⚠️ مُصدَّرةٌ ليختبرها الاختبار مباشرةً: اختبارُها عبر `navigate`
 *    الحقيقيّة يعني نقلَ صفحة الاختبارات نفسها إلى مسارٍ آخر.
 */
export function recordMove(from, to) {
  if (!from || from === to) return;
  if (trail.at(-1) === to) trail.pop();
  else trail.push(from);
}

/** يمسح الأثر — للاختبارات وحدها. */
export function resetTrail() {
  trail = [];
  replacing = false;
}

/** هل هناك موضعٌ داخل التطبيق نرجع إليه؟ */
export function canGoBack() {
  return trail.length > 0;
}

/** المسارُ الذي سيعيدك إليه «رجوع» — أو `null` إن لم يكن. */
export function backTo() {
  return trail.at(-1) || null;
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

/**
 * هل الانتقال القادم **استبدالٌ** لا خطوةٌ جديدة؟
 *
 * ⚠️ `location.replace` تمحو المدخل الحاليّ من تاريخ المتصفّح ولا
 *    تضيف واحدًا. فلو عدّه الأثرُ خطوةً لصار فيه موضعٌ لا وجودَ له في
 *    التاريخ: تضغط «رجوع لـ …» فيعود المتصفّح خطوةً أبعد ممّا وعدَك
 *    الزرّ. وأظهرُ حالاته مسارٌ غيرُ موجودٍ يُستبدَل بـ«دلوقتي».
 */
let replacing = false;

/** انتقال برمجي. */
export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (replace) {
    /* ولو كان الهدف هو الحاليَّ فلا `hashchange` يأتي — فلا نرفع رايةً
       تبقى مرفوعةً حتى تبتلع التنقّل الذي بعدها. */
    replacing = window.location.hash !== target;
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
  /*
   * ⚠️ ولا نرفع من الأثر هنا: الرفعُ يتمّ في `resolve` حين يصل
   *    الـ`hashchange` فعلًا. رفعُه مرّتين — مرّةً هنا ومرّةً هناك —
   *    كان يُفقد خطوةً من الأثر في كل رجوع.
   */
  if (trail.length) {
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

    if (replacing) replacing = false;
    else recordMove(currentRoute?.path, path);
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

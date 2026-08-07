/**
 * LingoLife — نقطة الدخول
 *
 * الإقلاع: فتح القاعدة → طلب التخزين الدائم → تسجيل Service Worker →
 * تشغيل الموجّه. لا يُحمَّل شيء من القاعدة قبل الحاجة إليه (بند 69).
 */

import { openDB } from './db/database.js';
import { route, notFound, startRouter, navigate, back, refresh, getCurrentRoute } from './router.js';
import { requestPersistence } from './services/storage-service.js';
import { createScene, trashScene } from './services/scene-service.js';
import { settings } from './db/repositories.js';
import { today } from './utils/dates.js';
import { html, raw, $, delegate } from './utils/dom.js';
import { SCENE_TYPES } from './config.js';
import { icon } from './components/icons.js';
import { toast, toastOk, toastError } from './components/toast.js';
import { showModal } from './components/modal.js';

import { renderNow } from './views/now-view.js';
import { renderLife } from './views/life-view.js';
import { renderLanguage } from './views/language-view.js';
import { renderScene } from './views/scene-view.js';
import { renderSettings, handleSettingsAction } from './views/settings-view.js';
import { renderTrash, handleTrashAction } from './views/trash-view.js';

const main = $('#app-main');
const LAST_ROUTE_KEY = 'ui.lastRoute';

/* ------------------------------------------------------------
   عرض الشاشات
   ------------------------------------------------------------ */

/** يغلّف عرض شاشة بمعالجة أخطاء — لا شاشة بيضاء أبدًا. */
function view(renderFn) {
  return async (params) => {
    main.innerHTML = '<div class="loading"><span class="spinner"></span> لحظة…</div>';
    try {
      await renderFn(main, params?.id);
      syncNavState();
      rememberRoute();
    } catch (err) {
      console.error('[view] فشل العرض', err);
      main.innerHTML = html`
        <div class="empty-state">
          <div class="glyph">${raw(icon('info'))}</div>
          <h2>حصل خطأ في العرض</h2>
          <p>${err.message || 'خطأ غير معروف'}</p>
          <button class="btn btn-ghost" data-action="reload">أعد المحاولة</button>
        </div>`;
    }
  };
}

/** يحدّث الزر النشط في شريط التنقّل. */
function syncNavState() {
  const path = getCurrentRoute()?.path || '/';
  const active =
    path === '/' ? 'now' : path.startsWith('/life') || path.startsWith('/scene') ? 'life'
    : path.startsWith('/language') ? 'language' : null;

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    if (btn.dataset.nav === active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  // زر الإضافة يظهر في العوالم الرئيسية فقط.
  const fab = $('#fab');
  if (fab) fab.hidden = !(path === '/' || path.startsWith('/life'));
}

/** يحفظ آخر مسار لاستعادته عند إعادة الفتح (بند 85.34). */
function rememberRoute() {
  const path = getCurrentRoute()?.path;
  if (path && path !== '/settings') settings.set(LAST_ROUTE_KEY, path).catch(() => {});
}

/* ------------------------------------------------------------
   إنشاء مشهد
   ------------------------------------------------------------ */
async function openNewSceneModal() {
  await showModal({
    title: 'ذكرى جديدة',
    submitLabel: 'أنشئ',
    body: html`
      <div class="field">
        <label for="f-titleAr">العنوان بالعربي *</label>
        <input id="f-titleAr" name="titleAr" type="text" required
          placeholder="مثلًا: مراجعة عدم المطابقة" />
      </div>
      <div class="field">
        <label for="f-titleRu">العنوان بالروسي</label>
        <input id="f-titleRu" name="titleRu" type="text" dir="ltr" lang="ru"
          placeholder="Согласование несоответствия" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="f-date">التاريخ</label>
          <input id="f-date" name="date" type="date" value="${today()}" />
        </div>
        <div class="field">
          <label for="f-type">النوع</label>
          <select id="f-type" name="type">
            ${raw(SCENE_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join(''))}
          </select>
        </div>
      </div>
      <div class="field">
        <label for="f-place">المكان</label>
        <input id="f-place" name="placeName" type="text" placeholder="المصنع — موسكو" />
      </div>
      <div class="field">
        <label for="f-context">سياق قصير</label>
        <textarea id="f-context" name="context"
          placeholder="إيه اللي حصل في اللحظة دي؟"></textarea>
      </div>`,

    async onSubmit(data, close) {
      if (!data.titleAr?.trim()) {
        toastError('العنوان بالعربي مطلوب');
        throw new Error('العنوان مطلوب');
      }
      const scene = await createScene(data);
      close();
      toastOk('الذكرى اتحفظت');
      navigate(`/scene/${scene.id}`);
    },
  });
}

/* ------------------------------------------------------------
   تفويض الأحداث — مستمع واحد لكل التطبيق
   ------------------------------------------------------------ */
function wireActions() {
  delegate(document.body, 'click', '[data-action]', async (event, target) => {
    const { action, id, target: scrollTarget } = target.dataset;

    switch (action) {
      case 'new-scene':
        return openNewSceneModal();

      case 'open-scene':
        return navigate(`/scene/${id}`);

      case 'go-life':
        return navigate('/life');

      case 'back':
        return back();

      case 'reload':
        return refresh();

      case 'scroll-to': {
        const el = document.getElementById(scrollTarget);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      case 'trash-scene': {
        await trashScene(id);
        toast('اتنقلت لسلة المهملات', {
          actionLabel: 'تراجع',
          onAction: async () => {
            const { restoreScene } = await import('./services/scene-service.js');
            await restoreScene(id);
            toastOk('رجعت تاني');
            refresh();
          },
        });
        return navigate('/life');
      }

      case 'edit-scene':
        return toast('تعديل البيانات الوصفية — المرحلة 1');

      default: {
        // شاشات لها معالجاتها الخاصة
        if (await handleSettingsAction(action)) return;
        if (await handleTrashAction(action, id)) return;
      }
    }
  });
}

/* ------------------------------------------------------------
   Service Worker + شريط التحديث
   ------------------------------------------------------------ */
/**
 * إعادة التحميل مسموحة فقط لو المستخدم ضغط "حدّث".
 * بدون هذا العلم، `clients.claim()` عند أول تثبيت يطلق controllerchange
 * فيعيد تحميل الصفحة بلا سبب — وممكن يضيّع نموذجًا نصف مملوء.
 */
let updateAccepted = false;

function showUpdateBanner(worker) {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `<span>في نسخة جديدة من التطبيق</span><button type="button">حدّث دلوقتي</button>`;
  banner.querySelector('button').addEventListener('click', () => {
    updateAccepted = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
  document.body.append(banner);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // file:// لا يدعم Service Worker — نتخطاه بهدوء أثناء التطوير المحلي.
  if (window.location.protocol === 'file:') return;

  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');

    // لو في نسخة منتظرة بالفعل عند التحميل
    if (registration.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        // "installed" مع وجود controller = تحديث لا تثبيت أول
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(installing);
        }
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // لا نعيد التحميل إلا لو المستخدم طلب التحديث بنفسه.
      if (!updateAccepted || reloading) return;
      reloading = true;
      window.location.reload();
    });
  } catch (err) {
    console.warn('[sw] فشل التسجيل', err);
  }
}

/* ------------------------------------------------------------
   الإقلاع
   ------------------------------------------------------------ */
async function boot() {
  try {
    await openDB();
  } catch (err) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>تعذّر فتح قاعدة البيانات</h2>
        <p>${err.message}</p>
        <p class="text-sm text-faint">
          لو بتستخدم وضع التصفّح الخفي، جرّب نافذة عادية — IndexedDB بتتقفل هناك.
        </p>
      </div>`;
    return;
  }

  // التخزين الدائم — بدونه ممكن المتصفح يمسح البيانات عند امتلاء الجهاز.
  requestPersistence()
    .then((result) => {
      if (result.asked && !result.persisted) {
        console.warn('[storage] المتصفح رفض التخزين الدائم');
      }
    })
    .catch(() => {});

  route('/', view(renderNow));
  route('/life', view(renderLife));
  route('/language', view(renderLanguage));
  route('/scene/:id', view(renderScene));
  route('/settings', view(renderSettings));
  route('/trash', view(renderTrash));
  notFound(() => navigate('/', { replace: true }));

  wireActions();
  registerServiceWorker();

  await startRouter();
}

boot();

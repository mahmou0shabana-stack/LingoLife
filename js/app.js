/**
 * LingoLife — نقطة الدخول
 *
 * الإقلاع: فتح القاعدة → التخزين الدائم → Service Worker → الموجّه.
 * كل الأحداث تمرّ من مستمع واحد على body (الشاشات تُعاد كتابتها بالكامل).
 *
 * ما يبقى هنا: التمهيد، والتوجيه، وتفويض الأحداث — لا أكثر. النماذج
 * والعارض ومداخل الظلّ خرجت إلى وحداتها، فلا يمرّ كل شيء من عنق واحد.
 */

import { openDB } from './db/database.js';
import { cleanupStaleSlot } from './services/backup/restore.js';
import { route, notFound, startRouter, navigate, back, refresh, getCurrentRoute } from './router.js';
import { requestPersistence } from './services/storage-service.js';
import { trashScene, restoreScene } from './services/scene-service.js';
import {
  scenes, media, scripts, sceneMediaLinks, settings,
  conversationParts, mistakeComparisons, expressions,
} from './db/repositories.js';
import {
  removeFromScene, undoRemove, urlFor, releaseUrls, AUDIO_ROLE,
} from './services/media-service.js';
import {
  setPrimaryScript, scriptTypeLabel, saveBlock, getBlock,
  removeExpressionFromScene, undoRemoveExpression,
} from './services/content-service.js';
import { html, raw, $, delegate, copyToClipboard } from './utils/dom.js';
import { icon } from './components/icons.js';
import { primeTypes } from './services/type-service.js';
import { toast, toastOk, toastError } from './components/toast.js';
import { openTypeManager } from './components/type-manager.js';
import { refreshTypeSelect } from './components/type-select.js';
import { deleteWithUndo, actWithUndo } from './services/delete-service.js';
import { api as audio } from './services/audio-service.js';
import { closeAudioPanel } from './components/audio-player.js';
import { mountMiniPlayer } from './components/mini-player.js';

/* ---- الشاشات ---- */
import { renderNow } from './views/now-view.js';
import { renderLife } from './views/life-view.js';
import { renderLanguage } from './views/language-view.js';
import { renderScene } from './views/scene-view.js';
import { renderSettings, handleSettingsAction } from './views/settings-view.js';
import { renderShadow, disposeShadow } from './views/shadow-view.js';
import { renderTrash, handleTrashAction } from './views/trash-view.js';

/* ---- الحالة العابرة وإعادة العرض ---- */
import { ui, reloadScene, refreshStorageCard } from './ui-state.js';

/* ---- النماذج والعارض والمداخل ---- */
import { openNewSceneModal, openEditSceneModal } from './modals/scene-modals.js';
import {
  openScriptModal, openPartModal, openMistakeModal, openExpressionModal,
} from './modals/content-modals.js';
import { handleAddImages, handleAddAudio, handleRecord } from './modals/media-actions.js';
import { openLightbox } from './components/lightbox.js';
import { openLinksModal } from './modals/link-modal.js';
import {
  openShadowForScript, openShadowForConversation,
  openShadowSelection, openShadowFromImage,
} from './services/shadow/shadow-entry.js';

const main = $('#app-main');
const LAST_ROUTE_KEY = 'ui.lastRoute';

function view(renderFn, opts = {}) {
  return async (params) => {
    // مغادرة شاشة الظلّ لا بد أن توقف المحرّك، وإلا ظلّ الصوت شغّالًا
    // في الخلفية بعد الانتقال لشاشة أخرى.
    if (renderFn !== renderShadow) disposeShadow();
    // ⚠️ لا نوقف الصوت عند التنقّل. المشغّل يعيش خارج الشاشات عمدًا،
    //    فتسمع تسجيلك وأنت تقرأ سكريبت ذكرى أخرى — والشريط المصغّر
    //    يبقى ظاهرًا في كل الشاشات.

    main.innerHTML = '<div class="loading"><span class="spinner"></span> لحظة…</div>';
    try {
      await renderFn(main, params?.id, opts.passUi ? ui : undefined);
      // شاشة جديدة تبدأ من أعلاها لا من موضع تمرير سابقتها.
      window.scrollTo({ top: 0, behavior: 'instant' });
      syncNavState();
      rememberRoute();
      refreshStorageCard();
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

function rememberRoute() {
  const path = getCurrentRoute()?.path;
  if (path && path !== '/settings') settings.set(LAST_ROUTE_KEY, path).catch(() => {});
}

function syncNavState() {
  const path = getCurrentRoute()?.path || '/';
  const active =
    path === '/' ? 'now'
    : path.startsWith('/life') || path.startsWith('/scene') ? 'life'
    : path.startsWith('/language') ? 'language'
    : path.startsWith('/trash') ? 'trash'
    : path.startsWith('/settings') ? 'settings'
    : null;

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    if (btn.dataset.nav === active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  const fab = $('#fab');
  if (fab) fab.hidden = !(path === '/' || path.startsWith('/life'));
}


/* ============================================================
   تفويض الأحداث
   ============================================================ */
function wireActions() {
  delegate(document.body, 'click', '[data-action]', async (event, target) => {
    const { action, id, scene: sceneAttr, target: scrollTarget } = target.dataset;
    const sceneId = sceneAttr || id;

    switch (action) {
      /* ---- تنقّل ---- */
      case 'new-scene': return openNewSceneModal();
      case 'open-scene': return navigate(`/scene/${id}`);
      case 'go-life': return navigate('/life');
      case 'go-settings': return navigate('/settings');
      case 'back': return back();
      case 'reload': return refresh();

      case 'scroll-to': {
        document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.index-btn').forEach((b) => b.classList.remove('active'));
        target.classList.add('active');
        return;
      }

      /* ---- الظلّ ---- */
      case 'shadow-script': return openShadowForScript(id, sceneId);
      case 'open-shadow': return navigate(`/shadow/${id}`);
      case 'shadow-conversation': return openShadowForConversation(sceneId);
      case 'shadow-selection': return openShadowSelection(id, sceneId);
      case 'shadow-image': return openShadowFromImage(id, sceneId);

      /* ---- الأنواع ---- */
      case 'manage-types': {
        // اللوحة تُفتح فوق النموذج المفتوح ولا تغلقه؛ بعدها نُحدِّث
        // خيارات المنتقي في مكانه فيظهر النوع الجديد فورًا.
        const select = target.closest('.type-field')?.querySelector('select');
        const changed = await openTypeManager();
        if (changed && select) await refreshTypeSelect(select);
        return;
      }

      /* ---- المشهد ---- */
      case 'edit-scene': return openEditSceneModal(id);

      case 'toggle-fav': {
        const scene = await scenes.get(id);
        await scenes.update(id, { isFavorite: scene.isFavorite ? 0 : 1 });
        return reloadScene(id);
      }

      case 'trash-scene': {
        const scene = await scenes.get(id);
        return void actWithUndo({
          what: 'الذكرى دي',
          detail: scene?.titleAr || scene?.titleRu || '',
          remove: () => trashScene(id),
          restore: async () => {
            await restoreScene(id);
            navigate(`/scene/${id}`);
          },
          after: () => {
            if (getCurrentRoute()?.path?.startsWith('/scene/')) navigate('/life');
          },
        });
      }

      case 'export-scene': {
        const scene = await scenes.get(id);
        const text = [scene.titleAr, scene.titleRu, scene.context].filter(Boolean).join('\n');
        const ok = await copyToClipboard(text);
        return ok ? toastOk('اتنسخ') : toastError('مقدرناش ننسخ');
      }

      /* ---- الوسائط ---- */
      case 'add-images': return handleAddImages(sceneId);
      case 'add-audio': return handleAddAudio(sceneId);
      case 'open-image': return openLightbox(id, sceneId);
      case 'record-audio': return handleRecord(sceneId, target, AUDIO_ROLE.NOTE);
      case 'record-retell': return handleRecord(sceneId, target, AUDIO_ROLE.RETELLING);

      case 'play-audio': {
        const record = await media.get(id);
        if (!record?.blob) return toastError('الملف مش موجود');

        const scene = sceneId ? await scenes.get(sceneId) : null;
        await audio.load({
          mediaId: record.id,
          url: urlFor(record, { thumb: false }),
          title: record.caption || record.filename || 'تسجيل',
          subtitle: scene?.titleAr || '',
        });

        const row = target.closest('.voice-row');
        const open = row?.nextElementSibling;
        if (open?.classList.contains('aplayer')) {
          // ضغطة ثانية تطوي اللوحة — **والصوت يكمل** في الشريط
          // المصغّر. الطيّ إخفاء تحكّم لا إيقاف تشغيل.
          closeAudioPanel();
          return;
        }

        const { createAudioPlayer } = await import('./components/audio-player.js');
        const player = createAudioPlayer({
          mediaId: record.id,
          title: record.caption || record.filename || 'تسجيل',
          async onDelete() {
            let linkId = null;
            await actWithUndo({
              what: 'التسجيل ده',
              detail: record.caption || record.filename || '',
              confirmLabel: 'شيله',
              remove: async () => {
                linkId = await removeFromScene(sceneId, id);
                audio.clear();
              },
              restore: () => undoRemove(linkId),
              after: () => reloadScene(sceneId),
            });
          },
        });

        row?.insertAdjacentElement('afterend', player.element);
        player.element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }

      case 'retell': {
        navigate(`/scene/${id}`);
        setTimeout(() => {
          document.getElementById('sec-recall')?.scrollIntoView({ behavior: 'smooth' });
        }, 400);
        return;
      }

      /* ---- المحتوى ---- */
      case 'add-script': return openScriptModal(sceneId);
      case 'edit-script': return openScriptModal(sceneId, id);
      case 'add-part': return openPartModal(sceneId);
      case 'add-mistake': return openMistakeModal(sceneId);
      case 'add-expression': return openExpressionModal(sceneId);

      case 'show-script': {
        ui.activeScriptId = id;
        return reloadScene(sceneId);
      }

      case 'primary-script': {
        await setPrimaryScript(sceneId, id);
        toastOk('بقى السكريبت الأساسي');
        return reloadScene(sceneId);
      }

      case 'copy-script': {
        const script = await scripts.get(id);
        const ok = await copyToClipboard(script?.text || '');
        return ok ? toastOk('اتنسخ') : toastError('مقدرناش ننسخ');
      }

      /* ---- الحذف ----
         كلّها تمرّ بنفس البوابة: تأكيد يذكر ما ستفقده، ونقلٌ للسلة لا
         محو، وإشعار فيه «تراجع». (بند 52) */

      case 'delete-script': {
        const script = await scripts.get(id);
        return void deleteWithUndo({
          repo: scripts,
          id,
          what: 'السكريبت ده',
          detail: script?.title || scriptTypeLabel(script?.type),
          after: () => reloadScene(sceneId),
        });
      }

      case 'delete-audio': {
        const record = await media.get(id);
        // كالصورة: يُشال ربطه بالذكرى ويبقى الملف في `media` — فالتراجع
        // لا يحتاج أن يجد الـ Blob من جديد.
        let audioLinkId = null;
        return void actWithUndo({
          what: 'التسجيل ده',
          detail: record?.caption || record?.filename || '',
          remove: async () => {
            // صوتٌ يكمل بعد شيل صاحبه مربك — نوقفه أولًا.
            if (audio.state.mediaId === id) audio.stop();
            audioLinkId = await removeFromScene(sceneId, id);
          },
          restore: () => undoRemove(audioLinkId),
          after: () => reloadScene(sceneId),
        });
      }

      case 'delete-part': {
        const part = await conversationParts.get(id);
        return void deleteWithUndo({
          repo: conversationParts,
          id,
          what: 'الجزء ده',
          detail: part?.text || '',
          after: () => reloadScene(sceneId),
        });
      }

      case 'delete-mistake': {
        const mistake = await mistakeComparisons.get(id);
        return void deleteWithUndo({
          repo: mistakeComparisons,
          id,
          what: 'التصحيح ده',
          detail: mistake?.natural || mistake?.wrong || '',
          after: () => reloadScene(sceneId),
        });
      }

      case 'delete-expression': {
        const expression = await expressions.get(id);
        let undoData = null;
        return void actWithUndo({
          what: 'التعبير ده',
          detail: expression?.text || '',
          confirmLabel: 'شيله',
          remove: async () => {
            undoData = await removeExpressionFromScene(sceneId, id);
          },
          restore: () => undoRemoveExpression(id, undoData),
          after: () => reloadScene(sceneId),
        });
      }

      default: {
        if (await handleSettingsAction(action)) return;
        // `target` لازم للسلة: مفتاح الصفّ فيه اسم الـ store مع المعرّف،
        // فالمعرّف وحده لا يكفي لمعرفة أي مستودع نستعيد منه.
        if (await handleTrashAction(action, id, target)) return;
      }
    }
  });

  // حفظ الملاحظات عند مغادرة الحقل
  delegate(document.body, 'focusout', '[data-notes]', async (event, target) => {
    const sceneId = target.dataset.id;
    const block = await getBlock(sceneId, 'notes');
    if (block.text === target.value) return;
    await saveBlock(sceneId, 'notes', target.value);
    toastOk('الملاحظات اتحفظت');
  });
}

/* ============================================================
   Service Worker
   ============================================================ */
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
  if (window.location.protocol === 'file:') return;

  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');

    if (registration.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
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

/* ============================================================
   الظلّ
   ============================================================ */


/* ============================================================
   الإقلاع
   ============================================================ */
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

  requestPersistence().catch(() => {});
  // الأنواع تُحمَّل مرة هنا لتقرأها الشاشات متزامنةً.
  await primeTypes();

  // خانة استرجاع نصف مكتوبة من محاولة فاشلة سابقة تحتلّ مساحة بلا فائدة.
  // لا يلمس هذا القاعدة النشطة إطلاقًا — راجع db/db-slots.js
  cleanupStaleSlot().catch(() => {});

  route('/', view(renderNow));
  route('/life', view(renderLife));
  route('/language', view(renderLanguage));
  route('/scene/:id', view(renderScene, { passUi: true }));
  route('/settings', view(renderSettings));
  route('/shadow/:id', view(renderShadow));
  route('/trash', view(renderTrash));
  notFound(() => navigate('/', { replace: true }));

  wireActions();
  // اللوحة لا تعرف شاشات التطبيق فتُطلق حدثًا، ونحن نفتح النافذة.
  document.body.addEventListener('audio:links', (event) => {
    const sceneId = getCurrentRoute()?.params?.id || getCurrentRoute()?.path?.split('/')[2];
    openLinksModal(event.detail.mediaId, sceneId);
  });
  mountMiniPlayer();
  registerServiceWorker();

  // تحرير روابط الكائنات عند مغادرة الصفحة
  window.addEventListener('pagehide', releaseUrls);

  await startRouter();
}

boot();

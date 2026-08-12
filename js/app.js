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
import { route, notFound, startRouter, navigate, back, refresh, getCurrentRoute, canGoBack, currentQuery } from './router.js';
import { revealRow } from './components/reveal.js';
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
import { openPeopleManager } from './components/people-manager.js';
import { refreshSpeakerSelect } from './components/speaker-select.js';
import { refreshTypeSelect } from './components/type-select.js';
import { deleteWithUndo, actWithUndo } from './services/delete-service.js';
import { api as audio } from './services/audio-service.js';
import { closeAudioPanel } from './components/audio-player.js';
import { mountMiniPlayer } from './components/mini-player.js';

/* ---- الشاشات ---- */
import { renderNow } from './views/now-view.js';
import { renderLife } from './views/life-view.js';
import {
  renderLanguage, renderExpression, renderWord, handleLanguageAction,
} from './views/language-view.js';
import { renderScene } from './views/scene-view.js';
import { renderSettings, handleSettingsAction } from './views/settings-view.js';
import { renderShadow, disposeShadow } from './views/shadow-view.js';
import { renderTrash, handleTrashAction } from './views/trash-view.js';
import { renderDuplicates, handleDuplicatesAction } from './views/duplicates-view.js';
import { renderPrompts, handlePromptsAction } from './views/prompts-view.js';
import { startLayers, closeTop, hasLayer } from './components/layers.js';
import { renderThreads, renderThread } from './views/threads-view.js';
import { openThreadLinkModal, openThreadEditModal } from './modals/thread-modals.js';
import { renderSearch } from './views/search-view.js';
import {
  renderImport, resetImport, handleImportAction,
  handleImportChange, handleImportLink,
} from './views/import-view.js';
import { renderRiver, renderDay, handleRiverAction } from './views/river-view.js';
import { renderFacets } from './views/facets-view.js';
import { renderAnalysis } from './views/analysis-view.js';
import {
  renderConstellation, resetConstellation, handleConstellationAction,
} from './views/constellation-view.js';
import { renderStudio, resetStudio, wireStudio } from './views/studio-view.js';
import {
  renderDev, renderDevIssue, renderDevBrief, resetDev, wireDev,
} from './views/dev-view.js';
import { openImproveModal } from './modals/improve-modal.js';

/* ---- الحالة العابرة وإعادة العرض ---- */
import { ui, reloadScene, refreshStorageCard } from './ui-state.js';

/* ---- النماذج والعارض والمداخل ---- */
import { openNewSceneModal, openEditSceneModal } from './modals/scene-modals.js';
import {
  openScriptModal, openPartModal, openMistakeModal, openExpressionModal,
} from './modals/content-modals.js';
import { openParticipantsModal } from './modals/participant-modals.js';
import {
  openRawTranscriptModal, openCleanTranscriptModal,
} from './modals/transcript-modals.js';
import { handleAddImages, handleAddAudio, handleRecord } from './modals/media-actions.js';
import { openLightbox } from './components/lightbox.js';
import { openLinksModal } from './modals/link-modal.js';
import {
  openShadowForScript, openShadowForConversation,
  openShadowSelection, openShadowFromImage,
} from './services/shadow/shadow-entry.js';

const main = $('#app-main');
const LAST_ROUTE_KEY = 'ui.lastRoute';

/**
 * آخرُ مسارٍ رُسم — به نفرّق بين **تنقّلٍ** و**إعادة رسم**.
 *
 * ⚠️ بلاغُك بحرفه: «كل ما أضغط على مربّع علشان يتحدّد بيطلّع الصفحة
 *    لأوّلها تاني». والسبب أن كل رسمةٍ كانت تقفز للأعلى — والرسمة
 *    تحدث بعد **كل** ضغطة في المختبر والاستوديو والمكرَّر.
 *
 *    فشاشةٌ جديدة تبدأ من أعلاها، وشاشةٌ تُعاد **تبقى حيث أنت**.
 */
let lastRenderedPath = null;

function view(renderFn, opts = {}) {
  return async (params) => {
    /*
     * ⚠️ يُقاس **قبل** مسح `main`: تفريغُه يُقصّر الصفحة فيصير
     *    `scrollY` صفرًا قبل أن نقرأه.
     */
    const path = getCurrentRoute()?.path || null;
    const keepAt = path && path === lastRenderedPath ? window.scrollY : 0;
    // مغادرة شاشة الظلّ لا بد أن توقف المحرّك، وإلا ظلّ الصوت شغّالًا
    // في الخلفية بعد الانتقال لشاشة أخرى.
    if (renderFn !== renderShadow) disposeShadow();
    // ومغادرة المعاينة تُسقط الحزمة نصف المراجَعة: العودة إليها بعد
    // ساعة يجب أن تبدأ من الصفر لا من قراراتٍ نسيتَ لماذا اتّخذتَها.
    if (renderFn !== renderImport) resetImport();
    if (renderFn !== renderConstellation) resetConstellation();
    /*
     * ⚠️ ومغادرة الاستوديو تُسقط الدفعة نصف المحدَّدة — ومعها **قدرة
     *    التراجع**. وهذا حدٌّ مُعلَنٌ في الشاشة نفسها لا هنا وحده:
     *    التراجع يعيش في الذاكرة، فمغادرتُك تنهيه.
     */
    if (renderFn !== renderStudio) resetStudio();
    /* ومغادرة المختبر تُسقط فلاتره — لا تُقرأ مرشّحاتٌ نسيتَ سببها. */
    if (renderFn !== renderDev) resetDev();
    // ⚠️ لا نوقف الصوت عند التنقّل. المشغّل يعيش خارج الشاشات عمدًا،
    //    فتسمع تسجيلك وأنت تقرأ سكريبت ذكرى أخرى — والشريط المصغّر
    //    يبقى ظاهرًا في كل الشاشات.

    main.innerHTML = '<div class="loading"><span class="spinner"></span> لحظة…</div>';
    try {
      // `opts.param` لأن ليس كل مسارٍ مفتاحه `id`: «اليوم» مفتاحه تاريخ.
      await renderFn(main, params?.[opts.param || 'id'], opts.passUi ? ui : undefined);
      lastRenderedPath = getCurrentRoute()?.path || null;

      /*
       * ⚠️ **«وصّلني للسطر نفسه»** — بلاغُك. `?at=` في المسار يعني
       *    موضعًا **داخل** الشاشة لا وجهةً أخرى: ننزل إليه ونُضيئه
       *    لحظةً. ولا يُنتظَر: لو لم يوجد فالشاشة تبقى كما هي.
       */
      const at = currentQuery().at;
      if (at) revealRow(at);
      /*
       * شاشةٌ جديدة تبدأ من أعلاها، وإعادةُ رسمٍ تعود إلى موضعك.
       * والانتظارُ إطارًا لأن المتصفّح لم يُخطِّط الارتفاع الجديد بعد،
       * فالتمرير إلى موضعٍ أبعد من الارتفاع الحاليّ يُقصَّ إلى القاع.
       */
      /*
       * ⚠️ **ولا نصعد لأعلى إن كان المطلوب النزول إلى صفّ.** أوّل
       *    كتابةٍ فعلَت الاثنين، فكان `revealRow` ينزل ثم يسحبه هذا
       *    السطر إلى الأعلى — تراه يقفز ويعود. كشفَه المتصفّح.
       */
      if (at) {
        /* الصفّ يتكفّل بالموضع. */
      } else if (keepAt) {
        requestAnimationFrame(() => window.scrollTo({ top: keepAt, behavior: 'instant' }));
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
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
    : path.startsWith('/river') || path.startsWith('/day')
      || path.startsWith('/facets') || path.startsWith('/constellation') ? 'river'
    : path.startsWith('/analysis') ? 'analysis'
    : path.startsWith('/life') || path.startsWith('/scene') ? 'life'
    : path.startsWith('/language') || path.startsWith('/expression')
      || path.startsWith('/word') ? 'language'
    : path.startsWith('/search') ? 'search'
    : path.startsWith('/studio') ? 'studio'
    : path.startsWith('/dev') ? 'dev'
    : path.startsWith('/trash') ? 'trash'
    : path.startsWith('/duplicates') ? 'duplicates'
    : path.startsWith('/prompts') ? 'prompts'
    : path.startsWith('/settings') ? 'settings'
    : null;

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    if (btn.dataset.nav === active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  const fab = $('#fab');
  if (fab) fab.hidden = !(path === '/' || path.startsWith('/life'));

  /*
   * ⚠️ الرجوع يظهر حين يكون هناك ما يُرجَع إليه **داخل التطبيق**، ولا
   *    يظهر على «دلوقتي» لأنها البيت. زرٌّ يظهر دائمًا ثم لا يفعل شيئًا
   *    أسوأ من زرٍّ لا يظهر.
   */
  const backBtn = $('#app-back');
  // ومَن فوقه طبقةٌ مفتوحة يجد للرجوع ما يفعله ولو كان في البيت.
  if (backBtn) backBtn.hidden = (path === '/' || !canGoBack()) && !hasLayer();
}


/* ============================================================
   تفويض الأحداث
   ============================================================ */
function wireActions() {
  /*
   * حالة الخيط تُغيَّر من قائمةٍ منسدلة لا من زرّ، فتحتاج `change` لا
   * `click`. أضيفت هنا بدل مستمعٍ داخل الشاشة لأن الشاشة تُعاد رسمها
   * بعد كل تغيير — ومستمعٌ داخلها يموت مع رسمته.
   */
  delegate(document.body, 'change', '[data-thread-status]', async (event, target) => {
    const { updateThread } = await import('./services/thread-service.js');
    try {
      await updateThread(target.dataset.id, { status: target.value });
      toastOk('اتحفظت الحالة.');
      refresh();
    } catch (err) {
      toastError(err.message || 'مقدرناش نحفظ');
    }
  });

  /*
   * خانات المعاينة وبدائلها.
   *
   * ⚠️ هنا لا داخل الشاشة: المعاينة تُعاد رسمها بعد كل تبديل — لأن
   *    الأرقام تُحسَب من القرارات لا تُخزَّن — فمستمعٌ داخلها يموت مع
   *    أوّل ضغطة، وهي أوّل ما يجرّبه المستخدم.
   */
  delegate(document.body, 'change', '[data-imp-toggle]', (event, target) =>
    handleImportChange(target)
  );
  delegate(document.body, 'click', '[data-imp-link], [data-imp-unlink]', (event, target) =>
    handleImportLink(target)
  );

  delegate(document.body, 'click', '[data-action]', async (event, target) => {
    const { action, id, scene: sceneAttr, target: scrollTarget } = target.dataset;
    const sceneId = sceneAttr || id;

    switch (action) {
      /* ---- تنقّل ---- */
      case 'new-scene': return openNewSceneModal();
      case 'open-scene': return navigate(`/scene/${id}`);
      case 'go-life': return navigate('/life');
      case 'go-settings': return navigate('/settings');
      case 'go-threads': return navigate('/threads');
      case 'go-import': return navigate('/import');
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

      /* ---- الأشخاص ---- */
      case 'manage-people': {
        // كالأنواع: تُفتح فوق النموذج ولا تغلقه، ثم يُحدَّث المنتقي في
        // مكانه فيظهر مَن أضفتَه فورًا.
        const field = target.closest('[data-speaker-field]');
        const changed = await openPeopleManager();
        if (changed && field) await refreshSpeakerSelect(field);
        return;
      }

      /* ---- الخيوط ---- */
      case 'thread-link':
        return openThreadLinkModal(id, () => reloadScene(id));

      case 'thread-edit':
        return openThreadEditModal(id, () => refresh());

      case 'thread-remove-scene': {
        // الرابط يحيط بالزرّ: بدون هذا يتنقّل المتصفّح إلى المشهد
        // بينما نحن نزيله من الخيط.
        event.preventDefault();
        const { removeSceneFromThread } = await import('./services/thread-service.js');
        await removeSceneFromThread(target.dataset.thread, id);
        toast('اتشال من الخيط.');
        return refresh();
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

      /*
       * ⚠️ الطابور يُبنى من **الترتيب المعروض** لا من ترتيب القاعدة:
       *    تضغط «شغّلهم كلهم» فتسمعهم بنفس ترتيب ما تراه أمامك.
       */
      case 'play-all-audio': {
        const rows = [...document.querySelectorAll('#sec-voices [data-action="play-audio"]')]
          .map((btn) => btn.dataset.id);
        const records = (await media.getMany(rows)).filter((row) => row?.blob);
        if (!records.length) return toastError('مفيش تسجيلات نشغّلها');

        const scene = id ? await scenes.get(id) : null;
        await audio.loadQueue(records.map((record) => ({
          mediaId: record.id,
          url: urlFor(record, { thumb: false }),
          title: record.caption || record.filename || 'تسجيل',
          subtitle: scene?.titleAr || '',
        })));
        return;
      }

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
      case 'edit-participants': return openParticipantsModal(sceneId);
      case 'improve': return openImproveModal();
      /*
       * ⚠️ الرجوع يقفل **المفتوح** أوّلًا: نافذةٌ أو صورةٌ فوق الشاشة
       *    أولى بالإغلاق من مغادرة الشاشة نفسها.
       */
      case 'app-back': {
        if (closeTop()) return undefined;
        return back();
      }

      /* النصّ الأصلي — سابعُ حقلٍ ميّتٍ صار له شاشة *(A5)*. */
      case 'write-raw': return openRawTranscriptModal(sceneId || id);
      case 'tr-edit-clean': return openCleanTranscriptModal(sceneId || id);
      /*
       * ⚠️ **«اقرا الباقي» تفتح بتمريرٍ داخليّ ثم تطوي** — ولا تمدّ
       *    النصَّ على الصفحة. راجع `.tr-block.is-open` في components.css:
       *    لقطتُك كانت 16143 بكسل طولًا.
       */
      case 'tr-expand': {
        const block = target.closest('.tr-block');
        if (!block) return undefined;
        const opening = block.classList.contains('is-clipped');
        block.classList.toggle('is-clipped', !opening);
        block.classList.toggle('is-open', opening);
        target.textContent = opening ? 'اطوِه' : 'اقرا الباقي';
        if (!opening) block.scrollTop = 0;
        return undefined;
      }
      case 'tr-copy': {
        const text = target.closest('.sec')?.querySelector('.tr-text')?.textContent || '';
        await copyToClipboard(text);
        return toastOk('اتنسخ');
      }
      case 'tr-focus': {
        /*
         * ⚠️ وضع التركيز يقرأ ولا يكتب: هو قراءةٌ في شاشةٍ فارغة، لا
         *    محرّرٌ ثانٍ. والأصل مقفولٌ أصلًا (بند 27).
         */
        document.body.classList.add('tr-focused');
        const sec = target.closest('.sec');
        sec?.classList.add('is-focused');
        sec?.querySelector('.tr-block')?.classList.remove('is-clipped');
        const exit = document.createElement('button');
        exit.className = 'tr-exit';
        exit.textContent = 'اخرج من التركيز';
        exit.addEventListener('click', () => {
          document.body.classList.remove('tr-focused');
          sec?.classList.remove('is-focused');
          exit.remove();
        });
        sec?.append(exit);
        return undefined;
      }

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
        if (await handleDuplicatesAction(action, id, target)) return;
        if (await handlePromptsAction(action, id, target)) return;
        if (await handleImportAction(action, target)) return;
        if (await handleRiverAction(action, target)) return;
        if (await handleConstellationAction(action, target)) return;
        if (await handleLanguageAction(action, target)) return;
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
  route('/search', view(renderSearch));
  route('/trash', view(renderTrash));
  route('/duplicates', view(renderDuplicates));
  route('/prompts', view(renderPrompts));
  route('/threads', view(renderThreads));
  route('/thread/:id', view(renderThread));
  route('/import', view(renderImport));
  route('/river', view(renderRiver));
  route('/day/:date', view(renderDay, { param: 'date' }));
  route('/facets', view(renderFacets));
  route('/analysis', view(renderAnalysis));
  route('/studio', view(renderStudio));
  route('/dev', view(renderDev));
  route('/dev/issue/:id', view(renderDevIssue));
  route('/dev/brief/:id', view(renderDevBrief));
  route('/constellation', view(renderConstellation));
  route('/expression/:id', view(renderExpression));
  route('/word/:text', view(renderWord, { param: 'text' }));
  notFound(() => navigate('/', { replace: true }));

  wireActions();
  /*
   * الاستوديو يُعيد كتابة `main` كاملةً عند كل خطوة، فمستمعوه مندوبون
   * من `main` نفسه ويُركَّبون مرّةً هنا — لا مع كل رسم.
   */
  wireStudio(main, () => renderStudio(main));
  /*
   * المختبر ثلاث شاشات تتشارك مستمعًا واحدًا — وإعادةُ الرسم تختار
   * الشاشة من المسار، فزرٌّ في التفصيل يُحدِّث التفصيل لا اللوحة.
   */
  wireDev(main, () => {
    const path = getCurrentRoute()?.path || '/dev';
    if (path.startsWith('/dev/issue/')) return renderDevIssue(main, path.split('/').pop());
    if (path.startsWith('/dev/brief/')) return renderDevBrief(main, path.split('/').pop());
    return renderDev(main);
  });
  // اللوحة لا تعرف شاشات التطبيق فتُطلق حدثًا، ونحن نفتح النافذة.
  document.body.addEventListener('audio:links', (event) => {
    const sceneId = getCurrentRoute()?.params?.id || getCurrentRoute()?.path?.split('/')[2];
    openLinksModal(event.detail.mediaId, sceneId);
  });
  mountMiniPlayer();
  registerServiceWorker();

  // تحرير روابط الكائنات عند مغادرة الصفحة
  window.addEventListener('pagehide', releaseUrls);

  /*
   * ⚠️ **قبل الموجِّه**: مستمعُ `popstate` للطبقات يجب أن يُركَّب قبل
   *    أي رسم، وإلا مرّت أوّلُ ضغطة رجوعٍ بلا حارس.
   */
  startLayers();
  await startRouter();
}

boot();

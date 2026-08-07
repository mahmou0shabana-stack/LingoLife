/**
 * LingoLife — نقطة الدخول
 *
 * الإقلاع: فتح القاعدة → التخزين الدائم → Service Worker → الموجّه.
 * كل الأحداث تمرّ من مستمع واحد على body (الشاشات تُعاد كتابتها بالكامل).
 */

import { openDB } from './db/database.js';
import { cleanupStaleSlot } from './services/backup/restore.js';
import { route, notFound, startRouter, navigate, back, refresh, getCurrentRoute } from './router.js';
import { requestPersistence, estimateStorage, storageLevel } from './services/storage-service.js';
import { createScene, trashScene, restoreScene } from './services/scene-service.js';
import { scenes, media, scripts, contentBlocks, sceneMediaLinks } from './db/repositories.js';
import {
  addFilesToScene, pickFiles, setCover, removeFromScene, undoRemove,
  urlFor, releaseUrls, startRecording, canRecord, AUDIO_ROLE,
} from './services/media-service.js';
import {
  addScript, updateScript, setPrimaryScript, SCRIPT_TYPES,
  addConversationPart, addMistake, MISTAKE_TYPES,
  addExpression, REGISTERS, saveBlock, getBlock, listConversationParts,
} from './services/content-service.js';
import { splitSentences } from './services/shadow/segmenter.js';
import { settings } from './db/repositories.js';
import { today } from './utils/dates.js';
import { html, raw, $, delegate, formatBytes, copyToClipboard } from './utils/dom.js';
import { SCENE_TYPES } from './config.js';
import { icon } from './components/icons.js';
import { toast, toastOk, toastError } from './components/toast.js';
import { showModal, confirmAction } from './components/modal.js';
import { api as audio } from './services/audio-service.js';
import { closeAudioPanel } from './components/audio-player.js';
import { mountMiniPlayer } from './components/mini-player.js';
import { LINK, AUDIO_TAGS, link, unlink, resolveLinks, setTags } from './services/link-service.js';

import { renderNow } from './views/now-view.js';
import { renderLife } from './views/life-view.js';
import { renderLanguage } from './views/language-view.js';
import { renderScene } from './views/scene-view.js';
import { renderSettings, handleSettingsAction } from './views/settings-view.js';
import { renderShadow, disposeShadow } from './views/shadow-view.js';
import { createSession, sessionsForSource, SOURCE_TYPE } from './services/shadow/shadow-session-service.js';
import { renderTrash, handleTrashAction } from './views/trash-view.js';

const main = $('#app-main');
const LAST_ROUTE_KEY = 'ui.lastRoute';

/** حالة عابرة للشاشة الحالية (أي سكريبت معروض مثلًا). */
const ui = { activeScriptId: null };

/* ============================================================
   عرض الشاشات
   ============================================================ */

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

function rememberRoute() {
  const path = getCurrentRoute()?.path;
  if (path && path !== '/settings') settings.set(LAST_ROUTE_KEY, path).catch(() => {});
}

/** بطاقة التخزين في الشريط الجانبي — أرقام حقيقية. */
async function refreshStorageCard() {
  const card = $('#storage-card');
  if (!card) return;
  try {
    const { usage, quota, percent } = await estimateStorage();
    const bar = card.querySelector('.meter');
    const text = card.querySelector('[data-storage-text]');
    if (percent !== null) {
      bar.className = `meter ${storageLevel(percent) === 'ok' ? '' : storageLevel(percent)}`;
      bar.firstElementChild.style.width = `${Math.max(percent, 1)}%`;
      text.innerHTML = `<bdi>${formatBytes(usage)}</bdi> من <bdi>${formatBytes(quota)}</bdi>`;
    } else {
      text.textContent = 'غير متاح';
    }
  } catch {
    /* غير حرج */
  }
}

/** يعيد عرض المشهد الحالي بعد تعديل. */
async function reloadScene(sceneId) {
  const path = getCurrentRoute()?.path || '';
  if (path.startsWith('/scene/')) {
    await renderScene(main, sceneId, ui);
    refreshStorageCard();
  } else {
    navigate(`/scene/${sceneId}`);
  }
}

/* ============================================================
   نماذج الإضافة
   ============================================================ */

function selectOptions(items, selected) {
  return items
    .map((t) => `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${t.label}</option>`)
    .join('');
}

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
          <select id="f-type" name="type">${raw(selectOptions(SCENE_TYPES))}</select>
        </div>
      </div>
      <div class="field">
        <label for="f-place">المكان</label>
        <input id="f-place" name="placeName" type="text" placeholder="المصنع — موسكو" />
      </div>
      <div class="field">
        <label for="f-context">سياق قصير</label>
        <textarea id="f-context" name="context" placeholder="إيه اللي حصل في اللحظة دي؟"></textarea>
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

async function openEditSceneModal(sceneId) {
  const scene = await scenes.get(sceneId);
  if (!scene) return;

  await showModal({
    title: 'تعديل بيانات الذكرى',
    body: html`
      <div class="field">
        <label for="e-titleAr">العنوان بالعربي</label>
        <input id="e-titleAr" name="titleAr" type="text" value="${scene.titleAr || ''}" />
      </div>
      <div class="field">
        <label for="e-titleRu">العنوان بالروسي</label>
        <input id="e-titleRu" name="titleRu" type="text" dir="ltr" lang="ru" value="${scene.titleRu || ''}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="e-date">التاريخ</label>
          <input id="e-date" name="date" type="date" value="${scene.date || today()}" />
        </div>
        <div class="field">
          <label for="e-type">النوع</label>
          <select id="e-type" name="type">${raw(selectOptions(SCENE_TYPES, scene.type))}</select>
        </div>
      </div>
      <div class="field">
        <label for="e-place">المكان</label>
        <input id="e-place" name="placeName" type="text" value="${scene.placeName || ''}" />
      </div>
      <div class="field">
        <label for="e-context">سياق قصير</label>
        <textarea id="e-context" name="context">${scene.context || ''}</textarea>
      </div>`,

    async onSubmit(data, close) {
      await scenes.update(sceneId, data);
      close();
      toastOk('اتحفظ');
      reloadScene(sceneId);
    },
  });
}

async function openScriptModal(sceneId, scriptId = null) {
  const existing = scriptId ? await scripts.get(scriptId) : null;

  await showModal({
    title: existing ? 'تعديل السكريبت' : 'سكريبت جديد',
    body: html`
      <div class="field-row">
        <div class="field">
          <label for="s-title">الاسم</label>
          <input id="s-title" name="title" type="text" value="${existing?.title || ''}"
            placeholder="السكريبت الأساسي" />
        </div>
        <div class="field">
          <label for="s-type">النوع</label>
          <select id="s-type" name="type">${raw(selectOptions(SCRIPT_TYPES, existing?.type))}</select>
        </div>
      </div>
      <div class="field">
        <label for="s-text">النص بالروسي</label>
        <textarea id="s-text" name="text" dir="ltr" lang="ru" style="min-height:180px"
          placeholder="Сегодня мы обсуждали…">${existing?.text || ''}</textarea>
      </div>`,

    async onSubmit(data, close) {
      if (existing) {
        await updateScript(scriptId, data);
      } else {
        const created = await addScript(sceneId, data);
        ui.activeScriptId = created.id;
      }
      close();
      toastOk(existing ? 'اتحفظ — واتسجّلت نسخة في التاريخ' : 'السكريبت اتضاف');
      reloadScene(sceneId);
    },
  });
}

async function openPartModal(sceneId) {
  await showModal({
    title: 'جزء من المحادثة',
    submitLabel: 'أضف',
    body: html`
      <div class="field-row">
        <div class="field">
          <label for="p-speaker">المتحدث</label>
          <input id="p-speaker" name="speaker" type="text" placeholder="Алексей" />
        </div>
        <div class="field">
          <label for="p-mine">مين بيتكلم</label>
          <select id="p-mine" name="isMine">
            <option value="">شخص تاني</option>
            <option value="1">أنا</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="p-text">الكلام بالروسي</label>
        <textarea id="p-text" name="text" dir="ltr" lang="ru"
          placeholder="Сейчас одно несоответствие ещё согласовывается."></textarea>
      </div>
      <div class="field">
        <label for="p-tr">الترجمة (اختياري)</label>
        <input id="p-tr" name="translation" type="text" placeholder="دلوقتي في عدم مطابقة واحد لسه بيتوافق عليه" />
      </div>`,

    async onSubmit(data, close) {
      if (!data.text?.trim()) {
        toastError('الكلام مطلوب');
        throw new Error('فارغ');
      }
      await addConversationPart(sceneId, data);
      close();
      toastOk('الجزء اتضاف');
      reloadScene(sceneId);
    },
  });
}

async function openMistakeModal(sceneId) {
  await showModal({
    title: 'تصحيح — خطأ / طبيعي',
    submitLabel: 'أضف',
    body: html`
      <div class="field">
        <label for="m-wrong">اللي قلته</label>
        <textarea id="m-wrong" name="wrong" dir="ltr" lang="ru"
          placeholder="Сейчас один несоответствие согласовывается."></textarea>
      </div>
      <div class="field">
        <label for="m-nat">اللي المفروض يتقال</label>
        <textarea id="m-nat" name="natural" dir="ltr" lang="ru"
          placeholder="Сейчас одно несоответствие ещё согласовывается."></textarea>
      </div>
      <div class="field">
        <label for="m-type">نوع الخطأ</label>
        <select id="m-type" name="mistakeType">${raw(selectOptions(MISTAKE_TYPES, 'gender'))}</select>
      </div>
      <div class="field">
        <label for="m-exp">الشرح بالمصري</label>
        <textarea id="m-exp" name="explanation"
          placeholder="несоответствие كلمة محايدة، فبنقول одно مش один."></textarea>
      </div>`,

    async onSubmit(data, close) {
      if (!data.wrong?.trim() || !data.natural?.trim()) {
        toastError('لازم تكتب النسختين');
        throw new Error('ناقص');
      }
      await addMistake(sceneId, data);
      close();
      toastOk('التصحيح اتضاف');
      reloadScene(sceneId);
    },
  });
}

async function openExpressionModal(sceneId) {
  await showModal({
    title: 'تعبير جديد',
    submitLabel: 'أضف',
    body: html`
      <div class="field">
        <label for="x-text">التعبير بالروسي</label>
        <input id="x-text" name="text" type="text" dir="ltr" lang="ru"
          placeholder="направить на согласование" />
      </div>
      <div class="field">
        <label for="x-mean">معناه بالمصري</label>
        <input id="x-mean" name="meaningAr" type="text" placeholder="يبعت للموافقة" />
      </div>
      <div class="field">
        <label for="x-reg">التصنيف</label>
        <select id="x-reg" name="register">${raw(selectOptions(REGISTERS, 'professional'))}</select>
      </div>
      <div class="field">
        <label for="x-note">ملاحظة (اختياري)</label>
        <textarea id="x-note" name="note" placeholder="بيتقال في الشغل الرسمي"></textarea>
      </div>`,

    async onSubmit(data, close) {
      if (!data.text?.trim()) {
        toastError('نص التعبير مطلوب');
        throw new Error('فارغ');
      }
      const { isNew } = await addExpression(sceneId, data);
      close();
      toastOk(isNew ? 'التعبير اتضاف' : 'التعبير موجود — سجّلنا ظهوره في الذكرى دي');
      reloadScene(sceneId);
    },
  });
}

/* ============================================================
   الوسائط
   ============================================================ */

async function handleAddImages(sceneId) {
  const files = await pickFiles({ accept: 'image/*', multiple: true });
  if (!files.length) return;

  const dismiss = toast(`بيتحفظ ${files.length} ملف…`, { duration: 60000 });
  const result = await addFilesToScene(sceneId, files, { kind: 'image' });
  dismiss();

  if (result.added) toastOk(`اتضاف ${result.added} صورة بحجمها الأصلي`);
  if (result.failed) toastError(`${result.failed} ملف فشل`);
  reloadScene(sceneId);
}

async function handleAddAudio(sceneId) {
  const files = await pickFiles({ accept: 'audio/*', multiple: true });
  if (!files.length) return;

  const dismiss = toast('بيتحفظ…', { duration: 60000 });
  const result = await addFilesToScene(sceneId, files, { kind: 'audio', role: AUDIO_ROLE.ORIGINAL });
  dismiss();

  if (result.added) toastOk(`اتضاف ${result.added} ملف صوت`);
  if (result.failed) toastError(`${result.failed} ملف فشل`);
  reloadScene(sceneId);
}

/** التسجيل الجاري — لو موجود، الضغطة التانية بتوقّفه. */
let activeRecording = null;

async function handleRecord(sceneId, buttonEl, role = AUDIO_ROLE.RETELLING) {
  if (activeRecording) {
    const { session, timer, btn } = activeRecording;
    clearInterval(timer);
    btn?.classList.remove('recording');
    activeRecording = null;

    const file = await session.stop();
    const result = await addFilesToScene(sceneId, [file], { kind: 'audio', role });
    if (result.added) toastOk('التسجيل اتحفظ');
    else toastError('فشل حفظ التسجيل');
    reloadScene(sceneId);
    return;
  }

  if (!canRecord()) {
    toastError('المتصفح ده مش بيدعم التسجيل الصوتي');
    return;
  }

  try {
    const session = await startRecording();
    buttonEl?.classList.add('recording');

    const timeEl = document.querySelector('[data-rec-time]');
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      if (timeEl) {
        timeEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }
    }, 250);

    activeRecording = { session, timer, btn: buttonEl };
    toast('بيسجّل… اضغط تاني علشان توقف');
  } catch (err) {
    console.error(err);
    toastError('مقدرناش نوصل للميكروفون — اسمح بالإذن وجرّب تاني');
  }
}

/** عارض الصورة — مع تعيين غلاف وتنزيل الأصل وإزالة. */
async function openLightbox(mediaId, sceneId) {
  const record = await media.get(mediaId);
  if (!record) return;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = html`
    <button class="lightbox-close" aria-label="إغلاق">✕</button>
    <img src="${urlFor(record, { thumb: false })}" alt="${record.caption || ''}">
    <div class="lightbox-bar">
      <button data-lb="cover">اجعلها الغلاف</button>
      <button data-lb="links">اربطها بصوت أو نصّ</button>
      <button data-lb="shadow">استخرج النصّ واتدرّب</button>
      <button data-lb="download">نزّل الأصل</button>
      <button data-lb="remove" class="danger">شيلها من الذكرى</button>
    </div>
    <div class="lightbox-links" data-lb-links></div>`;

  // نعرض ما هو مرتبط بها فعلًا — لا يحتاج المستخدم أن يتذكّر.
  resolveLinks(mediaId)
    .then((links) => {
      const host = box.querySelector('[data-lb-links]');
      if (!host || !links.length) return;
      host.innerHTML = links
        .map((l) => {
          const label = l.entity.kind === 'audio'
            ? `🎙 ${l.entity.caption || l.entity.filename}`
            : `📄 ${(l.entity.text || '').slice(0, 40) || 'سكريبت'}`;
          return `<span class="link-badge">${label}</span>`;
        })
        .join('');
    })
    .catch(() => {});

  const close = () => {
    box.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  box.addEventListener('click', async (e) => {
    if (e.target === box || e.target.closest('.lightbox-close')) return close();

    const action = e.target.closest('[data-lb]')?.dataset.lb;
    if (!action) return;

    if (action === 'cover') {
      await setCover(sceneId, mediaId);
      close();
      toastOk('بقت الغلاف');
      reloadScene(sceneId);
    }

    if (action === 'links') {
      close();
      openLinksModal(mediaId, sceneId);
    }

    if (action === 'shadow') {
      close();
      openShadowFromImage(mediaId, sceneId);
    }

    if (action === 'download') {
      const { downloadBlob } = await import('./utils/dom.js');
      // الأصل كما رُفع — بايت ببايت
      downloadBlob(record.blob, record.filename || `${record.id}.jpg`);
    }

    if (action === 'remove') {
      const linkId = await removeFromScene(sceneId, mediaId);
      close();
      toast('اتشالت من الذكرى', {
        actionLabel: 'تراجع',
        onAction: async () => {
          await undoRemove(linkId);
          toastOk('رجعت');
          reloadScene(sceneId);
        },
      });
      reloadScene(sceneId);
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.append(box);
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

      /* ---- المشهد ---- */
      case 'edit-scene': return openEditSceneModal(id);

      case 'toggle-fav': {
        const scene = await scenes.get(id);
        await scenes.update(id, { isFavorite: scene.isFavorite ? 0 : 1 });
        return reloadScene(id);
      }

      case 'trash-scene': {
        await trashScene(id);
        toast('اتنقلت لسلة المهملات', {
          actionLabel: 'تراجع',
          onAction: async () => {
            await restoreScene(id);
            toastOk('رجعت تاني');
            navigate(`/scene/${id}`);
          },
        });
        return navigate('/life');
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
            const ok = await confirmAction({
              title: 'حذف التسجيل',
              message: `هيتشال «${record.caption || record.filename}» من الذكرى. تقدر تتراجع من الـ toast.`,
              confirmLabel: 'شيله',
              danger: true,
            });
            if (!ok) return;
            const linkId = await removeFromScene(sceneId, id);
            audio.clear();
            toast('اتشال التسجيل', {
              actionLabel: 'تراجع',
              onAction: async () => {
                await undoRemove(linkId);
                toastOk('رجع');
                reloadScene(sceneId);
              },
            });
            reloadScene(sceneId);
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

      default: {
        if (await handleSettingsAction(action)) return;
        if (await handleTrashAction(action, id)) return;
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

/**
 * يفتح الظلّ على سكريبت — **بلا نسخ ولصق**.
 *
 * لو فيه جلسة سابقة على نفس السكريبت نستأنفها بدل إنشاء واحدة
 * جديدة: تكراراتك السابقة وموضعك جزء من عملك، لا شيء يُرمى.
 */
async function openShadowForScript(scriptId, sceneId) {
  const script = await scripts.get(scriptId);
  if (!script?.text?.trim()) {
    return toastError('السكريبت ده فاضي — مفيش حاجة نتدرّب عليها');
  }

  const existing = await sessionsForSource(SOURCE_TYPE.SCRIPT, scriptId);
  if (existing.length) {
    const resume = existing.sort(
      (a, b) => (b.lastPracticedAt || b.createdAt) - (a.lastPracticedAt || a.createdAt)
    )[0];
    return navigate(`/shadow/${resume.id}`);
  }

  const scene = sceneId ? await scenes.get(sceneId) : null;

  try {
    const { session, segments } = await createSession({
      title: scene?.titleAr || script.title || 'تدريب بالظلّ',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: scriptId,
      sourceVersion: script.rev ?? null,
      sceneId: sceneId || script.sceneId || null,
      text: script.text,
    });
    toastOk(`${segments.length} جملة جاهزة للتدريب`);
    navigate(`/shadow/${session.id}`);
  } catch (error) {
    console.error(error);
    toastError(error.message);
  }
}

/**
 * محادثة ← ظلّ.
 *
 * الأجزاء مقاطع جاهزة بترتيبها — لا نمرّ على مُقسِّم الجمل، لأن
 * تقسيم المحادثة موجود أصلًا: كل جزء جملة متحدّث.
 */
async function openShadowForConversation(sceneId) {
  const parts = (await listConversationParts(sceneId)).filter((p) => p.text?.trim());
  if (!parts.length) return toastError('مفيش أجزاء محادثة في الذكرى دي');

  const speakers = [...new Set(parts.map((p) => p.speaker || 'المتحدث'))];

  // ⚠️ القيم تُقرأ داخل onSubmit لا بعد إغلاق النافذة: النافذة تُزال من
  //    الـ DOM عند الإغلاق، فقراءة الحقول بعدها تعيد فراغًا دائمًا.
  let form = null;
  await showModal({
    title: 'تدرّب على المحادثة',
    submitLabel: 'ابدأ',
    body: html`
      <p class="text-soft text-sm" style="line-height:1.9">
        ${parts.length} جزء من ${speakers.length} متحدّث.
      </p>
      <div class="field">
        <label for="c-speaker">تتدرّب على مين؟</label>
        <select id="c-speaker" name="speaker">
          <option value="">المحادثة كلها</option>
          ${raw(speakers.map((sp) => `<option value="${sp}">${sp} فقط</option>`).join(''))}
        </select>
      </div>`,
    onSubmit(data, close) {
      form = data;
      close();
    },
  });
  if (!form) return;

  const speaker = form.speaker || '';
  const chosen = speaker ? parts.filter((p) => (p.speaker || 'المتحدث') === speaker) : parts;
  if (!chosen.length) return toastError('مفيش أجزاء للمتحدّث ده');

  const scene = await scenes.get(sceneId);

  const { session, segments } = await createSession({
    title: `${scene?.titleAr || 'محادثة'}${speaker ? ` — ${speaker}` : ''}`,
    sourceType: SOURCE_TYPE.CONVERSATION,
    sourceId: chosen[0].conversationId,
    sceneId,
    segments: chosen.map((part) => ({
      text: part.text,
      translation: part.translation || null,
      sourceObjectId: part.id,
      speaker: part.speaker || null,
      isMine: Boolean(part.isMine),
    })),
  });

  toastOk(`${segments.length} جزء جاهز للتدريب`);
  navigate(`/shadow/${session.id}`);
}

/**
 * تحديد جمل ← ظلّ.
 *
 * الجلسة تحمل الجمل المختارة وحدها. تظلّ مرتبطة بالسكريبت الأصلي
 * فيبقى كشف تغيّر المصدر عاملًا.
 */
async function openShadowSelection(scriptId, sceneId) {
  const script = await scripts.get(scriptId);
  if (!script?.text?.trim()) return toastError('السكريبت فاضي');

  const sentences = splitSentences(script.text);
  if (!sentences.length) return toastError('مفيش جمل صالحة');

  let form = null;
  await showModal({
    title: 'اختار الجمل',
    submitLabel: 'ابدأ بالمحدّد',
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        علّم اللي عايز تتدرّب عليه بس.
      </p>
      ${raw(
        sentences
          .map(
            (text, i) => html`
              <label class="pick-row">
                <input type="checkbox" name="s${i}" value="${i}" checked />
                <span dir="ltr">${text}</span>
              </label>`
          )
          .join('')
      )}`,
    // FormData لا تحمل إلا المربّعات المؤشَّرة، فالمفاتيح الموجودة هي
    // المختارة بالضبط.
    onSubmit(data, close) {
      form = data;
      close();
    },
  });
  if (!form) return;

  const picked = Object.values(form)
    .map((value) => sentences[Number(value)])
    .filter(Boolean);
  if (!picked.length) return toastError('ماخترتش أي جملة');

  const scene = sceneId ? await scenes.get(sceneId) : null;

  const { session } = await createSession({
    title: `${scene?.titleAr || 'مختارات'} — ${picked.length} جملة`,
    sourceType: SOURCE_TYPE.SELECTION,
    sourceId: scriptId,
    sourceVersion: script.rev ?? null,
    sceneId: sceneId || script.sceneId || null,
    segments: picked.map((text) => ({ text })),
  });

  toastOk(`${picked.length} جملة جاهزة`);
  navigate(`/shadow/${session.id}`);
}

/**
 * صورة ← ظلّ.
 *
 * ⚠️ **الصورة لا تُمسّ إطلاقًا.** النصّ المستخرَج يُحفظ كمحتوى مشتقّ
 *    مرتبط بها، والأصل يبقى ببايتاته كما رُفع.
 *
 * ولأن OCR على خطّ يد روسي يخطئ كثيرًا، تمرّ النتيجة على **مراجعة
 * قابلة للتعديل** قبل بناء الجلسة. لا نبني تدريبًا على نصّ لم تره.
 */
async function openShadowFromImage(mediaId, sceneId) {
  const record = await media.get(mediaId);
  if (!record?.blob) return toastError('الصورة دي مش موجودة');

  const { extractText, isAvailableOffline } = await import('./services/shadow/ocr.js');
  const offline = await isAvailableOffline();

  if (!offline && !navigator.onLine) {
    return toastError('استخراج النصّ محتاج إنترنت — أو ضمّ نسخة محلّية بـ scripts/vendor-tesseract.sh');
  }

  const dismiss = toast(offline ? 'بنقرا الصورة…' : 'بنحمّل محرّك القراءة… أول مرة بتاخد وقت', {
    duration: 10 * 60 * 1000,
  });

  let extracted = '';
  try {
    const result = await extractText(record.blob, {
      onProgress: ({ status, progress }) => {
        console.info(`[ocr] ${status} ${Math.round(progress * 100)}%`);
      },
    });
    extracted = result.text;
  } catch (error) {
    dismiss();
    console.error(error);
    return toastError(`تعذّر استخراج النصّ: ${error.message}`);
  }
  dismiss();

  if (!extracted.trim()) return toastError('مالقيتش نصّ في الصورة دي');

  let form = null;
  await showModal({
    title: 'راجع النصّ قبل ما نبدأ',
    submitLabel: 'ابدأ التدريب',
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        القراءة الآلية بتغلط في الخطّ اليدوي. صحّح اللي محتاج تصحيح —
        <strong>الصورة نفسها مش هتتغيّر</strong>.
      </p>
      <div class="field">
        <textarea name="text" dir="ltr" lang="ru" rows="9"
          style="font-size:15px;line-height:1.9">${extracted}</textarea>
      </div>`,
    onSubmit(data, close) {
      form = data;
      close();
    },
  });
  if (!form) return;

  const reviewed = (form.text || '').trim() || extracted;
  const scene = sceneId ? await scenes.get(sceneId) : null;

  try {
    const { session, segments } = await createSession({
      title: `${scene?.titleAr || 'صورة'} — نصّ مستخرَج`,
      sourceType: SOURCE_TYPE.MEDIA_TEXT,
      sourceId: mediaId,
      sceneId,
      text: reviewed,
    });
    toastOk(`${segments.length} جملة جاهزة`);
    navigate(`/shadow/${session.id}`);
  } catch (error) {
    toastError(error.message);
  }
}

/**
 * ربط وسيط بالنصوص وبالوسائط الأخرى، وتصنيفه.
 *
 * الذكرى ليست أكوامًا منفصلة: **هذه الصورة** لها **هذا السكريبت**
 * و**هذا التسجيل**. بدون ربط صريح تبقى المطابقة في رأسك وحدك.
 */
async function openLinksModal(mediaId, sceneId) {
  const record = await media.get(mediaId);
  if (!record) return;

  const isAudio = record.kind === 'audio';
  const [sceneScripts, sceneMedia, existing] = await Promise.all([
    scripts.byIndex('sceneId', sceneId),
    (async () => {
      const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
      const rows = await Promise.all(links.map((l) => media.get(l.mediaId)));
      return rows.filter((m) => m && m.id !== mediaId);
    })(),
    resolveLinks(mediaId),
  ]);

  const linkedIds = new Set(existing.map((e) => e.entity.id));
  const tags = record.tags || [];

  // الصوت يُربط بالصور، والصورة تُربط بالأصوات — الطرف المقابل دائمًا.
  const others = sceneMedia.filter((m) => (isAudio ? m.kind === 'image' : m.kind === 'audio'));
  const pairKind = isAudio ? LINK.AUDIO_IMAGE : LINK.IMAGE_SCRIPT;
  const scriptKind = isAudio ? LINK.AUDIO_SCRIPT : LINK.IMAGE_SCRIPT;

  let form = null;
  await showModal({
    title: isAudio ? 'اربط التسجيل وصنّفه' : 'اربط الصورة',
    submitLabel: 'احفظ',
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        ${record.caption || record.filename}
      </p>

      ${raw(
        isAudio
          ? html`<div class="field">
              <label>التصنيف</label>
              <div class="tag-pick">
                ${raw(
                  AUDIO_TAGS.map(
                    (tag) => html`<label class="tag-chip${tags.includes(tag) ? ' on' : ''}">
                      <input type="checkbox" name="tag:${tag}" ${tags.includes(tag) ? 'checked' : ''} />
                      <span>${tag}</span>
                    </label>`
                  ).join('')
                )}
              </div>
            </div>`
          : ''
      )}

      ${raw(
        sceneScripts.length
          ? html`<div class="field">
              <label>${isAudio ? 'بينطق أنهي سكريبت؟' : 'أنهي سكريبت بيشرحها؟'}</label>
              ${raw(
                sceneScripts
                  .map(
                    (sc) => html`<label class="pick-row">
                      <input type="checkbox" name="script:${sc.id}" ${linkedIds.has(sc.id) ? 'checked' : ''} />
                      <span dir="ltr">${(sc.text || '').slice(0, 90) || sc.title || 'سكريبت'}</span>
                    </label>`
                  )
                  .join('')
              )}
            </div>`
          : html`<p class="field-hint">مفيش سكريبتات في الذكرى دي لسه.</p>`
      )}

      ${raw(
        others.length
          ? html`<div class="field">
              <label>${isAudio ? 'التسجيل ده بتاع أنهي صورة؟' : 'أنهي تسجيل صوت الصورة دي؟'}</label>
              ${raw(
                others
                  .map(
                    (m) => html`<label class="pick-row">
                      <input type="checkbox" name="media:${m.id}" ${linkedIds.has(m.id) ? 'checked' : ''} />
                      <span>${m.caption || m.filename}</span>
                    </label>`
                  )
                  .join('')
              )}
            </div>`
          : ''
      )}`,
    onSubmit(data, close) {
      form = data;
      close();
    },
  });

  if (!form) return;

  const keys = Object.keys(form);
  const picked = (prefix) =>
    new Set(keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)));

  const wantScripts = picked('script:');
  const wantMedia = picked('media:');

  // نُطبّق الفرق فقط: نربط الجديد ونفكّ ما أُزيل.
  await Promise.all([
    ...[...wantScripts].map((id) => link(mediaId, id, scriptKind)),
    ...[...wantMedia].map((id) => link(mediaId, id, pairKind)),
    ...existing
      .filter((e) => !wantScripts.has(e.entity.id) && !wantMedia.has(e.entity.id))
      .map((e) => unlink(mediaId, e.entity.id, e.kind)),
  ]);

  if (isAudio) {
    await setTags(mediaId, [...picked('tag:')]);
  }

  toastOk('اتحفظت الروابط');
  reloadScene(sceneId);
}

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

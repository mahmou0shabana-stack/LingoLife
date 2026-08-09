/**
 * LingoLife — لوحة الذكرى (Scene Journal Board)
 *
 * صفحة واحدة طويلة، كل الأقسام حاضرة في أماكنها من أول لحظة (بند 10).
 * القسم الفاضي يظهر كخانة جاهزة للإضافة — لا اعتذار ولا "قريبًا".
 */

import { getSceneFull } from '../services/scene-service.js';
import { listConversationParts, listSceneExpressions, getBlock, scriptTypeLabel, registerLabel, registerClass } from '../services/content-service.js';
import { urlFor, releaseUrls, AUDIO_ROLE_LABEL } from '../services/media-service.js';
import { html, raw, esc, formatDuration } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';
import { typeLabel } from '../services/type-service.js';
import { threadsOfScene } from '../services/thread-service.js';
import { icon } from '../components/icons.js';

/** أقسام اللوحة — العدد يظهر في الفهرس المصغّر. */
const SECTIONS = [
  { id: 'moment', label: 'اللحظة' },
  { id: 'images', label: 'الصور', count: 'images' },
  { id: 'voices', label: 'الأصوات', count: 'audio' },
  { id: 'scripts', label: 'السكريبتات', count: 'scripts' },
  { id: 'conversation', label: 'المحادثة', count: 'parts' },
  { id: 'mistakes', label: 'خطأ / طبيعي', count: 'mistakes' },
  { id: 'language', label: 'اللغة', count: 'expressions' },
  { id: 'recall', label: 'احكيها' },
  { id: 'notes', label: 'ملاحظاتي' },
];

/** خانة فاضية موحّدة الشكل. */
function slot(action, id, iconName, title, hint) {
  return html`
    <button class="slot-empty" data-action="${action}" data-id="${id}">
      <span class="ic">${raw(icon(iconName))}</span>
      <span class="t">${title}</span>
      <span class="h">${hint}</span>
    </button>`;
}

/** ترويسة قسم مع زر إضافة. */
function head(iconName, title, count, action, sceneId, addLabel) {
  return html`
    <div class="sec-head">
      <h2>${raw(icon(iconName))} ${title}${raw(count ? html` <span class="count">${count}</span>` : '')}</h2>
      ${raw(
        action
          ? html`<button class="add" data-action="${action}" data-id="${sceneId}">
              ${raw(icon('plus'))} ${addLabel || 'إضافة'}
            </button>`
          : ''
      )}
    </div>`;
}

/** موجة صوتية زخرفية — تمثيل بصري، لا تحليل للصوت. */
function wave(seed = 1) {
  const bars = Array.from({ length: 22 }, (_, i) => {
    const h = 20 + Math.abs(Math.sin((i + seed) * 1.7)) * 80;
    return `<i style="height:${h}%"></i>`;
  }).join('');
  return `<span class="wave" aria-hidden="true">${bars}</span>`;
}

/* ============================================================
   الأقسام
   ============================================================ */

function sectionImages(scene, images, coverId) {
  const shown = images.slice(0, 6);
  const extra = images.length - shown.length;

  let body;
  if (!images.length) {
    // شبكة شبح تحجز الشكل النهائي حتى وهي فاضية
    body = html`
      <div class="mosaic">
        <button class="tile-add" data-action="add-images" data-id="${scene.id}"
          style="grid-column:span 2;grid-row:span 2;aspect-ratio:auto">
          ${raw(icon('plus'))}
          <span>أضف صور</span>
        </button>
        <div class="tile-ghost"></div>
        <div class="tile-ghost"></div>
        <div class="tile-ghost"></div>
        <div class="tile-ghost"></div>
      </div>`;
  } else {
    body = html`
      <div class="mosaic">
        ${raw(
          shown
            .map((m, i) => {
              const isLast = i === shown.length - 1 && extra > 0;
              return html`
                <button class="tile" data-action="open-image" data-id="${m.id}" data-scene="${scene.id}">
                  <img src="${urlFor(m)}" alt="${m.caption || 'صورة من الذكرى'}" loading="lazy">
                  ${raw(m.id === coverId ? '<span class="badge-cover">الغلاف</span>' : '')}
                  ${raw(isLast ? html`<span class="more-count">+${extra}</span>` : '')}
                </button>`;
            })
            .join('')
        )}
        <button class="tile-add" data-action="add-images" data-id="${scene.id}">
          ${raw(icon('plus'))}
          <span>إضافة</span>
        </button>
      </div>`;
  }

  return html`
    <section class="sec" id="sec-images">
      ${raw(head('image', 'الصور', images.length || '', 'add-images', scene.id, 'أضف'))}
      ${raw(body)}
    </section>`;
}

function sectionVoices(scene, audio) {
  const body = audio.length
    ? audio
        .map(
          (m, i) => html`
            <div class="voice-row">
              <button class="play-btn" data-action="play-audio" data-id="${m.id}" aria-label="تشغيل">
                ${raw(icon('play'))}
              </button>
              <div class="info">
                <b>${m.caption || m.filename}</b>
                <span class="role">${AUDIO_ROLE_LABEL[m.role] || 'تسجيل'}</span>
                ${raw(
                  m.tags?.length
                    ? html`<span class="link-badges">${raw(
                        m.tags.map((t) => html`<span class="link-badge tag">${t}</span>`).join('')
                      )}</span>`
                    : ''
                )}
              </div>
              ${raw(wave(i + 1))}
              <span class="dur">${formatDuration(m.durationMs)}</span>
              <button class="row-del" data-action="delete-audio" data-id="${m.id}"
                data-scene="${scene.id}" aria-label="حذف التسجيل">
                ${raw(icon('trash', 16))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-audio', scene.id, 'mic', 'أضف صوت أو سجّل', 'التسجيل الأصلي، صوتك، أو أجزاء المحادثة');

  return html`
    <section class="sec" id="sec-voices">
      ${raw(head('mic', 'الأصوات', audio.length || '', 'add-audio', scene.id, 'أضف'))}
      ${raw(body)}
      ${raw(
        audio.length
          ? html`<div class="script-foot">
              <button class="mini-btn" data-action="record-audio" data-id="${scene.id}">
                ${raw(icon('mic'))} سجّل صوتك
              </button>
            </div>`
          : ''
      )}
    </section>`;
}

function sectionScripts(scene, scriptList, activeId) {
  if (!scriptList.length) {
    return html`
      <section class="sec wide" id="sec-scripts">
        ${raw(head('script', 'السكريبتات', '', 'add-script', scene.id, 'أضف'))}
        ${raw(slot('add-script', scene.id, 'script', 'أضف أول سكريبت', 'النص اللي قلته أو اللي المفروض تقوله'))}
      </section>`;
  }

  const active = scriptList.find((s) => s.id === activeId) || scriptList.find((s) => s.isPrimary) || scriptList[0];

  return html`
    <section class="sec wide" id="sec-scripts">
      ${raw(head('script', 'السكريبتات', scriptList.length, 'add-script', scene.id, 'أضف'))}

      <div class="tabs" role="tablist">
        ${raw(
          scriptList
            .map(
              (s) => html`
                <button class="tab ${s.id === active.id ? 'active' : ''}" role="tab"
                  data-action="show-script" data-id="${s.id}" data-scene="${scene.id}">
                  ${s.title || scriptTypeLabel(s.type)}${raw(s.isPrimary ? ' ★' : '')}
                </button>`
            )
            .join('')
        )}
      </div>

      <div class="script-body ru" dir="ltr" lang="ru">${active.text || ''}</div>

      <div class="script-foot">
        <button class="mini-btn" data-action="edit-script" data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('edit'))} تعديل
        </button>
        <button class="mini-btn" data-action="copy-script" data-id="${active.id}">
          ${raw(icon('copy'))} نسخ
        </button>
        <button class="mini-btn" data-action="shadow-script"
          data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('play'))} تدرّب بالظلّ
        </button>
        <button class="mini-btn" data-action="shadow-selection"
          data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('check'))} تدرّب على جمل مختارة
        </button>
        ${raw(
          active.isPrimary
            ? ''
            : html`<button class="mini-btn" data-action="primary-script" data-id="${active.id}" data-scene="${scene.id}">
                ${raw(icon('star'))} اجعله الأساسي
              </button>`
        )}
        <button class="mini-btn danger" data-action="delete-script"
          data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('trash'))} حذف
        </button>
      </div>
    </section>`;
}

function sectionConversation(scene, parts) {
  const body = parts.length
    ? parts
        .map(
          (p) => html`
            <div class="bubble-row ${p.isMine ? 'mine' : ''}">
              <span class="avatar">${(p.speaker || '؟').slice(0, 1)}</span>
              <div class="bubble">
                <div class="who">${p.speaker}</div>
                <div class="txt ru" dir="ltr" lang="ru">${p.text}</div>
                ${raw(p.translation ? html`<div class="foot">${p.translation}</div>` : '')}
              </div>
              <button class="row-del" data-action="delete-part" data-id="${p.id}"
                data-scene="${scene.id}" aria-label="حذف الجزء">
                ${raw(icon('trash', 15))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-part', scene.id, 'chat', 'أضف أجزاء المحادثة', 'مين قال إيه — بالترتيب');

  return html`
    <section class="sec wide" id="sec-conversation">
      ${raw(head('chat', 'المحادثة الحقيقية', parts.length || '', 'add-part', scene.id, 'أضف جزء'))}
      ${raw(body)}
      ${raw(
        parts.length
          ? html`<div class="script-foot">
              <button class="mini-btn" data-action="shadow-conversation" data-scene="${scene.id}">
                ${raw(icon('play'))} تدرّب بالظلّ
              </button>
            </div>`
          : ''
      )}
    </section>`;
}

function sectionMistakes(scene, mistakes) {
  const body = mistakes.length
    ? mistakes
        .map(
          (m) => html`
            <div class="mistake">
              <div class="m-line wrong">
                <span class="mark">✕</span>
                <span class="ru" dir="ltr" lang="ru">${m.wrong}</span>
              </div>
              <div class="m-arrow">↓</div>
              <div class="m-line right">
                <span class="mark">✓</span>
                <span class="ru" dir="ltr" lang="ru">${m.natural}</span>
              </div>
              ${raw(m.explanation ? html`<div class="m-note">${m.explanation}</div>` : '')}
              <button class="row-del corner" data-action="delete-mistake" data-id="${m.id}"
                data-scene="${scene.id}" aria-label="حذف التصحيح">
                ${raw(icon('trash', 15))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-mistake', scene.id, 'compare', 'أضف تصحيح', 'اللي قلته مقابل اللي المفروض يتقال');

  return html`
    <section class="sec wide" id="sec-mistakes">
      ${raw(head('compare', 'خطأ / طبيعي', mistakes.length || '', 'add-mistake', scene.id, 'أضف'))}
      ${raw(body)}
    </section>`;
}

function sectionLanguage(scene, expressionList) {
  const body = expressionList.length
    ? expressionList
        .map(
          (e) => html`
            <div class="lang-row">
              <div class="txt">
                <span class="ru" dir="ltr" lang="ru">${e.text}</span>
                ${raw(e.meaningAr ? html`<span class="meaning">${e.meaningAr}</span>` : '')}
              </div>
              ${raw(
                e.register
                  ? html`<span class="tag ${registerClass(e.register)}">${registerLabel(e.register)}</span>`
                  : ''
              )}
              <button class="row-del" data-action="delete-expression" data-id="${e.id}"
                data-scene="${scene.id}" aria-label="حذف التعبير">
                ${raw(icon('trash', 15))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-expression', scene.id, 'language', 'أضف تعبير', 'التعبيرات اللي اتعلمتها من اللحظة دي');

  return html`
    <section class="sec" id="sec-language">
      ${raw(head('language', 'اللغة جوّه الذكرى', expressionList.length || '', 'add-expression', scene.id, 'أضف'))}
      ${raw(body)}
    </section>`;
}

/**
 * Expression Life — الخط الزمني.
 * المراحل معروضة دائمًا كهيكل؛ المرحلة المحقّقة فقط هي المضيئة.
 * لا تواريخ مخترعة — الباهت يعني "لسه محصلش".
 */
function sectionLife(scene, expressionList) {
  const STEPS = [
    { k: 'heard', t: 'سمعته' },
    { k: 'understood', t: 'فهمته' },
    { k: 'practiced', t: 'تمرّنت' },
    { k: 'used', t: 'استخدمته' },
    { k: 'natural', t: 'بقى طبيعي' },
    { k: 'automatic', t: 'تلقائي' },
  ];

  const first = expressionList[0];
  const currentIndex = first ? Math.max(0, STEPS.findIndex((s) => s.k === first.masteryState)) : -1;

  return html`
    <section class="sec" id="sec-life">
      ${raw(head('clock', 'رحلة التعبير', '', null))}
      ${raw(
        first
          ? html`<div class="ru" dir="ltr" lang="ru" style="font-weight:600;margin-bottom:2px">${first.text}</div>`
          : html`<div class="text-sm text-faint" style="margin-bottom:2px">
              أول ما تضيف تعبير، هتشوف رحلته من "سمعته" لحد "تلقائي"
            </div>`
      )}

      <div class="life-track">
        ${raw(
          STEPS.map((s, i) => {
            let cls = 'pending';
            if (currentIndex >= 0 && i < currentIndex) cls = 'done';
            else if (currentIndex >= 0 && i === currentIndex) cls = 'now';
            return html`
              <div class="life-step ${cls}">
                <span class="dot"></span>
                <span class="t">${s.t}</span>
                <span class="d">${raw(cls === 'pending' ? '—' : cls === 'now' ? 'دلوقتي' : '✓')}</span>
              </div>`;
          }).join('')
        )}
      </div>
    </section>`;
}

function sectionRecall(scene, hasImage) {
  return html`
    <section class="sec" id="sec-recall">
      ${raw(head('mic', 'احكيها دلوقتي', '', null))}
      <div class="tell-now">
        <p>
          ${hasImage
            ? 'بصّ على الصورة واحكي الموقف بالروسي من غير ما تقرأ السكريبت.'
            : 'افتكر الموقف واحكيه بالروسي من غير ما تقرأ السكريبت.'}
        </p>
        <button class="rec-btn" data-action="record-retell" data-id="${scene.id}" aria-label="ابدأ التسجيل">
          ${raw(icon('mic'))}
        </button>
        <div class="rec-time" data-rec-time>00:00</div>
      </div>
    </section>`;
}

function sectionNotes(scene, notesText) {
  return html`
    <section class="sec" id="sec-notes">
      ${raw(head('note', 'ملاحظاتي', '', null))}
      <textarea class="notes-area" data-notes data-id="${scene.id}"
        placeholder="أي حاجة عايز تفتكرها عن اللحظة دي…">${notesText || ''}</textarea>
    </section>`;
}

/* ============================================================
   العرض الكامل
   ============================================================ */

export async function renderScene(main, sceneId, options = {}) {
  releaseUrls();

  const full = await getSceneFull(sceneId);
  if (!full) {
    main.innerHTML = html`
      <button class="back-row" data-action="back">${raw(icon('back'))} رجوع</button>
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الذكرى دي مش موجودة</h2>
        <p>يمكن تكون اتنقلت لسلة المهملات أو اتمسحت.</p>
        <button class="btn btn-ghost" data-action="go-life">افتح حياتي</button>
      </div>`;
    return;
  }

  const { scene, media: mediaItems, scripts: scriptList, mistakes } = full;
  const images = mediaItems.filter((m) => m.kind === 'image');
  const audio = mediaItems.filter((m) => m.kind === 'audio');

  const [parts, expressionList, notesBlock, threads] = await Promise.all([
    listConversationParts(sceneId),
    listSceneExpressions(sceneId),
    getBlock(sceneId, 'notes'),
    threadsOfScene(sceneId),
  ]);

  const counts = {
    images: images.length,
    audio: audio.length,
    scripts: scriptList.length,
    parts: parts.length,
    mistakes: mistakes.length,
    expressions: expressionList.length,
  };

  const cover = images.find((m) => m.id === scene.coverMediaId) || images[0] || null;

  main.innerHTML = html`
    <button class="back-row" data-action="back">${raw(icon('back'))} رجوع</button>

    <div class="scene-top">
      <div class="titles">
        <h1>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h1>
        ${raw(scene.titleRu && scene.titleAr ? html`<div class="title-ru ru" dir="ltr" lang="ru">${scene.titleRu}</div>` : '')}
        <div class="meta-chips">
          <span class="chip">${raw(icon('calendar'))} ${formatDate(scene.date)}</span>
          <span class="chip">${raw(icon('tag'))} ${typeLabel(scene.type)}</span>
          ${raw(
            scene.placeName
              ? html`<span class="chip">${raw(icon('place'))} ${scene.placeName}</span>`
              : html`<button class="chip editable empty" data-action="edit-scene" data-id="${scene.id}">
                  ${raw(icon('place'))} أضف المكان
                </button>`
          )}
          <!--
            الخيوط التي تنتمي إليها الذكرى — بأسمائها لا بمعرّفاتها
            (بند 29)، وكلٌّ منها رابطٌ إلى قصّته.
          -->
          ${raw(
            threads
              .map(
                (t) =>
                  html`<a class="chip chip-thread" href="#/thread/${t.id}">
                    ${raw(icon('link'))} ${esc(t.title)}
                  </a>`
              )
              .join('')
          )}
          <button class="chip editable" data-action="thread-link" data-id="${scene.id}">
            ${raw(icon('link'))} ${threads.length ? 'اربطها بقصّة تانية' : 'اربطها بقصّة'}
          </button>
          <button class="chip editable" data-action="edit-scene" data-id="${scene.id}">
            ${raw(icon('edit'))} تعديل
          </button>
        </div>
      </div>

      <div class="top-actions">
        <button class="star-btn ${scene.isFavorite ? 'on' : ''}" data-action="toggle-fav"
          data-id="${scene.id}" aria-label="مفضّلة">${raw(icon('star'))}</button>
        <button class="tool-btn" data-action="export-scene" data-id="${scene.id}">
          ${raw(icon('download'))} تصدير
        </button>
        <button class="tool-btn" data-action="trash-scene" data-id="${scene.id}">
          ${raw(icon('trash'))} السلة
        </button>
      </div>
    </div>

    <nav class="mini-index" aria-label="أقسام الذكرى">
      ${raw(
        SECTIONS.map((s) => {
          const n = s.count ? counts[s.count] : null;
          return html`
            <button class="index-btn" data-action="scroll-to" data-target="sec-${s.id}">
              ${s.label}${raw(n ? html` <span class="n">${n}</span>` : '')}
            </button>`;
        }).join('')
      )}
    </nav>

    <section id="sec-moment">
      ${raw(
        cover
          ? html`
              <button class="scene-hero" data-action="open-image" data-id="${cover.id}" data-scene="${scene.id}">
                <img src="${urlFor(cover, { thumb: false })}" alt="صورة الذكرى">
                <span class="cap">
                  <b>${scene.titleAr || 'اللحظة'}</b>
                  <span>${formatDate(scene.date)}${raw(scene.placeName ? ` · ${scene.placeName}` : '')}</span>
                </span>
              </button>`
          : html`
              <button class="scene-hero is-empty" data-action="add-images" data-id="${scene.id}">
                ${raw(icon('image'))}
                <span class="t">أضف صورة اللحظة</span>
                <span class="text-sm">الصورة هي اللي بترجّعك للموقف</span>
              </button>`
      )}
      ${raw(
        scene.context
          ? html`<div class="sec" style="margin-bottom:var(--sp-4)">
              <p class="text-soft" style="margin:0;line-height:1.9">${scene.context}</p>
            </div>`
          : ''
      )}
    </section>

    <div class="board">
      ${raw(sectionImages(scene, images, scene.coverMediaId))}
      ${raw(sectionVoices(scene, audio))}
      ${raw(sectionLanguage(scene, expressionList))}
      ${raw(sectionScripts(scene, scriptList, options.activeScriptId))}
      ${raw(sectionConversation(scene, parts))}
      ${raw(sectionMistakes(scene, mistakes))}
      ${raw(sectionLife(scene, expressionList))}
      ${raw(sectionRecall(scene, images.length > 0))}
      ${raw(sectionNotes(scene, notesBlock.text))}
    </div>`;
}

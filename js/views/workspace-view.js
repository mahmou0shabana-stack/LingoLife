/**
 * LingoLife — ورشةُ المحتوى الموحَّدة (WS-F · **تجريبيّة**)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **مكتبٌ واحدٌ لا رحلةُ صفحات** (بند ٧)
 * ═══════════════════════════════════════════════════════════════
 *
 * بلاغُك كان دقيقًا: النموذجُ بسيطٌ والتجربةُ تجعله معقّدًا. كنتَ
 * تفتح صفحةً وتتفحّص عنصرًا وترجع وتفتح أخرى وتحاول أن **تتذكّر**
 * ما رأيتَه، ثم تفتح نافذةَ ربطٍ وتبحث عن الهدف. والتذكّرُ هو الضريبة.
 *
 * فالمبدأ هنا: **عايِن قبل ما تربط، وضِيف أيّ حاجة في أيّ وقت، من
 * مكانٍ واحد.**
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ثلاثةُ أنواعٍ يراها المستعمِل، والباقي تحت الأرض** (بندا ٢ و١١٩)
 * ═══════════════════════════════════════════════════════════════
 *
 *   نصّ   = البنية        (وهو `scripts` بكلّ عمقها)
 *   صوت   = مرفَق          (`audio:script`)
 *   صورة  = مرفَق          (`image:script`)
 *
 * ولا تسأل الشاشةُ عن `relationships` ولا `nodeKind` ولا `parentId`.
 * تلك تفاصيلُ تخزينٍ لا تفاصيلُ حياة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والصوتُ لا ينقطع لأنك تقرأ** (بنود ١٥ و٧٥ و١٠٢)
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا هو التدفّقُ الحقيقيّ: تشغّل صوتًا مجهولًا، وتتصفّح النصوصَ وأنت
 * تسمع، حتى تعرف أيُّها هو. فلو أوقفت المعاينةُ الصوتَ لَاستحال
 * التعرّفُ أصلًا.
 *
 * والضمانُ **بنيويّ**: `audio-service` تملك عنصرَ `<audio>` واحدًا
 * ملحقًا بـ`body` خارج الشاشات كلِّها (WS28). وشريطُ «بتسمع دلوقتي»
 * هنا **مشتركٌ يرسم حالتَها** لا مالكٌ لعنصرها — فإعادةُ رسم المعاينة
 * لا تلمس التشغيل، ولا يمكنها ذلك.
 *
 * وبند ٧٦ (صوتٌ واحدٌ فعّال) مضمونٌ للسبب نفسِه: العنصرُ واحد.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا تُعاد كتابةُ الشاشة كلِّها عند كلّ لمسة** (بنود ٧٢…٧٤)
 * ═══════════════════════════════════════════════════════════════
 *
 * لكلّ لوحٍ دالّةُ رسمٍ خاصّةٌ تكتب `innerHTML` **الخاصّ بها**. لمسةٌ
 * على عقدةٍ في الشجرة تعيد رسمَ الشجرة والمعاينة والشريط — ولا تلمس
 * المكتبَ ولا تمريرَه ولا تحديدَه ولا بحثَه.
 */

import { html, raw, esc, formatDuration } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { showModal, confirmAction } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { urlFor, releaseUrls, AUDIO_ROLE_LABEL, addFilesToScene, pickFiles } from '../services/media-service.js';
import { api as audio, subscribe as subscribeAudio } from '../services/audio-service.js';
import { openLightbox } from '../components/lightbox.js';
import {
  workspaceBoard, linkSelection, unlinkOne,
  createMainScript, addLooseText, placeTextUnder, addTextAt, saveNodeText,
  commitPaste, conflictsFor, NODE_KIND_LABEL,
} from '../services/workspace/workspace-service.js';
import { parseDialogue, looksLikeDialogue } from '../services/workspace/speaker-parser.js';

/* ================================================================== *
 * الحالة — عابرةٌ عمدًا، ومحفوظةٌ داخل الجلسة (بنود ٧٢…٧٤)
 * ================================================================== */

const state = {
  sceneId: null,
  rootId: null,
  targetId: null,
  /** ما تعرضه المعاينةُ الآن: نصٌّ أو صوتٌ أو صورة (بند ٤٣). */
  focus: null,
  selection: new Set(),
  filter: 'all',
  query: '',
  treeQuery: '',
  expanded: new Set(),
  previewMode: 'chat',
  previewQuery: '',
  /** اللوحُ الظاهر في العرض الضيّق — والعريضُ يعرضها كلَّها (بند ٧١). */
  pane: 'tree',
  /** ذاكرةٌ لكلّ سكريبتٍ رئيسيّ: أين كنتَ فيه (بند ٩٤). */
  perRoot: new Map(),
};

let board = null;
let wires = null;
let stopAudioWatch = null;

const freshWires = () => { wires?.abort(); wires = new AbortController(); };
const wired = (extra = {}) => ({ ...extra, signal: wires?.signal });

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ================================================================== *
 * مساعداتُ عرض
 * ================================================================== */

/**
 * ⚠️ **فاصلُ المسار نقطةٌ وسطى لا سهم** — نفسُ درس WS56 حرفيًّا:
 *    `›` محرفٌ ذو اتجاه ينقلب في السياق العربيّ فيُقرأ فاصلة. و`·`
 *    محايدةٌ ثنائيّةُ الاتجاه، تُقرأ كما هي في الاتّجاهين (بند ٨٩).
 */
const SEP = ' · ';
const pathOf = (id) => {
  const target = board?.targetById.get(id);
  return target ? target.path.join(SEP) : null;
};

const itemTitle = (item) => {
  if (item.caption) return item.caption;
  if (item.kind === 'audio') return AUDIO_ROLE_LABEL[item.role] || 'تسجيل';
  return 'صورة';
};

const nodeKindLabel = (kind) => NODE_KIND_LABEL[kind] || '';

/** يبرز مواضعَ البحث داخل نصٍّ مهرَّب — بحثٌ محلّيٌّ خفيف (بند ٤٢). */
function withMarks(text, query) {
  const safe = esc(text);
  const needle = query.trim();
  if (!needle) return safe;
  const parts = esc(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(parts, 'gi'), (hit) => `<mark>${hit}</mark>`);
}

/* ================================================================== *
 * أ · السكريبتات الرئيسيّة (بنود ٥ و٦ و٦٤)
 * ================================================================== */

function rootsHtml() {
  return html`
    <div class="ws-pane-head">
      <h3>السكريبتات</h3>
      <button type="button" class="ws-mini" data-ws="new-root" title="سكريبت رئيسي جديد">+</button>
    </div>
    <ul class="ws-roots">
      ${raw(board.roots.map((row) => {
        const target = board.targetById.get(row.id);
        return html`
        <li>
          <button type="button" class="ws-root ${row.id === state.rootId ? 'on' : ''}"
                  data-ws="root" data-id="${row.id}">
            <span class="ws-root-t" dir="auto">${row.title}</span>
            <span class="ws-root-n">${target ? target.sub.audio + target.own.audio : 0}🎙
              ${target ? target.sub.images + target.own.images : 0}🖼</span>
          </button>
        </li>`;
      }).join(''))}
    </ul>`;
}

/* ================================================================== *
 * ب · شجرةُ النصّ (بنود ٩ و١٠ و٥٤ و٥٥ و٥٦)
 * ================================================================== */

/** هل تطابق العقدةُ أو أحدُ أحفادها بحثَ الشجرة؟ */
function treeHit(row, needle) {
  if (!needle) return true;
  const hay = `${row.node.title}\n${row.node.text || ''}`.toLowerCase();
  if (hay.includes(needle)) return true;
  return row.children.some((child) => treeHit(child, needle));
}

function treeRows(rows, needle, out = []) {
  for (const row of rows) {
    if (!treeHit(row, needle)) continue;
    const target = board.targetById.get(row.node.id);
    const open = state.expanded.has(row.node.id) || Boolean(needle);
    out.push({ row, target, open });
    if (open) treeRows(row.children, needle, out);
  }
  return out;
}

function treeHtml() {
  const root = board.roots.find((one) => one.id === state.rootId);
  if (!root) return '<p class="ws-empty">اختار سكريبت رئيسي</p>';

  const needle = state.treeQuery.trim().toLowerCase();
  const rows = treeRows(board.treeByRoot.get(root.id) || [], needle);
  const rootTarget = board.targetById.get(root.id);

  const line = (node, target, depth, open, kids) => html`
    <li class="ws-node ${node.id === state.targetId ? 'is-target' : ''}
               ${node.hidden === 1 ? 'is-hidden' : ''}" style="--ws-d:${depth}">
      <button type="button" class="ws-twist ${kids ? '' : 'is-leaf'}"
              data-ws="twist" data-id="${node.id}"
              aria-label="${open ? 'اطوِ' : 'افرد'}">${kids ? (open ? '▾' : '▸') : '·'}</button>
      <button type="button" class="ws-node-btn" data-ws="node" data-id="${node.id}">
        <span class="ws-node-t" dir="auto">${node.title}</span>
        <span class="ws-node-meta">
          ${raw(nodeKindLabel(node.nodeKind) ? html`<i>${nodeKindLabel(node.nodeKind)}</i>` : '')}
          ${raw(target?.own.audio ? `<b>🎙${target.own.audio}</b>` : '')}
          ${raw(target?.own.images ? `<b>🖼${target.own.images}</b>` : '')}
          <!--
            ⚠️ **العدُّ المباشرُ والعدُّ التراكميّ لا يُخلَطان** (بند ٥٤).
               «🎙٢» ما عُلِّق على العقدة نفسِها، و«+٧ تحتها» ما في
               أبنائها. ورقمٌ واحدٌ يجمعهما لا يقول أيَّهما — فتفتح
               المرحلةَ تبحث عن تسعةٍ فلا تجد إلّا اثنين.
          -->
          ${raw(target && (target.sub.audio || target.sub.images)
            ? `<em>+${target.sub.audio + target.sub.images} تحتها</em>` : '')}
        </span>
      </button>
      <button type="button" class="ws-node-more" data-ws="node-menu" data-id="${node.id}"
              aria-label="خيارات">⋯</button>
    </li>`;

  return html`
    <div class="ws-pane-head">
      <h3 dir="auto">${root.title}</h3>
      <button type="button" class="ws-mini" data-ws="add-text-here" title="نصّ جوّه المحدَّد">+ نصّ</button>
    </div>
    <input class="ws-find" data-ws-tree-find type="search" dir="auto"
           placeholder="دوّر في العناوين والنصّ…" value="${state.treeQuery}">
    <ul class="ws-tree">
      ${raw(line(root, rootTarget, 0, true, rows.length))}
      ${raw(rows.map(({ row, target, open }) => line(
        row.node, target, row.depth + 1, open, row.children.length
      )).join(''))}
    </ul>
    ${raw(rows.length || !needle ? '' : '<p class="ws-empty">مفيش نتيجة</p>')}`;
}

/* ================================================================== *
 * ج · مكتبُ المحتوى (بنود ١٩…٢٢ و٨٧)
 * ================================================================== */

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'unlinked', label: 'غير مربوط' },
  { id: 'text', label: 'نصوص' },
  { id: 'audio', label: 'أصوات' },
  { id: 'image', label: 'صور' },
];

function deskItems() {
  const needle = state.query.trim().toLowerCase();
  const match = (title) => !needle || title.toLowerCase().includes(needle);

  const texts = board.looseTexts
    .filter((row) => match(`${row.title} ${row.text || ''}`))
    .map((row) => ({ kind: 'text', row }));
  const audios = board.audio
    .filter((row) => match(itemTitle(row)))
    .map((row) => ({ kind: 'audio', row }));
  const images = board.images
    .filter((row) => match(itemTitle(row)))
    .map((row) => ({ kind: 'image', row }));

  const all = [...texts, ...audios, ...images];
  if (state.filter === 'text') return texts;
  if (state.filter === 'audio') return audios;
  if (state.filter === 'image') return images;
  /*
   * ⚠️ **«غير مربوط» ليس تحذيرًا** (بند ٢١): هو الكومةُ التي لسّه
   *    ما رتّبتهاش، وهي أنفعُ حالةٍ في الشاشة كلِّها — فلا تُدفَن
   *    خلف قائمةٍ ولا تُلوَّن بالأحمر.
   */
  if (state.filter === 'unlinked') {
    return all.filter((one) => one.kind === 'text' || !board.linkedTo.has(one.row.id));
  }
  return all;
}

function cardHtml(entry) {
  const { kind, row } = entry;
  const picked = state.selection.has(row.id);
  const focused = state.focus?.id === row.id;
  const at = kind === 'text' ? null : board.linkedTo.get(row.id);
  const where = at ? pathOf(at) : null;

  const face = kind === 'image'
    ? html`<img src="${urlFor(row, { thumb: true })}" alt="" loading="lazy" decoding="async">`
    : (kind === 'audio'
      ? html`<span class="ws-face is-audio">${raw(icon('mic', 18))}</span>`
      : html`<span class="ws-face is-text">${raw(icon('script', 18))}</span>`);

  const title = kind === 'text' ? row.title : itemTitle(row);
  const sub = kind === 'audio'
    ? (row.durationMs ? formatDuration(row.durationMs) : 'صوت')
    : (kind === 'text' ? `${(row.text || '').length} حرف` : 'صورة');

  return html`
    <li class="ws-card ${picked ? 'is-picked' : ''} ${focused ? 'is-focus' : ''}"
        data-ws-card="${row.id}" data-kind="${kind}">
      <button type="button" class="ws-card-face" data-ws="focus"
              data-id="${row.id}" data-kind="${kind}"
              aria-label="عايِن ${title}">${raw(face)}</button>
      <div class="ws-card-body">
        <button type="button" class="ws-card-t" data-ws="focus"
                data-id="${row.id}" data-kind="${kind}" dir="auto">${title}</button>
        <span class="ws-card-sub">${sub}</span>
        <!--
          ⚠️ **وأين هو مكتوبٌ على البطاقة** (بند ٨٤): ألّا تعرف مكانَ
             شيءٍ إلّا بفتح تفاصيله هو نفسُه التعبُ الذي جئنا نزيله.
        -->
        ${raw(where ? html`<span class="ws-card-at" title="${where}">مرتبط بـ ${where}</span>`
          : (kind === 'text' ? '<span class="ws-card-at is-loose">نصّ سايب</span>'
            : '<span class="ws-card-at is-loose">غير مربوط</span>'))}
      </div>
      <div class="ws-card-acts">
        ${raw(kind === 'audio' ? html`
          <button type="button" class="ws-play" data-ws="play" data-id="${row.id}"
                  aria-label="شغّل">${raw(icon('play', 16))}</button>` : '')}
        ${raw(kind === 'text' ? '' : html`
          <button type="button" class="ws-pick ${picked ? 'on' : ''}" data-ws="pick"
                  data-id="${row.id}" role="checkbox" aria-checked="${picked ? 'true' : 'false'}"
                  aria-label="اختار">${picked ? '✓' : ''}</button>`)}
      </div>
    </li>`;
}

function deskHtml() {
  const items = deskItems();
  const counts = {
    unlinked: board.counts.unlinked,
  };

  return html`
    <div class="ws-pane-head">
      <h3>المحتوى</h3>
      <button type="button" class="ws-mini" data-ws="add">+ أضف</button>
    </div>
    <div class="ws-filters" role="tablist">
      ${raw(FILTERS.map((one) => html`
        <button type="button" class="ws-filter ${state.filter === one.id ? 'on' : ''}"
                data-ws="filter" data-v="${one.id}" role="tab"
                aria-selected="${state.filter === one.id ? 'true' : 'false'}">
          ${one.label}${one.id === 'unlinked' && counts.unlinked ? ` (${counts.unlinked})` : ''}
        </button>`).join(''))}
    </div>
    <input class="ws-find" data-ws-desk-find type="search" dir="auto"
           placeholder="دوّر بالاسم…" value="${state.query}">
    <ul class="ws-cards">${raw(items.map(cardHtml).join(''))}</ul>
    ${raw(items.length ? '' : '<p class="ws-empty">مفيش حاجة هنا</p>')}`;
}

/* ================================================================== *
 * د · المعاينة الذكيّة (بنود ١٢…١٨ و٣٧…٤٣)
 * ================================================================== */

/**
 * يرسم نصًّا محادثةً — **بلا مساسٍ بالمخزَّن** (بند ٤١).
 *
 * ⚠️ **والدَّورُ يبقى كتلةً واحدةً مهما تعدّدت فقراتُه** (بند ٣٩).
 *    قطعُ كلِّ سطرٍ فقاعةً يحوّل شرحًا متّصلًا إلى رشقاتٍ لا تُقرأ.
 */
function chatHtml(text) {
  const turns = parseDialogue(text);
  return html`
    <div class="ws-chat">
      ${raw(turns.map((turn) => {
        if (!turn.speaker) {
          return html`<p class="ws-chat-pre" dir="auto">${raw(withMarks(turn.text, state.previewQuery))}</p>`;
        }
        return html`
          <div class="ws-turn" data-sp="${turn.speaker}">
            <span class="ws-turn-who">المتحدث ${turn.speaker}</span>
            <div class="ws-turn-body" dir="auto">
              ${raw(turn.text.split(/\n{2,}/).map((para) => html`
                <p>${raw(withMarks(para, state.previewQuery))}</p>`).join(''))}
            </div>
          </div>`;
      }).join(''))}
    </div>`;
}

function textPreview(node) {
  const text = node.text || '';
  const dialogue = looksLikeDialogue(text);
  const mode = dialogue && state.previewMode === 'chat' ? 'chat' : 'text';
  const target = board.targetById.get(node.id);

  return html`
    <div class="ws-prev-head">
      <div class="ws-crumb" dir="auto">${target ? target.path.join(SEP) : node.title}</div>
      <div class="ws-prev-acts">
        ${raw(dialogue ? html`
          <span class="ws-seg">
            <button type="button" class="${mode === 'text' ? 'on' : ''}"
                    data-ws="pmode" data-v="text">نصّ</button>
            <button type="button" class="${mode === 'chat' ? 'on' : ''}"
                    data-ws="pmode" data-v="chat">محادثة</button>
          </span>` : '')}
        <button type="button" class="ws-mini" data-ws="edit-text" data-id="${node.id}">تحرير</button>
        <button type="button" class="ws-mini" data-ws="shadow" data-id="${node.id}">تدرّب</button>
      </div>
    </div>
    <input class="ws-find" data-ws-prev-find type="search" dir="auto"
           placeholder="دوّر جوّه النصّ…" value="${state.previewQuery}">
    <div class="ws-prev-body" data-ws-prev-body>
      ${raw(text.trim()
        ? (mode === 'chat' ? chatHtml(text)
          : html`<pre class="ws-raw" dir="auto">${raw(withMarks(text, state.previewQuery))}</pre>`)
        : '<p class="ws-empty">العقدة دي لسّه مفيهاش نصّ</p>')}
    </div>
    ${raw(mediaStrip(node.id))}`;
}

/** ما عُلِّق على هذه العقدة نفسِها — ولو كان لها أبناء (بند ٥٣). */
function mediaStrip(nodeId) {
  const mine = {
    audio: board.audio.filter((row) => board.linkedTo.get(row.id) === nodeId),
    images: board.images.filter((row) => board.linkedTo.get(row.id) === nodeId),
  };
  if (!mine.audio.length && !mine.images.length) return '';

  return html`
    <div class="ws-strip">
      <h4>مربوط بالعقدة دي</h4>
      <ul class="ws-strip-list">
        ${raw(mine.audio.map((row) => html`
          <li><button type="button" data-ws="focus" data-kind="audio" data-id="${row.id}">
            🎙 ${itemTitle(row)}</button>
            <button type="button" class="ws-unlink" data-ws="unlink" data-id="${row.id}">فكّ</button>
          </li>`).join(''))}
        ${raw(mine.images.map((row) => html`
          <li><button type="button" data-ws="focus" data-kind="image" data-id="${row.id}">
            🖼 ${itemTitle(row)}</button>
            <button type="button" class="ws-unlink" data-ws="unlink" data-id="${row.id}">فكّ</button>
          </li>`).join(''))}
      </ul>
    </div>`;
}

function audioPreview(item) {
  const at = board.linkedTo.get(item.id);
  return html`
    <div class="ws-prev-head">
      <div class="ws-crumb">🎙 ${itemTitle(item)}</div>
      <div class="ws-prev-acts">
        <button type="button" class="ws-mini" data-ws="play" data-id="${item.id}">شغّل / وقّف</button>
      </div>
    </div>
    <dl class="ws-facts">
      <dt>المدّة</dt><dd>${item.durationMs ? formatDuration(item.durationMs) : '—'}</dd>
      <dt>التصنيف</dt><dd>${AUDIO_ROLE_LABEL[item.role] || 'مش متصنّف'}</dd>
      <dt>مرتبط بـ</dt><dd dir="auto">${at ? pathOf(at) : 'لسّه غير مربوط'}</dd>
    </dl>
    <!--
      ⚠️ **والتشغيلُ نفسُه في الشريط السفليّ لا هنا** (بند ٧٥): لو كان
         عنصرُ الصوت داخل هذا اللوح لَمات مع أوّل عقدةٍ تفتحها — وهو
         بالضبط ما يمنع التعرّفَ على الصوت المجهول.
    -->
    <p class="ws-note">التشغيل في الشريط تحت — كمّل سماع وأنت بتقلّب في النصوص.</p>`;
}

function imagePreview(item) {
  const at = board.linkedTo.get(item.id);
  return html`
    <div class="ws-prev-head">
      <div class="ws-crumb">🖼 ${itemTitle(item)}</div>
      <div class="ws-prev-acts">
        <button type="button" class="ws-mini" data-ws="zoom" data-id="${item.id}">كبّر</button>
      </div>
    </div>
    <div class="ws-shot">
      <img src="${urlFor(item, { thumb: false })}" alt="${itemTitle(item)}" decoding="async">
    </div>
    <dl class="ws-facts">
      <dt>مرتبط بـ</dt><dd dir="auto">${at ? pathOf(at) : 'لسّه غير مربوط'}</dd>
    </dl>`;
}

function previewHtml() {
  if (!state.focus) return '<p class="ws-empty">المس أيّ حاجة عشان تعاينها</p>';

  if (state.focus.kind === 'text') {
    const full = nodeById(state.focus.id);
    return full ? textPreview(full) : '<p class="ws-empty">العقدة دي مابقتش موجودة</p>';
  }

  const list = state.focus.kind === 'audio' ? board.audio : board.images;
  const item = list.find((row) => row.id === state.focus.id);
  if (!item) return '<p class="ws-empty">العنصر ده مابقاش موجود</p>';
  return state.focus.kind === 'audio' ? audioPreview(item) : imagePreview(item);
}

/**
 * فهرسُ العُقَد الحقيقيّة: المعرّف → `{ node, parentId }`.
 *
 * ⚠️ **يُبنى مرّةً عند القراءة لا عند كلّ لمسة.** أوّلُ صياغةٍ كتبتُها
 *    كانت تمشي الشجرةَ كلَّها في كلّ معاينةٍ وفي كلّ قائمةِ عقدة —
 *    مسحٌ كاملٌ لمئة عقدةٍ لأجل سطرٍ واحد. وبند ٩١ يمنع ذلك صراحةً.
 */
let nodeIndex = new Map();

function buildNodeIndex() {
  const index = new Map();
  for (const root of board.roots) {
    index.set(root.id, { node: root, parentId: null });
    const walk = (list, parentId) => {
      for (const row of list) {
        index.set(row.node.id, { node: row.node, parentId });
        walk(row.children, row.node.id);
      }
    };
    walk(board.treeByRoot.get(root.id) || [], root.id);
  }
  nodeIndex = index;
}

const nodeById = (id) => nodeIndex.get(id)?.node || null;
const parentOf = (id) => nodeIndex.get(id)?.parentId || null;

/* ================================================================== *
 * الشريطان السفليّان — «بتسمع» و«اربط» (بنود ٨٢ و٨٦)
 * ================================================================== */

function nowHtml(snapshot) {
  if (!snapshot?.hasTrack) return '';
  const ratio = snapshot.duration ? (snapshot.currentTime / snapshot.duration) : 0;
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return html`
    <button type="button" class="ws-now-play" data-ws="toggle"
            aria-label="${snapshot.playing ? 'وقّف' : 'شغّل'}">
      ${raw(icon(snapshot.playing ? 'pause' : 'play', 18))}
    </button>
    <div class="ws-now-mid">
      <!--
        ⚠️ **مقارنةٌ صغيرةٌ تمنع لبسًا كبيرًا** (بند ٨٦): «بتسمع X»
           و«المرشَّح Y» جنبَ بعضٍ — فلا تربط صوتًا بجزءٍ وأنت تظنّ
           أنك تسمع غيرَه.
      -->
      <span class="ws-now-t" dir="auto">بتسمع: ${snapshot.title || 'تسجيل'}</span>
      <div class="ws-seek" data-ws="seek" role="slider" tabindex="0"
           aria-label="موضع التشغيل"
           aria-valuemin="0" aria-valuemax="100"
           aria-valuenow="${Math.round(ratio * 100)}">
        <div class="ws-seek-fill" style="inline-size:${(ratio * 100).toFixed(1)}%"></div>
      </div>
      <span class="ws-now-time">${clock(snapshot.currentTime)} / ${clock(snapshot.duration)}</span>
    </div>
    <button type="button" class="ws-now-link" data-ws="link-current"
            ${state.targetId ? '' : 'disabled'}>اربط الصوت الحالي هنا</button>`;
}

function barHtml() {
  const target = state.targetId ? board.targetById.get(state.targetId) : null;
  const n = state.selection.size;

  return html`
    <div class="ws-bar-target">
      <span class="ws-bar-lbl">المكان الحالي</span>
      <!--
        ⚠️ **ولا هدفَ قديمٌ يبقى معروضًا** (بند ٨٣): لو اتشالت العقدةُ
           أو اتنقلت، الشريطُ يقول «مفيش» بدل أن يشير إلى معرّفٍ ميّت.
      -->
      <b class="ws-bar-path" dir="auto">${target ? target.path.join(SEP) : 'مفيش مكان محدَّد'}</b>
    </div>
    <div class="ws-bar-acts">
      <span class="ws-bar-n">${n ? `${n} متحدِّد` : ''}</span>
      <button type="button" class="btn btn-primary" data-ws="link-selected"
              ${n && target ? '' : 'disabled'}>اربط المحدد هنا</button>
      <button type="button" class="btn btn-ghost" data-ws="clear-pick"
              ${n ? '' : 'disabled'}>إلغاء التحديد</button>
    </div>`;
}

/* ================================================================== *
 * الرسم الموضعيّ
 * ================================================================== */

const paintRoots = () => { const el = $('[data-ws-roots]'); if (el) el.innerHTML = rootsHtml(); };
const paintTree = () => { const el = $('[data-ws-tree]'); if (el) el.innerHTML = treeHtml(); };
const paintDesk = () => { const el = $('[data-ws-desk]'); if (el) el.innerHTML = deskHtml(); };
const paintPreview = () => { const el = $('[data-ws-preview]'); if (el) el.innerHTML = previewHtml(); };
const paintBar = () => { const el = $('[data-ws-bar]'); if (el) el.innerHTML = barHtml(); };
const paintNow = (snapshot) => {
  const el = $('[data-ws-now]');
  if (!el) return;
  el.innerHTML = nowHtml(snapshot);
  el.hidden = !snapshot?.hasTrack;
};

/** يبدّل اللوحَ الظاهر في العرض الضيّق — بلا مساسٍ بالحالة (بند ٧١). */
function paintPane() {
  const root = $('.ws');
  if (!root) return;
  root.dataset.pane = state.pane;
  $$('[data-ws="pane"]', root).forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.v === state.pane);
    btn.setAttribute('aria-selected', btn.dataset.v === state.pane ? 'true' : 'false');
  });
}

/** يعيد قراءةَ اللوحة بالكامل — بعد كتابةٍ لا بعد لمسة. */
async function refresh() {
  board = await workspaceBoard(state.sceneId);
  if (!board) return;
  buildNodeIndex();
  if (!board.roots.some((row) => row.id === state.rootId)) {
    state.rootId = board.roots[0]?.id || null;
  }
  /* ⚠️ هدفٌ اختفى لا يبقى هدفًا (بند ٨٣). */
  if (state.targetId && !board.targetById.has(state.targetId)) state.targetId = null;
  if (state.focus?.kind === 'text' && !board.targetById.has(state.focus.id)) state.focus = null;
  for (const id of [...state.selection]) {
    if (!board.audio.some((r) => r.id === id) && !board.images.some((r) => r.id === id)) {
      state.selection.delete(id);
    }
  }
  paintRoots(); paintTree(); paintDesk(); paintPreview(); paintBar();
}

/* ================================================================== *
 * الأفعال
 * ================================================================== */

function selectNode(id) {
  state.targetId = id;
  state.focus = { kind: 'text', id };
  state.previewQuery = '';
  if (state.rootId) state.perRoot.set(state.rootId, { targetId: id });
  paintTree(); paintPreview(); paintBar();
  /* في العرض الضيّق: اللمسةُ على عقدةٍ تعني «وَرّيني نصَّها». */
  if (window.matchMedia('(max-width: 899px)').matches) { state.pane = 'preview'; paintPane(); }
}

function selectRoot(id) {
  if (id === state.rootId) return;
  state.rootId = id;
  state.expanded = new Set();
  state.treeQuery = '';
  /*
   * ⚠️ **ولا يُمسَح المحتوى ولا التحديدُ ولا الصوت** (بندا ٦ و٩٤):
   *    بدّلتَ السكريبتَ لا الذكرى. والمكتبُ محتوى الذكرى كلِّها.
   */
  const memory = state.perRoot.get(id);
  state.targetId = memory && board.targetById.has(memory.targetId) ? memory.targetId : id;
  state.focus = { kind: 'text', id: state.targetId };
  paintRoots(); paintTree(); paintPreview(); paintBar();
}

async function playItem(mediaId) {
  const item = board.audio.find((row) => row.id === mediaId);
  if (!item) return toastError('التسجيل ده مابقاش موجود');
  /*
   * ⚠️ **وهي `load` لا عنصرٌ ننشئه** (بندا ٧٥ و٧٦): الخدمةُ تملك
   *    `<audio>` واحدًا خارج الشاشات، فتبديلُ المقطع يوقف السابقَ
   *    حتمًا، والتشغيلُ يعيش بعد كلّ إعادة رسمٍ هنا.
   */
  await audio.load({
    mediaId: item.id,
    url: urlFor(item, { thumb: false }),
    title: itemTitle(item),
    subtitle: board.scene?.titleAr || '',
  });
  state.focus = { kind: 'audio', id: mediaId };
  paintDesk(); paintPreview();
  return undefined;
}

async function linkThese(ids) {
  if (!state.targetId) return toastError('اختار المكان الأول');
  if (!ids.length) return toastError('مفيش حاجة متحدِّدة');
  const { linked } = await linkSelection(ids, state.targetId, board);
  state.selection.clear();
  await refresh();
  return toastOk(`اترّبط ${linked} — ${pathOf(state.targetId)}`);
}

async function openAddMenu() {
  const choice = await showModal({
    title: '+ أضف محتوى',
    submitLabel: 'اقفل',
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <!--
        ⚠️ **ثلاثةُ أنواعٍ لا اثنا عشر** (بند ٢٣): البنيةُ الداخليّة
           فيها مرحلةٌ ونسخةٌ وجولةٌ ونصُّ تدريب — وعرضُها كلِّها هنا
           يحوّل زرَّ «أضف» إلى امتحان. أنت تضيف نصًّا، ونوعُه تفصيلٌ
           تختاره بعدين لو حبّيت (بند ٢٦).
      -->
      <div class="ws-add">
        <button type="button" class="ws-add-btn" data-add="text">
          <b>📝 نصّ</b><span>عقدة جديدة أو ملاحظة سايبة</span></button>
        <button type="button" class="ws-add-btn" data-add="paste">
          <b>📥 استيراد نصّ منظَّم</b><span>الصق رحلة كاملة مرّة واحدة</span></button>
        <button type="button" class="ws-add-btn" data-add="audio">
          <b>🎙 صوت</b><span>ملفّ أو أكتر — يروح «غير مربوط»</span></button>
        <button type="button" class="ws-add-btn" data-add="image">
          <b>🖼 صورة</b><span>ملفّ أو أكتر — يروح «غير مربوط»</span></button>
      </div>`,
    onMount(root) {
      root.addEventListener('click', (event) => {
        const pick = event.target.closest('[data-add]')?.dataset.add;
        if (!pick) return;
        root.closest('.overlay')?.__close?.(pick);
      }, wired());
    },
  });

  if (choice === 'text') return openAddText();
  if (choice === 'paste') return openPaste();
  if (choice === 'audio' || choice === 'image') return uploadFiles(choice);
  return undefined;
}

/**
 * رفعُ ملفّاتٍ — **بلا ربطٍ إجباريّ** (بندا ٢٢ و٦١).
 *
 * ⚠️ ويروح المرفوعُ إلى «غير مربوط» لا إلى المكان الحاليّ. الربطُ
 *    قرارٌ يحتاج أن تسمع الملفَّ أوّلًا — وهذا هو البندُ ١٣ كلُّه.
 */
async function uploadFiles(kind) {
  const files = await pickFiles({
    accept: kind === 'audio' ? 'audio/*' : 'image/*',
    multiple: true,
  });
  if (!files?.length) return undefined;
  await addFilesToScene(state.sceneId, files);
  state.filter = 'unlinked';
  await refresh();
  return toastOk(`اتضاف ${files.length} — تلاقيهم في «غير مربوط»`);
}

/** إضافةُ نصٍّ: جوّه · بعده · سايب (بنود ٢٤ و٢٥ و٦٣). */
async function openAddText(where = null) {
  const target = state.targetId ? board.targetById.get(state.targetId) : null;

  const result = await showModal({
    title: 'نصّ جديد',
    wide: true,
    submitLabel: 'احفظ',
    body: html`
      <label class="fld"><span>العنوان</span>
        <input name="title" dir="auto" placeholder="مثلاً: PART 4 — الجمارك"></label>
      <label class="fld"><span>النصّ</span>
        <textarea name="text" rows="8" dir="auto"></textarea></label>
      <fieldset class="ws-where">
        <legend>يتحطّ فين؟</legend>
        ${raw(target ? html`
          <label><input type="radio" name="where" value="inside" checked>
            جوّه <b dir="auto">${target.title}</b></label>
          <label><input type="radio" name="where" value="after">
            بعد <b dir="auto">${target.title}</b></label>` : '')}
        <label><input type="radio" name="where" value="loose" ${target ? '' : 'checked'}>
          سايب — أقرّر مكانه بعدين</label>
      </fieldset>`,
    onSubmit: async (data, close) => {
      const title = String(data.title || '').trim();
      const text = String(data.text || '');
      if (!title && !text.trim()) return toastError('اكتب عنوان أو نصّ');
      const place = where || data.where || 'loose';

      if (place === 'loose' || !state.targetId) {
        await addLooseText(state.sceneId, { title: title || 'نصّ جديد', text });
      } else {
        const made = await addTextAt(state.targetId, place, { title: title || 'نصّ جديد', text });
        if (!made) {
          await addLooseText(state.sceneId, { title: title || 'نصّ جديد', text });
          toastOk('السكريبت الرئيسي مالوش أب — اتحفظ سكريبت مستقلّ');
        }
      }
      close();
      return undefined;
    },
  });

  if (result === 'submit') { state.filter = state.targetId ? state.filter : 'unlinked'; await refresh(); }
  return undefined;
}

/** اللصقُ المنظَّم تحت المكان الحاليّ (بندا ٦٥ و٦٦). */
async function openPaste() {
  const parentId = state.targetId || state.rootId;
  if (!parentId) return toastError('اختار سكريبت رئيسي الأول');
  const parent = board.targetById.get(parentId);

  const { openSmartPaste } = await import('../modals/smart-paste.js');
  const decided = await openSmartPaste({ parentLabel: parent?.title || 'السكريبت' });
  if (!decided?.ok) return undefined;

  /*
   * ⚠️ **والتعارضُ يُعرَض قبل الكتابة لا بعدها** (بند ٦٧): «PART 1»
   *    تحت أبٍ فيه «PART 1» ليست هي هي، ولا تُدمَج بالاسم أبدًا.
   */
  const clashes = await conflictsFor(parentId, decided.proposal);
  if (clashes.length) {
    const go = await confirmAction({
      title: 'في عناوين موجودة قبل كده',
      message: `${clashes.map((row) => row.title).join(' · ')}<br><br>`
        + 'هتتعمل <b>عُقَد جديدة منفصلة</b> — مش هتتدمج مع القديمة. أكمّل؟',
      confirmLabel: 'أكمّل',
    });
    if (!go) return undefined;
  }

  const { created } = await commitPaste(parentId, decided.proposal, { excluded: decided.excluded });
  state.expanded.add(parentId);
  await refresh();
  return toastOk(`اتعملت ${created} عقدة تحت ${parent?.title || 'السكريبت'}`);
}

async function openNodeMenu(nodeId) {
  const node = nodeById(nodeId);
  if (!node) return undefined;
  const isRoot = board.roots.some((row) => row.id === nodeId);
  const isLoose = board.looseTexts.some((row) => row.id === nodeId);

  const pick = await showModal({
    title: node.title,
    submitLabel: 'اقفل',
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <div class="ws-menu">
        <button type="button" data-m="rename">إعادة تسمية</button>
        <button type="button" data-m="inside">+ نصّ جوّه هنا</button>
        ${raw(isRoot ? '' : '<button type="button" data-m="after">+ نصّ بعد ده</button>')}
        ${raw(isRoot ? '' : '<button type="button" data-m="up">فوق</button>')}
        ${raw(isRoot ? '' : '<button type="button" data-m="down">تحت</button>')}
        ${raw(isRoot && isLoose
          ? '<button type="button" data-m="place">حطّه جوّه المكان الحالي</button>' : '')}
        ${raw(isRoot ? '' : '<button type="button" data-m="detach">طلّعه برّه الشجرة</button>')}
        <button type="button" data-m="hide">${node.hidden === 1 ? 'رجّعه' : 'اخفيه'}</button>
        <button type="button" class="danger" data-m="del">احذف</button>
      </div>`,
    onMount(root) {
      root.addEventListener('click', (event) => {
        const m = event.target.closest('[data-m]')?.dataset.m;
        if (m) root.closest('.overlay')?.__close?.(m);
      }, wired());
    },
  });
  if (!pick) return undefined;

  const org = await import('../services/organize-service.js');

  if (pick === 'rename') {
    const value = await showModal({
      title: 'إعادة تسمية',
      submitLabel: 'احفظ',
      body: html`<label class="fld"><span>الاسم</span>
        <input name="title" dir="auto" value="${node.title}"></label>`,
      onSubmit: async (data, close) => {
        await org.renameNode(nodeId, data.title);
        close();
      },
    });
    if (value === 'submit') await refresh();
    return undefined;
  }
  if (pick === 'inside' || pick === 'after') {
    state.targetId = nodeId;
    return openAddText(pick);
  }
  if (pick === 'up' || pick === 'down') {
    const parentId = parentOf(nodeId);
    if (parentId) await org.moveNode(parentId, nodeId, pick);
    await refresh();
    return undefined;
  }
  if (pick === 'place') {
    if (!state.targetId || state.targetId === nodeId) return toastError('اختار مكان الأول');
    await placeTextUnder(nodeId, state.targetId);
    await refresh();
    return toastOk('اتحطّ في الشجرة');
  }
  if (pick === 'detach') {
    const { detachToLoose } = await import('../services/workspace/workspace-service.js');
    await detachToLoose(nodeId, state.sceneId);
    await refresh();
    return toastOk('بقى نصّ سايب');
  }
  if (pick === 'hide') {
    await org.setNodeHidden(nodeId, node.hidden !== 1);
    await refresh();
    return undefined;
  }
  if (pick === 'del') {
    const kids = board.targetById.get(nodeId)?.children || 0;
    const go = await confirmAction({
      title: 'حذف النصّ',
      message: kids
        ? `تحت العقدة دي ${kids} عقدة. الحذف هيشيلها هي وكلّ اللي تحتها للسلّة.`
        : 'هيروح السلّة — تقدر ترجّعه.',
      confirmLabel: 'احذف',
      danger: true,
    });
    if (!go) return undefined;
    await org.removeNode(nodeId, { policy: org.DELETE_POLICY.CASCADE });
    if (state.targetId === nodeId) state.targetId = null;
    if (state.focus?.id === nodeId) state.focus = null;
    await refresh();
    return toastOk('اتشال — تلاقيه في السلّة');
  }
  return undefined;
}

/** تحريرُ نصّ عقدة — **عبر `updateScript`** فتُحفَظ نسخةٌ (بند ٦٠). */
async function editText(nodeId) {
  const node = nodeById(nodeId);
  if (!node) return undefined;

  const done = await showModal({
    title: `تحرير: ${node.title}`,
    wide: true,
    submitLabel: 'احفظ',
    body: html`
      <label class="fld"><span>العنوان</span>
        <input name="title" dir="auto" value="${node.title}"></label>
      <label class="fld"><span>النصّ</span>
        <textarea name="text" rows="16" dir="auto">${node.text || ''}</textarea></label>
      <p class="ws-note">الحفظ بيسجّل نسخة في تاريخ السكريبت — زيّ أيّ تعديل.</p>`,
    onSubmit: async (data, close) => {
      await saveNodeText(nodeId, { title: data.title, text: data.text });
      close();
    },
  });
  if (done === 'submit') { await refresh(); toastOk('اتحفظ'); }
  return undefined;
}

/* ================================================================== *
 * الشاشة
 * ================================================================== */

export async function renderWorkspace(main, sceneId) {
  freshWires();
  state.sceneId = sceneId;
  state.selection = new Set();
  state.expanded = new Set();
  state.perRoot = new Map();
  state.filter = 'all';
  state.query = '';
  state.treeQuery = '';
  state.previewQuery = '';
  state.pane = 'tree';
  state.focus = null;

  /* ⚠️ يُخفي المُشغّلَ العالميَّ — راجع سبب ذلك في `workspace.css`. */
  document.body.classList.add('workspace-open');

  board = await workspaceBoard(sceneId);
  if (!board) {
    main.innerHTML = '<p class="ws-empty">الذكرى دي مش موجودة</p>';
    return;
  }
  buildNodeIndex();
  state.rootId = board.roots[0]?.id || null;
  state.targetId = state.rootId;
  if (state.rootId) state.focus = { kind: 'text', id: state.rootId };

  main.innerHTML = html`
    <div class="ws" data-pane="tree">
      <header class="ws-top">
        <a class="ws-back" href="#/scene/${sceneId}" aria-label="رجوع للذكرى">‹</a>
        <h2 dir="auto">${board.scene.titleAr || 'ذكرى'}</h2>
        <span class="ws-exp">ورشة · تجريبي</span>
        <a class="ws-alt" href="#/organize/${sceneId}">وضع التنظيم</a>
      </header>

      <!-- التبويبات تظهر في العرض الضيّق وحدَه (بند ٧١). -->
      <nav class="ws-panes" role="tablist">
        <button type="button" data-ws="pane" data-v="tree" role="tab" class="on">الشجرة</button>
        <button type="button" data-ws="pane" data-v="desk" role="tab">المحتوى</button>
        <button type="button" data-ws="pane" data-v="preview" role="tab">المعاينة</button>
      </nav>

      <div class="ws-grid">
        <section class="ws-col ws-a" data-ws-roots>${raw(rootsHtml())}</section>
        <section class="ws-col ws-b" data-ws-tree>${raw(treeHtml())}</section>
        <section class="ws-col ws-c" data-ws-desk>${raw(deskHtml())}</section>
        <section class="ws-col ws-d" data-ws-preview>${raw(previewHtml())}</section>
      </div>

      <div class="ws-now" data-ws-now hidden></div>
      <div class="ws-bar" data-ws-bar>${raw(barHtml())}</div>
    </div>`;

  /*
   * ⚠️ **مستمعٌ واحدٌ مفوَّضٌ على الشاشة** — وكلُّه يأخذ إشارةَ القطع،
   *    لأن الشاشةَ تُغادَر ويجب أن يموت معها (نفسُ انضباط الظلّ).
   */
  main.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-ws]');
    if (!btn) return;
    const act = btn.dataset.ws;
    const id = btn.dataset.id;

    switch (act) {
      case 'pane': state.pane = btn.dataset.v; return paintPane();
      case 'root': return selectRoot(id);
      case 'node': return selectNode(id);
      case 'node-menu': return openNodeMenu(id);

      case 'twist': {
        if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
        return paintTree();
      }

      case 'focus': {
        const kind = btn.dataset.kind;
        if (kind === 'text') { return selectNode(id); }
        state.focus = { kind, id };
        paintDesk(); paintPreview();
        if (window.matchMedia('(max-width: 899px)').matches) { state.pane = 'preview'; paintPane(); }
        return undefined;
      }

      case 'play': return playItem(id);
      case 'toggle': return audio.state.playing ? audio.pause() : audio.play();
      case 'zoom': return openLightbox(id, state.sceneId);

      case 'pick': {
        if (state.selection.has(id)) state.selection.delete(id); else state.selection.add(id);
        /* ⚠️ لمسةُ اختيارٍ تبدّل بطاقةً وشريطًا — لا تعيد رسمَ المكتب. */
        const card = main.querySelector(`[data-ws-card="${id}"]`);
        card?.classList.toggle('is-picked', state.selection.has(id));
        btn.classList.toggle('on', state.selection.has(id));
        btn.setAttribute('aria-checked', state.selection.has(id) ? 'true' : 'false');
        btn.textContent = state.selection.has(id) ? '✓' : '';
        return paintBar();
      }

      case 'filter': state.filter = btn.dataset.v; return paintDesk();
      case 'pmode': state.previewMode = btn.dataset.v; return paintPreview();

      case 'link-selected': return linkThese([...state.selection]);
      case 'link-current': {
        const now = audio.state.mediaId;
        if (!now) return toastError('مفيش صوت شغّال');
        return linkThese([now]);
      }
      case 'clear-pick': {
        state.selection.clear();
        paintDesk(); return paintBar();
      }
      case 'unlink': {
        await unlinkOne(id, board);
        await refresh();
        return toastOk('اتفكّ الربط');
      }

      case 'add': return openAddMenu();
      case 'add-text-here': return openAddText('inside');
      case 'new-root': {
        const made = await showModal({
          title: 'سكريبت رئيسي جديد',
          submitLabel: 'اعمله',
          body: html`<label class="fld"><span>الاسم</span>
            <input name="title" dir="auto" placeholder="مثلاً: مراجعة الجمارك"></label>`,
          onSubmit: async (data, close) => {
            const row = await createMainScript(state.sceneId, { title: data.title });
            state.rootId = row.id;
            state.targetId = row.id;
            state.focus = { kind: 'text', id: row.id };
            close();
          },
        });
        if (made === 'submit') { await refresh(); toastOk('اتعمل — تقدر تلصق فيه دلوقتي'); }
        return undefined;
      }

      case 'edit-text': return editText(id);
      case 'shadow': {
        const { openShadowForScript } = await import('../services/shadow/shadow-entry.js');
        return openShadowForScript(id, state.sceneId);
      }
      default: return undefined;
    }
  }, wired());

  /* البحثُ يعيد رسمَ لوحِه وحدَه — فلا يضيع تمريرُ غيره (بند ٧٤). */
  main.addEventListener('input', (event) => {
    if (event.target.matches('[data-ws-tree-find]')) {
      state.treeQuery = event.target.value;
      paintTree();
      $('[data-ws-tree-find]')?.focus();
      return;
    }
    if (event.target.matches('[data-ws-desk-find]')) {
      state.query = event.target.value;
      const list = $('[data-ws-desk] .ws-cards');
      if (list) list.innerHTML = deskItems().map(cardHtml).join('');
      return;
    }
    if (event.target.matches('[data-ws-prev-find]')) {
      state.previewQuery = event.target.value;
      const body = $('[data-ws-prev-body]');
      if (!body) return;
      const node = nodeById(state.focus?.id);
      if (!node) return;
      const text = node.text || '';
      body.innerHTML = looksLikeDialogue(text) && state.previewMode === 'chat'
        ? chatHtml(text)
        : `<pre class="ws-raw" dir="auto">${withMarks(text, state.previewQuery)}</pre>`;
    }
  }, wired());

  /* شريطُ السماع: تمريرُ الموضع. */
  main.addEventListener('pointerdown', (event) => {
    const track = event.target.closest('[data-ws="seek"]');
    if (!track) return;
    const box = track.getBoundingClientRect();
    /* ⚠️ في RTL يبدأ الشريطُ من اليمين — والنسبةُ تُحسَب من `right`. */
    const rtl = getComputedStyle(track).direction === 'rtl';
    const ratio = rtl
      ? (box.right - event.clientX) / box.width
      : (event.clientX - box.left) / box.width;
    audio.seekRatio(Math.max(0, Math.min(1, ratio)));
  }, wired());

  /*
   * ⚠️ **الشريطُ مشتركٌ لا مالك** (بند ٧٥): يرسم ما تقوله الخدمة،
   *    ولا يملك عنصرَ الصوت — فلا يستطيع أن يوقفه بإعادة رسم.
   */
  stopAudioWatch = subscribeAudio((snapshot) => paintNow(snapshot));
  paintPane();
}

/**
 * يُنعش الورشةَ **في مكانها** — بلا إعادة رسمٍ من الصفر.
 *
 * ⚠️ تُنادى من `ui-state` بعد رفعِ ملفٍّ أو إغلاق عارض. و`renderWorkspace`
 *    لا تصلح هنا: هي تُصفّر المحدَّدَ والمكانَ والفلترَ والتمرير — أي
 *    تعاقبك على أنك أضفتَ صورة.
 */
export async function reloadWorkspace() {
  if (!board || !state.sceneId) return;
  await refresh();
}

export function disposeWorkspace() {
  document.body.classList.remove('workspace-open');
  wires?.abort();
  wires = null;
  stopAudioWatch?.();
  stopAudioWatch = null;
  board = null;
  /*
   * ⚠️ **ولا يُوقَف الصوت عند المغادرة.** هو خدمةٌ عامّةٌ منذ WS28،
   *    وإيقافُه هنا يكسر «الصوت يكمل والتابلت مقفول» (WS51).
   */
  releaseUrls();
}

/** ⚠️ للتجربة الميدانيّة وحدَها — لا يُنادى من الواجهة. */
export const __wsf = { state, selectNode, selectRoot, playItem, linkThese, refresh };

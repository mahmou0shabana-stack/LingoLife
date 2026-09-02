/**
 * LingoLife — ورشةُ المحتوى الموحَّدة (WS-P · إعادةُ بناء التفاعل)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **العطبُ لم يكن في البيانات — كان في تقسيم الشاشة** (بندا ١ و٣٣)
 * ═══════════════════════════════════════════════════════════════
 *
 * الشاشةُ السابقة كانت أربعةَ أعمدةٍ متجاورةٍ لها **نفسُ الوزن البصريّ**:
 * السكريبتات · الشجرة · المحتوى · المعاينة. وقياسٌ حقيقيٌّ على مقاس
 * التابلت (١٢٨٠×٨٠٠) قال الحكمَ بلا مجاملة:
 *
 *     .ws-a 168px · .ws-b 252px · .ws-c 265px · .ws-d **340px**
 *
 * أي أنّ **المستندَ — وهو سببُ وجود الشاشة كلِّها — كان يأخذ ٢٧٪ من
 * العرض**، والبنيةُ والأدوات تأخذ ٧٣٪. وهذا ليس نقصَ ذوقٍ بصريّ: هو
 * متصفّحُ قاعدةِ بياناتٍ لا مساحةُ عمل.
 *
 * فالمبدأُ الذي تُقاس به كلُّ سطرٍ تحت (بند ٢):
 *
 *     البنيةُ توصِّلك إلى المحتوى.
 *     المحتوى هو الشيءُ نفسُه.
 *     الأدواتُ السياقيّةُ تخدمه **حين تُطلَب**.
 *
 * فلا تتساوى الثلاثةُ في الوزن أبدًا: مُتصفِّحٌ واحدٌ هرميّ، ومساحةُ
 * عملٍ مسيطرة، ومُفتِّشٌ يُفتَح ويُغلَق — **وحين يُغلَق يسترجع المستندُ
 * عرضَه فورًا، ولا يبقى عمودٌ ميّتٌ محجوز** (بند ٦).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ثلاثةُ أوضاعٍ مسمّاةٍ بدل حالاتٍ ضمنيّة** (بند ٥)
 * ═══════════════════════════════════════════════════════════════
 *
 * «تحرير» كان نافذةً منبثقة، و«ربط» كان عنصرًا ممسوكًا في شريطٍ سفليّ.
 * أي أنّ وضعَك الحاليَّ كان يُستنتَج من وجود نافذةٍ أو امتلاء شريط —
 * والمُستنتَجُ لا يُعرَض ولا يُحفَظ ولا يُختبَر.
 *
 * وهنا: **قراءة · تحرير · ربط**، والتبديلُ بينها لا يفقد شيئًا — لا
 * التحديدَ ولا التمريرَ ولا المسوّدةَ ولا فروعَ الشجرة المفرودة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وما لم يتغيّر حرفًا — عمدًا** (بندا ٢٢ و٣٥)
 * ═══════════════════════════════════════════════════════════════
 *
 *   • النموذج: `scripts` و`relationships` و`media` كما هي. لا مخزنَ
 *     جديد، ولا ترقية، ولا نسخةَ سجلٍّ لتسهيل العرض.
 *   • الصوت: `audio-service` تملك `<audio>` الوحيد خارج الشاشات
 *     (WS28). هذه الشاشةُ **مشتركةٌ ترسم حالتَها** ولا تملك عنصرًا —
 *     فإعادةُ الرسم لا تقطع التشغيل، ولا يمكنها ذلك.
 *   • اللصقُ الذكيّ والمحادثاتُ والوسائطُ والظلُّ: نفسُ الخدمات، نفسُ
 *     الدوالّ. ما استُخرِج منها استُخرِج إلى `workspace-ui.js` **قبل**
 *     حذف حاويته البصريّة (بند ٠).
 */

import { html, raw, esc, formatDuration, formatBytes } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { showModal, confirmAction } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import {
  urlFor, releaseUrls, AUDIO_ROLE_LABEL, addFilesToScene, pickFiles,
  isCloudOnly, ensureBytes, setCaption,
} from '../services/media-service.js';
import { api as audio, subscribe as subscribeAudio } from '../services/audio-service.js';
import { openLightbox } from '../components/lightbox.js';
import {
  audioButtonHtml, refreshAudioButtons, playIntent,
} from '../components/audio-button.js';
import {
  workspaceBoard, linkSelection, unlinkOne,
  createMainScript, addLooseText, placeTextUnder, addTextAt, saveNodeText,
  commitPaste, conflictsFor, NODE_KIND_LABEL,
} from '../services/workspace/workspace-service.js';
import { conversationModel, looksLikeDialogue } from '../services/workspace/speaker-parser.js';
import {
  MODE, MODE_LABEL, TAB, TAB_LABEL, SAVE, SAVE_LABEL,
  makeDraft, draftChanged, draftCommitted,
  navRows, ancestorsOf, crumbsOf, mediaOf, linkRowsFor,
  MEDIA_FILTERS, mediaLibrary, PANE, paneFit, NAV_MAX_ROWS,
} from '../services/workspace/workspace-ui.js';
import {
  effectivePanes, writePanePrefs, readChromePrefs, writeChromePrefs,
} from '../services/workspace/pane-prefs.js';

/* ================================================================== *
 * الحالة
 * ================================================================== */

/**
 * ⚠️ **كلُّها حالةُ جلسةٍ عابرة — ولا سطرَ منها يُحفَظ** (بند ٤٩ من
 *    WS-F): «أين كنتَ واقفًا» و«ما في يدك» لو عادا بعد يومين أرجعاك
 *    إلى سياقٍ لم تعُد فيه، وضغطةٌ واحدةٌ حينها تكتب في القاعدة بهدفٍ
 *    نسيتَه. والاستثناءُ الوحيدُ عرضُ اللوحين — تفضيلٌ بصريٌّ لا يوجّه
 *    فعلًا (راجع `pane-prefs.js`).
 */
const state = {
  sceneId: null,
  /** المستندُ المفتوح: `{ kind: 'text'|'audio'|'image', id }`. */
  open: null,
  mode: MODE.READ,
  /** مسوّدةُ التحرير — تعيش عبر تبديل الأوضاع (بند ٥). */
  draft: null,
  expanded: new Set(),
  /** كم صفًّا مفرودًا تحت كلّ أبٍ الآن (بند ١٥). */
  shown: new Map(),
  navQuery: '',
  /** ⚠️ سقفُ الصفوف الحاليّ — يرتفع بطلبك، ويعود لأصله مع كلّ بحثٍ جديد. */
  navBudget: NAV_MAX_ROWS,
  docQuery: '',
  /** «نصّ» أو «محادثة» — لنصٍّ يبدو حوارًا (بند ٤). */
  docMode: 'chat',
  inspector: false,
  tab: TAB.LINKS,
  zen: false,
  /** درجٌ مفتوحٌ في العرض الضيّق: `'nav'` أو `'insp'` أو `null` (بند ٨). */
  drawer: null,
  mediaFilter: 'unlinked',
  mediaQuery: '',
  /** تحديدُ مُلتقِط الربط — دفعةٌ واحدةٌ تُربَط معًا (بند ١٨). */
  picked: new Set(),
  scroll: { nav: 0, doc: 0, insp: 0 },
  docScroll: { text: 0, chat: 0 },
  panes: { nav: PANE.NAV_DEFAULT, insp: PANE.INSP_DEFAULT },
  /** شكلُ الشريط العامّ وظهورُ العائمات داخل الورشة (بندا ٤ و١١). */
  chrome: { rail: 'compact', fabs: false },
  loading: false,
  error: null,
  /** جلبُ بايتات وسيطٍ من Drive — حالةٌ حقيقيّةٌ لا شريطُ زينة (بند ١٤). */
  fetching: new Set(),
};

let board = null;
let wires = null;
let stopAudioWatch = null;
let savedTimer = null;

const freshWires = () => { wires?.abort(); wires = new AbortController(); };
const wired = (extra = {}) => ({ ...extra, signal: wires?.signal });

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ================================================================== *
 * مساعداتُ عرض
 * ================================================================== */

/**
 * ⚠️ **فاصلُ المسار نقطةٌ وسطى لا سهم** (بند ٩): `›` محرفٌ ذو اتجاهٍ
 *    ينقلب في السياق العربيّ فيُقرأ فاصلة. و`·` محايدةٌ ثنائيّةُ
 *    الاتجاه، تُقرأ كما هي في الاتّجاهين.
 */
const SEP = ' · ';
const pathOf = (id) => board?.targetById.get(id)?.path.join(SEP) || null;

const itemTitle = (item) => {
  if (item?.caption) return item.caption;
  if (item?.kind === 'audio') return AUDIO_ROLE_LABEL[item.role] || 'تسجيل';
  return 'صورة';
};

const nodeKindLabel = (kind) => NODE_KIND_LABEL[kind] || '';

/**
 * سطرُ بياناتٍ مفصولٌ بنقطةٍ محايدة.
 *
 * ⚠️ **وسمُ `html` يهرّب كلَّ قيمةٍ وحدَه** — فلا `esc` هنا ولا هناك.
 *    الفاصلُ وحدَه علامةٌ حرفيّةٌ نكتبها، والقيمُ تمرّ بالوسم.
 */
const factsRow = (facts) => facts
  .map((one) => html`<span>${one}</span>`)
  .join('<i aria-hidden="true">·</i>');

/** يبرز مواضعَ البحث داخل نصٍّ مهرَّب — بحثٌ محلّيٌّ خفيف. */
function withMarks(text, query) {
  const safe = esc(text);
  const needle = (query || '').trim();
  if (!needle) return safe;
  const parts = esc(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(parts, 'gi'), (hit) => `<mark>${hit}</mark>`);
}

/**
 * فهرسُ السجلّات الحقيقيّة: المعرّف → السجلّ.
 *
 * ⚠️ **يُبنى مرّةً عند القراءة لا عند كلّ لمسة** (بند ١٥). أوّلُ صياغةٍ
 *    كتبتُها كانت تمشي الشجرةَ كلَّها في كلّ مرّةٍ تسأل «فين العقدة
 *    دي؟» — ورسمُ صفحةٍ واحدةٍ يسأل ذلك عشراتِ المرّات. على أربعة آلاف
 *    عقدةٍ يصير الرسمُ الواحدُ مئاتِ الآلاف من الخطوات، وهو بالضبط
 *    O(n²) الذي يمنعه البند.
 */
let recordIndex = new Map();

function buildIndex() {
  const index = new Map();
  if (!board) { recordIndex = index; return; }
  for (const row of board.roots) index.set(row.id, row);
  const walk = (rows) => {
    for (const row of rows) { index.set(row.node.id, row.node); walk(row.children); }
  };
  for (const list of board.treeByRoot.values()) walk(list);
  for (const row of board.audio) index.set(row.id, row);
  for (const row of board.images) index.set(row.id, row);
  recordIndex = index;
}

/* ⚠️ الوسائطُ وحدَها لها `kind`؛ والسكريبتاتُ لها `nodeKind`. فلا يلتبسان. */
const nodeById = (id) => {
  const row = id ? recordIndex.get(id) : null;
  return row && row.kind !== 'audio' && row.kind !== 'image' ? row : null;
};

const mediaById = (id) => {
  const row = id ? recordIndex.get(id) : null;
  return row && (row.kind === 'audio' || row.kind === 'image') ? row : null;
};

/** العنصرُ المفتوحُ أيًّا كان نوعُه — أو `null` إن اختفى من القاعدة. */
function openRecord() {
  if (!state.open) return null;
  return state.open.kind === 'text' ? nodeById(state.open.id) : mediaById(state.open.id);
}

/* ================================================================== *
 * أ · المُتصفِّح الهرميّ الواحد (بند ٣)
 * ================================================================== */

/**
 * زرُّ الإنشاء السياقيّ — **اسمُه يقول نطاقَه** (بندا ٣ و١٧).
 *
 * ⚠️ **ولا ثلاثةُ أزرارٍ اسمُها «+ أضف» بنطاقاتٍ مختلفة.** الشاشةُ
 *    القديمة كان فيها `add` و`add-kind` و`add-text-here` و`new-root` —
 *    أربعةُ أزرارٍ متشابهةٍ لا يقول أيٌّ منها **أين** سيقع ما تضيفه.
 */
function addScopeLabel() {
  const at = state.open?.kind === 'text' ? board.targetById.get(state.open.id) : null;
  if (!at) return { label: '+ إضافة سكريبت', where: null };
  if (at.depth === 0) return { label: '+ إضافة جزء', where: at };
  return { label: '+ إضافة محتوى', where: at };
}

function navHeadHtml() {
  const add = addScopeLabel();
  return html`
    <div class="ws-nav-head">
      <div class="ws-nav-search">
        ${raw(icon('search', 16))}
        <input class="ws-input" data-ws-nav-find type="search" dir="auto"
               aria-label="دوّر في السكريبتات والنصّ"
               placeholder="دوّر في العناوين والنصّ…" value="${state.navQuery}">
        ${raw(state.navQuery ? html`
          <button type="button" class="ws-clear" data-ws="nav-clear"
                  aria-label="امسح البحث">${raw(icon('close', 14))}</button>` : '')}
      </div>
      <button type="button" class="ws-btn ws-btn-soft ws-nav-add" data-ws="add"
              title="${add.where ? `جوّه: ${add.where.path.join(SEP)}` : 'سكريبت رئيسي جديد'}">
        ${add.label}
      </button>
    </div>`;
}

function navRowHtml(row) {
  if (row.type === 'group') {
    return html`
      <li class="ws-nav-group" role="presentation">
        <span>${row.label}</span>
        <span class="ws-nav-group-n">${row.count}</span>
        ${raw(row.key === 'scripts' ? html`
          <button type="button" class="ws-icon-btn" data-ws="new-root"
                  aria-label="سكريبت رئيسي جديد">${raw(icon('plus', 15))}</button>` : '')}
      </li>`;
  }

  if (row.type === 'limit') {
    /*
     * ⚠️ **والمخفيُّ يُعلَن بعدده لا يُحذَف صامتًا** (بندا ١٥ و٢٣):
     *    «٤٠٠ من ٢١١٠» تقول لك أنّ بحثَك واسعٌ وأنّ ما تراه جزء —
     *    و«٤٠٠ نتيجة» وحدَها كذبةٌ بالحذف.
     */
    return html`
      <li class="ws-nav-limit">
        <span role="status">بيتعرض ${row.shown} من ${row.shown + row.hidden}</span>
        <!--
          ⚠️ **«فيه ١٧١٠ مخفيّة» بلا بابٍ إليها ليس إعلامًا — هو حائط**
             (WS-P2 · بند ٢٩). فالعددُ يبقى صادقًا، ويصير معه طريقٌ:
             تُوسِّع البحثَ صفحةً صفحة، أو تضيّقه بكلمةٍ أدقّ. والاثنان
             يصلان إلى العنصر بعينه — والرسالةُ وحدَها لا تصل.
        -->
        <button type="button" data-ws="nav-more-rows">
          عرِّضني ${Math.min(row.hidden, NAV_MAX_ROWS)} كمان
        </button>
      </li>`;
  }

  if (row.type === 'more') {
    /*
     * ⚠️ **والعددُ الباقي حقيقيٌّ لا «المزيد»** (بند ٢٣): «+ ٣٨٤٠ كمان»
     *    تقول لك حجمَ ما تحت إصبعك؛ و«المزيد» لا تقول شيئًا.
     */
    return html`
      <li class="ws-nav-more" style="--ws-d:${row.depth}">
        <button type="button" data-ws="nav-more" data-id="${row.parentId}">
          + ${row.remaining} كمان (من ${row.total})
        </button>
      </li>`;
  }

  const on = state.open?.kind === 'text' && state.open.id === row.id;
  const t = row.target;
  const media = t ? t.own.audio + t.own.images : 0;
  const under = t ? t.sub.audio + t.sub.images : 0;

  return html`
    <li class="ws-nav-row ${on ? 'is-on' : ''} ${row.hidden ? 'is-hidden' : ''}
               ${row.hit ? 'is-hit' : ''}"
        style="--ws-d:${row.depth}" role="none">
      <button type="button" class="ws-twist ${row.hasKids ? '' : 'is-leaf'}"
              data-ws="twist" data-id="${row.id}" tabindex="-1"
              aria-hidden="${row.hasKids ? 'false' : 'true'}"
              aria-label="${row.open ? 'اطوِ' : 'افرد'}">${row.hasKids ? (row.open ? '▾' : '▸') : ''}</button>
      <button type="button" class="ws-nav-item" data-ws="nav-node" data-id="${row.id}"
              title="${row.title}"
              role="treeitem" aria-level="${row.depth + 1}" aria-selected="${on ? 'true' : 'false'}"
              ${row.hasKids ? `aria-expanded="${row.open ? 'true' : 'false'}"` : ''}>
        <span class="ws-nav-face" aria-hidden="true">${raw(icon(row.root ? 'book' : 'script', 15))}</span>
        <span class="ws-nav-t" dir="auto">${row.title}</span>
        <span class="ws-nav-meta">
          <!--
            ⚠️ **ولا كلمةُ «جزء» بجوار أيقونة الجزء** (بند ١٠): إشارتان
               تقولان الشيءَ نفسَه، والثمنُ مقيس — على مُتصفِّحٍ عرضُه
               ٢٨٠px كانت «PART 1 — المفردات الأساسية» تُقَصّ إلى
               «PART 1 — ...ساسية». والنوعُ مكتوبٌ كاملًا في رأس المستند
               وفي «الخصائص»، فمكانُه هناك لا هنا.
          -->
          <!--
            ⚠️ **العدُّ المباشرُ والتراكميُّ لا يُخلَطان** (بند ٢٣): «٢ عليها»
               ما عُلِّق على العقدة نفسِها، و«+٧ تحتها» ما في أبنائها.
               ورقمٌ واحدٌ يجمعهما لا يقول أيَّهما.
          -->
          ${raw(media ? html`<b title="مربوط بالعقدة دي">${media}</b>` : '')}
          ${raw(under ? html`<em title="مربوط بما تحتها">+${under}</em>` : '')}
          ${raw(row.hidden ? '<u>مخفيّة</u>' : '')}
        </span>
      </button>
      <button type="button" class="ws-icon-btn ws-nav-more-btn" data-ws="node-menu"
              data-id="${row.id}" aria-label="خيارات ${row.title}">⋯</button>
    </li>`;
}

function navHtml() {
  if (state.error) {
    return html`
      ${raw(navHeadHtml())}
      <div class="ws-fail">
        <p>مقدرتش أقرا محتوى الذكرى.</p>
        <p class="ws-fail-why" dir="auto">${state.error}</p>
        <button type="button" class="ws-btn" data-ws="retry-load">حاوِل تاني</button>
      </div>`;
  }
  if (state.loading && !board) {
    return html`<div class="ws-load" role="status">
      <span class="ws-spin" aria-hidden="true"></span> بيحمّل المحتوى…</div>`;
  }

  const { rows, hits } = navRows(board, {
    expanded: state.expanded, query: state.navQuery, shown: state.shown,
    budget: state.navBudget,
  });

  const empty = state.navQuery
    ? html`<div class="ws-empty">
        <p>مفيش نتيجة لـ «${state.navQuery.trim()}»</p>
        <button type="button" class="ws-btn ws-btn-soft" data-ws="nav-clear">امسح البحث</button>
      </div>`
    : html`<div class="ws-empty">
        <p>الذكرى دي لسّه مفيهاش سكريبتات</p>
        <button type="button" class="ws-btn" data-ws="new-root">+ إضافة سكريبت</button>
      </div>`;

  return html`
    ${raw(navHeadHtml())}
    ${raw(state.navQuery
      ? html`<p class="ws-nav-hits" role="status">${hits} نتيجة</p>` : '')}
    <ul class="ws-nav-list" role="tree" aria-label="سكريبتات الذكرى">
      ${raw(rows.map(navRowHtml).join(''))}
    </ul>
    ${raw(rows.some((row) => row.type === 'item') ? '' : empty)}`;
}

/* ================================================================== *
 * ب · مساحةُ العمل — المستند (بند ٤)
 * ================================================================== */

/**
 * يرسم نصًّا محادثةً — **بلا مساسٍ بالمخزَّن** (بند ٢٢).
 *
 * ⚠️ **والدَّورُ يبقى كتلةً واحدةً مهما تعدّدت فقراتُه.** قطعُ كلِّ سطرٍ
 *    فقاعةً يحوّل شرحًا متّصلًا إلى رشقاتٍ لا تُقرأ.
 */
function chatHtml(text) {
  /*
   * ⚠️ **تحليلٌ واحدٌ لا واحدٌ لكلّ دور**: `conversationModel` تُنادى
   *    مرّةً هنا، والرسمُ من ناتجها. ومئةُ دورٍ لا تعني مئةَ تحليل.
   */
  const turns = conversationModel(text);
  const q = state.docQuery;

  return html`
    <div class="ws-chat">
      ${raw(turns.map((turn) => {
        if (!turn.speaker) {
          return html`<div class="ws-chat-pre">
            ${raw(turn.paragraphs.map((para) => html`
              <p dir="${para.dir}">${raw(withMarks(para.text, q))}</p>`).join(''))}
          </div>`;
        }
        return html`
          <div class="ws-turn" data-sp="${turn.speaker}"
               data-side="${Number(turn.speaker) % 2 === 0 ? 'b' : 'a'}">
            <span class="ws-turn-who">المتحدث ${turn.speaker}</span>
            <div class="ws-turn-body">
              <!--
                ⚠️ **اتّجاهٌ لكلّ فقرة** (بند ٩): فقرةٌ روسيّةٌ وأخرى عربيّةٌ
                   في نفس الدَّور، وفرضُ اتّجاهٍ واحدٍ يقذف النقطةَ إلى أوّل
                   السطر. ولا تُفرَض محاذاةٌ عربيّةٌ على فقرةٍ روسيّة.
              -->
              ${raw(turn.paragraphs.map((para) => html`
                <p dir="${para.dir}" lang="${para.dir === 'ltr' ? 'ru' : 'ar'}"
                   >${raw(withMarks(para.text, q))}</p>`).join(''))}
            </div>
          </div>`;
      }).join(''))}
    </div>`;
}

/** حالةُ الحفظ — شارةٌ هادئةٌ دائمةٌ جنبَ العنوان (بند ١٣). */
function saveBadgeHtml() {
  const d = state.draft;
  if (!d || state.open?.kind !== 'text' || d.id !== state.open.id) return '';
  const status = d.status === SAVE.CLEAN && draftChanged(d) ? SAVE.DIRTY : d.status;
  return html`
    <span class="ws-save is-${status}" data-ws-save role="status" aria-live="polite">
      ${raw(status === SAVE.SAVING ? '<span class="ws-spin" aria-hidden="true"></span> ' : '')}
      ${SAVE_LABEL[status]}
    </span>`;
}

function crumbHtml() {
  if (state.open?.kind !== 'text') {
    const item = openRecord();
    return html`<nav class="ws-crumbs" aria-label="المسار">
      <button type="button" class="ws-crumb" data-ws="tab-media">الوسائط</button>
      <span class="ws-crumb-sep" aria-hidden="true">·</span>
      <span class="ws-crumb is-now" dir="auto">${item ? itemTitle(item) : '—'}</span>
    </nav>`;
  }

  const crumbs = crumbsOf(board, state.open.id);
  return html`
    <nav class="ws-crumbs" aria-label="المسار">
      ${raw(crumbs.map((one, i) => html`
        ${raw(i ? '<span class="ws-crumb-sep" aria-hidden="true">·</span>' : '')}
        ${raw(one.current
          ? html`<span class="ws-crumb is-now" dir="auto">${one.title}</span>`
          : html`<button type="button" class="ws-crumb" data-ws="nav-node"
                         data-id="${one.id}" dir="auto">${one.title}</button>`)}`).join(''))}
    </nav>`;
}

function modeSwitchHtml() {
  const kinds = state.open?.kind === 'text'
    ? [MODE.READ, MODE.EDIT, MODE.LINK]
    : [MODE.READ, MODE.LINK];
  return html`
    <div class="ws-modes" role="tablist" aria-label="وضع الشغل">
      ${raw(kinds.map((one) => html`
        <button type="button" class="ws-mode ${state.mode === one ? 'is-on' : ''}"
                role="tab" aria-selected="${state.mode === one ? 'true' : 'false'}"
                data-ws="mode" data-v="${one}">${MODE_LABEL[one]}</button>`).join(''))}
    </div>`;
}

function docHeadHtml() {
  if (!state.open) return '';
  const record = openRecord();
  if (!record) {
    return html`<div class="ws-doc-head">
      <div class="ws-doc-title"><h2>العنصر ده مابقاش موجود</h2></div>
    </div>`;
  }

  const isText = state.open.kind === 'text';
  const target = isText ? board.targetById.get(state.open.id) : null;
  const title = isText ? record.title : itemTitle(record);

  const facts = [];
  if (isText && target) {
    if (nodeKindLabel(target.kind)) facts.push(nodeKindLabel(target.kind));
    facts.push(`${target.chars} حرف`);
    if (target.children) facts.push(`${target.children} تحتها`);
    if (target.own.audio) facts.push(`${target.own.audio} صوت`);
    if (target.own.images) facts.push(`${target.own.images} صورة`);
    if (target.hidden) facts.push('مخفيّة');
  } else if (record.kind === 'audio') {
    facts.push(record.durationMs ? formatDuration(record.durationMs) : 'مدّة مش معروفة');
    facts.push(AUDIO_ROLE_LABEL[record.role] || 'مش متصنّف');
    if (record.bytes) facts.push(formatBytes(record.bytes));
    if (isCloudOnly(record)) facts.push('على Drive بس');
  } else {
    if (record.bytes) facts.push(formatBytes(record.bytes));
    if (isCloudOnly(record)) facts.push('على Drive بس');
  }

  return html`
    <div class="ws-doc-head">
      ${raw(crumbHtml())}
      <div class="ws-doc-title">
        <h2 dir="auto">${title}</h2>
        ${raw(saveBadgeHtml())}
      </div>
      <div class="ws-doc-facts">
        ${raw(factsRow(facts))}
      </div>
      <div class="ws-doc-bar">
        ${raw(modeSwitchHtml())}
        <div class="ws-doc-acts">
          ${raw(state.mode === MODE.EDIT ? html`
            <button type="button" class="ws-btn ws-btn-primary" data-ws="save">احفظ</button>` : '')}
          ${raw(isText && state.mode !== MODE.EDIT ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="shadow"
                    data-id="${state.open.id}">تدرّب</button>` : '')}
          ${raw(!isText && record.kind === 'image' ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="zoom"
                    data-id="${record.id}">كبّر</button>` : '')}
          ${raw(!isText ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="rename-media"
                    data-id="${record.id}">سمّيه</button>` : '')}
          <button type="button" class="ws-btn ws-btn-soft ws-insp-toggle" data-ws="insp"
                  aria-expanded="${state.inspector ? 'true' : 'false'}"
                  aria-controls="ws-inspector">
            ${raw(icon('link', 15))} <span>المُفتِّش</span>
          </button>
        </div>
      </div>
    </div>`;
}

/** سطحُ المستند: نصٌّ · محادثةٌ · محرّرٌ · صوتٌ · صورة (بند ٤). */
function docBodyHtml() {
  if (state.error) {
    return html`<div class="ws-fail" role="alert">
      <p>مقدرتش أفتح المحتوى.</p>
      <p class="ws-fail-why" dir="auto">${state.error}</p>
      <button type="button" class="ws-btn" data-ws="retry-load">حاوِل تاني</button>
    </div>`;
  }
  if (state.loading && !board) {
    return html`<div class="ws-load" role="status">
      <span class="ws-spin" aria-hidden="true"></span> بيحمّل…</div>`;
  }
  if (!state.open) {
    return html`<div class="ws-empty ws-empty-doc">
      <p>اختار سكريبت أو جزء من الشمال عشان تشتغل عليه.</p>
    </div>`;
  }

  const record = openRecord();
  if (!record) {
    /*
     * ⚠️ **وعقدةٌ اختفت ومعك فيها مسوّدةٌ لا يجوز أن تبتلع كلامَك**
     *    (بندا ١٣ و٢٦): الحذفُ قد يأتي من جهازٍ آخر أثناء كتابتك.
     *    فيُقال ما حدث، ويبقى ما كتبتَه **معروضًا وقابلًا للنسخ** —
     *    لا يُمحى بصمتٍ مع السجلّ الذي ذهب.
     */
    const lost = state.draft && draftChanged(state.draft) ? state.draft : null;
    return html`
      <div class="ws-fail" role="alert">
        <p>العنصر اللي كان مفتوح مابقاش موجود — يمكن اتشال أو اتنقل.</p>
        ${raw(lost ? html`
          <p class="ws-fail-why">اللي كتبتَه لسّه هنا — انسخه قبل ما تسيب الصفحة.</p>
          <textarea class="ws-area" readonly dir="auto">${lost.text}</textarea>` : '')}
      </div>`;
  }

  if (state.open.kind === 'audio') return audioDocHtml(record);
  if (state.open.kind === 'image') return imageDocHtml(record);
  if (state.mode === MODE.EDIT) return editorHtml(record);
  return textDocHtml(record);
}

function textDocHtml(node) {
  const text = node.text || '';
  const dialogue = looksLikeDialogue(text);
  const mode = dialogue && state.docMode === 'chat' ? 'chat' : 'text';

  if (!text.trim()) {
    return html`
      <div class="ws-empty ws-empty-doc">
        <p>العقدة دي لسّه مفيهاش نصّ.</p>
        <button type="button" class="ws-btn" data-ws="mode" data-v="${MODE.EDIT}">اكتب فيها</button>
      </div>`;
  }

  return html`
    <div class="ws-doc-tools">
      ${raw(dialogue ? html`
        <div class="ws-seg" role="tablist" aria-label="شكل العرض">
          <button type="button" role="tab" aria-selected="${mode === 'text' ? 'true' : 'false'}"
                  class="${mode === 'text' ? 'is-on' : ''}" data-ws="dmode" data-v="text">نصّ</button>
          <button type="button" role="tab" aria-selected="${mode === 'chat' ? 'true' : 'false'}"
                  class="${mode === 'chat' ? 'is-on' : ''}" data-ws="dmode" data-v="chat">محادثة</button>
        </div>` : '')}
      <div class="ws-doc-find">
        ${raw(icon('search', 15))}
        <input class="ws-input" data-ws-doc-find type="search" dir="auto"
               aria-label="دوّر جوّه النصّ" placeholder="دوّر جوّه النصّ…"
               value="${state.docQuery}">
      </div>
    </div>
    <article class="ws-paper" data-ws-paper>
      ${raw(mode === 'chat' ? chatHtml(text)
        : html`<pre class="ws-raw" dir="auto">${raw(withMarks(text, state.docQuery))}</pre>`)}
    </article>`;
}

/**
 * المحرّرُ **داخل الصفحة** لا نافذةً (بندا ٥ و١٣).
 *
 * ⚠️ **ولا يُعاد رسمُ هذا الحقلُ عند كلّ حرف.** المسوّدةُ تُحدَّث في
 *    الحالة، والذي يُعاد رسمُه شارةُ الحفظ وحدَها — وإلّا قفزت
 *    المؤشّرةُ إلى الآخِر عند كلّ ضغطةِ مفتاح.
 */
function editorHtml(node) {
  const d = state.draft && state.draft.id === node.id ? state.draft : makeDraft(node);
  state.draft = d;

  return html`
    <div class="ws-editor">
      <label class="ws-fld">
        <span>العنوان</span>
        <input class="ws-input ws-title-in" data-ws-edit-title dir="auto"
               value="${d.title}">
      </label>
      <label class="ws-fld ws-fld-grow">
        <span>النصّ</span>
        <textarea class="ws-area" data-ws-edit-text dir="auto"
                  spellcheck="false">${d.text}</textarea>
      </label>
      ${raw(d.status === SAVE.FAILED ? html`
        <!--
          ⚠️ **والفشلُ لا يطردك من التحرير ولا يبتلع ما كتبتَه** (بند ١٣).
        -->
        <div class="ws-fail is-inline" role="alert">
          <p>الحفظ فشل — اللي كتبتَه لسّه هنا.</p>
          <p class="ws-fail-why" dir="auto">${d.error || 'سبب مش معروف'}</p>
          <button type="button" class="ws-btn" data-ws="save">جرّب تحفظ تاني</button>
        </div>` : '')}
      <p class="ws-hint">الحفظ بيسجّل نسخة في تاريخ السكريبت — زيّ أيّ تعديل.</p>
    </div>`;
}

function audioDocHtml(item) {
  /*
   * ⚠️ **زرٌّ واحدٌ يشتقّ حالتَه من الخدمة** (WS-P2 · بند ٨): كانت هذه
   *    الدالّةُ تحسب `on` بيدها، فكانت الحقيقةُ تُحسَب في مكانين.
   */
  return html`
    <div class="ws-media-doc">
      <div class="ws-media-face is-audio" aria-hidden="true">${raw(icon('waveform', 40))}</div>
      ${raw(audioButtonHtml({
        mediaId: item.id, snapshot: audio.state, loading: state.fetching.has(item.id),
        name: itemTitle(item), size: 20, className: 'ws-btn ws-btn-primary ws-media-play',
      }))}
      <!--
        ⚠️ **والتحكّمُ الكاملُ في الشريط تحت لا هنا** (بند ٣٥): الصوتُ
           خدمةٌ عامّةٌ تكمل وأنت تقلّب في النصوص — ولو ملكت هذه الشاشةُ
           مشغّلًا لَمات مع أوّل عقدةٍ تفتحها.
      -->
      <p class="ws-hint">التشغيل بيكمّل وإنت بتقلّب — الشريط تحت فيه الموضع والوقت.</p>
    </div>`;
}

function imageDocHtml(item) {
  if (isCloudOnly(item)) {
    return html`
      <div class="ws-media-doc">
        <div class="ws-media-face is-image" aria-hidden="true">${raw(icon('image', 40))}</div>
        <p>الصورة دي على Drive بس — مش متنزّلة على الجهاز ده.</p>
        <button type="button" class="ws-btn" data-ws="fetch" data-id="${item.id}"
                ${state.fetching.has(item.id) ? 'disabled' : ''}>
          ${raw(state.fetching.has(item.id)
            ? '<span class="ws-spin" aria-hidden="true"></span> بينزّل…' : 'نزّلها')}
        </button>
      </div>`;
  }
  return html`
    <div class="ws-shot">
      <button type="button" class="ws-shot-btn" data-ws="zoom" data-id="${item.id}"
              aria-label="كبّر ${itemTitle(item)}">
        <img src="${urlFor(item, { thumb: false })}" alt="${itemTitle(item)}" decoding="async">
      </button>
    </div>`;
}

/* ================================================================== *
 * ج · المُفتِّش (بند ٦)
 * ================================================================== */

function linkRowHtml(row) {
  if (row.relation === 'parent') {
    return html`
      <li class="ws-link-row is-structural">
        <span class="ws-link-kind">${row.label}</span>
        <span class="ws-link-t" dir="auto" title="${(row.path || []).join(SEP)}">
          ${row.missing ? 'الأب مابقاش موجود' : row.title}</span>
        ${raw(row.missing ? '' : html`
          <button type="button" class="ws-btn ws-btn-tiny" data-ws="nav-node"
                  data-id="${row.id}">افتح</button>`)}
      </li>`;
  }

  if (row.relation === 'placed') {
    return html`
      <li class="ws-link-row ${row.missing ? 'is-gone' : ''}">
        <span class="ws-link-kind">${row.label}</span>
        <span class="ws-link-t" dir="auto" title="${(row.path || []).join(SEP)}">
          ${row.missing ? 'الهدف مابقاش موجود' : (row.path || []).join(SEP)}</span>
        <!--
          ⚠️ **هدفٌ مفقودٌ يُعلَن ولا يُمحى** (بند ٢٦): العلاقةُ حصلت
             فعلًا، وإخفاؤها كتابةٌ للتاريخ من جديد. فيبقى الصفُّ ظاهرًا،
             والزرُّ الذي لا يقدر أن يعمل **معطَّلٌ ومشروح** لا مختفٍ.
        -->
        ${raw(row.missing ? html`
          <button type="button" class="ws-btn ws-btn-tiny" disabled
                  title="العقدة اتشالت — مفيش مكان نفتحه">افتح</button>`
          : html`<button type="button" class="ws-btn ws-btn-tiny" data-ws="nav-node"
                         data-id="${row.id}">افتح</button>`)}
        <button type="button" class="ws-btn ws-btn-tiny ws-btn-danger" data-ws="unlink"
                data-id="${state.open.id}" data-at="${row.id}">فكّ</button>
      </li>`;
  }

  const item = row.item;
  const cloud = isCloudOnly(item);
  return html`
    <li class="ws-link-row">
      <span class="ws-link-kind">${row.label}</span>
      <span class="ws-link-t" dir="auto">${itemTitle(item)}
        ${raw(cloud ? '<i class="ws-tagline">على Drive بس</i>' : '')}</span>
      <button type="button" class="ws-btn ws-btn-tiny" data-ws="open-media"
              data-id="${item.id}" data-kind="${row.relation}">افتح</button>
      <button type="button" class="ws-btn ws-btn-tiny ws-btn-danger" data-ws="unlink"
              data-id="${item.id}" data-at="${row.at}">فكّ</button>
    </li>`;
}

function linksTabHtml() {
  const rows = linkRowsFor(board, state.open);
  const real = rows.filter((one) => one.relation !== 'parent');

  return html`
    <div class="ws-insp-body">
      ${raw(real.length ? html`
        <ul class="ws-links">${raw(rows.map(linkRowHtml).join(''))}</ul>`
        : html`
          <ul class="ws-links">${raw(rows.map(linkRowHtml).join(''))}</ul>
          <div class="ws-empty">
            <p>${state.open?.kind === 'text'
              ? 'مفيش صوت ولا صورة مربوطين بالعقدة دي.'
              : 'العنصر ده لسّه غير مربوط بأيّ مكان.'}</p>
          </div>`)}
      <button type="button" class="ws-btn ws-btn-primary ws-block" data-ws="link-add">
        + إضافة رابط
      </button>
    </div>`;
}

function propsTabHtml() {
  const record = openRecord();
  if (!record) return '<div class="ws-insp-body"><p class="ws-empty">مفيش عنصر مفتوح</p></div>';

  /*
   * ⚠️ **خصائصُ محفوظةٌ فعلًا لا حقولُ عرض** (بند ٢٣). ما لا نقدر أن
   *    نشتقَّه من السجلّ لا يُعرَض ولو ترك فراغًا — والفراغُ الصادقُ
   *    أفضلُ من «٠» مخترَعة.
   */
  const facts = [];
  if (state.open.kind === 'text') {
    const t = board.targetById.get(state.open.id);
    if (t) {
      facts.push(['المكان', t.path.join(SEP)]);
      if (nodeKindLabel(t.kind)) facts.push(['النوع', nodeKindLabel(t.kind)]);
      facts.push(['طول النصّ', `${t.chars} حرف`]);
      facts.push(['عناصر تحتها', String(t.children)]);
      facts.push(['مربوط عليها', `${t.own.audio} صوت · ${t.own.images} صورة`]);
      facts.push(['تحتها', `${t.sub.audio} صوت · ${t.sub.images} صورة`]);
      facts.push(['ظاهرة', t.hidden ? 'لأ — مخفيّة' : 'أيوه']);
      if (t.updatedAt) facts.push(['آخر تعديل', new Date(t.updatedAt).toLocaleString('ar-EG')]);
    }
  } else {
    facts.push(['النوع', record.kind === 'audio' ? 'صوت' : 'صورة']);
    if (record.durationMs) facts.push(['المدّة', formatDuration(record.durationMs)]);
    if (record.role) facts.push(['التصنيف', AUDIO_ROLE_LABEL[record.role] || record.role]);
    if (record.mime) facts.push(['الصيغة', record.mime]);
    if (record.bytes) facts.push(['الحجم', formatBytes(record.bytes)]);
    facts.push(['على الجهاز ده', isCloudOnly(record) ? 'لأ — على Drive بس' : 'أيوه']);
    if (record.createdAt) facts.push(['اتضاف', new Date(record.createdAt).toLocaleString('ar-EG')]);
  }

  return html`
    <div class="ws-insp-body">
      <dl class="ws-facts">
        ${raw(facts.map(([k, v]) => html`<dt>${k}</dt><dd dir="auto">${v}</dd>`).join(''))}
      </dl>
    </div>`;
}

function mediaTabHtml() {
  const items = mediaLibrary(board, { filter: state.mediaFilter, query: state.mediaQuery });
  const here = state.open?.kind === 'text' ? mediaOf(board, state.open.id) : null;

  return html`
    <div class="ws-insp-body">
      ${raw(here && (here.audio.length || here.images.length) ? html`
        <h4 class="ws-insp-h">على العقدة دي</h4>
        <ul class="ws-thumbs">
          ${raw([...here.audio, ...here.images].map(thumbHtml).join(''))}
        </ul>` : '')}

      <h4 class="ws-insp-h">وسائط الذكرى</h4>
      <div class="ws-chips" role="tablist" aria-label="تصفية الوسائط">
        ${raw(MEDIA_FILTERS.map((one) => html`
          <button type="button" role="tab" class="ws-chip ${state.mediaFilter === one.id ? 'is-on' : ''}"
                  aria-selected="${state.mediaFilter === one.id ? 'true' : 'false'}"
                  data-ws="media-filter" data-v="${one.id}">${one.label}</button>`).join(''))}
      </div>
      <div class="ws-doc-find">
        ${raw(icon('search', 15))}
        <input class="ws-input" data-ws-media-find type="search" dir="auto"
               aria-label="دوّر في الوسائط" placeholder="دوّر بالاسم…" value="${state.mediaQuery}">
      </div>
      ${raw(items.length
        ? html`<ul class="ws-thumbs">${raw(items.map((one) => thumbHtml(one.row)).join(''))}</ul>`
        : html`<div class="ws-empty">
            <p>${state.mediaQuery.trim()
              ? `مفيش نتيجة لـ «${state.mediaQuery.trim()}»`
              : 'مفيش وسائط في المصفاة دي'}</p>
            <button type="button" class="ws-btn ws-btn-soft" data-ws="upload"
                    data-kind="audio">+ ارفع صوت</button>
            <button type="button" class="ws-btn ws-btn-soft" data-ws="upload"
                    data-kind="image">+ ارفع صورة</button>
          </div>`)}
    </div>`;
}

function thumbHtml(row) {
  const at = board.linkedTo.get(row.id) || [];
  const cloud = isCloudOnly(row);
  return html`
    <li class="ws-thumb ${state.open?.id === row.id ? 'is-on' : ''}">
      <button type="button" class="ws-thumb-face" data-ws="open-media"
              data-id="${row.id}" data-kind="${row.kind}"
              aria-label="افتح ${itemTitle(row)}">
        ${raw(row.kind === 'image' && !cloud
          ? html`<img src="${urlFor(row, { thumb: true })}" alt="" loading="lazy" decoding="async">`
          : html`<span class="ws-thumb-icon">${raw(icon(row.kind === 'audio' ? 'mic' : 'image', 18))}</span>`)}
      </button>
      <div class="ws-thumb-body">
        <b dir="auto">${itemTitle(row)}</b>
        <span>${raw(at.length
          ? html`✓ ${pathOf(at[0]) || ''}${at.length > 1 ? ` +${at.length - 1}` : ''}`
          : 'غير مربوط')}${raw(cloud ? ' <i class="ws-tagline">Drive</i>' : '')}</span>
      </div>
      ${raw(row.kind === 'audio' ? audioButtonHtml({
        mediaId: row.id, snapshot: audio.state, loading: state.fetching.has(row.id),
        name: itemTitle(row), size: 16, className: 'ws-icon-btn',
      }) : '')}
      <button type="button" class="ws-icon-btn" data-ws="rename-media" data-id="${row.id}"
              aria-label="إعادة تسمية ${itemTitle(row)}">${raw(icon('edit', 15))}</button>
    </li>`;
}

function inspectorHtml() {
  const tabs = [TAB.LINKS, TAB.PROPS, TAB.MEDIA];
  if (!state.open) {
    return html`
      <div class="ws-insp-head">
        <span class="ws-insp-title">المُفتِّش</span>
        <button type="button" class="ws-icon-btn" data-ws="insp-close"
                aria-label="اقفل المُفتِّش">${raw(icon('close', 16))}</button>
      </div>
      <div class="ws-insp-body">
        <div class="ws-empty"><p>افتح عنصر عشان تشوف روابطه وخصائصه.</p></div>
      </div>`;
  }
  return html`
    <div class="ws-insp-head">
      <div class="ws-insp-tabs" role="tablist" aria-label="أدوات العنصر">
        ${raw(tabs.map((one) => html`
          <button type="button" role="tab" class="ws-insp-tab ${state.tab === one ? 'is-on' : ''}"
                  aria-selected="${state.tab === one ? 'true' : 'false'}"
                  data-ws="tab" data-v="${one}">${TAB_LABEL[one]}</button>`).join(''))}
      </div>
      <button type="button" class="ws-icon-btn" data-ws="insp-close"
              aria-label="اقفل المُفتِّش">${raw(icon('close', 16))}</button>
    </div>
    ${raw(state.tab === TAB.LINKS ? linksTabHtml()
      : (state.tab === TAB.PROPS ? propsTabHtml() : mediaTabHtml()))}`;
}

/* ================================================================== *
 * د · شريطُ السماع — مشتركٌ لا مالك (بند ٣٥)
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
      <span class="ws-now-t" dir="auto">بتسمع: ${snapshot.title || 'تسجيل'}</span>
      <div class="ws-seek" data-ws="seek" role="slider" tabindex="0"
           aria-label="موضع التشغيل" aria-valuemin="0" aria-valuemax="100"
           aria-valuenow="${Math.round(ratio * 100)}">
        <div class="ws-seek-fill" style="inline-size:${(ratio * 100).toFixed(1)}%"></div>
      </div>
      <span class="ws-now-time">${clock(snapshot.currentTime)} / ${clock(snapshot.duration)}</span>
    </div>
    <button type="button" class="ws-btn ws-btn-soft" data-ws="link-current"
            ${state.open?.kind === 'text' ? '' : 'disabled'}>اربطه بالمفتوح</button>`;
}

/* ================================================================== *
 * الرسم الموضعيّ
 * ================================================================== */

/*
 * ⚠️ **المُمرِّرُ هو نفسُ العنصر الذي نعيد رسمَ داخله** — درسٌ مقيسٌ من
 *    WS-F2: كتابةُ `innerHTML` على مُمرِّرٍ تصفّر `scrollTop` حتمًا.
 *    فيُحفَظ الموضعُ قبل الرسم ويُعاد بعده، **بلا** `requestAnimationFrame`
 *    لأن إطارًا واحدًا من الوميض عند الصفر يُرى.
 */
const SCROLLERS = Object.freeze({
  nav: '[data-ws-nav]', doc: '[data-ws-doc]', insp: '[data-ws-insp]',
});

function paintPane(key, render, { keepScroll = true } = {}) {
  const el = $(SCROLLERS[key]);
  if (!el) return;
  const at = keepScroll ? el.scrollTop : 0;
  el.innerHTML = render();
  el.scrollTop = keepScroll ? at : 0;
  state.scroll[key] = el.scrollTop;
}

const paintNav = () => paintPane('nav', navHtml);

function paintHead() {
  const el = $('[data-ws-head]');
  if (el) el.innerHTML = docHeadHtml();
}

/**
 * ⚠️ **ولا يُعاد رسمُ المستند وأنت تكتب فيه** (بندا ٥ و١٣): الحفظُ
 *    والإنعاشُ يعيدان قراءةَ اللوحة، وإعادةُ رسم الـ`textarea` وقتها
 *    تمسح موضعَ المؤشّرة وتخسر التحديد. فالتحريرُ يملك سطحَه.
 */
function paintDoc({ keepScroll = false, force = false } = {}) {
  if (state.mode === MODE.EDIT && !force) { paintHead(); return; }
  const el = $('[data-ws-doc]');
  if (!el) return;
  el.innerHTML = docBodyHtml();
  el.scrollTop = keepScroll ? (state.docScroll[state.docMode] ?? 0) : 0;
  state.scroll.doc = el.scrollTop;
  paintHead();
}

const paintInsp = () => paintPane('insp', inspectorHtml);

/** شارةُ الحفظ وحدَها — أرخصُ إعادةِ رسمٍ ممكنة (بند ١٣). */
function paintSave() {
  const el = $('[data-ws-save]');
  if (!el) { paintHead(); return; }
  el.outerHTML = saveBadgeHtml();
}

const paintNow = (snapshot) => {
  const el = $('[data-ws-now]');
  if (!el) return;
  el.innerHTML = nowHtml(snapshot);
  el.hidden = !snapshot?.hasTrack;

  /*
   * ⚠️ **كلُّ أزرار التشغيل تُصحَّح، لا زرُّ السطح وحدَه** (بند ٨): صفُّ
   *    الوسائط في المُفتِّش وزرُّ المستند ومُلتقِطُ الربط — ثلاثتُها قد
   *    تعرض نفسَ المقطع في اللحظة نفسِها، وواحدٌ فقط يجوز أن يقول ❚❚.
   *
   * ⚠️ **وتصحيحٌ في المكان لا إعادةُ رسم** (بند ٢٩): الخدمةُ تبثّ عدّةَ
   *    مرّاتٍ في الثانية، وإعادةُ رسم القائمة مع كلّ بثٍّ تحرق الإطارات.
   */
  refreshAudioButtons(document, snapshot, { loading: state.fetching });
};

/**
 * يكتب تفضيلاتِ قشرةِ الورشة على `body` — والـCSS تتولّى الباقي.
 *
 * ⚠️ **صنفٌ على `body` لا تعديلٌ في `index.html`** (بند ٤): الشريطُ
 *    العامُّ ملكُ القشرة لا ملكُ هذه الشاشة، وكتابةُ الورشة في بنيته
 *    تجعل شاشةً واحدةً تملك تنقّلَ التطبيق كلِّه. فالورشةُ **تطلب**
 *    شكلًا، والقشرةُ تستجيب — وعند المغادرة يعود كما كان.
 */
function applyChrome() {
  document.body.classList.toggle('ws-rail-compact', state.chrome.rail === 'compact');
  document.body.classList.toggle('ws-fabs-on', state.chrome.fabs === true);
  const btn = $('[data-ws="rail"]');
  if (btn) {
    const compact = state.chrome.rail === 'compact';
    btn.setAttribute('aria-pressed', compact ? 'true' : 'false');
    btn.setAttribute('aria-label', compact ? 'وسّع شريط التطبيق' : 'اضغط شريط التطبيق');
    btn.title = btn.getAttribute('aria-label');
  }
}

/** يكتب أعرافَ التخطيط على الجذر — والـCSS وحدَها تقرّر الشكل (بند ٨). */
function applyShell() {
  const root = $('.ws');
  if (!root) return;
  const fit = paneFit(root.clientWidth || window.innerWidth, state.panes);

  root.dataset.mode = state.mode;
  root.dataset.insp = state.inspector ? 'on' : 'off';
  root.dataset.zen = state.zen ? 'on' : 'off';
  root.dataset.drawer = state.drawer || '';
  /*
   * ⚠️ **حين يُفتَح المُفتِّشُ ينكمش المُتصفِّحُ — لا المستند** (بند ٣).
   *    الأولويّةُ معلَنةٌ: المستندُ أوّلًا، ثمّ المُتصفِّح، ثمّ المُفتِّش.
   *    فعلى عرضٍ لا يكفي الثلاثةَ براحة، المُتصفِّحُ هو الذي يتنازل —
   *    ويبقى كاملَ الوظيفة، أضيقَ عرضًا وحسب. وقياسُ ١٢٨٠: المستندُ
   *    كان ٤٣٤ والمُتصفِّحُ ٢٨٠؛ وبالانكماش يصير المستندُ ٤٧٤.
   */
  const navNow = state.inspector && fit.inspDocked
    ? Math.max(PANE.NAV_MIN, Math.min(state.panes.nav, 240))
    : state.panes.nav;
  root.style.setProperty('--ws-nav', `${navNow}px`);
  root.style.setProperty('--ws-insp', `${state.panes.insp}px`);
  /*
   * ⚠️ **والمُفتِّشُ يصير درجًا حين لا يتّسع** (بند ٨): إبقاؤه عمودًا
   *    ثابتًا على شاشةٍ ضيّقةٍ يأكل المستندَ — والمستندُ هو الأولويّة
   *    الأولى حين يضيق العرض، لا اللوحان حولَه.
   */
  root.dataset.fit = fit.inspDocked ? 'wide' : (fit.navDocked ? 'mid' : 'narrow');

  const scrim = $('[data-ws-scrim]');
  if (scrim) scrim.hidden = !state.drawer;

  const toggle = $('.ws-insp-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', state.inspector ? 'true' : 'false');
}

/* ================================================================== *
 * القراءة والأفعال
 * ================================================================== */

/** يعيد قراءةَ اللوحة — بعد كتابةٍ لا بعد لمسة. */
async function refresh({ doc = true } = {}) {
  try {
    board = await workspaceBoard(state.sceneId);
    state.error = null;
  } catch (error) {
    /*
     * ⚠️ **والفشلُ يُعرَض على الشاشة لا في سجلّ المتصفّح** (بند ٢٥):
     *    لوحةٌ فارغةٌ بلا كلمةٍ تجعلك تظنّ أن ذكرياتك راحت.
     */
    state.error = String(error?.message || error);
    paintNav();
    paintDoc({ force: true });
    return;
  }
  if (!board) return;
  buildIndex();

  /*
   * ⚠️ عنصرٌ اختفى لا يبقى مفتوحًا يشير إلى معرّفٍ ميّت (بند ٢٦) —
   *    **إلّا** إن كانت معك فيه مسوّدةٌ فيها تعديلات. حينها يبقى
   *    مفتوحًا كي يُعرَض ما كتبتَه ويُنسَخ قبل أن يضيع.
   */
  const holding = state.draft && draftChanged(state.draft)
    && state.open?.kind === 'text' && state.open.id === state.draft.id;
  if (state.open && !openRecord() && !holding) state.open = null;
  for (const id of [...state.picked]) if (!mediaById(id)) state.picked.delete(id);

  paintNav();
  if (doc) paintDoc({ keepScroll: true });
  else paintHead();
  if (state.inspector) paintInsp();
}

/**
 * يفتح عقدةً في مساحة العمل.
 *
 * ⚠️ **ولا يكتب هذا الفعلُ حرفًا في القاعدة** (بند ٤٨ من WS-F): لمسةُ
 *    الشجرةِ استكشاف؛ والربطُ فعلٌ مسمًّى له زرُّه ووضعُه. وخلطُهما
 *    يجعل كلَّ تصفّحٍ كتابة.
 */
function selectNode(id) {
  if (!openable(id)) return;
  state.open = { kind: 'text', id };
  state.docQuery = '';
  state.docScroll = { text: 0, chat: 0 };
  if (state.mode === MODE.EDIT) state.draft = makeDraft(nodeById(id));
  for (const one of ancestorsOf(board, id)) state.expanded.add(one);
  closeDrawer();
  paintNav();
  paintDoc({ force: true });
  if (state.inspector) paintInsp();
}

/**
 * ⚠️ **ولا تُلقى مسوّدةٌ فيها تعديلاتٌ بلا سؤال** (بند ٥). فتحُ عنصرٍ
 *    آخرَ وأنت في نصف تحريرٍ يخسر ما كتبتَه إن مررنا بلا استئذان.
 */
function openable(id) {
  const d = state.draft;
  if (!d || d.id === id || !draftChanged(d)) return true;
  askDiscard(id);
  return false;
}

async function askDiscard(nextId) {
  const go = await confirmAction({
    title: 'فيه تعديلات مش متحفظة',
    message: 'لو خرجت من العنصر ده دلوقتي هتخسر اللي كتبتَه. تحبّ تحفظ الأول؟',
    confirmLabel: 'اخرج من غير حفظ',
    danger: true,
  });
  if (!go) return;
  state.draft = null;
  state.mode = MODE.READ;
  applyShell();
  selectNode(nextId);
}

function openMedia(id, kind) {
  const record = mediaById(id);
  if (!record) return toastError('العنصر ده مابقاش موجود');
  if (!openable(id)) return undefined;
  state.open = { kind: record.kind === 'audio' ? 'audio' : 'image', id };
  if (state.mode === MODE.EDIT) state.mode = MODE.READ;
  applyShell();
  paintDoc({ force: true });
  paintNav();
  if (state.inspector) paintInsp();
  return undefined;
}

function closeDrawer() {
  if (!state.drawer) return;
  state.drawer = null;
  applyShell();
}

/**
 * تبديلُ الوضع — **بلا فقدِ شيء** (بند ٥).
 *
 * ⚠️ الخروجُ من «تحرير» بمسوّدةٍ فيها تعديلاتٌ **يُبقيها**: تعود إلى
 *    «تحرير» فتجد كلامَك كما تركتَه. والتخلّي عنها فعلٌ صريحٌ وحدَه.
 */
function setMode(next) {
  if (state.mode === next) return;
  const wasEditing = state.mode === MODE.EDIT;
  if (wasEditing) captureDraft();

  state.mode = next;
  if (next === MODE.EDIT && state.open?.kind === 'text') {
    const node = nodeById(state.open.id);
    if (!state.draft || state.draft.id !== state.open.id) state.draft = makeDraft(node);
  }
  if (next === MODE.LINK) {
    state.inspector = true;
    state.tab = TAB.LINKS;
  }
  applyShell();
  paintDoc({ force: true });
  if (state.inspector) paintInsp();
}

/** يلتقط ما في الحقول قبل أيّ إعادةِ رسمٍ تمسحها. */
function captureDraft() {
  const d = state.draft;
  if (!d) return;
  const title = $('[data-ws-edit-title]');
  const text = $('[data-ws-edit-text]');
  if (title) d.title = title.value;
  if (text) d.text = text.value;
}

/**
 * الحفظُ — **ولا تُقال «اتحفظ» قبل أن ترجع الكتابةُ** (بند ١٣).
 */
async function saveDraft() {
  captureDraft();
  const d = state.draft;
  if (!d) return;
  if (!draftChanged(d) && d.status !== SAVE.FAILED) {
    d.status = SAVE.CLEAN;
    paintSave();
    return;
  }

  d.status = SAVE.SAVING;
  d.error = null;
  paintSave();

  try {
    await saveNodeText(d.id, { title: d.title, text: d.text });
    state.draft = draftCommitted(d);
    /* ⚠️ إنعاشٌ بلا لمسِ سطح التحرير — المؤشّرةُ حيث تركتَها. */
    await refresh({ doc: false });
    paintSave();
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      if (state.draft && state.draft.status === SAVE.SAVED) {
        state.draft.status = SAVE.CLEAN;
        paintSave();
      }
    }, 2600);
  } catch (error) {
    d.status = SAVE.FAILED;
    d.error = String(error?.message || error);
    paintDoc({ force: true });
    toastError('الحفظ فشل — اللي كتبتَه لسّه موجود');
  }
}

async function playItem(mediaId) {
  const item = mediaById(mediaId);
  if (!item) return toastError('التسجيل ده مابقاش موجود');

  /*
   * ⚠️ **القرارُ من العقد المشترك لا من شرطٍ مكتوبٍ هنا** (بند ٩):
   *    وقّف · كمّل من موضعه · ابدأ من أوّله — ثلاثةٌ لا اثنان، والفرقُ
   *    بين «كمّل» و«ابدأ» هو ما يجعل الضغطةَ الثانية تفعل ما تتوقّعه.
   */
  const intent = playIntent(audio.state, mediaId, { loading: state.fetching.has(mediaId) });
  if (intent === 'ignore') return undefined;
  if (intent === 'pause') { audio.pause(); return undefined; }
  if (intent === 'resume') {
    const out2 = await audio.play();
    if (out2 && out2.ok === false) toastError('تعذّر تشغيل التسجيل');
    return undefined;
  }

  /*
   * ⚠️ **والجلبُ من Drive حالةٌ معروضةٌ لا انتظارٌ صامت** (بند ١٤): لو
   *    كانت البايتاتُ على السحابة وحدَها، الزرُّ يقول «بينزّل من Drive…»
   *    ولا يتظاهر بنسبةٍ مخترَعة — لأنّ التقدّمَ هنا غيرُ مقيسٍ فعلًا.
   */
  let record = item;
  if (isCloudOnly(item)) {
    state.fetching.add(mediaId);
    paintDoc({ keepScroll: true });
    if (state.inspector) paintInsp();
    try {
      record = (await ensureBytes(mediaId)) || item;
    } catch (error) {
      state.fetching.delete(mediaId);
      paintDoc({ keepScroll: true });
      return toastError(`تعذّر تنزيل التسجيل: ${error?.message || 'مش متاح'}`);
    }
    state.fetching.delete(mediaId);
    await refresh({ doc: false });
    record = mediaById(mediaId) || record;
  }

  /*
   * ⚠️ **وهي `load` لا عنصرٌ ننشئه** (بند ٣٥): الخدمةُ تملك `<audio>`
   *    واحدًا خارج الشاشات، فتبديلُ المقطع يوقف السابقَ حتمًا، والتشغيلُ
   *    يعيش بعد كلّ إعادة رسمٍ هنا.
   */
  const out = await audio.load({
    mediaId: record.id,
    url: urlFor(record, { thumb: false }),
    title: itemTitle(record),
    subtitle: board.scene?.titleAr || '',
  });
  if (out && out.ok === false) toastError('تعذّر تشغيل التسجيل');
  return undefined;
}

/* ================================================================== *
 * الربط — ملتقِطٌ يبحث ويعاين ثم يؤكّد (بند ١٨)
 * ================================================================== */

/**
 * ⚠️ **الربطُ خطوةٌ مقصودةٌ لا نتيجةَ لمسةٍ عابرة** (بند ٦): تفتح
 *    العنصر، وتدخل وضعَ «ربط»، وتفتح المُفتِّش على «الربط»، وتضغط
 *    «+ إضافة رابط»، وتبحث، **وتعاين**، ثم تؤكّد. وكلُّ خطوةٍ منها
 *    قابلةٌ للتراجع قبل الكتابة.
 */
async function openLinkPicker() {
  if (!state.open) return toastError('افتح عنصر الأول');
  state.picked = new Set();

  if (state.open.kind === 'text') return pickMediaFor(state.open.id);
  return pickTargetFor(state.open.id);
}

/** عقدةٌ مفتوحة → نختار لها وسائط. */
async function pickMediaFor(nodeId) {
  const target = board.targetById.get(nodeId);
  const done = await showModal({
    title: 'اربط وسائط بالعقدة دي',
    wide: true,
    submitLabel: 'اربط المحدد',
    body: html`
      <p class="ws-crumb-line" dir="auto" title="${target?.path.join(SEP) || ''}">
        ${target?.path.join(SEP) || ''}</p>
      <input class="ws-input" data-pick-find type="search" dir="auto"
             placeholder="دوّر في وسائط الذكرى…" aria-label="دوّر في الوسائط">
      <div class="ws-pick-chips" role="tablist">
        ${raw(MEDIA_FILTERS.map((one, i) => html`
          <button type="button" role="tab" class="ws-chip ${i === 0 ? 'is-on' : ''}"
                  data-pick-filter="${one.id}">${one.label}</button>`).join(''))}
      </div>
      <ul class="ws-pick-list" data-pick-list></ul>
      <p class="ws-pick-n" data-pick-n role="status">مفيش حاجة متحدِّدة</p>`,
    onMount(root) {
      let filter = 'unlinked';
      let query = '';

      const draw = () => {
        const list = root.querySelector('[data-pick-list]');
        const items = mediaLibrary(board, { filter, query });
        list.innerHTML = items.length ? items.map(({ row }) => {
          const at = board.linkedTo.get(row.id) || [];
          const already = at.includes(nodeId);
          const on = state.picked.has(row.id);
          return html`
            <li class="ws-pick-row ${on ? 'is-on' : ''} ${already ? 'is-already' : ''}">
              <button type="button" class="ws-pick-hit" data-pick="${row.id}"
                      role="checkbox" aria-checked="${on ? 'true' : 'false'}"
                      ${already ? 'disabled' : ''}>
                <span class="ws-pick-box" aria-hidden="true">${on ? '✓' : ''}</span>
                <span class="ws-pick-face" aria-hidden="true">
                  ${raw(row.kind === 'image' && !isCloudOnly(row)
                    ? html`<img src="${urlFor(row, { thumb: true })}" alt="" loading="lazy">`
                    : icon(row.kind === 'audio' ? 'mic' : 'image', 16))}</span>
                <span class="ws-pick-t" dir="auto">${itemTitle(row)}</span>
                <span class="ws-pick-sub">${already ? 'مربوط هنا خلاص'
                  : (at.length ? `مربوط بـ ${pathOf(at[0]) || ''}` : 'غير مربوط')}</span>
              </button>
              ${raw(row.kind === 'audio' ? audioButtonHtml({
                mediaId: row.id, snapshot: audio.state, name: itemTitle(row),
                size: 15, className: 'ws-icon-btn',
              }) : '')}
            </li>`;
        }).join('') : '<li class="ws-empty"><p>مفيش وسائط في المصفاة دي</p></li>';
        root.querySelector('[data-pick-n]').textContent = state.picked.size
          ? `${state.picked.size} متحدِّد` : 'مفيش حاجة متحدِّدة';
      };

      draw();
      root.addEventListener('click', (event) => {
        const hit = event.target.closest('[data-pick]');
        if (hit) {
          const id = hit.dataset.pick;
          if (state.picked.has(id)) state.picked.delete(id); else state.picked.add(id);
          draw();
          return;
        }
        const play = event.target.closest('[data-audio-btn]');
        if (play) { playItem(play.dataset.audioBtn); draw(); return; }
        const chip = event.target.closest('[data-pick-filter]');
        if (chip) {
          filter = chip.dataset.pickFilter;
          root.querySelectorAll('[data-pick-filter]')
            .forEach((one) => one.classList.toggle('is-on', one === chip));
          draw();
        }
      }, wired());
      root.addEventListener('input', (event) => {
        if (!event.target.matches('[data-pick-find]')) return;
        query = event.target.value;
        draw();
      }, wired());
    },
    onSubmit: async (data, close) => {
      if (!state.picked.size) return toastError('اختار حاجة الأول');
      close();
      return undefined;
    },
  });

  if (done !== 'submit' || !state.picked.size) { state.picked.clear(); return undefined; }
  return commitLink([...state.picked], nodeId);
}

/** وسيطٌ مفتوح → نختار له مكانًا في الشجرة. */
async function pickTargetFor(mediaId) {
  const item = mediaById(mediaId);
  const at = new Set(board.linkedTo.get(mediaId) || []);
  let chosen = null;

  const done = await showModal({
    title: `اربط «${itemTitle(item)}» بمكان`,
    wide: true,
    submitLabel: 'اربط',
    body: html`
      <input class="ws-input" data-pick-find type="search" dir="auto"
             placeholder="دوّر في السكريبتات والأجزاء…" aria-label="دوّر في الأماكن">
      <ul class="ws-pick-list" data-pick-list></ul>
      <p class="ws-pick-n" data-pick-n role="status">مفيش مكان متحدِّد</p>`,
    onMount(root) {
      let query = '';
      const draw = () => {
        const needle = query.trim().toLowerCase();
        const rows = board.targets.filter((one) => !needle
          || one.path.join(' ').toLowerCase().includes(needle));
        const list = root.querySelector('[data-pick-list]');
        list.innerHTML = rows.length ? rows.slice(0, 300).map((one) => html`
          <li class="ws-pick-row ${chosen === one.id ? 'is-on' : ''}
                     ${at.has(one.id) ? 'is-already' : ''}">
            <button type="button" class="ws-pick-hit" data-pick="${one.id}"
                    role="radio" aria-checked="${chosen === one.id ? 'true' : 'false'}"
                    ${at.has(one.id) ? 'disabled' : ''}>
              <span class="ws-pick-box" aria-hidden="true">${chosen === one.id ? '✓' : ''}</span>
              <span class="ws-pick-t" dir="auto">${one.title}</span>
              <span class="ws-pick-sub" dir="auto">${at.has(one.id)
                ? 'مربوط هنا خلاص' : one.path.join(SEP)}</span>
            </button>
          </li>`).join('') : '<li class="ws-empty"><p>مفيش مكان بالاسم ده</p></li>';
        root.querySelector('[data-pick-n]').textContent = chosen
          ? `المكان: ${pathOf(chosen)}` : 'مفيش مكان متحدِّد';
      };
      draw();
      root.addEventListener('click', (event) => {
        const hit = event.target.closest('[data-pick]');
        if (!hit) return;
        chosen = hit.dataset.pick;
        draw();
      }, wired());
      root.addEventListener('input', (event) => {
        if (!event.target.matches('[data-pick-find]')) return;
        query = event.target.value;
        draw();
      }, wired());
    },
    onSubmit: async (data, close) => {
      if (!chosen) return toastError('اختار مكان الأول');
      close();
      return undefined;
    },
  });

  if (done !== 'submit' || !chosen) return undefined;
  return commitLink([mediaId], chosen);
}

/**
 * الكتابةُ نفسُها — **بنفس نموذج العلاقات القائم** (بند ١٨).
 *
 * ⚠️ **وهي إضافةٌ لا نقل** (بند ٢٢): الربطُ يزيد وجهةً ولا يهدم وجهةً
 *    قائمة، فملفٌّ واحدٌ يخدم مرحلةً وجزأين بلا نسخِ بايتاته.
 */
async function commitLink(mediaIds, targetId) {
  const where = pathOf(targetId);
  try {
    const { linked } = await linkSelection(mediaIds, targetId, board, { mode: 'attach' });
    state.picked.clear();
    await refresh({ doc: false });
    if (state.inspector) paintInsp();
    return toastOk(`اترّبط ${linked} — ${where}`);
  } catch (error) {
    return toastError(`الربط فشل: ${error?.message || 'مش معروف'}`);
  }
}

async function dropLink(mediaId, at) {
  const where = at ? pathOf(at) : null;
  const item = mediaById(mediaId);
  const go = await confirmAction({
    title: 'فكّ الربط',
    message: where
      ? `هيتفكّ «${esc(itemTitle(item) || '')}» من «${esc(where)}». الملفّ نفسه هيفضل موجود.`
      : 'هيتفكّ الربط. الملفّ نفسه هيفضل موجود.',
    confirmLabel: 'فكّ',
  });
  if (!go) return undefined;
  try {
    await unlinkOne(mediaId, board, at || null);
    await refresh({ doc: false });
    if (state.inspector) paintInsp();
    return toastOk(where ? `اتفكّ من ${where}` : 'اتفكّ الربط');
  } catch (error) {
    return toastError(`فكّ الربط فشل: ${error?.message || 'مش معروف'}`);
  }
}

/**
 * إعادةُ تسمية وسيطٍ — **اسمٌ معروضٌ لا هُويّةٌ جديدة** (WS-P2 · بند ١٠).
 *
 * ⚠️ **ولا سجلَّ يُنشَأ ولا بايتاتٍ تُنسَخ** (القاعدة ٥): الاسمُ حقلُ
 *    `caption` القائم منذ WS0 — يُكتَب بـ`media.update` على السجلّ
 *    نفسِه. فالمعرّفُ باقٍ، والروابطُ باقيةٌ لأنّها تشير إليه، وهُويّةُ
 *    الملفّ على Drive باقيةٌ لأنّها لا تُشتقّ من الاسم أصلًا.
 *
 * ⚠️ **والملفُّ الأصليُّ اسمُه لا يُمَسّ**: `filename` هو ما رُفِع، وهو
 *    ما يُنزَّل. وخلطُ الاسمين يجعل «سمِّها لافتة المستودع» يغيّر ما
 *    يصل إلى قرصك — وذلك مسٌّ بالتخزين لأجل عرض.
 */
async function renameMedia(mediaId) {
  const row = mediaById(mediaId);
  if (!row) return toastError('العنصر ده مابقاش موجود');
  let saved = false;

  const done = await showModal({
    title: 'إعادة تسمية',
    submitLabel: 'احفظ',
    body: html`
      <label class="fld"><span>الاسم المعروض</span>
        <input name="name" dir="auto" maxlength="200" value="${itemTitle(row)}"></label>
      <p class="ws-hint">
        ده الاسم اللي هتشوفه وتدوّر بيه. الملفّ نفسه ومعرّفه وروابطه ما بيتغيّروش.
      </p>`,
    onSubmit: async (data, close) => {
      const name = String(data.name || '').trim();
      /* ⚠️ اسمٌ فارغٌ يُرفَض ولا يُحوَّل إلى فراغٍ محفوظ (بند ١٠). */
      if (!name) return toastError('اكتب اسم — مش هينفع يفضل فاضي');
      try {
        await setCaption(mediaId, name);
        saved = true;
        close();
      } catch (error) {
        toastError(`إعادة التسمية فشلت: ${error?.message || 'مش معروف'}`);
      }
      return undefined;
    },
  });

  if (done !== 'submit' || !saved) return undefined;
  await refresh({ doc: state.mode !== MODE.EDIT });
  if (state.inspector) paintInsp();
  return toastOk('اتغيّر الاسم');
}

/* ================================================================== *
 * الإنشاء السياقيّ (بند ١٧)
 * ================================================================== */

async function openAddMenu() {
  const add = addScopeLabel();
  if (!add.where) return newRoot();

  const choice = await showModal({
    title: add.label,
    submitLabel: 'اقفل',
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <p class="ws-crumb-line" dir="auto" title="${add.where.path.join(SEP)}">
        جوّه: ${add.where.path.join(SEP)}</p>
      <div class="ws-add">
        <button type="button" class="ws-add-btn" data-add="text">
          <b>📝 نصّ</b><span>عقدة جديدة تحت المكان ده</span></button>
        <button type="button" class="ws-add-btn" data-add="paste">
          <b>📥 استيراد نصّ منظَّم</b><span>الصق رحلة كاملة مرّة واحدة</span></button>
        <button type="button" class="ws-add-btn" data-add="audio">
          <b>🎙 صوت</b><span>ملفّ أو أكتر — تربطه وإنت شايفه</span></button>
        <button type="button" class="ws-add-btn" data-add="image">
          <b>🖼 صورة</b><span>ملفّ أو أكتر — تربطها وإنتِ شايفها</span></button>
      </div>`,
    onMount(root) {
      root.addEventListener('click', (event) => {
        const pick = event.target.closest('[data-add]')?.dataset.add;
        if (pick) root.closest('.overlay')?.__close?.(pick);
      }, wired());
    },
  });

  if (choice === 'text') return addTextInside(add.where.id);
  if (choice === 'paste') return openPaste(add.where.id);
  if (choice === 'audio' || choice === 'image') return uploadFiles(choice);
  return undefined;
}

/**
 * ⚠️ **وبعد الإنشاء: يُحدَّد ويُفرَد الطريقُ إليه ويُفتَح فورًا** (بند ١٧).
 *    عقدةٌ تُنشَأ ثم تختفي في شجرةٍ مطويّةٍ ليست إنشاءً — هي فقدان.
 */
async function addTextInside(parentId) {
  const parent = board.targetById.get(parentId);
  let made = null;

  const done = await showModal({
    title: 'نصّ جديد',
    wide: true,
    submitLabel: 'احفظ',
    body: html`
      <p class="ws-crumb-line" dir="auto">جوّه: ${parent?.path.join(SEP) || ''}</p>
      <label class="fld"><span>العنوان</span>
        <input name="title" dir="auto" placeholder="مثلاً: PART 4 — الجمارك"></label>
      <label class="fld"><span>النصّ</span>
        <textarea name="text" rows="8" dir="auto"></textarea></label>
      <fieldset class="ws-where">
        <legend>يتحطّ فين؟</legend>
        <label><input type="radio" name="where" value="inside" checked>
          جوّه <b dir="auto">${parent?.title || ''}</b></label>
        <label><input type="radio" name="where" value="after">
          بعد <b dir="auto">${parent?.title || ''}</b></label>
        <label><input type="radio" name="where" value="loose">
          سايب — أقرّر مكانه بعدين</label>
      </fieldset>`,
    /*
     * ⚠️ **وفشلُ الإنشاء يُبقي ما كتبتَه في النافذة** (بند ١٧): النافذةُ
     *    لا تُغلَق إلّا بعد أن ترجع الكتابةُ محقَّقة.
     */
    onSubmit: async (data, close) => {
      const title = String(data.title || '').trim();
      const text = String(data.text || '');
      if (!title && !text.trim()) return toastError('اكتب عنوان أو نصّ');
      const place = data.where || 'inside';
      try {
        if (place === 'loose') {
          made = await addLooseText(state.sceneId, { title: title || 'نصّ جديد', text });
        } else {
          made = await addTextAt(parentId, place, { title: title || 'نصّ جديد', text });
          if (!made) {
            made = await addLooseText(state.sceneId, { title: title || 'نصّ جديد', text });
            toastOk('المكان ده مالوش أب — اتحفظ سكريبت مستقلّ');
          }
        }
        close();
      } catch (error) {
        toastError(`الحفظ فشل: ${error?.message || 'مش معروف'} — اللي كتبتَه لسّه هنا`);
      }
      return undefined;
    },
  });

  if (done !== 'submit' || !made) return undefined;
  state.expanded.add(parentId);
  await refresh({ doc: false });
  revealAndOpen(made.id);
  return toastOk('اتعملت — وإنت واقف عليها دلوقتي');
}

/** يفرد الطريقَ إلى عقدةٍ ويفتحها ويجرّها إلى الشاشة (بند ١٧). */
function revealAndOpen(id) {
  for (const one of ancestorsOf(board, id)) state.expanded.add(one);
  state.open = { kind: 'text', id };
  state.draft = null;
  state.mode = MODE.READ;
  applyShell();
  paintNav();
  paintDoc({ force: true });
  if (state.inspector) paintInsp();
  const row = $(`[data-ws="nav-node"][data-id="${id}"]`);
  row?.scrollIntoView({ block: 'nearest' });
}

async function newRoot() {
  let made = null;
  const done = await showModal({
    title: 'سكريبت رئيسي جديد',
    submitLabel: 'اعمله',
    body: html`<label class="fld"><span>الاسم</span>
      <input name="title" dir="auto" placeholder="مثلاً: مراجعة الجمارك"></label>`,
    onSubmit: async (data, close) => {
      try {
        made = await createMainScript(state.sceneId, { title: data.title });
        close();
      } catch (error) {
        toastError(`الإنشاء فشل: ${error?.message || 'مش معروف'}`);
      }
    },
  });
  if (done !== 'submit' || !made) return undefined;
  await refresh({ doc: false });
  revealAndOpen(made.id);
  return toastOk('اتعمل — تقدر تلصق فيه دلوقتي');
}

/**
 * رفعُ ملفّاتٍ — **بلا ربطٍ إجباريّ**.
 *
 * ⚠️ ويروح المرفوعُ إلى «غير مربوط» لا إلى المكان الحاليّ: الربطُ قرارٌ
 *    يحتاج أن تسمع الملفَّ أوّلًا.
 */
async function uploadFiles(kind) {
  const files = await pickFiles({
    accept: kind === 'audio' ? 'audio/*' : 'image/*', multiple: true,
  });
  if (!files?.length) return undefined;

  const before = new Set([...board.audio, ...board.images].map((row) => row.id));
  try {
    await addFilesToScene(state.sceneId, files);
  } catch (error) {
    return toastError(`الرفع فشل: ${error?.message || 'مش معروف'}`);
  }
  await refresh({ doc: false });

  const fresh = [...board.audio, ...board.images]
    .filter((row) => !before.has(row.id)).map((row) => row.id);

  state.inspector = true;
  state.tab = TAB.MEDIA;
  state.mediaFilter = 'unlinked';
  applyShell();
  paintInsp();
  return toastOk(`اتضاف ${fresh.length || files.length} — تلاقيهم في «غير مربوط»`);
}

/** اللصقُ المنظَّم تحت المكان الحاليّ. */
async function openPaste(parentId) {
  const parent = board.targetById.get(parentId);
  const { openSmartPaste } = await import('../modals/smart-paste.js');
  const decided = await openSmartPaste({ parentLabel: parent?.title || 'السكريبت' });
  if (!decided?.ok) return undefined;

  /*
   * ⚠️ **والتعارضُ يُعرَض قبل الكتابة لا بعدها**: «PART 1» تحت أبٍ فيه
   *    «PART 1» ليست هي هي، ولا تُدمَج بالاسم أبدًا.
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

  try {
    const { created } = await commitPaste(parentId, decided.proposal, { excluded: decided.excluded });
    state.expanded.add(parentId);
    await refresh({ doc: false });
    return toastOk(`اتعملت ${created} عقدة تحت ${parent?.title || 'السكريبت'}`);
  } catch (error) {
    return toastError(`الاستيراد فشل: ${error?.message || 'مش معروف'}`);
  }
}

/* ================================================================== *
 * قائمةُ العنصر
 * ================================================================== */

/**
 * نقلُ عقدةٍ تحت أبٍ آخَر — **باختيارٍ صريحٍ لا بسحبٍ دقيق** (بند ١٧).
 *
 * ⚠️ **السحبُ والإفلات ليس مسارًا وحيدًا على لوحٍ زجاجيّ.** إصبعٌ يجرّ
 *    صفًّا في شجرةٍ تمرّر نفسَها هو أسوأُ ما يُطلَب من مستعمِلِ تابلت.
 *    فالمسارُ هنا: اختر الوجهةَ من قائمةٍ تبحث فيها، وشاهد المسارَ
 *    كاملًا، ثم أكّد.
 *
 * ⚠️ **والنقلُ المستحيلُ يُمنَع في الخدمة لا في الشاشة**: `moveNodeTo`
 *    ترفض العقدةَ إلى نفسها وإلى أحد أبنائها. فالحارسُ في مكانٍ واحدٍ
 *    مهما تعدّدت الشاشاتُ التي تنادي.
 */
async function moveNode(nodeId) {
  const node = nodeById(nodeId);
  const here = board.targetById.get(nodeId);
  if (!node || !here) return toastError('العقدة دي مابقتش موجودة');

  /* الوجهاتُ الممكنة: كلُّ هدفٍ ليس هو ولا من نسله ولا أبوه الحاليّ. */
  const banned = new Set([nodeId]);
  for (const one of board.targets) {
    if (one.path.length > here.path.length
      && one.path.slice(0, here.path.length).join('\u0000') === here.path.join('\u0000')) {
      banned.add(one.id);
    }
  }

  let chosen = null;
  const done = await showModal({
    title: `نقل «${node.title}»`,
    wide: true,
    submitLabel: 'انقله',
    body: html`
      <p class="ws-crumb-line" dir="auto">مكانه دلوقتي: ${here.path.join(SEP)}</p>
      <input class="ws-input" data-pick-find type="search" dir="auto"
             placeholder="دوّر على المكان الجديد…" aria-label="دوّر على المكان الجديد">
      <ul class="ws-pick-list" data-pick-list></ul>
      <p class="ws-pick-n" data-pick-n role="status">مفيش مكان متحدِّد</p>`,
    onMount(root) {
      let query = '';
      const draw = () => {
        const needle = query.trim().toLowerCase();
        const rows = board.targets.filter((one) => !banned.has(one.id)
          && one.id !== here.parentId
          && (!needle || one.path.join(' ').toLowerCase().includes(needle)));
        const list = root.querySelector('[data-pick-list]');
        list.innerHTML = rows.length ? rows.slice(0, 300).map((one) => html`
          <li class="ws-pick-row ${chosen === one.id ? 'is-on' : ''}">
            <button type="button" class="ws-pick-hit" data-pick="${one.id}"
                    role="radio" aria-checked="${chosen === one.id ? 'true' : 'false'}">
              <span class="ws-pick-box" aria-hidden="true">${chosen === one.id ? '✓' : ''}</span>
              <span class="ws-pick-t" dir="auto">${one.title}</span>
              <span class="ws-pick-sub" dir="auto">${one.path.join(SEP)}</span>
            </button>
          </li>`).join('')
          : '<li class="ws-empty"><p>مفيش مكان ينفع — جرّب اسم تاني</p></li>';
        root.querySelector('[data-pick-n]').textContent = chosen
          ? `هيتحطّ جوّه: ${pathOf(chosen)}` : 'مفيش مكان متحدِّد';
      };
      draw();
      root.addEventListener('click', (event) => {
        const hit = event.target.closest('[data-pick]');
        if (!hit) return;
        chosen = hit.dataset.pick;
        draw();
      }, wired());
      root.addEventListener('input', (event) => {
        if (!event.target.matches('[data-pick-find]')) return;
        query = event.target.value;
        draw();
      }, wired());
    },
    onSubmit: async (data, close) => {
      if (!chosen) return toastError('اختار المكان الجديد الأول');
      close();
      return undefined;
    },
  });

  if (done !== 'submit' || !chosen) return undefined;
  const where = pathOf(chosen);
  try {
    const org = await import('../services/organize-service.js');
    await org.moveNodeTo(nodeId, chosen);
    state.expanded.add(chosen);
    await refresh({ doc: false });
    revealAndOpen(nodeId);
    return toastOk(`اتنقل جوّه ${where}`);
  } catch (error) {
    return toastError(error?.message || 'النقل فشل');
  }
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
      <!--
        ⚠️ **إضافةُ ابنٍ وإضافةُ شقيقٍ هما المفتاحان** (WS-P2 · بند ١٥):
           بهما وحدَهما تنمو الشجرةُ في أيّ اتّجاه — تقسم «المرحلة ٢»
           إلى ٢أ و٢ب (أبناء)، أو تضيف «المرحلة ١٣» (شقيق). ولا رقمَ
           مفروضٌ ولا عددَ مراحلَ مفترَض: الاسمُ اسمُك.
      -->
      <div class="ws-menu">
        <button type="button" data-m="rename">إعادة تسمية</button>
        <button type="button" data-m="inside">+ إضافة تحته</button>
        ${raw(isRoot ? '' : '<button type="button" data-m="after">+ إضافة بعده</button>')}
        ${raw(isRoot ? '' : '<button type="button" data-m="move">نقل لمكان تاني</button>')}
        ${raw(isRoot ? '' : '<button type="button" data-m="up">حرّكه فوق</button>')}
        ${raw(isRoot ? '' : '<button type="button" data-m="down">حرّكه تحت</button>')}
        ${raw(isRoot && isLoose
          ? '<button type="button" data-m="place">حطّه جوّه المفتوح دلوقتي</button>' : '')}
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
  if (pick === 'move') return moveNode(nodeId);
  if (pick === 'inside') return addTextInside(nodeId);
  if (pick === 'after') {
    const parentId = board.targetById.get(nodeId)?.parentId;
    return parentId ? addTextInside(parentId) : toastError('ده جذر — مالوش أب');
  }
  if (pick === 'up' || pick === 'down') {
    const parentId = board.targetById.get(nodeId)?.parentId;
    if (parentId) await org.moveNode(parentId, nodeId, pick);
    await refresh();
    return undefined;
  }
  if (pick === 'place') {
    if (state.open?.kind !== 'text' || state.open.id === nodeId) {
      return toastError('افتح المكان اللي عايزه الأول');
    }
    await placeTextUnder(nodeId, state.open.id);
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
    if (state.open?.id === nodeId) { state.open = null; state.draft = null; }
    await refresh();
    return toastOk('اتشال — تلاقيه في السلّة');
  }
  return undefined;
}

/* ================================================================== *
 * لوحةُ المفاتيح داخل المُتصفِّح (بند ٢١)
 * ================================================================== */

function navKeys(event) {
  const item = event.target.closest('[data-ws="nav-node"]');
  if (!item) return;
  const rows = $$('[data-ws="nav-node"]', $('[data-ws-nav]'));
  const at = rows.indexOf(item);
  const id = item.dataset.id;
  const open = item.getAttribute('aria-expanded');

  const go = (next) => {
    if (!rows[next]) return;
    rows[next].focus();
    event.preventDefault();
  };

  if (event.key === 'ArrowDown') return go(at + 1);
  if (event.key === 'ArrowUp') return go(at - 1);
  if (event.key === 'Home') return go(0);
  if (event.key === 'End') return go(rows.length - 1);

  /* ⚠️ في RTL «الفرد» يمينًا و«الطيّ» يسارًا لا العكس (بند ٩). */
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const wantOpen = event.key === 'ArrowLeft';
    if (open === null) return undefined;
    if (wantOpen && open === 'false') { toggleTwist(id); event.preventDefault(); }
    if (!wantOpen && open === 'true') { toggleTwist(id); event.preventDefault(); }
    return undefined;
  }
  return undefined;
}

function toggleTwist(id) {
  if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
  paintNav();
  /* ⚠️ لا يُنقَل التركيزُ بعد إعادةِ رسمٍ سلبيّة — يُعاد لمكانه (بند ٢١). */
  $(`[data-ws="nav-node"][data-id="${id}"]`)?.focus({ preventScroll: true });
}

/* ================================================================== *
 * تحجيمُ الألواح (بند ١١)
 * ================================================================== */

function startResize(event, which) {
  const root = $('.ws');
  if (!root) return;
  const rtl = getComputedStyle(root).direction === 'rtl';
  const startX = event.clientX;
  const from = which === 'nav' ? state.panes.nav : state.panes.insp;
  event.target.setPointerCapture?.(event.pointerId);

  const move = (ev) => {
    const raw2 = ev.clientX - startX;
    /* في RTL: المُتصفِّحُ على اليمين، فالسحبُ يسارًا يوسّعه. */
    const delta = which === 'nav' ? (rtl ? -raw2 : raw2) : (rtl ? raw2 : -raw2);
    const width = from + delta;
    const viewport = root.clientWidth;
    if (which === 'nav') {
      const other = state.inspector ? state.panes.insp : 0;
      state.panes.nav = Math.round(Math.max(PANE.NAV_MIN,
        Math.min(PANE.NAV_MAX, Math.min(width, viewport - other - PANE.MAIN_MIN))));
    } else {
      state.panes.insp = Math.round(Math.max(PANE.INSP_MIN,
        Math.min(PANE.INSP_MAX, Math.min(width, viewport - state.panes.nav - PANE.MAIN_MIN))));
    }
    applyShell();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    writePanePrefs(state.panes);
  };
  window.addEventListener('pointermove', move, wired());
  window.addEventListener('pointerup', up, wired({ once: true }));
}

/* ================================================================== *
 * الشاشة
 * ================================================================== */

export async function renderWorkspace(main, sceneId) {
  freshWires();
  state.sceneId = sceneId;
  state.open = null;
  state.mode = MODE.READ;
  state.draft = null;
  state.expanded = new Set();
  state.shown = new Map();
  state.navQuery = '';
  state.navBudget = NAV_MAX_ROWS;
  state.docQuery = '';
  state.inspector = false;
  state.tab = TAB.LINKS;
  state.zen = false;
  state.drawer = null;
  state.picked = new Set();
  state.mediaFilter = 'unlinked';
  state.mediaQuery = '';
  state.fetching = new Set();
  state.error = null;
  state.loading = true;
  board = null;
  recordIndex = new Map();

  /* ⚠️ يُخفي المُشغّلَ العالميَّ — راجع سبب ذلك في `workspace.css`. */
  document.body.classList.add('workspace-open');
  state.chrome = readChromePrefs();
  applyChrome();
  state.panes = effectivePanes(main.clientWidth || window.innerWidth);

  main.innerHTML = html`
    <div class="ws" data-mode="read" data-insp="off" data-zen="off" data-drawer="" data-fit="wide"
         style="--ws-nav:${state.panes.nav}px; --ws-insp:${state.panes.insp}px">
      <header class="ws-top">
        <a class="ws-icon-btn" href="#/scene/${sceneId}" aria-label="رجوع للذكرى">
          ${raw(icon('back', 18))}</a>
        <button type="button" class="ws-icon-btn ws-only-narrow" data-ws="drawer" data-v="nav"
                aria-label="افتح شجرة المحتوى">${raw(icon('language', 18))}</button>
        <h1 class="ws-scene" dir="auto" data-ws-scene>…</h1>
        <div class="ws-top-acts">
          <button type="button" class="ws-icon-btn" data-ws="rail"
                  aria-pressed="true" aria-label="وسّع شريط التطبيق"
                  title="وسّع شريط التطبيق">${raw(icon('language', 18))}</button>
          <button type="button" class="ws-icon-btn" data-ws="zen"
                  aria-pressed="false" aria-label="وضع التركيز">${raw(icon('eye', 18))}</button>
          <!--
            ⚠️ **«وضع التنظيم» لم يكن يقول ما يفعل** (WS-P2 · بند ١٢).
               دقّقتُ الشاشةَ التي يفتحها: سؤالُها الحقيقيّ «إيه اللي
               لسّه ما نظّمتهوش؟» — فرزٌ على مستوى الذكرى كلِّها، وورشةُ
               ربطٍ بالجملة. وذلك عملٌ حقيقيٌّ لا تغطّيه هذه الشاشة،
               فبقي البابُ **باسمه الصادق** لا باسمٍ غامض.
          -->
          <a class="ws-btn ws-btn-soft ws-only-wide" href="#/organize/${sceneId}"
             title="فرزُ غير المربوط في الذكرى كلِّها، وربطٌ بالجملة">الفرز والربط بالجملة</a>
        </div>
      </header>

      <div class="ws-body">
        <aside class="ws-nav" data-ws-nav aria-label="مُتصفِّح المحتوى"></aside>
        <div class="ws-split" data-ws-split="nav" role="separator"
             aria-label="عرض المُتصفِّح" tabindex="0"></div>

        <main class="ws-main" data-ws-main>
          <div class="ws-head" data-ws-head></div>
          <div class="ws-doc" data-ws-doc></div>
        </main>

        <div class="ws-split" data-ws-split="insp" role="separator"
             aria-label="عرض المُفتِّش" tabindex="0"></div>
        <aside class="ws-insp" id="ws-inspector" data-ws-insp aria-label="المُفتِّش"></aside>
      </div>

      <button type="button" class="ws-scrim" data-ws-scrim data-ws="drawer" data-v=""
              aria-label="اقفل الدرج" hidden></button>
      <div class="ws-now" data-ws-now hidden></div>
    </div>`;

  /* رسمُ حالة التحميل قبل انتظار القاعدة — الانتظارُ يشرح نفسَه (بند ١٤). */
  paintNav();
  paintDoc({ force: true });

  try {
    board = await workspaceBoard(sceneId);
  } catch (error) {
    state.error = String(error?.message || error);
  }
  state.loading = false;

  if (!board && !state.error) {
    main.innerHTML = '<p class="ws-empty">الذكرى دي مش موجودة</p>';
    return;
  }

  if (board) {
    buildIndex();
    $('[data-ws-scene]').textContent = board.scene.titleAr || 'ذكرى';
    const first = board.roots[0];
    if (first) {
      state.open = { kind: 'text', id: first.id };
      /*
       * ⚠️ **ومستوًى واحدٌ مفرودٌ عند أوّل فتح** (بند ٣): شجرةٌ مطويّةٌ
       *    بالكامل تجعل أوّلَ ما تراه في الورشة **جذرًا واحدًا** لا
       *    يقول شيئًا عن بنية الذكرى. ومستوًى واحدٌ يكفي ليقول «فيه
       *    أجزاء» بلا أن يغرقك — والباقي بيدك.
       */
      state.expanded.add(first.id);
    }
  }
  paintNav();
  paintDoc({ force: true });
  applyShell();
  applyChrome();

  /*
   * ⚠️ **مستمعٌ واحدٌ مفوَّضٌ على الشاشة** — وكلُّه يأخذ إشارةَ القطع،
   *    لأن الشاشةَ تُغادَر ويجب أن يموت معها.
   */
  main.addEventListener('click', async (event) => {
    /*
     * ⚠️ **أزرارُ الصوت المشتركة تُوجَّه أوّلًا** (بند ٩): هي لا تحمل
     *    `data-ws` لأنّها ليست فعلًا خاصًّا بالورشة — هي عقدٌ عامٌّ
     *    يستعمله أيُّ سطحٍ فيه تشغيل.
     */
    const sound = event.target.closest('[data-audio-btn]');
    if (sound) { playItem(sound.dataset.audioBtn); return; }

    const btn = event.target.closest('[data-ws]');
    if (!btn) return;
    const act = btn.dataset.ws;
    const id = btn.dataset.id;

    switch (act) {
      case 'drawer': {
        state.drawer = btn.dataset.v || null;
        if (state.drawer === 'insp') state.inspector = true;
        applyShell();
        if (state.drawer === 'insp') paintInsp();
        return undefined;
      }
      case 'rail': {
        state.chrome.rail = state.chrome.rail === 'compact' ? 'full' : 'compact';
        writeChromePrefs(state.chrome);
        applyChrome();
        /* العرضُ الفعليُّ تغيّر — فتُعاد قسمةُ الألواح على ما بقي. */
        state.panes = effectivePanes($('.ws')?.clientWidth || window.innerWidth);
        applyShell();
        return undefined;
      }
      case 'zen': {
        /*
         * ⚠️ **وضعُ التركيز يخفي ولا يعيد التحميل** (بند ٧): لا إعادةَ
         *    رسمٍ للمستند، ولا تصفيرَ تحديد، ولا فقدَ مسوّدة — سِمةٌ على
         *    الجذر والـCSS تتولّى الباقي. والصوتُ لا يشعر بها أصلًا.
         */
        state.zen = !state.zen;
        btn.setAttribute('aria-pressed', state.zen ? 'true' : 'false');
        applyShell();
        return undefined;
      }
      case 'insp': {
        state.inspector = !state.inspector;
        if (state.inspector) {
          const root = $('.ws');
          const fit = paneFit(root?.clientWidth || window.innerWidth, state.panes);
          if (!fit.inspDocked) state.drawer = 'insp';
          paintInsp();
        } else {
          state.drawer = null;
        }
        applyShell();
        return undefined;
      }
      case 'insp-close': {
        state.inspector = false;
        state.drawer = null;
        applyShell();
        return undefined;
      }
      case 'tab': state.tab = btn.dataset.v; return paintInsp();
      case 'tab-media': {
        state.inspector = true; state.tab = TAB.MEDIA;
        applyShell(); return paintInsp();
      }

      case 'nav-node': return selectNode(id);
      case 'twist': return toggleTwist(id);
      case 'nav-more': {
        const now = state.shown.get(id) ?? 150;
        state.shown.set(id, now + 150);
        return paintNav();
      }
      case 'nav-more-rows': {
        state.navBudget += NAV_MAX_ROWS;
        return paintNav();
      }
      case 'nav-clear': {
        state.navQuery = '';
        state.navBudget = NAV_MAX_ROWS;
        paintNav();
        $('[data-ws-nav-find]')?.focus();
        return undefined;
      }
      case 'node-menu': return openNodeMenu(id);
      case 'add': return openAddMenu();
      case 'new-root': return newRoot();
      case 'upload': return uploadFiles(btn.dataset.kind);

      case 'mode': return setMode(btn.dataset.v);
      case 'save': return saveDraft();
      case 'dmode': {
        /* ⚠️ يُحفَظ موضعُ النمط المغادَر **قبل** تبديله، وإلّا حُفظ في خانة الجديد. */
        const el = $('[data-ws-doc]');
        if (el) state.docScroll[state.docMode] = el.scrollTop;
        state.docMode = btn.dataset.v;
        return paintDoc({ keepScroll: true, force: true });
      }

      case 'open-media': return openMedia(id, btn.dataset.kind);
      case 'rename-media': return renameMedia(id);
      case 'play': return playItem(id);
      case 'toggle': return audio.state.playing ? audio.pause() : audio.play();
      case 'zoom': return openLightbox(id, state.sceneId);
      case 'fetch': {
        state.fetching.add(id);
        paintDoc({ keepScroll: true });
        try {
          await ensureBytes(id);
          state.fetching.delete(id);
          await refresh();
        } catch (error) {
          state.fetching.delete(id);
          paintDoc({ keepScroll: true });
          toastError(`التنزيل فشل: ${error?.message || 'مش متاح'}`);
        }
        return undefined;
      }

      case 'link-add': return openLinkPicker();
      case 'unlink': return dropLink(id, btn.dataset.at || null);
      case 'link-current': {
        const now = audio.state.mediaId;
        if (!now) return toastError('مفيش صوت شغّال');
        if (state.open?.kind !== 'text') return toastError('افتح المكان الأول');
        return commitLink([now], state.open.id);
      }

      case 'media-filter': state.mediaFilter = btn.dataset.v; return paintInsp();
      case 'retry-load': {
        state.loading = true; state.error = null;
        paintNav();
        await refresh();
        state.loading = false;
        return paintNav();
      }
      case 'shadow': {
        const { openShadowForScript } = await import('../services/shadow/shadow-entry.js');
        return openShadowForScript(id, state.sceneId);
      }
      default: return undefined;
    }
  }, wired());

  /* البحثُ والكتابة — كلٌّ يعيد رسمَ لوحِه وحدَه. */
  let navTimer = null;
  main.addEventListener('input', (event) => {
    const t = event.target;

    if (t.matches('[data-ws-nav-find]')) {
      state.navQuery = t.value;
      /* ⚠️ بحثٌ جديدٌ يعني سقفًا جديدًا — وإلّا ورث السقفَ الموسَّع بلا سبب. */
      state.navBudget = NAV_MAX_ROWS;
      /*
       * ⚠️ **ولا يُعاد بناءُ الشجرة عند كلّ حرف** (بند ١٥): على أربعة
       *    آلاف عقدةٍ كان ذلك مسحًا كاملًا كلَّ ٤٠ مِلّي. فتأخيرٌ قصيرٌ
       *    يجمع الضغطات، والفهرسُ جاهزٌ من الخدمة أصلًا.
       */
      clearTimeout(navTimer);
      navTimer = setTimeout(() => {
        paintNav();
        const box = $('[data-ws-nav-find]');
        if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      }, 140);
      return;
    }

    if (t.matches('[data-ws-doc-find]')) {
      state.docQuery = t.value;
      const paper = $('[data-ws-paper]');
      const node = nodeById(state.open?.id);
      if (!paper || !node) return;
      const text = node.text || '';
      paper.innerHTML = looksLikeDialogue(text) && state.docMode === 'chat'
        ? chatHtml(text)
        : `<pre class="ws-raw" dir="auto">${withMarks(text, state.docQuery)}</pre>`;
      return;
    }

    if (t.matches('[data-ws-media-find]')) {
      state.mediaQuery = t.value;
      paintInsp();
      const box = $('[data-ws-media-find]');
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      return;
    }

    /*
     * ⚠️ **الكتابةُ تحدّث الحالةَ والشارةَ فقط** (بند ١٣): لا رسالةَ
     *    نجاحٍ عند كلّ حرف، ولا إعادةَ رسمٍ للحقل — المؤشّرةُ تبقى مكانها.
     */
    if (t.matches('[data-ws-edit-title]') || t.matches('[data-ws-edit-text]')) {
      const d = state.draft;
      if (!d) return;
      if (t.matches('[data-ws-edit-title]')) d.title = t.value; else d.text = t.value;
      const next = draftChanged(d) ? SAVE.DIRTY : SAVE.CLEAN;
      if (d.status !== next && d.status !== SAVE.SAVING) { d.status = next; paintSave(); }
    }
  }, wired());

  main.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.drawer) { closeDrawer(); return; }
      if (state.zen) { state.zen = false; applyShell(); return; }
    }
    /* Ctrl/Cmd + S يحفظ في وضع التحرير — عادةٌ لا يجب أن تفتح حوارَ المتصفّح. */
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
        && state.mode === MODE.EDIT) {
      event.preventDefault();
      saveDraft();
      return;
    }
    navKeys(event);
  }, wired());

  /* التمريرُ اليدويُّ يُلتقَط — اللوحُ المخفيُّ يفقد `scrollTop`. */
  for (const [key, sel] of Object.entries(SCROLLERS)) {
    $(sel)?.addEventListener('scroll', () => {
      const el = $(sel);
      if (!el) return;
      state.scroll[key] = el.scrollTop;
    }, wired({ passive: true }));
  }

  main.addEventListener('pointerdown', (event) => {
    const split = event.target.closest('[data-ws-split]');
    if (split) { startResize(event, split.dataset.wsSplit); return; }

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
   * ⚠️ **والتخطيطُ يُعاد حسابُه عند تغيّر العرض الفعليّ** (بند ٨): دورانُ
   *    الجهاز أو انقسامُ الشاشة يغيّر ما يتّسع — بلا سؤالِ ترويسةِ متصفّح.
   */
  window.addEventListener('resize', () => {
    state.panes = effectivePanes($('.ws')?.clientWidth || window.innerWidth);
    applyShell();
  }, wired({ passive: true }));

  /*
   * ⚠️ **الشريطُ مشتركٌ لا مالك** (بند ٣٥): يرسم ما تقوله الخدمة، ولا
   *    يملك عنصرَ الصوت — فلا يستطيع أن يوقفه بإعادة رسم.
   */
  stopAudioWatch = subscribeAudio((snapshot) => paintNow(snapshot));
}

/**
 * يُنعش الورشةَ **في مكانها** — بلا إعادة رسمٍ من الصفر.
 *
 * ⚠️ تُنادى من `ui-state` بعد رفعِ ملفٍّ أو إغلاق عارض. و`renderWorkspace`
 *    لا تصلح هنا: هي تُصفّر المفتوحَ والوضعَ والمسوّدةَ والتمرير.
 */
export async function reloadWorkspace() {
  if (!board || !state.sceneId) return;
  await refresh({ doc: state.mode !== MODE.EDIT });
}

export function disposeWorkspace() {
  document.body.classList.remove('workspace-open');
  /* ⚠️ القشرةُ تعود كما كانت — الورشةُ استعارت شكلَها ولم تملكه. */
  document.body.classList.remove('ws-rail-compact', 'ws-fabs-on');
  wires?.abort();
  wires = null;
  stopAudioWatch?.();
  stopAudioWatch = null;
  clearTimeout(savedTimer);
  board = null;
  /*
   * ⚠️ **ولا يُوقَف الصوت عند المغادرة.** هو خدمةٌ عامّةٌ منذ WS28،
   *    وإيقافُه هنا يكسر «الصوت يكمل والتابلت مقفول» (WS51).
   */
  releaseUrls();
}

/** ⚠️ للتجربة الميدانيّة والاختبار وحدَهما — لا يُنادى من الواجهة. */
export const __wsp = {
  state, selectNode, openMedia, setMode, saveDraft, refresh, applyChrome, renameMedia,
  playItem, commitLink, dropLink, revealAndOpen, applyShell,
};

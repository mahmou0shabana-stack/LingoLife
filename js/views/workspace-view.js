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
import { PAIR_STATUS as DRAFT_STATUS } from '../services/shadow/bilingual.js';
import { translationView } from '../services/shadow/draft-structure.js';
import { draftPairs } from '../services/study-draft.js';

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
  /**
   * ═══════════════════════════════════════════════════════════
   * ⚠️ **هُويّةُ التحديد الواحدة** (WS-P3 · بنود ٣ و١٤ و١٦ · قاعدة ٧)
   * ═══════════════════════════════════════════════════════════
   *
   * `node` هو **العقدةُ المحدَّدة** — مصدرُ الحقيقة الوحيدُ لما يُبرزه
   * المُتصفِّحُ ولما تقوله ترويسةُ المساحة. لا يُشتقُّ من DOM ولا يُكتَب
   * بصنفٍ محلّيٍّ على صفّ: «التحديدُ حالةٌ لا تنسيقٌ عابر».
   *
   * `open` هو **ما تعرضه المساحةُ الآن**: العقدةُ نفسُها، أو وسيطٌ
   * تحتها. والاثنان ليسا شيئًا واحدًا — وهذا بيتُ القصيد:
   *
   *    ⚠️ **كان `open` وحدَه هو التحديد**، فما إن تفتحَ صوتًا أو صورةً
   *       حتّى لا يبقى في الشجرة صفٌّ مُبرَزٌ أصلًا — يختفي مكانُك
   *       تمامًا. وهذا بالضبط ما بلّغتَ عنه: «العنصرُ المحدَّدُ غيرُ
   *       واضحٍ ولا يدوم».
   *
   *    ⚠️ **وحالةُ «وسيطٌ داخل عقدة» حالةٌ فرعيّةٌ مصرَّحٌ بها** (بند ١٦)
   *       لا حالةٌ ثالثةٌ مستقلّة: الشجرةُ تبقى على العقدة، والترويسةُ
   *       تقول العقدةَ ثمّ الوسيطَ تحتها. فلا يقع أبدًا أن يُبرِز
   *       المتصفِّحُ «أ» بينما تعرض المساحةُ «ب» بلا نسبٍ بينهما.
   */
  node: null,
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
  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **حالتان لا حالةٌ واحدة** (WS-P4 · بندا ١٦ و٦)
   * ═══════════════════════════════════════════════════════════════
   *
   * `state.node` هي **العقدةُ التي تقرؤها** — تحديدٌ أوّليٌّ يملك
   * المُتصفِّحَ والمسار. و`state.mediaSel` هو **الوسيطُ الذي في يدك
   * داخلها** — تحديدٌ محلّيٌّ ثانويّ.
   *
   * ودمجُهما في حالةٍ واحدةٍ هو العطبُ الذي ينهى عنه البندُ ١٦ حرفيًّا:
   * لمسُ صورةٍ في لوح الوسائط يجب ألّا يزحزح مكانَك في الشجرة.
   */
  mediaSel: null,
  /*
   * ⚠️ **المعاينةُ الجانبيّةُ تعيش داخل مساحة العمل** (بندا ٨ و٣٤):
   *    معرِّفُ صورةٍ واحدةٍ لا أكثر — «One Side Preview slot only»
   *    (بند ١٤). ونسبةُ الانقسام حالةُ جلسةٍ لا تُحفَظ (بند ١١).
   */
  side: null,
  sideRatio: 0.64,
  /** وضعُ التحديد المتعدّد في لوح الوسائط — يُدخَل صراحةً (بند ٢٢). */
  pickMode: false,
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
/** أسلافُ الصفّ المحدَّد — تُملأ في `navHtml` وتُقرأ في `navRowHtml`. */
let navPath = new Set();
/**
 * وحداتُ المسودّة المفتوحة — **تُشتقّ مرّةً عند الفتح لا في كلّ رسمة**.
 *
 * ⚠️ `draftPairs` تقرأ المحفوظَ أو تحلّل النصَّ كلَّه. ونداؤها داخل
 *    `draftDocHtml` يعني إعادةَ تحليلٍ كامل مع كلّ إعادةِ رسمٍ للسطح —
 *    وهي تقع عند كلّ تبديلِ وضعٍ وكلّ حفظٍ وكلّ إعادةِ قراءة.
 */
let draftUnits = [];
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
 * اسمٌ مقصوصٌ لعنوان نافذة.
 *
 * ⚠️ **والقصُّ للعنوان وحدَه لا للسياق**: الاسمُ كاملًا يبقى في متن
 *    النافذة (سطرُ «ربط: …»)، فلا يضيع منك شيءٌ لأن الشريطَ ضيّق.
 */
const itemLabel = (text, max = 28) => {
  const one = String(text || '').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

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

/** مسودّةُ مذاكرةٍ بمعرّفها — من خريطةِ اللوحة لا بسؤالٍ للقاعدة. */
const draftById = (id) => (id ? board?.draftById?.get(id) || null : null);

/** مسودّاتُ عقدةٍ — مصفوفةٌ دائمًا، فارغةٌ إن لم تكن. */
const draftsOf = (nodeId) => (nodeId ? board?.draftsOf?.get(nodeId) || [] : []);

/** العنصرُ المفتوحُ أيًّا كان نوعُه — أو `null` إن اختفى من القاعدة. */
function openRecord() {
  if (!state.open) return null;
  if (state.open.kind === 'text') return nodeById(state.open.id);
  if (state.open.kind === 'draft') return draftById(state.open.id);
  return mediaById(state.open.id);
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
  /* ⚠️ النطاقُ يتبع **التحديد** لا المعروض: صوتٌ مفتوحٌ لا ينقل «أين أضيف». */
  const at = state.node ? board.targetById.get(state.node) : null;
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
          ⚠️ **فيه ١٧١٠ مخفيّة» بلا بابٍ إليها ليس إعلامًا — هو حائط**
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

  /*
   * ⚠️ **التحديدُ من `state.node` لا من `state.open`** (بنود ٣ و١٦).
   *    كان `open` وحدَه هو المصدر، فما إن تفتحَ صوتًا حتّى لا يبقى صفٌّ
   *    مُبرَزٌ في الشجرة إطلاقًا: يختفي مكانُك في اللحظة التي تحتاجه
   *    فيها أكثر. والآن يبقى الصفُّ محدَّدًا مهما فعلتَ في المساحة.
   *
   * ⚠️ **وصفٌّ واحدٌ فقط `is-on`** (بند ٤). أمّا الأسلافُ فلهم
   *    `is-path` — أثرٌ أخفُّ يقول «الطريقُ إلى مكانك يمرّ هنا»، ولا
   *    يُلبِس بينه وبين التحديد نفسِه.
   */
  const on = state.node === row.id;
  const path = !on && navPath.has(row.id);
  const t = row.target;
  const media = t ? t.own.audio + t.own.images : 0;
  const under = t ? t.sub.audio + t.sub.images : 0;
  const drafts = draftsOf(row.id).length;

  return html`
    <li class="ws-nav-row ${on ? 'is-on' : ''} ${path ? 'is-path' : ''}
               ${row.hidden ? 'is-hidden' : ''} ${row.hit ? 'is-hit' : ''}"
        style="--ws-d:${row.depth}" role="none"
        ${on ? 'data-ws-here' : ''}>
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
            ⚠️ **ولا كلمةُ جزء» بجوار أيقونة الجزء** (بند ١٠): إشارتان
               تقولان الشيءَ نفسَه، والثمنُ مقيس — على مُتصفِّحٍ عرضُه
               ٢٨٠px كانت PART 1 — المفردات الأساسية» تُقَصّ إلى
               PART 1 — ...ساسية». والنوعُ مكتوبٌ كاملًا في رأس المستند
               وفي الخصائص»، فمكانُه هناك لا هنا.
          -->
          <!--
            ⚠️ **العدُّ المباشرُ والتراكميُّ لا يُخلَطان** (بند ٢٣): ٢ عليها»
               ما عُلِّق على العقدة نفسِها، و+٧ تحتها» ما في أبنائها.
               ورقمٌ واحدٌ يجمعهما لا يقول أيَّهما.
          -->
          ${raw(media ? html`<b title="مربوط بالعقدة دي">${media}</b>` : '')}
          ${raw(under ? html`<em title="مربوط بما تحتها">+${under}</em>` : '')}
          <!--
            ⚠️ **وأثرُ مذاكرتك يُرى من الشجرة** (بند ١٦): كتبتَ مسودّةً
               عن جملةٍ في هذه العقدة، فتقول العقدةُ ذلك. وقبله كانت
               المسودّةُ حقيقةً في القاعدة وغيبًا على هذه الشاشة.
          -->
          ${raw(drafts ? html`<u class="ws-nav-draft" title="ليها مسودّة مذاكرة">✎${drafts}</u>` : '')}
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

  /* أسلافُ المحدَّد — تُحسَب مرّةً للقائمة كلِّها لا صفًّا صفًّا. */
  navPath = state.node ? new Set(ancestorsOf(board, state.node)) : new Set();
  navPath.delete(state.node);

  const empty = state.navQuery
    ? html`<div class="ws-empty">
        <p>مفيش نتيجة لـ «${state.navQuery.trim()}»</p>
        <button type="button" class="ws-btn ws-btn-soft" data-ws="nav-clear">امسح البحث</button>
      </div>`
    : html`<div class="ws-empty">
        <p>الذكرى دي لسّه مفيهاش سكريبتات</p>
        <button type="button" class="ws-btn" data-ws="new-root">+ إضافة سكريبت</button>
      </div>`;

  /*
   * ⚠️ **التحديدُ الذي صفّاه البحثُ يُعلَن، لا يُترَك يختفي** (بندا ٣ و١٤).
   *
   *    قاسه الفحصُ الحيّ: تبحث عن «حشو» فيصير عددُ الصفوف المحدَّدة صفرًا،
   *    بينما الترويسةُ ما زالت على «جولة عميقة». والهُويّةُ لم تضِع
   *    (`state.node` كما هو)، لكنّ الصفَّ **غيرُ مرسومٍ أصلًا** لأنّه لا
   *    يطابق البحث. فالخيارُ بين ثلاثة:
   *
   *      · نُقحِم الصفَّ في النتائج — كذبٌ على البحث.
   *      · نُلغي التحديد — خسارةُ مكانك بلمسةِ بحثٍ عابرة.
   *      · **نقول أين أنت ونعطيك بابَ العودة** — وهذا ما هنا.
   */
  const hiddenPick = state.node && state.navQuery
    && !rows.some((row) => row.type === 'item' && row.id === state.node);

  return html`
    ${raw(navHeadHtml())}
    ${raw(state.navQuery
      ? html`<p class="ws-nav-hits" role="status">${hits} نتيجة</p>` : '')}
    ${raw(hiddenPick ? html`
      <p class="ws-nav-away" role="status">
        <span dir="auto">إنت واقف على: <b>${board.targetById.get(state.node)?.title || '—'}</b>
          — مش ظاهر في نتيجة البحث دي</span>
        <button type="button" data-ws="nav-clear">رجّعني له</button>
      </p>` : '')}
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

/**
 * المسارُ في الترويسة — **مشتقٌّ من `state.node` نفسِه** (بند ١٤).
 *
 * ⚠️ **ولهذا لا يقع اختلافٌ بين ما يُبرزه المتصفِّحُ وما تقوله الترويسة**:
 *    ليس لكلٍّ منهما مصدرُه. المتصفِّحُ يقرأ `state.node`، والترويسةُ
 *    تقرأ `state.node`. والاتّفاقُ هنا بنيويٌّ لا اتّفاقُ مصادفة — أمّا
 *    مطابقةُ سلسلتين مستقلّتين فتظلّ عرضةً لأن تفترقا في حالةٍ لم تُجرَّب.
 *
 * ⚠️ **والوسيطُ يُضاف ذيلًا لا يستبدل المسار** (بند ١٦): حين تفتح صوتًا
 *    تحت عقدةٍ تبقى العقدةُ في المسار ويأتي الصوتُ بعدها. فتعرف دائمًا
 *    **أين** أنت، لا الملفَّ وحدَه معلَّقًا في الفراغ.
 */
function crumbHtml() {
  const open = state.open && state.open.kind !== 'text' ? openRecord() : null;
  /*
   * ⚠️ **والمسودّةُ حالةٌ فرعيّةٌ داخل عقدتها لا مصدرٌ آخر** (بند ٢٢):
   *    نفسُ عهد الوسائط في WS-P3 — المسارُ يبقى على العقدة، والمسودّةُ
   *    تأتي بعدها. فتعرف دائمًا **مِن أين** جاءت هذه المسودّة.
   */
  if (state.open?.kind === 'draft' && state.node) {
    const crumbs = crumbsOf(board, state.node);
    return html`
      <nav class="ws-crumbs" aria-label="المسار">
        ${raw(crumbs.map((one, i) => html`
          ${raw(i ? '<span class="ws-crumb-sep" aria-hidden="true">·</span>' : '')}
          <button type="button" class="ws-crumb" data-ws="nav-node"
                  data-id="${one.id}" dir="auto">${one.title}</button>`).join(''))}
        <span class="ws-crumb-sep" aria-hidden="true">·</span>
        <span class="ws-crumb is-now">مسودّة</span>
      </nav>`;
  }
  /*
   * ═══════════════════════════════════════════════════════════
   * ⚠️ **مكانُك يُذكَر دائمًا — والوسيطُ لا يُنسَب إليه كذبًا**
   * ═══════════════════════════════════════════════════════════
   *
   * حالتان مختلفتان لا تُخلَطان:
   *
   *   · **تحتها**: الصوتُ مربوطٌ بالعقدة المحدَّدة فعلًا → يأتي ذيلًا
   *     للمسار: «المرحلة ١ · جزء أ · جولة عميقة · voice-note».
   *
   *   · **من المكتبة**: فتحتَه من مكتبة وسائط الذكرى وهو غيرُ مربوطٍ
   *     بمكانك → المسارُ يبقى كاملًا على مكانك، ويأتي الوسيطُ في
   *     **شارةٍ مُعلَّمة**: «⟨من الوسائط: لوحة.png⟩».
   *
   * ⚠️ **ولمَ يبقى المسارُ في الحالة الثانية؟** لأنّ أوّلَ صياغةٍ كتبتُها
   *    أسقطته وأبدلته بـ«الوسائط · اسم» — فوقعت في عين ما نهى عنه البند
   *    ١٤: المتصفِّحُ يُبرِز «جزء ب» والترويسةُ لا تذكرها بحرف. كشفه
   *    الاختبارُ ١١ بالضبط. والصوابُ أن يُقال الاثنان: أين أنت، وما هذا
   *    الذي تنظر إليه — وأنّه ليس منها.
   */
  const here = open && state.node ? mediaOf(board, state.node) : null;
  /* ⚠️ `mediaOf` تعيد `{ audio, images }` لا مصفوفةً — والفرقُ كلّفني اختبارين. */
  const inside = Boolean(here
    && [...here.audio, ...here.images].some((one) => one.id === open.id));

  if (!state.node) {
    return html`<nav class="ws-crumbs" aria-label="المسار">
      <button type="button" class="ws-crumb" data-ws="tab-media">الوسائط</button>
      <span class="ws-crumb-sep" aria-hidden="true">·</span>
      <span class="ws-crumb is-now" dir="auto">${open ? itemTitle(open) : '—'}</span>
    </nav>`;
  }

  const crumbs = crumbsOf(board, state.node);
  return html`
    <nav class="ws-crumbs" aria-label="المسار">
      ${raw(crumbs.map((one, i) => html`
        ${raw(i ? '<span class="ws-crumb-sep" aria-hidden="true">·</span>' : '')}
        ${raw(one.current && !open
          ? html`<span class="ws-crumb is-now" dir="auto">${one.title}</span>`
          : html`<button type="button" class="ws-crumb" data-ws="nav-node"
                         data-id="${one.id}" dir="auto">${one.title}</button>`)}`).join(''))}
      ${raw(open && inside ? html`
        <span class="ws-crumb-sep" aria-hidden="true">·</span>
        <span class="ws-crumb is-now" dir="auto">${itemTitle(open)}</span>` : '')}
      ${raw(open && !inside ? html`
        <span class="ws-crumb is-now ws-crumb-loose" data-ws-loose dir="auto"
              title="مش مربوط بالمكان اللي إنت واقف فيه">
          من الوسائط: ${itemTitle(open)}</span>` : '')}
    </nav>`;
}

/**
 * شريطُ الأوضاع — **قراءة · تحرير · ربط** (WS-P4-C · بنود ١ إلى ٣).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **تدقيقُ WS-P4 كان صحيحًا تقنيًّا وناقصًا تجربةً — وهذا هو الدرس**
 * ═══════════════════════════════════════════════════════════════
 *
 * فُحص `MODE.LINK` فلم يُوجَد له **عملٌ على البيانات** لا يفعله غيرُه،
 * فأُسقط. والفحصُ صحيحٌ حرفًا بحرف. لكنّه سأل سؤالًا واحدًا: «ما
 * العمليّةُ التي يملكها؟» ونسي السؤالَ الثاني: **«ما البابُ الذي
 * يفتحه؟»**
 *
 * وكان يفتح **اللوحَ الجانبيَّ الأيسر**. وبإسقاطه لم يبقَ للوح مدخلٌ
 * يُرى: صار وراء زرٍّ اسمُه «تفاصيل» — وهي كلمةٌ لا تَعِد أحدًا بلوحِ
 * ربطٍ ووسائط. فاختفى اللوحُ عمليًّا وإن بقي في الكود.
 *
 * ⚠️ **والدرسُ يستحقّ الكتابةَ**: «لا عمليّةَ فريدة» ليست «لا وظيفةَ
 *    فريدة». التنقّلُ وظيفة، والاكتشافُ وظيفة. وحذفُ عنصرٍ لأنّه لا
 *    يكتب في القاعدة يحذف معه الطريقَ إلى ما يكتب.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **و«ربط» هنا ليست «ربط» التي على الصفّ — ولا واحدةَ منهما تُلغي
 *    الأخرى** (بند ٤)
 * ═══════════════════════════════════════════════════════════════
 *
 *   · `link-item` بجوار الوسيط  ← **عمليّةٌ مباشرة**: اربط هذا الآن.
 *   · «ربط» هنا                  ← **بابٌ**: افتح لوحَ الربط والوسائط.
 *
 * وهما في نظر المستخدم شيئان، وإن التقيا في المعنى اللغويّ.
 *
 * ⚠️ **وحالتُها تُقرأ من `state.inspector` لا من `state.mode`** (بند ٣).
 *    ولو جُعلت وضعًا (`MODE.LINK`) لَبقيت مضاءةً بعد أن تُغلق اللوحَ
 *    بـ ✕ — فتقول الشاشةُ «أنت في الربط» ولا لوحَ مفتوح. والزرُّ يصف
 *    شيئًا واحدًا: **هل اللوحُ مفتوح؟**
 *
 * ⚠️ **ولذلك هي زرُّ ضغطٍ لا تبويب**: `aria-pressed` لا `aria-selected`،
 *    وخارجَ `role="tablist"`. الأوضاعُ تُنتقى واحدًا من اثنين، واللوحُ
 *    يُفتَح ويُغلَق. ووضعُها في التبويبات كان سيَعِد قارئَ الشاشة بما
 *    لا يحدث.
 */
function modeSwitchHtml() {
  /* ⚠️ والمسودّةُ تُقرأ ولا تُحرَّر — مادّةٌ مشتقّةٌ لا مصدر (بند ١٨). */
  const kinds = state.open?.kind === 'text'
    ? [MODE.READ, MODE.EDIT]
    : [MODE.READ];
  const on = state.inspector;
  return html`
    <div class="ws-modes">
      <div class="ws-modes-tabs" role="tablist" aria-label="وضع الشغل">
        ${raw(kinds.map((one) => html`
          <button type="button" class="ws-mode ${state.mode === one ? 'is-on' : ''}"
                  role="tab" aria-selected="${state.mode === one ? 'true' : 'false'}"
                  data-ws="mode" data-v="${one}">${MODE_LABEL[one]}</button>`).join(''))}
      </div>
      <button type="button" class="ws-mode ws-mode-link ${on ? 'is-on' : ''}"
              data-ws="link-panel" data-ws-link-btn
              aria-pressed="${on ? 'true' : 'false'}" aria-controls="ws-inspector"
              title="${on ? 'اقفل لوح الربط' : 'افتح لوح الربط والوسائط'}"
        >${MODE_LABEL[MODE.LINK]}</button>
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

  const isDraft = state.open.kind === 'draft';
  const isText = state.open.kind === 'text';
  const target = isText ? board.targetById.get(state.open.id) : null;
  const title = isText ? record.title
    : (isDraft ? (record.subjectText || 'مسودّة') : itemTitle(record));

  const facts = [];
  if (isDraft) {
    /* ⚠️ أرقامٌ محسوبةٌ من الوحدات نفسِها لا مكتوبةٌ في التصميم. */
    const pairs = draftUnits.filter((one) => one.ru && one.ar).length;
    facts.push('مادّة مذاكرة مشتقّة');
    facts.push(`${draftUnits.length} وحدة`);
    if (pairs) facts.push(`${pairs} زوج للتدريب`);
  } else if (isText && target) {
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
          <!--
            ⚠️ **والربطُ فعلٌ من الصفّ الأوّل** (بند ٦): كان مخبوءًا خلف
               المُفتِّش ← تبويب الربط ← + إضافة رابط». وهو هنا بجانب
               تدرّب» — أي حيث تنظر وأنت في العقدة نفسِها.
          -->
          ${raw(isText && state.mode !== MODE.EDIT ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="link-into"
                    data-id="${state.open.id}">${raw(icon('link', 15))} ربط</button>
            <button type="button" class="ws-btn ws-btn-soft" data-ws="shadow"
                    data-id="${state.open.id}">تدرّب</button>` : '')}
          <!--
            ⚠️ **اتدرب على المسودة» هو الزرُّ القائم منذ WS25** (بند ٢١):
               لم يُبنَ وضعُ تدريبٍ جديد. هذا مدخلٌ إليه من مكانٍ لم يكن
               له فيه مدخل — سطحُ قراءة المسودّة في صفحة النصوص.

            ⚠️ **والأصل» بجانبه** (بند ١٩): طريقُ العودة خفيفٌ ومرئيّ،
               ولا عمودَ تنقّلٍ ثالثٌ يُضاف لأجله.
          -->
          ${raw(isDraft ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="draft-back"
                    data-id="${state.node || ''}">← النصّ الأصلي</button>
            <button type="button" class="ws-btn ws-btn-primary" data-ws="draft-practice"
                    data-id="${record.id}">اتدرب على المسودة</button>` : '')}
          ${raw(!isText && !isDraft ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="link-item"
                    data-id="${record.id}">${raw(icon('link', 15))} ربط</button>` : '')}
          <!--
            ⚠️ **عرض جنب النص» مدخلٌ ثانٍ من العارض نفسِه** (بند ٩):
               وأنت داخل الصورة قد تقرّر أنّك تريدها بجوار نصّها. وحالتُه
               مُعلَنةٌ في نصّه فلا يترك سؤالًا عمّا حدث.
          -->
          ${raw(!isText && record.kind === 'image' ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="side-open"
                    data-id="${record.id}"
                    aria-pressed="${state.side === record.id ? 'true' : 'false'}">
              ${raw(icon('compare', 15))}
              ${state.side === record.id ? 'اقفل المعاينة' : 'عرض جنب النص'}
            </button>
            <button type="button" class="ws-btn ws-btn-soft" data-ws="zoom"
                    data-id="${record.id}">كبّر</button>` : '')}
          ${raw(!isText && !isDraft ? html`
            <button type="button" class="ws-btn ws-btn-soft" data-ws="rename-media"
                    data-id="${record.id}">سمّيه</button>` : '')}
          <!--
            ═══════════════════════════════════════════════════════
            ⚠️ **المُفتِّش» اسمٌ برمجيٌّ لا اسمُ شيءٍ تعرفه** (بندا ١١ و١٢)
            ═══════════════════════════════════════════════════════

            المكوّنُ في الكود اسمُه Inspector، وذلك شأنُ الكود. أمّا
            الزرُّ فيقول **ما وراءه**: تفاصيلُ العنصر — روابطُه وخصائصُه
            ومكتبةُ وسائط الذكرى. والمُفتِّش» لا تقول شيئًا من ذلك.

            ⚠️ **ولم يعُد بابَ الربط** (بند ١١): الربطُ صار على العنصر
               نفسِه، فهبط هذا الزرُّ من أداةٍ لا بدّ منها» إلى تفاصيلُ
               إن أردت». ولذلك أيقونتُه لم تعُد سلسلةً — السلسلةُ الآن
               تعني اربط» في كلّ مكانٍ من الشاشة، ومعنًى واحدٌ لرمزٍ
               واحد.
          -->
          <button type="button" class="ws-btn ws-btn-soft ws-insp-toggle" data-ws="insp"
                  aria-expanded="${state.inspector ? 'true' : 'false'}"
                  aria-controls="ws-inspector">
            ${raw(icon('info', 15))} <span>تفاصيل</span>
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

  if (state.open.kind === 'draft') return draftDocHtml(record);
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
      </div>
      <!-- ⚠️ وعقدةٌ بلا نصٍّ قد يكون عليها صوتٌ أو صورة — فلا يُبتَر المربوط. -->
      ${raw(attachedHtml(node.id))}`;
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
    </article>
    ${raw(draftsHtml(node.id))}
    ${raw(attachedHtml(node.id))}`;
}

/* ================================================================== *
 * مسودّاتُ المذاكرة داخل صفحة النصوص (WS-DR · بنود ١٤ إلى ٢٣)
 * ================================================================== */

/**
 * ⚠️ **بلاغُك**: «المسودّةُ المحفوظةُ يجب ألّا تكون مخبوءةً خلف
 *    "اتدرب على المسودة" وحدَه — أريد أن أفتح النصَّ الأصليّ، وأرى أنّ
 *    له مسودّة، وأفتحها، وأقرأها، وأعود».
 *
 * فهذه هي الحلقةُ الناقصة: كانت المسودّةُ تُكتَب في لوحة الظلّ وتُقرأ
 * من هناك وحدَها. ولا سبيلَ من صفحة المحتوى العاديّة إليها إطلاقًا.
 *
 * ⚠️ **ولا تُنسَخ إلى سكريبتٍ جديد** (بند ١٥): هذه إشارةٌ إلى الصفّ
 *    القائم في `studyDrafts`. راجع `draftsForBoard` في الخدمة.
 */
function draftsHtml(nodeId) {
  const rows = draftsOf(nodeId);
  if (!rows.length) return '';
  return html`
    <section class="ws-drafts" aria-label="مسودّات المذاكرة">
      <div class="ws-attached-head">
        <h3>مسودّات مذاكرة</h3>
      </div>
      <ul class="ws-items">
        ${raw(rows.map((one) => html`
          <li class="ws-item" data-ws-draft="${one.id}">
            <span class="ws-item-face" aria-hidden="true">
              <span class="ws-item-icon">${raw(icon('note', 17))}</span>
            </span>
            <span class="ws-item-t" dir="auto">${one.subjectText || 'مسودّة'}</span>
            <span class="ws-item-acts">
              <button type="button" class="ws-btn ws-btn-soft ws-btn-tiny"
                      data-ws="open-draft" data-id="${one.id}">افتحها</button>
            </span>
          </li>`).join(''))}
      </ul>
    </section>`;
}

/**
 * سطحُ قراءةِ المسودّة — **وثيقةُ تعلّمٍ لا جدولُ تصحيح** (بند ١٨).
 *
 * ⚠️ **والفرقُ بينها وبين شاشة المراجعة مقصود**: المراجعةُ عملُ
 *    استيرادٍ فيه أزرارُ ربطٍ وفكّ وحالاتٌ تقنيّة. وهذه للقراءة: أقسامٌ
 *    بعناوينها، ومقاطعُ بترجماتها، وشرحٌ يُقرأ نثرًا. نفسُ البنية
 *    المشتقّة، وعرضٌ مختلفٌ لأنّ المهمّةَ مختلفة.
 *
 * ⚠️ **ولا محلّلَ ثانٍ** (بند ١٧): تُقرأ الوحداتُ من `draftPairs` —
 *    المحفوظُ إن وُجد وإلّا الاشتقاق — وهي نفسُها التي يقرؤها التدريب.
 */
function draftDocHtml(draft) {
  const units = draftUnits;
  if (!units.length) {
    return html`
      <div class="ws-empty ws-empty-doc">
        <p>المسودّة دي لسّه فاضية.</p>
      </div>`;
  }

  return html`
    <article class="ws-paper ws-draft-doc" data-ws-paper>
      ${raw(units.map(draftUnitHtml).join(''))}
    </article>`;
}

/** وحدةٌ واحدةٌ في سطح القراءة — بحسب دورها لا بحسب شكلها. */
function draftUnitHtml(one) {
  if (one.status === DRAFT_STATUS.DIVIDER) return '<hr class="ws-draft-bar">';

  if (one.status === DRAFT_STATUS.SECTION_HEAD) {
    return html`<h3 class="ws-draft-head" dir="auto">${one.ar || ''}</h3>`;
  }

  if (one.status === DRAFT_STATUS.NOTE) {
    return html`<p class="ws-draft-note" dir="auto">${one.ar || ''}</p>`;
  }

  if (one.status === DRAFT_STATUS.TEMPLATE) {
    return html`<p class="ws-draft-tpl" dir="auto">${one.raw || ''}</p>`;
  }

  const view = translationView(one.ar || '', one.primary || 0);

  /* ⚠️ سؤالُ الاسترجاع اتّجاهُه معكوس: العربيُّ يسأل والروسيُّ يجيب. */
  if (one.status === DRAFT_STATUS.RECALL) {
    return html`
      <div class="ws-draft-unit is-recall">
        <p class="ws-draft-ask" dir="rtl" lang="ar">${view.primary}</p>
        <p class="ws-draft-ru" dir="ltr" lang="ru">${one.ru || ''}</p>
      </div>`;
  }

  return html`
    <div class="ws-draft-unit">
      ${raw(one.ru ? html`<p class="ws-draft-ru" dir="ltr" lang="ru">${one.ru}</p>` : '')}
      ${raw(view.primary ? html`<p class="ws-draft-ar" dir="rtl" lang="ar">${view.primary}</p>` : '')}
      <!--
        ⚠️ **البدائلُ تُرى في القراءة ولا تزحم التدريب** (بندا ٨ و٩):
           هنا تقرأ فتحبّ أن ترى المعاني كلَّها؛ وهناك تنطق فيكفيك
           معنًى واحدٌ اخترتَه.
      -->
      ${raw(view.hasAlts
        ? html`<p class="ws-draft-alts" dir="rtl" lang="ar">${view.alts.join(' · ')}</p>` : '')}
    </div>`;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **«ربط» تخصُّ العنصر، فتقف بجانبه** (WS-P3 · بنود ٦ إلى ١٠)
 * ═══════════════════════════════════════════════════════════════
 *
 * كان الطريقُ الوحيدُ إلى الربط: افتح المُفتِّش ← اختر تبويب «الربط» ←
 * «+ إضافة رابط». أي أنّ عليك أن **تفكّر في أداةٍ** قبل أن تفعل شيئًا
 * بالملفّ الذي في يدك. وهذا ما بلّغتَ عنه: «الربطُ غيرُ مباشرٍ لأنّ عليّ
 * أن أفكّر في فتح مُفتِّش».
 *
 * فصار لكلّ عنصرٍ زرُّه: تعرف **ما** تربط قبل أن تُسأل **بماذا**.
 *
 * ⚠️ **ولا نظامَ ربطٍ ثانٍ** (بند ١٧): هذا **مدخلٌ** فقط. الضغطةُ تنتهي
 *    إلى `pickTargetFor` ← `commitLink` ← `linkSelection` — نفسُها
 *    حرفيًّا، بحمايةِ التكرار والاتّجاه والوجهات المتعدّدة والمزامنة
 *    والنسخ الاحتياطيّ. لا مخطَّطَ جديدٌ ولا معرِّفاتٌ جديدة.
 *
 * ⚠️ **ولا يُحشَى الصفُّ بكلّ شيء** (بند ١٠): تشغيلٌ وربطٌ وتسميةٌ ثمّ
 *    `⋯` لما بعدها. أربعةُ أهدافِ لمسٍ في صفٍّ عرضُه ٥٧٧px حدٌّ لا يُتجاوَز.
 */
function attachedHtml(nodeId) {
  const here = mediaOf(board, nodeId);
  const rows = [...here.audio, ...here.images];
  if (!rows.length) {
    return html`
      <section class="ws-attached is-empty">
        <button type="button" class="ws-btn ws-btn-soft" data-ws="link-into" data-id="${nodeId}">
          ${raw(icon('link', 15))} اربط صوت أو صورة بالعقدة دي
        </button>
      </section>`;
  }

  return html`
    <section class="ws-attached ${state.pickMode ? 'is-picking' : ''}"
             data-ws-attached aria-label="المربوط بالعقدة دي">
      <div class="ws-attached-head">
        <h3>مربوط هنا</h3>
        <!--
          ⚠️ **وضعُ التحديد يُدخَل صراحةً** (بند ٢٢): لا مربّعاتِ اختيارٍ
             دائمةً في كلّ صفّ. الحالةُ العاديّةُ بسيطةٌ، والدفعةُ طلبٌ.
        -->
        <button type="button" class="ws-btn ws-btn-soft ws-btn-tiny"
                data-ws="pick-mode" aria-pressed="${state.pickMode ? 'true' : 'false'}">
          ${state.pickMode ? 'خلاص' : 'تحديد'}
        </button>
        ${raw(state.pickMode ? '' : html`
          <button type="button" class="ws-btn ws-btn-soft ws-btn-tiny"
                  data-ws="link-into" data-id="${nodeId}">
            ${raw(icon('link', 14))} اربط كمان
          </button>`)}
      </div>

      ${raw(state.pickMode ? html`
        <!-- ⚠️ العددُ حقيقيٌّ من state.picked لا رقمٌ يُعرَض (بند ٢١). -->
        <div class="ws-pickbar" role="status">
          <b>${state.picked.size ? `${state.picked.size} متحدِّد` : 'مفيش حاجة متحدِّدة'}</b>
          <button type="button" class="ws-btn ws-btn-primary ws-btn-tiny"
                  data-ws="pick-link" ${state.picked.size ? '' : 'disabled'}>
            اربط المحدد
          </button>
          <button type="button" class="ws-btn ws-btn-soft ws-btn-tiny"
                  data-ws="pick-cancel">إلغاء</button>
        </div>` : '')}

      <ul class="ws-items">
        ${raw(rows.map(itemRowHtml).join(''))}
      </ul>
    </section>`;
}

/** صفُّ عنصرٍ واحدٍ بأفعاله المباشرة (بند ٧). */
function itemRowHtml(row) {
  const at = board.linkedTo.get(row.id) || [];
  const cloud = isCloudOnly(row);
  const name = itemTitle(row);
  const sel = state.pickMode ? state.picked.has(row.id) : state.mediaSel === row.id;
  const inSide = state.side === row.id;

  return html`
    <li class="ws-item ${sel ? 'is-sel' : ''} ${inSide ? 'is-side' : ''}"
        data-ws-item="${row.id}">
      <!--
        ⚠️ **لمسُ الصفّ يحدّده — ولا يزحزح مكانَك في الشجرة** (بند ١٦):
           pick-media تكتب state.mediaSel وحدَها. وstate.node — أي
           أنا داخل المرحلة ٣ب» — لا تُمَسّ. حالتان لا حالةٌ واحدة.
      -->
      <button type="button" class="ws-item-face" data-ws="pick-media"
              data-id="${row.id}" data-kind="${row.kind}"
              aria-pressed="${sel ? 'true' : 'false'}"
              aria-label="${state.pickMode ? 'حدّد' : 'اختار'} ${name}">
        ${raw(row.kind === 'image' && !cloud
          ? html`<img src="${urlFor(row, { thumb: true })}" alt="" loading="lazy" decoding="async">`
          : html`<span class="ws-item-icon">${raw(icon(row.kind === 'audio' ? 'mic' : 'image', 17))}</span>`)}
        ${raw(state.pickMode
          ? html`<span class="ws-item-tick" aria-hidden="true">${sel ? '✓' : ''}</span>` : '')}
      </button>
      <span class="ws-item-t" dir="auto">${name}</span>
      <span class="ws-item-acts">
        ${raw(state.pickMode ? '' : html`
          ${raw(row.kind === 'audio' ? audioButtonHtml({
            mediaId: row.id, snapshot: audio.state, loading: state.fetching.has(row.id),
            name, size: 16, className: 'ws-icon-btn',
          }) : html`
            <!--
              ⚠️ **عرض جنب النص» هو الفعلُ الأوّلُ للصورة** (بندا ٩ و١٩):
                 وهو ما طلبتَه — أن تقرأ النصَّ والصورةُ أمامك. وحالتُه
                 مُعلَنةٌ في الزرّ نفسِه فلا تضغطه مرّتين بلا أثرٍ ظاهر.
            -->
            <button type="button" class="ws-icon-btn ws-item-side ${inSide ? 'is-on' : ''}"
                    data-ws="side-open" data-id="${row.id}"
                    aria-pressed="${inSide ? 'true' : 'false'}"
                    aria-label="${inSide ? 'اقفل معاينة' : 'اعرض جنب النصّ'} ${name}"
                    title="عرض جنب النص">${raw(icon('compare', 15))}</button>`)}
          <!--
            ⚠️ **الرقمُ من علاقاتٍ حقيقيّةٍ لا زخرفة** (بند ١٣): وجهاتُ
               الرابط المخزَّنة فعلًا. وصفرٌ لا يُرسَم أصلًا — شارةٌ تقول
               ٠» أسوأُ من لا شيء.
          -->
          <button type="button" class="ws-icon-btn ws-item-link" data-ws="link-item"
                  data-id="${row.id}" aria-label="اربط ${name}">
            ${raw(icon('link', 15))}${raw(at.length > 1 ? html`<b>${at.length}</b>` : '')}
          </button>
          <!--
            ⚠️ **وإعادةُ التسمية نزلت تحت ⋯** (بند ١٩): كانت قلمًا دائمًا
               في كلّ صفّ. وهي فعلٌ نادر، والربطُ هو الفعلُ المركزيُّ في
               هذا المسار — فمن يأخذ مساحةً دائمةً يجب أن يستحقّها.
          -->
          <button type="button" class="ws-icon-btn" data-ws="item-menu" data-id="${row.id}"
                  aria-label="خيارات ${name}">⋯</button>`)}
      </span>
    </li>`;
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
      <div class="ws-media-acts">
        ${raw(audioButtonHtml({
          mediaId: item.id, snapshot: audio.state, loading: state.fetching.has(item.id),
          name: itemTitle(item), size: 20, className: 'ws-btn ws-btn-primary ws-media-play',
        }))}
        <!-- ⚠️ والربطُ هنا كذلك (بند ٦): ما دام الصوتُ أمامك فلا تُرسَل لأداة. -->
        <button type="button" class="ws-btn ws-btn-soft" data-ws="link-item" data-id="${item.id}">
          ${raw(icon('link', 15))} ربط
        </button>
      </div>
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
      <div class="ws-media-acts">
        <button type="button" class="ws-btn ws-btn-soft" data-ws="link-item" data-id="${item.id}">
          ${raw(icon('link', 15))} ربط
        </button>
      </div>
    </div>`;
}

/* ================================================================== *
 * ب٢ · المعاينةُ جنب النصّ (WS-P4 · بنود ٨ إلى ١٥)
 * ================================================================== */

/**
 * ⚠️ **صورةٌ واحدةٌ في الخانة** (بند ١٤): اختيارُ صورةٍ أخرى **يحدّث**
 *    المعاينةَ القائمةَ ولا يفتح ثانيةً. ولوحُ الصور المتعدّدةُ هو
 *    نفسُه العطبُ الذي جاءت هذه التمريرةُ لتمنعه.
 */
function sideHtml() {
  const item = state.side ? mediaById(state.side) : null;
  if (!item) return '';
  const name = itemTitle(item);

  if (isCloudOnly(item)) {
    return html`
      <div class="ws-side-head">
        <span class="ws-side-t" dir="auto">${name}</span>
        <button type="button" class="ws-icon-btn" data-ws="side-close"
                aria-label="اقفل المعاينة">${raw(icon('close', 15))}</button>
      </div>
      <div class="ws-side-body">
        <p class="ws-hint">الصورة دي على Drive بس — مش متنزّلة على الجهاز ده.</p>
        <button type="button" class="ws-btn" data-ws="fetch" data-id="${item.id}"
                ${state.fetching.has(item.id) ? 'disabled' : ''}>نزّلها</button>
      </div>`;
  }

  return html`
    <div class="ws-side-head">
      <!-- ⚠️ اسمُ الصورة dir="auto"، والنصُّ الروسيُّ لا يُمَسّ (بند ٣٩). -->
      <span class="ws-side-t" dir="auto" title="${name}">${name}</span>
      <button type="button" class="ws-icon-btn" data-ws="side-close"
              aria-label="اقفل المعاينة">${raw(icon('close', 15))}</button>
    </div>
    <div class="ws-side-body">
      <!--
        ⚠️ **واللمسُ يفتح اللايت‑بوكس المشترك نفسَه** (بندا ١٢ و٤٣): لا
           عارضَ صورٍ ثانٍ ولا نسخةَ منطقٍ. zoom هو المدخلُ القائم منذ
           WS-P2، وسلوكُه أثبتَّه على الجهاز — فلا يُمَسّ.
      -->
      <button type="button" class="ws-side-shot" data-ws="zoom" data-id="${item.id}"
              aria-label="كبّر ${name}">
        <img src="${urlFor(item, { thumb: false })}" alt="${name}" decoding="async">
      </button>
    </div>`;
}

/** يفتح صورةً في المعاينة الجانبيّة أو يحدّثها بها (بندا ٩ و١٤). */
function openSide(mediaId) {
  const row = mediaById(mediaId);
  if (!row || row.kind !== 'image') return;
  state.side = mediaId;
  state.mediaSel = mediaId;
  paintSide();
  paintDoc({ force: true });
  paintItems();
}

/**
 * يُغلق المعاينة — **والمستندُ يستردّ عرضَه فورًا** (بند ١٣).
 *
 * ⚠️ **ولا يُعاد رسمُ المستند هنا**: البندُ ١٣ يشترط بقاءَ موضع التمرير
 *    كما هو. وإخفاءُ اللوح تغييرُ تخطيطٍ لا تغييرُ محتوًى، فيتمدّد
 *    `.ws-doc` بلا أن يفقد `scrollTop`.
 */
function closeSide() {
  state.side = null;
  paintSide();
  paintHead();
  paintItems();
}

/**
 * يعيد رسمَ قائمة الوسائط وحدَها (بند ٤٥).
 *
 * ⚠️ **ولا يُعاد رسمُ المستند لأجل صفٍّ تغيّر تحديدُه**: النصُّ الروسيُّ
 *    قد يكون آلافَ الأسطر، وتغييرُ حالةِ صفٍّ لا يبرّر هدمَه وبناءَه —
 *    ولا يبرّر خصوصًا خطرَ ضياع موضع التمرير الذي كلّفنا WS-F2 قياسًا.
 */
/**
 * يعيد رسمَ السطحين اللذين يعرضان التحديد — **الاثنين معًا**.
 *
 * ⚠️ **حالةُ التحديد واحدة، وسطحاها اثنان** (WS-P4-C · بند ١٠):
 *    «مربوط هنا» في المستند، ولوحُ الوسائط على اليسار. وهما يقرآن
 *    `state.picked` و`state.mediaSel` نفسَيهما — فلو رُسم أحدُهما
 *    وحدَه لَرأيتَ صحًّا في مكانٍ ولا شيءَ في الآخر، وهو تناقضٌ
 *    يجعلك تشكّ في العدد الذي تقرؤه.
 */
function paintItems() {
  const host = $('[data-ws-attached]');
  if (host && state.node) host.outerHTML = attachedHtml(state.node);
  if (state.inspector) paintInsp();
}

/**
 * ينظّف تحديدًا صار بلا معنًى — **لا يُترَك معرِّفٌ ميّتٌ في المجموعة**
 * (بند ١٦).
 *
 * ⚠️ **وثلاثةُ أبوابٍ تُبطل التحديد**: تبديلُ ما تقرؤه (فالهدفُ تغيّر)،
 *    وإغلاقُ اللوح (فالأداةُ التي تجمع بها اختفت)، وحذفُ وسيطٍ (فالمعرِّفُ
 *    لم يعُد يشير إلى شيء). وثلاثتُها تمرّ من هنا.
 *
 * ⚠️ **ولا يُحذَف ما بقي صالحًا**: الفاشلُ بعد ربطٍ جزئيٍّ يبقى محدَّدًا
 *    عمدًا (بند ١٥) — وتنظيفٌ عامٌّ يمسحه كان سيقتل «إعادة محاولة
 *    الفاشل» قبل أن تضغطها.
 */
function resetPicks() {
  state.pickMode = false;
  state.picked.clear();
}

/** يُسقط من التحديد ما لم يعُد موجودًا في اللوحة (حذفٌ أو مزامنة). */
function reconcilePicks() {
  if (!board || !state.picked.size) return;
  for (const one of [...state.picked]) if (!mediaById(one)) state.picked.delete(one);
  if (state.mediaSel && !mediaById(state.mediaSel)) state.mediaSel = null;
}

/**
 * ⚠️ **حالةُ الانقسام `data-ws-open` لا `data-ws-side`** — عطبٌ حقيقيٌّ
 *    كشفه الاختبارُ ٢٩، ويستحقّ أن يُكتَب لأنّه صنفٌ من الأخطاء يتكرّر.
 *
 *    كانت هذه الدالّةُ تكتب `split.dataset.wsSide` لتقول «مفتوحة». وذلك
 *    **ينشئ على عنصر الانقسام سِمةَ `data-ws-side` نفسَها** التي يُمسَك
 *    بها لوحُ المعاينة. وترتيبُ المستند يضع الانقسامَ قبل اللوح، فصار
 *    `$('[data-ws-side]')` في النداء التالي يعيد **الانقسام**، فتُنفَّذ
 *    عليه `innerHTML = ''` — فيُمحى المستندُ والمقبضُ واللوحُ معًا.
 *
 *    والعَرَضُ كان مُضلِّلًا تمامًا: «المستندُ يختفي عند إغلاق المعاينة»
 *    بينما السببُ سِمةٌ تشترك في اسمها مع مِقبَض.
 *
 *    ⚠️ **والقاعدة**: سِمةُ الحالة وسِمةُ الإمساك لا تتشاركان اسمًا.
 */
function paintSide() {
  const pane = $('[data-ws-side]');
  const grip = $('[data-ws-side-grip]');
  const split = $('[data-ws-main-split]');
  if (!pane || !split) return;
  const on = Boolean(state.side && mediaById(state.side));
  pane.innerHTML = on ? sideHtml() : '';
  pane.hidden = !on;
  if (grip) grip.hidden = !on;
  split.dataset.wsOpen = on ? 'on' : 'off';
  split.style.setProperty('--ws-side-ratio', String(state.sideRatio));
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

/**
 * شريطُ التحديد داخل لوح الوسائط — **هنا لا أسفلَ الشاشة** (بندا ١٢ و١٣).
 *
 * ⚠️ **ويُدخَل صراحةً**: لا مربّعاتِ اختيارٍ دائمةً في كلّ صفّ. الحالةُ
 *    العاديّةُ بسيطةٌ — تلمس فتختار وتفتح — والدفعةُ طلبٌ تطلبه.
 *
 * ⚠️ **والعددُ حقيقيٌّ من `state.picked`** (بند ١٣): لا رقمٌ يُعرَض ولا
 *    تقديرٌ. وإن كان صفرًا فالزرُّ معطَّلٌ ويقول ذلك.
 *
 * ⚠️ **وشريطُ الأفعال داخل اللوح** — البندُ ١٣ صريح: لا شريطَ أفعالٍ
 *    أسفلَ الشاشة كلِّها. والفعلُ يقع حيث تنظر.
 */
function mediaPickBarHtml() {
  if (!state.pickMode) return '';
  const n = state.picked.size;
  return html`
    <div class="ws-pickbar" data-ws-media-pickbar role="status">
      <b>${n ? `${n} محدّدين` : 'مفيش حاجة متحدّدة'}</b>
      <button type="button" class="ws-btn ws-btn-primary ws-btn-tiny"
              data-ws="pick-link" ${n ? '' : 'disabled'}>اربط المحدد</button>
      <button type="button" class="ws-btn ws-btn-soft ws-btn-tiny"
              data-ws="pick-cancel">إلغاء التحديد</button>
    </div>`;
}

function mediaTabHtml() {
  const items = mediaLibrary(board, { filter: state.mediaFilter, query: state.mediaQuery });
  const here = state.open?.kind === 'text' ? mediaOf(board, state.open.id) : null;

  return html`
    <div class="ws-insp-body">
      <!--
        ⚠️ **مدخلُ التحديد في رأس اللوح** (بند ١٢): أوّلُ ما تراه حين
           تفتح «الوسائط»، لا مخبوءًا تحت القائمة.
      -->
      <div class="ws-media-tools">
        <button type="button" class="ws-btn ws-btn-soft ws-btn-tiny"
                data-ws="pick-mode" data-ws-media-pick
                aria-pressed="${state.pickMode ? 'true' : 'false'}">
          ${state.pickMode ? 'خلاص' : 'تحديد'}
        </button>
      </div>
      ${raw(mediaPickBarHtml())}

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

/**
 * صفُّ وسيطٍ في اللوح الأيسر — **يُحدَّد هنا، ويُربَط هنا** (بنود ١٠ إلى ١٧).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **حالتان لا حالة** — وهي أهمُّ ما في هذا الصفّ
 * ═══════════════════════════════════════════════════════════════
 *
 *   · `state.node`     ← العقدةُ التي تقرؤها. تحديدٌ **أوّليٌّ** يملك
 *     المُتصفِّحَ والمسار، ولونُه هو الأقوى في الشاشة.
 *   · `state.mediaSel` ← الوسيطُ الذي في يدك. تحديدٌ **محلّيٌّ ثانويّ**
 *     بلونٍ أهدأ (بند ١١).
 *
 * ولمسُ صورةٍ هنا **لا يزحزح مكانَك في الشجرة** (بند ١٠) — ولا سطرَ
 * واحدًا يكتب `state.node` في هذا المسار.
 *
 * ⚠️ **وفي وضع التحديد لا يُفتَح شيء** (بند ١٣): اللمسُ يقلب العضويّةَ
 *    وحدَها. ولو فتحت الصورةَ وأنت تجمع خمسًا لَخرجتَ من عملك خمسَ
 *    مرّات.
 *
 * ⚠️ **والقلمُ نزل تحت ⋯** (بند ١٧): كان أيقونةً دائمةً في كلّ صفّ،
 *    وإعادةُ التسمية فعلٌ نادر. ومَن يأخذ مساحةً دائمةً يجب أن
 *    يستحقّها — والمساحةُ هنا لزرّ التشغيل والربط.
 */
function thumbHtml(row) {
  const at = board.linkedTo.get(row.id) || [];
  const cloud = isCloudOnly(row);
  const name = itemTitle(row);
  const sel = state.pickMode ? state.picked.has(row.id) : state.mediaSel === row.id;

  return html`
    <li class="ws-thumb ${state.open?.id === row.id ? 'is-on' : ''} ${sel ? 'is-sel' : ''}"
        data-ws-thumb="${row.id}">
      <button type="button" class="ws-thumb-face" data-ws="pick-media"
              data-id="${row.id}" data-kind="${row.kind}"
              aria-pressed="${sel ? 'true' : 'false'}"
              aria-label="${state.pickMode ? 'حدّد' : 'اختار'} ${name}">
        ${raw(row.kind === 'image' && !cloud
          ? html`<img src="${urlFor(row, { thumb: true })}" alt="" loading="lazy" decoding="async">`
          : html`<span class="ws-thumb-icon">${raw(icon(row.kind === 'audio' ? 'mic' : 'image', 18))}</span>`)}
        ${raw(state.pickMode
          ? html`<span class="ws-item-tick" aria-hidden="true">${sel ? '✓' : ''}</span>` : '')}
      </button>
      <div class="ws-thumb-body">
        <b dir="auto">${name}</b>
        <span>${raw(at.length
          ? html`✓ ${pathOf(at[0]) || ''}${at.length > 1 ? ` +${at.length - 1}` : ''}`
          : 'غير مربوط')}${raw(cloud ? ' <i class="ws-tagline">Drive</i>' : '')}</span>
      </div>
      ${raw(state.pickMode ? '' : html`
        ${raw(row.kind === 'audio' ? audioButtonHtml({
          mediaId: row.id, snapshot: audio.state, loading: state.fetching.has(row.id),
          name, size: 16, className: 'ws-icon-btn',
        }) : '')}
        <button type="button" class="ws-icon-btn ws-item-link" data-ws="link-item"
                data-id="${row.id}" aria-label="اربط ${name}">
          ${raw(icon('link', 15))}${raw(at.length > 1 ? html`<b>${at.length}</b>` : '')}
        </button>
        <button type="button" class="ws-icon-btn" data-ws="item-menu" data-id="${row.id}"
                aria-label="خيارات ${name}">⋯</button>`)}
    </li>`;
}

function inspectorHtml() {
  const tabs = [TAB.LINKS, TAB.PROPS, TAB.MEDIA];
  if (!state.open) {
    return html`
      <div class="ws-insp-head">
        <span class="ws-insp-title">تفاصيل العنصر</span>
        <button type="button" class="ws-icon-btn" data-ws="insp-close"
                aria-label="اقفل التفاصيل">${raw(icon('close', 16))}</button>
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
              aria-label="اقفل التفاصيل">${raw(icon('close', 16))}</button>
    </div>
    ${raw(state.tab === TAB.LINKS ? linksTabHtml()
      : (state.tab === TAB.PROPS ? propsTabHtml() : mediaTabHtml()))}`;
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

/**
 * ⚠️ **والصفُّ المحدَّد يبقى مرئيًّا** (بند ٣): تحديدٌ لا تراه لا يفيدك.
 *    والبحثُ أو الفردُ أو إعادةُ القراءة قد تدفعه خارج نافذة اللوح، فيبدو
 *    وكأنّ التحديدَ ضاع وهو قائم.
 *
 * ⚠️ ولا يُستعمَل `scrollIntoView` بلا شرط: هو **يُمرّر دائمًا** ولو كان
 *    الصفُّ ظاهرًا، فيهزّ اللوحَ مع كلّ رسمةٍ بلا سبب. فيُفحَص الظهورُ
 *    أوّلًا، ولا يُمرَّر إلّا إن خرج فعلًا.
 */
function keepSelectedInView() {
  const pane = $(SCROLLERS.nav);
  const row = pane?.querySelector('[data-ws-here]');
  if (!pane || !row) return;
  const box = pane.getBoundingClientRect();
  const at = row.getBoundingClientRect();
  if (at.top >= box.top && at.bottom <= box.bottom) return;
  row.scrollIntoView({ block: 'nearest' });
  state.scroll.nav = pane.scrollTop;
}

function paintNav() {
  paintPane('nav', navHtml);
  keepSelectedInView();
}

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

/**
 * بثُّ الصوت — **يصل إلى الصفوف وحدَها، فلا شريطَ سفليَّ يستقبله**
 * (WS-P4-C · بنود ٥ إلى ٩).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ما الذي حُذف — وما الذي لم يُمَسّ**
 * ═══════════════════════════════════════════════════════════════
 *
 * حُذف: `nowHtml` كلُّها، وعنصرُ `[data-ws-now]`، والمتغيّرُ
 * `--ws-dock` وحشواتُه الأربع في الألواح.
 *
 * **ولم تُمَسّ العمارةُ الصوتيّة أصلًا** (بند ٧): نفسُ `audio-service`
 * العامّة، ونفسُ `<audio>` الواحد، ونفسُ المالك الواحد، ونفسُ
 * `subscribeAudio` التي تنادي هذه الدالّة. الذي زال **واجهةٌ** لا
 * محرّك — ولذلك بقي هذا المشترِكُ قائمًا: الحقيقةُ لا تزال تصل، لكنّها
 * تصل الآن إلى المكان الذي بدأت منه الصوتَ (بند ٨).
 *
 * ⚠️ **ولا يُستبدَل بشريطِ حالةٍ آخر** (بند ٩): لا تذييلَ صوتٍ ولا
 *    تذييلَ بيانات. المساحةُ ترجع للمستند، وهذا هو المطلوب حرفيًّا.
 *
 * ⚠️ **وثمنٌ مُعلَنٌ لا مسكوتٌ عنه**: شريطُ القفز (`seek`) كان يعيش في
 *    المشغّل وحدَه، فذهب معه. التشغيلُ والإيقافُ باقيان على الصفّ،
 *    والقفزُ داخل المقطع لم يعُد في الورشة. وإخفاءُ ذلك في تقريرٍ
 *    يقول «حُذف الشريطُ فقط» كان سيكون كذبًا صغيرًا.
 */
const paintNow = (snapshot) => {
  /*
   * ⚠️ **كلُّ أزرار التشغيل تُصحَّح، لا زرُّ السطح وحدَه** (بند ٨): صفُّ
   *    الوسائط في اللوح الأيسر وزرُّ المستند ومُلتقِطُ الربط — ثلاثتُها
   *    قد تعرض نفسَ المقطع في اللحظة نفسِها، وواحدٌ فقط يجوز أن يقول ❚❚.
   *
   * ⚠️ **وتصحيحٌ في المكان لا إعادةُ رسم** (بند ٢٩): الخدمةُ تبثّ عدّةَ
   *    مرّاتٍ في الثانية، وإعادةُ رسم القائمة مع كلّ بثٍّ تحرق الإطارات.
   *
   * ⚠️ **وهو أيضًا إعادةُ الترطيب المطلوبة في بند ٨**: أيُّ إعادةِ رسمٍ
   *    للوح تُخرج أزرارًا بحالةٍ مأخوذةٍ من `audio.state` وقتَ الرسم،
   *    ثمّ يصحّحها أوّلُ بثٍّ بعدها. فلا حالةَ محلّيّةٌ تُخزَّن ولا تكذب.
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

  /*
   * ⚠️ **وزرُّ «ربط» يتزامن هنا — لا في مكان الفتح وحدَه** (بند ٣).
   *
   *    اللوحُ يُغلَق من ثلاثة أبواب: الزرُّ نفسُه، و ✕ في رأس اللوح،
   *    والنقرُ على الحجاب في العرض الضيّق. وثلاثتُها تمرّ من هنا.
   *    فلو صُحّحت الحالةُ عند الفتح فقط لَبقي الزرُّ مضيئًا بعد ✕ —
   *    وهو بالضبط ما ينهى عنه البند: «لا تترك الواجهةَ تدّعي أنّ
   *    الربطَ فعّالٌ واللوحُ مغلق».
   *
   * ⚠️ **وسِمةٌ في المكان لا إعادةُ رسم**: `paintHead()` هنا كانت
   *    ستُعيد بناءَ الترويسة مع كلّ تغيّرِ قياسٍ أو دوران.
   */
  const linkBtn = $('[data-ws-link-btn]');
  if (linkBtn) {
    linkBtn.setAttribute('aria-pressed', state.inspector ? 'true' : 'false');
    linkBtn.classList.toggle('is-on', state.inspector);
    linkBtn.title = state.inspector ? 'اقفل لوح الربط' : 'افتح لوح الربط والوسائط';
  }
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
  /* ⚠️ وسيطٌ حُذف لا يبقى معرِّفُه في التحديد يُعَدّ ولا وجودَ له (بند ١٦). */
  reconcilePicks();

  /*
   * ⚠️ عنصرٌ اختفى لا يبقى مفتوحًا يشير إلى معرّفٍ ميّت (بند ٢٦) —
   *    **إلّا** إن كانت معك فيه مسوّدةٌ فيها تعديلات. حينها يبقى
   *    مفتوحًا كي يُعرَض ما كتبتَه ويُنسَخ قبل أن يضيع.
   */
  const holding = state.draft && draftChanged(state.draft)
    && state.open?.kind === 'text' && state.open.id === state.draft.id;
  if (state.open && !openRecord() && !holding) state.open = null;
  /*
   * ⚠️ **وهُويّةُ التحديد تُنظَّف بالمعيار نفسِه** (بند ٣): عقدةٌ حُذفت
   *    لا تبقى «محدَّدةً» بمعرِّفٍ ميّتٍ يُبرِز لا شيء ويُربِك المسار.
   *    وما دامت العقدةُ موجودةً فالتحديدُ باقٍ عبر إعادةِ القراءة كلِّها
   *    — وهذا هو المطلوب: يعيش بعد الحفظ وإعادة التسمية وإعادة الرسم.
   */
  if (state.node && !nodeById(state.node)) state.node = null;
  /* ⚠️ ووحداتُ المسودّة تُنعَش مع اللوحة — وإلّا قرأتَ تحليلًا قديمًا. */
  if (state.open?.kind === 'draft') {
    const row = draftById(state.open.id);
    if (row) draftUnits = draftPairs(row);
    else { state.open = state.node ? { kind: 'text', id: state.node } : null; draftUnits = []; }
  }
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
  /* ⚠️ هُويّةُ التحديد أوّلًا — والعرضُ يتبعها، لا العكس (قاعدة ٧). */
  state.node = id;
  state.open = { kind: 'text', id };
  state.docQuery = '';
  state.docScroll = { text: 0, chat: 0 };
  /* ⚠️ تبدَّل الهدفُ فبطل التحديدُ الذي كان يقصده (بند ١٦). */
  resetPicks();
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

/**
 * يفتح مسودّةً في مساحة العمل — **بلا مغادرةِ مكانك في الشجرة** (بند ٢٠).
 *
 * ⚠️ نفسُ عهد `openMedia`: `state.node` لا يُمَسّ. فالمتصفِّحُ يبقى على
 *    العقدة، والترويسةُ تقول «العقدة · مسودّة»، والعودةُ لمسةٌ واحدة.
 */
function openDraftDoc(id) {
  const row = draftById(id);
  if (!row) return toastError('المسودّة دي مابقتش موجودة');
  if (!openable(id)) return undefined;
  /* ⚠️ تُشتقّ مرّةً هنا — راجع `draftUnits`. */
  draftUnits = draftPairs(row);
  state.open = { kind: 'draft', id };
  state.docQuery = '';
  if (state.mode !== MODE.READ) state.mode = MODE.READ;
  applyShell();
  paintDoc({ force: true });
  paintNav();
  if (state.inspector) paintInsp();
  return undefined;
}

function openMedia(id, kind) {
  const record = mediaById(id);
  if (!record) return toastError('العنصر ده مابقاش موجود');
  if (!openable(id)) return undefined;
  /*
   * ⚠️ **ولا يُمَسُّ `state.node` هنا** (بنود ٣ و١٦): فتحُ صوتٍ أو صورةٍ
   *    حالةٌ فرعيّةٌ داخل مكانك، لا انتقالٌ منه. وقبل هذا كان التحديدُ
   *    يختفي من الشجرة تمامًا عند أوّل صوتٍ تفتحه.
   */
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
  /*
   * ⚠️ **ولم يعُد لـ`MODE.LINK` فرعٌ هنا** (بندا ٢٣ و٢٤): كان كلُّ عمله
   *    فتحَ لوح التفاصيل على تبويب الربط — وهو فعلٌ لا وضع. والثابتُ
   *    نفسُه باقٍ في `MODE` كي لا تنكسر حالةٌ محفوظةٌ تحمله، وإن وصل
   *    فهو الآن قراءةٌ عاديّة.
   */
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
  if (!target) return toastError('المكان ده مابقاش موجود');
  /* ⚠️ يُدخَل إليها الآن من زرِّ الصفّ مباشرةً، فتبدأ من تحديدٍ نظيف. */
  state.picked = new Set();
  const done = await showModal({
    title: `اربط بـ «${itemLabel(target.title)}»`,
    wide: true,
    submitLabel: 'اربط المحدد',
    body: html`
      <!--
        ⚠️ **سياقُ المصدر مكتوبٌ لا مفترَض** (بند ٨): تعرف بالضبط **ما**
           الذي تربط و**أين** يقع قبل أن تختار شيئًا.
      -->
      <p class="ws-pick-src" dir="auto">
        ربط بـ: <b>${target.title}</b> — اختار الصوت أو الصورة</p>
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
  if (!item) return toastError('العنصر ده مابقاش موجود');
  const at = new Set(board.linkedTo.get(mediaId) || []);
  let chosen = null;

  const done = await showModal({
    title: `اربط «${itemLabel(itemTitle(item))}»`,
    wide: true,
    submitLabel: 'اربط',
    body: html`
      <p class="ws-pick-src" dir="auto">
        ربط: <b>${item.kind === 'audio' ? '🎧' : '🖼'} ${itemTitle(item)}</b> — إلى:</p>
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
    /*
     * ⚠️ **والنتيجةُ تظهر فورًا في مكانها** (بند ٦): `doc: false` كانت
     *    تُبقي سطحَ المستند على حاله، فتربط شيئًا ولا ترى أثرَه إلّا بعد
     *    أن تُغادر العقدةَ وتعود. والآن يُعاد رسمُ «مربوط هنا» في الحال —
     *    و`paintDoc` يحمي نفسَه من الرسم أثناء التحرير.
     */
    await refresh({ doc: true });
    if (state.inspector) paintInsp();
    return toastOk(`اترّبط ${linked} — ${where}`);
  } catch (error) {
    return toastError(`الربط فشل: ${error?.message || 'مش معروف'}`);
  }
}

/**
 * يربط المحدَّدَ دفعةً — **ويقول الحقيقةَ حين تنجح بعضُها** (بند ٢١).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **هذه العمليّةُ ليست ذرّيّة — ولا يجوز أن تدّعي أنّها كذلك**
 * ═══════════════════════════════════════════════════════════════
 *
 * `link(fromId, toId, kind)` تربط **مصدرًا واحدًا** بهدفٍ واحد، و
 * `linkItemsTo` تدور عليها. أي أنّ ربطَ خمسةِ عناصرَ خمسُ كتاباتٍ
 * متتابعةٌ لا معاملةٌ واحدة. ولو رمت الثالثةُ لَخرجت الدالّةُ ومعها
 * اثنان مربوطان **فعلًا** في القاعدة ورسالةٌ تقول «الربط فشل».
 *
 * فالحلقةُ هنا **لكلّ عنصرٍ على حدة**، وتُمسَك أخطاؤه:
 *
 *   · العددُ الناجحُ حقيقيّ — مقروءٌ من الكتابات التي تمّت.
 *   · والفاشلُ يُسمَّى بالاسم لا بالعدد وحدَه.
 *   · والفاشلُ **يبقى محدَّدًا** فتعيد المحاولةَ عليه وحدَه.
 *   · ولا يُلغى ما نجح — التراجعُ الصامتُ عن روابطَ صحيحةٍ أسوأُ من
 *     الفشل الجزئيّ، لأنّه يمحو عملًا وقع بلا أن تطلبه.
 */
async function linkPicked() {
  const ids = [...state.picked];
  if (!ids.length) return toastError('اختار حاجة الأول');
  if (!state.node) return toastError('اختار مكان في الشجرة الأول');

  const target = state.node;
  const failed = [];
  let ok = 0;

  for (const one of ids) {
    try {
      const { linked } = await linkSelection([one], target, board, { mode: 'attach' });
      ok += linked;
    } catch (error) {
      failed.push({ id: one, why: error?.message || 'مش معروف' });
    }
  }

  /*
   * ⚠️ الفاشلُ وحدَه يبقى محدَّدًا — فزرُّ «اربط المحدد» يصير إعادةَ محاولة.
   *
   * ⚠️ **ويُكتَب بعد `refresh` لا قبله** (بند ١٥): `reconcilePicks` تجري
   *    داخل `refresh` وتُسقط ما لم يعُد موجودًا. ولو كُتب التحديدُ قبلها
   *    لَبقي كما هو — لكنّ الترتيبَ هنا يجعل الفاشلَ يمرّ بالتنقية أيضًا،
   *    فلا يُعرَض عليك «أعِد المحاولة» على وسيطٍ حُذف فعلًا.
   */
  await refresh({ doc: true });
  state.picked = new Set(failed.map((one) => one.id).filter((one) => mediaById(one)));
  if (!state.picked.size) state.pickMode = false;
  paintItems();

  const where = pathOf(target);
  if (!failed.length) return toastOk(`اترّبط ${ok} — ${where}`);
  const names = failed.slice(0, 3)
    .map((one) => itemTitle(mediaById(one.id)) || one.id).join('، ');
  return toastError(
    `اترّبط ${ok} وفشل ${failed.length}: ${names}${failed.length > 3 ? '…' : ''}`
    + ' — الفاشل لسّه متحدّد، اضغط «اربط المحدد» تاني.',
  );
}

/**
 * أفعالُ العنصر الثانويّة — **خلف `⋯` لا في الصفّ** (بند ١٠).
 *
 * ⚠️ الصفُّ يحمل ما تفعله كلَّ يوم: تشغيلٌ وربطٌ وتسمية. وما تفعله
 *    نادرًا — الفتحُ في المساحة، وفكُّ رابطٍ بعينه — يسكن هنا. وحشوُ
 *    الصفّ بستّة أزرارٍ على عرض ٥٧٧px يجعلها كلَّها أصعبَ في اللمس.
 */
async function openItemMenu(mediaId) {
  const item = mediaById(mediaId);
  if (!item) return toastError('العنصر ده مابقاش موجود');
  const at = board.linkedTo.get(mediaId) || [];

  const pick = await showModal({
    title: itemLabel(itemTitle(item)),
    submitLabel: 'اقفل',
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <p class="ws-pick-src" dir="auto">
        ${item.kind === 'audio' ? '🎧' : '🖼'} <b>${itemTitle(item)}</b></p>
      <div class="ws-menu">
        <button type="button" data-m="open">افتحه في المساحة</button>
        <button type="button" data-m="link">اربطه بمكان تاني</button>
        <!--
          ⚠️ **والتسميةُ هنا لا في الصفّ** (WS-P4-C · بند ١٧): كانت
             قلمًا دائمًا في كلّ صفٍّ من لوح الوسائط. وهي فعلٌ نادرٌ
             يأخذ مساحةً دائمة، والمساحةُ لزرّ التشغيل والربط.
        -->
        <button type="button" data-m="rename">سمّيه من جديد</button>
        ${raw(at.map((one, i) => html`
          <button type="button" data-m="drop:${i}">فُكّ من: ${pathOf(one) || '—'}</button>`).join(''))}
      </div>`,
    onMount(root) {
      root.addEventListener('click', (event) => {
        const m = event.target.closest('[data-m]')?.dataset.m;
        if (m) root.closest('.overlay')?.__close?.(m);
      }, wired());
    },
  });

  if (!pick) return undefined;
  if (pick === 'open') return openMedia(mediaId, item.kind);
  if (pick === 'link') return pickTargetFor(mediaId);
  if (pick === 'rename') return renameMedia(mediaId);
  if (pick.startsWith('drop:')) return dropLink(mediaId, at[Number(pick.slice(5))] || null);
  return undefined;
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
    /* ⚠️ حقلٌ واحدٌ ← نافذةٌ مضغوطة (بند ٤١) — ومنطقُ الحفظ لم يتغيّر. */
    compact: true,
    body: html`
      <div class="field">
        <label for="ws-rename">الاسم المعروض</label>
        <input id="ws-rename" name="name" dir="auto" maxlength="200"
               value="${itemTitle(row)}" autocomplete="off">
      </div>
      <p class="ws-hint">
        ده الاسم اللي هتشوفه وتدوّر بيه. الملفّ نفسه ومعرّفه وروابطه ما بيتغيّروش.
      </p>`,
    onMount(root) {
      /* ⚠️ تركيزٌ مرئيٌّ فورًا، والاسمُ محدَّدٌ فتكتب فوقه بلا مسحٍ يدويّ. */
      const input = root.querySelector('#ws-rename');
      input?.focus();
      input?.select();
    },
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
           بهما وحدَهما تنمو الشجرةُ في أيّ اتّجاه — تقسم المرحلة ٢»
           إلى ٢أ و٢ب (أبناء)، أو تضيف المرحلة ١٣» (شقيق). ولا رقمَ
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

/**
 * يعيد لوحًا إلى عرضه الافتراضيّ (بند ٤).
 *
 * ⚠️ **ولا يكون النقرُ المزدوجُ الطريقَ الوحيد** — البندُ ٤ ينصّ عليه:
 *    «Do not make double-tap the only reset method». فهو اختصارٌ سريع،
 *    ومعه بندٌ صريحٌ في قائمة `⋯` للوحة، ومفتاحُ Home على المقبض نفسِه.
 */
function resetPane(which) {
  state.panes[which] = which === 'nav' ? PANE.NAV_DEFAULT : PANE.INSP_DEFAULT;
  applyShell();
  writePanePrefs(state.panes);
  toastOk('رجع للعرض الافتراضي');
}

function startResize(event, which) {
  const root = $('.ws');
  if (!root) return;

  /*
   * ⚠️ **نقرتان متتاليتان على المقبض = استعادةُ الافتراضيّ** (بند ٤).
   *    و`detail` تعدّ النقراتِ المتتابعةَ في المتصفّح نفسِه، فلا مؤقّتَ
   *    نكتبه ولا حالةَ «آخِرُ لمسةٍ متى» تتقادم.
   */
  if (event.detail >= 2) { resetPane(which); return; }

  const rtl = getComputedStyle(root).direction === 'rtl';
  const startX = event.clientX;
  const from = which === 'nav' ? state.panes.nav : state.panes.insp;
  event.target.setPointerCapture?.(event.pointerId);
  event.target.classList.add('is-dragging');
  root.classList.add('is-resizing');

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
    event.target.classList.remove('is-dragging');
    root.classList.remove('is-resizing');
    /* ⚠️ يُكتَب التفضيلُ عند نهاية السحب لا عند كلّ بكسل (بند ٤٥). */
    writePanePrefs(state.panes);
  };
  window.addEventListener('pointermove', move, wired());
  window.addEventListener('pointerup', up, wired({ once: true }));
  /*
   * ⚠️ **و`pointercancel` تُنهي السحبَ كما يُنهيه الرفع** (بند ٣٧): لمسةٌ
   *    ثانيةٌ أو إيماءةٌ يلتقطها النظام تُلغي المؤشِّرَ بلا `pointerup` —
   *    فلولا هذا لبقيت الشاشةُ في «حالةِ سحبٍ عالقة» بلا تمريرٍ ولا تحديد.
   */
  window.addEventListener('pointercancel', up, wired({ once: true }));
}

/**
 * تحجيمُ الانقسام داخل مساحة العمل (بند ١١).
 *
 * ⚠️ **والحدّان محسوبان من العرض الفعليّ لا من نسبةٍ عمياء**: النصُّ
 *    له `MAIN_MIN` نفسُه الذي يحمي المستندَ في الشبكة العامّة، والصورةُ
 *    لها حدٌّ أدنى تُرى عنده. فلو ضاقت المساحةُ عن مجموعهما لم يتحرّك
 *    المقبضُ أصلًا — لا انزلاقَ إلى عمودين لا يُقرأ أيٌّ منهما.
 */
const SIDE_MIN_IMG = 200;

function startSideResize(event, grip) {
  const box = $('[data-ws-main-split]');
  if (!box) return;
  if (event.detail >= 2) {
    state.sideRatio = 0.64;
    box.style.setProperty('--ws-side-ratio', '0.64');
    return;
  }
  const rtl = getComputedStyle(box).direction === 'rtl';
  grip.setPointerCapture?.(event.pointerId);
  grip.classList.add('is-dragging');
  const root = $('.ws');
  root?.classList.add('is-resizing');

  const move = (ev) => {
    const rect = box.getBoundingClientRect();
    /* ⚠️ في RTL يبدأ النصُّ من اليمين — فالنسبةُ تُقاس من `right`. */
    const from = rtl ? (rect.right - ev.clientX) : (ev.clientX - rect.left);
    const lo = PANE.MAIN_MIN / rect.width;
    const hi = (rect.width - SIDE_MIN_IMG) / rect.width;
    if (lo >= hi) return;
    state.sideRatio = Math.max(lo, Math.min(hi, from / rect.width));
    box.style.setProperty('--ws-side-ratio', state.sideRatio.toFixed(4));
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    grip.classList.remove('is-dragging');
    root?.classList.remove('is-resizing');
  };
  window.addEventListener('pointermove', move, wired());
  window.addEventListener('pointerup', up, wired({ once: true }));
  window.addEventListener('pointercancel', up, wired({ once: true }));
}

/** مفاتيحُ المقبض: أسهمٌ تحرّك، وHome تستعيد الافتراضيّ (بند ٤). */
function resizeKey(event, which) {
  const step = event.shiftKey ? 48 : 12;
  if (event.key === 'Home') { resetPane(which); return true; }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;

  const root = $('.ws');
  const rtl = getComputedStyle(root).direction === 'rtl';
  const toward = event.key === 'ArrowLeft' ? -1 : 1;
  /* نفسُ حساب السحب: في RTL المُتصفِّحُ على اليمين فيوسّعه السهمُ الأيسر. */
  const dir = which === 'nav' ? (rtl ? -toward : toward) : (rtl ? toward : -toward);
  const other = which === 'nav' ? (state.inspector ? state.panes.insp : 0) : state.panes.nav;
  const min = which === 'nav' ? PANE.NAV_MIN : PANE.INSP_MIN;
  const max = which === 'nav' ? PANE.NAV_MAX : PANE.INSP_MAX;
  const room = root.clientWidth - other - PANE.MAIN_MIN;
  state.panes[which] = Math.round(Math.max(min,
    Math.min(max, Math.min(state.panes[which] + dir * step, room))));
  applyShell();
  writePanePrefs(state.panes);
  return true;
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
  /*
   * ⚠️ **ولا تحديدَ متقادمٌ بعد تنقّلٍ لا علاقةَ له** (بند ٢٢): فتحُ ذكرًى
   *    أخرى يصفّر وضعَ التحديد والمعاينةَ معًا — وإلّا لَرأيتَ صورةً من
   *    ذكرًى غادرتَها معروضةً بجوار نصٍّ ليس لها.
   */
  state.pickMode = false;
  state.mediaSel = null;
  state.side = null;
  state.sideRatio = 0.64;
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
            ⚠️ **وضع التنظيم» لم يكن يقول ما يفعل** (WS-P2 · بند ١٢).
               دقّقتُ الشاشةَ التي يفتحها: سؤالُها الحقيقيّ إيه اللي
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

        <!--
          ⚠️ **المعاينةُ الجانبيّةُ ابنةُ .ws-main لا عمودٌ خامس** (بندا ٨
             و٣٤): البندُ ٨ يسمّي الخطرَ بنفسه — Do NOT create: Media panel
             | Text | Image | Navigator | Global rail. That would recreate
             the original problem». فالانقسامُ **داخل** مساحة العمل: إن
             أُغلقت المعاينةُ عاد المستندُ إلى كامل العرض في نفس اللحظة،
             ولا يبقى في الشبكة العامّة عمودٌ محجوزٌ فارغ.
        -->
        <main class="ws-main" data-ws-main>
          <div class="ws-head" data-ws-head></div>
          <div class="ws-main-split" data-ws-main-split>
            <div class="ws-doc" data-ws-doc></div>
            <div class="ws-side-grip" data-ws-side-grip role="separator"
                 tabindex="0" aria-label="عرض المعاينة" hidden></div>
            <aside class="ws-side" data-ws-side aria-label="معاينة جنب النصّ" hidden></aside>
          </div>
        </main>

        <div class="ws-split" data-ws-split="insp" role="separator"
             aria-label="عرض التفاصيل" tabindex="0"></div>
        <aside class="ws-insp" id="ws-inspector" data-ws-insp aria-label="تفاصيل العنصر"></aside>
      </div>

      <!--
        ⚠️ **ولا شريطَ صوتٍ هنا** (WS-P4-C · بنود ٥ و٦ و٩): كان
           المشغّلُ المصغَّرُ آخِرَ عنصرٍ في الورشة، وحُذف هو ومساحتُه
           المحجوزة. والحقيقةُ الصوتيّةُ انتقلت إلى صفّ الوسيط الذي
           بدأتَ منه الصوت.

           ⚠️ ولا تُذكَر هنا أسماءُ سِماته الحرفيّة: الحارسُ ٥٦ يقيس
              خلوَّ الملفّ منها، وذِكرُها ولو في شرحٍ يُسقطه — وهو
              نفسُ درسِ WS-SC1 حيث حرس اختبارٌ حكايةَ الإصلاح بدل
              الإصلاح.
      -->
      <button type="button" class="ws-scrim" data-ws-scrim data-ws="drawer" data-v=""
              aria-label="اقفل الدرج" hidden></button>
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
      /*
       * ⚠️ **«ربط» بابٌ لا وضع** (WS-P4-C · بندا ٢ و٣).
       *
       *    ولا تلمس `state.mode`: لو جعلناها وضعًا لَبقيت مضاءةً بعد
       *    أن تُغلق اللوحَ بـ ✕، فتقول الشاشةُ «أنت في الربط» ولا لوحَ.
       *
       * ⚠️ **والتبويبُ الأخيرُ يعود** (بند ٢): `state.tab` حيّةٌ في
       *    الوحدة، فلا حاجةَ لحفظٍ إضافيّ — تفتح على ما تركتَه.
       *
       * ⚠️ **ولا يُمَسّ ما تقرؤه**: لا `state.node` ولا `state.open` ولا
       *    `state.mediaSel` ولا موضعُ التمرير. `applyShell` تكتب
       *    السِّماتِ على الجذر ولا تُعيد رسمَ المستند.
       */
      case 'link-panel':
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
        /* ⚠️ اختفت الأداةُ التي تجمع بها، فلا يبقى جمعٌ معلَّق (بند ١٦). */
        resetPicks();
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

      /* ---------- المعاينةُ جنب النصّ (بنود ٩ و١٣ و١٤) ---------- */
      case 'side-open': {
        /* ⚠️ الزرُّ نفسُه يقفلها إن كانت مفتوحةً على هذه الصورة (بند ٩). */
        if (state.side === id) { closeSide(); return undefined; }
        openSide(id);
        return undefined;
      }
      case 'side-close': { closeSide(); return undefined; }

      /* ---------- تحديدُ وسيطٍ محلّيّ (بند ١٦) ---------- */
      case 'pick-media': {
        if (state.pickMode) {
          if (state.picked.has(id)) state.picked.delete(id); else state.picked.add(id);
          paintItems();
          return undefined;
        }
        /*
         * ⚠️ **التحديدُ يقع، والفتحُ يبقى كما كان** (بندا ١٦ و٤٠): البندُ
         *    ١٦ يشترط تحديدًا محلّيًّا ولا يطلب إلغاءَ الفتح؛ والبندُ ٤٠
         *    يشترط بقاءَ «اختر/افتح صورة ← عرضٌ كبيرٌ نظيف» كما هو. فيقع
         *    الاثنان معًا، و`state.node` وحدَها هي التي لا تُمَسّ.
         */
        state.mediaSel = id;
        return openMedia(id, btn.dataset.kind);
      }
      case 'pick-mode': {
        state.pickMode = !state.pickMode;
        state.picked.clear();
        paintItems();
        return undefined;
      }
      case 'pick-link': return linkPicked();
      case 'pick-cancel': {
        state.pickMode = false;
        state.picked.clear();
        paintItems();
        return undefined;
      }
      case 'play': return playItem(id);
      /*
       * ⚠️ **وذهب `toggle` مع الشريط الذي كان يملكه** (بند ٥): كان
       *    زرَّ التشغيل في المشغّل المصغَّر وحدَه. والتشغيلُ والإيقافُ
       *    الآن على صفّ الوسيط عبر `playItem`/`audioButtonHtml` — وهو
       *    نفسُ الطريق إلى نفس الخدمة، لا طريقٌ ثانٍ.
       */
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
      /*
       * ⚠️ **مدخلان مباشران يعرفان مصدرَهما من `data-id`** (بندا ٦ و٨):
       *    `link-item` مصدرُه وسيطٌ بعينه فيسأل «إلى أين؟»، و`link-into`
       *    مصدرُه عقدةٌ بعينها فيسأل «أيَّ وسائط؟». وكلاهما ينتهي إلى
       *    `commitLink` — لا مسارَ ربطٍ ثانٍ (بند ١٧).
       */
      case 'open-draft': return openDraftDoc(id);
      case 'draft-back': return id ? selectNode(id) : undefined;
      /*
       * ⚠️ **ولا وضعَ تدريبٍ جديد** (بند ٢١): هذا نداءٌ مباشرٌ لـ
       *    `openShadowFromDraft` — نفسُ البابِ القائم منذ WS25 بمراجعته
       *    وحفظِه وبناءِ جلسته. أُضيف المدخلُ لا الوجهة.
       */
      case 'draft-practice': {
        const { openShadowFromDraft } = await import('../services/shadow/shadow-entry.js');
        return openShadowFromDraft(id);
      }
      case 'link-item': return pickTargetFor(id);
      case 'link-into': return pickMediaFor(id);
      case 'item-menu': return openItemMenu(id);
      case 'unlink': return dropLink(id, btn.dataset.at || null);
      /*
       * ⚠️ **و`link-current` ذهبت مع الشريط الذي كانت تسكنه** (بند ٤):
       *    كانت «اربط الصوتَ الشغّال بالمفتوح» في `⋯` المشغّل. وربطُ
       *    المقطع صار على صفّه بـ`link-item` — وهو أقربُ إلى يدك وأصدقُ
       *    في المعنى: تربط **هذا** الصوتَ لا «الشغّالَ الآن» أيًّا كان.
       */
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

  /*
   * ⚠️ **ولا يكون السحبُ الطريقَ الوحيد** (بندا ٤ و٣٧): المقبضُ
   *    `role="separator"` و`tabindex="0"` أصلًا — فالأسهمُ تحرّكه
   *    و`Home` تعيده. وهذا أيضًا ما يجعل الاختبارَ يقيس الحدودَ بلا
   *    محاكاةِ إصبع.
   */
  main.addEventListener('keydown', (event) => {
    const split = event.target.closest?.('[data-ws-split]');
    if (!split) return;
    if (resizeKey(event, split.dataset.wsSplit)) event.preventDefault();
  }, wired());

  main.addEventListener('pointerdown', (event) => {
    const split = event.target.closest('[data-ws-split]');
    if (split) { startResize(event, split.dataset.wsSplit); return; }

    const grip = event.target.closest('[data-ws-side-grip]');
    if (grip) { startSideResize(event, grip); return; }
    /*
     * ⚠️ **ولا مُلتقِطَ لشريط القفز هنا** (WS-P4-C · بند ٥): كان
     *    `[data-ws="seek"]` يعيش في المشغّل المصغَّر وحدَه، فذهب معه.
     *    و`audio.seekRatio` باقيةٌ في الخدمة لمن يحتاجها — شاشةُ الظلّ
     *    تستعملها. الذي زال مُلتقِطُ الورشة لا القدرة.
     */
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
  /* ⚠️ منافذُ WS-P3: تُقاس بها هُويّةُ التحديد ومسارُ الربط المباشر. */
  pickTargetFor, pickMediaFor, paintNav, paintDoc,
  /* ⚠️ منافذُ WS-P4: التحجيمُ والمعاينةُ الجانبيّةُ والربطُ الجزئيّ. */
  resetPane, resizeKey, openSide, closeSide, paintSide, paintItems, linkPicked, PANE,
  paintInsp,
};

/**
 * LingoLife — مكتبة البرومبتات (WS-PL · إعادةُ بناءٍ كاملةٍ للمعمار)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما وجدتُه في التدقيق — وهو أساسُ كلّ قرارٍ هنا
 * ═══════════════════════════════════════════════════════════════
 *
 * الشاشةُ القديمةُ لم تكن مكتبةً بأيّ معنًى: ثلاثُ بطاقاتٍ لطلباتِ
 * تحليلٍ **مكتوبةٍ في الكود** (`PROMPTS` مُجمَّدةٌ في `library.js`)، كلٌّ
 * منها يبني حزمة JSON تمرّ على خطّ الاستيراد. ولا إنشاءَ ولا حذفَ ولا
 * بحثَ ولا تصنيفَ ولا مفضّلة. أي أنّ البرومبتاتِ التي تكتبها فعلًا —
 * Core Chunks وTransfer Scene — **لم يكن لها مكانٌ في التطبيق**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولهذا صارت الشاشةُ شيئين لا شيئًا واحدًا
 * ═══════════════════════════════════════════════════════════════
 *
 * **١ · برومبتاتُك** — نصوصٌ تملكها وتحرّرها، في `promptVersions`.
 *
 * **٢ · طلباتُ التحليل** — الثلاثةُ القديمةُ كما هي **بلا مساس**: هي
 *      عقدُ ردٍّ يقرؤه الاستيراد لا نصٌّ تحرّره. ودمجُها في مخزنٍ قابلٍ
 *      للتحرير يكسر خطَّ التحليل من طرفه. فتُعرَض قسمًا مستقلًّا، ومسارُها
 *      القديم يعمل كما كان حرفًا بحرف.
 *
 * ⚠️ **والعارضُ هو البطل** (قاعدة ١ و٧): ثلاثةُ أعمدةٍ متساويةٍ هي عينُ
 *    العطب الذي أُصلح في الورشة (WS-P). فالتصنيفاتُ ضيّقةٌ، والقائمةُ
 *    معتدلة، والعارضُ يأخذ ما بقي — وينكمش الأوّلُ ثمّ الثاني عند الضيق.
 */

import { html, raw, $, $$, esc, downloadBlob, copyToClipboard } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { toastOk, toastError } from '../components/toast.js';
import { confirmAction, showModal } from '../components/modal.js';
import { scenes } from '../db/repositories.js';
import {
  PROMPTS, NOT_A_PROMPT, NEVER_ASKED, promptById,
  buildPrompt, previewInstructions, requestSummary, requestFilename,
  extraInstructions, setExtraInstructions,
} from '../services/prompts/library.js';
import { CONTRACT_VERSION } from '../services/prompts/contract.js';
import {
  listPrompts, getPrompt, createPrompt, updatePrompt, duplicatePrompt,
  trashPrompt,
  categoriesOf, tagsOf, sortPrompts, renameCategory, clearCategory,
  SORTS, SORT_LABEL, NO_CATEGORY,
} from '../services/prompts/user-prompts.js';
import {
  findPlaceholders, fillTemplate, unfilledCount, outlineOf, readingBlocks,
} from '../services/prompts/prompt-text.js';
import {
  buildCatalog, filterCatalog, countsOf, catalogCategories, catalogKey,
  toggleCatalogFavorite, markCatalogOpened, markCatalogCopied, copyToPersonal,
  SOURCE, SOURCE_LABEL, VIEW,
} from '../services/prompts/catalog.js';

/* ================================================================== *
 * الحالة
 * ================================================================== */

/*
 * ⚠️ **والأوجهُ تأتي من الفهرس لا تُعرَّف هنا** (بند ٤٧).
 *
 *    كان في هذا الملفِّ `VIEW` محلّيٌّ فيه `BUILTIN` — وهو الذي صنع
 *    الكونَين: وجهٌ يقرأ `promptVersions` ووجهٌ يقرأ مصفوفةً مُجمَّدة،
 *    بقائمتين وعارضَين. فحُذف، وصارت الأوجهُ تصفيةً على مجموعةٍ واحدة.
 */

/** حالاتُ الحفظ — **بأسماءٍ صريحةٍ لا بألوان** (بند ٢٩). */
const SAVE = Object.freeze({
  CLEAN: 'clean', DIRTY: 'dirty', SAVING: 'saving', SAVED: 'saved', FAILED: 'failed',
});
const SAVE_LABEL = Object.freeze({
  [SAVE.CLEAN]: '', [SAVE.DIRTY]: 'فيه تعديلات مش متحفظة',
  [SAVE.SAVING]: 'بيتحفظ…', [SAVE.SAVED]: 'اتحفظ', [SAVE.FAILED]: 'الحفظ فشل',
});

/**
 * ⚠️ **حالةُ جلسةٍ عابرةٌ كلُّها — ولا سطرَ منها يُكتَب في القاعدة.**
 *
 *    وأخصُّها `values`: قيمُ المتغيّرات التي تملؤها. حفظُها في متن
 *    البرومبت يحوّل قالبًا بنيتَه في شهور إلى نسخةٍ من استعمالٍ واحد
 *    (بند ٥٤ · قاعدة ٤).
 */
let state = null;

function fresh() {
  return {
    sel: null,
    view: VIEW.ALL,
    category: '',
    tag: '',
    query: '',
    sort: SORTS.UPDATED,
    mode: 'read',
    draft: null,
    save: SAVE.CLEAN,
    saveError: '',
    /** قيمُ المتغيّرات — عابرةٌ، ولا تُحفَظ (بند ٥٤). */
    values: {},
    /** المعاينةُ بعد التعبئة مفتوحة؟ (بند ٢١) */
    preview: false,
    outlineOpen: true,
    /** في العرض الضيّق: هل القائمةُ ظاهرةٌ فوق العارض؟ (بند ٤١) */
    listOpen: true,
    /** تصفيةٌ بالمصدر — من درج التصنيفات (بند ٥٦). */
    source: '',
    /** قسمُ التنظيم مفتوحٌ؟ — مطويٌّ افتراضيًّا (بند ٢٥). */
    metaOpen: false,
    /**
     * ⚠️ **درجُ التصنيفات — لا عمودٌ دائم** (بندا ١٤ و٥٤).
     *
     *    كان التصنيفُ يأخذ عمودًا كامل الارتفاع لأربعة صفوف، فيبتلع
     *    ٢٥٠px من عرض التابلت طوالَ الوقت مقابل تصفيةٍ تُستعمَل مرّةً
     *    في الجلسة. صار درجًا يُفتَح عند الحاجة ويُغلَق.
     */
    catsOpen: false,
    /* طلباتُ التحليل القديمة — حالتُها كما كانت. */
    builtin: null,
    material: '', hint: '', date: '', sceneId: '',
    sceneOptions: '',
  };
}
state = fresh();

export function resetPrompts() { state = fresh(); }

/**
 * بياناتُ اللوحة — تُقرأ مرّةً لكلّ رسمةٍ كاملة.
 *
 * ⚠️ `items` هي **الفهرسُ الموحَّد** من مصادره الأربعة، و`rows` تبقى
 *    برومبتاتك وحدَها لأنّ التصنيفَ وإعادةَ التسمية تعملان عليها هي.
 */
let items = [];
let catalogErrors = [];
let rows = [];
let extras = {};

/* ================================================================== *
 * القراءة والاشتقاق
 * ================================================================== */

/** العنصرُ المفتوح — بهُويّةِ الفهرس لا بمعرّفِ صفّ. */
const selected = () => (state.sel
  ? items.find((one) => one.catalogId === state.sel) || null
  : null);

/** هل المفتوحُ برومبتٌ تملكه؟ — تُسأل كثيرًا فتُختصَر. */
const isMine = (one) => Boolean(one) && one.sourceKind === SOURCE.PERSONAL;

/** ما يُعرَض في القائمة الآن — مصفًّى ومرتَّب. */
function visibleRows() {
  const list = filterCatalog(items, {
    view: state.view,
    query: state.query,
    category: state.category,
    tag: state.tag,
    source: state.source,
  });
  /*
   * ⚠️ «الأخيرة» مرتَّبةٌ بآخر استعمالٍ أصلًا — ولا تُعاد بترتيبٍ آخر.
   *
   * ⚠️ و`sortPrompts` تقرأ `updatedAt` و`title`، وهما على عناصر الفهرس
   *    كلِّها (المبنيُّ `lastModified: null` فيهبط إلى الآخر) — فترتيبٌ
   *    واحدٌ يسع المصادرَ كلَّها بلا فرعٍ ثانٍ.
   */
  if (state.view === VIEW.RECENT) return list;
  return sortPrompts(list.map((one) => ({ ...one, updatedAt: one.lastModified || 0 })), state.sort);
}

/** المتغيّراتُ في البرومبت المفتوح. */
const placeholders = () => {
  const row = selected();
  return row ? findPlaceholders(row.body) : [];
};

/** النصُّ الذي سيُنسَخ بعد التعبئة. */
const filledText = () => {
  const row = selected();
  return row ? fillTemplate(row.body, state.values) : '';
};

const hasFilled = () => Object.values(state.values).some((one) => String(one || '').trim());

/* ================================================================== *
 * أ · اللوحُ الجانبيّ — تصنيفاتٌ مضغوطة (بند ٥٧)
 * ================================================================== */

/**
 * صفُّ الأوجه — **أربعةُ أزرارٍ ودرج، لا عمودٌ كامل** (بندا ١٣ و١٤).
 *
 * ⚠️ **ومدخلُ الإنشاء واحدٌ** (بند ١٩): كانت الشاشةُ الفارغةُ تعرض
 *    ثلاثةَ أزرارٍ متطابقةٍ «+ برومبت جديد» — في اللوح الجانبيّ، وفي
 *    فراغ القائمة، وفي فراغ العارض. وتكرارُ الفعل الأوّل ثلاثًا لا
 *    يجعله أوضح بل يجعل الشاشةَ تصرخ.
 */
function facesHtml() {
  const counts = countsOf(items);

  const face = (id, label, count, on) => html`
    <button type="button" class="pl-face ${on ? 'is-on' : ''}"
            data-action="pl-view" data-id="${id}" aria-pressed="${on ? 'true' : 'false'}">
      <span>${label}</span>
      ${raw(count === null ? '' : html`<b>${count}</b>`)}
    </button>`;

  const filtering = Boolean(state.category || state.tag || state.source);

  return html`
    <div class="pl-bar">
      <button type="button" class="btn btn-primary pl-new" data-action="pl-new">
        ${raw(icon('plus', 15))} برومبت جديد
      </button>
    </div>

    <nav class="pl-faces" aria-label="أوجه المكتبة">
      <!--
        ⚠️ **«كل البرومبتات» تعني كلَّها الآن** (بندا ٤ و٢١): كانت تعدُّ
           صفوفَ مخزنٍ واحدٍ فتقول صفرًا وفي التطبيق خمسة. ومعها
           «برومبتاتي» لمن يريد ما يملكه وحدَه — واللفظان صادقان معًا.
      -->
      ${raw(face(VIEW.ALL, 'كل البرومبتات', counts[VIEW.ALL], state.view === VIEW.ALL && !filtering))}
      ${raw(face(VIEW.MINE, 'برومبتاتي', counts[VIEW.MINE], state.view === VIEW.MINE))}
      ${raw(face(VIEW.FAV, 'المفضلة', counts[VIEW.FAV], state.view === VIEW.FAV))}
      <!--
        ⚠️ **«الأخيرة» من فتحٍ ونسخٍ حقيقيَّين** (بند ١٣) — لا من
           آخرِ تعديل. وبرومبتٌ لم يُفتَح قطُّ لا يظهر فيها، ولو كان
           آخرَ ما عدّلتَه.
      -->
      ${raw(face(VIEW.RECENT, 'الأخيرة', counts[VIEW.RECENT], state.view === VIEW.RECENT))}

      <button type="button" class="pl-face pl-face-more ${filtering ? 'is-on' : ''}"
              data-action="pl-cats" aria-expanded="${state.catsOpen ? 'true' : 'false'}">
        <span>التصنيفات</span> <i aria-hidden="true">▾</i>
      </button>
    </nav>`;
}

/** درجُ التصنيفات والمصادر — يُفتَح عند الحاجة (بندا ١٤ و٥٤). */
function catsDrawerHtml() {
  if (!state.catsOpen) return '';
  const cats = catalogCategories(items);
  const tags = tagsOf(rows);
  const counts = countsOf(items);

  return html`
    <div class="pl-drawer" data-pl-drawer role="dialog" aria-label="تصفية">
      <div class="pl-drawer-head">
        <h3>تصفية</h3>
        <button type="button" class="ws-icon-btn" data-action="pl-cats"
                aria-label="اقفل">${raw(icon('close', 15))}</button>
      </div>

      <h4>النوع</h4>
      <div class="pl-tags">
        ${raw(Object.values(SOURCE).map((kind) => html`
          <button type="button" class="pl-tag ${state.source === kind ? 'is-on' : ''}"
                  data-action="pl-source" data-id="${kind}"
                  aria-pressed="${state.source === kind ? 'true' : 'false'}">
            ${SOURCE_LABEL[kind]} <i>${counts.bySource[kind] || 0}</i>
          </button>`).join(''))}
      </div>

      ${raw(cats.length ? html`
        <h4>التصنيفات</h4>
        <ul class="pl-cats">
          ${raw(cats.map((one) => html`
            <li>
              <button type="button" class="pl-cat ${state.category === one.name ? 'is-on' : ''}"
                      data-action="pl-cat" data-id="${one.name}"
                      aria-pressed="${state.category === one.name ? 'true' : 'false'}">
                <span dir="auto">${one.name}</span><b>${one.count}</b>
              </button>
              <!--
                ⚠️ **والإدارةُ خلف ⋯ لا بجوار التصفية** (بند ٥٤): إعادةُ
                   التسمية والإفراغُ فعلان نادران وخطيران، والتصفيةُ فعلٌ
                   يوميّ. وخلطُهما يجعل الضغطةَ الخاطئةَ سهلة.
              -->
              <button type="button" class="ws-icon-btn pl-cat-more" data-action="pl-cat-menu"
                      data-id="${one.name}" aria-label="خيارات ${one.name}">⋯</button>
            </li>`).join(''))}
        </ul>` : '')}

      ${raw(tags.length ? html`
        <h4>الوسوم</h4>
        <div class="pl-tags">
          ${raw(tags.slice(0, 18).map((one) => html`
            <button type="button" class="pl-tag ${state.tag === one.name ? 'is-on' : ''}"
                    data-action="pl-tag" data-id="${one.name}"
                    aria-pressed="${state.tag === one.name ? 'true' : 'false'}">
              #${one.name} <i>${one.count}</i>
            </button>`).join(''))}
        </div>` : '')}
    </div>`;
}

/* ================================================================== *
 * ب · القائمة — كثيفةٌ تُمسَح بالعين (بندا ٧ و٥٨)
 * ================================================================== */

/**
 * ⚠️ **ولا يُعرَض متنُ البرومبت في القائمة** (بند ٧): مئةُ صفٍّ فيها
 *    مئةُ متنٍ طويلٍ تجعل المسحَ مستحيلًا وتُبطئ الرسم. الاسمُ والغرضُ
 *    والتصنيفُ ووسمان — وما بعدها في العارض.
 */
function rowHtml(row) {
  const on = state.sel === row.catalogId;
  const tags = (row.tags || []).slice(0, 2);
  const more = (row.tags || []).length - tags.length;

  return html`
    <li class="pl-row ${on ? 'is-on' : ''}" ${on ? 'data-pl-here' : ''}>
      <button type="button" class="pl-row-hit" data-action="pl-open" data-id="${row.catalogId}"
              role="option" aria-selected="${on ? 'true' : 'false'}" title="${row.title}">
        <span class="pl-row-top">
          <span class="pl-row-t" dir="auto">${row.title}</span>
          ${raw(row.favorite ? '<span class="pl-star" aria-label="مفضلة">★</span>' : '')}
        </span>
        ${raw(row.purpose ? html`<span class="pl-row-p" dir="auto">${row.purpose}</span>` : '')}
        <span class="pl-row-meta">
          <!--
            ⚠️ **شارةُ النوع تقول ما هو لا أين ثابتُه** (بندا ٥ و٣٥):
               «تحليل» و«جملة» و«شخصي» — لا أسماءَ متغيّراتٍ برمجيّة.
               وهي بجوار التصنيف صغيرةً: العنوانُ يبقى البطل.
          -->
          <span class="pl-src is-${row.sourceKind}">${SOURCE_LABEL[row.sourceKind]}</span>
          ${raw(isMine(row) ? html`<span class="pl-row-cat" dir="auto">${row.category || NO_CATEGORY}</span>` : '')}
          ${raw(tags.map((one) => html`<i dir="auto">#${one}</i>`).join(''))}
          ${raw(more > 0 ? html`<i>+${more}</i>` : '')}
        </span>
      </button>
    </li>`;
}

/** حالاتُ الفراغ — **كلٌّ منها يقول ما تفعل** (بند ٣٧). */
function emptyHtml() {
  if (state.query.trim()) {
    return html`<div class="pl-empty">
      <p>مفيش نتيجة لـ «${state.query.trim()}»</p>
      <button type="button" class="btn btn-soft" data-action="pl-clear">امسح البحث</button>
    </div>`;
  }
  if (state.view === VIEW.FAV) {
    return html`<div class="pl-empty">
      <p>مفيش مفضلة لسّه</p>
      <p class="pl-hint">افتح أي برومبت واضغط ★ عشان يبقى هنا.</p>
    </div>`;
  }
  if (state.view === VIEW.RECENT) {
    return html`<div class="pl-empty">
      <p>مفيش برومبت اتفتح أو اتنسخ لسّه</p>
    </div>`;
  }
  if (state.category || state.tag || state.source) {
    return html`<div class="pl-empty">
      <p>مفيش برومبت هنا</p>
      <button type="button" class="btn btn-soft" data-action="pl-clear">شيل الفلاتر</button>
    </div>`;
  }
  /*
   * ⚠️ **ولا تُقال «المكتبة فاضية» والتطبيقُ فيه خمسةُ برومبتات** (بند ٢٠).
   *
   *    هذا هو العطبُ الأصليُّ في صورته الأخيرة: الشاشةُ كانت تنفي وجودَ
   *    ما هو موجود. والفارقُ الصادق: **أنت** لم تُضف بعدُ — والمبنيُّ
   *    موجودٌ ويظهر في «كل البرومبتات».
   */
  if (state.view === VIEW.MINE) {
    return html`<div class="pl-empty">
      <p>لسّه ما أضفتش برومبت شخصي</p>
      <p class="pl-hint">الصق أي برومبت بتستعمله مع ChatGPT وخلّيه هنا.</p>
      <button type="button" class="btn btn-soft" data-action="pl-view" data-id="${VIEW.ALL}">
        شوف كل البرومبتات
      </button>
    </div>`;
  }
  return html`<div class="pl-empty">
    <p>المكتبة فاضية</p>
    <p class="pl-hint">الصق أي برومبت بتستعمله مع ChatGPT وخلّيه هنا.</p>
  </div>`;
}

function listHtml() {
  const list = visibleRows();
  const filters = [
    state.category && { label: state.category, act: 'pl-cat', id: state.category },
    state.tag && { label: `#${state.tag}`, act: 'pl-tag', id: state.tag },
    state.source && { label: SOURCE_LABEL[state.source], act: 'pl-source', id: state.source },
  ].filter(Boolean);

  return html`
    ${raw(facesHtml())}
    ${raw(catsDrawerHtml())}

    <div class="pl-list-head">
      <div class="pl-find">
        ${raw(icon('search', 15))}
        <input class="ws-input" data-pl-find type="search" dir="auto"
               placeholder="دوّر في الاسم والمتن والوسوم…"
               aria-label="دوّر في البرومبتات" value="${state.query}">
        ${raw(state.query ? html`
          <button type="button" class="ws-clear" data-action="pl-clear"
                  aria-label="امسح البحث">${raw(icon('close', 14))}</button>` : '')}
      </div>
      <label class="pl-sort">
        <span class="sr-only">ترتيب</span>
        <select data-pl-sort aria-label="ترتيب القائمة">
          ${raw(Object.values(SORTS).map((one) => html`
            <option value="${one}"${one === state.sort ? ' selected' : ''}>${SORT_LABEL[one]}</option>`).join(''))}
        </select>
      </label>
    </div>

    <!--
      ⚠️ **الفلاتر الفعّالةُ معلَنة** (بند ٥٦): «ليه بشوف دول؟» سؤالٌ
         يجب أن يُجاب من الشاشة لا بالتخمين. وإخفاءُ البرومبت المحدَّد
         بلا كلمةٍ أسوأُ من عدم تصفيته أصلًا.
    -->
    ${raw(filters.length ? html`
      <div class="pl-active" role="status">
        ${raw(filters.map((one) => html`
          <button type="button" class="pl-chip" data-action="${one.act}" data-id="${one.id}">
            ${one.label} ✕</button>`).join(''))}
        <button type="button" class="pl-chip is-clear" data-action="pl-clear">مسح الفلاتر</button>
      </div>` : '')}

    ${raw(catalogErrors.length ? html`
      <!--
        ⚠️ **مصدرٌ سقط يُقال، ولا يُفرَغ به الباقي** (بند ٥٩): إخفاءُ
           عائلةِ برومبتاتٍ كاملةٍ خلف عطبٍ صامتٍ أسوأُ من رسالةِ خطأ.
      -->
      <div class="pl-warn" role="status">
        ${raw(catalogErrors.map((one) => html`
          <p>تعذّر تحميل «${SOURCE_LABEL[one.source] || one.source}» — ${one.message}</p>`).join(''))}
      </div>` : '')}

    <p class="pl-count" role="status">${list.length} من ${items.length}</p>

    ${raw(list.length
      ? html`<ul class="pl-rows" role="listbox" aria-label="البرومبتات">
          ${raw(list.map(rowHtml).join(''))}
        </ul>`
      : emptyHtml())}`;
}

/* ================================================================== *
 * ج · العارض — هو البطل (بنود ٤ و٥ و٢٥ و٥٩)
 * ================================================================== */

function viewerHtml() {
  const row = selected();
  if (!row) {
    /*
     * ⚠️ **ولا زرَّ إنشاءٍ ثانيًا هنا** (بند ١٩): المدخلُ الأوّلُ فوق
     *    القائمة، وتكرارُه في فراغ العارض كان أحدَ النسخ الثلاث.
     */
    return html`
      <div class="pl-blank">
        <p>${items.length ? 'اختار برومبت من القايمة' : 'مفيش برومبتات لسّه'}</p>
      </div>`;
  }

  const vars = placeholders();
  const line = outlineOf(row.body);
  /* ⚠️ ولا يُعرَض مخطَّطٌ لبرومبتٍ قصير (بند ٤٠) — سرقةُ عرضٍ بلا مقابل. */
  const showOutline = line.length >= 4 && row.body.length > 1200;
  const analysis = row.sourceKind === SOURCE.ANALYSIS;
  const prompt = analysis ? promptById(row.sourceId) : null;

  return html`
    ${raw(viewerHeadHtml(row, vars))}
    <div class="pl-body">
      ${raw(showOutline ? outlineHtml(line) : '')}
      <div class="pl-main" data-pl-main>
        ${raw(state.mode === 'edit' ? editorHtml(row) : readHtml(row))}

        <!--
          ⚠️ **ومسارُ الاستعمال يبقى المولِّد نفسَه** (قيد المالك ١):
             طلبُ التحليل يبني حزمةَ JSON من ذكرًى حقيقيّة، والمعروضُ
             أعلاه تعليماتُه فقط. فالحقولُ والأفعالُ هنا هي القديمةُ
             بلا مسارٍ ثانٍ — نسخُ التعليمات شيءٌ وبناءُ الطلب شيء.
        -->
        ${raw(analysis && prompt && state.mode === 'read' ? html`
          <div class="pl-use">
            <h3>استعمله على ذكرى</h3>
            ${raw(builtinBodyHtml(prompt))}
          </div>` : '')}
      </div>
      ${raw(vars.length && state.mode === 'read' ? varsHtml(vars) : '')}
    </div>`;
}

function viewerHeadHtml(row, vars) {
  const stamp = row.lastModified ? new Date(row.lastModified).toLocaleDateString('ar-EG') : '';
  const mine = isMine(row);

  return html`
    <header class="pl-head">
      <div class="pl-head-top">
        <h2 class="pl-title" dir="auto" title="${row.title}">${row.title}</h2>
        <button type="button" class="pl-fav ${row.favorite ? 'is-on' : ''}"
                data-action="pl-fav" data-id="${row.catalogId}"
                aria-pressed="${row.favorite ? 'true' : 'false'}"
                aria-label="${row.favorite ? 'شيل من المفضلة' : 'ضيف للمفضلة'}">★</button>
      </div>

      ${raw(row.purpose ? html`<p class="pl-purpose" dir="auto">${row.purpose}</p>` : '')}

      <div class="pl-facts">
        <span class="pl-src is-${row.sourceKind}">${SOURCE_LABEL[row.sourceKind]}</span>
        ${raw(mine ? html`<span class="pl-row-cat" dir="auto">${row.category || NO_CATEGORY}</span>` : '')}
        ${raw((row.tags || []).map((one) => html`<i dir="auto">#${one}</i>`).join(''))}
        ${raw(stamp ? html`<span>آخر تعديل ${stamp}</span>` : '')}
        <!--
          ⚠️ **ولا يُعرَض عدّادٌ إلّا إن وقع فعلًا** (بندا ١٤ و٤٧ · قاعدة ٩):
             عدّادُ النسخ يزيد **بعد** نجاح النسخ لا عند الضغط. وصفرٌ لا
             يُرسَم أصلًا — «نُسخ ٠ مرّة» ضجيجٌ لا خبر.
        -->
        ${raw(row.copies ? html`<span>اتنسخ ${row.copies} مرّة</span>` : '')}
      </div>

      <div class="pl-acts">
        ${raw(state.mode === 'edit' ? html`
          <button type="button" class="btn btn-primary" data-action="pl-save">احفظ</button>
          <button type="button" class="btn btn-ghost" data-action="pl-cancel">إلغاء</button>
          ${raw(saveBadgeHtml())}`
          : html`
          <button type="button" class="btn btn-primary" data-action="pl-copy" data-id="${row.catalogId}">
            ${raw(icon('copy', 15))} نسخ
          </button>
          ${raw(vars.length ? html`
            <button type="button" class="btn btn-soft" data-action="pl-copy-filled" data-id="${row.catalogId}"
                    ${hasFilled() ? '' : 'disabled'}>نسخ بعد التعبئة</button>` : '')}

          <!--
            ⚠️ **ولا زرَّ «تعديل» لما تملكه آلةُ التطبيق** (بندا ٦ و٣١):
               عرضُ زرٍّ يرفض العملَ أسوأُ من غيابه. والبابُ المفتوحُ
               بدلَه: نسخةٌ تملكها أنت — بمعرّفٍ جديدٍ لا يعرف أباه.
          -->
          ${raw(row.editable ? html`
            <button type="button" class="btn btn-soft" data-action="pl-edit">
              ${raw(icon('edit', 15))} تعديل
            </button>` : html`
            <button type="button" class="btn btn-soft" data-action="pl-fork" data-id="${row.catalogId}">
              ${raw(icon('copy', 15))} انسخه لبرومبتاتي
            </button>`)}

          <!-- ⚠️ والحذفُ ليس بجوار «نسخ» (بند ٣٠) — بل خلف زرّ الخيارات. -->
          ${raw(mine ? html`
            <button type="button" class="ws-icon-btn pl-more" data-action="pl-menu" data-id="${row.sourceId}"
                    aria-label="خيارات تانية">⋯</button>` : '')}`)}
      </div>
    </header>`;
}

function saveBadgeHtml() {
  if (state.save === SAVE.CLEAN) return '';
  return html`
    <span class="pl-save is-${state.save}" data-pl-save role="status" aria-live="polite">
      ${SAVE_LABEL[state.save]}${raw(state.save === SAVE.FAILED && state.saveError
        ? html` — <i dir="auto">${state.saveError}</i>` : '')}
    </span>`;
}

/**
 * سطحُ القراءة — **النصُّ كما كتبتَه، حرفًا بحرف** (بنود ٢٥ و٦٢ و٦٣).
 *
 * ⚠️ **ولا Markdown ولا تلوينَ صياغة**: البرومبتُ ليس Markdown، وتشغيلُ
 *    مُصيِّرٍ عليه يحوّل `#` و`*` إلى تنسيقٍ لم تقصده. فالعرضُ نصٌّ
 *    مهرَّبٌ مرّةً واحدة داخل `<pre>` يلفّ.
 *
 * ⚠️ **والاتّجاهُ لكلّ كتلةٍ بغلبة حروفها** (بند ٢٦): فقرةٌ إنجليزيّةٌ
 *    وسط برومبتٍ عربيٍّ تُعرَض LTR، وقوسُها ونقطتُها في مكانهما.
 */
function readHtml(row) {
  const text = state.preview && hasFilled() ? filledText() : row.body;
  const blocks = readingBlocks(text);
  const left = unfilledCount(row.body, state.values);

  return html`
    ${raw(state.preview ? html`
      <div class="pl-preview-bar" role="status">
        معاينة بعد التعبئة${raw(left ? html` — لسّه ${left} متغيّر فاضي` : '')}
        <button type="button" class="pl-chip" data-action="pl-preview">ارجع للقالب</button>
      </div>` : '')}
    <article class="pl-doc" data-pl-doc>
      ${raw(blocks.map((one, i) => html`
        <pre class="pl-block" dir="${one.dir}" data-pl-block="${i}">${one.text}</pre>`).join(''))}
    </article>`;
}

/**
 * المحرّر — **صريحٌ ولا يحفظ بصمت** (بندا ٥ و٢٩).
 *
 * ⚠️ **ولا حفظَ تلقائيّ.** الشاشةُ القديمةُ لم يكن فيها تحريرُ برومبت
 *    أصلًا، فلا دلالةَ قائمةً أحافظ عليها. وبرومبتٌ من خمسين قسمًا
 *    يُحفَظ تلقائيًّا وأنت في نصف تعديلٍ يترك في القاعدة نصفَ قالب.
 */
/**
 * المحرّرُ — **الاسمُ والمتنُ أوّلًا، والتنظيمُ ثانيًا** (بنود ٢٤ و٢٥ و٦٦).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما كان يحدث قبل هذا: استمارةٌ إداريّةٌ لا مكانَ كتابة
 * ═══════════════════════════════════════════════════════════════
 *
 * خمسةُ حقولٍ متساويةِ الوزن: الاسمُ ثم الغرضُ ثم التصنيفُ ثم الوسومُ
 * ثم — أخيرًا — البرومبت. والفعلُ الحقيقيُّ الذي جئتَ من أجله (تلصق
 * نصًّا طويلًا كتبتَه في ChatGPT) كان خامسًا في الترتيب البصريّ.
 *
 * فصار المتنُ يأخذ المساحةَ، والغرضُ والتصنيفُ والوسومُ خلف «التنظيم»
 * مطويّةً — **ظاهرةً لا مخفيّة**، تفتحها إن أردت وتتجاهلها إن لم ترد.
 *
 * ⚠️ **ولا يُطلَب منك التفكيرُ في البيانات الوصفيّة قبل اللصق** (بند ٢٤).
 */
function editorHtml(row) {
  const d = state.draft;
  /*
   * ⚠️ **وتعليماتُك على طلبِ تحليلٍ متنٌ وحدَه** (قيد المالك ٣): لا اسمَ
   *    ولا تصنيفَ ولا وسومَ لها، لأنها ليست صفًّا تملكه بل حقلٌ في
   *    الإعدادات مربوطٌ بطلبٍ مبنيّ. وعرضُ حقولٍ لا تُحفَظ كذبٌ صغير.
   */
  const extra = row.sourceKind === SOURCE.EXTRA;

  return html`
    <div class="pl-edit">
      ${raw(extra ? html`
        <p class="pl-edit-note">
          دي تعليماتك على «${row.title.replace(/^تعليماتك على «|»$/g, '')}» —
          بتتحفظ في الإعدادات وبتتلحق بالطلب في كل مرّة.
        </p>` : html`
        <label class="pl-fld">
          <span>الاسم</span>
          <input class="ws-input" data-pl-title dir="auto" value="${d.title}">
        </label>`)}

      <label class="pl-fld pl-fld-grow">
        <span>البرومبت</span>
        <!--
          ⚠️ spellcheck="false" لأنّ المتن مختلطُ اللغات، والتسطيرُ
             الأحمرُ تحت كلّ كلمةٍ روسيّةٍ يجعل القراءةَ مستحيلة.
        -->
        <textarea class="ws-area pl-area" data-pl-body dir="auto"
                  spellcheck="false">${d.body}</textarea>
      </label>

      ${raw(extra ? '' : html`
        <!--
          ⚠️ **مطويّةٌ لا مخفيّة** (بند ٢٥): عنصرُ الطيّ يبقى في مسار
             التنقّل بلوحة المفاتيح ويُعلن حالتَه، بخلاف حقلٍ يُزال.

          ⚠️ ولا علامةَ اقتباسٍ خلفيّةٍ في تعليقٍ داخل قالبٍ نصّيّ —
             تُنهي القالبَ فيتوقّف التحليل. وهي رابعُ مرّةٍ تقع.
        -->
        <details class="pl-meta"${state.metaOpen ? ' open' : ''} data-pl-meta>
          <summary>التنظيم — اختياري</summary>
          <label class="pl-fld">
            <span>الغرض — سطر واحد يفكّرك بالبرومبت ده بيعمل إيه</span>
            <input class="ws-input" data-pl-purpose dir="auto" value="${d.purpose}"
                   placeholder="مثال: يحوّل جملة روسية لـ Core Chunks">
          </label>
          <div class="pl-fld-row">
            <label class="pl-fld">
              <span>التصنيف</span>
              <input class="ws-input" data-pl-category dir="auto" value="${d.category}"
                     list="pl-cats" placeholder="${NO_CATEGORY}">
            </label>
            <label class="pl-fld">
              <span>وسوم — بفاصلة</span>
              <input class="ws-input" data-pl-tags dir="auto" value="${d.tags}"
                     placeholder="روسي، شادوينج">
            </label>
          </div>
          <datalist id="pl-cats">
            ${raw(categoriesOf(rows).map((one) => html`<option value="${one.name}"></option>`).join(''))}
          </datalist>
        </details>`)}
      ${raw(state.save === SAVE.FAILED ? html`
        <div class="ws-fail is-inline" role="alert">
          <p>الحفظ فشل — اللي كتبتَه لسّه هنا.</p>
          <p class="ws-fail-why" dir="auto">${state.saveError || 'سبب مش معروف'}</p>
          <button type="button" class="btn" data-action="pl-save">جرّب تحفظ تاني</button>
        </div>` : '')}
    </div>`;
}

/**
 * لوحُ المتغيّرات (بنود ١٩ و٢١ و٥٣).
 *
 * ⚠️ **ولا يُدخَل وضعُ التحرير لأجل التعبئة.** هذا بيتُ القصيد: تفتح
 *    البرومبت، تملأ الحقول، تعاين، تنسخ — **والقالبُ المحفوظ لم يُمَسّ**.
 */
function varsHtml(vars) {
  return html`
    <aside class="pl-vars" aria-label="المتغيرات">
      <div class="pl-vars-head">
        <h3>المتغيرات</h3>
        <span>${vars.length}</span>
      </div>
      ${raw(vars.map((one) => html`
        <label class="pl-var">
          <span dir="auto">${one.name}</span>
          <textarea class="ws-area pl-var-in" data-pl-var="${one.name}" dir="auto" rows="2"
                    spellcheck="false">${state.values[one.name] || ''}</textarea>
        </label>`).join(''))}
      <div class="pl-vars-acts">
        <button type="button" class="btn btn-soft" data-action="pl-preview"
                ${hasFilled() ? '' : 'disabled'}>
          ${state.preview ? 'ارجع للقالب' : 'عاين بعد التعبئة'}
        </button>
        <button type="button" class="btn btn-soft" data-action="pl-clear-vars"
                ${hasFilled() ? '' : 'disabled'}>مسح القيم</button>
      </div>
      <p class="pl-hint">القيم دي مؤقتة — البرومبت المحفوظ مابيتغيّرش.</p>
    </aside>`;
}

/** مخطَّطُ الأقسام — للتنقّل لا للتنسيق (بند ٢٤). */
function outlineHtml(line) {
  return html`
    <nav class="pl-outline ${state.outlineOpen ? '' : 'is-shut'}" aria-label="أقسام البرومبت">
      <button type="button" class="pl-outline-toggle" data-action="pl-outline"
              aria-expanded="${state.outlineOpen ? 'true' : 'false'}">
        الأقسام <b>${line.length}</b>
      </button>
      ${raw(state.outlineOpen ? html`
        <ol class="pl-outline-list">
          ${raw(line.map((one) => html`
            <li><button type="button" data-action="pl-jump" data-id="${one.line}"
                        dir="auto" title="${one.text}">${one.text}</button></li>`).join(''))}
        </ol>` : '')}
    </nav>`;
}

/* ================================================================== *
 * د · طلباتُ التحليل المبنيّة — **بلا مساسٍ بمسارها** (بند ٠)
 * ================================================================== */


/** جسمُ الطلب المبنيّ — **نفسُ الحقول ونفسُ الأفعال** كما كانت. */
function builtinBodyHtml(prompt) {
  if (prompt.needs === 'material') {
    return html`
      <div class="pr-body">
        <label class="pr-label" for="pr-material">الصق التفريغ أو الملاحظات أو أي نصّ من الموقف</label>
        <textarea class="ws-area" id="pr-material" data-pr-material dir="auto"
                  rows="8">${state.material}</textarea>
        <div class="pl-fld-row">
          <label class="pl-fld"><span>تلميح (اختياري)</span>
            <input class="ws-input" data-pr-hint dir="auto" value="${state.hint}"></label>
          <label class="pl-fld"><span>تاريخ الواقعة (اختياري)</span>
            <input class="ws-input" data-pr-date type="date" value="${state.date}"></label>
        </div>
        <button class="btn btn-primary" data-action="prompt-build" data-id="${prompt.id}">
          اعمل الطلب
        </button>
      </div>`;
  }
  return html`
    <div class="pr-body">
      <label class="pr-label" for="pr-scene">اختار الذكرى</label>
      <select class="ws-input" id="pr-scene" data-pr-scene>
        <option value="">— اختار —</option>
        ${raw(state.sceneOptions)}
      </select>
      <button class="btn btn-primary" data-action="prompt-build" data-id="${prompt.id}">
        اعمل الطلب
      </button>
    </div>`;
}

/* ================================================================== *
 * الرسم
 * ================================================================== */

export async function renderPrompts(main) {
  const [cat, list, mine, sceneRows] = await Promise.all([
    buildCatalog(),
    listPrompts(),
    extraInstructions(),
    scenes.page({ index: 'date', direction: 'prev', limit: 60 }),
  ]);

  items = cat.items;
  catalogErrors = cat.errors;
  rows = list;
  extras = mine;

  /*
   * ⚠️ **والسكّةُ مضغوطةٌ هنا — بآليّة الورشة نفسِها لا بأخرى** (بند ١٨).
   *
   *    `ws-rail-compact` و`ws-fabs-on` صنفان على `body` تملكهما الورشةُ
   *    من قبلُ، وتُنظّفهما عند المغادرة. فإعادةُ بنائهما هنا كانت ستصنع
   *    سكّتين تفترقان بعد أوّل تحسين.
   */
  document.body.classList.add('ws-rail-compact');
  document.body.classList.remove('ws-fabs-on');

  state.sceneOptions = sceneRows.map((row) => html`
    <option value="${row.id}"${row.id === state.sceneId ? ' selected' : ''}>
      ${row.titleAr || row.titleRu || 'ذكرى بلا عنوان'} — ${row.date || ''}
    </option>`).join('');

  /* ⚠️ برومبتٌ حُذف لا يبقى «محدَّدًا» بمعرِّفٍ ميّت. */
  if (state.sel && !items.some((one) => one.catalogId === state.sel)) {
    state.sel = null;
    state.mode = 'read';
  }

  main.innerHTML = html`
    <div class="pl" data-pl data-pl-list="${state.listOpen ? 'open' : 'shut'}">
      <section class="pl-list" data-pl-list-pane aria-label="البرومبتات">${raw(listHtml())}</section>
      <section class="pl-viewer" data-pl-viewer aria-label="البرومبت">
        <!--
          ⚠️ **زرُّ الرجوع للقائمة في العرض الضيّق** (بندا ٤١ و٧١-١٢):
             حين يأخذ العارضُ الشاشةَ كلَّها لا يبقى للقائمة أثر، فيجب
             أن يكون الطريقُ إليها ظاهرًا لا مستنتَجًا.
        -->
        <button type="button" class="pl-back" data-action="pl-back">← القايمة</button>
        ${raw(viewerHtml())}
      </section>
    </div>`;

  wire(main);
}

/**
 * يعيد قراءةَ الفهرس وصفوفِك بعد كلّ تغيير.
 *
 * ⚠️ **والاثنان معًا لا أحدُهما**: العدّادُ يقرأ `items` والتصنيفُ يقرأ
 *    `rows`. وتحديثُ واحدٍ دون الآخر يجعل الرقمَ يخالف القائمةَ لحظةً
 *    — وهو بعينه العطبُ الذي جاءت هذه التمريرةُ لإصلاحه.
 */
async function reload() {
  const [cat, list] = await Promise.all([buildCatalog(), listPrompts()]);
  items = cat.items;
  catalogErrors = cat.errors;
  rows = list;
}

/** يعيد رسمَ لوحٍ واحدٍ — بلا هدم الشاشة كلِّها. */
function paint(part) {
  /* ⚠️ ولا لوحَ جانبيًّا يُرسَم — الأوجهُ صارت في رأس القائمة (بند ١٣). */
  if (part === 'side' || part === 'list' || part === 'all') {
    const el = $('[data-pl-list-pane]');
    if (el) el.innerHTML = listHtml();
  }
  if (part === 'viewer' || part === 'all') {
    const el = $('[data-pl-viewer]');
    if (el) {
      el.innerHTML = `<button type="button" class="pl-back" data-action="pl-back">← القايمة</button>${viewerHtml()}`;
    }
  }
  const root = $('[data-pl]');
  if (root) root.dataset.plList = state.listOpen ? 'open' : 'shut';
}

/* ================================================================== *
 * الأحداثُ الحيّة — بحثٌ وتحرير
 * ================================================================== */

let findTimer = 0;

function wire(main) {
  main.addEventListener('input', (event) => {
    const find = event.target.closest('[data-pl-find]');
    if (find) {
      state.query = find.value;
      /*
       * ⚠️ **مهلةٌ قصيرةٌ قبل التصفية** (بند ٩): كلُّ حرفٍ يعيد رسمَ
       *    القائمة، ورسمُ مئاتِ الصفوف عند كلّ ضغطةٍ يجعل الكتابةَ
       *    تتلعثم. والمهلةُ ١٢٠ms — أقصرُ من أن تُحسّ وأطولُ من أن
       *    ترسم لكلّ حرف.
       */
      clearTimeout(findTimer);
      findTimer = setTimeout(() => {
        paint('list');
        const box = $('[data-pl-find]');
        if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      }, 120);
      return;
    }

    const varBox = event.target.closest('[data-pl-var]');
    if (varBox) {
      state.values[varBox.dataset.plVar] = varBox.value;
      /* المعاينةُ وحدَها تُنعَش — ولا يُعاد بناءُ الحقل الذي تكتب فيه. */
      if (state.preview) repaintDoc();
      refreshVarButtons();
      return;
    }

    if (state.mode === 'edit' && state.draft) {
      captureDraft();
      setSave(state.save === SAVE.FAILED ? SAVE.FAILED : SAVE.DIRTY);
    }
  });

  main.addEventListener('change', (event) => {
    const sort = event.target.closest('[data-pl-sort]');
    if (sort) { state.sort = sort.value; paint('list'); }
  });
}

/** يعيد رسمَ سطح القراءة وحدَه — للمعاينة الحيّة. */
function repaintDoc() {
  const row = selected();
  const host = $('[data-pl-main]');
  if (row && host && state.mode === 'read') host.innerHTML = readHtml(row);
}

/** يحدّث تعطيلَ أزرار المتغيّرات بلا إعادة بناءِ اللوح. */
function refreshVarButtons() {
  const on = hasFilled();
  for (const sel of ['[data-action="pl-preview"]', '[data-action="pl-clear-vars"]',
    '[data-action="pl-copy-filled"]']) {
    for (const btn of $$(sel)) btn.disabled = !on;
  }
}

function setSave(next, error = '') {
  state.save = next;
  state.saveError = error;
  const el = $('[data-pl-save]');
  if (el) el.outerHTML = saveBadgeHtml();
  else {
    const acts = $('.pl-acts');
    if (acts && saveBadgeHtml()) acts.insertAdjacentHTML('beforeend', saveBadgeHtml());
  }
}

/** يقرأ ما في حقول المحرّر إلى المسوّدة — قبل أيّ إعادة رسم. */
function captureDraft() {
  if (!state.draft) return;
  const at = (sel) => $(sel)?.value;
  const title = at('[data-pl-title]');
  const purpose = at('[data-pl-purpose]');
  const category = at('[data-pl-category]');
  const tags = at('[data-pl-tags]');
  const body = at('[data-pl-body]');
  const meta = $('[data-pl-meta]');
  if (meta) state.metaOpen = meta.open;
  if (title !== undefined) state.draft.title = title;
  if (purpose !== undefined) state.draft.purpose = purpose;
  if (category !== undefined) state.draft.category = category;
  if (tags !== undefined) state.draft.tags = tags;
  if (body !== undefined) state.draft.body = body;
}

const draftChanged = () => {
  const row = selected();
  const d = state.draft;
  if (!row || !d) return false;
  /* ⚠️ وتعليماتُك متنٌ وحدَه — ومقارنةُ اسمٍ لا تملكه تجعلها «متغيّرةً» دائمًا. */
  if (row.sourceKind === SOURCE.EXTRA) return d.body !== row.body;
  return d.title !== row.title || d.body !== row.body || d.purpose !== (row.purpose || '')
    || d.category !== (row.category || NO_CATEGORY)
    || d.tags !== (row.tags || []).join('، ');
};

/**
 * ⚠️ **ولا يُترَك تعديلٌ غيرُ محفوظٍ بلا سؤال** (بند ٣٠).
 *
 *    برومبتٌ من خمسين قسمًا تحرّره ثمّ تلمس صفًّا آخر — الصمتُ هنا
 *    يعني ضياعَ عملِ ساعة. ولا حفظَ تلقائيَّ يغنيني عن السؤال، لأنّه
 *    غيرُ موجودٍ في هذه الشاشة أصلًا.
 */
async function leaveEditor() {
  if (state.mode !== 'edit') return true;
  captureDraft();
  if (!draftChanged()) { state.mode = 'read'; state.draft = null; return true; }
  const go = await confirmAction({
    title: 'فيه تعديلات مش متحفظة',
    message: 'لو سِبت البرومبت ده دلوقتي هتخسر اللي كتبتَه. تحبّ تحفظ الأول؟',
    confirmLabel: 'اخرج من غير حفظ',
    danger: true,
  });
  if (!go) return false;
  state.mode = 'read';
  state.draft = null;
  setSave(SAVE.CLEAN);
  return true;
}

/* ================================================================== *
 * الأفعال
 * ================================================================== */

export async function handlePromptsAction(action, id, target) {
  /* ---------- أوجهُ التصفية ---------- */
  if (action === 'pl-view') {
    if (!(await leaveEditor())) return true;
    state.view = id;
    state.category = '';
    state.tag = '';
    state.source = '';
    state.listOpen = true;
    paint('all');
    return true;
  }

  if (action === 'pl-cat') {
    state.category = state.category === id ? '' : id;
    state.catsOpen = false;
    paint('all');
    return true;
  }

  if (action === 'pl-tag') {
    state.tag = state.tag === id ? '' : id;
    state.catsOpen = false;
    paint('all');
    return true;
  }

  if (action === 'pl-clear') {
    state.query = '';
    state.category = '';
    state.tag = '';
    state.source = '';
    paint('all');
    return true;
  }

  if (action === 'pl-back') { state.listOpen = true; paint('all'); return true; }

  /* ---------- فتحُ برومبت ---------- */
  if (action === 'pl-open') {
    if (!(await leaveEditor())) return true;
    if (state.sel !== id) {
      state.sel = id;
      /* ⚠️ قيمُ المتغيّرات تخصّ برومبتًا بعينه — ولا تُحمَل إلى غيره. */
      state.values = {};
      state.preview = false;
    }
    state.listOpen = false;
    /*
     * ⚠️ **وطلبُ التحليل يُزامَن مع حالة المولِّد** (قيد المالك ١):
     *    `builtinBodyHtml` تقرأ `state.builtin`، فلو بقي على القديم
     *    عرض العارضُ حقولَ طلبٍ غيرِ الذي تنظر إليه.
     */
    const picked = selected();
    state.builtin = picked && picked.sourceKind === SOURCE.ANALYSIS ? picked.sourceId : null;
    paint('all');
    /* ⚠️ يُسجَّل الفتحُ بعد الرسم — والفشلُ فيه لا يمنعك من القراءة. */
    if (picked) {
      markCatalogOpened(picked)
        .then(() => reload())
        .catch(() => {});
    }
    return true;
  }

  /* ---------- النسخ (بنود ٦ و٢٢ و٦٠ و٦٤) ---------- */
  if (action === 'pl-copy' || action === 'pl-copy-filled') {
    const row = items.find((one) => one.catalogId === id);
    if (!row) return true;
    /*
     * ⚠️ **الفرقُ معلَنٌ لا مضمَر** (بند ٢٢): «نسخ» ينسخ القالبَ كما
     *    هو، و«نسخ بعد التعبئة» ينسخ نسخةً مُطبَّقةً عليها قيمُك.
     *    ولا يُستبدَل متغيّرٌ صامتًا في زرِّ النسخ العاديّ.
     */
    const text = action === 'pl-copy-filled' ? fillTemplate(row.body, state.values) : row.body;
    const ok = await copyToClipboard(text);
    if (!ok) { toastError('النسخ مانفعش — جرّب تاني'); return true; }

    flashCopied(target);
    /* ⚠️ العدُّ **بعد** النجاح لا عند الضغط (بند ١٤). */
    markCatalogCopied(row).then(() => reload()).catch(() => {});
    return true;
  }

  /* ---------- المفضّلة ---------- */
  if (action === 'pl-fav') {
    const row = items.find((one) => one.catalogId === id);
    if (!row) return true;
    try {
      /*
       * ⚠️ **ورأيُك في المبنيِّ يُحفَظ في تفضيلاتك** (بندا ٩ و٤٨):
       *    `PROMPTS` مُجمَّدةٌ فعلًا، وكتابةُ `favorite` عليها ترمي.
       *    فالفهرسُ يوجّه كلَّ مصدرٍ إلى مخزنه.
       */
      await toggleCatalogFavorite(row);
      await reload();
      paint('all');
    } catch (error) { toastError(error.message); }
    return true;
  }

  /* ---------- نسخةٌ تملكها من برومبتٍ مبنيّ (بندا ٣٢ و٥٣) ---------- */
  if (action === 'pl-fork') {
    const row = items.find((one) => one.catalogId === id);
    if (!row) return true;
    try {
      const made = await copyToPersonal(row);
      await reload();
      /* ⚠️ والنسخةُ تُفتَح فورًا — وإلّا بدا الفعلُ كأنه لم يقع. */
      state.sel = catalogKey(SOURCE.PERSONAL, made.id);
      state.view = VIEW.MINE;
      state.values = {};
      paint('all');
      toastOk('اتعملت نسخة تقدر تعدّلها');
    } catch (error) { toastError(error.message); }
    return true;
  }

  /* ---------- درجُ التصفية والمصدر (بندا ١٤ و٥٦) ---------- */
  if (action === 'pl-cats') { state.catsOpen = !state.catsOpen; paint('list'); return true; }

  if (action === 'pl-source') {
    state.source = state.source === id ? '' : id;
    state.catsOpen = false;
    paint('all');
    return true;
  }

  /* ---------- التحرير ---------- */
  if (action === 'pl-edit') {
    const row = selected();
    if (!row) return true;
    /* ⚠️ وحارسٌ ثانٍ خلف إخفاء الزرّ: الفعلُ نفسُه يرفض ما لا يُحرَّر. */
    if (!row.editable) return true;
    state.mode = 'edit';
    state.draft = {
      title: row.title,
      body: row.body,
      purpose: row.purpose || '',
      category: row.category || NO_CATEGORY,
      tags: (row.tags || []).join('، '),
    };
    setSave(SAVE.CLEAN);
    paint('viewer');
    $('[data-pl-body]')?.focus();
    return true;
  }

  if (action === 'pl-cancel') { if (await leaveEditor()) paint('viewer'); return true; }

  if (action === 'pl-save') {
    captureDraft();
    const row = selected();
    if (!row || !state.draft) return true;
    setSave(SAVE.SAVING);
    try {
      /*
       * ⚠️ **وتعليماتُك تُكتَب في الإعدادات لا في `promptVersions`**
       *    (قيد المالك ٣ · بندا ٧ و٣٤): نسخُها إلى مخزن البرومبتات
       *    يصنع نسختين قابلتين للتحرير لنصٍّ واحد — وتُلحَق إحداهما
       *    بالطلب والأخرى تُعرَض لك. فالكتابةُ تمرّ بخدمتها وحدَها.
       */
      if (row.sourceKind === SOURCE.EXTRA) {
        await setExtraInstructions(row.sourceId, state.draft.body);
        extras = await extraInstructions();
        await reload();
        state.mode = 'read';
        state.draft = null;
        state.save = SAVE.SAVED;
        paint('all');
        return true;
      }
      await updatePrompt(row.sourceId, {
        title: state.draft.title,
        body: state.draft.body,
        purpose: state.draft.purpose,
        category: state.draft.category,
        tags: state.draft.tags.split(/[,،]/),
      });
      await reload();
      state.mode = 'read';
      state.draft = null;
      state.save = SAVE.SAVED;
      paint('all');
      return true;
    } catch (error) {
      /*
       * ⚠️ **ولا يُغادَر وضعُ التحرير عند الفشل** (بند ٢٩): ما كتبتَه
       *    يبقى في الحقل، والسببُ مكتوبٌ، والزرُّ يعيد المحاولة. وخروجٌ
       *    هنا يعني ضياعَ برومبتٍ طويلٍ بلا نسخةٍ في أيّ مكان.
       */
      setSave(SAVE.FAILED, error?.message || 'سبب مش معروف');
      paint('viewer');
      return true;
    }
  }

  /* ---------- المتغيّرات ---------- */
  if (action === 'pl-preview') {
    state.preview = !state.preview;
    paint('viewer');
    return true;
  }

  if (action === 'pl-clear-vars') {
    state.values = {};
    state.preview = false;
    paint('viewer');
    return true;
  }

  if (action === 'pl-outline') { state.outlineOpen = !state.outlineOpen; paint('viewer'); return true; }

  if (action === 'pl-jump') {
    const block = $(`[data-pl-block]`);
    const doc = $('[data-pl-doc]');
    if (!doc || !block) return true;
    /* موضعُ السطر داخل الكتل — يُحسَب من نصّها لا من رقمٍ مخزَّن. */
    const row = selected();
    const target2 = jumpTarget(row?.body || '', Number(id));
    const el = $(`[data-pl-block="${target2}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return true;
  }

  /* ---------- الإنشاء و`⋯` ---------- */
  if (action === 'pl-new') { await newPrompt(); return true; }
  if (action === 'pl-menu') { await promptMenu(id); return true; }
  if (action === 'pl-cat-menu') { await categoryMenu(id); return true; }

  /* ---------- طلباتُ التحليل المبنيّة — المسارُ القديم كما هو ---------- */
  return builtinAction(action, id);
}

/** رقمُ الكتلة التي يقع فيها سطرٌ ما. */
function jumpTarget(text, line) {
  const blocks = String(text || '').split(/\n{2,}/);
  let seen = 0;
  for (let i = 0; i < blocks.length; i += 1) {
    const lines = blocks[i].split('\n').length;
    if (line < seen + lines) return i;
    /* +1 للسطر الفارغ الفاصل بين الكتل. */
    seen += lines + 1;
  }
  return blocks.length - 1;
}

/**
 * أثرُ النسخ — **هادئٌ لأنّ النسخَ يتكرّر** (بند ٦٠).
 *
 * ⚠️ ورسالةٌ عائمةٌ كبيرةٌ عند كلّ نسخةٍ تصير ضجيجًا بعد ثالث مرّة.
 *    فالتغذيةُ الراجعةُ على الزرّ نفسِه، ومعلَنةٌ لقارئ الشاشة.
 */
function flashCopied(button) {
  const btn = button?.closest('[data-action^="pl-copy"]');
  if (!btn) { toastOk('اتنسخ'); return; }
  const was = btn.innerHTML;
  btn.classList.add('is-done');
  btn.innerHTML = '✓ اتنسخ';
  btn.setAttribute('aria-live', 'polite');
  setTimeout(() => {
    btn.classList.remove('is-done');
    btn.innerHTML = was;
  }, 1400);
}

/* ------------------------------------------------------------------ *
 * النوافذ
 * ------------------------------------------------------------------ */

async function newPrompt() {
  if (!(await leaveEditor())) return;
  let made = null;

  await showModal({
    title: 'برومبت جديد',
    wide: true,
    submitLabel: 'احفظ',
    body: html`
      <!--
        ⚠️ **الترتيبُ البصريُّ هو ترتيبُ الفعل** (بندا ٢٤ و٦٦): تفتح هذه
           النافذةَ لتلصق برومبتًا كتبتَه في ChatGPT — فالاسمُ والمتنُ
           أوّلًا، والتنظيمُ خلف طيّةٍ لا يعترض طريقك.
      -->
      <label class="pl-fld"><span>الاسم</span>
        <input class="ws-input" data-new-title dir="auto" placeholder="مثال: Core Chunks"></label>
      <label class="pl-fld pl-fld-grow"><span>البرومبت</span>
        <!--
          ⚠️ **واللصقُ الكبيرُ يدخل كما هو** (بند ٢٩): بلا تطبيعٍ ولا
             حذفِ أسطرٍ فارغةٍ ولا إصلاحِ مسافات. ما تلصقه من ChatGPT
             هو ما يُحفَظ، وهو ما سيخرج من الحافظة.
        -->
        <textarea class="ws-area pl-area" data-new-body dir="auto" spellcheck="false"
                  placeholder="الصق البرومبت هنا…"></textarea></label>
      <details class="pl-meta">
        <summary>التنظيم — اختياري</summary>
        <label class="pl-fld"><span>الغرض</span>
          <input class="ws-input" data-new-purpose dir="auto"></label>
        <div class="pl-fld-row">
          <label class="pl-fld"><span>التصنيف</span>
            <input class="ws-input" data-new-category dir="auto" list="pl-cats-new"></label>
          <label class="pl-fld"><span>وسوم — بفاصلة</span>
            <input class="ws-input" data-new-tags dir="auto"></label>
        </div>
        <datalist id="pl-cats-new">
          ${raw(categoriesOf(rows).map((one) => html`<option value="${one.name}"></option>`).join(''))}
        </datalist>
      </details>`,
    onSubmit: async (data, close) => {
      const read = (sel) => document.querySelector(sel)?.value ?? '';
      const title = read('[data-new-title]');
      const body = read('[data-new-body]');
      if (!title.trim()) return toastError('اكتب اسم للبرومبت');
      if (!body.trim()) return toastError('الصق البرومبت الأول');
      try {
        made = await createPrompt({
          title,
          body,
          purpose: read('[data-new-purpose]'),
          category: read('[data-new-category]'),
          tags: read('[data-new-tags]').split(/[,،]/),
        });
        close();
      } catch (error) {
        /* ⚠️ ولا تُغلَق النافذةُ عند الفشل — ما كتبتَه باقٍ (بند ١٥). */
        toastError(error.message);
      }
      return undefined;
    },
  });

  if (!made) return;
  await reload();
  /*
   * ⚠️ **هُويّةُ الفهرس لا معرّفُ الصفّ** (بند ٦١): كتابةُ `made.id` هنا
   *    تترك `state.sel` بقيمةٍ لا يطابقها عنصرٌ واحدٌ في الفهرس — فيُحفَظ
   *    البرومبتُ ويبقى العارضُ فارغًا. **ولا رسالةَ خطأ**: كلُّ سطرٍ نجح،
   *    والمقارنةُ وحدَها كذبت. أمسكه اختبارُ الشاشة لا قراءةُ الكود.
   */
  state.sel = catalogKey(SOURCE.PERSONAL, made.id);
  state.view = VIEW.ALL;
  state.category = '';
  state.tag = '';
  state.query = '';
  state.values = {};
  state.preview = false;
  state.listOpen = false;
  paint('all');
  toastOk('اتحفظ');
}

async function promptMenu(id) {
  const row = rows.find((one) => one.id === id);
  if (!row) return;

  const pick = await showModal({
    title: row.title,
    submitLabel: 'اقفل',
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <div class="ws-menu">
        <button type="button" data-m="rename">إعادة تسمية</button>
        <button type="button" data-m="duplicate">تكرار</button>
        <button type="button" data-m="move">نقل لتصنيف تاني</button>
        <button type="button" data-m="export">تصدير كملف نصّي</button>
        <button type="button" class="danger" data-m="trash">احذف</button>
      </div>`,
    onMount(root) {
      root.addEventListener('click', (event) => {
        const m = event.target.closest('[data-m]')?.dataset.m;
        if (m) root.closest('.overlay')?.__close?.(m);
      });
    },
  });
  if (!pick) return;

  if (pick === 'rename') {
    const value = await showModal({
      title: 'إعادة تسمية',
      submitLabel: 'احفظ',
      body: html`<label class="pl-fld"><span>الاسم</span>
        <input class="ws-input" name="title" dir="auto" value="${row.title}"></label>`,
      onSubmit: (data, close) => { close(data.title); },
    });
    if (!value?.trim()) return;
    /* ⚠️ تعديلُ حقلٍ بنفس المعرّف — لا إنشاءُ صفٍّ جديد (بند ١٧). */
    try { await updatePrompt(id, { title: value }); } catch (error) { return toastError(error.message); }
  }

  if (pick === 'duplicate') {
    try {
      const copy = await duplicatePrompt(id);
      await reload();
      state.sel = catalogKey(SOURCE.PERSONAL, copy.id);
      paint('all');
      return toastOk('اتعمل نسخة');
    } catch (error) { return toastError(error.message); }
  }

  if (pick === 'move') {
    const value = await showModal({
      title: 'نقل لتصنيف',
      submitLabel: 'انقل',
      body: html`<label class="pl-fld"><span>التصنيف</span>
        <input class="ws-input" name="cat" dir="auto" list="pl-cats-move"
               value="${row.category || ''}"></label>
        <datalist id="pl-cats-move">
          ${raw(categoriesOf(rows).map((one) => html`<option value="${one.name}"></option>`).join(''))}
        </datalist>`,
      onSubmit: (data, close) => { close(data.cat ?? ''); },
    });
    if (value === undefined || value === null) return;
    try { await updatePrompt(id, { category: value }); } catch (error) { return toastError(error.message); }
  }

  if (pick === 'export') {
    /* ⚠️ الملفُّ متنُ البرومبت كما هو — بلا ترويسةٍ تُضاف إليه (بند ٦٤). */
    downloadBlob(new Blob([row.body], { type: 'text/plain;charset=utf-8' }),
      `${row.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || 'برومبت'}.txt`);
    return undefined;
  }

  if (pick === 'trash') {
    const go = await confirmAction({
      title: 'احذف البرومبت',
      message: `«${esc(row.title)}» هيروح السلّة وتقدر ترجّعه منها.`,
      confirmLabel: 'احذف',
      danger: true,
    });
    if (!go) return;
    try { await trashPrompt(id); } catch (error) { return toastError(error.message); }
    if (state.sel === catalogKey(SOURCE.PERSONAL, id)) {
      state.sel = null; state.mode = 'read'; state.draft = null;
    }
    toastOk('راح السلّة');
  }

  await reload();
  paint('all');
  return undefined;
}

async function categoryMenu(name) {
  const pick = await showModal({
    title: name,
    submitLabel: 'اقفل',
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <div class="ws-menu">
        <button type="button" data-m="rename">إعادة تسمية التصنيف</button>
        <button type="button" data-m="empty">فضّي التصنيف (البرومبتات تفضل)</button>
      </div>`,
    onMount(root) {
      root.addEventListener('click', (event) => {
        const m = event.target.closest('[data-m]')?.dataset.m;
        if (m) root.closest('.overlay')?.__close?.(m);
      });
    },
  });
  if (!pick) return;

  if (pick === 'rename') {
    const value = await showModal({
      title: 'إعادة تسمية التصنيف',
      submitLabel: 'احفظ',
      body: html`<label class="pl-fld"><span>الاسم</span>
        <input class="ws-input" name="cat" dir="auto" value="${name}"></label>`,
      onSubmit: (data, close) => { close(data.cat); },
    });
    if (!value?.trim()) return;
    try { await renameCategory(name, value); } catch (error) { return toastError(error.message); }
  }

  if (pick === 'empty') {
    /*
     * ⚠️ **ولا يُحذَف برومبتٌ مع تصنيفه أبدًا** (بند ١٠): «احذف
     *    التصنيف» تبدو ترتيبًا وقد تمحو عشرين برومبتًا كتبتَها. فالفعلُ
     *    نقلٌ إلى «بدون تصنيف»، والتصنيفُ يختفي لأنّه خلا.
     */
    const count = rows.filter((row) => (row.category || NO_CATEGORY) === name).length;
    const go = await confirmAction({
      title: 'فضّي التصنيف',
      message: `${count} برومبت هينتقلوا لـ «${NO_CATEGORY}». مفيش حاجة هتتحذف.`,
      confirmLabel: 'انقلهم',
    });
    if (!go) return;
    try { await clearCategory(name); } catch (error) { return toastError(error.message); }
  }

  if (state.category === name) state.category = '';
  await reload();
  paint('all');
  return undefined;
}

/* ------------------------------------------------------------------ *
 * طلباتُ التحليل — **الأفعالُ كما كانت حرفًا بحرف**
 * ------------------------------------------------------------------ */

/** يقرأ ما في الخانات قبل أي إعادة رسم — وإلا ضاع ما كتبتَه. */
function capture() {
  const material = $('[data-pr-material]');
  if (material) state.material = material.value;
  const hint = $('[data-pr-hint]');
  if (hint) state.hint = hint.value;
  const date = $('[data-pr-date]');
  if (date) state.date = date.value;
  const scene = $('[data-pr-scene]');
  if (scene) state.sceneId = scene.value;
}

async function confirmExport(request) {
  const sum = requestSummary(request);
  const bits = [
    sum.rawChars ? `${sum.rawChars} حرف مادّة خام` : '',
    sum.scripts ? `${sum.scripts} سكريبت` : '',
    sum.conversation ? `${sum.conversation} جزء محادثة` : '',
    sum.speakers.length ? `أسماء: ${sum.speakers.join('، ')}` : '',
    sum.hasNotes ? 'ملاحظاتك' : '',
    sum.expressions ? `${sum.expressions} تعبير عندك` : '',
    sum.mistakes ? `${sum.mistakes} تصحيح` : '',
  ].filter(Boolean);

  return confirmAction({
    title: 'الملف ده هيطلع من جهازك',
    message: `«${esc(sum.title)}» — ${esc(bits.join(' · ') || 'تعليمات بس')}`,
    confirmLabel: 'نزّل الملف',
  });
}

async function builtinAction(action, id) {
  if (action === 'prompt-extra') {
    const prompt = promptById(id);
    if (!prompt) return true;
    const current = (await extraInstructions())[id] || '';
    const value = await showModal({
      title: `تعليماتك في «${prompt.label}»`,
      wide: true,
      submitLabel: 'احفظ',
      body: html`
        <p class="pl-hint">بتتضاف بعد قواعد العقد — ومش بتقدر تلغي حاجة منها.</p>
        <textarea class="ws-area" name="extra" dir="auto" rows="6">${current}</textarea>`,
      onSubmit: (data, close) => { close(data.extra ?? ''); },
    });
    if (value === undefined || value === null) return true;
    try {
      await setExtraInstructions(id, value);
      extras = await extraInstructions();
      paint('viewer');
      toastOk('اتحفظت');
    } catch (error) { toastError(error.message); }
    return true;
  }

  if (action === 'prompt-peek') {
    try {
      const lines = await previewInstructions(id);
      const text = lines.join('\n');
      await showModal({
        title: 'التعليمات كلها',
        wide: true,
        submitLabel: 'اقفل',
        actions: [
          { label: 'انسخها', value: 'copy' },
          { label: 'اقفل', value: null, variant: 'ghost' },
        ],
        body: html`<pre class="pl-block" dir="ltr">${text}</pre>`,
      }).then((pick) => { if (pick === 'copy') copyToClipboard(text); });
    } catch (error) { toastError(error.message); }
    return true;
  }

  if (action === 'prompt-build') {
    capture();
    const prompt = promptById(id);
    if (!prompt) return true;
    try {
      const request = await buildPrompt(id, {
        sceneId: state.sceneId,
        material: state.material,
        hint: state.hint,
        date: state.date,
      });
      if (!(await confirmExport(request))) return true;
      downloadBlob(
        new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' }),
        requestFilename(request),
      );
      toastOk('الملف نزل — ودّيه للمحلِّل وارجع بردّه في الاستيراد');
    } catch (error) { toastError(error.message); }
    return true;
  }

  return false;
}

/* ما يُصدَّر للاختبار وحدَه. */
export const __pl = {
  state: () => state,
  rows: () => rows,
  visibleRows,
  setState: (patch) => { state = { ...state, ...patch }; },
};

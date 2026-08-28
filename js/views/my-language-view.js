/**
 * LingoLife — «لغتي»: نظرةٌ · استكشافٌ · قصّةُ حياة (WS-K)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ثلاثةُ مستوياتٍ متّصلة — والمستخدمُ يعرف دائمًا أين هو**
 * ═══════════════════════════════════════════════════════════════
 *
 *   نظرة    ← «إيه اللي عندي؟»        مقاييسُ ومصادرُ وحالةُ تحليل
 *   استكشاف ← «وريني اللي زيّ كده»    مصافٍ وأعمدةٌ وترتيب
 *   قصّة     ← «الكلمة دي حصلها إيه؟»  دليلٌ وتاريخٌ وعلاقات
 *
 * وهي **شاشةٌ واحدةٌ بثلاثة أوضاع** لا ثلاثُ شاشات: الانتقالُ بينها لا
 * يفقد تصفيةً ولا ترتيبًا ولا موضعَ تمرير. ولذلك القصّةُ **لوحةٌ
 * جانبيّة** لا مسارٌ منفصل — راجع تعليق `openStory`.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا رقمَ في هذه الشاشة مكتوبٌ بيد**
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ عددٍ وكلُّ شريحةِ رسمٍ تُحسَب من `buildLanguageIndex` فوق ما في
 * قاعدتك. وحين لا تكفي البيانات تُعرَض **حالةُ فراغٍ تقول لماذا** —
 * لا شريحةٌ مخترَعةٌ ولا نسبةٌ من عندنا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والمولَّدُ مفصولٌ بصريًّا وإحصائيًّا في كلّ موضع**
 * ═══════════════════════════════════════════════════════════════
 *
 * في الصفّ: رقمان. وفي القصّة: قسمان بحدَّين مختلفَي اللون والشكل.
 * وفي حقيقة المصادر: كتلتان لا واحدة.
 */

import { html, raw, $ } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { navigate } from '../router.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { withProgress } from '../components/progress.js';
import { formatDate } from '../utils/dates.js';
import {
  buildLanguageIndex, queryLanguage, relationsOf, evidenceOf,
  topPresent, learnerCurated, recentDiscoveries, posDistribution,
  PROVENANCE, PROVENANCE_LABEL, LEARNING_LABEL, SIGNAL, SIGNAL_LABEL,
  SORT, SORT_LABEL, ITEM_TYPE, ITEM_TYPE_LABEL, FACETS, VERIFY,
} from '../services/memory/my-language.js';
import { VERIFY_LABEL } from '../services/memory/counting.js';
import {
  cachedLanguage, cacheLanguage, invalidateLanguage,
} from '../services/memory/language-cache.js';
import { incrementalStatus } from '../services/memory/analysis-state.js';
import {
  itemStory, EVENT, EVENT_LABEL, MISTAKE_KIND_LABEL, MISTAKE_KIND,
} from '../services/memory/item-story.js';

/**
 * الفهرسُ محفوظٌ في ورقةٍ مشتركة — راجع ترويسة `language-cache.js`.
 */
export const invalidateLanguageIndex = invalidateLanguage;

/* ------------------------------------------------------------------ *
 * الحالة
 * ------------------------------------------------------------------ */

const EMPTY_QUERY = () => ({
  type: [], pos: [], register: [], domain: [],
  provenance: [], learning: [], signal: [], verify: [], tag: [],
  family: null, search: '', sort: SORT.SITUATIONS,
});

const state = {
  query: EMPTY_QUERY(),
  /** التبويبُ الأعلى: نوعُ المحتوى — لا وجهٌ من الأوجه. */
  tab: 'all',
  /** أوّلُ صفٍّ مرسومٍ في النافذة المنزلقة. */
  top: 0,
  openFacet: 'pos',
  /** مفتاحُ العنصر المفتوحةِ قصّتُه — أو `null`. */
  story: null,
  /** يُستعاد بعد إغلاق اللوحة. */
  scroll: 0,
  facetsOpen: false,
  presentBy: 'situations',
  /** ما يُعرَض في اللوحة الجانبيّة بعد «افتح المصدر». */
  context: null,
};

/** ارتفاعُ الصفّ بالبكسل — نفسُ ما في CSS، ويُذكَر هنا صراحةً. */
const ROW_H = 60;
const OVERSCAN = 8;

/**
 * تبويباتُ المحتوى — **أنواعٌ لا أوجه** (بند ١٠).
 *
 * ⚠️ **و«عامي» و«فعل» ليست تبويباتٍ عليا.** جعلُها كذلك يمنع «فعل
 *    عامّيّ» أصلًا، لأن التبويبَ الأعلى واحدٌ لا يُجمَع. فهي أوجهٌ
 *    تتركّب، والتبويبُ نوعُ الشيء نفسِه.
 */
const TABS = [
  { id: 'all', label: 'الكل' },
  { id: ITEM_TYPE.WORD, label: 'كلمات' },
  { id: ITEM_TYPE.EXPRESSION, label: 'تعبيرات' },
  { id: ITEM_TYPE.SENTENCE, label: 'جمل' },
  { id: ITEM_TYPE.PATTERN, label: 'تراكيب' },
  { id: 'mine', label: 'أنا علّمت عليهم' },
];

/**
 * مصافٍ سريعة — **ولا تظهر إلّا إن كان لها ما تصفّيه** (بند ١٢).
 *
 * ⚠️ **ومرشِّحُ التاريخ من طوابعَ حقيقيّةٍ وحدَها.** «آخر ٣٠ يوم»
 *    على عناصرَ بلا طابعٍ يعني إمّا إخفاءَ كلِّ شيءٍ أو إظهارَه كلِّه —
 *    وكلاهما كذبةٌ صامتة. فالعنصرُ بلا طابعٍ لا يدخل ولا يُدَّعى أنه
 *    خارجُ المدّة.
 */
const QUICK = [
  {
    id: 'review', label: 'محتاجة مراجعة',
    has: (i) => i.totals.needsReview > 0,
    apply: (q) => { q.verify = [VERIFY.REVIEW]; },
  },
  {
    id: 'real', label: 'من مواقف حقيقية',
    has: (i) => i.totals.withPrimary > 0,
    apply: (q) => { q.provenance = [PROVENANCE.PRIMARY]; },
  },
  {
    id: 'shadow', label: 'من الشادوينج',
    has: (i) => i.items.some((one) => one.shadowed > 0),
    apply: (q) => { q.signal = [SIGNAL.SHADOWED]; },
  },
  {
    id: 'errors', label: 'عندي غلط فيها',
    has: (i) => i.items.some((one) => one.errors > 0),
    apply: (q) => { q.signal = [SIGNAL.ERROR]; },
  },
  {
    id: 'saved', label: 'اللي حفظتها',
    has: (i) => i.items.some((one) => one.saved > 0),
    apply: (q) => { q.signal = [SIGNAL.SAVED]; },
  },
  {
    id: 'unknown', label: 'مصدرها مش محدَّد',
    has: (i) => i.totals.unknownOnly > 0,
    apply: (q) => { q.provenance = [PROVENANCE.UNKNOWN_ONLY]; },
  },
  {
    id: 'recent', label: 'آخر ٣٠ يوم',
    has: (i) => i.items.some((one) => Number.isFinite(one.analyzedAt || one.savedAt)),
    apply: (q) => { q.sort = SORT.RECENT; q.recentDays = 30; },
  },
];

async function index() {
  const ready = cachedLanguage();
  if (ready) return ready;
  const built = await withProgress({
    key: 'my-language-index',
    title: 'بيجمّع لغتك',
    stages: ['بيقرا التحليل', 'بيوحّد العناصر', 'بيعدّ الأدلّة', 'بيقرا محفوظاتك وتدريبك'],
  }, async (bar) => {
    const STEP = { read: 0, items: 1, evidence: 2, learner: 3, done: 3 };
    const result = await buildLanguageIndex({
      onProgress: (p) => {
        bar.stage(STEP[p.stage] ?? 0, p.label);
        if (p.total > 1) bar.set({ done: p.done, total: p.total });
      },
    });
    bar.done(`${result.totals.all} عنصر في ${result.ms} م.ث`);
    return result;
  });
  if (built?.skipped) return null;
  return cacheLanguage(built);
}

/** الاستعلامُ الفعليّ = الأوجهُ + التبويبُ + مدّةُ المرشِّح السريع. */
function effectiveQuery() {
  const q = { ...state.query };
  if (state.tab === 'mine') q.signal = [...new Set([...(q.signal || []), SIGNAL.SAVED])];
  else if (state.tab !== 'all') q.type = [state.tab];
  return q;
}

function rowsFor(built) {
  let rows = queryLanguage(built, effectiveQuery());
  if (state.tab === 'mine') {
    /* «علّمت عليهم» أوسعُ من «حفظت»: تدريبٌ وغلطاتٌ وشادوينج كذلك. */
    rows = queryLanguage(built, { ...state.query, type: [] })
      .filter((one) => one.hasLearner);
  }
  if (state.query.recentDays) {
    const since = Date.now() - state.query.recentDays * 86400000;
    rows = rows.filter((one) => {
      const at = one.savedAt || one.lastPractisedAt || one.analyzedAt;
      return Number.isFinite(at) && at >= since;
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * النظرةُ العامّة
 * ------------------------------------------------------------------ */

const nf = (n) => Number(n || 0).toLocaleString('en');

function metricsHtml(totals) {
  const tile = (id, label, value, note = '') => html`
    <button class="ml-tile" data-action="ml-total" data-total="${id}">
      <b>${nf(value)}</b>
      <span>${label}</span>
      ${raw(note ? html`<i>${note}</i>` : '')}
    </button>`;

  return html`
    <div class="ml-tiles">
      ${raw(tile('words', 'الكلمات', totals.words, 'مفردات مختلفة'))}
      ${raw(tile('expressions', 'التعبيرات', totals.expressions))}
      ${raw(tile('sentences', 'الجمل', totals.sentences))}
      ${raw(tile('patterns', 'التراكيب', totals.patterns))}
      ${raw(tile('families', 'عائلات الكلمات', totals.families))}
      ${raw(tile('forms', 'الصيغ اللي ظهرت', totals.observedForms, 'مش بتتجمع مع الكلمات'))}
    </div>`;
}

/**
 * حقيقةُ المصادر (بند ٨) — **كتلتان ونصفٌ لا صفٌّ واحد**.
 *
 * ⚠️ **و«غير مصنَّف» لا يلبس ثوبَ الأصليّ.** يُعرَض بلونٍ ثالثٍ ومعه
 *    البابُ الذي يحلّه، لا مطويًّا تحت «مصادر».
 */
function sourceTruthHtml(truth) {
  return html`
    <div class="ml-truth">
      <div class="ml-truth-card is-primary">
        <h4>${raw(icon('clock', 15))} من حياتي الحقيقية</h4>
        <div class="ml-truth-nums">
          <span><b>${nf(truth.primary.sources)}</b> مصدر</span>
          <span><b>${nf(truth.primary.realSituations)}</b> موقف حقيقي</span>
          <span><b>${nf(truth.primary.rawOccurrences)}</b> مرة ظهور</span>
        </div>
        <button type="button" class="ml-truth-go" data-action="ml-total" data-total="primary">
          وريني اللي منها
        </button>
      </div>

      <div class="ml-truth-card is-derived">
        <h4>مواد تعليمية مولَّدة</h4>
        <div class="ml-truth-nums">
          <span><b>${nf(truth.derived.sources)}</b> مصدر</span>
          <span><b>${nf(truth.derived.derivedAppearances)}</b> مرة ظهور</span>
        </div>
        <p class="ml-tiny">مش بتتحسب مواقف حقيقية.</p>
        <button type="button" class="ml-truth-go" data-action="ml-total" data-total="derived">
          وريني اللي منها
        </button>
      </div>

      ${raw(truth.unknown.sources ? html`
      <div class="ml-truth-card is-unknown">
        <h4>مصادر لسه غير مصنَّفة</h4>
        <div class="ml-truth-nums">
          <span><b>${nf(truth.unknown.sources)}</b> مصدر</span>
          <span><b>${nf(truth.unknown.unknownOccurrences)}</b> مرة ظهور</span>
        </div>
        <!--
          ⚠️ **والنقصُ يُقال ويُفتَح بابُه.** «غير مصنَّف» ليس عطبًا
             نخفيه: هو رقمٌ ناقصٌ في «المواقف الحقيقية»، وحلُّه ضغطةٌ
             واحدةٌ إلى نفس الشاشة التي تصنّف فيها.
        -->
        <p class="ml-tiny">دي مش داخلة في المواقف الحقيقية لحد ما تصنّفها.</p>
        <button type="button" class="ml-truth-go is-cta" data-action="mem-review">
          صنّف المصادر القديمة
        </button>
      </div>` : '')}
    </div>`;
}

/**
 * رسمُ توزيع المصادر — **من صفوفٍ حقيقيّةٍ وإلّا فلا رسم** (بند ٩).
 *
 * ⚠️ ودائرةٌ بشريحةٍ واحدةٍ بنسبة ١٠٠٪ لا تجيب سؤالًا، فلا تُرسَم.
 */
function donutHtml(truth) {
  const parts = [
    { id: 'primary', label: 'أصلي', value: truth.primary.sources, color: '#1F9D62' },
    { id: 'derived', label: 'مولَّد', value: truth.derived.sources, color: '#8B7FD4' },
    { id: 'unknownsrc', label: 'غير مصنَّف', value: truth.unknown.sources, color: '#C9A227' },
  ].filter((one) => one.value > 0);

  const total = parts.reduce((sum, one) => sum + one.value, 0);
  if (parts.length < 2 || !total) return '';

  const R = 42;
  const C = 2 * Math.PI * R;
  let at = 0;
  const rings = parts.map((one) => {
    const len = (one.value / total) * C;
    const seg = html`
      <circle class="ml-arc" data-action="ml-total" data-total="${one.id}"
              cx="60" cy="60" r="${R}" fill="none" stroke="${one.color}"
              stroke-width="16" stroke-dasharray="${len} ${C - len}"
              stroke-dashoffset="${-at}" transform="rotate(-90 60 60)">
        <title>${one.label}: ${one.value}</title>
      </circle>`;
    at += len;
    return seg;
  }).join('');

  return html`
    <div class="ml-panel ml-donut">
      <h4>مصادري</h4>
      <div class="ml-donut-body">
        <svg viewBox="0 0 120 120" width="120" height="120" role="img"
             aria-label="توزيع ${total} مصدر: ${parts.map((o) => `${o.label} ${o.value}`).join('، ')}">
          ${raw(rings)}
          <text x="60" y="57" text-anchor="middle" class="ml-donut-n">${total}</text>
          <text x="60" y="72" text-anchor="middle" class="ml-donut-t">مصدر</text>
        </svg>
        <!--
          ⚠️ **ورسمٌ بلا مكافئٍ نصّيٍّ لا يُقرأ** (بند ٤٧): الأسطورةُ
             نفسُها هي المكافئ — نصٌّ وأرقامٌ ونِسَب، لا ألوانٌ فقط.
        -->
        <ul class="ml-legend">
          ${raw(parts.map((one) => html`
            <li>
              <button type="button" data-action="ml-total" data-total="${one.id}">
                <i style="background:${one.color}"></i>
                ${one.label}
                <b>${one.value}</b>
                <span>${Math.round((one.value / total) * 100)}%</span>
              </button>
            </li>`).join(''))}
        </ul>
      </div>
    </div>`;
}

/** بطاقةُ حالة التحليل (بند ١٨) — ومعها التغطيةُ بصيغتها (بند ٢١). */
function analysisCardHtml(coverage, inc) {
  return html`
    <div class="ml-panel ml-analysis">
      <h4>تحليل لغتي</h4>

      ${raw(coverage.percent === null ? html`
        <p class="ml-tiny">مفيش مصادر متاحة للتحليل لسه.</p>` : html`
        <div class="ml-cov" role="img"
             aria-label="تغطية التحليل ${coverage.percent} بالمئة">
          <div class="ml-cov-bar"><i style="inline-size:${coverage.percent}%"></i></div>
          <b>${coverage.percent}%</b>
        </div>
        <!--
          ⚠️ **ونسبةٌ بلا صيغةٍ ممنوعة** (بند ٢١): «٨٤٪» وحدَها لا
             تُراجَع ولا تُصدَّق. فالصيغةُ مكتوبةٌ تحتها لا في تلميحٍ
             يختفي على اللمس.
        -->
        <p class="ml-tiny">
          ${coverage.covered} من ${coverage.eligible} مصدر تحليلها حالي.
          <br>الحساب: ${coverage.formula}.
        </p>`)}

      <ul class="ml-facts">
        <li><b>${nf(coverage.never)}</b> نص جديد ما اتحللش</li>
        <li><b>${nf(coverage.changed)}</b> نص اتعدّل بعد تحليله</li>
        <li><b>${nf(inc.excluded)}</b> نص مستبعَد بإرادتك</li>
        <li><b>${nf(inc.knownItems)}</b> عنصر التحليل عارفهم</li>
      </ul>

      <button type="button" class="btn btn-primary ml-wide" data-action="mem-review">
        حدّث تحليل لغتي
      </button>
      <p class="ml-tiny">
        ${raw(inc.firstRun
    ? 'أول جولة: النصوص اللي تختارها هتتبعت كاملة.'
    : 'جولة تكميلية: اللي اتحلّل مش هيتبعت تاني.')}
      </p>
    </div>`;
}

/** الأكثرُ حضورًا — بمقياسين صريحين (بند ١٥). */
function presentHtml(built) {
  const by = state.presentBy;
  const top = topPresent(built, { by, limit: 5 });

  return html`
    <div class="ml-panel">
      <h4>الأكثر حضورًا في لغتي</h4>
      <div class="ml-seg">
        <button type="button" data-action="ml-present" data-by="situations"
                class="${by === 'situations' ? 'on' : ''}">حسب المواقف الحقيقية</button>
        <button type="button" data-action="ml-present" data-by="occurrences"
                class="${by === 'occurrences' ? 'on' : ''}">حسب مرات الظهور</button>
      </div>
      <!--
        ⚠️ **والفرقُ بين المقياسين ليس تفصيلًا**: كلمةٌ في نصٍّ واحدٍ
           عشرين مرّةً ليست ككلمةٍ في عشرة مواقفَ مختلفة. فالتبديلُ
           صريحٌ، ولا يُدمَجان في ترتيبٍ واحدٍ «ذكيّ».
      -->
      ${raw(top.length ? html`
      <ul class="ml-bars">
        ${raw(top.map((one) => {
    const max = top[0].score || 1;
    return html`
          <li>
            <button type="button" data-action="ml-open" data-key="${one.key}">
              <span dir="ltr" lang="ru">${one.lemma}</span>
              <i style="inline-size:${Math.round((one.score / max) * 100)}%"></i>
              <b>${one.score}</b>
            </button>
          </li>`;
  }).join(''))}
      </ul>` : '<p class="ml-tiny">لسه مفيش أدلّة كفاية للترتيب ده.</p>')}
    </div>`;
}

/** «أنا علّمت عليهم» موحَّدًا (بند ١٦). */
function minePanelHtml(mine) {
  if (!mine.total) {
    return html`
      <div class="ml-panel">
        <h4>أنا علّمت عليهم</h4>
        <p class="ml-tiny">
          لسه ما علّمتش على حاجة. احفظ كلمة أو مقطع من شاشة التدريب
          وهتلاقيها هنا.
        </p>
      </div>`;
  }
  return html`
    <div class="ml-panel">
      <h4>أنا علّمت عليهم</h4>
      <div class="ml-mine">
        <button type="button" data-action="ml-mine" data-type="all">
          <b>${nf(mine.total)}</b><span>الكل</span></button>
        <button type="button" data-action="ml-mine" data-type="${ITEM_TYPE.WORD}">
          <b>${nf(mine.words)}</b><span>كلمات</span></button>
        <button type="button" data-action="ml-mine" data-type="${ITEM_TYPE.EXPRESSION}">
          <b>${nf(mine.expressions)}</b><span>تعبيرات</span></button>
        <button type="button" data-action="ml-mine" data-type="${ITEM_TYPE.SENTENCE}">
          <b>${nf(mine.sentences)}</b><span>جمل</span></button>
      </div>
      <ul class="ml-facts">
        <li><b>${nf(mine.saved)}</b> حفظتها</li>
        <li><b>${nf(mine.practised)}</b> اتدرّبت عليها</li>
        <li><b>${nf(mine.shadowed)}</b> من الشادوينج</li>
        <li><b>${nf(mine.withErrors)}</b> فيها غلط مسجَّل</li>
      </ul>
      <p class="ml-tiny">
        ⚠️ دي ذاكرتك إنت — مش نتيجة تحليل، ومش بتزوّد المواقف الحقيقية.
      </p>
    </div>`;
}

/** اكتشافاتٌ حديثة — من طوابعَ حقيقيّةٍ وحدَها (بند ١٩). */
function discoveriesHtml(built) {
  const found = recentDiscoveries(built, { days: 30, limit: 6 });
  if (!found.length) return '';
  return html`
    <div class="ml-panel">
      <h4>اكتشفته مؤخرًا</h4>
      <p class="ml-tiny">عناصر دخلت لغتك في آخر ٣٠ يوم.</p>
      <div class="ml-chips">
        ${raw(found.map((one) => html`
          <button type="button" class="ml-tag" data-action="ml-open" data-key="${one.key}">
            <span dir="ltr" lang="ru">${one.lemma}</span>
            <i>${ITEM_TYPE_LABEL[one.itemType] || ''}</i>
          </button>`).join(''))}
      </div>
    </div>`;
}

/** توزيعُ الأقسام — أو حالةُ فراغٍ تقول لماذا (بند ٢٠). */
function posPanelHtml(built) {
  const rows = posDistribution(built).slice(0, 6);
  return html`
    <div class="ml-panel">
      <h4>أنواع الكلام</h4>
      ${raw(rows.length ? html`
      <ul class="ml-bars">
        ${raw(rows.map((one) => html`
          <li>
            <button type="button" data-action="ml-pick" data-facet="pos" data-value="${one.value}">
              <span>${one.value}</span>
              <i style="inline-size:${one.percent}%"></i>
              <b>${nf(one.count)}</b>
            </button>
          </li>`).join(''))}
      </ul>` : html`
      <p class="ml-tiny">
        التحليل ما حدّدش نوع الكلام للعناصر الحالية. هيظهر هنا أول ما
        جولة تحليل ترجّعه.
      </p>`)}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * المستكشف
 * ------------------------------------------------------------------ */

const LABEL_OF = {
  type: (v) => ITEM_TYPE_LABEL[v] || v,
  provenance: (v) => PROVENANCE_LABEL[v] || v,
  learning: (v) => LEARNING_LABEL[v] || v,
  signal: (v) => SIGNAL_LABEL[v] || v,
  verify: (v) => VERIFY_LABEL[v] || v,
};

const tagLabel = (built, id) => built.tagLabels?.[id] || id;

function facetsHtml(built) {
  const open = state.openFacet;
  const values = built.facets[open] || [];
  const picked = state.query[open] || [];
  const label = (v) => (open === 'tag' ? tagLabel(built, v)
    : (LABEL_OF[open] ? LABEL_OF[open](v) : v));

  return html`
    <div class="ml-facets ${state.facetsOpen ? 'is-open' : ''}">
      <div class="ml-facet-tabs">
        ${raw(FACETS.map((f) => {
    const n = (state.query[f.id] || []).length;
    return html`
          <button type="button" data-action="ml-facet" data-facet="${f.id}"
                  aria-expanded="${open === f.id}"
                  class="${open === f.id ? 'on' : ''}">
            ${f.label}${raw(n ? html` <i>${n}</i>` : '')}
          </button>`;
  }).join(''))}
      </div>
      <div class="ml-facet-values">
        ${raw(values.length ? values.map((one) => html`
          <button type="button" data-action="ml-pick" data-facet="${open}"
                  data-value="${one.value}"
                  aria-pressed="${picked.includes(one.value)}"
                  class="${picked.includes(one.value) ? 'on' : ''}">
            ${label(one.value)}<span class="ml-n">${nf(one.count)}</span>
          </button>`).join('')
    : '<p class="ml-tiny">مفيش قيم هنا لسه — التحليل ما ملاش الحقل ده.</p>')}
      </div>
    </div>`;
}

/** حالتي مع العنصر — كلمةٌ واحدةٌ في العمود الأخير. */
function myState(one) {
  if (one.errors) return { label: `${one.errors} غلط`, cls: 'is-bad' };
  if (one.practised) return { label: `تدريب ${one.practised}`, cls: 'is-ok' };
  if (one.saved) return { label: 'محفوظة', cls: 'is-ok' };
  return { label: '—', cls: 'is-dim' };
}

const lastSeen = (one) => one.savedAt || one.lastPractisedAt || one.analyzedAt || null;

/** صفٌّ واحد — أعمدةٌ مفيدة، والباقي في القصّة (بند ١٣). */
function rowHtml(one) {
  const mine = myState(one);
  const when = lastSeen(one);
  return html`
    <button class="ml-row ${state.story === one.key ? 'is-open' : ''}" role="listitem"
            data-action="ml-open" data-key="${one.key}" style="--y:${one.__y}px"
            aria-label="${one.lemma || one.key} — ${one.realSituations} موقف حقيقي، ${one.rawOccurrences} مرة ظهور">
      <span class="c-item">
        <span class="ml-lemma" dir="ltr" lang="ru">${one.lemma || one.key}</span>
        ${raw(one.meaningAr ? html`<span class="ml-mean">${one.meaningAr}</span>` : '')}
      </span>
      <span class="c-type"><span class="ml-tag">${ITEM_TYPE_LABEL[one.itemType] || one.itemType}</span></span>
      <span class="c-pos">${one.pos || '—'}</span>
      <span class="c-reg">${one.register || '—'}</span>
      <span class="c-dom">${one.domain || '—'}</span>
      <span class="c-real"><b class="${one.realSituations ? 'is-real' : 'is-dim'}">${one.realSituations}</b></span>
      <span class="c-occ">
        <b>${one.rawOccurrences}</b>
        ${raw(one.derivedAppearances ? html`<i class="is-derived">+${one.derivedAppearances}</i>` : '')}
      </span>
      <span class="c-when">${when ? formatDate(when) : '—'}</span>
      <span class="c-mine ${mine.cls}">${mine.label}</span>
    </button>`;
}

const HEAD = html`
  <div class="ml-head">
    <span class="c-item">العنصر</span>
    <span class="c-type">النوع</span>
    <span class="c-pos">القسم</span>
    <span class="c-reg">الأسلوب</span>
    <span class="c-dom">المجال</span>
    <span class="c-real">مواقف حقيقية</span>
    <span class="c-occ">مرات الظهور</span>
    <span class="c-when">آخر ظهور</span>
    <span class="c-mine">حالتي معاه</span>
  </div>`;

const visibleCount = () => Math.ceil((window.innerHeight * 0.55) / ROW_H) + 2;

function listHtml(rows) {
  const start = Math.max(0, state.top - OVERSCAN);
  const shown = rows.slice(start, start + visibleCount() + OVERSCAN * 2);
  shown.forEach((one, i) => { one.__y = (start + i) * ROW_H; });

  return html`
    ${raw(HEAD)}
    <div class="ml-list" data-ml-list role="list"
         aria-label="عناصر لغتي — ${nf(rows.length)} عنصر">
      <div class="ml-space" style="height:${rows.length * ROW_H}px">
        ${raw(shown.map(rowHtml).join(''))}
      </div>
    </div>
    <p class="ml-count" data-ml-count>${nf(rows.length)} عنصر</p>`;
}

/* ------------------------------------------------------------------ *
 * الشاشة
 * ------------------------------------------------------------------ */

export async function renderMyLanguage(main) {
  const built = await index();
  if (!built) { main.innerHTML = '<p class="field-hint">اتلغى.</p>'; return; }

  const inc = await incrementalStatus();
  const rows = rowsFor(built);
  const mine = learnerCurated(built);
  const active = [
    ...FACETS.flatMap((f) => (state.query[f.id] || []).map((v) => ({ facet: f.id, value: v }))),
    ...(state.query.recentDays ? [{ facet: 'recentDays', value: '٣٠ يوم' }] : []),
  ];

  /*
   * ⚠️ **وحالةُ الفراغ تقول ما الخطوةُ التالية** (بند ٤٨). شاشةٌ
   *    بأصفارٍ وستّةِ رسومٍ فارغةٍ تبدو معطوبةً؛ والصادقُ أن نقول:
   *    مفيش تحليل لسه، وده الباب.
   */
  if (!built.totals.all) {
    main.innerHTML = html`
      <section class="ml">
        <header class="ml-top">
          <div>
            <h2>${raw(icon('book', 20))} لغتي</h2>
            <p class="ml-sub">اللغة اللي اتكوّنت من مواقفك الحقيقية وتعلّمك.</p>
          </div>
        </header>
        <div class="ml-panel ml-blank">
          <h4>لسه فاضية</h4>
          <p class="ml-tiny">
            «لغتي» بتتكوّن من حاجتين: تحليل لنصوصك، وحاجات إنت
            بتعلّم عليها وإنت بتتدرّب. لسه ما حصلش ولا واحدة منهم.
          </p>
          <button type="button" class="btn btn-primary ml-wide" data-action="mem-review">
            ابدأ أول تحليل للغتك
          </button>
          <p class="ml-tiny">
            أو افتح أي نصّ في الشادوينج واحفظ كلمة — هتلاقيها هنا على طول.
          </p>
        </div>
      </section>`;
    return;
  }

  main.innerHTML = html`
    <section class="ml">
      <header class="ml-top">
        <div>
          <h2>${raw(icon('book', 20))} لغتي</h2>
          <p class="ml-sub">اللغة اللي اتكوّنت من مواقفك الحقيقية وتعلّمك.</p>
        </div>
        <div class="ml-top-acts">
          <input type="search" data-ml-search class="ml-q" dir="auto"
                 placeholder="ابحث في لغتك — كلمة · صيغة · معنى · مجال · علامة"
                 value="${state.query.search}">
          <button type="button" class="btn btn-ghost btn-sm" data-action="ml-rebuild">
            حدّث الأرقام
          </button>
        </div>
      </header>

      ${raw(metricsHtml(built.totals))}
      ${raw(sourceTruthHtml(built.sourceTruth))}

      <div class="ml-grid">
        ${raw(analysisCardHtml(built.coverage, inc))}
        ${raw(donutHtml(built.sourceTruth))}
        ${raw(presentHtml(built))}
        ${raw(minePanelHtml(mine))}
        ${raw(posPanelHtml(built))}
        ${raw(discoveriesHtml(built))}
      </div>

      <!-- ══ المستوى الثاني: الاستكشاف ══ -->
      <div class="ml-explore">
        <div class="ml-tabs" role="tablist" aria-label="نوع المحتوى">
          ${raw(TABS.map((t) => html`
            <button type="button" data-action="ml-tab" data-tab="${t.id}" role="tab"
                    aria-selected="${state.tab === t.id}"
                    class="${state.tab === t.id ? 'on' : ''}">${t.label}</button>`).join(''))}
        </div>

        <div class="ml-quick">
          ${raw(QUICK.filter((q) => q.has(built)).map((q) => html`
            <button type="button" data-action="ml-quick" data-quick="${q.id}">
              ${q.label}
            </button>`).join(''))}
          <select data-ml-sort class="ml-sort" aria-label="الترتيب">
            ${raw(Object.values(SORT).map((id) => html`
              <option value="${id}" ${state.query.sort === id ? 'selected' : ''}>
                ${SORT_LABEL[id]}</option>`).join(''))}
          </select>
          <button type="button" class="ml-more" data-action="ml-facets-toggle">
            ${state.facetsOpen ? 'أخفِ التصفية' : 'تصفية متقدّمة'}
          </button>
        </div>

        ${raw(state.facetsOpen ? facetsHtml(built) : '')}

        ${raw(active.length ? html`
        <div class="ml-active">
          ${raw(active.map((one) => html`
            <button type="button" class="ml-chip"
                    data-action="${one.facet === 'recentDays' ? 'ml-unrecent' : 'ml-pick'}"
                    data-facet="${one.facet}" data-value="${one.value}">
              ${one.facet === 'tag' ? tagLabel(built, one.value)
    : (LABEL_OF[one.facet] ? LABEL_OF[one.facet](one.value) : one.value)} ✕
            </button>`).join(''))}
          <button type="button" data-action="ml-clear" class="ml-chip is-clear">مسح الكل</button>
        </div>` : '')}

        ${raw(rows.length ? listHtml(rows) : html`
          <div class="ml-empty">
            <p class="field-hint">مفيش عناصر بالتصفية دي.</p>
            ${raw(active.length ? html`
              <button type="button" class="btn btn-ghost btn-sm" data-action="ml-clear">
                امسح التصفية
              </button>` : html`
              <p class="ml-tiny">
                التبويب ده لسه فاضي — جرّب «الكل» أو حدّث تحليل لغتك.
              </p>`)}
          </div>`)}
      </div>
    </section>

    <!-- ══ المستوى الثالث: قصّةُ الحياة — لوحةٌ لا مسارٌ ══ -->
    <div class="ml-panel-host" data-ml-story hidden></div>`;

  wireList(main, rows);
  if (state.story) await paintStory(main, built, state.story);
}

function wireList(main, rows) {
  const list = main.querySelector('[data-ml-list]');
  if (!list) return;
  const space = list.querySelector('.ml-space');

  const paint = () => {
    const start = Math.max(0, Math.floor(list.scrollTop / ROW_H) - OVERSCAN);
    if (start === state.top) return;
    state.top = start;
    const shown = rows.slice(start, start + visibleCount() + OVERSCAN * 2);
    shown.forEach((one, i) => { one.__y = (start + i) * ROW_H; });
    space.innerHTML = shown.map(rowHtml).join('');
  };

  list.addEventListener('scroll', () => {
    state.scroll = list.scrollTop;
    requestAnimationFrame(paint);
  }, { passive: true });

  /*
   * ⚠️ **وموضعُ التمرير يُستعاد** (بند ٢٢): تفتح قصّةً وتغلقها فتعود
   *    إلى نفس الصفّ لا إلى رأس عشرة آلاف.
   */
  list.scrollTop = state.scroll;
  state.top = Math.max(0, Math.floor(state.scroll / ROW_H) - OVERSCAN);
}

/* ------------------------------------------------------------------ *
 * قصّةُ الحياة — لوحةٌ جانبيّة
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **ولماذا لوحةٌ لا صفحةٌ مستقلّة.**
 *
 * الصفحةُ المستقلّةُ تُخرِجك من نتائجك: ترجع فتجد التصفيةَ قائمةً
 * (لأن الحالةَ في الوحدة) والتمريرَ في الأعلى، والسياقَ الذهنيَّ ضاع.
 * واللوحةُ تُبقي القائمةَ خلفك ظاهرةً، فتقفز بين عشرة عناصرَ في
 * ثوانٍ — وهو ما يجعل «استكشاف» فعلًا لا ادّعاءً.
 *
 * والعرضُ يقرّر الشكل: لوحةٌ جانبيّةٌ على الشاشة الواسعة، ودُرجٌ على
 * التابلت، وملءُ الشاشة على الموبايل — كلُّه في CSS، وهذه الدالّةُ
 * واحدة.
 */
async function paintStory(main, built, key) {
  const host = main.querySelector('[data-ml-story]');
  if (!host) return;

  const one = built.byKey.get(key);
  if (!one) { host.hidden = true; return; }

  const evidence = await evidenceOf(key);
  const story = await itemStory(one, evidence);
  const rel = relationsOf(built, key);

  host.hidden = false;
  host.innerHTML = html`
    <div class="ml-story" role="dialog" aria-label="قصة حياة العنصر">
      <div class="ml-story-bar">
        <b>قصة حياة العنصر</b>
        <button type="button" class="ml-x" data-action="ml-close" aria-label="اقفل">✕</button>
      </div>

      <div class="ml-story-body">
        <!-- ══ الترويسة (بند ٢٣) ══ -->
        <div class="ml-story-head">
          <h3 dir="ltr" lang="ru">${one.lemma || key}</h3>
          <button type="button" class="ml-speak" data-action="ml-speak"
                  data-text="${one.lemma || ''}" aria-label="اسمعها">♪</button>
        </div>
        <div class="ml-badges">
          <span class="ml-tag">${ITEM_TYPE_LABEL[one.itemType] || one.itemType}</span>
          ${raw(one.pos ? html`<span class="ml-tag">${one.pos}</span>` : '')}
          ${raw(one.gender ? html`<span class="ml-tag">${one.gender}</span>` : '')}
          ${raw(one.aspect ? html`<span class="ml-tag">${one.aspect}</span>` : '')}
          ${raw(one.register ? html`<span class="ml-tag">${one.register}</span>` : '')}
          ${raw(one.domain ? html`<span class="ml-tag">${one.domain}</span>` : '')}
          <span class="mr-tag is-${one.provenance}">${PROVENANCE_LABEL[one.provenance]}</span>
          ${raw(Number.isFinite(one.confidence)
    ? html`<span class="ml-tag">ثقة التحليل ${Math.round(one.confidence * 100)}%</span>` : '')}
          ${raw(one.hasAnalysis ? '' : '<span class="mr-tag is-unknown">من غير تحليل</span>')}
        </div>

        <!-- ══ المعنى والاستعمال (بند ٢٤) ══ -->
        ${raw(one.meaningAr ? html`<p class="ml-mean-big">${one.meaningAr}</p>` : '')}
        ${raw(one.government ? html`
          <p class="ml-line"><b>بتتركّب مع:</b> <span dir="ltr" lang="ru">${one.government}</span></p>` : '')}
        ${raw(one.usageNote ? html`<p class="ml-line"><b>ملاحظة استخدام:</b> ${one.usageNote}</p>` : '')}
        ${raw(one.notes ? html`<p class="ml-line">${one.notes}</p>` : '')}

        <div class="mr-sum mr-sum-pick">
          <span>مواقف حقيقية: <b>${one.realSituations}</b></span>
          <span>مرات الظهور: <b>${one.rawOccurrences}</b></span>
          <span>في مولَّد: <b>${one.derivedAppearances}</b></span>
          ${raw(one.unknownOccurrences
    ? html`<span class="mr-warn">غير محدَّد: <b>${one.unknownOccurrences}</b></span>` : '')}
        </div>

        ${raw(one.hasAnalysis ? html`
        <p class="mi-verify is-${one.verifyStatus}">
          ${VERIFY_LABEL[one.verifyStatus] || ''}
          ${raw(one.aiClaimedCount === null ? ' — التحليل ما ذكرش عدد'
    : html` — التحليل قال ${one.aiClaimedCount}، والتطبيق عدّ
            ${one.rawOccurrences + one.derivedAppearances + one.unknownOccurrences}`)}
        </p>` : '')}

        <!-- ══ من حياتي الحقيقية (بند ٢٨) ══ -->
        <h4 class="ml-h is-real">من حياتي الحقيقية (${evidence.realSituations} موقف)</h4>
        ${raw(evidence.primary.length ? html`
          <ul class="ml-cites">${raw(evidence.primary.map((row) => citeHtml(row, one)).join(''))}</ul>`
    : html`<p class="ml-tiny">
          مفيش دليل من نصّ أصلي لحد دلوقتي.
          ${raw(one.unknownOccurrences ? 'صنّف مصادرك غير المحدَّدة وهي ممكن تتحول لمواقف حقيقية.'
    : (one.derivedAppearances ? 'كل ظهورها لحد دلوقتي في مادة مولَّدة.'
      : 'هتظهر هنا أول ما تحلّل نصًّا فيه الكلمة دي.'))}
        </p>`)}

        <!-- ══ والمولَّدُ قسمٌ منفصلٌ تمامًا ══ -->
        <!-- ══ ومادّةٌ مولَّدةٌ بنسبها (بند ٣٠) ══ -->
        ${raw(story.derived.length ? html`
        <h4 class="ml-h is-derived">مواد تعليمية مولَّدة (${story.derived.length})</h4>
        <p class="ml-tiny ml-rule">
          المواد المولَّدة مش محسوبة كمواقف حقيقية. بتفيدك في الفهم
          والتدريب، ومش بتزوّد رقم «المواقف الحقيقية» ولا عدد المصادر
          الأصلية ولا معدّل استخدامك الحقيقي.
        </p>
        <ul class="ml-cites ml-cites-derived">
          ${raw(story.derived.map((row) => html`
            <li class="ml-cite">
              <span class="ml-cite-head">
                <b>${row.title}</b>
                ${raw(row.originLabel ? html`<span class="ml-tag">${row.originLabel}</span>` : '')}
                ${raw(row.at ? html`<span class="mr-dim">${formatDate(row.at)}</span>`
    : '<span class="mr-dim">من غير تاريخ</span>')}
              </span>
              <q dir="ltr" lang="ru">${row.quote}</q>
              ${raw(row.parents.length ? html`
                <span class="ml-note">
                  مولَّد من:
                  ${raw(row.parents.map((p) => html`
                    <button type="button" class="ml-linkish" data-action="ml-context"
                            data-source="${p.key}" data-segment="" data-needle="${one.lemma || ''}">
                      ${p.title}
                    </button>`).join('، '))}
                </span>`
    /*
     * ⚠️ **وأصلٌ غيرُ مذكورٍ يُقال** (بند ٣٠): «مولَّد من: —» أصدقُ
     *    من سطرٍ يختفي، لأن غيابَ النسب معلومةٌ تدعوك لتصنيف المصدر.
     */
    : '<span class="ml-note">أصله مش مسجَّل — صنّفه من «ذاكرة اللغة».</span>')}
            </li>`).join(''))}
        </ul>` : '')}

        ${raw(evidence.unknown.length ? html`
        <h4 class="ml-h is-unknown">في مصادر غير مصنَّفة (${evidence.unknown.length})</h4>
        <ul class="ml-cites">${raw(evidence.unknown.map((row) => citeHtml(row, one)).join(''))}</ul>
        <button type="button" class="btn btn-ghost btn-sm" data-action="mem-review">
          صنّف المصادر دي
        </button>` : '')}

        <!-- ══ ٣٨ · ليه ده موجود عندي؟ ══ -->
        <h4 class="ml-h">ليه ده موجود عندي؟</h4>
        <div class="ml-chips">
          ${raw(story.reasons.map((r) => html`
            <span class="ml-tag is-reason">${r.label}</span>`).join(''))}
        </div>

        <!-- ══ ٣١ · تاريخي معاه — أفعالٌ منّي لا أدلّةَ حياة ══ -->
        <h4 class="ml-h">تاريخي معاه</h4>
        <p class="ml-tiny ml-rule">
          ده تعاملي أنا مع العنصر — <b>مش دليل إنه ظهر في حياتي</b>.
          ولا حاجة هنا بتزوّد رقم «المواقف الحقيقية» ولا تعني إتقان.
        </p>
        <div class="mr-sum">
          <span>حفظتها: <b>${one.saved}</b></span>
          <span>اتدرّبت: <b>${one.practised}</b></span>
          <span>من الشادوينج: <b>${one.shadowed}</b></span>
          <span>تسجيلات: <b>${story.counts.recordings}</b></span>
          <span>غلطات سجّلتها: <b>${story.counts.learnerMistakes}</b></span>
        </div>
        ${raw(one.savedTags.length ? html`
        <div class="ml-chips">
          ${raw(one.savedTags.map((id) => html`
            <button type="button" class="ml-tag" data-action="ml-pick"
                    data-facet="tag" data-value="${id}">${tagLabel(built, id)}</button>`).join(''))}
        </div>` : '')}
        ${raw(story.saves.length ? html`
        <ul class="ml-events">
          ${raw(story.saves.map((c) => html`
            <li>حفظتها ${c.at ? formatDate(c.at) : 'من غير تاريخ'}${raw(c.note ? html` · ${c.note}` : '')}</li>`).join(''))}
        </ul>` : '')}

        <!-- ══ ٣٣ · تسجيلاتي — بالمسار القائم لا بنظامٍ ثانٍ ══ -->
        ${raw(story.recordings.length ? html`
        <h5 class="ml-sub-h">تسجيلاتي (${story.recordings.length})</h5>
        <ul class="ml-recs">
          ${raw(story.recordings.map((rec) => html`
            <li>
              <button type="button" class="ml-play" data-action="ml-play"
                      data-media="${rec.mediaId || ''}"
                      aria-label="شغّل تسجيلك">▶</button>
              <span class="ml-rec-when">${rec.at ? formatDate(rec.at) : 'من غير تاريخ'}</span>
              ${raw(rec.durationMs
    ? html`<span class="mr-dim">${Math.round(rec.durationMs / 1000)} ث</span>` : '')}
              <!--
                ⚠️ **وما على Drive يقول ذلك ولا يُنزَّل الآن** (بند ٣٣):
                   فتحُ القصّة لا يجرّ ميجابايتاتٍ لم تطلبها.
              -->
              ${raw(rec.cloudOnly ? '<span class="ml-tag">على Drive — اضغط لتنزيله</span>' : '')}
            </li>`).join(''))}
        </ul>` : '')}

        <!-- ══ ٣٤ · غلطاتي وحدَها هنا ══ -->
        ${raw(story.mistakes.learner.length ? html`
        <h5 class="ml-sub-h">غلطات سجّلتها</h5>
        <ul class="ml-events ml-events-bad">
          ${raw(story.mistakes.learner.map((e) => html`
            <li>
              <span dir="ltr" lang="ru">${e.wrong}</span> ←
              <span dir="ltr" lang="ru">${e.natural}</span>
              ${raw(e.at ? html`<span class="mr-dim">${formatDate(e.at)}</span>`
    : '<span class="mr-dim">من غير تاريخ</span>')}
            </li>`).join(''))}
        </ul>` : '')}

        <!--
          ⚠️ **واقتراحاتُ التصحيح تحليلٌ لا تاريخ** (بند ٣٤): تُعرَض
             تحت عنوانها ولا تدخل «غلطاتي» ولا تُعَدّ في أيّ رقمٍ عنك.
        -->
        ${raw(story.mistakes.proposed.length ? html`
        <h5 class="ml-sub-h">اقتراحات من التحليل (مش غلطات عليك)</h5>
        <ul class="ml-events ml-events-soft">
          ${raw(story.mistakes.proposed.map((e) => html`
            <li>
              <span class="ml-tag">${MISTAKE_KIND_LABEL[e.kind]}</span>
              <span dir="ltr" lang="ru">${e.wrong}</span> →
              <span dir="ltr" lang="ru">${e.natural}</span>
            </li>`).join(''))}
        </ul>` : '')}

        <!-- ══ ٣٢ · الخطُّ الزمنيّ — وقائعُ مؤرَّخةٌ وحدَها ══ -->
        <h4 class="ml-h">خط زمني للظهور</h4>
        ${raw(story.timeline.length ? html`
        <ol class="ml-time">
          ${raw(story.timeline.map((e) => html`
            <li class="is-${e.kind}">
              <span class="ml-time-when">${formatDate(e.at)}</span>
              <span class="ml-time-what">
                ${EVENT_LABEL[e.kind] || ''}
                ${raw(e.title ? html` · ${e.title}` : '')}
                ${raw(e.speaker ? html` · <span class="ml-spk">${e.speaker}</span>` : '')}
              </span>
              ${raw(e.quote ? html`<q dir="ltr" lang="ru">${e.quote}</q>` : '')}
            </li>`).join(''))}
        </ol>` : html`
        <p class="ml-tiny">
          مفيش تواريخ حقيقية كفاية لخط زمني. تاريخ الظهور بييجي من
          تاريخ الذكرى نفسها — لو المشهد من غير تاريخ، مبنخترعش واحد.
        </p>`)}
        ${raw(story.counts.undatedEvents ? html`
        <p class="ml-tiny">
          وفيه ${story.counts.undatedEvents} حاجة تانية من غير تاريخ،
          فما دخلتش الخط الزمني.
        </p>` : '')}

        <!-- ══ الصيغُ بأعدادها (بند ٢٥) ══ -->
        <h4 class="ml-h">الصيغ</h4>
        <p class="ml-tiny">شفتها فعلًا في نصوصك:</p>
        <div class="ml-chips">
          ${raw(rel.forms.observed.length ? rel.forms.observed.map((f) => html`
            <span class="ml-tag is-seen" dir="ltr" lang="ru">${f}
              <i>${one.formCounts[f] || 0}</i></span>`).join('')
    : '<span class="ml-tiny">ولا واحدة لسه.</span>')}
        </div>
        ${raw(rel.forms.unseen.length ? html`
        <p class="ml-tiny">صيغ مرتبطة لسه ما ظهرتش عندك:</p>
        <div class="ml-chips">
          ${raw(rel.forms.unseen.map((f) => html`
            <span class="ml-tag is-unseen" dir="ltr" lang="ru">${f}</span>`).join(''))}
        </div>` : '')}

        <!-- ══ عائلةُ الكلمة — لا تُسمّى «صيغ» (بند ٢٦) ══ -->
        ${raw(rel.family.length ? html`
        <h4 class="ml-h">عائلة الكلمة</h4>
        <p class="ml-tiny">كلمات تانية من نفس العائلة — مش صيغ لنفس الكلمة.</p>
        <div class="ml-chips">
          ${raw(rel.family.map((other) => html`
            <button type="button" class="ml-tag" data-action="ml-open" data-key="${other.key}"
                    dir="ltr" lang="ru">${other.lemma}</button>`).join(''))}
        </div>` : '')}

        <!-- ══ المعاني (بند ٢٧) ══ -->
        ${raw(rel.senses.length ? html`
        <h4 class="ml-h">معاني تانية لنفس الكلمة</h4>
        <ul class="ml-senses">
          ${raw(rel.senses.map((other) => html`
            <li>
              <button type="button" data-action="ml-open" data-key="${other.key}">
                <b>${other.senseLabel || other.senseId || other.key}</b>
                ${raw(other.meaningAr ? html`<span>${other.meaningAr}</span>` : '')}
                <i>${other.realSituations} موقف · ${other.rawOccurrences} ظهور</i>
              </button>
            </li>`).join(''))}
        </ul>` : '')}
      </div>
    </div>`;
}

/**
 * استشهادٌ واحد — ومعه بابُ **فتح المصدر كاملًا** (بند ٢٩).
 */
function citeHtml(row, one) {
  return html`
    <li class="ml-cite">
      <span class="ml-cite-head">
        <b>${row.title}</b>
        ${raw(row.speaker ? html`<span class="ml-spk">${row.speaker}</span>` : '')}
        ${raw(row.at ? html`<span class="mr-dim">${formatDate(row.at)}</span>`
    : '<span class="mr-dim">من غير تاريخ</span>')}
        ${raw(row.form ? html`<span class="ml-tag" dir="ltr" lang="ru">${row.form}</span>` : '')}
      </span>
      <q dir="ltr" lang="ru">${row.quote}</q>
      ${raw(row.aiNote ? html`<span class="ml-note">ملاحظة التحليل: ${row.aiNote}</span>` : '')}
      <button type="button" class="ml-open-src" data-action="ml-context"
              data-source="${row.sourceKey}" data-segment="${row.segmentId}"
              data-needle="${row.form || one.lemma || ''}">
        افتح المصدر كامل ←
      </button>
    </li>`;
}

/* ------------------------------------------------------------------ *
 * السياقُ الكامل للمصدر
 * ------------------------------------------------------------------ */

async function showContext(main, sourceKey, segmentId, needle) {
  const { sourceContext, splitHighlights } = await import('../services/memory/source-context.js');
  const ctx = await sourceContext(sourceKey, segmentId, needle);
  const host = main.querySelector('[data-ml-story]');
  if (!host) return;

  const body = ctx.missing
    ? html`<p class="ml-tiny">
        النصّ ده مش موجود دلوقتي — يمكن اتشال. الدليل باقي في سجلّك،
        بس النصّ نفسه مش هنا.
      </p>`
    : html`
      <div class="ml-src">
        ${raw(ctx.segments.map((seg) => html`
          <p class="ml-src-seg ${seg.isTarget ? 'is-target' : ''}" dir="ltr" lang="ru">
            ${raw(seg.speaker ? html`<b class="ml-spk" dir="rtl">${seg.speaker}</b>` : '')}
            ${raw(splitHighlights(seg.text, seg.hits)
    .map((part) => (part.hit ? html`<mark>${part.text}</mark>` : html`${part.text}`))
    .join(''))}
          </p>`).join(''))}
      </div>`;

  host.hidden = false;
  host.innerHTML = html`
    <div class="ml-story" role="dialog" aria-label="النصّ الأصلي كامل">
      <div class="ml-story-bar">
        <button type="button" class="ml-back" data-action="ml-back-story">← رجوع للقصّة</button>
        <button type="button" class="ml-x" data-action="ml-close" aria-label="اقفل">✕</button>
      </div>
      <div class="ml-story-body">
        <h3>${ctx.title}</h3>
        <div class="ml-badges">
          ${raw(ctx.evidenceClass
    ? html`<span class="mr-tag is-${ctx.evidenceClass}">
              ${PROVENANCE_LABEL[ctx.evidenceClass === 'primary' ? PROVENANCE.PRIMARY
    : (ctx.evidenceClass === 'derived' ? PROVENANCE.DERIVED_ONLY : PROVENANCE.UNKNOWN_ONLY)]}
            </span>` : '')}
          <span class="ml-tag">${ctx.at ? formatDate(ctx.at) : 'من غير تاريخ'}</span>
        </div>
        ${raw(body)}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * الأفعال
 * ------------------------------------------------------------------ */

const TOTAL_QUERY = {
  words: { type: [ITEM_TYPE.WORD] },
  expressions: { type: [ITEM_TYPE.EXPRESSION] },
  sentences: { type: [ITEM_TYPE.SENTENCE] },
  patterns: { type: [ITEM_TYPE.PATTERN] },
  primary: { provenance: [PROVENANCE.PRIMARY] },
  derived: { provenance: [PROVENANCE.DERIVED_ONLY] },
  unknownsrc: { provenance: [PROVENANCE.UNKNOWN_ONLY] },
  noevidence: { provenance: [PROVENANCE.NONE] },
  review: { verify: [VERIFY.REVIEW] },
  learner: { signal: [SIGNAL.LEARNER_ONLY] },
};

const TAB_OF_TOTAL = {
  words: ITEM_TYPE.WORD,
  expressions: ITEM_TYPE.EXPRESSION,
  sentences: ITEM_TYPE.SENTENCE,
  patterns: ITEM_TYPE.PATTERN,
};

function reset() {
  state.query = EMPTY_QUERY();
  state.top = 0;
  state.scroll = 0;
}

const focusExplorer = (main) => {
  main.querySelector('.ml-explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/** عنوانٌ مساعدٌ للمشغّل — من الصفّ الذي ضُغط. */
const one_title = (target) =>
  target?.closest('li')?.querySelector('.ml-rec-when')?.textContent?.trim() || '';

export async function handleMyLanguageAction(action, target) {
  const main = $('#app-main');
  const redraw = async () => { if (main) await renderMyLanguage(main); };

  if (action === 'go-my-language') { navigate('/my-language'); return true; }

  if (action === 'ml-open') {
    /*
     * ⚠️ **ولا تنقّلَ هنا** (بند ٢٢): فتحُ القصّة لا يغيّر المسار،
     *    فلا تُعاد الشاشةُ من الصفر ولا تضيع التصفيةُ ولا التمرير.
     */
    state.story = target.dataset.key;
    state.context = null;
    const built = cachedLanguage();
    if (main && built) await paintStory(main, built, state.story);
    const list = main?.querySelector('[data-ml-list]');
    if (list) list.scrollTop = state.scroll;
    return true;
  }

  if (action === 'ml-close') {
    state.story = null;
    state.context = null;
    const host = main?.querySelector('[data-ml-story]');
    if (host) { host.hidden = true; host.innerHTML = ''; }
    const list = main?.querySelector('[data-ml-list]');
    if (list) list.scrollTop = state.scroll;
    return true;
  }

  if (action === 'ml-context') {
    const { source, segment, needle } = target.dataset;
    state.context = { source, segment, needle };
    if (main) await showContext(main, source, segment, needle);
    return true;
  }

  if (action === 'ml-back-story') {
    state.context = null;
    const built = cachedLanguage();
    if (main && built && state.story) await paintStory(main, built, state.story);
    return true;
  }

  if (action === 'ml-speak') {
    const text = target.dataset.text || '';
    if (!text) return true;
    /*
     * ⚠️ **نفسُ محرّك النطق الذي يستعمله الشادوينج — لا ثانٍ** (WS40-A).
     *    `tts-controller.speak` يحلّ الصوتَ الروسيَّ المختار ويحترم
     *    إعداداتِك؛ وبناءُ `SpeechSynthesisUtterance` هنا كان سيعطي
     *    صوتًا مختلفًا عن الذي تتدرّب عليه.
     *
     * ⚠️ **ولا يُرفَض وعدُه**: تعذّرُ النطق يرجع `{ok:false}` ولا يكسر
     *    الشاشة — راجع ترويسة `speak`.
     */
    const { speak } = await import('../services/shadow/tts-controller.js');
    const said = await speak(text);
    if (!said.ok) toast('الصوت مش متاح دلوقتي');
    return true;
  }

  if (action === 'ml-play') {
    const mediaId = target.dataset.media;
    if (!mediaId) return true;
    /*
     * ⚠️ **ولا نظامَ تسجيلٍ ثانٍ ولا نسخةَ بايتاتٍ ثانية** (بند ٣٣):
     *    `ensureBytes` هي نفسُها التي يستعملها كلُّ ما في التطبيق،
     *    و`urlFor` نفسُها، والمشغّلُ نفسُه. والفرقُ الوحيد أن هذه
     *    الشاشةَ تطلب **ملفًّا واحدًا** لا كلَّ ما على Drive.
     */
    const { ensureBytes, urlFor } = await import('../services/media-service.js');
    const got = await withProgress({
      key: `ml-media-${mediaId}`,
      title: 'بيجيب تسجيلك',
      stages: ['بيدوّر عليه', 'بينزّله من Drive'],
    }, async (bar) => {
      bar.stage(0).indeterminate('بيدوّر على الملف…');
      const outcome = await ensureBytes(mediaId);
      if (!outcome.ok) {
        bar.fail(outcome.reason || 'مقدرناش نجيبه');
        return outcome;
      }
      bar.done(outcome.alreadyLocal ? 'موجود على الجهاز' : 'اتنزّل');
      return outcome;
    });

    if (got?.skipped) return true;
    if (!got?.ok) return true;

    const url = urlFor(got.record, { thumb: false });
    if (!url) { toast('الملف مش متاح'); return true; }
    const { api } = await import('../services/audio-service.js');
    /* ⚠️ `load` لا `play`: هي البابُ الذي يحمّل مقطعًا ويشغّله. */
    await api.load({ mediaId, url, title: 'تسجيلي', subtitle: one_title(target) });
    return true;
  }

  if (action === 'ml-tab') {
    state.tab = target.dataset.tab;
    state.top = 0;
    state.scroll = 0;
    await redraw();
    return true;
  }

  if (action === 'ml-total') {
    const id = target.dataset.total;
    if (id === 'families' || id === 'forms') {
      toast(id === 'families'
        ? 'العائلات صفة على الكلمات — افتح أي كلمة تلاقي عيلتها جوّه'
        : 'الصيغ بتتعرض جوّه صفحة الكلمة نفسها');
      return true;
    }
    reset();
    Object.assign(state.query, TOTAL_QUERY[id] || {});
    state.tab = TAB_OF_TOTAL[id] || 'all';
    await redraw();
    if (main) focusExplorer(main);
    return true;
  }

  if (action === 'ml-mine') {
    reset();
    state.tab = 'mine';
    const type = target.dataset.type;
    if (type && type !== 'all') state.query.type = [type];
    await redraw();
    if (main) focusExplorer(main);
    return true;
  }

  if (action === 'ml-quick') {
    const quick = QUICK.find((one) => one.id === target.dataset.quick);
    if (!quick) return true;
    reset();
    quick.apply(state.query);
    await redraw();
    if (main) focusExplorer(main);
    return true;
  }

  if (action === 'ml-facets-toggle') {
    state.facetsOpen = !state.facetsOpen;
    await redraw();
    return true;
  }

  if (action === 'ml-facet') {
    state.openFacet = target.dataset.facet;
    state.facetsOpen = true;
    await redraw();
    return true;
  }

  if (action === 'ml-pick') {
    const { facet, value } = target.dataset;
    const picked = state.query[facet] || [];
    state.query[facet] = picked.includes(value)
      ? picked.filter((one) => one !== value)
      : [...picked, value];
    state.top = 0;
    state.scroll = 0;
    await redraw();
    return true;
  }

  if (action === 'ml-unrecent') {
    delete state.query.recentDays;
    await redraw();
    return true;
  }

  if (action === 'ml-present') {
    state.presentBy = target.dataset.by;
    await redraw();
    return true;
  }

  if (action === 'ml-clear') {
    reset();
    state.tab = 'all';
    await redraw();
    return true;
  }

  if (action === 'ml-rebuild') {
    invalidateLanguage();
    await redraw();
    toastOk('الأرقام اتحدّثت');
    return true;
  }

  return false;
}

/**
 * المسارُ القديمُ لعنصرٍ بعينه — يبقى صالحًا للروابط المحفوظة.
 *
 * ⚠️ **ولا يُحذَف رغم أن القصّةَ صارت لوحة.** رابطٌ نسخته أمس يجب أن
 *    يفتح ما فتحه أمس. فيُعاد التوجيهُ إلى الشاشة واللوحةُ مفتوحةٌ عليه.
 */
export async function renderLanguageItem(main, rawKey) {
  state.story = decodeURIComponent(rawKey || '');
  state.context = null;
  await renderMyLanguage(main);
}

/** البحثُ والترتيب — حقولٌ حيّةٌ بمستمعٍ واحدٍ مندوب. */
export function wireMyLanguage(main) {
  let timer = null;

  main.addEventListener('input', (event) => {
    const box = event.target.closest('[data-ml-search]');
    if (!box) return;
    state.query.search = box.value;
    state.top = 0;
    state.scroll = 0;
    /*
     * ⚠️ **ولا يُعاد الرسمُ عند كلّ حرف.** على عشرة آلاف عنصرٍ يعني
     *    ذلك تصفيةً وترتيبًا كاملين مع كلّ ضغطةِ مفتاح. والتأخيرُ
     *    القصيرُ يجعل الكتابةَ سلسةً والنتيجةَ فوريّةً عند التوقّف.
     */
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const built = cachedLanguage();
      if (!built) return;
      const rows = rowsFor(built);
      const list = main.querySelector('[data-ml-list]');
      const count = main.querySelector('[data-ml-count]');
      if (!list || !count) { await renderMyLanguage(main); return; }
      const space = list.querySelector('.ml-space');
      const shown = rows.slice(0, visibleCount() + OVERSCAN * 2);
      shown.forEach((one, i) => { one.__y = i * ROW_H; });
      space.style.height = `${rows.length * ROW_H}px`;
      space.innerHTML = shown.map(rowHtml).join('');
      list.scrollTop = 0;
      count.textContent = `${nf(rows.length)} عنصر`;
      wireList(main, rows);
    }, 180);
  });

  main.addEventListener('change', async (event) => {
    const sel = event.target.closest('[data-ml-sort]');
    if (!sel) return;
    state.query.sort = sel.value;
    state.top = 0;
    state.scroll = 0;
    await renderMyLanguage(main).catch((error) => toastError(error.message));
  });
}

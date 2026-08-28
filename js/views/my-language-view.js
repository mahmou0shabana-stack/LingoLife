/**
 * LingoLife — «لغتي»: المستكشف وقصّةُ العنصر (WS-J · بنود ١٦…٢٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **كلُّ رقمٍ في الأعلى بابٌ — لا زينة**
 * ═══════════════════════════════════════════════════════════════
 *
 * «٨٤٠ كلمة» يكتبها كلُّ تطبيقٍ لغةٍ في العالم، ولا يستطيع مستخدمٌ
 * واحدٌ أن يرى **أيَّ** ٨٤٠. فالرقمُ هنا زرٌّ: تضغطه فتفتح القائمةَ
 * مُصفّاةً عليه، ويمكنك النزولُ فيها إلى آخرها.
 *
 * ⚠️ **و«كلمة» تعني مفردةً لا صيغة.** «صيغ ملحوظة» رقمٌ ثانٍ بجانبه
 *    باسمه — راجع ترويسة `my-language.js`.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا نافذةٌ منزلقةٌ لا قائمةٌ كاملة**
 * ═══════════════════════════════════════════════════════════════
 *
 * عشرةُ آلاف صفٍّ في الـDOM تعني عشرةَ آلاف عقدةٍ تُنشأ وتُنسَّق في كلّ
 * تصفية. وعلى التابلت يعني ذلك تجمُّدًا محسوسًا عند كلّ نقرةِ وجه.
 * فالقائمةُ **كلُّها** موجودةٌ منطقيًّا (ويمكن النزولُ إلى آخرها)،
 * والمرسومُ منها ما يقع في النافذة وحدَه.
 *
 * ⚠️ **ولا «أظهر ٥٠ الأولى» بدلًا من ذلك.** سقفٌ صامتٌ يجعل المستخدمَ
 *    يظنّ أن هذا كلُّ ما عنده — وهو العطبُ الذي أصلحه WS0-ج في شاشة
 *    الحياة، ولا يُعاد هنا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والمولَّدُ مفصولٌ بصريًّا وإحصائيًّا — في كلّ موضع**
 * ═══════════════════════════════════════════════════════════════
 *
 * في القائمة: رقمان لا رقم. وفي صفحة العنصر: قسمان لا قسم، ولا
 * جدولَ واحدٌ مرتَّبٌ بالتاريخ يخلطهما. راجع البند ٢ و`evidenceOf`.
 */

import { html, raw, $ } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { navigate } from '../router.js';
import { toast, toastError } from '../components/toast.js';
import { withProgress } from '../components/progress.js';
import { formatDate } from '../utils/dates.js';
import {
  buildLanguageIndex, queryLanguage, relationsOf, evidenceOf,
  PROVENANCE, PROVENANCE_LABEL, LEARNING_LABEL, SIGNAL, SIGNAL_LABEL,
  SORT, SORT_LABEL, ITEM_TYPE, ITEM_TYPE_LABEL, FACETS, VERIFY,
} from '../services/memory/my-language.js';
import { VERIFY_LABEL } from '../services/memory/counting.js';
import {
  cachedLanguage, cacheLanguage, invalidateLanguage,
} from '../services/memory/language-cache.js';

/* ------------------------------------------------------------------ *
 * الحالة
 * ------------------------------------------------------------------ */

/**
 * الفهرسُ محفوظٌ في ورقةٍ مشتركة — راجع ترويسة `language-cache.js`.
 *
 * ⚠️ **ولا تملكه الشاشة.** الحفظُ من الشادوينج يقع خارجها، وهو الذي
 *    يُبطِله. فلو كانت الذاكرةُ هنا لَاحتاجت `saved-service` أن
 *    تستورد شاشةً — وذلك عكسُ اتجاه الاعتماد في المشروع كلِّه.
 */
export const invalidateLanguageIndex = invalidateLanguage;

const state = {
  query: {
    type: [], pos: [], register: [], domain: [],
    provenance: [], learning: [], signal: [], verify: [],
    family: null, search: '', sort: SORT.SITUATIONS,
  },
  /** أوّلُ صفٍّ مرسومٍ في النافذة المنزلقة. */
  top: 0,
  openFacet: 'type',
};

/** ارتفاعُ الصفّ بالبكسل — يُقاس مرّةً في CSS ويُذكَر هنا صراحةً. */
const ROW_H = 64;
/** صفوفٌ زائدةٌ فوق النافذة وتحتها فلا يظهر بياضٌ عند التمرير السريع. */
const OVERSCAN = 6;

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

/* ------------------------------------------------------------------ *
 * الرسم
 * ------------------------------------------------------------------ */

/** المجاميعُ العليا — كلٌّ منها زرٌّ يصفّي القائمة. */
function totalsHtml(totals) {
  const tile = (id, label, value, note = '') => html`
    <button class="ml-tile" data-action="ml-total" data-total="${id}">
      <b>${value.toLocaleString('en')}</b>
      <span>${label}</span>
      ${raw(note ? html`<i>${note}</i>` : '')}
    </button>`;

  return html`
    <div class="ml-tiles">
      ${raw(tile('words', 'مفردات', totals.words, 'مش صيغ'))}
      ${raw(tile('expressions', 'تعبيرات', totals.expressions))}
      ${raw(tile('sentences', 'جمل', totals.sentences))}
      ${raw(tile('patterns', 'تراكيب', totals.patterns))}
      ${raw(tile('families', 'عائلات', totals.families))}
      ${raw(tile('forms', 'صيغ ملحوظة', totals.observedForms, 'مش بتتجمع مع المفردات'))}
    </div>

    <!--
      ⚠️ **والمنشأُ صفٌّ ثانٍ لا عمودٌ داخل الأوّل**: «٨٤٠ مفردة» و«٣١٠
         منها من موقف حقيقي» رقمان مختلفان، وضمُّهما في بطاقةٍ واحدةٍ
         يوحي بأن أحدهما جزءٌ من الآخر بنفس المعنى.
    -->
    <div class="ml-tiles ml-tiles-thin">
      ${raw(tile('primary', 'من موقف حقيقي', totals.withPrimary))}
      ${raw(tile('derived', 'من مولَّد بس', totals.derivedOnly))}
      ${raw(tile('unknownsrc', 'من مصادر غير محدَّدة', totals.unknownOnly))}
      ${raw(tile('noevidence', 'من غير دليل حالي', totals.noEvidence))}
      ${raw(tile('review', 'عدّها محتاج مراجعة', totals.needsReview))}
      ${raw(tile('learner', 'إنت اللي علّمتها', totals.learnerOnly))}
    </div>`;
}

const LABEL_OF = {
  type: (v) => ITEM_TYPE_LABEL[v] || v,
  provenance: (v) => PROVENANCE_LABEL[v] || v,
  learning: (v) => LEARNING_LABEL[v] || v,
  signal: (v) => SIGNAL_LABEL[v] || v,
  verify: (v) => VERIFY_LABEL[v] || v,
};

function facetsHtml(facets) {
  const open = state.openFacet;
  const values = facets[open] || [];
  const picked = state.query[open] || [];

  return html`
    <div class="ml-facets">
      <div class="ml-facet-tabs">
        ${raw(FACETS.map((f) => {
    const count = (state.query[f.id] || []).length;
    return html`
          <button type="button" data-action="ml-facet" data-facet="${f.id}"
                  class="${open === f.id ? 'on' : ''}">
            ${f.label}${raw(count ? html` <i>${count}</i>` : '')}
          </button>`;
  }).join(''))}
      </div>

      <div class="ml-facet-values">
        ${raw(values.length ? values.map((one) => html`
          <button type="button" data-action="ml-pick" data-facet="${open}"
                  data-value="${one.value}"
                  class="${picked.includes(one.value) ? 'on' : ''}">
            ${(LABEL_OF[open] ? LABEL_OF[open](one.value) : one.value)}
            <span class="ml-n">${one.count}</span>
          </button>`).join('')
    /*
     * ⚠️ **والوجهُ الفارغُ يقول لماذا هو فارغ.** «مفيش قيم» وحدَها
     *    تبدو عطبًا؛ والسببُ الحقيقيُّ أن التحليلَ لم يملأ هذا الحقلَ
     *    بعد — وهي معلومةٌ تُفيد المستخدمَ في الجولة القادمة.
     */
    : '<p class="field-hint">مفيش قيم هنا لسه — التحليل ما ملاش الحقل ده في العناصر الحالية.</p>')}
      </div>
    </div>`;
}

/** صفٌّ واحد: مفردةٌ وأرقامُها **مفصولةً**. */
function rowHtml(one) {
  return html`
    <button class="ml-row" data-action="ml-open" data-key="${one.key}"
            style="--y:${one.__y}px">
      <span class="ml-lemma" dir="ltr" lang="ru">${one.lemma || one.key}</span>
      <span class="ml-mid">
        <span class="ml-tag">${ITEM_TYPE_LABEL[one.itemType] || one.itemType}</span>
        ${raw(one.pos ? html`<span class="ml-tag">${one.pos}</span>` : '')}
        ${raw(one.register ? html`<span class="ml-tag">${one.register}</span>` : '')}
        ${raw(one.meaningAr ? html`<span class="ml-mean">${one.meaningAr}</span>` : '')}
      </span>
      <span class="ml-nums">
        <b class="${one.realSituations ? 'is-real' : 'is-zero'}">${one.realSituations}</b>
        <i>موقف</i>
        <b class="is-derived">${one.derivedAppearances}</b>
        <i>مولَّد</i>
        ${raw(one.unknownOccurrences ? html`<b class="is-unknown">${one.unknownOccurrences}</b><i>غير محدَّد</i>` : '')}
      </span>
    </button>`;
}

function listHtml(rows) {
  const height = rows.length * ROW_H;
  const start = Math.max(0, state.top - OVERSCAN);
  const window = rows.slice(start, start + visibleCount() + OVERSCAN * 2);
  window.forEach((one, i) => { one.__y = (start + i) * ROW_H; });

  return html`
    <div class="ml-list" data-ml-list>
      <div class="ml-space" style="height:${height}px">
        ${raw(window.map(rowHtml).join(''))}
      </div>
    </div>
    <p class="ml-count">
      ${rows.length.toLocaleString('en')} عنصر
      ${raw(rows.length > visibleCount() ? html` · انزل بإصبعك للآخر` : '')}
    </p>`;
}

const visibleCount = () => Math.ceil((window.innerHeight * 0.5) / ROW_H) + 1;

export async function renderMyLanguage(main) {
  const built = await index();
  if (!built) { main.innerHTML = '<p class="field-hint">اتلغى.</p>'; return; }

  const rows = queryLanguage(built, state.query);
  const active = FACETS.flatMap((f) => (state.query[f.id] || [])
    .map((v) => ({ facet: f.id, value: v })));

  main.innerHTML = html`
    <section class="ml">
      <h2>${raw(icon('book', 19))} لغتي</h2>
      <p class="lg-note">
        كل رقم هنا مدخل: اضغطه تلاقي العناصر نفسها. و«مفردات» يعني
        كلمات مختلفة — مش صيغ.
      </p>

      ${raw(totalsHtml(built.totals))}

      <div class="ml-search">
        <input type="search" data-ml-search placeholder="دوّر في لغتك…"
               value="${state.query.search}" dir="auto">
        <select data-ml-sort>
          ${raw(Object.values(SORT).map((id) => html`
            <option value="${id}" ${state.query.sort === id ? 'selected' : ''}>
              ${SORT_LABEL[id]}</option>`).join(''))}
        </select>
      </div>

      ${raw(facetsHtml(built.facets))}

      ${raw(active.length ? html`
      <div class="ml-active">
        ${raw(active.map((one) => html`
          <button type="button" data-action="ml-pick" data-facet="${one.facet}"
                  data-value="${one.value}" class="ml-chip">
            ${(LABEL_OF[one.facet] ? LABEL_OF[one.facet](one.value) : one.value)} ✕
          </button>`).join(''))}
        <button type="button" data-action="ml-clear" class="ml-chip is-clear">امسح الكل</button>
      </div>` : '')}

      ${raw(rows.length ? listHtml(rows) : html`
        <p class="field-hint">مفيش عناصر بالتصفية دي.</p>`)}
    </section>`;

  wireList(main, rows);
}

/**
 * يربط التمريرَ بالنافذة المنزلقة.
 *
 * ⚠️ **ولا يُعاد رسمُ الشاشة كلِّها عند التمرير.** كنتُ سأنادي
 *    `renderMyLanguage` من مستمع التمرير — وهو يعيد بناءَ الأوجه
 *    والمجاميع ستّين مرّةً في الثانية. فالمرسومُ عند التمرير **صفوفُ
 *    النافذة وحدَها**.
 */
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

  list.addEventListener('scroll', () => requestAnimationFrame(paint), { passive: true });
  state.top = 0;
  list.scrollTop = 0;
}

/* ------------------------------------------------------------------ *
 * صفحةُ العنصر — قصّتُه كاملةً
 * ------------------------------------------------------------------ */

export async function renderLanguageItem(main, rawKey) {
  const key = decodeURIComponent(rawKey || '');
  const built = await index();
  if (!built) { main.innerHTML = '<p class="field-hint">اتلغى.</p>'; return; }

  const one = built.byKey.get(key);
  if (!one) {
    main.innerHTML = html`
      <section class="ml">
        <button class="btn btn-ghost" data-action="go-my-language">← لغتي</button>
        <p class="field-hint">العنصر ده مش موجود دلوقتي.</p>
      </section>`;
    return;
  }

  const [evidence, memory] = await Promise.all([
    evidenceOf(key),
    import('../services/memory/memory-service.js')
      .then((m) => m.entityMemory(one.lemma || '', one.itemType === ITEM_TYPE.WORD ? 'word' : 'sentence'))
      .catch(() => null),
  ]);
  const rel = relationsOf(built, key);

  const cite = (row) => html`
    <li class="ml-cite">
      <span class="ml-cite-head">
        <b>${row.title}</b>
        ${raw(row.at ? html`<span class="mr-dim">${formatDate(row.at)}</span>`
    /* ⚠️ ولا تاريخَ يُخترَع — الغيابُ يُكتَب (بند ٤). */
    : '<span class="mr-dim">من غير تاريخ</span>')}
        ${raw(row.form ? html`<span class="ml-tag">${row.form}</span>` : '')}
      </span>
      <q dir="ltr" lang="ru">${row.quote}</q>
      ${raw(row.aiNote ? html`<span class="ml-note">ملاحظة التحليل: ${row.aiNote}</span>` : '')}
    </li>`;

  main.innerHTML = html`
    <section class="ml ml-item">
      <button class="btn btn-ghost" data-action="go-my-language">← لغتي</button>

      <h2 dir="ltr" lang="ru">${one.lemma || key}</h2>
      <div class="ml-badges">
        <span class="ml-tag">${ITEM_TYPE_LABEL[one.itemType] || one.itemType}</span>
        ${raw(one.pos ? html`<span class="ml-tag">${one.pos}</span>` : '')}
        ${raw(one.gender ? html`<span class="ml-tag">${one.gender}</span>` : '')}
        ${raw(one.aspect ? html`<span class="ml-tag">${one.aspect}</span>` : '')}
        ${raw(one.register ? html`<span class="ml-tag">${one.register}</span>` : '')}
        ${raw(one.domain ? html`<span class="ml-tag">${one.domain}</span>` : '')}
        <span class="mr-tag is-${one.provenance}">${PROVENANCE_LABEL[one.provenance]}</span>
        ${raw(one.hasAnalysis ? '' : '<span class="mr-tag is-unknown">من غير تحليل</span>')}
      </div>

      ${raw(one.meaningAr ? html`<p class="ml-mean-big">${one.meaningAr}</p>` : '')}
      ${raw(one.government ? html`<p class="field-hint">بتتركّب مع: ${one.government}</p>` : '')}
      ${raw(one.usageNote ? html`<p class="field-hint">${one.usageNote}</p>` : '')}

      <!--
        ⚠️ **صفُّ الأرقام: سبعةٌ مسمّاةٌ لا مجموعٌ واحد** (بند ٢).
      -->
      <div class="mr-sum mr-sum-pick">
        <span>مواقف حقيقية: <b>${one.realSituations}</b></span>
        <span>ظهور في نصّ أصلي: <b>${one.rawOccurrences}</b></span>
        <span>ظهور في مولَّد: <b>${one.derivedAppearances}</b></span>
        <span class="mr-warn">في مصادر غير محدَّدة: <b>${one.unknownOccurrences}</b></span>
      </div>

      <!--
        ⚠️ **وعدُّ التحليل يبقى مرئيًّا بجانب عدّنا — والخلافُ يبقى خلافًا.**
      -->
      ${raw(one.hasAnalysis ? html`
      <p class="mi-verify is-${one.verifyStatus}">
        ${VERIFY_LABEL[one.verifyStatus] || ''}
        ${raw(one.aiClaimedCount === null ? ' — التحليل ما ذكرش عدد'
    : html` — التحليل قال ${one.aiClaimedCount}، والتطبيق عدّ
              ${one.rawOccurrences + one.derivedAppearances + one.unknownOccurrences}`)}
      </p>` : '')}

      <!-- ══ الطبقةُ أ: مواقفُ حقيقيّة ══ -->
      <h3>مواقف حقيقية (${evidence.realSituations})</h3>
      ${raw(evidence.primary.length ? html`
        <ul class="ml-cites">${raw(evidence.primary.map(cite).join(''))}</ul>`
    : '<p class="field-hint">مفيش دليل من نصّ أصلي لحد دلوقتي.</p>')}

      <!-- ══ وقسمٌ منفصلٌ تمامًا للمولَّد — لا جدولَ واحدٌ يخلطهما ══ -->
      <h3 class="ml-derived-h">ظهور في محتوى مولَّد (${evidence.derived.length})</h3>
      <p class="field-hint">
        دي مادّة تعليمية اتولدت من نصوصك — <b>مش مواقف حقيقية</b>،
        ومش بتزوّد الرقم اللي فوق.
      </p>
      ${raw(evidence.derived.length ? html`
        <ul class="ml-cites ml-cites-derived">${raw(evidence.derived.map(cite).join(''))}</ul>`
    : '<p class="field-hint">مفيش.</p>')}

      ${raw(evidence.unknown.length ? html`
      <h3 class="mr-warn">في مصادر لسه غير محدَّدة (${evidence.unknown.length})</h3>
      <p class="field-hint">
        صنّف المصادر دي من «راجع وصدّر ذاكرة اللغة» عشان تتحسب صح.
      </p>
      <ul class="ml-cites">${raw(evidence.unknown.map(cite).join(''))}</ul>` : '')}

      <!-- ══ الطبقةُ ج: تاريخُك أنت ══ -->
      <h3>تاريخك مع العنصر ده</h3>
      <div class="mr-sum">
        <span>حفظتها: <b>${one.saved}</b></span>
        <span>اتدرّبت: <b>${one.practised}</b></span>
        <span>من الشادوينج: <b>${one.shadowed}</b></span>
        <span>غلطات: <b>${one.errors}</b></span>
      </div>
      <p class="field-hint">
        ⚠️ الحفظ والتدريب <b>مش</b> بيزوّدوا المواقف الحقيقية، ولا
        بيعنوا إتقان — دول أفعال منك بيتسجّلوا باسمهم.
      </p>
      ${raw(memory?.captures?.length ? html`
        <ul class="ml-events">
          ${raw(memory.captures.map((c) => html`
            <li>حفظتها ${formatDate(c.at)}${raw(c.note ? html` · ${c.note}` : '')}</li>`).join(''))}
        </ul>` : '')}
      ${raw(memory?.practices?.length ? html`
        <ul class="ml-events">
          ${raw(memory.practices.slice(0, 20).map((p) => html`
            <li>اتدرّبت ${formatDate(p.at)} · ${p.repetitions || 1} مرة${raw(p.source ? html` · ${p.source}` : '')}</li>`).join(''))}
        </ul>` : '')}
      ${raw(memory?.errors?.length ? html`
        <ul class="ml-events ml-events-bad">
          ${raw(memory.errors.map((e) => html`
            <li><span dir="ltr" lang="ru">${e.wrong}</span> ← <span dir="ltr" lang="ru">${e.natural}</span></li>`).join(''))}
        </ul>` : '')}

      <!-- ══ العلاقات ══ -->
      <h3>الصيغ والعائلة</h3>
      <div class="ml-forms">
        <div>
          <h5>صيغ شفناها في نصوصك (${rel.forms.observed.length})</h5>
          ${raw(rel.forms.observed.length ? rel.forms.observed.map((f) => html`
            <span class="ml-tag" dir="ltr" lang="ru">${f}</span>`).join('')
    : '<p class="field-hint">ولا واحدة لسه.</p>')}
        </div>
        <div>
          <h5>صيغ التحليل ذكرها وما شفناهاش (${rel.forms.unseen.length})</h5>
          ${raw(rel.forms.unseen.length ? rel.forms.unseen.map((f) => html`
            <span class="ml-tag mr-dim" dir="ltr" lang="ru">${f}</span>`).join('')
    : '<p class="field-hint">ولا واحدة.</p>')}
        </div>
      </div>

      ${raw(rel.family.length ? html`
        <h5>نفس العائلة (${one.familyId})</h5>
        <div class="ml-rel">
          ${raw(rel.family.map((other) => html`
            <button type="button" class="ml-tag" data-action="ml-open" data-key="${other.key}"
                    dir="ltr" lang="ru">${other.lemma}</button>`).join(''))}
        </div>` : '')}

      ${raw(rel.senses.length ? html`
        <h5>معاني تانية لنفس المفردة</h5>
        <div class="ml-rel">
          ${raw(rel.senses.map((other) => html`
            <button type="button" class="ml-tag" data-action="ml-open" data-key="${other.key}">
              ${other.senseLabel || other.senseId || other.key}</button>`).join(''))}
        </div>` : '')}
    </section>`;
}

/* ------------------------------------------------------------------ *
 * الأفعال
 * ------------------------------------------------------------------ */

/** ما يصفّيه كلُّ مربّعٍ في الأعلى. */
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

const reset = () => {
  for (const f of FACETS) state.query[f.id] = [];
  state.query.family = null;
  state.top = 0;
};

export async function handleMyLanguageAction(action, target) {
  const main = $('#app-main');

  if (action === 'go-my-language') { navigate('/my-language'); return true; }

  if (action === 'ml-open') {
    navigate(`/my-language/${encodeURIComponent(target.dataset.key)}`);
    return true;
  }

  if (action === 'ml-total') {
    const id = target.dataset.total;
    if (id === 'families' || id === 'forms') {
      /*
       * ⚠️ **ورقمٌ لا يفتح شيئًا يقول ذلك بدل أن يصمت.** العائلاتُ
       *    والصيغُ ليست عناصرَ في القائمة بل صفاتٌ عليها، فتصفيتُها
       *    كقائمةٍ تعطي شاشةً فارغةً تبدو عطبًا. فنقولها ونوجّه إلى
       *    الوجه الذي يفتحها فعلًا.
       */
      state.openFacet = id === 'families' ? 'type' : 'type';
      toast(id === 'families'
        ? 'العائلات صفة على العناصر — افتح أي مفردة تلاقي عيلتها جوّه'
        : 'الصيغ بتتعرض جوّه صفحة المفردة نفسها');
      if (main) await renderMyLanguage(main);
      return true;
    }
    reset();
    Object.assign(state.query, TOTAL_QUERY[id] || {});
    if (main) await renderMyLanguage(main);
    return true;
  }

  if (action === 'ml-facet') {
    state.openFacet = target.dataset.facet;
    if (main) await renderMyLanguage(main);
    return true;
  }

  if (action === 'ml-pick') {
    const { facet, value } = target.dataset;
    const picked = state.query[facet] || [];
    state.query[facet] = picked.includes(value)
      ? picked.filter((one) => one !== value)
      : [...picked, value];
    state.top = 0;
    if (main) await renderMyLanguage(main);
    return true;
  }

  if (action === 'ml-clear') {
    reset();
    state.query.search = '';
    if (main) await renderMyLanguage(main);
    return true;
  }

  if (action === 'ml-rebuild') {
    invalidateLanguageIndex();
    if (main) await renderMyLanguage(main);
    return true;
  }

  return false;
}

/** يربط البحثَ والترتيب — حقولٌ حيّةٌ لا أزرارُ فعل. */
export function wireMyLanguage(main) {
  main.addEventListener('input', async (event) => {
    const box = event.target.closest('[data-ml-search]');
    if (!box) return;
    state.query.search = box.value;
    state.top = 0;
    const built = cachedLanguage();
    if (!built) return;
    /*
     * ⚠️ **ولا يُعاد بناءُ الفهرس عند كلّ حرف.** الفهرسُ محفوظ،
     *    والبحثُ تصفيةٌ فوقه — فالكتابةُ لا تلمس القاعدة.
     */
    const rows = queryLanguage(built, state.query);
    const host = main.querySelector('.ml-list')?.parentElement;
    if (!host) return;
    const at = main.querySelector('[data-ml-list]');
    const count = main.querySelector('.ml-count');
    if (at && count) {
      at.outerHTML = rows.length ? listHtml(rows).split('<p class="ml-count">')[0] : '';
      count.innerHTML = `${rows.length.toLocaleString('en')} عنصر`;
      wireList(main, rows);
    }
  });

  main.addEventListener('change', async (event) => {
    const sel = event.target.closest('[data-ml-sort]');
    if (!sel) return;
    state.query.sort = sel.value;
    state.top = 0;
    await renderMyLanguage(main).catch((error) => toastError(error.message));
  });
}

/**
 * LingoLife — نهر الزمن وشاشة اليوم
 *
 * ═══════════════════════════════════════════════════════════════
 * ما الذي يجعله «نهرًا» لا قائمةً أخرى؟
 * ═══════════════════════════════════════════════════════════════
 *
 * «حياتي» تجمع بالشهر وتعرض بطاقاتٍ في شبكة — تجيب «إيه اللي حصل في
 * مايو؟». والنهر يجيب سؤالًا آخر: **«إيه اللي حصل بعد إيه، وقد إيه
 * كان بينهم؟»**
 *
 * ولذلك وحدته **اليوم** لا الذكرى، و**الفجوة جزءٌ من العرض لا فراغ
 * بينه**: «بعد ٤٧ يومًا» ليست حشوًا — هي الشهر ونصف الذي لم تسجّل فيه
 * شيئًا، وهي معلومةٌ عنك.
 *
 * ⚠️ **العرض الأوّل عمليّ بقصد.** لا رسمَ متحرّكًا ولا خطًّا منحنيًا
 *    ولا كوكبة. أوّلًا يصحّ التنقّل والربط — تضغط يومًا فتصل إليه،
 *    وتضغط مرشّحًا فيرشّح فعلًا — ثم يأتي الخيال البصري فوق أساسٍ
 *    ثابت. الترتيب المعكوس يُنتج شيئًا جميلًا لا يُتنقَّل فيه.
 *
 * وكل ما هنا يقرأ من `atlas-service` — أي من `scenes` والعلاقات كما
 * هي. **لا نسخةَ بيانات ولا عالمَ ثانٍ.**
 */

import { html, raw, $ } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { navigate } from '../router.js';
import { formatDate, formatMonth, monthKey, dayCount, relativeDate, toISODate } from '../utils/dates.js';
import { typeLabel } from '../services/type-service.js';
import { getPerson } from '../services/person-service.js';
import { getThread, THREAD_STATUS_LABEL } from '../services/thread-service.js';
import {
  AXIS, ABSENT_AXES, riverPage, dayDetail, adjacentDays, continuingStories,
  listLenses, saveLens, removeLens,
} from '../services/atlas-service.js';
import { toastOk, toastError } from '../components/toast.js';

/**
 * حالة التصفّح.
 *
 * ⚠️ المرشّحات هنا لا في الرابط — عمدًا في هذه النسخة. رابطٌ يحمل
 *    الحالة أفضل للمشاركة، لكنه يحتاج تسلسلًا وفكّه واختبارًا، وقبل
 *    أن يثبت أن التنقّل صحيح لا معنى لمشاركته. مُسجَّلٌ للنسخة
 *    التالية.
 */
let state = { days: [], hasMore: false, cursor: null, filters: {}, loading: false };

export function resetRiver() {
  state = { days: [], hasMore: false, cursor: null, filters: {}, loading: false };
}

/* ------------------------------------------------------------------ *
 * قطع مشتركة
 * ------------------------------------------------------------------ */

/** بطاقة ذكرى داخل يوم — مختصرة: النهر للتصفّح لا للقراءة. */
function sceneRow(scene) {
  const facets = scene.facets || {};
  return html`
    <button class="rv-scene" data-action="open-scene" data-id="${scene.id}">
      <span class="rv-scene-title"><bdi>${scene.titleAr || scene.titleRu || 'بلا عنوان'}</bdi></span>
      <span class="rv-scene-meta">
        <span class="rv-tag">${typeLabel(facets.typeId || scene.type)}</span>
        ${raw(facets.placeName
          ? html`<span class="rv-tag is-plain">${raw(icon('place', 13))} <bdi>${facets.placeName}</bdi></span>`
          : '')}
        ${raw(facets.personIds?.length
          ? html`<span class="rv-tag is-plain">${raw(icon('person', 13))} ${facets.personIds.length}</span>`
          : '')}
        ${raw(facets.threadIds?.length
          ? html`<span class="rv-tag is-thread">${raw(icon('link', 13))} ${
              facets.threadIds.length === 1 ? 'في خيط' : `في ${facets.threadIds.length} خيوط`
            }</span>`
          : '')}
      </span>
    </button>`;
}

/**
 * الفجوة بين يومين.
 *
 * ⚠️ تُعرَض **بين** اليومين لا داخل أحدهما، لأنها تخصّ المسافة لا
 *    الطرف. وبلا فجوة (يومان متتاليان) لا يُرسم شيء — سطرٌ يقول «بعد
 *    يوم» على كل يومٍ يحوّل المعلومة إلى ضجيج.
 */
function gapRow(days) {
  if (!days || days <= 1) return '';
  const loud = days >= 30;
  return html`
    <div class="rv-gap${loud ? ' is-long' : ''}">
      <span>${dayCount(days)}${loud ? ' بلا تسجيل' : ''}</span>
    </div>`;
}

/**
 * «اليوم» / «أمس» / «منذ ٣ أيام» — أو لا شيء.
 *
 * ⚠️ `relativeDate` تعود بالتاريخ الكامل لما تجاوز أسبوعًا، فيُطبَع
 *    التاريخ مرّتين متجاورتين: «٣٠ مارس ٢٠٢٦ · ٣٠ مارس ٢٠٢٦». فلا
 *    نعرضها إلا حين تقول شيئًا لا يقوله التاريخ.
 */
function nearLabel(date) {
  const relative = relativeDate(date);
  return relative && relative !== formatDate(date) ? relative : '';
}

function dayBlock(day, monthLabel) {
  return html`
    ${raw(monthLabel ? html`<h2 class="rv-month">${monthLabel}</h2>` : '')}
    <section class="rv-day">
      <button class="rv-day-head" data-action="open-day" data-date="${day.date}">
        <span class="rv-day-date">${formatDate(day.date)}</span>
        <span class="rv-day-rel">${nearLabel(day.date)}</span>
        <span class="rv-day-count">${day.scenes.length}</span>
      </button>
      ${raw(day.scenes.map(sceneRow).join(''))}
    </section>
    ${raw(gapRow(day.gapDays))}`;
}

/* ------------------------------------------------------------------ *
 * شريط المرشّحات
 * ------------------------------------------------------------------ */

/**
 * ما يُصفّى عليه الآن.
 *
 * ⚠️ يعرض **المُفعَّل فقط**، لا قائمة كل القيم الممكنة. المرشّح يُلتقَط
 *    من حيث تراه — تضغط نوعًا في بطاقة فيُصفّى عليه — وهو أقرب لما
 *    تفعله فعلًا من قائمةٍ تفتحها وتبحث فيها. وأشجار المحاور الكاملة
 *    شاشةٌ قادمة في WS4.
 */
async function filterBar(filters) {
  const chips = [];

  if (filters[AXIS.TYPE]) {
    chips.push({ axis: AXIS.TYPE, label: typeLabel(filters[AXIS.TYPE]), icon: 'star' });
  }
  if (filters[AXIS.PLACE]) {
    chips.push({ axis: AXIS.PLACE, label: filters.placeLabel || filters[AXIS.PLACE], icon: 'place' });
  }
  if (filters[AXIS.PERSON]) {
    const person = await getPerson(filters[AXIS.PERSON]);
    chips.push({ axis: AXIS.PERSON, label: person?.name || 'شخص', icon: 'person' });
  }
  if (filters[AXIS.THREAD]) {
    const thread = await getThread(filters[AXIS.THREAD]);
    chips.push({ axis: AXIS.THREAD, label: thread?.title || 'خيط', icon: 'link' });
  }

  if (!chips.length) return '';

  return html`
    <div class="rv-filters">
      <span class="rv-filters-head">بتشوف بس:</span>
      ${raw(chips.map((chip) => html`
        <button class="rv-chip" data-action="river-unfilter" data-axis="${chip.axis}">
          ${raw(icon(chip.icon, 14))} <bdi>${chip.label}</bdi>
          <span class="rv-chip-x">${raw(icon('close', 12))}</span>
        </button>`).join(''))}
      <button class="rv-chip is-clear" data-action="river-clear">امسح الكل</button>
      <!--
        العدسة سؤالٌ تكرّر عليك فحفظتَه: «شغلي مع إيجور»، «كل مرّة رحت
        فيها المصلحة». تُحفَظ بالاسم الذي تعرفها به أنت.
      -->
      <button class="rv-chip is-save" data-action="river-save-lens">
        ${raw(icon('star', 13))} احفظها كعدسة
      </button>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * النهر
 * ------------------------------------------------------------------ */

/**
 * القصص المكمّلة — «إيه اللي لسه مفتوح؟» في أعلى النهر.
 *
 * ⚠️ **مرتّبةٌ بطول السكوت لا بالتاريخ.** قضيّةٌ لم يقع فيها شيءٌ منذ
 *    شهرين أحقّ بانتباهك من واحدةٍ تحرّكت أمس — وهي بالضبط التي
 *    تنساها. والترتيب هو الفكرة كلّها، لا الزينة.
 *
 * ⚠️ ولا تظهر مع مرشّحٍ مفعَّل: أنت وقتها تتصفّح شيئًا بعينه، وقائمةُ
 *    ما هو مفتوحٌ عمومًا مقاطعةٌ لا مساعدة.
 */
async function storiesStrip() {
  const stories = await continuingStories();
  if (!stories.length) return '';

  return html`
    <section class="rv-stories">
      <h3>${raw(icon('link', 16))} لسه مكمّلة</h3>
      ${raw(stories.map((story) => html`
        <button class="rv-story" data-action="river-by-thread" data-id="${story.id}">
          <span class="rv-story-title"><bdi>${story.title}</bdi></span>
          <span class="rv-story-meta">
            ${story.daysSince === null
              ? 'لسه مفيش أحداث'
              : story.daysSince === 0
                ? 'اتحرّكت النهارده'
                : `ساكتة من ${dayCount(story.daysSince)}`}
            · ${story.count} ${
              story.count === 1 ? 'حدث'
              : story.count === 2 ? 'حدثان'
              : story.count <= 10 ? 'أحداث'
              : 'حدثًا'
            }
          </span>
        </button>`).join(''))}
    </section>`;
}

/**
 * العدسات المحفوظة — أسئلتك المتكرّرة، بأسمائك أنت.
 *
 * ⚠️ **ولا عدسةَ مدمجة.** جرّبتُ إضافة «الشغل» و«اليوميّات» جاهزتين،
 *    فوجدتُهما تحتاجان قرارًا لستُ صاحبه: أيّ الأنواع «شغل»؟ «فحص»
 *    شغلٌ عندك وقد لا يكون عند غيرك. وتصنيفٌ اخترعتُه لك يبدو معلومةً
 *    عنك وهو تخمينٌ منّي (بند 89).
 */
async function lensStrip() {
  const lenses = await listLenses();
  if (!lenses.length) return '';

  return html`
    <div class="rv-lenses">
      <span class="rv-filters-head">عدساتك:</span>
      ${raw(lenses.map((lens) => html`
        <span class="rv-lens">
          <button class="rv-lens-open" data-action="river-lens" data-id="${lens.id}">
            <bdi>${lens.name}</bdi>
          </button>
          <button class="rv-lens-del" data-action="river-lens-remove" data-id="${lens.id}"
                  aria-label="امسح العدسة">${raw(icon('close', 12))}</button>
        </span>`).join(''))}
    </div>`;
}

export async function renderRiver(main) {
  if (!state.days.length && !state.loading) await loadMore({ reset: true });

  const bar = await filterBar(state.filters);
  const stories = bar ? '' : await storiesStrip();
  const lenses = bar ? '' : await lensStrip();
  const empty = !state.days.length;

  let lastMonth = null;
  const blocks = state.days.map((day) => {
    const key = monthKey(day.date);
    const label = key !== lastMonth ? formatMonth(day.date) : null;
    lastMonth = key;
    return dayBlock(day, label);
  });

  main.innerHTML = html`
    <div class="view-head rv-head">
      <div>
        <h1>نهر الزمن</h1>
        <div class="sub">حياتك بترتيبها — وبالمسافات اللي بينها</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="go-facets">
        ${raw(icon('life', 15))} المحاور
      </button>
    </div>

    ${raw(bar)}
    ${raw(lenses)}
    ${raw(stories)}

    ${raw(empty ? emptyState(Boolean(bar)) : html`
      <div class="rv-river">${raw(blocks.join(''))}</div>
      ${raw(state.hasMore
        ? html`<button class="btn btn-ghost btn-block" data-action="river-more">
            ${raw(icon('refresh', 16))} حمّل أقدم
          </button>`
        : html`<div class="rv-end">دي البداية — مفيش أقدم من كده</div>`)}
    `)}

    ${raw(absentNote())}`;
}

function emptyState(filtered) {
  return html`
    <div class="empty-state">
      <div class="glyph">${raw(icon('life'))}</div>
      <h2>${filtered ? 'مفيش حاجة بالمواصفات دي' : 'النهر لسه فاضي'}</h2>
      <p>${filtered
        ? 'جرّب تشيل واحد من المرشّحات.'
        : 'أول ما تسجّل ذكرى هتلاقيها هنا بترتيبها الزمني.'}</p>
      ${raw(filtered
        ? html`<button class="btn btn-ghost" data-action="river-clear">امسح المرشّحات</button>`
        : html`<button class="btn btn-primary" data-action="new-scene">سجّل ذكرى</button>`)}
    </div>`;
}

/**
 * ما لا محورَ له — مُعلَنًا لا مسكوتًا عنه.
 *
 * ⚠️ نفس مبدأ «ما لا يستوعبه الاستيراد يُعلَن»: مرشّحٌ غائب بلا سبب
 *    يبدو نقصًا في الشاشة، ومرشّحٌ حاضرٌ يرجّع صفرًا دائمًا أسوأ.
 */
function absentNote() {
  const items = Object.entries(ABSENT_AXES);
  if (!items.length) return '';
  return html`
    <details class="rv-absent">
      <summary>ليه مفيش تصفية بالموضوع أو الرحلة؟</summary>
      ${raw(items.map(([, reason]) => html`<p>${reason}</p>`).join(''))}
    </details>`;
}

async function loadMore({ reset = false } = {}) {
  state.loading = true;
  const page = await riverPage({
    before: reset ? null : state.cursor,
    filters: state.filters,
  });
  state.days = reset ? page.days : [...state.days, ...page.days];
  state.hasMore = page.hasMore;
  state.cursor = page.cursor;
  state.loading = false;
}

/* ------------------------------------------------------------------ *
 * شاشة اليوم
 * ------------------------------------------------------------------ */

export async function renderDay(main, date) {
  const key = toISODate(date);
  const [detail, around] = await Promise.all([dayDetail(key), adjacentDays(key)]);

  if (!detail || !detail.scenes.length) {
    main.innerHTML = html`
      ${raw(dayNav(key, around))}
      <div class="empty-state">
        <div class="glyph">${raw(icon('calendar'))}</div>
        <h2>مفيش حاجة مسجّلة في اليوم ده</h2>
        <p>${formatDate(key)}</p>
        <button class="btn btn-ghost" data-action="go-river">ارجع للنهر</button>
      </div>`;
    return;
  }

  const threads = (await Promise.all(detail.threadIds.map(getThread))).filter(Boolean);

  main.innerHTML = html`
    ${raw(dayNav(key, around))}

    <div class="view-head">
      <h1>${formatDate(key)}</h1>
      <div class="sub">${nearLabel(key) || `${detail.scenes.length === 1 ? 'موقف واحد' : 'مواقف'} في اليوم ده`}</div>
    </div>

    <div class="card rv-day-stats">
      ${raw(stat(detail.scenes.length, 'ذكرى', 'ذكريتان', 'ذكريات'))}
      ${raw(stat(detail.people.length, 'شخص', 'شخصان', 'أشخاص'))}
      ${raw(stat(detail.conversationParts, 'جملة', 'جملتان', 'جُمل'))}
      ${raw(stat(detail.expressions.length, 'تعبير', 'تعبيران', 'تعبيرات'))}
      ${raw(stat(detail.mistakes, 'تصحيح', 'تصحيحان', 'تصحيحات'))}
    </div>

    <section class="rv-section">
      <h3>اللي حصل</h3>
      ${raw(detail.scenes.map(sceneRow).join(''))}
    </section>

    ${raw(threads.length ? html`
      <section class="rv-section">
        <h3>خيوط مكمّلة</h3>
        ${raw(threads.map((thread) => html`
          <a class="rv-line" href="#/thread/${thread.id}">
            ${raw(icon('link', 15))}
            <bdi>${thread.title}</bdi>
            <span class="rv-tag">${THREAD_STATUS_LABEL[thread.status] || thread.status}</span>
          </a>`).join(''))}
      </section>` : '')}

    ${raw(detail.people.length ? html`
      <section class="rv-section">
        <h3>اتكلّمت مع</h3>
        <div class="rv-people">
          ${raw(detail.people.map((person) => html`
            <button class="rv-person" data-action="river-by-person" data-id="${person.id}">
              ${raw(icon('person', 15))} <bdi>${person.name}</bdi>
            </button>`).join(''))}
        </div>
        <p class="rv-hint">
          دول اللي اتكلّموا في المحادثة. مين حضر وما اتكلّمش مش هيبان —
          مفيش مصدر يقوله.
        </p>
      </section>` : '')}

    ${raw(detail.expressions.length ? html`
      <section class="rv-section">
        <h3>تعبيرات ظهرت</h3>
        <div class="rv-exprs">
          ${raw(detail.expressions.map((expression) => html`
            <span class="rv-expr" dir="ltr" lang="ru">${expression.text}</span>`).join(''))}
        </div>
      </section>` : '')}

    ${raw(detail.practice ? html`
      <section class="rv-section">
        <h3>ممارسة</h3>
        <div class="rv-line is-plain">
          ${raw(icon('waveform', 15))}
          ${detail.practice} ${detail.practice === 1 ? 'جلسة ظلّ' : 'جلسات ظلّ'} في اليوم ده
        </div>
        <p class="rv-hint">جلسةٌ حصلت — مش إتقان.</p>
      </section>` : '')}`;
}

/**
 * رقمٌ واسمه بالصيغة الموافقة — والصفر لا يُعرَض أصلًا.
 *
 * ⚠️ الصيغ الثلاث تُمرَّر كاملةً ولا تُشتقّ. جرّبتُ اشتقاق المثنّى
 *    بإلحاق «ين» فخرج «٢ ذكرىين»: العربيّة لا تُجمَع بلصق حرفين،
 *    و«ذكرى» مقصورةٌ تصير «ذكريتين». ولا قاعدةَ عامّة تُغني عن
 *    الكتابة الصريحة.
 */
function stat(n, one, two, few) {
  if (!n) return '';
  const label = n === 1 ? one : n === 2 ? two : n <= 10 ? few : one;
  return html`
    <div class="rv-stat">
      <b>${n}</b>
      <span>${label}</span>
    </div>`;
}

/**
 * سهما اليوم.
 *
 * ⚠️ يقفزان لأقرب يومٍ **فيه شيء** لا لليوم التقويمي: حياةٌ فيها فجوة
 *    شهرٍ تعني ثلاثين ضغطةً على شاشاتٍ فارغة.
 */
function dayNav(date, around) {
  return html`
    <div class="rv-daynav">
      <button class="rv-nav-btn" data-action="open-day" data-date="${around.older || ''}"
              ${around.older ? '' : 'disabled'}>
        ${raw(icon('back', 16))} الأقدم
      </button>
      <button class="rv-nav-btn is-mid" data-action="go-river">
        ${raw(icon('life', 16))} النهر
      </button>
      <button class="rv-nav-btn" data-action="open-day" data-date="${around.newer || ''}"
              ${around.newer ? '' : 'disabled'}>
        الأحدث ${raw(icon('back', 16))}
      </button>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * الأفعال — تُستدعى من `app.js`
 * ------------------------------------------------------------------ */

async function rerender() {
  const main = $('#app-main');
  if (main) await renderRiver(main);
}

/** يفتح النهر مُصفّى على محور — المدخل الذي تستعمله كل شاشةٍ أخرى. */
export function riverFilteredBy(axis, value, label = '') {
  state = {
    days: [], hasMore: false, cursor: null, loading: false,
    filters: { [axis]: value, ...(axis === AXIS.PLACE ? { placeLabel: label } : {}) },
  };
  navigate('/river');
}

export async function handleRiverAction(action, target) {
  if (action === 'go-river') {
    navigate('/river');
    return true;
  }

  if (action === 'open-day') {
    const date = target?.dataset.date;
    if (date) navigate(`/day/${date}`);
    return true;
  }

  if (action === 'river-more') {
    await loadMore();
    await rerender();
    return true;
  }

  if (action === 'river-unfilter') {
    const axis = target?.dataset.axis;
    delete state.filters[axis];
    if (axis === AXIS.PLACE) delete state.filters.placeLabel;
    await loadMore({ reset: true });
    await rerender();
    return true;
  }

  if (action === 'river-clear') {
    state.filters = {};
    await loadMore({ reset: true });
    await rerender();
    return true;
  }

  if (action === 'river-by-person') {
    riverFilteredBy(AXIS.PERSON, target?.dataset.id);
    return true;
  }

  if (action === 'river-by-thread') {
    riverFilteredBy(AXIS.THREAD, target?.dataset.id);
    return true;
  }

  if (action === 'river-by-type') {
    riverFilteredBy(AXIS.TYPE, target?.dataset.id);
    return true;
  }

  /*
   * المدخل من شاشة المحاور — محورٌ واحدٌ لكل الأشجار.
   *
   * ⚠️ الرقم في الشجرة وعدٌ بأنك ستجد ذلك العدد، والضغط هو الوفاء به
   *    (بند 66). ولذلك يمرّ من هنا لا من شاشة المحاور: المرشّح شكلٌ
   *    واحد يفهمه النهر، فلا تنشأ صيغتان لنفس المعنى.
   */
  if (action === 'facet-open') {
    const { axis, id, label } = target?.dataset || {};
    if (axis && id) riverFilteredBy(axis, id, label);
    return true;
  }

  if (action === 'go-facets') {
    navigate('/facets');
    return true;
  }

  /* ---- العدسات ---- */

  if (action === 'river-save-lens') {
    // ⚠️ `prompt` عمدًا: الاسم سطرٌ واحد، ونافذةٌ كاملة له كلفةٌ بلا
    //    مقابل. ولو احتاجت العدسة وصفًا أو لونًا صارت نافذة.
    const name = window.prompt('اسم العدسة — إيه السؤال اللي بتجاوبه؟');
    if (name === null) return true;
    try {
      await saveLens(name, state.filters);
      toastOk(`«${name.trim()}» اتحفظت — هتلاقيها فوق النهر`);
    } catch (error) {
      toastError(error.message);
    }
    await rerender();
    return true;
  }

  if (action === 'river-lens') {
    const lens = (await listLenses()).find((row) => row.id === target?.dataset.id);
    if (!lens) return true;
    state.filters = { ...lens.filters, ...(lens.placeLabel ? { placeLabel: lens.placeLabel } : {}) };
    await loadMore({ reset: true });
    await rerender();
    return true;
  }

  if (action === 'river-lens-remove') {
    await removeLens(target?.dataset.id);
    await rerender();
    return true;
  }

  return false;
}

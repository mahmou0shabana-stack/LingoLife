/**
 * LingoLife — استوديو الإثراء: تلحق بذكرياتك القديمة
 *
 * ═══════════════════════════════════════════════════════════════
 * أربع مراحل لا خامسة: اختار الوجه ← حدّد ← عايِن ← اكتب
 * ═══════════════════════════════════════════════════════════════
 *
 * الشاشة تجيب أربعة أسئلة بالترتيب، ولا تسأل السؤال التالي قبل أن
 * تُجيب الذي قبله:
 *
 *  · **إيه الناقص، وفين؟** خريطةُ نقصٍ بأرقامٍ حقيقيّة، ومع كل وجهٍ
 *    **متى دخل النموذج** — لأن الفراغ أثرُ تطوّرٍ لا أثرُ إهمال،
 *    والتطبيق لا يقول لك «كان لازم تلتقط ده من الأول».
 *  · **مين بالظبط؟** قائمةٌ كلُّ صفٍّ فيها يحمل **دليله** — مَن
 *    تكلّم فيه، وفي أي قصّة هو. تقرأ السطر فتعرف بلا أن تفتح.
 *  · **هيحصل إيه؟** قبل ← بعد لكل صفّ، وما لن يتغيّر مُعلَنٌ أنه
 *    كذلك، ومعه **الأثر**: كان في كام، وهيبقى في كام.
 *  · **حصل إيه؟** تقريرٌ من المكتوب فعلًا، ومعه تراجع.
 *
 * ⚠️ **ولا رقمَ هنا بلا مصدر.** كل عددٍ يُحسَب لحظةَ عرضه من الصفوف
 *    المحدَّدة — تشيل صفًّا ينزل الرقم واحدًا (بند 89).
 */

import { html, raw, $, $$ } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { confirmAction } from '../components/modal.js';
import { navigate } from '../router.js';
import { plural, counted } from '../utils/plural.js';
import { listPeople } from '../services/person-service.js';
import { listTypes } from '../services/type-service.js';
import { listThreads } from '../services/thread-service.js';
import { NOT_BULK_EDITABLE, FILL } from '../services/studio/aspects.js';
import { censusGaps, workingSet, COHORTS } from '../services/studio/census.js';
import { planBatch, applyBatch, LARGE_BATCH } from '../services/studio/batch.js';

/**
 * حالة الشاشة.
 *
 * ⚠️ خارج الـDOM عمدًا — نفس درس شاشة الاستيراد: الشاشة تُعاد كتابتها
 *    عند كل تبديل خانة، فحالةٌ تعيش في الـDOM تضيع مع أول إعادة رسم.
 */
let state = null;

const blank = () => ({
  stage: 'map',
  aspectId: null,
  cohort: 'all',
  query: '',
  picked: new Set(),
  value: null,
  plan: null,
  report: null,
  /** أُعيد جمعها عند كل دخول: القاعدة تتغيّر من شاشاتٍ أخرى. */
  census: null,
  set: null,
  options: { people: [], types: [], threads: [], places: [] },
});

export function resetStudio() {
  state = null;
}

/* ================================================================== */
/* الرسم                                                              */
/* ================================================================== */

export async function renderStudio(main) {
  if (!state) state = blank();
  main.innerHTML = html`<div class="spinner"></div>`;

  if (state.stage === 'map') return drawMap(main);
  if (state.stage === 'pick') return drawPick(main);
  if (state.stage === 'preview') return drawPreview(main);
  return drawReport(main);
}

function header(subtitle) {
  return html`
    <header class="st-head">
      <div>
        <h1>استوديو الإثراء</h1>
        <p class="st-sub">${subtitle}</p>
      </div>
      ${raw(state.stage === 'map' ? '' : html`
        <button class="btn btn-ghost" data-studio="back">${raw(icon('back'))} رجوع</button>`)}
    </header>`;
}

/* ------------------------------------------------------------------ *
 * ١ · الخريطة
 * ------------------------------------------------------------------ */

async function drawMap(main) {
  const census = await censusGaps();
  state.census = census;

  const anything = census.aspects.some((row) => row.missing > 0);

  main.innerHTML = html`
    ${raw(header('نموذج ذكرياتك بيكبر — والاستوديو بيخلّيك تلحق بالقديم بدون ما تفتحه واحدة واحدة'))}

    ${raw(census.total === 0 ? html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('sparkle'))}</div>
        <h2>مفيش ذكريات لسه</h2>
        <p>الاستوديو بيشتغل على اللي عندك — سجّل ذكرى الأول.</p>
      </div>` : html`

      <div class="st-note">
        ${raw(icon('info'))}
        <p>
          الفراغ هنا <strong>مش إهمال منك</strong> — التطبيق نفسه ما كانش
          بيعرف يسأل عن الحاجات دي وقت ما سجّلت. كل وجه مكتوب جنبه إمتى
          دخل النموذج.
        </p>
      </div>

      <div class="st-map">
        ${raw(census.aspects.map(aspectCard).join(''))}
      </div>

      ${raw(anything ? '' : html`
        <div class="st-done">
          ${raw(icon('check'))}
          <p>كل الأوجه مليانة. مفيش حاجة ناقصة دلوقتي.</p>
        </div>`)}

      <section class="st-refuse">
        <h2>${raw(icon('info'))} اللي الاستوديو بيرفض يعدّله دفعة واحدة</h2>
        <p class="st-sub">
          مش «لسه ما اتعملش» — دي حاجات <strong>مش صح</strong> تتغيّر
          جماعيًّا، وأداة بتسمح بيها بتسهّل عليك تخرّب ذاكرتك في ضغطة.
        </p>
        <ul class="st-refuse-list">
          ${raw(Object.values(NOT_BULK_EDITABLE).map((row) => html`
            <li><strong>${row.label}</strong><span>${row.reason}</span></li>`).join(''))}
        </ul>
      </section>`)}`;
}

function aspectCard(row) {
  const total = row.missing + row.filled;
  const pct = total ? Math.round((row.filled / total) * 100) : 100;
  return html`
    <button class="st-card${row.missing ? '' : ' is-done'}"
            data-studio="aspect" data-id="${row.id}"
            ${row.missing ? '' : 'disabled'}>
      <div class="st-card-top">
        <span class="st-card-label">${row.label}</span>
        <span class="st-since" title="دخل النموذج في ${row.since}">${row.since}</span>
      </div>

      <div class="st-count">
        ${raw(row.missing
          ? html`<strong>${row.missing}</strong> <span>${plural(row.missing, 'ذكرى', 'ذكرتين', 'ذكريات')} ناقصة</span>`
          : html`<strong class="ok">تمام</strong> <span>مفيش ناقص</span>`)}
      </div>

      <div class="st-bar" role="img"
           aria-label="${row.filled} من ${total} مليانة">
        <span style="inline-size:${pct}%"></span>
      </div>
      <div class="st-bar-note">${row.filled} من ${total} مليانة</div>

      <p class="st-why">${row.why}</p>

      ${raw(row.missing && row.withEvidence ? html`
        <p class="st-hint">
          ${raw(icon('sparkle'))}
          ${counted(row.withEvidence, 'واحدة', 'اتنين', 'ذكريات')} منهم عندنا
          عنها دليل — تتملّي من غير ما تفتحها
        </p>` : '')}

      ${raw(row.bulk ? '' : html`
        <p class="st-hint is-warn">${raw(icon('info'))} ${row.bulkReason}</p>`)}
    </button>`;
}

/* ------------------------------------------------------------------ *
 * ٢ · التحديد
 * ------------------------------------------------------------------ */

async function drawPick(main) {
  const set = await workingSet(state.aspectId, {
    cohort: state.cohort,
    query: state.query,
  });
  state.set = set;
  await loadOptions(set.world);

  // صفٌّ اختفى من الشريحة يخرج من المحدَّد — وإلّا وعد الرقمُ بما لا يفي.
  const visible = new Set(set.rows.map((row) => row.id));
  for (const id of [...state.picked]) if (!visible.has(id)) state.picked.delete(id);

  const aspect = set.aspect;
  const n = state.picked.size;

  main.innerHTML = html`
    ${raw(header(aspect.why))}

    ${raw(aspect.bulk ? '' : html`
      <div class="st-note is-warn">
        ${raw(icon('info'))}
        <p><strong>${aspect.label}</strong> مايتكتبش دفعة واحدة — ${aspect.bulkReason}.
        الاستوديو بيعدّها ويوَدّيك لها، وإنت بتكتب كل واحدة بنفسك.</p>
      </div>`)}

    <div class="st-cohorts">
      ${raw(COHORTS.map((slice) => html`
        <button class="chip${state.cohort === slice.id ? ' is-on' : ''}"
                data-studio="cohort" data-id="${slice.id}"
                title="${slice.hint}">
          ${slice.label} <span class="chip-n">${set.counts[slice.id] ?? 0}</span>
        </button>`).join(''))}
      <input class="st-search" type="search" data-studio="query"
             placeholder="دوّر بالعنوان…" value="${state.query}" />
    </div>

    ${raw(aspect.bulk ? valuePanel(aspect) : '')}

    <div class="st-toolbar">
      <label class="st-all">
        <input type="checkbox" data-studio="all"
               ${set.rows.length && n === set.rows.length ? 'checked' : ''} />
        <span>حدّد الكل (${set.rows.length})</span>
      </label>
      <span class="st-picked">${n ? `${counted(n, 'واحدة', 'اتنين', 'محدّدة')}` : 'مفيش حاجة محدّدة'}</span>
    </div>

    ${raw(set.rows.length ? html`
      <div class="st-rows">
        ${raw(set.rows.map((row) => sceneRow(row, state.picked.has(row.id))).join(''))}
      </div>` : html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('check'))}</div>
        <h2>مفيش حاجة هنا</h2>
        <p>الشريحة دي فاضية — جرّب شريحة تانية.</p>
      </div>`)}

    ${raw(aspect.bulk ? html`
      <div class="st-actions">
        <button class="btn btn-primary" data-studio="preview" ${n ? '' : 'disabled'}>
          عايِن التغيير${n ? ` على ${n}` : ''}
        </button>
      </div>` : '')}`;

  // القيمة المحفوظة تبقى بعد إعادة الرسم.
  restoreValue(aspect);
}

function sceneRow(row, checked) {
  return html`
    <label class="st-row${checked ? ' is-on' : ''}">
      <input type="checkbox" data-studio="row" value="${row.id}" ${checked ? 'checked' : ''} />
      <span class="st-row-body">
        <span class="st-row-top">
          <bdi class="st-row-title">${row.title}</bdi>
          <span class="st-row-date">${row.date}</span>
        </span>
        ${raw(row.evidence.length ? html`
          <span class="st-ev">
            ${raw(row.evidence.map((piece) => html`
              <span class="st-ev-bit">${raw(icon(piece.icon))} ${piece.text}</span>`).join(''))}
          </span>` : html`
          <span class="st-ev is-bare">مفيش دليل — افتحها لو مش فاكرها</span>`)}
      </span>
      <button class="st-open" data-studio="open" data-id="${row.id}"
              title="افتح الذكرى" aria-label="افتح الذكرى">${raw(icon('back'))}</button>
    </label>`;
}

/** لوحة القيمة — تختلف بنوع المدخل. */
function valuePanel(aspect) {
  const { people, types, threads, places } = state.options;
  /*
   * الفعل يقول نوع الملء: الإضافة تتراكم على القائم، والإحلال يمحوه.
   * وهذا أوّل ما يجب أن يعرفه القارئ قبل أن يختار قيمة.
   */
  const verb = aspect.fill === FILL.ADD
    ? 'هتتضاف للذكريات اللي هتحدّدها'
    : 'هتحلّ محلّ اللي موجود في الذكريات اللي هتحدّدها';

  let field = '';
  if (aspect.input.kind === 'people') {
    field = people.length
      ? html`<div class="st-people">
          ${raw(people.map((person) => html`
            <label class="st-person">
              <input type="checkbox" data-studio="value-people" value="${person.id}" />
              <span><bdi>${person.name}</bdi></span>
            </label>`).join(''))}
        </div>`
      : html`<p class="fc-empty">لسه مفيش أشخاص — ضيفهم من أي ذكرى الأول.</p>`;
  } else if (aspect.input.kind === 'select' && aspect.input.source === 'types') {
    field = html`
      <select class="st-select" data-studio="value-select">
        <option value="">— اختار النوع —</option>
        ${raw(types.map((row) => html`
          <option value="${row.id}">${row.label}</option>`).join(''))}
      </select>`;
  } else if (aspect.input.kind === 'select' && aspect.input.source === 'threads') {
    field = threads.length
      ? html`
        <select class="st-select" data-studio="value-select">
          <option value="">— اختار القصّة —</option>
          ${raw(threads.map((row) => html`
            <option value="${row.id}">${row.title}</option>`).join(''))}
        </select>`
      : html`<p class="fc-empty">لسه مفيش قصص — اعمل واحدة من شاشة القصص.</p>`;
  } else {
    field = html`
      <input class="st-input" type="text" data-studio="value-text"
             list="st-places" placeholder="${aspect.input.placeholder || ''}"
             autocomplete="off" />
      <datalist id="st-places">
        ${raw(places.map((name) => html`<option value="${name}"></option>`).join(''))}
      </datalist>`;
  }

  return html`
    <section class="st-value">
      <h2>${verb}</h2>
      ${raw(field)}
    </section>`;
}

/** يعيد القيمة إلى الحقل بعد إعادة الرسم. */
function restoreValue(aspect) {
  if (state.value == null) return;
  if (aspect.input.kind === 'people') {
    const chosen = new Set(Array.isArray(state.value) ? state.value : []);
    for (const box of $$('[data-studio="value-people"]')) box.checked = chosen.has(box.value);
    return;
  }
  const node = $('[data-studio="value-select"]') || $('[data-studio="value-text"]');
  if (node) node.value = state.value;
}

async function loadOptions(world) {
  const [people, types, threads] = await Promise.all([
    listPeople(),
    listTypes(),
    listThreads({ onlyOpen: false }),
  ]);
  state.options = {
    people,
    // «غير محدّد» ليس قيمةً تُكتب — هو الفراغ الذي جئنا نملؤه.
    types: types.filter((row) => row.id !== 'other'),
    threads,
    places: [...new Set(
      world.scenes.map((row) => String(row.placeName || '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'ar')),
  };
}

/* ------------------------------------------------------------------ *
 * ٣ · المعاينة
 * ------------------------------------------------------------------ */

function drawPreview(main) {
  const plan = state.plan;

  main.innerHTML = html`
    ${raw(header(`${plan.aspectLabel} ← «${plan.valueLabel}»`))}

    <div class="st-summary">
      <div class="st-stat is-write">
        <strong>${plan.willWrite}</strong>
        <span>${plural(plan.willWrite, 'ذكرى', 'ذكرتين', 'ذكريات')} هتتغيّر</span>
      </div>
      ${raw(plan.unchanged ? html`
        <div class="st-stat">
          <strong>${plan.unchanged}</strong><span>مش هتتغيّر — القيمة عندها أصلًا</span>
        </div>` : '')}
      ${raw(plan.dropped.length ? html`
        <div class="st-stat is-warn">
          <strong>${plan.dropped.length}</strong><span>اتشالت — مابقتش موجودة</span>
        </div>` : '')}
    </div>

    ${raw(plan.impact.length ? html`
      <section class="st-impact">
        <h2>${raw(icon('sparkle'))} اللي ده هيفتحه</h2>
        <ul>
          ${raw(plan.impact.map((row) => html`
            <li>
              <bdi>${row.label}</bdi>
              <span class="st-arrow">كان في ${row.before} → هيبقى في ${row.after}</span>
            </li>`).join(''))}
        </ul>
      </section>` : '')}

    ${raw(plan.large ? html`
      <div class="st-note is-warn">
        ${raw(icon('info'))}
        <p>
          دي دفعة كبيرة (أكتر من ${LARGE_BATCH}). التراجع متاح
          <strong>ما دمت في الشاشة دي</strong> — لو قفلت التطبيق مايبقاش.
          خُد نسخة <code>.llife</code> من الإعدادات لو ده يقلقك.
        </p>
      </div>` : '')}

    <div class="st-rows is-preview">
      ${raw(plan.rows.map((row) => html`
        <div class="st-prow${row.changes ? '' : ' is-skip'}">
          <div class="st-row-top">
            <bdi class="st-row-title">${row.title}</bdi>
            <span class="st-row-date">${row.date}</span>
          </div>
          <div class="st-diff">
            <span class="st-before">${row.before || '— فاضي —'}</span>
            <span class="st-arrow">←</span>
            <span class="st-after">${row.after || '— فاضي —'}</span>
          </div>
          ${raw(row.changes ? '' : html`<span class="st-skip-note">مفيش تغيير</span>`)}
        </div>`).join(''))}
    </div>

    ${raw(plan.dropped.length ? html`
      <section class="st-dropped">
        <h2>${raw(icon('info'))} اللي اتشال</h2>
        <ul>
          ${raw(plan.dropped.map((row) => html`<li>${row.reason}</li>`).join(''))}
        </ul>
      </section>` : '')}

    <div class="st-actions">
      <button class="btn btn-ghost" data-studio="back">رجوع</button>
      <button class="btn btn-primary" data-studio="apply" ${plan.willWrite ? '' : 'disabled'}>
        اكتب على ${plan.willWrite}
      </button>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * ٤ · التقرير
 * ------------------------------------------------------------------ */

function drawReport(main) {
  const report = state.report;

  main.innerHTML = html`
    ${raw(header(`${report.aspectLabel} ← «${report.valueLabel}»`))}

    <div class="st-summary">
      <div class="st-stat is-write">
        <strong>${report.counts.written}</strong><span>اتكتبت</span>
      </div>
      ${raw(report.counts.skipped ? html`
        <div class="st-stat"><strong>${report.counts.skipped}</strong><span>اتخطّت</span></div>` : '')}
      ${raw(report.counts.failed ? html`
        <div class="st-stat is-bad"><strong>${report.counts.failed}</strong><span>فشلت</span></div>` : '')}
    </div>

    ${raw(report.counts.failed ? html`
      <section class="st-dropped">
        <h2>${raw(icon('info'))} اللي فشل — وليه</h2>
        <ul>
          ${raw(report.failed.map((row) => html`
            <li><bdi>${row.title}</bdi> — ${row.reason}</li>`).join(''))}
        </ul>
        <p class="st-sub">
          الباقي اتكتب ومااتلغاش. الصفوف هنا مستقلّة عن بعضها، فسقوط
          واحد مابيلغيش شغل صحيح قبله.
        </p>
      </section>` : '')}

    ${raw(report.counts.written ? html`
      <details class="st-written">
        <summary>شوف الـ${report.counts.written} اللي اتغيّروا</summary>
        <ul>
          ${raw(report.written.map((row) => html`
            <li><button data-studio="open" data-id="${row.id}"><bdi>${row.title}</bdi></button></li>`).join(''))}
        </ul>
      </details>` : '')}

    <div class="st-note">
      ${raw(icon('info'))}
      <p>
        <strong>التراجع متاح ما دمت في الشاشة دي.</strong> لو قفلت التطبيق
        أو رجعت للخريطة مايبقاش — الاستوديو مابيحتفظش بسجلّ دائم للتراجع،
        وده حدّ معروف مش نسيان.
      </p>
    </div>

    <div class="st-actions">
      ${raw(report.undoable ? html`
        <button class="btn btn-danger" data-studio="undo">${raw(icon('restore'))} تراجع عن الدفعة</button>` : '')}
      <button class="btn btn-primary" data-studio="home">تمام — رجّعني للخريطة</button>
    </div>`;
}

/* ================================================================== */
/* الأفعال                                                            */
/* ================================================================== */

/**
 * يوصّل الشاشة بأفعالها.
 *
 * ⚠️ مندوبةٌ من `main` لا مربوطةٌ بعنصر: الشاشة تُعاد كتابتها كاملةً
 *    عند كل خطوة، ومستمعٌ على زرٍّ بعينه يموت مع أول إعادة رسم.
 */
export function wireStudio(main, rerender) {
  const redraw = () => rerender();

  main.addEventListener('click', async (event) => {
    const node = event.target.closest('[data-studio]');
    if (!node) return;
    const what = node.dataset.studio;

    // فتح الذكرى لا يُبدّل خانةً تحته.
    if (what === 'open') {
      event.preventDefault();
      event.stopPropagation();
      return navigate(`/scene/${node.dataset.id}`);
    }

    if (what === 'aspect') {
      state.aspectId = node.dataset.id;
      state.cohort = 'all';
      state.query = '';
      state.picked = new Set();
      state.value = null;
      state.stage = 'pick';
      return redraw();
    }

    if (what === 'cohort') {
      state.cohort = node.dataset.id;
      return redraw();
    }

    if (what === 'back') {
      if (state.stage === 'preview') state.stage = 'pick';
      else { state.stage = 'map'; state.aspectId = null; }
      return redraw();
    }

    if (what === 'home') {
      state = blank();
      return redraw();
    }

    if (what === 'preview') return startPreview(redraw);
    if (what === 'apply') return commit(redraw);
    if (what === 'undo') return undo(redraw);
  });

  main.addEventListener('change', (event) => {
    const node = event.target.closest('[data-studio]');
    if (!node) return;
    const what = node.dataset.studio;

    if (what === 'row') {
      if (node.checked) state.picked.add(node.value);
      else state.picked.delete(node.value);
      // إعادة رسمٍ خفيفة: الرقم وحده يتغيّر، والقائمة كما هي.
      node.closest('.st-row')?.classList.toggle('is-on', node.checked);
      const label = $('.st-picked');
      const n = state.picked.size;
      if (label) label.textContent = n ? counted(n, 'واحدة', 'اتنين', 'محدّدة') : 'مفيش حاجة محدّدة';
      const go = $('[data-studio="preview"]');
      if (go) {
        go.disabled = n === 0;
        go.textContent = n ? `عايِن التغيير على ${n}` : 'عايِن التغيير';
      }
      return;
    }

    if (what === 'all') {
      const rows = state.set?.rows || [];
      state.picked = node.checked ? new Set(rows.map((row) => row.id)) : new Set();
      return rerender();
    }

    if (what === 'value-people') {
      state.value = $$('[data-studio="value-people"]')
        .filter((box) => box.checked)
        .map((box) => box.value);
      return;
    }

    if (what === 'value-select' || what === 'value-text') {
      state.value = node.value;
    }
  });

  main.addEventListener('input', (event) => {
    const node = event.target.closest('[data-studio="query"]');
    if (!node) return;
    clearTimeout(wireStudio._timer);
    // انتظارٌ قصير: كل حرفٍ إعادةُ ترشيحٍ على كل الذكريات.
    wireStudio._timer = setTimeout(() => {
      state.query = node.value;
      rerender();
    }, 220);
  });
}

async function startPreview(redraw) {
  const value = state.value;
  const empty = value == null || value === ''
    || (Array.isArray(value) && value.length === 0);
  if (empty) {
    toastError('اختار القيمة الأول');
    return;
  }

  try {
    state.plan = await planBatch({
      aspectId: state.aspectId,
      value,
      sceneIds: [...state.picked],
      world: state.set.world,
    });
  } catch (err) {
    toastError(err.message || 'مقدرناش نجهّز المعاينة');
    return;
  }

  if (!state.plan.willWrite) {
    toast('مفيش حاجة هتتغيّر — القيمة دي موجودة عندهم أصلًا');
    return;
  }

  state.stage = 'preview';
  redraw();
}

async function commit(redraw) {
  const plan = state.plan;

  /*
   * ⚠️ الدفعة الكبيرة تُسأل صراحةً. الفرق بين خمسة ومئتين ليس في
   *    الكود بل فيما يحدث لو كنتَ غلطان — وضغطةٌ واحدة لا تكفي
   *    لمئتَي صفّ.
   */
  if (plan.large) {
    const ok = await confirmAction({
      title: `تكتب على ${plan.willWrite} ذكرى؟`,
      message: `دي دفعة كبيرة. التراجع هيفضل متاح ما دمت في الشاشة، `
        + `لكن لو قفلت التطبيق مايبقاش. خُد نسخة .llife لو ده يقلقك.`,
      confirmLabel: 'اكتب',
    });
    if (!ok) return;
  }

  try {
    state.report = await applyBatch(plan);
  } catch (err) {
    toastError(err.message || 'مقدرناش نكتب');
    return;
  }

  state.stage = 'report';
  redraw();
  if (state.report.counts.written) {
    toastOk(`اتكتبت ${counted(state.report.counts.written, 'واحدة', 'اتنين', 'ذكريات')}`);
  }
}

async function undo(redraw) {
  const report = state.report;
  if (!report?.undoable) return;

  try {
    await report.undo();
  } catch (err) {
    toastError(err.message || 'مقدرناش نتراجع');
    return;
  }

  toastOk('اترجعنا عن الدفعة');
  state = blank();
  redraw();
}

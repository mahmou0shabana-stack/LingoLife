/**
 * LingoLife — مختبر التطوّر: الشاشة
 *
 * ═══════════════════════════════════════════════════════════════
 * كل رقمٍ هنا يُفتَح
 * ═══════════════════════════════════════════════════════════════
 *
 * ما تراه ليس لوحةَ مؤشّرات. «١٢ مفتوحة» زرٌّ تضغطه فترى الاثنتَي
 * عشرة بأسمائها — والرقم اختصارٌ للقائمة لا بديلٌ عنها.
 *
 * ⚠️ **ولا رقمَ بلا سجلّاتٍ تحته.** ما لا يمكن فتحه لا يُعرَض، وما
 *    لا تكفي عيّنتُه يُقال سببُه بدل رقمٍ كاذب. وما رُفض عرضُه
 *    مكتوبٌ في `NOT_A_METRIC` ويُعرَض للقارئ في آخر الشاشة.
 *
 * ثلاث شاشات: اللوحة، والملاحظة، والـBrief. ومن أيّها رجوعٌ واضح.
 */

import { html, raw, $, $$, esc, copyToClipboard } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { filterBar, activeCount } from '../components/filter-bar.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { showModal, confirmAction } from '../components/modal.js';
import { navigate, back } from '../router.js';
import { plural, counted } from '../utils/plural.js';
import {
  STATUS, STATUS_META, BOARD_ORDER, OPEN_STATUSES, PRIORITY_META,
  BLOCKED_REASON, BLOCKED_REASON_META, EVENT_LABEL, NOT_A_METRIC,
  featureLabel, FEATURES,
} from '../services/dev/model.js';
import {
  listIssues, getIssue, filterIssues, setStatus, blockIssue, resolveIssue,
  addComment, updateIssue, moveToBrief, briefOf, issuesOfBrief,
} from '../services/dev/issue-service.js';
import {
  listBriefs, createBrief, updateBrief, getBrief, briefSummary, deleteBrief,
  BRIEF_STATUS, BRIEF_STATUS_LABEL,
} from '../services/dev/brief-service.js';
import { labOverview, developmentHistory, issueStory } from '../services/dev/metrics.js';
import { shotsOf, shotUrl, attachShot, removeShot, updateShot, PHASE, PHASE_LABEL } from '../services/dev/shots.js';
import {
  collectBrief, collectIssues, briefMarkdown, briefPrintHtml,
  downloadMarkdown, downloadJson, downloadZip, regionWords,
} from '../services/dev/export.js';
import { pickFiles } from '../services/media-service.js';
import { appBuild } from '../services/dev/build.js';
import { openImproveModal } from '../modals/improve-modal.js';
import {
  cloudDiagnostics, journalText, journalCounts, journalClear,
} from '../services/cloud/cloud-service.js';

/** حالة اللوحة — خارج الـDOM، كباقي الشاشات متعدّدة المراحل. */
let state = null;
const blank = () => ({
  view: 'board',
  filters: { status: '', featureId: '', briefId: '', priority: '', blockedReason: '', query: '', open: null },
  picked: new Set(),
});

export function resetDev() {
  state = null;
}

const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—');

/* ================================================================== */
/* اللوحة                                                             */
/* ================================================================== */

export async function renderDev(main) {
  if (!state) state = blank();
  main.innerHTML = html`<div class="spinner"></div>`;

  const [view, briefs, rows] = await Promise.all([
    labOverview(),
    listBriefs(),
    filterIssues(state.filters),
  ]);


  main.innerHTML = html`
    <header class="dv-head">
      <div>
        <h1>مختبر التطوّر</h1>
        <p class="dv-sub">
          ${view.total ? `${counted(view.total, 'ملاحظة', 'ملاحظتين', 'ملاحظة')} · كل رقم هنا بيتفتح` : 'لسه مفيش ملاحظات'}
        </p>
      </div>
      <div class="dv-headbtns">
        <button class="btn btn-ghost" data-dev="journal" title="دفتر المزامنة">🛰 دفتر المزامنة</button>
        <button class="btn btn-primary" data-dev="new">${raw(icon('plus'))} ملاحظة جديدة</button>
      </div>
    </header>

    ${raw(view.total === 0 ? emptyState() : html`

      <div class="dv-counters">
        ${raw(view.board.counters.filter((row) => row.count > 0).map((row) => html`
          <button class="dv-counter is-${row.tone}${state.filters.status === row.key ? ' is-on' : ''}"
                  data-dev="status" data-id="${row.key}" title="${row.hint}">
            <strong>${row.count}</strong>
            <span>${row.label}</span>
          </button>`).join(''))}
      </div>

      ${raw(filterBar({
        active: activeCount(state.filters),
        clear: 'clear',
        body: html`<div class="dv-filters">
        <input class="dv-search" type="search" data-dev="query"
               placeholder="دوّر في العناوين والتعليقات…" value="${state.filters.query}" />
        <select data-dev="filter-feature">
          <option value="">كل الشاشات</option>
          ${raw(FEATURES.map((row) => html`
            <option value="${row.id}" ${state.filters.featureId === row.id ? 'selected' : ''}>${row.label}</option>`).join(''))}
        </select>
        <select data-dev="filter-brief">
          <option value="">كل الـBriefs</option>
          ${raw(briefs.map((row) => html`
            <option value="${row.id}" ${state.filters.briefId === row.id ? 'selected' : ''}>${row.title}</option>`).join(''))}
        </select>
        <select data-dev="filter-priority">
          <option value="">كل الأولويّات</option>
          ${raw(Object.entries(PRIORITY_META).map(([id, meta]) => html`
            <option value="${id}" ${state.filters.priority === id ? 'selected' : ''}>${meta.label}</option>`).join(''))}
        </select>
        <select data-dev="filter-blocked">
          <option value="">كل أسباب التوقّف</option>
          ${raw(Object.entries(BLOCKED_REASON_META).map(([id, meta]) => html`
            <option value="${id}" ${state.filters.blockedReason === id ? 'selected' : ''}>${meta.label}</option>`).join(''))}
        </select>
        </div>`,
      }))}

      <div class="dv-listhead">
        <span>${rows.length ? `${rows.length} ${plural(rows.length, 'ملاحظة', 'ملاحظتين', 'ملاحظة')}` : 'مفيش نتايج'}</span>
        ${raw(state.picked.size ? html`
          <button class="btn btn-primary btn-sm" data-dev="export-picked">
            ${raw(icon('upload'))} جهّز الـ${state.picked.size} دول للتطوير
          </button>` : '')}
      </div>

      <div class="dv-rows">
        ${raw(rows.map(issueRow).join(''))}
      </div>

      ${raw(usefulPanel(view))}
      ${raw(briefsSection(briefs))}
      ${raw(refusedSection())}
    `)}`;
}

function emptyState() {
  return html`
    <div class="empty-state">
      <div class="glyph">${raw(icon('sparkle'))}</div>
      <h2>لسه مفيش ملاحظات</h2>
      <p>
        من أي شاشة في التطبيق اضغط <strong>«طوّر ده»</strong> — هيلتقط
        مكانك لوحده وتكتب ملاحظتك.
      </p>
    </div>`;
}

/** ما يستحقّ العرض — وما لا تكفي عيّنتُه يقول سببه. */
function usefulPanel(view) {
  const { counters, features, blockedReasons, oldestOpen, measures } = view;

  const waiting = [counters.waitingProduct, counters.waitingDevice, counters.waitingDependency]
    .filter((row) => row.count > 0);

  if (!waiting.length && !features.length && !oldestOpen) return '';

  return html`
    <section class="dv-useful">
      ${raw(waiting.length ? html`
        <div class="dv-card">
          <h2>مستنّي إيه</h2>
          <ul class="dv-mini">
            ${raw(waiting.map((row) => html`
              <li><button data-dev="open-ids" data-ids="${row.ids.join(',')}">
                <strong>${row.count}</strong> ${row.label}</button></li>`).join(''))}
          </ul>
        </div>` : '')}

      ${raw(features.length ? html`
        <div class="dv-card">
          <h2>المفتوح حسب الشاشة</h2>
          <ul class="dv-mini">
            ${raw(features.slice(0, 6).map((row) => html`
              <li><button data-dev="feature" data-id="${row.key}">
                <strong>${row.count}</strong> ${row.label}</button></li>`).join(''))}
          </ul>
        </div>` : '')}

      ${raw(blockedReasons.length ? html`
        <div class="dv-card">
          <h2>واقفة ليه</h2>
          <ul class="dv-mini">
            ${raw(blockedReasons.map((row) => html`
              <li><button data-dev="blocked" data-id="${row.key}">
                <strong>${row.count}</strong> ${row.label}</button></li>`).join(''))}
          </ul>
        </div>` : '')}

      <div class="dv-card">
        <h2>حقائق</h2>
        <ul class="dv-facts">
          ${raw(oldestOpen ? html`
            <li>
              <span>أقدم ملاحظة مفتوحة</span>
              <button data-dev="issue" data-id="${oldestOpen.id}">
                <bdi>${oldestOpen.title}</bdi> — من ${counted(oldestOpen.days, 'يوم', 'يومين', 'يوم')}
              </button>
            </li>` : '')}
          ${raw(measures.map((row) => html`
            <li>
              <span>${row.label}</span>
              ${raw(row.ok
                ? html`<strong>${row.value} ${row.unit}</strong>
                       <em>على ${counted(row.sample, 'ملاحظة', 'ملاحظتين', 'ملاحظة')}</em>`
                : html`<em class="dv-nodata">${row.why}</em>`)}
            </li>`).join(''))}
        </ul>
      </div>
    </section>`;
}

function issueRow(row) {
  const meta = STATUS_META[row.status];
  const picked = state.picked.has(row.id);
  return html`
    <div class="dv-row${picked ? ' is-picked' : ''}">
      <label class="dv-pick">
        <input type="checkbox" data-dev="pick" value="${row.id}" ${picked ? 'checked' : ''} />
      </label>
      <button class="dv-rowmain" data-dev="issue" data-id="${row.id}">
        <span class="dv-rowtop">
          <bdi class="dv-title">${row.title}</bdi>
          <span class="dv-badge is-${meta.tone}">${meta.label}</span>
        </span>
        <span class="dv-rowmeta">
          <span>${featureLabel(row.featureId)}</span>
          <span>${day(row.createdAt)}</span>
          ${raw(row.priority !== 'normal'
            ? html`<span class="dv-pri is-${row.priority}">${PRIORITY_META[row.priority].label}</span>` : '')}
          ${raw(row.blockedReason
            ? html`<span class="dv-why">⛔ ${BLOCKED_REASON_META[row.blockedReason]?.label || ''}</span>` : '')}
        </span>
      </button>
    </div>`;
}

function briefsSection(briefs) {
  if (!briefs.length) {
    return html`
      <section class="dv-briefs">
        <div class="dv-briefhead">
          <h2>Development Briefs</h2>
          <button class="btn btn-ghost btn-sm" data-dev="new-brief">${raw(icon('plus'))} Brief جديد</button>
        </div>
        <p class="field-hint">
          الـBrief تطوير واحد أكبر تحته ملاحظات — زي «تحسينات تجربة الظلّ»
          وتحتها الكتاب والزرّ والخطّ. وكل ملاحظة ليها حالتها لوحدها.
        </p>
      </section>`;
  }

  return html`
    <section class="dv-briefs">
      <div class="dv-briefhead">
        <h2>Development Briefs</h2>
        <button class="btn btn-ghost btn-sm" data-dev="new-brief">${raw(icon('plus'))} Brief جديد</button>
      </div>
      <div class="dv-briefgrid">
        ${raw(briefs.map((row) => html`
          <button class="dv-brief" data-dev="brief" data-id="${row.id}">
            <span class="dv-brieftop">
              <bdi>${row.title}</bdi>
              <span class="dv-badge">${BRIEF_STATUS_LABEL[row.status]}</span>
            </span>
            ${raw(row.description ? html`<span class="dv-briefdesc">${row.description}</span>` : '')}
          </button>`).join(''))}
      </div>
    </section>`;
}

/** ⚠️ ما رُفض عرضُه — يُقال للقارئ لا يُسكَت عنه. */
function refusedSection() {
  return html`
    <details class="dv-refused">
      <summary>${raw(icon('info'))} أرقام مش هتلاقيها هنا — وليه</summary>
      <ul>
        ${raw(Object.values(NOT_A_METRIC).map((row) => html`
          <li><strong>${row.label}</strong><span>${row.reason}</span></li>`).join(''))}
      </ul>
    </details>`;
}

/* ================================================================== */
/* الملاحظة                                                           */
/* ================================================================== */

export async function renderDevIssue(main, id) {
  main.innerHTML = html`<div class="spinner"></div>`;

  const issue = await getIssue(id);
  if (!issue) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الملاحظة مش موجودة</h2>
        <button class="btn btn-ghost" data-dev="board">رجوع للمختبر</button>
      </div>`;
    return;
  }

  const [story, shots, briefs, currentBrief] = await Promise.all([
    issueStory(id), shotsOf(id), listBriefs(), briefOf(id),
  ]);
  const meta = STATUS_META[issue.status];

  main.innerHTML = html`
    <header class="dv-head">
      <button class="btn btn-ghost" data-dev="board">${raw(icon('back'))} المختبر</button>
      <button class="btn btn-ghost btn-sm" data-dev="copy-issue">${raw(icon('copy'))} انسخ</button>
    </header>

    <article class="dv-issue">
      <div class="dv-issuehead">
        <h1><bdi>${issue.title}</bdi></h1>
        <span class="dv-badge is-${meta.tone}">${meta.label}</span>
      </div>

      <div class="dv-tags">
        <span class="dv-tag">${featureLabel(issue.featureId)}</span>
        ${raw(issue.routePattern ? html`<code>${issue.routePattern}</code>` : '')}
        <span class="dv-tag">${PRIORITY_META[issue.priority]?.label || ''}</span>
        <span class="dv-tag">اتفتحت ${day(issue.createdAt)}</span>
        ${raw(issue.resolvedAt ? html`<span class="dv-tag is-ok">اتحلّت ${day(issue.resolvedAt)}</span>` : '')}
        ${raw(story.reopenCount ? html`<span class="dv-tag is-warn">اتفتحت تاني ${story.reopenCount}</span>` : '')}
        ${raw(issue.build ? html`<code>${issue.build}</code>` : '')}
        ${raw(issue.routePath ? html`
          <button class="dv-goto" data-dev="goto" data-path="${issue.routePath}">
            ${raw(icon('back'))} روح للمكان
          </button>` : '')}
      </div>

      ${raw(issue.body ? html`<p class="dv-body">${issue.body}</p>` : '')}

      ${raw(issue.blockedReason ? html`
        <div class="dv-blocked">
          <strong>⛔ واقفة: ${BLOCKED_REASON_META[issue.blockedReason]?.label || ''}</strong>
          ${raw(issue.blockedNote ? html`<p>${issue.blockedNote}</p>` : '')}
        </div>` : '')}

      ${raw(issue.acceptance ? html`
        <div class="dv-accept"><strong>إمتى أعتبرها خلصت:</strong> ${issue.acceptance}</div>` : '')}

      ${raw(issue.resolutionNote ? html`
        <div class="dv-resolution">
          <strong>${issue.resolvedAt ? 'اللي اتعمل:' : 'اللي كان اتعمل قبل ما تتفتح تاني:'}</strong>
          <p>${issue.resolutionNote}</p>
        </div>` : '')}

      <div class="dv-actions">
        ${raw(BOARD_ORDER
          .filter((s) => s !== issue.status && s !== STATUS.BLOCKED && s !== STATUS.RESOLVED)
          .map((s) => html`
            <button class="chip" data-dev="move" data-id="${s}">${STATUS_META[s].label}</button>`).join(''))}
        <button class="chip is-warn" data-dev="block">⛔ وقّفها</button>
        <button class="chip is-ok" data-dev="resolve">✓ اتحلّت</button>
      </div>

      <div class="dv-actions">
        <button class="btn btn-ghost btn-sm" data-dev="comment">${raw(icon('chat'))} ضيف تعليق</button>
        <button class="btn btn-ghost btn-sm" data-dev="shot">${raw(icon('image'))} أرفق صورة</button>
        <button class="btn btn-ghost btn-sm" data-dev="edit">${raw(icon('edit'))} عدّل</button>
        <select class="dv-briefpick" data-dev="setbrief">
          <option value="">— من غير Brief —</option>
          ${raw(briefs.map((row) => html`
            <option value="${row.id}" ${currentBrief === row.id ? 'selected' : ''}>${row.title}</option>`).join(''))}
        </select>
      </div>

      ${raw(shotsBlock(shots))}
      ${raw(timelineBlock(story.events))}
    </article>`;
}

function shotsBlock(shots) {
  if (!shots.length) return '';
  const before = shots.filter((row) => row.phase === PHASE.BEFORE);
  const after = shots.filter((row) => row.phase === PHASE.AFTER);

  const group = (rows, label) => (rows.length ? html`
    <div class="dv-shotgroup">
      <h3>${label}</h3>
      <div class="dv-shots">
        ${raw(rows.map((shot) => html`
          <figure class="dv-shot">
            <div class="dv-shotwrap" data-dev="mark" data-id="${shot.id}">
              <img src="${shotUrl(shot)}" alt="" />
              ${raw(shot.region ? html`
                <span class="dv-mark" style="inset-inline-start:${shot.region.x * 100}%;top:${shot.region.y * 100}%;inline-size:${shot.region.w * 100}%;block-size:${shot.region.h * 100}%"></span>` : '')}
            </div>
            <figcaption>
              ${raw(shot.region ? html`<span>${regionWords(shot.region)}</span>` : html`<span class="dv-nomark">اضغط عشان تحدّد الجزء</span>`)}
              <button data-dev="drop-shot" data-id="${shot.id}" aria-label="شيل">×</button>
            </figcaption>
          </figure>`).join(''))}
      </div>
    </div>` : '');

  return html`
    <section class="dv-shotsec">
      ${raw(group(before, before.length && after.length ? 'قبل' : 'صور'))}
      ${raw(group(after, 'بعد'))}
    </section>`;
}

function timelineBlock(events) {
  return html`
    <section class="dv-timeline">
      <h2>اللي حصل</h2>
      <ol>
        ${raw(events.map((row) => html`
          <li class="dv-ev is-${row.kind}">
            <span class="dv-evwhen">${day(row.at)}</span>
            <span class="dv-evwhat">
              ${EVENT_LABEL[row.kind] || row.kind}
              ${raw(row.from && row.to
                ? html`<em>${STATUS_META[row.from]?.label || row.from} ← ${STATUS_META[row.to]?.label || row.to}</em>`
                : '')}
            </span>
            ${raw(row.note ? html`<span class="dv-evnote">${row.note}</span>` : '')}
          </li>`).join(''))}
      </ol>
    </section>`;
}

/* ================================================================== */
/* الـBrief                                                           */
/* ================================================================== */

export async function renderDevBrief(main, id) {
  main.innerHTML = html`<div class="spinner"></div>`;
  const summary = await briefSummary(id);

  if (!summary) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الـBrief مش موجود</h2>
        <button class="btn btn-ghost" data-dev="board">رجوع للمختبر</button>
      </div>`;
    return;
  }

  const { brief, issues, open, closed } = summary;

  main.innerHTML = html`
    <header class="dv-head">
      <button class="btn btn-ghost" data-dev="board">${raw(icon('back'))} المختبر</button>
      <button class="btn btn-ghost btn-sm" data-dev="edit-brief">${raw(icon('edit'))} عدّل</button>
    </header>

    <article class="dv-issue">
      <div class="dv-issuehead">
        <h1><bdi>${brief.title}</bdi></h1>
        <span class="dv-badge">${BRIEF_STATUS_LABEL[brief.status]}</span>
      </div>
      ${raw(brief.description ? html`<p class="dv-body">${brief.description}</p>` : '')}

      <div class="dv-tags">
        <span class="dv-tag">${issues.length} ملاحظة</span>
        <span class="dv-tag">${open} مفتوح</span>
        <span class="dv-tag is-ok">${closed} مقفول</span>
      </div>

      ${raw(brief.acceptance ? html`
        <div class="dv-accept"><strong>إمتى أعتبره خلص:</strong> ${brief.acceptance}</div>` : '')}
      ${raw(brief.doNotBreak ? html`
        <div class="dv-nobreak"><strong>⚠️ ممنوع يتكسر:</strong> ${brief.doNotBreak}</div>` : '')}

      <section class="dv-ready">
        <h2>${raw(icon('upload'))} جاهز للتطوير</h2>
        <p class="field-hint">
          الملفّ بيطلع فيه كل حاجة: الملاحظات وحالاتها والصور والشاشة
          وأسباب التوقّف و«ممنوع يتكسر» — عشان اللي هينفّذ يفهم من غير
          ما تشرح من الأول.
        </p>
        <div class="dv-exports">
          <button class="btn btn-primary btn-sm" data-dev="ex-zip" data-id="${brief.id}">
            ${raw(icon('download'))} حزمة .zip
          </button>
          <button class="btn btn-ghost btn-sm" data-dev="ex-md" data-id="${brief.id}">Markdown</button>
          <button class="btn btn-ghost btn-sm" data-dev="ex-json" data-id="${brief.id}">JSON</button>
          <button class="btn btn-ghost btn-sm" data-dev="ex-print" data-id="${brief.id}">
            ${raw(icon('script'))} PDF (طباعة)
          </button>
          <button class="btn btn-ghost btn-sm" data-dev="ex-copy" data-id="${brief.id}">
            ${raw(icon('copy'))} انسخ النصّ
          </button>
        </div>
        <p class="dv-pdfnote">
          الـPDF بيطلع من طباعة المتصفّح — اختار «حفظ كـPDF». عملناها كده
          عشان العربي يطلع سليم: خطوط PDF القياسية مفيهاش عربي، وتضمين
          خطّ بتشكيل ووصل حروف ده شغل مكتبة كاملة، والمتصفّح بيعملها أحسن.
        </p>
      </section>

      <section class="dv-briefissues">
        <h2>الملاحظات</h2>
        <div class="dv-rows">
          ${raw(issues.map((row) => {
            const meta = STATUS_META[row.status];
            return html`
              <div class="dv-row">
                <button class="dv-rowmain" data-dev="issue" data-id="${row.id}">
                  <span class="dv-rowtop">
                    <bdi class="dv-title">${row.title}</bdi>
                    <span class="dv-badge is-${meta.tone}">${meta.label}</span>
                  </span>
                  <span class="dv-rowmeta">
                    <span>${featureLabel(row.featureId)}</span>
                    ${raw(row.blockedReason
                      ? html`<span class="dv-why">⛔ ${BLOCKED_REASON_META[row.blockedReason]?.label || ''}</span>` : '')}
                  </span>
                </button>
              </div>`;
          }).join(''))}
        </div>
      </section>

      <div class="dv-actions">
        <button class="btn btn-danger btn-sm" data-dev="drop-brief" data-id="${brief.id}">
          امسح الـBrief (الملاحظات بتفضل)
        </button>
      </div>
    </article>`;
}

/* ================================================================== */
/* الأفعال                                                            */
/* ================================================================== */

export function wireDev(main, rerender) {
  main.addEventListener('click', async (event) => {
    const node = event.target.closest('[data-dev]');
    if (!node) return;
    const what = node.dataset.dev;
    const id = node.dataset.id;
    const issueId = currentIssueId();

    switch (what) {
      case 'board': return navigate('/dev');
      case 'issue': return navigate(`/dev/issue/${id}`);
      case 'brief': return navigate(`/dev/brief/${id}`);
      case 'goto': return navigate(node.dataset.path);
      case 'new': return openImproveModal().then(rerender);
      case 'journal': return openSyncJournal();

      case 'status':
        state.filters.status = state.filters.status === id ? '' : id;
        return rerender();
      case 'feature':
        state.filters.featureId = state.filters.featureId === id ? '' : id;
        state.filters.open = true;
        return rerender();
      case 'blocked':
        state.filters.blockedReason = state.filters.blockedReason === id ? '' : id;
        return rerender();
      case 'open-ids':
        state.filters = { ...blank().filters, blockedReason: '' };
        state.filters.status = STATUS.BLOCKED;
        return rerender();
      case 'clear':
        state.filters = blank().filters;
        return rerender();

      case 'new-brief': return newBriefModal(rerender);
      case 'edit-brief': return editBriefModal(currentBriefId(), rerender);
      case 'drop-brief': return dropBrief(id);

      case 'move': return move(issueId, id, rerender);
      case 'block': return blockModal(issueId, rerender);
      case 'resolve': return resolveModal(issueId, rerender);
      case 'comment': return commentModal(issueId, rerender);
      case 'edit': return editIssueModal(issueId, rerender);
      case 'shot': return pickShot(issueId, rerender);
      case 'drop-shot': return dropShot(id, rerender);
      case 'mark': return markRegion(id, rerender);
      case 'copy-issue': return copyIssue(issueId);

      case 'ex-zip': return exportBrief(id, 'zip');
      case 'ex-md': return exportBrief(id, 'md');
      case 'ex-json': return exportBrief(id, 'json');
      case 'ex-print': return exportBrief(id, 'print');
      case 'ex-copy': return exportBrief(id, 'copy');
      case 'export-picked': return exportPicked();
      default: return undefined;
    }
  });

  main.addEventListener('change', async (event) => {
    const node = event.target.closest('[data-dev]');
    if (!node) return;
    const what = node.dataset.dev;

    if (what === 'pick') {
      if (node.checked) state.picked.add(node.value);
      else state.picked.delete(node.value);
      return rerender();
    }
    if (what === 'filter-feature') { state.filters.featureId = node.value; return rerender(); }
    if (what === 'filter-brief') { state.filters.briefId = node.value; return rerender(); }
    if (what === 'filter-priority') { state.filters.priority = node.value; return rerender(); }
    if (what === 'filter-blocked') { state.filters.blockedReason = node.value; return rerender(); }
    if (what === 'setbrief') {
      await moveToBrief(currentIssueId(), node.value || null);
      toastOk('اتنقلت');
      return rerender();
    }
    return undefined;
  });

  let timer;
  main.addEventListener('input', (event) => {
    const node = event.target.closest('[data-dev="query"]');
    if (!node) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.filters.query = node.value;
      rerender();
    }, 250);
  });
}

const currentIssueId = () => location.hash.match(/#\/dev\/issue\/([^/]+)/)?.[1] || '';
const currentBriefId = () => location.hash.match(/#\/dev\/brief\/([^/]+)/)?.[1] || '';

/* ---- الحالة ---- */

async function move(id, next, rerender) {
  try {
    await setStatus(id, next);
    toastOk('اتغيّرت');
    rerender();
  } catch (err) {
    toastError(err.message);
  }
}

async function blockModal(id, rerender) {
  await showModal({
    title: 'وقّفها ليه؟',
    submitLabel: 'وقّفها',
    body: html`
      <p class="field-hint">
        السبب مش اختياري. بعد شهرين لما تلاقي سبعة واقفين، السبب هو
        اللي هيقول لك مين مستنّي قرارك ومين مستنّي حاجة تانية.
      </p>
      <div class="dv-reasons">
        ${raw(Object.entries(BLOCKED_REASON_META).map(([rid, meta], i) => html`
          <label class="dv-reason">
            <input type="radio" name="reason" value="${rid}" ${i === 0 ? 'checked' : ''} />
            <span><strong>${meta.label}</strong><em>${meta.hint}</em></span>
          </label>`).join(''))}
      </div>
      <div class="field">
        <label for="dv-bnote">تفاصيل</label>
        <textarea id="dv-bnote" name="note" rows="2"
                  placeholder="محتاج أعرف عايزه رفيع قد إيه"></textarea>
      </div>`,
    async onSubmit(data, close) {
      try {
        await blockIssue(id, data.reason, data.note);
        close();
        toastOk('اتوقّفت');
        rerender();
      } catch (err) {
        toastError(err.message);
        throw err;
      }
    },
  });
}

async function resolveModal(id, rerender) {
  await showModal({
    title: 'إيه اللي اتعمل؟',
    submitLabel: 'اتحلّت',
    body: html`
      <p class="field-hint">
        ده اللي هتقراه بعد شهور. «اتحلّت» من غير شرح أسوأ من مفتوحة —
        هتبصّ تلاقيها متحلّة ومش عارف الحلّ ده لسه موجود ولا اتغيّر.
      </p>
      <div class="field">
        <label for="dv-rnote">اللي اتعمل</label>
        <textarea id="dv-rnote" name="note" rows="3" required
                  placeholder="كبّرت الزرّ لـ56px وخلّيته دايري"></textarea>
      </div>`,
    async onSubmit(data, close) {
      try {
        await resolveIssue(id, data.note);
        close();
        toastOk('اتحلّت');
        rerender();
      } catch (err) {
        toastError(err.message);
        throw err;
      }
    },
  });
}

async function commentModal(id, rerender) {
  await showModal({
    title: 'ضيف تعليق',
    submitLabel: 'ضيف',
    body: html`
      <div class="field">
        <textarea name="note" rows="3" placeholder="جرّبتها تاني ولسه بتحصل"></textarea>
      </div>`,
    async onSubmit(data, close) {
      try {
        await addComment(id, data.note);
        close();
        rerender();
      } catch (err) {
        toastError(err.message);
        throw err;
      }
    },
  });
}

async function editIssueModal(id, rerender) {
  const issue = await getIssue(id);
  if (!issue) return;
  await showModal({
    title: 'عدّل الملاحظة',
    submitLabel: 'احفظ',
    body: html`
      <div class="field">
        <label for="dv-et">العنوان</label>
        <input id="dv-et" name="title" type="text" value="${issue.title}" required />
      </div>
      <div class="field">
        <label for="dv-eb">تعليقك</label>
        <textarea id="dv-eb" name="body" rows="3">${issue.body}</textarea>
      </div>
      <div class="field">
        <label for="dv-ea">إمتى أعتبرها خلصت</label>
        <input id="dv-ea" name="acceptance" type="text" value="${issue.acceptance || ''}" />
      </div>
      <div class="field">
        <label for="dv-ep">الأولويّة</label>
        <select id="dv-ep" name="priority">
          ${raw(Object.entries(PRIORITY_META).map(([pid, meta]) => html`
            <option value="${pid}" ${issue.priority === pid ? 'selected' : ''}>${meta.label}</option>`).join(''))}
        </select>
      </div>`,
    async onSubmit(data, close) {
      await updateIssue(id, data);
      close();
      rerender();
    },
  });
}

/* ---- الصور ---- */

async function pickShot(id, rerender) {
  const files = await pickFiles({ accept: 'image/*', multiple: true });
  if (!files?.length) return;

  const isAfter = await confirmAction({
    title: 'الصورة دي قبل ولا بعد؟',
    message: 'لو دي بعد التنفيذ هتظهر في المقارنة قدّام صورة «قبل».',
    confirmLabel: 'بعد التنفيذ',
    cancelLabel: 'قبل',
  });

  for (const file of files) {
    await attachShot(id, file, { phase: isAfter ? PHASE.AFTER : PHASE.BEFORE }).catch(() => {});
  }
  toastOk('اتضافت');
  rerender();
}

async function dropShot(id, rerender) {
  await removeShot(id);
  toast('شيلنا الصورة — تقدر ترجّعها من السلة');
  rerender();
}

/**
 * تحديد الجزء المقصود — بالسحب على الصورة.
 *
 * ⚠️ النِّسَب تُحسَب من **مقاس العنصر المعروض** لا من مقاس الملفّ:
 *    لقطة التابلت ٢٨٠٠ بكسل وتُعرَض على ٣٤٠، والحساب على الملفّ يضع
 *    الإشارة في مكانٍ آخر تمامًا.
 */
async function markRegion(shotId, rerender) {
  const wrap = $(`[data-dev="mark"][data-id="${shotId}"]`);
  if (!wrap) return;

  const img = wrap.querySelector('img');
  if (!img) return;

  wrap.classList.add('is-marking');
  toast('اسحب على الصورة عشان تحدّد الجزء');

  let start = null;
  const box = document.createElement('span');
  box.className = 'dv-mark is-draft';

  const rectOf = () => img.getBoundingClientRect();
  const at = (event) => {
    const rect = rectOf();
    const point = event.touches?.[0] || event;
    return {
      x: Math.min(1, Math.max(0, (point.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (point.clientY - rect.top) / rect.height)),
    };
  };

  const draw = (a, b) => {
    box.style.insetInlineStart = `${Math.min(a.x, b.x) * 100}%`;
    box.style.top = `${Math.min(a.y, b.y) * 100}%`;
    box.style.inlineSize = `${Math.abs(b.x - a.x) * 100}%`;
    box.style.blockSize = `${Math.abs(b.y - a.y) * 100}%`;
  };

  const onDown = (event) => {
    event.preventDefault();
    start = at(event);
    wrap.append(box);
    draw(start, start);
  };
  const onMove = (event) => {
    if (!start) return;
    event.preventDefault();
    draw(start, at(event));
  };
  const onUp = async (event) => {
    if (!start) return;
    const end = at(event);
    const region = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      w: Math.abs(end.x - start.x),
      h: Math.abs(end.y - start.y),
    };
    cleanup();
    // سحبةٌ بلا مساحة ليست إشارة — `normalizeRegion` تردّها `null`.
    await updateShot(shotId, { region });
    rerender();
  };

  function cleanup() {
    start = null;
    box.remove();
    wrap.classList.remove('is-marking');
    wrap.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }

  wrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/* ---- الـBriefs ---- */

async function newBriefModal(rerender) {
  await showModal({
    title: 'Brief جديد',
    submitLabel: 'اعمله',
    body: briefFields({}),
    async onSubmit(data, close) {
      try {
        await createBrief(data);
        close();
        rerender();
      } catch (err) {
        toastError(err.message);
        throw err;
      }
    },
  });
}

async function editBriefModal(id, rerender) {
  const brief = await getBrief(id);
  if (!brief) return;
  await showModal({
    title: 'عدّل الـBrief',
    submitLabel: 'احفظ',
    body: html`
      ${raw(briefFields(brief))}
      <div class="field">
        <label for="dv-bs">الحالة</label>
        <select id="dv-bs" name="status">
          ${raw(Object.entries(BRIEF_STATUS_LABEL).map(([sid, label]) => html`
            <option value="${sid}" ${brief.status === sid ? 'selected' : ''}>${label}</option>`).join(''))}
        </select>
      </div>`,
    async onSubmit(data, close) {
      await updateBrief(id, data);
      close();
      rerender();
    },
  });
}

function briefFields(brief) {
  return html`
    <div class="field">
      <label for="dv-bt">الاسم</label>
      <input id="dv-bt" name="title" type="text" required
             value="${brief.title || ''}" placeholder="تحسينات تجربة الظلّ" />
    </div>
    <div class="field">
      <label for="dv-bd">الوصف</label>
      <textarea id="dv-bd" name="description" rows="2">${brief.description || ''}</textarea>
    </div>
    <div class="field">
      <label for="dv-ba">إمتى أعتبره خلص</label>
      <textarea id="dv-ba" name="acceptance" rows="2">${brief.acceptance || ''}</textarea>
    </div>
    <div class="field">
      <label for="dv-bn">⚠️ ممنوع يتكسر</label>
      <textarea id="dv-bn" name="doNotBreak" rows="2"
                placeholder="استئناف الموضع في الكتاب">${brief.doNotBreak || ''}</textarea>
      <p class="field-hint">
        ده أهمّ سطر في الملفّ اللي هتبعته. إصلاح بيكسر حاجة تانية مش إصلاح.
      </p>
    </div>`;
}

async function dropBrief(id) {
  const ok = await confirmAction({
    title: 'تمسح الـBrief؟',
    message: 'الملاحظات اللي تحته **مش هتتمسح** — هترجع مستقلّة.',
    confirmLabel: 'امسحه',
    danger: true,
  });
  if (!ok) return;
  await deleteBrief(id);
  toastOk('اتمسح — والملاحظات باقية');
  navigate('/dev');
}

/* ---- التصدير ---- */

async function bundleFor(briefId) {
  const build = await appBuild();
  return collectBrief(briefId, { build });
}

async function exportBrief(briefId, kind) {
  try {
    const bundle = await bundleFor(briefId);
    if (kind === 'md') return downloadMarkdown(bundle);
    if (kind === 'json') return downloadJson(bundle);
    if (kind === 'zip') {
      await downloadZip(bundle);
      return toastOk('الحزمة اتحفظت');
    }
    if (kind === 'copy') {
      await copyToClipboard(briefMarkdown(bundle));
      return toastOk('اتنسخ');
    }
    return openPrint(bundle);
  } catch (err) {
    toastError(err.message || 'مقدرناش نصدّر');
    return undefined;
  }
}

async function exportPicked() {
  const rows = await Promise.all([...state.picked].map((id) => getIssue(id)));
  const build = await appBuild();
  const bundle = await collectIssues(rows.filter(Boolean), {
    title: 'جاهز للتطوير', build,
  });
  await downloadZip(bundle);
  toastOk('الحزمة اتحفظت');
}

/**
 * يفتح صفحة الطباعة.
 *
 * ⚠️ الصور تُحوَّل `data:` **هنا فقط**: نافذةُ الطباعة أصلٌ منفصل، و
 *    `blob:` المُنشَأ في صفحتنا لا يُقرأ فيها — فتخرج الصفحة بلا صور.
 */
async function openPrint(bundle) {
  const map = new Map();
  for (const { shots } of bundle.issues) {
    for (const shot of shots) {
      if (!shot.media?.blob) continue;
      map.set(shot.id, await blobToDataUrl(shot.media.blob));
    }
  }

  const html_ = briefPrintHtml(bundle, (shot) => map.get(shot.id) || '');
  const win = window.open('', '_blank');
  if (!win) {
    toastError('المتصفّح منع النافذة — اسمح بالنوافذ المنبثقة');
    return;
  }
  win.document.write(html_);
  win.document.close();
  // انتظارُ الصور قبل الطباعة، وإلّا طُبعت الصفحة بمربّعاتٍ فارغة.
  win.addEventListener('load', () => setTimeout(() => win.print(), 250));
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

async function copyIssue(id) {
  const issue = await getIssue(id);
  if (!issue) return;
  const bundle = await collectIssues([issue], { title: issue.title });
  await copyToClipboard(briefMarkdown(bundle));
  toastOk('اتنسخت');
}


/* ================================================================== *
 * دفترُ المزامنة — خلف المختبر، لا في شاشة المستخدم
 * ================================================================== */

/**
 * يعرض دفترَ المزامنة ويتيح نسخَه.
 *
 * ⚠️ **ومكانُه هنا لا في «الإعدادات».** شاشةُ المستخدم تقول له حالةً
 *    واحدةً بالعربيّة: «متزامن»، «فيه تغييرات لسه»، «مفيش نت». أمّا
 *    `pkg.uploaded seq=41 http 200 12ms` فلا معنى له إلّا في تشخيص —
 *    ووجودُه في الشاشة العاديّة ضجيجٌ يخيف.
 *
 * ⚠️ **والنصُّ منقّى مرّتين**: عند الكتابة وعند التصدير. راجع ترويسةَ
 *    `sync-journal.js` — فهذا النصُّ بالذات هو ما سيُنسَخ من التابلت
 *    ويُلصَق في محادثة.
 */
async function openSyncJournal() {
  const [diag, counts] = await Promise.all([
    cloudDiagnostics().catch((error) => ({ error: error?.message || String(error) })),
    Promise.resolve(journalCounts()),
  ]);

  const text = journalText();
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  /*
   * ⚠️ **ولا `esc()` هنا — `html` تُهرّب بنفسها.** أوّلُ صياغةٍ هرّبت
   *    مرّتين، وأمسكه «فحصُ التهريب المزدوج» في المجموعة. والنتيجةُ
   *    كانت ستكون `&quot;` ظاهرةً للعين في الدفتر.
   */
  const head = diag?.connected
    ? `${diag.device?.label || diag.device?.id || '—'} · ${diag.state}`
    : 'مفيش ربط سحابيّ في الجلسة دي';

  showModal({
    title: '🛰 دفتر المزامنة',
    wide: true,
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <p class="field-hint">${head}</p>

      ${raw(diag?.connected ? html`
      <div class="dv-jrow">
        <span>هُويّة الجهاز</span><code>${diag.device?.id || '—'}</code>
      </div>
      <div class="dv-jrow">
        <span>تغييرات لسه ما وصلتش</span><code>${diag.pendingChanges ?? 0}</code>
      </div>
      <div class="dv-jrow">
        <span>نداءات الناقل</span><code>${JSON.stringify(diag.transportOps || {})}</code>
      </div>` : '')}

      ${raw(summary.length ? html`
      <h4>الأحداث</h4>
      <div class="dv-jcounts">
        ${raw(summary.map(([event, n]) => html`
          <span class="dv-jchip"><b>${n}</b> ${event}</span>`).join(''))}
      </div>` : '<p class="field-hint">الدفتر فاضي — شغّل مزامنة الأول.</p>')}

      <h4>السطور</h4>
      <pre class="dv-journal" dir="ltr">${text || '—'}</pre>

      <div class="btn-row">
        <button class="btn" data-jr="copy">انسخ الدفتر</button>
        <button class="btn btn-ghost" data-jr="clear">فضّي الدفتر</button>
      </div>`,
    onMount(root) {
      root.addEventListener('click', async (event) => {
        const what = event.target.closest('[data-jr]')?.dataset.jr;
        if (what === 'copy') {
          const ok = await copyToClipboard(journalText());
          return ok ? toastOk('اتنسخ') : toastError('مقدرناش ننسخ');
        }
        if (what === 'clear') {
          journalClear();
          const box = root.querySelector('.dv-journal');
          if (box) box.textContent = '—';
          return toastOk('الدفتر اتفضّى');
        }
        return null;
      });
    },
  });
}

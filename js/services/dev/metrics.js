/**
 * LingoLife — مختبر التطوّر: أرقامٌ تحتها سجلّات
 *
 * ═══════════════════════════════════════════════════════════════
 * العدّاد ليس مؤشِّرًا
 * ═══════════════════════════════════════════════════════════════
 *
 * الفرق بين الاثنين ليس في الشكل بل فيما يمكنك أن تفعله بهما:
 *
 *   **العدّاد** رقمٌ يُفتَح. «١٢ مفتوحة» تضغطها فترى الاثنتَي عشرة
 *   بأسمائها. الرقم اختصارٌ للقائمة، والقائمة موجودة.
 *
 *   **المؤشِّر** رقمٌ يُصدَّق. «صحّة التطوير ٧٨٪» لا شيء تحتها تفتحه،
 *   وهي مع ذلك تغيّر قرارك — تطمئنّ فلا تفتح اللوحة.
 *
 * فكل ما هنا **عدّادٌ يُفتَح**، ومعه دائمًا `ids` — معرّفات السجلّات
 * التي صنعته. واختبارٌ يقارن كلَّ عددٍ بطول قائمته: الرقم وعدٌ يُوفَّى.
 *
 * ⚠️ وما يُرفض عرضُه مُعلَنٌ بسببه في `NOT_A_METRIC` — راجع `model.js`.
 *
 * ═══════════════════════════════════════════════════════════════
 * والمقياس لا يُعرَض إلا بدليل
 * ═══════════════════════════════════════════════════════════════
 *
 * «متوسّط مدّة الحلّ» على ملاحظةٍ واحدة ليس متوسّطًا — هو تلك الملاحظة.
 * فكل مقياسٍ هنا يحمل `sample` (على كم بُني) و`ok` (هل يكفي). والشاشة
 * تعرض السبب حين لا يكفي، لا فراغًا ولا صفرًا كاذبًا.
 */

import {
  STATUS, OPEN_STATUSES, CLOSED_STATUSES, BOARD_ORDER,
  STATUS_META, BLOCKED_REASON, BLOCKED_REASON_META, featureLabel,
} from './model.js';
import { listIssues, timelineOf, briefOf } from './issue-service.js';
import { listBriefs, BRIEF_STATUS } from './brief-service.js';
import { devEvents } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { EVENT } from './model.js';

/** أقلّ عيّنة يصحّ أن يُسمّى ما فوقها «متوسّطًا». */
export const MIN_SAMPLE = 3;

const DAY = 86400000;

/* ------------------------------------------------------------------ *
 * العدّادات — كلُّ رقمٍ ومعه معرّفاته
 * ------------------------------------------------------------------ */

/**
 * عدّاد: عنوانٌ ورقمٌ **ومعرّفات ما تحته**.
 *
 * @typedef {{key:string, label:string, count:number, ids:string[]}} Counter
 */
function counter(key, label, rows, extra = {}) {
  return { key, label, count: rows.length, ids: rows.map((row) => row.id), ...extra };
}

/**
 * اللوحة العامّة — عدّاداتٌ بالحالة، بترتيب ما يستدعي انتباهك.
 *
 * @returns {Promise<{total:number, counters:Counter[], issues:object[]}>}
 */
export async function statusBoard(issues = null) {
  const rows = issues || await listIssues();
  const counters = BOARD_ORDER.map((status) => counter(
    status,
    STATUS_META[status].label,
    rows.filter((row) => row.status === status),
    { tone: STATUS_META[status].tone, hint: STATUS_META[status].hint }
  ));

  return { total: rows.length, counters, issues: rows };
}

/* ------------------------------------------------------------------ *
 * ما يستحقّ العرض — بدليله
 * ------------------------------------------------------------------ */

/**
 * مقياسٌ بعيّنته.
 *
 * `ok: false` لا يعني صفرًا — يعني **لا نعرف بعد**، ومعه السبب.
 */
function measure(label, value, sample, { unit = '', why = '' } = {}) {
  const ok = sample >= MIN_SAMPLE;
  return {
    label,
    value: ok ? value : null,
    sample,
    unit,
    ok,
    why: ok ? '' : (why || `محتاج ${MIN_SAMPLE} على الأقل — عندك ${sample}`),
  };
}

/**
 * كل ما يصحّ عرضه — ومعه ما لا يصحّ، بسببه.
 *
 * ⚠️ **ولا رقمَ هنا بلا `ids` أو `sample`.** كل مدخلٍ إمّا عدّادٌ
 *    تفتحه، أو مقياسٌ يقول على كم بُني.
 */
export async function labOverview() {
  const [issues, briefs] = await Promise.all([listIssues(), listBriefs()]);
  const board = await statusBoard(issues);

  const open = issues.filter((row) => OPEN_STATUSES.includes(row.status));
  const closed = issues.filter((row) => CLOSED_STATUSES.includes(row.status));
  const resolved = issues.filter((row) => row.status === STATUS.RESOLVED);
  const blocked = issues.filter((row) => row.status === STATUS.BLOCKED);

  /* ---- المفتوح حسب الشاشة ---- */
  const byFeature = new Map();
  for (const row of open) {
    if (!byFeature.has(row.featureId)) byFeature.set(row.featureId, []);
    byFeature.get(row.featureId).push(row);
  }
  const features = [...byFeature.entries()]
    .map(([id, rows]) => counter(id, featureLabel(id), rows))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ar'));

  /* ---- الواقف حسب السبب ---- */
  const byReason = Object.values(BLOCKED_REASON)
    .map((reason) => counter(
      reason,
      BLOCKED_REASON_META[reason].label,
      blocked.filter((row) => row.blockedReason === reason)
    ))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  /* ---- أقدم ملاحظة مفتوحة ---- */
  const oldest = [...open].sort((a, b) => a.createdAt - b.createdAt)[0] || null;

  /* ---- مدّة الحلّ: من `createdAt` إلى `resolvedAt` الحقيقيَّين ---- */
  const spans = resolved
    .filter((row) => row.resolvedAt && row.resolvedAt > row.createdAt)
    .map((row) => row.resolvedAt - row.createdAt);
  const avgDays = spans.length
    ? Math.round((spans.reduce((sum, n) => sum + n, 0) / spans.length / DAY) * 10) / 10
    : 0;
  const medDays = spans.length
    ? Math.round(([...spans].sort((a, b) => a - b)[Math.floor(spans.length / 2)] / DAY) * 10) / 10
    : 0;

  return {
    board,
    total: issues.length,

    /* عدّادات تُفتَح */
    counters: {
      open: counter('open', 'مفتوحة', open),
      closed: counter('closed', 'مقفولة', closed),
      resolved: counter('resolved', 'اتحلّت', resolved),
      activeBriefs: counter(
        'activeBriefs', 'Briefs شغّالة',
        briefs.filter((row) => row.status === BRIEF_STATUS.ACTIVE)
      ),
      waitingProduct: counter(
        'waitingProduct', 'مستنية قرارك',
        blocked.filter((row) => row.blockedReason === BLOCKED_REASON.PRODUCT)
      ),
      waitingDevice: counter(
        'waitingDevice', 'مستنية تجربة على الجهاز',
        blocked.filter((row) => row.blockedReason === BLOCKED_REASON.DEVICE)
      ),
      waitingDependency: counter(
        'waitingDependency', 'واقفة على شغل تاني',
        blocked.filter((row) => row.blockedReason === BLOCKED_REASON.DEPENDENCY)
      ),
    },

    /* تجميعات تُفتَح */
    features,
    blockedReasons: byReason,

    /* واقعةٌ واحدة لا متوسّط — فتُعرَض كما هي */
    oldestOpen: oldest && {
      id: oldest.id,
      title: oldest.title,
      createdAt: oldest.createdAt,
      days: Math.floor((Date.now() - oldest.createdAt) / DAY),
    },

    /* مقاييس بعيّناتها */
    measures: [
      measure('متوسّط مدّة الحلّ', avgDays, spans.length, {
        unit: 'يوم',
        why: `محتاج ${MIN_SAMPLE} ملاحظات متحلّة على الأقل — عندك ${spans.length}. متوسّط على واحدة مش متوسّط`,
      }),
      measure('وسيط مدّة الحلّ', medDays, spans.length, {
        unit: 'يوم',
        why: `محتاج ${MIN_SAMPLE} ملاحظات متحلّة على الأقل — عندك ${spans.length}`,
      }),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * التاريخ — «إيه اللي طلبته، وليه، واتغيّر إيه»
 * ------------------------------------------------------------------ */

/**
 * تاريخُ تطويرك، مرتَّبًا زمنيًّا — من السجلّات لا من الحقول.
 *
 * ⚠️ **ولا يُحذف منه المحلول.** هذا هو السؤال الذي طلبتَه بالحرف:
 *    «بعد شهور أعرف: طلبت إيه؟ ليه؟ اتغيّر إيه؟ إمتى؟» — ومسحُ ما
 *    انتهى يمحو الإجابة.
 *
 * @param {object} [options]
 * @param {number} [options.limit]
 * @returns {Promise<object[]>}
 */
export async function developmentHistory({ limit = 200 } = {}) {
  const issues = await listIssues();
  const byId = new Map(issues.map((row) => [row.id, row]));

  const events = (await devEvents.getAll())
    .filter((row) => row.state === STATE.ACTIVE && byId.has(row.issueId))
    /* الأحدث أوّلًا — التاريخ يُقرأ من آخره حين تسأل «إيه اللي حصل؟» */
    .sort((a, b) => b.at - a.at || String(b.id).localeCompare(String(a.id)))
    .slice(0, limit);

  return events.map((event) => ({
    event,
    issue: byId.get(event.issueId),
  }));
}

/**
 * ماذا حدث لملاحظةٍ بعينها — القصّة كاملةً.
 *
 * تجمع: الحقول الحالية، والخطّ الزمنيّ، وعددَ مرّات إعادة الفتح
 * **مُشتقًّا من السجلّ لا محفوظًا في حقل**.
 */
export async function issueStory(issueId) {
  const [events, brief] = await Promise.all([timelineOf(issueId), briefOf(issueId)]);

  const reopened = events.filter((row) => row.kind === EVENT.REOPENED);
  const resolvedEvents = events.filter((row) => row.kind === EVENT.RESOLVED);

  return {
    events,
    briefId: brief,
    /* ⚠️ مُشتقٌّ: حقلُ عدّادٍ يفترق عن السجلّ أوّلَ مرّةٍ يُكتب فيها خطأ. */
    reopenCount: reopened.length,
    /* كلُّ حلٍّ سابق باقٍ — «عملنا إيه المرّة اللي فاتت؟» له إجابة. */
    pastResolutions: resolvedEvents.map((row) => ({ at: row.at, note: row.note })),
    startedAt: events[0]?.at || null,
    lastAt: events[events.length - 1]?.at || null,
  };
}

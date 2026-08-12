/**
 * LingoLife — مختبر التطوّر: الملاحظة وحياتها
 *
 * ═══════════════════════════════════════════════════════════════
 * الخطّ الزمنيّ هو الحقيقة، والحقلُ صورةٌ عنه
 * ═══════════════════════════════════════════════════════════════
 *
 * `issue.status` يقول أين هي **الآن**. و`devEvents` يقول **كيف وصلت**.
 * والثاني هو الأصل: لو تعارضا فالسجلّ أصدق من الحقل، لأن الحقل يُكتب
 * فوقه والسجلّ يُضاف إليه.
 *
 * ولذلك لا يُغيَّر `status` في هذا الملفّ إلا عبر `setStatus` — ولا
 * `setStatus` بلا حدثٍ يُكتب معه. كتابةٌ بلا حدثٍ تصنع ملاحظةً
 * «اتحلّت» لا تعرف متى ولا كيف.
 *
 * ═══════════════════════════════════════════════════════════════
 * وما لا يُحذف
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **المحلولة لا تخرج من التاريخ.** طلبتَ أن تعرف بعد شهور ماذا
 *    طلبتَ ولماذا وماذا تغيّر — وذلك مستحيلٌ لو مسحنا ما انتهى. فحتى
 *    «مرفوضة» تبقى، لأن سؤالك بعد سنة قد يكون: «ليه ما عملناهاش؟»
 *
 * ⚠️ **وإعادة الفتح لا تمحو الحلّ السابق.** `resolutionNote` يبقى،
 *    و`resolvedAt` يُفرَّغ لأنها لم تعد محلولة — والحدثان معًا في
 *    السجلّ. فترى: اتحلّت يوم كذا بكذا، ثم اتفتحت تاني يوم كذا.
 */

import { devIssues, devEvents, relationships } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { normalize, tokenize, editDistance } from '../../utils/normalization.js';
import { link, unlink, containersOf } from '../link-service.js';
import {
  STATUS, OPEN_STATUSES, CLOSED_STATUSES, PRIORITY,
  BLOCKED_REASON, BLOCKED_REASON_META, EVENT, BRIEF_ISSUE, featureOf,
} from './model.js';

/* ------------------------------------------------------------------ *
 * السجلّ
 * ------------------------------------------------------------------ */

/**
 * يكتب حدثًا في الخطّ الزمنيّ.
 *
 * ⚠️ داخليّة عمدًا: لا يُكتب حدثٌ إلا من الفعل الذي أحدثه. وتصديرُها
 *    يعني أن تُكتب أحداثٌ لا فعلَ تحتها — وهو أسوأ من ألّا تُكتب،
 *    لأنك تصدّقها.
 */
async function record(issueId, kind, payload = {}) {
  return devEvents.create({
    issueId,
    kind,
    at: Date.now(),
    from: payload.from || null,
    to: payload.to || null,
    note: payload.note || '',
    ref: payload.ref || null,
  });
}

/** الخطّ الزمنيّ لملاحظة — الأقدم أوّلًا، لأنها حكاية تُقرأ من أوّلها. */
export async function timelineOf(issueId) {
  const rows = await devEvents.byIndex('issueId', issueId);
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)));
}

/* ------------------------------------------------------------------ *
 * الإنشاء
 * ------------------------------------------------------------------ */

/**
 * ينشئ ملاحظة.
 *
 * @param {object} input
 * @param {string} input.title
 * @param {string} [input.body]        تعليقك بحرّيّة
 * @param {string} [input.routePattern] نمط المسار من الموجِّه
 * @param {string} [input.routePath]    المسار الحرفيّ — للرجوع إليه
 * @param {string} [input.status]
 * @param {string} [input.priority]
 * @param {string} [input.acceptance]   «إمتى أعتبرها خلصت»
 * @param {string} [input.build]        نسخة التطبيق وقت الملاحظة
 */
export async function createIssue(input = {}) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('الملاحظة محتاجة عنوان');

  const routePattern = String(input.routePattern || '').trim();
  const issue = await devIssues.create({
    title,
    body: String(input.body || '').trim(),
    status: input.status || STATUS.OPEN,
    priority: input.priority || PRIORITY.NORMAL,

    /*
     * ⚠️ النمط للتجميع والمسار الحرفيّ للرجوع. `/scene/SC_a1` و
     *    `/scene/SC_b2` ملاحظتان على نفس الشاشة — وحفظُ الحرفيّ وحده
     *    يجعل «أنهي شاشة عليها أكتر ملاحظات؟» بلا إجابة.
     */
    routePattern,
    routePath: String(input.routePath || '').trim(),
    featureId: featureOf(routePattern),

    /* لا يُملأ إلا حين تقف فعلًا — راجع `blockIssue`. */
    blockedReason: '',
    blockedNote: '',

    /* لا يُملأ إلا حين تُحلّ فعلًا — راجع `resolveIssue`. */
    resolutionNote: '',
    resolvedAt: null,

    acceptance: String(input.acceptance || '').trim(),
    /* نسخة التطبيق وقت الملاحظة — تُقرأ في التصدير فتعرف على أي بناء كانت. */
    build: String(input.build || '').trim(),
  });

  await record(issue.id, EVENT.CREATED);
  return issue;
}

/** تعديل نصّ الملاحظة — بلا حدث: تصحيحُ حرفٍ ليس تاريخًا. */
export async function updateIssue(id, changes = {}) {
  const allowed = {};
  for (const key of ['title', 'body', 'priority', 'acceptance']) {
    if (key in changes) allowed[key] = changes[key];
  }
  if (!Object.keys(allowed).length) return devIssues.get(id);
  return devIssues.update(id, allowed);
}

/**
 * تعليقٌ يُضاف — وهذا **يُسجَّل**.
 *
 * ⚠️ والفرق عن `updateIssue` مقصود: تصحيحُ إملاءٍ في العنوان ليس
 *    حدثًا، وقولُك «جرّبتها تاني ولسه بتحصل» حدثٌ ستحتاجه.
 */
export async function addComment(id, text) {
  const note = String(text || '').trim();
  if (!note) throw new Error('التعليق فاضي');
  await record(id, EVENT.COMMENT, { note });
  return devIssues.get(id);
}

/* ------------------------------------------------------------------ *
 * الحالة
 * ------------------------------------------------------------------ */

/**
 * ينقل الملاحظة إلى حالةٍ أخرى، ويكتب الحدث.
 *
 * ⚠️ **ولا انتقالَ إلى «واقفة» بلا سبب** — راجع `blockIssue`. و«اتحلّت»
 *    لها بابُها أيضًا لأنها تطلب «إيه اللي اتعمل؟».
 */
export async function setStatus(id, next, { note = '' } = {}) {
  const issue = await devIssues.get(id);
  if (!issue) throw new Error('الملاحظة مش موجودة');
  if (!Object.values(STATUS).includes(next)) throw new Error(`حالة مش معروفة: ${next}`);

  if (next === STATUS.BLOCKED) {
    throw new Error('«واقفة» محتاجة سبب — استعمل blockIssue');
  }
  if (next === STATUS.RESOLVED) {
    throw new Error('«اتحلّت» محتاجة تقول إيه اللي اتعمل — استعمل resolveIssue');
  }
  if (issue.status === next) return issue;

  const wasClosed = CLOSED_STATUSES.includes(issue.status);
  const patch = { status: next };

  /*
   * ⚠️ الخروج من «واقفة» يفرّغ السبب: سببٌ باقٍ على ملاحظةٍ تتحرّك
   *    يظهر في اللوحة فتظنّها ما زالت واقفة.
   */
  if (issue.status === STATUS.BLOCKED) {
    patch.blockedReason = '';
    patch.blockedNote = '';
  }

  /*
   * ⚠️ إعادةُ الفتح تُفرّغ `resolvedAt` **ولا تمسّ `resolutionNote`**.
   *    لم تعد محلولة، لكن ما عُمل يومها قد عُمل — ومحوُه يجعل السؤال
   *    «طب إحنا عملنا إيه المرّة اللي فاتت؟» بلا إجابة.
   */
  if (wasClosed && OPEN_STATUSES.includes(next)) {
    patch.resolvedAt = null;
    await devIssues.update(id, patch);
    await record(id, EVENT.REOPENED, { from: issue.status, to: next, note });
    return devIssues.get(id);
  }

  await devIssues.update(id, patch);
  await record(id, EVENT.STATUS, { from: issue.status, to: next, note });
  return devIssues.get(id);
}

/**
 * توقِفُها بسببٍ مُعلَن.
 *
 * ⚠️ السبب **إلزاميّ**. بعد شهرين تفتح اللوحة فترى سبعًا واقفة، ولا
 *    تعرف أيَّها ينتظر قرارًا منك وأيَّها ينتظر جهازًا وأيَّها ينتظر
 *    شغلًا آخر — فتقف كلُّها إلى الأبد لأن فرزَها صار عملًا بذاته.
 */
export async function blockIssue(id, reason, note = '') {
  const issue = await devIssues.get(id);
  if (!issue) throw new Error('الملاحظة مش موجودة');
  if (!BLOCKED_REASON_META[reason]) throw new Error('لازم تختار سبب التوقّف');

  const trimmed = String(note || '').trim();
  if (reason === BLOCKED_REASON.OTHER && !trimmed) {
    throw new Error('«سبب تاني» محتاج تكتبه');
  }

  await devIssues.update(id, {
    status: STATUS.BLOCKED,
    blockedReason: reason,
    blockedNote: trimmed,
  });
  await record(id, EVENT.BLOCKED, { from: issue.status, to: STATUS.BLOCKED, note: trimmed, ref: reason });
  return devIssues.get(id);
}

/**
 * تحلّها — ومعها **إيه اللي اتعمل**.
 *
 * ⚠️ الملاحظة بلا شرحِ حلٍّ هي أسوأ من مفتوحة: بعد شهرين تراها
 *    «اتحلّت» ولا تعرف هل ما تراه اليوم هو الحلّ أم انحرافٌ عنه.
 */
export async function resolveIssue(id, resolutionNote) {
  const issue = await devIssues.get(id);
  if (!issue) throw new Error('الملاحظة مش موجودة');

  const note = String(resolutionNote || '').trim();
  if (!note) throw new Error('اكتب إيه اللي اتعمل — ده اللي هتقراه بعد شهور');

  const at = Date.now();
  await devIssues.update(id, {
    status: STATUS.RESOLVED,
    resolutionNote: note,
    resolvedAt: at,
  });
  await record(id, EVENT.RESOLVED, { from: issue.status, to: STATUS.RESOLVED, note });
  return devIssues.get(id);
}

/** تفتحها تاني — والتاريخ كلّه باقٍ. */
export async function reopenIssue(id, note = '') {
  return setStatus(id, STATUS.OPEN, { note });
}

/* ------------------------------------------------------------------ *
 * العضويّة في الـBrief
 * ------------------------------------------------------------------ */

/** الـBrief الذي تنتمي إليه الملاحظة — أو `null`. */
export async function briefOf(issueId) {
  const rows = await containersOf(issueId, 'brief');
  return rows[0]?.containerId || null;
}

/**
 * ينقل الملاحظة إلى Brief — أو يخرجها منه بـ`null`.
 *
 * ⚠️ الملاحظة في Brief **واحد** لا أكثر: «اتنقلت لـBrief» في الخطّ
 *    الزمنيّ تفترض مكانًا واحدًا. فالانتماء السابق يُرفَع أوّلًا.
 */
export async function moveToBrief(issueId, briefId) {
  const current = await briefOf(issueId);
  if (current === briefId) return current;

  if (current) await unlink(current, issueId, BRIEF_ISSUE);
  if (briefId) await link(briefId, issueId, BRIEF_ISSUE);

  await record(issueId, EVENT.BRIEF, { from: current, to: briefId });
  return briefId;
}

/** ملاحظات Brief — بترتيب إنشائها. */
export async function issuesOfBrief(briefId) {
  const rows = await relationships.byIndex('from_kind', [briefId, BRIEF_ISSUE]);
  const ids = rows.filter((row) => row.state === STATE.ACTIVE).map((row) => row.toId);
  const issues = await devIssues.getMany(ids);
  return issues
    .filter((row) => row && row.state === STATE.ACTIVE)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/* ------------------------------------------------------------------ *
 * القراءة
 * ------------------------------------------------------------------ */

/** كل الملاحظات الحيّة. */
export async function listIssues() {
  const rows = await devIssues.getAll();
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getIssue(id) {
  const row = await devIssues.get(id);
  return row && row.state === STATE.ACTIVE ? row : null;
}

/**
 * ترشيحٌ وبحث.
 *
 * ⚠️ كل مرشّحٍ هنا له زرٌّ في الشاشة. مرشّحٌ بلا واجهة كودٌ ميّت
 *    يوهم من يقرأ الملفّ بأن الميزة موجودة.
 */
export async function filterIssues({
  status = null, statuses = null, featureId = null, briefId = null,
  priority = null, blockedReason = null, from = null, to = null,
  query = '', open = null,
} = {}) {
  let rows = await listIssues();

  if (status) rows = rows.filter((row) => row.status === status);
  if (statuses?.length) rows = rows.filter((row) => statuses.includes(row.status));
  if (open === true) rows = rows.filter((row) => OPEN_STATUSES.includes(row.status));
  if (open === false) rows = rows.filter((row) => CLOSED_STATUSES.includes(row.status));
  if (featureId) rows = rows.filter((row) => row.featureId === featureId);
  if (priority) rows = rows.filter((row) => row.priority === priority);
  if (blockedReason) rows = rows.filter((row) => row.blockedReason === blockedReason);
  if (from) rows = rows.filter((row) => row.createdAt >= from);
  if (to) rows = rows.filter((row) => row.createdAt <= to);

  if (briefId) {
    const ids = new Set((await issuesOfBrief(briefId)).map((row) => row.id));
    rows = rows.filter((row) => ids.has(row.id));
  }

  const needle = normalize(String(query || '').trim());
  if (needle) {
    rows = rows.filter((row) => {
      const hay = normalize(`${row.title} ${row.body} ${row.resolutionNote} ${row.blockedNote}`);
      return hay.includes(needle);
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ *
 * «جديدة ولا مرتبطة بحاجة قديمة؟»
 * ------------------------------------------------------------------ */

/**
 * ملاحظاتٌ مفتوحةٌ شبيهةٌ بما تكتبه الآن — **اقتراحٌ لا دمج**.
 *
 * ⚠️ **ولا يُدمَج شيءٌ تلقائيًّا أبدًا.** هذه هي القاعدة نفسها التي
 *    تحكم الاستيراد *(docs/10)* والأنواع المتشابهة: «فحص داخلي» و
 *    «فحص خارجي» متشابهان نصًّا ومختلفان معنًى. والحاسم أنت.
 *
 * والشبه يُقاس بدليلين مُعلَنين لا بدرجةٍ غامضة:
 *   · **نفس الشاشة** — أقوى دليلٍ عمليّ، لأن ملاحظتين على نفس المكان
 *     غالبًا وجهان لشيءٍ واحد.
 *   · **كلماتٌ مشتركة في العنوان** — وتقارُبٌ إملائيّ يتسامح مع
 *     الأخطاء المطبعيّة.
 *
 * @returns {Promise<{issue, why: string[]}[]>}
 */
export async function similarIssues({ title = '', featureId = '', excludeId = null } = {}) {
  const open = await filterIssues({ open: true });
  const words = tokenize(String(title || ''));
  const wordSet = new Set(words.filter((word) => word.length > 2));

  const scored = [];
  for (const issue of open) {
    if (excludeId && issue.id === excludeId) continue;

    const why = [];
    let score = 0;

    if (featureId && issue.featureId === featureId) {
      why.push('على نفس الشاشة');
      score += 2;
    }

    const theirs = tokenize(issue.title);
    const shared = theirs.filter((word) => wordSet.has(word));
    if (shared.length) {
      why.push(`كلمات مشتركة: ${[...new Set(shared)].slice(0, 3).join('، ')}`);
      score += shared.length * 2;
    } else if (wordSet.size && theirs.length) {
      // تقارُبٌ إملائيّ — «الشادوينج» و«الشادوينچ».
      const near = theirs.some((word) => [...wordSet]
        .some((mine) => Math.abs(mine.length - word.length) <= 2 && editDistance(mine, word, 2) <= 2));
      if (near) {
        why.push('عنوان قريب');
        score += 1;
      }
    }

    if (score > 0) scored.push({ issue, why, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || b.issue.createdAt - a.issue.createdAt)
    .slice(0, 6)
    .map(({ issue, why }) => ({ issue, why }));
}

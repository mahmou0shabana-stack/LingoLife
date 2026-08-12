/**
 * LingoLife — مختبر التطوّر: الـBrief
 *
 * الـBrief **تطويرٌ واحدٌ أكبر** تحته ملاحظات. «تحسينات تجربة الظلّ»
 * وتحتها: تقليل سُمك الكتاب، وتغيير زرّ التشغيل، وتثبيت الصورة،
 * وتحسين الخطّ الروسيّ.
 *
 * ⚠️ **ولكل ملاحظةٍ فيه حالتُها وصورتُها وتعليقُها مستقلًّا.** الـBrief
 *    لا يفرض حالةً على ما تحته: واحدةٌ تكون محلولةً وأخرى واقفةً في
 *    نفس التطوير — وهذا هو الواقع لا استثناءٌ منه.
 *
 * ⚠️ **والعضويّة علاقةٌ لا حقل** *(docs/03 §3.6.1)*. فحذفُ Brief يعيد
 *    ملاحظاته ملاحظاتٍ مستقلّة، ولا يترك صفوفًا تشير إلى حاوٍ غير
 *    موجود ولا يُعيد كتابة سطرٍ فيها.
 *
 * وحقلان هنا ليسا زينة، وهما ما يجعل الملفّ المصدَّر مفهومًا بلا شرح:
 *
 *   `acceptance` — «إمتى أعتبر ده خلص؟»
 *   `doNotBreak` — «إيه اللي ممنوع يتكسر وإنت بتعمل ده؟»
 *
 * والثاني أثمنُ ما في الملفّ حين يُرسَل للتطوير: قائمةُ ما يجب ألّا
 * يُمَسّ تمنع إصلاحًا يكسر شيئًا آخر.
 */

import { devBriefs, relationships } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { BRIEF_ISSUE, OPEN_STATUSES } from './model.js';
import { issuesOfBrief } from './issue-service.js';

/** حالة الـBrief — أبسط من حالة الملاحظة عمدًا. */
export const BRIEF_STATUS = Object.freeze({
  ACTIVE: 'active',
  DONE: 'done',
  PARKED: 'parked',
});

export const BRIEF_STATUS_LABEL = Object.freeze({
  [BRIEF_STATUS.ACTIVE]: 'شغّال',
  [BRIEF_STATUS.DONE]: 'خلص',
  [BRIEF_STATUS.PARKED]: 'متوقّف',
});

export async function createBrief({
  title, description = '', acceptance = '', doNotBreak = '',
} = {}) {
  const name = String(title || '').trim();
  if (!name) throw new Error('الـBrief محتاج اسم');

  return devBriefs.create({
    title: name,
    description: String(description || '').trim(),
    acceptance: String(acceptance || '').trim(),
    doNotBreak: String(doNotBreak || '').trim(),
    status: BRIEF_STATUS.ACTIVE,
  });
}

export async function updateBrief(id, changes = {}) {
  const allowed = {};
  for (const key of ['title', 'description', 'acceptance', 'doNotBreak', 'status']) {
    if (key in changes) allowed[key] = changes[key];
  }
  if (!Object.keys(allowed).length) return devBriefs.get(id);
  return devBriefs.update(id, allowed);
}

export async function getBrief(id) {
  const row = await devBriefs.get(id);
  return row && row.state === STATE.ACTIVE ? row : null;
}

export async function listBriefs({ onlyActive = false } = {}) {
  const rows = await devBriefs.getAll();
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .filter((row) => !onlyActive || row.status === BRIEF_STATUS.ACTIVE)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * يحذف Brief — **وملاحظاته تبقى**.
 *
 * ⚠️ حذفُ الحاوي ليس حذفًا لما فيه. الملاحظات عملُك، والـBrief مجرّد
 *    تجميعةٍ رأيتَها مفيدةً يومًا. فتُرفَع الروابط وتعود الملاحظات
 *    مستقلّةً، ولا يضيع شيء.
 */
export async function deleteBrief(id) {
  const rows = await relationships.byIndex('from_kind', [id, BRIEF_ISSUE]);
  for (const row of rows) {
    if (row.state === STATE.ACTIVE) await relationships.trash(row.id);
  }
  await devBriefs.trash(id);
  return rows.length;
}

/**
 * ملخّصُ Brief — **مُشتقٌّ من ملاحظاته لا محفوظًا عليه**.
 *
 * ⚠️ عدٌّ محفوظٌ على الـBrief يفترق عن الواقع أوّلَ مرّةٍ تُحلّ ملاحظة
 *    من شاشةٍ أخرى، فيقول «٤ مفتوحة» وفيه ٢. والاشتقاق لا يكذب.
 */
export async function briefSummary(id) {
  const [brief, issues] = await Promise.all([getBrief(id), issuesOfBrief(id)]);
  if (!brief) return null;

  const open = issues.filter((row) => OPEN_STATUSES.includes(row.status));
  const byStatus = {};
  for (const row of issues) byStatus[row.status] = (byStatus[row.status] || 0) + 1;

  return {
    brief,
    issues,
    total: issues.length,
    open: open.length,
    closed: issues.length - open.length,
    byStatus,
  };
}

/** كل الـBriefs بملخّصاتها — قراءةٌ واحدةٌ للوحة. */
export async function briefBoard({ onlyActive = false } = {}) {
  const briefs = await listBriefs({ onlyActive });
  return Promise.all(briefs.map((row) => briefSummary(row.id)));
}

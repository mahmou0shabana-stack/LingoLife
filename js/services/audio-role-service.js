/**
 * LingoLife — تصنيفاتُ الأصوات: كيانٌ لا قائمةٌ ثابتة (WS37)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «لما أضيف فويس المفروض يسألني على التصنيف. وزيّ ما اتفقنا: لو مش
 * >  موجود أضيفه أنا، أو أعدّل واحد قديم — ويتعدّل في البرنامج كله.»
 *
 * وكانت الأدوارُ ستّةً مجمّدةً في `AUDIO_ROLE` داخل `media-service`:
 * لا تُزاد ولا تُسمّى بغير ما سمّيتُها أنا. وهو نفسُ الخطأ الذي عالجناه
 * في أنواع الأحداث ثم لم نُعمّمه — والحياةُ لا تُستوعَب في قائمةٍ
 * كتبتُها في نصف ساعة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ المعرّفُ هو الهُويّة — ولذلك تسري إعادةُ التسمية بلا هجرة
 * ═══════════════════════════════════════════════════════════════
 *
 * `sceneMediaLinks.roles` تحمل **معرّفات** (`original`، `pronunciation`)
 * لا أسماءً معروضة. فالصفوفُ هنا تُبذَر بنفس تلك المعرّفات بالضبط،
 * والاسمُ يُقرأ منها عند العرض. فحين تُسمّي «نطق» باسم «تدريب نطق»
 * يتغيّر الاسمُ **في كلّ تسجيلٍ في التطبيق دفعةً واحدة** — بلا كتابة
 * صفٍّ واحد، وبلا خطرِ هجرةٍ تُخطئ في ملفٍّ من ألف.
 *
 * وهو نفسُ ما كُتب في `type-service`: «إعادةُ التسمية عامّةٌ بطبيعتها
 * لأن المعرّف هو الهويّة — والذكرى تحمل المعرّف لا الاسم».
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولا يُحذف تصنيفٌ مستعمَل
 * ═══════════════════════════════════════════════════════════════
 *
 * حذفُه يترك تسجيلاتٍ تشير إلى لا شيء، فتُعرَض «تسجيل» بلا سبب مفهوم.
 * يُؤرشَف: يختفي من قوائم الاختيار وتبقى تسجيلاتُه تُعرَض باسمه.
 */

import { audioRoles, sceneMediaLinks } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { normalize } from '../utils/normalization.js';

/**
 * المدمجةُ — بمعرّفاتها التي كُتبت على الروابط منذ اليوم الأوّل.
 *
 * ⚠️ **لا يتغيّر معرّفٌ منها أبدًا.** الروابطُ المكتوبة تحمله، وتغييرُه
 *    يعني تسجيلاتٍ تشير إلى تصنيفٍ لا وجود له.
 */
export const BUILT_IN_ROLES = Object.freeze([
  { id: 'original', label: 'التسجيل الأصلي', order: 1 },
  { id: 'scriptVoice', label: 'صوت السكريبت', order: 2 },
  { id: 'conversation', label: 'المحادثة', order: 3 },
  { id: 'retelling', label: 'إعادة سرد', order: 4 },
  { id: 'pronunciation', label: 'نطق', order: 5 },
  { id: 'note', label: 'ملاحظة صوتية', order: 6 },
]);

const BUILT_IN_BY_ID = new Map(BUILT_IN_ROLES.map((r) => [r.id, r]));

function toView(row) {
  return {
    id: row.id,
    label: row.label,
    order: row.order ?? 0,
    builtIn: Boolean(row.builtIn),
    archived: row.state === STATE.ARCHIVED,
  };
}

/**
 * كلُّ التصنيفات — المدمجةُ بتعديلاتك، وما أضفتَه.
 *
 * ⚠️ **والمدمجةُ تُعرَض ولو لم تُكتَب بعد.** البذرُ كسولٌ: لا نكتب ستّةَ
 *    صفوفٍ في قاعدة كلّ مستعمِلٍ لمجرّد فتح الشاشة. فمَن لم يُعدَّل
 *    يُقرأ من الثابت، ومَن عُدِّل له صفٌّ يعلوه.
 */
export async function listRoles({ includeArchived = false } = {}) {
  const rows = await audioRoles.getAll();
  const byId = new Map(rows.map((r) => [r.id, r]));

  const merged = [
    ...BUILT_IN_ROLES.map((b) => toView(byId.get(b.id) || { ...b, builtIn: true, state: STATE.ACTIVE })),
    ...rows.filter((r) => !BUILT_IN_BY_ID.has(r.id)).map(toView),
  ];

  return merged
    .filter((r) => includeArchived || !r.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)
      || String(a.label).localeCompare(String(b.label), 'ar'));
}

/** اسمُ تصنيفٍ بمعرّفه — أو `null` إن كان بلا تصنيف. */
export async function roleLabel(id) {
  if (!id) return null;
  const row = await audioRoles.get(id);
  if (row?.label) return row.label;
  return BUILT_IN_BY_ID.get(id)?.label || null;
}

/** خريطةُ الأسماء دفعةً واحدة — لرسم قائمةٍ بلا سؤالٍ لكلّ صفّ. */
export async function roleLabels() {
  const rows = await audioRoles.getAll();
  const map = new Map(BUILT_IN_ROLES.map((r) => [r.id, r.label]));
  for (const row of rows) map.set(row.id, row.label);
  return map;
}

/**
 * يضيف تصنيفًا جديدًا.
 *
 * ⚠️ **ولا اسمان متطابقان.** التعارضُ يُكشف قبل الحفظ — فقائمةٌ فيها
 *    «نطق» مرّتين تجعل الاختيارَ قرعةً.
 */
export async function addRole(label) {
  const clean = String(label || '').trim();
  if (!clean) throw new Error('التصنيف محتاج اسم');

  const key = normalize(clean);
  const existing = await listRoles({ includeArchived: true });
  if (existing.some((r) => normalize(r.label) === key)) {
    throw new Error('فيه تصنيف بنفس الاسم');
  }

  const order = Math.max(0, ...existing.map((r) => r.order ?? 0)) + 1;
  return audioRoles.create({ label: clean, normalizedName: key, order, builtIn: false });
}

/**
 * يعيد تسمية تصنيف — **ويسري على كلّ تسجيلٍ في التطبيق**.
 *
 * ⚠️ ولا يُكتَب إلّا صفُّ التصنيف: الروابطُ تحمل المعرّفَ لا الاسم.
 *    وللمدمجةِ لا صفَّ بعد، فيُكتَب لها صفٌّ عند أوّل تعديل — وهو
 *    معنى «تُعدَّل ولا تُحذف».
 */
export async function renameRole(id, label) {
  const clean = String(label || '').trim();
  if (!clean) throw new Error('التصنيف محتاج اسم');

  const key = normalize(clean);
  const all = await listRoles({ includeArchived: true });
  if (all.some((r) => r.id !== id && normalize(r.label) === key)) {
    throw new Error('فيه تصنيف بنفس الاسم');
  }

  const row = await audioRoles.get(id);
  if (row) return audioRoles.update(id, { label: clean, normalizedName: key });

  const built = BUILT_IN_BY_ID.get(id);
  if (!built) throw new Error('التصنيف ده مش موجود');
  /* ⚠️ `putRaw` لا `create`: المعرّفُ مفروضٌ علينا — هو ما في الروابط. */
  return audioRoles.putRaw({
    id,
    label: clean,
    normalizedName: key,
    order: built.order,
    builtIn: true,
    state: STATE.ACTIVE,
  });
}

/** كم تسجيلًا يحمل هذا التصنيف؟ — تُعرَض التبعةُ قبل الفعل. */
export async function roleUsage(id) {
  const links = await sceneMediaLinks.getAll();
  return links.filter((l) => l.state === STATE.ACTIVE && (l.roles || []).includes(id)).length;
}

/**
 * يؤرشف تصنيفًا — يختفي من الاختيار وتبقى تسجيلاتُه سليمة.
 *
 * ⚠️ **ولا حذفَ.** الحذفُ يترك تسجيلاتٍ تشير إلى لا شيء.
 */
export async function archiveRole(id) {
  const row = await audioRoles.get(id);
  if (row) return audioRoles.archive(id);

  const built = BUILT_IN_BY_ID.get(id);
  if (!built) throw new Error('التصنيف ده مش موجود');
  return audioRoles.putRaw({
    id,
    label: built.label,
    normalizedName: normalize(built.label),
    order: built.order,
    builtIn: true,
    state: STATE.ARCHIVED,
  });
}

/** يعيد تصنيفًا مؤرشفًا. */
export async function restoreRole(id) {
  const row = await audioRoles.get(id);
  if (!row) return null;
  return audioRoles.restore(id);
}

/** يغيّر تصنيفَ تسجيلٍ داخل ذكرى — الدَّورُ صفةُ العلاقة لا صفةُ الملفّ. */
export async function setMediaRole(sceneId, mediaId, roleId) {
  const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
  const link = links.find((l) => l.mediaId === mediaId && l.state === STATE.ACTIVE);
  if (!link) throw new Error('التسجيل ده مش في الذكرى دي');
  return sceneMediaLinks.update(link.id, { roles: roleId ? [roleId] : [] });
}

/**
 * LingoLife — سياقُ الظهور الواحد (WS-C2، بنود ١٧…٢٤ و٥٣…٥٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الفرقُ الذي يحمل هذا الملفَّ كلَّه
 * ═══════════════════════════════════════════════════════════════
 *
 * **تصنيفُ الكيان**: «الكلمة دي مهمّة بالنسبة لي» — حكمٌ عامٌّ عنها،
 * ومكانُه `savedItems.tagIds` منذ WS35.
 *
 * **سياقُ الظهور**: «المرّة **دي** كانت في فحصٍ مهنيّ» — حكمٌ عن
 * **واقعةٍ بعينها**. ونفسُ الكلمة في محادثةٍ مع صديقٍ سياقُها آخر.
 *
 * وخلطُهما يعني أن وسمَ ظهورٍ واحدٍ يصبغ كلَّ الظهورات — وهو ما يمنعه
 * بند ٤٣ بحرفه: «لا انتشارَ تلقائيًّا».
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا **ليست** في `memoryOccurrences` — وهذا بندٌ حرِج
 * ═══════════════════════════════════════════════════════════════
 *
 * `memoryOccurrences` **مشتقٌّ**: `rebuildIndex()` تمسحه كلَّه وتعيد
 * بناءه من النصوص. فملاحظةٌ كتبتَها بيدك داخل صفٍّ منه **تموت مع أوّل
 * إصلاحٍ للفهرس**. وبند ٥٣ يسمّي ذلك «حرجًا» بالاسم:
 *
 *     «لا تضع تاريخَ المستخدم داخل فهرسٍ مشتقّ.»
 *
 * فالملاحظةُ في `relationships` — مخزنٌ قائمٌ منذ WS1، ثلاثيُّ
 * (من · إلى · نوع)، وهو **بالضبط** شكلُ الملاحظة. ولا يمسّه
 * `rebuildIndex` أصلًا، فينجو بلا سطرٍ واحدٍ يحرسه.
 *
 * ⚠️ **ولا مخزنَ جديد** (بند ٥٥): بحثتُ أوّلًا هل يكفي القائم — وكفى.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والبصمةُ هي التي تجعل النجاةَ صحيحةً لا مجرّد بقاء
 * ═══════════════════════════════════════════════════════════════
 *
 * معرِّفُ الظهور محسوبٌ من (الكلمة · المصدر · الجزء · الجملة · الموضع).
 * فإعادةُ البناء تُنتج **نفسَ المعرِّف** ما دام النصُّ كما هو، فتلتقي
 * الملاحظةُ بظهورها من جديد.
 *
 * وإن تغيّر النصُّ فاختفى ذلك الموضع، صار المعرِّفُ مختلفًا — فتبقى
 * الملاحظةُ **يتيمةً** ولا تُنسَب إلى كلمةٍ أخرى. وبند ٥٤ يطلب هذا
 * بالضبط: «لا تُنسَب خطأً». واليتيمةُ تُعَدّ وتُعرَض ولا تُخفى.
 */

import { link, unlink, linksOf } from '../link-service.js';
import { memoryOccurrences, scenes, relationships } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { listSavedTags, savedTagLabel } from '../saved-service.js';
import { ORIGIN } from './identity.js';

/**
 * نوعُ الرابط — «هذا الظهورُ سياقُه هذا الوسم».
 *
 * ⚠️ ويتبع اصطلاحَ `LINK` نفسَه (`"<من>:<إلى>"`) فلا يصير نوعًا شاذًّا
 *    في مخزنٍ يقرؤه غيرُنا.
 */
export const OCCURRENCE_CONTEXT = 'occurrence:context';

/**
 * مصادرُ السياق — وتُعرَض متمايزةً لا مختلطة (بند ٢٤).
 *
 * ⚠️ **والمشتقُّ لا يُنسَخ إلى المستخدم** (بند ١٩): تصنيفُ المشهد يبقى
 *    في المشهد، ويُقرأ حيًّا. ونسخُه صفًّا يجعل تعديلَ المشهد غدًا
 *    يترك نسخةً كاذبةً هنا، ويجعل «حذفتُ وسمي» يحذف تصنيفَ المصدر.
 */
export const CONTEXT_ORIGIN = Object.freeze({
  USER: ORIGIN.USER,
  DERIVED_SOURCE: 'derived_source',
});

/** وسومُ السياق المتاحة — **نفسُ مفرداتِ التصنيف** لا ثانيةٌ (بند ١٨). */
export async function contextVocabulary() {
  return listSavedTags();
}

/**
 * يضيف وسمَ سياقٍ إلى ظهورٍ بعينه.
 *
 * ⚠️ **ولا يُعاد بناءُ صفّ الظهور** (بند ٢١): الملاحظةُ رابطٌ بجانبه،
 *    فإضافتُها لا تمسّ هُويّةَ الظهور ولا نصَّه.
 */
export async function addContext(occurrenceId, tagId) {
  if (!occurrenceId || !tagId) return null;
  return link(occurrenceId, tagId, OCCURRENCE_CONTEXT);
}

/** يزيل وسمَ سياقٍ عن ظهورٍ بعينه. */
export async function removeContext(occurrenceId, tagId) {
  if (!occurrenceId || !tagId) return null;
  return unlink(occurrenceId, tagId, OCCURRENCE_CONTEXT);
}

/** وسومُ المستخدم على هذا الظهور — معرِّفاتٍ خامّة. */
export async function userContextIds(occurrenceId) {
  const rows = await linksOf(occurrenceId, OCCURRENCE_CONTEXT);
  return [...new Set(rows.map((row) => (row.fromId === occurrenceId ? row.toId : row.fromId)))];
}

/**
 * السياقُ المشتقُّ من المصدر — **يُقرَأ حيًّا ولا يُخزَّن** (بندا ١٩ و٢٣).
 *
 * ⚠️ **ولا يُنسَخ على آلاف الصفوف**: بند ٢٣ يمنع ذلك صراحةً. تصنيفُ
 *    المشهد يُقرأ مرّةً لكلّ مشهدٍ في الشاشة، لا مرّةً لكلّ كلمة.
 */
export async function derivedContext(occurrence) {
  if (!occurrence?.sceneId) return [];
  const scene = await scenes.get(occurrence.sceneId).catch(() => null);
  if (!scene || scene.state !== STATE.ACTIVE) return [];

  const out = [];
  /* نوعُ الموقف — إن كان مكتوبًا في المشهد. */
  if (scene.eventTypeId) out.push({ id: scene.eventTypeId, kind: 'eventType' });
  for (const id of scene.tagIds || []) out.push({ id, kind: 'tag' });
  return out;
}

/**
 * سياقُ ظهورٍ كاملًا — **مفصولًا بمصدره** (بند ٢٤).
 *
 * @returns {{user: {id, label}[], derived: {id, label}[]}}
 */
export async function contextOf(occurrence) {
  const id = typeof occurrence === 'string' ? occurrence : occurrence?.id;
  const row = typeof occurrence === 'string'
    ? await memoryOccurrences.get(id).catch(() => null)
    : occurrence;

  const [userIds, derived] = await Promise.all([
    userContextIds(id),
    derivedContext(row),
  ]);

  return {
    user: await Promise.all(userIds.map(async (tagId) => ({
      id: tagId,
      label: await savedTagLabel(tagId),
      origin: CONTEXT_ORIGIN.USER,
    }))),
    /*
     * ⚠️ **والمشتقُّ موسومٌ بأنه مشتقّ** — الشاشةُ تكتب «من المصدر»
     *    بجانبه (بند ٤٤). وحذفُ وسمِك لا يمسّه، لأنه ليس لك.
     */
    derived: derived.map((one) => ({
      id: one.id,
      label: one.id,
      origin: CONTEXT_ORIGIN.DERIVED_SOURCE,
    })),
  };
}

/**
 * توزيعُ السياق على كيانٍ — «ظهر غالبًا في…» (بند ٢٢).
 *
 * ⚠️ **ومُعلَنٌ أنه مشتقّ**: الكيانُ نفسُه لا يصير «مهنيًّا» لأن أكثرَ
 *    ظهوراته مهنيّة. البندُ ٢٢ صريح، والشاشةُ تكتب «ظهر غالبًا في سياق
 *    مهنيّ» لا «كلمةٌ مهنيّة».
 *
 * ⚠️ **ولا يُخلَط بوسومك على الكيان**: تلك في `captureTags` منفصلةً.
 */
export async function contextDistribution(occurrences) {
  const rows = occurrences || [];
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  /* رحلةٌ واحدةٌ لكلّ ظهور — وهي فهرسٌ لا مسحٌ كامل. */
  const links = await Promise.all(ids.map((id) => linksOf(id, OCCURRENCE_CONTEXT)));

  const counts = new Map();
  links.forEach((group, at) => {
    const occurrence = ids[at];
    for (const row of group) {
      const tagId = row.fromId === occurrence ? row.toId : row.fromId;
      counts.set(tagId, (counts.get(tagId) || 0) + 1);
    }
  });

  return Promise.all([...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(async ([id, times]) => ({ id, times, label: await savedTagLabel(id) })));
}

/**
 * ملاحظاتٌ فقدت ظهورَها — يتيمةٌ تُعَدّ ولا تُنسَب (بند ٥٤).
 *
 * ⚠️ **وهذا هو الجوابُ الصادق** حين يتغيّر النصُّ فيختفي الموضع: لا
 *    نلصق ملاحظتَك بكلمةٍ مجاورة، ولا نمحوها بصمت. تبقى ويُقال كم هي.
 */
export async function orphanContexts() {
  const rows = (await relationships.byIndex('kind', OCCURRENCE_CONTEXT))
    .filter((row) => row.state === STATE.ACTIVE);
  if (!rows.length) return { total: 0, ids: [] };

  const occurrenceIds = [...new Set(rows.map((row) => row.fromId))];
  const found = await memoryOccurrences.getMany(occurrenceIds);
  const alive = new Set(found.filter(Boolean).map((row) => row.id));

  const orphans = occurrenceIds.filter((id) => !alive.has(id));
  return { total: orphans.length, ids: orphans };
}

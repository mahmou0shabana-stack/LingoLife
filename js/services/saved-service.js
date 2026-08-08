/**
 * LingoLife — المحفوظات
 *
 * أثناء التدريب تمرّ بك جملةٌ تعثّر لسانك فيها، أو كلمةٌ تريد أن
 * تعود إليها. المحفوظات هي المكان الذي تلتقطها فيه **في اللحظة**، مع
 * سبب الالتقاط: صعبة؟ محتاجة إعادة؟ نطقها ملخبط؟
 *
 * مبدآن حاكمان:
 *
 *  · **لقطة نصّية لا إشارة.** نحفظ النصّ نفسه لا معرّف المقطع. لو
 *    عدّلت السكريبت أو حذفته، يبقى ما التقطته كما التقطته. `sourceId`
 *    و`segmentId` طريقُ عودةٍ إلى الأصل حين يكون موجودًا، لا مصدرُ
 *    العرض.
 *
 *  · **الحفظ ليس إتقانًا.** بند 19: هذه علامة انتباه منك، لا دليل
 *    على أنك تعلّمت شيئًا. لا يرفع إتقان تعبير ولا يُحسب استخدامًا
 *    حقيقيًّا في حياتك.
 */

import { savedItems, settings } from '../db/repositories.js';
import { normalize } from '../utils/normalization.js';
import { STATE } from '../db/schema.js';

const TAGS_KEY = 'saved.tags';

/** نوع المحفوظ. */
export const SAVED_KIND = Object.freeze({
  SENTENCE: 'sentence',
  WORD: 'word',
});

/**
 * تصنيفات جاهزة — أسبابٌ حقيقية للالتقاط لا فئات مجرّدة.
 * وهي قابلة للإضافة عليها، لأن سببك قد لا يكون في القائمة.
 */
export const BUILT_IN_TAGS = Object.freeze([
  { id: 'hard', label: 'صعبة', builtIn: true },
  { id: 'again', label: 'محتاج إعادة', builtIn: true },
  { id: 'pron', label: 'نطقها صعب', builtIn: true },
  { id: 'useful', label: 'هستخدمها قريب', builtIn: true },
  { id: 'meaning', label: 'معناها مش واضح', builtIn: true },
  { id: 'stress', label: 'النبر ملخبطني', builtIn: true },
]);

/* ------------------------------------------------------------------ *
 * التصنيفات
 * ------------------------------------------------------------------ */

/** التصنيفات المدمجة مع ما أضفته. */
export async function listSavedTags() {
  const custom = (await settings.get(TAGS_KEY, null)) || [];
  const byId = new Map(BUILT_IN_TAGS.map((t) => [t.id, { ...t }]));
  for (const tag of custom) byId.set(tag.id, { ...byId.get(tag.id), ...tag });
  return [...byId.values()].filter((t) => !t.archived);
}

/** تسمية تصنيف بمعرّفه. */
export async function savedTagLabel(id) {
  return (await listSavedTags()).find((t) => t.id === id)?.label || id;
}

/**
 * يضيف تصنيفًا جديدًا.
 * التعارض يُكشف على النصّ المُطبَّع فلا يتكرّر «صعبه» و«صعبة».
 */
export async function addSavedTag(label) {
  const clean = (label || '').trim();
  if (!clean) throw new Error('اسم التصنيف مطلوب');

  const target = normalize(clean);
  const existing = (await listSavedTags()).find((t) => normalize(t.label) === target);
  if (existing) return existing;

  const custom = (await settings.get(TAGS_KEY, null)) || [];
  // معرّف مشتقّ من النصّ المُطبَّع: تصنيفٌ بنفس الاسم يعطي نفس المعرّف
  // حتى لو أُضيف على جهازين، فلا يتضاعف بعد الاسترجاع من نسخة.
  const tag = { id: `t_${target.replace(/\s+/g, '_').slice(0, 24)}`, label: clean, builtIn: false };
  await settings.set(TAGS_KEY, [...custom, tag]);
  return tag;
}

/** يؤرشف تصنيفًا — لا يُحذف، فالمحفوظات المعلَّمة به تبقى مفهومة. */
export async function archiveSavedTag(id, archived = true) {
  const custom = (await settings.get(TAGS_KEY, null)) || [];
  const index = custom.findIndex((t) => t.id === id);
  const merged = { ...(BUILT_IN_TAGS.find((t) => t.id === id) || {}), ...custom[index], id, archived };
  await settings.set(
    TAGS_KEY,
    index >= 0 ? custom.map((t, i) => (i === index ? merged : t)) : [...custom, merged]
  );
  return merged;
}

/* ------------------------------------------------------------------ *
 * العناصر
 * ------------------------------------------------------------------ */

/**
 * يحفظ جملة أو كلمة.
 *
 * @param {{
 *   text: string, kind?: string, tagIds?: string[], note?: string,
 *   translation?: string, sourceType?: string, sourceId?: string,
 *   segmentId?: string, sceneId?: string, sessionId?: string
 * }} input
 */
export async function saveItem({
  text,
  kind = SAVED_KIND.SENTENCE,
  tagIds = [],
  note = '',
  translation = '',
  sourceType = null,
  sourceId = null,
  segmentId = null,
  sceneId = null,
  sessionId = null,
}) {
  const clean = (text || '').trim();
  if (!clean) throw new Error('مفيش نصّ نحفظه');

  const normalizedText = normalize(clean);

  // حفظ نفس النصّ مرّتين لا يُنشئ سجلّين — يضمّ التصنيف الجديد إلى
  // الموجود. أنت تعلّم على شيء واحد بسببين، لا تنشئ شيئين.
  const twin = (await savedItems.byIndex('normalizedText', normalizedText)).find(
    (s) => s.state === STATE.ACTIVE && s.kind === kind
  );

  if (twin) {
    const merged = [...new Set([...(twin.tagIds || []), ...tagIds])];
    return savedItems.update(twin.id, {
      tagIds: merged,
      note: note || twin.note,
      translation: translation || twin.translation,
    });
  }

  return savedItems.create({
    text: clean,
    normalizedText,
    kind,
    tagIds,
    note: note.trim(),
    translation: (translation || '').trim(),
    sourceType,
    sourceId,
    segmentId,
    sceneId,
    sessionId,
    /* ⚠️ الحفظ انتباهٌ لا إتقان (بند 19). */
    impliesMastery: false,
    impliesRealUsage: false,
  });
}

/**
 * يقرأ المحفوظات، الأحدث أولًا.
 * @param {{ tagId?: string, kind?: string, sourceId?: string, limit?: number }} filter
 */
export async function listSaved({ tagId = null, kind = null, sourceId = null, limit = 200 } = {}) {
  const all = await savedItems.getAll();
  return all
    .filter((s) => s.state === STATE.ACTIVE)
    .filter((s) => (kind ? s.kind === kind : true))
    .filter((s) => (sourceId ? s.sourceId === sourceId : true))
    .filter((s) => (tagId ? (s.tagIds || []).includes(tagId) : true))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

/** هل هذا النصّ محفوظ بالفعل؟ — لإضاءة زرّ الحفظ. */
export async function isSaved(text, kind = SAVED_KIND.SENTENCE) {
  const target = normalize((text || '').trim());
  if (!target) return null;
  return (
    (await savedItems.byIndex('normalizedText', target)).find(
      (s) => s.state === STATE.ACTIVE && s.kind === kind
    ) || null
  );
}

/** يضيف تصنيفًا إلى محفوظ أو يشيله. */
export async function toggleItemTag(itemId, tagId) {
  const item = await savedItems.get(itemId);
  if (!item) throw new Error('المحفوظ ده مش موجود');
  const tagIds = item.tagIds || [];
  return savedItems.update(itemId, {
    tagIds: tagIds.includes(tagId) ? tagIds.filter((t) => t !== tagId) : [...tagIds, tagId],
  });
}

/** عدّ المحفوظات لكل تصنيف في مسحة واحدة. */
export async function savedCounts() {
  const rows = await listSaved({ limit: Infinity });
  const counts = new Map();
  for (const row of rows) {
    for (const tagId of row.tagIds || []) counts.set(tagId, (counts.get(tagId) || 0) + 1);
  }
  return counts;
}

/**
 * LingoLife — ربط عناصر الذكرى ببعضها
 *
 * الذكرى ليست أكوامًا منفصلة: **هذه الصورة** لها **هذا السكريبت**
 * و**هذا التسجيل**. بدون ربط صريح تبقى المطابقة في رأسك وحدك، وتضيع
 * بعد شهر.
 *
 * الروابط في `relationships` — store عامّ موجود أصلًا — بدل جدول لكل
 * زوج. إضافة نوع ربط جديد لاحقًا لا تحتاج ترقية schema.
 *
 * الرابط **ثنائيّ الاتجاه منطقيًا**: يُخزَّن مرة واحدة، وتُسأل عنه من
 * أي طرف. تخزينه مرتين يعني احتمال بقاء نصفه عند الحذف.
 */

import { relationships, media, scripts, contentBlocks } from '../db/repositories.js';
import { STATE } from '../db/schema.js';

/** أنواع الربط. */
export const LINK = Object.freeze({
  /** تسجيل ينطق هذا السكريبت. */
  AUDIO_SCRIPT: 'audio:script',
  /** تسجيل يخصّ هذه الصورة (ما قيل وقتها). */
  AUDIO_IMAGE: 'audio:image',
  /** صورة يشرحها هذا السكريبت. */
  IMAGE_SCRIPT: 'image:script',
  /** وسيط مرتبط بكتلة نصّ (نسخة خام، ملاحظة…). */
  MEDIA_BLOCK: 'media:block',
});

export const LINK_LABEL = Object.freeze({
  'audio:script': 'ينطق السكريبت',
  'audio:image': 'صوت الصورة دي',
  'image:script': 'الصورة دي بيشرحها',
  'media:block': 'مرتبط بالنصّ',
});

/** تصنيفات جاهزة للتسجيلات — فوقها يضيف المستخدم ما يشاء. */
export const AUDIO_TAGS = Object.freeze([
  'الأصلي', 'صوتي', 'نطق', 'تصحيح', 'ملاحظة', 'إعادة سرد', 'مهم', 'صعب',
]);

/**
 * ينشئ رابطًا. آمن للتكرار — لا يُنشئ نسختين لنفس الزوج.
 *
 * @param {string} fromId
 * @param {string} toId
 * @param {string} kind — من LINK
 */
export async function link(fromId, toId, kind) {
  if (!fromId || !toId || fromId === toId) return null;

  const existing = await findLink(fromId, toId, kind);
  if (existing) return existing;

  return relationships.create({ fromId, toId, kind, type: kind, note: '' });
}

/** يفكّ رابطًا من أي اتجاه. */
export async function unlink(fromId, toId, kind) {
  const existing = await findLink(fromId, toId, kind);
  if (existing) await relationships.remove(existing.id);
  return Boolean(existing);
}

/** يبحث عن رابط بين طرفين بأي ترتيب. */
async function findLink(fromId, toId, kind) {
  const rows = await relationships.byIndex('fromId', fromId);
  const direct = rows.find((r) => r.toId === toId && r.kind === kind && r.state === STATE.ACTIVE);
  if (direct) return direct;

  const reverse = await relationships.byIndex('toId', fromId);
  return reverse.find((r) => r.fromId === toId && r.kind === kind && r.state === STATE.ACTIVE) || null;
}

/**
 * كل ما يرتبط بعنصر — من الاتجاهين معًا.
 * @param {string} id
 * @param {string} [kind] — تصفية بنوع الربط
 */
export async function linksOf(id, kind = null) {
  const [outgoing, incoming] = await Promise.all([
    relationships.byIndex('fromId', id),
    relationships.byIndex('toId', id),
  ]);

  return [...outgoing, ...incoming]
    .filter((row) => row.state === STATE.ACTIVE && (!kind || row.kind === kind))
    // الطرف الآخر هو ما يهمّ المستدعي، أيًّا كان اتجاه التخزين.
    .map((row) => ({ ...row, otherId: row.fromId === id ? row.toId : row.fromId }));
}

/** يجلب الكيانات المرتبطة فعليًا لا معرّفاتها فقط. */
export async function resolveLinks(id, kind = null) {
  const rows = await linksOf(id, kind);

  const resolved = await Promise.all(
    rows.map(async (row) => {
      const entity =
        (await media.get(row.otherId)) ||
        (await scripts.get(row.otherId)) ||
        (await contentBlocks.get(row.otherId));
      return entity ? { link: row, entity, kind: row.kind } : null;
    })
  );

  return resolved.filter(Boolean);
}

/** يزيل كل روابط عنصر — يُنادى عند حذفه نهائيًا. */
export async function unlinkAll(id) {
  const rows = await linksOf(id);
  await Promise.all(rows.map((row) => relationships.remove(row.id)));
  return rows.length;
}

/* ------------------------------------------------------------------ *
 * التصنيف
 * ------------------------------------------------------------------ */

/** يضبط تصنيفات وسيط. */
export async function setTags(mediaId, tags) {
  const clean = [...new Set((tags || []).map((t) => t.trim()).filter(Boolean))];
  return media.update(mediaId, { tags: clean });
}

/** يضيف أو يزيل تصنيفًا واحدًا. */
export async function toggleTag(mediaId, tag) {
  const record = await media.get(mediaId);
  if (!record) return null;
  const tags = record.tags || [];
  const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
  return setTags(mediaId, next);
}

/** كل التصنيفات المستعملة فعلًا — لاقتراحها عند الإضافة. */
export async function usedTags() {
  const rows = await media.getAll();
  const counts = new Map();
  for (const row of rows) {
    for (const tag of row.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
}

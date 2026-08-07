/**
 * LingoLife — خدمة المشاهد
 *
 * كل منطق المشهد هنا. الشاشات تستدعي هذه الدوال ولا تلمس الـ repositories
 * ولا IndexedDB مباشرة.
 */

import {
  scenes,
  sceneMediaLinks,
  media,
  scripts,
  contentBlocks,
  mistakeComparisons,
  expressionOccurrences,
  places,
} from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { today, monthKey } from '../utils/dates.js';
import { normalize, matches } from '../utils/normalization.js';

/**
 * ينشئ مشهدًا جديدًا.
 * ينشئ معه كتلة Raw Transcript فارغة — النص الأصلي لا يُلمس لاحقًا (بند 27).
 */
export async function createScene({ titleAr, titleRu = '', date, type = 'other', placeName = '', context = '' }) {
  const scene = await scenes.create({
    titleAr: (titleAr || '').trim(),
    titleRu: (titleRu || '').trim(),
    date: date || today(),
    type,
    context: (context || '').trim(),
    placeId: null,
    placeName: (placeName || '').trim(),
    peopleIds: [],
    journeyId: null,
    topicIds: [],
    tagIds: [],
    coverMediaId: null,
    isFavorite: 0,
    privacy: 'private',
    analysisStatus: 'pending',
    sectionOrder: null,
  });

  // كتلة النص الأصلي — تُنشأ فارغة وتبقى مصونة.
  await contentBlocks.create({
    sceneId: scene.id,
    kind: 'rawTranscript',
    text: '',
    version: 1,
    locked: 1,
  });

  return scene;
}

/** يحدّث بيانات المشهد الوصفية. */
export async function updateScene(id, changes) {
  return scenes.update(id, changes);
}

/** يقرأ مشهدًا واحدًا. */
export async function getScene(id) {
  return scenes.get(id);
}

/**
 * يقرأ المشهد مع كل ما يتعلّق به.
 * استعلامات متوازية عبر الفهارس — لا مسح كامل للـ stores.
 */
export async function getSceneFull(id) {
  const scene = await scenes.get(id);
  if (!scene) return null;

  const [links, sceneScripts, blocks, mistakes, occurrences] = await Promise.all([
    sceneMediaLinks.byIndex('sceneId', id),
    scripts.byIndex('sceneId', id),
    contentBlocks.byIndex('sceneId', id),
    mistakeComparisons.byIndex('sceneId', id),
    expressionOccurrences.byIndex('sceneId', id),
  ]);

  const activeLinks = links
    .filter((l) => l.state === STATE.ACTIVE)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const mediaItems = activeLinks.length
    ? (await media.getMany(activeLinks.map((l) => l.mediaId))).filter(Boolean)
    : [];

  return {
    scene,
    links: activeLinks,
    media: mediaItems,
    scripts: sceneScripts.filter((s) => s.state === STATE.ACTIVE),
    blocks,
    mistakes: mistakes.filter((m) => m.state === STATE.ACTIVE),
    occurrences,
    counts: {
      images: mediaItems.filter((m) => m.kind === 'image').length,
      audio: mediaItems.filter((m) => m.kind === 'audio').length,
      scripts: sceneScripts.filter((s) => s.state === STATE.ACTIVE).length,
      mistakes: mistakes.filter((m) => m.state === STATE.ACTIVE).length,
      expressions: occurrences.length,
    },
  };
}

/**
 * المشاهد النشطة مرتّبة من الأحدث إلى الأقدم.
 * يستخدم فهرس `date` بمؤشر معكوس — لا يحمّل الـ store كله.
 */
export async function listScenes({ limit = 50, offset = 0, state = STATE.ACTIVE } = {}) {
  return scenes.page({
    index: 'date',
    direction: 'prev',
    limit,
    offset,
    filter: (rec) => rec.state === state,
  });
}

/** يجمّع المشاهد بالشهر — لعرض الخط الزمني. */
export async function listScenesByMonth(options = {}) {
  const list = await listScenes(options);
  const groups = new Map();

  for (const scene of list) {
    const key = monthKey(scene.date) || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(scene);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({ key, date: items[0].date, scenes: items }));
}

/** أحدث مشهد — بطاقة NOW الكبيرة. */
export async function latestScene() {
  const list = await listScenes({ limit: 1 });
  return list[0] || null;
}

/** عدد المشاهد النشطة. */
export async function countActiveScenes() {
  const all = await scenes.count();
  if (all === 0) return 0;
  const list = await scenes.getAll();
  return list.filter((s) => s.state === STATE.ACTIVE).length;
}

/** نقل إلى السلة — قابل للتراجع دائمًا. */
export async function trashScene(id) {
  return scenes.trash(id);
}

/** استرجاع من السلة. */
export async function restoreScene(id) {
  return scenes.restore(id);
}

/** المشاهد في السلة. */
export async function listTrashed() {
  const all = await scenes.getAll();
  return all
    .filter((s) => s.state === STATE.TRASHED)
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
}

/**
 * بحث محلي في المشاهد.
 * المرحلة 0: العناوين والسياق والمكان.
 * المرحلة 1: يمتد إلى السكريبتات والنصوص والتعليقات عبر searchIndex.
 */
export async function searchScenes(query, { limit = 40 } = {}) {
  if (!query?.trim()) return [];
  const all = await scenes.getAll();
  return all
    .filter((s) => s.state === STATE.ACTIVE)
    .filter((s) =>
      matches([s.titleAr, s.titleRu, s.context, s.placeName].filter(Boolean).join(' '), query)
    )
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit);
}

/** يربط اسم مكان نصّي بكيان Place — يُنشئه إن لم يوجد. */
export async function resolvePlace(name) {
  const clean = (name || '').trim();
  if (!clean) return null;
  const normalized = normalize(clean);
  const existing = await places.oneByIndex('normalizedName', normalized);
  if (existing) return existing;
  return places.create({ name: clean, normalizedName: normalized, notes: '' });
}

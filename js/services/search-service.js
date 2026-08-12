/**
 * LingoLife — البحث في كل شيء
 *
 * كان `searchScenes` موجودة وتعمل — ولا مسار يناديها. `router.js` يوثّق
 * `#/search` ولم يُسجَّل قط. دالّةٌ كاملة بلا باب.
 *
 * وكانت تقرأ `scenes.getAll()`: تُحمِّل كل ذكرياتك في الذاكرة عند كل
 * ضغطة زرّ لتصفّيها. عند ألف ذكرى (بند 105) هذا ثقلٌ بلا مقابل.
 *
 * ---
 *
 * **لماذا لا فهرس معكوس؟**
 *
 * `searchIndex` معرَّف في الـschema منذ البداية ولم يُنشأ قط. بناؤه
 * اليوم يعني: ترقيةً، ومعالجًا على **كل** مسار كتابة يحدّث الرموز، وردمًا
 * للبيانات القائمة، ثم عبئًا دائمًا على كل حفظ.
 *
 * والبديل هنا يكفي: مؤشّر يمرّ على السجلات ويقف عند أول `limit` مطابقة.
 * لا يُحمِّل الـstore في الذاكرة، ويخرج مبكّرًا في الحالة الغالبة — لأن
 * المشاهد تُمسح بترتيب التاريخ تنازليًّا، وما تبحث عنه غالبًا قريب.
 *
 * يُعاد النظر حين يصير البحث بطيئًا محسوسًا على جهازك الفعلي، لا قبل
 * ذلك: بناء آلةٍ لمشكلةٍ لم تقع بعدُ ثمنُه دائم ونفعُه مؤجَّل.
 */

import {
  scenes,
  scripts,
  expressions,
  conversationParts,
  savedItems,
} from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { matches } from '../utils/normalization.js';
import { typeLabel } from './type-service.js';
import { rowLink } from '../components/reveal.js';

/** أقصى ما يُعرض لكل مجموعة — ما بعده «فيه كمان». */
export const PER_GROUP = 12;

/** نصّ مقتطع حول موضع المطابقة، فترى **لماذا** طابق. */
function excerpt(text, query, max = 90) {
  const clean = (text || '').trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;

  // نحاول أن نبدأ قبل أول كلمة من البحث بقليل.
  const first = (query || '').trim().split(/\s+/)[0] || '';
  const at = first ? clean.toLowerCase().indexOf(first.toLowerCase()) : -1;
  const start = at > 40 ? at - 30 : 0;
  return (start ? '…' : '') + clean.slice(start, start + max) + (start + max < clean.length ? '…' : '');
}

/**
 * مجموعات البحث.
 *
 * كلٌّ منها يصف: أين يبحث، وبأي فهرس يمرّ، وكيف يُقرأ الصفّ، وإلى أين
 * ينقلك. إضافة مجال بحثٍ جديد سطرٌ هنا لا دالّة جديدة.
 */
const GROUPS = [
  {
    key: 'scenes',
    label: 'ذكريات',
    icon: 'life',
    repo: scenes,
    // تنازليًّا بالتاريخ: الأحدث أوّلًا، وهو الأرجح أن يكون مقصودك.
    index: 'date',
    direction: 'prev',
    haystack: (r) => [r.titleAr, r.titleRu, r.context, r.placeName].filter(Boolean).join(' '),
    row: (r, q) => ({
      title: r.titleAr || r.titleRu || 'ذكرى بلا عنوان',
      subtitle: [r.date, typeLabel(r.type)].filter(Boolean).join(' · '),
      excerpt: excerpt(r.context, q),
      href: `/scene/${r.id}`,
    }),
  },

  {
    key: 'scripts',
    label: 'سكريبتات',
    icon: 'script',
    repo: scripts,
    index: 'sceneId',
    haystack: (r) => [r.title, r.text].filter(Boolean).join(' '),
    row: (r, q) => ({
      title: r.title || 'سكريبت',
      subtitle: '',
      excerpt: excerpt(r.text, q),
      ru: true,
      /* ⚠️ ينزل إلى السكريبت نفسه لا إلى أعلى الذكرى (WS20). */
      href: rowLink(`/scene/${r.sceneId}`, r.id),
    }),
  },

  {
    key: 'expressions',
    label: 'تعبيرات',
    icon: 'language',
    repo: expressions,
    index: 'normalizedText',
    haystack: (r) => [r.text, r.meaningAr, r.explanation].filter(Boolean).join(' '),
    row: (r, q) => ({
      title: r.text,
      subtitle: r.meaningAr || '',
      excerpt: excerpt(r.explanation, q),
      ru: true,
      href: '/language',
    }),
  },

  {
    key: 'conversationParts',
    label: 'أجزاء محادثة',
    icon: 'chat',
    repo: conversationParts,
    index: 'sceneId',
    haystack: (r) => [r.speaker, r.text, r.translation].filter(Boolean).join(' '),
    row: (r, q) => ({
      title: excerpt(r.text, q, 70),
      subtitle: r.speaker || '',
      ru: true,
      /* ⚠️ ينزل إلى الجملة نفسها — وهو بلاغُك: «يوصّلني ليها بعمق». */
      href: rowLink(`/scene/${r.sceneId}`, r.id),
    }),
  },

  {
    key: 'savedItems',
    label: 'محفوظات',
    icon: 'tag',
    repo: savedItems,
    index: 'createdAt',
    direction: 'prev',
    haystack: (r) => [r.text, r.note, r.translation].filter(Boolean).join(' '),
    row: (r) => ({
      title: r.text,
      subtitle: r.note || (r.kind === 'word' ? 'كلمة' : 'جملة'),
      ru: true,
      href: r.sceneId ? rowLink(`/scene/${r.sceneId}`, r.sourceId || '') : '/language',
    }),
  },
];

/**
 * يبحث في مجموعة واحدة.
 *
 * ⚠️ `limit + 1` عمدًا: الصفّ الزائد لا يُعرض، وإنما يُخبرنا أن هناك
 *    المزيد. بدونه لا نفرّق بين «اثنتا عشرة بالضبط» و«أكثر».
 */
async function searchGroup(group, query, limit) {
  const rows = await group.repo.page({
    index: group.index,
    direction: group.direction || 'next',
    limit: limit + 1,
    filter: (record) =>
      record.state === STATE.ACTIVE && matches(group.haystack(record), query),
  });

  return {
    key: group.key,
    label: group.label,
    icon: group.icon,
    more: rows.length > limit,
    items: rows.slice(0, limit).map((r) => ({ id: r.id, ...group.row(r, query) })),
  };
}

/**
 * يبحث في كل المجالات دفعةً واحدة.
 *
 * @param {string} query
 * @param {{ limit?: number, only?: string }} options `only` يحصر البحث بمجموعة
 * @returns {Promise<{ groups: object[], total: number }>}
 */
export async function searchAll(query, { limit = PER_GROUP, only = null } = {}) {
  if (!query?.trim()) return { groups: [], total: 0 };

  const wanted = only ? GROUPS.filter((g) => g.key === only) : GROUPS;
  const groups = (await Promise.all(wanted.map((g) => searchGroup(g, query, limit))))
    .filter((g) => g.items.length);

  return {
    groups,
    total: groups.reduce((sum, g) => sum + g.items.length, 0),
  };
}

/** أسماء المجموعات — لأزرار التصفية في الشاشة. */
export const SEARCH_GROUPS = GROUPS.map(({ key, label, icon }) => ({ key, label, icon }));

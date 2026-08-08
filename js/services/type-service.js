/**
 * LingoLife — أنواع المشاهد
 *
 * كانت قائمة ثابتة في `config.js`. والحياة لا تُستوعَب في قائمة ثابتة:
 * يظهر لك موقف لا يشبه شيئًا مما توقّعناه، فتضطرّ لحشره في «أخرى»
 * وتفقد معناه.
 *
 * الآن الأنواع **بياناتك** — تضيف وتعدّل وتفرّع. «فحص» يتفرّع إلى
 * «فحص داخلي» و«فحص في الموقع»، وكلاهما يظلّ فحصًا.
 *
 * قواعد حاكمة:
 *  · **لا يُحذف نوع مستعمَل.** حذفه يترك مشاهد بلا نوع. يُؤرشَف بدلًا
 *    من ذلك: يختفي من قوائم الاختيار وتبقى مشاهده سليمة.
 *  · **لا اسمان متطابقان.** التعارض يُكشف قبل الحفظ لا بعده.
 *  · **الأنواع المدمجة تُعدَّل ولا تُحذف** — تعديلها يكتب فوقها نسخةً
 *    خاصّةً بك، والأصل يبقى مرجعًا.
 */

import { settings } from '../db/repositories.js';
import { scenes } from '../db/repositories.js';
import { normalize } from '../utils/normalization.js';
import { newId, PREFIX } from '../utils/ids.js';

const KEY = 'scene.types';

/**
 * الأنواع المدمجة.
 *
 * أسماء من واقع الحياة لا تصنيفات مجرّدة: «اجتماع شغل» أوضح من
 * «عمل»، لأن الذكرى حدث لا فئة.
 */
export const BUILT_IN = Object.freeze([
  { id: 'meeting', label: 'اجتماع شغل', parentId: null, builtIn: true },
  { id: 'inspection', label: 'فحص', parentId: null, builtIn: true },
  { id: 'phone', label: 'مكالمة', parentId: null, builtIn: true },
  { id: 'daily', label: 'موقف يومي', parentId: null, builtIn: true },
  { id: 'shopping', label: 'شراء وطلب', parentId: null, builtIn: true },
  { id: 'official', label: 'مصلحة حكومية', parentId: null, builtIn: true },
  { id: 'doctor', label: 'دكتور وصحّة', parentId: null, builtIn: true },
  { id: 'friends', label: 'قعدة أصحاب', parentId: null, builtIn: true },
  { id: 'travel', label: 'سفر ومواصلات', parentId: null, builtIn: true },
  { id: 'study', label: 'دراسة', parentId: null, builtIn: true },

  // أنواع النسخة القديمة. مؤرشفة: لا تظهر في قوائم الاختيار، لكن
  // المشاهد القديمة المحفوظة بها تبقى تعرض اسمًا مفهومًا بدل معرّف خام.
  { id: 'work', label: 'شغل', parentId: null, builtIn: true, archived: true },
  { id: 'call', label: 'مكالمة (قديم)', parentId: null, builtIn: true, archived: true },
  { id: 'personal', label: 'شخصي', parentId: null, builtIn: true, archived: true },
  { id: 'other', label: 'أخرى', parentId: null, builtIn: true, archived: true },
]);

/** يقرأ ما أضافه المستخدم أو عدّله. */
async function stored() {
  return (await settings.get(KEY, null)) || null;
}

/**
 * كل الأنواع — المدمجة مع تعديلاتك وإضافاتك.
 * المؤرشفة تُستبعَد إلا بطلب صريح.
 */
export async function listTypes({ includeArchived = false } = {}) {
  // تعديلاتك تكتب فوق المدمج بنفس المعرّف؛ الباقي يُضاف.
  const byId = new Map(BUILT_IN.map((t) => [t.id, { ...t }]));
  for (const type of (await stored()) || []) {
    byId.set(type.id, { ...byId.get(type.id), ...type });
  }

  const all = [...byId.values()];
  return includeArchived ? all : all.filter((t) => !t.archived);
}

/** يبني شجرة: الجذور ومعها فروعها. */
export async function typeTree(options = {}) {
  const all = await listTypes(options);
  const roots = all.filter((t) => !t.parentId);
  return roots.map((root) => ({
    ...root,
    children: all.filter((t) => t.parentId === root.id),
  }));
}

/**
 * كاش متزامن للتسميات.
 *
 * شاشات العرض تُبنى بقوالب متزامنة؛ جعلها كلها `async` لأجل قراءة
 * اسم نوع تكلفة غير مبرَّرة. نُحمِّل القائمة مرة عند الإقلاع وبعد كل
 * تعديل، وتقرأ الشاشات من الكاش فورًا.
 */
let cache = null;

/** يعيد تحميل الكاش — يُنادى عند الإقلاع وبعد أي تعديل على الأنواع. */
export async function primeTypes() {
  cache = await listTypes({ includeArchived: true });
  return cache;
}

/** تسمية نوع بمعرّفه — مع اسم الأب إن كان فرعًا. متزامنة. */
export function typeLabel(id) {
  if (!id) return '—';
  const all = cache || BUILT_IN;
  const type = all.find((t) => t.id === id);
  if (!type) return id;
  if (!type.parentId) return type.label;
  const parent = all.find((t) => t.id === type.parentId);
  return parent ? `${parent.label} › ${type.label}` : type.label;
}

/** يحفظ القائمة كاملةً. */
async function persist(list) {
  await settings.set(KEY, list);
  await primeTypes();
  return list;
}

/**
 * يكشف تعارض الاسم قبل الحفظ.
 *
 * المقارنة على النصّ المُطبَّع، فـ«فحص داخلى» و«فحص داخلي» يُعتبران
 * واحدًا — وهما كذلك فعلًا.
 *
 * @returns {{ conflict: boolean, existing?: object }}
 */
export async function checkName(label, { parentId = null, excludeId = null } = {}) {
  const clean = (label || '').trim();
  if (!clean) return { conflict: false, empty: true };

  const target = normalize(clean);
  const all = await listTypes({ includeArchived: true });

  const existing = all.find(
    (t) =>
      t.id !== excludeId &&
      // التعارض يهمّ داخل نفس المستوى: «داخلي» تحت «فحص» لا تعارض
      // «داخلي» تحت «مكالمة» — هما شيئان مختلفان فعلًا.
      (t.parentId || null) === (parentId || null) &&
      normalize(t.label) === target
  );

  return { conflict: Boolean(existing), existing: existing || null };
}

/**
 * يضيف نوعًا.
 * @param {{ label: string, parentId?: string|null }} input
 */
export async function addType({ label, parentId = null }) {
  const clean = (label || '').trim();
  if (!clean) throw new Error('اسم النوع مطلوب');

  const { conflict, existing } = await checkName(clean, { parentId });
  if (conflict) {
    throw new Error(
      existing.archived
        ? `«${existing.label}» موجود بس مؤرشف. رجّعه بدل ما تعمل واحد جديد.`
        : `«${existing.label}» موجود بالفعل${parentId ? ' تحت نفس النوع' : ''}.`
    );
  }

  const list = (await stored()) || [];
  const type = { id: newId(PREFIX.TAG), label: clean, parentId, builtIn: false, archived: false };
  await persist([...list, type]);
  return type;
}

/** يعدّل نوعًا — المدمج يُكتب فوقه بنسخة خاصّة بك. */
export async function updateType(id, changes) {
  const all = await listTypes({ includeArchived: true });
  const current = all.find((t) => t.id === id);
  if (!current) throw new Error('النوع ده مش موجود');

  if (changes.label !== undefined) {
    const { conflict, existing } = await checkName(changes.label, {
      parentId: changes.parentId ?? current.parentId,
      excludeId: id,
    });
    if (conflict) throw new Error(`«${existing.label}» موجود بالفعل.`);
  }

  const list = (await stored()) || [];
  const index = list.findIndex((t) => t.id === id);
  const merged = { ...current, ...changes, id };

  await persist(index >= 0 ? list.map((t, i) => (i === index ? merged : t)) : [...list, merged]);
  return merged;
}

/** كم مشهدًا يستعمل هذا النوع (وفروعه)؟ */
export async function usageCount(id) {
  return (await usageCounts()).get(id) || 0;
}

/**
 * عدّ الاستعمال لكل الأنواع في مسحة واحدة.
 *
 * نداء `usageCount` لكل صفّ في اللوحة كان يقرأ كل المشاهد مرّةً لكل
 * نوع — أربع عشرة قراءة كاملة لرسم قائمة واحدة.
 *
 * @returns {Promise<Map<string, number>>} النوع → عدد مشاهده وفروعه
 */
export async function usageCounts() {
  const all = await listTypes({ includeArchived: true });
  const rows = await scenes.getAll();

  const direct = new Map();
  for (const scene of rows) {
    if (scene.type) direct.set(scene.type, (direct.get(scene.type) || 0) + 1);
  }

  const counts = new Map();
  for (const type of all) {
    // الأب يعدّ مشاهده ومشاهد فروعه: أرشفته تخصّهم كلهم.
    const own = direct.get(type.id) || 0;
    const kids = all
      .filter((t) => t.parentId === type.id)
      .reduce((sum, t) => sum + (direct.get(t.id) || 0), 0);
    counts.set(type.id, own + kids);
  }
  return counts;
}

/**
 * يؤرشف نوعًا — لا يحذفه.
 *
 * ⚠️ الحذف الفعلي يترك مشاهدك بلا نوع، وهذا فقدان معنى لا مكسب
 *    ترتيب. الأرشفة تُخفيه من قوائم الاختيار وتُبقي مشاهده سليمة.
 */
export async function archiveType(id, archived = true) {
  return updateType(id, { archived });
}

/**
 * يستبدل نوعًا بآخر في كل المشاهد ثم يؤرشف القديم.
 * الطريق الصحيح للتخلّص من نوع بلا فقدان بياناته.
 */
export async function mergeInto(fromId, toId) {
  if (fromId === toId) return 0;
  const rows = await scenes.getAll();
  const affected = rows.filter((s) => s.type === fromId);
  await Promise.all(affected.map((s) => scenes.update(s.id, { type: toId })));
  await archiveType(fromId, true);
  return affected.length;
}

/** يعيد الأنواع إلى المدمجة — يمسح تعديلاتك لا مشاهدك. */
export async function resetTypes() {
  await settings.remove(KEY);
  await primeTypes();
  return BUILT_IN;
}

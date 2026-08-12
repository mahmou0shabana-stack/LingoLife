/**
 * LingoLife — أنواع الأحداث
 *
 * كانت قائمة ثابتة في `config.js`، ثم كتلة JSON في `settings`، والآن
 * **كيانٌ في القاعدة**. والحياة لا تُستوعَب في قائمة ثابتة: يظهر لك
 * موقف لا يشبه شيئًا مما توقّعناه، فتضطرّ لحشره في «أخرى» وتفقد معناه.
 *
 * ───────────────────────────────────────────────────────────────
 * لماذا انتقلت من `settings` إلى مستودعٍ خاصّ؟
 *
 * الكتلة تُقرأ كاملةً أو لا تُقرأ. وما يلزم الآن استعلامٌ لا قراءة:
 * «مَن يحمل هذا الاسم المطبَّع؟» عند كل ضغطة مفتاح، و«كم ذكرى تستعمل
 * هذا النوع؟» قبل أي تغيير عام، و«ما فروع هذا النوع؟» في كل رسم.
 * وكلّها فوق كتلةٍ تعني مسحًا كاملًا في الذاكرة.
 *
 * والأهمّ: **الخيوط والمشاريع والأشخاص كلها ستحتاج نفس النمط.** بناء
 * الأنواع ككيان أوّلًا يعني أن ما بعدها يُبنى مرّةً لا مرّتين.
 * ───────────────────────────────────────────────────────────────
 *
 * قواعد حاكمة:
 *  · **لا يُحذف نوع مستعمَل.** حذفه يترك مشاهد بلا نوع. يُؤرشَف بدلًا
 *    من ذلك: يختفي من قوائم الاختيار وتبقى مشاهده سليمة.
 *  · **لا اسمان متطابقان** في نفس المستوى. التعارض يُكشف قبل الحفظ.
 *  · **الأنواع المدمجة تُعدَّل ولا تُحذف.**
 *  · **إعادة التسمية عامّة بطبيعتها** لأن المعرّف هو الهويّة — والذكرى
 *    تحمل المعرّف لا الاسم. لكن العموم لا يكون صامتًا: تُعرَض التبعة
 *    قبل الفعل (بند 10).
 */

import { eventTypes, scenes, settings } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { BUILT_IN_EVENT_TYPES } from '../db/seeds.js';
import { normalize } from '../utils/normalization.js';
import { newId, PREFIX } from '../utils/ids.js';
import { pairs, SIGNAL } from './similarity/engine.js';

/**
 * ⚠️ الكتلة القديمة. تُقرأ عند الحاجة ولا تُكتب ولا تُحذف — شبكة
 *    أمان للرجوع (بند 107). راجع ترقية v7.
 */
const LEGACY_KEY = 'scene.types';

/** المدمجة كما كانت تُصدَّر — لا يزال الاختبار والواجهة يقرآنها. */
export const BUILT_IN = Object.freeze(
  BUILT_IN_EVENT_TYPES.map((t) => Object.freeze({
    id: t.id,
    label: t.label,
    parentId: t.parentId,
    builtIn: true,
    archived: t.state === STATE.ARCHIVED,
  }))
);

/**
 * شكل الصفّ كما تراه الشاشات.
 *
 * الشاشات تقرأ `archived` منذ أوّل يوم، والمستودع يخزّن `state`.
 * الترجمة هنا في مكانٍ واحد بدل أن تتكرّر في كل شاشة.
 */
function toView(record) {
  return {
    id: record.id,
    label: record.label,
    parentId: record.parentId ?? null,
    aliases: record.aliases || [],
    order: record.order ?? 0,
    icon: record.icon ?? null,
    color: record.color ?? null,
    builtIn: Boolean(record.builtIn),
    archived: record.state === STATE.ARCHIVED,
  };
}

/** ترتيبٌ مستقرّ: `order` ثم الاسم — فلا تقفز القائمة بين رسمتين. */
function inOrder(rows) {
  return rows.sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.label).localeCompare(String(b.label), 'ar')
  );
}

/**
 * كل الأنواع — المدمجة مع تعديلاتك وإضافاتك.
 * المؤرشفة تُستبعَد إلا بطلب صريح.
 */
export async function listTypes({ includeArchived = false } = {}) {
  const rows = await eventTypes.getAll();
  const visible = includeArchived ? rows : rows.filter((r) => r.state !== STATE.ARCHIVED);
  // المحذوف لا يظهر أبدًا — لا بطلبٍ صريح ولا بدونه. له السلة.
  return inOrder(visible.filter((r) => r.state !== STATE.TRASHED)).map(toView);
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

/* ------------------------------------------------------------------ *
 * الكاش المتزامن
 * ------------------------------------------------------------------ */

/**
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

/* ------------------------------------------------------------------ *
 * الكتابة
 * ------------------------------------------------------------------ */

/** كتابةٌ واحدة: تُحدّث السجل، تُعيد حساب التطبيع، وتُنعش الكاش. */
async function write(id, fields) {
  const patch = { ...fields, updatedAt: Date.now() };
  if (fields.label !== undefined) patch.normalizedName = normalize(fields.label);
  const saved = await eventTypes.update(id, patch);
  await primeTypes();
  return toView(saved);
}

/**
 * يكشف تعارض الاسم قبل الحفظ.
 *
 * المقارنة على النصّ المُطبَّع، فـ«فحص داخلى» و«فحص داخلي» يُعتبران
 * واحدًا — وهما كذلك فعلًا. والأسماء البديلة تُحسب: لو سمّيت نوعًا
 * باسمٍ هو `alias` لنوعٍ آخر فأنت تعني ذلك النوع.
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
      (normalize(t.label) === target || t.aliases.some((a) => normalize(a) === target))
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

  const siblings = (await listTypes({ includeArchived: true })).filter(
    (t) => (t.parentId || null) === (parentId || null)
  );

  const created = await eventTypes.create({
    id: newId(PREFIX.EVENT_TYPE),
    label: clean,
    normalizedName: normalize(clean),
    parentId,
    aliases: [],
    // في آخر إخوته: الجديد يُضاف حيث تتوقّعه، لا في وسط القائمة.
    order: siblings.reduce((max, t) => Math.max(max, t.order ?? 0), -1) + 1,
    icon: null,
    color: null,
    builtIn: false,
  });

  await primeTypes();
  return toView(created);
}

/** يعدّل نوعًا — المدمج يُعدَّل كغيره، ولا يُحذف. */
export async function updateType(id, changes) {
  const current = await eventTypes.get(id);
  if (!current) throw new Error('النوع ده مش موجود');

  if (changes.label !== undefined) {
    const { conflict, existing } = await checkName(changes.label, {
      parentId: changes.parentId ?? current.parentId,
      excludeId: id,
    });
    if (conflict) throw new Error(`«${existing.label}» موجود بالفعل.`);
  }

  const patch = { ...changes };
  // `archived` لغة الشاشات و`state` لغة القاعدة — الترجمة هنا لا هناك.
  if (changes.archived !== undefined) {
    patch.state = changes.archived ? STATE.ARCHIVED : STATE.ACTIVE;
    delete patch.archived;
  }
  if (changes.parentId !== undefined && !isSafeParent(id, changes.parentId)) {
    throw new Error('مينفعش نوع يبقى تحت نفسه');
  }

  return write(id, patch);
}

/** يمنع أن يصير النوع أبًا لنفسه — حلقةٌ تُجمِّد بناء الشجرة. */
function isSafeParent(id, parentId) {
  return !parentId || parentId !== id;
}

/**
 * ينقل نوعًا تحت أبٍ آخر، أو يجعله جذرًا (`parentId = null`).
 *
 * ⚠️ لا ننقل نوعًا تحت أحد فروعه: الشجرة تصير حلقةً و`typeTree`
 *    تدور بلا نهاية. الفحص هنا لا في الواجهة.
 */
export async function moveType(id, parentId = null) {
  if (parentId) {
    const chain = await ancestorsOf(parentId);
    if (parentId === id || chain.includes(id)) {
      throw new Error('مينفعش تحطّ النوع تحت واحد من فروعه');
    }
  }
  return updateType(id, { parentId: parentId || null });
}

/** سلسلة الآباء صعودًا — للكشف عن الحلقات. */
async function ancestorsOf(id) {
  const all = await listTypes({ includeArchived: true });
  const byId = new Map(all.map((t) => [t.id, t]));
  const chain = [];
  let cursor = byId.get(id);
  // حدٌّ أعلى يمنع الدوران الأبدي لو وُجدت حلقةٌ في بياناتٍ قديمة.
  while (cursor?.parentId && chain.length < all.length) {
    chain.push(cursor.parentId);
    cursor = byId.get(cursor.parentId);
  }
  return chain;
}

/** يعيد ترتيب إخوةٍ بالمعرّفات، بالترتيب المُعطى. */
export async function reorderTypes(ids) {
  await Promise.all(ids.map((id, index) => eventTypes.update(id, { order: index })));
  await primeTypes();
  return ids.length;
}

/** يضيف اسمًا بديلًا — «الكشف الطبّي» و«دكتور وصحّة» شيءٌ واحد عندك. */
export async function addAlias(id, alias) {
  const clean = (alias || '').trim();
  if (!clean) throw new Error('الاسم البديل مطلوب');

  const current = await eventTypes.get(id);
  if (!current) throw new Error('النوع ده مش موجود');

  const { conflict, existing } = await checkName(clean, {
    parentId: current.parentId,
    excludeId: id,
  });
  if (conflict) throw new Error(`«${existing.label}» موجود بالفعل — مينفعش يبقى اسمًا بديلًا.`);

  const aliases = current.aliases || [];
  if (aliases.some((a) => normalize(a) === normalize(clean))) return toView(current);
  return write(id, { aliases: [...aliases, clean] });
}

export async function removeAlias(id, alias) {
  const current = await eventTypes.get(id);
  if (!current) throw new Error('النوع ده مش موجود');
  return write(id, {
    aliases: (current.aliases || []).filter((a) => normalize(a) !== normalize(alias)),
  });
}

/* ------------------------------------------------------------------ *
 * الاستعمال والتبعة
 * ------------------------------------------------------------------ */

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
    // ⚠️ `type` هو المصدر ما دام `eventTypeId` يُكتب معه (دورة §3.6).
    //    القراءة منه تُبقي المشاهد التي لم تُلمس منذ الترقية محسوبة.
    const key = scene.type ?? scene.eventTypeId;
    if (key) direct.set(key, (direct.get(key) || 0) + 1);
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
 * ماذا يترتّب على تغيير هذا النوع؟ (بند 10)
 *
 * إعادة التسمية عامّة بطبيعتها هنا — الذكرى تحمل المعرّف لا الاسم —
 * لكن العموم لا يكون صامتًا. الواجهة تسأل هذا قبل الفعل فتقول:
 * «مستعمَل في 27 ذكرى» ← [حدّث في الكل] · [أنشئ نوعًا جديدًا] · [إلغاء].
 */
export async function renameImpact(id, nextLabel) {
  const type = (await listTypes({ includeArchived: true })).find((t) => t.id === id);
  if (!type) throw new Error('النوع ده مش موجود');

  const counts = await usageCounts();
  const children = (await listTypes({ includeArchived: true })).filter((t) => t.parentId === id);

  return {
    id,
    from: type.label,
    to: (nextLabel || '').trim(),
    scenes: counts.get(id) || 0,
    children: children.length,
    builtIn: type.builtIn,
  };
}

/* ------------------------------------------------------------------ *
 * التشابه — اقتراح لا دمج (بند 11)
 * ------------------------------------------------------------------ */

/**
 * أنواعٌ تبدو واحدًا مكرّرًا.
 *
 * ⚠️ **اقتراحٌ لا دمج تلقائي.** «فحص داخلي» و«فحص خارجي» متشابهان
 *    نصًّا ومختلفان تمامًا معنًى — والآلة لا تعرف الفرق، وأنت تعرفه.
 *    فنعرض ولا نفعل.
 *
 * @returns {Promise<{a: object, b: object, distance: number, reason: string}[]>}
 */
export async function similarTypes({ maxDistance = 2 } = {}) {
  const all = await listTypes({ includeArchived: true });

  /*
   * ⚠️ كان هنا حلقةٌ مزدوجة بسياستها الخاصّة — وهي الثانية من ثلاث
   *    سياساتٍ متطابقةِ الشكل مختلفةِ التفاصيل (`import/plan.js`
   *    و`dev/issue-service.js` هما الأخريان). الملحق في **K7** يطلب
   *    محرّكًا واحدًا، فصارت السياسة **مُعلَنةً** في
   *    `similarity/engine.js` تحت اسم `labels`:
   *
   *      · التطابق بعد التطبيع  → `SAME`
   *      · الاسم البديل         → `ALIAS`  (جديد: لم يكن يُفحَص)
   *      · الفرق حرفٌ أو حرفان  → `TYPO`
   *      · واحتواءُ اسمٍ لآخر    → `reject` — تفريعٌ لا تكرار
   *
   *    والمخرَج لم يتغيّر: `{ a, b, distance, reason }` بنفس الترتيب.
   */
  const found = pairs(all, {
    profile: 'labels',
    shape: (row) => ({ names: [row.label, ...(row.aliases || [])].filter(Boolean) }),
    // مستويان مختلفان ليسا تكرارًا: «داخلي» تحت «فحص» غير «داخلي»
    // تحت «مكالمة» — وهو نفس منطق كشف التعارض.
    accept: (a, b) => (a.parentId || null) === (b.parentId || null),
  });

  return found
    .map((pair) => {
      const typo = pair.signals.find((signal) => signal.id === SIGNAL.TYPO);
      /*
       * ⚠️ التطابقُ التامّ **لا ينشأ من الواجهة**: `checkName` تمنعه
       *    قبل الحفظ. فوجودُه هنا يعني بياناتٍ دخلت من طريقٍ آخر —
       *    الكتلة القديمة قبل ترقية v7، أو استرجاع نسخة، أو استيراد.
       *    وهي أحقّ ما يُعرَض، فمسافتُها صفر وتتصدّر.
       */
      const distance = typo ? typo.distance : 0;
      return { a: pair.a, b: pair.b, distance, reason: pair.why[0] || 'نفس الاسم بالضبط' };
    })
    .filter((pair) => pair.distance <= maxDistance)
    .sort((x, y) => x.distance - y.distance);
}

/* ------------------------------------------------------------------ *
 * الأرشفة والدمج
 * ------------------------------------------------------------------ */

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
  const affected = rows.filter((s) => (s.type ?? s.eventTypeId) === fromId);
  // الحقلان معًا دورةً كاملة (§3.6): `type` للقارئ القديم،
  // و`eventTypeId` للقارئ الجديد، حتى يُحذف الأوّل في دورةٍ لاحقة.
  await Promise.all(
    affected.map((s) => scenes.update(s.id, { type: toId, eventTypeId: toId }))
  );
  await archiveType(fromId, true);
  return affected.length;
}

/**
 * يعيد الأنواع إلى المدمجة — يمسح تعديلاتك لا مشاهدك.
 *
 * ⚠️ لا يمسّ `settings['scene.types']`: تلك شبكة الأمان للرجوع من
 *    ترقية v7 (بند 107)، ومسحها هنا يُفرّغها من غرضها.
 */
export async function resetTypes() {
  const rows = await eventTypes.getAll();
  await Promise.all(rows.map((r) => eventTypes.destroy(r.id)));

  const now = Date.now();
  await Promise.all(
    BUILT_IN_EVENT_TYPES.map((seed) =>
      eventTypes.putRaw({
        ...seed,
        normalizedName: normalize(seed.label),
        createdAt: now,
        updatedAt: now,
      })
    )
  );

  await primeTypes();
  return BUILT_IN;
}

/**
 * الكتلة القديمة كما هي على القرص — للتشخيص والرجوع لا للقراءة
 * اليومية. راجع ترقية v7.
 */
export async function legacyTypesSnapshot() {
  return settings.get(LEGACY_KEY, null);
}

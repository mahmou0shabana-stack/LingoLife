/**
 * LingoLife — كاشف المكرَّر (الملحق · G)
 *
 * سؤالٌ واحد: **هل عندي نفس الحاجة مرّتين؟** — للأشخاص والأنواع
 * والخيوط والمحفوظات.
 *
 * ---
 *
 * ## ثلاث قواعد
 *
 * **١ · لا دمج تلقائيّ أبدًا (G3).** هذا الملفّ يقرأ ويقترح. الضمّ
 * دالّةٌ منفصلة لا تُنادى إلا من زرٍّ تضغطه، ولا تُنادى من الكشف.
 *
 * **٢ · وكل اقتراحٍ يقول سببه (G2).** «أغلب الظنّ» وحدها لا تكفي —
 * معها الإشاراتُ التي بنَتها: الفرق حرفٌ واحد، أو اسمٌ تانٍ، أو كلماتٌ
 * مشتركة.
 *
 * **٣ · و«مش هما» رأيٌ يُحفَظ.** أداةٌ تعرض عليك نفس الزوج الخاطئ كل
 * مرّة تصير ضجيجًا، فتُغلَق. فحكمُك يُحفَظ ويُطبَّق.
 *
 * ---
 *
 * ## أين يُحفَظ «مش هما» — ولماذا بلا ترقية
 *
 * في `settings` تحت مفتاحٍ واحد، لا في مستودعٍ جديد. ثلاثة أسباب:
 *
 *   * العدد **عشراتٌ لا آلاف** — أنت مَن يضغط، مرّةً لكل زوجٍ خاطئ.
 *   * `settings` **داخلةٌ في النسخة الاحتياطيّة** أصلًا؛ ومستودعٌ جديد
 *     يحتاج بندًا في صيغة النسخ وحارسًا في السلّة وترقيةً — كلفةٌ
 *     لبيانٍ حجمُه كيلوبايت.
 *   * ولا يُستعلَم عنه بفهرس: يُقرأ كلُّه مرّةً عند الكشف.
 *
 * يُعاد النظر لو صار الحكمُ كيانًا له تاريخٌ ومَن حكم — ولا حاجة اليوم.
 */

import { settings, savedItems } from '../../db/repositories.js';
import { normalize } from '../../utils/normalization.js';
import { listPeople, mergePeople } from '../person-service.js';
import { listTypes, mergeInto } from '../type-service.js';
import { listThreads } from '../thread-service.js';
import { pairs, VERDICT, VERDICT_META } from './engine.js';

const JUDGEMENTS_KEY = 'similarity.different';

/* ------------------------------------------------------------------ *
 * ما لا يُكشَف — وسببه مكتوب
 * ------------------------------------------------------------------ */

/**
 * ⚠️ ليست نقصًا بل قرارًا. الملحق يطلب كشف المكرَّر، ولا يطلب أن
 *    نسمّي كلَّ تشابهٍ تكرارًا.
 */
export const NOT_DEDUPED = Object.freeze([
  {
    id: 'scenes',
    label: 'الذكريات',
    why: 'ذكريتان بنفس العنوان في يومين مختلفين **ليستا** واحدة — «مكالمة مع إيجور» تتكرّر كل أسبوع. والذكرى واقعةٌ بتاريخ، والتاريخ يفرّق. والتشابه بينها معروضٌ في «شبيه بده» لا هنا.',
  },
  {
    id: 'expressions',
    label: 'التعبيرات',
    why: 'المكرَّر **مستحيلٌ بالبناء**: `expressions.normalizedText` فهرسٌ فريد منذ أوّل يوم، فالتعبير الواحد صفٌّ واحد.',
  },
  {
    id: 'conversationParts',
    label: 'أجزاء المحادثة',
    why: 'تكرار الجملة في محادثتين ليس خطأً بل ملاحظةً — وهي معروضةٌ في التحليل ضمن «ما يتكرّر عندك».',
  },
  {
    id: 'media',
    label: 'الصور والصوت',
    why: 'المقارنة بالاسم كذبٌ (`IMG_0231` مرّتان لصورتين مختلفتين)، وبالمحتوى تحتاج بصمةً على كل ملفّ — ولم تُبنَ.',
  },
]);

/* ------------------------------------------------------------------ *
 * مجالات الكشف
 * ------------------------------------------------------------------ */

/**
 * إضافة مجالٍ غدًا = **سطرٌ هنا**. لا شاشة تُلمَس ولا دالّة تُكتب —
 * نفس عقد `ASPECTS` في الاستوديو و`GROUPS` في البحث.
 */
export const SCOPES = Object.freeze([
  {
    id: 'people',
    label: 'الأشخاص',
    icon: 'person',
    profile: 'names',
    load: () => listPeople({ includeArchived: false }),
    shape: (row) => ({
      names: [row.name, row.nameRu, row.nameAr, ...(row.aliases || [])].filter(Boolean),
    }),
    labelOf: (row) => row.name,
    hintOf: (row) => [row.role, row.company].filter(Boolean).join(' · '),
    merge: mergePeople,
    mergeLabel: 'اضمّهم في واحد',
    mergeHint: 'كلامه وحضوره ينتقلان، واسمه يبقى اسمًا بديلًا، والقديم يُؤرشَف لا يُحذَف',
  },

  {
    id: 'types',
    label: 'أنواع الأحداث',
    icon: 'tag',
    profile: 'labels',
    load: () => listTypes({ includeArchived: false }),
    shape: (row) => ({ names: [row.label, ...(row.aliases || [])].filter(Boolean) }),
    labelOf: (row) => row.label,
    hintOf: (row) => (row.parentId ? 'نوعٌ فرعيّ' : ''),
    // ⚠️ نوعان تحت أبوين مختلفين ليسا مكرَّرًا: «فحص» تحت «شغل» وتحت
    //    «صحّة» شيئان. وهو نفس شرط `similarTypes` قبل التوحيد.
    accept: (a, b) => (a.parentId || null) === (b.parentId || null),
    merge: mergeInto,
    mergeLabel: 'اضمّهم في واحد',
    mergeHint: 'كل ذكرياته تنتقل للنوع الباقي، والقديم يُؤرشَف',
  },

  {
    id: 'threads',
    label: 'خيوط الأحداث',
    icon: 'link',
    profile: 'names',
    load: () => listThreads({ includeArchived: false }),
    shape: (row) => ({ names: [row.title].filter(Boolean), text: row.description || '' }),
    labelOf: (row) => row.title,
    hintOf: (row) => row.status || '',
    merge: null,
    whyNoMerge: 'ضمُّ خيطين يعني نقل ذكرياتٍ بين قصّتين — وترتيبُ القصّة معناها. افتح الاتنين وانقل بنفسك.',
  },

  {
    id: 'saved',
    label: 'المحفوظات',
    icon: 'tag',
    profile: 'names',
    load: async () => (await savedItems.getActive()).filter((row) => row.text),
    shape: (row) => ({ names: [row.text].filter(Boolean) }),
    labelOf: (row) => row.text,
    hintOf: (row) => row.note || (row.kind === 'word' ? 'كلمة' : 'جملة'),
    merge: null,
    whyNoMerge: 'المحفوظ لقطةٌ بسياقها ومصدرها. الزائد يُحذَف بالسلّة، ولا يُضمّ.',
  },
]);

export const scopeById = (id) => SCOPES.find((scope) => scope.id === id) || null;

/* ------------------------------------------------------------------ *
 * «مش هما»
 * ------------------------------------------------------------------ */

/**
 * مفتاحٌ لا يتأثّر بالترتيب: زوجٌ واحدٌ مفتاحٌ واحد مهما جاء أوّلًا.
 * ⚠️ بدون الفرز يصير «أ‑ب» غير «ب‑أ»، فيعود الزوج المرفوض من الباب
 *    الآخر في الكشف التالي.
 */
export function pairKey(scopeId, aId, bId) {
  return [scopeId, ...[String(aId), String(bId)].sort()].join('|');
}

/** كل ما قلتَ عنه «مش هما» — مجموعةُ مفاتيح. */
export async function judgements() {
  const stored = await settings.get(JUDGEMENTS_KEY, null);
  return new Set(Array.isArray(stored?.keys) ? stored.keys : []);
}

/** يسجّل أن هذين ليسا واحدًا. */
export async function markDifferent(scopeId, aId, bId) {
  const keys = await judgements();
  keys.add(pairKey(scopeId, aId, bId));
  await settings.set(JUDGEMENTS_KEY, { keys: [...keys], updatedAt: Date.now() });
  return keys.size;
}

/** يتراجع عن الحكم — فيعود الزوج للاقتراح. */
export async function unmarkDifferent(scopeId, aId, bId) {
  const keys = await judgements();
  keys.delete(pairKey(scopeId, aId, bId));
  await settings.set(JUDGEMENTS_KEY, { keys: [...keys], updatedAt: Date.now() });
  return keys.size;
}

/* ------------------------------------------------------------------ *
 * الكشف
 * ------------------------------------------------------------------ */

/**
 * يكشف مكرَّر مجالٍ واحد.
 *
 * @param {string} scopeId
 * @param {{min?: string, includeDismissed?: boolean}} options
 */
export async function findDuplicates(scopeId, { min = VERDICT.MAYBE, includeDismissed = false } = {}) {
  const scope = scopeById(scopeId);
  if (!scope) throw new Error(`مجال كشفٍ مش معروف: ${scopeId}`);

  const [rows, dismissedKeys] = await Promise.all([scope.load(), judgements()]);
  const found = pairs(rows, {
    profile: scope.profile,
    shape: scope.shape,
    accept: scope.accept || null,
    min,
  });

  const out = found.map((pair) => {
    const key = pairKey(scope.id, pair.a.id, pair.b.id);
    return {
      key,
      scopeId: scope.id,
      verdict: pair.verdict,
      verdictLabel: VERDICT_META[pair.verdict].label,
      score: pair.score,
      why: pair.why,
      signals: pair.signals,
      dismissed: dismissedKeys.has(key),
      a: { id: pair.a.id, label: scope.labelOf(pair.a), hint: scope.hintOf(pair.a) },
      b: { id: pair.b.id, label: scope.labelOf(pair.b), hint: scope.hintOf(pair.b) },
    };
  });

  return includeDismissed ? out : out.filter((pair) => !pair.dismissed);
}

/**
 * يمسح كل المجالات.
 *
 * ⚠️ العدد المعروض = الأزواج **غير المرفوضة**. لو عدّ المرفوضة صار
 *    «فيه ٧ تكرارات» رقمًا لا يقابله شيءٌ على الشاشة.
 */
export async function scanAll({ min = VERDICT.MAYBE } = {}) {
  const results = await Promise.all(
    SCOPES.map(async (scope) => ({
      id: scope.id,
      label: scope.label,
      icon: scope.icon,
      mergeable: Boolean(scope.merge),
      whyNoMerge: scope.whyNoMerge || '',
      pairs: await findDuplicates(scope.id, { min }),
    }))
  );

  return {
    scopes: results,
    total: results.reduce((sum, scope) => sum + scope.pairs.length, 0),
  };
}

/**
 * يضمّ زوجًا — **الطريق الوحيد**، وبتصريحٍ صريح.
 *
 * ⚠️ `confirm: true` ليست شكليّة: هي التي تجعل استدعاءً عابرًا من كودٍ
 *    آخر يرمي بدل أن يضمّ. الضمّ يعدّل مئات الصفوف ولا يُتراجَع عنه
 *    بضغطة.
 */
export async function mergePair(scopeId, keepId, dropId, { confirm = false } = {}) {
  const scope = scopeById(scopeId);
  if (!scope) throw new Error(`مجال كشفٍ مش معروف: ${scopeId}`);
  if (!scope.merge) throw new Error(scope.whyNoMerge || 'المجال ده مش بيتضمّ');
  if (!confirm) throw new Error('الضمّ محتاج تأكيدًا صريحًا — مفيش ضمّ تلقائي');

  const result = await scope.merge(dropId, keepId);
  return { scopeId, keepId, dropId, result };
}

/** أسماءٌ للعرض — لأزرار التصفية. */
export const DUP_SCOPES = SCOPES.map(({ id, label, icon }) => ({ id, label, icon }));

/** يعيد المفتاح إلى أجزائه — للاختبارات والتشخيص. */
export function readKey(key) {
  const [scopeId, a, b] = String(key).split('|');
  return { scopeId, a, b };
}

/** تطبيعٌ مكشوف للاختبارات: نفس ما يراه المحرّك. */
export const seenAs = normalize;

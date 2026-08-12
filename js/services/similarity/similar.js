/**
 * LingoLife — «شبيه بده» (الملحق · K)
 *
 * البحث يجيب عمّا **تكتبه**. وهذا يجيب عمّا **تنظر إليه**: أنت في
 * ذكرى، والسؤال «فيه ذكرياتٌ تانية زيّها؟» — بلا أن تعرف مقدَّمًا
 * الكلمة التي تجمعها.
 *
 * ---
 *
 * ## بجانب البحث لا بدلًا منه (K5)
 *
 * `search-service.js` **لم يُمَسّ**. عقده «يحتوي» بتطبيع، وهو مفهومٌ
 * ومختبَرٌ ويعمل. وهذا مسارٌ ثانٍ بسؤالٍ ثانٍ ونتيجةٍ من نوعٍ ثانٍ:
 * البحث يعطي مطابقات، وهذا يعطي **ترشيحاتٍ لكلٍّ سببٌ**.
 *
 * ⚠️ ولا يُخلَطان في شاشةٍ واحدة بلا فاصل: نتيجةٌ مؤكَّدة ونتيجةٌ
 *    مرجَّحة في قائمةٍ واحدة تجعل المؤكَّد مشكوكًا فيه.
 *
 * ---
 *
 * ## وأقوى إشارةٍ في الذكريات ليست الكلمات
 *
 * كلمتان مشتركتان قد تكونان مصادفة. أمّا **نفس الشخص** و**نفس القصّة**
 * فروابطُ أنشأتَها بيدك — فتُوزَن أثقل (`SHARED` = ٥ لكلٍّ مقابل ٢
 * للكلمة). وهذا هو الفرق بين «شبيه» و«فيه نفس الحروف».
 *
 * ---
 *
 * ## والقراءة ثابتةُ العدد
 *
 * تُبنى على `readWorld()` من الاستوديو — سبع قراءاتٍ مهما كان عدد
 * ذكرياتك. ولم تُكتَب هنا ثانيةً: نفس عالم الاستوديو نفسه، فإصلاحٌ في
 * أحدهما إصلاحٌ في الاثنين.
 */

import { expressions, savedItems } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { typeLabel } from '../type-service.js';
import { readWorld } from '../studio/census.js';
import { rank, VERDICT, VERDICT_META } from './engine.js';

/* ------------------------------------------------------------------ *
 * ما يُسأل عنه
 * ------------------------------------------------------------------ */

/**
 * ⚠️ ما لا يُسأل عنه — وسببه مكتوب.
 */
export const NO_SIMILAR = Object.freeze([
  {
    id: 'people',
    label: 'الأشخاص',
    why: 'شخصان متشابهان سؤالُ **تكرار** لا سؤال شَبَه — وجوابُه في «المكرَّر».',
  },
  {
    id: 'media',
    label: 'الصور والصوت',
    why: 'الشبه بين صورتين بصريّ، ولا بصمة محتوًى في التطبيق.',
  },
]);

/**
 * كل نوعٍ يُسأل عنه: من أين يُقرأ، وكيف يصير موضوعًا، وكيف يُعرَض.
 * إضافة نوعٍ غدًا سطرٌ هنا.
 */
const KINDS = {
  /* ---------------- الذكريات ---------------- */
  scene: {
    id: 'scene',
    label: 'ذكرى',
    profile: 'texts',
    async pool() {
      const world = await readWorld();
      const subject = (row) => {
        const declared = world.declaredByScene.get(row.id) || [];
        const spoke = world.speakersByScene.get(row.id) || [];
        const threads = world.threadsByScene.get(row.id) || [];

        // الاتحاد: مَن أُعلن ومَن تكلّم — والتكرار يُطوى بـ`Set`.
        const personIds = [...new Set([...declared, ...spoke])];
        const tags = [
          ...personIds.map((id) => `person:${id}`),
          ...threads.map((id) => `thread:${id}`),
        ];
        const tagLabels = {};
        for (const id of personIds) tagLabels[`person:${id}`] = world.personName.get(id) || 'شخص';
        for (const id of threads) tagLabels[`thread:${id}`] = world.threadTitle.get(id) || 'قصّة';

        return {
          names: [row.titleAr, row.titleRu].filter(Boolean),
          text: [row.context, row.placeName].filter(Boolean).join(' '),
          context: row.type || row.eventTypeId || '',
          tags,
          tagLabels,
        };
      };
      return { rows: world.scenes, subject };
    },
    row: (r) => ({
      id: r.id,
      label: r.titleAr || r.titleRu || 'ذكرى بلا عنوان',
      hint: [r.date, typeLabel(r.type)].filter(Boolean).join(' · '),
      href: `/scene/${r.id}`,
    }),
  },

  /* ---------------- التعبيرات ---------------- */
  expression: {
    id: 'expression',
    label: 'تعبير',
    profile: 'texts',
    async pool() {
      const rows = (await expressions.getAll()).filter((r) => r.state === STATE.ACTIVE);
      const subject = (row) => ({
        names: [row.text].filter(Boolean),
        text: [row.meaningAr, row.explanation].filter(Boolean).join(' '),
        context: row.register || '',
      });
      return { rows, subject };
    },
    row: (r) => ({
      id: r.id,
      label: r.text,
      hint: r.meaningAr || '',
      ru: true,
      href: '/language',
    }),
  },

  /* ---------------- المحفوظات ---------------- */
  saved: {
    id: 'saved',
    label: 'محفوظ',
    profile: 'texts',
    async pool() {
      const rows = (await savedItems.getActive()).filter((r) => r.text);
      const subject = (row) => ({
        names: [row.text].filter(Boolean),
        text: [row.note, row.translation].filter(Boolean).join(' '),
        context: row.kind || '',
      });
      return { rows, subject };
    },
    row: (r) => ({
      id: r.id,
      label: r.text,
      hint: r.note || (r.kind === 'word' ? 'كلمة' : 'جملة'),
      ru: true,
      href: r.sceneId ? `/scene/${r.sceneId}` : '/language',
    }),
  },
};

export const SIMILAR_KINDS = Object.freeze(
  Object.values(KINDS).map(({ id, label }) => ({ id, label }))
);

/* ------------------------------------------------------------------ *
 * السؤال
 * ------------------------------------------------------------------ */

/**
 * «إيه اللي شبه ده؟»
 *
 * ⚠️ ويعود بجوابٍ صريحٍ حين لا يوجد شبيه: `empty: true` مع سببٍ.
 *    قائمةٌ فارغة بلا كلمة تجعل القارئ يظنّ الشاشة عطلت.
 *
 * @param {'scene'|'expression'|'saved'} kind
 * @param {string} id
 * @param {{limit?: number, min?: string}} options
 */
export async function similarTo(kind, id, { limit = 8, min = VERDICT.MAYBE } = {}) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`نوعٌ مش مسؤولٌ عنه: ${kind}`);

  const { rows, subject } = await spec.pool();
  const target = rows.find((row) => row.id === id);
  if (!target) {
    return { kind, id, subject: null, items: [], empty: true, why: 'العنصر ده مش موجود' };
  }

  const ranked = rank(target, rows, { profile: spec.profile, shape: subject, min, limit });

  return {
    kind,
    id,
    label: spec.label,
    subject: spec.row(target),
    pool: rows.length,
    empty: ranked.length === 0,
    why: ranked.length ? '' : whyNothing(rows.length),
    items: ranked.map((hit) => ({
      ...spec.row(hit.item),
      verdict: hit.verdict,
      verdictLabel: VERDICT_META[hit.verdict].label,
      score: hit.score,
      reasons: hit.why,
    })),
  };
}

/**
 * ⚠️ الفرق بين «مفيش شبيه» و«مفيش غيرها أصلًا» فرقٌ يهمّ القارئ:
 *    الأوّل معلومة، والثاني حالة.
 */
function whyNothing(pool) {
  if (pool <= 1) return 'دي الوحيدة عندك لحدّ دلوقتي — مفيش حاجة نقارنها بيها';
  return 'مفيش حاجة قريبة كفاية. ولا كلمةً مشتركة ولا شخصًا ولا قصّة.';
}

/**
 * شبيهٌ مختصر — لقسمٍ داخل شاشةٍ قائمة.
 * نفس الجواب بحدٍّ أقلّ وبأدنى حكمٍ أعلى: القسم الجانبيّ لا يحتمل ضجيجًا.
 */
export async function briefSimilar(kind, id, { limit = 3 } = {}) {
  return similarTo(kind, id, { limit, min: VERDICT.LIKELY });
}

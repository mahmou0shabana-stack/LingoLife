/**
 * LingoLife — قصّةُ العنصر: نسبٌ · تاريخٌ · خطٌّ زمنيّ (WS-K · بنود ٣٠…٣٤ و٣٨)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الخطُّ الزمنيُّ سجلٌّ لِما وقع — لا حكايةٌ نؤلّفها**
 * ═══════════════════════════════════════════════════════════════
 *
 * أسهلُ ما في تطبيقات اللغة أن تكتب «أوّل مرّة شفتها: ٣ مايو» — ثم
 * تكتشف أن التاريخَ هو يومُ **إضافتك للنصّ إلى التطبيق**، لا يومَ
 * الاجتماع الذي قيلت فيه. وقد يفصل بينهما شهران.
 *
 * فالتواريخُ هنا لا تُشتقّ إلّا من مصادرَ تُثبتها:
 *
 *   `scenes.date`               ← اليومُ الذي **وقع فيه** الموقف (كتبتَه أنت)
 *   `savedItems.createdAt`      ← لحظةُ حفظك
 *   `practiceEvidence.practicedAt` ← لحظةُ تدريبك
 *   `mistakeComparisons.occurredAt` ← يومُ الغلطة (لا يومُ تسجيلها)
 *   `analysisItems.analyzedAt`  ← لحظةُ إقرارك للتحليل
 *
 * وما لا تاريخَ له **يُعرَض بلا تاريخ** ولا يدخل الخطَّ الزمنيَّ أصلًا.
 * فسطرٌ ناقصٌ صادقٌ خيرٌ من ترتيبٍ زمنيٍّ مخترَع.
 *
 * ⚠️ **ولا «أوّل ظهور» مستنتَجٌ من ترتيب الصفوف.** معرِّفٌ أصغرُ لا
 *    يعني أقدمَ في الحياة، ووقتُ الكتابة ليس وقتَ الحدث. فإن لم يكن
 *    للمشهد تاريخٌ فلا «أوّل مرّة».
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وأربعةُ أشياءَ تُسمّى «غلطة» وواحدٌ منها فقط غلطتُك** (بند ٣٤)
 * ═══════════════════════════════════════════════════════════════
 *
 *   غلطةٌ سجّلتَها          واقعةٌ منك      ← تدخل تاريخَك وتُعَدّ
 *   تصحيحٌ اقترحه التحليل   رأيٌ            ← يُعرَض تحليلًا ولا يُعَدّ
 *   تحسينُ أسلوب           رأيٌ            ← ولا يعني أن الأصلَ خطأ
 *   فرقُ نسخةٍ مولَّدة       أثرُ توليدٍ      ← ليس غلطةً أصلًا
 *
 * وخلطُها يجعل «أخطاؤك في هذه الكلمة: ٧» وأنت لم تخطئ فيها مرّة —
 * لأن التحليلَ اقترح سبعَ صياغاتٍ ألطف. وهو نفسُ عطبِ البند ٢ في
 * بابٍ آخر: رقمٌ عن حياتك يملؤه غيرُك.
 */

import {
  savedItems, practiceEvidence, mistakeComparisons, scenes, media,
} from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { normalize } from '../../utils/normalization.js';
import { ORIGIN as INFO_ORIGIN } from './identity.js';
import { ORIGIN_LABEL, EVIDENCE } from './provenance.js';
import { listSources, readLiveSources } from './source-registry.js';

const alive = (rows) => rows.filter((row) => row.state !== STATE.TRASHED);

/* ------------------------------------------------------------------ *
 * ٣٤ · أصنافُ «الغلطة»
 * ------------------------------------------------------------------ */

export const MISTAKE_KIND = Object.freeze({
  /** أ · واقعةٌ منك — تدخل تاريخَك وتُعَدّ. */
  LEARNER: 'learner',
  /** ب · التحليلُ يرى أن الصياغةَ قد تحتاج تصحيحًا. */
  AI_CORRECTION: 'ai_correction',
  /** ج · أجملُ لا أصحّ. */
  STYLE: 'style',
  /** د · الفرقُ أثرُ إعادةِ كتابةٍ في نسخةٍ مولَّدة. */
  DERIVED_REWRITE: 'derived_rewrite',
});

export const MISTAKE_KIND_LABEL = Object.freeze({
  [MISTAKE_KIND.LEARNER]: 'غلطة سجّلتها',
  [MISTAKE_KIND.AI_CORRECTION]: 'التحليل شايف إنها محتاجة تصحيح',
  [MISTAKE_KIND.STYLE]: 'تحسين أسلوب — مش بالضرورة غلط',
  [MISTAKE_KIND.DERIVED_REWRITE]: 'فرق نسخة مولَّدة — مش غلطة',
});

/**
 * يصنّف صفَّ مقارنةٍ إلى واحدٍ من الأربعة.
 *
 * ⚠️ **والافتراضُ «غلطتُك» لا «اقتراحُ تحليل».** الصفوفُ المكتوبةُ قبل
 *    أن يوجد `origin` كتبتَها أنت من شاشة الغلطات، فمعاملتُها اقتراحًا
 *    تمحو تاريخًا حقيقيًّا. والعكسُ (اعتبارُ اقتراحٍ غلطةً) يضخّم رقمًا
 *    عن حياتك — ولذلك `ai_import` صريحٌ ولا يُفترَض.
 */
export function classifyMistake(row, { derivedSources = new Set() } = {}) {
  if (row?.origin === INFO_ORIGIN.AI_IMPORT) return MISTAKE_KIND.AI_CORRECTION;
  if (row?.mistakeType === 'style' || row?.mistakeType === 'natural_style') {
    return MISTAKE_KIND.STYLE;
  }
  if (row?.sourceKey && derivedSources.has(row.sourceKey)) return MISTAKE_KIND.DERIVED_REWRITE;
  return MISTAKE_KIND.LEARNER;
}

/** غلطتُك وحدَها تُعَدّ — والباقي يُعرَض ولا يدخل رقمًا عن حياتك. */
export const isLearnerMistake = (row, ctx) => classifyMistake(row, ctx) === MISTAKE_KIND.LEARNER;

/* ------------------------------------------------------------------ *
 * ٣٨ · «ليه ده موجود عندي؟»
 * ------------------------------------------------------------------ */

export const SIGNAL_REASON = Object.freeze([
  { id: 'real', label: 'من موقف حقيقي', when: (one) => one.rawOccurrences > 0 },
  { id: 'analyzed', label: 'اكتشفها التحليل', when: (one) => one.hasAnalysis },
  { id: 'marked', label: 'أنا علّمت عليها', when: (one) => one.saved > 0 },
  { id: 'derived', label: 'موجودة في مادة مولَّدة', when: (one) => one.derivedAppearances > 0 },
  { id: 'practised', label: 'عندي تدريب عليها', when: (one) => one.practised > 0 },
  { id: 'mistake', label: 'عندي غلط مسجَّل', when: (one) => one.errors > 0 },
  { id: 'recorded', label: 'عندي تسجيل عليها', when: (one) => (one.recordings || 0) > 0 },
]);

/**
 * كلُّ الأسباب التي جعلت هذا العنصرَ في لغتك — **مجتمعةً على عنصرٍ واحد**.
 *
 * ⚠️ **ولا يُنشَأ عنصرٌ ثانٍ لأن السببَ ثانٍ** (بند ٣٨). كلمةٌ وصلتك
 *    من موقفٍ حقيقيّ ثم حفظتَها ثم تدرّبتَ عليها هي **واحدة** بثلاث
 *    إشارات — لا ثلاثةَ صفوفٍ في ثلاث شاشات كما كان قبل WS-J.
 */
export const reasonsFor = (one) => SIGNAL_REASON.filter((r) => r.when(one));

/* ------------------------------------------------------------------ *
 * ٣٠ · نسبُ المادّة المولَّدة
 * ------------------------------------------------------------------ */

/**
 * يصف كلَّ ظهورٍ مولَّدٍ بنوع اشتقاقه وأصله.
 *
 * ⚠️ **والأصلُ يُذكَر بنصّه لا بمفتاحه.** «مشتقّ من script:SCR_01M…»
 *    لا يقول شيئًا؛ و«مولَّد من: محضر الاجتماع» يقول كلَّ شيء.
 */
export function describeDerived(rows = [], registry = []) {
  const byKey = new Map(registry.map((row) => [row.id, row]));
  return rows.map((row) => {
    const meta = byKey.get(row.sourceKey);
    const parents = (meta?.derivedFrom || [])
      .map((key) => byKey.get(key))
      .filter(Boolean)
      .map((parent) => ({ key: parent.id, title: parent.title || parent.id }));
    return {
      ...row,
      originType: meta?.originType || null,
      originLabel: meta?.originType ? ORIGIN_LABEL[meta.originType] : null,
      parents,
    };
  });
}

/* ------------------------------------------------------------------ *
 * ٣٢ · الخطُّ الزمنيّ
 * ------------------------------------------------------------------ */

export const EVENT = Object.freeze({
  SITUATION: 'situation',
  DERIVED: 'derived',
  ANALYZED: 'analyzed',
  SAVED: 'saved',
  PRACTISED: 'practised',
  SHADOWED: 'shadowed',
  RECORDED: 'recorded',
  MISTAKE: 'mistake',
});

export const EVENT_LABEL = Object.freeze({
  [EVENT.SITUATION]: 'ظهرت في موقف حقيقي',
  [EVENT.DERIVED]: 'ظهرت في مادة مولَّدة',
  [EVENT.ANALYZED]: 'التحليل أضافها أو حدّثها',
  [EVENT.SAVED]: 'حفظتها',
  [EVENT.PRACTISED]: 'اتدرّبت عليها',
  [EVENT.SHADOWED]: 'شادوينج',
  [EVENT.RECORDED]: 'سجّلت صوتك',
  [EVENT.MISTAKE]: 'غلطة سجّلتها',
});

/** أحداثُ الطبقة أ و ج مرتَّبةً — **بلا حدثٍ بلا تاريخ**. */
export function timelineOf(events = []) {
  return events
    .filter((one) => Number.isFinite(one.at))
    .sort((a, b) => a.at - b.at);
}

/* ------------------------------------------------------------------ *
 * الجامع
 * ------------------------------------------------------------------ */

/**
 * يجمع قصّةَ عنصرٍ: نسبُ المولَّد · تاريخُ المتعلّم · الخطُّ الزمنيّ.
 *
 * ⚠️ **ويُقرأ لعنصرٍ واحدٍ عند الطلب لا لعشرة آلافٍ عند بناء الفهرس.**
 *    قراءةُ المشاهد والوسائط لكلّ عنصرٍ تجعل «لغتي» تفتح في ثوانٍ —
 *    وهي هنا لأن هذه الشاشةَ عنصرٌ واحد.
 *
 * @param {object} item العنصرُ الموحَّد من `my-language.js`
 * @param {{primary: object[], derived: object[], unknown: object[]}} evidence
 */
export async function itemStory(item, evidence) {
  const [saved, practice, mistakes, registry, live] = await Promise.all([
    savedItems.getAll(), practiceEvidence.getAll(), mistakeComparisons.getAll(), listSources(),
    /*
     * ⚠️ **والمشهدُ يُقرأ من المصدر الحيّ لا من صفّ السجلّ.** `memorySources`
     *    لا يحمل `sceneId` أصلًا، ولو نسخناه إليه لَتجمّد: تنقل النصَّ
     *    إلى ذكرى أخرى فيبقى الخطُّ الزمنيُّ يؤرّخه بالذكرى القديمة.
     *    وهي نفسُ قاعدةِ المتحدّث في `evidenceOf` وقاعدةِ النصّ في
     *    `source-context.js` — ثلاثتُها تقرأ الحيَّ لا الصورة.
     */
    readLiveSources(),
  ]);

  const derivedKeys = new Set(
    registry.filter((row) => row.evidenceClass === EVIDENCE.DERIVED).map((row) => row.id)
  );
  const forms = new Set([
    normalize(item.lemma || ''), normalize(item.surface || ''),
    ...item.forms.map(normalize), ...item.observedForms.map(normalize),
  ].filter(Boolean));

  const mine = (text) => forms.has(normalize(text || ''));

  /* ── تواريخُ المواقف: من تاريخ المشهد لا من وقت الكتابة ── */
  const sceneOf = new Map(live.map((row) => [row.key, row.sceneId || null]));
  const wanted = [...new Set(evidence.primary.map((one) => sceneOf.get(one.sourceKey)).filter(Boolean))];
  const sceneRows = wanted.length ? await scenes.getMany(wanted) : [];
  const dateOfScene = new Map(sceneRows.filter(Boolean).map((row) => [row.id, row.date || null]));

  const events = [];

  for (const one of evidence.primary) {
    /*
     * ⚠️ **تاريخُ المشهد هو الوحيدُ الذي يُثبت متى وقع الموقف.**
     *    و`updatedAt` للنصّ وقتُ لمسِ الصفّ لا وقتُ الحدث — فلا يُستعمَل
     *    هنا بحال، ولو تركنا الحدثَ بلا تاريخ.
     */
    const date = dateOfScene.get(sceneOf.get(one.sourceKey));
    events.push({
      kind: EVENT.SITUATION,
      at: date ? new Date(date).getTime() : null,
      title: one.title,
      quote: one.quote,
      speaker: one.speaker || null,
      sourceKey: one.sourceKey,
      segmentId: one.segmentId,
    });
  }

  for (const one of evidence.derived) {
    const date = dateOfScene.get(sceneOf.get(one.sourceKey));
    events.push({
      kind: EVENT.DERIVED,
      at: date ? new Date(date).getTime() : null,
      title: one.title,
      quote: one.quote,
      sourceKey: one.sourceKey,
    });
  }

  if (Number.isFinite(item.analyzedAt)) {
    events.push({ kind: EVENT.ANALYZED, at: item.analyzedAt, title: 'تحليل' });
  }

  const savedRows = alive(saved).filter((row) => mine(row.text));
  for (const row of savedRows) {
    events.push({
      kind: EVENT.SAVED, at: row.createdAt ?? null,
      note: row.note || '', tagIds: row.tagIds || [],
    });
  }

  /* ── التدريبُ والتسجيلُ: صفّان من نفس المخزن بنوعين ── */
  const practiceRows = practice.filter((row) => mine(row.targetText || row.text));
  const recordings = [];
  for (const row of practiceRows) {
    const isVoice = row.practiceType === 'voiceAttempt' || row.targetType === 'shadowVoice';
    if (isVoice) {
      recordings.push({
        id: row.id, mediaId: row.mediaId || null,
        at: row.practicedAt ?? null,
        durationMs: row.durationMs ?? null,
        targetText: row.targetText || '',
      });
    }
    events.push({
      kind: isVoice ? EVENT.RECORDED
        : (row.practiceType === 'shadowing' ? EVENT.SHADOWED : EVENT.PRACTISED),
      at: row.practicedAt ?? null,
      repetitions: row.repetitions || 1,
      mediaId: row.mediaId || null,
    });
  }

  /* ── الغلطاتُ مصنَّفةً — وواحدٌ منها فقط تاريخُك ── */
  /*
   * ⚠️ **وقاعدةُ النسبة واحدةٌ هنا وفي `my-language.js`**: الصفُّ يخصّ
   *    العنصرَ الذي يسمّيه **أوّلُ حقلٍ غيرِ فارغ** من `canonical` ثم
   *    `natural` ثم `wrong`. ولو اختلفت القاعدتان لَقالت اللوحةُ
   *    «اقتراحان» وقالت القصّةُ «ثلاثة» عن الشيء نفسِه — وهو أسوأُ من
   *    رقمٍ خاطئ، لأنه رقمان خاطئان يكذّب أحدُهما الآخر أمام عينيك.
   */
  const mistakeRows = alive(mistakes)
    .filter((row) => mine(row.canonical || row.natural || row.wrong || ''));
  const classified = mistakeRows.map((row) => ({
    id: row.id,
    kind: classifyMistake(row, { derivedSources: derivedKeys }),
    wrong: row.wrong || '',
    natural: row.natural || '',
    explanation: row.explanation || '',
    mistakeType: row.mistakeType || null,
    /* ⚠️ `occurredAt` لا `createdAt`: يومُ الغلطة لا يومُ تسجيلها. */
    at: Number.isFinite(row.occurredAt) ? row.occurredAt : null,
  }));

  for (const one of classified) {
    if (one.kind !== MISTAKE_KIND.LEARNER) continue;
    events.push({ kind: EVENT.MISTAKE, at: one.at, wrong: one.wrong, natural: one.natural });
  }

  /* ── حالةُ بايتات التسجيلات — بلا تنزيلٍ الآن ── */
  const mediaIds = recordings.map((one) => one.mediaId).filter(Boolean);
  const mediaRows = mediaIds.length ? await media.getMany(mediaIds) : [];
  const mediaById = new Map(mediaRows.filter(Boolean).map((row) => [row.id, row]));
  for (const one of recordings) {
    const row = one.mediaId ? mediaById.get(one.mediaId) : null;
    /*
     * ⚠️ **ولا يُجلَب شيءٌ هنا** (بند ٣٣): فتحُ القصّة لا ينزّل تسجيلاتٍ
     *    من Drive. نقول «على Drive» ويُجلَب المطلوبُ وحدَه عند الضغط.
     */
    one.local = Boolean(row?.blob);
    one.cloudOnly = Boolean(row) && !row.blob && row.blobPending === 1;
    one.bytes = row?.bytes ?? row?.size ?? null;
  }

  return {
    reasons: reasonsFor({ ...item, recordings: recordings.length }),
    timeline: timelineOf(events),
    /* أحداثٌ بلا تاريخ: تُعرَض مجموعةً ولا تُرتَّب زمنيًّا. */
    undated: events.filter((one) => !Number.isFinite(one.at)),
    saves: savedRows.map((row) => ({
      id: row.id, at: row.createdAt ?? null, note: row.note || '', tagIds: row.tagIds || [],
    })),
    recordings: recordings.sort((a, b) => (b.at || 0) - (a.at || 0)),
    mistakes: {
      learner: classified.filter((one) => one.kind === MISTAKE_KIND.LEARNER),
      proposed: classified.filter((one) => one.kind !== MISTAKE_KIND.LEARNER),
    },
    derived: describeDerived(evidence.derived, registry),
    counts: {
      /* ⚠️ عددُ الغلطات = غلطاتُك وحدَها. راجع ترويسة الملفّ. */
      learnerMistakes: classified.filter((one) => one.kind === MISTAKE_KIND.LEARNER).length,
      proposedFixes: classified.filter((one) => one.kind !== MISTAKE_KIND.LEARNER).length,
      recordings: recordings.length,
      datedEvents: events.filter((one) => Number.isFinite(one.at)).length,
      undatedEvents: events.filter((one) => !Number.isFinite(one.at)).length,
    },
  };
}

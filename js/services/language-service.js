/**
 * LingoLife — حياة التعبير والكلمة
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا خطٌّ زمنيّ لا شريط إتقان
 * ═══════════════════════════════════════════════════════════════
 *
 * كان في صفحة الذكرى شريطٌ من ستّ مراحل: «سمعته ← فهمته ← تمرّنت ←
 * استخدمته ← بقى طبيعي ← تلقائي»، ومؤشّرٌ يقول «دلوقتي» تحت واحدة
 * منها.
 *
 * وكان يقول «سمعته» **دائمًا ولكل تعبير إلى الأبد**: `masteryState`
 * يُكتب `'heard'` عند الإنشاء ولا يرفعه شيءٌ في التطبيق كلّه. شريط
 * تقدّمٍ لا يتقدّم — وهو أسوأ من غيابه، لأنه يَعِد بقياسٍ لا يقع.
 *
 * ولا يجوز أن يرفعه التطبيق وحده: **الممارسة ليست إتقانًا** (بند 18)،
 * وخمسون تكرارًا في الظلّ لا تعني أنك تستعملها مع بشر.
 *
 * فالبديل شيئان منفصلان لا يختلطان:
 *
 *  · **الوقائع** — أين ظهر ومتى، من `expressionOccurrences`. حقائق
 *    تُقرأ ولا تُقدَّر.
 *  · **تقديرك أنت** — مرحلةٌ تختارها بيدك، ومكتوبٌ في الشاشة أنها
 *    قولك لا حساب التطبيق.
 *
 * ═══════════════════════════════════════════════════════════════
 * والكلمة تُشتقّ ولا تُخزَّن
 * ═══════════════════════════════════════════════════════════════
 *
 * في القاعدة مستودعٌ اسمه `words` فيه `lemma` و`pos`… **لا يكتب فيه
 * شيء**. والكلمات تُلتقَط اليوم فعلًا — لكن في `savedItems` بنوع
 * `word`، مع تصنيفٍ يقول لماذا التقطتَها.
 *
 * وجعلُ `words` بيتًا ثانيًا لنفس الشيء هو «العالم الثاني» الذي
 * تتجنّبه بقيّة الخدمات. فحياة الكلمة **مُشتقّة**: التقاطاتك، وأين
 * يظهر نصّها فعلًا.
 *
 * ⚠️ وما يعجز عنه الاشتقاق مُعلَنٌ لا مسكوتٌ عنه: `lemma` و`pos`
 *    يحتاجان محلّلًا صرفيًّا روسيًّا — «иду» و«шёл» فعلٌ واحد ولا
 *    نعرف ذلك. راجع `UNBUILT`.
 */

import {
  expressions, expressionOccurrences, scenes, savedItems,
  conversationParts, scripts, words, sentencePatterns,
} from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { normalize } from '../utils/normalization.js';
import { toISODate } from '../utils/dates.js';
import { SAVED_KIND, savedTagLabel } from './saved-service.js';
import { EXPRESSION_SOURCE } from './content-service.js';

/* ------------------------------------------------------------------ *
 * المراحل — تقديرك أنت
 * ------------------------------------------------------------------ */

/**
 * مراحل التعبير كما **تصفها أنت**.
 *
 * ⚠️ لا يرفعها التطبيق أبدًا. الممارسة ليست إتقانًا، والظهور ليس
 *    استعمالًا. مَن يعرف أنك «بقيت تقولها من غير ما تفكّر» هو أنت.
 */
export const STAGES = Object.freeze([
  { id: 'heard', label: 'سمعته', hint: 'قابلته ولسه' },
  { id: 'understood', label: 'فهمته', hint: 'عارف معناه' },
  { id: 'practiced', label: 'تمرّنت عليه', hint: 'قلته في الظلّ' },
  { id: 'used', label: 'استخدمته', hint: 'قلته لبني آدم' },
  { id: 'natural', label: 'بقى طبيعي', hint: 'مش بفكّر فيه كتير' },
  { id: 'automatic', label: 'تلقائي', hint: 'بيطلع لوحده' },
]);

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

/** ترتيب المرحلة — للمقارنة لا للحساب التلقائي. */
export const stageIndex = (id) => Math.max(0, STAGES.findIndex((s) => s.id === id));

/**
 * ما لم يُبنَ في عالم اللغة، ولماذا — يُعلَن ولا يُعرَض كرقمٍ صفر.
 *
 * ⚠️ نفس مبدأ `ABSENT_AXES` و`NOT_SUPPORTED`: قائمةٌ صريحة يقارن بها
 *    اختبار، لا نسيانٌ يُكتشَف بالصدفة.
 */
export const UNBUILT = Object.freeze({
  words: 'مستودع `words` فيه lemma وpos — ومحتاج محلّلًا صرفيًّا روسيًّا: «иду» و«шёл» فعلٌ واحد ومفيش حاجة تعرف كده. الكلمات اللي بتلتقطها محفوظة وحيّة، بس مش ككيان صرفيّ',
  sentencePatterns: 'أنماط الجُمل محتاجة تحليلًا يكتبها — ومفيش حاجة بتكتب فيها دلوقتي، فالشاشة هتفضل صفر',
});

/* ------------------------------------------------------------------ *
 * حياة التعبير
 * ------------------------------------------------------------------ */

/**
 * كل ما نعرفه عن تعبير — **وقائعُ لا تقديرات**.
 *
 * @param {string} expressionId
 */
export async function expressionLife(expressionId) {
  const expression = await expressions.get(expressionId);
  if (!expression || expression.state === STATE.TRASHED) return null;

  const rows = (await expressionOccurrences.byIndex('expressionId', expressionId))
    .filter((row) => row.state === STATE.ACTIVE);

  const sceneRows = await scenes.getMany([...new Set(rows.map((r) => r.sceneId))]);
  const byId = new Map(
    sceneRows.filter((s) => s && s.state === STATE.ACTIVE).map((s) => [s.id, s])
  );

  /*
   * ⚠️ الظهور في ذكرى محذوفة يُستبعَد ولا يُحسَب: عدّه يجعل «ظهر ٥
   *    مرّات» يشير إلى مواضع لا تُفتَح.
   */
  const occurrences = rows
    .filter((row) => byId.has(row.sceneId))
    .map((row) => {
      const scene = byId.get(row.sceneId);
      return {
        id: row.id,
        sceneId: row.sceneId,
        title: scene.titleAr || scene.titleRu || 'ذكرى',
        date: toISODate(scene.date) || scene.date || '',
        kind: row.kind || 'appeared',
        quote: row.sourceQuote || '',
        /*
         * ⚠️ **حدٌّ معروف.** الظهورات المكتوبة قبل بند 38 تحمل
         *    `'manual'` حرفيًّا — كان الحقل يُكتب ثابتًا للمسارات
         *    الثلاثة كلها. فظهورٌ قديمٌ جاء من استيرادٍ أو من الظلّ
         *    سيقول «كتبته بإيدك» وهو لا يعرف.
         *
         *    ولا سبيل للتمييز بلا ترقيةٍ تكتب في بياناتك، وتلك قرارك
         *    لا قراري. راجع `docs/09 §9.9`.
         */
        source: row.sourceType || EXPRESSION_SOURCE.UNKNOWN,
      };
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // التقاطاتك لنفس النصّ — سببُ التقاطك جزءٌ من قصّته.
  const captures = (await savedItems.byIndex('normalizedText', normalize(expression.text)))
    .filter((row) => row.state === STATE.ACTIVE);
  const tagIds = [...new Set(captures.flatMap((row) => row.tagIds || []))];

  return {
    expression,
    stage: expression.masteryState || 'heard',
    occurrences,
    firstSeen: occurrences[0]?.date || null,
    lastSeen: occurrences.at(-1)?.date || null,
    sceneCount: new Set(occurrences.map((o) => o.sceneId)).size,
    captureTags: await Promise.all(tagIds.map(savedTagLabel)),
  };
}

/**
 * يضبط مرحلة التعبير.
 *
 * ⚠️ **بطلبك وحدك.** لا شيء في التطبيق ينادي هذه إلا ضغطةٌ منك —
 *    وهو الفرق بين معلومةٍ عنك وتخمينٍ عنك.
 */
export async function setStage(expressionId, stage) {
  if (!STAGES.some((s) => s.id === stage)) throw new Error('مرحلة مش معروفة');
  return expressions.update(expressionId, { masteryState: stage });
}

/* ------------------------------------------------------------------ *
 * حياة الكلمة — مُشتقّة
 * ------------------------------------------------------------------ */

/**
 * أين قابلتَ هذه الكلمة.
 *
 * ⚠️ **مطابقةٌ نصّيّة لا صرفيّة.** «идти» لا تجد «шёл» — ولا نُوهم
 *    بغير ذلك. راجع `UNBUILT.words`.
 *
 * @param {string} text الكلمة كما تُكتب
 */
export async function wordLife(text) {
  const clean = (text || '').trim();
  const key = normalize(clean);
  if (!key) return null;

  const [captures, partRows, scriptRows, expressionRows] = await Promise.all([
    savedItems.byIndex('normalizedText', key),
    conversationParts.getAll(),
    scripts.getAll(),
    expressions.getAll(),
  ]);

  const alive = (rows) => rows.filter((row) => row.state === STATE.ACTIVE);
  const contains = (value) => normalize(value || '').split(' ').includes(key);

  const sceneIds = new Set();
  const inParts = alive(partRows).filter((row) => contains(row.text));
  const inScripts = alive(scriptRows).filter((row) => contains(row.text));
  for (const row of [...inParts, ...inScripts]) if (row.sceneId) sceneIds.add(row.sceneId);

  const sceneRows = (await scenes.getMany([...sceneIds]))
    .filter((s) => s && s.state === STATE.ACTIVE)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const myCaptures = alive(captures).filter((row) => row.kind === SAVED_KIND.WORD);
  const tagIds = [...new Set(myCaptures.flatMap((row) => row.tagIds || []))];

  return {
    text: clean,
    captured: myCaptures.length,
    captureTags: await Promise.all(tagIds.map(savedTagLabel)),
    inConversation: inParts.length,
    inScripts: inScripts.length,
    // تعبيراتٌ تحوي الكلمة — مدخلٌ لحياة أوسع منها.
    expressions: alive(expressionRows)
      .filter((row) => contains(row.text))
      .map((row) => ({ id: row.id, text: row.text, meaningAr: row.meaningAr || '' })),
    scenes: sceneRows.map((s) => ({
      id: s.id,
      title: s.titleAr || s.titleRu || 'ذكرى',
      date: toISODate(s.date) || s.date || '',
    })),
  };
}

/* ------------------------------------------------------------------ *
 * لغتي — الأرقام ومن ورائها
 * ------------------------------------------------------------------ */

/**
 * ما في عالم لغتك الآن.
 *
 * ⚠️ **كل رقمٍ يعود معه ما يفسّره** (بند 66): لا عددٌ مجرَّد ثم شاشةٌ
 *    تبحث عنه من جديد. والصفر يُعرَض حين يكون صادقًا — وما لا يُبنى
 *    أصلًا يُعلَن في `UNBUILT` ولا يُعرَض كصفر.
 */
export async function languageOverview({ limit = 8 } = {}) {
  const [expressionRows, occurrenceRows, savedRows] = await Promise.all([
    expressions.getAll(),
    expressionOccurrences.getAll(),
    savedItems.getAll(),
  ]);

  const alive = (rows) => rows.filter((row) => row.state === STATE.ACTIVE);
  const live = alive(expressionRows);

  // كم مرّة ظهر كل تعبير — الأكثر ظهورًا أوّلًا.
  const seen = new Map();
  for (const row of alive(occurrenceRows)) {
    seen.set(row.expressionId, (seen.get(row.expressionId) || 0) + 1);
  }

  const byStage = new Map();
  for (const row of live) {
    const stage = row.masteryState || 'heard';
    byStage.set(stage, (byStage.get(stage) || 0) + 1);
  }

  const savedWords = alive(savedRows).filter((row) => row.kind === SAVED_KIND.WORD);
  const savedSentences = alive(savedRows).filter((row) => row.kind === SAVED_KIND.SENTENCE);

  return {
    expressions: {
      total: live.length,
      top: live
        .map((row) => ({
          id: row.id, text: row.text, meaningAr: row.meaningAr || '',
          stage: row.masteryState || 'heard', seen: seen.get(row.id) || 0,
        }))
        .sort((a, b) => b.seen - a.seen || String(a.text).localeCompare(String(b.text)))
        .slice(0, limit),
      byStage: STAGES.map((s) => ({ ...s, count: byStage.get(s.id) || 0 })),
    },
    words: {
      total: savedWords.length,
      top: savedWords.slice(-limit).reverse().map((row) => ({ id: row.id, text: row.text })),
    },
    sentences: { total: savedSentences.length },
    /** مستودعان بلا كاتب — يُعلَنان ولا يُعرَضان كصفر. */
    unbuilt: {
      words: await words.count(),
      sentencePatterns: await sentencePatterns.count(),
    },
  };
}

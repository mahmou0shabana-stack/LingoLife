/**
 * LingoLife — StressResolver: البابُ الوحيدُ إلى النبر (WS55)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **بابٌ واحدٌ لا بابان**
 * ═══════════════════════════════════════════════════════════════
 *
 * محرّكُ النطق لا يعرف من أين جاء النبر، ولا يجوز أن يعرف. يسأل هذا
 * الملفَّ فيُجيبه بنتيجةٍ **مُهيكَلة**: الموضعُ، ومن أين، وكم نثق،
 * وهل ثمّة قراءةٌ أخرى.
 *
 * وهذا ما يجعل تبديلَ المصدر — معجمًا أكبر، أو نموذجًا سياقيًّا —
 * تغييرًا في سطرٍ واحدٍ هنا، لا جراحةً في ثلاثين قاعدةَ نطق.
 *
 * ═══════════════════════════════════════════════════════════════
 * ترتيبُ الأولويّة — والأعلى يفوز دائمًا
 * ═══════════════════════════════════════════════════════════════
 *
 *   USER_OVERRIDE  ←  تصحيحُك
 *   EXPLICIT_TEXT  ←  علامةٌ في النصّ نفسِه
 *   BUILT_IN_VERIFIED ← قاموسُنا المُراجَع يدويًّا
 *   CONTEXT_HOMOGRAPH ← التباسٌ حسمتَه في سياقه
 *   OFFLINE_KNOWN  ←  المعجمُ الكبير
 *   RULE           ←  ё أو حركةٌ واحدة
 *   PREDICTED      ←  تنبّؤ (مطفأ)
 *   UNKNOWN
 *
 * ⚠️ **والمُراجَعُ يدويًّا لا يُزاحمه معجمٌ خارجيّ.** ٨٢ كلمةً راجعناها
 *    بأعيننا تعلو على نصفِ مليونِ صيغةٍ آليّة. ولو خالف المعجمُ
 *    الخارجيُّ مدخَلًا مُراجَعًا، **يُسجَّل الخلافُ ولا يُنفَّذ** — لأن
 *    مراجعةً بشريّةً واحدةً أثقلُ من استخراجٍ آليٍّ مهما اتّسع.
 */

import { STRESS_ORIGIN, STRESS_MATURITY, PROVIDER_PRIORITY } from './types.js';
import {
  reviewedProvider, contextProvider, offlineProvider, predictionProvider,
  bareOf, markedOrdinal,
} from './providers.js';
import { lookupStress, lexiconReady } from './lexicon-store.js';

const VOWELS = 'аоэуыиеёюя';
const vowelCount = (bare) => [...bare].filter((ch) => VOWELS.includes(ch)).length;

/**
 * السلسلةُ مرتَّبةٌ بالرقم لا بترتيب الكتابة.
 * ⚠️ ويُفرَز في كلّ نداء؟ لا — يُفرَز مرّةً هنا، والقائمةُ ثابتة.
 */
const CHAIN = [
  { provider: reviewedProvider, priority: PROVIDER_PRIORITY.USER_OVERRIDE },
  { provider: contextProvider, priority: PROVIDER_PRIORITY.CONTEXT_HOMOGRAPH },
  { provider: offlineProvider, priority: PROVIDER_PRIORITY.OFFLINE_KNOWN },
  { provider: predictionProvider, priority: PROVIDER_PRIORITY.PREDICTED },
].sort((a, b) => a.priority - b.priority);

/** يبني الصيغةَ المعلَّمة من الكلمة المجرَّدة ورقمِ الحركة. */
export function markWord(bare, ordinal) {
  if (!Number.isInteger(ordinal) || ordinal < 0) return null;
  let out = '';
  let seen = -1;
  for (const ch of bare) {
    out += ch;
    if (!VOWELS.includes(ch)) continue;
    seen += 1;
    if (seen === ordinal) out += '́';
  }
  return out;
}

/**
 * يحلّ نبرَ كلمة.
 *
 * @param {string} word الكلمةُ كما ظهرت
 * @param {{ overrideOrdinal?: number|null, previousWord?: string|null,
 *           nextWord?: string|null }} options
 * @returns {{
 *   input: string, bare: string, stressed: string|null, ordinal: number,
 *   syllables: number, origin: string, status: string, ambiguous: boolean,
 *   variants: string[]|null, alternates: string[]|null,
 *   provider: string|null, legacySource: string, trace: object[]
 * }}
 */
export function resolveStressDetailed(word, {
  overrideOrdinal = null, previousWord = null, nextWord = null,
} = {}) {
  const input = String(word || '');
  const bare = bareOf(input);
  const syllables = vowelCount(bare);
  const trace = [];

  const base = {
    input, bare, syllables, stressed: null, ordinal: -1,
    variants: null, alternates: null, provider: null, trace,
  };

  if (!bare) {
    return { ...base, origin: STRESS_ORIGIN.UNKNOWN, status: STRESS_MATURITY.UNKNOWN,
      ambiguous: false, legacySource: 'unknown' };
  }

  /*
   * ⚠️ **تصحيحُك يسبق سلسلةَ المزوّدين كلَّها** — ولا يمرّ بها. تمريرُه
   *    كمزوّدٍ عاديٍّ كان سيجعل ترتيبَه قابلًا للكسر بإعادة ترتيب؛
   *    وهو ليس مصدرًا يُنافَس، بل **قرارٌ منك يُنفَّذ**.
   */
  if (Number.isInteger(overrideOrdinal) && overrideOrdinal >= 0 && overrideOrdinal < syllables) {
    trace.push({ provider: 'user-override', outcome: 'hit', ordinal: overrideOrdinal });
    return {
      ...base,
      ordinal: overrideOrdinal,
      stressed: markWord(bare, overrideOrdinal),
      origin: STRESS_ORIGIN.USER_OVERRIDE,
      status: STRESS_MATURITY.VERIFIED,
      ambiguous: false,
      provider: 'user-override',
      legacySource: 'user_confirmed',
    };
  }

  /* كلمةٌ بلا حركة (`в`, `к`) — لا نبرَ لها ولا جهلَ بها. */
  if (syllables === 0) {
    trace.push({ provider: 'rule', outcome: 'no-vowel' });
    return { ...base, origin: STRESS_ORIGIN.RULE, status: STRESS_MATURITY.VERIFIED,
      ambiguous: false, provider: 'rule', legacySource: 'rule_monosyllable' };
  }

  let ambiguousHit = null;

  for (const { provider } of CHAIN) {
    const hit = provider.resolve(input, { previousWord, nextWord });
    if (!hit) { trace.push({ provider: provider.name, outcome: 'miss' }); continue; }

    if (hit.status === STRESS_MATURITY.AMBIGUOUS) {
      /*
       * ⚠️ **الالتباسُ يُحفَظ ولا يُرجَع فورًا.** قد يأتي مزوّدٌ أدنى
       *    ترتيبًا بحسمٍ صادق؛ فنُكمل السلسلة، فإن لم يحسم أحدٌ أعدنا
       *    الالتباسَ بوصفه الجواب. أمّا الرجوعُ الفوريّ فكان سيُسقط
       *    فرصةَ الحسم.
       */
      ambiguousHit = { ...hit, provider: provider.name };
      trace.push({ provider: provider.name, outcome: 'ambiguous', variants: hit.variants });
      continue;
    }

    trace.push({ provider: provider.name, outcome: 'hit', ordinal: hit.ordinal });

    /*
     * ⚠️ **وهل يخالف المعجمُ الكبيرُ قاموسَنا المُراجَع؟** يُسجَّل ولا
     *    يُنفَّذ. هذا هو المكانُ الوحيدُ الذي يُقارَن فيه، ونتيجتُه
     *    ملاحظةٌ للمطوّر لا تغييرٌ في نطقك.
     */
    let disagreement = null;
    if (hit.origin === STRESS_ORIGIN.BUILT_IN_VERIFIED && lexiconReady()) {
      const external = lookupStress(bare);
      if (external && !external.ambiguous && external.ordinal !== hit.ordinal) {
        disagreement = { external: external.ordinal, kept: hit.ordinal };
        trace.push({ provider: 'offline-lexicon', outcome: 'disagrees-ignored', ...disagreement });
      }
    }

    return {
      ...base,
      ordinal: hit.ordinal,
      stressed: markWord(bare, hit.ordinal),
      origin: hit.origin,
      status: hit.status,
      ambiguous: false,
      alternates: hit.alternates
        ? hit.alternates.map((o) => markWord(bare, o)) : null,
      provider: provider.name,
      legacySource: hit.legacySource,
      disagreement,
    };
  }

  if (ambiguousHit) {
    return {
      ...base,
      ordinal: -1,
      stressed: null,
      origin: STRESS_ORIGIN.CONTEXT_HOMOGRAPH,
      status: STRESS_MATURITY.AMBIGUOUS,
      ambiguous: true,
      variants: ambiguousHit.variants.map((o) => markWord(bare, o)),
      variantOrdinals: ambiguousHit.variants,
      provider: ambiguousHit.provider,
      legacySource: 'unknown',
    };
  }

  trace.push({ provider: 'none', outcome: 'unknown' });
  return { ...base, origin: STRESS_ORIGIN.UNKNOWN, status: STRESS_MATURITY.UNKNOWN,
    ambiguous: false, legacySource: 'unknown' };
}

export { markedOrdinal, bareOf };

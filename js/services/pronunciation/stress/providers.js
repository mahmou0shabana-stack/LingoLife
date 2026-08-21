/**
 * LingoLife — مزوّدو النبر (WS55)
 *
 * كلُّ مزوّدٍ يجيب عن سؤالٍ واحد: «هل تعرف نبرَ هذه الكلمة؟» ويعيد
 * إمّا نتيجةً بمصدرها وحالتها، وإمّا `null` فيُسأل الذي بعده.
 *
 * ⚠️ **ولا مزوّدَ يعرف بوجود غيره.** الترتيبُ في `resolver.js` وحدَه،
 *    والأولويّةُ رقمٌ في `types.js`. فإضافةُ مزوّدٍ غدًا — نموذجٌ
 *    سياقيّ، أو معجمٌ ثانٍ — سطرٌ في السجلّ لا تعديلٌ في مزوّدٍ قائم.
 */

import { BUILT_IN, stressWithSource, STRESS_SOURCE } from '../../shadow/stress.js';
import { settings } from '../../../db/repositories.js';
import { STRESS_ORIGIN, STRESS_MATURITY } from './types.js';
import { lookupStress, lexiconReady } from './lexicon-store.js';

const MARK = '́';
const VOWELS = 'аоэуыиеёюя';

/** رقمُ حرف العلّة الذي تليه العلامة، أو `-1`. */
export function markedOrdinal(marked) {
  const chars = [...String(marked || '').toLowerCase()];
  let ordinal = -1;
  for (let i = 0; i < chars.length; i += 1) {
    if (!VOWELS.includes(chars[i])) continue;
    ordinal += 1;
    if (chars[i + 1] === MARK) return ordinal;
  }
  return -1;
}

export const bareOf = (word) => String(word || '')
  .toLowerCase().replace(/[.,!?;:—«»""'']/g, '').split(MARK).join('');

const vowelCount = (bare) => [...bare].filter((ch) => VOWELS.includes(ch)).length;

/* ================================================================== *
 * ١ · تجاوزُ المستخدم + العلامةُ المكتوبة + القاموسُ المدمج
 *
 * ⚠️ **الثلاثةُ في مزوّدٍ واحدٍ لأن `stressWithSource` تفصلهم أصلًا.**
 *    وإنشاءُ ثلاثة مزوّدين يقرأ كلٌّ منها نفسَ الدالّة سيكون تكرارًا
 *    بلا فائدة — والفصلُ الحقيقيُّ في القيمة التي تعود: `USER` و
 *    `EXPLICIT` و`DICTIONARY` ثلاثةُ أصولٍ متمايزة.
 * ================================================================== */

export const reviewedProvider = {
  name: 'reviewed',
  resolve(word) {
    const { marked, source } = stressWithSource(word);
    if (!marked || source === STRESS_SOURCE.UNKNOWN) return null;

    /*
     * ⚠️ **علامةٌ مصدرُها المعجمُ الكبير لا تُحسَم هنا.**
     *    هذا مزوّدُ «المُراجَع»، ورتبتُه ١٠٠. والمعجمُ رتبتُه ٥٠٠ —
     *    بعد السياق لا قبله. فيُترَك ليجيب في موضعه، وإلّا قفز فوق
     *    حسمِك للمتجانِسة لمجرّد أن الرقاقة كانت معلَّمة.
     */
    if (source === STRESS_SOURCE.OFFLINE) return null;

    if (source === STRESS_SOURCE.MONOSYLLABLE) {
      return { ordinal: 0, origin: STRESS_ORIGIN.RULE, status: STRESS_MATURITY.VERIFIED,
        legacySource: source };
    }
    if (source === STRESS_SOURCE.YO) {
      const bare = bareOf(word);
      let ordinal = -1;
      for (const ch of bare) {
        if (!VOWELS.includes(ch)) continue;
        ordinal += 1;
        if (ch === 'ё') {
          return { ordinal, origin: STRESS_ORIGIN.RULE, status: STRESS_MATURITY.VERIFIED,
            legacySource: source };
        }
      }
      return null;
    }

    const ordinal = markedOrdinal(marked);
    if (ordinal < 0) return null;

    const origin = source === STRESS_SOURCE.USER ? STRESS_ORIGIN.USER_OVERRIDE
      : source === STRESS_SOURCE.EXPLICIT ? STRESS_ORIGIN.EXPLICIT_TEXT
        : STRESS_ORIGIN.BUILT_IN_VERIFIED;

    return { ordinal, origin, status: STRESS_MATURITY.VERIFIED, legacySource: source };
  },
};

/* ================================================================== *
 * ٢ · السياق — التباسٌ يحسمه ما حول الكلمة
 * ================================================================== */

const CONTEXT_KEY = 'shadow.stressContext';
let contextMemory = {};

/** يحمّل ما علّمتَه للتطبيق من حسمِ الملتبسات. */
export async function loadStressContext() {
  contextMemory = (await settings.get(CONTEXT_KEY, {})) || {};
  return contextMemory;
}

/** مفتاحُ السياق: الكلمةُ وجارُها — أبسطُ إشارةٍ صادقةٍ نملكها. */
const contextKey = (bare, prev, next) => `${bare}|${bareOf(prev)}|${bareOf(next)}`;

/**
 * يتذكّر أنك حسمتَ التباسًا **في هذا السياق**.
 *
 * ⚠️ **ولماذا لا يُحفَظ كتجاوزٍ عامٍّ للكلمة؟**
 *    لأن `замок` ليست كلمةً واحدةً أخطأنا في نبرها — هي **كلمتان**:
 *    `за́мок` قلعةٌ و`замо́к` قُفل. فحفظُ اختيارك عامًّا يجعل القلعةَ
 *    قفلًا في كلّ نصٍّ قادم. والسياقُ هو ما يميّزهما، فهو ما يُحفَظ.
 */
export async function rememberStressContext(bare, prev, next, ordinal) {
  contextMemory = { ...contextMemory, [contextKey(bare, prev, next)]: ordinal };
  await settings.set(CONTEXT_KEY, contextMemory);
  return contextMemory;
}

export const contextProvider = {
  name: 'context',
  resolve(word, { previousWord = null, nextWord = null } = {}) {
    const bare = bareOf(word);
    const hit = contextMemory[contextKey(bare, previousWord, nextWord)];
    if (!Number.isInteger(hit)) return null;
    return {
      ordinal: hit,
      origin: STRESS_ORIGIN.CONTEXT_HOMOGRAPH,
      /* حسمتَه أنت في هذا السياق — فهو متحقَّقٌ لهذا السياق وحدَه. */
      status: STRESS_MATURITY.VERIFIED,
      legacySource: STRESS_SOURCE.USER,
    };
  },
};

/* ================================================================== *
 * ٣ · المعجمُ الكبير بلا إنترنت
 * ================================================================== */

export const offlineProvider = {
  name: 'offline-lexicon',
  resolve(word) {
    if (!lexiconReady()) return null;
    const bare = bareOf(word);
    const hit = lookupStress(bare);
    if (!hit) return null;

    if (hit.ambiguous) {
      /*
       * ⚠️ **لا يُحسَم ولا يُخفى.** الالتباسُ نتيجةٌ لها قيمة: تقول
       *    للواجهة «اسأل»، وتُعطيها القراءات لتعرضها. وإرجاعُ `null`
       *    هنا كان سيجعل الكلمةَ «مجهولة» — وهي ليست مجهولةً، بل
       *    **معروفةٌ بأكثرَ من وجه**، وفرقٌ كبيرٌ بين الأمرين.
       */
      return {
        ordinal: -1,
        origin: STRESS_ORIGIN.CONTEXT_HOMOGRAPH,
        status: STRESS_MATURITY.AMBIGUOUS,
        variants: hit.variants,
        legacySource: STRESS_SOURCE.UNKNOWN,
      };
    }

    return {
      ordinal: hit.ordinal,
      origin: STRESS_ORIGIN.OFFLINE_KNOWN,
      /* بيانٌ معجميٌّ لا تنبّؤ — ولذلك `VERIFIED`. */
      status: STRESS_MATURITY.VERIFIED,
      alternates: hit.alternates,
      /*
       * ⚠️ **ولا يُكتَب `dictionary`.** الحقلُ القديم يُحفَظ في بيانات
       *    كلماتك، فلو ساوى بين قاموسنا المُراجَع والمعجم الآليّ لما
       *    أمكن بعد سنةٍ أن نعرف أيَّ الكلمات تستحقّ مراجعةً بشريّة.
       */
      legacySource: STRESS_SOURCE.OFFLINE,
    };
  },
};

/* ================================================================== *
 * ٤ · التنبّؤ — مطفأٌ افتراضيًّا
 * ================================================================== */

/**
 * ⚠️ **مطفأٌ عمدًا، ولا يُشغَّل إلّا بطلبٍ صريح.**
 *
 * الطلبُ يقول: «إن كان استعمالُ نبرٍ متنبَّأٍ به يخاطر بتعليم نطقٍ خاطئ
 * كأنه حقيقة، فأبقِ سلوكَ UNKNOWN». وهذا هو الحال: نبرُ الروسيّة لا
 * يُشتقّ من الإملاء، و«التخمينُ أسوأُ من الصمت» مكتوبةٌ في هذا المشروع
 * منذ أوّل يوم.
 *
 * فالمزوّدُ موجودٌ **كنقطة تمديد** — واجهةٌ جاهزةٌ لنموذجٍ حقيقيٍّ يومَ
 * يوجد — ولا يعيد شيئًا اليوم. ولو شُغِّل، فمخرجُه `PREDICTED` و
 * `PROVISIONAL` ولا يجوز أن يُسمّى `VERIFIED` أبدًا.
 */
export const predictionProvider = {
  name: 'prediction',
  enabled: false,
  resolve(word) {
    if (!this.enabled) return null;
    const bare = bareOf(word);
    if (vowelCount(bare) < 2) return null;
    return null;   /* لا نموذجَ بعد — راجع تقريرَ المعمار */
  },
};

export { BUILT_IN };

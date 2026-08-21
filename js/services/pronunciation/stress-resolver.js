/**
 * LingoLife — حلُّ النبر لمحرّك النطق (WS52 · `RU_STRESS_RESOLUTION`)
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا هذا الملفُّ صغيرٌ عمدًا؟
 * ═══════════════════════════════════════════════════════════════
 *
 * لأنه **لا يملك قاموسًا**. القاموسُ في `shadow/stress.js` منذ أوّل
 * يوم — المدمجُ، وقاموسُك الذي يتراكم، وويكاموس بإذنك. وإنشاءُ قاموسٍ
 * ثانٍ هنا كان سيعني مصدرَي حقيقةٍ يفترقان بصمت.
 *
 * فشغلُ هذا الملفّ شيئان لا ثالثَ لهما:
 *  ١ · تحويلُ «كلمةٍ معلَّمةٍ بعلامة» إلى **رقم حرفِ العلّة المشدَّد**.
 *  ٢ · حملُ نسبِ العلامة (`source`) معها إلى آخر خطّ المعالجة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا **رقمُ حرف العلّة** لا موضعُ الحرف في النصّ؟
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن المرحلةَ الرابعة في خطّ المعالجة تُعيد كتابةَ الحروف:
 * `-ого`←`-ово`، `чн`←`شн`، `стн`←`сн`… فمواضعُ الحروف تتزحزح
 * وينكسر أيُّ فهرسٍ محفوظ.
 *
 * **وعددُ حروف العلّة لا يتغيّر في أيٍّ من إعادات الكتابة تلك** — وهو
 * ثابتٌ تحقّقتُ منه قاعدةً قاعدة، ويحرسه اختبار. فرقمُ حرف العلّة
 * يبقى صحيحًا عبر خطّ المعالجة كلِّه، وهو أيضًا **رقمُ المقطع** لأن
 * عددَ المقاطع في الروسيّة = عددُ حروف العلّة.
 */

import { stressWithSource, STRESS_SOURCE } from '../shadow/stress.js';
import { VOWELS, STRESS_MARK } from './alphabet.js';

export { STRESS_SOURCE };

/** حالةُ النبر — وليست `boolean` لأن «مجهول» حالةٌ أولى لا خطأ. */
export const STRESS_STATUS = Object.freeze({
  KNOWN: 'KNOWN',
  UNKNOWN: 'UNKNOWN',
});

/** يزيل علامةَ النبر — للمقارنة والتخزين. */
export function stripStress(text) {
  return String(text || '').replace(new RegExp(STRESS_MARK, 'g'), '');
}

/**
 * رقمُ حرف العلّة الذي تليه العلامة، أو `-1`.
 * @param {string} marked كلمةٌ قد تحوي `U+0301`
 */
export function markedVowelOrdinal(marked) {
  const chars = [...String(marked || '').toLowerCase()];
  let ordinal = -1;
  for (let i = 0; i < chars.length; i += 1) {
    if (!VOWELS.includes(chars[i])) continue;
    ordinal += 1;
    if (chars[i + 1] === STRESS_MARK) return ordinal;
  }
  return -1;
}

/** عددُ حروف العلّة = عددُ المقاطع. */
export function vowelCount(word) {
  return [...String(word || '').toLowerCase()].filter((ch) => VOWELS.includes(ch)).length;
}

/**
 * يحلّ نبرَ كلمةٍ واحدة.
 *
 * @param {string} word الكلمةُ كما كُتبت (قد تحمل علامةً أو لا)
 * @param {{ overrideOrdinal?: number|null }} options
 *        `overrideOrdinal` لتصحيحِك المباشر من الواجهة قبل الحفظ —
 *        يُنسَب `user_confirmed`.
 * @returns {{ status: string, ordinal: number, source: string, syllables: number }}
 */
export function resolveStress(word, { overrideOrdinal = null } = {}) {
  const syllables = vowelCount(stripStress(word));

  if (Number.isInteger(overrideOrdinal) && overrideOrdinal >= 0 && overrideOrdinal < syllables) {
    return {
      status: STRESS_STATUS.KNOWN,
      ordinal: overrideOrdinal,
      source: STRESS_SOURCE.USER,
      syllables,
    };
  }

  /* كلمةٌ بلا حركةٍ أصلًا (`в`, `к`, `с`) — لا نبرَ لها ولا جهلَ بها. */
  if (syllables === 0) {
    return { status: STRESS_STATUS.KNOWN, ordinal: -1, source: STRESS_SOURCE.MONOSYLLABLE, syllables: 0 };
  }

  const { marked, source } = stressWithSource(word);

  if (!marked || source === STRESS_SOURCE.UNKNOWN) {
    return { status: STRESS_STATUS.UNKNOWN, ordinal: -1, source: STRESS_SOURCE.UNKNOWN, syllables };
  }

  /*
   * ⚠️ **حالتان يعرف فيهما المصدرُ الموضعَ بلا علامةٍ مكتوبة.**
   *    `stressOf` تُرجع الكلمةَ كما هي لـ`ё` وللكلمة أحاديّة الحركة —
   *    فلا علامةَ نبحث عنها، والموضعُ مُستنتَجٌ من القاعدة نفسِها.
   */
  if (source === STRESS_SOURCE.MONOSYLLABLE) {
    return { status: STRESS_STATUS.KNOWN, ordinal: 0, source, syllables };
  }
  if (source === STRESS_SOURCE.YO) {
    const bare = [...stripStress(word).toLowerCase()];
    let ordinal = -1;
    for (const ch of bare) {
      if (!VOWELS.includes(ch)) continue;
      ordinal += 1;
      if (ch === 'ё') return { status: STRESS_STATUS.KNOWN, ordinal, source, syllables };
    }
    return { status: STRESS_STATUS.UNKNOWN, ordinal: -1, source: STRESS_SOURCE.UNKNOWN, syllables };
  }

  const ordinal = markedVowelOrdinal(marked);
  if (ordinal < 0) {
    return { status: STRESS_STATUS.UNKNOWN, ordinal: -1, source: STRESS_SOURCE.UNKNOWN, syllables };
  }
  return { status: STRESS_STATUS.KNOWN, ordinal, source, syllables };
}

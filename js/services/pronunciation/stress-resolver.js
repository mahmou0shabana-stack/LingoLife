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

import { STRESS_SOURCE, registerStressLookup } from '../shadow/stress.js';
import { resolveStressDetailed, markWord } from './stress/resolver.js';
import {
  loadStressLexicon, lexiconReady, lexiconMeta, lookupStress,
} from './stress/lexicon-store.js';
import { loadStressContext } from './stress/providers.js';
import { VOWELS, STRESS_MARK } from './alphabet.js';

export { STRESS_SOURCE };
export { lexiconReady, lexiconMeta };

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

/* ================================================================== *
 * التسخين — تحميلُ ما يحتاج شبكةً أو قاعدةَ بيانات، مرّةً واحدة
 * ================================================================== */

let warming = null;
const readyWatchers = new Set();

/**
 * يجهّز مصادرَ النبر التي لا تُقرَأ متزامنةً: المعجمُ الكبير من ملفٍّ
 * ساكن، وذاكرةُ حسمِ الملتبسات من قاعدة البيانات.
 *
 * ⚠️ **ولا يُنتظَر ولا يُعطّل شاشة.** يُنادى ولا يُنتظَر رجوعُه: قبل
 *    وصول المعجم يعمل المحرّكُ كما كان يعمل قبل WS55 بالضبط — قاموسٌ
 *    مدمجٌ ثم «مجهول» — وبعد وصوله تتّسع التغطية. والفرقُ بين
 *    الحالتين تحسينٌ لا عطل، فلا يستحقّ شاشةَ انتظار.
 *
 * ⚠️ **ولا يُخفق أبدًا.** `loadStressLexicon` تبتلع خطأَها بنفسها،
 *    و`loadStressContext` تُحاط هنا — لأن غيابَ المعجم يجب ألّا يمنع
 *    تحليلَ النطق، وغيابُ ذاكرة السياق يجب ألّا يمنع المعجم.
 */
export function warmStressResolver({ fetchImpl } = {}) {
  if (warming) return warming;
  warming = (async () => {
    const [lexicon] = await Promise.all([
      loadStressLexicon(fetchImpl ? { fetchImpl } : {}),
      loadStressContext().catch(() => ({})),
    ]);
    /*
     * ⚠️ **ومسارُ العرض يُوصَل بنفس المعجم — لا بمعجمٍ ثانٍ.**
     *
     *    `markSentence` ترسم العلامةَ على الرقائق وتحسب «كام كلمة نعرف
     *    نبرها». ولو تركناها على القاموس المدمج وحدَه لرأيتَ رقاقةً بلا
     *    علامة وورقةَ تحليلٍ تقول `докуме́нт` عن نفس الكلمة في نفس
     *    اللحظة — نظامان يفترقان أمام عينيك.
     *
     *    فتُركَّب هنا **نفسُ `lookupStress` ونفسُ `markWord`** اللتان
     *    يستعملهما `offlineProvider`، وفي نفس رتبتِه من الأولويّة.
     */
    registerStressLookup((bare) => {
      const hit = lookupStress(bare);
      /* الملتبسةُ لا تُعلَّم: علامةٌ واحدةٌ على كلمةٍ بقراءتين ادّعاءُ حسمٍ. */
      if (!hit || hit.ambiguous) return null;
      return markWord(bare, hit.ordinal);
    });

    /*
     * الواجهةُ التي رسمت تحليلًا قبل وصول المعجم لا تعرف أنه وصل —
     * فتُبلَّغ. وبلاغٌ واحدٌ بعد أوّل تحميلٍ يكفي: المعجمُ لا يُفرَّغ.
     */
    for (const fn of readyWatchers) { try { fn(); } catch { /* مراقبٌ ميّت */ } }
    readyWatchers.clear();
    return lexicon;
  })();
  return warming;
}

/**
 * يُنادى مرّةً حين يصير المعجمُ جاهزًا — أو **فورًا** إن كان جاهزًا.
 * @returns {() => void} لإلغاء الاشتراك
 */
export function onStressLexiconReady(fn) {
  if (lexiconReady()) { fn(); return () => {}; }
  readyWatchers.add(fn);
  return () => readyWatchers.delete(fn);
}

/** ⚠️ للاختبارات وحدَها. */
export function __resetWarm() {
  warming = null;
  readyWatchers.clear();
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
/**
 * يحلّ نبرَ كلمةٍ واحدة — **مِحوَلٌ رقيقٌ فوق `StressResolver`**.
 *
 * ⚠️ **ولماذا بقي هذا الملفُّ بدل أن يُستبدَل؟**
 *
 * لأن `analyzeWord` تناديه **متزامنةً**، وثلاثون قاعدةَ نطقٍ ومئاتُ
 * الاختبارات مبنيّةٌ على شكل ما يعيده: `{status, ordinal, source,
 * syllables}`. فتغييرُ الشكل كان سيعني تعديلَ كلّ ذلك لأجل طبقةٍ
 * جديدةٍ تحته — وهو ما مُنِعتُ منه صراحةً وأوافق عليه.
 *
 * فالجديدُ يعيش في `stress/`، وهذا الملفُّ يترجم: يسأل الحلّالَ سؤالَه
 * المفصَّل، ويعيد للمحرّك الشكلَ الذي يعرفه. والحقولُ الجديدة تُمرَّر
 * في `detail` لمن يريدها (الوضعُ المتقدّم، أثرُ النبر) ولا تُزعج مَن
 * لا يريدها.
 *
 * @returns {{ status, ordinal, source, syllables, detail }}
 */
export function resolveStress(word, {
  overrideOrdinal = null, previousWord = null, nextWord = null,
} = {}) {
  const detail = resolveStressDetailed(word, { overrideOrdinal, previousWord, nextWord });

  /*
   * ⚠️ **والالتباسُ يُترجَم «مجهولًا» للمحرّك — عن قصد.**
   *    قواعدُ الاختزال تحتاج موضعًا واحدًا؛ وكلمةٌ بقراءتين ليس لها
   *    موضعٌ واحد. فالمحرّكُ يمتنع كما يمتنع عن المجهول، **والفرقُ
   *    محفوظٌ في `detail`**: الواجهةُ تعرض القراءتين وتسأل، بدل أن
   *    تقول «مش عارف» عن كلمةٍ نعرفها بوجهين.
   */
  const known = detail.ordinal >= 0
    || detail.legacySource === 'rule_monosyllable';

  return {
    status: known ? STRESS_STATUS.KNOWN : STRESS_STATUS.UNKNOWN,
    ordinal: detail.ordinal,
    source: known ? detail.legacySource : STRESS_SOURCE.UNKNOWN,
    syllables: detail.syllables,
    detail,
  };
}

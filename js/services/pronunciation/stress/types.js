/**
 * LingoLife — مفرداتُ حلّ النبر (WS55)
 *
 * ⚠️ **مصدرُ النبر وحالتُه شيئان، والخلطُ بينهما يُفقد المعنى.**
 *
 *   · `origin` يقول **من أين جاء**: أنت؟ القاموسُ المُراجَع؟ المعجمُ
 *     الكبير؟ السياق؟ تنبّؤ؟
 *   · `status` يقول **كم نثق به**: متحقَّق؟ مبدئيّ؟ ملتبس؟ مجهول؟
 *
 * وليسا مترابطَين ترابطًا حتميًّا: معجمٌ كبيرٌ قد يعطي مدخَلًا متحقَّقًا
 * وقد يعطي التباسًا؛ والسياقُ قد يحسم وقد يعجز. فحقلان لا حقل.
 *
 * ⚠️ **ولا حقلَ `confidence` هنا ولا في أيّ مكان.** المشروعُ يستعمل
 *    حالاتٍ مسمّاةً لا نسبًا مئويّة — «٨٧٪» لا تقول للمتعلّم شيئًا
 *    يتصرّف بناءً عليه، و«ملتبس» تقول له: اختر أنت.
 */

/** من أين جاءت علامةُ النبر. */
export const STRESS_ORIGIN = Object.freeze({
  /** تصحيحُك أنت — يعلو على كلّ شيء. */
  USER_OVERRIDE: 'USER_OVERRIDE',
  /** علامةٌ مكتوبةٌ في النصّ نفسِه (لا في قاموسٍ منّا). */
  EXPLICIT_TEXT: 'EXPLICIT_TEXT',
  /** قاموسُ LingoLife المدمج — مُراجَعٌ يدويًّا. */
  BUILT_IN_VERIFIED: 'BUILT_IN_VERIFIED',
  /** المعجمُ الكبيرُ المُصدَّرُ بلا إنترنت. */
  OFFLINE_KNOWN: 'OFFLINE_KNOWN',
  /** التباسٌ حُسم بالسياق. */
  CONTEXT_HOMOGRAPH: 'CONTEXT_HOMOGRAPH',
  /** قاعدةٌ صرفيّةٌ لا معجم: `ё` أو حركةٌ واحدة. */
  RULE: 'RULE',
  /** تنبّؤٌ لا معرفة. */
  PREDICTED: 'PREDICTED',
  /** لا شيء. */
  UNKNOWN: 'UNKNOWN',
});

/** كم نثق بهذه العلامة. */
export const STRESS_MATURITY = Object.freeze({
  /** بيانٌ معجميٌّ أو مراجعةٌ بشريّة. */
  VERIFIED: 'VERIFIED',
  /** مبنيٌّ على دليلٍ ولم يُراجَع بعدُ فردًا فردًا. */
  PROVISIONAL: 'PROVISIONAL',
  /** قراءتان صحيحتان فأكثر — ولا يُحسَم بالإملاء. */
  AMBIGUOUS: 'AMBIGUOUS',
  /** لا نعرف. */
  UNKNOWN: 'UNKNOWN',
});

/**
 * ترتيبُ الأولويّة — **رقمٌ صريحٌ لا ترتيبُ تسجيل**.
 *
 * ⚠️ وهو نفسُ مبدأ سجلّ قواعد النطق: مزوّدٌ يُضاف غدًا يأخذ رقمَه،
 *    ولا يزحزح أحدًا بالصدفة. والأصغرُ يفوز.
 */
export const PROVIDER_PRIORITY = Object.freeze({
  USER_OVERRIDE: 100,
  EXPLICIT_TEXT: 200,
  BUILT_IN_VERIFIED: 300,
  CONTEXT_HOMOGRAPH: 400,
  OFFLINE_KNOWN: 500,
  RULE: 600,
  PREDICTED: 700,
});

/** شرحٌ عربيٌّ يُعرَض في الوضع المتقدّم. */
export const ORIGIN_LABEL = Object.freeze({
  USER_OVERRIDE: 'إنت اللي حدّدته',
  EXPLICIT_TEXT: 'مكتوب في النصّ',
  BUILT_IN_VERIFIED: 'قاموس التطبيق المُراجَع',
  OFFLINE_KNOWN: 'المعجم الكبير (بلا إنترنت)',
  CONTEXT_HOMOGRAPH: 'اتحدّد من سياق الجملة',
  RULE: 'قاعدة صرفية (ё أو حرف علّة واحد)',
  PREDICTED: 'تنبّؤ — مش معرفة',
  UNKNOWN: 'مش معروف',
});

export const MATURITY_LABEL = Object.freeze({
  VERIFIED: 'مُتحقَّق منه',
  PROVISIONAL: 'مبدئيّ',
  AMBIGUOUS: 'ملتبس — أكتر من قراءة صحيحة',
  UNKNOWN: 'مجهول',
});

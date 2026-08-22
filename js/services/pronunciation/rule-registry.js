/**
 * LingoLife — سجلُّ قواعد النطق (WS52)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الترتيبُ رقمٌ مكتوب — **لا ترتيبَ استيراد**
 * ═══════════════════════════════════════════════════════════════
 *
 * أخطرُ عطبٍ في محرّكِ قواعدَ ليس قاعدةً خاطئة، بل **قاعدتين صحيحتين
 * تُطبَّقان بترتيبٍ خاطئ**. ولأن ترتيبَ `import` في جافاسكربت يتبع
 * ترتيبَ الكتابة، فمحرّكٌ يسجّل قواعدَه عند الاستيراد يكون ترتيبُه
 * **مصادفةً في ملفّ**: يكفي أن يُرتِّب أحدُهم الاستيراداتِ أبجديًّا
 * ليتغيّر نطقُ اللغة كلِّها بلا أن يُلمَس سطرُ قاعدة.
 *
 * فهنا: لكلّ قاعدةٍ `priority` **رقمٌ صريح**، والسجلُّ يفرز به وحدَه،
 * ويرفض رقمَين متساويين في المرحلة نفسِها، **واختبارٌ يُثبِّت التسلسلَ
 * الكاملَ رقمًا رقمًا** فيسقط لو تغيّر بالصدفة.
 *
 * وترتيباتٌ بعينها ليست ذوقًا — راجع `docs/russian-pronunciation-spec.md §20.5`:
 *  · الهمسُ النهائيّ (٦٠٠) **قبل** المماثلة الرجعيّة (٦١٠) — `поезд`.
 *  · إعادةُ الكتابة الأورثوإبيّة (٣٠٠) **قبل** تحويل الحرف إلى صوت.
 *  · الصلابةُ (٤٠٠) **قبل** الاختزال (٥٠٠) — لأن الاختزال يسأل عنها.
 *  · المعجمُ (٩٠٠) **آخرًا** — لأنه تجاوزٌ لا مدخَل.
 */

/**
 * إصدارُ مجموعة القواعد — يُخزَّن مع كلّ تحليلٍ محفوظ.
 *
 * ⚠️ **وهو ما يجعل التحليلَ قابلًا للنقض.** الكلمةُ المحفوظةُ تحمل
 *    إصدارَ القواعد الذي حُلِّلت به؛ فحين تُصحَّح قاعدةٌ ويرتفع الإصدار،
 *    تُعرَف كلُّ الكلمات المتأثّرة وتُعاد تحليلًا بلا أن تُحرّر واحدةً
 *    بيدك. راجع `reanalysis.js`.
 */
export const RULESET_VERSION = '2.1.0';

/**
 * حالةُ نضج القاعدة — **وليست نسبةَ ثقةٍ مزيّفة**.
 *
 * ⚠️ **لماذا حالاتٌ مسمّاةٌ لا رقمٌ من مئة؟**
 *    لأن «٨٧٪» لا تقول شيئًا يُتصرَّف بناءً عليه. أمّا «مُختلَفٌ فيها»
 *    فتقول: لا تُصدّقها وحدَها، وانظر البديل. و«مبدئيّة» تقول: مبنيّةٌ
 *    على دليلٍ معتبَر ولم تُراجَع على النصّ الكامل بعد. الحالةُ
 *    **تصف ما نعرفه عن معرفتنا**، والرقمُ يُخفيه خلف دقّةٍ موهومة.
 */
export const STATUS = Object.freeze({
  /** رُوجعت على دليلٍ كافٍ من مصدرٍ معياريّ. */
  VERIFIED: 'VERIFIED',
  /** مبنيّةٌ على دليلٍ معتبَر، ومراجعةُ النصّ الكامل ما زالت معلَّقة. */
  PROVISIONAL: 'PROVISIONAL',
  /** المصادرُ المعياريّة تختلف، أو النطقُ نفسُه متغيّر. */
  DISPUTED: 'DISPUTED',
  /** سلوكٌ يخصّ كلماتٍ بعينها لا يُعمَّم. */
  LEXICAL: 'LEXICAL',
  /** ظاهرةٌ معروفةٌ لم تُنفَّذ بأمانٍ بعد. */
  DEFERRED: 'DEFERRED',
});

/** الحالاتُ التي يجوز لقاعدةٍ **مُنفَّذة** أن تحملها. */
const IMPLEMENTABLE = [STATUS.VERIFIED, STATUS.PROVISIONAL, STATUS.DISPUTED, STATUS.LEXICAL];

/** شرحٌ عربيٌّ للحالة — يُعرَض في الوضع المتقدّم. */
export const STATUS_LABEL = Object.freeze({
  VERIFIED: 'مُتحقَّق منها',
  PROVISIONAL: 'مبدئيّة — لسه محتاجة مراجعة على المصدر الكامل',
  DISPUTED: 'مُختلَفٌ فيها — المصادر مش متّفقة أو النطق نفسه بيختلف',
  LEXICAL: 'معجميّة — بتخصّ كلمات بعينها',
  DEFERRED: 'مؤجَّلة — معروفة وما اتنفّذتش لسه',
});

/** فئاتُ القواعد. */
export const RULE_CATEGORY = Object.freeze({
  STRESS: 'STRESS',
  SYLLABLE: 'SYLLABLE',
  VOWEL_REDUCTION: 'VOWEL_REDUCTION',
  PALATALIZATION: 'PALATALIZATION',
  HARDNESS: 'HARDNESS',
  VOICING: 'VOICING',
  DEVOICING: 'DEVOICING',
  ASSIMILATION: 'ASSIMILATION',
  CONSONANT_CLUSTER: 'CONSONANT_CLUSTER',
  ORTHOEPY: 'ORTHOEPY',
  LEXICAL_EXCEPTION: 'LEXICAL_EXCEPTION',
});

/**
 * مراحلُ خطّ المعالجة — **ولكلٍّ دلالةُ تطبيقٍ مختلفة**، مكتوبةٌ هنا
 * لأنها عقدٌ بين السجلّ والمُشغِّل لا تفصيلَ تنفيذ.
 */
export const STAGE = Object.freeze({
  /** تُطبَّق **كلُّ** المطابِقات بالترتيب، تراكميًّا على نصّ الحروف. */
  ORTHOEPIC_REWRITE: 'ORTHOEPIC_REWRITE',
  /** **أوّلُ** مطابِقٍ يفوز — القواعدُ متنافيةٌ بالتصميم. */
  HARDNESS: 'HARDNESS',
  /** **أوّلُ** مطابِقٍ يفوز. */
  VOWEL_REDUCTION: 'VOWEL_REDUCTION',
  /** **أوّلُ** مطابِقٍ يفوز، والمرورُ من آخر الكلمة إلى أوّلها. */
  VOICING: 'VOICING',
});

/** مستوى الدليل — راجع `§20.0` في المواصفة. */
export const EVIDENCE = Object.freeze({
  SNIPPET: 'SOURCE_SNIPPET',
  PENDING: 'SOURCE_PENDING',
});

const REQUIRED = ['id', 'category', 'stage', 'priority', 'summary', 'source', 'status', 'evidence'];

/** السجلُّ الحقيقيّ — `Map` لأن ترتيبَ الإدراج لا يعنينا، الفرزُ يعني. */
const rules = new Map();

/**
 * يسجّل قاعدة.
 *
 * ⚠️ **ويرفض ما ينقصه حقلٌ إلزاميّ.** قاعدةٌ بلا `source` قاعدةٌ بلا
 *    مرجع، وقاعدةٌ بلا مرجعٍ لا يجوز أن تنطق باسم اللغة. والرفضُ هنا
 *    وقتَ التحميل أرحمُ من اكتشافها في تقريرٍ بعد شهر.
 */
export function registerRule(rule) {
  for (const key of REQUIRED) {
    if (rule?.[key] === undefined || rule?.[key] === null || rule?.[key] === '') {
      throw new Error(`قاعدةٌ بلا «${key}»: ${rule?.id || '(بلا معرّف)'}`);
    }
  }
  if (rules.has(rule.id)) throw new Error(`مُعرِّفٌ مكرَّر: ${rule.id}`);

  /*
   * ⚠️ **ولا تدخل قاعدةٌ مؤجَّلةٌ المحرّكَ.** `DEFERRED` وصفٌ لظاهرةٍ
   *    نعرفها ولم نُنفّذها — مكانُها `DEFERRED_PHENOMENA` أدناه لا
   *    السجلُّ التنفيذيّ. ولو سُجِّلت هنا لصارت تنطق باسم اللغة وهي
   *    معلَنةٌ غيرَ جاهزة.
   */
  if (!IMPLEMENTABLE.includes(rule.status)) {
    throw new Error(`حالةٌ لا تصلح لقاعدةٍ مُنفَّذة: ${rule.id} → ${rule.status}`);
  }

  for (const other of rules.values()) {
    if (other.stage === rule.stage && other.priority === rule.priority) {
      throw new Error(`أولويّةٌ مكرَّرة في ${rule.stage}: ${rule.id} و${other.id} كلاهما ${rule.priority}`);
    }
  }
  rules.set(rule.id, Object.freeze({ version: RULESET_VERSION, ...rule }));
  return rule.id;
}

/** كلُّ القواعد مفروزةً بالأولويّة — مصدرُ الترتيب الوحيد. */
export function orderedRules() {
  return [...rules.values()].sort((a, b) => a.priority - b.priority);
}

/** قواعدُ مرحلةٍ بعينها، مفروزة. */
export function rulesForStage(stage) {
  return orderedRules().filter((r) => r.stage === stage);
}

/** قاعدةٌ بمعرّفها — للواجهة حين تعرض «القواعد بالتفصيل». */
export function ruleById(id) {
  return rules.get(id) || null;
}

/** كلُّ المعرِّفات — للاختبارات ولمكتبة القواعد المستقبليّة (§26). */
export function allRuleIds() {
  return orderedRules().map((r) => r.id);
}

/** القواعدُ حسب الحالة — للتقرير وللوضع المتقدّم. */
export function rulesByStatus() {
  const out = { VERIFIED: [], PROVISIONAL: [], DISPUTED: [], LEXICAL: [] };
  for (const rule of orderedRules()) out[rule.status]?.push(rule.id);
  return out;
}

/**
 * ظواهرُ نعرفها ولم نُنفّذها — **بيانٌ لا نثرٌ في وثيقة**.
 *
 * ⚠️ **ولماذا تُخزَّن بدل أن تُكتَب في ملفّ markdown؟**
 *    لأن المؤجَّلَ المكتوبَ في وثيقةٍ يُنسى، والمؤجَّلَ في بنيةِ بيانات
 *    يظهر في التقرير ويُعَدّ ويُراجَع. وهو أيضًا ما يمنع أن يُعاد
 *    «اكتشافُ» ظاهرةٍ قرّرنا تأجيلها بوعيٍ، فتُنفَّذ على عجل.
 */
export const DEFERRED_PHENOMENA = Object.freeze([
  { id: 'RU_ZH_LONG_IN_ROOT', why: 'зж/жж داخل الجذر: طويلةٌ ليّنةٌ أو صلبةٌ بحسب المتحدّث — والمصدرُ نفسُه يعطي الوجهين' },
  { id: 'RU_RED_A_AFTER_HUSHING', why: 'жалеть → [жыл\'эт\'] — معيارٌ موسكوفيٌّ قديمٌ متغيّرٌ اليوم' },
  { id: 'RU_UNSTRESSED_E_CARET', why: 'э غيرُ المشدَّدة (этаж, экран): لم يصل مقتطفٌ يحدّد قيمتَها — تبقى بلا ادّعاء' },
  { id: 'RU_LOANWORD_UNREDUCED_O', why: 'радио/боа/какао: تحتاج معجمًا موسومًا بالأصل الأجنبيّ لا نملكه' },
  { id: 'RU_LOANWORD_HARD_E_BROAD', why: 'المصدرُ صريح: «لا قواعدَ ثابتة، والمعيارُ متغيّر، ويُرجَع للمعاجم الأورثوإبيّة» — فالقائمةُ العريضة تحتاج معجمًا لا يجوز نسخُه' },
  { id: 'RU_CROSS_WORD_PROSODY', why: 'أثرُ الوقف والتنغيم على المماثلة عبر الحدود — المصدرُ يشترط «بلا وقفة» ونحن لا نعرف أين تقف' },
  { id: 'RU_PREPOSITION_I_TO_Y', why: 'в Италии → [вытал\'ии]: يحتاج معرفةَ أن الكلمةَ السابقة حرفُ جرٍّ ينتهي بساكنٍ صلب — بنيةٌ موجودةٌ وتنفيذٌ لم يُختبَر' },
  { id: 'RU_INTONATION_IK', why: 'التنغيم (ИК-1…ИК-7) خارج سؤال «لماذا تُنطق الكلمةُ هكذا»' },
  { id: 'RU_CHT_BROAD', why: 'чт←шт خارج что/чтобы: قائمةٌ ضيّقةٌ ومختلَفٌ فيها — والكلمتان في المعجم مباشرةً' },
]);

/** ⚠️ للاختبارات وحدَها: تفريغُ السجلّ. لا يُنادى من كودِ إنتاج. */
export function __resetRegistry() {
  rules.clear();
}

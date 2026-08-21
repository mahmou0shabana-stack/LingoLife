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

/** إصدارُ مجموعة القواعد — يُخزَّن مع كلّ تحليلٍ محفوظ (§24 من الطلب). */
export const RULESET_VERSION = '1.0.0';

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

/** درجاتُ الثقة كما في المواصفة. */
export const CONFIDENCE = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
});

/** مستوى الدليل — راجع `§20.0` في المواصفة. */
export const EVIDENCE = Object.freeze({
  SNIPPET: 'SOURCE_SNIPPET',
  PENDING: 'SOURCE_PENDING',
});

const REQUIRED = ['id', 'category', 'stage', 'priority', 'summary', 'source', 'confidence', 'evidence'];

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

/** ⚠️ للاختبارات وحدَها: تفريغُ السجلّ. لا يُنادى من كودِ إنتاج. */
export function __resetRegistry() {
  rules.clear();
}

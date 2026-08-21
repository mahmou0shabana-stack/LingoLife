/**
 * LingoLife — معجمُ النطق المركزيّ (WS52 · `RU_LEXICAL_ORTHOEPIC_EXCEPTION`)
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا مكانٌ واحدٌ لا شروطٌ متناثرة؟
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن `if (word === 'что')` داخل وحدةِ قاعدةٍ يكذب مرّتين: يجعل
 * الاستثناءَ يبدو قاعدةً، ويجعل القاعدةَ تبدو أوسعَ مِمّا هي. وبعد
 * عشرين استثناءً مبثوثًا لا يبقى أحدٌ يعرف ما الذي تفعله القاعدةُ
 * حقًّا — ولا الاختبارُ يعرف.
 *
 * فكلُّ ما **لا يُشتقّ من الإملاء** هنا، ومعه سببُه ومرجعُه وثقتُه.
 * والمحرّكُ يعلم أن النتيجةَ جاءت من معجمٍ لا من قاعدة، فتقول له
 * الواجهةُ: «دي حالة معجمية خاصة» بدل أن تدّعي قاعدةً عامّة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ و`VARIANT` **لا يُحوِّل شيئًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * حين تختلف المصادرُ (`булочная`: بـ`чн` أم `шн`؟) فالجوابُ الأمينُ
 * ليس اختيارَ أحدهما صامتًا — بل قولُ «النطقان مقبولان». وهذا ما
 * تفعله مدخلاتُ `VARIANT`: تُعلِّم النتيجةَ ولا تمسّها.
 */

import { RULE_CATEGORY, STATUS, EVIDENCE } from './rule-registry.js';

/** تصنيفُ سببِ الاستثناء. */
export const LEXICAL_CATEGORY = Object.freeze({
  ORTHOEPY: 'ORTHOEPY',
  BORROWING: 'BORROWING',
  GRAMMATICAL: 'GRAMMATICAL',
  VARIANT: 'VARIANT',
});

/**
 * مدخلاتُ المعجم.
 *
 * `rewrite` إعادةُ كتابةٍ على **الحروف** تدخل خطَّ المعالجة الطبيعيّ
 * بعدها — فتُختزَل حركاتُها ويُهمَس آخرُها كأيّ كلمة. وهذا أدقُّ من
 * كتابة النطق النهائيّ يدويًّا، لأنه لا يتجمّد حين تتحسّن القواعد.
 */
export const LEXICON = Object.freeze({
  что: {
    rewrite: 'што',
    category: LEXICAL_CATEGORY.ORTHOEPY,
    reason: 'сочетание чт يُنطَق [шт] في هذه الكلمة ومشتقّاتها وحدَها',
    explain: '«что» بتتنطق «што» — دي حالة خاصة، مش قاعدة لكل «чт».',
    source: 'МГУ · orfoepija/tabl/chn_cht_zhd.htm',
    status: STATUS.LEXICAL,
    evidence: EVIDENCE.SNIPPET,
  },
  чтобы: {
    rewrite: 'штобы',
    category: LEXICAL_CATEGORY.ORTHOEPY,
    reason: 'كـ«что»',
    explain: '«чтобы» بتتنطق «штобы».',
    source: 'МГУ · orfoepija/tabl/chn_cht_zhd.htm',
    status: STATUS.LEXICAL,
    evidence: EVIDENCE.SNIPPET,
  },
  сегодня: {
    rewrite: 'севодня',
    category: LEXICAL_CATEGORY.GRAMMATICAL,
    reason: 'г←в في نهايةٍ صرفيّةٍ **داخل** الكلمة، فلا تلتقطها قاعدةُ -ого النهائيّة',
    explain: '«сегодня» فيها «г» بتتنطق «в» — «севодня».',
    source: 'orfogrammka.ru · «Буква г в окончаниях -ого/-его»',
    status: STATUS.LEXICAL,
    evidence: EVIDENCE.SNIPPET,
  },
  здравствуйте: {
    rewrite: 'здраствуйте',
    category: LEXICAL_CATEGORY.ORTHOEPY,
    reason: 'вств: أوّلُ الساكنَين لا يُنطَق',
    explain: 'الـ«в» الأولى في «здравствуйте» مبتتنطقش.',
    source: 'МГУ · orfoepija/sochetan.htm',
    status: STATUS.LEXICAL,
    evidence: EVIDENCE.SNIPPET,
  },
  чувство: {
    rewrite: 'чуство',
    category: LEXICAL_CATEGORY.ORTHOEPY,
    reason: 'вств: أوّلُ الساكنَين لا يُنطَق',
    explain: 'الـ«в» الأولى في «чувство» مبتتنطقش.',
    source: 'МГУ · orfoepija/sochetan.htm',
    status: STATUS.LEXICAL,
    evidence: EVIDENCE.SNIPPET,
  },

  /* ---- خلافٌ حقيقيٌّ بين المصادر: يُعرَض ولا يُحسَم ---- */
  булочная: variant('було[чн]ая / було[шн]ая'),
  прачечная: variant('праче[чн]ая / праче[шн]ая'),
  копеечный: variant('копее[чн]ый / копее[шн]ый'),
  порядочный: variant('порядо[чн]ый / порядо[шн]ый'),
  молочный: variant('моло[чн]ый / моло[шн]ый'),
  сливочный: variant('сливо[чн]ый / сливо[шн]ый'),
});

function variant(display) {
  return {
    rewrite: null,
    variants: display,
    category: LEXICAL_CATEGORY.VARIANT,
    reason: 'المصادرُ المعياريّة تقبل النطقين، والنطقُ بـ[шн] قديمٌ موسكوفيٌّ ينحسر',
    explain: 'الكلمة دي ليها نطقين، الاتنين مقبولين.',
    source: 'russkiymir.ru · «Ску[чн]о или ску[шн]о?»',
    status: STATUS.DISPUTED,
    evidence: EVIDENCE.SNIPPET,
  };
}

/**
 * ⚠️ **قائمةُ منعٍ لا قائمةُ تطبيق.**
 *
 * كلماتٌ تنتهي بـ`ого`/`его` **وليست** نهايةً صرفيّة. لولا هذه القائمةُ
 * لصارت `много` تُنطَق «مнова» — وهو أخطرُ إفراطٍ في قاعدة `-ого`،
 * لأنه يقع على كلمةٍ من أكثر كلمات الروسيّة ورودًا.
 */
export const GO_ENDING_EXCLUSIONS = Object.freeze([
  'много', 'строго', 'убого', 'отлого', 'полого', 'немного', 'намного', 'долго',
]);

/**
 * ⚠️ **قائمةٌ مغلقة** لـ`чн`←`шн` (`RU_ORTHO_CHN_SHN`).
 *    وكلُّ ما عداها يبقى `чн`. راجع المواصفة: `точный` و`прочный`
 *    و`вечный` أمثلةٌ مضادّةٌ مختبَرة.
 */
export const CHN_SHN = Object.freeze([
  'конечно', 'скучно', 'нарочно', 'яичница', 'пустячный', 'скворечник', 'девичник',
]);

/** أسماءُ الآباء المؤنّثة على `-ична` — نمطٌ لا قائمةٌ مغلقة. */
export const CHN_SHN_PATRONYMIC = /^[а-яё]+ична$/;

/** يبحث عن مدخَلٍ معجميّ. */
export function lexiconEntry(word) {
  const key = String(word || '').toLowerCase().replace(/́/g, '');
  return Object.hasOwn(LEXICON, key) ? { word: key, ...LEXICON[key] } : null;
}

/** هل هذه الكلمةُ مستثناةٌ من قاعدة `-ого`؟ */
export function isGoEndingExcluded(word) {
  const key = String(word || '').toLowerCase().replace(/́/g, '');
  return GO_ENDING_EXCLUSIONS.includes(key);
}

/** هل تدخل هذه الكلمةُ قائمةَ `чн`←`шн`؟ */
export function isChnShn(word) {
  const key = String(word || '').toLowerCase().replace(/́/g, '');
  return CHN_SHN.includes(key) || CHN_SHN_PATRONYMIC.test(key);
}

/** وصفُ القاعدة المعجميّة للأثر. */
export const LEXICAL_RULE = Object.freeze({
  id: 'RU_LEXICAL_ORTHOEPIC_EXCEPTION',
  category: RULE_CATEGORY.LEXICAL_EXCEPTION,
  priority: 900,
});

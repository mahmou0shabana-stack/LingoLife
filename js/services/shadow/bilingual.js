/**
 * LingoLife — قراءةُ النصّ الثنائيّ: روسيٌّ ↔ عربيّ (WS-D)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما تفعله هذه الوحدة — وما ترفض أن تفعله
 * ═══════════════════════════════════════════════════════════════
 *
 * > «بلصق نصّ فيه جملة روسي وتحتها ترجمتها بالعربي. التطبيق يعرف
 * >  الروسي، لكن العربي بيضيع أو بيبقى ضوضا.»
 *
 * فالمطلوبُ أن تصير:
 *
 *     جملةٌ روسيّة  ↔  ترجمتُها العربيّة
 *
 * **زوجًا من الدرجة الأولى** — لا سطرين متجاورين بالصدفة.
 *
 * ⚠️ **والقران بنيويٌّ لا دلاليّ** (بند ٨). لا تشابهَ معانٍ، ولا ترجمةَ
 *    آليّة، ولا نموذجَ تضمين، ولا شبكة. الأدلّةُ المسموحة كلُّها
 *    **مرئيّةٌ في شكل النصّ**: المجاورة، والكتابة، والترتيب، وحدودُ
 *    الفقرات، وتساوي العدد، والفواصلُ الصريحة.
 *
 * ⚠️ **وحين تنقص الأدلّة لا نخمّن.** الحالةُ تصير `NEEDS_REVIEW`
 *    ويقرّر الإنسان. زوجٌ مخترَعٌ أسوأُ من زوجٍ ناقص: الناقصُ تراه
 *    فتُكمله، والمخترَعُ تصدّقه فتحفظ ترجمةً ليست ترجمته.
 *
 * ⚠️ **ولا تعرف هذه الوحدةُ DOM ولا قاعدةَ بيانات.** نصٌّ يدخل وبنيةٌ
 *    تخرج — فتُختبَر حتميًّا، وتصلح للمسودّة وللاستخراج ولأيّ بابٍ
 *    يجيء غدًا.
 */

import { splitSentences } from './segmenter.js';

/* ================================================================== */
/* ١) تصنيفُ الكتابة (بند ٤)                                           */
/* ================================================================== */

/**
 * الكتابةُ الغالبة على نصّ.
 *
 * ⚠️ **«محايد» ليست لغةً ثالثة** بل غيابُ دليل: أرقامٌ ورموزٌ وترقيم.
 *    وسطرٌ كهذا لا يُقرَن ولا يُنطَق ولا يُحسَب جملة.
 */
export const SCRIPT = Object.freeze({
  CYRILLIC: 'cyrillic',
  ARABIC: 'arabic',
  MIXED: 'mixed',
  NEUTRAL: 'neutral',
});

/*
 * ⚠️ **المدياتُ بأكوادها لا بحروفٍ ملصوقة.**
 *
 *    كتبتُها أوّلَ مرّة بحروفٍ عربيّةٍ حقيقيّةٍ داخل `[...]`، وهو
 *    مصدرُ خطأٍ صامت: المحرّرُ ثنائيُّ الاتجاه يعرض المدى «من ... إلى»
 *    مقلوبًا، فلا تستطيع العينُ أن تتحقّق مما كتبتَه. والأكوادُ
 *    تُقرأ كما هي في كلّ محرّر.
 */

/** السيريليّة: الكتلةُ الأساسيّة (0400–04FF) والملحقُ (0500–052F). */
const CYRILLIC_CHAR = /[Ѐ-ӿԀ-ԯ]/g;

/**
 * العربيّة: الأساسيّة والملحقُ والموسَّعةُ والصيغُ التقديميّة.
 *
 * ⚠️ **ولا تُعدّ التشكيلاتُ ولا الأرقامُ الهنديّة ولا التطويلُ حروفًا:**
 *
 *    · التشكيل (064B–065F، 0670): كلمةٌ مشكولةٌ كانت ستُحسَب حروفًا
 *      أكثرَ من نظيرتها المجرّدة، فيميل الترجيحُ لسببٍ لا علاقةَ له
 *      باللغة.
 *    · الأرقام الهنديّة (0660–0669، 06F0–06F9): سطرُ «٢٠٢٥» رقمُ
 *      صفحةٍ لا جملةٌ عربيّة — والبندُ ٤ يقول: الأرقامُ محايدة.
 *    · التطويل (0640): زخرفةُ خطٍّ لا حرف.
 */
const ARABIC_CHAR = new RegExp(
  '['
  + '\\u0620-\\u063F\\u0641-\\u064A'   /* الأساسيّة بلا تطويل */
  + '\\u066E-\\u066F\\u0671-\\u06D3\\u06D5' /* حروفٌ إضافيّة */
  + '\\u06E5-\\u06E6\\u06EE-\\u06EF\\u06FA-\\u06FF'
  + '\\u0750-\\u077F'                  /* الملحق */
  + '\\u08A0-\\u08BF'                  /* الموسَّعة-أ (حروفُها) */
  + '\\uFB50-\\uFDFF\\uFE70-\\uFEFC'   /* الصيغُ التقديميّة */
  + ']',
  'g',
);

/** حروفٌ لاتينيّة — تُعدّ «مع الجملة» ولا تُرجّح كتابةً بنفسها. */
const LATIN_CHAR = /[A-Za-z]/g;

const countOf = (text, re) => (String(text || '').match(re) || []).length;

/**
 * يصنّف نصًّا بحسب كتابته الغالبة.
 *
 * ⚠️ **والترقيمُ والأرقامُ لا تُصنَّف لغةً** (بند ٤): «2025 / + / =»
 *    محايدٌ مهما طال. وهذا ما يمنع سطرَ رقمِ صفحةٍ من أن يصير «جملةً
 *    روسيّة» لأن فيه أرقامًا لاتينيّة الشكل.
 *
 * ⚠️ **واللاتينيّةُ لا ترجّح** (بند ١٦): «ISO 9001» و«A/B» تعيشان داخل
 *    جملةٍ روسيّةٍ أو عربيّة، فعدُّهما كتابةً ثالثةً كان سيجعل
 *    «Стандарт ISO 9001 применяется» مختلطةً بلا داعٍ.
 *
 * @param {string} text
 * @returns {string} أحدُ قيم `SCRIPT`
 */
export function classifyScript(text) {
  const cyr = countOf(text, CYRILLIC_CHAR);
  const ara = countOf(text, ARABIC_CHAR);

  if (!cyr && !ara) return SCRIPT.NEUTRAL;
  if (cyr && !ara) return SCRIPT.CYRILLIC;
  if (ara && !cyr) return SCRIPT.ARABIC;

  /*
   * كلتاهما موجودة. الغلبةُ للأكثر **بفارقٍ واضح**؛ وما دون ذلك
   * مختلطٌ صراحةً — وهو ما يمنع سطرًا فيه كلمةٌ عربيّةٌ واحدةٌ من أن
   * يُسلَب من الروسيّة، ويمنع العكس.
   */
  const total = cyr + ara;
  if (cyr / total >= 0.75) return SCRIPT.CYRILLIC;
  if (ara / total >= 0.75) return SCRIPT.ARABIC;
  return SCRIPT.MIXED;
}

/** هل النصُّ روسيٌّ يصلح مادّةَ تدريب؟ */
export const isRussian = (text) => classifyScript(text) === SCRIPT.CYRILLIC;

/** هل النصُّ عربيٌّ غالب؟ */
export const isArabic = (text) => classifyScript(text) === SCRIPT.ARABIC;

/**
 * نسبةُ الحروف اللغويّة إلى طول النصّ — لتمييز السطر الحقيقيّ من الضوضاء.
 * تُستعمل في كشف العناوين، ولا تُستعمل في التصنيف.
 */
function letterRatio(text) {
  const clean = String(text || '').trim();
  if (!clean.length) return 0;
  const letters = countOf(clean, CYRILLIC_CHAR) + countOf(clean, ARABIC_CHAR)
    + countOf(clean, LATIN_CHAR);
  return letters / clean.length;
}

/* ================================================================== */
/* ٢) أدوارُ السطر: جملة · عنوان · ملاحظة (بنود ٢٩…٣١)                 */
/* ================================================================== */

/** دورُ السطر في البنية — لا في المعنى. */
export const ROLE = Object.freeze({
  SENTENCE: 'sentence',
  HEADING: 'heading',
  NOTE: 'note',
  NOISE: 'noise',
});

/**
 * بادئاتُ ملاحظةٍ صريحة — **قائمةٌ قصيرةٌ ومحافِظة** (بند ٢٩).
 *
 * ⚠️ **ولا نحوَ عربيًّا هنا.** البندُ يحذّر من الإفراط في التخصيص،
 *    فالمحروسُ نمطٌ كتابيٌّ واحد: كلمةٌ دالّةٌ ثم نقطتان. وما عداه
 *    يذهب إلى المراجعة لا إلى التخمين.
 */
const NOTE_PREFIX = /^\s*(ملاحظة|ملحوظة|تنبيه|انتبه|مهم|هام|شرح|تعليق|note|nb)\s*[:：]/i;

/** ونظيرُها الروسيُّ — نفسُ النمط لا أكثر. */
const NOTE_PREFIX_RU = /^\s*(примечание|заметка|внимание|важно)\s*[:：]/i;

/**
 * هل هذا سطرُ عنوان؟ — **بإشاراتٍ بنيويّةٍ وحدَها** (بند ٣٠).
 *
 * ⚠️ **قصيرٌ وبلا نهايةِ جملةٍ ومحاطٌ بفراغ.** ثلاثتُها معًا، لا واحدةٌ
 *    منها: «نعم.» قصيرةٌ وليست عنوانًا (تنتهي بنقطة)، و«المستندات»
 *    داخل فقرةٍ ليست عنوانًا (غيرُ محاطةٍ بفراغ).
 *
 * @param {string} text
 * @param {{alone: boolean}} where `alone` = السطرُ وحدَه في كتلته
 */
function looksHeading(text, { alone }) {
  const clean = String(text || '').trim();
  if (!alone) return false;
  if (!clean || clean.length > 40) return false;
  /* عنوانٌ لا ينتهي بعلامةِ نهايةِ جملة. */
  if (/[.!?؟…]$/.test(clean)) return false;
  /* ولا يحوي فاصلةً — تلك بدايةُ تركيب. */
  if (/[,،;؛]/.test(clean)) return false;
  /* وكلماتُه قليلة. */
  if (clean.split(/\s+/).length > 4) return false;
  return letterRatio(clean) > 0.5;
}

/* ================================================================== */
/* ٣) الزوجُ داخل سطرٍ واحد (بند ١٥)                                   */
/* ================================================================== */

/**
 * فاصلٌ صريحٌ بين طرفين — **محاطٌ بفراغ** أو شرطةٌ طويلة.
 *
 * ⚠️ **والشرطةُ القصيرة تحتاج فراغين حولها.** «из-за» و«кто-то»
 *    تحوي شرطةً داخل الكلمة، وقطعُها هناك يمزّق روسيّةً سليمة. أمّا
 *    «—» و«–» فلا تقعان داخل كلمةٍ روسيّةٍ أبدًا.
 */
const INLINE_DELIM = /\s+[—–]\s+|\s+-\s+|\s+[:=]\s+/;

/**
 * يحاول قراءةَ سطرٍ على أنه «تعبيرٌ روسيّ — ترجمتُه».
 *
 * ⚠️ **ويشترط أن يكون الطرفان قاطعين** (بند ١٥): يسارٌ سيريليٌّ غالب
 *    ويمينٌ عربيٌّ غالب. فـ«Внимание: текст» لا تُقسَم (الطرفان
 *    روسيّان)، و«ملاحظة: كذا» لا تُقسَم (الطرفان عربيّان).
 *
 * @returns {{ru: string, ar: string}|null}
 */
export function inlinePair(line) {
  const text = String(line || '').trim();
  if (!text) return null;

  const at = text.search(INLINE_DELIM);
  if (at < 0) return null;

  const match = text.match(INLINE_DELIM);
  const left = text.slice(0, at).trim();
  const right = text.slice(at + match[0].length).trim();
  if (!left || !right) return null;

  /* ⚠️ ولا يُقسَم سطرٌ فيه أكثرُ من فاصل — البنيةُ لم تعد قاطعة. */
  if (INLINE_DELIM.test(right)) return null;

  if (classifyScript(left) !== SCRIPT.CYRILLIC) return null;
  if (classifyScript(right) !== SCRIPT.ARABIC) return null;

  return { ru: left, ar: right };
}

/* ================================================================== */
/* ٤) حالاتُ القران (بند ٩)                                            */
/* ================================================================== */

/**
 * حالةُ الزوج — **حالاتٌ مسمّاةٌ لا نسبةٌ مخترَعة** (بند ٩).
 *
 * ⚠️ **ولا «٨٧٪ ثقة».** الرقمُ يوحي بمعايرةٍ لا وجودَ لها؛ وهذه
 *    الحالاتُ تصف **الدليلَ البنيويَّ** الذي وُجد فعلًا، فيستطيع
 *    القارئُ أن يحكم عليها.
 */
export const PAIR_STATUS = Object.freeze({
  /** سطرٌ روسيٌّ يليه سطرٌ عربيٌّ مباشرةً في كتلته — أقوى دليلٍ بنيويّ. */
  PAIRED_STRONG: 'paired_strong',
  /** فقرتان متساويتا العدد، قُرنتا بالترتيب. */
  PAIRED_STRUCTURAL: 'paired_structural',
  /** روسيٌّ بلا ترجمة — يبقى كما هو (بند ١٣). */
  UNPAIRED_RUSSIAN: 'unpaired_russian',
  /** عربيٌّ بلا شريكٍ واضح — لا يصير مقطعَ تدريب (بند ١٤). */
  UNPAIRED_ARABIC: 'unpaired_arabic',
  /** البنيةُ ملتبسة — القرارُ لك (بند ٨). */
  NEEDS_REVIEW: 'needs_review',
});

/** وصفٌ عربيٌّ قصير لكلّ حالة — تعرضه المراجعة. */
export const STATUS_LABEL = Object.freeze({
  [PAIR_STATUS.PAIRED_STRONG]: 'مقترنة',
  [PAIR_STATUS.PAIRED_STRUCTURAL]: 'مقترنة بالترتيب',
  [PAIR_STATUS.UNPAIRED_RUSSIAN]: 'روسي بلا ترجمة',
  [PAIR_STATUS.UNPAIRED_ARABIC]: 'عربي بلا أصل',
  [PAIR_STATUS.NEEDS_REVIEW]: 'محتاجة مراجعة',
});

/* ================================================================== */
/* ٥) المحلّل                                                          */
/* ================================================================== */

/** يقسّم النصَّ إلى كتلٍ يفصلها سطرٌ فارغ — حدودُ البنية. */
function toBlocks(text) {
  return String(text || '')
    .split(/\n\s*\n+/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length);
}

/** يصف سطرًا: نصُّه وكتابتُه ودورُه. */
function describe(line, { alone }) {
  const script = classifyScript(line);
  let role = ROLE.SENTENCE;

  if (script === SCRIPT.NEUTRAL) role = ROLE.NOISE;
  else if (NOTE_PREFIX.test(line) || NOTE_PREFIX_RU.test(line)) role = ROLE.NOTE;
  else if (looksHeading(line, { alone })) role = ROLE.HEADING;

  return { text: line, script, role };
}

/** وحدةُ مخرَجٍ واحدة. */
const unit = (ru, ar, status, extra = {}) => ({
  ru: ru || '',
  ar: ar || '',
  status,
  ...extra,
});

/**
 * هل يصلح هذا السطرُ أن يكون **ترجمةً**؟
 *
 * ⚠️ عربيٌّ، وجملةٌ لا ملاحظةٌ ولا عنوان (بنود ٢٩ و٣٠ و٣٩).
 */
const canTranslate = (row) => row && row.script === SCRIPT.ARABIC && row.role === ROLE.SENTENCE;

/** هل هذا سطرُ مصدرٍ روسيّ صالح؟ */
const canSource = (row) => row && row.script === SCRIPT.CYRILLIC && row.role === ROLE.SENTENCE;

/**
 * يقرأ كتلةً واحدةً بالتناوب: روسيٌّ ثم عربيٌّ ثم روسيٌّ… (بندا ٥ و٦).
 *
 * ⚠️ **ويعمل سطرًا سطرًا لا دفعةً واحدة** — فالكتلةُ التي فيها ستّةُ
 *    أسطرٍ متناوبةٍ تعطي ثلاثةَ أزواج، لا مقطعًا عملاقًا واحدًا.
 *
 * @returns {object[]|null} الوحداتُ، أو `null` إن لم تكن الكتلةُ متناوبة
 */
function readAlternating(rows) {
  const out = [];
  let i = 0;
  let pairs = 0;

  while (i < rows.length) {
    const here = rows[i];
    const next = rows[i + 1];

    if (canSource(here) && canTranslate(next)) {
      /*
       * ⚠️ **وسطرٌ عربيٌّ ثالثٌ لا يُضَمّ إلى الترجمة** (بند ٣٣):
       *    الأقوى بنيويًّا هو التالي مباشرةً، وما بعده ملاحظةٌ أو
       *    شرحٌ يبقى مستقلًّا للمراجعة — لا يُلصَق صامتًا.
       */
      out.push(unit(here.text, next.text, PAIR_STATUS.PAIRED_STRONG));
      pairs += 1;
      i += 2;
      continue;
    }

    if (canSource(here)) {
      out.push(unit(here.text, '', PAIR_STATUS.UNPAIRED_RUSSIAN));
      i += 1;
      continue;
    }

    if (here.script === SCRIPT.ARABIC) {
      out.push(unit('', here.text, PAIR_STATUS.UNPAIRED_ARABIC, { role: here.role }));
      i += 1;
      continue;
    }

    /* مختلطٌ أو ضوضاء — يُعرَض ولا يُقرَن. */
    out.push(unit(
      here.script === SCRIPT.CYRILLIC ? here.text : '',
      here.script === SCRIPT.ARABIC ? here.text : '',
      PAIR_STATUS.NEEDS_REVIEW,
      { raw: here.text, role: here.role },
    ));
    i += 1;
  }

  return { units: out, pairs };
}

/**
 * يحاول قرانَ فقرتين متجاورتين متساويتَي عدد الجمل (بند ٧).
 *
 * ⚠️ **والتساوي شرطٌ لا ترجيح.** ثلاثُ جملٍ روسيّةٍ مقابل جملتين
 *    عربيّتين لا تُقرَن بالترتيب ولا بالطول ولا بأيّ حيلة — تلك
 *    محاذاةٌ دلاليّةٌ يمنعها البند ٨. الحالةُ `NEEDS_REVIEW`.
 *
 * @returns {object[]|null}
 */
function readParagraphPair(ruLines, arLines) {
  const ruSentences = ruLines.flatMap((row) =>
    splitSentences(row.text, { requireCyrillic: false, minLength: 1 }));
  const arSentences = arLines.flatMap((row) =>
    splitSentences(row.text, { requireCyrillic: false, minLength: 1 }));

  if (!ruSentences.length || ruSentences.length !== arSentences.length) return null;

  return ruSentences.map((ru, i) =>
    unit(ru, arSentences[i], PAIR_STATUS.PAIRED_STRUCTURAL));
}

/** هل كلُّ أسطر الكتلة روسيّةٌ صالحة؟ */
const allSource = (rows) => rows.length > 0 && rows.every(canSource);
/** هل كلُّها عربيّةٌ صالحةٌ للترجمة؟ */
const allTranslation = (rows) => rows.length > 0 && rows.every(canTranslate);

/**
 * يقرأ نصًّا ثنائيًّا ويعيد وحداتٍ مرتَّبةً كترتيب المصدر (بند ٣٢).
 *
 * ⚠️ **ولا يُعاد ترتيبُ شيء.** ترتيبُ المستند معنًى، وإعادةُ ترتيبه
 *    لتسهيل القران تُفسد ما جاء المستندُ ليقوله.
 *
 * ⚠️ **والخطّيّةُ مقصودة** (بند ٥١): مرورٌ واحدٌ على الأسطر، ومقارنةُ
 *    كتلةٍ بجارتها فقط. لا مقارنةَ كلِّ جملةٍ روسيّةٍ بكلِّ جملةٍ
 *    عربيّة — تلك تربيعيّةٌ وتخمينيّةٌ معًا.
 *
 * @param {string} text
 * @returns {{raw: string, units: object[], stats: object}}
 */
export function parseBilingual(text) {
  const raw = String(text || '');
  const blocks = toBlocks(raw);
  const units = [];

  /* أوّلًا: وصفُ كلّ كتلةٍ بأسطرها — والوصفُ يعرف «هل السطر وحدَه». */
  const described = blocks.map((lines) =>
    lines.map((line) => describe(line, { alone: lines.length === 1 })));

  for (let b = 0; b < described.length; b += 1) {
    const rows = described[b];
    const next = described[b + 1];

    /*
     * ١ · الزوجُ داخل سطرٍ واحد — يُفحَص قبل كلّ شيء لأنه يغيّر عدد
     *     الأسطر الفعليّ في الكتلة.
     */
    const inlineAll = rows.map((row) => inlinePair(row.text));
    if (rows.length === 1 && inlineAll[0]) {
      units.push(unit(inlineAll[0].ru, inlineAll[0].ar, PAIR_STATUS.PAIRED_STRONG, { inline: true }));
      continue;
    }

    /*
     * ٢ · فقرةٌ روسيّةٌ تليها فقرةٌ عربيّة (بند ٧) — تُجرَّب قبل
     *     التناوب لأن الكتلتين منفصلتان بفراغ.
     */
    if (allSource(rows) && next && allTranslation(next)) {
      const paired = readParagraphPair(rows, next);
      if (paired) {
        units.push(...paired);
        b += 1; /* الكتلةُ العربيّةُ استُهلكت */
        continue;
      }
      /*
       * ⚠️ **العددُ لا يتطابق: مراجعةٌ للطرفين معًا** (بند ٣٧).
       *    ولا يُقرَن أوّلُ اثنين ويُترَك الثالث — ذلك تخمينٌ بنصف
       *    دليل، وهو أخطرُ من الامتناع لأنه يبدو صحيحًا.
       */
      for (const row of rows) units.push(unit(row.text, '', PAIR_STATUS.NEEDS_REVIEW));
      for (const row of next) units.push(unit('', row.text, PAIR_STATUS.NEEDS_REVIEW));
      b += 1;
      continue;
    }

    /* ٣ · التناوب داخل الكتلة — الحالةُ الشائعة. */
    const read = readAlternating(rows);
    units.push(...read.units);
  }

  return { raw, units, stats: summarize(units) };
}

/** إحصاءٌ يُعرَض في رأس المراجعة — أرقامٌ محسوبةٌ لا مُدَّعاة. */
export function summarize(units) {
  const by = {};
  for (const one of units) by[one.status] = (by[one.status] || 0) + 1;
  return {
    total: units.length,
    paired: (by[PAIR_STATUS.PAIRED_STRONG] || 0) + (by[PAIR_STATUS.PAIRED_STRUCTURAL] || 0),
    russianOnly: by[PAIR_STATUS.UNPAIRED_RUSSIAN] || 0,
    arabicOnly: by[PAIR_STATUS.UNPAIRED_ARABIC] || 0,
    review: by[PAIR_STATUS.NEEDS_REVIEW] || 0,
    by,
  };
}

/* ================================================================== */
/* ٦) التعديلُ اليدويّ (بنود ١٩ و٢٠ و٤٣)                                */
/* ================================================================== */

/**
 * يُعيد حسابَ حالةِ وحدةٍ بعد تعديلٍ يدويّ.
 *
 * ⚠️ **وتعديلُ النصّ لا يفكّ القران** (بند ١٩): تصحيحُ حرفٍ في الروسيّ
 *    أو في العربيّ يبقيهما زوجًا. الذي يفكُّه فعلٌ صريحٌ وحدَه.
 */
export function restatus(one) {
  const ru = (one.ru || '').trim();
  const ar = (one.ar || '').trim();

  if (ru && ar) {
    /* قرانٌ أكّده الإنسان أقوى من أيّ بنية. */
    return { ...one, ru, ar, status: one.manual ? PAIR_STATUS.PAIRED_STRONG : one.status };
  }
  if (ru) return { ...one, ru, ar: '', status: PAIR_STATUS.UNPAIRED_RUSSIAN };
  if (ar) return { ...one, ru: '', ar, status: PAIR_STATUS.UNPAIRED_ARABIC };
  return { ...one, ru: '', ar: '', status: PAIR_STATUS.NEEDS_REVIEW };
}

/**
 * يربط ترجمةً بوحدةٍ ويزيلها من مصدرها القديم (بند ٤٣).
 *
 * ⚠️ **ولا يتكرّر النصُّ العربيّ**: الوحدةُ المانحةُ تفقد عربيَّها،
 *    فلا يبقى السطرُ نفسُه في مكانين. وهذا ما يمنع «ترجمةً مكرّرة»
 *    بعد الإصلاح اليدويّ.
 *
 * @param {object[]} units
 * @param {number} toIndex الوحدةُ التي تستقبل الترجمة
 * @param {number} fromIndex الوحدةُ التي تُؤخَذ منها (أو -1 لنصٍّ حرّ)
 * @param {string} [text] نصٌّ عربيٌّ صريح حين لا مصدرَ له
 */
export function attachTranslation(units, toIndex, fromIndex, text = '') {
  const next = units.map((one) => ({ ...one }));
  const target = next[toIndex];
  if (!target) return units;

  const arabic = fromIndex >= 0 ? (next[fromIndex]?.ar || '') : String(text || '').trim();
  if (!arabic) return units;

  target.ar = arabic;
  target.manual = true;

  if (fromIndex >= 0 && next[fromIndex]) {
    next[fromIndex].ar = '';
    next[fromIndex].manual = true;
  }

  return next
    .map(restatus)
    /* وحدةٌ فرغت تمامًا بعد النقل تختفي — لا صفوفَ خاوية. */
    .filter((one) => one.ru || one.ar);
}

/** يفكّ الترجمةَ عن وحدةٍ — الروسيُّ يبقى بلا ترجمة (بند ٢٠). */
export function detachTranslation(units, at) {
  const next = units.map((one, i) =>
    (i === at ? { ...one, ar: '', manual: true } : { ...one }));
  return next.map(restatus).filter((one) => one.ru || one.ar);
}

/**
 * الوحداتُ الصالحةُ لتصير مقاطعَ تدريب — **الروسيُّ وحدَه** (بند ١٢).
 *
 * ⚠️ **والعربيُّ لا يصير مقطعًا أبدًا.** هذا هو الغرضُ الأوّل من
 *    الورك-ستريم: سطرُ الترجمة كان يدخل الظلَّ «جملةً تُنطَق»، فيُقرأ
 *    بصوتٍ روسيٍّ نصًّا عربيًّا.
 */
export function practiceUnits(units) {
  return units.filter((one) => one.ru && classifyScript(one.ru) === SCRIPT.CYRILLIC);
}

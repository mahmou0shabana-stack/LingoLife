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
import {
  SECTION, matchSection, isSeparator, looksDraft, ruleOf, splitAlternatives, looksDocTitle,
} from './draft-structure.js';

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

  /* ══════════════════════════════════════════════════════════════
   * ⚠️ **حالاتُ البنية (WS-DR) — وليست «أزواجًا ناقصة»**
   * ══════════════════════════════════════════════════════════════
   *
   * بلاغُك: «الشرحُ ليس ترجمةً مفقودة». وكانت الشاشةُ تقول عن
   * «ليس معرفة شيء جديد، بل إزالة عدم الوضوح» إنّها **«عربي بلا
   * أصل»** — أي تتّهم سطرًا سليمًا بالنقص، وتطلب منك إصلاحًا لا
   * محلَّ له. سبعةَ عشرَ صفًّا كهذه في مسودّةٍ واحدة.
   *
   * فهذه أدوارٌ **مفهومةٌ تمامًا**: تُعرَض، وتُحفَظ، ولا تُنذِر.
   */

  /** عنوانُ قسمٍ معروف: «الإحساس:» — بنيةٌ لا محتوى. */
  SECTION_HEAD: 'section_head',
  /** شرحٌ عربيٌّ تحت قسمٍ نثريّ — لا أصلَ روسيًّا له ولا يُنتظَر. */
  NOTE: 'note',
  /** قالبٌ نحويّ: «должен / должны́ + быть + اسم مفعول» — لا يُنطَق. */
  TEMPLATE: 'template',
  /** سؤالُ استرجاعٍ عربيٌّ يليه جوابُه الروسيّ (بند ٣٤). */
  RECALL: 'recall',
  /** فاصلٌ زخرفيّ — يُبتلَع ولا يصير صفًّا. */
  DIVIDER: 'divider',
});

/** وصفٌ عربيٌّ قصير لكلّ حالة — تعرضه المراجعة. */
export const STATUS_LABEL = Object.freeze({
  [PAIR_STATUS.PAIRED_STRONG]: 'مقترنة',
  [PAIR_STATUS.PAIRED_STRUCTURAL]: 'مقترنة بالترتيب',
  [PAIR_STATUS.UNPAIRED_RUSSIAN]: 'روسي بلا ترجمة',
  [PAIR_STATUS.UNPAIRED_ARABIC]: 'عربي بلا أصل',
  [PAIR_STATUS.NEEDS_REVIEW]: 'محتاجة مراجعة',
  [PAIR_STATUS.SECTION_HEAD]: 'عنوان قسم',
  [PAIR_STATUS.NOTE]: 'شرح — مالوش أصل روسي',
  [PAIR_STATUS.TEMPLATE]: 'قالب نحوي',
  [PAIR_STATUS.RECALL]: 'سؤال استرجاع',
  [PAIR_STATUS.DIVIDER]: 'فاصل',
});

/**
 * الحالاتُ التي **فُهمت** ولا تطلب منك شيئًا.
 *
 * ⚠️ ويُقاس عليها رأسُ المراجعة (بند ١٢): «٤٧ اتعرفت · ٣ محتاجة
 *    مراجعتك». والفرقُ بين هذه القائمة وبين `NEEDS_REVIEW` هو الفرقُ
 *    بين شاشةٍ تحترم وقتَك وشاشةٍ تُغرقك.
 */
export const SETTLED = Object.freeze(new Set([
  PAIR_STATUS.PAIRED_STRONG,
  PAIR_STATUS.PAIRED_STRUCTURAL,
  PAIR_STATUS.SECTION_HEAD,
  PAIR_STATUS.NOTE,
  PAIR_STATUS.TEMPLATE,
  PAIR_STATUS.RECALL,
  PAIR_STATUS.DIVIDER,
]));

/** حالاتٌ بنيويّةٌ لا تُعرَض مقاطعَ تدريبٍ ولا تُنذِر. */
export const STRUCTURAL = Object.freeze(new Set([
  PAIR_STATUS.SECTION_HEAD,
  PAIR_STATUS.NOTE,
  PAIR_STATUS.TEMPLATE,
  PAIR_STATUS.DIVIDER,
]));

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

/* ================================================================== */
/* ٥-ب) قراءةُ المسودّة المُهيكَلة (WS-DR · بنود ٤ و٥ و١١ و٣٠…٣٤)       */
/* ================================================================== */

/**
 * يقرأ مسودّةَ ChatGPT بقالبها — **بالدور لا بالتناوب**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي كان مكسورًا بالضبط — بالقياس لا بالانطباع
 * ═══════════════════════════════════════════════════════════════
 *
 * على مسودّةٍ حقيقيّةٍ من مسودّاتك، أعطى المحلّلُ القديم:
 *
 *     ٣٠ وحدة · ٤ مقترنة · ١٧ «عربي بلا أصل» · ٨ «محتاجة مراجعة»
 *
 * أي **٢٥ إنذارًا كاذبًا من ٣٠**. وأسبابُها أربعة:
 *
 *  ١ · **عناوينُ الأقسام تُقرأ محتوًى**: «الإحساس:» و«أمثلة:» و
 *      «القالب:» ثمانيةُ عناوينَ صارت كلُّها «عربيًّا بلا أصل».
 *
 *  ٢ · **الشرحُ يُتَّهم بالنقص**: «ليس معرفة شيء جديد…» شرحٌ تحت
 *      «الإحساس»، فقيل عنه إنّه ترجمةٌ ضاع أصلُها.
 *
 *  ٣ · **المقطعُ الروسيُّ القصيرُ يُقرأ عنوانًا**: `содержа́ть` سطرٌ
 *      وحدَه، قصيرٌ، بلا نقطةِ نهاية — فتطابق `looksHeading` تمامًا.
 *      ودورُه `HEADING` يمنع `canSource`، فلا يُقرَن بترجمته التي
 *      تحته. وهذا سببُ ضياعِ **كلّ** Core Chunks — وهي جوهرُ المسودّة.
 *
 *  ٤ · **الفاصلُ الزخرفيُّ يصير صفًّا فارغًا** (`ru:'' ar:''`) في
 *      المراجعة.
 *
 * فهذه الدالّةُ تقرأ بالقسم: تعرف أين هي، فتعرف ما دورُ ما تقرأ.
 *
 * ⚠️ **ولا تخمّن حين ينقص الدليل** (بند ١٣): ما لا يطابق قاعدةَ قسمه
 *    يذهب إلى `NEEDS_REVIEW` كما كان — الذكاءُ في فهم المعروف، لا في
 *    الجرأة على المجهول.
 *
 * @param {string} raw
 * @returns {{raw: string, units: object[], stats: object, draft: true}}
 */
function parseDraft(raw) {
  const blocks = toBlocks(raw);
  const units = [];
  let section = SECTION.NONE;

  /** يصف أسطرَ كتلةٍ بلا حكمِ «عنوان» — العناوينُ هنا معروفةٌ بالاسم. */
  const rowsOf = (lines) => lines.map((line) => ({
    text: line,
    script: classifyScript(line),
  }));

  /* ⚠️ داخلَ المسودّة لا يوجد «عنوانٌ مستنتَجٌ من الشكل» — راجع السبب ٣. */
  const src = (row) => row && row.script === SCRIPT.CYRILLIC;
  const tr = (row) => row && row.script === SCRIPT.ARABIC;

  /** يبتلع الفواصلَ والعناوينَ في مقدّمة الكتلة، ويعيد الباقي. */
  const openBlock = (lines) => {
    const rest = [];
    for (const line of lines) {
      if (isSeparator(line)) {
        units.push(unit('', '', PAIR_STATUS.DIVIDER, { section }));
        /*
         * ⚠️ **والفاصلُ يُنهي القسمَ لا يزيّن وحسب** — كشفه اختبارُ ٢٤.
         *
         *    في قالبك يفصل «━━━» بين مقطعٍ ومقطع. وكنتُ أتركُ القسمَ
         *    السابقَ ساريًا بعده، فإذا جاء بعد «الإحساس:» مقطعٌ جديدٌ
         *    قُرئ بقاعدةِ النثر: الروسيُّ «بلا ترجمة» والعربيُّ «شرح».
         *
         *    ونجا هذا في المسودّة المرجعيّة **بالمصادفة** وحدَها: كان
         *    القسمُ السائدُ قبل كلّ فاصلٍ فيها قسمَ أزواج. ولو رتّبتَ
         *    مسودّتَك غدًا بترتيبٍ آخر لانكسر — وهو ما لا يكشفه إلّا
         *    اختبارٌ يقصد الحالة.
         */
        section = SECTION.NONE;
        continue;
      }
      const found = matchSection(line);
      if (found) {
        section = found;
        units.push(unit('', line.trim(), PAIR_STATUS.SECTION_HEAD, { section }));
        continue;
      }
      /* عنوانُ الوثيقة — في المقدّمة وحدها (راجع `looksDocTitle`). */
      if (section === SECTION.NONE && !units.length && looksDocTitle(line)) {
        units.push(unit('', line.trim(), PAIR_STATUS.SECTION_HEAD, { section, title: true }));
        continue;
      }
      rest.push(line);
    }
    return rest;
  };

  for (let b = 0; b < blocks.length; b += 1) {
    const lines = openBlock(blocks[b]);
    if (!lines.length) continue;

    const rule = ruleOf(section);
    const rows = rowsOf(lines);

    /*
     * ١ · قسمٌ نثريّ («الإحساس» · «السؤال») — العربيُّ فيه **شرح**.
     *
     * ⚠️ وهذا هو بندُ ٥ و٣٢ بعينه: لا يُوسَم «عربي بلا أصل»، لأنّ
     *    النظامَ **لم يكن ينتظر له أصلًا** أصلًا.
     */
    if (rule.prose) {
      for (const row of rows) {
        if (tr(row)) units.push(unit('', row.text, PAIR_STATUS.NOTE, { section }));
        else if (src(row)) units.push(unit(row.text, '', PAIR_STATUS.UNPAIRED_RUSSIAN, { section }));
        else units.push(unit('', row.text, PAIR_STATUS.NOTE, { section }));
      }
      continue;
    }

    /*
     * ٢ · قسمُ القالب — رمزٌ نحويٌّ مختلطُ اللغة، لا جملةٌ تُنطَق
     *     ولا ترجمةٌ تُنتظَر (بند ٣٠-F).
     */
    if (rule.symbol) {
      for (const row of rows) {
        units.push(unit('', '', PAIR_STATUS.TEMPLATE, { section, raw: row.text }));
      }
      continue;
    }

    /*
     * ٣ · أسئلةُ الاسترجاع — **الاتّجاهُ معكوس** (بند ٣٤): العربيُّ
     *     يسأل والروسيُّ يجيب. وقراءتُها «روسيٌّ وترجمتُه» تقلب
     *     الدرسَ رأسًا على عقب.
     */
    if (rule.reverse) {
      let i = 0;
      while (i < rows.length) {
        const here = rows[i];
        const next = rows[i + 1];
        if (tr(here) && src(next)) {
          units.push(unit(next.text, here.text, PAIR_STATUS.RECALL, { section, prompt: true }));
          i += 2;
          continue;
        }
        /* سؤالٌ بلا جوابٍ في كتلته — قد يكون جوابُه في الكتلة التالية. */
        if (tr(here) && !next) {
          const after = blocks[b + 1] ? rowsOf(openBlock(blocks[b + 1])) : [];
          if (after.length === 1 && src(after[0])) {
            units.push(unit(after[0].text, here.text, PAIR_STATUS.RECALL, { section, prompt: true }));
            b += 1;
            i += 1;
            continue;
          }
        }
        if (src(here)) units.push(unit(here.text, '', PAIR_STATUS.UNPAIRED_RUSSIAN, { section }));
        else units.push(unit('', here.text, PAIR_STATUS.NOTE, { section }));
        i += 1;
      }
      continue;
    }

    /*
     * ٤ · قسمُ أزواج — والحالةُ الغالبةُ في Core Chunks:
     *     كتلةٌ فيها سطرٌ روسيٌّ واحد، وكتلةٌ بعدها فيها ترجمتُه.
     *
     * ⚠️ **وهذا ما كان مكسورًا في كلّ مقطع** (السبب ٣): الفراغُ بين
     *    المقطع وترجمته يجعلهما كتلتين، والمقطعُ القصيرُ كان يُقرأ
     *    عنوانًا فلا يُقرَن. وداخلَ المسودّة لا يوجد عنوانٌ مستنتَج.
     */
    if (rows.length === 1 && src(rows[0])) {
      const after = blocks[b + 1] ? rowsOf(openBlock(blocks[b + 1])) : [];
      if (after.length === 1 && tr(after[0])) {
        units.push(unit(rows[0].text, after[0].text, PAIR_STATUS.PAIRED_STRONG, {
          section,
          ...(splitAlternatives(after[0].text).length > 1 ? { alts: true } : {}),
        }));
        b += 1;
        continue;
      }
    }

    /* ٥ · التناوبُ داخل الكتلة — أمثلةٌ ومقارناتٌ وإعادةُ بناء. */
    let i = 0;
    while (i < rows.length) {
      const here = rows[i];
      const next = rows[i + 1];
      if (src(here) && tr(next)) {
        units.push(unit(here.text, next.text, PAIR_STATUS.PAIRED_STRONG, {
          section,
          ...(splitAlternatives(next.text).length > 1 ? { alts: true } : {}),
        }));
        i += 2;
        continue;
      }
      if (src(here)) {
        units.push(unit(here.text, '', PAIR_STATUS.UNPAIRED_RUSSIAN, { section }));
        i += 1;
        continue;
      }
      if (tr(here)) {
        units.push(unit('', here.text, PAIR_STATUS.UNPAIRED_ARABIC, { section }));
        i += 1;
        continue;
      }
      units.push(unit('', '', PAIR_STATUS.NEEDS_REVIEW, { section, raw: here.text }));
      i += 1;
    }
  }

  return { raw, units, stats: summarize(units), draft: true };
}

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
export function parseBilingual(text, { draft } = {}) {
  const raw = String(text || '');
  /*
   * ⚠️ **القراءةُ الواعيةُ بالقالب تسبق العامّة** (WS-DR · بندا ٢ و٣).
   *    راجع `looksDraft` في `draft-structure.js` — هناك شرحُ التعارضِ
   *    الذي يحلّه هذا السطر، ولمَ لا يكفي الشكلُ وحدَه للتمييز.
   */
  if (draft ?? looksDraft(raw)) return parseDraft(raw);

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
  const at = (key) => by[key] || 0;

  /*
   * ⚠️ **`settled` هو الرقمُ الذي يستحقّ أن يُقال أوّلًا** (بند ١٢):
   *    «٤٧ اتعرفت · ٣ محتاجة مراجعتك». وقبله كان الرأسُ يقول
   *    «٤ مقترنة» من ٣٠ — رقمٌ صادقٌ حسابيًّا يوحي بأن الاستيرادَ
   *    فشل، بينما ٢٥ من الباقي كانت مفهومةً تمامًا ولم يكن لها اسم.
   */
  const needs = at(PAIR_STATUS.NEEDS_REVIEW)
    + at(PAIR_STATUS.UNPAIRED_ARABIC)
    + at(PAIR_STATUS.UNPAIRED_RUSSIAN);

  return {
    total: units.length,
    paired: at(PAIR_STATUS.PAIRED_STRONG) + at(PAIR_STATUS.PAIRED_STRUCTURAL)
      + at(PAIR_STATUS.RECALL),
    russianOnly: at(PAIR_STATUS.UNPAIRED_RUSSIAN),
    arabicOnly: at(PAIR_STATUS.UNPAIRED_ARABIC),
    review: at(PAIR_STATUS.NEEDS_REVIEW),
    /* بنيةٌ مفهومة: عناوينُ وشروحٌ وقوالبُ وفواصل. */
    structural: at(PAIR_STATUS.SECTION_HEAD) + at(PAIR_STATUS.NOTE)
      + at(PAIR_STATUS.TEMPLATE) + at(PAIR_STATUS.DIVIDER),
    settled: units.filter((one) => SETTLED.has(one.status)).length,
    needs,
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

  /*
   * ⚠️ **والبنيةُ لا تُعاد حسابًا** (WS-DR): عنوانُ قسمٍ فيه عربيٌّ بلا
   *    روسيّ، وشرحٌ كذلك، وقالبٌ فارغُ الطرفين. ولو مرّت هذه على
   *    الحساب العامّ لعادت كلُّها «عربيًّا بلا أصل» أو «محتاجة مراجعة»
   *    عند أوّل تعديلٍ يدويٍّ في **وحدةٍ أخرى** — فيرجع الإنذارُ الكاذبُ
   *    من بابٍ خلفيّ. وهي أدوارٌ يقرّرها القسمُ لا شكلُ الطرفين.
   */
  if (STRUCTURAL.has(one.status) || one.status === PAIR_STATUS.RECALL) {
    return { ...one, ru, ar };
  }

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

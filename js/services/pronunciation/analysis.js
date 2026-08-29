/**
 * LingoLife — طبقتا النطق: منفردةً وداخل الجملة (WS-N)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **العطبُ الذي بُني هذا الملفُّ ليمنعه**
 * ═══════════════════════════════════════════════════════════════
 *
 * فتحتَ `име́ет` من الجملة:
 *   «Я счита́ю, что тако́й докуме́нт име́ет большо́е значе́ние»
 * فقالت لك الصفحة: آخرُها `д`.
 *
 * والمحرّكُ لم يُخطئ في الصوت: `име́ет большо́е` تُنطَق فعلًا بجيمٍ
 * مجهورةٍ في آخر الأولى حين تُوصَلان بلا وقفة. الخطأُ أن ذلك عُرِض
 * بوصفه **نطقَ الكلمة**. فالمتعلّم يحفظ الكلمةَ لا الجملة، ويخرج بها
 * إلى كلّ جملةٍ أخرى — فينطق `име́ет` بـ`д` أبدًا، ويكون التطبيقُ قد
 * علّمه خطأً وهو يظنّ أنه دقيق.
 *
 * والسببُ البنيويّ: **نتيجةٌ واحدةٌ ذاتُ `ipa` واحد**. مرّرتَ الجارَ
 * فتبدّلت، ولا حقلَ يقول «هذا أثرُ الجار». فحلٌّ بإخفاء الأثر يكون
 * كذبًا بالصمت، وحلٌّ بإسقاط الجار يكون فقرًا. والحلُّ الصحيحُ ثالثٌ:
 *
 *      **طبقتان تُحسَبان معًا، وتُعرَضان معًا، ولا تُكتَب إحداهما فوق
 *      الأخرى أبدًا.**
 *
 *   ① `lexical` — الكلمةُ وحدَها. تُحسَب دائمًا **بلا جارٍ صوتيّ**
 *      (`connected: false`)، فمهما كانت الجملةُ حولها لا تتبدّل.
 *   ② `context` — ما **قد** يتغيّر حين تُوصَل بالكلمة التالية. طبقةٌ
 *      **إضافيّة** تُذكَر بجارها وسببها، وتختفي كلَّها إن فُتحت الكلمةُ
 *      وحدَها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا يُسمّى هذا «الصوتُ الحقيقيّ»** (§5)
 * ═══════════════════════════════════════════════════════════════
 *
 * لا ميكروفونَ هنا ولا تحليلَ موجة. الطبقةُ الثانية **تنبّؤٌ** مبنيٌّ
 * على نصٍّ وقواعد: `predicted: true` و`observed: false` حقلان في
 * البيانات لا شعارٌ في الواجهة. ويومَ يُضاف تحليلُ صوتٍ حقيقيّ يأخذ
 * حقولًا خاصّةً به (§38) ولا يسكن هذه.
 */

import {
  analyzeWord, normalizeWord, FLAG, RULESET_VERSION, PRONUNCIATION_ANALYSIS_VERSION,
} from './engine.js';
import {
  ruleById, STATUS_LABEL, CONFIDENCE_LABEL, SCOPE, STATUS,
} from './rule-registry.js';
import { STRESS_STATUS, STRESS_SOURCE } from './stress-resolver.js';
import { phonemeClass, PHONEME_CLASS, PHONEME_CLASS_LABEL, toCyrillic } from './alphabet.js';
import { arabicEar } from './arabic-ear.js';

export { PRONUNCIATION_ANALYSIS_VERSION };

/* ================================================================== *
 * الحدُّ بين كلمتين — **متى يُسمَح للجار أن يؤثّر أصلًا؟** (§9 و§41 و§58)
 * ================================================================== */

/**
 * ⚠️ **والوقفةُ ليست قاعدةً تُطبَّق ثم تُلغى — إنها شرطُ الدخول.**
 *
 * المصدرُ المعياريُّ يشترط للمماثلة عبر الحدّ: «слов, произносимых без
 * паузы». فحين تقول الجملةُ نفسُها إن هناك وقفةً — بفاصلةٍ أو نقطةٍ أو
 * شرطة — فالشرطُ **غيرُ متحقّق**، ولا معنى لتشغيل القاعدة ثم منعِها
 * بقاعدةٍ ثانية. فنُسقِط الجارَ من الحساب أصلًا، ونقول للمتعلّم لماذا.
 *
 * وهذا هو الفرقُ بين «докуме́нт име́ет» (ملتصقتان) و«докуме́нт, име́ет»
 * (بينهما فاصلة): الأولى فيها مماثلةٌ متوقَّعة، والثانية لا.
 */
export const BOUNDARY = Object.freeze({
  /** كلمتان ملتصقتان — الجارُ يؤثّر. */
  NONE: 'NONE',
  /** فاصلةٌ أو شرطةٌ أو نقطتان — وقفةٌ محتملةٌ تمنع المماثلة. */
  CLAUSE: 'CLAUSE',
  /** نهايةُ جملة — وقفةٌ مؤكّدة. */
  SENTENCE: 'SENTENCE',
  /** لا كلمةَ بعدها أصلًا — الكلمةُ منفردة. */
  ABSENT: 'ABSENT',
});

export const BOUNDARY_LABEL = Object.freeze({
  NONE: 'الكلمتين ملزوقين',
  CLAUSE: 'فيه فاصلة/وقفة صغيرة بينهم',
  SENTENCE: 'الجملة بتخلص هنا',
  ABSENT: 'مفيش كلمة بعدها',
});

const SENTENCE_END = /[.!?…]+["»'')\]]*$/;
const CLAUSE_END = /[,;:—–]+["»'')\]]*$/;
/** بدايةٌ باقتباسٍ أو قوسٍ تعني حدًّا مسموعًا وإن خلا ما قبلها من ترقيم. */
const OPENS_BREAK = /^["«''(\[—–]/;

/**
 * يصنّف الحدَّ بين الكلمة وما بعدها — **من الترقيم كما كُتب**.
 *
 * @param {string} token الكلمةُ كما وردت في النصّ (بترقيمها)
 * @param {string|null} nextToken الكلمةُ التالية كما وردت
 */
export function boundaryAfter(token, nextToken) {
  if (!nextToken || !String(nextToken).trim()) return BOUNDARY.ABSENT;
  const text = String(token || '');
  if (SENTENCE_END.test(text)) return BOUNDARY.SENTENCE;
  if (CLAUSE_END.test(text)) return BOUNDARY.CLAUSE;
  if (OPENS_BREAK.test(String(nextToken))) return BOUNDARY.CLAUSE;
  return BOUNDARY.NONE;
}

/** هل يمنع هذا الحدُّ المماثلةَ عبره؟ */
export const boundaryBlocks = (kind) => kind !== BOUNDARY.NONE;

/* ================================================================== *
 * تصفيةُ القواعد المعروضة (§18 و§19)
 * ================================================================== */

/**
 * الشروطُ الأربعةُ التي يفرضها البند ١٨ — **مكتوبةً شرطًا شرطًا**.
 *
 * ⚠️ **ولماذا شرطُ «موجودٌ في النصّ» أصلًا؟**
 *    لأن الشرحَ العامَّ يذكر عائلةً («л م н р й») والكلمةُ فيها فردٌ
 *    واحدٌ منها. فلو اكتفينا بأن القاعدةَ «انطلقت» لعرضنا نصًّا يذكر
 *    `л` في كلمةٍ بلا `л` — وهو ما حدث فعلًا. فالمُطلِقُ يُطلَب باسمه
 *    وموضعه، ويُتحقَّق أنه هناك.
 */
function ruleUsable(step, { letters, nextWordFirst, layer }) {
  /* ① مُطلِقٌ صالح. */
  const trigger = step.trigger;
  if (!trigger || !trigger.grapheme) return false;

  /* ② المُطلِقُ موجودٌ فعلًا حيث يقول. */
  if (trigger.side === 'nextWord') {
    if (!nextWordFirst || trigger.grapheme !== nextWordFirst) return false;
  } else if (Number.isInteger(trigger.at)) {
    const at = letters[trigger.at];
    /* المعجميّةُ تُعيد كتابةَ الكلمة كلِّها، فمداها لا حرفٌ واحد. */
    const spanned = trigger.span
      ? letters.slice(trigger.span[0], trigger.span[1]).join('') === trigger.grapheme
      : at === trigger.grapheme;
    if (!spanned) return false;
  } else if (!letters.includes(trigger.grapheme)) return false;

  /* ③ غيّرت شيئًا، أو منعت تغييرًا كان واقعًا. */
  if (!step.changed && !step.blocked) return false;

  /* ④ النطاقُ يطابق الطبقةَ التي نعرضها فيها. */
  const connected = step.scope === SCOPE.CONNECTED_SPEECH;
  if (layer === 'lexical' && connected) return false;
  if (layer === 'context' && !connected) return false;

  return true;
}

/** ثقةُ القاعدة — من حالتها، بلا رقمٍ مخترَع. */
const ruleConfidence = (status) => CONFIDENCE_LABEL[status] || null;

/**
 * يجمع الأثرَ في «قواعدَ مُطبَّقة» — قاعدةً واحدةً لكلّ معرّف، ومعها
 * مواضعُها.
 *
 * ⚠️ **ولا يُدمَج شرحان مختلفان في سطرٍ واحد.** `RU_PALATALIZATION_BY_VOWEL`
 *    قد تنطلق على ثلاثة سواكن في كلمةٍ واحدة، ولكلٍّ حرفُه وجارُه. فالقاعدةُ
 *    عنوانٌ، والمواضعُ تفصيلٌ تحته — لا سطرٌ عامٌّ يبتلعها.
 */
function buildAppliedRules(trace, options) {
  const kept = trace.filter((step) => ruleUsable(step, options));
  const byRule = new Map();

  for (const step of kept) {
    const rule = ruleById(step.ruleId);
    if (!byRule.has(step.ruleId)) {
      byRule.set(step.ruleId, {
        ruleId: step.ruleId,
        category: step.category,
        scope: step.scope || SCOPE.WORD_INTERNAL,
        summary: rule?.summary || null,
        status: rule?.status || (step.lexical ? STATUS.LEXICAL : null),
        statusLabel: rule ? STATUS_LABEL[rule.status] : null,
        confidence: ruleConfidence(rule?.status || (step.lexical ? STATUS.LEXICAL : null)),
        source: step.source || rule?.source || null,
        instances: [],
      });
    }
    byRule.get(step.ruleId).instances.push({
      at: step.at ?? null,
      from: step.from ?? null,
      to: step.to ?? null,
      why: step.why || '',
      changed: Boolean(step.changed),
      blocked: Boolean(step.blocked),
      trigger: step.trigger,
    });
  }

  return [...byRule.values()];
}

/* ================================================================== *
 * الثقة (§46)
 * ================================================================== */

function stressConfidence(stress, { syllabic = true } = {}) {
  if (!syllabic) return { level: 'none', label: 'الكلمة دي مالهاش حرف علّة، فمفيش نبر' };
  if (stress.status !== STRESS_STATUS.KNOWN) return { level: 'unknown', label: 'مش معروف' };
  if (stress.source === STRESS_SOURCE.USER) return { level: 'high', label: 'إنت أكّدته' };
  if (stress.ambiguous) return { level: 'low', label: 'الكلمة ليها أكتر من نبر' };
  return { level: 'high', label: 'من مصدر موثوق' };
}

function lexicalConfidence(result) {
  if (!result.pronunciation.ipa) return { level: 'partial', label: 'ناقص — فيه أصوات مش مغطّاة' };
  if (result.flags.includes(FLAG.LEXICAL_EXCEPTION)) {
    return { level: 'high', label: 'من المعجم' };
  }
  return { level: 'high', label: 'من قواعد متحقَّق منها' };
}

/** أضعفُ حالةٍ بين قواعد السياق هي حالتُه — لا متوسّطَ ولا نسبة. */
function contextConfidence(rules) {
  if (!rules.length) return { level: 'none', label: 'مفيش تغيير متوقّع' };
  const order = [STATUS.DISPUTED, STATUS.PROVISIONAL, STATUS.LEXICAL, STATUS.VERIFIED];
  let worst = STATUS.VERIFIED;
  for (const rule of rules) {
    if (order.indexOf(rule.status) < order.indexOf(worst)) worst = rule.status;
  }
  return { level: worst, label: CONFIDENCE_LABEL[worst] || null };
}

/* ================================================================== *
 * طبقةُ التحقّق (§47 و§48)
 * ================================================================== */

/**
 * يفحص التماسكَ الداخليَّ **قبل** أن يرى المتعلّمُ شيئًا.
 *
 * ⚠️ **ولماذا فحصٌ وقد صحّحنا القواعد؟**
 *    لأن القواعدَ تتغيّر بعد اليوم، والواجهةُ تتغيّر، والعطبُ القادم
 *    لن يكون هذا العطب. فهذه الطبقةُ لا تعرف `име́ет`: تعرف أن قاعدةً
 *    عابرةً للحدّ **لا يجوز** أن تظهر في الطبقة المعجميّة، وأن مقاطعَ
 *    التقطيع يجب أن تُغطّي الكلمة، وأن الـIPA يجب أن يساوي أصواتَه.
 *    فلو عاد العطبُ من بابٍ آخر، سقط هنا لا على شاشتك.
 */
function validate(bundle) {
  const issues = [];
  const add = (code, detail) => issues.push({ code, detail });
  const { lexical, context, syllables, stress, rewritten } = bundle;

  /* ① و② كلُّ قاعدةٍ معروضةٍ لها مُطلِقٌ موجود — مضمونٌ بالتصفية، ونؤكّده. */
  for (const rule of lexical.appliedRules) {
    for (const one of rule.instances) {
      if (!one.trigger?.grapheme) add('RULE_WITHOUT_TRIGGER', rule.ruleId);
    }
  }

  /*
   * ③ النبرُ متّسقٌ مع التحليل.
   *
   * ⚠️ **وكلمةٌ بلا حرف علّةٍ ليست خطأً** — حروفُ الجرّ `к` و`в` و`с`
   *    كلماتٌ مكتوبةٌ تُنطَق ملتصقةً بما بعدها ولا مقطعَ لها. فالفحصُ
   *    يُطرَح عليها بشرطِ وجود مقاطعَ أصلًا، وإلّا لأبلغ عن «عطبٍ» في
   *    أكثر كلمات الروسيّة شيوعًا.
   */
  if (stress.status === STRESS_STATUS.KNOWN && syllables.length) {
    if (stress.ordinal < 0 || stress.ordinal >= syllables.length) {
      add('STRESS_OUT_OF_RANGE', `${stress.ordinal}/${syllables.length}`);
    }
    const stressedSound = lexical.sounds.filter((s) => s.stressed);
    if (syllables.length && stressedSound.length > 1) {
      add('MULTIPLE_STRESSED_VOWELS', String(stressedSound.length));
    }
  }

  /* ④ و⑤ المقاطعُ تُغطّي الكلمة. */
  if (syllables.length && syllables.join('') !== rewritten) {
    add('SYLLABLES_DO_NOT_COVER_WORD', `${syllables.join('')} ≠ ${rewritten}`);
  }

  /* ⑥ الـIPA يساوي أصواتَه. */
  if (lexical.ipa) {
    const fromSounds = lexical.sounds
      .filter((s) => s.type !== 'silent' && s.ipa)
      .map((s) => s.ipa).join('');
    if (lexical.ipa.split('ˈ').join('').split('ː').join('')
      !== fromSounds.split('ː').join('')) {
      add('IPA_DISAGREES_WITH_SEGMENTS', `${lexical.ipa} ≠ ${fromSounds}`);
    }
  }

  /* ⑦ الطبقةُ المعجميّةُ خاليةٌ من كلّ ما هو عابرٌ للحدّ. */
  for (const rule of lexical.appliedRules) {
    if (rule.scope === SCOPE.CONNECTED_SPEECH) add('CROSS_WORD_RULE_IN_LEXICAL', rule.ruleId);
  }
  if (lexical.sounds.some((s) => s.crossWord)) add('CROSS_WORD_SOUND_IN_LEXICAL', rewritten);

  /* ⑧ و⑨ و⑩ أثرُ السياق لا يظهر إلّا في السياق، وبمُطلِقٍ صالح. */
  if (context) {
    for (const rule of context.appliedRules) {
      if (rule.scope !== SCOPE.CONNECTED_SPEECH) add('NON_CONTEXT_RULE_IN_CONTEXT', rule.ruleId);
      for (const one of rule.instances) {
        if (one.trigger?.side !== 'nextWord') add('CONTEXT_RULE_WITHOUT_NEIGHBOUR', rule.ruleId);
      }
    }
    /* ⑫ التنبّؤُ لا يُسمّى صوتًا مرصودًا. */
    if (context.observed !== false || context.predicted !== true) add('PREDICTED_LABELLED_OBSERVED', '');
    /* ⑭ ما دام لا تغييرَ فلا يجوز أن يختلف الناتج. */
    if (!context.changes.length && context.ipa && context.ipa !== lexical.ipa) {
      add('CONTEXT_DIFFERS_WITHOUT_RULE', `${lexical.ipa} → ${context.ipa}`);
    }
  }

  /* ⑬ هُويّةُ الكلمة واحدةٌ في الطبقتين. */
  if (context && context.normalizedText !== bundle.normalizedOrthography) {
    add('IDENTITY_MISMATCH', `${bundle.normalizedOrthography} ≠ ${context.normalizedText}`);
  }

  return { ok: issues.length === 0, issues };
}

/* ================================================================== *
 * الذاكرتان — منفصلتان بالتصميم (§45)
 * ================================================================== */

const LIMIT = 240;
const lexicalCache = new Map();
const contextCache = new Map();

function remember(cache, key, value) {
  if (cache.size >= LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

/** ⚠️ للاختبارات وللقياس — ولا تُنادى من كودِ إنتاج. */
export function clearAnalysisCache() {
  lexicalCache.clear();
  contextCache.clear();
}

export function analysisCacheSizes() {
  return { lexical: lexicalCache.size, context: contextCache.size };
}

/* ================================================================== *
 * الواجهة
 * ================================================================== */

/** فرقُ الصوت بين الطبقتين — **ما الذي تغيّر بالضبط، وبأيّ قاعدة**. */
function diffSounds(lexSounds, ctxSounds, contextRules) {
  if (lexSounds.length !== ctxSounds.length) return null;   /* غيرُ قابلٍ للمقارنة */
  const changes = [];
  for (let i = 0; i < lexSounds.length; i += 1) {
    const before = lexSounds[i];
    const after = ctxSounds[i];
    if (before.ipa === after.ipa) continue;
    const rule = contextRules.find((r) => r.instances.some((one) => one.at === after.at));
    changes.push({
      index: i,
      at: after.at,
      written: after.written ?? after.letter,
      fromIpa: before.ipa,
      toIpa: after.ipa,
      fromCyrillic: before.ipa ? toCyrillic(before.ipa) : null,
      toCyrillic: after.ipa ? toCyrillic(after.ipa) : null,
      ruleId: rule?.ruleId || null,
      why: rule?.instances.find((one) => one.at === after.at)?.why || '',
      confidence: rule?.confidence || null,
    });
  }
  return changes;
}

/**
 * يحلّل كلمةً في طبقتين.
 *
 * @param {string} raw الكلمةُ كما ظهرت للمستخدم (بترقيمها إن وُجد)
 * @param {{
 *   previousWord?: string|null,
 *   nextWord?: string|null,
 *   boundary?: string|null,
 *   overrideStressOrdinal?: number|null,
 * }} options
 *
 * ⚠️ **و`nextWord` لا يعني «طبّق المماثلة».** يعني «هذه هي الكلمةُ
 *    التالية»؛ وقرارُ التطبيق يعود إلى الحدّ بينهما. فحدٌّ بفاصلةٍ
 *    يُعطي طبقةَ سياقٍ **تقول إنه لا تغيير ولماذا** — وهو خبرٌ يحتاجه
 *    المتعلّم، لا صمت.
 */
export function analyzePronunciation(raw, {
  previousWord = null, nextWord = null, boundary = null, overrideStressOrdinal = null,
} = {}) {
  const kind = boundary || boundaryAfter(raw, nextWord);
  const blocked = boundaryBlocks(kind);
  const stressKey = overrideStressOrdinal === null ? '' : String(overrideStressOrdinal);

  /* ---------- ① الطبقةُ المعجميّة — بلا جارٍ صوتيّ، أبدًا ---------- */
  const lexKey = `${RULESET_VERSION}|${PRONUNCIATION_ANALYSIS_VERSION}|`
    + `${normalizeWord(raw)}|${previousWord || ''}|${nextWord || ''}|${stressKey}`;
  const lexResult = lexicalCache.get(lexKey) || remember(lexicalCache, lexKey, analyzeWord(raw, {
    previousWord, nextWord, overrideStressOrdinal, connected: false,
  }));

  if (!lexResult.supported) {
    return {
      analysisVersion: PRONUNCIATION_ANALYSIS_VERSION,
      rulesetVersion: RULESET_VERSION,
      supported: false,
      orthography: lexResult.originalText,
      normalizedOrthography: lexResult.normalizedText,
      warnings: lexResult.warnings,
      flags: lexResult.flags,
      syllables: [],
      stress: lexResult.stress,
      lexical: null,
      context: null,
      arabicEar: null,
      validation: { ok: true, issues: [] },
      raw: { lexical: lexResult, context: null },
    };
  }

  const letters = [...lexResult.rewrittenText];
  const lexicalRules = buildAppliedRules(lexResult.appliedRules, {
    letters, nextWordFirst: null, layer: 'lexical',
  });

  const lexical = {
    ipa: lexResult.pronunciation.ipa,
    simple: lexResult.pronunciation.simple,
    sounds: lexResult.sounds,
    complete: Boolean(lexResult.pronunciation.ipa),
    appliedRules: lexicalRules,
    confidence: lexicalConfidence(lexResult),
  };

  /* ---------- ② طبقةُ الكلام المتّصل — إضافةٌ لا استبدال ---------- */
  let context = null;
  let ctxResult = null;
  const nextFirst = normalizeWord(nextWord || '').replace(/[^а-яё]/g, '')[0] || '';

  if (nextWord && nextFirst) {
    const nextClass = phonemeClass(nextFirst);
    if (blocked) {
      /*
       * ⚠️ **وطبقةٌ تقول «لا تغيير» ليست طبقةً فارغة.** «докуме́нт, име́ет»
       *    درسٌ كامل: الفاصلةُ منعت ما كان سيقع. وحذفُ الطبقة هنا يجعل
       *    الغيابَ يبدو سهوًا.
       */
      context = {
        predicted: true,
        observed: false,
        applied: false,
        nextWord,
        nextPhoneme: { letter: nextFirst, class: nextClass, label: PHONEME_CLASS_LABEL[nextClass] },
        boundary: { kind, label: BOUNDARY_LABEL[kind], blocks: true },
        normalizedText: lexResult.normalizedText,
        ipa: lexical.ipa,
        simple: lexical.simple,
        sounds: lexResult.sounds,
        appliedRules: [],
        changes: [],
        reason: kind === BOUNDARY.SENTENCE
          ? 'الجملة بتقف هنا، فالكلمة اللي بعدها مش بتلزق بيها — النطق زيّ المنفرد.'
          : 'فيه فاصلة/وقفة صغيرة بعد الكلمة، فمفيش تأثير من اللي بعدها.',
        confidence: { level: 'none', label: 'مفيش تغيير متوقّع' },
      };
    } else {
      const ctxKey = `${lexKey}|>${normalizeWord(nextWord)}|${kind}`;
      ctxResult = contextCache.get(ctxKey)
        || remember(contextCache, ctxKey, analyzeWord(raw, {
          previousWord, nextWord, overrideStressOrdinal, connected: true,
        }));

      const contextRules = buildAppliedRules(ctxResult.appliedRules, {
        letters: [...ctxResult.rewrittenText], nextWordFirst: nextFirst, layer: 'context',
      });
      const changes = diffSounds(lexResult.sounds, ctxResult.sounds, contextRules) || [];

      context = {
        predicted: true,
        observed: false,
        applied: changes.length > 0 || contextRules.length > 0,
        nextWord,
        nextPhoneme: { letter: nextFirst, class: nextClass, label: PHONEME_CLASS_LABEL[nextClass] },
        boundary: { kind, label: BOUNDARY_LABEL[kind], blocks: false },
        normalizedText: ctxResult.normalizedText,
        ipa: ctxResult.pronunciation.ipa,
        simple: ctxResult.pronunciation.simple,
        sounds: ctxResult.sounds,
        appliedRules: contextRules,
        changes,
        reason: changes.length ? null : reasonForNoChange(nextClass),
        confidence: contextConfidence(contextRules),
      };
    }
  }

  const bundle = {
    analysisVersion: PRONUNCIATION_ANALYSIS_VERSION,
    rulesetVersion: RULESET_VERSION,
    supported: true,
    orthography: lexResult.originalText,
    normalizedOrthography: lexResult.normalizedText,
    rewritten: lexResult.rewrittenText,
    lexicalEntry: lexResult.lexical,
    flags: lexResult.flags,
    warnings: lexResult.warnings,
    syllables: lexResult.syllables,
    /** كلمةٌ بلا حرف علّة (`к`, `в`, `с`) — مقطعيّةٌ لا، وخطأٌ لا. */
    syllabic: lexResult.syllables.length > 0,
    stress: {
      ...lexResult.stress,
      confidence: stressConfidence(lexResult.stress, {
        syllabic: lexResult.syllables.length > 0,
      }),
    },
    lexical,
    context,
    arabicEar: arabicEar(lexResult),
    /*
     * ⚠️ **النتيجتان الخامّتان تُمرَّران — ولا تُقرآن للعرض.**
     *    `sound-map.js` يحتاج نتيجةَ محرّكٍ كاملةً ليبني مصطلحاته، وهي
     *    هنا **المعجميّة** لا المتّصلة: فبطاقاتُ الحروف والمصطلحات تصف
     *    الكلمةَ نفسَها. والمتّصلةُ متاحةٌ لمن يريد المقارنة صراحةً.
     */
    raw: { lexical: lexResult, context: ctxResult },
  };

  bundle.validation = validate(bundle);
  return bundle;
}

/**
 * لماذا لم يتغيّر شيءٌ رغم التصاق الكلمتين؟ — **بالفئة الصوتيّة** (§10).
 *
 * ⚠️ **ولا يقال «الحروف مش من النوع اللي بيأثّر» وحدَها.** الجملةُ
 *    صحيحةٌ ولا تُعلِّم: أيُّ نوع؟ ولماذا؟ فنُسمّي الفئةَ ونقول قاعدتَها.
 */
function reasonForNoChange(nextClass) {
  if (nextClass === PHONEME_CLASS.VOWEL) {
    return 'الكلمة اللي بعدها بتبدأ بحرف علّة — والحركات مبتغيّرش جهر اللي قبلها.';
  }
  if (nextClass === PHONEME_CLASS.SONORANT) {
    return 'الكلمة اللي بعدها بتبدأ برنّانة («л م н р й») — والرنّانات مبتجهّرش اللي قبلها.';
  }
  if (nextClass === PHONEME_CLASS.V_SPECIAL) {
    return '«в» غريبة: مجهورة، بس مبتجهّرش اللي قبلها — استثناء منصوص عليه.';
  }
  return 'آخر الكلمة وأوّل اللي بعدها مش بيتقابلوا في تأثير — النطق زيّ المنفرد.';
}

/**
 * يحلّل جملةً كاملة: طبقتان لكلّ كلمة، والحدودُ من الترقيم.
 *
 * ⚠️ **والنصُّ يُقسَم ولا يُعدَّل** (§42). ما يصل إلى المحلّل هو ما
 *    كتبتَه أنت حرفًا حرفًا — الترقيمُ يُقرَأ ليُعرَف الحدُّ، ولا يُحذَف
 *    من مصدرك ولا يُعاد ترتيبُه.
 */
export function analyzeSentencePronunciation(text, { overrides = {} } = {}) {
  const tokens = String(text || '').split(/\s+/).filter(Boolean);
  return tokens.map((token, i) => analyzePronunciation(token, {
    previousWord: tokens[i - 1] || null,
    nextWord: tokens[i + 1] || null,
    boundary: boundaryAfter(token, tokens[i + 1] || null),
    overrideStressOrdinal: Object.hasOwn(overrides, i) ? overrides[i] : null,
  }));
}

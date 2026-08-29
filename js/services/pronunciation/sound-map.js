/**
 * LingoLife — خريطةُ الصوت الحقيقيّ (WS58 · بندا ٤٨ و٤٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الواجهةُ تعرض — ولا تحسب حرفًا واحدًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * أخطرُ ما يحدث لمحرّكٍ صوتيٍّ ناضج أن تنبت له نسخةٌ ثانيةٌ في الواجهة:
 * سطرٌ صغير `if (letter === 'о' && !stressed)` في ملفّ عرضٍ، ثم جدولُ
 * صلابةٍ مكرَّر، ثم — بعد شهر — كلمةٌ يقول عنها التحليلُ شيئًا وتقول
 * عنها البطاقةُ شيئًا آخر، ولا أحدَ يعرف أيُّهما الصحيح.
 *
 * فهذا الملفُّ هو **العقد**: يأخذ نتيجةَ `analyzeWord` ويعيد كلَّ ما
 * تحتاجه الصفحةُ مصوغًا — النصّ العربيّ، والمصطلح، والسبب، وقطعُ
 * التشغيل. ولا يبقى للواجهة إلّا أن تختار العنصرَ وتضعه في مكانه.
 *
 * ولا يستورد مُركِّبَ الكلام ولا يناديه — يصف ما يُنطَق، ولا ينطق.
 * (واختبارٌ يفحص نصَّ هذا الملفّ فيسقط لو تسلّل إليه استدعاءُ نطق.)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا يحسب صوتًا هو أيضًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ قيمةٍ هنا **مقروءةٌ من نتيجة المحرّك**: `soft` و`voiced`
 * و`reduction` و`rules`. الملفُّ يُسمّي ويجمع ويرتّب — ولا يقرّر.
 * فلو تغيّرت قاعدةٌ غدًا تغيّرت هذه الخريطةُ معها بلا سطرٍ يُعدَّل.
 */

import { TERM, teachingRulesForEngineRule } from './curriculum.js';
import { ruleById, STATUS_LABEL } from './rule-registry.js';
import { ALWAYS_HARD, ALWAYS_SOFT } from './alphabet.js';

/* ================================================================== *
 * الوحدةُ الواحدة: مكتوبٌ ← مسموع
 * ================================================================== */

/**
 * أسبابُ التغيّر — **بترتيبِ ما يهمّ المتعلّم لا بترتيب المحرّك**.
 * أوّلُ سببٍ ينطبق هو ما يُعرَض عنوانًا، والباقي تفصيل.
 */
const CHANGE_REASON = Object.freeze([
  { rule: 'RU_FINAL_DEVOICING', label: 'بقى مهموس في آخر الكلمة', term: TERM.VOICELESS },
  { rule: 'RU_CROSS_WORD_DEVOICING', label: 'بقى مهموس — والكلمة اللي بعده مهموسة كمان', term: TERM.VOICELESS },
  { rule: 'RU_REGRESSIVE_DEVOICING', label: 'بقى مهموس بتأثير اللي بعده', term: TERM.VOICELESS },
  { rule: 'RU_CROSS_WORD_VOICING', label: 'بقى مجهور بتأثير أوّل الكلمة اللي بعده', term: TERM.VOICED },
  { rule: 'RU_CROSS_WORD_VOICED_KEPT', label: 'فضل مجهور — الكلمة اللي بعده بتبدأ بصوت مجهور', term: TERM.VOICED },
  { rule: 'RU_REGRESSIVE_VOICING', label: 'بقى مجهور بتأثير اللي بعده', term: TERM.VOICED },
]);

/** درجةُ الاختزال بالعربيّة — والسببُ معها، لا الدرجةُ وحدَها (بند ٣١). */
function reductionLabel(sound, stressOrdinal) {
  const red = sound.reduction;
  if (!red || red.quality !== 'qualitative') return null;
  const first = red.degree === 1;
  /*
   * ⚠️ **والسببُ يُشتقّ من موضعٍ نعرفه لا من نصٍّ عامّ.** «قبل النبر
   *    مباشرةً» جملةٌ صحيحةٌ فقط حين تكون كذلك؛ وأوّلُ الكلمة درجةٌ
   *    أولى أيضًا ولسببٍ آخر. فنقولهما مفترقَين.
   */
  let why;
  if (!first) why = 'بعيد عن النبر';
  else if (Number.isInteger(stressOrdinal) && sound.reductionOrdinal === stressOrdinal - 1) {
    why = 'قبل النبر مباشرةً';
  } else why = 'في أوّل الكلمة';

  return {
    term: TERM.REDUCED,
    degree: red.degree,
    label: first ? 'مختزل — درجة أولى' : 'مختزل — درجة تانية',
    why,
  };
}

/**
 * مصطلحُ التفخيم/الترقيق — **ولمن يستحقّه فقط** (بند ٢٩).
 *
 * ⚠️ **ولا نُعلّم كلَّ ساكنٍ بوصف.** نصفُ سواكن الروسيّة مفخَّمةٌ
 *    بالافتراض، ولو وسمناها كلَّها لصارت الصفحةُ قائمةَ حروفٍ لا
 *    تحليلًا. فيظهر الوسمُ حين يكون **خبرًا**:
 *      · مرقَّقٌ — لأنه تغيّرٌ عن الافتراض.
 *      · مفخَّمٌ/مرقَّقٌ **دائمًا** — لأنها عائلةٌ يجب أن تُعرَف.
 *    وما عدا ذلك: مفخَّمٌ عاديٌّ لا يستحقّ سطرًا.
 */
function hardnessOf(sound) {
  if (sound.type !== 'consonant') return null;
  const always = ALWAYS_HARD.includes(sound.written ?? sound.letter)
    ? { term: TERM.HARD, label: `${TERM.HARD} دائمًا`, always: true }
    : (ALWAYS_SOFT.includes(sound.written ?? sound.letter)
      ? { term: TERM.SOFT, label: `${TERM.SOFT} دائمًا`, always: true }
      : null);
  if (always) return always;
  if (sound.soft) return { term: TERM.SOFT, label: TERM.SOFT, always: false };
  return { term: TERM.HARD, label: TERM.HARD, always: false, ordinary: true };
}

/**
 * حالةُ الجهر — **مقروءةٌ من القواعد التي انطلقت لا من الحرف**.
 *
 * ⚠️ **والفرقُ بين «أصلًا» و«هنا» هو كلُّ الدرس** (بند ٣٠):
 *    «`г` مجهور في الأصل — بقى مهموس هنا لأن اللي بعده مهموس»
 *    تعلّمك شيئًا. أمّا «`г` = [k]» فلا تعلّمك إلّا أن تحفظ.
 */
function voicingOf(sound) {
  if (sound.type !== 'consonant') return null;
  const hit = CHANGE_REASON.find((r) => sound.rules.includes(r.rule));
  if (!hit) return null;
  const kept = hit.rule === 'RU_CROSS_WORD_VOICED_KEPT';
  return {
    was: kept ? TERM.VOICED : (hit.term === TERM.VOICELESS ? TERM.VOICED : TERM.VOICELESS),
    now: hit.term,
    label: hit.label,
    ruleId: hit.rule,
    /* «فضل مجهور» ليس تحوّلًا — والوسمُ يمنع عدَّه تغييرًا في الإحصاء. */
    changed: !kept,
    crossWord: Boolean(sound.crossWord),
  };
}

/** القواعدُ التي مسّت هذا الصوت، ومعها بندُ المنهج الذي تُنفِّذه. */
function rulesOf(sound) {
  return sound.rules.map((id) => {
    const rule = ruleById(id);
    const teaching = teachingRulesForEngineRule(id);
    return {
      ruleId: id,
      why: rule?.explain || '',
      status: rule?.status || null,
      statusLabel: rule ? STATUS_LABEL[rule.status] : null,
      source: rule?.source || null,
      /* بند ٣٤: من أيّ درسٍ من دروسك جاءت هذه — يُفتَّش ولا يُزاحم. */
      teaching: teaching.map((t) => ({
        id: t.id, doc: t.doc, title: t.arabicTitle, sourceStatus: t.sourceStatus,
      })),
    };
  });
}

/* ================================================================== *
 * الخريطة
 * ================================================================== */

/**
 * يحوّل نتيجةَ `analyzeWord` إلى مقروءِ الواجهة.
 *
 * @param {object} analysis نتيجةُ `analyzeWord`
 * @returns {object} خريطةٌ جاهزةٌ للعرض — بلا حسابٍ متبقٍّ
 */
export function soundMap(analysis) {
  if (!analysis?.supported) {
    return {
      supported: false, word: analysis?.originalText || '', units: [], syllables: [],
      changes: [], hardness: [], voicing: [], reductions: [],
      playback: null, limitations: ['مفيش حروف روسية نحلّلها'],
    };
  }

  const stressOrdinal = analysis.stress.ordinal;
  let vowelOrdinal = -1;

  /* ---- الوحدات: كلُّ صوتٍ بمكتوبه ومسموعه ---- */
  const units = analysis.sounds.map((sound, index) => {
    if (sound.type === 'vowel') vowelOrdinal += 1;
    const withOrdinal = { ...sound, reductionOrdinal: sound.type === 'vowel' ? vowelOrdinal : -1 };

    const reduction = reductionLabel(withOrdinal, stressOrdinal);
    const hardness = hardnessOf(sound);
    const voicing = voicingOf(sound);

    /*
     * ⚠️ **و«تغيّر» تعني: المسموعُ غيرُ المكتوب** — لا «انطبقت عليه
     *    قاعدة». الحرفُ المرقَّقُ قبل `е` انطبقت عليه قاعدةٌ ولم يتغيّر
     *    عمّا يتوقّعه القارئ؛ أمّا `о` التي صارت [ə] فتغيّرت فعلًا.
     *    والخلطُ بينهما يجعل «إيه اللي اتغيّر؟» تعرض نصفَ الكلمة.
     */
    const changed = Boolean(reduction) || Boolean(voicing?.changed)
      || (sound.type === 'silent' && sound.letter === 'ь');

    const teachingLabels = [];
    if (sound.type === 'vowel') teachingLabels.push(TERM.VOWEL);
    if (sound.type === 'consonant') teachingLabels.push(TERM.CONSONANT);
    if (hardness && !hardness.ordinary) teachingLabels.push(hardness.label);
    if (voicing) teachingLabels.push(voicing.now);
    if (reduction) teachingLabels.push(reduction.label);
    if (sound.stressed) teachingLabels.push(`عليها ${TERM.STRESS}`);
    if (sound.long) teachingLabels.push('طويل — حرفين صوت واحد');
    if (sound.variant) teachingLabels.push(sound.variant);

    /*
     * ⚠️ **و«خفيّ» ليس «لم يتغيّر»** — والفرقُ يحمي من كذبتين معًا.
     *    `и` غيرُ المنبورة تصير [ɪ]: تغيّرٌ حقيقيٌّ لا يظهر في التقريب
     *    السيريليّ («и» في الحالتين). فلو قلنا «لم يتغيّر» كذبنا على
     *    الأذن، ولو عرضناه «и ← и» كسهمٍ لأربكنا العين. فيُوسَم `subtle`
     *    وتقوله الواجهةُ بلغته: «أقصر وأخفت»، والـIPA يُظهر الفرق.
     */
    const subtle = Boolean(sound.cyrillic) && sound.cyrillic === (sound.written ?? sound.letter);

    return {
      index,
      written: sound.written ?? sound.letter,
      subtle,
      /* المسموعُ للمتعلّم: تقريبٌ سيريليّ — **موسومٌ أنه تقريب** (بند ٢١). */
      realized: sound.cyrillic,
      realizedIpa: sound.ipa,
      type: sound.type,
      syllable: sound.syllable,
      at: sound.at,
      stressed: Boolean(sound.stressed),
      changed,
      hardness,
      voicing,
      reduction,
      crossWord: Boolean(sound.crossWord),
      unresolved: sound.unresolved || null,
      teachingLabels,
      rules: rulesOf(sound),
    };
  });

  /* ---- المقاطع: كيف يُسمَع كلُّ مقطعٍ **في هذه الكلمة** (بند ١٨) ---- */
  const syllables = analysis.syllables.map((text, i) => {
    const own = units.filter((u) => u.syllable === i);
    const realized = own.map((u) => u.realized || '').join('');
    /*
     * ⚠️ **والعلامةُ تُوضَع هنا لا في الواجهة** (بند ٤٩). التقطيعُ يجري
     *    على نصٍّ مجرَّدٍ من النبر (وهو الصواب: القواعدُ لا تريد
     *    العلامة)، فيخرج «сти» بلا شيءٍ يقول إنها المنبورة. ووضعُ
     *    العلامة عملُ مَن يعرف **أيُّ حركةٍ** منبورة — وهو هذا الملفّ،
     *    لا ملفُّ العرض الذي كان سيضطرّ لإعادة عدّ الحركات.
     */
    let marked = text;
    if (i === stressOrdinal) {
      const vowel = own.find((u) => u.type === 'vowel');
      const at = vowel ? text.indexOf(vowel.written) : -1;
      if (at >= 0) marked = `${text.slice(0, at + 1)}́${text.slice(at + 1)}`;
    }
    return {
      index: i,
      written: text,
      /** النصُّ المكتوبُ وعليه علامةُ النبر إن كان هو المقطعَ المنبور. */
      writtenMarked: marked,
      /* ⚠️ فارغٌ لا نصٌّ مبتور: مقطعٌ فيه صوتٌ غيرُ محسوم لا يُعرَض نصفُه. */
      realized: own.some((u) => u.unresolved) ? null : realized,
      stressed: i === stressOrdinal,
      changed: own.some((u) => u.changed),
      units: own.map((u) => u.index),
    };
  });

  /* ---- الأقسامُ الثلاثة: انتقاءٌ محلّيٌّ لا درسٌ كامل (بند ٣٨) ---- */
  const hardness = units.filter((u) => u.hardness && !u.hardness.ordinary);
  const voicing = units.filter((u) => u.voicing);
  const reductions = units.filter((u) => u.reduction);
  const changes = units.filter((u) => u.changed);

  /* ---- الحدودُ المعلَنة (بندا ٣٧ و٤٦) ---- */
  const limitations = [];
  if (!analysis.pronunciation.ipa) {
    limitations.push('التحليل الصوتي التفصيلي غير مكتمل — فيه أصوات لسه مش مغطّاة بقواعد.');
  }
  if (analysis.stress.ambiguous) {
    limitations.push('الكلمة ليها أكتر من نبر صحيح — لازم تختار من السياق.');
  }
  /*
   * ⚠️ **ولا تُقال هذه الجملةُ في الطبقة المعجميّة** (WS-N · §4 و§11).
   *
   * خريطةُ الصوت تصف **الكلمةَ منفردةً** — وتُغذَّى بنتيجةٍ حُسبت
   * `connected: false` عمدًا. فلو قالت «مفيش تأثير بين الكلمة واللي
   * بعدها» لأصدرت حكمًا على السياق من طبقةٍ لا ترى السياق أصلًا،
   * وستقوله **دائمًا** لأن الجارَ مُستبعَدٌ بالتصميم. وخبرُ السياق
   * ملكُ طبقة السياق وحدَها (`analysis.js`).
   */
  if (analysis.context.connected !== false
    && analysis.context.nextWord && !analysis.context.crossWordApplied) {
    limitations.push('مفيش تأثير بين الكلمة دي واللي بعدها — الحروف مش من النوع اللي بيأثّر.');
  }

  return {
    supported: true,
    word: analysis.originalText,
    normalized: analysis.normalizedText,
    rewritten: analysis.rewrittenText,
    units,
    syllables,
    changes,
    hardness,
    voicing,
    reductions,
    stress: analysis.stress,
    pronunciation: analysis.pronunciation,
    complete: Boolean(analysis.pronunciation.ipa),
    playback: playbackPlan(analysis, syllables),
    limitations,
    rulesetVersion: analysis.rulesetVersion,
  };
}

/* ================================================================== *
 * ثلاثةُ مستويات تشغيل (بند ٢٣)
 * ================================================================== */

/**
 * خطّةُ التشغيل — **نصٌّ وسرعةٌ، لا صوت**.
 *
 * ⚠️ **والخطّةُ هنا والتشغيلُ هناك عمدًا.** هذا الملفُّ لا يعرف
 *    مُركِّبَ الكلام ولا يستورده: يقول «انطق هذه القطع بهذه السرعة»،
 *    والواجهةُ تنادي مُشغِّلَ الظلّ القائم. فلا مشغّلَ ثانٍ (بند ٥٢)،
 *    ولا مؤقّتَ يلمس نطقًا جاريًا (بند ٢٥) — القطعُ تُنطَق **بالتتابع
 *    على وعدٍ ينتهي**، لا بمؤقّتٍ يقاطع.
 *
 * ⚠️ **وصدقُ الصوت** (بند ٢٤): المقطعُ المنطوقُ وحدَه **ليس** المقطعَ
 *    كما يُسمَع داخل الكلمة — مُركِّبُ الكلام يعيد تحليله بمعزلٍ عن
 *    جيرانه. ولذلك `pieces.disclaimer` مكتوبٌ هنا لا في الواجهة:
 *    ادّعاءٌ صوتيٌّ يُقال مرّةً في مكانٍ واحد.
 */
function playbackPlan(analysis, syllables) {
  const word = analysis.normalizedText;
  if (!word) return null;

  /* ⚠️ النصُّ المكتوبُ لا المُعاد كتابتُه: المُركِّبُ يقرأ روسيّةً عاديّة. */
  const pieces = syllables.map((s) => s.written).filter(Boolean);

  return {
    /** تفكيك — مقطعًا مقطعًا، ثم الكلمة كاملة. */
    pieces: {
      id: 'pieces',
      label: 'تفكيك',
      hint: 'مقطع مقطع، وبعدين الكلمة كلها',
      steps: pieces.length > 1 ? [...pieces, word] : [word],
      rate: 0.7,
      /* ⚠️ الادّعاءُ الذي **لا** نقوله — مكتوبٌ صراحةً. */
      disclaimer: 'المقطع لوحده بيتنطق شوية مختلف عن جوّه الكلمة — ده تدريب على البناء، مش نطق الكلمة.',
    },
    /** بطيء متّصل — الكلمةُ كاملةٌ بسرعةٍ أقلّ، **بلا فجوات**. */
    slow: {
      id: 'slow',
      label: 'بطيء متصل',
      hint: 'الكلمة كاملة، بس ببطء',
      steps: [word],
      rate: 0.55,
      disclaimer: null,
    },
    /** طبيعيّ. */
    natural: {
      id: 'natural',
      label: 'طبيعي',
      hint: 'زيّ ما بتتقال فعلًا',
      steps: [word],
      rate: 1,
      disclaimer: null,
    },
  };
}

/* ================================================================== *
 * السياق: كلمة ← تعبير ← جملة (بندا ٢٦ و٥١)
 * ================================================================== */

/**
 * يبني سلسلةَ السياق من **مصادرَ حقيقيّةٍ وحدَها**.
 *
 * ⚠️ **ولا يُختلَق تعبير.** لو لم يوجد مقطعُ تدريبٍ مرتبطٌ فعلًا،
 *    تُحذَف الحلقةُ الوسطى وتبقى الجملةُ الأصليّة — وهي سياقٌ صحيحٌ
 *    دائمًا. أمّا تلفيقُ «تعبيرٍ» بقصّ كلمتين حول الكلمة فيعلّمك
 *    تركيبًا قد لا يقوله أحد.
 *
 * @param {{ word: string, chunk?: string|null, sentence?: string|null }} sources
 */
export function contextChain({ word, chunk = null, sentence = null }) {
  const chain = [{ level: 'word', label: 'الكلمة', text: word, rate: 1 }];
  const clean = (s) => String(s || '').trim();

  /* التعبيرُ يُعرَض إن وُجد **وكان أوسعَ من الكلمة** — لا نسختَها. */
  if (clean(chunk) && clean(chunk) !== clean(word)) {
    chain.push({ level: 'chunk', label: 'في التعبير', text: clean(chunk), rate: 0.9 });
  }
  if (clean(sentence) && clean(sentence) !== clean(chunk)) {
    chain.push({ level: 'sentence', label: 'في الجملة الأصلية', text: clean(sentence), rate: 1 });
  }
  return chain;
}

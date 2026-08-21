/**
 * LingoLife — اختباراتُ محرّك النطق الروسيّ (WS52)
 *
 * تحرس أربعةَ أشياء ينكسر كلٌّ منها بصمت:
 *
 *  ١ · **الترتيب.** قاعدتان صحيحتان بترتيبٍ خاطئٍ تُنتجان لغةً خاطئة،
 *      ولا اختبارَ سلوكٍ واحدٌ يمسك ذلك — فيُثبَّت التسلسلُ رقمًا رقمًا.
 *  ٢ · **الإفراط.** لكلّ قاعدةٍ كبيرةٍ حالاتٌ تُثبِت أنها **لا** تنطلق.
 *  ٣ · **الصدق.** النبرُ المجهولُ يُعلَن مجهولًا، ولا يخرج نطقٌ مبتور.
 *  ٤ · **عدمُ الازدواج.** المحرّكُ يقرأ قاموسَ النبر القائمَ ولا ينشئ
 *      ثانيًا، ولا يمسّ ذاكرةَ الصوت المولَّد.
 */

import { describe, it, expect } from './test-runner.js';
import {
  analyzeWord, analyzeSentence, pronunciationMetadata,
  clearPronunciationCache, pronunciationCacheSize,
  FLAG, RULESET_VERSION,
} from '../js/services/pronunciation/engine.js';
import {
  orderedRules, allRuleIds, rulesForStage, rulesByStatus,
  DEFERRED_PHENOMENA, STAGE,
} from '../js/services/pronunciation/rule-registry.js';
import { syllabify } from '../js/services/pronunciation/syllabifier.js';
import { resolveStress, STRESS_STATUS } from '../js/services/pronunciation/stress-resolver.js';
import {
  POSITIVE, NEGATIVE, UNKNOWN_STRESS_CASES, REFERENCE_SENTENCE, CORPUS_SIZE,
} from './fixtures/russian-pronunciation-corpus.js';

/* ================================================================== *
 * ١) السجلُّ والترتيب
 * ================================================================== */

describe('النطق · سجلُّ القواعد وترتيبُها', () => {
  it('⚠️ الترتيبُ رقميٌّ صارم — ولا يعتمد على ترتيب الاستيراد', () => {
    const priorities = orderedRules().map((r) => r.priority);
    const sorted = [...priorities].sort((a, b) => a - b);
    expect(priorities).toEqual(sorted);
  });

  it('⚠️ والتسلسلُ الكاملُ مُثبَّت — فيسقط لو تغيّر بالصدفة', () => {
    expect(allRuleIds()).toEqual([
      'RU_ORTHO_GO_ENDING',
      'RU_ORTHO_CHN_SHN',
      'RU_ORTHO_GK_HK',
      'RU_CLUSTER_UNPRONOUNCED',
      'RU_CLUSTER_SH_LONG',
      'RU_CLUSTER_ZH_LONG',
      'RU_CLUSTER_TS_DS',
      'RU_GEMINATION',
      'RU_CLUSTER_SCH_ZCH',
      'RU_CLUSTER_TSYA',
      'RU_CLUSTER_TCH_DCH',
      'RU_CONS_ALWAYS_HARD',
      'RU_CONS_ALWAYS_SOFT',
      'RU_LOANWORD_HARD_BEFORE_E',
      'RU_PALATALIZATION_BY_VOWEL',
      'RU_PALATALIZATION_BY_SOFT_SIGN',
      'RU_SOFTNESS_ASSIMILATION',
      'RU_VOWEL_STRESSED',
      'RU_RED_A_O_PRETONIC1',
      'RU_RED_A_O_WEAK',
      'RU_RED_SOFT_IKANYE',
      'RU_RED_AFTER_HUSHING_E',
      'RU_RED_AFTER_HUSHING_WEAK',
      'RU_VOWEL_QUANTITATIVE_ONLY',
      'RU_FINAL_DEVOICING',
      'RU_VOICING_SONORANT_NEUTRAL',
      'RU_VOICING_V_NEUTRAL',
      'RU_REGRESSIVE_DEVOICING',
      'RU_REGRESSIVE_VOICING',
      'RU_CROSS_WORD_VOICING',
      'RU_CROSS_WORD_DEVOICING',
    ]);
  });

  it('⚠️ الهمسُ النهائيُّ قبل المماثلة الرجعيّة — وإلّا انكسرت «поезд»', () => {
    const ids = rulesForStage(STAGE.VOICING).map((r) => r.id);
    expect(ids.indexOf('RU_FINAL_DEVOICING') < ids.indexOf('RU_REGRESSIVE_DEVOICING')).toBe(true);
  });

  it('⚠️ والمانعان قبل المُطلِقَين — وإلّا جُهِّرت «плотва»', () => {
    const ids = rulesForStage(STAGE.VOICING).map((r) => r.id);
    expect(ids.indexOf('RU_VOICING_V_NEUTRAL') < ids.indexOf('RU_REGRESSIVE_VOICING')).toBe(true);
    expect(ids.indexOf('RU_VOICING_SONORANT_NEUTRAL') < ids.indexOf('RU_REGRESSIVE_VOICING')).toBe(true);
  });

  it('⚠️ والصلابةُ قبل الاختزال — لأن الاختزال يسأل عنها', () => {
    const stages = orderedRules().map((r) => r.stage);
    const lastHardness = stages.lastIndexOf(STAGE.HARDNESS);
    const firstReduction = stages.indexOf(STAGE.VOWEL_REDUCTION);
    expect(lastHardness < firstReduction).toBe(true);
  });

  it('ولكلّ قاعدةٍ مصدرٌ وحالةٌ ومستوى دليل — لا قاعدةَ بلا مرجع', () => {
    const naked = orderedRules().filter((r) => !r.source || !r.status || !r.evidence);
    expect(naked.map((r) => r.id)).toEqual([]);
  });

  it('ولكلّ قاعدةٍ شرحٌ عربيٌّ يصلح للعرض', () => {
    const mute = orderedRules().filter((r) => !r.explain || r.explain.length < 10);
    expect(mute.map((r) => r.id)).toEqual([]);
  });
});

/* ================================================================== *
 * ٢) الكوربوس — الموجب
 * ================================================================== */

describe('النطق · الكوربوس الموجب', () => {
  for (const c of POSITIVE) {
    it(`${c.word} — ${c.note}`, () => {
      const a = analyzeWord(c.word);
      expect(a.supported).toBe(true);

      if (c.stress !== undefined) expect(a.stress.ordinal).toBe(c.stress);
      if (c.stressSource) expect(a.stress.source).toBe(c.stressSource);
      if (c.syllables) expect(a.syllables).toEqual(c.syllables);
      if (c.simple) expect(a.pronunciation.simple).toBe(c.simple);
      if (c.ipa) expect(a.pronunciation.ipa).toBe(c.ipa);

      for (const id of c.rules || []) {
        if (!a.ruleIds.includes(id)) {
          throw new Error(`«${c.word}»: القاعدة ${id} كان يجب أن تنطلق — انطلق: ${a.ruleIds.join(', ')}`);
        }
      }
      for (const id of c.notRules || []) {
        if (a.ruleIds.includes(id)) {
          throw new Error(`⚠️ إفراط: «${c.word}» أطلقت ${id} وما كان ينبغي`);
        }
      }
      for (const flag of c.flags || []) expect(a.flags.includes(flag)).toBe(true);
    });
  }
});

/* ================================================================== *
 * ٣) الكوربوس — السالب (النصفُ الأهمّ)
 * ================================================================== */

describe('النطق · الكوربوس السالب — القاعدةُ لا تنطلق حيث لا ينبغي', () => {
  for (const c of NEGATIVE) {
    it(`${c.word} — ${c.note}`, () => {
      const a = analyzeWord(c.word);
      for (const id of c.notRules || []) {
        if (a.ruleIds.includes(id)) {
          throw new Error(`⚠️ إفراط: «${c.word}» أطلقت ${id} — انطلق كلُّه: ${a.ruleIds.join(', ')}`);
        }
      }
      for (const id of c.rules || []) expect(a.ruleIds.includes(id)).toBe(true);
      if (c.simple) expect(a.pronunciation.simple).toBe(c.simple);
      if (c.ipa) expect(a.pronunciation.ipa).toBe(c.ipa);
    });
  }

  it('⚠️ ولا يُنتج المحرّكُ ж/ш/ц ليّنةً لأيّ مدخَلٍ كان', () => {
    const probes = ['жить', 'шесть', 'цирк', 'мышь', 'жи', 'це', 'шё', 'жюри'];
    for (const word of probes) {
      const a = analyzeWord(word);
      const bad = a.sounds.filter((s) => 'жшц'.includes(s.letter) && s.soft === true);
      if (bad.length) throw new Error(`«${word}» أنتجت ساكنًا ليّنًا: ${JSON.stringify(bad)}`);
    }
  });

  it('⚠️ ولا يُنتج ч/щ/й صلبةً لأيّ مدخَلٍ كان', () => {
    for (const word of ['час', 'щука', 'чай', 'чо', 'щу', 'йогурт']) {
      const a = analyzeWord(word);
      const bad = a.sounds.filter((s) => 'чщй'.includes(s.letter) && s.soft === false);
      if (bad.length) throw new Error(`«${word}» أنتجت ساكنًا صلبًا: ${JSON.stringify(bad)}`);
    }
  });
});

/* ================================================================== *
 * ٤) النبر
 * ================================================================== */

describe('النطق · النبرُ تبعيّةٌ صلبة', () => {
  for (const c of UNKNOWN_STRESS_CASES) {
    it(`${c.word} — ${c.note}`, () => {
      const a = analyzeWord(c.word);
      expect(a.stress.status).toBe(STRESS_STATUS.UNKNOWN);
      expect(a.flags.includes(FLAG.UNKNOWN_STRESS)).toBe(true);
      /* ⚠️ ولا نطقَ مبتورًا — `null` لا نصٌّ ناقص. */
      expect(a.pronunciation.simple).toBe(null);
      expect(a.pronunciation.ipa).toBe(null);
      expect(a.warnings.some((w) => w.includes('النبر'))).toBe(true);
    });
  }

  it('⚠️ وبلا نبرٍ لا تنطلق قاعدةُ اختزالٍ واحدة — لا تُخمَّن الدرجة', () => {
    const a = analyzeWord('замок');
    const reduction = a.ruleIds.filter((id) => id.startsWith('RU_RED_') || id === 'RU_VOWEL_STRESSED');
    expect(reduction).toEqual([]);
  });

  it('تصحيحُك يُنسَب إليك لا للقاموس', () => {
    const a = analyzeWord('замок', { overrideStressOrdinal: 0 });
    expect(a.stress.status).toBe(STRESS_STATUS.KNOWN);
    expect(a.stress.source).toBe('user_confirmed');
    expect(a.stress.ordinal).toBe(0);
    expect(a.pronunciation.ipa).toBe('ˈzaməkـ'.replace('ـ', ''));
  });

  it('وتصحيحُك يقلب النطقَ فعلًا — لا يُسجَّل ويُهمَل', () => {
    const first = analyzeWord('замок', { overrideStressOrdinal: 0 }).pronunciation.simple;
    const second = analyzeWord('замок', { overrideStressOrdinal: 1 }).pronunciation.simple;
    expect(first !== second).toBe(true);
  });

  it('ё تعطي النبرَ بلا قاموس، والكلمةُ أحاديّةُ الحركة كذلك', () => {
    expect(resolveStress('лёгкий').source).toBe('rule_yo');
    expect(resolveStress('стол').source).toBe('rule_monosyllable');
  });

  it('⚠️ والعلامةُ المكتوبةُ في النصّ تسبق كلَّ قاموس', () => {
    expect(resolveStress('замо́к').source).toBe('explicit_text');
    expect(resolveStress('замо́к').ordinal).toBe(1);
  });
});

/* ================================================================== *
 * ٥) التقطيع
 * ================================================================== */

describe('النطق · التقطيعُ المقطعيّ', () => {
  it('عددُ المقاطع = عددُ حروف العلّة', () => {
    expect(syllabify('молоко').length).toBe(3);
    expect(syllabify('книга').length).toBe(2);
    expect(syllabify('стол').length).toBe(1);
  });

  it('⚠️ и كلمةٌ بلا حركةٍ لا تُقسَّم ولا تُختلَق لها مقاطع', () => {
    expect(syllabify('в')).toEqual([]);
    expect(syllabify('к')).toEqual([]);
  });

  it('⚠️ قانونُ الرنين الصاعد: се-стра لا сест-ра', () => {
    expect(syllabify('сестра').map((s) => s.text)).toEqual(['се', 'стра']);
  });

  it('⚠️ ورنّانةٌ قبل عائقةٍ تبقى مع مقطعها: сон-це', () => {
    expect(syllabify('сонце').map((s) => s.text)).toEqual(['сон', 'це']);
  });

  it('⚠️ ولا يبدأ مقطعٌ بعلامةٍ لا صوتَ لها: про-сьба', () => {
    expect(syllabify('просьба').map((s) => s.text)).toEqual(['про', 'сьба']);
  });
});

/* ================================================================== *
 * ٦) الجملةُ المرجعيّة والسياق
 * ================================================================== */

describe('النطق · الجملةُ والسياق', () => {
  it('الجملةُ المرجعيّةُ تُحلَّل كلمةً كلمة بلا سقوط', () => {
    const out = analyzeSentence(REFERENCE_SENTENCE);
    expect(out.length).toBe(12);
    expect(out.every((w) => w.supported)).toBe(true);
  });

  it('⚠️ وما لا يُعرَف نبرُه فيها يُعلَن مجهولًا لا يُخمَّن', () => {
    const out = analyzeSentence(REFERENCE_SENTENCE);
    const unknown = out.filter((w) => w.flags.includes(FLAG.UNKNOWN_STRESS));
    /* أربعُ كلماتٍ من الجملة في القاموس المدمج، والباقي مجهولٌ بصدق. */
    expect(unknown.length > 0).toBe(true);
    expect(unknown.every((w) => w.pronunciation.ipa === null)).toBe(true);
  });

  it('⚠️ والجارَان محفوظان — والمماثلةُ عبر الحدّ صارت مدعومةً بحدود (WS54)', () => {
    const out = analyzeSentence('после того как');
    expect(out[1].context.previousWord).toBe('после');
    expect(out[1].context.nextWord).toBe('как');
    /*
     * ⚠️ **كان هذا السطرُ يؤكّد `false` — وتغيّر السلوكُ عن قصد.**
     *    المماثلةُ الجهريّةُ عبر الحدّ مُنفَّذةٌ الآن، فالادّعاءُ بأنها
     *    غيرُ مدعومةٍ صار كذبًا في الاتّجاه المعاكس. والدعمُ **بحدود**:
     *    الجهرُ نعم، والوقفُ والليونةُ وы بعد حرف الجرّ لا — وكلُّها
     *    مُعلَنةٌ في `DEFERRED_PHENOMENA`.
     */
    expect(out[1].context.crossWordSupported).toBe(true);
    /* وآخرُ كلمةٍ بلا جارٍ بعدها: لا يُدّعى لها اتّصال. */
    expect(out[2].context.crossWordSupported).toBe(false);
  });
});

/* ================================================================== *
 * ٧) الأثرُ والأعلام
 * ================================================================== */

describe('النطق · الأثرُ التعليميّ والأعلام', () => {
  it('لكلّ خطوةٍ في الأثر معرِّفٌ وسببٌ عربيٌّ ومصدر', () => {
    const a = analyzeWord('молоко́');
    expect(a.appliedRules.length > 0).toBe(true);
    for (const step of a.appliedRules) {
      expect(Boolean(step.ruleId)).toBe(true);
      expect(Boolean(step.why)).toBe(true);
      expect(Boolean(step.source)).toBe(true);
    }
  });

  it('⚠️ والقاعدةُ المانعةُ تُسجَّل صراحةً — الصمتُ لا يُعلِّم', () => {
    const a = analyzeWord('пло́тва');
    const blocked = a.appliedRules.find((s) => s.ruleId === 'RU_VOICING_V_NEUTRAL');
    expect(Boolean(blocked)).toBe(true);
    expect(blocked.blocked).toBe(true);
  });

  it('والدرجةُ محفوظةٌ في البيانات وإن تساوى رمزُ الـIPA', () => {
    const a = analyzeWord('молоко́');
    const vowels = a.sounds.filter((s) => s.type === 'vowel');
    expect(vowels[0].reduction.degree).toBe(2);
    expect(vowels[1].reduction.degree).toBe(1);
    expect(vowels[2].stressed).toBe(true);
  });

  it('⚠️ واستثناءُ المعجم يُعلَن استثناءً لا قاعدةً مُنتِجة', () => {
    const a = analyzeWord('что');
    expect(a.flags.includes(FLAG.LEXICAL_EXCEPTION)).toBe(true);
    expect(a.flags.includes(FLAG.VERIFIED_RULE)).toBe(false);
    expect(Boolean(a.lexical?.source)).toBe(true);
  });

  it('⚠️ والخلافُ بين المصادر يُعرَض ولا يُحسَم صامتًا', () => {
    const a = analyzeWord('моло́чный');
    expect(a.flags.includes(FLAG.LEXICAL_EXCEPTION)).toBe(true);
    expect(a.warnings.some((w) => w.includes('نطقان مقبولان'))).toBe(true);
    /* ولا تحويلَ وقع: الكلمةُ تبقى بـчн. */
    expect(a.ruleIds.includes('RU_ORTHO_CHN_SHN')).toBe(false);
  });

  it('ولا يخرج علَمُ VERIFIED_RULE مع علَمٍ آخر', () => {
    for (const word of ['молоко́', 'что', 'замок']) {
      const a = analyzeWord(word);
      if (a.flags.includes(FLAG.VERIFIED_RULE)) expect(a.flags.length).toBe(1);
    }
  });
});

/* ================================================================== *
 * ٨) الحفظُ المؤقّت والأداء والفصلُ المعماريّ
 * ================================================================== */

describe('النطق · الأداءُ والفصلُ المعماريّ', () => {
  it('نفسُ المدخَل يعطي نفسَ المخرَج — حتميّةٌ لا احتمال', () => {
    const a = analyzeWord('молоко́');
    const b = analyzeWord('молоко́');
    expect(a.pronunciation.ipa).toBe(b.pronunciation.ipa);
    expect(a.ruleIds).toEqual(b.ruleIds);
  });

  it('والحفظُ المؤقّت يعمل ولا ينمو بلا حدّ', () => {
    clearPronunciationCache();
    analyzeWord('вода́');
    const after = pronunciationCacheSize();
    analyzeWord('вода́');
    expect(pronunciationCacheSize()).toBe(after);
  });

  it('⚠️ والمفتاحُ يشمل النبرَ — فتصحيحُك لا يقرأ نتيجةً قديمة', () => {
    clearPronunciationCache();
    const a = analyzeWord('замок', { overrideStressOrdinal: 0 });
    const b = analyzeWord('замок', { overrideStressOrdinal: 1 });
    expect(a.pronunciation.ipa !== b.pronunciation.ipa).toBe(true);
  });

  it('و٢٠٠ كلمةٍ تُحلَّل في أقلّ من ٢٥٠ms — الظلُّ لا ينتظر', () => {
    clearPronunciationCache();
    const words = ['молоко́', 'вода́', 'го́род', 'друг', 'хлеб', 'про́сьба', 'сде́лать', 'коне́чно'];
    const t0 = performance.now();
    for (let i = 0; i < 200; i += 1) analyzeWord(words[i % words.length] + (i % 2 ? '' : ''));
    const ms = performance.now() - t0;
    if (ms > 250) throw new Error(`بطيء: ${Math.round(ms)}ms`);
  });

  it('⚠️ والبياناتُ المحفوظةُ مضغوطةٌ وقابلةٌ لإعادة التحليل', () => {
    const meta = pronunciationMetadata(analyzeWord('молоко́'));
    expect(meta.rulesetVersion).toBe(RULESET_VERSION);
    expect(Array.isArray(meta.ruleIds)).toBe(true);
    /* ⚠️ ولا شرحٌ عربيٌّ مكرَّرٌ في كلّ صفّ — الكلمةُ تُعاد تحليلُها. */
    expect(Object.hasOwn(meta, 'explain')).toBe(false);
    expect(Object.keys(meta).sort()).toEqual(
      ['normalizedWord', 'ruleIds', 'rulesetVersion', 'stressOrdinal', 'stressSource']
    );
  });
});

/* ================================================================== *
 * ٩) لا ازدواجَ في الأنظمة
 * ================================================================== */

describe('النطق · لا ازدواجَ مع ما هو قائم', () => {
  it('⚠️ يقرأ قاموسَ النبر القائمَ ولا ينشئ ثانيًا', async () => {
    const src = await (await fetch('/js/services/pronunciation/stress-resolver.js')).text();
    expect(src.includes("from '../shadow/stress.js'")).toBe(true);
    /* ولا قاموسَ كلماتٍ مكتوبٌ في وحدات النطق. */
    for (const file of ['stress-resolver.js', 'engine.js', 'alphabet.js']) {
      const text = await (await fetch(`/js/services/pronunciation/${file}`)).text();
      expect(/привет|спасибо|здравствуйте:/.test(text)).toBe(false);
    }
  });

  it('⚠️ ولا يمسّ ذاكرةَ الصوت المولَّد ولا أيَّ مزوّد نطق', async () => {
    const files = ['engine.js', 'stress-resolver.js', 'syllabifier.js', 'rule-registry.js',
      'pronunciation-lexicon.js', 'alphabet.js'];
    for (const file of files) {
      const text = await (await fetch(`/js/services/pronunciation/${file}`)).text();
      expect(/audio-cache|tts-controller|BrowserTTSProvider|piper|xtts/i.test(text)).toBe(false);
    }
  });

  it('⚠️ ولا طلبَ شبكةٍ في المحرّك — يعمل بلا إنترنت', async () => {
    const files = ['engine.js', 'syllabifier.js', 'rule-registry.js', 'alphabet.js',
      'pronunciation-lexicon.js', 'rules/orthoepic.js', 'rules/hardness.js',
      'rules/reduction.js', 'rules/voicing.js'];
    for (const file of files) {
      const text = await (await fetch(`/js/services/pronunciation/${file}`)).text();
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(code)).toBe(false);
    }
  });

  it('⚠️ والكلمةُ المحفوظةُ تحمل بياناتِ نطقٍ اختياريّةً لا شرحًا مكرَّرًا', async () => {
    const { openDB } = await import('../js/db/database.js');
    const { savedItems } = await import('../js/db/repositories.js');
    const { saveItem, SAVED_KIND } = await import('../js/services/saved-service.js');
    await openDB();

    const text = `вода́-${Date.now()}`;
    const row = await saveItem({
      text, kind: SAVED_KIND.WORD,
      pronunciation: pronunciationMetadata(analyzeWord('вода́')),
    });
    expect(row.pronunciation.rulesetVersion).toBe(RULESET_VERSION);
    expect(row.pronunciation.ruleIds.includes('RU_RED_A_O_PRETONIC1')).toBe(true);
    /*
     * ⚠️ **«القاموس» لا «مكتوب في النصّ» — وهذا هو الصواب.**
     *    العلامةُ على «вода́» تطابق مدخَلَ القاموس المدمج تمامًا، فالنسبُ
     *    إليه. ولا نعرف — ولا يجوز أن ندّعي — أن مؤلِّفَ النصّ كتبها بيده.
     */
    expect(row.pronunciation.stressSource).toBe('dictionary');
    await savedItems.destroy(row.id);
  });

  it('⚠️ وصفٌّ قديمٌ بلا الحقل يبقى مقروءًا — لا ترقيةَ ولا كسر', async () => {
    const { openDB } = await import('../js/db/database.js');
    const { savedItems } = await import('../js/db/repositories.js');
    const { listSaved, saveItem, SAVED_KIND } = await import('../js/services/saved-service.js');
    await openDB();

    /* صفٌّ كما كان يُكتَب قبل WS52 — بلا حقل `pronunciation` إطلاقًا. */
    const old = await savedItems.create({
      text: `старое-${Date.now()}`, normalizedText: `старое-${Date.now()}`,
      kind: SAVED_KIND.WORD, tagIds: [], note: '', translation: '',
      state: 'active', impliesMastery: false, impliesRealUsage: false,
    });
    const rows = await listSaved({ kind: SAVED_KIND.WORD, limit: 500 });
    const found = rows.find((r) => r.id === old.id);
    expect(Boolean(found)).toBe(true);
    expect(found.pronunciation === undefined || found.pronunciation === null).toBe(true);

    /* وحفظُ جملةٍ لا يُلصق بها تحليلَ نطقٍ لا معنى له. */
    const sentence = await saveItem({ text: `Это предложение ${Date.now()}.` });
    expect(sentence.pronunciation).toBe(null);

    await savedItems.destroy(old.id);
    await savedItems.destroy(sentence.id);
  });

  it('والكوربوسُ فيه موجبٌ وسالبٌ بعددٍ معتبر', () => {
    expect(CORPUS_SIZE.positive >= 35).toBe(true);
    expect(CORPUS_SIZE.negative >= 20).toBe(true);
  });
});

/* ================================================================== *
 * ١٠) حالاتُ النضج — الصدقُ عن حدود معرفتنا (WS54)
 * ================================================================== */

describe('النطق · حالاتُ نضج القواعد', () => {
  it('لكلّ قاعدةٍ حالةٌ صريحة — ولا نسبةَ ثقةٍ في المحرّك كلِّه', async () => {
    for (const rule of orderedRules()) {
      expect(['VERIFIED', 'PROVISIONAL', 'DISPUTED', 'LEXICAL'].includes(rule.status)).toBe(true);
      expect(Object.hasOwn(rule, 'confidence')).toBe(false);
    }
  });

  it('⚠️ ولا تدخل قاعدةٌ `DEFERRED` السجلَّ التنفيذيّ', () => {
    expect(orderedRules().some((r) => r.status === 'DEFERRED')).toBe(false);
    /* والمؤجَّلُ بيانٌ يُعَدّ ويُراجَع لا نثرٌ في وثيقة. */
    expect(DEFERRED_PHENOMENA.length >= 8).toBe(true);
    for (const d of DEFERRED_PHENOMENA) expect(d.why.length > 20).toBe(true);
  });

  it('التوزيعُ معلَنٌ ولا يدّعي تحقّقًا لم يقع', () => {
    const by = rulesByStatus();
    expect(by.VERIFIED.length + by.PROVISIONAL.length
      + by.DISPUTED.length + by.LEXICAL.length).toBe(orderedRules().length);
    /* ما زال في المحرّك مبدئيٌّ — ولا نُخفيه. */
    expect(by.PROVISIONAL.length > 0).toBe(true);
  });

  it('⚠️ والمُختلَفُ فيه **لا يحوّل صوتًا** — يقول ولا يفرض', () => {
    /* `снег`: التليينُ المماثِل ينطلق ويُسجَّل، والـ`с` تبقى صلبة. */
    const a = analyzeWord('снег');
    expect(a.ruleIds.includes('RU_SOFTNESS_ASSIMILATION')).toBe(true);
    const s = a.sounds.find((x) => x.letter === 'с');
    expect(s.soft).toBe(false);
    expect(s.labels.some((l) => l.includes('اختياريّ') || l.includes('بعض المتحدّثين'))).toBe(true);
  });
});

/* ================================================================== *
 * ١١) القواعدُ الجديدة — موجبٌ وسالب
 * ================================================================== */

describe('النطق · تغطيةٌ موسَّعة (WS54)', () => {
  it('الساكنان المتماثلان صوتٌ واحدٌ طويل', () => {
    const a = analyzeWord('ва́нна');
    expect(a.pronunciation.ipa).toBe('ˈvanːə');
    expect(a.ruleIds.includes('RU_GEMINATION')).toBe(true);
  });

  it('⚠️ ولا يُطلقها حرفان مختلفان', () => {
    expect(analyzeWord('ла́па').ruleIds.includes('RU_GEMINATION')).toBe(false);
  });

  it('сш تصير ш واحدةً طويلة', () => {
    const a = analyzeWord('не́сший');
    expect(a.ruleIds.includes('RU_CLUSTER_SH_LONG')).toBe(true);
    expect(a.pronunciation.ipa).toBe('ˈnʲeʂːɨj');
  });

  it('сж في أوّل الكلمة تصير ж واحدةً طويلة', () => {
    expect(analyzeWord('сжать').ruleIds.includes('RU_CLUSTER_ZH_LONG')).toBe(true);
  });

  it('тс قبل لاحقة ‎-ск- تصير ц', () => {
    const a = analyzeWord('сове́тский');
    expect(a.ruleIds.includes('RU_CLUSTER_TS_DS')).toBe(true);
    expect(a.rewrittenText.includes('цк')).toBe(true);
  });

  it('⚠️ ولا تُطلَق على тс خارج تلك اللاحقة', () => {
    expect(analyzeWord('отсу́тствие').rewrittenText.startsWith('ац')).toBe(false);
  });

  it('المُعرَّبُ يبقى صلبًا قبل е — وترتيبُ القاعدة هو ما يُنجحها', () => {
    const a = analyzeWord('пасте́ль');
    expect(a.ruleIds.includes('RU_LOANWORD_HARD_BEFORE_E')).toBe(true);
    expect(a.pronunciation.ipa).toBe('pɐˈstelʲ');
  });

  it('⚠️ وكلمةٌ روسيّةٌ أصيلةٌ تلين كالمعتاد', () => {
    expect(analyzeWord('лес').ruleIds.includes('RU_LOANWORD_HARD_BEFORE_E')).toBe(false);
    expect(analyzeWord('лес').pronunciation.ipa).toBe('ˈlʲes');
  });

  it('المماثلةُ عبر حدّ الكلمة تعمل', () => {
    const a = analyzeWord('к', { nextWord: 'де́лу' });
    expect(a.ruleIds.includes('RU_CROSS_WORD_VOICING')).toBe(true);
    expect(a.context.crossWordApplied).toBe(true);
  });

  it('⚠️ واستثناءُ в يعبر الحدَّ معها — «докуме́нт все» تبقى بـт', () => {
    const a = analyzeWord('докуме́нт', { nextWord: 'все' });
    expect(a.ruleIds.includes('RU_CROSS_WORD_VOICING')).toBe(false);
    expect(a.pronunciation.ipa.endsWith('t')).toBe(true);
  });

  it('⚠️ والرنّانةُ في أوّل الكلمة التالية لا تُجهِّر كذلك', () => {
    expect(analyzeWord('от', { nextWord: 'мамы' }).ruleIds.includes('RU_CROSS_WORD_VOICING')).toBe(false);
  });

  it('وبلا جارٍ لا يُدّعى كلامٌ متّصل', () => {
    expect(analyzeWord('к').context.crossWordSupported).toBe(false);
  });
});

/* ================================================================== *
 * ١٢) إعادةُ التحليل — التحليلُ ليس حقيقةً مجمَّدة
 * ================================================================== */

describe('النطق · إعادةُ التحليل تحت إصدارٍ جديد', () => {
  it('⚠️ صفٌّ حُلِّل بإصدارٍ قديمٍ يُعرَف ويُعاد — بلا تحريرٍ يدويّ', async () => {
    const { openDB } = await import('../js/db/database.js');
    const { savedItems } = await import('../js/db/repositories.js');
    const { saveItem, SAVED_KIND } = await import('../js/services/saved-service.js');
    const { findStale, reanalyzeSaved, isStale } =
      await import('../js/services/pronunciation/reanalysis.js');
    await openDB();

    const text = `вода́-${Date.now()}`;
    const row = await saveItem({
      text, kind: SAVED_KIND.WORD,
      pronunciation: { normalizedWord: text, stressOrdinal: 1, stressSource: 'dictionary',
        ruleIds: ['RU_RED_A_O_PRETONIC1'], rulesetVersion: '1.0.0' },
    });
    expect(isStale(row.pronunciation)).toBe(true);

    const stale = await findStale();
    expect(stale.some((r) => r.id === row.id)).toBe(true);

    const out = await reanalyzeSaved();
    expect(out.version).toBe(RULESET_VERSION);
    const after = await savedItems.get(row.id);
    expect(after.pronunciation.rulesetVersion).toBe(RULESET_VERSION);
    /* ولم يُمَسّ نصُّك ولا تصنيفاتُك. */
    expect(after.text).toBe(text);
    await savedItems.destroy(row.id);
  });

  it('⚠️ والنبرُ الذي أكّدتَه بنفسك يبقى نبرَك بعد الترقية', async () => {
    const { openDB } = await import('../js/db/database.js');
    const { savedItems } = await import('../js/db/repositories.js');
    const { saveItem, SAVED_KIND } = await import('../js/services/saved-service.js');
    const { reanalyzeSaved } = await import('../js/services/pronunciation/reanalysis.js');
    await openDB();

    const row = await saveItem({
      text: 'замок', kind: SAVED_KIND.WORD,
      pronunciation: { normalizedWord: 'замок', stressOrdinal: 0, stressSource: 'user_confirmed',
        ruleIds: [], rulesetVersion: '0.9.0' },
    });
    await reanalyzeSaved();
    const after = await savedItems.get(row.id);
    expect(after.pronunciation.stressSource).toBe('user_confirmed');
    expect(after.pronunciation.stressOrdinal).toBe(0);
    await savedItems.destroy(row.id);
  });

  it('وقاعدةٌ بعينها تُحدَّد كلماتُها بلا مسحٍ شامل', async () => {
    const { findStale } = await import('../js/services/pronunciation/reanalysis.js');
    const hits = await findStale({ ruleId: 'RU_FINAL_DEVOICING' });
    expect(Array.isArray(hits)).toBe(true);
  });
});

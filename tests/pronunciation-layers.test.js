/**
 * LingoLife — اختباراتُ الطبقتين: منفردةً وداخل الجملة (WS-N)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **حالةُ الانحدارِ اسمُها `име́ет` — والمختبَرُ هو المحرّك**
 * ═══════════════════════════════════════════════════════════════
 *
 * الكلمةُ التي كشفت العطبَ ليست الميزة. فلو اكتفينا باختبارها لَجاز أن
 * يُصلَّح العطبُ باستثناءٍ باسمها وتمرَّ كلُّ الاختبارات — وهو بالضبط ما
 * يمنعه البندُ ٨٠. ولذلك هنا ثلاثةُ صفوفٍ من الحراسة:
 *
 *  ① **مصفوفةُ الظواهر** (§53): ستٌّ وعشرون ظاهرةً صوتيّةً بكلماتٍ
 *     مختلفة — كي يكون النجاحُ دليلَ محرّكٍ لا دليلَ كلمة.
 *  ② **شروطُ الرفض** (§55 و§80): مكتوبةً بنصّها، تسقط لو عاد أيٌّ منها.
 *  ③ **حرّاسٌ بنيويّون** يقرؤون **الكود** لا النصّ: لا استثناءَ باسم
 *     كلمة، ولا مشغّلَ ثانٍ، ولا مخزنَ تسجيلٍ ثالث، ولا عودةَ للمُقلِّب.
 */

import { describe, it, expect } from './test-runner.js';
import {
  analyzePronunciation, analyzeSentencePronunciation, boundaryAfter, boundaryBlocks,
  BOUNDARY, clearAnalysisCache, analysisCacheSizes, PRONUNCIATION_ANALYSIS_VERSION,
} from '../js/services/pronunciation/analysis.js';
import { analyzeWord, pronunciationMetadata } from '../js/services/pronunciation/engine.js';
import { isStale } from '../js/services/pronunciation/reanalysis.js';
import { allRuleIds, ruleById, SCOPE } from '../js/services/pronunciation/rule-registry.js';
import { phonemeClass, PHONEME_CLASS } from '../js/services/pronunciation/alphabet.js';
import { arabicEar } from '../js/services/pronunciation/arabic-ear.js';

/** الجملةُ الحقيقيّةُ التي جاء منها البلاغ. */
const SENTENCE = 'Я счита́ю, что тако́й докуме́нт име́ет большо́е значе́ние';

/** كلُّ القواعد المعروضة في طبقةٍ ما، بمعرّفاتها. */
const ids = (layer) => layer.appliedRules.map((r) => r.ruleId);

/** كلُّ مواضع كلّ قاعدةٍ معروضة. */
const instances = (layer) => layer.appliedRules.flatMap((r) => r.instances);

/** نصُّ الشروح مجموعًا — لفحص ما **لا** يجوز أن يُقال. */
const explanations = (layer) => instances(layer).map((one) => one.why).join(' ');

/** يقرأ ملفَّ كودٍ من الخادم (الاختبارات تعمل في المتصفّح). */
async function source(path) {
  const res = await fetch(new URL(path, window.location.origin));
  return res.text();
}

/**
 * ⚠️ **ويُجرَّد التعليقُ قبل القياس — قاعدةُ البيت.**
 *    حرّاسُ هذا الملفّ تقيس **كودًا**؛ ولو قرأت النصَّ الخامّ لالتقطت
 *    تعليقاتي أنا التي تشرح العطبَ وتذكر اسمَه، فتسقط على شرحِ ما
 *    أصلحتُه لا على عودته.
 */
const codeOnly = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/<!--[\s\S]*?-->/g, ' ');

/* ================================================================== *
 * ١) حالةُ الانحدار — §54 و§55 و§56
 * ================================================================== */

describe('WS-N · име́ет: الطبقةُ المعجميّةُ لا تتبدّل بجارها', () => {
  it('أ · مقاطعُها ثلاثةٌ والنبرُ على الثاني', () => {
    const one = analyzePronunciation('име́ет');
    expect(one.syllables).toEqual(['и', 'ме', 'ет']);
    expect(one.stress.ordinal).toBe(1);
    expect(one.stress.syllableNumber).toBe(2);
  });

  it('ب · ونطقُها منفردةً ينتهي بـ[t] — لا [d]', () => {
    const one = analyzePronunciation('име́ет');
    expect(one.lexical.ipa).toBe('ɪˈmʲejɪt');
    expect(one.lexical.ipa.endsWith('t')).toBe(true);
    expect(one.lexical.ipa.endsWith('d')).toBe(false);
  });

  it('ج · وفتحُها من الجملة لا يغيّر حرفًا في الطبقة المعجميّة', () => {
    const alone = analyzePronunciation('име́ет');
    const inside = analyzePronunciation('име́ет', { nextWord: 'большо́е' });
    expect(inside.lexical.ipa).toBe(alone.lexical.ipa);
    expect(inside.lexical.simple).toBe(alone.lexical.simple);
    /* ⚠️ **العطبُ الأصليّ**: كان `ipa` واحدًا فتكتب الطبقةُ الثانيةُ فوقه. */
    expect(inside.lexical.ipa.endsWith('t')).toBe(true);
  });

  it('د · والتغيّرُ المتوقّعُ يعيش في طبقة السياق وحدَها', () => {
    const inside = analyzePronunciation('име́ет', { nextWord: 'большо́е' });
    expect(inside.context.ipa).toBe('ɪˈmʲejɪd');
    expect(inside.context.changes).toHaveLength(1);
    expect(inside.context.changes[0].fromIpa).toBe('t');
    expect(inside.context.changes[0].toIpa).toBe('d');
    expect(inside.context.changes[0].ruleId).toBe('RU_CROSS_WORD_VOICING');
  });

  it('هـ · وإزالةُ الجار تُزيل التغيّرَ كلَّه (§56)', () => {
    analyzePronunciation('име́ет', { nextWord: 'большо́е' });
    const alone = analyzePronunciation('име́ет');
    expect(alone.context).toBe(null);
    expect(alone.lexical.ipa.endsWith('t')).toBe(true);
  });

  it('و · ولا قاعدةَ عن «л» في كلمةٍ بلا «л» (§55 · §59)', () => {
    for (const opts of [{}, { nextWord: 'большо́е' }, { nextWord: 'значе́ние' }]) {
      const one = analyzePronunciation('име́ет', opts);
      const said = explanations(one.lexical) + explanations(one.context || { appliedRules: [] });
      expect(said.includes('«л»')).toBe(false);
      expect(said.includes('«с»')).toBe(false);
      expect(said.includes('«к»')).toBe(false);
      expect(said.includes('«ч»')).toBe(false);
      expect(said.includes('«ь»')).toBe(false);
      expect(said.includes('«ъ»')).toBe(false);
    }
  });

  it('ز · وكلُّ قاعدةٍ معروضةٍ مُطلِقُها حرفٌ موجودٌ فعلًا في الكلمة', () => {
    const one = analyzePronunciation('име́ет');
    const letters = [...'имеет'];
    for (const step of instances(one.lexical)) {
      /*
       * ⚠️ **والمُطلِقُ قد يكون الجارَ داخل الكلمة لا الحرفَ نفسَه.**
       *    `м` تلين **بسبب `е` التي بعدها**، فمُطلِقُها `е`@٢. والمهمُّ
       *    ليس أن يكون المُطلِقُ هو المتأثِّر، بل أن يكون **موجودًا حيث
       *    يقول** — وهذا ما سقط في النسخة السابقة.
       */
      expect(['self', 'next'].includes(step.trigger.side)).toBe(true);
      expect(letters.includes(step.trigger.grapheme)).toBe(true);
      expect(letters[step.trigger.at]).toBe(step.trigger.grapheme);
    }
  });

  it('ح · ولا يُقال إن فيها «й» مكتوبة — انتقالٌ صوتيّ لا حرف (§15)', () => {
    const one = analyzePronunciation('име́ет');
    const said = explanations(one.lexical);
    expect(said.includes('«й»')).toBe(false);
    expect(said.includes('انتقال صوتي')).toBe(true);
    const glide = one.lexical.sounds.find((s) => s.synthetic);
    expect(glide.ipa).toBe('j');
    expect(glide.labels.join(' ').includes('مش حرف مكتوب')).toBe(true);
  });

  it('ط · و«بعيدة عن النبر» لا تُقال عمّا يلي المنبورَ مباشرةً (§16)', () => {
    const one = analyzePronunciation('име́ет');
    const said = explanations(one.lexical);
    expect(said.includes('بعيدة عن النبر')).toBe(false);
    expect(said.includes('بعد المقطع المنبور')).toBe(true);
    /* ⚠️ ودرجةُ الاختزال لا تُقال بلا الصوت الناتج (§80). */
    expect(said.includes('[ɪ]')).toBe(true);
  });

  it('ي · والتحليلُ سليمٌ داخليًّا في الحالتين', () => {
    expect(analyzePronunciation('име́ет').validation.ok).toBe(true);
    expect(analyzePronunciation('име́ет', { nextWord: 'большо́е' }).validation.ok).toBe(true);
  });
});

/* ================================================================== *
 * ٢) الحدودُ والوقفات — §9 و§57 و§58
 * ================================================================== */

describe('WS-N · الحدُّ بين الكلمتين يقرّر قبل القواعد', () => {
  it('ك · فاصلةٌ بعد الكلمة تمنع المماثلة (§58)', () => {
    const one = analyzePronunciation('име́ет,', { nextWord: 'большо́е' });
    expect(one.context.boundary.kind).toBe(BOUNDARY.CLAUSE);
    expect(one.context.boundary.blocks).toBe(true);
    expect(one.context.changes).toHaveLength(0);
    expect(one.context.ipa).toBe(one.lexical.ipa);
    expect(one.context.reason.includes('وقفة')).toBe(true);
  });

  it('ل · ونهايةُ الجملة كذلك، وبنصٍّ مختلف', () => {
    const one = analyzePronunciation('име́ет.', { nextWord: 'Большо́е' });
    expect(one.context.boundary.kind).toBe(BOUNDARY.SENTENCE);
    expect(one.context.changes).toHaveLength(0);
    expect(one.context.reason.includes('بتقف')).toBe(true);
  });

  it('م · وتصنيفُ الحدّ يُقرأ من الترقيم كما كُتب', () => {
    expect(boundaryAfter('счита́ю,', 'что')).toBe(BOUNDARY.CLAUSE);
    expect(boundaryAfter('что', 'тако́й')).toBe(BOUNDARY.NONE);
    expect(boundaryAfter('значе́ние.', 'Я')).toBe(BOUNDARY.SENTENCE);
    expect(boundaryAfter('име́ет', null)).toBe(BOUNDARY.ABSENT);
    expect(boundaryBlocks(BOUNDARY.NONE)).toBe(false);
    expect(boundaryBlocks(BOUNDARY.CLAUSE)).toBe(true);
  });

  it('ن · وجارٌ مختلفٌ يُعيد الحسابَ ولا يُعيد نتيجةً محفوظة (§57)', () => {
    const before = analyzePronunciation('докуме́нт', { nextWord: 'де́лу' });
    const after = analyzePronunciation('докуме́нт', { nextWord: 'все' });
    expect(before.context.changes.length > 0).toBe(true);
    expect(after.context.changes).toHaveLength(0);
    /* ⚠️ **و`в` ليست عائقًا عاديًّا** (§10): مجهورةٌ ولا تُجهِّر ما قبلها. */
    expect(after.context.nextPhoneme.class).toBe(PHONEME_CLASS.V_SPECIAL);
    expect(after.context.reason.includes('«в»')).toBe(true);
  });

  it('س · وذاكرةُ السياق لا تتسرّب إلى ذاكرة الكلمة (§45)', () => {
    clearAnalysisCache();
    analyzePronunciation('име́ет', { nextWord: 'большо́е' });
    const sizes = analysisCacheSizes();
    expect(sizes.lexical >= 1).toBe(true);
    expect(sizes.context >= 1).toBe(true);
    /* نفسُ الكلمة بجارٍ آخر: مدخَلُ سياقٍ ثانٍ، لا استبدالٌ للأوّل. */
    analyzePronunciation('име́ет', { nextWord: 'значе́ние' });
    expect(analysisCacheSizes().context > sizes.context).toBe(true);
    expect(analyzePronunciation('име́ет').lexical.ipa.endsWith('t')).toBe(true);
  });
});

/* ================================================================== *
 * ٣) مصفوفةُ الظواهر — §53 (ستٌّ وعشرون)
 * ================================================================== */

describe('WS-N · مصفوفةُ الظواهر: المحرّكُ لا الكلمة', () => {
  it('١ · حركةٌ منبورةٌ تُنطَق كاملة', () => {
    const one = analyzePronunciation('до́м');
    const stressed = one.lexical.sounds.find((s) => s.stressed);
    expect(stressed.ipa).toBe('o');
  });

  it('٢ · وحركةٌ قبل النبر مباشرةً → [ɐ]', () => {
    const one = analyzePronunciation('молоко́');
    expect(one.lexical.sounds[3].ipa).toBe('ɐ');
  });

  it('٣ · وحركةٌ بعد النبر → صوتٌ غامضٌ قصير', () => {
    const one = analyzePronunciation('сло́во');
    expect(one.lexical.sounds.at(-1).ipa).toBe('ə');
  });

  it('٤ · وساكنٌ صلبٌ يبقى صلبًا', () => {
    const one = analyzePronunciation('ла́па');
    const first = one.lexical.sounds[0];
    expect(first.soft).toBe(false);
    expect(first.ipa).toBe('ɫ');
  });

  it('٥ · وساكنٌ يلين قبل حرفٍ مليِّن — والصوتُ يُذكَر مع الوصف', () => {
    const one = analyzePronunciation('ле́с');
    expect(one.lexical.sounds[0].soft).toBe(true);
    expect(one.lexical.sounds[0].ipa).toBe('lʲ');
    expect(explanations(one.lexical).includes('[lʲ]')).toBe(true);
  });

  it('٦ · وهمسٌ في آخر الكلمة حيث ينطبق', () => {
    expect(analyzePronunciation('дру́г').lexical.ipa.endsWith('k')).toBe(true);
    expect(analyzePronunciation('са́д').lexical.ipa.endsWith('t')).toBe(true);
  });

  it('٧ · ومهموسٌ يُجهَّر عبر الحدّ — في طبقة السياق وحدَها', () => {
    const one = analyzePronunciation('к', { nextWord: 'де́лу' });
    expect(one.context.changes[0].toIpa).toBe('ɡ');
    expect(ids(one.context)).toContain('RU_CROSS_WORD_VOICING');
    expect(ids(one.lexical)).toHaveLength(0);
  });

  it('٨ · ومجهورٌ يُهمَس عبر الحدّ', () => {
    const one = analyzePronunciation('на́д', { nextWord: 'столо́м' });
    expect(one.context.appliedRules.length > 0).toBe(true);
    expect(one.context.appliedRules.every((r) => r.scope === SCOPE.CONNECTED_SPEECH)).toBe(true);
  });

  it('٩ · وسياقٌ بلا مماثلةٍ يقول ذلك بسببٍ مسمًّى', () => {
    const one = analyzePronunciation('до́м', { nextWord: 'большо́й' });
    expect(one.context.changes).toHaveLength(0);
    expect(one.context.applied).toBe(false);
    expect(String(one.context.reason).length > 10).toBe(true);
  });

  it('١٠ · والوقفةُ تمنع (مكرّرةٌ هنا لأنها ظاهرةٌ لا حالة)', () => {
    const one = analyzePronunciation('к.', { nextWord: 'де́лу' });
    expect(one.context.changes).toHaveLength(0);
  });

  it('١١ · ورنّانةٌ بعده لا تُجهِّر — والشرحُ يسمّي حرفَها', () => {
    const one = analyzePronunciation('сло́во');
    expect(ids(one.lexical)).toContain('RU_SONORANT_NO_TRIGGER');
    const step = instances(one.lexical).find((s) => s.why.includes('رنّانة'));
    expect(step.trigger.grapheme).toBe('л');
    expect(step.why.includes('«л»')).toBe(true);
  });

  it('١٢ · و«в» فئةٌ قائمةٌ بذاتها لا عائقٌ عاديّ', () => {
    expect(phonemeClass('в')).toBe(PHONEME_CLASS.V_SPECIAL);
    expect(phonemeClass('б')).toBe(PHONEME_CLASS.VOICED_OBSTRUENT);
    expect(phonemeClass('л')).toBe(PHONEME_CLASS.SONORANT);
    expect(phonemeClass('х')).toBe(PHONEME_CLASS.UNPAIRED_VOICELESS);
    const one = analyzePronunciation('пло́тва');
    expect(ids(one.lexical)).toContain('RU_VOICING_V_NEUTRAL');
  });

  it('١٣ · وحركتان متجاورتان قد يظهر بينهما انزلاق', () => {
    const one = analyzePronunciation('име́ет');
    expect(one.lexical.sounds.some((s) => s.synthetic && s.ipa === 'j')).toBe(true);
  });

  it('١٤ · وبيئاتُ «е»', () => {
    expect(analyzePronunciation('ле́с').lexical.ipa).toContain('lʲ');
    expect(analyzePronunciation('жена́').lexical.ipa).toContain('ɨ');
  });

  it('١٥ · وبيئاتُ «ё» — والنبرُ عليها دائمًا', () => {
    const one = analyzePronunciation('нёс');
    expect(one.stress.ordinal).toBe(0);
    expect(one.lexical.ipa).toContain('o');
  });

  it('١٦ · وبيئاتُ «ю»', () => {
    const one = analyzePronunciation('люблю́');
    expect(one.lexical.ipa).toContain('u');
    expect(one.lexical.complete).toBe(true);
  });

  it('١٧ · وبيئاتُ «я»', () => {
    const one = analyzePronunciation('мя́со');
    /* ⚠️ صوتٌ واحدٌ ليّنٌ لا صوتان: `мя` = [mʲa] لا [mʲja]. */
    expect(one.lexical.ipa.startsWith('ˈmʲa')).toBe(true);
  });

  it('١٨ · و«ь» تليّن ولا صوتَ لها', () => {
    const one = analyzePronunciation('пи́сьмо');
    const sign = one.lexical.sounds.find((s) => s.letter === 'ь');
    expect(sign.type).toBe('silent');
    expect(sign.ipa).toBe(null);
  });

  it('١٩ · و«ъ» فاصلٌ لا صوتَ له', () => {
    const one = analyzePronunciation('объе́кт');
    const sign = one.lexical.sounds.find((s) => s.letter === 'ъ');
    expect(sign.type).toBe('silent');
  });

  it('٢٠ · واختزالُ متعدّد المقاطع بدرجتين مختلفتين', () => {
    const one = analyzePronunciation('молоко́');
    const vowels = one.lexical.sounds.filter((s) => s.type === 'vowel');
    expect(vowels.map((v) => v.ipa)).toEqual(['ə', 'ɐ', 'o']);
  });

  it('٢١ · والبُعدُ عن النبر يُقال بموضعه لا بدرجته وحدَها', () => {
    const said = explanations(analyzePronunciation('молоко́').lexical);
    expect(said.includes('قبل المقطع المنبور على طول')).toBe(true);
    expect(said.includes('قبل النبر بأكتر من مقطع')).toBe(true);
  });

  it('٢٢ · وحدُّ العبارة يُقرأ من الجملة الحقيقيّة', () => {
    const words = analyzeSentencePronunciation(SENTENCE);
    const after = words.find((w) => w.orthography === 'счита́ю,');
    expect(after.context.boundary.kind).toBe(BOUNDARY.CLAUSE);
  });

  it('٢٣ · والكلمةُ نفسُها منفردةً وداخل الجملة قابلتان للمقارنة', () => {
    const words = analyzeSentencePronunciation(SENTENCE);
    const inSentence = words.find((w) => w.orthography === 'име́ет');
    const alone = analyzePronunciation('име́ет');
    expect(inSentence.lexical.ipa).toBe(alone.lexical.ipa);
    expect(inSentence.context.ipa).toBe('ɪˈmʲejɪd');
  });

  it('٢٤ · والمتجانِسةُ تُعلَن ولا تُحسَم عشوائيًّا', () => {
    const one = analyzePronunciation('замок');
    expect(one.stress.confidence.level === 'unknown' || one.stress.ambiguous === true).toBe(true);
  });

  it('٢٥ · وكلمةٌ بلا مدخَلٍ معجميٍّ لا تُخترَع لها قيمة', () => {
    /*
     * ⚠️ **ومتعدّدةُ المقاطع عمدًا.** جرّبتُ أوّلًا كلمةً بحرف علّةٍ
     *    واحد، فخرج النبرُ `KNOWN` — وهو **صواب**: قاعدةُ «حرفُ علّةٍ
     *    واحدٌ فالنبرُ عليه» لا تحتاج معجمًا. فالحالةُ التي تختبر
     *    «لا نخترع» هي متعدّدةُ المقاطع بلا مصدر.
     */
    const one = analyzePronunciation('жырблохант');
    expect(one.stress.status).toBe('UNKNOWN');
    expect(one.lexical.ipa).toBe(null);
    expect(one.lexical.confidence.level).toBe('partial');
  });

  it('٢٦ · وثقةٌ منخفضةٌ تُقال ولا تُخفى', () => {
    const one = analyzePronunciation('к', { nextWord: 'де́лу' });
    expect(one.context.confidence.label).toBe('مبدئيّة');
    const rule = one.context.appliedRules[0];
    expect(rule.confidence).toBe('مبدئيّة');
    expect(rule.status).toBe('PROVISIONAL');
  });
});

/* ================================================================== *
 * ٤) تماسكُ التمثيل وطبقةُ التحقّق — §47 و§48 و§60
 * ================================================================== */

describe('WS-N · طبقةُ التحقّق: لا تناقضَ يصل إلى الشاشة', () => {
  const WORDS = ['име́ет', 'молоко́', 'сло́во', 'нож', 'дру́г', 'ле́с', 'мя́со',
    'пи́сьмо', 'объе́кт', 'жена́', 'докуме́нт', 'большо́е', 'значе́ние'];

  it('ع١ · كلُّ كلمةٍ في المصفوفة تمرّ التحقّقَ سليمة', () => {
    const broken = WORDS
      .map((w) => ({ w, v: analyzePronunciation(w).validation }))
      .filter((row) => !row.v.ok)
      .map((row) => `${row.w}: ${JSON.stringify(row.v.issues)}`);
    expect(broken).toEqual([]);
  });

  it('ع٢ · وكذلك مع جارٍ مجهورٍ ومهموسٍ ورنّانٍ وحركة', () => {
    const broken = [];
    for (const w of WORDS) {
      for (const next of ['большо́е', 'сто́л', 'мо́й', 'а́вгуст', 'все']) {
        const one = analyzePronunciation(w, { nextWord: next });
        if (!one.validation.ok) broken.push(`${w}+${next}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('ع٣ · والمقاطعُ تُغطّي الكلمة، والـIPA يساوي أصواتَه', () => {
    for (const w of WORDS) {
      const one = analyzePronunciation(w);
      if (!one.syllables.length) continue;
      expect(one.syllables.join('')).toBe(one.rewritten);
      if (!one.lexical.ipa) continue;
      const fromSounds = one.lexical.sounds
        .filter((s) => s.type !== 'silent' && s.ipa).map((s) => s.ipa).join('');
      expect(one.lexical.ipa.split('ˈ').join('').split('ː').join(''))
        .toBe(fromSounds.split('ː').join(''));
    }
  });

  it('ع٤ · ولا قاعدةَ عابرةَ للحدّ في الطبقة المعجميّة أبدًا', () => {
    const leaks = [];
    for (const w of WORDS) {
      for (const next of [null, 'большо́е', 'сто́л', 'все']) {
        const one = analyzePronunciation(w, { nextWord: next });
        for (const rule of one.lexical.appliedRules) {
          if (rule.scope === SCOPE.CONNECTED_SPEECH) leaks.push(`${w}:${rule.ruleId}`);
        }
        if (one.lexical.sounds.some((s) => s.crossWord)) leaks.push(`${w}:crossWord`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('ع٥ · وقواعدُ السياق كلُّها عابرةٌ للحدّ ومُطلِقُها الكلمةُ التالية', () => {
    const bad = [];
    for (const w of WORDS) {
      const one = analyzePronunciation(w, { nextWord: 'большо́е' });
      for (const rule of one.context.appliedRules) {
        if (rule.scope !== SCOPE.CONNECTED_SPEECH) bad.push(rule.ruleId);
        for (const step of rule.instances) {
          if (step.trigger.side !== 'nextWord') bad.push(`${rule.ruleId}:side`);
          if (step.trigger.grapheme !== 'б') bad.push(`${rule.ruleId}:${step.trigger.grapheme}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('ع٦ · والمتوقَّعُ موسومٌ متوقَّعًا لا مرصودًا (§5 و§38)', () => {
    const one = analyzePronunciation('име́ет', { nextWord: 'большо́е' });
    expect(one.context.predicted).toBe(true);
    expect(one.context.observed).toBe(false);
    expect(Object.hasOwn(one.context, 'observedAudioSegments')).toBe(false);
  });
});

/* ================================================================== *
 * ٥) التقريبُ العربيُّ من الصوت لا الإملاء — §23
 * ================================================================== */

describe('WS-N · تقريبٌ للأذن العربيّة، أو صمتٌ معلَّل', () => {
  it('ف١ · يُبنى من الأصوات: «молоко» ليست «مولوكو»', () => {
    const ear = analyzePronunciation('молоко́').arabicEar;
    expect(ear.available).toBe(true);
    expect(ear.text.includes('مولوكو')).toBe(false);
    expect(ear.syllables).toHaveLength(3);
  });

  it('ف٢ · وله مقاطعُ مفصولةٌ ونبرٌ معلوم', () => {
    const ear = analyzePronunciation('име́ет').arabicEar;
    expect(ear.syllables).toHaveLength(3);
    expect(ear.stressedIndex).toBe(1);
    expect(ear.text.includes(' · ')).toBe(true);
  });

  it('ف٣ · ويُحجَب حين تكون الكتابةُ العربيّةُ ستُعلّم صوتًا خطأً', () => {
    /* ⚠️ «ы» [ɨ] لا مقابلَ له؛ وكتابتُه «ي» تُعلّم «и» — وهو صوتٌ آخر. */
    const ear = analyzePronunciation('ты́').arabicEar;
    expect(ear.available).toBe(false);
    expect(ear.reason.includes('ɨ')).toBe(true);
  });

  it('ف٤ · ولا تقريبَ حين لا يكون التحليلُ نفسُه مكتملًا', () => {
    const ear = arabicEar(analyzeWord('фырщблг'));
    expect(ear.available).toBe(false);
    expect(String(ear.reason).length > 5).toBe(true);
  });

  it('ف٥ · والاختزالُ يُكتَب حركةً قصيرةً ومعه تحفّظُه', () => {
    const ear = analyzePronunciation('сло́во').arabicEar;
    expect(ear.available).toBe(true);
    expect(ear.notes.join(' ').includes('أخفت')).toBe(true);
  });
});

/* ================================================================== *
 * ٦) الإصدارُ والترقيةُ الآمنة — §49 و§50 و§75 و§76
 * ================================================================== */

describe('WS-N · إصدارُ التحليل: ترقيةٌ كسولةٌ بلا فقدِ بيانات', () => {
  it('ص١ · لكلّ تحليلٍ إصدارُ بنيةٍ إلى جانب إصدار القواعد', () => {
    const one = analyzePronunciation('име́ет');
    expect(one.analysisVersion).toBe(PRONUNCIATION_ANALYSIS_VERSION);
    expect(typeof one.rulesetVersion).toBe('string');
    expect(one.analysisVersion === one.rulesetVersion).toBe(false);
  });

  it('ص٢ · والبياناتُ المحفوظةُ تحمل الإصدارَين', () => {
    const meta = pronunciationMetadata(analyzeWord('име́ет'));
    expect(meta.analysisVersion).toBe(PRONUNCIATION_ANALYSIS_VERSION);
    expect(isStale(meta)).toBe(false);
  });

  it('ص٣ · وصفٌّ قديمٌ بلا هذا الحقل «متقادمٌ» لا «تالف»', () => {
    const legacy = { ...pronunciationMetadata(analyzeWord('име́ет')) };
    delete legacy.analysisVersion;
    expect(isStale(legacy)).toBe(true);
    /* ⚠️ **ولا يُحذَف الصفُّ**: كلُّ حقوله الأخرى تبقى قابلةً للقراءة. */
    expect(legacy.normalizedWord).toBe('имеет');
    expect(Array.isArray(legacy.ruleIds)).toBe(true);
  });

  it('ص٤ · وإعادةُ الحساب لا تغيّر هُويّةَ الكلمة (§75)', () => {
    const before = pronunciationMetadata(analyzeWord('име́ет'));
    const after = pronunciationMetadata(analyzeWord('име́ет'));
    expect(after.normalizedWord).toBe(before.normalizedWord);
    expect(after.stressOrdinal).toBe(before.stressOrdinal);
  });
});

/* ================================================================== *
 * ٧) حرّاسٌ بنيويّون — §55 و§80 (يقيسون كودًا لا نصًّا)
 * ================================================================== */

describe('WS-N · الحرّاسُ البنيويّون', () => {
  it('ق١ · ولا استثناءَ في الكود باسم كلمةٍ بعينها', async () => {
    const files = [
      '/js/services/pronunciation/analysis.js',
      '/js/services/pronunciation/engine.js',
      '/js/services/pronunciation/arabic-ear.js',
      '/js/services/pronunciation/rules/voicing.js',
      '/js/services/pronunciation/rules/reduction.js',
      '/js/services/pronunciation/rules/hardness.js',
    ];
    const guilty = [];
    for (const path of files) {
      const code = codeOnly(await source(path));
      /* الكلمةُ الروسيّةُ داخل مقارنةٍ أو مفتاحٍ — لا داخل شرح. */
      if (/имеет|име́ет/.test(code)) guilty.push(path);
    }
    expect(guilty).toEqual([]);
  });

  it('ق٢ · وطبقةُ التحليل لا تُنشئ مشغّلَ صوتٍ ثانيًا (§29)', async () => {
    const code = codeOnly(await source('/js/services/pronunciation/analysis.js'));
    expect(/new Audio|speechSynthesis|SpeechSynthesisUtterance|createBufferSource/.test(code))
      .toBe(false);
  });

  it('ق٣ · ولا تلمس تسجيلًا ولا وسائطَ ولا قاعدةَ بيانات (§30 و§0)', async () => {
    const code = codeOnly(await source('/js/services/pronunciation/analysis.js'));
    expect(/MediaRecorder|getUserMedia|practiceEvidence|indexedDB|savedItems/.test(code))
      .toBe(false);
  });

  it('ق٤ · ولا يعود المُقلِّبُ المنزوعُ من باب النطق (§24)', async () => {
    const code = codeOnly(await source('/js/views/shadow-view.js'));
    /*
     * ⚠️ **والمنزوعُ هو صفُّ «SOURCE • SHADOWING» داخل سطح القراءة —
     *    لا كلمةُ SHADOWING أينما وقعت.**
     *
     *    كتبتُ الحارسَ أوّلًا يمنع النصَّ في الملفّ كلِّه، فسقط على
     *    شعار التطبيق في الترويسة وعلى تبويب التنقّل — وكلاهما بريء.
     *    حارسٌ يسقط على البريء يُدرَّب المرءُ على تجاهله، فيصمت يومَ
     *    يكون محقًّا. فالنصُّ يحرسه اختبارا WS-M «أ» و«ب» بنطاقهما
     *    الصحيح، وهذا يحرس **بنيةَ** المُقلِّب: صنفَه ومُرسِلَه.
     */
    expect(code.includes('sh-pager')).toBe(false);
    expect(code.includes('page-go')).toBe(false);
    expect(code.includes('wirePager')).toBe(false);
  });

  it('ق٥ · وصفحةُ النطق تقرأ الطبقتين ولا تنادي المحرّكَ بجارٍ', async () => {
    const code = codeOnly(await source('/js/views/shadow-view.js'));
    expect(code.includes('analyzePronunciation(')).toBe(true);
    /*
     * ⚠️ **والخطرُ الذي يحرسه هذا السطر**: أن يعود أحدٌ فينادي
     *    `analyzeWord` ومعه `nextWord` في ملفّ العرض، فتُدمَج الطبقتان
     *    من جديد بلا أن يُخطئ سطرٌ واحدٌ في المحرّك.
     */
    expect(/analyzeWord\([^)]*nextWord/.test(code)).toBe(false);
  });

  it('ق٦ · وكلُّ قاعدةٍ في السجلّ لها نطاقٌ معلوم', () => {
    const bad = allRuleIds()
      .map((id) => ruleById(id))
      .filter((rule) => !rule.scope || !Object.values(SCOPE).includes(rule.scope))
      .map((rule) => rule.id);
    expect(bad).toEqual([]);
  });

  it('ق٧ · وقاعدةُ الرنّانات الواسعةُ لم تعُد موجودة', () => {
    expect(allRuleIds()).toContain('RU_SONORANT_KEEPS_VOICE');
    expect(allRuleIds()).toContain('RU_SONORANT_NO_TRIGGER');
    expect(allRuleIds().includes('RU_VOICING_SONORANT_NEUTRAL')).toBe(false);
  });
});

/* ================================================================== *
 * ٨) ما كشفه الفحصُ الحيُّ وحدَه — §66
 * ================================================================== */

/**
 * ⚠️ **اختباران وُلدا من النظر لا من التفكير.**
 *
 * كلاهما مرّ من ١٩٩٦ اختبارًا خضراء، ولم يظهر إلّا حين فُتحت الصفحةُ
 * في متصفّحٍ حقيقيّ وقُرئ ما رُسم فيها حرفًا حرفًا.
 */
describe('WS-N · عطبان كشفهما الفحصُ الحيّ', () => {
  it('ر١ · نبرٌ مكتوبٌ في النصّ لا يُضاف إليه نبرٌ ثانٍ', async () => {
    const { stressOf, markSentence } = await import('../js/services/shadow/stress.js');
    const acutes = (s) => [...String(s)].filter((ch) => ch === '́').length;

    /* ⚠️ **والنبرُ على الحرف الأخير هو الحالةُ التي كانت تنكسر**:
       `име́ет` علامتُها في الوسط فتقع داخل «قلب» الكلمة وتنجو،
       و`молоко́` علامتُها في الآخر فكانت تُعَدّ ترقيمًا حولها. */
    expect(acutes(stressOf('молоко́'))).toBe(1);
    expect(acutes(stressOf('име́ет'))).toBe(1);
    expect(acutes(markSentence('а молоко́ в').html)).toBe(1);
    /* والترقيمُ يبقى ترقيمًا: «счита́ю,» تحتفظ بفاصلتها خارج القلب. */
    expect(markSentence('счита́ю,').html.endsWith(',')).toBe(true);
    expect(acutes(markSentence('счита́ю,').html)).toBe(1);
  });

  it('ر٢ · وكلمةٌ بلا حرف علّة لا يُقال لها «المقطع ٠ من ٠»', async () => {
    const one = analyzePronunciation('к', { nextWord: 'де́лу' });
    expect(one.syllabic).toBe(false);
    expect(one.stress.confidence.label.includes('مالهاش حرف علّة')).toBe(true);
    /* التحليلُ سليمٌ: ليست حالةَ عطبٍ بل حالةَ لغة. */
    expect(one.validation.ok).toBe(true);
    /* والتغيّرُ في السياق يبقى صحيحًا رغم أن لا نطقَ منفردًا لها. */
    expect(one.context.changes[0].toIpa).toBe('ɡ');

    const code = codeOnly(await source('/js/views/shadow-view.js'));
    /* ⚠️ **ولا «تدريب نطق» لها** (§27): `к` وحدَها في مُركِّب الكلام
       تُخرج اسمَ الحرف أو صمتًا — ادّعاءُ صوتٍ لا يقوله أحد. */
    expect(/const drill = !map\.playback \|\| !bundle\.syllabic/.test(code)).toBe(true);
    expect(code.includes('مالهاش نطق منفرد')).toBe(true);
  });
});

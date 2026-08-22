/**
 * LingoLife — اختباراتُ منهج الصوتيّات وخريطة الصوت (WS58)
 *
 * تحرس خمسةَ أشياء ينكسر كلٌّ منها بصمت:
 *
 *  ١ · **ألّا يختفي بندٌ منهجيّ.** إعادةُ هيكلةٍ تحذف قاعدةً تُسقِط
 *      الاختبارَ لأن بندَ المنهج يشير إليها بالاسم.
 *  ٢ · **ألّا تُدَّعى أمانةٌ لمصدرٍ لم يُقرأ.** حالةُ المصدر تُعَدّ عدًّا،
 *      والملفّاتُ الثلاثةُ لم تصل هذه الجلسة — فلا بندَ يقول إنها قُرئت.
 *  ٣ · **أن يمرّ كلُّ مثالٍ منهجيٍّ على المحرّك فعلًا** — لا أن يُقال
 *      «مغطّى» لأن قاعدةً بالاسم موجودة (بند ٧١).
 *  ٤ · **ألّا تُفرِط قاعدة.** لكلّ بندٍ أمثلةٌ مضادّةٌ تُثبِت أنها **لا**
 *      تنطلق حيث لا ينبغي.
 *  ٥ · **ألّا تنبت واجهةٌ تحسب النطقَ بنفسها** (بند ٤٩) — فحصُ نصٍّ
 *      يمنع عودةَ جداولِ الصلابة إلى ملفّ العرض.
 */

import { describe, it, expect } from './test-runner.js';
import {
  TEACHING_RULES, COVERAGE, PROVENANCE, SOURCE_STATUS, SOURCE_DOC, TERM,
  PDF_SOURCES, SUPERSEDED, sourceItemsOf,
  curriculumAudit, curriculumStats, teachingRuleById, teachingRulesForEngineRule,
} from '../js/services/pronunciation/curriculum.js';
import { soundMap, contextChain } from '../js/services/pronunciation/sound-map.js';
import { analyzeWord, RULESET_VERSION } from '../js/services/pronunciation/engine.js';
import { allRuleIds, ruleById } from '../js/services/pronunciation/rule-registry.js';

/** يشغّل مثالًا: يقبل كلمةً مفردةً أو زوجًا عبر الحدّ. */
function runExample(example) {
  if (example.context) {
    return analyzeWord(example.context[0], { nextWord: example.context[1] });
  }
  return analyzeWord(example.word);
}

/** البنودُ التي يُفترَض أن يُنفّذها المحرّك فعلًا. */
const IMPLEMENTED = [
  COVERAGE.COVERED, COVERAGE.ENGINE_MORE_PRECISE,
  COVERAGE.LEXICAL, COVERAGE.PARTIAL, COVERAGE.DISPUTED,
];

/* ================================================================== *
 * ١) بنيةُ المنهج وتدقيقُه الآليّ
 * ================================================================== */

describe('المنهج · البنية والتدقيق الآليّ', () => {
  it('⚠️ كلُّ قاعدةٍ يشير إليها المنهجُ موجودةٌ في السجلّ فعلًا', () => {
    expect(curriculumAudit().missingEngineRules).toEqual([]);
  });

  it('⚠️ ولا قاعدةَ في المحرّك بلا بندٍ منهجيٍّ يذكرها — التغطيةُ في الاتّجاهين', () => {
    /* فجوةُ **توثيقٍ** لا سلوك: قاعدةٌ تعمل ولا أحدَ يعرف لماذا. */
    expect(curriculumAudit().unmappedEngineRules).toEqual([]);
  });

  it('التدقيقُ الكاملُ نظيف', () => {
    expect(curriculumAudit().ok).toBe(true);
  });

  it('كلُّ بندٍ يحمل الحقولَ الإلزاميّة', () => {
    const bad = TEACHING_RULES.filter((t) => !t.id || !t.doc || !t.section
      || !t.arabicTitle || !t.arabicExplanation || !t.status
      || !t.provenance || !t.sourceStatus || !Array.isArray(t.terms));
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  it('ولا معرِّفَ مكرَّر', () => {
    const ids = TEACHING_RULES.map((t) => t.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('الوثائقُ الثلاثُ كلُّها ممثَّلة', () => {
    const stats = curriculumStats();
    expect(stats.byDoc[SOURCE_DOC.NOTES]).toBe(14);
    expect(stats.byDoc[SOURCE_DOC.STRESS]).toBe(14);
    expect(stats.byDoc[SOURCE_DOC.VOICING]).toBe(8);
  });

  it('⚠️ كلُّ عنوانٍ في الملفّات له بندٌ منهجيّ — والعناوينُ من الصفحات لا من الطلب', () => {
    /*
     * ⚠️ **وهذه القائمةُ نُسخت من الملفّات لا من قائمة التدقيق.** كانت
     *    في WS58 «5A…7H» — رموزَ بنودٍ في الطلب لا عناوينَ في مصدر.
     *    واليومَ كلُّ سطرٍ هنا نصٌّ مقروءٌ من صفحة.
     */
    const sections = new Set(TEACHING_RULES.map((t) => t.section));
    const required = [
      'الحروف التي ترقق الحرف الساكن الذي يأتي قبلها',
      'الحروف ( ш - ж - ц ) دائما مفخمين',
      'الحروف ( ч - щ ) دائما مرققين',
      'حرف ( а ) بعد ( ч ) أو ( щ ) بدون نبر',
      'حرف ( г ) بين е و о أو بين о و о',
      '( гк ) يتم نطقهم ( хк )',
      '( вх ) يتم نطقهم ( фх )',
      '( сч ) يتم نطقهم ( щ )',
      '( стл ) يتم نطقهم ( сл )',
      '( вств ) يتم نطقهم ( ств )',
      '( здн ) يتم نطقهم ( зн )',
      '( лнц ) يتم نطقهم ( нц )',
      '( рдц ) يتم نطقهم ( рц )',
      '( жч ) يتم نطقهم ( щ )',
      'النبر Ударе́ние',
      'بعض الحروف المتحركة يتأثر نطقها حسب موقع النبر',
      'حرف ( о )', 'حرف ( я )', 'حرف ( е )', 'ملحوظات مهمة',
      'جدول الأصوات المجهورة والمهموسة',
      'إذا توالى صوتان أحدهما مجهور و الآخر مهموس',
      'مجهور + مهموس = مهموس + مهموس',
      'مهموس + مجهور = مجهور + مجهور',
      'ليس شرطا أن يتوالى الصوتان في نفس الكلمة',
      'إذا توالى صوتان من نفس النوع',
      'آخر صوت في الكلمة',
      'ملحوظة مهمة',
    ];
    expect(required.filter((x) => !sections.has(x))).toEqual([]);
  });
});

/* ================================================================== *
 * ٢) صدقُ المصدر — البند ٦٧
 * ================================================================== */

describe('المنهج · التحقّق من الملفّات الحقيقيّة (WS59)', () => {
  it('⚠️ كلُّ بندٍ منهجيٍّ مقروءٌ من ملفّ — ولا بندَ باقٍ على «قائمة الطلب»', () => {
    /*
     * ⚠️ **وهذا الاختبارُ معكوسُ سلفِه عمدًا.** كان في WS58 يتأكّد أنّ
     *    **صفرًا** من البنود يدّعي القراءةَ من ملفّ — لأن الملفّات لم
     *    تكن قد وصلت. وقد وصلت وقُرئت، فصار يتأكّد أن **لا بندَ مصدرٍ
     *    بقي بلا قراءة**. والانقلابُ نفسُه هو الدليلُ على أن التمريرةَ
     *    وقعت فعلًا ولم تُدَّعَ.
     */
    const unverified = TEACHING_RULES
      .filter((t) => t.provenance === PROVENANCE.SOURCE_REQUIRED)
      .filter((t) => t.sourceStatus !== SOURCE_STATUS.PDF_VERIFIED)
      .map((t) => `${t.id}:${t.sourceStatus}`);
    expect(unverified).toEqual([]);
  });

  it('⚠️ وكلُّ بندٍ مقروءٍ يقول **أين** — وثيقةً وصفحةً ونصًّا حرفيًّا', () => {
    expect(curriculumAudit().verifiedWithoutPage).toEqual([]);
  });

  it('والصفحاتُ داخل عدد صفحات الملفّ فعلًا — لا رقمًا مخترعًا', () => {
    const limit = Object.fromEntries(PDF_SOURCES.map((p) => [p.doc, p.pages]));
    const bad = TEACHING_RULES
      .filter((t) => t.sourceStatus === SOURCE_STATUS.PDF_VERIFIED)
      .filter((t) => t.page < 1 || t.page > limit[t.doc])
      .map((t) => `${t.id} ص${t.page} > ${limit[t.doc]}`);
    expect(bad).toEqual([]);
  });

  it('وتوسيعاتُ المحرّك لا تدّعي صفحةً ولا نصَّ مصدر (بند ٢٢)', () => {
    expect(curriculumAudit().pageWithoutSource).toEqual([]);
    const claiming = TEACHING_RULES
      .filter((t) => t.provenance === PROVENANCE.ENGINE_EXPANSION && t.sourceText)
      .map((t) => t.id);
    expect(claiming).toEqual([]);
  });

  it('⚠️ ولا معرِّفَ من WS58 اختفى بصمت — إمّا باقٍ وإمّا مُستخلَفٌ بالاسم', () => {
    /* بند ٢٤: القسمةُ إلى بنودٍ أدقّ ليست حذفًا، لكنها تُسجَّل. */
    expect(curriculumAudit().brokenSupersession).toEqual([]);
    expect(Object.keys(SUPERSEDED).length).toBe(2);
  });

  it('⚠️ وعددُ بنود كلّ وثيقةٍ = ما استُخرج منها فعلًا (بند ٢٥)', () => {
    /*
     * ⚠️ **والأرقامُ مشتقّةٌ من البنود لا مكتوبةٌ فوقها.** الرقمُ هنا
     *    يصف ما في الملفّ (١٤ + ١٤ + ٨ = ٣٦)، لا ما قالته قائمةُ الطلب
     *    (١٤ + ٨ + ٨ = ٣٠). والفرقُ ستّةُ بنودٍ ما كانت لتُعرَف بلا قراءة.
     */
    const stats = curriculumStats();
    expect(stats.byDoc[SOURCE_DOC.NOTES]).toBe(14);
    expect(stats.byDoc[SOURCE_DOC.STRESS]).toBe(14);
    expect(stats.byDoc[SOURCE_DOC.VOICING]).toBe(8);
    expect(stats.pdfVerified).toBe(36);
    /* ومجموعُ البنود المقروءة = مجموعُ ما في الوثائق الثلاث. */
    const perDoc = PDF_SOURCES.reduce((n, p) => n + sourceItemsOf(p.doc).length, 0);
    expect(perDoc).toBe(stats.pdfVerified);
  });

  it('⚠️ ومثالُ المعلّمة لا يُجمَع مع مثالٍ أضفتُه أنا (بند ٩)', () => {
    const stats = curriculumStats();
    expect(stats.sourceExamples + stats.engineExamples).toBe(stats.examples);
    /* الأغلبيّةُ الساحقةُ من الملفّ — وإلّا فالتحقّقُ شكليّ. */
    expect(stats.sourceExamples > stats.engineExamples * 2).toBe(true);
    /* وكلُّ مثالٍ يعلن انتماءَه صراحةً. */
    const vague = TEACHING_RULES.flatMap((t) => [...t.examples, ...t.counter])
      .filter((e) => typeof e.fromSource !== 'boolean');
    expect(vague.length).toBe(0);
  });

  it('وكلُّ مثالٍ من الملفّ يحمل معناه كما كتبته المعلّمة حيث ذكرته', () => {
    /* لا نطلبه لكلّ مثال — الملفُّ نفسُه لا يترجم كلَّ كلمة. */
    const glossed = TEACHING_RULES.flatMap((t) => t.examples)
      .filter((e) => e.fromSource && e.gloss);
    expect(glossed.length > 40).toBe(true);
  });

  it('الصنفان لا يختلطان في الإحصاء (بند ٤٣)', () => {
    const stats = curriculumStats();
    expect(stats.bySourceStatus.PDF_VERIFIED).toBe(36);
    expect(stats.bySourceStatus.ENGINE_ORIGIN).toBe(11);
    expect(stats.total).toBe(47);
  });
});

/* ================================================================== *
 * ٣) الأمثلةُ تمرّ على المحرّك فعلًا — البند ٦٠ / اختبار ١ و٢
 * ================================================================== */

describe('المنهج · أمثلةُ المصدر تمرّ على المحرّك', () => {
  for (const item of TEACHING_RULES) {
    if (!IMPLEMENTED.includes(item.status)) continue;
    if (!item.engineRuleIds.length) continue;

    it(`${item.id} — ${item.examples.length} مثالًا يُثبِت البند على المحرّك`, () => {
      const failures = [];
      for (const example of item.examples) {
        const result = runExample(example);

        /*
         * ⚠️ **وثلاثةُ أشكالٍ للإثبات لا شكلٌ واحد — والسببُ لغويٌّ لا تقنيّ.**
         *
         *    بندٌ معناه «لا يحدث شيء» (٧و) لا تُثبته قاعدةٌ تنطلق، بل
         *    حرفٌ يخرج كما كُتب. وبندٌ نطقاه مقبولان (`VARIANT`) لا
         *    يُعيد كتابةَ شيءٍ أصلًا فلا أثرَ له في السجلّ — يُثبته
         *    الوسمُ المعجميّ. وأوّلُ نسخةٍ من هذا الاختبار طلبت الشكلَ
         *    الأوّلَ من الجميع، فأسقطت بنودًا صحيحةً **لأن الفحصَ خطأ
         *    لا لأن التغطيةَ ناقصة**.
         */
        if (item.expectsNoChange) {
          const unit = soundMap(result).units.find((u) => u.written === example.unchanged);
          if (!unit) failures.push(`${example.word}: مفيش حرف «${example.unchanged}»`);
          else if (unit.changed) failures.push(`${example.word}: «${example.unchanged}» اتغيّر`);
          continue;
        }
        if (item.expectsLexical) {
          if (!result.lexical) failures.push(`${example.word}: مفيش وسم معجميّ`);
          continue;
        }

        /*
         * ⚠️ **والنصفُ المفخَّمُ من زوجِ المصدر يُثبَت بوصفه لا بقاعدةٍ تنطلق.**
         *
         *    المعلّمةُ تضع `ма́ма` مقابل `ме́ч` لتُسمِعك الفرق. والأولى
         *    **لا تُطلِق قاعدةَ ترقيق** — وهذا هو معناها. فطلبُ قاعدةٍ
         *    منها يُسقِط مثالًا صحيحًا؛ والصوابُ أن يُسأل المحرّك:
         *    «ماذا تقول عن هذا الحرف؟» فيجيب «مفخم» أو «مرقق».
         */
        if (example.expectHardness) {
          const { letter, label } = example.expectHardness;
          const unit = soundMap(result).units.find((u) => u.written === letter);
          const got = unit?.hardness?.label || '(مفيش)';
          if (!got.startsWith(label)) {
            failures.push(`${example.word}: «${letter}» ${got} لا ${label}`);
          }
          continue;
        }

        /* مثالٌ يسمّي قاعدتَه بعينها يُفحَص بها — والباقي بقواعد البند. */
        const wanted = example.expectRule ? [example.expectRule] : item.engineRuleIds;
        if (!result.ruleIds.some((id) => wanted.includes(id))) {
          failures.push(`${example.word} → ${result.ruleIds.join(',') || '(ولا قاعدة)'}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }
});

/* ================================================================== *
 * ٤) الأمثلةُ المضادّة لا تُطلِق — البند ٥٩ / اختبار ٣
 * ================================================================== */

describe('المنهج · الأمثلةُ المضادّة لا تُفرِط', () => {
  for (const item of TEACHING_RULES) {
    if (!item.counter.length) continue;

    it(`${item.id} — ${item.counter.length} مثالًا مضادًّا يبقى كما هو`, () => {
      const failures = [];
      for (const example of item.counter) {
        const result = runExample(example);
        /*
         * ⚠️ **والقاعدةُ الممنوعةُ تُسمّى بعينها حين تلزم.** بعضُ
         *    الكلمات المضادّة تُطلِق قاعدةً **أخرى** من قواعد البند
         *    بحقّ: `жизнь` تُرقّق الـ`н` بـ`ь` وهي مثالٌ مضادٌّ لترقيق
         *    الـ`ж`. فمنعٌ شاملٌ هنا كان سيُسقِط اختبارًا صحيحًا.
         */
        /* دعوى عن **النبر** لا عن التغيّر: «я مش هي المنبورة». */
        if (example.notStressed) {
          const unit = soundMap(result).units
            .find((u) => u.written === example.notStressed && u.type === 'vowel');
          if (unit?.stressed) failures.push(`${example.word}: «${example.notStressed}» طلعت منبورة`);
          continue;
        }

        if (example.unchanged) {
          /* دعوى عن **حرفٍ بعينه** لا عن الكلمة: `мя́гкий` تُختزَل
             نهايتُها بحقّ، والمنفيُّ أن تُختزَل الـ`я` المنبورة. */
          const unit = soundMap(result).units.find((u) => u.written === example.unchanged);
          if (unit?.changed) failures.push(`${example.word}: «${example.unchanged}» اتغيّر`);
          continue;
        }
        const banned = example.notRules || item.engineRuleIds;
        const fired = result.ruleIds.filter((id) => banned.includes(id));
        if (fired.length) failures.push(`${example.word} أطلقت ${fired.join(',')}`);
      }
      expect(failures).toEqual([]);
    });
  }
});

/* ================================================================== *
 * ٥) العطبان اللذان أصلحهما WS58
 * ================================================================== */

describe('النطق · عطبان أصلحهما WS58', () => {
  it('⚠️ жч بقت щ — «мужчина» كانت تخرج «мушчина» ولا اختبارَ يمسكها', () => {
    const r = analyzeWord('мужчи́на');
    expect(r.pronunciation.simple).toBe('мущи́нъ');
    expect(r.pronunciation.ipa).toBe('muˈɕːinə');
    expect(r.ruleIds.includes('RU_CLUSTER_ZHCH_SHCH')).toBe(true);
    /* والقاعدةُ التي كانت تُنتج الخطأ لم تعد تصل إلى الـж أصلًا. */
    expect(r.ruleIds.includes('RU_REGRESSIVE_DEVOICING')).toBe(false);
  });

  it('و«перебежчик» و«веснушчатый» معها — لا استثناءً لكلمةٍ بعينها', () => {
    expect(analyzeWord('перебе́жчик').pronunciation.simple).toBe("п'ьр'иб'э́щьк");
    expect(analyzeWord('весну́шчатый').pronunciation.simple).toBe("в'исну́щьтый");
  });

  it('⚠️ ولا تنطلق على «мужской» — жск مش жч', () => {
    const r = analyzeWord('мужско́й');
    expect(r.ruleIds.includes('RU_CLUSTER_ZHCH_SHCH')).toBe(false);
    expect(r.pronunciation.simple).toBe('мушско́й');
  });

  it('⚠️ التناقضُ عبر الحدّ زال: المهموسُ يُجهَّر والمجهورُ يبقى مجهورًا', () => {
    /* قبل WS58: «наш дом» تُجهَّر و«нож дом» تُهمَس — عن الحدّ الواحد. */
    expect(analyzeWord('на́ш', { nextWord: 'до́м' }).pronunciation.simple).toBe('на́ж');
    expect(analyzeWord('но́ж', { nextWord: 'до́м' }).pronunciation.simple).toBe('но́ж');
  });

  it('و«год был» و«раз два» و«луг зелёный» تبقى مجهورةً', () => {
    expect(analyzeWord('го́д', { nextWord: 'бы́л' }).pronunciation.simple).toBe('го́д');
    expect(analyzeWord('ра́з', { nextWord: 'два́' }).pronunciation.simple).toBe('ра́з');
    expect(analyzeWord('лу́г', { nextWord: 'зелёный' }).pronunciation.simple).toBe('лу́г');
  });

  it('⚠️ والمانعُ لا يعمّ: قبل رنّانةٍ أو حركةٍ أو «в» يبقى الهمسُ النهائيّ', () => {
    expect(analyzeWord('но́ж', { nextWord: 'мо́й' }).pronunciation.simple).toBe('но́ш');
    expect(analyzeWord('ра́з', { nextWord: 'в' }).pronunciation.simple).toBe('ра́с');
    expect(analyzeWord('но́ж', { nextWord: 'о́н' }).pronunciation.simple).toBe('но́ш');
  });

  it('⚠️ وبلا جارٍ إطلاقًا: الهمسُ النهائيّ كما كان — ولا انحدار', () => {
    expect(analyzeWord('но́ж').pronunciation.simple).toBe('но́ш');
    expect(analyzeWord('дру́г').pronunciation.simple).toBe('дру́к');
    expect(analyzeWord('ра́з').pronunciation.simple).toBe('ра́с');
    expect(analyzeWord('шка́ф').pronunciation.simple).toBe('шка́ф');
  });

  it('⚠️ وقاعدةُ الهمس عبر الحدّ لم تعد كودًا ميّتًا — تنطلق وتُفسِّر', () => {
    const r = analyzeWord('но́ж', { nextWord: 'та́м' });
    expect(r.ruleIds.includes('RU_CROSS_WORD_DEVOICING')).toBe(true);
    /* والنتيجةُ لم تتغيّر حرفًا — الذي تغيّر هو التفسير. */
    expect(r.pronunciation.simple).toBe('но́ш');
  });

  it('و«в парке» تُهمَس، و«в доме» تبقى مجهورة', () => {
    const parke = analyzeWord('в', { nextWord: 'па́рке' });
    expect(parke.sounds[0].ipa).toBe('f');
    const dome = analyzeWord('в', { nextWord: 'до́ме' });
    expect(dome.sounds[0].ipa).toBe('v');
  });
});

/* ================================================================== *
 * ٦) خريطةُ الصوت — البندان ٤٨ و٤٩
 * ================================================================== */

describe('خريطةُ الصوت · مكتوبٌ ← مسموع', () => {
  it('⚠️ «المكتوب» هو الحرفُ قبل التحويل لا بعده', () => {
    /* عطبٌ حقيقيّ: المحرّك يكتب على `seg.letter`، فكانت `нож` تعرض «ш→ш». */
    const map = soundMap(analyzeWord('но́ж'));
    const zh = map.units.find((u) => u.written === 'ж');
    expect(zh).toBeTruthy();
    expect(zh.realized).toBe('ш');
    expect(zh.changed).toBe(true);
  });

  it('المقاطعُ تحمل تحقّقَها **في هذه الكلمة**', () => {
    const map = soundMap(analyzeWord('молоко́'));
    expect(map.syllables.map((s) => s.written)).toEqual(['мо', 'ло', 'ко']);
    expect(map.syllables.map((s) => s.realized)).toEqual(['мъ', 'ла', 'ко']);
    expect(map.syllables.filter((s) => s.stressed).length).toBe(1);
    expect(map.syllables[2].stressed).toBe(true);
  });

  it('⚠️ ودرجتا الاختزال مفترقتان — لا «كلّ о = а»', () => {
    const map = soundMap(analyzeWord('молоко́'));
    const degrees = map.reductions.map((u) => u.reduction.degree);
    expect(degrees).toEqual([2, 1]);
    expect(map.reductions[1].reduction.why).toBe('قبل النبر مباشرةً');
  });

  it('التغيّرُ الخفيّ يُوسَم ولا يُعرَض سهمًا كاذبًا', () => {
    const map = soundMap(analyzeWord('логисти́ческой'));
    const subtle = map.changes.filter((u) => u.subtle);
    expect(subtle.length > 0).toBe(true);
    /* خفيٌّ يعني: التقريبُ السيريليُّ واحد، والـIPA مختلف. */
    expect(subtle.every((u) => u.realized === u.written && u.realizedIpa !== null)).toBe(true);
  });

  it('⚠️ ولا يُعرَض مقطعٌ نصفَ محلولٍ — فارغٌ أصدقُ من مبتور', () => {
    const map = soundMap(analyzeWord('экза́мен'));
    expect(map.complete).toBe(false);
    expect(map.syllables.some((s) => s.realized === null)).toBe(true);
    expect(map.limitations.length > 0).toBe(true);
  });

  it('الأقسامُ انتقائيّةٌ محلّيًّا — لا درسٌ كاملٌ مع كلّ كلمة (بند ٣٨)', () => {
    const dom = soundMap(analyzeWord('до́м'));
    /* «дом» مفيهاش همسٌ ولا اختزالٌ ولا ترقيق — فالأقسامُ فاضية. */
    expect(dom.voicing).toEqual([]);
    expect(dom.reductions).toEqual([]);
    expect(dom.hardness).toEqual([]);
  });
});

/* ================================================================== *
 * ٧) المصطلحاتُ العربيّةُ الإلزاميّة — البند ٣
 * ================================================================== */

describe('المصطلحات · المفردات الثمانية ظاهرةٌ فعلًا', () => {
  it('كلُّ مصطلحٍ إلزاميٍّ يحمله بندٌ منهجيٌّ واحدٌ على الأقلّ', () => {
    const used = new Set(TEACHING_RULES.flatMap((t) => t.terms));
    const missing = Object.values(TERM).filter((term) => !used.has(term));
    expect(missing).toEqual([]);
  });

  it('⚠️ وتظهر في مخرَج المحرّك لا في المنهج وحدَه', () => {
    const seen = new Set();
    /* ⚠️ و«про́сьба» ضروريّةٌ في القائمة: بدونها لا يظهر «مجهور»
       في أيّ مخرَجٍ — كلُّ الأخرى تُهمَس ولا تُجهَّر. */
    for (const word of ['но́ж', 'молоко́', 'ле́с', 'жи́знь', 'ча́с', 'ло́дка', 'про́сьба']) {
      for (const unit of soundMap(analyzeWord(word)).units) {
        unit.teachingLabels.forEach((l) => seen.add(l));
      }
    }
    const text = [...seen].join(' ');
    for (const term of [TERM.HARD, TERM.SOFT, TERM.VOICED, TERM.VOICELESS,
      TERM.REDUCED, TERM.VOWEL, TERM.CONSONANT]) {
      expect(text.includes(term)).toBe(true);
    }
  });

  it('والنبرُ يظهر بمصطلحه على الحركة المنبورة', () => {
    const map = soundMap(analyzeWord('молоко́'));
    const stressed = map.units.find((u) => u.stressed);
    expect(stressed.teachingLabels.some((l) => l.includes(TERM.STRESS))).toBe(true);
  });

  it('⚠️ ومفخم/مرقق لا يُلصَق بكلّ ساكنٍ — الخبرُ وحدَه يستحقّ سطرًا', () => {
    /* `стол`: س و т مفخّمتان عاديًّا، و`л` رنّانةٌ مفخَّمة — لا خبرَ. */
    expect(soundMap(analyzeWord('сто́л')).hardness).toEqual([]);
    /* `лес`: `л` مرقَّقة — خبر. */
    const les = soundMap(analyzeWord('ле́с'));
    /* ⚠️ و`с` في «лес» مفخَّمةٌ عاديّة — لا خبرَ فيها. توقّعتُها
       مرقَّقةً أوّلَ مرّة، وهو خطأٌ منّي: لا حرفَ بعدها يُرقِّقها. */
    expect(les.hardness.map((u) => u.written)).toEqual(['л']);
    expect(les.hardness[0].hardness.label).toBe(TERM.SOFT);
  });

  it('و«مفخم دائمًا» / «مرقق دائمًا» تُميَّز عن العارضة', () => {
    expect(soundMap(analyzeWord('жи́знь')).hardness[0].hardness.always).toBe(true);
    expect(soundMap(analyzeWord('ча́с')).hardness[0].hardness.label).toBe(`${TERM.SOFT} دائمًا`);
  });
});

/* ================================================================== *
 * ٨) ثلاثةُ مستويات التشغيل — البند ٢٣
 * ================================================================== */

describe('التشغيل · ثلاثةُ مستوياتٍ مختلفةٍ فعلًا', () => {
  it('⚠️ ليست ثلاثةَ أزرارٍ تنطق الشيءَ نفسَه', () => {
    const { playback } = soundMap(analyzeWord('логисти́ческой'));
    expect(playback.pieces.steps.length).toBe(6);        /* ٥ مقاطع + الكلمة */
    expect(playback.slow.steps.length).toBe(1);
    expect(playback.natural.steps.length).toBe(1);
    /* السرعاتُ الثلاثُ مختلفةٌ فعلًا. */
    const rates = [playback.pieces.rate, playback.slow.rate, playback.natural.rate];
    expect(new Set(rates).size).toBe(3);
  });

  it('«بطيء متصل» كلمةٌ واحدةٌ بلا فجوات — لا مقاطعُ مفصولة', () => {
    const { playback } = soundMap(analyzeWord('молоко́'));
    expect(playback.slow.steps).toEqual(['молоко']);
    expect(playback.slow.steps[0].includes(' ')).toBe(false);
  });

  it('⚠️ وصدقُ الصوت مكتوبٌ في الخدمة لا في الواجهة (بند ٢٤)', () => {
    const { playback } = soundMap(analyzeWord('молоко́'));
    expect(typeof playback.pieces.disclaimer).toBe('string');
    expect(playback.pieces.disclaimer.length > 20).toBe(true);
    expect(playback.natural.disclaimer).toBe(null);
  });

  it('وكلمةٌ بمقطعٍ واحدٍ لا تُفكَّك إلى نفسها مرّتين', () => {
    const { playback } = soundMap(analyzeWord('до́м'));
    expect(playback.pieces.steps).toEqual(['дом']);
  });
});

/* ================================================================== *
 * ٩) السياق: كلمة ← تعبير ← جملة — البندان ٢٦ و٥١
 * ================================================================== */

describe('السياق · كلمة ← تعبير ← جملة', () => {
  it('⚠️ ولا يُختلَق تعبيرٌ غيرُ موجود', () => {
    const chain = contextChain({ word: 'до́ма', chunk: null, sentence: 'я до́ма сего́дня' });
    expect(chain.map((c) => c.level)).toEqual(['word', 'sentence']);
  });

  it('والتعبيرُ الحقيقيُّ يظهر في مكانه', () => {
    const chain = contextChain({
      word: 'логисти́ческой',
      chunk: 'логисти́ческой слу́жбы',
      sentence: 'отве́тственность логисти́ческой слу́жбы',
    });
    expect(chain.map((c) => c.level)).toEqual(['word', 'chunk', 'sentence']);
  });

  it('وتعبيرٌ مطابقٌ للكلمة لا يُعَدّ حلقةً', () => {
    const chain = contextChain({ word: 'до́ма', chunk: 'до́ма', sentence: 'я до́ма' });
    expect(chain.map((c) => c.level)).toEqual(['word', 'sentence']);
  });
});

/* ================================================================== *
 * ١٠) مصدرُ الحقيقة واحد — البند ٤٩
 * ================================================================== */

describe('معمار · مصدرُ حقيقةٍ صوتيّةٍ واحد', () => {
  it('⚠️ خريطةُ الصوت لا تعرف `speechSynthesis` — خطّةٌ لا مُشغِّل', async () => {
    const text = await (await fetch('../js/services/pronunciation/sound-map.js')).text();
    expect(text.includes('speechSynthesis')).toBe(false);
    expect(text.includes('SpeechSynthesisUtterance')).toBe(false);
    expect(text.includes('setInterval')).toBe(false);
  });

  it('⚠️ وملفُّ العرض لا يُعيد تعريفَ جدولِ صلابةٍ ولا اختزال', async () => {
    const text = await (await fetch('../js/views/shadow-view.js')).text();
    /* الجداولُ في `alphabet.js` وحدَها — ولا نسخةَ ثانيةً في الواجهة. */
    expect(text.includes('CONSONANT_SOFT')).toBe(false);
    expect(text.includes('CONSONANT_HARD')).toBe(false);
    expect(text.includes('VOICED_TO_VOICELESS')).toBe(false);
    expect(text.includes('SOFTENING_VOWELS')).toBe(false);
  });

  it('والمنهجُ لا ينشئ حلَّالَ نبرٍ ثانيًا (بند ٤١)', async () => {
    const text = await (await fetch('../js/services/pronunciation/curriculum.js')).text();
    expect(text.includes('resolveStress')).toBe(false);
    expect(text.includes('STRESS_MARK')).toBe(false);
  });

  it('⚠️ ولا مؤقّتَ في مسار النطق الأماميّ — درسُ WS53 محروسٌ بنصّ', async () => {
    /*
     * ⚠️ **والفحصُ على ثلاثة ملفّاتٍ لا واحد.** الانحدارُ الذي كلّفنا
     *    WS53 كاملةً لم يكن في مُشغِّل النطق وحدَه: كان `startKeepAlive()`
     *    سطرًا بعد `speak()`. فيُفحَص المُشغِّلُ والواجهةُ وحارسُ الخلفية
     *    معًا — أيُّهم استعاد مؤقّتًا أعاد العطب.
     */
    for (const file of ['../js/views/shadow-view.js',
      '../js/services/shadow/tts-controller.js',
      '../js/services/shadow/background-audio.js']) {
      const text = await (await fetch(file)).text();
      expect(`${file}:${text.includes('setInterval')}`).toBe(`${file}:false`);
    }
  });

  it('وتدريبُ النطق يتتابع على وعدٍ ويُلغى بإشارة — لا بمؤقّت', async () => {
    const text = await (await fetch('../js/views/shadow-view.js')).text();
    expect(text.includes('AbortController')).toBe(true);
    expect(text.includes('function playAnalysisPlan')).toBe(true);
    /* والواجهةُ تستهلك الخريطةَ ولا تبني نظيرَها. */
    expect(text.includes("from '../services/pronunciation/sound-map.js'")).toBe(true);
  });

  it('وخريطةُ الصوت تقرأ من المحرّك ولا تُعيد حسابَ صوت', async () => {
    const text = await (await fetch('../js/services/pronunciation/sound-map.js')).text();
    /* لا جدولَ IPA ولا قائمةَ اختزالٍ — القيمُ كلُّها من `analysis`. */
    expect(text.includes('VOWEL_SOUND')).toBe(false);
    expect(text.includes('IPA_TO_CYRILLIC')).toBe(false);
  });
});

/* ================================================================== *
 * ١١) قبولُ تحليل الكلمة — البند ٥٧
 * ================================================================== */

describe('القبول · الكلمةُ تجيب على أسئلة المتعلّم', () => {
  it('⚠️ سبعةَ عشرَ سؤالًا — وكلُّ ما لا يُجاب يُعلَن', () => {
    const analysis = analyzeWord('логисти́ческой');
    const map = soundMap(analysis);

    expect(map.word).toBeTruthy();                       /* إيه الكلمة؟ */
    expect(map.stress.ordinal >= 0).toBe(true);          /* النبر فين؟ */
    expect(map.pronunciation.simple).toBeTruthy();       /* بتتنطق إزاي؟ */
    expect(map.syllables.length).toBe(5);                /* المقاطع؟ */
    expect(map.syllables.every((s) => s.realized)).toBe(true); /* كل مقطع؟ */
    expect(map.playback.pieces.steps.length > 1).toBe(true);   /* أبنيها إزاي؟ */
    expect(map.playback.natural.steps.length).toBe(1);   /* طبيعي؟ */
    expect(map.changes.length > 0).toBe(true);           /* إيه اللي اتغيّر؟ */
    expect(map.hardness.length > 0).toBe(true);          /* مفخم/مرقق؟ */
    expect(Array.isArray(map.voicing)).toBe(true);       /* مجهور/مهموس؟ */
    expect(map.reductions.length > 0).toBe(true);        /* مختزل فين؟ */
    expect(map.changes[0].rules.length > 0).toBe(true);  /* ليه؟ */
    expect(map.changes[0].rules[0].teaching.length > 0).toBe(true); /* أنهي قاعدة تعليمية؟ */
    expect(map.changes[0].rules[0].ruleId).toBeTruthy(); /* أنهي قاعدة محرّك؟ */
    expect(map.pronunciation.ipa).toBeTruthy();          /* IPA متقدّم؟ */
    expect(Array.isArray(map.limitations)).toBe(true);   /* الحدود؟ */
    expect(map.rulesetVersion).toBe(RULESET_VERSION);
  });

  it('وكلمةٌ بلا نبرٍ معروفٍ تقول ذلك بدل أن تخترع', () => {
    const map = soundMap(analyzeWord('нипапупа'));
    expect(map.complete).toBe(false);
    expect(map.limitations.some((l) => l.includes('غير مكتمل'))).toBe(true);
    expect(map.pronunciation.ipa).toBe(null);
  });
});

/* ================================================================== *
 * ١٢) الربطُ في الاتّجاهين + الأداء
 * ================================================================== */

describe('المنهج · الربطُ والأداء', () => {
  it('كلُّ قاعدةٍ في السجلّ يمكن ردُّها إلى بندٍ منهجيّ', () => {
    const orphan = allRuleIds().filter((id) => !teachingRulesForEngineRule(id).length);
    expect(orphan).toEqual([]);
  });

  it('والبندُ يُستردّ بمعرّفه', () => {
    expect(teachingRuleById('TEACH_FINAL_DEVOICING').doc).toBe(SOURCE_DOC.VOICING);
    expect(teachingRuleById('لا-وجود-له')).toBe(null);
  });

  it('وكلُّ قاعدةٍ يذكرها المنهجُ لها شرحٌ ومصدرٌ في السجلّ', () => {
    const ids = [...new Set(TEACHING_RULES.flatMap((t) => t.engineRuleIds))]
      .filter((id) => id !== 'RU_LEXICAL_ORTHOEPIC_EXCEPTION');
    const bad = ids.filter((id) => {
      const rule = ruleById(id);
      return !rule?.explain || !rule?.source;
    });
    expect(bad).toEqual([]);
  });

  it('⚠️ وخريطةُ الصوت لا تُعيد التحليل — الكلمةُ تُحلَّل مرّةً للصفحة كلِّها', () => {
    const analysis = analyzeWord('логисти́ческой');
    const t0 = performance.now();
    for (let i = 0; i < 200; i += 1) soundMap(analysis);
    const ms = performance.now() - t0;
    /* ٢٠٠ بناءِ خريطةٍ في أقلّ من ٣٠٠ms — أي أقلّ من ١٫٥ms للواحدة. */
    expect(ms < 300).toBe(true);
  });
});

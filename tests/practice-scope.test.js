/**
 * LingoLife — المقطعُ الفعّال والنطاقاتُ الثلاثة (WS-A)
 *
 * تحرس أربعةَ أشياء ينكسر كلٌّ منها بصمت:
 *
 *  ١ · **ألّا يعود تسريبُ النصّ الخارجيّ.** فحصُ نصٍّ يمنع أن يُنادي
 *      مبدِّلُ النطاق `exitExternalText` مرّةً أخرى — وهو العطبُ الذي
 *      عاد بعد WS42 لأن لا شيءَ كان يمنعه.
 *  ٢ · **ألّا يُخفي النسخُ نبرًا نعرفه** — ولا يخترعَ نبرًا لا نعرفه.
 *  ٣ · **ألّا يخطف مدًى مدًى آخر.** ثلاثةُ مدَياتٍ صريحةٌ لا تتبادل.
 *  ٤ · **ألّا تنقص خانةٌ في مصفوفة التكافؤ بصمت.** كلُّ خانةٍ إمّا
 *      مدعومةٌ وإمّا لها سببٌ مكتوب.
 */

import { describe, it, expect } from './test-runner.js';
import { markPlain, markSentence, rememberStress, loadUserDictionary } from '../js/services/shadow/stress.js';
import { SAVED_KIND } from '../js/services/saved-service.js';
import { splitWords } from '../js/services/shadow/segmenter.js';
import { createPlaybackController } from '../js/services/shadow/playback-controller.js';

/* ================================================================== *
 * ١) الحارسُ المعماريّ — البند ٣٩
 * ================================================================== */

describe('نطاقُ التدريب · الحارسُ المعماريّ', () => {
  it('⚠️ ولا مبدِّلُ نطاقٍ يُخرج من النصّ الخارجيّ — العطبُ الأصليّ', async () => {
    /*
     * ⚠️ **هذا الاختبارُ يصف عطبًا وقع مرّتين.**
     *
     *    في WS42 كان `prev`/`next` ينادِيان `exitExternalText()` قبل أن
     *    يتحرّكا. أُصلح. ثم عاد الشيءُ نفسُه من بابٍ آخر: `MODES` كانت
     *    تضع `paint: () => exitExternalText()` في وضعَي «نصّ» و«كلمة»،
     *    فالضغطُ على «كلمة» يهدم النصَّ الخارجيّ.
     *
     *    وكلاهما إصلاحُ سلوكٍ بلا حارس — فعاد. وهذا الفحصُ هو الحارس:
     *    يقرأ تعريفَ `MODES` ويسقط لو ظهر فيه استدعاءُ خروجٍ من المصدر.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const modes = src.slice(src.indexOf('const MODES = ['), src.indexOf('let modeTicket'));
    expect(modes.length > 100).toBe(true);
    expect(modes.includes('exitExternalText')).toBe(false);
    expect(modes.includes('dropSegment')).toBe(false);
    expect(modes.includes('returnIndex')).toBe(false);
  });

  it('والنطاقاتُ ثلاثةٌ بأسمائها — كلمة · مقطع · جملة (بند ١١)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const modes = src.slice(src.indexOf('const MODES = ['), src.indexOf('let modeTicket'));
    for (const id of ["id: 'word'", "id: 'phrase'", "id: 'sentence'"]) {
      expect(`${id}:${modes.includes(id)}`).toBe(`${id}:true`);
    }
    /* و«جملة برّه» لم تعد نطاقًا — صارت مصدرًا، وبابُها غيرُ هذا الباب. */
    expect(modes.includes("id: 'own'")).toBe(false);
  });

  it('⚠️ وبابُ الخروج من المصدر واحدٌ ومُعلَن (بند ٢٦)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    /*
     * ⚠️ **والعدُّ على أسطر الكود لا على الملفّ كلِّه.** الملفُّ يشرح
     *    العطبَ القديم في تعليقين يذكران اسمَ الدالّة — وهما توثيقٌ
     *    مقصود، لا نداء. فحصٌ يعدّ النصَّ الخامَّ كان سيُجبِرني على
     *    حذف الشرح لإرضائه، وذلك عكسُ الغرض.
     */
    const codeLines = src.split('\n')
      .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l));

    /*
     * ⚠️ **والبابُ تعمَّم ولم يتعدّد** (WS-E، بندا ٢٦ و٢٧).
     *
     *    كان الحارسُ يعدّ نداءات `exitExternalText` لأنها كانت البابَ.
     *    ثم صارت المصادرُ ثلاثةً — أصلٌ ومسودّةٌ ومؤقّت — فصار البابُ
     *    `returnToOriginal`، و`exitExternalText` انحسرت إلى معناها
     *    الحرفيّ: إقفالُ صندوق اللصق، ولا تُسقِط إلّا المؤقّت.
     *
     *    فالمحروسُ هو **الفعلُ الخطِر** لا اسمُ الدالّة: مَن يُسقِط
     *    مقاطعَ مصدرٍ من `ctx.segments`. وهو `dropExternalSource`
     *    وحدَها، ومواضعُ ندائها معدودةٌ ومعروفةٌ بالاسم أدناه.
     */
    const drops = codeLines.filter((l) => l.includes('ctx.segments.length =')).length;
    expect(`splice-sites:${drops}`).toBe('splice-sites:1');

    const callers = codeLines.filter((l) => /(?<!function )dropExternalSource\(\)/.test(l)).length;
    /*
     * إقفالُ الصندوق · الرجوعُ للأصل · استبدالُ مؤقّتٍ · دخولُ مسودّة ·
     * دخولُ تصحيحِ غلطة (WS-C2).
     *
     * ⚠️ **والخامسُ استبدالٌ لا بابُ خروجٍ ثانٍ**: `enterCorrectionSource`
     *    تُسقط المصدرَ المُركَّبَ القائمَ لتضع مكانَه — كما تفعل
     *    `enterDraftSource` بحرفها. وبابُ **الخروج** إلى الأصل يبقى
     *    واحدًا: `returnToOriginal`، ويحرسه السطرُ تحت.
     */
    expect(`call-sites:${callers}`).toBe('call-sites:5');

    const at = src.indexOf("case 'scratch-clear':");
    expect(at > 0).toBe(true);
    expect(src.slice(at, at + 200).includes('returnToOriginal()')).toBe(true);

    /*
     * ⚠️ **ولا يُنادى البابُ من تبديلِ نطاقٍ ولا تبويب** (بند ٢٧).
     *    وهذا هو العطبُ الذي أصلحته WS-A بحرفه — فيبقى محروسًا وقد
     *    تغيّر اسمُ البابِ.
     */
    const modes = src.slice(src.indexOf('const MODES = ['), src.indexOf('let modeTicket'));
    expect(modes.includes('returnToOriginal')).toBe(false);
    expect(modes.includes('dropExternalSource')).toBe(false);
    const wells = src.slice(src.indexOf('async function renderWells'), src.indexOf('async function openWell'));
    expect(wells.includes('returnToOriginal')).toBe(false);
    expect(wells.includes('dropExternalSource')).toBe(false);
  });

  it('والمقطعُ الفعّالُ يُقرأ من دالّةٍ واحدة لا من تسع نسخ (بند ٣)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    expect(src.includes('function activeSegment()')).toBe(true);
    /*
     * ⚠️ ولا يُمنَع التعبيرُ الخام كلَّه: `syncSegment` و`renderWords`
     *    تقرآنه مرّةً في أوّل السطر ثم تستعملان المتغيّر. الممنوعُ أن
     *    ينتشر — فالسقفُ يمسك الانتشارَ ولا يمنع الاستعمالَ المشروع.
     */
    const raw = src.split('ctx.segments[player.state.index]').length - 1;
    expect(`raw-reads:${raw <= 4}`).toBe('raw-reads:true');
  });
});

/* ================================================================== *
 * ٢) النسخُ يحمل النبر — البنود ٧…١٠
 * ================================================================== */

describe('النسخ · النبرُ يُنسَخ ولا يُخترَع', () => {
  it('⚠️ الجملةُ تُنسَخ بعلامات النبر التي نعرفها', () => {
    const out = markPlain('документ уже полностью заполнен');
    expect(out.text.includes('докуме́нт')).toBe(true);
  });

  it('⚠️ ولا تُخترَع علامةٌ لكلمةٍ مجهولة (بند ٨)', () => {
    const out = markPlain('нипапупа');
    expect(out.text).toBe('нипапупа');
    expect(out.known).toBe(0);
  });

  it('والترقيمُ يبقى حول الشكل المعلَّم لا داخله', () => {
    expect(markPlain('документ,').text).toBe('докуме́нт,');
    expect(markPlain('«документ»').text).toBe('«докуме́нт»');
  });

  it('⚠️ ونصٌّ خامٌّ لا HTML — الحافظةُ لا تأخذ وسومًا', () => {
    const out = markPlain('документ уже');
    expect(out.text.includes('<')).toBe(false);
    expect(out.text.includes('&')).toBe(false);
    /* وأختُها `markSentence` تبقى HTML للعرض — مصدرٌ واحدٌ ومخرَجان. */
    expect(markSentence('документ').html.includes('<')).toBe(true);
  });

  it('وتصحيحُ النبر يظهر في النسخ فورًا — بلا حالةٍ ثانية (بندا ٥ و٦)', async () => {
    await loadUserDictionary();
    const before = markPlain('капибара').text;
    expect(before).toBe('капибара');
    await rememberStress('капибара', 'капиба́ра');
    /*
     * ⚠️ **ولا `clearCache` ولا إعادةَ تحميل.** `markPlain` تسأل
     *    `stressOf` في كلّ نداء، و`rememberStress` تكتب في نفس القاموس
     *    الذي تقرؤه. فلا نسخةَ محلّيّةٌ تتأخّر — وهو ما طلبه بند ٥.
     */
    expect(markPlain('капибара').text).toBe('капиба́ра');
  });

  it('⚠️ والمدياتُ الثلاثةُ لا تتبادل (بندا ١٠ و٣٥)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    /* كلُّ دالّةِ نسخٍ تسمّي مداها في نداء `copyScoped` نفسِه. */
    expect(src.includes('copyScoped(COPY_SCOPE.SENTENCE, markedForCopy(activeText()))')).toBe(true);
    expect(src.includes('copyScoped(COPY_SCOPE.WORD, markedForCopy(word?.display')).toBe(true);
    expect(src.includes('copyScoped(COPY_SCOPE.EXPRESSION, markedForCopy(phraseText()))')).toBe(true);
    /* ونسخُ الجملة لا يقرأ انتقاءَ كلمةٍ ولا مدًى. */
    const start = src.indexOf('function copySentence()');
    const fn = src.slice(start, src.indexOf('}', start));
    expect(fn.includes('selected')).toBe(false);
    expect(fn.includes('phrase')).toBe(false);
    expect(fn.includes('rail.word')).toBe(false);
  });

  it('⚠️ وشريطُ المقطع يحمل النبر كما تحمله الرقائق (بند ٦)', async () => {
    /*
     * ⚠️ **ثلاثةُ تمثيلاتٍ لشيءٍ واحد، فلا تشذّ واحدة.**
     *
     *    كان الشريطُ يعرض `phraseText()` خامًا بينما الرقائقُ فوقه
     *    معلَّمةٌ ونسخُ المقطع معلَّم — «по́лностью» فوق و«полностью»
     *    تحت. لا يُسقط ذلك اختبارًا ولا يمنع عملًا، ولذلك يحتاج
     *    حارسًا: هو بالضبط نوعُ التفاوت الذي يعود بصمت.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const start = src.indexOf('function paintPhrase()');
    const fn = src.slice(start, src.indexOf('\nfunction ', start + 10));
    expect(fn.includes('markedForCopy(phraseText())')).toBe(true);
  });
});

/* ================================================================== *
 * ٣) مدى المقطع — البنود ١١…١٨ و٣١
 * ================================================================== */

/** محاكاةٌ صغيرةٌ لمنطق المدى — نفسُ قواعد `pickPhraseWord`/`nudgePhrase`. */
function makeRange(total) {
  const st = { anchor: -1, from: -1, to: -1, complete: false };
  const has = () => st.complete && st.from >= 0 && st.to >= st.from;
  return {
    state: st,
    has,
    pick(at) {
      /* لمسُ المرساة قبل الإتمام تأكيدٌ صامت — لا مدًى من كلمة. */
      if (!st.complete && at === st.anchor) return;
      if (st.anchor < 0 || st.complete) {
        st.anchor = at; st.from = at; st.to = at; st.complete = false;
      } else {
        st.from = Math.min(st.anchor, at);
        st.to = Math.max(st.anchor, at);
        st.complete = true;
      }
    },
    nudge(edge, delta) {
      if (st.from < 0) return;
      if (edge === 'start') st.from = Math.min(Math.max(0, st.from + delta), st.to);
      else st.to = Math.max(Math.min(total - 1, st.to + delta), st.from);
      st.anchor = st.from;
    },
  };
}

describe('المقطع الجزئيّ · المدى', () => {
  const SENT = 'Протокол уже полностью заполнен и направлен на согласование.';
  const words = splitWords(SENT);

  it('الجملةُ المرجعيّةُ ثماني كلمات', () => {
    /* عددٌ مقيسٌ لا مُقدَّر: Протокол·уже·полностью·заполнен·и·направлен·на·согласование. */
    expect(words.length).toBe(8);
  });

  it('⚠️ نقرتان تُحدّدان المدى — ولا تُلمَس كلُّ كلمةٍ على حدة (بند ١٢)', () => {
    const r = makeRange(words.length);
    r.pick(5);            /* направлен */
    r.pick(7);            /* согласование */
    expect([r.state.from, r.state.to]).toEqual([5, 7]);
    const text = words.slice(r.state.from, r.state.to + 1).map((w) => w.display).join(' ');
    expect(text).toBe('направлен на согласование.');
  });

  it('والاتّجاهُ لا يهمّ — من الآخر إلى الأوّل نفسُ المدى', () => {
    const r = makeRange(words.length);
    r.pick(7);
    r.pick(5);
    expect([r.state.from, r.state.to]).toEqual([5, 7]);
  });

  it('⚠️ الكلمات ٣–٦ بالضبط — لا جارَ زائدًا (بند ٣١)', () => {
    const r = makeRange(words.length);
    r.pick(2); r.pick(5);
    const picked = words.slice(r.state.from, r.state.to + 1).map((w) => w.display);
    expect(picked.length).toBe(4);
    expect(picked).toEqual(['полностью', 'заполнен', 'и', 'направлен']);
  });

  it('وتوسيعٌ يمينًا ثم تقليصٌ يسارًا — بلا إلغاءٍ ولا بدءٍ من جديد (بند ١٣)', () => {
    const r = makeRange(words.length);
    r.pick(2); r.pick(5);
    r.nudge('end', 1);
    expect([r.state.from, r.state.to]).toEqual([2, 6]);
    r.nudge('start', 1);
    expect([r.state.from, r.state.to]).toEqual([3, 6]);
  });

  it('⚠️ ولا تتجاوز الحافّةُ حدودَ الجملة ولا تعبر أختَها', () => {
    const r = makeRange(words.length);
    r.pick(0); r.pick(1);
    r.nudge('start', -5);
    expect(r.state.from).toBe(0);
    r.nudge('end', 99);
    expect(r.state.to).toBe(words.length - 1);
    /* والتقليصُ لا يقلب المدى. */
    r.nudge('start', 99);
    expect(r.state.from <= r.state.to).toBe(true);
  });

  it('ولمسةٌ ثالثةٌ تبدأ مدًى جديدًا بلا زرّ إلغاء', () => {
    const r = makeRange(words.length);
    r.pick(1); r.pick(4);
    r.pick(6);
    expect([r.state.from, r.state.to]).toEqual([6, 6]);
  });

  it('⚠️ ولمسُ المرساة نفسِها لا يصنع مدًى من كلمةٍ واحدة', () => {
    /*
     * ⚠️ عطبٌ حقيقيٌّ أمسكه فحصُ المتصفّح: «حدّد مقطع» تُرسي على
     *    الكلمة الممسوكة، فمن يلمسها ليؤكّدها كان يُتِمّ مدًى من كلمة،
     *    ثم تبدأ لمستُه للأخيرة مدًى جديدًا — فيحصل على آخر كلمةٍ وحدَها.
     */
    const r = makeRange(words.length);
    r.pick(1);              /* المرساة */
    r.pick(1);              /* تأكيدٌ صامت — لا إتمام */
    expect(r.has()).toBe(false);
    r.pick(3);              /* هذه هي التي تُتِمّ */
    expect([r.state.from, r.state.to]).toEqual([1, 3]);
    expect(r.has()).toBe(true);
  });

  it('⚠️ والمدى يُطرَح حين يتبدّل المقطع — رقمان بلا جملتهما يكذبان', async () => {
    /*
     * ⚠️ أمسكته لقطةُ شاشة: بعد الخروج من النصّ المؤقّت بقي شريطُ
     *    «مقطع: того как документ все» فوق جملةِ السكريبت.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    expect(src.includes('phrase.segmentId')).toBe(true);
    expect(src.includes("phrase.segmentId !== segment.id) exitPhrase()")).toBe(true);
  });

  it('⚠️ والمدى يُحفَظ رقمَين لا نصًّا مجمَّدًا (بند ٢١)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    expect(src.includes('wordStart: phrase.from')).toBe(true);
    expect(src.includes('wordEnd: phrase.to')).toBe(true);
    expect(src.includes('kind: SAVED_KIND.PHRASE')).toBe(true);
  });

  it('ونوعٌ ثالثٌ في نفس المخزن — لا مخزنَ مقاطعَ منفصل (بند ٣٨)', async () => {
    expect(SAVED_KIND.PHRASE).toBe('phrase');
    const schema = await (await fetch('../js/db/schema.js')).text();
    for (const forked of ['phrases:', 'externalSavedWords', 'quickPracticePhrases', 'draftPhrases']) {
      expect(`${forked}:${schema.includes(forked)}`).toBe(`${forked}:false`);
    }
  });
});

/* ================================================================== *
 * ٤) التشغيل — البنود ١٦…١٨
 * ================================================================== */

describe('المقطع الجزئيّ · التشغيل', () => {
  it('⚠️ ولا مُشغِّلَ ثانٍ — نفسُ ناطق الجلسة وذاكرتُه (بندا ١٦ و١٧)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const fn = src.slice(src.indexOf('async function speakScope('), src.indexOf('const COPY_SCOPE'));
    expect(fn.includes('ttsSpeaker')).toBe(true);
    /* ولا مؤقّتَ بين التكرارات — تتابعٌ على وعدٍ ينتهي (بند ٣٧). */
    expect(fn.includes('setTimeout')).toBe(false);
    expect(fn.includes('setInterval')).toBe(false);
    expect(fn.includes('new Audio')).toBe(false);
  });

  it('والسرعةُ من الجلسة — لا حالةَ سرعةٍ مخبوءةٌ للمقطع (بند ١٨)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const fn = src.slice(src.indexOf('async function speakScope('), src.indexOf('const COPY_SCOPE'));
    expect(fn.includes('ctx.session?.speed')).toBe(true);
  });

  it('والتكرارُ يقرأ عدّادَ الجلسة نفسَه — من المحرّك بعد WS-M', async () => {
    /*
     * ⚠️ **كان النداءُ الوحيدُ بـ`times: ctx.session?.repeatCount` في
     *    `phrase-play`** — زرُّ «اسمع المقطع» في السكّة. ونُزع لأنه
     *    كرّر زرَّ التشغيل الرئيسيّ بمسارِ نطقٍ ثانٍ خارج المحرّك.
     *
     *    والادّعاءُ المطلوبُ إثباتُه لم يتغيّر: **عدّادُ التكرار واحدٌ
     *    مصدرُه الجلسة**. وقد صار المحرّكُ هو مَن يقرؤه، وهو أقوى: لا
     *    مسارَ ثانيَ يمكن أن يفترق عنه أصلًا.
     */
    const raw = await (await fetch('../js/views/shadow-view.js')).text();
    /* ⚠️ يُقاس الكودُ لا الشرح: تعليقُ النزع نفسُه يسمّي ما نُزع. */
    const src = raw.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
    /* لا مسارَ نطقٍ ثانٍ يمرّر تكرارًا من عنده. */
    expect(src.includes('phrase-play')).toBe(false);
    /* والمحرّكُ يُبنى بإعدادات الجلسة، ومنها `repeatCount`. */
    expect(src).toContain('settings: { ...session');

    const engine = await (await fetch('../js/services/shadow/playback-controller.js')).text();
    expect(engine).toContain('repeatCount');
  });
});

/* ================================================================== *
 * ٤٫٥) حدُّ المصدر — «التنقّل لا يعبر مصدرَه» (بندا ٢٦ و٤١)
 * ================================================================== *
 *
 * ⚠️ **وهذه اختباراتُ سلوكٍ لا فحصُ نصّ.** تُبنى مُشغّلٌ حقيقيّ
 *    وتُضغَط أزرارُه، لأن الادّعاءَ المطلوبَ إثباتُه سلوكيّ: «لا فعلَ
 *    عاديٌّ يعبر من المصدر المؤقّت إلى الأصل». فحصُ نصٍّ يثبت أن
 *    سطرًا مكتوب؛ وهذا يثبت أن الحدَّ يصمد.
 */

/** مُشغّلٌ صامت: أربعُ جملِ سكريبت ثم جملتان مؤقّتتان. */
function bench() {
  const events = [];
  const player = createPlaybackController({
    segments: [
      { id: 's0', text: 'Первая.' },
      { id: 's1', text: 'Вторая.' },
      { id: 's2', text: 'Третья.' },
      { id: 's3', text: 'Четвёртая.' },
    ],
    settings: { rate: 1, repeatCount: 1, autoAdvance: false },
    speaker: { speak: async () => {} },
    onEvent: (e) => events.push(e.type),
  });
  return { player, events };
}

describe('حدُّ المصدر · التنقّل لا يعبره (بند ٢٦)', () => {
  it('⚠️ «التالي» من آخرِ جملةٍ في مصدرٍ مؤقّت لا يدخل السكريبت', () => {
    const { player } = bench();
    /* مصدرٌ مؤقّتٌ بجملتين في الآخر. */
    player.pushSegment({ id: 'ext-0', text: 'Внешняя один.' });
    player.pushSegment({ id: 'ext-1', text: 'Внешняя два.' });
    player.setSourceWindow({ from: 4, to: 5 });
    player.goTo(4);

    expect(player.state.index).toBe(4);
    player.next();
    expect(player.state.index).toBe(5);
    /* الحافّة: يقف ولا يعبر. */
    player.next();
    expect(player.state.index).toBe(5);
  });

  it('و«السابق» من أوّلِ جملةٍ فيه لا يرجع إلى السكريبت', () => {
    const { player } = bench();
    player.pushSegment({ id: 'ext-0', text: 'Внешняя один.' });
    player.pushSegment({ id: 'ext-1', text: 'Внешняя два.' });
    player.setSourceWindow({ from: 4, to: 5 });
    player.goTo(5);

    player.previous();
    expect(player.state.index).toBe(4);
    player.previous();
    expect(player.state.index).toBe(4);
  });

  it('ومصدرٌ من جملةٍ واحدة: لا سابقَ ولا تالي — ويُقال ذلك صراحةً', () => {
    const { player } = bench();
    player.pushSegment({ id: 'ext-0', text: 'Одна фраза.' });
    player.setSourceWindow({ from: 4, to: 4 });

    expect(player.state.index).toBe(4);
    expect(player.edges.atStart).toBe(true);
    expect(player.edges.atEnd).toBe(true);
    expect(player.edges.count).toBe(1);
    expect(player.edges.whole).toBe(false);

    player.next();
    expect(player.state.index).toBe(4);
    player.previous();
    expect(player.state.index).toBe(4);
  });

  it('و`goTo` إلى جملةِ سكريبتٍ تُقصّ إلى حدّ المصدر ولا تعبر', () => {
    const { player } = bench();
    player.pushSegment({ id: 'ext-0', text: 'Внешняя.' });
    player.setSourceWindow({ from: 4, to: 4 });

    /* أيُّ فهرسٍ خارج المصدر — من شرطةٍ أو سطرٍ أو استعادةِ موضع. */
    player.goTo(0);
    expect(player.state.index).toBe(4);
    player.goTo(2);
    expect(player.state.index).toBe(4);
  });

  it('⚠️ وانتهاءُ مصدرٍ مؤقّت لا يُغلق الجلسة', () => {
    const { player, events } = bench();
    player.pushSegment({ id: 'ext-0', text: 'Внешняя.' });
    player.setSourceWindow({ from: 4, to: 4 });
    events.length = 0;

    player.next();
    /*
     * لا `session-complete`: الجلسةُ ملكُ المصدر الأصليّ، وبلوغُ آخرِ
     * جملةٍ في نصٍّ لصقتَه الآن وقوفٌ لا انتهاء.
     */
    expect(events.includes('session-complete')).toBe(false);
  });

  it('ورفعُ النافذة يُعيد التنقّلَ في كلّ المصدر الأصليّ', () => {
    const { player } = bench();
    player.pushSegment({ id: 'ext-0', text: 'Внешняя.' });
    player.setSourceWindow({ from: 4, to: 4 });
    expect(player.edges.atEnd).toBe(true);

    /* «الرجوع للأصل»: تُحذَف مقاطعُه وتُرفَع النافذةُ ويعود الموضع. */
    player.dropSegments(['ext-0'], 1);
    expect(player.sourceWindow).toBe(null);
    expect(player.state.index).toBe(1);
    expect(player.edges.atEnd).toBe(false);

    player.next();
    expect(player.state.index).toBe(2);
  });

  it('وحدُّ المصدر لا يمسّ «حصر التدريب» — حقلان لا حقلٌ بمعنيين', () => {
    const { player } = bench();
    /* اختيارُ المستخدم: الجملتان ١ و٣ من الأصل. */
    player.setSelection([1, 3]);
    expect(player.selection).toEqual([1, 3]);

    player.pushSegment({ id: 'ext-0', text: 'Внешняя.' });
    player.setSourceWindow({ from: 4, to: 4 });
    /* دخولُ نصٍّ مؤقّتٍ لا يمحو اختيارَك. */
    expect(player.selection).toEqual([1, 3]);

    player.dropSegments(['ext-0'], 1);
    expect(player.selection).toEqual([1, 3]);
  });
});

/* ================================================================== *
 * حارسٌ نصّيّ: لا بابَ جانبيٌّ يتخطّى النافذة
 * ================================================================== */

describe('حدُّ المصدر · الحارس', () => {
  it('⚠️ وكلُّ كتابةٍ على `state.index` مصدرُها محصورٌ بالنافذة', async () => {
    /*
     * ⚠️ **العدُّ كان حارسًا خاطئًا.** كتبتُ أوّلًا «كتابةٌ واحدةٌ
     *    فقط»، فسقط الحارسُ على ثلاث — واثنتان منها سليمتان تمامًا:
     *    `start()` تقفز إلى أوّل مقطعٍ صالحٍ بـ`nextSelected(-1)`،
     *    وهي محصورةٌ بالنافذة أصلًا.
     *
     *    فالمحروسُ ليس **كم** كتابةً بل **من أين تأتي القيمة**: إمّا
     *    `clamped` (مخرجُ القصّ في `goTo`) وإمّا `nextSelected(...)`
     *    (مخرجُ البحث المحصور). أيُّ مصدرٍ ثالثٍ بابٌ للعبور.
     */
    const src = await (await fetch('../js/services/shadow/playback-controller.js')).text();
    const bad = [];
    for (const m of src.matchAll(/state\.index\s*=(?!=)\s*([^;\n]+)/g)) {
      const rhs = m[1].trim();
      const safe = rhs === 'clamped' || rhs.startsWith('first') || /^nextSelected\(/.test(rhs);
      if (!safe) bad.push(rhs.slice(0, 40));
    }
    expect(bad).toEqual([]);

    /* و`first` نفسُها لا تُشتقّ إلّا من البحث المحصور. */
    const firsts = src.match(/const first\s*=\s*([^;\n]+)/g) || [];
    expect(firsts.length > 0).toBe(true);
    for (const line of firsts) expect(line.includes('nextSelected(')).toBe(true);
  });

  it('و«التالي/السابق» في الشاشة لا يتخطّيان المحرّك', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    expect(src.includes("case 'prev': return player.previous();")).toBe(true);
    expect(src.includes("case 'next': return player.next();")).toBe(true);
  });

  it('وسطرُ الأصل لا يُخرجك من نصّك المؤقّت ضمنيًّا', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const at = src.indexOf("const line = event.target.closest('[data-line]')");
    expect(at > 0).toBe(true);
    const fn = src.slice(at, at + 1400);
    /* يرفض بصراحةٍ ولا يقصّ صامتًا، ولا يُنادي خروجًا. */
    expect(fn.includes('hasExternalSegment()')).toBe(true);
    expect(fn.includes('exitExternalText')).toBe(false);
  });

  it('⚠️ ولا علامةَ اقتباسٍ خلفيّة داخل تعليقِ HTML في قالب', async () => {
    /*
     * ⚠️ **حارسٌ وُلد من وقوعي فيها مرّتين.**
     *
     *    تعليقُ `<!-- ... -->` داخل قالب html يبدو نصًّا، وهو **داخل
     *    قالبٍ نصّيّ**: أيُّ علامةِ اقتباسٍ خلفيّةٍ فيه تُنهي القالبَ
     *    فيصير ما بعدها كودًا.
     *
     *    والأخبثُ أن `node --check` **يمرّرها** حين تكون العلامتان
     *    زوجًا: الأولى تُغلق والثانيةُ تفتح قالبًا جديدًا، فيبقى
     *    الملفُّ صحيحًا نحويًّا في نظرِ Node ويسقط في المتصفّح وحدَه
     *    («Unexpected identifier»). فلا يكفي الفحصُ النحويّ حارسًا.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const bad = [];
    for (const m of src.matchAll(/<!--[\s\S]*?-->/g)) {
      if (m[0].includes('`')) bad.push(m[0].slice(0, 60).replace(/\s+/g, ' '));
    }
    expect(bad).toEqual([]);
  });

  it('وبابُ الخروج واحدٌ — `dropExternalSource` لا حذفٌ يدويّ متفرّق', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    /* لا أحدَ يحذف مقاطعَ مؤقّتةً بيده خارج البابِ الواحد. */
    const pops = src.match(/ctx\.segments\.pop\(\)/g) || [];
    expect(pops.length).toBe(0);
    expect(src.includes('function dropExternalSource()')).toBe(true);
  });
});

/* ================================================================== *
 * ٥) مصفوفةُ التكافؤ — البند ٤٠
 * ================================================================== */

/**
 * ⚠️ **مصفوفةٌ تُقرأ آليًّا لا جدولٌ في تقرير.**
 *
 *    كلُّ خانةٍ إمّا `true` وإمّا **نصُّ سببٍ مكتوب**. ولا `false`
 *    مجرّدة: خانةٌ فارغةٌ في مصفوفةٍ كهذه تعني «لم يُنظَر فيها»، وهو
 *    بالضبط ما يخفي الانحدارَ الذي جاءت المصفوفةُ لتمنعه.
 */
const PARITY = Object.freeze({
  'نطاق الجملة': { original: true, external: true },
  'نطاق الكلمة': { original: true, external: true },
  'نطاق المقطع': { original: true, external: true },
  'تشغيل الجملة': { original: true, external: true },
  'تشغيل الكلمة': { original: true, external: true },
  'تشغيل المقطع': { original: true, external: true },
  'التكرار': { original: true, external: true },
  'السرعة': { original: true, external: true },
  'عرض النبر': { original: true, external: true },
  'تصحيح النبر': { original: true, external: true },
  'نسخ الجملة': { original: true, external: true },
  'نسخ الكلمة': { original: true, external: true },
  'نسخ المقطع': { original: true, external: true },
  'حفظ الكلمة': { original: true, external: true },
  'حفظ المقطع': { original: true, external: true },
  'تحليل النطق': { original: true, external: true },
  'الكلمة التالية/السابقة': { original: true, external: true },
  /*
   * ⚠️ **صُحِّحت هذه الخانةُ ببلاغك — وكانت تُبرّر تسريبًا لا تصفُ ميزة.**
   *
   *    كُتب فيها أوّلًا: «التالي يعبر إلى جمل المصدر بقصد». وذلك
   *    **يناقض بندَ ٢٦** نصًّا: «الرجوع للأصل هو المخرجُ الوحيد من
   *    المصدر». فزرُّ «التالي» كان يفعل خروجًا من المصدر — أي أن
   *    المصفوفةَ سجّلت العطبَ قرارًا بدل أن تكشفه.
   *
   *    والآن: المصدرُ المؤقّت يملك تسلسلَه، والتنقّلُ محصورٌ فيه.
   *    فالخانةُ صارت مدعومةً على الجانبين بنفس المعنى: «تنقّل داخل
   *    مصدرك».
   */
  'الجملة التالية/السابقة (داخل المصدر)': { original: true, external: true },

  /*
   * والخانةُ الجديدةُ هي التي تحرس الحدَّ نفسَه.
   */
  'التنقّل لا يعبر حدَّ المصدر': { original: true, external: true },
  'الرجوع للأصل': {
    /*
     * ⚠️ ولا معنى لها على الأصل: أنت فيه.
     */
    original: 'لا ينطبق — لا مصدرَ تُغادره',
    external: true,
  },
  'الترجمة': {
    original: true,
    external: 'المقطع المؤقّت بلا ترجمةٍ محفوظة — الحقل موجودٌ وفارغ، ولا يُخترَع له نصّ',
  },
});

describe('التكافؤ · الأصليّ مقابل الخارجيّ (بند ٤٠)', () => {
  it('⚠️ ولا خانةَ صامتة — كلُّ خانةٍ مدعومةٌ أو لها سببٌ مكتوب', () => {
    const silent = [];
    for (const [feature, row] of Object.entries(PARITY)) {
      for (const side of ['original', 'external']) {
        const cell = row[side];
        const ok = cell === true || (typeof cell === 'string' && cell.length > 20);
        if (!ok) silent.push(`${feature}/${side}`);
      }
    }
    expect(silent).toEqual([]);
  });

  it('والأغلبيّةُ الساحقةُ متكافئةٌ فعلًا — لا «مدعوم» بشروط', () => {
    /*
     * ⚠️ **ارتفع الرقمُ من ١٧ إلى ١٩ ببلاغك** (بند ٢٦):
     *
     *      «الجملة التالية/السابقة» كانت خانةً بعذرٍ مكتوب، وكان
     *      العذرُ **تبريرَ تسريب** لا وصفَ ميزة: «التالي» يعبر إلى
     *      المصدر الأصليّ. فصار المصدرُ المؤقّت يملك تسلسلَه،
     *      والخانةُ مدعومةً على الجانبين، وأُضيفت خانةٌ تحرس الحدَّ.
     *
     * ⚠️ **والرقمُ مثبَّتٌ عمدًا**: خفضُه لاحقًا يعني أن ميزةً هبطت
     *    إلى «مدعومةٌ بشرط» — وهو ما يجب أن يُوقظ أحدًا.
     */
    const rows = Object.values(PARITY);
    const equal = rows.filter((r) => r.original === true && r.external === true).length;
    expect(`${equal}/${rows.length}`).toBe(`19/${rows.length}`);
  });

  it('⚠️ والمصفوفةُ تغطّي كلَّ ما عدّده الطلب', () => {
    const required = [
      'نطاق الجملة', 'نطاق الكلمة', 'نطاق المقطع',
      'تشغيل الجملة', 'تشغيل الكلمة', 'تشغيل المقطع',
      'التكرار', 'السرعة', 'تصحيح النبر',
      'نسخ الجملة', 'نسخ الكلمة', 'نسخ المقطع',
      'حفظ الكلمة', 'حفظ المقطع', 'تحليل النطق',
      'الكلمة التالية/السابقة', 'الرجوع للأصل',
    ];
    expect(required.filter((f) => !(f in PARITY))).toEqual([]);
  });
});

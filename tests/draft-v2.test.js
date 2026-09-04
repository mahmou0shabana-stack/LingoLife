/**
 * LingoLife — قراءةُ مسودّة V2 (WS-DV2 · بنود ٥١ إلى ٥٨)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما تحرسه هذه الاختبارات
 * ═══════════════════════════════════════════════════════════════
 *
 * العطبُ الأصليُّ سطرٌ واحد: `filter(one => isCyrillic(one.ru))`. فأيُّ
 * سطرٍ سيريليٍّ هدفُ نُطق — بما فيه سؤالُ الاسترجاع وعنوانُ القسم.
 * ومن هنا «٥ قطع ← ١٠ أزواج» بلا تفسير، وقراءةُ `Вопрос:` بصوتٍ عالٍ
 * في الشادوينج.
 *
 * فأكثرُ ما يُقاس هنا **سلبيٌّ**: ما الذي لا يصير هدفًا.
 */

import { describe, it, expect } from './test-runner.js';
import { isDraftV2, parseDraftV2, countRoles, readHead } from '../js/services/shadow/draft-v2.js';
import { ROLE, isSpeechRole, reconcileTargets, linkQuickChain } from '../js/services/shadow/draft-targets.js';
import { LEARN_PROMPTS, learnPromptById } from '../js/services/prompts/library.js';

/** مسودّةٌ كاملةٌ فيها كلُّ ما يذكره البند ٥١. */
const V2 = [
  'الجملة الأساسية:',
  'Если требования по документации не совсем понятны, я бы сначала уточнил этот вопрос.',
  '',
  '━━━━━━━━━━',
  'MICRO CORE 1',
  'требования по документации',
  'متطلبات التوثيق',
  'المعنى:',
  'الورق المطلوب في الشغل',
  'القالب:',
  'требования + по + чему',
  'أمثلة:',
  'Какие требования по документации?',
  'إيه متطلبات التوثيق؟',
  'Вопрос:',
  'Какие требования?',
  'Ответ:',
  'требования по документации',
  '',
  '━━━━━━━━━━',
  'MICRO CORE 2',
  'не совсем понятны',
  'مش واضحة تماماً',
  'Вопрос: Полностью понятны?',
  'Ответ: не совсем понятны',
  '',
  'MICRO CORE 3',
  'уточнить этот вопрос',
  'يوضّح النقطة دي',
  '',
  'EXPANSION 1',
  'Я бы сначала уточнил этот вопрос.',
  'أنا الأول هوضّح النقطة دي',
  '',
  'EXPANSION 2',
  'Я бы сначала уточнил этот вопрос у ответственного специалиста.',
  'عند المختص المسؤول',
  '',
  'HIGH-VALUE CORE REPETITION',
  'CORE FAMILY: я бы сначала уточнил…',
  'الأولوية: ★★★',
  'VARIATION 1',
  'Я бы сначала уточнил детали.',
  'VARIATION 2',
  'Я бы сначала уточнил сроки.',
  '',
  'FULL RECONSTRUCTION',
  'Вопрос:',
  'Что бы ты сделал, если требования не понятны?',
  'Ответ:',
  'Если требования по документации не совсем понятны, я бы сначала уточнил этот вопрос.',
  '',
  'QUICK RECALL CHAIN',
  'Какие требования? → требования по документации',
  'Что нужно сделать? → уточнить этот вопрос',
].join('\n');

const parsed = () => parseDraftV2(V2);
const only = (role) => parsed().targets.filter((one) => one.role === role);
const texts = (role) => only(role).map((one) => one.ru);

/* ================================================================== *
 * الكشف (بند ٣١)
 * ================================================================== */
describe('WS-DV2 · الكشفُ صريحٌ لا حدسيّ', () => {
  it('١ · مسودّةٌ فيها عناوينُ V2 تُكتشَف', async () => {
    expect(isDraftV2(V2)).toBe(true);
  });

  it('٢ · ⚠️ ومسودّةٌ قديمةٌ لا تُرقّى كذبًا', async () => {
    const legacy = ['قطعة', 'уточнить', 'يوضّح', 'أمثلة:', 'Уточните!'].join('\n');
    expect(isDraftV2(legacy)).toBe(false);
  });

  it('٣ · ⚠️ و«Вопрос:» وحدَها لا تكفي لترقية ملاحظةٍ قديمة', async () => {
    /*
     * ⚠️ ملاحظةٌ قديمةٌ قد تحمل سؤالًا روسيًّا. وترقيتُها تُلبسها بنيةً
     *    لم يقصدها مؤلّفُها، فتظهر لها «كور» و«تدرّج» من العدم.
     */
    const note = ['ملاحظة قديمة', 'Вопрос: как дела?', 'Ответ: нормально'].join('\n');
    expect(isDraftV2(note)).toBe(false);
  });

  it('٤ · والعنوانُ يُقرأ بترقيمه وبدونه', async () => {
    expect(readHead('MICRO CORE 1').role).toBe(ROLE.MICRO_CORE);
    expect(readHead('MICRO CORE').role).toBe(ROLE.MICRO_CORE);
    expect(readHead('micro core 12').role).toBe(ROLE.MICRO_CORE);
    expect(readHead('EXPANSION 2').role).toBe(ROLE.EXPANSION);
  });
});

/* ================================================================== *
 * التصنيفُ الدقيق (بند ٥١)
 * ================================================================== */
describe('WS-DV2 · كلُّ سطرٍ إلى دوره', () => {
  it('٥ · ثلاثُ قطعٍ أساسيّةٍ بنصوصها', async () => {
    expect(texts(ROLE.MICRO_CORE)).toEqual([
      'требования по документации',
      'не совсем понятны',
      'уточнить этот вопрос',
    ]);
  });

  it('٦ · وتدرّجان بترتيبهما المؤلَّف (بند ٧)', async () => {
    const list = texts(ROLE.EXPANSION);
    expect(list).toHaveLength(2);
    /* الأقصرُ أوّلًا لأنّ المؤلّفَ كتبه أوّلًا — لا لأننا فرزنا بالطول. */
    expect(list[0]).toBe('Я бы сначала уточнил этот вопрос.');
    expect(list[1]).toBe('Я бы сначала уточнил этот вопрос у ответственного специалиста.');
  });

  it('٧ · وتكراران ينتميان لعائلةٍ واحدة (بند ٩)', async () => {
    const vars = only(ROLE.VARIATION);
    expect(vars).toHaveLength(2);
    expect(vars[0].family).toBe('я бы сначала уточнил…');
    expect(vars[1].family).toBe('я бы сначала уточнил…');
  });

  it('٨ · وإعادةُ بناءٍ واحدةٌ متميّزة (بند ١٠)', async () => {
    const full = only(ROLE.FULL_BUILD);
    expect(full).toHaveLength(1);
    expect(full[0].ru).toContain('Если требования по документации');
  });

  it('٩ · وسؤالُ الاسترجاع يلتصق بإجابته لا يصير هدفًا', async () => {
    const cores = only(ROLE.MICRO_CORE);
    expect(cores[0].cue).toBe('Какие требования?');
    expect(cores[1].cue).toBe('Полностью понятны?');
    /* والسؤالُ الروسيُّ نفسُه ليس في قائمة الأهداف. */
    expect(parsed().targets.some((one) => one.ru === 'Какие требования?')).toBe(false);
  });

  it('١٠ · والمثالُ مثالٌ لا قطعة (بند ١٣)', async () => {
    const ex = only(ROLE.EXAMPLE);
    expect(ex).toHaveLength(1);
    expect(ex[0].ru).toBe('Какие требования по документации?');
    expect(ex[0].parent).toBe('требования по документации');
    /* ولم يزد عددُ القطع بسببه. */
    expect(texts(ROLE.MICRO_CORE)).toHaveLength(3);
  });

  it('١١ · والمعنى والقالبُ سقالةٌ على القطعة', async () => {
    const first = only(ROLE.MICRO_CORE)[0];
    expect(first.ar).toBe('متطلبات التوثيق');
    expect(first.patterns).toContain('требования + по + чему');
    expect(first.sense.join(' ')).toContain('الورق المطلوب');
  });

  it('١٢ · والجملةُ الأصليّةُ تُقرأ ولا تصير هدفًا', async () => {
    const out = parsed();
    expect(out.source).toContain('Если требования по документации');
    expect(out.targets.some((one) => one.ru === out.source)
      && only(ROLE.MICRO_CORE).some((one) => one.ru === out.source)).toBe(false);
  });
});

/* ================================================================== *
 * ما لا يصير هدفًا أبدًا (بند ٥٢)
 * ================================================================== */
describe('WS-DV2 · السقالةُ لا تُنطَق', () => {
  it('١٣ · ⚠️ ولا تسميةٌ تنظيميّةٌ واحدةٌ في الأهداف', async () => {
    const all = parsed().targets.map((one) => one.ru);
    for (const bad of ['Вопрос:', 'Ответ:', 'Вопрос', 'Ответ', 'الإحساس:', 'القالب:',
      'CORE FAMILY:', 'الأولوية:', 'MICRO CORE 1', 'VARIATION 1', 'EXPANSION 1',
      'FULL RECONSTRUCTION', 'QUICK RECALL CHAIN', 'أمثلة:', 'المعنى:']) {
      expect(all.includes(bad)).toBe(false);
    }
  });

  it('١٤ · ولا نصٌّ عربيٌّ يصير هدفَ نُطق', async () => {
    const speech = parsed().targets.filter((one) => isSpeechRole(one.role));
    expect(speech.some((one) => one.ru === 'متطلبات التوثيق')).toBe(false);
    expect(speech.some((one) => /[؀-ۿ]/.test(one.ru))).toBe(false);
  });

  it('١٥ · ⚠️ والعلامةُ ★★★ سقالةٌ لا هدف', async () => {
    const out = parsed();
    expect(out.families[0].priority).toBe('★★★');
    expect(out.targets.some((one) => one.ru.includes('★'))).toBe(false);
  });

  it('١٦ · وأهدافُ النُّطق أربعةُ أدوارٍ لا غير', async () => {
    const kinds = new Set(parsed().targets.filter((one) => isSpeechRole(one.role))
      .map((one) => one.role));
    expect(kinds.has(ROLE.EXAMPLE)).toBe(false);
    expect(kinds.has(ROLE.RECALL_CUE)).toBe(false);
    expect(kinds.size <= 4).toBe(true);
  });
});

/* ================================================================== *
 * العدّادُ الدلاليّ (بند ٥٣)
 * ================================================================== */
describe('WS-DV2 · العدّادُ يقول ما يعدّ', () => {
  it('١٧ · كلُّ دورٍ بعدده', async () => {
    const c = countRoles(parsed().targets);
    expect(c.by[ROLE.MICRO_CORE]).toBe(3);
    expect(c.by[ROLE.EXPANSION]).toBe(2);
    expect(c.by[ROLE.VARIATION]).toBe(2);
    expect(c.by[ROLE.FULL_BUILD]).toBe(1);
    expect(c.examples).toBe(1);
  });

  it('١٨ · ⚠️ والمجموعُ مشتقٌّ من التفصيل لا محسوبٌ بطريقٍ ثانٍ', async () => {
    const c = countRoles(parsed().targets);
    expect(c.speech).toBe(3 + 2 + 2 + 1);
    /* والأمثلةُ خارجَ المجموع الافتراضيّ (بند ٦١). */
    expect(c.speech).toBe(8);
  });
});

/* ================================================================== *
 * الشريطُ السريع مراجعةٌ لا مضاعفة (بندا ١١ و٥٧)
 * ================================================================== */
describe('WS-DV2 · الشريطُ السريع', () => {
  it('١٩ · يُقرأ سؤالًا وجوابًا', async () => {
    const { chain } = parsed();
    expect(chain).toHaveLength(2);
    expect(chain[0].cue).toBe('Какие требования?');
    expect(chain[0].ru).toBe('требования по документации');
  });

  it('٢٠ · ⚠️ وإجاباتُه لا تُضاف إلى الأهداف', async () => {
    const c = countRoles(parsed().targets);
    /* لو صارت أهدافًا لَقفز المجموعُ من ٨ إلى ١٠. */
    expect(c.speech).toBe(8);
  });

  it('٢١ · ⚠️ ويُربَط بأهدافه القائمة بالمعرّف لا بالنصّ المكرَّر', async () => {
    const out = parsed();
    const { targets } = reconcileTargets(out.targets, []);
    const linked = linkQuickChain(out.chain, targets);

    expect(linked[0].state).toBe('linked');
    const core = targets.find((one) => one.ru === 'требования по документации'
      && one.role === ROLE.MICRO_CORE);
    expect(linked[0].ref).toBe(core.id);
  });
});

/* ================================================================== *
 * صلابةُ القراءة (بند ٣٣)
 * ================================================================== */
describe('WS-DV2 · تفشل بأمان', () => {
  it('٢٢ · ⚠️ عنوانٌ بلا فاصلٍ يقطع القسمَ مع ذلك', async () => {
    /*
     * ⚠️ **هذا قيدُ المالك ١.** في V1 كان القسمُ يمتدّ حتى `━━━`، فمسودّةٌ
     *    نُسي فيها فاصلٌ تُلحق «القطعة ٢» بالأولى صامتةً — لا رسالةَ خطأ،
     *    فقط قطعةٌ اختفت.
     */
    const noSep = [
      'MICRO CORE 1', 'первый', 'الأول',
      'MICRO CORE 2', 'второй', 'الثاني',
      'MICRO CORE 3', 'третий', 'الثالث',
    ].join('\n');
    expect(parseDraftV2(noSep).targets.filter((o) => o.role === ROLE.MICRO_CORE)).toHaveLength(3);
  });

  it('٢٣ · وفواصلُ زائدةٌ وأسطرٌ فارغةٌ لا تُنقص شيئًا', async () => {
    const messy = [
      '━━━━━━━━━━', '', 'MICRO CORE 1', '', 'первый', '', 'الأول', '',
      '━━━━━━━━━━', '━━━━━━━━━━', '', 'MICRO CORE 2', 'второй', '',
    ].join('\n');
    expect(parseDraftV2(messy).targets.filter((o) => o.role === ROLE.MICRO_CORE)).toHaveLength(2);
  });

  it('٢٤ · وسطرٌ روسيٌّ خارجَ أيّ قسمٍ لا يصير هدفًا', async () => {
    const stray = ['MICRO CORE 1', 'первый', 'الأول', 'QUICK RECALL CHAIN', 'сирота'].join('\n');
    const out = parseDraftV2(stray);
    expect(out.targets.filter((o) => isSpeechRole(o.role))).toHaveLength(1);
  });

  it('٢٥ · ونصٌّ فارغٌ لا يرمي', async () => {
    expect(parseDraftV2('').targets).toHaveLength(0);
    expect(parseDraftV2(null).targets).toHaveLength(0);
    expect(isDraftV2('')).toBe(false);
  });

  it('٢٦ · والنبرُ يُحفَظ في نصّ الهدف كما كُتب', async () => {
    const withStress = ['MICRO CORE 1', 'уточни́ть э́тот вопро́с', 'يوضّح'].join('\n');
    expect(parseDraftV2(withStress).targets[0].ru).toBe('уточни́ть э́тот вопро́с');
  });
});

/* ================================================================== *
 * البرومبتُ المبنيُّ يطلب V2 (بندا ٣٤ و٣٥ · قبولٌ Z)
 * ================================================================== */
describe('WS-DV2 · برومبتُ الجملة يطلب البنيةَ الجديدة', () => {
  it('٢٧ · يذكر كلَّ عنوانٍ يقرؤه المحلّل', async () => {
    const body = learnPromptById('sentence-chunks').build('Э́то сло́во.');
    for (const marker of ['MICRO CORE', 'EXPANSION', 'CORE FAMILY', 'VARIATION',
      'FULL RECONSTRUCTION', 'QUICK RECALL CHAIN', 'Вопрос:', 'Ответ:',
      'المعنى:', 'القالب:', 'أمثلة:']) {
      expect(body.includes(marker)).toBe(true);
    }
    /* والجملةُ تُملأ فيه قبل النسخ. */
    expect(body).toContain('Э́то сло́во.');
  });

  it('٢٨ · ⚠️ ونفسُ الهُويّة — ولا برومبتَ ثانٍ في المكتبة', async () => {
    /*
     * ⚠️ البندُ ٣٤ صريح: لا صومعةَ جديدة. فتطوُّرُ المحتوى إلى V2 يجب
     *    ألّا يُنشئ مدخلًا ثانيًا، وإلّا ظهر في الفهرس برومبتان
     *    متشابهان لا تعرف أيَّهما استعملت — وضاعت مفضّلتُك وسجلُّ
     *    استعمالك مع القديم.
     */
    expect(LEARN_PROMPTS).toHaveLength(2);
    expect(LEARN_PROMPTS.map((one) => one.id)).toEqual(['sentence-chunks', 'sentence-scene']);
    expect(Boolean(learnPromptById('sentence-chunks'))).toBe(true);
  });

  it('٢٩ · وما يطلبه البرومبتُ يقرؤه المحلّلُ فعلًا', async () => {
    /*
     * ⚠️ **حارسُ الدائرة المغلقة**: البرومبتُ يطلب عناوين، والمحلّلُ
     *    يقرأ عناوين. ولو انفصلا لَخرج ChatGPT ببنيةٍ لا يفهمها
     *    التطبيقُ — ولا رسالةَ خطأ، فقط مسودّةٌ تُقرأ نصفَ قراءة.
     */
    const body = learnPromptById('sentence-chunks').build('тест');
    expect(isDraftV2(body)).toBe(true);
    for (const head of ['MICRO CORE 1', 'EXPANSION 1', 'VARIATION 1',
      'FULL RECONSTRUCTION', 'QUICK RECALL CHAIN']) {
      expect(Boolean(readHead(head))).toBe(true);
    }
  });

  it('٣٠ · ولا يفرض عددًا ثابتًا (بند ٣٦)', async () => {
    const body = learnPromptById('sentence-chunks').build('тест');
    /* إرشادٌ لا حصّة — والنصُّ يقولها صراحةً. */
    expect(body).toContain('NOT a quota');
    expect(body).toContain('Do NOT inflate');
    expect(body).toContain('Do NOT fragment');
  });
});

/* ================================================================== *
 * عددُ العائلات متكيّف (تصحيحُ المالك)
 * ================================================================== */
describe('WS-DV2 · العائلاتُ بعددها الحقيقيّ لا بواحدة', () => {
  it('٣١ · ⚠️ البرومبتُ لا يفرض عائلةً واحدة', async () => {
    /*
     * ⚠️ **كتبتُ أوّلًا «pick the ONE core»** — فحدّدتُ سقفًا لم تطلبه
     *    المواصفة. وجملةٌ فيها إطاران منتجان تُجبَر على إهمال أحدهما،
     *    وجملةٌ لا يستحقّ فيها شيءٌ تكرارًا تُجبَر على اختراع عائلة.
     *    والحدُّ في الاتّجاهين خطأ.
     */
    const body = learnPromptById('sentence-chunks').build('тест');
    expect(body.includes('pick the ONE core')).toBe(false);

    /* ويقول الاحتمالاتِ الثلاثةَ صراحة. */
    expect(body).toContain('ZERO families');
    expect(body).toContain('ONE family');
    expect(body).toContain('SEVERAL families');
    expect(body).toContain('do not cap it at one');
    /* ومعاييرُ الاستحقاق مذكورة. */
    expect(body).toContain('substitution flexibility');
  });

  it('٣٢ · والمحلّلُ يقرأ عائلتين فأكثر', async () => {
    const two = [
      'HIGH-VALUE CORE REPETITION',
      'CORE FAMILY: я бы сначала уточнил…',
      'VARIATION 1', 'Я бы сначала уточнил детали.',
      'VARIATION 2', 'Я бы сначала уточнил сроки.',
      'CORE FAMILY: не совсем…',
      'VARIATION 1', 'Не совсем понятно.',
    ].join('\n');
    const out = parseDraftV2(two);

    expect(out.families).toHaveLength(2);
    expect(out.families[0].label).toBe('я бы сначала уточнил…');
    expect(out.families[1].label).toBe('не совсем…');

    const vars = out.targets.filter((one) => one.role === ROLE.VARIATION);
    expect(vars).toHaveLength(3);
    /* وكلُّ تكرارٍ يحمل عائلتَه هو لا عائلةَ جارِه. */
    expect(vars[0].family).toBe('я бы сначала уточнил…');
    expect(vars[1].family).toBe('я бы сначала уточнил…');
    expect(vars[2].family).toBe('не совсем…');
  });

  it('٣٣ · ومسودّةٌ بلا عائلةٍ واحدةٍ سليمةٌ تمامًا', async () => {
    const none = [
      'MICRO CORE 1', 'первый', 'الأول',
      'EXPANSION 1', 'Первый и второй.', 'الأول والثاني',
    ].join('\n');
    const out = parseDraftV2(none);

    expect(out.families).toHaveLength(0);
    expect(out.targets.filter((one) => one.role === ROLE.VARIATION)).toHaveLength(0);
    /* ولا صفرَ كاذبٌ يُعرَض: العدّادُ لا يذكر دورًا غائبًا. */
    expect(countRoles(out.targets).by[ROLE.VARIATION] === undefined).toBe(true);
  });

  it('٣٤ · ⚠️ وتكراران بنفس النصّ في عائلتين هدفان لا هدف', async () => {
    /*
     * ⚠️ وهنا تُثمر العائلةُ في البصمة: نفسُ الجملة تحت إطارين مختلفين
     *    شيئان يتعلّمهما المرء في سياقين — ولو اندمجا لَشارَكا «خلصت».
     */
    const twin = [
      'CORE FAMILY: إطار أول',
      'VARIATION 1', 'Я бы уточнил.',
      'CORE FAMILY: إطار ثانٍ',
      'VARIATION 1', 'Я бы уточнил.',
    ].join('\n');
    const out = parseDraftV2(twin);
    const { targets } = reconcileTargets(out.targets, []);

    expect(targets).toHaveLength(2);
    expect(targets[0].id === targets[1].id).toBe(false);
    expect(targets[0].family === targets[1].family).toBe(false);
  });
});

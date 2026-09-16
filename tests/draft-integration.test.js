/**
 * LingoLife — المسودّةُ في صفحة الجملة، وأسئلتُها تُنطَق (WS-DI)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ أربعةُ عيوبٍ تحرسها هذه الملفّات — وثلاثةٌ منها من صنعي
 * ═══════════════════════════════════════════════════════════════
 *
 * ١ · **المسودّةُ كانت في المكان الخطأ.** وضعتُها في WS-DV3 في اللوح
 *     الأيمن، وهو سطحُ **سياق** لا سطحُ **قراءة**. والمسودّةُ مادّةُ
 *     الجملة، فمكانُها صفحةُ الجملة اليسرى مع القواعد والملخّص والصور.
 *
 * ٢ · **سؤالُ الاسترجاع كان سقالةً صامتة.** `cue` سلسلةٌ تُعرَض ولا
 *     تُنطَق. والمتعلّمُ يجب أن **يسمع** السؤالَ الروسيَّ فيسترجع —
 *     السؤالُ مُدخَلٌ روسيٌّ بذاته لا تعليقٌ على مُدخَل.
 *
 * ٣ · **اللصقُ لا يظهر أثرُه حتى تغادر وتعود.** `drawDerived` كُتبت
 *     لتفادي هذا بالضبط، ثمّ انتقل سطحُ التحرير ولم تُنقَل معه
 *     حاويتاها — فبقي العلاجُ وانتقل المريض.
 *
 * ٤ · **«الإحساس» كان مرادفًا لـ«المعنى»** فيبتلع ترجمةَ القلب.
 *
 * ⚠️ **وما لا تحرسه**: هذه حرّاسٌ بنيويّون يقيسون الكودَ والنموذج. أمّا
 *    أنّ الشاشةَ ترسم فعلًا فقِيس حيًّا بمسبارٍ — ولا أدّعي غيرَ ذلك.
 */

import { describe, it, expect } from './test-runner.js';
import { parseDraftV2, isDraftV2, CHAIN_PARENT } from '../js/services/shadow/draft-v2.js';
import {
  ROLE, isSpeechRole, isPracticeRole, RECALL_ROLES, PRACTICE_ROLES, SPEECH_ROLES, ROOT_ROLES,
  reconcileTargets,
} from '../js/services/shadow/draft-targets.js';
import {
  learnModelSync, speechTargets, coreTargets, sentenceSummary, GROUP_ORDER,
} from '../js/services/shadow/draft-learning.js';
import { learnPromptById, LEARN_PROMPTS } from '../js/services/prompts/library.js';

/** مسودّةٌ بالشكل الجديد: اقترانٌ عربيٌّ تحت كلّ روسيّ، وجذرٌ وإحساس. */
const V3 = [
  'مسودة — Core Recall V2',
  '',
  'الجملة الأساسية:',
  'При работе с технической документацией важно обращать внимание на статус.',
  'وإحنا بنشتغل على التوثيق الفني مهم ناخد بالنا من الحالة',
  '',
  '━━━━━━━━━━',
  'MICRO CORE 1',
  'при рабо́те с техни́ческой документа́цией',
  'وإحنا بنشتغل على التوثيق الفني',
  'المعنى:',
  'سياق الشغل نفسه',
  'الجذر والعيلة:',
  'рабо́та · рабо́чий · обраба́тывать',
  'شغل · عامل · يعالج',
  'الإحساس:',
  'إنت جوّه الموقف مش بتتكلم عنه من برّه',
  'القالب:',
  'при + предложный',
  'أمثلة:',
  'При прове́рке докуме́нтов бу́дьте внима́тельны.',
  'وإنت بتفحص المستندات خلّي بالك',
  'Вопрос:',
  'С чем мы сейча́с рабо́таем?',
  'بنشتغل على إيه دلوقتي؟',
  'Ответ:',
  'С техни́ческой документа́цией.',
  'على التوثيق الفني',
  'Вопрос:',
  'Э́то на́ша основна́я зада́ча?',
  'دي مهمتنا الأساسية؟',
  'Ответ:',
  'Да, э́то часть на́шей рабо́ты.',
  'أيوه دي جزء من شغلنا',
  '',
  '━━━━━━━━━━',
  'MICRO CORE 2',
  'нали́чие докуме́нта',
  'وجود المستند',
  '',
  'EXPANDING RECALL',
  'EXPANSION 1',
  'Ва́жно обраща́ть внима́ние на нали́чие докуме́нта.',
  'مهم ناخد بالنا من وجود المستند',
  '',
  'HIGH-VALUE CORE REPETITION',
  'CORE FAMILY: не то́лько …, но и …',
  'الأولوية: ★★★',
  'VARIATION 1',
  'Мы проверя́ем не то́лько докуме́нты, но и обору́дование.',
  'بنفحص مش بس المستندات لكن كمان المعدات',
  '',
  'FULL RECONSTRUCTION',
  'Вопрос:',
  'Что и́менно ва́жно при рабо́те с документа́цией?',
  'إيه بالظبط المهم وإحنا بنشتغل على التوثيق؟',
  'Ответ:',
  'При рабо́те с техни́ческой документа́цией ва́жно обраща́ть внима́ние на ста́тус.',
  'وإحنا بنشتغل على التوثيق الفني مهم ناخد بالنا من الحالة',
  '',
  'QUICK RECALL CHAIN',
  'Вопрос:',
  'С чем мы рабо́таем?',
  'بنشتغل على إيه؟',
  'Ответ:',
  'С техни́ческой документа́цией.',
  'على التوثيق الفني',
].join('\n');

const read = () => parseDraftV2(V3);
const pick = (role) => read().targets.filter((one) => one.role === role);
const core1 = () => pick(ROLE.MICRO_CORE)[0];

let VIEW = '';
const view = async () => {
  if (!VIEW) VIEW = await (await fetch('../js/views/shadow-view.js')).text();
  return VIEW;
};

/* ================================================================== *
 * أ) حقولُ السند الجديدة — سقالةٌ لا أهداف                             *
 * ================================================================== */
describe('WS-DI · الجذرُ والإحساس سقالةٌ تُعرَض ولا تُنطَق', () => {
  it('١ · الجذرُ والعيلةُ زوجٌ مرتَّبٌ روسيٌّ فوقَ عربيّ', async () => {
    /*
     * ⚠️ **والتقابلُ هو الفائدةُ كلُّها**: «прове́рить · проверя́ть» فوق
     *    «يتحقق · يفحص كعملية» بنفس الترتيب. وفصلُهما في حقلين يجعل
     *    الترجمةَ سطرًا لا يعرف أيَّ كلمةٍ يترجم.
     */
    const roots = core1().roots;
    expect(roots).toHaveLength(1);
    expect(roots[0].ru).toContain('рабо́та');
    expect(roots[0].ar).toContain('شغل');
  });

  it('٢ · والإحساسُ حقلٌ مستقلٌّ لا يبتلع ترجمةَ القلب', async () => {
    /*
     * ⚠️ **العطبُ**: «الإحساس» كان مرادفًا لـ«المعنى» في جدول العناوين،
     *    و`attachSupport('meaning')` تضع أوّلَ نصٍّ في `ar`. فمسودّةٌ
     *    بلا سطرِ ترجمةٍ تحت القلب كانت تأخذ سطرَ الإحساس ترجمةً —
     *    فيقول التطبيقُ إنّ معنى «при работе» هو شرحٌ فلسفيٌّ عن «при».
     */
    const one = core1();
    expect(one.feel).toHaveLength(1);
    expect(one.feel[0]).toContain('جوّه الموقف');
    expect(one.ar).toBe('وإحنا بنشتغل على التوثيق الفني');
  });

  it('٣ · القالبُ لا يُنطَق، والعائلةُ تُنطَق ولا تُعَدُّ قلبًا', async () => {
    /*
     * ⚠️ **أُعيد توجيهُ هذا الحارس في WS-DRAFT-CONTENT — لا أُسكِت.**
     *
     *    كان يشترط ألّا يكون «الجذر والعيلة» هدفًا أصلًا، وكان ذلك
     *    صحيحًا يومَ كُتب: القرارُ المكتوبُ في `draft-v2.js` أنّ العائلة
     *    «سقالةٌ لا هدف» خوفًا من تضخيم عدّ القلوب.
     *
     *    وطلبتَ صراحةً أن تصير قابلةً للنُّطق: «موجودة في المسودّة ومش
     *    بقدر أتدرّب على نطقها». فالقرارُ تبدّل — والخوفُ الذي وُلد منه
     *    الحارسُ **ما زال محروسًا**، لكن في محلّه الصحيح: لا في منع
     *    الهدف، بل في منع دخوله `SPEECH_ROLES`.
     *
     *    فالمحروسُ الآن ثلاثة: العائلةُ هدفٌ · ودورُها ليس قلبًا ·
     *    وعددُ القلوب لم يتحرّك. والقالبُ (`при + предложный`) يبقى
     *    خارجًا — صيغةٌ نحويّةٌ لا جملةٌ تُقال، ولم يطلب أحدٌ نُطقَها.
     */
    const rus = read().targets.map((one) => one.ru);
    expect(rus.includes('рабо́та · рабо́чий · обраба́тывать')).toBe(true);
    expect(rus.includes('при + предложный')).toBe(false);
    expect(pick(ROLE.MICRO_CORE)).toHaveLength(2);
    const fam = read().targets.filter((one) => one.ru === 'рабо́та · рабо́чий · обраба́тывать');
    expect(fam.every((one) => one.role === ROLE.ROOT_FAMILY)).toBe(true);
  });

  it('٤ · وترجمةُ الجملة الأساسيّة تُقرأ كذلك', async () => {
    expect(read().sourceAr).toContain('التوثيق الفني');
  });
});

/* ================================================================== *
 * ب) السؤالُ والإجابةُ وحدتا نُطقٍ حقيقيّتان                            *
 * ================================================================== */
describe('WS-DI · أسئلةُ الاسترجاع تُنطَق ولا تُعَدُّ قلوبًا', () => {
  it('٥ · السؤالُ وحدةٌ بدورٍ خاصّ ومعها ترجمتُها', async () => {
    const qs = pick(ROLE.RECALL_CUE);
    expect(qs.length > 0).toBe(true);
    expect(qs[0].ru).toBe('С чем мы сейча́с рабо́таем?');
    /* ⚠️ والترجمةُ على الوحدة نفسِها — وإلّا ظهر السؤالُ بلا سنَد. */
    expect(qs[0].ar).toBe('بنشتغل على إيه دلوقتي؟');
    expect(isPracticeRole(ROLE.RECALL_CUE)).toBe(true);
    /* ولا يُعَدُّ قلبًا — وهذا شرطُ المالك الصريح. */
    expect(isSpeechRole(ROLE.RECALL_CUE)).toBe(false);
  });

  it('٦ · والإجابةُ المنطوقةُ وحدةٌ كذلك — لا سلسلةٌ صامتة', async () => {
    /*
     * ⚠️ **والأبُ جزءٌ من القياس — وإلّا مرّ الحارسُ بالصدفة.** قِستُ
     *    هذا الحارسَ بإبطال تسطيحِ الأزواج وحدَه، فبقي أخضرَ: إجابةُ
     *    **الشريط** تحمل نفسَ النصّ ونفسَ الترجمة، فوقعت في يده.
     *    فصار يُطلَب جوابُ القلب بعينه.
     */
    const as = pick(ROLE.RECALL_ANSWER).filter((one) => one.parent !== CHAIN_PARENT);
    expect(as[0].ru).toBe('С техни́ческой документа́цией.');
    expect(as[0].ar).toBe('على التوثيق الفني');
    expect(as[0].parent).toBe('при рабо́те с техни́ческой документа́цией');
    expect(isPracticeRole(ROLE.RECALL_ANSWER)).toBe(true);
    expect(isSpeechRole(ROLE.RECALL_ANSWER)).toBe(false);
  });

  it('٧ · وزوجان تحت قلبٍ واحدٍ يبقيان — ولا يُبتلَع الأوّل', async () => {
    /*
     * ⚠️ **العطبُ**: `cue` و`reply` سلسلتان مفردتان، فالسؤالُ الثاني
     *    كان يكتب فوق الأوّل **بلا خطأ يُرفَع**. فقلبٌ فيه سؤالان يفقد
     *    نصفَ استرجاعه صامتًا.
     */
    const one = core1();
    expect(one.pairs).toHaveLength(2);
    expect(one.pairs[0].cue).toBe('С чем мы сейча́с рабо́таем?');
    expect(one.pairs[1].cue).toBe('Э́то на́ша основна́я зада́ча?');
    /* وأوّلُ زوجٍ يبقى في `cue` لأنّ البصمةَ تقرؤه — فلا معرّفَ يندثر. */
    expect(one.cue).toBe('С чем мы сейча́с рабо́таем?');
  });

  it('٨ · والترتيبُ المؤلَّف: سؤالٌ فجوابٌ فسؤالٌ فجواب', async () => {
    const flat = read().targets.map((one) => one.role);
    const at = flat.indexOf(ROLE.MICRO_CORE);
    expect(flat.slice(at, at + 5)).toEqual([
      ROLE.MICRO_CORE, ROLE.RECALL_CUE, ROLE.RECALL_ANSWER,
      ROLE.RECALL_CUE, ROLE.RECALL_ANSWER,
    ]);
  });

  it('٩ · وسؤالُ إعادة البناء يسبق إجابته — وإلّا صار الاسترجاعُ قراءة', async () => {
    /*
     * ⚠️ **وهذا انحدارٌ أمسكه القياسُ**: أوّلُ تسطيحٍ كتبتُه وضع الوحداتِ
     *    بعد الهدف دائمًا، فصار الشادوينج ينطق **إجابةَ** إعادة البناء
     *    ثمّ سؤالَها. فصار الترتيبُ يتبع ما كُتب: ما سبق نصَّه يسبقه.
     */
    const flat = read().targets;
    const q = flat.findIndex((one) => one.ru.startsWith('Что и́менно'));
    const a = flat.findIndex((one) => one.role === ROLE.FULL_BUILD);
    expect(q >= 0 && a >= 0).toBe(true);
    expect(q < a).toBe(true);
  });

  it('١٠ · وشريطُ الاسترجاع السريع يُنطَق — وكان معروضًا لا غير', async () => {
    const out = read();
    expect(out.chain).toHaveLength(1);
    expect(out.chain[0].cueAr).toBe('بنشتغل على إيه؟');
    const fromChain = out.targets.filter((one) => one.parent === CHAIN_PARENT);
    expect(fromChain.map((one) => one.role))
      .toEqual([ROLE.RECALL_CUE, ROLE.RECALL_ANSWER]);
  });

  it('١١ · ⚠️ وإجابةُ الشريط لا تتصادم مع قلبٍ يحمل نصَّها', async () => {
    /*
     * ⚠️ إجابةُ الشريط تعيد نصَّ هدفٍ قائمٍ حرفيًّا. فلولا أبٌ يميّزها
     *    لَتساوت البصمتان، ولَتشارك هدفان معرّفًا واحدًا وحالةَ «خلصت»
     *    معه — وهو عيبُ الهُويّة الذي وُجدت WS-DV2 لإبطاله.
     */
    const targets = read().targets;
    const same = targets.filter((one) => one.ru === 'С техни́ческой документа́цией.');
    expect(same.length > 1).toBe(true);
    const ids = reconcileTargets(targets, []).targets.map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('١٢ · والعدّان لا يختلطان: قلوبٌ ووحداتُ نُطق', async () => {
    /*
     * ⚠️ **شرطُ المالك حرفيًّا**: «لا تُبلّغ عن ١٤ قلبًا لأنّ ٧ أسئلةٍ
     *    تُنطَق أيضًا». فـ`speech` يعدّ الأدوارَ الدلاليّة، و`units`
     *    يعدّ ما يدخل الشادوينج — وهما رقمان لا رقم.
     */
    const model = learnModelSync({ text: V3 });
    /*
     * ⚠️ **وهذا هو بيتُ القصيد بعد WS-DRAFT-CONTENT**: `speech` لم يتحرّك
     *    (٥ كما كان) رغم دخول عائلات الجذر التدريبَ — لأنّها ليست قلبًا.
     *    و`units` وحدَه هو الذي زاد، وهو المقصود: عددُ ما يدخل الشادوينج.
     *    فالرقمان ما زالا رقمين — وهو شرطُ المالك بحرفه.
     */
    expect(model.counts.speech).toBe(5);
    expect(model.counts.recall).toBe(7);
    expect(model.counts.units).toBe(12 + (model.counts.byRole[ROLE.ROOT_FAMILY] || 0));
    expect((model.counts.byRole[ROLE.ROOT_FAMILY] || 0) > 0).toBe(true);
    expect(model.counts.byRole[ROLE.MICRO_CORE]).toBe(2);

    const sum = sentenceSummary(model);
    expect(sum.speech).toBe(5);
    expect(sum.rows.map((r) => r.role)).toContain(ROLE.RECALL_CUE);
    /* وصفُّ القلوب يقول اثنين لا تسعة. */
    expect(sum.rows.find((r) => r.role === ROLE.MICRO_CORE).total).toBe(2);
  });

  it('١٣ · والاختيارُ الافتراضيُّ يحفظ السلسلة — ولا إجاباتٍ يتيمة', async () => {
    const model = learnModelSync({ text: V3 });
    const able = speechTargets(model.targets);
    expect(able.some((one) => one.role === ROLE.RECALL_CUE)).toBe(true);
    expect(able.some((one) => one.role === ROLE.RECALL_ANSWER)).toBe(true);
    expect(able.some((one) => one.role === ROLE.EXAMPLE)).toBe(false);
    /* والأدوارُ الدلاليّةُ بابُها الخاصّ — فلا يُخلَط العدّان في الكود. */
    expect(coreTargets(model.targets).every((one) => isSpeechRole(one.role))).toBe(true);
    /* ⚠️ ومجموعةٌ ثالثةٌ صارت في التدريب (عائلةُ الجذر) — والجمعُ يقولها
         صراحةً حتّى لا يُضاف دورٌ رابعٌ يومًا بلا أن ينتبه أحد. */
    expect(PRACTICE_ROLES.size)
      .toBe(SPEECH_ROLES.size + RECALL_ROLES.size + ROOT_ROLES.size);
  });

  it('١٤ · والعربيُّ سندٌ بصريٌّ لا يدخل نُطقَ الروسيّ', async () => {
    /*
     * ⚠️ **والقياسُ بنيويٌّ لا ادّعائيّ**: المقطعُ يُبنى من `{ru, ar}`،
     *    و`ru` وحدَه يصير `sourceTextSnapshot` الذي ينطقه المحرّك.
     *    فالعربيُّ لا يبلغ TTS ما دام هذا السطرُ كما هو.
     */
    const src = await view();
    expect(src).toContain('const rows = picked.map((one) => ({ ru: one.ru, ar: one.ar || \'\' }));');
  });
});

/* ================================================================== *
 * ج) صفحةُ الجملة                                                     *
 * ================================================================== */
describe('WS-DI · المسودّةُ في صفحة الجملة لا في اللوح الأيمن', () => {
  it('١٥ · منبعُ المسودّة مسجَّلٌ بين منابع الورقة اليسرى', async () => {
    const src = await view();
    /*
     * ⚠️ **ولا منطقةَ واجهةٍ جديدة** (شرطُ الطلب): سطرٌ في سجلّ `WELLS`
     *    كما تُضاف القواعدُ والصورُ والأصوات — لا صفحةٌ ثالثة.
     */
    expect(src).toContain('const WELLS = {');
    expect(src).toContain("label: 'مسودّة',");
    expect(src).toContain('draw: (rows) => draftWellHtml(rows[0] || null),');
  });

  it('١٦ · والمسودّةُ تُحَلّ بالنسب لا بفهرسِ خريطةٍ لا تشمل التدريب', async () => {
    const src = await view();
    /*
     * ⚠️ عطبُ WS-DV3 نفسُه: `material` خريطةٌ لمقاطع المصدر وحدَها،
     *    ومقاطعُ التدريب تُلحَق بعدها فيقع فهرسُها خارجَها.
     */
    const at = src.indexOf('async function activeDraftModel()');
    expect(at > 0).toBe(true);
    const body = src.slice(at, at + 700);
    expect(body.includes('draftLineage()')).toBe(true);
    expect(body.indexOf('draftLineage()') < body.indexOf('material.get')).toBe(true);
  });

  it('١٧ · ولا كتابةَ من مجرّد رسمِ الصفحة', async () => {
    const src = await view();
    /*
     * ⚠️ صفحةُ الجملة تُعاد رسمُها مع **كلّ نقلةِ هدف**. فكتابةٌ هنا
     *    تعني `rev++` و`dirty=1` عشراتِ المرّات في جلسةٍ واحدة، وهي
     *    تسافر على الشبكة في المزامنة.
     */
    const at = src.indexOf('async function activeDraftModel()');
    const body = src.slice(at, at + 700);
    expect(body.includes('learnModel(')).toBe(false);
    expect(body.includes('modelForDraft')).toBe(true);
  });

  it('١٨ · وتتبع الجملةَ الجاريةَ وحدَها بين المنابع', async () => {
    const src = await view();
    expect(src).toContain("if (well === 'draft') renderWells().catch(() => {});");
  });

  it('١٩ · ولا يُخفى قسمٌ من المسودّة', async () => {
    const src = await view();
    const at = src.indexOf('function draftCardHtml(');
    const body = src.slice(at, src.indexOf('function draftWellHtml('));
    for (const label of ['المعنى', 'الجذر والعيلة', 'الإحساس', 'القالب', 'أمثلة']) {
      expect(body.includes(`'${label}'`)).toBe(true);
    }
    const whole = src.slice(src.indexOf('function draftWellHtml('), src.indexOf('const WELLS = {'));
    expect(whole.includes('الجملة الأساسية')).toBe(true);
    expect(whole.includes('QUICK RECALL CHAIN')).toBe(true);
    expect(whole.includes('CORE FAMILY')).toBe(true);
  });

  it('٢٠ · والترجمةُ تحت الروسيِّ مباشرةً — بنيةً لا اتّفاقًا', async () => {
    const src = await view();
    /*
     * ⚠️ **الاقترانُ في دالّةٍ واحدة**: `draftPairHtml` تكتب السطرين
     *    معًا، فلا يمكن أن يفصل بينهما عنوانٌ أو شرحٌ في موضعٍ نسيَه
     *    أحدُهم — وهذا أضمنُ من قاعدةٍ مكتوبةٍ في تعليق.
     */
    const at = src.indexOf('function draftPairHtml(');
    const body = src.slice(at, at + 320);
    expect(body.indexOf('dw-ru') < body.indexOf('dw-ar')).toBe(true);
    /* ولا عنصرَ بينهما في القالب. */
    expect(/dw-ru[\s\S]{0,140}dw-ar/.test(body)).toBe(true);
  });
});

/* ================================================================== *
 * د) اللصقُ يصير قابلًا للتدريب فورًا                                   *
 * ================================================================== */
describe('WS-DI · بعد الحفظ مباشرةً — بلا مغادرةٍ ورجوع', () => {
  it('٢١ · حاويتا «ما اشتُقّ» موجودتان في كلّ سطحِ لصق', async () => {
    const src = await view();
    /*
     * ⚠️ **هذا هو العطبُ المُبلَّغ بعينه.** `drawDerived` كُتبت لتفادي
     *    إعادةِ رسمِ الصندوق، وتقرأ `[data-draft-derived]`. ثمّ انتقل
     *    سطحُ التحرير إلى لوح التعلّم **ولم تُنقَل معه الحاويتان**،
     *    فصارت الدالّةُ تعود من أوّل سطرٍ بلا أثر.
     *
     * ثلاثةُ أسطحِ لصقٍ قائمة: صفحةُ الجملة · تبويبُ القطع · «عدّل».
     */
    expect((src.match(/data-draft-derived/g) || []).length >= 4).toBe(true);
    expect((src.match(/data-draft-count/g) || []).length >= 4).toBe(true);
  });

  it('٢٢ · والحفظُ يُبطل النموذجَ المخزَّن — وإلّا بقيت الصفحةُ قديمة', async () => {
    const src = await view();
    const at = src.indexOf('function scheduleDraftSave(');
    const body = src.slice(at, at + 2600);
    expect(body.includes('draftModelCache = {')).toBe(true);
    /* والتحديثُ بعد الحفظ لا قبله. */
    expect(body.indexOf('saveDraftText') < body.indexOf('draftModelCache = {')).toBe(true);
  });

  it('٢٣ · ولا يُلمَس الصندوقُ الذي تكتب فيه', async () => {
    const src = await view();
    /*
     * ⚠️ إعادةُ رسم السطح كلِّه تبني `<textarea>` جديدةً فيقفز المؤشّرُ
     *    إلى أوّلها — وهو العطبُ الذي وُلدت `drawDerived` لتفاديه.
     *    فالتحديثُ بعد الحفظ **حاويتان لا صفحة**.
     */
    const at = src.indexOf('function scheduleDraftSave(');
    const body = src.slice(at, at + 2600);
    expect(body.includes('renderWells()')).toBe(false);
    expect(body.includes("!$('[data-draft-box]')")).toBe(true);
  });

  it('٢٤ · والعدُّ يقرأ نموذجَ V2 لا تقطيعَ V1', async () => {
    const src = await view();
    const at = src.indexOf('function drawDerived(');
    const body = src.slice(at, at + 1900);
    expect(body.includes('isDraftV2(text)')).toBe(true);
    expect(body.includes('learnModelSync({ text })')).toBe(true);
    /* ⚠️ وزرٌّ بلا مسودّةٍ محفوظةٍ وعدٌ كاذب — فالمعرّفُ شرطٌ لظهوره. */
    expect(body.includes('able && draftId')).toBe(true);
  });

  it('٢٥ · ولا يُعاد بناءُ الجلسة ولا تُغادَر الشاشة', async () => {
    const src = await view();
    const at = src.indexOf('function scheduleDraftSave(');
    const body = src.slice(at, at + 2600);
    for (const bad of ['location.reload', 'renderShadow(', 'location.hash =']) {
      expect(body.includes(bad)).toBe(false);
    }
  });

  it('٢٦ · والمعرّفاتُ لا تُسَكّ من جديدٍ لمجرّد أنّ الصفحةَ انتعشت', async () => {
    /*
     * ⚠️ التوفيقُ بالبصمة لا بالموضع — فحفظٌ لم يغيّر النصَّ يُبقي كلَّ
     *    معرّفٍ وتقدُّمَه. وهذا ما يمنع «أهدافًا مكرّرة» بعد كلّ لصقة.
     */
    const first = reconcileTargets(read().targets, []).targets;
    const again = reconcileTargets(read().targets, first);
    expect(again.changed).toBe(false);
    expect(again.minted).toBe(0);
    expect(again.targets.map((one) => one.id)).toEqual(first.map((one) => one.id));
  });
});

/* ================================================================== *
 * هـ) البرومبتُ المرجعيّ                                               *
 * ================================================================== */
describe('WS-DI · البرومبتُ يتطوّر في مكانه ولا يتناسل', () => {
  it('٢٧ · نفسُ الهُويّة، ولا نسخةٌ ثانية', async () => {
    expect(LEARN_PROMPTS.filter((one) => one.id === 'sentence-chunks')).toHaveLength(1);
    expect(Boolean(learnPromptById('sentence-chunks'))).toBe(true);
  });

  it('٢٨ · وقاعدةُ الاقتران الروسيّ-العربيّ صريحةٌ فيه', async () => {
    const body = learnPromptById('sentence-chunks').build('ТЕСТ');
    expect(body).toContain('GLOBAL RUSSIAN–ARABIC PAIRING');
    expect(body).toContain('IMMEDIATELY followed by its Arabic line');
    expect(body).toContain('IN THE SAME ORDER');
    expect(body).toContain('do NOT end with a period');
    expect(body).toContain('Do not use arrows');
  });

  it('٢٩ · والجذرُ والعيلةُ والإحساسُ داخل القلب لا قسمًا مستقلًّا', async () => {
    const body = learnPromptById('sentence-chunks').build('ТЕСТ');
    expect(body).toContain('الجذر والعيلة:');
    expect(body).toContain('الإحساس:');
    expect(body).toContain('Do NOT create a separate etymology section');
    expect(body).toContain('DO NOT invent');
  });

  it('٣٠ · وأكثرُ من زوجِ استرجاعٍ مسموحٌ به صراحةً', async () => {
    const body = learnPromptById('sentence-chunks').build('ТЕСТ');
    expect(body).toContain('MORE THAN ONE Вопрос:/Ответ: PAIR');
    expect(body).toContain('yes/no');
  });

  it('٣١ · وما اتُّفق عليه سابقًا لم يسقط مع التوسيع', async () => {
    /*
     * ⚠️ **والتوسيعُ بابٌ لفقدان ما سبق.** هذه البنودُ أُقرّت في
     *    WS-DV2ط، ولا يجوز أن تختفي لأنّ تمريرةً جديدةً أضافت غيرَها.
     */
    const body = learnPromptById('sentence-chunks').build('ТЕСТ');
    expect(body).toContain('SITUATIONAL, not meta-linguistic');
    expect(body).toContain('THE QUESTION IS RUSSIAN-ONLY');
    expect(body).toContain('ONE CONNECTED RECALL CHAIN');
    expect(body).toContain('ANSWERS GROW');
    expect(body).toContain('ANCHOR, NOT A PRISON');
    expect(body).toContain('ZERO families');
    expect(body).toContain('SEVERAL families');
  });

  it('٣٢ · والشكلُ المطلوبُ هو الشكلُ الذي يقرؤه المحلّل', async () => {
    /*
     * ⚠️ **وهذا أهمُّ حارسٍ في الملفّ.** تغييرُ نصٍّ في برومبتٍ ليس
     *    تغييرًا في النصّ وحدَه بل في **العقد** بين المولِّد والمحلّل.
     *    كسرتُه مرّةً في WS-DV2ط بلا أن يرفع أحدٌ خطأً. فيُقاس هنا
     *    بالفعل: مسودّةٌ مكتوبةٌ بالشكل الذي يطلبه البرومبت **تُقرأ**.
     */
    const body = learnPromptById('sentence-chunks').build('ТЕСТ');
    for (const head of ['الجملة الأساسية:', 'MICRO CORE', 'المعنى:', 'الجذر والعيلة:',
      'الإحساس:', 'القالب:', 'أمثلة:', 'Вопрос:', 'Ответ:', 'EXPANDING RECALL',
      'EXPANSION', 'HIGH-VALUE CORE REPETITION', 'CORE FAMILY', 'VARIATION',
      'FULL RECONSTRUCTION', 'QUICK RECALL CHAIN']) {
      expect(body).toContain(head);
    }
    expect(isDraftV2(V3)).toBe(true);
    const model = learnModelSync({ text: V3 });
    expect(model.groups.length > 0).toBe(true);
    expect(GROUP_ORDER.indexOf(ROLE.RECALL_CUE) > GROUP_ORDER.indexOf(ROLE.MICRO_CORE)).toBe(true);
  });
});

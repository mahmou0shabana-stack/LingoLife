/**
 * WS-DRAFT-CONTENT-FONT — عائلةُ الجذر تُنطَق، والنصُّ الكاملُ يتبع خطَّ القراءة.
 *
 * ⚠️ الجزءُ الأوّلُ يُختبَر **سلوكًا حقيقيًّا**: المحلّلُ وسجلُّ الأدوار
 *    وحدتان تُستورَدان، فلا حاجةَ إلى حرّاسِ نصّ. والجزءُ الثاني يخصّ
 *    `applyFonts` في `shadow-view.js` وهي داخليّةٌ لا تُصدَّر — فحارسُها
 *    مصدرٌ كعرف هذا الملفّ، ومعه قياسٌ حيٌّ في رسالة الإيداع.
 */
import { describe, it, expect } from './test-runner.js';
import { parseDraftV2 } from '../js/services/shadow/draft-v2.js';
import {
  ROLE, SPEECH_ROLES, PRACTICE_ROLES, ROOT_ROLES, isPracticeRole, isSpeechRole,
} from '../js/services/shadow/draft-targets.js';
import { GROUP_ORDER, GROUP_LABEL } from '../js/services/shadow/draft-learning.js';

const MAIN = 'При работе с технической документацией важно обращать внимание на статус.';
const DRAFT = [
  'مسودة — حرّاس', '', 'الجملة الأساسية:', MAIN, 'ترجمة', '',
  '━━━━━━━━━━', 'MICRO CORE 1',
  'при рабо́те с техни́ческой документа́цией', 'وإحنا بنشتغل على التوثيق الفني',
  'الجذر والعيلة:', 'рабо́та · рабо́чий · обраба́тывать', 'شغل · عامل · يعالج',
  'أمثلة:', 'При прове́рке докуме́нтов бу́дьте внима́тельны.', 'وإنت بتفحص',
  '',
  '━━━━━━━━━━', 'MICRO CORE 2',
  'ва́жно обраща́ть внима́ние', 'مهم ناخد بالنا',
  'الجذر والعيلة:', 'внима́ние · внима́тельный', 'انتباه · منتبه',
  '',
].join('\n');

describe('WS-DRAFT-CONTENT · عائلةُ الجذر هدفُ نُطق', () => {
  it('١ · «الجذر والعيلة» تصير أهدافًا لا سقالةً مدفونة', () => {
    /*
     * ⚠️ **بلاغُك**: «الجذر والعِلّة موجودة في المسودّة ومش بقدر أتدرّب
     *    على نطقها». وكانت تُحلَّل إلى حقلِ `roots` على القلب ولا تخرج
     *    منه أبدًا — فلا دورَ لها ولا بصمةَ ولا مدخلَ إلى التدريب.
     */
    const model = parseDraftV2(DRAFT);
    const fam = model.targets.filter((one) => one.role === ROLE.ROOT_FAMILY);
    expect(`عائلات ${fam.length}`).toBe('عائلات 2');
    expect(fam.every((one) => isPracticeRole(one.role))).toBe(true);
    expect(fam[0].ru).toBe('рабо́та · рабо́чий · обраба́тывать');
  });

  it('٢ · وهي في موضعها من المسودّة: بعد قلبها وقبل أمثلته', () => {
    /*
     * ⚠️ شرطُك السادس: «لا تُلحَق كلُّها في الآخر». والمسودّةُ تعرضها بين
     *    القلب وأمثلته — فذاك موضعُها في تسلسل التدريب أيضًا.
     */
    const model = parseDraftV2(DRAFT);
    const order = model.targets.map((one) => one.role);
    const core1 = order.indexOf(ROLE.MICRO_CORE);
    const fam1 = order.indexOf(ROLE.ROOT_FAMILY);
    const ex1 = order.indexOf(ROLE.EXAMPLE);
    expect(`قلب ${core1} < عائلة ${fam1} < مثال ${ex1}`)
      .toBe(`قلب ${core1} < عائلة ${core1 < fam1 && fam1 < ex1 ? fam1 : -1} < مثال ${ex1}`);
  });

  it('٣ · ولا تضخّم عدَّ القلوب — تُنطَق ولا تُعَدّ قلبًا', () => {
    /*
     * ⚠️ **وهذا هو سببُ استبعادها أصلًا**، مكتوبًا في `draft-v2.js`:
     *    «ولولا هذا العنوانُ لَصار هدفَ نُطقٍ وضخّم عدَّ القلوب». والخوفُ
     *    صحيحٌ — فالحلُّ دورٌ خارجَ `SPEECH_ROLES` كما فُعل بالاسترجاع،
     *    لا إدخالُها فيها. فإن دخلتها يومًا سقط هذا الحارسُ فورًا.
     */
    expect(SPEECH_ROLES.has(ROLE.ROOT_FAMILY)).toBe(false);
    expect(PRACTICE_ROLES.has(ROLE.ROOT_FAMILY)).toBe(true);
    expect(ROOT_ROLES.has(ROLE.ROOT_FAMILY)).toBe(true);
    expect(isSpeechRole(ROLE.ROOT_FAMILY)).toBe(false);
  });

  it('٤ · ولكلِّ عائلةٍ هُويّةٌ ثابتةٌ تميّزها عن أختها', () => {
    /*
     * ⚠️ لا فهرسَ عدديّ: البصمةُ تضمّ الدورَ والأبَ والنصّ — فعائلتان
     *    تحت قلبين مختلفين لا تتشاركان هُويّةً ولا حالةَ «خلصت».
     */
    const model = parseDraftV2(DRAFT);
    const fam = model.targets.filter((one) => one.role === ROLE.ROOT_FAMILY);
    const parents = fam.map((one) => one.parent);
    expect(parents[0] !== parents[1]).toBe(true);
    expect(fam.every((one) => Boolean(one.ru))).toBe(true);
  });

  it('٥ · ولها مجموعتُها في اللوح بترتيبها الصحيح', () => {
    expect(Boolean(GROUP_LABEL[ROLE.ROOT_FAMILY])).toBe(true);
    const at = GROUP_ORDER.indexOf(ROLE.ROOT_FAMILY);
    const ex = GROUP_ORDER.indexOf(ROLE.EXAMPLE);
    expect(`في الترتيب ${at >= 0} وقبل الأمثلة ${at < ex}`)
      .toBe('في الترتيب true وقبل الأمثلة true');
  });

  it('٦ · وسطرٌ بلا روسيٍّ لا يصير هدفًا', () => {
    const only = [
      'مسودة', '', 'الجملة الأساسية:', MAIN, 'ترجمة', '',
      '━━━━━━━━━━', 'MICRO CORE 1', 'при рабо́те', 'وإحنا بنشتغل',
      'الجذر والعيلة:', 'ترجمة بلا روسي',
      '',
    ].join('\n');
    const model = parseDraftV2(only);
    const fam = model.targets.filter((one) => one.role === ROLE.ROOT_FAMILY);
    expect(`عائلات ${fam.length}`).toBe('عائلات 0');
  });
});

describe('WS-DRAFT-FONT · النصُّ الكاملُ يتبع خطَّ القراءة', () => {
  let SRC = '';
  const view = async () => {
    if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
    return SRC;
  };

  it('٧ · أسطحُ الأصل الثلاثةُ تتلقّى خطَّ القراءة المعتمَد', async () => {
    /*
     * ⚠️ **العطبُ كان مُنتقيًا ميّتًا**: `[data-origin-text], .sh-origin-line`
     *    اسمان لا يُنتجهما الراسم. والمرسومُ ثلاثةٌ غيرُهما. قِيس حيًّا:
     *    البطل Philosopher والرقاقة Philosopher و**الأصل Inter**.
     *
     * ⚠️ والحارسُ يربط الطرفين: أسماءُ الأصناف كما يكتبها الراسمُ فعلًا،
     *    وأنّها تُغذَّى بـ`ctx.font` (مصدرُ البطل والرقاقات) لا بغيره.
     */
    const src = await view();
    for (const cls of ['sh-origin-sent', 'sh-origin-said', 'sh-origin-raw']) {
      expect(`${cls} يُرسَم: ${src.includes(`class="${cls}`)}`).toBe(`${cls} يُرسَم: true`);
    }
    /*
     * ⚠️ **والمصدرُ هو هو، والمُطبَّقُ صار محروسًا** (WS-CSFIM): يُشتقّ
     *    `ru` من `ctx.font` نفسِه ثمّ يمرّ بـ`russianFontId` الذي يبدّل
     *    خطًّا لا يرسم السيريلية ببديلٍ يرسمها. فالحارسُ يربط الطرفين
     *    كما كان: الأسطحُ الثلاثةُ تتبع خطَّ القراءة المعتمَد، لا خطًّا
     *    ثانيًا ولا حالةً جديدة.
     */
    const from = /const ru = russianFontId\(ctx\.font\)/;
    const line = /querySelectorAll\('\.sh-origin-sent, \.sh-origin-said, \.sh-origin-raw'\)[\s\S]{0,120}?applyFont\(node, ru\)/;
    expect(`يتبع خطَّ القراءة: ${from.test(src) && line.test(src)}`).toBe('يتبع خطَّ القراءة: true');
  });

  it('٨ · ولا حالةَ خطٍّ ثالثةً للنصّ الكامل', async () => {
    /*
     * ⚠️ المصدرُ واحدٌ: `fontId` للمسرح و`fontDocId` لسطور الصفحة — وهما
     *    قائمان من قبل. فممنوعٌ حقلٌ ثالثٌ باسم النصّ الكامل.
     */
    const src = await view();
    const bad = /fullTextFont|fontFullId|fullTextFontId/.test(src);
    expect(`حقلٌ ثالث: ${bad}`).toBe('حقلٌ ثالث: false');
  });

  it('٩ · ولا يُلبَس خطُّ الروسيّة لحاوٍ يجمع اللغتين', async () => {
    /*
     * ⚠️ شرطُك التاسع: العربيّةُ تبقى على خطّها. فالخطُّ يُلبَس للأسطح
     *    الروسيّة بأسمائها، لا للوح الأصل كلِّه (`.sh-origin`) الذي يحوي
     *    عنوانًا عربيًّا وعدّادًا عربيًّا. وقِيس: العربيّةُ بقيت
     *    Noto Naskh Arabic قبل تبديل الخطّ وبعده.
     */
    const src = await view();
    const wide = /applyFont\(\s*(?:node|el)\s*,\s*ctx\.font\s*\)[\s\S]{0,40}\)\s*;?\s*\/\/\s*whole/.test(src)
      || /querySelectorAll\('\.sh-origin'\)/.test(src)
      || /querySelectorAll\('\.sh-doc'\)/.test(src);
    expect(`يلبس حاويًا جامعًا: ${wide}`).toBe('يلبس حاويًا جامعًا: false');
  });
});

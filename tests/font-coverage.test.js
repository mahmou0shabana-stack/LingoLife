/**
 * WS-CSFIM — الروسيّةُ تأخذ خطًّا **تقدر عليه**، والقياسُ هو الحَكَم.
 *
 * ⚠️ **بلاغُك**: «الخطّ لسّه مش بيغيّر النصّ الكامل». والطورُ السابق
 *    وصل السلك (صارت العائلةُ المحسوبةُ تتبدّل)، لكنّ **الوجهَ المرسوم**
 *    لم يتبدّل حين يكون المختارُ بلا سيريلية: يُطبَّق، وتُرسَم الروسيّةُ
 *    من احتياطيٍّ صامت.
 *
 * وهنا يُختبَر ما يمكن اختبارُه بلا شبكة: منطقُ البديل، وطريقةُ القياس،
 * وصدقُ السجلّ. والأثرُ المرئيُّ (وجهٌ يُرسَم فعلًا) قِيس في مسبار
 * Playwright بوجهين حقيقيّين من النظام — لأنّ هذه الآلةَ لا تصل إلى
 * `fonts.googleapis.com` (‏504)، والأرقامُ في رسالة الإيداع.
 */
import { describe, it, expect } from './test-runner.js';
import {
  FONTS, fontById, measureFont, noteCoverage, coverageOf, russianFontId,
} from '../js/services/shadow/fonts.js';

/** تقريرُ تغطيةٍ مصنوعٌ — كما يعود من `measureCoverage`. */
const report = (over = {}) => {
  const out = {};
  for (const f of FONTS) out[f.id] = { id: f.id, latin: true, cyrillic: true, status: 'ok' };
  for (const [id, status] of Object.entries(over)) {
    out[id] = { id, latin: status !== 'not-loaded', cyrillic: status === 'ok', status };
  }
  return out;
};

describe('WS-CSFIM · بديلُ الخطّ حين تعجز السيريلية', () => {
  it('١ · السجلُّ لا يدّعي سيريليةً لا يملكها', () => {
    /*
     * ⚠️ **Pacifico كان مكتوبًا `cyrillic: true` وهو كذب**: مجموعاتُه
     *    في Google Fonts لاتينيّةٌ وفيتناميّة، ولا سيريليةَ فيها. وهو
     *    ما جعله يُعرَض خيارًا يبدو أنّه يعمل وهو لا يعمل (بند ٨٩).
     */
    expect(`pacifico: ${fontById('pacifico').cyrillic}`).toBe('pacifico: false');
    /* والبقيّةُ لم تُمَسّ — خطوطٌ روسيّةُ التصميم أصلًا. */
    for (const id of ['noto', 'kurale', 'philosopher', 'pt', 'marck', 'badscript', 'caveat']) {
      expect(`${id}: ${fontById(id).cyrillic}`).toBe(`${id}: true`);
    }
  });

  it('٢ · وخطٌّ قِيس صالحًا يُطبَّق كما هو', () => {
    noteCoverage(report());
    for (const f of FONTS) expect(`${f.id}: ${russianFontId(f.id)}`).toBe(`${f.id}: ${f.id}`);
  });

  it('٣ · وخطٌّ بلا سيريلية يُبدَّل ببديلٍ من صيغة كتابته', () => {
    /*
     * ⚠️ **والبديلُ من نفس العائلة الشكليّة عمدًا**: طلبتَ «خطَّ يد»
     *    فلا يُعطى «حروفَ طباعة». والنيّةُ تبقى، والفرقُ أنّها تُرى.
     */
    noteCoverage(report({ pacifico: 'no-cyrillic' }));
    const to = russianFontId('pacifico');
    expect(`بديلٌ غيرُه: ${to !== 'pacifico'}`).toBe('بديلٌ غيرُه: true');
    expect(`من صيغته: ${fontById(to).form}`).toBe(`من صيغته: ${fontById('pacifico').form}`);
    expect(`ويقدر عليها: ${coverageOf(to)}`).toBe('ويقدر عليها: ok');
  });

  it('٤ · وإن عجزت صيغتُه كلُّها أخذ أيَّ قادرٍ في السجلّ', () => {
    noteCoverage(report({ pacifico: 'no-cyrillic', caveat: 'no-cyrillic' }));
    const to = russianFontId('pacifico');
    expect(`قادرٌ: ${coverageOf(to)}`).toBe('قادرٌ: ok');
    expect(`ليس عاجزًا: ${to !== 'pacifico' && to !== 'caveat'}`).toBe('ليس عاجزًا: true');
  });

  it('٥ · ولا بديلَ حين لا يصل خطٌّ أصلًا — يُقال ولا يُبدَّل', () => {
    /*
     * ⚠️ **الفرقُ بين «لا يرسم» و«لم يصل»**: الأوّلُ عيبُ الخطّ ويُعالَج
     *    ببديل، والثاني انقطاعُ شبكةٍ — وكلُّ الخطوط فيه سواء، فتبديلُ
     *    واحدٍ بآخرَ مثله خداعٌ لا إصلاح. واللوحةُ تقول «الخطّ لسه ما
     *    وصلش» وهو الصدق.
     */
    const all = {};
    for (const f of FONTS) if (f.family) all[f.id] = 'not-loaded';
    noteCoverage(report(all));
    expect(`كما هو: ${russianFontId('pacifico')}`).toBe('كما هو: pacifico');
  });

  it('٦ · ولا بديلَ قبل أن يصل قياسٌ — لا يُخمَّن', () => {
    noteCoverage(null);
    expect(`بلا قياس: ${russianFontId('pacifico')}`).toBe('بلا قياس: pacifico');
    expect(`وحالتُه: ${coverageOf('pacifico')}`).toBe('وحالتُه: unknown');
  });

  it('٧ · والقياسُ يقارن الخطَّ بنفسه تحت احتياطيَّين مختلفين', async () => {
    /*
     * ⚠️ **والقياسُ القديم كان يكذب.** كان يقارن «الخطُّ + احتياطيّ»
     *    بـ«الاحتياطيّ وحدَه»؛ ويكفي محرفٌ مشتركٌ واحد (`_`) ليختلف
     *    المجموعُ فيُحسَب الخطُّ راسمًا للروسيّة وهو لا يرسم حرفًا.
     *    قِيس على وجهٍ لاتينيٍّ خالصٍ في هذه الآلة: ٧٢٠٫٣ مقابل ٧٢٢٫٥
     *    — فرقٌ ٢٫٢px قال «يرسم» كذبًا.
     *
     *    والصوابُ: إن جاءت الحروفُ من الخطّ فعرضُها لا يتبدّل بتبدّل
     *    الاحتياطيّ، وإن جاءت من الاحتياطيّ تبدّل. فالمقياسُ تساوي
     *    قياسين بخطٍّ واحدٍ واحتياطيَّين مختلفين.
     */
    const src = await (await fetch('../js/services/shadow/fonts.js')).text();
    const body = src.slice(src.indexOf('function drawsItself'), src.indexOf('\n}', src.indexOf('function drawsItself')));
    expect(`احتياطيّان: ${/FALLBACK_A[\s\S]{0,200}FALLBACK_B/.test(body)}`).toBe('احتياطيّان: true');
    expect(`تساوٍ لا اختلاف: ${/Math\.abs\(a - b\) < 0\.5/.test(body)}`).toBe('تساوٍ لا اختلاف: true');
    /* ولا أثرَ للمقياس القديم. */
    expect(`المقياسُ القديم: ${/widthIn\(null,/.test(src)}`).toBe('المقياسُ القديم: false');
  });

  it('٨ · وخطُّ الجهاز لا يُقاس أصلًا — هو المتاحُ عندك', () => {
    const out = measureFont(fontById('system'));
    expect(`${out.status} · ${out.cyrillic}`).toBe('ok · true');
  });

  it('٩ · والشاشةُ تقيس عند الفتح لا عند فتح لوحة الخطوط', async () => {
    /*
     * ⚠️ **وهذا هو ما كان يُعطِّل البديلَ كلَّه**: `markFontCoverage`
     *    كانت تُنادى من بابٍ واحد — زرِّ «الخطوط» في مركز التدريب.
     *    فمن يبدّل خطَّه من شارة Aa لا يُقاس عنده شيءٌ ولا يُطبَّق بديل.
     */
    const view = await (await fetch('../js/views/shadow-view.js')).text();
    const mount = view.slice(view.indexOf('ensureFontsLoaded();'), view.indexOf('ensureFontsLoaded();') + 900);
    expect(`تُقاس عند الفتح: ${/markFontCoverage\(\)/.test(mount)}`).toBe('تُقاس عند الفتح: true');
    /* والتقريرُ يُسلَّم للسجلّ ثمّ تُعاد الخطوطُ — وإلّا بقيت الروسيّةُ على خطٍّ لا يرسمها. */
    const mark = view.slice(view.indexOf('async function markFontCoverage()'),
      view.indexOf('\n}', view.indexOf('async function markFontCoverage()')));
    expect(`يُسلَّم ثمّ يُعاد التطبيق: ${/noteCoverage\(report\)[\s\S]{0,80}applyFonts\(\)/.test(mark)}`)
      .toBe('يُسلَّم ثمّ يُعاد التطبيق: true');
  });
});

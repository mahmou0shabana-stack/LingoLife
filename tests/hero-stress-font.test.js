/**
 * WS-HSDR — بطلُ المسرح يُرسَم بوجهٍ واحدٍ لا يتبدّل بنقلةِ جملة.
 *
 * ⚠️ **بلاغُك**: «الجملةُ البيضاءُ حالةٌ والنبرُ الذهبيُّ حالةٌ أخرى» —
 *    **وفي «الأصل» أيضًا**، حيث لا لوحَ مسودّةٍ ولا بطاقةَ هدف.
 *
 * ⚠️ **والانحرافُ الأوّلُ مقيس: كاتبان على نفس الخاصّية بقيمتين.**
 *
 *        applyFonts   →  applyFont(hero, russianFontId(ctx.font))   ← البديلُ المقيس
 *        syncSegment  →  applyFont(hero, ctx.font)                   ← الخامّ
 *
 *    والثانيةُ تقع مع **كلّ نقلةِ جملة**، فتغلب الأولى. قِيس حيًّا في
 *    «الأصل» بوجهٍ لاتينيٍّ خالصٍ من النظام مسجَّلٍ باسم `Pacifico`:
 *
 *        بعد اختيار الخطّ     البطلُ يلبس **Caveat**    (البديلُ الصحيح)
 *        وبعد «التالي» واحدة   البطلُ يلبس **Pacifico**  (العاجزُ عاد)
 *
 *    فيُرسَم الروسيُّ من احتياطيٍّ صامتٍ يختاره المتصفّحُ — وهو عينُ ما
 *    شُخِّص في WS-CSFIM وعُولج، ثمّ نُقض من هذا الباب.
 *
 * ⚠️ **والبابُ الثاني**: `--sh-ru-font` (متغيّرُ رقائق الكلمات) كان
 *    يُشتقّ من `fontById(ctx.font)` خامًّا كذلك — فسطحان روسيّان
 *    متجاوران بوجهين.
 *
 * ⚠️ **وما لم أستطع إعادةَ إنتاجه يُقال**: على هذه الآلة لم ينفصل
 *    التسطيرُ عن حرفه ولا اختلف وجهُ الذهب عن وجه الأبيض بالبكسل —
 *    قِيس فكان الفارقُ صفرًا. فالمحروسُ هنا **الحالةُ المقيسة** (أيُّ
 *    وجهٍ يُطبَّق)، لا أثرٌ لم أره. وسلسلةُ الاحتياطيّ على جهاز
 *    المستخدم ليست سلسلةَ هذه الحاوية.
 */
import { describe, it, expect } from './test-runner.js';
import {
  FONTS, fontById, noteCoverage, russianFontId, applyFont, fontFullLabel,
} from '../js/services/shadow/fonts.js';

let SRC = '';
const source = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};

/** يقتطع جسمَ دالّةٍ عُليا — الإغلاقُ عمودٌ صفرٌ في هذا الملفّ. */
function bodyOf(src, name) {
  const head = src.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (head < 0) throw new Error(`لم تُوجد ${name}`);
  const open = src.indexOf('{', head);
  const end = src.indexOf('\n}', open);
  return src.slice(open + 1, end);
}

/** يُسقط التعليقات — يُقرأ كودٌ لا شرح. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** تقريرُ تغطيةٍ مصنوع — كما يعود من `measureCoverage`. */
const report = (over = {}) => {
  const out = {};
  for (const f of FONTS) out[f.id] = { id: f.id, latin: true, cyrillic: true, status: 'ok' };
  for (const [id, status] of Object.entries(over)) {
    out[id] = { id, latin: status !== 'not-loaded', cyrillic: status === 'ok', status };
  }
  return out;
};

const RU = 'За́мок и замо́к — всё и все.';

describe('WS-HSDR · وجهُ البطل لا يتبدّل بنقلةِ جملة', () => {
  it('١ · كلُّ سطحٍ روسيٍّ يمرّ من بوّابةٍ واحدة — لا خامَّ يتسلّل', async () => {
    /*
     * ⚠️ **والحارسُ يعدّ المنافذَ ولا يثق باسمٍ**: يُمسَح الملفُّ كلُّه
     *    بحثًا عن كلّ `applyFont(...)`، ويُشترَط أن يكون معطاها الثاني
     *    معرّفًا **محلولًا**: `ru` أو `ruDoc` (وكلاهما من `russianFontId`
     *    بحارسٍ قائم) أو نداءً صريحًا لها. فمنفذٌ جديدٌ يُكتَب غدًا
     *    بـ`ctx.font` خامًّا يُسقط هذا السطرَ فورًا.
     */
    const src = code(await source());
    const calls = [...src.matchAll(/applyFont\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g)]
      .map((m) => ({ target: m[1].trim(), font: m[2].trim() }));
    expect(`منافذُ التطبيق: ${calls.length >= 5}`).toBe('منافذُ التطبيق: true');
    const raw = calls.filter((c) => !/^(ru|ruDoc)$/.test(c.font)
      && !/^russianFontId\(/.test(c.font));
    expect(`تمرّ خامًّا: ${raw.map((c) => `${c.target}←${c.font}`).join(' | ') || 'لا شيء'}`)
      .toBe('تمرّ خامًّا: لا شيء');
  });

  it('٢ · والبطلُ في `syncSegment` منها — وهو موضعُ النقض', async () => {
    /*
     * ⚠️ **وهذا السطرُ بعينه هو الذي كان ينقض البديل.** `syncSegment`
     *    تقع مع كلّ نقلةٍ، فهي آخرُ من يكتب — فما تكتبه هو ما يُرى.
     */
    const body = code(bodyOf(await source(), 'syncSegment'));
    expect(`يُطبَّق على البطل: ${/applyFont\(textEl,\s*russianFontId\(ctx\.font\)\)/.test(body)}`)
      .toBe('يُطبَّق على البطل: true');
    expect(`ولا خامَّ: ${/applyFont\(textEl,\s*ctx\.font\)/.test(body)}`)
      .toBe('ولا خامَّ: false');
  });

  it('٣ · ومتغيّرُ الرقائق من نفس البوّابة — سطحان لا وجهان', async () => {
    /*
     * ⚠️ الرقائقُ تُعاد بناءً مع كلّ مقطع، فخطُّها متغيّرٌ على الجذر لا
     *    نمطٌ سطريّ. وكان يُشتقّ من `fontById(ctx.font)` خامًّا — فتلبس
     *    الجملةُ البديلَ وتلبس رقائقُها العاجز.
     */
    const body = code(bodyOf(await source(), 'applyFonts'));
    expect(`المتغيّرُ محلول: ${/fontById\(russianFontId\(ctx\.font\)\)/.test(body)}`)
      .toBe('المتغيّرُ محلول: true');
    expect(`ولا خامَّ: ${/const\s+\w+\s*=\s*fontById\(ctx\.font\);[\s\S]{0,200}--sh-ru-font/.test(body)}`)
      .toBe('ولا خامَّ: false');
  });

  it('٤ · وحيًّا: الجملةُ ورقائقُها تلبسان البديلَ المقيسَ معًا', async () => {
    /*
     * ⚠️ **يُشغَّل الكودُ المشحونُ نفسُه** على شجرةٍ حيّة: يُقتطَع جسمُ
     *    `applyFonts` ويُنفَّذ، فتغييرُ السطر في التطبيق يُسقط الحارس.
     */
    noteCoverage(report({ pacifico: 'no-cyrillic' }));
    const want = russianFontId('pacifico');
    expect(`بديلٌ غيرُ العاجز: ${want !== 'pacifico'}`).toBe('بديلٌ غيرُ العاجز: true');

    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;top:-9999px;inset-inline-start:0';
    box.innerHTML = [
      '<div class="shadow-app">',
      `  <span data-text>${RU}</span>`,
      `  <div class="sh-line"><span data-line-text>${RU}</span></div>`,
      `  <p class="sh-flow-p"><span class="sh-flow-s">${RU}</span></p>`,
      `  <span class="sh-origin-sent">${RU}</span>`,
      '  <span data-font-label></span><span data-font-size-label></span>',
      '</div>',
    ].join('\n');
    document.body.append(box);
    const doc = {
      querySelector: (s) => box.querySelector(s),
      querySelectorAll: (s) => box.querySelectorAll(s),
    };
    const ctx = { font: 'pacifico', fontDoc: 'pacifico', fontSize: 1, sizePx: 30, session: { id: 's' } };
    const fn = new Function(
      'ctx', 'document', '$', 'fontById', 'russianFontId', 'applyFont',
      'fontFullLabel', 'paintFontChips', 'DEFAULT_SIZE_PX',
      bodyOf(await source(), 'applyFonts'),
    );
    fn(ctx, doc, doc.querySelector, fontById, russianFontId, applyFont,
      fontFullLabel, () => {}, 30);

    const hero = box.querySelector('[data-text]');
    const app = box.querySelector('.shadow-app');
    /*
     * ⚠️ **ولا تُقارَن السلسلةُ حرفًا بحرف** — الدرسُ مدفوعُ الثمن في
     *    WS-FFP وكرّرتُه هنا: المتصفّحُ يُطبّع ما يُكتَب في
     *    `style.fontFamily` (يُسقط علاماتِ الاقتباس)، فمقارنةُ النصّ
     *    الخام تسقط بلا عطب. والمقصودُ اسمُ العائلة.
     */
    const fam = fontById(want).family || 'system-ui';
    expect(`البطلُ بالبديل: ${hero.style.fontFamily.includes(fam)}`).toBe('البطلُ بالبديل: true');
    expect(`ولا يلبس العاجز: ${hero.style.fontFamily.includes('Pacifico')}`)
      .toBe('ولا يلبس العاجز: false');
    const chipVar = app.style.getPropertyValue('--sh-ru-font').trim();
    expect(`الرقائقُ بالبديل: ${chipVar.includes(fam)}`).toBe('الرقائقُ بالبديل: true');
    /* والسطحان واحدٌ — لا وجهان متجاوران. */
    const norm = (v) => v.replace(/["']/g, '').replace(/\s+/g, ' ').trim();
    expect(`سطحٌ واحد: ${norm(chipVar) === norm(hero.style.fontFamily)}`)
      .toBe('سطحٌ واحد: true');
    box.remove();
    noteCoverage(null);
  });

  it('٥ · ونقلةُ الجملة لا تُسقط البديل — نفسُ السطر الذي كان ينقضه', async () => {
    /*
     * ⚠️ **ويُحاكى النقضُ كما كان يقع**: تُنفَّذ `applyFonts` (فتلبس
     *    البديل)، ثمّ يُنفَّذ **سطرُ `syncSegment` كما هو في الملفّ** —
     *    يُقتطَع بنصّه ويُنفَّذ. فإن عاد يومًا إلى الخامّ سقط هنا.
     */
    noteCoverage(report({ pacifico: 'no-cyrillic' }));
    const want = russianFontId('pacifico');
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;top:-9999px;inset-inline-start:0';
    box.innerHTML = `<span data-text>${RU}</span>`;
    document.body.append(box);
    const textEl = box.querySelector('[data-text]');
    const ctx = { font: 'pacifico' };

    const body = code(bodyOf(await source(), 'syncSegment'));
    const line = (body.match(/applyFont\(textEl,[^)]*\)+\s*;/) || [])[0];
    expect(`وُجد السطر: ${Boolean(line)}`).toBe('وُجد السطر: true');
    // eslint-disable-next-line no-new-func
    new Function('textEl', 'ctx', 'applyFont', 'russianFontId', line)(
      textEl, ctx, applyFont, russianFontId,
    );
    const fam2 = fontById(want).family || 'system-ui';
    expect(`بعد نقلةِ الجملة: ${textEl.style.fontFamily.includes(fam2)}`)
      .toBe('بعد نقلةِ الجملة: true');
    expect(`ولا العاجز: ${textEl.style.fontFamily.includes('Pacifico')}`)
      .toBe('ولا العاجز: false');
    box.remove();
    noteCoverage(null);
  });

  it('٦ · والبطلُ يبقى مُمرِّرًا بنفسه — WS-HEROSCROLL لم تُمَسّ', async () => {
    /*
     * ⚠️ **شرطُ النطاق**: الإصلاحُ خطٌّ لا تخطيط. فالبطلُ يبقى
     *    `overflow-y: auto` وخلفيّتُه `local` — وهي التي تُبقي الذهبَ
     *    فوق كلمته أثناء التمرير (WS-HEROSCROLL).
     */
    const css = await (await fetch('../css/shadow.css')).text();
    expect(`مُمرِّرٌ بنفسه: ${/\.sh-current-text\s*\{[^}]*overflow-y:\s*auto/.test(css)}`)
      .toBe('مُمرِّرٌ بنفسه: true');
    expect(`وخلفيّتُه تتبع محتواه: ${/background-attachment:\s*local/.test(css)}`)
      .toBe('وخلفيّتُه تتبع محتواه: true');
    /* والنبرُ لونٌ صريحٌ لا يطاله قصُّ التدرّج. */
    expect(`والنبرُ لونٌ صريح: ${/\.sh-current-text \.sh-stress\s*\{[^}]*color:/.test(css)}`)
      .toBe('والنبرُ لونٌ صريح: true');
  });

  it('٧ · والنبرُ يُعلَّم كما كان — حرفٌ وعلامتُه في وسمٍ واحد', async () => {
    /*
     * ⚠️ **ولا يُمَسّ ما يُعلِّم**: العلامةُ تُلفّ مع حرفها في `<b>`
     *    واحد (`stressHtml`)، فلا تنفصل في الوسم مهما تبدّل الخطّ.
     *    وهذا ما يجعل الانفصالَ — إن وقع — **طلاءً** لا بنية.
     */
    const { markSentence } = await import('../js/services/shadow/stress.js');
    const out = markSentence('за́мок').html;
    expect(`العلامةُ مع حرفها: ${/<b class="sh-stress">а\u0301<\/b>/.test(out)}`)
      .toBe('العلامةُ مع حرفها: true');
    expect(`ولا علامةَ يتيمة: ${/<b class="sh-stress">\u0301<\/b>/.test(out)}`)
      .toBe('ولا علامةَ يتيمة: false');
  });
});

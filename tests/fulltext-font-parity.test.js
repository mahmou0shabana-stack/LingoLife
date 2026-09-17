/**
 * WS-FFP — «نصٌّ كامل» يُرسَم بالوجه الذي اخترتَه، لا بوجهٍ آخر.
 *
 * ⚠️ **بلاغُك**: «زرّ Aa بيغيّر شكل الروسي في وضع «جمل»، وفي «نص كامل»
 *    مش بيتغيّر». وقِيس فوُجد حقًّا: «جمل» تتبع `ctx.fontDoc` (وهو ما
 *    تكتبه شارةُ Aa في صفحة المحتوى) و«نصّ كامل» كان يتبع `ctx.font`
 *    (خطَّ المسرح) — فيبقى على حاله مهما بدّلتَ.
 *
 * ⚠️ **ولا يُقبَل هنا «تبدّلت سلسلةُ CSS» دليلًا.** الحارسُ لا يقرأ
 *    `font-family`: يقيس **عرضَ نفسِ النصّ مرسومًا** في الوجهين، لأنّ
 *    اسمَ عائلةٍ لا يصل ولا يرسم يترك العرضَ كما كان — وهو عينُ العطب
 *    الذي أُصلح في WS-CSFIM. فالمقياسُ عرضٌ لا اسم.
 *
 * ⚠️ **والمُشغَّلُ هو الكودُ المشحون نفسُه لا نسخةٌ منه**: يُجلَب
 *    `shadow-view.js` ويُقتطَع جسمُ `applyFonts` ويُنفَّذ على شجرةٍ
 *    حيّةٍ بـ`new Function`. فلو غُيِّر السطرُ في التطبيق سقط الحارسُ
 *    هنا — وهذا هو المقصود. (و`applyFonts` داخليّةٌ لا تُصدَّر، ولم
 *    أُصدِّرها لأجل اختبار: تصديرٌ لأجل الاختبار سطحٌ عامٌّ جديد.)
 *
 * ⚠️ **وثلاثةُ أوجهٍ مختلفةٌ فعلًا على هذه الآلة** — قِيست قبل أن
 *    تُكتَب هذه الأسطر، بنفس النصّ عند ٣٢px:
 *
 *        noto/caveat/marck → ١٠٠٢٫٣١   (احتياطيُّ الرقعة: serif)
 *        philosopher       → ١٠١٨٫٧    (نفسُه مائلًا)
 *        system            → ١٢٦٣٫٢٥   (system-ui)
 *        بلا خطٍّ مطبَّق     → ١٠٩٦٫٥٣   (Inter — خطُّ التطبيق)
 *
 *    ولذلك يُختار `system` و`philosopher` في الحرّاس: فرقُهما مرسومٌ
 *    مقيسٌ على هذه الآلة بلا شبكة. وخطوطُ Google لا تصل إلى هذه
 *    الآلةِ أصلًا (‏504)، فالاعتمادُ عليها كان سيجعل كلَّ الأوجه واحدًا
 *    وكلَّ الحرّاسِ صامتين — وحارسٌ لا يفرّق لا يحرس.
 */
import { describe, it, expect } from './test-runner.js';
import {
  applyFont, fontById, fontFullLabel, russianFontId, noteCoverage,
} from '../js/services/shadow/fonts.js';

const RU = 'При рабо́те с техни́ческой документа́цией ва́жно обраща́ть внима́ние на ста́тус.';

/** يقتطع جسمَ دالّةٍ عُليا من المصدر — الإغلاقُ عمودٌ صفرٌ في هذا الملفّ. */
function bodyOf(src, name) {
  const head = src.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (head < 0) throw new Error(`لم تُوجد ${name}`);
  const open = src.indexOf('{', head);
  const end = src.indexOf('\n}', open);
  return src.slice(open + 1, end);
}

let SRC = '';
const source = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};

/**
 * شجرةٌ حيّةٌ فيها الأسطحُ الأربعةُ التي تعنينا، وكلُّها **نفسُ النصّ**
 * حتّى يكون فرقُ العرض فرقَ وجهٍ لا فرقَ حروف.
 *
 * ⚠️ **ولا تُحمَّل `shadow.css`**: `applyFont` تكتب `--font-scale` و
 *    الملفُّ وحدَه يقرأه. فالمقيسُ هنا العائلةُ والمَيلُ — وهما ما
 *    يحملان التبدّلَ المرئيّ. والمقاسُ محروسٌ في مكانه من `stage-layout`.
 */
function harness() {
  const box = document.createElement('div');
  box.setAttribute('data-ffp-harness', '');
  box.style.cssText = 'position:absolute;top:-9999px;inset-inline-start:0;'
    + 'white-space:nowrap;font-size:32px;font-family:Inter,sans-serif';
  box.innerHTML = [
    '<div class="shadow-app">',
    `  <span data-text>${RU}</span>`,
    `  <div class="sh-line"><span data-line-text>${RU}</span></div>`,
    `  <p class="sh-flow-p"><span class="sh-flow-s" data-line="0">${RU}</span></p>`,
    `  <span class="sh-origin-sent">${RU}</span>`,
    '  <span data-font-label></span><span data-font-size-label></span>',
    '</div>',
  ].join('\n');
  document.body.append(box);

  /* وثيقةٌ مُقيَّدةٌ بالشجرة وحدَها — فلا يطال الحارسُ بقايا اختبارٍ آخر. */
  const doc = {
    querySelector: (sel) => box.querySelector(sel),
    querySelectorAll: (sel) => box.querySelectorAll(sel),
  };
  const ctx = { font: 'noto', fontDoc: 'noto', fontSize: 1, sizePx: 30, session: { id: 's' } };

  return {
    box, ctx,
    /** يُنفِّذ `applyFonts` المشحونةَ بعد ضبط الاختيارين. */
    async run(state) {
      Object.assign(ctx, state);
      const fn = new Function(
        'ctx', 'document', '$', 'fontById', 'russianFontId', 'applyFont',
        'fontFullLabel', 'paintFontChips', 'DEFAULT_SIZE_PX',
        bodyOf(await source(), 'applyFonts'),
      );
      fn(ctx, doc, doc.querySelector, fontById, russianFontId, applyFont,
        fontFullLabel, () => {}, 30);
    },
    /** عرضُ النصّ **مرسومًا** — لا اسمَ عائلةٍ ولا سلسلةَ أنماط. */
    width(sel) {
      const el = box.querySelector(sel);
      if (!el) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      return +range.getBoundingClientRect().width.toFixed(1);
    },
    style(sel) {
      const el = box.querySelector(sel);
      return el ? getComputedStyle(el).fontStyle : null;
    },
    close() { box.remove(); },
  };
}

const LINES = '.sh-line [data-line-text]';
const FLOW = '.sh-flow-s';
const HERO = '[data-text]';

describe('WS-FFP · «نصّ كامل» يتبع نفسَ الوجه الذي يتبعه «جمل»', () => {
  /*
   * ⚠️ **ويُمحى قياسُ التغطية أوّلًا.** `russianFontId` تبدّل خطًّا قِيس
   *    أنّه بلا سيريلية — وذاك محروسٌ في `font-coverage.test.js`. ولو
   *    بقي تقريرُ ملفٍّ سابقٍ في الذاكرة لصار الوجهُ المطبَّقُ غيرَ
   *    المختار، فيقيس هذا الملفُّ شيئًا آخرَ ويظنّه عطبَه.
   */
  const fresh = async (state) => {
    noteCoverage(null);
    const f = harness();
    await f.run(state);
    return f;
  };

  it('١ · نفسُ النصّ في الوضعين يُرسَم بنفس العرض — والاختيارُ واحد', async () => {
    /*
     * ⚠️ **وخطُّ المسرح يُضبَط مخالفًا عمدًا في كلّ دورة.** لو ساويتُ
     *    الإعدادين لنجح الحارسُ مع الربط الخاطئ ومع الصحيح معًا —
     *    وحارسٌ ينجح في الحالتين لا يقول شيئًا.
     */
    for (const [doc, stage] of [['system', 'philosopher'], ['philosopher', 'system'], ['noto', 'system']]) {
      const f = await fresh({ fontDoc: doc, font: stage });
      const lines = f.width(LINES);
      const flow = f.width(FLOW);
      const hero = f.width(HERO);
      expect(`${doc}/${stage}: متساويان ${flow === lines}`)
        .toBe(`${doc}/${stage}: متساويان true`);
      /* ولا يتبع المسرحَ: عرضُه يفارق عرضَ البطل المضبوطِ على خطٍّ آخر. */
      expect(`${doc}/${stage}: يفارق المسرحَ ${flow !== hero}`)
        .toBe(`${doc}/${stage}: يفارق المسرحَ true`);
      f.close();
    }
  });

  it('٢ · وتبديلُ الاختيار يُبدّل **ما يُرسَم** لا سلسلةَ الأنماط وحدَها', async () => {
    /*
     * ⚠️ **وهذا هو الحارسُ الذي لا يُخدَع باسمِ عائلة.** خطٌّ لا يصل
     *    (أو لا يحمل سيريليةً) يُكتَب في `font-family` ولا يُغيّر بكسلًا
     *    واحدًا — وهو بلاغُ WS-CSFIM بحرفه. فالمقيسُ ثلاثةُ عروضٍ
     *    **مختلفةٍ** لثلاثة اختيارات.
     */
    const seen = [];
    for (const doc of ['system', 'philosopher', 'noto']) {
      const f = await fresh({ fontDoc: doc, font: 'kurale' });
      seen.push(f.width(FLOW));
      f.close();
    }
    expect(`عروضٌ مقيسة: ${seen.length}`).toBe('عروضٌ مقيسة: 3');
    expect(`مختلفةٌ كلُّها: ${new Set(seen).size === 3}`).toBe('مختلفةٌ كلُّها: true');
  });

  it('٣ · والمَيلُ ينتقل كما ينتقل الوجه', async () => {
    /*
     * ⚠️ `philosopher` مائلٌ في السجلّ، و`applyFont` تكتب `font-style`
     *    مع العائلة. فلو نُقلت العائلةُ وحدَها لبقي «نصٌّ كامل» قائمًا
     *    والسطورُ مائلة — تفاوتٌ يراه المستخدم ولا يلتقطه حارسُ عائلة.
     */
    const f = await fresh({ fontDoc: 'philosopher', font: 'noto' });
    expect(`سطور: ${f.style(LINES)} · كامل: ${f.style(FLOW)}`)
      .toBe('سطور: italic · كامل: italic');
    expect(`والبطلُ قائم: ${f.style(HERO)}`).toBe('والبطلُ قائم: normal');
    f.close();
  });

  it('٤ · ولا يتبع «نصّ كامل» خطَّ المسرح — نقضُ ربطِ WS-VFP مقيسًا', async () => {
    /*
     * ⚠️ **وهذا الحارسُ يحرس تراجعي أنا.** في WS-VFP ربطتُ `.sh-flow-s`
     *    بـ`ctx.font` على فرضٍ كتبتُه بيدي («زرُّ Aa يفتح المُنتقيَ على
     *    صفحة المسرح»)، والفرضُ كان خطأً. فلو عاد أحدٌ إلى `ru` سقط هذا
     *    السطرُ فورًا: العرضُ يصير عرضَ البطل لا عرضَ السطور.
     */
    const f = await fresh({ fontDoc: 'philosopher', font: 'system' });
    const flow = f.width(FLOW);
    expect(`مع السطور ${flow === f.width(LINES)}`).toBe('مع السطور true');
    expect(`لا مع المسرح ${flow === f.width(HERO)}`).toBe('لا مع المسرح false');
    f.close();
  });

  it('٥ · وتبديلُ Aa و«نصّ كامل» مفتوحٌ يكفي وحدَه — بلا زيارةِ «جمل»', async () => {
    /*
     * ⚠️ **شرطُك الصريح**: «لازم يشتغل من غير ما المستخدم يفتح وضع
     *    الجمل الأول». والمسارُ الحقيقيُّ هو `pickFont`: تكتب الاختيارَ
     *    ثمّ تنادي `applyFonts` مباشرةً — بلا إعادةِ رسمٍ ولا تبديلِ
     *    وضع. فهنا تُحاكى الضغطةُ على شجرةٍ لم تُعَد بناءً: يُغيَّر
     *    `fontDoc` وتُنفَّذ `applyFonts` فقط.
     */
    const f = await fresh({ fontDoc: 'noto', font: 'noto' });
    const before = f.width(FLOW);
    await f.run({ fontDoc: 'system' });
    const after = f.width(FLOW);
    expect(`تبدّل ما يُرسَم: ${before !== after}`).toBe('تبدّل ما يُرسَم: true');
    expect(`وصار كالسطور: ${after === f.width(LINES)}`).toBe('وصار كالسطور: true');
    f.close();

    /* وأنّ الضغطةَ تنادي `applyFonts` بلا رسمٍ: مقروءٌ من المسار نفسِه. */
    const pick = bodyOf(await source(), 'pickFont');
    expect(`تكتب الاختيارَ: ${/ctx\.fontDoc = fontId/.test(pick)}`).toBe('تكتب الاختيارَ: true');
    expect(`وتُطبّق فورًا: ${/applyFonts\(\);/.test(pick)}`).toBe('وتُطبّق فورًا: true');
  });

  it('٦ · ويعود الخطُّ بعد استبدال المحتوى — الأنماطُ السطريّةُ تضيع', async () => {
    /*
     * ⚠️ **الدرسُ المدفوعُ ثمنُه مرّتين**: `applyFont` تكتب نمطًا
     *    **سطريًّا** على العنصر، و`paintLines` تستبدل `innerHTML` كلَّه
     *    مع كلّ نقلةِ جملةٍ وكلّ تبديلِ وضع — فيضيع. فالمحروسُ أمران:
     *    أنّ الضياعَ حقيقيٌّ (يُقاس)، وأنّ إعادةَ التطبيق تستردّه.
     */
    const f = await fresh({ fontDoc: 'system', font: 'noto' });
    const dressed = f.width(FLOW);
    const host = f.box.querySelector('.sh-flow-p');
    host.innerHTML = `<span class="sh-flow-s" data-line="0">${RU}</span>`;
    const naked = f.width(FLOW);
    expect(`ضاع بالاستبدال: ${naked !== dressed}`).toBe('ضاع بالاستبدال: true');
    await f.run({});
    expect(`واستُرِدّ: ${f.width(FLOW) === dressed}`).toBe('واستُرِدّ: true');
    f.close();

    /* والراسمُ نفسُه يُعيدها: `applyFonts` بعد استبدال `innerHTML`. */
    const paint = bodyOf(await source(), 'paintLines');
    const order = paint.indexOf('host.innerHTML') < paint.indexOf('applyFonts();');
    expect(`بعد الاستبدال: ${paint.includes('applyFonts();') && order}`)
      .toBe('بعد الاستبدال: true');
  });

  it('٧ · وسطورُ «جمل» لم تُمَسّ — هي الشاهدُ لا المُعالَج', async () => {
    /*
     * ⚠️ **الضابطُ يبقى ضابطًا.** الإصلاحُ كان في طرفٍ واحد: «نصّ كامل».
     *    فلو انزلق أحدُهما يومًا إلى `ctx.font` سقط هذا السطرُ كما يسقط
     *    أخوه — والوجهُ العامل لا يُغيَّر لإرضاء حارس.
     */
    const f = await fresh({ fontDoc: 'system', font: 'philosopher' });
    const lines = f.width(LINES);
    expect(`يفارق المسرحَ: ${lines !== f.width(HERO)}`).toBe('يفارق المسرحَ: true');
    await f.run({ fontDoc: 'philosopher' });
    expect(`ويتبع الصفحةَ: ${f.width(LINES) !== lines}`).toBe('ويتبع الصفحةَ: true');
    f.close();
  });

  it('٨ · ولوحةُ الأصل تبقى على خطّ المسرح — تفاوتٌ مُعلَنٌ لا مُنسيّ', async () => {
    /*
     * ⚠️ **ولم تُمَسّ بطلبك الصريح في الطور الثاني**: «نفسُ خطّ القراءة
     *    المعتمَد الذي للبطل والرقاقات». فهي تتبع `ctx.font` عمدًا،
     *    والحارسُ يُثبِّت ذلك حتّى لا يُسحَب معها في إصلاحٍ لاحقٍ بحجّة
     *    «توحيدِ الخطوط» بلا أن تطلبه.
     */
    const f = await fresh({ fontDoc: 'philosopher', font: 'system' });
    expect(`مع المسرح: ${f.width('.sh-origin-sent') === f.width(HERO)}`)
      .toBe('مع المسرح: true');
    f.close();
  });

  it('٩ · ولا حالةَ خطٍّ ثالثة — إعدادان اثنان لا غير', async () => {
    /*
     * ⚠️ شرطُك: «لا مُنتقيَ خطٍّ ثانٍ ولا نظامَ خطوطٍ جديد». فالمقروءُ
     *    من جسم `applyFonts` نفسِه: لا يقرأ من `ctx` إلّا `font` و
     *    `fontDoc` (ومقاسًا وحجمًا)، ولا حقلَ باسم النصّ الكامل.
     */
    const body = bodyOf(await source(), 'applyFonts');
    const reads = new Set([...body.matchAll(/ctx\.([A-Za-z]+)/g)].map((m) => m[1]));
    expect(`ما يُقرأ: ${[...reads].sort().join(',')}`)
      .toBe('ما يُقرأ: font,fontDoc,fontSize,sizePx');
    const src = await source();
    expect(`حقلٌ ثالث: ${/fullTextFont|fontFlowId|fontFullId/.test(src)}`)
      .toBe('حقلٌ ثالث: false');
  });

  it('١٠ · ويمرّ الاثنان بحارس السيريلية — لا يُطبَّق وجهٌ لا يرسمها', async () => {
    /*
     * ⚠️ **وهذا ما فرّق WS-CSFIM بين «تبدّلت السلسلة» و«تبدّل المرسوم»**:
     *    خطٌّ بلا سيريلية يُطبَّق فتُرسَم الروسيّةُ من احتياطيٍّ صامت.
     *    فالمعرّفان كلاهما يمرّان بـ`russianFontId`. ويُقاس أثرُه هنا
     *    حيًّا: يُعلَن `pacifico` عاجزًا فيُرسَم «نصٌّ كامل» ببديلٍ
     *    **مقيسٍ قادر** لا به.
     */
    const body = bodyOf(await source(), 'applyFonts');
    expect(`كلاهما محروس: ${/const ru = russianFontId\(ctx\.font\)/.test(body)
      && /const ruDoc = russianFontId\(ctx\.fontDoc\)/.test(body)}`)
      .toBe('كلاهما محروس: true');

    const f = harness();
    /* تقريرٌ مقيسٌ يقول: `pacifico` وصل ولا يرسم السيريلية، والبقيّةُ تقدر. */
    noteCoverage({
      pacifico: { id: 'pacifico', latin: true, cyrillic: false, status: 'no-cyrillic' },
      caveat: { id: 'caveat', latin: true, cyrillic: true, status: 'ok' },
      system: { id: 'system', latin: true, cyrillic: true, status: 'ok' },
    });
    await f.run({ fontDoc: 'pacifico', font: 'noto' });
    const applied = f.box.querySelector(FLOW).style.fontFamily;
    expect(`ليس العاجزَ: ${applied.includes('Pacifico')}`).toBe('ليس العاجزَ: false');
    /*
     * ⚠️ **ولا تُقارَن السلسلةُ حرفًا بحرف**: المتصفّحُ يُطبّع ما يُكتَب
     *    في `style.fontFamily` (يُسقط علاماتِ الاقتباس ويوحّد الفواصل)،
     *    فمقارنةُ النصّ الخام تسقط بلا عطب. والمقصودُ اسمُ العائلة.
     */
    const swap = fontById(russianFontId('pacifico'));
    expect(`البديلُ من صيغته: ${swap.form}`).toBe('البديلُ من صيغته: hand');
    expect(`وهو المُطبَّق: ${applied.includes(swap.family)}`).toBe('وهو المُطبَّق: true');
    /* ويلتقي بأخيه على البديل نفسِه — لا يفترقان في المخرج. */
    expect(`ومع السطور: ${applied === f.box.querySelector(LINES).style.fontFamily}`)
      .toBe('ومع السطور: true');
    noteCoverage(null);
    f.close();
  });
});

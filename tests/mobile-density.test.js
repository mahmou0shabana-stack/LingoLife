/**
 * LingoLife — كثافةُ الهاتف: S24 Ultra عموديًّا (WS-MB)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — ٤١٢×٩١٥ CSS
 * ═══════════════════════════════════════════════════════════════
 *
 *     شريطُ التطبيق ٥٤ · رأسُ الورشة ٤٤ · أشرطةُ المنابع ٤٧ ·
 *     لوحُ المصدر ١٧١ · المقبض ٢٢ · رأسُ النصّ ٣٤
 *     ───────────────────────────────────────────
 *     **ما فوق القائمة ٣٩٨px — ٤٣٪ من الشاشة**
 *     القائمة ٣٨٤ · الذيل ٣٩ · فجوةٌ ميّتة ٣٦ · الإحصاء ٤٨
 *     **ما تحتها ١٢٩px**
 *     نصُّ الجملة **٢٤٠ من ٤١٢** · صفوفٌ تُرى **٥ من ٢٠**
 *
 * أي أنّ الهاتفَ كان يرث تباعدَ التابلت.
 *
 * ⚠️ **والعلاجُ دمجُ النطاقات لا تصغيرُ الخطّ**: رأسُ الورشة وأشرطةُ
 *    المنابع نطاقان يتّسعان لسطرٍ واحد على الهاتف — فصارا سطرًا.
 *
 * ⚠️ **وأكثرُ ما يُحرَس هنا أنّ حدَّ الهاتف موجودٌ ويخصّ الهاتف وحدَه**:
 *    قاعدةٌ تتسرّب إلى التابلت تكسر ما بُني قبلها.
 */

import { describe, it, expect } from './test-runner.js';

let CSS = '';
let VIEW = '';
const css = async () => {
  if (!CSS) CSS = await (await fetch('../css/shadow.css')).text();
  return CSS;
};
const view = async () => {
  if (!VIEW) VIEW = await (await fetch('../js/views/shadow-view.js')).text();
  return VIEW;
};

/** كتلةُ حدِّ الهاتف كاملةً — تُقرأ مرّةً ويُقاس ما بداخلها. */
async function phoneBlock() {
  const text = await css();
  const at = text.lastIndexOf('@media (max-width: 640px) {');
  if (at < 0) return '';
  /* نهايةُ الكتلة: أوّلُ قوسٍ مغلقٍ في عمود صفر بعد بدايتها. */
  const end = text.indexOf('\n}\n', at);
  return text.slice(at, end < 0 ? text.length : end);
}

/* ================================================================== *
 * أ) حدُّ الهاتف موجودٌ وصريح                                           *
 * ================================================================== */
describe('WS-MB · حدُّ الهاتف صريحٌ لا وراثةٌ تتقلّص', () => {
  it('١ · كتلةُ ٦٤٠px موجودةٌ وتخصّ صفحةَ النصّ', async () => {
    /*
     * ⚠️ **بند ١٣**: «لا تدع الهاتفَ يرث تباعدَ التابلت بالصدفة».
     *    فالحدُّ مكتوبٌ قصدًا، وما دونه يُعاد ضبطُه سطرًا سطرًا.
     */
    const block = await phoneBlock();
    expect(block.length > 600).toBe(true);
    for (const sel of ['.sh-book', '.sh-page', '.sh-left .sh-ref',
      '.sh-left .sh-well-tabs', '.sh-left .sh-doc', '.sh-left .sh-line',
      '.sh-foot-tabs', '.sh-stats']) {
      expect(block).toContain(sel);
    }
  });

  it('٢ · ولا تتسرّب قواعدُه إلى ما فوقه', async () => {
    const text = await css();
    const block = await phoneBlock();
    /*
     * ⚠️ **الفرقُ بين «مضغوطٌ على الهاتف» و«مكسورٌ على التابلت».**
     *    إخفاءُ FIT/FULL ودمجُ الصفّ مكتوبان **داخل** الكتلة وحدَها،
     *    فلا وجودَ لهما خارجها.
     */
    expect(block).toContain('button[data-fit] { display: none; }');
    const outside = text.slice(0, text.lastIndexOf('@media (max-width: 640px) {'));
    expect(outside.includes('button[data-fit] { display: none; }')).toBe(false);
    expect(outside.includes('[data-ref-title] { display: none; }')).toBe(false);
  });
});

/* ================================================================== *
 * ب) النطاقاتُ تُدمَج                                                   *
 * ================================================================== */
describe('WS-MB · نطاقان يصيران نطاقًا', () => {
  it('٣ · رأسُ الورشة وأشرطةُ المنابع على سطرٍ واحد', async () => {
    /*
     * ⚠️ **دمجٌ بالترتيب لا ببنيةٍ جديدة** (بند ٢): `.sh-ref` تصير
     *    صفًّا يلتفّ، فتقف الأشرطةُ والأزرارُ معًا ويهبط لوحُ المستند
     *    تحتهما. ولا عنصرَ أُضيف ولا زرٌّ انتقل في الوسم.
     */
    const block = await phoneBlock();
    expect(block).toContain('.sh-left .sh-ref { flex-direction: row; flex-wrap: wrap;');
    expect(block).toContain('order: 2');
    expect(block).toContain('order: 1');
    expect(block).toContain('order: 3');
  });

  it('٤ · وعنوانُ «SOURCE · TEXT» يغيب لأنّ الشريطَ الفعّال يقوله', async () => {
    const block = await phoneBlock();
    expect(block).toContain('[data-ref-title] { display: none; }');
  });

  it('٥ · وشريطُ المنابع سطرٌ واحدٌ يُسحَب لا سطران', async () => {
    /*
     * ⚠️ **بند ٣**: سبعةُ منابعَ لا تتّسع لعرض الهاتف، والالتفافُ
     *    يضاعف ارتفاعَ النطاق. والسحبُ أرخصُ من سطرٍ ثانٍ دائم.
     */
    const block = await phoneBlock();
    expect(block).toContain('flex-wrap: nowrap; overflow-x: auto;');
    expect(block).toContain('white-space: nowrap');
    /* وحافّةٌ متلاشيةٌ تقول «فيه كمان» — فالقصُّ لغةٌ لا عطب. */
    expect(block).toContain('mask-image: linear-gradient(to left');
  });

  it('٦ · ⚠️ وخانةُ رقاقة الخطّ محجوزةٌ — وإلّا غطّت زرًّا', async () => {
    /*
     * ⚠️ رقاقةُ «Aa» **مطلقةٌ في ركن الصفحة** منذ تمريرةٍ سابقة (لئلّا
     *    تأخذ صفًّا لنفسها)، فهي تطفو فوق يمين الرأس. وقِستُ التراكبَ
     *    فعلًا: صندوقُها ٣٩→٥ وصندوقُ FULL ٤٨→٥. فالحجزُ لا الإلغاء.
     */
    const block = await phoneBlock();
    expect(block).toContain('padding-inline-end: 38px');
  });
});

/* ================================================================== *
 * ج) الصفّ والقائمة                                                    *
 * ================================================================== */
describe('WS-MB · قائمةُ قراءةٍ لا رصُّ بطاقات', () => {
  it('٧ · الصفُّ بحشوةٍ أقلَّ ولا إطارَ بطاقةٍ حوله', async () => {
    /*
     * ⚠️ **بندا ٦ و٧**: «لا تجعل كلَّ جملةٍ بطاقةً كبيرة».
     *
     * ⚠️ **وهذا الحارسُ عُكس عمدًا في WS-BK.** كان يشترط
     *    `border-bottom: 1px solid` و`border-radius: 2px`
     *    و`padding: 5px 4px` — أي أنّه كان **يحرس المسطرةَ** التي
     *    تبيّن أنّها أقوى إشارةِ «قائمةِ تطبيق» في الصفحة، ويحرس
     *    حشوةً بالبكسل بينما الإيقاعُ الصحيحُ بالسطر.
     *
     *    فصار يقيس القصدَ لا الكتابة: لا حافّةَ دائريّةً ولا مسطرةً
     *    ولا خلفيّة، والحشوةُ نسبةٌ من السطر لا رقمٌ ثابت. وحدُّ
     *    الهاتف ما زال يضغط الصفَّ — وهو ما كانت تعنيه WS-MB.
     */
    const block = await phoneBlock();
    const bare = block.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(/\.sh-left \.sh-line \{[^}]*padding: \.\d+em/.test(bare)).toBe(true);
    expect(/\.sh-left \.sh-line \{[^}]*border-bottom: 0/.test(bare)).toBe(true);
    expect(/\.sh-left \.sh-line \{[^}]*border-radius: 0/.test(bare)).toBe(true);
    expect(/\.sh-left \.sh-line \{[^}]*background: transparent/.test(bare)).toBe(true);
  });

  it('٨ · والمحدَّدُ يُرى بلا بطاقةٍ ضخمة', async () => {
    /*
     * ⚠️ **والمنتقي تغيّر في WS-BK** — صار مقصورًا على وضع القراءة
     *    (`:not(.picking)`) كي لا يمسّ وضعَ الاختيار. فالحارسُ يسأل
     *    عن **الحالة** لا عن نصّ المنتقي: هل للجارية قاعدةٌ في حدّ
     *    الهاتف، وهل هي غَسْلةٌ لا بطاقة.
     */
    const block = await phoneBlock();
    const bare = block.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.sh-line\.current \{([^}]*)\}/.exec(bare);
    expect(Boolean(rule)).toBe(true);
    expect(rule[1]).toContain('background:');
    expect(/box-shadow: (none|inset)/.test(rule[1])).toBe(true);
  });

  it('٩ · والطابعُ الزمنيُّ يبقى خارج الصفّ', async () => {
    /*
     * ⚠️ **بند ٦**: «أُزيل بالفعل — أبقِه خارجًا». وهذا حارسٌ على ما
     *    أُنجز في تمريرةٍ سابقة كي لا يعود من بابٍ خلفيّ.
     */
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const body = src.slice(at, src.indexOf('\nfunction ', at + 10));
    expect(body.includes('class="ts"')).toBe(false);
  });

  it('١٠ · وحشوةُ الصفحة تنكمش فيكسب النصُّ عرضًا', async () => {
    /*
     * ⚠️ **بند ٥**: ١٦/١٦ على عرضِ ٤١٢ هي ٣٢px — ٧٫٨٪ من الشاشة
     *    لهامشٍ لا يقرؤه أحد. والكتابُ نفسُه كان يترك ١٦ أخرى.
     */
    /*
     * ⚠️ **والرقمُ صار متغيّرًا في WS-BK** (`--sh-pagepad`) لأنّ خطَّ
     *    الهامش يُحسَب منه أيضًا — ورقمان منفصلان ينفصلان. فالحارسُ
     *    يقرأ القيمةَ من حيث تُعرَّف، لا من نصِّ قاعدة `.sh-page`.
     */
    const block = await phoneBlock();
    const bare = block.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(bare).toContain('.sh-book { margin: 0 6px 6px; }');
    const pad = /--sh-pagepad:\s*(\d+)px/.exec(bare);
    expect(Boolean(pad)).toBe(true);
    expect(Number(pad[1]) <= 8).toBe(true);
    expect(/\.sh-page \{[^}]*padding: 10px var\(--sh-pagepad/.test(bare)).toBe(true);
  });
});

/* ================================================================== *
 * د) الذيلُ والإحصاء                                                   *
 * ================================================================== */
describe('WS-MB · الذيلُ يتوقّف عن أكل القراءة', () => {
  it('١١ · ثلاثةُ أعمدةٍ تصير سطرًا واحدًا', async () => {
    /*
     * ⚠️ **بند ١١ · الخيار أ**: «اجمعها في سطرٍ مضغوط». الرقمُ نفسُه
     *    باقٍ — تغيّر اصطفافُه لا وجودُه. وقِيس ٤٨px → ٢٠px.
     */
    const block = await phoneBlock();
    expect(block).toContain('.sh-stats b { display: inline;');
    expect(block).toContain('.sh-stats span { display: inline;');
    expect(block).toContain('.sh-stats > div { display: flex;');
  });

  it('١٢ · وأشرطةُ الذيل تنكمش ويبقى هدفُها ملموسًا', async () => {
    const block = await phoneBlock();
    expect(block).toContain('.sh-foot-tabs { gap: 14px; margin-top: 2px; padding-top: 3px; }');
    expect(block).toContain('min-block-size: 32px');
  });
});

/* ================================================================== *
 * هـ) المضغوطُ ليس الصغير                                              *
 * ================================================================== */
describe('WS-MB · تُضغَط المساحةُ لا قابليّةُ اللمس', () => {
  it('١٣ · ⚠️ كلُّ ما ضُغط بقي فوق حدّ الإصبع', async () => {
    /*
     * ⚠️ **بند ١٤**: «حجمُ هدفِ اللمس ليس المساحةَ الفارغة». فالحدودُ
     *    مكتوبةٌ صراحةً هنا — والفجواتُ حولها هي التي انكمشت.
     *
     *    والحدُّ الأدنى في هذه الكتلة ٣٠px، وهو ما تحمله رقاقةُ الوضع
     *    وأشرطةُ الذيل. وأشرطةُ المنابع ٤٠.
     */
    /*
     * ⚠️ **وأوّلُ صياغةٍ خلطت المقبضَ بالزرّ.** جمعتُ كلَّ
     *    `min-height` في الكتلة واشترطت ٣٠ فأدنى، فسقط الحارسُ على
     *    `.sh-docsplit` — وهو **مقبضُ سحبٍ** بعرض الورقة لا هدفَ نقر،
     *    وعلى `.sh-read-head` وهي حاويةٌ لا زرّ.
     *
     *    فالمقياسُ صار على **الأزرار** وحدَها، والمقبضُ يُقاس بحدّه هو.
     */
    const block = await phoneBlock();
    const buttons = [...block.matchAll(/button[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    const mins = buttons
      .map((one) => one.match(/min-(?:height|block-size):\s*(\d+)px/))
      .filter(Boolean).map((m) => Number(m[1]));
    expect(mins.length >= 3).toBe(true);
    expect(Math.min(...mins) >= 30).toBe(true);
    /* أشرطةُ المنابع أكبرُها لأنّها أكثرُها ضغطًا. */
    expect(block).toContain('min-height: 40px');
    /* والمقبضُ يُسحَب لا يُنقَر — فحدُّه غيرُ حدِّ الزرّ، ولا يُصفَّر. */
    expect(block).toContain('.sh-docsplit { min-block-size: 18px;');
  });

  it('١٤ · ولا يُخفى تحكُّمٌ لا بديلَ له', async () => {
    /*
     * ⚠️ **FIT/FULL يغيبان عن الهاتف وحدَهما** لأنّهما مقاسان جاهزان
     *    لـ`docSize`، و«▾» تطويه و«⛶» تكبّره والمقبضُ يسحبه. أي أنّ
     *    الطريقَ إلى ضبط اللوح باقٍ ثلاثَ مرّات.
     */
    const src = await view();
    expect(src).toContain('data-ref-fold');
    expect(src).toContain('data-ref-max');
    expect(src).toContain('data-sh="doc" data-fit="fit"');
    expect(src).toContain('data-sh="doc" data-fit="full"');
    const block = await phoneBlock();
    /* والمقبضُ يبقى مسحوبًا — ارتفاعُه لا يُصفَّر. */
    expect(block).toContain('.sh-docsplit { min-block-size: 18px;');
  });

  it('١٥ · ⚠️ ومكبّرُ الصوت لم يُخفَ — وتفسيري الأوّلُ كان خاطئًا', async () => {
    /*
     * ⚠️ كتبتُ أنّه «يأكل خُمسَ عرض النصّ» فأخفيتُه. ثمّ قِستُ فوجدتُ
     *    قاعدةً قائمةً منذ تمريرةٍ قديمة تُخفيه على كلّ الصفوف **إلّا
     *    الجارية** — فهو لا يأخذ عرضًا من أحدٍ أصلًا. فأُعيد.
     *
     *    والرقمُ الذي لا تقيسه تنسبه إلى الخطأ.
     */
    const text = await css();
    expect(text).toContain('.sh-line .spk { display: none; font-size: 13px; }');
    expect(text).toContain('.sh-line.current .spk { display: inline; }');
    const block = await phoneBlock();
    expect(block.includes('.spk { display: none; }')).toBe(false);
  });
});

/* ================================================================== *
 * و) النصُّ المتّصل على الهاتف                                           *
 * ================================================================== */
describe('WS-MB · النصُّ المتّصل أوفرُ أوضاعِ الهاتف', () => {
  it('١٦ · يملأ العرضَ وتباعدُه تباعدُ قراءة', async () => {
    /*
     * ⚠️ **وهذا الحارسُ حُدِّث في WS-BK**: كان يشترط الرقمين بالحرف
     *    (`margin-bottom: 10px; line-height: 1.72`)، فصار يسقط حين
     *    كبر النصُّ عمدًا. والمقصودُ أنّ الوضعَ المتّصلَ يملأ العرضَ
     *    وتباعدُه تباعدُ قراءةٍ لا قائمة — فذلك ما يُقاس.
     */
    const block = await phoneBlock();
    const bare = block.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(/\.sh-lines\.is-flow \{[^}]*padding-inline: 0/.test(bare)).toBe(true);
    const p = /\.sh-flow-p \{([^}]*)\}/.exec(bare);
    expect(Boolean(p)).toBe(true);
    const lh = Number(/line-height: ([\d.]+)/.exec(p[1])[1]);
    expect(lh >= 1.7).toBe(true);
    expect(lh <= 1.9).toBe(true);
  });

  it('١٧ · والهُويّةُ فيه كما هي — لم تمسَّها هذه التمريرة', async () => {
    /*
     * ⚠️ **بند ١٦**: «هذه تمريرةُ تخطيطٍ وكثافة». فالهُويّةُ والاختيارُ
     *    والمسودّةُ كما تركتها WS-TD — وحارسٌ يقيس ذلك هنا أيضًا كي
     *    لا يُكسَر من باب التنسيق.
     */
    const src = await view();
    const at = src.indexOf('function flowHtml(');
    const body = src.slice(at, src.indexOf('\nfunction ', at + 10));
    expect(body).toContain('data-line="${i}"');
    expect(body).toContain('role="button"');
  });
});

/**
 * LingoLife — المسرحُ للغة لا للأزرار (WS-ST)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — ٤١٢×٩١٥، جملةٌ من ١٤ كلمة
 * ═══════════════════════════════════════════════════════════════
 *
 *   شريطُ التطبيق ٥٤ · رأسُ المسرح ٦٨ · التقدّم ٤٥
 *   البطلُ ٣٢٩ — منها الجملةُ **١٤٠** والترجمةُ ٤٤ (و١٤٥ فراغًا)
 *   رقائقُ الكلمات **٩٠** — أربعةَ عشرَ فيها، **ثمانيةٌ تُرى**
 *   اللافتة ١٧ · الأوضاع ٥٨ · النقل ٩٤ · السريعة ٤٤ · الذيل ٤٠
 *
 *   الأزرارُ **٢١٣px** مقابل **٩٠px** للكلمات — ضعفان ونصف.
 *   حجمُ الكلمة المقسَّمة **١٣px** · تباعدُ الجملة ١٫٥
 *
 * ⚠️ **وعلى اللوح (١٢٨٠×٨٠٠) كان أسوأ**: الذيلُ ٧٨ والجملةُ ٥٦ فقط.
 *
 * ⚠️ **وهذه التمريرةُ تعكس قسمةً كتبتُها وشرحتُها بنفسي**: «الرقائقُ
 *    أداةٌ مساعدةٌ تُقيَّد بصفّين ولا تنمو على حساب ما جئتَ من أجله».
 *    والصحيحُ أنّ تقسيمَ الجملة إلى كلماتٍ **بطلٌ ثانٍ** لا حاشية.
 *
 * ⚠️ **وأكثرُ ما يُحرَس هنا نسبةٌ لا رقم**: «مساحةُ الكلمات أطولُ من
 *    الأزرار». فالأرقامُ المطلقةُ تتغيّر مع كلّ شاشةٍ وخطّ، والنسبةُ
 *    هي القرارُ نفسُه.
 */

import { describe, it, expect } from './test-runner.js';

let CSS = '';
const css = async () => {
  if (!CSS) CSS = await (await fetch('../css/shadow.css')).text();
  return CSS;
};

const SENT = 'Необходи́мо учи́тывать после́дствия вскры́тия, проверя́ть '
  + 'тре́бования процеду́ры и то́лько по́сле э́того принима́ть оконча́тельное реше́ние.';

const CHIP = (w) => `<button class="sh-chip"><span class="sh-chip-w">${w}</span>`
  + '<span class="sh-chip-bar"><i></i></span></button>';

/**
 * مسرحٌ معزولٌ بارتفاعٍ حقيقيّ — أصنافُه أصنافُ `shadow-view` نفسِها.
 *
 * ⚠️ والرقائقُ يرسمها جافاسكربت في التطبيق، فتُكتَب هنا بيدٍ —
 *    وحارسُ الختام يربط كلَّ صنفٍ منها بالمصدر.
 */
async function stageAt(width, height, { words = 14 } = {}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;inset-block-start:-20000px;inset-inline-start:0;
    inline-size:${width}px;block-size:${height}px;border:0;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  /*
   * ⚠️ والعددُ المطلوبُ يُبلَغ بالتكرار: الجملةُ أربعَ عشرةَ كلمةً،
   *    فطلبُ عشرين منها كان يعطي أربعَ عشرةَ — فسقط حارسُ الضغط على
   *    عيبٍ في الإطار لا في الشاشة.
   */
  const pool = SENT.split(/\s+/);
  const chips = Array.from({ length: words },
    (unused, i) => CHIP(pool[i % pool.length])).join('');

  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="${new URL('../css/tokens.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/base.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/shadow.css', location.href).href}">
    <style>
      html,body{margin:0;height:100%}
      /* هيكلُ الصفحة: شريطٌ ومسرحٌ وذيل، بارتفاعٍ محدَّدٍ كالتطبيق. */
      .shadow-app{display:flex;flex-direction:column;height:100%}
      .sh-body{flex:1 1 auto;min-height:0;display:flex}
      .sh-book{flex:1 1 auto;min-height:0;display:flex}
      .sh-pages{flex:1 1 auto;min-height:0;display:flex}
    </style></head><body>
    <!--
      ⚠️ **والمتغيّران يُكتَبان هنا كما يكتبهما التطبيق.** حجمُ الجملة
         محسوبٌ من متغيّرَي الحجم والطول: الأوّلُ منزلقُ المستخدم
         (افتراضُه ٣٠) والثاني درجةُ الطول (.9 لجملةٍ من ١٢١ حرفًا)،
         وكلاهما يكتبه جافاسكربت على جذر التطبيق.

         وبغيابهما يسقط الحسابُ إلى الاحتياطيّ ٤١px، فقِستُ في الإطار
         جملةً بـ**٣٧٧px** وهي في التطبيق ٢١٧ — فبدت الرقائقُ مسحوقةً
         وسقط حارسان على عيبٍ في الإطار لا في الشاشة.
         **البيئةُ التي لا تشبه التطبيق تقيس نفسَها.**

      ⚠️ **ولا علامةَ اقتباسٍ خلفيّةً في تعليقٍ داخل قالبٍ نصّيّ** —
         ولا اسمَ متغيّرٍ بشَرطتين بعدها. الأولى تُنهي القالب،
         والشَّرطتان تصيران عندئذٍ عاملَ إنقاصٍ فيسقط الملفُّ صامتًا
         بخطأِ «Invalid left-hand side expression». وهو الفخُّ المكتوبُ
         بحرفه فوق مفتاح الأوضاع في shadow-view.js — ووقعتُ فيه هنا.
    -->
    <div class="shadow-app" style="--sh-size:30px;--sh-len:.9">
      <div class="sh-topbar"><span class="sh-diamond"></span><b>LingoLife</b></div>
      <div class="sh-body"><div class="sh-book"><div class="sh-pages">
        <div class="sh-page sh-right">
          <div class="sh-stage-top">
            <div class="sh-mono sh-count"><b>2</b> / <span>04</span> SENTENCES</div>
            <div class="sh-bar"></div>
            <span class="sh-fontchip-mini">Aa</span>
          </div>
          <div class="sh-prog"><div class="sh-prog-head"><span class="sh-prog-sec">الجلسة</span>
            <span class="sh-prog-pos"><b>2</b> / 4</span></div>
            <div class="sh-prog-bar"><span class="sh-prog-fill"></span></div></div>
          <div class="sh-hero">
            <div class="sh-hero-top"><span class="sh-current-tools">
              <button>🔖</button><button>⧉</button><button>♡</button></span></div>
            <div class="sh-current-text" lang="ru" dir="ltr">${SENT}</div>
            <div class="sh-current-tr" dir="rtl">ترجمةٌ قصيرةٌ للجملة</div>
          </div>
          <div class="sh-chips">${chips}</div>
          <div class="sh-hint sh-mono">TAP A WORD TO HEAR</div>
          <div class="sh-modes"><button class="on">جملة</button><button>مقطع</button><button>كلمة</button></div>
          <div class="sh-transport">
            <button class="sh-nav-btn"><i class="sh-ico-prev"></i></button>
            <button class="sh-play"><i class="sh-ico-play"></i></button>
            <button class="sh-nav-btn"><i class="sh-ico-next"></i></button>
          </div>
          <div class="sh-quickpills"><button>1x</button><button>×5</button><button>ARABIC</button></div>
          <div class="sh-toolrail"><div class="sh-rail-tools"></div>
            <button class="sh-rail-toggle">‹</button></div>
        </div>
      </div></div></div>
      <div class="sh-bottom"><div class="sh-stats">
        <div><b>30</b><span>SENTENCES</span></div><div><b>370</b><span>WORDS</span></div>
        <div><b>57</b><span>REPS</span></div></div></div>
    </div></body></html>`);
  doc.close();

  /* الانتظارُ على أثرِ ورقة الظلّ وحدَها (درسُ WS-BK/WS-BG). */
  const ready = () => {
    const r = doc.querySelector('.sh-right');
    if (!r) return false;
    return iframe.contentWindow.getComputedStyle(r).position === 'relative';
  };
  const t0 = Date.now();
  while (!ready() && Date.now() - t0 < 4000) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const win = iframe.contentWindow;
  const cs = (sel) => win.getComputedStyle(doc.querySelector(sel));
  const H = (sel) => {
    const el = doc.querySelector(sel);
    if (!el) return 0;
    if (win.getComputedStyle(el).display === 'none') return 0;
    return Math.round(el.getBoundingClientRect().height);
  };
  const chipEls = [...doc.querySelectorAll('.sh-chip')];
  const chipsHost = doc.querySelector('.sh-chips');
  const hb = chipsHost.getBoundingClientRect();
  return {
    doc, win, cs, H, iframe,
    stageH: H('.sh-right'),
    chipsH: H('.sh-chips'),
    controlsH: H('.sh-hint') + H('.sh-modes') + H('.sh-transport') + H('.sh-quickpills'),
    heroH: H('.sh-hero'),
    sentenceH: H('.sh-current-text'),
    footerH: H('.sh-bottom'),
    headerH: H('.sh-topbar'),
    chips: {
      total: chipEls.length,
      rows: [...new Set(chipEls.map((c) => Math.round(c.getBoundingClientRect().top)))].length,
      /* كلمةٌ مقصوصةٌ أفقيًّا = نصُّها أوسعُ من صندوقها. */
      cutWords: chipEls.filter((c) => {
        const w = c.querySelector('.sh-chip-w');
        return w.scrollWidth > w.clientWidth + 1;
      }).length,
      reachable: chipsHost.scrollHeight <= chipsHost.clientHeight + 1
        || win.getComputedStyle(chipsHost).overflowY === 'auto',
      belowFold: chipEls.filter((c) => c.getBoundingClientRect().bottom > hb.bottom + 1).length,
    },
    box: (sel) => {
      const el = doc.querySelector(sel);
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    },
    overflowX: doc.documentElement.scrollWidth > doc.documentElement.clientWidth,
    close: () => iframe.remove(),
  };
}

/* ================================================================== *
 * أ) القسمة: الكلماتُ أطولُ من الأزرار                                  *
 * ================================================================== */
describe('WS-ST · الشاشةُ للغة', () => {
  it('١ · مساحةُ الكلمات أطولُ من كلّ الأزرار مجتمعةً — على الهاتف', async () => {
    /*
     * ⚠️ **هذا معيارُ القبول المكتوب** (بند ٢٧): «إن بقيت الضوابطُ
     *    تشغل ارتفاعًا أكثرَ من التقسيم فقد فشلت التمريرة». وكان
     *    القياسُ ٢١٣ مقابل ٩٠ — أي أنّ هذا الحارسَ كان يسقط بفارقٍ
     *    مضاعف.
     */
    const f = await stageAt(412, 915);
    expect(f.chipsH > f.controlsH).toBe(true);
    f.close();
  });

  it('٢ · وأطولُ من الأزرار على اللوح أيضًا', async () => {
    /* بند ٢٢: اللوحُ لا يعود إلى واجهةٍ متضخّمة. */
    const f = await stageAt(1280, 800);
    expect(f.chipsH > f.controlsH).toBe(true);
    f.close();
  });

  it('٣ · ونطاقُ الكلمات ينمو ولا يُقيَّد بصفّين', async () => {
    /*
     * ⚠️ **القيدُ القديم كان `max-height: 6.2em`** — صفّان بالتحديد.
     *    والحارسُ يقيس السلوكَ: النطاقُ ينمو (`flex-grow: 1`)، وسقفُه
     *    نسبةٌ من المسرح لا ارتفاعُ سطرين.
     */
    const f = await stageAt(412, 915);
    /*
     * ⚠️ **`>= 1` لا `=== '1'` (عُدِّل في WS-SZ).** المحروسُ أن النطاقَ
     *    **ينمو**، لا أن نصيبَه رقمٌ بعينه. وصار ٢ حين أخذ البطلُ ٣
     *    في قسمة المسرح — ونصيبٌ أكبرُ لا يكسر هذا الحارسَ، والرقمُ
     *    الحرفيُّ كان يحرس الصياغةَ لا القرار.
     */
    expect(Number(f.cs('.sh-chips').flexGrow) >= 1).toBe(true);
    const cap = f.cs('.sh-chips').maxHeight;
    expect(cap.includes('em')).toBe(false);
    expect(cap === 'none').toBe(false);
    f.close();

    /*
     * ⚠️ **وشرطُ `align-content: flex-start` نُقض عمدًا في WS-SZ** —
     *    وهذا موضعُ الحساب. كان قصدُه: «لا يتوسّط الفراغُ الكلماتِ
     *    فتلتصق بالترجمة ويبقى ما تحتها خاليًا». وبلاغُ WS-SZ عكسَ
     *    القرار: حقلُ الكلمات نطاقٌ في **النصف الأسفل** يتوسّط نصيبَه.
     *
     *    لكنّ **ما كان يحرسه هذا الشرطُ فعلًا باقٍ محروسًا**: عند
     *    الفيض تبدأ الصفوفُ من **أعلى** النطاق لا من وسطه. فالتوسيطُ
     *    الأعمى في صندوقٍ يُمرَّر يقصّ أعلاه قصًّا لا رجعةَ فيه (حدُّ
     *    التمرير الأعلى صفرٌ لا سالب) — وقد حدث ذلك فعلًا: ثلاثُ
     *    كلماتٍ من ٢٣ صارت غيرَ قابلةٍ للوصول. فصار الشرطُ سلوكًا
     *    مقيسًا بدل اسمِ قيمة: **لا رقاقةَ فوق حدّ نطاقها حين يفيض.**
     */
    const g = await stageAt(412, 915, { words: 23 });
    const host = g.doc.querySelector('.sh-chips');
    const hb = host.getBoundingClientRect();
    const above = [...g.doc.querySelectorAll('.sh-chip')]
      .filter((c) => c.getBoundingClientRect().top < hb.top - 1).length;
    const overflow = host.scrollHeight - host.clientHeight;
    g.close();
    expect(overflow > 0).toBe(true);
    expect(above).toBe(0);
  });

  it('٤ · والبطلُ لا يمتصّ الفائضَ فيصنع حفرة', async () => {
    /*
     * ⚠️ **بند ٢٠**: كان `flex: 1 1 auto` فيأخذ كلَّ فراغٍ زائد —
     *    وقِستُ جملةً من كلمةٍ واحدة: ٣١٦px لمحتوى ٨٩.
     */
    /*
     * ⚠️ **وشرطُ `flex-grow: 0` نُقض عمدًا في WS-SZ** — والحفرةُ
     *    التي يحرسها باقيةٌ محروسة، لكن بقياسها لا بمنع النموّ.
     *
     *    كان المنعُ صحيحًا **لأنّ الجملةَ كانت في أعلى البطل**
     *    (`justify-content: flex-start`): فكلُّ ما ينمو يصير فراغًا
     *    **تحتها** — حفرةً من جهةٍ واحدة. وقِيس حينها: صندوقٌ ٣١٦px
     *    لمحتوى ٨٩.
     *
     *    ومنعُ النموّ ثمنُه أنّ ارتفاعَ البطل يصير ارتفاعَ جملته،
     *    فيتحرّك كلُّ ما تحته بطولها — وهو عطبُ WS-SZ بحرفه: الترجمةُ
     *    عند ٢٢٫٥٪ في جملةٍ من كلمتين و٤٣٫٩٪ في جملةٍ من أربعَ عشرة.
     *
     *    فصار للبطل نصيبٌ **مع توسيطٍ آمن**: ينمو، والفائضُ يُقسَم
     *    **حول** الجملة لا يتجمّع تحتها. فالمحروسُ الآن هو ذلك
     *    بالضبط — لا حفرةَ من جهةٍ واحدةٍ داخل البطل — ويُقاس على
     *    جملةٍ قصيرةٍ حيث كان العطبُ أظهرَ ما يكون.
     */
    const f = await stageAt(412, 915, { words: 3 });
    const hero = f.doc.querySelector('.sh-hero').getBoundingClientRect();
    /*
     * ⚠️ **بصندوق الهامش لا بصندوق الحدّ.** أوّلُ قياسٍ أعطى ٤٦ أعلى
     *    و٦٦ أسفل فبدا التوسيطُ مكسورًا — والسببُ أنّ فليكس يوسّط
     *    **صناديقَ الهوامش**، فهامشُ ابنٍ سفليٌّ يُحسَب في التوسيط
     *    ولا يُحسَب في قياسي. المِرقابُ كان يقيس شيئًا آخر.
     */
    const kids = [...f.doc.querySelector('.sh-hero').children]
      .filter((c) => c.getBoundingClientRect().height > 0)
      .map((c) => {
        const r = c.getBoundingClientRect();
        const cs = f.win.getComputedStyle(c);
        return { top: r.top - parseFloat(cs.marginTop), bottom: r.bottom + parseFloat(cs.marginBottom) };
      });
    const gapTop = Math.round(Math.min(...kids.map((r) => r.top)) - hero.top);
    const gapBottom = Math.round(hero.bottom - Math.max(...kids.map((r) => r.bottom)));
    f.close();
    /* والفائضُ مقسومٌ حول المحتوى: الفرقُ بين الجهتين لا يتجاوز ١٤px. */
    expect(`أعلى ${gapTop} · أسفل ${gapBottom}`)
      .toBe(`أعلى ${gapTop} · أسفل ${Math.abs(gapTop - gapBottom) <= 14 ? gapBottom : gapTop}`);
  });
});

/* ================================================================== *
 * ب) الطباعة والقراءة                                                 *
 * ================================================================== */
describe('WS-ST · الكلمةُ تُقرأ والجملةُ تهيمن', () => {
  it('٥ · الكلمةُ المقسَّمةُ ١٧px فأكثر', async () => {
    /* بند ٧: كانت ١٣ — أصغرَ من متن الصفحة اليسرى. */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      expect(parseFloat(f.cs('.sh-chip-w').fontSize) >= 17).toBe(true);
      f.close();
    }
  });

  it('٦ · والجملةُ أكبرُ من الكلمة المقسَّمة ومن كلّ حبرِ الضوابط', async () => {
    /* بند ٠: التراتبُ جملةٌ ثمّ كلماتٌ ثمّ ترجمةٌ ثمّ ضوابط. */
    const f = await stageAt(412, 915);
    const sent = parseFloat(f.cs('.sh-current-text').fontSize);
    expect(sent > parseFloat(f.cs('.sh-chip-w').fontSize)).toBe(true);
    expect(sent > parseFloat(f.cs('.sh-current-tr').fontSize)).toBe(true);
    expect(sent > parseFloat(f.cs('.sh-modes button').fontSize) * 2).toBe(true);
    f.close();
  });

  it('٧ · وتباعدُ الجملة تباعدُ عرضٍ لا تباعدُ متن', async () => {
    /* بند ٤: ١٫٢٥–١٫٤ — وكان ١٫٥. */
    const f = await stageAt(412, 915);
    const c = f.cs('.sh-current-text');
    const ratio = parseFloat(c.lineHeight) / parseFloat(c.fontSize);
    expect(ratio >= 1.25).toBe(true);
    expect(ratio <= 1.4).toBe(true);
    f.close();
  });

  it('٨ · والروسيّةُ تقول عن نفسها إنّها روسيّة', async () => {
    const f = await stageAt(412, 915);
    const el = f.doc.querySelector('.sh-current-text');
    expect(el.lang).toBe('ru');
    expect(el.getAttribute('dir')).toBe('ltr');
    expect(f.cs('.sh-current-text').direction).toBe('ltr');
    f.close();
  });
});

/* ================================================================== *
 * ج) الضوابطُ تنكمش ويبقى اللمسُ ممكنًا                                 *
 * ================================================================== */
describe('WS-ST · ضوابطُ أصغرَ لا ضوابطَ مكسورة', () => {
  it('٩ · زرُّ التشغيل والتنقّلُ في المدى المطلوب ولمسُهما ممكن', async () => {
    /* بند ١١: التشغيل ٥٦–٦٤ · التنقّل ٤٤–٥٢ على الهاتف. */
    const f = await stageAt(412, 915);
    const play = f.box('.sh-play');
    const nav = f.box('.sh-nav-btn');
    expect(play.w >= 56 && play.w <= 64).toBe(true);
    expect(nav.w >= 44 && nav.w <= 52).toBe(true);
    f.close();
  });

  it('١٠ · ومفتاحُ الأوضاع والرقاقاتُ السريعةُ فوق حدّ الإصبع', async () => {
    /*
     * ⚠️ **بند ١٠ و١٩**: «أصغرُ وأدنى، ويبقى مريحَ اللمس». والحدُّ
     *    المعمولُ به في هذا التطبيق ٣٠px لما ضُغط عن قصد (WS-MB).
     */
    const f = await stageAt(412, 915);
    expect(f.box('.sh-modes button').h >= 30).toBe(true);
    expect(f.box('.sh-quickpills button').h >= 30).toBe(true);
    expect(f.box('.sh-chip').h >= 36).toBe(true);
    f.close();
  });

  it('١١ · والذيلُ سطرٌ واحدٌ لا ثلاثةُ أعمدة', async () => {
    /* بند ١٦: كان ٧٨px على اللوح و٤٠ على الهاتف. */
    for (const [w, h, cap] of [[412, 915, 40], [1280, 800, 48]]) {
      const f = await stageAt(w, h);
      expect(f.footerH <= cap).toBe(true);
      /*
       * والأرقامُ وأوصافُها في سطرٍ واحد.
       *
       * ⚠️ **ولا تُقاس بتساوي `top`**: الاصطفافُ على خطّ القاعدة
       *    (`baseline`) يجعل رقمًا بـ١٥px ووصفًا بـ٩px يبدآن من
       *    ارتفاعين مختلفين وهما على سطرٍ واحدٍ فعلًا. فقِستُ
       *    «سطران» وهما سطر. والمقياسُ الصحيحُ ارتفاعُ الكتلة.
       */
      expect(f.H('.sh-stats') <= 26).toBe(true);
      f.close();
    }
  });

  it('١٢ · ورأسُ المسرح سطرٌ لا ثلاثة', async () => {
    /* بند ١٣: العدّادُ ورقاقةُ «Aa» يتّسعان لسطرٍ واحد. */
    const f = await stageAt(412, 915);
    expect(f.cs('.sh-stage-top').flexDirection).toBe('row');
    const count = f.doc.querySelector('.sh-count').getBoundingClientRect();
    const chip = f.doc.querySelector('.sh-fontchip-mini').getBoundingClientRect();
    expect(Math.abs(count.top - chip.top) < 40).toBe(true);
    f.close();
  });
});

/* ================================================================== *
 * د) الضغطُ والحدود                                                   *
 * ================================================================== */
describe('WS-ST · عشرون كلمةً تبقى مستعملة', () => {
  it('١٣ · لا كلمةَ مقصوصةٌ أفقيًّا ولا فيضَ أفقيّ', async () => {
    for (const words of [4, 9, 14, 20]) {
      const f = await stageAt(412, 915, { words });
      expect(f.chips.cutWords).toBe(0);
      expect(f.overflowX).toBe(false);
      f.close();
    }
  });

  it('١٤ · والكلماتُ تلتفّ صفوفًا ولا تُخفى', async () => {
    /*
     * ⚠️ **بند ٩**: «لا تُصغَّر كلُّ الكلمات لتُحشَر في شاشة، ولا
     *    تُخفى لأنّها كثيرة». فما لا يظهر يبقى **قابلًا للوصول**
     *    بتمريرٍ محتوًى في النطاق نفسِه.
     */
    const f = await stageAt(412, 915, { words: 20 });
    expect(f.chips.total).toBe(20);
    expect(f.chips.rows >= 4).toBe(true);
    expect(f.chips.reachable).toBe(true);
    expect(f.cs('.sh-chips').overflowY).toBe('auto');
    f.close();
  });

  it('١٥ · وسكّةُ الأدوات لا تقتطع من عرض القراءة', async () => {
    /*
     * ⚠️ **بند ١٥**: السكّةُ تطفو على الحافّة ولا تحجز عمودًا. وهي
     *    كذلك قبل التمريرة — قِستُ فكانت مطلقةً بعرض ٤٨. فالحارسُ
     *    يمنع انحدارًا لا يُدَّعي إصلاحًا.
     */
    const f = await stageAt(412, 915);
    expect(f.cs('.sh-toolrail').position).toBe('absolute');
    f.close();
  });

  it('١٦ · وأصنافُ الإطار أصنافُ الراسم نفسِه', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    for (const cls of ['sh-stage-top', 'sh-count', 'sh-prog', 'sh-hero', 'sh-current-text',
      'sh-current-tr', 'sh-chips', 'sh-hint', 'sh-modes', 'sh-transport', 'sh-quickpills',
      'sh-toolrail', 'sh-play', 'sh-nav-btn']) {
      expect(src).toContain(cls);
    }
    /* والرقاقةُ يرسمها جافاسكربت بهذين الصنفين. */
    expect(src).toContain('sh-chip-w');
    expect(src).toContain('sh-chip-bar');
    /*
     * ولا قاعدةٌ تُقيّد الرقائقَ بصفّين بعد اليوم.
     *
     * ⚠️ **والتعليقاتُ تُشطَب أوّلًا.** كتبتُ الشرطَ على نصّ الملفّ
     *    كما هو فسقط الحارس — لأنّ `6.2em` مكتوبةٌ في **شرحي** لما
     *    كان. وهو الفخُّ نفسُه الذي وقعتُ فيه أربع مرّاتٍ قبلها:
     *    حارسٌ يقرأ الإنشاءَ يحرس الإنشاء.
     */
    const bare = (await css()).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(/max-height:\s*6\.2em/.test(bare)).toBe(false);
  });
});

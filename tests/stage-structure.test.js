/**
 * LingoLife — تقسيمُ المسرح وملكيّةُ الإيماءة (WS-SZ)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — ٤١٢×٩١٥
 * ═══════════════════════════════════════════════════════════════
 *
 *   أ) **لم يكن للمسرح تقسيمٌ — كان له ترتيبُ تراكم.** كلُّ نطاقٍ
 *      ارتفاعُه ارتفاعُ محتواه، فيتحرّك ما تحته بحسب طول الجملة:
 *
 *        كلمتان   الترجمةُ عند ٢٢٫٥٪ من المسرح · الكلماتُ ٢٤٦px
 *        ١٤ كلمة  الترجمةُ عند ٤٣٫٩٪            · الكلماتُ ٤٢٢px
 *
 *      أي أنّ الجسرَ نفسَه يتنقّل عبر **٢١ نقطةً مئويّة**، والنصفُ
 *      الأسفلُ يبقى فارغًا في الجملة القصيرة.
 *
 *   ب) **والسحبُ الأفقيُّ كان يموت على كلّ ما يُلمَس**: قِيس بلمسٍ
 *      حقيقيٍّ (CDP) أنّ القلبَ يعمل من تسعة أهدافٍ ويسقط من
 *      الرقاقة (403 → 403)، ومن الورقة حين يكون لها فائضٌ رأسيّ.
 *      سببان لا واحد: `touch-action: pan-y` على الرقاقة،
 *      و`overscroll-behavior: contain` **بمحوريه** في كلّ مُمرِّرٍ
 *      داخليّ. وكلاهما سؤالٌ واحد: **من يملك المحورَ الأفقيّ؟**
 *
 * ⚠️ **وما يُحرَس هنا نسبٌ وسلوكٌ لا أرقامٌ ولا تعليقات**: موضعُ
 *    الجسر كنسبةٍ من المسرح، وبلوغُ كلّ رقاقةٍ بالتمرير، وقيمُ
 *    `touch-action`/`overscroll-behavior` **المحسوبةُ** على عناصرَ
 *    مرسومةٍ — لا نصُّ الملفّ.
 *
 * ⚠️ **ودرسٌ تكرّر هنا مرّتين**: التوسيطُ في صندوقٍ يُمرَّر يُخفي
 *    أعلاه إخفاءً لا رجعةَ فيه (حدُّ التمرير الأعلى صفرٌ لا سالب)،
 *    والقاعدةُ التي تُكتَب أخيرًا تغلب ما كُتِب بنيّةٍ أحسن.
 */

import { describe, it, expect } from './test-runner.js';

const SENT_LONG = 'Необходи́мо учи́тывать после́дствия вскры́тия обору́дования, '
  + 'проверя́ть тре́бования вну́тренней процеду́ры контро́ля, сверя́ть '
  + 'компле́ктность по специфика́ции и то́лько по́сле э́того принима́ть '
  + 'оконча́тельное взве́шенное реше́ние коми́ссии.';
const SENT_SHORT = 'Да, коне́чно.';

const CHIP = (w) => `<button class="sh-chip" data-word="0"><span class="sh-chip-w">${w}</span>`
  + '<span class="sh-chip-bar"><i></i></span></button>';

/**
 * مسرحٌ معزولٌ يشبه التطبيق في **ما يخصّ القياس**: صفحتان داخل
 * مُقلِّبٍ واحد، و`data-layout` مكتوبٌ كما يكتبه `wireBookLayout`،
 * ومتغيّرا الحجم والطول كما يكتبهما الرسم.
 *
 * ⚠️ بلا `data-layout` لا تنطبق قواعدُ الصفحة الواحدة أصلًا — فيقيس
 *    الإطارُ شيئًا لا وجودَ له في التطبيق.
 *
 * ⚠️ ولا علامةَ اقتباسٍ خلفيّةً في أيّ تعليقٍ داخل هذا القالب: تُنهيه،
 *    ثم تصير الشَّرطتان في اسم متغيّرٍ عاملَ إنقاصٍ فيسقط الملفُّ صامتًا.
 */
async function stage(width, height, { words = 14, sentence = SENT_LONG, layout = 'single' } = {}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;inset-block-start:-20000px;inset-inline-start:0;
    inline-size:${width}px;block-size:${height}px;border:0;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;

  const pool = sentence.split(/\s+/);
  const chips = Array.from({ length: words }, (unused, i) => CHIP(pool[i % pool.length])).join('');
  const len = sentence.length > 150 ? '.78' : sentence.length > 80 ? '.9' : '1';

  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="${new URL('../css/tokens.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/base.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/shadow.css', location.href).href}">
    <style>
      html,body{margin:0;height:100%}
      .shadow-app{display:flex;flex-direction:column;height:100%}
      .sh-body{flex:1 1 auto;min-height:0;display:flex}
      .sh-book{flex:1 1 auto;min-height:0;display:flex}
      .sh-pages{flex:1 1 auto;min-height:0;display:flex}
    </style></head><body>
    <div class="shadow-app" style="--sh-size:30px;--sh-len:${len}">
      <div class="sh-topbar"><span class="sh-diamond"></span><b>LingoLife</b></div>
      <div class="sh-body"><div class="sh-book" data-layout="${layout}">
        <div class="sh-pages" data-pages>
        <div class="sh-page sh-left">
          <div class="sh-ref">
            <div class="sh-cover-box"><div class="sh-cover-scroll" data-cover-scroll></div>
              <div class="sh-cover-grip"></div></div>
            <details class="sh-origin" open><summary>النصّ الأصلي</summary>
              <div class="sh-origin-scroll"><p class="sh-origin-raw" dir="ltr" lang="ru">${sentence}</p></div>
              <div class="sh-origin-grip"></div></details>
            <div class="sh-doc">
              <div class="sh-lines">
                <div class="sh-line"><span class="sh-line-ru" dir="ltr" lang="ru">${sentence}</span></div>
                <div class="sh-line"><span class="sh-line-ru" dir="ltr" lang="ru">${sentence}</span></div>
              </div>
            </div>
            <div class="sh-docsplit"></div>
            <div class="sh-pdf"><div class="sh-pdf-stage"></div></div>
          </div>
        </div>
        <div class="sh-spine"></div>
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
            <div class="sh-current-text" lang="ru" dir="ltr">${sentence}</div>
          </div>
          <div class="sh-current-tr" dir="rtl">ترجمةٌ قصيرةٌ للجملة</div>
          <div class="sh-marks"></div>
          <div class="sh-chips">${chips}</div>
          <div class="sh-hint sh-mono">TAP A WORD TO HEAR</div>
          <div class="sh-modes"><button class="on">جملة</button><button>مقطع</button><button>كلمة</button></div>
          <div class="sh-transport">
            <button class="sh-nav-btn"><i class="sh-ico-prev"></i></button>
            <button class="sh-play"><i class="sh-ico-play"></i></button>
            <button class="sh-nav-btn"><i class="sh-ico-next"></i></button>
          </div>
          <!-- ⚠️ صفُّ الرقاقات حُذف (WS-POLISH) وصار لسانًا مطلقًا على الحافّة. -->
          <button class="sh-cc-tab" data-sh="drawer" aria-label="اضبط التدريب">⚙</button>
          <div class="sh-toolrail"><div class="sh-rail-tools"></div>
            <button class="sh-rail-toggle">‹</button></div>
        </div>
      </div></div></div>
      <div class="sh-bottom"><div class="sh-stats">
        <div><b>30</b><span>SENTENCES</span></div><div><b>370</b><span>WORDS</span></div>
        <div><b>57</b><span>REPS</span></div></div></div>
    </div></body></html>`);
  doc.close();

  /* الانتظارُ على أثرٍ لا تصنعه إلّا ورقةُ الظلّ (درسُ WS-BK/WS-BG). */
  const win = iframe.contentWindow;
  const ready = () => {
    const r = doc.querySelector('.sh-right');
    return !!r && win.getComputedStyle(r).position === 'relative';
  };
  const t0 = Date.now();
  while (!ready() && Date.now() - t0 < 4000) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const q = (sel) => doc.querySelector(sel);
  const cs = (sel) => win.getComputedStyle(q(sel));
  const stageEl = q('.sh-right');
  const sb = stageEl.getBoundingClientRect();
  /* الموضعُ نسبةً إلى المسرح — هو ما يعنيه «نطاقٌ أعلى/أوسط/أسفل». */
  const pctTop = (sel) => {
    const el = q(sel);
    if (!el || win.getComputedStyle(el).display === 'none') return null;
    return Math.round(1000 * (el.getBoundingClientRect().top - sb.top) / sb.height) / 10;
  };
  const pctH = (sel) => {
    const el = q(sel);
    if (!el || win.getComputedStyle(el).display === 'none') return 0;
    return Math.round(1000 * el.getBoundingClientRect().height / sb.height) / 10;
  };
  const chipEls = [...doc.querySelectorAll('.sh-right .sh-chip')];
  const host = q('.sh-right .sh-chips');
  const hb = host.getBoundingClientRect();

  return {
    doc, win, q, cs, pctTop, pctH,
    stageH: Math.round(sb.height),
    /* أوّلُ صفٍّ من **الكلمات المرسومة** لا صندوقها. */
    chipRowsTopPct: chipEls.length
      ? Math.round(1000 * (Math.min(...chipEls.map((c) => c.getBoundingClientRect().top)) - sb.top) / sb.height) / 10
      : null,
    chipRowsBottomPct: chipEls.length
      ? Math.round(1000 * (Math.max(...chipEls.map((c) => c.getBoundingClientRect().bottom)) - sb.top) / sb.height) / 10
      : null,
    chips: {
      total: chipEls.length,
      /* ⚠️ فوق الحدّ الأعلى = **غيرُ قابلٍ للوصول**: scrollTop لا يسلب. */
      above: chipEls.filter((c) => c.getBoundingClientRect().top < hb.top - 1).length,
      overflow: host.scrollHeight - host.clientHeight,
      atTop: host.scrollTop,
      scrollMax: (() => {
        host.scrollTop = 1e6;
        const max = host.scrollTop;
        host.scrollTop = 0;
        return max;
      })(),
      /* بعد التمرير إلى الأقصى: هل بقيت رقاقةٌ خارج الصندوق من أسفل؟ */
      unreachable: (() => {
        host.scrollTop = 1e6;
        const b2 = host.getBoundingClientRect();
        const out = chipEls.filter((c) => c.getBoundingClientRect().bottom > b2.bottom + 1).length;
        host.scrollTop = 0;
        return out;
      })(),
    },
    sentence: (() => {
      const el = q('.sh-right .sh-current-text');
      return { box: Math.round(el.clientHeight), content: Math.round(el.scrollHeight),
        above: el.scrollTop };
    })(),
    /*
     * المحورُ الأفقيُّ: من يملكه في هذه الشجرة؟
     *
     * ⚠️ **والمُمرِّرُ ليس كلَّ ما `scrollWidth` فيه أكبر.** أوّلُ كتابةٍ
     *    عدّت الكعبَ وشارةَ الخطّ وثلاثةَ أزرارٍ مُمرِّراتٍ أفقيّةً،
     *    وهي صناديقُ `overflow: visible` يفيض محتواها ولا تُمرَّر.
     *    والمُمرِّرُ من يقول `overflow-x` عنه إنّه يُمرِّر.
     */
    xScrollers: (() => {
      const all = [...doc.querySelectorAll('.sh-pages, .sh-pages *')];
      return all.filter((el) => {
        const ox = win.getComputedStyle(el).overflowX;
        return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1;
      }).map((el) => (el.className || '').toString().trim().split(/\s+/)[0] || el.tagName);
    })(),
    /* تقاطعُ `touch-action` صعودًا — هو ما يراه المتصفّحُ فعلًا. */
    allowsPanX: (sel) => {
      let el = q(sel);
      while (el && el !== doc.documentElement) {
        const ta = win.getComputedStyle(el).touchAction;
        if (ta === 'none' || ta === 'pan-y' || ta === 'pan-up' || ta === 'pan-down'
          || ta === 'pinch-zoom' || ta === 'pan-y pinch-zoom') return false;
        el = el.parentElement;
      }
      return true;
    },
    /* كلُّ عنصرٍ مرسومٍ في المسرح: هل خصم أحدُهم المحورَ الأفقيّ؟ */
    narrowers: () => [...doc.querySelectorAll('.sh-right *')]
      .filter((el) => {
        const ta = win.getComputedStyle(el).touchAction;
        return ta === 'none' || ta === 'pan-y' || ta === 'pan-y pinch-zoom';
      })
      .map((el) => (el.className || '').toString().trim().split(/\s+/)[0] || el.tagName),
    close: () => iframe.remove(),
  };
}

/* ================================================================== *
 * أ) تقسيمٌ ثابتٌ — النطاقُ نصيبٌ لا مقاسُ محتواه                      *
 * ================================================================== */
describe('WS-SZ · للمسرح تقسيمٌ لا ترتيبُ تراكم', () => {
  it('١ · الجسرُ يبقى في وسط المسرح مهما طالت الجملة', async () => {
    /*
     * ⚠️ الحارسُ الأوّلُ لهذه التمريرة: كان موضعُ الترجمة ٢٢٫٥٪ في
     *    جملةٍ من كلمتين و٤٣٫٩٪ في جملةٍ من أربعَ عشرة — فرقُ ٢١ نقطة.
     *    والنطاقُ المسموحُ هنا ١٢ نقطةً: يسمح بتنفّسٍ، ويمنع التراكم.
     */
    const a = await stage(412, 915, { words: 2, sentence: SENT_SHORT });
    const b = await stage(412, 915, { words: 14 });
    const short = a.pctTop('.sh-right .sh-current-tr');
    const long = b.pctTop('.sh-right .sh-current-tr');
    a.close(); b.close();
    expect(Math.abs(long - short) < 12).toBe(true);
    /* ووسطُ المسرح لا ثلثُه الأعلى. */
    expect(short > 33 && short < 60).toBe(true);
    expect(long > 33 && long < 60).toBe(true);
  });

  it('٢ · الكلماتُ تقف في النصف الأسفل ولو كانت كلمتين', async () => {
    const s = await stage(412, 915, { words: 2, sentence: SENT_SHORT });
    const top = s.chipRowsTopPct;
    s.close();
    expect(top > 50).toBe(true);
  });

  it('٣ · والنصفُ الأسفلُ ليس فراغًا: آخرُ صفٍّ يتجاوز ٦٠٪ من المسرح', async () => {
    /*
     * ⚠️ هذا بالحرف عطبُ البند ١٧: جملةٌ قصيرةٌ فتتكوّم الصفحةُ في
     *    نصفها الأعلى ويبقى النصفُ الأسفلُ خاليًا بنيويًّا.
     */
    const s = await stage(412, 915, { words: 2, sentence: SENT_SHORT });
    const bottom = s.chipRowsBottomPct;
    s.close();
    expect(bottom > 60).toBe(true);
  });

  it('٤ · الجملةُ أضخمُ من تقسيمها — قصيرةً كانت أو طويلة', async () => {
    /*
     * ⚠️ بندا ١ و٢: حقلُ الكلمات صار يطغى على الجملة. والنسبةُ هي
     *    القرارُ نفسُه، فتُحرَس في الطرفين لا في حالةٍ واحدةٍ مختارة.
     */
    /* ⚠️ والرقمُ يُقال في الرسالة: حارسٌ يقول «false» يبدأ تحقيقًا من الصفر. */
    for (const [words, sentence] of [[2, SENT_SHORT], [14, SENT_LONG], [23, SENT_LONG]]) {
      const s = await stage(412, 915, { words, sentence });
      const hero = s.pctH('.sh-right .sh-hero');
      const chips = s.pctH('.sh-right .sh-chips');
      const dbg = `stage=${s.stageH} heroPx=${Math.round(s.stageH * hero / 100)} chipsPx=${Math.round(s.stageH * chips / 100)}`;
      s.close();
      expect(`${words}: hero ${hero} > chips ${chips} = ${hero > chips} · ${dbg}`)
        .toBe(`${words}: hero ${hero} > chips ${chips} = true · ${dbg}`);
    }
  });

  it('٤ب · والنصيبُ مكتوبٌ ونافذ: البطلُ ينمو أسرعَ من تقسيمه', async () => {
    /*
     * ⚠️ **الحارسُ الذي كان ناقصًا — وكلّفني تمريرةً كاملةً من قياسٍ
     *    باطل.** كتبتُ للبطل نصيبًا (3 مقابل 2) وقرأتُ السطرَ بعيني
     *    ثلاثَ مرّاتٍ، وكان المحلِّلُ قد **أسقط القاعدة كلَّها**: تعليقي
     *    في ورقة الأنماط كان قد أُغلِق بعلامة الإغلاق، ثم تابعتُ
     *    الكتابةَ **بعدها** بسطورِ تعليقٍ لا تعليقَ حولها — فصار ما بعدها هُراءً
     *    يُبتلَع معه أوّلُ قاعدةٍ تالية. فبقي `flex: 0 0 auto` من كتلة
     *    الهاتف القديمة، وكانت القياساتُ كلُّها **لقاعٍ يعمل وحدَه**
     *    لا لنصيبٍ يعمل. والملفُّ يقرأ صحيحًا؛ الورقةُ وحدَها تقول.
     *
     *    فالمحروسُ هنا `flex-grow` **المحسوبة** — لا وجودُ نصٍّ في
     *    ملفّ. وقاعدةٌ مُسقَطةٌ تسقط هذا الحارسَ فورًا.
     */
    const s = await stage(412, 915, { words: 14 });
    const heroGrow = Number(s.cs('.sh-right .sh-hero').flexGrow);
    const chipsGrow = Number(s.cs('.sh-right .sh-chips').flexGrow);
    s.close();
    expect(`hero ${heroGrow} > chips ${chipsGrow} > 0`)
      .toBe(`hero ${heroGrow} > chips ${chipsGrow} > 0`);
    expect(heroGrow > chipsGrow).toBe(true);
    expect(chipsGrow > 0).toBe(true);
  });

  it('٥ · ولكلّ نطاقٍ قاعٌ نسبيٌّ فلا يُسحَق', async () => {
    const s = await stage(412, 915, { words: 2, sentence: SENT_SHORT });
    const hero = s.pctH('.sh-right .sh-hero');
    const chips = s.pctH('.sh-right .sh-chips');
    s.close();
    expect(hero >= 25).toBe(true);
    expect(chips >= 20).toBe(true);
  });

  it('٦ · والقاعُ يصمد على شاشةٍ أقصر ومع جملةٍ طويلة', async () => {
    /*
     * ⚠️ **الحارسُ الذي كشف عطبًا حقيقيًّا**: قاعُ الكلمات كان نسبةً
     *    (٢٤٪) تغلبها قاعدةٌ للهاتف مكتوبةٌ **بعدها** بنفس التخصّص
     *    (min-height بـ 3.6em). فعلى ٣٦٠×٨٠٠ بجملةٍ من ٢٣ كلمة:
     *    الكلماتُ **٧٫٣٪** من المسرح — أي ستُّ كلماتٍ من ثلاثٍ
     *    وعشرين. والعطبُ الذي يظهر بمقاسٍ واحدٍ أخفى من عطبٍ ثابت،
     *    فيُقاس المقاسُ الأقصر صراحةً.
     *
     * ⚠️ **وقياسُ الارتفاع وحدَه لم يكن حارسًا — أثبتتُه بطفرة.** أعدتُ
     *    القاعَ الإمّيَّ فبقي الحارسُ أخضر: الانهيارُ الأصليُّ كان
     *    يحتاج شرطَين (قاعٌ إمّيٌّ **و**بطلٌ بلا نصيب)، ولمّا صار
     *    للبطل نصيبٌ نافذٌ لم يعد الارتفاعُ يهبط. **وحارسٌ ينجو من
     *    نقض ما يحرسه ليس حارسًا** — فيُحرَس القرارُ نفسُه: أن يكون
     *    القاعُ **العاملُ** نسبةً من المسرح لا بكسلاتٍ من حجم خطّ.
     *    وهي قيمةٌ محسوبةٌ من التنازع لا نصٌّ في ملفّ.
     */
    const s = await stage(360, 800, { words: 23 });
    const chips = s.pctH('.sh-right .sh-chips');
    const floor = s.cs('.sh-right .sh-chips').minBlockSize;
    s.close();
    expect(chips >= 18).toBe(true);
    expect(`floor=${floor}`).toBe(`floor=${/%$/.test(floor) ? floor : '<نسبة>'}`);
  });

  it('٧ · سقفُ الكلمات يبقى نسبةً من المسرح لا صفوفًا بلا حدّ', async () => {
    const s = await stage(412, 915, { words: 23 });
    const chips = s.pctH('.sh-right .sh-chips');
    s.close();
    expect(chips <= 29).toBe(true);
  });
});

/* ================================================================== *
 * ب) ما يُقصّ يُدرَك — وإلّا فهو حذفٌ لا تقسيم                          *
 * ================================================================== */
describe('WS-SZ · لا كلمةَ تُخفى بلا سبيلٍ إليها', () => {
  it('٨ · لا رقاقةَ فوق حدّ نطاقها — التوسيطُ آمنٌ عند الفيض', async () => {
    /*
     * ⚠️ **قِيس على ٤١٢×٩١٥ بجملةٍ من ٢٣ كلمة** بعد `align-content:
     *    center` وحدَها: أوّلُ صفٍّ عند **‎-٣٩px**، وثلاثُ رقائقَ فوق
     *    الحدّ عند `scrollTop = 0`، و`scrollTop` أقصاه ٣٨ — فلا سبيلَ
     *    إليها أبدًا. التوسيطُ في صندوقٍ يُمرَّر يوزّع الفائضَ على
     *    الطرفين، وحدُّ التمرير الأعلى **صفرٌ لا سالب**.
     */
    const s = await stage(412, 915, { words: 23 });
    const above = s.chips.above;
    const overflow = s.chips.overflow;
    s.close();
    expect(overflow > 0).toBe(true);
    expect(above).toBe(0);
  });

  it('٩ · وكلُّ رقاقةٍ تُبلَغ بالتمرير إلى الأقصى', async () => {
    const s = await stage(412, 915, { words: 23 });
    const { overflow, scrollMax, unreachable } = s.chips;
    s.close();
    expect(scrollMax >= overflow - 1).toBe(true);
    expect(unreachable).toBe(0);
  });

  it('١٠ · والجملةُ كذلك: ما فاض منها يفيض من الأسفل لا من الأعلى', async () => {
    const s = await stage(360, 800, { words: 23 });
    const { box, content, above } = s.sentence;
    s.close();
    /* إن فاضت، فأعلاها عند الصفر — لا فوقه حيث لا يُدرَك. */
    if (content > box + 1) expect(above).toBe(0);
    else expect(above).toBe(0);
  });
});

/* ================================================================== *
 * ج) ملكيّةُ الإيماءة — المحورُ الأفقيُّ للمُقلِّب وحدَه                 *
 * ================================================================== */
describe('WS-SZ · من يملك المحورَ الأفقيّ', () => {
  const INNER = ['.sh-right .sh-current-text', '.sh-right .sh-current-tr',
    '.sh-right .sh-chips', '.sh-left .sh-doc', '.sh-left .sh-cover-scroll',
    '.sh-left .sh-origin-scroll', '.sh-left .sh-pdf-stage'];

  it('١١ · لا مُمرِّرَ داخليٌّ يحتوي المحورَ الأفقيّ', async () => {
    /*
     * ⚠️ **الاحتواءُ الأفقيُّ يقتل قلبَ الصفحة** حين يكون للصندوق
     *    فائضٌ رأسيٌّ يجعله هدفًا للتمرير: قِيس بلمسٍ حقيقيٍّ أنّ
     *    الورقة (`.sh-doc`، فائضُها 1px) تمنع القلبَ، والرقائقَ
     *    (فائضُها صفرٌ حينها) تسمح به — نفسُ القاعدة، نتيجتان.
     */
    const s = await stage(412, 915, { words: 23 });
    const out = INNER.map((sel) => [sel, s.cs(sel).overscrollBehaviorX]);
    s.close();
    for (const [sel, v] of out) expect(`${sel}=${v}`).toBe(`${sel}=auto`);
  });

  it('١٢ · والاحتواءُ الرأسيُّ باقٍ كما كُتِب — لم يُشترَ الأفقيُّ بثمنه', async () => {
    const s = await stage(412, 915, { words: 23 });
    const out = ['.sh-right .sh-current-text', '.sh-right .sh-chips', '.sh-left .sh-doc']
      .map((sel) => [sel, s.cs(sel).overscrollBehaviorY]);
    s.close();
    for (const [sel, v] of out) expect(`${sel}=${v}`).toBe(`${sel}=contain`);
  });

  it('١٣ · والمُقلِّبُ نفسُه يحتوي الأفقيّ فلا يجرّ التطبيقَ خلفه', async () => {
    const s = await stage(412, 915);
    const v = s.cs('.sh-pages').overscrollBehaviorX;
    s.close();
    expect(v).toBe('contain');
  });

  it('١٤ · رقاقةُ الكلمة لا تخصم المحورَ الأفقيّ', async () => {
    /*
     * ⚠️ `touch-action` **يُتقاطَع** صعودًا لا يُورَث: ما خصمته
     *    الرقاقةُ لا يردّه أبٌ. وكانت `pan-y` — فكان كلُّ إصبعٍ يبدأ
     *    فوق كلمةٍ يفقد القلبَ، والكلماتُ تغطّي النطاقَ الأسفلَ كلَّه.
     */
    const s = await stage(412, 915);
    const ta = s.cs('.sh-right .sh-chip').touchAction;
    const chain = s.allowsPanX('.sh-right .sh-chip');
    s.close();
    expect(ta.includes('pan-x')).toBe(true);
    expect(ta.includes('pan-y')).toBe(true);
    expect(chain).toBe(true);
  });

  it('١٥ · ولا عنصرَ مرسومٌ في المسرح يخصمه', async () => {
    /*
     * ⚠️ لا يُفحَص زرٌّ زرٌّ: تُمشَّط الشجرةُ كلُّها. فمن أضاف غدًا
     *    `pan-y` على ضابطٍ جديدٍ سقط هنا لا في بلاغٍ من تابلت.
     */
    const s = await stage(412, 915, { words: 23 });
    const bad = s.narrowers();
    s.close();
    expect(bad.join(',')).toBe('');
  });

  it('١٦ · ومن يملك إيماءتَه بحقٍّ يبقى مالكًا لها', async () => {
    /*
     * ⚠️ المقابضُ تُسحَب بالإصبع لتغيّر ارتفاعًا أو قسمةً — فسحبةٌ
     *    عليها ليست قلبَ صفحةٍ أبدًا. وقانونُ الملكيّة لا يمسّها،
     *    وإلّا صار «لا شيءَ يملك شيئًا».
     */
    const s = await stage(412, 915);
    const out = ['.sh-left .sh-cover-grip', '.sh-left .sh-origin-grip', '.sh-left .sh-docsplit']
      .map((sel) => [sel, s.cs(sel).touchAction]);
    s.close();
    for (const [sel, v] of out) expect(`${sel}=${v}`).toBe(`${sel}=none`);
  });

  it('١٧ · والمُقلِّبُ وحدَه هو المُمرِّرُ الأفقيّ في الشجرة', async () => {
    const s = await stage(412, 915, { words: 23 });
    const owners = s.xScrollers;
    s.close();
    expect(owners.join(',')).toBe('sh-pages');
  });

  it('١٨ · وقانونُ الملكيّة محصورٌ بوضع الصفحة الواحدة', async () => {
    /*
     * ⚠️ في وضع الصفحتين لا قلبَ أصلًا، فلا محورَ أفقيًّا يملكه أحد:
     *    تبقى القواعدُ كما كُتِبت، ولا تُغيَّر عادةُ صندوقٍ لغايةٍ
     *    لا وجودَ لها في ذلك الوضع.
     */
    const s = await stage(1280, 800, { words: 23, layout: 'two' });
    const v = s.cs('.sh-right .sh-chips').overscrollBehaviorX;
    s.close();
    expect(v).toBe('contain');
  });
});

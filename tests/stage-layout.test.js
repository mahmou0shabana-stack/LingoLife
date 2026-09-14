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

/*
 * ⚠️ **جملةٌ طويلةٌ بنبرٍ حقيقيٍّ في مدياتٍ** (WS-HEROSCROLL): النبرُ في
 *    الشاشة ليس حرفًا مركَّبًا بل `span.sh-stress` يكتبه `markSentence` —
 *    وله لونٌ حقيقيّ، بينما بياضُ الجملة تدرّجٌ مقصوصٌ على الحرف. وعليه
 *    يقوم فحصُ «هل يسافر البياضُ مع النصّ»، فلا يصحّ إطارٌ بلا مديات.
 */
const GOLD = (w) => `<span class="sh-stress">${w}</span>`;
const SENT_LONG = `Во вр${GOLD('е')}мя пров${GOLD('е')}рки оборудования мы `
  + `обсужд${GOLD('а')}ли визу${GOLD('а')}льное состо${GOLD('я')}ние систем `
  + `и реш${GOLD('и')}ли, что необход${GOLD('и')}мо подгот${GOLD('о')}вить `
  + `подр${GOLD('о')}бный отчёт о всех н${GOLD('а')}йденных пробл${GOLD('е')}мах, `
  + `потом${GOLD('у')} что руков${GOLD('о')}дство х${GOLD('о')}чет поним${GOLD('а')}ть.`;

const CHIP = (w) => `<button class="sh-chip"><span class="sh-chip-w">${w}</span>`
  + '<span class="sh-chip-bar"><i></i></span></button>';

/**
 * مسرحٌ معزولٌ بارتفاعٍ حقيقيّ — أصنافُه أصنافُ `shadow-view` نفسِها.
 *
 * ⚠️ والرقائقُ يرسمها جافاسكربت في التطبيق، فتُكتَب هنا بيدٍ —
 *    وحارسُ الختام يربط كلَّ صنفٍ منها بالمصدر.
 */
/*
 * ⚠️ **وخياران زِيدا لحرس التوسيط (WS-FONT-TRANSPORT)، لا للزينة:**
 *
 *    `layout` — التطبيقُ يضع `data-layout` على الكتاب، وعليه تتوقّف
 *    حشوةُ المسرح اليمنى (١٦px في الصفحة الواحدة مقابل حجزِ السكّة في
 *    الصفحتين). وبغيره يقيس الإطارُ حشوةً متماثلةً لا وجودَ لها في
 *    التطبيق — فيقول إنّ التوسيطَ سليمٌ وهو مائلٌ على الجهاز.
 *
 *    `rec` — وزرُّ التسجيل ابنٌ رابعٌ في شريط النقل منذ WS-SCLEAN، وهو
 *    **سببُ الميل الأكبر**. فإطارٌ بثلاثة أبناءٍ يخفي العطبَ الذي
 *    جاء الحارسُ من أجله.
 */
async function stageAt(width, height,
  { words = 14, layout = '', rec = false, tools = 2, sentence = SENT } = {}) {
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

  /*
   * ⚠️ **وأدواتُ السكّة يجب أن تكون في الإطار بعددها الحقيقيّ** (WS-VPOLISH).
   *    كان الإطارُ يبنيها فارغةً، والتطبيقُ في السكون يرسم **اثنتين** —
   *    ومنذ هذه التمريرة صار شكلُ السكّة يُشتَقّ من عددِ أزرارها، فإطارٌ
   *    فارغٌ يقيس حالةً لا وجودَ لها. والعددُ خيارٌ: ٢ سكونًا و١٢ بكلمةٍ
   *    ممسوكة — وهما العددان المقيسان من الشاشة الحيّة.
   */
  const railTools = Array.from({ length: tools },
    (unused, i) => `<button data-sh="tool" data-v="t${i}"><b>⚠</b></button>`).join('');

  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="${new URL('../css/tokens.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/base.css', location.href).href}">
    <!--
      ⚠️ **وورقةُ المكوّنات تُحمَّل هنا مع الظلّ — لأنّ الإشعارَ منها**
         (WS-77). الإطارُ كان يحمّل ثلاثًا، والتطبيقُ يحمّل ثنتَي عشرة.
         وما دام المحروسُ «هل يسرق ما يطفو لمسةَ ما تحته؟» فلا بدّ أن
         يكون السارقُ المحتمَل موجودًا بقواعده. وأُعيد قياسُ الحرّاس
         الاثنين والعشرين بعد إضافتها فلم يتغيّر رقمٌ واحد.
    -->
    <link rel="stylesheet" href="${new URL('../css/components.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/shadow.css', location.href).href}">
    <style>
      html,body{margin:0;height:100%}
      /*
       * ⚠️ **شريطُ تمريرٍ لا يحجز عرضًا — كما على الجهاز.**
       *    قِيس في التطبيق على ١٢٨٠×٨٠٠: clientWidth ٥٠٣ وoffsetWidth
       *    ٥٠٣ — أي أنّ شريطَ التمرير طبقةٌ عائمةٌ لا تقتطع. أمّا الإطارُ
       *    فيرسم شريطًا كلاسيكيًّا يأكل ١٥px، وظهورُه متأرجحٌ لأنّ
       *    ارتفاعَ المحتوى على حافّة الفيض — فينزاح مركزُ الصندوق
       *    ٧٫٥px بين قياسةٍ وأخرى.
       *
       *    وأثرُه مقيسٌ: حارسا التوسيط سقطا في تشغيلاتِ طفرةٍ لا تمسّ
       *    التخطيطَ أصلًا (طفرةُ ملكيّةِ المؤشّر)، ومرّةً هذا ومرّةً ذاك
       *    — وتبدُّلُ الساقط بين تشغيلين هو توقيعُ الأداةِ لا العطب.
       *
       *    ⚠️ وكتبتُ اسمَ الخاصّيّة أوّلَ مرّةٍ بين علامتَي اقتباسٍ
       *       خلفيّتين — **داخلَ قالبٍ نصّيّ** — فانتهى القالبُ عندها
       *       وسقط الملفُّ كلُّه بـmissing ) after argument list. وهو
       *       الفخُّ المكتوبُ بحرفه في تعليقٍ أسفلَ هذا بأسطر، ووقعتُ
       *       فيه للمرّة العاشرة في هذا المستودع.
       */
      .sh-page::-webkit-scrollbar{width:0;height:0}
      /*
       * ⚠️ **ولا انتقالاتٍ في إطار القياس — وهذا أصلُ تذبذبٍ طاردتُه طويلًا.**
       *    حشوةُ المسرح على اللوح لها انتقالٌ ٤٥٠ms (يُزيح الدرجُ الصفحةَ
       *    بسلاسة). فكان الإطارُ يقيس أحيانًا **في منتصف الانتقال**:
       *    قِيست الحشوةُ 25.1983px/40.0208px بدل 34/54 — ونسبتُهما واحدةٌ
       *    (٠٫٧٤١) أي لقطةٌ من الطريق. فينزاح مركزُ الصندوق ٣px ويسقط
       *    حارسُ التوسيط في طفرةٍ لا تمسّ التخطيطَ أصلًا.
       *
       *    ومراقبةُ أبعاد الصفحة لم تُمسكه: الحشوةُ تتغيّر والعرضُ
       *    والارتفاعُ ثابتان. فالعلاجُ أن تُطفأ الانتقالاتُ هنا — القياسُ
       *    يريد الحالةَ المستقرّة لا الطريقَ إليها.
       */
      *,*::before,*::after{transition:none !important}
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
      <div class="sh-body"><div class="sh-book" ${layout ? `data-layout="${layout}"` : ''}><div class="sh-pages">
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
            <div class="sh-current-tr" dir="rtl">ترجمةٌ قصيرةٌ للجملة</div>
          </div>
          <div class="sh-chips">${chips}</div>
          <div class="sh-hint sh-mono">TAP A WORD TO HEAR</div>
          <div class="sh-modes"><button class="on">جملة</button><button>مقطع</button><button>كلمة</button></div>
          <div class="sh-transport">
            <button class="sh-nav-btn"><i class="sh-ico-prev"></i></button>
            <button class="sh-play"><i class="sh-ico-play"></i></button>
            <button class="sh-nav-btn"><i class="sh-ico-next"></i></button>
            ${rec ? '<button class="sh-rec-btn" data-sh="tool" data-v="myvoice">\u{1F399}</button>' : ''}
          </div>
          <!-- ⚠️ صفُّ الرقاقات حُذف (WS-POLISH) وصار لسانًا مطلقًا على الحافّة. -->
          <button class="sh-cc-tab" data-sh="drawer" aria-label="اضبط التدريب">⚙</button>
          <!-- ⚠️ وزرُّ معاينة الخطّ في الإطار كما هو في الراسم: هو أقربُ
               أزرارِ السكّة إلى صفّ الأوضاع، فبدونه يحرس فحصُ التراكب
               نصفَ الجوار. -->
          <!-- ⚠️ وطبقاتُ الزينة الثلاثُ كما في الراسم: بلا وجودها يحرس
               فحصُ «الزينةُ لا تلتقط لمسًا» فراغًا. -->
          <div class="sh-plate" aria-hidden="true"></div>
          <div class="sh-stars-far" aria-hidden="true"></div>
          <div class="sh-stars-near" aria-hidden="true"></div>
          <div class="sh-sky-dim" aria-hidden="true"></div>
          <div class="sh-toolrail"><span class="sh-rail-ctx sh-mono">تدريب</span>
            <div class="sh-rail-tools">${railTools}</div><div class="sh-grow"></div>
            <button class="sh-qfont" data-sh="qfont"><span lang="ru">Аа</span></button>
            <button class="sh-rail-toggle" data-sh="rail">‹</button></div>
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
  /*
   * ⚠️ **ثمّ يُنتظَر أن يسكن التخطيطُ لا أن تصل الورقةُ فقط.**
   *
   *    سقط حارسا التوسيط (١٨ و٢٠) في ثلاث تشغيلاتِ طفرةٍ من أربع
   *    بأرقامٍ لا علاقةَ لها بالطفرة: ‎٧٫٣ ثمّ ‎٤٫٩ — ونصفُ الفارق نصفُ
   *    عرضِ شريط تمريرٍ كلاسيكيّ. وقِيس في التطبيق نفسِه بتبديل
   *    `z-index` حيًّا بين ٩ و١٣: **لا يتغيّر بكسل** (clientWidth ٥٠٣
   *    والفارقُ ‎−٠٫٢ في الحالتين). فالتذبذبُ من الإطار لا من الشاشة:
   *    الخطوطُ تصل بعد أوّل رسمٍ فيطول المحتوى فيظهر شريطُ التمرير،
   *    فتقع القياسةُ على جانبَي تلك اللحظة.
   *
   *    فالانتظارُ على **سكون الأبعاد** نفسِها: عرضٌ وارتفاعٌ ومحتوًى
   *    لا تتغيّر ثلاثَ إطاراتٍ متتالية. حدٌّ أعلى مقصوصٌ كي لا يعلّق
   *    الفحصُ إن لم تسكن أبدًا.
   */
  await (doc.fonts?.ready ?? Promise.resolve());
  const dims = () => {
    const el = doc.querySelector('.sh-right');
    if (!el) return '';
    /* والحشوةُ في الرقابة كذلك: تتغيّر بلا أن يتغيّر عرضٌ أو ارتفاع. */
    const s2 = iframe.contentWindow.getComputedStyle(el);
    return `${el.clientWidth}×${el.clientHeight}×${el.scrollHeight}`
      + `×${s2.paddingLeft}×${s2.paddingRight}`;
  };
  let last = dims(); let still = 0; const t1 = Date.now();
  while (still < 3 && Date.now() - t1 < 3000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = dims();
    still = (now === last) ? still + 1 : 0;
    last = now;
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
    /*
     * ⚠️ **وصفُّ الرقاقات خرج من الحساب (WS-POLISH)**: حُذف من المسرح
     *    وصار لسانًا **مطلقَ الموضع** — فلا يُجمَع في ارتفاع الضوابط
     *    لأنّه لا يقتطع من المحتوى شيئًا. وجمعُه كان سيُبقي ٣٢px
     *    وهميّةً في كلّ مقارنة.
     */
    controlsH: H('.sh-hint') + H('.sh-modes') + H('.sh-transport'),
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
    /* مستطيلٌ فيزيائيٌّ كامل — للتوسيط لا يكفي العرضُ والارتفاع. */
    rect: (sel) => {
      const el = doc.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, w: r.width, cx: (r.left + r.right) / 2 };
    },
    /*
     * الفارقُ بين وسط زرّ التشغيل ووسط المسرح — بالبكسل، بإشارته.
     *
     * ⚠️ **والمسرحُ يُقاس بصندوقه المرسوم لا بحدّه الخارجيّ.** شريطُ
     *    التمرير الكلاسيكيُّ يأكل من يمين الصندوق ولا يُرسَم عليه شيءٌ
     *    من المسرح — فوسطُ ما تراه العينُ وسطُ `client`. وقِيس الفرق:
     *    الحدُّ الخارجيُّ يقول ‎٤٫٩ والمرسومُ يقول صفرًا، والفارقُ نصفُ
     *    عرضِ الشريط بالضبط. وعلى الجهاز شريطُ التمرير طبقةٌ عائمةٌ لا
     *    تحجز عرضًا (قِيس في المسبار: الحدّان متطابقان والفارقُ صفر)،
     *    فالقياسان يتّفقان هناك ويفترقان في الإطار وحدَه — ولو حرستُ
     *    الحدَّ الخارجيَّ لحرستُ شريطَ تمريرِ سطحِ المكتب لا التوسيط.
     */
    playOffset: () => {
      const st = doc.querySelector('.sh-right');
      const sb = st.getBoundingClientRect();
      const pb = doc.querySelector('.sh-play').getBoundingClientRect();
      const drawnCx = sb.left + st.clientLeft + st.clientWidth / 2;
      return (pb.left + pb.right) / 2 - drawnCx;
    },
    settle: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
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
    /*
     * ⚠️ **وقد أُعيد توجيهُ هذا الحارس في WS-VPOLISH — لا أُسكِت.**
     *
     *    كان يشترط التماثل (فرقٌ ≤ ١٤px) لأنّ الحفرةَ من جهةٍ واحدةٍ
     *    كانت **غيرَ مقصودة**: تأتي من نموٍّ لا يملكه أحد. وطلبتَ أن
     *    ترتفع الجملةُ قليلًا — فصار الميلُ مقصودًا: هواءٌ أقلُّ فوقها
     *    وأكثرُ تحتها، بحشوةٍ مكتوبةٍ لا بفائضٍ متروك.
     *
     *    والمحروسُ الآن أن يبقى الميلُ **مقيَّدًا في الجهتين**: لا
     *    تلتصق الجملةُ بالرأس (فالأعلى لا يقلّ عن ٤٠٪ من الأسفل)، ولا
     *    يعود الفائضُ يتجمّع بلا حدّ (فالأعلى لا يتجاوز الأسفل). وبين
     *    الحدّين قِيس ٣٦ أعلى و٥٤ أسفل.
     */
    const leaning = gapTop <= gapBottom;
    const breathing = gapTop >= gapBottom * 0.4;
    expect(`أعلى ${gapTop} · أسفل ${gapBottom} · مائلٌ ${leaning} ومتنفّسٌ ${breathing}`)
      .toBe(`أعلى ${gapTop} · أسفل ${gapBottom} · مائلٌ true ومتنفّسٌ true`);
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
    /*
     * ⚠️ **واللسانُ بدل الرقاقات (WS-POLISH)**: الصفُّ حُذف، والبابُ
     *    صار مقبضًا على الحافّة — وحدُّ الإصبع يُحرَس عليه هو: ٤٤×٤٤
     *    كاملةً وإن كان حبرُه ١٣px.
     */
    expect(f.box('.sh-cc-tab').h >= 44).toBe(true);
    expect(f.box('.sh-cc-tab').w >= 44).toBe(true);
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
      'sh-current-tr', 'sh-chips', 'sh-hint', 'sh-modes', 'sh-transport', 'sh-cc-tab',
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

/* ================================================================== *
 * هـ) زرُّ التشغيل في وسط المسرح — قياسًا لا ترتيبًا (WS-FONT-TRANSPORT) *
 * ================================================================== */
describe('WS-FONT-TRANSPORT · التوسيطُ يُقاس', () => {
  /*
   * ⚠️ **ما قِيس قبل تغيير سطرٍ واحد** (والفارقُ سالبٌ أي إلى اليسار):
   *
   *     ٤١٢×٩١٥  · المسرح ٦..٤٠٦ وسطُه ٢٠٦   · التشغيل ١٧١   · ‎−٣٥
   *     ١٢٨٠×٨٠٠ · المسرح ٧٥٤..١٢٥٦ وسطُه ١٠٠٤٫٨ · التشغيل ٩٦١٫٨ · ‎−٤٣
   *
   *   سببان: ابنٌ رابعٌ في صفٍّ يتوسّط مجموعتَه (الميكروفون)، وحشوةٌ
   *   غيرُ متماثلةٍ تجعل صندوقَ المحتوى غيرَ صندوق المسرح.
   *
   * ⚠️ **والحدُّ بكسلٌ واحد لا «تقريبًا في الوسط»**: نصفُ بكسلٍ لا
   *    تراه العين، وثلاثون تراها فورًا — وبين الحدَّين لا شيءَ يستحقّ
   *    التساهل، فالرقمُ الذي يُسمَح به اليوم يصير أرضيّةَ الغد.
   */
  const TOL = 1;

  /*
   * ⚠️ **والرسالةُ تحمل أرقامَها.** «متوقّع true ووُجد false» لا يقول
   *    أانزاح الزرُّ أم انزاح الصندوقُ من تحته. فتُضَمّ إليها عرضُ
   *    الصندوق المرسوم وعرضُه الخارجيّ: إن اختلفا فشريطُ تمريرٍ حجز
   *    عرضًا — وهو أوّلُ ما أضلّني مرّتين.
   */
  const centreReport = (f) => {
    const st = f.doc.querySelector('.sh-right');
    const off = Math.round(f.playOffset() * 10) / 10;
    return `${Math.abs(off) <= TOL}:${off} (client=${st.clientWidth} offset=${Math.round(st.getBoundingClientRect().width)})`;
  };

  it('١٧ · زرُّ التشغيل وسطُ المسرح على الهاتف', async () => {
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    const got = centreReport(f);
    expect(got).toBe(`true:0 ${got.split(' ').slice(1).join(' ')}`);
    f.close();
  });

  it('١٨ · وعلى اللوح كذلك', async () => {
    const f = await stageAt(1280, 800, { layout: 'two', rec: true });
    const got = centreReport(f);
    expect(got).toBe(`true:0 ${got.split(' ').slice(1).join(' ')}`);
    f.close();
  });

  it('١٩ · وسابقٌ وتالٍ متناظران حولَه', async () => {
    /*
     * التوسيطُ وحدَه لا يكفي: زرٌّ في الوسط وجاراه إلى جهةٍ واحدةٍ
     * تركيبٌ أعرجُ وإن صدق الحساب. والقراءةُ المطلوبة: سابق · تشغيل ·
     * تالي.
     */
    for (const [w, h, layout] of [[412, 915, 'single'], [1280, 800, 'two']]) {
      const f = await stageAt(w, h, { layout, rec: true });
      const play = f.rect('.sh-play');
      const kids = [...f.doc.querySelectorAll('.sh-transport > .sh-nav-btn')];
      const [a, b] = kids.map((el) => el.getBoundingClientRect());
      const left = Math.min(a.left, b.left) < play.l ? a : b;
      const right = left === a ? b : a;
      const gapL = play.l - left.right;
      const gapR = right.left - play.r;
      expect(`${w}:${Math.abs(gapL - gapR) <= TOL}`).toBe(`${w}:true`);
      expect(`${w}:${left.right < play.l && right.left > play.r}`).toBe(`${w}:true`);
      f.close();
    }
  });

  it('٢٠ · واللسانُ والسكّةُ لا يشاركان في الحساب', async () => {
    /*
     * ⚠️ **بند ٢ صراحةً**: «لسانُ الإعدادات وسكّةُ الأدوات يجب ألّا
     *    يدفعا شريطَ النقل». وهما اليومَ مطلقا الموضع فلا يدفعان —
     *    والحارسُ يقيس ذلك **بإخفائهما**: لو عاد أحدُهما إلى التدفّق
     *    يومًا تحرّك الزرُّ عند إخفائه، ويسقط هذا هنا.
     */
    for (const [w, h, layout] of [[412, 915, 'single'], [1280, 800, 'two']]) {
      const f = await stageAt(w, h, { layout, rec: true });
      const before = f.playOffset();
      const tab = f.doc.querySelector('.sh-cc-tab');
      const rail = f.doc.querySelector('.sh-toolrail');
      tab.style.display = 'none';
      rail.style.display = 'none';
      await f.settle();
      const without = f.playOffset();
      tab.style.display = '';
      rail.style.display = '';
      await f.settle();
      const after = f.playOffset();
      expect(`${w}:${Math.round(without * 10) / 10}`).toBe(`${w}:${Math.round(before * 10) / 10}`);
      expect(`${w}:${Math.round(after * 10) / 10}`).toBe(`${w}:${Math.round(before * 10) / 10}`);
      f.close();
    }
  });

  it('٢١ · وزرُّ التسجيل خارج ميزان التوسيط', async () => {
    /*
     * ⚠️ **وهذا هو العطبُ الأصليُّ بعينه**: قبل التمريرة كان وجودُ
     *    الميكروفون يزيح التشغيلَ ٣١px. فالمحروسُ أنّ المسرحَ بميكروفونٍ
     *    والمسرحَ بلا ميكروفونٍ يضعان الزرَّ في **الموضع نفسِه** — أي
     *    أنّ أيَّ زرٍّ يُزاد غدًا في الطرف لن يحرّك الوسط.
     */
    const withRec = await stageAt(412, 915, { layout: 'single', rec: true });
    const bare = await stageAt(412, 915, { layout: 'single', rec: false });
    expect(Math.round(withRec.playOffset() * 10) / 10)
      .toBe(Math.round(bare.playOffset() * 10) / 10);
    withRec.close();
    bare.close();
  });

  it('٢٢ · ولا يقف الميكروفونُ تحت مقبضِ السكّة', async () => {
    /*
     * ⚠️ **عطبٌ صنعتُه هذه التمريرةُ وقِيس قبل أن يُصلَح**: بخروج
     *    الميكروفون من الميزان تبع `تالي` يمينًا ٣٥px فصار ٣٢٥..٣٦٥
     *    ومقبضُ السكّة يبدأ عند ٣٦٠ — خمسةُ بكسلاتٍ من زرَّين يُلمَسان
     *    فوق بعضهما. والتنحّي بقدرِ تجاوز السكّة لحصّتها المحجوزة.
     */
    /*
     * ⚠️ **وقد تبدّل المِرقابُ في WS-VPOLISH — ولا بدّ من قول لماذا.**
     *
     *    كان يقارن الميكروفونَ بصندوق **السكّة** لا بأزرارها: أي يمنعه
     *    من دخول عمودها ولو كان العمودُ في ذلك الارتفاع فارغًا. وكان
     *    ذلك مقبولًا يومَ كانت الأزرارُ موزّعةً على طول العمود من أعلاه
     *    إلى أسفله — فالصندوقُ كان وكيلًا صادقًا عنها.
     *
     *    ومنذ صار عنقودُ السكون مرصوصًا في وسط الحافّة (٩٢px لأداتين
     *    ومعاينةٍ ومقبض) صار الصندوقُ يكذب: يمتدّ بطول المسرح وأزرارُه
     *    في وسطه وحدَه، وهو `pointer-events: none` أصلًا (حارس ٢٩) فلا
     *    يسرق لمسةً في فراغه.
     *
     *    فالمحروسُ الآن ما كان يُقصَد دائمًا: **ألّا يتراكب الميكروفونُ
     *    مع زرٍّ يُلمَس**. وقِيس بعد الرصّ: خلوصٌ رأسيٌّ ٢٥٧px على
     *    ٤١٢×٩١٥ و١٧٧ على اللوح — لا تقاربَ أصلًا.
     */
    for (const [w, h, layout] of [[412, 915, 'single'], [1280, 800, 'two'], [360, 800, 'single']]) {
      const f = await stageAt(w, h, { layout, rec: true });
      const rec = f.doc.querySelector('.sh-rec-btn').getBoundingClientRect();
      const hits = [...f.doc.querySelectorAll('.sh-toolrail button')]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => Math.max(rec.left, r.left) < Math.min(rec.right, r.right)
                    && Math.max(rec.top, r.top) < Math.min(rec.bottom, r.bottom));
      expect(`${w}:${hits.length}`).toBe(`${w}:0`);
      f.close();
    }
  });
});

/* ================================================================== *
 * و) الإشعارُ يُقرأ ولا يُلمَس — العطبُ ٧٧                              *
 * ================================================================== */
describe('WS-77 · ما يطفو للقراءة لا يملك اللمسة', () => {
  /*
   * ⚠️ **ما قِيس قبل تغيير سطرٍ واحد** (لمسٌ حقيقيٌّ على ٤١٢×٩١٥):
   *
   *   إنشاءُ جلسةٍ من نافذة «اختار الجمل» ينتهي بـ`toastOk('N جملة
   *   جاهزة')` ثم `navigate` إلى المسرح. والإشعارُ يقف أسفلَ الشاشة —
   *   حيث يقف شريطُ النقل — ٣٫٢ ثوانٍ. فقِيس مَن يستقبل لمسةَ مركز
   *   زرّ التشغيل في تلك اللحظة:
   *
   *       span ‹ div.toast ‹ div.toast-host      «٣ جملة جاهزة»
   *
   *   خمسٌ من خمس دورات. وبعد الإصلاح: `i.sh-ico-play` خمسٌ من خمس
   *   **والإشعارُ ما يزال معروضًا** — أي أنّ اللمسةَ تعبره لا أنّه غاب.
   *
   * ⚠️ **وليس العطبُ في مستمعي الظلّ.** عُدّت من المحرّك نفسِه
   *    (`getEventListeners`): ثلاثةُ مستمعي نقرٍ على `#app-main` قبل
   *    الإنشاء وثلاثةٌ بعده في كلّ دورة. فحبلُ `AbortController` سليم،
   *    ولو صدّقتُ العَرَضَ («يشتغل من تاني ضغطة») لأصلحتُ ما ليس مكسورًا.
   *
   * ⚠️ **والمحروسُ ملكيّةُ النقطة لا نصُّ قاعدةٍ في CSS.** يُبنى إشعارٌ
   *    حقيقيٌّ بأصنافه فوق زرّ التشغيل بالضبط، ثم يُسأل المتصفّح: مَن
   *    يملك هذه النقطة؟ — وهو نفسُ الفحص الذي يجريه عند اللمس.
   */

  /** يضع إشعارًا حقيقيًّا فوق مستطيلٍ بعينه، ويردّ عناصرَه. */
  const toastOver = (doc, rect, { action = false } = {}) => {
    const host = doc.createElement('div');
    host.className = 'toast-host';
    /* الموضعُ يُفرَض ليقع التراكبُ حتمًا — والتراكبُ نفسُه مقيسٌ في
       التطبيق (المسبار أعلاه)، والمحروسُ هنا ما يحدث **حين** يقع. */
    /*
     * ⚠️ **و`inset: auto` قبل كلّ شيء — وإلّا وُضع الإشعارُ في مكانٍ
     *    آخر.** `.toast-host` تكتب `inset-inline: 0` و`bottom`، فحين
     *    أضفتُ `left` و`width` صار الصندوقُ **مُفرَطَ التقييد**
     *    (left + width + right)، والمستندُ `rtl` — فيُهمل المتصفّحُ
     *    `left` لا `right`. فوقف الإشعارُ على حافّة الشاشة اليمنى ولم
     *    يغطِّ الزرَّ، وسقط الحارسُ على **موضعٍ** لا على ملكيّةِ نقطة.
     *    (وهو نفسُ درسِ لسان الإعدادات في WS-POLISH: المنطقيُّ يتبع
     *    الاتّجاه، والمواضعُ الثابتةُ تُكتَب صريحةً.)
     *
     * ⚠️ و`padding: 0` كذلك: الحاويةُ تحشو ١٦px جانبًا فتضيق الحبّةُ
     *    عن الزرّ.
     */
    host.style.cssText = 'position:fixed;inset:auto;padding:0;'
      + `left:${rect.left}px;top:${rect.top}px;`
      + `width:${rect.width}px;height:${rect.height}px;`;
    const node = doc.createElement('div');
    node.className = 'toast ok';
    node.style.cssText = 'width:100%;height:100%;margin:0;';
    const text = doc.createElement('span');
    text.textContent = '3 جملة جاهزة';
    node.append(text);
    let act = null;
    if (action) {
      act = doc.createElement('button');
      act.className = 'toast-action';
      act.textContent = 'تراجع';
      node.append(act);
    }
    host.append(node);
    doc.body.append(host);
    return { host, node, act };
  };

  it('٢٣ · إشعارٌ فوق شريط النقل لا يسرق لمسةَ زرّ التشغيل', async () => {
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    const play = f.doc.querySelector('.sh-play');
    const r = play.getBoundingClientRect();
    const { node } = toastOver(f.doc, r);
    await f.settle();

    /* أوّلًا: الإشعارُ **يغطّي مركزَ الزرّ** فعلًا — وإلّا كان الحارسُ
       فارغًا يمرّ على كلّ حال. والمركزُ هو ما يُفحَص عند اللمس. */
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    const tr = node.getBoundingClientRect();
    const covers = tr.left <= cx && tr.right >= cx && tr.top <= cy && tr.bottom >= cy;
    expect(`يغطّي=${covers}`).toBe('يغطّي=true');

    /* ثمّ: مَن يملك تلك النقطة؟ — والرسالةُ تسمّي السارقَ إن وُجد. */
    const hit = f.doc.elementFromPoint(cx, cy);
    const who = hit ? `${hit.tagName.toLowerCase()}.${(hit.className || '').toString().trim().split(/\s+/)[0] || '∅'}` : 'لا شيء';
    expect(`${Boolean(hit && (hit === play || play.contains(hit)))} (${who})`)
      .toBe(`true (${who})`);
    f.close();
  });

  it('٢٤ · وزرُّ «تراجع» وحدَه يستعيد اللمسةَ داخل الإشعار', async () => {
    /*
     * ⚠️ **وهذا نصفُ الحارس لا زينتُه.** «التراجع» هو السببُ الوحيدُ
     *    المشروعُ الذي جعل الإشعارَ يستقبل لمسًا أصلًا — ومُعالَجةٌ
     *    تُطفئ اللمسَ على الإشعار كلِّه تقتل التراجعَ عن حذفٍ وقع
     *    لتوّه. فالحارسان يمسكان الطرفين: الجسمُ يعبر، والزرُّ يمسك.
     */
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    const play = f.doc.querySelector('.sh-play');
    const { act } = toastOver(f.doc, play.getBoundingClientRect(), { action: true });
    await f.settle();
    const ar = act.getBoundingClientRect();
    expect(ar.width > 0 && ar.height > 0).toBe(true);
    const hit = f.doc.elementFromPoint(
      Math.round(ar.left + ar.width / 2), Math.round(ar.top + ar.height / 2)
    );
    expect(Boolean(hit && (hit === act || act.contains(hit)))).toBe(true);
    f.close();
  });

  it('٢٥ · وحاويةُ الإشعارات لا تملك لمسةً بحالٍ', async () => {
    /*
     * الحاويةُ تمتدّ بعرض الشاشة كلِّه وترتفع فوق كلّ شيء
     * (`--z-toast: 90`). فلو ملكت المؤشّرَ يومًا لَما احتجنا إشعارًا
     * أصلًا كي يموت ما تحتها — يكفي وجودُها.
     */
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    const { host } = toastOver(f.doc, f.doc.querySelector('.sh-play').getBoundingClientRect());
    await f.settle();
    expect(f.win.getComputedStyle(host).pointerEvents).toBe('none');
    f.close();
  });
});

/* ================================================================== *
 * ز) مقبضُ السكّة يملك لمستَه — WS-RAIL-HIT                            *
 * ================================================================== */
describe('WS-RAIL-HIT · المقبضُ يملك قرصَه', () => {
  /*
   * ⚠️ **ما قِيس قبل تغيير رقم** (٤١٢×٩١٥):
   *
   *     المقبض ٣٦٠..٤٠٤ × ٨١١..٨٥٥ · شريطُ النقل ٢٢..٣٩٠ × ٧٩٧..٨٦١
   *     التراكب ٣٠×٤٤px · ومركزُ المقبض يملكه `div.sh-transport`
   *     ومن ١٤٥ نقطةً داخل قرصه: **٤٠ له و١٠٥ للشريط**
   *     ولمسُه لا يفتح السكّةَ ولا يُغلقها (false → false → false)
   *
   *   وعلى اللوح ١٤٥/١٤٥ قبل وبعد — لا تراكبَ هناك أصلًا.
   *
   *   والسارقُ **فراغٌ**: صندوقُ الشريط يمتدّ بعرض المسرح وz-index له
   *   ١٢ وللسكّة ٩. فرُفعت السكّةُ إلى ١٣ — ولا شيءَ غيرَه.
   *
   * ⚠️ **والقرصُ لا المستطيل**: المقبضُ `border-radius: 999px`، فأربعُ
   *    زوايا مستطيله ليست منه ولا يقصدها إصبع. فيُقاس ما يرسمه فقط —
   *    وإلّا حرسنا زوايا لا وجودَ لها وقلنا «٢٤ من ٢٨» عن ملكيّةٍ تامّة.
   */
  /*
   * ⚠️ **والإطارُ لا يُنتج التراكبَ من تلقائه — فيُنتَج صراحةً.**
   *    سكّةُ التطبيق فيها أربعةُ أزرار، فمجموعتُها المتوسّطةُ تنزل حتّى
   *    يقع مقبضُها في نطاق شريط النقل. وسكّةُ الإطار أقصر، فيقف
   *    المقبضُ في منتصف العمود بعيدًا عن الشريط — وحارسٌ يقيس هناك
   *    **يمرّ وإن عاد العطب**. قِستُه بطفرةٍ: أعدتُ z-index إلى ٩
   *    فبقي الحارسُ أخضر. فأُنزل المقبضُ إلى قاع السكّة كما هو على
   *    الجهاز، **ويُشترَط وقوعُ التراكب** قبل قياس الملكيّة — فإن غاب
   *    التراكبُ سقط الحارسُ بدل أن يمرّ فارغًا.
   */
  const dropHandleToBottom = (f) => {
    const rail = f.doc.querySelector('.sh-toolrail');
    rail.style.justifyContent = 'flex-end';
    rail.style.paddingBottom = '0px';
  };

  const overlapsTransport = (f) => {
    const a = f.doc.querySelector('.sh-rail-toggle').getBoundingClientRect();
    const b = f.doc.querySelector('.sh-transport').getBoundingClientRect();
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return { ox: Math.round(ox), oy: Math.round(oy), yes: ox > 0 && oy > 0 };
  };

  const discOwnership = (f) => {
    const t = f.doc.querySelector('.sh-rail-toggle');
    const r = t.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    const rad = Math.min(r.width, r.height) / 2;
    let inside = 0; let mine = 0; const thieves = {};
    for (let dx = 1; dx < r.width; dx += 3) {
      for (let dy = 1; dy < r.height; dy += 3) {
        const x = Math.round(r.left + dx); const y = Math.round(r.top + dy);
        if (Math.hypot(x - cx, y - cy) > rad - 1.5) continue;
        inside += 1;
        const el = f.doc.elementFromPoint(x, y);
        if (el && (el === t || t.contains(el))) mine += 1;
        else {
          const k = el ? `${el.tagName.toLowerCase()}.${(el.className || '').toString().trim().split(/\s+/)[0]}` : '—';
          thieves[k] = (thieves[k] || 0) + 1;
        }
      }
    }
    const centre = f.doc.elementFromPoint(Math.round(cx), Math.round(cy));
    return {
      inside, mine, thieves,
      centreMine: Boolean(centre && (centre === t || t.contains(centre))),
      centre: centre ? `${centre.tagName.toLowerCase()}.${(centre.className || '').toString().trim().split(/\s+/)[0]}` : '—',
    };
  };

  it('٢٦ · كلُّ نقطةٍ يرسمها المقبضُ يملكها — على الهاتف', async () => {
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    dropHandleToBottom(f);
    await f.settle();
    const over = overlapsTransport(f);
    expect(`تراكبٌ=${over.yes} (${over.ox}×${over.oy})`).toBe(`تراكبٌ=true (${over.ox}×${over.oy})`);
    const d = discOwnership(f);
    /* الفحصُ يفحص نفسَه: قرصٌ بلا نقاطٍ يمرّ بلا أن يحرس. */
    expect(d.inside > 100).toBe(true);
    expect(`${d.mine}/${d.inside} ${JSON.stringify(d.thieves)}`)
      .toBe(`${d.inside}/${d.inside} {}`);
    expect(`مركزُه=${d.centre}`).toBe('مركزُه=button.sh-rail-toggle');
    f.close();
  });

  it('٢٧ · وعلى اللوح كذلك', async () => {
    const f = await stageAt(1280, 800, { layout: 'two', rec: true });
    dropHandleToBottom(f);
    await f.settle();
    const d = discOwnership(f);
    expect(d.inside > 100).toBe(true);
    expect(`${d.mine}/${d.inside} ${JSON.stringify(d.thieves)}`)
      .toBe(`${d.inside}/${d.inside} {}`);
    expect(`مركزُه=${d.centre}`).toBe('مركزُه=button.sh-rail-toggle');
    f.close();
  });

  it('٢٨ · ولا زرَّ من السكّة يتراكب مع ضابطٍ من المسرح', async () => {
    /*
     * ⚠️ **وهذا هو الشرطُ الذي أباح الرفعَ.** رفعُ السكّة فوق الشريط
     *    مقبولٌ **لأنّ** أزرارَها لا تلامس زرًّا من أزراره: تبدأ من
     *    ٣٥٨ (هاتفًا) و١٢٠٣ (لوحًا)، وأقصى ضابطٍ في المسرح ينتهي عند
     *    ٣٣٣ و١١٧٥. فإن زحف أحدُ الطرفين يومًا صار الرفعُ سرقةً
     *    جديدةً مكانَ القديمة — ويسقط هذا الحارسُ قبل أن تُلمَس شاشة.
     */
    /*
     * ⚠️ **وأُزيلت هنا طفرةٌ كانت تدّعي محاكاةَ الجهاز** (WS-VPOLISH).
     *    كان الحارسُ يدفع السكّةَ إلى `flex-end` بحشوةٍ صفرٍ ويقول في
     *    تعليقه «والمقبضُ في قاعه كما على الجهاز». وقد كان ذلك صدقًا
     *    يومَ كُتب. ومنذ صار عنقودُ السكون يتوسّط الحافّة لم يعد كذلك:
     *    صارت الطفرةُ **تصنع** حالةً لا وجودَ لها، ثمّ تُبلِغ عن تراكمٍ
     *    فيها. فحُذفت، وصار القياسُ على الحالين اللذين يقعان فعلًا:
     *    أداتان في السكون واثنتا عشرةَ بكلمةٍ ممسوكة.
     */
    for (const [w, h, layout, tools] of [
      [412, 915, 'single', 2], [1280, 800, 'two', 2],
      [412, 915, 'single', 12], [1280, 800, 'two', 12]]) {
      const f = await stageAt(w, h, { layout, rec: true, tools });
      const box = (el) => el.getBoundingClientRect();
      const label = (el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().trim().split(/\s+/)[0] || '∅'}`;
      const railKids = [...f.doc.querySelectorAll('.sh-toolrail button')];
      const stageCtrls = [...f.doc.querySelectorAll('.sh-transport > *, .sh-modes button, .sh-cc-tab')];
      expect(railKids.length > 0 && stageCtrls.length > 0).toBe(true);
      const clashes = [];
      for (const k of railKids) {
        for (const c of stageCtrls) {
          const a = box(k); const bb = box(c);
          if (Math.min(a.right, bb.right) - Math.max(a.left, bb.left) > 0
            && Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top) > 0) {
            clashes.push(`${label(k)}×${label(c)}`);
          }
        }
      }
      expect(`${w}/${tools}:${clashes.join(',')}`).toBe(`${w}/${tools}:`);
      f.close();
    }
  });

  it('٢٩ · والسكّةُ نفسُها لا تلتقط شيئًا — أزرارُها وحدَها', async () => {
    /*
     * الرفعُ آمنٌ ما دامت الحاويةُ لا تستقبل مؤشّرًا: عمودٌ بعرض ٤٨px
     * وبطول المسرح لو التقط لأكل حافّةَ القراءة كلَّها.
     */
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    expect(f.cs('.sh-toolrail').pointerEvents).toBe('none');
    const toggle = f.win.getComputedStyle(f.doc.querySelector('.sh-rail-toggle'));
    expect(toggle.pointerEvents).toBe('auto');
    f.close();
  });
});

/* ================================================================== *
 * ح) جِلدُ الكون: مظهرٌ بلا منطق — WS-COSMIC-UI                       *
 * ================================================================== */
describe('WS-COSMIC-UI · الجِلدُ لا يحمل حالةً', () => {
  /*
   * ⚠️ **المحروسُ هنا حدُّ التمريرة نفسُه**: حزمةُ التصميم نموذجٌ فيه
   *    حالتُه المحلّيّة (playing · active · liked · saved · repeat ·
   *    mode · pos) ومُعالِجاتُه الوهميّة. ونقلُ سطرٍ واحدٍ منها إلى
   *    الإنتاج يعني حالةً ثانيةً للتشغيل أو للوضع — وهو بالضبط ما
   *    منعته التمريراتُ الأربعُ قبل هذه.
   */
  it('٣٠ · لا وسمَ نموذجٍ ولا حالتَه في شيفرة الشاشة', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const css = await (await fetch('../css/shadow.css')).text();
    /* وسومُ محرّك العرض في الحزمة — لا مكانَ لها في تطبيقٍ بلا بناء. */
    for (const token of ['sc-if', 'x-dc', 'DCLogic', 'hint-placeholder-val', 'data-dc-']) {
      expect(`${token}:${src.includes(token) || css.includes(token)}`).toBe(`${token}:false`);
    }
    /* وجملةُ النموذج المطبوعة لا تُكتَب في مصدرٍ ولا في نمط. */
    expect(src.includes('Во время проверки')).toBe(false);
    expect(css.includes('Во время проверки')).toBe(false);
  });

  it('٣١ · وطبقاتُ الزينة لا تلتقط لمسةً واحدة', async () => {
    /*
     * ⚠️ **وهذا أكثرُ ما كسر هذه الشاشةَ مرّتين**: طبقةٌ لا تُرى تسرق
     *    أوّلَ لمسة (الإشعارُ في WS-77 · وصندوقُ النقل الفارغُ في
     *    WS-RAIL-HIT). فالجِلدُ يُضيف صورةً وتدرّجاتٍ — ويجب أن تبقى
     *    كلُّها **شفّافةً للمؤشّر**، وإلّا صار الجمالُ عطبًا.
     */
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    for (const sel of ['.sh-plate', '.sh-stars-far', '.sh-stars-near', '.sh-sky-dim']) {
      expect(`${sel}:${f.cs(sel).pointerEvents}`).toBe(`${sel}:none`);
    }
    /* والأهمُّ سلوكًا: نقطةُ الجملة ونقطةُ التشغيل لمن يملكهما. */
    const owns = (sel) => {
      const el = f.doc.querySelector(sel);
      const r = el.getBoundingClientRect();
      const hit = f.doc.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return Boolean(hit && (hit === el || el.contains(hit)));
    };
    expect(`تشغيل:${owns('.sh-play')}`).toBe('تشغيل:true');
    f.close();
  });

  it('٣٢ · وأصولُ الجِلد موجودةٌ تُقرأ', async () => {
    /*
     * ⚠️ مسارٌ مكسورٌ في CSS لا يُسقِط شيئًا: الصورةُ لا تظهر والشاشةُ
     *    تبقى «تعمل». فيُسأل الخادمُ عن كلّ أصلٍ يذكره النمط.
     */
    const css = await (await fetch('../css/shadow.css')).text();
    const used = [...css.matchAll(/url\('\.\.\/(assets\/shadow\/[^']+)'\)/g)].map((m) => m[1]);
    expect(used.length >= 5).toBe(true);
    for (const path of [...new Set(used)]) {
      const res = await fetch(`../${path}`);
      expect(`${path}:${res.ok}`).toBe(`${path}:true`);
    }
  });

  it('٣٣ · واللوحةُ خفيفةٌ — لا تعود إلى ميغابايتين', async () => {
    /*
     * ⚠️ **الأصلُ القديم ٢٫٠MB PNG وهو أثقلُ ملفٍّ في التطبيق.** صار
     *    ١٠١KB WebP بنفس المقاس المفيد. والحارسُ يقيس **الحجمَ
     *    المنقول** لا اسمَ الملفّ: أيُّ عودةٍ إلى صورةٍ ثقيلةٍ تسقط هنا،
     *    مهما كان اسمُها أو امتدادُها.
     */
    const css = await (await fetch('../css/shadow.css')).text();
    const plate = /\.sh-plate\s*\{[^}]*url\('\.\.\/(assets\/shadow\/[^']+)'\)/.exec(css);
    expect(Boolean(plate)).toBe(true);
    const blob = await (await fetch(`../${plate[1]}`)).blob();
    const kb = Math.round(blob.size / 1024);
    expect(`${plate[1]} ${kb <= 400}`).toBe(`${plate[1]} true`);
  });
});

/* ================================================================== *
 * ز) WS-VPOLISH — الصقلُ البصريّ: هدوءُ الأعلى وحضورُ الجملة            *
 *                                                                    *
 * ⚠️ وكلُّها تقيس **هندسةً مرسومة** لا نصَّ قاعدةٍ ولا رقمًا مجمَّدًا:     *
 *    نِسَبًا من المسرح نفسِه، فتبقى صادقةً على كلّ مقاس.                 *
 * ================================================================== */
describe('WS-VPOLISH · أعلى أهدأ وجملةٌ أعلى', () => {
  it('٣٤ · الجملةُ تبدأ في الخُمس الأعلى من المسرح لا في رُبعه', async () => {
    /*
     * ⚠️ **قِيس قبلُ**: ٢١٠٫٦px فوق الجملة من أعلى المسرح على ٤١٢×٩١٥ —
     *    أي ٢٥٫٥٪ من ارتفاعه. والسببُ ليس الرأسَ وحدَه: البطلُ هو
     *    الناميَ الوحيد في المسرح فيرث كلَّ فائضٍ ويقسمه حولَ الجملة،
     *    فكان ٨٨px هواءً فوقها و٨٨ تحتها.
     *
     * ⚠️ **ويُقاس نسبةً لا بكسلًا** لأنّ البكسل يتغيّر بطول الجملة وبحجم
     *    الخطّ المختار — والنسبةُ تقول المقصود: كم من المسرح يمضي قبل أن
     *    تبدأ الجملةُ التي جئتَ من أجلها.
     */
    const f = await stageAt(412, 915, { words: 8 });
    const st = f.doc.querySelector('.sh-page.sh-right').getBoundingClientRect();
    const text = f.doc.querySelector('.sh-current-text').getBoundingClientRect();
    const share = Math.round(((text.top - st.top) / st.height) * 100);
    f.close();
    expect(`${share}٪ ≤ ٢٠٪`).toBe(`${share}٪ ${share <= 20 ? '≤' : '>'} ٢٠٪`);
  });

  it('٣٥ · وعلى اللوح كذلك', async () => {
    const f = await stageAt(1280, 800, { words: 8 });
    const st = f.doc.querySelector('.sh-page.sh-right').getBoundingClientRect();
    const text = f.doc.querySelector('.sh-current-text').getBoundingClientRect();
    const share = Math.round(((text.top - st.top) / st.height) * 100);
    f.close();
    expect(`${share}٪ ≤ ٢٢٪`).toBe(`${share}٪ ${share <= 22 ? '≤' : '>'} ٢٢٪`);
  });

  it('٣٦ · وصندوقُ البطل رقمٌ واحدٌ مهما طالت الجملة، وميلُه مقيَّد', async () => {
    /*
     * ⚠️ **حارسُ ٤ يحرس التماثل، وهذا يحرس أن يبقى محروسًا بعد الرفع.**
     *    كان يمكن أن تُرفَع الجملةُ بإمالة القسمة — وهو ما يُعيد عطبَ
     *    WS-SZ: الترجمةُ تتبع طولَ الجملة. فالرفعُ كان بإنقاص المقسوم
     *    لا بإمالته، وهذا يثبته على جملةٍ قصيرةٍ وأخرى طويلة.
     */
    const boxes = [];
    for (const words of [3, 14]) {
      const f = await stageAt(412, 915, { words });
      const hero = f.doc.querySelector('.sh-hero');
      const hr = hero.getBoundingClientRect();
      const kids = [...hero.children]
        .filter((c) => c.getBoundingClientRect().height > 0)
        .map((c) => {
          const r = c.getBoundingClientRect();
          const cs = f.win.getComputedStyle(c);
          return { top: r.top - parseFloat(cs.marginTop), bottom: r.bottom + parseFloat(cs.marginBottom) };
        });
      const top = Math.round(Math.min(...kids.map((k) => k.top)) - hr.top);
      const bottom = Math.round(hr.bottom - Math.max(...kids.map((k) => k.bottom)));
      f.close();
      boxes.push({ words, h: Math.round(hr.height), top, bottom });
    }
    /*
     * ⚠️ **والسقفُ يُقاس بأثره لا بوجود قاعدةٍ في ورقة**: صندوقُ البطل
     *    رقمٌ واحدٌ في الجملة القصيرة والطويلة معًا. وهذا هو الذي يحفظ
     *    ما تحته من أن يتبع طولَ الجملة — وهو ما سقط حين جرّبتُ
     *    `flex-grow: 0` فصار موضعُ الترجمة ٢٨٪ ثمّ ٤٩٪.
     */
    const [a, b] = boxes;
    expect(`ثبات الصندوق ${Math.abs(a.h - b.h) <= 2}`).toBe('ثبات الصندوق true');
    for (const one of boxes) {
      expect(`${one.words}: مائلٌ ${one.top <= one.bottom} ومتنفّسٌ ${one.top >= one.bottom * 0.4}`)
        .toBe(`${one.words}: مائلٌ true ومتنفّسٌ true`);
    }
  });

  it('٣٧ · أدواتُ الجملة تحاذي الجملةَ لا زاويةَ المسرح', async () => {
    /*
     * ⚠️ **قِيس قبلُ: +٨٩px** — كانت `space-between` بحشوةٍ يمينيّةٍ ٥٢px
     *    تُخلي مكانًا للسكّة، فتُدفَع الأزرارُ إلى الطرف.
     *
     * ⚠️ **والمحاذاةُ على الجملة لا على المسرح**: حشوةُ المسرح غيرُ
     *    متماثلةٍ فمركزُ المحتوى ليس مركزَ الإطار. والمقصودُ أن تبدوَ
     *    الأدواتُ أدواتِ الجملة — فالمرجعُ الجملةُ نفسُها.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const text = f.rect('.sh-current-text');
      const tools = f.rect('.sh-current-tools');
      const delta = Math.round(tools.cx - text.cx);
      f.close();
      expect(`${w}: انحراف ${Math.abs(delta) <= 8}`).toBe(`${w}: انحراف true`);
    }
  });

  it('٣٨ · السكّةُ في السكون عنقودٌ قصيرٌ لا عمودٌ بطول المسرح', async () => {
    /*
     * ⚠️ **قِيس قبلُ**: أزرارُ السكّة تمتدّ من ٩٤ إلى ٨٥٥ على ٤١٢×٩١٥ —
     *    ٧٦١px أي ٩٢٪ من المسرح، لأداتين ومعاينةِ خطٍّ ومقبض.
     *
     * ⚠️ **ويُقاس امتدادُ ما يُرسَم لا ارتفاعُ الحاوية**: الحاويةُ شفّافةٌ
     *    بطول المسرح دائمًا (inset-block: 0) — فقياسُها يقيس صندوقًا لا
     *    يراه أحد. المرئيُّ هو أوّلُ زرٍّ إلى آخرِ زرّ.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const st = f.doc.querySelector('.sh-page.sh-right').getBoundingClientRect();
      const btns = [...f.doc.querySelectorAll('.sh-toolrail button')]
        .map((b) => b.getBoundingClientRect());
      const span = Math.max(...btns.map((r) => r.bottom)) - Math.min(...btns.map((r) => r.top));
      const share = Math.round((span / st.height) * 100);
      f.close();
      expect(`${w}: ${share}٪ ≤ ٣٥٪`).toBe(`${w}: ${share}٪ ${share <= 35 ? '≤' : '>'} ٣٥٪`);
    }
  });

  it('٣٩ · وبكلمةٍ ممسوكة تعود السكّةُ عمودًا داخلَ المسرح', async () => {
    /*
     * ⚠️ **الرصُّ للسكون وحدَه.** عمودُ الاثنتي عشرةَ أداةً لا يسعه
     *    الرصُّ: قِيس أنّه يخرج من أعلى المسرح على اللوح (بدايتُه ١٨
     *    والمسرحُ يبدأ ٦٠) إن بقي مرصوصًا فوق شريط النقل. فالحارسُ
     *    يشترط أمرين معًا: أن يعود عمودًا طويلًا، وأن يبقى **داخل**
     *    المسرح — وهو ما سقط حين رُصّ بلا شرط.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h, { tools: 12 });
      const st = f.doc.querySelector('.sh-page.sh-right').getBoundingClientRect();
      const btns = [...f.doc.querySelectorAll('.sh-toolrail button')]
        .map((b) => b.getBoundingClientRect());
      const top = Math.min(...btns.map((r) => r.top));
      const bottom = Math.max(...btns.map((r) => r.bottom));
      const share = Math.round(((bottom - top) / st.height) * 100);
      const inside = top >= st.top - 1 && bottom <= st.bottom + 1;
      f.close();
      expect(`${w}: طويلٌ ${share >= 50} وداخلٌ ${inside}`).toBe(`${w}: طويلٌ true وداخلٌ true`);
    }
  });

  it('٤٠ · والميكروفونُ بعيدٌ عن المقبض في الحالين', async () => {
    /*
     * ⚠️ **إزاحةُ الميكروفون اليسرى ليست زينة**: كُتبت في
     *    WS-FONT-TRANSPORT لتُبعده عن المقبض بعد أن لامسه بخمسة بكسلات.
     *    فلمّا رُفع المقبضُ عن نطاق النقل رُفعت معه — **بنفس الشرط**.
     *    وبغير هذا الشرط قِيس تراكبٌ أفقيٌّ −٥px ورأسيٌّ ٣٧ بكلمةٍ
     *    ممسوكة: العطبُ نفسُه عائدًا.
     *
     * ⚠️ **والخلوصُ يكفي في أحد المحورين**: الزرّان قد يتجاوران أفقيًّا
     *    ما داما في نطاقين رأسيّين مفترقين — وهو حالُ السكون بعد الرفع.
     */
    for (const tools of [2, 12]) {
      const f = await stageAt(412, 915, { rec: true, tools });
      const mic = f.doc.querySelector('.sh-rec-btn').getBoundingClientRect();
      const handle = f.doc.querySelector('.sh-rail-toggle').getBoundingClientRect();
      const dx = Math.max(mic.left, handle.left) < Math.min(mic.right, handle.right);
      const dy = Math.max(mic.top, handle.top) < Math.min(mic.bottom, handle.bottom);
      f.close();
      expect(`أدوات ${tools}: تراكب ${dx && dy}`).toBe(`أدوات ${tools}: تراكب false`);
    }
  });
});

/* ================================================================== *
 * ح) WS-HEROSCROLL — الجملةُ الطويلةُ تُمرَّر، والنبرُ لا يفارق حرفَه     *
 * ================================================================== */
describe('WS-HEROSCROLL · تمريرُ الجملة ووحدةُ الطباعة', () => {
  it('٤١ · الجملةُ القصيرةُ لا تُمرَّر بلا داعٍ', async () => {
    /*
     * ⚠️ المطلوبُ تمريرٌ **عند الحاجة فقط**: جملةٌ تسعُ نطاقَها تبقى
     *    ثابتةً، فلا شريطَ ولا مطّاطيّةَ ولا إصبعٌ يجرّ ما لا يتحرّك.
     */
    const f = await stageAt(412, 915, { words: 6, sentence: 'Да, коне́чно.' });
    const t = f.doc.querySelector('.sh-current-text');
    const over = t.scrollHeight > t.clientHeight + 1;
    f.close();
    expect(`تفيض؟ ${over}`).toBe('تفيض؟ false');
  });

  it('٤٢ · والطويلةُ تفيض وتملك مُمرِّرَها وحدَها', async () => {
    /*
     * ⚠️ **والمُمرِّرُ للجملة لا للمسرح**: لو ورثه أبٌ لتحرّكت الترجمةُ
     *    والرقاقاتُ وشريطُ النقل معها — وهو المنهيُّ عنه صراحةً.
     */
    for (const [w, h] of [[412, 915], [320, 720], [1280, 800]]) {
      const f = await stageAt(w, h, { sentence: SENT_LONG });
      const t = f.doc.querySelector('.sh-current-text');
      const cs = f.win.getComputedStyle(t);
      const over = t.scrollHeight > t.clientHeight + 1;
      const owns = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      /*
       * ⚠️ **ولا يُشترَط أن يكون كلُّ أبٍ غيرَ قابلٍ للتمرير** — جرّبتُه
       *    فسقط الحارسُ على `div.sh-page`: المسرحُ نفسُه يفيض رأسيًّا
       *    (٨٦١>٨٢٥ هاتفًا) وهو **سابقٌ** لهذه التمريرة ومُبلَّغٌ عنه.
       *
       *    والمطلوبُ ليس أن يعجز الأبُ عن التمرير، بل **ألّا تصل إليه
       *    السحبةُ أصلًا**: فالجملةُ أعمقُ مُمرِّرٍ تحت الإصبع، و
       *    `overscroll-behavior: contain` تمنع تسلسلَ التمرير إلى أبٍ
       *    حين تبلغ الجملةُ حدَّها. وهو المقيسُ حيًّا: بعد سحبةٍ حقيقيّة
       *    بقي كلُّ أبٍ عند scrollTop صفر، ولم تتحرّك الترجمةُ ولا
       *    الرقاقاتُ ولا شريطُ النقل بكسلًا.
       */
      const contain = cs.overscrollBehaviorY === 'contain' || cs.overscrollBehavior === 'contain';
      f.close();
      expect(`${w}: تفيض ${over} · تملكه ${owns} · تحتوي السلسلة ${contain}`)
        .toBe(`${w}: تفيض true · تملكه true · تحتوي السلسلة true`);
    }
  });

  it('٤٣ · وبياضُ الجملة يسافر مع النصّ لا مع صندوقه', async () => {
    /*
     * ⚠️ **العطبُ الذي بلّغتَ عنه، وسببُه حرفٌ واحد.**
     *
     *    بياضُ الجملة ليس لونًا بل تدرّجٌ مقصوصٌ على الحرف
     *    (`background-clip: text` مع `color: transparent`)، والنبرُ
     *    `span.sh-stress` بلونٍ حقيقيّ. والخلفيّةُ بالأصل
     *    `background-attachment: scroll` — أي مثبَّتةٌ على **صندوق
     *    العنصر** لا تتبع محتواه حين يُمرَّر. فإذا مُرِّرت الجملةُ ارتفع
     *    النبرُ مع النصّ وبقي البياضُ مكانَه: «النبر بينفصل عن كلمته».
     *
     *    ⚠️ **ولا يمسكه قياسُ المستطيلات**: قِيس بلمسٍ حقيقيٍّ فكان
     *       الأبيضُ −١١١px والذهبُ −١١١px — أي أنّ **التخطيطَ سليم**
     *       والعطبَ في **الطلاء** وحدَه. ولم يظهر إلّا في اللقطة.
     *       فالحارسُ يقيس الآليّةَ لأنّ الأثرَ لا يُقاس من الشيفرة:
     *       متى كان العنصرُ مُمرِّرًا وبياضُه خلفيّةٌ مقصوصةٌ على الحرف،
     *       وجب أن تكون خلفيّتُه `local`.
     */
    const f = await stageAt(412, 915, { sentence: SENT_LONG });
    const t = f.doc.querySelector('.sh-current-text');
    const cs = f.win.getComputedStyle(t);
    const clipped = (cs.webkitBackgroundClip || cs.backgroundClip) === 'text';
    const scroller = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
    const local = cs.backgroundAttachment === 'local';
    const marks = t.querySelectorAll('.sh-stress').length;
    f.close();
    expect(`مقصوص ${clipped} · مُمرِّر ${scroller} · نبرات ${marks > 3}`)
      .toBe('مقصوص true · مُمرِّر true · نبرات true');
    expect(`يسافر مع النصّ: ${!clipped || !scroller || local}`)
      .toBe('يسافر مع النصّ: true');
  });

  it('٤٤ · ولا يخصم أحدٌ المحورَ الأفقيَّ من فوق الجملة', async () => {
    /*
     * ⚠️ **`touch-action` يُتقاطَع صعودًا لا يُورَث** — الدرسُ المكتوب
     *    فوق الرقاقة في الورقة. فلو كتب أحدٌ `none` أو `pan-y` على
     *    الجملة أو على أبٍ من آبائها لمات قلبُ الصفحة لكلّ إصبعٍ يبدأ
     *    فوق الجملة، وهي تشغل وسطَ المسرح.
     */
    const f = await stageAt(412, 915, { sentence: SENT_LONG });
    let el = f.doc.querySelector('.sh-current-text');
    const blockers = [];
    while (el && el !== f.doc.documentElement) {
      const ta = f.win.getComputedStyle(el).touchAction;
      if (ta === 'none' || ta === 'pan-y' || ta === 'pan-y pinch-zoom') {
        blockers.push(`${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/)[0] || '∅'}=${ta}`);
      }
      el = el.parentElement;
    }
    f.close();
    expect(`خاصمون: ${blockers.join(',')}`).toBe('خاصمون: ');
  });
});

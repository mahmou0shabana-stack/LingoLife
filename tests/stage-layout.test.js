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
  + `потом${GOLD('у')} что руков${GOLD('о')}дство х${GOLD('о')}чет поним${GOLD('а')}ть, `
  /*
   * ⚠️ **وأُطيلت في WS-TOOLS-LAYOUT**: بعد استرداد حشوة السكّة وإسقاط
   *    رأسِ بطلٍ فارغ صار البطلُ يسع ما كان يفيض عليه — فقِيس على
   *    ١٢٨٠×٨٠٠ «تفيض false» وحارسُ التمرير يمرّ على جملةٍ لا تُمرَّر.
   *    وجملةٌ لا تفيض لا تحرس تمريرًا. فأُطيلت حتّى تفيض على المقاسين.
   */
  + `как${GOLD('и')}е и́менно измен${GOLD('е')}ния тр${GOLD('е')}буются в `
  + `техн${GOLD('и')}ческой документ${GOLD('а')}ции и в раб${GOLD('о')}чих `
  + `инстр${GOLD('у')}кциях для ка́ждого подраздел${GOLD('е')}ния.`;

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
  { words = 14, layout = '', rec = false, tools = 2, sentence = SENT, rail = false } = {}) {
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
    <div class="shadow-app${rail ? ' is-rail' : ''}" style="--sh-size:30px;--sh-len:.9">
      <!--
        ⚠️ **وشريطا الصفحة بسكّانهما الحقيقيّين** (WS-CCCS). كان الإطارُ
           يرسم رأسًا فيه علامةٌ واسمٌ فقط، وذيلًا فيه أرقامٌ فقط —
           **وليس فيهما مَن يصنع ارتفاعَهما أصلًا**: زرُّ «LIBRARY»
           (هدفُ لمسٍ ٤٤ في صندوقه) وعنوانُ الجلسة ذو السطرين. فحارسٌ
           يقيس هذا الإطارَ كان يحرس شريطًا لا وجودَ له في التطبيق.
      -->
      <div class="sh-topbar">
        <div class="sh-brand"><i class="sh-diamond"></i> LingoLife</div>
        <span class="sh-vrule"></span>
        <div class="sh-crumb"><b>الفحص والمستندات</b><span class="sh-mono">17 سبتمبر</span></div>
        <div class="sh-grow"></div>
        <div class="sh-streak"><i></i><b>3</b> DAY STREAK</div>
        <button class="sh-exit" data-sh="exit">LIBRARY</button>
      </div>
      <div class="sh-body"><div class="sh-book" ${layout ? `data-layout="${layout}"` : ''}><div class="sh-pages">
        <div class="sh-page sh-right">
          <!--
            ⚠️ **وعنقودُ الجملة في رأس المسرح كما في الراسم** (WS-TOOLS-LAYOUT ·
               بندا ٦ و٧): صعد من رأس البطل إلى هنا. وإطارٌ يضعه حيث كان
               يحرس ترتيبًا لم يعد قائمًا — وهو أسوأُ من ألّا يحرس.
          -->
          <div class="sh-stage-top">
            <div class="sh-mono sh-count"><b>2</b> / <span>04</span> SENTENCES
              <span class="sh-dim">جاهز</span></div>
            <span class="sh-reps sh-mono">3 / 20</span>
            <div class="sh-bar"></div>
            <button class="sh-current-lbl">الأصل</button>
            <span class="sh-current-tools">
              <button>🔖</button><button>⧉</button><button>♡</button></span>
          </div>
          <div class="sh-prog"><div class="sh-prog-head"><span class="sh-prog-sec">الجلسة</span>
            <span class="sh-prog-pos"><b>2</b> / 4</span></div>
            <div class="sh-prog-bar"><span class="sh-prog-fill"></span></div></div>
          <div class="sh-hero">
            <!-- ولم يبقَ في رأس البطل إلّا شريطُ المقطع — وهو مخفيٌّ إلّا داخله. -->
            <div class="sh-hero-top"><p class="sh-phrase-lbl" hidden></p></div>
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
          <!--
            ⚠️ **السكّةُ الطوليّةُ رُفعت** (WS-TOOLS-LAYOUT · بند ٤)، ومكانَها
               عنقودٌ عائمٌ على الحافّة السفليّة اليسرى فوق لسان الضبط،
               وصفُّ أدوات السياق داخل رأس اللوح.
          -->
          <div class="sh-edge">
            <button class="sh-edge-btn" data-sh="tool" data-v="learn"><span>✦</span
              ><i class="sh-edge-val">3/8</i></button>
            <button class="sh-qfont sh-edge-btn" data-sh="qfont"><span lang="ru">Аа</span></button>
          </div>
          <aside class="sh-panel">
            <div class="sh-panel-head"><span class="sh-mono">الأدوات</span>
              <button data-sh="rail-close">✕</button></div>
            <div class="sh-rail-tools">${railTools}</div>
            <div class="sh-panel-rule"></div>
            <div class="sh-panel-body"></div>
            <div class="sh-panel-foot sh-mono"></div>
          </aside>
        </div>
      </div></div></div>
      <div class="sh-bottom">
        <div class="sh-bottom-title"><b>جلسة ظلّ في المستندات التقنية</b>
          <span class="sh-mono sh-dim">نصّ</span></div>
        <div class="sh-grow"></div>
        <div class="sh-stats" data-stats>
          <div><b>30</b><span class="sh-mono">SENTENCES</span></div>
          <div><b>370</b><span class="sh-mono">WORDS</span></div>
          <div><b>57</b><span class="sh-mono">REPS</span></div></div>
        <button class="sh-overview" data-sh="panel">SESSION OVERVIEW</button>
      </div>
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
    /*
     * ⚠️ **وعددُ الكلمات رُفع ٢٣ ← ٨٠ في WS-VFP**: الرقاقةُ صغرت
     *    (٣٦ ← ٢٨ ارتفاعًا) فصار ثلاثٌ وعشرون تتّسع بلا فيض — وشرطُ
     *    هذا الحارس أن **يقع الفيضُ** ثمّ يُفحَص ألّا تهرب رقاقةٌ فوقه.
     *    فالمقياسُ هو هو، والضغطُ وحدَه زِيد ليبقى الشرطُ محقَّقًا.
     *
     * ⚠️ **ورفعتُه أوّلًا إلى ٤٠ فمرّ مركَّزًا ثلاثَ مرّاتٍ وسقط في
     *    الطاقم الكامل** — على `overflow > 0` نفسِه، أي أنّ الأربعين
     *    لم تفض هناك. ولم أعزل سببَ الفارق بين البيئتين (تحميلُ
     *    خطوطٍ؟ ترتيبُ تشغيل؟) ولا أدّعيه — المقيسُ أنّ العدد وقع على
     *    **حافّة** الفيض فصار الحكمُ رهنَ ما لم أقِسه. والثمانون تفيض
     *    بـ**٥٢٥px** مقيسةً، أي بعيدًا عن أيّ حافّة. وتأكيدُ
     *    `overflow > 0` تحته يبقى: حارسٌ لم يتحقّق شرطُه لا يحرس.
     */
    const g = await stageAt(412, 915, { words: 80 });
    const host = g.doc.querySelector('.sh-chips');
    const hb = host.getBoundingClientRect();
    const above = [...g.doc.querySelectorAll('.sh-chip')]
      .filter((c) => c.getBoundingClientRect().top < hb.top - 1).length;
    const overflow = host.scrollHeight - host.clientHeight;
    const first = g.doc.querySelector('.sh-chip');
    const fb = first ? Math.round(first.getBoundingClientRect().top - hb.top) : 0;
    const geo = `نطاق=${Math.round(hb.height)} محتوى=${host.scrollHeight}`
      + ` أوّلُ صفٍّ=${fb} رقائق=${g.doc.querySelectorAll('.sh-chip').length}`;
    g.close();
    /* ⚠️ والرسالتان تُفرَّقان: حارسٌ برسالةٍ واحدةٍ لشرطين لا يقول أيُّهما سقط. */
    expect(`فائضٌ ${overflow > 0} · ${geo}`).toBe(`فائضٌ true · ${geo}`);
    expect(`هاربون ${above} · ${geo}`).toBe(`هاربون 0 · ${geo}`);
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
  it('٥ · الكلمةُ المقسَّمةُ فوق متن الصفحة اليسرى', async () => {
    /*
     * بند ٧: كانت ١٣ — أصغرَ من متن الصفحة اليسرى. فرُفعت إلى ١٧.
     *
     * ⚠️ **والقاعُ نزل إلى ١٦ بطلبك** (WS-FINAL-VISUAL · بند ١): «reduce
     *    Russian text size slightly, approximately 5–8%». و١٦ من ١٧ هي
     *    ‎−٥٫٩٪ — داخلَ مداك.
     *
     * ⚠️ **ولا يُشطَب الحارسُ لأنّ رقمَه تبدّل.** ما كان يحرسه ليس الرقمَ
     *    بل **الترتيب**: ألّا تصير الكلمةُ المفردةُ أصغرَ من سطرٍ في
     *    الصفحة اليسرى (١٥٫٤) — وهو المكتوبُ في سببه يومَ رُفعت. فالقاعُ
     *    يصير ذلك المتنَ نفسَه، مقروءًا من الشاشة لا مكتوبًا رقمًا.
     *
     * ⚠️ **والسقفُ ١٨٫٨ لا ١٧** — وقد كتبتُ ١٧ أوّلًا فسقط الحارسُ على
     *    شاشةٍ سليمة. القاعدةُ العريضةُ `clamp` سقفُها ٢٠px منذ WS-BG،
     *    و٢٠ × ‎.94 = ١٨٫٨ بالضبط. فالمدى هو المدى القديمُ مضروبًا في
     *    نسبةِ الخفض — لا رقمان اختُرعا.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const chip = parseFloat(f.cs('.sh-chip-w').fontSize);
      f.close();
      expect(`${w}: ${chip} في المدى`)
        .toBe(`${w}: ${chip} ${chip >= 15.5 && chip <= 18.8 ? 'في' : 'خارج'} المدى`);
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
    /*
     * ⚠️ **وأُعيد توجيهُه في WS-VFP: يُقاس ما يُلمَس لا ما يُرى.**
     *    كان يقيس **ارتفاعَ الصندوق** (٣٠ للوضع و٣٦ للرقاقة) — وذلك
     *    صحيحٌ يومَ كان الصندوقُ هو هدفَ اللمس. واليومَ الهدفُ هالةٌ
     *    شفّافةٌ حولَه (عرفُ هذا الملفّ منذ WS44)، والصندوقُ صغر
     *    بطلبك. فحارسٌ يقيس الصندوقَ صار يحرس **الشكلَ** لا القرار،
     *    ويمنع تصغيرًا مطلوبًا وهو لا يحمي إصبعًا.
     */
    const f = await stageAt(412, 915);
    const reaches = (el, half) => {
      const r = el.getBoundingClientRect();
      const mid = Math.round(r.left + r.width / 2);
      const cy = r.top + r.height / 2;
      const owns = (y) => {
        const hit = f.doc.elementFromPoint(mid, Math.round(y));
        return Boolean(hit && (hit === el || el.contains(hit)));
      };
      return owns(cy) && owns(cy - half) && owns(cy + half);
    };
    expect(reaches(f.doc.querySelector('.sh-modes button'), 20)).toBe(true);
    /*
     * ⚠️ **واللسانُ بدل الرقاقات (WS-POLISH)**: الصفُّ حُذف، والبابُ
     *    صار مقبضًا على الحافّة — وحدُّ الإصبع يُحرَس عليه هو: ٤٤×٤٤
     *    كاملةً وإن كان حبرُه ١٣px.
     */
    expect(f.box('.sh-cc-tab').h >= 44).toBe(true);
    expect(f.box('.sh-cc-tab').w >= 44).toBe(true);
    /* والرقاقةُ كذلك: هالتُها تملأ فجوةَ الصفّ (٣٨px لمسًا). */
    expect(reaches(f.doc.querySelector('.sh-chip'), 16)).toBe(true);
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
    /*
     * بند ١٣: ساكنو الرأس يتّسعون لسطرٍ واحد.
     *
     * ⚠️ **وكان يقيس رقاقةَ «Aa» — وقد غادرت الرأسَ منذ WS-SCLEAN**
     *    (الخطُّ إعدادٌ يبقى فمكانُه مركزُ التدريب). فبقي الإطارُ وحدَه
     *    يرسمها، والحارسُ يحرس شبحًا لا تراه الشاشة. ولمّا صُحِّح
     *    الإطارُ في WS-TOOLS-LAYOUT سقط الحارسُ بـnull — وهو صدقُه
     *    الأوّل منذ زمن. فيُعاد إلى ساكني الرأس الحقيقيّين.
     */
    const f = await stageAt(412, 915);
    expect(f.cs('.sh-stage-top').flexDirection).toBe('row');
    const count = f.doc.querySelector('.sh-count').getBoundingClientRect();
    const tools = f.doc.querySelector('.sh-current-tools').getBoundingClientRect();
    expect(Math.abs(count.top - tools.top) < 40).toBe(true);
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

  it('١٥ · وضوابطُ الحافّة لا تقتطع من عرض القراءة', async () => {
    /*
     * ⚠️ **بند ١٥ — وقد صار أقوى بعد رفع السكّة** (WS-TOOLS-LAYOUT).
     *    كان يقيس أنّ السكّةَ مطلقةٌ فلا تحجز عمودًا في التدفّق. وهي
     *    مرفوعةٌ اليوم، **لكنّها كانت تحجز عرضًا بطريقٍ آخر**: حشوةُ
     *    المسرح اليمنى ٦٢px مقابل يسرى ٢٠. قِيس على ١٢٨٠×٨٠٠ عرضَ
     *    قراءةٍ ٤١٤٫٥ ← **٤٣٤٫٥**، وعلى ٤١٢×٩١٥ ‏٣٧٦ ← **٣٨٤**.
     *
     *    فالمحروسُ أمران: أنّ كلَّ ضابطٍ على الحافّة مطلقُ الموضع،
     *    وأنّ الحشوتين **متساويتان** — أي لا حصّةَ محجوزةً لغائب.
     */
    for (const [w, h, layout] of [[412, 915, 'single'], [1280, 800, 'two']]) {
      const f = await stageAt(w, h, { layout });
      expect(f.cs('.sh-edge').position).toBe('absolute');
      expect(f.cs('.sh-cc-tab').position).toBe('absolute');
      const cs = f.cs('.sh-page.sh-right');
      const l = Math.round(parseFloat(cs.paddingLeft));
      const r = Math.round(parseFloat(cs.paddingRight));
      f.close();
      expect(`${w}: يسار ${l} = يمين ${r}`).toBe(`${w}: يسار ${l} = يمين ${l}`);
    }
  });

  it('١٦ · وأصنافُ الإطار أصنافُ الراسم نفسِه', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    for (const cls of ['sh-stage-top', 'sh-count', 'sh-prog', 'sh-hero', 'sh-current-text',
      'sh-current-tr', 'sh-chips', 'sh-hint', 'sh-modes', 'sh-transport', 'sh-cc-tab',
      /* ⚠️ `sh-toolrail` خرجت من القائمة لأنّها خرجت من الراسم
            (WS-TOOLS-LAYOUT · بند ٤)، ومكانَها عنقودُ الحافّة. */
      'sh-edge', 'sh-panel', 'sh-play', 'sh-nav-btn']) {
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
      /* ⚠️ والسكّةُ صارت عنقودَ الحافّة — نفسُ الشرط على الساكن الجديد. */
      const rail = f.doc.querySelector('.sh-edge');
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
      const hits = [...f.doc.querySelectorAll('.sh-edge button')]
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
  /*
   * ══════════ ورثةُ المقبض (WS-TOOLS-LAYOUT · بند ٤) ══════════
   *
   * ⚠️ **المقبضُ زال — والدرسُ لم يزل.** كان حارسا ٢٦ و٢٧ يقيسان أنّ
   *    `.sh-rail-toggle` يملك كلَّ نقطةٍ يرسمها، لأنّ صندوقَ شريط النقل
   *    كان يبتلع ثلثيه (z-index ١٢ مقابل ٩). والمقبضُ غابَ اليومَ،
   *    و**عنقودُ الحافّة يقف في نفس الشريط السفليّ** فيرث الخطرَ حرفيًّا.
   *
   * ⚠️ **ولا يُشطَب حارسٌ لأنّ ساكنَه تبدّل.** لو شُطِب لعاد العطبُ مع
   *    أوّل ضابطٍ يُوضَع على الحافّة — وقد وقع مرّتين قبله (لسانُ
   *    الإعدادات في WS-POLISH، ثمّ المقبضُ في WS-RAIL-HIT).
   */
  const dropHandleToBottom = (f) => {
    /*
     * ⚠️ **والطفرةُ تُنزِل العنقودَ إلى نطاق الشريط صراحةً**: هو فوقه
     *    بـ٢px خلوصًا في الشاشة، والإطارُ قد يضعه أعلى قليلًا — وحارسٌ
     *    يقيس حيث لا تراكبَ يمرّ وإن عاد العطب (دَرْسُ الطفرة z-index ٩).
     */
    /*
     * ⚠️ **وتُزاح بالتحويل لا بإحداثيٍّ مطلق**: كتبتُ أوّلًا
     *    `top: <إحداثيّ الشاشة>` فوقع العنقودُ خارجَ المسرح (قِيس:
     *    مركزُه صار `div.sh-bottom`) — لأنّ حاويَه المرجعيَّ ليس الشاشةَ
     *    بل أقربَ سلفٍ موضَّع. والفارقُ النسبيُّ لا يحتاج معرفةَ الحاوي.
     */
    const edge = f.doc.querySelector('.sh-edge');
    const tr = f.doc.querySelector('.sh-transport').getBoundingClientRect();
    const box = edge.getBoundingClientRect();
    const dy = (tr.top + tr.height / 2) - (box.top + box.height / 2);
    edge.style.transform = `translateY(${Math.round(dy)}px)`;
  };

  const overlapsTransport = (f) => {
    const a = f.doc.querySelector('.sh-edge .sh-qfont').getBoundingClientRect();
    const b = f.doc.querySelector('.sh-transport').getBoundingClientRect();
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return { ox: Math.round(ox), oy: Math.round(oy), yes: ox > 0 && oy > 0 };
  };

  const discOwnership = (f) => {
    const t = f.doc.querySelector('.sh-edge .sh-qfont');
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
    /*
     * ⚠️ **والمركزُ يُنسَب بالاحتواء لا بالاسم**: المقبضُ القديمُ كان
     *    حرفًا عاريًا، ووارثُه يلفّ رمزَه في `span` — فـ`elementFromPoint`
     *    تعيد الابنَ، وهو الزرُّ نفسُه في كلّ ما يهمّ اللمس. ومقارنةُ
     *    الاسم كانت تحرس بنيةَ الزرّ الداخليّة لا ملكيّةَ اللمسة.
     */
    expect(`مركزُه لي=${d.centreMine} (${d.centre})`).toBe(`مركزُه لي=true (${d.centre})`);
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
    /*
     * ⚠️ **والمركزُ يُنسَب بالاحتواء لا بالاسم**: المقبضُ القديمُ كان
     *    حرفًا عاريًا، ووارثُه يلفّ رمزَه في `span` — فـ`elementFromPoint`
     *    تعيد الابنَ، وهو الزرُّ نفسُه في كلّ ما يهمّ اللمس. ومقارنةُ
     *    الاسم كانت تحرس بنيةَ الزرّ الداخليّة لا ملكيّةَ اللمسة.
     */
    expect(`مركزُه لي=${d.centreMine} (${d.centre})`).toBe(`مركزُه لي=true (${d.centre})`);
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
      const railKids = [...f.doc.querySelectorAll('.sh-edge button')];
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

  it('٢٩ · والحاويةُ العائمةُ لا تلتقط شيئًا — أزرارُها وحدَها', async () => {
    /*
     * الرفعُ آمنٌ ما دامت الحاويةُ لا تستقبل مؤشّرًا: صندوقٌ عائمٌ فوق
     * المسرح لو التقط لأكل ما تحته من الحافّة بلا أن يشتكيَ شيء.
     * والشرطُ انتقل من السكّة إلى وارثها بلا أن يلين (WS-TOOLS-LAYOUT).
     */
    const f = await stageAt(412, 915, { layout: 'single', rec: true });
    expect(f.cs('.sh-edge').pointerEvents).toBe('none');
    const btn = f.win.getComputedStyle(f.doc.querySelector('.sh-edge .sh-qfont'));
    expect(btn.pointerEvents).toBe('auto');
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

  it('٣٧ · أدواتُ الجملة في رأس المسرح الثابت لا في البطل المُمرَّر', async () => {
    /*
     * ⚠️ **قِيس قبلُ (WS-VPOLISH): +٨٩px** — كانت `space-between` بحشوةٍ
     *    يمينيّةٍ ٥٢px تُخلي مكانًا للسكّة، فتُدفَع الأزرارُ إلى الطرف.
     *    فوُسِّطت على الجملة، وكان ذلك صحيحًا **يومَ كانت في البطل**.
     *
     * ⚠️ **وقد صار البطلُ يُمرَّر** (WS-HEROSCROLL). فشرطُك السادس:
     *    «fixed compact top cluster tied to stage chrome, not hero
     *    scroll». والمحاذاةُ على مركز الجملة لم تعد هي المطلوب — بل
     *    **ألّا تكون داخلَ ما يُمرَّر أصلًا**. فالحارسُ يقيس النَّسَب:
     *    الأزرارُ في رأس المسرح، ورأسُ المسرح ليس في البطل.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const tools = f.doc.querySelector('.sh-current-tools');
      const inTop = Boolean(tools.closest('.sh-stage-top'));
      const inHero = Boolean(tools.closest('.sh-hero'));
      const lbl = f.doc.querySelector('.sh-current-lbl');
      const lblTop = Boolean(lbl.closest('.sh-stage-top'));
      f.close();
      expect(`${w}: رأسٌ ${inTop} بطلٌ ${inHero} شارةٌ ${lblTop}`)
        .toBe(`${w}: رأسٌ true بطلٌ false شارةٌ true`);
    }
  });

  it('٣٨ · ولا عمودَ أدواتٍ بطول المسرح — ولا في السكون ولا بكلمةٍ ممسوكة', async () => {
    /*
     * ⚠️ **قِيس قبلُ**: السكّةُ ٤٨×٨٢٥ على ٤١٢×٩١٥ و٥٨×٦٩٠ على اللوح —
     *    أي عمودٌ بطول المسرح كلِّه قائمٌ دائمًا. وهو نصُّ شكواك.
     *
     * ⚠️ **ويُقاس امتدادُ ما يُرسَم لا ارتفاعُ الحاوية** (درسُ WS-VPOLISH):
     *    الحاويةُ كانت شفّافةً بطول المسرح، فقياسُها يقيس صندوقًا لا
     *    يراه أحد. المرئيُّ هو أوّلُ زرٍّ إلى آخرِ زرّ.
     *
     * ⚠️ **والشرطُ على الحالين معًا**: الرصُّ في السكون وحدَه كان يمرّ
     *    على عمودِ الاثنتي عشرةَ أداةً — ولذلك صارت الأدواتُ في اللوح
     *    لا على الحافّة، فلا يوجد عددٌ يُعيد العمود.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      for (const tools of [2, 12]) {
        const f = await stageAt(w, h, { tools });
        const st = f.doc.querySelector('.sh-page.sh-right').getBoundingClientRect();
        const btns = [...f.doc.querySelectorAll('.sh-edge button, .sh-cc-tab')]
          .map((b) => b.getBoundingClientRect());
        const span = Math.max(...btns.map((r) => r.bottom)) - Math.min(...btns.map((r) => r.top));
        const share = Math.round((span / st.height) * 100);
        f.close();
        expect(`${w}/${tools}: ${share}٪ ≤ ٣٥٪`)
          .toBe(`${w}/${tools}: ${share}٪ ${share <= 35 ? '≤' : '>'} ٣٥٪`);
      }
    }
  });

  it('٣٩ · وأدواتُ الكلمة في رأس اللوح لا على حافّة المسرح', async () => {
    /*
     * ⚠️ **ولم تُحذَف أداةٌ — تغيّر أبوها** (WS-TOOLS-LAYOUT · بند ٥).
     *    اثنتا عشرةَ أداةً بكلمةٍ ممسوكة، وكلُّها ما تزال تُرسَم. والفرقُ
     *    أنّها صارت داخلَ اللوح الذي لا يُفتَح إلّا على كلمةٍ أو مقطع،
     *    **وخارجَ جسمه** لأنّ الجسمَ يُهدَم بـinnerHTML مع كلّ رسم.
     *
     * ⚠️ **وصفٌّ يلتفّ لا عمود**: العمودُ كان يخرج من أعلى المسرح على
     *    اللوح (بدايتُه ١٨ والمسرحُ يبدأ ٦٠) — فيُقاس أنّه صار أعرضَ
     *    من أن يكون عمودًا، وأنّه داخلَ اللوح لا على حافّة الشاشة.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h, { tools: 12 });
      const row = f.doc.querySelector('.sh-rail-tools');
      const inPanel = Boolean(row.closest('.sh-panel'));
      const inBody = Boolean(row.closest('.sh-panel-body'));
      const r = row.getBoundingClientRect();
      const btns = [...row.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
      const perRow = btns.filter((b) => Math.abs(b.top - btns[0].top) < 2).length;
      f.close();
      expect(`${w}: لوحٌ ${inPanel} جسمٌ ${inBody} صفٌّ ${perRow >= 4} أعرضُ ${r.width > r.height}`)
        .toBe(`${w}: لوحٌ true جسمٌ false صفٌّ true أعرضُ true`);
    }
  });

  it('٤٠ · والميكروفونُ انزاح يمينًا ولا يلامس عنقودَ الحافّة', async () => {
    /*
     * ⚠️ **إزاحتُه اليسرى ماتت بموت سببها** (WS-FONT-TRANSPORT): كانت
     *    `margin-left` سالبًا مشتقًّا من عرض السكّة ليُبعده عن مقبضها
     *    بعد أن لامسه بخمسة بكسلات. ولا سكّةَ ولا مقبض.
     *
     * ⚠️ **وبدلها دفعةٌ يمينًا كما طلبتَ** (بند ٩). قِيس على الجهاز:
     *    التشغيل → الميكروفون ٩٠ ← **١٠٤** على ٤١٢×٩١٥، و١٠٢ ← ١١٦
     *    على اللوح، و٨٢ ← ٩٦ على ٣٢٠×٧٢٠.
     *
     * ⚠️ **والعنقودُ في الجهة المقابلة** — فيُقاس الأمران معًا: إزاحةٌ
     *    موجبةٌ فعلًا، وصفرُ تراكبٍ مع أيّ زرٍّ على الحافّة في الحالين.
     */
    for (const tools of [2, 12]) {
      const f = await stageAt(412, 915, { rec: true, tools });
      const mic = f.doc.querySelector('.sh-rec-btn');
      const push = parseFloat(f.win.getComputedStyle(mic).marginLeft);
      const m = mic.getBoundingClientRect();
      const clash = [...f.doc.querySelectorAll('.sh-edge button, .sh-cc-tab')]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => Math.max(m.left, r.left) < Math.min(m.right, r.right)
                    && Math.max(m.top, r.top) < Math.min(m.bottom, r.bottom));
      f.close();
      expect(`أدوات ${tools}: يمينًا ${push > 0} تراكب ${clash.length}`)
        .toBe(`أدوات ${tools}: يمينًا true تراكب 0`);
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

/* ================================================================== *
 * ط) WS-TOOLS-LAYOUT — رفعُ السكّة الطوليّة وتجميعُ الأدوات            *
 * ================================================================== */
describe('WS-TOOLS-LAYOUT · لا عمودَ دائمًا، ولا فعلَ ضاع', () => {
  it('٤٥ · لا سكّةَ ولا مقبضَ ولا لافتةً رأسيّةً في الشاشة', async () => {
    /*
     * ⚠️ **شكواك بحرفها**: «أزله من هذا الشكل الحالي». وقِيس قبلُ على
     *    ٤١٢×٩١٥: السكّةُ ٤٨×٨٢٥ — أي ٩٢٪ من طول المسرح لأداتين في
     *    السكون. وعلى ١٢٨٠×٨٠٠: ٥٨×٦٩٠.
     *
     * ⚠️ **ويُقاس على الوسم وعلى الورقة معًا**: عنصرٌ يُحذَف وقواعدُه
     *    تبقى تُقرأ كأنّها تصف الشاشة — وهو ما أعمى خطَّ النصّ الكامل
     *    تمريرةً كاملة (WS-DRAFT-FONT). فلا يكفي أن يغيب من الشجرة.
     */
    const f = await stageAt(412, 915, { tools: 12 });
    const n = (sel) => f.doc.querySelectorAll(sel).length;
    expect(`${n('.sh-toolrail')}/${n('.sh-rail-toggle')}/${n('.sh-rail-ctx')}`).toBe('0/0/0');
    f.close();
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const css = await (await fetch('../css/shadow.css')).text();
    /* التعليقاتُ تُشطَب أوّلًا — القبرُ يذكر اسمَ صاحبه بحقّ. */
    const bare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const dead of ['sh-toolrail', 'sh-rail-toggle', 'sh-rail-ctx', '--sh-railw']) {
      expect(`${dead} حيٌّ في الشيفرة: ${bare(src).includes(dead)}`).toBe(`${dead} حيٌّ في الشيفرة: false`);
      expect(`${dead} حيٌّ في الورقة: ${bare(css).includes(dead)}`).toBe(`${dead} حيٌّ في الورقة: false`);
    }
  });

  it('٤٦ · وحصّةُ العرض المحجوزةُ لها استُرِدّت — الحشوتان متساويتان', async () => {
    /*
     * ⚠️ **شرطُك**: «No permanent stage width/padding reserved for it.»
     *    وقِيس قبلُ: ٤١٢×٩١٥ حشوة ٨/**١٦** وعرضُ قراءةٍ ٣٧٦،
     *    و١٢٨٠×٨٠٠ حشوة ٣٤/**٥٤** وعرضٌ ٤١٤٫٥.
     *    وبعدُ: ٨/٨ ← ٣٨٤، و٣٤/٣٤ ← ٤٣٤٫٥.
     *
     * ⚠️ **ومُنتقٍ أضيقُ يفوز صامتًا**: التجاوزُ العامُّ في آخر الورقة
     *    كان صحيحًا ولم يصل، لأنّ قاعدةَ النموذج المفرد أضيق. والفرقُ
     *    لا يظهر إلّا في القياس — لا في قراءة الورقة.
     */
    for (const [w, h, layout] of [[412, 915, 'single'], [320, 720, 'single'], [1280, 800, 'two']]) {
      const f = await stageAt(w, h, { layout });
      const cs = f.cs('.sh-page.sh-right');
      const l = Math.round(parseFloat(cs.paddingLeft));
      const r = Math.round(parseFloat(cs.paddingRight));
      f.close();
      expect(`${w}: ${l}/${r}`).toBe(`${w}: ${l}/${l}`);
    }
  });

  it('٤٧ · وزرُّ التشغيل يبقى في وسط المسرح بعد الاسترداد', async () => {
    /*
     * ⚠️ **وهذا ما كانت الحشوةُ غيرُ المتماثلة تشتريه**: شريطُ النقل
     *    يُزاح بفارق الحشوتين ليصير وسطُه وسطَ **المسرح** لا وسطَ صندوق
     *    المحتوى. فلمّا تساوت الحشوتان صار الفارقُ صفرًا — ولو بقي
     *    أحدُهما بلا الآخر لانزاح الزرُّ. رقمان لا يمكن أن يفترقا.
     */
    for (const [w, h, layout] of [[412, 915, 'single'], [320, 720, 'single'], [1280, 800, 'two']]) {
      const f = await stageAt(w, h, { layout, rec: true });
      const off = Math.abs(f.playOffset());
      f.close();
      expect(`${w}: انحراف ${off <= 1}`).toBe(`${w}: انحراف true`);
    }
  });

  it('٤٨ · وصفٌّ لا ساكنَ فيه لا يحجز ارتفاعًا فوق الجملة', async () => {
    /*
     * ⚠️ **قِيس بعد النقل مباشرةً فكان أسوأ**: فوق النصّ الروسيّ
     *    ١٢٧٫٦ ← **١٤١٫١** على ٤١٢×٩١٥. والسببان: رأسُ البطل بقي
     *    يحجز ٢٦+٤ لشريطِ مقطعٍ مخفيّ، ورأسُ المسرح التفَّ سطرًا ثانيًا.
     *    فعُولجا، وصار **١١٤٫٤** — أي أقلَّ من الأساس بـ١٣٫٢.
     *
     * ⚠️ **والشرطُ على ابنٍ غيرِ مخفيّ لا على صنفٍ ولا على حالة**: فمتى
     *    ظهر الشريطُ عاد الصفُّ بارتفاعه من تلقائه.
     */
    const f = await stageAt(412, 915);
    const top = f.doc.querySelector('.sh-hero-top');
    expect(f.win.getComputedStyle(top).display).toBe('none');
    const lbl = top.querySelector('.sh-phrase-lbl');
    lbl.hidden = false;
    lbl.textContent = 'при рабо́те';
    await f.settle();
    const back = f.win.getComputedStyle(top).display;
    f.close();
    expect(`يعود بساكنه: ${back !== 'none'}`).toBe('يعود بساكنه: true');
  });

  it('٤٩ · ورأسُ المسرح سطرٌ واحدٌ — العدُّ يتقلّص ولا يدفع', async () => {
    /*
     * ⚠️ **وجُرِّب سببٌ سببًا**: رفعُ `margin-inline-start: auto` عن حبّة
     *    التكرار لم يغيّر شيئًا (٥٨٫٧)، وقلبُ الترتيب لم يغيّر (٦٠).
     *    والذي غيّر: إخفاءُ كلمة الحال من العدّاد ← **٣٢**. فالفاعلُ
     *    **عرضُ العدّاد الطبيعيّ** لا الترتيبُ ولا الهوامش.
     *
     * ⚠️ **ولم يُخفَ شيء**: العدّادُ صار قابلًا للتقلّص فيقتسم السطرَ
     *    ولا يكسره — والحالُ ما تزال مكتوبةً كاملة.
     */
    for (const [w, h] of [[412, 915], [320, 720], [1280, 800]]) {
      const f = await stageAt(w, h);
      /*
       * ⚠️ **والصفوفُ تُحسَب بتقاطع المدى الرأسيّ لا بقسمةِ `top`.**
       *    قسمتُ أوّلًا على ستّة فقلتُ «صفّان» وهما صفٌّ واحد: الاصطفافُ
       *    على خطّ القاعدة يجعل عدّادًا بـ١١px وزرًّا بـ٢٦ يبدآن من
       *    ارتفاعين (٥٩ و٥٥) وهما على سطرٍ واحدٍ فعلًا. وهو الدرسُ
       *    المكتوبُ بحرفه في حارس الذيل (١١)، ووقعتُ فيه ثانيةً.
       */
      const kids = [...f.doc.querySelectorAll('.sh-stage-top > *')]
        .filter((e) => !e.classList.contains('sh-bar'))
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0)
        .sort((a, c) => a.top - c.top);
      const rows = [];
      for (const r of kids) {
        const last = rows[rows.length - 1];
        if (last && Math.min(last.bottom, r.bottom) - Math.max(last.top, r.top) > 0) {
          last.top = Math.min(last.top, r.top);
          last.bottom = Math.max(last.bottom, r.bottom);
        } else rows.push({ top: r.top, bottom: r.bottom });
      }
      const grow = f.cs('.sh-stage-top .sh-count').flexBasis;
      f.close();
      expect(`${w}: صفوف ${rows.length} · قاعُ العدّاد ${grow}`).toBe(`${w}: صفوف 1 · قاعُ العدّاد 0px`);
    }
  });

  it('٥٠ · وعنقودُ الحافّة فوق لسان الضبط لا بجانبه', async () => {
    /*
     * ⚠️ **شرطُك الرابع**: «compact bottom-left cluster above Settings».
     *    وبجانبه يصير صفًّا ثانيًا على الحافّة — وهو ما جاء البندُ
     *    السادسُ في WS-POLISH ليمنعه («لا سكّةَ ثانية»).
     *
     * ⚠️ **وموضعُه مشتقٌّ من اللسان لا مُختارٌ بالنظر**: لو تغيّر رقمُ
     *    اللسان غدًا تحرّك العنقودُ معه.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      /*
       * ⚠️ **و`f.rect` لا تحمل محورًا رأسيًّا** — تعيد `l/r/w/cx` وحدَها
       *    (كُتبت للتوسيط الأفقيّ). فقراءةُ `.bottom` منها تعطي
       *    `undefined`، و`undefined <= رقم` تساوي false دائمًا: حارسٌ
       *    يرسب على شاشةٍ سليمة. فيُقرأ المستطيلُ كاملًا من مصدره.
       */
      const e = f.doc.querySelector('.sh-edge').getBoundingClientRect();
      const g = f.doc.querySelector('.sh-cc-tab').getBoundingClientRect();
      const above = e.bottom <= g.top + 1;
      const sameCol = Math.abs((e.left + e.right) / 2 - (g.left + g.right) / 2) <= 6;
      f.close();
      expect(`${w}: فوقه ${above} وعمودٌ واحد ${sameCol}`).toBe(`${w}: فوقه true وعمودٌ واحد true`);
    }
  });

  it('٥١ · وأدواتُ السياق خارجَ جسم اللوح — فلا يهدمها إعادةُ بنائه', async () => {
    /*
     * ⚠️ **وهذا ليس ترتيبًا جماليًّا**: جسمُ اللوح يُكتَب بـinnerHTML مع
     *    كلّ رسم (راجع `renderRail`)، فلو كان الصفُّ داخلَه لهُدم وأُعيد
     *    بناؤه مع كلّ نقلةٍ ومع كلّ تبديلِ أداة — ولسقط معه موضعُ
     *    تمرير اللوح الذي أُصلح في الطور الأوّل.
     *
     * ⚠️ **والمحاكاةُ هي الفحص**: يُكتَب في الجسم كما يفعل الراسم، ثمّ
     *    يُسأل: أبقيَ الصفُّ؟
     */
    const f = await stageAt(412, 915, { tools: 12 });
    const before = f.doc.querySelectorAll('.sh-rail-tools button').length;
    f.doc.querySelector('.sh-panel-body').innerHTML = '<div>محتوًى جديد</div>';
    await f.settle();
    const after = f.doc.querySelectorAll('.sh-rail-tools button').length;
    f.close();
    expect(`${before} ← ${after}`).toBe(`${before} ← ${before}`);

    /*
     * ⚠️ **والفحصُ أعلاه وحدَه لا يحرس شيئًا — وقد أثبتَته طفرة.**
     *    نقلتُ الصفَّ في `shadow-view.js` إلى داخل جسم اللوح فبقي
     *    الحارسُ أخضرَ: لأنّه يقيس **إطارَ الاختبار** الذي أكتبه بيدي،
     *    لا الوسمَ الذي يُشحَن. فالإطارُ يُظهر **لماذا** يُهدَم، والمصدرُ
     *    يُسأل **أين هو فعلًا**.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const aside = src.slice(src.indexOf('<aside class="sh-panel"'),
      src.indexOf('</aside>', src.indexOf('<aside class="sh-panel"')));
    const row = aside.indexOf('data-rail-tools');
    const body = aside.indexOf('data-panel-body');
    expect(`الصفُّ موجودٌ في اللوح: ${row >= 0}`).toBe('الصفُّ موجودٌ في اللوح: true');
    expect(`قبل الجسم: ${row < body}`).toBe('قبل الجسم: true');
    /* ولا يقع داخل وسم الجسم نفسِه — الجسمُ يُغلَق قبل أن يبدأ الصفّ. */
    expect(/data-panel-body><\/div>/.test(aside.replace(/\s+/g, ''))).toBe(true);
  });

  it('٥٢ · وسجّلُ الغلط غادر سجلَّ الأدوات إلى مركز التدريب', async () => {
    /*
     * ⚠️ **شرطُك الثالث**. والسببُ أنّ سجلَّ الأدوات صار **سياقيًّا**:
     *    يُرسَم في رأس لوحٍ لا يُفتَح إلّا على كلمةٍ أو مقطع. وسجّلُ
     *    الغلط بلا شرط (لا when له) — فلو بقي لظهر فعلٌ عامٌّ في صفٍّ
     *    خاصٍّ بما في يدك.
     *
     * ⚠️ **ولا نسخةَ منطقٍ ثانية**: زرُّ الدرج يُصدِر نفسَ data-sh وdata-v،
     *    فيدخل `pickTool` ويصل إلى `openErrorCapture` بالحرف.
     *
     * ⚠️ **وقيمةُ `rail.tool` الابتدائيّةُ تبعته**: مُنتقٍ يشير إلى غائبٍ
     *    هو الموتُ الصامتُ نفسُه — وقد وقع مرّتين باسمين (display ثمّ mistake).
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const reg = src.slice(src.indexOf('const TOOLS = ['), src.indexOf('\n];', src.indexOf('const TOOLS = [')));
    expect(`في السجلّ: ${/\bid:\s*'mistake'/.test(reg)}`).toBe('في السجلّ: false');
    expect(src).toContain('data-sh="tool" data-v="mistake"');
    expect(`الافتراضُ غائب: ${/tool:\s*'mistake'/.test(src)}`).toBe('الافتراضُ غائب: false');
    /* وفعلُه ما يزال موصولًا بمعالِجه الوحيد. */
    expect(/id === 'mistake'[\s\S]{0,200}openErrorCapture\(\)/.test(src)).toBe(true);
  });

  it('٥٣ · ولا مُنتقٍ ميّتٌ في حارس الإغلاق بلمسةٍ خارج اللوح', async () => {
    /*
     * ⚠️ **والمُنتقي الميّتُ في حارسٍ أسوأُ من الميّت في نمط**: لا يُخطئ
     *    بصوتٍ عالٍ، بل يُغلِق اللوحَ تحت إصبعك حين تلمس «تعلّم» أو
     *    «Аа» وهو مفتوح. فالسكّةُ في القائمة استُبدلت بوارثها.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    expect(src).toContain("!event.target.closest('.sh-edge')");
    expect(src).toContain("!event.target.closest('.sh-panel')");
    expect(src).toContain("!event.target.closest('.sh-cc-tab')");
  });
});

/* ================================================================== *
 * ي) WS-FINAL-VISUAL — زجاجُ الرقائق ومفتاحُ ثلاثةِ أوضاع              *
 * ================================================================== */
describe('WS-FINAL-VISUAL · صناديقُ زجاجٍ لا أزرارٌ زرقاء', () => {
  it('٥٤ · حشوةُ الرقاقة تشفّ، وحدُّها يظهر — والرقمان معًا', async () => {
    /*
     * ⚠️ **شكواك**: «solid blue buttons» بدل «transparent glass boxes».
     *    وقِيس قبلُ على ٤١٢×٩١٥: حشوةُ الصندوق ‎.42 ← .26، وحدُّه تدرّجٌ
     *    بأربع محطّاتٍ **يهبط إلى ‎.18 في وسطه** — أي أنّ نصفَ محيط
     *    الصندوق غيرُ مرسوم. فيبدو لطخةً زرقاءَ لا صندوقًا له حافّة.
     *
     * ⚠️ **والشرطان يُقاسان معًا لا فرادى**: لو حُرست الشفافيّةُ وحدَها
     *    لجاز أن يشفّ الحدُّ معها فيختفي الصندوق؛ ولو حُرس الحدُّ وحدَه
     *    لجازت حشوةٌ معتمة. فالمحروسُ: حشوةٌ **دون** ‎.22 وحدٌّ **فوق**
     *    ‎.40 في أخفتِ محطّاته.
     *
     * ⚠️ **والطبقتان تُفصَلان في القياس**: هما سلسلةٌ واحدةٌ في
     *    `background-image` (padding-box ثمّ border-box)، وقياسُ أكبرِ
     *    ألفا فيهما معًا يخلط ما يجب أن يشفّ بما يجب أن يظهر.
     */
    const alphas = (part) => [...String(part)
      .matchAll(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]));
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const bg = String(f.cs('.sh-chip').backgroundImage);
      const parts = bg.split('), linear-gradient');
      const fill = alphas(parts[0]);
      const edge = alphas(parts[1] || '');
      f.close();
      expect(`${w}: طبقتان ${parts.length === 2}`).toBe(`${w}: طبقتان true`);
      const fillMax = Math.max(...fill);
      const edgeMin = Math.min(...edge);
      expect(`${w}: حشوةٌ ${fillMax} تشفّ`)
        .toBe(`${w}: حشوةٌ ${fillMax} ${fillMax <= 0.22 ? 'تشفّ' : 'تُعتِم'}`);
      expect(`${w}: حدٌّ ${edgeMin} ظاهر`)
        .toBe(`${w}: حدٌّ ${edgeMin} ${edgeMin >= 0.40 ? 'ظاهر' : 'غائب'}`);
    }
  });

  it('٥٥ · ولا وهجَ خارجيًّا حول الرقاقة الساكنة', async () => {
    /*
     * ⚠️ **الوهجُ هو ما يجعل الصندوقَ يبدو مضيئًا من داخله** بدل أن
     *    يبدو زجاجًا يمرّ منه الضوء. كان ‎0 0 10px rgba(110,205,240,.10)
     *    خارجيًّا، ولمعةً داخليّةً ‎.20.
     *
     * ⚠️ **والداخليّةُ تبقى** — هي التي تقول «هذا سطحٌ لا فتحة». فالمحروسُ
     *    ألّا يعود ظلٌّ **خارجيّ** (بلا `inset`) على الساكنة.
     */
    const f = await stageAt(412, 915);
    const shadow = String(f.cs('.sh-chip').boxShadow);
    f.close();
    const outer = shadow.split(/,(?![^(]*\))/)
      .map((one) => one.trim())
      .filter((one) => one && one !== 'none' && !one.includes('inset'));
    expect(`ظلٌّ خارجيّ: ${outer.join(' | ') || 'لا شيء'}`).toBe('ظلٌّ خارجيّ: لا شيء');
  });

  it('٥٦ · والحاليّةُ تبقى متميّزةً — الشفافيّةُ لا تبتلع الحال', async () => {
    /*
     * ⚠️ **وهذا شرطُك الصريح**: «Preserve the active/speaking visual state».
     *    ولو خفّت معها لَضاع أهمُّ خبرٍ في النطاق: أيُّ كلمةٍ تُنطَق الآن.
     *    وقِيس: ألفا الحاليّة ‎.92 لم تتغيّر، والساكنةُ ‎.58 ← ‎.16 حشوةً.
     *
     * ⚠️ **و`getComputedStyle` كائنٌ حيٌّ لا لقطة** — تُنسَخ القيمةُ نصًّا
     *    قبل تبديل الصنف، وإلّا قُرئت قيمُ الحاليّة باسم الساكنة. (وقد
     *    وقع ذلك في أوّل مسبار: عاد ‎.92 للساكنة ووهجٌ ذهبيّ.)
     */
    const f = await stageAt(412, 915);
    const chip = f.doc.querySelector('.sh-chip');
    const rest = String(f.win.getComputedStyle(chip).backgroundImage);
    chip.classList.add('speaking');
    await f.settle();
    const live = String(f.win.getComputedStyle(chip).backgroundImage);
    const glow = String(f.win.getComputedStyle(chip).boxShadow);
    chip.classList.remove('speaking');
    f.close();
    const max = (s) => Math.max(...[...s.matchAll(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/g)]
      .map((m) => Number(m[1])), 0);
    const gap = +(max(live) - max(rest)).toFixed(2);
    expect(`الفارق ${gap} كافٍ`).toBe(`الفارق ${gap} ${gap >= 0.25 ? 'كافٍ' : 'ضائع'}`);
    expect(`وهجُ الحاليّة: ${max(glow) >= 0.3}`).toBe('وهجُ الحاليّة: true');
  });

  it('٥٧ · والعاجُ والذهبُ كما هما — الشفافيّةُ لا تمسّ الحبر', async () => {
    /*
     * ⚠️ شرطُك: «Preserve ivory Russian text and gold stress accents».
     *    وهما لونان مكتوبان في جِلد الكون (`#f4f0e6` و`#ffc44e`)، ولم
     *    تُمَسّ قاعدتاهما — والحارسُ يُثبّتهما كي لا يُجرَّا مع الشفافيّة
     *    في تمريرةٍ قادمة.
     */
    const f = await stageAt(412, 915);
    const word = f.cs('.sh-chip-w').color;
    const st = f.doc.createElement('span');
    st.className = 'sh-stress';
    f.doc.querySelector('.sh-chip-w').appendChild(st);
    await f.settle();
    const gold = f.win.getComputedStyle(st).color;
    f.close();
    expect(`عاج ${word} · ذهب ${gold}`)
      .toBe('عاج rgb(244, 240, 230) · ذهب rgb(255, 196, 78)');
  });

  it('٥٨ · وحشوةُ الرقاقة والتفافُها كما كانا', async () => {
    /*
     * ⚠️ شرطُك: «Keep comfortable padding and natural wrapping». فالحبرُ
     *    صغر والصندوقُ لم يُضغَط: الحشوةُ حرفًا بحرف، والرقائقُ تلتفّ
     *    صفوفًا ولا تُقصّ ولا تفيض أفقيًّا.
     */
    /*
     * ⚠️ **والحشوةُ صغرت بطلبك في WS-VFP** (6px 8px 5px ← 3px 6px 2px
     *    على الهاتف): فالرقمُ يُحدَّث، و**ما يحرسه الحارسُ لا يتغيّر** —
     *    صفّان فأكثر، ولا كلمةَ مقصوصة، ولا فيضَ أفقيّ.
     */
    for (const [w, h, pad] of [[412, 915, '3px 6px 2px'], [1280, 800, '3px 6px 2px']]) {
      const f = await stageAt(w, h, { words: 14 });
      const padding = f.cs('.sh-chip').padding;
      const rows = new Set([...f.doc.querySelectorAll('.sh-chip')]
        .map((c) => Math.round(c.getBoundingClientRect().top))).size;
      const cut = f.chips.cutWords;
      const over = f.overflowX;
      f.close();
      expect(`${w}: ${padding}`).toBe(`${w}: ${pad}`);
      expect(`${w}: صفوف ${rows > 1} · مقصوص ${cut} · فيض ${over}`)
        .toBe(`${w}: صفوف true · مقصوص 0 · فيض false`);
    }
  });

  it('٥٩ · مفتاحُ الأوضاع ثلاثةٌ لا أربعة — والرابعُ لا وجودَ له', async () => {
    /*
     * ⚠️ **طلبُك**: «Remove متصل from the visible selector. Keep exactly
     *    three visible modes: جملة | مقطع | كلمة».
     *
     * ⚠️ **ولا يكفي أن يُخفى بالتنسيق**: خيارٌ مخفيٌّ ما يزال في السجلّ
     *    يعود مع أوّل رسمٍ يقرأ السجلَّ بغير الورقة (والسجلُّ هو المصدر:
     *    `renderModes` تكتب من `MODES`). فيُقاس الوسمُ **والمصدر** معًا.
     */
    const f = await stageAt(412, 915);
    const labels = [...f.doc.querySelectorAll('.sh-modes button')].map((x) => x.textContent.trim());
    f.close();
    expect(labels.join('|')).toBe('جملة|مقطع|كلمة');
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const reg = src.slice(src.indexOf('const MODES = ['), src.indexOf('\n];', src.indexOf('const MODES = [')));
    const bare = reg.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(`في السجلّ: ${/id:\s*'continuous'/.test(bare)}`).toBe('في السجلّ: false');
  });

  it('٦٠ · والقيمةُ المهجورةُ تُطبَّع عند كلّ باب', async () => {
    /*
     * ⚠️ **وهذا هو الفرقُ بين حذفٍ آمنٍ وحذفٍ يكسر جلسةً محفوظة.**
     *    جلستُك القديمةُ تحمل `practiceMode: 'continuous'` في السجلّ.
     *    فلو رُفع الخيارُ وحدَه لبقيت الحالةُ تقول قيمةً لا مفتاحَ لها،
     *    و`renderModes` تُضيء «جملة» — شاشةٌ تقول غيرَ حالها.
     *
     * ⚠️ **وبابان لا باب**: البناءُ والتحديثُ معًا. ولو طُبِّع في البناء
     *    وحدَه لعادت القيمةُ من `updateSettings` بعد أن طُردت — وهو
     *    العطبُ الذي يُكرّره كلُّ تطبيعٍ يُكتَب في مكانٍ واحد.
     *
     * ⚠️ **ولا تُطوى `myRole`**: ليست على المفتاح لكنّها **مقروءةٌ في
     *    المحرّك** (`isMyTurn`) ويكتبها زرٌّ في شاشة المحادثة. فطيُّها
     *    كان سيكسر ميزةً تعمل.
     */
    const { normalizePracticeMode, PRACTICE_MODE, createPlaybackController } =
      await import('../js/services/shadow/playback-controller.js');
    expect(normalizePracticeMode('continuous')).toBe(PRACTICE_MODE.SENTENCE);
    expect(normalizePracticeMode('myRole')).toBe(PRACTICE_MODE.MY_ROLE);
    expect(normalizePracticeMode('word')).toBe(PRACTICE_MODE.WORD);
    expect(normalizePracticeMode(undefined)).toBe(PRACTICE_MODE.SENTENCE);

    const made = createPlaybackController({
      segments: [{ id: 'a', text: 'Тест.' }],
      speaker: async () => {}, canceler: () => {},
      settings: { practiceMode: 'continuous' },
    });
    expect(made.state.settings.practiceMode).toBe(PRACTICE_MODE.SENTENCE);
    made.updateSettings({ practiceMode: 'continuous' });
    expect(made.state.settings.practiceMode).toBe(PRACTICE_MODE.SENTENCE);
    made.destroy();
  });

  it('٦١ · وحبّةُ الأوضاع أصغرُ ومحدودةٌ وبينها فواصل', async () => {
    /*
     * ⚠️ **قِيس قبلُ على ٤١٢×٩١٥**: ٢٠٦٫٤×٤٠، حدٌّ ‎.13 (يكاد لا يُرى)،
     *    خلفيّةٌ ‎.05 (لا زجاجَ داكنًا)، وفجوةٌ ٢px بين الأزرار بلا فاصل.
     *    وبعدُ: ١٥٨٫٩×٣٨، حدٌّ ‎.30، خلفيّةٌ ‎.40، وفاصلٌ ١px بين كلّ اثنين.
     *
     * ⚠️ **والفاصلُ يُقاس بعددِ الخطوط لا بوجودها**: خطٌّ على كلّ زرٍّ
     *    **إلّا الأوّل** — فلو كُتب على الكلّ لظهر خطٌّ على حافّة الحبّة
     *    فوق حدّها، ولو كُتب على الأوّل وحدَه لم يفصل شيئًا.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const modes = f.cs('.sh-modes');
      const btns = [...f.doc.querySelectorAll('.sh-modes button')];
      const edges = btns.map((x) => parseFloat(f.win.getComputedStyle(x).borderInlineStartWidth));
      const alpha = (s) => Math.max(...[...String(s)
        .matchAll(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1])), 0);
      const border = alpha(modes.borderTopColor);
      const glass = alpha(modes.backgroundImage !== 'none' ? modes.backgroundImage : modes.backgroundColor);
      f.close();
      expect(`${w}: فواصل ${edges.join('/')}`).toBe(`${w}: فواصل 0/1/1`);
      expect(`${w}: حدٌّ ${border} واضح`)
        .toBe(`${w}: حدٌّ ${border} ${border >= 0.22 ? 'واضح' : 'باهت'}`);
      expect(`${w}: زجاجٌ داكنٌ ${glass}`)
        .toBe(`${w}: زجاجٌ داكنٌ ${glass >= 0.25 ? glass : 'باهت'}`);
    }
  });

  it('٦٢ · وهدفُ اللمس ٤٤px بهالةٍ لا بارتفاعٍ يُحجَز', async () => {
    /*
     * ⚠️ **ورفعُ الصندوق إلى ٤٤ كان يُعيد إلى الضوابط ما استُرِدّ للجملة**
     *    في الطور الثالث. فالعرفُ القائمُ في هذا الملفّ: حبرٌ صغيرٌ
     *    وهالةٌ شفّافةٌ تبلغ ٤٤ (كما في `.sh-current-tools`: ٢٦ حبرًا
     *    و٤٤ لمسًا، وكما في شارة الخطّ).
     *
     * ⚠️ **و`overflow: hidden` على الحبّة كان يقصّ الهالة** — كتبتُها
     *    أوّلًا لتقصّ زوايا الأزرار، وقِيس: المملوكُ المركزُ وحدَه
     *    والطرفان لا يملكهما أحد. فصارت الزوايا تُقَصّ حيث تُرسَم.
     *
     * ⚠️ **ولا تُوسَّع الهالةُ أفقيًّا**: الأزرارُ متلاصقةٌ، فتوسيعٌ
     *    جانبيٌّ يجعل هالةَ كلٍّ تعلو جارتَها فتسرق نصفَ لمساتها —
     *    والحارسُ يقيس ذلك أيضًا.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const btns = [...f.doc.querySelectorAll('.sh-modes button')];
      const reach = [];
      const theft = [];
      for (const btn of btns) {
        const r = btn.getBoundingClientRect();
        const mid = Math.round(r.left + r.width / 2);
        const cy = r.top + r.height / 2;
        const owns = (y) => {
          const el = f.doc.elementFromPoint(mid, Math.round(y));
          return Boolean(el && (el === btn || btn.contains(el)));
        };
        if (!owns(cy - 21) || !owns(cy) || !owns(cy + 21)) {
          reach.push(`${btn.textContent.trim()}:${Math.round(r.height)}`);
        }
        /*
         * ⚠️ **والسرقةُ تقع على الحافّة لا في المركز — وقد أثبتَته طفرة.**
         *    وسّعتُ الهالةَ ‎١٤px جانبيًّا فبقي الحارسُ أخضر: مركزُ كلّ
         *    زرٍّ ما يزال له، لأنّ التجاوزَ أقلُّ من نصف عرضه. والمسروقُ
         *    فعلًا شريطٌ داخلَ حافّة الجار. فتُفحَص نقطتان على بُعد
         *    ٣px من حافّتي الزرّ الداخليّتين — وهناك يُقاس العدوان.
         */
        for (const x of [Math.round(r.left + 3), Math.round(r.right - 3)]) {
          const edge = f.doc.elementFromPoint(x, Math.round(cy));
          const owner = edge && edge.closest('.sh-modes button');
          if (owner && owner !== btn) theft.push(`${btn.textContent.trim()}→${owner.textContent.trim()}`);
        }
      }
      f.close();
      expect(`${w}: قاصرون ${reach.join(',') || 'لا أحد'}`).toBe(`${w}: قاصرون لا أحد`);
      expect(`${w}: سارقون ${theft.join(',') || 'لا أحد'}`).toBe(`${w}: سارقون لا أحد`);
    }
  });
});

/* ================================================================== *
 * WS-DHS — اللوحُ مفتوحٌ على اللّوح: الضوابطُ تبقى تحت الإصبع          *
 * ================================================================== */
describe('WS-DHS · فتحُ لوح المسودّة لا يُخرِج الضوابطَ من المقصوص', () => {
  /*
   * ⚠️ **وحارسان كُتبا هنا ثمّ حُذفا — والسببُ يُقال لا يُخفى.**
   *
   * كتبتُ أوّلًا حارسَين يقيسان الوصولَ بالإصبع (`elementFromPoint`)
   * إلى التشغيل والتنقّل، وموضعَ شريط النقل داخلَ صندوق الكتاب. ثمّ
   * جُرِّبا بالطفرة: **نزعُ الإصلاح كلِّه لم يُسقِط أيًّا منهما**،
   * ولا مع أطولِ جملةٍ وستٍّ وعشرين رقاقة، ولا على ١٢٨٠×٥٦٠.
   *
   * والسبب: إطارُ القياس هنا هيكلٌ مبسَّط — لا شاشةُ تدريبٍ حقيقيّة.
   * فرأسُ المسرح وسطرُ التقدّم فيه لا يلتفّان كما يلتفّان في التطبيق
   * (٣٢ ← ٨٧ و٤٩ ← ٩٥ مقيسةً حيًّا)، فلا يفيض العمودُ ولا يُقصّ زرّ.
   *
   * **وحارسٌ لا يسقط عند نزع ما يحرسه لا يحرس شيئًا** — بل يمنح ثقةً
   * كاذبة. فحُذف، وبقي الحارسُ الذي يعضّ (أدناه)، والسلوكُ قِيس حيًّا
   * في التطبيق على المقاسات الثلاثة كما هو عرفُ هذه الشاشة منذ
   * WS-DRAFT-SYNC.
   */

  it('٦٣ · والبطلُ يتقلّص ولا يُجمَّد — تمريرُه الداخليُّ هو البديل', async () => {
    /*
     * ⚠️ **ولا `flex-grow: 0`**: ذاك حلُّ WS-HEROSCROLL المهجور. المرونةُ
     *    هي المقصود — والقاعُ النسبيُّ (٣٠٪ و٢٤٪) يُرفَع عند فتح اللوح
     *    وحدَه، فيمتصّ البطلُ والرقائقُ الفائضَ. ويبقى القاعُ كما هو في
     *    كلّ حالٍ أخرى، فتقسيمُ WS-SZ لم يُمَسّ.
     *
     * ⚠️ **والتمريرُ الداخليُّ شرطُ سلامة هذا الحلّ**: بلا `overflow`
     *    على البطل يعني التقلّصُ قصَّ الجملة. فيُقاس أنّه قائم، وأنّ
     *    تثبيتَ التدرّج `local` (WS-HEROSCROLL) لم يُمَسّ.
     */
    const open = await stageAt(1280, 800, { rail: true });
    const shut = await stageAt(1280, 800);
    const heroOf = (f) => f.doc.querySelector('.sh-hero');
    const minOf = (f) => f.win.getComputedStyle(heroOf(f)).minBlockSize;
    const chipsMin = (f) => f.win.getComputedStyle(f.doc.querySelector('.sh-chips')).minBlockSize;
    expect(`مفتوحًا ${parseFloat(minOf(open)) || 0}`).toBe('مفتوحًا 0');
    expect(`مفتوحًا رقائق ${parseFloat(chipsMin(open)) || 0}`).toBe('مفتوحًا رقائق 0');
    expect(`مغلقًا ${(parseFloat(minOf(shut)) || 0) > 0}`).toBe('مغلقًا true');
    expect(`مغلقًا رقائق ${(parseFloat(chipsMin(shut)) || 0) > 0}`).toBe('مغلقًا رقائق true');
    /* ومرونةُ البطل باقيةٌ — لا تجميد. */
    const flex = f => f.win.getComputedStyle(heroOf(f)).flexGrow;
    expect(`نموّ ${Number(flex(open)) > 0}`).toBe('نموّ true');
    /* وتثبيتُ التدرّج الذهبيّ مع النصّ لا مع صندوقه (WS-HEROSCROLL). */
    const text = open.doc.querySelector('.sh-current-text');
    expect(open.win.getComputedStyle(text).backgroundAttachment).toBe('local');

    /*
     * ⚠️ **والرفعُ للعريض وحدَه**: على الهاتف يطفو اللوحُ فوق المسرح
     *    ولا يحجز حشوةً، فلا فيضَ ولا سببَ لرفع القاع. ولو امتدّ
     *    الرفعُ إلى ٤١٢ لَانهار تقسيمُ WS-SZ حيث لا عطبَ أصلًا —
     *    وهو ما تُسقِطه طفرةُ «نقطةِ انعطافٍ خاطئة» من الجهة الأخرى.
     */
    const phone = await stageAt(412, 915, { rail: true });
    const phoneMin = parseFloat(phone.win.getComputedStyle(
      phone.doc.querySelector('.sh-hero')).minBlockSize) || 0;
    expect(`الهاتفُ يحتفظ بقاعه ${phoneMin > 0}`).toBe('الهاتفُ يحتفظ بقاعه true');
  });
});

/* ================================================================== *
 * WS-VFP — خمسُ لمساتٍ: الرقاقةُ · السهمان · الحبّةُ · الميكروفون · الخطّ *
 * ================================================================== */
describe('WS-VFP · أصغرُ وأشفُّ بلا أن يصغر حبرٌ', () => {
  it('٦٤ · الرقاقةُ أصغرُ وحبرُها ١٦px كما كان', async () => {
    /*
     * ⚠️ **وطلبُك كان مشروطًا**: «أصغرُ وأشفّ **بلا** تصغير النصّ».
     *    فيُقاس الاثنان معًا — وإلّا مرّ تصغيرٌ اشترى الحجمَ من الحبر.
     *    قِيس قبل: ٤٥٫٦×٣٦ وحشوة 6px 8px 5px · وبعد: ٤١٫٦×٢٨ وحشوة
     *    3px 6px 2px، والحبرُ ١٦px في الحالتين.
     */
    const f = await stageAt(412, 915);
    const chip = f.doc.querySelector('.sh-chip');
    const word = f.doc.querySelector('.sh-chip-w');
    const box = chip.getBoundingClientRect();
    expect(`حبرٌ ${f.win.getComputedStyle(word).fontSize}`).toBe('حبرٌ 16px');
    expect(`ارتفاعٌ ${box.height <= 32}`).toBe('ارتفاعٌ true');
    /* والحبرُ لا يتجاوز صندوقَه — لا قصَّ ولا فيض. */
    expect(`فيضٌ أفقيّ ${word.scrollWidth > word.clientWidth + 1}`).toBe('فيضٌ أفقيّ false');
    /* والحدُّ السماويُّ باقٍ هُويّةً، والحشوةُ أشفُّ ممّا كانت. */
    const sheet = await css();
    expect(/\.sh-right \.sh-chip:not\(\.speaking\)[\s\S]{0,400}?rgba\(150, 226, 244, \.52\)/.test(sheet)).toBe(true);
  });

  it('٦٥ · وهالةُ لمسها تملأ الفجوة ولا تسرق جارتَها', async () => {
    /*
     * ⚠️ **ومددتُها أوّلًا إلى ٤٤ فسقط القياس**: الصفوفُ متقاربةٌ،
     *    فهالةُ كلّ رقاقةٍ تعلو الصفَّ الذي فوقها فتسرق لمساتِه. وهو
     *    العدوانُ نفسُه المكتوب فوق حبّة الأوضاع، بمحورٍ آخر. فالفجوةُ
     *    وُسِّعت ١٠px والهالةُ تملؤها ولا تتجاوزها: ٣٨px لمسًا.
     */
    const f = await stageAt(412, 915);
    const chips = [...f.doc.querySelectorAll('.sh-chip')];
    const hostBox = f.doc.querySelector('.sh-chips').getBoundingClientRect();
    const miss = [];
    const theft = [];
    let checked = 0;
    for (const c of chips) {
      const r = c.getBoundingClientRect();
      const mid = Math.round(r.left + r.width / 2);
      const cy = r.top + r.height / 2;
      const hit = (y) => f.doc.elementFromPoint(mid, Math.round(y));
      const owns = (y) => {
        const el = hit(y);
        return Boolean(el && (el === c || c.contains(el)));
      };
      const who = (y) => {
        const el = hit(y);
        return el ? `${el.tagName}.${(el.className || '').toString().split(' ').join('.')}` : 'لا شيء';
      };
      /*
       * ⚠️ **وحافّةُ النطاق تقصّ الهالةَ — وهذا صحيحٌ لا عطب.** نطاقُ
       *    الرقائق يُمرَّر (`overflow-y: auto`)، فهالةُ أوّل صفٍّ وآخره
       *    تخرج عن نافذته فتُقصّ. فيُشترَط ٣٨px لمسًا على مَن تسع
       *    هالتُه داخل النافذة، ويُشترَط على الجميع أن يملكوا مركزَهم.
       */
      if (!owns(cy)) miss.push(`مركز:${Math.round(r.height)}`);
      else if (r.top - 5 >= hostBox.top && r.bottom + 5 <= hostBox.bottom) {
        checked += 1;
        if (!owns(cy - 16) || !owns(cy + 16)) {
          miss.push(`هالة:${Math.round(r.height)}@${Math.round(r.top)}`
            + `|فوق:${who(cy - 16)}|تحت:${who(cy + 16)}`);
        }
      }
      /* ولا تسرق جارتَها: نقطةٌ داخلَ حافّة الجارة الأفقيّة تبقى لها. */
      for (const other of chips) {
        if (other === c) continue;
        const o = other.getBoundingClientRect();
        if (Math.abs(o.top - r.top) > 2) continue;
        const x = o.left < r.left ? Math.round(o.right - 3) : Math.round(o.left + 3);
        const el = f.doc.elementFromPoint(x, Math.round(o.top + o.height / 2));
        if (el && c.contains(el)) theft.push('سرقة');
      }
    }
    expect(`قاصرون ${miss.join(',') || 'لا أحد'}`).toBe('قاصرون لا أحد');
    expect(`سارقون ${theft.length}`).toBe('سارقون 0');
    /* ⚠️ وحارسٌ لم يفحص أحدًا لا يحرس: يُشترَط أن يكون قد فحص هالةً واحدةً على الأقلّ. */
    expect(`فُحصت هالاتٌ ${checked > 0}`).toBe('فُحصت هالاتٌ true');
  });

  it('٦٦ · والسهمان يشيران إلى الخارج لا إلى بعضهما', async () => {
    /*
     * ⚠️ **والاسمُ لا يُصدَّق — البكسلاتُ تُقاس.** التعليقُ القائمُ كان
     *    يدّعي أنّ الملفَّين سُمّيا باتّجاههما، والقياسُ كذّبه:
     *
     *        nav-left.webp   يسارُه ٨٥ · يمينُه ١٦  ⇐ يشير يمينًا
     *        nav-right.webp  يسارُه ١٣ · يمينُه ٩٣  ⇐ يشير يسارًا
     *
     *    فالحارسُ يقرأ الصورةَ التي يحملها كلُّ زرٍّ فعلًا، ويحكم من
     *    امتداد حبرها — لا من اسم ملفّها.
     */
    const sheet = await css();
    const prev = sheet.match(/\.sh-nav-btn \.sh-ico-prev \{ background-image: url\('\.\.\/assets\/shadow\/(nav-[a-z]+)\.webp'\); \}/g) || [];
    const last = prev[prev.length - 1] || '';
    expect(`السابقُ يحمل ${/nav-right/.test(last)}`).toBe('السابقُ يحمل true');
    const next = sheet.match(/\.sh-nav-btn \.sh-ico-next \{ background-image: url\('\.\.\/assets\/shadow\/(nav-[a-z]+)\.webp'\); \}/g) || [];
    expect(`والتالي يحمل ${/nav-left/.test(next[next.length - 1] || '')}`).toBe('والتالي يحمل true');
  });

  it('٦٧ · وحبّةُ الأوضاع نصفُ حجمها وأهدأ — وثلاثةٌ تُقرأ وتُلمَس', async () => {
    /*
     * قِيس قبل: ١٥٨٫٩×٣٨ (٦٠٣٨px²) · وبعد: ١٢٢٫٩×٢٨ (٣٤٤١) — **−٤٣٪**،
     * وهو «نصفُها تقريبًا» الذي طلبتَه بلا أن يصغر حبرٌ (١٠٫٥px كما كان).
     * ⚠️ والصندوقان يشملان حدَّيهما: الزرُّ نفسُه ٢٦ والحبّةُ ٢٨ بحدّها.
     *
     * ⚠️ **والهدوءُ بأسلوبٍ لا بمؤقّت** (شرطُك): عتامةٌ ساكنةٌ ترتفع عند
     *    اللمس أو التركيز. ولا يُخفى، ولا يلتبس المختار.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const pill = f.doc.querySelector('.sh-modes');
      const box = pill.getBoundingClientRect();
      const cs = f.win.getComputedStyle(pill);
      expect(`${w}: أصغر ${box.width < 135 && box.height <= 28}`).toBe(`${w}: أصغر true`);
      expect(`${w}: أهدأ ${Number(cs.opacity) < 0.8 && Number(cs.opacity) > 0.4}`).toBe(`${w}: أهدأ true`);
      const btns = [...f.doc.querySelectorAll('.sh-modes button')];
      expect(`${w}: أوضاعٌ ${btns.length}`).toBe(`${w}: أوضاعٌ 3`);
      const clipped = btns.filter((b) => b.scrollWidth > b.clientWidth + 1).length;
      expect(`${w}: مقصوصون ${clipped}`).toBe(`${w}: مقصوصون 0`);
      /* وهالةُ اللمس القائمةُ (WS-FINAL-VISUAL) تبقى ٤٤ رأسيًّا. */
      const miss = btns.filter((b) => {
        const r = b.getBoundingClientRect();
        const mid = Math.round(r.left + r.width / 2);
        const owns = (y) => {
          const el = f.doc.elementFromPoint(mid, Math.round(y));
          return Boolean(el && (el === b || b.contains(el)));
        };
        const cy = r.top + r.height / 2;
        return !owns(cy) || !owns(cy - 20) || !owns(cy + 20);
      }).length;
      expect(`${w}: قاصرون ${miss}`).toBe(`${w}: قاصرون 0`);
    }
  });

  it('٦٨ · والميكروفونُ أصغرُ ويبقى داخلَ المسرح على الضيّقة', async () => {
    /*
     * ⚠️ **والدفعُ يمينًا قِيس فسقط على ٣٢٠**: صار يمينُه ٣٢٧ وحافّةُ
     *    المسرح ٣١٤. فالهامشُ يصغر حيث لا مكان — والصِّغَرُ وحدَه هو
     *    ما يناله هناك. وأقولها صراحةً في القاعدة نفسِها.
     */
    for (const [w, h] of [[320, 720], [412, 915], [1280, 800]]) {
      const f = await stageAt(w, h, { rec: true });
      const mic = f.doc.querySelector('.sh-rec-btn');
      const page = f.doc.querySelector('.sh-page.sh-right');
      const r = mic.getBoundingClientRect();
      const pg = page.getBoundingClientRect();
      expect(`${w}: حجمٌ ${Math.round(r.width)}`).toBe(`${w}: حجمٌ 34`);
      expect(`${w}: داخلَ المسرح ${r.right <= pg.right - 4}`).toBe(`${w}: داخلَ المسرح true`);
      /* ويُلمَس: مركزُه له. */
      const el = f.doc.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      expect(`${w}: يُلمَس ${Boolean(el && (el === mic || mic.contains(el)))}`).toBe(`${w}: يُلمَس true`);
    }
  });

  it('٦٩ · و«نصٌّ كامل» يتلقّى خطَّ القراءة المعتمَد', async () => {
    /*
     * ⚠️ **آخرُ مُنتقٍ ميّت في هذه العائلة.** `applyFonts` كانت تعدّ
     *    أربعةَ أسماء — البطل، وسطورَ النصّ، ولوحةَ الأصل، والرقائق —
     *    و«نصٌّ كامل» (`.sh-flow-s`) ليس أحدَها. قِيس حيًّا وخطُّ
     *    القراءة `philosopher`: البطلُ Philosopher والرقاقةُ
     *    Philosopher و«نصٌّ كامل» **Inter** — أي خطُّ التطبيق.
     *
     * ⚠️ **ويتبع `ctx.font` لا `ctx.fontDoc`**: زرُّ Aa الذي تضغطه
     *    يفتح المُنتقيَ على صفحة المسرح فيكتب `fontId`. فربطُه بالآخر
     *    كان سيترك البلاغَ قائمًا بحرفه.
     *
     * ⚠️ **ويُعاد بعد كلّ رسم**: `paintLines` تستبدل `innerHTML` كلَّه،
     *    والأنماطُ السطريّةُ تضيع معه — فكلُّ نقلةِ جملةٍ كانت ستمحوه.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const fonts = src.slice(src.indexOf('function applyFonts()'), src.indexOf('\n}', src.indexOf('function applyFonts()')));
    expect(`يشمل «نصّ كامل»: ${/querySelectorAll\('\.sh-flow-s'\)/.test(fonts)}`)
      .toBe('يشمل «نصّ كامل»: true');
    expect(`بخطّ القراءة: ${/\.sh-flow-s'\)\s*\n?\s*\.forEach\(\(node\) => applyFont\(node, ctx\.font\)\)/.test(fonts)}`)
      .toBe('بخطّ القراءة: true');
    const lines = src.slice(src.indexOf('function paintLines()'), src.indexOf('\n}', src.indexOf('function paintLines()')));
    expect(`ويُعاد بعد الرسم: ${/applyFonts\(\);/.test(lines)}`).toBe('ويُعاد بعد الرسم: true');
    /* وسطورُ «جمل» تبقى على خطّ الصفحة — تفاوتٌ معلَنٌ لا مُخفًى. */
    expect(`وسطورُ «جمل» على خطّ الصفحة: ${/data-line-text\]'\)\s*\n?\s*\.forEach\(\(node\) => applyFont\(node, ctx\.fontDoc\)\)/.test(fonts)}`)
      .toBe('وسطورُ «جمل» على خطّ الصفحة: true');
  });
});

/* ================================================================== *
 * WS-CCCS — شريطا الصفحة يتقلّصان ولا يفقدان ما يُقرأ ولا ما يُلمَس    *
 * ================================================================== */
describe('WS-CCCS · أعلى وأسفل: أصغرُ ومقروءٌ وملموس', () => {
  it('٧٠ · الشريطان يقتطعان من الشاشة أقلَّ ممّا كانا', async () => {
    /*
     * قِيس حيًّا قبل (لا في الإطار — في التطبيق نفسِه):
     *
     *     ١٢٨٠×٨٠٠   علويّ ٥٢ · سفليّ ٤٤ · ١٢٪ من الشاشة
     *     ٤١٢×٩١٥    علويّ ٤٤ · سفليّ ٣٩٫٩ · ٩٫٢٪
     *
     * وبعد: ٣٨/٣٠ و٣٢/٢٦ — أي ٨٫٥٪ و٦٫٣٪.
     *
     * ⚠️ **والسقفُ يُقاس على الإطار بسكّانه الحقيقيّين** (زرُّ المكتبة
     *    والعنوان)، وقد أُضيفوا في هذه التمريرة لأنّهم هم مَن كان
     *    يصنع الارتفاع — لا `min-height` وحدَها.
     */
    for (const [w, h, top, bottom] of [[412, 915, 34, 28], [1280, 800, 40, 32]]) {
      const f = await stageAt(w, h);
      const T = f.H('.sh-topbar');
      const B = f.H('.sh-bottom');
      f.close();
      expect(`${w}: علويّ ${T <= top}`).toBe(`${w}: علويّ true`);
      expect(`${w}: سفليّ ${B <= bottom}`).toBe(`${w}: سفليّ true`);
    }
  });

  it('٧١ · ولا ساكنَ فيهما يخرج عن صندوقه — لا قصَّ بالانكماش', async () => {
    /*
     * ⚠️ **ولا تُقاس بـ`scrollHeight`**: هالةُ اللمس الشفّافةُ تحت زرّ
     *    المكتبة تزيده ٦px وهي مقصودةٌ ولا تقصّ حرفًا. فالمقياسُ أن
     *    يكون كلُّ ابنٍ **مرئيٍّ** داخلَ صندوق شريطه.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const out = [];
      for (const sel of ['.sh-topbar', '.sh-bottom']) {
        const host = f.doc.querySelector(sel);
        const box = host.getBoundingClientRect();
        for (const node of host.querySelectorAll('*')) {
          const r = node.getBoundingClientRect();
          if (!r.height) continue;
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) {
            out.push(`${sel}>${node.className || node.tagName}`);
          }
        }
      }
      f.close();
      expect(`${w}: خارجون ${out.join(',') || 'لا أحد'}`).toBe(`${w}: خارجون لا أحد`);
    }
  });

  it('٧٢ · وزرُّ المكتبة صندوقُه صغر ولمسُه لم يصغر', async () => {
    /*
     * ⚠️ **`min-height: 44px` على الزرّ هو ما كان يفرض ٤٤ على الشريط.**
     *    فالصندوقُ نزل إلى ٢٤ وبقي المُلمَس بهالةٍ شفّافة. والشريطُ عند
     *    y=0 فنصفُ الهالة الأعلى خارجُ النافذة — ولذلك يُقاس **المدى
     *    المملوكُ فعلًا** لا ارتفاعُ الهالة المكتوب.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const btn = f.doc.querySelector('.sh-exit');
      const r = btn.getBoundingClientRect();
      const mid = Math.round(r.left + r.width / 2);
      const cy = r.top + r.height / 2;
      const owns = (y) => {
        const el = f.doc.elementFromPoint(mid, Math.round(y));
        return Boolean(el && (el === btn || btn.contains(el)));
      };
      let down = 0; while (down < 30 && owns(cy + down + 1)) down += 1;
      let up = 0; while (up < 30 && cy - up - 1 >= 0 && owns(cy - up - 1)) up += 1;
      const box = Math.round(r.height);
      const reach = up + down + 1;
      f.close();
      expect(`${w}: صندوقٌ ${box <= 28}`).toBe(`${w}: صندوقٌ true`);
      expect(`${w}: لمسٌ ${reach >= 36}`).toBe(`${w}: لمسٌ true`);
    }
  });

  it('٧٣ · وحبرُ الذيل لم يصغر — الصندوقُ وحدَه هو ما انكمش', async () => {
    /*
     * ⚠️ **شرطُك**: «تفضل مقروءة، ومتبقاش مضغوطة». فالمقتطَعُ هو ارتفاعُ
     *    السطر والفواصلُ والحشوة — لا حجمُ الحرف. قِيس: الرقمُ ١٢px على
     *    الهاتف و١٤ على العريض، والوصفُ ٨/٩ كما كانا قبل التمريرة.
     */
    for (const [w, h, num] of [[412, 915, 12], [1280, 800, 14]]) {
      const f = await stageAt(w, h);
      const b = parseFloat(f.cs('.sh-stats b').fontSize);
      const s = parseFloat(f.cs('.sh-stats span').fontSize);
      const t = parseFloat(f.cs('.sh-bottom-title b').fontSize);
      f.close();
      expect(`${w}: رقمٌ ${b >= num}`).toBe(`${w}: رقمٌ true`);
      expect(`${w}: وصفٌ ${s >= 8}`).toBe(`${w}: وصفٌ true`);
      expect(`${w}: عنوانٌ ${t >= 12}`).toBe(`${w}: عنوانٌ true`);
    }
  });

  it('٧٤ · وعنوانُ الذيل سطرٌ واحدٌ لا سطران', async () => {
    /*
     * ⚠️ **وهذا نصفُ ارتفاع الشريط بالضبط.** كان الاسمُ كتلةً ووصفُه
     *    تحته: ٣٩٫٩px في شريطٍ أرضيّتُه ٣٠. والمقياسُ سلوكيّ — ارتفاعُ
     *    الكتلة قريبٌ من سطرٍ واحد — لا اسمُ قيمةٍ في ورقة الأنماط.
     */
    for (const [w, h] of [[412, 915], [1280, 800]]) {
      const f = await stageAt(w, h);
      const box = f.H('.sh-bottom-title');
      const line = parseFloat(f.cs('.sh-bottom-title b').fontSize) * 1.6;
      f.close();
      expect(`${w}: سطرٌ واحد ${box <= line}`).toBe(`${w}: سطرٌ واحد true`);
    }
  });
});

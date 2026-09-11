/**
 * LingoLife — هندسةُ صفّ الجملة على الهاتف (WS-RW)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — ٤١٢×٩١٥ CSS، أطولُ جملةٍ في النصّ
 * ═══════════════════════════════════════════════════════════════
 *
 *     الصندوق   ١٤ ← ٣٩٨   (٣٨٤)   display: flex
 *       الرقمُ   ٢٠ ← ٣٣    (١٣)    flex: 0 0 auto
 *       النصُّ   ٣٩ ← ٣٥٦   (٣١٧)   flex: 1 1 0
 *       الميتا  ٣٦٢ ← ٣٩٤   (٣٢)    flex: 0 0 auto
 *
 *     النصُّ **٨٢٫٦٪** من البطاقة · صفٌّ بشارةٍ ٢٩٦ وصفٌّ بلا شارةٍ ٣١٧
 *     أسطرٌ ملتفّةٌ في أحدَ عشرَ صفًّا: **٢٣**
 *
 * وبعدها:
 *
 *     النصُّ **٩٣٫٥٪** · صفٌّ بشارةٍ ٣٥٩ وصفٌّ بلا شارةٍ ٣٥٩ · **٢٢** سطرًا
 *
 * ⚠️ **والعطبُ لم يكن الحشوة** — كانت ٤px على الجانبين. كان عمودَين
 *    **بكامل ارتفاع الصفّ** يقتطعان ٥٧px من **كلّ سطر**، لا من
 *    السطر الذي تقف عليه الشارة.
 *
 * ⚠️ **وأكثرُ ما يُحرَس هنا شيئان**:
 *
 *    ١) أنّ المحجوزَ للشارات هو **المرسومُ نفسُه** لا رقمٌ مخمَّن.
 *       كانت أوّلُ محاولةٍ لي طافيةً صمّاءَ عرضُها ٥٠px — رقمٌ يهدر
 *       في الصفّ الخالي ويضيق لو أُضيفت شارةٌ ثالثة.
 *
 *    ٢) أنّ صفًّا بشارةٍ وصفًّا بلا شارةٍ **عرضُ نصِّهما واحد**.
 *       وهذا لا يُثبَت بقراءة CSS — يُقاس على شاشةٍ عرضُها ٤١٢.
 *       فمن هنا الإطارُ المعزول: نافذةٌ بعرضٍ حقيقيٍّ يُسأل فيها
 *       المتصفّحُ نفسُه عن الأرقام، لا سلسلةُ نصٍّ يُبحث فيها.
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

/** كتلةُ حدِّ الهاتف كاملةً. */
async function phoneBlock() {
  const text = await css();
  const at = text.lastIndexOf('@media (max-width: 640px) {');
  if (at < 0) return '';
  const end = text.indexOf('\n}\n', at);
  return text.slice(at, end < 0 ? text.length : end);
}

/**
 * قارئُ قواعدٍ صغير: يجمع **التصريحات** المكتوبةَ لمُنتقٍ بعينه.
 *
 * ⚠️ **ولا يقرأ التعليقات** — تُشطَب أوّلًا. فحارسٌ يمرّ لأنّي كتبتُ
 *    الكلمةَ في شرحٍ عربيٍّ فوق القاعدة حارسٌ يحرس إنشائي لا كودي،
 *    وقد وقعتُ فيها ثلاث مرّاتٍ في هذه الجلسة وحدَها.
 */
function declarations(block, selector) {
  const bare = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(bare))) {
    const sels = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (sels.includes(selector)) out.push(m[2].trim());
  }
  return out.join(' ');
}

/** قيمةُ خاصّيّةٍ داخل نصِّ تصريحات. */
function prop(body, name) {
  const m = new RegExp(`(?:^|;|\\s)${name}\\s*:\\s*([^;]+)`).exec(body);
  return m ? m[1].trim() : '';
}

/* ================================================================== *
 * الإطارُ المعزول — شاشةٌ حقيقيّةٌ بعرضٍ نختاره                          *
 * ================================================================== */

const ROW = (cls, badges) => `
  <button class="sh-line ${cls}" data-line="0" title="00:00">
    <span class="sh-line-pick" data-pick-box aria-hidden="true"></span>
    <span class="n">7</span>
    <span class="meta">${badges}</span>
    <span class="tx" data-line-text lang="ru" dir="ltr">При работе с технической документацией важно
      обращать внимание не только на наличие документа, но и на его статус.<span
      class="tr" lang="ar" dir="rtl" hidden>عند العمل مع الوثائق التقنيّة</span></span>
  </button>`;

/**
 * نافذةٌ بعرضٍ محدَّدٍ تُحمَّل فيها أنماطُ التطبيق نفسُها.
 *
 * ⚠️ **والوسمُ هنا نسخةٌ من `lineHtml` — وهذه النسخةُ تُشيخ**. فحارسُ
 *    ١٨ يقارنها بالمصدر: كلُّ صنفٍ يستعمله هذا الإطار يجب أن يكون
 *    مكتوبًا في `lineHtml` فعلًا، وإلّا فالقياسُ يقيس متحفًا.
 */
async function frameAt(width, { picking = false } = {}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;inset-block-start:-10000px;inset-inline-start:0;
    inline-size:${width}px;block-size:900px;border:0;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="${new URL('../css/shadow.css', location.href).href}">
    <style>html,body{margin:0}</style></head><body>
    <div class="shadow-app"><div class="sh-book"><div class="sh-page sh-left">
      <div class="sh-lines${picking ? ' picking' : ''}" data-lines style="inline-size:384px">
        ${ROW('', '<span class="spk">🔊</span>')}
        ${ROW('practiced has-draft', '<span class="reps">×21</span>'
          + '<span class="sh-line-learn">0/17</span><span class="spk">🔊</span>')}
        ${ROW('current', '<span class="spk">🔊</span>')}
      </div>
    </div></div></div></body></html>`);
  doc.close();
  /* انتظارُ ورقةِ الأنماط — بلا هذا تُقاس أحجامٌ بلا CSS. */
  await new Promise((resolve) => {
    const link = doc.querySelector('link');
    if (link.sheet) { resolve(); return; }
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 3000);
  });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const rows = [...doc.querySelectorAll('.sh-line')];
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const read = (row) => ({
    row: box(row),
    cs: iframe.contentWindow.getComputedStyle(row),
    n: box(row.querySelector('.n')),
    tx: box(row.querySelector('[data-line-text]')),
    txCs: iframe.contentWindow.getComputedStyle(row.querySelector('[data-line-text]')),
    meta: box(row.querySelector('.meta')),
    metaCs: iframe.contentWindow.getComputedStyle(row.querySelector('.meta')),
  });
  return {
    doc,
    host: doc.querySelector('[data-lines]'),
    plain: read(rows[0]),
    badged: read(rows[1]),
    current: read(rows[2]),
    close: () => iframe.remove(),
  };
}

/* ================================================================== *
 * أ) العمودُ الميّتُ زال                                                *
 * ================================================================== */
describe('WS-RW · الصفُّ كتلةٌ لا ثلاثةُ أعمدة', () => {
  it('١ · الصفُّ على الهاتف لم يعد صفًّا مرنًا بثلاثة أعمدة', async () => {
    /*
     * ⚠️ **بند ٢**: «لا تحجز عمودًا جانبيًّا بكامل الارتفاع للميتا».
     *    والقياسُ هنا من المتصفّح لا من النصّ: الصفُّ كتلة، والميتا
     *    خارجَ التدفّق (طافية)، والرقمُ مطلقٌ في الهامش.
     */
    const f = await frameAt(412);
    expect(f.plain.cs.display).toBe('block');
    expect(f.plain.metaCs.float).toBe('right');
    expect(f.plain.cs.gridTemplateColumns === 'none' || f.plain.cs.gridTemplateColumns === '').toBe(true);
    expect(iframeStyle(f, '.n').position).toBe('absolute');
    f.close();
  });

  it('٢ · والنصُّ يأخذ ٩٠٪+ من عرض البطاقة القابل للاستعمال', async () => {
    /*
     * ⚠️ **بند ٣**: «لا تدّعِ نجاحًا لأنّك نقلتَ ٢٩٧ إلى ٣٠٥».
     *    فالعتبةُ مكتوبةٌ رقمًا: تسعون بالمئة من عرض البطاقة.
     *
     * ⚠️ **والقياسُ على الصفّ المشحون لا الخالي** — وهذا فرقٌ أوقعني
     *    فعلًا: شغّلتُ الحارسَ على الكود القديم فنجح! لأنّ الصفَّ
     *    الخاليَ ميتاه صفرٌ (مكبّرُ الصوت مخفيٌّ على غير الجارية)،
     *    فلم يكن يقيس العطبَ أصلًا. والعطبُ في الصفّ الذي عليه
     *    «×٢١» وشارةُ التعلّم: كان نصُّه ٧٨٪ فصار ٩٣٪.
     */
    const f = await frameAt(412);
    expect(f.badged.tx.w / f.badged.row.w > 0.9).toBe(true);
    expect(f.plain.tx.w / f.plain.row.w > 0.9).toBe(true);
    f.close();
  });

  it('٣ · والشاراتُ ما زالت مرسومةً ولها عرضٌ حقيقيّ', async () => {
    const f = await frameAt(412);
    expect(f.badged.meta.w > 10).toBe(true);
    expect(f.badged.meta.h > 6).toBe(true);
    /* وهي داخلَ الصفّ لا خارجَه. */
    expect(f.badged.meta.r <= f.badged.row.r + 1).toBe(true);
    f.close();
  });

  it('٤ · ولا عرضَ محجوزًا بالتخمين: المحجوزُ هو المرسوم', async () => {
    /*
     * ⚠️ **هذا حارسُ الخطأ الذي وقعتُ فيه فعلًا**، لا خطأٌ متخيَّل.
     *    كتبتُ `--sh-rowmeta: 50px` وطافيةً صمّاءَ بهذا العرض في
     *    **كلّ** صفّ. فصار الصفُّ الخالي من الشارات يهدر ٥٠px،
     *    والرقمُ يكذب لو أُضيفت شارةٌ ثالثة.
     *
     *    والحارسُ يقيس النتيجة لا الكتابة: الفرقُ بين يمينِ نصِّ
     *    الصفّ الخالي ويمينِ صندوقه يجب أن يكون أصغرَ من عرض ميتا
     *    الصفّ المشحون — أي أنّ الخالي **لا يحجز** ما يحجزه المشحون.
     */
    const f = await frameAt(412);
    expect(f.plain.tx.w).toBe(f.badged.tx.w);
    const block = await phoneBlock();
    const shim = declarations(block, '.sh-left [data-lines]:not(.picking) .sh-line > .tx::before');
    expect(shim).toBe('');
    expect(block.includes('--sh-rowmeta')).toBe(false);
    f.close();
  });
});

/* ================================================================== *
 * ب) هندسةٌ واحدةٌ لكلّ الصفوف                                          *
 * ================================================================== */
describe('WS-RW · الشاراتُ لا تغيّر عرضَ القراءة', () => {
  it('٥ · صفٌّ بشارةٍ وصفٌّ بلا شارةٍ: نفسُ عرض النصّ ونفسُ بدايته', async () => {
    /*
     * ⚠️ **بند ٩**: كان الفرقُ ٢٩٦ مقابل ٣١٧ — أي أنّ ممارستَك
     *    لجملةٍ كانت **تُضيّقها** عليك. وهذا الحارسُ كان يسقط قبل
     *    التمريرة، فهو يحرس تغييرًا حدث لا حالةً كانت قائمة.
     */
    const f = await frameAt(412);
    expect(f.plain.tx.w).toBe(f.badged.tx.w);
    expect(f.plain.tx.l).toBe(f.badged.tx.l);
    expect(f.current.tx.w).toBe(f.plain.tx.w);
    f.close();
  });

  it('٦ · وكلُّ السطور تبدأ من مسطرةٍ واحدة', async () => {
    const f = await frameAt(412);
    const starts = new Set([f.plain.tx.l, f.badged.tx.l, f.current.tx.l]);
    expect(starts.size).toBe(1);
    /* والرقمُ خارجَ تلك المسطرة، في هامشٍ لا في عمود. */
    expect(f.plain.n.r <= f.plain.tx.l + 1).toBe(true);
    expect(f.plain.n.w < 20).toBe(true);
    f.close();
  });

  it('٧ · والميتا تنزل من السطر الأوّل وحدَه', async () => {
    /*
     * الطافيةُ ارتفاعُها سطرٌ واحد: فصفٌّ من ثلاثة أسطرٍ ارتفاعُ
     * ميتاه أقلُّ من نصفِ ارتفاعِ صندوقِ نصِّه — لا عمودٌ يحاذيه.
     */
    const f = await frameAt(412);
    expect(f.badged.tx.h > f.badged.meta.h * 2).toBe(true);
    f.close();
  });

  it('٨ · ولا فيضَ أفقيٌّ من ٣٦٠ إلى ٤٢٠', async () => {
    for (const w of [360, 390, 412, 420]) {
      const f = await frameAt(w);
      expect(f.host.scrollWidth <= f.host.clientWidth + 1).toBe(true);
      expect(f.badged.tx.r <= f.badged.row.r + 1).toBe(true);
      expect(f.badged.tx.w / f.badged.row.w > 0.9).toBe(true);
      f.close();
    }
  });
});

/* ================================================================== *
 * ج) الروسيّةُ تقول عن نفسها إنّها روسيّة                                *
 * ================================================================== */
describe('WS-RW · دلالةُ اللغة والاتّجاه', () => {
  it('٩ · جملةُ السطر تحمل lang="ru" و dir="ltr" في الوسم', async () => {
    /*
     * ⚠️ **بند ٦**: كان الاتّجاهُ في CSS وحدَها. وهذا يكفي الرسمَ
     *    ولا يكفي المعنى: قارئُ الشاشة لا يعرف أيَّ لغةٍ ينطق،
     *    ولو غاب ملفُّ الأنماط لحظةً لَورثت الجملةُ اتّجاهَ الصفحة.
     */
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const body = src.slice(at, src.indexOf('\n}', at));
    const tx = /<span class="tx"([^>]*)>/.exec(body);
    expect(Boolean(tx)).toBe(true);
    expect(tx[1]).toContain('lang="ru"');
    expect(tx[1]).toContain('dir="ltr"');
  });

  it('١٠ · والترجمةُ تحتها تعلن عربيّتَها', async () => {
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const body = src.slice(at, src.indexOf('\n}', at));
    const tr = /<span class="tr"([^>]*)>/.exec(body);
    expect(Boolean(tr)).toBe(true);
    expect(tr[1]).toContain('lang="ar"');
    expect(tr[1]).toContain('dir="rtl"');
  });

  it('١١ · والمتصفّحُ يحسبها فعلًا يسارًا-يمينًا', async () => {
    const f = await frameAt(412);
    expect(f.plain.txCs.direction).toBe('ltr');
    expect(f.plain.txCs.textAlign).toBe('start');
    f.close();
  });

  it('١٢ · والالتفافُ معلَنٌ ولا ضبطَ (justify)', async () => {
    /*
     * ⚠️ **بند ٨**: قِستُ الضبطَ فخفّض الفراغَ إلى ٣٧px — وهو أفضلُ
     *    رقمٍ في الجدول — ثمّ رفضتُه بالنظر: أنهارٌ بيضاءُ بين
     *    الكلمات في عمودٍ ضيّقٍ بكلماتٍ روسيّةٍ طويلة.
     */
    const f = await frameAt(412);
    expect(f.plain.txCs.textAlign === 'justify').toBe(false);
    const block = await phoneBlock();
    const tx = declarations(block, '.sh-left [data-lines]:not(.picking) .sh-line > .tx');
    expect(prop(tx, 'text-wrap')).toBe('wrap');
    f.close();
  });
});

/* ================================================================== *
 * د) ما كان يعمل ما زال يعمل                                           *
 * ================================================================== */
describe('WS-RW · لا وظيفةَ فُقدت', () => {
  it('١٣ · «×٢١» وشارةُ التعلّم ومكبّرُ الصوت ما زالت في الوسم', async () => {
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const body = src.slice(at, src.indexOf('\n}', at));
    expect(body).toContain('class="reps"');
    expect(body).toContain('repetitionsCompleted');
    expect(body).toContain('learnBadgeHtml(index)');
    expect(body).toContain('class="spk"');
  });

  it('١٤ · ومكبّرُ الصوت يظهر على الجملة الجارية', async () => {
    /*
     * ⚠️ **وهذه قاعدةٌ قديمةٌ لا جديدة** — تُخفيه على كلّ الصفوف
     *    إلّا الجارية. وكنتُ أخفيتُه كلَّه في تمريرةٍ سابقةٍ زاعمًا
     *    أنّه «يأكل خُمسَ العرض»، ثمّ قِستُ فوجدتُه لا يأخذ شيئًا.
     */
    const f = await frameAt(412);
    const spk = (r) => f.doc.querySelector(r).querySelector('.spk');
    const vis = (el) => f.doc.defaultView.getComputedStyle(el).display !== 'none';
    expect(vis(spk('.sh-line.current'))).toBe(true);
    expect(spk('.sh-line.current').getBoundingClientRect().width > 4).toBe(true);
    f.close();
  });

  it('١٥ · وهويّةُ الجملة (data-line) باقيةٌ في الرسمين', async () => {
    /*
     * ⚠️ **بند ١٣**: الوضعان يستعملان **نفسَ الهويّة**. ونقلُ الميتا
     *    في الوسم لا يجوز أن يمسّها.
     */
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    expect(src.slice(at, src.indexOf('\n}', at))).toContain('data-line="${index}"');
    const fat = src.indexOf('function flowHtml(');
    expect(src.slice(fat, src.indexOf('\n}', fat))).toContain('data-line="${i}"');
  });

  it('١٦ · ووضعُ الاختيار يعود صفًّا مرنًا بمربّعٍ ظاهر', async () => {
    const f = await frameAt(412, { picking: true });
    expect(f.plain.cs.display).toBe('flex');
    const pick = f.doc.querySelector('.sh-line-pick');
    expect(f.doc.defaultView.getComputedStyle(pick).display).toBe('block');
    f.close();
  });
});

/* ================================================================== *
 * هـ) ما لا يجوز أن يتسرّب                                             *
 * ================================================================== */
describe('WS-RW · الحدُّ يخصّ الهاتف، والنصُّ لا يُمَسّ', () => {
  it('١٧ · إعادةُ بناء الصفّ مكتوبةٌ داخل حدِّ الهاتف وحدَه', async () => {
    /*
     * ⚠️ **قاعدةٌ تتسرّب تكسر اللوح** — وهو جهازي الأوّل. فالصفُّ
     *    الكتلةُ والميتا الطافيةُ لا وجودَ لهما خارج كتلة ٦٤٠px.
     */
    const text = await css();
    const start = text.lastIndexOf('@media (max-width: 640px) {');
    const outside = text.slice(0, start);
    const block = await phoneBlock();
    const rowSel = '.sh-left [data-lines]:not(.picking) .sh-line';
    expect(prop(declarations(block, rowSel), 'display')).toBe('block');
    expect(outside.includes(rowSel)).toBe(false);
    /* وعلى اللوح يبقى الصفُّ مرنًا والميتا آخرَه بـ order. */
    expect(prop(declarations(outside, '.sh-line'), 'display')).toBe('flex');
    expect(prop(declarations(outside, '.sh-line .meta'), 'order')).toBe('9');
  });

  it('١٨ · ولا فاصلَ يدويٌّ ولا مساسَ بالنصّ المخزون', async () => {
    /*
     * ⚠️ **بند ٧**: «لا `<br>` مُقحَمة، ولا تعديلَ للروسيّة المخزونة
     *    كي يبدو التنسيقُ أجمل». فالجملةُ تُكتَب كما هي في المقطع،
     *    والتنسيقُ كلُّه في CSS.
     *
     *    وهذا الحارسُ يربط أيضًا إطارَ القياس بالمصدر: كلُّ صنفٍ
     *    يستعمله الإطارُ أعلاه موجودٌ في `lineHtml` فعلًا، وإلّا صار
     *    القياسُ يقيس متحفًا لا التطبيق.
     */
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const body = src.slice(at, src.indexOf('\n}', at));
    expect(body).toContain('${segment.sourceTextSnapshot}');
    expect(body.includes('<br')).toBe(false);
    expect(/sourceTextSnapshot\s*\.\s*(replace|split|slice)/.test(body)).toBe(false);
    for (const cls of ['sh-line-pick', 'class="n"', 'class="meta"', 'class="tx"',
      'class="reps"', 'class="spk"', 'class="tr"']) {
      expect(body).toContain(cls);
    }
  });
});

/** أنماطُ عنصرٍ داخل الإطار — مختصَرٌ يُستعمل في الحارس الأوّل. */
function iframeStyle(f, sel) {
  return f.doc.defaultView.getComputedStyle(f.doc.querySelector(`.sh-line ${sel}`));
}

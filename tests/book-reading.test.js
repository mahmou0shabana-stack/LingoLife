/**
 * LingoLife — صفحةُ الجُمَل تُقرأ لا تُشغَّل (WS-BK)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — ٤١٢×٩١٥ CSS
 * ═══════════════════════════════════════════════════════════════
 *
 *   الحبر          المقاس  التباين
 *   ───────────────────────────────
 *   الروسيّة         ١٤٫٥    ١٢٫٩
 *   رأسُ «TRANSCRIPT» ١٤٫٥    ٥٫٢
 *   شرائطُ الذيل      ٩٫٥     ٥٫٢
 *   الشريطُ الفعّال    ٩٫٥     ٥٫٢
 *   الإحصاء          ١٤٫٥    ٢٫١
 *
 *   تباعدٌ داخل الجملة ٢٣٫٩px · بين جملتين ≈٣٥px (+٤٦٪)
 *   مسطرةٌ سفليّةٌ تحت كلّ صفّ · ١١ صفًّا = ١١ مسطرة
 *   خطُّ الهامش عند ٤٤ والنصُّ يبدأ عند ٣٥ — **الخطُّ داخل النصّ**
 *
 * ⚠️ **والسببُ الذي جعلها تبدو تطبيقًا ليس الحشوة.** كان أربعةً:
 *    لا مقاسَ مهيمنًا (النصُّ بمقاس الواجهة)، ومسطرةٌ بين كلّ جملتين،
 *    وإيقاعٌ مكسورٌ بين داخل الجملة وبينها، ولوحٌ أفتحُ من الورقة
 *    بظِلٍّ يحمل بطاقتين قبل أوّل حرفٍ روسيّ.
 *
 * ⚠️ **وأكثرُ ما يُحرَس هنا أنّ القياسَ من الشاشة لا من الملفّ**:
 *    «هل يهيمن النصّ؟» و«هل تنحسر الواجهة؟» سؤالان عن **أحجامٍ
 *    وألوانٍ محسوبة**، لا عن كلماتٍ في CSS. فمن هنا الإطارُ المعزول.
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

async function phoneBlock() {
  const text = await css();
  const at = text.lastIndexOf('@media (max-width: 640px) {');
  if (at < 0) return '';
  const end = text.indexOf('\n}\n', at);
  return text.slice(at, end < 0 ? text.length : end);
}

/* ================================================================== *
 * إطارٌ معزولٌ بعرضٍ حقيقيّ — صفحةٌ مصغّرةٌ بواجهتها ونصِّها            *
 * ================================================================== */

const SENTENCE = 'При работе с технической документацией важно обращать '
  + 'внимание не только на наличие документа, но и на его статус.';

const ROW = (cls, badges) => `
  <button class="sh-line ${cls}" data-line="0" title="00:00">
    <span class="sh-line-pick" data-pick-box aria-hidden="true"></span>
    <span class="n">7</span>
    <span class="meta">${badges}</span>
    <span class="tx" data-line-text lang="ru" dir="ltr">${SENTENCE}</span>
  </button>`;

/**
 * ⚠️ **الوسمُ هنا نسخةٌ من `lineHtml`/`flowHtml` — والنسخةُ تشيخ.**
 *    فالحارسُ الأخيرُ يربطها بالمصدر: كلُّ صنفٍ يستعمله الإطارُ يجب
 *    أن يكون مكتوبًا في الراسم فعلًا، وإلّا صار القياسُ يقيس متحفًا.
 */
async function frameAt(width, { flow = false } = {}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;inset-block-start:-10000px;inset-inline-start:0;
    inline-size:${width}px;block-size:900px;border:0;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const body = flow
    ? `<div class="sh-lines is-flow" data-lines>
         <p class="sh-flow-p"><span class="sh-flow-s" data-line="0" role="button" tabindex="0"
           lang="ru" dir="ltr"><i class="sh-flow-n">1</i>${SENTENCE}</span>
           <span class="sh-flow-s practiced" data-line="1" role="button" tabindex="0"
           lang="ru" dir="ltr"><i class="sh-flow-n">2</i>${SENTENCE}</span></p>
       </div>`
    : `<div class="sh-lines" data-lines style="inline-size:${width - 28}px">
         ${ROW('', '<span class="spk">🔊</span>')}
         ${ROW('practiced', '<span class="reps">×21</span><span class="spk">🔊</span>')}
         ${ROW('has-draft', '<span class="sh-line-learn">0/17</span><span class="spk">🔊</span>')}
         ${ROW('current', '<span class="spk">🔊</span>')}
       </div>`;
  doc.open();
  /*
   * ⚠️ **والإطارُ يحمّل أساسَ التطبيق لا `shadow.css` وحدَه.**
   *
   *    كان يحمّل ورقةَ الظلّ فقط، فيبدأ المقاسُ الموروثُ من ١٦px
   *    الافتراضيّة بدل ١٤٫٥ (`--fs-base` في `tokens.css`). فسقط حارسُ
   *    اللوح — لا لأنّ اللوحَ انكسر، بل لأنّ البيئةَ المصغَّرةَ لم تكن
   *    التطبيق. **البيئةُ التي لا تشبه التطبيق تقيس نفسَها.**
   */
  doc.write(`<!doctype html><html dir="rtl"><head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="${new URL('../css/tokens.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/base.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/shadow.css', location.href).href}">
    <style>html,body{margin:0}</style></head><body>
    <div class="shadow-app"><div class="sh-book"><div class="sh-page sh-left">
      <div class="sh-sec-head sh-read-head">
        <span class="sh-mono">TRANSCRIPT · 11</span>
        <span class="sh-read-modes" role="tablist">
          <button data-sh="read-mode" data-v="lines" role="tab" class="on">جمل</button>
          <button data-sh="read-mode" data-v="flow" role="tab">نص كامل</button>
        </span>
      </div>
      ${body}
      <div class="sh-foot-tabs">
        <button class="on">TRANSCRIPT</button><button>NOTES</button>
      </div>
    </div></div></div></body></html>`);
  doc.close();
  /*
   * ⚠️ **الانتظارُ على الأثر لا على حدث التحميل.**
   *
   *    كنتُ أنتظر `link.sheet` وحدثَ load ثمّ إطارَي رسم. فسقط حارسٌ
   *    مرّةً بخلفيّةِ زرٍّ افتراضيّة (‎rgba(239,239,239,.886)‎) — أي
   *    أنّ الوسمَ قِيس و`shadow.css` لم تُطبَّق بعد. و`sheet` تصير
   *    غيرَ فارغةٍ قبل أن يُعاد الحساب، فالحدثُ يكذب.
   *
   *    فالانتظارُ الآن على ما نحتاجه فعلًا: أن يكون الصفُّ قد أخذ
   *    تخطيطَه من ورقة الظلّ. **انتظر النتيجةَ لا الإشعار.**
   */
  /*
   * ⚠️ **والأثرُ يجب أن يكون من ورقة الظلّ وحدَها** (WS-BG). كان
   *    الانتظارُ على `display` — و`base.css` تكفي لذلك، فيمرّ
   *    الانتظارُ و`shadow.css` لم تصل، فيُقاس زرٌّ بخلفيّة المتصفّح
   *    الافتراضيّة. وتدرّجُ الورقة لا يأتي إلّا من ورقة الظلّ.
   */
  const ready = () => {
    const left = doc.querySelector('.sh-left');
    if (!left) return false;
    return iframe.contentWindow.getComputedStyle(left).backgroundImage.includes('gradient');
  };
  const started = Date.now();
  while (!ready() && Date.now() - started < 4000) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const win = iframe.contentWindow;
  const cs = (sel) => win.getComputedStyle(doc.querySelector(sel));
  const box = (sel) => {
    const el = doc.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height) };
  };
  /** شفافيّةُ لونِ حبرٍ محسوبة — كم ينحسر هذا النصُّ عن الورقة. */
  const alpha = (sel) => {
    const m = /rgba?\(([^)]+)\)/.exec(cs(sel).color);
    if (!m) return 1;
    const parts = m[1].split(',').map(Number);
    return parts.length > 3 ? parts[3] : 1;
  };
  const px = (sel, prop) => parseFloat(cs(sel)[prop]);
  return { doc, win, cs, box, alpha, px, host: doc.querySelector('[data-lines]'),
    close: () => iframe.remove() };
}

/* ================================================================== *
 * أ) النصُّ يهيمن                                                     *
 * ================================================================== */
describe('WS-BK · مقاسٌ واحدٌ مهيمن', () => {
  it('١ · الروسيّةُ أكبرُ من كلّ حبرِ الواجهة حولها', async () => {
    /*
     * ⚠️ **بند ٢**: «العينُ ترى الروسيَّ قبل الأرقام والأشرطة».
     *    وكان النصُّ ١٤٫٥ ورأسُ النصّ ١٤٫٥ — أي لا تراتبَ أصلًا.
     *    فالعتبةُ مكتوبةٌ رقمًا: النصُّ أكبرُ من الرأس بنقطةٍ فأكثر،
     *    وأكبرُ من شرائط الذيل بالضعف تقريبًا.
     */
    const f = await frameAt(412);
    const ru = f.px('.sh-line [data-line-text]', 'fontSize');
    expect(ru > f.px('.sh-read-head .sh-mono', 'fontSize')).toBe(true);
    expect(ru > f.px('.sh-foot-tabs button', 'fontSize') * 1.4).toBe(true);
    expect(ru > f.px('.sh-read-modes button', 'fontSize') * 1.4).toBe(true);
    f.close();
  });

  it('٢ · وهي أكبرُ ممّا كانت قبل التمريرة', async () => {
    /* ⚠️ حارسٌ يسقط على الكود القديم: كان ١٤٫٥ بالضبط. */
    const f = await frameAt(412);
    expect(f.px('.sh-line [data-line-text]', 'fontSize') > 14.5).toBe(true);
    f.close();
  });

  it('٣ · وتباعدُ سطورها تباعدُ كتابٍ لا قائمة', async () => {
    const f = await frameAt(412);
    const size = f.px('.sh-line [data-line-text]', 'fontSize');
    const lh = f.px('.sh-line [data-line-text]', 'lineHeight');
    const ratio = lh / size;
    expect(ratio >= 1.6).toBe(true);
    expect(ratio <= 1.9).toBe(true);
    f.close();
  });

  it('٤ · والوجهُ رومانيٌّ لا مائل', async () => {
    /*
     * ⚠️ **بند ٤**: المائلُ في الطباعة تشديدٌ لا متن. وصفحةُ الجُمَل
     *    تُقرأ دقائقَ متّصلة، فوجهُها روماني. والخيارُ لم يُحذف —
     *    تغيّر الافتراضُ وحدَه، والعشرةُ كلُّها في منتقي «Aa».
     */
    const src = await view();
    const at = src.indexOf('fontDoc:');
    const line = src.slice(at, src.indexOf('\n', at));
    expect(line).toContain("'noto'");
    expect(line.includes('philosopher')).toBe(false);

    const fonts = await (await fetch('../js/services/shadow/fonts.js')).text();
    /* والوجهُ المختارُ موجودٌ فعلًا في القائمة وسيريليٌّ ورومانيّ. */
    const entry = /\{ id: 'noto',[\s\S]*?\}/.exec(fonts)[0];
    expect(entry).toContain("style: 'normal'");
    expect(entry).toContain('cyrillic: true');
    /* والمائلُ باقٍ خيارًا لمن أراده. */
    expect(fonts).toContain("id: 'philosopher'");
  });
});

/* ================================================================== *
 * ب) لا رصَّ بطاقات                                                   *
 * ================================================================== */
describe('WS-BK · صفحةٌ لا قائمة', () => {
  it('٥ · لا مسطرةَ ولا خلفيّةَ ولا حافّةَ دائريّةً بين الجُمَل', async () => {
    /*
     * ⚠️ **بند ٣**: أقوى إشارةِ «قائمة» كانت أحدَ عشرَ خطًّا بالعرض
     *    الكامل على مسافاتٍ متساوية. والكتبُ لا تُسطّر بين الجُمَل.
     */
    const f = await frameAt(412);
    for (const sel of ['.sh-line', '.sh-line.practiced', '.sh-line.has-draft']) {
      expect(f.px(sel, 'borderBottomWidth')).toBe(0);
      expect(f.px(sel, 'borderTopWidth')).toBe(0);
      expect(f.px(sel, 'borderRadius')).toBe(0);
      expect(f.cs(sel).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    }
    f.close();
  });

  it('٦ · والمسافةُ بين جملتين من إيقاع السطر لا من كتلةٍ مضافة', async () => {
    /*
     * ⚠️ **بند ٦**: كان الفرقُ بين «داخل الجملة» و«بينها» ٤٦٪ —
     *    ٢٣٫٩ مقابل ٣٥. فالعينُ ترى كتلًا. والحشوةُ الآن بالسطر
     *    (`em`) فتبقى المسافةُ بين الجملتين قريبةً من سطرٍ واحد.
     */
    const f = await frameAt(412);
    const lh = f.px('.sh-line [data-line-text]', 'lineHeight');
    const gap = f.px('.sh-line', 'paddingBlockStart') + f.px('.sh-line', 'paddingBlockEnd');
    /* فجوةُ الجملتين = سطرٌ + الحشوتان، ولا تتجاوز سطرًا ونصفًا. */
    expect((lh + gap) / lh <= 1.5).toBe(true);
    f.close();
  });

  it('٧ · والجاريةُ علامةُ هامشٍ وغَسْلةٌ لا بطاقةٌ محدَّدة', async () => {
    /*
     * ⚠️ **بند ٨**: «مقطعٌ تقرؤه» لا «بطاقةٌ اخترتَها». فالخلفيّةُ
     *    شفّافةٌ إلى حدٍّ بعيد، والعلامةُ في الهامش هي التي تتكلّم.
     */
    const f = await frameAt(412);
    const bg = /rgba?\(([^)]+)\)/.exec(f.cs('.sh-line.current').backgroundColor);
    const a = bg ? Number(bg[1].split(',')[3] ?? 1) : 1;
    expect(a > 0).toBe(true);
    expect(a <= 0.12).toBe(true);
    expect(f.cs('.sh-line.current').boxShadow.includes('inset')).toBe(true);
    expect(f.px('.sh-line.current', 'borderRadius')).toBe(0);
    f.close();
  });

  it('٨ · وخطُّ الهامش لا يمرّ داخل النصّ', async () => {
    /*
     * ⚠️ **عطبٌ وجده القياسُ لا العين.** `.sh-left::after` عند ٣٨px
     *    والنصُّ يبدأ عند ٢٩ من نفس الحافّة — فالخطُّ يشطب أوائل
     *    الحروف في كلّ سطر. وصار محسوبًا من نفس ثابت الهامش
     *    (`--sh-gutter`)، فلا ينفصلان بعد اليوم.
     */
    for (const w of [360, 390, 412, 420]) {
      const f = await frameAt(w);
      const left = f.doc.querySelector('.sh-left').getBoundingClientRect();
      const after = f.win.getComputedStyle(f.doc.querySelector('.sh-left'), '::after');
      const ruleX = left.left + parseFloat(after.insetInlineStart);
      const textL = f.box('.sh-line [data-line-text]').l;
      expect(ruleX <= textL).toBe(true);
      /* ولا يهرب إلى خارج الورقة أيضًا. */
      expect(ruleX >= left.left).toBe(true);
      f.close();
    }
  });
});

/* ================================================================== *
 * ج) الواجهةُ تنحسر                                                   *
 * ================================================================== */
describe('WS-BK · الواجهةُ تخفت والنصُّ يبقى', () => {
  it('٩ · حبرُ الأشرطةِ والرأسِ أخفتُ من حبر النصّ', async () => {
    /*
     * ⚠️ **بنود ٩ و١٠ و١١**: قِستُ التباين قبل التمريرة فكان رأسُ
     *    النصّ وشرائطُ الذيل والشريطُ الفعّال كلُّها ٥٫٢ — أي بقوّة
     *    عنوان. وأن يكون التبويبُ بقوّة العنوان يعني ألّا عنوانَ هناك.
     */
    const f = await frameAt(412);
    const ink = f.alpha('.sh-line [data-line-text]');
    for (const sel of ['.sh-read-head .sh-mono', '.sh-foot-tabs button:not(.on)',
      '.sh-read-modes button:not(.on)']) {
      expect(f.alpha(sel) < ink).toBe(true);
      expect(f.alpha(sel) <= 0.45).toBe(true);
    }
    f.close();
  });

  it('١٠ · والفعّالُ وحدَه يبقى واضحًا — لأنّه يقول أين أنت', async () => {
    const f = await frameAt(412);
    expect(f.alpha('.sh-read-modes button.on') > f.alpha('.sh-read-modes button:not(.on)')).toBe(true);
    expect(f.alpha('.sh-foot-tabs button.on') > f.alpha('.sh-foot-tabs button:not(.on)')).toBe(true);
    f.close();
  });

  it('١١ · واللوحُ الأفتحُ فوق الورقة زال', async () => {
    /*
     * ⚠️ `.sh-sheet` كان ‎#fdfaf1‎ بظِلٍّ — ورقةٌ ثانيةٌ فوق الورقة.
     *    والورقةُ الواحدةُ لا لوحان عليها (بند ٣).
     */
    const block = await phoneBlock();
    const bare = block.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(bare).toContain('.sh-left .sh-sheet { background: transparent; box-shadow: none; }');
    const outside = (await css()).slice(0, (await css()).lastIndexOf('@media (max-width: 640px) {'));
    expect(outside.includes('.sh-left .sh-sheet { background: transparent;')).toBe(false);
  });
});

/* ================================================================== *
 * د) ما لا يجوز أن ينكسر                                              *
 * ================================================================== */
describe('WS-BK · كلُّ ما كان يعمل ما زال', () => {
  it('١٢ · الشاراتُ والهويّةُ والدلالةُ باقيةٌ في الوسم', async () => {
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const body = src.slice(at, src.indexOf('\n}', at));
    expect(body).toContain('data-line="${index}"');
    expect(body).toContain('class="reps"');
    expect(body).toContain('learnBadgeHtml(index)');
    expect(body).toContain('class="spk"');
    expect(body).toContain('lang="ru"');
    expect(body).toContain('dir="ltr"');
  });

  it('١٣ · والشاراتُ مرسومةٌ فعلًا ولها عرض', async () => {
    const f = await frameAt(412);
    expect(f.box('.sh-line.practiced .reps').w > 8).toBe(true);
    expect(f.box('.sh-line.has-draft .sh-line-learn').w > 8).toBe(true);
    expect(f.cs('.sh-line.current .spk').display === 'none').toBe(false);
    f.close();
  });

  it('١٤ · والنصُّ المتّصل بلا صناديقَ ولا شاراتٍ وهويّتُه باقية', async () => {
    /*
     * ⚠️ **بند ١٢**: هو أقوى أوضاع القراءة — فقرةٌ متّصلةٌ بلا رقمٍ
     *    ولا عدّادٍ بجوار كلّ سطر، وبنفس المقاس المهيمن.
     */
    const f = await frameAt(412, { flow: true });
    expect(f.doc.querySelectorAll('.sh-line').length).toBe(0);
    expect(f.doc.querySelectorAll('.sh-flow-s .meta, .sh-flow-s .reps').length).toBe(0);
    expect([...f.doc.querySelectorAll('.sh-flow-s')].every((e) => e.dataset.line)).toBe(true);
    expect([...f.doc.querySelectorAll('.sh-flow-s')].every((e) => e.lang === 'ru')).toBe(true);
    expect(f.px('.sh-flow-p', 'fontSize') > 14.5).toBe(true);
    expect(f.px('.sh-flow-p', 'lineHeight') / f.px('.sh-flow-p', 'fontSize') >= 1.7).toBe(true);
    f.close();
  });

  it('١٥ · ولمسُه ممكنٌ في الوضعين', async () => {
    const src = await view();
    const fat = src.indexOf('function flowHtml(');
    const flow = src.slice(fat, src.indexOf('\n}', fat));
    expect(flow).toContain('role="button"');
    expect(flow).toContain('tabindex="0"');
    const f = await frameAt(412, { flow: true });
    expect(f.cs('.sh-flow-s').cursor).toBe('pointer');
    f.close();
  });

  it('١٦ · ولا فيضَ أفقيٌّ من ٣٦٠ إلى ٤٢٠ في الوضعين', async () => {
    for (const w of [360, 390, 412, 420]) {
      for (const flow of [false, true]) {
        const f = await frameAt(w, { flow });
        expect(f.host.scrollWidth <= f.host.clientWidth + 1).toBe(true);
        f.close();
      }
    }
  });
});

/* ================================================================== *
 * هـ) اللوحُ لا ينكسر                                                 *
 * ================================================================== */
describe('WS-BK · الهاتفُ وحدَه تغيّر', () => {
  it('١٧ · على اللوح يبقى الصفُّ مرنًا بخلفيّته ومقاسه', async () => {
    /*
     * ⚠️ **قاعدةٌ تتسرّب تكسر اللوح** — وهو الجهازُ الأوّل. فكلُّ ما
     *    كُتب هنا داخلَ حدّ الهاتف، ويُقاس على نافذةٍ أوسعَ منه.
     */
    const wide = await frameAt(1100);
    expect(wide.cs('.sh-line').display).toBe('flex');
    expect(wide.cs('.sh-line').backgroundColor === 'rgba(0, 0, 0, 0)').toBe(false);
    /* والمسطرةُ السفليّةُ من نصيب اللوح لا الهاتف — لم تُمَسّ هناك. */
    expect(wide.px('.sh-line', 'borderRadius') > 0).toBe(true);

    /*
     * ⚠️ **والمقاسُ يُقاس نسبةً لا رقمًا مطلقًا.** كتبتُ أوّلًا
     *    «أصغرُ من ١٦px» فسقط الحارس — لا لأنّ اللوحَ انكسر، بل لأنّ
     *    الإطارَ المعزولَ لا يرث مقاسَ التطبيق الأساسيّ (١٤٫٥)
     *    فيبدأ من ١٦ الافتراضيّة. والرقمُ المطلقُ في بيئةٍ مصغَّرةٍ
     *    يقيس البيئةَ لا الكود. فالسؤالُ الصحيح: **هل الهاتفُ أكبر؟**
     */
    const phone = await frameAt(412);
    expect(phone.px('.sh-line [data-line-text]', 'fontSize')
      > wide.px('.sh-line [data-line-text]', 'fontSize')).toBe(true);
    phone.close();
    wide.close();
  });

  it('١٨ · وكلُّ قواعد هذه التمريرة داخلَ حدّ الهاتف', async () => {
    const text = await css();
    const outside = text.slice(0, text.lastIndexOf('@media (max-width: 640px) {'));
    for (const rule of [
      '.sh-left [data-lines]:not(.is-flow) .sh-line { font-size:',
      '.sh-left .sh-sheet { background: transparent;',
      '--sh-gutter:',
    ]) {
      expect(outside.includes(rule)).toBe(false);
      expect((await phoneBlock()).includes(rule)).toBe(true);
    }
  });

  it('١٩ · وإطارُ القياس يستعمل أصنافَ الراسم نفسِه', async () => {
    /*
     * ⚠️ **وإلّا صار القياسُ يقيس متحفًا.** كلُّ صنفٍ في الإطار أعلاه
     *    مكتوبٌ في `lineHtml` أو `flowHtml` فعلًا.
     */
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const line = src.slice(at, src.indexOf('\n}', at));
    for (const cls of ['class="n"', 'class="meta"', 'class="tx"', 'class="reps"',
      'class="spk"', 'sh-line-pick']) {
      expect(line).toContain(cls);
    }
    const fat = src.indexOf('function flowHtml(');
    const flow = src.slice(fat, src.indexOf('\n}', fat));
    expect(flow).toContain('sh-flow-p');
    expect(flow).toContain('sh-flow-s');
    expect(flow).toContain('sh-flow-n');
  });
});

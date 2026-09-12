/**
 * LingoLife — هندسةُ صفّ القراءة: لا أعمدةَ حول الروسيّة (WS-BG)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — ٤١٢×٩١٥ CSS، اثنتا عشرةَ جملة
 * ═══════════════════════════════════════════════════════════════
 *
 *   صندوقُ النصّ ٣٥٩ من ٣٨٤ (٩٣٫٥٪) · مبدأُ النصّ ٢١ في كلّ الصفوف
 *   متوسّطُ فجوةِ السطر الأوّل **١٠٣px** · أصغرُها **٤٤**
 *   شارةٌ على **١١ صفًّا من ١١** · أسطرٌ ملتفّة **٢٣**
 *
 * ⚠️ **والممرُّ الرأسيُّ الذي يراه صاحبُ الجهاز حبرٌ لا يُرسَم أصلًا.**
 *
 *    زرُّ «＋» (بابُ بدء التعلّم) يُرسَم على كلّ جملةٍ بلا مادّة — وهي
 *    أغلبُ الجُمَل — مخفيًّا بـ`visibility: hidden`. وهي تُخفي الحبرَ
 *    **وتُبقي الصندوق**، وعرضُه الأدنى ٣٠px. فيطفو في أوّل كلّ جملةٍ
 *    حاجزًا ٣٢px لا يحمل شيئًا، واثنتا عشرةَ جملةً فوق بعضها تصنع
 *    ممرًّا أبيضَ نازلًا في يمين الصفحة.
 *
 *    وقِستُ الأثرَ بإخفائه فعلًا على نفس الشاشة:
 *
 *        متوسّطُ فجوةِ السطر الأوّل   ١٠٣ ← **٥٩**
 *        أصغرُ فجوة                ٤٤  ← **١٧**
 *        أسطرٌ ملتفّة               ٢٣  ← **٢٢**
 *
 * ⚠️ **والفرقُ بين `visibility` و`display` هو الفرقُ كلُّه**: الأولى
 *    تقول «لا تُرِه»، والثانية «لا تحجز له». ومن هنا أكثرُ حرّاس هذا
 *    الملفّ: **لا يكفي أن تكون الشارةُ غيرَ مرئيّة — يجب ألّا يكون
 *    لها صندوق.** ولذلك تُقاس الأعراضُ بالهندسة لا بوجود العناصر.
 */

import { describe, it, expect } from './test-runner.js';

let VIEW = '';
const view = async () => {
  if (!VIEW) VIEW = await (await fetch('../js/views/shadow-view.js')).text();
  return VIEW;
};

const LONG = 'При работе с технической документацией важно обращать внимание '
  + 'не только на наличие документа, но и на его статус.';
const SHORT = 'Хорошо.';

/**
 * صفٌّ بنفس أصناف `lineHtml` — وحارسُ الختام يربط هذه الأصناف بالمصدر.
 *
 * `badges` هو ما يُرسَم داخل `.meta` فعلًا لهذه الحالة.
 */
const ROW = (n, cls, badges, text) => `
  <button class="sh-line ${cls}" data-line="${n - 1}" title="00:00">
    <span class="sh-line-pick" data-pick-box aria-hidden="true"></span>
    <span class="n">${n}</span>
    <span class="meta">${badges}</span>
    <span class="tx" data-line-text lang="ru" dir="ltr">${text}</span>
  </button>`;

/* زرُّ «＋» كما يرسمه `learnBadgeHtml` للجملة التي لا مادّةَ لها. */
const ADD = '<span class="sh-line-learn is-add" role="button" tabindex="0">＋</span>';
const SPK = '<span class="spk">🔊</span>';

async function frameAt(width, { wide = false, flow = false } = {}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;inset-block-start:-10000px;inset-inline-start:0;
    inline-size:${width}px;block-size:1200px;border:0;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;

  const body = flow
    ? `<div class="sh-lines is-flow" data-lines>
         <p class="sh-flow-p"><span class="sh-flow-s" data-line="0" role="button" tabindex="0"
           lang="ru" dir="ltr"><i class="sh-flow-n">1</i>${LONG}</span></p>
       </div>`
    /*
     * أشكالُ الصفوف المطلوبة في البند ١٣ — والأرقامُ ١ و١٠ و١٢ معًا
     * كي يُقاس «هل يزيح رقمُ خانتين مبدأَ النصّ؟».
     */
    : `<div class="sh-lines" data-lines ${wide ? 'data-wide-n' : ''}>
         ${ROW(1, '', ADD + SPK, SHORT)}
         ${ROW(2, '', ADD + SPK, LONG)}
         ${ROW(3, 'has-draft', '<span class="sh-line-learn is-on"><b>0/17</b></span>' + SPK, LONG)}
         ${ROW(10, 'practiced', '<span class="reps">×21</span>' + ADD + SPK, LONG)}
         ${ROW(12, 'current', ADD + SPK, LONG)}
       </div>`;

  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="${new URL('../css/tokens.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/base.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/shadow.css', location.href).href}">
    <style>html,body{margin:0}</style></head><body>
    <div class="shadow-app"><div class="sh-book"><div class="sh-page sh-left">
      ${body}
    </div></div></div></body></html>`);
  doc.close();

  /*
   * الانتظارُ على الأثر لا على حدث التحميل (درسُ WS-BK).
   *
   * ⚠️ **والأثرُ يجب أن يكون من ورقة الظلّ وحدَها.** كنتُ أنتظر أن
   *    يصير `display` للصفّ كتلةً أو مرنًا — و`base.css` تكفي لذلك،
   *    فيمرّ الانتظارُ و`shadow.css` لم تصل بعد، فيُقاس زرٌّ بخلفيّة
   *    المتصفّح الافتراضيّة. وهي ثالثُ مرّةٍ يعضّني فيها هذا السباق.
   *
   *    وتدرّجُ الورقة لا يأتي إلّا من `shadow.css`، فهو العلامة.
   */
  const ready = () => {
    const left = doc.querySelector('.sh-left');
    if (!left) return false;
    return iframe.contentWindow.getComputedStyle(left).backgroundImage.includes('gradient');
  };
  const t0 = Date.now();
  while (!ready() && Date.now() - t0 < 4000) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const win = iframe.contentWindow;
  const rows = [...doc.querySelectorAll('.sh-line')];
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, w: r.width, h: r.height };
  };
  /** مستطيلاتُ السطور المرسومة فعلًا داخل جملة. */
  const inkRects = (row) => {
    const el = row.querySelector('[data-line-text]');
    const range = doc.createRange();
    range.selectNodeContents(el);
    const by = new Map();
    for (const r of range.getClientRects()) {
      if (r.width < 1) continue;
      const k = Math.round(r.top);
      const c = by.get(k);
      by.set(k, c ? { l: Math.min(c.l, r.left), r: Math.max(c.r, r.right) } : { l: r.left, r: r.right });
    }
    return [...by.entries()].sort((a, x) => a[0] - x[0]).map(([, v]) => v);
  };
  const read = (row) => {
    const rb = box(row);
    const tb = box(row.querySelector('[data-line-text]'));
    const meta = row.querySelector('.meta');
    const mb = meta ? box(meta) : null;
    const rects = inkRects(row);
    return {
      el: row, rb, tb,
      txW: Math.round(tb.w),
      start: Math.round(tb.l - rb.l),
      metaW: meta && win.getComputedStyle(meta).display !== 'none' ? Math.round(mb.w) : 0,
      metaH: mb ? Math.round(mb.h) : 0,
      lines: rects.length,
      endGaps: rects.map((r) => Math.round(rb.r - r.r)),
    };
  };
  const host = doc.querySelector('[data-lines]');
  return {
    doc, win, host, iframe,
    rows: rows.map(read),
    byState: (s) => rows.map(read).find((r) => r.el.className.includes(s)),
    plain: rows.map(read).filter((r) => r.el.className.trim() === 'sh-line'),
    cs: (el) => win.getComputedStyle(el),
    close: () => iframe.remove(),
  };
}

/* ================================================================== *
 * أ) لا أعمدةَ حول النصّ                                               *
 * ================================================================== */
describe('WS-BG · لا عمودَ أرقامٍ ولا عمودَ تقدّم', () => {
  it('١ · الرقمُ حاشيةٌ مطلقةٌ لا عمودٌ في التدفّق', async () => {
    /*
     * ⚠️ **بند ٣**: «الرقمُ متاحٌ، ولا يحجز عمودَ نصّ». فالقياسُ من
     *    المتصفّح: الصفُّ كتلةٌ (لا مرنٌ ولا شبكة)، والرقمُ خارجَ
     *    التدفّق، وإزاحةُ النصّ إزاحةٌ بصريّةٌ لا عمودًا.
     */
    const f = await frameAt(412);
    const row = f.rows[1];
    expect(f.cs(row.el).display).toBe('block');
    expect(f.cs(row.el).gridTemplateColumns === 'none'
      || f.cs(row.el).gridTemplateColumns === '').toBe(true);
    const n = row.el.querySelector('.n');
    expect(f.cs(n).position).toBe('absolute');
    /* إزاحةٌ صغيرة: دون ٦٪ من عرض الصفّ. */
    expect(row.start / row.rb.w < 0.06).toBe(true);
    f.close();
  });

  it('٢ · والجملةُ بلا مادّةٍ لا تحجز شيئًا للتقدّم', async () => {
    /*
     * ⚠️ **هذا هو حارسُ العطب نفسِه.** كان «＋» مخفيًّا بـ`visibility`
     *    فيحجز ٣٢px في أوّل كلّ جملة. والحارسُ لا يسأل «هل يُرى؟» بل
     *    **«هل له صندوق؟»** — وهو السؤالُ الذي لم أسأله.
     */
    const f = await frameAt(412);
    for (const r of f.plain) expect(r.metaW).toBe(0);
    f.close();
  });

  it('٣ · والشارةُ الحقيقيّةُ حاشيةُ سطرٍ أوّلَ لا عمودٌ بكامل الارتفاع', async () => {
    /*
     * بند ٤: «لا كتلةَ تقدّمٍ بكامل ارتفاع الصفّ». فالميتا أقصرُ من
     * نصف ارتفاع النصّ في جملةٍ من ثلاثة أسطر.
     */
    const f = await frameAt(412);
    const draft = f.byState('has-draft');
    expect(draft.lines >= 2).toBe(true);
    expect(draft.metaW > 8).toBe(true);
    expect(draft.metaH * 2 < draft.tb.h).toBe(true);
    f.close();
  });

  it('٤ · ولا عنصرَ آخرَ يقف في عمودٍ يمينَ النصّ', async () => {
    /*
     * بند ٥: لا شيفرون. والقياسُ عامّ: أيُّ عنصرٍ مرئيٍّ في الصفّ
     * يبدأ بعد نهاية صندوق النصّ هو عمودٌ — ولا يُسمح إلّا بالميتا،
     * وهي طافيةٌ **داخل** الصندوق لا بعده.
     */
    const f = await frameAt(412);
    for (const r of f.rows) {
      const intruders = [...r.el.children].filter((c) => {
        if (f.cs(c).display === 'none') return false;
        const b = c.getBoundingClientRect();
        return b.width > 1 && b.left >= r.tb.r - 1;
      });
      expect(intruders).toHaveLength(0);
    }
    f.close();
  });
});

/* ================================================================== *
 * ب) مسطرةُ قراءةٍ واحدة                                               *
 * ================================================================== */
describe('WS-BG · مسطرةٌ واحدةٌ لكلّ الحالات', () => {
  it('٥ · عرضُ النصّ واحدٌ: عاديّةٌ ومسودّةٌ ومُمارَسةٌ وجارية', async () => {
    /* بندا ٦ و١٩: «لا تضيق جملةٌ لأنّ عليها علامة». */
    const f = await frameAt(412);
    const widths = [...new Set(f.rows.map((r) => r.txW))];
    expect(widths).toHaveLength(1);
    f.close();
  });

  it('٦ · ومبدأُ النصّ واحدٌ: الجملةُ ١ والجملةُ ١٠ والجملةُ ١٢', async () => {
    /* بندا ٣ و١١: رقمُ خانتين لا يزيح النصّ. */
    const f = await frameAt(412);
    const starts = [...new Set(f.rows.map((r) => r.start))];
    expect(starts).toHaveLength(1);
    f.close();
  });

  it('٧ · والنصُّ يأخذ ٩٤٪ فأكثرَ من عرض الصفّ', async () => {
    /*
     * ⚠️ **بند ٧**: العتبةُ مكتوبةٌ رقمًا. وكان القياسُ ٩٣٫٥٪ قبل
     *    التمريرة — أي أنّ هذا الحارسَ كان يسقط بفارقٍ نصفِ نقطة.
     */
    for (const w of [390, 412, 420]) {
      const f = await frameAt(w);
      expect(f.rows[1].txW / f.rows[1].rb.w >= 0.94).toBe(true);
      f.close();
    }
  });

  it('٨ · والسطرُ الثاني فما بعده يستعمل العرضَ كلَّه', async () => {
    /*
     * ⚠️ **بند ١٢**: يُسمح للسطر الأوّلِ وحدَه بانحسارٍ موضعيّ.
     *    فارتفاعُ الطافية دون سطرين — وإلّا انحسر السطرُ الثاني معه.
     */
    const f = await frameAt(412);
    const draft = f.byState('has-draft');
    const lh = parseFloat(f.cs(draft.el.querySelector('[data-line-text]')).lineHeight);
    expect(draft.metaH < lh * 2).toBe(true);

    /*
     * ⚠️ **والقياسُ على صندوق الطافية لا على مكان انكسار الكلمات.**
     *
     *    كتبتُ أوّلًا «فجوةُ السطر الثاني أصغرُ من فجوة الأوّل» فسقط
     *    الحارس — لا لأنّ الانحسارَ امتدّ، بل لأنّ السطرَ الثاني في
     *    هذه الجملة بعينها ينتهي عند كلمةٍ طويلة. **ذاك حظُّ كلماتٍ
     *    لا هندسة.**
     *
     *    والثابتُ الحقيقيُّ أنّ **صندوقَ الهامش للطافية ينتهي قبل
     *    السطر الثاني** — فلا شيءَ يزيح ما بعده مهما كان النصّ.
     */
    const meta = draft.el.querySelector('.meta');
    const mcs = f.cs(meta);
    const mb = meta.getBoundingClientRect();
    const floatBottom = mb.bottom + parseFloat(mcs.marginBlockEnd || '0');
    const secondLineTop = (() => {
      const el = draft.el.querySelector('[data-line-text]');
      const range = f.doc.createRange();
      range.selectNodeContents(el);
      const tops = [...new Set([...range.getClientRects()]
        .filter((r) => r.width > 1).map((r) => Math.round(r.top)))].sort((a, b) => a - b);
      return tops[1];
    })();
    expect(floatBottom <= secondLineTop + 2).toBe(true);
    f.close();
  });

  it('٩ · ولا فيضَ أفقيٌّ من ٣٦٠ إلى ٤٢٠', async () => {
    for (const w of [360, 390, 412, 420]) {
      const f = await frameAt(w);
      expect(f.host.scrollWidth <= f.host.clientWidth + 1).toBe(true);
      for (const r of f.rows) expect(r.tb.r <= r.rb.r + 1).toBe(true);
      f.close();
    }
  });

  it('١٠ · ورقمُ ثلاثِ خاناتٍ لا يركب النصَّ ولا يخرج من القائمة', async () => {
    /*
     * ⚠️ **عطبٌ قائمٌ قبل هذه التمريرة**: الهامشُ ١٩px ورقمُ «١٠٠»
     *    ٢١٫٨px بخطّ الأرقام — فكان يركب أوّلَ الحروف في أيّ جلسةٍ
     *    تتجاوز مئةَ جملة. وCSS لا تعرف عددَ الجُمَل، والرسمُ يعرفه.
     */
    const f = await frameAt(412, { wide: true });
    const row = f.rows[1];
    const n = row.el.querySelector('.n');
    n.textContent = '140';
    await new Promise((r) => requestAnimationFrame(r));
    const nb = n.getBoundingClientRect();
    expect(nb.right <= row.tb.l + 1).toBe(true);
    expect(nb.left >= f.host.getBoundingClientRect().left - 1).toBe(true);
    f.close();
  });
});

/* ================================================================== *
 * ج) الفواصلُ والحالاتُ والوظائف                                        *
 * ================================================================== */
describe('WS-BG · فاصلٌ تحريريٌّ لا إطارُ بطاقة', () => {
  it('١١ · فاصلٌ رفيعٌ بين الجُمَل يبدأ من مبدأ النصّ', async () => {
    /*
     * ⚠️ **بند ٨ — وحذفُه في WS-BK كان خطئي.** الفاصلُ بالعرض الكامل
     *    يصنع جدولًا؛ والفاصلُ المُزاحُ إلى مبدأ النصّ فاصلُ تحرير.
     *    فالخطأُ كان في امتداده لا في وجوده.
     */
    const f = await frameAt(412);
    const row = f.rows[1];
    const after = f.win.getComputedStyle(row.el, '::after');
    expect(after.content === 'none').toBe(false);
    const h = parseFloat(after.blockSize);
    expect(h > 0).toBe(true);
    expect(h <= 1.5).toBe(true);
    /* مُزاحٌ من البداية بمقدار الهامش، وممتدٌّ إلى حافّة القراءة. */
    const inset = parseFloat(after.insetInlineStart);
    expect(inset > 8).toBe(true);
    expect(Math.abs(inset - row.start) <= 3).toBe(true);
    expect(parseFloat(after.insetInlineEnd) <= 2).toBe(true);
    f.close();
  });

  it('١٢ · ولا إطارَ بطاقةٍ حول الجملة', async () => {
    /* بند ٩: لا حوافَّ دائريّةً ولا حدودَ صندوقٍ ولا خلفيّاتٍ عامّة. */
    const f = await frameAt(412);
    for (const r of f.plain) {
      expect(parseFloat(f.cs(r.el).borderRadius)).toBe(0);
      expect(parseFloat(f.cs(r.el).borderBottomWidth)).toBe(0);
      expect(f.cs(r.el).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    }
    f.close();
  });

  it('١٣ · والجاريةُ تُعرَف بلا تغيير عرضٍ ولا إطار', async () => {
    /* بند ١٠. */
    const f = await frameAt(412);
    const cur = f.byState('current');
    expect(cur.txW).toBe(f.plain[0].txW);
    expect(cur.start).toBe(f.plain[0].start);
    expect(parseFloat(f.cs(cur.el).borderRadius)).toBe(0);
    /* تُعرَف بشيءٍ ما: غَسْلةٌ أو علامةُ هامش. */
    const marked = f.cs(cur.el).backgroundColor !== 'rgba(0, 0, 0, 0)'
      || f.cs(cur.el).boxShadow.includes('inset');
    expect(marked).toBe(true);
    f.close();
  });

  it('١٤ · وبابُ التعلّم يظهر على الجارية وحدَها', async () => {
    /* بند ٤ب: «التقدّمُ يظهر باللمس/الاختيار». */
    const f = await frameAt(412);
    const cur = f.byState('current');
    const add = cur.el.querySelector('.sh-line-learn.is-add');
    expect(f.cs(add).display === 'none').toBe(false);
    expect(add.getBoundingClientRect().width > 4).toBe(true);
    for (const r of f.plain) {
      const a = r.el.querySelector('.sh-line-learn.is-add');
      expect(f.cs(a).display).toBe('none');
    }
    f.close();
  });

  it('١٥ · والشاراتُ الحقيقيّةُ ومكبّرُ الصوت باقيةٌ ومرسومة', async () => {
    /* بنود ٧ و٨ من قائمة الحرّاس. */
    const f = await frameAt(412);
    const prac = f.byState('practiced');
    expect(prac.el.querySelector('.reps').getBoundingClientRect().width > 8).toBe(true);
    const draft = f.byState('has-draft');
    expect(draft.el.querySelector('.sh-line-learn.is-on').getBoundingClientRect().width > 8).toBe(true);
    const spk = f.byState('current').el.querySelector('.spk');
    expect(f.cs(spk).display === 'none').toBe(false);
    f.close();
  });

  it('١٦ · والنصُّ المتّصلُ سليمٌ بلا صناديقَ ولا شارات', async () => {
    /* بند ١٧. */
    const f = await frameAt(412, { flow: true });
    expect(f.doc.querySelectorAll('.sh-line')).toHaveLength(0);
    expect(f.doc.querySelectorAll('.sh-flow-s .meta, .sh-flow-s .reps')).toHaveLength(0);
    expect([...f.doc.querySelectorAll('.sh-flow-s')].every((e) => e.lang === 'ru')).toBe(true);
    expect([...f.doc.querySelectorAll('.sh-flow-s')].every((e) => e.dataset.line)).toBe(true);
    expect(f.host.scrollWidth <= f.host.clientWidth + 1).toBe(true);
    f.close();
  });
});

/* ================================================================== *
 * د) اللوحُ والمصدر                                                    *
 * ================================================================== */
describe('WS-BG · الهاتفُ وحدَه تغيّر', () => {
  it('١٧ · على اللوح يبقى الصفُّ مرنًا بخلفيّته وبلا فاصلٍ مُزاح', async () => {
    /* بند ١٨: لا تُغيَّر هندسةُ اللوح بلا داعٍ. */
    const f = await frameAt(1100);
    const row = f.rows[1];
    expect(f.cs(row.el).display).toBe('flex');
    expect(f.cs(row.el).backgroundColor === 'rgba(0, 0, 0, 0)').toBe(false);
    expect(f.win.getComputedStyle(row.el, '::after').content).toBe('none');
    /* و«＋» هناك كما كانت: مخفيّةُ الحبر، محجوزةُ الصندوق. */
    const add = row.el.querySelector('.sh-line-learn.is-add');
    expect(f.cs(add).display === 'none').toBe(false);
    f.close();
  });

  it('١٨ · وخانةُ الأرقام الطويلة تأتي من الرسم لا من التخمين', async () => {
    const src = await view();
    const at = src.indexOf('class="sh-lines"');
    const block = src.slice(at - 400, at + 400);
    expect(block).toContain('data-wide-n');
    expect(/segments\.length\s*>=\s*100/.test(block)).toBe(true);
  });

  it('١٩ · وإطارُ القياس يستعمل أصنافَ الراسم نفسِه', async () => {
    /*
     * ⚠️ وإلّا صار القياسُ يقيس متحفًا: كلُّ صنفٍ في الإطار أعلاه
     *    مكتوبٌ في `lineHtml` أو `learnBadgeHtml` فعلًا.
     */
    const src = await view();
    const at = src.indexOf('function lineHtml(');
    const line = src.slice(at, src.indexOf('\n}', at));
    for (const cls of ['class="n"', 'class="meta"', 'class="tx"', 'class="reps"',
      'class="spk"', 'sh-line-pick']) {
      expect(line).toContain(cls);
    }
    const bat = src.indexOf('function learnBadgeHtml(');
    const badge = src.slice(bat, src.indexOf('\n}\n', bat));
    expect(badge).toContain('sh-line-learn is-add');
    expect(badge).toContain('sh-line-learn is-on');
  });
});

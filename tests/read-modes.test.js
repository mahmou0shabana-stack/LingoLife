/**
 * LingoLife — كثافةُ صفحة النصّ ووضعا القراءة (WS-TD)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — على ١٢٨٠×٨٠٠
 * ═══════════════════════════════════════════════════════════════
 *
 *     الصفحةُ اليسرى        ٦٤٦px
 *     ما فوق القائمة        ٣٢٢px   ← نصفُ الصفحة
 *     ما تحتها              ٤١px
 *     القائمةُ نفسُها        ٢٣٩px   ← ٣٧٪ فقط
 *     صفٌّ واحد             ٦٦px
 *     نصُّ الجملة            ٤٢٧ من ٥٧٦
 *     الميتا                ٨٧px  («＋ 00:00 🔊»)
 *     صفوفٌ تُرى            ٤ من ٢٠
 *
 * أي أنّ الشاشةَ التي جئتَ إليها لتقرأ الروسيّةَ تُنفق أكثرَها على ما
 * حولها. وربعُ عرض السطر يذهب لرقمٍ زمنيٍّ لا يُقرأ.
 *
 * ⚠️ **وأكثرُ ما يُحرَس هنا سلبيّ**: ألّا يعود عمودُ الزمن، وألّا
 *    يتحوّل النصُّ المتّصلُ إلى صناديق، وألّا تسقط هُويّةُ الجملة.
 */

import { describe, it, expect } from './test-runner.js';
import { READ_MODE } from '../js/services/reference-service.js';

let VIEW = '';
let CSS = '';
const view = async () => {
  if (!VIEW) VIEW = await (await fetch('../js/views/shadow-view.js')).text();
  return VIEW;
};
const css = async () => {
  if (!CSS) CSS = await (await fetch('../css/shadow.css')).text();
  return CSS;
};
const rule = (text, sel) => {
  const at = text.indexOf(`\n${sel} {`);
  return at < 0 ? '' : text.slice(at, text.indexOf('}', at) + 1);
};

/* ================================================================== *
 * أ) الوضعان                                                          *
 * ================================================================== */
describe('WS-TD · وضعان لنفس المقاطع', () => {
  it('١ · وضعُ القراءة قيمةٌ محفوظةٌ في حالة الورشة — لا مخزنٌ جديد', async () => {
    /*
     * ⚠️ **بند ١٤ حرفيًّا**: «لا تُضف ترقيةَ مخطَّطٍ لأجل هذا إن كانت
     *    حالةُ الواجهة تكفي». و`readView` تدمج المحفوظَ فوق الافتراضيّ،
     *    فحالةٌ كُتبت قبل هذه التمريرة تقرأ `lines` بلا هجرة.
     */
    expect(READ_MODE.LINES).toBe('lines');
    expect(READ_MODE.FLOW).toBe('flow');
    const ref = await (await fetch('../js/services/reference-service.js')).text();
    expect(ref).toContain('read: READ_MODE.LINES');
    /* ولا مخزنَ ولا فهرسَ جديد. */
    expect(ref.includes('createObjectStore')).toBe(false);
  });

  it('٢ · والمبدّلُ بكلمتين واضحتين في رأسٍ قائم', async () => {
    const src = await view();
    expect(src).toContain('data-sh="read-mode" data-v="lines"');
    expect(src).toContain('data-sh="read-mode" data-v="flow"');
    expect(src).toContain('>جمل<');
    expect(src).toContain('>نص كامل<');
    /*
     * ⚠️ **ولا صفَّ جديدٌ لأجله**: التمريرةُ تُقلّل الارتفاعَ لا تزيده،
     *    فالمبدّلُ داخل رأس النصّ القائم لا فوقه ولا تحته.
     *
     * ⚠️ **وأوّلُ صياغةٍ قاست نثرًا لا كودًا**: اشترطت ألّا ترد
     *    «RU → AR» في الملفّ — فسقطت على **تعليقي أنا** الذي يشرح
     *    أنّها أُزيلت. وهي ثاني مرّةٍ أقع فيها على هذا في تمريرتين.
     *    فالمقياسُ صار على الرسم: المبدّلُ داخل الرأس.
     */
    const at = src.indexOf('class="sh-sec-head sh-read-head"');
    expect(at > 0).toBe(true);
    const head = src.slice(at, src.indexOf('</div>', at));
    expect(head).toContain('data-sh="read-mode"');
    expect(head.includes('RU → AR')).toBe(false);
  });

  it('٣ · وحاويةٌ واحدةٌ لرسمين — فلا وسمَ فهرسٍ مكرَّر', async () => {
    const src = await view();
    /*
     * ⚠️ **لو عاش الرسمان معًا لَتكرّرت وسومُ data-line**، فيصير
     *    `querySelector('[data-line="3"]')` يُصيب أحدَهما بالصدفة —
     *    وكلُّ ما يقرأ السطرَ بالفهرس (التمرير · الشارة · الإبراز)
     *    يخطئ صامتًا. فالمعروضُ واحدٌ دائمًا.
     */
    const at = src.indexOf('function paintLines()');
    const body = src.slice(at, src.indexOf('\n}', at));
    expect(body).toContain("host.classList.toggle('is-flow'");
    expect(body).toContain('host.innerHTML =');
    expect(body).toContain('flowHtml(rows, at)');
    expect(body).toContain('lineHtml(seg, i, i === at)');
  });

  it('٤ · ولا يُقرأ من القاعدة ولا يُبنى مصدرٌ ثانٍ عند التبديل', async () => {
    const src = await view();
    const at = src.indexOf('function paintLines()');
    const body = src.slice(at, src.indexOf('\n}', at));
    for (const bad of ['await ', 'loadSession', 'createSession', 'renderShadow']) {
      expect(body.includes(bad)).toBe(false);
    }
  });

  it('٥ · ومقاطعُ التدريب المؤقّتةُ لا تتسلّل إلى قائمة المصدر', async () => {
    const src = await view();
    /*
     * ⚠️ `enterTempSource` **تُلحِق** وحداتِ التدريب بـ`ctx.segments`
     *    ولا تُعيد رسمَ القائمة. فلو رسم المبدّلُ من `ctx.segments` وأنت
     *    داخل تدريبٍ لَظهرت ستَّ عشرةَ وحدةً فجأةً في قائمة السكريبت.
     */
    const at = src.indexOf('function sourceRows()');
    expect(at > 0).toBe(true);
    expect(src.slice(at, at + 200)).toContain('!seg.temporary');
    const paint = src.indexOf('function paintLines()');
    expect(src.slice(paint, paint + 400)).toContain('sourceRows()');
  });
});

/* ================================================================== *
 * ب) الهُويّةُ تنجو من الرسم المتّصل                                     *
 * ================================================================== */
describe('WS-TD · النصُّ متّصلٌ والهُويّةُ باقية', () => {
  it('٦ · كلُّ جملةٍ عنصرٌ يحمل وسمَ فهرسها', async () => {
    const src = await view();
    /*
     * ⚠️ **بند ١٠**: «لا تدمجها في سلسلةٍ بلا هُويّة». والوسمُ هو نفسُه
     *    `data-line` الذي يقرؤه مُعالِجُ اللمس و`syncSegment`
     *    و`refreshDrafted` — فلا بنيةَ اختيارٍ ثانية.
     */
    const at = src.indexOf('function flowHtml(');
    /* ⚠️ الجسمُ إلى آخر الدالّة — و«if (open) out.push» ترد مرّتين. */
    const body = src.slice(at, src.indexOf('\nfunction ', at + 10));
    expect(body).toContain('data-line="${i}"');
    expect(body).toContain('sh-flow-s');
    expect(body).toContain('role="button"');
  });

  it('٧ · وحالُ الجملة تُرى بلا صندوق', async () => {
    const src = await view();
    const at = src.indexOf('function flowHtml(');
    const body = src.slice(at, src.indexOf('\nfunction ', at + 10));
    expect(body).toContain("i === current ? 'current' : ''");
    expect(body).toContain("material.has(i) ? 'has-draft' : ''");
  });

  it('٨ · ولا فقراتٌ مخترَعةٌ — والفاصلُ الوحيدُ مؤلَّف', async () => {
    const src = await view();
    /*
     * ⚠️ **بند ١٢**: «لا تخترع فقراتٍ دلاليّةً ما لم يعطها المصدر».
     *    والمقاطعُ لا تحمل حدودَ فقرات (راجع `createSession`)، فالحدُّ
     *    الوحيدُ المؤلَّفُ فعلًا هو تبدّلُ المتحدّث في المحادثات.
     */
    const at = src.indexOf('function flowHtml(');
    const body = src.slice(at, src.indexOf('\nfunction ', at + 10));
    expect(body).toContain('who !== speaker');
    /* ولا تقسيمٌ بعدد الجمل ولا بالطول. */
    expect(body.includes('% 3')).toBe(false);
    expect(body.includes('.length > 3')).toBe(false);
  });

  it('٩ · ⚠️ ولا صناديقُ الجُمَل في النصّ المتّصل', async () => {
    const text = await css();
    /*
     * ⚠️ **هذا هو جوهرُ الوضع** (بند ٨): «لا تعرضه كثلاثين صندوقًا».
     *    فالجملةُ في النصّ المتّصل بلا إطارٍ ولا خلفيّةٍ ثابتة — تُكشَف
     *    باللمس والتحويم وحدَهما.
     */
    const box = rule(text, '.sh-flow-s');
    expect(Boolean(box)).toBe(true);
    expect(box.includes('border:')).toBe(false);
    expect(box.includes('background:')).toBe(false);
    /* والفقرةُ بطولِ سطرٍ مريحٍ لا بعرض الورقة مهما اتّسع. */
    const para = rule(text, '.sh-flow-p');
    expect(para).toContain('max-inline-size');
    expect(para).toContain('ch');
  });

  it('١٠ · ورقمُ الجملة يُكتشَف ولا يُعرَض دائمًا', async () => {
    const text = await css();
    /*
     * ⚠️ **بند ١٣**: «قد تكون حدودُ الجُمَل قابلةً للاكتشاف». وإظهارُ
     *    رقمٍ بجوار كلّ جملةٍ يُعيد بناءَ القائمة من بابٍ خلفيّ.
     */
    expect(rule(text, '.sh-flow-n')).toContain('display: none');
    expect(text).toContain('.sh-flow-s.current .sh-flow-n { display: inline; }');
  });
});

/* ================================================================== *
 * ج) الكثافة                                                          *
 * ================================================================== */
describe('WS-TD · الزينةُ ضُغطت لا أهدافُ اللمس', () => {
  it('١١ · ⚠️ عمودُ الطابع الزمنيّ خرج من الصفّ', async () => {
    const src = await view();
    /*
     * ⚠️ **بند ٣**: كان `00:00` يحجز عمودًا ثابتًا في كلّ سطرٍ من
     *    عشرين. وقِستُ الميتا ٨٧px والنصَّ ٤٢٧ من ٥٧٦.
     *
     * ⚠️ **ولم يُحذَف من البيانات**: `stamp(index)` كما هي، وتُقرأ في
     *    عنوان السطر لمن يحتاجها — «انقله إلى سياقٍ ثانويّ» لا
     *    «امحُه» (بند ٣ حرفيًّا).
     */
    const at = src.indexOf('function lineHtml(');
    const body = src.slice(at, src.indexOf('\n}', src.indexOf('</button>', at)));
    expect(body.includes('class="ts"')).toBe(false);
    expect(body).toContain('title="${stamp(index)}"');
  });

  it('١٢ · وحشوةُ الصفّ ضُغطت — في القاعدة الغالبة لا العامّة', async () => {
    const text = await css();
    /*
     * ⚠️ **الرقمُ الذي تراه الشاشةُ ليس دائمًا الرقمَ الذي كتبتَه.**
     *    غيّرتُ `.sh-line` العامّة أوّلًا فقِست الصفَّ ٤٢px — تحسّنٌ
     *    حقيقيّ — ثمّ قرأتُ الحشوةَ فوجدتُها ٩/١٠ كما كانت: تخصيصٌ
     *    أدقُّ (`.sh-left .sh-line`) يغلبها. فالقياسُ كشف ما لم يكشفه
     *    الكود.
     */
    expect(text).toContain('.sh-left .sh-line { padding: 6px 8px; }');
  });

  it('١٣ · ⚠️ وأهدافُ اللمس لم تُمَسّ', async () => {
    const text = await css();
    /*
     * ⚠️ **بند ١٧**: «المضغوطُ ليس الصغير». و٤٤px هنا ليست ذوقًا بل
     *    قياسٌ سابق (WS-B · بند ٥٦) وجد أصغرَ هدفٍ في الورشة. فالمضغوطُ
     *    هو الفجواتُ والحشواتُ الزائدة، والأزرارُ كما هي.
     */
    expect(text).toContain('min-height: 44px; padding: 0 11px;');
    expect(text).toContain('.sh-ref .sh-pgbtns button { min-block-size: 44px; }');
    /* والمبدّلُ الجديدُ وذيلُ الصفحة فوق حدّ اللمس المريح. */
    expect(rule(text, '.sh-read-modes button')).toContain('min-block-size: 34px');
    expect(rule(text, '.sh-foot-tabs button')).toContain('min-block-size: 34px');
  });

  it('١٤ · ومقبضُ التقسيم بلا أزراره — لأنّها مكرَّرةٌ فوقه', async () => {
    const text = await css();
    const src = await view();
    /*
     * ⚠️ **ولم يُحذَف تحكُّم**: «◂ SOURCE» و«TRANSCRIPT ▸» يضبطان
     *    `docSize`، وهو نفسُه ما تفعله FIT وFULL و▾ في رأس الورشة على
     *    بُعد سطرين. فأربعةٌ وأربعون بكسلًا كانت تُنفَق على نسخةٍ ثانية.
     *    والسحبُ باقٍ — المقبضُ هو ما يُسحَب لا الأزرار.
     */
    expect(text).toContain('.sh-docsplit button { display: none; }');
    expect(src).toContain('data-sh="doc" data-fit="fit"');
    expect(src).toContain('data-sh="doc" data-fit="full"');
    expect(src).toContain('data-ref-fold');
  });

  it('١٥ · والقائمةُ تأخذ ما بقي — فالضغطُ يذهب إلى النصّ', async () => {
    const text = await css();
    /*
     * ⚠️ لولا هذا لَذهب الموفَّرُ إلى فراغٍ أسفل الصفحة، ولَبقيت
     *    القائمةُ على ارتفاعها — أي ضغطٌ بلا مقابل.
     */
    expect(rule(text, '.sh-lines')).toContain('flex: 1');
    expect(text).toContain('.sh-lines { flex: 1 1 auto; }');
  });
});

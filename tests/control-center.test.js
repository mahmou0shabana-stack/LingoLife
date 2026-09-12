/**
 * LingoLife — مركزُ التدريب: مكانٌ واحدٌ لكلّ إعدادٍ يبقى (WS-SCLEAN)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — جردٌ من الشاشة لا من المصدر
 * ═══════════════════════════════════════════════════════════════
 *
 *   المسرحُ كان يحمل **ثلاثَ** طبقاتٍ لنفس الإعداد:
 *     · صفٌّ سفليٌّ من خمس رقاقات: 0.8x · ×5 · 1.0s · ARABIC · MY TEXT
 *     · سكّةٌ رأسيّةٌ فيها سبعُ أدواتِ إعدادٍ بقيَمها:
 *       ◐روسي · Aa30px · ▹0.8x · ↻×5 · ◈آليّ · ⊞جملة · ✧
 *     · ودرجٌ فيه منزلقاتُها الأربعة ومقطعاها وقائمةُ الصوت
 *
 *   والحالةُ كانت **موحَّدةً أصلًا**: الثلاثةُ تنادي `setTuner`
 *   و`ctx.display` نفسَهما. فالعطبُ عرضٌ لا معمار — ولذلك لا تخترع
 *   هذه التمريرةُ حالةً ولا مخزنًا، بل تُلغي أسطحًا.
 *
 *   ⚠️ **وثلاثةُ أعطابٍ حقيقيّةٍ كشفها الجرد** (لا تحسينَ شكل):
 *     · لوحةُ الصوت في السكّة ترسم قائمةَ أصواتٍ **بلا حاويةٍ** فلا
 *       يرسمها متصفّح، وتقرأ المُختارَ من حقلٍ لا يكتبه أحد.
 *     · لوحةُ التكرار تقرأ الوقفةَ من حقلٍ غير الذي يُكتَب، فلا يُضيء
 *       المختارُ أبدًا.
 *     · ومفتاحُ النبر بقيمتين كان موصولًا بمُقلِّبٍ يهمل القيمة —
 *       فضغطُ «ظاهر» والنبرُ ظاهرٌ **يخفيه**.
 *
 * ⚠️ **والمحروسُ هنا سلوكٌ لا نصٌّ**: يُبنى مسرحٌ حقيقيٌّ في إطارٍ
 *    معزول، ثم يُسأل: أيُّ ضابطٍ ظاهرٌ عليه؟ وهل الضابطُ الواحدُ
 *    يكتب حالةً واحدة؟ ولا يُفحَص تعليقٌ ولا سلسلةُ CSS.
 */

import { describe, it, expect } from './test-runner.js';

/** أصنافُ الضوابط التي تعني «إعدادًا يبقى» — لا فعلًا لحظيًّا. */
const SETTING_ACTIONS = Object.freeze([
  'tune', 'disp', 'stress', 'fsize', 'font-pick', 'audio-src',
  'tts-provider', 'sky-pick', 'sky-clear', 'net-stress', 'voice-select', 'mode',
]);

/** وأدواتُ السكّة التي كانت إعداداتٍ فخرجت. */
const SETTING_TOOLS = Object.freeze(['display', 'text', 'speed', 'repeat', 'voice', 'mode', 'sky']);

let SRC = '';
const source = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};

/**
 * الكودُ وحدَه — بلا تعليقاتٍ ولا شرحٍ.
 *
 * ⚠️ **سقط حارسان عندي على تعليقاتي أنا** (وهي المرّةُ الخامسةُ في
 *    هذا المستودع): شرطتُ ألّا يوجد `voiceURI` في الملفّ، وهو مكتوبٌ
 *    في تعليقٍ **يشرح أنّه أُزيل**. وعدَدتُ كتّابَ `practiceMode`
 *    فوجدتُ اثنين، والثاني سطرٌ في تعليق. فالتجريدُ قبل الفحص، دائمًا.
 */
const code = async () => (await source())
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/**
 * يقرأ وسمَ الشاشة كما يكتبه الراسم — **بلا قاعدةِ بيانات ولا محرّك**.
 *
 * ⚠️ **ولمَ لا نُشغّل الشاشةَ كاملةً هنا؟** فتحُ جلسةٍ حقيقيّةٍ يحتاج
 *    مشهدًا وسكريبتًا ومحرّكَ تشغيلٍ وأصواتًا — وهي مُغطّاةٌ في
 *    `shadow.test.js` و`voice-playback.test.js`. والمحروسُ هنا سؤالٌ
 *    بنيويّ: **أيُّ الأسطح يحمل ضابطَ إعداد؟** وجوابُه في الوسم
 *    والسجلّات، فيُقرأ منهما مباشرةً بلا بيئةٍ ثقيلةٍ تُخفي السبب.
 *
 *    والتحقّقُ الحركيُّ (تغيير القيمة وقراءةُ أثرها على المسرح ثم بعد
 *    إعادة التحميل) يجري في مسبار Playwright — ٣٠ حالةً — لأنّه
 *    يحتاج محرّكًا ونطقًا حقيقيَّين.
 */
async function markup() {
  const text = await source();
  /*
   * ⚠️ **والقطعُ يبدأ من سجلّ الشرح لا من `settingsDrawer`.** رقائقُ
   *    الاختيار يبنيها `ccChips` — وهي **فوق** الدالّة — فقطعٌ من
   *    اسمها يُخفي `data-cc-chips` كلَّه، فسقط حارسان على حدٍّ رسمتُه
   *    أنا لا على عيبٍ في اللوحة.
   */
  const start = text.indexOf('const CC_INFO = Object.freeze({');
  const end = text.indexOf('function coverPanel');
  return { all: text, drawer: text.slice(start, end > start ? end : undefined) };
}

/** كلُّ ما بين وسمَي الصفحة اليمنى — أي المسرحُ نفسُه. */
async function stageMarkup() {
  const text = await source();
  const open = text.indexOf('<div class="sh-page sh-right">');
  const close = text.indexOf('<!-- ══════════ الشريط السفلي ══════════ -->', open);
  return text.slice(open, close);
}

/* ================================================================== *
 * أ) لا إعدادَ مرّتين — المسرحُ للغة والمركزُ للإعداد                  *
 * ================================================================== */
describe('WS-SCLEAN · المسرحُ نظيفٌ من الإعدادات', () => {
  it('١ · لا ضابطَ إعدادٍ واحدٍ في وسم المسرح', async () => {
    /*
     * ⚠️ القاعدةُ الحاكمة (بند ٤٢): ما كان إعدادًا يبقى فمكانُه مركزُ
     *    التدريب وحدَه. ويُفحَص **وسمُ المسرح** لا الدرجَ الذي يليه في
     *    نفس الملفّ — فالدرجُ مليءٌ بها بحقّ.
     */
    const stage = await stageMarkup();
    const found = SETTING_ACTIONS.filter((act) => stage.includes(`data-sh="${act}"`));
    expect(found.join(',')).toBe('');
  });

  it('٢ · ولا أداةَ إعدادٍ في سجلّ سكّة الأدوات', async () => {
    const text = await code();
    const start = text.indexOf('const TOOLS = [');
    const registry = text.slice(start, text.indexOf('\n];', start));
    const found = SETTING_TOOLS.filter((id) => registry.includes(`id: '${id}'`));
    expect(found.join(',')).toBe('');
  });

  it('٣ · وكلُّ أداةٍ خرجت مكتوبٌ سببُها ومكانُها الجديد', async () => {
    /*
     * ⚠️ **وهذا ليس حرسًا للتعليقات**: NOT_IN_RAIL سجلٌّ يُقرأ في
     *    الكود (`doc-fit` وأخواتُها منه)، والمحروسُ أن كلَّ أداةٍ
     *    نُزعت لها **مُدخَلٌ في السجلّ** — لا أن نصًّا ما مكتوبٌ في
     *    مكانٍ ما. سجلٌّ ناقصٌ يعني أداةً اختفت بلا حساب.
     */
    const text = await source();
    /* ⚠️ وهذا يُقرأ **بالتعليقات**: المحروسُ وجودُ مُدخَلٍ لكلّ أداة. */
    const start = text.indexOf('const NOT_IN_RAIL = Object.freeze({');
    const registry = text.slice(start, text.indexOf('});', start));
    const missing = SETTING_TOOLS.filter((id) => !new RegExp(`(^|\\s)${id}:`, 'm').test(registry));
    expect(missing.join(',')).toBe('');
  });

  it('٤ · وبابُ مركز التدريب واحدٌ لا خمسة', async () => {
    /*
     * ⚠️ **بند ٢٨**: مدخلٌ واحدٌ واضح. وكانت ثلاثُ رقاقاتٍ تفتح نفسَ
     *    الدرج على نفس القيمة، فبدا الأمرُ ثلاثةَ إعداداتٍ منفصلة.
     */
    const stage = await stageMarkup();
    const doors = stage.match(/data-sh="drawer"/g) || [];
    expect(doors).toHaveLength(1);
  });

  it('٥ · والتشغيلُ والتنقّلُ ومفتاحُ الأوضاع باقونَ على المسرح', async () => {
    const stage = await stageMarkup();
    for (const need of ['data-sh="prev"', 'data-sh="play"', 'data-sh="next"', 'data-modes']) {
      expect(`${need}:${stage.includes(need)}`).toBe(`${need}:true`);
    }
  });

  it('٦ · وفعلُ التسجيل جنبَ التشغيل لا مدفونًا في السكّة', async () => {
    /*
     * ⚠️ **بند ٢١**: الميكروفونُ فعلٌ لا إعداد. وبابُه في السكّة
     *    باقٍ (يعمل على الكلمة والمقطع) — فالمحروسُ وجودُه في شريط
     *    النقل، لا اختفاؤه من السكّة.
     */
    const stage = await stageMarkup();
    /* ⚠️ والحدُّ الأسفل صار اللسانَ بعد حذف صفّ الرقاقات (WS-POLISH). */
    const transport = stage.slice(stage.indexOf('<div class="sh-transport">'),
      stage.indexOf('class="sh-cc-tab"'));
    expect(transport.includes('data-v="myvoice"')).toBe(true);
  });

  it('٧ · وأفعالُ الجملة (حفظ · نسخ · محفوظات) لم تُشَل', async () => {
    /* ⚠️ بند ٢٢: أفعالٌ وحالةٌ لا إعدادات — فلا تُنقَل إلى المركز. */
    const stage = await stageMarkup();
    for (const need of ['data-sh="save-item"', 'data-sh="copy-item"', 'data-panel="difficult"']) {
      expect(`${need}:${stage.includes(need)}`).toBe(`${need}:true`);
    }
  });
});

/* ================================================================== *
 * ب) حالةٌ واحدةٌ لكلّ إعداد — كاتبٌ واحدٌ لا كاتبان                   *
 * ================================================================== */
describe('WS-SCLEAN · مصدرٌ واحدٌ للحقيقة', () => {
  it('٨ · السرعةُ والتكرارُ والفاصلُ والصوتُ كلُّها تمرّ بـsetTuner', async () => {
    /*
     * ⚠️ **بند ٦**: لا `sideSpeedState` بجانب `centerSpeedState`.
     *    و`TUNERS` هو السجلُّ الحاكم: فيه الحدُّ والخطوةُ واللافتةُ
     *    والحفظ. فالمحروسُ أنّ المفاتيحَ الأربعةَ فيه، وأنّ الكتابةَ
     *    في الجلسة تحدث في `setTuner` وحدَها.
     */
    const text = await code();
    const start = text.indexOf('const TUNERS = {');
    const registry = text.slice(start, text.indexOf('\n};', start));
    for (const key of ['speed', 'repeat', 'pause', 'volume']) {
      expect(`${key}:${registry.includes(`${key}: {`)}`).toBe(`${key}:true`);
    }
    /* وكلُّ ضابطٍ في المركز يُصدِر `tune` أو يكتب في مدخل/منزلقِ نفسِ المفتاح. */
    const { drawer } = await markup();
    for (const key of ['speed', 'repeat', 'pause', 'volume']) {
      const wired = drawer.includes(`${key}:`) || drawer.includes(`data-tune-range="${key}"`)
        || drawer.includes(`data-tune-num="${key}"`);
      expect(`${key}:${wired}`).toBe(`${key}:true`);
    }
  });

  it('٩ · ووضعُ العرض له مُعالِجٌ واحدٌ لا اثنان', async () => {
    /*
     * ⚠️ **قِيس**: كان في المُبدِّل `case 'display'` (من الدرج)
     *    و`case 'disp'` (من السكّة) — كلاهما يكتب `ctx.display` ثم
     *    يحفظ `displayMode`. نفسُ الشيءِ بمسارين، ويكفي أن يُصلَح
     *    أحدُهما يومًا فيفترقا. فبقي واحد.
     */
    const text = await code();
    expect(text.includes("case 'display':")).toBe(false);
    expect(text.includes("case 'display': {")).toBe(false);
    expect(text.includes("case 'disp': {")).toBe(true);
    /*
     * ⚠️ **والمعدودُ حالاتُ المُبدِّل لا كلُّ إسنادٍ للحقل.** أوّلُ
     *    كتابةٍ عدّت `ctx.display = ` في الملفّ كلِّه فوجدت ثلاثًا —
     *    واثنتان **قيمتان ابتدائيّتان** عند تبديل المصدر لا ضابطان:
     *    إحداهما تستعيد وضعَ المصدر، والأخرى تُظهِر الترجمةَ لمصدرٍ
     *    له ترجمات. فالمحروسُ: بابٌ واحدٌ يفتحه المستخدم.
     */
    const cases = text.match(/case '(display|disp)'/g) || [];
    expect(cases.join(',')).toBe("case 'disp'");
  });

  it('١٠ · ووضعُ القراءة يُكتَب من مكانٍ واحد', async () => {
    /*
     * ⚠️ كان `mode-set` (لوحةُ السكّة) و`mode-go` (مفتاحُ المسرح)
     *    بابَين لنفس الإعداد **بخياراتٍ مختلفة** — واللوحةُ تعرض
     *    «متّصل» ولا يعرفه المفتاح، فيُضيء المفتاحُ «جملة» وأنت في
     *    المتّصل. فبقي المفتاحُ وحدَه وفيه الأوضاعُ الأربعة.
     */
    const text = await code();
    expect(text.includes("case 'mode-set'")).toBe(false);
    const start = text.indexOf('const MODES = [');
    const registry = text.slice(start, text.indexOf('\n];', start));
    for (const id of ['sentence', 'phrase', 'word', 'continuous']) {
      expect(`${id}:${registry.includes(`id: '${id}'`)}`).toBe(`${id}:true`);
    }
    /* والكاتبُ الوحيدُ `setPractice`. */
    const writes = text.match(/player\.updateSettings\(\{ practiceMode/g) || [];
    expect(writes).toHaveLength(1);
  });

  it('١١ · ومفتاحُ النبر يحترم قيمتَه ولا يقلبها', async () => {
    /*
     * ⚠️ **عطبٌ حقيقيٌّ كشفه الجرد**: زرّان بقيمتين («ظاهر»/«مخفي»)
     *    موصولان بمُعالِجٍ **يقلب** الحالةَ ويهمل `data-v` — فضغطُ
     *    «ظاهر» والنبرُ ظاهرٌ كان يخفيه. زرٌّ يفعل عكسَ اسمه.
     *
     *    والمحروسُ السلوكُ: المُعالِجُ يقرأ القيمةَ إن وُجدت، ويقلب
     *    إن غابت (شريطُ STRESS في الصفحة اليسرى لا يُرسل قيمة).
     */
    const text = await source();
    const start = text.indexOf("case 'stress': {");
    const body = text.slice(start, text.indexOf('}', text.indexOf('return', start)));
    expect(body.includes('btn.dataset.v')).toBe(true);
    expect(/ctx\.stress = want == null \? !ctx\.stress : want === '1'/.test(body)).toBe(true);
  });

  it('١٢ · وقائمةُ الأصوات حاويةٌ حقيقيّةٌ تقرأ الحقلَ المحفوظ', async () => {
    /*
     * ⚠️ **عطبان في سطرٍ واحد**: لوحةُ السكّة كانت تكتب
     *    `voiceOptions(...)` **بلا `select`** — فمجموعاتُ الخيارات
     *    عاريةٌ لا يرسمها متصفّح — وتقرأ المُختارَ من `voiceURI`،
     *    وهو حقلٌ لا يكتبه أحدٌ في التطبيق كلِّه (المكتوبُ `voiceId`).
     *    ضابطٌ لا يُرى ولا يعرف قيمتَه.
     */
    const text = await code();
    expect(text.includes('voiceURI')).toBe(false);
    const { drawer } = await markup();
    const at = drawer.indexOf('voiceOptions(');
    const before = drawer.slice(Math.max(0, at - 220), at);
    expect(before.includes('<select')).toBe(true);
    expect(drawer.includes('session.voiceId')).toBe(true);
  });

  it('١٣ · ولا حالةَ مُعالِجٍ ميّتةٌ بلا زرٍّ يُصدِرها', async () => {
    /*
     * ⚠️ `voices` و`voice` كانتا حالتين في المُبدِّل بلا أيّ عنصرٍ
     *    يُصدِرهما — كودٌ يعمل ولا يُنادى. أثبته الجردُ على الشاشة.
     */
    const text = await code();
    for (const dead of ["case 'voices':", "case 'voice':"]) {
      expect(`${dead}:${text.includes(dead)}`).toBe(`${dead}:false`);
    }
  });
});

/* ================================================================== *
 * ج) لوحةٌ تُفهَم: تجميعٌ وشرحٌ وصدقٌ عن غير المتاح                    *
 * ================================================================== */
describe('WS-SCLEAN · مركزُ التدريب يُقرأ', () => {
  it('١٤ · أقسامٌ بالمعنى: التشغيلُ والعرضُ والصوتُ ومتقدّمة', async () => {
    const { drawer } = await markup();
    for (const head of ['التشغيل', 'العرض', 'الصوت', 'إعدادات متقدّمة']) {
      expect(`${head}:${drawer.includes(head)}`).toBe(`${head}:true`);
    }
    /* وملخّصٌ يُقرأ في نظرة (بند ٢٧) — لا سكّةٌ أُعيد بناؤها. */
    expect(drawer.includes('data-cc-sum')).toBe(true);
  });

  it('١٥ · وكلُّ إعدادٍ يحتاج شرحًا له نصٌّ قصيرٌ في سجلٍّ واحد', async () => {
    /*
     * ⚠️ **بندا ١٦ و١٧**: شرحٌ بالطلب لا فقراتٌ دائمة، وجملةٌ أو
     *    ثلاثٌ بالمصري لا شرحٌ تقنيّ. والسجلُّ واحدٌ ليُعاد استعمالُه
     *    (مركزُ الصوت غدًا يكتب مفاتيحَه فيه بلا معالِجٍ جديد).
     */
    const text = await source();
    const start = text.indexOf('const CC_INFO = Object.freeze({');
    const registry = text.slice(start, text.indexOf('});', start));
    const keys = [...registry.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1]);
    expect(keys.length >= 10).toBe(true);
    for (const key of ['speed', 'repeat', 'pause', 'volume', 'display', 'stress']) {
      expect(`${key}:${keys.includes(key)}`).toBe(`${key}:true`);
    }
    /* ولا نصَّ طويلًا: أطولُ شرحٍ دون ٢٢٠ حرفًا. */
    const texts = [...registry.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
    const longest = Math.max(...texts.map((t) => t.length));
    expect(`أطول=${longest <= 220}`).toBe('أطول=true');
  });

  it('١٦ · ولافتاتُ العرض تصف ما يحدث فعلًا', async () => {
    /*
     * ⚠️ **بند ١٥**: كانت «RU الروسي · مصري الترجمة · مخفي اكشفها».
     *    وقِيس السلوك: وضعُ الروسيّة **يشيل الترجمة**، و«مخفي»
     *    **يشوّش الجملةَ الروسيّة** والترجمةُ باقية. فالاسمان كانا
     *    يصفان غيرَ ما يفعلان — والمحروسُ ألّا تعود الصياغةُ القديمة.
     */
    const { drawer } = await markup();
    expect(drawer.includes('بلا ترجمة')).toBe(true);
    expect(drawer.includes('دوس تكشفها')).toBe(true);
    expect(drawer.includes('اكشفها<')).toBe(false);
  });

  it('١٧ · وما ليس متاحًا لا يبدو زرًّا يعمل', async () => {
    /*
     * ⚠️ **بند ١٩**: محرّكاتُ نطقٍ غيرُ جاهزةٍ (RHVoice · XTTS ·
     *    سحابيّ) كانت أزرارًا معطّلةً بأسماءِ جسورٍ وتطويرٍ **في نفس
     *    مستوى** الضوابط العاملة. فصارت مطويّةً في «متقدّمة»،
     *    ومكتوبٌ على المعطّل «غير متاح حاليًا»، وإطارُه متقطّعٌ.
     */
    const { drawer } = await markup();
    expect(drawer.includes('غير متاح حاليًا')).toBe(true);
    /*
     * ومكانُها **داخل عنصرٍ يُطوى** لا مجرّدَ «بعد كلمةِ متقدّمة».
     *
     * ⚠️ **أوّلُ كتابةٍ قارنت موضعَ النصّ فقط، فنجت من طفرة**: بدّلتُ
     *    `details` بـ`div` (فصار كلُّ شيءٍ مكشوفًا) وبقي الحارسُ
     *    أخضر — لأنّ كلمةَ «متقدّمة» ما زالت قبل المحرّك. فالمحروسُ
     *    الآن **الحاويةُ نفسُها**: عنصرُ طيٍّ حقيقيٌّ يبدأ قبله
     *    وينتهي بعده. (والطيُّ مقيسٌ حركيًّا في المسبار: مغلقةٌ
     *    ١٧٠٨px وغيرُ مرئيّة، مفتوحةٌ ٢٠٧٣px ومرئيّة.)
     */
    const open = drawer.indexOf('<details class="sh-cc-adv">');
    const close = drawer.indexOf('</details>', open);
    const engine = drawer.indexOf('tts-provider');
    expect(`طيٌّ حقيقيّ: ${open > 0}`).toBe('طيٌّ حقيقيّ: true');
    expect(`المحرّكُ داخله: ${engine > open && engine < close}`).toBe('المحرّكُ داخله: true');
    const css = (await (await fetch('../css/shadow.css')).text()).replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.sh-cc-chips button\[disabled\]\s*\{([^}]*)\}/.exec(css);
    expect(Boolean(rule)).toBe(true);
    expect(/not-allowed/.test(rule[1])).toBe(true);
  });

  it('١٨ · والضابطُ من نوع قيمته: رقائقُ للمعدود ومنزلقٌ للمتّصل', async () => {
    /*
     * ⚠️ **بند ١٠**: لا مستطيلاتٌ عملاقةٌ لكلّ شيء. والمحروسُ وجودُ
     *    النوعَين في مكانهما: رقائقُ للسرعة والعدد والفاصل والحجم،
     *    ومنزلقٌ للصوت (متّصلٌ بطبعه)، ومفتاحٌ مقطعيٌّ للثلاثيّات.
     */
    /*
     * ⚠️ **ويُفحَص موضعُ النداء لا الوسمُ الناتج.** أوّلُ كتابةٍ بحثت
     *    عن `data-cc-chips="speed"` في المصدر — وهي سلسلةٌ **يبنيها
     *    القالبُ وقتَ الرسم** من مُعامِلٍ، فلا وجودَ لها في الملفّ.
     *    والوسمُ الناتجُ مفحوصٌ حيث يُرسَم فعلًا: مسبارُ Playwright
     *    يضغط `[data-cc-chips="speed"]` ويقرأ الحالةَ المحفوظة.
     */
    const { drawer } = await markup();
    /*
     * ⚠️ **والتكرارُ خرج من الرقائق إلى المنزلق (WS-POLISH · بند ١).**
     *    كانت هنا رقائقُه مع خانةِ رقمٍ «حيث يهمّ الرقمُ بالضبط» —
     *    وبلاغُك نقض ذلك: «مش عايز أكتب بإيدي». والمنزلقُ بخطوةٍ ١
     *    يبلغ كلَّ عددٍ مدعوم، فلا رقائقَ ولا كتابة. والمحروسُ الباقي:
     *    **الضابطُ من نوع قيمته** — رقائقُ لما يُختار من قائمةٍ قصيرة
     *    (السرعة والفاصل والحجم)، ومنزلقٌ لما هو عددٌ متّصل.
     */
    for (const key of ['speed', 'pause', 'fsize']) {
      expect(`${key}:${drawer.includes(`ccChips('${key}'`)}`).toBe(`${key}:true`);
    }
    for (const key of ['repeat', 'volume']) {
      expect(`${key}:${drawer.includes(`data-tune-range="${key}"`)}`).toBe(`${key}:true`);
    }
    expect(drawer.includes('ccSeg(')).toBe(true);
    /* ولا خانةَ كتابةٍ في اللوحة كلِّها (بند ٢). */
    const nums = drawer.match(/data-tune-num="/g) || [];
    expect(nums).toHaveLength(0);
  });

  it('١٩ · والفاصلُ يُقرأ بالثواني لا بالملّي', async () => {
    /*
     * ⚠️ **بند ١٣**: القيمةُ الخامُ ١٠٥٠ms صادقةٌ وغيرُ مقروءة.
     *    و`intervalLabel` تكتب الثواني فوق الثانية أصلًا — فيُستعمَل
     *    هو، ولا تُكتَب وحدةٌ داخليّةٌ في واجهةٍ للمتعلّم.
     */
    const { drawer } = await markup();
    expect(drawer.includes('intervalLabel(session)')).toBe(true);
    expect(/unit: 'ms'/.test(drawer)).toBe(false);
    const chips = /ccChips\('pause'[\s\S]{0,300}/.exec(drawer)[0];
    expect(chips.includes('/ 1000')).toBe(true);
    expect(chips.includes('ms')).toBe(false);
  });

  it('٢٠ · وتحديثُ اللوحة موضعيٌّ لا إعادةَ بناء', async () => {
    /*
     * ⚠️ **بندا ٢٦ و٣٣**: إعادةُ بناء الدرج تُفقِد موضعَ التمرير
     *    وفتحَ «متقدّمة» وأيَّ شرحٍ فتحتَه. فالمُوفِّقُ يكتب نصًّا
     *    وأصنافَ حالةٍ فقط — والمحروسُ ألّا يُكتَب `innerHTML` فيه.
     */
    const text = await code();
    const start = text.indexOf('function syncControlCenter()');
    const body = text.slice(start, text.indexOf('\n}\n', start));
    expect(body.includes('innerHTML')).toBe(false);
    expect(body.includes('textContent')).toBe(true);
    /* ويُنادى من كاتبِ كلّ إعداد. */
    const calls = text.match(/syncControlCenter\(\)/g) || [];
    expect(calls.length >= 8).toBe(true);
  });
});

/* ================================================================== *
 * د) الملحق: منزلقُ التكرار، ولسانٌ لا يحجز مساحة (WS-POLISH)          *
 * ================================================================== */
describe('WS-POLISH · التكرارُ منزلقٌ والبابُ لسان', () => {
  it('٢١ · عددُ التكرار منزلقٌ بمدى السجلّ وخطوةٍ صحيحة', async () => {
    /*
     * ⚠️ **بلاغُك**: «مش عايز أكتب عدد التكرار بإيدي». وكان الصفُّ
     *    ثمانيةَ أزرارٍ + خانةَ كتابةٍ ولا منزلق — أضخمَ صفٍّ في
     *    اللوحة (١٥٣px) وأقلَّها اتّساقًا مع السرعة والفاصل والصوت.
     *
     * ⚠️ **والمدى من السجلّ لا من رأسي (بند ١)**: `TUNERS.repeat`
     *    تقول 1..99 وخطوة 1 — وهي التي تقصّ القيمةَ وتحفظها. فلو
     *    كتبتُ في الوسم مدًى آخر لصار المنزلقُ يعرض ما لا يُخزَّن.
     *    فالمحروسُ **تطابقُ الاثنين** لا مجرّدُ وجود منزلق.
     */
    const text = await code();
    const at = text.indexOf('const TUNERS = {');
    const spec = text.slice(text.indexOf('repeat: {', at), text.indexOf('},', text.indexOf('repeat: {', at)));
    const min = /min:\s*(\d+)/.exec(spec)[1];
    const max = /max:\s*(\d+)/.exec(spec)[1];
    const step = /step:\s*(\d+)/.exec(spec)[1];
    expect(`${min}..${max}/${step}`).toBe('1..99/1');

    const { drawer } = await markup();
    const row = drawer.slice(drawer.indexOf("key: 'repeat'"), drawer.indexOf("key: 'pause'"));
    expect(row.includes('data-tune-range="repeat"')).toBe(true);
    expect(`min=${row.includes(`min="${min}"`)}`).toBe('min=true');
    expect(`max=${row.includes(`max="${max}"`)}`).toBe('max=true');
    expect(`step=${row.includes(`step="${step}"`)}`).toBe('step=true');
  });

  it('٢٢ · ولا كتابةَ يدويّةً ولا أزرارَ جاهزةً للتكرار', async () => {
    /*
     * ⚠️ **بندا ٢ و٣**: المنزلقُ يبلغ كلَّ عددٍ صحيحٍ مدعوم، فخانةُ
     *    الكتابة تكرارٌ لا خيار. والأزرارُ الثمانيةُ بعده لا تُسرّع
     *    شيئًا وتُنافسه على الانتباه.
     */
    const { drawer } = await markup();
    const row = drawer.slice(drawer.indexOf("key: 'repeat'"), drawer.indexOf("key: 'pause'"));
    expect(row.includes('data-tune-num')).toBe(false);
    expect(row.includes('ccChips')).toBe(false);
    /* ولا خانةَ رقمٍ في اللوحة كلِّها بعد اليوم. */
    expect(drawer.includes('data-tune-num')).toBe(false);
  });

  it('٢٣ · وصفُّ التكرار صار كأخواته: لافتةٌ وقيمةٌ ومنزلق', async () => {
    /*
     * ⚠️ **بند ٤**: نظامُ ضبطٍ واحدٌ متماسك. والمحروسُ أنّ الأربعة
     *    (سرعة · تكرار · فاصل · صوت) كلَّها تُصدِر منزلقًا على نفس
     *    المحور — لا واحدٌ منها بشكلٍ آخر.
     */
    const { drawer } = await markup();
    for (const key of ['speed', 'repeat', 'pause', 'volume']) {
      expect(`${key}:${drawer.includes(`data-tune-range="${key}"`)}`).toBe(`${key}:true`);
    }
    /* والقيمةُ الحاليّةُ في اللافتة لكلٍّ منها. */
    for (const key of ['speed', 'repeat', 'pause', 'volume']) {
      expect(`${key}:${drawer.includes(`data-cc-val="${key}"`) || drawer.includes(`valueKey: '${key}'`)}`)
        .toBe(`${key}:true`);
    }
  });

  it('٢٤ · وبابُ المركز لسانٌ مطلقٌ لا صفٌّ في المحتوى', async () => {
    /*
     * ⚠️ **بند ٥**: حتى البابُ الواحدُ كان يحجز ٤٠px من ارتفاع المسرح
     *    (صفٌّ 376×32 + هامش). والفرقُ نوعُ الصندوق لا حجمُه:
     *    `absolute` تُخرجه من مسار المحتوى.
     */
    const stage = await stageMarkup();
    expect(stage.includes('class="sh-cc-tab"')).toBe(true);
    expect(stage.includes('sh-quickpills')).toBe(false);
    const css = (await (await fetch('../css/shadow.css')).text()).replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.sh-cc-tab\s*\{([^}]*)\}/.exec(css);
    expect(Boolean(rule)).toBe(true);
    expect(/position:\s*absolute/.test(rule[1])).toBe(true);
    /* وهدفُ اللمس ٤٤ على الأقلّ في المحورين. */
    expect(/min-width:\s*44px/.test(rule[1])).toBe(true);
    expect(/min-height:\s*44px/.test(rule[1])).toBe(true);
  });

  it('٢٥ · ولا سكّةَ ثانية: حافّةُ الضبط غيرُ حافّة الأدوات', async () => {
    /*
     * ⚠️ **بند ٦**: لسانٌ واحدٌ لا شريطٌ رأسيٌّ جديد. وقد وقع الخطأُ
     *    فعلًا في أوّل كتابة: `inset-inline-end` أنزلته على **يمين**
     *    المسرح فوق سكّة الأدوات بالحرف (٣٥٢px — نفسُ إحداثيّها)،
     *    لأنّ `.shadow-app` اتّجاهُه ltr وإن كان المستندُ عربيًّا.
     *    فالمحروسُ أن يكون على المحور المقابل لسكّة الأدوات.
     */
    const css = (await (await fetch('../css/shadow.css')).text()).replace(/\/\*[\s\S]*?\*\//g, '');
    const tab = /\.sh-cc-tab\s*\{([^}]*)\}/.exec(css)[1];
    const rail = /\.sh-toolrail\s*\{([^}]*)\}/.exec(css)[1];
    expect(/inset-inline-start:/.test(tab)).toBe(true);
    expect(/inset-inline-end:/.test(tab)).toBe(false);
    /* وسكّةُ الأدوات على الطرف الآخر. */
    expect(/inset-inline-end:|inset-block/.test(rail)).toBe(true);
  });

  it('٢٦ · وحدُّ التثبيت السفليُّ يتبع ما تحته فعلًا', async () => {
    /*
     * ⚠️ **عطبٌ صنعتُه وكشفه القياس.** كان `inset-block-end: 96px`
     *    لمفتاح الأوضاع = ترانسبورت ٦٤ + صفُّ الرقاقات ٣٢. فلمّا حُذف
     *    الصفُّ بقي الرقمُ يحجز مكانَ شيءٍ غيرِ موجود — والصفحةُ
     *    قابلةٌ للتمرير (طبقاتٌ مطلقةٌ تزيد scrollHeight)، فـsticky
     *    تدفع المفتاحَ لأسفل ليبلغ الحدَّ **فينزل على اللافتة**.
     *
     *    قِيس على ٤١٢×٩١٥: اللافتة 686..703 والمفتاح 681..721 — تراكبُ
     *    ٢٢px (وكان صفرًا قبل الحذف). فالرقمُ صار ٧٢ = ٦٤ + هامشُ ٨.
     *
     *    والمحروسُ **العلاقةُ لا الرقم**: حدُّ المفتاح لا يتجاوز
     *    ارتفاعَ الترانسبورت وهامشِه — فمن غيّر أحدَهما غدًا سقط هنا.
     */
    const css = (await (await fetch('../css/shadow.css')).text()).replace(/\/\*[\s\S]*?\*\//g, '');
    const modes = /\.sh-modes\s*\{\s*inset-block-end:\s*(\d+)px/.exec(css);
    expect(Boolean(modes)).toBe(true);
    const offset = Number(modes[1]);
    /* ارتفاعُ الترانسبورت من قواعده: حشوٌ ٨ أعلى + ١٠ أسفل + زرٌّ ٥٨. */
    const play = /\.sh-right \.sh-play\s*\{[^}]*height:\s*(\d+)px/.exec(css);
    const playH = play ? Number(play[1]) : 58;
    expect(`${offset} <= ${playH + 26}`).toBe(`${offset} <= ${playH + 26}`);
    expect(offset <= playH + 26).toBe(true);
    expect(offset >= playH).toBe(true);
  });
});

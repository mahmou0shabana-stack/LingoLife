/**
 * WS-DRAFT-SYNC — حرّاسُ صحّةِ التنقّل في المسودّة.
 *
 * ⚠️ **ولماذا حرّاسُ مصدرٍ لا حرّاسُ سلوك؟** `syncSegment` و`renderRail`
 *    و`renderLearn` دوالُّ داخليّةٌ في `shadow-view.js` لا تُصدَّر، والشاشةُ
 *    لا تُركَّب في عدّاء الاختبارات (تحتاج جلسةً وقاعدةً ومحرّكَ نطق).
 *    فهذا هو العرفُ القائمُ في هذا الملفّ لكلّ ما يخصّ هذه الشاشة
 *    (راجع control-center و book-reading). والسلوكُ نفسُه قِيس حيًّا
 *    بمصفوفةِ قبولٍ على ثلاثة مقاسات — والأرقامُ في رسالة الإيداع.
 *
 * ⚠️ **وتُقاس العلاقاتُ لا الحروف**: «هل التصفيرُ مشروطٌ بتبدّل الهُويّة
 *    داخل نفس الكتلة التي تكتب النصّ؟» لا «هل يوجد سطرٌ نصُّه كذا».
 */
import { describe, it, expect } from './test-runner.js';

let SRC = '';
const view = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};

/** جسمُ دالّةٍ من اسمها إلى أوّل سطرٍ يبدأ بقوسٍ مُغلِقٍ في العمود صفر. */
function bodyOf(src, header) {
  const at = src.indexOf(header);
  if (at < 0) return '';
  const end = src.indexOf('\n}', at);
  return end < 0 ? src.slice(at) : src.slice(at, end);
}

describe('WS-DRAFT-SYNC · الجملةُ لقطةٌ واحدة', () => {
  it('١ · النصُّ والنبرُ والموضعُ يلتزمون كتلةً واحدة', async () => {
    /*
     * ⚠️ **العطبُ المقيس**: البطلُ صار مُمرِّرًا بنفسه (WS-HEROSCROLL)،
     *    و`innerHTML` لا يصفّر التمرير. فبعد «التالي» بقي scrollTop = ٤٦
     *    فبدأت الجملةُ الجديدةُ من وسطها وسطرُها الأوّل مخفيّ.
     *
     * والمحروس: أن يقع التصفيرُ **في نفس الكتلة** التي تكتب النصّ، لا في
     * دالّةٍ أخرى قد تُنادى أو لا تُنادى.
     */
    const src = await view();
    const body = bodyOf(src, 'function syncSegment()');
    expect(body.length > 200).toBe(true);
    const writes = /textEl\.innerHTML\s*=/.test(body) && /textEl\.textContent\s*=/.test(body);
    const resets = /textEl\.scrollTop\s*=\s*0/.test(body);
    expect(`يكتب ${writes} · يصفّر ${resets}`).toBe('يكتب true · يصفّر true');
  });

  it('٢ · والتصفيرُ مشروطٌ بتبدّل الهُويّة لا مع كلّ رسم', async () => {
    /*
     * ⚠️ إعادةُ رسمٍ لنفس الجملة (وصولُ نبرٍ من الشبكة مثلًا) يجب ألّا
     *    تخطف موضعَ قراءتك — وإلّا صار الإصلاحُ عطبًا آخر يكسر
     *    WS-HEROSCROLL: تمرّر جملةً طويلةً فيقفز بك إلى أوّلها.
     */
    const src = await view();
    const body = bodyOf(src, 'function syncSegment()');
    const stamped = /textEl\.dataset\.seg\s*=/.test(body);
    const guarded = /if\s*\(\s*fresh\s*\)\s*textEl\.scrollTop\s*=\s*0/.test(body)
      || /textEl\.dataset\.seg\s*!==[\s\S]{0,120}?scrollTop\s*=\s*0/.test(body);
    expect(`مختوم ${stamped} · مشروط ${guarded}`).toBe('مختوم true · مشروط true');
  });

  it('٣ · وحارسُ النبر المتأخّر يقارن هُويّةً لا فهرسًا', async () => {
    /*
     * ⚠️ **الفهرسُ يُعاد استعمالُه في المسودّة**: الدخولُ إلى طقمِ أهدافٍ
     *    يستدعي `dropExternalSource()` ثمّ يُلحِق المقاطعَ الجديدة فتبدأ
     *    من نفس الفهرس الذي تركه الطقمُ السابق. فطلبُ نبرٍ بدأ للهدف أ
     *    يجد `index` كما تركه فيمرّ — وقد صار المعروضُ الهدفَ ب.
     *
     *    والمحروس: ألّا يعود الشرطُ رقمًا.
     */
    const src = await view();
    const body = bodyOf(src, 'function syncSegment()');
    const at = body.indexOf('fetchSentenceStress');
    expect(at > 0).toBe(true);
    const block = body.slice(at, at + 700);
    const byIndex = /player\?\.state\?\.index\s*===\s*at\b/.test(block);
    const byStamp = /nowStamp\s*===\s*at\b/.test(block)
      || /targetId[\s\S]{0,200}===\s*at\b/.test(block);
    expect(`بالفهرس ${byIndex} · بالهُويّة ${byStamp}`).toBe('بالفهرس false · بالهُويّة true');
  });
});

describe('WS-DRAFT-SYNC · لوحُ المسودّة يتبع الهدف', () => {
  it('٤ · موضعُ التمرير يُلتقَط قبل الهدم ويُعاد بعده', async () => {
    /*
     * ⚠️ **العطبُ المقيس** (لوحٌ مفتوحٌ فعلًا، ١٦ هدفًا، ٤١٢×٩١٥):
     *        scrollTop قبل النقلة ٠ وبعدها ٠، والهدفُ الجاري ١١٤٤..١٢٣٣
     *        بينما نافذةُ اللوح ١٤٢..٥٢٩ — تحت الطيّة بـ٦١٥px.
     *    والسبب: `innerHTML` على **حاوية التمرير نفسِها**.
     */
    const src = await view();
    const body = bodyOf(src, 'function renderRail()');
    const order = /panelKeep\s*=\s*body\.scrollTop[\s\S]{0,400}?body\.innerHTML\s*=[\s\S]{0,400}?body\.scrollTop\s*=\s*panelKeep/;
    expect(`يلتقط ثمّ يهدم ثمّ يعيد: ${order.test(body)}`).toBe('يلتقط ثمّ يهدم ثمّ يعيد: true');
  });

  it('٥ · والكشفُ مشروطٌ بتبدّل الهدف وبأقلّ حركة', async () => {
    /*
     * ⚠️ شرطُك الرابع: «لو الهدفُ ظاهرٌ أصلًا لا تحرّك التمرير».
     *    وشرطُك الثامن: «لا تصارع الإصبعَ ما دام الهدفُ لم يتبدّل».
     *    فالكشفُ داخل `activeTargetId !== revealedTargetId`، والحركةُ
     *    فرقٌ محسوبٌ لا `center` ولا `scrollTop = 0`.
     */
    /*
     * ⚠️ **وأُعيد توجيهُه في WS-DFP**: حسابُ «أقلّ حركة» انتقل من جسم
     *    `renderLearn` إلى `revealNow` — لأنّ الكشفَ صار له بابان
     *    (تبدّلُ هدفٍ، وفكُّ تثبيت). والشرطُ نفسُه والحركةُ نفسُها،
     *    فيُقرآن حيث هما الآن. ولو تُرك كما كان لسقط على **انتقالِ
     *    شيفرةٍ لا على انحدارِ سلوك** — وهو أسوأُ ما يفعله حارس.
     */
    const src = await view();
    const body = bodyOf(src, 'async function renderLearn()');
    const reveal = bodyOf(src, 'function revealNow(panelBody)');
    const conditional = /activeTargetId\s*!==\s*revealedTargetId/.test(body);
    const minimal = /box\.top\s*<\s*view\.top[\s\S]{0,400}?box\.bottom\s*>\s*view\.bottom/.test(reveal);
    const noCenter = !/block:\s*'center'/.test(body + reveal);
    expect(`مشروط ${conditional} · أقلُّ حركة ${minimal} · بلا توسيط ${noCenter}`)
      .toBe('مشروط true · أقلُّ حركة true · بلا توسيط true');
  });

  it('٦ · ولا تصفيرَ غيرَ مشروطٍ لتمرير اللوح', async () => {
    /*
     * ⚠️ الحارسُ الذي يمنع عودةَ العطب بحرفه: أيُّ `scrollTop = 0` على
     *    جسم اللوح بلا شرطٍ يُعيد «يرجع لأوّله كلّ مرّة».
     */
    const src = await view();
    const bad = /panelBody\.scrollTop\s*=\s*0|\$\('\[data-panel-body\]'\)\.scrollTop\s*=\s*0/.test(src);
    expect(`تصفيرٌ أعمى: ${bad}`).toBe('تصفيرٌ أعمى: false');
  });
});

/* ================================================================== *
 * WS-DFP — 📌 زرٌّ واحدٌ: يتبع الجملةَ، أو يثبِّت موضعَ قراءتك          *
 * ================================================================== */
describe('WS-DFP · اتباعٌ وتثبيت', () => {
  it('٧ · الافتراضُ اتباعٌ، والحالةُ جلسيّةٌ لا مخزَّنة', async () => {
    /*
     * ⚠️ **ولا إعدادَ دائمٌ ولا مخزنَ جديد**: التثبيتُ قرارُ لحظةِ
     *    قراءةٍ لا تفضيلٌ يُحفَظ. فيُقاس أنّ الرايةَ تبدأ كاذبةً، وأنّها
     *    لا تمرّ بـ`settings` ولا بمستودع.
     */
    const src = await view();
    expect(src).toContain('let pinned = false;');
    const fn = bodyOf(src, 'function togglePin()');
    expect(`يحفظ في الإعدادات: ${/settings\.(set|get)/.test(fn)}`).toBe('يحفظ في الإعدادات: false');
  });

  it('٨ · والكشفُ التلقائيُّ يقف عند التثبيت — ولا شيءَ غيرُه يقف', async () => {
    /*
     * ⚠️ **بندُك: «التثبيتُ يوقف التمريرَ التلقائيَّ وحدَه».** فالهدفُ
     *    يُسجَّل مكشوفًا في الحالتين (وإلّا تراكمت الكشوفُ فقفز اللوحُ
     *    عند الفكّ إلى أوّل هدفٍ مرّ)، والرسمُ والإبرازُ لا يُمَسّان.
     */
    const src = await view();
    const learn = bodyOf(src, 'async function renderLearn()');
    expect(`يُسجّل ثمّ يشترط: ${/revealedTargetId = activeTargetId;[\s\S]{0,120}if \(!pinned\) revealNow/.test(learn)}`)
      .toBe('يُسجّل ثمّ يشترط: true');
    /* ولا تجميدَ للتمرير اليدويّ: لا overflow ولا منعُ حدث. */
    const fn = bodyOf(src, 'function togglePin()');
    expect(`يجمّد التمرير: ${/overflow|preventDefault|touchAction/.test(fn)}`).toBe('يجمّد التمرير: false');
  });

  it('٩ · وفكُّ التثبيت يكشف الهدفَ الجاري لا الذي كان', async () => {
    /*
     * ⚠️ **ولا يُعاد تشغيلُ نقلاتٍ مضت**: `revealNow` تقرأ
     *    `activeTargetId` لحظتَها — وهي الحالةُ الموثوقةُ نفسُها التي
     *    تكتبها `renderLearn` من نسب المقطع. فلا حالةَ هدفٍ ثانية.
     */
    const src = await view();
    const fn = bodyOf(src, 'function togglePin()');
    expect(`يكشف عند الفكّ: ${/if \(!pinned\) revealNow\(\)/.test(fn)}`).toBe('يكشف عند الفكّ: true');
    const reveal = bodyOf(src, 'function revealNow(panelBody)');
    expect(`يقرأ الهدفَ الجاري: ${/activeTargetId/.test(reveal)}`).toBe('يقرأ الهدفَ الجاري: true');
    /* والتذكرةُ تتقدّم عند القلب — فكشفٌ بدأ قبلها لا يقع بعدها. */
    expect(`تذكرةٌ عند القلب: ${/revealTicket \+= 1/.test(fn)}`).toBe('تذكرةٌ عند القلب: true');
  });

  it('١٠ · ولا يُستبدَل بأوّل الوثيقة هدفٌ لم تُرسَم بطاقتُه', async () => {
    /*
     * ⚠️ **شرطُك الصريح**: «لا يُصفَّر التمريرُ صامتًا حين تغيب الوجهة».
     *    فبطاقةٌ غائبةٌ تعني رسمًا لم يصل — لا «ابدأ من أوّله». يُحفَظ
     *    الطلبُ ويُكشَف حين تصل، وموضعُ القراءة لا يُمَسّ في الأثناء.
     */
    const src = await view();
    const reveal = bodyOf(src, 'function revealNow(panelBody)');
    expect(`يحفظ الطلبَ ويعود: ${/if \(!now \|\| now\.dataset\.target !== activeTargetId\) \{[\s\S]{0,200}?pendingReveal = activeTargetId;[\s\S]{0,40}?return;/.test(reveal)}`)
      .toBe('يحفظ الطلبَ ويعود: true');
    expect(`يصفّر عند الغياب: ${/if \(!now[\s\S]{0,200}?scrollTop = 0/.test(reveal)}`)
      .toBe('يصفّر عند الغياب: false');
    /* وحين يصل الرسمُ يُكشَف المعلَّق. */
    const learn = bodyOf(src, 'async function renderLearn()');
    expect(`يُستأنَف المعلَّق: ${/pendingReveal === activeTargetId/.test(learn)}`)
      .toBe('يُستأنَف المعلَّق: true');
  });

  it('١١ · وبطاقةٌ أطولُ من النافذة تُحاذَى من رأسها', async () => {
    /*
     * ⚠️ **ومحاذاةُ الذيل تدفع أوّلَ سطرٍ خارجَ الرؤية** — فتقع عينُك
     *    في منتصف شرحٍ لم تقرأ مطلعَه. وهو شرطُك في «وجهةٍ أطولَ من
     *    النافذة».
     */
    const src = await view();
    const reveal = bodyOf(src, 'function revealNow(panelBody)');
    expect(`يحاذي الرأسَ عند الطول: ${/box\.height > view\.height/.test(reveal)}`)
      .toBe('يحاذي الرأسَ عند الطول: true');
    /* ولا تجاوزَ للمدى: الموضعُ محدودٌ بين صفرٍ وأقصاه. */
    expect(`محدودٌ بالمدى: ${/Math\.max\(0, Math\.min\(/.test(reveal)}`).toBe('محدودٌ بالمدى: true');
  });

  it('١٢ · وزرٌّ واحدٌ لا زرّان، بحالةٍ مقروءةٍ واسمٍ يصف فعلَه', async () => {
    /*
     * ⚠️ **ولا مُنتقي أوضاعٍ ولا شريطَ أدوات**: زرٌّ واحدٌ في الرأس
     *    القائم. ويُعَدُّ عدًّا — فزرٌّ ثانٍ يسقط هذا الحارس.
     */
    const src = await view();
    const pins = src.match(/data-sh="pin-draft"/g) || [];
    /* مرّةٌ في الوسم ومرّةٌ في المُنتقي ومرّةٌ في المُوزِّع — لا زرَّان في الوسم. */
    const markup = (src.match(/<button class="sh-pin"/g) || []).length;
    expect(`أزرارٌ في الوسم ${markup}`).toBe('أزرارٌ في الوسم 1');
    expect(`إشاراتٌ إلى الزرّ ${pins.length >= 2}`).toBe('إشاراتٌ إلى الزرّ true');
    const draw = bodyOf(src, 'function renderPin()');
    expect(`aria-pressed: ${/aria-pressed/.test(draw)}`).toBe('aria-pressed: true');
    expect(`اسمٌ يصف الفعلَ التالي: ${/aria-label[\s\S]{0,80}ارجع لمتابعة الجملة/.test(draw)}`)
      .toBe('اسمٌ يصف الفعلَ التالي: true');
    /* ويُخفى حين لا تكون الأداةُ «تعلّم» — لا معنى لتثبيتٍ بلا أهداف. */
    expect(`يُخفى خارجَ التعلّم: ${/hidden = !\(rail\.open && rail\.tool === 'learn'\)/.test(draw)}`)
      .toBe('يُخفى خارجَ التعلّم: true');
  });

  it('١٣ · وهدفُ لمسه ٤٤ ولا يركب جارَه في رأس اللوح', async () => {
    /*
     * ⚠️ **والهامشُ السالبُ في رأس اللوح كُتب لزرٍّ واحد** (-12px ليعانق
     *    زرُّ الإغلاق الحافّة). فلمّا صار الرأسُ زرَّين كان يجعل هذا
     *    يركب ذاك — وهو الدرسُ نفسُه المكتوب فوق حبّة الأوضاع:
     *    **العدوانُ يقع على الحافّة لا في المركز**.
     */
    const css = await (await fetch('../css/shadow.css')).text();
    expect(/\.sh-pin \{[^}]*margin-inline-end: 0/.test(css)).toBe(true);
    expect(/\.sh-pin\.on \{[^}]*box-shadow: inset 0 0 0 1px/.test(css)).toBe(true);
    /* وحجمُ اللمس موروثٌ من قاعدة الرأس القائمة — ٤٤×٤٤. */
    expect(/\.sh-panel-head button \{[^}]*width: 44px; height: 44px/.test(css)).toBe(true);
  });
});

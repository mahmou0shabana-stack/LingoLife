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
    const src = await view();
    const body = bodyOf(src, 'async function renderLearn()');
    const conditional = /activeTargetId\s*!==\s*revealedTargetId/.test(body);
    const minimal = /box\.top\s*<\s*view\.top[\s\S]{0,200}?box\.bottom\s*>\s*view\.bottom/.test(body);
    const noCenter = !/block:\s*'center'/.test(body);
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

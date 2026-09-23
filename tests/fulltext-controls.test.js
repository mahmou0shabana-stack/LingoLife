/**
 * WS-SRCF · المرحلة هـ — «نصٌّ كامل»: قراءةٌ ونسخٌ ومقاس.
 *
 * ⚠️ **ولا مشغّلَ ثانٍ ولا إعداداتٍ ثانية** (شرطُك الصريح). الحلقةُ
 *    الصغيرةُ تجلس فوق ما هو قائم:
 *
 *        `speak`/`cancel`  من `tts-controller`  — نطقُ المتصفّح
 *        `claimAudio`/`releaseAudio` من ناقل الصوت — حَكَمُ V1.0A
 *        `speed` و`intervalMs(session)` من الجلسة — إعداداتُ القراءة
 *
 * ⚠️ **والقراءةُ لا تكتب دليلًا**: لا `player` ولا `goTo` ولا
 *    `recordSegmentPractice` ولا فهرسَ تدريبٍ يُحرَّك.
 *
 * ⚠️ **وحدُّ القدرة مكتوب**: نطقُ المتصفّح بلا استئنافٍ موثوقٍ من
 *    منتصف الجملة، فالإيقافُ عند حدّ الجملة والاستئنافُ منها. وقِيس
 *    حيًّا: أُوقفت القراءةُ عند الجملة الثانية فبقيت عند الثانية بعد
 *    ١٫٦ث — لا نطقَ متأخّر.
 */
import { describe, it, expect } from './test-runner.js';

let SRC = '';
const source = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};
const sheet = async () => (await fetch('../css/shadow.css')).text();

/** يقتطع جسمَ دالّةٍ عُليا — الإغلاقُ عمودٌ صفرٌ في هذا الملفّ. */
function bodyOf(src, name) {
  const head = src.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (head < 0) throw new Error(`لم تُوجد ${name}`);
  const open = src.indexOf('{', head);
  return src.slice(open + 1, src.indexOf('\n}', open));
}

/** يُسقط التعليقات — يُقرأ كودٌ لا شرح. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('WS-SRCF · حبّةُ أفعال «نصّ كامل»', () => {
  it('١ · أربعةُ أفعالٍ في رأس TRANSCRIPT، تظهر مع «نصّ كامل» وحدَه', async () => {
    const src = await source();
    for (const act of ['ft-play', 'ft-copy', 'ft-size']) {
      expect(`${act} موجود: ${src.includes(`data-sh="${act}"`)}`).toBe(`${act} موجود: true`);
    }
    /* وخطوتان للمقاس: أصغرُ وأكبر. */
    expect(`خطوتان: ${(src.match(/data-sh="ft-size" data-v="(-?1)"/g) || []).length}`)
      .toBe('خطوتان: 2');
    /* ولكلٍّ اسمٌ مقروء. */
    const head = src.slice(src.indexOf('data-ft-acts'), src.indexOf('sh-read-modes'));
    /*
     * ⚠️ **وصارت خمسةً لا أربعًا** (WS-RUE · ٤): زِيد زرُّ **طريقة
     *    العرض** إلى الحبّة نفسِها — لا شريطَ أدواتٍ ثانٍ ولا ثلاثةُ
     *    أزرارٍ دائمة. والعددُ يُحرَس كي لا يتسلّل سادسٌ بلا قرار.
     */
    expect(`أسماءٌ مقروءة: ${(head.match(/aria-label=/g) || []).length}`)
      .toBe('أسماءٌ مقروءة: 5');
    expect(`وزرُّ العرض موجود: ${src.includes('data-sh="ft-view"')}`)
      .toBe('وزرُّ العرض موجود: true');
    /* وتُخفى في وضع الجمل — الرسمُ يقرّر لا الأنماط. */
    const paint = code(bodyOf(src, 'paintFullTextActs'));
    expect(`تُخفى في «جمل»: ${/hidden\s*=\s*readMode !== READ_MODE\.FLOW/.test(paint)}`)
      .toBe('تُخفى في «جمل»: true');
    /* ولم تُمَسّ شارةُ Aa: عائلةُ الخطّ بابُها هي. */
    expect(`شارةُ Aa باقية: ${src.includes("fontChip('doc')")}`).toBe('شارةُ Aa باقية: true');
  });

  it('٢ · والقراءةُ من مقاطع المصدر بترتيبها — لا تقطيعَ بعلامات ترقيم', async () => {
    /*
     * ⚠️ **حدودُ الجمل موجودةٌ أصلًا** في المقاطع، فاختراعُ تقطيعٍ
     *    بتعبيرٍ نمطيٍّ يخترع حدودًا غيرَ حدود المستند.
     */
    const body = code(bodyOf(await source(), 'playFullText'));
    expect(`من مقاطع المصدر: ${/fullTextRows\(\)/.test(body)}`).toBe('من مقاطع المصدر: true');
    expect(`ولا تقطيعَ بترقيم: ${/split\(\/[^/]*[.!?][^/]*\//.test(body)}`)
      .toBe('ولا تقطيعَ بترقيم: false');
    const rows = code(bodyOf(await source(), 'fullTextRows'));
    expect(`والمصدرُ هو مصدرُ الراسم: ${/sourceRows\(\)/.test(rows)}`)
      .toBe('والمصدرُ هو مصدرُ الراسم: true');
    /*
     * ولا تُرسَل الوثيقةُ كلُّها طلبًا واحدًا: النطقُ داخلَ حلقة.
     *
     * ⚠️ **ويُقاس بالأقواس لا بنافذةِ محارف.** كتبتُها أوّلًا
     *    `for …{0,200}?speakOnce` فسقطت على كودٍ سليم: بين رأس الحلقة
     *    والنطق ٢٥٧ محرفًا (فحصُ التذكرة وقراءةُ المقطع والرسم).
     *    ونافذةٌ بعددٍ مخترَعٍ تحرس طولَ السطور لا موضعَ النطق —
     *    فيُحسَب عمقُ الأقواس ويُسأل: أهو **داخل** جسم الحلقة؟
     */
    const at = body.search(/\bfor\s*\(/);
    const open = body.indexOf('{', at);
    let depth = 0; let end = -1;
    for (let i = open; i < body.length && end < 0; i += 1) {
      if (body[i] === '{') depth += 1;
      else if (body[i] === '}') { depth -= 1; if (!depth) end = i; }
    }
    const spoke = body.indexOf('speakOnce(');
    expect(`جملةً جملة: ${at >= 0 && spoke > open && spoke < end}`)
      .toBe('جملةً جملة: true');
  });

  it('٣ · وتقرأ بإعدادات القراءة القائمة — سرعةً ووقفةً وصوتًا', async () => {
    /*
     * ⚠️ ولا إعدادَ قراءةٍ ثانٍ: `speed` و`voiceId` و`intervalMs` هي
     *    نفسُها التي يقرأ منها التدريب — تُقرأ ولا تُكتَب.
     */
    const body = code(bodyOf(await source(), 'playFullText'));
    expect(`السرعة: ${/rate\s*=\s*Number\(session\.speed\)/.test(body)}`).toBe('السرعة: true');
    /* ⚠️ والصوتُ بمزوّده (Voice Center V1.0C) — نفسُ القيمة لكلّ جلسةٍ قائمة. */
    expect(`الصوت: ${/voiceName\s*=\s*voiceFor\(session\)/.test(body)}`).toBe('الصوت: true');
    expect(`الوقفة: ${/intervalMs\(session\)/.test(body)}`).toBe('الوقفة: true');
    /* ولا تكتب إعدادًا. */
    expect(`لا تكتب إعدادًا: ${/saveSessionSettings/.test(body)}`).toBe('لا تكتب إعدادًا: false');
  });

  it('٤ · ولا تمسّ تقدّمَ التدريب ولا دليلَه', async () => {
    /*
     * ⚠️ **قراءةٌ لا تدريب**: دليلُ الممارسة يُكتَب حين تتدرّب، فقراءةُ
     *    النصّ لا ترفع تكرارًا ولا تُكمل هدفًا ولا تحرّك فهرسًا.
     */
    const body = code(bodyOf(await source(), 'playFullText'));
    for (const forbidden of ['player.', 'goTo(', 'recordSegmentPractice', 'setPractice',
      'syncSegment(', 'ctx.session.id =']) {
      expect(`${forbidden} غائب: ${body.includes(forbidden)}`).toBe(`${forbidden} غائب: false`);
    }
  });

  it('٥ · وتمرّ بناقل الصوت — تطلبه وتسلّمه ولا تتجاوزه', async () => {
    /*
     * ⚠️ **وحَكَمُ V1.0A هو الناقلُ لا نحن**: تُطلَب الملكيّةُ باسمٍ
     *    واحد، ومعها كيف تُسكِت نفسَها حين يأتي غيرُها. وقِيس حيًّا:
     *    المالكُ أثناء القراءة «fulltext»، وبعد ضغط تشغيل التدريب
     *    «session» وعاد زرُّ النصّ ▶.
     */
    const src = await source();
    const play = code(bodyOf(src, 'playFullText'));
    const stop = code(bodyOf(src, 'stopFullText'));
    expect(`تطلب الملكيّة: ${/claimAudio\(FT_OWNER,/.test(play)}`).toBe('تطلب الملكيّة: true');
    expect(`وتسلّمها عند الانتهاء: ${/releaseAudio\(FT_OWNER\)/.test(play)}`)
      .toBe('وتسلّمها عند الانتهاء: true');
    expect(`والإيقافُ يُلغي وينهي: ${/ttsCancel\(\)/.test(stop) && /releaseAudio\(FT_OWNER\)/.test(stop)}`)
      .toBe('والإيقافُ يُلغي وينهي: true');
    /* ولا نطقَ مباشرٌ يتجاوز المتحكّم. */
    expect(`لا نطقَ مباشر: ${/new SpeechSynthesisUtterance|speechSynthesis\.speak/.test(play)}`)
      .toBe('لا نطقَ مباشر: false');
    /* واسمُ المالك واحدٌ ثابت. */
    expect(`اسمٌ واحد: ${/^const FT_OWNER = 'fulltext';/m.test(src)}`).toBe('اسمٌ واحد: true');
  });

  it('٦ · ونطقٌ بدأ قبل الإلغاء لا يُكمل بعده — تذكرةٌ لا راية', async () => {
    /*
     * ⚠️ **راية `on` وحدَها لا تكفي**: ضغطةٌ ثانيةٌ تبدأ حلقةً جديدةً
     *    والقديمةُ ما زالت في `await`، فتتنافسان على نفس الراية.
     *    فالتذكرةُ تتزايد، وكلُّ حلقةٍ تسأل بعد كلّ انتظار: أما زلتُ
     *    الأحدث؟ وقِيس: أُوقفت عند الجملة الثانية فبقيت الثانية.
     */
    const body = code(bodyOf(await source(), 'playFullText'));
    /*
     * ⚠️ **ويبدأ الفحصُ بعد الجملة المنتظَرة لا عندها.** قسمتُ أوّلًا
     *    على `await` وسألتُ عن الفحص قبل أيّ فعل — فجاء **الفعلُ
     *    المنتظَرُ نفسُه** (‏`speakOnce(`) أوّلَ المقطع، فأبلغ الحارسُ
     *    عن ثغرةٍ لا وجودَ لها. والمقصودُ: ما يجري **بعد عودة**
     *    الانتظار. فتُسقَط جملتُه (حتّى أوّل `;`) ثمّ يُقاس ما بعدها.
     */
    const parts = body.split(/\bawait\b/).slice(1)
      .map((chunk) => chunk.slice(chunk.indexOf(';') + 1));
    const unguarded = parts.filter((chunk) => {
      const check = chunk.search(/mine !== ftReading\.ticket/);
      const act = chunk.search(/speakOnce\(|ftReading\.at\s*=|releaseAudio\(/);
      return act >= 0 && (check < 0 || check > act);
    });
    expect(`انتظاراتٌ بلا فحص: ${unguarded.length}`).toBe('انتظاراتٌ بلا فحص: 0');
    expect(`والتذكرةُ تتزايد: ${/ftReading\.ticket \+= 1/.test(body)}`)
      .toBe('والتذكرةُ تتزايد: true');
  });

  it('٧ · والنسخُ من النصّ المخزَّن لا من الشجرة', async () => {
    /*
     * ⚠️ الشجرةُ تحمل أرقامَ الجمل وعلاماتِ النبر وأصنافَ التظليل،
     *    ونسخُها ينسخ ذلك كلَّه. والمصدرُ موجودٌ نصًّا فيُنسَخ منه.
     *    وقِيس حيًّا: ١٣٥ محرفًا في أربعة أسطر، بلا وسمٍ ولا عنوان.
     */
    const body = code(bodyOf(await source(), 'copyFullText'));
    expect(`من المقاطع: ${/sourceTextSnapshot/.test(body)}`).toBe('من المقاطع: true');
    expect(`ولا من الشجرة: ${/textContent|innerText|querySelectorAll/.test(body)}`)
      .toBe('ولا من الشجرة: false');
    expect(`بالحافظة القائمة: ${/copyToClipboard\(/.test(body)}`).toBe('بالحافظة القائمة: true');
    /* وترتيبُ الجمل كما هو — لا فرزَ ولا عكس. */
    expect(`بلا فرز: ${/\.sort\(|\.reverse\(/.test(body)}`).toBe('بلا فرز: false');
  });

  it('٨ · والمقاسُ متغيّرٌ على الحاوي — يصمد أمام إعادة الرسم', async () => {
    /*
     * ⚠️ **`paintLines` تستبدل أبناءَ الحاوي لا الحاوي**، فمتغيّرٌ عليه
     *    يبقى. ولا حالةَ ثانيةٌ تُتابَع ولا تخزينَ جديد.
     */
    const src = await source();
    const apply = code(bodyOf(src, 'applyFullTextSize'));
    expect(`على الحاوي: ${/\[data-lines\]'\)[\s\S]{0,80}setProperty\('--sh-ft-size'/.test(apply)}`)
      .toBe('على الحاوي: true');
    /* ويُعاد بعد كلّ رسم. */
    const paint = code(bodyOf(src, 'paintLines'));
    expect(`يُعاد بعد الرسم: ${/applyFullTextSize\(\)/.test(paint)}`)
      .toBe('يُعاد بعد الرسم: true');
    /* والسلّمُ محدودٌ بطرفين. */
    expect(`سلّمٌ محدود: ${/const FT_STEPS = Object\.freeze\(\[/.test(src)}`)
      .toBe('سلّمٌ محدود: true');
    const step = code(bodyOf(src, 'stepFullTextSize'));
    expect(`لا يتجاوز طرفيه: ${/Math\.max\(0, Math\.min\(FT_STEPS\.length - 1/.test(step)}`)
      .toBe('لا يتجاوز طرفيه: true');
    /* ولا يمسّ عائلةَ الخطّ. */
    expect(`لا يمسّ العائلة: ${/fontDoc|applyFont\(|russianFontId/.test(step)}`)
      .toBe('لا يمسّ العائلة: false');
  });

  it('٩ · والمقاسُ مقصورٌ على «نصّ كامل» — لا يطال بطلًا ولا رقاقةً ولا عربيّة', async () => {
    /*
     * ⚠️ **المتغيّرُ يقرأه `.sh-flow-s` وحدَه.** وقِيس حيًّا على
     *    ١٢٨٠×٨٠٠: ‎14.5 → 16.675 → 18.85‎ للنصّ الكامل، والبطلُ ٣٠px
     *    والرقاقةُ ١٧px لم يتغيّرا.
     */
    /*
     * ⚠️ **وتُسقَط تعليقاتُ الورقة قبل انتزاع المُنتقي.** `[^{}]+`
     *    تبتلع كلَّ ما بين القوسين — ومنه تعليقُ الشرح فوق القاعدة،
     *    فجاء «المنتقي» فقرةً عربيّةً كاملة. والورقةُ هنا تُقرأ كودًا
     *    لا شرحًا، تمامًا كالمصدر.
     */
    const css = (await sheet()).replace(/\/\*[\s\S]*?\*\//g, ' ');
    const uses = [...css.matchAll(/([^{}]+)\{[^}]*var\(--sh-ft-size/g)].map((m) => m[1].trim());
    /*
   * ⚠️ **وقارئٌ ثانٍ دخل بحقٍّ** (WS-RUE · ٤): مسطرةُ «الدفتر» تباعدُها
   *    `--sh-nb` مشتقٌّ من مقاس النصّ — وإلّا انزلق الحبرُ عن خطوطه
   *    عند كلّ ‎A+‎. وهو **داخلَ** النصّ الكامل لا خارجَه، فيُضاف إلى
   *    القائمة المسموحة صراحةً لا تُلغى القائمة.
   */
  expect(`قرّاءُ المتغيّر: ${uses.join(' | ')}`)
    .toBe('قرّاءُ المتغيّر: .sh-flow-s | [data-ft-view="note"]');
    /* والموضعُ يُحفَظ نسبةً عند التكبير — لا عودةَ إلى أوّل الوثيقة. */
    const step = code(bodyOf(await source(), 'stepFullTextSize'));
    expect(`يحفظ موضعَ القراءة: ${/scrollTop \/ \(.*scrollHeight - .*clientHeight\)/.test(step)}`)
      .toBe('يحفظ موضعَ القراءة: true');
    expect(`ولا يصفّره: ${/scrollTop\s*=\s*0/.test(step)}`).toBe('ولا يصفّره: false');
  });

  it('١٠ · ومغادرةُ الشاشة توقف القراءة', async () => {
    /*
     * ⚠️ نطقٌ يبقى بعد مغادرتك الصفحةَ أسوأُ من نطقٍ لا يبدأ: لا زرَّ
     *    يوقفه. فالتنظيفُ في نفس المكان الذي يُفلت فيه صوتُ الجلسة.
     */
    const src = code(await source());
    const at = src.indexOf("releaseAudio('session')");
    expect(`يُنظَّف عند المغادرة: ${src.slice(Math.max(0, at - 200), at).includes('stopFullText()')}`)
      .toBe('يُنظَّف عند المغادرة: true');
  });
});

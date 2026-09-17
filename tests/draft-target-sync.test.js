/**
 * WS-DSCTME · العطب ١ — نصُّ الهدف وتظليلُه شيءٌ واحد، و«مسودّة» مفتوحة.
 *
 * ⚠️ **بلاغُك**: «التظليل يتحرّك مستقلًّا عن نصّ الجملة، فيبدو تابعًا
 *    لجملةٍ أخرى أو يسبق المعروض» — **وتحديدًا ولوحُ المسودّة مفتوح**.
 *
 * ⚠️ **وقِيس أوّلًا، ولم يكن السببُ ما ظننتُ.** البطلُ والرقائقُ لم
 *    يفترقا في إطارٍ واحدٍ من ٢٤٠٠ إطارٍ مقيس (تشغيلٌ حيٌّ بناطقٍ بديل،
 *    خمسةُ أهدافٍ مرّت). والذي كان يفترق هو **تظليلُ الهدف الجاري في
 *    لوح المسودّة**:
 *
 *        على هذه الآلة (قاعدةٌ سريعة)      إطارٌ واحد
 *        وقراءةُ القاعدة بوتيرةِ جهازٍ حقيقيّ  **٤٠٠ms بعد كلِّ نقلة**
 *
 *    والسببُ: `syncSegment` تكتب البطلَ والرقائقَ **تزامنيًّا**، ثمّ
 *    تُطلق `renderWells` التي تقرأ **كلَّ** منبعٍ من IndexedDB قبل أن
 *    تكتب حرفًا — والتظليلُ من نصيب تلك الكتابة المتأخّرة.
 *
 * ⚠️ **ولذلك يخصّ «مسودّة» وحدَها**: لا منبعَ آخر يُعاد رسمُه مع نقلة
 *    الهدف (`if (well === 'draft')`)، فالتأخّرُ لا يُرى إلّا هناك.
 */
import { describe, it, expect } from './test-runner.js';

let SRC = '';
const source = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};

/** يقتطع جسمَ دالّةٍ عُليا من المصدر — الإغلاقُ عمودٌ صفرٌ في هذا الملفّ. */
function bodyOf(src, name) {
  const head = src.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (head < 0) throw new Error(`لم تُوجد ${name}`);
  const open = src.indexOf('{', head);
  const end = src.indexOf('\n}', open);
  return src.slice(open + 1, end);
}

const CARDS = ['t-alpha', 't-beta', 't-gamma'];

describe('WS-DSCTME · تظليلُ الهدف يتحرّك مع نصّه لا بعده', () => {
  /*
   * شجرةٌ حيّةٌ فيها لوحُ مسودّةٍ ببطاقاته — ويُشغَّل عليها **الكودُ
   * المشحونُ نفسُه**: يُقتطَع جسمُ `paintWellTarget` من الملفّ ويُنفَّذ
   * بمعطاه و`$` مقيَّدةً بهذه الشجرة. فتغييرُ السطر في التطبيق يُسقط
   * الحارسَ هنا — وهو المقصود.
   */
  const build = async () => {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;top:-9999px;inset-inline-start:0';
    box.innerHTML = [
      '<div data-well-body>',
      ...CARDS.map((id) => `  <article class="dw-card" data-dw-target="${id}">`
        + `<p class="dw-ru">${id}</p></article>`),
      '</div>',
    ].join('\n');
    document.body.append(box);
    const $ = (sel) => box.querySelector(sel);
    const fn = new Function('targetId', '$', bodyOf(await source(), 'paintWellTarget'));
    return {
      paint: (id) => fn(id, $),
      now: () => [...box.querySelectorAll('.dw-card.is-now')].map((c) => c.dataset.dwTarget),
      close: () => box.remove(),
    };
  };

  it('١ · التظليلُ ينتقل بلا قراءةِ قاعدةٍ ولا انتظارِ رسم', async () => {
    /*
     * ⚠️ **والمقيسُ أنّها متزامنة**: لا `await` ولا وعدٌ — تُنادى فيصير
     *    التظليلُ في مكانه **في نفس الإطار** الذي كُتب فيه نصُّ الهدف.
     *    فلو صارت يومًا `async` سقط هذا السطرُ فورًا.
     */
    const f = await build();
    const found = f.paint('t-beta');
    expect(`وُجدت البطاقةُ: ${found}`).toBe('وُجدت البطاقةُ: true');
    expect(`الجاري: ${f.now().join(',')}`).toBe('الجاري: t-beta');
    f.close();

    const body = bodyOf(await source(), 'paintWellTarget');
    expect(`بلا انتظار: ${/\bawait\b/.test(body)}`).toBe('بلا انتظار: false');
    expect(`ولا قراءةَ قاعدة: ${/\bread\(|studyDrafts|activeDraftModel/.test(body)}`)
      .toBe('ولا قراءةَ قاعدة: false');
  });

  it('٢ · ونقلاتٌ متلاحقةٌ لا تترك تظليلًا من هدفٍ مضى', async () => {
    /*
     * ⚠️ **بطاقتان «جاريتان» أسوأُ من واحدةٍ خاطئة**: تقولان إنّ موضعَك
     *    اثنان. فالمقيسُ عددُ الحاملين للصنف لا وجودُه على الصحيح.
     */
    const f = await build();
    for (const id of ['t-alpha', 't-gamma', 't-beta', 't-alpha']) f.paint(id);
    expect(`الجاري: ${f.now().join(',')}`).toBe('الجاري: t-alpha');
    /* وهدفٌ لا بطاقةَ له يُطفئ ولا يخترع. */
    expect(`غريبٌ وُجد: ${f.paint('t-none')}`).toBe('غريبٌ وُجد: false');
    expect(`فلا جاريَ: ${f.now().length}`).toBe('فلا جاريَ: 0');
    f.close();
  });

  it('٣ · ويُكتَب التظليلُ قبل إطلاق الرسم الكامل لا بعده', async () => {
    /*
     * ⚠️ **الترتيبُ هو الإصلاح كلُّه.** لو نُودي `paintWellTarget` بعد
     *    `renderWells` لعاد التأخّرُ كما كان: الرسمُ الكاملُ غيرُ
     *    منتظَر (`.catch` بلا `await`)، فالتظليلُ يقع في آخر الطابور.
     */
    const body = bodyOf(await source(), 'syncSegment');
    const at = body.indexOf('paintWellTarget(');
    const draw = body.indexOf('renderWells()');
    expect(`يُنادى: ${at >= 0}`).toBe('يُنادى: true');
    expect(`قبل الرسم: ${at >= 0 && draw > at}`).toBe('قبل الرسم: true');
    /* وبهُويّة المقطع نفسِها لا بمتغيّرٍ يكتبه لوحٌ آخر متأخّرًا. */
    expect(`بهُويّة المقطع: ${/paintWellTarget\(segment\.targetId/.test(body)}`)
      .toBe('بهُويّة المقطع: true');
    /* وداخلَ شرط «اللوحُ مفتوحٌ على المسودّة» — لا عملَ بلا لوح. */
    expect(`داخلَ شرط اللوح: ${/well === 'draft'\)\s*\{[\s\S]{0,400}?paintWellTarget\(/.test(body)}`)
      .toBe('داخلَ شرط اللوح: true');
  });

  it('٤ · ورسمُ اللوح لا يكتب وهو متأخّرٌ عن نقلةٍ أحدثَ منه', async () => {
    /*
     * ⚠️ **والعطبُ الثاني في نفس المسار**: `renderWells` تنتظر قراءاتٍ،
     *    ونداءان متداخلان ينتهيان بترتيب القاعدة لا بترتيب البدء —
     *    فيكتب الأقدمُ فوق الأحدث. فتُؤخَذ تذكرةٌ **قبل أوّل انتظار**،
     *    ويُسأل بعد كلّ انتظارٍ: أما زلتُ الأحدث؟
     *
     * ⚠️ والحارسُ يعدّ الانتظاراتِ ولا يثق بعددٍ مكتوب: كلُّ `await`
     *    يجب أن يليه فحصُ تأخّرٍ قبل أيّ كتابة. فإضافةُ انتظارٍ جديدٍ
     *    بلا فحصٍ تُسقطه.
     */
    /*
     * ⚠️ **وتُنزَع التعليقاتُ قبل القياس — وقد أسقطني هذا فورًا.** كتبتُ
     *    في التعليق فوق التذكرة كلمةَ `await` نفسَها، فوجدها الحارسُ
     *    قبل التذكرة وقال «التذكرةُ بعد أوّل انتظار» — وهو صادقٌ عن
     *    نصٍّ لا يُنفَّذ. فالمقروءُ كودٌ لا شرح.
     */
    const code = bodyOf(await source(), 'renderWells')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    const body = code;
    const ticket = body.indexOf('wellDrawTicket += 1');
    const firstAwait = body.search(/\bawait\b/);
    expect(`تُؤخَذ التذكرة: ${ticket >= 0}`).toBe('تُؤخَذ التذكرة: true');
    expect(`قبل أوّل انتظار: ${ticket >= 0 && firstAwait > ticket}`)
      .toBe('قبل أوّل انتظار: true');

    const WRITES = /innerHTML\s*=|refreshBottomStats\(|\.hidden\s*=|classList\.(add|remove|toggle)\(/;
    const parts = body.split(/\bawait\b/).slice(1);
    const unguarded = parts.filter((chunk) => {
      const check = chunk.search(/stale\(\)/);
      const write = chunk.search(WRITES);
      return write >= 0 && (check < 0 || check > write);
    });
    expect(`انتظاراتٌ بلا فحص: ${unguarded.length}`).toBe('انتظاراتٌ بلا فحص: 0');
    expect(`عددُ الفحوص: ${(body.match(/if \(stale\(\)\) return;/g) || []).length >= 2}`)
      .toBe('عددُ الفحوص: true');
  });

  it('٥ · والتذكرةُ واحدةٌ للشاشة كلِّها — لا لكلّ نداء', async () => {
    /*
     * ⚠️ **تذكرةٌ محلّيّةٌ لا تحرس شيئًا**: لو أُعلنت داخلَ الدالّة لَساوت
     *    كلُّ نسخةٍ نفسَها وصار الفحصُ صادقًا دائمًا. فهي حالةُ وحدةٍ
     *    تتزايد، ونداءٌ أقدمُ يجد رقمَه قد فات.
     */
    const src = await source();
    expect(`مُعلَنةٌ خارجًا: ${/^let wellDrawTicket = 0;/m.test(src)}`)
      .toBe('مُعلَنةٌ خارجًا: true');
    const body = bodyOf(src, 'renderWells');
    expect(`ولا تُعاد إعلانًا داخلًا: ${/(let|const|var)\s+wellDrawTicket/.test(body)}`)
      .toBe('ولا تُعاد إعلانًا داخلًا: false');
  });
});

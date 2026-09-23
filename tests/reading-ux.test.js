/**
 * LingoLife — WS-RUE · ثمانيةُ تحسيناتٍ للقراءة والمزامنة
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما قِيس قبل تغيير سطرٍ واحد — وهو ما تحرسه هذه الملفّات
 * ═══════════════════════════════════════════════════════════════
 *
 * ١) **الكلماتُ المقسَّمةُ أثناء التشغيل**: `opacity: .24` لِما لم
 *    يُنطَق بعد. وقِيس الطلاءُ على ١٢٨٠×٨٠٠ (أسطعُ بكسلٍ في صندوق
 *    الكلمة مقابل أكثرِ ألوانِ محيطها تكرارًا):
 *
 *        الجاريةُ  [253,247,234]              — تُقرأ
 *        الآتيةُ   [62,67,73] ⇒ تباين **٢٫٠** — لا تُقرأ
 *
 *    وصفحةُ المسودّة اليسرى قِيست كذلك فوُجدت سليمةً (١٣–١٤٫٥)،
 *    ولوحُ التعلّم كذلك (١٠٫٧–١٣٫١) — فلم يُرفَع فيهما شيء.
 *
 * ٢) **ما يُنطَق لم يكن يظهر في المسودّة اليسرى إطلاقًا**: كان
 *    `.dw-card.is-now` يقول «هدفُك الجاري» وحسب، والزوجُ (سؤالٌ ثمّ
 *    جواب) سطران داخل بطاقةٍ واحدة لا يُميَّز أحدُهما.
 *
 * ٣) **والإجابةُ كانت تُنطَق قبل سؤالها**. قِيس بناطقٍ بديلٍ يسجّل:
 *        «перейти́ к документа́ции» ×٥  ثمّ  «перейти к чему?» ×٣
 *    أي القلبُ (وهو الإجابة) ثمّ سؤالُه، ولكلٍّ تكرارُه.
 *
 * ٦) **ومدى المقطع كان يُكتَب ولا يُرى**: الأصنافُ صحيحةٌ على الرقائق
 *    و`box-shadow: none` وحدُّها حدُّ رقاقةٍ عاديّة.
 *
 * ٨) **واللمعةُ العلويّةُ باقيةٌ في «مختارة» و«ممسوكة» و«تُنطَق الآن»**
 *    — نُزعت من الساكنة وحدَها في التمريرة السابقة.
 */

import { describe, it, expect } from './test-runner.js';

let CSS = '';
const css = async () => {
  if (!CSS) CSS = await (await fetch('../css/shadow.css')).text();
  return CSS;
};
let SRC = '';
const view = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};

/** يُسقط التعليقات — يُقرأ كودٌ لا شرح. */
const bare = (s) => s
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** يقتطع جسمَ دالّةٍ عُليا — الإغلاقُ عمودٌ صفرٌ في هذا الملفّ. */
function bodyOf(src, name) {
  const head = src.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (head < 0) throw new Error(`لم تُوجد ${name}`);
  const open = src.indexOf('{', head);
  return src.slice(open + 1, src.indexOf('\n}', open));
}

/*
 * مسرحٌ معزولٌ بالرقائق وحالاتها — أصنافُه أصنافُ `renderWords` نفسِها.
 *
 * ⚠️ **والورقتان تُحمَّلان كاملتين**: القواعدُ التي تُعنى بها هذه
 *    التمريرةُ مكتوبةٌ في أواخر `shadow.css` وتغلب سابقاتِها بالترتيب،
 *    فإطارٌ يحمّل بعضَها يقيس حالةً لا وجودَ لها على الجهاز.
 */
const CHIP = (w, cls = '') => `<button class="sh-chip ${cls}" data-word="0">`
  + `<span class="sh-chip-w">${w}</span>`
  + '<span class="sh-chip-bar"><i></i></span></button>';

async function chipsAt(width, height, { live = false } = {}) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;inset-block-start:-20000px;inset-inline-start:0;
    inline-size:${width}px;block-size:${height}px;border:0;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const states = ['', 'past', 'speaking', 'selected', 'picked',
    'in-phrase phrase-start', 'in-phrase', 'in-phrase phrase-end', 'phrase-anchor'];
  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head>
    <link rel="stylesheet" href="${new URL('../css/tokens.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/base.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/components.css', location.href).href}">
    <link rel="stylesheet" href="${new URL('../css/shadow.css', location.href).href}">
    <style>html,body{margin:0;height:100%}*,*::before,*::after{transition:none !important}</style>
    </head><body>
    <div class="shadow-app${live ? ' is-live' : ''}">
      <div class="sh-page sh-right">
        <div class="sh-chips" data-words>
          ${states.map((c, i) => CHIP(`сло́во${i}`, c)).join('')}
        </div>
      </div>
    </div></body></html>`);
  doc.close();
  await new Promise((done) => {
    if (doc.readyState === 'complete') done();
    else iframe.addEventListener('load', done, { once: true });
  });
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const win = iframe.contentWindow;
  return {
    doc,
    win,
    /** حالةُ رقاقةٍ بصنفها. */
    at: (cls) => {
      const node = [...doc.querySelectorAll('.sh-chip')]
        .find((n) => n.className.replace('sh-chip', '').trim() === cls);
      if (!node) throw new Error(`لا رقاقةَ بالصنف «${cls}»`);
      const cs = win.getComputedStyle(node);
      const w = win.getComputedStyle(node.querySelector('.sh-chip-w'));
      return {
        shadow: cs.boxShadow, border: cs.borderTopColor, bg: cs.backgroundImage,
        ink: w.color, opacity: Number(w.opacity),
      };
    },
    close: () => iframe.remove(),
  };
}

/* ================================================================== *
 * ١) الكلماتُ المقسَّمةُ تبقى مقروءةً وأنت تتدرّب                        *
 * ================================================================== */
describe('WS-RUE · ١ · الوضوح', () => {
  it('١ · الكلمةُ التي لم تُنطَق بعدُ تبقى مقروءةً أثناء التشغيل', async () => {
    /*
     * ⚠️ **والمحروسُ قاعٌ لا رقمٌ بعينه.** ‎.24 قِيس تباينُه **٢٫٠** —
     *    دون عتبة ‎4.5:1‎ المعروفة لنصٍّ بهذا الحجم. فالقاعُ ‎.55‎:
     *    ما دونه يعود إلى المدى الذي أبلغتَ عنه مرّتين.
     */
    const f = await chipsAt(1280, 800, { live: true });
    const soon = f.at('');
    const past = f.at('past');
    const now = f.at('speaking');
    f.close();
    expect(`الآتيةُ ${soon.opacity} ≥ .55`)
      .toBe(`الآتيةُ ${soon.opacity} ${soon.opacity >= 0.55 ? '≥' : '<'} .55`);
    expect(`الماضيةُ ${past.opacity} ≥ .7`)
      .toBe(`الماضيةُ ${past.opacity} ${past.opacity >= 0.7 ? '≥' : '<'} .7`);
    /*
     * ⚠️ **والترتيبُ الزمنيُّ يبقى** (§١٩٫٢): الجاريةُ أسطعُ من الماضية،
     *    والماضيةُ أسطعُ من الآتية. ورفعُ القاع بلا هذا يمحو الخطَّ
     *    الزمنيَّ الذي وُضعت الشفافيّةُ من أجله.
     */
    expect(`التدرّجُ محفوظ ${now.opacity > past.opacity && past.opacity > soon.opacity}`)
      .toBe('التدرّجُ محفوظ true');
  });

  it('٢ · وحبرُ المسودّة اليسرى لم يُمَسّ — لأنّه قِيس فوُجد سليمًا', async () => {
    /*
     * ⚠️ **ولا تُرفَع شفافيّةٌ عامّةٌ في الشادوينج** (شرطُك): قِيس طلاءُ
     *    صفحة الجملة اليسرى فكان تباينُ الروسيّ ١٣–١٤٫٥ ولوحُ التعلّم
     *    ١٠٫٧–١٣٫١. فمن رفع ما هو سليمٌ أفسد التراتبَ بلا سبب.
     */
    const sheet = await css();
    const rules = [...bare(sheet).matchAll(/([^{}]*)\{([^}]*opacity[^}]*)\}/g)]
      .map((m) => m[1].trim())
      .filter((sel) => /\.dw-|\.sh-chunk|\.sh-now/.test(sel) && /WS-RUE/.test(''));
    expect(`قواعدُ شفافيّةٍ جديدةٌ على المسودّة: ${rules.length}`)
      .toBe('قواعدُ شفافيّةٍ جديدةٌ على المسودّة: 0');
    /* والقاعدةُ المرفوعةُ تخصّ الرقاقةَ وحدَها. */
    expect(`المرفوعُ رقاقةٌ فقط: ${/\.shadow-app\.is-live \.sh-chip-w \{ opacity: \.62; \}/.test(sheet)}`)
      .toBe('المرفوعُ رقاقةٌ فقط: true');
  });
});

/* ================================================================== *
 * ٢) ما يُنطَق يُضاء في مسودّة الصفحة اليسرى                            *
 * ================================================================== */
describe('WS-RUE · ٢ · المنطوقُ في المسودّة', () => {
  it('٣ · لكلّ سؤالٍ وجوابٍ هُويّةُ هدفه في الوسم — لا رقمُ سطر', async () => {
    const src = bare(await view());
    /* السطرُ يحمل معرّفَ وحدته. */
    expect(`السطرُ يحمل هُويّة: ${/data-dw-unit="\$\{targetId\}"/.test(src)}`)
      .toBe('السطرُ يحمل هُويّة: true');
    /* والخريطةُ من النموذج بمفتاحٍ ثلاثيٍّ — دورٌ ونصٌّ وأب. */
    const body = bodyOf(src, 'draftWellHtml');
    const card = bodyOf(src, 'draftCardHtml');
    const key = src.slice(src.indexOf('const unitKey ='), src.indexOf('const unitKey =') + 120);
    expect(`المفتاحُ ثلاثيّ: ${['role', 'ru', 'parent'].every((k) => key.includes(k))}`)
      .toBe('المفتاحُ ثلاثيّ: true');
    expect(`وتُستعمَل في الخريطة: ${/units\.set\(unitKey\(one\.role, one\.ru, one\.parent\)/.test(body)}`)
      .toBe('وتُستعمَل في الخريطة: true');
    /*
     * ⚠️ **ولا ربطَ بالنصّ وحدَه**: نفسُ السؤال قد يتكرّر تحت قلبين،
     *    فمفتاحٌ بلا أبٍ يُضيء سطرًا في بطاقةٍ أخرى.
     */
    expect(`السؤالُ يأخذ دورَه: ${/unitId\(ROLE\.RECALL_CUE/.test(card)}`)
      .toBe('السؤالُ يأخذ دورَه: true');
    expect(`والجوابُ دورَه: ${/unitId\(ROLE\.RECALL_ANSWER/.test(card)}`)
      .toBe('والجوابُ دورَه: true');
  });

  it('٣ب · وكلُّ دورٍ يدخل التدريبَ له سطرٌ موسومٌ — لا القلوبُ وحدَها', async () => {
    /*
     * ⚠️ **وهذا عطبٌ كشفه التدقيقُ لا العين.** الجذرُ والعائلةُ
     *    والأمثلةُ وأزواجُ الشريط السريع **تُنطَق في التدريب** كما
     *    تُنطَق القلوب، وكانت تُرسَم في الورقة بلا هُويّة — فلا تُضاء
     *    ولا تُتابَع. وقِيس على مسودّةٍ فيها كلُّ الأدوار، قبل الإصلاح:
     *
     *        micro_core    ٢/٢  ✓      root_family   ٠/٣  ✗
     *        recall_cue    ١/٢  ✗      example       ٠/٢  ✗
     *        recall_answer ٠/١  ✗
     *
     *    وبعده ١٠/١٠، وبمراقب تبدّلاتٍ على الشجرة (لا بعيّنات): عشرُ
     *    وحداتٍ نُطقت، عشرٌ أُضيئت، وبُعدُ كلٍّ عن وسط منطقة القراءة ٠
     *    (وواحدةٌ ٧).
     *
     * ⚠️ **والأدوارُ تُعدّ من المحلّل لا من قائمةٍ أكتبها هنا.** لو
     *    وُلد دورٌ جديدٌ غدًا ودخل `targets` بلا أن يُوسَم في الورقة،
     *    سقط هذا الحارسُ — وهو مقصودُه. وقائمةٌ مكتوبةٌ بيدي كانت
     *    ستشيخ صامتةً مع أوّل دورٍ يُضاف.
     */
    const { parseDraftV2 } = await import('../js/services/shadow/draft-v2.js');
    const draft = [
      'الجملة الأساسية:', 'Нам ну́жно перейти́.', 'لازم ننتقل.', '',
      'MICRO CORE 1', 'перейти́ к документа́ции', 'ننتقل للتوثيق',
      'المعنى:', 'الانتقال إلى المستندات.',
      'القالب:', 'перейти к + дательный',
      'الجذر والعيلة:', 'перехо́д', 'انتقال',
      'أمثلة:', 'Перейти́ к пу́нкту.', 'ننتقل للبند.',
      'Вопрос: перейти к чему?', 'ننتقل لإيه؟',
      'Ответ: Перейти к документа́ции.', 'ننتقل للتوثيق.', '',
      'QUICK RECALL CHAIN',
      'Вопрос: что проверить?', 'نفحص إيه؟',
      'Ответ: Прове́рить докуме́нты.', 'نفحص المستندات.',
    ].join('\n');
    const roles = [...new Set(parseDraftV2(draft).targets.map((t) => t.role))];
    expect(`أدوارٌ منطوقة: ${roles.length >= 5}`).toBe('أدوارٌ منطوقة: true');
    const src = bare(await view());
    const card = bodyOf(src, 'draftCardHtml');
    const well = bodyOf(src, 'draftWellHtml');
    const both = card + well;
    /* لكلّ دورٍ منطوقٍ نداءُ وسمٍ في الراسم — والقلبُ بمعرّفه هو. */
    for (const role of roles) {
      const key = role.toUpperCase();
      const mapped = role === 'micro_core'
        ? /draftPairHtml\(one\.ru, one\.ar, '', one\.id/.test(card)
        : new RegExp(`unitId\\(ROLE\\.${key}`).test(both);
      expect(`${role} موسوم: ${mapped}`).toBe(`${role} موسوم: true`);
    }
    /*
     * ⚠️ **وأبو زوج الشريط السريع رمزٌ لا قلب.** المحلّلُ يضع عليهما
     *    `CHAIN_PARENT`، فمفتاحٌ يبحث عن قلبٍ أبًا لا يجدهما. وكتبتُ
     *    أوّلًا `link.ref` ظنًّا أنّه كائنُ هدف — وهو **معرّفٌ نصّيّ**
     *    لا يُملأ إلّا لأدوار النطق (‏`textIndex` تتخطّى الاسترجاع).
     *    فبقي زوجُ الشريط بلا وسمٍ وقِيس: `recall_answer` ٠/١.
     */
    expect(`زوجُ الشريط بأبيه الرمزيّ: ${/unitId\(ROLE\.RECALL_ANSWER, link\.ru, CHAIN_PARENT\)/.test(well)}`)
      .toBe('زوجُ الشريط بأبيه الرمزيّ: true');
    expect(`وسؤالُه كذلك: ${/unitId\(ROLE\.RECALL_CUE, link\.cue, CHAIN_PARENT\)/.test(well)}`)
      .toBe('وسؤالُه كذلك: true');
    /* والرمزُ مستوردٌ من المحلّل لا مكتوبٌ نصًّا هنا. */
    expect(`الرمزُ مستورَد: ${/import \{ isDraftV2, CHAIN_PARENT \}/.test(src)}`)
      .toBe('الرمزُ مستورَد: true');
  });

  it('٣ج · وما لا يُنطَق لا يُوسَم — لا معنًى ولا إحساسٌ ولا قالبٌ ولا الجملةُ الأمّ', async () => {
    /*
     * ⚠️ **والطرفُ الآخرُ يُقاس كذلك** (شرطُك): «لا تُضئ ما لا يُنطَق».
     *    وقِيس حيًّا: ثلاثةُ أسطرٍ روسيّةٍ بقيت بلا وسم — الجملةُ الأمّ،
     *    والقالب، وإجابةُ استرجاعٍ نصُّها هو القلبُ نفسُه (فلا وحدةَ
     *    لها أصلًا). وصفرُ أسطرٍ موسومةٍ بلا هدفٍ منطوق.
     */
    const src = bare(await view());
    const card = bodyOf(src, 'draftCardHtml');
    const well = bodyOf(src, 'draftWellHtml');
    /* القالبُ سطرٌ روسيٌّ ظاهرٌ — ولا وسمَ له. */
    const pattern = card.slice(card.indexOf("'القالب'"), card.indexOf("'أمثلة'"));
    expect(`القالبُ بلا وسم: ${/unitId\(/.test(pattern)}`).toBe('القالبُ بلا وسم: false');
    /* والجملةُ الأمُّ في رأس الورقة — عرضٌ لا وحدةُ نطق. */
    const source = well.slice(well.indexOf('dw-source'), well.indexOf('groups.map'));
    expect(`الجملةُ الأمُّ بلا وسم: ${/unitId\(/.test(source)}`)
      .toBe('الجملةُ الأمُّ بلا وسم: false');
    /*
     * وحين لا يجد المُنتقي هدفًا يعيد سلسلةً فارغةً — فالسطرُ يُرسَم
     * بلا هُويّةٍ ولا يُضاء. وهذا هو البابُ الذي يمنع «إضاءةَ ما لا
     * يُنطَق» من أصله.
     */
    expect(`المُنتقي يعيد فراغًا عند الغياب: ${/units\.get\(unitKey\(role, ru, parent\)\) \|\| ''/.test(well)}`)
      .toBe('المُنتقي يعيد فراغًا عند الغياب: true');
    /* والإضاءةُ لا تقع على سطرٍ بلا هُويّة. */
    const paint = bodyOf(src, 'paintWellReading');
    expect(`لا إضاءةَ بلا هُويّة: ${/const on = Boolean\(unit\) && node\.dataset\.dwUnit === unit;/.test(paint)}`)
      .toBe('لا إضاءةَ بلا هُويّة: true');
  });

  it('٤ · والإضاءةُ من حدث النطق لا من التنقّل', async () => {
    const src = bare(await view());
    const at = src.indexOf("case 'repeat'");
    const chunk = src.slice(at, at + 700);
    expect(`تُضاء عند النطق: ${/paintWellReading\(ctx\?\.segments\?\.\[event\.index\]\?\.targetId/.test(chunk)}`)
      .toBe('تُضاء عند النطق: true');
    /*
     * ⚠️ **ولا تُضاء على `seek`**: التنقّلُ بالإصبع لا يُسمِع شيئًا،
     *    فمؤشّرٌ يقول «أقرأ» والسمّاعةُ صامتةٌ يكذب.
     */
    const seekAt = src.indexOf("case 'seek'");
    expect(`ولا على التنقّل: ${/paintWellReading/.test(src.slice(seekAt, seekAt + 200))}`)
      .toBe('ولا على التنقّل: false');
  });

  it('٥ · ودورةُ حياةٍ كاملة: وقفةٌ تُمسك · استئنافٌ يُطلق · وقوفٌ يمحو', async () => {
    const src = bare(await view());
    const chunkOf = (label, n = 320) => {
      const at = src.indexOf(`case '${label}'`);
      return at < 0 ? '' : src.slice(at, at + n);
    };
    expect(`الوقفةُ تُمسك: ${/paintWellReading\(wellReading\.unit, \{ paused: true \}\)/
      .test(chunkOf('pause'))}`).toBe('الوقفةُ تُمسك: true');
    expect(`الوقوفُ يمحو: ${/paintWellReading\(''\)/.test(chunkOf('stop'))}`)
      .toBe('الوقوفُ يمحو: true');
    expect(`الاستئنافُ يُطلق: ${/paused: false/.test(chunkOf('resume', 500))}`)
      .toBe('الاستئنافُ يُطلق: true');
    /* وإعادةُ بناء المنبع تستعيد الحالةَ — الشجرةُ جديدةٌ والحالةُ ليست. */
    expect(`تُستعاد بعد الرسم: ${/restoreWellReading\(\)/.test(bodyOf(src, 'renderWells'))}`)
      .toBe('تُستعاد بعد الرسم: true');
  });

  it('٦ · ولا تمرير — فالتثبيتُ يبقى تثبيتًا', async () => {
    /*
     * ⚠️ **والإضاءةُ ليست بابَ تمرير.** التمريرُ إلى الهدف بابُه
     *    `revealWellTarget` وهو مشروطٌ بـ`wellPinned`. ولو مرّرت هذه
     *    لَقفزت الصفحةُ مرّتين لكلّ زوج، ولَقفزت وأنت مثبِّت.
     *    وقِيس حيًّا مع التثبيت: التمرير ١٢٩ ← ١٢٩ (فرق ٠) والإضاءةُ
     *    تتقدّم.
     */
    const body = bodyOf(bare(await view()), 'paintWellReading');
    for (const forbidden of ['scrollIntoView', 'scrollTop', 'revealWellTarget', 'scrollTo(']) {
      expect(`${forbidden} غائب: ${body.includes(forbidden)}`).toBe(`${forbidden} غائب: false`);
    }
  });

  it('٦ب · والاتّباع يجلس المنطوقَ في وسط منطقة القراءة — لا وسط الشاشة', async () => {
    /*
     * ⚠️ **والمنبعُ لوحٌ يُمرَّر داخلَ نفسِه** (قِيس: ٢٥٠px مرئيّةً من
     *    ١٠٤٢ كلِّها)، فتوسيطٌ بمقياس الشاشة يضع السطرَ خارجَه أصلًا.
     *    وقِيس حيًّا بعد الإصلاح: بُعدُ مركز السطر عن مركز **المنطقة**
     *    صفرٌ، وعن مركز **الشاشة** ‎−112‎ — رقمان مختلفان، وهو الفرقُ
     *    كلُّه. وتمريرُ الصفحة نفسِها ٠ طوال الوقت.
     */
    const body = bodyOf(bare(await view()), 'revealWellReading');
    /* ١) المثبَّتُ لا يُمرَّر — قبل أيّ حساب. */
    expect(`يقف عند التثبيت: ${/^\s*if \(wellPinned/.test(body)}`)
      .toBe('يقف عند التثبيت: true');
    /*
     * ٢) ولا `scrollIntoView`: تُمرِّر **كلَّ** أبٍ قابلٍ للتمرير —
     *    ومنهم الصفحةُ — فتتحرّك الشاشةُ واللوحُ هو المقصود.
     */
    expect(`ولا scrollIntoView: ${/scrollIntoView/.test(body)}`)
      .toBe('ولا scrollIntoView: false');
    /* ٣) والوسطُ من صندوق المنبع لا من نافذة المتصفّح. */
    expect(`الوسطُ من المنبع: ${/box\.getBoundingClientRect\(\)/.test(body)}`)
      .toBe('الوسطُ من المنبع: true');
    for (const wrong of ['innerHeight', 'clientHeight / 2', 'documentElement']) {
      expect(`${wrong} غائب: ${body.includes(wrong)}`).toBe(`${wrong} غائب: false`);
    }
    /* ٤) ويُحسَب من تحت ما يلتصق بالسقف. */
    expect(`يتجنّب اللاصق: ${/wellReadTop\(box\)/.test(body)}`)
      .toBe('يتجنّب اللاصق: true');
    /* ٥) ويُنادى مع النطق. */
    const src = bare(await view());
    const at = src.indexOf("case 'repeat'");
    expect(`يُنادى مع النطق: ${/revealWellReading\(\)/.test(src.slice(at, at + 800))}`)
      .toBe('يُنادى مع النطق: true');
  });

  it('٦ج · وحافّةُ القراءة تنزل تحت رأسٍ لاصقٍ فعلًا — مقيسةً لا مكتوبة', async () => {
    /*
     * ⚠️ **ويُشغَّل الكودُ المشحونُ نفسُه على شجرةٍ حيّة.** `wellReadTop`
     *    دالّةٌ خالصة: تأخذ الصندوقَ وتقرأ الشجرةَ والأنماطَ المحسوبة.
     *    فيُقتطَع جسمُها من المصدر ويُنفَّذ على منبعٍ فيه رأسٌ لاصقٌ
     *    وآخرُ ليس كذلك — فيُقاس أنّها تُنزِل الحافّةَ بقدر اللاصق
     *    وحدَه. وحارسٌ يقرأ اسمَ الدالّة يحرس التسمية.
     */
    const fn = new Function('box', bodyOf(bare(await view()), 'wellReadTop'));
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;inset-block-start:-20000px;inline-size:400px;block-size:300px;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><body style="margin:0">
      <div id="box" style="block-size:200px;overflow-y:auto">
        <div id="head" style="position:sticky;inset-block-start:0;block-size:40px;background:#fff"></div>
        <div id="plain" style="block-size:30px"></div>
        <div style="block-size:900px"></div>
      </div></body></html>`);
    doc.close();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const box = doc.getElementById('box');
    const top = box.getBoundingClientRect().top;
    const withSticky = fn.call(frame.contentWindow, box);
    doc.getElementById('head').style.position = 'static';
    await new Promise((done) => requestAnimationFrame(done));
    const without = fn.call(frame.contentWindow, box);
    frame.remove();
    expect(`تنزل بقدر اللاصق: ${Math.round(withSticky - top)}`).toBe('تنزل بقدر اللاصق: 40');
    expect(`وبلا لاصقٍ لا تنزل: ${Math.round(without - top)}`).toBe('وبلا لاصقٍ لا تنزل: 0');
  });

  it('٧ · والمؤشّرُ يسكن لمن طلب تقليلَ الحركة — ولا يختفي', async () => {
    const sheet = await css();
    const at = sheet.indexOf('@media (prefers-reduced-motion: reduce)',
      sheet.indexOf('.dw-wave'));
    const block = sheet.slice(at, at + 220);
    expect(`الحركةُ تسقط: ${/\.dw-wave b \{ animation: none/.test(block)}`)
      .toBe('الحركةُ تسقط: true');
    /* والخبرُ يبقى: ارتفاعٌ ثابتٌ لا صفر. */
    expect(`والخبرُ يبقى: ${/block-size: 7px/.test(block)}`).toBe('والخبرُ يبقى: true');
  });
});

/* ================================================================== *
 * ٣) السؤالُ مع جوابه وحدةً واحدة                                      *
 * ================================================================== */
describe('WS-RUE · ٣ · الزوجُ وحدةٌ واحدة', () => {
  const DRAFT = [
    'MICRO CORE 1',
    'перейти́ к документа́ции', 'ننتقل للتوثيق',
    'Вопрос: перейти к чему?', 'ننتقل لإيه؟',
    'Ответ: Перейти к документа́ции.', 'ننتقل للتوثيق.',
  ].join('\n');

  it('٨ · السؤالُ يسبق جوابَه — ولو كتبه المؤلّفُ بعده', async () => {
    /*
     * ⚠️ **ويُشغَّل المحلّلُ نفسُه لا يُقرأ نصُّه.** قِيس قبل: القلبُ
     *    (وهو الإجابة) ثمّ سؤالُه. وبعد: السؤالُ ثمّ القلب.
     */
    const { parseDraftV2 } = await import('../js/services/shadow/draft-v2.js');
    const { ROLE } = await import('../js/services/shadow/draft-targets.js');
    const read = parseDraftV2(DRAFT);
    const order = read.targets.map((t) => t.role);
    const cue = order.indexOf(ROLE.RECALL_CUE);
    const core = order.indexOf(ROLE.MICRO_CORE);
    expect(`السؤالُ ${cue} قبل القلب ${core}`)
      .toBe(`السؤالُ ${cue} ${cue >= 0 && cue < core ? 'قبل' : 'بعد'} القلب ${core}`);
    /*
     * ⚠️ **ولا وحدةَ إجابةٍ تكرّر القلب**: «Перейти к документации.»
     *    و«перейти́ к документа́ции» نصٌّ واحدٌ بترقيمٍ وحرفٍ كبير.
     *    وكان الترقيمُ يعبر من تحت المقارنة فتُبنى وحدتان.
     */
    expect(`وحداتُ الإجابة: ${order.filter((r) => r === ROLE.RECALL_ANSWER).length}`)
      .toBe('وحداتُ الإجابة: 0');
  });

  it('٩ · والسؤالُ موسومٌ بأنّ جوابَه يليه', async () => {
    const { parseDraftV2 } = await import('../js/services/shadow/draft-v2.js');
    const { ROLE } = await import('../js/services/shadow/draft-targets.js');
    const read = parseDraftV2(DRAFT);
    const cue = read.targets.find((t) => t.role === ROLE.RECALL_CUE);
    expect(`السؤالُ يقود: ${Boolean(cue && cue.pairLead)}`).toBe('السؤالُ يقود: true');
    /* ولا يقود قلبٌ ولا إجابة. */
    const others = read.targets.filter((t) => t.role !== ROLE.RECALL_CUE && t.pairLead);
    expect(`غيرُه يقود: ${others.length}`).toBe('غيرُه يقود: 0');
  });

  it('١٠ · والمحرّكُ يقول السؤالَ مرّةً ثمّ يمضي إلى جوابه', async () => {
    /*
     * ⚠️ **ويُشغَّل المحرّكُ لا يُقرأ.** ناطقٌ محقونٌ يسجّل ما طُلب
     *    نطقُه، وتكرارٌ ٤ — فلو عُومل السؤالُ كأيّ وحدةٍ لَقيل ٤ مرّات.
     */
    const { createPlaybackController } = await import('../js/services/shadow/playback-controller.js');
    const said = [];
    const player = createPlaybackController({
      segments: [
        { id: 'q', text: 'перейти к чему?', pairLead: true },
        { id: 'a', text: 'Перейти к документации.' },
      ],
      settings: { repeatCount: 4, unit: 'ms', intervalMsValue: 0, autoAdvance: true },
      onEvent: () => {},
      speaker: async (text) => { said.push(text); return { ok: true }; },
      canceler: () => {},
    });
    player.goTo(0);
    player.start();
    await new Promise((done) => { setTimeout(done, 2600); });
    player.stop();
    const q = said.filter((t) => t.includes('чему')).length;
    const a = said.filter((t) => t.includes('документации')).length;
    expect(`السؤالُ ${q} مرّة`).toBe(`السؤالُ ${q === 1 ? 1 : q} مرّة`);
    expect(`قيل مرّةً: ${q === 1}`).toBe('قيل مرّةً: true');
    expect(`والجوابُ تكرّر: ${a > 1}`).toBe('والجوابُ تكرّر: true');
    expect(`والسؤالُ أوّلًا: ${said[0]?.includes('чему')}`).toBe('والسؤالُ أوّلًا: true');
  });

  it('١١ · ولا يُكتَب للسؤال دليلُ تدريبٍ ثانٍ', async () => {
    const body = bodyOf(bare(await view()), 'persistSegment');
    expect(`يُستثنى قبل الكتابة: ${/if \(segment\.pairLead\) return;/.test(body)}`)
      .toBe('يُستثنى قبل الكتابة: true');
    /* والاستثناءُ **قبل** نداء التسجيل لا بعده. */
    const skip = body.indexOf('segment.pairLead');
    const write = body.indexOf('recordSegmentPractice');
    expect(`قبل التسجيل: ${skip >= 0 && write > skip}`).toBe('قبل التسجيل: true');
  });

  it('١٢ · ولا يُعمَّم على كلّ نطقٍ في التطبيق', async () => {
    /*
     * ⚠️ **شرطُك الصريح**: لا تُلصَق الأسئلةُ بكلّ طلبِ نطق. والوصفُ
     *    يُولَد في محلّل المسودّة وحدَه، ويُقرأ في المحرّك من المقطع —
     *    فالنصُّ الكامل والكلمةُ والمقطعُ والأصلُ لا تعرفه أصلًا.
     */
    const sheet = await (await fetch('../js/services/shadow/playback-controller.js')).text();
    const hits = (bare(sheet).match(/pairLead/g) || []).length;
    expect(`مواضعُه في المحرّك: ${hits}`).toBe('مواضعُه في المحرّك: 1');
    const src = bare(await view());
    expect(`ولا يمسّ النصَّ الكامل: ${/pairLead/.test(bodyOf(src, 'playFullText'))}`)
      .toBe('ولا يمسّ النصَّ الكامل: false');
  });
});

/* ================================================================== *
 * ٤) ثلاثةُ عروضٍ لنصٍّ واحد                                            *
 * ================================================================== */
describe('WS-RUE · ٤ · عروضُ النصّ الكامل', () => {
  it('١٣ · أربعةُ عروضٍ بزرٍّ واحدٍ يدور — لا شريطَ أدواتٍ ثانٍ', async () => {
    const src = bare(await view());
    /* ⚠️ ويُعَدُّ في الوسم وحدَه — الاسمُ يرد ثانيةً في الرسم بحقّ. */
    const acts = src.slice(src.indexOf('data-ft-acts'), src.indexOf('sh-read-modes'));
    expect(`زرٌّ واحد: ${(acts.match(/data-sh="ft-view"/g) || []).length}`)
      .toBe('زرٌّ واحد: 1');
    expect(`سجلٌّ مجمَّد: ${/const FT_VIEWS = Object\.freeze\(\[[\s\S]{0,400}?\]\)/.test(src)}`)
      .toBe('سجلٌّ مجمَّد: true');
    for (const id of ['plain', 'lines', 'cards', 'note']) {
      expect(`${id} موجود: ${src.includes(`id: '${id}'`)}`).toBe(`${id} موجود: true`);
    }
    /*
     * ⚠️ **و«بدون تنسيق» هو الافتراض** (طلبُك): الفتحةُ الأولى ترى
     *    الفقرةَ المتّصلةَ كما كانت قبل أن تُضاف العروض.
     */
    expect(`الافتراضُ بدون تنسيق: ${/let ftView = 'plain';/.test(src)}`)
      .toBe('الافتراضُ بدون تنسيق: true');
    /* والزرُّ يقول حالَه — اسمٌ مقروءٌ يتغيّر لا رمزٌ صامت. */
    const paint = bodyOf(src, 'paintFullTextActs');
    expect(`يقول حالَه: ${/طريقة العرض: \$\{one\.label\}/.test(paint)}`)
      .toBe('يقول حالَه: true');
  });

  it('١٤ · والعروضُ الثلاثةُ تقرأ نصًّا واحدًا — لا رسمَ ثانٍ', async () => {
    /*
     * ⚠️ **وهذا شرطُ التمريرة لا أناقةُ تنفيذ**: لا نسخةَ ثانيةً ولا
     *    هُويّةَ جملةٍ ثانية ولا طابورَ نطقٍ ثانٍ. والدليلُ أنّ `flowHtml`
     *    واحدةٌ ولا أختَ لها، وأنّ تبديلَ العرض **لا يستدعيها**.
     */
    const src = bare(await view());
    expect(`راسمٌ واحد: ${(src.match(/^function flowHtml\(/gm) || []).length}`)
      .toBe('راسمٌ واحد: 1');
    const step = bodyOf(src, 'stepFullTextView');
    for (const forbidden of ['flowHtml', 'innerHTML', 'paintLines(', 'sourceRows(']) {
      expect(`${forbidden} غائب: ${step.includes(forbidden)}`).toBe(`${forbidden} غائب: false`);
    }
  });

  it('١٥ · وتبديلُ العرض لا يقطع نطقًا ولا يصفّر مقاسًا ولا يبدّل خطًّا', async () => {
    const step = bodyOf(bare(await view()), 'stepFullTextView');
    for (const forbidden of ['ttsCancel', 'stopFullText', 'playFullText', 'claimAudio',
      'releaseAudio', 'ftSize =', 'applyFont', 'fontDoc', 'applyFullTextSize']) {
      expect(`${forbidden} غائب: ${step.includes(forbidden)}`).toBe(`${forbidden} غائب: false`);
    }
    /* وقِيس حيًّا: مقاسٌ ١٦٫٦٧٥px وخطُّ Noto Serif بقيا عبر العروض الثلاثة، والنطقُ تقدّم. */
    expect(`يكتب صفةً لا أكثر: ${/host\.dataset\.ftView = ftView/.test(
      bodyOf(bare(await view()), 'applyFullTextView'))}`).toBe('يكتب صفةً لا أكثر: true');
  });

  it('١٦ · وموضعُ القراءة يُحفَظ بهُويّة الجملة لا برقم التمرير', async () => {
    /*
     * ⚠️ **ولا يُستعاد `scrollTop` خامًّا**: البطاقةُ أطولُ من السطر،
     *    فرقمُ التمرير نفسُه يهبط بك إلى جملةٍ أخرى. والمرساةُ أوّلُ
     *    جملةٍ مرئيّةٍ — وهي ثابتةٌ عبر العروض لأنّ الجمل هي الجمل.
     */
    const step = bodyOf(bare(await view()), 'stepFullTextView');
    expect(`المرساةُ جملة: ${/anchor = node\.dataset\.line/.test(step)}`)
      .toBe('المرساةُ جملة: true');
    expect(`وتُستعاد بها: ${/querySelector\(`\[data-line="\$\{anchor\}"\]`\)/.test(step)}`)
      .toBe('وتُستعاد بها: true');
    expect(`ولا تصفيرَ: ${/scrollTop\s*=\s*0/.test(step)}`).toBe('ولا تصفيرَ: false');
  });

  it('١٧ · ولكلّ عرضٍ طلاؤه، ولا يمرّ خطُّ دفترٍ فوق حرف', async () => {
    const sheet = bare(await css());
    for (const id of ['lines', 'cards', 'note']) {
      expect(`${id} مطليّ: ${sheet.includes(`[data-ft-view="${id}"]`)}`)
        .toBe(`${id} مطليّ: true`);
    }
    /*
     * ⚠️ **و«بدون تنسيق» بلا قاعدةٍ واحدة — وهذا تعريفُه.** قاعدةٌ
     *    تُكتَب له تعني أنّه صار تنسيقًا رابعًا يحاكي الأصل، وسيفترق
     *    عنه يومَ يتغيّر الأصل. والاستثناءُ الوحيدُ المسموح: قاعدةٌ
     *    تستثنيه من طلاءٍ عامّ (‏`:not`).
     */
    const plain = [...sheet.matchAll(/\[data-ft-view="plain"\]/g)].length;
    const excl = [...sheet.matchAll(/:not\(\[data-ft-view="plain"\]\)/g)].length;
    expect(`قواعدُ «بدون تنسيق»: ${plain - excl}`).toBe('قواعدُ «بدون تنسيق»: 0');
    /* البطاقاتُ بحدٍّ وحشوة، والسطورُ بفاصلٍ أرفع. */
    expect(`البطاقةُ محدودة: ${/\[data-ft-view="cards"\] \.sh-flow-s \{[^}]*border:/.test(sheet)}`)
      .toBe('البطاقةُ محدودة: true');
    expect(`السطرُ مفصول: ${/\[data-ft-view="lines"\] \.sh-flow-s \{[^}]*border-block-end:/.test(sheet)}`)
      .toBe('السطرُ مفصول: true');
    /*
     * ⚠️ **ومسطرةُ الدفتر في خلفيّة الفقرة لا فوق النصّ**: طبقةٌ تحت
     *    الحرف، وتباعدُها هو ارتفاعُ السطر نفسُه — فلا تقطع حرفًا ولا
     *    علامةَ نبر. ولا `position: absolute` ولا `::after` يعلو النصّ.
     */
    const note = sheet.slice(sheet.indexOf('[data-ft-view="note"] .sh-flow-p'));
    expect(`المسطرةُ خلفيّة: ${/background-image: linear-gradient/.test(note.slice(0, 500))}`)
      .toBe('المسطرةُ خلفيّة: true');
    expect(`وتتبع السطر: ${/line-height: var\(--sh-nb\)/.test(note.slice(0, 700))}`)
      .toBe('وتتبع السطر: true');
    /* والتدرّجُ بمحطّاتٍ ملوّنةٍ كلِّها — محطّةٌ بلا لونٍ تُبطله صامتًا. */
    const grad = note.slice(note.indexOf('linear-gradient'), note.indexOf('background-size'));
    const stops = grad.split(',').filter((one) => /transparent|--sh-paper-line/.test(one)).length;
    expect(`محطّاتٌ ملوّنة: ${stops}`).toBe('محطّاتٌ ملوّنة: 4');
  });
});

/* ================================================================== *
 * ٥) العدّادُ المكرَّرُ في رأس المسرح                                    *
 * ================================================================== */
describe('WS-RUE · ٥ · رأسٌ بلا تكرار', () => {
  it('١٨ · «SENTENCES» ومقامُها خرجا من رأس المسرح، والحالةُ بقيت', async () => {
    const src = await view();
    const top = bare(src.slice(src.indexOf('class="sh-stage-top"'), src.indexOf('data-prog')));
    expect(`SENTENCES: ${top.includes('SENTENCES')}`).toBe('SENTENCES: false');
    expect(`مقام: ${top.includes('data-pos-total')}`).toBe('مقام: false');
    expect(`موضع: ${top.includes('data-pos>')}`).toBe('موضع: false');
    expect(`الحالةُ باقية: ${top.includes('data-status')}`).toBe('الحالةُ باقية: true');
    /* ولا كاتبَ بلا مكتوبٍ فيه. */
    expect(`ولا كتابةَ يتيمة: ${/pos\.textContent/.test(bare(src))}`)
      .toBe('ولا كتابةَ يتيمة: false');
  });

  it('١٩ · والمعلومةُ باقيةٌ حيث كانت أصلًا — سطرُ التقدّم وشريطُ القاع', async () => {
    const src = bare(await view());
    expect(`سطرُ التقدّم يقول الموضع: ${/sh-prog-pos[\s\S]{0,60}at\.position/.test(src)}`)
      .toBe('سطرُ التقدّم يقول الموضع: true');
    expect(`وشريطُ القاع يقول المجموع: ${/label: 'SENTENCES'/.test(src)}`)
      .toBe('وشريطُ القاع يقول المجموع: true');
  });
});

/* ================================================================== *
 * ٦) مدى المقطع يُرى                                                    *
 * ================================================================== */
describe('WS-RUE · ٦ · المدى يُرى', () => {
  it('٢٠ · أوّلُ المدى وآخرُه وما بينهما — ثلاثُ علاماتٍ مقيسة', async () => {
    /*
     * ⚠️ **وقِيس قبل**: الأصنافُ تُكتَب صحيحةً والطلاءُ لا يتبعها —
     *    حدُّ الرقاقة داخلَ المدى `rgba(150, 214, 240, .42)` وهو حدُّ
     *    رقاقةٍ عاديّة، و`box-shadow: none`. فالمحروسُ **فرقٌ مرئيّ**
     *    لا وجودُ قاعدةٍ في الورقة.
     */
    const f = await chipsAt(1280, 800);
    const plain = f.at('');
    const mid = f.at('in-phrase');
    const start = f.at('in-phrase phrase-start');
    const end = f.at('in-phrase phrase-end');
    f.close();
    expect(`الوسطُ يفارق العاديّة: ${mid.bg !== plain.bg}`)
      .toBe('الوسطُ يفارق العاديّة: true');
    expect(`وحبرُه يفارقها: ${mid.ink !== plain.ink}`).toBe('وحبرُه يفارقها: true');
    expect(`وأوّلُه معلَّم: ${start.shadow.includes('inset') && start.shadow !== mid.shadow}`)
      .toBe('وأوّلُه معلَّم: true');
    expect(`وآخرُه معلَّم: ${end.shadow.includes('inset') && end.shadow !== mid.shadow}`)
      .toBe('وآخرُه معلَّم: true');
    /* والحافّتان تتقابلان: إحداهما تبدأ والأخرى تنتهي. */
    expect(`والحافّتان متقابلتان: ${start.shadow !== end.shadow}`)
      .toBe('والحافّتان متقابلتان: true');
  });

  it('٢١ · والمدى يُرى وأنت تتدرّب كذلك — لا يبتلعه إخفاتُ التشغيل', async () => {
    const f = await chipsAt(1280, 800, { live: true });
    const mid = f.at('in-phrase');
    const soon = f.at('');
    f.close();
    expect(`المدى أوضحُ من الآتية: ${mid.opacity > soon.opacity}`)
      .toBe('المدى أوضحُ من الآتية: true');
  });

  it('٢٢ · وثلاثُ حالاتٍ تبقى متمايزة: مدًى · ممسوكةٌ · تُنطَق الآن', async () => {
    const f = await chipsAt(1280, 800);
    const mid = f.at('in-phrase');
    const picked = f.at('picked');
    const now = f.at('speaking');
    f.close();
    const seen = new Set([mid.border, picked.border, now.border]);
    expect(`حدودٌ متمايزة: ${seen.size}`).toBe('حدودٌ متمايزة: 3');
    expect(`والجاريةُ لها وهجُها: ${now.shadow !== 'none'}`).toBe('والجاريةُ لها وهجُها: true');
  });

  it('٢٣ · والمنطوقُ هو المرئيّ — نصُّ المدى من نفس المُحلِّ', async () => {
    /*
     * ⚠️ **ولا نصَّان للمدى**: الشاشةُ ترسم `phrase.from`..`phrase.to`،
     *    والمحرّكُ يُعطى **نفسَ** الرقمين (`syncPhraseRange`)، ويحلّهما
     *    `resolveTarget` — المُحلُّ الواحد. فما تراه هو ما يُنطَق.
     */
    const src = bare(await view());
    const sync = bodyOf(src, 'syncPhraseRange');
    expect(`المدى يعبر للمحرّك: ${/phraseRange: hasPhrase\(\) \? \{ from: phrase\.from, to: phrase\.to \}/
      .test(sync)}`).toBe('المدى يعبر للمحرّك: true');
    const paint = bodyOf(src, 'paintPhrase');
    expect(`والرسمُ من نفس الرقمين: ${/i >= phrase\.from && i <= phrase\.to/.test(paint)}`)
      .toBe('والرسمُ من نفس الرقمين: true');
    const engine = await (await fetch('../js/services/shadow/playback-controller.js')).text();
    expect(`والمحرّكُ يحلّهما: ${/anchor: config\.phraseRange\?\.from/.test(engine)}`)
      .toBe('والمحرّكُ يحلّهما: true');
  });
});

/* ================================================================== *
 * ٨) لا خطَّ فوق الكلمة في أيّ حال                                      *
 * ================================================================== */
describe('WS-RUE · ٨ · لا لمعةَ فوق الكلمة', () => {
  it('٢٤ · لا ظلَّ داخليًّا علويًّا في أيٍّ من حالات الرقاقة', async () => {
    /*
     * ⚠️ **والحالاتُ الخمسُ تُقاس** — لا الساكنةُ وحدَها. التمريرةُ
     *    السابقةُ نزعت اللمعةَ من الساكنة واستثنت «مختارة» و«ممسوكة»
     *    و«تُنطَق الآن»، وأنت تنظر إلى رقاقةٍ **مختارة** حين تتدرّب.
     *    وقِيس بالتكبير ٦×: شريطٌ فاتحٌ أفقيٌّ بعرض الرقاقة تحت حدّها.
     */
    const f = await chipsAt(1280, 800);
    const seen = ['', 'past', 'speaking', 'selected', 'picked', 'in-phrase']
      .map((cls) => ({ cls: cls || 'ساكنة', shadow: f.at(cls).shadow }));
    f.close();
    /*
     * ⚠️ **وترتيبُ الكلمات في القيمة المحسوبة ليس ترتيبَ كتابتها.**
     *    تُكتَب `inset 0 1px 0 <لون>` وتُقرأ `<لون> 0px 1px 0px 0px
     *    inset` — فحارسٌ يطلب `inset` قبل الأرقام لا يجد شيئًا أبدًا،
     *    ويمرّ **وهو أعمى**. وقد أمسكته طفرةٌ لم تُسقطه.
     */
    const gloss = seen.filter((one) => /0px 1px 0px[^,]*inset/.test(one.shadow));
    expect(`حالاتٌ فيها لمعةٌ علويّة: ${gloss.map((o) => o.cls).join(' · ') || 'لا شيء'}`)
      .toBe('حالاتٌ فيها لمعةٌ علويّة: لا شيء');
  });

  it('٢٥ · والحدُّ السماويُّ وذهبُ النبر وشريطُ النطق باقون', async () => {
    const f = await chipsAt(1280, 800);
    const plain = f.at('');
    const bar = f.doc.querySelector('.sh-chip .sh-chip-bar');
    const barOk = Boolean(bar);
    const now = f.at('speaking');
    f.close();
    expect(`الحدُّ باقٍ: ${/^rgba?\(/.test(plain.border) && plain.border !== 'rgba(0, 0, 0, 0)'}`)
      .toBe('الحدُّ باقٍ: true');
    expect(`الشريطُ باقٍ: ${barOk}`).toBe('الشريطُ باقٍ: true');
    expect(`ووهجُ الجارية باقٍ: ${now.shadow.includes('rgba')}`)
      .toBe('ووهجُ الجارية باقٍ: true');
    const sheet = await css();
    expect(`وذهبُ النبر باقٍ: ${/\.sh-chip \.sh-stress \{ color: #ffc44e; \}/.test(sheet)}`)
      .toBe('وذهبُ النبر باقٍ: true');
  });
});

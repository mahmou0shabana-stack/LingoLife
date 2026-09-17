/**
 * WS-CCCS — أرقامُ الذيل تتبع التبويبَ المفتوح، وكلُّ رقمٍ من مصدره.
 *
 * ⚠️ **ولا يُكتفى بقراءة المصدر هنا.** عرفُ هذا المستودع في كلّ ما
 *    يخصّ `shadow-view.js` أن يُقاس **العلاقة** في النصّ، لأنّ الشاشةَ
 *    لا تُركَّب في العدّاء (تحتاج جلسةً وقاعدةً ومحرّكَ نطق). لكنّ
 *    دالّتَي القرار هنا **خالصتان**: تأخذان صفوفًا وتعيدان أرقامًا.
 *    فتُقتطَعان من الملفّ وتُشغَّلان فعلًا على شجرةٍ حقيقيّة — سلوكٌ
 *    مقيسٌ لا نصٌّ مُطابَق. والباقي (مواضعُ النداء) علاقاتٌ في المصدر،
 *    وقد أُثبت عضُّها بطفرات.
 */
import { describe, it, expect } from './test-runner.js';

let SRC = '';
const view = async () => {
  if (!SRC) SRC = await (await fetch('../js/views/shadow-view.js')).text();
  return SRC;
};

/** جسمُ دالّةٍ كاملًا — من رأسها إلى قوسها المُغلِق في العمود صفر. */
function declOf(src, header) {
  const at = src.indexOf(header);
  if (at < 0) return '';
  const end = src.indexOf('\n}', at);
  return end < 0 ? src.slice(at) : `${src.slice(at, end)}\n}`;
}

/**
 * يبني الدالّةَ المقتطَعةَ بمحيطٍ مُصطنَع.
 *
 * ⚠️ **والمحيطُ أقلُّ ما تحتاجه لا نسخةٌ من الشاشة**: اسمُ التبويب،
 *    وجدولُ الأدوار، وحالةُ العرض، ومُقسِّمُ الجمل. فما زاد عن ذلك
 *    كان سيجعل الحارسَ يختبر مُحاكاتي لا شيفرتَكم.
 */
function build(src, header, name, env = {}) {
  const decl = declOf(src, header);
  if (!decl) return null;
  const keys = Object.keys(env);
  const make = new Function(...keys, `${decl}\n return ${name};`);
  return make(...keys.map((k) => env[k]));
}

const ROLE = { MICRO_CORE: 'micro_core', EXPANSION: 'expansion' };
const splitSentences = (text) => String(text).split(/[.!?]+/).filter((s) => s.trim());

const DRAFT_ROWS = [{
  model: { counts: { byRole: { micro_core: 3, expansion: 2 }, speech: 8, done: 2 } },
}];

describe('WS-CCCS · أرقامُ الذيل تتبع التبويب', () => {
  it('١ · الصفُّ يُرسَم من الحالة لا يُجمَّد في القالب', async () => {
    /*
     * ⚠️ **العطبُ المقيس**: الأرقامُ الثلاثةُ كانت مكتوبةً داخل قالب
     *    `shell()` — تُحسَب مرّةً عند بناء الهيكل ثمّ لا يمسّها شيء.
     *    قِيس على ثلاثة مقاسات وخمسة تبويبات: «3 SENTENCES · 23 WORDS ·
     *    0 REPS» في كلّها، والمسودّةُ تحتها ثمانُ بطاقات.
     */
    const src = await view();
    const shell = declOf(src, 'function shell()');
    expect(`الصندوقُ موصول: ${/class="sh-stats" data-stats/.test(shell)}`)
      .toBe('الصندوقُ موصول: true');
    /* ولا وسمٌ مكتوبٌ بيدٍ داخلَ القالب — الوسومُ من المُحلِّل وحدَه. */
    expect(`وسومٌ مجمَّدة: ${/<span class="sh-mono">SENTENCES<\/span>/.test(shell)}`)
      .toBe('وسومٌ مجمَّدة: false');
  });

  it('٢ · والرسمُ يقع في مخرجَي «رسمِ المنابع» كليهما', async () => {
    /*
     * ⚠️ **ومخرجان لا مخرجٌ واحد**: «النصّ» يخرج من `renderWells` من
     *    بابٍ مبكّر (`return` بعد كشف الوجوه)، وبقيّةُ التبويبات من
     *    الذيل. فكتابةُ النداء في أحدهما تترك أرقامَ «مسودّة» معروضةً
     *    بعد الرجوع إلى «النصّ».
     */
    const src = await view();
    const body = declOf(src, 'async function renderWells()');
    expect(body.length > 400).toBe(true);
    const calls = (body.match(/paintBottomStats\(\)/g) || []).length;
    expect(`نداءاتٌ ${calls >= 2}`).toBe('نداءاتٌ true');
    /*
     * ⚠️ **ولا يُقاس بترتيب أوّلِ `return` في الجسم**: أوّلُها حارسُ
     *    المدخل (`if (!tabs || !body …) return;`) قبل كلّ شيء — فقِستُ
     *    به أوّلًا فسقط الحارسُ على عطبٍ لا وجودَ له. والمقصودُ بابُ
     *    «النصّ» بعينه: ما بين كشفِ الوجوه ونهايةِ ذلك الفرع.
     */
    const faces = body.indexOf('renderFaces();');
    const branch = body.slice(faces, body.indexOf('return;', faces));
    expect(`بابُ «النصّ» يرسم ${faces > 0 && /paintBottomStats\(\)/.test(branch)}`)
      .toBe('بابُ «النصّ» يرسم true');
  });

  it('٣ · ولا قراءةَ قاعدةٍ ثانية: الصفوفُ هي التي قُرئت للتبويبات', async () => {
    /*
     * ⚠️ `renderWells` تقرأ كلَّ المنابع في كلّ رسمٍ أصلًا لتكتب أعدادَ
     *    الشارات. فأرقامُ الذيل تُشتقّ من تلك الصفوف نفسِها — ولو
     *    فُتح استعلامٌ ثانٍ لَصار للرقم الواحد مصدران يفترقان.
     */
    const src = await view();
    const wells = declOf(src, 'async function renderWells()');
    expect(`تُحفَظ الصفوف: ${/wellRows = counts/.test(wells)}`).toBe('تُحفَظ الصفوف: true');
    const paint = declOf(src, 'function paintBottomStats()');
    expect(`لا قراءةَ في الرسم: ${/\.read\(/.test(paint)}`).toBe('لا قراءةَ في الرسم: false');
  });

  it('٤ · و«مسودّة» تقول قلوبًا وأهدافًا ومنجَزًا — من عدّادها القائم', async () => {
    /*
     * ⚠️ **ولا عدٌّ جديد**: `countsOf` في `draft-learning.js` تحسب
     *    `byRole` و`speech` و`done` مع كلّ نموذج، وفوقها مكتوبٌ «لا
     *    مجموعَ بلا تفصيله». فعدٌّ ثانٍ هنا كان رقمين لشيءٍ واحد.
     *
     * وهذا الحارسُ **يشغّل الدالّةَ نفسَها** على نموذجٍ مصنوع.
     */
    const src = await view();
    const fn = build(src, 'function wellStatItems(rows)', 'wellStatItems',
      { well: 'draft', ROLE, refView: null, splitSentences });
    const out = fn(DRAFT_ROWS);
    expect(out.map((x) => x.label).join(',')).toBe('CORES,TARGETS,DONE');
    expect(out.map((x) => x.n).join(',')).toBe('3,8,2');
    /* ومسودّةٌ بلا نموذجٍ لا تخترع صفرًا موسومًا. */
    expect(`بلا نموذج: ${fn([]).length}`).toBe('بلا نموذج: 0');
  });

  it('٥ · وكلُّ تبويبٍ يقول ما يعدّ — أو لا يقول رقمًا', async () => {
    const src = await view();
    const of = (well, rows) => build(src, 'function wellStatItems(rows)', 'wellStatItems',
      { well, ROLE, refView: null, splitSentences })(rows);

    const rules = of('rules', [
      { pinned: 1, images: [{}, {}] }, { pinned: 0, images: [] }, { images: [{}] },
    ]);
    expect(rules.map((x) => `${x.label}:${x.n}`).join(' ')).toBe('RULES:3 PINNED:1 IMAGES:3');

    const scripts = of('scripts', [{ text: 'Один. Два.' }, { text: 'Три.' }]);
    expect(scripts.map((x) => `${x.label}:${x.n}`).join(' ')).toBe('SCRIPTS:2 SENTENCES:3');

    const images = of('images', [
      { refScope: 'scene' }, { refScope: 'reference' }, { refScope: 'scene' },
    ]);
    expect(images.map((x) => `${x.label}:${x.n}`).join(' ')).toBe('SCENE:2 REFERENCE:1');

    const voices = of('voices', [{}, {}]);
    expect(voices.map((x) => `${x.label}:${x.n}`).join(' ')).toBe('RECORDINGS:2');

    /*
     * ⚠️ **و«الملخّص» لا يُملأ برقمٍ لا يعرفه**: العارضُ وحدَه يعرف
     *    عددَ صفحات الملفّ، والشاشةُ تعرف **صفحتَك** المحفوظة. فيُقال
     *    ما يُعرَف ويُسكَت عمّا لا — وبلا ملفٍّ لا رقمَ أصلًا.
     */
    const docNone = build(src, 'function wellStatItems(rows)', 'wellStatItems',
      { well: 'doc', ROLE, refView: null, splitSentences })([]);
    expect(`بلا ملفّ: ${docNone.length}`).toBe('بلا ملفّ: 0');
    const docAt = build(src, 'function wellStatItems(rows)', 'wellStatItems',
      { well: 'doc', ROLE, refView: { doc: { page: 7 } }, splitSentences })([{ id: 'f' }]);
    expect(docAt.map((x) => `${x.label}:${x.n}`).join(' ')).toBe('PAGE:7');
  });

  it('٦ · والرقمُ ووصفُه يخرجان معًا — فلا «23» تحت «CORES»', async () => {
    /*
     * ⚠️ **شرطُك الصريح**: «متسبش الوسوم القديمة والقيم بقت بتقول حاجة
     *    تانية». فالرقمُ ووصفُه عنصرٌ واحدٌ في الصفّ، والصفُّ كلُّه
     *    يُستبدَل — ويُقاس ذلك على **شجرةٍ حقيقيّة** لا على نصّ.
     */
    const src = await view();
    const statsHtml = build(src, 'function statsHtml(items)', 'statsHtml', {});
    const host = document.createElement('div');
    host.innerHTML = statsHtml([{ n: 3, label: 'CORES' }, { n: 8, label: 'TARGETS' }]);
    const pairs = [...host.children].map((row) => `${row.querySelector('b').textContent}:`
      + `${row.querySelector('span').textContent}`);
    expect(pairs.join(' ')).toBe('3:CORES 8:TARGETS');
    /* والاستبدالُ التالي لا يترك شيئًا من الأوّل. */
    host.innerHTML = statsHtml([{ n: 30, label: 'SENTENCES' }]);
    expect(`بقايا ${host.textContent.includes('CORES')}`).toBe('بقايا false');
    expect(`أزواجٌ ${host.querySelectorAll('b').length}/${host.querySelectorAll('span').length}`)
      .toBe('أزواجٌ 1/1');
  });

  it('٧ · وتبويبٌ بلا عددٍ صادقٍ يقول ذلك بكلمة لا برقم', async () => {
    /*
     * ⚠️ **وهو عرفُ هذا الملفّ منذ «85% ACCURACY»** (بند ٨٩): رقمٌ لا
     *    مصدر له لا يُعرَض ولا يُستبدَل بتقديرٍ يبدو علمًا. فالفراغُ
     *    يُملأ بكلمةٍ تقول الحقيقة، لا بصفرٍ موسومٍ يوحي بمسودّةٍ فارغة.
     */
    const src = await view();
    const paint = declOf(src, 'function paintBottomStats()');
    expect(`يُفرَّق بين الحالتين: ${/items\.length/.test(paint)}`)
      .toBe('يُفرَّق بين الحالتين: true');
    expect(`وكلمةٌ لا رقم: ${/STAT_EMPTY\[well\]/.test(paint) && /sh-stat-note/.test(paint)}`)
      .toBe('وكلمةٌ لا رقم: true');
    /* والكلماتُ موجودةٌ لمن يستحقّها. */
    const table = src.slice(src.indexOf('const STAT_EMPTY'), src.indexOf('};', src.indexOf('const STAT_EMPTY')));
    for (const well of ['draft', 'doc']) expect(table).toContain(`${well}:`);
  });

  it('٨ · و«النصّ» يبقى على أرقامه — لم يُنقَض ما كان صادقًا', async () => {
    const src = await view();
    const fn = build(src, 'function sourceStatItems()', 'sourceStatItems', {
      ctx: {
        session: { totalRepetitions: 12 },
        segments: [{ sourceTextSnapshot: 'Один два' }, { sourceTextSnapshot: 'Три' }],
      },
      splitWords: (t) => String(t).split(/\s+/).filter(Boolean),
    });
    const out = fn();
    expect(out.map((x) => `${x.label}:${x.n}`).join(' ')).toBe('SENTENCES:2 WORDS:3 REPS:12');
  });
});

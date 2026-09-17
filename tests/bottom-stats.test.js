/**
 * WS-CSFIM — أرقامُ الذيل: مسودّةُ ما تدرسه إن وُجدت، وإلّا النصّ.
 *
 * ⚠️ **وهذا الملفُّ وُلد في WS-CCCS بقاعدةٍ أضيق** («أرقامُ التبويب
 *    المفتوح») ثمّ صُحِّحت بطلبك. فالحرّاسُ أُعيد توجيهُهم إلى القاعدة
 *    الصحيحة، ولم يُحذَف منهم إلّا ما صار يحرس سلوكًا نُقض عمدًا.
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

const DRAFT_MODEL = { counts: { byRole: { micro_core: 3, expansion: 2 }, speech: 8, done: 2 } };

describe('WS-CSFIM · أرقامُ الذيل: مسودّةٌ إن وُجدت وإلّا النصّ', () => {
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

  it('٢ · والمصدرُ يتبع الجملةَ لا التبويبَ المفتوح', async () => {
    /*
     * ⚠️ **وهذا تصحيحُ فهمي لا زيادةٌ عليه** (WS-CSFIM). الطورُ السابق
     *    ربط الأرقامَ بالتبويب المفتوح، وبلاغُك الثاني قال القاعدةَ
     *    بدقّة: **مسودّةُ ما تدرسه إن وُجدت، وإلّا النصّ**. والفرقُ
     *    مقيسٌ: تقرأ في تبويب «النصّ» جملةً لها مسودّةٌ كاملة فيقول
     *    الذيلُ «٣ جمل · ٢٣ كلمة» — رقمٌ صادقٌ عن شيءٍ لا تنظر إليه.
     *
     * ⚠️ **والنداءُ خارج شرط `well === 'draft'`**: `renderWells` لا
     *    تُعاد عند نقلة الجملة إلّا في ذلك التبويب، فلو عُلِّق الرسمُ
     *    بها لَبقيت أرقامُ الجملة الأولى وأنت في الثالثة.
     */
    const src = await view();
    const sync = declOf(src, 'function syncSegment()');
    expect(sync.length > 200).toBe(true);
    /*
     * ⚠️ **ويُقاس موضعُ السطر لا وجودُه**: نداءٌ داخلَ `if (well === 'draft')`
     *    يقرأ صحيحًا في العين ولا يعمل إلّا في تبويبٍ واحد. فالمطلوبُ
     *    سطرٌ في **جسم الدالّة** نفسِه — بمسافةِ بادئةٍ من مستواه.
     */
    const bodyLevel = /\n  refreshBottomStats\(\)/.test(sync);
    const inside = /if \(well === 'draft'\)[^\n]*refreshBottomStats/.test(sync);
    expect(`في جسم الدالّة ${bodyLevel} · داخل شرطِ التبويب ${inside}`)
      .toBe('في جسم الدالّة true · داخل شرطِ التبويب false');
  });

  it('٣ · ولا قراءةَ قاعدةٍ ثانية في نفس الدورة', async () => {
    /*
     * ⚠️ `renderWells` تقرأ صفوفَ «مسودّة» لتوّها (`WELLS.draft.read`
     *    هي `activeDraftModel` نفسُها)، فتُمرِّرها للذيل بدل أن يقرأ
     *    هو مرّةً ثانية. والنموذجُ في الحالتين مخزَّنٌ بالمراجعة.
     */
    const src = await view();
    const wells = declOf(src, 'async function renderWells()');
    expect(`يُمرَّر الصفُّ المقروء: ${/refreshBottomStats\(counts\.draft\?\.\[0\]/.test(wells)}`)
      .toBe('يُمرَّر الصفُّ المقروء: true');
    const paint = declOf(src, 'function paintBottomStats()');
    expect(`لا قراءةَ في الرسم: ${/\.read\(|await /.test(paint)}`).toBe('لا قراءةَ في الرسم: false');
  });

  it('٤ · ومسودّةٌ موجودة ⇒ قلوبٌ وأهدافٌ ومنجَز — من عدّادها القائم', async () => {
    /*
     * ⚠️ **ولا عدٌّ جديد**: `countsOf` في `draft-learning.js` تحسب
     *    `byRole` و`speech` و`done` مع كلّ نموذج، وفوقها مكتوبٌ «لا
     *    مجموعَ بلا تفصيله». فعدٌّ ثانٍ هنا رقمان لشيءٍ واحدٍ يفترقان.
     */
    const src = await view();
    const fn = build(src, 'function draftStatItems(model)', 'draftStatItems', { ROLE });
    const out = fn(DRAFT_MODEL);
    expect(out.map((x) => x.label).join(',')).toBe('CORES,TARGETS,DONE');
    expect(out.map((x) => x.n).join(',')).toBe('3,8,2');
  });

  it('٥ · ولا مسودّةَ ⇒ أرقامُ النصّ كما كانت', async () => {
    /*
     * ⚠️ **وهذا نصفُ القاعدة الذي سقط في الطور السابق**: كان تبويبُ
     *    «مسودّة» بلا مسودّةٍ يقول «لسّه مفيش مسودّة» بدل أن يقول
     *    أرقامَ النصّ. فالبديلُ الآن صريحٌ في الرسم: إن خلت قائمةُ
     *    المسودّة رُسمت قائمةُ النصّ.
     */
    const src = await view();
    const fn = build(src, 'function draftStatItems(model)', 'draftStatItems', { ROLE });
    expect(`بلا نموذج: ${fn(null).length}`).toBe('بلا نموذج: 0');
    expect(`بلا عدّاد: ${fn({}).length}`).toBe('بلا عدّاد: 0');
    const paint = declOf(src, 'function paintBottomStats()');
    expect(`البديلُ مكتوب: ${/draft\.length \? draft : sourceStatItems\(\)/.test(paint)}`)
      .toBe('البديلُ مكتوب: true');
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

  it('٧ · ولا خريطةَ أرقامٍ لكلّ تبويب — الذيلُ يصف ما تدرسه', async () => {
    /*
     * ⚠️ **وهذه إزالةُ زيادةٍ منّي لا ميزةٍ منك.** كنتُ قد أعطيتُ كلَّ
     *    تبويبٍ أرقامَه (قواعدُ · سكريبتات · صور · أصوات · صفحةُ ملفّ)،
     *    وهي عينُ «الحالات المختلطة» التي شكوتَ منها: تفتح «القواعد»
     *    وأنت تدرس جملةً لها مسودّةٌ فيقول الذيلُ «٠ قواعد».
     *
     *    فالقاعدةُ صارت اثنتين لا سبعًا، والحارسُ يمنع عودةَ الخريطة.
     */
    const src = await view();
    const paint = declOf(src, 'function paintBottomStats()');
    expect(`قاعدتان لا خريطة: ${/draftStatItems\(draftNow\?\.model\)/.test(paint)}`)
      .toBe('قاعدتان لا خريطة: true');
    for (const dead of ['wellStatItems', 'STAT_EMPTY', 'sh-stat-note']) {
      expect(`${dead}: ${src.includes(dead)}`).toBe(`${dead}: false`);
    }
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

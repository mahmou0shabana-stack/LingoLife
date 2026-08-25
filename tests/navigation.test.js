/**
 * LingoLife — تنقّلُ المصادر واستمرارُ الحالة (WS-E)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما تحرسه هذه الاختبارات — وما لا تحرسه
 * ═══════════════════════════════════════════════════════════════
 *
 * تحرس **الصحّة** لا النعومة: أن المصدرَ الفعّالَ يُعرَف من المقطع،
 * وأن لكلّ مصدرٍ حالتَه، وأن ما لا يصلح يُسقَط ولا يُقصّ إلى شيءٍ
 * قريبٍ يتظاهر بأنه هو.
 *
 * ⚠️ **والنعومةُ تُقاس في متصفّحٍ حقيقيّ لا هنا** (بند ٥٤): وجودُ
 *    مدّةٍ، وانطفاؤها مع «قلّل الحركة»، وألّا تبتلع طبقةٌ لمسةً. وما
 *    هنا حسابٌ خالص — وهو نصفُ العمل الذي لولاه لكان الانتقالُ
 *    «أنعمَ وأكذب».
 */

import { describe, it, expect } from './test-runner.js';
import {
  SOURCE_KIND, KIND_LABEL, kindOf, sourceKeyOf, overlayRangeIn,
  captureState, planRestore, createSourceMemory,
} from '../js/services/shadow/source-state.js';

/** مقاطعُ أصلٍ بسيطة. */
const original = (n = 4) => Array.from({ length: n }, (_, i) => ({
  id: `SEG_${i}`, sourceTextSnapshot: `جملة ${i}`, order: i,
}));

describe('WS-E · طبقةُ المصدر', () => {
  it('١ · النوعُ يُقرأ من المقطع نفسِه لا من متغيّرِ حالة (بند ٣)', () => {
    expect(kindOf({ id: 'a' })).toBe(SOURCE_KIND.ORIGINAL);
    expect(kindOf({ id: 'b', temporary: true })).toBe(SOURCE_KIND.EXTERNAL);
    expect(kindOf({ id: 'c', temporary: true, draftId: 'STD_1' })).toBe(SOURCE_KIND.DRAFT);
    /* ⚠️ وغيابُ المقطع «أصل» لا انهيار — الشاشةُ تُرسَم قبل أوّل `goTo`. */
    expect(kindOf(null)).toBe(SOURCE_KIND.ORIGINAL);
  });

  it('٢ · ومسودّتان مختلفتان مفتاحان — وإلّا ورثت الثانيةُ موضعَ الأولى', () => {
    expect(sourceKeyOf({ draftId: 'A', temporary: true })).toBe('draft:A');
    expect(sourceKeyOf({ draftId: 'B', temporary: true })).toBe('draft:B');
    expect(sourceKeyOf({ temporary: true, sourceId: 'ext-9' })).toBe('external:ext-9');
    expect(sourceKeyOf({ id: 'x' })).toBe(SOURCE_KIND.ORIGINAL);
  });

  it('٣ · مدى المصدر المُركَّب — متّصلٌ في آخر القائمة، ونوعُه معه', () => {
    const list = [...original(3),
      { id: 'D0', temporary: true, draftId: 'STD_7' },
      { id: 'D1', temporary: true, draftId: 'STD_7' }];
    const range = overlayRangeIn(list);
    expect(range.from).toBe(3);
    expect(range.to).toBe(4);
    expect(range.kind).toBe(SOURCE_KIND.DRAFT);
    expect(range.key).toBe('draft:STD_7');
    /* ولا مدى في الأصل الخالص. */
    expect(overlayRangeIn(original(3))).toBe(null);
    expect(overlayRangeIn([])).toBe(null);
  });

  it('٤ · ولكلّ نوعٍ اسمٌ يُقرَأ — الشارةُ توجيهٌ لا زينة (بند ٤٣)', () => {
    expect(KIND_LABEL[SOURCE_KIND.ORIGINAL]).toBe('الأصل');
    expect(KIND_LABEL[SOURCE_KIND.DRAFT]).toBe('المسودّة');
    expect(KIND_LABEL[SOURCE_KIND.EXTERNAL]).toBe('نصّ مؤقّت');
  });
});

describe('WS-E · ذاكرةُ المصادر', () => {
  it('٥ · لكلّ مصدرٍ حالتُه — ولا مؤشّرَ عامٌّ للجميع (بند ٧)', () => {
    const mem = createSourceMemory();
    mem.save('original', captureState({ index: 5, segmentId: 'SEG_5', word: 3 }));
    mem.save('draft:A', captureState({ index: 1, segmentId: 'D1', word: 0 }));

    expect(mem.read('original').index).toBe(5);
    expect(mem.read('draft:A').index).toBe(1);
    expect(mem.size).toBe(2);
    /* ⚠️ ومصدرٌ لم يُزَر بعدُ يقول «لا أعرف» — لا يستعير حالةَ غيره. */
    expect(mem.read('draft:B')).toBe(null);
  });

  it('٦ · واللقطةُ تُنسَخ لا يُشار إليها — الأصلُ يتبدّل تحت يدك', () => {
    const live = { on: true, from: 2, to: 4, segmentId: 'SEG_1', complete: true };
    const snap = captureState({ index: 1, segmentId: 'SEG_1', phrase: live });
    live.from = 99;
    expect(snap.phrase.from).toBe(2);
    expect(snap.phrase.to).toBe(4);
  });

  it('٧ · ومدًى ناقصٌ لا يُحفَظ أصلًا', () => {
    expect(captureState({ phrase: { from: -1, to: -1 } }).phrase).toBe(null);
    expect(captureState({ phrase: { from: 5, to: 2 } }).phrase).toBe(null);
    expect(captureState({}).phrase).toBe(null);
  });
});

describe('WS-E · الاستعادةُ آمنةٌ من البطلان (بند ٨)', () => {
  it('٨ · المعرِّفُ أوّلًا ثم الرقم — والانزياحُ لا يخدعها (بند ١٩)', () => {
    const snap = captureState({ index: 1, segmentId: 'SEG_2', word: -1 });
    /* حُذف مقطعٌ من أوّل القائمة، فصار `SEG_2` في الموضع ١ لا ٢. */
    const segments = [{ id: 'SEG_1' }, { id: 'SEG_2' }, { id: 'SEG_3' }];
    const plan = planRestore(snap, { segments, wordCount: 5 });
    expect(plan.index).toBe(1);
    expect(segments[plan.index].id).toBe('SEG_2');
  });

  it('٩ · وضاعَ المعرِّفُ فيُستعمَل الرقمُ — ويُعلَن أنه استُعمل', () => {
    const snap = captureState({ index: 2, segmentId: 'GONE' });
    const plan = planRestore(snap, { segments: original(4), wordCount: 3 });
    expect(plan.index).toBe(2);
    expect(plan.dropped).toContain('segment-id');
  });

  it('١٠ · ⚠️ وكلمةٌ لم تعد موجودةً تُسقَط ولا تُقصّ (بند ٨)', () => {
    /*
     * العطبُ الذي يمنعه البند: مسودّةٌ كانت كلمتُك فيها رقم ٩، ثم
     * صارت الجملةُ أربعَ كلمات. القصُّ يعطيك الرابعة — وليست كلمتَك،
     * والتطبيقُ يدّعي أنه تذكّر.
     */
    const snap = captureState({ index: 0, segmentId: 'SEG_0', word: 9 });
    const plan = planRestore(snap, { segments: original(2), wordCount: 4 });
    expect(plan.word).toBe(-1);
    expect(plan.dropped).toContain('word');
  });

  it('١١ · وكلمةٌ صالحةٌ تُستعاد كما هي (بند ١٤)', () => {
    const snap = captureState({ index: 0, segmentId: 'SEG_0', word: 3, practiceMode: 'word' });
    const plan = planRestore(snap, { segments: original(2), wordCount: 6 });
    expect(plan.word).toBe(3);
    expect(plan.practiceMode).toBe('word');
  });

  it('١٢ · ومدًى خارجَ الكلمات يُسقَط — ومعه نطاقُه (بند ٨)', () => {
    const snap = captureState({
      index: 0, segmentId: 'SEG_0', practiceMode: 'phrase',
      phrase: { from: 2, to: 8, segmentId: 'SEG_0' },
    });
    const plan = planRestore(snap, { segments: original(2), wordCount: 5 });
    expect(plan.phrase).toBe(null);
    /* ⚠️ ولا يُفتَح وضعُ «مقطع» بلا مقطع — وضعٌ فارغٌ لا يُفهَم سببُه. */
    expect(plan.practiceMode).toBe('sentence');
    expect(plan.dropped).toContain('phrase');
  });

  it('١٣ · ومدًى صالحٌ يبقى — والنطاقُ معه (بندا ١٥ و٤٩)', () => {
    const snap = captureState({
      index: 0, segmentId: 'SEG_0', practiceMode: 'phrase',
      phrase: { from: 1, to: 4, segmentId: 'SEG_0' },
    });
    const plan = planRestore(snap, { segments: original(2), wordCount: 6 });
    expect(plan.phrase).toEqual({ from: 1, to: 4 });
    expect(plan.practiceMode).toBe('phrase');
  });

  it('١٤ · والاستعادةُ محصورةٌ في نافذة المصدر — لا تعبر حدَّه (بند ٦٠)', () => {
    /*
     * ⚠️ **وهذا ضمانُ WS-A بعينه من بابٍ جديد**: لقطةٌ من الأصل
     *    رقمُها ١ لا يجوز أن تُستعمَل داخل مصدرٍ يبدأ من ٤ — وإلّا
     *    وقعتَ في جملةِ سكريبتٍ وأنت «في المسودّة».
     */
    const segments = [...original(4),
      { id: 'D0', temporary: true, draftId: 'X' },
      { id: 'D1', temporary: true, draftId: 'X' }];
    const stale = captureState({ index: 1, segmentId: 'SEG_1' });
    const plan = planRestore(stale, { segments, wordCount: 4, from: 4, to: 5 });
    expect(plan.index).toBe(4);
    expect(plan.dropped).toContain('index');
  });

  it('١٥ · ولا لقطةَ أصلًا — فأوّلُ المصدر، بلا انهيار', () => {
    const plan = planRestore(null, { segments: original(3), wordCount: 4, from: 1, to: 2 });
    expect(plan.index).toBe(1);
    expect(plan.word).toBe(-1);
    expect(plan.phrase).toBe(null);
    expect(plan.practiceMode).toBe('sentence');
    expect(plan.dropped).toContain('no-snapshot');
  });

  it('١٦ · ووضعُ العرض يُستعاد لكلّ مصدرٍ على حدة (بند ٣٠)', () => {
    const draft = captureState({ index: 0, segmentId: 'D0', display: 'egy' });
    const origin = captureState({ index: 2, segmentId: 'SEG_2', display: 'ru' });
    expect(planRestore(draft, { segments: [{ id: 'D0' }], wordCount: 2 }).display).toBe('egy');
    expect(planRestore(origin, { segments: original(4), wordCount: 2 }).display).toBe('ru');
  });

  it('١٧ · وموضعُ التمرير يُستعاد رقمًا صحيحًا لا `NaN` (بند ١٧)', () => {
    expect(planRestore(captureState({ scroll: 340 }), { segments: original(2), wordCount: 1 }).scroll)
      .toBe(340);
    expect(planRestore(captureState({ scroll: undefined }), { segments: original(2), wordCount: 1 }).scroll)
      .toBe(0);
  });
});

describe('WS-E · الحُرّاس', () => {
  it('١٨ · ⚠️ الطبقةُ حسابٌ خالص — لا DOM ولا صوتَ ولا قاعدة', async () => {
    const src = await (await fetch('../js/services/shadow/source-state.js')).text();
    /*
     * ⚠️ **على أسطر الكود لا على الملفّ كلِّه** — نفسُ درسِ حارس WS-A:
     *    الشرحُ يذكر «IndexedDB» ليقول **إننا لا نكتب فيها**، فحصٌ
     *    يعدّ النصَّ الخامَّ يُجبرني على حذف الشرح لإرضائه.
     */
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    for (const banned of ['document', 'window', 'speechSynthesis', 'IndexedDB',
      'repositories.js', 'fetch(', 'localStorage']) {
      expect(`${banned}:${code.includes(banned)}`).toBe(`${banned}:false`);
    }
    /* ولا استيرادَ أصلًا — الطبقةُ لا تعتمد على شيء. */
    expect(code.includes('import ')).toBe(false);
  });

  it('١٩ · ⚠️ ولا تُكتَب ذاكرةُ المصادر في القاعدة (بندا ٥٧ و٥٨)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l));
    /* أعلامُ الحركة وحالةُ الانتقال لا تُحفَظ — بند ٢٤. */
    for (const line of code) {
      if (/sourceMemory|sh-shift-in|shiftTimer/.test(line)) {
        expect(`persist:${/settings\.set|saveSessionSettings|\.update\(/.test(line)}`)
          .toBe('persist:false');
      }
    }
  });

  it('٢٠ · ⚠️ ولا ترحيلَ مسارٍ في تبديل المصدر (بندا ٥ و٢٥)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const at = src.indexOf('async function enterDraftSource');
    expect(at > 0).toBe(true);
    const body = src.slice(at, src.indexOf('\n}', src.indexOf('toastOk(`${made.length}', at)));
    /* لا `navigate` ولا `location` ولا `history` — الحالةُ داخليّة. */
    expect(body.includes('navigate(')).toBe(false);
    expect(body.includes('history.')).toBe(false);
    expect(body.includes('location.')).toBe(false);
    /* وتُنشئ مقاطعَ في نفس الجلسة لا جلسةً جديدة. */
    expect(body.includes('createSession')).toBe(false);
    expect(body.includes('player.pushSegment')).toBe(true);
    expect(body.includes('player.setSourceWindow')).toBe(true);
  });

  it('٢١ · ⚠️ وتبديلُ المصدر يقطع النطقَ — ولا يتركه من مصدرٍ غادرتَه (بند ٣٣)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    for (const fn of ['async function enterDraftSource', 'async function returnToOriginal']) {
      const at = src.indexOf(fn);
      expect(`${fn}:${at > 0}`).toBe(`${fn}:true`);
      expect(`${fn}:stop:${src.slice(at, at + 2600).includes('player.stop()')}`)
        .toBe(`${fn}:stop:true`);
    }
  });

  it('٢٢ · ⚠️ والمنبعُ لا يلمس الصوتَ ولا المقطعَ الفعّال (بندا ٣٤ و٤١)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const body = src.slice(src.indexOf('async function renderWells'),
      src.indexOf('async function openWell'));
    for (const banned of ['player.stop', 'player.start', 'player.goTo',
      'setPractice', 'exitPhrase', 'restoreSource']) {
      expect(`${banned}:${body.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٢٣ · ⚠️ ومفتاحُ النطاق لا يبدّل المصدرَ (بندا ٤ و٢٧)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const modes = src.slice(src.indexOf('const MODES = ['), src.indexOf('let modeTicket'));
    for (const banned of ['enterDraftSource', 'returnToOriginal',
      'dropExternalSource', 'enterExternalText']) {
      expect(`${banned}:${modes.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٢٤ · ⚠️ ومدّةُ الانتقال رقمٌ واحدٌ في الكود والـCSS (بند ٩)', async () => {
    const js = await (await fetch('../js/views/shadow-view.js')).text();
    const css = await (await fetch('../css/shadow.css')).text();
    const inJs = js.match(/const SHIFT_MS = (\d+);/)?.[1];
    const inCss = css.match(/--sh-shift:\s*(\d+)ms/)?.[1];
    expect(inJs).toBe('220');
    expect(inCss).toBe(inJs);
    /* وفي النطاق الذي طلبه البند: ١٨٠…٢٦٠ms. */
    expect(`in-range:${Number(inJs) >= 180 && Number(inJs) <= 260}`).toBe('in-range:true');
  });

  it('٢٥ · ⚠️ وكلُّ حركةٍ لها بابُ «قلّل الحركة» (بند ٤٠)', async () => {
    const css = await (await fetch('../css/shadow.css')).text();
    const reduce = css.split('@media (prefers-reduced-motion: reduce)').slice(1).join('\n');
    expect(reduce.includes('sh-shift-in')).toBe(true);
    /* والكودُ يسألها بنفسه قبل أن يضع الصنفَ أصلًا. */
    const js = await (await fetch('../js/views/shadow-view.js')).text();
    expect(js.includes('function reducedMotion()')).toBe(true);
    expect(js.includes('prefers-reduced-motion: reduce')).toBe(true);
  });

  it('٢٦ · ⚠️ ولا طبقةَ خارجةٌ تبتلع اللمس (بندا ٣٦ و٤٢)', async () => {
    const css = await (await fetch('../css/shadow.css')).text();
    /*
     * الحركةُ على الداخل وحدَه: `sh-shift-in` تُحرِّك عنصرًا قائمًا،
     * ولا يوجد صنفٌ «خارج» ولا نسخةٌ ثانيةٌ من الصفحة تُرسَم فوقها.
     */
    expect(css.includes('sh-shift-out')).toBe(false);
    const js = await (await fetch('../js/views/shadow-view.js')).text();
    expect(js.includes('cloneNode(true)')).toBe(false);
    /* والشارةُ الهادئةُ منزوعةُ اللمس نزعًا لا إخفاءً بصريًّا. */
    expect(css.includes('.sh-current-lbl[disabled]')).toBe(true);
    const dis = css.slice(css.indexOf('.sh-current-lbl[disabled]'));
    expect(dis.slice(0, 120).includes('pointer-events: none')).toBe(true);
  });

  it('٢٧ · ⚠️ والمسودّةُ تدخل بترجمتها — عقدُ WS-D لا يُنقَض (بند ٦٢)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const at = src.indexOf('async function enterDraftSource');
    const body = src.slice(at, at + 3000);
    expect(body.includes('translationSnapshot: one.ar')).toBe(true);
    expect(body.includes('reviewDraftSegments')).toBe(true);
  });

  it('٢٩ · ⚠️ وموضعُ التمرير يُقرأ من الحاوية التي تفيض فعلًا (بند ١٧)', async () => {
    /*
     * ⚠️ **عطبٌ قديمٌ ظهر في القياس**: `.sh-left` عمودُ flex لا يفيض
     *    أبدًا — قِيس `scrollHeight === clientHeight === 746` على نصٍّ
     *    من ٢٦ جملة، بينما `.sh-lines` بداخله 339 مقابل 1142.
     *
     *    فـ`analysis.scrollTop = page.scrollTop` (منذ WS54) كانت تحفظ
     *    صفرًا دائمًا، ووعدُ «تعود الورقةُ كما تركتَها» يُنفَّذ على
     *    القيمة الخطأ — ولا يظهر لأن الرقم صحيحٌ شكلًا.
     */
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');

    expect(code.includes('function sourceScroller()')).toBe(true);
    expect(code.includes("'.sh-left .sh-lines'")).toBe(true);

    /* ولا أحدَ يقرأ التمريرَ من `leftPage()` مباشرةً بعد اليوم. */
    expect(code.includes('leftPage()?.scrollTop')).toBe(false);
    expect(code.includes('page?.scrollTop || 0')).toBe(false);

    /* وورقةُ التحليل تحفظ وتستعيد من نفس الحاوية — لا من ثانيةٍ. */
    expect(code.includes('analysis.scrollTop = sourceScroll()')).toBe(true);
    expect(code.includes('scroller.scrollTop = analysis.scrollTop')).toBe(true);
  });

  it('٢٨ · ⚠️ ومراجعةُ الأزواج خطوةٌ واحدةٌ لبابين — لا نسختان', async () => {
    const src = await (await fetch('../js/services/shadow/shadow-entry.js')).text();
    expect(src.includes('export async function reviewDraftSegments')).toBe(true);
    /* والنافذةُ تُفتَح مرّةً واحدةً في الملفّ كلِّه. */
    const opens = src.split('openPairReview(').length - 1;
    expect(`open-sites:${opens}`).toBe('open-sites:1');
  });
});

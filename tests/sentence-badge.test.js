/**
 * LingoLife — شارةُ المسودّة بجوار الجملة (WS-SC1 · بنود ٢ و٣ و٥ و٨ و١٨ و٥١ و٦٠ و٦١)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي تحرسه هذه الملفّات — ولماذا لم يكفِ ما قبلها
 * ═══════════════════════════════════════════════════════════════
 *
 * `sentence-identity.test.js` أثبتت أنّ **الهُويّة** تصمد: تعديلٌ
 * وإعادةُ ترتيبٍ وتكرار. وهذه تُثبت أنّ **الشاشة** تستعملها فعلًا —
 * وهو شيءٌ آخرُ تمامًا. فقد كانت الهُويّةُ مبنيّةً كاملةً بينما اللوحُ
 * والشارةُ يقرآن النصَّ المطبَّع كما كانا. أمسك ذلك المِجَسُّ الحيُّ
 * لا الاختبارات، فصارت هذه الاختباراتُ هي الحارس.
 *
 * وثلاثةُ عطوبٍ حقيقيّةٍ وُلدت هنا ولها هنا اختبارٌ يمنع عودتَها:
 *
 *   ١) **مسودّةٌ حُسم صاحبُها كانت تُعرَض على تَوأمِ نصِّها**: رُبطت
 *      مسودّةٌ بالجملة الرابعة ربطًا ثابتًا، فأضاءت الشارةُ على
 *      الثانية بعلامة «محتاجة مراجعة» — والتطبيق **يعرف**.
 *   ٢) **ومقطعٌ عُرفت هُويّتُه كان يستعير مسودّةَ غيره**: `id` معروفٌ
 *      ولا مادّةَ له، فيسقط إلى الرجوع بالنصّ ويأخذ مسودّةَ أوّل
 *      جملةٍ نصُّها مثلُه. فحسمُك للأولى لم يكن يحسم شيئًا.
 *   ٣) **و`findIndex` داخل حلقةٍ**: `O(ن²)` — ١٨٢ms لأربعمئة جملة.
 *
 * ⚠️ **وحرّاسُ الشاشة هنا تقيس الكودَ لا النصّ**: لا تسأل «هل الكلمةُ
 *    موجودة» بل «هل الشارةُ تحمل اسمًا يُقرأ، وهل الصفُّ يُحسَب من
 *    الخريطة لا من النصّ». والفرقُ أنّ الأوّلَ يمرّ على تعليقٍ عابر.
 */

import { describe, it, expect } from './test-runner.js';
import {
  materialMap, materialForSegments, alignSegments, alignSegmentRows,
  attachDraft, attachDraftForSegment, SENTENCE_DRAFT, ATTACH,
} from '../js/services/shadow/sentence-material.js';
import { idsOf } from '../js/services/shadow/sentence-identity.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { openDraft, createDraft, saveDraftText, SUBJECT } from '../js/services/study-draft.js';
import { scripts, studyDrafts } from '../js/db/repositories.js';

const TAG = `SB-${Math.random().toString(36).slice(2, 7)}`;
const put = (id, patch) => scripts.update(id, patch);

/* جملتان متطابقتان عمدًا — وهما موضوعُ البند ٣ كلِّه. */
const DUP = `Хорошо ${TAG}.`;
const TEXT = [
  `Привет ${TAG}, как дела?`,
  DUP,
  `А у тебя что нового ${TAG}?`,
  DUP,
  `До свидания ${TAG}.`,
].join('\n');

async function world(key, text = TEXT) {
  const scene = await createScene({ titleAr: `${TAG} ${key}`, date: '2026-09-03' });
  const script = await addScript(scene.id, { title: `${TAG} ${key}`, text });
  return { sceneId: scene.id, scriptId: script.id };
}

/* ================================================================== */
describe('WS-SC1 · مواءمةُ المقاطع بالجمل (بند ٨)', () => {
  it('١ · جلسةٌ كاملةٌ تُطابق واحدةً بواحدة', async () => {
    const w = await world('كامل');
    const row = await scripts.get(w.scriptId);
    const texts = TEXT.split('\n');
    expect(alignSegmentRows(row, texts)).toEqual([0, 1, 2, 3, 4]);
  });

  it('٢ · وجلسةٌ جزئيّةٌ واضحةٌ تعطي رقمَ الجملة لا رقمَ المقطع', async () => {
    /*
     * ⚠️ **قلبُ البند**: تختار الجمل الثلاثَ الأخيرة وتتدرّب عليها،
     *    فالمقطعُ ٠ هو الجملةُ ٢ والمقطعُ ١ هو الجملةُ ٣. ولولا هذا
     *    لَرُبطت مسودّتُك بجملةٍ غيرِ التي تنظر إليها.
     */
    const w = await world('جزئي');
    const row = await scripts.get(w.scriptId);
    expect(alignSegmentRows(row, TEXT.split('\n').slice(2))).toEqual([2, 3, 4]);
  });

  it('٢ب · وجلسةٌ جزئيّةٌ تبدأ بنصٍّ مكرَّرٍ تعلن الشكّ ولا تختار', async () => {
    /*
     * ⚠️ **العطبُ الذي أمسكه هذا الاختبار**: المشيُ من الأوّل وحدَه
     *    كان يبدأ من الصفر فيلقى «Хорошо.» في الجملة ٢ ويأخذها —
     *    وجلستُك من الجملة ٤. و`[١،٤]` و`[٣،٤]` كلاهما يحفظ الترتيب،
     *    فلا شيءَ في النصّ يرجّح أحدَهما. فالجوابُ «لا أعرف» لا «الأولى».
     */
    const w = await world('جزئي-ملتبس');
    const row = await scripts.get(w.scriptId);
    expect(alignSegmentRows(row, TEXT.split('\n').slice(3))).toEqual([-1, 4]);
  });

  it('٣ · والمتكرّرُ يأخذ ترتيبَه لا أوّلَ تطابق', async () => {
    const w = await world('تكرار');
    const row = await scripts.get(w.scriptId);
    /* المقطعُ الوحيدُ نصُّه المكرَّر ويأتي بعد الجملة ٢ ترتيبًا. */
    expect(alignSegmentRows(row, [TEXT.split('\n')[2], DUP])).toEqual([2, 3]);
  });

  it('٤ · ومقطعٌ لا يُطابق شيئًا يعود ‑١ ولا يُقرَّب', async () => {
    const w = await world('غريب');
    const row = await scripts.get(w.scriptId);
    expect(alignSegmentRows(row, [`Это чужое ${TAG}.`])).toEqual([-1]);
  });

  it('٥ · وبلا معرّفاتٍ تعود alignSegments أصفارًا فارغة', async () => {
    const w = await world('بلا');
    const row = await scripts.get(w.scriptId);
    expect(alignSegments(row, TEXT.split('\n'))).toEqual([null, null, null, null, null]);
  });
});

/* ================================================================== */
describe('WS-SC1 · الربطُ من المقطع (بند ٨)', () => {
  it('٦ · مسودّةُ المقطع ١ في جلسةٍ جزئيّةٍ تُربَط بالجملة ٣', async () => {
    const w = await world('ربط-جزئي');
    const row = await scripts.get(w.scriptId);
    const draft = await createDraft(SUBJECT.SENTENCE, DUP, { sceneId: w.sceneId });
    await saveDraftText(draft.id, `مذاكرة ${TAG}`);

    /* الجلسةُ من الجملة ٢ فصاعدًا: مقطعُها ١ هو الجملةُ ٣ لا الجملةُ ١. */
    const res = await attachDraftForSegment(
      row, TEXT.split('\n').slice(2), 1, draft.id, { updateRecord: put }
    );
    const after = await scripts.get(w.scriptId);
    expect(res.sentenceId).toBe(idsOf(after)[3]);
  });

  it('٦ب · ومقطعٌ التبست جملتُه لا يُربَط بواحدةٍ بالحظّ', async () => {
    const w = await world('ربط-ملتبس');
    const row = await scripts.get(w.scriptId);
    const draft = await createDraft(SUBJECT.SENTENCE, DUP, { sceneId: w.sceneId });
    const res = await attachDraftForSegment(
      row, TEXT.split('\n').slice(3), 0, draft.id, { updateRecord: put }
    );
    expect(res).toBe(null);
    expect(idsOf(await scripts.get(w.scriptId))).toBe(null);
  });

  it('٧ · ومقطعٌ لا يُطابق لا يُربَط ولا يُخمَّن', async () => {
    const w = await world('ربط-غريب');
    const row = await scripts.get(w.scriptId);
    const draft = await createDraft(SUBJECT.SENTENCE, `Чужое ${TAG}.`, { sceneId: w.sceneId });
    const res = await attachDraftForSegment(
      row, [`Чужое ${TAG}.`], 0, draft.id, { updateRecord: put }
    );
    expect(res).toBe(null);
    /* ⚠️ ولا يُلوَّث السجلُّ بمعرّفاتٍ لربطٍ لم يقع (بند ٦). */
    expect(idsOf(await scripts.get(w.scriptId))).toBe(null);
  });
});

/* ================================================================== */
describe('WS-SC1 · المسودّةُ المحسومةُ لا تُعرَض على تَوأمها (بندا ٣ و٥)', () => {
  let w = null;
  let draftId = null;

  async function build() {
    if (w) return w;
    w = await world('حسم');
    const draft = await createDraft(SUBJECT.SENTENCE, DUP, { sceneId: w.sceneId });
    await saveDraftText(draft.id, `بتاعة الرابعة ${TAG}`);
    draftId = draft.id;
    await attachDraft(await scripts.get(w.scriptId), 3, draft.id, { updateRecord: put });
    return w;
  }

  it('٨ · الجملةُ المربوطةُ تُعطي ارتباطًا ثابتًا', async () => {
    await build();
    const map = await materialMap(await scripts.get(w.scriptId), { sceneId: w.sceneId });
    expect(map.get(3).how).toBe(ATTACH.STABLE);
    expect(map.get(3).draft.id).toBe(draftId);
  });

  it('٩ · وتَوأمُها في النصّ لا يُعطى شيئًا — لا ظنًّا ولا التباسًا', async () => {
    /*
     * ⚠️ **العطبُ الذي أمسكه المِجَسُّ الحيّ**: كان الرجوعُ القديمُ
     *    يبحث بالنصّ في كلّ المسودّات بما فيها المحسومة، فيُعلن
     *    التباسًا لا وجودَ له. والالتباسُ جهلٌ حقيقيّ لا تجاهُلٌ لما
     *    نعرفه.
     */
    await build();
    const map = await materialMap(await scripts.get(w.scriptId), { sceneId: w.sceneId });
    expect(map.has(1)).toBeFalsy();
  });

  it('١٠ · ومقطعُ التَّوأم في الجلسة لا يستعير مسودّتها', async () => {
    /*
     * ⚠️ **العطبُ الثاني**: `materialForSegments` كانت تسقط إلى الرجوع
     *    بالنصّ كلَّما خلا المقطعُ من مادّةٍ — ولو كانت هُويّتُه معروفةً.
     *    فالمقطعُ ١ (وله `id` صحيح) كان يأخذ مسودّةَ المقطع ٣.
     */
    await build();
    const map = await materialForSegments(
      await scripts.get(w.scriptId), TEXT.split('\n'), { sceneId: w.sceneId }
    );
    expect(map.get(3).draft.id).toBe(draftId);
    expect(map.has(1)).toBeFalsy();
  });
});

/* ================================================================== */
describe('WS-SC1 · القديمُ الملتبسُ يُعلَن ثمّ يُحسَم (بندا ٥ و٧)', () => {
  const OLD = `Спасибо большое ${TAG}.`;
  const OLD_TEXT = [OLD, `Не за что ${TAG}.`, OLD, `Пока ${TAG}.`].join('\n');
  let w = null;
  let draftId = null;

  async function build() {
    if (w) return w;
    w = await world('ملتبس', OLD_TEXT);
    const draft = await openDraft(SUBJECT.SENTENCE, OLD, { sceneId: w.sceneId });
    await saveDraftText(draft.id, `قديمة ${TAG}`);
    draftId = draft.id;
    return w;
  }

  it('١١ · المتطابقتان تُعلَنان ملتبستَين لا مربوطتَين', async () => {
    await build();
    const map = await materialMap(await scripts.get(w.scriptId), { sceneId: w.sceneId });
    expect(map.get(0).how).toBe(ATTACH.AMBIGUOUS);
    expect(map.get(2).how).toBe(ATTACH.AMBIGUOUS);
  });

  it('١٢ · وحسمُها لواحدةٍ ينزعها عن الأخرى', async () => {
    await build();
    await attachDraft(await scripts.get(w.scriptId), 0, draftId, { updateRecord: put });
    const map = await materialMap(await scripts.get(w.scriptId), { sceneId: w.sceneId });
    expect(map.get(0).how).toBe(ATTACH.STABLE);
    expect(map.has(2)).toBeFalsy();
  });
});

/* ================================================================== */
describe('WS-SC1 · createDraft تُنشئ ولا تُعيد استعمال (بند ٧)', () => {
  it('١٣ · openDraft تُعيد القائمةَ بنفس النصّ', async () => {
    const text = `Одинаковый ${TAG} текст.`;
    const one = await openDraft(SUBJECT.SENTENCE, text, {});
    const two = await openDraft(SUBJECT.SENTENCE, text, {});
    expect(two.id).toBe(one.id);
  });

  it('١٤ · وcreateDraft تُنشئ صفًّا مستقلًّا لنفس النصّ', async () => {
    /*
     * ⚠️ **ولمَ نحتاجها؟** لأنّ جملتين متطابقتين في نصٍّ واحدٍ شيئان،
     *    ولكلٍّ مذاكرتُها. و`openDraft` وحدَها كانت تجعلك تكتب في
     *    مسودّة الأخرى وأنت تظنّها مسودّتَك — وهو البندُ ٧ بعينه.
     */
    const text = `Различный ${TAG} текст.`;
    const one = await openDraft(SUBJECT.SENTENCE, text, {});
    const two = await createDraft(SUBJECT.SENTENCE, text, {});
    expect(two.id === one.id).toBeFalsy();
    expect((await studyDrafts.get(two.id)).subject).toBe((await studyDrafts.get(one.id)).subject);
  });
});

/* ================================================================== */
describe('WS-SC1 · الكلفةُ خطّيّةٌ لا تربيعيّة (بندا ٦١ و٦٢)', () => {
  it('١٥ · أربعمئةُ مقطعٍ بلا معرّفاتٍ لا تفتح أربعمئةَ بحث', async () => {
    /*
     * ⚠️ **حارسٌ على الكلفة لا على النيّة**: كانت `rows.findIndex`
     *    داخل حلقةِ المقاطع، فقاس المِجَسُّ الحيُّ ١٨٢ms. والفهرسُ
     *    أنزلها إلى وحداتٍ من الميلّي. والسقفُ هنا فسيحٌ عمدًا كي لا
     *    يرتجف على آلةٍ بطيئة — وهو يمسك العودةَ إلى `O(ن²)` بيقين.
     */
    const many = Array.from({ length: 400 }, (_, i) => `Предложение ${TAG} номер ${i}.`);
    const w = await world('كبير', many.join('\n'));
    const row = await scripts.get(w.scriptId);

    const t = performance.now();
    const map = await materialForSegments(row, many, { sceneId: w.sceneId });
    const ms = performance.now() - t;
    expect(map.size).toBe(0);
    expect(ms < 300).toBeTruthy();
  });
});

/* ================================================================== */
describe('WS-SC1 · حرّاسُ الشاشة (بنود ٢ و٨ و١٨ و٦٠)', () => {
  let src = '';
  let css = '';

  /*
   * ⚠️ **التعليقاتُ تُنزَع قبل القياس** — وهذا درسٌ دفعناه هنا:
   *    الحارسُ ١٩ سقط أوّلَ مرّةٍ لأنّ التعليقَ الذي يشرح العطبَ
   *    يقتبس الكودَ المعطوب حرفيًّا. فكان الاختبارُ يقرأ حكايةَ
   *    الإصلاح ويظنّها العطبَ نفسَه. والحارسُ يقيس **الكودَ** لا
   *    النصّ — وإلّا فهو يحرس الإملاء.
   */
  const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  async function code() {
    if (!src) src = bare(await (await fetch('../js/views/shadow-view.js')).text());
    if (!css) css = await (await fetch('../css/shadow.css')).text();
    return src;
  }

  it('١٦ · الشارةُ بابٌ له اسمٌ يُقرأ ودورٌ منطوق', async () => {
    /*
     * ⚠️ **والبابُ صار واحدًا (WS-SL)**: كان هذا الحارسُ يفحص
     *    `draftBadgeHtml`، وهي اندمجت في `learnBadgeHtml` حين وُحِّد
     *    مدخلُ المسودّة والقصّة في «تعلّم». والمطلوبُ لم يتغيّر —
     *    بابٌ له اسمٌ يُقرأ ودورٌ منطوق — بل تغيّر مكانُه، فانتقل
     *    الحارسُ معه بدل أن يُحذَف.
     */
    const s = await code();
    const at = s.indexOf('function learnBadgeHtml');
    expect(at > 0).toBeTruthy();
    const body = s.slice(at, at + 1600);
    expect(body).toContain('role="button"');
    expect(body).toContain('aria-label');
    expect(body).toContain('data-sh-learn');
  });

  it('١٧ · وللجملة الخالية بابُ إنشاءٍ لا فراغ', async () => {
    /* ⚠️ بند ١٨: طريقٌ مرئيٌّ لبدء المسودّة، لا معرفةٌ سابقةٌ بأداةٍ في السكّة. */
    const s = await code();
    const at = s.indexOf('function learnBadgeHtml');
    expect(s.slice(at, at + 1600)).toContain('is-add');
    expect(css).toContain('.sh-line.current .sh-line-learn.is-add');
  });

  it('١٨ · وتُفتَح بلوحة المفاتيح كما تُفتَح بالإصبع', async () => {
    /*
     * ⚠️ `<span role="button">` داخل `<button>` لا يُطلق `click` عند
     *    Enter — فبلا معالِجٍ صريحٍ تكون بابًا للإصبع وحائطًا للمفاتيح.
     */
    const s = await code();
    const at = s.indexOf("main.addEventListener('keydown'");
    expect(at > 0).toBeTruthy();
    expect(s.slice(at, at + 500)).toContain('data-sh-learn');
  });

  it('١٩ · وصفُّ «ليها مسودّة» يُحسَب من الخريطة لا من النصّ', async () => {
    /*
     * ⚠️ **الحارسُ المركزيُّ للبند ٣**: `hasDraftedText` تسأل عن النصّ
     *    في التطبيق كلِّه، فتُضيء متطابقتين إحداهما بلا مسودّة.
     */
    const s = await code();
    const at = s.indexOf('function lineHtml');
    const body = s.slice(at, at + 1400);
    expect(body).toContain('material.has(index)');
    expect(body.includes('hasDraftedText(segment')).toBeFalsy();
  });

  it('٢٠ · واللوحُ يقرأ الهُويّةَ قبل النصّ', async () => {
    /*
     * ⚠️ الشارةُ واللوحُ كانا يختلفان: الشارةُ بالهُويّة واللوحُ
     *    بـ`readDraft(text)`. فتقف على جملةٍ بلا شارةٍ فيفتح لك اللوحُ
     *    مسودّةَ تَوأمها.
     */
    const s = await code();
    const at = s.indexOf('async function resolveDraft');
    expect(at > 0).toBeTruthy();
    expect(s.slice(at, at + 900)).toContain('material.get(index)');
    /*
     * ⚠️ **واللوحُ صار `renderLearn` (WS-SL)** — والشرطُ لم يتغيّر:
     *    ما يفتحه اللوحُ يُحَلّ بـ`resolveDraft` (هُويّةٌ ثمّ نصّ) لا
     *    بـ`readDraft(text)` وحدَه. فانتقل الحارسُ إلى اللوح الباقي.
     */
    const draw = s.indexOf('async function renderLearn');
    expect(draw > 0).toBeTruthy();
    expect(s.slice(draw, draw + 1400)).toContain('resolveDraft(');
    expect(s.slice(draw, draw + 1400).includes('readDraft(')).toBeFalsy();
  });

  it('٢١ · وللالتباس مخرجان معلنان لا صمت', async () => {
    const s = await code();
    expect(s).toContain('draft-claim');
    expect(s).toContain('draft-fresh');
    expect(s).toContain('async function claimDraftHere');
  });

  it('٢٢ · وهدفُ لمس الشارة ٤٤px على الأقلّ', async () => {
    await code();
    const at = css.indexOf('.sh-line-learn {');
    expect(at > 0).toBeTruthy();
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('min-block-size: 44px');
    /* ⚠️ والهامشُ السالبُ شرطُ ألّا يعلوَ الصفُّ بسبب الهدف. */
    expect(rule).toContain('margin-block: -12px');
  });
});

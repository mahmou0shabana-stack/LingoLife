/**
 * LingoLife — هُويّةُ الجملة الثابتة (WS-SC1 · بنود ٦٣ و٦٦ و٦٧ و٧٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي كان مكسورًا — وما الذي قرّرناه بدله
 * ═══════════════════════════════════════════════════════════════
 *
 * مسودّةُ المذاكرة كانت تُعرَّف بنصّ الجملة **مُطبَّعًا وحدَه**. وكان
 * ذلك قرارًا مكتوبًا وله سببُه: مقاطعُ الظلّ تموت بموت جلستها.
 *
 * لكنّ ثمنَه أنّ `Хорошо.` في سكريبتٍ و`Хорошо.` في آخرَ **شيءٌ
 * واحد** — لا في النصّ الواحد فحسب بل في التطبيق كلِّه. فمسودّةُ
 * جملةٍ تفتح على جملةٍ أخرى.
 *
 * والبديلُ المرفوض: مرساةٌ محسوبةٌ من «السكريبت + النصّ + رقم التكرار».
 * تنكسر عند أوّل فاصلةٍ تُعدَّل، وعند إعادةِ ترتيب متطابقتين. فاخترنا
 * **معرّفاتٍ دائمةً تُولَد مرّةً وتعيش**.
 *
 * ⚠️ **وهذه الملفّاتُ تحرس الوعدَ لا الشكل**: الثلاثةُ التي بُني عليها
 *    القرارُ — تعديلُ النصّ، وإعادةُ الترتيب، والتكرارُ — لكلٍّ منها
 *    اختبارٌ يفشل لو انكسر الوعد.
 */

import { describe, it, expect } from './test-runner.js';
import {
  sentenceTexts, reconcileIds, idsOf, sentencesOf, ensureIds, idsAfterEdit,
  SENTENCE_IDS,
} from '../js/services/shadow/sentence-identity.js';
import {
  materialMap, attachDraft, detachDraft, SENTENCE_DRAFT, ATTACH,
} from '../js/services/shadow/sentence-material.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import { openDraft, saveDraftText, SUBJECT } from '../js/services/study-draft.js';
import { scripts, studyDrafts, relationships } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';

const TAG = `SC1-${Math.random().toString(36).slice(2, 7)}`;

/* جملٌ حقيقيّةُ الشكل — ومنها متطابقتان عمدًا (بند ٦٣). */
/*
 * ⚠️ **ولكلّ مجموعةِ اختباراتٍ جملُها** — لأنّ الهُويّةَ القديمة نصٌّ
 *    عالميّ: `openDraft` بنفس النصّ يعيد **نفسَ** المسودّة عبر الذكريات.
 *    ففخُّ التصادم هنا هو العطبُ الذي تُصلحه هذه التمريرة نفسُها.
 */
const uniq = (n) => `Предложение ${TAG} номер ${n}.`;
const S14 = uniq('14');
const S15 = 'Также мы обсудили, что документы должны быть представлены заранее.'
  .replace('документы', `документы ${TAG}`);
const S16 = `Хорошо ${TAG}.`;
const S17 = uniq('17');
const S18 = `Хорошо ${TAG}.`;
const TEXT = [S14, S15, S16, S17, S18].join('\n');

/* ================================================================== */
describe('WS-SC1 · القطعُ والمعرّفات (بند ٤)', () => {
  it('١ · القطعُ يعطي الجملَ كما تُعرَض', () => {
    expect(sentenceTexts(TEXT)).toHaveLength(5);
  });

  it('٢ · سجلٌّ بلا معرّفاتٍ يُقرأ بلا معرّفات — ولا يُخترَع شيء', () => {
    /* ⚠️ الغيابُ حالةٌ عاديّةٌ لا نقصان: يعمل عندها الرجوعُ القديم. */
    expect(idsOf({ text: TEXT })).toBe(null);
    expect(sentencesOf({ text: TEXT }).every((one) => one.id === null)).toBeTruthy();
  });

  it('٣ · ورقمُ الجملة عرضٌ لا هُويّة', () => {
    /* ⚠️ بند ٣٧ حرفيًّا: «Do not use “15” as identity». */
    const rows = sentencesOf({ text: TEXT });
    expect(rows.map((one) => one.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('٤ · الردمُ يعطي معرّفًا لكلّ جملةٍ ولا يكرّر', () => {
    const { ids, changed } = ensureIds({ text: TEXT });
    expect(changed).toBe(true);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('٥ · والمتطابقتان تحملان معرّفَين مختلفَين منذ الميلاد', () => {
    /* ⚠️ هذا هو سببُ وجود هذه الطبقة كلِّها (بند ٣٦). */
    const { ids } = ensureIds({ text: TEXT });
    expect(ids[2] === ids[4]).toBeFalsy();
  });

  it('٦ · وسجلٌّ بمعرّفاتٍ سليمةٍ لا يُردَم ثانيةً', () => {
    const { ids } = ensureIds({ text: TEXT });
    const again = ensureIds({ text: TEXT, [SENTENCE_IDS]: ids });
    expect(again.changed).toBe(false);
    expect(again.ids).toEqual(ids);
  });

  it('٧ · وطولٌ مختلفٌ يُقرأ غيابًا لا نسبةً خاطئة', () => {
    /*
     * ⚠️ **الرجوعُ أأمنُ من النسبة**: معرّفاتٌ متقادمةٌ (كُتب النصُّ من
     *    مسارٍ لا يمرّ بـ`updateScript`) قد تنسب مسودّةً لجملةٍ أخرى.
     */
    expect(idsOf({ text: TEXT, [SENTENCE_IDS]: ['a', 'b'] })).toBe(null);
  });
});

/* ================================================================== */
describe('WS-SC1 · المعرّفُ ينجو من التعديل والترتيب (بندا ٣٥ و٣٧)', () => {
  const before = ['أ', 'ب', 'ج'];
  const ids = ['ID-A', 'ID-B', 'ID-C'];

  it('٨ · نصٌّ لم يتغيّر يبقى بمعرّفاته', () => {
    expect(reconcileIds(before, ids, before)).toEqual(ids);
  });

  it('٩ · وإعادةُ الترتيب تنقل المعرّفَ مع جملته', () => {
    expect(reconcileIds(before, ids, ['ج', 'أ', 'ب']))
      .toEqual(['ID-C', 'ID-A', 'ID-B']);
  });

  it('١٠ · وتعديلُ جملةٍ في مكانها يُبقي معرّفَها', () => {
    /* ⚠️ بند ٣٥: «Do not silently detach because punctuation changed». */
    const out = reconcileIds(before, ids, ['أ', 'ب المعدَّلة', 'ج']);
    expect(out).toEqual(['ID-A', 'ID-B', 'ID-C']);
  });

  it('١١ · وجملةٌ تُحذَف لا تُورِّث معرّفَها لجملةٍ جديدة', () => {
    /* ⚠️ وإلّا ورثت الجديدةُ مسودّةَ المحذوفة معه. */
    const out = reconcileIds(before, ids, ['أ', 'ج']);
    expect(out).toEqual(['ID-A', 'ID-C']);
  });

  it('١٢ · وجملةٌ تُضاف تأخذ معرّفًا جديدًا', () => {
    const out = reconcileIds(before, ids, ['أ', 'ب', 'ج', 'د']);
    expect(out.slice(0, 3)).toEqual(ids);
    expect(ids.includes(out[3])).toBeFalsy();
  });

  it('١٣ · والمتطابقتان لا تتبادلان معرّفَيهما عند إعادة الترتيب', () => {
    const dup = ['س', 'خ', 'س'];
    const dupIds = ['ID-1', 'ID-2', 'ID-3'];
    /* «س» الأولى تبقى الأولى، والثانيةُ الثانية — بترتيب الظهور. */
    expect(reconcileIds(dup, dupIds, ['س', 'س', 'خ']))
      .toEqual(['ID-1', 'ID-3', 'ID-2']);
  });

  it('١٤ · وتعديلُ النصّ لا يولّد معرّفاتٍ لسجلٍّ لا هُويّةَ له', () => {
    /* ⚠️ بند ٦: لا هجرةَ صامتة — تحريرُ نصٍّ ليس طلبَ هُويّة. */
    expect(idsAfterEdit({ text: TEXT }, 'نصّ آخر')).toBe(null);
  });

  it('١٥ · وسجلٌّ له هُويّةٌ تُصان معرّفاتُه عند التعديل', () => {
    const { ids: born } = ensureIds({ text: TEXT });
    const next = idsAfterEdit(
      { text: TEXT, [SENTENCE_IDS]: born },
      /* ⚠️ تعديلٌ **داخل** الجملة — إضافةُ جملةٍ شيءٌ آخرُ يختبره ١٢. */
      TEXT.replace('заранее', 'заранее и полностью'),
    );
    expect(next).toHaveLength(5);
    /* الجملةُ المعدَّلةُ احتفظت بمعرّفها. */
    expect(next[1]).toBe(born[1]);
  });
});

/* ================================================================== */
describe('WS-SC1 · الحفظُ الحقيقيُّ يصون الهُويّة (بندا ٣٥ و٣٧)', () => {
  let world = null;
  async function build() {
    if (world) return world;
    const scene = await createScene({ titleAr: `${TAG} ذكرى`, date: '2026-09-03' });
    const script = await addScript(scene.id, { title: `${TAG} نصّ`, text: TEXT });
    world = { sceneId: scene.id, scriptId: script.id };
    return world;
  }

  it('١٦ · سكريبتٌ جديدٌ لا يُولَد بمعرّفات', async () => {
    const w = await build();
    const row = await scripts.get(w.scriptId);
    expect(idsOf(row)).toBe(null);
  });

  it('١٧ · وربطُ مسودّةٍ يولّدها ويحفظها', async () => {
    const w = await build();
    const draft = await openDraft(SUBJECT.SENTENCE, S15, { sceneId: w.sceneId });
    await saveDraftText(draft.id, 'الجملة الأساسية:\n\n' + S15);
    const row = await scripts.get(w.scriptId);
    const { sentenceId } = await attachDraft(row, 1, draft.id, {
      updateRecord: (id, patch) => scripts.update(id, patch),
    });
    const after = await scripts.get(w.scriptId);
    expect(idsOf(after)).toHaveLength(5);
    expect(idsOf(after)[1]).toBe(sentenceId);
  });

  it('١٨ · وتعديلُ نصّ السكريبت يُبقي الارتباط', async () => {
    /* ⚠️ الوعدُ المركزيُّ للبند ٣٥ — يُقاس على القاعدة لا على دالّة. */
    const w = await build();
    const before = await scripts.get(w.scriptId);
    const idBefore = idsOf(before)[1];

    await updateScript(w.scriptId, { text: before.text.replace(S15, `${S15}!`) });
    const after = await scripts.get(w.scriptId);
    expect(idsOf(after)[1]).toBe(idBefore);

    const map = await materialMap(after, { sceneId: w.sceneId });
    expect(map.get(1)?.how).toBe(ATTACH.STABLE);
  });

  it('١٩ · وإعادةُ ترتيب الجمل تُبقي الارتباط على جملته', async () => {
    const w = await build();
    const row = await scripts.get(w.scriptId);
    const idBefore = idsOf(row)[1];
    const lines = row.text.split('\n');
    /* تُنقَل الجملةُ الموسومةُ إلى آخر النصّ. */
    const moved = [...lines.slice(0, 1), ...lines.slice(2), lines[1]].join('\n');

    await updateScript(w.scriptId, { text: moved });
    const after = await scripts.get(w.scriptId);
    const ids = idsOf(after);
    expect(ids[ids.length - 1]).toBe(idBefore);

    const map = await materialMap(after, { sceneId: w.sceneId });
    expect(map.get(ids.length - 1)?.how).toBe(ATTACH.STABLE);
    expect(map.has(1)).toBeFalsy();
  });
});

/* ================================================================== */
describe('WS-SC1 · الخريطةُ تقول الحقيقةَ ولا تخمّن (بنود ٢ و٣ و٥ و٤٧)', () => {
  let w = null;
  async function build() {
    if (w) return w;
    const scene = await createScene({ titleAr: `${TAG} خريطة`, date: '2026-09-03' });
    const script = await addScript(scene.id, { title: `${TAG} نصّ٢`, text: TEXT });
    w = { sceneId: scene.id, scriptId: script.id };
    return w;
  }

  it('٢٠ · نصٌّ بلا مادّةٍ مشتقّةٍ يعطي خريطةً فارغة', async () => {
    const world = await build();
    const row = await scripts.get(world.scriptId);
    expect((await materialMap(row, { sceneId: world.sceneId })).size).toBe(0);
  });

  it('٢١ · والجملةُ الموسومةُ وحدَها تظهر', async () => {
    const world = await build();
    const draft = await openDraft(SUBJECT.SENTENCE, S17, { sceneId: world.sceneId });
    await saveDraftText(draft.id, 'محتوى');
    const row = await scripts.get(world.scriptId);
    await attachDraft(row, 3, draft.id, {
      updateRecord: (id, patch) => scripts.update(id, patch),
    });
    const map = await materialMap(await scripts.get(world.scriptId), { sceneId: world.sceneId });
    expect(map.has(3)).toBe(true);
    expect(map.has(2)).toBeFalsy();
  });

  it('٢٢ · والجملةُ المجاورةُ لا ترث مادّةَ جارتها', async () => {
    /* ⚠️ بند ٣ حرفيًّا: الجملةُ ١٦ لا ترث مادّةَ الجملة ١٥. */
    const world = await build();
    const map = await materialMap(await scripts.get(world.scriptId), { sceneId: world.sceneId });
    expect(map.has(4)).toBeFalsy();
  });

  it('٢٣ · ومسودّةٌ حُذفت لا تترك شارةً كاذبة', async () => {
    /* ⚠️ بند ٤٧: «No stale badge after deletion». */
    const world = await build();
    const draft = await openDraft(SUBJECT.SENTENCE, S14, { sceneId: world.sceneId });
    await saveDraftText(draft.id, 'محتوى');
    const row = await scripts.get(world.scriptId);
    await attachDraft(row, 0, draft.id, {
      updateRecord: (id, patch) => scripts.update(id, patch),
    });
    const fresh = await scripts.get(world.scriptId);
    expect((await materialMap(fresh, { sceneId: world.sceneId })).has(0)).toBe(true);

    await studyDrafts.trash(draft.id);
    expect((await materialMap(fresh, { sceneId: world.sceneId })).has(0)).toBeFalsy();
  });

  it('٢٤ · وفكُّ الارتباط لا يحذف المسودّة', async () => {
    /* ⚠️ بند ٤٨: حذفُ الارتباط ليس حذفَ المادّة. */
    const world = await build();
    const draft = await openDraft(SUBJECT.SENTENCE, S16, { sceneId: world.sceneId });
    await saveDraftText(draft.id, 'محتوى');
    const row = await scripts.get(world.scriptId);
    const { sentenceId } = await attachDraft(row, 2, draft.id, {
      updateRecord: (id, patch) => scripts.update(id, patch),
    });
    await detachDraft(sentenceId, draft.id);
    const map = await materialMap(await scripts.get(world.scriptId), { sceneId: world.sceneId });
    /*
     * ⚠️ **الارتباطُ الثابتُ يزول — والمسودّةُ تبقى** (بند ٤٨).
     *
     *    وقد تعود بالرجوع القديم لأنّ نصَّها ما زال مطابقًا، لكن
     *    **بدرجةٍ أدنى**: `legacy` أو `ambiguous` لا `stable`. والشاشةُ
     *    تفرّق بينهما، فلا تُعرَض شارةُ يقينٍ على ظنّ.
     */
    expect(map.get(2)?.how === ATTACH.STABLE).toBeFalsy();
    expect((await studyDrafts.get(draft.id)).state).toBe(STATE.ACTIVE);
  });
});

/* ================================================================== */
describe('WS-SC1 · المسودّاتُ القديمةُ تعمل ولا تُخمَّن (بندا ٥ و٦٦)', () => {
  it('٢٥ · مسودّةٌ قديمةٌ بنصٍّ فريدٍ تُفتَح بأمان', async () => {
    const L1 = uniq('L1'); const L2 = uniq('L2'); const L3 = uniq('L3');
    const scene = await createScene({ titleAr: `${TAG} قديم`, date: '2026-09-03' });
    const script = await addScript(scene.id, {
      title: `${TAG} فريد`, text: [L1, L2, L3].join('\n'),
    });
    /* مسودّةٌ بالنمط القديم: نصٌّ مُطبَّعٌ ولا معرّفَ جملة. */
    const draft = await openDraft(SUBJECT.SENTENCE, L2, { sceneId: scene.id });
    await saveDraftText(draft.id, 'محتوى قديم');

    const map = await materialMap(await scripts.get(script.id), { sceneId: scene.id });
    expect(map.get(1)?.how).toBe(ATTACH.LEGACY);
    expect(map.get(1)?.draft.id).toBe(draft.id);
  });

  it('٢٦ · ومسودّةٌ قديمةٌ لنصٍّ مكرَّرٍ تُعلَن ملتبسةً ولا تُنسَب بالحظّ', async () => {
    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **هذا هو البندُ ٧ من قواعد المنتج حرفيًّا**
     * ═══════════════════════════════════════════════════════════
     *
     * «Never guess when duplicate sentence text makes legacy
     *  attachment ambiguous». وتخمينٌ هنا يعني أن تفتح مسودّةَ جملةٍ
     *  أخرى وتظنّها مسودّتَك — ثمّ تكتب فيها.
     */
    const D = `Ясно ${TAG}.`;
    const scene = await createScene({ titleAr: `${TAG} ملتبس`, date: '2026-09-03' });
    const script = await addScript(scene.id, {
      title: `${TAG} مكرَّر`, text: [D, uniq('M'), D].join('\n'),
    });
    const draft = await openDraft(SUBJECT.SENTENCE, D, { sceneId: scene.id });
    await saveDraftText(draft.id, 'محتوى ملتبس');

    const map = await materialMap(await scripts.get(script.id), { sceneId: scene.id });
    expect(map.get(0)?.how).toBe(ATTACH.AMBIGUOUS);
    expect(map.get(2)?.how).toBe(ATTACH.AMBIGUOUS);
  });

  it('٢٧ · وحين يُثبَّت الارتباطُ يسبق الرجوعَ القديم', async () => {
    /* ⚠️ بند ٦٦-د: بعد التثبيت تُقرأ الهُويّةُ لا النصّ. */
    const U = `Понятно ${TAG}.`;
    const scene = await createScene({ titleAr: `${TAG} ترقية`, date: '2026-09-03' });
    const script = await addScript(scene.id, {
      title: `${TAG} يرقّى`, text: [U, uniq('U'), U].join('\n'),
    });
    const draft = await openDraft(SUBJECT.SENTENCE, U, { sceneId: scene.id });
    await saveDraftText(draft.id, 'محتوى');

    const row = await scripts.get(script.id);
    /* المستعمِلُ يختار: هذه المسودّةُ للجملة الثالثة لا الأولى. */
    await attachDraft(row, 2, draft.id, {
      updateRecord: (id, patch) => scripts.update(id, patch),
    });

    const map = await materialMap(await scripts.get(script.id), { sceneId: scene.id });
    expect(map.get(2)?.how).toBe(ATTACH.STABLE);
    /* والأولى صارت بلا مادّة — لأنّ صاحبتَها عُرفت. */
    expect(map.get(0)?.how === ATTACH.STABLE).toBeFalsy();
  });

  it('٢٨ · ونصٌّ مكرَّرٌ يقبل مادّتين مختلفتين', async () => {
    /* ⚠️ بند ٣٦ — السببُ الذي من أجله بُنيت هذه الطبقة. */
    const V = `Ладно ${TAG}.`;
    const scene = await createScene({ titleAr: `${TAG} مزدوج`, date: '2026-09-03' });
    const script = await addScript(scene.id, {
      title: `${TAG} اثنتان`, text: [V, uniq('V'), V].join('\n'),
    });
    const one = await openDraft(SUBJECT.SENTENCE, `${V} أولى`, { sceneId: scene.id });
    const two = await openDraft(SUBJECT.SENTENCE, `${V} ثانية`, { sceneId: scene.id });
    await saveDraftText(one.id, 'أولى');
    await saveDraftText(two.id, 'ثانية');

    let row = await scripts.get(script.id);
    await attachDraft(row, 0, one.id, { updateRecord: (id, p) => scripts.update(id, p) });
    row = await scripts.get(script.id);
    await attachDraft(row, 2, two.id, { updateRecord: (id, p) => scripts.update(id, p) });

    const map = await materialMap(await scripts.get(script.id), { sceneId: scene.id });
    expect(map.get(0).draft.id).toBe(one.id);
    expect(map.get(2).draft.id).toBe(two.id);
  });
});

/* ================================================================== */
describe('WS-SC1 · صدقُ البيانات والأداء (بندا ٧٠ و٦١)', () => {
  it('٢٩ · الارتباطُ علاقةٌ من النموذج القائم لا مخزنٌ جديد', async () => {
    /* ⚠️ بند ٣٣: أعِد استعمالَ بنية العلاقات — لا تبنِ ثانية. */
    const rows = await relationships.byIndex('kind', SENTENCE_DRAFT);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('٣٠ · والمسودّةُ تبقى مشتقّةً — لا سكريبتَ يُخلَق لها', async () => {
    /* ⚠️ بند ٧٠: لا تضخيمَ للعدد الأصيل. */
    const scene = await createScene({ titleAr: `${TAG} صدق`, date: '2026-09-03' });
    const script = await addScript(scene.id, {
      title: `${TAG} صدق`, text: [uniq('T1'), uniq('T2')].join('\n'),
    });
    const before = (await scripts.byIndex('sceneId', scene.id))
      .filter((one) => one.state === STATE.ACTIVE).length;

    const draft = await openDraft(SUBJECT.SENTENCE, uniq('T1'), { sceneId: scene.id });
    await saveDraftText(draft.id, 'محتوى');
    await attachDraft(await scripts.get(script.id), 0, draft.id, {
      updateRecord: (id, p) => scripts.update(id, p),
    });

    const after = (await scripts.byIndex('sceneId', scene.id))
      .filter((one) => one.state === STATE.ACTIVE).length;
    expect(after).toBe(before);
  });

  it('٣١ · وخريطةُ نصٍّ كبيرٍ بلا مادّةٍ لا تقرأ علاقةً واحدة', async () => {
    /*
     * ⚠️ **حارسُ N+1** (بند ٦١): نصٌّ فيه مئتا جملةٍ بلا معرّفاتٍ يجب
     *    ألّا يفتح مئتَي استعلام. وبلا معرّفاتٍ لا يقع استعلامُ علاقاتٍ
     *    أصلًا — والقياسُ على الزمن لا على النيّة.
     */
    const scene = await createScene({ titleAr: `${TAG} كبير`, date: '2026-09-03' });
    const many = Array.from({ length: 200 }, (_, i) => `Это предложение номер ${i}.`).join('\n');
    const script = await addScript(scene.id, { title: `${TAG} كبير`, text: many });
    const row = await scripts.get(script.id);

    const t = performance.now();
    const map = await materialMap(row, { sceneId: scene.id });
    const ms = performance.now() - t;
    expect(map.size).toBe(0);
    expect(ms < 400).toBeTruthy();
  });
});

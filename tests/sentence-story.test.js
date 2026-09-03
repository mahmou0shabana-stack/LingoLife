/**
 * LingoLife — قصّةُ الجملة / مشهدُ النقل (WS-SC · التمريرة الثانية · بند ١٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي تحرسه هذه الاختبارات
 * ═══════════════════════════════════════════════════════════════
 *
 * التمريرةُ الأولى أثبتت أنّ **الهُويّة** تصمد، والثانيةُ تبني عليها
 * مادّةً أخرى. وثلاثةُ أشياءَ يسهل أن تنكسر بلا أن يظهر لها عَرَض:
 *
 *   ١) **تضخيمُ العدّادات**: القصّةُ نصٌّ روسيٌّ جديدٌ في القاعدة، فلو
 *      صارت سكريبتًا في الذكرى لَقالت الشاشةُ إنّ عندك «موقفَين
 *      حقيقيَّين» وأحدُهما نصٌّ من ChatGPT. والفرقُ بين الطبقات هو
 *      كلُّ ما يجعل هذا التطبيق مختلفًا عن دفترٍ — فحارسُه أوّلُ ما
 *      يُكتَب هنا، بقياس **عدِّ الذكرى نفسِه** لا بقراءة الحقل.
 *
 *   ٢) **نسبُ القصّة إلى جملةٍ غيرِ التي تنظر إليها**: نصٌّ مكرَّرٌ
 *      وجلسةٌ جزئيّة، وهما بعينهما ما أوقع المسودّةَ في التمريرة
 *      الأولى. فالقصّةُ تُربَط بالمعرّف الثابت أو لا تُربَط.
 *
 *   ٣) **محرّكٌ ثانٍ**: مُقسِّمُ جملٍ ثانٍ، أو مشغّلُ صوتٍ ثانٍ، أو
 *      مولِّدُ قصصٍ داخل التطبيق. وهذه لا يُمسكها اختبارُ سلوك — بل
 *      حارسٌ يقيس الكود.
 *
 * ⚠️ **والحرّاسُ البنيويّون هنا يقيسون الكودَ لا النثرَ الذي يشرحه**:
 *    التعليقاتُ تُقشَر قبل الفحص (`bare`)، لأنّ حارسًا تعطبه جملةٌ في
 *    تعليقٍ يدفعك إلى الكتابة بالإشارات — وهو ثمنٌ لا يُدفَع.
 */

import { describe, it, expect } from './test-runner.js';
import {
  createStory, storyMap, storiesForSegments, parentSentenceOf,
  detachStory, isStoryNode, storyShape, storySegments,
  SENTENCE_STORY, STORY_SEMANTIC, STORY_SHAPE, STORY_BACK,
} from '../js/services/shadow/sentence-story.js';
import { idsOf, sentencesOf } from '../js/services/shadow/sentence-identity.js';
import { materialForSegments } from '../js/services/shadow/sentence-material.js';
import { createScene, getSceneFull } from '../js/services/scene-service.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import { createDraft, saveDraftText, SUBJECT } from '../js/services/study-draft.js';
import {
  createSession, loadSession, recordSegmentPractice, SOURCE_TYPE,
} from '../js/services/shadow/shadow-session-service.js';
import { NODE_KIND } from '../js/services/hyperlingual.js';
import { scripts, relationships, practiceEvidence } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';

const TAG = `ST-${Math.random().toString(36).slice(2, 7)}`;
const put = (id, patch) => scripts.update(id, patch);
const io = { updateRecord: put };

/* جملتان متطابقتان عمدًا — وهما موضوعُ بندِ الهُويّة كلِّه. */
const DUP = `Хорошо ${TAG}.`;
const LINES = [
  `Привет ${TAG}, как дела?`,
  DUP,
  `А у тебя что нового ${TAG}?`,
  DUP,
  `До свидания ${TAG}.`,
];
const TEXT = LINES.join('\n');

/** قصّةٌ سردٌ — بلا علاماتِ متحدّثين. */
const NARRATIVE = [
  `Я пришёл в магазин ${TAG}.`,
  `Там было много людей.`,
  `Я подождал и спросил цену.`,
].join(' ');

/** قصّةٌ حوارٌ — بمتحدّثَين معلَنَين. */
const DIALOGUE = [
  `Продавец: Здравствуйте ${TAG}!`,
  `Клиент: Здравствуйте, сколько стоит?`,
  `Продавец: Двести рублей.`,
].join('\n');

async function world(key, text = TEXT) {
  const scene = await createScene({ titleAr: `${TAG} ${key}`, date: '2026-09-03' });
  const script = await addScript(scene.id, { title: `${TAG} ${key}`, text });
  return { sceneId: scene.id, scriptId: script.id };
}

/** يقشّر التعليقات — فيقيس الحارسُ الكودَ لا شرحَه. */
function bare(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

const sourceOf = (path) => fetch(path).then((r) => r.text());

/* ================================================================== *
 * قرارُ التخزين: عقدةٌ مشتقّة (بنود ٥ و٦)
 * ================================================================== */
describe('WS-SC2 · القصّةُ عقدةٌ مشتقّةٌ لا سكريبتٌ في الذكرى', () => {
  it('١ · جملةٌ بلا قصّةٍ لا تُعطي شارةً ولا مدخلًا في الخريطة', async () => {
    const w = await world('فاضي');
    const row = await scripts.get(w.scriptId);
    const map = await storyMap(row);
    expect(map.size).toBe(0);
  });

  it('٢ · وقصّةٌ محفوظةٌ تظهر على جملتها بالضبط', async () => {
    const w = await world('واحدة');
    const row = await scripts.get(w.scriptId);
    const made = await createStory(row, 2, { text: NARRATIVE }, io);

    const after = await scripts.get(w.scriptId);
    expect(made.sentenceId).toBe(idsOf(after)[2]);

    const map = await storyMap(after);
    expect(map.size).toBe(1);
    expect(map.get(2)).toHaveLength(1);
    expect(map.get(2)[0].id).toBe(made.node.id);
  });

  it('٣ · والعقدةُ سِمَتُها «قصّة» ونوعُها «تدريب» ومنشؤها مُسجَّل', async () => {
    const w = await world('سمات');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 0, { text: NARRATIVE }, io);

    const saved = await scripts.get(node.id);
    expect(saved.semanticType).toBe(STORY_SEMANTIC);
    expect(saved.nodeKind).toBe(NODE_KIND.TRAINING);
    expect(saved.derivedFromScriptId).toBe(w.scriptId);
    expect(isStoryNode(saved)).toBe(true);
  });

  it('٤ · ولا تُضخِّم عدَّ نصوصِ الذكرى — بالقياس على العدّ نفسِه', async () => {
    /*
     * ⚠️ **هذا هو الحارسُ المركزيّ للبند ٦.** ولا يقرأ الحقلَ بل يسأل
     *    الذكرى: «كم نصًّا عندك؟» قبل القصّة وبعدها. لأنّ فحصَ الحقل
     *    يمرّ لو تغيّر العدُّ ليقرأ فهرسًا آخر، وسؤالَ الذكرى لا يمرّ.
     */
    const w = await world('عدّ');
    const before = await getSceneFull(w.sceneId);
    const wasScripts = before.scripts.length;

    const row = await scripts.get(w.scriptId);
    await createStory(row, 1, { text: NARRATIVE }, io);
    await createStory(await scripts.get(w.scriptId), 4, { text: DIALOGUE }, io);

    const after = await getSceneFull(w.sceneId);
    expect(after.scripts.length).toBe(wasScripts);
  });

  it('٥ · ولا سجلَّ مصدرٍ مكرَّرًا: نصُّ الأصل يبقى نسخةً واحدة', async () => {
    const w = await world('تكرار-مصدر');
    const row = await scripts.get(w.scriptId);
    await createStory(row, 0, { text: NARRATIVE }, io);

    /*
     * لا صفَّ ثانيًا نصُّه نصُّ الأصل — القصّةُ عقدةٌ لا نسخة.
     *
     * ⚠️ **والنطاقُ ذكرى واحدةٌ لا القاعدةَ كلَّها**: أوّلُ صياغةٍ مسحت
     *    `scripts` كلَّه فوجدت خمسةَ صفوفٍ نصُّها واحد — وهي سكريبتاتُ
     *    الاختباراتِ السابقةِ في هذا الملفّ نفسِه، لا نُسَخُ قصّة.
     *    اختبارٌ نطاقُه أوسعُ من دعواه يفشل لسببٍ لا علاقةَ له بها.
     */
    const mine = (await scripts.byIndex('sceneId', w.sceneId))
      .filter((one) => one.state === STATE.ACTIVE);
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(w.scriptId);

    /* والعقدةُ موجودةٌ فعلًا — وإلّا كان الاختبارُ يمرّ لأنّ لا شيءَ حدث. */
    const nodes = (await relationships.byIndex('from_kind', [
      idsOf(await scripts.get(w.scriptId))[0], SENTENCE_STORY,
    ]));
    expect(nodes).toHaveLength(1);
  });

  it('٦ · وقصّةٌ حُذفت لا تُعرَض شارةً كاذبة', async () => {
    const w = await world('محذوفة');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 0, { text: NARRATIVE }, io);

    await scripts.update(node.id, { state: STATE.TRASHED });
    const map = await storyMap(await scripts.get(w.scriptId));
    expect(map.size).toBe(0);
  });

  it('٧ · وفكُّ الارتباط يُخفي الشارةَ ولا يحذف نصَّ القصّة', async () => {
    const w = await world('فكّ');
    const row = await scripts.get(w.scriptId);
    const { node, sentenceId } = await createStory(row, 0, { text: NARRATIVE }, io);

    await detachStory(sentenceId, node.id);
    const map = await storyMap(await scripts.get(w.scriptId));
    expect(map.size).toBe(0);
    expect((await scripts.get(node.id)).text).toBe(NARRATIVE);
  });
});

/* ================================================================== *
 * الهُويّة: نصٌّ مكرَّرٌ وتعديلٌ وإعادةُ ترتيب (بنود ١، ٢، ١٤)
 * ================================================================== */
describe('WS-SC2 · القصّةُ تلتصق بالجملة لا بنصّها', () => {
  it('٨ · جملتان نصُّهما واحدٌ ولكلٍّ قصّتُها', async () => {
    const w = await world('توأم');
    let row = await scripts.get(w.scriptId);
    const first = await createStory(row, 1, { text: NARRATIVE }, io);
    row = await scripts.get(w.scriptId);
    const second = await createStory(row, 3, { text: DIALOGUE }, io);

    expect(first.sentenceId === second.sentenceId).toBe(false);

    const map = await storyMap(await scripts.get(w.scriptId));
    expect(map.get(1)).toHaveLength(1);
    expect(map.get(3)).toHaveLength(1);
    expect(map.get(1)[0].id).toBe(first.node.id);
    expect(map.get(3)[0].id).toBe(second.node.id);
  });

  it('٩ · والقصّةُ تصمد بعد تعديل جملةٍ أخرى', async () => {
    const w = await world('تعديل');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 2, { text: NARRATIVE }, io);

    const edited = [...LINES];
    edited[0] = `Приветик ${TAG}, всё хорошо?`;
    await updateScript(w.scriptId, { text: edited.join('\n') });

    const map = await storyMap(await scripts.get(w.scriptId));
    expect(map.get(2)?.[0]?.id).toBe(node.id);
  });

  it('١٠ · وتصمد بعد إعادة ترتيب الجمل — فتتبع جملتَها', async () => {
    const w = await world('ترتيب');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 4, { text: NARRATIVE }, io);

    /* الجملةُ الأخيرةُ تصير الأولى — والقصّةُ معها. */
    const moved = [LINES[4], ...LINES.slice(0, 4)];
    await updateScript(w.scriptId, { text: moved.join('\n') });

    const map = await storyMap(await scripts.get(w.scriptId));
    expect(map.get(0)?.[0]?.id).toBe(node.id);
    expect(map.has(4)).toBe(false);
  });

  it('١١ · ومسودّةٌ وقصّةٌ على الجملة نفسِها لا تتزاحمان', async () => {
    const w = await world('جنبًا');
    const row = await scripts.get(w.scriptId);
    const draft = await createDraft(SUBJECT.SENTENCE, LINES[2], { sceneId: w.sceneId });
    await saveDraftText(draft.id, `مذاكرة ${TAG}`);

    const { attachDraft } = await import('../js/services/shadow/sentence-material.js');
    await attachDraft(row, 2, draft.id, io);
    const fresh = await scripts.get(w.scriptId);
    const { node } = await createStory(fresh, 2, { text: NARRATIVE }, io);

    const latest = await scripts.get(w.scriptId);
    const material = await materialForSegments(latest, LINES, { sceneId: w.sceneId });
    const tales = await storiesForSegments(latest, LINES);

    expect(material.get(2)?.draft?.id).toBe(draft.id);
    expect(tales.get(2)?.[0]?.id).toBe(node.id);
  });

  it('١٢ · ورقمُ المقطع في جلسةٍ جزئيّةٍ ليس رقمَ الجملة', async () => {
    const w = await world('جزئي');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 3, { text: NARRATIVE }, io);

    /* جلسةٌ من الجملة ٢ فصاعدًا: الجملةُ ٣ هي المقطعُ ١. */
    const tales = await storiesForSegments(await scripts.get(w.scriptId), LINES.slice(2));
    expect(tales.get(1)?.[0]?.id).toBe(node.id);
    expect(tales.has(3)).toBe(false);
  });

  it('١٣ · ومقطعٌ التبست جملتُه لا تُنسَب إليه قصّةُ غيره', async () => {
    const w = await world('ملتبس');
    const row = await scripts.get(w.scriptId);
    await createStory(row, 1, { text: NARRATIVE }, io);

    /* الجلسةُ تبدأ بالتوأم الثاني — والمواءمةُ تقول «لا أعرف». */
    const tales = await storiesForSegments(await scripts.get(w.scriptId), LINES.slice(3));
    expect(tales.size).toBe(0);
  });

  it('١٤ · وجملةٌ لا وجودَ لها لا تُكتَب لها قصّة', async () => {
    const w = await world('خارج');
    const row = await scripts.get(w.scriptId);
    await expect(createStory(row, 99, { text: NARRATIVE }, io)).toReject();
  });

  it('١٥ · ونصٌّ فاضٍ يُرفَض قبل أن يُكتَب أيُّ شيء', async () => {
    const w = await world('فاضي-نصّ');
    const row = await scripts.get(w.scriptId);
    await expect(createStory(row, 0, { text: '   ' }, io)).toReject();
    /* ولا معرّفاتٌ وُلدت بالمحاولة الفاشلة. */
    expect(idsOf(await scripts.get(w.scriptId))).toBe(null);
  });

  it('١٦ · وقصصٌ عدّةٌ للجملة الواحدة يسمح بها النموذج', async () => {
    const w = await world('متعدّدة');
    let row = await scripts.get(w.scriptId);
    const a = await createStory(row, 0, { text: NARRATIVE }, io);
    row = await scripts.get(w.scriptId);
    const b = await createStory(row, 0, { text: DIALOGUE }, io);

    const map = await storyMap(await scripts.get(w.scriptId));
    expect(map.get(0)).toHaveLength(2);
    expect(map.get(0).map((one) => one.id).sort()).toEqual([a.node.id, b.node.id].sort());
  });
});

/* ================================================================== *
 * القراءةُ والشكل (بند ٩)
 * ================================================================== */
describe('WS-SC2 · شكلُ القصّة يُقرأ من نصّها', () => {
  it('١٧ · سردٌ متّصلٌ يُقرأ سردًا ولا يُجزَّأ إلى أدوار', async () => {
    expect(storyShape(NARRATIVE)).toBe(STORY_SHAPE.NARRATIVE);
    expect(storySegments(NARRATIVE)).toBe(null);
  });

  it('١٨ · وحوارٌ بمتحدّثَين يُقرأ حوارًا بأدواره', async () => {
    expect(storyShape(DIALOGUE)).toBe(STORY_SHAPE.DIALOGUE);
    const turns = storySegments(DIALOGUE);
    expect(turns).toHaveLength(3);
    expect(turns[0].speaker).toBe('Продавец');
    expect(turns[1].speaker).toBe('Клиент');
    expect(turns[0].text).toContain('Здравствуйте');
  });

  it('١٩ · ومتحدّثٌ واحدٌ سردٌ لا حوار', async () => {
    const one = `Аня: Привет ${TAG}.\nАня: Как дела?`;
    expect(storyShape(one)).toBe(STORY_SHAPE.NARRATIVE);
  });

  it('٢٠ · ولا يُخمَّن دورُك: كلُّ الأدوار «ليست لي» حتى تختار', async () => {
    const turns = storySegments(DIALOGUE);
    expect(turns.every((one) => one.isMine === false)).toBe(true);
  });
});

/* ================================================================== *
 * التدريبُ والنسب (بنود ٧، ٨، ١٠، ١١)
 * ================================================================== */
describe('WS-SC2 · تدريبُ القصّة بنفس المحرّك', () => {
  it('٢١ · جلسةُ سردٍ تُقسَّم بمُقسِّم الجمل القائم', async () => {
    const w = await world('تدريب-سرد');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 0, { text: NARRATIVE }, io);

    const { session } = await createSession({
      title: node.title,
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: node.id,
      sceneId: w.sceneId,
      text: node.text,
    });
    const { segments } = await loadSession(session.id);
    expect(segments).toHaveLength(3);
    expect(segments[0].sourceTextSnapshot).toContain('магазин');
  });

  it('٢٢ · وجلسةُ حوارٍ تحتفظ بمتحدّثيها', async () => {
    const w = await world('تدريب-حوار');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 0, { text: DIALOGUE }, io);

    const { session } = await createSession({
      title: node.title,
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: node.id,
      sceneId: w.sceneId,
      segments: storySegments(node.text),
    });
    const { segments } = await loadSession(session.id);
    expect(segments).toHaveLength(3);
    expect(segments.map((one) => one.speaker)).toEqual(['Продавец', 'Клиент', 'Продавец']);
  });

  it('٢٣ · والرجوعُ إلى الجملة الأصليّة يُقرأ من العلاقة', async () => {
    const w = await world('رجوع');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 3, { text: NARRATIVE }, io);

    const parent = await parentSentenceOf(node.id);
    expect(parent.index).toBe(3);
    expect(parent.text).toBe(DUP);
    expect(parent.record.id).toBe(w.scriptId);
    expect(parent.sentenceId).toBe(idsOf(await scripts.get(w.scriptId))[3]);
  });

  it('٢٤ · والرجوعُ يميّز التوأمَ الصحيح — لا أوّلَ نصٍّ مثله', async () => {
    /*
     * ⚠️ **الفرقُ بين العلاقة و`derivedFromScriptId`**: الأخيرُ يقول
     *    «هذا السكريبت»، والعلاقةُ وحدَها تقول «هذه الجملة». ولولا
     *    ذلك لَرجع بك من قصّةِ الجملة ٤ إلى الجملة ٢.
     */
    const w = await world('رجوع-توأم');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 3, { text: DIALOGUE }, io);
    const parent = await parentSentenceOf(node.id);
    expect(parent.index).toBe(3);
  });

  it('٢٥ · وقصّةٌ فُكَّ ارتباطُها لا تُرجِعُ جملةً بالحدس', async () => {
    const w = await world('رجوع-مفكوك');
    const row = await scripts.get(w.scriptId);
    const { node, sentenceId } = await createStory(row, 0, { text: NARRATIVE }, io);
    await detachStory(sentenceId, node.id);
    expect(await parentSentenceOf(node.id)).toBe(null);
  });

  it('٢٦ · ونسبُ التسجيلات: الدليلُ للقصّة والأثرُ إلى جملتها', async () => {
    /*
     * ⚠️ **بند ١٠ بشقَّيه**: الدليلُ يُكتَب على مقطعِ القصّة (فلا يُحسَب
     *    تدريبًا على الجملة الأصليّة)، والنسبُ إلى الجملة الأمّ يبقى
     *    مقروءًا من مصدر الجلسة عبر العلاقة. أثرٌ لا خلط.
     */
    const w = await world('نسب');
    const row = await scripts.get(w.scriptId);
    const { node } = await createStory(row, 2, { text: NARRATIVE }, io);

    const { session } = await createSession({
      title: node.title,
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: node.id,
      sceneId: w.sceneId,
      text: node.text,
    });
    const { segments } = await loadSession(session.id);
    await recordSegmentPractice(session, segments[0], 3);

    const rows = (await practiceEvidence.getAll()).filter(
      (one) => one.sessionId === session.id,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].targetId).toBe(segments[0].id);

    /* والدليلُ ليس على أيّ مقطعٍ من جلسةٍ على النصّ الأصليّ. */
    const originSegmentIds = new Set(segments.map((one) => one.id));
    expect(originSegmentIds.has(rows[0].targetId)).toBe(true);

    /* ثمّ يُقرأ الأثرُ: من الجلسة ← القصّة ← الجملة الأمّ. */
    const reloaded = await loadSession(session.id);
    const back = await parentSentenceOf(reloaded.session.sourceId);
    expect(back.index).toBe(2);
    expect(back.record.id).toBe(w.scriptId);
  });

  it('٢٧ · والعلاقةُ نوعُها واحدٌ واتّجاهُها من الأصل إلى المشتقّ', async () => {
    const w = await world('اتجاه');
    const row = await scripts.get(w.scriptId);
    const { node, sentenceId } = await createStory(row, 0, { text: NARRATIVE }, io);

    const out = await relationships.byIndex('from_kind', [sentenceId, SENTENCE_STORY]);
    expect(out).toHaveLength(1);
    expect(out[0].toId).toBe(node.id);
  });
});

/* ================================================================== *
 * حرّاسٌ بنيويّون — يقيسون الكود (بنود ٣، ٥، ٨، ١١، ١٤)
 * ================================================================== */
describe('WS-SC2 · حرّاسٌ بنيويّون', () => {
  it('٢٨ · لا مولِّدَ قصصٍ في التطبيق: خدمةُ القصّة لا تلمس الشبكة', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-story.js'));
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
    expect(src.includes('api.openai')).toBe(false);
    expect(/apiKey|api_key/.test(src)).toBe(false);
  });

  it('٢٩ · ولا مخزنَ جديدٌ للقصص: تُكتَب عبر عقدةِ التنظيم القائمة', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-story.js'));
    expect(src.includes('addNode(')).toBe(true);
    /* ولا إنشاءَ سكريبتٍ في ذكرى — ذاك ما يضخّم العدّادات. */
    expect(/addScript\s*\(/.test(src)).toBe(false);
    expect(/db\.createObjectStore|createObjectStore/.test(src)).toBe(false);
  });

  it('٣٠ · ولا مُقسِّمَ جملٍ ثانٍ داخل خدمةِ القصّة', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-story.js'));
    expect(/SENTENCE_BREAK|splitSentences\s*\(/.test(src)).toBe(false);
    /*
     * والحوارُ يُقرأ بمحلّل المتحدّثين القائم — وقراءةُ الأسماء وضعٌ
     * فيه لا محلّلٌ ثانٍ بجواره. فلا تعبيرَ نمطيٍّ للأدوار هنا.
     */
    expect(src.includes('parseDialogue(')).toBe(true);
    expect(/new RegExp|\/\^\[/.test(src)).toBe(false);
  });

  it('٣٠ب · ووضعُ الأسماء مغلقٌ افتراضًا في كلّ مسارٍ آخر', async () => {
    /*
     * ⚠️ **بابٌ يُفتَح لا حائطٌ يُهدَم**: سطرٌ كـ`Упаковка: ...` في نصٍّ
     *    ملصوقٍ من مستندٍ عنوانٌ لا دور. فالورشةُ تبقى على تحفّظها،
     *    والقصّةُ وحدَها تطلب قراءةَ الأسماء.
     */
    const { speakersIn: names } = await import('../js/services/workspace/speaker-parser.js');
    const heading = `Упаковка: картон\nЗащита: плёнка`;
    expect(names(heading)).toHaveLength(0);
    expect(names(heading, { named: true })).toHaveLength(2);
  });

  it('٣١ · ولا مشغّلَ صوتٍ ثانٍ ولا نظامَ تسجيلٍ ثانٍ', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-story.js'));
    expect(/new Audio\s*\(|createElement\(\s*['"]audio/.test(src)).toBe(false);
    expect(/MediaRecorder|getUserMedia/.test(src)).toBe(false);
  });

  it('٣٢ · والقصّةُ تُربَط بالمعرّف الثابت لا بالنصّ المطبَّع', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-story.js'));
    /* `ensureIds` هي بابُ المعرّفات الوحيد، ولا رجوعَ بالنصّ هنا أصلًا. */
    expect(src.includes('ensureIds(')).toBe(true);
    expect(/subjectKey\s*\(/.test(src)).toBe(false);
  });

  it('٣٣ · وشارةُ القصّة بابٌ له اسمٌ يُقرأ ولوحةُ مفاتيح', async () => {
    const src = await sourceOf('../js/views/shadow-view.js');
    const at = src.indexOf('function storyBadgeHtml');
    expect(at > 0).toBe(true);
    const body = src.slice(at, at + 900);
    expect(body.includes('role="button"')).toBe(true);
    expect(body.includes('tabindex="0"')).toBe(true);
    expect(body.includes('aria-label=')).toBe(true);
    expect(body.includes('data-sh-story=')).toBe(true);
  });

  it('٣٤ · والشارةُ تُحسَب من الخريطة لا من نصّ الجملة', async () => {
    const src = await sourceOf('../js/views/shadow-view.js');
    const at = src.indexOf('function storyBadgeHtml');
    const body = bare(src.slice(at, at + 900));
    expect(body.includes('stories.get(index)')).toBe(true);
    expect(/hasDraftedText|subjectKey/.test(body)).toBe(false);
  });

  it('٣٥ · وزرُّ الرجوع عَلَمٌ يُعالَج لا مسارٌ يُوجَّه إليه', async () => {
    const src = bare(await sourceOf('../js/views/shadow-view.js'));
    /* العَلَمُ يُلتقَط قبل `navigate` في مُعالِج «افتح الأصل». */
    expect(src.includes('STORY_BACK) return backToOriginSentence()')).toBe(true);
    expect(STORY_BACK.startsWith('#')).toBe(false);
  });

  it('٣٦ · والقفزةُ المعلَّقةُ تُستهلَك مرّةً واحدةً عند التركيب', async () => {
    const src = bare(await sourceOf('../js/views/shadow-view.js'));
    /* تُقرأ ثمّ تُصفَّر في نفس الموضع — فلا تتربّص بفتحةٍ تالية. */
    expect(/const jump = pendingJump;\s*pendingJump = null;/.test(src)).toBe(true);
    /* ولا تُحقن في المسار — مُطابِقُ المقطع يقسّم على الشرطة. */
    expect(/shadow\/\$\{[^}]*\}\?at=/.test(src)).toBe(false);
  });

  it('٣٧ · ولا شارةَ قصّةٍ تُستنسَخ من شارةِ المسودّة بصنفٍ واحد', async () => {
    /*
     * ⚠️ شارتان لمادّتين: المسودّةُ تحليلٌ والقصّةُ موقف. وصنفٌ واحدٌ
     *    يجمعهما كان سيجعلك تفتح لتعرف أيَّها — وهو ما أُلغي في
     *    التمريرة الأولى حين صارت العلامةُ بابًا.
     */
    const css = await sourceOf('../css/shadow.css');
    expect(css.includes('.sh-line-story')).toBe(true);
    expect(css.includes('.sh-line-story.is-add')).toBe(true);
    expect(css.includes('.sh-line.current .sh-line-story.is-add')).toBe(true);
    /* هدفُ لمسٍ حقيقيٌّ — لا حرفٌ في ١١px على تابلت. */
    const at = css.indexOf('.sh-line-story {');
    expect(css.slice(at, at + 400).includes('min-block-size: 44px')).toBe(true);
  });

  it('٣٧ب · والحفظُ يُظهِر ما حفظتَه لا أوّلَ ما في القائمة', async () => {
    /*
     * ⚠️ **عطبٌ أمسكه المِجَسُّ الحيّ وحدَه**: كان `storyPick = 0` بعد
     *    الحفظ، فالقصّةُ الثانيةُ تُكتَب في القاعدة صحيحةً ثمّ يُعرَض
     *    عليك الأولى وشريطُ الانتقاء على «١». حفظٌ لا ترى أثرَه.
     *    والحارسُ يقيس أنّ الاختيارَ يُحسَب من معرّف ما أُنشئ.
     */
    const src = bare(await sourceOf('../js/views/shadow-view.js'));
    const at = src.indexOf('async function saveStoryHere');
    const body = src.slice(at, at + 1800);
    expect(body.includes('made.node.id')).toBe(true);
    expect(/storyPick = 0;/.test(body)).toBe(false);
  });

  it('٣٨ · والنسبُ مقروءٌ في اللوح لا في تلميحٍ يختفي', async () => {
    const src = await sourceOf('../js/views/shadow-view.js');
    const at = src.indexOf('async function renderStory');
    expect(at > 0).toBe(true);
    const body = src.slice(at, at + 3000);
    expect(body.includes('sh-story-from')).toBe(true);
    expect(body.includes('من الجملة')).toBe(true);
  });
});

/* ================================================================== *
 * الأداء: نصٌّ طويلٌ لا يفتح استعلامًا لكلّ سطر (بند ٦١ الموروث)
 * ================================================================== */
describe('WS-SC2 · القياس', () => {
  it('٣٩ · خريطةُ قصصٍ لنصٍّ فيه ٢٠٠ جملةٍ تحت ٣٠٠ms', async () => {
    const many = Array.from({ length: 200 }, (_, i) => `Строка ${i} ${TAG}.`).join('\n');
    const w = await world('طويل', many);
    let row = await scripts.get(w.scriptId);
    await createStory(row, 7, { text: NARRATIVE }, io);
    row = await scripts.get(w.scriptId);
    await createStory(row, 150, { text: DIALOGUE }, io);

    const at = performance.now();
    const map = await storyMap(await scripts.get(w.scriptId));
    const ms = performance.now() - at;

    expect(map.size).toBe(2);
    expect(ms < 300).toBe(true);
  });
});

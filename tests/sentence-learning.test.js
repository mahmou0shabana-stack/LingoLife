/**
 * LingoLife — طبقةُ تعلّم الجملة (WS-SL · بند ١٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما تحرسه هذه الاختبارات
 * ═══════════════════════════════════════════════════════════════
 *
 * التمريرتان السابقتان أثبتتا أنّ **الهُويّة** تصمد وأنّ **القصّة**
 * تلتصق بجملتها. وهذه تُثبت أنّ الطبقتين **واحدة**: مركزُها الجملة،
 * وعدّادُها صادق، وحكمُك فيها لا يُخلَط بشهادة ما وقع.
 *
 * وثلاثةُ أشياءَ يسهل أن تنكسر بلا عَرَض:
 *
 *   ١) **المثالُ يُعَدّ قطعةً**: مسودّةٌ فيها ثلاثُ مفرداتٍ وتسعةُ
 *      أمثلةٍ تقول «١٢ قطعة». عدّادٌ يكذب بلا أن يُخطئ.
 *
 *   ٢) **الحكمُ يُشتَقّ من الشهادة**: «خلصت ٨ من ١٢» لأنّك ضغطتَ ▶
 *      ثماني مرّات — ادّعاءُ إتقانٍ من دليل استماع.
 *
 *   ٣) **نسخةٌ ثانيةٌ من النصّ**: لو حُفظت القطعُ صفوفًا لَافترقت عن
 *      نصّ المسودّة عند أوّل تحرير.
 */

import { describe, it, expect } from './test-runner.js';
import {
  coreChunks, chunkKey, chunkStates, setChunkState, chunkProgress,
  learningForSegments, hasLearning, evidenceCount,
  CHUNK_STATE, CHUNK_STATES,
} from '../js/services/shadow/sentence-learning.js';
import { attachDraft } from '../js/services/shadow/sentence-material.js';
import { createStory } from '../js/services/shadow/sentence-story.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import { createDraft, saveDraftText, SUBJECT } from '../js/services/study-draft.js';
import { scripts, studyDrafts } from '../js/db/repositories.js';

const TAG = `SL-${Math.random().toString(36).slice(2, 7)}`;
const put = (id, patch) => scripts.update(id, patch);
const io = { updateRecord: put };

const DUP = `Хорошо ${TAG}.`;
const LINES = [
  `Привет ${TAG}, как дела?`,
  DUP,
  `А у тебя что нового ${TAG}?`,
  DUP,
  `До свидания ${TAG}.`,
];
const TEXT = LINES.join('\n');

/**
 * مسودّةٌ بالقالب الحقيقيّ: مفردتان لكلٍّ إحساسٌ وأمثلةٌ وقالب.
 *
 * ⚠️ **والفاصلُ «━━━» بين المفردتين ليس زينة** — كشفه أوّلُ تشغيل.
 *    كتبتُ الملفّ بلا فواصل، فقالت القراءةُ «قطعةٌ واحدة»: القسمُ
 *    يسري حتى يُنهيَه فاصلٌ أو عنوانٌ جديد (وهو سلوكٌ مقصودٌ في
 *    المحلّل ومكتوبٌ سببُه فيه)، فوقع «обсуди́ть» داخل قسم «القالب:»
 *    السابق وصار قالبًا لا مفردة.
 *
 *    والقالبُ الحقيقيُّ الذي تكتبه في ChatGPT يفصل بـ«━━━» بالفعل —
 *    فالخطأُ كان في الملفّ لا في القراءة. والحدُّ مُسجَّلٌ في اختبارٍ
 *    صريحٍ أدناه بدل أن يبقى مفاجأة.
 */
const DRAFT = [
  'الجملة الأساسية:',
  'Документ содержит информацию.',
  '',
  '━━━━━━━━━━',
  '',
  'содержа́ть',
  'يحتوي على / يتضمن',
  '',
  'الإحساس:',
  'استخدام رسمي لوصف محتوى شيء.',
  '',
  'أمثلة:',
  'Документ содержит информацию.',
  'المستند يحتوي على معلومات.',
  'Коробка содержит книги.',
  'الصندوق يحتوي على كتب.',
  '',
  'القالب:',
  'что + содержа́ть + что',
  '',
  '━━━━━━━━━━',
  '',
  'обсуди́ть',
  'يناقش',
  '',
  'الإحساس:',
  'فعل تام — نقاش انتهى.',
  '',
  'أمثلة:',
  'Мы обсудили вопрос.',
  'ناقشنا المسألة.',
].join('\n');

async function world(key, text = TEXT) {
  const scene = await createScene({ titleAr: `${TAG} ${key}`, date: '2026-09-03' });
  const script = await addScript(scene.id, { title: `${TAG} ${key}`, text });
  return { sceneId: scene.id, scriptId: script.id };
}

/** مسودّةٌ محفوظةٌ ومربوطةٌ بجملةٍ بعينها. */
async function draftOn(w, index, body = DRAFT) {
  const draft = await createDraft(SUBJECT.SENTENCE, LINES[index], { sceneId: w.sceneId });
  await saveDraftText(draft.id, body);
  await attachDraft(await scripts.get(w.scriptId), index, draft.id, io);
  return studyDrafts.get(draft.id);
}

function bare(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}
const sourceOf = (path) => fetch(path).then((r) => r.text());

/* ================================================================== *
 * القطعُ الأساسيّة (بند ٤)
 * ================================================================== */
describe('WS-SL · القطعُ تُقرأ من بنية المسودّة', () => {
  it('١ · مسودّةٌ بالقالب تعطي قطعةً لكلّ مفردة — لا لكلّ سطر', async () => {
    /*
     * ⚠️ **قلبُ البند ٤**: في النصّ مفردتان وأربعةُ أمثلةٍ وقالبٌ
     *    وشرحان. القطعُ **اثنتان**، والباقي يخصّهما.
     */
    const chunks = coreChunks(DRAFT);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].ru).toBe('содержа́ть');
    expect(chunks[1].ru).toBe('обсуди́ть');
  });

  it('٢ · والمعنى والإحساس والأمثلة والقالب تلتصق بقطعتها', async () => {
    const [first, second] = coreChunks(DRAFT);
    expect(first.ar).toContain('يحتوي');
    expect(first.sense.join(' ')).toContain('رسمي');
    expect(first.examples).toHaveLength(2);
    expect(first.examples[0].ru).toContain('Документ');
    expect(first.examples[0].ar).toContain('المستند');
    expect(first.patterns.join(' ')).toContain('содержа́ть');

    expect(second.examples).toHaveLength(1);
    expect(second.sense.join(' ')).toContain('تام');
    /* والقالبُ لم يعبر إلى القطعة التالية. */
    expect(second.patterns).toHaveLength(0);
  });

  it('٣ · والجملةُ الأصليّة ليست قطعةً من نفسها', async () => {
    const keys = coreChunks(DRAFT).map((one) => one.ru);
    expect(keys.some((ru) => ru.includes('информацию'))).toBe(false);
  });

  it('٤ · ونصٌّ فاضٍ لا يعطي قطعًا ولا يسقط', async () => {
    expect(coreChunks('')).toHaveLength(0);
    expect(coreChunks(null)).toHaveLength(0);
    expect(coreChunks('كلام عربي بس.')).toHaveLength(0);
  });

  it('٥ · وقائمةٌ بسيطةٌ بلا أقسامٍ: كلُّ زوجٍ قطعة', async () => {
    const flat = ['стол', 'طاولة', 'стул', 'كرسي', 'окно', 'نافذة'].join('\n');
    const chunks = coreChunks(flat);
    expect(chunks).toHaveLength(3);
    expect(chunks[2].ru).toBe('окно');
    expect(chunks[2].ar).toBe('نافذة');
  });

  it('٥ب · ومفردةٌ ثانيةٌ بلا فاصلٍ قبلها تُقرأ مفردةً لا قالبًا', async () => {
    /*
     * ⚠️ **توقّعتُ حدًّا فلم يكن موجودًا — والقياسُ حسم.**
     *
     *    كتبتُ هذا الاختبار أوّلًا يتوقّع «قطعةً واحدة»: ظننتُ أنّ قسم
     *    «القالب:» يسري على ما بعده فيبتلع المفردةَ الثانية. وقِستُه
     *    فوجدتُ القراءةَ تعطي اثنتين — لأنّ قاعدةَ القسم القالبيّ
     *    تَسِمُ **الأسطرَ المفردة** قوالبَ، والزوجُ الروسيُّ العربيُّ
     *    يبقى زوجًا.
     *
     *    والسببُ الحقيقيُّ أدقُّ ممّا ظننتُ مرّةً ثانية: هذا النصُّ
     *    القصيرُ **لا يُقرأ مسودّةً أصلًا** (`looksDraft` ترفضه)، فلا
     *    أقسامَ فيه ولا قوالب — أزواجٌ عاديّة. أي أنّ الأقسامَ تعمل
     *    حين يكون النصُّ مسودّةً حقًّا، وهو ما يقيسه الاختبار ٢.
     *
     *    فالاختبارُ يُسجّل ما وقع لا ما تخيّلتُه، مرّتين.
     */
    const glued = [
      'слово', 'كلمة', '', 'القالب:', 'что + слово',
      '', 'другое', 'آخر',
    ].join('\n');
    const chunks = coreChunks(glued);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].ru).toBe('слово');
    expect(chunks[1].ru).toBe('другое');
  });

  it('٦ · والقطعُ مقروءةٌ لا محفوظةٌ: تحريرُ المسودّة يغيّرها فورًا', async () => {
    /*
     * ⚠️ لو حُفظت القطعُ صفوفًا لَبقيت القديمةُ بعد التحرير، ولَصار
     *    في التطبيق مصدرا حقيقةٍ لشيءٍ واحد.
     */
    const w = await world('قراءة');
    const draft = await draftOn(w, 0);
    expect(coreChunks(draft)).toHaveLength(2);

    await saveDraftText(draft.id, 'стол\nطاولة');
    const after = await studyDrafts.get(draft.id);
    expect(coreChunks(after)).toHaveLength(1);
  });
});

/* ================================================================== *
 * الحالةُ والتقدّم (بندا ٧ و٩)
 * ================================================================== */
describe('WS-SL · حكمُك يُحفَظ ولا يُشتَقّ', () => {
  it('٧ · مسودّةٌ جديدةٌ كلُّ قطعِها «لم تبدأ»', async () => {
    const w = await world('حالات');
    const draft = await draftOn(w, 0);
    const chunks = coreChunks(draft);
    const at = chunkProgress(chunks, chunkStates(draft));
    expect(at).toEqual({ total: 2, done: 0, practicing: 0, fresh: 2 });
  });

  it('٨ · وتعليمُ قطعةٍ «خلصت» يُحفَظ ويظهر في التقدّم', async () => {
    const w = await world('خلصت');
    const draft = await draftOn(w, 0);
    const [first] = coreChunks(draft);

    await setChunkState(draft.id, first.key, CHUNK_STATE.DONE);
    const after = await studyDrafts.get(draft.id);
    const at = chunkProgress(coreChunks(after), chunkStates(after));
    expect(at.done).toBe(1);
    expect(at.fresh).toBe(1);
  });

  it('٩ · والرجوعُ إلى «لم تبدأ» يمحو المفتاح ولا يكتب حالةً فارغة', async () => {
    /*
     * ⚠️ الغيابُ هو الحالةُ الابتدائيّة. وكتابتُها صراحةً تُراكم
     *    مفاتيحَ لقطعٍ حُذفت من النصّ، فينمو الحقلُ بلا سقف.
     */
    const w = await world('محو');
    const draft = await draftOn(w, 0);
    const [first] = coreChunks(draft);

    await setChunkState(draft.id, first.key, CHUNK_STATE.DONE);
    await setChunkState(draft.id, first.key, CHUNK_STATE.NEW);
    const after = await studyDrafts.get(draft.id);
    expect(Object.keys(chunkStates(after))).toHaveLength(0);
  });

  it('١٠ · وقطعةٌ اختفت من النصّ لا تُعَدّ ولو بقيت حالتُها', async () => {
    const w = await world('اختفت');
    const draft = await draftOn(w, 0);
    const [, second] = coreChunks(draft);
    await setChunkState(draft.id, second.key, CHUNK_STATE.DONE);

    await saveDraftText(draft.id, 'стол\nطاولة');
    const after = await studyDrafts.get(draft.id);
    const at = chunkProgress(coreChunks(after), chunkStates(after));
    expect(at.total).toBe(1);
    expect(at.done).toBe(0);
  });

  it('١١ · والتقدّمُ لا يُشتَقّ من عددِ التشغيل — حكمٌ لا شهادة', async () => {
    const w = await world('لا-اشتقاق');
    const draft = await draftOn(w, 0);
    const chunks = coreChunks(draft);
    /* لا حالاتٍ محفوظة ⇒ صفرٌ خلص، مهما كان في `practiceEvidence`. */
    expect(chunkProgress(chunks, {}).done).toBe(0);
  });

  it('١٢ · ومسودّةٌ قديمةٌ بلا الحقل تُقرأ فارغةً ولا تُلمَس', async () => {
    const w = await world('قديمة');
    const draft = await draftOn(w, 0);
    const raw = await studyDrafts.get(draft.id);
    expect(raw[CHUNK_STATES] === undefined).toBe(true);
    expect(chunkStates(raw)).toEqual({});
  });
});

/* ================================================================== *
 * الخريطةُ الموحَّدة — طبقةٌ واحدةٌ لا ميزتان (بنود ١ و٣ و١٢)
 * ================================================================== */
describe('WS-SL · الجملةُ مركزٌ واحد', () => {
  it('١٣ · جملةٌ بلا مادّةِ تعلّمٍ لا تدخل الخريطة', async () => {
    /*
     * ⚠️ **ونصٌّ خاصٌّ بهذا الاختبار وحدَه** — أوّلُ صياغةٍ استعملت
     *    النصَّ المشترك، فوجدت مادّةً: مسودّةُ اختبارٍ سابقٍ في هذا
     *    الملفّ نفسِه تُلتقَط بالرجوع القديم بالنصّ، وهو سلوكٌ **صحيح**
     *    (توافقُ ما قبل الهُويّة). فالاختبارُ كان يقيس بيئتَه لا دعواه.
     */
    const only = [`Уникально ${TAG} один.`, `Уникально ${TAG} два.`].join('\n');
    const w = await world('فاضية', only);
    const map = await learningForSegments(await scripts.get(w.scriptId), only.split('\n'), {
      sceneId: w.sceneId,
    });
    expect(map.size).toBe(0);
  });

  it('١٤ · وجملةٌ بقطعٍ وحدَها تُعرَف بقطعِها', async () => {
    const w = await world('قطع-فقط');
    await draftOn(w, 2);
    const map = await learningForSegments(await scripts.get(w.scriptId), LINES, {
      sceneId: w.sceneId,
    });
    const at = map.get(2);
    expect(at.chunks).toBe(2);
    expect(at.stories).toBe(0);
    expect(hasLearning(at)).toBe(true);
  });

  it('١٥ · وجملةٌ بقصّةٍ وحدَها تُعرَف بقصّتها', async () => {
    const w = await world('قصّة-فقط');
    await createStory(await scripts.get(w.scriptId), 1, { text: 'Я пришёл в аптеку.' }, io);
    const map = await learningForSegments(await scripts.get(w.scriptId), LINES, {
      sceneId: w.sceneId,
    });
    expect(map.get(1).stories).toBe(1);
    expect(map.get(1).chunks).toBe(0);
    expect(hasLearning(map.get(1))).toBe(true);
  });

  it('١٦ · وجملةٌ بالاثنين تجمعهما في مدخلٍ واحد', async () => {
    const w = await world('الاثنين');
    await draftOn(w, 0);
    await createStory(await scripts.get(w.scriptId), 0, { text: 'Аня: Привет!\nБорис: Здравствуй.' }, io);

    const map = await learningForSegments(await scripts.get(w.scriptId), LINES, {
      sceneId: w.sceneId,
    });
    const at = map.get(0);
    expect(at.chunks).toBe(2);
    expect(at.stories).toBe(1);
    expect(map.size).toBe(1);
  });

  it('١٧ · وتوأمان نصُّهما واحدٌ ولكلٍّ مادّتُه', async () => {
    const w = await world('توأم');
    await draftOn(w, 1);
    await createStory(await scripts.get(w.scriptId), 3, { text: 'Я купил лекарство.' }, io);

    const map = await learningForSegments(await scripts.get(w.scriptId), LINES, {
      sceneId: w.sceneId,
    });
    expect(map.get(1).chunks).toBe(2);
    expect(map.get(1).stories).toBe(0);
    expect(map.get(3).stories).toBe(1);
    expect(map.get(3).chunks).toBe(0);
  });

  it('١٨ · وتصمد بعد تعديل جملةٍ أخرى', async () => {
    const w = await world('تعديل');
    await draftOn(w, 2);
    await createStory(await scripts.get(w.scriptId), 2, { text: 'Я подождал.' }, io);

    const edited = [...LINES];
    edited[0] = `Приветик ${TAG}, всё хорошо?`;
    await updateScript(w.scriptId, { text: edited.join('\n') });

    const map = await learningForSegments(await scripts.get(w.scriptId), edited, {
      sceneId: w.sceneId,
    });
    expect(map.get(2).chunks).toBe(2);
    expect(map.get(2).stories).toBe(1);
  });

  it('١٩ · وتصمد بعد إعادة ترتيب الجمل — فتتبع جملتَها', async () => {
    const w = await world('ترتيب');
    await draftOn(w, 4);
    await createStory(await scripts.get(w.scriptId), 4, { text: 'Пока.' }, io);

    const moved = [LINES[4], ...LINES.slice(0, 4)];
    await updateScript(w.scriptId, { text: moved.join('\n') });

    const map = await learningForSegments(await scripts.get(w.scriptId), moved, {
      sceneId: w.sceneId,
    });
    expect(map.get(0).chunks).toBe(2);
    expect(map.get(0).stories).toBe(1);
    expect(map.has(4)).toBe(false);
  });

  it('٢٠ · ورقمُ المقطع في جلسةٍ جزئيّةٍ ليس رقمَ الجملة', async () => {
    const w = await world('جزئي');
    await draftOn(w, 3);
    const map = await learningForSegments(await scripts.get(w.scriptId), LINES.slice(2), {
      sceneId: w.sceneId,
    });
    expect(map.get(1).chunks).toBe(2);
    expect(map.has(3)).toBe(false);
  });

  it('٢١ · والتقدّمُ يظهر في ملخّص السطر', async () => {
    const w = await world('تقدّم');
    const draft = await draftOn(w, 0);
    const [first] = coreChunks(draft);
    await setChunkState(draft.id, first.key, CHUNK_STATE.DONE);

    const map = await learningForSegments(await scripts.get(w.scriptId), LINES, {
      sceneId: w.sceneId,
    });
    expect(map.get(0).done).toBe(1);
    expect(map.get(0).chunks).toBe(2);
  });
});

/* ================================================================== *
 * الأدلّة — تُقرأ ولا تُكتَب (بند ٨)
 * ================================================================== */
describe('WS-SL · الأدلّةُ من المخزن القائم', () => {
  it('٢٢ · هدفٌ بلا تسجيلاتٍ يعطي صفرًا ولا يسقط', async () => {
    expect(await evidenceCount('shadowVoice', `لا-وجود-${TAG}`)).toBe(0);
    expect(await evidenceCount(null, null)).toBe(0);
  });

  it('٢٣ · وتسجيلٌ محفوظٌ يُعَدّ من فهرس الهدف نفسِه', async () => {
    const { practiceEvidence } = await import('../js/db/repositories.js');
    const key = `هدف-${TAG}`;
    await practiceEvidence.create({
      targetType: 'shadowVoice', targetId: key, practiceType: 'voiceAttempt',
      practicedAt: Date.now(),
    });
    expect(await evidenceCount('shadowVoice', key)).toBe(1);
  });
});

/* ================================================================== *
 * حرّاسٌ بنيويّون — يقيسون الكود (بنود ٣ و٨ و١٥)
 * ================================================================== */
describe('WS-SL · حرّاسٌ بنيويّون', () => {
  it('٢٤ · لا مخزنَ جديدٌ للقطع: الحالةُ حقلٌ على المسودّة', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-learning.js'));
    expect(src.includes('studyDrafts.update(')).toBe(true);
    expect(/createObjectStore|\.create\(\s*\{/.test(src)).toBe(false);
  });

  it('٢٥ · ولا نظامَ أدلّةٍ ثانٍ: تُقرأ ولا تُكتَب هنا', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-learning.js'));
    expect(src.includes('practiceEvidence.byIndex(')).toBe(true);
    expect(/practiceEvidence\.(create|update|remove)/.test(src)).toBe(false);
  });

  it('٢٦ · ولا محلّلَ بنيةٍ ثانٍ: القطعُ تُجمَّع من ناتج القائم', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-learning.js'));
    expect(src.includes('draftPairs(')).toBe(true);
    expect(/parseBilingual|splitSentences|new RegExp/.test(src)).toBe(false);
  });

  it('٢٧ · ولا مشغّلَ صوتٍ ولا مسجّلَ ثانٍ', async () => {
    const src = bare(await sourceOf('../js/services/shadow/sentence-learning.js'));
    expect(/new Audio\s*\(|MediaRecorder|getUserMedia/.test(src)).toBe(false);
  });
});

/* ================================================================== *
 * الواجهةُ الموحَّدة — بابٌ واحدٌ وعالَمٌ داخله (بنود ١، ٣، ٦، ١٠، ١٥)
 * ================================================================== */
describe('WS-SL · بابٌ واحدٌ لا بابان', () => {
  const view = () => sourceOf('../js/views/shadow-view.js');

  it('٢٨ · لا أداةَ «مسودّة» ولا أداةَ «قصّة» في السكّة — أداةُ تعلّمٍ واحدة', async () => {
    /*
     * ⚠️ **حارسُ بند ١٥.** كانت أداتان، ووصفتُهما وقتَها بأنّهما
     *    «متجاورتان لمادّتين متجاورتين». والوصفُ صحيحٌ والاستنتاجُ منه
     *    خطأ: تجاورُ المادّتين سببٌ لجمعهما، لا لفتح بابين إليهما.
     */
    const src = bare(await view());
    const tools = src.slice(src.indexOf('const TOOLS = ['), src.indexOf("{ id: 'sky'"));
    expect(tools.includes("id: 'learn'")).toBe(true);
    expect(tools.includes("id: 'draft'")).toBe(false);
    expect(tools.includes("id: 'story'")).toBe(false);
  });

  it('٢٩ · وصفُّ الجملة يحمل شارةً واحدةً لا شارتين', async () => {
    const src = bare(await view());
    const at = src.indexOf('function lineHtml');
    const body = src.slice(at, at + 1600);
    expect(body.includes('learnBadgeHtml(index)')).toBe(true);
    expect(/draftBadgeHtml|storyBadgeHtml/.test(body)).toBe(false);
  });

  it('٣٠ · والجملةُ الأصليّةُ في رأس اللوح دائمًا', async () => {
    /* ⚠️ بندا ٢ و١٣: تقرأ ما تتعلّمه وأنت ترى ما جاء منه. */
    const src = await view();
    const at = src.indexOf('function learnHeadHtml');
    expect(at > 0).toBe(true);
    const body = src.slice(at, at + 1400);
    expect(body.includes('sh-learn-src')).toBe(true);
    expect(body.includes('sourceTextSnapshot') || body.includes('${source}')).toBe(true);
  });

  it('٣١ · وثلاثةُ تبويباتٍ تظهر ولو كان أحدُها فارغًا', async () => {
    /*
     * ⚠️ **تبويبٌ يُخفى لفراغه يقفل بابَ ملئه.** أخفيتُ «مشهد النقل»
     *    أوّلَ تصميمٍ حتى توجد قصّة — فلم يبقَ طريقٌ إلى إنشاء الأولى.
     */
    const src = bare(await view());
    const at = src.indexOf('const tabs = [');
    expect(at > 0).toBe(true);
    const body = src.slice(at, at + 700);
    expect(body.includes('LEARN_TAB.CHUNKS')).toBe(true);
    expect(body.includes('LEARN_TAB.STORY')).toBe(true);
    expect(body.includes('LEARN_TAB.TOOLS')).toBe(true);
  });

  it('٣٢ · والبرومبتاتُ من المكتبة لا نصوصٌ في الشاشة', async () => {
    /* ⚠️ بند ١٠: نصٌّ ثابتٌ في الواجهة يصير برومبتًا ثانيًا يفترق. */
    const src = bare(await view());
    expect(src.includes("import('../services/prompts/library.js')")).toBe(true);
    /* ولا تعليماتِ نموذجٍ مكتوبةً في الشاشة. */
    expect(/You are helping|Your job:/.test(src)).toBe(false);
  });

  it('٣٣ · والبرومبتُ يُملأ بالجملة قبل النسخ', async () => {
    const { LEARN_PROMPTS, learnPromptById } = await import('../js/services/prompts/library.js');
    expect(LEARN_PROMPTS.length >= 2).toBe(true);
    const one = learnPromptById('sentence-chunks');
    expect(one.build(`Проверка ${TAG}.`)).toContain(`Проверка ${TAG}.`);
    expect(learnPromptById('sentence-scene').build('X')).toContain('X');
    expect(learnPromptById('لا-يوجد')).toBe(null);
  });

  it('٣٤ · ولا مسارَ نطقٍ ثانٍ للأمثلة', async () => {
    /* ⚠️ `speakScope` هي التي توحّد الكلمةَ والمقطعَ والجملة منذ WS-M. */
    const src = bare(await view());
    const at = src.indexOf("case 'say':");
    expect(at > 0).toBe(true);
    expect(src.slice(at, at + 120).includes('speakScope(')).toBe(true);
  });

  it('٣٥ · ولا مسارَ تدريبٍ ثانٍ: بابان على جسمٍ واحدٍ مُستخرَج', async () => {
    /*
     * ⚠️ **النسخُ هنا خطرٌ معروف**: إصلاحٌ في أحدهما لا يصل إلى الآخر،
     *    فيفترق «تدرّب على المسودّة» عن «تدرّب على القطعة» بلا عَرَض.
     */
    const src = bare(await view());
    expect(src.includes('async function enterTempSource')).toBe(true);
    const draft = src.slice(src.indexOf('async function enterDraftSource'), src.indexOf('async function enterTempSource'));
    expect(draft.includes('enterTempSource(')).toBe(true);
    const chunk = src.slice(src.indexOf('async function shadowChunk'), src.indexOf('async function shadowChunk') + 1200);
    expect(chunk.includes('enterTempSource(')).toBe(true);
    /* ولا `pushSegment` إلّا في الجسم الواحد. */
    expect([...src.matchAll(/player\.pushSegment\(/g)]).toHaveLength(1);
  });
});

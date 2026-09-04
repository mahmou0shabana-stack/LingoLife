/**
 * LingoLife — نموذجُ التعلّم وعدّاداتُه (WS-DV2 · بنود ١٤ إلى ١٧ و٥٣ و٥٨ و٦٠ و٦١)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العددُ الذي لا يقول ما يعدّ كذبةٌ صغيرةٌ متكرّرة
 * ═══════════════════════════════════════════════════════════════
 *
 * «٤٤ وحدة» و«١٠ أزواج» رقمان صحيحان حسابيًّا ولا يعنيان شيئًا
 * للمتعلّم. فكلُّ اختبارٍ هنا يسأل الرقمَ: **ماذا تعدّ بالضبط؟**
 */

import { describe, it, expect } from './test-runner.js';
import {
  learnModel, learnModelSync, groupsOf, countsOf, selectionSummary, speechTargets,
  sentenceSummary, setTargetState, GROUP_LABEL, GROUP_ORDER,
} from '../js/services/shadow/draft-learning.js';
import { ROLE, isSpeechRole } from '../js/services/shadow/draft-targets.js';
import { CHUNK_STATE } from '../js/services/shadow/sentence-learning.js';
import { studyDrafts } from '../js/db/repositories.js';

const TAG = `DL-${Math.random().toString(36).slice(2, 7)}`;

const V2 = [
  'MICRO CORE 1', 'требования по документации', 'متطلبات التوثيق',
  'أمثلة:', 'Какие требования по документации?', 'إيه المتطلبات؟',
  'MICRO CORE 2', 'не совсем понятны', 'مش واضحة',
  'MICRO CORE 3', 'уточнить этот вопрос', 'يوضّح النقطة',
  'EXPANSION 1', 'Я бы сначала уточнил этот вопрос.', 'هوضّح الأول',
  'EXPANSION 2', 'Я бы сначала уточнил этот вопрос у специалиста.', 'عند المختص',
  'CORE FAMILY: я бы сначала уточнил…',
  'الأولوية: ★★★',
  'VARIATION 1', 'Я бы сначала уточнил детали.',
  'VARIATION 2', 'Я бы сначала уточнил сроки.',
  'FULL RECONSTRUCTION',
  'Вопрос:', 'Что бы ты сделал?',
  'Ответ:', 'Если требования не понятны, я бы сначала уточнил этот вопрос.',
].join('\n');

/** مسودّةٌ قديمةٌ بلا أيّ علامةِ V2. */
const V1 = [
  'уточнить вопрос', 'يوضّح النقطة',
  'أمثلة:', 'Уточните, пожалуйста.', 'وضّح لو سمحت',
  '━━━━━━━━━━',
  'требования', 'المتطلبات',
].join('\n');

const mkDraft = (text) => studyDrafts.create({
  subject: `${TAG}-${Math.random().toString(36).slice(2, 7)}`,
  subjectKind: 'sentence',
  text,
});

/* ================================================================== *
 * شكلٌ واحدٌ فوق نسختين (بند ٣٠)
 * ================================================================== */
describe('WS-DV2 · نموذجٌ واحدٌ لا تعرف الشاشةُ نسختَه', () => {
  it('١ · مسودّةُ V2 تُقرأ بأدوارها', async () => {
    const draft = await mkDraft(V2);
    const model = await learnModel(draft);

    expect(model.version).toBe(2);
    expect(model.counts.byRole[ROLE.MICRO_CORE]).toBe(3);
    expect(model.counts.byRole[ROLE.EXPANSION]).toBe(2);
    expect(model.counts.byRole[ROLE.VARIATION]).toBe(2);
    expect(model.counts.byRole[ROLE.FULL_BUILD]).toBe(1);
    await studyDrafts.trash(draft.id);
  });

  it('٢ · ⚠️ والقديمةُ تبقى قديمةً — بلا اختراع', async () => {
    /*
     * ⚠️ البندُ ٣٠ صريح: لا أسئلةَ استرجاعٍ مخترَعة، ولا تكرارات، ولا
     *    إعادةَ بناءٍ ملفَّقة. ومسودّةٌ قديمةٌ تُعرَض قطعًا وأمثلةً وكفى.
     */
    const draft = await mkDraft(V1);
    const model = await learnModel(draft);

    expect(model.version).toBe(1);
    expect(model.counts.byRole[ROLE.VARIATION] === undefined).toBe(true);
    expect(model.counts.byRole[ROLE.FULL_BUILD] === undefined).toBe(true);
    expect(model.targets.every((one) => !one.cue)).toBe(true);
    expect(model.chain).toHaveLength(0);
    await studyDrafts.trash(draft.id);
  });

  it('٣ · وكلاهما يخرج بنفس الشكل', async () => {
    const a = await mkDraft(V2);
    const b = await mkDraft(V1);
    const one = await learnModel(a);
    const two = await learnModel(b);

    for (const model of [one, two]) {
      expect(Array.isArray(model.targets)).toBe(true);
      expect(Array.isArray(model.groups)).toBe(true);
      expect(typeof model.counts.speech).toBe('number');
      expect(model.targets.every((t) => typeof t.id === 'string' && t.id)).toBe(true);
    }
    await studyDrafts.trash(a.id);
    await studyDrafts.trash(b.id);
  });
});

/* ================================================================== *
 * العدّادُ الدلاليّ (بندا ١٥ و٥٣)
 * ================================================================== */
describe('WS-DV2 · كلُّ رقمٍ يقول ما يعدّ', () => {
  it('٤ · المجموعُ مشتقٌّ من مفرداته بالضبط', async () => {
    const draft = await mkDraft(V2);
    const { counts } = await learnModel(draft);

    const sum = counts.byRole[ROLE.MICRO_CORE] + counts.byRole[ROLE.EXPANSION]
      + counts.byRole[ROLE.VARIATION] + counts.byRole[ROLE.FULL_BUILD];
    expect(counts.speech).toBe(sum);
    expect(counts.speech).toBe(8);
    await studyDrafts.trash(draft.id);
  });

  it('٥ · ⚠️ والأمثلةُ خارجَ المجموع الافتراضيّ (بندا ١٣ و٦١)', async () => {
    const draft = await mkDraft(V2);
    const { counts } = await learnModel(draft);

    expect(counts.examples).toBe(1);
    /* لو دخلت لَصار ٩ — وهو «٥ ← ١٠» بشكلٍ أصغر. */
    expect(counts.speech).toBe(8);
    await studyDrafts.trash(draft.id);
  });

  it('٦ · والتقدّمُ لكلّ دورٍ على حدة (بند ١٦)', async () => {
    const draft = await mkDraft(V2);
    const first = await learnModel(draft);
    const core = first.targets.find((one) => one.role === ROLE.MICRO_CORE);

    await setTargetState(draft.id, core.id, CHUNK_STATE.DONE);
    const after = await learnModel(await studyDrafts.get(draft.id));

    expect(after.counts.doneByRole[ROLE.MICRO_CORE]).toBe(1);
    expect(after.counts.done).toBe(1);
    /* ولا يقفز تقدّمُ دورٍ آخر. */
    expect(after.counts.doneByRole[ROLE.EXPANSION] === undefined).toBe(true);
    await studyDrafts.trash(draft.id);
  });
});

/* ================================================================== *
 * الاختيارُ المجموعُ بالدور (بندا ٢٨ و٦٠)
 * ================================================================== */
describe('WS-DV2 · الاختيارُ يقول ما اخترتَه', () => {
  it('٧ · المجموعاتُ بترتيبٍ ثابتٍ وأسماءٍ مفهومة', async () => {
    const draft = await mkDraft(V2);
    const model = await learnModel(draft);
    const roles = model.groups.map((g) => g.role);

    expect(roles).toEqual([ROLE.MICRO_CORE, ROLE.EXPANSION, ROLE.VARIATION,
      ROLE.FULL_BUILD, ROLE.EXAMPLE]);
    expect(model.groups[0].label).toBe(GROUP_LABEL[ROLE.MICRO_CORE]);
    /* والأمثلةُ مُعلَّمةٌ اختياريّة. */
    expect(model.groups[4].optional).toBe(true);
    await studyDrafts.trash(draft.id);
  });

  it('٨ · ⚠️ واختيارُ ٢ كور و٣ تكرارات… يقول ذلك حرفيًّا', async () => {
    const draft = await mkDraft(V2);
    const model = await learnModel(draft);

    const pick = [
      ...model.targets.filter((o) => o.role === ROLE.MICRO_CORE).slice(0, 2),
      ...model.targets.filter((o) => o.role === ROLE.VARIATION).slice(0, 2),
      ...model.targets.filter((o) => o.role === ROLE.FULL_BUILD),
    ].map((o) => o.id);

    const sum = selectionSummary(model.targets, pick);
    expect(sum.total).toBe(5);
    expect(sum.breakdown).toEqual([
      { role: ROLE.MICRO_CORE, label: 'الكور الأساسية', count: 2 },
      { role: ROLE.VARIATION, label: 'التكرارات', count: 2 },
      { role: ROLE.FULL_BUILD, label: 'إعادة البناء', count: 1 },
    ]);
    /* والمجموعُ يساوي مجموعَ التفصيل — لا رقمًا مستقلًّا. */
    expect(sum.breakdown.reduce((a, b) => a + b.count, 0)).toBe(sum.total);
    await studyDrafts.trash(draft.id);
  });

  it('٩ · ⚠️ وأهدافُ النُّطق لا تشمل سقالةً ولا مثالًا افتراضيًّا', async () => {
    const draft = await mkDraft(V2);
    const model = await learnModel(draft);

    const speech = speechTargets(model.targets);
    expect(speech).toHaveLength(8);
    expect(speech.every((one) => isSpeechRole(one.role))).toBe(true);
    expect(speech.some((one) => one.role === ROLE.EXAMPLE)).toBe(false);

    /* وبطلبٍ صريحٍ يُضاف المثال — والفرقُ ظاهرٌ في العدد. */
    expect(speechTargets(model.targets, { withExamples: true })).toHaveLength(9);
    await studyDrafts.trash(draft.id);
  });
});

/* ================================================================== *
 * صفُّ الجملة الصفراء (بندا ١٨ و١٩)
 * ================================================================== */
describe('WS-DV2 · ملخّصُ الجملة صادقٌ ومضغوط', () => {
  it('١٠ · سطرٌ لكلّ دورٍ موجودٍ فعلًا', async () => {
    const draft = await mkDraft(V2);
    const summary = sentenceSummary(await learnModel(draft));

    expect(summary.rows.map((r) => r.role)).toEqual([
      ROLE.MICRO_CORE, ROLE.EXPANSION, ROLE.VARIATION, ROLE.FULL_BUILD,
    ]);
    expect(summary.rows[0].total).toBe(3);
    expect(summary.speech).toBe(8);
    await studyDrafts.trash(draft.id);
  });

  it('١١ · ودورٌ غائبٌ لا يُعرَض بصفرٍ كاذب', async () => {
    const draft = await mkDraft(V1);
    const summary = sentenceSummary(await learnModel(draft));
    expect(summary.rows.some((r) => r.role === ROLE.VARIATION)).toBe(false);
    await studyDrafts.trash(draft.id);
  });

  it('١٢ · والتقدّمُ يظهر في السطر نفسِه', async () => {
    const draft = await mkDraft(V2);
    const model = await learnModel(draft);
    const core = model.targets.find((o) => o.role === ROLE.MICRO_CORE);
    await setTargetState(draft.id, core.id, CHUNK_STATE.DONE);

    const summary = sentenceSummary(await learnModel(await studyDrafts.get(draft.id)));
    expect(summary.rows[0].done).toBe(1);
    expect(summary.rows[0].total).toBe(3);
    await studyDrafts.trash(draft.id);
  });
});

/* ================================================================== *
 * الحالةُ تعيش على المعرّف الثابت (بند ٦٢)
 * ================================================================== */
describe('WS-DV2 · التقدّمُ ينجو من إعادة الترتيب', () => {
  it('١٣ · ⚠️ «خلصت» تبقى لهدفها بعد إدراج قطعةٍ قبله', async () => {
    /*
     * ⚠️ **هذا هو الاختبارُ الذي يربط الطبقات الثلاث**: المحلّلُ يقرأ،
     *    والمعرّفُ يثبت، والحالةُ تتبع المعرّفَ لا الموضع. ولو كانت
     *    الحالةُ بالترتيب لَانتقلت «خلصت» إلى القطعة المُدرَجة.
     */
    const draft = await mkDraft(V2);
    const model = await learnModel(draft);
    const second = model.targets.filter((o) => o.role === ROLE.MICRO_CORE)[1];
    await setTargetState(draft.id, second.id, CHUNK_STATE.DONE);

    /* نُدرج قطعةً جديدةً في الأوّل. */
    const edited = V2.replace('MICRO CORE 1',
      'MICRO CORE 0\nновая часть\nقطعة جديدة\nMICRO CORE 1');
    await studyDrafts.update(draft.id, { text: edited });

    const after = await learnModel(await studyDrafts.get(draft.id));
    const same = after.targets.find((o) => o.ru === second.ru && o.role === ROLE.MICRO_CORE);
    expect(same.id).toBe(second.id);
    expect(same.state).toBe(CHUNK_STATE.DONE);

    /* والمُدرَجةُ الجديدةُ لم ترث شيئًا. */
    const fresh = after.targets.find((o) => o.ru === 'новая часть');
    expect(fresh.state).toBe(CHUNK_STATE.NEW);
    await studyDrafts.trash(draft.id);
  });

  it('١٤ · وقراءةٌ بلا كتابةٍ لا تلمس السجلّ', async () => {
    const draft = await mkDraft(V2);
    await learnModel(draft);
    const before = (await studyDrafts.get(draft.id)).rev;

    await learnModel(await studyDrafts.get(draft.id), { write: false });
    expect((await studyDrafts.get(draft.id)).rev).toBe(before);
    await studyDrafts.trash(draft.id);
  });
});

/* ================================================================== *
 * قراءةُ القائمة الصفراء لا تكتب (بندا ٤٩ و٥٠)
 * ================================================================== */
describe('WS-DV2 · صفُّ الجملة يقرأ ولا يكتب', () => {
  it('١٥ · ⚠️ النسخةُ المتزامنةُ لا تلمس السجلَّ ولو نوديت مرارًا', async () => {
    /*
     * ⚠️ **عطبٌ أمسكتُه قبل أن يشحن.** صفُّ الجملة يُرسَم لكلّ جملةٍ في
     *    السكريبت. ولو نادى كلٌّ منها `learnModel` لَصارت كلُّ رسمةٍ
     *    **مئةَ كتابةٍ في IndexedDB**: `rev` يرتفع و`dirty=1`، فيصير
     *    مجرَّدُ فتحِ الشاشة مئةَ تعديلٍ تُزامَن. وهو البند ٥٠ مكسورًا
     *    في اتّجاه الكتابة — وهو أسوأُ من اتّجاه القراءة.
     */
    const draft = await mkDraft(V2);
    await learnModel(draft);
    const settled = await studyDrafts.get(draft.id);
    const rev = settled.rev;

    for (let i = 0; i < 20; i += 1) learnModelSync(settled);
    expect((await studyDrafts.get(draft.id)).rev).toBe(rev);
    await studyDrafts.trash(draft.id);
  });

  it('١٦ · وتُخرج نفسَ ما تُخرجه النسخةُ غيرُ المتزامنة', async () => {
    const draft = await mkDraft(V2);
    const async1 = await learnModel(draft);
    const sync1 = learnModelSync(await studyDrafts.get(draft.id));

    expect(sync1.version).toBe(async1.version);
    expect(sync1.counts.speech).toBe(async1.counts.speech);
    expect(sync1.targets.map((o) => o.id)).toEqual(async1.targets.map((o) => o.id));
    await studyDrafts.trash(draft.id);
  });

  it('١٧ · ومسودّةٌ بلا معرّفاتٍ بعدُ تُقرأ متزامنةً بلا رمي', async () => {
    const draft = await mkDraft(V2);
    /* لم تُفتَح اللوحةُ بعد، فلا `targetIds` محفوظة. */
    const model = learnModelSync(draft);
    expect(model.counts.speech).toBe(8);
    expect(model.targets.every((o) => o.id)).toBe(true);
    await studyDrafts.trash(draft.id);
  });
});

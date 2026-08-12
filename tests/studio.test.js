/**
 * LingoLife — اختبارات استوديو الإثراء
 *
 * خمس قواعد تُحرَس:
 *
 *  1. **السجلّ يُعلن نفسه** — كل وجهٍ له سببٌ ومتى دخل النموذج، وكل
 *     ما يُرفض تعديلُه جماعيًّا له سببٌ مكتوب. بلا ذلك تصير الأداة
 *     تفعل أشياءَ لا تُفسِّرها.
 *  2. **الخطّة لا تكتب** — بناؤها مرّتين لا يترك أثرًا في القاعدة.
 *  3. **التراجع يعيد ما كان بالضبط** — ولا يمحو ما لم نكتبه نحن.
 *     دفعةٌ تمحو عضويّةً كانت عندك قبلها أسوأ من دفعةٍ لم تعمل.
 *  4. **فشلُ صفٍّ لا يُسقط الدفعة** — وهو خلافٌ مقصودٌ مع الاستيراد،
 *     لأن الصفوف هنا مستقلّة.
 *  5. **الرقم وعدٌ يُوفَّى** — عدّ النقص = ما ترجّعه مجموعة العمل،
 *     والأثر المعروض = ما يصير فعلًا بعد الكتابة.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventThreads, relationships, conversationParts,
  conversations, expressions, expressionOccurrences, scripts,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { addPerson } from '../js/services/person-service.js';
import { resetTypes, typeLabel } from '../js/services/type-service.js';
import { addConversationPart } from '../js/services/content-service.js';
import { createThread, addSceneToThread, threadsOfScene } from '../js/services/thread-service.js';
import { addParticipant, participantIds } from '../js/services/participant-service.js';
import {
  ASPECTS, NOT_BULK_EDITABLE, aspectById, bulkAspects, applyAspect, FILL,
} from '../js/services/studio/aspects.js';
import {
  readWorld, censusGaps, workingSet, impactOf, COHORTS,
} from '../js/services/studio/census.js';
import { planBatch, applyBatch, LARGE_BATCH } from '../js/services/studio/batch.js';

async function fresh() {
  await openDB();
  for (const repo of [
    scenes, people, eventThreads, relationships, conversations,
    conversationParts, expressions, expressionOccurrences, scripts,
  ]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

const scene = (titleAr, date = '2026-04-01', extra = {}) =>
  createScene({ titleAr, date, type: 'meeting', ...extra });

/* ================================================================== */

describe('السجلّ يُعلن نفسه', () => {
  it('كل وجهٍ له وسمٌ وسببٌ ومتى دخل النموذج', () => {
    for (const aspect of ASPECTS) {
      expect(Boolean(aspect.label)).toBe(true);
      expect(Boolean(aspect.why)).toBe(true);
      // ⚠️ `since` هو ما يقول للمستخدم إن الفراغ أثرُ تطوّرٍ لا إهمال.
      expect(Boolean(aspect.since)).toBe(true);
    }
  });

  it('⚠️ وكلُّ وجهٍ لا يقبل الدفعة يقول لماذا', () => {
    for (const aspect of ASPECTS) {
      if (aspect.bulk) continue;
      expect(aspect.bulkReason.length > 10).toBe(true);
    }
  });

  it('⚠️ وما يُرفض تعديلُه جماعيًّا معه سببٌ حقيقيّ لا كلمة', () => {
    const entries = Object.entries(NOT_BULK_EDITABLE);
    expect(entries.length > 0).toBe(true);
    for (const [key, row] of entries) {
      expect(Boolean(row.label)).toBe(true);
      expect(row.reason.length > 20).toBe(true);
      expect(key.length > 0).toBe(true);
    }
  });

  it('الأوجه معرّفاتها فريدة', () => {
    const ids = ASPECTS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('«السياق» مُعلَنٌ أنه لا يُملأ دفعةً — لا محذوفٌ بصمت', () => {
    const context = aspectById('context');
    expect(context.bulk).toBe(false);
    expect(bulkAspects().some((row) => row.id === 'context')).toBe(false);
    // لكنه يبقى في السجلّ ليُعَدّ ويُرى.
    expect(ASPECTS.some((row) => row.id === 'context')).toBe(true);
  });
});

/* ================================================================== */

describe('إحصاء النقص', () => {
  it('يعدّ الناقص لكل وجه', async () => {
    await fresh();
    await scene('بمكان', '2026-04-01', { placeName: 'المكتب' });
    await scene('بلا مكان', '2026-04-02');
    await scene('بلا مكان كمان', '2026-04-03');

    const out = await censusGaps();
    const place = out.aspects.find((row) => row.id === 'place');
    expect(out.total).toBe(3);
    expect(place.missing).toBe(2);
    expect(place.filled).toBe(1);
  });

  it('⚠️ الذكرى المحذوفة تخرج من العدّ — العدد يشير لما يُفتَح', async () => {
    await fresh();
    const a = await scene('باقية', '2026-04-01');
    const b = await scene('هتتحذف', '2026-04-02');
    await scenes.trash(b.id);

    const out = await censusGaps();
    expect(out.total).toBe(1);
    expect(out.aspects.find((row) => row.id === 'place').missing).toBe(1);
    expect(a.id.length > 0).toBe(true);
  });

  it('«غير محدّد» نقصٌ في النوع لا اختيار', async () => {
    await fresh();
    await scene('محدّدة', '2026-04-01', { type: 'meeting' });
    await createScene({ titleAr: 'مش محدّدة', date: '2026-04-02', type: 'other' });

    const out = await censusGaps();
    expect(out.aspects.find((row) => row.id === 'type').missing).toBe(1);
  });

  it('⚠️ ومَن تكلّم لا يُحسَب إعلانَ مشاركة — الغياب غيابُ إعلان', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const igor = await addPerson({ name: 'إيجور' });
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });

    const out = await censusGaps();
    // فيها متكلّم، ومع ذلك المشاركون ناقصون: مارينا الصامتة ليست فيها.
    expect(out.aspects.find((row) => row.id === 'participants').missing).toBe(1);
  });

  it('ويُفرَز ما عندنا عنه دليلٌ جاهز', async () => {
    await fresh();
    const withTalk = await scene('فيها كلام', '2026-04-01');
    await scene('صامتة', '2026-04-02');
    const igor = await addPerson({ name: 'إيجور' });
    await addConversationPart(withTalk.id, { speaker: 'إيجور', text: 'X', personId: igor.id });

    const out = await censusGaps();
    const row = out.aspects.find((r) => r.id === 'participants');
    expect(row.missing).toBe(2);
    expect(row.withEvidence).toBe(1);
  });

  it('عالمٌ فارغ يعطي أصفارًا صادقة لا سقوطًا', async () => {
    await fresh();
    const out = await censusGaps();
    expect(out.total).toBe(0);
    expect(out.aspects.every((row) => row.missing === 0)).toBe(true);
  });

  it('الترتيب ثابت: الأكثر نقصًا أوّلًا', async () => {
    await fresh();
    await scene('أ', '2026-04-01', { placeName: 'المكتب' });
    await scene('ب', '2026-04-02', { placeName: 'المكتب' });

    const first = (await censusGaps()).aspects.map((row) => row.id);
    const second = (await censusGaps()).aspects.map((row) => row.id);
    expect(first).toEqual(second);
  });
});

/* ================================================================== */

describe('مجموعة العمل — والدليل يأتي إليك', () => {
  it('ترجّع الناقص وحده', async () => {
    await fresh();
    await scene('بمكان', '2026-04-01', { placeName: 'المكتب' });
    const bare = await scene('بلا مكان', '2026-04-02');

    const out = await workingSet('place');
    expect(out.rows.length).toBe(1);
    expect(out.rows[0].id).toBe(bare.id);
  });

  it('⚠️ ومعها دليلُ كلِّ صفّ — وهو ما يُغني عن فتحها', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const igor = await addPerson({ name: 'إيجور' });
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });

    const out = await workingSet('participants');
    const text = out.rows[0].evidence.map((row) => row.text).join(' | ');
    expect(text.includes('إيجور')).toBe(true);
  });

  it('والقصّة دليلٌ أيضًا', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const thread = await createThread({ title: 'شحنة مايو' });
    await addSceneToThread(thread.id, s.id);

    const out = await workingSet('participants');
    const text = out.rows[0].evidence.map((row) => row.text).join(' | ');
    expect(text.includes('شحنة مايو')).toBe(true);
  });

  it('الشرائح تفصل ما له دليلٌ عمّا لا دليل له', async () => {
    await fresh();
    const talky = await scene('فيها كلام', '2026-04-01');
    await scene('صامتة', '2026-04-02');
    const igor = await addPerson({ name: 'إيجور' });
    await addConversationPart(talky.id, { speaker: 'إيجور', text: 'X', personId: igor.id });

    const withEvidence = await workingSet('participants', { cohort: 'evidence' });
    const bare = await workingSet('participants', { cohort: 'bare' });
    expect(withEvidence.rows.length).toBe(1);
    expect(bare.rows.length).toBe(1);
    expect(withEvidence.rows[0].id).toBe(talky.id);
  });

  it('⚠️ وعددُ الشريحة يوافق ما ترجّعه — الرقم وعدٌ يُوفَّى', async () => {
    await fresh();
    const talky = await scene('فيها كلام', '2026-04-01');
    await scene('صامتة أ', '2026-04-02');
    await scene('صامتة ب', '2026-04-03');
    const igor = await addPerson({ name: 'إيجور' });
    await addConversationPart(talky.id, { speaker: 'إيجور', text: 'X', personId: igor.id });

    const out = await workingSet('participants');
    for (const slice of COHORTS) {
      const actual = await workingSet('participants', { cohort: slice.id });
      expect(out.counts[slice.id]).toBe(actual.rows.length);
    }
  });

  it('الترشيح بالعنوان يعمل', async () => {
    await fresh();
    await scene('اجتماع الشحنة', '2026-04-01');
    await scene('زيارة العيادة', '2026-04-02');

    const out = await workingSet('place', { query: 'عيادة' });
    expect(out.rows.length).toBe(1);
  });

  it('الأحدث أوّلًا', async () => {
    await fresh();
    await scene('قديمة', '2026-01-01');
    await scene('جديدة', '2026-09-01');

    const out = await workingSet('place');
    expect(out.rows[0].title).toBe('جديدة');
  });

  it('وجهٌ مجهول يرمي برسالةٍ مفهومة لا يرجّع فراغًا', async () => {
    await fresh();
    let message = '';
    try {
      await workingSet('حاجة-مش-موجودة');
    } catch (err) {
      message = err.message;
    }
    expect(message.includes('مش معروف')).toBe(true);
  });
});

/* ================================================================== */

describe('الخطّة — تقرأ ولا تكتب', () => {
  it('⚠️ بناؤها مرّتين لا يترك أثرًا', async () => {
    await fresh();
    const s = await scene('ذكرى');
    const before = (await relationships.getAll()).length;

    const world = await readWorld();
    await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: [s.id], world });
    await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: [s.id], world });

    expect((await relationships.getAll()).length).toBe(before);
    expect((await scenes.get(s.id)).placeName).toBe('');
  });

  it('تقول قبل وبعد لكل صفّ', async () => {
    await fresh();
    const s = await scene('ذكرى');
    const plan = await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: [s.id] });
    expect(plan.rows[0].before).toBe('');
    expect(plan.rows[0].after).toBe('المكتب');
    expect(plan.willWrite).toBe(1);
  });

  it('⚠️ والإضافة تُعرَض إضافةً لا إحلالًا', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const igor = await addPerson({ name: 'إيجور' });
    const marina = await addPerson({ name: 'مارينا' });
    await addParticipant(s.id, igor.id);

    const plan = await planBatch({
      aspectId: 'participants', value: [marina.id], sceneIds: [s.id],
    });
    // القائم يبقى، والجديد يُضاف بجانبه.
    expect(plan.rows[0].before).toBe('إيجور');
    expect(plan.rows[0].after.includes('إيجور')).toBe(true);
    expect(plan.rows[0].after.includes('مارينا')).toBe(true);
  });

  it('صفٌّ لن يتغيّر يُعلَن ولا يُعَدّ في الكتابة', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01', { placeName: 'المكتب' });
    const plan = await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: [s.id] });
    expect(plan.willWrite).toBe(0);
    expect(plan.unchanged).toBe(1);
    expect(plan.rows[0].changes).toBe(false);
  });

  it('⚠️ ومعرّفٌ لذكرى محذوفة يُسقَط بسببه لا يُكتب فيه', async () => {
    await fresh();
    const s = await scene('هتتحذف');
    const world = await readWorld();
    await scenes.destroy(s.id);

    const plan = await planBatch({
      aspectId: 'place', value: 'المكتب', sceneIds: [s.id], world: await readWorld(),
    });
    expect(plan.rows.length).toBe(0);
    expect(plan.dropped.length).toBe(1);
    expect(plan.dropped[0].reason.length > 0).toBe(true);
    expect(world.scenes.length).toBe(1);
  });

  it('الدفعة الكبيرة تُعلَن كبيرة', async () => {
    await fresh();
    const ids = [];
    for (let i = 0; i < LARGE_BATCH + 1; i += 1) {
      ids.push((await scene(`ذكرى ${i}`, '2026-04-01')).id);
    }
    const plan = await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: ids });
    expect(plan.large).toBe(true);
  });

  it('⚠️ ووجهٌ لا يقبل الدفعة يرفض بسببه لا بصمت', async () => {
    await fresh();
    const s = await scene('ذكرى');
    let message = '';
    try {
      await planBatch({ aspectId: 'context', value: 'أي كلام', sceneIds: [s.id] });
    } catch (err) {
      message = err.message;
    }
    expect(message.length > 20).toBe(true);
  });
});

/* ================================================================== */

describe('الأثر — قبل وبعد بأرقامٍ مُشتقّة', () => {
  it('يقول كان في كام وهيبقى في كام', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const marina = await addPerson({ name: 'مارينا' });
    await addParticipant(a.id, marina.id);

    const world = await readWorld();
    const impact = impactOf('participants', [marina.id], [b.id], world);
    expect(impact[0].label).toBe('مارينا');
    expect(impact[0].before).toBe(1);
    expect(impact[0].after).toBe(2);
  });

  it('⚠️ والأثر يوافق الواقع بعد الكتابة فعلًا', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const marina = await addPerson({ name: 'مارينا' });
    await addParticipant(a.id, marina.id);

    const plan = await planBatch({
      aspectId: 'participants', value: [marina.id], sceneIds: [b.id],
    });
    const promised = plan.impact[0].after;
    await applyBatch(plan);

    const world = await readWorld();
    let actual = 0;
    for (const [, list] of world.declaredByScene) if (list.includes(marina.id)) actual += 1;
    expect(actual).toBe(promised);
  });

  it('ومَن تكلّم محسوبٌ في «كان» — نفس اتحاد الأطلس', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const igor = await addPerson({ name: 'إيجور' });
    await addConversationPart(a.id, { speaker: 'إيجور', text: 'X', personId: igor.id });

    const world = await readWorld();
    const impact = impactOf('participants', [igor.id], [b.id], world);
    expect(impact[0].before).toBe(1);
    expect(impact[0].after).toBe(2);
  });

  it('⚠️ والنوع يُعرَض بوسمه العربي لا بمعرّفه الخام', async () => {
    /*
     * الذكرى تحمل `phone` وتُعرَض «مكالمة». وظهورُ المعرّف في شاشةٍ
     * يعني أن يقرأ المستخدم اسمًا داخليًّا لا يعرفه.
     */
    await fresh();
    const s = await scene('ذكرى');
    const world = await readWorld();
    const impact = impactOf('type', 'phone', [s.id], world);
    expect(impact[0].label).toBe(typeLabel('phone'));
    expect(impact[0].label === 'phone').toBe(false);
  });

  it('بلا صفوفٍ مختارة لا أثرَ يُدّعى', async () => {
    await fresh();
    const world = await readWorld();
    expect(impactOf('place', 'المكتب', [], world)).toEqual([]);
  });
});

/* ================================================================== */

describe('التنفيذ والتراجع', () => {
  it('يكتب في كل الصفوف', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');

    const plan = await planBatch({
      aspectId: 'place', value: 'المكتب', sceneIds: [a.id, b.id],
    });
    const report = await applyBatch(plan);

    expect(report.ok).toBe(true);
    expect(report.counts.written).toBe(2);
    expect((await scenes.get(a.id)).placeName).toBe('المكتب');
    expect((await scenes.get(b.id)).placeName).toBe('المكتب');
  });

  it('⚠️ والتراجع يعيد ما كان بالضبط', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01', { placeName: 'العيادة' });
    const b = await scene('ب', '2026-04-02');

    const plan = await planBatch({
      aspectId: 'place', value: 'المكتب', sceneIds: [a.id, b.id],
    });
    const report = await applyBatch(plan);
    await report.undo();

    // الأولى كانت «العيادة» فترجع لها، والثانية كانت فارغة فترجع فارغة.
    expect((await scenes.get(a.id)).placeName).toBe('العيادة');
    expect((await scenes.get(b.id)).placeName).toBe('');
  });

  it('النوع يُكتب بحقليه معًا ويرجع بهما معًا', async () => {
    await fresh();
    const s = await createScene({ titleAr: 'ذكرى', date: '2026-04-01', type: 'other' });

    const plan = await planBatch({ aspectId: 'type', value: 'phone', sceneIds: [s.id] });
    const report = await applyBatch(plan);

    let row = await scenes.get(s.id);
    expect(row.type).toBe('phone');
    // ⚠️ الحقلان لا ينفصلان — وإلّا رأى قارئان من جيلين نوعين مختلفين.
    expect(row.eventTypeId).toBe('phone');

    await report.undo();
    row = await scenes.get(s.id);
    expect(row.type).toBe('other');
    expect(row.eventTypeId).toBe('other');
  });

  it('المشاركون يُضافون ويُرفَعون بالتراجع', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const marina = await addPerson({ name: 'مارينا' });

    const plan = await planBatch({
      aspectId: 'participants', value: [marina.id], sceneIds: [s.id],
    });
    const report = await applyBatch(plan);
    expect(await participantIds(s.id)).toEqual([marina.id]);

    await report.undo();
    expect(await participantIds(s.id)).toEqual([]);
  });

  it('⚠️ والتراجع لا يمحو عضويّةً كانت قبل الدفعة', async () => {
    /*
     * أخطرُ ما يمكن أن تفعله أداةٌ جماعيّة: أن تمحو بتراجعها شيئًا لم
     * تكتبه. إيجور كان مُعلَنًا قبل الدفعة، والدفعة أضافت مارينا —
     * فالتراجع يرفع مارينا وحدها.
     */
    await fresh();
    const s = await scene('اجتماع');
    const igor = await addPerson({ name: 'إيجور' });
    const marina = await addPerson({ name: 'مارينا' });
    await addParticipant(s.id, igor.id);

    const plan = await planBatch({
      aspectId: 'participants', value: [igor.id, marina.id], sceneIds: [s.id],
    });
    const report = await applyBatch(plan);
    expect((await participantIds(s.id)).length).toBe(2);

    await report.undo();
    expect(await participantIds(s.id)).toEqual([igor.id]);
  });

  it('⚠️ وكذلك الخيط — عضويّةٌ سابقة لا تُمحى بتراجعنا', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const thread = await createThread({ title: 'شحنة مايو' });
    await addSceneToThread(thread.id, a.id);

    const plan = await planBatch({
      aspectId: 'thread', value: thread.id, sceneIds: [b.id],
    });
    const report = await applyBatch(plan);
    expect((await threadsOfScene(b.id)).length).toBe(1);

    await report.undo();
    expect((await threadsOfScene(b.id)).length).toBe(0);
    // الأولى كانت في الخيط قبل الدفعة — وتبقى.
    expect((await threadsOfScene(a.id)).length).toBe(1);
  });

  it('⚠️ فشلُ صفٍّ لا يُسقط الدفعة — خلافًا للاستيراد وبسبب', async () => {
    await fresh();
    const good = await scene('باقية', '2026-04-01');
    const doomed = await scene('هتتحذف', '2026-04-02');

    const plan = await planBatch({
      aspectId: 'place', value: 'المكتب', sceneIds: [good.id, doomed.id],
    });
    // تُحذف **بعد** الخطّة وقبل التنفيذ — وهو ما يحدث فعلًا حين تراجع طويلًا.
    await scenes.destroy(doomed.id);

    const report = await applyBatch(plan);
    expect(report.ok).toBe(false);
    expect(report.counts.written).toBe(1);
    expect(report.counts.failed).toBe(1);
    // والصفّ السليم كُتب ولم يُمحَ لأجل جاره.
    expect((await scenes.get(good.id)).placeName).toBe('المكتب');
  });

  it('ولكل فشلٍ سببٌ مكتوب', async () => {
    await fresh();
    const doomed = await scene('هتتحذف');
    const plan = await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: [doomed.id] });
    await scenes.destroy(doomed.id);

    const report = await applyBatch(plan);
    expect(report.failed[0].reason.length > 0).toBe(true);
  });

  it('الصفّ الذي لا يتغيّر يُتخطّى ولا يُعَدّ مكتوبًا', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01', { placeName: 'المكتب' });
    const plan = await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: [s.id] });
    const report = await applyBatch(plan);

    expect(report.counts.written).toBe(0);
    expect(report.counts.skipped).toBe(1);
    expect(report.undoable).toBe(false);
  });

  it('التقرير يُبنى ممّا كُتب فعلًا لا ممّا نُوِيَ', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02', { placeName: 'المكتب' });

    const plan = await planBatch({
      aspectId: 'place', value: 'المكتب', sceneIds: [a.id, b.id],
    });
    const report = await applyBatch(plan);

    expect(report.counts.written).toBe(1);
    expect(report.written[0].id).toBe(a.id);
  });

  it('دفعةٌ على لا شيء لا ترمي', async () => {
    await fresh();
    const plan = await planBatch({ aspectId: 'place', value: 'المكتب', sceneIds: [] });
    const report = await applyBatch(plan);
    expect(report.counts.written).toBe(0);
    expect(report.ok).toBe(true);
  });

  it('الإضافة المكرّرة لا تُنشئ صفَّين', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const marina = await addPerson({ name: 'مارينا' });

    await applyBatch(await planBatch({
      aspectId: 'participants', value: [marina.id], sceneIds: [s.id],
    }));
    await applyBatch(await planBatch({
      aspectId: 'participants', value: [marina.id], sceneIds: [s.id],
    }));

    expect((await participantIds(s.id)).length).toBe(1);
  });

  /*
   * ⚠️ الحارسان التاليان يمسّان `applyAspect` مباشرةً لا عبر الخطّة.
   *
   *    والسبب مقيس لا مفترَض: كسرتُ حارسَ العضويّة السابقة في
   *    الوجهين معًا، فسقط اختبار المشاركين **ولم يسقط اختبار الخيط** —
   *    لأن الخطّة كانت تحمي الخيط بمصادفةٍ (`changes: false`) لا
   *    باختبار. وحمايةٌ بمصادفة تسقط أوّلَ مرّةٍ يتغيّر فيها بناء
   *    الخطّة، وقتها يمحو تراجعٌ عضويّةً ليست لنا.
   */
  it('⚠️ الوجه نفسه لا يقيّد عضويّةً موجودة — مشاركٌ مُعلَنٌ سلفًا', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const igor = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, igor.id);

    const world = await readWorld();
    const steps = [];
    const book = { undo: (fn) => steps.push(fn) };
    const touched = await applyAspect(aspectById('participants'), s, [igor.id], world, book);

    expect(touched).toBe(false);
    // لا قيدَ في الدفتر — فلا شيء يُمحى عند التراجع.
    expect(steps.length).toBe(0);
  });

  it('⚠️ وكذلك الخيط — ذكرى هي فيه سلفًا لا تُقيَّد', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const thread = await createThread({ title: 'شحنة مايو' });
    await addSceneToThread(thread.id, s.id);

    const world = await readWorld();
    const steps = [];
    const book = { undo: (fn) => steps.push(fn) };
    const touched = await applyAspect(aspectById('thread'), s, thread.id, world, book);

    expect(touched).toBe(false);
    expect(steps.length).toBe(0);
    // وتبقى العضويّة كما هي.
    expect((await threadsOfScene(s.id)).length).toBe(1);
  });

  it('وأوجه الإحلال والإضافة مُعلَنةٌ بوضوح', () => {
    expect(aspectById('place').fill).toBe(FILL.SET);
    expect(aspectById('type').fill).toBe(FILL.SET);
    expect(aspectById('participants').fill).toBe(FILL.ADD);
    expect(aspectById('thread').fill).toBe(FILL.ADD);
  });
});

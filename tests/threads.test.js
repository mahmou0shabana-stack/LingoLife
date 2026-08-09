/**
 * LingoLife — اختبارات خيوط الأحداث
 *
 * ثلاث قواعد بنيويّة تُحرَس هنا:
 *
 *  1. **الخيط قضيّة تُفتَح وتُغلَق** لا موضوعٌ دائم — ولذلك له حالة،
 *     و«إيه اللي لسه مفتوح؟» سؤالٌ له جواب.
 *  2. **العضويّة علاقةٌ لا حقل** (بند 27): المشهد لا يحمل `threadId`،
 *     فخيطٌ يُحذف لا يترك أثرًا في ذكرياتك.
 *  3. **الاقتراحات بأدلّة معلَنة** (بند 31): لا اقتراح بلا سببٍ مكتوب.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { eventThreads, relationships, scenes, conversationParts, people } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { createScene } from '../js/services/scene-service.js';
import { addConversationPart } from '../js/services/content-service.js';
import { addPerson, assignSpeaker } from '../js/services/person-service.js';
import {
  THREAD_STATUS,
  SCENE_RELATIONS,
  createThread,
  updateThread,
  archiveThread,
  listThreads,
  getThread,
  openThreads,
  addSceneToThread,
  removeSceneFromThread,
  threadScenes,
  threadsOfScene,
  relateScenes,
  sceneRelations,
  suggestThreadsFor,
  threadFromScenes,
  threadSummary,
  threadSceneCounts,
} from '../js/services/thread-service.js';

async function fresh() {
  await openDB();
  for (const row of await eventThreads.getAll()) await eventThreads.destroy(row.id);
  for (const row of await relationships.getAll()) await relationships.destroy(row.id);
  for (const row of await scenes.getAll()) await scenes.destroy(row.id);
  for (const row of await conversationParts.getAll()) await conversationParts.destroy(row.id);
  for (const row of await people.getAll()) await people.destroy(row.id);
}

const scene = (titleAr, date) => createScene({ titleAr, type: 'meeting', date });

describe('الخيوط — الأساس', () => {
  it('تُنشئ خيطًا نشطًا افتراضيًّا', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    expect(thread.status).toBe(THREAD_STATUS.ACTIVE);
    expect(thread.isOpen).toBe(true);
    expect(thread.endDate).toBe(null);
  });

  it('ترفض خيطًا بلا عنوان', async () => {
    await fresh();
    let error = null;
    try { await createThread({ title: '   ' }); } catch (err) { error = err; }
    expect(error !== null).toBe(true);
  });

  it('«خلص» تختم التاريخ تلقائيًّا', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const done = await updateThread(thread.id, { status: THREAD_STATUS.RESOLVED });
    expect(done.isOpen).toBe(false);
    expect(typeof done.endDate).toBe('string');
  });

  /*
   * ⚠️ قضيّةٌ مفتوحة تحمل تاريخ انتهاء تناقضٌ يظهر في كل شاشة تعرضها.
   */
  it('«اتفتح تاني» تمسح الختم', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    await updateThread(thread.id, { status: THREAD_STATUS.RESOLVED });
    const again = await updateThread(thread.id, { status: THREAD_STATUS.REOPENED });
    expect(again.endDate).toBe(null);
    expect(again.isOpen).toBe(true);
  });

  it('«إيه اللي لسه مفتوح؟» يستثني المحلول والموقوف', async () => {
    await fresh();
    const a = await createThread({ title: 'نشط' });
    const b = await createThread({ title: 'مستنّي' });
    const c = await createThread({ title: 'خلص' });
    const d = await createThread({ title: 'موقوف' });
    await updateThread(b.id, { status: THREAD_STATUS.WAITING });
    await updateThread(c.id, { status: THREAD_STATUS.RESOLVED });
    await updateThread(d.id, { status: THREAD_STATUS.PAUSED });

    const open = (await openThreads()).map((t) => t.title).sort();
    expect(open).toEqual(['مستنّي', 'نشط']);
    expect(open.includes(a.title)).toBe(true);
  });

  it('الأرشفة تُخفيه ولا تحذفه', async () => {
    await fresh();
    const thread = await createThread({ title: 'قديم' });
    await archiveThread(thread.id, true);
    expect((await listThreads()).length).toBe(0);
    expect((await listThreads({ includeArchived: true })).length).toBe(1);
  });
});

describe('الخيوط — العضويّة علاقةٌ لا حقل', () => {
  it('تضمّ مشاهد وتقرأها بترتيبها الزمني', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const late = await scene('الفحص', '2026-04-20');
    const early = await scene('الاجتماع', '2026-04-01');
    await addSceneToThread(thread.id, late.id);
    await addSceneToThread(thread.id, early.id);

    // القصّة كما جرت لا كما أُضيفت.
    expect((await threadScenes(thread.id)).map((s) => s.titleAr)).toEqual(['الاجتماع', 'الفحص']);
  });

  /*
   * ⚠️ **جوهر بند 27.** لو كانت العضويّة حقلًا في المشهد لكان حذف
   *    الخيط يترك `threadId` معلّقًا يشير إلى لا شيء.
   */
  it('المشهد لا يحمل أي أثر للخيط', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const s = await scene('الاجتماع', '2026-04-01');
    await addSceneToThread(thread.id, s.id);

    const stored = await scenes.get(s.id);
    expect(stored.threadId).toBe(undefined);
    expect(stored.threadIds).toBe(undefined);
  });

  it('وحذف الخيط لا يمسّ المشهد', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const s = await scene('الاجتماع', '2026-04-01');
    await addSceneToThread(thread.id, s.id);

    await eventThreads.destroy(thread.id);
    const stored = await scenes.get(s.id);
    expect(stored.titleAr).toBe('الاجتماع');
    expect(stored.state).toBe(STATE.ACTIVE);
  });

  it('المشهد يعرف خيوطه، والمشهد الواحد يكون في أكثر من خيط', async () => {
    await fresh();
    const a = await createThread({ title: 'خيط أ' });
    const b = await createThread({ title: 'خيط ب' });
    const s = await scene('الاجتماع', '2026-04-01');
    await addSceneToThread(a.id, s.id);
    await addSceneToThread(b.id, s.id);

    expect((await threadsOfScene(s.id)).map((t) => t.title).sort()).toEqual(['خيط أ', 'خيط ب']);
  });

  it('الإزالة تفكّ العضويّة وحدها', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const s = await scene('الاجتماع', '2026-04-01');
    await addSceneToThread(thread.id, s.id);
    expect(await removeSceneFromThread(thread.id, s.id)).toBe(true);

    expect((await threadScenes(thread.id)).length).toBe(0);
    expect((await scenes.get(s.id)).state).toBe(STATE.ACTIVE);
  });

  it('البداية تُحسَب من أقدم مشاهده لا تُكتب', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    await addSceneToThread(thread.id, (await scene('الفحص', '2026-04-20')).id);
    expect((await getThread(thread.id)).startDate).toBe('2026-04-20');

    await addSceneToThread(thread.id, (await scene('الاجتماع', '2026-04-01')).id);
    expect((await getThread(thread.id)).startDate).toBe('2026-04-01');
  });

  it('الإنشاء بأثر رجعي من مشاهد مختارة', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-05');
    const thread = await threadFromScenes('قصّة اكتشفتها متأخّرًا', [a.id, b.id]);
    expect((await threadScenes(thread.id)).length).toBe(2);
    expect(thread.startDate).toBe('2026-04-01');
  });

  it('العدّ لكل خيط في مسحة واحدة', async () => {
    await fresh();
    const a = await createThread({ title: 'أ' });
    const b = await createThread({ title: 'ب' });
    await addSceneToThread(a.id, (await scene('١', '2026-04-01')).id);
    await addSceneToThread(a.id, (await scene('٢', '2026-04-02')).id);
    await addSceneToThread(b.id, (await scene('٣', '2026-04-03')).id);

    const counts = await threadSceneCounts();
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBe(1);
  });
});

describe('الخيوط — العلاقات المُصنَّفة', () => {
  it('العلاقة تُقرأ بمعناها من كل طرف', async () => {
    await fresh();
    const cause = await scene('الاجتماع', '2026-04-01');
    const effect = await scene('القرار', '2026-04-10');
    await relateScenes(effect.id, cause.id, 'result_of');

    const fromEffect = (await sceneRelations(effect.id))[0];
    const fromCause = (await sceneRelations(cause.id))[0];

    // ⚠️ نفس الصفّ، ونصّان مختلفان: عرضه بنفس العبارة من الطرفين
    //    يقلب المعنى.
    expect(fromEffect.label).toBe('نتيجة لـ');
    expect(fromCause.label).toBe('أدّى لـ');
    expect(fromEffect.outgoing).toBe(true);
    expect(fromCause.outgoing).toBe(false);
  });

  it('ترفض تصنيفًا غير معروف — لا «مرتبط» عامّة', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    let error = null;
    try { await relateScenes(a.id, b.id, 'related'); } catch (err) { error = err; }
    expect(error !== null).toBe(true);
  });

  it('لكل تصنيف نصّه ونصّه المعكوس', () => {
    for (const [kind, spec] of Object.entries(SCENE_RELATIONS)) {
      if (!spec.label || !spec.inverse) throw new Error(`${kind} ناقص نصًّا`);
    }
  });

  it('المشهد المحذوف لا يظهر كعلاقة حيّة', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    await relateScenes(a.id, b.id, 'follow_up_to');
    await scenes.trash(b.id);
    expect((await sceneRelations(a.id)).length).toBe(0);
  });
});

describe('الخيوط — الاقتراحات بأدلّة معلَنة', () => {
  /** مشهدٌ فيه جزء محادثة منسوب لشخص. */
  async function sceneWith(person, titleAr, date) {
    const s = await scene(titleAr, date);
    const part = await addConversationPart(s.id, { speaker: person.name, text: 'Привет.' });
    await assignSpeaker(part.id, person.id);
    return s;
  }

  it('كل اقتراح يحمل سببه بالنصّ', async () => {
    await fresh();
    const alexey = await addPerson({ name: 'أليكسي' });
    const thread = await createThread({ title: 'شحنة أبريل' });
    await addSceneToThread(thread.id, (await sceneWith(alexey, 'الاجتماع', '2026-04-01')).id);
    const candidate = await sceneWith(alexey, 'المتابعة', '2026-04-03');

    const suggestions = await suggestThreadsFor(candidate.id);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].thread.id).toBe(thread.id);
    // ⚠️ اقتراحٌ بلا سببٍ معروض تخمينٌ يطلب ثقةً لم يكسبها.
    expect(suggestions[0].reasons.length >= 2).toBe(true);
    expect(suggestions[0].reasons.some((r) => r.includes('نفس الشخص'))).toBe(true);
  });

  it('دليلٌ ضعيف وحده لا يكفي', async () => {
    await fresh();
    const thread = await createThread({ title: 'خيط بعيد' });
    await addSceneToThread(thread.id, (await scene('قديم', '2020-01-01')).id);
    // نفس النوع فقط، وفرقٌ ستّ سنين.
    const candidate = await scene('جديد', '2026-04-01');
    expect((await suggestThreadsFor(candidate.id)).length).toBe(0);
  });

  it('لا يقترح خيطًا هو فيه أصلًا', async () => {
    await fresh();
    const alexey = await addPerson({ name: 'أليكسي' });
    const thread = await createThread({ title: 'شحنة أبريل' });
    await addSceneToThread(thread.id, (await sceneWith(alexey, 'الاجتماع', '2026-04-01')).id);
    const candidate = await sceneWith(alexey, 'المتابعة', '2026-04-03');
    await addSceneToThread(thread.id, candidate.id);

    expect((await suggestThreadsFor(candidate.id)).length).toBe(0);
  });

  it('الاقتراح لا يربط شيئًا', async () => {
    await fresh();
    const alexey = await addPerson({ name: 'أليكسي' });
    const thread = await createThread({ title: 'شحنة أبريل' });
    await addSceneToThread(thread.id, (await sceneWith(alexey, 'الاجتماع', '2026-04-01')).id);
    const candidate = await sceneWith(alexey, 'المتابعة', '2026-04-03');

    await suggestThreadsFor(candidate.id);
    expect((await threadsOfScene(candidate.id)).length).toBe(0);
  });
});

describe('الخيوط — الملخّص', () => {
  it('يعيد المعرّفات لا الأعداد — كل رقم قابل للنقر', async () => {
    await fresh();
    const alexey = await addPerson({ name: 'أليكسي' });
    const thread = await createThread({ title: 'شحنة أبريل' });

    const a = await scene('الاجتماع', '2026-04-01');
    a.placeName = 'المكتب';
    await scenes.update(a.id, { placeName: 'المكتب' });
    const part = await addConversationPart(a.id, { speaker: 'أليكسي', text: 'Привет.' });
    await assignSpeaker(part.id, alexey.id);

    const b = await scene('الفحص', '2026-04-11');
    await addSceneToThread(thread.id, a.id);
    await addSceneToThread(thread.id, b.id);

    const summary = await threadSummary(thread.id);
    expect(summary.sceneIds.length).toBe(2);
    expect(summary.personIds).toEqual([alexey.id]);
    expect(summary.places).toEqual(['المكتب']);
    expect(summary.from).toBe('2026-04-01');
    expect(summary.to).toBe('2026-04-11');
    expect(summary.spanDays).toBe(10);
  });

  it('خيطٌ فارغ يعطي ملخّصًا فارغًا لا خطأ', async () => {
    await fresh();
    const thread = await createThread({ title: 'لسه فاضي' });
    const summary = await threadSummary(thread.id);
    expect(summary.scenes.length).toBe(0);
    expect(summary.spanDays).toBe(0);
  });

  it('خيطٌ غير موجود يعيد null', async () => {
    await fresh();
    expect(await threadSummary('THR_مش_موجود')).toBe(null);
  });
});

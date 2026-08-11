/**
 * LingoLife — اختبارات الأطلس
 *
 * أربع قواعد تُحرَس:
 *
 *  1. **لا عالمَ ثانيًا** — المحاور تُشتقّ من `scenes` والعلاقات
 *     وأجزاء المحادثة كما هي. لا مستودعَ للأطلس، ولا حقلَ يُملأ له.
 *  2. **الفجوة معلومة** — المسافة بين يومين تُحسَب صحيحةً، وهي ما
 *     يجعل النهر نهرًا لا قائمة.
 *  3. **الصفحة لا تُسقط أحدًا** — يومٌ أكبر من دفعة القراءة لا تختفي
 *     نصف ذكرياته بصمت.
 *  4. **الشخص مُشتقٌّ من دليلين** — مَن تكلّم يظهر بكلامه، ومَن أُعلن
 *     حضورُه يظهر بإعلانه. كان الحدّ أن الصامت يختفي، ورفعه WS9.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventThreads, eventTypes, relationships, conversationParts,
  expressions, expressionOccurrences, mistakeComparisons, scripts, settings,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { addPerson } from '../js/services/person-service.js';
import { resetTypes } from '../js/services/type-service.js';
import { createThread, addSceneToThread, THREAD_STATUS } from '../js/services/thread-service.js';
import { addConversationPart, addExpression } from '../js/services/content-service.js';
import { addParticipant } from '../js/services/participant-service.js';
import {
  AXIS, ABSENT_AXES, placeKey, facetsFor, allowedSceneIds,
  riverPage, dayDetail, adjacentDays, facetTree, continuingStories,
  pivotsFor, listLenses, saveLens, removeLens, constellation,
} from '../js/services/atlas-service.js';

async function fresh() {
  await openDB();
  for (const repo of [
    scenes, people, eventThreads, relationships, conversationParts,
    expressions, expressionOccurrences, mistakeComparisons, scripts,
  ]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

const scene = (titleAr, date, extra = {}) =>
  createScene({ titleAr, date, type: 'meeting', ...extra });

/* ================================================================== */

describe('الأطلس — اشتقاق المحاور', () => {
  it('النوع والمكان من الذكرى نفسها', async () => {
    await fresh();
    const s = await scene('اجتماع', '2026-04-01', { type: 'phone', placeName: 'المكتب' });
    const facets = await facetsFor([s]);
    expect(facets.get(s.id).typeId).toBe('phone');
    expect(facets.get(s.id).placeName).toBe('المكتب');
  });

  it('المكان يتجمّع بالنصّ المطبَّع — إملاءان مكانٌ واحد', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01', { placeName: 'مكتب الشركة' });
    const b = await scene('ب', '2026-04-02', { placeName: 'مكتب الشركه' });
    const facets = await facetsFor([a, b]);
    expect(facets.get(a.id).placeKey).toBe(facets.get(b.id).placeKey);
    // ⚠️ والاسم المعروض يبقى كما كتبتَه — التطبيع للمطابقة لا للعرض.
    expect(facets.get(a.id).placeName).toBe('مكتب الشركة');
  });

  it('⚠️ الشخص يُشتقّ من المحادثة لا من حقلٍ على الذكرى', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const s = await scene('اجتماع', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });

    const facets = await facetsFor([s]);
    expect(facets.get(s.id).personIds).toEqual([igor.id]);
    /*
     * ⚠️ والحقل الميّت لم يعد يُكتب أصلًا (WS9). كان يُكتب فارغًا
     *    ولا يُقرَأ، فصار لا يُكتب — والصفوف القديمة تحتفظ به كما هي،
     *    كما فُعل بـ`relationships.type` في v8.
     */
    const row = await scenes.get(s.id);
    expect(row.peopleIds).toBe(undefined);
  });

  it('⚠️ مَن حضر ولم يتكلّم يظهر — الحدّ الذي رفعه WS9', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const marina = await addPerson({ name: 'مارينا' });
    const s = await scene('اجتماع', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });
    // مارينا كانت هناك ولم تتكلّم — وأُعلن حضورها.
    await addParticipant(s.id, marina.id);

    const facets = await facetsFor([s]);
    expect(facets.get(s.id).personIds.sort()).toEqual([igor.id, marina.id].sort());
  });

  it('ومَن لا كلامَ له ولا إعلان لا يظهر — الاشتقاق ليس قائمةَ كلّ الناس', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    await addPerson({ name: 'غريب' });          // لا كلام ولا إعلان
    const s = await scene('اجتماع', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });

    const facets = await facetsFor([s]);
    expect(facets.get(s.id).personIds).toEqual([igor.id]);
  });

  it('المتحدّث بلا شخصٍ مربوط لا يُنتج معرّفًا فارغًا', async () => {
    await fresh();
    const s = await scene('اجتماع', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'مجهول', text: 'Привет' });
    const facets = await facetsFor([s]);
    expect(facets.get(s.id).personIds).toEqual([]);
  });

  it('الخيط من العلاقة لا من حقل', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const s = await scene('اجتماع', '2026-04-01');
    await addSceneToThread(thread.id, s.id);

    const facets = await facetsFor([s]);
    expect(facets.get(s.id).threadIds).toEqual([thread.id]);
  });

  it('الشخص المكرّر في جُملٍ كتيرة يُحسَب مرّة', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const s = await scene('اجتماع', '2026-04-01');
    for (const text of ['А', 'Б', 'В']) {
      await addConversationPart(s.id, { speaker: 'إيجور', text, personId: igor.id });
    }
    const facets = await facetsFor([s]);
    expect(facets.get(s.id).personIds.length).toBe(1);
  });
});

describe('الأطلس — المرشّحات', () => {
  it('بلا مرشّح تعود `null` لا مجموعة فارغة', async () => {
    await fresh();
    // ⚠️ الفرق ليس شكليًّا: الفارغة تعني «لا شيء يطابق»، و`null` تعني
    //    «بلا تقييد». خلطهما يُفرّغ النهر كلّه.
    expect(await allowedSceneIds({})).toBe(null);
  });

  it('مرشّح الشخص يعطي مشاهده وحدها', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const withIgor = await scene('معه', '2026-04-01');
    await scene('بدونه', '2026-04-02');
    await addConversationPart(withIgor.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });

    const allowed = await allowedSceneIds({ [AXIS.PERSON]: igor.id });
    expect([...allowed]).toEqual([withIgor.id]);
  });

  it('مرشّحان معًا يعنيان الاثنين لا أحدهما', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const thread = await createThread({ title: 'خيط' });

    const both = await scene('الاتنين', '2026-04-01');
    const onlyPerson = await scene('شخص بس', '2026-04-02');
    const onlyThread = await scene('خيط بس', '2026-04-03');

    await addConversationPart(both.id, { speaker: 'إيجور', text: 'А', personId: igor.id });
    await addConversationPart(onlyPerson.id, { speaker: 'إيجور', text: 'Б', personId: igor.id });
    await addSceneToThread(thread.id, both.id);
    await addSceneToThread(thread.id, onlyThread.id);

    const allowed = await allowedSceneIds({
      [AXIS.PERSON]: igor.id,
      [AXIS.THREAD]: thread.id,
    });
    expect([...allowed]).toEqual([both.id]);
  });

  it('النهر يحترم مرشّح النوع', async () => {
    await fresh();
    await scene('مكالمة', '2026-04-01', { type: 'phone' });
    await scene('اجتماع', '2026-04-02', { type: 'meeting' });

    const page = await riverPage({ filters: { [AXIS.TYPE]: 'phone' } });
    expect(page.days.length).toBe(1);
    expect(page.days[0].scenes[0].titleAr).toBe('مكالمة');
    expect(page.filtered).toBe(true);
  });

  it('النهر يحترم مرشّح المكان بالنصّ المطبَّع', async () => {
    await fresh();
    await scene('أ', '2026-04-01', { placeName: 'مكتب الشركة' });
    await scene('ب', '2026-04-02', { placeName: 'مكتب الشركه' });
    await scene('ج', '2026-04-03', { placeName: 'البيت' });

    const page = await riverPage({ filters: { [AXIS.PLACE]: placeKey('مكتب الشركة') } });
    expect(page.days.length).toBe(2);
  });
});

describe('الأطلس — النهر', () => {
  it('يجمّع باليوم لا بالذكرى', async () => {
    await fresh();
    await scene('الأولى', '2026-04-01');
    await scene('التانية', '2026-04-01');
    await scene('التالتة', '2026-04-02');

    const page = await riverPage();
    expect(page.days.length).toBe(2);
    expect(page.days[0].date).toBe('2026-04-02');
    expect(page.days[1].scenes.length).toBe(2);
  });

  it('من الأحدث للأقدم', async () => {
    await fresh();
    await scene('قديمة', '2025-01-01');
    await scene('جديدة', '2026-04-01');
    const page = await riverPage();
    expect(page.days[0].date).toBe('2026-04-01');
  });

  it('⚠️ الفجوة تُحسَب بين اليومين — وهي المعنى كلّه', async () => {
    await fresh();
    await scene('أ', '2026-04-01');
    await scene('ب', '2026-03-01');

    const page = await riverPage();
    expect(page.days[0].gapDays).toBe(31);
    // أقدم يومٍ لا فجوة بعده — لا صفر يوهم بأن قبله شيئًا.
    expect(page.days[1].gapDays).toBe(null);
  });

  it('فجوة اليوم الأخير تُحسَب ولو كان ما بعده خارج الصفحة', async () => {
    await fresh();
    await scene('أ', '2026-04-03');
    await scene('ب', '2026-04-02');
    await scene('ج', '2026-03-01');

    const page = await riverPage({ limit: 2 });
    expect(page.days.length).toBe(2);
    expect(page.hasMore).toBe(true);
    // اليوم الثاني آخرُ المعروض، وفجوته إلى يومٍ لم يُعرَض.
    expect(page.days[1].gapDays).toBe(32);
  });

  it('التحميل التدريجي يكمل من حيث وقف بلا تكرار', async () => {
    await fresh();
    for (const day of ['01', '02', '03', '04', '05']) await scene(`يوم ${day}`, `2026-04-${day}`);

    const first = await riverPage({ limit: 2 });
    const second = await riverPage({ limit: 2, before: first.cursor });

    const dates = [...first.days, ...second.days].map((d) => d.date);
    expect(dates).toEqual(['2026-04-05', '2026-04-04', '2026-04-03', '2026-04-02']);
    expect(new Set(dates).size).toBe(4);
  });

  it('⚠️ يومٌ أكبر من دفعة القراءة لا تختفي نصف ذكرياته', async () => {
    await fresh();
    /*
     * `page` تقيس حدّها على ما بعد الترشيح، فدفعةٌ ممتلئة قد تنقطع في
     * منتصف يوم. ٧٥ ذكرى في يومٍ واحد تتجاوز دفعة الستّين — ولو
     * تجاوزنا اليوم بعدها لاختفت خمس عشرة ذكرى بصمت.
     */
    for (let i = 0; i < 75; i++) await scene(`موقف ${i}`, '2026-04-01');
    await scene('اليوم اللي قبله', '2026-03-31');

    const page = await riverPage();
    expect(page.days[0].scenes.length).toBe(75);
    expect(page.days[1].date).toBe('2026-03-31');
  });

  it('المؤرشَف والمحذوف خارج النهر', async () => {
    await fresh();
    const shown = await scene('ظاهرة', '2026-04-01');
    const hidden = await scene('محذوفة', '2026-04-02');
    await scenes.trash(hidden.id);

    const page = await riverPage();
    expect(page.days.length).toBe(1);
    expect(page.days[0].scenes[0].id).toBe(shown.id);
  });

  it('قاعدةٌ فارغة تعطي نهرًا فارغًا لا خطأ', async () => {
    await fresh();
    const page = await riverPage();
    expect(page.days).toEqual([]);
    expect(page.hasMore).toBe(false);
  });
});

describe('الأطلس — اليوم', () => {
  it('يجمع كل ما جرى في اليوم', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const thread = await createThread({ title: 'شحنة' });
    const a = await scene('الأولى', '2026-04-01');
    const b = await scene('التانية', '2026-04-01');
    await addSceneToThread(thread.id, a.id);
    await addConversationPart(a.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });
    await addConversationPart(b.id, { isMine: true, text: 'Здравствуйте' });
    await addExpression(a.id, { text: 'по итогам' });

    const day = await dayDetail('2026-04-01');
    expect(day.scenes.length).toBe(2);
    expect(day.people.length).toBe(1);
    expect(day.threadIds).toEqual([thread.id]);
    expect(day.conversationParts).toBe(2);
    expect(day.expressions.length).toBe(1);
  });

  it('يومٌ بلا ذكريات يعود فارغًا ولا يُملأ بأقرب يوم', async () => {
    await fresh();
    await scene('في يومٍ تاني', '2026-04-01');
    const day = await dayDetail('2026-04-05');
    expect(day.scenes.length).toBe(0);
    expect(day.people.length).toBe(0);
  });

  it('تاريخٌ لا يُفهَم يعود `null` لا اليوم', async () => {
    await fresh();
    // ⚠️ الرجوع بتاريخ النهارده عند تاريخٍ تالف يعرض يومًا ليس المطلوب
    //    ويبدو صحيحًا — وهو أسوأ من لا شيء.
    expect(await dayDetail('كلام فاضي')).toBe(null);
  });

  it('السهمان يقفزان لأقرب يومٍ فيه شيء لا لليوم التقويمي', async () => {
    await fresh();
    await scene('أ', '2026-01-01');
    await scene('ب', '2026-04-01');
    await scene('ج', '2026-08-01');

    const around = await adjacentDays('2026-04-01');
    expect(around.older).toBe('2026-01-01');
    expect(around.newer).toBe('2026-08-01');
  });

  it('أوّل يومٍ بلا أقدم، وآخرُه بلا أحدث', async () => {
    await fresh();
    await scene('واحدة', '2026-04-01');
    const around = await adjacentDays('2026-04-01');
    expect(around.older).toBe(null);
    expect(around.newer).toBe(null);
  });
});

describe('الأطلس — ما لا محورَ له', () => {
  /*
   * ⚠️ نفس حارس الاستيراد: القائمة إقرارٌ صريح لا نسيان. ومحورٌ يُبنى
   *    على مستودعٍ لا يكتبه أحد يعرض صفرًا دائمًا — ومرشّحٌ لا يرشّح
   *    شيئًا أسوأ من مرشّحٍ غير موجود.
   */
  it('لكل محورٍ غائب سببٌ مفهوم لا كلمة واحدة', () => {
    for (const [axis, reason] of Object.entries(ABSENT_AXES)) {
      if (!reason || reason.length < 12) throw new Error(`${axis} غائبٌ بسببٍ غامض`);
    }
  });

  it('المشروع غائبٌ بوصفه قرارًا مؤجَّلًا لا نقصًا', () => {
    expect(ABSENT_AXES.project.includes('مؤجَّل')).toBe(true);
  });

  it('المحاور الموجودة كلها لها اشتقاقٌ حقيقي', async () => {
    await fresh();
    const s = await scene('واحدة', '2026-04-01', { placeName: 'المكتب' });
    const facets = (await facetsFor([s])).get(s.id);
    for (const axis of Object.values(AXIS)) {
      const key = axis === AXIS.PERSON ? 'personIds' : axis === AXIS.THREAD ? 'threadIds' : axis;
      if (!(key in facets)) throw new Error(`المحور ${axis} بلا اشتقاق`);
    }
  });
});

describe('الأطلس — أشجار المحاور', () => {
  it('تُبنى ممّا في الذكريات لا ممّا في جداول التعريف', async () => {
    await fresh();
    // ١٤ نوعًا مُعرَّفًا، واحدٌ مستعمَل.
    await scene('واحدة', '2026-04-01', { type: 'phone' });
    const tree = await facetTree();

    expect(tree.types.length).toBe(1);
    expect(tree.types[0].id).toBe('phone');
    // ⚠️ نوعٌ عرّفتَه ولم تستعمله ليس محورَ تصفّح: الضغط عليه يُفرّغ
    //    النهر، والرقم صفرٌ لا يَعِد بشيء.
    expect((await eventTypes.getAll()).length > 1).toBe(true);
  });

  it('تعدّ الذكريات لا الجُمل', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const s = await scene('واحدة', '2026-04-01');
    for (const text of ['А', 'Б', 'В']) {
      await addConversationPart(s.id, { speaker: 'إيجور', text, personId: igor.id });
    }
    const tree = await facetTree();
    expect(tree.people[0].count).toBe(1);
  });

  it('المكان يتجمّع بالمطبَّع ويُعرَض بأوّل إملاء', async () => {
    await fresh();
    await scene('أ', '2026-04-01', { placeName: 'مكتب الشركة' });
    await scene('ب', '2026-04-02', { placeName: 'مكتب الشركه' });
    const tree = await facetTree();
    expect(tree.places.length).toBe(1);
    expect(tree.places[0].count).toBe(2);
  });

  it('شخصٌ بلا ذكريات لا يظهر', async () => {
    await fresh();
    await addPerson({ name: 'حدّ ما اتكلّمش' });
    await scene('واحدة', '2026-04-01');
    const tree = await facetTree();
    expect(tree.people).toEqual([]);
  });

  it('خيطٌ فاضي لا يظهر', async () => {
    await fresh();
    await createThread({ title: 'خيط فاضي' });
    await scene('واحدة', '2026-04-01');
    const tree = await facetTree();
    expect(tree.threads).toEqual([]);
  });

  it('الذكرى المحذوفة تخرج من كل المحاور', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const thread = await createThread({ title: 'خيط' });
    const s = await scene('محذوفة', '2026-04-01', { placeName: 'المكتب' });
    await addSceneToThread(thread.id, s.id);
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'А', personId: igor.id });
    await scenes.trash(s.id);

    const tree = await facetTree();
    expect(tree.total).toBe(0);
    expect(tree.people).toEqual([]);
    expect(tree.threads).toEqual([]);
    expect(tree.places).toEqual([]);
  });

  it('الترتيب بالعدد تنازليًّا', async () => {
    await fresh();
    await scene('أ', '2026-04-01', { placeName: 'البيت' });
    await scene('ب', '2026-04-02', { placeName: 'البيت' });
    await scene('ج', '2026-04-03', { placeName: 'المكتب' });
    const tree = await facetTree();
    expect(tree.places[0].label).toBe('البيت');
    expect(tree.places[0].count).toBe(2);
  });
});

describe('الأطلس — القصص المكمّلة', () => {
  it('المفتوح وحده — والمُقفَل يخرج', async () => {
    await fresh();
    const open = await createThread({ title: 'مفتوح' });
    const done = await createThread({ title: 'مقفول', status: THREAD_STATUS.RESOLVED });
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    await addSceneToThread(open.id, a.id);
    await addSceneToThread(done.id, b.id);

    const stories = await continuingStories();
    expect(stories.length).toBe(1);
    expect(stories[0].id).toBe(open.id);
  });

  it('⚠️ الترتيب بطول السكوت لا بالتاريخ — وهو الفكرة كلّها', async () => {
    await fresh();
    const quiet = await createThread({ title: 'ساكتة من زمان' });
    const fresh_ = await createThread({ title: 'اتحرّكت قريّب' });
    const old = await scene('قديم', '2025-01-01');
    const recent = await scene('قريّب', '2026-06-01');
    await addSceneToThread(quiet.id, old.id);
    await addSceneToThread(fresh_.id, recent.id);

    const stories = await continuingStories();
    expect(stories[0].id).toBe(quiet.id);
    expect(stories[0].daysSince > stories[1].daysSince).toBe(true);
  });

  it('السكوت يُقاس من آخر حدثٍ لا من إنشاء الخيط', async () => {
    await fresh();
    const thread = await createThread({ title: 'خيط' });
    await addSceneToThread(thread.id, (await scene('قديم', '2020-01-01')).id);
    await addSceneToThread(thread.id, (await scene('أحدث', '2026-06-01')).id);

    const stories = await continuingStories();
    expect(stories[0].lastEvent).toBe('2026-06-01');
    expect(stories[0].count).toBe(2);
  });

  it('خيطٌ بلا أحداث: `null` لا صفر', async () => {
    await fresh();
    await createThread({ title: 'لسه فاضي' });
    const stories = await continuingStories();
    // ⚠️ صفرٌ يقول «اتحرّك النهارده» وهو لم يتحرّك قطّ.
    expect(stories[0].daysSince).toBe(null);
    expect(stories[0].count).toBe(0);
  });
});

describe('الأطلس — محور الذكرى', () => {
  it('لا يُعرَض محورٌ ما وراءه غير هذه الذكرى', async () => {
    await fresh();
    // ⚠️ «شوف باقي ذكرياتك في المكان ده» على ذكرى وحيدةٍ هناك وعدٌ
    //    كاذب: تضغطه فتجدها هي.
    await scene('وحيدة', '2026-04-01', { type: 'phone', placeName: 'مكان لوحده' });
    expect(await pivotsFor((await scenes.getAll())[0].id)).toEqual([]);
  });

  it('يُعرَض حين يكون وراءه غيرها — بعددٍ صادق', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01', { type: 'phone', placeName: 'المكتب' });
    await scene('ب', '2026-04-02', { type: 'phone', placeName: 'المكتب' });

    const pivots = await pivotsFor(a.id);
    const byAxis = Object.fromEntries(pivots.map((p) => [p.axis, p]));
    expect(byAxis[AXIS.TYPE].count).toBe(2);
    expect(byAxis[AXIS.PLACE].count).toBe(2);
    expect(byAxis[AXIS.PLACE].label).toBe('المكتب');
  });

  it('الشخص يظهر محورًا لو قابلته أكتر من مرّة', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    await addConversationPart(a.id, { speaker: 'إيجور', text: 'А', personId: igor.id });
    await addConversationPart(b.id, { speaker: 'إيجور', text: 'Б', personId: igor.id });

    const pivots = await pivotsFor(a.id);
    expect(pivots.some((p) => p.axis === AXIS.PERSON && p.count === 2)).toBe(true);
  });

  it('ذكرى محذوفة بلا محاور', async () => {
    await fresh();
    const s = await scene('محذوفة', '2026-04-01');
    await scenes.trash(s.id);
    expect(await pivotsFor(s.id)).toEqual([]);
  });

  it('العدد في المحور = اللي هيرجّعه النهر بالفعل', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const a = await scene('أ', '2026-04-01');
    for (const date of ['2026-04-02', '2026-04-03']) {
      const other = await scene(`ذكرى ${date}`, date);
      await addConversationPart(other.id, { speaker: 'إيجور', text: 'X', personId: igor.id });
    }
    await addConversationPart(a.id, { speaker: 'إيجور', text: 'А', personId: igor.id });

    const pivot = (await pivotsFor(a.id)).find((p) => p.axis === AXIS.PERSON);
    const page = await riverPage({ filters: { [AXIS.PERSON]: pivot.value } });
    const shown = page.days.reduce((n, day) => n + day.scenes.length, 0);
    // ⚠️ الوعد الذي يقطعه الرقم: تضغطه فتجد ما قال (بند 66).
    expect(shown).toBe(pivot.count);
  });
});

describe('الأطلس — العدسات', () => {
  it('تُحفَظ وتُقرَأ وتُمسَح', async () => {
    await fresh();
    await settings.set('atlas.lenses', []);

    const lens = await saveLens('شغلي مع إيجور', { [AXIS.PERSON]: 'PE_1', placeLabel: '' });
    expect((await listLenses()).length).toBe(1);
    expect((await listLenses())[0].name).toBe('شغلي مع إيجور');

    await removeLens(lens.id);
    expect(await listLenses()).toEqual([]);
  });

  it('بلا اسم أو بلا مرشّحات تُرفَض', async () => {
    await fresh();
    await settings.set('atlas.lenses', []);
    let errors = 0;
    for (const attempt of [
      () => saveLens('   ', { [AXIS.TYPE]: 'phone' }),
      () => saveLens('عدسة فاضية', {}),
    ]) {
      try { await attempt(); } catch { errors++; }
    }
    expect(errors).toBe(2);
  });

  it('الاسم المكرّر يُرفَض بعد التطبيع', async () => {
    await fresh();
    await settings.set('atlas.lenses', []);
    await saveLens('المصلحة', { [AXIS.TYPE]: 'official' });
    let error = null;
    try { await saveLens('المصلحه', { [AXIS.TYPE]: 'phone' }); } catch (e) { error = e; }
    expect(Boolean(error)).toBe(true);
  });

  it('لا تحفظ `placeLabel` بين المرشّحات — هو للعرض لا للتصفية', async () => {
    await fresh();
    await settings.set('atlas.lenses', []);
    const lens = await saveLens('المكتب', { [AXIS.PLACE]: 'المكتب', placeLabel: 'المكتب' });
    expect(Object.keys(lens.filters)).toEqual([AXIS.PLACE]);
    expect(lens.placeLabel).toBe('المكتب');
  });

  it('⚠️ مفيش عدسات مدمجة — كلها من كتابتك', async () => {
    await fresh();
    await settings.set('atlas.lenses', []);
    /*
     * «الشغل» و«اليوميّات» جاهزتين تحتاجان قرارًا لسنا أصحابه: أيّ
     * الأنواع «شغل»؟ وتصنيفٌ نخترعه يبدو معلومةً عنك وهو تخمينٌ منّا.
     */
    expect(await listLenses()).toEqual([]);
  });
});

describe('الأطلس — الكوكبة', () => {
  it('الوصلة من المحادثة لا من الحضور', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const marina = await addPerson({ name: 'مارينا' });
    const s = await scene('اجتماع', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'А', personId: igor.id });
    // مارينا حضرت ولم تتكلّم — لا خيط.
    const one = await constellation();
    expect(one.links).toEqual([]);

    await addConversationPart(s.id, { speaker: 'مارينا', text: 'Б', personId: marina.id });
    const two = await constellation();
    expect(two.links.length).toBe(1);
    expect(two.links[0].count).toBe(1);
  });

  it('سُمك الخيط = عدد المواقف اللي جمعت الاتنين', async () => {
    await fresh();
    const a = await addPerson({ name: 'أ' });
    const b = await addPerson({ name: 'ب' });
    for (const date of ['2026-04-01', '2026-04-02', '2026-04-03']) {
      const s = await scene(`ذكرى ${date}`, date);
      await addConversationPart(s.id, { speaker: 'أ', text: 'X', personId: a.id });
      await addConversationPart(s.id, { speaker: 'ب', text: 'Y', personId: b.id });
    }
    const net = await constellation();
    expect(net.links.length).toBe(1);
    expect(net.links[0].count).toBe(3);
    expect(net.scenesWithTwo).toBe(3);
  });

  it('الزوج واحدٌ مهما اختلف ترتيبه', async () => {
    await fresh();
    const a = await addPerson({ name: 'أ' });
    const b = await addPerson({ name: 'ب' });
    const one = await scene('الأولى', '2026-04-01');
    const two = await scene('التانية', '2026-04-02');
    await addConversationPart(one.id, { speaker: 'أ', text: 'X', personId: a.id });
    await addConversationPart(one.id, { speaker: 'ب', text: 'Y', personId: b.id });
    // الترتيب معكوس في الذكرى التانية.
    await addConversationPart(two.id, { speaker: 'ب', text: 'Y', personId: b.id });
    await addConversationPart(two.id, { speaker: 'أ', text: 'X', personId: a.id });

    const net = await constellation();
    expect(net.links.length).toBe(1);
    expect(net.links[0].count).toBe(2);
  });

  it('ثلاثة في موقف = ثلاث وصلات', async () => {
    await fresh();
    const ids = [];
    for (const name of ['أ', 'ب', 'ج']) ids.push((await addPerson({ name })).id);
    const s = await scene('قعدة', '2026-04-01');
    for (const id of ids) await addConversationPart(s.id, { speaker: 'x', text: 'X', personId: id });

    const net = await constellation();
    expect(net.links.length).toBe(3);
    expect(net.nodes.length).toBe(3);
  });

  it('مواقف الوصلة تُعاد بأسمائها من الأحدث', async () => {
    await fresh();
    const a = await addPerson({ name: 'أ' });
    const b = await addPerson({ name: 'ب' });
    for (const [title, date] of [['قديمة', '2026-01-01'], ['جديدة', '2026-06-01']]) {
      const s = await scene(title, date);
      await addConversationPart(s.id, { speaker: 'أ', text: 'X', personId: a.id });
      await addConversationPart(s.id, { speaker: 'ب', text: 'Y', personId: b.id });
    }
    const net = await constellation();
    expect(net.links[0].scenes[0].title).toBe('جديدة');
    expect(net.links[0].scenes[1].title).toBe('قديمة');
  });

  it('الذكرى المحذوفة تخرج من الشبكة', async () => {
    await fresh();
    const a = await addPerson({ name: 'أ' });
    const b = await addPerson({ name: 'ب' });
    const s = await scene('محذوفة', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'أ', text: 'X', personId: a.id });
    await addConversationPart(s.id, { speaker: 'ب', text: 'Y', personId: b.id });
    await scenes.trash(s.id);

    const net = await constellation();
    expect(net.links).toEqual([]);
    expect(net.nodes).toEqual([]);
  });

  it('قاعدةٌ فارغة تعطي شبكةً فارغة لا خطأ', async () => {
    await fresh();
    const net = await constellation();
    expect(net.nodes).toEqual([]);
    expect(net.links).toEqual([]);
    expect(net.scenesWithTwo).toBe(0);
  });
});

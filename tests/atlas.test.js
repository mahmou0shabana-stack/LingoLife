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
 *  4. **الشخص مُشتقٌّ بحدوده** — مَن تكلّم يظهر، ومَن حضر ولم يتكلّم
 *     لا يظهر. والحدّ مُعلَنٌ لا مخفيّ.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventThreads, relationships, conversationParts,
  expressions, expressionOccurrences, mistakeComparisons, scripts,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { addPerson } from '../js/services/person-service.js';
import { resetTypes } from '../js/services/type-service.js';
import { createThread, addSceneToThread } from '../js/services/thread-service.js';
import { addConversationPart, addExpression } from '../js/services/content-service.js';
import {
  AXIS, ABSENT_AXES, placeKey, facetsFor, allowedSceneIds,
  riverPage, dayDetail, adjacentDays,
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
    // الحقل الميّت يبقى فارغًا ولا يُقرَأ منه شيء.
    const row = await scenes.get(s.id);
    expect(row.peopleIds).toEqual([]);
  });

  it('مَن حضر ولم يتكلّم لا يظهر — والحدّ معلَن', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    await addPerson({ name: 'مارينا' });
    const s = await scene('اجتماع', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: igor.id });

    const facets = await facetsFor([s]);
    expect(facets.get(s.id).personIds.length).toBe(1);
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

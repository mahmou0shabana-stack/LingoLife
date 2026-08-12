/**
 * LingoLife — اختبارات مختبر التطوّر
 *
 * ستّ قواعد تُحرَس:
 *
 *  1. **الرقم وعدٌ يُوفَّى** — كل عدّادٍ معه معرّفاتُ ما تحته، وطولُ
 *     القائمة = الرقم. عدّادٌ بلا قائمةٍ يُفتَح هو مؤشِّرٌ متنكِّر.
 *  2. **ما لا يُقاس لا يُعرَض** — «متوسّط» على واحدةٍ ليس متوسّطًا،
 *     والسبب يُقال بدل رقمٍ كاذب.
 *  3. **الحالة لا تتغيّر بلا سجلّ** — و«واقفة» بلا سبب مرفوضة،
 *     و«اتحلّت» بلا شرحٍ مرفوضة.
 *  4. **التاريخ لا يُمحى** — إعادةُ الفتح تُبقي الحلّ السابق، والمقفول
 *     يبقى في السجلّ.
 *  5. **لا دمج تلقائي** — الشبيه يُقترَح بأدلّته، والحاسم أنت.
 *  6. **العضويّة علاقةٌ لا حقل** — حذفُ Brief لا يمسّ ملاحظاته.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  devIssues, devBriefs, devEvents, devShots, relationships, media,
} from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import {
  STATUS, OPEN_STATUSES, CLOSED_STATUSES, BLOCKED_REASON, PRIORITY,
  EVENT, NOT_A_METRIC, STATUS_META, BLOCKED_REASON_META,
  BRIEF_ISSUE, featureOf, featureLabel,
} from '../js/services/dev/model.js';
import {
  createIssue, updateIssue, addComment, setStatus, blockIssue, resolveIssue,
  reopenIssue, moveToBrief, briefOf, issuesOfBrief, listIssues, getIssue,
  filterIssues, similarIssues, timelineOf,
} from '../js/services/dev/issue-service.js';
import {
  createBrief, updateBrief, getBrief, listBriefs, deleteBrief,
  briefSummary, BRIEF_STATUS,
} from '../js/services/dev/brief-service.js';
import { attachShot, shotsOf, normalizeRegion, hasComparison, PHASE } from '../js/services/dev/shots.js';
import { labOverview, statusBoard, developmentHistory, issueStory, MIN_SAMPLE } from '../js/services/dev/metrics.js';

async function fresh() {
  await openDB();
  for (const repo of [devIssues, devBriefs, devEvents, devShots, relationships, media]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
}

const issue = (title, extra = {}) => createIssue({ title, ...extra });

/** صورة PNG صغيرة حقيقية — لا سلسلة نصّية تتظاهر بأنها ملفّ. */
function pngFile(name = 'shot.png') {
  const bytes = Uint8Array.from(atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR42mNk'
    + 'YPhfz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC'
  ), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'image/png' });
}

/* ================================================================== */

describe('النموذج يُعلن نفسه', () => {
  it('كل حالةٍ لها وسمٌ عربيّ وشرح', () => {
    for (const status of Object.values(STATUS)) {
      expect(Boolean(STATUS_META[status]?.label)).toBe(true);
      expect(STATUS_META[status].hint.length > 10).toBe(true);
    }
  });

  it('وكل سبب توقّفٍ له وسمٌ وشرح', () => {
    for (const reason of Object.values(BLOCKED_REASON)) {
      expect(Boolean(BLOCKED_REASON_META[reason]?.label)).toBe(true);
      expect(BLOCKED_REASON_META[reason].hint.length > 10).toBe(true);
    }
  });

  it('المفتوح والمقفول يغطّيان كل الحالات بلا تداخل', () => {
    const all = Object.values(STATUS).sort();
    expect([...OPEN_STATUSES, ...CLOSED_STATUSES].sort()).toEqual(all);
    const overlap = OPEN_STATUSES.filter((s) => CLOSED_STATUSES.includes(s));
    expect(overlap).toEqual([]);
  });

  it('⚠️ وكل رقمٍ مرفوضٍ معه سببٌ حقيقيّ لا كلمة', () => {
    const entries = Object.entries(NOT_A_METRIC);
    expect(entries.length > 4).toBe(true);
    for (const [, row] of entries) {
      expect(Boolean(row.label)).toBe(true);
      expect(row.reason.length > 30).toBe(true);
    }
  });

  it('الميزة تُشتقّ من نمط المسار لا من المسار الحرفيّ', () => {
    // ⚠️ ذكرتان مختلفتان على **نفس الشاشة**.
    expect(featureOf('/scene/:id')).toBe('life');
    expect(featureOf('/shadow/:id')).toBe('shadow');
    // ونمطٌ مجهول يُعلَن لا يُخمَّن.
    expect(featureOf('/حاجة-غريبة')).toBe('other');
    expect(featureLabel('other')).toBe('مكان تاني');
  });
});

/* ================================================================== */

describe('الملاحظة — الإنشاء والسياق', () => {
  it('تُنشأ ومعها حدث «اتعملت»', async () => {
    await fresh();
    const row = await issue('زرّ التشغيل صغير');
    const events = await timelineOf(row.id);
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe(EVENT.CREATED);
  });

  it('بلا عنوان تُرفض برسالةٍ مفهومة', async () => {
    await fresh();
    let message = '';
    try {
      await createIssue({ title: '   ' });
    } catch (err) {
      message = err.message;
    }
    expect(message.includes('عنوان')).toBe(true);
  });

  it('تلتقط الشاشة والمسار معًا', async () => {
    await fresh();
    const row = await createIssue({
      title: 'الكتاب تخين',
      routePattern: '/shadow/:id',
      routePath: '/shadow/SHS_123',
    });
    expect(row.featureId).toBe('shadow');
    // ⚠️ الحرفيّ للرجوع، والنمط للتجميع — الاتنين مش واحد.
    expect(row.routePath).toBe('/shadow/SHS_123');
  });

  it('الافتراضيّات: مفتوحة وعاديّة', async () => {
    await fresh();
    const row = await issue('حاجة');
    expect(row.status).toBe(STATUS.OPEN);
    expect(row.priority).toBe(PRIORITY.NORMAL);
    // ولا سببَ توقّفٍ ولا شرحَ حلٍّ يُكتب قبل أوانه.
    expect(row.blockedReason).toBe('');
    expect(row.resolutionNote).toBe('');
    expect(row.resolvedAt).toBe(null);
  });

  it('⚠️ تعديل العنوان لا يُسجَّل — والتعليق يُسجَّل', async () => {
    await fresh();
    const row = await issue('عنوان فيه غلطة');
    await updateIssue(row.id, { title: 'عنوان مظبوط' });
    expect((await timelineOf(row.id)).length).toBe(1);

    await addComment(row.id, 'جرّبتها تاني ولسه بتحصل');
    const events = await timelineOf(row.id);
    expect(events.length).toBe(2);
    expect(events[1].kind).toBe(EVENT.COMMENT);
    expect(events[1].note).toBe('جرّبتها تاني ولسه بتحصل');
  });

  it('وتعليقٌ فاضٍ يُرفض', async () => {
    await fresh();
    const row = await issue('حاجة');
    let threw = false;
    try {
      await addComment(row.id, '   ');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

/* ================================================================== */

describe('الحالة — ولا تغييرَ بلا سجلّ', () => {
  it('كل نقلةٍ تكتب حدثًا بمن وإلى', async () => {
    await fresh();
    const row = await issue('حاجة');
    await setStatus(row.id, STATUS.PLANNED);
    await setStatus(row.id, STATUS.IN_PROGRESS);

    const events = await timelineOf(row.id);
    const moves = events.filter((e) => e.kind === EVENT.STATUS);
    expect(moves.length).toBe(2);
    expect(moves[0].from).toBe(STATUS.OPEN);
    expect(moves[0].to).toBe(STATUS.PLANNED);
    expect(moves[1].to).toBe(STATUS.IN_PROGRESS);
  });

  it('النقلة لنفس الحالة لا تكتب ضجيجًا', async () => {
    await fresh();
    const row = await issue('حاجة');
    await setStatus(row.id, STATUS.OPEN);
    expect((await timelineOf(row.id)).length).toBe(1);
  });

  it('⚠️ «واقفة» من الباب العامّ مرفوضة — لازم سبب', async () => {
    await fresh();
    const row = await issue('حاجة');
    let message = '';
    try {
      await setStatus(row.id, STATUS.BLOCKED);
    } catch (err) {
      message = err.message;
    }
    expect(message.includes('سبب')).toBe(true);
    expect((await getIssue(row.id)).status).toBe(STATUS.OPEN);
  });

  it('⚠️ و«اتحلّت» من الباب العامّ مرفوضة — لازم تقول إيه اللي اتعمل', async () => {
    await fresh();
    const row = await issue('حاجة');
    let threw = false;
    try {
      await setStatus(row.id, STATUS.RESOLVED);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('التوقّف بسببه يُكتب ويظهر', async () => {
    await fresh();
    const row = await issue('حاجة');
    await blockIssue(row.id, BLOCKED_REASON.DEVICE, 'لازم أجرّبها على التابلت');

    const after = await getIssue(row.id);
    expect(after.status).toBe(STATUS.BLOCKED);
    expect(after.blockedReason).toBe(BLOCKED_REASON.DEVICE);
    expect(after.blockedNote).toBe('لازم أجرّبها على التابلت');

    const events = await timelineOf(row.id);
    expect(events[events.length - 1].kind).toBe(EVENT.BLOCKED);
    expect(events[events.length - 1].ref).toBe(BLOCKED_REASON.DEVICE);
  });

  it('«سبب تاني» بلا كتابة يُرفض', async () => {
    await fresh();
    const row = await issue('حاجة');
    let threw = false;
    try {
      await blockIssue(row.id, BLOCKED_REASON.OTHER, '');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('⚠️ والخروج من «واقفة» يفرّغ السبب — وإلّا بان إنها لسه واقفة', async () => {
    await fresh();
    const row = await issue('حاجة');
    await blockIssue(row.id, BLOCKED_REASON.PRODUCT, 'مستنّي قرارك');
    await setStatus(row.id, STATUS.IN_PROGRESS);

    const after = await getIssue(row.id);
    expect(after.blockedReason).toBe('');
    expect(after.blockedNote).toBe('');
  });

  it('سببٌ مجهول يُرفض', async () => {
    await fresh();
    const row = await issue('حاجة');
    let threw = false;
    try {
      await blockIssue(row.id, 'سبب-مخترع', 'أي كلام');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

/* ================================================================== */

describe('الحلّ وإعادة الفتح — والتاريخ لا يُمحى', () => {
  it('الحلّ يكتب الشرح والوقت الحقيقيّ', async () => {
    await fresh();
    const row = await issue('زرّ التشغيل صغير');
    await resolveIssue(row.id, 'كبّرته لـ56px وخلّيته دايري');

    const after = await getIssue(row.id);
    expect(after.status).toBe(STATUS.RESOLVED);
    expect(after.resolutionNote).toBe('كبّرته لـ56px وخلّيته دايري');
    expect(typeof after.resolvedAt).toBe('number');
    expect(after.resolvedAt >= after.createdAt).toBe(true);
  });

  it('⚠️ وحلٌّ بلا شرح مرفوض — الشرح هو اللي هتقراه بعد شهور', async () => {
    await fresh();
    const row = await issue('حاجة');
    let message = '';
    try {
      await resolveIssue(row.id, '   ');
    } catch (err) {
      message = err.message;
    }
    expect(message.length > 10).toBe(true);
    expect((await getIssue(row.id)).status).toBe(STATUS.OPEN);
  });

  it('⚠️ إعادة الفتح تُبقي شرح الحلّ السابق', async () => {
    await fresh();
    const row = await issue('حاجة');
    await resolveIssue(row.id, 'عملت كذا وكذا');
    await reopenIssue(row.id, 'رجعت تحصل تاني');

    const after = await getIssue(row.id);
    expect(after.status).toBe(STATUS.OPEN);
    // لم تعد محلولة…
    expect(after.resolvedAt).toBe(null);
    // …لكن ما عُمل يومها قد عُمل.
    expect(after.resolutionNote).toBe('عملت كذا وكذا');
  });

  it('وتُسجَّل «اتفتحت تاني» لا «الحالة اتغيّرت»', async () => {
    await fresh();
    const row = await issue('حاجة');
    await resolveIssue(row.id, 'اتعمل');
    await reopenIssue(row.id);

    const events = await timelineOf(row.id);
    expect(events[events.length - 1].kind).toBe(EVENT.REOPENED);
  });

  it('⚠️ وكلُّ حلٍّ سابقٍ باقٍ في السجلّ — «عملنا إيه المرّة اللي فاتت؟»', async () => {
    await fresh();
    const row = await issue('حاجة');
    await resolveIssue(row.id, 'الحلّ الأول');
    await reopenIssue(row.id);
    await resolveIssue(row.id, 'الحلّ التاني');

    const story = await issueStory(row.id);
    expect(story.reopenCount).toBe(1);
    expect(story.pastResolutions.map((r) => r.note)).toEqual(['الحلّ الأول', 'الحلّ التاني']);
  });

  it('والمقفول يفضل في القايمة — مايتمسحش', async () => {
    await fresh();
    const a = await issue('اتحلّت');
    const b = await issue('اترفضت');
    await resolveIssue(a.id, 'اتعمل');
    await setStatus(b.id, STATUS.REJECTED, { note: 'مش هنعملها' });

    const all = await listIssues();
    expect(all.length).toBe(2);
  });
});

/* ================================================================== */

describe('الـBrief — عضويّةٌ لا حقل', () => {
  it('النقل يربط ويُسجَّل', async () => {
    await fresh();
    const brief = await createBrief({ title: 'تحسينات تجربة الظلّ' });
    const row = await issue('الكتاب تخين');
    await moveToBrief(row.id, brief.id);

    expect(await briefOf(row.id)).toBe(brief.id);
    const events = await timelineOf(row.id);
    expect(events[events.length - 1].kind).toBe(EVENT.BRIEF);
  });

  it('⚠️ ولا حقلَ `briefId` على الملاحظة — العضويّة صفٌّ في `relationships`', async () => {
    await fresh();
    const brief = await createBrief({ title: 'برييف' });
    const row = await issue('حاجة');
    await moveToBrief(row.id, brief.id);

    expect((await devIssues.get(row.id)).briefId).toBe(undefined);
    const [link] = await relationships.byIndex('kind', BRIEF_ISSUE);
    expect(link.fromId).toBe(brief.id);
    expect(link.toId).toBe(row.id);
  });

  it('الملاحظة في Brief واحد — النقل يرفع السابق', async () => {
    await fresh();
    const a = await createBrief({ title: 'أ' });
    const b = await createBrief({ title: 'ب' });
    const row = await issue('حاجة');

    await moveToBrief(row.id, a.id);
    await moveToBrief(row.id, b.id);

    expect(await briefOf(row.id)).toBe(b.id);
    expect((await issuesOfBrief(a.id)).length).toBe(0);
    expect((await issuesOfBrief(b.id)).length).toBe(1);
  });

  it('والإخراج بـ`null` يشيلها منه', async () => {
    await fresh();
    const brief = await createBrief({ title: 'برييف' });
    const row = await issue('حاجة');
    await moveToBrief(row.id, brief.id);
    await moveToBrief(row.id, null);

    expect(await briefOf(row.id)).toBe(null);
  });

  it('⚠️ حذف الـBrief لا يمسّ ملاحظاته', async () => {
    await fresh();
    const brief = await createBrief({ title: 'برييف' });
    const a = await issue('أ');
    const b = await issue('ب');
    await moveToBrief(a.id, brief.id);
    await moveToBrief(b.id, brief.id);

    await deleteBrief(brief.id);

    // الملاحظات باقية ومستقلّة — لا يتيمة ولا ممحوّة.
    expect((await listIssues()).length).toBe(2);
    expect(await briefOf(a.id)).toBe(null);
    expect(await getBrief(brief.id)).toBe(null);
  });

  it('الملخّص مُشتقٌّ من الملاحظات لا محفوظًا', async () => {
    await fresh();
    const brief = await createBrief({ title: 'برييف' });
    const a = await issue('أ');
    const b = await issue('ب');
    await moveToBrief(a.id, brief.id);
    await moveToBrief(b.id, brief.id);
    await resolveIssue(a.id, 'اتعمل');

    const summary = await briefSummary(brief.id);
    expect(summary.total).toBe(2);
    expect(summary.open).toBe(1);
    expect(summary.closed).toBe(1);
  });

  it('Brief بلا اسم يُرفض', async () => {
    await fresh();
    let threw = false;
    try {
      await createBrief({ title: '  ' });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('«ممنوع يتكسر» حقلٌ يُكتب ويُقرَأ', async () => {
    await fresh();
    const brief = await createBrief({
      title: 'برييف',
      doNotBreak: 'استئناف الموضع في الكتاب',
      acceptance: 'الزرّ يبقى 56px',
    });
    const after = await getBrief(brief.id);
    expect(after.doNotBreak).toBe('استئناف الموضع في الكتاب');
    expect(after.acceptance).toBe('الزرّ يبقى 56px');
  });
});

/* ================================================================== */

describe('«جديدة ولا مرتبطة بحاجة قديمة؟» — اقتراحٌ لا دمج', () => {
  it('نفس الشاشة دليلُ شبه', async () => {
    await fresh();
    await createIssue({ title: 'الكتاب تخين', routePattern: '/shadow/:id' });
    const found = await similarIssues({ title: 'حاجة تانية خالص', featureId: 'shadow' });

    expect(found.length).toBe(1);
    expect(found[0].why.some((w) => w.includes('نفس الشاشة'))).toBe(true);
  });

  it('والكلمات المشتركة دليلٌ آخر — ويُقال أيُّها', async () => {
    await fresh();
    await createIssue({ title: 'زرّ التشغيل صغير', routePattern: '/language' });
    const found = await similarIssues({ title: 'زرّ التشغيل مش واضح', featureId: 'atlas' });

    expect(found.length).toBe(1);
    expect(found[0].why.some((w) => w.includes('كلمات مشتركة'))).toBe(true);
  });

  it('⚠️ ولا يُدمَج شيءٌ تلقائيًّا — الدالّة تقرأ ولا تكتب', async () => {
    await fresh();
    const existing = await createIssue({ title: 'الكتاب تخين', routePattern: '/shadow/:id' });
    const before = (await devEvents.getAll()).length;

    await similarIssues({ title: 'الكتاب تخين', featureId: 'shadow' });

    expect((await devEvents.getAll()).length).toBe(before);
    expect((await getIssue(existing.id)).status).toBe(STATUS.OPEN);
    expect((await listIssues()).length).toBe(1);
  });

  it('المقفولة لا تُقترَح — الشبيه لازم يكون مفتوحًا', async () => {
    await fresh();
    const old = await createIssue({ title: 'الكتاب تخين', routePattern: '/shadow/:id' });
    await resolveIssue(old.id, 'اتظبط');

    const found = await similarIssues({ title: 'الكتاب تخين', featureId: 'shadow' });
    expect(found).toEqual([]);
  });

  it('ولا تقترح نفسها على نفسها', async () => {
    await fresh();
    const row = await createIssue({ title: 'الكتاب تخين', routePattern: '/shadow/:id' });
    const found = await similarIssues({
      title: 'الكتاب تخين', featureId: 'shadow', excludeId: row.id,
    });
    expect(found).toEqual([]);
  });
});

/* ================================================================== */

describe('اللقطة و«أنهي جزء»', () => {
  it('تُرفَق وتُقرأ ومعها الصورة', async () => {
    await fresh();
    const row = await issue('زرّ التشغيل صغير');
    await attachShot(row.id, pngFile());

    const shots = await shotsOf(row.id);
    expect(shots.length).toBe(1);
    expect(shots[0].phase).toBe(PHASE.BEFORE);
    expect(Boolean(shots[0].media)).toBe(true);
  });

  it('وتُسجَّل في الخطّ الزمنيّ', async () => {
    await fresh();
    const row = await issue('حاجة');
    await attachShot(row.id, pngFile());
    const events = await timelineOf(row.id);
    expect(events[events.length - 1].kind).toBe(EVENT.SHOT);
  });

  it('⚠️ المنطقة نِسَبٌ لا بكسلات', async () => {
    await fresh();
    const row = await issue('حاجة');
    const shot = await attachShot(row.id, pngFile(), {
      region: { x: 0.1, y: 0.2, w: 0.3, h: 0.25 },
    });
    expect(shot.region.x).toBe(0.1);
    expect(shot.region.w).toBe(0.3);
  });

  it('ومنطقةٌ خارج الحدود تُقصّ لا تُقبَل كما هي', () => {
    const region = normalizeRegion({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 });
    expect(region.x + region.w <= 1).toBe(true);
    expect(region.y + region.h <= 1).toBe(true);
  });

  it('ومنطقةٌ بلا مساحة ليست إشارة', () => {
    expect(normalizeRegion({ x: 0.5, y: 0.5, w: 0, h: 0.2 })).toBe(null);
    expect(normalizeRegion(null)).toBe(null);
  });

  it('⚠️ قبل ثم بعد دائمًا — المقارنة تُقرأ في اتّجاهٍ واحد', async () => {
    await fresh();
    const row = await issue('حاجة');
    await attachShot(row.id, pngFile('after.png'), { phase: PHASE.AFTER });
    await attachShot(row.id, pngFile('before.png'), { phase: PHASE.BEFORE });

    const shots = await shotsOf(row.id);
    expect(shots.map((s) => s.phase)).toEqual([PHASE.BEFORE, PHASE.AFTER]);
    expect(hasComparison(shots)).toBe(true);
  });

  it('ولقطةٌ واحدة ليست مقارنة', async () => {
    await fresh();
    const row = await issue('حاجة');
    await attachShot(row.id, pngFile());
    expect(hasComparison(await shotsOf(row.id))).toBe(false);
  });
});

/* ================================================================== */

describe('⚠️ الرقم وعدٌ يُوفَّى', () => {
  it('كل عدّادٍ في اللوحة معه معرّفاتُ ما تحته', async () => {
    await fresh();
    await issue('أ');
    await issue('ب');
    const blocked = await issue('ج');
    await blockIssue(blocked.id, BLOCKED_REASON.API, 'محتاجة خدمة برّه');

    const board = await statusBoard();
    for (const row of board.counters) {
      // ⚠️ ده الفرق بين عدّاد ومؤشِّر: العدّاد بيتفتح.
      expect(row.ids.length).toBe(row.count);
    }
    expect(board.counters.find((c) => c.key === STATUS.OPEN).count).toBe(2);
    expect(board.counters.find((c) => c.key === STATUS.BLOCKED).count).toBe(1);
  });

  it('وكل عدّادٍ في النظرة العامّة كذلك', async () => {
    await fresh();
    const a = await issue('أ');
    const b = await issue('ب');
    await blockIssue(b.id, BLOCKED_REASON.PRODUCT, 'مستنّي قرارك');
    await resolveIssue(a.id, 'اتعمل');

    const view = await labOverview();
    for (const row of Object.values(view.counters)) {
      expect(row.ids.length).toBe(row.count);
    }
    expect(view.counters.waitingProduct.count).toBe(1);
    expect(view.counters.resolved.count).toBe(1);
  });

  it('والعدد يوافق ما يرجّعه المرشّح فعلًا', async () => {
    await fresh();
    for (const title of ['أ', 'ب', 'ج']) {
      await createIssue({ title, routePattern: '/shadow/:id' });
    }
    await createIssue({ title: 'د', routePattern: '/analysis' });

    const view = await labOverview();
    const shadow = view.features.find((row) => row.key === 'shadow');
    const actual = await filterIssues({ featureId: 'shadow', open: true });
    expect(shadow.count).toBe(actual.length);
    expect(shadow.count).toBe(3);
  });

  it('الواقف حسب السبب يُعَدّ ويُفتَح', async () => {
    await fresh();
    const a = await issue('أ');
    const b = await issue('ب');
    await blockIssue(a.id, BLOCKED_REASON.DEPENDENCY, 'مستنّي حاجة');
    await blockIssue(b.id, BLOCKED_REASON.DEPENDENCY, 'مستنّي حاجة');

    const view = await labOverview();
    const row = view.blockedReasons.find((r) => r.key === BLOCKED_REASON.DEPENDENCY);
    expect(row.count).toBe(2);
    expect(row.ids.length).toBe(2);
  });

  it('أقدم ملاحظة مفتوحة واقعةٌ واحدة تُعرَض كما هي', async () => {
    await fresh();
    const old = await issue('القديمة');
    await devIssues.putRaw({ ...(await devIssues.get(old.id)), createdAt: 1000 });
    await issue('الجديدة');

    const view = await labOverview();
    expect(view.oldestOpen.id).toBe(old.id);
    expect(view.oldestOpen.title).toBe('القديمة');
  });
});

/* ================================================================== */

describe('⚠️ ما لا يُقاس لا يُعرَض', () => {
  it('متوسّط المدّة لا يُعرَض على عيّنةٍ صغيرة — ويُقال السبب', async () => {
    await fresh();
    const row = await issue('حاجة');
    await resolveIssue(row.id, 'اتعمل');

    const view = await labOverview();
    const avg = view.measures.find((m) => m.label.includes('متوسّط'));
    expect(avg.ok).toBe(false);
    expect(avg.value).toBe(null);
    expect(avg.sample).toBe(1);
    expect(avg.why.length > 20).toBe(true);
  });

  it('ويُعرَض حين تكفي العيّنة — من `createdAt` إلى `resolvedAt` الحقيقيَّين', async () => {
    await fresh();
    const DAY = 86400000;
    for (let i = 0; i < MIN_SAMPLE; i += 1) {
      const row = await issue(`حاجة ${i}`);
      await resolveIssue(row.id, 'اتعمل');
      const saved = await devIssues.get(row.id);
      // يومان بالضبط لكل واحدة — فالمتوسّط لازم يطلع ٢.
      await devIssues.putRaw({ ...saved, createdAt: 1000, resolvedAt: 1000 + 2 * DAY });
    }

    const view = await labOverview();
    const avg = view.measures.find((m) => m.label.includes('متوسّط'));
    expect(avg.ok).toBe(true);
    expect(avg.value).toBe(2);
    expect(avg.sample).toBe(MIN_SAMPLE);
  });

  it('⚠️ ومَن لم يُحَلّ لا يدخل في المتوسّط', async () => {
    await fresh();
    const open = await issue('مفتوحة');
    const done = await issue('متحلّة');
    await resolveIssue(done.id, 'اتعمل');

    const view = await labOverview();
    expect(view.measures[0].sample).toBe(1);
    expect(open.id.length > 0).toBe(true);
  });

  it('عالمٌ فارغ يعطي أصفارًا صادقة لا سقوطًا', async () => {
    await fresh();
    const view = await labOverview();
    expect(view.total).toBe(0);
    expect(view.oldestOpen).toBe(null);
    expect(view.measures.every((m) => m.ok === false)).toBe(true);
  });
});

/* ================================================================== */

describe('الترشيح والبحث', () => {
  it('بالحالة وبالشاشة وبالأولويّة', async () => {
    await fresh();
    await createIssue({ title: 'أ', routePattern: '/shadow/:id', priority: PRIORITY.HIGH });
    await createIssue({ title: 'ب', routePattern: '/analysis' });

    expect((await filterIssues({ featureId: 'shadow' })).length).toBe(1);
    expect((await filterIssues({ priority: PRIORITY.HIGH })).length).toBe(1);
    expect((await filterIssues({ status: STATUS.OPEN })).length).toBe(2);
  });

  it('وبالمفتوح مقابل المقفول', async () => {
    await fresh();
    const a = await issue('أ');
    await issue('ب');
    await resolveIssue(a.id, 'اتعمل');

    expect((await filterIssues({ open: true })).length).toBe(1);
    expect((await filterIssues({ open: false })).length).toBe(1);
  });

  it('وبسبب التوقّف', async () => {
    await fresh();
    const a = await issue('أ');
    await blockIssue(a.id, BLOCKED_REASON.DEVICE, 'على التابلت');
    expect((await filterIssues({ blockedReason: BLOCKED_REASON.DEVICE })).length).toBe(1);
    expect((await filterIssues({ blockedReason: BLOCKED_REASON.API })).length).toBe(0);
  });

  it('وبالـBrief', async () => {
    await fresh();
    const brief = await createBrief({ title: 'برييف' });
    const a = await issue('أ');
    await issue('ب');
    await moveToBrief(a.id, brief.id);

    expect((await filterIssues({ briefId: brief.id })).length).toBe(1);
  });

  it('والبحث النصّي يشمل التعليق وشرح الحلّ', async () => {
    await fresh();
    const a = await issue('عنوان عادي');
    await updateIssue(a.id, { body: 'المشكلة في الخطّ الروسي' });
    const b = await issue('حاجة تانية');
    await resolveIssue(b.id, 'ظبّطت الخطّ الروسي');

    expect((await filterIssues({ query: 'الخط الروسي' })).length).toBe(2);
  });

  it('وبالتاريخ', async () => {
    await fresh();
    const old = await issue('قديمة');
    await devIssues.putRaw({ ...(await devIssues.get(old.id)), createdAt: 1000 });
    await issue('جديدة');

    expect((await filterIssues({ from: Date.now() - 60000 })).length).toBe(1);
  });
});

/* ================================================================== */

describe('تاريخ تطويري', () => {
  it('يرجّع الأحداث ومعها ملاحظاتها — الأحدث أوّلًا', async () => {
    await fresh();
    const a = await issue('أ');
    await resolveIssue(a.id, 'اتعمل');

    const history = await developmentHistory();
    expect(history.length).toBe(2);
    expect(history[0].event.kind).toBe(EVENT.RESOLVED);
    expect(history[0].issue.title).toBe('أ');
  });

  it('⚠️ ولا يختفي منه المحلول', async () => {
    await fresh();
    const a = await issue('اتحلّت من زمان');
    await resolveIssue(a.id, 'اتعمل');

    const history = await developmentHistory();
    expect(history.some((row) => row.issue.id === a.id)).toBe(true);
  });

  it('حدثٌ لملاحظةٍ ممحوّة لا يظهر يتيمًا', async () => {
    await fresh();
    const a = await issue('هتتمسح');
    await devIssues.destroy(a.id);

    const history = await developmentHistory();
    expect(history).toEqual([]);
  });

  it('وقصّة الملاحظة تجمع بدايتها ونهايتها وعدد إعادة فتحها', async () => {
    await fresh();
    const a = await issue('حاجة');
    await resolveIssue(a.id, 'الأول');
    await reopenIssue(a.id);

    const story = await issueStory(a.id);
    expect(story.reopenCount).toBe(1);
    expect(typeof story.startedAt).toBe('number');
    expect(story.lastAt >= story.startedAt).toBe(true);
  });
});

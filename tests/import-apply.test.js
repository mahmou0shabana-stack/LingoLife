/**
 * LingoLife — اختبارات تنفيذ الاستيراد
 *
 * ثلاث قواعد تُحرَس:
 *
 *  1. **عبر الخدمات لا فوقها** — فالذكرى تأتي بكتلة نصّها الأصلي،
 *     والسكريبت بنسخته الأولى، والتعبير بظهوره. صفٌّ ناقصٌ بصمت
 *     يبدو سليمًا حتى تفتحه.
 *  2. **إمّا كلّه وإمّا لا شيء** — فشلٌ في المنتصف يتراجع عن كل ما
 *     كتبه، ولا يمسّ صفًّا كان موجودًا قبله.
 *  3. **التقرير يقول ما حدث** لا ما نويناه — يُبنى من الدفتر.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventTypes, eventThreads, scripts, scriptVersions,
  contentBlocks, conversations, conversationParts, mistakeComparisons,
  expressions, expressionOccurrences, relationships,
} from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { createScene, getScene } from '../js/services/scene-service.js';
import { addPerson } from '../js/services/person-service.js';
import { resetTypes } from '../js/services/type-service.js';
import { createThread, threadsOfScene, threadScenes, THREAD_STATUS } from '../js/services/thread-service.js';
import { addExpression, listConversationParts } from '../js/services/content-service.js';
import { parsePackage } from '../js/services/import/parse.js';
import { planImport, decide, ACTION } from '../js/services/import/plan.js';
import { applyImport } from '../js/services/import/apply.js';

const REPOS = [
  scenes, people, eventThreads, scripts, scriptVersions, contentBlocks,
  conversations, conversationParts, mistakeComparisons, expressions,
  expressionOccurrences, relationships,
];

async function fresh() {
  await openDB();
  for (const repo of REPOS) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

/** لقطة أعداد كل المستودعات — لإثبات أن التراجع لم يترك شيئًا. */
async function census() {
  const out = {};
  for (const repo of [...REPOS, eventTypes]) {
    out[repo.storeName] = (await repo.getAll()).length;
  }
  return out;
}

async function planOf(raw) {
  const { pkg, ok, issues } = parsePackage({
    scene: { title: 'اجتماع الشحنة', date: '2026-04-01' },
    ...raw,
  });
  if (!ok) throw new Error(`الحزمة التجريبية غير صالحة: ${issues[0]?.message}`);
  return planImport(pkg);
}

/** حزمة كاملة تلمس كل نوعٍ مدعوم. */
const FULL = {
  scene: { title: 'اجتماع الشحنة', date: '2026-04-01', type: 'اجتماع شغل', place: 'المكتب' },
  eventThread: { title: 'شحنة أبريل' },
  people: [{ name: 'إيجور', role: 'مدير' }],
  scripts: [{ title: 'الافتتاح', text: 'Добрый день', translation: 'يوم سعيد' }],
  conversationParts: [
    { speaker: 'إيجور', text: 'Когда груз?', translation: 'إمتى الشحنة؟' },
    { isMe: true, text: 'В пятницу', translation: 'يوم الجمعة' },
  ],
  mistakes: [{ wrong: 'я идти', natural: 'я иду', kind: 'grammar' }],
  expressions: [{ text: 'по итогам', meaningAr: 'بناءً على النتائج' }],
};

/* ================================================================== */

describe('التنفيذ — الحزمة الكاملة', () => {
  it('يكتب كل نوعٍ مدعوم مرّةً واحدة', async () => {
    await fresh();
    const report = await applyImport(await planOf(FULL));

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(null);
    expect(report.written.scene).toBe(1);
    expect(report.written.person).toBe(1);
    expect(report.written.eventThread).toBe(1);
    expect(report.written.script).toBe(1);
    expect(report.written.conversationPart).toBe(2);
    expect(report.written.mistake).toBe(1);
    expect(report.written.expression).toBe(1);
  });

  it('الذكرى تأتي بنوعها ومكانها وتاريخها', async () => {
    await fresh();
    const report = await applyImport(await planOf(FULL));
    const scene = await getScene(report.sceneId);

    expect(scene.titleAr).toBe('اجتماع الشحنة');
    expect(scene.date).toBe('2026-04-01');
    expect(scene.type).toBe('meeting');
    // ⚠️ الحقلان معًا دورةً كاملة — قارئٌ من أي جيلٍ يجد قيمة.
    expect(scene.eventTypeId).toBe('meeting');
    expect(scene.placeName).toBe('المكتب');
  });

  it('⚠️ عبر الخدمات: الذكرى تأتي بكتلة نصّها الأصلي', async () => {
    await fresh();
    const report = await applyImport(await planOf(FULL));
    const blocks = await contentBlocks.byIndex('sceneId', report.sceneId);
    expect(blocks.some((b) => b.kind === 'rawTranscript')).toBe(true);
  });

  it('⚠️ عبر الخدمات: السكريبت يأتي بنسخته الأولى في التاريخ', async () => {
    await fresh();
    const report = await applyImport(await planOf(FULL));
    const [script] = await scripts.getAll();
    const versions = await scriptVersions.byIndex('scriptId', script.id);
    expect(versions.length).toBe(1);
    expect(versions[0].text).toBe('Добрый день');
    expect(script.isPrimary).toBe(1);
  });

  it('⚠️ عبر الخدمات: التعبير يأتي بظهورٍ في الذكرى', async () => {
    await fresh();
    const report = await applyImport(await planOf(FULL));
    const occurrences = await expressionOccurrences.byIndex('sceneId', report.sceneId);
    expect(occurrences.length).toBe(1);
  });

  it('المحادثة تُنسب لصاحبها ويبقى الاسم كما قيل', async () => {
    await fresh();
    const report = await applyImport(await planOf(FULL));
    const parts = await listConversationParts(report.sceneId);
    const [igor, mine] = parts;

    expect(igor.speaker).toBe('إيجور');
    expect(Boolean(igor.personId)).toBe(true);
    const person = await people.get(igor.personId);
    expect(person.name).toBe('إيجور');

    expect(mine.isMine).toBe(1);
    expect(mine.personId).toBe(null);
  });

  it('الذكرى تدخل الخيط بعلاقةٍ لا بحقل', async () => {
    await fresh();
    const report = await applyImport(await planOf(FULL));
    const threads = await threadsOfScene(report.sceneId);
    expect(threads.length).toBe(1);
    expect(threads[0].title).toBe('شحنة أبريل');

    const scene = await scenes.get(report.sceneId);
    expect(scene.threadId).toBe(undefined);
  });
});

describe('التنفيذ — لا إنشاء لما هو موجود', () => {
  it('الشخص المطابق يُستعمَل ولا يُنسَخ', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const report = await applyImport(await planOf(FULL));

    expect(report.written.person).toBe(undefined);
    expect(report.reused.person).toBe(1);
    expect((await people.getAll()).length).toBe(1);

    const parts = await listConversationParts(report.sceneId);
    expect(parts[0].personId).toBe(igor.id);
  });

  it('النوع المدمج يُستعمَل ولا يُنشَأ نوعٌ ثانٍ باسمه', async () => {
    await fresh();
    const before = (await eventTypes.getAll()).length;
    await applyImport(await planOf(FULL));
    expect((await eventTypes.getAll()).length).toBe(before);
  });

  it('الخيط الموجود يُستعمَل والذكرى تُضاف له', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const report = await applyImport(await planOf(FULL));

    expect((await eventThreads.getAll()).length).toBe(1);
    const inThread = await threadScenes(thread.id);
    expect(inThread.length).toBe(1);
    expect(inThread[0].id).toBe(report.sceneId);
  });

  it('التعبير الموجود يأخذ ظهورًا جديدًا لا نسخةً ثانية', async () => {
    await fresh();
    const old = await createScene({ titleAr: 'قديمة', type: 'other', date: '2025-01-01' });
    const { expression } = await addExpression(old.id, { text: 'по итогам' });

    const report = await applyImport(await planOf(FULL));
    expect((await expressions.getAll()).length).toBe(1);
    const all = await expressionOccurrences.byIndex('expressionId', expression.id);
    expect(all.length).toBe(2);
  });

  /*
   * ⚠️ منشأ الظهور *(بند 38)*: كان `sourceType` يُكتب `'manual'`
   *    للمسارات الثلاثة كلها، فتعبيرٌ جاء في حزمةٍ يقول «كتبته بإيدك».
   */
  it('الظهور المستورَد يُنسَب إلى الاستيراد لا إليك', async () => {
    await fresh();
    await applyImport(await planOf(FULL));

    const [row] = await expressionOccurrences.getAll();
    expect(row.sourceType).toBe('import');
  });

  it('جملة المثال في الحزمة تصير اقتباس الظهور', async () => {
    await fresh();
    const pack = structuredClone(FULL);
    pack.expressions[0].example = 'По итогам переговоров подписали.';

    await applyImport(await planOf(pack));
    const [row] = await expressionOccurrences.getAll();
    expect(row.sourceQuote).toBe('По итогам переговоров подписали.');
  });

  it('حزمةٌ قديمة بلا مثال تمرّ بلا اقتباس ولا تسقط', async () => {
    await fresh();
    await applyImport(await planOf(FULL));
    const [row] = await expressionOccurrences.getAll();
    expect(row.sourceQuote).toBe('');
    expect(row.sourceType).toBe('import');
  });
});

describe('التنفيذ — الاستبعاد', () => {
  it('ما استبعدته لا يُكتب', async () => {
    await fresh();
    let plan = await planOf(FULL);
    plan = decide(plan, 'expressions.0', { include: false });
    plan = decide(plan, 'mistakes.0', { include: false });

    const report = await applyImport(plan);
    expect(report.written.expression).toBe(undefined);
    expect(report.written.mistake).toBe(undefined);
    expect(report.excluded).toBe(2);
    expect((await expressions.getAll()).length).toBe(0);
    expect((await mistakeComparisons.getAll()).length).toBe(0);
  });

  it('محادثةٌ مستبعَدة كلها لا تُنشئ محادثةً فارغة', async () => {
    await fresh();
    let plan = await planOf(FULL);
    plan = decide(plan, 'conversationParts.0', { include: false });
    plan = decide(plan, 'conversationParts.1', { include: false });

    await applyImport(plan);
    expect((await conversations.getAll()).length).toBe(0);
  });

  it('المتحدّث غير المُحدَّد لا يُنشَأ ويبقى اسمه نصًّا', async () => {
    await fresh();
    const report = await applyImport(await planOf({
      conversationParts: [{ speaker: 'مارينا', text: 'Привет' }],
    }));

    expect((await people.getAll()).length).toBe(0);
    const [part] = await listConversationParts(report.sceneId);
    // ⚠️ لا شيء يضيع: الاسم محفوظ، والربط ممكن لاحقًا.
    expect(part.speaker).toBe('مارينا');
    expect(part.personId).toBe(null);
  });

  it('وإن حدّدته أُنشئ ونُسب إليه', async () => {
    await fresh();
    let plan = await planOf({ conversationParts: [{ speaker: 'مارينا', text: 'Привет' }] });
    plan = decide(plan, 'speakers.0', { include: true });

    const report = await applyImport(plan);
    expect((await people.getAll()).length).toBe(1);
    const [part] = await listConversationParts(report.sceneId);
    expect(Boolean(part.personId)).toBe(true);
  });
});

describe('التنفيذ — الإلحاق بذكرى موجودة', () => {
  it('يكتب في الذكرى المختارة ولا يُنشئ ذكرى ثانية', async () => {
    await fresh();
    const target = await createScene({ titleAr: 'اجتماع الشحنة', type: 'other', date: '2026-04-01' });

    let plan = await planOf(FULL);
    plan = decide(plan, 'scene', { action: ACTION.ATTACH, targetId: target.id });
    const report = await applyImport(plan);

    expect(report.sceneId).toBe(target.id);
    expect((await scenes.getAll()).length).toBe(1);
    expect((await listConversationParts(target.id)).length).toBe(2);
  });

  it('⚠️ لا يمحو محادثةً سابقة في الذكرى الملحَق بها عند التراجع', async () => {
    await fresh();
    const target = await createScene({ titleAr: 'اجتماع الشحنة', type: 'other', date: '2026-04-01' });
    const { addConversationPart } = await import('../js/services/content-service.js');
    await addConversationPart(target.id, { speaker: 'قديم', text: 'كلام سابق' });

    let plan = await planOf(FULL);
    plan = decide(plan, 'scene', { action: ACTION.ATTACH, targetId: target.id });
    // نُفسد التعبير فيفشل الاستيراد بعد كتابة المحادثة.
    plan.expressions[0].data.text = '';

    const report = await applyImport(plan);
    expect(report.ok).toBe(false);
    expect(report.rolledBack).toBe(true);

    // المحادثة السابقة سليمة، والمستوردة اختفت.
    const parts = await listConversationParts(target.id);
    expect(parts.length).toBe(1);
    expect(parts[0].text).toBe('كلام سابق');
    expect((await conversations.getAll()).length).toBe(1);
  });

  it('ذكرى مُلحَق بها اختفت: يفشل ولا يكتب أيتامًا', async () => {
    await fresh();
    const target = await createScene({ titleAr: 'اجتماع الشحنة', type: 'other', date: '2026-04-01' });
    let plan = await planOf(FULL);
    plan = decide(plan, 'scene', { action: ACTION.ATTACH, targetId: target.id });
    await scenes.destroy(target.id);

    const report = await applyImport(plan);
    expect(report.ok).toBe(false);
    expect((await conversationParts.getAll()).length).toBe(0);
    expect((await people.getAll()).length).toBe(0);
  });
});

describe('التنفيذ — إمّا كلّه وإمّا لا شيء', () => {
  it('⚠️ فشلٌ في المنتصف يتراجع عن كل ما كُتب', async () => {
    await fresh();
    const before = await census();

    const plan = await planOf(FULL);
    // التعبير آخر ما يُكتب — فوقتها تكون الذكرى والشخص والخيط
    // والسكريبت والمحادثة والتصحيح كلها على القرص.
    plan.expressions[0].data.text = '';

    const report = await applyImport(plan);
    expect(report.ok).toBe(false);
    expect(report.rolledBack).toBe(true);
    expect(Boolean(report.failed)).toBe(true);
    // التقرير يقول ما مُحي — لا يسكت عنه.
    expect(report.undone.scene).toBe(1);

    expect(await census()).toEqual(before);
  });

  it('التراجع لا يمسّ شخصًا كان موجودًا قبل الاستيراد', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });

    const plan = await planOf(FULL);
    plan.expressions[0].data.text = '';
    await applyImport(plan);

    const still = await people.get(igor.id);
    expect(Boolean(still)).toBe(true);
    expect(still.state).toBe(STATE.ACTIVE);
  });

  it('التراجع لا يمسّ تعبيرًا كان موجودًا، ويعيد معناه كما كان', async () => {
    await fresh();
    const old = await createScene({ titleAr: 'قديمة', type: 'other', date: '2025-01-01' });
    const { expression } = await addExpression(old.id, { text: 'по итогам' });
    expect(expression.meaningAr).toBe('');

    const plan = await planOf({
      ...FULL,
      // تعبيرٌ ثانٍ يُفسَد بعد التخطيط، فيفشل الاستيراد **بعد** أن يملأ
      // الأوّل المعنى.
      expressions: [
        { text: 'по итогам', meaningAr: 'بناءً على النتائج' },
        { text: 'в двух словах' },
      ],
    });
    plan.expressions[1].data.text = '';

    const report = await applyImport(plan);
    expect(report.ok).toBe(false);

    const after = await expressions.get(expression.id);
    expect(Boolean(after)).toBe(true);
    // ⚠️ المعنى الذي كتبه الاستيراد يُمحى معه — الصفّ يعود كما كان.
    expect(after.meaningAr).toBe('');
    const occurrences = await expressionOccurrences.byIndex('expressionId', expression.id);
    expect(occurrences.length).toBe(1);
  });

  it('التراجع لا يترك نسخ السكريبت ولا كتل النصّ يتيمة', async () => {
    await fresh();
    const plan = await planOf(FULL);
    plan.expressions[0].data.text = '';
    await applyImport(plan);

    expect((await scriptVersions.getAll()).length).toBe(0);
    expect((await contentBlocks.getAll()).length).toBe(0);
    expect((await relationships.getAll()).length).toBe(0);
  });
});

describe('التنفيذ — التقرير', () => {
  it('يحمل ما لا يستوعبه التطبيق بأسبابه', async () => {
    await fresh();
    const { pkg } = parsePackage({
      scene: { title: 'اجتماع' },
      words: [{ text: 'слово' }],
      journeys: [{ name: 'رحلة' }],
    });
    const report = await applyImport(await planImport(pkg), pkg);

    expect(report.cannotAbsorb.length).toBe(2);
    for (const item of report.cannotAbsorb) expect(item.reason.length > 10).toBe(true);
  });

  it('بيانات التحليل في التقرير لا في القاعدة', async () => {
    await fresh();
    const { pkg } = parsePackage({
      scene: { title: 'اجتماع' },
      analysisMetadata: { model: 'خارجي', at: '2026-04-01' },
    });
    const report = await applyImport(await planImport(pkg), pkg);

    expect(report.analysisMetadata.model).toBe('خارجي');
    const scene = await scenes.get(report.sceneId);
    expect(scene.analysisMetadata).toBe(undefined);
  });

  it('قيمةٌ مجهولة تُردّ لافتراضيّها ويُعلَن ذلك', async () => {
    await fresh();
    const report = await applyImport(await planOf({
      mistakes: [{ wrong: 'я идти', natural: 'я иду', kind: 'زحلقة' }],
      expressions: [{ text: 'по итогам', register: 'شِعري' }],
    }));

    expect(report.ok).toBe(true);
    expect(report.notes.length).toBe(2);
    const [mistake] = await mistakeComparisons.getAll();
    expect(mistake.mistakeType).toBe('other');
    const [expression] = await expressions.getAll();
    expect(expression.register).toBe('professional');
  });

  it('الأعداد من الدفتر لا من الخطّة', async () => {
    await fresh();
    let plan = await planOf(FULL);
    plan = decide(plan, 'scripts.0', { include: false });

    const report = await applyImport(plan);
    // الخطّة فيها سكريبت، والمكتوب صفر — والتقرير يقول المكتوب.
    expect(plan.scripts.length).toBe(1);
    expect(report.written.script).toBe(undefined);
    expect((await scripts.getAll()).length).toBe(0);
  });
});

describe('التنفيذ — حالة الخيط الموجود', () => {
  it('⚠️ لا تُغيَّر بحزمة — لكن الاختلاف يُقال', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });

    const report = await applyImport(await planOf({
      eventThread: { title: 'شحنة أبريل', status: 'resolved' },
    }));

    // الحالة كما هي: إقفال قضيّةٍ لأن ملفًّا قال ذلك خارج ما وافقتَ عليه.
    const after = await eventThreads.get(thread.id);
    expect(after.status).toBe(THREAD_STATUS.ACTIVE);
    // ولا صمت: الصمت يجعلك تحسبها مقفولة وهي مفتوحة.
    expect(report.notes.some((n) => n.includes('شحنة أبريل'))).toBe(true);
  });

  it('حالةٌ مطابقة لا تُنتج تنبيهًا', async () => {
    await fresh();
    await createThread({ title: 'شحنة أبريل' });
    const report = await applyImport(await planOf({
      eventThread: { title: 'شحنة أبريل', status: 'active' },
    }));
    expect(report.notes.length).toBe(0);
  });

  it('خيطٌ جديد يأخذ حالة الحزمة كما هي', async () => {
    await fresh();
    await applyImport(await planOf({
      eventThread: { title: 'خيط جديد', status: 'resolved' },
    }));
    const [thread] = await eventThreads.getAll();
    expect(thread.status).toBe(THREAD_STATUS.RESOLVED);
  });
});

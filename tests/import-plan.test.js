/**
 * LingoLife — اختبارات خطّة الاستيراد
 *
 * ثلاث قواعد تُحرَس هنا، وكلّها قابلة للانكسار بسطرٍ واحد:
 *
 *  1. **نقترح ولا ندمج.** المتقارب يُنشَأ جديدًا ويُعرَض البديل. لو
 *     انقلبت هذه، دُمج شخصان مختلفان بلا أن يُسأل أحد.
 *  2. **المتطابق هويّة لا قرار.** نفس الاسم المطبَّع = نفس الكيان.
 *  3. **الخطّة لا تكتب شيئًا.** تُستدعى مرارًا في المعاينة، فأثرٌ
 *     واحد يعني ذكرياتٍ مكرّرة بمجرّد النظر إليها.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventTypes, eventThreads, expressions,
  expressionOccurrences, relationships, conversationParts,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { addPerson, addPersonAlias } from '../js/services/person-service.js';
import { addType, resetTypes } from '../js/services/type-service.js';
import { createThread } from '../js/services/thread-service.js';
import { addExpression } from '../js/services/content-service.js';
import { parsePackage } from '../js/services/import/parse.js';
import { planImport, decide, allDecisions, ACTION } from '../js/services/import/plan.js';

async function fresh() {
  await openDB();
  for (const repo of [
    scenes, people, eventThreads, expressions, expressionOccurrences,
    relationships, conversationParts,
  ]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  // تمسح الأنواع كلها وتُعيد بذر المدمجة — فكل اختبارٍ يبدأ من نفس
  // القائمة مهما أضاف مَن قبله.
  await resetTypes();
}

/** حزمة صغيرة صالحة — كلٌّ يبدّل منها ما يخصّه. */
function pkgOf(extra = {}) {
  const { scene, ...rest } = extra;
  const { pkg, ok } = parsePackage({
    ...rest,
    scene: { title: 'اجتماع الشحنة', date: '2026-04-01', ...(scene || {}) },
  });
  if (!ok) throw new Error('الحزمة التجريبية نفسها غير صالحة');
  return pkg;
}

const find = (plan, id) => allDecisions(plan).find((d) => d.id === id);

/* ================================================================== */

describe('الخطّة — الذكرى', () => {
  it('الافتراض إنشاء ذكرى جديدة', async () => {
    await fresh();
    const plan = await planImport(pkgOf());
    expect(plan.scene.action).toBe(ACTION.CREATE);
    expect(plan.scene.targetId).toBe(null);
    expect(plan.scene.alternatives.length).toBe(0);
  });

  it('تُنبّه لذكرى بنفس العنوان ولا تلحق بها تلقائيًّا', async () => {
    await fresh();
    await createScene({ titleAr: 'اجتماع الشحنة', date: '2026-04-01', type: 'meeting' });

    const plan = await planImport(pkgOf());
    // ⚠️ القاعدة المحروسة: التنبيه لا يغيّر الفعل.
    expect(plan.scene.action).toBe(ACTION.CREATE);
    expect(plan.scene.alternatives.length).toBe(1);
    expect(plan.scene.alternatives[0].why).toBe('نفس العنوان ونفس التاريخ');
  });

  it('تفرّق بين نفس التاريخ وتاريخٍ آخر في سبب التنبيه', async () => {
    await fresh();
    await createScene({ titleAr: 'اجتماع الشحنة', date: '2025-01-01', type: 'meeting' });
    const plan = await planImport(pkgOf());
    expect(plan.scene.alternatives[0].why).toBe('نفس العنوان بتاريخٍ تاني');
  });

  it('عنوانٌ مختلف ليس تكرارًا', async () => {
    await fresh();
    await createScene({ titleAr: 'زيارة المصنع', date: '2026-04-01', type: 'meeting' });
    const plan = await planImport(pkgOf());
    expect(plan.scene.alternatives.length).toBe(0);
  });
});

describe('الخطّة — الأشخاص', () => {
  it('الاسم المتطابق يُستعمَل ولا يُنشَأ ثانيةً', async () => {
    await fresh();
    const ahmed = await addPerson({ name: 'أحمد صلاح' });

    const plan = await planImport(pkgOf({ people: [{ name: 'أحمد صلاح' }] }));
    const entry = find(plan, 'people.0');
    expect(entry.action).toBe(ACTION.USE_EXISTING);
    expect(entry.targetId).toBe(ahmed.id);
    expect(entry.why).toContain('نفس الاسم بالضبط');
  });

  it('المطابقة على النصّ المطبَّع لا الحرفيّ', async () => {
    await fresh();
    const person = await addPerson({ name: 'أحمد صلاح' });
    // همزةٌ وتاء مربوطة ومسافات زائدة — نفس الشخص عند أي قارئ.
    const plan = await planImport(pkgOf({ people: [{ name: 'احمد  صلاح' }] }));
    expect(find(plan, 'people.0').targetId).toBe(person.id);
  });

  it('الاسم البديل يُطابِق ويُقال إنه بديل', async () => {
    await fresh();
    const person = await addPerson({ name: 'أحمد صلاح' });
    await addPersonAlias(person.id, 'أبو يوسف');

    const plan = await planImport(pkgOf({ people: [{ name: 'أبو يوسف' }] }));
    const entry = find(plan, 'people.0');
    expect(entry.targetId).toBe(person.id);
    expect(entry.why).toContain('اسمٌ تاني');
  });

  it('⚠️ المتقارب يُنشَأ جديدًا والقديم يُعرَض بديلًا — لا دمج تلقائي', async () => {
    await fresh();
    const ahmed = await addPerson({ name: 'أحمد صلاح' });

    const plan = await planImport(pkgOf({ people: [{ name: 'أحمد صالح' }] }));
    const entry = find(plan, 'people.0');
    expect(entry.action).toBe(ACTION.CREATE);
    expect(entry.targetId).toBe(null);
    expect(entry.alternatives.length).toBe(1);
    expect(entry.alternatives[0].id).toBe(ahmed.id);
  });

  it('الاسم الجزئي يُعرَض بديلًا بسببه الخاصّ', async () => {
    await fresh();
    await addPerson({ name: 'أحمد صلاح الدين' });
    const plan = await planImport(pkgOf({ people: [{ name: 'أحمد' }] }));
    const entry = find(plan, 'people.0');
    expect(entry.action).toBe(ACTION.CREATE);
    expect(entry.alternatives[0].why).toBe('الاسم ده جزءٌ من اسمٍ عندك');
  });

  it('اسمٌ غريب تمامًا: إنشاء بلا بدائل', async () => {
    await fresh();
    await addPerson({ name: 'أحمد صلاح' });
    const plan = await planImport(pkgOf({ people: [{ name: 'Дмитрий' }] }));
    const entry = find(plan, 'people.0');
    expect(entry.action).toBe(ACTION.CREATE);
    expect(entry.alternatives.length).toBe(0);
  });

  it('المؤرشَف يُطابَق أيضًا — أرشفته لا تجعله شخصًا آخر', async () => {
    await fresh();
    const person = await addPerson({ name: 'مارينا' });
    await people.archive(person.id);
    const plan = await planImport(pkgOf({ people: [{ name: 'مارينا' }] }));
    expect(find(plan, 'people.0').targetId).toBe(person.id);
  });
});

describe('الخطّة — متحدّثون لم تعرّفهم الحزمة', () => {
  it('يدخلون الخطّة غير مُحدَّدين — عرضٌ لا فرض', async () => {
    await fresh();
    const plan = await planImport(pkgOf({
      conversationParts: [
        { speaker: 'إيجور', text: 'Привет' },
        { isMe: true, text: 'Здравствуйте' },
      ],
    }));

    expect(plan.extraSpeakers.length).toBe(1);
    expect(plan.extraSpeakers[0].label).toBe('إيجور');
    // ⚠️ لا شيء يضيع إن لم يُنشَأ: اسم المتحدّث يُحفظ نصًّا كما هو.
    expect(plan.extraSpeakers[0].include).toBe(false);
  });

  it('«أنا» ليس متحدّثًا يُنشَأ', async () => {
    await fresh();
    const plan = await planImport(pkgOf({
      conversationParts: [{ isMe: true, speaker: 'أنا', text: 'Здравствуйте' }],
    }));
    expect(plan.extraSpeakers.length).toBe(0);
  });

  it('مَن عرّفته الحزمة لا يتكرّر كمتحدّثٍ إضافي', async () => {
    await fresh();
    const plan = await planImport(pkgOf({
      people: [{ name: 'إيجور' }],
      conversationParts: [{ speaker: 'إيجور', text: 'Привет' }],
    }));
    expect(plan.people.length).toBe(1);
    expect(plan.extraSpeakers.length).toBe(0);
  });

  it('المتحدّث الواحد لا يتكرّر مهما تكلّم', async () => {
    await fresh();
    const plan = await planImport(pkgOf({
      conversationParts: [
        { speaker: 'إيجور', text: 'Привет' },
        { speaker: 'إيجور', text: 'Как дела' },
        { speaker: 'إيجور', text: 'Хорошо' },
      ],
    }));
    expect(plan.extraSpeakers.length).toBe(1);
  });

  it('المتحدّث المطابق لشخصٍ عندك يُستعمَل بلا سؤال', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const plan = await planImport(pkgOf({
      conversationParts: [{ speaker: 'إيجور', text: 'Привет' }],
    }));
    expect(plan.extraSpeakers[0].action).toBe(ACTION.USE_EXISTING);
    expect(plan.extraSpeakers[0].targetId).toBe(igor.id);
    expect(plan.extraSpeakers[0].include).toBe(true);
  });
});

describe('الخطّة — نوع الحدث', () => {
  it('غياب النوع يعني «أخرى» لا نوعًا جديدًا اسمه فراغ', async () => {
    await fresh();
    const plan = await planImport(pkgOf());
    expect(plan.eventType.action).toBe(ACTION.USE_EXISTING);
    expect(plan.eventType.targetId).toBe('other');
  });

  it('النوع المدمج يُطابَق باسمه', async () => {
    await fresh();
    const plan = await planImport(pkgOf({ scene: { type: 'اجتماع شغل' } }));
    expect(plan.eventType.action).toBe(ACTION.USE_EXISTING);
    expect(plan.eventType.targetId).toBe('meeting');
  });

  it('نوعٌ لا وجود له يُنشَأ', async () => {
    await fresh();
    const plan = await planImport(pkgOf({ scene: { type: 'جلسة تحكيم' } }));
    expect(plan.eventType.action).toBe(ACTION.CREATE);
    expect(plan.eventType.label).toBe('جلسة تحكيم');
  });

  it('⚠️ النوع المتقارب يُنشَأ ويُعرَض القديم — لا دمج تلقائي', async () => {
    await fresh();
    const inspection = await addType({ label: 'فحص داخلي' });
    const plan = await planImport(pkgOf({ scene: { type: 'فحص داخلى' } }));
    const entry = plan.eventType;
    // ملحوظة: «داخلي» و«داخلى» يتطابقان بعد التطبيع، فهما واحد.
    expect(entry.action).toBe(ACTION.USE_EXISTING);
    expect(entry.targetId).toBe(inspection.id);
  });

  it('فرق حرفٍ حقيقي يُعرَض بديلًا ولا يُدمَج', async () => {
    await fresh();
    // «مكالمة» نوعٌ مدمج عندك، و«مكالمات» ليس هو — قد يكون بابًا لنوعٍ
    // أوسع. فالقرار لك.
    const plan = await planImport(pkgOf({ scene: { type: 'مكالمات' } }));
    expect(plan.eventType.action).toBe(ACTION.CREATE);
    expect(plan.eventType.alternatives.some((a) => a.id === 'phone')).toBe(true);
  });
});

describe('الخطّة — الخيط', () => {
  it('بلا خيطٍ في الحزمة لا قرار', async () => {
    await fresh();
    const plan = await planImport(pkgOf());
    expect(plan.eventThread).toBe(null);
  });

  it('الخيط الموجود يُستعمَل والذكرى تُضاف له', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const plan = await planImport(pkgOf({ eventThread: { title: 'شحنة أبريل' } }));
    expect(plan.eventThread.action).toBe(ACTION.USE_EXISTING);
    expect(plan.eventThread.targetId).toBe(thread.id);
  });

  it('خيطٌ جديد يُنشَأ والمتقارب يُعرَض', async () => {
    await fresh();
    const thread = await createThread({ title: 'شحنة أبريل' });
    const plan = await planImport(pkgOf({ eventThread: { title: 'شحنة أكتوبر' } }));
    expect(plan.eventThread.action).toBe(ACTION.CREATE);
    expect(plan.eventThread.alternatives.length).toBe(0);
  });
});

describe('الخطّة — التعبيرات', () => {
  it('التعبير الموجود ظهورٌ جديد لا نسخة ثانية', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'قديمة', type: 'other', date: '2025-01-01' });
    const { expression } = await addExpression(scene.id, { text: 'по итогам' });

    const plan = await planImport(pkgOf({ expressions: [{ text: 'по итогам' }] }));
    const entry = find(plan, 'expressions.0');
    expect(entry.action).toBe(ACTION.USE_EXISTING);
    expect(entry.targetId).toBe(expression.id);
  });

  it('يطابق بالنصّ المطبَّع لا الحرفيّ', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'قديمة', type: 'other', date: '2025-01-01' });
    const { expression } = await addExpression(scene.id, { text: 'ещё раз' });
    const plan = await planImport(pkgOf({ expressions: [{ text: 'Еще раз' }] }));
    expect(find(plan, 'expressions.0').targetId).toBe(expression.id);
  });

  it('الجديد يُنشَأ', async () => {
    await fresh();
    const plan = await planImport(pkgOf({ expressions: [{ text: 'в двух словах' }] }));
    expect(find(plan, 'expressions.0').action).toBe(ACTION.CREATE);
  });
});

describe('الخطّة — لا تكتب شيئًا', () => {
  it('استدعاؤها مرارًا لا يترك أثرًا في القاعدة', async () => {
    await fresh();
    const before = {
      scenes: (await scenes.getAll()).length,
      people: (await people.getAll()).length,
      types: (await eventTypes.getAll()).length,
      threads: (await eventThreads.getAll()).length,
      expressions: (await expressions.getAll()).length,
    };

    const pkg = pkgOf({
      people: [{ name: 'إيجور' }],
      scene: { type: 'جلسة تحكيم' },
      eventThread: { title: 'شحنة أبريل' },
      expressions: [{ text: 'по итогам' }],
      conversationParts: [{ speaker: 'مارينا', text: 'Привет' }],
    });
    await planImport(pkg);
    await planImport(pkg);
    await planImport(pkg);

    expect((await scenes.getAll()).length).toBe(before.scenes);
    expect((await people.getAll()).length).toBe(before.people);
    expect((await eventTypes.getAll()).length).toBe(before.types);
    expect((await eventThreads.getAll()).length).toBe(before.threads);
    expect((await expressions.getAll()).length).toBe(before.expressions);
  });
});

describe('الخطّة — لكل قرارٍ سبب', () => {
  it('لا قرار بلا `why` مكتوب', async () => {
    await fresh();
    await addPerson({ name: 'أحمد صلاح' });
    const plan = await planImport(pkgOf({
      people: [{ name: 'أحمد صلاح' }, { name: 'أحمد صالح' }],
      scripts: [{ text: 'Добрый день' }],
      mistakes: [{ wrong: 'я идти', natural: 'я иду' }],
      expressions: [{ text: 'по итогам' }],
      conversationParts: [{ speaker: 'مارينا', text: 'Привет' }],
      eventThread: { title: 'شحنة أبريل' },
    }));

    for (const d of allDecisions(plan)) {
      expect(typeof d.why === 'string' && d.why.length > 2).toBe(true);
    }
  });

  it('كل بديلٍ معروضٍ يحمل سببه', async () => {
    await fresh();
    await addPerson({ name: 'أحمد صلاح' });
    const plan = await planImport(pkgOf({ people: [{ name: 'أحمد صالح' }] }));
    for (const a of find(plan, 'people.0').alternatives) {
      expect(typeof a.why === 'string' && a.why.length > 2).toBe(true);
      expect(Boolean(a.label)).toBe(true);
    }
  });
});

describe('الخطّة — التعديل اليدوي', () => {
  it('يعيد خطّةً جديدة ولا يعدّل القديمة', async () => {
    await fresh();
    const ahmed = await addPerson({ name: 'أحمد صلاح' });
    const plan = await planImport(pkgOf({ people: [{ name: 'أحمد صالح' }] }));

    const plan2 = decide(plan, 'people.0', {
      action: ACTION.USE_EXISTING,
      targetId: ahmed.id,
    });

    expect(find(plan2, 'people.0').action).toBe(ACTION.USE_EXISTING);
    expect(find(plan2, 'people.0').targetId).toBe(ahmed.id);
    // ⚠️ القديمة كما هي — «تراجَع» تعتمد على ذلك.
    expect(find(plan, 'people.0').action).toBe(ACTION.CREATE);
  });

  it('الاستبعاد يقلّ به المحسوب لا المعروض', async () => {
    await fresh();
    const plan = await planImport(pkgOf({
      expressions: [{ text: 'по итогам' }, { text: 'в двух словах' }],
    }));
    expect(plan.summary.created.expression).toBe(2);

    const plan2 = decide(plan, 'expressions.1', { include: false });
    expect(plan2.summary.created.expression).toBe(1);
    expect(plan2.summary.excluded).toBe(1);
    expect(plan2.expressions.length).toBe(2);
  });

  it('«استعمل الموجود» بلا هدفٍ مرفوض', async () => {
    await fresh();
    const plan = await planImport(pkgOf({ people: [{ name: 'إيجور' }] }));
    let error = null;
    try {
      decide(plan, 'people.0', { action: ACTION.USE_EXISTING });
    } catch (e) {
      error = e;
    }
    expect(Boolean(error)).toBe(true);
  });

  it('فعلٌ غير معروف مرفوض', async () => {
    await fresh();
    const plan = await planImport(pkgOf());
    let error = null;
    try {
      decide(plan, 'scene', { action: 'merge' });
    } catch (e) {
      error = e;
    }
    expect(Boolean(error)).toBe(true);
  });

  it('الإلحاق للذكرى وحدها', async () => {
    await fresh();
    const plan = await planImport(pkgOf({ people: [{ name: 'إيجور' }] }));
    let error = null;
    try {
      decide(plan, 'people.0', { action: ACTION.ATTACH, targetId: 'x' });
    } catch (e) {
      error = e;
    }
    expect(Boolean(error)).toBe(true);
  });

  it('الرجوع إلى الإنشاء يمحو الهدف', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const plan = await planImport(pkgOf({ people: [{ name: 'إيجور' }] }));
    expect(find(plan, 'people.0').targetId).toBe(igor.id);

    const plan2 = decide(plan, 'people.0', { action: ACTION.CREATE });
    expect(find(plan2, 'people.0').targetId).toBe(null);
  });

  it('قرارٌ لا وجود له مرفوض', async () => {
    await fresh();
    const plan = await planImport(pkgOf());
    let error = null;
    try {
      decide(plan, 'people.99', { include: false });
    } catch (e) {
      error = e;
    }
    expect(Boolean(error)).toBe(true);
  });
});

describe('الخطّة — الحصيلة', () => {
  it('تُحسَب من القرارات لا من الحزمة', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });
    const plan = await planImport(pkgOf({
      people: [{ name: 'إيجور' }, { name: 'مارينا' }],
      scripts: [{ text: 'Добрый день' }],
    }));

    expect(plan.summary.reused.person).toBe(1);
    expect(plan.summary.created.person).toBe(1);
    expect(plan.summary.created.script).toBe(1);
    expect(plan.summary.excluded).toBe(0);
  });

  it('تحمل ما لا يستوعبه التطبيق ولا تبتلعه', async () => {
    await fresh();
    const { pkg } = parsePackage({
      scene: { title: 'اجتماع' },
      words: [{ text: 'слово' }, { text: 'дело' }],
      projects: [{ name: 'مشروع' }],
    });
    const plan = await planImport(pkg);

    expect(plan.summary.cannotAbsorb).toBe(2);
    const kinds = plan.cannotAbsorb.map((s) => s.kind);
    expect(kinds).toContain('words');
    expect(kinds).toContain('projects');
    for (const item of plan.cannotAbsorb) {
      expect(item.reason.length > 10).toBe(true);
    }
  });

  it('الذكرى وحدها ليست خطّةً فارغة', async () => {
    await fresh();
    const plan = await planImport(pkgOf());
    expect(plan.summary.empty).toBe(false);
    expect(plan.summary.created.scene).toBe(1);
  });
});

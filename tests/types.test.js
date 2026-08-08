/**
 * LingoLife — اختبارات أنواع الذكريات
 *
 * تحرس ما يفقد المعنى بصمت: نوع مستعمَل يُحذف فتُصبح مشاهده بلا نوع،
 * أو اسمان متطابقان يتعايشان فلا تعرف أيّهما اخترت.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { settings, scenes } from '../js/db/repositories.js';
import {
  BUILT_IN,
  listTypes,
  typeTree,
  checkName,
  addType,
  updateType,
  archiveType,
  mergeInto,
  usageCount,
  resetTypes,
  primeTypes,
  typeLabel,
} from '../js/services/type-service.js';

/** يعيد الأنواع للحالة المدمجة قبل كل اختبار. */
async function fresh() {
  await openDB();
  await resetTypes();
}

describe('أنواع الذكريات — الأساس', () => {
  it('تبدأ بالأنواع المدمجة', async () => {
    await fresh();
    const list = await listTypes();
    // المؤرشفة (أنواع النسخة القديمة) لا تظهر افتراضيًّا.
    expect(list.length).toBe(BUILT_IN.filter((t) => !t.archived).length);
    expect(list.some((t) => t.id === 'inspection')).toBe(true);
  });

  it('أنواع النسخة القديمة مؤرشفة لكنها تُعرَّف باسمها', async () => {
    await fresh();
    await primeTypes();
    // مشهد قديم نوعه `work` لا يجوز أن يعرض معرّفًا خامًا.
    expect(typeLabel('work')).toBe('شغل');
    const visible = await listTypes();
    expect(visible.some((t) => t.id === 'work')).toBe(false);
  });

  it('تضيف نوعًا ويبقى بعد إعادة القراءة', async () => {
    await fresh();
    const added = await addType({ label: 'تسليم شحنة' });
    const list = await listTypes();
    expect(list.some((t) => t.id === added.id)).toBe(true);

    // القراءة من الإعدادات مباشرةً: الثبات في القاعدة لا في الذاكرة.
    const stored = await settings.get('scene.types', null);
    expect(stored.some((t) => t.label === 'تسليم شحنة')).toBe(true);
  });
});

describe('أنواع الذكريات — التفريع', () => {
  it('تُنشئ فرعًا تحت نوع موجود', async () => {
    await fresh();
    const child = await addType({ label: 'فحص داخلي', parentId: 'inspection' });
    const tree = await typeTree();
    const root = tree.find((t) => t.id === 'inspection');
    expect(root.children.map((c) => c.id)).toContain(child.id);
  });

  it('تسمية الفرع تحمل اسم أبيه', async () => {
    await fresh();
    const child = await addType({ label: 'فحص في الموقع', parentId: 'inspection' });
    await primeTypes();
    expect(typeLabel(child.id)).toBe('فحص › فحص في الموقع');
  });
});

describe('أنواع الذكريات — تعارض الأسماء', () => {
  it('ترفض اسمًا مكرَّرًا في نفس المستوى', async () => {
    await fresh();
    await addType({ label: 'تسليم شحنة' });
    let error = null;
    try {
      await addType({ label: 'تسليم شحنة' });
    } catch (err) {
      error = err;
    }
    expect(error !== null).toBe(true);
    expect(error.message).toContain('موجود بالفعل');
  });

  it('تكشف التعارض رغم اختلاف التشكيل والهمزات', async () => {
    await fresh();
    await addType({ label: 'فحص داخلي', parentId: 'inspection' });
    const { conflict } = await checkName('فحص داخلى', { parentId: 'inspection' });
    expect(conflict).toBe(true);
  });

  it('لا تعارض بين اسمين متطابقين تحت أبوين مختلفين', async () => {
    await fresh();
    await addType({ label: 'داخلي', parentId: 'inspection' });
    const { conflict } = await checkName('داخلي', { parentId: 'meeting' });
    // «داخلي» تحت «فحص» شيء، وتحت «اجتماع شغل» شيء آخر.
    expect(conflict).toBe(false);
  });

  it('تنبّه أن المتعارض مؤرشف بدل أن تقول موجود فقط', async () => {
    await fresh();
    const t = await addType({ label: 'ورشة' });
    await archiveType(t.id, true);
    let message = '';
    try {
      await addType({ label: 'ورشة' });
    } catch (err) {
      message = err.message;
    }
    expect(message).toContain('مؤرشف');
  });
});

describe('أنواع الذكريات — التعديل', () => {
  it('تعدّل نوعًا مدمجًا بلا فقدان معرّفه', async () => {
    await fresh();
    await updateType('inspection', { label: 'معاينة' });
    await primeTypes();
    // المعرّف هو ما تُخزّنه المشاهد؛ تغييره كان سيتيّهها.
    expect(typeLabel('inspection')).toBe('معاينة');
  });

  it('ترفض تعديلًا يخلق تعارضًا', async () => {
    await fresh();
    let error = null;
    try {
      await updateType('inspection', { label: 'دراسة' });
    } catch (err) {
      error = err;
    }
    expect(error !== null).toBe(true);
  });

  it('تسمح بحفظ النوع باسمه الحالي بلا اعتباره تعارضًا', async () => {
    await fresh();
    await updateType('inspection', { label: 'فحص' });
    await primeTypes();
    expect(typeLabel('inspection')).toBe('فحص');
  });
});

describe('أنواع الذكريات — الأرشفة والدمج', () => {
  it('الأرشفة تُخفي النوع وتُبقي مشاهده', async () => {
    await openDB();
    await resetTypes();
    const type = await addType({ label: 'زيارة مصنع' });
    const scene = await scenes.create({ titleAr: 'زيارة', type: type.id, date: '2026-01-01' });

    await archiveType(type.id, true);

    expect((await listTypes()).some((t) => t.id === type.id)).toBe(false);
    expect((await listTypes({ includeArchived: true })).some((t) => t.id === type.id)).toBe(true);
    // المشهد لم يُمَسّ: هذا هو الفرق بين الأرشفة والحذف.
    expect((await scenes.get(scene.id)).type).toBe(type.id);
  });

  it('الدمج ينقل المشاهد ثم يؤرشف المصدر', async () => {
    await openDB();
    await resetTypes();
    const from = await addType({ label: 'معاينة موقع' });
    const to = await addType({ label: 'زيارة موقع' });
    const a = await scenes.create({ titleAr: 'أ', type: from.id, date: '2026-01-01' });
    const b = await scenes.create({ titleAr: 'ب', type: from.id, date: '2026-01-02' });

    const moved = await mergeInto(from.id, to.id);

    expect(moved).toBe(2);
    expect((await scenes.get(a.id)).type).toBe(to.id);
    expect((await scenes.get(b.id)).type).toBe(to.id);
    expect((await listTypes()).some((t) => t.id === from.id)).toBe(false);
  });

  it('عدّ الاستعمال يشمل الفروع', async () => {
    await openDB();
    await resetTypes();
    const child = await addType({ label: 'فحص ليلي', parentId: 'inspection' });
    await scenes.create({ titleAr: 'أب', type: 'inspection', date: '2026-01-01' });
    await scenes.create({ titleAr: 'فرع', type: child.id, date: '2026-01-02' });

    // أرشفة الأب بلا معرفة أن فرعه مستعمَل تُخفي مشاهد الفرع من الاختيار.
    expect(await usageCount('inspection')).toBe(2);
    expect(await usageCount(child.id)).toBe(1);
  });
});

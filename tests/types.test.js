/**
 * LingoLife — اختبارات أنواع الذكريات
 *
 * تحرس ما يفقد المعنى بصمت: نوع مستعمَل يُحذف فتُصبح مشاهده بلا نوع،
 * أو اسمان متطابقان يتعايشان فلا تعرف أيّهما اخترت.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  wipeProbe as probeWipe, openAt as probeOpenAt, txDone, getAll,
} from './db-probe.js';
import { settings, scenes, eventTypes } from '../js/db/repositories.js';
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
  renameImpact,
  similarTypes,
  moveType,
  reorderTypes,
  addAlias,
  removeAlias,
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

    // القراءة من المستودع مباشرةً: الثبات في القاعدة لا في الذاكرة.
    // (كان يُقرأ من `settings['scene.types']` قبل ترقية v7.)
    const stored = await eventTypes.get(added.id);
    expect(stored.label).toBe('تسليم شحنة');
    expect(stored.normalizedName).toBe('تسليم شحنه');
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

/* ================================================================== *
 * ترقية v7 — الأنواع تصير كيانات
 *
 * ⚠️ أخطر ترقية في المشروع: كل ما قبلها **يضيف بجانب** بياناتك، وهذه
 *    أوّل واحدة تنقل معنًى قائمًا من مكان إلى مكان. فالاختبار هنا لا
 *    يستعمل الخدمة — يبني قاعدةً على v6 بيدٍ، فيها تخصيصاتٌ في
 *    `settings['scene.types']` ومشاهد تحملها، ثم يرقّيها ويسأل:
 *    هل بقي كل شيء؟
 * ================================================================== */

const PROBE_DB = 'v7-types-migration-probe';

// آلةُ القاعدة نفسها في `tests/db-probe.js` — يستعملها اختبار v10 كمان.
const wipeProbe = () => probeWipe(PROBE_DB);
const openAt = (version, options) => probeOpenAt(PROBE_DB, version, options);

describe('ترقية v7 — الأنواع تصير كيانات', () => {
  it('تنقل تخصيصاتك ولا تلمس ذكرياتك', async () => {
    await wipeProbe();

    // ── قاعدة v6 كما هي على جهازك: بلا `eventTypes` ──
    let db = await openAt(6, { skipStores: ['eventTypes'] });
    expect(db.objectStoreNames.contains('eventTypes')).toBe(false);

    const tx = db.transaction(['settings', 'scenes'], 'readwrite');
    tx.objectStore('settings').put({
      key: 'scene.types',
      value: [
        // تعديلٌ فوق مدمج بنفس المعرّف.
        { id: 'inspection', label: 'معاينة', parentId: null, builtIn: true },
        // نوعٌ أضفته أنت.
        { id: 'TAG_mine', label: 'تسليم شحنة', parentId: null, builtIn: false },
        // وفرعٌ تحته.
        { id: 'TAG_kid', label: 'تسليم مستعجل', parentId: 'TAG_mine', builtIn: false },
        // ومؤرشفٌ منك.
        { id: 'TAG_old', label: 'ورشة', parentId: null, builtIn: false, archived: true },
      ],
      updatedAt: Date.now(),
    });
    tx.objectStore('scenes').put({
      id: 'SC_probe', titleAr: 'ذكرى قبل الترقية', type: 'TAG_mine',
      state: 'active', date: '2026-02-02',
    });
    tx.objectStore('scenes').put({
      id: 'SC_builtin', titleAr: 'ذكرى بنوع مدمج', type: 'inspection',
      state: 'active', date: '2026-02-03',
    });
    await txDone(tx);
    db.close();

    // ── الترقية ──
    db = await openAt(7);
    expect(db.objectStoreNames.contains('eventTypes')).toBe(true);

    const types = await getAll(db, 'eventTypes');
    const byId = new Map(types.map((t) => [t.id, t]));

    // ① المدمجة موجودة **بمعرّفاتها نفسها** — وهي الحيلة التي تجعل
    //    `scene.type` صالحًا بلا كتابة بايتٍ في `scenes`.
    expect(byId.has('meeting')).toBe(true);
    expect(byId.has('inspection')).toBe(true);

    // ② تخصيصك يكتب فوق المدمج بنفس المعرّف.
    expect(byId.get('inspection').label).toBe('معاينة');
    expect(byId.get('inspection').builtIn).toBe(true);

    // ③ أنواعك المضافة انتقلت بفروعها.
    expect(byId.get('TAG_mine').label).toBe('تسليم شحنة');
    expect(byId.get('TAG_kid').parentId).toBe('TAG_mine');

    // ④ والمؤرشف بقي مؤرشفًا — لا يعود من الأرشيف صامتًا.
    expect(byId.get('TAG_old').state).toBe('archived');

    // ⑤ كل نوع له اسمٌ مطبَّع، وإلا فالفهرس لا يجده.
    for (const type of types) {
      if (!type.normalizedName) throw new Error(`${type.id} بلا normalizedName`);
    }

    const scenesAfter = await getAll(db, 'scenes');
    const probe = scenesAfter.find((s) => s.id === 'SC_probe');

    // ⑥ الذكرى لم تُمَسّ: `type` كما هو، و`eventTypeId` أُضيف بجانبه.
    expect(probe.titleAr).toBe('ذكرى قبل الترقية');
    expect(probe.type).toBe('TAG_mine');
    expect(probe.eventTypeId).toBe('TAG_mine');

    // ⑦ والكتلة القديمة **لم تُحذف** — شبكة الأمان للرجوع (بند 107).
    const legacy = await new Promise((res, rej) => {
      const r = db.transaction('settings', 'readonly').objectStore('settings').get('scene.types');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    expect(Array.isArray(legacy?.value)).toBe(true);
    expect(legacy.value.length).toBe(4);

    db.close();
    await wipeProbe();
  });

  it('قاعدةٌ بلا تخصيصات ترقّى بالمدمجة وحدها', async () => {
    await wipeProbe();
    let db = await openAt(6, { skipStores: ['eventTypes'] });
    db.close();

    db = await openAt(7);
    const types = await getAll(db, 'eventTypes');
    expect(types.length).toBe(BUILT_IN.length);
    // ولا شيء يُخترَع: العدد هو عدد البذور بالضبط.
    expect(types.filter((t) => t.builtIn).length).toBe(BUILT_IN.length);

    db.close();
    await wipeProbe();
  });

  it('إعادة تشغيل الترقية لا تكسر ولا تُضاعف', async () => {
    // ترقيةٌ تُعاد (استرجاع نسخة، أو تبديل شرائح القاعدة) يجب أن تكون
    // محايدة. البذر بـ`put` لا `add` هو ما يضمن ذلك.
    await wipeProbe();
    let db = await openAt(6, { skipStores: ['eventTypes'] });
    db.close();

    db = await openAt(7);
    const first = (await getAll(db, 'eventTypes')).length;
    db.close();

    db = await openAt(8);   // ترقيةٌ لاحقة تمرّ فوقها بلا أثر
    db.close();

    db = await openAt(9);
    const again = await getAll(db, 'eventTypes');
    expect(again.length).toBe(first);

    db.close();
    await wipeProbe();
  });
});

describe('أنواع الذكريات — تبعة التغيير (بند 10)', () => {
  it('تقول كم ذكرى قبل التغيير لا بعده', async () => {
    await openDB();
    await resetTypes();
    // نوعٌ خاصّ بهذا الاختبار: `inspection` تستعمله اختباراتٌ أخرى
    // تترك مشاهدها، فالعدّ عليه يقيس تاريخ الملفّ لا هذه الحالة.
    const type = await addType({ label: 'تسليم شحنة' });
    await scenes.create({ titleAr: 'أ', type: type.id, date: '2026-01-01' });
    await scenes.create({ titleAr: 'ب', type: type.id, date: '2026-01-02' });

    const impact = await renameImpact(type.id, 'تسليم بضاعة');
    expect(impact.from).toBe('تسليم شحنة');
    expect(impact.to).toBe('تسليم بضاعة');
    expect(impact.scenes).toBe(2);
    expect(impact.builtIn).toBe(false);
  });

  it('تعدّ الفروع لأنها تتبع أباها', async () => {
    await openDB();
    await resetTypes();
    await addType({ label: 'فحص ليلي', parentId: 'inspection' });
    expect((await renameImpact('inspection', 'معاينة')).children).toBe(1);
  });

  it('إعادة التسمية عامّة لأن المعرّف هو الهويّة (بند 9)', async () => {
    await openDB();
    await resetTypes();
    const scene = await scenes.create({ titleAr: 'أ', type: 'inspection', date: '2026-01-01' });

    await updateType('inspection', { label: 'معاينة' });
    await primeTypes();

    // الذكرى لم تُكتَب، ومع ذلك تعرض الاسم الجديد: هذا هو معنى أن
    // تحمل المعرّف لا الاسم.
    expect((await scenes.get(scene.id)).type).toBe('inspection');
    expect(typeLabel('inspection')).toBe('معاينة');
  });
});

describe('أنواع الذكريات — التشابه (بند 11)', () => {
  /*
   * ⚠️ لا يمكن اختبار «اسمان متطابقان بعد التطبيع»: كاشف التعارض
   *    يمنع إنشاءهما أصلًا. فما يبقى للتشابه هو ما يفترق **بعد**
   *    التطبيع — وهذا بالضبط تقسيم العمل بين الاثنين: التعارض يمنع
   *    المتطابق، والتشابه يقترح على المتقارب.
   */
  it('تكشف اسمين يفترقان بحرف', async () => {
    await openDB();
    await resetTypes();
    await addType({ label: 'تسليم شحنة' });
    await addType({ label: 'تسلم شحنة' });

    const pairs = await similarTypes();
    const hit = pairs.find((p) =>
      [p.a.label, p.b.label].sort().join('|') === ['تسليم شحنة', 'تسلم شحنة'].sort().join('|')
    );
    expect(Boolean(hit)).toBe(true);
    expect(hit.distance).toBe(1);
  });

  it('لا تعتبر التفريع تكرارًا', async () => {
    await openDB();
    await resetTypes();
    await addType({ label: 'فحص سريع' });
    // «فحص» و«فحص سريع»: الثاني تفريعٌ للأوّل لا نسخةٌ منه، والاقتراح
    // الصحيح له «انقله تحته» لا «ادمجهما».
    const pairs = await similarTypes();
    const wrong = pairs.find((p) =>
      [p.a.label, p.b.label].sort().join('|') === ['فحص', 'فحص سريع'].sort().join('|')
    );
    expect(wrong).toBe(undefined);
  });

  it('لا تخلط مستويين مختلفين', async () => {
    await openDB();
    await resetTypes();
    await addType({ label: 'داخلي', parentId: 'inspection' });
    await addType({ label: 'داخلى', parentId: 'meeting' });
    // متطابقان نصًّا، وتحت أبوين مختلفين — شيئان مختلفان فعلًا.
    const pairs = await similarTypes();
    expect(pairs.some((p) => p.a.label.startsWith('داخل') && p.b.label.startsWith('داخل'))).toBe(false);
  });

  it('اقتراحٌ لا فعل: لا تغيّر شيئًا في القاعدة', async () => {
    await openDB();
    await resetTypes();
    await addType({ label: 'ورشة' });
    await addType({ label: 'ورشات' });
    const before = (await listTypes({ includeArchived: true })).length;
    await similarTypes();
    expect((await listTypes({ includeArchived: true })).length).toBe(before);
  });
});

describe('أنواع الذكريات — النقل والترتيب والأسماء البديلة', () => {
  it('تنقل نوعًا تحت أبٍ آخر', async () => {
    await openDB();
    await resetTypes();
    const t = await addType({ label: 'زيارة مصنع' });
    await moveType(t.id, 'inspection');
    const tree = await typeTree();
    expect(tree.find((r) => r.id === 'inspection').children.some((c) => c.id === t.id)).toBe(true);
  });

  it('ترفض أن يصير النوع تحت نفسه', async () => {
    await openDB();
    await resetTypes();
    const t = await addType({ label: 'ورشة' });
    let error = null;
    try { await moveType(t.id, t.id); } catch (err) { error = err; }
    expect(error !== null).toBe(true);
  });

  // ⚠️ حلقةٌ في الشجرة تُجمّد `typeTree` — الفحص في الخدمة لا الواجهة.
  it('ترفض أن يصير النوع تحت أحد فروعه', async () => {
    await openDB();
    await resetTypes();
    const parent = await addType({ label: 'أب' });
    const child = await addType({ label: 'ابن', parentId: parent.id });
    let error = null;
    try { await moveType(parent.id, child.id); } catch (err) { error = err; }
    expect(error !== null).toBe(true);
    expect(error.message).toContain('فروعه');
  });

  it('الترتيب يُحفظ ويُقرأ', async () => {
    await openDB();
    await resetTypes();
    const a = await addType({ label: 'واحد' });
    const b = await addType({ label: 'اتنين' });
    await reorderTypes([b.id, a.id]);
    const list = await listTypes();
    expect(list.findIndex((t) => t.id === b.id) < list.findIndex((t) => t.id === a.id)).toBe(true);
  });

  it('الاسم البديل يُحسب في كشف التعارض', async () => {
    await openDB();
    await resetTypes();
    await addAlias('doctor', 'الكشف الطبّي');
    const { conflict, existing } = await checkName('الكشف الطبى');
    expect(conflict).toBe(true);
    expect(existing.id).toBe('doctor');
  });

  it('الاسم البديل يُشال', async () => {
    await openDB();
    await resetTypes();
    await addAlias('doctor', 'عيادة');
    await removeAlias('doctor', 'عيادة');
    expect((await checkName('عيادة')).conflict).toBe(false);
  });
});

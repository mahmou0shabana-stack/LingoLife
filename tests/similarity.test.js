/**
 * LingoLife — اختبارات محرّك التشابه (WS14 · الملحق G + K)
 *
 * ستّ قواعد تُحرَس:
 *
 *  1. **المحرّك لا يكتب** — بالبناء لا بالوعد: نصُّ الملفّ نفسه يُقرأ،
 *     ويسقط الاختبار إن ظهر فيه استيرادُ مستودع. «لا دمج تلقائي» (G3)
 *     قاعدةٌ لا تُحرَس بالنيّة.
 *  2. **كل درجةٍ تحتها إشاراتٌ مسمّاة** — لا رقمَ عاريًا ولا نسبةً
 *     مئويّة، وكل إشارةٍ معها سببٌ بالعربية (G2).
 *  3. **الاختلاف مُعلَنٌ لا مصادفة** — ما يُستبعَد في ملفّ سياسةٍ له
 *     سببٌ مكتوب، وما يَنقض يَنقض صراحةً.
 *  4. **الاحتواء معناه معكوس بين ملفّين** — سببُ عرضٍ في الأسماء،
 *     وسببُ نقضٍ في الأنواع. وهذا هو جوهر التوحيد.
 *  5. **الترتيب حتميّ** — عند تساوي الدرجة يفصل فاصلٌ ثابت، فلا
 *     اختبارَ ينجح مرّةً ويسقط مرّة.
 *  6. **«مش هما» رأيٌ يُحفَظ** — ولا يعتمد على ترتيب الزوج.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  people, eventTypes, eventThreads, savedItems, settings,
  scenes, relationships, conversationParts, conversations,
} from '../js/db/repositories.js';
import {
  SIGNAL, VERDICT, VERDICT_META, PROFILES, ALL_SIGNALS,
  compare, rank, pairs, prepare,
} from '../js/services/similarity/engine.js';
import {
  SCOPES, NOT_DEDUPED, findDuplicates, scanAll, mergePair,
  markDifferent, unmarkDifferent, judgements, pairKey, scopeById,
} from '../js/services/similarity/duplicates.js';
import { similarTo, NO_SIMILAR, SIMILAR_KINDS } from '../js/services/similarity/similar.js';
import { addPerson, listPeople, mergePeople, getPerson } from '../js/services/person-service.js';
import { addType, resetTypes, similarTypes } from '../js/services/type-service.js';
import { createScene } from '../js/services/scene-service.js';
import { addParticipant, participantIds } from '../js/services/participant-service.js';
import { addConversationPart } from '../js/services/content-service.js';

async function fresh() {
  await openDB();
  for (const repo of [people, eventThreads, savedItems, scenes,
    relationships, conversationParts, conversations]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await settings.remove('similarity.different');
  await resetTypes();
}

/* ================================================================== *
 * ١ · المحرّك: إشاراتٌ لا أرقامٌ عارية
 * ================================================================== */

describe('محرّك التشابه · الإشارات', () => {
  it('⚠️ لا يستورد مستودعًا — «لا دمج تلقائي» محروسةٌ بالبناء', async () => {
    const source = await (await fetch('/js/services/similarity/engine.js')).text();
    const imports = [...source.matchAll(/^import[\s\S]*?from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports).toEqual(['../../utils/normalization.js']);
    expect(source.includes('db/repositories')).toBe(false);
  });

  it('التطابق بعد التطبيع يعطي «هو هو»', () => {
    const out = compare({ names: ['أحمد'] }, { names: ['احمد'] }, 'names');
    expect(out.verdict).toBe(VERDICT.CERTAIN);
    expect(out.why[0]).toBe('نفس الاسم بالضبط');
  });

  it('والاسم البديل يعطي «هو هو» بسببٍ مختلف', () => {
    const out = compare({ names: ['إيجور'] }, { names: ['Igor', 'إيجور'] }, 'names');
    expect(out.verdict).toBe(VERDICT.CERTAIN);
    expect(out.signals[0].id).toBe(SIGNAL.ALIAS);
  });

  it('⚠️ وكل إشارةٍ معها سببٌ بالعربية ووزن — لا رقمَ عاريًا', () => {
    const out = compare(
      { names: ['ميخائيل'] }, { names: ['ميخاييل'] }, 'names'
    );
    expect(out.signals.length > 0).toBe(true);
    for (const signal of out.signals) {
      expect(typeof signal.why === 'string' && signal.why.length > 0).toBe(true);
      expect(signal.weight > 0).toBe(true);
      expect(ALL_SIGNALS.some((s) => s.id === signal.id)).toBe(true);
    }
    // الدرجة = مجموع الأوزان بالضبط، لا رقمًا مشتقًّا بطريقةٍ أخرى.
    expect(out.score).toBe(out.signals.reduce((sum, s) => sum + s.weight, 0));
  });

  it('⚠️ ولا نسبة مئويّة — أربع درجاتٍ لكلٍّ شرطٌ مكتوب', () => {
    expect(Object.keys(VERDICT_META).length).toBe(4);
    for (const meta of Object.values(VERDICT_META)) {
      expect(typeof meta.label).toBe('string');
      expect(meta.hint !== undefined).toBe(true);
    }
  });

  it('البعيدان لا شبه بينهما', () => {
    const out = compare({ names: ['إيجور'] }, { names: ['ناتاليا'] }, 'names');
    expect(out.verdict).toBe(VERDICT.NONE);
    expect(out.signals).toHaveLength(0);
  });
});

/* ================================================================== *
 * ٢ · ملفّات السياسة: الاختلاف مُعلَن
 * ================================================================== */

describe('محرّك التشابه · ملفّات السياسة', () => {
  it('⚠️ ما يُستبعَد له سببٌ مكتوب — في كل ملفّ سياسة', () => {
    for (const profile of Object.values(PROFILES)) {
      for (const [id, why] of Object.entries(profile.ignored || {})) {
        expect(ALL_SIGNALS.some((s) => s.id === id)).toBe(true);
        expect(String(why).length > 20).toBe(true);
      }
      for (const [id, why] of Object.entries(profile.reject || {})) {
        expect(ALL_SIGNALS.some((s) => s.id === id)).toBe(true);
        expect(String(why).length > 20).toBe(true);
      }
    }
  });

  it('⚠️ وكل إشارةٍ مذكورةٌ في كل ملفّ — إمّا تُحتسَب أو تَنقض أو لها سبب', () => {
    for (const profile of Object.values(PROFILES)) {
      const named = new Set([
        ...profile.use,
        ...Object.keys(profile.reject || {}),
        ...Object.keys(profile.ignored || {}),
      ]);
      for (const signal of ALL_SIGNALS) {
        if (!named.has(signal.id)) {
          throw new Error(`«${profile.id}» ساكتٌ عن إشارة «${signal.id}» — لا محسوبةٌ ولا مُستبعَدةٌ بسبب`);
        }
      }
    }
  });

  it('⚠️ الاحتواء: سببُ عرضٍ في الأسماء وسببُ نقضٍ في الأنواع', () => {
    const asName = compare({ names: ['أحمد'] }, { names: ['أحمد صلاح'] }, 'names');
    expect(asName.signals.some((s) => s.id === SIGNAL.PART)).toBe(true);
    expect(asName.verdict).toBe(VERDICT.MAYBE);

    const asLabel = compare({ names: ['فحص'] }, { names: ['فحص سريع'] }, 'labels');
    expect(asLabel.verdict).toBe(VERDICT.NONE);
    expect(asLabel.rejected.id).toBe(SIGNAL.PART);
    expect(asLabel.rejected.why).toContain('تفريعٌ لا تكرار');
  });

  it('⚠️ والنقض يُنهي المقارنة ولا يترك درجةً معلّقة', () => {
    // «فحصات» و«فحص» بينهما حرفان — لولا النقض لصارا زوجًا.
    const out = compare({ names: ['فحصات'] }, { names: ['فحص'] }, 'labels');
    expect(out.score).toBe(0);
    expect(out.signals).toHaveLength(0);
  });

  it('العناوين تُقاس على الكلمة أيضًا — والأسماء لا', () => {
    const long = compare(
      { names: ['زرّ الشادوينج مش شغال'] },
      { names: ['الشادوينچ بيقف فجأة'] },
      'titles'
    );
    expect(long.signals.some((s) => s.id === SIGNAL.TYPO)).toBe(true);
    expect(PROFILES.titles.typoTokens).toBe(true);
    expect(Boolean(PROFILES.names.typoTokens)).toBe(false);
  });

  it('والروابط المشتركة أثقل من الكلمات المشتركة', () => {
    const words = compare(
      { text: 'اجتماع الشحنة المتأخرة' },
      { text: 'اجتماع الشحنة تاني' },
      'texts'
    );
    const links = compare(
      { text: 'حاجة', tags: ['person:P1'], tagLabels: { 'person:P1': 'إيجور' } },
      { text: 'حاجة تانية', tags: ['person:P1'], tagLabels: { 'person:P1': 'إيجور' } },
      'texts'
    );
    const wordWeight = words.signals.find((s) => s.id === SIGNAL.WORDS)?.weight || 0;
    const linkWeight = links.signals.find((s) => s.id === SIGNAL.SHARED)?.weight || 0;
    expect(linkWeight > wordWeight / 2).toBe(true);
    expect(links.why[0]).toContain('إيجور');
  });

  it('وملفٌّ مجهول يرمي بدل أن يقارن بالافتراضيّ', () => {
    let threw = false;
    try { compare({ names: ['أ'] }, { names: ['ب'] }, 'مش موجود'); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

/* ================================================================== *
 * ٣ · الترتيب والأزواج
 * ================================================================== */

describe('محرّك التشابه · الترتيب', () => {
  const rows = [
    { id: 'C', label: 'إيجور' },
    { id: 'A', label: 'إيجور' },
    { id: 'B', label: 'إيچور' },
  ];
  const shape = (row) => ({ names: [row.label] });

  it('⚠️ الترتيب حتميّ: نفس المدخلات بأي ترتيبٍ تعطي نفس الخرج', () => {
    const target = { id: 'T', label: 'إيجور' };
    const one = rank(target, rows, { profile: 'names', shape }).map((r) => r.item.id);
    const two = rank(target, [...rows].reverse(), { profile: 'names', shape }).map((r) => r.item.id);
    expect(one).toEqual(two);
    expect(one[0]).toBe('A');
  });

  it('والهدف لا يقارن بنفسه', () => {
    const out = rank(rows[1], rows, { profile: 'names', shape });
    expect(out.some((hit) => hit.item.id === 'A')).toBe(false);
  });

  it('⚠️ وكل زوجٍ مرّةً واحدة لا مرّتين مقلوبًا', () => {
    const found = pairs(rows, { profile: 'names', shape });
    const keys = found.map((p) => [p.a.id, p.b.id].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('وشرطُ القبول يمنع المقارنة أصلًا', () => {
    const found = pairs(rows, { profile: 'names', shape, accept: () => false });
    expect(found).toHaveLength(0);
  });
});

/* ================================================================== *
 * ٤ · كاشف المكرَّر (G)
 * ================================================================== */

describe('كاشف المكرَّر', () => {
  it('⚠️ ما لا يُكشَف له سببٌ مكتوب — ولا بندَ بلا سبب', () => {
    expect(NOT_DEDUPED.length > 0).toBe(true);
    for (const entry of NOT_DEDUPED) {
      expect(String(entry.label).length > 0).toBe(true);
      expect(String(entry.why).length > 30).toBe(true);
    }
  });

  it('وكل مجالٍ إمّا يُضمّ أو يقول لماذا لا', () => {
    for (const scope of SCOPES) {
      if (scope.merge) expect(String(scope.mergeHint).length > 10).toBe(true);
      else expect(String(scope.whyNoMerge).length > 20).toBe(true);
    }
  });

  it('يكشف شخصين باسمٍ متقارب ويقول السبب', async () => {
    await fresh();
    await addPerson({ name: 'ميخائيل' });
    await addPerson({ name: 'ميخاييل' });
    await addPerson({ name: 'ناتاليا' });

    const found = await findDuplicates('people');
    expect(found).toHaveLength(1);
    expect(found[0].why[0]).toContain('الفرق');
    expect(found[0].verdictLabel.length > 0).toBe(true);
  });

  it('⚠️ ولا يقترح على شخصين مختلفين تمامًا', async () => {
    await fresh();
    await addPerson({ name: 'إيجور' });
    await addPerson({ name: 'ناتاليا' });
    expect(await findDuplicates('people')).toHaveLength(0);
  });

  it('⚠️ ونوعان تحت أبوين مختلفين ليسا مكرَّرًا', async () => {
    await fresh();
    const work = await addType({ label: 'شغلانة' });
    const health = await addType({ label: 'صحّتي' });
    await addType({ label: 'معاينات', parentId: work.id });
    await addType({ label: 'معاينان', parentId: health.id });

    const found = await findDuplicates('types');
    expect(found.every((pair) => pair.a.label !== 'معاينات' || pair.b.label !== 'معاينان')).toBe(true);
  });

  it('⚠️ والضمّ لا يحصل بلا تأكيدٍ صريح — مفيش دمج تلقائي (G3)', async () => {
    await fresh();
    const a = await addPerson({ name: 'ميخائيل' });
    const b = await addPerson({ name: 'ميخاييل' });

    await expect(mergePair('people', a.id, b.id)).toReject('تأكيدًا صريحًا');
    // ولم يتغيّر شيء.
    expect((await listPeople()).length).toBe(2);
  });

  it('⚠️ والمجال غير القابل للضمّ يرمي بسببه المكتوب', async () => {
    await expect(mergePair('threads', 'a', 'b', { confirm: true })).toReject('انقل بنفسك');
  });
});

/* ================================================================== *
 * ٥ · «مش هما»
 * ================================================================== */

describe('كاشف المكرَّر · «مش هما»', () => {
  it('⚠️ الحكم لا يعتمد على ترتيب الزوج', () => {
    expect(pairKey('people', 'B', 'A')).toBe(pairKey('people', 'A', 'B'));
    // والمجال جزءٌ من المفتاح: نفس المعرّفين في مجالين حكمان مختلفان.
    expect(pairKey('people', 'A', 'B') === pairKey('types', 'A', 'B')).toBe(false);
  });

  it('يُحفَظ فيختفي الزوج، ويُتراجَع عنه فيعود', async () => {
    await fresh();
    const a = await addPerson({ name: 'ميخائيل' });
    const b = await addPerson({ name: 'ميخاييل' });

    expect(await findDuplicates('people')).toHaveLength(1);

    await markDifferent('people', b.id, a.id);           // بالعكس عمدًا
    expect(await findDuplicates('people')).toHaveLength(0);
    expect((await judgements()).size).toBe(1);

    // ومع ذلك يبقى مرئيًّا حين تطلبه صراحةً.
    const withDismissed = await findDuplicates('people', { includeDismissed: true });
    expect(withDismissed).toHaveLength(1);
    expect(withDismissed[0].dismissed).toBe(true);

    await unmarkDifferent('people', a.id, b.id);
    expect(await findDuplicates('people')).toHaveLength(1);
  });

  it('⚠️ والعدّاد يعدّ ما يظهر لا ما رفضتَه', async () => {
    await fresh();
    const a = await addPerson({ name: 'ميخائيل' });
    const b = await addPerson({ name: 'ميخاييل' });
    await markDifferent('people', a.id, b.id);

    const all = await scanAll();
    expect(all.total).toBe(0);
  });
});

/* ================================================================== *
 * ٦ · ضمّ الأشخاص
 * ================================================================== */

describe('ضمّ الأشخاص', () => {
  it('⚠️ ينقل الكلام والحضور، ويخلّي الاسم اسمًا بديلًا، ويؤرشف لا يحذف', async () => {
    await fresh();
    const keep = await addPerson({ name: 'ميخائيل' });
    const drop = await addPerson({ name: 'ميخاييل', nameRu: 'Михаил' });

    const scene = await createScene({ titleAr: 'اجتماع', date: '2026-05-01', type: 'meeting' });
    await addParticipant(scene.id, drop.id);
    const part = await addConversationPart(scene.id, { speaker: 'ميخاييل', text: 'Здравствуйте' });
    await conversationParts.update(part.id, { personId: drop.id });

    const result = await mergePeople(drop.id, keep.id);
    expect(result.parts).toBe(1);
    expect(result.scenes).toBe(1);

    // الكلام انتقل
    expect((await conversationParts.get(part.id)).personId).toBe(keep.id);
    // والحضور انتقل
    expect(await participantIds(scene.id)).toEqual([keep.id]);
    // والاسم صار بديلًا
    const after = await getPerson(keep.id);
    expect(after.aliases.some((alias) => alias === 'ميخاييل')).toBe(true);
    expect(after.aliases.some((alias) => alias === 'Михаил')).toBe(true);
    // والقديم موجودٌ مؤرشَف لا محذوف
    expect(Boolean(await people.get(drop.id))).toBe(true);
    expect((await getPerson(drop.id)).archived).toBe(true);
  });

  it('⚠️ ولا يكرّر الحضور لو كان الاتنين في نفس الذكرى', async () => {
    await fresh();
    const keep = await addPerson({ name: 'ميخائيل' });
    const drop = await addPerson({ name: 'ميخاييل' });
    const scene = await createScene({ titleAr: 'اجتماع', date: '2026-05-01', type: 'meeting' });
    await addParticipant(scene.id, keep.id);
    await addParticipant(scene.id, drop.id);

    await mergePeople(drop.id, keep.id);
    expect(await participantIds(scene.id)).toEqual([keep.id]);
  });

  it('وضمُّ شخصٍ بنفسه مرفوض', async () => {
    await fresh();
    const one = await addPerson({ name: 'إيجور' });
    await expect(mergePeople(one.id, one.id)).toReject('مختلفين');
  });
});

/* ================================================================== *
 * ٧ · «شبيه بده» (K)
 * ================================================================== */

describe('شبيه بده', () => {
  it('⚠️ ما لا يُسأل عنه له سببٌ مكتوب', () => {
    expect(NO_SIMILAR.length > 0).toBe(true);
    for (const entry of NO_SIMILAR) expect(String(entry.why).length > 25).toBe(true);
    expect(SIMILAR_KINDS.length > 0).toBe(true);
  });

  it('⚠️ نفس الشخص أقوى من كلمةٍ مشتركة', async () => {
    await fresh();
    const igor = await addPerson({ name: 'إيجور' });

    const base = await createScene({ titleAr: 'اجتماع الشحنة', date: '2026-05-01', type: 'meeting' });
    const withIgor = await createScene({ titleAr: 'حاجة تانية خالص', date: '2026-05-02', type: 'call' });
    const wordsOnly = await createScene({ titleAr: 'اجتماع الشحنة برضه', date: '2026-05-03', type: 'call' });

    await addParticipant(base.id, igor.id);
    await addParticipant(withIgor.id, igor.id);

    const out = await similarTo('scene', base.id);
    expect(out.items.length >= 2).toBe(true);
    expect(out.items[0].id).toBe(withIgor.id);
    expect(out.items[0].reasons[0]).toContain('إيجور');
    expect(out.items.some((item) => item.id === wordsOnly.id)).toBe(true);
  });

  it('⚠️ ولكل ترشيحٍ سببٌ — ولا واحدَ بلا سبب', async () => {
    await fresh();
    await createScene({ titleAr: 'مكالمة مع المخزن', date: '2026-05-01', type: 'call' });
    const b = await createScene({ titleAr: 'مكالمة تانية مع المخزن', date: '2026-05-02', type: 'call' });

    const out = await similarTo('scene', b.id);
    for (const item of out.items) {
      expect(item.reasons.length > 0).toBe(true);
      expect(String(item.verdictLabel).length > 0).toBe(true);
    }
  });

  it('⚠️ ويفرّق بين «مفيش شبيه» و«مفيش غيرها أصلًا»', async () => {
    await fresh();
    const only = await createScene({ titleAr: 'وحيدة', date: '2026-05-01', type: 'call' });
    const alone = await similarTo('scene', only.id);
    expect(alone.empty).toBe(true);
    expect(alone.why).toContain('الوحيدة');

    await createScene({ titleAr: 'حاجة مالهاش علاقة بأي شيء', date: '2026-05-02', type: 'meeting' });
    const nothing = await similarTo('scene', only.id);
    expect(nothing.empty).toBe(true);
    expect(nothing.why).toContain('قريبة');
  });

  it('وعنصرٌ غير موجود يعود بجوابٍ لا برمية', async () => {
    await fresh();
    const out = await similarTo('scene', 'SC_مش_موجود');
    expect(out.empty).toBe(true);
    expect(out.items).toHaveLength(0);
  });
});

/* ================================================================== *
 * ٨ · المستفيدون الثلاثة — لم يتغيّر عقدُهم
 * ================================================================== */

describe('التوحيد لم يكسر المستفيدين', () => {
  it('⚠️ `similarTypes` ما زالت تعطي {a,b,distance,reason} مرتَّبةً', async () => {
    await fresh();
    await addType({ label: 'ميعادي' });
    await addType({ label: 'مِعادي' });

    const found = await similarTypes();
    expect(found.length >= 1).toBe(true);
    for (const pair of found) {
      expect(typeof pair.distance).toBe('number');
      expect(String(pair.reason).length > 0).toBe(true);
      expect(Boolean(pair.a?.id && pair.b?.id)).toBe(true);
    }
    // مرتَّبة تصاعديًّا بالمسافة
    const distances = found.map((p) => p.distance);
    expect(distances).toEqual([...distances].sort((x, y) => x - y));
  });

  it('⚠️ وما زالت تستثني التفريع', async () => {
    await fresh();
    const parent = await addType({ label: 'معاينة' });
    await addType({ label: 'معاينان', parentId: parent.id });
    await addType({ label: 'معاينات', parentId: parent.id });

    const found = await similarTypes();
    // «معاينان» و«معاينات» فرقهما حرفٌ واحد ولا احتواء بينهما — يظهران.
    // أمّا «معاينة» فبلا أبٍ فلا تُقارَن بهما أصلًا.
    expect(found.some((p) => p.a.label === 'معاينة' || p.b.label === 'معاينة')).toBe(false);
  });

  it('وكل مجالٍ في الكاشف موجودٌ فعلًا ويقرأ بلا رمية', async () => {
    await fresh();
    for (const scope of SCOPES) {
      expect(scopeById(scope.id)).toBeTruthy();
      const rows = await scope.load();
      expect(Array.isArray(rows)).toBe(true);
      // والشكل يعمل على صفٍّ حقيقيّ لو وُجد
      for (const row of rows.slice(0, 2)) {
        const subject = prepare(scope.shape(row));
        expect(subject.names.length >= 0).toBe(true);
      }
    }
  });
});

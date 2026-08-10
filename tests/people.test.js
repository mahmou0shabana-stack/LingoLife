/**
 * LingoLife — اختبارات الأشخاص
 *
 * القاعدة المحروسة هنا واحدة، وهي أهمّ ما في الملفّ:
 *
 *   **لا دمج تلقائي.** المطابقة بالتطبيع تقترح ولا تقرّر.
 *
 * لأن الخطأ هنا يخلط كلام رجلين — ولا يُكتشَف بعد شهر. «أليكسي»
 * و«Алексей» و«م. أليكسي» قد يكونون واحدًا وقد يكونون ثلاثة، وأنت
 * وحدك تعرف.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { people, conversationParts, scenes } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { addConversationPart, listConversationParts } from '../js/services/content-service.js';
import { createScene } from '../js/services/scene-service.js';
import {
  ME,
  PERSON_COLORS,
  addPerson,
  updatePerson,
  archivePerson,
  listPeople,
  getPerson,
  findByName,
  checkPersonName,
  addPersonAlias,
  removePersonAlias,
  assignSpeaker,
  suggestPerson,
  unlinkedSpeakers,
  linkSpeakerTo,
  personProfile,
  speakingCounts,
} from '../js/services/person-service.js';
import { speakerSelect, wireSpeakerSelect, readSpeaker } from '../js/components/speaker-select.js';

async function fresh() {
  await openDB();
  for (const row of await people.getAll()) await people.destroy(row.id);
  for (const row of await conversationParts.getAll()) await conversationParts.destroy(row.id);
}

describe('الأشخاص — الأساس', () => {
  it('تضيف شخصًا ويبقى بعد إعادة القراءة', async () => {
    await fresh();
    const person = await addPerson({ name: 'أليكسي', nameRu: 'Алексей', role: 'زميل' });
    const stored = await people.get(person.id);
    expect(stored.name).toBe('أليكسي');
    expect(stored.normalizedName).toBe('اليكسي');
    expect(stored.nameRu).toBe('Алексей');
  });

  it('تعطي لونًا افتراضيًّا فلا يتشابه متجاوران', async () => {
    await fresh();
    const a = await addPerson({ name: 'واحد' });
    const b = await addPerson({ name: 'اتنين' });
    expect(PERSON_COLORS.includes(a.color)).toBe(true);
    expect(a.color === b.color).toBe(false);
  });

  it('ترفض اسمًا مكرَّرًا', async () => {
    await fresh();
    await addPerson({ name: 'أليكسي' });
    let error = null;
    try { await addPerson({ name: 'اليكسى' }); } catch (err) { error = err; }
    // التطبيع يكشف الهمزة والياء: هما اسمٌ واحد.
    expect(error !== null).toBe(true);
  });

  it('الأرشفة تُخفيه ولا تحذفه', async () => {
    await fresh();
    const person = await addPerson({ name: 'أوليغ' });
    await archivePerson(person.id, true);
    expect((await listPeople()).some((p) => p.id === person.id)).toBe(false);
    expect((await listPeople({ includeArchived: true })).some((p) => p.id === person.id)).toBe(true);
    // ⚠️ الحذف يترك أجزاء محادثة بلا متحدّث؛ الأرشفة تُبقي كلامه منسوبًا.
    expect((await getPerson(person.id)).archived).toBe(true);
  });

  it('يُوجَد باسمه الروسي والعربي والبديل', async () => {
    await fresh();
    const person = await addPerson({ name: 'أليكسي', nameRu: 'Алексей', nameAr: 'اليكسي' });
    await addPersonAlias(person.id, 'م. أليكسي');

    expect((await findByName('Алексей')).id).toBe(person.id);
    expect((await findByName('م. اليكسى')).id).toBe(person.id);
    expect(await findByName('إيرينا')).toBe(null);
  });

  it('الاسم البديل لا يُسرق من صاحبه', async () => {
    await fresh();
    const a = await addPerson({ name: 'أليكسي' });
    const b = await addPerson({ name: 'إيرينا' });
    await addPersonAlias(a.id, 'المهندس');

    let error = null;
    try { await addPersonAlias(b.id, 'المهندس'); } catch (err) { error = err; }
    expect(error !== null).toBe(true);
    expect(error.message).toContain('أليكسي');
  });

  it('الاسم البديل يُشال', async () => {
    await fresh();
    const person = await addPerson({ name: 'أليكسي' });
    await addPersonAlias(person.id, 'المهندس');
    await removePersonAlias(person.id, 'المهندس');
    expect(await findByName('المهندس')).toBe(null);
  });
});

describe('الأشخاص — النسبة والاقتراح', () => {
  it('تنسب جزءًا لشخص وتُبقي النصّ الحرّ كما هو', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'اجتماع', type: 'meeting', date: '2026-03-01' });
    const part = await addConversationPart(scene.id, { speaker: 'Алексей', text: 'Привет.' });
    const person = await addPerson({ name: 'أليكسي', nameRu: 'Алексей' });

    await assignSpeaker(part.id, person.id);
    const after = await conversationParts.get(part.id);

    expect(after.personId).toBe(person.id);
    // ⚠️ `speaker` هو ما كتبتَه أنت وقتها. لو أخطأنا في النسبة، الأصل
    //    ما زال مكتوبًا ويمكن الرجوع إليه (بند 107).
    expect(after.speaker).toBe('Алексей');
  });

  it('النسبة تحدّث «آخر مرّة» من تاريخ المشهد لا ساعة الجهاز', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'قديم', type: 'meeting', date: '2020-05-10' });
    const part = await addConversationPart(scene.id, { speaker: 'أوليغ', text: 'Привет.' });
    const person = await addPerson({ name: 'أوليغ' });

    await assignSpeaker(part.id, person.id);
    const stored = await people.get(person.id);
    expect(new Date(stored.lastSeenAt).getFullYear()).toBe(2020);
  });

  it('الاقتراح يميّز المطابقة التامّة عن البديل', async () => {
    await fresh();
    const person = await addPerson({ name: 'أليكسي' });
    await addPersonAlias(person.id, 'المهندس');

    expect((await suggestPerson('اليكسى')).confidence).toBe('exact');
    expect((await suggestPerson('المهندس')).confidence).toBe('alias');
    expect(await suggestPerson('حد تاني خالص')).toBe(null);
  });

  it('«أنا» ليست شخصًا يُقترَح', async () => {
    await fresh();
    expect(await suggestPerson(ME.label)).toBe(null);
  });
});

describe('الأشخاص — المتحدّثون بلا شخص', () => {
  it('تجمعهم بأسمائهم وتعدّ أجزاءهم ومشاهدهم', async () => {
    await fresh();
    const a = await createScene({ titleAr: 'أ', type: 'meeting', date: '2026-01-01' });
    const b = await createScene({ titleAr: 'ب', type: 'meeting', date: '2026-01-02' });
    await addConversationPart(a.id, { speaker: 'Алексей', text: 'Раз.' });
    await addConversationPart(a.id, { speaker: 'Алексей', text: 'Два.' });
    await addConversationPart(b.id, { speaker: 'Алексей', text: 'Три.' });
    await addConversationPart(a.id, { speaker: 'Ирина', text: 'Привет.' });

    const rows = await unlinkedSpeakers();
    const alexey = rows.find((r) => r.speaker === 'Алексей');
    expect(alexey.parts).toBe(3);
    expect(alexey.scenes).toBe(2);
    expect(rows.length).toBe(2);
  });

  it('كلامك أنت ليس متحدّثًا ينتظر النسبة', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'أ', type: 'meeting', date: '2026-01-01' });
    await addConversationPart(scene.id, { speaker: 'أنا', text: 'Да.', isMine: true });
    expect((await unlinkedSpeakers()).length).toBe(0);
  });

  /*
   * ⚠️ **جوهر هذا الملفّ.** لو ربطنا تلقائيًّا لكانت هذه الحالة صامتة
   *    ونتيجتها خلط كلام رجلين.
   */
  it('لا شيء يُربَط تلقائيًّا — القائمة تُعرَض ولا تُنفَّذ', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'أ', type: 'meeting', date: '2026-01-01' });
    const part = await addConversationPart(scene.id, { speaker: 'Алексей', text: 'Раз.' });
    await addPerson({ name: 'Алексей' });

    const rows = await unlinkedSpeakers();
    // الاقتراح موجود…
    expect(rows[0].suggestion.confidence).toBe('exact');
    // …والنسبة **لم تحدث**.
    expect((await conversationParts.get(part.id)).personId).toBe(null);
  });

  it('وحين تقرّر أنت، تُنسب كل أجزائه دفعةً واحدة', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'أ', type: 'meeting', date: '2026-01-01' });
    await addConversationPart(scene.id, { speaker: 'Алексей', text: 'Раз.' });
    await addConversationPart(scene.id, { speaker: 'Алексей', text: 'Два.' });
    await addConversationPart(scene.id, { speaker: 'Ирина', text: 'Привет.' });
    const person = await addPerson({ name: 'أليكسي' });

    expect(await linkSpeakerTo('Алексей', person.id)).toBe(2);
    expect((await unlinkedSpeakers()).map((r) => r.speaker)).toEqual(['Ирина']);
  });

  it('والمنسوب لا يُعاد نسبه', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'أ', type: 'meeting', date: '2026-01-01' });
    await addConversationPart(scene.id, { speaker: 'Алексей', text: 'Раз.' });
    const a = await addPerson({ name: 'أليكسي' });
    const b = await addPerson({ name: 'حد تاني' });

    await linkSpeakerTo('Алексей', a.id);
    expect(await linkSpeakerTo('Алексей', b.id)).toBe(0);
  });
});

describe('الأشخاص — صفحة الشخص', () => {
  it('تجمع مشاهده وأوّل لقاء وآخره', async () => {
    await fresh();
    const person = await addPerson({ name: 'أليكسي' });
    const older = await createScene({ titleAr: 'الأقدم', type: 'meeting', date: '2025-02-01' });
    const newer = await createScene({ titleAr: 'الأحدث', type: 'meeting', date: '2026-04-01' });
    const p1 = await addConversationPart(older.id, { speaker: 'Алексей', text: 'Раз.' });
    const p2 = await addConversationPart(newer.id, { speaker: 'Алексей', text: 'Два.' });
    await assignSpeaker(p1.id, person.id);
    await assignSpeaker(p2.id, person.id);

    const profile = await personProfile(person.id);
    expect(profile.parts.length).toBe(2);
    expect(profile.scenes.length).toBe(2);
    expect(profile.firstMet).toBe('2025-02-01');
    expect(profile.lastMet).toBe('2026-04-01');
  });

  it('شخصٌ بلا كلام يعطي صفحةً فارغة لا خطأ', async () => {
    await fresh();
    const person = await addPerson({ name: 'حد ما اتكلّمش' });
    const profile = await personProfile(person.id);
    expect(profile.parts.length).toBe(0);
    expect(profile.firstMet).toBe(null);
  });

  it('شخصٌ غير موجود يعيد null', async () => {
    await fresh();
    expect(await personProfile('PER_مش_موجود')).toBe(null);
  });

  it('عدّ الكلام لكل شخص في مسحة واحدة', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'أ', type: 'meeting', date: '2026-01-01' });
    const a = await addPerson({ name: 'أليكسي' });
    const b = await addPerson({ name: 'إيرينا' });
    const p1 = await addConversationPart(scene.id, { speaker: 'أليكسي', text: 'Раз.' });
    const p2 = await addConversationPart(scene.id, { speaker: 'أليكسي', text: 'Два.' });
    const p3 = await addConversationPart(scene.id, { speaker: 'إيرينا', text: 'Три.' });
    await assignSpeaker(p1.id, a.id);
    await assignSpeaker(p2.id, a.id);
    await assignSpeaker(p3.id, b.id);

    const counts = await speakingCounts();
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBe(1);
  });

  it('حذف الجزء يرفع نسبته — لا يبقى في عدّ الشخص', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'أ', type: 'meeting', date: '2026-01-01' });
    const person = await addPerson({ name: 'أليكسي' });
    const part = await addConversationPart(scene.id, { speaker: 'أليكسي', text: 'Раз.' });
    await assignSpeaker(part.id, person.id);
    await conversationParts.trash(part.id);

    expect((await personProfile(person.id)).parts.length).toBe(0);
    expect((await speakingCounts()).get(person.id)).toBe(undefined);
  });
});

/* ------------------------------------------------------------------ *
 * منتقي المتحدّث
 * ------------------------------------------------------------------ */

describe('منتقي المتحدّث — قراءة الاختيار', () => {
  it('«أنا» تُعلَّم كذلك ولا تُنشئ شخصًا', () => {
    const read = readSpeaker({ personId: 'me' });
    expect(read.isMine).toBe(true);
    expect(read.personId).toBe(null);
    expect(read.speaker).toBe(ME.label);
  });

  /*
   * ⚠️ `speaker` يُملأ باسم الشخص لا يُترك فارغًا: كل قارئٍ قديم —
   *    شاشة المشهد، ومدخل الظلّ، والسلة — يقرأه. أجزاءٌ بلا متحدّث
   *    لأننا صرنا نعرف مَن هو نكسةٌ لا تقدّم.
   */
  it('اختيار شخصٍ يملأ النصّ الحرّ باسمه أيضًا', () => {
    const known = [{ id: 'PER_1', name: 'أليكسي' }];
    const read = readSpeaker({ personId: 'PER_1' }, known);
    expect(read.personId).toBe('PER_1');
    expect(read.speaker).toBe('أليكسي');
    expect(read.isMine).toBe(false);
  });

  it('الاسم الحرّ يمرّ بلا شخص', () => {
    const read = readSpeaker({ personId: '', speaker: '  الموظّف  ' });
    expect(read.personId).toBe(null);
    expect(read.speaker).toBe('الموظّف');
  });

  it('الفراغ يبقى فراغًا فتتولّاه القيمة الافتراضية', () => {
    expect(readSpeaker({ personId: '', speaker: '' }).speaker).toBe('');
  });
});

describe('منتقي المتحدّث — الحقل', () => {
  /** يبني الحقل في عنصرٍ حقيقي ويُشغّل ربطه. */
  async function mount(state) {
    const host = document.createElement('div');
    host.innerHTML = await speakerSelect(state);
    document.body.append(host);
    wireSpeakerSelect(host);
    return {
      host,
      pick: host.querySelector('[data-speaker-pick]'),
      text: host.querySelector('[data-speaker-text]'),
      done: () => host.remove(),
    };
  }

  /*
   * ⚠️ الحالة الأولى كانت متناقضة: المنتقي يعرض خيارًا وخانةُ الاسم
   *    تعرض عكسه. ظهر ذلك في التحقّق البصري لا في اختبار — فصار له
   *    اختبار.
   */
  it('يبدأ متّسقًا: «اكتب اسمًا» والخانة ظاهرة', async () => {
    await fresh();
    const m = await mount();
    expect(m.pick.value).toBe('');
    expect(m.text.hidden).toBe(false);
    m.done();
  });

  it('اختيار شخص يُخفي خانة الاسم', async () => {
    await fresh();
    const person = await addPerson({ name: 'أليكسي' });
    const m = await mount();
    m.pick.value = person.id;
    m.pick.dispatchEvent(new Event('change'));
    expect(m.text.hidden).toBe(true);
    m.done();
  });

  it('«أنا» تُخفيها كذلك', async () => {
    await fresh();
    const m = await mount({ isMine: true });
    expect(m.pick.value).toBe('me');
    expect(m.text.hidden).toBe(true);
    m.done();
  });

  it('المؤرشف لا يظهر في المنتقي', async () => {
    await fresh();
    const person = await addPerson({ name: 'أوليغ' });
    await archivePerson(person.id, true);
    const m = await mount();
    expect([...m.pick.options].some((o) => o.value === person.id)).toBe(false);
    m.done();
  });
});

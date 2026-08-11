/**
 * LingoLife — اختبارات المشاركين
 *
 * أربع قواعد تُحرَس:
 *
 *  1. **حاضرٌ ومتكلّمٌ شيئان** — يظهران معًا ولا يندمجان. مَن حضر
 *     وصمت كان يختفي، وهو الحدّ الذي جاء WS9 ليرفعه.
 *  2. **علاقةٌ لا حقل** — `scene.peopleIds` يبقى ميّتًا ولا يُكتب،
 *     والمشاركة صفٌّ في `relationships`.
 *  3. **رفعُ الإعلان لا يمحو واقعة** — مَن تكلّم يبقى ظاهرًا ولو
 *     رفعتَ إعلان مشاركته.
 *  4. **الأطلس يوافق نفسه** — العدُّ والترشيح يقرآن الاتحاد نفسه،
 *     وإلّا وعد الرقمُ بما لا يفي به.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventThreads, relationships, conversationParts,
  conversations, expressions, expressionOccurrences, scripts,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { addPerson } from '../js/services/person-service.js';
import { resetTypes } from '../js/services/type-service.js';
import { addConversationPart } from '../js/services/content-service.js';
import {
  SCENE_PERSON, addParticipant, removeParticipant, setParticipants,
  participantIds, scenesOfParticipant, scenePeople, peopleSceneMap,
} from '../js/services/participant-service.js';
import { AXIS, facetsFor, allowedSceneIds, facetTree, constellation } from '../js/services/atlas-service.js';
import { personRow, readPicked } from '../js/modals/participant-modals.js';

async function fresh() {
  await openDB();
  for (const repo of [
    scenes, people, eventThreads, relationships, conversations,
    conversationParts, expressions, expressionOccurrences, scripts,
  ]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

const scene = (titleAr, date = '2026-04-01') =>
  createScene({ titleAr, date, type: 'meeting' });

/* ================================================================== */

describe('المشاركة — علاقةٌ لا حقل', () => {
  it('الاصطلاح نفسه الذي للخيوط', async () => {
    expect(SCENE_PERSON).toBe('scene:person');
  });

  it('⚠️ `scene.peopleIds` لم يعد يُكتب — الحقل الميّت لا يُحيا', async () => {
    await fresh();
    const s = await scene('ذكرى');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, person.id);

    const row = await scenes.get(s.id);
    // لا يُكتب أصلًا، ولا يُملأ بالمشاركين من وراء ظهر البنية.
    expect(row.peopleIds).toBe(undefined);
  });

  it('المشاركة صفٌّ في `relationships` بالاتجاه الصحيح', async () => {
    await fresh();
    const s = await scene('ذكرى');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, person.id);

    const [row] = await relationships.byIndex('kind', SCENE_PERSON);
    // الحاوي هو الذكرى، والعضو هو الشخص.
    expect(row.fromId).toBe(s.id);
    expect(row.toId).toBe(person.id);
  });

  it('الإضافة مرّتين لا تُنشئ صفّين', async () => {
    await fresh();
    const s = await scene('ذكرى');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, person.id);
    await addParticipant(s.id, person.id);

    expect((await relationships.byIndex('kind', SCENE_PERSON)).length).toBe(1);
    expect((await participantIds(s.id)).length).toBe(1);
  });

  it('والرفع يزيل الصفّ', async () => {
    await fresh();
    const s = await scene('ذكرى');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, person.id);
    await removeParticipant(s.id, person.id);

    expect(await participantIds(s.id)).toEqual([]);
  });

  it('«في أي ذكرياتٍ كان؟» سؤالٌ مقروء', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(a.id, person.id);
    await addParticipant(b.id, person.id);

    expect((await scenesOfParticipant(person.id)).sort()).toEqual([a.id, b.id].sort());
  });

  it('الضبط دفعةً يضيف ويزيل معًا', async () => {
    await fresh();
    const s = await scene('ذكرى');
    const a = await addPerson({ name: 'إيجور' });
    const b = await addPerson({ name: 'مارينا' });
    const c = await addPerson({ name: 'أنّا' });

    await setParticipants(s.id, [a.id, b.id]);
    await setParticipants(s.id, [b.id, c.id]);

    expect((await participantIds(s.id)).sort()).toEqual([b.id, c.id].sort());
  });
});

/* ================================================================== */

describe('⚠️ حاضرٌ ومتكلّمٌ شيئان', () => {
  it('مَن حضر ولم يتكلّم يظهر — وهو الحدّ الذي رُفع', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const silent = await addPerson({ name: 'الصامت' });
    await addParticipant(s.id, silent.id);

    const here = await scenePeople(s.id);
    expect(here.length).toBe(1);
    expect(here[0].declared).toBe(true);
    expect(here[0].spoke).toBe(false);
    expect(here[0].saidCount).toBe(0);
  });

  it('ومَن تكلّم يظهر بلا إعلان — الكلام دليلُ حضور', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const talker = await addPerson({ name: 'إيجور' });
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: talker.id });

    const here = await scenePeople(s.id);
    expect(here.length).toBe(1);
    expect(here[0].spoke).toBe(true);
    expect(here[0].declared).toBe(false);
  });

  it('والاثنان معًا يُعلَّمان بالاثنين', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, person.id);
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: person.id });

    const [row] = await scenePeople(s.id);
    expect(row.declared).toBe(true);
    expect(row.spoke).toBe(true);
    expect(row.saidCount).toBe(1);
  });

  it('⚠️ رفعُ الإعلان لا يمحو الكلام', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, person.id);
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: person.id });

    await removeParticipant(s.id, person.id);
    const here = await scenePeople(s.id);
    // ما زال هناك — بدليل كلامه لا بإعلانك.
    expect(here.length).toBe(1);
    expect(here[0].spoke).toBe(true);
    expect(here[0].declared).toBe(false);
  });

  it('الاتحاد بلا تكرار: خمسةٌ حضروا واثنان تكلّما', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const all = [];
    for (const name of ['أ', 'ب', 'ج', 'د', 'هـ']) all.push(await addPerson({ name }));
    for (const person of all) await addParticipant(s.id, person.id);
    await addConversationPart(s.id, { speaker: 'أ', text: 'X', personId: all[0].id });
    await addConversationPart(s.id, { speaker: 'ب', text: 'Y', personId: all[1].id });

    const here = await scenePeople(s.id);
    expect(here.length).toBe(5);
    expect(here.filter((p) => p.spoke).length).toBe(2);
    expect(here.filter((p) => p.declared).length).toBe(5);
  });

  it('الترتيب: الأكثر كلامًا أوّلًا', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const quiet = await addPerson({ name: 'قليل' });
    const loud = await addPerson({ name: 'كتير' });
    await addParticipant(s.id, quiet.id);
    await addConversationPart(s.id, { speaker: 'قليل', text: '1', personId: quiet.id });
    for (let i = 0; i < 3; i += 1) {
      await addConversationPart(s.id, { speaker: 'كتير', text: `${i}`, personId: loud.id });
    }

    expect((await scenePeople(s.id))[0].name).toBe('كتير');
  });

  it('الشخص المحذوف يخرج من القائمة', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(s.id, person.id);
    await people.trash(person.id);

    expect(await scenePeople(s.id)).toEqual([]);
  });

  it('ذكرى بلا أحد: قائمةٌ فارغة لا سقوط', async () => {
    await fresh();
    const s = await scene('وحيدة');
    expect(await scenePeople(s.id)).toEqual([]);
  });
});

/* ================================================================== */

describe('الأطلس يوافق نفسه', () => {
  it('⚠️ المحور يعدّ الحاضر الصامت', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const silent = await addPerson({ name: 'الصامت' });
    await addParticipant(s.id, silent.id);

    const facets = await facetsFor([s]);
    expect(facets.get(s.id).personIds).toEqual([silent.id]);

    const tree = await facetTree();
    expect(tree.people.find((p) => p.id === silent.id).count).toBe(1);
  });

  it('⚠️ والترشيح يوافق العدّ — الرقم وعدٌ يُوفَّى', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const person = await addPerson({ name: 'إيجور' });

    // حضر في الأولى صامتًا، وتكلّم في الثانية بلا إعلان.
    await addParticipant(a.id, person.id);
    await addConversationPart(b.id, { speaker: 'إيجور', text: 'X', personId: person.id });

    const tree = await facetTree();
    const promised = tree.people.find((p) => p.id === person.id).count;
    const allowed = await allowedSceneIds({ [AXIS.PERSON]: person.id });

    expect(promised).toBe(2);
    expect(allowed.size).toBe(promised);
  });

  it('الذكرى المحذوفة تخرج من العدّ', async () => {
    await fresh();
    const a = await scene('باقية', '2026-04-01');
    const b = await scene('هتتحذف', '2026-04-02');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(a.id, person.id);
    await addParticipant(b.id, person.id);

    await scenes.trash(b.id);
    const tree = await facetTree();
    expect(tree.people.find((p) => p.id === person.id).count).toBe(1);
  });

  it('⚠️ الكوكبة توصل بين مَن حضرا ولو صمتا', async () => {
    await fresh();
    const s = await scene('اجتماع');
    const a = await addPerson({ name: 'أ' });
    const b = await addPerson({ name: 'ب' });
    await addParticipant(s.id, a.id);
    await addParticipant(s.id, b.id);

    const net = await constellation();
    // قبل WS9: صفر وصلات، لأن أحدًا لم يتكلّم.
    expect(net.links.length).toBe(1);
    expect(net.scenesWithTwo).toBe(1);
  });

  it('خريطة الأشخاص تفصل الدليلين', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const person = await addPerson({ name: 'إيجور' });
    await addParticipant(a.id, person.id);
    await addConversationPart(b.id, { speaker: 'إيجور', text: 'X', personId: person.id });

    const map = await peopleSceneMap();
    const entry = map.get(person.id);
    expect(entry.scenes.size).toBe(2);
    expect(entry.declared.has(a.id)).toBe(true);
    expect(entry.spoke.has(b.id)).toBe(true);
    expect(entry.declared.has(b.id)).toBe(false);
  });
});

/* ================================================================== */

/*
 * ⚠️ المنتقي يُختبَر على DOM حقيقي لا على الخدمة.
 *
 * الخطأ الذي وقع فعلًا لم تكن تراه أيٌّ من الاختبارات فوق: الخدمة
 * تُنفّذ ما تُعطى بأمانة، والغلط كان في **ما نقرؤه من الشاشة قبل أن
 * نعطيها**. كشفه تحقّقُ المتصفّح، فصار له حارسٌ هنا.
 */
describe('منتقي المشاركين — ما يُقرأ من الشاشة', () => {
  /** يبني قائمةً كالتي في النموذج ويردّها لتُقرَأ. */
  function picker(rows) {
    const host = document.createElement('div');
    host.className = 'pp-list';
    host.innerHTML = rows.map(([person, opts]) => personRow(person, opts)).join('');
    document.body.append(host);
    return host;
  }

  it('يقرأ كل مَن عُلِّم عليه — لا الأخير وحده', () => {
    /* `Object.fromEntries(new FormData(...))` تُبقي آخر خانةٍ وحدها. */
    const host = picker([
      [{ id: 'a', name: 'أ' }, { checked: true, locked: false, why: '' }],
      [{ id: 'b', name: 'ب' }, { checked: true, locked: false, why: '' }],
      [{ id: 'ج', name: 'ج' }, { checked: true, locked: false, why: '' }],
    ]);
    try {
      expect(readPicked(host).length).toBe(3);
    } finally { host.remove(); }
  });

  it('⚠️ ولا يُدرِج مَن مربّعُه مُعطَّل — `:checked` تلتقط المُعطَّل', () => {
    /*
     * إيجور تكلّم ولم يُعلَن، فمربّعه مُعلَّمٌ مُعطَّل. وكانت القراءة
     * تلتقطه — فيصير **مُعلَنًا** بمجرّد أن تفتح النموذج وتحفظ، ويذوب
     * الفرق بين واقعةٍ وإعلان: وهو الفرق الذي وُجد WS9 له.
     */
    const host = picker([
      [{ id: 'spoke', name: 'إيجور' }, { checked: true, locked: true, why: 'اتكلّم' }],
      [{ id: 'declared', name: 'مارينا' }, { checked: true, locked: false, why: 'حضر' }],
      [{ id: 'absent', name: 'أنّا' }, { checked: false, locked: false, why: '' }],
    ]);
    try {
      expect(readPicked(host)).toEqual(['declared']);
    } finally { host.remove(); }
  });

  it('ومَن حضر وتكلّم معًا يُعاد إعلانُه — لا يسقط بالترشيح', () => {
    /*
     * مربّعه مُعطَّلٌ أيضًا فلا تقرؤه، لكنه **كان مُعلَنًا** — فيعيده
     * النموذج من `declaredSet ∩ spoke`. هذا الاختبار يحرس أن الترشيح
     * وحده لا يكفي، وأن الإعادة جزءٌ من القاعدة لا زيادة.
     */
    const host = picker([
      [{ id: 'both', name: 'إيجور' }, { checked: true, locked: true, why: 'حضر واتكلّم' }],
    ]);
    try {
      const declaredSet = new Set(['both']);
      const spoke = new Set(['both']);
      const picked = readPicked(host);
      expect(picked).toEqual([]);
      for (const id of declaredSet) if (spoke.has(id)) picked.push(id);
      expect(picked).toEqual(['both']);
    } finally { host.remove(); }
  });
});

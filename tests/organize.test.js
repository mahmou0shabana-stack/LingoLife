/**
 * LingoLife — اختباراتُ وضع التنظيم (WS56 · تجريبيّ)
 *
 * تحرس أربعةَ وعودٍ قطعناها في هذا الوضع، وكلُّها يمكن أن ينكسر بصمت:
 *
 *  ١ · **حقيقةٌ واحدة.** الوضعان يقرآن ويكتبان نفسَ الروابط.
 *  ٢ · **لا تكرار.** إعادةُ التنظيم تغيّر العلاقةَ لا المحتوى.
 *  ٣ · **الصفحةُ القديمة لا تراها.** الأجزاءُ لا تظهر سكريبتاتٍ فيها.
 *  ٤ · **لا شيءَ تلقائيّ.** فتحُ اللوحة لا يكتب حرفًا.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, scripts, media, sceneMediaLinks, relationships,
} from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { addScript } from '../js/services/content-service.js';
import { getSceneFull } from '../js/services/scene-service.js';
import { LINK, resolveLinks } from '../js/services/link-service.js';
import {
  organizeBoard, linkItemsTo, addPart, removePart, partsOf, PART_OF,
  journeyOf, createJourney, setJourneyEnabled, addNode, renameNode, setNodeHidden,
  moveNode, moveNodeTo, duplicateNode, removeNode, DELETE_POLICY,
  descendantIdsOf, trashSubtree, restoreSubtree, NODE_KIND,
} from '../js/services/organize-service.js';
import {
  TEMPLATE_KEY, TEMPLATE_VERSION, V41_PHASES,
} from '../js/services/hyperlingual.js';

/** ذكرى صغيرةٌ حقيقيّةٌ في القاعدة — تُنشأ وتُزال في كلّ اختبار. */
async function seed({ scriptCount = 2, audioCount = 2, imageCount = 3 } = {}) {
  await openDB();
  const scene = await scenes.create({
    titleAr: `تنظيم ${Date.now()}`, date: '2026-05-14', type: 'other',
  });

  /*
   * ⚠️ **عنوانٌ فريدٌ لكلّ زرع.** كانت العناوينُ ثابتةً («سكريبت ١»)،
   *    فسقط اختبارٌ يعدّ الأشباهَ لسببٍ لا علاقةَ له به: اختبارٌ سابقٌ
   *    فشل **قبل** سطر التنظيف، فتركت فِخاخُه سكريبتاتٍ بنفس الاسم.
   *    والدرس: تنظيفٌ يعيش بعد `expect` ليس تنظيفًا مضمونًا، فليكن
   *    الزرعُ نفسُه غيرَ قابلٍ للخلط.
   */
  const tag = `ز${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const scriptIds = [];
  const scriptTitles = [];
  for (let i = 0; i < scriptCount; i += 1) {
    const title = `${tag}-سكريبت ${i + 1}`;
    const row = await addScript(scene.id, { title, text: `нет ${i}` });
    scriptIds.push(row.id);
    scriptTitles.push(title);
  }

  const mediaIds = { audio: [], image: [] };
  let order = 0;
  const make = async (kind, i) => {
    const row = await media.create({
      kind, filename: `${kind}${i}.bin`, caption: `${kind} ${i}`,
      blob: new Blob([new Uint8Array(4)]), thumb: null,
    });
    await sceneMediaLinks.create({ sceneId: scene.id, mediaId: row.id, order: order += 1, roles: [] });
    mediaIds[kind].push(row.id);
  };
  for (let i = 1; i <= audioCount; i += 1) await make('audio', i);
  for (let i = 1; i <= imageCount; i += 1) await make('image', i);

  return { scene, scriptIds, scriptTitles, mediaIds };
}

async function cleanup(scene) {
  for (const row of await sceneMediaLinks.byIndex('sceneId', scene.id)) {
    await media.destroy(row.mediaId).catch(() => {});
    await sceneMediaLinks.destroy(row.id);
  }
  for (const row of await scripts.byIndex('sceneId', scene.id)) await scripts.destroy(row.id);
  await scenes.destroy(scene.id);
}

/* ================================================================== */

describe('التنظيم · اللوحة تقرأ ولا تكتب', () => {
  it('⚠️ فتحُ اللوحة لا يُنشئ ولا رابطًا واحدًا (بند ٣)', async () => {
    const { scene } = await seed();
    const before = (await relationships.getAll()).length;

    await organizeBoard(scene.id);
    await organizeBoard(scene.id);

    expect((await relationships.getAll()).length).toBe(before);
    await cleanup(scene);
  });

  it('وتعدّ ما في الذكرى فعلًا — وكلُّه «غير مربوط» في البداية', async () => {
    const { scene } = await seed({ scriptCount: 2, audioCount: 2, imageCount: 3 });
    const board = await organizeBoard(scene.id);

    /* حقلًا حقلًا: إضافةُ عدّادٍ جديدٍ ليست كسرًا يستحقّ إسقاطَ اختبار. */
    expect(board.counts.images).toBe(3);
    expect(board.counts.audio).toBe(2);
    expect(board.counts.scripts).toBe(2);
    expect(board.counts.parts).toBe(0);
    expect(board.unlinked.audio.length).toBe(2);
    expect(board.unlinked.images.length).toBe(3);
    /* «غير مربوط» ليست خطأً — ولذلك لا عَلَمَ ولا تحذير في النتيجة. */
    expect(board.scripts.every((row) => row.totals.audio === 0 && row.totals.images === 0)).toBe(true);
    await cleanup(scene);
  });
});

describe('التنظيم · الربط الجماعيّ', () => {
  it('يربط دفعةً واحدةً ويظهر من الاتجاهين (بنود ١٠ و١١)', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const target = scriptIds[0];
    const picked = [mediaIds.audio[0], mediaIds.image[0], mediaIds.image[1]];

    const board0 = await organizeBoard(scene.id);
    await linkItemsTo(picked, target, { scopeIds: board0.targets.map((t) => t.id) });

    const board = await organizeBoard(scene.id);
    const row = board.scripts.find((r) => r.script.id === target);
    expect(row.totals).toEqual({ audio: 1, images: 2 });
    /* ومن الجهة الأخرى: العنصرُ نفسُه يعرف بمَن ارتبط. */
    expect(board.linkedTo.get(mediaIds.image[0])).toBe(target);
    expect(board.unlinked.audio.length + board.unlinked.images.length).toBe(2);
    await cleanup(scene);
  });

  it('⚠️ وإعادةُ الربط تنقل ولا تُكرِّر — ولا سجلَّ وسيطٍ جديد (بند ١٥ و٢١)', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const board0 = await organizeBoard(scene.id);
    const scopeIds = board0.targets.map((t) => t.id);
    const image = mediaIds.image[0];

    const mediaBefore = (await media.getAll()).length;
    await linkItemsTo([image], scriptIds[0], { scopeIds });
    await linkItemsTo([image], scriptIds[1], { scopeIds });

    /* الصورةُ واحدةٌ كما كانت — تغيّرت العلاقةُ وحدَها. */
    expect((await media.getAll()).length).toBe(mediaBefore);

    const board = await organizeBoard(scene.id);
    expect(board.linkedTo.get(image)).toBe(scriptIds[1]);
    /* ولا رابطَ يتيمٌ باقٍ إلى السكريبت الأوّل. */
    const stale = await resolveLinks(image, LINK.IMAGE_SCRIPT);
    expect(stale.map((r) => r.entity.id)).toEqual([scriptIds[1]]);
    await cleanup(scene);
  });

  it('و«بدون ربط» تفكّ ولا تحذف (بند ١٤)', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const board0 = await organizeBoard(scene.id);
    const scopeIds = board0.targets.map((t) => t.id);

    await linkItemsTo([mediaIds.audio[0]], scriptIds[0], { scopeIds });
    const { unlinked } = await linkItemsTo([mediaIds.audio[0]], null, { scopeIds });

    expect(unlinked).toBe(1);
    const board = await organizeBoard(scene.id);
    expect(board.linkedTo.has(mediaIds.audio[0])).toBe(false);
    /* والملفُّ نفسُه ما زال في الذكرى. */
    expect(board.audio.some((m) => m.id === mediaIds.audio[0])).toBe(true);
    await cleanup(scene);
  });

  it('⚠️ ولا يمسّ روابطَ ذكرى أخرى', async () => {
    const a = await seed();
    const b = await seed();
    const shared = a.mediaIds.image[0];

    /* نفسُ الملفّ مربوطٌ بسكريبتٍ في الذكرى الثانية — وضعٌ حقيقيّ. */
    const boardB = await organizeBoard(b.scene.id);
    await linkItemsTo([shared], b.scriptIds[0], { scopeIds: boardB.targets.map((t) => t.id) });

    const boardA = await organizeBoard(a.scene.id);
    await linkItemsTo([shared], a.scriptIds[0], { scopeIds: boardA.targets.map((t) => t.id) });

    const after = await resolveLinks(shared, LINK.IMAGE_SCRIPT);
    const ids = after.map((r) => r.entity.id).sort();
    expect(ids).toEqual([a.scriptIds[0], b.scriptIds[0]].sort());

    await cleanup(a.scene);
    await cleanup(b.scene);
  });
});

describe('التنظيم · الأجزاء', () => {
  it('الجزءُ سكريبتٌ كامل — ويرتبط به الصوتُ بنفس نوع الربط (بند ١٧)', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const part = await addPart(scriptIds[0], { title: 'القياسات' });

    expect((await partsOf(scriptIds[0])).map((p) => p.id)).toEqual([part.id]);

    const board0 = await organizeBoard(scene.id);
    await linkItemsTo([mediaIds.audio[0]], part.id, { scopeIds: board0.targets.map((t) => t.id) });

    const board = await organizeBoard(scene.id);
    const parent = board.scripts.find((r) => r.script.id === scriptIds[0]);
    expect(parent.parts[0].audio.length).toBe(1);
    /* وعدّادُ الأب يجمع أجزاءه — «الفحص البصري 🎙١» تعني الكلّ. */
    expect(parent.totals.audio).toBe(1);
    await cleanup(scene);
  });

  it('⚠️ والصفحةُ القديمة لا ترى الأجزاءَ سكريبتاتٍ (بند ٢٢)', async () => {
    const { scene, scriptIds } = await seed({ scriptCount: 2 });
    const before = (await getSceneFull(scene.id)).scripts.length;

    await addPart(scriptIds[0], { title: 'جزء' });
    await addPart(scriptIds[0], { title: 'جزء تاني' });

    /*
     * ⚠️ **بحكم البناء لا بتصفيةٍ أضفناها**: الجزءُ `sceneId: null`،
     *    وIndexedDB لا تفهرس `null` — فاستعلامُ الصفحة القديمة لا
     *    يمرّ عليه أصلًا. راجع رأسَ `organize-service.js`.
     */
    const after = await getSceneFull(scene.id);
    expect(after.scripts.length).toBe(before);
    expect(after.counts.scripts).toBe(before);
    await cleanup(scene);
  });

  it('والجزءُ ليس «السكريبت الأساسيّ» أبدًا', async () => {
    const { scene, scriptIds } = await seed();
    const part = await addPart(scriptIds[0], { title: 'جزء' });
    expect((await scripts.get(part.id)).isPrimary).toBe(0);
    await cleanup(scene);
  });

  it('وحذفُ الجزء يُرجِع ما كان فيه «غير مربوط» ولا يحذفه', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const part = await addPart(scriptIds[0], { title: 'جزء' });
    const board0 = await organizeBoard(scene.id);
    await linkItemsTo([mediaIds.image[0]], part.id, { scopeIds: board0.targets.map((t) => t.id) });

    await removePart(part.id);

    const board = await organizeBoard(scene.id);
    expect(board.targets.some((t) => t.id === part.id)).toBe(false);
    expect(board.unlinked.images.some((m) => m.id === mediaIds.image[0])).toBe(true);
    /* والصورةُ نفسُها حيّة. */
    expect((await media.get(mediaIds.image[0])).state).toBe(STATE.ACTIVE);
    await cleanup(scene);
  });

  it('والانتماءُ بصيغة العضويّة القائمة — لا نوعَ ربطٍ جديد (بند ٣١)', async () => {
    expect(PART_OF).toBe('script:script');
    const { scene, scriptIds } = await seed();
    const part = await addPart(scriptIds[0], { title: 'جزء' });
    const rows = (await relationships.byIndex('from_kind', [scriptIds[0], PART_OF]))
      .filter((r) => r.state === STATE.ACTIVE);
    expect(rows.map((r) => r.toId)).toEqual([part.id]);
    await cleanup(scene);
  });
});

describe('التنظيم · حقيقةٌ واحدة لا اثنتان (بند ٢٣)', () => {
  it('ما يُربَط هنا تراه نافذةُ الربط القديمة — ونفسُ الـstore', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const board0 = await organizeBoard(scene.id);
    await linkItemsTo([mediaIds.image[0]], scriptIds[0], {
      scopeIds: board0.targets.map((t) => t.id),
    });

    /* `resolveLinks` هي ما تقرؤه `link-modal.js` بالضبط. */
    const seen = await resolveLinks(mediaIds.image[0], LINK.IMAGE_SCRIPT);
    expect(seen.length).toBe(1);
    expect(seen[0].entity.id).toBe(scriptIds[0]);
    await cleanup(scene);
  });

  it('⚠️ ولا store جديدًا لهذا الوضع', async () => {
    const src = await (await fetch('../js/services/organize-service.js')).text();
    /* حراسةٌ بالنصّ: أيُّ `createRepository` هنا يعني قاعدةً ثانية. */
    expect(src.includes('createRepository')).toBe(false);
    /* والروابطُ تمرّ بـ`link-service` لا بكتابةٍ مباشرة في السجلّ. */
    expect(src.includes("from './link-service.js'")).toBe(true);
  });
});

/* ================================================================== *
 * WS57 · رحلةُ التدريب — القالبُ يصنع البنية ولا يملكها
 * ================================================================== */

describe('الرحلة · الإنشاء والقالب', () => {
  it('السكريبتُ عاديٌّ افتراضًا — ولا ترقيةَ ولا تحويلَ تلقائيّ (بند ٢)', async () => {
    const { scene, scriptIds } = await seed();
    expect(await journeyOf(scriptIds[0])).toBe(null);
    const board = await organizeBoard(scene.id);
    expect(board.scripts.every((r) => r.journey === null)).toBe(true);
    expect(board.counts.journeys).toBe(0);
    await cleanup(scene);
  });

  it('وقالبُ v4.1 ينشئ ١٨ مرحلةً — بترتيبٍ محفوظٍ ونسخةٍ مسجَّلة', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });

    expect(journey.templateVersion).toBe(TEMPLATE_VERSION);
    const phases = await partsOf(journey.id);
    expect(phases.length).toBe(V41_PHASES.length);
    expect(phases[0].semanticType).toBe('phase_0');
    expect(phases[phases.length - 1].semanticType).toBe('phase_12');
    await cleanup(scene);
  });

  it('والرحلةُ الفاضية رحلةٌ صالحة — بلا مراحل ولا قالب', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    /*
     * ⚠️ **غيابُ الحقل هو تمثيلُ «بلا قالب»** — كما أن غيابَ `nodeKind`
     *    يعني سكريبتًا عاديًّا. كتابةُ `null` صراحةً تعني حقلًا فارغًا
     *    على كلّ عقدةٍ في القاعدة بلا فائدة.
     */
    expect(Boolean(journey.templateVersion)).toBe(false);
    expect((await partsOf(journey.id)).length).toBe(0);
    await cleanup(scene);
  });

  it('⚠️ والسكريبتُ الأصليّ يبقى كما هو — نصًّا وصوتًا وصورًا (بند ٣ و٢١)', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const before = await scripts.get(scriptIds[0]);
    const b0 = await organizeBoard(scene.id);
    await linkItemsTo([mediaIds.audio[0]], scriptIds[0], {
      scopeIds: b0.targets.map((t) => t.id),
    });

    await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });

    const after = await scripts.get(scriptIds[0]);
    expect(after.text).toBe(before.text);
    expect(after.title).toBe(before.title);
    /* ولا نسخةَ ثانيةً من السكريبت. */
    const same = (await scripts.getAll()).filter((r) => r.title === before.title
      && r.state === STATE.ACTIVE);
    expect(same.length).toBe(1);
    /* والصوتُ المربوط به لم يتحرّك. */
    const board = await organizeBoard(scene.id);
    expect(board.linkedTo.get(mediaIds.audio[0])).toBe(scriptIds[0]);
    await cleanup(scene);
  });

  it('⚠️ والرحلةُ ليست «جزءًا» — لا تظهر في قائمة أجزاء السكريبت (بند ١٩)', async () => {
    const { scene, scriptIds } = await seed();
    await addPart(scriptIds[0], { title: 'جزء حقيقيّ' });
    await createJourney(scriptIds[0], { templateId: 'empty' });

    const parts = await partsOf(scriptIds[0]);
    expect(parts.length).toBe(1);
    expect(parts[0].title).toBe('جزء حقيقيّ');
    await cleanup(scene);
  });
});

describe('الرحلة · البنيةُ ملكُ المستخدم لا القالب', () => {
  it('يعيد التسمية بلا أن يفقد المعنى الداخليّ (بند ١١ و١٢)', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });
    const phases = await partsOf(journey.id);

    await renameNode(phases[1].id, 'مصطلحات التغليف الأساسية');
    const after = await scripts.get(phases[1].id);
    expect(after.title).toBe('مصطلحات التغليف الأساسية');
    /* ⚠️ والهُويّةُ الداخليّة لم تتغيّر — المحرّكُ لا يستدلّ بالعنوان. */
    expect(after.semanticType).toBe('phase_1');
    await cleanup(scene);
  });

  it('ويُعيد الترتيب بلا أن يمسّ نصًّا ولا وسيطًا (بند ٩)', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });
    let phases = await partsOf(journey.id);
    const fifth = phases[5];
    const textBefore = fifth.text;

    const b0 = await organizeBoard(scene.id);
    await linkItemsTo([mediaIds.image[0]], fifth.id, { scopeIds: b0.targets.map((t) => t.id) });

    await moveNode(journey.id, fifth.id, 'up');
    phases = await partsOf(journey.id);
    expect(phases[4].id).toBe(fifth.id);
    expect((await scripts.get(fifth.id)).text).toBe(textBefore);

    const board = await organizeBoard(scene.id);
    expect(board.linkedTo.get(mediaIds.image[0])).toBe(fifth.id);
    await cleanup(scene);
  });

  it('ويقبل مرحلةً مخصَّصةً ليست في القالب (بند ١٣)', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });
    const custom = await addNode(journey.id, {
      title: 'مرحلة خاصّة — مشكلة التغليف', nodeKind: NODE_KIND.PHASE,
    });
    expect(custom.semanticType).toBe('custom');
    const phases = await partsOf(journey.id);
    expect(phases[phases.length - 1].id).toBe(custom.id);
    await cleanup(scene);
  });

  it('⚠️ والإخفاءُ يحفظ ولا يحذف (بند ١٠ و١٤)', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });
    const phases = await partsOf(journey.id);
    const last = phases[phases.length - 1];

    await setNodeHidden(last.id, true);
    const still = await scripts.get(last.id);
    expect(still.state).toBe(STATE.ACTIVE);
    expect(still.hidden).toBe(1);
    /* وتبقى في الشجرة موسومةً — لا تختفي من البيانات. */
    const board = await organizeBoard(scene.id);
    expect(board.targets.find((t) => t.id === last.id).hidden).toBe(true);

    await setNodeHidden(last.id, false);
    expect((await scripts.get(last.id)).hidden).toBe(0);
    await cleanup(scene);
  });

  it('ويُكرّر عقدةً بأبنائها وروابطها — بلا تكرار وسيط (بند ٨)', async () => {
    const { scene, scriptIds, mediaIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    const phase = await addNode(journey.id, { title: 'مرحلة ٢', nodeKind: NODE_KIND.PHASE });
    await addNode(phase.id, { title: 'الروسية فقط', nodeKind: NODE_KIND.TRAINING });

    const b0 = await organizeBoard(scene.id);
    await linkItemsTo([mediaIds.audio[0]], phase.id, { scopeIds: b0.targets.map((t) => t.id) });

    const mediaBefore = (await media.getAll()).length;
    const copy = await duplicateNode(journey.id, phase.id);

    expect((await media.getAll()).length).toBe(mediaBefore);
    expect(copy.title).toBe('مرحلة ٢ (نسخة)');
    expect((await partsOf(copy.id)).length).toBe(1);
    await cleanup(scene);
  });

  it('⚠️ ويمنع نقلَ عقدةٍ داخل أحد أبنائها — الدورةُ تُجمِّد الشاشة', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    const parent = await addNode(journey.id, { title: 'أب', nodeKind: NODE_KIND.PHASE });
    const child = await addNode(parent.id, { title: 'ابن', nodeKind: NODE_KIND.PART });

    let threw = false;
    try { await moveNodeTo(parent.id, child.id); } catch { threw = true; }
    expect(threw).toBe(true);
    await cleanup(scene);
  });
});

describe('الرحلة · التعطيل والحذف الآمن', () => {
  it('⚠️ تعطيلُ الرحلة لا يحذف ولا عقدةً واحدة (بند ٢٢)', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });
    const before = (await partsOf(journey.id)).length;

    await setJourneyEnabled(journey.id, false);
    let board = await organizeBoard(scene.id);
    let row = board.scripts.find((r) => r.script.id === scriptIds[0]);
    expect(row.journeyDisabled).toBe(true);
    expect(row.tree.length).toBe(before);

    await setJourneyEnabled(journey.id, true);
    board = await organizeBoard(scene.id);
    row = board.scripts.find((r) => r.script.id === scriptIds[0]);
    expect(row.journeyDisabled).toBe(false);
    expect(row.tree.length).toBe(before);
    await cleanup(scene);
  });

  it('وحذفُ عقدةٍ بسياسة «ارفع الأبناء» لا يُيتّم أحدًا (بند ٣١)', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    const phase = await addNode(journey.id, { title: 'مرحلة', nodeKind: NODE_KIND.PHASE });
    const a = await addNode(phase.id, { title: 'جزء أ', nodeKind: NODE_KIND.PART });
    const b = await addNode(phase.id, { title: 'جزء ب', nodeKind: NODE_KIND.PART });

    await removeNode(phase.id, { policy: DELETE_POLICY.LIFT });

    const under = (await partsOf(journey.id)).map((n) => n.id).sort();
    expect(under).toEqual([a.id, b.id].sort());
    expect((await scripts.get(phase.id)).state).toBe(STATE.TRASHED);
    await cleanup(scene);
  });

  it('وسياسةُ «مع اللي جوّه» تأخذ الشجرةَ كلَّها للسلة', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    const phase = await addNode(journey.id, { title: 'مرحلة', nodeKind: NODE_KIND.PHASE });
    const kid = await addNode(phase.id, { title: 'جزء', nodeKind: NODE_KIND.PART });

    const { removed } = await removeNode(phase.id, { policy: DELETE_POLICY.CASCADE });
    expect(removed).toBe(2);
    expect((await scripts.get(kid.id)).state).toBe(STATE.TRASHED);
    await cleanup(scene);
  });

  it('⚠️ وحذفُ السكريبت من الوضع القديم يأخذ رحلتَه معه — ويرجّعها (بند ٣٢)', async () => {
    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });
    const ids = await descendantIdsOf(scriptIds[0]);
    expect(ids.length).toBe(V41_PHASES.length + 1);

    /*
     * هذا هو ما ينادِيه `deleteWithUndo` عبر `cascade` — أي ما يحدث
     * فعليًّا حين تضغط «احذف السكريبت» في الصفحة القديمة.
     */
    await scripts.trash(scriptIds[0]);
    await trashSubtree(scriptIds[0]);
    for (const id of ids) expect((await scripts.get(id)).state).toBe(STATE.TRASHED);

    await scripts.restore(scriptIds[0]);
    const back = await restoreSubtree(scriptIds[0]);
    expect(back).toBe(ids.length);
    expect((await scripts.get(journey.id)).state).toBe(STATE.ACTIVE);
    await cleanup(scene);
  });
});

describe('الرحلة · الربط والشادوينج', () => {
  it('الصوتُ يرتبط بأيّ مستوًى — بنفس نوعَي الربط القائمين (بند ٤)', async () => {
    const { scene, scriptIds, mediaIds } = await seed({ audioCount: 3 });
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    const phase = await addNode(journey.id, { title: 'مرحلة ٢', nodeKind: NODE_KIND.PHASE });
    const training = await addNode(phase.id, { title: 'الروسية فقط', nodeKind: NODE_KIND.TRAINING });

    const b0 = await organizeBoard(scene.id);
    const scopeIds = b0.targets.map((t) => t.id);
    await linkItemsTo([mediaIds.audio[0]], scriptIds[0], { scopeIds });
    await linkItemsTo([mediaIds.audio[1]], phase.id, { scopeIds });
    await linkItemsTo([mediaIds.audio[2]], training.id, { scopeIds });

    const board = await organizeBoard(scene.id);
    expect(board.linkedTo.get(mediaIds.audio[0])).toBe(scriptIds[0]);
    expect(board.linkedTo.get(mediaIds.audio[1])).toBe(phase.id);
    expect(board.linkedTo.get(mediaIds.audio[2])).toBe(training.id);

    /* والعدّادُ يصعد: السكريبتُ الأصليّ يجمع رحلتَه كلَّها. */
    const row = board.scripts.find((r) => r.script.id === scriptIds[0]);
    expect(row.totals.audio).toBe(3);
    await cleanup(scene);
  });

  it('والمسارُ يُقال بالأسماء بلا معرّفات (بند ٢٤)', async () => {
    const { scene, scriptIds, scriptTitles } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    const phase = await addNode(journey.id, { title: 'مرحلة ٢', nodeKind: NODE_KIND.PHASE });
    const leaf = await addNode(phase.id, { title: 'الروسية فقط', nodeKind: NODE_KIND.TRAINING });

    const board = await organizeBoard(scene.id);
    const target = board.targets.find((t) => t.id === leaf.id);
    /*
     * ⚠️ **وجذرُ «رحلة التدريب» ليس محطّةً في المسار — عن قصد.**
     *    توقّعتُ في أوّل صياغةٍ أن يظهر، ثم راجعتُ مثالَ الطلب نفسِه
     *    (بند ٢٤): «التغليف والحماية · Phase 2 · الروسية فقط». الجذرُ
     *    حاوٍ بنيويٌّ لا مكان، وذكرُه في كلّ سطرٍ يطيل بلا أن يميّز.
     */
    expect(target.path).toEqual([scriptTitles[0], 'مرحلة ٢', 'الروسية فقط']);
    expect(target.path.some((p) => /^SC_/.test(p))).toBe(false);
    await cleanup(scene);
  });

  it('⚠️ وكلُّ عقدةٍ ذاتِ نصٍّ تدخل محرّكَ الظلّ القائم — بلا محرّكٍ ثانٍ (بند ٢٦)', async () => {
    const src = await (await fetch('../js/services/organize-service.js')).text();
    /* حراسةٌ بالنصّ: أيُّ جلسةِ ظلٍّ تُنشَأ هنا تعني مسارًا موازيًا. */
    expect(src.includes('createSession')).toBe(false);

    const { scene, scriptIds } = await seed();
    const journey = await createJourney(scriptIds[0], { templateId: 'empty' });
    const node = await addNode(journey.id, {
      title: 'نصّ تدريب', text: 'Сегодня мы говорим об упаковке.', nodeKind: NODE_KIND.TRAINING,
    });
    /* عقدةٌ في `scripts` بنصٍّ — وهو كلُّ ما يطلبه `openShadowForScript`. */
    const row = await scripts.get(node.id);
    expect(row.text.trim().length > 0).toBe(true);
    await cleanup(scene);
  });
});

describe('الرحلة · الوضعُ القديم لا يراها', () => {
  it('⚠️ ١٨ مرحلةً ولا سكريبتَ إضافيٍّ واحدٍ في الصفحة القديمة (بند ٣٣)', async () => {
    const { scene, scriptIds } = await seed({ scriptCount: 2 });
    const before = (await getSceneFull(scene.id)).scripts.length;

    const journey = await createJourney(scriptIds[0], { templateId: TEMPLATE_KEY });
    await addNode((await partsOf(journey.id))[1].id, { title: 'جزء عميق' });

    const after = await getSceneFull(scene.id);
    expect(after.scripts.length).toBe(before);
    expect(after.counts.scripts).toBe(before);
    await cleanup(scene);
  });
});

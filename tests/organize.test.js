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
} from '../js/services/organize-service.js';

/** ذكرى صغيرةٌ حقيقيّةٌ في القاعدة — تُنشأ وتُزال في كلّ اختبار. */
async function seed({ scriptCount = 2, audioCount = 2, imageCount = 3 } = {}) {
  await openDB();
  const scene = await scenes.create({
    titleAr: `تنظيم ${Date.now()}`, date: '2026-05-14', type: 'other',
  });

  const scriptIds = [];
  for (let i = 0; i < scriptCount; i += 1) {
    const row = await addScript(scene.id, { title: `سكريبت ${i + 1}`, text: `нет ${i}` });
    scriptIds.push(row.id);
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

  return { scene, scriptIds, mediaIds };
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

    expect(board.counts).toEqual({ images: 3, audio: 2, scripts: 2, parts: 0 });
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

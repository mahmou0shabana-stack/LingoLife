/**
 * LingoLife — اختبارات النصّ الأصلي
 *
 * ثلاث قواعد تُحرَس:
 *
 *  1. **الأصل يُكتب مرّةً ثم يُقفَل** *(بند 27)* — والرفض برسالةٍ تقول
 *     البديل، لا بمنعٍ صامت.
 *  2. **والتصحيح يعيش بجانبه لا فوقه** — الفرق بين ما قلتَه وما كان
 *     ينبغي هو ما يقوم عليه «خطأ/طبيعي» والتحليل وحياة التعبير.
 *  3. **ولا تُخترَع نسخةٌ مصحّحة** — التطبيق لا يعرف ما كان ينبغي أن
 *     تقوله، ونسخةٌ يكتبها هو أوّلُ كذبةٍ في ملفٍّ كلُّه شواهد.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { scenes, contentBlocks } from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import {
  transcriptOf, writeRaw, writeClean, seedCleanFromRaw, scenesWithoutRaw, RAW, CLEAN,
} from '../js/services/transcript-service.js';

async function fresh() {
  await openDB();
  for (const repo of [scenes, contentBlocks]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
}

const scene = (titleAr = 'ذكرى') =>
  createScene({ titleAr, date: '2026-05-01', type: 'meeting' });

/* ================================================================== */

describe('النصّ الأصلي — سابعُ حقلٍ ميّتٍ يُحيا', () => {
  it('⚠️ الكتلة تُنشأ مع كل ذكرى — وكانت بلا قارئ', async () => {
    await fresh();
    const s = await scene();
    const blocks = await contentBlocks.byIndex('sceneId', s.id);
    // موجودةٌ منذ اليوم الأوّل — والعطب كان أن أحدًا لا يعرضها.
    expect(blocks.some((row) => row.kind === RAW)).toBe(true);
  });

  it('وتبدأ فارغةً وغيرَ مقفولة', async () => {
    await fresh();
    const s = await scene();
    const t = await transcriptOf(s.id);
    expect(t.hasRaw).toBe(false);
    /*
     * ⚠️ القفل يبدأ بامتلائها لا بإنشائها. قفلٌ عند الإنشاء يعني
     *    ألّا تُكتب أبدًا — وهو بالضبط ما جعلها ميّتة.
     */
    expect(t.locked).toBe(false);
  });

  it('تُكتب مرّةً فتُقفَل', async () => {
    await fresh();
    const s = await scene();
    await writeRaw(s.id, 'Здравствуйте, я хотел спросить');

    const t = await transcriptOf(s.id);
    expect(t.hasRaw).toBe(true);
    expect(t.rawText).toBe('Здравствуйте, я хотел спросить');
    expect(t.locked).toBe(true);
  });

  it('⚠️ والكتابة تانيةً تُرفَض — ومعها البديل مكتوبًا', async () => {
    await fresh();
    const s = await scene();
    await writeRaw(s.id, 'الأصل');

    let message = '';
    try {
      await writeRaw(s.id, 'محاولة تعديل');
    } catch (err) {
      message = err.message;
    }
    expect(message.includes('نسخة مصحّحة')).toBe(true);
    // ولم يتغيّر شيء.
    expect((await transcriptOf(s.id)).rawText).toBe('الأصل');
  });

  it('والفراغ لا يُقفل — تقدر تكتبه بعدين', async () => {
    await fresh();
    const s = await scene();
    await writeRaw(s.id, '   ');
    expect((await transcriptOf(s.id)).locked).toBe(false);
    await writeRaw(s.id, 'الأصل');
    expect((await transcriptOf(s.id)).rawText).toBe('الأصل');
  });
});

/* ================================================================== */

describe('النسخة المصحّحة تعيش بجانبه', () => {
  it('تُكتب وتُعدَّل بحرّيّة', async () => {
    await fresh();
    const s = await scene();
    await writeClean(s.id, 'النسخة الأولى');
    await writeClean(s.id, 'النسخة التانية');
    expect((await transcriptOf(s.id)).cleanText).toBe('النسخة التانية');
  });

  it('⚠️ وتعديلها لا يمسّ الأصل', async () => {
    await fresh();
    const s = await scene();
    await writeRaw(s.id, 'я идти в магазин');
    await writeClean(s.id, 'я иду в магазин');

    const t = await transcriptOf(s.id);
    // الفرق بينهما هو ما يقوم عليه نصفُ التطبيق.
    expect(t.rawText).toBe('я идти в магазин');
    expect(t.cleanText).toBe('я иду в магазин');
  });

  it('وكتلتان مستقلّتان في القاعدة لا واحدة', async () => {
    await fresh();
    const s = await scene();
    await writeRaw(s.id, 'أ');
    await writeClean(s.id, 'ب');

    const blocks = await contentBlocks.byIndex('sceneId', s.id);
    expect(blocks.filter((row) => row.kind === RAW).length).toBe(1);
    expect(blocks.filter((row) => row.kind === CLEAN).length).toBe(1);
  });

  it('البدء بنسخةٍ من الأصل يعمل مرّةً ولا يدهس ما كتبتَه', async () => {
    await fresh();
    const s = await scene();
    await writeRaw(s.id, 'الأصل');

    await seedCleanFromRaw(s.id);
    expect((await transcriptOf(s.id)).cleanText).toBe('الأصل');

    await writeClean(s.id, 'تعديلي');
    await seedCleanFromRaw(s.id);
    // ⚠️ ولا تدهس: نداءٌ ثانٍ على نسخةٍ فيها شغلُك يمحوه.
    expect((await transcriptOf(s.id)).cleanText).toBe('تعديلي');
  });

  it('⚠️ ولا تُنشأ نسخةٌ مصحّحة تلقائيًّا مع الذكرى', async () => {
    await fresh();
    const s = await scene();
    const blocks = await contentBlocks.byIndex('sceneId', s.id);
    // كتلةٌ فارغة تُنشأ مع كل ذكرى هي الحقل الميّت الثامن.
    expect(blocks.some((row) => row.kind === CLEAN)).toBe(false);
  });
});

/* ================================================================== */

describe('مَن ينقصه نصٌّ أصليّ', () => {
  it('يُعَدّ بلا استعلامٍ لكل ذكرى', async () => {
    await fresh();
    const a = await scene('أ');
    const b = await scene('ب');
    await writeRaw(a.id, 'مكتوب');

    const missing = await scenesWithoutRaw([a.id, b.id]);
    expect(missing).toEqual([b.id]);
  });

  it('والفراغ يُعَدّ ناقصًا', async () => {
    await fresh();
    const s = await scene();
    await writeRaw(s.id, '   ');
    expect(await scenesWithoutRaw([s.id])).toEqual([s.id]);
  });

  it('وقائمةٌ فارغة لا ترمي', async () => {
    await fresh();
    expect(await scenesWithoutRaw([])).toEqual([]);
    expect(await scenesWithoutRaw(null)).toEqual([]);
  });
});

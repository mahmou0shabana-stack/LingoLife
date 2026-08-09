/**
 * LingoLife — اختبارات عارض الصورة
 *
 * ما يُحرَس هنا سلوكٌ يسهل أن ينكسر صامتًا:
 *
 *  1. **التنقّل يدور** ولا يقف عند الطرف — ولا يخرج عن المدى.
 *  2. **الوصف يُحفَظ** — وهو حقلٌ كان ميّتًا، فأوّل ما ينكسر يعود
 *     العارض لعرض اسم الملفّ بلا أن يشتكي أحد.
 *  3. **الترتيب من الرابط** لا من `media`: الصورة قد تظهر في ذكرياتٍ
 *     عدّة بترتيبٍ مختلف.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { media, sceneMediaLinks, scenes } from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { sceneMedia, setCaption } from '../js/services/media-service.js';
import { openLightbox } from '../js/components/lightbox.js';

/** صورة PNG صالحة بحجم 1×1 — المتصفّح يقرؤها فعلًا. */
function pixel() {
  const bytes = Uint8Array.from(atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

async function fresh() {
  await openDB();
  for (const repo of [media, sceneMediaLinks, scenes]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
}

/** ذكرى بعددٍ من الصور، بترتيبٍ معلوم. */
async function sceneWithImages(count) {
  const scene = await createScene({ titleAr: 'ذكرى', date: '2026-04-01', type: 'other' });
  const rows = [];
  for (let i = 0; i < count; i++) {
    const row = await media.create({
      kind: 'image', blob: pixel(), filename: `IMG_${i}.png`,
      mime: 'image/png', bytes: 70, caption: '',
    });
    await sceneMediaLinks.create({ sceneId: scene.id, mediaId: row.id, order: i });
    rows.push(row);
  }
  return { scene, rows };
}

const close = () => document.querySelector('.lightbox .lightbox-close')?.click();

describe('عارض الصورة — الترتيب', () => {
  it('يعيد صور الذكرى بترتيب الرابط', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(3);
    const list = await sceneMedia(scene.id, 'image');
    expect(list.map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });

  it('⚠️ الترتيب من الرابط لا من `media`', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(3);
    // نعكس ترتيب الروابط — الملفّات كما هي.
    const links = await sceneMediaLinks.byIndex('sceneId', scene.id);
    for (const link of links) {
      const position = rows.findIndex((r) => r.id === link.mediaId);
      await sceneMediaLinks.update(link.id, { order: rows.length - position });
    }
    const list = await sceneMedia(scene.id, 'image');
    expect(list.map((r) => r.id)).toEqual([...rows].reverse().map((r) => r.id));
  });

  it('الأصوات لا تدخل شريط الصور', async () => {
    await fresh();
    const { scene } = await sceneWithImages(2);
    const sound = await media.create({
      kind: 'audio', blob: new Blob([new Uint8Array([1])], { type: 'audio/webm' }),
      filename: 'a.webm', mime: 'audio/webm', bytes: 1, caption: '',
    });
    await sceneMediaLinks.create({ sceneId: scene.id, mediaId: sound.id, order: 9 });

    expect((await sceneMedia(scene.id, 'image')).length).toBe(2);
    expect((await sceneMedia(scene.id)).length).toBe(3);
  });

  it('المحذوف يخرج من الشريط', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(3);
    await media.trash(rows[1].id);
    expect((await sceneMedia(scene.id, 'image')).length).toBe(2);
  });
});

describe('عارض الصورة — التنقّل', () => {
  it('يفتح على الصورة المطلوبة ويعرض موضعها', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(3);
    await openLightbox(rows[1].id, scene.id);

    expect(document.querySelector('[data-lb-count]').textContent).toBe('2 / 3');
    close();
  });

  it('«التالية» تتقدّم و«السابقة» ترجع', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(3);
    await openLightbox(rows[0].id, scene.id);

    document.querySelector('[data-lb="next"]').click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-lb-count]').textContent).toBe('2 / 3');

    document.querySelector('[data-lb="prev"]').click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-lb-count]').textContent).toBe('1 / 3');
    close();
  });

  it('⚠️ التنقّل يدور ولا يخرج عن المدى', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(2);
    await openLightbox(rows[0].id, scene.id);

    // من الأولى للخلف → الأخيرة، لا فهرسٌ سالب.
    document.querySelector('[data-lb="prev"]').click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-lb-count]').textContent).toBe('2 / 2');

    document.querySelector('[data-lb="next"]').click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-lb-count]').textContent).toBe('1 / 2');
    close();
  });

  it('صورةٌ وحيدة: لا شريط تنقّل', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(1);
    await openLightbox(rows[0].id, scene.id);
    // ⚠️ سهمان لا يفعلان شيئًا أسوأ من غيابهما.
    expect(document.querySelector('[data-lb-nav]').hidden).toBe(true);
    close();
  });

  it('يفتح بلا ذكرى ولا يسقط', async () => {
    await fresh();
    const row = await media.create({
      kind: 'image', blob: pixel(), filename: 'وحيدة.png',
      mime: 'image/png', bytes: 70, caption: '',
    });
    await openLightbox(row.id, null);
    expect(document.querySelectorAll('.lightbox').length).toBe(1);
    close();
  });
});

describe('عارض الصورة — الوصف', () => {
  it('يُحفَظ عند مغادرة الحقل', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(1);
    await openLightbox(rows[0].id, scene.id);

    const input = document.querySelector('[data-lb-caption]');
    input.value = 'لافتة المستودع';
    input.dispatchEvent(new Event('blur'));
    await new Promise((r) => setTimeout(r, 60));

    expect((await media.get(rows[0].id)).caption).toBe('لافتة المستودع');
    close();
  });

  it('⚠️ يُحفَظ قبل التنقّل — لا يضيع بضغطة سهم', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(2);
    await openLightbox(rows[0].id, scene.id);

    document.querySelector('[data-lb-caption]').value = 'الأولى';
    document.querySelector('[data-lb="next"]').click();
    await new Promise((r) => setTimeout(r, 80));

    expect((await media.get(rows[0].id)).caption).toBe('الأولى');
    // والحقل يعرض وصف الصورة الجديدة لا وصف السابقة.
    expect(document.querySelector('[data-lb-caption]').value).toBe('');
    close();
  });

  it('الوصف الفارغ لا يكتب شيئًا', async () => {
    await fresh();
    const { scene, rows } = await sceneWithImages(1);
    await setCaption(rows[0].id, 'اسم قديم');
    await openLightbox(rows[0].id, scene.id);

    const before = (await media.get(rows[0].id)).rev;
    document.querySelector('[data-lb-caption]').dispatchEvent(new Event('blur'));
    await new Promise((r) => setTimeout(r, 60));

    // ⚠️ نفس القيمة لا تُنتج كتابةً — وإلا ارتفع `rev` بلا تغيير.
    expect((await media.get(rows[0].id)).rev).toBe(before);
    close();
  });

  it('المسافات تُشذَّب', async () => {
    await fresh();
    const { rows } = await sceneWithImages(1);
    await setCaption(rows[0].id, '   لافتة   ');
    expect((await media.get(rows[0].id)).caption).toBe('لافتة');
  });
});

/**
 * LingoLife — اختبارات النسخ الاحتياطي
 *
 * تشتغل على IndexedDB حقيقية وBlobs حقيقية في متصفح حقيقي.
 * الوعد الذي تحرسه: **نسخة قديمة تظل قابلة للاسترجاع بعد تطوير التطبيق.**
 */

import { describe, it, expect } from './test-runner.js';
import { buildFixtureWorld, tinyPng, fakeAudio } from './fixtures.js';

import { createZipBuilder, openZip } from '../js/utils/zip.js';
import { crc32, crc32Blob } from '../js/utils/crc32.js';
import { openNamed, withTx, req, closeDB } from '../js/db/database.js';
import { ALL_REPOS, settings } from '../js/db/repositories.js';
import { activeDbName, stagingDbName, SLOT_A, SLOT_B, deleteDatabase, setActiveDbName } from '../js/db/db-slots.js';
import { buildBackup } from '../js/services/backup/export.js';
import { inspectBackup, restoreBackup } from '../js/services/backup/restore.js';
import { migrateBundle, isSupportedVersion } from '../js/services/backup/backup-migrations.js';
import { BACKUP_FORMAT_VERSION } from '../js/services/backup/backup-format.js';
import { TARGET_VERSION } from '../js/db/migrations.js';

/** يكتب عالم الاختبار في القاعدة النشطة. */
async function seedWorld(world) {
  for (const [storeName, rows] of Object.entries(world)) {
    if (storeName === 'settings' || storeName === 'mediaBlobs') continue;
    if (!rows.length) continue;

    if (storeName === 'media') {
      for (const record of rows) {
        const blobs = world.mediaBlobs.get(record.id);
        await ALL_REPOS.media.putRaw({
          ...record,
          blob: blobs.blob,
          thumbBlob: blobs.thumb,
        });
      }
      continue;
    }

    for (const record of rows) await ALL_REPOS[storeName].putRaw(record);
  }

  for (const [key, value] of Object.entries(world.settings)) {
    await settings.set(key, value);
  }
}

/** يفرّغ القاعدة النشطة تمامًا. */
async function wipeActive() {
  const names = Object.keys(ALL_REPOS).concat('settings');
  await withTx(names, 'readwrite', (tx) => {
    for (const name of names) tx.objectStore(name).clear();
  });
}

/* ================================================================== *
 * الطبقة الأدنى: CRC و ZIP
 * ================================================================== */

describe('CRC-32', () => {
  it('يطابق القيمة المرجعية المعروفة لـ "123456789"', async () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(crc32(bytes)).toBe(0xcbf43926);
  });

  it('يعطي نفس النتيجة على قطع وعلى دفعة واحدة', async () => {
    const data = new Uint8Array(300_000).map((_, i) => (i * 7) % 256);
    const blob = new Blob([data]);
    const chunked = await crc32Blob(blob, 4096);
    expect(chunked).toBe(crc32(data));
  });

  it('يتغيّر ببايت واحد مقلوب — أساس كشف التلف', async () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 6]);
    expect(crc32(a) === crc32(b)).toBeFalsy();
  });
});

describe('أرشيف ZIP', () => {
  it('يكتب ويقرأ نصًا', async () => {
    const zip = createZipBuilder();
    zip.addText('hello.txt', 'مرحبًا يا عالم');
    const archive = await openZip(zip.finalize());
    expect(await archive.text('hello.txt')).toBe('مرحبًا يا عالم');
  });

  it('يحفظ بايتات الـ Blob كما هي بلا تغيير', async () => {
    const png = tinyPng(11, 22, 33);
    const original = new Uint8Array(await png.arrayBuffer());

    const zip = createZipBuilder();
    await zip.addBlob('blobs/x.png', png);
    const archive = await openZip(zip.finalize());

    const back = new Uint8Array(await (await archive.blob('blobs/x.png')).arrayBuffer());
    expect(back.length).toBe(original.length);
    expect([...back].join(',')).toBe([...original].join(','));
  });

  it('يحفظ الأسماء العربية بترميز UTF-8', async () => {
    const zip = createZipBuilder();
    zip.addText('بيانات/مشاهد.json', '[]');
    const archive = await openZip(zip.finalize());
    expect(archive.has('بيانات/مشاهد.json')).toBeTruthy();
  });

  it('يسجّل CRC صحيحًا في الفهرس المركزي', async () => {
    const audio = fakeAudio(5000);
    const zip = createZipBuilder();
    await zip.addBlob('a.weba', audio);
    const archive = await openZip(zip.finalize());
    expect(archive.entries.get('a.weba').crc).toBe(await crc32Blob(audio));
  });

  it('يتعامل مع عدد كبير من العناصر', async () => {
    const zip = createZipBuilder();
    for (let i = 0; i < 500; i++) zip.addText(`f/${i}.txt`, `محتوى ${i}`);
    const archive = await openZip(zip.finalize());
    expect(archive.names()).toHaveLength(500);
    expect(await archive.text('f/499.txt')).toBe('محتوى 499');
  });

  it('يرفض ملفًا ليس أرشيفًا', async () => {
    await expect(openZip(new Blob(['مش أرشيف خالص']))).toReject('ZIP');
  });
});

/* ================================================================== *
 * ترقيات الصيغة
 * ================================================================== */

describe('ترقيات صيغة النسخة', () => {
  it('يقبل الإصدار الحالي', () => {
    expect(isSupportedVersion(BACKUP_FORMAT_VERSION)).toBeTruthy();
  });

  it('يرفض إصدارًا أحدث من التطبيق برسالة مفهومة', () => {
    let message = '';
    try {
      migrateBundle({ manifest: { backupFormatVersion: 999 }, data: {}, settings: {} });
    } catch (error) {
      message = error.message;
    }
    expect(message).toContain('حدّث التطبيق');
  });

  it('يرفض إصدارًا غير رقمي', () => {
    let threw = false;
    try {
      migrateBundle({ manifest: {}, data: {}, settings: {} });
    } catch {
      threw = true;
    }
    expect(threw).toBeTruthy();
  });

  it('يمرّر حزمة بالإصدار الحالي بلا تعديل', () => {
    const bundle = {
      manifest: { backupFormatVersion: BACKUP_FORMAT_VERSION },
      data: { scenes: [{ id: 'SC_1' }] },
      settings: {},
    };
    const result = migrateBundle(bundle);
    expect(result.applied).toHaveLength(0);
    expect(result.bundle.data.scenes).toHaveLength(1);
  });
});

/* ================================================================== *
 * الدورة الكاملة
 * ================================================================== */

describe('دورة التصدير والاسترجاع', () => {
  it('يصدّر عالمًا كاملًا ويسترجعه بكل بياناته ووسائطه', async () => {
    await wipeActive();
    const world = buildFixtureWorld({ scenes: 3, mediaPerScene: 2 });
    await seedWorld(world);

    const { blob, manifest } = await buildBackup();

    expect(manifest.backupFormatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(manifest.sourceDatabaseVersion).toBe(TARGET_VERSION);
    expect(manifest.counts.scenes).toBe(3);
    expect(manifest.counts.media).toBe(6);
    // 6 وسائط: 3 صور بمصغّرات (6 ملفات) + 3 أصوات بلا مصغّرة (3 ملفات)
    expect(manifest.blobs.length).toBe(9);

    // نمسح كل شيء ثم نسترجع
    await wipeActive();
    const emptyCheck = await ALL_REPOS.scenes.getAll();
    expect(emptyCheck).toHaveLength(0);

    const inspection = await inspectBackup(blob, { deep: true });
    expect(inspection.ok).toBeTruthy();
    expect(inspection.summary.fatal).toBe(0);
    expect(inspection.summary.warnings).toBe(0);

    const result = await restoreBackup(inspection);
    expect(result.ok).toBeTruthy();
    expect(result.blobsRestored).toBe(9);

    // القاعدة النشطة الآن هي الخانة الأخرى — نتحقّق من محتواها
    const scenes = await ALL_REPOS.scenes.getAll();
    const media = await ALL_REPOS.media.getAll();
    expect(scenes).toHaveLength(3);
    expect(media).toHaveLength(6);

    const images = media.filter((m) => m.kind === 'image');
    expect(images).toHaveLength(3);
    for (const record of images) {
      expect(record.blob instanceof Blob).toBeTruthy();
      expect(record.thumbBlob instanceof Blob).toBeTruthy();
      expect(record.blob.size > 0).toBeTruthy();
    }
  });

  it('يحفظ بايتات الصورة الأصلية بلا أي إعادة ترميز', async () => {
    await wipeActive();
    const world = buildFixtureWorld({ scenes: 1, mediaPerScene: 1 });
    await seedWorld(world);

    const mediaId = world.media[0].id;
    const originalBytes = new Uint8Array(
      await world.mediaBlobs.get(mediaId).blob.arrayBuffer()
    );

    const { blob } = await buildBackup();
    const inspection = await inspectBackup(blob, { deep: true });
    await restoreBackup(inspection);

    const restored = await ALL_REPOS.media.get(mediaId);
    const restoredBytes = new Uint8Array(await restored.blob.arrayBuffer());

    expect(restoredBytes.length).toBe(originalBytes.length);
    expect([...restoredBytes].join(',')).toBe([...originalBytes].join(','));
  });

  it('يحافظ على الروابط بين المشهد ووسائطه', async () => {
    await wipeActive();
    const world = buildFixtureWorld({ scenes: 2, mediaPerScene: 2 });
    await seedWorld(world);

    const { blob } = await buildBackup();
    await wipeActive();
    await restoreBackup(await inspectBackup(blob));

    const links = await ALL_REPOS.sceneMediaLinks.getAll();
    const sceneIds = new Set((await ALL_REPOS.scenes.getAll()).map((s) => s.id));
    const mediaIds = new Set((await ALL_REPOS.media.getAll()).map((m) => m.id));

    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(sceneIds.has(link.sceneId)).toBeTruthy();
      expect(mediaIds.has(link.mediaId)).toBeTruthy();
    }
  });

  it('يسترجع الإعدادات', async () => {
    await wipeActive();
    const world = buildFixtureWorld({ scenes: 1, mediaPerScene: 1 });
    await seedWorld(world);

    const { blob } = await buildBackup();
    await wipeActive();
    await restoreBackup(await inspectBackup(blob));

    expect(await settings.get('ui.theme')).toBe('light');
  });

  it('يعيد بناء الحقول المشتقّة بدل نقلها', async () => {
    await wipeActive();
    const world = buildFixtureWorld({ scenes: 1, mediaPerScene: 1 });
    await seedWorld(world);

    const { blob } = await buildBackup();
    const archive = await openZip(blob);
    const stored = await archive.json('data/expressions.json');

    // لا تُخزَّن في الملف…
    expect(stored[0].normalizedText === undefined).toBeTruthy();
    expect(stored[0].dirty === undefined).toBeTruthy();

    await wipeActive();
    await restoreBackup(await inspectBackup(blob));

    // …لكنها موجودة بعد الاسترجاع
    const expression = (await ALL_REPOS.expressions.getAll())[0];
    expect(expression.normalizedText).toBe('спасибо большое');
  });

  it('يستثني الـ stores المشتقّة ويعلن ذلك في الـ manifest', async () => {
    await wipeActive();
    await seedWorld(buildFixtureWorld({ scenes: 1, mediaPerScene: 1 }));

    const { blob, manifest } = await buildBackup();
    const archive = await openZip(blob);

    expect(archive.has('data/searchIndex.json')).toBeFalsy();
    expect(archive.has('data/syncQueue.json')).toBeFalsy();
    expect(manifest.excluded.map((e) => e.store).join(',')).toContain('searchIndex');
  });

  it('يضع ملف شرح للبشر داخل الأرشيف', async () => {
    await wipeActive();
    await seedWorld(buildFixtureWorld({ scenes: 1, mediaPerScene: 1 }));
    const { blob } = await buildBackup();
    const archive = await openZip(blob);
    expect(await archive.text('README.txt')).toContain('ملف ZIP عادي');
  });
});

/* ================================================================== *
 * الفحص يكتشف العطب
 * ================================================================== */

describe('الفحص قبل الاسترجاع', () => {
  it('يرفض ملفًا بلا manifest', async () => {
    const zip = createZipBuilder();
    zip.addText('data/scenes.json', '[]');
    const inspection = await inspectBackup(zip.finalize());
    expect(inspection.ok).toBeFalsy();
    expect(inspection.issues[0].code).toBe('no-manifest');
  });

  it('يرفض توقيعًا غير معروف', async () => {
    const zip = createZipBuilder();
    zip.addText('manifest.json', JSON.stringify({ format: 'something-else', backupFormatVersion: 1 }));
    const inspection = await inspectBackup(zip.finalize());
    expect(inspection.ok).toBeFalsy();
    expect(inspection.issues.some((i) => i.code === 'wrong-format')).toBeTruthy();
  });

  it('ينبّه على ملف مفقود بدل رفض النسخة كلها', async () => {
    await wipeActive();
    await seedWorld(buildFixtureWorld({ scenes: 1, mediaPerScene: 2 }));
    const { blob, manifest } = await buildBackup();

    // نعيد بناء الأرشيف بدون أول ملف وسائط
    const source = await openZip(blob);
    const dropped = manifest.blobs[0].entry;
    const rebuilt = createZipBuilder();
    for (const name of source.names()) {
      if (name === dropped) continue;
      await rebuilt.addBlob(name, await source.blob(name));
    }

    const inspection = await inspectBackup(rebuilt.finalize(), { deep: true });
    // مفقود = تنبيه لا مانع — المستخدم يقرّر بدل أن يفقد كل شيء
    expect(inspection.ok).toBeTruthy();
    expect(inspection.issues.some((i) => i.code === 'missing-blob')).toBeTruthy();
  });

  it('يكتشف عدم تطابق الأعداد', async () => {
    await wipeActive();
    await seedWorld(buildFixtureWorld({ scenes: 2, mediaPerScene: 1 }));
    const { blob, manifest } = await buildBackup();

    const source = await openZip(blob);
    const rebuilt = createZipBuilder();
    for (const name of source.names()) {
      if (name === 'manifest.json') {
        rebuilt.addText(name, JSON.stringify({ ...manifest, counts: { ...manifest.counts, scenes: 99 } }));
      } else {
        await rebuilt.addBlob(name, await source.blob(name));
      }
    }

    const inspection = await inspectBackup(rebuilt.finalize());
    expect(inspection.issues.some((i) => i.code === 'count-mismatch')).toBeTruthy();
  });

  it('يكتشف مرجعًا يتيمًا', async () => {
    await wipeActive();
    await seedWorld(buildFixtureWorld({ scenes: 2, mediaPerScene: 1 }));
    const { blob } = await buildBackup();

    const source = await openZip(blob);
    const rebuilt = createZipBuilder();
    for (const name of source.names()) {
      if (name === 'data/scenes.json') {
        const scenes = await source.json(name);
        rebuilt.addText(name, JSON.stringify(scenes.slice(0, 1))); // نحذف مشهدًا
      } else {
        await rebuilt.addBlob(name, await source.blob(name));
      }
    }

    const inspection = await inspectBackup(rebuilt.finalize());
    expect(inspection.issues.some((i) => i.code === 'orphan-reference')).toBeTruthy();
  });
});

/* ================================================================== *
 * الذرّية
 * ================================================================== */

describe('الاسترجاع الذرّي', () => {
  it('يبدّل الخانة بعد الاسترجاع', async () => {
    await wipeActive();
    await seedWorld(buildFixtureWorld({ scenes: 1, mediaPerScene: 1 }));

    const before = activeDbName();
    const { blob } = await buildBackup();
    const result = await restoreBackup(await inspectBackup(blob));

    expect(result.from).toBe(before);
    expect(result.to === before).toBeFalsy();
    expect(activeDbName()).toBe(result.to);
    expect([SLOT_A, SLOT_B].includes(activeDbName())).toBeTruthy();
  });

  it('لا يمسّ البيانات القديمة إذا فشل الاسترجاع', async () => {
    await wipeActive();
    const world = buildFixtureWorld({ scenes: 4, mediaPerScene: 1 });
    await seedWorld(world);

    const slotBefore = activeDbName();
    const scenesBefore = (await ALL_REPOS.scenes.getAll()).length;
    expect(scenesBefore).toBe(4);

    const { blob } = await buildBackup();
    const inspection = await inspectBackup(blob);

    // نفسد الحزمة بعد الفحص: سجل بلا مفتاح يُفشل الكتابة في منتصفها
    inspection.bundle.data.scenes.push({ noId: true });

    let failed = false;
    try {
      await restoreBackup(inspection);
    } catch {
      failed = true;
    }

    expect(failed).toBeTruthy();
    // المؤشّر لم يتحرّك، والبيانات القديمة كما هي بالضبط
    expect(activeDbName()).toBe(slotBefore);
    expect(await ALL_REPOS.scenes.getAll()).toHaveLength(4);
  });

  it('يرفض الاسترجاع من فحص لم يمرّ', async () => {
    const zip = createZipBuilder();
    zip.addText('data/x.json', '[]');
    const inspection = await inspectBackup(zip.finalize());
    await expect(restoreBackup(inspection)).toReject('الفحص');
  });
});

/* ================================================================== *
 * التوافق الخلفي — الوعد الأهم
 * ================================================================== */

describe('التوافق الخلفي مع الملفات الذهبية', () => {
  it('يسترجع نسخة أُنتجت بصيغة v1 على قاعدة اليوم', async () => {
    const response = await fetch('./fixtures/v1-minimal.llife');
    if (!response.ok) throw new Error('الملف الذهبي v1-minimal.llife غير موجود');
    const file = await response.blob();

    const inspection = await inspectBackup(file, { deep: true });
    expect(inspection.ok).toBeTruthy();
    expect(inspection.manifest.backupFormatVersion).toBe(1);
    expect(inspection.migration.to).toBe(BACKUP_FORMAT_VERSION);

    const result = await restoreBackup(inspection);
    expect(result.ok).toBeTruthy();

    const scenes = await ALL_REPOS.scenes.getAll();
    const media = await ALL_REPOS.media.getAll();
    expect(scenes.length > 0).toBeTruthy();
    expect(media.length > 0).toBeTruthy();

    // الوسائط لا بد أن تعود ببايتاتها لا بمجرد وصفها
    for (const record of media.filter((m) => m.kind === 'image')) {
      expect(record.blob instanceof Blob).toBeTruthy();
      expect(record.blob.size > 0).toBeTruthy();
    }
  });

  it('يسترجع الملف الذهبي الأكبر بكل روابطه', async () => {
    const response = await fetch('./fixtures/v1-media.llife');
    if (!response.ok) throw new Error('الملف الذهبي v1-media.llife غير موجود');

    const inspection = await inspectBackup(await response.blob(), { deep: true });
    expect(inspection.ok).toBeTruthy();
    await restoreBackup(inspection);

    const sceneIds = new Set((await ALL_REPOS.scenes.getAll()).map((s) => s.id));
    const mediaIds = new Set((await ALL_REPOS.media.getAll()).map((m) => m.id));
    const links = await ALL_REPOS.sceneMediaLinks.getAll();

    expect(links.length > 0).toBeTruthy();
    for (const link of links) {
      expect(sceneIds.has(link.sceneId)).toBeTruthy();
      expect(mediaIds.has(link.mediaId)).toBeTruthy();
    }
  });
});

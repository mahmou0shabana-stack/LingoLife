/**
 * LingoLife — الاسترجاع الذرّي
 *
 * الوعد: **إمّا أن ينجح الاسترجاع كاملًا أو تبقى بياناتك القديمة كما هي.**
 * لا حالة ثالثة، ولا نصف استرجاع.
 *
 * كيف يتحقّق ذلك:
 *   1. نكتب كل شيء في الخانة الخاملة — القاعدة النشطة لا تُلمس إطلاقًا.
 *   2. نتحقّق من الأعداد بعد الكتابة.
 *   3. نحرّك المؤشّر بكتابة واحدة. هذه هي اللحظة الذرّية.
 *   4. نحذف الخانة القديمة.
 *
 * لو انقطع التيار في أي لحظة قبل الخطوة 3، تُفتح القاعدة القديمة عند
 * التشغيل التالي كأن شيئًا لم يكن، وتُنظَّف الخانة نصف المكتوبة.
 *
 * راجع docs/07-backup-format.md §7.8
 */

import { openNamed, closeDB, req } from '../../db/database.js';
import { STORES } from '../../db/schema.js';
import {
  activeDbName,
  deleteDatabase,
  setActiveDbName,
  stagingDbName,
} from '../../db/db-slots.js';
import { openZip } from '../../utils/zip.js';
import { migrateBundle } from './backup-migrations.js';
import { blobPathsOf, readBundle, settingsRows, toDbRecord } from './deserialize.js';
import { BACKUP_STORES } from './serialize.js';
import {
  hasFatal,
  summarize,
  validateCounts,
  validateIntegrity,
  validateReferences,
  validateStructure,
} from './validate.js';

/** سجلات لكل معاملة. أصغر من أن تُرهق المتصفح وأكبر من أن تُبطئ. */
const TEXT_BATCH = 500;
/** الوسائط أثقل بكثير — دفعات أصغر تُبقي الذروة منخفضة على التابلت. */
const MEDIA_BATCH = 25;

/** ينفّذ دفعة كتابات في معاملة واحدة. */
function writeBatch(db, storeName, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(`أُلغيت الكتابة في ${storeName}`));
    for (const record of records) store.put(record);
  });
}

/** يفرّغ كل الـ stores — الخانة الخاملة قد تحمل بقايا محاولة سابقة. */
function clearAll(db) {
  const names = [...db.objectStoreNames];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    for (const name of names) tx.objectStore(name).clear();
  });
}

/** يعدّ السجلات في قاعدة مفتوحة. */
async function countStores(db, names) {
  const out = {};
  for (const name of names) {
    if (!db.objectStoreNames.contains(name)) continue;
    const tx = db.transaction(name, 'readonly');
    out[name] = await req(tx.objectStore(name).count());
  }
  return out;
}

/**
 * يفحص ملف نسخة احتياطية ويُنتج تقريرًا كاملًا — **بلا لمس أي بيانات.**
 *
 * هذه دالة المعاينة. تُستدعى وحدها أولًا، ويقرّر المستخدم بعدها.
 *
 * @param {Blob|File} file
 * @param {{ deep?: boolean, onProgress?: Function }} options
 */
export async function inspectBackup(file, { deep = false, onProgress } = {}) {
  const archive = await openZip(file);
  const { issues: structural, manifest } = await validateStructure(archive);

  if (hasFatal(structural) || !manifest) {
    return { ok: false, issues: structural, summary: summarize(structural), manifest, archive: null };
  }

  const raw = await readBundle(archive, manifest);
  const { bundle, applied, from, to } = migrateBundle(raw);

  const issues = [
    ...structural,
    ...validateCounts(manifest, bundle.data, bundle.settings),
    ...validateReferences(bundle.data),
    ...(await validateIntegrity(archive, manifest, { deep, onProgress })),
  ];

  const totals = Object.fromEntries(
    Object.entries(bundle.data).map(([store, rows]) => [store, rows.length])
  );
  totals.settings = Object.keys(bundle.settings || {}).length;

  return {
    ok: !hasFatal(issues),
    manifest,
    bundle,
    archive,
    issues,
    summary: summarize(issues),
    migration: { from, to, applied },
    totals,
    totalRecords: Object.values(totals).reduce((sum, n) => sum + n, 0),
    blobCount: (manifest.blobs || []).length,
    blobBytes: manifest.bytes?.blobs ?? 0,
  };
}

/**
 * يسترجع نسخة احتياطية بالكامل، مستبدلًا كل البيانات الحالية.
 *
 * ⚠️ وضع «استبدال الكل». الدمج مؤجَّل عمدًا — قيود `unique` على
 *    `expressions.normalizedText` و`words` و`sentencePatterns` تجعل
 *    الدمج عملية دمج كيانات حقيقية (نقل كل الظهورات والعلاقات
 *    والمقارنات من كيان لآخر)، وهي مرحلة قائمة بذاتها.
 *
 * @param {Awaited<ReturnType<inspectBackup>>} inspection — من `inspectBackup`
 * @param {{ onProgress?: Function }} options
 */
export async function restoreBackup(inspection, { onProgress = () => {} } = {}) {
  if (!inspection?.ok) throw new Error('لا يمكن الاسترجاع — الفحص لم يمرّ.');

  const { bundle, archive, manifest } = inspection;
  const target = stagingDbName();
  const previous = activeDbName();

  onProgress({ phase: 'prepare', label: `تجهيز الخانة المؤقّتة (${target})`, done: 0, total: 1 });

  // بقايا محاولة سابقة فاشلة قد تكون هنا — نبدأ من نظيف دائمًا.
  await deleteDatabase(target);
  const db = await openNamed(target);

  try {
    await clearAll(db);

    /* ---- 1. البيانات النصية ---- */
    const textStores = BACKUP_STORES.filter((n) => n !== 'media' && n !== 'settings');

    for (let s = 0; s < textStores.length; s++) {
      const storeName = textStores[s];
      const rows = bundle.data[storeName] || [];
      onProgress({ phase: 'data', label: storeName, done: s, total: textStores.length });

      for (let i = 0; i < rows.length; i += TEXT_BATCH) {
        const batch = rows.slice(i, i + TEXT_BATCH).map((r) => toDbRecord(storeName, r));
        await writeBatch(db, storeName, batch);
      }
    }

    /* ---- 2. الإعدادات ---- */
    const settingRecords = settingsRows(bundle.settings);
    if (settingRecords.length) await writeBatch(db, 'settings', settingRecords);

    /* ---- 3. الوسائط مع بايتاتها ---- */
    const mediaRows = bundle.data.media || [];

    for (let i = 0; i < mediaRows.length; i += MEDIA_BATCH) {
      const slice = mediaRows.slice(i, i + MEDIA_BATCH);
      onProgress({
        phase: 'media',
        label: `الوسائط ${Math.min(i + MEDIA_BATCH, mediaRows.length)} من ${mediaRows.length}`,
        done: i,
        total: mediaRows.length,
      });

      // نجهّز شرائح الـ Blob **قبل** فتح المعاملة: أي انتظار لوعد من
      // خارج IndexedDB داخل معاملة يُنهيها فورًا.
      const prepared = [];
      for (const row of slice) {
        const paths = blobPathsOf(row);
        const record = toDbRecord('media', row);
        record.blob =
          paths.original && archive.has(paths.original)
            ? await archive.blob(paths.original, row.mime || 'application/octet-stream')
            : null;
        record.thumbBlob =
          paths.thumbnail && archive.has(paths.thumbnail)
            ? await archive.blob(paths.thumbnail, 'image/webp')
            : null;
        prepared.push(record);
      }

      await writeBatch(db, 'media', prepared);
    }

    /* ---- 4. التحقّق قبل التحويل ---- */
    onProgress({ phase: 'verify', label: 'التحقّق من الخانة الجديدة', done: 0, total: 1 });
    const written = await countStores(db, BACKUP_STORES);
    const mismatches = [];

    for (const storeName of BACKUP_STORES) {
      const expected =
        storeName === 'settings'
          ? settingRecords.length
          : (bundle.data[storeName] || []).length;
      if ((written[storeName] ?? 0) !== expected) {
        mismatches.push(`${storeName}: متوقّع ${expected} ومكتوب ${written[storeName] ?? 0}`);
      }
    }

    if (mismatches.length) {
      throw new Error(`الكتابة ناقصة، أُلغي الاسترجاع:\n${mismatches.join('\n')}`);
    }

    /* ---- 5. اللحظة الذرّية ---- */
    db.close();
    closeDB();
    setActiveDbName(target);
    onProgress({ phase: 'switch', label: 'تمّ التحويل', done: 1, total: 1 });

    /* ---- 6. تنظيف القديمة ---- */
    // فشل الحذف لا يُبطل الاسترجاع — المؤشّر تحرّك بالفعل.
    const deleted = await deleteDatabase(previous).catch(() => false);

    return {
      ok: true,
      from: previous,
      to: target,
      counts: written,
      totalRecords: Object.values(written).reduce((sum, n) => sum + n, 0),
      blobsRestored: (manifest.blobs || []).length,
      oldDatabaseDeleted: deleted,
      backupCreatedAt: manifest.createdAt,
    };
  } catch (error) {
    // القاعدة النشطة لم تُمَسّ — ننظّف المحاولة الفاشلة ونُبقي كل شيء
    // كما كان تمامًا.
    try {
      db.close();
      await deleteDatabase(target);
    } catch {
      /* التنظيف أفضل جهد — الأهم أن المؤشّر لم يتحرّك */
    }
    throw error;
  }
}

/**
 * ينظّف خانة خاملة تركتها محاولة فاشلة.
 * يُستدعى عند الإقلاع — لا يلمس النشطة أبدًا.
 */
export async function cleanupStaleSlot() {
  const staging = stagingDbName();
  try {
    if (!indexedDB.databases) return false;
    const existing = await indexedDB.databases();
    if (!existing.some((d) => d.name === staging)) return false;
    return await deleteDatabase(staging);
  } catch {
    return false;
  }
}

/** أسماء الـ stores التي يعرفها هذا الإصدار — للعرض في التقرير. */
export const KNOWN_STORES = Object.keys(STORES);

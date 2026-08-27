/**
 * LingoLife — إنتاج ملف `.llife` وحفظه
 *
 * الحفظ على التابلت مشكلة قائمة بذاتها:
 *
 *   `showSaveFilePicker`  الأمثل نظريًا، لكنه غير موجود على iPad ولا على
 *                         Chrome في أندرويد — أي عديم الفائدة حيث تعمل.
 *   `navigator.share`     مدعوم على iOS و Android، ويفتح شاشة المشاركة
 *                         فتختار Google Drive مباشرةً بلا مرور بالتنزيلات.
 *   `<a download>`        يعمل في كل مكان، لكنه يفرض مجلد التنزيلات.
 *
 * لذلك ثلاث طبقات بالترتيب، مع الاحتفاظ بالتنزيل كشبكة أمان دائمة —
 * فمشاركة الملفات الكبيرة تفشل أحيانًا على iOS.
 *
 * راجع docs/07-backup-format.md §7.2
 */

import { createZipBuilder } from '../../utils/zip.js';
import { downloadBlob } from '../../utils/dom.js';
import { backupHistory } from '../../db/repositories.js';
import { BACKUP_EXTENSION, PATHS, README_TEXT } from './backup-format.js';
import { serializeInto } from './serialize.js';

/** اسم ملف بطابع زمني مقروء. */
export function backupFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `LingoLife-${stamp}${BACKUP_EXTENSION}`;
}

/**
 * يبني ملف النسخة الاحتياطية كاملًا.
 *
 * @param {(p: {phase: string, done: number, total: number, label: string}) => void} [onProgress]
 * @returns {Promise<{ blob: Blob, manifest: object, filename: string }>}
 */
export async function buildBackup(onProgress = () => {}, { withBlobs = true } = {}) {
  const zip = createZipBuilder();

  // نصّ للبشر أولًا، فيظهر في رأس الأرشيف عند فتحه بأي أداة.
  zip.addText(PATHS.README, README_TEXT);

  const manifest = await serializeInto(zip, onProgress, { withBlobs });

  onProgress({ phase: 'finalize', done: 0, total: 1, label: 'ختم الملف' });
  zip.addText(PATHS.MANIFEST, JSON.stringify(manifest, null, 2));

  const blob = zip.finalize('application/x-lingolife-backup');

  return {
    blob,
    manifest: { ...manifest, bytes: { ...manifest.bytes, total: blob.size } },
    filename: backupFilename(new Date(manifest.createdAt)),
    withBlobs,
  };
}

/**
 * يحفظ الملف بأفضل وسيلة يدعمها الجهاز.
 * @returns {Promise<{ method: 'share'|'picker'|'download', cancelled: boolean }>}
 */
export async function saveBackupFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });

  /* ---- 1. شاشة المشاركة — الطريق الوحيد المباشر إلى Drive من تابلت ---- */
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return { method: 'share', cancelled: false };
    } catch (error) {
      // AbortError = المستخدم أغلق الشاشة. أي خطأ آخر (حجم كبير مثلًا)
      // يسقط إلى الطبقة التالية بدل أن يُفشل العملية.
      if (error?.name === 'AbortError') return { method: 'share', cancelled: true };
      console.warn('[backup] تعذّرت المشاركة، نجرّب طريقة أخرى:', error);
    }
  }

  /* ---- 2. اختيار المكان — أسطح المكتب ---- */
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'نسخة LingoLife الاحتياطية',
            accept: { 'application/x-lingolife-backup': [BACKUP_EXTENSION] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { method: 'picker', cancelled: false };
    } catch (error) {
      if (error?.name === 'AbortError') return { method: 'picker', cancelled: true };
      console.warn('[backup] تعذّر اختيار المكان، ننزّل الملف:', error);
    }
  }

  /* ---- 3. التنزيل — يعمل دائمًا ---- */
  downloadBlob(blob, filename);
  return { method: 'download', cancelled: false };
}

/**
 * يبني النسخة ويحفظها ويسجّلها في `backupHistory`.
 *
 * السجلّ يحفظ الوصف فقط لا الملف — حتى تعرف متى كانت آخر نسخة
 * وكم كانت تحوي، دون أن تلتهم النسخ مساحة القاعدة نفسها.
 */
export async function exportBackup(onProgress = () => {}) {
  const started = Date.now();
  const { blob, manifest, filename } = await buildBackup(onProgress);
  const saved = await saveBackupFile(blob, filename);

  await backupHistory.create({
    filename,
    createdAt: manifest.createdAt,
    bytes: blob.size,
    blobBytes: manifest.bytes.blobs,
    totalRecords: manifest.totalRecords,
    blobCount: manifest.blobs.length,
    counts: manifest.counts,
    backupFormatVersion: manifest.backupFormatVersion,
    sourceDatabaseVersion: manifest.sourceDatabaseVersion,
    appVersion: manifest.appVersion,
    method: saved.method,
    cancelled: saved.cancelled,
    durationMs: Date.now() - started,
  });

  return {
    filename,
    bytes: blob.size,
    blobBytes: manifest.bytes.blobs,
    totalRecords: manifest.totalRecords,
    blobCount: manifest.blobs.length,
    counts: manifest.counts,
    method: saved.method,
    cancelled: saved.cancelled,
    durationMs: Date.now() - started,
  };
}

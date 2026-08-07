/**
 * LingoLife — الترجمة من صيغة النسخة الاحتياطية إلى قاعدة البيانات
 *
 * الطبقة المقابلة لـ `serialize.js`. تعرف **الصيغة الحالية وحدها** —
 * النسخ الأقدم تصل إليها وقد رُقّيت بالفعل عبر `backup-migrations.js`.
 * هذا ما يمنع انفجار المسارات إلى N×M.
 */

import { normalize } from '../../utils/normalization.js';
import { PATHS } from './backup-format.js';
import { BACKUP_STORES } from './serialize.js';

/**
 * يقرأ كل بيانات الأرشيف النصية إلى حزمة في الذاكرة.
 * الـ Blobs لا تُقرأ هنا — تبقى في الأرشيف حتى لحظة الكتابة.
 *
 * @param {Awaited<ReturnType<import('../../utils/zip.js').openZip>>} archive
 * @param {object} manifest
 */
export async function readBundle(archive, manifest) {
  const data = {};

  for (const storeName of BACKUP_STORES) {
    if (storeName === 'settings') continue;
    const path = `${PATHS.DATA_DIR}${storeName}.json`;
    // store غائب ليس خطأ — قد تكون النسخة أقدم من إضافته.
    data[storeName] = archive.has(path) ? await archive.json(path) : [];
  }

  const settingsPath = `${PATHS.DATA_DIR}settings.json`;
  const settings = archive.has(settingsPath) ? await archive.json(settingsPath) : {};

  return { manifest, data, settings };
}

/**
 * يعيد بناء الحقول المشتقّة التي حُذفت عمدًا عند الحفظ.
 *
 * إعادة الحساب بدل التخزين تعني أن أي تحسين مستقبلي في `normalize`
 * يصل إلى بياناتك القديمة تلقائيًا عند أول استرجاع.
 */
export function toDbRecord(storeName, record) {
  const out = { ...record };

  // كل ما يأتي من نسخة احتياطية لم يُرفع من هذا الجهاز بعد.
  out.dirty = 1;

  if (typeof out.text === 'string') out.normalizedText = normalize(out.text);
  if (typeof out.name === 'string') out.normalizedName = normalize(out.name);

  // حقول داخلية أضافها المُصدِّر لربط السجل بملفه داخل الأرشيف.
  delete out._originalEntry;
  delete out._thumbnailEntry;

  return out;
}

/**
 * يستخرج مسارات ملفات وسيط من سجله كما كتبها المُصدِّر.
 * @param {object} mediaRecord
 */
export function blobPathsOf(mediaRecord) {
  return {
    original: mediaRecord._originalEntry || null,
    thumbnail: mediaRecord._thumbnailEntry || null,
  };
}

/** يحوّل كائن الإعدادات المسطّح إلى سجلات store الإعدادات. */
export function settingsRows(settingsObj) {
  return Object.entries(settingsObj || {}).map(([key, value]) => ({
    key,
    value,
    updatedAt: Date.now(),
  }));
}

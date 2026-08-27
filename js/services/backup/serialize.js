/**
 * LingoLife — الترجمة من قاعدة البيانات إلى صيغة النسخة الاحتياطية
 *
 * هذه إحدى طبقتي الترجمة. تتغيّر كلما تغيّرت القاعدة، بينما تبقى
 * صيغة الملف الناتج ثابتة. راجع `backup-format.js` للسبب.
 */

import { withTx, req } from '../../db/database.js';
import { ALL_REPOS, settings } from '../../db/repositories.js';
import { STORE_NAMES } from '../../db/schema.js';
import { TARGET_VERSION } from '../../db/migrations.js';
import { APP_VERSION, BUILD_ID } from '../../config.js';
import { crc32Blob } from '../../utils/crc32.js';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_MAGIC,
  BLOB_ROLE,
  DERIVED_FIELDS,
  EXCLUDED_STORES,
  originalPath,
  thumbnailPath,
} from './backup-format.js';

/**
 * فوق هذا الحجم نكتفي بـ CRC-32 ولا نحسب SHA-256.
 * السبب: WebCrypto لا يدعم التجزئة على دفعات، فيلزمه الملف كاملًا في
 * الذاكرة. CRC-32 يُحسب على قطع ويكفي وحده لكشف التلف.
 */
const SHA256_MAX_BYTES = 256 * 1024 * 1024;

/** الـ stores التي تدخل النسخة — كل شيء عدا المشتقّ. */
export const BACKUP_STORES = STORE_NAMES.filter((name) => !(name in EXCLUDED_STORES));

/** يزيل الحقول المشتقّة من سجل. */
function stripDerived(record) {
  const clean = { ...record };
  for (const field of DERIVED_FIELDS) delete clean[field];
  return clean;
}

/** SHA-256 كنصّ ست عشري، أو null للملفات الضخمة. */
async function sha256Hex(blob) {
  if (blob.size > SHA256_MAX_BYTES) return null;
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * يقرأ مفاتيح store دون تحميل سجلاته.
 * الفارق حاسم مع `media`: تحميل كل السجلات يعني تحميل كل الصور
 * والأصوات في الذاكرة دفعةً واحدة — ما يُسقط التبويب على تابلت.
 */
async function keysOf(storeName) {
  return withTx(storeName, 'readonly', (tx) => req(tx.objectStore(storeName).getAllKeys()));
}

/**
 * يبني النسخة الاحتياطية داخل باني ZIP.
 *
 * الوسائط تُكتب واحدًا واحدًا: يُقرأ السجل، يُضاف الـ Blob كمرجع إلى
 * الأرشيف، ثم يُنسى. الذروة في الذاكرة = أكبر ملف مفرد، لا المكتبة كلها.
 *
 * @param {ReturnType<import('../../utils/zip.js').createZipBuilder>} zip
 * @param {(progress: {phase: string, done: number, total: number, label: string}) => void} [onProgress]
 * @returns {Promise<object>} الـ manifest
 */
export async function serializeInto(zip, onProgress = () => {}, { withBlobs = true } = {}) {
  const counts = {};
  const blobEntries = [];
  let blobBytes = 0;
  /** وسائطُ يعرفها البيانُ ولم تدخل بايتاتُها (النسخةُ الخفيفة). */
  const omitted = [];

  /* ---- 1. الوسائط أولًا: البايتات الحقيقية ---- */
  const mediaIds = await keysOf('media');
  const mediaMeta = [];

  for (let i = 0; i < mediaIds.length; i++) {
    const record = await ALL_REPOS.media.get(mediaIds[i]);
    if (!record) continue;

    onProgress({
      phase: 'media',
      done: i,
      total: mediaIds.length,
      label: `الوسائط ${i + 1} من ${mediaIds.length}`,
    });

    const { blob, thumbBlob, ...meta } = record;

    if (blob instanceof Blob && !withBlobs) {
      /*
       * ═══════════════════════════════════════════════════════════
       * ⚠️ **النسخةُ الخفيفة ليست صيغةً ثانية** (WS-H، بند J)
       * ═══════════════════════════════════════════════════════════
       *
       * نفسُ الـZIP ونفسُ البيان ونفسُ المحقِّق ونفسُ الاسترجاع الذرّيّ.
       * الفرقُ الوحيد: `blobs/` لا تُكتَب، والبيانُ **يظلّ يصف** ما كان
       * ليُكتَب فيها.
       *
       * وهذا يعمل بلا سطرٍ جديدٍ في الاسترجاع لأن الآلةَ القائمة تتوقّعه
       * أصلًا: `validate.js` يصنّف الملفَّ الغائب **تحذيرًا لا فادحًا**،
       * و`restore.js` يكتب `blob: null` حين لا يجد المدخل. فما بدا
       * ميزةً جديدةً كان حالةً من الدرجة الأولى في التصميم منذ البداية.
       *
       * ⚠️ **ولماذا نحتاجها أصلًا؟** لأن نسخةً كاملةً أسبوعيّةً بحجم
       *    ٢٫٤ جيجابايت تأكل حصّةَ Drive في شهر، و٩٥٪ منها بايتاتٌ
       *    **موجودةٌ على Drive أصلًا** في مخزن الوسائط. فالكاملةُ
       *    للإنقاذ من العدم، والخفيفةُ للرجوع أسبوعًا للوراء.
       */
      omitted.push({
        mediaId: record.id,
        role: BLOB_ROLE.ORIGINAL,
        bytes: blob.size,
        mime: record.mime || blob.type || null,
      });
      meta._originalEntry = null;
      meta._omitted = 1;
    } else if (blob instanceof Blob) {
      const path = originalPath(record.id, record.mime);
      const crcValue = await crc32Blob(blob);
      await zip.addBlob(path, blob, crcValue);
      blobEntries.push({
        mediaId: record.id,
        entry: path,
        role: BLOB_ROLE.ORIGINAL,
        bytes: blob.size,
        mime: record.mime || blob.type || null,
        crc32: crcValue,
        sha256: await sha256Hex(blob),
      });
      blobBytes += blob.size;
      meta._originalEntry = path;
    } else {
      meta._originalEntry = null;
    }

    if (thumbBlob instanceof Blob && !withBlobs) {
      omitted.push({ mediaId: record.id, role: BLOB_ROLE.THUMBNAIL, bytes: thumbBlob.size, mime: 'image/webp' });
      meta._thumbnailEntry = null;
    } else if (thumbBlob instanceof Blob) {
      const path = thumbnailPath(record.id);
      const crcValue = await crc32Blob(thumbBlob);
      await zip.addBlob(path, thumbBlob, crcValue);
      blobEntries.push({
        mediaId: record.id,
        entry: path,
        role: BLOB_ROLE.THUMBNAIL,
        bytes: thumbBlob.size,
        mime: 'image/webp',
        crc32: crcValue,
        sha256: await sha256Hex(thumbBlob),
      });
      blobBytes += thumbBlob.size;
      meta._thumbnailEntry = path;
    } else {
      meta._thumbnailEntry = null;
    }

    mediaMeta.push(stripDerived(meta));
  }

  counts.media = mediaMeta.length;

  /* ---- 2. باقي الـ stores: نصوص فقط ---- */
  const textStores = BACKUP_STORES.filter((name) => name !== 'media' && name !== 'settings');

  for (let i = 0; i < textStores.length; i++) {
    const storeName = textStores[i];
    onProgress({
      phase: 'data',
      done: i,
      total: textStores.length,
      label: `البيانات: ${storeName}`,
    });

    const repo = ALL_REPOS[storeName];
    const rows = repo ? await repo.getAll() : [];
    counts[storeName] = rows.length;
    zip.addText(`data/${storeName}.json`, JSON.stringify(rows.map(stripDerived)));
  }

  // الوسائط تُكتب بعد حلقتها لأن سجلاتها جُمعت أثناء نسخ البايتات.
  zip.addText('data/media.json', JSON.stringify(mediaMeta));

  // الإعدادات مفتاح/قيمة، بلا الحقول المشتركة — تُحفظ ككائن مسطّح.
  const allSettings = await settings.all();
  counts.settings = Object.keys(allSettings).length;
  zip.addText('data/settings.json', JSON.stringify(allSettings));

  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return {
    format: BACKUP_MAGIC,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    sourceDatabaseVersion: TARGET_VERSION,
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    createdAt: new Date().toISOString(),
    counts,
    totalRecords,
    bytes: { blobs: blobBytes },
    blobs: blobEntries,
    /**
     * نوعُ النسخة — **يُكتَب دائمًا** حتى للنسخ الكاملة.
     *
     * ⚠️ وقارئٌ قديمٌ لا يعرف الحقل يتجاهله ويقرأ النسخةَ كما كان
     *    يقرؤها، فلا يرتفع `BACKUP_FORMAT_VERSION` ولا تُبطَل نسخةٌ
     *    قديمةٌ واحدة.
     */
    backupKind: withBlobs ? 'full' : 'light',
    /** ما يعرفه البيانُ ولم يحمله الأرشيف — للنسخة الخفيفة. */
    omittedBlobs: omitted,
    excluded: Object.entries(EXCLUDED_STORES).map(([store, reason]) => ({ store, reason })),
  };
}

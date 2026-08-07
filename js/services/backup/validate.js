/**
 * LingoLife — فحص النسخة الاحتياطية قبل الاسترجاع
 *
 * ثلاثة مستويات، ولا شيء يُكتب في القاعدة قبل أن تمرّ كلها وتُعرض
 * نتيجتها على المستخدم:
 *
 *   1. بنيوي   الأرشيف سليم؟ الـ manifest موجود؟ الإصدار مدعوم؟
 *   2. مرجعي   هل كل رابط يشير إلى سجل موجود؟ هل هناك أيتام؟
 *   3. سلامة   هل كل ملف موجود بحجمه وبصمته الصحيحة؟
 *
 * مبدأ مهم: **لا نرفض النسخة كلها بسبب عطب جزئي.** رفض ملف بحجم
 * 6GB لأن صورة واحدة تالفة يعني أن يفقد المستخدم 99% لينجو 1%.
 * نصنّف: `fatal` يمنع الاسترجاع، و`warning` يُعرض ويقرّر هو.
 *
 * راجع docs/07-backup-format.md §7.5
 */

import { crc32Blob } from '../../utils/crc32.js';
import { BACKUP_MAGIC, PATHS } from './backup-format.js';
import { MAX_SUPPORTED_VERSION, MIN_SUPPORTED_VERSION, isSupportedVersion } from './backup-migrations.js';

/** روابط الانتماء: أي سجل يشير إلى أي store. */
const REFERENCES = [
  ['sceneMediaLinks', 'sceneId', 'scenes'],
  ['sceneMediaLinks', 'mediaId', 'media'],
  ['scripts', 'sceneId', 'scenes'],
  ['scriptVersions', 'scriptId', 'scripts'],
  ['contentBlocks', 'sceneId', 'scenes'],
  ['contentVersions', 'blockId', 'contentBlocks'],
  ['conversations', 'sceneId', 'scenes'],
  ['conversationParts', 'conversationId', 'conversations'],
  ['expressionOccurrences', 'expressionId', 'expressions'],
  ['expressionOccurrences', 'sceneId', 'scenes'],
  ['mistakeComparisons', 'sceneId', 'scenes'],
];

function issue(level, code, message, detail = null) {
  return { level, code, message, detail };
}

/**
 * المستوى 1 — بنيوي.
 * @param {Awaited<ReturnType<import('../../utils/zip.js').openZip>>} archive
 */
export async function validateStructure(archive) {
  const issues = [];

  if (!archive.has(PATHS.MANIFEST)) {
    issues.push(issue('fatal', 'no-manifest', 'الملف لا يحتوي على manifest.json — ليس نسخة LingoLife.'));
    return { issues, manifest: null };
  }

  let manifest;
  try {
    manifest = await archive.json(PATHS.MANIFEST);
  } catch {
    issues.push(issue('fatal', 'bad-manifest', 'ملف manifest.json تالف ولا يمكن قراءته.'));
    return { issues, manifest: null };
  }

  if (manifest.format !== BACKUP_MAGIC) {
    issues.push(
      issue('fatal', 'wrong-format', `توقيع غير معروف: ${manifest.format || '(فارغ)'} — متوقّع ${BACKUP_MAGIC}.`)
    );
  }

  if (!isSupportedVersion(manifest.backupFormatVersion)) {
    issues.push(
      issue(
        'fatal',
        'unsupported-version',
        manifest.backupFormatVersion > MAX_SUPPORTED_VERSION
          ? `النسخة بصيغة v${manifest.backupFormatVersion} أحدث من التطبيق (يدعم حتى v${MAX_SUPPORTED_VERSION}). حدّث التطبيق.`
          : `صيغة النسخة v${manifest.backupFormatVersion} غير مدعومة (الأدنى v${MIN_SUPPORTED_VERSION}).`
      )
    );
  }

  return { issues, manifest };
}

/**
 * المستوى 2 — مرجعي.
 * @param {Record<string, object[]>} data
 */
export function validateReferences(data) {
  const issues = [];
  const idSets = {};
  for (const [store, rows] of Object.entries(data)) {
    idSets[store] = new Set(rows.map((r) => r.id));
  }

  for (const [store, field, target] of REFERENCES) {
    const rows = data[store];
    const targetIds = idSets[target];
    if (!rows || !targetIds) continue;

    const orphans = rows.filter((row) => {
      const value = row[field];
      // null مقبول — الحقل اختياري في كثير من السجلات.
      return value != null && !targetIds.has(value);
    });

    if (orphans.length) {
      issues.push(
        issue(
          'warning',
          'orphan-reference',
          `${orphans.length} سجل في «${store}» يشير إلى ${target} غير موجود — سيُسترجع بلا ارتباط.`,
          { store, field, target, ids: orphans.slice(0, 10).map((r) => r.id) }
        )
      );
    }
  }

  return issues;
}

/**
 * المستوى 3 — سلامة الملفات.
 *
 * `deep` يتحقق من CRC-32 لكل ملف (يقرأ كل البايتات — بطيء على نسخة
 * كبيرة). بدونه نكتفي بوجود الملف ومطابقة حجمه، وهو فحص فوري يكشف
 * أغلب حالات النقل المبتور.
 */
export async function validateIntegrity(archive, manifest, { deep = false, onProgress } = {}) {
  const issues = [];
  const blobs = manifest.blobs || [];
  let checked = 0;

  for (const record of blobs) {
    onProgress?.({ done: checked++, total: blobs.length, label: record.entry });

    if (!archive.has(record.entry)) {
      issues.push(
        issue('warning', 'missing-blob', `ملف مفقود من الأرشيف: ${record.entry}`, {
          mediaId: record.mediaId,
        })
      );
      continue;
    }

    const entry = archive.entries.get(record.entry);

    if (entry.size !== record.bytes) {
      issues.push(
        issue(
          'warning',
          'size-mismatch',
          `حجم غير مطابق: ${record.entry} — متوقّع ${record.bytes} ووُجد ${entry.size}.`,
          { mediaId: record.mediaId }
        )
      );
      continue;
    }

    // CRC المخزّن في فهرس الأرشيف نفسه — مقارنة مجانية بلا قراءة بايتات.
    if (typeof record.crc32 === 'number' && entry.crc !== record.crc32) {
      issues.push(
        issue('warning', 'crc-mismatch-index', `بصمة الفهرس لا تطابق الـ manifest: ${record.entry}`, {
          mediaId: record.mediaId,
        })
      );
      continue;
    }

    if (deep) {
      const blob = await archive.blob(record.entry);
      const actual = await crc32Blob(blob);
      if (actual !== entry.crc) {
        issues.push(
          issue('warning', 'crc-mismatch', `الملف تالف — بصمته لا تطابق: ${record.entry}`, {
            mediaId: record.mediaId,
          })
        );
      }
    }
  }

  return issues;
}

/**
 * يقارن الأعداد المعلنة في الـ manifest بما وُجد فعلًا.
 * يكشف نسخة مبتورة حتى لو كان كل ملف موجود فيها سليمًا.
 */
export function validateCounts(manifest, data, settingsObj) {
  const issues = [];
  const declared = manifest.counts || {};

  for (const [store, expected] of Object.entries(declared)) {
    const actual = store === 'settings' ? Object.keys(settingsObj || {}).length : data[store]?.length ?? 0;
    if (actual !== expected) {
      issues.push(
        issue(
          'warning',
          'count-mismatch',
          `عدد غير مطابق في «${store}» — الـ manifest يقول ${expected} ووُجد ${actual}.`,
          { store, expected, actual }
        )
      );
    }
  }

  return issues;
}

/** هل بين المشاكل ما يمنع الاسترجاع؟ */
export function hasFatal(issues) {
  return issues.some((i) => i.level === 'fatal');
}

/** ملخّص بشري للعرض. */
export function summarize(issues) {
  return {
    fatal: issues.filter((i) => i.level === 'fatal').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
  };
}

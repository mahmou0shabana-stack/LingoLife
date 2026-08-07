/**
 * LingoLife — التصدير
 *
 * التصدير هو شبكة الأمان الأخيرة: ملكيتك الكاملة لبياناتك،
 * مستقلة عن هذا التطبيق وعن Google (docs/04 §4.5 الطبقة 5).
 *
 * الحالة في المرحلة 0: تصدير JSON للبيانات النصية.
 * حزمة .llife الكاملة (ZIP + الوسائط الأصلية) في المرحلة 1.
 */

import { ALL_REPOS, settings } from '../db/repositories.js';
import { EXPORTABLE_STORES } from '../db/schema.js';
import { SCHEMA_VERSION } from '../db/schema.js';
import { downloadBlob } from '../utils/dom.js';
import { APP_VERSION } from '../config.js';

/**
 * يبني كائن التصدير الكامل.
 * ⚠️ لا يتضمّن الـ Blobs — الوسائط تُصدَّر في حزمة .llife (المرحلة 1).
 */
export async function buildExport() {
  const data = {};
  let mediaCount = 0;

  for (const storeName of EXPORTABLE_STORES) {
    const repo = ALL_REPOS[storeName];
    if (!repo) continue;

    const rows = await repo.getAll();

    if (storeName === 'media') {
      mediaCount = rows.length;
      // البيانات الوصفية فقط — الـ Blob نفسه يُستبعد عمدًا.
      data[storeName] = rows.map(({ blob, thumbBlob, ...meta }) => ({
        ...meta,
        _blobExcluded: true,
      }));
    } else {
      data[storeName] = rows;
    }
  }

  return {
    format: 'lingolife-export',
    formatVersion: '1.0',
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    includesMedia: false,
    mediaFilesExcluded: mediaCount,
    settings: await settings.all(),
    data,
  };
}

/** يصدّر ويحمّل الملف. */
export async function exportToFile() {
  const payload = await buildExport();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(blob, `lingolife-export-${stamp}.json`);
  return {
    bytes: blob.size,
    records: Object.values(payload.data).reduce((sum, rows) => sum + rows.length, 0),
    mediaExcluded: payload.mediaFilesExcluded,
  };
}

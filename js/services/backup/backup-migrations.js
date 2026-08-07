/**
 * LingoLife — ترقيات صيغة النسخة الاحتياطية
 *
 * القاعدة الحاكمة: **الترقية باتجاه واحد فقط.**
 *
 *   نسخة v1 ──┐
 *   نسخة v2 ──┼──► سلسلة ترقيات ──► الصيغة الحالية ──► مستورد واحد ──► القاعدة
 *   نسخة v3 ──┘      (v1→v2→v3…)                        (وحيد)
 *
 * البديل الخاطئ أن يعرف كل إصدار قديم كيف يكتب في كل قاعدة جديدة —
 * وهذا ينفجر إلى N×M مسارًا يستحيل اختبارها. هنا كل صيغة جديدة
 * تكلّف دالة واحدة صغيرة، والمستورد يعرف الصيغة الحالية وحدها.
 *
 * وتعمل هذه الترقيات على JSON في الذاكرة فقط — لا تلمس IndexedDB،
 * ولا علاقة لها بترقيات `db/migrations.js`.
 *
 * القواعد (نفس قواعد ترقيات القاعدة، عمدًا):
 *  1. للأمام فقط. لا تعدّل ترقية سبق نشرها — أضف رقمًا جديدًا.
 *  2. أي حقل جديد يأتي بقيمة افتراضية، فلا تنكسر النسخ القديمة.
 *  3. لكل ترقية ملف ذهبي في `tests/fixtures/` يثبت أنها تعمل.
 *
 * راجع docs/07-backup-format.md §7.7
 */

import { BACKUP_FORMAT_VERSION } from './backup-format.js';

/**
 * @typedef {object} Bundle
 * @property {object} manifest
 * @property {Record<string, object[]>} data — سجلات كل store
 * @property {Record<string, any>} settings
 */

/**
 * سلسلة الترقيات. الترتيب تصاعدي إلزامي.
 * `from` هو الإصدار الذي تقرأه، والناتج يصبح `from + 1`.
 *
 * @type {{ from: number, note: string, up: (bundle: Bundle) => Bundle }[]}
 */
export const BACKUP_MIGRATIONS = [
  // ------------------------------------------------------------------
  // الصيغة الحالية هي 1 — فلا ترقيات بعد.
  //
  // مثال لما ستبدو عليه أول ترقية حقيقية عند الحاجة:
  //
  // {
  //   from: 1,
  //   note: 'فصل عنوان المشهد إلى titleAr و titleRu',
  //   up(bundle) {
  //     bundle.data.scenes = bundle.data.scenes.map((scene) => ({
  //       ...scene,
  //       titleAr: scene.titleAr ?? scene.title ?? '',
  //       titleRu: scene.titleRu ?? '',
  //     }));
  //     return bundle;
  //   },
  // },
  // ------------------------------------------------------------------
];

/** أعلى إصدار تستطيع السلسلة الوصول إليه. */
export const MAX_SUPPORTED_VERSION = BACKUP_FORMAT_VERSION;

/**
 * أقدم إصدار ما زلنا نقرؤه.
 * إنقاصه ممنوع — إسقاط دعم إصدار قديم يعني إبطال نسخ المستخدمين.
 */
export const MIN_SUPPORTED_VERSION = 1;

/** هل هذا الإصدار مدعوم؟ */
export function isSupportedVersion(version) {
  return (
    Number.isInteger(version) &&
    version >= MIN_SUPPORTED_VERSION &&
    version <= MAX_SUPPORTED_VERSION
  );
}

/**
 * يرقّي حزمة من إصدارها إلى الإصدار الحالي.
 *
 * @param {Bundle} bundle
 * @returns {{ bundle: Bundle, applied: number[], from: number, to: number }}
 */
export function migrateBundle(bundle) {
  const from = bundle.manifest?.backupFormatVersion;

  if (!isSupportedVersion(from)) {
    throw new Error(
      `إصدار النسخة الاحتياطية غير مدعوم: ${from}. ` +
        `المدعوم من ${MIN_SUPPORTED_VERSION} إلى ${MAX_SUPPORTED_VERSION}. ` +
        (from > MAX_SUPPORTED_VERSION
          ? 'النسخة أحدث من التطبيق — حدّث التطبيق ثم أعد المحاولة.'
          : 'النسخة أقدم من أن يقرأها هذا الإصدار.')
    );
  }

  let current = bundle;
  const applied = [];

  for (const migration of BACKUP_MIGRATIONS) {
    if (migration.from >= from && migration.from < MAX_SUPPORTED_VERSION) {
      current = migration.up(current);
      current.manifest = { ...current.manifest, backupFormatVersion: migration.from + 1 };
      applied.push(migration.from + 1);
    }
  }

  current.manifest = { ...current.manifest, backupFormatVersion: MAX_SUPPORTED_VERSION };
  return { bundle: current, applied, from, to: MAX_SUPPORTED_VERSION };
}

/**
 * LingoLife — النسخُ الاحتياطيّ السحابيّ (WS-H · بنود I…P)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **المزامنةُ ليست نسخةً احتياطيّة — والفرقُ في الغاية**
 * ═══════════════════════════════════════════════════════════════
 *
 *   المزامنة   توحّد **حالةَ أجهزتك الآن**
 *   النسخة     تعيدك إلى **حالةٍ كانت**
 *
 * وهما متضادّان: المزامنةُ تنشر ما حدث، والاسترجاعُ يتراجع عنه. ولذلك
 * لا يُبنى أحدُهما فوق الآخر، ولذلك يوقف `restore-guard` المزامنةَ بعد
 * كلّ استرجاع.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا صيغةَ ثانية** (بند J)
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا الملفّ لا يعرف ZIP ولا بيانًا ولا استرجاعًا. ينادي `buildBackup`
 * القائمة بعَلَمٍ واحد، ويسلّم الناتجَ للناقل. والاسترجاعُ يمرّ على
 * `inspectBackup` و`restoreBackup` **كما هما** — نفسُ الفحص الثلاثيّ،
 * ونفسُ اللحظة الذرّية.
 */

import { buildBackup } from '../backup/export.js';
import { inspectBackup, restoreBackup } from '../backup/restore.js';
import { media } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { BACKUP_KIND } from './transport.js';

/**
 * سياساتُ الاستبقاء (بند M).
 *
 * ⚠️ **ولا شيءَ منها يعمل تلقائيًّا اليوم.** المواصفةُ تقول: «لا تبدأ
 *    بحذف Backups قديمة تلقائيًا قبل وجود سياسة واضحة وموافقة
 *    المستخدم». فهذه القيمُ **معروضةٌ للاختيار** والحذفُ لا يقع إلّا
 *    بنداءٍ صريحٍ منك.
 */
export const RETENTION = Object.freeze({
  ALL: { id: 'all', label: 'احتفظ بكل النسخ', keep: Infinity },
  KEEP_3: { id: 'keep3', label: 'آخر ٣ نسخ', keep: 3 },
  KEEP_5: { id: 'keep5', label: 'آخر ٥ نسخ', keep: 5 },
  KEEP_10: { id: 'keep10', label: 'آخر ١٠ نسخ', keep: 10 },
});

/**
 * تقريرٌ يُعرَض **قبل** النسخة الكاملة (بند ١٥ من الطلب).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ونسخةٌ كاملةٌ ينقصها ملفّاتٌ ليست كاملة**
 * ═══════════════════════════════════════════════════════════════
 *
 * جهازٌ فرّغ نسخَه المحلّيّة (بند F) عنده الوصفُ بلا البايتات. ونسخةٌ
 * «كاملة» منه تحمل السجلّاتِ وتترك الملفّات — وتسمّي نفسَها كاملة.
 *
 * وهي الكذبةُ الأخطر في هذا الملفّ كلِّه: تكتشفها **يوم تحتاجها**.
 * فالتقريرُ يُعرَض قبلها، والخياراتُ ثلاثة: نزّل الناقص، أو اعمل خفيفة،
 * أو تابع وأنت تعرف.
 */
export async function fullBackupReadiness() {
  const rows = (await media.getAll()).filter((row) => row.state !== STATE.TRASHED);
  const cloudOnly = rows.filter((row) => !row.blob && row.blobPending === 1);
  const bytes = cloudOnly.reduce((sum, row) => sum + (row.bytes || 0), 0);

  return {
    complete: cloudOnly.length === 0,
    totalMedia: rows.length,
    missingLocally: cloudOnly.length,
    missingBytes: bytes,
    missingIds: cloudOnly.map((row) => row.id),
    warning: cloudOnly.length
      ? `فيه ${cloudOnly.length} ملف موجود على Drive بس مش على الجهاز ده — النسخة الكاملة مش هتشملهم.`
      : null,
  };
}

/**
 * يبني نسخةً ويرفعها.
 *
 * @param {object} transport
 * @param {{ kind?: string, onProgress?: Function }} options
 */
export async function createCloudBackup(transport, { kind = BACKUP_KIND.FULL, onProgress = () => {} } = {}) {
  const withBlobs = kind === BACKUP_KIND.FULL;

  onProgress({ phase: 'build', label: withBlobs ? 'بيبني نسخة كاملة' : 'بيبني نسخة خفيفة' });
  const built = await buildBackup(
    (progress) => onProgress({ phase: 'build', ...progress }),
    { withBlobs }
  );

  onProgress({ phase: 'upload', label: 'بيرفع على Drive', bytes: built.blob.size });
  const uploaded = await transport.putBackup(built.blob, {
    kind,
    manifest: built.manifest,
    at: new Date(built.manifest.createdAt),
  });

  return {
    ok: true,
    kind,
    fileId: uploaded.fileId,
    name: uploaded.name,
    bytes: built.blob.size,
    counts: built.manifest.counts,
    blobCount: (built.manifest.blobs || []).length,
    omittedCount: (built.manifest.omittedBlobs || []).length,
  };
}

/** يسرد النسخَ مع تصنيفها — للعرض في الإعدادات. */
export async function listCloudBackups(transport) {
  const rows = await transport.listBackups();
  return rows.map((row) => ({
    ...row,
    kindLabel: row.kind === BACKUP_KIND.FULL ? 'كاملة' : 'خفيفة',
    /*
     * ⚠️ **والخفيفةُ تُعلن اعتمادَها.** «هترجع بس لو ملفّات Drive
     *    موجودة» ليست تفصيلةً فنّيّة — هي الفرقُ بين نسخةٍ تنقذك ونسخةٍ
     *    تخذلك، ويجب أن تُقرأ قبل الاختيار لا بعده.
     */
    dependsOnCloudMedia: row.kind !== BACKUP_KIND.FULL,
  }));
}

/**
 * يفحص نسخةً من Drive — **بلا لمس القاعدة** (بند O).
 *
 * ⚠️ ونفسُ `inspectBackup` التي يستعملها الاستيرادُ اليدويّ من ملفّ.
 *    فالفحصُ الثلاثيّ نفسُه، والتحذيراتُ نفسُها، ولا مسارَ فحصٍ ثانٍ
 *    يتقادم وحدَه.
 */
export async function inspectCloudBackup(transport, fileId, { onProgress = () => {} } = {}) {
  onProgress({ phase: 'download', label: 'بينزّل النسخة' });
  const blob = await transport.fetchBackup(fileId, { onProgress });

  onProgress({ phase: 'inspect', label: 'بيفحص — مش بيلمس بياناتك' });
  const inspection = await inspectBackup(blob, { deep: true });

  const kind = inspection?.manifest?.backupKind || BACKUP_KIND.FULL;
  const omitted = inspection?.manifest?.omittedBlobs || [];

  return {
    ...inspection,
    kind,
    omittedBlobs: omitted,
    /* شرحٌ بشريٌّ يُعرَض قبل التأكيد. */
    preview: {
      createdAt: inspection?.manifest?.createdAt ?? null,
      records: inspection?.totalRecords ?? 0,
      blobs: inspection?.blobCount ?? 0,
      kindLabel: kind === BACKUP_KIND.FULL ? 'كاملة' : 'خفيفة',
      note: kind === BACKUP_KIND.FULL
        ? 'النسخة دي فيها الملفّات كلها — هترجع لوحدها.'
        : `النسخة دي فيها السجلّات بس. ${omitted.length} ملف هيرجعوا من Drive لما تحتاجهم.`,
    },
  };
}

/**
 * يسترجع نسخةً — **بالمسار الذرّيّ القائم، وبلا دمجٍ أبدًا** (بند O).
 *
 * ⚠️ **ولا يُنادى إلّا بعد تأكيدٍ صريحٍ من الإنسان.** التوقيعُ يطلب
 *    `confirmed: true` لا كتجميل: نداءٌ بلا تأكيدٍ يرمي، فلا يمكن أن
 *    يتسرّب استرجاعٌ من مسارٍ آليّ.
 *
 * ⚠️ **وبعده تتوقّف المزامنة** — لا هنا، بل بحكم `restore-guard`: القاعدةُ
 *    استُبدلت فمتّجهُها تراجع، وذاك يكشف نفسَه عند أوّل اتّصال. فلا
 *    يعتمد الأمانُ على أن يتذكّر هذا الملفُّ شيئًا.
 */
export async function restoreCloudBackup(inspection, { confirmed = false, onProgress = () => {} } = {}) {
  if (!confirmed) {
    throw new Error('الاسترجاع محتاج تأكيد صريح — مفيش استرجاع تلقائي.');
  }
  if (!inspection?.ok) {
    throw new Error('النسخة دي مش صالحة للاسترجاع.');
  }
  const result = await restoreBackup(inspection, { onProgress });
  return {
    ...result,
    /* ⚠️ إشارةٌ للشاشة: اعرض قرارَ ما بعد الاسترجاع. */
    syncWillPause: true,
    kind: inspection.kind,
  };
}

/** يطبّق سياسةَ استبقاءٍ — **بنداءٍ صريحٍ منك وحدَه**. */
export async function applyRetention(transport, policy, { confirmed = false } = {}) {
  const keep = RETENTION[policy]?.keep ?? Infinity;
  if (!Number.isFinite(keep)) return { deleted: 0, kept: 'الكل' };
  if (!confirmed) throw new Error('حذف النسخ القديمة محتاج تأكيد صريح.');
  if (typeof transport.deleteBackup !== 'function') {
    return { deleted: 0, unsupported: true };
  }

  const rows = await transport.listBackups();
  const doomed = rows.slice(keep);
  for (const row of doomed) {
    /* eslint-disable-next-line no-await-in-loop -- نسخةٌ بعد نسخة */
    await transport.deleteBackup(row.fileId);
  }
  return { deleted: doomed.length, kept: Math.min(keep, rows.length) };
}

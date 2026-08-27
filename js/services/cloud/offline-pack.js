/**
 * LingoLife — حزمُ الأوفلاين وحصرُ الوسائط (WS-H · بنود C…F و T)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **«ملفّاتُ الذكرى» تُكتشَف ولا تُسجَّل**
 * ═══════════════════════════════════════════════════════════════
 *
 * المواصفةُ صريحة: «يجب اكتشافها من العلاقات الحالية، وليس إنشاء قائمة
 * ملفات منفصلة للذكرى».
 *
 * والسببُ ليس أناقة. قائمةٌ موازيةٌ تعني مصدرَ حقيقةٍ ثانيًا: تربط صوتًا
 * بجزءٍ في الورشة فلا تعرف القائمةُ، أو تنقل عقدةً فتبقى القائمةُ على
 * حالها. فتقول الشاشةُ «الذكرى متاحة أوفلاين» وفيها ملفٌّ لم يُنزَّل —
 * وتكتشف ذلك في القطار.
 *
 * فالحصرُ يمشي على **نفس الحوافّ التي يرسم بها التطبيقُ الشجرة**:
 *
 *   المشهد ──sceneMediaLinks──▶ وسائط
 *     └── سكريبتاته (sceneId)
 *           └── كلُّ ذرّيّته عبر `script:script`
 *                 └── كلُّ حافّة `audio:script` و`image:script`
 *
 * فما يظهر في الشاشة يدخل الحزمة، بحكم أنهما يقرآن نفسَ الحوافّ.
 */

import { media, relationships, scripts, sceneMediaLinks } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { LINK } from '../link-service.js';
import { PART_OF } from '../sync/merge-planner.js';
import { BLOB_ROLE } from './transport.js';
import { isCloudOnly } from './media-transfer.js';

/** عمقٌ أقصى — نفسُ سقف الورشة، وحارسٌ ضدّ حلقةٍ لو وُجدت. */
const MAX_DEPTH = 12;

/**
 * كلُّ عُقَد نصّ الذكرى: سكريبتاتُها وكلُّ ذرّيّتها.
 *
 * ⚠️ **بقراءتين لا بقراءةٍ لكلّ عقدة.** `relationships.byIndex('kind')`
 *    تعطي حوافَّ الشجرة كلَّها دفعةً — وهو نفسُ ما تفعله ورشةُ WS-F،
 *    ولنفس السبب: مسحُ الشجرة عقدةً عقدةً يعني عشرات الاستعلامات لذكرى
 *    واحدة.
 */
export async function textNodesOf(sceneId) {
  const [own, edges] = await Promise.all([
    scripts.byIndex('sceneId', sceneId),
    relationships.byIndex('kind', PART_OF),
  ]);

  const children = new Map();
  for (const edge of edges) {
    if (edge.state !== STATE.ACTIVE) continue;
    if (!children.has(edge.fromId)) children.set(edge.fromId, []);
    children.get(edge.fromId).push(edge.toId);
  }

  const seen = new Set();
  const walk = (id, depth) => {
    if (depth > MAX_DEPTH || seen.has(id)) return;
    seen.add(id);
    for (const child of children.get(id) || []) walk(child, depth + 1);
  };
  for (const row of own) {
    if (row.state === STATE.TRASHED) continue;
    walk(row.id, 0);
  }
  return [...seen];
}

/**
 * كلُّ معرِّفات الوسائط التي تخصّ ذكرى.
 *
 * @param {string} sceneId
 * @param {{ kind?: 'audio'|'image'|null }} options
 */
export async function mediaIdsOfScene(sceneId, { kind = null } = {}) {
  const nodes = new Set(await textNodesOf(sceneId));

  const [links, audioEdges, imageEdges] = await Promise.all([
    sceneMediaLinks.byIndex('sceneId', sceneId),
    relationships.byIndex('kind', LINK.AUDIO_SCRIPT),
    relationships.byIndex('kind', LINK.IMAGE_SCRIPT),
  ]);

  const ids = new Set();
  for (const link of links) {
    if (link.state === STATE.TRASHED) continue;
    ids.add(link.mediaId);
  }
  for (const edge of [...audioEdges, ...imageEdges]) {
    if (edge.state !== STATE.ACTIVE) continue;
    /* الوسيطُ طرفٌ والعقدةُ طرف — والاتّجاهُ محفوظٌ لكن نقبل الاثنين. */
    if (nodes.has(edge.toId)) ids.add(edge.fromId);
    else if (nodes.has(edge.fromId)) ids.add(edge.toId);
  }

  if (!ids.size) return [];
  const rows = (await media.getMany([...ids])).filter(Boolean);
  return rows
    .filter((row) => row.state !== STATE.TRASHED)
    .filter((row) => !kind || row.kind === kind)
    .map((row) => row.id);
}

/**
 * تقريرٌ يُعرَض **قبل** التنزيل (بند C).
 *
 * ⚠️ **والأحجامُ من `media.bytes` لا من فكِّ البلوبات** (بند T): قراءةُ
 *    أربعةِ جيجابايتٍ لتعرف أنها أربعةُ جيجابايت عبثٌ يُجمّد التابلت.
 *    والحقلُ مكتوبٌ منذ الإضافة.
 */
export async function offlineReport(mediaIds) {
  const rows = (await media.getMany([...new Set(mediaIds)])).filter(Boolean);
  const local = [];
  const missing = [];

  for (const row of rows) {
    (row.blob ? local : missing).push(row);
  }

  const bytesOf = (list) => list.reduce((sum, row) => sum + (row.bytes || 0), 0);
  const count = (list, kind) => list.filter((r) => r.kind === kind).length;

  return {
    total: rows.length,
    audio: count(rows, 'audio'),
    image: count(rows, 'image'),
    local: {
      count: local.length,
      audio: count(local, 'audio'),
      image: count(local, 'image'),
      bytes: bytesOf(local),
    },
    missing: {
      count: missing.length,
      audio: count(missing, 'audio'),
      image: count(missing, 'image'),
      bytes: bytesOf(missing),
      ids: missing.map((r) => r.id),
    },
    /** ⚠️ «متاحة أوفلاين» تعني صفرَ ناقص — لا «أغلبها». */
    complete: missing.length === 0,
  };
}

/** تقريرُ ذكرى — الواجهةُ التي تناديها صفحةُ الذكرى. */
export async function sceneOfflineReport(sceneId, { kind = null } = {}) {
  return offlineReport(await mediaIdsOfScene(sceneId, { kind }));
}

/**
 * حصرٌ عامٌّ لكلّ الوسائط (بند E).
 *
 * ⚠️ **ولا يُنادى الناقلُ لعدّ ما في السحابة.** سجلُّ `media` وصل عبر
 *    المزامنة أصلًا ويعرف كلَّ ملفٍّ في الكون — فسردُ Drive نداءُ شبكةٍ
 *    يعيد ما نعرفه. والناقلُ يُسأل عند التنزيل، لا عند العدّ.
 */
export async function storageReport() {
  const rows = (await media.getAll()).filter((row) => row.state !== STATE.TRASHED);
  const local = rows.filter((row) => row.blob);
  const cloudOnly = rows.filter((row) => isCloudOnly(row));
  /*
   * ⚠️ **وصفٌّ بلا بلوبٍ وبلا علامةِ انتظارٍ ليس سحابيًّا — هو مجهول.**
   *    وسيطٌ أُنشئ محلّيًّا ثم فُقدت بايتاتُه لسببٍ ما ليس «موجودًا على
   *    Drive»، وادّعاءُ ذلك يَعِد بتنزيلٍ لن ينجح.
   */
  const unknown = rows.filter((row) => !row.blob && row.blobPending !== 1);

  const bytesOf = (list) => list.reduce((sum, row) => sum + (row.bytes || 0), 0);

  return {
    total: rows.length,
    totalBytes: bytesOf(rows),
    local: { count: local.length, bytes: bytesOf(local) },
    cloudOnly: { count: cloudOnly.length, bytes: bytesOf(cloudOnly), ids: cloudOnly.map((r) => r.id) },
    unknown: { count: unknown.length, ids: unknown.map((r) => r.id) },
    audio: rows.filter((r) => r.kind === 'audio').length,
    image: rows.filter((r) => r.kind === 'image').length,
    /** ما يمكن تحريرُه بإزالة النسخ المحلّيّة التي لها نسخةٌ سحابيّة. */
    reclaimable: bytesOf(local.filter((row) => row.driveFileId)),
  };
}

/**
 * يُزيل النسخَ المحلّيّة (بند F).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **هذا ليس حذفًا — وخلطُهما يفقد بياناتٍ**
 * ═══════════════════════════════════════════════════════════════
 *
 *   حذفُ وسيط        المحتوى نفسُه يذهب — من كلّ الأجهزة، بعد تأكيد
 *   إزالةُ النسخة    البايتاتُ تُفرَّغ من **هذا الجهاز** وحدَه
 *
 * فهنا: لا يُمَسّ صفٌّ، ولا علاقةٌ، ولا ملفٌّ على Drive. يعود الوسيطُ
 * إلى ما كان عليه قبل أن تُنزّله — ويمكن تنزيلُه ثانيةً.
 *
 * ⚠️ **ولا يُفرَّغ ما ليس له نسخةٌ سحابيّة.** بايتاتٌ لم تُرفَع بعدُ
 *    هي **النسخةُ الوحيدة** في العالم، وتفريغُها فقدٌ لا توفير.
 */
export async function removeLocalCopies(mediaIds, { dryRun = false } = {}) {
  const rows = (await media.getMany([...new Set(mediaIds)])).filter(Boolean);
  const eligible = rows.filter((row) => row.blob && row.driveFileId);
  const skipped = rows.filter((row) => row.blob && !row.driveFileId);

  const freed = eligible.reduce((sum, row) => sum + (row.bytes || 0), 0);
  const report = {
    eligible: eligible.length,
    freed,
    skipped: skipped.length,
    skippedReason: skipped.length
      ? 'مفيش نسخة على Drive لسه — دي النسخة الوحيدة، فمش هتتشال'
      : null,
  };

  if (dryRun) return report;

  for (const row of eligible) {
    /* eslint-disable-next-line no-await-in-loop -- صفٌّ بعد صفّ */
    await media.update(row.id, { blob: null, thumbBlob: null, blobPending: 1 });
  }
  return { ...report, removed: eligible.length };
}

/** أدوارُ البايتات المطلوبة لتشغيلٍ حقيقيّ — الأصلُ دائمًا. */
export const PLAYABLE_ROLES = Object.freeze([BLOB_ROLE.ORIGINAL]);

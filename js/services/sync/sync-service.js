/**
 * LingoLife — واجهةُ المزامنة (WS-G · بنود ٦٨ و٦٩ و٩٢)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **هذا هو السطحُ الذي ستراه المرحلةُ الثانية — ولا شيءَ غيرَه**
 * ═══════════════════════════════════════════════════════════════
 *
 * حين يُوصَل Google Drive غدًا، عملُه كلُّه أن **ينقل** ما تعطيه هذه
 * الدوالُّ وأن **يسلّم** ما تقبله. ولا سطرَ من منطق الدمج ينتقل إليه —
 * وإلّا صار لكلّ ناقلٍ دمجُه، فاختلفت النتيجةُ باختلاف الطريق.
 *
 *   getLocalDevice()        من أنا
 *   peers() / forgetPeer()  من أعرف
 *   createPackageFor(peer)  ما عندي وليس عنده
 *   inspectPackage(pkg)     ماذا في هذه الحزمة — بلا لمس
 *   planMerge(pkg)          ماذا سيحدث — بلا كتابة
 *   resolveConflict(...)    قرارُك
 *   applyMerge(plan)        اكتب — أو لا تكتب شيئًا
 *   acknowledgePackage(...) وصلت فعلًا
 */

import { withTx, req } from '../../db/database.js';
import { rebuildIndex } from '../memory/indexer.js';
import { localDevice, deviceId } from './device.js';
import { vectorOf } from './change-log.js';
import { createSyncPackage, inspectSyncPackage, validateSyncPackage } from './sync-package.js';
import { planMerge } from './merge-planner.js';
import { applyMerge } from './merge-apply.js';
import { resolveConflict, applicable, planSummary, summaryLine, unresolved } from './conflicts.js';

export { planMerge, applyMerge, resolveConflict, applicable, planSummary, summaryLine, unresolved };
export { inspectSyncPackage, validateSyncPackage };
export { logicalState, diffLogical, describeDiff } from './logical-state.js';
export { CONFLICT, RESOLUTION } from './conflicts.js';
export { policyMatrix } from './sync-policy.js';

const PEERS = 'syncPeers';

/** من أنا. */
export function getLocalDevice() {
  return localDevice();
}

/** متّجهُ هذا الجهاز — «ماذا أعرف من تأليف من». */
export async function localVector() {
  return withTx('changeLog', 'readonly', (tx) => vectorOf(tx));
}

/** كلُّ الجيران المعروفين. */
export async function peers() {
  const rows = await withTx(PEERS, 'readonly', (tx) => req(tx.objectStore(PEERS).getAll()));
  return rows.sort((a, b) => (b.lastExchangeAt ?? 0) - (a.lastExchangeAt ?? 0));
}

async function readPeer(peerId) {
  return withTx(PEERS, 'readonly', (tx) => req(tx.objectStore(PEERS).get(peerId)));
}

async function writePeer(peerId, patch) {
  return withTx(PEERS, 'readwrite', async (tx) => {
    const store = tx.objectStore(PEERS);
    const existing = (await req(store.get(peerId))) || {
      id: peerId, label: '', vector: {}, packagedVector: {}, ackedVector: {},
      lastPackageId: null, lastExchangeAt: null,
    };
    const row = { ...existing, ...patch, id: peerId, updatedAt: Date.now() };
    await req(store.put(row));
    return row;
  });
}

/** ينسى جارًا — لا يمسّ بيانات، يمسح معرفةً فقط. */
export async function forgetPeer(peerId) {
  await withTx(PEERS, 'readwrite', (tx) => req(tx.objectStore(PEERS).delete(peerId)));
}

/**
 * يبني حزمةً لجارٍ بعينه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والتصديرُ ليس تسليمًا** (بند ٦٨)
 * ═══════════════════════════════════════════════════════════════
 *
 * تُسجَّل الحزمةُ في `packagedVector` لا في `ackedVector`. والفرقُ ليس
 * دقّةً لفظيّة: حزمةٌ بُنيت ورُفعت وسقطت الشبكةُ لم تصل، فلو عددناها
 * واصلةً لَما أُرسل محتواها ثانيةً أبدًا — وهو **فقدٌ صامت** بحرفه
 * (بند ٤١).
 *
 * ⚠️ **ولا يُمسَح `dirty` هنا.** كان أوّلُ تصميمٍ يمسحه عند التصدير،
 *    وهو نفسُ الخطأ بثوبٍ آخر: صفٌّ نظيفٌ لم يصل أحدًا.
 *
 * @param {string|null} peerId — اتركه فارغًا لحزمةِ **خطِّ أساسٍ كاملة**
 */
export async function createPackageFor(peerId = null) {
  const peer = peerId ? await readPeer(peerId) : null;
  /*
   * ⚠️ **وجارٌ لا نعرفه يأخذ كلَّ شيء** (بند ٨٦ حالة أ): متّجهٌ فارغٌ
   *    يعني «لا يعرف شيئًا»، فتحمل الحزمةُ كلَّ سطرٍ في السجلّ. وهذا
   *    هو بذرُ الجهاز الجديد بلا آليّةٍ خاصّةٍ به.
   */
  const pkg = await createSyncPackage({ peerVector: peer?.vector || {}, peerId });
  if (peerId) {
    await writePeer(peerId, {
      packagedVector: pkg.sourceVector,
      lastPackageId: pkg.packageId,
      lastExchangeAt: Date.now(),
    });
  }
  return pkg;
}

/**
 * يسجّل أن جارًا **استلم** حزمةً فعلًا.
 *
 * ⚠️ ولا يُنادى إلّا بإقرارٍ من الطرف الآخر. ونداؤه بعد الرفع مباشرةً
 *    يعيد الخطأَ الذي يمنعه بند ٦٨ حرفًا بحرف.
 */
export async function acknowledgePackage(peerId, packageId, peerVector = null) {
  const peer = await readPeer(peerId);
  if (!peer) throw new Error(`جارٌ غيرُ معروف: ${peerId}`);
  if (peer.lastPackageId !== packageId) {
    throw new Error(`إقرارٌ لحزمةٍ أخرى: ${packageId} (آخرُ ما بُني ${peer.lastPackageId})`);
  }
  return writePeer(peerId, {
    ackedVector: peer.packagedVector || {},
    vector: peerVector || peer.vector || {},
    lastExchangeAt: Date.now(),
  });
}

/**
 * يسجّل ما وصل من جارٍ — يُنادى بعد تطبيقٍ ناجح.
 *
 * ⚠️ **ويحفظ `sourceVector` الحزمة**: صار الجارُ يعرف ما نعرف عنه،
 *    فالحزمةُ القادمةُ منه تبدأ من هناك لا من الصفر (بند ٣٣).
 */
export async function recordReceived(pkg) {
  return writePeer(pkg.sourceDeviceId, {
    label: pkg.sourceDeviceLabel || '',
    vector: pkg.sourceVector || {},
    lastExchangeAt: Date.now(),
  });
}

/**
 * دورةٌ كاملةٌ: افحص ← خطّط ← (حُلّ) ← طبّق ← سجّل.
 *
 * ترمي إن بقي تعارضٌ بلا قرار — وهذا هو المقصود (بند ٤١).
 */
export async function receivePackage(pkg, { resolutions = [], onProgress } = {}) {
  const plan = await planMerge(pkg);
  if (!plan.ok) return { ok: false, plan };

  for (const { id, resolution, value } of resolutions) {
    resolveConflict(plan, id, resolution, value);
  }
  if (!applicable(plan)) return { ok: false, plan, blocked: unresolved(plan) };

  const result = await applyMerge(plan, { onProgress, rebuild: runRebuilds });
  await recordReceived(pkg);
  return { ok: true, plan, result };
}

/**
 * إعادةُ بناء المشتقّ بعد الدمج (بند ٩).
 *
 * ⚠️ **ولا يُنقَل صفٌّ مشتقٌّ في حزمة، ولا يُبنى إلّا ما له بانٍ.**
 *    `memoryOccurrences` له `rebuildIndex`؛ و`searchIndex` معلَنٌ في
 *    الـschema ولا يكتبه شيءٌ في التطبيق، فلا يُوعَد ببنائه.
 */
export async function runRebuilds(targets) {
  const out = {};
  if (targets.includes('memory')) out.memory = await rebuildIndex();
  return out;
}

/** ملخّصٌ للشاشة والتقرير. */
export async function syncStatus() {
  const [vector, list] = await Promise.all([localVector(), peers()]);
  return {
    device: getLocalDevice(),
    vector,
    changes: Object.values(vector).reduce((sum, n) => sum + n, 0),
    peers: list.map((peer) => ({
      id: peer.id,
      label: peer.label,
      lastExchangeAt: peer.lastExchangeAt,
      /* ⚠️ «بُنيت» و«وصلت» رقمان لا رقم. */
      packaged: Object.values(peer.packagedVector || {}).reduce((s, n) => s + n, 0),
      acknowledged: Object.values(peer.ackedVector || {}).reduce((s, n) => s + n, 0),
      knownRemote: Object.values(peer.vector || {}).reduce((s, n) => s + n, 0),
    })),
    self: deviceId(),
  };
}

/**
 * LingoLife — محاكي Drive (WS-H · بنود ٢ و٣٠…٣٢ و٣٨ و٤٨)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **يحاكي الشبكةَ ولا يحاكي المزامنة**
 * ═══════════════════════════════════════════════════════════════
 *
 * بند ٣٨ صريح: تُزيَّف الشبكةُ ولا تُزيَّف الدلالة. فهذا الملفّ يحمل
 * بايتاتٍ في الذاكرة ويرمي أخطاءَ شبكةٍ حقيقيّةَ الشكل — والحزمُ التي
 * يحملها تمرّ بعده على **مُحقِّق WS-G ومخطِّطه وتطبيقه الذرّيّ** بلا
 * تعديلٍ حرف.
 *
 * ولذلك ما يمرّ هنا يمرّ على Drive، وما ينكسر هنا كان سينكسر عليه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والأعطالُ تُحقَن ولا تُفترَض**
 * ═══════════════════════════════════════════════════════════════
 *
 * «تعامَلنا مع انقطاع الشبكة» جملةٌ لا تعني شيئًا حتى ينقطع اتصالٌ
 * فعلًا في منتصف رفعٍ فعليّ ويُرى ما يبقى. فهنا `fail()` تحقن عطبًا
 * في عمليّةٍ بعينها، و`cutAfter` تقطع تنزيلًا في منتصف بايتاته.
 */

import {
  BACKUP_KIND, BLOB_ROLE, FAIL, TransportError, UNIVERSE_PREFIX,
  backupFileName, blobFileName, deviceStateFileName, packageFileName,
} from './transport.js';
import { newId } from '../../utils/ids.js';

/**
 * سحابةٌ مشتركةٌ بين «أجهزة» الاختبار.
 *
 * ⚠️ **وهي منفصلةٌ عن الناقل عمدًا**: كلُّ جهازٍ يأخذ ناقلَه (بحالة
 *    اتصالِه وأعطالِه وعدّاداتِه)، والسحابةُ واحدةٌ يشتركون فيها —
 *    تمامًا كـDrive. ولو كانت داخل الناقل لَما رأى جهازٌ ما كتبه غيرُه.
 */
export function createMockCloud() {
  return {
    universe: null,
    /** ملفّاتٌ بمعرِّفٍ مولَّد، لكلٍّ `role` و`props` و`body`. */
    files: new Map(),
    /** ⚠️ سجلُّ كلّ كتابةٍ — يكشف «هل استُبدل ملفٌّ؟» في الاختبار. */
    writes: [],
  };
}

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/**
 * ينشئ ناقلًا محاكيًا لجهاز.
 *
 * @param {object} cloud — من `createMockCloud()`، مشتركةٌ بين الأجهزة
 * @param {{ account?: string, latency?: number }} options
 */
export function createMockTransport(cloud, { account = 'test@example.com', latency = 0 } = {}) {
  let connected = false;
  let online = true;
  /** أعطالٌ مُبرمَجة: اسمُ العمليّة → {category, times, cutAfter} */
  const faults = new Map();
  const counts = {};

  const tick = (op) => { counts[op] = (counts[op] || 0) + 1; };

  async function gate(op) {
    tick(op);
    if (latency) await new Promise((r) => setTimeout(r, latency));

    if (!online) throw new TransportError(FAIL.OFFLINE, 'مفيش إنترنت (محاكاة)');
    if (!connected && op !== 'connect') {
      throw new TransportError(FAIL.AUTH, 'مش متصل بـ Google Drive (محاكاة)');
    }

    const fault = faults.get(op);
    if (!fault) return null;
    if (fault.times > 0) {
      fault.times -= 1;
      if (fault.times === 0) faults.delete(op);
      if (fault.category) {
        throw new TransportError(fault.category, `عطبٌ محقونٌ في ${op}`, { status: fault.status });
      }
      return fault; /* عطبٌ جزئيّ (قطعُ تنزيل) — يعالجه النداء نفسُه */
    }
    return null;
  }

  const put = (role, name, props, body) => {
    const id = `FILE_${newId('MK')}`;
    cloud.files.set(id, { id, role, name, props: { ...props }, body, at: Date.now() });
    cloud.writes.push({ id, role, name, at: Date.now() });
    return id;
  };

  const find = (predicate) => [...cloud.files.values()].filter(predicate);

  const transport = {
    id: 'mock-drive',
    label: 'محاكي Google Drive',

    /* ---------------- الاتّصال ---------------- */

    async connect() {
      tick('connect');
      if (!online) throw new TransportError(FAIL.OFFLINE, 'مفيش إنترنت (محاكاة)');
      const fault = faults.get('connect');
      if (fault?.times > 0) {
        fault.times -= 1;
        throw new TransportError(fault.category, 'فشل الاتصال (محاكاة)');
      }
      connected = true;
      return { ok: true, account };
    },

    async disconnect() {
      tick('disconnect');
      connected = false;
      return true;
    },

    isConnected() { return connected; },
    identity() { return connected ? { account } : null; },

    /* ---------------- الكونُ السحابيّ ---------------- */

    async discover() {
      await gate('discover');
      return cloud.universe
        ? { found: true, universeId: cloud.universe.id, createdAt: cloud.universe.createdAt,
            supersededBy: cloud.universe.supersededBy ?? null }
        : { found: false, universeId: null };
    },

    async createUniverse({ supersedes = null } = {}) {
      await gate('createUniverse');
      cloud.universe = {
        id: newId(UNIVERSE_PREFIX),
        createdAt: Date.now(),
        supersededBy: null,
      };
      if (supersedes) cloud.universe.supersedes = supersedes;
      return { universeId: cloud.universe.id };
    },

    /** يعلّم الكونَ الحاليّ بأن كونًا آخر حلّ محلّه (اعتمادُ استرجاع). */
    async supersedeUniverse(newUniverseId) {
      await gate('supersedeUniverse');
      if (cloud.universe) cloud.universe.supersededBy = newUniverseId;
      return true;
    },

    /* ---------------- المزامنة ---------------- */

    async pushPackage(pkg) {
      await gate('pushPackage');
      const name = packageFileName(pkg.sourceDeviceId, pkg.maxSeq ?? 0);
      /*
       * ⚠️ **والحزمةُ لا تُكتَب مرّتين.** الاسمُ حتميٌّ من (المؤلِّف،
       *    الترتيب)، فإعادةُ رفعٍ بعد ردٍّ ضائع (بند ٣٠) تجد الملفَّ
       *    موجودًا وتعود بنفس المعرِّف — بلا نسخةٍ ثانيةٍ ولا تكرارٍ
       *    دلاليّ.
       */
      const existing = find((f) => f.role === 'package' && f.name === name)[0];
      if (existing) return { fileId: existing.id, name, deduped: true };
      const id = put('package', name, {
        device: pkg.sourceDeviceId,
        seq: pkg.maxSeq ?? 0,
        universe: cloud.universe?.id ?? null,
      }, clone(pkg));
      return { fileId: id, name, deduped: false };
    },

    async listPackages({ exclude = null } = {}) {
      await gate('listPackages');
      return find((f) => f.role === 'package' && f.props.device !== exclude)
        .map((f) => ({
          fileId: f.id, name: f.name, device: f.props.device, seq: f.props.seq,
        }))
        .sort((a, b) => (a.device === b.device ? a.seq - b.seq : a.device < b.device ? -1 : 1));
    },

    async pullPackage(fileId) {
      await gate('pullPackage');
      const file = cloud.files.get(fileId);
      if (!file) throw new TransportError(FAIL.REMOTE_CORRUPT, 'الملف غير موجود على Drive');
      return clone(file.body);
    },

    async pushDeviceState(deviceId, state) {
      await gate('pushDeviceState');
      const name = deviceStateFileName(deviceId);
      const existing = find((f) => f.role === 'devstate' && f.name === name)[0];
      if (existing) {
        /* ⚠️ كاتبٌ واحد: الجهازُ يكتب ملفَّه هو، فلا سباقَ على صفٍّ واحد. */
        existing.body = clone(state);
        existing.at = Date.now();
        cloud.writes.push({ id: existing.id, role: 'devstate', name, at: existing.at });
        return { fileId: existing.id };
      }
      return { fileId: put('devstate', name, { device: deviceId }, clone(state)) };
    },

    async listDeviceStates() {
      await gate('listDeviceStates');
      return find((f) => f.role === 'devstate')
        .map((f) => ({ device: f.props.device, state: clone(f.body) }));
    },

    /* ---------------- الوسائط ---------------- */

    async hasBlob(mediaId, role) {
      await gate('hasBlob');
      const hit = find((f) => f.role === 'blob'
        && f.props.mediaId === mediaId && f.props.blobRole === role)[0];
      return hit ? { fileId: hit.id, bytes: hit.props.bytes, sha256: hit.props.sha256 } : null;
    },

    async putBlob(mediaId, role, blob, { sha256 = null, mime = '' } = {}) {
      await gate('putBlob');
      const existing = await transport.hasBlob(mediaId, role);
      if (existing) return { ...existing, deduped: true };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const id = put('blob', blobFileName(mediaId, role, mime), {
        mediaId, blobRole: role, bytes: blob.size, sha256, mime,
      }, bytes);
      return { fileId: id, bytes: blob.size, sha256, deduped: false };
    },

    async fetchBlob(mediaId, role, { onProgress = null, signal = null } = {}) {
      const fault = await gate('fetchBlob');
      const hit = find((f) => f.role === 'blob'
        && f.props.mediaId === mediaId && f.props.blobRole === role)[0];
      if (!hit) throw new TransportError(FAIL.REMOTE_CORRUPT, 'بايتات الوسيط غير موجودة على Drive');

      const total = hit.props.bytes;
      const chunks = 4;
      for (let i = 1; i <= chunks; i++) {
        if (signal?.aborted) throw new TransportError(FAIL.OFFLINE, 'أُلغي التنزيل');
        /*
         * ⚠️ **والقطعُ يقع في المنتصف لا قبل البداية.** عطبٌ يرمي قبل أن
         *    تصل بايتةٌ واحدةٌ لا يختبر شيئًا؛ والسؤالُ الحقيقيّ: ماذا
         *    يبقى في القاعدة لو انقطع الاتصالُ وقد وصل نصفُ الملفّ؟
         */
        if (fault?.cutAfter && i > fault.cutAfter) {
          throw new TransportError(FAIL.TRANSIENT_SERVER, 'انقطع التنزيل في المنتصف (محاكاة)');
        }
        onProgress?.({ loaded: Math.round((total * i) / chunks), total });
      }
      return new Blob([hit.body], { type: hit.props.mime || 'application/octet-stream' });
    },

    async listBlobs() {
      await gate('listBlobs');
      return find((f) => f.role === 'blob').map((f) => ({
        mediaId: f.props.mediaId, role: f.props.blobRole,
        bytes: f.props.bytes, sha256: f.props.sha256, fileId: f.id,
      }));
    },

    /* ---------------- النسخُ الاحتياطيّة ---------------- */

    async putBackup(blob, { kind = BACKUP_KIND.FULL, manifest = null, at = new Date() } = {}) {
      await gate('putBackup');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = backupFileName(kind, at instanceof Date ? at : new Date(at));
      const id = put('backup', name, {
        kind, bytes: blob.size, at: (at instanceof Date ? at : new Date(at)).getTime(),
        counts: manifest?.counts ?? null, blobCount: (manifest?.blobs || []).length,
      }, bytes);
      return { fileId: id, name, bytes: blob.size };
    },

    async listBackups() {
      await gate('listBackups');
      return find((f) => f.role === 'backup')
        .map((f) => ({
          fileId: f.id, name: f.name, kind: f.props.kind,
          bytes: f.props.bytes, at: f.props.at, blobCount: f.props.blobCount,
        }))
        .sort((a, b) => b.at - a.at);
    },

    /**
     * ⚠️ **خارجَ العقد عمدًا** — والاستبقاءُ يفحص وجودَها قبل النداء.
     *    ناقلٌ لا يحذف (قرصٌ للقراءة فقط مثلًا) يبقى ناقلًا صحيحًا،
     *    وسياسةُ الاستبقاء تقول «غير مدعومة» بدل أن تسقط.
     */
    async deleteBackup(fileId) {
      await gate('deleteBackup');
      const file = cloud.files.get(fileId);
      if (!file || file.role !== 'backup') return false;
      cloud.files.delete(fileId);
      return true;
    },

    async fetchBackup(fileId, { onProgress = null } = {}) {
      await gate('fetchBackup');
      const file = cloud.files.get(fileId);
      if (!file) throw new TransportError(FAIL.REMOTE_CORRUPT, 'النسخة غير موجودة');
      onProgress?.({ loaded: file.props.bytes, total: file.props.bytes });
      return new Blob([file.body], { type: 'application/x-lingolife-backup' });
    },

    /* ---------------- القياسُ والتحكّم في المحاكاة ---------------- */

    stats() { return { ...counts }; },
    resetStats() { for (const key of Object.keys(counts)) delete counts[key]; },

    /** يحقن عطبًا في عمليّةٍ بعينها. */
    fail(op, category, { times = 1, status = null } = {}) {
      faults.set(op, { category, times, status });
      return transport;
    },
    /** يقطع تنزيلًا بعد جزءٍ من بايتاته (١…٣ من ٤). */
    cut(op, after = 2, times = 1) {
      faults.set(op, { category: null, cutAfter: after, times });
      return transport;
    },
    clearFaults() { faults.clear(); return transport; },
    setOnline(value) { online = Boolean(value); return transport; },
    /** يحاكي انتهاءَ الإذن — التطبيقُ يعمل والمزامنةُ تنتظر. */
    expireAuth() { connected = false; return transport; },
  };

  return transport;
}

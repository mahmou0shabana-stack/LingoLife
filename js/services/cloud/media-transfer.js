/**
 * LingoLife — مديرُ نقل الوسائط (WS-H · بنود ١٦…١٨ و G و H من المواصفة)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **طابورٌ واحدٌ لخمسةِ أزرار**
 * ═══════════════════════════════════════════════════════════════
 *
 *   نزّل هذا الصوت  ·  كل أصوات الذكرى  ·  كل صور الذكرى
 *   خلّي الذكرى أوفلاين  ·  نزّل كل الملفّات
 *
 * خمسةُ أفعالٍ في الشاشة، **وفعلٌ واحدٌ تحت**: أعطِ الطابورَ مجموعةَ
 * معرِّفات. وبناءُ ثلاث آليّاتٍ للتنزيل يعني ثلاثةَ أماكنَ تنسى
 * التحقّقَ من البصمة، وثلاثةَ عدّاداتٍ تتناقض في الشاشة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا يُقال «موجود» قبل أن يكون موجودًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * الملفُّ يصير محلّيًّا حين **تُكتَب بايتاتُه وتُطابق بصمتُه** — لا حين
 * يبدأ التنزيل، ولا حين يصل ٩٩٪. وتنزيلٌ انقطع في المنتصف يترك الصفَّ
 * كما كان بالضبط: `blobPending` باقيةٌ، والمحاولةُ القادمة تبدأ نظيفة.
 *
 * ⚠️ **ولا يُنزَّل الملفُّ نفسُه مرّتين في وقتٍ واحد.** خريطةُ الجاري
 *    مفتاحُها `(وسيط، دور)`، وطلبٌ ثانٍ لنفس المفتاح **ينتظر الوعدَ
 *    الأوّل** بدل أن يفتح تنزيلًا موازيًا يكتب فوقه.
 */

import { media } from '../../db/repositories.js';
import { BLOB_ROLE, FAIL, TransportError, classify, sha256Hex } from './transport.js';

/** حالاتُ عنصرٍ في الطابور. */
export const TRANSFER = Object.freeze({
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

/** كم تنزيلًا معًا — منخفضٌ عمدًا على تابلت. */
const CONCURRENCY = 2;

const keyOf = (mediaId, role) => `${mediaId}:${role}`;

/** هل بايتاتُ هذا الوسيط غائبةٌ عن الجهاز؟ */
export function isCloudOnly(record) {
  return Boolean(record) && !record.blob && record.blobPending === 1;
}

/** هل الوسيطُ كاملٌ محلّيًّا؟ */
export function isLocal(record) {
  return Boolean(record?.blob);
}

export function createTransferManager(transport) {
  /** مفتاح → عنصرُ طابور. */
  const items = new Map();
  /** مفتاح → وعدُ التنزيل الجاري (يمنع التكرار المتوازي). */
  const inFlight = new Map();
  const listeners = new Set();
  let active = 0;
  let pump = null;

  const emit = () => {
    const snapshot = summary();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[media] مستمعُ نقلٍ رمى', error);
      }
    }
  };

  function summary() {
    const rows = [...items.values()];
    const by = (status) => rows.filter((r) => r.status === status);
    const downloading = by(TRANSFER.DOWNLOADING);
    return {
      total: rows.length,
      queued: by(TRANSFER.QUEUED).length,
      downloading: downloading.length,
      completed: by(TRANSFER.COMPLETED).length,
      failed: by(TRANSFER.FAILED).length,
      cancelled: by(TRANSFER.CANCELLED).length,
      bytesDone: rows.reduce((sum, r) => sum + (r.loaded || 0), 0),
      bytesTotal: rows.reduce((sum, r) => sum + (r.bytes || 0), 0),
      current: downloading.map((r) => ({
        mediaId: r.mediaId, role: r.role, loaded: r.loaded, total: r.bytes,
      })),
      active: active > 0 || by(TRANSFER.QUEUED).length > 0,
      items: rows.map((r) => ({
        mediaId: r.mediaId, role: r.role, status: r.status,
        bytes: r.bytes, loaded: r.loaded, error: r.error ?? null,
      })),
    };
  }

  /**
   * يضيف وسائطَ إلى الطابور.
   *
   * ⚠️ **والموجودُ محلّيًّا لا يدخل أصلًا** (بند E): «لا يعيد تنزيل
   *    الملفات الموجودة» ليست تحسينًا بل شرطُ صحّة — إعادةُ تنزيل ٤٫٨
   *    جيجابايت لأن الشاشةَ لم تسأل أوّلًا خطأٌ يُدفَع ثمنُه باقةً.
   */
  async function enqueue(mediaIds, { roles = [BLOB_ROLE.ORIGINAL] } = {}) {
    const added = [];
    const rows = await media.getMany([...new Set(mediaIds)]);

    for (const record of rows) {
      if (!record) continue;
      for (const role of roles) {
        if (role === BLOB_ROLE.ORIGINAL && record.blob) continue;
        if (role === BLOB_ROLE.THUMBNAIL && record.thumbBlob) continue;

        const key = keyOf(record.id, role);
        const existing = items.get(key);
        if (existing && (existing.status === TRANSFER.QUEUED
          || existing.status === TRANSFER.DOWNLOADING)) continue;

        items.set(key, {
          key,
          mediaId: record.id,
          role,
          bytes: role === BLOB_ROLE.ORIGINAL ? (record.bytes || 0) : 0,
          loaded: 0,
          status: TRANSFER.QUEUED,
          sha256: record.contentHash || null,
          mime: record.mime || '',
          error: null,
        });
        added.push(key);
      }
    }

    emit();
    start();
    return { added: added.length, queued: summary().queued };
  }

  function start() {
    if (pump) return pump;
    pump = (async () => {
      try {
        while (true) {
          const next = [...items.values()].filter((r) => r.status === TRANSFER.QUEUED);
          if (!next.length && active === 0) break;
          if (!next.length) {
            await new Promise((r) => setTimeout(r, 30));
            continue;
          }
          const slots = Math.min(CONCURRENCY - active, next.length);
          if (slots <= 0) {
            await new Promise((r) => setTimeout(r, 30));
            continue;
          }
          await Promise.all(next.slice(0, slots).map((item) => runOne(item)));
        }
      } finally {
        pump = null;
        emit();
      }
    })();
    return pump;
  }

  async function runOne(item) {
    if (item.status !== TRANSFER.QUEUED) return;
    item.status = TRANSFER.DOWNLOADING;
    active += 1;
    emit();

    try {
      const { blob, fileId } = await fetchVerified(item);
      /*
       * ⚠️ **والكتابةُ بعد التحقّق لا قبله.** لو كُتبت البايتاتُ ثم
       *    فشل التحقّق، لبقي في القاعدة ملفٌّ تالفٌ يزعم أنه سليم —
       *    وهو أسوأُ من ملفٍّ غائب، لأن الغائبَ يُطلَب ثانيةً والتالفَ
       *    لا يُشكّ فيه.
       *
       * ⚠️ **ويُسجَّل `driveFileId` عند التنزيل أيضًا لا عند الرفع وحدَه.**
       *    الجهازُ الذي نزّل ملفًّا يعرف عنه ما يعرفه الرافع بالضبط:
       *    أن له نسخةً على Drive. وبدون هذا السطر لا يستطيع هذا الجهازُ
       *    أن يفرّغ ما نزّله لاحقًا — لأن `removeLocalCopies` تشترط
       *    وجودَ نسخةٍ سحابيّةٍ قبل أن تمحوَ بايتةً واحدة.
       */
      const patch = item.role === BLOB_ROLE.THUMBNAIL
        ? { thumbBlob: blob }
        : { blob, blobPending: 0, ...(fileId ? { driveFileId: fileId } : {}) };
      await media.update(item.mediaId, patch);

      item.status = TRANSFER.COMPLETED;
      item.loaded = item.bytes || blob.size;
    } catch (error) {
      item.status = classify(error) === FAIL.OFFLINE && error?.cancelled
        ? TRANSFER.CANCELLED
        : TRANSFER.FAILED;
      item.error = { category: classify(error), message: error?.message || String(error) };
      item.loaded = 0;
    } finally {
      active -= 1;
      inFlight.delete(item.key);
      emit();
    }
  }

  /**
   * ينزّل ويتحقّق — بلا كتابةٍ في القاعدة.
   *
   * ⚠️ **ويُسأل الوصفُ قبل البايتات، والنداءُ الزائدُ يكسب ثمنَه مرّتين**:
   *    يعطي `fileId` (فيعرف هذا الجهازُ أن له نسخةً سحابيّة)، ويعطي
   *    البصمةَ المرفوعة — فيمكن التحقّقُ حتى لو لم يصل `contentHash`
   *    في السجلّ بعد. وبدونه كان الملفُّ يُقبَل بلا فحصٍ في أوّل جولة.
   */
  async function fetchVerified(item) {
    const remote = await transport.hasBlob(item.mediaId, item.role).catch(() => null);
    const expected = item.sha256 || remote?.sha256 || null;

    const blob = await transport.fetchBlob(item.mediaId, item.role, {
      onProgress: ({ loaded, total }) => {
        item.loaded = loaded;
        if (total) item.bytes = total;
        emit();
      },
    });

    if (expected) {
      const actual = await sha256Hex(blob);
      if (actual !== expected) {
        throw new TransportError(
          FAIL.REMOTE_CORRUPT,
          `بصمة الملف لا تطابق المتوقّع (${item.mediaId})`
        );
      }
    }
    return { blob, fileId: remote?.fileId || null };
  }

  /**
   * يضمن وجودَ وسيطٍ محلّيًّا — الطريقُ الذي تناديه الشاشةُ عند التشغيل.
   *
   * ⚠️ **وطلبان متزامنان يعودان بنفس الوعد** — لا بتنزيلين.
   */
  async function ensureLocal(mediaId, { role = BLOB_ROLE.ORIGINAL } = {}) {
    const record = await media.get(mediaId);
    if (!record) return { ok: false, reason: 'الوسيط غير موجود' };
    if (role === BLOB_ROLE.ORIGINAL && record.blob) return { ok: true, alreadyLocal: true };
    if (role === BLOB_ROLE.THUMBNAIL && record.thumbBlob) return { ok: true, alreadyLocal: true };

    const key = keyOf(mediaId, role);
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = (async () => {
      await enqueue([mediaId], { roles: [role] });
      await pump;
      const after = await media.get(mediaId);
      const done = role === BLOB_ROLE.THUMBNAIL ? Boolean(after?.thumbBlob) : Boolean(after?.blob);
      const item = items.get(key);
      return done
        ? { ok: true, alreadyLocal: false }
        : { ok: false, reason: item?.error?.message || 'فشل التنزيل', category: item?.error?.category };
    })();

    inFlight.set(key, promise);
    return promise;
  }

  /** يُلغي كلَّ ما لم يبدأ بعد. الجاري يُترَك ليكمل أو يفشل بنظافة. */
  function cancelPending() {
    let cancelled = 0;
    for (const item of items.values()) {
      if (item.status === TRANSFER.QUEUED) {
        item.status = TRANSFER.CANCELLED;
        cancelled += 1;
      }
    }
    emit();
    return cancelled;
  }

  /** يعيد محاولةَ الفاشل وحدَه (بند E: «يدعم retry»). */
  function retryFailed() {
    let retried = 0;
    for (const item of items.values()) {
      if (item.status === TRANSFER.FAILED || item.status === TRANSFER.CANCELLED) {
        item.status = TRANSFER.QUEUED;
        item.error = null;
        item.loaded = 0;
        retried += 1;
      }
    }
    emit();
    if (retried) start();
    return retried;
  }

  /** ينظّف المنتهيَ من العرض — لا يمسّ بيانات. */
  function clearFinished() {
    for (const [key, item] of items) {
      if (item.status === TRANSFER.COMPLETED) items.delete(key);
    }
    emit();
  }

  return {
    enqueue,
    ensureLocal,
    cancelPending,
    retryFailed,
    clearFinished,
    summary,
    idle: () => pump || Promise.resolve(),
    subscribe(listener) {
      listeners.add(listener);
      listener(summary());
      return () => listeners.delete(listener);
    },
  };
}

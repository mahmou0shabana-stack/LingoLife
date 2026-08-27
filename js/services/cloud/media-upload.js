/**
 * LingoLife — رافعُ بايتات الوسائط (WS-H · بنود B و T من المواصفة)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الاتّجاهُ الآخر — ولولاه لَما وُجد ما يُنزَّل**
 * ═══════════════════════════════════════════════════════════════
 *
 * المزامنةُ تنقل **السجلّات**: صفُّ الوسيط يصل الموبايلَ في ثوانٍ،
 * وفيه اسمُ الملفّ ونوعُه وحجمُه وارتباطاتُه. والبايتاتُ لا تصحبه —
 * وهذا مقصود (حزمةٌ فيها أربعةُ جيجابايت ليست حزمة).
 *
 * فيبقى سؤالٌ: **من يضع البايتاتِ على Drive أصلًا؟** لو لم يفعلها أحد،
 * لَوجد الموبايلُ صفًّا يَعِد بصوتٍ، فيضغط «نزّل»، فيقول Drive: لا
 * أعرف هذا الملفّ. وهو أسوأُ من ألّا يظهر الصفُّ من الأصل.
 *
 * فهذا الملفّ هو ذلك الأحد: يمشي على الوسائط التي **بايتاتُها هنا ولم
 * تُرفَع بعد**، فيرفعها ويسجّل معرِّفَها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والبصمةُ تُحسَب هنا مرّةً واحدةً في العمر**
 * ═══════════════════════════════════════════════════════════════
 *
 * البايتاتُ مقروءةٌ ساعةَ الرفع أصلًا، فحسابُ SHA-256 عليها كلفتُه
 * صفر. و`contentHash` **حقلٌ مُزامَن** (بعكس `blob` و`driveFileId`)،
 * فتصل البصمةُ إلى الموبايل مع السجلّ — فينزّل ويتحقّق بلا أن يحسب
 * أحدٌ شيئًا مرّتين.
 *
 * ⚠️ **ورفعٌ واحدٌ في كلّ مرّة، لا اثنان.** الرفعُ يقرأ بلوبًا كاملًا
 *    في الذاكرة؛ وملفّان صوتيّان كبيران معًا على تابلت = تجمّد. أمّا
 *    التنزيلُ فاثنان (`media-transfer.js`) لأن كتابتَه متدفّقة.
 *
 * ⚠️ **وامتلاءُ المساحة يوقف الجولةَ كلَّها فورًا.** إكمالُ الطابور بعد
 *    `QUOTA` نداءُ شبكةٍ يُعرَف جوابُه: سيفشل هو أيضًا. فنقف ونقول
 *    السببَ، ولا نُراكم مئةَ فشلٍ متطابق في الشاشة.
 */

import { media } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { BLOB_ROLE, FAIL, classify, sha256Hex } from './transport.js';

/** حالاتُ الرافع — نفسُ مفردات `media-transfer.js` عمدًا. */
export const UPLOAD = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPED: 'stopped',
});

export function createBlobUploader(transport) {
  const listeners = new Set();
  let state = UPLOAD.IDLE;
  let running = null;
  let stopRequested = false;
  let last = { uploaded: 0, skipped: 0, failed: 0, bytes: 0, stoppedBy: null, at: null };
  let current = null;

  const emit = () => {
    const snap = summary();
    for (const listener of listeners) {
      try {
        listener(snap);
      } catch (error) {
        console.error('[media] مستمعُ رفعٍ رمى', error);
      }
    }
  };

  function summary() {
    return { state, current, last: { ...last } };
  }

  /**
   * الوسائطُ التي تنتظر الرفع.
   *
   * ⚠️ **وشرطُ «تنتظر» ثلاثةٌ لا واحد**: بايتاتٌ حاضرة، ولا معرِّفَ رفعٍ
   *    بعد، وليست في السلّة. ورفعُ ما في السلّة يدفع ثمنَ مساحةٍ لشيءٍ
   *    قرّرتَ التخلّص منه.
   */
  async function pending() {
    const rows = await media.getAll();
    return rows.filter((row) => row.state !== STATE.TRASHED && row.blob && !row.driveFileId);
  }

  /** تقريرٌ يُعرَض قبل الرفع — بلا نداءِ شبكةٍ واحد. */
  async function readiness() {
    const rows = await pending();
    return {
      count: rows.length,
      bytes: rows.reduce((sum, row) => sum + (row.bytes || row.blob?.size || 0), 0),
      audio: rows.filter((row) => row.kind === 'audio').length,
      image: rows.filter((row) => row.kind === 'image').length,
    };
  }

  /**
   * يرفع وسيطًا واحدًا ويسجّل نتيجتَه في القاعدة.
   *
   * ⚠️ **والكتابةُ في القاعدة بعد نجاح الرفع لا قبله.** `driveFileId`
   *    مكتوبٌ معناه «موجودٌ على Drive» — وهو ما تعتمد عليه
   *    `removeLocalCopies` لتفريغ البايتات. فكتابتُه متفائلًا تعني
   *    تفريغَ النسخة الوحيدة اعتمادًا على رفعٍ لم يقع.
   */
  async function uploadOne(row) {
    const hash = row.contentHash || (await sha256Hex(row.blob));
    const result = await transport.putBlob(row.id, BLOB_ROLE.ORIGINAL, row.blob, {
      sha256: hash, mime: row.mime || '',
    });

    if (row.thumbBlob) {
      /* المصغّرةُ تحسينُ عرضٍ لا أكثر — وفشلُها لا يُسقط الأصل. */
      await transport.putBlob(row.id, BLOB_ROLE.THUMBNAIL, row.thumbBlob, {
        mime: 'image/webp',
      }).catch(() => null);
    }

    await media.update(row.id, { driveFileId: result.fileId, contentHash: hash });
    return { bytes: row.bytes || row.blob.size, deduped: Boolean(result.deduped) };
  }

  /**
   * يرفع كلَّ ما ينتظر.
   *
   * @param {{ limit?: number }} options
   */
  async function uploadPending({ limit = Infinity } = {}) {
    if (running) return running;
    stopRequested = false;

    running = (async () => {
      state = UPLOAD.RUNNING;
      const report = { uploaded: 0, skipped: 0, failed: 0, bytes: 0, stoppedBy: null, errors: [] };
      emit();

      try {
        const rows = (await pending()).slice(0, limit === Infinity ? undefined : limit);
        for (const row of rows) {
          if (stopRequested) { report.stoppedBy = 'أُوقف بطلبك'; break; }
          current = { mediaId: row.id, bytes: row.bytes || row.blob?.size || 0 };
          emit();

          try {
            /* eslint-disable-next-line no-await-in-loop -- واحدٌ في كلّ مرّة عمدًا */
            const done = await uploadOne(row);
            if (done.deduped) report.skipped += 1; else report.uploaded += 1;
            report.bytes += done.bytes;
          } catch (error) {
            const category = classify(error);
            report.failed += 1;
            report.errors.push({ mediaId: row.id, category, message: error?.message || String(error) });
            if (category === FAIL.QUOTA || category === FAIL.AUTH || category === FAIL.OFFLINE) {
              report.stoppedBy = category;
              break;
            }
          }
        }
      } finally {
        current = null;
        state = UPLOAD.IDLE;
        last = { ...report, at: Date.now() };
        running = null;
        emit();
      }

      return report;
    })();

    return running;
  }

  function stop() {
    stopRequested = true;
    state = UPLOAD.STOPPED;
    emit();
  }

  return {
    pending,
    readiness,
    uploadPending,
    stop,
    summary,
    idle: () => running || Promise.resolve(),
    subscribe(listener) {
      listeners.add(listener);
      listener(summary());
      return () => listeners.delete(listener);
    },
  };
}

/**
 * LingoLife — مديرُ نموذج Supertonic 3 INT8: تنزيلٌ عند الطلب (المرحلة 1A)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما يفعله وما لا يفعله
 * ═══════════════════════════════════════════════════════════════
 *
 * يُنزّل ملفّاتِ النموذج المُثبَّتة في `supertonic-manifest.js`، ويتحقّق
 * من SHA-256 لكلٍّ منها، ويخزّنها في Cache Storage، ويحذفها. **لا يولّد
 * صوتًا ولا يسجّل مزوّدًا** — المزوّدُ مرحلةٌ لاحقة تقرأ البايتاتِ
 * المُتحقَّقة بـ`getFileBytes()` ولا تعرف شيئًا عن التخزين.
 *
 * ⚠️ **لا تنزيلَ تلقائيّ.** الاستيرادُ وإنشاءُ المدير و`getStatus()` لا
 *    تلمس الشبكة ولا تُنشئ كاشًا. وحده `download()` — بطلبٍ صريحٍ من
 *    المستخدم — يستهلك الـ~145 ميغابايت.
 *
 * ═══════════════════════════════════════════════════════════════
 * التخزين
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **كاشٌ مستقلٌّ لكلّ إصدار: `ll-model:<modelId>@<version>`** — ولا
 *    يبدأ بـ`lingolife-` عمدًا: عاملُ الخدمة يحذف عند كلّ نشرٍ كلَّ كاشٍ
 *    يبدأ بـ`lingolife-` عدا كاش البناء الحاليّ (`service-worker.js`،
 *    حدث `activate`). نموذجٌ تحت تلك البادئة كان سيُمحى مع كلّ إصدار.
 *
 * ⚠️ **ولا IndexedDB.** القاعدةُ للبيانات، والنسخُ الاحتياطيّ والمزامنة
 *    يمرّان عليها؛ 145 ميغابايت من أوزانٍ يمكن إعادةُ تنزيلها لا مكان لها
 *    هناك. وذاكرةُ الصوت المولَّد (`generatedAudio`) لا يلمسها هذا الملفّ.
 *
 * ⚠️ **«جاهز» = علامةٌ تُكتب أخيرًا.** كلُّ ملفٍّ يُخزَّن فقط بعد أن يطابق
 *    حجمُه وهاشُه البيان؛ وعلامةُ `__verified__.json` لا تُكتب إلّا بعد
 *    أن يُخزَّن **آخرُ** ملفّ. تنزيلٌ انقطع في منتصفه يترك ملفّاتٍ سليمة
 *    بلا علامة — فالحالةُ `partial` لا `ready`، وإعادةُ المحاولة تُكمل
 *    الناقصَ فقط.
 *
 * ⚠️ **الإصدارات لا تختلط.** كلُّ إصدارٍ في كاشه، ومفاتيحُه تحمل رقمَه.
 *    إصدارٌ جديد يُنزَّل بجوار القديم، والقديمُ لا يُحذف إلّا بعد أن
 *    تُكتب علامةُ الجديد.
 */

import { AVAILABILITY } from './types.js';
import { SUPERTONIC_MANIFEST } from './supertonic-manifest.js';

/** بادئةُ كاشات النماذج — ليست `lingolife-` (راجع رأس الملفّ). */
export const MODEL_CACHE_PREFIX = 'll-model:';

const MARKER = '__verified__.json';
const MB = 1024 * 1024;
/** هامشٌ فوق الحجم المتبقّي: رؤوسُ الكاش ونسخةُ الذاكرة المؤقّتة. */
const QUOTA_MARGIN = 16 * MB;

export const MODEL_STATE = Object.freeze({
  NOT_DOWNLOADED: 'not_downloaded',
  PARTIAL: 'partial',
  DOWNLOADING: 'downloading',
  READY: 'ready',
  UNSUPPORTED: 'unsupported',
});

const MESSAGES = {
  'cache-unavailable': 'هذا المتصفّح لا يدعم Cache Storage — لا يمكن تخزين النموذج.',
  'insufficient-storage': 'المساحة المتاحة لا تكفي لتنزيل النموذج.',
  network: 'انقطع الاتصال أثناء التنزيل. أعد المحاولة؛ الملفّات المكتملة محفوظة.',
  aborted: 'أُلغي التنزيل. أعد المحاولة؛ الملفّات المكتملة محفوظة.',
  'size-mismatch': 'حجمُ ملفٍّ منزَّل لا يطابق البيان — لم يُحفظ.',
  'checksum-mismatch': 'بصمةُ SHA-256 لملفٍّ منزَّل لا تطابق البيان — لم يُحفظ.',
  http: 'رفض الخادم تنزيلَ ملفّ.',
  busy: 'عمليّةٌ أخرى على النموذج جارية الآن.',
  'not-ready': 'النموذج غير منزَّل أو غير مُتحقَّق منه.',
  'unknown-file': 'ملفٌّ ليس في بيان النموذج.',
};

/** خطأٌ برمزٍ ثابت (`code`) ورسالةٍ مقروءة — لا نصوصَ متصفّحٍ غامضة. */
export class ModelError extends Error {
  /**
   * @param {string} code
   * @param {{ file?: string, detail?: string, cause?: unknown }} [info]
   */
  constructor(code, { file, detail, cause } = {}) {
    const base = MESSAGES[code] || MESSAGES[code.split('-')[0]] || code;
    super([base, file && `(${file})`, detail].filter(Boolean).join(' '));
    this.name = 'ModelError';
    this.code = code;
    this.file = file || null;
    if (cause !== undefined) this.cause = cause;
  }
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const toMB = (n) => `${(n / MB).toFixed(1)} MB`;

/**
 * الافتراضيّ: خدمةُ التخزين القائمة — تُستورد عند الحاجة لا عند التحميل.
 *
 * ⚠️ **مُصدَّرٌ ليختبره اختبارٌ بالمسار الحقيقيّ.** كان المسارُ خاطئًا
 *    (`../../../` → `js/storage-service.js` غيرِ الموجود) في المرحلة 1A،
 *    والخطآن يُبتلعان عمدًا (فشلُ طلب الدوام لا يوقف التنزيل) — فكان فحصُ
 *    الحصّة وطلبُ الدوام **لا يجريان أصلًا** بصمت، واختباراتُ 1A تحقن
 *    تخزينًا مزيّفًا فلم تره. اكتشفه فحصُ 1B في Chromium (404 على الملفّ).
 */
export const defaultStorage = {
  async requestPersistence() {
    return (await import('../../storage-service.js')).requestPersistence();
  },
  async estimateStorage() {
    return (await import('../../storage-service.js')).estimateStorage();
  },
};

/** قفلٌ بين الألسنة إن توفّر، وإلّا قفلٌ داخل الوحدة وحدها. */
async function withLock(name, fn) {
  if (globalThis.navigator?.locks?.request) {
    return navigator.locks.request(name, { ifAvailable: true }, (lock) => {
      if (!lock) throw new ModelError('busy');
      return fn();
    });
  }
  return fn();
}

/**
 * @param {Object} options
 * @param {import('./supertonic-manifest.js').ModelManifest} options.manifest
 * @param {CacheStorage} [options.cacheStorage]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {{ requestPersistence: () => Promise<any>,
 *   estimateStorage: () => Promise<{usage: number|null, quota: number|null}> }} [options.storage]
 */
export function createModelManager({
  manifest,
  cacheStorage = globalThis.caches,
  fetchImpl = (...args) => globalThis.fetch(...args),
  storage = defaultStorage,
}) {
  const { modelId, version, files, totalBytes } = manifest;
  const versionPrefix = `${MODEL_CACHE_PREFIX}${modelId}@`;
  const cacheName = `${versionPrefix}${version}`;
  const byName = new Map(files.map((f) => [f.name, f]));

  /** مفتاحٌ اصطناعيٌّ من نفس المصدر، يحمل الإصدار — لا يطابق أيَّ رابطٍ حقيقيّ. */
  const keyFor = (name) =>
    new URL(`/__ll-model__/${modelId}/${version}/${name}`, globalThis.location?.origin || 'http://localhost').href;

  let busy = null; // 'download' | 'verify' | 'delete'
  let lastError = null;
  let persisted = null;

  const fail = (error) => {
    lastError = error instanceof ModelError ? error : new ModelError('network', { cause: error, detail: String(error?.message || error) });
    return lastError;
  };

  async function existingCache() {
    if (!cacheStorage) return null;
    return (await cacheStorage.has(cacheName)) ? cacheStorage.open(cacheName) : null;
  }

  /** هل الملفّ مخزَّنٌ ومُعلَّمٌ بحجمه وهاشه المتوقَّعين؟ (بلا إعادة تجزئة.) */
  async function storedOk(cache, file) {
    const res = await cache.match(keyFor(file.name));
    return !!res
      && res.headers.get('x-ll-sha256') === file.sha256
      && Number(res.headers.get('x-ll-bytes')) === file.bytes;
  }

  async function markerOk(cache) {
    const res = await cache.match(keyFor(MARKER));
    if (!res) return false;
    try {
      const marker = await res.json();
      return marker.modelId === modelId && marker.version === version
        && marker.files?.length === files.length
        && files.every((f, i) => marker.files[i]?.name === f.name
          && marker.files[i]?.sha256 === f.sha256 && marker.files[i]?.bytes === f.bytes);
    } catch {
      return false;
    }
  }

  async function writeMarker(cache) {
    const body = JSON.stringify({
      modelId, version, verifiedAt: new Date().toISOString(),
      files: files.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })),
    });
    await cache.put(keyFor(MARKER), new Response(body, { headers: { 'content-type': 'application/json' } }));
  }

  async function otherVersions() {
    if (!cacheStorage) return [];
    return (await cacheStorage.keys())
      .filter((k) => k.startsWith(versionPrefix) && k !== cacheName)
      .map((k) => k.slice(versionPrefix.length));
  }

  async function getStatus() {
    const base = { modelId, version, cacheName, totalBytes, filesTotal: files.length, persisted };
    const unsupported = (cause) => ({ ...base, state: MODEL_STATE.UNSUPPORTED,
      availability: AVAILABILITY.UNAVAILABLE_IN_WEB, downloadedBytes: 0, filesVerified: 0,
      otherVersions: [], error: new ModelError('cache-unavailable', { cause }) });
    if (!cacheStorage) return unsupported();
    let cache;
    try {
      cache = await existingCache();
    } catch (error) {
      // ⚠️ نافذةُ Firefox الخاصّة: `caches` موجودةٌ وكلُّ نداءٍ عليها يُرفض (SecurityError).
      return unsupported(error);
    }
    let downloadedBytes = 0;
    let filesVerified = 0;
    let ready = false;
    if (cache) {
      for (const file of files) {
        if (await storedOk(cache, file)) {
          downloadedBytes += file.bytes;
          filesVerified += 1;
        }
      }
      ready = filesVerified === files.length && (await markerOk(cache));
    }
    let state = MODEL_STATE.NOT_DOWNLOADED;
    if (ready) state = MODEL_STATE.READY;
    else if (busy === 'download') state = MODEL_STATE.DOWNLOADING;
    else if (downloadedBytes > 0) state = MODEL_STATE.PARTIAL;
    return {
      ...base, state, downloadedBytes, filesVerified,
      availability: ready ? AVAILABILITY.READY_OFFLINE : AVAILABILITY.MODEL_NOT_DOWNLOADED,
      otherVersions: await otherVersions(),
      error: ready ? null : lastError,
    };
  }

  /** يقرأ جسمَ الاستجابة كاملًا مع التقدّم، ولا يقبل بايتًا فوق المتوقَّع. */
  async function readBody(response, file, onChunk) {
    const out = new Uint8Array(file.bytes);
    let received = 0;
    const push = (chunk) => {
      if (received + chunk.byteLength > file.bytes) {
        throw new ModelError('size-mismatch', { file: file.name, detail: `> ${file.bytes}` });
      }
      out.set(chunk, received);
      received += chunk.byteLength;
      onChunk(received);
    };
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          push(value);
        }
      } catch (error) {
        reader.cancel().catch(() => {});
        throw error;
      }
    } else {
      push(new Uint8Array(await response.arrayBuffer()));
    }
    if (received !== file.bytes) {
      throw new ModelError('size-mismatch', { file: file.name, detail: `${received}/${file.bytes}` });
    }
    return out;
  }

  function classify(error, file, signal) {
    if (error instanceof ModelError) return error;
    if (signal?.aborted || error?.name === 'AbortError') return new ModelError('aborted', { file: file?.name, cause: error });
    if (error?.name === 'QuotaExceededError') return new ModelError('insufficient-storage', { file: file?.name, cause: error });
    return new ModelError('network', { file: file?.name, cause: error, detail: String(error?.message || '') });
  }

  /**
   * يُنزّل ما ينقص من الإصدار الحاليّ ويتحقّق منه. لا يُعيد تنزيلَ ملفٍّ
   * مخزَّنٍ سليم. يرفض بـ`ModelError` عند أيّ فشل، والحالةُ لا تصير
   * `ready` إلّا بعد نجاح كلّ الملفّات.
   *
   * @param {(p: {phase: string, file: string|null, fileBytes: number, fileTotal: number,
   *   downloadedBytes: number, totalBytes: number}) => void} [onProgress]
   * @param {{ signal?: AbortSignal }} [options]
   */
  async function download(onProgress = () => {}, { signal } = {}) {
    if (busy) throw new ModelError('busy'); // لا يمحو خطأَ العمليّة الجارية
    if (!cacheStorage) throw fail(new ModelError('cache-unavailable'));
    busy = 'download';
    lastError = null;
    const emit = (p) => { try { onProgress({ totalBytes, ...p }); } catch { /* مراقبٌ معطوب لا يُسقط التنزيل */ } };
    let current = null;
    try {
      return await withLock(`${versionPrefix}lock`, async () => {
        const existing = await existingCache();
        const missing = [];
        let downloadedBytes = 0;
        for (const file of files) {
          if (existing && (await storedOk(existing, file))) downloadedBytes += file.bytes;
          else missing.push(file);
        }
        emit({ phase: 'preparing', file: null, fileBytes: 0, fileTotal: 0, downloadedBytes });

        if (missing.length) {
          const remaining = missing.reduce((n, f) => n + f.bytes, 0);
          try {
            persisted = (await storage.requestPersistence())?.persisted ?? null;
          } catch {
            persisted = null;
          }
          const { usage, quota } = (await storage.estimateStorage().catch(() => null)) || {};
          if (typeof usage === 'number' && typeof quota === 'number') {
            const free = quota - usage;
            if (free < remaining + QUOTA_MARGIN) {
              throw new ModelError('insufficient-storage', {
                detail: `المطلوب ${toMB(remaining + QUOTA_MARGIN)}، والمتاح ${toMB(Math.max(0, free))}.`,
              });
            }
          }
        }

        const cache = await cacheStorage.open(cacheName);
        for (const file of missing) {
          current = file;
          if (signal?.aborted) throw new ModelError('aborted', { file: file.name });
          const response = await fetchImpl(file.url, { signal, cache: 'no-store', credentials: 'omit' });
          if (!response.ok) {
            throw new ModelError(`http-${response.status}`, { file: file.name });
          }
          const bytes = await readBody(response, file, (n) =>
            emit({ phase: 'downloading', file: file.name, fileBytes: n, fileTotal: file.bytes, downloadedBytes: downloadedBytes + n }));
          emit({ phase: 'verifying', file: file.name, fileBytes: file.bytes, fileTotal: file.bytes, downloadedBytes: downloadedBytes + file.bytes });
          const hash = await sha256Hex(bytes);
          if (hash !== file.sha256) {
            throw new ModelError('checksum-mismatch', { file: file.name, detail: hash.slice(0, 12) });
          }
          if (signal?.aborted) throw new ModelError('aborted', { file: file.name });
          await cache.put(keyFor(file.name), new Response(bytes, { headers: {
            'content-type': 'application/octet-stream',
            'x-ll-sha256': file.sha256,
            'x-ll-bytes': String(file.bytes),
            'x-ll-version': version,
          } }));
          downloadedBytes += file.bytes;
        }
        current = null;

        emit({ phase: 'finalizing', file: null, fileBytes: 0, fileTotal: 0, downloadedBytes });
        for (const file of files) {
          if (!(await storedOk(cache, file))) throw new ModelError('size-mismatch', { file: file.name, detail: 'missing' });
        }
        await writeMarker(cache);
        // الإصدارُ الجديد مُتحقَّقٌ الآن — عندها فقط يُحذف غيرُه.
        for (const old of await otherVersions()) await cacheStorage.delete(`${versionPrefix}${old}`);
        emit({ phase: 'done', file: null, fileBytes: 0, fileTotal: 0, downloadedBytes: totalBytes });
        busy = null;
        return getStatus();
      });
    } catch (error) {
      if (error?.code === 'busy') throw error; // لسانٌ آخر يُنزّل — ليس فشلًا لهذا التنزيل
      throw fail(classify(error, current, signal));
    } finally {
      busy = null;
    }
  }

  /**
   * يعيد تجزئةَ كلّ ملفٍّ مخزَّنٍ فعلًا. ملفٌّ فاسد يُحذف مع علامة الجاهزيّة؛
   * وإذا سلم الجميع تُكتب العلامة (إصلاحُ انقطاعٍ بين آخر ملفٍّ والعلامة).
   * @returns {Promise<{ ok: boolean, failed: Array<{name: string, reason: string}> }>}
   */
  async function verify() {
    if (busy) throw new ModelError('busy'); // لا يمحو خطأَ العمليّة الجارية
    busy = 'verify';
    try {
      const cache = await existingCache();
      if (!cache) return { ok: false, failed: files.map((f) => ({ name: f.name, reason: 'missing' })) };
      const failed = [];
      for (const file of files) {
        const res = await cache.match(keyFor(file.name));
        if (!res) {
          failed.push({ name: file.name, reason: 'missing' });
          continue;
        }
        const buf = await res.arrayBuffer();
        const reason = buf.byteLength !== file.bytes ? 'size-mismatch'
          : (await sha256Hex(buf)) !== file.sha256 ? 'checksum-mismatch' : null;
        if (reason) {
          failed.push({ name: file.name, reason });
          await cache.delete(keyFor(file.name));
        }
      }
      if (failed.length) {
        await cache.delete(keyFor(MARKER));
        const bad = failed.find((f) => f.reason !== 'missing');
        if (bad) fail(new ModelError(bad.reason, { file: bad.name }));
      } else {
        await writeMarker(cache);
        lastError = null;
      }
      return { ok: failed.length === 0, failed };
    } finally {
      busy = null;
    }
  }

  /** يحذف كلَّ إصدارات **هذا** النموذج فقط — لا كاشَ غيرَها ولا صوتًا مولَّدًا. */
  async function remove() {
    if (busy) throw new ModelError('busy'); // لا يمحو خطأَ العمليّة الجارية
    busy = 'delete';
    try {
      if (!cacheStorage) return { deleted: [] };
      const names = (await cacheStorage.keys()).filter((k) => k.startsWith(versionPrefix));
      for (const name of names) await cacheStorage.delete(name);
      lastError = null;
      return { deleted: names };
    } finally {
      busy = null;
    }
  }

  /**
   * بايتاتُ ملفٍّ من الإصدار الحاليّ المُتحقَّق — نقطةُ الدخول للمزوّد القادم.
   * @param {string} name
   * @returns {Promise<ArrayBuffer>}
   */
  async function getFileBytes(name) {
    const file = byName.get(name);
    if (!file) throw new ModelError('unknown-file', { file: name });
    const cache = await existingCache();
    if (!cache || !(await markerOk(cache)) || !(await storedOk(cache, file))) {
      throw new ModelError('not-ready', { file: name });
    }
    return (await cache.match(keyFor(name))).arrayBuffer();
  }

  return Object.freeze({
    modelId, version, totalBytes, cacheName, files,
    getStatus, download, verify, delete: remove, getFileBytes,
  });
}

let instance = null;

/** المديرُ الوحيد لـSupertonic 3 INT8 — يُنشأ عند أوّل طلب، ولا يلمس شيئًا بإنشائه. */
export function getSupertonicModel() {
  if (!instance) instance = createModelManager({ manifest: SUPERTONIC_MANIFEST });
  return instance;
}

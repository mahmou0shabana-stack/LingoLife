/**
 * LingoLife — محرّكُ Supertonic 3 داخل المتصفّح (المرحلة 1B)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما هذا وما ليس هو
 * ═══════════════════════════════════════════════════════════════
 *
 * طبقةٌ في الخيط الرئيسيّ تدير عاملَ التوليد (`supertonic-worker.js`):
 * تحميلٌ، توليدٌ، إلغاءٌ منطقيّ، تحرير. **ليس مزوّدَ نطق** — لا يُسجَّل
 * في `registry.js`، ولا تراه «مركزُ الأصوات»، ولا يمرّ بذاكرة الصوت ولا
 * بـ`audio-bus`. المزوّدُ القادم يلفّه ويعطيه ذلك كلَّه.
 *
 * ⚠️ **البايتاتُ من مدير النموذج وحده** (`supertonic-model.js`
 *    ‏`getFileBytes()`): لا تنزيلَ هنا ولا كاشَ ثانٍ. ملفٌّ واحدٌ في كلّ
 *    مرّة يُقرأ ثم يُنقل إلى العامل **بالتحويل** — فيصير المخزنُ المؤقّت
 *    في الخيط الرئيسيّ فارغًا (detached) فورًا، ولا يجتمع الـ145 MB في
 *    JS مرّتين. ذروةُ الذاكرة أثناء التحميل ≈ الجلساتُ المحمَّلة + ملفٌّ
 *    واحد (أكبرُها 78.4 MB).
 *
 * ═══════════════════════════════════════════════════════════════
 * الإلغاء — ما هو ممكنٌ فعلًا
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **استدلالُ ONNX الجاري لا يُقطع.** `session.run()` في WASM بخيطٍ واحد
 *    يعمل حتى ينتهي؛ ولا واجهةَ مقاطعةٍ آمنة له في onnxruntime-web. فـ:
 *    - `cancel()` **منطقيّ**: يرفض فورًا كلَّ طلبٍ معلَّق أو جارٍ بـ`cancelled`،
 *      والطلباتُ المنتظرة لا تُرسَل أصلًا. نتيجةُ الطلب الجاري تصل من العامل
 *      لاحقًا فتُرمى — لا تصل مستدعيًا ولا تُشغَّل.
 *    - الطلبُ التالي ينتظر فراغَ العامل (الاستدلالُ الملغى يكمل في الخلفيّة).
 *    - الإيقافُ الصلب الوحيد: `dispose()` — ينهي العامل (`terminate`)
 *      فيتوقّف الحسابُ فورًا، والتحميلُ التالي يبدأ من جديد (~3 ث).
 */

import { getSupertonicModel } from './supertonic-model.js';
import { SUPERTONIC_VOICES, SUPERTONIC_INFERENCE } from './supertonic-text.js';
import { pcmFloatToWavBlob } from './wav.js';

export const ENGINE_STATE = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
});

/** خطأٌ برمزٍ ثابت: model-not-ready، worker-crashed، cancelled، unknown-voice، empty-text، … */
export class EngineError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = 'EngineError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

const defaultWorker = () =>
  new Worker(new URL('./supertonic-worker.js', import.meta.url), { type: 'module', name: 'supertonic' });

/**
 * @param {Object} [options]
 * @param {{ files: ReadonlyArray<{name: string}>, version: string,
 *   getFileBytes: (name: string) => Promise<ArrayBuffer> }} [options.model]
 * @param {() => Worker} [options.createWorker]
 */
export function createSupertonicEngine({ model = getSupertonicModel(), createWorker = defaultWorker } = {}) {
  let worker = null;
  let state = ENGINE_STATE.IDLE;
  let lastError = null;
  let info = null;
  let initPromise = null;
  let nextId = 1;
  /** رسائلُ أُرسلت للعامل ولم يعُد جوابُها: id → {resolve, reject} */
  const inflight = new Map();
  /** طلباتُ توليدٍ تنتظر دورَها (لم تُرسَل بعد). */
  const queue = [];
  /** كلُّ طلب توليدٍ لم يُسلَّم بعد — منتظرًا كان أو جاريًا. */
  const active = new Set();
  let workerBusy = false;
  let generation = 0;
  /** يزيد مع كلّ هدمٍ للعامل: تحميلٌ بدأ قبله يتوقّف عند أوّل نقطة انتظار. */
  let epoch = 0;

  function send(message, transfer = []) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      inflight.set(id, { resolve, reject });
      worker.postMessage({ ...message, id }, transfer);
    });
  }

  /** العاملُ مات (خطأٌ غيرُ ممسوك، نفادُ ذاكرة، …): كلُّ معلَّقٍ يُرفض، والتحميلُ التالي يبدأ نظيفًا. */
  function crash(event) {
    const error = new EngineError('worker-crashed', `عاملُ التوليد توقّف: ${event?.message || 'خطأ غير معروف'}`, event);
    teardown(error);
    state = ENGINE_STATE.ERROR;
    lastError = error;
  }

  function teardown(error) {
    epoch++;
    try { worker?.terminate(); } catch { /* منتهٍ أصلًا */ }
    worker = null;
    info = null;
    initPromise = null;
    workerBusy = false;
    for (const [, pending] of inflight) pending.reject(error);
    inflight.clear();
    queue.length = 0;
    for (const job of [...active]) settle(job, job.reject, error);
  }

  function onMessage({ data }) {
    const pending = inflight.get(data.id);
    if (!pending) return;
    inflight.delete(data.id);
    // ⚠️ حتى جوابُ طلبٍ ملغًى يُمرَّر: هو ما يحرّر العاملَ للطلب التالي؛
    //    و`settle` يرميه لأنّ المستدعي تسلّم «cancelled» من قبل.
    if (data.type === 'error') pending.reject(new EngineError(data.code, data.message));
    else pending.resolve(data);
  }

  async function init() {
    if (state === ENGINE_STATE.READY) return info;
    if (initPromise) return initPromise;
    state = ENGINE_STATE.LOADING;
    lastError = null;
    initPromise = (async () => {
      const started = performance.now();
      const myEpoch = epoch;
      // ⚠️ `dispose()` أو موتُ العامل أثناء انتظارٍ هنا: لا نُكمل ولا نُنشئ عاملًا يتيمًا.
      const alive = () => {
        if (epoch !== myEpoch) throw lastError || new EngineError('disposed');
      };
      // اقرأ أوّل ملفٍّ قبل إنشاء العامل: نموذجٌ غيرُ جاهزٍ يُرفض بلا أيّ كلفة.
      const names = model.files.map((f) => f.name);
      let first;
      try {
        first = await model.getFileBytes(names[0]);
      } catch (error) {
        throw new EngineError(error?.code === 'not-ready' ? 'model-not-ready' : (error?.code || 'model-not-ready'),
          error?.message, error);
      }
      alive();
      worker = createWorker();
      worker.onmessage = onMessage;
      worker.onerror = (event) => { event.preventDefault?.(); crash(event); };
      worker.onmessageerror = (event) => crash(event);
      for (const name of names) {
        let buffer = first;
        first = null;
        if (!buffer) {
          try {
            buffer = await model.getFileBytes(name);
          } catch (error) {
            throw new EngineError('model-not-ready', error?.message, error);
          }
        }
        alive();
        await send({ type: 'load-file', name, buffer }, [buffer]);
        buffer = null; // منقول: فارغٌ هنا الآن
      }
      alive();
      const ready = await send({ type: 'ready', modelVersion: model.version });
      alive();
      info = { ...ready.info, initMs: Math.round(performance.now() - started), modelVersion: model.version };
      state = ENGINE_STATE.READY;
      return info;
    })();
    try {
      return await initPromise;
    } catch (error) {
      const failure = error instanceof EngineError ? error : new EngineError('init-failed', String(error?.message), error);
      teardown(failure);
      // `dispose()` أثناء التحميل ليس عطبًا: المحرّكُ يعود خاملًا نظيفًا.
      state = failure.code === 'disposed' ? ENGINE_STATE.IDLE : ENGINE_STATE.ERROR;
      lastError = failure.code === 'disposed' ? null : failure;
      throw failure;
    } finally {
      if (state !== ENGINE_STATE.LOADING) initPromise = null;
    }
  }

  /** يُسلِّم نتيجةَ الطلب مرّةً واحدة: ملغًى سبق تسليمُه لا يُسلَّم ثانية. */
  function settle(job, fn, value) {
    if (job.settled) return;
    job.settled = true;
    active.delete(job);
    fn(value);
  }

  function pump() {
    if (workerBusy || !worker) return;
    const job = queue.shift();
    if (!job) return;
    if (job.settled) {
      pump();
      return;
    }
    workerBusy = true;
    send({ type: 'synth', text: job.text, voice: job.voice, speed: job.speed })
      .then((data) => settle(job, job.resolve, data), (error) => settle(job, job.reject, error))
      .finally(() => {
        workerBusy = false;
        pump();
      });
  }

  /**
   * @param {{ text: string, voice?: 'F1'|'M1', speed?: number }} request
   * @returns {Promise<{ blob: Blob, sampleRate: number, samples: number, duration: number,
   *   voice: string, speed: number, steps: number, modelVersion: string, inferMs: number,
   *   frontend: Array<{chunk: string, processed: string, ids: number[], unknown: number, seed: number}> }>}
   */
  async function synthesize({ text, voice = 'F1', speed = SUPERTONIC_INFERENCE.defaultSpeed } = {}) {
    if (!(voice in SUPERTONIC_VOICES)) throw new EngineError('unknown-voice', `${voice} — المتاح: ${Object.keys(SUPERTONIC_VOICES).join('، ')}`);
    if (typeof text !== 'string' || !text.trim()) throw new EngineError('empty-text');
    if (!(speed > 0)) throw new EngineError('bad-speed', String(speed));
    const myGeneration = generation;
    await init();
    if (myGeneration !== generation) throw new EngineError('cancelled');
    const data = await new Promise((resolve, reject) => {
      const job = { text, voice, speed, resolve, reject, settled: false };
      active.add(job);
      queue.push(job);
      pump();
    });
    const pcm = data.pcm;
    return {
      blob: pcmFloatToWavBlob(pcm, data.sampleRate),
      sampleRate: data.sampleRate,
      samples: pcm.length,
      duration: pcm.length / data.sampleRate,
      voice, speed, steps: SUPERTONIC_INFERENCE.steps, modelVersion: model.version,
      inferMs: Math.round(data.inferMs),
      frontend: data.frontend,
    };
  }

  /**
   * إلغاءٌ منطقيّ لكلّ ما طُلب قبله: يُرفض فورًا بـ`cancelled`، المنتظرُ لا
   * يُرسَل، ونتيجةُ الجاري تُرمى حين تصل (راجع رأس الملفّ: لا يُقطع).
   */
  function cancel() {
    generation++;
    for (const job of [...active]) settle(job, job.reject, new EngineError('cancelled'));
  }

  /** إيقافٌ صلب: ينهي العاملَ وكلَّ ذاكرته. `init()` بعده يبدأ من جديد. */
  async function dispose() {
    cancel();
    if (worker && state === ENGINE_STATE.READY) {
      await Promise.race([
        send({ type: 'dispose' }).catch(() => {}),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    }
    teardown(new EngineError('disposed'));
    state = ENGINE_STATE.IDLE;
    lastError = null;
  }

  return Object.freeze({
    model,
    get state() { return state; },
    get error() { return lastError; },
    get info() { return info; },
    voices: Object.keys(SUPERTONIC_VOICES),
    init, synthesize, cancel, dispose,
  });
}

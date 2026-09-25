/**
 * LingoLife — عاملُ توليد Supertonic 3 (المرحلة 1B)
 *
 * ⚠️ **كلُّ استدلال ONNX هنا، لا في الخيط الرئيسيّ.** العاملُ وحدَه يستورد
 *    ONNX Runtime Web (WASM، خيطٌ واحد، بلا WebGPU)، من `vendor/` المحلّيّ
 *    — لا CDN، فيعمل بلا شبكة متى خُزِّن.
 *
 * ⚠️ **ولا يعرف من أين جاءت البايتات.** لا يلمس Cache Storage ولا يُنزّل
 *    شيئًا: المحرّكُ (`supertonic-engine.js`) يقرأ الملفّاتِ المُتحقَّقة من
 *    مدير النموذج وينقلها إليه **ملفًّا ملفًّا بالتحويل (transfer)**، فلا
 *    نسخةَ ثانيةً في الخيط الرئيسيّ.
 *
 * ⚠️ **الذاكرة:** كلُّ ملفّ ONNX يُنشأ منه جلستُه فورًا ثم يُترك مرجعُه —
 *    ONNX Runtime ينسخ النموذجَ إلى ذاكرة WASM، فلا يبقى في JS سوى
 *    الجلسات. و`voice.bin` يُقتطع منه F1 وM1 وحدهما (نحو 100 KB) ثم يُترك.
 *
 * البروتوكول (رسائلُ بسيطة، كلُّها بـ`id`):
 *   → {type:'load-file', id, name, buffer}   ← {type:'loaded', id, name}
 *   → {type:'ready', id, modelVersion}        ← {type:'ready', id, info}
 *   → {type:'synth', id, text, voice, speed}  ← {type:'result', id, pcm, sampleRate, …}
 *   → {type:'dispose', id}                    ← {type:'disposed', id}
 *   أيُّ فشل                                  ← {type:'error', id, code, message}
 */

import {
  SUPERTONIC_INFERENCE, SUPERTONIC_VOICES, preprocessText, textToIds, chunkText,
  seedFor, mulberry32, sampleNoisyLatent, parseVoice,
} from './supertonic-text.js';

const ORT_BASE = new URL('../../../../vendor/onnxruntime-web/', import.meta.url).href;

const GRAPHS = {
  'duration_predictor.int8.onnx': 'dp',
  'text_encoder.int8.onnx': 'textEnc',
  'vector_estimator.int8.onnx': 'vectorEst',
  'vocoder.int8.onnx': 'vocoder',
};

let ort = null;
let sessions = {};
let cfg = null;
let indexer = null;
let voices = {};
let modelVersion = '';
let loadMs = 0;

async function runtime() {
  if (ort) return ort;
  const started = performance.now();
  try {
    ort = await import(`${ORT_BASE}ort.wasm.min.mjs`);
  } catch (error) {
    throw new WorkerError('runtime-unavailable', `vendor/onnxruntime-web: ${error?.message || error}`);
  }
  ort.env.wasm.wasmPaths = ORT_BASE;
  ort.env.wasm.numThreads = 1; // لا عزلَ مصدر ولا SharedArrayBuffer — خيطٌ واحدٌ صريح
  ort.env.wasm.proxy = false; // نحن العاملُ أصلًا
  loadMs += performance.now() - started;
  return ort;
}

class WorkerError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

async function loadFile(name, buffer) {
  const started = performance.now();
  if (GRAPHS[name]) {
    const o = await runtime();
    sessions[GRAPHS[name]] = await o.InferenceSession.create(new Uint8Array(buffer), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  } else if (name === 'tts.json') {
    cfg = JSON.parse(new TextDecoder().decode(buffer));
  } else if (name === 'unicode_indexer.bin') {
    indexer = new Int32Array(buffer);
  } else if (name === 'voice.bin') {
    for (const [voice, index] of Object.entries(SUPERTONIC_VOICES)) voices[voice] = parseVoice(buffer, index);
  } else {
    throw new WorkerError('unknown-file', name);
  }
  loadMs += performance.now() - started;
}

function assertReady() {
  const missing = [...Object.values(GRAPHS).filter((k) => !sessions[k]),
    ...(cfg ? [] : ['tts.json']), ...(indexer ? [] : ['unicode_indexer.bin']),
    ...(Object.keys(voices).length ? [] : ['voice.bin'])];
  if (missing.length) throw new WorkerError('incomplete-model', missing.join(', '));
}

/** `_infer` الرسميّة لمقطعٍ واحد، بدفعةٍ من عنصرٍ واحد وضجيجٍ مبذور. */
async function inferChunk(chunk, style, speed, seed) {
  const o = ort;
  const processed = preprocessText(chunk, SUPERTONIC_INFERENCE.lang);
  const { ids, unknown } = textToIds(processed, indexer);
  const T = ids.length;
  const textIds = new o.Tensor('int64', BigInt64Array.from(ids, (x) => BigInt(x)), [1, T]);
  const textMask = new o.Tensor('float32', new Float32Array(T).fill(1), [1, 1, T]);
  const styleTtl = new o.Tensor('float32', style.ttl, style.ttlDims);
  const styleDp = new o.Tensor('float32', style.dp, style.dpDims);

  const { duration } = await sessions.dp.run({ text_ids: textIds, style_dp: styleDp, text_mask: textMask });
  const durationSec = duration.data[0] / speed;
  const { text_emb: textEmb } = await sessions.textEnc.run({ text_ids: textIds, style_ttl: styleTtl, text_mask: textMask });

  const { xt, latentMask, dim, latentLen } = sampleNoisyLatent(durationSec, cfg, mulberry32(seed));
  const latentMaskT = new o.Tensor('float32', latentMask, [1, 1, latentLen]);
  const totalStep = new o.Tensor('float32', new Float32Array([SUPERTONIC_INFERENCE.steps]), [1]);
  let latent = new o.Tensor('float32', xt, [1, dim, latentLen]);
  for (let step = 0; step < SUPERTONIC_INFERENCE.steps; step++) {
    const out = await sessions.vectorEst.run({
      noisy_latent: latent, text_emb: textEmb, style_ttl: styleTtl, latent_mask: latentMaskT,
      text_mask: textMask, current_step: new o.Tensor('float32', new Float32Array([step]), [1]), total_step: totalStep,
    });
    latent = out.denoised_latent;
  }
  const { wav_tts: wav } = await sessions.vocoder.run({ latent });
  return { pcm: wav.data, processed, ids, unknown, durationSec };
}

async function synth({ text, voice, speed }) {
  assertReady();
  const style = voices[voice];
  if (!style) throw new WorkerError('unknown-voice', voice);
  const chunks = chunkText(text, SUPERTONIC_INFERENCE.maxChunkLen);
  if (!chunks.length) throw new WorkerError('empty-text');
  const started = performance.now();
  const parts = [];
  const frontend = [];
  for (let i = 0; i < chunks.length; i++) {
    const seed = seedFor([modelVersion, voice, speed, SUPERTONIC_INFERENCE.steps, i, chunks[i]]);
    const r = await inferChunk(chunks[i], style, speed, seed);
    parts.push(r.pcm);
    frontend.push({ chunk: chunks[i], processed: r.processed, ids: r.ids, unknown: r.unknown, seed });
  }
  // صمتُ الأصل (0.3 ث) بين المقاطع.
  const gap = Math.floor(SUPERTONIC_INFERENCE.silenceSec * cfg.ae.sample_rate);
  const total = parts.reduce((n, p) => n + p.length, 0) + gap * (parts.length - 1);
  const pcm = new Float32Array(total);
  let offset = 0;
  parts.forEach((p, i) => {
    if (i) offset += gap;
    pcm.set(p, offset);
    offset += p.length;
  });
  return { pcm, sampleRate: cfg.ae.sample_rate, frontend, inferMs: performance.now() - started };
}

async function dispose() {
  await Promise.all(Object.values(sessions).map((s) => s.release?.().catch(() => {})));
  sessions = {};
  cfg = null;
  indexer = null;
  voices = {};
}

self.onmessage = async ({ data }) => {
  const { type, id } = data;
  try {
    if (type === 'load-file') {
      await loadFile(data.name, data.buffer);
      data.buffer = null; // لا مرجعَ باقٍ على بايتات الملفّ
      self.postMessage({ type: 'loaded', id, name: data.name });
    } else if (type === 'ready') {
      modelVersion = data.modelVersion || '';
      assertReady();
      self.postMessage({ type: 'ready', id, info: {
        loadMs: Math.round(loadMs), sampleRate: cfg.ae.sample_rate, voices: Object.keys(voices),
        numThreads: ort.env.wasm.numThreads, crossOriginIsolated: self.crossOriginIsolated === true,
        ortVersion: ort.env.versions?.web || null,
      } });
    } else if (type === 'synth') {
      const r = await synth(data);
      self.postMessage({ type: 'result', id, ...r }, [r.pcm.buffer]);
    } else if (type === 'dispose') {
      await dispose();
      self.postMessage({ type: 'disposed', id });
    } else {
      throw new WorkerError('unknown-message', String(type));
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, code: error.code || 'inference-failed', message: String(error.message || error) });
  }
};

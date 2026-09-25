/**
 * LingoLife — نموذجُ Supertonic المصغَّر للاختبارات (المرحلة 1C)
 *
 * ⚠️ **يمرّ بمدير 1A الحقيقيّ** (`createModelManager`): بيانٌ صغيرٌ بأسماء
 *    الملفّات الحقيقيّة وبصماتِ بايتات النموذج البديل (`fixtures/supertonic-tiny`،
 *    ~15 KB، راجع `scripts/make-supertonic-fixtures.py`)، و`fetch` محقونٌ يخدمها
 *    من الذاكرة. فالسلسلةُ كلُّها حقيقيّة — تنزيلٌ ← SHA-256 ← Cache Storage
 *    ← `getFileBytes` ← العامل ← ONNX Runtime Web — والنقلُ وحده بديل.
 */

const GRAPHS = ['duration_predictor.int8.onnx', 'text_encoder.int8.onnx', 'vector_estimator.int8.onnx', 'vocoder.int8.onnx'];

/** فهرسٌ بديل: كلُّ نقطة ترميزٍ معروفة، ومعرّفُها (cp % 997) + 1. */
export const idOf = (cp) => (cp % 997) + 1;

function tinyIndexer() {
  const idx = new Int32Array(65536);
  for (let c = 0; c < idx.length; c++) idx[c] = idOf(c);
  return new Uint8Array(idx.buffer);
}

/** voice.bin بصيغة sherpa — لكلّ صوتٍ قيمٌ مميّزة (F1 = 0، M1 = 5). */
function tinyVoices() {
  const ttl = 50 * 256;
  const dp = 8 * 16;
  const buf = new ArrayBuffer(48 + 10 * (ttl + dp) * 4);
  const view = new DataView(buf);
  [10, 50, 256, 10, 8, 16].forEach((v, i) => view.setBigInt64(i * 8, BigInt(v), true));
  for (let v = 0; v < 10; v++) {
    new Float32Array(buf, 48 + v * ttl * 4, ttl).fill(0.1 * (v + 1));
    new Float32Array(buf, 48 + 10 * ttl * 4 + v * dp * 4, dp).fill(0.05 * (v + 1));
  }
  return new Uint8Array(buf);
}

let bytesPromise = null;
function fixtureBytes() {
  bytesPromise ||= (async () => {
    const out = {
      'tts.json': new TextEncoder().encode(JSON.stringify({
        ae: { sample_rate: 44100, base_chunk_size: 512 }, ttl: { chunk_compress_factor: 6, latent_dim: 24 },
      })),
      'unicode_indexer.bin': tinyIndexer(),
      'voice.bin': tinyVoices(),
    };
    for (const g of GRAPHS) {
      const url = new URL(`./fixtures/supertonic-tiny/${g}`, import.meta.url);
      out[g] = new Uint8Array(await (await fetch(url, { cache: 'no-store' })).arrayBuffer());
    }
    return out;
  })();
  return bytesPromise;
}

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let seq = 0;

/**
 * مديرُ نموذجٍ حقيقيّ (1A) على البيان المصغَّر، بإصدارٍ وmodelId فريدين.
 * @returns {Promise<{ model: object, manifest: object, fetchCalls: string[], wipe: () => Promise<void> }>}
 */
export async function tinyModelManager({ version = 'tiny-v1', modelId = `test-stp-${Date.now()}-${seq++}`, delayMs = 0 } = {}) {
  const { SUPERTONIC_MANIFEST } = await import('../js/services/shadow/tts/supertonic-manifest.js');
  const { createModelManager } = await import('../js/services/shadow/tts/supertonic-model.js');
  const bytes = await fixtureBytes();
  const files = [];
  for (const { name } of SUPERTONIC_MANIFEST.files) {
    files.push({ name, bytes: bytes[name].byteLength, sha256: await sha256Hex(bytes[name]),
      url: `https://models.test.invalid/${modelId}/${version}/${name}`, role: 'test' });
  }
  const manifest = { modelId, version, files, totalBytes: files.reduce((n, f) => n + f.bytes, 0) };
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(url);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); // ليُرى التقدّمُ في الواجهة
    return new Response(bytes[url.split('/').pop()].slice(), { status: 200 });
  };
  const storage = {
    async requestPersistence() { return { supported: true, persisted: true }; },
    async estimateStorage() { return { usage: 0, quota: 1e12 }; },
  };
  const model = createModelManager({ manifest, fetchImpl, storage });
  const wipe = async () => {
    for (const k of await caches.keys()) if (k.includes(`:${modelId}@`)) await caches.delete(k);
  };
  return { model, manifest, fetchCalls, wipe };
}

/**
 * LingoLife — مديرُ نموذج Supertonic 3 INT8 (المرحلة 1A)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما يحرسه هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * أنّ «جاهز» لا يُقال إلّا بعد أن يطابق **كلُّ** ملفٍّ حجمَه وSHA-256،
 * وأنّ الانقطاعَ لا يترك نموذجًا يبدو جاهزًا، وأنّ الإصدارات لا تختلط،
 * وأنّ الحذفَ لا يلمس غيرَ كاشات هذا النموذج، وأنّ تنظيفَ عامل الخدمة
 * عند النشر لا يستطيع محوَ النموذج.
 *
 * ⚠️ **لا يُنزَّل هنا بايتٌ واحدٌ من النموذج الحقيقيّ.** `fetch` محقونٌ
 *    يخدم ملفّاتٍ صغيرةً من الذاكرة؛ أمّا Cache Storage وcrypto.subtle
 *    فحقيقيّان — هما ما نختبره. وكلُّ اختبارٍ يستعمل `modelId` فريدًا
 *    ويحذف كاشاتِه في آخره.
 */

import { describe, it, expect } from './test-runner.js';

const mod = () => import('../js/services/shadow/tts/supertonic-model.js');
const manifestMod = () => import('../js/services/shadow/tts/supertonic-manifest.js');

const MB = 1024 * 1024;

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** بايتاتٌ حتميّةٌ من بذرة — ملفّان بنفس الاسم وبذرتين مختلفتين يختلفان. */
function bytesOf(seed, n) {
  const out = new Uint8Array(n);
  let x = seed * 2654435761 >>> 0;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

let seq = 0;
/**
 * بيانٌ صغيرٌ حقيقيُّ الهاشات + خادمُه.
 * @returns {Promise<{manifest: object, bodies: Map<string, Uint8Array>}>}
 */
async function fixture({ modelId = `test-st-${Date.now()}-${seq++}`, version = 'v1', seed = 1 } = {}) {
  const specs = [['config.json', 700], ['voice.bin', 3000], ['graph.onnx', 9000]];
  const bodies = new Map();
  const files = [];
  for (const [i, [name, n]] of specs.entries()) {
    const body = bytesOf(seed * 100 + i, n);
    const url = `https://models.test.invalid/${modelId}/${version}/${name}`;
    bodies.set(url, body);
    files.push({ name, bytes: n, sha256: await sha256Hex(body), url, role: 'test' });
  }
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  return { manifest: { modelId, version, files, totalBytes }, bodies };
}

/**
 * `fetch` محقون: يخدم الأجسام قطعًا من 512 بايتًا، ويسجّل كلَّ نداء.
 * `faults[url]`: 'network' | 'truncate' (خطأٌ في المنتصف) | 'short' (إغلاقٌ هادئٌ في المنتصف) | 'corrupt' | 'oversize' | رقمُ حالة HTTP.
 */
function fakeFetch(bodies, faults = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const fault = faults[url];
    if (fault === 'network') throw new TypeError('Failed to fetch');
    if (typeof fault === 'number') return new Response('nope', { status: fault });
    let body = bodies.get(url);
    if (!body) return new Response('missing', { status: 404 });
    if (fault === 'corrupt') { body = body.slice(); body[body.length >> 1] ^= 0xff; }
    if (fault === 'oversize') { body = new Uint8Array([...body, 1, 2, 3]); }
    let offset = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (init.signal?.aborted) {
          controller.error(new DOMException('aborted', 'AbortError'));
          return;
        }
        if (fault === 'short' && offset >= body.length >> 1) { controller.close(); return; }
        if (fault === 'truncate' && offset >= body.length >> 1) {
          controller.error(new TypeError('network error'));
          return;
        }
        if (offset >= body.length) { controller.close(); return; }
        controller.enqueue(body.slice(offset, offset + 512));
        offset += 512;
      },
    });
    return new Response(stream, { status: 200 });
  };
  return { impl, calls };
}

function fakeStorage({ usage = 0, quota = 10 * 1024 * MB } = {}) {
  const log = { persist: 0, estimate: 0 };
  return {
    log,
    storage: {
      async requestPersistence() { log.persist++; return { supported: true, persisted: true, asked: true }; },
      async estimateStorage() { log.estimate++; return { usage, quota, percent: null }; },
    },
  };
}

async function manager(fx, { faults, storage } = {}) {
  const { createModelManager } = await mod();
  const net = fakeFetch(fx.bodies, faults);
  const st = storage || fakeStorage();
  const m = createModelManager({ manifest: fx.manifest, fetchImpl: net.impl, storage: st.storage });
  return { m, net, st };
}

async function codeOf(promise) {
  try { await promise; } catch (e) { return e.code; }
  return 'resolved';
}

/** يحذف كلَّ كاشٍ لنموذج اختبار — تنظيفٌ لا يعتمد على الكود المُختبَر. */
async function wipe(modelId) {
  for (const k of await caches.keys()) if (k.includes(`:${modelId}@`)) await caches.delete(k);
}

describe('Supertonic 1A · مديرُ النموذج — تنزيلٌ عند الطلب ومُتحقَّقٌ منه', () => {
  it('١ · جديد: غيرُ منزَّل، بلا شبكة وبلا كاشٍ يُنشأ بمجرّد السؤال', async () => {
    const fx = await fixture();
    const { m, net } = await manager(fx);
    const s = await m.getStatus();
    expect(s.state).toBe('not_downloaded');
    expect(s.availability).toBe('model_not_downloaded');
    expect(s.downloadedBytes).toBe(0);
    expect(s.totalBytes).toBe(12700);
    expect(s.version).toBe('v1');
    expect(net.calls).toHaveLength(0);
    expect(await caches.has(m.cacheName)).toBe(false);
  });

  it('٢ · تنزيلٌ ناجح: جاهزٌ بلا شبكة، والبايتاتُ هي نفسُها بالضبط', async () => {
    const fx = await fixture();
    const { m, net, st } = await manager(fx);
    try {
      const s = await m.download();
      expect(s.state).toBe('ready');
      expect(s.availability).toBe('ready_offline');
      expect(s.downloadedBytes).toBe(fx.manifest.totalBytes);
      expect(s.filesVerified).toBe(3);
      expect(s.error).toBe(null);
      expect(st.log.persist).toBe(1);
      expect(net.calls.every((c) => c.init.cache === 'no-store')).toBe(true);
      const got = new Uint8Array(await m.getFileBytes('graph.onnx'));
      expect(await sha256Hex(got)).toBe(fx.manifest.files[2].sha256);
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٣ · التقدّم: متزايدٌ، لكلّ ملفّ، وينتهي بـ done عند المجموع', async () => {
    const fx = await fixture();
    const { m } = await manager(fx);
    try {
      const events = [];
      await m.download((p) => events.push(p));
      const bytes = events.map((e) => e.downloadedBytes);
      expect(bytes.every((b, i) => i === 0 || b >= bytes[i - 1])).toBe(true);
      expect(events.every((e) => e.totalBytes === 12700)).toBe(true);
      const phases = new Set(events.map((e) => e.phase));
      expect([...phases].join(',')).toBe('preparing,downloading,verifying,finalizing,done');
      expect(events.filter((e) => e.phase === 'verifying').map((e) => e.file).join(','))
        .toBe('config.json,voice.bin,graph.onnx');
      const graph = events.filter((e) => e.phase === 'downloading' && e.file === 'graph.onnx');
      expect(graph.length > 5).toBe(true);
      expect(graph.at(-1).fileBytes).toBe(9000);
      expect(events.at(-1).phase).toBe('done');
      expect(events.at(-1).downloadedBytes).toBe(12700);
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٤ · فشلُ SHA-256: يُرفض برمزٍ واضح، لا يُخزَّن الملفّ، ولا «جاهز»', async () => {
    const fx = await fixture();
    const bad = fx.manifest.files[1].url;
    const { m } = await manager(fx, { faults: { [bad]: 'corrupt' } });
    try {
      expect(await codeOf(m.download())).toBe('checksum-mismatch');
      const s = await m.getStatus();
      expect(s.state).toBe('partial');
      expect(s.availability).toBe('model_not_downloaded');
      expect(s.error.code).toBe('checksum-mismatch');
      expect(s.error.file).toBe('voice.bin');
      expect(s.downloadedBytes).toBe(700);
      expect(await codeOf(m.getFileBytes('config.json'))).toBe('not-ready');
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٥ · حجمٌ زائد أو خطأ HTTP: رمزٌ واضح ولا «جاهز»', async () => {
    const fx = await fixture();
    const [a, , c] = fx.manifest.files.map((f) => f.url);
    const { m } = await manager(fx, { faults: { [a]: 'oversize' } });
    const { m: m2 } = await manager(fx, { faults: { [c]: 404 } });
    const { m: m3 } = await manager(fx, { faults: { [a]: 'short' } });
    try {
      expect(await codeOf(m3.download())).toBe('size-mismatch');
      expect((await m3.getStatus()).error.message).toContain('512/700');
      expect(await codeOf(m.download())).toBe('size-mismatch');
      expect((await m.getStatus()).state).toBe('not_downloaded');
      expect(await codeOf(m2.download())).toBe('http-404');
      expect((await m2.getStatus()).state).toBe('partial');
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٦ · انقطاعٌ في منتصف ملفّ (شبكة أو إلغاء): partial لا ready_offline', async () => {
    const fx = await fixture();
    const g = fx.manifest.files[2].url;
    const { m } = await manager(fx, { faults: { [g]: 'truncate' } });
    try {
      expect(await codeOf(m.download())).toBe('network');
      let s = await m.getStatus();
      expect(s.state).toBe('partial');
      expect(s.availability).toBe('model_not_downloaded');
      expect(s.downloadedBytes).toBe(3700);

      const fx2 = await fixture();
      const { m: m2 } = await manager(fx2);
      const ctrl = new AbortController();
      const code = await codeOf(m2.download((p) => {
        if (p.file === 'voice.bin' && p.phase === 'downloading') ctrl.abort();
      }, { signal: ctrl.signal }));
      expect(code).toBe('aborted');
      s = await m2.getStatus();
      expect(s.state).toBe('partial');
      expect(s.availability).toBe('model_not_downloaded');
      expect(s.downloadedBytes).toBe(700);
      await wipe(fx2.manifest.modelId);
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٧ · إعادةُ المحاولة: تُكمل الناقصَ فقط، وتمحو الخطأ، وتصل إلى ready', async () => {
    const fx = await fixture();
    const g = fx.manifest.files[2].url;
    const faults = { [g]: 'truncate' };
    const { m, net } = await manager(fx, { faults });
    try {
      expect(await codeOf(m.download())).toBe('network');
      expect((await m.getStatus()).error.code).toBe('network');
      delete faults[g]; // الشبكةُ عادت
      const before = net.calls.length;
      let during = null;
      const s = await m.download((p) => { if (p.phase === 'downloading' && !during) during = m.getStatus(); });
      const mid = await during;
      expect(mid.state).toBe('downloading');
      expect(mid.error).toBe(null); // الخطأُ القديم لا يُعرَض أثناء المحاولة الجديدة
      expect(s.state).toBe('ready');
      expect(s.error).toBe(null);
      expect(net.calls.slice(before).map((c) => c.url).join(',')).toBe(g);
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٧ب · كلُّ الملفّات سليمة بلا علامة (انقطاعٌ قبل كتابتها): ليس جاهزًا، وverify يُكمل', async () => {
    const fx = await fixture();
    const { m } = await manager(fx);
    try {
      await m.download();
      const cache = await caches.open(m.cacheName);
      const marker = (await cache.keys()).find((r) => r.url.endsWith('/__verified__.json'));
      await cache.delete(marker);
      const s = await m.getStatus();
      expect(s.filesVerified).toBe(3);
      expect(s.state).toBe('partial');
      expect(s.availability).toBe('model_not_downloaded');
      expect(await codeOf(m.getFileBytes('tts.json'))).toBe('unknown-file');
      expect(await codeOf(m.getFileBytes('voice.bin'))).toBe('not-ready');
      expect((await m.verify()).ok).toBe(true);
      expect((await m.getStatus()).state).toBe('ready');
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٨ · المساحةُ لا تكفي بوضوح: يُرفض قبل أيّ تنزيلٍ أو كاش', async () => {
    const fx = await fixture();
    const st = fakeStorage({ usage: 100 * MB, quota: 110 * MB });
    const { m, net } = await manager(fx, { storage: st });
    try {
      expect(await codeOf(m.download())).toBe('insufficient-storage');
      const s = await m.getStatus();
      expect(s.error.code).toBe('insufficient-storage');
      expect(s.error.message).toContain('MB');
      expect(net.calls).toHaveLength(0);
      expect(await caches.has(m.cacheName)).toBe(false);
      expect(st.log.persist).toBe(1);

      // حصّةٌ مجهولة (متصفّحٌ بلا estimate): لا نخمّن فشلًا — نحاول.
      const unknown = { log: {}, storage: {
        async requestPersistence() { return { persisted: false }; },
        async estimateStorage() { return { usage: null, quota: null }; },
      } };
      const { m: m2 } = await manager(fx, { storage: unknown });
      expect((await m2.download()).state).toBe('ready');
      expect((await m2.getStatus()).persisted).toBe(false);
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('٩ · الإصدارات: الجديدُ يُنزَّل بجوار القديم، والقديمُ يبقى حتى يتحقّق الجديد', async () => {
    const v1 = await fixture({ version: 'v1', seed: 1 });
    const modelId = v1.manifest.modelId;
    const v2 = await fixture({ modelId, version: 'v2', seed: 2 });
    try {
      const { m: m1 } = await manager(v1);
      await m1.download();

      const g2 = v2.manifest.files[2].url;
      const { m: m2 } = await manager(v2, { faults: { [g2]: 'truncate' } });
      let s2 = await m2.getStatus();
      expect(s2.state).toBe('not_downloaded');
      expect(s2.otherVersions.join(',')).toBe('v1');
      expect(await codeOf(m2.download())).toBe('network');

      // القديمُ ما زال جاهزًا وسليمًا، والجديدُ ناقصٌ لا يستعير منه شيئًا.
      expect((await m1.getStatus()).state).toBe('ready');
      s2 = await m2.getStatus();
      expect(s2.state).toBe('partial');
      expect(s2.downloadedBytes).toBe(3700);
      expect(await codeOf(m2.getFileBytes('config.json'))).toBe('not-ready');

      // ملفُّ v1 بنفس الاسم ليس ملفَّ v2 ولو وُضع في كاشه.
      const c2 = await caches.open(m2.cacheName);
      const k1 = (await (await caches.open(m1.cacheName)).keys()).find((r) => r.url.endsWith('/graph.onnx'));
      await c2.put(k1.url.replace('/v1/', '/v2/'), await (await caches.open(m1.cacheName)).match(k1));
      expect((await m2.getStatus()).state).toBe('partial');

      const { m: m2b } = await manager(v2);
      const done = await m2b.download();
      expect(done.state).toBe('ready');
      expect(done.otherVersions).toHaveLength(0);
      expect(await caches.has(m1.cacheName)).toBe(false);
      expect(await sha256Hex(await m2b.getFileBytes('graph.onnx'))).toBe(v2.manifest.files[2].sha256);
      expect(v2.manifest.files[2].sha256 === v1.manifest.files[2].sha256).toBe(false);
    } finally { await wipe(modelId); }
  });

  it('١٠ · verify(): ملفٌّ فاسدٌ في الكاش يُسقط «جاهز»، والتنزيلُ يصلحه', async () => {
    const fx = await fixture();
    const { m } = await manager(fx);
    try {
      await m.download();
      expect((await m.verify()).ok).toBe(true);
      const cache = await caches.open(m.cacheName);
      const key = (await cache.keys()).find((r) => r.url.endsWith('/voice.bin'));
      const old = await cache.match(key);
      const rotten = new Uint8Array(await old.arrayBuffer());
      rotten[10] ^= 1;
      await cache.put(key, new Response(rotten, { headers: old.headers }));
      // الترويسةُ ما زالت تقول «سليم» — verify يعيد التجزئة فلا ينخدع.
      const r = await m.verify();
      expect(r.ok).toBe(false);
      expect(r.failed.map((f) => `${f.name}:${f.reason}`).join(',')).toBe('voice.bin:checksum-mismatch');
      const s = await m.getStatus();
      expect(s.state).toBe('partial');
      expect(s.availability).toBe('model_not_downloaded');
      expect((await m.download()).state).toBe('ready');
    } finally { await wipe(fx.manifest.modelId); }
  });

  it('١١ · الحذف: كاشاتُ هذا النموذج فقط — لا غيرُها ولا الصوتُ المولَّد', async () => {
    const fx = await fixture();
    const { m } = await manager(fx);
    const other = `ll-model:other-${fx.manifest.modelId}@1`;
    const app = `lingolife-test-${fx.manifest.modelId}`;
    const { putGeneratedAudio, generatedCacheStats } = await import('../js/services/shadow/tts/audio-cache.js');
    try {
      await m.download();
      await caches.open(other);
      await caches.open(app);
      await putGeneratedAudio({
        cacheKey: `a2-test-${fx.manifest.modelId}`, normalizedText: 'за́мок', providerId: 'p-test',
        voiceId: null, model: null, language: 'ru', settingsKey: '', mimeType: 'audio/wav',
        duration: 1, blob: new Blob([new Uint8Array(8)], { type: 'audio/wav' }), provenance: 'test',
      });
      const before = (await generatedCacheStats()).items;

      const r = await m.delete();
      expect(r.deleted.join(',')).toBe(m.cacheName);
      expect(await caches.has(m.cacheName)).toBe(false);
      expect(await caches.has(other)).toBe(true);
      expect(await caches.has(app)).toBe(true);
      expect((await generatedCacheStats()).items).toBe(before);
      const s = await m.getStatus();
      expect(s.state).toBe('not_downloaded');
      expect(s.error).toBe(null);
    } finally {
      const { generatedAudio } = await import('../js/db/repositories.js');
      await generatedAudio.destroy(`a2-test-${fx.manifest.modelId}`).catch(() => {});
      await caches.delete(other);
      await caches.delete(app);
      await wipe(fx.manifest.modelId);
    }
  });

  it('١٢أ · Cache Storage مرفوض (نافذة Firefox الخاصّة) أو غائب: unsupported برمزٍ واضح لا استثناء', async () => {
    const fx = await fixture();
    const { createModelManager } = await mod();
    const denied = { has: async () => { throw new DOMException('denied', 'SecurityError'); },
      keys: async () => { throw new DOMException('denied', 'SecurityError'); } };
    for (const cacheStorage of [denied, null]) {
      const m = createModelManager({ manifest: fx.manifest, cacheStorage, fetchImpl: fakeFetch(fx.bodies).impl,
        storage: fakeStorage().storage });
      const s = await m.getStatus();
      expect(s.state).toBe('unsupported');
      expect(s.availability).toBe('unavailable_in_web');
      expect(s.error.code).toBe('cache-unavailable');
    }
    const none = createModelManager({ manifest: fx.manifest, cacheStorage: null, fetchImpl: fakeFetch(fx.bodies).impl,
      storage: fakeStorage().storage });
    expect(await codeOf(none.download())).toBe('cache-unavailable');
  });

  it('١٢ · عمليّتان معًا: الثانية «busy» ولا تُفسد الأولى', async () => {
    const fx = await fixture();
    const { m } = await manager(fx);
    try {
      const first = m.download();
      expect(await codeOf(m.download())).toBe('busy');
      expect(await codeOf(m.delete())).toBe('busy');
      expect((await first).state).toBe('ready');
      expect((await m.getStatus()).error).toBe(null);
    } finally { await wipe(fx.manifest.modelId); }
  });
});

describe('Supertonic 1A · تنظيفُ عامل الخدمة لا يمحو النموذج', () => {
  /**
   * ⚠️ **يُشغَّل `service-worker.js` الحقيقيّ** في صندوقٍ يلتقط مستمعيه —
   *    لا نسخةً من منطقه. فإن تغيّر مرشِّحُ `activate` يومًا ليطال
   *    `ll-model:` فشل هذا الاختبار.
   */
  async function loadSW() {
    const src = await (await fetch('../service-worker.js', { cache: 'no-store' })).text();
    const listeners = {};
    const self = {
      location: new URL('../', location.href),
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting() {}, clients: { claim: async () => {} },
    };
    return { src, listeners, self };
  }

  it('١٣ · حدثُ activate يحذف كاشات lingolife- القديمة ويترك كاش النموذج', async () => {
    const { src, listeners, self } = await loadSW();
    const { getSupertonicModel } = await mod();
    const name = getSupertonicModel().cacheName;
    const deleted = [];
    const fakeCaches = {
      keys: async () => ['lingolife-old-build', 'lingolife-__BUILD__', name, `${name.split('@')[0]}@older`],
      delete: async (k) => { deleted.push(k); return true; },
    };
    new Function('self', 'caches', 'fetch', src)(self, fakeCaches, () => { throw new Error('no fetch'); });
    let done;
    listeners.activate({ waitUntil: (p) => { done = p; } });
    await done;
    expect(deleted.join(',')).toBe('lingolife-old-build');
    expect(name.startsWith('lingolife-')).toBe(false);
  });

  it('١٤ · وعاملُ الخدمة لا يعترض تنزيلَ النموذج من مصدرٍ آخر (لا نسخةَ ثانية في كاش البناء)', async () => {
    const { src, listeners, self } = await loadSW();
    new Function('self', 'caches', 'fetch', src)(self, {}, () => { throw new Error('no fetch'); });
    const { SUPERTONIC_MANIFEST } = await manifestMod();
    let intercepted = false;
    listeners.fetch({
      request: new Request(SUPERTONIC_MANIFEST.files[0].url),
      respondWith: () => { intercepted = true; },
    });
    expect(intercepted).toBe(false);
  });
});

describe('Supertonic 1A · البيانُ المُثبَّت والحدود', () => {
  it('١٥ · البيان: 7 ملفّات، الأحجامُ تجمع totalBytes، كلُّ هاشٍ 64 سداسيًّا، ومصدرٌ مُثبَّتٌ بإيداع', async () => {
    const { SUPERTONIC_MANIFEST: M } = await manifestMod();
    expect(M.modelId).toBe('supertonic3-int8');
    expect(M.version).toBe('2026-05-11+cca5a0e');
    expect(M.files).toHaveLength(7);
    expect(M.files.reduce((s, f) => s + f.bytes, 0)).toBe(M.totalBytes);
    expect(M.totalBytes).toBe(145295768);
    expect(M.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
    expect(new Set(M.files.map((f) => f.sha256)).size).toBe(7);
    expect(M.files.every((f) => f.url.includes(`/resolve/${M.source.revision}/${f.name}`))).toBe(true);
    expect(M.source.revision.startsWith(M.version.split('+')[1])).toBe(true);
    expect(M.files.map((f) => f.name).sort().join(',')).toBe([
      'duration_predictor.int8.onnx', 'text_encoder.int8.onnx', 'tts.json', 'unicode_indexer.bin',
      'vector_estimator.int8.onnx', 'vocoder.int8.onnx', 'voice.bin'].join(','));
    expect(Object.isFrozen(M) && Object.isFrozen(M.files) && Object.isFrozen(M.files[0])).toBe(true);
  });

  it('١٥ب · التخزينُ الافتراضيّ يصل خدمةَ التخزين الحقيقيّة (لا مسارَ مكسورًا يُبتلع خطؤه)', async () => {
    const { defaultStorage } = await mod();
    const estimate = await defaultStorage.estimateStorage();
    expect(typeof estimate.quota).toBe('number');
    expect(typeof estimate.usage).toBe('number');
    const persisted = await defaultStorage.requestPersistence();
    expect(typeof persisted.supported).toBe('boolean');
  });

  it('١٦ · لا تنزيلَ تلقائيّ: المديرُ الحقيقيّ يُسأل عن حالته بلا شبكةٍ وبلا كاش', async () => {
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (...a) => { calls++; return realFetch(...a); };
    try {
      const { getSupertonicModel } = await mod();
      const m = getSupertonicModel();
      const hadCache = await caches.has(m.cacheName);
      const s = await m.getStatus();
      expect(calls).toBe(0);
      expect(await caches.has(m.cacheName)).toBe(hadCache);
      if (!hadCache) expect(s.state).toBe('not_downloaded');
      expect(m.cacheName).toBe('ll-model:supertonic3-int8@2026-05-11+cca5a0e');
    } finally { globalThis.fetch = realFetch; }
  });

  it('١٧ · وليس صوتًا متاحًا بعد: لا مزوّدَ Supertonic في السجلّ ولا في الإقلاع', async () => {
    const { ensureTTSProvidersRegistered } = await import('../js/services/shadow/tts/bootstrap.js');
    const { listProviders } = await import('../js/services/shadow/tts/registry.js');
    ensureTTSProvidersRegistered();
    expect(listProviders().some((p) => /supertonic/i.test(p.id))).toBe(false);
    const boot = await (await fetch('../js/services/shadow/tts/bootstrap.js', { cache: 'no-store' })).text();
    expect(/supertonic/i.test(boot)).toBe(false);
  });
});

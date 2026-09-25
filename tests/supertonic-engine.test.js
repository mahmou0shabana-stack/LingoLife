/**
 * LingoLife — محرّكُ Supertonic 3 داخل المتصفّح (المرحلة 1B)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما يحرسه هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * العاملُ الحقيقيّ + ONNX Runtime Web المورَّد الحقيقيّ + خطُّ الأصل كاملًا
 * (تحضيرُ النصّ ← المدّة ← الترميز ← 8 خطوات ← المُرمِّز الصوتيّ ← WAV) —
 * لكن على **نموذجٍ مصغَّرٍ بديل** (`tests/fixtures/supertonic-tiny/`،
 * ~15 KB، يولّده `scripts/make-supertonic-fixtures.py`): أسماءُ مداخله
 * ومخارجه وأنواعُها ورتبُها كالنموذج الحقيقيّ، وكلُّ مخرجٍ يعتمد على ما
 * يجب أن يصل: مواضعُ المعرّفات (فالنبرُ يغيّر الصوت)، والصوتُ المختار،
 * والضجيجُ المبذور. فتجري هذه الاختبارات في كلّ تشغيلٍ بلا الـ145 MB.
 *
 * ⚠️ **النموذجُ الحقيقيّ** يُفحص بأداة المطوّر `tools/supertonic-smoke.html`
 *    (خارج الواجهة) — القياساتُ في رسالة إيداع المرحلة 1B.
 */

import { describe, it, expect } from './test-runner.js';

const engineMod = () => import('../js/services/shadow/tts/supertonic-engine.js');
const textMod = () => import('../js/services/shadow/tts/supertonic-text.js');

const GRAPHS = ['duration_predictor.int8.onnx', 'text_encoder.int8.onnx', 'vector_estimator.int8.onnx', 'vocoder.int8.onnx'];

async function sha256Hex(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf instanceof Blob ? await buf.arrayBuffer() : buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** فهرسٌ بديل: كلُّ نقطة ترميزٍ معروفة، ومعرّفُها (cp % 997) + 1. */
const idOf = (cp) => (cp % 997) + 1;

function tinyIndexer() {
  const idx = new Int32Array(65536);
  for (let c = 0; c < idx.length; c++) idx[c] = idOf(c);
  return idx.buffer;
}

/** voice.bin بصيغة sherpa: رأسٌ int64 ثم ttl للعشرة ثم dp — لكلّ صوتٍ قيمٌ مميّزة. */
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
  return buf;
}

let fixtureBytes = null;
async function fixtureFiles() {
  if (!fixtureBytes) {
    fixtureBytes = {
      'tts.json': new TextEncoder().encode(JSON.stringify({
        ae: { sample_rate: 44100, base_chunk_size: 512 }, ttl: { chunk_compress_factor: 6, latent_dim: 24 },
      })).buffer,
      'unicode_indexer.bin': tinyIndexer(),
      'voice.bin': tinyVoices(),
    };
    for (const g of GRAPHS) {
      fixtureBytes[g] = await (await fetch(`./fixtures/supertonic-tiny/${g}`, { cache: 'no-store' })).arrayBuffer();
    }
  }
  return fixtureBytes;
}

/**
 * مديرُ نموذجٍ بديل بواجهة المرحلة 1A نفسِها (`files` و`version` و`getFileBytes`)،
 * بأسماء الملفّات الحقيقيّة وترتيبها. يُسجّل كلَّ ما أعطاه ليُفحص تحريرُه.
 */
async function tinyModel({ notReady = false, version = 'tiny-1' } = {}) {
  const { SUPERTONIC_MANIFEST } = await import('../js/services/shadow/tts/supertonic-manifest.js');
  const { ModelError } = await import('../js/services/shadow/tts/supertonic-model.js');
  const bytes = await fixtureFiles();
  const handed = [];
  return {
    files: SUPERTONIC_MANIFEST.files.map(({ name }) => ({ name })),
    version,
    handed,
    async getFileBytes(name) {
      if (notReady) throw new ModelError('not-ready', { file: name });
      const copy = bytes[name].slice(0);
      handed.push({ name, buffer: copy });
      return copy;
    },
  };
}

async function engineWith(opts = {}, extra = {}) {
  const { createSupertonicEngine } = await engineMod();
  const model = await tinyModel(opts);
  return { engine: createSupertonicEngine({ model, ...extra }), model };
}

async function codeOf(promise) {
  try { await promise; } catch (e) { return e.code; }
  return 'resolved';
}

/** يقرأ ترويسةَ WAV ويتحقّق منها. */
async function wavInfo(blob) {
  const v = new DataView(await blob.arrayBuffer());
  const str = (o, n) => String.fromCharCode(...new Uint8Array(v.buffer, o, n));
  return {
    riff: str(0, 4), wave: str(8, 4), fmt: str(12, 4), data: str(36, 4),
    riffSize: v.getUint32(4, true), format: v.getUint16(20, true), channels: v.getUint16(22, true),
    sampleRate: v.getUint32(24, true), byteRate: v.getUint32(28, true), bits: v.getUint16(34, true),
    dataSize: v.getUint32(40, true), size: blob.size, type: blob.type,
  };
}

const LOCK = 'Он до́лго смотре́л на замо́к.';
/** بصمةُ WAV للنموذج البديل (F1، LOCK، 8 خطوات) — راجع اختبار ١١ب. */
const GOLDEN_F1_LOCK = 'f746aa68019271aaaf26f3ed968c690883d0c39ebbae379517cf53c1495f4347';
const GOLDEN_F1_LOCK_SAMPLES = 55296;
const CASTLE = 'Он до́лго смотре́л на за́мок.';

describe('Supertonic 1B · تحضيرُ النصّ — النبرُ والـё يصلان النموذج', () => {
  it('١ · U+0301 يبقى في موضعه بعد التحضير، وNFC يعيد النصَّ حرفًا', async () => {
    const { preprocessText } = await textMod();
    for (const text of [LOCK, CASTLE, 'Мне ну́жен а́тлас.', 'Я плачу́.', 'Э́то была́ мука́.']) {
      const p = preprocessText(text);
      expect(p.normalize('NFC')).toBe(`<ru>${text.normalize('NFC')}</ru>`);
      expect([...p].filter((c) => c === '́').length).toBe([...text].filter((c) => c === '́').length);
    }
    const lock = preprocessText(LOCK);
    const castle = preprocessText(CASTLE);
    expect(lock === castle).toBe(false);
    expect(lock.includes('замо́к')).toBe(true);
    expect(castle.includes('за́мок')).toBe(true);
  });

  it('٢ · ё وЁ: تصل مفكوكةً (е + U+0308) كما دُرِّب النموذج — لا تُطوى إلى е أبدًا', async () => {
    const { preprocessText } = await textMod();
    const text = 'Ёлка уже́ стои́т, и всё гото́во. ЁЖ пришёл.';
    const p = preprocessText(text);
    expect(p.normalize('NFC')).toBe(`<ru>${text}</ru>`);
    const yoCount = [...text].filter((c) => c === 'ё' || c === 'Ё').length;
    expect([...p].filter((c) => c === '̈').length).toBe(yoCount);
    expect(p.includes('Ёлка') && p.includes('всё') && p.includes('ЁЖ') && p.includes('прішёл') === false).toBe(true);
    expect(p.includes('пришёл')).toBe(true);
    // ولا نقطةَ ترميزٍ مركّبة: الفهرسُ الحقيقيّ يعطي ё/Ё ‎-1.
    expect(/[ёЁ]/.test(p)).toBe(false);
    // و«й» كذلك تصل مفكوكة (и + U+0306) — لا تضيع.
    expect(preprocessText('Мой дом.').normalize('NFC')).toBe('<ru>Мой дом.</ru>');
  });

  it('٣ · نصٌّ يونيكوديّ آخر يمرّ كما هو (عدا استبدالات الأصل الموثّقة)', async () => {
    const { preprocessText } = await textMod();
    expect(preprocessText('«Привет», — сказал он').normalize('NFC')).toBe('<ru>«Привет», - сказал он.</ru>');
    expect(preprocessText('Цена: 1250 рублей!').normalize('NFC')).toBe('<ru>Цена: 1250 рублей!</ru>');
  });

  it('٤ · المعرّفات: U+0301 وU+0308 معرّفان في موضعيهما — وللـ«قصر» و«القفل» تسلسلان مختلفان', async () => {
    const { preprocessText, textToIds } = await textMod();
    const idx = new Int32Array(tinyIndexer());
    const lock = textToIds(preprocessText(LOCK), idx).ids;
    const castle = textToIds(preprocessText(CASTLE), idx).ids;
    expect(lock.length).toBe(castle.length);
    expect(lock.join() === castle.join()).toBe(false);
    expect([...lock].sort().join()).toBe([...castle].sort().join()); // الأحرفُ نفسُها، المواضعُ لا
    const yo = textToIds(preprocessText('всё'), idx);
    expect(yo.ids.includes(idOf(0x308))).toBe(true);
    expect(yo.unknown).toBe(0);
  });

  it('٥ · البذرة: الطلبُ نفسُه = البذرةُ نفسُها (وNFD مثل NFC)؛ تغييرُ أيّ جزءٍ يغيّرها', async () => {
    const { seedFor, mulberry32 } = await textMod();
    const base = ['v1', 'F1', 1.05, 8, 0, CASTLE];
    // ё تختلف بين NFC وNFD (Ё ⇄ Е+U+0308) — والبذرةُ لا تختلف.
    const yo = 'Ёлка и всё.';
    expect(yo.normalize('NFD') === yo).toBe(false);
    expect(seedFor(['v1', 'F1', yo])).toBe(seedFor(['v1', 'F1', yo.normalize('NFD')]));
    const others = [['v2', 'F1', 1.05, 8, 0, CASTLE], ['v1', 'M1', 1.05, 8, 0, CASTLE], ['v1', 'F1', 1.1, 8, 0, CASTLE],
      ['v1', 'F1', 1.05, 8, 1, CASTLE], ['v1', 'F1', 1.05, 8, 0, LOCK]];
    expect(new Set([seedFor(base), ...others.map(seedFor)]).size).toBe(6);
    const a = mulberry32(42); const b = mulberry32(42);
    expect([a(), a(), a()].join()).toBe([b(), b(), b()].join());
  });

  it('٦ · voice.bin: F1 = الصوتُ 0 وM1 = الصوتُ 5، ورأسٌ غريب يُرفض', async () => {
    const { parseVoice, SUPERTONIC_VOICES } = await textMod();
    expect(JSON.stringify(SUPERTONIC_VOICES)).toBe('{"F1":0,"M1":5}');
    const buf = tinyVoices();
    expect(parseVoice(buf, 0).ttl[0].toFixed(2)).toBe('0.10');
    expect(parseVoice(buf, 5).dp[0].toFixed(2)).toBe('0.30');
    const bad = buf.slice(0);
    new DataView(bad).setBigInt64(0, 9n, true);
    let threw = false;
    try { parseVoice(bad, 0); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

describe('Supertonic 1B · المحرّك في عاملٍ مستقلّ', () => {
  it('٧ · النموذجُ غيرُ جاهز: model-not-ready، ولا عاملَ يُنشأ أصلًا', async () => {
    let created = 0;
    const { engine } = await engineWith({ notReady: true }, { createWorker: () => { created++; throw new Error('x'); } });
    expect(await codeOf(engine.init())).toBe('model-not-ready');
    expect(await codeOf(engine.synthesize({ text: LOCK }))).toBe('model-not-ready');
    expect(created).toBe(0);
    expect(engine.state).toBe('error');
    expect(engine.error.code).toBe('model-not-ready');
    // والافتراضيُّ هو مديرُ المرحلة 1A الوحيد — لا مخزنَ آخر.
    const { createSupertonicEngine } = await engineMod();
    const { getSupertonicModel } = await import('../js/services/shadow/tts/supertonic-model.js');
    expect(createSupertonicEngine().model === getSupertonicModel()).toBe(true);
  });

  it('٨ · تحميلٌ ناجح: خيطٌ واحد، بلا عزل مصدر، كلُّ ملفٍّ مرّةً واحدة ثم يُنقل (لا نسخةَ في الخيط الرئيسيّ)', async () => {
    const { engine, model } = await engineWith();
    try {
      const info = await engine.init();
      expect(engine.state).toBe('ready');
      expect(info.numThreads).toBe(1);
      expect(info.crossOriginIsolated).toBe(false);
      expect(info.voices.join()).toBe('F1,M1');
      expect(info.ortVersion).toBe('1.27.0');
      expect(model.handed.map((h) => h.name).join()).toBe(model.files.map((f) => f.name).join());
      // المخزنُ المؤقّت منقولٌ إلى العامل: فارغٌ (detached) هنا.
      expect(model.handed.every((h) => h.buffer.byteLength === 0)).toBe(true);
      // ونداءُ init ثانٍ لا يعيد التحميل.
      await engine.init();
      expect(model.handed).toHaveLength(7);
    } finally { await engine.dispose(); }
  });

  it('٩ · F1 وM1: صوتان مختلفان، وWAV صالحٌ يقبله مسارُ الصوت القائم', async () => {
    const { engine } = await engineWith();
    try {
      const f1 = await engine.synthesize({ text: LOCK, voice: 'F1' });
      const m1 = await engine.synthesize({ text: LOCK, voice: 'M1' });
      expect(f1.voice).toBe('F1');
      expect(m1.voice).toBe('M1');
      expect((await sha256Hex(f1.blob)) === (await sha256Hex(m1.blob))).toBe(false);
      // النموذجُ البديل يطيل المدّةَ بمتوسّط style_dp (F1 = 0.05، M1 = 0.30):
      // فأسلوبُ الصوت المختار — لا البذرةُ وحدها — وصل النموذج.
      expect(m1.samples > f1.samples).toBe(true);
      for (const r of [f1, m1]) {
        const w = await wavInfo(r.blob);
        expect(`${w.riff}|${w.wave}|${w.fmt}|${w.data}`).toBe('RIFF|WAVE|fmt |data');
        expect(`${w.format}|${w.channels}|${w.sampleRate}|${w.bits}`).toBe('1|1|44100|16');
        expect(w.byteRate).toBe(88200);
        expect(w.dataSize).toBe(r.samples * 2);
        expect(w.riffSize).toBe(36 + r.samples * 2);
        expect(w.size).toBe(44 + r.samples * 2);
        expect(w.type).toBe('audio/wav');
        expect(r.samples > 0 && r.samples % 3072 === 0).toBe(true);
        expect(r.duration).toBe(r.samples / 44100);
        expect(r.steps).toBe(8);
      }
      expect(await codeOf(engine.synthesize({ text: LOCK, voice: 'F2' }))).toBe('unknown-voice');
      expect(await codeOf(engine.synthesize({ text: '   ' }))).toBe('empty-text');
    } finally { await engine.dispose(); }
  });

  it('١٠ · النبرُ يصل النموذجَ نفسَه: «за́мок» و«замо́к» صوتان مختلفان، والتحضيرُ يُرجَع كما هو', async () => {
    const { engine } = await engineWith();
    try {
      const lock = await engine.synthesize({ text: LOCK });
      const castle = await engine.synthesize({ text: CASTLE });
      expect(lock.frontend[0].processed.normalize('NFC')).toBe(`<ru>${LOCK}</ru>`);
      expect(castle.frontend[0].processed.normalize('NFC')).toBe(`<ru>${CASTLE}</ru>`);
      expect(lock.frontend[0].ids.filter((i) => i === idOf(0x301)).length).toBe(3);
      expect((await sha256Hex(lock.blob)) === (await sha256Hex(castle.blob))).toBe(false);
      const yo = await engine.synthesize({ text: 'Ёлка и всё.' });
      expect(yo.frontend[0].processed.normalize('NFC')).toBe('<ru>Ёлка и всё.</ru>');
      expect(yo.frontend[0].ids.filter((i) => i === idOf(0x308)).length).toBe(2);
      expect(yo.frontend[0].unknown).toBe(0);
    } finally { await engine.dispose(); }
  });

  it('١١ · حتميّ: الطلبُ نفسُه = البايتاتُ نفسُها — في المحرّك نفسِه، وفي محرّكٍ جديد، وبعد dispose', async () => {
    const { engine } = await engineWith();
    const { engine: other } = await engineWith();
    try {
      const a = await sha256Hex((await engine.synthesize({ text: CASTLE, voice: 'M1' })).blob);
      const b = await sha256Hex((await engine.synthesize({ text: CASTLE, voice: 'M1' })).blob);
      const c = await sha256Hex((await other.synthesize({ text: CASTLE, voice: 'M1' })).blob);
      await engine.dispose();
      const d = await sha256Hex((await engine.synthesize({ text: CASTLE, voice: 'M1' })).blob);
      expect(new Set([a, b, c, d]).size).toBe(1);
      const normal = await engine.synthesize({ text: CASTLE, voice: 'M1' });
      const fast = await engine.synthesize({ text: CASTLE, voice: 'M1', speed: 2 });
      expect((await sha256Hex(fast.blob)) === a).toBe(false);
      expect(fast.samples < normal.samples).toBe(true); // السرعةُ تقصّر المدّة فعلًا
    } finally { await engine.dispose(); await other.dispose(); }
  });

  it('١١ب · بصمةٌ ذهبيّة: خطُّ الأصل بحذافيره (8 خطوات بترتيبها، الضجيجُ، الأسلوب، WAV) — V8', async () => {
    /*
     * ⚠️ **مُثبَّتةٌ على V8 (Chromium).** Box-Muller يستعمل Math.log/cos/sqrt؛
     *    V8 يطبّقها بمنافذ fdlibm فتتطابق بين الأجهزة، لكن محرّكًا آخر قد
     *    يختلف في آخر بت. خارج Chromium: الحتميّةُ تُفحص (١١) لا البصمة.
     */
    const { engine } = await engineWith();
    try {
      const r = await engine.synthesize({ text: LOCK, voice: 'F1' });
      const got = await sha256Hex(r.blob);
      if (/Chrome\//.test(navigator.userAgent)) expect(got).toBe(GOLDEN_F1_LOCK);
      expect(r.samples).toBe(GOLDEN_F1_LOCK_SAMPLES);
    } finally { await engine.dispose(); }
  });

  it('١٢ · الإلغاء: الجاري والمنتظر يُرفضان فورًا بـ cancelled، ونتيجتُهما لا تصل — والتالي سليم', async () => {
    const { createSupertonicEngine } = await engineMod();
    let synthPosted = null;
    let results = 0;
    /** العاملُ الحقيقيّ، مع مراقبةٍ: متى أُرسل التوليد، وكم نتيجةً أعاد فعلًا. */
    const engine = createSupertonicEngine({ model: await tinyModel(), createWorker: () => {
      const w = new Worker(new URL('../js/services/shadow/tts/supertonic-worker.js', import.meta.url), { type: 'module' });
      const post = w.postMessage.bind(w);
      w.postMessage = (m, t) => { post(m, t); if (m.type === 'synth') synthPosted?.(); };
      w.addEventListener('message', ({ data }) => { if (data.type === 'result') results++; });
      return w;
    } });
    try {
      await engine.init();
      const inWorker = new Promise((r) => { synthPosted = r; });
      const running = engine.synthesize({ text: LOCK });
      const queued = engine.synthesize({ text: 'Мне ну́жен а́тлас.' });
      await inWorker; // «running» في العامل الآن، ونتيجتُه (رسالةٌ لاحقة) لم تصل بعد
      synthPosted = null;
      engine.cancel();
      const settled = await Promise.allSettled([running, queued]);
      expect(settled.map((s) => `${s.status}:${s.reason?.code}`).join()).toBe('rejected:cancelled,rejected:cancelled');
      // الطلبُ التالي يأخذ **نتيجتَه هو** — والعاملُ أكمل الملغى فعلًا ثم رُمي.
      const next = await engine.synthesize({ text: CASTLE });
      expect(next.frontend[0].processed.normalize('NFC')).toBe(`<ru>${CASTLE}</ru>`);
      expect(results).toBe(2); // الملغى + التالي؛ والمنتظرُ لم يُرسَل أصلًا
      // وإلغاءٌ قبل أن يبدأ الطلبُ أصلًا.
      const early = engine.synthesize({ text: LOCK });
      engine.cancel();
      expect(await codeOf(early)).toBe('cancelled');
      expect(engine.state).toBe('ready');
    } finally { await engine.dispose(); }
  });

  it('١٣ · dispose ثم إعادةُ التحميل: يعود خاملًا، ينهي العامل، يقرأ الملفّاتِ من جديد، ويولّد', async () => {
    const workers = [];
    const { engine, model } = await engineWith({}, { createWorker: () => {
      const w = new Worker(new URL('../js/services/shadow/tts/supertonic-worker.js', import.meta.url), { type: 'module' });
      const terminate = w.terminate.bind(w);
      w.terminated = false;
      w.terminate = () => { w.terminated = true; terminate(); };
      workers.push(w);
      return w;
    } });
    await engine.init();
    const pending = codeOf(engine.synthesize({ text: LOCK }));
    await engine.dispose();
    expect(await pending).toBe('cancelled');
    expect(engine.state).toBe('idle');
    expect(engine.info).toBe(null);
    expect(workers.map((w) => w.terminated).join()).toBe('true'); // الذاكرةُ كلُّها تُحرَّر
    const again = await engine.synthesize({ text: LOCK });
    expect(again.samples > 0).toBe(true);
    expect(model.handed).toHaveLength(14);
    await engine.dispose();
    // dispose أثناء التحميل: خاملٌ نظيف لا «error».
    const loading = codeOf(engine.init());
    await engine.dispose();
    expect(await loading).toBe('disposed');
    expect(engine.state).toBe('idle');
    expect(engine.error).toBe(null);
  });

  it('١٤ · موتُ العامل (أثناء التحميل أو التوليد): worker-crashed، ثم يستعيد بعاملٍ جديد', async () => {
    const { createSupertonicEngine } = await engineMod();
    /** عاملٌ حقيقيّ يموت بخطأٍ غير ممسوك عند نوع رسالةٍ معيّن. */
    const dyingWorker = (dieOn) => new Worker(URL.createObjectURL(new Blob([`
      self.onmessage = ({ data }) => {
        if (data.type === '${dieOn}') { setTimeout(() => { throw new Error('boom'); }); return; }
        self.postMessage({ type: data.type === 'ready' ? 'ready' : 'loaded', id: data.id,
          info: { voices: ['F1', 'M1'], numThreads: 1 } });
      };`], { type: 'text/javascript' })), { type: 'module' });
    const real = () => new Worker(new URL('../js/services/shadow/tts/supertonic-worker.js', import.meta.url), { type: 'module' });

    for (const dieOn of ['load-file', 'synth']) {
      let n = 0;
      const model = await tinyModel();
      const engine = createSupertonicEngine({ model, createWorker: () => (n++ === 0 ? dyingWorker(dieOn) : real()) });
      try {
        expect(await codeOf(engine.synthesize({ text: LOCK }))).toBe('worker-crashed');
        expect(engine.state).toBe('error');
        expect(engine.error.code).toBe('worker-crashed');
        const ok = await engine.synthesize({ text: LOCK });
        expect(ok.samples > 0).toBe(true);
        expect(engine.state).toBe('ready');
        expect(engine.error).toBe(null);
        expect(n).toBe(2);
      } finally { await engine.dispose(); }
    }
  });
});

describe('Supertonic 1B · الحدود', () => {
  it('١٥ · الخيطُ الرئيسيّ لا يستورد ONNX Runtime؛ العاملُ وحده، ومن vendor/ المحلّيّ', async () => {
    const src = async (p) => (await fetch(p, { cache: 'no-store' })).text();
    const engineSrc = await src('../js/services/shadow/tts/supertonic-engine.js');
    const workerSrc = await src('../js/services/shadow/tts/supertonic-worker.js');
    const code = (t) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(/onnxruntime|InferenceSession|ort\.wasm/.test(code(engineSrc))).toBe(false);
    expect(workerSrc.includes("'../../../../vendor/onnxruntime-web/'")).toBe(true);
    expect(/https?:\/\//.test(workerSrc.replace(/\/\*[\s\S]*?\*\//g, ''))).toBe(false);
    expect(/webgpu|numThreads = [^1]/i.test(workerSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).toBe(false);
    expect(typeof globalThis.ort).toBe('undefined');
  });

  it('١٦ · المحرّكُ مورَّدٌ محلّيًّا بالبصمات المُثبَّتة (لا CDN)', async () => {
    const version = await (await fetch('../vendor/onnxruntime-web/VERSION.txt', { cache: 'no-store' })).text();
    expect(version).toContain('onnxruntime-web 1.27.0');
    for (const f of ['ort.wasm.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
      const bytes = await (await fetch(`../vendor/onnxruntime-web/${f}`, { cache: 'no-store' })).arrayBuffer();
      expect(version).toContain(`${await sha256Hex(bytes)}  ${f}`);
    }
  });

  it('١٧ · الطريقُ العامّ بلا حالةٍ خاصّة: مُكيِّفُ النطق والذاكرةُ ومختبرُ الأصوات لا يعرفون Supertonic (1C)', async () => {
    const { ensureTTSProvidersRegistered } = await import('../js/services/shadow/tts/bootstrap.js');
    const { listProviders } = await import('../js/services/shadow/tts/registry.js');
    ensureTTSProvidersRegistered();
    expect(listProviders().some((p) => /supertonic/i.test(p.id))).toBe(false);
    const code = (t) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    for (const f of ['../js/modals/voice-lab.js', '../js/services/shadow/tts/speaker-adapter.js',
      '../js/services/shadow/tts/audio-cache.js', '../js/services/shadow/audio-bus.js']) {
      const text = code(await (await fetch(f, { cache: 'no-store' })).text());
      expect(`${f}: ${/supertonic/i.test(text)}`).toBe(`${f}: false`);
    }
  });});

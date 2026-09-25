/**
 * LingoLife — Supertonic مزوّدًا في البنية القائمة ولوحة الصوت (المرحلة 1C)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما يحرسه هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * أنّ Supertonic يمرّ بالطريق الوحيد القائم — السجلّ ← مُكيِّف النطق ←
 * ذاكرة الصوت المولَّد ← `<audio>` الواحد تحت ملكيّة الناقل — لا بطريقٍ
 * ثانٍ؛ وأنّ الذاكرةَ تُغني عن الاستدلال (وهو أبطأُ من الزمن الحقيقيّ)؛
 * وأنّ هويّتَها تفصل النبرَ والصوتَ وإصدارَ النموذج؛ وأنّ لوحةَ الصوت تُنزّل
 * وتتحقّق وتحذف بضغطاتٍ صريحة.
 *
 * ⚠️ **كلُّ شيءٍ حقيقيّ عدا النقل والنموذج**: مديرُ 1A الحقيقيّ (Cache Storage
 *    وSHA-256) على بيانٍ مصغَّر، ومحرّكُ 1B الحقيقيّ (عاملٌ + ONNX Runtime Web)
 *    على النموذج البديل (`tests/fixtures/supertonic-tiny`). راجع `supertonic-fixture.js`.
 *    والتشغيلُ: `<audio>` حقيقيٌّ و`play()` وحدها محقونة (المتصفّحُ بلا واجهة
 *    قد يحجب التشغيل الآليّ) — تسجّل ما شُغِّل وتُنهيه.
 */

import { describe, it, expect } from './test-runner.js';
import { tinyModelManager } from './supertonic-fixture.js';

const providerMod = () => import('../js/services/shadow/tts/supertonic-provider.js');
const engineMod = () => import('../js/services/shadow/tts/supertonic-engine.js');
const cacheMod = () => import('../js/services/shadow/tts/audio-cache.js');
const registryMod = () => import('../js/services/shadow/tts/registry.js');

const LOCK = 'Он до́лго смотре́л на замо́к.';
const CASTLE = 'Он до́лго смотре́л на за́мок.';

const until = async (check, label = '', ms = 15000) => {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > ms) throw new Error(`انتهت المهلة${label ? ` — ${label}` : ''}`);
    await new Promise((r) => setTimeout(r, 20));
  }
};

async function sha256Hex(blob) {
  const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * محرّكٌ حقيقيّ ملفوفٌ بعدّاد: كلُّ نداء `synthesize` = استدلالٌ مطلوب.
 * (`Object.create` لأنّ المحرّك مجمَّدٌ وحالتُه قرّاءاتٌ على إغلاق.)
 */
async function countedEngine(model, opts = {}) {
  const { createSupertonicEngine } = await engineMod();
  const engine = createSupertonicEngine({ model, ...opts });
  const calls = [];
  const spy = Object.create(engine, {
    synthesize: { value: (req) => { calls.push(req); return engine.synthesize(req); } },
  });
  return { engine: spy, calls };
}

/** مزوّدٌ على نموذجٍ مصغَّرٍ حقيقيّ — منزَّلٍ أو لا. */
async function setup({ download = true, version, engineOpts, delayMs } = {}) {
  const tiny = await tinyModelManager({ version, delayMs });
  if (download) await tiny.model.download();
  const { engine, calls } = await countedEngine(tiny.model, engineOpts);
  const { createSupertonicProvider } = await providerMod();
  const provider = createSupertonicProvider({ model: tiny.model, engine });
  const cleanup = async () => {
    await provider.dispose();
    await tiny.wipe();
  };
  return { ...tiny, provider, calls, cleanup };
}

/** `<audio>.play()` محقونة: تسجّل العنصرَ والرابطَ والسرعة، ثم «ينتهي» المقطع. */
function stubPlay() {
  const played = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() {
    played.push({ el: this, src: this.src, rate: this.playbackRate });
    setTimeout(() => this.onended?.(), 15);
    return Promise.resolve();
  };
  return { played, restore: () => { HTMLMediaElement.prototype.play = orig; } };
}

describe('Supertonic 1C · مزوّدٌ في البنية القائمة', () => {
  it('١ · التسجيل: ليس في الإقلاع الافتراضيّ؛ خلف علَمه بنمط Piper، ومزوّدٌ واحدٌ مهما تكرّر', async () => {
    const { ensureTTSProvidersRegistered, registerSupertonicProviderIfFlagged } =
      await import('../js/services/shadow/tts/bootstrap.js');
    const { listProviders, getProvider, unregisterProvider } = await registryMod();
    ensureTTSProvidersRegistered();
    expect(listProviders().some((p) => p.id === 'supertonic')).toBe(false);
    const realFetch = window.fetch;
    let hf = 0;
    window.fetch = (u, i) => { if (String(u).includes('huggingface')) hf++; return realFetch(u, i); };
    try {
      const a = registerSupertonicProviderIfFlagged();
      const b = registerSupertonicProviderIfFlagged();
      expect(a === b && getProvider('supertonic') === a).toBe(true);
      expect(a.type).toBe('supertonic');
      await a.isAvailable(); // سؤالُ الحالة لا يُنزّل شيئًا
      expect(hf).toBe(0);
    } finally {
      window.fetch = realFetch;
      unregisterProvider('supertonic');
    }
  });

  it('٢ · قبل التنزيل: model_not_downloaded بسببٍ وحجم — وأثناءه model_downloading — وغيرُ مدعوم: unavailable_in_web', async () => {
    const t = await setup({ download: false, delayMs: 30 });
    try {
      let a = await t.provider.isAvailable();
      expect(`${a.available}|${a.status}`).toBe('false|model_not_downloaded');
      expect(a.reason).toContain('MB');
      const during = [];
      await t.model.download(() => { if (!during.length) during.push(t.provider.isAvailable()); });
      a = await during[0];
      expect(`${a.available}|${a.status}`).toBe('false|model_downloading');
      const { createSupertonicProvider } = await providerMod();
      const noRuntime = createSupertonicProvider({ model: t.model, engine: { state: 'idle' }, isRuntimeSupported: () => false });
      expect((await noRuntime.isAvailable()).status).toBe('unavailable_in_web');
      const { createModelManager } = await import('../js/services/shadow/tts/supertonic-model.js');
      const noCache = createSupertonicProvider({ model: createModelManager({ manifest: t.manifest, cacheStorage: null }), engine: { state: 'idle' } });
      expect((await noCache.isAvailable()).status).toBe('unavailable_in_web');
    } finally { await t.cleanup(); }
  });

  it('٣ · بعد نموذجٍ مُتحقَّق: ready_offline — وF1 وM1 وحدهما', async () => {
    const t = await setup();
    try {
      const a = await t.provider.isAvailable();
      expect(`${a.available}|${a.status}`).toBe('true|ready_offline');
      const voices = await t.provider.getVoices();
      expect(voices.map((v) => v.id).join()).toBe('F1,M1');
      expect(voices.every((v) => v.language === 'ru-RU' && v.name)).toBe(true);
      expect(t.provider.modelVersion).toBe('tiny-v1');
      expect(t.provider.supportsOffline).toBe(true);
    } finally { await t.cleanup(); }
  });

  it('٤ · نتيجةُ التوليد: WAV مولَّد لا يُشغَّل مباشرة، ومنشؤه supertonic_generated، والنصُّ يصل بحرفه', async () => {
    const t = await setup();
    try {
      const r = await t.provider.synthesize({ text: 'Ёлка и всё за́мок.', voiceId: 'M1', speed: 0.6 });
      expect(r.error).toBe(null);
      expect(r.audioBlob.type).toBe('audio/wav');
      expect(r.playedDirectly).toBe(false);
      expect(r.provenance).toBe('supertonic_generated');
      expect(r.duration > 0).toBe(true);
      // لا نبرَ يُضاف ولا يُنزع، وё كما هي، والسرعةُ لا تدخل التوليد (تُطبَّق عند التشغيل).
      expect(JSON.stringify(t.calls[0])).toBe(JSON.stringify({ text: 'Ёлка и всё за́мок.', voice: 'M1' }));
      expect((await t.provider.synthesize({ text: LOCK, voiceId: 'Milena' })).error).toBe('unknown-voice');
      expect(t.calls).toHaveLength(1);
    } finally { await t.cleanup(); }
  });
});

describe('Supertonic 1C · ذاكرةُ الصوت المولَّد القائمة', () => {
  it('٥ · أوّلُ مرّة: miss ← استدلال ← تخزين؛ والتالية: hit بلا استدلالٍ ثانٍ — ولو بسرعةٍ أخرى', async () => {
    const t = await setup();
    const { synthesizeWithCache, computeCacheKey, getCachedAudio } = await cacheMod();
    try {
      const first = await synthesizeWithCache({ provider: t.provider, text: LOCK, voiceId: 'F1', speed: 0.8 });
      expect(`${first.cached}|${first.error}|${t.calls.length}`).toBe('false|null|1');
      const second = await synthesizeWithCache({ provider: t.provider, text: LOCK, voiceId: 'F1', speed: 0.8 });
      expect(`${second.cached}|${t.calls.length}`).toBe('true|1');
      expect(await sha256Hex(second.blob)).toBe(await sha256Hex(first.blob));
      // السرعةُ عند التشغيل: منزلقٌ آخر لا يطلب استدلالًا جديدًا لصوتٍ متطابق.
      const faster = await synthesizeWithCache({ provider: t.provider, text: LOCK, voiceId: 'F1', speed: 1.3 });
      expect(`${faster.cached}|${t.calls.length}`).toBe('true|1');
      // والصفُّ يحمل هويّةَ النموذج التي دخلت مفتاحَه.
      const { cacheKey } = await computeCacheKey({ text: LOCK, providerId: 'supertonic', voiceId: 'F1',
        model: t.provider.modelId, modelVersion: 'tiny-v1', settingsKey: t.provider.settingsKey });
      const row = await getCachedAudio(cacheKey);
      expect(`${row.providerId}|${row.voiceId}|${row.modelVersion}|${row.provenance}`).toBe('supertonic|F1|tiny-v1|supertonic_generated');
    } finally { await t.cleanup(); }
  });

  it('٦ · النبر: «за́мок» و«замо́к» هويّتان وتوليدان مختلفان — والـё ليست е', async () => {
    const t = await setup();
    const { synthesizeWithCache } = await cacheMod();
    try {
      const lock = await synthesizeWithCache({ provider: t.provider, text: LOCK, voiceId: 'F1' });
      const castle = await synthesizeWithCache({ provider: t.provider, text: CASTLE, voiceId: 'F1' });
      expect(`${lock.cached}|${castle.cached}|${t.calls.length}`).toBe('false|false|2');
      expect((await sha256Hex(lock.blob)) === (await sha256Hex(castle.blob))).toBe(false);
      const unmarked = await synthesizeWithCache({ provider: t.provider, text: 'Он долго смотрел на замок.', voiceId: 'F1' });
      expect(`${unmarked.cached}|${t.calls.length}`).toBe('false|3');
      const yo = await synthesizeWithCache({ provider: t.provider, text: 'всё', voiceId: 'F1' });
      const ye = await synthesizeWithCache({ provider: t.provider, text: 'все', voiceId: 'F1' });
      expect(`${yo.cached}|${ye.cached}|${t.calls.length}`).toBe('false|false|5');
      expect(t.calls.map((c) => c.text).join('|')).toBe(`${LOCK}|${CASTLE}|Он долго смотрел на замок.|всё|все`);
    } finally { await t.cleanup(); }
  });

  it('٧ · الصوت: F1 وM1 هويّتان وتوليدان مختلفان', async () => {
    const t = await setup();
    const { synthesizeWithCache } = await cacheMod();
    try {
      const f1 = await synthesizeWithCache({ provider: t.provider, text: CASTLE, voiceId: 'F1' });
      const m1 = await synthesizeWithCache({ provider: t.provider, text: CASTLE, voiceId: 'M1' });
      expect(`${f1.cached}|${m1.cached}|${t.calls.length}`).toBe('false|false|2');
      expect((await sha256Hex(f1.blob)) === (await sha256Hex(m1.blob))).toBe(false);
      const again = await synthesizeWithCache({ provider: t.provider, text: CASTLE, voiceId: 'M1' });
      expect(`${again.cached}|${t.calls.length}`).toBe('true|2');
    } finally { await t.cleanup(); }
  });

  it('٨ · إصدارُ النموذج: الإصدارُ الجديد لا يُعيد صوتَ القديم من الذاكرة', async () => {
    const v1 = await setup({ version: 'tiny-v1' });
    const v2 = await setup({ version: 'tiny-v2' });
    const { synthesizeWithCache } = await cacheMod();
    try {
      await synthesizeWithCache({ provider: v1.provider, text: LOCK, voiceId: 'F1' });
      const r = await synthesizeWithCache({ provider: v2.provider, text: LOCK, voiceId: 'F1' });
      expect(`${r.cached}|${v1.calls.length}|${v2.calls.length}`).toBe('false|1|1');
      const r1 = await synthesizeWithCache({ provider: v1.provider, text: LOCK, voiceId: 'F1' });
      expect(r1.cached).toBe(true);
    } finally { await v1.cleanup(); await v2.cleanup(); }
  });

  it('٩ · المزوّداتُ القائمة: مفاتيحُها كما كانت (السرعةُ ما زالت في مفتاح من لا يعلن settingsKey)', async () => {
    const { synthesizeWithCache } = await cacheMod();
    let n = 0;
    const legacy = {
      id: `legacy-${Date.now()}`, name: 'legacy', type: 'piper',
      async isAvailable() { return { available: true, status: 'ready_offline', reason: '' }; },
      async getVoices() { return []; },
      async synthesize({ text }) {
        n++;
        return { audioBlob: new Blob([text], { type: 'audio/wav' }), provenance: 'piper_generated', error: null };
      },
      cancel() {},
    };
    await synthesizeWithCache({ provider: legacy, text: 'Дом', speed: 0.8 });
    await synthesizeWithCache({ provider: legacy, text: 'Дом', speed: 1.2 });
    const hit = await synthesizeWithCache({ provider: legacy, text: 'Дом', speed: 0.8 });
    expect(`${n}|${hit.cached}`).toBe('2|true');
    const src = await (await fetch('../js/services/shadow/tts/audio-cache.js', { cache: 'no-store' })).text();
    expect(src.includes("typeof provider.settingsKey === 'string' ? provider.settingsKey : `speed=${speed ?? ''}`")).toBe(true);
  });
});

describe('Supertonic 1C · مُكيِّف النطق والناقل والإلغاء', () => {
  it('١٠ · الطريقُ الواحد: speaker ← الذاكرة ← <audio> الواحد؛ والتكرارُ يُشغَّل من الذاكرة بلا استدلال', async () => {
    const t = await setup();
    const { registerProvider, unregisterProvider } = await registryMod();
    const { createTTSSpeaker } = await import('../js/services/shadow/tts/speaker-adapter.js');
    const play = stubPlay();
    registerProvider(t.provider);
    try {
      const sources = [];
      const speaker = createTTSSpeaker({ providerId: 'supertonic', onSource: (s) => sources.push(s) });
      const a = await speaker.speak(CASTLE, { rate: 0.8, voiceName: 'M1' });
      const b = await speaker.speak(CASTLE, { rate: 1.1, voiceName: 'M1' });
      expect(`${a.ok}|${b.ok}|${t.calls.length}`).toBe('true|true|1');
      expect(sources.map((s) => `${s.providerId}:${s.cached}:${s.provenance}`).join(','))
        .toBe('supertonic:false:supertonic_generated,supertonic:true:supertonic_generated');
      expect(play.played).toHaveLength(2);
      expect(play.played[0].el === play.played[1].el).toBe(true); // العنصرُ الواحد نفسُه
      expect(`${play.played[0].rate}|${play.played[1].rate}`).toBe('0.8|1.1'); // السرعةُ عند التشغيل
    } finally {
      play.restore();
      unregisterProvider('supertonic');
      await t.cleanup();
    }
  });

  it('١١ · الإلغاء أثناء التوليد: لا يُشغَّل ولا يُخزَّن — والاستدلالُ الجاري يكمل ويُرمى (دلالة 1B)', async () => {
    const t = await setup();
    const { registerProvider, unregisterProvider } = await registryMod();
    const { createTTSSpeaker } = await import('../js/services/shadow/tts/speaker-adapter.js');
    const { generatedCacheStats } = await cacheMod();
    const play = stubPlay();
    registerProvider(t.provider);
    try {
      const before = (await generatedCacheStats()).byProvider.supertonic || 0;
      const speaker = createTTSSpeaker({ providerId: 'supertonic' });
      const pending = speaker.speak(LOCK, { rate: 1, voiceName: 'F1' });
      await until(() => t.calls.length === 1);
      speaker.cancel();
      const out = await pending;
      expect(`${out.ok}|${out.reason}`).toBe('false|aborted');
      expect(play.played).toHaveLength(0);
      expect((await generatedCacheStats()).byProvider.supertonic || 0).toBe(before);
      // والتالي سليم.
      const next = await speaker.speak(LOCK, { rate: 1, voiceName: 'F1' });
      expect(`${next.ok}|${play.played.length}`).toBe('true|1');
    } finally {
      play.restore();
      unregisterProvider('supertonic');
      await t.cleanup();
    }
  });

  it('١٢ · موتُ المحرّك: engine_failed صادقة، و«أعد المحاولة» تعيده جاهزًا ويولّد', async () => {
    let n = 0;
    const dying = () => new Worker(URL.createObjectURL(new Blob([`
      self.onmessage = ({ data }) => {
        if (data.type === 'synth') { setTimeout(() => { throw new Error('boom'); }); return; }
        self.postMessage({ type: data.type === 'ready' ? 'ready' : 'loaded', id: data.id, info: { voices: ['F1', 'M1'] } });
      };`], { type: 'text/javascript' })), { type: 'module' });
    const real = () => new Worker(new URL('../js/services/shadow/tts/supertonic-worker.js', import.meta.url), { type: 'module' });
    const t = await setup({ engineOpts: { createWorker: () => (n++ === 0 ? dying() : real()) } });
    try {
      const failed = await t.provider.synthesize({ text: LOCK, voiceId: 'F1' });
      expect(failed.error).toBe('worker-crashed');
      const a = await t.provider.isAvailable();
      expect(`${a.available}|${a.status}`).toBe('false|engine_failed');
      await t.provider.retry();
      expect((await t.provider.isAvailable()).status).toBe('ready_offline');
      const ok = await t.provider.synthesize({ text: LOCK, voiceId: 'F1' });
      expect(`${ok.error}|${ok.audioBlob.size > 44}|${n}`).toBe('null|true|2');
    } finally { await t.cleanup(); }
  });

  it('١٣ · حذفُ النموذج: يحرّر المحرّك، ويصير غيرَ متاح، والتوليدُ بعده model-not-ready', async () => {
    const t = await setup();
    try {
      await t.provider.synthesize({ text: LOCK, voiceId: 'F1' });
      const r = await t.provider.deleteModel();
      expect(r.deleted).toHaveLength(1);
      const a = await t.provider.isAvailable();
      expect(`${a.available}|${a.status}`).toBe('false|model_not_downloaded');
      expect((await t.provider.synthesize({ text: LOCK, voiceId: 'F1' })).error).toBe('model-not-ready');
      expect((await t.provider.isAvailable()).status).toBe('model_not_downloaded');
    } finally { await t.cleanup(); }
  });
});

/* ══════════ لوحة الصوت الحقيقيّة (Voice Center) ══════════ */

const QV_SECTION_KEY = 'lingolife.quickVoice.section';
const forgetSection = () => { try { localStorage.removeItem(QV_SECTION_KEY); } catch { /* محجوب */ } };

async function mountShadow({ provider = null, ttsProviderId = null, flag = null } = {}) {
  forgetSection();
  const { resetDevices, on, TABLET } = await import('./sync-devices.js');
  const registry = await registryMod();
  await resetDevices([TABLET]);
  await on(TABLET, () => {});
  const { settings } = await import('../js/db/repositories.js');
  const { SUPERTONIC_FLAG_KEY } = await providerMod();
  if (flag !== null) await settings.set(SUPERTONIC_FLAG_KEY, flag);
  if (ttsProviderId) await settings.set('shadow.ttsProvider', ttsProviderId);
  if (provider) registry.registerProvider(provider);
  const { createSession, SOURCE_TYPE } = await import('../js/services/shadow/shadow-session-service.js');
  const { session } = await createSession({
    sourceType: SOURCE_TYPE.SELECTION,
    text: 'Нам ну́жно перейти́ к документа́ции.\nЗаказ гото́в.',
    settings: { speed: 0.8, repeatCount: 1, volume: 1 },
  });
  const view = await import('../js/views/shadow-view.js');
  const main = document.createElement('main');
  main.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none';
  document.body.append(main);
  await view.renderShadow(main, session.id);
  await until(() => main.querySelector('[data-sh="qv"]'));
  const $ = (sel) => document.querySelector(sel);
  const dispose = async () => {
    const playBtn = main.querySelector('[data-sh="play"]');
    if (playBtn?.classList.contains('on')) {
      playBtn.click();
      /* ⚠️ الإيقافُ يحفظ عدّادَ التكرار — ويُترك ليكتمل قبل أن يمسح الاختبارُ التالي القاعدة. */
      await new Promise((r) => setTimeout(r, 400));
    }
    try { view.disposeShadow(); } catch { /* ماتت */ }
    main.remove();
    registry.unregisterProvider('supertonic');
    await settings.set('shadow.ttsProvider', 'browser');
    await settings.set(SUPERTONIC_FLAG_KEY, false);
    forgetSection();
  };
  return { main, $, dispose };
}

const openPanel = async (t) => {
  if (!document.querySelector('.sh-qv-pop')) t.main.querySelector('[data-sh="qv"]').click();
  await until(() => document.querySelector('.sh-qv-pop'));
};

describe('Supertonic 1C · لوحة الصوت (Voice Center)', () => {
  it('١٤ · قسمُ النموذج: غيرُ منزَّل ← «نزّل» بتقدّم ← جاهز (المزوّدُ يصير متاحًا) ← تحقّق ← حذفٌ بتأكيد ← غيرُ متاح', async () => {
    const t0 = await setup({ download: false, delayMs: 60 });
    const t = await mountShadow({ provider: t0.provider });
    try {
      await openPanel(t);
      const option = () => t.$('[data-sh="qv-provider"] option[value="supertonic"]');
      expect(`${!!option()}|${option().disabled}`).toBe('true|true');
      expect(t.$('[data-qv-why]').textContent).toContain('غير منزَّل');
      const section = t.$('[data-qv-model]');
      section.querySelector('summary').click();
      const state = () => t.$('[data-qv-model-text]')?.dataset.state;
      await until(() => state() === 'not-downloaded', 'step 1: () => state() === not-downloaded');
      const dl = t.$('[data-sh="qv-model-download"]');
      expect(dl.textContent).toContain('MB');
      expect(t0.fetchCalls).toHaveLength(0); // لا شيءَ قبل الضغطة

      dl.click();
      await until(() => state() === 'downloading', 'step 2: () => state() === downloading');
      expect(!!t.$('[data-qv-model-progress]') && !!t.$('[data-sh="qv-model-cancel"]')).toBe(true);
      await until(() => state() === 'ready', 'step 3: () => state() === ready');
      expect(t0.fetchCalls).toHaveLength(7);
      await until(() => option() && !option().disabled, 'step 4: () => option() && !option().disabled');
      expect(!!t.$('[data-sh="qv-model-verify"]') && !!t.$('[data-sh="qv-model-delete"]')).toBe(true);
      expect(t.$('[data-qv-model-detail]').textContent).toContain('tiny-v1');

      // العمليّةُ تُعيد رسمَ القسم مرّتين (جارٍ ← جاهز): الزرُّ القديمُ يُستبدَل فلا يُخدَع الانتظار.
      const verifyBtn = t.$('[data-sh="qv-model-verify"]');
      verifyBtn.click();
      await until(() => !verifyBtn.isConnected && state() === 'ready', 'verify finished');

      // «إلغاء» في التأكيد لا يحذف شيئًا (١٤٥ MB لا تُمحى بنقرةٍ خاطئة).
      t.$('[data-sh="qv-model-delete"]').click();
      await until(() => document.querySelector('.modal-actions button[data-value=""]'), 'cancel button');
      document.querySelector('.modal-actions button[data-value=""]').click();
      await new Promise((r) => setTimeout(r, 150));
      expect(`${state()}|${(await t0.model.getStatus()).state}`).toBe('ready|ready');

      t.$('[data-sh="qv-model-delete"]').click();
      await until(() => document.querySelector('.modal-actions button[data-value="submit"]'), 'step 7: () => document.querySelector(.modal-act');
      document.querySelector('.modal-actions button[data-value="submit"]').click();
      await until(() => state() === 'not-downloaded', 'step 8: () => state() === not-downloaded');
      await until(() => option()?.disabled, 'step 9: () => option()?.disabled');
      expect((await caches.keys()).some((k) => k.includes(t0.manifest.modelId))).toBe(false);
    } finally { await t.dispose(); await t0.cleanup(); }
  });

  it('١٥ · «جرّب الصوت» = طريقُ الجلسة نفسُه: الناقل (speak) ← المزوّد ← الذاكرة ← العنصرُ الواحد', async () => {
    const t0 = await setup();
    const play = stubPlay();
    const bus = await import('../js/services/shadow/audio-bus.js');
    const { generatedCacheStats } = await cacheMod();
    const t = await mountShadow({ provider: t0.provider, ttsProviderId: 'supertonic' });
    try {
      await openPanel(t);
      const before = (await generatedCacheStats()).byProvider.supertonic || 0;
      t.$('[data-sh="qv-preview"]').click();
      expect(bus.audioOwner()).toBe('speak'); // يطالب بالناقل قبل أيّ انتظار
      await until(() => play.played.length === 1);
      expect(t0.calls).toHaveLength(1);
      expect(t0.calls[0].text).toBe('Привет! Так звучит этот голос.');
      await until(() => bus.audioOwner() === null);
      expect((await generatedCacheStats()).byProvider.supertonic).toBe(before + 1);

      // التجربةُ الثانية من الذاكرة: لا استدلال.
      t.$('[data-sh="qv-preview"]').click();
      await until(() => play.played.length === 2);
      expect(t0.calls).toHaveLength(1);

      // وتشغيلُ الجلسة: الناقلُ باسم session، والمزوّدُ نفسُه، والعنصرُ نفسُه.
      t.main.querySelector('[data-sh="play"]').click();
      await until(() => t0.calls.length === 2 && play.played.length === 3);
      expect(bus.audioOwner()).toBe('session');
      expect(t0.calls[1].text).toBe('Нам ну́жно перейти́ к документа́ции.');
      expect(play.played[2].el === play.played[0].el).toBe(true);
    } finally {
      await t.dispose();
      play.restore();
      await t0.cleanup();
    }
  });

  it('١٦ · العلَم: مطفأٌ ⇒ لا Supertonic ولا قسم؛ مفعَّلٌ ⇒ يُسجَّل ويظهر القسم — بلا أيّ تنزيل', async () => {
    const realFetch = window.fetch;
    let hf = 0;
    window.fetch = (u, i) => { if (String(u).includes('huggingface')) hf++; return realFetch(u, i); };
    try {
      let t = await mountShadow({ flag: false });
      await openPanel(t);
      expect(`${!!t.$('[data-sh="qv-provider"] option[value="supertonic"]')}|${!!t.$('[data-qv-model]')}`).toBe('false|false');
      await t.dispose();
      document.querySelector('.sh-qv-pop')?.remove();

      t = await mountShadow({ flag: true });
      try {
        await openPanel(t);
        expect(`${!!t.$('[data-sh="qv-provider"] option[value="supertonic"]')}|${!!t.$('[data-qv-model]')}`).toBe('true|true');
        t.$('[data-qv-model] summary').click();
        await until(() => t.$('[data-qv-model-text]')?.dataset.state && t.$('[data-qv-model-text]').dataset.state !== 'loading');
        expect(hf).toBe(0);
      } finally { await t.dispose(); }
    } finally { window.fetch = realFetch; }
  });
});

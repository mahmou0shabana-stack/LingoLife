/**
 * LingoLife — تدقيقُ مزوّدي النطق: الجسرُ المحلّيّ وRHVoice وXTTS وCloud
 *
 * ═══════════════════════════════════════════════════════════════
 * ما يحرسه هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * كانت RHVoice وXTTS وCloud تظهر في مركز الصوت ولا تعمل:
 *   · XTTS: الجسرُ يعمل، والمتصفّحُ يحجب ردَّه (لا رؤوسَ CORS، و OPTIONS
 *     ‏501)، فيقول «غير متّصل» — ولا محرّكَ فيه أصلًا (synthesize ‏501).
 *   · RHVoice: عقدٌ بلا تشغيل — «غير متاح» دائمًا، والجسرُ لا يعرفه.
 *   · Cloud: عقدٌ بلا خدمة.
 *
 * ⚠️ **والجسرُ هنا مُحاكًى بـ`fetchImpl` محقون** — يجيب كما يجيب
 *    `scripts/tts-bridge/server.py` بالحرف (`/health` بمحرّكاته، و
 *    `/voices?engine=`، و`/synthesize` بـ`engine`)، ويسجّل كلَّ طلب. فيُقاس
 *    ما يُرسَل فعلًا وما يُقال للمستعمِل — لا شكلُ الشيفرة.
 */

import { describe, it, expect } from './test-runner.js';
import { createLocalBridge } from '../js/services/shadow/tts/local-bridge.js';
import { createRHVoiceProvider } from '../js/services/shadow/tts/rhvoice-provider.js';
import { createXTTSBridgeProvider } from '../js/services/shadow/tts/xtts-bridge-provider.js';
import { createCloudAIProvider } from '../js/services/shadow/tts/cloud-provider.js';
import { AVAILABILITY, PROVENANCE } from '../js/services/shadow/tts/types.js';

const RH_VOICES = [
  { id: 'anna', name: 'Anna', language: 'ru', gender: 'female' },
  { id: 'aleksandr', name: 'Aleksandr', language: 'ru', gender: 'male' },
];

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

/**
 * جسرٌ مُحاكًى. `mode`:
 *   down   — لا يجيب (كجسرٍ مطفأ، أو محجوبٍ بـCORS)
 *   rh     — RHVoice متاح، XTTS بسببه
 *   legacy — جسرٌ قديمٌ لا يُبلغ عن محرّكاته
 */
function fakeBridge(mode = 'rh', { synthStatus = 200, hold = null } = {}) {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    requests.push({ path: u.pathname, engine: u.searchParams.get('engine'), body: init.body ? JSON.parse(init.body) : null });
    if (mode === 'down') throw new TypeError('Failed to fetch');
    if (u.pathname === '/health') {
      return mode === 'legacy'
        ? json({ status: 'ok' })
        : json({ status: 'ok', engines: {
          rhvoice: { available: true, reason: '' },
          xtts: { available: false, reason: 'مكتبة Coqui TTS غير مثبّتة — pip install TTS' },
        } });
    }
    if (u.pathname === '/voices') {
      const engine = u.searchParams.get('engine');
      if (engine === 'rhvoice') return json({ voices: RH_VOICES });
      if (engine === 'xtts') return json({ voices: [] });
      return json({ voices: [{ id: 'legacy-v', name: 'Legacy', language: 'ru' }] });
    }
    if (u.pathname === '/synthesize') {
      if (hold) {
        await new Promise((resolve, reject) => {
          hold.release = resolve;
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        });
      }
      if (synthStatus !== 200) return json({ error: 'x' }, synthStatus);
      return new Response(new Blob(['RIFF-wav'], { type: 'audio/wav' }), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    }
    return json({ error: 'not-found' }, 404);
  };
  return { requests, bridge: createLocalBridge({ baseUrl: 'http://bridge.test', fetchImpl }) };
}

describe('مزوّدو النطق · الجسرُ المحلّيّ وRHVoice وXTTS وCloud', () => {
  it('١ · RHVoice متاحٌ حين يقول الجسرُ إنّ محرّكَه موجود — وأصواتُه من /voices?engine=rhvoice وحدها', async () => {
    const { bridge, requests } = fakeBridge('rh');
    const rh = createRHVoiceProvider({ bridge });
    const a = await rh.isAvailable();
    expect(`${a.available} · ${a.status}`).toBe(`true · ${AVAILABILITY.AVAILABLE_VIA_LOCAL_BRIDGE}`);
    const voices = await rh.getVoices();
    expect(voices.map((v) => v.id)).toEqual(['anna', 'aleksandr']);
    expect(requests.filter((r) => r.path === '/voices').map((r) => r.engine)).toEqual(['rhvoice']);
  });

  it('٢ · والتوليدُ يطلب محرّكَ rhvoice بالصوت المختار — ويعود ملفًّا بمصدر RHVoice', async () => {
    const { bridge, requests } = fakeBridge('rh');
    const rh = createRHVoiceProvider({ bridge });
    const result = await rh.synthesize({ text: 'Привет', language: 'ru', voiceId: 'anna', speed: 0.8 });
    const sent = requests.find((r) => r.path === '/synthesize').body;
    expect(sent).toEqual({ engine: 'rhvoice', text: 'Привет', language: 'ru', voice: 'anna', speed: 0.8 });
    expect(`${result.error} · ${result.audioBlob?.size > 0} · ${result.provenance} · ${result.provider}`)
      .toBe(`null · true · ${PROVENANCE.RHVOICE_GENERATED} · rhvoice`);
  });

  it('٣ · جسرٌ لا يجيب: RHVoice وXTTS غيرُ متاحَين — وكلٌّ يقول ما يلزم لتشغيله، بلا أصوات', async () => {
    const { bridge } = fakeBridge('down');
    const rh = await createRHVoiceProvider({ bridge }).isAvailable();
    const xt = await createXTTSBridgeProvider({ bridge }).isAvailable();
    expect(`${rh.available} · ${rh.status}`).toBe(`false · ${AVAILABILITY.UNAVAILABLE_IN_WEB}`);
    expect(`${xt.available} · ${xt.status}`).toBe(`false · ${AVAILABILITY.REQUIRES_LOCAL_BRIDGE}`);
    for (const reason of [rh.reason, xt.reason]) {
      expect(`يذكر أمرَ الجسر: ${reason.includes('scripts/tts-bridge/server.py')}`).toBe('يذكر أمرَ الجسر: true');
    }
    expect(await createRHVoiceProvider({ bridge }).getVoices()).toEqual([]);
  });

  it('٤ · جسرٌ يعمل بلا XTTS: السببُ من الجسر نفسِه (لا «غير متّصل») — وRHVoice بجانبه متاح', async () => {
    const { bridge } = fakeBridge('rh');
    const xt = await createXTTSBridgeProvider({ bridge }).isAvailable();
    expect(`${xt.available} · ${xt.status}`).toBe(`false · ${AVAILABILITY.MODEL_NOT_DOWNLOADED}`);
    expect(xt.reason).toContain('Coqui TTS');
    expect((await createRHVoiceProvider({ bridge }).isAvailable()).available).toBe(true);
  });

  it('٥ · جسرٌ قديمٌ لا يُبلغ عن محرّكاته: XTTS كما كان — ولا يُدَّعى أنّه يحمل RHVoice', async () => {
    const { bridge, requests } = fakeBridge('legacy');
    const xt = createXTTSBridgeProvider({ bridge });
    expect((await xt.isAvailable()).status).toBe(AVAILABILITY.AVAILABLE_VIA_LOCAL_BRIDGE);
    expect((await xt.getVoices()).map((v) => v.id)).toEqual(['legacy-v']);
    expect(requests.filter((r) => r.path === '/voices').map((r) => r.engine)).toEqual([null]);
    const rh = await createRHVoiceProvider({ bridge }).isAvailable();
    expect(`${rh.available}`).toBe('false');
  });

  it('٦ · الصحّةُ تُسأل مرّةً في نافذتها — مزوّدان على جسرٍ واحد وجملٌ متتالية لا تُغرقه', async () => {
    const { bridge, requests } = fakeBridge('rh');
    const rh = createRHVoiceProvider({ bridge });
    const xt = createXTTSBridgeProvider({ bridge });
    for (let i = 0; i < 4; i += 1) { await rh.isAvailable(); await xt.isAvailable(); }
    expect(requests.filter((r) => r.path === '/health').length).toBe(1);
    /* ⚠️ وبعد توليدٍ تُسأل من جديد: جسرٌ سقط لا يبقى «متاحًا» من الذاكرة. */
    await rh.synthesize({ text: 'Да', voiceId: 'anna' });
    await rh.isAvailable();
    expect(requests.filter((r) => r.path === '/health').length).toBe(2);
  });

  it('٧ · أخطاءُ التوليد أسماءٌ لا استثناءات: رفضُ الجسر، وانقطاعُه', async () => {
    const refused = await createRHVoiceProvider({ bridge: fakeBridge('rh', { synthStatus: 503 }).bridge })
      .synthesize({ text: 'Да', voiceId: 'anna' });
    expect(`${refused.error} · ${refused.audioBlob}`).toBe('bridge-http-503 · null');
    const gone = await createXTTSBridgeProvider({ bridge: fakeBridge('down').bridge })
      .synthesize({ text: 'Да' });
    expect(`${gone.error} · ${gone.provenance}`).toBe(`bridge-unreachable · ${PROVENANCE.XTTS_GENERATED}`);
  });

  it('٨ · cancel() يُلغي التوليدَ الجاري فعلًا — لا يُعلمه فقط', async () => {
    const hold = {};
    const rh = createRHVoiceProvider({ bridge: fakeBridge('rh', { hold }).bridge });
    const pending = rh.synthesize({ text: 'Да', voiceId: 'anna' });
    const start = Date.now();
    while (!hold.release && Date.now() - start < 2000) await new Promise((r) => setTimeout(r, 5));
    rh.cancel();
    const result = await pending;
    expect(`${result.error} · ${result.audioBlob}`).toBe('aborted · null');
  });

  it('٩ · Cloud غيرُ متاح بسببٍ صادق: يحتاج خادمًا خلفيًّا يحمل المفتاح — لا أصواتَ ولا توليد', async () => {
    const cloud = createCloudAIProvider();
    const a = await cloud.isAvailable();
    expect(`${a.available}`).toBe('false');
    expect(a.reason).toContain('خادمًا خلفيًّا');
    expect(await cloud.getVoices()).toEqual([]);
    expect((await cloud.synthesize({ text: 'Да' })).error).toBe('not-configured');
  });
});

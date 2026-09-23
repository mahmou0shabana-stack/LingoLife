/**
 * LingoLife — عميلُ الجسر المحلّيّ للنطق (scripts/tts-bridge/server.py)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لماذا وحدةٌ مشتركة
 * ═══════════════════════════════════════════════════════════════
 *
 * الجسرُ خادمٌ واحدٌ يغلّف أكثر من محرّك (RHVoice · XTTS). وكان عميلُه
 * داخل `xtts-bridge-provider.js` وحده يسأل `/voices` كلَّها ويرسل بلا
 * «engine» — فكان يعرض أصواتَ كلّ محرّكٍ على أنّها XTTS، ولا يستطيع
 * RHVoice أن يمرّ منه. فالعميلُ هنا، وكلُّ مزوّدٍ يسأله عن محرّكه وحده.
 *
 * ⚠️ **والصحّةُ تُسأل مرّةً في النافذة القصيرة** (`HEALTH_TTL_MS`): مُكيِّفُ
 *    النطق يسأل `isAvailable()` قبل كلّ جملة، ومزوّدان على جسرٍ واحد —
 *    فبلا نافذةٍ تصير كلُّ جملةٍ طلبين إلى `/health`.
 *
 * ⚠️ **ولا يُخمَّن شيء**: جسرٌ قديمٌ لا يُبلغ عن محرّكاته (`engines`) يُعامَل
 *    كما كان يُعامَل — XTTS وحده — ولا يُفترَض أنّه يحمل RHVoice.
 */

const HEALTH_TIMEOUT_MS = 1200;
const HEALTH_TTL_MS = 3000;
const SYNTH_TIMEOUT_MS = 30000;

export const DEFAULT_BRIDGE_URL = 'http://localhost:8765';

async function withTimeout(fn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ baseUrl?: string, fetchImpl?: typeof fetch }} [options]
 *   `fetchImpl` محقونٌ للاختبار؛ وإلّا `fetch` المتصفّح.
 */
export function createLocalBridge({ baseUrl = DEFAULT_BRIDGE_URL, fetchImpl } = {}) {
  const doFetch = (...args) => (fetchImpl || fetch)(...args);
  let healthCache = null;

  /**
   * @returns {Promise<{ up: boolean, engines: Record<string, {available: boolean, reason: string}>|null }>}
   *   `engines: null` = جسرٌ قديمٌ لا يُبلغ عن محرّكاته.
   */
  async function health() {
    if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) return healthCache.value;
    let value = { up: false, engines: null };
    try {
      const response = await withTimeout((signal) => doFetch(`${baseUrl}/health`, { signal }), HEALTH_TIMEOUT_MS);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        value = { up: true, engines: data && typeof data.engines === 'object' ? data.engines : null };
      }
    } catch {
      /* لا جسر — أو حجبَه المتصفّح (CORS/PNA) وهو يعمل؛ الحالُ واحدةٌ للواجهة */
    }
    healthCache = { at: Date.now(), value };
    return value;
  }

  /** حالُ محرّكٍ بعينه كما يقولها الجسر — أو `legacy` لجسرٍ قديم. */
  async function engineState(engine) {
    const { up, engines } = await health();
    if (!up) return { up: false, available: false, reason: '' };
    if (!engines) return { up: true, available: engine === 'xtts', reason: '', legacy: true };
    const state = engines[engine];
    return { up: true, available: Boolean(state?.available), reason: state?.reason || '' };
  }

  async function voices(engine) {
    try {
      const { engines } = await health();
      const url = engines ? `${baseUrl}/voices?engine=${encodeURIComponent(engine)}` : `${baseUrl}/voices`;
      const response = await withTimeout((signal) => doFetch(url, { signal }), HEALTH_TIMEOUT_MS);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data?.voices) ? data.voices : [];
    } catch {
      return [];
    }
  }

  /**
   * @returns {Promise<{ blob: Blob|null, error: string|null }>}
   *   والخطأُ اسمٌ لا استثناء: bridge-http-<status> · bridge-unreachable · timeout · aborted
   */
  async function synthesize({ engine, text, language = 'ru', voiceId = null, speed = 1, signal } = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, SYNTH_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await doFetch(`${baseUrl}/synthesize`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine, text, language, voice: voiceId, speed }),
      });
      if (!response.ok) return { blob: null, error: `bridge-http-${response.status}` };
      return { blob: await response.blob(), error: null };
    } catch (err) {
      const reason = err?.name !== 'AbortError' ? 'bridge-unreachable' : timedOut ? 'timeout' : 'aborted';
      return { blob: null, error: reason };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      /* ⚠️ نطقٌ فشل لأنّ الجسرَ سقط يجب ألّا يرى «متاح» من ذاكرةٍ عمرُها ثوانٍ. */
      healthCache = null;
    }
  }

  return { baseUrl, health, engineState, voices, synthesize };
}

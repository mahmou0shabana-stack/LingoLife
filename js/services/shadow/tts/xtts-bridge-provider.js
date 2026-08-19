/**
 * LingoLife — XTTSBridgeProvider: عميل جسر التطوير المحلّي (WS41-G، بند 7-8)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «لا تُدمج XTTS كاملةً في المتصفّح كأوّل تنفيذ. ابنِ بدلًا من ذلك
 * >  جسرَ تطويرٍ محلّيًّا اختياريًّا: LingoLife (ويب) ← جسر localhost
 * >  ← Python/XTTS ← صوتٌ مولَّد ← LingoLife. أدوات تطويرٍ فقط —
 * >  المستخدم يشغّل خدمةً محليّةً صغيرة. نقاطٌ مقترحة: GET /health،
 * >  GET /voices، POST /synthesize بجسم مثل {text, language, voice,
 * >  speed}، وترجع الصوتَ وبياناتِه الوصفية. اجعل الجسر عامًّا بما
 * >  يكفي ليغلّف Piper/RHVoice أثناء التطوير أيضًا لو أفاد.»
 *
 * > «الجسرُ يرتبط بـlocalhost افتراضيًّا، لا يُعرَّض للخارج، ولا
 * >  تُضاف مفاتيح API إلى كود الواجهة الأمامية. عالِج بوضوح: الجسرُ
 * >  غيرُ متاح، تحميلُ المحرّك، فشلُ التوليد، المهلة، الإلغاء.»
 *
 * هذا الملفّ هو **العميل** فقط — يتحدّث مع أيّ خادمٍ يطابق العقد
 * أعلاه عبر `fetch` على `localhost`. الخادمُ المرجعيّ (هيكلٌ لا تنفيذ
 * XTTS فعليّ) في `scripts/tts-bridge/server.py` — أداة تطويرٍ منفصلة
 * لا تُشحَن مع الـPWA، تمامًا كـ`scripts/vendor-tesseract.sh`.
 *
 * ⚠️ **لا سرّ هنا.** لا مفتاح ولا رمز في هذا الملفّ ولا في أيّ طلبٍ
 *    يرسله — الجسرُ محلّيٌّ بلا مصادقة أصلًا (بند الأمان المتكرّر).
 */

import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';

export const XTTS_PROVIDER_ID = 'xtts-bridge';

/** المهلة قصيرة عمدًا: فحصُ جسرٍ محلّيّ يجب ألّا يعلّق الواجهة. */
const HEALTH_TIMEOUT_MS = 1200;
const SYNTH_TIMEOUT_MS = 20000;

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
 * @param {{ baseUrl?: string }} [options]
 *   `baseUrl` قابلٌ للتغيير لأن رقم المنفذ اختيار المطوّر — لا افتراض
 *   واحد يناسب الجميع؛ لكن الافتراض نفسه دائمًا `localhost` (بند 8).
 * @returns {import('./types.js').TTSProvider}
 */
export function createXTTSBridgeProvider({ baseUrl = 'http://localhost:8765' } = {}) {
  /** ضبطُ التوليد الجاري — `cancel()` تُلغيه فعليًّا، لا تُعلمه فقط. */
  let activeController = null;

  async function checkHealth() {
    try {
      const response = await withTimeout(
        (signal) => fetch(`${baseUrl}/health`, { signal }),
        HEALTH_TIMEOUT_MS
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  return {
    id: XTTS_PROVIDER_ID,
    name: 'XTTS — جسر تطويرٍ محلّي',
    type: PROVIDER_TYPE.XTTS_BRIDGE,
    supportsOffline: false,
    supportsStreaming: false,
    supportsWord: true,
    supportsSentence: true,
    supportsLongText: true,

    async isAvailable() {
      const healthy = await checkHealth();
      return healthy
        ? { available: true, status: AVAILABILITY.AVAILABLE_VIA_LOCAL_BRIDGE, reason: `الجسر متّصل — ${baseUrl}` }
        : {
            available: false,
            status: AVAILABILITY.REQUIRES_LOCAL_BRIDGE,
            reason: `الجسر المحلّي غير متّصل (${baseUrl}) — شغّل scripts/tts-bridge/server.py أولًا`,
          };
    },

    async getVoices() {
      try {
        const response = await withTimeout((signal) => fetch(`${baseUrl}/voices`, { signal }), HEALTH_TIMEOUT_MS);
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data?.voices) ? data.voices : [];
      } catch {
        return [];
      }
    },

    /** @param {import('./types.js').TTSRequest} request */
    async synthesize({ text, language = 'ru', voiceId = null, speed = 1 } = {}) {
      const controller = new AbortController();
      activeController = controller;
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, SYNTH_TIMEOUT_MS);
      try {
        const response = await fetch(`${baseUrl}/synthesize`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language, voice: voiceId, speed }),
        });
        if (!response.ok) {
          return {
            provider: XTTS_PROVIDER_ID, voiceId, provenance: PROVENANCE.XTTS_GENERATED,
            error: `bridge-http-${response.status}`,
          };
        }
        const audioBlob = await response.blob();
        const durationHeader = Number(response.headers.get('X-Audio-Duration'));
        return {
          audioBlob,
          audioUrl: null,
          playedDirectly: false,
          duration: Number.isFinite(durationHeader) ? durationHeader : null,
          provider: XTTS_PROVIDER_ID,
          voiceId,
          cacheKey: null,
          provenance: PROVENANCE.XTTS_GENERATED,
          cached: false,
          error: null,
        };
      } catch (err) {
        const reason = err?.name !== 'AbortError' ? 'bridge-unreachable' : timedOut ? 'timeout' : 'aborted';
        return { provider: XTTS_PROVIDER_ID, voiceId, provenance: PROVENANCE.XTTS_GENERATED, error: reason };
      } finally {
        clearTimeout(timer);
        if (activeController === controller) activeController = null;
      }
    },

    cancel() {
      activeController?.abort();
    },
  };
}

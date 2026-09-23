/**
 * LingoLife — XTTSBridgeProvider: XTTS عبر الجسر المحلّيّ
 *
 * الجسرُ خادمٌ محلّيّ (`scripts/tts-bridge/server.py`) يغلّف XTTS (Coqui)
 * وغيرَه؛ وهذا المزوّدُ يسأله عن محرّك **xtts** وحده — عبر
 * `local-bridge.js` المشترك مع RHVoice.
 *
 * ⚠️ **والحالُ ثلاثٌ لا اثنتان** — وكانت اثنتين فكذبت:
 *    · الجسرُ لا يجيب ← REQUIRES_LOCAL_BRIDGE («شغّل الجسر»)
 *    · الجسرُ يجيب ولا XTTS فيه ← MODEL_NOT_DOWNLOADED بسبب الجسر نفسِه
 *      («مكتبة Coqui TTS غير مثبّتة — pip install TTS …»)
 *    · متاح ← AVAILABLE_VIA_LOCAL_BRIDGE
 *    وكان كلُّ ما عدا الثالثة «الجسر غير متّصل» — حتّى والجسرُ يعمل ويحجبه
 *    المتصفّح لغياب رؤوس CORS فيه (أُصلحت في server.py).
 *
 * ⚠️ **لا سرّ هنا.** الجسرُ محلّيٌّ بلا مصادقة.
 */

import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';
import { createLocalBridge } from './local-bridge.js';

export const XTTS_PROVIDER_ID = 'xtts-bridge';
const ENGINE = 'xtts';

/**
 * @param {{ baseUrl?: string, bridge?: ReturnType<typeof createLocalBridge> }} [options]
 * @returns {import('./types.js').TTSProvider}
 */
export function createXTTSBridgeProvider({ baseUrl, bridge } = {}) {
  const client = bridge || createLocalBridge(baseUrl ? { baseUrl } : {});
  /** ضبطُ التوليد الجاري — `cancel()` تُلغيه فعليًّا، لا تُعلمه فقط. */
  let active = null;

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
      const state = await client.engineState(ENGINE);
      if (!state.up) {
        return {
          available: false,
          status: AVAILABILITY.REQUIRES_LOCAL_BRIDGE,
          reason: `الجسر المحلّي لا يجيب على ${client.baseUrl} — شغّل: python3 scripts/tts-bridge/server.py`,
        };
      }
      if (!state.available) {
        return {
          available: false,
          status: AVAILABILITY.MODEL_NOT_DOWNLOADED,
          reason: state.reason || 'الجسر يعمل لكن XTTS غير مهيّأ فيه',
        };
      }
      return {
        available: true,
        status: AVAILABILITY.AVAILABLE_VIA_LOCAL_BRIDGE,
        reason: `الجسر متّصل — ${client.baseUrl}`,
      };
    },

    async getVoices() {
      return client.voices(ENGINE);
    },

    /** @param {import('./types.js').TTSRequest} request */
    async synthesize({ text, language = 'ru', voiceId = null, speed = 1 } = {}) {
      const controller = new AbortController();
      active = controller;
      try {
        const { blob, error } = await client.synthesize({
          engine: ENGINE, text, language, voiceId, speed, signal: controller.signal,
        });
        return {
          audioBlob: blob,
          audioUrl: null,
          playedDirectly: false,
          duration: null,
          provider: XTTS_PROVIDER_ID,
          voiceId,
          cacheKey: null,
          provenance: PROVENANCE.XTTS_GENERATED,
          cached: false,
          error,
        };
      } finally {
        if (active === controller) active = null;
      }
    },

    cancel() {
      active?.abort();
    },
  };
}

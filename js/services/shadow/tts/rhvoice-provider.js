/**
 * LingoLife — RHVoiceProvider: RHVoice حقيقيٌّ عبر الجسر المحلّيّ
 *
 * ═══════════════════════════════════════════════════════════════
 * ما كان، وما صار
 * ═══════════════════════════════════════════════════════════════
 *
 * كان عقدًا بلا تشغيل: `isAvailable()` تقول «لا يعمل في الويب» دائمًا،
 * و`synthesize()` تُرجع خطأً دائمًا. وذلك صادقٌ عن **المتصفّح وحده**:
 * RHVoice محرّكٌ أصليّ (C++) بلا WASM رسميّ.
 *
 * لكنّ الجسرَ المحلّيّ (`scripts/tts-bridge/server.py`) صُمِّم ليغلّف
 * RHVoice أيضًا — ولم يكن موصولًا. فصار يشغّل أداتَه الرسميّة
 * `RHVoice-test` بالأصوات المثبَّتة على الجهاز، وهذا المزوّدُ يسأله عن
 * محرّك **rhvoice** (`local-bridge.js`). والترتيب:
 *
 *   ١ غلافُ أندرويد أصليّ (`isAndroidNative`) — محجوزٌ كما كان
 *   ٢ الجسرُ المحلّيّ وفيه RHVoice ← AVAILABLE_VIA_LOCAL_BRIDGE
 *   ٣ وإلّا غيرُ متاح — **وبالسبب الحقيقيّ**: الجسرُ لا يجيب، أو يجيب
 *     وRHVoice غيرُ مثبّتٍ عليه (السببُ من الجسر نفسِه).
 *
 * ⚠️ **ولا ادّعاء**: لا يُقال «متاح» إلّا والجسرُ قال إنّ المحرّكَ وأصواتَه
 *    موجودة. والتوليدُ ملفُّ WAV حقيقيّ يمرّ بالذاكرة المشتركة
 *    (`synthesizeWithCache`) ومُكيِّف النطق والناقل كأيّ مزوّدٍ مولِّد.
 */

import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';
import { createLocalBridge } from './local-bridge.js';

export const RHVOICE_PROVIDER_ID = 'rhvoice';
const ENGINE = 'rhvoice';

/**
 * @param {{ isAndroidNative?: () => boolean, bridge?: ReturnType<typeof createLocalBridge>, baseUrl?: string }} [env]
 * @returns {import('./types.js').TTSProvider}
 */
export function createRHVoiceProvider({ isAndroidNative = () => false, bridge, baseUrl } = {}) {
  const client = bridge || createLocalBridge(baseUrl ? { baseUrl } : {});
  let active = null;

  return {
    id: RHVOICE_PROVIDER_ID,
    name: 'RHVoice — دون اتصال',
    type: PROVIDER_TYPE.RHVOICE,
    supportsOffline: true,
    supportsStreaming: false,
    supportsWord: true,
    supportsSentence: true,
    supportsLongText: true,

    async isAvailable() {
      if (isAndroidNative()) {
        // محجوزٌ لغلاف أندرويد مستقبليّ — يستبدل synthesize كذلك.
        return {
          available: true,
          status: AVAILABILITY.AVAILABLE_NATIVE_ANDROID,
          reason: 'متاحٌ عبر تطبيق أندرويد الأصليّ',
        };
      }
      const state = await client.engineState(ENGINE);
      if (state.available) {
        return {
          available: true,
          status: AVAILABILITY.AVAILABLE_VIA_LOCAL_BRIDGE,
          reason: `RHVoice عبر الجسر المحلّي — ${client.baseUrl}`,
        };
      }
      return {
        available: false,
        status: AVAILABILITY.UNAVAILABLE_IN_WEB,
        reason: state.up
          ? (state.reason || 'الجسر المحلّي يعمل لكن RHVoice غير مهيّأ فيه')
          : `RHVoice محرّكٌ أصليّ لا يعمل داخل المتصفّح وحده — ثبّته وشغّل الجسر المحلّي (python3 scripts/tts-bridge/server.py) على ${client.baseUrl}`,
      };
    },

    async getVoices() {
      const state = await client.engineState(ENGINE);
      return state.available ? client.voices(ENGINE) : [];
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
          provider: RHVOICE_PROVIDER_ID,
          voiceId,
          cacheKey: null,
          provenance: PROVENANCE.RHVOICE_GENERATED,
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

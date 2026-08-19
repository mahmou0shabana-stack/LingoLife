/**
 * LingoLife — BrowserTTSProvider (بند 3، WS41)
 *
 * غلافٌ رفيع فوق `tts-controller.js` بلا تغيير سلوكه — نفس الدوال،
 * نفس `speak()`، نفس منطق اختيار الصوت. كل ما هنا هو تكييفُ شكل
 * الاستدعاء إلى عقد `TTSProvider` (`types.js`) حتى يقدر السجلّ
 * (`registry.js`) أن يعامله كأيّ مزوّدٍ آخر.
 *
 * ⚠️ **لا `audioBlob` ولا `cacheKey` هنا — عمدًا.** `speechSynthesis`
 *    ينطق مباشرةً؛ لا يُنتج بايتات صوتٍ يمكن تخزينها إلا بتسجيلٍ إضافي
 *    (`MediaRecorder` على مخرج الجهاز) لم يطلبه أحد وليس له داعٍ هنا:
 *    الصوتُ مجّانيّ التوليد أصلًا فلا فائدة من تخزينه. الذاكرة
 *    المشتركة (`audio-cache.js`) لمزوّدات تُنتج ملفًّا حقيقيًّا فقط.
 */

import {
  isSupported,
  listVoices,
  speak,
  cancel as cancelSpeech,
  DEFAULT_RATE,
} from '../tts-controller.js';
import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';

export const BROWSER_PROVIDER_ID = 'browser';

/** @returns {import('./types.js').TTSProvider} */
export function createBrowserTTSProvider() {
  return {
    id: BROWSER_PROVIDER_ID,
    name: 'المتصفّح (النطق الآلي)',
    type: PROVIDER_TYPE.BROWSER,
    supportsOffline: true,
    supportsStreaming: false,
    supportsWord: true,
    supportsSentence: true,
    supportsLongText: true,

    async isAvailable() {
      if (!isSupported()) {
        return {
          available: false,
          status: AVAILABILITY.NOT_AVAILABLE_ON_WEB,
          reason: 'المتصفّح لا يدعم speechSynthesis',
        };
      }
      const { russian } = await listVoices();
      return {
        available: true,
        status: AVAILABILITY.READY_OFFLINE,
        reason: russian.length
          ? `${russian.length} صوتًا روسيًّا مثبَّتًا على الجهاز`
          : 'لا صوت روسي مخصَّص مثبَّت — سيُستعمل الصوت الافتراضي',
      };
    },

    async getVoices() {
      const { russian } = await listVoices();
      return russian.map((v) => ({ id: v.name, name: v.name, language: v.lang }));
    },

    /**
     * @param {import('./types.js').TTSRequest} request
     * @returns {Promise<import('./types.js').TTSResult>}
     */
    async synthesize({ text, voiceId = null, speed = DEFAULT_RATE, volume = 1 } = {}) {
      const result = await speak(text, { rate: speed, voiceName: voiceId, volume });
      return {
        audioBlob: null,
        audioUrl: null,
        playedDirectly: true,
        duration: null,
        provider: BROWSER_PROVIDER_ID,
        voiceId,
        cacheKey: null,
        provenance: PROVENANCE.BROWSER_TTS,
        cached: false,
        error: result.ok ? null : result.reason || 'error',
      };
    },

    cancel() {
      cancelSpeech();
    },
  };
}

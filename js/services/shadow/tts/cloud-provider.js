/**
 * LingoLife — CloudAIProvider: عقدٌ معماريٌّ للمستقبل (WS41-G، بند 2-هـ، 23)
 *
 * لا مزوّد سحابيّ فعليّ في هذا البناء — ولا اتفاقيّة مع أيّ خدمة.
 * وجودُ هذا الملفّ وحده هو ما يُثبت أن التصميم يتّسع لمزوّدٍ سحابيّ
 * غدًا **بلا إعادة تصميم الذاكرة المشتركة ولا الشادوينج**: يكفي أن
 * يُستبدَل تنفيذُ `synthesize` هنا (رابطُ خدمةٍ حقيقيّ + مفتاحٌ **من
 * خادمٍ خلفيّ لا من الواجهة الأمامية أبدًا** — بند الأمان المتكرّر في
 * بلاغك) ويُسجَّل في `bootstrap.js`، وكلُّ ما بُني فوق `TTSProvider`
 * (السجلّ، الذاكرة، اللوحة، مختبر الأصوات) يعمل معه بلا لمس.
 *
 * ⚠️ **ولأن التوليد السحابيّ يُدفَع ثمنُه**، الذاكرةُ المشتركة هي ما
 *    يجعل «توليدٌ مدفوعٌ مرّةً، تشغيلٌ محليٌّ مرّاتٍ» الافتراضَ
 *    الطبيعيّ لا استثناءً — ولهذا وُضعت الذاكرةُ فوق كلّ المزوّدين لا
 *    داخل كلٍّ منهم (بند 23).
 */

import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';

export const CLOUD_PROVIDER_ID = 'cloud-ai';

/** @returns {import('./types.js').TTSProvider} */
export function createCloudAIProvider() {
  return {
    id: CLOUD_PROVIDER_ID,
    name: 'صوتٌ سحابيّ (مستقبليّ)',
    type: PROVIDER_TYPE.CLOUD_AI,
    supportsOffline: false,
    supportsStreaming: false,
    supportsWord: true,
    supportsSentence: true,
    supportsLongText: true,

    async isAvailable() {
      return {
        available: false,
        status: AVAILABILITY.REQUIRES_NETWORK,
        reason: 'لا مزوّد سحابيّ مُهيَّأ بعد — هذا عقدٌ معماريّ فقط، بلا خدمةٍ حقيقيّة خلفه',
      };
    },

    async getVoices() {
      return [];
    },

    async synthesize() {
      return {
        audioBlob: null,
        audioUrl: null,
        playedDirectly: false,
        duration: null,
        provider: CLOUD_PROVIDER_ID,
        voiceId: null,
        cacheKey: null,
        provenance: PROVENANCE.CLOUD_AI_GENERATED,
        cached: false,
        error: 'not-configured',
      };
    },

    cancel() {},
  };
}

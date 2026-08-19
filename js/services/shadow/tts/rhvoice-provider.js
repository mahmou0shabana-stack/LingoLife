/**
 * LingoLife — RHVoiceProvider: عقدٌ لا تشغيل (WS41-G، بند 6)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «RHVoice مهمٌّ للنطق الروسيّ دون اتصال ولدعم أندرويد. لا تتظاهر
 * >  بأن المحرّك الأصليّ/الأندرويديّ يعمل داخل متصفّحٍ عاديّ في مرحلة
 * >  الويب. نفّذ `RHVoiceProvider` كعقد مزوّدٍ بتوفّرٍ صادق. هيّئ
 * >  الواجهة حتى يستطيع غلافُ أندرويد مستقبلًا استدعاء RHVoice بلا
 * >  إعادة تصميم الشادوينج.»
 *
 * ⚠️ **لا توجد طريقةٌ حقيقيّة لتشغيل RHVoice (محرّكٌ أصليّ C++) داخل
 *    صفحة ويب عادية اليوم** — لا WASM رسميّ ولا حزمة npm. فهذا الملفّ
 *    عقدٌ معماريّ بحت: `isAvailable()` تُرجع دائمًا `false` في بناء
 *    الويب هذا، بصراحةٍ لا بافتراضٍ متفائل. اليوم الذي يُبنى فيه
 *    غلافُ أندرويد أصليّ (`WebView` + جسر JS↔Kotlin/Java يستدعي
 *    RHVoice)، يستبدل ذلك الغلافُ `isAvailable`/`synthesize` هنا
 *    بتنفيذٍ حقيقي — والسجلّ (`registry.js`) والشادوينج لا يتغيّران
 *    حرفًا واحدًا، لأنهما يريان العقد لا التنفيذ.
 */

import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';

export const RHVOICE_PROVIDER_ID = 'rhvoice';

/**
 * @param {{ isAndroidNative?: () => boolean }} [env]
 *   حَقنٌ للاختبار وللغلاف المستقبليّ: يمرّر دالّةً تقول إن كنّا داخل
 *   غلافٍ أصليّ فعلًا. غيابها يعني «متصفّحٌ عاديّ» — الحالة الوحيدة
 *   الممكنة اليوم.
 * @returns {import('./types.js').TTSProvider}
 */
export function createRHVoiceProvider({ isAndroidNative = () => false } = {}) {
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
        // لا يتحقّق هذا أبدًا في بناء الويب — محجوزٌ لغلاف أندرويد مستقبليّ.
        return {
          available: true,
          status: AVAILABILITY.AVAILABLE_NATIVE_ANDROID,
          reason: 'متاحٌ عبر تطبيق أندرويد الأصليّ',
        };
      }
      return {
        available: false,
        status: AVAILABILITY.UNAVAILABLE_IN_WEB,
        reason: 'RHVoice محرّكٌ أصليّ — لا يعمل داخل متصفّح ويب. متاحٌ في نسخة أندرويد فقط',
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
        provider: RHVOICE_PROVIDER_ID,
        voiceId: null,
        cacheKey: null,
        provenance: PROVENANCE.RHVOICE_GENERATED,
        cached: false,
        error: 'unavailable-in-web',
      };
    },

    cancel() {},
  };
}

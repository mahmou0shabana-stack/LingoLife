/**
 * LingoLife — تسجيل مزوّدي النطق عند الإقلاع (WS41)
 *
 * مكانٌ واحدٌ يُسجَّل فيه كل مزوّدٍ متاحٍ في هذا البناء. الشاشة
 * تستدعي `ensureTTSProvidersRegistered()` قبل أن تبني `speaker` —
 * استدعاءٌ متكرّرٌ آمن (يُسجَّل مرّةً واحدة فقط).
 *
 * ⚠️ **ترتيب التسجيل هنا ليس ترتيب التفضيل.** التفضيل يُقرَأ من
 *    إعدادات الجلسة (`shadow.ttsProvider`) وقت البناء، لا من هذا الملفّ.
 */

import { registerProvider } from './registry.js';
import { createBrowserTTSProvider, BROWSER_PROVIDER_ID } from './browser-provider.js';
import { createRHVoiceProvider } from './rhvoice-provider.js';
import { createXTTSBridgeProvider } from './xtts-bridge-provider.js';
import { createCloudAIProvider } from './cloud-provider.js';

let initialized = false;

export function ensureTTSProvidersRegistered() {
  if (initialized) return;
  initialized = true;
  registerProvider(createBrowserTTSProvider());
  /*
   * ⚠️ **مسجَّلون، لا يعني «يعملان في الويب».** `isAvailable()` كلٌّ
   *    منهما يقول الحقيقة بنفسه: RHVoice يقول UNAVAILABLE_IN_WEB
   *    دائمًا هنا، والسحابيّ يقول REQUIRES_NETWORK ولا خدمة خلفه —
   *    فتسجيلهما لا يعني «صار زرّ التشغيل حيًّا»، بل يعني أن اللوحة
   *    (WS41-E) تقدر تعرض حالتهما الصادقة بدل أن تتجاهلهما تمامًا.
   *    وجسرُ XTTS يفحص نفسه فعليًّا عند كل `isAvailable()` — إن كان
   *    الجسرُ المحلّيّ شغّالًا صار متاحًا حقًّا، لا افتراضًا (بند 6، 8).
   */
  registerProvider(createRHVoiceProvider());
  registerProvider(createXTTSBridgeProvider());
  registerProvider(createCloudAIProvider());
  /*
   * Piper Web/WASM يُسجَّل هنا حين يثبت إثباتُ المفهوم استقراره —
   * راجع WS41-F. غيابه الآن لا يكسر شيئًا: `registry.js` يسقط إلى
   * المتصفّح متى لم يتوفّر مزوّدٌ مفضَّل.
   */
}

export { BROWSER_PROVIDER_ID };

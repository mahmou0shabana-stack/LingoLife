/**
 * LingoLife — عقد مزوّدي النطق (WS41)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «أريد بنية مزوّدين عامّة، حتى يستدعي محرّك الشادوينج هذه الواجهة
 * >  بدل الاعتماد المباشر على `speechSynthesis` في المتصفّح.»
 *
 * هذا الملفّ هو العقد وحده — لا تنفيذ فيه. كل مزوّد (`browser-provider.js`،
 * `piper-provider.js`، …) يبني كائنًا بنفس الشكل، والمحرّك لا يعرف أيّهم
 * يشغّله فعليًّا.
 *
 * ⚠️ **لا حقول زائدة.** كل حقلٍ هنا يُستهلَك فعليًّا في مكانٍ ما من
 *    الكود — لا شيء أُضيف «تحسبًا لصورةٍ مستقبلية».
 */

/**
 * نوع المزوّد — يحدّد أي فئة من المنطق يُطبَّق عليه في الواجهة
 * (مثلًا: مزوّد الجسر المحلّي يحتاج نصّ حالة اتصال، لا غيره).
 */
export const PROVIDER_TYPE = Object.freeze({
  BROWSER: 'browser',
  PIPER: 'piper',
  RHVOICE: 'rhvoice',
  XTTS_BRIDGE: 'xtts_bridge',
  CLOUD_AI: 'cloud_ai',
});

/**
 * حالة توفّر المزوّد — الحالات الممكنة **كلّها**، صادقةً، لا صورة
 * ثنائية «شغّال / مش شغّال» تخفي التفاصيل (بند 9، 17).
 *
 * ⚠️ **لماذا AVAILABLE_NATIVE_ANDROID موجودة هنا رغم أن هذا البناء
 *    ويب فقط؟** لأن العقد يجب أن يتّسع لغلاف أندرويد مستقبلًا بلا
 *    إعادة تصميم (بند 6) — لا مزوّد في هذا البناء يُرجعها فعليًّا،
 *    لكن غيابها من التعداد كان سيكسر ذلك الغلاف حين يُكتب.
 */
export const AVAILABILITY = Object.freeze({
  /** جاهزٌ الآن بلا شبكة — صوتٌ محمَّل أو نموذجٌ منزَّل. */
  READY_OFFLINE: 'ready_offline',
  /** يعمل، لكن يحتاج اتصالًا بالإنترنت (مزوّد سحابي). */
  REQUIRES_NETWORK: 'requires_network',
  /** يحتاج جسر التطوير المحلّي شغّالًا على `localhost`. */
  REQUIRES_LOCAL_BRIDGE: 'requires_local_bridge',
  /** الجسرُ المحلّي متّصلٌ فعلًا الآن — عكسُ REQUIRES_LOCAL_BRIDGE. */
  AVAILABLE_VIA_LOCAL_BRIDGE: 'available_via_local_bridge',
  /** لا يمكن تشغيله داخل متصفّح إطلاقًا (محرّكٌ أصليٌّ فقط). */
  NOT_AVAILABLE_ON_WEB: 'not_available_on_web',
  /** المحرّك متاح لكن نموذج الصوت لم يُنزَّل بعد. */
  MODEL_NOT_DOWNLOADED: 'model_not_downloaded',
  /** غير متاح في بيئة الويب تحديدًا (مرادفٌ صريح لِـRHVoice، بند 6). */
  UNAVAILABLE_IN_WEB: 'unavailable_in_web',
  /** متاحٌ عبر غلاف أندرويد أصلي — لا يقع هذا في بناء الويب الحالي. */
  AVAILABLE_NATIVE_ANDROID: 'available_native_android',
});

/**
 * منشأ الصوت المُشغَّل فعليًّا — يظهر في الواجهة دائمًا (بند 16).
 * ⚠️ صوتٌ مولَّد لا يُعرَض أبدًا باسم «نطق بشري».
 */
export const PROVENANCE = Object.freeze({
  BROWSER_TTS: 'browser_tts',
  NATIVE_HUMAN_RECORDING: 'native_human_recording',
  PIPER_GENERATED: 'piper_generated',
  RHVOICE_GENERATED: 'rhvoice_generated',
  XTTS_GENERATED: 'xtts_generated',
  CLOUD_AI_GENERATED: 'cloud_ai_generated',
  USER_RECORDING: 'user_recording',
});

/**
 * @typedef {object} TTSRequest
 * @property {string} text
 * @property {string} [language] — افتراضيًا 'ru'، كل التطبيق روسيّ.
 * @property {string|null} [voiceId]
 * @property {number} [speed] — 0.5–2 تقريبًا، يوافق `rate` في المحرّك.
 * @property {number} [pitch]
 * @property {number} [volume] — 0–1. لمزوّدٍ يُشغِّل مباشرةً (المتصفّح)
 *   وحده هذا الحقل مؤثّرٌ في التوليد نفسه؛ المزوّدات التي تُنتج ملفًّا
 *   تُطبّق مستوى الصوت عند التشغيل لا عند التوليد — فهو لا يدخل مفتاح
 *   الذاكرة (`audio-cache.js`): نفس الصوت بمستوياتٍ مختلفة ملفٌ واحد.
 * @property {object} [providerOptions] — إعداداتٌ خاصّة بمزوّدٍ بعينه.
 */

/**
 * @typedef {object} TTSResult
 * @property {Blob|null} [audioBlob] — غائبٌ إن نطق المزوّد مباشرةً (المتصفّح).
 * @property {string|null} [audioUrl] — رابطٌ قابلٌ للتشغيل إن وُجد blob.
 * @property {boolean} [playedDirectly] — صحّ إن كان المزوّد نطق بنفسه.
 * @property {number|null} [duration] — بالثواني، إن عُرف.
 * @property {string} provider — معرّف المزوّد الذي أنتج هذا.
 * @property {string|null} voiceId
 * @property {string|null} [cacheKey] — غائبٌ لما لا يمكن تخزينه (المتصفّح).
 * @property {string} provenance — أحد قيم PROVENANCE.
 * @property {boolean} [cached] — أتى من الذاكرة لا توليدًا جديدًا؟
 * @property {string|null} [error] — سببٌ عند الفشل، أو `null` عند النجاح.
 *   محرّك التشغيل (`playback-controller.js`) ينتظر `{ok, reason}` — هذا
 *   الحقل هو ما يُشتقّ منه ذلك الشكل عند الحقن (`speaker`)، بلا تكرار
 *   معنى «نجح/فشل» في شكلين مختلفين داخل نفس الطبقة.
 */

/**
 * الشكل الذي يجب أن يبنيه كل مزوّد. هذا توثيقٌ لا تحقّقٌ إلزاميّ —
 * المشروع بلا TypeScript، فالعقد يُفرَض بالمراجعة لا بالمُصرِّف.
 *
 * @typedef {object} TTSProvider
 * @property {string} id — معرّفٌ فريد، إنجليزي، مستقرّ (يُخزَّن في الإعدادات).
 * @property {string} name — اسمٌ للعرض.
 * @property {string} type — أحد PROVIDER_TYPE.
 * @property {() => Promise<{available: boolean, status: string, reason: string}>} isAvailable
 * @property {() => Promise<{id: string, name: string, language: string}[]>} getVoices
 * @property {(request: TTSRequest) => Promise<TTSResult>} synthesize
 * @property {() => void} cancel
 * @property {boolean} supportsOffline
 * @property {boolean} supportsStreaming
 * @property {boolean} supportsWord
 * @property {boolean} supportsSentence
 * @property {boolean} supportsLongText
 */

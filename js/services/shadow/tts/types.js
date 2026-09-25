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
  /** Supertonic 3 INT8 داخل المتصفّح (ONNX Runtime Web في عامل) — نموذجٌ يُنزَّل عند الطلب. */
  SUPERTONIC: 'supertonic',
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
  /** النموذجُ يُنزَّل الآن — غيرُ متاحٍ حتى يكتمل ويُتحقَّق منه (Supertonic 1C). */
  MODEL_DOWNLOADING: 'model_downloading',
  /**
   * النموذجُ منزَّلٌ لكنّ محرّكَه فشل (تحميلٌ أو عاملٌ مات) — غيرُ متاحٍ حتى
   * «أعد المحاولة»، لا سقوطٌ صامتٌ يوحي بأنّه يعمل (Supertonic 1C).
   */
  ENGINE_FAILED: 'engine_failed',
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
  SUPERTONIC_GENERATED: 'supertonic_generated',
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
 * @property {string|null} [modelId] — اسمُ النموذج المولِّد، إن كان
 *   للمزوّد نموذجٌ **يعرفه قبل التوليد**. يدخل مفتاحَ ذاكرة الصوت
 *   (`audio-cache.js`) فلا يتقاسم نموذجان ملفًّا واحدًا.
 *
 *   ⚠️ **اختياريٌّ لأنه غيرُ معروفٍ لكلّ مزوّد — لا تحسّبًا لصورةٍ
 *      مستقبليّة** (راجع «لا حقول زائدة» أعلاه). ولا مزوّدٍ في هذا
 *      البناء يعلنه اليوم: المتصفّحُ لا يمرّ بالذاكرة أصلًا، وPiper
 *      يشتقّ مسارَ نموذجه من `voiceId` وهو في المفتاح، وجسرُ XTTS
 *      عقدُه لا يحمل حقلَ نموذج. **فلا يُختلَق اسمٌ لملء الحقل**:
 *      غيابُه حدٌّ مُبلَّغ، واختلاقُه كذبةٌ تدخل المفتاح.
 * @property {string|null} [modelVersion] — إصدارُ ذلك النموذج، إن كان
 *   له مصدرٌ موثوقٌ في إعداد المزوّد أو زمنِ تشغيله. يفصل بين إصدارين
 *   غيرِ متوافقين فلا يُعاد صوتُ الأوّل تحت الثاني.
 *
 *   ⚠️ **ولا يُكتَب إلّا عن مصدرٍ حقيقيّ.** «إصدارٌ مُقدَّر» أسوأُ من
 *      لا إصدار: يمنح ثقةً في فصلٍ لم يقع.
 * @property {string} [settingsKey] — إعدادُ التوليد الثابت، **إن أعلنه المزوّد**،
 *   يدخل مفتاحَ الذاكرة بدل `speed=…`.
 *
 *   ⚠️ **لمزوّدٍ يتجاهل `speed` في التوليد عمدًا** لأنّ السرعةَ تُطبَّق عند
 *      التشغيل (`playbackRate` في `speaker-adapter.js`) — كما هي فعلًا لكلّ
 *      مزوّدٍ مولِّد. بلاه يصير كلُّ موضعٍ للمنزلق مفتاحًا جديدًا لصوتٍ
 *      متطابقٍ بالبايت، ومع Supertonic (أبطأ من الزمن الحقيقيّ) كلُّ مفتاحٍ
 *      جديد ثوانٍ من الاستدلال بلا داعٍ. ولا مزوّدَ غيرُه يعلنه: مفاتيحُهم كما كانت.
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

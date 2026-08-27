/**
 * LingoLife — عقدُ النقل السحابيّ (WS-H · بنود ٢٦ و٢٧ و٤٧)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الناقلُ يحمل ولا يقرّر**
 * ═══════════════════════════════════════════════════════════════
 *
 * WS-G بنى محرّكَ الدمج، وهذا الملفّ يصف **ما يلزم لنقل ناتجه** ولا
 * شيءَ غيره. ولا سطرَ هنا — ولا في أيّ مُنفِّذٍ لهذا العقد — يعرف
 * `changeLog` ولا متّجهَ إصداراتٍ ولا تعارضًا ولا خطّةَ دمج.
 *
 * والسببُ عمليّ: الناقلُ يتبدّل. Google Drive اليوم، وربّما ملفٌّ على
 * ذاكرةٍ محمولة غدًا، أو WebDAV. ولو تسرّب منطقُ الدمج إلى الناقل لصار
 * **لكلّ طريقٍ دمجُه** — فتختلف النتيجةُ باختلاف الطريق، وهو أسوأُ ما
 * يمكن أن يحدث لنظام مزامنة.
 *
 * ⚠️ **ولا تنادي شاشةٌ هذا العقدَ مباشرة** (بند ٢٧). الترتيبُ:
 *
 *     شاشة → منسّق المزامنة → هذا العقد → مُنفِّذٌ بعينه
 *
 *     ويحرسه اختبارٌ يمسح `js/views/` بحثًا عن استيرادٍ لأيّ ناقل.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ثلاثةُ نطاقاتٍ لا تختلط** (بند Q من المواصفة)
 * ═══════════════════════════════════════════════════════════════
 *
 *   المزامنة  حزمٌ صغيرةٌ **غيرُ قابلةٍ للتعديل** + حالةُ كلّ جهاز
 *   الوسائط   بايتاتٌ كبيرةٌ تُكتَب مرّةً وتُقرأ كثيرًا
 *   النسخ     أرشيفاتٌ مؤرَّخةٌ لها سياسةُ استبقاءٍ خاصّة
 *
 * لكلٍّ دورةُ حياةٍ مختلفة، فلكلٍّ دوالُّه هنا — ولا تُخلَط.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **قاعدةُ الكاتب الواحد — وهي التي تُغني عن الأقفال**
 * ═══════════════════════════════════════════════════════════════
 *
 * لكلّ ملفٍّ بعيدٍ **جهازٌ واحدٌ يحقّ له أن يكتبه**:
 *
 *   حزمةٌ         تُكتَب مرّةً ولا تُعدَّل أبدًا، واسمُها (جهاز، ترتيب)
 *   حالةُ جهازٍ   يكتبها صاحبُها وحدَه
 *   بايتاتُ وسيط  تُكتَب مرّةً لكلّ (وسيط، دور)
 *   نسخةٌ         اسمُها فيه لحظتُها، فلا تُستبدَل
 *
 * ولذلك **يستحيل بنيويًّا** أن يمحوَ جهازان كتابةَ بعضهما — لا لأننا
 * تجنّبنا ذلك، بل لأن الملفَّ المشترَك القابلَ للتعديل غيرُ موجود.
 */

/**
 * فئاتُ الخطأ (بند ٤٧).
 *
 * ⚠️ **ولا يُحوَّل كلُّ فشلٍ إلى «حدث خطأ».** الفئةُ تقرّر: هل نعيد
 *    المحاولة؟ هل نطلب إذنًا جديدًا؟ هل نصمت لأننا بلا شبكة؟ وواجهةٌ
 *    تقول «خطأ» وحدَها تترك المستخدمَ بلا فعلٍ يفعله.
 */
export const FAIL = Object.freeze({
  /** انتهى الإذن أو سُحب — التطبيقُ يعمل، والمزامنةُ وحدَها تنتظر. */
  AUTH: 'AUTH',
  /** لا شبكة. ليس خطأً — حالةٌ نمرّ بها كلّ يوم. */
  OFFLINE: 'OFFLINE',
  /** الخادمُ يطلب التمهّل. يُعاد بتراجعٍ أُسّيّ. */
  RATE_LIMIT: 'RATE_LIMIT',
  /** ملفٌّ بعيدٌ تالفٌ أو بصيغةٍ غير مفهومة — يُعزَل ولا يُطبَّق. */
  REMOTE_CORRUPT: 'REMOTE_CORRUPT',
  /** القاعدةُ المدموجة لم تجتز الفحص — الدمجُ أُلغي والقاعدةُ سليمة. */
  LOCAL_VALIDATION: 'LOCAL_VALIDATION',
  /** تعارضٌ يحتاج قرارَك — ليس عطبًا. */
  CONFLICT: 'CONFLICT',
  /** مساحةُ Drive امتلأت. */
  QUOTA: 'QUOTA',
  /** الإذنُ لا يكفي لهذا الملفّ. */
  PERMISSION: 'PERMISSION',
  /** عطبٌ مؤقّتٌ عند الخادم (5xx) — يُعاد. */
  TRANSIENT_SERVER: 'TRANSIENT_SERVER',
  UNKNOWN: 'UNKNOWN',
});

/** أيُّ الفئات تستحقّ إعادةَ محاولةٍ تلقائيّة. */
export const RETRYABLE = Object.freeze([
  FAIL.OFFLINE, FAIL.RATE_LIMIT, FAIL.TRANSIENT_SERVER,
]);

/** نصٌّ عربيٌّ للمستخدم العاديّ — بلا مصطلحات (بند ٣٤). */
export const FAIL_TEXT = Object.freeze({
  [FAIL.AUTH]: 'انتهى اتصال Google Drive',
  [FAIL.OFFLINE]: 'مفيش إنترنت دلوقتي',
  [FAIL.RATE_LIMIT]: 'Google طلب نتمهّل شوية',
  [FAIL.REMOTE_CORRUPT]: 'فيه ملف على Drive مش سليم — اتعزل',
  [FAIL.LOCAL_VALIDATION]: 'الدمج اتلغى عشان النتيجة مكانتش سليمة — بياناتك زي ما هي',
  [FAIL.CONFLICT]: 'فيه تعارض محتاج قرارك',
  [FAIL.QUOTA]: 'مساحة Google Drive خلصت',
  [FAIL.PERMISSION]: 'مفيش صلاحية للملف ده',
  [FAIL.TRANSIENT_SERVER]: 'Google مش مستجيب دلوقتي',
  [FAIL.UNKNOWN]: 'حصل خطأ مش متوقّع',
});

/**
 * خطأُ نقلٍ مصنَّف.
 *
 * ⚠️ **والفئةُ تُحمَل ولا تُستنتَج من نصّ الرسالة.** استنتاجُها بمطابقة
 *    نصوصٍ يكسر أوّلَ ما يترجم Google رسالةً أو يغيّر صياغة.
 */
export class TransportError extends Error {
  constructor(category, message, { status = null, cause = null, detail = null } = {}) {
    super(message || FAIL_TEXT[category] || FAIL_TEXT[FAIL.UNKNOWN]);
    this.name = 'TransportError';
    this.category = FAIL[category] ? category : FAIL.UNKNOWN;
    this.status = status;
    this.detail = detail;
    if (cause) this.cause = cause;
  }

  get retryable() {
    return RETRYABLE.includes(this.category);
  }
}

/** يصنّف أيَّ خطأ — فما لا نعرفه يبقى `UNKNOWN` صراحةً لا ضمنًا. */
export function classify(error) {
  if (error instanceof TransportError) return error.category;
  if (error?.name === 'AbortError') return FAIL.OFFLINE;
  return FAIL.UNKNOWN;
}

/* ------------------------------------------------------------------ *
 * العقد
 * ------------------------------------------------------------------ */

/**
 * الدوالُّ التي يجب أن يوفّرها أيُّ ناقل.
 *
 * ⚠️ **وهذه القائمةُ يحرسها اختبار**: ناقلٌ ينقص إحداها لا يُقبَل، وهو
 *    ما يمنع «محاكٍ يمرّ والحقيقيُّ يسقط».
 */
export const TRANSPORT_CONTRACT = Object.freeze([
  /* الاتصالُ والهُويّة */
  'connect', 'disconnect', 'isConnected', 'identity',
  /* الكونُ السحابيّ */
  'discover', 'createUniverse',
  /* المزامنة */
  'pushPackage', 'listPackages', 'pullPackage',
  'pushDeviceState', 'listDeviceStates',
  /* الوسائط */
  'putBlob', 'fetchBlob', 'hasBlob', 'listBlobs',
  /* النسخ */
  'putBackup', 'listBackups', 'fetchBackup',
  /* القياس */
  'stats',
]);

/** يتحقّق أن كائنًا يفي بالعقد — يُنادى عند تركيب أيّ ناقل. */
export function assertTransport(transport) {
  const missing = TRANSPORT_CONTRACT.filter((name) => typeof transport?.[name] !== 'function');
  if (missing.length) {
    throw new Error(`ناقلٌ ناقص: ${missing.join('، ')}`);
  }
  return transport;
}

/**
 * أدوارُ بايتات الوسيط — نفسُ تسمية النسخة الاحتياطية بحرفها.
 *
 * ⚠️ ولا تُخترَع تسميةٌ ثانية: `backup-format.js` يستعمل `original` و
 *    `thumbnail` منذ v1، والحزمةُ في WS-G تستعملهما، فليست هذه لحظةَ
 *    مفرداتٍ جديدة.
 */
export const BLOB_ROLE = Object.freeze({ ORIGINAL: 'original', THUMBNAIL: 'thumbnail' });

/** أنواعُ النسخ الاحتياطيّة. */
export const BACKUP_KIND = Object.freeze({
  /** سجلّاتٌ وبايتات — قائمةٌ بذاتها، تُسترجَع بلا Drive. */
  FULL: 'full',
  /** سجلّاتٌ وبيانُ وسائطَ بلا بايتات — البايتاتُ من مخزن الوسائط. */
  LIGHT: 'light',
});

/**
 * بادئةُ معرِّف الكون السحابيّ.
 *
 * ⚠️ **ولا يُستعمَل بريدُ Google هُويّةً للكون** (بند ٢٢): الحسابُ يتبدّل،
 *    ويُشارَك، ويُعاد استعماله. والكونُ شيءٌ آخر تمامًا: **مجموعةُ
 *    الأجهزة التي تشترك في تاريخٍ واحد**. فلو بدّلتَ الحساب ووجدنا
 *    كونًا آخر، السؤالُ يُطرَح عليك ولا يُدمَج شيءٌ بصمت.
 */
export const UNIVERSE_PREFIX = 'SYNC';

/**
 * اسمُ ملفِّ حزمةٍ — حتميٌّ من (المؤلِّف، الترتيب).
 *
 * ⚠️ **والترتيبُ مبطَّنٌ بأصفار** لأن الترتيب النصّيّ هو ما تعطيه معظمُ
 *    واجهات التخزين مجّانًا، و`pkg-D-9` بعد `pkg-D-10` بلا تبطين.
 */
export function packageFileName(deviceId, seq) {
  return `pkg-${deviceId}-${String(seq).padStart(9, '0')}.json`;
}

/** اسمُ ملفِّ حالةِ جهاز — كاتبُه واحدٌ: الجهازُ نفسُه. */
export function deviceStateFileName(deviceId) {
  return `dev-${deviceId}.json`;
}

/** اسمُ ملفِّ بايتاتِ وسيط. */
export function blobFileName(mediaId, role, mime = '') {
  const ext = role === BLOB_ROLE.THUMBNAIL ? 'webp' : extensionOf(mime);
  return `${mediaId}.${role === BLOB_ROLE.THUMBNAIL ? 'thumb' : 'orig'}.${ext}`;
}

function extensionOf(mime) {
  const known = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'audio/webm': 'weba', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a', 'audio/wav': 'wav', 'application/pdf': 'pdf',
  };
  if (known[mime]) return known[mime];
  const sub = String(mime || '').split('/')[1] || 'bin';
  return sub.split(';')[0].replace(/[^a-z0-9]/gi, '') || 'bin';
}

/**
 * اسمُ نسخةٍ احتياطيّةٍ مؤرَّخ (بند L من المواصفة).
 *
 * ⚠️ **ولا تُستبدَل نسخةٌ باسمٍ ثابتٍ أبدًا.** «آخر نسخة» تكفي حتى يوم
 *    يتسرّب خطأٌ ويُزامَن إلى كلّ أجهزتك — وساعتها تحتاج **نسخةَ الأسبوع
 *    الماضي**، وتكون قد كُتبت فوقها ست مرّات.
 */
export function backupFileName(kind, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}-${pad(date.getMinutes())}`;
  const label = kind === BACKUP_KIND.FULL ? 'كاملة' : 'خفيفة';
  return `LingoLife ${stamp} (${label}).llife`;
}

/**
 * بصمةُ محتوًى — الأساسُ الوحيدُ لقول «الملفُّ وصل سليمًا».
 *
 * ⚠️ **ولا تُحسَب على كلّ الوسائط دفعةً واحدة.** أربعةُ جيجابايتٍ في
 *    الإقلاع تُجمّد التابلت. تُحسَب **مرّةً عند الرفع** — والبايتاتُ
 *    مقروءةٌ ساعتها أصلًا فالكلفةُ صفر — وتُخزَّن في `media.contentHash`
 *    فتُزامَن إلى بقيّة الأجهزة جاهزة.
 */
export async function sha256Hex(blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

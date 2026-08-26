/**
 * LingoLife — تعريف صيغة النسخة الاحتياطية `.llife`
 *
 * ⚠️ هذا الملف يصف **صيغة الملف**، لا شكل قاعدة البيانات.
 *
 * الفصل بين الاثنين هو القرار الذي يجعل نسخة عمرها سنتان قابلة للاسترجاع:
 *
 *   قاعدة البيانات            صيغة النسخة الاحتياطية
 *   ─────────────            ──────────────────────
 *   مُحسَّنة للاستعلام          مُحسَّنة للبقاء
 *   فهارس، dirty، مشتقات      بيانات نظيفة فقط
 *   تتغيّر كل مرحلة            تتغيّر نادرًا وبترقية معلنة
 *
 * لو صدّرنا شكل IndexedDB كما هو، لكان أول تغيير في اسم حقل يُبطل كل
 * النسخ السابقة. لذلك هناك طبقتا ترجمة: `serialize.js` و`deserialize.js`.
 *
 * راجع docs/07-backup-format.md
 */

/**
 * إصدار صيغة النسخة الاحتياطية.
 *
 * ⚠️ مستقلّ تمامًا عن `TARGET_VERSION` (إصدار IndexedDB). القاعدة قد
 *    تترقّى عشر مرات دون أن يتغيّر هذا الرقم — وهذا هو المقصود.
 *    لا تزده إلا عند تغيير يكسر قراءة الملفات القديمة، ومعه ترقية
 *    جديدة في `backup-migrations.js`.
 */
export const BACKUP_FORMAT_VERSION = 1;

/** الامتداد والتوقيع. */
export const BACKUP_EXTENSION = '.llife';
export const BACKUP_MAGIC = 'lingolife-backup';

/** أسماء المسارات داخل الأرشيف. */
export const PATHS = {
  MANIFEST: 'manifest.json',
  DATA_DIR: 'data/',
  BLOBS_DIR: 'blobs/',
  README: 'README.txt',
};

/**
 * الـ stores التي لا تدخل النسخة الاحتياطية، ولماذا.
 *
 * استثناؤها ليس نقصًا في النسخة — بل صحّة. كلها بيانات مشتقّة أو
 * مرتبطة بجهاز بعينه، وإعادة بنائها بعد الاسترجاع أصحّ من نقلها.
 */
export const EXCLUDED_STORES = Object.freeze({
  searchIndex: 'فهرس بحث مشتقّ — يُعاد بناؤه من المحتوى بعد الاسترجاع',
  syncQueue: 'طابور رفع مؤقّت خاصّ بجهاز واحد — لا معنى له بعد النقل',
  nativeAudio: 'تسجيلات نطق مجلوبة من الخارج — تُجلَب ثانيةً عند الحاجة، وليست بياناتك',
  generatedAudio: 'صوتٌ مولَّد آليًّا بمزوّدات النطق — يُعاد توليده محليًّا عند الحاجة، وليس بياناتك',
  /*
   * ⚠️ **وسجلُّ المزامنة لا يُنسَخ ولا يُسترجَع** (WS-G، بند ٤٧).
   *
   *    النسخةُ الاحتياطية تُنقَل بين الأجهزة، وترتيبُ التغييرات عند
   *    جهازٍ لا يعني شيئًا عند غيره: استرجاعُه على الموبايل يجعل
   *    الموبايلَ يزعم أنه كتب ما كتبه التابلت، فيتوقّف عن طلبه.
   *
   *    والنتيجةُ المقصودة: جهازٌ استُرجعت عليه نسخةٌ يبدأ بمتّجهٍ فارغ،
   *    فيُرسِل له الجارُ كلَّ شيءٍ من جديد — وهو **آمنٌ لأن التطبيق
   *    بالمعرِّف** (`put`) لا بالإضافة (راجع docs/20 §٢٠٫١٢).
   */
  changeLog: 'سجلُّ تغييرات جهازٍ بعينه — نقلُه يجعل الجهازَ يزعم تأليفَ ما لم يؤلّفه',
  syncPeers: 'ما يعرفه جهازٌ عن جيرانه — معرفةٌ محلّيّةٌ لا تنتقل',
});

/**
 * حقول تُحذف من كل سجل قبل الحفظ.
 *
 * `dirty` حالة مزامنة لجهاز بعينه. `normalizedText` و`normalizedName`
 * مشتقّان من `utils/normalization.js` — تخزينهما يعني أن تحسين
 * التطبيع مستقبلًا لن يصل للبيانات القديمة. يُعاد حسابهما عند الاسترجاع.
 */
export const DERIVED_FIELDS = Object.freeze(['dirty', 'normalizedText', 'normalizedName']);

/** أدوار ملفات الوسائط داخل مجلد blobs/. */
export const BLOB_ROLE = Object.freeze({
  ORIGINAL: 'original',
  THUMBNAIL: 'thumbnail',
});

/** يخمّن امتدادًا من نوع MIME — للقراءة البشرية داخل الأرشيف فقط. */
export function extensionFor(mime) {
  if (!mime) return 'bin';
  const known = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'audio/webm': 'weba',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
  };
  if (known[mime]) return known[mime];
  const sub = String(mime).split('/')[1] || 'bin';
  return sub.split(';')[0].replace(/[^a-z0-9]/gi, '') || 'bin';
}

/** مسار ملف الوسيط الأصلي داخل الأرشيف. */
export function originalPath(mediaId, mime) {
  return `${PATHS.BLOBS_DIR}${mediaId}.orig.${extensionFor(mime)}`;
}

/** مسار المصغّرة داخل الأرشيف. */
export function thumbnailPath(mediaId) {
  return `${PATHS.BLOBS_DIR}${mediaId}.thumb.webp`;
}

/** مسار ملف بيانات store داخل الأرشيف. */
export function storePath(storeName) {
  return `${PATHS.DATA_DIR}${storeName}.json`;
}

/** نصّ يُوضع داخل الأرشيف ليقرأه إنسان يفتحه بعد سنوات بأي أداة zip. */
export const README_TEXT = `LingoLife — نسخة احتياطية (.llife)

هذا ملف ZIP عادي. تقدر تفتحه بأي برنامج ضغط على أي نظام.

  manifest.json   وصف النسخة: الإصدارات، الأعداد، وبصمات الملفات
  data/*.json     بياناتك النصية، ملف لكل نوع
  blobs/*         صورك وتسجيلاتك بصيغتها الأصلية بلا إعادة ترميز

الملفات في blobs/ مسمّاة بمعرّف الوسيط، وتلاقي وصفها في data/media.json.
الصور والأصوات محفوظة كما رفعتها بالضبط — مش مضغوطة تاني ولا متحوّلة.

لو التطبيق اختفى، بياناتك هنا وتقدر توصلها من غيره.
`;

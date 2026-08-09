/**
 * LingoLife — التواريخ
 * كل العرض بالعربية. التخزين بصيغة ISO (YYYY-MM-DD) أو طابع زمني رقمي.
 */

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/** تاريخ اليوم بصيغة YYYY-MM-DD (بالتوقيت المحلي لا UTC). */
export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * يحوّل تاريخًا مخزَّنًا إلى كائن Date محلي (بلا انزياح المنطقة الزمنية).
 *
 * ⚠️ الترويسة أعلاه تقول إن التخزين «ISO **أو** طابع زمني رقمي»، وكانت
 *    الدالّة تنادي `.split` على المدخل مباشرةً — فرقمٌ واحد في حقل
 *    `scene.date` يُسقط الشاشة كلها بـ`iso.split is not a function`.
 *    وهو مدخلٌ يصل فعلًا: من استيراد، أو من نسخةٍ مسترجَعة، أو من كودٍ
 *    يمرّر `Date.now()` وهو يقرأ الترويسة نفسها.
 *
 * فصارت تقبل ما تقوله الترويسة: نصّ ISO (بجزء وقتٍ أو بدونه)، وطابعًا
 * رقميًّا، وكائن `Date`.
 */
export function parseISODate(iso) {
  if (!iso) return null;

  if (iso instanceof Date) return Number.isNaN(iso.getTime()) ? null : iso;

  if (typeof iso === 'number') {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    // نُسقط الوقت: هذه دالّة **يوم** لا لحظة، ومَن يريد اللحظة عنده
    // `formatTime`. وبناؤها من المكوّنات المحلية يمنع انزياح المنطقة.
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  if (typeof iso !== 'string') return null;

  // 'YYYY-MM-DDTHH:mm:ssZ' يُقصّ إلى يومه.
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** صيغة التخزين المعيارية 'YYYY-MM-DD' لأي مدخل تاريخ مقبول. */
export function toISODate(value) {
  const d = parseISODate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "29 مايو 2026" */
export function formatDate(iso) {
  const d = parseISODate(iso);
  if (!d) return '';
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "مايو 2026" — عنوان مجموعة في الخط الزمني. */
export function formatMonth(iso) {
  const d = parseISODate(iso);
  if (!d) return '';
  return `${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * مفتاح تجميع بالشهر: "2026-05".
 * يمرّ بالتطبيع لأن `slice` على رقمٍ تعطي مفتاحًا لا يقابل أي شهر —
 * فتنشأ في «حياتي» مجموعةٌ بعنوانٍ فارغ لا يفسّر نفسه.
 */
export function monthKey(iso) {
  return toISODate(iso).slice(0, 7);
}

/** "اليوم" / "أمس" / "منذ 3 أيام" / التاريخ الكامل. */
export function relativeDate(iso) {
  const d = parseISODate(iso);
  if (!d) return '';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start - d) / 86400000);

  if (days === 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days === 2) return 'أول أمس';
  if (days > 0 && days < 7) return `منذ ${days} أيام`;
  if (days < 0 && days > -7) return `بعد ${Math.abs(days)} أيام`;
  return formatDate(iso);
}

/** وقت نسبي من طابع زمني: "منذ 5 دقائق" */
export function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return formatDate(new Date(ts).toISOString().slice(0, 10));
}

/** "١٤:٣٠" — الوقت من طابع زمني. */
export function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

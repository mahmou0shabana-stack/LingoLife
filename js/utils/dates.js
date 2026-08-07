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

/** يحوّل 'YYYY-MM-DD' إلى كائن Date محلي (بلا انزياح المنطقة الزمنية). */
export function parseISODate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
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

/** مفتاح تجميع بالشهر: "2026-05" */
export function monthKey(iso) {
  return (iso || '').slice(0, 7);
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

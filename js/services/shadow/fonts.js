/**
 * LingoLife — خطوط عرض الجملة
 *
 * منقولة من `_FC` و`_FF` في التطبيق القديم. عشرة خطوط تغيّر شكل
 * الجملة أثناء التدريب.
 *
 * ليست زخرفة محضة: تغيير شكل الحرف يمنع «العمى القرائي» — أن تحفظ
 * صورة السطر بدل أن تقرأه فعلًا. تبديل الخطّ يُجبر العين على قراءة
 * جديدة، وهو ما كان المستخدم يفعله في التطبيق القديم.
 *
 * الخطوط تأتي من Google Fonts وتُخزَّن في الكاش بعد أول تحميل. لو
 * تعذّر تحميلها يسقط المتصفّح إلى خطّ النظام تلقائيًا — لا شيء ينكسر.
 */

/** @type {{id: string, label: string, stack: string, style: string, scale: number}[]} */
export const FONTS = Object.freeze([
  { id: 'philosopher', label: 'كلاسيكي', stack: "'Philosopher', serif", style: 'italic', scale: 1 },
  { id: 'dancing', label: 'راقص', stack: "'Dancing Script', cursive", style: 'normal', scale: 1.14 },
  { id: 'marck', label: 'يدوي', stack: "'Marck Script', cursive", style: 'normal', scale: 1.06 },
  { id: 'kurale', label: 'كورالي', stack: "'Kurale', serif", style: 'normal', scale: 1 },
  { id: 'caveat', label: 'مذكّرة', stack: "'Caveat', cursive", style: 'normal', scale: 1.18 },
  { id: 'pacifico', label: 'حرّ', stack: "'Pacifico', cursive", style: 'normal', scale: .98 },
  { id: 'noto', label: 'مطبعي', stack: "'Noto Serif', serif", style: 'normal', scale: .96 },
  { id: 'pt', label: 'روسي', stack: "'PT Serif', serif", style: 'italic', scale: 1 },
  { id: 'playfair', label: 'أنيق', stack: "'Playfair Display', serif", style: 'italic', scale: .98 },
  { id: 'system', label: 'النظام', stack: 'system-ui, sans-serif', style: 'normal', scale: .94 },
]);

/** يجد خطًّا بمعرّفه، أو الأول افتراضًا. */
export function fontById(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}

/** الخطّ التالي في الدورة — زرّ واحد يكفي للتنقّل بين العشرة. */
export function nextFont(currentId) {
  const index = FONTS.findIndex((f) => f.id === currentId);
  return FONTS[(index + 1) % FONTS.length];
}

/**
 * يطبّق خطًّا على عنصر.
 * @param {HTMLElement} element
 * @param {string} fontId
 */
export function applyFont(element, fontId) {
  if (!element) return;
  const font = fontById(fontId);
  element.style.fontFamily = font.stack;
  element.style.fontStyle = font.style;
  // المقياس نسبيّ حتى يبقى `clamp` في CSS مسؤولًا عن الحجم الأساسي.
  element.style.setProperty('--font-scale', font.scale);
  return font;
}

/**
 * رابط Google Fonts لكل الخطوط دفعةً واحدة.
 * يُحقن مرة واحدة عند أول دخول للظلّ، فلا يُثقل بقية التطبيق.
 */
export const FONTS_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Philosopher:ital,wght@0,400;0,700;1,400' +
  '&family=Dancing+Script:wght@400;700' +
  '&family=Marck+Script' +
  '&family=Kurale' +
  '&family=Caveat:wght@400;700' +
  '&family=Pacifico' +
  '&family=Noto+Serif:ital,wght@0,400;1,400' +
  '&family=PT+Serif:ital,wght@0,400;1,400' +
  '&family=Playfair+Display:ital,wght@0,400;1,400' +
  '&display=swap';

/** يحقن رابط الخطوط مرّة واحدة. */
export function ensureFontsLoaded() {
  if (document.getElementById('shadow-fonts')) return;
  const link = document.createElement('link');
  link.id = 'shadow-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.append(link);
}

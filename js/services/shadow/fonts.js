/**
 * LingoLife — خطوط عرض الجملة الروسية
 *
 * منقولة من `_FC` و`_FF` في التطبيق القديم. عشرة خطوط تغيّر شكل
 * الجملة أثناء التدريب.
 *
 * ليست زخرفة محضة: تغيير شكل الحرف يمنع «العمى القرائي» — أن تحفظ
 * صورة السطر بدل أن تقرأه فعلًا. تبديل الخطّ يُجبر العين على قراءة
 * جديدة، وهو ما كان المستخدم يفعله في التطبيق القديم.
 *
 * ─────────────────────────────────────────────────────────────
 * بند 17 — أمران:
 *
 * **الأول: التسمية بصيغة الكتابة لا بالذوق.** كانت الأسماء «راقص»
 * و«حرّ» و«أنيق» — لا تقول شيئًا عمّا سترى. صارت كل رقاقة تحمل
 * **شكل الحرف**: بزوائد أم بلا، متّصل أم منفصل، مائل أم قائم. وهي
 * مجموعةٌ في ثلاث عائلات: حروف الطباعة · خطّ الكرّاسة الروسية ·
 * خطّ اليد. تبحث عن شكلٍ فتجده حيث يُنتظَر.
 *
 * **الثاني: تغطية السيريلية مقيسة على جهازك لا مفترَضة.** خطٌّ لا
 * يحمل الأبجدية الروسية يبدو صالحًا في اللوحة — لأن عيّنة «Аа»
 * تُرسَم من الخطّ الاحتياطي — ثم تختاره فلا يتغيّر شيء. وهذا زرٌّ
 * يبدو أنه يعمل وهو لا يعمل (بند 89).
 *
 * فالتغطية **تُقاس هنا وقت التشغيل** (`measureCoverage`) بعرض النصّ
 * المرسوم: نقيس مسبارًا سيريليًّا بالخطّ ثم بالاحتياطي وحده، فإن
 * تساوى العرضان فالحروف جاءت من الاحتياطي لا منه.
 *
 * ونفرّق بين حالتين تبدوان واحدة:
 *   - `no-cyrillic` — الخطّ حُمِّل ولاتينيّته تظهر، لكن السيريلية لا.
 *   - `not-loaded`  — لم يصل الخطّ أصلًا (بلا شبكة، أو الشبكة تحجب
 *                     `fonts.googleapis.com`). ليس عيبًا في الخطّ.
 *
 * لماذا القياس لا `document.fonts.check`؟ لأنها تُطابق **سلسلة**
 * العائلات: `check("16px 'X', serif")` تعود `true` ما دام `serif`
 * موجودًا، فتقول «نعم» عن خطٍّ لم يصل. القياس يرى ما تراه العين.
 * ─────────────────────────────────────────────────────────────
 *
 * الخطوط تأتي من Google Fonts وتُخزَّن في الكاش بعد أول تحميل. لو
 * تعذّر تحميلها يسقط المتصفّح إلى خطّ النظام تلقائيًا — لا شيء ينكسر.
 */

/** عائلات صيغة الكتابة، بالترتيب الذي تُعرَض به. */
export const FONT_FORMS = Object.freeze([
  { id: 'print', label: 'حروف الطباعة', short: 'طباعة', hint: 'كما تقرأ في كتاب أو لافتة' },
  { id: 'school', label: 'خطّ الكرّاسة', short: 'كرّاسة', hint: 'كما يكتب الروس بأيديهم في المدرسة' },
  { id: 'hand', label: 'خطّ اليد', short: 'يد', hint: 'كما تُكتب الملاحظة السريعة' },
  { id: 'device', label: 'جهازك', short: 'جهازك', hint: 'الخطّ المثبَّت عندك — يعمل بلا شبكة' },
]);

/**
 * @type {{
 *   id: string, label: string, form: string, stack: string,
 *   style: string, scale: number, family: string|null, cyrillic: boolean
 * }[]}
 *
 * `family` هو اسم العائلة وحده (بلا احتياطي) — يحتاجه القياس.
 * `cyrillic` ما تُعلنه Google Fonts عن الخطّ؛ والقياس هو الحَكَم.
 */
export const FONTS = Object.freeze([
  // ── حروف الطباعة ──
  { id: 'noto', label: 'بزوائد', form: 'print',
    family: 'Noto Serif', stack: "'Noto Serif', serif", style: 'normal', scale: .96, cyrillic: true },
  { id: 'kurale', label: 'بزوائد عريضة', form: 'print',
    family: 'Kurale', stack: "'Kurale', serif", style: 'normal', scale: 1, cyrillic: true },
  { id: 'philosopher', label: 'بلا زوائد، مائل', form: 'print',
    family: 'Philosopher', stack: "'Philosopher', serif", style: 'italic', scale: 1, cyrillic: true },
  { id: 'pt', label: 'بزوائد، مائل', form: 'print',
    family: 'PT Serif', stack: "'PT Serif', serif", style: 'italic', scale: 1, cyrillic: true },
  { id: 'playfair', label: 'بزوائد رفيعة، مائل', form: 'print',
    family: 'Playfair Display', stack: "'Playfair Display', serif", style: 'italic', scale: .98, cyrillic: true },

  // ── خطّ الكرّاسة ──
  // Marck Script مرسوم أصلًا على خطّ اليد الروسي المدرسي.
  { id: 'marck', label: 'متّصل رفيع', form: 'school',
    family: 'Marck Script', stack: "'Marck Script', cursive", style: 'normal', scale: 1.06, cyrillic: true },
  // ⚠️ Bad Script حلّ محلّ Dancing Script: الأخير لاتينيٌّ فقط
  //    (latin · latin-ext · vietnamese) — يعرض السيريلية بخطّ
  //    احتياطي، فيبدو خيارًا وهو ليس خيارًا.
  { id: 'badscript', label: 'متّصل مائل', form: 'school',
    family: 'Bad Script', stack: "'Bad Script', cursive", style: 'normal', scale: 1.08, cyrillic: true },

  // ── خطّ اليد ──
  { id: 'caveat', label: 'منفصل سريع', form: 'hand',
    family: 'Caveat', stack: "'Caveat', cursive", style: 'normal', scale: 1.18, cyrillic: true },
  { id: 'pacifico', label: 'متّصل عريض', form: 'hand',
    family: 'Pacifico', stack: "'Pacifico', cursive", style: 'normal', scale: .98, cyrillic: true },

  // ── جهازك ──
  { id: 'system', label: 'خطّ جهازك', form: 'device',
    family: null, stack: 'system-ui, sans-serif', style: 'normal', scale: .94, cyrillic: true },
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
 * الاسم الكامل: صيغة الكتابة ثم الشكل — «كرّاسة · متّصل مائل».
 * داخل اللوحة يكفي الشكل لأن العنوان فوقه، وخارجها لا يكفي.
 */
export function fontFullLabel(font) {
  const form = FONT_FORMS.find((f) => f.id === font.form);
  if (!form || font.form === 'device') return font.label;
  return `${form.short} · ${font.label}`;
}

/** الخطوط مجموعةً بصيغة الكتابة، بترتيب `FONT_FORMS`. */
export function fontsByForm() {
  return FONT_FORMS
    .map((form) => ({ ...form, fonts: FONTS.filter((f) => f.form === form.id) }))
    .filter((group) => group.fonts.length);
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
 *
 * `subset=cyrillic` صريحة: بدونها قد يُسلَّم ملفٌّ لاتينيٌّ فقط
 * لمتصفّح لغته العربية، فيبدو الخطّ ناقص التغطية وهو ليس كذلك.
 */
export const FONTS_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Noto+Serif:ital,wght@0,400;1,400' +
  '&family=Kurale' +
  '&family=Philosopher:ital,wght@0,400;0,700;1,400' +
  '&family=PT+Serif:ital,wght@0,400;1,400' +
  '&family=Playfair+Display:ital,wght@0,400;1,400' +
  '&family=Marck+Script' +
  '&family=Bad+Script' +
  '&family=Caveat:wght@400;700' +
  '&family=Pacifico' +
  '&subset=cyrillic,latin' +
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

/* ------------------------------------------------------------------ *
 * قياس التغطية
 * ------------------------------------------------------------------ */

/** مسباران طويلان عمدًا: كلّما طال النصّ قلّ احتمال تساوي العرضين صدفةً. */
const PROBE_LATIN = 'HandgloveMWQ_hamburgefonstiv';
const PROBE_CYRILLIC = 'Ждпщэюя_ЗначениеДокумента';

/** خطٌّ احتياطي بلا سيريلية مميّزة ولا صلة بأيٍّ من العائلات أعلاه. */
const FALLBACK = 'monospace';
const PROBE_SIZE = 48;

let canvasContext = null;
function context2d() {
  if (!canvasContext) canvasContext = document.createElement('canvas').getContext('2d');
  return canvasContext;
}

/** عرض النصّ مرسومًا بعائلةٍ ما — مقيسٌ لا مفترَض. */
function widthIn(family, text) {
  const ctx = context2d();
  if (!ctx) return null;
  ctx.font = family
    ? `${PROBE_SIZE}px "${family}", ${FALLBACK}`
    : `${PROBE_SIZE}px ${FALLBACK}`;
  return ctx.measureText(text).width;
}

/**
 * يقيس تغطية خطٍّ واحد على هذا الجهاز الآن.
 *
 * @returns {{id: string, latin: boolean, cyrillic: boolean,
 *            status: 'ok'|'no-cyrillic'|'not-loaded'|'unknown'}}
 */
export function measureFont(font) {
  // خطّ الجهاز ليس تحميلًا نقيسه: هو المتاح عندك أصلًا.
  if (!font.family) return { id: font.id, latin: true, cyrillic: true, status: 'ok' };

  const baseLatin = widthIn(null, PROBE_LATIN);
  const baseCyrillic = widthIn(null, PROBE_CYRILLIC);
  if (baseLatin == null || !baseLatin) return { id: font.id, latin: false, cyrillic: false, status: 'unknown' };

  const latin = widthIn(font.family, PROBE_LATIN) !== baseLatin;
  const cyrillic = widthIn(font.family, PROBE_CYRILLIC) !== baseCyrillic;

  // الترتيب مقصود: غياب اللاتينية معناه أن الخطّ لم يصل، لا أنه
  // ناقص — فلا نتّهم خطًّا بريئًا حين تكون الشبكة هي المقطوعة.
  const status = !latin ? 'not-loaded' : cyrillic ? 'ok' : 'no-cyrillic';
  return { id: font.id, latin, cyrillic, status };
}

/**
 * يقيس كل الخطوط بعد أن تستقرّ عمليّة التحميل.
 *
 * `document.fonts.load` صريحة لكل عائلة: `display=swap` يعني أن
 * المتصفّح لا يحمّل الخطّ حتى يُطلَب في عنصرٍ فعلي، فقياسٌ قبل
 * الطلب يقول «لم يصل» عن خطٍّ لم يُطلَب بعد.
 *
 * @returns {Promise<Record<string, ReturnType<typeof measureFont>>>}
 */
export async function measureCoverage() {
  ensureFontsLoaded();

  if (document.fonts?.load) {
    await Promise.all(
      FONTS.filter((f) => f.family).flatMap((f) => [
        document.fonts.load(`${PROBE_SIZE}px "${f.family}"`, PROBE_LATIN),
        document.fonts.load(`${PROBE_SIZE}px "${f.family}"`, PROBE_CYRILLIC),
      ])
    ).catch(() => {});
    await document.fonts.ready.catch(() => {});
  }

  const report = {};
  for (const font of FONTS) report[font.id] = measureFont(font);
  return report;
}

/** وصفٌ صريح لكل حالة — يُعرض في اللوحة بلا تلطيف. */
export const COVERAGE_NOTE = Object.freeze({
  ok: '',
  'no-cyrillic': 'الخطّ ده مفيهوش حروف روسية — هتتكتب بخطّ تاني',
  'not-loaded': 'الخطّ لسه ما وصلش (محتاج إنترنت أول مرة)',
  unknown: '',
});

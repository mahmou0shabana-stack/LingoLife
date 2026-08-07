/**
 * LingoLife — تقسيم النصّ إلى جمل وكلمات
 *
 * منقول من محرّك الظلّ القديم (`parseCustomText` و`_shRenderWords`)
 * بعد فصله عن الـ DOM. المنطق نفسه بالضبط — كان يعمل، فلا نغيّره.
 *
 * ما تغيّر: كان يقرأ من `document.getElementById('ctInput').value`
 * ويكتب في `innerHTML`. الآن دوالّ خالصة تأخذ نصًّا وتعيد بيانات،
 * فيمكن اختبارها ونداؤها من أي مكان.
 */

/** يطابق أي حرف سيريلي. */
const CYRILLIC = /[а-яёА-ЯЁ]/;

/**
 * فواصل نهاية الجملة: النقطة وعلامتا التعجّب والاستفهام (اللاتينية
 * والعربية)، أو سطر جديد. الـ lookbehind يُبقي العلامة مع جملتها.
 */
const SENTENCE_BREAK = /(?<=[.!?؟])\s+|\n+/;

/** علامات ترقيم تُنظَّف من طرفَي الكلمة قبل النطق. */
const WORD_PUNCT = /[.,!?;:،؟«»""''()\[\]—–-]/g;

/**
 * أقصر جملة مقبولة. المحرّك القديم استخدم `> 3` — سطر من حرفين
 * ليس جملة يُتدرَّب عليها، وإبقاؤه يملأ الجلسة بمقاطع بلا قيمة.
 */
const MIN_SENTENCE_LENGTH = 4;

/**
 * يقسّم نصًّا إلى جمل صالحة للممارسة.
 *
 * @param {string} text
 * @param {{ requireCyrillic?: boolean, minLength?: number }} options
 *        `requireCyrillic` يستبعد السطور العربية الشارحة داخل نصّ
 *        روسي — وهي حالة شائعة في نصوصك المختلطة.
 * @returns {string[]}
 */
export function splitSentences(text, { requireCyrillic = true, minLength = MIN_SENTENCE_LENGTH } = {}) {
  if (!text || typeof text !== 'string') return [];

  return text
    .split(SENTENCE_BREAK)
    .map((part) => part.trim())
    .filter((part) => {
      if (part.length < minLength) return false;
      if (requireCyrillic && !CYRILLIC.test(part)) return false;
      return true;
    });
}

/**
 * يقسّم جملة إلى كلمات قابلة للنقر.
 *
 * يعيد الشكل المعروض (بترقيمه، فيظل النصّ مقروءًا كما كُتب) والشكل
 * المنطوق (بلا ترقيم، فلا ينطق المحرّك الفاصلة).
 *
 * @param {string} sentence
 * @returns {{ display: string, spoken: string, index: number }[]}
 */
export function splitWords(sentence) {
  if (!sentence || typeof sentence !== 'string') return [];

  return sentence
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token, index) => {
      const spoken = token.replace(WORD_PUNCT, '').trim();
      return { display: token, spoken: spoken || token, index };
    })
    .filter((word) => word.spoken.length > 0);
}

/** هل النصّ يحتوي على روسية؟ */
export function hasCyrillic(text) {
  return CYRILLIC.test(text || '');
}

/**
 * بصمة محتوى مستقرّة تُستخدم لكشف تغيّر المصدر بعد إنشاء الجلسة.
 *
 * ليست تشفيرية — الغرض كشف الاختلاف لا مقاومة التلاعب، ولذلك
 * تُحسب متزامنةً بلا `crypto.subtle` فتصلح للنداء داخل معاملة.
 *
 * @param {string} text
 * @returns {string}
 */
export function contentHash(text) {
  const value = String(text ?? '');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code + i, 0x85ebca6b) >>> 0;
  }

  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

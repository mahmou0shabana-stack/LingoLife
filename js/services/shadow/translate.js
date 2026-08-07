/**
 * LingoLife — الترجمة
 *
 * منقولة من `_trLingva` و`_trMyMemory` و`_trLibre` و`_fetchTr` في
 * التطبيق القديم، بنفس استراتيجية «السباق»: تُطلق الخدمات الثلاث معًا
 * ويفوز أوّل ردّ صالح.
 *
 * ⚠️ **اختيارية بالكامل ومُطفأة افتراضيًا.**
 *
 *    مبدأ LingoLife أن لا شيء ينتظر الإنترنت (docs/03 §239)، وهذه
 *    الوحدة تخالفه بطبيعتها. لذلك:
 *      · لا تعمل إلا بعد تفعيل صريح من المستخدم.
 *      · نتيجتها تُحفظ في المقطع فتصير جزءًا من بياناتك المحلّية،
 *        ولا تُطلب مرّتين.
 *      · فشلها لا يكسر شيئًا — التدريب يكمل بلا ترجمة.
 *
 *    الترجمة المحفوظة في قاعدتك تسبق دائمًا. هذه للسدّ حين لا توجد.
 */

import { settings } from '../../db/repositories.js';
import { toEgyptian } from './dialect.js';

/** مفتاح التفعيل. */
const ENABLED_KEY = 'shadow.onlineTranslation';

/** اللغات المدعومة — نفس قائمة التطبيق القديم. */
export const LANGUAGES = Object.freeze([
  { code: 'ar', label: 'عربي', flag: '🇸🇦', rtl: true },
  { code: 'ams', label: 'مصري', flag: '🇪🇬', rtl: true },
  { code: 'en', label: 'إنجليزي', flag: '🇬🇧', rtl: false },
  { code: 'fr', label: 'فرنسي', flag: '🇫🇷', rtl: false },
  { code: 'de', label: 'ألماني', flag: '🇩🇪', rtl: false },
  { code: 'es', label: 'إسباني', flag: '🇪🇸', rtl: false },
  { code: 'it', label: 'إيطالي', flag: '🇮🇹', rtl: false },
  { code: 'tr', label: 'تركي', flag: '🇹🇷', rtl: false },
  { code: 'fa', label: 'فارسي', flag: '🇮🇷', rtl: true },
  { code: 'ur', label: 'أردو', flag: '🇵🇰', rtl: true },
  { code: 'hi', label: 'هندي', flag: '🇮🇳', rtl: false },
  { code: 'zh', label: 'صيني', flag: '🇨🇳', rtl: false },
  { code: 'ja', label: 'ياباني', flag: '🇯🇵', rtl: false },
  { code: 'ko', label: 'كوري', flag: '🇰🇷', rtl: false },
  { code: 'pt', label: 'برتغالي', flag: '🇧🇷', rtl: false },
]);

export function languageByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

/** هل فعّل المستخدم الترجمة عبر الإنترنت؟ */
export async function isEnabled() {
  return Boolean(await settings.get(ENABLED_KEY, false));
}

/** يفعّل أو يعطّل الترجمة عبر الإنترنت. */
export async function setEnabled(on) {
  await settings.set(ENABLED_KEY, Boolean(on));
  return Boolean(on);
}

/** `ams` ليست لغة عند الخدمات — نطلب العربية ثم نحوّلها. */
const targetOf = (code) => (code === 'ams' ? 'ar' : code);

async function viaLingva(text, code) {
  const response = await fetch(
    `https://lingva.ml/api/v1/ru/${targetOf(code)}/${encodeURIComponent(text)}`,
    { signal: AbortSignal.timeout(5000) }
  );
  const data = await response.json();
  if (!data.translation) throw new Error('lingva');
  return data.translation;
}

async function viaMyMemory(text, code) {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ru|${targetOf(code)}`,
    { signal: AbortSignal.timeout(5000) }
  );
  const data = await response.json();
  const result = data.responseData?.translatedText || '';
  // الخدمة تردّ بنصّ تحذير بدل رمز خطأ عند تجاوز الحصّة.
  if (!result || result.startsWith('MYMEMORY')) throw new Error('mymemory');
  return result;
}

async function viaLibre(text, code) {
  const response = await fetch('https://libretranslate.com/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'ru', target: targetOf(code), format: 'text' }),
    signal: AbortSignal.timeout(7000),
  });
  const data = await response.json();
  if (!data.translatedText) throw new Error('libre');
  return data.translatedText;
}

/**
 * يترجم نصًّا روسيًا.
 *
 * سباق بين ثلاث خدمات: أوّل نتيجة صالحة تفوز، وإن فشلت كلها نعيد
 * `null` بدل رمي خطأ — الترجمة مساعِدة لا شرط للتدريب.
 *
 * @param {string} text
 * @param {string} code
 * @returns {Promise<string|null>}
 */
export async function translate(text, code = 'ar') {
  if (!text?.trim()) return null;
  if (!navigator.onLine) return null;
  if (!(await isEnabled())) return null;

  const services = [viaLingva, viaMyMemory, viaLibre];

  const result = await new Promise((resolve) => {
    let settled = false;
    let failures = 0;

    services.forEach((service) => {
      service(text, code)
        .then((value) => {
          if (!settled && value) {
            settled = true;
            resolve(value);
          }
        })
        .catch(() => {
          failures++;
          if (failures === services.length && !settled) resolve(null);
        });
    });
  });

  if (!result) return null;
  return code === 'ams' ? toEgyptian(result) : result;
}

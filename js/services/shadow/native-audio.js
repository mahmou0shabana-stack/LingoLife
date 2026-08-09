/**
 * LingoLife — النطق الأصلي (بند 22)
 *
 * TTS يقول لك كيف *تُقرأ* الكلمة. الناطق الأصلي يقول لك كيف *تُقال*.
 * الفرق مسموع في الروسية بالذات: التخفيف، والنبر، وأكانية «о» غير
 * المنبورة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ هذه هي **الميزة الوحيدة في التطبيق التي تغادر جهازك.**
 * ═══════════════════════════════════════════════════════════════
 *
 * فقواعدها أشدّ:
 *
 * 1. **مطفأة افتراضيًّا.** لا طلب يخرج قبل موافقةٍ صريحة تقول بالحرف
 *    إن الكلمة تُرسَل إلى خادمٍ خارجي، وتسمّي الخوادم بأسمائها.
 * 2. **الكلمة وحدها تخرج** — لا جملتك ولا ذكراك ولا معرّف جهازك.
 *    لا نرسل عنوان الجلسة ولا نصّ المشهد ولا أي شيء يخصّك.
 * 3. **مرّةً واحدة لكل كلمة.** ما يُجلب يُخزَّن ببايتاته محليًّا،
 *    والغياب يُخزَّن أيضًا — كلمةٌ بلا تسجيل تظلّ بلا تسجيل، وإعادة
 *    السؤال مغادرةٌ بلا فائدة.
 * 4. **للكلمات المفردة فقط.** لا يوجد على هذه الخوادم تسجيلٌ لجملتك.
 *    الجملة تبقى TTS دائمًا، والواجهة تقول ذلك ولا تُوهم بغيره.
 * 5. **السقوط إلى TTS مُعلَن لا صامت.** «مالقيناش تسجيل — نطقناها
 *    آليًا» أفضل من صوتٍ آليّ تظنّه بشريًّا (بند 89).
 * 6. **الرجوع في أي وقت**، ومعه مسح كل ما جُلب.
 *
 * والتسمية صادقة في الواجهة كلها: ثلاثة مصادر متمايزة —
 * `آلي (TTS)` · `تسجيلي` · `ناطق أصلي` — ولا يُسمَّى المُصنَّع
 * «بشريًّا» أبدًا.
 *
 * راجع docs/08-shadowing.md
 */

import { nativeAudio, settings as settingsRepo } from '../../db/repositories.js';
import { normalizeRussian } from '../../utils/normalization.js';

const CONSENT_KEY = 'shadow.nativeAudio';

/** لا شيء يخرج قبل أن يصير هذا `true` بفعلٍ صريح منك. */
const DEFAULT_CONSENT = Object.freeze({ enabled: false, consentedAt: null });

/* ------------------------------------------------------------------ *
 * الموافقة
 * ------------------------------------------------------------------ */

export async function nativeAudioConsent() {
  const stored = await settingsRepo.get(CONSENT_KEY, null);
  return { ...DEFAULT_CONSENT, ...(stored || {}) };
}

/** هل يُسمح بالخروج الآن؟ */
export async function nativeAudioEnabled() {
  return (await nativeAudioConsent()).enabled === true;
}

export async function grantNativeAudio() {
  const consent = { enabled: true, consentedAt: Date.now() };
  await settingsRepo.set(CONSENT_KEY, consent);
  return consent;
}

/**
 * السحب يمسح ما جُلب.
 * موافقةٌ مسحوبة وبيانات باقية ليست سحبًا — هي احتفاظٌ بالغنيمة.
 */
export async function revokeNativeAudio() {
  const consent = { enabled: false, consentedAt: null };
  await settingsRepo.set(CONSENT_KEY, consent);
  await clearNativeCache();
  return consent;
}

/* ------------------------------------------------------------------ *
 * المصادر
 *
 * ثلاثة، بالترتيب. أوّلها ما يُرجَّح أن يُصيب، وكلٌّ منها يفشل وحده
 * فلا يُسقط ما بعده.
 * ------------------------------------------------------------------ */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/** يبني رابط استعلامٍ بمعاملاتٍ مُرمَّزة. `origin=*` لازمة لـCORS. */
function commonsUrl(params) {
  const query = new URLSearchParams({ format: 'json', origin: '*', ...params });
  return `${COMMONS_API}?${query}`;
}

/**
 * @type {{id: string, label: string, host: string,
 *         find: (word: string) => Promise<{url: string, speaker: string|null}[]>}[]}
 */
export const NATIVE_SOURCES = Object.freeze([
  {
    id: 'commons',
    label: 'Wikimedia Commons',
    host: 'commons.wikimedia.org',
    /** الاصطلاح المتّبع على Commons لتسجيلات الروسية: `Ru-<слово>.ogg`. */
    async find(word) {
      const data = await getJson(
        commonsUrl({
          action: 'query',
          titles: `File:Ru-${word}.ogg`,
          prop: 'imageinfo',
          iiprop: 'url|mime|user',
        })
      );
      const pages = Object.values(data?.query?.pages || {});
      return pages
        .filter((p) => !('missing' in p) && p.imageinfo?.[0]?.url)
        .map((p) => ({ url: p.imageinfo[0].url, speaker: p.imageinfo[0].user || null }));
    },
  },

  {
    id: 'lingualibre',
    label: 'Lingua Libre',
    host: 'commons.wikimedia.org',
    /**
     * Lingua Libre ترفع إلى Commons بصيغة
     * `LL-Q7737 (rus)-<الناطق>-<الكلمة>.wav` — و Q7737 هي الروسية.
     * البحث هنا بالاسم لا بالمحتوى، فيصيب كل ناطقٍ سجّل الكلمة.
     */
    async find(word) {
      const data = await getJson(
        commonsUrl({
          action: 'query',
          generator: 'search',
          gsrsearch: `intitle:"LL-Q7737 (rus)" intitle:"${word}"`,
          gsrnamespace: '6',
          gsrlimit: '5',
          prop: 'imageinfo',
          iiprop: 'url|mime|user',
        })
      );
      const pages = Object.values(data?.query?.pages || {});
      return pages
        .filter((p) => p.imageinfo?.[0]?.url)
        // ⚠️ البحث يطابق تقريبيًّا: نتأكّد أن الملفّ لهذه الكلمة
        //    بعينها لا لكلمةٍ تحويها، وإلا سمعت غير ما طلبت.
        .filter((p) => new RegExp(`-${escapeRegExp(word)}\\.wav$`, 'i').test(p.title || ''))
        .map((p) => ({ url: p.imageinfo[0].url, speaker: speakerFromLL(p.title) }));
    },
  },

  {
    id: 'openrussian',
    label: 'openrussian',
    host: 'api.openrussian.org',
    async find(word) {
      const data = await getJson(
        `https://api.openrussian.org/read/ru/${encodeURIComponent(word)}`
      );
      const audio = data?.result?.word?.audio;
      return audio ? [{ url: audio, speaker: null }] : [];
    },
  },
]);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `LL-Q7737 (rus)-Ирина-документ.wav` → `Ирина` */
function speakerFromLL(title) {
  const match = /\(rus\)-([^-]+)-/.exec(title || '');
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ *
 * الجلب
 * ------------------------------------------------------------------ */

/** مهلة قصيرة: تدريبٌ ينتظر شبكةً بطيئة تدريبٌ مقطوع. */
const TIMEOUT_MS = 6000;

async function withTimeout(promise, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url) {
  return withTimeout(async (signal) => {
    const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

async function getBlob(url) {
  return withTimeout(async (signal) => {
    const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  });
}

/** كلمةٌ واحدة، سيريلية، بلا ترقيم — وإلا فلا معنى للسؤال. */
export function isPronounceableWord(text) {
  const word = (text || '').trim();
  if (!word || /\s/.test(word)) return false;
  return /^[Ѐ-ӿ́-]+$/.test(word);
}

/** المفتاح: الكلمة مطبَّعةً بلا علامة نبر — نبرك لا يغيّر التسجيل. */
export function audioKey(word) {
  return normalizeRussian(word).replace(/́/g, '');
}

/**
 * يبحث عن نطقٍ أصلي للكلمة.
 *
 * @param {string} word
 * @param {{refresh?: boolean}} [options]
 * @returns {Promise<{
 *   status: 'ok'|'not-found'|'unreachable'|'disabled'|'not-a-word'|'offline',
 *   url?: string, blob?: Blob, source?: string, speaker?: string|null,
 *   cached?: boolean, candidates?: {source: string, speaker: string|null}[]
 * }>}
 */
export async function findNativeAudio(word, { refresh = false } = {}) {
  if (!isPronounceableWord(word)) return { status: 'not-a-word' };
  if (!(await nativeAudioEnabled())) return { status: 'disabled' };

  const key = audioKey(word);

  if (!refresh) {
    const cached = await nativeAudio.get(key).catch(() => null);
    if (cached?.notFound) return { status: 'not-found', cached: true };
    if (cached?.blob) {
      return {
        status: 'ok',
        cached: true,
        blob: cached.blob,
        url: URL.createObjectURL(cached.blob),
        source: cached.source,
        speaker: cached.speaker,
        candidates: cached.candidates || [],
      };
    }
  }

  // بلا شبكة لا نسجّل «غير موجودة»: الغياب هنا عرَضٌ لا حقيقة، وتخزينه
  // يمنع الجلب للأبد بعد عودة الشبكة.
  if (navigator.onLine === false) return { status: 'offline' };

  const candidates = [];
  let chosen = null;
  /**
   * كم مصدرًا **ردّ** فعلًا (لا كم مصدرًا سألنا).
   *
   * ⚠️ الفرق حاسم. `navigator.onLine` تكذب: وسيطٌ يحجب، أو بوّابة
   *    فندق، أو جدارٌ ناريّ — كلها «متّصل» وكل الطلبات تفشل. لو
   *    خزّنّا «غير موجودة» حينها، لبقيت الكلمة بلا نطقٍ **للأبد**
   *    بعد أن تعود الشبكة، بلا سببٍ ظاهر ولا طريق للإصلاح.
   *
   *    فالسلبيّ لا يُخزَّن إلا إذا **أجاب** خادمٌ واحد على الأقل
   *    بأنه لا يملك الكلمة. «سألنا فقالوا لا» غير «ما استطعنا السؤال».
   */
  let answered = 0;

  for (const source of NATIVE_SOURCES) {
    let hits = [];
    try {
      hits = await source.find(word);
      answered++;
    } catch {
      // مصدرٌ سقط لا يُسقط ما بعده.
      continue;
    }
    for (const hit of hits) candidates.push({ ...hit, source: source.id });
    if (!chosen && hits.length) chosen = { ...hits[0], source: source.id };
    if (chosen) break;
  }

  if (!chosen) {
    if (answered === 0) return { status: 'unreachable', cached: false };
    await remember(key, word, { notFound: true }).catch(() => {});
    return { status: 'not-found', cached: false };
  }

  let blob = null;
  try {
    blob = await getBlob(chosen.url);
  } catch {
    // وجدناه ولم نستطع تنزيله: لا نُخزّن «غير موجود» على عطبٍ عابر.
    return { status: 'not-found', cached: false };
  }

  await remember(key, word, {
    blob,
    source: chosen.source,
    speaker: chosen.speaker,
    mime: blob.type || 'audio/ogg',
    candidates: candidates.map((c) => ({ source: c.source, speaker: c.speaker, url: c.url })),
  }).catch(() => {});

  return {
    status: 'ok',
    cached: false,
    blob,
    url: URL.createObjectURL(blob),
    source: chosen.source,
    speaker: chosen.speaker,
    candidates,
  };
}

async function remember(key, word, fields) {
  return nativeAudio.putRaw({ word: key, original: word, fetchedAt: Date.now(), ...fields });
}

/* ------------------------------------------------------------------ *
 * الذاكرة
 * ------------------------------------------------------------------ */

/** ماذا يحمل الجهاز من تسجيلاتٍ خارجية، وكم يزن؟ */
export async function nativeCacheStats() {
  const all = await nativeAudio.getAll().catch(() => []);
  const withAudio = all.filter((r) => r.blob);
  return {
    words: withAudio.length,
    misses: all.length - withAudio.length,
    bytes: withAudio.reduce((sum, r) => sum + (r.blob?.size || 0), 0),
  };
}

export async function clearNativeCache() {
  const all = await nativeAudio.getAll().catch(() => []);
  for (const record of all) await nativeAudio.destroy(record.word).catch(() => {});
  return all.length;
}

/** أسماء الخوادم التي ستُزار — تُعرَض في نصّ الموافقة بأسمائها. */
export const NATIVE_HOSTS = Object.freeze([...new Set(NATIVE_SOURCES.map((s) => s.host))]);

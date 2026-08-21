/**
 * LingoLife — مخزنُ معجم النبر بلا إنترنت (WS55)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لماذا بحثٌ ثنائيٌّ في نصٍّ بدل `Map`؟
 * ═══════════════════════════════════════════════════════════════
 *
 * المعجمُ ٥٠٧ آلاف صيغة. و`Map` من نصفِ مليون سلسلةٍ قصيرة يكلّف
 * عشرات الميغابايتات في الذاكرة — على لوحٍ يُشغّل جلسةَ ظلٍّ وصوتًا
 * وخلفيّةً كونيّة، هذا ثمنٌ حقيقيّ يُدفَع من سلاسة كلّ شيءٍ آخر.
 *
 * والبياناتُ مخزَّنةٌ **مفرزةً** في نصٍّ واحدٍ لكلّ رقمِ حركة:
 *
 *     { "1": "аба́жур авто́бус ... я́блоко" }
 *
 * فالبحثُ الثنائيُّ داخل النصّ يجد الكلمةَ في ~١٧ مقارنة، والذاكرةُ
 * تبقى حجمَ النصّ نفسِه لا أكثر. لا `Map`، ولا فهرسَ إزاحات، ولا نسخ.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والتحميلُ كسولٌ ولا يُبطئ الإقلاع
 * ═══════════════════════════════════════════════════════════════
 *
 * ١٫٥ ميغابايت مضغوطةً تُجلَب **عند أوّل حاجةٍ إليها** لا عند فتح
 * التطبيق. وقبل وصولها يعمل المحرّكُ كما كان يعمل بالضبط: القاموسُ
 * المدمج ثم «مجهول». لا انتظارَ ولا شاشةَ تحميل.
 *
 * ═══════════════════════════════════════════════════════════════
 * البيانات: OpenRussian.org — رخصة CC BY-SA 4.0
 * ═══════════════════════════════════════════════════════════════
 * النسبةُ مكتوبةٌ داخل ملفّ البيانات نفسِه فتسافر معه، ومكرَّرةٌ هنا
 * لأن قارئَ الكود قد لا يفتح ملفَّ بياناتٍ من عشرة ميغابايت.
 */

/**
 * ⚠️ **المسارُ يُشتقّ من موضع الوحدة لا من جذر الموقع.**
 *
 *    `/assets/…` المطلقةُ تعمل على `localhost` وتنكسر على GitHub Pages،
 *    لأن الموقعَ هناك يُخدَم من `/LingoLife/` لا من الجذر. و`import.meta.url`
 *    يعرف أين هو هذا الملفُّ فعلًا مهما كان الجذر — أربعُ درجاتٍ فوقَه
 *    هي جذرُ المشروع (`stress` ← `pronunciation` ← `services` ← `js`).
 */
const URL_PATH = new URL('../../../../assets/stress-lexicon.json', import.meta.url).href;

/** `{ [ordinal]: "sorted space-separated forms" }` */
let buckets = null;
/** `{ bare: [ordinals] }` — التباسٌ حقيقيّ لا يُحسَم بالإملاء. */
let ambiguous = null;
/** `{ bare: [ordinals] }` — قراءاتٌ نادرةٌ لكلمةٍ حُسمت بعنوان مدخَلها. */
let alternates = null;
let meta = null;
let loading = null;
let failed = false;

/**
 * بحثٌ ثنائيٌّ عن كلمةٍ في نصٍّ مفرزٍ مفصولٍ بمسافات.
 *
 * ⚠️ **ولا نُقسّم النصَّ إلى مصفوفة** — `split(' ')` على نصٍّ من ثلاثة
 *    ميغابايت يُنشئ ٢٠٠ ألف سلسلةٍ جديدةٍ في نداءٍ واحد، وهو بالضبط
 *    ما نتجنّبه. فالقفزُ داخل النصّ نفسِه، وتُقتطَع كلمةٌ واحدةٌ لكلّ
 *    مقارنة.
 */
function hasWord(text, word) {
  if (!text) return false;
  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    let mid = (lo + hi) >> 1;
    /* ارجع إلى بداية الكلمة التي وقع فيها المنتصف. */
    let start = text.lastIndexOf(' ', mid);
    start = start === -1 ? 0 : start + 1;
    let end = text.indexOf(' ', start);
    if (end === -1) end = text.length;

    const candidate = text.slice(start, end);
    if (candidate === word) return true;

    if (candidate < word) {
      /* تقدَّم إلى ما بعد هذه الكلمة — وإلّا دار البحثُ إلى الأبد. */
      if (end >= hi) return false;
      lo = end + 1;
    } else {
      if (start <= lo) return false;
      hi = start - 1;
    }
  }
  return false;
}

/** هل المعجمُ جاهزٌ الآن؟ — يُسأل قبل كلّ استعمالٍ متزامن. */
export function lexiconReady() {
  return buckets !== null;
}

export function lexiconMeta() {
  return meta ? { ...meta, ready: lexiconReady(), failed } : { ready: false, failed };
}

/**
 * يحمّل المعجمَ مرّةً واحدة.
 *
 * ⚠️ **ولا يرمي أبدًا.** تعذُّرُ التحميل (بلا شبكةٍ أوّلَ مرّة، أو ملفٌّ
 *    ناقص) يجب ألّا يُسقط تحليلَ النطق — يعود المحرّكُ إلى ما كان
 *    عليه قبل WS55 بالضبط: قاموسٌ مدمجٌ ثم «مجهول».
 */
export async function loadStressLexicon({ fetchImpl = fetch, path = URL_PATH } = {}) {
  if (buckets) return true;
  if (loading) return loading;

  loading = (async () => {
    try {
      const response = await fetchImpl(path);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      buckets = data.forms || {};
      ambiguous = data.ambiguous || {};
      alternates = data.alt || {};
      meta = {
        license: data._license,
        source: data._source,
        attribution: data._attribution,
        generated: data._generated,
        forms: Object.values(buckets).reduce((n, s) => n + (s ? s.split(' ').length : 0), 0),
        ambiguous: Object.keys(ambiguous).length,
      };
      return true;
    } catch {
      failed = true;
      return false;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/**
 * يبحث عن صيغةٍ في المعجم — **متزامنٌ**، فلا يغيّر عقدَ `analyzeWord`.
 *
 * @returns {{ ordinal: number, ambiguous: boolean, variants: number[]|null,
 *             alternates: number[]|null } | null}
 */
export function lookupStress(bare) {
  if (!buckets || !bare) return null;

  const variants = ambiguous[bare];
  if (variants) return { ordinal: -1, ambiguous: true, variants, alternates: null };

  for (const key of Object.keys(buckets)) {
    if (hasWord(buckets[key], bare)) {
      return {
        ordinal: Number(key),
        ambiguous: false,
        variants: null,
        alternates: alternates[bare] || null,
      };
    }
  }
  return null;
}

/** ⚠️ للاختبارات وحدَها. */
export function __resetLexicon() {
  buckets = null; ambiguous = null; alternates = null; meta = null;
  loading = null; failed = false;
}

/** ⚠️ للاختبارات: حقنُ معجمٍ صغيرٍ بلا شبكة. */
export function __injectLexicon(data) {
  buckets = data.forms || {};
  ambiguous = data.ambiguous || {};
  alternates = data.alt || {};
  meta = { license: data._license || 'test', forms: -1, ambiguous: Object.keys(ambiguous).length };
  failed = false;
}

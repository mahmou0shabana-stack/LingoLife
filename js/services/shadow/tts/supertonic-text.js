/**
 * LingoLife — Supertonic 3: تحضيرُ النصّ والضجيج والأصوات (المرحلة 1B)
 *
 * دوالُّ صافية بلا DOM ولا ONNX — يستوردها عاملُ التوليد
 * (`supertonic-worker.js`) وتختبرها الاختباراتُ مباشرةً في الخيط الرئيسيّ.
 *
 * ═══════════════════════════════════════════════════════════════
 * ما نُقل من الكود الرسميّ وما تغيّر
 * ═══════════════════════════════════════════════════════════════
 *
 * منقولٌ بحرفه من `supertonic/web/helper.js` (المستودع الرسميّ @ 1e9799e):
 * `preprocessText` و`chunkText` وصيغةُ Box-Muller وأبعادُ الضجيج والأقنعة.
 *
 * ⚠️ **تغييرٌ واحدٌ مقصود: الضجيجُ حتميّ.** الأصلُ يستعمل `Math.random`
 *    فيختلف الصوتُ في كلّ مرّة — وذاكرةُ الصوت المولَّد تفترض أنّ الطلبَ
 *    نفسَه يعطي الصوتَ نفسَه. هنا مولِّدٌ مبذورٌ (mulberry32) ببذرةٍ تُشتقّ
 *    من الطلب كاملًا (راجع `seedFor`).
 *
 * ═══════════════════════════════════════════════════════════════
 * النبرُ والـё — ما الذي «يُحفَظ» بالضبط
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **NFKD ليس اختيارًا، النموذجُ مُدرَّبٌ عليه.** فهرسُ الأحرف الحقيقيّ
 *    (`unicode_indexer.bin`) يعطي `ё` و`Ё` و`й` المركّبة **‎-1** (لم يرها
 *    النموذجُ قطّ)، ويعطي الشكلَ المفكوك أرقامًا صحيحة:
 *      ё → е (252) + U+0308 (152)      й → и + U+0306 (150)
 *      علامةُ النبر U+0301 → 146
 *    فـ«حفظُ الـё» هنا = تبقى نقطتاها علامةً مركّبةً تصل النموذج، **ولا
 *    تُطوى أبدًا إلى е** (كما تفعل `normalizeRussian` للبحث). و«حفظُ
 *    النبر» = يبقى U+0301 بعد حرفه في موضعه. NFC على الناتج يعيد النصَّ
 *    الأصليّ حرفًا — وهذا ما تحرسه الاختبارات.
 *
 * ⚠️ **ولا شيءَ في استبدالات الأصل يمسّ U+0301:** `´` المستبدَلة هناك
 *    هي U+00B4 (نبرةٌ منفصلة)، لا العلامةُ المركّبة.
 */

/** الأصواتُ المدعومة في هذه المرحلة وموضعُها في `voice.bin` (0–4 = F1–F5، 5–9 = M1–M5). */
export const SUPERTONIC_VOICES = Object.freeze({ F1: 0, M1: 5 });

/** إعدادٌ ثابت — يدخل بذرةَ الضجيج، فتغييرُه يغيّر الصوتَ عمدًا. */
export const SUPERTONIC_INFERENCE = Object.freeze({
  steps: 8,
  defaultSpeed: 1.05,
  silenceSec: 0.3,
  maxChunkLen: 300,
  lang: 'ru',
});

/** اللغاتُ التي يعرفها النموذج (من الأصل) — نستعمل `ru` وحدها الآن. */
const AVAILABLE_LANGS = ['en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hi', 'hr',
  'hu', 'id', 'it', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi', 'na'];

const EMOJI = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;

const REPLACEMENTS = [
  ['–', '-'], ['‑', '-'], ['—', '-'], ['_', ' '],
  ['“', '"'], ['”', '"'], ['‘', "'"], ['’', "'"],
  ['´', "'"], ['`', "'"], ['[', ' '], [']', ' '], ['|', ' '], ['/', ' '], ['#', ' '], ['→', ' '], ['←', ' '],
];

const EXPRESSIONS = [['@', ' at '], ['e.g.,', 'for example, '], ['i.e.,', 'that is, ']];

/**
 * نسخةٌ من `UnicodeProcessor.preprocessText` الرسميّة.
 * @param {string} text
 * @param {string} [lang]
 */
export function preprocessText(text, lang = SUPERTONIC_INFERENCE.lang) {
  if (!AVAILABLE_LANGS.includes(lang)) throw new Error(`Invalid language: ${lang}`);
  let t = String(text).normalize('NFKD');
  t = t.replace(EMOJI, '');
  for (const [k, v] of REPLACEMENTS) t = t.replaceAll(k, v);
  t = t.replace(/[♥☆♡©\\]/g, '');
  for (const [k, v] of EXPRESSIONS) t = t.replaceAll(k, v);
  t = t.replace(/ ,/g, ',').replace(/ \./g, '.').replace(/ !/g, '!').replace(/ \?/g, '?')
    .replace(/ ;/g, ';').replace(/ :/g, ':').replace(/ '/g, "'");
  while (t.includes('""')) t = t.replace('""', '"');
  while (t.includes("''")) t = t.replace("''", "'");
  while (t.includes('``')) t = t.replace('``', '`');
  t = t.replace(/\s+/g, ' ').trim();
  if (!/[.!?;:,'"')\]}…。」』】〉》›»]$/.test(t)) t += '.';
  return `<${lang}>${t}</${lang}>`;
}

/**
 * نصٌّ مُحضَّر → معرّفاتُ الأحرف. نقطةُ ترميزٍ خارج الفهرس = ‎-1 كما في
 * الأصل؛ وتُعدّ في `unknown` ليراها المستدعي بدل أن تضيع صامتة.
 * @param {string} processed
 * @param {Int32Array} indexer
 */
export function textToIds(processed, indexer) {
  const ids = new Array(processed.length);
  let unknown = 0;
  for (let j = 0; j < processed.length; j++) {
    const cp = processed.codePointAt(j);
    ids[j] = cp < indexer.length ? indexer[cp] : -1;
    if (ids[j] < 0) unknown++;
  }
  return { ids, unknown };
}

/** نسخةٌ من `chunkText` الرسميّة: فقرات، ثم جمل، حتى `maxLen` حرفًا. */
export function chunkText(text, maxLen = SUPERTONIC_INFERENCE.maxChunkLen) {
  const paragraphs = String(text).trim().split(/\n\s*\n+/).filter((p) => p.trim());
  const chunks = [];
  for (let paragraph of paragraphs) {
    paragraph = paragraph.trim();
    if (!paragraph) continue;
    const sentences = paragraph.split(/(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|Ph\.D\.|etc\.|e\.g\.|i\.e\.|vs\.|Inc\.|Ltd\.|Co\.|Corp\.|St\.|Ave\.|Blvd\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/);
    let current = '';
    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 <= maxLen) {
        current += (current ? ' ' : '') + sentence;
      } else {
        if (current) chunks.push(current.trim());
        current = sentence;
      }
    }
    if (current) chunks.push(current.trim());
  }
  return chunks;
}

/**
 * بذرةٌ 32-بت من أجزاء الطلب (FNV-1a على UTF-16). النصُّ يدخل بـNFC
 * فشكلان متكافئان للنصّ نفسِه يعطيان البذرةَ نفسَها.
 * @param {Array<string|number>} parts
 */
export function seedFor(parts) {
  const s = parts.map((p) => (typeof p === 'string' ? p.normalize('NFC') : String(p))).join('␟');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — مولِّدٌ صغيرٌ حتميّ في [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `sampleNoisyLatent` الرسميّة لدفعةٍ من عنصرٍ واحد، بمولِّدٍ مبذور ومصفوفاتٍ
 * مسطّحة ([1, dim, len] بالترتيب نفسِه).
 * @param {number} durationSec
 * @param {{ae: {sample_rate: number, base_chunk_size: number},
 *   ttl: {chunk_compress_factor: number, latent_dim: number}}} cfg
 * @param {() => number} rng
 */
export function sampleNoisyLatent(durationSec, cfg, rng) {
  const sampleRate = cfg.ae.sample_rate;
  const chunkSize = cfg.ae.base_chunk_size * cfg.ttl.chunk_compress_factor;
  const dim = cfg.ttl.latent_dim * cfg.ttl.chunk_compress_factor;
  const wavLen = Math.floor(durationSec * sampleRate);
  const latentLen = Math.max(1, Math.floor((wavLen + chunkSize - 1) / chunkSize));
  const validLen = Math.floor((wavLen + chunkSize - 1) / chunkSize);
  const mask = new Float32Array(latentLen);
  for (let t = 0; t < Math.min(validLen, latentLen); t++) mask[t] = 1;
  const xt = new Float32Array(dim * latentLen);
  for (let d = 0; d < dim; d++) {
    for (let t = 0; t < latentLen; t++) {
      const u1 = Math.max(0.0001, rng());
      const u2 = rng();
      xt[d * latentLen + t] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * mask[t];
    }
  }
  return { xt, latentMask: mask, dim, latentLen };
}

const VOICE_COUNT = 10;
const TTL = [50, 256];
const DP = [8, 16];

/**
 * صوتٌ واحدٌ من `voice.bin` (صيغةُ sherpa-onnx، قِيست في المرحلة 1A):
 * رأسٌ من ستّة int64 ‏[10,50,256,10,8,16]، ثم style_ttl للعشرة، ثم style_dp.
 * يُرجع **نسخًا** صغيرة (51 KB) لا نوافذَ على الملفّ — فيُترك الملفُّ للمجمِّع.
 * @param {ArrayBuffer} buffer
 * @param {number} index
 */
export function parseVoice(buffer, index) {
  const view = new DataView(buffer);
  const header = [0, 1, 2, 3, 4, 5].map((i) => Number(view.getBigInt64(i * 8, true)));
  const expect = [VOICE_COUNT, ...TTL, VOICE_COUNT, ...DP];
  if (header.join() !== expect.join()) throw new Error(`voice.bin header ${header.join()} ≠ ${expect.join()}`);
  const ttlSize = TTL[0] * TTL[1];
  const dpSize = DP[0] * DP[1];
  if (buffer.byteLength !== 48 + VOICE_COUNT * (ttlSize + dpSize) * 4) throw new Error('voice.bin size');
  if (!(index >= 0 && index < VOICE_COUNT)) throw new Error(`voice index ${index}`);
  const ttl = new Float32Array(buffer.slice(48 + index * ttlSize * 4, 48 + (index + 1) * ttlSize * 4));
  const dpBase = 48 + VOICE_COUNT * ttlSize * 4;
  const dp = new Float32Array(buffer.slice(dpBase + index * dpSize * 4, dpBase + (index + 1) * dpSize * 4));
  return { ttl, dp, ttlDims: [1, ...TTL], dpDims: [1, ...DP] };
}

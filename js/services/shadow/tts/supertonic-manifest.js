/**
 * LingoLife — بيانُ نموذج Supertonic 3 INT8 المُثبَّت (المرحلة 1A)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * قائمةٌ **مُثبَّتة** بملفّات النموذج: الاسمُ والحجمُ بالبايت وSHA-256
 * لكلّ ملفّ، ومصدرٌ مربوطٌ بـ**رقم إيداعٍ** لا بفرعٍ متحرّك. مديرُ
 * النموذج (`supertonic-model.js`) لا يَعُدّ النموذجَ جاهزًا إلّا إذا
 * طابق كلُّ ملفٍّ هذا البيانَ حرفًا.
 *
 * ⚠️ **المصدر:** مرآةُ sherpa-onnx على Hugging Face
 *    (`csukuangfj2/sherpa-onnx-supertonic-3-tts-int8-2026-05-11`)
 *    @ `cca5a0e6c96e1d2c720986bf7e75fcc81dee3ae4`. وهي بالبايت نفسُ
 *    أرشيف الإصدار `sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2`
 *    الذي قِيس في `scripts/tts-benchmark` (المرحلة 1C): الهاشاتُ الستّة
 *    من نوع LFS تطابق الملفّات المحلّية، و`tts.json` يطابق بهاش git.
 *    الأرشيفُ نفسُه لا يصلح للمتصفّح (bz2 بلا مكتبةٍ لفكّه)، والمرآةُ
 *    تخدم كلَّ ملفٍّ منفردًا مع CORS.
 *
 * ⚠️ **الإصدار = التاريخ + الإيداع.** إصدارٌ جديد يعني بيانًا جديدًا
 *    برقمٍ جديد؛ المديرُ يخزّن كلَّ إصدارٍ في كاشٍ مستقلّ، فلا تختلط
 *    ملفّاتُ إصدارين أبدًا.
 *
 * ⚠️ **صيغُ الملفّات للمرحلة التالية (قِيست لا افتُرضت):**
 *    - `unicode_indexer.bin`: ‏65536 عددًا صحيحًا int32 little-endian،
 *      مطابقٌ عنصرًا بعنصر لـ`unicode_indexer.json` الرسميّ (U+0301 → 146).
 *    - `voice.bin`: رأسٌ من 48 بايتًا = ستّة int64 ‏[10,50,256] ثم [10,8,16]؛
 *      بعده style_ttl لعشرة أصوات (float32، ‏12800 لكلٍّ) ثم style_dp
 *      (128 لكلٍّ). الصوتُ 0 = F1 الرسميّ بالبايت (0–4 = F1–F5، 5–9 = M1–M5).
 *    - `tts.json`: مطابقٌ بالبايت لملفّ النموذج الرسميّ (Supertone/supertonic-3).
 *
 * ⚠️ **الترخيص:** أوزانُ Supertonic 3 تحت ترخيص Supertone
 *    (راجع `LICENSE` في المستودعين)؛ لا تُحزَم مع التطبيق ولا تُنزَّل
 *    إلّا بطلبٍ صريحٍ من المستخدم.
 */

const REPO = 'csukuangfj2/sherpa-onnx-supertonic-3-tts-int8-2026-05-11';
const REVISION = 'cca5a0e6c96e1d2c720986bf7e75fcc81dee3ae4';

/** @param {string} name */
const hfUrl = (name) => `https://huggingface.co/${REPO}/resolve/${REVISION}/${name}`;

/**
 * @typedef {Object} ModelFile
 * @property {string} name     اسمُ الملفّ داخل النموذج (ومفتاحُه في الكاش)
 * @property {number} bytes    الحجمُ المتوقَّع بالضبط
 * @property {string} sha256   SHA-256 سداسيّ صغير الحروف
 * @property {string} url      مصدرُ التنزيل المُثبَّت
 * @property {string} role
 */

/**
 * @typedef {Object} ModelManifest
 * @property {string} modelId
 * @property {string} version
 * @property {{ repo: string, revision: string, archive: string }} source
 * @property {ReadonlyArray<ModelFile>} files
 * @property {number} totalBytes
 */

/** @type {ModelManifest} */
export const SUPERTONIC_MANIFEST = Object.freeze({
  modelId: 'supertonic3-int8',
  version: '2026-05-11+cca5a0e',
  source: Object.freeze({
    repo: `https://huggingface.co/${REPO}`,
    revision: REVISION,
    archive: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2'
      + ' (sha256 82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427)',
  }),
  files: Object.freeze([
    { name: 'tts.json', bytes: 8253, role: 'config',
      sha256: '42078d3aef1cd43ab43021f3c54f47d2d75ceb4e75f627f118890128b06a0d09' },
    { name: 'unicode_indexer.bin', bytes: 262144, role: 'text-indexer',
      sha256: '8402ca48e5189a8950138580b0fff64db6f072f24ac07cd54ba8b2fbb9883b30' },
    { name: 'voice.bin', bytes: 517168, role: 'voice-styles',
      sha256: '67d5209b0ee8ce6c74105ffbe12fe6a7628aea3b4ba2fcb308a4a67938a93ce8' },
    { name: 'duration_predictor.int8.onnx', bytes: 3700147, role: 'onnx',
      sha256: 'c3eb91414d5ff8a7a239b7fe9e34e7e2bf8a8140d8375ffb14718b1c639325db' },
    { name: 'text_encoder.int8.onnx', bytes: 36416150, role: 'onnx',
      sha256: 'c7befd5ea8c3119769e8a6c1486c4edc6a3bc8365c67621c881bbb774b9902ff' },
    { name: 'vector_estimator.int8.onnx', bytes: 78400833, role: 'onnx',
      sha256: '20cd86fa5c6effedfda0e7cffe5b0569ca401c440a0c3a1d72bf39286c0db3fd' },
    { name: 'vocoder.int8.onnx', bytes: 25991073, role: 'onnx',
      sha256: 'e923d60f53f95eb1ce235f1dc33ec56d9c057823c96fa6f8acf98f32b0da6152' },
  ].map((f) => Object.freeze({ ...f, url: hfUrl(f.name) }))),
  /** مجموعُ الأحجام أعلاه — يحرسه اختبارٌ يعيد جمعَها. */
  totalBytes: 145295768,
});

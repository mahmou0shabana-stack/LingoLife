/**
 * LingoLife — PiperProvider: إثباتُ مفهومٍ معزول وصادق (WS41-F، بند 4)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «حقّق: هل يمكن تشغيل Piper عبر ONNX Runtime Web/WASM في المتصفّح؟
 * >  لا تفترض أن تنفيذ Piper الأصليّ يعمل داخل المتصفّح. اصنع إثباتَ
 * >  مفهومٍ معزولًا أوّلًا. اجعل ملفّات التشغيل محلّيّةً حين يمكن. إن
 * >  لم يكن مستقرًّا: لا تُتلف محرّك الشادوينج الرئيسيّ؛ أبقِ Piper
 * >  خلف علَم ميزة، وقُل حدوده.»
 *
 * ═══════════════════════════════════════════════════════════════
 * ما ثبت فعليًّا هنا — بالقياس لا بالافتراض
 * ═══════════════════════════════════════════════════════════════
 *
 * ✅ **ONNX Runtime Web يعمل فعليًّا في هذا المتصفّح من ملفّاتٍ محلّية.**
 *    وُثِّق `vendor/onnxruntime-web/` (13.5MB، مثل حجم Tesseract
 *    المُوثَّق أصلًا)، واختُبر: `InferenceSession.create()` مع بايتات
 *    وهمية أعاد خطأ **تحليل بروتوبفر** لا خطأ **تحميل WASM** — أي أن
 *    محرّك WASM اشتغل وبدأ يقرأ نموذجًا، ورفض البايتاتِ لأنها ليست
 *    نموذج ONNX حقيقيًّا. هذا دليلٌ تجريبيّ، لا تخمين.
 *
 * ❌ **لا نموذج صوتٍ روسيّ يمكن تنزيله من بيئة هذا المحادثة.** كل
 *    أصوات Piper — بلا استثناء — مستضافةٌ على `huggingface.co`، وهذا
 *    النطاق محجوبٌ بالكامل في بيئة التطوير التي كُتب فيها هذا الكود
 *    (403 على كل اتصال). `scripts/vendor-piper.sh` يوثّق الأمر الذي
 *    يشغّله مطوّرٌ بإنترنتٍ كامل ليكمل التنزيل.
 *
 * ❌ **لا محوّل نصٍّ إلى صوتيّاتٍ (phonemizer) مُنفَّذ هنا.** Piper
 *    يحتاج تحويل النصّ الروسيّ إلى تسلسل معرّفات صوتيّاتٍ (عادةً عبر
 *    espeak-ng) قبل أن يدخل النموذج — وهذه منظومةٌ لغويّةٌ كاملة بذاتها،
 *    لا حزمة npm جاهزة لها وُجدت في هذه البيئة. `synthesize()` أدناه
 *    تحقن نقطة `providerOptions.phonemize` بدل أن تخترع تحويلًا ناقصًا:
 *    صوتٌ يبدو روسيًّا وهو مبنيٌّ على صوتيّاتٍ خاطئة أسوأ من رسالة
 *    خطأٍ صادقة (نفس مبدأ «Do NOT fake support»).
 *
 * ⚠️ **ولذلك: خلف علَم ميزة، وغير مسجَّلٍ في `bootstrap.js` افتراضيًّا.**
 *    `isAvailable()` تُرجع دائمًا `MODEL_NOT_DOWNLOADED` في هذا البناء
 *    — صادقةً، لا معطَّلة تعسّفًا.
 *
 * راجع `docs/08-shadowing.md §8.10` والتقرير النهائيّ لبند WS41-F.
 */

import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';

export const PIPER_PROVIDER_ID = 'piper';

/** محلّيًّا أوّلًا — نفس نمط `ocr.js` (Tesseract) بالحرف. */
const LOCAL_RUNTIME_BASE = new URL('../../../../vendor/onnxruntime-web/', import.meta.url).href;
const RUNTIME_ENTRY = 'ort.wasm.min.mjs';

/** هل يستجيب رابطٌ محلّيًّا؟ (نسخةٌ من `ocr.js:exists`.) */
async function exists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

let ortModulePromise = null;

/**
 * يحمّل ONNX Runtime Web — محلّيًّا إن وُجد، وإلا لا شيء (لا CDN هنا
 * عمدًا: Piper خلف علَم ميزة، ولا داعي لمسار شبكةٍ لخاصيّةٍ لم تُفعَّل).
 */
async function loadRuntime() {
  if (ortModulePromise) return ortModulePromise;
  ortModulePromise = (async () => {
    const entry = `${LOCAL_RUNTIME_BASE}${RUNTIME_ENTRY}`;
    if (!(await exists(entry))) {
      throw new Error('runtime-not-vendored');
    }
    const ort = await import(/* @vite-ignore */ entry);
    ort.env.wasm.wasmPaths = LOCAL_RUNTIME_BASE;
    // لا `SharedArrayBuffer` إلا مع عزل المصدر (COOP/COEP) — وهذا
    // التطبيق لا يفرضهما، فخيطٌ واحد أضمن من افتراض توفّرها.
    ort.env.wasm.numThreads = 1;
    return ort;
  })();
  return ortModulePromise;
}

/**
 * أين يُبحث عن نموذج صوتٍ محلّي لهذا المعرّف.
 * `scripts/vendor-piper.sh` يضع الملفّات هنا حين يُشغَّل.
 */
function voicePaths(voiceId) {
  const base = new URL(`../../../../vendor/piper-voices/${voiceId}/`, import.meta.url).href;
  return { model: `${base}model.onnx`, config: `${base}model.onnx.json` };
}

/**
 * @param {{ voiceId?: string }} [options] معرّف صوتٍ افتراضيّ لهذا
 *   المزوّد. صوتٌ واحد يكفي لإثبات المفهوم — تعدّد الأصوات (بند 5)
 *   خطوةٌ لاحقة بعد استقرار صوتٍ واحد فعليًّا.
 * @returns {import('./types.js').TTSProvider}
 */
export function createPiperProvider({ voiceId = 'ru_RU-default-medium' } = {}) {
  return {
    id: PIPER_PROVIDER_ID,
    name: 'Piper — عصبيّ محلّي (تجريبي)',
    type: PROVIDER_TYPE.PIPER,
    supportsOffline: true,
    supportsStreaming: false,
    supportsWord: true,
    supportsSentence: true,
    supportsLongText: false,

    async isAvailable() {
      const runtimeReady = await exists(`${LOCAL_RUNTIME_BASE}${RUNTIME_ENTRY}`);
      if (!runtimeReady) {
        return {
          available: false,
          status: AVAILABILITY.MODEL_NOT_DOWNLOADED,
          reason: 'محرّك ONNX Runtime Web غير مُجهَّز — شغّل scripts/vendor-piper.sh',
        };
      }
      const { model, config } = voicePaths(voiceId);
      const modelReady = (await exists(model)) && (await exists(config));
      if (!modelReady) {
        return {
          available: false,
          status: AVAILABILITY.MODEL_NOT_DOWNLOADED,
          reason: `نموذج الصوت الروسيّ غير منزَّل (${voiceId}) — شغّل scripts/vendor-piper.sh بإنترنتٍ كامل`,
        };
      }
      // ⚠️ الوصول لهنا لم يقع في أيّ اختبارٍ أُجري داخل هذه البيئة —
      //    لا نموذج توفّر لتجربته. راجع رأس الملفّ.
      return {
        available: false,
        status: AVAILABILITY.MODEL_NOT_DOWNLOADED,
        reason: 'نموذجٌ موجودٌ، لكن لا محوّل صوتيّاتٍ (phonemizer) مُوصَّل بعد — مرّره عبر providerOptions.phonemize',
      };
    },

    async getVoices() {
      const { model, config } = voicePaths(voiceId);
      if (!(await exists(model)) || !(await exists(config))) return [];
      return [{ id: voiceId, name: voiceId, language: 'ru' }];
    },

    /**
     * @param {import('./types.js').TTSRequest} request
     * `providerOptions.phonemize` — `(text: string) => Promise<Int32Array>`
     * محقونةٌ من المستدعي؛ هذا الملفّ لا يخمّن صوتيّاتٍ (راجع رأس الملفّ).
     */
    async synthesize({ text, providerOptions = {} } = {}) {
      const fail = (error) => ({
        audioBlob: null, audioUrl: null, playedDirectly: false, duration: null,
        provider: PIPER_PROVIDER_ID, voiceId, cacheKey: null,
        provenance: PROVENANCE.PIPER_GENERATED, cached: false, error,
      });

      const { model, config } = voicePaths(voiceId);
      if (!(await exists(model)) || !(await exists(config))) return fail('model-not-downloaded');
      if (typeof providerOptions.phonemize !== 'function') return fail('phonemizer-not-configured');

      let ort;
      try {
        ort = await loadRuntime();
      } catch {
        return fail('runtime-not-vendored');
      }

      try {
        const configJson = await (await fetch(config)).json();
        const phonemeIds = await providerOptions.phonemize(text, configJson);

        /*
         * ⚠️ **شكل المدخلات هنا يطابق واجهة نماذج Piper المنشورة**
         *    (VITS ONNX: `input`, `input_lengths`, `scales`) — لكنه
         *    **لم يُختبَر بنموذجٍ حقيقيّ في هذه البيئة**، لغياب النموذج
         *    نفسه. أوّل تشغيلٍ حقيقيّ سيكشف أيّ تفاوتٍ في الشكل.
         */
        const session = await ort.InferenceSession.create(await (await fetch(model)).arrayBuffer());
        const inputIds = new BigInt64Array(phonemeIds.map((n) => BigInt(n)));
        const feeds = {
          input: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
          input_lengths: new ort.Tensor('int64', new BigInt64Array([BigInt(inputIds.length)]), [1]),
          scales: new ort.Tensor(
            'float32',
            Float32Array.from([
              providerOptions.noiseScale ?? 0.667,
              providerOptions.lengthScale ?? 1.0,
              providerOptions.noiseScaleW ?? 0.8,
            ]),
            [3]
          ),
        };
        const results = await session.run(feeds);
        const audioTensor = results.output ?? Object.values(results)[0];
        const wavBlob = pcmFloatToWavBlob(audioTensor.data, configJson.audio?.sample_rate || 22050);

        return {
          audioBlob: wavBlob,
          audioUrl: null,
          playedDirectly: false,
          duration: audioTensor.data.length / (configJson.audio?.sample_rate || 22050),
          provider: PIPER_PROVIDER_ID,
          voiceId,
          cacheKey: null,
          provenance: PROVENANCE.PIPER_GENERATED,
          cached: false,
          error: null,
        };
      } catch (err) {
        return fail(`inference-failed: ${err.message || err}`);
      }
    },

    cancel() {
      /* لا توليدَ متزامنًا قابلًا للقطع هنا — استدعاءُ WASM محظوظٌ بمهلته. */
    },
  };
}

/** يغلّف عيّناتٍ عائمة (float32 PCM) بترويسة WAV — بلا اعتماديّة خارجية. */
function pcmFloatToWavBlob(float32Data, sampleRate) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + float32Data.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + float32Data.length * bytesPerSample, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, float32Data.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < float32Data.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

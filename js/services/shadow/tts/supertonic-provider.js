/**
 * LingoLife — SupertonicProvider: نطقٌ عصبيٌّ على الجهاز (المرحلة 1C)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما هو
 * ═══════════════════════════════════════════════════════════════
 *
 * مزوّدٌ بعقد `types.js` نفسِه يلفّ ما بُني في 1A و1B **ولا شيءَ غيرَهما**:
 *   - النموذج: `supertonic-model.js` (Cache Storage، SHA-256، تنزيلٌ صريح).
 *   - التوليد: `supertonic-engine.js` (عاملٌ + ONNX Runtime Web، خيطٌ واحد).
 * ويمرّ كأيّ مزوّدٍ مولِّد بالطريق الوحيد القائم:
 *   `speaker-adapter` ← `synthesizeWithCache` (ذاكرةُ الصوت المولَّد) ← `<audio>`
 *   تحت ملكيّة `audio-bus` — فلا يُشغِّل صوتًا بنفسه أبدًا (`playedDirectly: false`).
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا خلف علَم (`SUPERTONIC_FLAG_KEY`)
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **نفسُ نمط Piper**: لا يسجّله `ensureTTSProvidersRegistered()`؛ تسجيلُه
 *    استدعاءٌ صريح (`registerSupertonicProviderIfFlagged` في bootstrap.js)
 *    لا تفعله الشاشةُ إلّا والإعدادُ مفعَّل — ويُفعَّل من أداة المطوّر
 *    `tools/supertonic-smoke.html` حتى يُثبت التكاملُ على هاتفٍ حقيقيّ.
 *    وحتى بعد تسجيله: لا تنزيلَ إلّا بضغطةٍ في لوحة الصوت.
 *
 * ═══════════════════════════════════════════════════════════════
 * السرعة، والنبر، والإلغاء
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **السرعةُ عند التشغيل لا عند التوليد** — كما لكلّ مزوّدٍ مولِّد
 *    (`playbackRate` في speaker-adapter؛ والجسرُ المحلّيّ يتجاهل `speed`).
 *    فيولَّد بإعداد 1B الثابت (8 خطوات، سرعةُ النموذج 1.05، ضجيجٌ مبذور)،
 *    ويعلن `settingsKey` بهذا الإعداد فلا يصير كلُّ موضعٍ للمنزلق استدلالًا جديدًا.
 *
 * ⚠️ **النصُّ يصل كما هو**: لا نبرَ يُضاف ولا يُنزع، وё لا تُطوى — ما يفعله
 *    تحضيرُ الأصل وحده (NFKD، راجع supertonic-text.js).
 *
 * ⚠️ **`cancel()` منطقيّ** (دلالةُ 1B): الطلبُ الجاري يُرفض فورًا ونتيجتُه
 *    تُرمى ولا تُخزَّن، لكنّ الاستدلالَ الجاري في العامل **لا يُقطع** — يكمل
 *    ثم يُهمَل. الإيقافُ الصلبُ الوحيد `dispose()` (يُنهي العامل).
 */

import { PROVIDER_TYPE, AVAILABILITY, PROVENANCE } from './types.js';
import { getSupertonicModel, MODEL_STATE } from './supertonic-model.js';
import { createSupertonicEngine, ENGINE_STATE } from './supertonic-engine.js';
import { SUPERTONIC_VOICES, SUPERTONIC_INFERENCE } from './supertonic-text.js';

export const SUPERTONIC_PROVIDER_ID = 'supertonic';

/** إعدادٌ في `settings`: مفعَّلٌ ⇒ تسجّل الشاشةُ المزوّد. افتراضيًّا مطفأ. */
export const SUPERTONIC_FLAG_KEY = 'tts.supertonic.enabled';

/** أسماءُ العرض للصوتين المدعومين الآن (0 = F1، 5 = M1 في voice.bin). */
const VOICE_NAMES = { F1: 'F1 · صوتٌ نسائيّ', M1: 'M1 · صوتٌ رجاليّ' };

const MB = 1024 * 1024;
const mb = (n) => `${(n / MB).toFixed(1)} MB`;

/** هل يستطيع هذا المتصفّح تشغيلَ المحرّك أصلًا؟ */
const runtimeSupported = () => typeof Worker === 'function' && typeof WebAssembly === 'object';

/**
 * @param {Object} [options]
 * @param {ReturnType<typeof getSupertonicModel>} [options.model] مديرُ 1A (الافتراضيُّ الوحيد في التطبيق)
 * @param {ReturnType<typeof createSupertonicEngine>} [options.engine] محرّكُ 1B على النموذج نفسِه
 * @param {() => boolean} [options.isRuntimeSupported]
 * @returns {import('./types.js').TTSProvider & { model: object, retry: () => Promise<void>,
 *   deleteModel: () => Promise<object>, dispose: () => Promise<void> }}
 */
export function createSupertonicProvider({
  model = getSupertonicModel(),
  engine = createSupertonicEngine({ model }),
  isRuntimeSupported = runtimeSupported,
} = {}) {
  return {
    id: SUPERTONIC_PROVIDER_ID,
    name: 'Supertonic 3 — على الجهاز',
    type: PROVIDER_TYPE.SUPERTONIC,
    /* هويّةُ النموذج معروفةٌ قبل التوليد — من البيان المُثبَّت نفسِه (راجع types.js). */
    modelId: model.modelId ?? 'supertonic3-int8',
    modelVersion: model.version,
    settingsKey: `steps=${SUPERTONIC_INFERENCE.steps};speed=${SUPERTONIC_INFERENCE.defaultSpeed};noise=seeded-v1`,
    supportsOffline: true,
    supportsStreaming: false,
    supportsWord: true,
    supportsSentence: true,
    supportsLongText: true,
    /** مديرُ النموذج — للوحة الصوت (تنزيل/تحقّق/حذف). */
    model,

    async isAvailable() {
      if (!isRuntimeSupported()) {
        return { available: false, status: AVAILABILITY.UNAVAILABLE_IN_WEB,
          reason: 'هذا المتصفّح لا يدعم WebAssembly أو Web Workers — Supertonic لا يعمل فيه' };
      }
      const s = await model.getStatus();
      if (s.state === MODEL_STATE.UNSUPPORTED) {
        return { available: false, status: AVAILABILITY.UNAVAILABLE_IN_WEB,
          reason: s.error?.message || 'لا يمكن تخزين النموذج في هذا المتصفّح' };
      }
      if (s.state === MODEL_STATE.DOWNLOADING) {
        return { available: false, status: AVAILABILITY.MODEL_DOWNLOADING,
          reason: `جارٍ تنزيل النموذج — ${mb(s.downloadedBytes)} من ${mb(s.totalBytes)}` };
      }
      if (s.state !== MODEL_STATE.READY) {
        const partial = s.state === MODEL_STATE.PARTIAL ? ' — تنزيلٌ سابقٌ لم يكتمل' : '';
        const failed = s.error ? ` — ${s.error.message}` : '';
        return { available: false, status: AVAILABILITY.MODEL_NOT_DOWNLOADED,
          reason: `النموذج غير منزَّل (${mb(s.totalBytes)}) — نزّله من «نموذج Supertonic» في لوحة الصوت${partial}${failed}` };
      }
      if (engine.state === ENGINE_STATE.ERROR) {
        return { available: false, status: AVAILABILITY.ENGINE_FAILED,
          reason: `فشل محرّك Supertonic (${engine.error?.code || 'خطأ'}) — «أعد المحاولة» من «نموذج Supertonic»` };
      }
      return { available: true, status: AVAILABILITY.READY_OFFLINE, reason: `Supertonic 3 على الجهاز — ${model.version}` };
    },

    async getVoices() {
      return Object.keys(SUPERTONIC_VOICES).map((id) => ({ id, name: VOICE_NAMES[id] || id, language: 'ru-RU' }));
    },

    /**
     * ⚠️ `speed` يُتجاهل عمدًا (راجع رأس الملفّ) — والنصُّ يُمرَّر بحرفه.
     * @param {import('./types.js').TTSRequest} request
     */
    async synthesize({ text, voiceId = null } = {}) {
      const voice = voiceId || 'F1';
      const base = {
        audioUrl: null, playedDirectly: false, provider: SUPERTONIC_PROVIDER_ID, voiceId,
        cacheKey: null, provenance: PROVENANCE.SUPERTONIC_GENERATED, cached: false,
      };
      if (!(voice in SUPERTONIC_VOICES)) return { ...base, audioBlob: null, duration: null, error: 'unknown-voice' };
      try {
        const r = await engine.synthesize({ text, voice });
        return { ...base, audioBlob: r.blob, duration: r.duration, error: null };
      } catch (error) {
        return { ...base, audioBlob: null, duration: null, error: error?.code || 'synthesis-failed' };
      }
    },

    cancel() {
      engine.cancel();
    },

    /** «أعد المحاولة» بعد فشل المحرّك: عاملٌ جديدٌ عند الطلب التالي. */
    async retry() {
      await engine.dispose();
    },

    /** يحرّر ذاكرةَ المحرّك (~350 MB) ثم يحذف النموذج — كاشاتُه وحدها (1A). */
    async deleteModel() {
      await engine.dispose();
      return model.delete();
    },

    dispose() {
      return engine.dispose();
    },
  };
}

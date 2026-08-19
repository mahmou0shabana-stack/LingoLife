/**
 * LingoLife — ذاكرة الصوت المولَّد المشتركة (GeneratedAudioCache، WS41)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك (بند 11-14، مُعلَّمٌ CRITICAL في الطلب)
 * ═══════════════════════════════════════════════════════════════
 *
 * > «كل مزوّدات TTS المولَّدة يجب أن تستعمل ذاكرةً واحدة، ولا تُعاد
 * >  توليد نفس النطق أبدًا. تكرار الشادوينج (`repeatCount`) يجب ألّا
 * >  يُنتج توليدًا جديدًا مطلقًا — التكرار يعيد استعمال نفس الملف.»
 *
 * فمفتاح كل تسجيلٍ **هاشٌ حتميّ** من كل ما يؤثّر في الصوت الناتج:
 * النصّ المطبَّع + اللغة + المزوّد + النموذج + الصوت + إعدادات التوليد.
 * نفس المدخلات من أي جلسةٍ أو مشهدٍ أو تكرارٍ تُصيب نفس السجلّ — لا
 * تكرار توليد، ولا نسخٌ متماثلة تتراكم.
 *
 * ⚠️ **وهذه ليست `nativeAudio` رغم تشابه الشكل.** ذاك جدولٌ مصدره
 *    خادمٌ خارجيّ ومفتاحه الكلمة وحدها؛ هذا جدولٌ مصدره مزوّد نطقٍ
 *    محلّي أو جسرٌ تطويريّ ومفتاحه هاشٌ مركّب — لأن نفس النصّ قد
 *    يُولَّد بأكثر من مزوّدٍ أو صوتٍ في آنٍ واحد (بند 10: مختبر A/B/C).
 *
 * ⚠️ **ولا صوت المتصفّح هنا.** `speechSynthesis` ينطق مباشرةً ولا
 *    يُنتج بايتاتٍ قابلةً للتخزين (راجع تعليق `browser-provider.js`) —
 *    فهذه الذاكرة لمزوّداتٍ تُنتج ملفًّا حقيقيًّا فقط: Piper وRHVoice
 *    وXTTS والسحابيّ المستقبليّ.
 */

import { generatedAudio } from '../../../db/repositories.js';
import { normalizeRussian } from '../../../utils/normalization.js';

/** تطبيعٌ بسيط: مسافات موحّدة، بلا حالة أحرف — النطق لا يتغيّر بالتنسيق. */
function normalizeForCache(text, language) {
  const collapsed = (text || '').trim().replace(/\s+/g, ' ');
  return language && language.startsWith('ru') ? normalizeRussian(collapsed) : collapsed.toLowerCase();
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * يحسب مفتاح الذاكرة ونصّه المطبَّع.
 *
 * ⚠️ `settingsKey` نصٌّ يبنيه المستدعي بنفسه (مثلًا `speed=0.8`) لا
 *    كائنًا يُسلسَل هنا — فترتيب مفاتيح كائنٍ غير مضمونٍ بين نداءين،
 *    ونصٌّ صريحٌ من المستدعي أضمن حتميّةً وأبسط تصحيحًا.
 *
 * @param {{text: string, language?: string, providerId: string,
 *   voiceId?: string|null, model?: string|null, settingsKey?: string}} input
 */
export async function computeCacheKey({
  text,
  language = 'ru',
  providerId,
  voiceId = null,
  model = null,
  settingsKey = '',
}) {
  if (!providerId) throw new Error('providerId مطلوب لحساب مفتاح الذاكرة');
  const normalizedText = normalizeForCache(text, language);
  const raw = [normalizedText, language, providerId, model || '', voiceId || '', settingsKey].join('');
  const cacheKey = await sha256Hex(raw);
  return { cacheKey, normalizedText };
}

/**
 * يقرأ من الذاكرة إن وُجد، ويحدّث `lastUsedAt` — القراءة استعمالٌ.
 * @returns {Promise<null|{cacheKey: string, blob: Blob, mimeType: string,
 *   duration: number|null, providerId: string, voiceId: string|null,
 *   provenance: string}>}
 */
export async function getCachedAudio(cacheKey) {
  const record = await generatedAudio.get(cacheKey).catch(() => null);
  if (!record?.blob) return null;
  // تحديثٌ صامت لا يُنتظَر — تسجيل الاستعمال لا يجب أن يُبطئ التشغيل.
  generatedAudio.putRaw({ ...record, lastUsedAt: Date.now() }).catch(() => {});
  return record;
}

/**
 * يخزّن صوتًا مولَّدًا حديثًا.
 *
 * ⚠️ **لا يُستدعى إلا بعد `getCachedAudio` بلا نتيجة.** التخزين نفسه
 *    لا يمنع التوليد — منعُ التوليد المكرَّر مسؤوليّة المستدعي: يسأل
 *    الذاكرة أولًا (بند CRITICAL أعلاه)، ولا يولّد إلا عند غيابٍ حقيقي.
 *
 * @param {{cacheKey: string, normalizedText: string, providerId: string,
 *   voiceId: string|null, model: string|null, language: string,
 *   settingsKey: string, mimeType: string, duration: number|null,
 *   blob: Blob, provenance: string}} entry
 */
export async function putGeneratedAudio(entry) {
  const now = Date.now();
  return generatedAudio.putRaw({
    cacheKey: entry.cacheKey,
    normalizedText: entry.normalizedText,
    providerId: entry.providerId,
    voiceId: entry.voiceId ?? null,
    model: entry.model ?? null,
    language: entry.language || 'ru',
    settingsKey: entry.settingsKey || '',
    mimeType: entry.mimeType || entry.blob?.type || 'audio/wav',
    duration: entry.duration ?? null,
    size: entry.blob?.size ?? 0,
    blob: entry.blob,
    provenance: entry.provenance,
    createdAt: now,
    lastUsedAt: now,
  });
}

/** ماذا يحمل الجهاز من صوتٍ مولَّد، وكم يزن؟ — لواجهة الإعدادات. */
export async function generatedCacheStats() {
  const all = await generatedAudio.getAll().catch(() => []);
  const byProvider = {};
  let bytes = 0;
  for (const record of all) {
    bytes += record.size || record.blob?.size || 0;
    byProvider[record.providerId] = (byProvider[record.providerId] || 0) + 1;
  }
  return { items: all.length, bytes, byProvider };
}

/** يمسح كل الصوت المولَّد — زرٌّ واحد في الإعدادات (بند 15). */
export async function clearGeneratedCache() {
  const all = await generatedAudio.getAll().catch(() => []);
  for (const record of all) await generatedAudio.destroy(record.cacheKey).catch(() => {});
  return all.length;
}

/**
 * توليدٌ يستشير الذاكرة أوّلًا — نقطةٌ واحدة يمرّ منها كلُّ مستدعٍ
 * (محرّك التشغيل عبر `speaker-adapter.js`، ومختبر الأصوات) فلا يتكرّر
 * منطق «اسأل الذاكرة ← فولّد إن غابت ← فخزّن» في أكثر من مكان (بند
 * CRITICAL 11-14).
 *
 * ⚠️ **لمزوّدات النطق المولَّد فقط** — لا يصلح لمزوّدٍ ينطق مباشرةً
 *    (`browser-provider.js`): ذاك لا يُنتج `audioBlob` أصلًا فلا شيء
 *    يُخزَّن، والمستدعي يستدعي `provider.synthesize()` وحدها في تلك
 *    الحالة (راجع تعليق `browser-provider.js`).
 *
 * @param {{provider: object, text: string, language?: string,
 *   voiceId?: string|null, speed?: number}} input
 * @returns {Promise<{blob: Blob|null, provenance: string|null,
 *   cached: boolean, error: string|null}>}
 */
export async function synthesizeWithCache({ provider, text, language = 'ru', voiceId = null, speed = 1 }) {
  const settingsKey = `speed=${speed ?? ''}`;
  const { cacheKey, normalizedText } = await computeCacheKey({
    text, language, providerId: provider.id, voiceId, settingsKey,
  });

  const hit = await getCachedAudio(cacheKey);
  if (hit) return { blob: hit.blob, provenance: hit.provenance, cached: true, error: null };

  const result = await provider.synthesize({ text, language, voiceId, speed });
  if (result.error) return { blob: null, provenance: null, cached: false, error: result.error };
  if (result.audioBlob) {
    await putGeneratedAudio({
      cacheKey, normalizedText, providerId: provider.id, voiceId,
      model: result.metadata?.model ?? null, language, settingsKey,
      mimeType: result.audioBlob.type, duration: result.duration,
      blob: result.audioBlob, provenance: result.provenance,
    }).catch(() => {});
  }
  return { blob: result.audioBlob || null, provenance: result.provenance, cached: false, error: null };
}

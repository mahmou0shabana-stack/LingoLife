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

/**
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **مفتاحُ الذاكرة كان يمحو النطقَ الذي جاء ليحفظه** (WS-VC1B)
 * ═══════════════════════════════════════════════════════════════
 *
 * كان هنا `normalizeRussian(collapsed)` — وهي دالّةُ **بحثٍ وفهرسة**
 * تُسقط النبرَ وتطوي `ё` إلى `е`. قِيس على التنفيذ القائم قبل أن
 * يُغيَّر سطر، بمفاتيحَ محسوبةٍ لا باستنتاجٍ من قراءة الدالّة:
 *
 *     за́мок  → d7f345cf56e4  ┐ نفسُ المفتاح — والمعنيان: قصرٌ وقُفل
 *     замо́к  → d7f345cf56e4  ┘
 *     всё    → 61bf4befaa0f  ┐ نفسُ المفتاح — والمعنيان: كلُّ شيءٍ والجميع
 *     все    → 61bf4befaa0f  ┘
 *     «Э́то за́мок…» / «Э́то замо́к…» → ab5dccbe3ef7  ┐ وعلى مستوى الجملة أيضًا
 *
 * وشاهدٌ موجَبٌ في نفس القياس: «Все пришли́» و«Всё пришло́» يختلفان في
 * أكثرَ من النبر فخرجا متمايزَين — فالمسبارُ يرى الفرقَ حيث يوجد، ثمّ
 * يشهد بأنه معدومٌ في الثلاثة الأولى.
 *
 * ⚠️ **ولا تُصلَح `normalizeRussian` نفسُها.** هي صحيحةٌ حيث تعمل:
 *    البحثُ ومطابقةُ الكلمات وذاكرةُ اللغة تريد «согласова́ние» و
 *    «согласование» كيانًا واحدًا (راجع رأسَها — عطبٌ قِيس وأُصلح).
 *    فالعلاجُ هنا **تطبيعٌ خاصٌّ بالذاكرة**، أضيقُ ما يكفي.
 *
 * وما يفعله هذا التطبيع، ولا شيءَ غيره:
 *   · NFC — فتمثيلان يونيكوديّان لنفس الحرف يلتقيان: حرفُ الــe
 *     الروسيُّ متبوعًا بـU+0308 والحرفُ المركّبُ U+0451 مفتاحُهما واحد،
 *     وكذلك U+0438 مع U+0306 والمركّب U+0439. وهذا توحيدُ **ترميزٍ**
 *     لا توحيدُ نطقٍ — والفرقُ أنّ الأوّل لا يُسقِط حرفًا ولا علامةً.
 *   · قصُّ الأطراف وطيُّ تتابع المسافات إلى واحدة — لا محرّكَ يغيّر
 *     نطقَه لمسافتين بدل واحدة، وهو السلوكُ القائم أصلًا.
 *
 * وما لا يفعله — عمدًا:
 *   · لا يُسقط نبرًا.           · لا يطوي `ё` إلى `е`.
 *   · لا يُزيل ترقيمًا (الفاصلةُ والنقطةُ تصنعان وقفًا مسموعًا).
 *   · **ولا يوحّد حالةَ الأحرف.** كان يفعل (`toLowerCase`)، ولا يفعل
 *     الآن: محرّكاتٌ كثيرةٌ تتهجّى الأحرفَ الكبيرةَ حرفًا حرفًا
 *     («СССР» ≠ «ссср»). وشرطُك: لا يُفترَض أن متشابهَين بصريًّا
 *     ينطقان سواءً عند كلّ مزوّد. والخسارةُ إعادةُ استعمالٍ أقلُّ عند
 *     اختلاف الحالة — وهي الجهةُ الآمنة: **إخفاقُ ذاكرةٍ ثمّ توليدٌ
 *     صحيحٌ خيرٌ من إصابةٍ تُعيد نطقًا خاطئًا**.
 */
function normalizeSynthesisInput(text) {
  return String(text ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

/**
 * إصدارُ صيغةِ المفتاح — بادئةٌ ظاهرةٌ في المفتاح المخزَّن نفسِه.
 *
 * ⚠️ **ولماذا في المفتاح لا في الهاش وحدَه؟** لأن الصفوفَ القديمةَ
 *    (هاشٌ عارٍ من ٦٤ خانة) يجب أن تبقى **مقروءةً ومميَّزةً** في
 *    المخزن: لا تُحذَف، ولا تُرقَّى صامتةً إلى الصيغة الجديدة، ولا
 *    يستطيع البحثُ الجديد أن يُصيبها مصادفةً. ولو خُبِّئ الإصدارُ
 *    داخل الهاش لَانفصلت الصفوفُ فعلًا لكنّها صارت غيرَ مميَّزةٍ
 *    بالنظر — ومطلبُك أن تُوثَّق آثارُها في التخزين.
 *
 * ⚠️ **وترقيةٌ صامتةٌ مستحيلةٌ بنيويًّا**: مفتاحُ الصفّ القديم لا
 *    يساوي أيَّ مفتاحٍ جديد، فهو لا يُقرأ ولا يُكتَب فوقه.
 */
const KEY_FORMAT = 'a2';

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
 * ⚠️ **وهويّةُ النموذج تدخل المفتاح قبل التوليد لا بعده.** ما يُعرَف
 *    بعد عودة المزوّد لا يصلح للمفتاح — المفتاحُ يُحسَب ليُسأل به،
 *    والسؤالُ سابقٌ للجواب. فتُقرأ من المزوّد نفسِه (`modelId`
 *    و`modelVersion`، اختياريّان في العقد) لا من نتيجته.
 *
 * @param {{text: string, language?: string, providerId: string,
 *   voiceId?: string|null, model?: string|null, modelVersion?: string|null,
 *   settingsKey?: string}} input
 */
export async function computeCacheKey({
  text,
  language = 'ru',
  providerId,
  voiceId = null,
  model = null,
  modelVersion = null,
  settingsKey = '',
}) {
  if (!providerId) throw new Error('providerId مطلوب لحساب مفتاح الذاكرة');
  const normalizedText = normalizeSynthesisInput(text);
  const raw = [
    KEY_FORMAT, normalizedText, language, providerId,
    model || '', modelVersion || '', voiceId || '', settingsKey,
  ].join('');
  const cacheKey = `${KEY_FORMAT}-${await sha256Hex(raw)}`;
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
 * ⚠️ **والصفُّ يحفظ الهويّةَ التي دخلت مفتاحَه بعينها** — لا هويّةً
 *    أخرى تُقرأ من مكانٍ آخر. صفٌّ يقول «نموذجي كذا» ومفتاحُه لا يعرفه
 *    كذبةٌ مرتّبة: يُطمئنك عند الفحص وهو يتقاسم مفتاحًا مع غيره.
 *
 * @param {{cacheKey: string, normalizedText: string, providerId: string,
 *   voiceId: string|null, model: string|null, modelVersion?: string|null,
 *   language: string, settingsKey: string, mimeType: string,
 *   duration: number|null, blob: Blob, provenance: string}} entry
 */
export async function putGeneratedAudio(entry) {
  const now = Date.now();
  return generatedAudio.putRaw({
    cacheKey: entry.cacheKey,
    normalizedText: entry.normalizedText,
    providerId: entry.providerId,
    voiceId: entry.voiceId ?? null,
    model: entry.model ?? null,
    modelVersion: entry.modelVersion ?? null,
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
  /*
   * ══════════ هويّةُ النموذج — ما يُعرَف، لا ما يُتمنّى (WS-VC1B) ══════════
   *
   * ⚠️ **كان هنا `result.metadata?.model` — قراءةٌ ميتة.** جردُ V0.1
   *    وجدها، والعقدُ يؤكّدها: `TTSResult` في `types.js` **ليس فيه
   *    حقلُ `metadata` أصلًا**، ولا مزوّدٌ في المستودع يُرجعه. فكانت
   *    تساوي `null` في كلّ نداءٍ منذ كُتبت.
   *
   * ⚠️ **وأسوأُ من موتها موضعُها**: كانت تُقرأ من **نتيجة** التوليد،
   *    والمفتاحُ يُحسَب **قبله**. فلو امتلأت يومًا لَخزّنت الصفَّ تحت
   *    مفتاحٍ لا يعرف النموذجَ الذي كُتب فيه — أي نموذجان يتقاسمان
   *    مفتاحًا واحدًا، وهو بعينه العطبُ المطلوب منعُه.
   *
   * ⚠️ **ولا يُختلَق اسمٌ ولا إصدار.** تُقرأ من المزوّد نفسِه، وهو
   *    معروفٌ قبل التوليد. ولا مزوّدٍ في هذا البناء يعلنهما اليوم:
   *    Piper يشتقّ مسارَ نموذجه من `voiceId` (وهو في المفتاح أصلًا)
   *    ولا يقرأ إصدارًا؛ وجسرُ XTTS عقدُه `/health` يردّ «ok» وحدها
   *    بلا نموذجٍ ولا إصدار؛ والمتصفّحُ لا يمرّ من هنا إطلاقًا. فالقيمةُ
   *    `null` صادقةً — **وهذا حدٌّ مُبلَّغٌ لا ثغرةٌ مُخفاة**: ما دام
   *    المزوّدُ لا يعلن إصدارًا، لا يستطيع المفتاحُ أن يفصل بين
   *    إصدارين منه. ويوم يعلنه، يفصل بلا تغييرٍ آخر.
   */
  const model = provider.modelId ?? null;
  const modelVersion = provider.modelVersion ?? null;
  const { cacheKey, normalizedText } = await computeCacheKey({
    text, language, providerId: provider.id, voiceId, model, modelVersion, settingsKey,
  });

  const hit = await getCachedAudio(cacheKey);
  if (hit) return { blob: hit.blob, provenance: hit.provenance, cached: true, error: null };

  const result = await provider.synthesize({ text, language, voiceId, speed });
  if (result.error) return { blob: null, provenance: null, cached: false, error: result.error };
  if (result.audioBlob) {
    await putGeneratedAudio({
      cacheKey, normalizedText, providerId: provider.id, voiceId,
      model, modelVersion, language, settingsKey,
      mimeType: result.audioBlob.type, duration: result.duration,
      blob: result.audioBlob, provenance: result.provenance,
    }).catch(() => {});
  }
  return { blob: result.audioBlob || null, provenance: result.provenance, cached: false, error: null };
}

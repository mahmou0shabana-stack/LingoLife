/**
 * LingoLife — محاولاتُ صوتي (WS-I · بنود ٨…١٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **بلا هجرة — والسببُ مكتوبٌ هنا لا مُدَّعًى**
 * ═══════════════════════════════════════════════════════════════
 *
 * سُئل أوّلًا: هل تمثّل البنيةُ القائمةُ «محاولةَ نطقٍ لهدفٍ بعينه»؟
 * والجواب نعم، بقطعتين موجودتين:
 *
 *   **البايتات** → صفُّ `media` عاديّ (`kind: 'audio'`). وبذلك يرث
 *   التسجيلُ **كلَّ ما بُني في WS-H مجّانًا**: يُرفَع إلى Drive،
 *   ويُنزَّل كسولًا، ويدخل «نزّل كل الملفّات»، وتُتحقَّق بصمتُه، ويدخل
 *   النسخةَ الكاملة ويُذكَر في الخفيفة. ولو صنعنا له مخزنًا خاصًّا
 *   لَوجب أن نكتب ذلك كلَّه مرّةً ثانية — ولنسيناه في موضعٍ منها.
 *
 *   **النسبة** → صفُّ `practiceEvidence`. المخزنُ موجودٌ منذ v3، وله
 *   فهرسٌ مركّبٌ جاهز: `['target', ['targetType', 'targetId']]`. أي أن
 *   «هاتِ محاولاتِ هذا الهدف» **استعلامٌ مفهرسٌ واحد** لا مسحٌ كامل.
 *
 * فلا مخزنَ ثالث، ولا حقلَ في المخطّط، ولا `SCHEMA_VERSION` يتحرّك.
 * وIndexedDB بلا مخطّطِ أعمدة، فحقولٌ جديدةٌ على صفوفٍ جديدةٍ لا تحتاج
 * ترقيةَ صفوفٍ قديمة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا يُكتَب `text` على صفّ المحاولة — وهذا مقصود**
 * ═══════════════════════════════════════════════════════════════
 *
 * `recentPractice()` تجمع صفوفَ الدليل **بحقل `text`**، و
 * `practiceReality()` تجمع `repetitions`. فلو كتبنا `text` لَظهرت
 * محاولاتُ التسجيل في «آخر ما تدرّبتَ عليه» مكرِّرةً ما هناك، ولَبدت
 * إحصاءاتُ التكرار أكبرَ ممّا حدث.
 *
 * فالنصُّ يُكتَب في `targetText` — تشخيصًا يُقرأ عند العطب، لا هُويّةً
 * ولا مادّةً لإحصاء. و`repetitions: 0` صراحةً.
 */

import { media, practiceEvidence, sceneMediaLinks } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { AUDIO_ROLE } from '../media-service.js';
import { SCOPE, targetKey } from './practice-target.js';

/** نوعُ الهدف في `practiceEvidence` — منفصلٌ عن `shadowSegment`. */
export const VOICE_TARGET_TYPE = 'shadowVoice';

/** نوعُ الممارسة — تمييزٌ داخل المخزن نفسِه. */
export const VOICE_PRACTICE_TYPE = 'voiceAttempt';

/**
 * يحفظ محاولةً — **العمليّةُ الوحيدةُ التي تكتب** (بند ٩).
 *
 * ⚠️ **ولا شيءَ يُكتَب قبل نداء هذه الدالّة.** التسجيلُ والمعاينةُ
 *    يعيشان في الذاكرة و`ObjectURL` وحدَهما، فـ«إلغاء» صفرُ كتابات
 *    بحكم البنية لا بحكم تنظيفٍ نتذكّره (بند ٢٨).
 *
 * @param {object} input
 * @param {File|Blob} input.file بايتاتُ التسجيل كما خرجت من المسجّل.
 * @param {object} input.target لقطةُ الهدف المجمَّدة عند بدء التسجيل.
 * @param {number} [input.durationMs]
 * @returns {Promise<{ok: boolean, mediaId?: string, attemptId?: string, why?: string}>}
 */
export async function saveAttempt({ file, target, durationMs = null }) {
  if (!file || !file.size) return { ok: false, why: 'التسجيل فاضي' };
  if (!target?.key) return { ok: false, why: 'مفيش هدف محفوظ للتسجيل ده' };

  const mime = file.type || 'audio/webm';
  const row = await media.create({
    kind: 'audio',
    blob: file,
    mime,
    filename: file.name || `صوتي-${Date.now()}.webm`,
    bytes: file.size,
    thumbBlob: null,
    width: null,
    height: null,
    durationMs,
    caption: target.text ? `صوتي: ${target.text}` : 'صوتي',
    notes: '',
    /*
     * ⚠️ **ولا بصمةَ تُحسَب هنا.** `media-upload` تحسبها مرّةً عند الرفع
     *    والبايتاتُ مقروءةٌ ساعتها أصلًا (WS-H). وحسابُها الآن يجمّد
     *    الشاشةَ بعد كلّ تسجيلٍ بلا مقابل.
     */
    contentHash: null,
  });

  /*
   * ⚠️ **والربطُ بالذكرى حين تكون هناك ذكرى.** جلسةٌ بلا مشهدٍ (نصٌّ
   *    مؤقّت، مسودّة) تُنتج تسجيلًا صالحًا يُزامَن ويُنسَخ — لكنه لا
   *    يظهر في «ملفّات الذكرى» لأنه لا ذكرى له. وهذا صادقٌ لا نقص.
   */
  if (target.sceneId) {
    await sceneMediaLinks.create({
      sceneId: target.sceneId,
      mediaId: row.id,
      roles: [AUDIO_ROLE.MY_VOICE],
      order: Date.now(),
    }).catch(() => null);
  }

  const attempt = await practiceEvidence.create({
    sessionId: target.sessionId || null,
    targetType: VOICE_TARGET_TYPE,
    targetId: target.key,
    sceneId: target.sceneId || null,
    practiceType: VOICE_PRACTICE_TYPE,

    /* ── النسبةُ إلى الهدف بالضبط (بند ١٣) ── */
    mediaId: row.id,
    scope: target.scope,
    segmentId: target.segmentId || null,
    rangeFrom: target.from ?? null,
    rangeTo: target.to ?? null,
    targetText: target.text || '',
    sourceType: target.sourceType || null,
    sourceId: target.sourceId || null,
    durationMs,

    practicedAt: Date.now(),
    /* ⚠️ صريحةٌ حتى لا تُقرأ إحصاءً — راجع ترويسةَ الملفّ. */
    repetitions: 0,
    meaning: 'recorded',
    impliesRealUsage: false,
    impliesMastery: false,
  });

  return { ok: true, mediaId: row.id, attemptId: attempt.id };
}

/**
 * محاولاتُ هدفٍ بعينه — **استعلامٌ مفهرسٌ واحد** (بند ٣١).
 *
 * ⚠️ **ولا سؤالَ عن كلّ كلمةٍ ولا عن كلّ جملة.** المفتاحُ يحمل النطاقَ
 *    والمدى، فالهدفُ الواحدُ صفٌّ واحدٌ في الفهرس. ولا يُمسَح المخزنُ
 *    كلُّه كما تفعل `practiceReality` — تلك تُجمِّع كلَّ التاريخ مرّةً
 *    في شاشةِ تحليل، وهذه تُنادى كلّما بدّلتَ جملة.
 *
 * @returns {Promise<Array>} من الأحدث إلى الأقدم.
 */
export async function listAttempts(key) {
  if (!key) return [];
  const rows = await practiceEvidence.byIndex('target', [VOICE_TARGET_TYPE, key]);

  /*
   * ⚠️ **وصفُّ الدليل يبقى، والمحذوفُ هو التسجيل.** `trash-service`
   *    يقول صراحةً إن دليلَ الممارسة «مؤرَّخٌ لا يُحذف»، فالحذفُ يقع
   *    على `media` بدلالة السلّة القائمة. وهنا نُخفي المحاولةَ التي
   *    ذهبت بايتاتُها بدل أن نعرض سطرًا يشغّل لا شيء.
   */
  const ids = rows.map((row) => row.mediaId).filter(Boolean);
  const blobs = ids.length ? await media.getMany(ids) : [];
  const alive = new Map(
    blobs.filter((row) => row && row.state !== STATE.TRASHED).map((row) => [row.id, row])
  );

  return rows
    .filter((row) => alive.has(row.mediaId))
    .sort((a, b) => (b.practicedAt || 0) - (a.practicedAt || 0))
    .map((row) => ({
      id: row.id,
      mediaId: row.mediaId,
      media: alive.get(row.mediaId),
      scope: row.scope,
      from: row.rangeFrom,
      to: row.rangeTo,
      text: row.targetText,
      durationMs: row.durationMs,
      createdAt: row.practicedAt,
    }));
}

/**
 * عددُ المحاولات لعدّة أهدافٍ دفعةً — لرسم الشارات بلا N+1.
 *
 * ⚠️ **قراءةٌ واحدةٌ لكلّ الأهداف المعروضة** لا قراءةٌ لكلّ هدف. وهو
 *    نفسُ مبدأ `Living Memory` و`Workspace`: اجمع المفاتيحَ أوّلًا ثم
 *    اقرأ مرّةً.
 */
export async function countByTarget(keys = []) {
  const wanted = new Set(keys.filter(Boolean));
  const out = new Map();
  if (!wanted.size) return out;

  const rows = await practiceEvidence.byIndex('targetType', VOICE_TARGET_TYPE);
  const ids = rows.map((row) => row.mediaId).filter(Boolean);
  const blobs = ids.length ? await media.getMany(ids) : [];
  const alive = new Set(
    blobs.filter((row) => row && row.state !== STATE.TRASHED).map((row) => row.id)
  );

  for (const row of rows) {
    if (!wanted.has(row.targetId) || !alive.has(row.mediaId)) continue;
    out.set(row.targetId, (out.get(row.targetId) || 0) + 1);
  }
  return out;
}

/**
 * مفتاحُ هدفٍ من لقطةٍ محفوظة — يُعاد استعمالُه في العرض والحفظ.
 * غلافٌ رقيقٌ فوق `targetKey` كي لا يستورد أحدٌ الاثنين.
 */
export const keyOfTarget = targetKey;

export { SCOPE };

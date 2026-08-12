/**
 * LingoLife — النصّ الأصلي والنسخة المصحّحة
 *
 * ═══════════════════════════════════════════════════════════════
 * كتلةٌ تُنشأ مع كل ذكرى ولا تعرضها شاشة
 * ═══════════════════════════════════════════════════════════════
 *
 * `contentBlocks.kind = 'rawTranscript'` تُكتب مع كل ذكرى منذ اليوم
 * الأوّل، **ولا يقرؤها أحد**. بحثٌ في `js/views/` كلها لا يجد شاشةً
 * تعرضها؛ القسم الوحيد الذي يقرأ كتلةً هو «ملاحظاتي».
 *
 * وهو **سابع** حقلٍ ميّتٍ في هذا المشروع بعد `peopleIds` و`caption` و
 * `masteryState` و`sourceType` و`topicIds` و`journeyId` — وكلُّها كانت
 * تُكتب «للمستقبل» فلم يقرأها أحد.
 *
 * ⚠️ والملحق في **A5** يعالجه على أنه معروضٌ ويطلب تحديد ارتفاعه:
 *    «النصّ الأصلي الطويل يجعل الصفحة آلاف البكسلات». والحقيقة أنه
 *    **غير موجودٍ أصلًا**. فالمطلوب ليس تحديدَ ارتفاعٍ قائم بل
 *    **إيجاده** — ويُبنى محدودًا من أوّل يوم.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والأصل يُكتب مرّةً ثم يُقفَل — بند 27
 * ═══════════════════════════════════════════════════════════════
 *
 * `saveBlock` ترفض الكتابة فوق `rawTranscript` بعد أن يمتلئ. وهذا
 * ليس تشدّدًا: النصّ الذي كتبتَه ساعتها هو **ما قيل فعلًا**، بأخطائه.
 * وتصحيحُه فوق نفسه يمحو الفرق بين ما قلتَه وما كان ينبغي أن تقوله —
 * وهو الفرق الذي يقوم عليه نصفُ التطبيق: «خطأ/طبيعي»، والتحليل،
 * وحياة التعبير.
 *
 * فالتصحيح **كتلةٌ ثانية** (`cleanTranscript`) تعيش بجانبه، والاثنان
 * يُقرآن معًا.
 */

import { contentBlocks } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { getBlock } from './content-service.js';

export const RAW = 'rawTranscript';
export const CLEAN = 'cleanTranscript';

/**
 * النصّان معًا وحالتُهما.
 *
 * @returns {Promise<{raw, clean, locked:boolean, hasRaw:boolean, hasClean:boolean}>}
 */
export async function transcriptOf(sceneId) {
  const [raw, clean] = await Promise.all([
    getBlock(sceneId, RAW),
    getBlock(sceneId, CLEAN),
  ]);

  const rawText = String(raw?.text || '').trim();
  return {
    raw,
    clean,
    rawText,
    cleanText: String(clean?.text || '').trim(),
    hasRaw: rawText.length > 0,
    hasClean: String(clean?.text || '').trim().length > 0,
    /*
     * ⚠️ القفل يبدأ **بامتلائه** لا بإنشائه. الكتلة تُنشأ فارغةً مع
     *    كل ذكرى، فلو قفلناها عند الإنشاء لما أمكن كتابتُها أبدًا —
     *    وهو ما جعلها ميّتةً بلا شاشةٍ سبعَ سنواتٍ من عمر المشروع.
     */
    locked: Boolean(raw?.locked) && rawText.length > 0,
  };
}

/**
 * يكتب النصّ الأصلي — **مرّةً واحدة**.
 *
 * @throws إن كان مكتوبًا بالفعل، برسالةٍ تقول البديل لا بمنعٍ صامت.
 */
export async function writeRaw(sceneId, text) {
  const state = await transcriptOf(sceneId);
  if (state.locked) {
    throw new Error('النصّ الأصلي اتكتب خلاص ومابيتعدّلش — اعمل نسخة مصحّحة');
  }

  const value = String(text || '').trim();
  await contentBlocks.update(state.raw.id, { text: value });
  return transcriptOf(sceneId);
}

/**
 * يكتب النسخة المصحّحة — وهذه **تُعدَّل بحرّيّة**.
 *
 * ⚠️ ولا تُنشأ إلا بطلبك. نسخةٌ مصحّحة فارغة تُنشأ تلقائيًّا مع كل ذكرى
 *    هي الحقل الميّت الثامن.
 */
export async function writeClean(sceneId, text) {
  const state = await transcriptOf(sceneId);
  await contentBlocks.update(state.clean.id, { text: String(text || '') });
  return transcriptOf(sceneId);
}

/**
 * ⚠️ **التصحيح لا يُقترَح ولا يُولَّد.** التطبيق لا يعرف ما كان ينبغي
 *    أن تقوله، ونسخةٌ «مصحّحة» يكتبها هو تكون أوّلَ كذبةٍ في ملفٍّ
 *    كلُّه شواهد. تُفتَح فارغةً — أو بنسخةٍ من الأصل تعدّلها بنفسك.
 */
export async function seedCleanFromRaw(sceneId) {
  const state = await transcriptOf(sceneId);
  if (state.hasClean) return state;
  return writeClean(sceneId, state.rawText);
}

/** كم ذكرى نصُّها الأصليّ فارغ — للاستوديو، حين يُسجَّل وجهًا. */
export async function scenesWithoutRaw(sceneIds) {
  const rows = await contentBlocks.getAll();
  const filled = new Set(
    rows
      .filter((row) => row.state === STATE.ACTIVE && row.kind === RAW && String(row.text || '').trim())
      .map((row) => row.sceneId)
  );
  return (sceneIds || []).filter((id) => !filled.has(id));
}

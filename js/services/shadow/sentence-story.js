/**
 * LingoLife — قصّةُ الجملة / مشهدُ النقل (WS-SC · التمريرة الثانية)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **القصّةُ أختُ المسودّة لا وريثتُها**
 * ═══════════════════════════════════════════════════════════════
 *
 *     الجملةُ الأصليّة
 *       ├── المسودّة / القطعُ الأساسيّة   (`sentence:draft`)
 *       └── القصّة / مشهدُ النقل          (`sentence:story`)
 *
 * كلتاهما **مادّةٌ مشتقّةٌ** تدور حول الجملة نفسِها، وكلتاهما تُعرَّف
 * بـ**معرّف الجملة الثابت** الذي بُني في التمريرة الأولى. ولا واحدةَ
 * منهما تُبدّل الأخرى.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **أين تسكن القصّة — وقرارُ التخزين ولمَ اتُّخذ**
 * ═══════════════════════════════════════════════════════════════
 *
 * القصّةُ **نصٌّ يُقرأ ويُتدرَّب عليه**. وفي هذا التطبيق للنصّ الذي
 * يُقرأ ويُتدرَّب عليه نموذجٌ واحدٌ قائم: **العقدة** — صفٌّ في `scripts`
 * بـ`sceneId: null` مربوطٌ بأبيه بعلاقة `part:of` (راجع `addNode`).
 *
 * فلا مخزنَ جديدٌ ولا ترقيةَ مخطَّط (بند ٥).
 *
 * ⚠️ **و`sceneId: null` هو بعينه ما يمنع تضخيمَ العدّادات** (بند ٦):
 *    صفحةُ الذكرى تعدّ سكريبتاتِها بـ`scripts.byIndex('sceneId')`، و
 *    IndexedDB **لا تفهرس `null`**. فالقصّةُ غيرُ مرئيّةٍ لأيّ عدٍّ
 *    يقول «كم موقفًا حقيقيًّا عندي». وهذا إخفاءٌ **بحكم البناء** لا
 *    بتصفيةٍ نضيفها ونسهو عنها لاحقًا.
 *
 * ⚠️ **ولا سجلَّ مصدرٍ مكرَّرًا**: القصّةُ عقدةٌ واحدةٌ تحت السكريبت
 *    المصدر، لا نسخةٌ ثانيةٌ منه. و`derivedFromScriptId` تسجّل من أين
 *    جاءت — «المنشأُ يُسجَّل ولا يَحكم» كما في `addNode`.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ومَن يكتب القصّة؟ أنت — في ChatGPT** (بند ٣)
 * ═══════════════════════════════════════════════════════════════
 *
 * لا مولِّدَ قصصٍ هنا ولا شبكةَ ولا مفتاح. التطبيق **يخزّن ويربط
 * ويعرض ويُدرِّب**، وأنت من يذهب ويعود بالنصّ. وهي نفسُ قسمة العمل
 * التي تحكم المسودّة منذ WS25.
 */

import { relationships, scripts } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { link, unlink } from '../link-service.js';
import { addNode } from '../organize-service.js';
import { NODE_KIND } from '../hyperlingual.js';
import { parseDialogue, speakersIn } from '../workspace/speaker-parser.js';
import { sentencesOf, ensureIds, SENTENCE_IDS } from './sentence-identity.js';

/**
 * نوعُ العلاقة: جملةٌ أصليّة ← قصّتُها.
 *
 * ⚠️ **بنفس اصطلاح `sentence:draft` واتّجاهِه**: الأصلُ `fromId`
 *    والمشتقُّ `toId`. فسؤالُ «ما اشتُقّ من هذه الجملة؟» استعلامُ
 *    فهرسٍ واحدٍ لكلا النوعين.
 */
export const SENTENCE_STORY = 'sentence:story';

/** يميّز عقدةَ القصّة عن أيّ عقدةٍ أخرى تحت السكريبت. */
export const STORY_SEMANTIC = 'story';

/**
 * عَلَمُ «ارجع للجملة الأصليّة» في بطاقة المصدر — **ليس مسارًا**.
 *
 * ⚠️ **ولمَ ليس مسارًا؟** لأنّ الجلسةَ الهدفَ غيرُ معروفةٍ وقتَ الرسم:
 *    الرجوعُ يذهب إلى **أحدث جلسةٍ** على النصّ الأصليّ، وقد تُنشأ أو
 *    تُحدَّث بعد رسم البطاقة. فالبطاقةُ تحمل عَلَمًا، والمُعالِجُ يقرّر
 *    وقتَ الضغط. وبذلك يعمل الزرّان القائمان — في البطاقة وفي رأس
 *    الصفحة اليمنى — بلا زرٍّ ثالثٍ ولا مُوجِّهٍ جديد.
 */
export const STORY_BACK = 'story:back';

/** شكلُ القصّة كما يقرؤه العرض — لا كما نتمنّاه. */
export const STORY_SHAPE = Object.freeze({
  /** حوارٌ فيه متحدّثون معلَنون بعلامة `اسم:` */
  DIALOGUE: 'dialogue',
  /** سردٌ متّصل. */
  NARRATIVE: 'narrative',
});

/**
 * وضعُ قراءةِ المتحدّثين في القصص — **الأسماءُ الصريحةُ مقبولةٌ هنا**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ما أمسكه الاختبارُ ولم أكن أتوقّعه**
 * ═══════════════════════════════════════════════════════════════
 *
 * كتبتُ `storyShape` تقرأ بالافتراض المتحفّظ، ثمّ جرّبتُها على حوارٍ
 * روسيٍّ كما يكتبه ChatGPT فعلًا:
 *
 *     Продавец: Здравствуйте!
 *     Клиент: Сколько стоит?
 *
 * فقالت «سرد». والسببُ صحيحٌ في موضعه: المحلّلُ لا يقبل إلّا
 * `Speaker 1:` و`A:` و«المتحدث ١:»، لأنّ سطرًا يبدأ بكلمةٍ ثم نقطتين
 * في نصٍّ ملصوقٍ قد يكون **عنوانًا**. وذاك الحرصُ يخصّ الورشة.
 *
 * أمّا القصّةُ فنصٌّ **طلبتَه حوارًا**، وكاتبُه يسمّي أدوارَه بأسماء.
 * فالوضعُ يُفتَح هنا صراحةً، ويبقى الافتراضُ في كلّ مسارٍ آخر كما هو.
 *
 * ولو تُركت كما كانت لَكان الأثرُ صامتًا: تُحفَظ القصّةُ وتُقرَأ
 * وتُتدرَّب — لكنّ أسماءَ المتحدّثين تضيع في نصٍّ متّصل، وهو **نصفُ
 * معنى الحوار** (نفسُ درسِ لوحة الأصل). عطبٌ لا يُسقِط شيئًا فلا
 * يُبلَّغ عنه أبدًا.
 */
const READ_NAMES = Object.freeze({ named: true });

/**
 * يقرأ شكلَ القصّة من نصِّها — **بالبنية لا بالتخمين**.
 *
 * ⚠️ **ولا يُسأل المستخدم** (بند ٩): علامةُ المتحدّث بنيةٌ ظاهرةٌ في
 *    النصّ يقرؤها المحلّلُ القائم. فسؤالٌ عمّا يمكن قراءتُه استفتاءٌ
 *    على أمرٍ واقع.
 *
 * ⚠️ **والحوارُ يحتاج متحدّثَين على الأقلّ**: سطرٌ واحدٌ فيه نقطتان
 *    قد يكون عنوانًا أو ملاحظة. ومتحدّثٌ واحدٌ سردٌ يتكلّم عن نفسه.
 */
export function storyShape(text) {
  return speakersIn(text, READ_NAMES).length >= 2
    ? STORY_SHAPE.DIALOGUE
    : STORY_SHAPE.NARRATIVE;
}

/**
 * مقاطعُ القصّة جاهزةً لجلسة ظلّ — **بمتحدّثيها إن كانت حوارًا**.
 *
 * ⚠️ **وتُعاد `null` للسرد** عمدًا: عندها يتولّى `createSession`
 *    التقسيمَ بمُقسِّم الجمل القائم (بند ٩)، فلا مُقسِّمَ ثانٍ يُكتَب
 *    هنا ولا يختلف عنه بفاصلة.
 */
export function storySegments(text) {
  if (storyShape(text) !== STORY_SHAPE.DIALOGUE) return null;
  const turns = parseDialogue(text, READ_NAMES).filter((one) => one.text?.trim());
  if (!turns.length) return null;
  return turns.map((one) => ({
    text: one.text.trim(),
    speaker: one.speaker || null,
    /*
     * ⚠️ **ولا يُخمَّن دورُك** (بند ٩): `isMine` تعني «هذا دوري في
     *    التدريب»، وهي اختيارٌ يقع في مدخل المحادثة القائم. وتخمينُها
     *    من الاسم كان سيجعل نصفَ الحوار «دورك» بلا أن تطلب.
     */
    isMine: false,
  }));
}

/**
 * يُنشئ قصّةً لجملةٍ بعينها — **ويربطها بمعرّفها الثابت**.
 *
 * ⚠️ **والمعرّفُ يُولَد هنا إن لم يكن** — بنفس قاعدة `attachDraft`:
 *    الكتابةُ وحدَها تُولّد المعرّفات، والقراءةُ لا تلمس السجلّ
 *    (بند ٦ من التمريرة الأولى).
 *
 * ⚠️ **ولا تُخمَّن الجملةُ بالنصّ** (بند ١٤): المعرّفُ الثابتُ متاحٌ
 *    هنا يقينًا لأنّنا في لحظة كتابة، فلا معنى للرجوع القديم.
 *
 * @param {object} record سجلُّ السكريبت المصدر
 * @param {number} index رقمُ الجملة **في المصدر** لا في الجلسة
 * @param {{title?: string, text: string}} story
 * @param {{updateRecord: Function}} io
 * @returns {Promise<{sentenceId: string, node: object, relation: object}>}
 */
export async function createStory(record, index, { title, text }, { updateRecord }) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('القصّة فاضية — الصق نصّها الأول');

  const { ids, changed } = ensureIds(record);
  const sentenceId = ids[index];
  if (!sentenceId) throw new Error('الجملة دي مش موجودة في النصّ');
  if (changed) await updateRecord(record.id, { [SENTENCE_IDS]: ids });

  const rows = sentencesOf(record);
  const source = rows[index]?.text || '';

  /*
   * ⚠️ **عقدةٌ تحت السكريبت المصدر — لا سكريبتٌ في الذكرى** (بند ٦).
   *    `addNode` تكتب `sceneId: null` وتربط بـ`part:of`، فالقصّةُ
   *    تعيش داخل شجرة مصدرها ولا تُعَدّ موقفًا حقيقيًّا.
   */
  const node = await addNode(record.id, {
    title: (title || `قصّة: ${source.slice(0, 40)}`).trim(),
    text: body,
    nodeKind: NODE_KIND.TRAINING,
    semanticType: STORY_SEMANTIC,
    derivedFromScriptId: record.id,
  });

  const relation = await link(sentenceId, node.id, SENTENCE_STORY);
  return { sentenceId, node, relation };
}

/** يفكّ ارتباطَ قصّةٍ بجملةٍ — ولا يحذف العقدةَ نفسَها. */
export async function detachStory(sentenceId, storyId) {
  return unlink(sentenceId, storyId, SENTENCE_STORY);
}

/**
 * خريطةُ قصص جمل سجلٍّ — **باستعلاماتٍ بعددِ الجملِ الموسومة**.
 *
 * ⚠️ **ولا رجوعَ بالنصّ هنا أصلًا** (بند ١٤): القصّةُ وُلدت بعد
 *    الهُويّة الثابتة، فليس لها ماضٍ تُلتَمس فيه. والرجوعُ القديم
 *    يخصّ المسودّات وحدَها لأنّ لها بياناتٍ سبقت النظام.
 *
 * ⚠️ **وعقدةٌ حُذفت لا تُعرَض شارةً كاذبة**: الحالةُ تُفحَص، والرابطُ
 *    الميّتُ يُتجاهَل بصمت — لأنّ الحذفَ فعلٌ صحيحٌ لا عطب.
 *
 * @returns {Promise<Map<number, object[]>>} رقمُ الجملة ← عُقَدُ قصصها
 */
export async function storyMap(record) {
  const rows = sentencesOf(record);
  const out = new Map();
  const ids = rows.map((one) => one.id).filter(Boolean);
  if (!ids.length) return out;

  /*
   * ⚠️ **استعلامٌ واحدٌ لا واحدٌ لكلّ جملة** — والسببُ قياسٌ لا ذوق.
   *
   *    كانت هنا `Promise.all` على `from_kind` بعددِ الجملِ الموسومة:
   *    مئتا استعلامٍ لنصٍّ فيه مئتا جملة. ومرّ ذلك في قاعدةٍ فارغةٍ
   *    (٣٠٥ms) وسقط في المجموعة الكاملة: **٣٨٩٦ms** — لأنّ كلفةَ
   *    الاستعلام الواحد تكبر مع حجم المخزن، فتُضرَب في مئتين.
   *
   *    والفهرسُ `kind` قائمٌ منذ WS1، فقراءةُ نوعِ العلاقة كلِّه مرّةً
   *    ثمّ التصفيةُ في الذاكرة تُبدّل ٢٠٠×O(سجلّ) بـ١×O(نوع). وهو
   *    نفسُ الإصلاح الذي أعطى `materialForSegments` شكلَها في التمريرة
   *    الأولى — أعِدْ قراءةَ ترويستها.
   */
  const mine = new Set(ids);
  const links = await relationships.byIndex('kind', SENTENCE_STORY);
  const wanted = new Map();
  (links || []).forEach((rel) => {
    if (!rel || rel.state === STATE.TRASHED) return;
    if (!mine.has(rel.fromId)) return;
    if (!wanted.has(rel.fromId)) wanted.set(rel.fromId, []);
    wanted.get(rel.fromId).push(rel.toId);
  });
  if (!wanted.size) return out;

  const all = [...new Set([...wanted.values()].flat())];
  const nodes = new Map(
    (await scripts.getMany(all)).filter((one) => one && one.state === STATE.ACTIVE)
      .map((one) => [one.id, one]),
  );

  rows.forEach((one) => {
    const list = (wanted.get(one.id) || []).map((id) => nodes.get(id)).filter(Boolean);
    if (list.length) out.set(one.index, list);
  });
  return out;
}

/**
 * قصصُ مقاطع جلسةٍ — بنفس مواءمة المسودّات (بند ٨ من التمريرة الأولى).
 *
 * ⚠️ **ورقمُ المقطع ليس رقمَ الجملة**: تُعاد المواءمةُ من
 *    `alignSegmentRows` كي تصحّ الجلسةُ الجزئيّة. وما التبس فيه
 *    المشيان لا يُنسَب إليه شيء.
 */
export async function storiesForSegments(record, segmentTexts) {
  const { alignSegmentRows } = await import('./sentence-material.js');
  const bySentence = await storyMap(record);
  const at = alignSegmentRows(record, segmentTexts);
  const out = new Map();
  at.forEach((row, i) => {
    if (row < 0) return;
    const list = bySentence.get(row);
    if (list?.length) out.set(i, list);
  });
  return out;
}

/**
 * الجملةُ الأمُّ لقصّة — **الطريقُ الراجع** (بندا ٧ و١١).
 *
 * ⚠️ **ولا يُقرأ من `derivedFromScriptId` وحدَه**: هو يقول أيُّ
 *    **سكريبتٍ**، ولا يقول أيُّ **جملة**. والجملةُ هي المطلوبة —
 *    وهي في العلاقة.
 *
 * @returns {Promise<{sentenceId, index, text, record}|null>}
 */
export async function parentSentenceOf(storyId) {
  const rels = await relationships.byIndex('to_kind', [storyId, SENTENCE_STORY]);
  const live = (rels || []).find((one) => one && one.state !== STATE.TRASHED);
  if (!live) return null;

  const node = await scripts.get(storyId);
  const sourceId = node?.derivedFromScriptId;
  if (!sourceId) return null;
  const record = await scripts.get(sourceId);
  if (!record) return null;

  const hit = sentencesOf(record).find((one) => one.id === live.fromId);
  if (!hit) return null;
  return { sentenceId: live.fromId, index: hit.index, text: hit.text, record };
}

/** هل هذا السجلُّ عقدةُ قصّة؟ — تُقرأ في الشادوينج لعرض طريق الرجوع. */
export function isStoryNode(record) {
  return Boolean(record) && record.semanticType === STORY_SEMANTIC;
}

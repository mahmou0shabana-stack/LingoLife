/**
 * LingoLife — طبقةُ تعلّمِ الجملة (WS-SL)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الجملةُ مركزٌ، والمسودّةُ والقصّةُ طبقتان حولها — لا ميزتان**
 * ═══════════════════════════════════════════════════════════════
 *
 * بنينا في التمريرة الأولى **هُويّةَ الجملة**، وفي الثانية **القصّة**
 * بجوار المسودّة. وكانت النتيجةُ صحيحةً في البيانات وخاطئةً في
 * التجربة: شارتان على السطر (`✎` و`▤`) وأداتان في السكّة ولوحان
 * منفصلان — أي **أداتان** لا **طبقتان**.
 *
 * وبلاغُك يسمّي العطبَ بدقّة: «لا تُحسِّن بإضافة أزرارٍ أكثر». فالسطرُ
 * صار مزدحمًا، والمتعلّمُ يفتح ليعرف أيَّ بابٍ يخصّه — وهو بعينه ما
 * أُلغي في التمريرة الأولى حين صارت العلامةُ بابًا.
 *
 * فهذه الوحدةُ **تجمع ولا تُضيف**:
 *
 *     الجملة  =  مركزُ التعلّم
 *       ├── القطعُ الأساسيّة   →  طبقةُ الفهم      (من المسودّة)
 *       ├── مشهدُ النقل        →  طبقةُ الاستعمال  (من القصّة)
 *       ├── الظلّ              →  طبقةُ التدريب    (المحرّك القائم)
 *       └── الأدلّة            →  طبقةُ التقدّم     (المخزن القائم)
 *
 * ⚠️ **ولا مخزنَ جديدٌ ولا نصٌّ يُنسَخ**: القطعُ **مقروءةٌ** من نصّ
 *    المسودّة بمحلّلها القائم، لا محفوظةٌ نسخةً ثانيةً منه. فتحريرُ
 *    المسودّة يغيّر القطعَ في اللحظة نفسِها، ولا يوجد مصدرا حقيقةٍ
 *    يفترقان بعد شهر.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وطبقتان لا تُخلطان: ما وقع، وما قرّرتَه**
 * ═══════════════════════════════════════════════════════════════
 *
 * التقدّمُ هنا شيئان مختلفان، ويُقرآن من مصدرين مختلفين عمدًا:
 *
 *   · **ما وقع فعلًا** — عددُ مرّات التدريب والتسجيلات. يُقرأ من
 *     `practiceEvidence` القائم ولا يُكتَب هنا أبدًا. شهادةٌ لا رأي.
 *
 *   · **ما قرّرتَه أنت** — «هذه القطعةُ خلصت». حكمٌ منك، يُحفَظ حقلًا
 *     على المسودّة نفسِها.
 *
 * ولو خلطناهما لَقال التطبيقُ «أتقنتَ ثمانيًا من اثنتي عشرة» بناءً
 * على أنّك ضغطتَ ▶ ثماني مرّات — وهو ادّعاءُ إتقانٍ من دليلِ استماع.
 * وهذه هي طبقاتُ المشروع الثلاث نفسُها: مصدرٌ، وتحليلٌ، وذاكرةٌ
 * يرعاها المتعلّم.
 */

import { studyDrafts, practiceEvidence } from '../../db/repositories.js';
import { subjectKey, draftPairs } from '../study-draft.js';
import { PAIR_STATUS } from './bilingual.js';
import { SECTION } from './draft-structure.js';

/* ================================================================== *
 * ١) القطعُ الأساسيّة — تُقرأ من بنية المسودّة (بند ٤)
 * ================================================================== */

/**
 * حالةُ القطعة — **حكمُك أنت لا حسابُ التطبيق**.
 *
 * ⚠️ ولا حالةَ رابعة: «بدأت» و«خلصت» يكفيان، و«لم تبدأ» هي الغياب.
 *    حالةٌ لا يغيّرها المتعلّم ولا تغيّر شيئًا زينةٌ في نموذج.
 */
export const CHUNK_STATE = Object.freeze({
  /** لم تُلمَس — الغيابُ نفسُه، ولا يُكتَب. */
  NEW: 'new',
  /** بدأتَها ولم تُنهِها. */
  PRACTICING: 'practicing',
  /** قلتَ أنت إنّها خلصت. */
  DONE: 'done',
});

/**
 * الحقلُ الذي يحمل حالاتِ القطع على سجلّ المسودّة.
 *
 * ⚠️ **حقلٌ جديدٌ بلا ترقية** — بنفس قاعدة `pairs` في WS-D: القارئُ
 *    يسأل «هل هو موجود؟» لا «ما قيمته؟»، والمسودّاتُ القديمة تُقرأ
 *    فارغةَ الحالات ولا تُلمَس.
 */
export const CHUNK_STATES = 'learnChunks';

/**
 * أقسامٌ لا تفتح قطعةً جديدةً بل تُغذّي المفتوحة.
 *
 * ⚠️ **وهذا هو كلُّ الفرق بين «قطعة» و«سطر»**: المثالُ ليس مفردةً
 *    تُتقَن، بل دليلٌ على المفردة التي فوقه. ولو فتح المثالُ قطعةً
 *    لَقال العدّادُ «١٢ قطعة» عن ثلاثِ مفرداتٍ وتسعةِ أمثلةٍ لها.
 */
const FEEDING = new Set([SECTION.EXAMPLES, SECTION.RECALL, SECTION.STRIP]);

/** مفتاحُ القطعة — نصُّها الروسيُّ مطبَّعًا، وهو أثبتُ هُويّةٍ متاحة. */
export function chunkKey(ru) {
  return subjectKey(ru || '');
}

/**
 * يقرأ القطعَ الأساسيّة من مسودّة — **بالبنية لا بالتخمين**.
 *
 * القاعدةُ سطرٌ واحد: **مفردةٌ روسيّةٌ ومعناها يفتحان قطعة**، وكلُّ ما
 * بعدهما حتى القطعة التالية يخصُّهما — شرحًا أو مثالًا أو قالبًا أو
 * سؤالَ استرجاع.
 *
 * ⚠️ **ولماذا يُشترَط المعنى؟** أوّلُ صياغةٍ قالت «سطرٌ روسيٌّ خارجَ
 *    الأمثلة يفتح قطعة»، فصارت **الجملةُ الأصليّةُ نفسُها قطعةً**:
 *    قسمُ «الجملة الأساسية:» يليه فاصلٌ يُنهي القسم، فيصل سطرُها إلى
 *    القراءة بلا قسمٍ وبلا ترجمة. قِستُه على القالب الحقيقيّ: ثلاثُ
 *    قطعٍ لمفردتين.
 *
 *    والشرطُ ليس ترقيعًا لتلك الحالة بل تعريفُ القطعة نفسِه (بند ٤):
 *    قطعةٌ **مفردةٌ ومعناها**. وسطرٌ روسيٌّ بلا معنًى لا يُتعلَّم منه
 *    شيءٌ — سواءٌ كان الجملةَ الأصليّةَ أو سطرًا سائبًا.
 *
 * ⚠️ **ولا NLP ولا شبكة**: المحلّلُ البنيويُّ (WS-D/WS-DR) قرأ الأدوارَ
 *    والأقسامَ بالفعل، وهذه الدالّةُ **تُجمِّع** ناتجَه ولا تُعيد قراءته.
 *    فما أصلحتَه بيدك في المراجعة يصل إلى هنا كما هو.
 *
 * ⚠️ **وما لا رأسَ له لا يُنسَب بالحدس**: مثالٌ قبل أيّ مفردةٍ يُترَك
 *    ولا يُلحَق بما ليس موجودًا.
 *
 * @param {object|string} draftOrText سجلُّ المسودّة أو نصُّها
 * @returns {{key: string, ru: string, ar: string, sense: string[],
 *            examples: {ru: string, ar: string}[], patterns: string[],
 *            recall: {ru: string, ar: string}[]}[]}
 */
export function coreChunks(draftOrText) {
  const units = draftPairs(draftOrText);
  const out = [];
  let open = null;

  const start = (ru, ar) => {
    open = { key: chunkKey(ru), ru, ar: ar || '', sense: [], examples: [], patterns: [], recall: [] };
    out.push(open);
    return open;
  };

  for (const one of units) {
    const status = one?.status;
    const section = one?.section || SECTION.NONE;

    /* الفواصلُ والعناوينُ بنيةٌ لا محتوًى — ولا تُنهي قطعةً مفتوحة. */
    if (status === PAIR_STATUS.DIVIDER || status === PAIR_STATUS.SECTION_HEAD) continue;

    if (status === PAIR_STATUS.TEMPLATE) {
      const raw = String(one.raw || one.ar || '').trim();
      if (raw && open) open.patterns.push(raw);
      continue;
    }

    if (status === PAIR_STATUS.RECALL) {
      if (open && (one.ru || one.ar)) open.recall.push({ ru: one.ru || '', ar: one.ar || '' });
      continue;
    }

    if (status === PAIR_STATUS.NOTE) {
      const said = String(one.ar || '').trim();
      if (said && open) open.sense.push(said);
      continue;
    }

    const ru = String(one?.ru || '').trim();
    if (!ru) continue;
    const ar = String(one.ar || '').trim();

    /* داخلَ الأمثلة: دليلٌ على المفردة المفتوحة، لا مفردةٌ جديدة. */
    if (FEEDING.has(section)) {
      if (open) open.examples.push({ ru, ar });
      continue;
    }
    /* ورأسُ القطعة مفردةٌ **ومعناها** — راجع الترويسة. */
    if (ar) start(ru, ar);
  }

  /* قطعةٌ بلا مفتاحٍ لا تُحفَظ لها حالةٌ ولا تُعَدّ — فلا تُعرَض. */
  return out.filter((one) => one.key);
}

/* ================================================================== *
 * ٢) حالةُ القطعة — حكمُك، على المسودّة نفسِها (بند ٧)
 * ================================================================== */

/** حالاتُ قطعِ مسودّةٍ كما هي محفوظة — خريطةٌ فارغةٌ للقديم. */
export function chunkStates(draft) {
  const saved = draft?.[CHUNK_STATES];
  return saved && typeof saved === 'object' ? saved : {};
}

/**
 * يكتب حالةَ قطعةٍ واحدة — ويحذفها حين تعود إلى «لم تبدأ».
 *
 * ⚠️ **الحذفُ لا الكتابةُ بـ`new`**: الغيابُ هو الحالةُ الابتدائيّة،
 *    فكتابتُها صراحةً تُراكم مفاتيحَ لقطعٍ حُذفت من نصّ المسودّة
 *    وتجعل الحقلَ ينمو بلا سقف.
 */
export async function setChunkState(draftId, key, state) {
  if (!draftId || !key) return null;
  const draft = await studyDrafts.get(draftId);
  if (!draft) return null;

  const next = { ...chunkStates(draft) };
  if (state === CHUNK_STATE.PRACTICING || state === CHUNK_STATE.DONE) next[key] = state;
  else delete next[key];

  return studyDrafts.update(draftId, { [CHUNK_STATES]: next });
}

/**
 * تقدّمُ القطع — **من الحالات وحدَها** (بند ٩).
 *
 * ⚠️ ولا يُخلَط بعدد مرّات التشغيل: «خلصت» حكمُك، و«اتدرّبت» شهادة.
 *    وخلطُهما يجعل ضغطَ ▶ ثماني مرّاتٍ إتقانًا لثماني قطع.
 */
export function chunkProgress(chunks, states = {}) {
  const total = chunks.length;
  let done = 0;
  let practicing = 0;
  for (const one of chunks) {
    const at = states[one.key];
    if (at === CHUNK_STATE.DONE) done += 1;
    else if (at === CHUNK_STATE.PRACTICING) practicing += 1;
  }
  return { total, done, practicing, fresh: total - done - practicing };
}

/* ================================================================== *
 * ٣) الخريطةُ الموحَّدة — سطرٌ واحدٌ يعرف كلَّ ما له (بنود ١، ٣، ١٢)
 * ================================================================== */

/**
 * ما لكلّ مقطعٍ من مادّةِ تعلّم — **قراءةٌ واحدةٌ لا قراءتان**.
 *
 * ⚠️ **ولا استعلامَ لكلّ سطر**: `materialForSegments` و`storiesForSegments`
 *    كلتاهما تقرأ السكريبتَ مرّةً والعلاقاتِ مرّةً ثمّ توائم في
 *    الذاكرة. وهذه تجمع ناتجَهما — فنصٌّ فيه أربعمئة جملةٍ يبقى على
 *    استعلاماته المعدودة.
 *
 * ⚠️ **وعدُّ القطع يُقرأ من نصّ المسودّة الحاضر بالفعل** في ناتج
 *    `materialForSegments` — فلا جلبَ ثانٍ للمسودّات.
 *
 * @returns {Promise<Map<number, object>>} رقمُ المقطع ← ملخّصُ طبقته
 */
export async function learningForSegments(record, segmentTexts, where = {}) {
  const [{ materialForSegments }, { storiesForSegments }] = await Promise.all([
    import('./sentence-material.js'),
    import('./sentence-story.js'),
  ]);

  const [material, stories] = await Promise.all([
    materialForSegments(record, segmentTexts, where),
    storiesForSegments(record, segmentTexts),
  ]);

  const out = new Map();
  const seen = new Set([...material.keys(), ...stories.keys()]);
  for (const i of seen) {
    const hit = material.get(i) || null;
    const chunks = hit?.draft ? coreChunks(hit.draft) : [];
    const progress = chunkProgress(chunks, chunkStates(hit?.draft));
    out.set(i, {
      draft: hit?.draft || null,
      how: hit?.how || null,
      chunks: progress.total,
      done: progress.done,
      stories: (stories.get(i) || []).length,
    });
  }
  return out;
}

/** هل لهذا المقطع أيُّ مادّةِ تعلّمٍ أصلًا؟ — سؤالُ الشارة. */
export function hasLearning(summary) {
  return Boolean(summary) && (summary.chunks > 0 || summary.stories > 0 || Boolean(summary.draft));
}

/* ================================================================== *
 * ٤) الأدلّة — تُقرأ ولا تُكتَب هنا (بندا ٨ و٩)
 * ================================================================== */

/**
 * تسجيلاتُ الصوت على هدفٍ بعينه — **من المخزن القائم**.
 *
 * ⚠️ **ولا نظامَ أدلّةٍ ثانٍ** (بند ٨): `practiceEvidence` مفهرسٌ على
 *    `target`، فالقراءةُ استعلامُ فهرسٍ واحد. وكتابةُ الأدلّة تبقى
 *    حيث هي: في مسجّل الصوت ومحرّك الظلّ.
 *
 * @param {string} targetType نوعُ الهدف كما يكتبه صاحبُه
 * @param {string} targetId مفتاحُ الهدف
 */
export async function evidenceCount(targetType, targetId) {
  if (!targetType || !targetId) return 0;
  const rows = await practiceEvidence.byIndex('target', [targetType, targetId]).catch(() => []);
  return (rows || []).length;
}

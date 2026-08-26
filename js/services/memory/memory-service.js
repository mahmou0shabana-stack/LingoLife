/**
 * LingoLife — ذاكرةُ اللغة الحيّة: القراءة (WS-C)
 *
 * ═══════════════════════════════════════════════════════════════
 * أربعةُ أعدادٍ لا عددٌ غامضٌ اسمه «التكرار» (بند ٨)
 * ═══════════════════════════════════════════════════════════════
 *
 * · **مواضعُ في مصادرك** — من `memoryOccurrences`. واقعةٌ عن نصِّك:
 *   «هذه الصيغةُ مكتوبةٌ في ٧ مواضع». وليست «قابلتَها ٧ مرّات».
 * · **مصادرُ مختلفة** — كم نصًّا مختلفًا يحويها.
 * · **مرّاتُ تدريب** — من `practiceEvidence`، وهي وقائعُ مؤرَّخةٌ
 *   سجّلها التطبيقُ لحظةَ وقوعها.
 * · **أخطاءٌ** — من `mistakeComparisons`.
 *
 * ⚠️ **وقراءةُ الجملة عشرين مرّةً لا تُنتج عشرين موضعًا** (بند ٨):
 *    الموضعُ بصمةٌ ثابتة، والتدريبُ عدّادٌ آخرُ تمامًا. والخلطُ بينهما
 *    هو الكذبُ الذي يمنعه البند بحرفه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وما لا نعرفه يُقال «لا نعرف» (بندا ٢٩ و٦٧)
 * ═══════════════════════════════════════════════════════════════
 *
 * `firstSeen` يُحسَب من **وقائعَ مؤرَّخةٍ حقيقيّة** فقط: يومَ التقطتَها،
 * أو يومَ تدرّبتَ عليها، أو يومَ سجّلتَ غلطةً فيها. ووجودُ الكلمة في
 * سكريبتٍ **لا يعطي تاريخًا** — لأن التطبيق لا يعرف متى قرأتَه.
 *
 * فمَن لا واقعةَ مؤرَّخةً له يعود `firstSeen: null`، والشاشةُ تقول
 * «مش معروف» ولا تخترع يومًا لتبدو ممتلئة.
 */

import {
  memoryOccurrences, savedItems, practiceEvidence, mistakeComparisons,
  expressions, scripts, studyDrafts, conversations, words,
} from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { SAVED_KIND, savedTagLabel } from '../saved-service.js';
import { canonical, ENTITY_KIND, SOURCE_KIND } from './identity.js';

const alive = (rows) => (rows || []).filter((row) => row.state === STATE.ACTIVE);

/* ------------------------------------------------------------------ *
 * الحالةُ المشتقّة — مسمّاةٌ لا مسجَّلة (بند ٩)
 * ------------------------------------------------------------------ */

/**
 * حالاتٌ **بأسماء** لا بدرجاتٍ مبهمة.
 *
 * ⚠️ **ولا «نسبةُ إتقان»**: البندُ ٩ يمنع الدرجاتِ المبهمة، وبند ٢٨
 *    يمنع جمعَ أشياءَ مختلفةٍ في رقمٍ واحد. وكلُّ حالةٍ هنا **شرطٌ
 *    يمكنك أن تقرأه**: «فيها غلطة» تعني أن هناك صفَّ خطأٍ حقيقيًّا.
 */
export const MEMORY_STATUS = Object.freeze({
  NEW: 'new',
  SEEN_AGAIN: 'seen_again',
  SAVED: 'saved',
  PRACTISED: 'practised',
  ERROR_HISTORY: 'error_history',
});

export const STATUS_LABEL = Object.freeze({
  [MEMORY_STATUS.NEW]: 'جديدة',
  [MEMORY_STATUS.SEEN_AGAIN]: 'شوفتها قبل كده',
  [MEMORY_STATUS.SAVED]: 'محفوظة',
  [MEMORY_STATUS.PRACTISED]: 'اتدرّبت عليها',
  [MEMORY_STATUS.ERROR_HISTORY]: 'غلطت فيها',
});

/**
 * أولويّةُ العلامة على الرقاقة (بندا ٢٣ و٦٣).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ علامةٌ واحدةٌ لا خمس — والترتيبُ مكتوبٌ لا مُرتجَل
 * ═══════════════════════════════════════════════════════════════
 *
 * كلمةٌ محفوظةٌ وفيها غلطةٌ وظهرت خمس مرّاتٍ تستحقّ **علامةً واحدة**.
 * وخمسُ علاماتٍ متنافسةٍ على رقاقةٍ عرضُها ٦٠px تجعل الجملةَ قوسَ
 * قزح — وبند ٢٣ يمنع ذلك بالاسم.
 *
 * والترتيب:
 *  ١. **غلطة** — أنت غلطتَ فيها فعلًا، وهذه أولى بانتباهك من أيّ شيء.
 *  ٢. **محفوظة** — قرارٌ منك أنت.
 *  ٣. **متكرّرة** — واقعةٌ عن النصّ لا عنك.
 *
 * ⚠️ **والتكرارُ ليس أهمّيّة** (بند ٦٣): «на» تتكرّر في كلّ جملةٍ ولا
 *    تعني شيئًا. ولذلك هو **آخرُ** الرتب لا أوّلَها، وعتبتُه ثلاثةُ
 *    مصادرَ مختلفةٍ لا ثلاثةُ مواضعَ في نصٍّ واحد.
 */
export const MARK_ORDER = Object.freeze(['error', 'saved', 'recurrent']);

/** عتبةُ «متكرّرة» — مصادرُ مختلفة، لا مواضع. */
export const RECURRENT_SOURCES = 3;

/** العلامةُ الواحدةُ التي تستحقّها هذه الكلمة — أو `null`. */
export function markFor(flags) {
  if (!flags) return null;
  if (flags.errors > 0) return 'error';
  if (flags.saved) return 'saved';
  if (flags.sources >= RECURRENT_SOURCES) return 'recurrent';
  return null;
}

/* ------------------------------------------------------------------ *
 * البحثُ الدفعيّ — قلبُ بند ٤٢
 * ------------------------------------------------------------------ */

/**
 * يجلب علاماتِ **كلّ كلمات الجملة دفعةً واحدة**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا دفعةً — وهذا هو بند ٤٢ بحرفه
 * ═══════════════════════════════════════════════════════════════
 *
 * > «Prefer batch lookup for all words in the current sentence rather
 * >  than one IndexedDB query per chip.»
 *
 * جملةٌ من عشرين كلمةً بأربعة أسئلةٍ لكلّ واحدة (مواضع · محفوظات ·
 * تدريب · أخطاء) = **ثمانون رحلةً** إلى القاعدة في كلّ انتقالِ جملة.
 * وهذه الدالّة تقرأ المستودعاتِ الأربعةَ **مرّةً واحدةً** ثم توزّع.
 *
 * ⚠️ **وتُقرأ مرّةً لكلّ جملة لا مرّةً لكلّ رقاقة** — والشاشةُ تخزّنها
 *    في `Map` تمسحها عند تبديل المقطع. راجع `wordMemoryFlags` في
 *    `shadow-view.js`.
 *
 * @param {string[]} texts صورُ الكلمات كما تُعرَض
 * @returns {Promise<Map<string, {canonical, positions, sources, saved, practised, errors}>>}
 */
export async function flagsForWords(texts) {
  const keys = [...new Set((texts || []).map(canonical).filter(Boolean))];
  const out = new Map();
  if (!keys.length) return out;

  const wanted = new Set(keys);

  /*
   * ⚠️ **أربعُ قراءاتٍ مهما طالت الجملة** — لا أربعٌ لكلّ كلمة.
   *    و`byIndex` على `canonical` تُنادى لكلّ مفتاح، وهي رحلةُ فهرسٍ
   *    رخيصةٌ لا مسحٌ كامل — والفرقُ بينها وبين `getAll()` هو الفرقُ
   *    الذي بُني هذا المخزنُ من أجله.
   */
  const [occRows, savedRows, errorRows, practiceRows] = await Promise.all([
    Promise.all(keys.map((key) => memoryOccurrences.byIndex('canonical', key)))
      .then((groups) => groups.flat()),
    savedItems.getAll(),
    mistakeComparisons.getAll(),
    practiceEvidence.getAll(),
  ]);

  for (const key of keys) {
    out.set(key, {
      canonical: key, positions: 0, sources: 0,
      saved: false, practised: 0, errors: 0,
    });
  }

  const sourcesByKey = new Map(keys.map((key) => [key, new Set()]));
  for (const row of occRows) {
    const entry = out.get(row.canonical);
    if (!entry) continue;
    entry.positions += 1;
    sourcesByKey.get(row.canonical).add(row.sourceKey);
  }
  for (const key of keys) out.get(key).sources = sourcesByKey.get(key).size;

  for (const row of alive(savedRows)) {
    const key = row.normalizedText || canonical(row.text);
    if (wanted.has(key)) out.get(key).saved = true;
  }

  for (const row of alive(errorRows)) {
    /*
     * ⚠️ **الغلطةُ تخصّ كلمةً حين قلنا ذلك صراحةً** — أو حين تحوي
     *    صورتُها الخاطئة/الصحيحة الكلمةَ. ولا اشتقاقَ دلاليًّا هنا.
     */
    const keysOf = new Set([
      row.canonical,
      ...canonical(row.wrong || '').split(' '),
      ...canonical(row.natural || '').split(' '),
    ].filter(Boolean));
    for (const key of keysOf) if (wanted.has(key)) out.get(key).errors += 1;
  }

  for (const row of practiceRows) {
    /*
     * ⚠️ **ولا يُسمَّى `words`** — هذا اسمُ مستودعِ الكلمات المستورَد
     *    أعلى الملفّ، وتظليلُه هنا يجعل قارئًا لاحقًا يظنّ أنه يقرأ
     *    القاعدةَ وهو يقرأ كلماتِ جملة.
     */
    const spoken = new Set(canonical(row.text || '').split(' ').filter(Boolean));
    for (const key of spoken) if (wanted.has(key)) out.get(key).practised += 1;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * ذاكرةُ كيانٍ واحد
 * ------------------------------------------------------------------ */

/**
 * كلُّ ما نعرفه عن كلمةٍ أو مقطعٍ أو جملة — **وقائعُ لا تقديرات**.
 *
 * ⚠️ **ولا يُخترَع تاريخٌ لما لا واقعةَ له** (بندا ٢٩ و٦٧): `firstSeen`
 *    و`lastSeen` يُحسبان من الالتقاط والتدريب والخطأ وحدَها.
 */
export async function entityMemory(text, kind = ENTITY_KIND.WORD) {
  const key = canonical(text);
  if (!key) return null;

  const [occRows, savedRows, practiceRows, errorRows, expressionRows] = await Promise.all([
    memoryOccurrences.byIndex('canonical', key),
    savedItems.byIndex('normalizedText', key),
    practiceEvidence.getAll(),
    mistakeComparisons.getAll(),
    expressions.getAll(),
  ]);

  /* المواضعُ مجمّعةٌ بالمصدر — «فين ظهرت» لا «كام مرّة». */
  const bySource = new Map();
  for (const row of occRows) {
    if (!bySource.has(row.sourceKey)) {
      bySource.set(row.sourceKey, {
        sourceKey: row.sourceKey,
        kind: row.kind,
        sourceId: row.sourceId,
        title: row.sourceTitle,
        sceneId: row.sceneId,
        positions: [],
      });
    }
    bySource.get(row.sourceKey).positions.push({
      /* ⚠️ **المعرِّفُ يمرّ** — بابُ السياق يحتاج ظهورًا بعينه لا مصدرًا. */
      occurrenceId: row.id,
      sentenceIndex: row.sentenceIndex,
      wordIndex: row.wordIndex,
      surface: row.surface,
      sentence: row.sentence,
      /* منشأُ المحادثة — يُعرَض ولا يُفهرَس (بندا ٢٩ و٣٠). */
      speaker: row.speaker || null,
      unitKey: row.unitKey || '',
      unitTranslation: row.unitTranslation || null,
      context: [],
    });
  }
  for (const entry of bySource.values()) {
    entry.positions.sort((a, b) => a.sentenceIndex - b.sentenceIndex || a.wordIndex - b.wordIndex);
  }

  const captures = alive(savedRows);
  const tagIds = [...new Set(captures.flatMap((row) => row.tagIds || []))];

  /* التدريبُ: مطابقةُ الكلمة داخل نصّ المقطع المُتدرَّب عليه. */
  const practised = practiceRows.filter((row) => {
    const words = canonical(row.text || '').split(' ');
    return kind === ENTITY_KIND.WORD ? words.includes(key) : canonical(row.text || '').includes(key);
  });

  const errors = alive(errorRows).filter((row) => {
    if (row.canonical === key) return true;
    const inWrong = canonical(row.wrong || '').split(' ').includes(key);
    const inRight = canonical(row.natural || '').split(' ').includes(key);
    return inWrong || inRight;
  });

  /*
   * ⚠️ **الوقائعُ المؤرَّخةُ وحدَها تصنع تاريخًا** (بند ٢٩).
   *    وجودُ الكلمة في سكريبتٍ ليس واقعةً مؤرَّخة — راجع رأسَ الملفّ.
   */
  const dated = [
    ...captures.map((row) => ({ at: row.createdAt, what: 'saved' })),
    ...practised.map((row) => ({ at: row.practicedAt, what: 'practised' })),
    ...errors.map((row) => ({ at: row.occurredAt || null, what: 'error' })),
  ].filter((one) => Number.isFinite(one.at)).sort((a, b) => a.at - b.at);

  const containing = alive(expressionRows)
    .filter((row) => canonical(row.text || '').split(' ').includes(key))
    .map((row) => ({ id: row.id, text: row.text, meaningAr: row.meaningAr || '' }));

  const flags = {
    positions: occRows.length,
    sources: bySource.size,
    saved: captures.length > 0,
    practised: practised.length,
    errors: errors.length,
  };

  /*
   * ⚠️ **وسياقُ كلّ ظهورٍ يُقرأ — ولا يُخترَع** (WS-C2، بنود ١٧…٢٢).
   *
   *    الوسومُ في `relationships` لا في صفّ الظهور، فتنجو من إعادة
   *    بناء الفهرس. راجع `memory/context.js`.
   *
   * ⚠️ **ويُبتلَع خطؤه**: السياقُ زينةٌ معرفيّة، وتعذُّرُ قراءته لا
   *    يجوز أن يُخفي تاريخَ الكلمة كلَّه.
   */
  let contexts = [];
  try {
    const ctxMod = await import('./context.js');
    const shown = [...bySource.values()].flatMap((one) => one.positions.slice(0, 1));
    await Promise.all(shown.map(async (pos) => {
      const of = await ctxMod.contextOf(pos.occurrenceId);
      pos.context = of.user.map((one) => one.label);
    }));
    contexts = await ctxMod.contextDistribution(occRows);
  } catch { contexts = []; }

  return {
    text: (text || '').trim(),
    canonical: key,
    kind,
    counts: {
      /* ⚠️ أربعةُ أعدادٍ مسمّاةٍ — لا «تكرار» واحدٌ مبهم (بند ٨). */
      positions: occRows.length,
      sources: bySource.size,
      captures: captures.length,
      practices: practised.length,
      errors: errors.length,
    },
    sources: [...bySource.values()],
    captures: captures.map((row) => ({
      id: row.id, at: row.createdAt, note: row.note || '', kind: row.kind,
    })),
    captureTags: await Promise.all(tagIds.map(savedTagLabel)),
    practices: practised
      .map((row) => ({ at: row.practicedAt, repetitions: row.repetitions, source: row.sourceLabel }))
      .sort((a, b) => (b.at || 0) - (a.at || 0)),
    /*
     * ⚠️ **ومع كلّ غلطةٍ تكرارُها وتدريبُها — من وقائعَ مرتبطةٍ لا من
     *    تطابق نصوص** (WS-C2، بندا ٧ و٥٦).
     *
     *    `times` تُحسَب من `patternKey` وحدَه (نفسُ سياسة WS-C
     *    المحافِظة — بند ٣٨). و`practices` من `practiceEvidence
     *    .correctionOf` — أي من **رابطٍ صريح**، فلا تُنسَب إليها
     *    تدريباتٌ على جملةٍ تشبهها في مصدرٍ آخر.
     */
    errors: errors.map((row) => ({
      id: row.id, wrong: row.wrong, natural: row.natural,
      mistakeType: row.mistakeType, at: row.occurredAt || null,
      patternKey: row.patternKey || '', origin: row.origin || null,
      times: row.patternKey
        ? errorRows.filter((other) => other.state === STATE.ACTIVE
          && other.patternKey === row.patternKey).length
        : 1,
      practices: practiceRows.filter((one) => one.correctionOf === row.id).length,
    })),
    expressions: containing,
    /** توزيعُ السياق — **مشتقٌّ ومُعلَنٌ أنه كذلك** (بند ٢٢). */
    contexts,
    /** ⚠️ `null` تعني **لا نعرف** — والشاشةُ تكتبها ولا تخفيها. */
    firstSeen: dated[0]?.at ?? null,
    lastSeen: dated.at(-1)?.at ?? null,
    status: statusOf(flags),
    mark: markFor(flags),
  };
}

/** الحالةُ المشتقّة — من وقائعَ صريحةٍ لا من درجة (بند ٩). */
export function statusOf(flags) {
  if (!flags) return MEMORY_STATUS.NEW;
  if (flags.errors > 0) return MEMORY_STATUS.ERROR_HISTORY;
  if (flags.practised > 0) return MEMORY_STATUS.PRACTISED;
  if (flags.saved) return MEMORY_STATUS.SAVED;
  if (flags.sources > 1 || flags.positions > 1) return MEMORY_STATUS.SEEN_AGAIN;
  return MEMORY_STATUS.NEW;
}

/* ------------------------------------------------------------------ *
 * بيتُ الإثراء — `words` أخيرًا يُكتَب فيه
 * ------------------------------------------------------------------ */

/**
 * يقرأ إثراءَ كيان — أو `null`.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا `words` لا مخزنٌ جديد
 * ═══════════════════════════════════════════════════════════════
 *
 * `words` بيتُ الكلمة منذ v1 و`normalizedText` فيه **فريد** — وهو
 * بالضبط ما يحتاجه الإثراء: صفٌّ واحدٌ لكلّ صيغة. وكان فارغًا لأن
 * `lemma`/`pos` تحتاجان صرفًا لا نملكه (WS5)، لا لأنه بيتٌ خطأ.
 *
 * ⚠️ **و`lemma`/`pos` يبقيان فارغَين**: الإثراءُ يصف الاستعمال
 *    (مستوى · مجال · ملاحظة) ولا يدّعي تحليلًا صرفيًّا. وقبولُ `lemma`
 *    من تحليلٍ خارجيّ يعني تصديقَ ادّعاءٍ لغويٍّ لا نستطيع التحقّق منه
 *    (بند ٦٨ في WS-C).
 *
 * ⚠️ **والإثراءُ حقلٌ داخل الصفّ لا صفٌّ ثانٍ**: فلا يمكن أن يوجد
 *    إثراءٌ يتيمٌ بلا كيان.
 */
export async function readEnrichment(key) {
  const canon = canonical(key);
  if (!canon) return null;
  const [row] = await words.byIndex('normalizedText', canon);
  return row ? { enrichment: row.enrichment || null, row } : { enrichment: null, row: null };
}

/**
 * يكتب إثراءَ كيان — **استبدالٌ بمفتاحه لا إضافة** (بند ١٥).
 *
 * ⚠️ وحتميُّ التكرار بحكم البنية: نفسُ `normalizedText` يجد نفسَ الصفّ
 *    فيُحدَّث. فاستيرادُ الملفّ مرّتين لا يُنتج صفَّين.
 */
export async function writeEnrichment(key, enrichment) {
  const canon = canonical(key);
  if (!canon) return null;
  const [row] = await words.byIndex('normalizedText', canon);
  if (row) return words.update(row.id, { enrichment });
  return words.create({
    text: String(key || '').trim(),
    normalizedText: canon,
    /* ⚠️ فارغان عمدًا — راجع الشرحَ فوق `readEnrichment`. */
    lemma: null,
    pos: null,
    enrichment,
  });
}

/** مفاتيحُ الكيانات المعروفة — يقرؤها المستوردُ ليرفض المجهول (بند ١٨). */
export async function knownCanonicals() {
  const [occRows, savedRows, wordRows] = await Promise.all([
    memoryOccurrences.getAll(),
    savedItems.getAll(),
    words.getAll(),
  ]);
  return new Set([
    ...occRows.map((row) => row.canonical),
    ...alive(savedRows).map((row) => row.normalizedText || canonical(row.text)),
    ...wordRows.map((row) => row.normalizedText),
  ].filter(Boolean));
}

/* ------------------------------------------------------------------ *
 * اللوحة والمكتبة
 * ------------------------------------------------------------------ */

/**
 * ملخّصُ ذاكرة اللغة — أرقامٌ يقف خلف كلٍّ منها ما يفسّره.
 *
 * ⚠️ **ولا رقمَ زينة** (بند ٢٠): كلُّ عددٍ هنا يُشتقّ من صفوفٍ حقيقيّة،
 *    والصفرُ يُعرَض حين يكون صادقًا.
 */
export async function memoryOverview({ limit = 12 } = {}) {
  const [occRows, savedRows, errorRows, practiceRows, scriptRows, draftRows, convRows] =
    await Promise.all([
      memoryOccurrences.getAll(),
      savedItems.getAll(),
      mistakeComparisons.getAll(),
      practiceEvidence.getAll(),
      scripts.getAll(),
      studyDrafts.getAll(),
      conversations.getAll(),
    ]);

  const byForm = new Map();
  for (const row of occRows) {
    if (!byForm.has(row.canonical)) {
      byForm.set(row.canonical, { canonical: row.canonical, surface: row.surface, positions: 0, sources: new Set() });
    }
    const entry = byForm.get(row.canonical);
    entry.positions += 1;
    entry.sources.add(row.sourceKey);
  }

  const saved = alive(savedRows);
  const errors = alive(errorRows);

  const recurring = [...byForm.values()]
    .map((one) => ({ ...one, sources: one.sources.size }))
    /* ⚠️ الترتيبُ بعدد **المصادر** لا المواضع — راجع `MARK_ORDER`. */
    .filter((one) => one.sources >= 2)
    .sort((a, b) => b.sources - a.sources || b.positions - a.positions)
    .slice(0, limit);

  return {
    index: {
      forms: byForm.size,
      positions: occRows.length,
      sources: new Set(occRows.map((row) => row.sourceKey)).size,
      /* ما يمكن فهرستُه — فيُقارَن بما فُهرِس فعلًا. */
      indexable: alive(scriptRows).filter((r) => (r.text || '').trim()).length
        + alive(draftRows).filter((r) => (r.text || '').trim()).length
        + alive(convRows).length,
      /*
       * ⚠️ **تفصيلٌ بالنوع — ومواضعُ ومصادرُ لا رقمٌ يخلطهما** (بند ٦٤).
       *    محادثةٌ فيها الكلمةُ ثلاثًا = ٣ مواضع في **مصدرٍ واحد**.
       */
      byKind: kindBreakdown(occRows),
    },
    saved: {
      total: saved.length,
      words: saved.filter((row) => row.kind === SAVED_KIND.WORD).length,
      phrases: saved.filter((row) => row.kind === SAVED_KIND.PHRASE).length,
      sentences: saved.filter((row) => row.kind === SAVED_KIND.SENTENCE).length,
    },
    practice: {
      events: practiceRows.length,
      /* ⚠️ «مرّاتُ تدريب» لا «إتقان» — الصفُّ نفسُه يقول `impliesMastery: false`. */
      lastAt: practiceRows.reduce((max, row) => Math.max(max, row.practicedAt || 0), 0) || null,
    },
    errors: {
      total: errors.length,
      patterns: new Set(errors.map((row) => row.patternKey).filter(Boolean)).size,
      recurring: countRecurring(errors),
    },
    recurring,
  };
}

/** مواضعُ ومصادرُ لكلّ نوعِ مصدر — **عددان مختلفان لا واحد**. */
function kindBreakdown(rows) {
  const out = {};
  for (const row of rows) {
    if (!out[row.kind]) out[row.kind] = { positions: 0, sources: new Set() };
    out[row.kind].positions += 1;
    out[row.kind].sources.add(row.sourceKey);
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, { positions: v.positions, sources: v.sources.size }])
  );
}

/** كم نمطَ خطأٍ وقع أكثرَ من مرّة — تكرارٌ صريحٌ لا تشابهٌ مظنون. */
function countRecurring(errors) {
  const byPattern = new Map();
  for (const row of errors) {
    if (!row.patternKey) continue;
    byPattern.set(row.patternKey, (byPattern.get(row.patternKey) || 0) + 1);
  }
  return [...byPattern.values()].filter((n) => n > 1).length;
}

/**
 * مكتبةُ الكيانات — بحثٌ وتصفية (بندا ٢١ و٦٤).
 *
 * ⚠️ **والبحثُ لا يطلب منك كتابةَ النبر** (بند ٦٤): الاستعلامُ يمرّ
 *    بـ`canonical` وهي تُسقط العلامة. فكتابةُ «согласование» تجد
 *    «согласова́ние» — وقد كانت لا تجدها قبل إصلاح `normalizeRussian`.
 */
export async function searchMemory(query, { kind = null, status = null, limit = 60 } = {}) {
  const key = canonical(query || '');
  const [occRows, savedRows, errorRows, practiceRows] = await Promise.all([
    memoryOccurrences.getAll(),
    savedItems.getAll(),
    mistakeComparisons.getAll(),
    practiceEvidence.getAll(),
  ]);

  const forms = new Map();
  const add = (canon, surface, patch) => {
    if (!canon) return;
    if (!forms.has(canon)) {
      forms.set(canon, {
        canonical: canon, surface: surface || canon, kind: ENTITY_KIND.WORD,
        positions: 0, sources: new Set(), saved: false, practised: 0, errors: 0,
      });
    }
    Object.assign(forms.get(canon), patch || {});
  };

  for (const row of occRows) {
    add(row.canonical, row.surface, {});
    const entry = forms.get(row.canonical);
    entry.positions += 1;
    entry.sources.add(row.sourceKey);
  }

  /* المحفوظاتُ كياناتٌ ولو لم تظهر في نصٍّ مفهرَس (بند ٣١). */
  for (const row of alive(savedRows)) {
    const canon = row.normalizedText || canonical(row.text);
    add(canon, row.text, { saved: true, kind: kindOfSaved(row.kind) });
  }

  for (const row of alive(errorRows)) {
    const canon = row.canonical || canonical(row.natural || '');
    if (!canon) continue;
    add(canon, row.natural || canon, {});
    forms.get(canon).errors += 1;
  }

  for (const row of practiceRows) {
    for (const word of new Set(canonical(row.text || '').split(' ').filter(Boolean))) {
      if (forms.has(word)) forms.get(word).practised += 1;
    }
  }

  let list = [...forms.values()].map((one) => ({
    ...one,
    sources: one.sources.size,
    status: statusOf({
      positions: one.positions, sources: one.sources.size,
      saved: one.saved, practised: one.practised, errors: one.errors,
    }),
  }));

  if (key) list = list.filter((one) => one.canonical.includes(key));
  if (kind) list = list.filter((one) => one.kind === kind);
  if (status) list = list.filter((one) => one.status === status);

  return list
    .sort((a, b) => b.errors - a.errors || b.sources - a.sources || b.positions - a.positions)
    .slice(0, limit);
}

function kindOfSaved(savedKind) {
  if (savedKind === SAVED_KIND.PHRASE) return ENTITY_KIND.PHRASE;
  if (savedKind === SAVED_KIND.SENTENCE) return ENTITY_KIND.SENTENCE;
  return ENTITY_KIND.WORD;
}

export { ENTITY_KIND, SOURCE_KIND, canonical };

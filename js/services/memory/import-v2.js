/**
 * LingoLife — استيرادُ نتيجة التحليل بعد التحقّق (WS-J · بنود ١٢ و١٣ و٢٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **التحليلُ مقترِحٌ، والتطبيقُ شاهد — ولا يُعكَس الدوران**
 * ═══════════════════════════════════════════════════════════════
 *
 * ما يعود من التحليل **ادّعاءٌ لا واقعة**. وأخطرُ ما فيه ليس الخطأَ
 * اللغويّ — ذاك تراه وتصحّحه — بل **الاستشهادُ المخترَع**: أن يقول
 *
 *     «согласование ظهرت ١٢ مرّة، منها في script:SCR_77 المقطع 3»
 *
 * وهو مقطعٌ لا وجودَ له، أو نصٌّ لا تحوي كلمتَه أصلًا. فيدخل رقمٌ
 * كاذبٌ قاعدتَك بصفةِ «دليل»، ويصير بعد شهرٍ حقيقةً لا يذكر أحدٌ من
 * أين جاءت.
 *
 * ولذلك **كلُّ استشهادٍ يُفتَح على نصّه قبل أن يُخزَّن**:
 *
 *   · `sourceKey` لا بدّ أن يكون مصدرًا موجودًا عندك الآن؛
 *   · `segmentId` لا بدّ أن يكون مقطعًا في ذلك المصدر بعينه؛
 *   · والنصُّ المقتبَس لا بدّ أن يكون **في** ذلك المقطع حرفًا بحرف.
 *
 * وما سقط من هذه الثلاثة **لا يُخزَّن أبدًا** — ولو وافقتَ على العنصر
 * نفسه. فالعنصرُ رأيٌ لك أن تقبله، والاستشهادُ ادّعاءٌ عن نصِّك أنت،
 * وهذا لا يُقبَل بالموافقة بل بالمطابقة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والعدُّ يُعاد لا يُصدَّق** (بند ١٣)
 * ═══════════════════════════════════════════════════════════════
 *
 * حين يقول التحليلُ «١٢»، يعدّ التطبيقُ بنفسه في النصوص التي يملكها
 * (`counting.js`). فإن اتّفقا سُجِّل «متطابق»، وإن اختلفا **لم يُختَر
 * أحدُهما بصمت**: يُعرَض الرقمان ومواضعُ الفرق، ويُخزَّن عددُ التطبيق
 * لأنه محسوبٌ من نصٍّ يُفتَح، ويبقى ادّعاءُ التحليل مسجَّلًا بجانبه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وحقولٌ ليست من شأن التحليل أصلًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * `FORBIDDEN` ليست حقولًا «غيرَ مدعومة» — بل حقولٌ يملكها التطبيقُ
 * وحدَه: كم مرّةً تدرّبتَ، ومتى قابلتَ الكلمةَ أوّلَ مرّة، وكم موقفًا
 * حقيقيًّا فيها. ولو قبِلناها من التحليل لَصار البندُ ٢ حبرًا: يكفي
 * أن يكتب `realSituations: 34` ليصير الرقمُ في قاعدتك.
 *
 * فتُسقَط — **وتُعرَض أنها أُسقِطت**، لأن محاولةَ كتابتها معلومةٌ عن
 * التحليل تستحقّ أن تراها.
 */

import { analysisItems, analysisEvidence } from '../../db/repositories.js';
import { EVIDENCE } from './provenance.js';
import { listSources, readLiveSources, markAnalyzed } from './source-registry.js';
import { countLemma, measure, verify, VERIFY } from './counting.js';

export const RESULT_FORMAT = 'living-language-analysis';
export const RESULT_VERSION = 2;

/** أنواعُ العناصر التي يقبلها المخزن. */
export const ITEM_TYPE = Object.freeze({
  WORD: 'word',
  EXPRESSION: 'expression',
  SENTENCE: 'sentence',
  PATTERN: 'pattern',
  FAMILY: 'family',
});

export const ITEM_TYPE_LABEL = Object.freeze({
  [ITEM_TYPE.WORD]: 'كلمة',
  [ITEM_TYPE.EXPRESSION]: 'تعبير',
  [ITEM_TYPE.SENTENCE]: 'جملة',
  [ITEM_TYPE.PATTERN]: 'تركيب',
  [ITEM_TYPE.FAMILY]: 'عائلة',
});

/**
 * حقولٌ يملكها التطبيقُ ولا يكتبها تحليلٌ أبدًا — راجع الترويسة.
 */
export const FORBIDDEN = Object.freeze([
  'realSituations', 'rawOccurrences', 'derivedAppearances', 'unknownOccurrences',
  'occurrences', 'occurrenceCount', 'total',
  'practiceCount', 'timesUsed', 'usageCount', 'frequency',
  'firstSeenAt', 'lastSeenAt', 'lastUsedAt', 'seenAt', 'createdAt', 'updatedAt',
  'mistakeCount', 'mistakes', 'reviewCount', 'masteryLevel', 'level',
  'contentHash', 'analyzedHash', 'evidenceClass', 'originType',
]);

/** الحقولُ الوصفيّةُ المسموحُ للتحليل بكتابتها. */
export const ALLOWED_FIELDS = Object.freeze([
  'lemma', 'surface', 'pos', 'senseId', 'senseLabel', 'familyId', 'forms',
  'gender', 'aspect', 'animacy', 'register', 'domain', 'government',
  'meaningAr', 'usageNote', 'notes', 'confidence',
]);

/** حكمُ المراجعة على عنصرٍ واحد. */
export const VERDICT = Object.freeze({
  /** مُسنَدٌ كلُّه، وعددُه متطابقٌ أو غيرُ مُدَّعًى. */
  CLEAN: 'clean',
  /** خلافٌ في العدّ، أو أدلّتُه كلُّها من مصادرَ غيرِ مصنَّفة. */
  REVIEW: 'review',
  /** فيه استشهادٌ لا يصمد على النصّ — يُعرَض ولا يُقبَل بالافتراض. */
  BLOCKED: 'blocked',
});

export const VERDICT_LABEL = Object.freeze({
  [VERDICT.CLEAN]: 'سليم',
  [VERDICT.REVIEW]: 'محتاج مراجعة',
  [VERDICT.BLOCKED]: 'استشهاد ما ثبتش',
});

/* ------------------------------------------------------------------ *
 * التحليلُ النصّيّ للملفّ
 * ------------------------------------------------------------------ */

/** يُطبِّع نصًّا للمقارنة الحرفيّة — مسافاتٌ وحالةُ أحرف. */
const flat = (text) => String(text ?? '')
  .replace(/́/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

/**
 * يقرأ ملفَّ النتيجة ويفصل ما لا يُقبَل — **ولا يلمس قاعدةَ البيانات**.
 *
 * ⚠️ **ويرفض الملفَّ كلَّه إن لم يكن من صيغتنا.** لصقُ ردٍّ نصّيٍّ من
 *    محادثةٍ («طبعًا! إليك التحليل: {…}») شائعٌ جدًّا، فنقول ذلك
 *    صراحةً بدل أن نرمي خطأَ JSON غامضًا.
 *
 * @param {string|object} input
 * @returns {{items: object[], removed: object[], analyzedSources: string[],
 *            dropped: object[], warnings: string[], part: number, parts: number}}
 */
export function parseAnalysis(input) {
  let doc = input;
  if (typeof input === 'string') {
    const text = input.trim();
    if (!text) throw new Error('مفيش حاجة اتلصقت.');
    try {
      doc = JSON.parse(text);
    } catch {
      /*
       * ⚠️ ومحاولةُ «إنقاذ» JSON من داخل كلامٍ محيطٍ مرفوضة: لو التقطنا
       *    أوّلَ `{` وآخرَ `}` لَقبِلنا نصفَ ملفٍّ مبتورٍ بصمت.
       */
      throw new Error('ده مش JSON صالح. انسخ الردّ كامل من غير أي كلام حواليه.');
    }
  }
  if (!doc || typeof doc !== 'object') throw new Error('الملفّ فاضي أو مش صالح.');
  if (doc.format !== RESULT_FORMAT) {
    throw new Error(`الملفّ ده مش نتيجة تحليل (${doc.format || 'بلا صيغة'}).`);
  }
  if (Number(doc.version) !== RESULT_VERSION) {
    throw new Error(`إصدار مش مدعوم: ${doc.version}. المطلوب ${RESULT_VERSION}.`);
  }

  const dropped = [];
  const warnings = [];
  const items = [];

  for (const raw of Array.isArray(doc.items) ? doc.items : []) {
    if (!raw || typeof raw !== 'object') continue;
    const key = String(raw.key || '').trim();
    const itemType = String(raw.itemType || '').trim();
    if (!key) { warnings.push('عنصر بلا مفتاح اتشال.'); continue; }
    if (!Object.values(ITEM_TYPE).includes(itemType)) {
      warnings.push(`نوع مش معروف (${itemType || 'بلا نوع'}) للعنصر ${key}.`);
      continue;
    }

    /* ── الحقولُ الممنوعة: تُسقَط وتُعرَض ── */
    for (const field of FORBIDDEN) {
      if (raw[field] === undefined) continue;
      dropped.push({ key, field, value: raw[field] });
    }

    const clean = { key, itemType };
    for (const field of ALLOWED_FIELDS) {
      if (raw[field] !== undefined) clean[field] = raw[field];
    }
    clean.forms = [...new Set(
      [clean.lemma, clean.surface, ...(Array.isArray(clean.forms) ? clean.forms : [])]
        .map((one) => String(one || '').trim())
        .filter(Boolean)
    )];
    /*
     * ⚠️ **والعددُ المُدَّعى يُقرأ ولا يُخزَّن حقلَ عدّ.** اسمُه `claimedCount`
     *    عمدًا: لا يُقرأ يومًا على أنه «كم مرّة». وهو الطرفُ الثاني في
     *    المقارنة لا نتيجتُها.
     */
    clean.claimedCount = Number.isFinite(raw.claimedCount) ? Number(raw.claimedCount) : null;

    clean.evidence = (Array.isArray(raw.evidence) ? raw.evidence : [])
      .filter((one) => one && typeof one === 'object')
      .map((one) => {
        for (const field of FORBIDDEN) {
          if (one[field] !== undefined) dropped.push({ key, field: `evidence.${field}`, value: one[field] });
        }
        return {
          sourceKey: String(one.sourceKey || '').trim(),
          segmentId: String(one.segmentId || '').trim(),
          quote: String(one.quote || ''),
          note: one.note ? String(one.note) : null,
        };
      });

    items.push(clean);
  }

  const removed = (Array.isArray(doc.removed) ? doc.removed : [])
    .filter((one) => one && one.key)
    .map((one) => ({ key: String(one.key), reason: String(one.reason || 'unspecified') }));

  const analyzedSources = [...new Set(
    (Array.isArray(doc.analyzedSources) ? doc.analyzedSources : [])
      .map((one) => String(typeof one === 'string' ? one : one?.sourceKey || '').trim())
      .filter(Boolean)
  )];

  return {
    items,
    removed,
    analyzedSources,
    dropped,
    warnings,
    part: Number(doc.part) || 1,
    parts: Number(doc.parts) || 1,
  };
}

/* ------------------------------------------------------------------ *
 * الخطّة — قراءةٌ خالصة، ولا كتابةَ فيها
 * ------------------------------------------------------------------ */

/**
 * يبني خطّةَ الاستيراد: يتحقّق من كلّ استشهادٍ ويعيد العدَّ بنفسه.
 *
 * ⚠️ **ولا سطرَ كتابةٍ واحدٍ هنا** (نفسُ عقد `planEnrichment` في WS-C):
 *    إلغاءُ الشاشة يجب ألّا يترك أثرًا. والكتابةُ كلُّها في
 *    `applyImport` بعد ضغطةٍ صريحة.
 *
 * @param {{parsed: object, onProgress?: Function}} input
 */
export async function planImport({ parsed, onProgress } = {}) {
  const [live, registry] = await Promise.all([readLiveSources(), listSources()]);

  /* فهارسُ البحث: مصدرٌ بمفتاحه، ومقطعٌ بمفتاحِ مصدرِه ومعرِّفِه. */
  const regByKey = new Map(registry.map((row) => [row.id, row]));
  const segments = [];
  const segByKey = new Map();
  for (const source of live) {
    for (const seg of source.segments) {
      const one = { sourceKey: source.key, segmentId: seg.id, text: seg.text || '' };
      segments.push(one);
      segByKey.set(`${source.key}|${seg.id}`, one);
    }
  }

  const rows = [];
  let done = 0;

  for (const item of parsed.items) {
    done += 1;
    onProgress?.({ done, total: parsed.items.length, label: item.lemma || item.key });

    /* ── ١. الاستشهادات: تُفتَح على نصّها ── */
    const kept = [];
    const rejected = [];
    for (const cite of item.evidence) {
      const seg = segByKey.get(`${cite.sourceKey}|${cite.segmentId}`);
      if (!regByKey.has(cite.sourceKey)) {
        rejected.push({ ...cite, why: 'مصدر مش موجود عندك' });
        continue;
      }
      if (!seg) {
        rejected.push({ ...cite, why: 'مقطع مش موجود في المصدر ده' });
        continue;
      }
      if (cite.quote && !flat(seg.text).includes(flat(cite.quote))) {
        /* ⚠️ اقتباسٌ ليس في نصّه = نصٌّ مخترَع. لا يُخزَّن بحال. */
        rejected.push({ ...cite, why: 'الاقتباس مش موجود في النصّ' });
        continue;
      }
      kept.push({ ...cite, text: seg.text });
    }

    /* ── ٢. العدّ: التطبيقُ يعدّ بنفسه ── */
    const counted = countLemma(item.forms, segments);
    const check = verify({ claimed: item.claimedCount, references: item.evidence }, counted);
    const measured = measure(counted.hits, regByKey);

    /* ── ٣. الحكم ── */
    const onlyUnknown = counted.hits.length > 0
      && measured.rawOccurrences === 0
      && measured.derivedAppearances === 0;
    let verdict = VERDICT.CLEAN;
    if (rejected.length) verdict = VERDICT.BLOCKED;
    else if (check.status === VERIFY.REVIEW || onlyUnknown) verdict = VERDICT.REVIEW;

    /* eslint-disable-next-line no-await-in-loop -- بحثٌ بمفتاحٍ فريدٍ لكلّ عنصر */
    const existing = await analysisItems.oneByIndex('key', item.key);

    rows.push({
      key: item.key,
      item,
      existing,
      isNew: !existing,
      verdict,
      evidence: { kept, rejected },
      count: check,
      measured,
      hits: counted.hits,
      /*
       * ⚠️ **ومفاتيحُ المواقف تُحفَظ لا أعدادُها.** جمعُ «مواقف» عنصرين
       *    لا يصحّ بالجمع: نصٌّ واحدٌ فيه الكلمتان موقفٌ واحدٌ لا اثنان.
       *    فالمفاتيحُ تُوحَّد عند العرض، والأعدادُ لا تُجمَع.
       */
      primarySources: [...new Set(counted.hits
        .filter((hit) => regByKey.get(hit.sourceKey)?.evidenceClass === EVIDENCE.PRIMARY)
        .map((hit) => hit.sourceKey))],
      onlyUnknown,
      /*
       * ⚠️ **والمحجوبُ لا يُقبَل بالافتراض** — لكنه يبقى قابلًا للقبول
       *    بيدك: العنصرُ نفسُه قد يكون صحيحًا وإن كذب استشهادُه، والاستشهادُ
       *    الكاذبُ لن يُخزَّن في الحالتين.
       */
      accept: verdict !== VERDICT.BLOCKED,
    });
  }

  const count = (fn) => rows.filter(fn).length;
  const touched = new Set();
  for (const row of rows) for (const cite of row.evidence.kept) touched.add(cite.sourceKey);

  return {
    rows,
    removed: parsed.removed,
    analyzedSources: parsed.analyzedSources,
    dropped: parsed.dropped,
    warnings: parsed.warnings,
    summary: {
      total: rows.length,
      clean: count((r) => r.verdict === VERDICT.CLEAN),
      review: count((r) => r.verdict === VERDICT.REVIEW),
      blocked: count((r) => r.verdict === VERDICT.BLOCKED),
      added: count((r) => r.isNew),
      updated: count((r) => !r.isNew),
      evidenceKept: rows.reduce((sum, r) => sum + r.evidence.kept.length, 0),
      evidenceRejected: rows.reduce((sum, r) => sum + r.evidence.rejected.length, 0),
      droppedFields: parsed.dropped.length,
      sourcesTouched: touched.size,
    },
  };
}

/* ------------------------------------------------------------------ *
 * الالتزام
 * ------------------------------------------------------------------ */

/**
 * معرِّفُ وصلةِ الدليل — حتميٌّ فلا تتضاعف الصفوفُ عند إعادة الاستيراد.
 *
 * ⚠️ **وفاصلٌ مرئيٌّ صريحٌ لا محرفٌ خفيّ.** سبق في `baseline.js` أن
 *    استُعمل محرفٌ غيرُ مرئيٍّ فاصلًا فصار الملفُّ ثنائيًّا في عين
 *    `grep`، ثم صار حذفُه يلصق مفتاحين. فالفاصلُ هنا `|` يُقرأ ويُطبَع،
 *    ولا يقع في أيّ من أجزائه (`kind:ID` و`ID#n`).
 */
export const evidenceId = (itemKey, sourceKey, segmentId, at) =>
  `${itemKey}|${sourceKey}|${segmentId}|${at}`;

/**
 * يكتب ما وافقتَ عليه — **وما وافقتَ عليه وحدَه**.
 *
 * @param {object} plan ناتجُ `planImport` بعد تعديل `accept`
 * @param {{onProgress?: Function}} [options]
 */
export async function applyImport(plan, { onProgress } = {}) {
  const accepted = plan.rows.filter((row) => row.accept);
  const now = Date.now();

  onProgress?.({ stage: 'items', done: 0, total: accepted.length, label: 'بيسجّل العناصر' });

  let added = 0;
  let updated = 0;
  let evidenceRows = 0;
  let done = 0;

  for (const row of accepted) {
    const { item } = row;
    const fields = {
      key: item.key,
      itemType: item.itemType,
      lemma: item.lemma || null,
      surface: item.surface || null,
      pos: item.pos || null,
      senseId: item.senseId || null,
      senseLabel: item.senseLabel || null,
      familyId: item.familyId || null,
      forms: item.forms,
      gender: item.gender || null,
      aspect: item.aspect || null,
      animacy: item.animacy || null,
      register: item.register || null,
      domain: item.domain || null,
      government: item.government || null,
      meaningAr: item.meaningAr || null,
      usageNote: item.usageNote || null,
      notes: item.notes || null,
      confidence: Number.isFinite(item.confidence) ? item.confidence : null,
      /*
       * ⚠️ **المقاييسُ السبعةُ حقولٌ منفصلة، ولا حقلَ اسمُه `count`.**
       *    راجع `measure()`: حقلٌ مجموعٌ واحدٌ يغري بعرضه، وعرضُه هو
       *    الجملةُ التي يمنعها البندُ ٢ نصًّا.
       */
      rawOccurrences: row.measured.rawOccurrences,
      realSituations: row.measured.realSituations,
      derivedAppearances: row.measured.derivedAppearances,
      derivedSources: row.measured.derivedSources,
      unknownOccurrences: row.measured.unknownOccurrences,
      /* ادّعاءُ التحليل يُحفَظ بجانب عدّنا لا مكانَه. */
      aiClaimedCount: row.count.claimed,
      verifyStatus: row.count.status,
      analyzedAt: now,
      analysisSource: 'ai',
    };

    if (row.existing) {
      /* eslint-disable-next-line no-await-in-loop */
      await analysisItems.update(row.existing.id, fields);
      updated += 1;
    } else {
      /* eslint-disable-next-line no-await-in-loop */
      await analysisItems.create(fields);
      added += 1;
    }

    /*
     * ⚠️ **ووصلاتُ الدليل من عدِّ التطبيق لا من قائمة التحليل.** لو
     *    كتبناها من استشهاداته لَخزّنّا ما قبِله المستخدمُ لا ما في
     *    النصّ. فالمواضعُ محسوبةٌ عندنا، وملاحظةُ التحليل تُلصَق على
     *    الموضع الذي استشهد به فعلًا.
     */
    const noteAt = new Map(
      row.evidence.kept.map((cite) => [`${cite.sourceKey}|${cite.segmentId}`, cite.note])
    );
    const rows = row.hits.map((hit) => ({
      id: evidenceId(item.key, hit.sourceKey, hit.segmentId, hit.at),
      itemKey: item.key,
      sourceKey: hit.sourceKey,
      segmentId: hit.segmentId,
      at: hit.at,
      form: hit.form || null,
      quote: hit.quote,
      aiNote: noteAt.get(`${hit.sourceKey}|${hit.segmentId}`) || null,
      createdAt: now,
    }));
    if (rows.length) {
      /* eslint-disable-next-line no-await-in-loop */
      await analysisEvidence.putManyRaw(rows);
      evidenceRows += rows.length;
    }

    done += 1;
    onProgress?.({ stage: 'items', done, total: accepted.length, label: item.lemma || item.key });
  }

  /*
   * ⚠️ **والبصمةُ المسجَّلةُ هي المُرسَلة لا الحاليّة** — راجع `markAnalyzed`.
   *    و`sentHash` كُتب لحظةَ نسخِ الحزمة، فلو عدّلتَ النصَّ أثناء دورة
   *    التحليل بقي «اتعدّل بعد آخر تحليل» كما يجب.
   */
  onProgress?.({ stage: 'sources', done: 0, total: 1, label: 'بيسجّل النصوص المحلَّلة' });
  const registry = await listSources();
  const byKey = new Map(registry.map((one) => [one.id, one]));
  const marks = [];
  for (const key of plan.analyzedSources) {
    const row = byKey.get(key);
    /* ما لم يُرسَل من هذا الجهاز لا نعرف أيَّ نصٍّ حُلِّل — فلا نَدَّعِ. */
    if (row?.sentHash) marks.push({ key, hash: row.sentHash });
  }
  const marked = await markAnalyzed(marks);

  onProgress?.({ stage: 'done', done: 1, total: 1, label: 'خلص' });
  return {
    added,
    updated,
    evidenceRows,
    marked,
    skipped: plan.rows.length - accepted.length,
    unmarked: plan.analyzedSources.length - marks.length,
  };
}

/**
 * ملخّصٌ يُعرَض بعد الالتزام — بأرقامٍ **مفصولةٍ** لا مجموعة.
 *
 * ⚠️ ويُبقي `unknownOccurrences` ظاهرًا: مصدرٌ لم تصنّفه بعدُ يعني
 *    رقمًا ناقصًا في «المواقف الحقيقيّة»، وإخفاؤه يجعل النقصَ يبدو
 *    اكتمالًا.
 */
export function importTotals(rows = []) {
  const only = rows.filter((row) => row.accept);
  const sum = (field) => only.reduce((at, row) => at + (row.measured[field] || 0), 0);
  return {
    items: only.length,
    rawOccurrences: sum('rawOccurrences'),
    derivedAppearances: sum('derivedAppearances'),
    unknownOccurrences: sum('unknownOccurrences'),
    realSituations: new Set(only.flatMap((row) => row.primarySources || [])).size,
    unverified: only.filter((row) => row.count.status === VERIFY.REVIEW).length,
  };
}

export { VERIFY, EVIDENCE };

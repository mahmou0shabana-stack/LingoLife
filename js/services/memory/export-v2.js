/**
 * LingoLife — حزمةُ ذاكرة اللغة v2: النصُّ الأصليُّ أوّلًا (WS-J · بنود ٤ و٨ و٢٨)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ما كان يُصدَّر، ولماذا كان عاجزًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * `exchange.js` (v1) يرسل إحصاءً مضغوطًا:
 *
 *     { canonical: "согласование", counts: { positions: 27 } }
 *
 * ويُطلَب من التحليل أن يقول: ما جنسُ هذه الكلمة؟ وما سجلُّها؟ وبأيّ
 * حرفِ جرٍّ تُستعمَل؟ وهل «идёт» هنا حركةٌ أم سيرُ عمل؟
 *
 * **وهي أسئلةٌ لا جوابَ لها بلا النصّ.** ٢٧ رقمٌ لا يحمل سياقًا، ولا
 * جملةً، ولا جارًا للكلمة. فكان التحليلُ يخمّن من معرفةٍ عامّةٍ باللغة
 * لا من لغتك أنت — وذلك بالضبط عكسُ ما بُني له التطبيق.
 *
 * (وفي `buildMemoryExport` معاملٌ اسمُه `includeSources` استعمالُه
 *  الوحيدُ `...(includeSources ? {} : {})` — أي لا شيءَ في الحالتين.
 *  فالنيّةُ كانت موجودةً ولم تُنفَّذ قطّ.)
 *
 * فالحزمةُ v2 تحمل **النصوصَ كاملةً** بمقاطعها ومعرِّفاتها، ليقرأ
 * التحليلُ ما قرأتَه أنت.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وأوّلُ جولةٍ ليست كالتي بعدها** (بند ٨)
 * ═══════════════════════════════════════════════════════════════
 *
 *   الأولى   نصوصٌ كاملةٌ لِما اخترتَ + تعليمات
 *   التالية  حالةُ التحليل **مضغوطة** + الجديدُ + المتغيّرُ + شهاداتُ الحذف
 *
 * فثلاثون نصًّا حُلِّلت لا تُرسَل ثانيةً لأنك أضفت الحادي والثلاثين.
 * والدليلُ على ذلك اختبارٌ يعدّ النصوصَ في الحزمة الثانية.
 */

import { EVIDENCE, ORIGIN, rootsOf } from './provenance.js';
import {
  ANALYSIS_STATE, listSources, readLiveSources, stateOf,
} from './source-registry.js';
import { analysisSnapshot } from './analysis-state.js';

export const FORMAT = 'living-language-memory';
export const VERSION = 2;

/**
 * سقفُ الحزمة الواحدة بالمحارف.
 *
 * ⚠️ **وسقفٌ صارمٌ مع تجزئةٍ تلقائيّة** — بطلبٍ صريحٍ من المالك. حزمةٌ
 *    أكبرُ من هذا لا تُلصَق في محادثةٍ أصلًا، فالأفضلُ أن يقسمها
 *    التطبيقُ بترتيبٍ معلومٍ من أن يكتشف المستخدمُ الحدَّ بالفشل.
 */
export const MAX_CHARS = 120_000;

/* ------------------------------------------------------------------ *
 * العقدُ الذي يُرسَل مع كلّ حزمة
 * ------------------------------------------------------------------ */

/**
 * تعليماتُ التحليل (بند ٣٥) — تُرسَل **داخل** الحزمة لا في رسالةٍ منفصلة.
 *
 * ⚠️ ولأنها داخلَها، لا يمكن أن تصل الحزمةُ بلا شروطِها. ولو كانت
 *    نصًّا يُنسَخ يدويًّا لَسقطت أوّلَ مرّةٍ ينسى المستخدمُ لصقَها.
 */
export const CONTRACT = Object.freeze({
  language: 'ru',
  rules: [
    'النصوصُ المرفقةُ دليلٌ لا يُعدَّل: لا تُعِد كتابتَها ولا تصحّحها في مكانها.',
    'لا تخترع تواريخَ ولا أعدادَ ممارسةٍ ولا أخطاءً لم تُذكَر.',
    'ما كان evidenceClass=primary دليلٌ على موقفٍ حقيقيّ؛ وما كان derived مادّةٌ تعليميّةٌ مشتقّة.',
    'المشتقُّ لا يزيد المواقفَ الحقيقيّة أبدًا — ولو تكرّرت الكلمةُ فيه عشرًا.',
    'ما كان evidenceClass=unknown لم يصنّفه المستخدمُ بعد: حلّله ولا تعُدّه موقفًا حقيقيًّا.',
    'كلُّ استنتاجٍ يذكر دليلَه: sourceKey و segmentId والنصَّ المقتبَس.',
    'اذكر عددَك للظهورات ومواضعَها — التطبيقُ يعدّها بنفسه ويقارن.',
    'ميّز عدَّ الصيغة الظاهرة عن عدّ المفردة عن عدّ المعنى عن عدّ العائلة.',
    'حين تشكّ، اذكر confidence منخفضةً ولا تدّعِ يقينًا.',
    'أعِد JSON صارمًا مطابقًا للمخطّط المطلوب، بلا نصٍّ خارجه.',
    'في الجولات التالية أعِد فرقًا (delta) لا حالةً كاملة، ولا تحذف تحليلًا سابقًا بلا مصدرٍ تغيّر أو حُذف.',
    'اذكر في analyzedSources مفاتيحَ كلِّ نصٍّ قرأتَه، ولو لم تستخرج منه عنصرًا واحدًا.',
  ],
  /**
   * شكلُ الردّ المطلوب — **داخلَ الحزمة أيضًا**.
   *
   * ⚠️ **وما يُستورَد هو ما وُصف هنا حرفًا بحرف.** لو وصفنا الشكلَ في
   *    مكانٍ والمستوردُ يقرأ شكلًا آخرَ لَصار كلُّ ردٍّ صحيحٍ مرفوضًا
   *    والمستخدمُ يصحّح ما لا عيبَ فيه. فالوصفُ هنا والقارئُ في
   *    `import-v2.js` عقدٌ واحد، ويحرسه اختبار.
   *
   * ⚠️ **ولا حقلَ عددٍ إلّا `claimedCount`** — وهو **ادّعاءٌ يُراجَع** لا
   *    عدد. التطبيقُ يعيد العدَّ من النصّ ويقارن. وكلُّ حقلٍ يقول «كم
   *    موقفًا حقيقيًّا» أو «كم مرّةً تدرّبت» يملكه التطبيقُ وحدَه ويُسقَط.
   */
  responseFormat: {
    format: 'living-language-analysis',
    version: 2,
    part: 1,
    parts: 1,
    /*
     * ⚠️ **والمثالُ نسخةٌ صحيحةٌ من نفسه — لا وصفٌ لا يُقبَل.** كان
     *    `itemType` هنا «word | expression | …» فبدا موضِّحًا، وهو في
     *    الحقيقة قيمةٌ يرفضها المستورِد. فمن نسخ المثالَ كما هو خرج
     *    بملفٍّ مرفوض، ولَظنّ أن التحليلَ أخطأ. فالقيمُ الممكنةُ تُعدَّد
     *    في حقلٍ مستقلّ، والمثالُ يبقى صالحًا للنسخ حرفًا بحرف.
     *    (يحرسه اختبارٌ يمرّر هذا الشكلَ على `parseAnalysis`.)
     */
    itemTypes: ['word', 'expression', 'sentence', 'pattern', 'family'],
    analyzedSources: ['script:SCR_مثال'],
    items: [{
      key: 'word:документ:default',
      itemType: 'word',
      lemma: 'документ',
      surface: 'документов',
      pos: 'noun',
      senseId: 'default',
      familyId: 'документ',
      forms: ['документ', 'документы', 'документов'],
      gender: 'm',
      register: 'formal',
      domain: 'work',
      government: 'предоставить + вин.',
      meaningAr: 'مستند',
      usageNote: '',
      notes: '',
      confidence: 0.8,
      claimedCount: 12,
      evidence: [{
        sourceKey: 'script:SCR_مثال',
        segmentId: 'SCR_مثال#0',
        quote: 'اقتباسٌ حرفيٌّ من النصّ المرفق',
        note: '',
      }],
    }],
    removed: [{ key: 'word:قديم:default', reason: 'source_deleted' }],
  },
});

/* ------------------------------------------------------------------ *
 * الاختيار
 * ------------------------------------------------------------------ */

/**
 * يقترح ما يُرسَل: الجديدُ والمتغيّرُ من الأصليّ.
 *
 * ⚠️ **والمجهولُ لا يُرسَل تلقائيًّا.** إرسالُه يعني أن التحليلَ سيصنّفه
 *    ضمنًا، ونحن قرّرنا أن التصنيفَ قرارُك. فيُعرَض عليك في الشاشة
 *    ويُرسَل إن اخترتَه صراحةً.
 */
export async function suggestSelection() {
  const rows = await listSources();
  return rows
    .filter((row) => row.excluded !== 1 && row.missing !== 1)
    .filter((row) => row.evidenceClass === EVIDENCE.PRIMARY)
    .filter((row) => row.analysisState === ANALYSIS_STATE.NEVER
      || row.analysisState === ANALYSIS_STATE.CHANGED)
    .map((row) => row.id);
}

/* ------------------------------------------------------------------ *
 * البناء
 * ------------------------------------------------------------------ */

/**
 * يبني حزمةً (أو حزمًا) للتصدير.
 *
 * @param {object} input
 * @param {string[]} input.selected مفاتيحُ المصادر المختارة
 * @param {object|null} [input.analysisState] الحالةُ المضغوطة للجولات التالية
 * @param {number} [input.maxChars] سقفُ الحزمة الواحدة
 * @param {(p: object) => void} [input.onProgress]
 * @returns {Promise<{packages: object[], summary: object}>}
 */
export async function buildPackages({
  selected = [], analysisState = null, maxChars = MAX_CHARS, onProgress,
} = {}) {
  onProgress?.({ stage: 'read', label: 'بيقرا المصادر', done: 0, total: 1 });

  /*
   * ⚠️ **والحالةُ تُقرأ من القاعدة لا تُمرَّر من الشاشة** (بند ٨).
   *
   *    كانت مُعامَلًا يملؤه المستدعي، وهو عقدٌ يُنسى: شاشةٌ تُكتَب غدًا
   *    تنادي `buildPackages` بلا حالةٍ فتعود كلُّ جولةٍ جولةً أولى بصمت
   *    — وتُرسَل ثلاثون نصًّا مرّةً أخرى بلا أن يشتكي شيء. فالافتراضُ
   *    الآن **الحالةُ المحفوظة**، والتمريرُ الصريحُ للاختبار وحدَه.
   */
  const state = analysisState ?? await analysisSnapshot();
  /* أوّلُ جولةٍ = لا عنصرَ محلَّلًا بعد. وحالةٌ فارغةٌ تُرسَل `null` لا `{}`. */
  const firstRun = !state?.items?.length && !state?.sources?.length;

  const [live, registry] = await Promise.all([readLiveSources(), listSources()]);
  const liveByKey = new Map(live.map((one) => [one.key, one]));
  const regByKey = new Map(registry.map((one) => [one.id, one]));
  const want = new Set(selected);

  /* ── ١. النصوصُ المختارة، كاملةً ── */
  const docs = [];
  let done = 0;
  for (const key of selected) {
    const source = liveByKey.get(key);
    const meta = regByKey.get(key);
    done += 1;
    onProgress?.({ stage: 'collect', label: 'بيجمع النصوص', done, total: selected.length });
    if (!source || !meta) continue;

    const lineage = rootsOf(key, regByKey);
    docs.push({
      sourceKey: key,
      sourceKind: meta.sourceKind,
      title: meta.title || '',
      language: meta.language || 'ru',
      /*
       * ⚠️ **ولا يُختلَق تاريخ** (بند ٤): ما لا نعرفه يُرسَل `null`
       *    صراحةً. وتاريخٌ مخترَعٌ يُبنى عليه استنتاجٌ زمنيٌّ كاذب.
       */
      createdAt: source.createdAt ?? null,
      updatedAt: source.updatedAt ?? null,
      evidenceClass: meta.evidenceClass || EVIDENCE.UNKNOWN,
      originType: meta.originType || ORIGIN.UNKNOWN,
      derivedFrom: meta.derivedFrom || [],
      rootEvidence: lineage.roots,
      contentHash: meta.contentHash,
      chars: source.text.length,
      /* ═══ النصُّ الأصليُّ كاملًا — بمقاطعه ومعرِّفاتها المستقرّة ═══ */
      segments: source.segments.map((seg) => ({
        segmentId: seg.id,
        order: seg.order,
        speaker: seg.speaker ?? null,
        text: seg.text,
      })),
    });
  }

  /* ── ٢. شهاداتُ الحذف ── */
  const tombstones = registry
    .filter((row) => row.missing === 1 && row.analyzedHash)
    .map((row) => ({ sourceKey: row.id, reason: 'deleted' }));

  /* ── ٣. التجزئة ── */
  onProgress?.({ stage: 'split', label: 'بيقسّم الحزم', done: 0, total: 1 });
  const batches = splitByChars(docs, maxChars);

  const packages = batches.map((batch, i) => ({
    format: FORMAT,
    version: VERSION,
    generatedAt: Date.now(),
    part: i + 1,
    parts: batches.length,
    /*
     * ⚠️ **والجولةُ تقول اسمَها.** بلا هذا الحقل يتصرّف التحليلُ في
     *    الجولة الخامسة كما في الأولى: يعيد تحليلَ ما في `analysisState`
     *    لأنه لا يعرف أنها حالةٌ سابقةٌ لا مادّةٌ جديدة.
     */
    round: firstRun ? 'first' : 'incremental',
    contract: CONTRACT,
    /*
     * ⚠️ **الحالةُ السابقةُ مضغوطة** (بند ٨): مفاتيحُ ما حُلِّل وبصماتُه،
     *    لا نصوصُه. فالتحليلُ يعرف ما رآه من قبلُ بلا أن نعيد إرساله.
     */
    analysisState: i === 0 && !firstRun ? state : null,
    alreadyAnalyzed: i === 0
      ? registry
        .filter((row) => row.analyzedHash && !want.has(row.id))
        .map((row) => ({ sourceKey: row.id, analyzedHash: row.analyzedHash }))
      : [],
    tombstones: i === 0 ? tombstones : [],
    sources: batch,
  }));

  const summary = {
    firstRun,
    knownItems: state?.items?.length || 0,
    stateChars: firstRun ? 0 : JSON.stringify(state).length,
    /*
     * ⚠️ **والبايتاتُ غيرُ المحارف** (بند ٤٢): الحرفُ السيريليُّ بايتان
     *    في UTF-8. فعرضُ عدد المحارف على أنه حجمٌ يقول نصفَ الحقيقة
     *    أمام سقفِ لصقٍ في محادثة — والرقمُ الذي تقرؤه يجب أن يكون
     *    الرقمَ الذي يعنيه اسمُه.
     */
    stateBytes: firstRun ? 0 : new Blob([JSON.stringify(state)]).size,
    available: registry.length,
    primary: registry.filter((r) => r.evidenceClass === EVIDENCE.PRIMARY).length,
    derived: registry.filter((r) => r.evidenceClass === EVIDENCE.DERIVED).length,
    unknown: registry.filter((r) => r.evidenceClass === EVIDENCE.UNKNOWN).length,
    selected: docs.length,
    selectedNew: docs.filter((d) => stateOf(regByKey.get(d.sourceKey)) === ANALYSIS_STATE.NEVER).length,
    selectedChanged: docs.filter((d) => stateOf(regByKey.get(d.sourceKey)) === ANALYSIS_STATE.CHANGED).length,
    selectedDerived: docs.filter((d) => d.evidenceClass === EVIDENCE.DERIVED).length,
    reused: registry.filter((row) => row.analyzedHash && !want.has(row.id)).length,
    tombstones: tombstones.length,
    chars: docs.reduce((sum, d) => sum + d.chars, 0),
    packages: packages.length,
  };

  onProgress?.({ stage: 'done', label: 'جاهزة', done: 1, total: 1 });
  return { packages, summary };
}

/**
 * يقسّم النصوصَ إلى حزمٍ تحت السقف.
 *
 * ⚠️ **ونصٌّ واحدٌ أكبرُ من السقف يُرسَل وحدَه ولا يُقصّ.** قصُّ نصٍّ
 *    نصفين يعطي التحليلَ جملةً مبتورةً فيستنتج منها نحوًا لا وجودَ له.
 *    فالسقفُ يُخرَق صراحةً لحزمةٍ واحدةٍ بدل أن يُخرَق المعنى.
 */
export function splitByChars(docs, maxChars) {
  const out = [];
  let current = [];
  let size = 0;

  for (const doc of docs) {
    if (current.length && size + doc.chars > maxChars) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(doc);
    size += doc.chars;
  }
  if (current.length) out.push(current);
  return out.length ? out : [[]];
}

/**
 * البصماتُ التي أُرسلت فعلًا — تُسجَّل بعد نجاح الاستيراد لا قبله.
 *
 * ⚠️ راجع `markAnalyzed`: تسجيلُ البصمة الحاليّة بدل المُرسَلة يجعل
 *    تعديلًا وقع أثناء الجولة يبدو محلَّلًا وهو لم يُرسَل.
 */
export function analyzedHashesOf(pkgs = []) {
  const out = [];
  for (const pkg of pkgs) {
    for (const doc of pkg.sources || []) {
      out.push({ key: doc.sourceKey, hash: doc.contentHash });
    }
  }
  return out;
}

/**
 * LingoLife — «لغتي»: نموذجٌ موحَّدٌ بإشاراتٍ منفصلة (WS-J · بنود ١٥…٢٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **عنصرٌ واحدٌ ومصادرُ معرفةٍ ثلاثة — لا ثلاثةُ عناصر**
 * ═══════════════════════════════════════════════════════════════
 *
 * «согласование» قد تصلك من ثلاثة أبوابٍ في نفس الأسبوع:
 *
 *   أ · نصٌّ أصليٌّ فيه الكلمة        ← واقعةٌ يملكها التطبيق
 *   ب · تحليلٌ قال إنها اسمُ فعلٍ      ← رأيٌ لغويٌّ من الذكاء
 *   ج · حفظتَها أثناء التدريب        ← فعلٌ منك
 *
 * والخطأُ الذي يقع في كلّ تطبيقٍ من هذا النوع أن تصير ثلاثةَ صفوف:
 * «كلمة محفوظة» و«كلمة محلَّلة» و«كلمة في نصّ» — فيقول العدّادُ ٣
 * وهي واحدة.
 *
 * فالتوحيدُ هنا **يقع عند القراءة لا عند الكتابة**: لا مخزنَ رابعًا
 * ولا ترقية. `analysisItems` تحمل الطبقةَ ب، و`savedItems`
 * و`practiceEvidence` و`mistakeComparisons` تحمل الطبقةَ ج، وهذا
 * الملفُّ يجمعها في عنصرٍ واحدٍ **بإشاراتٍ تبقى مسمّاةً ومنفصلة**.
 *
 * وفائدةُ ذلك ليست أناقةً: لو خزّنّا الموحَّد لَاحتجنا أن نُبقيه
 * متّسقًا مع أربعة مخازنَ تتغيّر من عشر شاشات — وأوّلُ تعارضٍ يصنع
 * رقمًا لا أحدَ يعرف من أين جاء.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والهُويّةُ تُحلّ بصيغةٍ أقرّها التحليل — لا بتخمينٍ صرفيّ**
 * ═══════════════════════════════════════════════════════════════
 *
 * تحفظ «документы» وأنت تتدرّب. والتحليلُ عنده `word:документ:default`
 * وصيغُه تشمل «документы». فيُحَلّ الحفظُ إلى ذلك العنصر — لا لأننا
 * جذّرنا الكلمة (لا محلّلَ صرفيًّا في التطبيق، راجع `identity.js`)،
 * بل لأن **التحليلَ صرّح** بأن هذه الصيغةَ لتلك المفردة.
 *
 * وما لا تُعرَف صيغتُه يبقى عنصرًا قائمًا بذاته موسومًا «من غير تحليل»
 * — ويندمج تلقائيًّا في يوم يصرّح التحليلُ بصيغته، لأن التوحيدَ
 * يُحسَب في كلّ قراءة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ورأسُ العدّ: مفرداتٌ مميَّزةٌ لا صيغٌ** (شرطُ قَبولٍ صريح)
 * ═══════════════════════════════════════════════════════════════
 *
 * «عندك ٨٤٠ كلمة» يجب أن تعني ٨٤٠ **مفردة**. وعدُّ الصيغ يعطي رقمًا
 * أكبرَ بثلاثة أضعافٍ في الروسيّة ويجعل تقدُّمَك يبدو أسرعَ ممّا هو.
 * فالصيغُ تُعَدّ وتُعرَض **باسمها**: «صيغة ملحوظة»، رقمٌ ثانٍ بجانبه
 * لا بدلًا منه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وحفظُك لا يزيد موقفًا حقيقيًّا — أبدًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * `realSituations` تُحسَب من `analysisEvidence` وحدَها ومن مصادرَ
 * صنّفتَها **أصليّة**. والحفظُ والتدريبُ والتعليمُ من الشادوينج تدخل
 * حقولًا أخرى بأسمائها (`saved` · `practised` · `shadowed`) ولا تلمس
 * ذلك الرقم بحال. وهذا مضمونٌ بنيويًّا: الدالّةُ التي تحسبه لا تقرأ
 * صفَّ محفوظاتٍ أصلًا — ويحرسه اختبار.
 */

import {
  analysisItems, analysisEvidence, savedItems, practiceEvidence, mistakeComparisons,
} from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { normalize } from '../../utils/normalization.js';
import { EVIDENCE } from './provenance.js';
import { listSources } from './source-registry.js';
import { ITEM_TYPE, ITEM_TYPE_LABEL } from './import-v2.js';
import { VERIFY } from './counting.js';

/* ------------------------------------------------------------------ *
 * الأوجه
 * ------------------------------------------------------------------ */

/** وجهُ المنشأ — يُشتقّ من أدلّة العنصر لا من حقلٍ عليه. */
export const PROVENANCE = Object.freeze({
  PRIMARY: 'primary',
  DERIVED_ONLY: 'derived_only',
  UNKNOWN_ONLY: 'unknown_only',
  NONE: 'none',
});

export const PROVENANCE_LABEL = Object.freeze({
  [PROVENANCE.PRIMARY]: 'من موقف حقيقي',
  [PROVENANCE.DERIVED_ONLY]: 'من محتوى مولَّد بس',
  [PROVENANCE.UNKNOWN_ONLY]: 'من مصادر غير محدَّدة',
  [PROVENANCE.NONE]: 'من غير دليل حالي',
});

/** إشاراتُ المتعلّم — أفعالٌ وقعت منك، لا تقديراتُ إتقان. */
export const SIGNAL = Object.freeze({
  SAVED: 'saved',
  PRACTISED: 'practised',
  SHADOWED: 'shadowed',
  ERROR: 'error',
  /** جاء من التحليل. */
  ANALYZED: 'analyzed',
  /** أنت وحدك من علّمه — بلا تحليلٍ بعد. */
  LEARNER_ONLY: 'learner_only',
});

export const SIGNAL_LABEL = Object.freeze({
  [SIGNAL.SAVED]: 'محفوظة',
  [SIGNAL.PRACTISED]: 'اتدرّبت عليها',
  [SIGNAL.SHADOWED]: 'من الشادوينج',
  [SIGNAL.ERROR]: 'فيها غلطة',
  [SIGNAL.ANALYZED]: 'متحلّلة',
  [SIGNAL.LEARNER_ONLY]: 'من غير تحليل',
});

/**
 * حالةُ التعلّم — **من وقائعَ صريحةٍ لا من درجة**.
 *
 * ⚠️ ولا مستوى «إتقان» هنا: لا التطبيقُ ولا التحليلُ يملك ما يثبته.
 *    راجع `impliesMastery: false` في `saved-service` و`practiceEvidence`.
 */
export const LEARNING = Object.freeze({
  NEW: 'new',
  SEEN: 'seen',
  SAVED: 'saved',
  PRACTISED: 'practised',
  ERROR_HISTORY: 'error_history',
});

export const LEARNING_LABEL = Object.freeze({
  [LEARNING.NEW]: 'جديدة',
  [LEARNING.SEEN]: 'ظهرت في نصّ',
  [LEARNING.SAVED]: 'حفظتها',
  [LEARNING.PRACTISED]: 'اتدرّبت عليها',
  [LEARNING.ERROR_HISTORY]: 'ليها تاريخ غلط',
});

/** أوجهٌ تُعرَض في المستكشف وتتركّب. */
export const FACETS = Object.freeze([
  { id: 'type', label: 'النوع' },
  { id: 'pos', label: 'القسم' },
  { id: 'register', label: 'مستوى اللغة' },
  { id: 'domain', label: 'المجال' },
  { id: 'provenance', label: 'المنشأ' },
  { id: 'learning', label: 'حالة التعلّم' },
  { id: 'signal', label: 'إشارات' },
  { id: 'verify', label: 'مطابقة العدّ' },
]);

/* ------------------------------------------------------------------ *
 * البناء
 * ------------------------------------------------------------------ */

const alive = (rows) => rows.filter((row) => row.state !== STATE.TRASHED);

/** مفتاحُ عنصرٍ اخترعه المتعلّمُ وحدَه — مميَّزٌ صراحةً في اسمه. */
export const learnerKey = (kind, text) => `${kind}:${normalize(text)}:learner`;

/** يحوّل نوعَ المحفوظ إلى نوع عنصر. */
const typeOfSaved = (kind) => {
  if (kind === 'word') return ITEM_TYPE.WORD;
  if (kind === 'phrase') return ITEM_TYPE.EXPRESSION;
  return ITEM_TYPE.SENTENCE;
};

/** عنصرٌ فارغٌ بكلّ حقوله — فلا يقرأ أحدٌ `undefined` ويظنّه صفرًا. */
const blank = (key, itemType, text) => ({
  key,
  itemType,
  lemma: text || '',
  surface: null,
  pos: null,
  senseId: null,
  senseLabel: null,
  familyId: null,
  forms: [],
  observedForms: [],
  gender: null,
  aspect: null,
  register: null,
  domain: null,
  government: null,
  meaningAr: null,
  usageNote: null,
  notes: null,
  confidence: null,
  /* ═══ الطبقةُ أ: وقائعُ يملكها التطبيق ═══ */
  rawOccurrences: 0,
  realSituations: 0,
  derivedAppearances: 0,
  derivedSources: 0,
  unknownOccurrences: 0,
  situationKeys: [],
  derivedKeys: [],
  /* ═══ الطبقةُ ب: ادّعاءُ التحليل — بجانب عدّنا لا مكانَه ═══ */
  aiClaimedCount: null,
  verifyStatus: null,
  analyzedAt: null,
  hasAnalysis: false,
  /* ═══ الطبقةُ ج: أفعالُك ═══ */
  saved: 0,
  savedAt: null,
  savedTags: [],
  practised: 0,
  lastPractisedAt: null,
  shadowed: 0,
  errors: 0,
  hasLearner: false,
});

/**
 * يبني فهرسَ «لغتي» — **قراءةً واحدةً لكلّ مخزن**.
 *
 * ⚠️ **ولا `memoryOccurrences` هنا.** فهرسُ المواضع قد يبلغ مئاتِ
 *    الآلاف من الصفوف على قاعدةٍ ناضجة، وقراءتُه في كلّ فتحةِ شاشةٍ
 *    تجعل «لغتي» تفتح في ثوانٍ بدل أجزاءٍ من الثانية. وما نحتاجه منه
 *    (الجملةُ المحيطةُ والسياق) لا يُطلَب إلّا في صفحة عنصرٍ واحد —
 *    فيُقرأ هناك عبر `entityMemory`.
 *
 * @param {{onProgress?: Function}} [options]
 */
export async function buildLanguageIndex({ onProgress } = {}) {
  const started = Date.now();
  onProgress?.({ stage: 'read', label: 'بيقرا التحليل', done: 0, total: 5 });

  const [items, links, saved, practice, errors, registry] = await Promise.all([
    analysisItems.getAll(),
    analysisEvidence.getAll(),
    savedItems.getAll(),
    practiceEvidence.getAll(),
    mistakeComparisons.getAll(),
    listSources(),
  ]);

  const sourceOf = new Map(registry.map((row) => [row.id, row]));
  const byKey = new Map();

  /* ── ١. الطبقةُ ب: ما قاله التحليل ── */
  onProgress?.({ stage: 'items', label: 'بيوحّد العناصر', done: 0, total: items.length });
  let done = 0;
  for (const row of items) {
    const one = blank(row.key, row.itemType, row.lemma || row.surface || row.key);
    Object.assign(one, {
      lemma: row.lemma || one.lemma,
      surface: row.surface || null,
      pos: row.pos || null,
      senseId: row.senseId || null,
      senseLabel: row.senseLabel || null,
      familyId: row.familyId || null,
      forms: Array.isArray(row.forms) ? row.forms : [],
      gender: row.gender || null,
      aspect: row.aspect || null,
      register: row.register || null,
      domain: row.domain || null,
      government: row.government || null,
      meaningAr: row.meaningAr || null,
      usageNote: row.usageNote || null,
      notes: row.notes || null,
      confidence: Number.isFinite(row.confidence) ? row.confidence : null,
      aiClaimedCount: Number.isFinite(row.aiClaimedCount) ? row.aiClaimedCount : null,
      verifyStatus: row.verifyStatus || VERIFY.NOT_CLAIMED,
      analyzedAt: row.analyzedAt || null,
      hasAnalysis: true,
      itemId: row.id,
    });
    byKey.set(row.key, one);
    done += 1;
    if (done % 500 === 0) onProgress?.({ stage: 'items', done, total: items.length });
  }

  /* ── ٢. الطبقةُ أ: الأدلّةُ تُعَدُّ من جديد ── */
  onProgress?.({ stage: 'evidence', label: 'بيعدّ الأدلّة', done: 0, total: links.length });
  const forms = new Set();
  for (const link of links) {
    const one = byKey.get(link.itemKey);
    if (!one) continue;
    if (link.form) { one.observedForms.push(link.form); forms.add(normalize(link.form)); }

    const cls = sourceOf.get(link.sourceKey)?.evidenceClass || EVIDENCE.UNKNOWN;
    if (cls === EVIDENCE.PRIMARY) {
      one.rawOccurrences += 1;
      if (!one.situationKeys.includes(link.sourceKey)) one.situationKeys.push(link.sourceKey);
    } else if (cls === EVIDENCE.DERIVED) {
      one.derivedAppearances += 1;
      if (!one.derivedKeys.includes(link.sourceKey)) one.derivedKeys.push(link.sourceKey);
    } else {
      one.unknownOccurrences += 1;
    }
  }
  for (const one of byKey.values()) {
    one.realSituations = one.situationKeys.length;
    one.derivedSources = one.derivedKeys.length;
    one.observedForms = [...new Set(one.observedForms)];
  }

  /*
   * ── ٣. فهرسُ الصيغ: صيغةٌ مطبَّعةٌ ← مفتاحُ عنصرها ──
   *
   * ⚠️ **والأطولُ يفوز عند التعارض.** لو صرّح التحليلُ بأن «стало»
   *    صيغةٌ لمفردتين، فحلُّ الحفظِ إلى أوّلِ ما صادفناه اختيارٌ عشوائيّ
   *    يتبدّل بترتيب القراءة. فالترتيبُ هنا **حتميّ**: مفتاحٌ أصغرُ
   *    أبجديًّا يفوز، فيبقى نفسَه في كلّ فتحة.
   */
  const formIndex = new Map();
  for (const one of [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    for (const form of [one.lemma, one.surface, ...one.forms, ...one.observedForms]) {
      const at = normalize(form || '');
      if (at && !formIndex.has(at)) formIndex.set(at, one.key);
    }
  }

  /** يحلّ نصًّا إلى عنصرٍ قائمٍ أو يُنشئ عنصرَ متعلّمٍ خالصًا. */
  const resolve = (text, kind) => {
    const at = normalize(text || '');
    if (!at) return null;
    const known = formIndex.get(at);
    if (known) return byKey.get(known);

    const type = typeOfSaved(kind);
    const key = learnerKey(type, text);
    if (!byKey.has(key)) byKey.set(key, blank(key, type, (text || '').trim()));
    return byKey.get(key);
  };

  /* ── ٤. الطبقةُ ج: أفعالُك ── */
  onProgress?.({ stage: 'learner', label: 'بيقرا محفوظاتك وتدريبك', done: 0, total: 3 });

  for (const row of alive(saved)) {
    const one = resolve(row.text, row.kind);
    if (!one) continue;
    one.saved += 1;
    one.hasLearner = true;
    one.savedTags = [...new Set([...one.savedTags, ...(row.tagIds || [])])];
    if (Number.isFinite(row.createdAt)) {
      one.savedAt = Math.max(one.savedAt || 0, row.createdAt);
    }
  }

  for (const row of practice) {
    /*
     * ⚠️ **والتدريبُ يُنسَب إلى نصّه كاملًا لا إلى كلماته.** لو فرّقناه
     *    على كلّ كلمةٍ في الجملة لَصار «اتدرّبت على документ ٤٠ مرّة»
     *    لأنك كرّرت جملةً فيها الكلمة. والجملةُ هي ما تدرّبتَ عليه.
     */
    const text = row.targetText || row.text || '';
    const one = resolve(text, text.split(/\s+/).length > 1 ? 'sentence' : 'word');
    if (!one) continue;
    one.practised += (row.repetitions || 1);
    one.hasLearner = true;
    if (row.practiceType === 'shadowing' || row.targetType === 'shadowSegment') one.shadowed += 1;
    if (Number.isFinite(row.practicedAt)) {
      one.lastPractisedAt = Math.max(one.lastPractisedAt || 0, row.practicedAt);
    }
  }

  for (const row of alive(errors)) {
    const one = resolve(row.natural || row.wrong || '', 'sentence');
    if (!one) continue;
    one.errors += 1;
    one.hasLearner = true;
  }

  /* ── ٥. الأوجهُ المشتقّة ── */
  const list = [...byKey.values()];
  for (const one of list) {
    one.provenance = provenanceOf(one);
    one.learning = learningOf(one);
    one.signals = signalsOf(one);
    one.learnerOnly = !one.hasAnalysis;
  }

  const index = {
    items: list,
    byKey,
    formIndex,
    totals: totalsOf(list, forms),
    facets: facetsOf(list),
    builtAt: Date.now(),
    ms: Date.now() - started,
  };
  onProgress?.({ stage: 'done', label: 'جاهز', done: 1, total: 1 });
  return index;
}

/* ------------------------------------------------------------------ *
 * الاشتقاقات
 * ------------------------------------------------------------------ */

export function provenanceOf(one) {
  if (one.rawOccurrences > 0) return PROVENANCE.PRIMARY;
  if (one.derivedAppearances > 0) return PROVENANCE.DERIVED_ONLY;
  if (one.unknownOccurrences > 0) return PROVENANCE.UNKNOWN_ONLY;
  return PROVENANCE.NONE;
}

export function learningOf(one) {
  if (one.errors > 0) return LEARNING.ERROR_HISTORY;
  if (one.practised > 0) return LEARNING.PRACTISED;
  if (one.saved > 0) return LEARNING.SAVED;
  if (one.rawOccurrences + one.derivedAppearances + one.unknownOccurrences > 0) {
    return LEARNING.SEEN;
  }
  return LEARNING.NEW;
}

export function signalsOf(one) {
  const out = [];
  if (one.saved > 0) out.push(SIGNAL.SAVED);
  if (one.practised > 0) out.push(SIGNAL.PRACTISED);
  if (one.shadowed > 0) out.push(SIGNAL.SHADOWED);
  if (one.errors > 0) out.push(SIGNAL.ERROR);
  if (one.hasAnalysis) out.push(SIGNAL.ANALYZED);
  else out.push(SIGNAL.LEARNER_ONLY);
  return out;
}

/**
 * المجاميعُ العليا — **كلٌّ منها قابلٌ للنقر** (بند ١٦).
 *
 * ⚠️ **و«كلمات» = مفرداتٌ مميَّزة.** الصيغُ رقمٌ ثانٍ باسمه، لا بديلٌ
 *    عنه ولا مجموعٌ معه. راجع ترويسة الملفّ.
 */
export function totalsOf(list, observedForms = new Set()) {
  const of = (type) => list.filter((one) => one.itemType === type).length;
  const families = new Set(list.map((one) => one.familyId).filter(Boolean));

  return {
    words: of(ITEM_TYPE.WORD),
    expressions: of(ITEM_TYPE.EXPRESSION),
    sentences: of(ITEM_TYPE.SENTENCE),
    patterns: of(ITEM_TYPE.PATTERN),
    families: families.size,
    observedForms: observedForms.size,
    /* أرقامٌ مساندةٌ تُعرَض بأسمائها ولا تُجمَع مع ما فوقها. */
    withPrimary: list.filter((one) => one.provenance === PROVENANCE.PRIMARY).length,
    derivedOnly: list.filter((one) => one.provenance === PROVENANCE.DERIVED_ONLY).length,
    unknownOnly: list.filter((one) => one.provenance === PROVENANCE.UNKNOWN_ONLY).length,
    noEvidence: list.filter((one) => one.provenance === PROVENANCE.NONE).length,
    needsReview: list.filter((one) => one.verifyStatus === VERIFY.REVIEW).length,
    learnerOnly: list.filter((one) => one.learnerOnly).length,
    all: list.length,
  };
}

/** قيمُ كلّ وجهٍ بأعدادها — تُبنى مرّةً وتُعرَض في الشريط الجانبيّ. */
export function facetsOf(list) {
  const tally = (pick) => {
    const map = new Map();
    for (const one of list) {
      for (const value of [].concat(pick(one) ?? [])) {
        if (value === null || value === undefined || value === '') continue;
        map.set(value, (map.get(value) || 0) + 1);
      }
    }
    return [...map].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  };

  return {
    type: tally((one) => one.itemType),
    pos: tally((one) => one.pos),
    register: tally((one) => one.register),
    domain: tally((one) => one.domain),
    provenance: tally((one) => one.provenance),
    learning: tally((one) => one.learning),
    signal: tally((one) => one.signals),
    verify: tally((one) => one.verifyStatus),
  };
}

/* ------------------------------------------------------------------ *
 * الاستعلام
 * ------------------------------------------------------------------ */

export const SORT = Object.freeze({
  SITUATIONS: 'situations',
  RAW: 'raw',
  RECENT: 'recent',
  ALPHA: 'alpha',
  PRACTISED: 'practised',
});

export const SORT_LABEL = Object.freeze({
  [SORT.SITUATIONS]: 'أكتر مواقف حقيقية',
  [SORT.RAW]: 'أكتر ظهور في نصّ أصلي',
  [SORT.RECENT]: 'الأحدث',
  [SORT.ALPHA]: 'أبجدي',
  [SORT.PRACTISED]: 'أكتر تدريب',
});

/**
 * يصفّي بأوجهٍ **تتركّب**: داخل الوجه الواحد «أو»، وبين الأوجه «و».
 *
 * ⚠️ **وهذا الفرقُ ليس تفصيلًا.** «اسم أو فعل» داخل وجه القسم، ثم
 *    «رسميّ» في وجه المستوى، تعني «(اسم أو فعل) **و** رسميّ». ولو
 *    جعلناها «و» في الحالتين لَما أمكن اختيارُ قيمتين من وجهٍ واحد
 *    أبدًا، ولَبدا المستكشفُ معطوبًا كلّما نقر المستخدمُ اثنتين.
 */
export function queryLanguage(index, query = {}) {
  const {
    type = [], pos = [], register = [], domain = [],
    provenance = [], learning = [], signal = [], verify = [],
    family = null, search = '', sort = SORT.SITUATIONS,
  } = query;

  const wants = (picked, value) => !picked.length || picked.includes(value);
  const wantsAny = (picked, values) => !picked.length || values.some((v) => picked.includes(v));
  const needle = normalize(search || '');

  const out = index.items.filter((one) => {
    if (!wants(type, one.itemType)) return false;
    if (!wants(pos, one.pos)) return false;
    if (!wants(register, one.register)) return false;
    if (!wants(domain, one.domain)) return false;
    if (!wants(provenance, one.provenance)) return false;
    if (!wants(learning, one.learning)) return false;
    if (!wants(verify, one.verifyStatus)) return false;
    if (!wantsAny(signal, one.signals)) return false;
    if (family && one.familyId !== family) return false;
    if (needle) {
      const hay = [one.lemma, one.surface, one.meaningAr, ...one.forms, ...one.observedForms]
        .filter(Boolean).map((t) => normalize(t)).join(' ');
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const by = {
    [SORT.SITUATIONS]: (a, b) => b.realSituations - a.realSituations
      || b.rawOccurrences - a.rawOccurrences,
    [SORT.RAW]: (a, b) => b.rawOccurrences - a.rawOccurrences,
    [SORT.RECENT]: (a, b) => (b.savedAt || b.lastPractisedAt || b.analyzedAt || 0)
      - (a.savedAt || a.lastPractisedAt || a.analyzedAt || 0),
    [SORT.PRACTISED]: (a, b) => b.practised - a.practised,
    [SORT.ALPHA]: (a, b) => String(a.lemma).localeCompare(String(b.lemma), 'ru'),
  };
  /* ⚠️ ومرتّبٌ ثانويٌّ ثابت: ترتيبٌ يتبدّل بين فتحتين يبدو عطبًا. */
  return out.sort((a, b) => (by[sort] || by[SORT.SITUATIONS])(a, b)
    || a.key.localeCompare(b.key));
}

/**
 * عائلةُ عنصرٍ وصيغُه ومعانيه — علاقاتٌ تُعرَض ولا تُخمَّن (بند ٢٠).
 *
 * ⚠️ **والعائلةُ من تصريح التحليل لا من تشابه الحروف.** «стол»
 *    و«столица» تتشاركان أربعةَ أحرفٍ ولا قرابةَ بينهما. ولا محلّلَ
 *    اشتقاقيًّا في التطبيق، فما لم يصرّح التحليلُ بعائلةٍ فلا عائلة.
 */
export function relationsOf(index, key) {
  const one = index.byKey.get(key);
  if (!one) return { family: [], senses: [], forms: [] };

  const family = one.familyId
    ? index.items.filter((other) => other.familyId === one.familyId && other.key !== key)
    : [];

  /* المعاني: نفسُ المفردة بمعرِّفِ معنًى مختلف. */
  const senses = one.lemma
    ? index.items.filter((other) => other.key !== key
      && other.itemType === one.itemType
      && normalize(other.lemma || '') === normalize(one.lemma))
    : [];

  return {
    family,
    senses,
    /* الصيغُ المصرَّحُ بها والملحوظةُ — مفصولتان (بند ٢٠). */
    forms: {
      declared: one.forms,
      observed: one.observedForms,
      unseen: one.forms.filter((f) => !one.observedForms.some(
        (o) => normalize(o) === normalize(f)
      )),
    },
  };
}

/**
 * أدلّةُ عنصرٍ مفصولةً: مواقفُ حقيقيّةٌ · ظهوراتٌ مولَّدة · غيرُ محدَّدة.
 *
 * ⚠️ **ولا تُدمَج القائمتان في واحدةٍ مرتَّبةٍ بالتاريخ.** جدولٌ واحدٌ
 *    فيه سطرٌ من تفريغٍ حقيقيٍّ وسطرٌ من نصّ تدريبٍ مولَّد يجعل
 *    القارئَ يعاملهما سواءً مهما كتبنا في العمود الأخير. الفصلُ
 *    بصريٌّ **وإحصائيٌّ** كما يطلب البند ١٨.
 */
export async function evidenceOf(key) {
  const [links, registry] = await Promise.all([
    analysisEvidence.byIndex('itemKey', key),
    listSources(),
  ]);
  const sourceOf = new Map(registry.map((row) => [row.id, row]));

  const shape = (link) => {
    const source = sourceOf.get(link.sourceKey);
    return {
      sourceKey: link.sourceKey,
      segmentId: link.segmentId,
      title: source?.title || link.sourceKey,
      sourceKind: source?.sourceKind || null,
      /* ⚠️ تاريخُ المصدر إن وُجد — و`null` تعني لا نعرف، ولا يُخترَع. */
      at: source?.updatedAt ?? null,
      quote: link.quote || '',
      form: link.form || null,
      aiNote: link.aiNote || null,
      missing: source?.missing === 1,
    };
  };

  const primary = [];
  const derived = [];
  const unknown = [];
  for (const link of links) {
    const cls = sourceOf.get(link.sourceKey)?.evidenceClass || EVIDENCE.UNKNOWN;
    if (cls === EVIDENCE.PRIMARY) primary.push(shape(link));
    else if (cls === EVIDENCE.DERIVED) derived.push(shape(link));
    else unknown.push(shape(link));
  }

  return {
    primary,
    derived,
    unknown,
    realSituations: new Set(primary.map((one) => one.sourceKey)).size,
    derivedSources: new Set(derived.map((one) => one.sourceKey)).size,
  };
}

export { ITEM_TYPE, ITEM_TYPE_LABEL, VERIFY };

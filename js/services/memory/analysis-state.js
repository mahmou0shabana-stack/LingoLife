/**
 * LingoLife — حالةُ التحليل الدائمة والدمجُ التزايُديّ (WS-J · بنود ٥ و٨ و٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الجولةُ الثانيةُ ليست الأولى — وإلّا فلا معنى للتزايُد**
 * ═══════════════════════════════════════════════════════════════
 *
 * لو أرسلنا في كلّ جولةٍ كلَّ شيء، فثلاثون نصًّا حُلِّلت تُرسَل ثانيةً
 * لأنك أضفت الحادي والثلاثين. والتحليلُ يعيد استنتاجَ ما استنتجه،
 * وقد يخرج بجوابٍ مختلفٍ لنفس النصّ — فيتقلّب تاريخُك اللغويُّ بلا
 * أن يتغيّر حرفٌ عندك.
 *
 * فالجولةُ التالية ترسل ثلاثةَ أشياءَ لا نصوصًا:
 *
 *   `items`      مفاتيحُ ما حُلِّل ومفرداتُه — بلا أدلّةٍ ولا نصوص
 *   `sources`    مفاتيحُ النصوص وبصماتُها يومَ حُلِّلت
 *   `families`   ما جمعه التحليلُ في عائلاتٍ كي لا يعيد جمعَه
 *
 * وحجمُها بالمئات من البايتات لا بالمئات من الكيلوبايتات: لا نصَّ
 * فيها البتّة. **والاختبارُ يقيس ذلك** — لا نعد به في تعليق.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والحذفُ لا يُقبَل إلّا ببرهانٍ من عندنا** (بند ٨)
 * ═══════════════════════════════════════════════════════════════
 *
 * التحليلُ قد يقول «احذف `word:документ`». وهو ادّعاءٌ كسائر ادّعاءاته:
 * قد يكون رأيًا لغويًّا جديدًا، وقد يكون نسيانًا لجولةٍ سابقة. وقبولُه
 * على علّاته يعني أن تحليلًا واحدًا رديئًا يمحو شهورًا من عملك.
 *
 * فالحذفُ **لا يُطبَّق إلّا إن كان مصدرُ دليله قد تغيّر أو حُذف فعلًا
 * عندنا**. وما عدا ذلك يُعرَض عليك مرفوضًا بسببه — لا يُطبَّق ولا
 * يُبتلَع.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والنصُّ المحذوفُ تُسحَب أدلّتُه ولا يُمَسّ استنتاجُه**
 * ═══════════════════════════════════════════════════════════════
 *
 * حذفتَ سكريبتًا؟ مواضعُه لم تعد قائمةً، فتُسحَب وصلاتُ الدليل التي
 * تشير إليه **وتُعاد الأعدادُ من الباقي**. أمّا العنصرُ نفسُه (المعنى
 * والسجلّ والجنس) فيبقى: هو معرفةٌ عن اللغة لا عن ذلك النصّ.
 *
 * وعنصرٌ لم يبقَ له دليلٌ واحد **لا يُمحى** — يصير «بلا دليلٍ حاليّ»
 * ويُرى بذلك الوجه في المستكشف. فمحوُه يعني أن حذفَ نصٍّ يمحو ما
 * تعلّمتَه منه.
 */

import { analysisItems, analysisEvidence } from '../../db/repositories.js';
import { EVIDENCE } from './provenance.js';
import { listSources, ANALYSIS_STATE } from './source-registry.js';

/** إصدارُ اللقطة — يُقرأ في الحزمة ويُميّز شكلًا قديمًا. */
export const STATE_VERSION = 1;

/**
 * لقطةٌ **مضغوطة** لِما يعرفه التطبيقُ الآن — تُرسَل في الجولات التالية.
 *
 * ⚠️ **ولا نصَّ فيها ولا اقتباس.** أوّلُ إغراءٍ هنا أن نرسل «مثالًا
 *    واحدًا» مع كلّ عنصرٍ ليتذكّر التحليلُ سياقَه. وهو يضاعف الحجمَ
 *    بلا فائدة: النصوصُ الجديدةُ في نفس الحزمة، والقديمةُ حُلِّلت.
 */
export async function analysisSnapshot() {
  const [items, registry] = await Promise.all([analysisItems.getAll(), listSources()]);

  const families = new Map();
  for (const row of items) {
    if (!row.familyId) continue;
    if (!families.has(row.familyId)) families.set(row.familyId, []);
    families.get(row.familyId).push(row.lemma || row.key);
  }

  return {
    version: STATE_VERSION,
    at: Date.now(),
    items: items.map((row) => ({
      key: row.key,
      itemType: row.itemType,
      lemma: row.lemma || null,
      pos: row.pos || null,
      senseId: row.senseId || null,
      familyId: row.familyId || null,
      /* حالةُ المقارنة تُرسَل كي لا يعيد التحليلُ ادّعاءً رُفع للمراجعة. */
      verifyStatus: row.verifyStatus || null,
    })),
    sources: registry
      .filter((row) => row.analyzedHash)
      .map((row) => ({ sourceKey: row.id, analyzedHash: row.analyzedHash })),
    families: [...families].map(([id, members]) => ({ familyId: id, members })),
  };
}

/**
 * حجمُ اللقطة بالمحارف — تُعرَض في الشاشة، ويقيسها اختبار.
 */
export const snapshotChars = (snapshot) => JSON.stringify(snapshot || {}).length;

/* ------------------------------------------------------------------ *
 * الفرقُ: ما يُحذف وما لا يُحذف
 * ------------------------------------------------------------------ */

/** سببُ رفض حذفٍ اقترحه التحليل. */
export const REMOVAL = Object.freeze({
  /** مصدرُ دليله تغيّر أو حُذف — فالحذفُ مبرَّر. */
  ALLOWED: 'allowed',
  /** العنصرُ ليس عندنا أصلًا — لا شيءَ يُحذف. */
  UNKNOWN: 'unknown_item',
  /** أدلّتُه ما زالت قائمةً في نصوصٍ لم تتغيّر. */
  EVIDENCE_STANDS: 'evidence_stands',
});

export const REMOVAL_LABEL = Object.freeze({
  [REMOVAL.ALLOWED]: 'هيتشال',
  [REMOVAL.UNKNOWN]: 'مش موجود عندك أصلًا',
  [REMOVAL.EVIDENCE_STANDS]: 'دليله لسه قايم في نصّ ما اتغيّرش',
});

/**
 * يفحص كلَّ حذفٍ اقترحه التحليلُ ويقرّر — **بأدلّتنا لا بقوله**.
 *
 * @param {{key: string, reason: string}[]} removed
 * @returns {Promise<{key, reason, verdict, why, evidence: number}[]>}
 */
export async function planRemovals(removed = []) {
  if (!removed.length) return [];

  const [items, links, registry] = await Promise.all([
    analysisItems.getAll(), analysisEvidence.getAll(), listSources(),
  ]);
  const byKey = new Map(items.map((row) => [row.key, row]));
  const state = new Map(registry.map((row) => [row.id, row.analysisState]));

  const linksOf = new Map();
  for (const link of links) {
    if (!linksOf.has(link.itemKey)) linksOf.set(link.itemKey, []);
    linksOf.get(link.itemKey).push(link);
  }

  return removed.map((one) => {
    const item = byKey.get(one.key);
    if (!item) {
      return { ...one, verdict: REMOVAL.UNKNOWN, evidence: 0, itemId: null };
    }

    const mine = linksOf.get(one.key) || [];
    /*
     * ⚠️ **الدليلُ «قائم» إن كان مصدرُه موجودًا ولم يتغيّر.** ومصدرٌ
     *    اختفى أو تعدّل بعد التحليل يجعل ما بُني عليه قابلًا للسحب —
     *    وهذا هو البرهانُ الوحيدُ الذي نقبله للحذف.
     */
    const standing = mine.filter((link) => {
      const at = state.get(link.sourceKey);
      return at === ANALYSIS_STATE.CURRENT || at === ANALYSIS_STATE.NEVER;
    });

    return {
      ...one,
      itemId: item.id,
      evidence: mine.length,
      verdict: standing.length ? REMOVAL.EVIDENCE_STANDS : REMOVAL.ALLOWED,
    };
  });
}

/**
 * ينفّذ الحذوفَ المسموحَ بها وحدَها.
 *
 * ⚠️ **ولا يُنادى إلّا بعد موافقةٍ صريحة** — كسائر ما في هذا المسار.
 */
export async function applyRemovals(planned = []) {
  const allowed = planned.filter((one) => one.verdict === REMOVAL.ALLOWED && one.itemId);
  if (!allowed.length) return { removed: 0, links: 0, refused: planned.length };

  const links = await analysisEvidence.getAll();
  const keys = new Set(allowed.map((one) => one.key));
  const doomed = links.filter((link) => keys.has(link.itemKey)).map((link) => link.id);

  await analysisEvidence.destroyMany(doomed);
  await analysisItems.destroyMany(allowed.map((one) => one.itemId));

  return {
    removed: allowed.length,
    links: doomed.length,
    refused: planned.length - allowed.length,
  };
}

/* ------------------------------------------------------------------ *
 * المصادرُ المحذوفةُ والمتغيّرة
 * ------------------------------------------------------------------ */

/**
 * يعيد حسابَ المقاييس السبعة لعنصرٍ من وصلاته الباقية.
 *
 * ⚠️ **يُحسَب من الوصلات لا من رقمٍ محفوظ.** الرقمُ المحفوظ صحيحٌ يومَ
 *    كُتب؛ وحذفُ مصدرٍ بعده يجعله كذبةً لا يشتكي منها أحد.
 */
export function measureLinks(links = [], registry = new Map()) {
  const situations = new Set();
  const derivedSources = new Set();
  let raw = 0;
  let derived = 0;
  let unknown = 0;

  for (const link of links) {
    const cls = registry.get(link.sourceKey)?.evidenceClass || EVIDENCE.UNKNOWN;
    if (cls === EVIDENCE.PRIMARY) { raw += 1; situations.add(link.sourceKey); }
    else if (cls === EVIDENCE.DERIVED) { derived += 1; derivedSources.add(link.sourceKey); }
    else unknown += 1;
  }

  return {
    rawOccurrences: raw,
    realSituations: situations.size,
    derivedAppearances: derived,
    derivedSources: derivedSources.size,
    unknownOccurrences: unknown,
  };
}

/**
 * يسحب أدلّةَ المصادر المفقودة ويعيد حسابَ ما تأثّر (بند ٩).
 *
 * ⚠️ **ويُبقي العنصرَ ولو صفر دليل.** «بلا دليلٍ حاليّ» حالةٌ تُرى
 *    وتُصفّى، لا سببٌ للمحو. ومحوُه يجعل حذفَ نصٍّ يمحو ما تعلّمتَه منه
 *    — وهذا أسوأُ ما يمكن أن يفعله نظامُ ذاكرة.
 *
 * @param {{onProgress?: Function}} [options]
 */
export async function pruneMissingSources({ onProgress } = {}) {
  const registry = await listSources();
  const byKey = new Map(registry.map((row) => [row.id, row]));
  const gone = new Set(registry.filter((row) => row.missing === 1).map((row) => row.id));

  const links = await analysisEvidence.getAll();
  const doomed = links.filter((link) => gone.has(link.sourceKey) || !byKey.has(link.sourceKey));
  if (!doomed.length) return { droppedLinks: 0, recounted: 0, orphaned: 0 };

  onProgress?.({ done: 0, total: doomed.length, label: 'بيسحب أدلّة النصوص المشالة' });
  await analysisEvidence.destroyMany(doomed.map((link) => link.id));

  const touched = new Set(doomed.map((link) => link.itemKey));
  const left = links.filter((link) => !doomed.includes(link));
  const byItem = new Map();
  for (const link of left) {
    if (!byItem.has(link.itemKey)) byItem.set(link.itemKey, []);
    byItem.get(link.itemKey).push(link);
  }

  const items = await analysisItems.getAll();
  let recounted = 0;
  let orphaned = 0;
  let done = 0;

  for (const row of items) {
    if (!touched.has(row.key)) continue;
    const mine = byItem.get(row.key) || [];
    const measured = measureLinks(mine, byKey);
    done += 1;
    onProgress?.({ done, total: touched.size, label: row.lemma || row.key });
    if (!mine.length) orphaned += 1;
    /* eslint-disable-next-line no-await-in-loop -- عنصرٌ بعد عنصر */
    await analysisItems.update(row.id, { ...measured, evidenceLinks: mine.length });
    recounted += 1;
  }

  return { droppedLinks: doomed.length, recounted, orphaned };
}

/**
 * حالةُ التزايُد كما تُعرَض للمستخدم قبل التصدير.
 *
 * ⚠️ **وأربعةُ أعدادٍ لا عددٌ واحد**: النصوصُ الجديدة، والمتغيّرة،
 *    والتي سبق تحليلُها فلن تُرسَل، والمحذوفةُ التي ستُرسَل شهادةُ
 *    حذفها. وجمعُها في «١٢ نص» يُخفي بالضبط ما جاء المستخدمُ يعرفه.
 */
export async function incrementalStatus() {
  const registry = await listSources();
  const at = (state) => registry.filter((row) => row.analysisState === state).length;
  const snapshot = await analysisSnapshot();

  return {
    firstRun: snapshot.items.length === 0,
    knownItems: snapshot.items.length,
    never: at(ANALYSIS_STATE.NEVER),
    changed: at(ANALYSIS_STATE.CHANGED),
    current: at(ANALYSIS_STATE.CURRENT),
    deleted: at(ANALYSIS_STATE.DELETED),
    excluded: at(ANALYSIS_STATE.EXCLUDED),
    stateChars: snapshotChars(snapshot),
  };
}

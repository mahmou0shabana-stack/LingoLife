/**
 * LingoLife — التحليل المُشتقّ
 *
 * ═══════════════════════════════════════════════════════════════
 * ما هذا، وما ليس هو
 * ═══════════════════════════════════════════════════════════════
 *
 * كل ما هنا **مُشتقٌّ من بياناتك وحدها**: لا نموذج لغويّ، ولا اتصال
 * بشيء، ولا تخمين. الرقم يُحسَب لحظة عرضه من الصفوف التي تراها أنت،
 * ومعه ما يفسّره *(بند 66)*.
 *
 * ═══════════════════════════════════════════════════════════════
 * ولا يُختلَق تقدّم *(بند 74)*
 * ═══════════════════════════════════════════════════════════════
 *
 * أسهل شيءٍ في شاشة تحليل أن تقول «لغتك بتتحسّن ٪١٢». وهو ادّعاءٌ لا
 * سند له: التطبيق يرى ما سجّلتَه لا ما قلتَه، وكثرةُ التسجيل ليست
 * كثرة الكلام، وقلّته ليست انقطاعًا عن اللغة.
 *
 * فالفرق المحفوظ هنا ثلاثيّ، وهو مكتوبٌ في صفوف `practiceEvidence`
 * نفسها (`impliesMastery: false`):
 *
 *   تمرّنتُ عليها   ←  واقعةٌ نعرفها
 *   استعملتُها      ←  لا نعرفها إلا إن قلتَها أنت
 *   أتقنتُها        ←  لا يقيسها التطبيق أبدًا
 *
 * وما لا يُقاس **مُعلَنٌ** في `NOT_MEASURED` لا مسكوتٌ عنه — بنفس مبدأ
 * `ABSENT_AXES` و`NOT_SUPPORTED` و`UNBUILT`، ومعه اختبارٌ يرفض مدخلًا
 * بلا سببٍ مكتوب.
 */

import {
  mistakeComparisons, savedItems, scenes, practiceEvidence, expressionOccurrences,
} from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { MISTAKE_TYPES } from './content-service.js';
import { listSavedTags } from './saved-service.js';
import { facetTree } from './atlas-service.js';
import { typeLabel } from './type-service.js';
import { toISODate, daysBetween } from '../utils/dates.js';

/**
 * ما لا يقيسه هذا التحليل، ولماذا.
 *
 * ⚠️ قائمةٌ صريحة يقارن بها اختبار. الغياب المُعلَن أصدق من رقمٍ
 *    مخترَع، وأنفع من صمتٍ يجعلك تظنّ أننا نسينا.
 */
export const NOT_MEASURED = Object.freeze({
  fluency: 'الطلاقة مش رقم عندنا. التطبيق شايف اللي سجّلته مش اللي قلته — وساعة كلام مع بني آدم ما اتسجّلتش ما بتظهرش هنا خالص',
  progress: 'مفيش «تحسّنت ٪كذا». المقارنة بين شهرٍ وشهر بتقيس كتابتك في التطبيق لا لغتك، ورقمٌ زيّ ده بيطمّنك أو يقلقك من غير سبب حقيقي',
  vocabularySize: 'عدد الكلمات اللي تعرفها مش عدد اللي التقطتها. اللي بتلتقطه هو الصعب والمميّز — أمّا اللي بقى عاديًّا عندك فمش بتلتقطه أصلًا، فالعدّ هيقيس العكس',
  errorRate: 'نسبة الأخطاء محتاجة تعرف كام جملة قلتها صح كمان — وإحنا شايفين التصحيحات اللي كتبتها بس. الكسر بلا مقام مش نسبة',
});

/* ------------------------------------------------------------------ *
 * أنماط أخطائك — من التصحيحات التي كتبتَها
 * ------------------------------------------------------------------ */

/**
 * أي نوعٍ من الخطأ يتكرّر عندك — **بأمثلته**.
 *
 * ⚠️ ولا تُقال نسبة *(راجع `NOT_MEASURED.errorRate`)*: المقام مجهول.
 *    «١٢ تصحيح في جنس الكلمة» واقعةٌ، و«٪٣٠ من كلامك خطأ» اختراع.
 */
export async function mistakePatterns({ examples = 3 } = {}) {
  const [rows, sceneRows] = await Promise.all([
    mistakeComparisons.getAll(),
    scenes.getActive(),
  ]);
  const live = new Map(sceneRows.map((s) => [s.id, s]));

  // خطأٌ في ذكرى محذوفة لا يُعَدّ: العدّ يشير إلى ما يُفتَح.
  const alive = rows
    .filter((row) => row.state === STATE.ACTIVE && live.has(row.sceneId))
    /*
     * ⚠️ **الأحدث أوّلًا، وبفاصلٍ قاطع.** `getAll()` تعود بترتيب المفتاح
     *    — ومعرّفاتنا عشوائيّة، فكانت «أوّل ثلاثة أمثلة» تعني ثلاثةً
     *    بلا معنى، تختلف من قاعدةٍ لأخرى. والأحدث أنفع: هو ما تتذكّره.
     *
     * ⚠️ والفاصل بالمعرّف ليس زينة: تصحيحان في نفس الميلّية لهما
     *    `createdAt` واحد، فبلا فاصلٍ يصير ترتيبهما رهن تنفيذ `sort`.
     *    (كشفه اختبارٌ سقط بعد أن مرّ مرّتين — كان ينجح بالحظّ.)
     */
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      || String(a.id).localeCompare(String(b.id)));

  const byType = new Map();
  for (const row of alive) {
    const id = row.mistakeType || 'other';
    const entry = byType.get(id) || { id, label: mistakeLabel(id), count: 0, items: [] };
    entry.count += 1;
    if (entry.items.length < examples) {
      entry.items.push({
        id: row.id,
        sceneId: row.sceneId,
        sceneTitle: live.get(row.sceneId).titleAr || live.get(row.sceneId).titleRu || 'ذكرى',
        wrong: row.wrong || '',
        natural: row.natural || '',
        explanation: row.explanation || '',
      });
    }
    byType.set(id, entry);
  }

  return {
    total: alive.length,
    types: [...byType.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

function mistakeLabel(id) {
  return MISTAKE_TYPES.find((t) => t.id === id)?.label || 'أخرى';
}

/* ------------------------------------------------------------------ *
 * ما تلتقطه ولماذا
 * ------------------------------------------------------------------ */

/**
 * أسباب التقاطك — «صعبة» أم «نطقها صعب» أم غير ذلك.
 *
 * ⚠️ **ولا يُقرأ منه حجم مفرداتك** *(راجع `NOT_MEASURED.vocabularySize`)*.
 *    هذا سجلّ ما استوقفك، وهو عكس ما صار عاديًّا عندك.
 */
export async function captureReasons() {
  const [rows, tags] = await Promise.all([savedItems.getAll(), listSavedTags()]);
  const alive = rows.filter((row) => row.state === STATE.ACTIVE);
  const label = new Map(tags.map((t) => [t.id, t.label]));

  const byTag = new Map();
  let untagged = 0;
  for (const row of alive) {
    const ids = row.tagIds || [];
    if (!ids.length) {
      untagged += 1;
      continue;
    }
    for (const id of ids) {
      const entry = byTag.get(id) || { id, label: label.get(id) || id, count: 0 };
      entry.count += 1;
      byTag.set(id, entry);
    }
  }

  return {
    total: alive.length,
    // بلا تصنيف ليس صفرًا ولا عيبًا — يُعرَض كما هو.
    untagged,
    tags: [...byTag.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

/* ------------------------------------------------------------------ *
 * أين لغتك تعيش فعلًا
 * ------------------------------------------------------------------ */

/**
 * المواقف والأماكن والناس التي تحدث فيها روسيّتك.
 *
 * ⚠️ **يُقرأ من الأطلس لا من عدٍّ جديد**: نفس `facetTree` التي تبني
 *    شاشة المحاور. عدّان لشيءٍ واحد يفترقان يومًا، والمستخدم يرى
 *    رقمين مختلفين لنفس السؤال.
 */
export async function whereRussianLives({ limit = 5 } = {}) {
  const tree = await facetTree();
  const byCount = (a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label), 'ar');

  /*
   * ⚠️ `tree.types` تعود **بلا وسمٍ وبلا ترتيب** — الوسم يُقرأ من خدمة
   *    الأنواع (فالاسم يتغيّر ولا يتغيّر المعرّف)، والترتيب من عندنا.
   *    الأطلس يرتّب أماكنه وأشخاصه ولا يرتّب أنواعه، وقراءتها كأنها
   *    مرتّبة تعطي «أكتر خمسة» عشوائيّة.
   */
  const types = tree.types
    .map((row) => ({ ...row, label: typeLabel(row.id) }))
    .sort(byCount);

  const top = (rows) => rows.slice(0, limit).map((row) => ({ ...row }));
  return { types: top(types), places: top(tree.places), people: top(tree.people) };
}

/* ------------------------------------------------------------------ *
 * إيقاعك — واقعةٌ لا حكم
 * ------------------------------------------------------------------ */

/**
 * كل كم تُسجّل ذكرى.
 *
 * ⚠️ **ولا يُقرأ منه تقدّم** *(راجع `NOT_MEASURED.progress`)*: شهرٌ بلا
 *    تسجيل قد يكون شهر سفرٍ تكلّمت فيه روسيًّا كل يوم. الرقم يقول متى
 *    كتبتَ، لا متى عشتَ.
 */
export async function rhythm() {
  const rows = (await scenes.getActive())
    .map((s) => toISODate(s.date) || s.date)
    .filter(Boolean)
    .sort();

  if (!rows.length) return { total: 0, days: 0, span: 0, longestGap: null, byMonth: [] };

  const days = [...new Set(rows)];
  let longestGap = null;
  for (let i = 1; i < days.length; i += 1) {
    const gap = daysBetween(days[i - 1], days[i]);
    if (!longestGap || gap > longestGap.days) {
      longestGap = { days: gap, from: days[i - 1], to: days[i] };
    }
  }

  const byMonth = new Map();
  for (const day of rows) {
    const key = day.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  }

  return {
    total: rows.length,
    days: days.length,
    span: daysBetween(days[0], days.at(-1)),
    longestGap,
    byMonth: [...byMonth.entries()].map(([month, count]) => ({ month, count })).sort(
      (a, b) => a.month.localeCompare(b.month)
    ),
  };
}

/* ------------------------------------------------------------------ *
 * ما تمرّنت عليه — ممارسةٌ لا إتقان
 * ------------------------------------------------------------------ */

/**
 * دليل الممارسة كما هو.
 *
 * ⚠️ صفوف `practiceEvidence` تحمل `impliesMastery: false` و
 *    `impliesRealUsage: false` **مكتوبةً فيها**. فلا نقرأ منها إلا ما
 *    تقوله: تكرارٌ حدث في يومٍ ما. ونُعيد العلَمين مع الرقم كي لا
 *    تُقرأ الشاشة القادمة له على غير معناه.
 */
export async function practiceReality() {
  const rows = await practiceEvidence.getAll();
  const days = new Set();
  let repetitions = 0;
  for (const row of rows) {
    repetitions += row.repetitions || 0;
    if (row.practicedAt) days.add(new Date(row.practicedAt).toISOString().slice(0, 10));
  }

  return {
    sessions: new Set(rows.map((row) => row.sessionId)).size,
    repetitions,
    days: days.size,
    meansMastery: false,
    meansRealUsage: false,
  };
}

/* ------------------------------------------------------------------ *
 * الكل معًا
 * ------------------------------------------------------------------ */

/** كل ما يُشتقّ، في نداءٍ واحد للشاشة. */
export async function analysisOverview(options = {}) {
  const [mistakes, captures, where, cadence, practice, occurrences] = await Promise.all([
    mistakePatterns(options),
    captureReasons(),
    whereRussianLives(options),
    rhythm(),
    practiceReality(),
    expressionOccurrences.getAll(),
  ]);

  return {
    mistakes,
    captures,
    where,
    rhythm: cadence,
    practice,
    expressionAppearances: occurrences.filter((row) => row.state === STATE.ACTIVE).length,
    notMeasured: NOT_MEASURED,
  };
}

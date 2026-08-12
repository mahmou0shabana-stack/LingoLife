/**
 * LingoLife — الدفعة: خطّةٌ ثم معاينةٌ ثم كتابةٌ يمكن التراجع عنها
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا خطّةٌ قبل الكتابة — وهو نفس درس الاستيراد
 * ═══════════════════════════════════════════════════════════════
 *
 * WS2 تعلّم هذا في الاستيراد: لا تُكتب حزمةٌ في ذاكرتك قبل أن تُعرَض
 * عليك. وهنا الحاجة أشدّ — الاستيراد يكتب ذكرى واحدة، والدفعة تكتب
 * في **مئتين**. وإصلاحُ مئتين بيدك ليس إصلاحًا، هو يومٌ ضائع.
 *
 * فالخطّة تُبنى ولا تكتب شيئًا، وتقول لكل صفّ: **قبل ← بعد**، وأيُّ
 * صفٍّ لن يتغيّر أصلًا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا **لا** تتراجع الدفعة كلّها عند فشل صفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا **يخالف** `applyImport` عمدًا، والفرق حقيقيّ لا مزاجيّ:
 *
 *  · الاستيراد يبني **شيئًا واحدًا مترابطًا** — ذكرى بمحادثتها
 *    وتعبيراتها. ونصفُها أسوأ من لا شيء: تظنّها كاملة فلا تُعيدها.
 *
 *  · والدفعة **مئتا تعديلٍ مستقلّ**. سقوطُ الصفّ رقم ١٧٣ لا يُفسد
 *    ١٧٢ صفًّا قبله — ومحوُها لأجله يعني أن تخسر عملًا صحيحًا بسبب
 *    خطأٍ لا علاقة له به.
 *
 * فتمضي الدفعة، ويُقال **بالعدد ما نجح وما فشل ولماذا**. والتراجع
 * يبقى متاحًا عمّا كُتب فعلًا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وحدُّ التراجع مُعلَن
 * ═══════════════════════════════════════════════════════════════
 *
 * التراجع يعيش في الذاكرة، فينتهي بإغلاق التطبيق. ولم يُبنَ سجلٌّ
 * دائم لأنه يعني مستودعًا جديدًا وترقيةَ قاعدة ينمو معها ملفٌّ بلا
 * سقف — ثمنٌ لم تُثبت الحاجةُ إليه بعد.
 *
 * والحدّ يُقال في الشاشة لا في هذا التعليق وحده، ومعه النصيحة
 * الوحيدة الصادقة قبل دفعةٍ كبيرة: خُذ نسخة `.llife`.
 */

import { scenes } from '../../db/repositories.js';
import { aspectById, applyAspect, FILL } from './aspects.js';
import { readWorld, impactOf } from './census.js';

/** فوق هذا العدد تُطلَب موافقةٌ صريحة — لا مجرّد ضغطة. */
export const LARGE_BATCH = 50;

/* ------------------------------------------------------------------ *
 * الخطّة — تقرأ ولا تكتب
 * ------------------------------------------------------------------ */

/**
 * يبني خطّة دفعة. **لا يكتب شيئًا.**
 *
 * @param {object} input
 * @param {string} input.aspectId
 * @param {*} input.value          القيمة الواحدة للدفعة
 * @param {string[]} input.sceneIds
 * @param {object} [input.world]
 */
export async function planBatch({ aspectId, value, sceneIds, world = null }) {
  const aspect = aspectById(aspectId);
  if (!aspect) throw new Error(`وجه إثراء مش معروف: ${aspectId}`);
  if (!aspect.bulk) {
    throw new Error(aspect.bulkReason || `«${aspect.label}» مايتكتبش دفعة واحدة`);
  }

  const w = world || await readWorld();
  const wanted = new Set(sceneIds || []);
  const byId = new Map(w.scenes.map((row) => [row.id, row]));

  const rows = [];
  const dropped = [];

  for (const id of wanted) {
    const scene = byId.get(id);
    /*
     * ⚠️ الخطّة تُبنى على القاعدة قبل لحظات؛ قد تكون الذكرى حُذفت
     *    بينهما. الكتابة في معرّفٍ لا صاحب له تُنتج أيتامًا لا تظهر
     *    في شاشة — وهو الدرس نفسه من `applyImport`.
     */
    if (!scene) {
      dropped.push({ id, reason: 'الذكرى دي مابقتش موجودة — يمكن اتحذفت وإنت بتراجع' });
      continue;
    }
    const before = aspect.current(scene, w);
    const after = previewAfter(aspect, before, value, w);
    rows.push({
      id,
      title: scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان',
      date: scene.date,
      before,
      after,
      /** صفٌّ لن يتغيّر لا يُكتب ولا يُعَدّ — ويُقال إنه كذلك. */
      changes: after !== before && after !== '',
    });
  }

  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.id.localeCompare(b.id));

  const willWrite = rows.filter((row) => row.changes);
  return {
    aspectId,
    aspectLabel: aspect.label,
    fill: aspect.fill,
    value,
    valueLabel: labelOfValue(aspect, value, w),
    rows,
    dropped,
    willWrite: willWrite.length,
    unchanged: rows.length - willWrite.length,
    large: willWrite.length > LARGE_BATCH,
    impact: impactOf(aspectId, value, willWrite.map((row) => row.id), w),
    world: w,
  };
}

/** «بعد» كما ستبدو — إضافةً أو إحلالًا. */
function previewAfter(aspect, before, value, world) {
  const incoming = labelOfValue(aspect, value, world);
  if (!incoming) return before;
  if (aspect.fill === FILL.SET) return incoming;

  // إضافة: القائم ثم الجديد، بلا تكرارٍ في العرض.
  const parts = before ? before.split('، ').filter(Boolean) : [];
  for (const piece of incoming.split('، ')) {
    if (piece && !parts.includes(piece)) parts.push(piece);
  }
  return parts.join('، ');
}

/** اسمُ القيمة كما يقرؤه إنسان — لا معرّفها. */
function labelOfValue(aspect, value, world) {
  if (aspect.id === 'participants') {
    const ids = Array.isArray(value) ? value : [value].filter(Boolean);
    return ids.map((id) => world.personName.get(id)).filter(Boolean).join('، ');
  }
  if (aspect.id === 'thread') return world.threadTitle.get(String(value || '')) || '';
  return String(value || '').trim();
}

/* ------------------------------------------------------------------ *
 * الدفتر — ما كُتب، وكيف يُمحى
 * ------------------------------------------------------------------ */

/**
 * دفترُ خطواتٍ عكسيّة.
 *
 * ⚠️ كلُّ خطوةٍ تُسجَّل **لحظة نجاحها** لا قبلها: قيدٌ يسبق الكتابة
 *    يجعل التراجع يحاول عكسَ ما لم يحدث.
 */
function journal() {
  const steps = [];
  return {
    undo(fn) {
      steps.push(fn);
    },
    get size() {
      return steps.length;
    },
    async rollback() {
      // بالعكس: آخرُ ما كُتب أوّلُ ما يُمحى.
      for (let i = steps.length - 1; i >= 0; i -= 1) {
        await steps[i]().catch(() => {});
      }
      steps.length = 0;
    },
  };
}

/* ------------------------------------------------------------------ *
 * التنفيذ
 * ------------------------------------------------------------------ */

/**
 * ينفّذ خطّة.
 *
 * @param {object} plan مخرَج `planBatch`
 * @returns {Promise<object>} التقرير — ومعه `undo()` ما دامت الجلسة
 */
export async function applyBatch(plan) {
  if (!plan) throw new Error('مفيش خطّة ننفّذها');

  const aspect = aspectById(plan.aspectId);
  if (!aspect) throw new Error(`وجه إثراء مش معروف: ${plan.aspectId}`);

  const book = journal();
  const written = [];
  const failed = [];
  const skipped = [];

  const byId = new Map(plan.world.scenes.map((row) => [row.id, row]));

  for (const row of plan.rows) {
    if (!row.changes) {
      skipped.push({ id: row.id, title: row.title, reason: 'مفيش تغيير — القيمة دي موجودة عندها' });
      continue;
    }

    /*
     * ⚠️ تُقرأ الذكرى من القاعدة **الآن** لا من لقطة الخطّة: الخطّة
     *    قد تكون بُنيت قبل دقيقة، وقيمةٌ تغيّرت بينهما تعني أن قيد
     *    التراجع سيعيد قيمةً قديمةً بالخطأ.
     */
    let fresh = null;
    try {
      fresh = await scenes.get(row.id);
    } catch {
      fresh = null;
    }
    if (!fresh) {
      failed.push({ id: row.id, title: row.title, reason: 'الذكرى مابقتش موجودة' });
      continue;
    }

    try {
      const touched = await applyAspect(aspect, fresh, plan.value, plan.world, book);
      if (touched) written.push({ id: row.id, title: row.title });
      else skipped.push({ id: row.id, title: row.title, reason: 'مفيش تغيير' });
    } catch (error) {
      /*
       * ⚠️ نمضي ولا نتراجع عن الكلّ — راجع رأس الملفّ. وسببُ الفشل
       *    يُحفَظ بنصّه: «فشل ٢» بلا سبب لا يُصلَح.
       */
      failed.push({ id: row.id, title: row.title, reason: error.message || String(error) });
    }
  }

  return {
    ok: failed.length === 0,
    aspectId: plan.aspectId,
    aspectLabel: plan.aspectLabel,
    valueLabel: plan.valueLabel,
    written,
    failed,
    skipped,
    dropped: plan.dropped,
    counts: {
      written: written.length,
      failed: failed.length,
      skipped: skipped.length,
      dropped: plan.dropped.length,
    },
    /** التراجع متاحٌ ما دامت الجلسة — والحدّ مُعلَنٌ في الشاشة. */
    undoable: book.size > 0,
    undo: async () => {
      await book.rollback();
    },
  };
}

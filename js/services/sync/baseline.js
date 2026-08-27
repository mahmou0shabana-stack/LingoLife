/**
 * LingoLife — خطُّ الأساس: نشرُ ما وُجد قبل السجلّ (WS-H · العطبُ الحقيقيّ)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **العطبُ الذي جاء منه هذا الملفّ — بحرفه**
 * ═══════════════════════════════════════════════════════════════
 *
 * ترقيةُ v17 تُنشئ `changeLog` **فارغًا**، وتعليقُها يشرح لماذا: أن
 * تختلق للصفوف القديمة مؤلِّفًا وترتيبًا لم يوجدا كذبٌ على المحرّك.
 * وهذا صحيح.
 *
 * لكنّ التعليقَ يكمل: «وثمنُ ذلك مصرَّحٌ به: أوّلُ مصافحةٍ تحتاج
 * **مصالحةً كاملة** — وهي مبنيّةٌ ومختبَرة».
 *
 * **ولم تكن مبنيّة.** `grep` عن `baseline` في الشجرة كلِّها لم يجد إلّا
 * ذلك التعليق. والاختباران اللذان يزعمان تغطيتَها (٤٦ و٤٧ في
 * `sync.test.js`) يبنيان بياناتِهما **بعد** وجود السجلّ — فالسجلُّ
 * ممتلئٌ عندهما، والحزمةُ التفاضليّةُ تحمل كلَّ شيءٍ صدفةً. أي أنهما
 * يختبران المسارَ العاديَّ باسمٍ آخر، ولا يمسّان الحالةَ الحقيقيّة قطّ.
 *
 * والنتيجةُ على جهازٍ حقيقيّ:
 *
 *   تابلت فيه ٩١ ملفًّا ومئاتُ الصفوف، كلُّها أقدمُ من v17
 *     → `changeLog` فارغ
 *     → `createSyncPackage` تبني من السجلّ وحدَه → صفرُ تغييرات
 *     → `pushLocal` ترجع `{uploaded: false}` **ولا ترفع شيئًا**
 *     → الموبايلُ لا يجد حزمةً واحدةً فيطبّق صفرًا
 *     → والاثنان يقولان «كل حاجة متزامنة».
 *
 * لا استثناءَ رُمي، ولا سطرَ أحمرَ في أيّ دفتر. نجاحٌ كاذبٌ تامّ.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا الحلُّ سطورُ سجلٍّ لا صيغةُ حزمةٍ ثانية**
 * ═══════════════════════════════════════════════════════════════
 *
 * كان يمكن أن نخترع «حزمةَ خطِّ أساس» بصيغةٍ خاصّةٍ ومسارِ تطبيقٍ خاصّ.
 * وذلك يعني: مُحقِّقًا ثانيًا، ومخطِّطَ دمجٍ ثانيًا، وحسمَ تعارضٍ ثانيًا —
 * أي **محرّكَ مزامنةٍ ثانيًا** بكلّ ما فيه من فرصٍ للاختلاف عن الأوّل.
 *
 * فالأصحُّ أن نصلح **المُدخَل** لا أن نضيف مخرجًا: السجلُّ ناقصٌ، فنُكمله.
 * وبعدها يمشي كلُّ شيءٍ في نفس السطور التي اختُبرت مئاتِ المرّات —
 * نفسُ `createSyncPackage`، ونفسُ `planMerge`، ونفسُ `applyMerge`،
 * ونفسُ الحتميّةِ ومنعِ التكرار.
 *
 * ⚠️ **ولا ترقيةَ مخطَّط.** `changeLog` مخزنٌ قائمٌ منذ v17؛ وهذه صفوفٌ
 *    عاديّةٌ فيه. فـ`TARGET_VERSION` لا يتحرّك، والنسخةُ الاحتياطيّةُ
 *    القائمةُ تبقى صالحةً للاسترجاع كما هي.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والشروطُ الأربعة التي طُلبت — وأين تُنفَّذ**
 * ═══════════════════════════════════════════════════════════════
 *
 *   حتميّةٌ (idempotent)  الصفُّ الذي له سطرٌ في السجلّ لا يُكتَب له ثانٍ.
 *                        فتشغيلُها عشرَ مرّاتٍ = تشغيلُها مرّة.
 *   قابلةٌ للاستئناف     دفعاتٌ محدودة، وكلُّ دفعةٍ معاملةٌ مستقلّة.
 *                        فانقطاعٌ في المنتصف يترك ما كُتب صحيحًا.
 *   آمنةٌ عند الإعادة    لا تلمس صفَّ بياناتٍ واحدًا — تكتب في السجلّ فقط.
 *   محدودةُ الحجم        `batch` صفًّا في المعاملة الواحدة.
 */

import { withTx, req } from '../../db/database.js';
import { STORE_NAMES } from '../../db/schema.js';
import { LOG_STORE, OP, appendLocal } from './change-log.js';
import { logged } from './sync-policy.js';

/** المخازنُ التي تدخل خطَّ الأساس — نفسُ ما يدخل الحزمَ بالضبط. */
export function baselineStores() {
  return STORE_NAMES.filter((name) => {
    try {
      return logged(name);
    } catch {
      /*
       * ⚠️ ومخزنٌ بلا سياسةٍ لا يُخمَّن له حكم. `policyOf` ترمي عمدًا،
       *    وابتلاعُ ذلك هنا يعني نشرَ مخزنٍ لم يقرّر أحدٌ أنه يُنشَر.
       */
      return false;
    }
  });
}

/**
 * مفاتيحُ (مخزن، صفّ) التي يعرفها السجلُّ بالفعل.
 *
 * ⚠️ **وتُقرأ مرّةً واحدةً لكلّ جولة.** لا فهرسَ على (store, recordId)
 *    في `changeLog`، والسؤالُ عن كلّ صفٍّ على حدةٍ يعني آلافَ القراءات.
 *    والسجلُّ محدودٌ بعدد تعديلاتك الفعليّة لا بعدد صفوفك، فقراءتُه
 *    كاملًا مرّةً أرخصُ بكثير.
 */
/*
 * ⚠️ **والفاصلُ يُكتَب `\u0000` هروبًا لا حرفًا خامًا — وقد كلّفني هذا مرّتين.**
 *
 *    كتبتُه أوّلَ مرّةٍ حرفًا غيرَ مرئيٍّ داخل القالب، فصار الملفُّ في
 *    نظر `grep` و`file` **ملفًّا ثنائيًّا**، ولا يظهر في بحثٍ نصّيّ.
 *    ثم نظّفتُ البايتات فاختفى الفاصلُ أصلًا والتصق المفتاحان:
 *    `('ab','c')` و`('a','bc')` صارا مفتاحًا واحدًا — تصادمٌ صامتٌ
 *    يعني تخطّي صفٍّ يستحقّ النشر.
 *
 *    فالهروبُ يحلّ الاثنين: مرئيٌّ في المصدر، وصفرُ احتمالِ ورودِه في
 *    اسم مخزنٍ أو معرِّفِ صفّ.
 */
const keyOf = (store, id) => `${store}\u0000${id}`;

async function coveredKeys() {
  const rows = await withTx(LOG_STORE, 'readonly', (tx) =>
    req(tx.objectStore(LOG_STORE).getAll()));
  const set = new Set();
  for (const row of rows) set.add(keyOf(row.store, row.recordId));
  return set;
}

/**
 * كم صفًّا ما زال خارجَ السجلّ — قراءةٌ بلا كتابة.
 *
 * تُنادى قبل المزامنة لتقول للمستخدم «فيه ٤١٢ صفًّا لسه ما اتنشروش»،
 * ولتقرّر الشاشةُ هل تعرض مرحلةَ خطِّ الأساس أصلًا.
 */
export async function baselineStatus() {
  const covered = await coveredKeys();
  const stores = baselineStores();
  const perStore = {};
  let pending = 0;
  let total = 0;

  for (const name of stores) {
    /* eslint-disable-next-line no-await-in-loop -- مخزنٌ بعد مخزن */
    const ids = await withTx(name, 'readonly', (tx) =>
      req(tx.objectStore(name).getAllKeys()));
    total += ids.length;
    const missing = ids.filter((id) => !covered.has(keyOf(name, id))).length;
    if (missing) perStore[name] = missing;
    pending += missing;
  }

  return { pending, total, perStore, stores: stores.length };
}

/**
 * ينشر ما وُجد قبل السجلّ — بكتابة سطورٍ له، لا بمسٍّ للبيانات.
 *
 * @param {object} [options]
 * @param {number} [options.batch] كم صفًّا في المعاملة الواحدة.
 * @param {number} [options.limit] سقفُ هذه الجولة — للاستئناف على دفعات.
 * @param {(p: {store: string, done: number, total: number}) => void} [options.onProgress]
 * @returns {Promise<{written: number, remaining: number, byStore: object}>}
 */
export async function publishBaseline({ batch = 200, limit = Infinity, onProgress } = {}) {
  const covered = await coveredKeys();
  const stores = baselineStores();
  const byStore = {};
  let written = 0;

  /* المجموعُ يُحسَب أوّلًا كي يكون التقدُّمُ نسبةً حقيقيّةً لا تخمينًا. */
  const plan = [];
  for (const name of stores) {
    /* eslint-disable-next-line no-await-in-loop */
    const ids = await withTx(name, 'readonly', (tx) =>
      req(tx.objectStore(name).getAllKeys()));
    const missing = ids.filter((id) => !covered.has(keyOf(name, id)));
    if (missing.length) plan.push({ store: name, ids: missing });
  }
  const total = plan.reduce((sum, row) => sum + row.ids.length, 0);
  let done = 0;

  for (const { store, ids } of plan) {
    for (let i = 0; i < ids.length; i += batch) {
      if (written >= limit) {
        return { written, remaining: total - done, byStore, complete: false };
      }
      const slice = ids.slice(i, i + batch);

      /*
       * ⚠️ **والصفُّ يُقرأ داخل نفس معاملة الكتابة.** قراءتُه خارجَها ثم
       *    الكتابةُ بعدها تفتح نافذةً يُحذَف فيها الصفُّ بينهما — فنكتب
       *    سطرَ «إنشاء» لصفٍّ لم يعد موجودًا، ويصل الجارَ شبحٌ.
       */
      /* eslint-disable-next-line no-await-in-loop -- دفعةٌ بعد دفعة، عمدًا */
      const count = await withTx([store, LOG_STORE], 'readwrite', async (tx) => {
        const os = tx.objectStore(store);
        const entries = [];
        for (const id of slice) {
          /* eslint-disable-next-line no-await-in-loop */
          const row = await req(os.get(id));
          if (!row) continue;
          entries.push({
            store,
            recordId: id,
            op: OP.PUT,
            rev: row.rev ?? null,
            /*
             * ⚠️ **`baseRev: null` و`fields: null` — أي «الصفُّ كلُّه، بلا أساس».**
             *    وهو الصدقُ بعينه: لا نعرف من أيّ حالٍ جاء هذا الصفّ،
             *    ولا يحقّ لنا أن ندّعي أساسًا. والمخطِّطُ يقرأ ذلك على
             *    أنه «إنشاء»، فإن كان عند الجار صفٌّ بنفس المعرِّف
             *    عالجه بقواعد الالتقاء القائمة ولم يُمحَ شيءٌ بصمت.
             */
            baseRev: null,
            fields: null,
          });
        }
        if (!entries.length) return 0;
        await appendLocal(tx, entries);
        return entries.length;
      });

      written += count;
      byStore[store] = (byStore[store] || 0) + count;
      done += slice.length;
      onProgress?.({ store, done, total });
    }
  }

  return { written, remaining: 0, byStore, complete: true };
}

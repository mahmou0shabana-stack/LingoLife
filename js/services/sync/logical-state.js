/**
 * LingoLife — الحالةُ المنطقيّة (WS-G · بندا ٨٧ و٨٨)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **التقاءُ الجهازين ليس تطابقَ بايتات**
 * ═══════════════════════════════════════════════════════════════
 *
 * قاعدتان متطابقتان منطقيًّا تختلفان حتمًا في: معرِّف الجهاز، وسجلّ
 * التغيير، وعدّاد `rev` عند كلٍّ منهما، والبايتات التي لم تُنزَّل بعد،
 * والإعدادات المحلّيّة. فمقارنةُ الخام تفشل دائمًا — ولا تقول شيئًا.
 *
 * وهذا الملفّ يجرّد ما **يجب** أن يتطابق، ويستثني ما **يجب** ألّا
 * يتطابق، صراحةً وبسببٍ مكتوبٍ لكلّ استثناء.
 *
 * ⚠️ **ولا يُقارَن بالعدد.** «١٢٧ صفًّا هنا و١٢٧ هناك» يمرّ وفيه صفٌّ
 *    مختلفُ المحتوى وصفٌّ ناقص. المقارنةُ **بالمحتوى المرتَّب**.
 */

import { withTx, req } from '../../db/database.js';
import { STORES } from '../../db/schema.js';
import { CATEGORY, policyOf, settingShared, syncable } from './sync-policy.js';
import { edgeKey } from './merge-planner.js';

/**
 * حقولٌ لا تدخل المقارنة أبدًا.
 *
 * `rev`       عدّادُ كتاباتٍ **محلّيّ**. الجهازُ الذي ألّف التعديل يرفعه،
 *             والجهازُ الذي استقبله يكتب الحقولَ ولا يزعم تأليفًا. فهو
 *             لا يتطابق ولا يجب أن يتطابق — والإصدارُ الحقيقيُّ في
 *             متّجه السجلّ لا هنا.
 * `updatedAt` ساعةُ الكاتب. وبند ٣٢ يمنع الاعتمادَ عليها أصلًا.
 * `dirty`     علامةُ رفعٍ محلّيّة.
 */
const NOT_COMPARED = new Set(['rev', 'updatedAt', 'dirty']);

/**
 * حقولُ الوسائط التي تصف **ما عند هذا الجهاز** لا ما في العالم.
 *
 * ⚠️ وبند ٨٧ يستثني «البايتاتِ التي لم تُنزَّل عمدًا» بالاسم: التابلت
 *    عنده الصورة والموبايل عنده وصفُها، وكلاهما على حقّ.
 */
const BLOB_FIELDS = new Set(['blob', 'thumbBlob', 'blobPending']);

/**
 * ⚠️ **وتاريخُ إنشاء الصفّ المدمج ليس بياناتِك — هو تاريخُ أوّل تشغيل**
 *
 * كُشف بالقياس: جهازان لم يُستنسَخ أحدُهما من الآخر يحملان `eventTypes`
 * بنفس المعرِّفات بالضبط (`meeting` و`call`… مجمَّدةٌ في `seeds.js`)
 * وبـ`createdAt` مختلف — لأن ترقيةَ v7 تبذرها بـ`Date.now()` عند أوّل
 * فتحٍ لكلّ قاعدة.
 *
 * وهي **لا تُزامَن ولا يجب**: يبذرها التطبيقُ بنفسه على كلّ جهاز، فهي
 * موجودةٌ عند الجميع بالضرورة، ولا سطرَ سجلٍّ لها لأنها ليست كتابةَ
 * مستخدم. والفرقُ الوحيدُ بينها لحظةُ أوّل تشغيل — وهي خاصّةُ تركيبٍ
 * كمعرِّف الجهاز نفسِه.
 *
 * ⚠️ **ولا تُعالَج بتعديل الترقية**: v7 منشورةٌ، وتعديلُ ترقيةٍ منشورةٍ
 *    ممنوعٌ بنصّ `docs/03 §3.6`. فالعلاجُ في المقارنة لا في الماضي.
 */
function normalizeRecord(store, record) {
  const policy = policyOf(store);
  const local = new Set(policy.localFields || []);
  const seeded = record?.builtIn === true;
  const out = {};
  for (const key of Object.keys(record).sort()) {
    if (NOT_COMPARED.has(key)) continue;
    if (seeded && key === 'createdAt') continue;
    if (local.has(key)) continue;
    if (policy.category === CATEGORY.BLOB_METADATA && BLOB_FIELDS.has(key)) continue;
    const value = record[key];
    if (value instanceof Blob) continue;
    out[key] = value;
  }
  return out;
}

/**
 * لقطةٌ منطقيّةٌ من القاعدة النشطة — مرتَّبةٌ ترتيبًا حتميًّا.
 *
 * @returns {Promise<Record<string, any[]>>}
 */
export async function logicalState() {
  const stores = Object.keys(STORES).filter(syncable);
  return withTx(stores, 'readonly', async (tx) => {
    const out = {};
    for (const store of stores) {
      /* eslint-disable-next-line no-await-in-loop -- مخزنٌ بعد مخزنٍ في معاملةٍ واحدة */
      const rows = await req(tx.objectStore(store).getAll());

      if (store === 'settings') {
        /*
         * ⚠️ **ولا يُقارَن إلّا المشترك.** «آخرُ شاشة» و«نسبةُ الانقسام»
         *    يجب أن تختلفا بين الجهازين — وإدخالُهما في المقارنة يجعل
         *    الالتقاءَ مستحيلًا ويجعل الاختبارَ يكذب.
         */
        out[store] = rows
          .filter((row) => settingShared(row.key))
          .map((row) => ({ key: row.key, value: row.value }))
          .sort((a, b) => (a.key < b.key ? -1 : 1));
        continue;
      }

      if (store === 'relationships') {
        /*
         * ⚠️ **والحافّةُ تُقارَن بطرفيها لا بمعرِّفها.** الجهازان
         *    يلتقيان على معرِّفٍ واحدٍ بعد الدمج (أصغرُ المعرِّفين)،
         *    لكنّ المقارنةَ بالمعرِّف تجعل الاختبارَ يفحص **آليّةَ
         *    الاختيار** بدل أن يفحص **المعنى**: هل الرابطُ موجودٌ عند
         *    الاثنين؟
         */
        out[store] = rows
          .map((row) => ({
            edge: edgeKey(row),
            order: row.order ?? null,
            note: row.note ?? '',
            state: row.state ?? null,
          }))
          .sort((a, b) => (a.edge < b.edge ? -1 : a.edge > b.edge ? 1 : 0));
        continue;
      }

      const keyPath = STORES[store].keyPath || 'id';
      out[store] = rows
        .map((row) => normalizeRecord(store, row))
        .sort((a, b) => (String(a[keyPath]) < String(b[keyPath]) ? -1 : 1));
    }
    return out;
  });
}

/**
 * يقارن لقطتين ويصف الفرقَ بدقّة — لا `true/false` وحده.
 *
 * ⚠️ **ورسالةُ الفشل هي المنتَج**: اختبارٌ يقول «لم يتطابقا» يُرسلك
 *    تبحث ساعةً؛ واختبارٌ يقول «`scripts` · `SCR_…` · `title`: هنا كذا
 *    وهناك كذا» يُنهي البحثَ قبل أن يبدأ.
 */
export function diffLogical(a, b) {
  const differences = [];
  const stores = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();

  for (const store of stores) {
    const left = a[store] || [];
    const right = b[store] || [];
    if (left.length !== right.length) {
      differences.push({ store, kind: 'count', left: left.length, right: right.length });
    }
    const max = Math.max(left.length, right.length);
    for (let i = 0; i < max; i++) {
      const one = JSON.stringify(left[i] ?? null);
      const two = JSON.stringify(right[i] ?? null);
      if (one !== two) differences.push({ store, kind: 'row', index: i, left: left[i] ?? null, right: right[i] ?? null });
    }
  }

  return { same: differences.length === 0, differences };
}

/** سطرٌ واحدٌ يصف أوّلَ فرق — لرسائل الاختبار. */
export function describeDiff(diff) {
  if (diff.same) return 'الحالتان متطابقتان منطقيًّا';
  const first = diff.differences[0];
  if (first.kind === 'count') {
    return `${first.store}: ${first.left} صفًّا هنا و${first.right} هناك (وفروقٌ أخرى: ${diff.differences.length - 1})`;
  }
  return `${first.store} صفّ ${first.index}:\nهنا:  ${JSON.stringify(first.left)}\nهناك: ${JSON.stringify(first.right)}`;
}

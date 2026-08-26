/**
 * LingoLife — طبقة الـ Repositories
 *
 * غلاف موحّد فوق IndexedDB. كل الـ services تمرّ من هنا.
 * يتولّى: ختم الحقول المشتركة، زيادة rev، وسم dirty للمزامنة،
 * والانتقال بين الحالات الثلاث (active / archived / trashed).
 */

import { withTx, req } from './database.js';
import { STATE, STORES } from './schema.js';
import { newId } from '../utils/ids.js';
import { logged } from '../services/sync/sync-policy.js';
import { appendLocal, changedFields, LOG_STORE, OP } from '../services/sync/change-log.js';

/**
 * يختم سجلًا جديدًا بالحقول المشتركة.
 * @param {object} data
 * @param {string} prefix — بادئة المعرّف
 */
export function stampNew(data, prefix) {
  const now = Date.now();
  return {
    id: data.id || newId(prefix),
    createdAt: now,
    updatedAt: now,
    rev: 1,
    state: STATE.ACTIVE,
    deletedAt: null,
    dirty: 1, // 1/0 وليس true/false — IndexedDB لا تفهرس القيم المنطقية
    ...data,
  };
}

/**
 * يحدّث الطوابع عند التعديل.
 *
 * ⚠️ **و`rev` عدّادُ كتاباتٍ محلّيٌّ لا إصدارٌ عالميّ.** كان مكتوبًا هنا
 *    «`rev` هو أساس كشف تعارض المزامنة»، وقد تبيّن أنه لا يصلح لذلك:
 *    `rev: 7` يقول «كُتب سبعَ مرّات» ولا يقول **أيَّ حقلٍ** ولا **مَن**.
 *    وأساسُ الكشف الفعليّ **متّجهُ الإصدارات** في `changeLog` (WS-G).
 *    ويبقى `rev` نافعًا لسببٍ واحد: تشخيصٌ يقرؤه الإنسان في التعارض.
 */
export function stampUpdate(record, changes) {
  return {
    ...record,
    ...changes,
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: Date.now(),
    rev: (record.rev || 0) + 1,
    dirty: 1,
  };
}

/**
 * ينشئ repository لـ store معيّن.
 * @param {string} storeName
 * @param {string} idPrefix
 */
export function createRepository(storeName, idPrefix) {
  if (!STORES[storeName]) {
    throw new Error(`store غير معرّف في الـ schema: ${storeName}`);
  }

  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **سجلُّ التغيير يُوصَل هنا لا في الخدمات** (WS-G، بند ٦)
   * ═══════════════════════════════════════════════════════════════
   *
   * كلُّ كتابةٍ في التطبيق تمرّ من هذه الطبقة — وهذا هو سببُ وجودها
   * أصلًا. فوصلُ السجلّ هنا يعني أن **لا مسارَ يفلت**: خدمةٌ تُكتَب غدًا
   * تُسجَّل بلا أن يتذكّر كاتبُها شيئًا.
   *
   * والبديلُ الذي رُفض: أن تنادي كلُّ خدمةٍ `recordChange()` بنفسها.
   * وهو عقدٌ يُنسى في أوّل ملفّ، والنسيانُ فيه **صامت**: تغييرٌ لا يصل
   * جهازَك الآخر أبدًا، ولا شيءَ يشتكي.
   *
   * ⚠️ **والمشتقُّ والمحلّيُّ لا يُسجَّلان** — `logged()` تقرّر من
   *    `sync-policy`. ولولا ذلك لكانت `rebuildIndex()` تكتب آلافَ
   *    صفوف السجلّ في كلّ نداء.
   */
  const tracked = logged(storeName);
  /** المخازنُ التي تفتحها معاملةُ الكتابة — البيانات ومعها السجلّ. */
  const writeStores = tracked ? [storeName, LOG_STORE] : storeName;

  /*
   * ⚠️ **ولا يُفترَض أن المفتاح `id`.** `settings` مفتاحُه `key`،
   *    و`nativeAudio` مفتاحُه `word`، و`generatedAudio` مفتاحُه
   *    `cacheKey`. وسطرُ سجلٍّ بمعرِّفٍ `undefined` تغييرٌ لا يجد صفَّه
   *    أبدًا عند الجار.
   */
  const keyPath = STORES[storeName].keyPath || 'id';
  const keyOf = (record) => record?.[keyPath];

  /**
   * سطرُ شاهدِ قبرٍ لصفٍّ مُحيَ محوًا.
   *
   * ⚠️ **و`payload` هنا وحده** — لا في `put`. الصفُّ الحيُّ يُقرأ عند
   *    التصدير، والمحذوفُ لا يُقرأ من مكان. راجع رأسَ `change-log.js`.
   */
  const removalEntry = (before) => ({
    store: storeName,
    recordId: keyOf(before),
    op: OP.REMOVE,
    rev: before.rev ?? null,
    baseRev: before.rev ?? null,
    payload: before,
  });

  const repo = {
    storeName,
    idPrefix,

    /** يقرأ سجلًا بالمعرّف. */
    async get(id) {
      return withTx(storeName, 'readonly', (tx) => req(tx.objectStore(storeName).get(id)));
    },

    /** يقرأ عدة سجلات دفعة واحدة، بنفس ترتيب المعرّفات. */
    async getMany(ids) {
      if (!ids?.length) return [];
      return withTx(storeName, 'readonly', async (tx) => {
        const store = tx.objectStore(storeName);
        return Promise.all(ids.map((id) => req(store.get(id))));
      });
    },

    /**
     * يقرأ كل السجلات.
     * ⚠️ لا تستخدمها مع stores كبيرة — استخدم page() أو byIndex().
     */
    async getAll(limit) {
      return withTx(storeName, 'readonly', (tx) =>
        req(tx.objectStore(storeName).getAll(undefined, limit))
      );
    },

    /** يقرأ السجلات النشطة فقط (يستثني المؤرشف والمحذوف). */
    async getActive(limit) {
      const all = await repo.getAll(limit);
      return all.filter((r) => r.state === STATE.ACTIVE);
    },

    /** يقرأ عبر فهرس. */
    async byIndex(indexName, value, limit) {
      return withTx(storeName, 'readonly', (tx) =>
        req(tx.objectStore(storeName).index(indexName).getAll(value, limit))
      );
    },

    /** يقرأ أول سجل يطابق فهرسًا. */
    async oneByIndex(indexName, value) {
      const rows = await repo.byIndex(indexName, value, 1);
      return rows[0] || null;
    },

    /**
     * صفحة من السجلات عبر فهرس، بترتيب قابل للعكس.
     * يستخدم cursor — لا يحمّل الـ store كله في الذاكرة.
     */
    async page({ index, range = null, direction = 'next', offset = 0, limit = 50, filter } = {}) {
      return withTx(storeName, 'readonly', (tx) => {
        const store = tx.objectStore(storeName);
        const source = index ? store.index(index) : store;
        return new Promise((resolve, reject) => {
          const out = [];
          let skipped = 0;
          const cursorReq = source.openCursor(range, direction);
          cursorReq.onerror = () => reject(cursorReq.error);
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor || out.length >= limit) return resolve(out);
            const value = cursor.value;
            if (!filter || filter(value)) {
              if (skipped >= offset) out.push(value);
              else skipped++;
            }
            cursor.continue();
          };
        });
      });
    },

    /** يعدّ السجلات (اختياريًا عبر فهرس). */
    async count(indexName, value) {
      return withTx(storeName, 'readonly', (tx) => {
        const store = tx.objectStore(storeName);
        const source = indexName ? store.index(indexName) : store;
        return req(source.count(value));
      });
    },

    /** ينشئ سجلًا جديدًا ويعيده. */
    async create(data) {
      const record = stampNew(data, idPrefix);
      await withTx(writeStores, 'readwrite', async (tx) => {
        await req(tx.objectStore(storeName).put(record));
        if (tracked) {
          await appendLocal(tx, [
            /* `baseRev: null` و`fields: null` = «صفٌّ جديدٌ كلُّه». */
            { store: storeName, recordId: keyOf(record), op: OP.PUT, rev: record.rev ?? 1 },
          ]);
        }
      });
      return record;
    },

    /** ينشئ عدة سجلات في معاملة واحدة — كلها أو لا شيء. */
    async createMany(items) {
      const records = items.map((item) => stampNew(item, idPrefix));
      await withTx(writeStores, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        await Promise.all(records.map((r) => req(store.put(r))));
        if (tracked) {
          await appendLocal(
            tx,
            records.map((r) => ({
              store: storeName, recordId: keyOf(r), op: OP.PUT, rev: r.rev ?? 1,
            }))
          );
        }
      });
      return records;
    },

    /** يحدّث سجلًا موجودًا. */
    async update(id, changes) {
      return withTx(writeStores, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        const existing = await req(store.get(id));
        if (!existing) throw new Error(`السجل غير موجود: ${id}`);
        const updated = stampUpdate(existing, changes);
        await req(store.put(updated));
        if (tracked) {
          /*
           * ⚠️ **ما تغيّر فعلًا لا ما طُلب تغييرُه** — راجع `changedFields`.
           *    وسطرٌ بلا حقولٍ متغيّرةٍ يُكتَب مع ذلك: `rev` ارتفع،
           *    والجارُ يحتاج أن يعرف أنه رآه (وإلّا أعاد إرساله بلا نهاية).
           */
          await appendLocal(tx, [{
            store: storeName,
            recordId: keyOf(updated),
            op: OP.PUT,
            rev: updated.rev,
            baseRev: existing.rev ?? null,
            fields: changedFields(existing, updated),
          }]);
        }
        return updated;
      });
    },

    /**
     * يكتب سجلًا كما هو (للاستيراد والمزامنة فقط — يتخطى الختم).
     *
     * ⚠️ **ويُسجَّل رغم تخطّيه الختم.** الاستيرادُ كتابةُ بياناتٍ حقيقيّةٍ
     *    في قاعدتك، فحجبُها عن السجلّ يعني أن مشهدًا استوردتَه على
     *    التابلت لا يصل الموبايلَ أبدًا.
     */
    async putRaw(record) {
      await withTx(writeStores, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        const before = tracked ? await req(store.get(keyOf(record))) : null;
        await req(store.put(record));
        if (tracked) {
          await appendLocal(tx, [{
            store: storeName,
            recordId: keyOf(record),
            op: OP.PUT,
            rev: record.rev ?? null,
            baseRev: before?.rev ?? null,
            fields: before ? changedFields(before, record) : null,
          }]);
        }
      });
      return record;
    },

    /**
     * يكتب صفوفًا كما هي في **معاملةٍ واحدة**.
     *
     * ⚠️ **ولماذا لا `Promise.all` على `putRaw`؟** لأن كلَّ نداءٍ منها
     *    يفتح معاملةً مستقلّة. وفهرسُ ذاكرة اللغة (WS-C) يكتب آلافَ
     *    الصفوف عند إعادة البناء — أي آلافَ المعاملات، وكلٌّ منها
     *    التزامٌ على القرص. معاملةٌ واحدةٌ تكتبها دفعةً، وهي أيضًا
     *    **كلُّها أو لا شيء**: فهرسٌ نصفُ مكتوبٍ أسوأُ من فهرسٍ غائب.
     *
     * ⚠️ ولا تُستعمَل لبيانات المستخدم: `createMany` تختم المعرِّفات
     *    والتواريخ، وهذه تتخطّاها عمدًا لأن معرِّفَ الصفّ **بصمةٌ
     *    محسوبة** لا رقمٌ جديدٌ في كلّ مرّة.
     */
    async putManyRaw(records) {
      if (!records?.length) return 0;
      await withTx(writeStores, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        const before = tracked
          ? await Promise.all(records.map((r) => req(store.get(keyOf(r)))))
          : [];
        await Promise.all(records.map((record) => req(store.put(record))));
        if (tracked) {
          await appendLocal(
            tx,
            records.map((record, i) => ({
              store: storeName,
              recordId: keyOf(record),
              op: OP.PUT,
              rev: record.rev ?? null,
              baseRev: before[i]?.rev ?? null,
              fields: before[i] ? changedFields(before[i], record) : null,
            }))
          );
        }
      });
      return records.length;
    },

    /** يحذف مفاتيحَ كثيرةً في معاملةٍ واحدة — أختُ `putManyRaw`. */
    async destroyMany(ids) {
      if (!ids?.length) return 0;
      await withTx(writeStores, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        const rows = tracked ? await Promise.all(ids.map((id) => req(store.get(id)))) : [];
        await Promise.all(ids.map((id) => req(store.delete(id))));
        if (tracked) await appendLocal(tx, rows.filter(Boolean).map(removalEntry));
      });
      return ids.length;
    },

    /** أرشفة: يبقى موجودًا لكن خارج التدفّق اليومي. */
    async archive(id) {
      return repo.update(id, { state: STATE.ARCHIVED });
    },

    /** إعادة إلى النشط من الأرشيف أو السلة. */
    async restore(id) {
      return repo.update(id, { state: STATE.ACTIVE, deletedAt: null });
    },

    /** نقل إلى السلة — قابل للاسترجاع دائمًا. */
    async trash(id) {
      return repo.update(id, { state: STATE.TRASHED, deletedAt: Date.now() });
    },

    /**
     * حذف نهائي.
     * ⚠️ لا تستدعها إلا بعد تأكيد صريح من المستخدم وعرض المرتبطات (بند 52).
     *
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **وهذا هو المسار الذي لا يمكن للمزامنة أن تعيش بدون سجلّه**
     * ═══════════════════════════════════════════════════════════════
     *
     * الحذفُ الناعم (`trash`) يترك صفًّا يقول «أنا محذوف»، فيراه أيُّ
     * ماسحٍ للقاعدة. أمّا هذا فيمحو الصفَّ محوًا — و`unlink()` تناديه
     * في كلّ فكِّ ربط. فمزامنةٌ تقارن القاعدتين لا ترى الفرقَ بين
     * «رابطٌ فككتُه» و«رابطٌ لم يصلني بعد»، فتُعيد إنشاءَ ما فككتَه.
     *
     * فسطرُ `remove` هنا يحمل **صورةَ الصفّ** لأنه آخرُ لحظةٍ يمكن
     * فيها التقاطُها.
     */
    async destroy(id) {
      await withTx(writeStores, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        const before = tracked ? await req(store.get(id)) : null;
        await req(store.delete(id));
        if (tracked && before) await appendLocal(tx, [removalEntry(before)]);
      });
    },

    /** السجلات التي تنتظر المزامنة مع Drive. */
    async dirtyRecords(limit = 200) {
      return repo.byIndex('dirty', 1, limit);
    },

    /** يمسح علامة dirty بعد نجاح رفع السجل. */
    async markClean(id, rev) {
      return withTx(storeName, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        const existing = await req(store.get(id));
        // لو تغيّر السجل أثناء الرفع، نتركه dirty لتُعاد مزامنته.
        if (!existing || existing.rev !== rev) return existing;
        existing.dirty = 0;
        await req(store.put(existing));
        return existing;
      });
    },
  };

  return repo;
}

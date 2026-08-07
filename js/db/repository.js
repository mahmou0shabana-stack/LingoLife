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
 * `rev` هو أساس كشف تعارض المزامنة — لا تعدّله يدويًا.
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
      await withTx(storeName, 'readwrite', (tx) => req(tx.objectStore(storeName).put(record)));
      return record;
    },

    /** ينشئ عدة سجلات في معاملة واحدة — كلها أو لا شيء. */
    async createMany(items) {
      const records = items.map((item) => stampNew(item, idPrefix));
      await withTx(storeName, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        await Promise.all(records.map((r) => req(store.put(r))));
      });
      return records;
    },

    /** يحدّث سجلًا موجودًا. */
    async update(id, changes) {
      return withTx(storeName, 'readwrite', async (tx) => {
        const store = tx.objectStore(storeName);
        const existing = await req(store.get(id));
        if (!existing) throw new Error(`السجل غير موجود: ${id}`);
        const updated = stampUpdate(existing, changes);
        await req(store.put(updated));
        return updated;
      });
    },

    /** يكتب سجلًا كما هو (للاستيراد والمزامنة فقط — يتخطى الختم). */
    async putRaw(record) {
      await withTx(storeName, 'readwrite', (tx) => req(tx.objectStore(storeName).put(record)));
      return record;
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
     */
    async destroy(id) {
      await withTx(storeName, 'readwrite', (tx) => req(tx.objectStore(storeName).delete(id)));
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

/**
 * LingoLife — الترقيات (Migrations)
 *
 * القواعد الملزمة (docs/03-architecture.md §3.6):
 *
 *  1. للأمام فقط. لا تعدّل ترقية سبق نشرها — أضف رقمًا جديدًا.
 *  2. ممنوع deleteObjectStore أو حذف فهرس يحمل بيانات.
 *     إعادة التسمية = إنشاء جديد + نسخ + إبقاء القديم دورة كاملة.
 *  3. أي حقل جديد يأتي بقيمة افتراضية — لا كسر للسجلات القديمة.
 *  4. الترقية تعمل داخل transaction الترقية فقط (versionchange).
 *
 * هذا الملف هو الضمانة الفعلية بأن تحديث الكود لا يمسّ بياناتك.
 */

import { STORES } from './schema.js';

/**
 * ينشئ store مع فهارسه من تعريف schema.
 * @param {IDBDatabase} db
 * @param {string} name
 */
function createStore(db, name) {
  const def = STORES[name];
  if (!def) throw new Error(`تعريف الـ store غير موجود: ${name}`);
  if (db.objectStoreNames.contains(name)) return;

  const store = db.createObjectStore(name, {
    keyPath: def.keyPath || 'id',
  });

  for (const [idxName, keyPath, options] of def.indexes || []) {
    store.createIndex(idxName, keyPath, options || {});
  }
}

/**
 * يضيف فهرسًا إلى store قائم إن لم يكن موجودًا.
 * آمن للاستدعاء المتكرر.
 */
export function addIndexIfMissing(tx, storeName, idxName, keyPath, options = {}) {
  const store = tx.objectStore(storeName);
  if (!store.indexNames.contains(idxName)) {
    store.createIndex(idxName, keyPath, options);
  }
}

/**
 * يمرّ على كل سجلات store ويطبّق دالة تحويل.
 * يُستخدم لتعبئة حقل جديد بقيمة افتراضية.
 */
export function backfill(tx, storeName, transform) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore(storeName);
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      const updated = transform(cursor.value);
      if (updated !== undefined && updated !== null) {
        cursor.update(updated);
      }
      cursor.continue();
    };
  });
}

/**
 * قائمة الترقيات. الترتيب تصاعدي إلزامي.
 * @type {{ v: number, note: string, up: (db: IDBDatabase, tx: IDBTransaction) => void }[]}
 */
export const MIGRATIONS = [
  {
    v: 1,
    note: 'إنشاء الـ schema الأولي — 30 store',
    up(db) {
      for (const name of Object.keys(STORES)) {
        createStore(db, name);
      }
    },
  },

  {
    v: 2,
    note: 'فهرس sceneId على أجزاء المحادثة — لجلب أجزاء المشهد باستعلام واحد',
    up(db, tx) {
      addIndexIfMissing(tx, 'conversationParts', 'sceneId', 'sceneId');
      // سجلات قديمة قد لا تحمل الحقل — نعطيها قيمة افتراضية بدل كسرها.
      return backfill(tx, 'conversationParts', (rec) => {
        if (rec.sceneId === undefined) {
          rec.sceneId = null;
          return rec;
        }
      });
    },
  },

  // ------------------------------------------------------------------
  // الترقيات القادمة تُضاف هنا برقم جديد.
  // ممنوع تعديل ترقية سبق نشرها — راجع docs/03-architecture.md §3.6
  // ------------------------------------------------------------------
];

/** أعلى إصدار في قائمة الترقيات — هو إصدار قاعدة البيانات المطلوب. */
export const TARGET_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.v), 1);

/**
 * ينفّذ كل الترقيات اللازمة للانتقال من oldVersion إلى newVersion.
 * يُستدعى داخل onupgradeneeded حصرًا.
 */
export function runMigrations(db, tx, oldVersion, newVersion) {
  const applied = [];
  for (const migration of MIGRATIONS) {
    if (migration.v > oldVersion && migration.v <= newVersion) {
      migration.up(db, tx);
      applied.push(migration.v);
    }
  }
  return applied;
}

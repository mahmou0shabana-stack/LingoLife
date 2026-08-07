/**
 * LingoLife — طبقة IndexedDB
 *
 * تفتح القاعدة، تشغّل الترقيات، وتوفّر مساعدات للمعاملات (transactions).
 * لا يستدعي هذا الملف أحدٌ إلا `repository.js`. الشاشات لا تلمسه إطلاقًا.
 */

import { DB_NAME, STORE_NAMES } from './schema.js';
import { MIGRATIONS, TARGET_VERSION, runMigrations } from './migrations.js';

/** @type {IDBDatabase | null} */
let _db = null;
/** @type {Promise<IDBDatabase> | null} */
let _opening = null;

/** معلومات آخر ترقية — تُعرض في شاشة الإعدادات. */
export const dbInfo = {
  version: TARGET_VERSION,
  appliedMigrations: [],
  openedAt: null,
  wasUpgraded: false,
};

/**
 * يفتح قاعدة البيانات (مرة واحدة، مع إعادة استخدام الوعد).
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;

  _opening = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('المتصفح لا يدعم IndexedDB — التطبيق لا يعمل بدونها.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, TARGET_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction;
      const from = event.oldVersion;
      const to = event.newVersion ?? TARGET_VERSION;

      console.info(`[db] ترقية من v${from} إلى v${to}`);
      const applied = runMigrations(db, tx, from, to);
      dbInfo.appliedMigrations = applied;
      dbInfo.wasUpgraded = from > 0;

      applied.forEach((v) => {
        const note = MIGRATIONS.find((m) => m.v === v)?.note || '';
        console.info(`[db] ✓ ترقية v${v} — ${note}`);
      });
    };

    req.onsuccess = () => {
      _db = req.result;
      dbInfo.openedAt = Date.now();

      // إن حاول تبويب آخر ترقية القاعدة، نغلق نسختنا لنسمح له بالمرور.
      _db.onversionchange = () => {
        _db?.close();
        _db = null;
        _opening = null;
        console.warn('[db] نسخة أخرى من التطبيق تطلب ترقية — أُغلق الاتصال.');
      };

      resolve(_db);
    };

    req.onerror = () => reject(req.error || new Error('تعذّر فتح قاعدة البيانات'));

    req.onblocked = () => {
      console.warn('[db] الترقية محجوبة — أغلق تبويبات LingoLife الأخرى.');
    };
  });

  return _opening;
}

/**
 * ينفّذ عملية داخل transaction ويعيد نتيجتها.
 * الالتزام (commit) يحدث فقط عند نجاح كل شيء — وإلا rollback كامل.
 *
 * @template T
 * @param {string | string[]} storeNames
 * @param {IDBTransactionMode} mode
 * @param {(tx: IDBTransaction) => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTx(storeNames, mode, fn) {
  const db = await openDB();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];

  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(names, mode);
    } catch (err) {
      reject(err);
      return;
    }

    let result;
    let failed = false;

    tx.oncomplete = () => {
      if (!failed) resolve(result);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('أُلغيت المعاملة'));

    Promise.resolve()
      .then(() => fn(tx))
      .then((value) => {
        result = value;
      })
      .catch((err) => {
        failed = true;
        try {
          tx.abort();
        } catch {
          /* المعاملة منتهية بالفعل */
        }
        reject(err);
      });
  });
}

/** يغلّف IDBRequest في وعد. */
export function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * يعدّ السجلات في كل الـ stores — لشاشة صحة التخزين.
 * أرقام حقيقية من القاعدة، لا تقديرات (بند 58).
 * @returns {Promise<Record<string, number>>}
 */
export async function countAll() {
  const db = await openDB();
  const existing = STORE_NAMES.filter((n) => db.objectStoreNames.contains(n));
  return withTx(existing, 'readonly', async (tx) => {
    const out = {};
    await Promise.all(
      existing.map(async (name) => {
        out[name] = await req(tx.objectStore(name).count());
      })
    );
    return out;
  });
}

/** يغلق الاتصال — يُستخدم قبل الاستيراد الكامل. */
export function closeDB() {
  _db?.close();
  _db = null;
  _opening = null;
}

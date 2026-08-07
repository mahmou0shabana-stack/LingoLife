/**
 * LingoLife — طبقة IndexedDB
 *
 * تفتح القاعدة، تشغّل الترقيات، وتوفّر مساعدات للمعاملات (transactions).
 * لا يستدعي هذا الملف أحدٌ إلا `repository.js`. الشاشات لا تلمسه إطلاقًا.
 */

import { STORE_NAMES } from './schema.js';
import { MIGRATIONS, TARGET_VERSION, runMigrations } from './migrations.js';
import { activeDbName } from './db-slots.js';

/** @type {IDBDatabase | null} */
let _db = null;
/** @type {Promise<IDBDatabase> | null} */
let _opening = null;

/** معلومات آخر ترقية — تُعرض في شاشة الإعدادات. */
export const dbInfo = {
  version: TARGET_VERSION,
  name: null,
  appliedMigrations: [],
  openedAt: null,
  wasUpgraded: false,
};

/**
 * يفتح قاعدة باسم صريح ويشغّل ترقياتها.
 *
 * يُستخدم للقاعدة النشطة وللخانة المؤقّتة أثناء الاسترجاع على السواء —
 * فكلتاهما تحتاج نفس الـ stores ونفس الترقيات بالضبط. توحيد المسار
 * يضمن أن قاعدة الاسترجاع ليست نسخة مختلفة بأي حال.
 *
 * @param {string} name
 * @param {boolean} track — هل نحدّث dbInfo؟ (للقاعدة النشطة فقط)
 * @returns {Promise<IDBDatabase>}
 */
export function openNamed(name, track = false) {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('المتصفح لا يدعم IndexedDB — التطبيق لا يعمل بدونها.'));
      return;
    }

    const request = indexedDB.open(name, TARGET_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      const from = event.oldVersion;
      const to = event.newVersion ?? TARGET_VERSION;

      console.info(`[db:${name}] ترقية من v${from} إلى v${to}`);
      const applied = runMigrations(db, tx, from, to);

      if (track) {
        dbInfo.appliedMigrations = applied;
        dbInfo.wasUpgraded = from > 0;
      }

      applied.forEach((v) => {
        const note = MIGRATIONS.find((m) => m.v === v)?.note || '';
        console.info(`[db:${name}] ✓ ترقية v${v} — ${note}`);
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(`تعذّر فتح القاعدة: ${name}`));
    request.onblocked = () => {
      console.warn(`[db:${name}] الترقية محجوبة — أغلق تبويبات LingoLife الأخرى.`);
    };
  });
}

/**
 * يفتح القاعدة النشطة (مرة واحدة، مع إعادة استخدام الوعد).
 * الاسم يأتي من مؤشّر الخانات لا من ثابت — راجع `db-slots.js`.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;

  const name = activeDbName();
  dbInfo.name = name;

  _opening = openNamed(name, true).then((db) => {
    _db = db;
    dbInfo.openedAt = Date.now();

    // إن حاول تبويب آخر ترقية القاعدة، نغلق نسختنا لنسمح له بالمرور.
    _db.onversionchange = () => {
      _db?.close();
      _db = null;
      _opening = null;
      console.warn('[db] نسخة أخرى من التطبيق تطلب ترقية — أُغلق الاتصال.');
    };

    return _db;
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

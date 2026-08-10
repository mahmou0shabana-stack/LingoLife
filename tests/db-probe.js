/**
 * LingoLife — قاعدةُ تجربةٍ لاختبار الترقيات
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا قاعدةٌ منفصلة بدل `openDB()`
 * ═══════════════════════════════════════════════════════════════
 *
 * `openDB()` تفتح على `TARGET_VERSION` دائمًا، فتُجري كل الترقيات
 * دفعةً واحدة قبل أن يراها اختبار. واختبارُ ترقيةٍ بعينها يحتاج ما لا
 * توفّره: أن يبني قاعدةً على الإصدار **الذي قبلها**، ويضع فيها بياناتٍ
 * بالشكل الذي كان، ثم يرقّيها ويسأل: هل بقي كل شيء؟
 *
 * ⚠️ وهذه ليست محاكاة: `openAt` تُنادي `runMigrations` نفسها التي
 *    يناديها التطبيق. لو كذبت الترقية هنا، كذبت على جهازك.
 *
 * ⚠️ و`skipStores` تُعيد إنتاج جهازك حرفيًّا: قاعدةٌ بُنيت **قبل** أن
 *    يوجد مستودعٌ ما لا تحتوي عليه، وترقيةٌ تفترض وجوده تسقط. هذا ما
 *    كشفته اختبارات v7.
 */

import { STORES } from '../js/db/schema.js';
import { runMigrations } from '../js/db/migrations.js';

/** يمحو قاعدة التجربة — يُنادى قبل كل سيناريو، لا بعده. */
export function wipeProbe(name) {
  return new Promise((done) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = done;
  });
}

/** يفتح قاعدة التجربة على إصدارٍ بعينه مطبِّقًا ترقيات التطبيق نفسها. */
export function openAt(name, version, { skipStores = [] } = {}) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, version);
    open.onupgradeneeded = (event) => {
      const db = open.result;
      const tx = open.transaction;
      if (event.oldVersion === 0 && skipStores.length) {
        for (const [storeName, def] of Object.entries(STORES)) {
          if (skipStores.includes(storeName)) continue;
          const store = db.createObjectStore(storeName, { keyPath: def.keyPath || 'id' });
          for (const [i, kp, o] of def.indexes || []) store.createIndex(i, kp, o || {});
        }
        return;
      }
      runMigrations(db, tx, event.oldVersion, version);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/** ينتظر إغلاق المعاملة — الكتابة ليست تامّة قبله. */
export function txDone(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

/** كل صفوف مستودع في قاعدة التجربة. */
export function getAll(db, store) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

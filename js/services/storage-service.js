/**
 * LingoLife — صحة التخزين
 *
 * أهم دالة هنا هي `requestPersistence`.
 * بدونها يعتبر المتصفح بيانات التطبيق "قابلة للإخلاء" ويحذفها
 * عند امتلاء الجهاز — أي تضيع ذكرياتك بلا إنذار.
 * راجع docs/04-storage-decision.md §4.5
 */

import { countAll, dbInfo } from '../db/database.js';
import { settings } from '../db/repositories.js';
import { TARGET_VERSION } from '../db/migrations.js';

const PERSIST_KEY = 'storage.persistRequested';

/**
 * يطلب تخزينًا دائمًا من المتصفح.
 * يُستدعى مرة عند أول تشغيل. لا يزعج المستخدم إن رُفض.
 *
 * @returns {Promise<{ supported: boolean, persisted: boolean, asked: boolean }>}
 */
export async function requestPersistence() {
  if (!navigator.storage?.persist) {
    return { supported: false, persisted: false, asked: false };
  }

  const already = await navigator.storage.persisted();
  if (already) return { supported: true, persisted: true, asked: false };

  const persisted = await navigator.storage.persist();
  await settings.set(PERSIST_KEY, { at: Date.now(), granted: persisted });
  return { supported: true, persisted, asked: true };
}

/** هل التخزين دائم حاليًا؟ */
export async function isPersisted() {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}

/**
 * تقدير المتصفح للمساحة المستخدمة والمتاحة.
 * @returns {Promise<{ usage: number|null, quota: number|null, percent: number|null }>}
 */
export async function estimateStorage() {
  if (!navigator.storage?.estimate) {
    return { usage: null, quota: null, percent: null };
  }
  const { usage, quota } = await navigator.storage.estimate();
  return {
    usage: usage ?? null,
    quota: quota ?? null,
    percent: usage && quota ? Math.round((usage / quota) * 100) : null,
  };
}

/**
 * تقرير كامل عن حالة التخزين — أرقام حقيقية من القاعدة لا تقديرات (بند 58).
 */
export async function storageReport() {
  const [estimate, counts, persisted] = await Promise.all([
    estimateStorage(),
    countAll(),
    isPersisted(),
  ]);

  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return {
    estimate,
    counts,
    totalRecords,
    persisted,
    schemaVersion: TARGET_VERSION,
    dbVersion: dbInfo.version,
    appliedMigrations: dbInfo.appliedMigrations,
  };
}

/** مستوى التحذير حسب نسبة الامتلاء. */
export function storageLevel(percent) {
  if (percent === null) return 'unknown';
  if (percent >= 90) return 'danger';
  if (percent >= 75) return 'warn';
  return 'ok';
}

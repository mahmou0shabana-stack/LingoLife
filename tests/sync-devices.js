/**
 * LingoLife — محاكي جهازين (WS-G · بندا ٥٢ و٩٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **قاعدتان مستقلّتان فعلًا — لا قاعدةٌ تُعدَّل بالتناوب**
 * ═══════════════════════════════════════════════════════════════
 *
 * بند ٥٢ يمنع محاكاةَ الجهازين بتعديلٍ متتابعٍ على قاعدةٍ واحدة، وهو
 * منعٌ في محلّه: قاعدةٌ واحدةٌ ترى كلَّ تعديلٍ فورًا، فلا افتراقَ أصلًا،
 * والاختبارُ يفحص نفسَه.
 *
 * فهنا **أربعُ قواعدَ حقيقيّة** (خانتان لكلّ جهاز) ومؤشّران منفصلان،
 * وكلُّ كتابةٍ تمرّ من **المستودعات والخدمات نفسِها** التي يستعملها
 * التطبيق. ولذلك يُختبَر فعلًا: فهرسُ `unique`، والفهارسُ المركّبة،
 * وسجلُّ التغيير في نفس المعاملة، وتحويلُ المؤشّر الذرّيّ.
 *
 * ⚠️ **ولا صفَّ يُكتَب بـ`put` مباشرةً في السيناريوهات.** الاستنساخُ
 *    وحدَه يستعمل IndexedDB الخام — لأنه ليس فعلَ مستخدمٍ بل تصويرُ
 *    جهازٍ على آخر.
 */

import { openNamed, closeDB, req } from '../js/db/database.js';
import { STORE_NAMES } from '../js/db/schema.js';
import { useSlots, deleteDatabase } from '../js/db/db-slots.js';
import { __forceDeviceId, setDeviceLabel } from '../js/services/sync/device.js';
import { useInstallNamespace, clearInstall, INSTALL } from '../js/services/cloud/install-store.js';
import { localVector, createPackageFor, receivePackage } from '../js/services/sync/sync-service.js';
import { planMerge } from '../js/services/sync/merge-planner.js';
import { applyMerge } from '../js/services/sync/merge-apply.js';
import { logicalState } from '../js/services/sync/logical-state.js';
import { withTx } from '../js/db/database.js';

/** أسماءُ الأجهزة في الاختبار — ثابتةٌ فتُقرأ في رسائل الفشل. */
export const TABLET = 'tablet';
export const MOBILE = 'mobile';
export const LAPTOP = 'laptop';
/** نسخةٌ ثانيةٌ من نفس الأساس — يلزمها اختبارُ استقلال الترتيب (بند ٦٧). */
export const SPARE = 'spare';

const slotsOf = (name) => ({
  a: `llife-sync-${name}`,
  b: `llife-sync-${name}-b`,
  pointer: `llife-sync.${name}.activeDB`,
});

/**
 * يجعل جهازًا هو الجهازَ الفعّال في هذه اللحظة.
 *
 * ⚠️ **وثلاثةُ أشياءَ تتبدّل معًا أو لا يتبدّل شيء**: خانةُ القاعدة،
 *    ومعرِّفُ الجهاز، و**نطاقُ مفاتيح التركيب**. وقد نُسي الثالثُ أوّلَ
 *    مرّة فتشارك «التابلت» و«الموبايل» كونًا واحدًا ونقطةَ تفتيشٍ واحدة،
 *    فرأى أحدُهما رفعَ الآخر ملكًا له — وسقطت خمسةُ اختبارات بلا سببٍ
 *    ظاهر. فما يفرِّق القاعدتين يجب أن يفرِّق التركيبين.
 */
export function activate(name) {
  const { a, b, pointer } = slotsOf(name);
  closeDB();
  useSlots(a, b, pointer);
  useInstallNamespace(name);
  __forceDeviceId(`DEV_${name.toUpperCase()}`);
  setDeviceLabel(name);
  return `DEV_${name.toUpperCase()}`;
}

/** يمحو كلَّ قواعد الاختبار ومؤشّراتها — يُنادى **قبل** كلّ سيناريو. */
export async function resetDevices(names = [TABLET, MOBILE, LAPTOP, SPARE]) {
  closeDB();
  for (const name of names) {
    const { a, b, pointer } = slotsOf(name);
    /* eslint-disable-next-line no-await-in-loop -- جهازٌ بعد جهاز */
    await deleteDatabase(a).catch(() => false);
    /* eslint-disable-next-line no-await-in-loop */
    await deleteDatabase(b).catch(() => false);
    try {
      localStorage.removeItem(pointer);
    } catch { /* تصفّحٌ خاصّ */ }

    // ومفاتيحُ التركيب أيضًا: كونٌ قديمٌ باقٍ يجعل سيناريو الوصل التالي
    // يظنّ نفسَه موصولًا سلفًا.
    useInstallNamespace(name);
    clearInstall(Object.values(INSTALL));
  }
  useInstallNamespace('');
}

/** ينفّذ عملًا بهُويّة جهازٍ بعينه. */
export async function on(name, fn) {
  activate(name);
  return fn();
}

/**
 * يستنسخ قاعدةَ جهازٍ على آخر — **بسجلّها**.
 *
 * ⚠️ **ولماذا بسجلّها؟** لأن هذا نموذجُ «جهازان مقترنان»: الموبايلُ
 *    يعرف أن التابلت ألّف ما فيه، فلا يطلبه ثانيةً. أمّا استرجاعُ
 *    `.llife` فيُنتج جهازًا **بلا سجلّ** — وهو نموذجُ «مصالحةٍ كاملة»
 *    ويُختبَر وحدَه (بند ٨٦).
 */
export async function cloneDevice(fromName, toName) {
  activate(fromName);
  const from = await openNamed(slotsOf(fromName).a);
  activate(toName);
  const to = await openNamed(slotsOf(toName).a);

  const names = STORE_NAMES.filter((n) => from.objectStoreNames.contains(n));
  for (const store of names) {
    /* eslint-disable-next-line no-await-in-loop -- مخزنٌ بعد مخزن */
    const rows = await req(from.transaction(store, 'readonly').objectStore(store).getAll());
    if (!rows.length) continue;
    const tx = to.transaction(store, 'readwrite');
    for (const row of rows) tx.objectStore(store).put(row);
    /* eslint-disable-next-line no-await-in-loop */
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  from.close();
  to.close();
  closeDB();
}

/**
 * يجعل جهازين يعرفان متّجهَ بعضهما — أي «التقيا للتوّ».
 *
 * بلا هذا تكون أوّلُ حزمةٍ بين جهازين مستنسخين حاملةً كلَّ التاريخ
 * (وهو صحيحٌ لكنه يخفي كونَ التالي تفاضليًّا).
 */
export async function pair(a, b) {
  activate(a);
  const va = await localVector();
  activate(b);
  const vb = await localVector();

  const write = async (name, peerId, vector) => {
    activate(name);
    await withTx('syncPeers', 'readwrite', (tx) => req(tx.objectStore('syncPeers').put({
      id: peerId, label: peerId, vector, packagedVector: {}, ackedVector: {},
      lastPackageId: null, lastExchangeAt: Date.now(), updatedAt: Date.now(),
    })));
  };

  await write(a, `DEV_${b.toUpperCase()}`, vb);
  await write(b, `DEV_${a.toUpperCase()}`, va);
}

/** يبني حزمةً من جهازٍ إلى جار. */
export async function packageFrom(fromName, toName) {
  activate(fromName);
  return createPackageFor(`DEV_${toName.toUpperCase()}`);
}

/**
 * يخطّط دمجَ حزمةٍ على جهازٍ **بلا كتابة** — لاختبار «التشغيل الجافّ».
 */
export async function planOn(name, pkg) {
  activate(name);
  return planMerge(pkg);
}

/** يطبّق خطّةً على جهاز. */
export async function applyOn(name, plan, options) {
  activate(name);
  return applyMerge(plan, options);
}

/**
 * تبادلٌ باتّجاهٍ واحد: يبني من `fromName` ويطبّق على `toName`.
 * @returns {{ pkg: object, plan: object, result: object|null, blocked: object[] }}
 */
export async function sendTo(fromName, toName, { resolutions = [] } = {}) {
  const pkg = await packageFrom(fromName, toName);
  activate(toName);
  const outcome = await receivePackage(pkg, { resolutions });
  return { pkg, ...outcome, blocked: outcome.blocked || [] };
}

/** لقطةُ الحالة المنطقيّة لجهاز. */
export async function snapshot(name) {
  activate(name);
  return logicalState();
}

/** كلُّ صفوف مخزنٍ على جهاز — للفحص المباشر في الاختبارات. */
export async function rowsOn(name, store) {
  activate(name);
  return withTx(store, 'readonly', (tx) => req(tx.objectStore(store).getAll()));
}

/** صفٌّ بعينه على جهاز. */
export async function rowOn(name, store, id) {
  activate(name);
  return withTx(store, 'readonly', (tx) => req(tx.objectStore(store).get(id)));
}

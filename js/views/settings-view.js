/**
 * LingoLife — الإعدادات وصحة التخزين
 *
 * كل رقم هنا مقروء من القاعدة أو من المتصفح مباشرة.
 * لا تقديرات ولا أرقام للعرض (بند 58، 59).
 */

import { storageReport, storageLevel, requestPersistence } from '../services/storage-service.js';
import { exportToFile } from '../services/export-service.js';
import { exportBackup } from '../services/backup/export.js';
import { inspectBackup, restoreBackup } from '../services/backup/restore.js';
import { BACKUP_EXTENSION } from '../services/backup/backup-format.js';
import { backupHistory } from '../db/repositories.js';
import { countAll } from '../db/database.js';
import { html, raw, formatBytes } from '../utils/dom.js';
import { relativeTime } from '../utils/dates.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { confirmAction, showModal } from '../components/modal.js';
import { icon } from '../components/icons.js';
import { APP_VERSION, BUILD_ID } from '../config.js';

export async function renderSettings(main) {
  main.innerHTML = html`<div class="loading"><span class="spinner"></span> بيتم قراءة حالة التخزين…</div>`;

  const report = await storageReport();
  const { estimate, counts, totalRecords, persisted } = report;
  const level = storageLevel(estimate.percent);

  const history = await backupHistory.getAll();
  const lastBackup = history
    .filter((row) => !row.cancelled)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];

  const topStores = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  main.innerHTML = html`
    <div class="view-head">
      <h1>الإعدادات</h1>
      <div class="sub">صحة التخزين والنسخ الاحتياطي</div>
    </div>

    <div class="panel">
      <h3>${raw(icon('db', 18))} التخزين على الجهاز</h3>

      ${raw(
        estimate.percent !== null
          ? html`
              <div class="meter ${level === 'ok' ? '' : level}">
                <span style="width:${Math.max(estimate.percent, 1)}%"></span>
              </div>
              <div class="kv-row">
                <span class="k">المستخدم</span>
                <span class="v">
                  <bdi>${formatBytes(estimate.usage)}</bdi> من <bdi>${formatBytes(estimate.quota)}</bdi>
                </span>
              </div>`
          : html`<div class="kv-row"><span class="k">المساحة</span><span class="v">المتصفح ما بيوفّرش التقدير</span></div>`
      )}

      <div class="kv-row">
        <span class="k">تخزين دائم</span>
        <span class="v">
          ${persisted === true ? '✓ مفعّل' : persisted === false ? '✗ غير مفعّل' : 'غير معروف'}
        </span>
      </div>
      <div class="kv-row"><span class="k">إجمالي السجلات</span><span class="v num">${totalRecords}</span></div>
      <div class="kv-row"><span class="k">إصدار الـ schema</span><span class="v num">${report.schemaVersion}</span></div>

      ${raw(
        persisted === false
          ? html`
              <p class="field-hint" style="margin-top:var(--sp-3)">
                من غير التخزين الدائم، المتصفح ممكن يمسح بياناتك لو الجهاز اتملى.
              </p>
              <button class="btn btn-primary btn-sm" data-action="request-persist"
                style="margin-top:var(--sp-2)">فعّل التخزين الدائم</button>`
          : ''
      )}
    </div>

    <div class="panel">
      <h3>${raw(icon('download', 18))} النسخ الاحتياطي</h3>
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        حزمة <code>.llife</code> فيها كل حاجة: بياناتك وصورك الأصلية
        وتسجيلاتك وإعداداتك. ملف واحد يرجّع عالمك كامل على أي جهاز.
      </p>

      <button class="btn btn-primary btn-block" data-action="export-llife">
        ${raw(icon('download', 18))} صدّر نسخة كاملة (.llife)
      </button>

      <button class="btn btn-ghost btn-block" data-action="restore-llife"
        style="margin-top:var(--sp-2)">
        ${raw(icon('refresh', 18))} استرجع من نسخة
      </button>

      ${raw(
        lastBackup
          ? html`<div class="kv-row" style="margin-top:var(--sp-3)">
              <span class="k">آخر نسخة</span>
              <span class="v">
                ${relativeTime(new Date(lastBackup.createdAt).getTime())} ·
                <bdi>${formatBytes(lastBackup.bytes)}</bdi>
              </span>
            </div>`
          : html`<p class="field-hint" style="margin-top:var(--sp-3)">
              لسه معملتش نسخة احتياطية. بياناتك على الجهاز ده بس.
            </p>`
      )}

      <details style="margin-top:var(--sp-3)">
        <summary class="text-soft text-sm">تصدير نصّي سريع</summary>
        <p class="field-hint" style="margin:var(--sp-2) 0">
          JSON بالبيانات النصية فقط، بلا صور ولا صوت — للمعاينة السريعة،
          <strong>مش نسخة احتياطية</strong>.
        </p>
        <button class="btn btn-ghost btn-sm" data-action="export-json">
          صدّر JSON نصّي
        </button>
      </details>
    </div>

    ${raw(
      topStores.length
        ? html`
            <div class="panel">
              <h3>محتوى قاعدة البيانات</h3>
              ${raw(
                topStores
                  .map(
                    ([name, n]) =>
                      html`<div class="kv-row"><span class="k">${name}</span><span class="v num">${n}</span></div>`
                  )
                  .join('')
              )}
            </div>`
        : ''
    )}

    <div class="panel">
      <h3>${raw(icon('refresh', 18))} التطبيق</h3>
      <div class="kv-row"><span class="k">الإصدار</span><span class="v">${APP_VERSION}</span></div>
      <div class="kv-row"><span class="k">رقم البناء</span><span class="v" dir="ltr">${BUILD_ID}</span></div>
      <div class="kv-row"><span class="k">آخر فتح للقاعدة</span><span class="v">${relativeTime(Date.now())}</span></div>

      <p class="field-hint" style="margin:var(--sp-3) 0">
        تحديث الكود بالقوة بيمسح الملفات المخزّنة مؤقتًا فقط — <strong>مش
        بيقرب من بياناتك خالص</strong>.
      </p>
      <button class="btn btn-ghost btn-block" data-action="force-update">
        ${raw(icon('refresh', 18))} حدّث الكود بالقوة
      </button>
    </div>

    <div class="not-yet">
      ${raw(icon('info', 18))}
      <div>
        <strong>المرحلة 3:</strong> ربط Google Drive، المزامنة التلقائية،
        واسترجاع العالم من السحابة.
      </div>
    </div>`;
}

/**
 * مدّة "لا تختفِ" للـ toast أثناء عملية طويلة.
 * `duration: 0` كان يُخفيه فورًا لأن setTimeout بصفر ينفّذ حالًا.
 */
const BUSY = 10 * 60 * 1000;

/** يفتح منتقي ملفات ويعيد الملف المختار، أو null عند الإلغاء. */
function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    // الإلغاء لا يُطلق حدثًا في كل المتصفحات — نعتمد على عودة التركيز.
    window.addEventListener(
      'focus',
      () => setTimeout(() => resolve(input.files?.[0] || null), 400),
      { once: true }
    );
    input.click();
  });
}

/** إجراءات شاشة الإعدادات — يُستدعى من app.js. */
export async function handleSettingsAction(action) {
  if (action === 'request-persist') {
    const result = await requestPersistence();
    if (result.persisted) toastOk('التخزين الدائم اتفعّل — بياناتك محميّة من المسح التلقائي');
    else if (!result.supported) toast('المتصفح ده مش بيدعم التخزين الدائم');
    else toast('المتصفح رفض الطلب — جرّب تثبّت التطبيق على الشاشة الرئيسية الأول');
    return true;
  }

  if (action === 'export-llife') {
    const dismiss = toast('بيتجهّز… ابقَ في الصفحة', { duration: BUSY });
    try {
      const result = await exportBackup((p) =>
        console.info(`[backup] ${p.phase}: ${p.label}`)
      );

      dismiss();

      if (result.cancelled) {
        toast('اتلغى الحفظ — الملف اتجهّز بس مااتحفظش');
      } else {
        const where =
          result.method === 'share'
            ? 'اتبعت لشاشة المشاركة'
            : result.method === 'picker'
              ? 'اتحفظ في المكان اللي اخترته'
              : 'اتنزّل في مجلد التنزيلات';
        toastOk(
          `${where} · ${result.totalRecords} سجل و${result.blobCount} ملف · ` +
            `${formatBytes(result.bytes)}`
        );
      }
      const main = document.querySelector('#app-main');
      if (main) renderSettings(main);
    } catch (err) {
      dismiss();
      console.error(err);
      toastError(`فشل التصدير: ${err.message}`);
    }
    return true;
  }

  if (action === 'restore-llife') {
    const file = await pickFile(
      `${BACKUP_EXTENSION},application/x-lingolife-backup,application/zip`
    );
    if (!file) return true;

    const dismissScan = toast('بنفحص الملف… مش بنلمس بياناتك', { duration: BUSY });
    let inspection;
    try {
      inspection = await inspectBackup(file, { deep: true });
    } catch (err) {
      dismissScan();
      console.error(err);
      toastError(`تعذّر قراءة الملف: ${err.message}`);
      return true;
    }
    dismissScan();

    if (!inspection.ok) {
      await showModal({
        title: 'النسخة دي مش صالحة للاسترجاع',
        body: inspection.issues
          .filter((i) => i.level === 'fatal')
          .map((i) => html`<p class="issue issue-fatal">${i.message}</p>`)
          .join(''),
        actions: [{ label: 'تمام', value: null, variant: 'ghost' }],
      });
      return true;
    }

    const warnings = inspection.issues.filter((i) => i.level === 'warning');
    const onDevice = await countAll();
    const onDeviceTotal = Object.values(onDevice).reduce((sum, n) => sum + n, 0);
    const migrated = inspection.migration.from !== inspection.migration.to;

    const choice = await showModal({
      title: 'معاينة النسخة قبل الاسترجاع',
      body: html`
        <div class="kv-row"><span class="k">اتعملت</span>
          <span class="v">${new Date(inspection.manifest.createdAt).toLocaleString('ar-EG')}</span></div>
        <div class="kv-row"><span class="k">إصدار التطبيق</span>
          <span class="v">${inspection.manifest.appVersion}</span></div>
        <div class="kv-row"><span class="k">صيغة النسخة</span>
          <span class="v num">v${inspection.migration.from}${migrated ? ` ← v${inspection.migration.to}` : ''}</span></div>
        <div class="kv-row"><span class="k">السجلات</span>
          <span class="v num">${inspection.totalRecords}</span></div>
        <div class="kv-row"><span class="k">الصور والأصوات</span>
          <span class="v num">${inspection.blobCount}</span></div>
        <div class="kv-row"><span class="k">حجم الوسائط</span>
          <span class="v"><bdi>${formatBytes(inspection.blobBytes)}</bdi></span></div>

        ${raw(
          warnings.length
            ? html`<div style="margin-top:var(--sp-3)">
                <strong class="text-sm">${warnings.length} تنبيه — الاسترجاع ممكن برضه:</strong>
                ${raw(
                  warnings
                    .slice(0, 8)
                    .map((i) => html`<p class="issue issue-warn">${i.message}</p>`)
                    .join('')
                )}
              </div>`
            : ''
        )}

        <p class="field-hint" style="margin-top:var(--sp-3)">
          <strong>ده هيستبدل كل بياناتك الحالية</strong> (${onDeviceTotal} سجل
          دلوقتي). بيتكتب في مساحة منفصلة الأول — بياناتك الحالية مابتتلمسش
          غير لما كل حاجة تنجح.
        </p>`,
      actions: [
        { label: 'إلغاء', value: null, variant: 'ghost' },
        { label: 'استرجع واستبدل الكل', value: 'submit', variant: 'danger' },
      ],
    });

    if (choice !== 'submit') return true;

    const busy = toast('بيسترجع… متقفلش الصفحة', { duration: BUSY });
    try {
      const result = await restoreBackup(inspection, {
        onProgress: (p) => console.info(`[restore] ${p.phase}: ${p.label}`),
      });
      busy();
      toastOk(`اترجّع ${result.totalRecords} سجل و${result.blobsRestored} ملف — بنعيد التحميل`);
      setTimeout(() => window.location.reload(), 1400);
    } catch (err) {
      busy();
      console.error(err);
      toastError(`فشل الاسترجاع — بياناتك القديمة زي ما هي: ${err.message}`);
    }
    return true;
  }

  if (action === 'export-json') {
    try {
      const result = await exportToFile();
      toastOk(`اتصدّر ${result.records} سجل · حجم الملف ${formatBytes(result.bytes)}`);
    } catch (err) {
      console.error(err);
      toastError('فشل التصدير — راجع الـ console');
    }
    return true;
  }

  if (action === 'force-update') {
    const ok = await confirmAction({
      title: 'تحديث الكود بالقوة',
      message:
        'ده هيمسح الملفات المخزّنة مؤقتًا ويعيد تحميل التطبيق من الشبكة. بياناتك في IndexedDB مش هتتأثر إطلاقًا.',
      confirmLabel: 'حدّث',
    });
    if (!ok) return true;

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    const registrations = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(registrations.map((r) => r.unregister()));
    window.location.reload();
    return true;
  }

  return false;
}

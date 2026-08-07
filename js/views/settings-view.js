/**
 * LingoLife — الإعدادات وصحة التخزين
 *
 * كل رقم هنا مقروء من القاعدة أو من المتصفح مباشرة.
 * لا تقديرات ولا أرقام للعرض (بند 58، 59).
 */

import { storageReport, storageLevel, requestPersistence } from '../services/storage-service.js';
import { exportToFile } from '../services/export-service.js';
import { html, raw, formatBytes } from '../utils/dom.js';
import { relativeTime } from '../utils/dates.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { confirmAction } from '../components/modal.js';
import { icon } from '../components/icons.js';
import { APP_VERSION, BUILD_ID } from '../config.js';

export async function renderSettings(main) {
  main.innerHTML = html`<div class="loading"><span class="spinner"></span> بيتم قراءة حالة التخزين…</div>`;

  const report = await storageReport();
  const { estimate, counts, totalRecords, persisted } = report;
  const level = storageLevel(estimate.percent);

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
        تصدير كل البيانات النصية في ملف JSON واحد. الوسائط (صور وصوت) هتتضمّ
        لحزمة <code>.llife</code> في المرحلة 1.
      </p>
      <button class="btn btn-ghost btn-block" data-action="export-json">
        ${raw(icon('download', 18))} صدّر البيانات (JSON)
      </button>
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

/** إجراءات شاشة الإعدادات — يُستدعى من app.js. */
export async function handleSettingsAction(action) {
  if (action === 'request-persist') {
    const result = await requestPersistence();
    if (result.persisted) toastOk('التخزين الدائم اتفعّل — بياناتك محميّة من المسح التلقائي');
    else if (!result.supported) toast('المتصفح ده مش بيدعم التخزين الدائم');
    else toast('المتصفح رفض الطلب — جرّب تثبّت التطبيق على الشاشة الرئيسية الأول');
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

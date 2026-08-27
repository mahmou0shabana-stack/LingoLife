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
import { withProgress, startProgress } from '../components/progress.js';
import { confirmAction, showModal } from '../components/modal.js';
import {
  nativeAudioConsent,
  nativeCacheStats,
  clearNativeCache,
  revokeNativeAudio,
  NATIVE_HOSTS,
} from '../services/shadow/native-audio.js';
import { icon } from '../components/icons.js';
import { counted } from '../utils/plural.js';
import { unknownOriginCount, claimUnknownOrigins } from '../services/language-service.js';
import { APP_VERSION, BUILD_ID } from '../config.js';
import { cloudPanels, cloudSettingsData } from './cloud-settings.js';

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

  const native = {
    consent: await nativeAudioConsent(),
    stats: await nativeCacheStats(),
  };

  // ظهورات كُتبت قبل بند 38 — راجع ترقية v10.
  const unknownOrigins = await unknownOriginCount();

  // ثلاثُ لوحاتِ السحابة — تُقرأ من القاعدة، بلا نداءِ شبكةٍ واحد.
  const cloudData = await cloudSettingsData();

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
      <h3>${raw(icon('upload', 18))} استيراد مشهد مُجهَّز</h3>
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        لو حوّلت موقفًا لحزمة تحليل بره التطبيق، تقدر تدخّلها من هنا.
        <strong>المعاينة قبل الكتابة دايمًا</strong> — تشوف إيه اللي
        هيتكتب وإيه اللي مش هيدخل وليه، وبعدين تقرّر.
      </p>
      <button class="btn btn-ghost btn-block" data-action="go-import">
        ${raw(icon('upload', 18))} افتح شاشة الاستيراد
      </button>
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

    ${raw(cloudPanels(cloudData))}

    ${raw(privacyPanel(native, cloudData))}
    ${raw(originsPanel(unknownOrigins))}

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

    `;
}

/**
 * ما الذي يغادر جهازك — في مكانٍ واحد ظاهر (بند 22).
 *
 * الموافقة تُعطى داخل شاشة الظلّ في سياقها، لكنها لا يجوز أن تُدفَن
 * هناك: أن تعرف **بعد شهر** ماذا وافقتَ عليه ومتى وكم كلمة خرجت، وأن
 * تسحبه من مكانٍ تعرفه — هذا ما يجعل الموافقة موافقة.
 */
function privacyPanel({ consent, stats }, cloudData = null) {
  const linked = Boolean(cloudData?.active);

  return html`
    <div class="panel">
      <h3>${raw(icon('info', 18))} ما يغادر جهازك</h3>

      <p class="field-hint" style="margin-bottom:var(--sp-3)">
        LingoLife بيشتغل كله على جهازك. اللي بيخرج منه
        ${linked ? 'دلوقتي' : 'ممكن يخرج'} حاجتين بس، ومحدش منهم شغّال
        من غير ما تفتحه بنفسك:
      </p>

      <ol class="field-hint" style="margin:0 0 var(--sp-3); padding-inline-start:var(--sp-4)">
        <li>
          <strong>النطق الأصلي</strong> — بيبعت <strong>الكلمة الروسية بس</strong>
          لخوادم خارجية (${NATIVE_HOSTS.join(' · ')}) عشان يجيب تسجيل لناطق أصلي.
        </li>
        <li style="margin-top:6px">
          <strong>Google Drive</strong> — لو ربطته، بتروحه
          <strong>ذكرياتك وسجلّاتك وملفّاتك الصوت والصور</strong>، عشان
          تتزامن على أجهزتك وتتحفظ كنسخ احتياطية.
          <!--
            ⚠️ **وهذه الجملةُ صحّحت كذبةً كانت قائمة.** كان النصُّ يقول إن
               الاستثناءَ الوحيدَ هو النطقُ الأصليّ — وكان صادقًا قبل WS-H
               وصار كاذبًا بعده. ونصُّ خصوصيّةٍ متأخّرٌ عن الكود أسوأُ من
               غيابه: يُقرَأ فيُصدَّق.
          -->
          <span class="cloud-badge is-${linked ? 'busy' : 'muted'}">
            ${linked ? 'مربوط دلوقتي' : 'مش مربوط'}
          </span>
        </li>
      </ol>

      <div class="kv-row">
        <span class="k">النطق الأصلي</span>
        <span class="v">${consent.enabled ? 'مفعّل' : 'مطفي (الافتراضي)'}</span>
      </div>
      ${raw(
        consent.consentedAt
          ? html`<div class="kv-row">
              <span class="k">وافقت عليه</span>
              <span class="v">${relativeTime(consent.consentedAt)}</span>
            </div>`
          : ''
      )}
      <div class="kv-row">
        <span class="k">تسجيلات محفوظة على جهازك</span>
        <span class="v num">${stats.words}</span>
      </div>
      ${raw(
        stats.words
          ? html`<div class="kv-row">
              <span class="k">حجمها</span>
              <span class="v"><bdi>${formatBytes(stats.bytes)}</bdi></span>
            </div>`
          : ''
      )}
      ${raw(
        stats.misses
          ? html`<div class="kv-row">
              <span class="k">كلمات دوّرنا عليها وملقيناش</span>
              <span class="v num">${stats.misses}</span>
            </div>`
          : ''
      )}

      ${raw(
        consent.enabled
          ? html`<p class="field-hint" style="margin:var(--sp-3) 0">
                الرجوع بيقفل الميزة <strong>ويمسح كل اللي اتجاب</strong> —
                مش بنقفل الباب ونحتفظ باللي دخل.
              </p>
              <button class="btn btn-ghost btn-block" data-action="native-revoke">
                اقفل النطق الأصلي وامسح اللي اتجاب
              </button>`
          : html`<p class="field-hint" style="margin-top:var(--sp-3)">
              النطق الأصلي مطفي — التفعيل من داخل شاشة الظلّ، بزرّ مصدر الصوت.
              ${linked ? '' : 'وDrive مش مربوط، يعني مفيش حاجة بتخرج من جهازك دلوقتي.'}
            </p>`
      )}
      ${raw(
        !consent.enabled && stats.words + stats.misses
          ? html`<button class="btn btn-ghost btn-block" style="margin-top:var(--sp-2)"
              data-action="native-clear">امسح الـ${stats.words + stats.misses} تسجيل المخزّن</button>`
          : ''
      )}
    </div>`;
}

/**
 * ظهورات لا نعرف من أين جاءت — راجع ترقية v10.
 *
 * ⚠️ **تظهر فقط حين يكون فيه ما يُقَرّ به.** لوحةٌ تقول «صفر ظهور
 *    مجهول» تشغل مكانًا بلا خبر، وتسأل عن شيءٍ لا وجود له.
 */
function originsPanel(unknownOrigins) {
  if (!unknownOrigins) return '';

  return html`
      <div class="panel">
        <h3>${raw(icon('clock', 18))} ظهورات مش عارفين جت منين</h3>

        <p class="field-hint" style="margin-bottom:var(--sp-3)">
          التطبيق كان بيكتب «كتبته بإيدك» على <strong>كل</strong> ظهور تعبير،
          سواء كتبته فعلًا أو جه مع مشهد مُجهَّز أو التقطته وإنت بتتمرّن —
          الحقل كان ثابت مش بيتغيّر. دلوقتي كل ظهور جديد بيسجّل منشأه صح،
          والقديم اترجّع لـ<strong>«مش معروف منين»</strong> لأن الادّعاء
          القديم كان بلا سند.
        </p>

        <div class="kv-row">
          <span class="k">ظهورات مجهولة المنشأ</span>
          <span class="v num">${unknownOrigins}</span>
        </div>

        <p class="field-hint" style="margin:var(--sp-3) 0">
          لو إنت عارف إنك كتبتهم كلهم بإيدك، قول كده — <strong>إنت اللي
          عارف، مش التطبيق</strong>.
        </p>
        <button class="btn btn-ghost btn-block" data-action="claim-origins">
          دول كلهم كتبتهم بإيدي
        </button>
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
/**
 * يعيد رسم الشاشة بعد فعلٍ يغيّر أرقامها.
 * بلا هذا يبقى «مفعّل» معروضًا بعد أن أُقفل — والرقم الكاذب أسوأ من
 * غيابه (بند 89).
 */
async function refresh() {
  const main = document.getElementById('app-main');
  if (main) await renderSettings(main);
}

export async function handleSettingsAction(action, target = null) {
  /*
   * ⚠️ **وأفعالُ السحابة في ملفٍّ منفصل** — لا لأن هذا الملفَّ طال (وقد
   *    طال)، بل لأن خلطَها هنا كان سيجعل شاشةَ الإعدادات تستورد طبقةَ
   *    السحابة كلَّها لتعرض عدّادَ تخزينٍ محلّيّ.
   */
  if (action.startsWith('cloud-')) {
    const { handleCloudAction } = await import('./cloud-actions.js');
    return handleCloudAction(action, target, refresh);
  }

  if (action === 'claim-origins') {
    const n = await claimUnknownOrigins();
    toastOk(n
      ? `تمام — ${counted(n, 'ظهور', 'ظهورين', 'ظهورات')} بقت مكتوبة بإيدك`
      : 'مفيش ظهورات مجهولة');
    await refresh();
    return true;
  }

  if (action === 'request-persist') {
    const result = await requestPersistence();
    if (result.persisted) toastOk('التخزين الدائم اتفعّل — بياناتك محميّة من المسح التلقائي');
    else if (!result.supported) toast('المتصفح ده مش بيدعم التخزين الدائم');
    else toast('المتصفح رفض الطلب — جرّب تثبّت التطبيق على الشاشة الرئيسية الأول');
    return true;
  }

  if (action === 'export-llife') {
    /*
     * ⚠️ **وكان التقدُّمُ يُرسَل إلى `console.info`.**
     *    `exportBackup` تبعث `{phase, done, total, label}` لكلّ مخزنٍ
     *    ولكلّ وسيط — أرقامٌ حقيقيّةٌ كاملة — وكانت تُرمى في الطرفيّة
     *    التي لا يفتحها أحدٌ على تابلت، بينما المستخدمُ أمام إشعارٍ
     *    اختفى بعد ثوانٍ ونسخةٍ تُبنى دقيقة. فالأرقامُ كانت موجودةً
     *    ومحجوبة.
     */
    return withProgress({
      key: 'backup-export',
      title: 'نسخة احتياطية كاملة',
      stages: ['البيانات', 'الوسائط', 'ختم الملف', 'الحفظ'],
    }, async (bar) => {
      try {
        const result = await exportBackup((p) => {
          if (p.phase === 'data') bar.stage(0, p.label).set({ done: p.done, total: p.total });
          else if (p.phase === 'media') bar.stage(1, p.label).set({ done: p.done, total: p.total });
          else if (p.phase === 'finalize') bar.stage(2).indeterminate('بيختم الملف…');
        });

        bar.stage(3).indeterminate('بيحفظ…');

      if (result.cancelled) {
          bar.cancelled('اتلغى الحفظ — الملف اتجهّز بس مااتحفظش');
        } else {
          const where =
            result.method === 'share'
              ? 'اتبعت لشاشة المشاركة'
              : result.method === 'picker'
                ? 'اتحفظ في المكان اللي اخترته'
                : 'اتنزّل في مجلد التنزيلات';
          bar.done(
            `${where} · ${result.totalRecords} سجل و${result.blobCount} ملف · `
            + `${formatBytes(result.bytes)}`
          );
        }
        const main = document.querySelector('#app-main');
        if (main) renderSettings(main);
      } catch (err) {
        console.error(err);
        /* ⚠️ وإعادةُ المحاولة تعيد نفسَ الفعل — لا تفتح شاشةً أخرى. */
        bar.fail(`فشل التصدير: ${err.message}`, {
          retry: () => handleSettingsAction('export-llife'),
        });
      }
      return true;
    });
  }

  if (action === 'restore-llife') {
    const file = await pickFile(
      `${BACKUP_EXTENSION},application/x-lingolife-backup,application/zip`
    );
    if (!file) return true;

    /*
     * ⚠️ **والفحصُ العميقُ ليس لحظيًّا**: يفكّ الأرشيف ويتحقّق من بصمة
     *    كلّ ملفٍّ داخله. على نسخةٍ فيها مئاتُ الوسائط يمشي دقيقةً —
     *    والمستخدمُ ينتظر قبل أخطر فعلٍ في التطبيق. فيُرى.
     */
    const scan = startProgress({
      key: 'backup-inspect',
      title: 'فحص ملف النسخة',
    });
    if (!scan) return true;
    let inspection;
    try {
      scan.indeterminate('بيفكّ الأرشيف ويتحقّق من الملفّات… مش بنلمس بياناتك');
      inspection = await inspectBackup(file, { deep: true });
    } catch (err) {
      console.error(err);
      scan.fail(`تعذّر قراءة الملف: ${err.message}`);
      return true;
    }
    scan.close();

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

    /*
     * ⚠️ **ولا زرَّ إلغاءٍ هنا — عمدًا.**
     *    الاسترجاعُ يبني خانةً ثانيةً كاملةً ثم يحوّل السهمَ إليها في
     *    خطوةٍ واحدة. فالإلغاءُ في المنتصف لا يترك نصفَ استرجاع: يترك
     *    خانةً مؤقّتةً تُهمَل، وبياناتُك القديمةُ لم تُمَسّ أصلًا. وزرٌّ
     *    يوحي بغير ذلك — أو يوحي بأن ثمّة ما يُنقَذ — كذبٌ في أحرج
     *    لحظةٍ يمرّ بها المستخدم.
     */
    return withProgress({
      key: 'backup-restore',
      title: 'استرجاع نسخة',
      stages: ['تجهيز الخانة', 'البيانات', 'الوسائط', 'التحقّق', 'التحويل'],
    }, async (bar) => {
      const STEP = { prepare: 0, data: 1, media: 2, verify: 3, switch: 4 };
      try {
        const result = await restoreBackup(inspection, {
          onProgress: (p) => {
            const at = STEP[p.phase] ?? 0;
            bar.stage(at, p.label);
            if (Number.isFinite(p.done) && Number.isFinite(p.total) && p.total > 0) {
              bar.set({ done: p.done, total: p.total });
            }
          },
        });
        bar.done(`اترجّع ${result.totalRecords} سجل و${result.blobsRestored} ملف — بنعيد التحميل`);
        setTimeout(() => window.location.reload(), 1800);
      } catch (err) {
        console.error(err);
        bar.fail(`فشل الاسترجاع — بياناتك القديمة زي ما هي: ${err.message}`);
      }
      return true;
    });
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

  if (action === 'native-revoke') {
    const ok = await confirmAction({
      title: 'اقفل النطق الأصلي',
      message:
        'مش هيخرج من جهازك أي حاجة تاني، و<strong>كل التسجيلات اللي اتجابت هتتمسح</strong>. ' +
        'تقدر تفعّلها تاني في أي وقت من شاشة الظلّ.',
      confirmLabel: 'اقفل وامسح',
    });
    if (!ok) return true;
    await revokeNativeAudio();
    toastOk('اتقفل، والمخزّن اتمسح');
    await refresh();
    return true;
  }

  if (action === 'native-clear') {
    const { words, misses } = await nativeCacheStats();
    const ok = await confirmAction({
      title: 'امسح التسجيلات المخزّنة',
      message:
        `هيتمسح ${words} تسجيل${misses ? ` و${misses} كلمة دوّرنا عليها وملقيناش` : ''}. ` +
        'مش بيأثر على أي حاجة من بياناتك — دي حاجات مجلوبة من برّه.',
      confirmLabel: 'امسح',
    });
    if (!ok) return true;
    const removed = await clearNativeCache();
    toastOk(`اتمسح ${removed}`);
    await refresh();
    return true;
  }

  return false;
}

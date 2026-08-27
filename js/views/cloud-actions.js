/**
 * LingoLife — أفعالُ لوحات السحابة (WS-H · بنود ١٣ و١٤ و١٧ و P)
 *
 * ⚠️ **ولا ناقلَ هنا ولا Google.** كلُّ سطرٍ يمرّ على `cloud-service.js`،
 *    وما تفعله هذه الأفعالُ هو **السؤال والتأكيد والعرض** — والعملُ
 *    نفسُه في الخدمات.
 *
 * ⚠️ **وكلُّ فعلٍ يفقد شيئًا يسأل أوّلًا** — ولكلٍّ نصُّه هو، لا رسالةٌ
 *    عامّة. «متأكّد؟» لا تقول ماذا سيضيع.
 */

import { toast, toastOk, toastError } from '../components/toast.js';
import { confirmAction, showModal } from '../components/modal.js';
import { html, raw, formatBytes } from '../utils/dom.js';
import { relativeTime } from '../utils/dates.js';
import { cloud, isCloudActive, attachCloud, detachCloud }
  from '../services/cloud/cloud-service.js';
import { media } from '../db/repositories.js';
import { openConflictReview } from '../modals/conflict-review.js';
import { storageReport as mediaStorageReport, removeLocalCopies }
  from '../services/cloud/offline-pack.js';
import {
  createCloudBackup, inspectCloudBackup, restoreCloudBackup,
  fullBackupReadiness, applyRetention, RETENTION,
} from '../services/cloud/cloud-backup.js';
import { AFTER_RESTORE, AFTER_RESTORE_TEXT, detectReplacement, replacementSummary }
  from '../services/cloud/restore-guard.js';
import { BACKUP_KIND, FAIL_TEXT } from '../services/cloud/transport.js';
import { driveConfigured, NOT_CONFIGURED } from '../services/cloud/drive-config.js';

const BUSY = 10 * 60 * 1000;

const say = (error) => FAIL_TEXT[error?.category] || error?.message || 'حصل خطأ مش متوقّع';

/**
 * يعالج فعلًا من لوحات السحابة.
 *
 * @returns {Promise<boolean>} هل عولج؟
 */
export async function handleCloudAction(action, element, refresh) {
  if (!action?.startsWith('cloud-')) return false;

  /* ⚠️ ولا فعلَ يعمل بلا ربط — إلّا الربطَ نفسَه. */
  if (action !== 'cloud-connect' && !isCloudActive()) {
    toast('Google Drive مش متصل');
    return true;
  }

  /* ------------------------------------------------------------ *
   * ١ — المزامنة
   * ------------------------------------------------------------ */

  if (action === 'cloud-connect') {
    if (!driveConfigured()) {
      await showModal({
        title: NOT_CONFIGURED.title,
        body: html`<p class="field-hint">${NOT_CONFIGURED.detail}</p>`,
        actions: [{ label: 'تمام', value: null }],
      });
      return true;
    }
    /*
     * ⚠️ **والناقلُ يُركَّب هنا ولا يُختار في أيّ مكانٍ آخر.** سطرٌ
     *    واحدٌ يفرّق بين المحاكي وDrive، وكلُّ ما فوقه — منسّقٌ وطابورٌ
     *    ونسخٌ وشاشات — لا يعرف أيَّهما رُكِّب.
     */
    const { createDriveTransport } = await import('../services/cloud/drive-transport.js');
    const dismiss = toast('بيفتح نافذة Google…', { duration: BUSY });
    try {
      const transport = createDriveTransport();
      attachCloud(transport);
      const state = await cloud.sync.connect();
      dismiss();

      if (state.state === 'AUTH_REQUIRED' || state.state === 'ERROR') {
        toastError(state.error?.message || 'مقدرناش نربط Drive');
      } else {
        toastOk(`اتربط${state.account ? ` · ${state.account}` : ''}`);
      }
    } catch (error) {
      dismiss();
      await detachCloud().catch(() => {});
      toastError(say(error));
    }
    await refresh();
    return true;
  }

  if (action === 'cloud-disconnect') {
    const ok = await confirmAction({
      title: 'افصل Google Drive',
      message: 'الفصل <strong>مش بيمسح حاجة</strong> — لا ذكرياتك على الجهاز '
        + 'ولا ملفّاتك على Drive. معناه حاجة واحدة: بطّل مزامنة.',
      confirmLabel: 'افصل',
    });
    if (!ok) return true;
    /*
     * ⚠️ **والفصلُ يسحب الإذنَ من Google أيضًا** (داخل `transport.disconnect`)
     *    لا ينسى الرمزَ محلّيًّا وحدَه. ولولا ذلك لبقي الإذنُ ممنوحًا في
     *    حسابك، فيأخذ أوّلُ تبويبٍ يفتح التطبيقَ رمزًا صامتًا — و«افصل»
     *    تكون قد كذبت.
     */
    await cloud.sync.disconnect();
    await detachCloud();
    toastOk('اتفصل، والإذن اتسحب من Google — بياناتك زي ما هي');
    await refresh();
    return true;
  }

  if (action === 'cloud-sync-now') {
    const dismiss = toast('بيزامن…', { duration: BUSY });
    try {
      const result = await cloud.sync.syncNow();
      dismiss();
      if (result.conflicts) {
        toast(`فيه ${result.conflicts.length} تعارض محتاج قرارك`);
      } else if (result.held) {
        toast('المزامنة موقوفة بعد استرجاع — محتاجة قرارك');
      } else if (result.ok) {
        toastOk(result.pushed?.uploaded
          ? `اترفع ${result.pushed.changes} تغيير`
          : 'كل حاجة متزامنة');
      } else {
        toastError(say(result.error));
      }
    } catch (error) {
      dismiss();
      toastError(say(error));
    }
    await refresh();
    return true;
  }

  if (action === 'cloud-review') {
    const plan = cloud.sync.currentPlan();
    if (!plan) {
      toast('مفيش تعارض منتظر');
      await refresh();
      return true;
    }
    const outcome = await openConflictReview(plan);
    if (!outcome.applied) {
      /* ⚠️ و«إلغاء» = صفرُ كتابات — والخدمةُ تنسى الخطّة. */
      cloud.sync.cancelConflicts();
      toast('اتلغى — مفيش حاجة اتكتبت');
    } else {
      const applied = await cloud.sync.applyPending();
      if (applied.ok) toastOk('اتطبّق قرارك');
      else toastError(applied.reason || 'مقدرناش نطبّق');
    }
    await refresh();
    return true;
  }

  /* ------------------------------------------------------------ *
   * ما بعد الاسترجاع — ثلاثةُ قراراتٍ لا اثنان (بند P)
   * ------------------------------------------------------------ */

  if (action === 'cloud-after-restore') {
    const detected = await detectReplacement();
    const summary = replacementSummary(detected);

    const choice = await showModal({
      title: 'استرجعت نسخة — عايز تعمل إيه؟',
      wide: true,
      body: html`
        <p class="field-hint">
          القاعدة على الجهاز ده اتبدّلت بنسخة أقدم. لو المزامنة كمّلت
          عادي، <strong>الحالة الأحدث من أجهزتك التانية هترجع بالدمج</strong>
          والاسترجاع هيتلغي — فمحتاجين قرارك الأول.
        </p>
        ${raw(summary.lostChanges ? html`
          <p class="field-hint">
            الفرق: <strong>${summary.lostChanges}</strong> تغيير كانوا معروفين
            هنا قبل الاسترجاع${detected.seenAt
              ? ` (آخر مرّة شفناهم ${relativeTime(detected.seenAt)})` : ''}.
          </p>` : '')}
        <div class="cloud-list">
          ${raw(Object.keys(AFTER_RESTORE).map((key) => html`
            <div class="cloud-row">
              <div class="cloud-row-main">
                <span class="cloud-row-name">${AFTER_RESTORE_TEXT[key].label}</span>
                <span class="cloud-row-when">${AFTER_RESTORE_TEXT[key].detail}</span>
              </div>
            </div>`).join(''))}
        </div>`,
      actions: [
        { label: 'دلوقتي لأ', value: null, variant: 'ghost' },
        { label: AFTER_RESTORE_TEXT.LOCAL_ONLY.label, value: AFTER_RESTORE.LOCAL_ONLY },
        { label: AFTER_RESTORE_TEXT.ADOPT_EVERYWHERE.label, value: AFTER_RESTORE.ADOPT_EVERYWHERE },
        { label: AFTER_RESTORE_TEXT.RESUME_SYNC.label, value: AFTER_RESTORE.RESUME_SYNC, variant: 'ghost' },
      ],
    });

    if (!choice) return true;

    /* ⚠️ و«ألغِ الاسترجاع» فعلٌ يفقد النسخةَ المسترجَعة — فيُؤكَّد وحدَه. */
    if (choice === AFTER_RESTORE.RESUME_SYNC) {
      const ok = await confirmAction({
        title: 'ألغِ أثر الاسترجاع',
        message: 'المزامنة هترجع طبيعي، و<strong>الحالة الأحدث من أجهزتك '
          + 'هترجع بالدمج</strong> — يعني اللي استرجعته هيتغطّى.',
        confirmLabel: 'كمّل مزامنة',
        danger: true,
      });
      if (!ok) return true;
    }

    const result = await cloud.sync.resolveRestore(choice);
    if (result.ok) toastOk('اتسجّل قرارك');
    else toastError(result.reason || 'مقدرناش ننفّذ القرار');
    await refresh();
    return true;
  }

  /* ------------------------------------------------------------ *
   * ٢ — الملفّات
   * ------------------------------------------------------------ */

  if (action === 'cloud-download-all') {
    const report = await mediaStorageReport();
    if (!report.cloudOnly.count) {
      toast('كل الملفّات موجودة على الجهاز ده');
      return true;
    }
    const ok = await confirmAction({
      title: 'نزّل كل الملفّات',
      message: `هينزّل ${report.cloudOnly.count} ملف بحجم `
        + `<strong>${formatBytes(report.cloudOnly.bytes)}</strong>. `
        + 'تقدر توقّف في أي وقت، واللي اتنزّل بيفضل.',
      confirmLabel: 'نزّل',
    });
    if (!ok) return true;

    await cloud.transfers.enqueue(report.cloudOnly.ids);
    toast('التنزيل بدأ — تقدر تسيب الشاشة');
    await cloud.transfers.idle();
    const after = cloud.transfers.summary();
    if (after.failed) toastError(`${after.failed} ملف فشل — تقدر تجرّب تاني`);
    else toastOk(`اتنزّل ${after.completed} ملف`);
    await refresh();
    return true;
  }

  if (action === 'cloud-cancel-downloads') {
    const n = cloud.transfers.cancelPending();
    toast(n ? `اتوقّف ${n} — اللي بينزّل دلوقتي هيكمّل` : 'مفيش حاجة مستنيّة');
    await refresh();
    return true;
  }

  if (action === 'cloud-retry-downloads') {
    const n = cloud.transfers.retryFailed();
    if (!n) { toast('مفيش حاجة فشلت'); return true; }
    toast(`بيعيد ${n}…`);
    await cloud.transfers.idle();
    await refresh();
    return true;
  }

  if (action === 'cloud-upload-pending') {
    const ready = await cloud.uploads.readiness();
    if (!ready.count) { toast('كل الملفّات مرفوعة'); return true; }
    const dismiss = toast(`بيرفع ${ready.count} ملف…`, { duration: BUSY });
    const result = await cloud.uploads.uploadPending();
    dismiss();
    if (result.stoppedBy) toastError(FAIL_TEXT[result.stoppedBy] || result.stoppedBy);
    else if (result.failed) toastError(`${result.failed} ملف فشل رفعه`);
    else toastOk(`اترفع ${result.uploaded} ملف · ${formatBytes(result.bytes)}`);
    await refresh();
    return true;
  }

  if (action === 'cloud-free-space') {
    /*
     * المؤهَّلُ للتفريغ: **محلّيٌّ وله نسخةٌ على Drive**. و`removeLocalCopies`
     * تعيد فحصَ الشرط بنفسها — فالتصفيةُ هنا لتقصير القائمة لا لتقرير
     * الأمان. والأمانُ في الخدمة، حيث لا يمكن تجاوزُه بنداءٍ من مكانٍ آخر.
     */
    const ids = (await media.getAll())
      .filter((row) => row.blob && row.driveFileId)
      .map((row) => row.id);
    if (!ids.length) { toast('مفيش حاجة ممكن تتفضّى دلوقتي'); return true; }

    const preview = await removeLocalCopies(ids, { dryRun: true });
    const ok = await confirmAction({
      title: 'شيل النسخ المحلّية',
      message: `هيتفضّى <strong>${formatBytes(preview.freed)}</strong> من `
        + `${preview.eligible} ملف. <strong>ده مش حذف</strong>: الملفّات هتفضل `
        + 'على Drive ومربوطة بذكرياتها، وهتتنزّل تاني لمّا تحتاجها.',
      confirmLabel: 'شيل النسخ المحلّية',
    });
    if (!ok) return true;

    const done = await removeLocalCopies(ids);
    toastOk(`اتفضّى ${formatBytes(done.freed)} من ${done.removed} ملف`);
    await refresh();
    return true;
  }

  /* ------------------------------------------------------------ *
   * ٣ — النسخُ الاحتياطيّة
   * ------------------------------------------------------------ */

  if (action === 'cloud-backup-full' || action === 'cloud-backup-light') {
    const kind = action === 'cloud-backup-full' ? BACKUP_KIND.FULL : BACKUP_KIND.LIGHT;

    /* ⚠️ ونسخةٌ «كاملة» ينقصها ملفّاتٌ تُعلن نقصَها قبل أن تُبنى. */
    if (kind === BACKUP_KIND.FULL) {
      const ready = await fullBackupReadiness();
      if (!ready.complete) {
        const go = await confirmAction({
          title: 'النسخة الكاملة هتبقى ناقصة',
          message: `${ready.warning} تقدر تنزّلهم الأول، أو تعمل نسخة خفيفة، `
            + 'أو تكمّل وإنت عارف.',
          confirmLabel: 'كمّل وأنا عارف',
        });
        if (!go) return true;
      }
    }

    const dismiss = toast('بيجهّز النسخة… ابقَ في الصفحة', { duration: BUSY });
    try {
      const result = await createCloudBackup(cloud.transport, {
        kind,
        onProgress: (p) => console.info(`[cloud-backup] ${p.phase}: ${p.label || ''}`),
      });
      dismiss();
      toastOk(`اترفعت «${result.name}» · ${formatBytes(result.bytes)}`
        + (result.omittedCount ? ` · ${result.omittedCount} ملف من Drive` : ''));
    } catch (error) {
      dismiss();
      toastError(say(error));
    }
    await refresh();
    return true;
  }

  if (action === 'cloud-inspect-backup') {
    const fileId = element?.dataset?.file;
    if (!fileId) return true;

    const dismiss = toast('بينزّل ويفحص — مش بيلمس بياناتك', { duration: BUSY });
    let inspection;
    try {
      inspection = await inspectCloudBackup(cloud.transport, fileId);
    } catch (error) {
      dismiss();
      toastError(say(error));
      return true;
    }
    dismiss();

    if (!inspection.ok) {
      await showModal({
        title: 'النسخة دي مش صالحة',
        body: html`<p class="field-hint">الفحص لقى مشاكل تمنع الاسترجاع.</p>`,
        actions: [{ label: 'تمام', value: null }],
      });
      return true;
    }

    const go = await showModal({
      title: `نسخة ${inspection.preview.kindLabel}`,
      body: html`
        <div class="kv-row"><span class="k">اتعملت</span>
          <span class="v">${relativeTime(inspection.preview.createdAt)}</span></div>
        <div class="kv-row"><span class="k">سجلّات</span>
          <span class="v num">${inspection.preview.records}</span></div>
        <div class="kv-row"><span class="k">ملفّات جوّه النسخة</span>
          <span class="v num">${inspection.preview.blobs}</span></div>
        <p class="field-hint" style="margin-top:var(--sp-3)">${inspection.preview.note}</p>
        <p class="field-hint">
          <strong>الاسترجاع بيبدّل كل بياناتك الحالية بالنسخة دي</strong>،
          وبعده المزامنة هتقف وتسألك قبل ما تكمّل.
        </p>`,
      actions: [
        { label: 'اقفل', value: null, variant: 'ghost' },
        { label: 'استرجع النسخة دي', value: 'go', variant: 'danger' },
      ],
    });
    if (go !== 'go') return true;

    const sure = await confirmAction({
      title: 'استرجاع',
      message: 'كل اللي على الجهاز ده دلوقتي هيتبدّل باللي في النسخة. '
        + 'العملية <strong>كلها أو ولا حاجة</strong> — لو حصل خطأ، بياناتك '
        + 'الحالية بتفضل زي ما هي.',
      confirmLabel: 'استرجع',
      danger: true,
    });
    if (!sure) return true;

    const dismiss2 = toast('بيسترجع… ما تقفلش الصفحة', { duration: BUSY });
    try {
      await restoreCloudBackup(inspection, { confirmed: true });
      dismiss2();
      toastOk('اترجعت النسخة — المزامنة موقوفة لحد ما تقرّر');
    } catch (error) {
      dismiss2();
      toastError(say(error));
    }
    await refresh();
    return true;
  }

  if (action === 'cloud-retention') {
    const policy = element?.dataset?.policy;
    const row = RETENTION[policy];
    if (!row) return true;

    if (!Number.isFinite(row.keep)) {
      toast('تمام — مفيش نسخة هتتمسح');
      return true;
    }
    const ok = await confirmAction({
      title: row.label,
      message: `النسخ الأقدم من آخر ${row.keep} <strong>هتتمسح من Drive نهائيًا</strong>. `
        + 'ده فعل مباشر دلوقتي، مش سياسة بتشتغل لوحدها بعدين.',
      confirmLabel: 'امسح القديم',
      danger: true,
    });
    if (!ok) return true;

    const result = await applyRetention(cloud.transport, policy, { confirmed: true });
    if (result.unsupported) toast('الناقل ده مش بيدعم الحذف');
    else toastOk(result.deleted ? `اتمسح ${result.deleted}` : 'مفيش حاجة قديمة تتمسح');
    await refresh();
    return true;
  }

  return false;
}

/* ================================================================== *
 * أفعالُ صفحة الذكرى (بند ٨)
 * ================================================================== */

/**
 * يجلب بايتاتِ وسيطٍ غائبٍ ثم يفتحه بالمسار العاديّ.
 *
 * ⚠️ **والفشلُ يقول سببَه بالعربيّة.** «مفيش إنترنت» فعلٌ تعرف ما تفعله
 *    بعده؛ و«حصل خطأ» لا.
 */
export async function handleSceneMediaFetch(mediaId, sceneId) {
  const { ensureBytes } = await import('../services/media-service.js');
  const dismiss = toast('بينزّل الملف…', { duration: BUSY });
  const outcome = await ensureBytes(mediaId);
  dismiss();

  if (!outcome.ok) {
    toastError(outcome.reason || 'مقدرناش ننزّل الملف');
    return;
  }

  const [{ openLightbox }, { reloadScene }] = await Promise.all([
    import('../components/lightbox.js'),
    import('../ui-state.js'),
  ]);
  await reloadScene(sceneId);
  if (outcome.record?.kind === 'image') openLightbox(mediaId, sceneId);
}

/** «خلّي الذكرى أوفلاين» · «الصوت بس» · «الصور بس». */
export async function handleSceneOffline(action, sceneId) {
  if (!isCloudActive()) { toast('Google Drive مش متصل'); return; }

  const kind = action === 'scene-offline-audio' ? 'audio'
    : action === 'scene-offline-image' ? 'image' : null;

  const { mediaIdsOfScene, sceneOfflineReport } = await import('../services/cloud/offline-pack.js');
  const report = await sceneOfflineReport(sceneId, { kind });
  if (!report.missing.count) { toast('كل الملفّات دي موجودة على الجهاز'); return; }

  /* ⚠️ والحجمُ يُعرَض قبل التنزيل لا بعده — على باقةٍ محدودةٍ الفرقُ فعليّ. */
  const ok = await confirmAction({
    title: 'نزّل ملفّات الذكرى',
    message: `هينزّل ${report.missing.count} ملف بحجم `
      + `<strong>${formatBytes(report.missing.bytes)}</strong>.`,
    confirmLabel: 'نزّل',
  });
  if (!ok) return;

  const ids = await mediaIdsOfScene(sceneId, { kind });
  await cloud.transfers.enqueue(ids);
  toast('التنزيل بدأ…');
  await cloud.transfers.idle();

  const after = await sceneOfflineReport(sceneId, { kind });
  if (after.complete) toastOk('الذكرى دي متاحة أوفلاين دلوقتي');
  else toastError(`لسه ${after.missing.count} ملف — تقدر تجرّب تاني`);

  const { reloadScene } = await import('../ui-state.js');
  await reloadScene(sceneId);
}

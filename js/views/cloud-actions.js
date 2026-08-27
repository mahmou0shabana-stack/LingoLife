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
import { withProgress, startProgress } from '../components/progress.js';
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
    /*
     * ⚠️ **ولا نسبةَ هنا ولا يمكن أن تكون**: الانتظارُ على **المستخدم**
     *    داخل نافذة Google — قد يثوانٍ وقد يدقيقة. فشريطٌ غيرُ محدَّدٍ
     *    ونصٌّ يقول أين نحن بالضبط، لا رقمٌ يتحرّك بلا معنى.
     */
    const bar = startProgress({ key: 'cloud-connect', title: 'ربط Google Drive' });
    if (!bar) return true;
    try {
      bar.indeterminate('بيفتح نافذة Google — كمّل الدخول من هناك');
      const transport = createDriveTransport();
      attachCloud(transport);
      bar.indeterminate('بيتأكّد من الإذن ويدوّر على مجلّد LingoLife…');
      const state = await cloud.sync.connect();

      if (state.state === 'AUTH_REQUIRED' || state.state === 'ERROR') {
        bar.fail(state.error?.message || 'مقدرناش نربط Drive', {
          retry: () => handleCloudAction('cloud-connect', element, refresh),
        });
      } else {
        bar.done(`اتربط${state.account ? ` · ${state.account}` : ''}`);
      }
    } catch (error) {
      await detachCloud().catch(() => {});
      bar.fail(say(error), {
        retry: () => handleCloudAction('cloud-connect', element, refresh),
      });
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
    /*
     * ⚠️ **ومراحلُ المزامنة معروفةٌ سلفًا، وعددُها لا.**
     *    الآلةُ تعلن `step` عند كلّ خطوة («بيجيب التغييرات»، «بيرفع
     *    الملفّات»، «بيرفع تغييراتك») فتُعرَض كما هي. أمّا «كم حزمةً
     *    سنجد على Drive» فلا يُعرَف قبل السؤال — ولذلك المرحلةُ
     *    الأولى شريطٌ غيرُ محدَّد، لا شريطٌ يدّعي ٣٣٪.
     */
    return withProgress({
      key: 'cloud-sync',
      title: 'مزامنة',
      stages: [
        'بيتحقّق', 'بيجيب التغييرات', 'بينشر بياناتك القديمة',
        'بيرفع الملفّات', 'بيرفع تغييراتك',
      ],
    }, async (bar) => {
      const STEP = {
        'يتحقّق': 0,
        'بيجيب التغييرات': 1,
        'بينشر بياناتك القديمة': 2,
        'بيرفع الملفّات': 3,
        'بيرفع تغييراتك': 4,
      };
      const stop = cloud.sync.subscribe((snap) => {
        if (!snap.step || STEP[snap.step] === undefined) return;
        bar.stage(STEP[snap.step], snap.step);
        /* ونشرُ خطِّ الأساس يعرف مجموعَه سلفًا — فالنسبةُ حقيقيّة. */
        if (snap.baseline?.total) {
          bar.set({ done: snap.baseline.done, total: snap.baseline.total });
        }
      });
      try {
        const result = await cloud.sync.syncNow();
        stop();
        if (result.conflicts) {
          bar.done(`فيه ${result.conflicts.length} تعارض محتاج قرارك`);
        } else if (result.held) {
          bar.done('المزامنة موقوفة بعد استرجاع — محتاجة قرارك');
        } else if (result.ok) {
          bar.done(syncSummary(result.counts));
        } else {
          bar.fail(say(result.error), {
            retry: () => handleCloudAction('cloud-sync-now', element, refresh),
          });
        }
      } catch (error) {
        stop();
        bar.fail(say(error), {
          retry: () => handleCloudAction('cloud-sync-now', element, refresh),
        });
      }
      await refresh();
      return true;
    });
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

    /*
     * ⚠️ **و«الإلغاء» هنا آمنٌ فعلًا** — ولذلك يظهر. `cancelPending`
     *    تُفرغ الطابورَ وتترك الجاريَ يكمل، وكلُّ ملفٍّ اكتمل يبقى.
     *    فليس فيه نصفُ ملفٍّ مكتوبٌ في القاعدة: البايتاتُ تُكتَب بعد
     *    اكتمال التنزيل والتحقّق من بصمته لا قبله.
     */
    return withProgress({
      key: 'cloud-download-all',
      title: 'تنزيل كل الملفّات',
      onCancel: () => cloud.transfers.cancelPending(),
    }, async (bar) => {
      const stop = cloud.transfers.subscribe((snap) => {
        bar.set({
          label: snap.current.length
            ? `بينزّل ${snap.current.length} ملف دلوقتي…`
            : 'في الطابور…',
          done: snap.completed,
          total: snap.total,
          bytes: snap.bytesTotal ? snap.bytesDone : undefined,
          totalBytes: snap.bytesTotal || undefined,
        });
      });

      await cloud.transfers.enqueue(report.cloudOnly.ids);
      await cloud.transfers.idle();
      stop();

      const after = cloud.transfers.summary();
      if (after.failed) {
        bar.fail(`${after.failed} ملف فشل — اتنزّل ${after.completed}`, {
          retry: () => handleCloudAction('cloud-retry-downloads', element, refresh),
        });
      } else if (after.cancelled) {
        bar.cancelled(`اتوقّف — اتنزّل ${after.completed} من ${after.total}`);
      } else {
        bar.done(`اتنزّل ${after.completed} ملف · ${formatBytes(after.bytesDone)}`);
      }
      await refresh();
      return true;
    });
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
    /*
     * ⚠️ **والعدُّ من `readiness()` لا من الرافع.** الرافعُ يقول «الملفُّ
     *    الجاري» ولا يقول «كم بقي»، والمجموعُ معروفٌ سلفًا من الفحص
     *    المحلّيّ قبل أيّ نداءِ شبكة. فالنسبةُ حقيقيّةٌ لا مقدَّرة.
     */
    return withProgress({
      key: 'cloud-upload-pending',
      title: 'رفع الملفّات على Drive',
      onCancel: () => cloud.uploads.stop(),
    }, async (bar) => {
      let uploaded = 0;
      const stop = cloud.uploads.subscribe((snap) => {
        if (snap.last && snap.state === 'idle') uploaded = snap.last.uploaded;
        bar.set({
          label: snap.current
            ? `بيرفع ملف ${uploaded + 1} من ${ready.count} · ${formatBytes(snap.current.bytes)}`
            : 'بيجهّز…',
          done: uploaded,
          total: ready.count,
        });
      });

      const result = await cloud.uploads.uploadPending();
      stop();

      if (result.stoppedBy) {
        bar.fail(FAIL_TEXT[result.stoppedBy] || result.stoppedBy, {
          retry: () => handleCloudAction('cloud-upload-pending', element, refresh),
        });
      } else if (result.failed) {
        bar.fail(`${result.failed} ملف فشل رفعه · اترفع ${result.uploaded}`, {
          retry: () => handleCloudAction('cloud-upload-pending', element, refresh),
        });
      } else {
        bar.done(`اترفع ${result.uploaded} ملف · ${formatBytes(result.bytes)}`);
      }
      await refresh();
      return true;
    });
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

    return withProgress({
      key: 'cloud-backup',
      title: kind === BACKUP_KIND.FULL ? 'نسخة كاملة على Drive' : 'نسخة خفيفة على Drive',
      stages: ['البيانات', 'الوسائط', 'الرفع على Drive', 'التحقّق'],
    }, async (bar) => {
      try {
        const result = await createCloudBackup(cloud.transport, {
          kind,
          onProgress: (p) => {
            if (p.phase === 'build') {
              /* البناءُ يعيد بثَّ أطوارِ `serialize` كما هي بأرقامها. */
              const at = p.phase2 === 'media' || p.label?.startsWith('الوسائط') ? 1 : 0;
              bar.stage(at, p.label || 'بيبني…');
              if (Number.isFinite(p.done) && Number.isFinite(p.total) && p.total > 0) {
                bar.set({ done: p.done, total: p.total });
              }
            } else if (p.phase === 'upload') {
              bar.stage(2).set({
                label: 'بيرفع على Drive…',
                totalBytes: p.bytes || undefined,
                bytes: p.bytes ? 0 : undefined,
              });
            } else if (p.phase === 'verify') {
              bar.stage(3).indeterminate('بيتحقّق من النسخة…');
            }
          },
        });
        bar.done(`اترفعت «${result.name}» · ${formatBytes(result.bytes)}`
          + (result.omittedCount ? ` · ${result.omittedCount} ملف من Drive` : ''));
      } catch (error) {
        bar.fail(say(error), {
          retry: () => handleCloudAction(action, element, refresh),
        });
      }
      await refresh();
      return true;
    });
  }

  if (action === 'cloud-inspect-backup') {
    const fileId = element?.dataset?.file;
    if (!fileId) return true;

    const scan = startProgress({
      key: `cloud-inspect:${fileId}`,
      title: 'فحص نسخة من Drive',
      stages: ['التنزيل', 'الفحص'],
    });
    if (!scan) return true;
    let inspection;
    try {
      inspection = await inspectCloudBackup(cloud.transport, fileId, {
        onProgress: (p) => {
          if (p.phase === 'download') {
            /* بايتاتُ التنزيل معروفةٌ من الناقل — فالنسبةُ حقيقيّة. */
            scan.stage(0, p.label || 'بينزّل النسخة…');
            if (Number.isFinite(p.loaded) && Number.isFinite(p.total) && p.total > 0) {
              scan.set({ bytes: p.loaded, totalBytes: p.total });
            }
          } else if (p.phase === 'inspect') {
            scan.stage(1).indeterminate('بيفحص — مش بيلمس بياناتك');
          }
        },
      });
    } catch (error) {
      scan.fail(say(error), {
        retry: () => handleCloudAction('cloud-inspect-backup', element, refresh),
      });
      return true;
    }
    scan.close();

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

    /*
     * ⚠️ **ولا إلغاءَ هنا كما في استرجاع `.llife`** — ونفسُ السبب،
     *    لأنه **نفسُ المحرّك**: `restoreCloudBackup` تنادي `restoreBackup`
     *    بعينها. فالمراحلُ واحدةٌ والضمانةُ واحدة.
     */
    return withProgress({
      key: 'cloud-restore',
      title: 'استرجاع نسخة من Drive',
      stages: ['تجهيز الخانة', 'البيانات', 'الوسائط', 'التحقّق', 'التحويل'],
    }, async (bar) => {
      const STEP = { prepare: 0, data: 1, media: 2, verify: 3, switch: 4 };
      try {
        await restoreCloudBackup(inspection, {
          confirmed: true,
          onProgress: (p) => {
            bar.stage(STEP[p.phase] ?? 0, p.label);
            if (Number.isFinite(p.done) && Number.isFinite(p.total) && p.total > 0) {
              bar.set({ done: p.done, total: p.total });
            }
          },
        });
        bar.done('اترجعت النسخة — المزامنة موقوفة لحد ما تقرّر');
      } catch (error) {
        bar.fail(say(error));
      }
      await refresh();
      return true;
    });
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

  /* ⚠️ ومفتاحٌ لكلّ وسيط — فملفّان مختلفان ينزّلان معًا بلوحتين. */
  const bar = startProgress({ key: `media-fetch:${mediaId}`, title: 'تنزيل الملف' });
  if (!bar) return;

  const stop = isCloudActive()
    ? cloud.transfers.subscribe((snap) => {
      const mine = snap.items.find((row) => row.mediaId === mediaId);
      if (!mine) return;
      bar.set({
        label: 'بينزّل ويتحقّق من بصمته…',
        bytes: mine.bytes ? mine.loaded : undefined,
        totalBytes: mine.bytes || undefined,
      });
    })
    : () => {};

  const outcome = await ensureBytes(mediaId);
  stop();

  if (!outcome.ok) {
    bar.fail(outcome.reason || 'مقدرناش ننزّل الملف', {
      retry: () => handleSceneMediaFetch(mediaId, sceneId),
    });
    return;
  }
  bar.done('اتنزّل');

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

  /* ⚠️ ومفتاحُ العمليّة يحمل رقمَ الذكرى — فذكرَيان تُنزَّلان معًا بلوحتين. */
  await withProgress({
    key: `scene-offline:${sceneId}:${kind || 'all'}`,
    title: 'تنزيل ملفّات الذكرى',
    onCancel: () => cloud.transfers.cancelPending(),
  }, async (bar) => {
    bar.set({ done: 0, total: ids.length, label: 'في الطابور…' });
    const stop = cloud.transfers.subscribe((snap) => {
      bar.set({
        label: snap.current.length ? `بينزّل ${snap.current.length} ملف…` : 'في الطابور…',
        done: snap.completed,
        total: snap.total,
        bytes: snap.bytesTotal ? snap.bytesDone : undefined,
        totalBytes: snap.bytesTotal || undefined,
      });
    });

    await cloud.transfers.enqueue(ids);
    await cloud.transfers.idle();
    stop();

    const after = await sceneOfflineReport(sceneId, { kind });
    if (after.complete) bar.done('الذكرى دي متاحة أوفلاين دلوقتي');
    else {
      bar.fail(`لسه ${after.missing.count} ملف`, {
        retry: () => handleSceneOffline(action, sceneId),
      });
    }
  });

  const { reloadScene } = await import('../ui-state.js');
  await reloadScene(sceneId);
}


/* ================================================================== *
 * نصُّ نتيجة المزامنة — من الأرقام لا من «لم يُرمَ استثناء»
 * ================================================================== */

/**
 * ⚠️ **«كل حاجة متزامنة» كانت تُقال من `result.ok` وحدَها.**
 *
 *    وهي جملةٌ تدّعي **تقاربَ حالة**، بينما `ok` لا تعني إلّا أن الدورةَ
 *    انتهت بلا استثناء. وقد قالها الموبايلُ حرفيًّا ولم يصله شيءٌ من
 *    التابلت — لأن التابلتَ لم يرفع، ولأن لا أحدَ كان يعدّ.
 *
 *    فالقاعدةُ الآن:
 *      · وصلت حزمٌ وطُبِّقت  → نقول ماذا وصل وكم طُبِّق؛
 *      · وصلت حزمٌ ولم تُطبَّق → **لا نقول «متزامن»** بل نقول إنها لم تُطبَّق؛
 *      · لم يصل شيءٌ ولم يُرفَع → «مفيش تغييرات جديدة» بأصفارٍ صريحة —
 *        وهي جملةٌ عن **هذه الدورة**، لا شهادةُ تطابقٍ بين الجهازين.
 */
export function syncSummary(counts) {
  if (!counts) return 'اكتملت دورة المزامنة';

  const lines = [];
  const {
    packagesDiscovered = 0, packagesApplied = 0, packagesFailed = 0,
    recordsReceived = 0, recordsApplied = 0, recordsUnchanged = 0,
    baselinePublished = 0, changesUploaded = 0,
    mediaUploaded = 0, mediaFailed = 0, mediaPending = 0,
  } = counts;

  /* ⚠️ فشلُ تطبيقِ حزمةٍ اكتُشفت يمنع أيَّ صياغةٍ خضراء. */
  if (packagesFailed) {
    lines.push(`⚠️ ${packagesFailed} حزمة وصلت وما اتطبّقتش`);
  }

  if (recordsReceived) {
    lines.push(`نزّلنا ${recordsReceived} تغيير من جهاز تاني`);
    lines.push(`طبّقنا ${recordsApplied}`);
    if (recordsUnchanged) lines.push(`${recordsUnchanged} كانوا موجودين بالفعل`);
  } else if (packagesDiscovered && !packagesApplied) {
    lines.push(`لقينا ${packagesDiscovered} حزمة بس ما اتطبّقش منها حاجة`);
  }

  if (baselinePublished) lines.push(`نشرنا ${baselinePublished} سجل قديم لأول مرة`);
  if (changesUploaded) lines.push(`رفعنا ${changesUploaded} تغيير`);
  if (mediaUploaded) lines.push(`رفعنا ${mediaUploaded} ملف`);
  if (mediaFailed) lines.push(`⚠️ ${mediaFailed} ملف فشل رفعه`);
  if (mediaPending) lines.push(`${mediaPending} ملف لسه مستني`);

  if (!lines.length) {
    /*
     * ⚠️ ولا نقول «كل حاجة متزامنة»: هذه الدورةُ لم تجد جديدًا، وهذا
     *    كلُّ ما نعرفه. والتطابقُ الكاملُ ادّعاءٌ لا يملك أيُّ طرفٍ
     *    إثباتَه من جانبه وحدَه.
     */
    return 'مفيش تغييرات جديدة · رفع 0 · تنزيل 0 · ملفات 0';
  }
  return `اكتملت دورة المزامنة — ${lines.join(' · ')}`;
}

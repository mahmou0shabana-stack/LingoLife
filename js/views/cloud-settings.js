/**
 * LingoLife — لوحاتُ السحابة في الإعدادات (WS-H · بنود ١٣ و١٧ و Q و R)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ثلاثُ لوحاتٍ لا لوحةٌ واحدة — والفصلُ هو المضمون**
 * ═══════════════════════════════════════════════════════════════
 *
 *   ١. المزامنة بين أجهزتك    توحيدُ **الحالة الآن**
 *   ٢. ملفّاتك على Drive       أينَ تعيش البايتات، وكم تشغل هنا
 *   ٣. النسخ الاحتياطيّة       العودةُ إلى **حالةٍ كانت**
 *
 * ولو جُمعت في لوحةٍ واحدةٍ اسمُها «Google Drive» لَصار الظنُّ الطبيعيّ
 * أن المزامنة نسخةٌ احتياطيّة. وهي ليست: المزامنةُ **تنشر** ما حدث —
 * فلو مسحتَ ذكرى، انتشر المسحُ إلى كلّ جهاز. والنسخةُ وحدَها تعيدها.
 *
 * وهذا الالتباسُ لا يُصحَّح بجملةِ تحذيرٍ صغيرة؛ يُصحَّح بأن يرى الشكلُ
 * ما تقوله الكلمات.
 *
 * ⚠️ **ولا تنادي هذه اللوحاتُ ناقلًا** (بند ٢٧): كلُّ شيءٍ عبر
 *    `cloud-service.js`، ويحرسه اختبارٌ يمسح `js/views/`.
 */

import { html, raw, formatBytes } from '../utils/dom.js';
import { relativeTime } from '../utils/dates.js';
import { icon } from '../components/icons.js';
import { cloudSnapshot, isCloudActive, cloud } from '../services/cloud/cloud-service.js';
import { storageReport as mediaStorageReport } from '../services/cloud/offline-pack.js';
import { fullBackupReadiness, RETENTION } from '../services/cloud/cloud-backup.js';
import { SYNC, SYNC_TEXT } from '../services/cloud/sync-state.js';
import { driveConfigured, NOT_CONFIGURED, DRIVE_SCOPE } from '../services/cloud/drive-config.js';
import { localDevice } from '../services/sync/device.js';

/** يقرأ كلَّ ما تحتاجه اللوحاتُ الثلاث — بلا نداءِ شبكةٍ واحد. */
export async function cloudSettingsData() {
  const [media, backupReady] = await Promise.all([
    mediaStorageReport(),
    fullBackupReadiness(),
  ]);

  return {
    configured: driveConfigured(),
    active: isCloudActive(),
    state: cloudSnapshot(),
    device: localDevice(),
    media,
    backupReady,
    transfers: isCloudActive() ? cloud.transfers.summary() : null,
    uploads: isCloudActive() ? cloud.uploads.summary() : null,
  };
}

/** شارةُ حالةٍ ملوّنةٌ بنصٍّ عربيّ. */
function stateBadge(state) {
  const tone = {
    [SYNC.READY]: 'ok',
    [SYNC.SYNCING]: 'busy',
    [SYNC.LOCAL_PENDING]: 'busy',
    [SYNC.CONFLICT]: 'warn',
    [SYNC.RESTORED_HOLD]: 'warn',
    [SYNC.AUTH_REQUIRED]: 'warn',
    [SYNC.OFFLINE]: 'muted',
    [SYNC.DISCONNECTED]: 'muted',
    [SYNC.ERROR]: 'bad',
  }[state] || 'muted';
  return html`<span class="cloud-badge is-${tone}">${SYNC_TEXT[state] || state}</span>`;
}

/**
 * لوحةٌ تُعرَض حين لا يوجد مُعرِّفُ عميلٍ بعد.
 *
 * ⚠️ **ولا زرَّ ربطٍ ميّتًا.** زرٌّ يُضغَط فلا يحدث شيءٌ يعلّم المستخدمَ
 *    ألّا يثق بالأزرار. فالمكانُ يشرح ما ينقص ومن يملكه.
 */
function notConfiguredNote() {
  return html`
    <div class="cloud-note">
      ${raw(icon('info', 18))}
      <div>
        <strong>${NOT_CONFIGURED.title}</strong>
        <p class="field-hint" style="margin:6px 0 0">${NOT_CONFIGURED.detail}</p>
        <p class="field-hint" style="margin:6px 0 0">
          الصلاحية المطلوبة لمّا يتفعّل: <bdi dir="ltr">${DRIVE_SCOPE}</bdi> —
          يعني <strong>الملفّات اللي التطبيق نفسه بيعملها بس</strong>،
          مش كل Drive بتاعك.
        </p>
      </div>
    </div>`;
}

/* ================================================================== *
 * ١ — المزامنة بين أجهزتك
 * ================================================================== */

function syncPanel(data) {
  const { state, device, configured, active } = data;

  return html`
    <div class="panel cloud-panel" data-domain="sync">
      <h3>${raw(icon('refresh', 18))} المزامنة بين أجهزتك</h3>

      <p class="field-hint" style="margin-bottom:var(--sp-3)">
        بتخلّي <strong>الحالة الحالية</strong> واحدة على كل أجهزتك.
        <strong>مش</strong> نسخة احتياطية: لو مسحت ذكرى، المسح بيتنقل
        للأجهزة التانية كمان — اللي بيرجّعها هي النسخة الاحتياطية تحت.
      </p>

      <div class="kv-row">
        <span class="k">الحالة</span>
        <span class="v">${raw(stateBadge(state.state))}</span>
      </div>
      <div class="kv-row">
        <span class="k">الجهاز ده</span>
        <!--
          ⚠️ **ومعرِّفُ الجهاز لا يُعرَض كاملًا حين لا اسمَ له.** قِيس
             فوُجد يفيض عن الصفّ ويُقصّ من حافّته، فيبدو كأن الاسمَ
             مبتور. وهو ٣٢ حرفًا لا معنى لها لإنسان أصلًا: المعنى في
             **الاسم**، والمعرِّفُ الكاملُ مكانُه التشخيص.
        -->
        <span class="v v-id">${device.label
          ? device.label
          : `جهاز ${String(device.id).slice(-6)}`}</span>
      </div>
      ${raw(device.label ? '' : html`<p class="field-hint" style="margin:0 0 var(--sp-2)">
        سمّي الجهاز ده («التابلت» مثلًا) عشان تعرفه في قايمة أجهزتك.
      </p>`)}
      ${raw(state.account ? html`<div class="kv-row">
        <span class="k">حساب Google</span><span class="v"><bdi dir="ltr">${state.account}</bdi></span>
      </div>` : '')}
      ${raw(Number(state.pending) ? html`<div class="kv-row">
        <span class="k">تغييرات لسه مترفعتش</span><span class="v num">${state.pending}</span>
      </div>` : '')}
      ${raw(state.lastSyncAt ? html`<div class="kv-row">
        <span class="k">آخر مزامنة</span><span class="v">${relativeTime(state.lastSyncAt)}</span>
      </div>` : '')}

      ${raw(state.state === SYNC.CONFLICT ? html`
        <p class="field-hint" style="margin:var(--sp-3) 0">
          فيه تعارض محتاج قرارك. <strong>مفيش حاجة اتكتبت</strong> لحد ما تقرّر.
        </p>
        <button class="btn btn-block" data-action="cloud-review">
          راجع التعارض
        </button>` : '')}

      ${raw(state.state === SYNC.RESTORED_HOLD ? html`
        <p class="field-hint" style="margin:var(--sp-3) 0">
          المزامنة موقوفة بعد استرجاع نسخة — عشان الحالة الأحدث من أجهزتك
          <strong>ما ترجعش لوحدها</strong> وتلغي الاسترجاع.
        </p>
        <button class="btn btn-block" data-action="cloud-after-restore">
          قرّر إيه اللي يحصل
        </button>` : '')}

      ${raw(!configured ? notConfiguredNote() : active ? html`
        <div class="btn-row" style="margin-top:var(--sp-3)">
          <button class="btn" data-action="cloud-sync-now">زامن دلوقتي</button>
          <button class="btn btn-ghost" data-action="cloud-disconnect">افصل الربط</button>
        </div>
        <p class="field-hint" style="margin-top:var(--sp-2)">
          الفصل <strong>مش بيمسح حاجة</strong> — لا من الجهاز ولا من Drive.
        </p>` : html`
        <button class="btn btn-block" style="margin-top:var(--sp-3)"
                data-action="cloud-connect">اربط Google Drive</button>`)}
    </div>`;
}

/* ================================================================== *
 * ٢ — ملفّاتك على Drive والمساحة هنا
 * ================================================================== */

function mediaPanel(data) {
  const { media, configured, active, transfers, uploads } = data;
  const busy = transfers?.active;

  return html`
    <div class="panel cloud-panel" data-domain="media">
      <h3>${raw(icon('db', 18))} ملفّاتك: الصوت والصور</h3>

      <p class="field-hint" style="margin-bottom:var(--sp-3)">
        السجلّات بتتزامن فورًا، لكن <strong>الملفّات نفسها بتتنزّل لمّا
        تحتاجها</strong> — عشان ما نملاش تابلت بأربع جيجا من أول مرّة.
      </p>

      <div class="kv-row">
        <span class="k">كل الملفّات</span>
        <span class="v num">${media.total}</span>
      </div>
      <div class="kv-row">
        <span class="k">موجودة على الجهاز ده</span>
        <span class="v"><span class="num">${media.local.count}</span> · <bdi>${formatBytes(media.local.bytes)}</bdi></span>
      </div>
      ${raw(media.cloudOnly.count ? html`<div class="kv-row">
        <span class="k">على Drive بس — هتتنزّل لمّا تحتاجها</span>
        <span class="v"><span class="num">${media.cloudOnly.count}</span> · <bdi>${formatBytes(media.cloudOnly.bytes)}</bdi></span>
      </div>` : '')}
      ${raw(media.unknown.count ? html`<div class="kv-row">
        <span class="k">⚠️ ملفّات مش موجودة هنا ولا على Drive</span>
        <span class="v num">${media.unknown.count}</span>
      </div>` : '')}

      ${raw(busy ? html`
        <div class="kv-row">
          <span class="k">بينزّل دلوقتي</span>
          <span class="v"><span class="num">${transfers.completed}</span> من ${transfers.total}</span>
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:var(--sp-2)"
                data-action="cloud-cancel-downloads">وقّف اللي لسه مبدأش</button>` : '')}

      ${raw(transfers?.failed ? html`
        <div class="kv-row">
          <span class="k">فشل تنزيلها</span><span class="v num">${transfers.failed}</span>
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:var(--sp-2)"
                data-action="cloud-retry-downloads">جرّب تاني</button>` : '')}

      ${raw(!configured ? '' : active ? html`
        <div class="btn-row" style="margin-top:var(--sp-3)">
          <button class="btn btn-ghost" data-action="cloud-download-all"
                  ${media.cloudOnly.count ? '' : 'disabled'}>
            نزّل كل الملفّات (<bdi>${formatBytes(media.cloudOnly.bytes)}</bdi>)
          </button>
          <button class="btn btn-ghost" data-action="cloud-upload-pending">
            ارفع اللي لسه مترفعش
          </button>
        </div>

        <details style="margin-top:var(--sp-3)">
          <summary>وفّر مساحة على الجهاز ده</summary>
          <p class="field-hint" style="margin:var(--sp-2) 0">
            <strong>ده مش حذف.</strong> الملفّ بيفضل على Drive وبيفضل مربوط
            بذكرياته، وبس بايتاته بتتفضّى من الجهاز ده — وتقدر تنزّله تاني
            في أي وقت. واللي <strong>لسه مترفعش</strong> مش هيتمسّ، لأنه
            ساعتها النسخة الوحيدة في الدنيا.
          </p>
          <div class="kv-row">
            <span class="k">اللي ممكن يتفضّى</span>
            <span class="v"><bdi>${formatBytes(media.reclaimable)}</bdi></span>
          </div>
          <button class="btn btn-ghost btn-block" data-action="cloud-free-space"
                  ${media.reclaimable ? '' : 'disabled'}>
            شيل النسخ المحلّية للملفّات اللي على Drive
          </button>
        </details>` : '')}

      ${raw(uploads?.last?.at ? html`<p class="field-hint" style="margin-top:var(--sp-3)">
        آخر رفع: ${uploads.last.uploaded} ملف · ${relativeTime(uploads.last.at)}
      </p>` : '')}
    </div>`;
}

/* ================================================================== *
 * ٣ — النسخُ الاحتياطيّة على Drive
 * ================================================================== */

function backupPanel(data) {
  const { backupReady, configured, active, backups = [] } = data;

  return html`
    <div class="panel cloud-panel" data-domain="backup">
      <h3>${raw(icon('db', 18))} نسخ احتياطية على Drive</h3>

      <p class="field-hint" style="margin-bottom:var(--sp-3)">
        دي اللي بترجّعك لـ<strong>حالة كانت</strong> — لو مسحت حاجة بالغلط،
        أو لو غلط اتزامن على كل أجهزتك. كل نسخة <strong>بتتحفظ باسم فيه
        وقتها</strong>، ومحدش بيكتب فوق حد.
      </p>

      ${raw(backupReady.warning ? html`
        <div class="cloud-note is-warn">
          ${raw(icon('info', 18))}
          <div>${backupReady.warning}</div>
        </div>` : '')}

      ${raw(backups.length ? html`
        <div class="cloud-list">
          ${raw(backups.map((row) => html`
            <div class="cloud-row" data-backup="${row.fileId}">
              <div class="cloud-row-main">
                <span class="cloud-row-name">${row.kindLabel}</span>
                <span class="cloud-row-when">${relativeTime(row.at)}</span>
              </div>
              <div class="cloud-row-side">
                <bdi>${formatBytes(row.bytes)}</bdi>
                ${raw(row.dependsOnCloudMedia
                  ? html`<span class="cloud-tag">محتاجة ملفّات Drive</span>` : '')}
              </div>
              <button class="btn btn-ghost btn-sm" data-action="cloud-inspect-backup"
                      data-file="${row.fileId}">افحصها</button>
            </div>`).join(''))}
        </div>` : '')}

      ${raw(!configured ? '' : active ? html`
        <div class="btn-row" style="margin-top:var(--sp-3)">
          <button class="btn" data-action="cloud-backup-full">اعمل نسخة كاملة</button>
          <button class="btn btn-ghost" data-action="cloud-backup-light">نسخة خفيفة</button>
        </div>
        <p class="field-hint" style="margin-top:var(--sp-2)">
          <strong>الكاملة</strong> فيها السجلّات والملفّات — بترجع لوحدها
          من غير Drive. <strong>الخفيفة</strong> فيها السجلّات بس وأصغر
          بكتير، بس بترجع الملفّات من Drive لمّا تحتاجها.
        </p>

        <details style="margin-top:var(--sp-3)">
          <summary>الاحتفاظ بالنسخ القديمة</summary>
          <p class="field-hint" style="margin:var(--sp-2) 0">
            الافتراضي: <strong>محدش بيتمسح</strong>. لو اخترت سياسة، الحذف
            بيحصل بضغطة صريحة منك — مش لوحده.
          </p>
          <div class="btn-row">
            ${raw(Object.entries(RETENTION).map(([key, row]) => html`
              <button class="btn btn-ghost btn-sm" data-action="cloud-retention"
                      data-policy="${key}">${row.label}</button>`).join(''))}
          </div>
        </details>` : '')}
    </div>`;
}

/** اللوحاتُ الثلاث، بترتيبها. */
export function cloudPanels(data) {
  return html`
    ${raw(syncPanel(data))}
    ${raw(mediaPanel(data))}
    ${raw(backupPanel(data))}`;
}

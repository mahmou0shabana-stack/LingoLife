/**
 * LingoLife — قسمُ «نموذج Supertonic» داخل لوحة الصوت (المرحلة 1C)
 *
 * ⚠️ **ليس شاشةَ إعداداتٍ ثانية** — قسمٌ مطويٌّ واحدٌ في أكورديون لوحة الصوت
 *    السريعة، بنمط قسم «ذاكرة الصوت المولَّد» نفسِه: سطرُ حال + أزرارٌ قليلة.
 *    يظهر فقط حين يكون مزوّدُ Supertonic مسجَّلًا (خلف علَمه).
 *
 * هذا الملفّ صافٍ: من (حالة النموذج · توفّر المزوّد · العمليّة الجارية) إلى
 * ما يُرسَم. الأفعالُ نفسُها في `shadow-view.js` وتنادي مديرَ 1A والمزوّد.
 *
 * ⚠️ **لا تنزيلَ إلّا بزرّ «نزّل»** — لا شيءَ هنا يبدأ شيئًا بنفسه.
 */

import { html, raw, esc } from '../utils/dom.js';
import { AVAILABILITY } from '../services/shadow/tts/types.js';

const MB = 1024 * 1024;
export const mbText = (n) => `${(n / MB).toFixed(1)} MB`;

/**
 * @param {{ status: object|null, availability?: {status?: string, reason?: string}|null,
 *   job?: {kind: 'download'|'verify'|'delete'|'retry', downloaded?: number, total?: number}|null }} input
 * @returns {{ state: string, text: string, detail: string, progress: {value: number, max: number}|null,
 *   actions: Array<{sh: string, label: string, danger?: boolean}> }}
 */
export function modelSectionView({ status, availability = null, job = null }) {
  if (!status) return { state: 'loading', text: 'بيقرا حالة النموذج…', detail: '', progress: null, actions: [] };
  const size = mbText(status.totalBytes);
  const detail = `${size} · الإصدار ${status.version}`;

  if (job?.kind === 'download') {
    const total = job.total || status.totalBytes;
    const done = job.downloaded ?? status.downloadedBytes ?? 0;
    return { state: 'downloading', text: `بينزّل… ${mbText(done)} من ${mbText(total)}`, detail,
      progress: { value: done, max: total }, actions: [{ sh: 'qv-model-cancel', label: 'ألغِ التنزيل' }] };
  }
  if (job?.kind === 'verify') return { state: 'verifying', text: 'بيتحقّق من الملفّات (SHA-256)…', detail, progress: null, actions: [] };
  if (job?.kind === 'delete') return { state: 'deleting', text: 'بيحذف النموذج…', detail, progress: null, actions: [] };
  if (job?.kind === 'retry') return { state: 'retrying', text: 'بيعيد تشغيل المحرّك…', detail, progress: null, actions: [] };

  if (status.state === 'unsupported') {
    return { state: 'unsupported', text: 'غير مدعوم في هذا المتصفّح', detail: status.error?.message || '', progress: null, actions: [] };
  }
  const error = status.error?.message ? ` — ${status.error.message}` : '';
  if (status.state === 'ready') {
    if (availability?.status === AVAILABILITY.ENGINE_FAILED) {
      return { state: 'engine-failed', text: `منزَّل، لكن المحرّك فشل${availability.reason ? ` — ${availability.reason}` : ''}`,
        detail, progress: null, actions: [
          { sh: 'qv-model-retry', label: 'أعد المحاولة' },
          { sh: 'qv-model-delete', label: 'احذف النموذج', danger: true },
        ] };
    }
    return { state: 'ready', text: 'منزَّل وجاهز بلا نت', detail, progress: null, actions: [
      { sh: 'qv-model-verify', label: 'تحقّق من الملفّات' },
      { sh: 'qv-model-delete', label: 'احذف النموذج', danger: true },
    ] };
  }
  if (status.state === 'partial') {
    return { state: 'partial', text: `تنزيلٌ لم يكتمل — ${mbText(status.downloadedBytes)} محفوظة${error}`, detail,
      progress: { value: status.downloadedBytes, max: status.totalBytes }, actions: [
        { sh: 'qv-model-download', label: 'أكمل التنزيل' },
        { sh: 'qv-model-delete', label: 'احذف الملفّات', danger: true },
      ] };
  }
  if (status.state === 'downloading') {
    return { state: 'downloading', text: `بينزّل… ${mbText(status.downloadedBytes)} من ${size}`, detail,
      progress: { value: status.downloadedBytes, max: status.totalBytes }, actions: [] };
  }
  return { state: 'not-downloaded', text: `غير منزَّل${error}`, detail, progress: null,
    actions: [{ sh: 'qv-model-download', label: `نزّل النموذج (${size})` }] };
}

/**
 * ⚠️ **كلُّ جريانٍ لاتينيٍّ أو رقميٍّ معزولُ الاتّجاه** (`<bdi dir="ltr">`) —
 *    نفسُ درس `isolateLatin` في shadow-view: بلاه قُلب «138.6 MB» إلى «MB 138.6»
 *    والإصدارُ «2026-05-11+cca5a0e» إلى «cca5a0e+11-05-2026» (قِيس بلقطةٍ على 390px).
 * @param {string} text نصٌّ خام (يُهرَّب هنا)
 */
export function isolateRuns(text) {
  return esc(text).replace(/&#?\w+;|[A-Za-z0-9][\w.:+/-]*(?: (?:MB|[A-Za-z0-9][\w.:+/-]*))*/g,
    (run) => (run.startsWith('&') ? run : `<bdi dir="ltr">${run}</bdi>`));
}

/** يرسم ما أعاده `modelSectionView` — بأصناف قسم الذاكرة (زرُّ الحذف هو `sh-qv-cache-x` نفسُه). */
export function modelSectionHtml(view) {
  return html`<p class="sh-qv-model-n" dir="rtl" data-qv-model-text data-state="${view.state}">${raw(isolateRuns(view.text))}</p>
    ${raw(view.detail ? html`<p class="sh-qv-info" dir="rtl" data-qv-model-detail>${raw(isolateRuns(view.detail))}</p>` : '')}
    ${raw(view.progress ? html`<progress class="sh-qv-model-bar" data-qv-model-progress
      max="${view.progress.max}" value="${view.progress.value}"></progress>` : '')}
    <div class="sh-qv-model-acts">${raw(view.actions.map((a) => html`<button type="button"
      class="${a.danger ? 'sh-qv-cache-x' : 'sh-qv-model-act'}" data-sh="${a.sh}">${raw(isolateRuns(a.label))}</button>`).join(''))}</div>`;
}

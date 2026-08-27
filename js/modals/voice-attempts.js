/**
 * LingoLife — «صوتي»: تسجيلٌ وسجلٌّ ومقارنة (WS-I · بنود ٨…١٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لا مشغّلَ ثانٍ ولا مسجّلَ ثانٍ ولا مخزنَ ثالث**
 * ═══════════════════════════════════════════════════════════════
 *
 *   التسجيل   `media-service.startRecording()` — موجودةٌ منذ WS23
 *   التشغيل   `audio-service.api` — المالكُ الوحيدُ للتشغيل
 *   التخزين   `media` + `practiceEvidence` عبر `voice-attempts`
 *   الحذف     `deleteWithUndo` — نفسُ سلّة التطبيق ونفسُ التراجع
 *
 * فلا شيءَ هنا إلّا **ترتيبُ خطوات** ورسمُ أزرار.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والهدفُ يُجمَّد عند بدء التسجيل — لا عند الحفظ** (بند ١١)
 * ═══════════════════════════════════════════════════════════════
 *
 * لو قُرئ الهدفُ عند الحفظ لَأمكن أن يتبدّل بينهما، فتُنسَب محاولتُك
 * إلى جملةٍ لم تنطقها. واللقطةُ تُؤخَذ في `beginRecording` وتُقرأ في
 * `commit` — ولا سطرَ بينهما يعيد قراءتها.
 *
 * ⚠️ **ولا كتابةَ قبل «احفظ»** (بند ٢٨): البايتاتُ في الذاكرة و
 *    `ObjectURL` وحدَهما حتى تضغط. و«إلغاء» يُبطل الرابطَ ويُسقط
 *    المرجع — صفرُ صفوفٍ وصفرُ بلوبات.
 */

import { html, raw, formatDuration } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { canRecord, startRecording, urlFor } from '../services/media-service.js';
import { api as audio } from '../services/audio-service.js';
import { media } from '../db/repositories.js';
import { deleteWithUndo } from '../services/delete-service.js';
import { saveAttempt, listAttempts } from '../services/shadow/voice-attempts.js';
import { SCOPE_LABEL } from '../services/shadow/practice-target.js';

/** زمنٌ بشريٌّ مختصر: «النهاردة · 18:20» أو «24 أغسطس · 09:15». */
function whenLabel(at) {
  const date = new Date(at);
  const clock = date.toTimeString().slice(0, 5);
  const today = new Date().toDateString() === date.toDateString();
  if (today) return `النهاردة · ${clock}`;
  return `${date.getDate()} ${date.toLocaleDateString('ar-EG', { month: 'long' })} · ${clock}`;
}

/**
 * يفتح لوحةَ «صوتي» لهدفٍ بعينه.
 *
 * @param {object} target لقطةُ الهدف من `currentTarget()` + هُويّاتُ الجلسة.
 * @param {() => any} speakReference ينطق المرجعَ بنفس مسار الشاشة.
 */
export async function openVoiceAttempts(target, speakReference) {
  if (!target?.ok || !target.key) {
    return toast('اختار جملة أو مقطع الأول');
  }

  /* ── حالةٌ مؤقّتةٌ تعيش وتموت مع اللوحة ── */
  let recorder = null;
  let ticker = null;
  let startedAt = 0;
  /** لقطةُ الهدف لحظةَ بدء التسجيل — تُقرأ عند الحفظ وحدها. */
  let frozen = null;
  /** المحاولةُ غيرُ المحفوظة: بايتاتٌ ورابطُ معاينة. */
  let pending = null;
  let attempts = await listAttempts(target.key);
  let root = null;

  const dropPending = () => {
    if (pending?.url) URL.revokeObjectURL(pending.url);
    pending = null;
  };

  const stopTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };

  const paint = () => {
    if (!root) return;
    const box = root.querySelector('[data-vo-body]');
    if (box) box.innerHTML = bodyHtml();
  };

  function bodyHtml() {
    const scope = SCOPE_LABEL[target.scope] || 'جملة';
    return html`
      <div class="vo-target">
        <span class="vo-scope">${scope}</span>
        <p class="vo-text" dir="ltr" lang="ru">${target.text}</p>
      </div>

      <div class="vo-compare">
        <button class="btn btn-ghost" data-vo="ref">▶ القراءة الآلية</button>
        ${raw(attempts.length ? html`
          <button class="btn btn-ghost" data-vo="mine">▶ آخر تسجيل ليّا</button>
          <button class="btn btn-ghost" data-vo="both">▶ الاتنين ورا بعض</button>` : '')}
      </div>

      ${raw(recorder ? html`
        <div class="vo-live" role="status">
          <span class="vo-dot" aria-hidden="true"></span>
          <span>بيسجّل… <b data-vo-clock>0:00</b></span>
        </div>
        <button class="btn btn-block vo-stop" data-vo="stop">⏹ وقّف</button>`
        : pending ? html`
        <div class="vo-preview">
          <button class="btn btn-ghost" data-vo="preview">▶ اسمع اللي سجّلته</button>
        </div>
        <div class="btn-row">
          <button class="btn" data-vo="save">احفظ</button>
          <button class="btn btn-ghost" data-vo="again">سجّل تاني</button>
          <button class="btn btn-ghost" data-vo="discard">إلغاء</button>
        </div>`
        : html`
        <button class="btn btn-block vo-rec" data-vo="rec">🎙 سجّل صوتي</button>`)}

      <div class="vo-history">
        <h4>تسجيلاتي — ${attempts.length}</h4>
        ${raw(attempts.length ? html`
          <div class="vo-list">
            ${raw(attempts.map((row) => html`
              <div class="vo-row" data-vo-row="${row.id}">
                <button class="btn btn-ghost btn-sm" data-vo="play" data-id="${row.mediaId}">▶</button>
                <span class="vo-when">${whenLabel(row.createdAt)}</span>
                ${raw(row.durationMs
                  ? html`<span class="vo-dur">${formatDuration(row.durationMs)}</span>` : '')}
                <button class="btn btn-ghost btn-sm vo-del" data-vo="del"
                        data-id="${row.mediaId}" aria-label="احذف التسجيل ده">✕</button>
              </div>`).join(''))}
          </div>`
          : html`<p class="field-hint">لسه مسجّلتش صوتك على ${scope} دي.</p>`)}
      </div>`;
  }

  /* ---------------------------------------------------------------- *
   * التسجيل
   * ---------------------------------------------------------------- */

  async function beginRecording() {
    /* ⚠️ ضغطتان متتاليتان لا تفتحان مسجّلين (بند ٢٠). */
    if (recorder) return;
    if (!canRecord()) return toastError('المتصفّح ده مش بيدعم التسجيل');

    dropPending();
    try {
      /*
       * ⚠️ **والإذنُ يُطلَب هنا — بعد ضغطةٍ صريحةٍ منك** (بند ٨). ولا
       *    سطرَ في الإقلاع يلمس الميكروفون؛ يحرسه اختبارٌ يمسح المصدر.
       */
      recorder = await startRecording();
    } catch (error) {
      recorder = null;
      const denied = /NotAllowed|Permission/i.test(error?.name || error?.message || '');
      const missing = /NotFound|Device/i.test(error?.name || '');
      toastError(denied ? 'مديتش إذن الميكروفون — من إعدادات المتصفّح تقدر تسمح'
        : missing ? 'مفيش ميكروفون متاح على الجهاز ده'
          : 'مقدرناش نبدأ التسجيل');
      return;
    }

    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **اللقطةُ — وهي التي تمنع إعادةَ الربط الصامتة** (بند ١١)
     * ═══════════════════════════════════════════════════════════
     * تُنسَخ الآن بقيمها، فلا تحمل مرجعًا إلى شيءٍ يتبدّل خلفها.
     */
    frozen = { ...target };
    startedAt = Date.now();
    paint();

    stopTicker();
    ticker = setInterval(() => {
      const clock = root?.querySelector('[data-vo-clock]');
      if (!clock) return;
      const s = Math.floor((Date.now() - startedAt) / 1000);
      clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
  }

  async function endRecording() {
    if (!recorder) return;
    const active = recorder;
    /* ⚠️ يُصفَّر أوّلًا فلا تُوقفه ضغطةٌ ثانيةٌ مرّتين. */
    recorder = null;
    stopTicker();

    let file = null;
    try {
      file = await active.stop();
    } catch {
      toastError('التسجيل اتقطع');
      paint();
      return;
    }

    if (!file || !file.size) {
      toastError('التسجيل طلع فاضي — جرّب تاني');
      paint();
      return;
    }

    pending = { file, url: URL.createObjectURL(file), durationMs: Date.now() - startedAt };
    paint();
  }

  async function commit() {
    if (!pending || !frozen) return;
    const result = await saveAttempt({
      file: pending.file,
      target: frozen,
      durationMs: pending.durationMs,
    });

    if (!result.ok) return toastError(result.why || 'مقدرناش نحفظ التسجيل');

    dropPending();
    /* ⚠️ ويُقرأ السجلُّ من مفتاح **اللقطة** لا من الهدف الحاليّ. */
    attempts = await listAttempts(frozen.key);
    frozen = null;
    paint();
    toastOk('اتحفظ');
  }

  /* ---------------------------------------------------------------- *
   * التشغيل — كلُّه عبر المشغّل الواحد
   * ---------------------------------------------------------------- */

  async function playMedia(mediaId) {
    const row = await media.get(mediaId);
    const url = row ? urlFor(row, { thumb: false }) : null;
    if (!url) return toastError('الملف مش موجود على الجهاز ده');
    await audio.load({ mediaId, url, title: 'صوتي', subtitle: target.text || '' });
  }

  async function playBoth() {
    await speakReference?.();
    if (attempts[0]) await playMedia(attempts[0].mediaId);
  }

  /* ---------------------------------------------------------------- *
   * اللوحة
   * ---------------------------------------------------------------- */

  await showModal({
    title: '🎙 صوتي',
    body: html`<div data-vo-body></div>`,
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    onMount(node) {
      root = node;
      paint();

      node.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-vo]');
        if (!button) return;
        const action = button.dataset.vo;
        const id = button.dataset.id;

        if (action === 'rec') return beginRecording();
        if (action === 'stop') return endRecording();
        if (action === 'again') { dropPending(); paint(); return beginRecording(); }
        if (action === 'discard') { dropPending(); frozen = null; paint(); return; }
        if (action === 'save') return commit();

        if (action === 'ref') return speakReference?.();
        if (action === 'preview') {
          if (!pending) return;
          return audio.load({ mediaId: 'vo-preview', url: pending.url, title: 'معاينة' });
        }
        if (action === 'mine') return attempts[0] && playMedia(attempts[0].mediaId);
        if (action === 'play') return playMedia(id);
        if (action === 'both') return playBoth();

        if (action === 'del') {
          /*
           * ⚠️ **يُحذَف التسجيلُ لا الدليل** (بند ١٩). `trash-service`
           *    يقول إن دليلَ الممارسة «مؤرَّخٌ لا يُحذف»، فالحذفُ يقع
           *    على `media` بسلّة التطبيق — والتراجعُ يأتي معها مجّانًا.
           */
          const gone = await deleteWithUndo({
            repo: media,
            id,
            what: 'التسجيل ده',
            detail: 'باقي تسجيلاتك على نفس الهدف مش هتتمسّ.',
            after: async () => {
              attempts = await listAttempts(target.key);
              paint();
            },
          });
          if (!gone) return;
        }
      });
    },
  });

  /* ── الإغلاق: لا شيءَ معلَّقٌ يبقى ── */
  stopTicker();
  if (recorder) {
    /*
     * ⚠️ **وإغلاقُ اللوحة أثناء التسجيل يُلغي — ولا يحفظ صامتًا** (بند ٢٧).
     *    القاعدةُ المكتوبة: مغادرةُ اللوحة إلغاءٌ صريح. فلا محاولةٌ
     *    تُنسَب إلى هدفٍ لم تُنطَق عليه، ولا بايتاتٌ تُكتَب بلا ضغطة.
     */
    try { recorder.cancel(); } catch { /* متوقّفٌ سلفًا */ }
    recorder = null;
    toast('التسجيل اتلغى');
  }
  dropPending();
  frozen = null;
}

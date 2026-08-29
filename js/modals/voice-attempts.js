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
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **WS-M — أربعُ حالاتٍ صريحة، والفعلُ الأوّلُ فوق لا تحته**
 * ═══════════════════════════════════════════════════════════════
 *
 *   IDLE → RECORDING → REVIEW → SAVED
 *
 * بلاغُ الجهاز الحقيقيّ كان: «مش عارف بدأ ولا لأ، ولا فين أوقّف».
 * وثلاثةُ أسبابٍ اجتمعت:
 *
 *   ١ · **الفعلُ كان تحت المحتوى.** الترتيبُ كان: الهدفُ ثم أزرارُ
 *       المقارنة ثم التسجيل ثم السجلّ. وعلى تابلتٍ طوليٍّ بسجلٍّ فيه
 *       تسجيلاتٌ سابقة يهبط زرُّ «سجّل» تحت حافّة الشاشة — فتفتح
 *       اللوحةَ ولا ترى الفعلَ الذي فتحتَها من أجله. فصار **أوّلَ
 *       شيءٍ تحت الهدف**، والسجلُّ والمقارنةُ تحته.
 *
 *   ٢ · **لا مؤشّرَ لمستوى الصوت.** نقطةٌ وساعةٌ تقولان «الوقتُ يمشي»
 *       ولا تقولان «الميكروفون يسمعك». والفرقُ بينهما هو بالضبط ما
 *       يجعلك تكتشف بعد دقيقةٍ أنك سجّلتَ صمتًا.
 *
 *   ٣ · **المرجعُ كان ينطق فوق صوتك.** لا شيءَ كان يُسكِت التشغيل عند
 *       بدء التسجيل، فيدخل صوتُ القراءة الآليّة في تسجيلك.
 *
 * ⚠️ **والمؤشّرُ يقرأ الميكروفونَ حقًّا** (بند ٣-ز): `AnalyserNode` على
 *    مجرى التسجيل نفسِه. ولو تعذّر بناؤه لا نرسم رسمًا متحرّكًا
 *    يتظاهر — نكتفي بالنقطة والساعة، وهما صادقتان.
 */

import { html, raw, formatDuration } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { canRecord, startRecording, urlFor } from '../services/media-service.js';
import { api as audio } from '../services/audio-service.js';
/* ⚠️ لإسكات المرجع قبل فتح الميكروفون — راجع `beginRecording` (بند ٣-ج). */
import { releaseAudio } from '../services/shadow/audio-bus.js';
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
  /** آخرُ عطبٍ يُعرَض للمستخدم — ولا يختفي وحدَه (بند ٣-و). */
  let failure = null;
  /** يظهر بعد حفظٍ ناجحٍ حتى أوّل فعلٍ بعده (بند ٣-هـ). */
  let savedNote = false;
  /** مقياسُ المستوى الحقيقيّ — أو `null` إن تعذّر. */
  let meter = null;
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

  /** «٠٠:٠٧» — دقائقُ وثوانٍ بخانتين، كما يطلب البند ٣-ب. */
  const clockOf = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  /* ---------------------------------------------------------------- *
   * مقياسُ المستوى — يقرأ الميكروفونَ حقًّا أو لا يوجد (بند ٣-ز)
   * ---------------------------------------------------------------- */

  function startMeter(stream) {
    stopMeter();
    /*
     * ⚠️ **ولا رسمَ متحرّكٌ يتظاهر.** لو غاب `AudioContext` أو رمى،
     *    نترك `meter = null` ولا نرسم شريطًا يتذبذب من تلقاء نفسه:
     *    مؤشّرٌ يكذب أسوأُ من غياب مؤشّر، لأنه يطمئنك على صمت.
     */
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx || !stream) return;
      const audioCtx = new Ctx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        /* جذرُ متوسّط المربّعات حول ١٢٨ — طاقةُ الإشارة لا لونُها. */
        let sum = 0;
        for (const v of buffer) sum += (v - 128) * (v - 128);
        const rms = Math.sqrt(sum / buffer.length) / 128;
        const bar = root?.querySelector('[data-vo-level]');
        if (bar) bar.style.inlineSize = `${Math.min(100, Math.round(rms * 320))}%`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      meter = { close: () => { cancelAnimationFrame(raf); audioCtx.close().catch(() => {}); } };
    } catch {
      meter = null;
    }
  }

  function stopMeter() {
    try { meter?.close(); } catch { /* مغلقٌ سلفًا */ }
    meter = null;
  }

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

      <!--
        ══ الفعلُ أوّلًا (بند ٣-ب و٣-ح) ══
        ⚠️ **فوق كلِّ شيءٍ آخر.** كان تحت أزرار المقارنة والسجلّ، فيهبط
           خارج الشاشة على تابلتٍ طوليٍّ بسجلٍّ طويل — فتفتح اللوحةَ
           ولا ترى الزرَّ الذي فتحتَها من أجله.
      -->
      <div class="vo-stage" data-vo-stage="${recorder ? 'recording' : pending ? 'review' : 'idle'}">
        ${raw(recorder ? html`
          <div class="vo-live" role="status" aria-live="assertive">
            <span class="vo-dot" aria-hidden="true"></span>
            <span class="vo-live-txt">جاري التسجيل</span>
            <b class="vo-clock" data-vo-clock>${clockOf(0)}</b>
          </div>
          <!--
            ⚠️ مقياسٌ حقيقيٌّ من الميكروفون — أو لا شيء. راجع startMeter.
               وهو aria-hidden لأنه معلومةٌ بصريّةٌ صرفة؛ الحالةُ منطوقةٌ
               في السطر فوقه.
          -->
          <div class="vo-meter" aria-hidden="true"><i data-vo-level></i></div>
          <button type="button" class="btn vo-stop" data-vo="stop" aria-label="وقّف التسجيل">
            ⏹ وقّف التسجيل
          </button>
          <button type="button" class="btn btn-ghost vo-cancel" data-vo="abort">إلغاء</button>`

        : pending ? html`
          <div class="vo-done" role="status">
            سجّلت <b>${formatDuration(pending.durationMs)}</b> — اسمعها قبل ما تحفظ.
          </div>
          <button type="button" class="btn vo-play-mine" data-vo="preview">▶ اسمع تسجيلي</button>
          <div class="vo-keep">
            <button type="button" class="btn vo-save" data-vo="save">حفظ</button>
            <button type="button" class="btn btn-ghost" data-vo="again">↻ سجّل من جديد</button>
          </div>
          <!--
            ⚠️ **والحذفُ بعيدٌ عن الحفظ** (بند ٣-ح): زرٌّ هدّامٌ ملاصقٌ
               لزرٍّ يُضغَط كثيرًا خسارةٌ مؤكّدةٌ بالإبهام.
          -->
          <button type="button" class="btn btn-ghost vo-discard" data-vo="discard">حذف</button>`

        : html`
          ${raw(savedNote ? html`
            <p class="vo-saved" role="status">✓ تم حفظ التسجيل</p>` : '')}
          <button type="button" class="btn vo-rec" data-vo="rec">🎙 سجّل صوتي</button>`)}

        ${raw(failure ? html`
          <div class="vo-fail" role="alert">
            <span>${failure.why}</span>
            ${raw(failure.retry ? html`
              <button type="button" class="btn btn-sm" data-vo="rec">جرّب تاني</button>` : '')}
          </div>` : '')}
      </div>

      <div class="vo-compare">
        <button type="button" class="btn btn-ghost" data-vo="ref">▶ القراءة الآلية</button>
        ${raw(attempts.length ? html`
          <button type="button" class="btn btn-ghost" data-vo="mine">▶ آخر تسجيل ليّا</button>
          <button type="button" class="btn btn-ghost" data-vo="both">▶ الاتنين ورا بعض</button>` : '')}
      </div>

      <div class="vo-history">
        <h4>تسجيلاتي — ${attempts.length}</h4>
        ${raw(attempts.length ? html`
          <div class="vo-list">
            ${raw(attempts.map((row) => html`
              <div class="vo-row" data-vo-row="${row.id}">
                <button type="button" class="btn btn-ghost btn-sm" data-vo="play" data-id="${row.mediaId}">▶</button>
                <span class="vo-when">${whenLabel(row.createdAt)}</span>
                ${raw(row.durationMs
                  ? html`<span class="vo-dur">${formatDuration(row.durationMs)}</span>` : '')}
                <button type="button" class="btn btn-ghost btn-sm vo-del" data-vo="del"
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
    failure = null;
    savedNote = false;
    if (!canRecord()) {
      failure = { why: 'المتصفّح ده مش بيدعم التسجيل الصوتي.', retry: false };
      paint();
      return;
    }

    dropPending();

    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **يُسكَت المرجعُ قبل أن يفتح الميكروفون** (بند ٣-ج)
     * ═══════════════════════════════════════════════════════════
     * لا شيءَ كان يوقف القراءةَ الآليّة عند بدء التسجيل، فكان صوتُ
     * المرجع يدخل في تسجيلك من مكبّر الجهاز نفسِه — تسمع نفسَك
     * لاحقًا ومعك صوتٌ ثانٍ لا تعرف من أين جاء.
     */
    try { releaseAudio(); } catch { /* لا مالكَ الآن */ }
    try { await audio.pause?.(); } catch { /* لا شيءَ يعمل */ }

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
      /*
       * ⚠️ **والعطبُ يبقى على الشاشة** (بند ٣-و): الـtoast يمرّ في
       *    ثوانٍ، ومَن رفع إصبعَه ونظر بعدها لا يجد شيئًا — فيظنّ أن
       *    الضغطةَ لم تصل. فيُكتَب في اللوحة ومعه بابُ إعادةٍ حين تنفع.
       */
      failure = denied
        ? { why: 'مديتش إذن الميكروفون. من إعدادات المتصفّح اسمح للموقع بالميكروفون وجرّب تاني.', retry: true }
        : missing
          ? { why: 'مفيش ميكروفون متاح على الجهاز ده.', retry: false }
          : { why: 'مقدرناش نبدأ التسجيل.', retry: true };
      paint();
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

    /* المقياسُ بعد الرسم — فالعنصرُ الذي يكتب فيه صار موجودًا. */
    startMeter(recorder.stream);

    stopTicker();
    ticker = setInterval(() => {
      const clock = root?.querySelector('[data-vo-clock]');
      if (clock) clock.textContent = clockOf(Date.now() - startedAt);
    }, 250);
  }

  /** إلغاءٌ صريحٌ أثناء التسجيل — لا بايتاتٍ ولا صفوف (بند ٣-ب). */
  function abortRecording() {
    if (!recorder) return;
    const active = recorder;
    recorder = null;
    stopTicker();
    stopMeter();
    try { active.cancel(); } catch { /* متوقّفٌ سلفًا */ }
    frozen = null;
    dropPending();
    paint();
    toast('التسجيل اتلغى');
  }

  async function endRecording() {
    if (!recorder) return;
    const active = recorder;
    /* ⚠️ يُصفَّر أوّلًا فلا تُوقفه ضغطةٌ ثانيةٌ مرّتين. */
    recorder = null;
    stopTicker();
    stopMeter();

    let file = null;
    try {
      file = await active.stop();
    } catch {
      failure = { why: 'التسجيل اتقطع قبل ما يخلص.', retry: true };
      paint();
      return;
    }

    if (!file || !file.size) {
      /*
       * ⚠️ **صفرُ بايتات ليس نجاحًا صامتًا** (بند ٣-و): يقع حين يُرفض
       *    الميكروفونُ بعد فتحه أو يُقاطعه نداء. فيُقال صراحةً ويُعرَض
       *    بابُ الإعادة — ولا يُحفَظ ملفٌّ فارغٌ باسم محاولة.
       */
      failure = { why: 'التسجيل طلع فاضي — الميكروفون مسمعش حاجة.', retry: true };
      paint();
      return;
    }

    pending = { file, url: URL.createObjectURL(file), durationMs: Date.now() - startedAt };
    paint();
  }

  async function commit() {
    if (!pending || !frozen) return;
    failure = null;

    let result = null;
    try {
      result = await saveAttempt({
        file: pending.file,
        target: frozen,
        durationMs: pending.durationMs,
      });
    } catch (error) {
      result = { ok: false, why: error?.message };
    }

    if (!result?.ok) {
      /*
       * ⚠️ **وفشلُ الحفظ لا يُسقط تسجيلك** (بند ٣-و): `pending` يبقى
       *    كما هو، فتُعاد المحاولةُ بضغطةٍ بلا أن تنطق من جديد. ولو
       *    محوناه هنا لَضاع صوتٌ سجّلتَه فعلًا بسبب عطبٍ في الكتابة.
       */
      failure = { why: result?.why || 'مقدرناش نحفظ التسجيل — تسجيلك لسه موجود، جرّب تاني.', retry: false };
      paint();
      return;
    }

    dropPending();
    /* ⚠️ ويُقرأ السجلُّ من مفتاح **اللقطة** لا من الهدف الحاليّ. */
    attempts = await listAttempts(frozen.key);
    frozen = null;
    /* ⚠️ حالةٌ مرئيّةٌ لا إشعارٌ عابر (بند ٣-هـ): «اتحفظ ولا لأ؟» سؤالٌ
     *    لا يجب أن يُطرَح أصلًا. */
    savedNote = true;
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
        if (action === 'abort') return abortRecording();
        if (action === 'again') { dropPending(); paint(); return beginRecording(); }
        if (action === 'discard') {
          dropPending();
          frozen = null;
          failure = null;
          savedNote = false;
          paint();
          return;
        }
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
  stopMeter();
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

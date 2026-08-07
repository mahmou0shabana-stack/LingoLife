/**
 * LingoLife — لوحة التحكّم الموسّعة للصوت
 *
 * ⚠️ **لا تملك عنصر صوت.** الصوت كلّه في `audio-service.js` — عنصر
 *    واحد يعيش خارج الشاشات فيستمرّ التشغيل بعد التنقّل وبعد الخروج
 *    من التطبيق. هذه اللوحة نافذة عليه: تقرأ حالته وتأمره.
 *
 * لولا ذلك لمات الصوت مع أول انتقال، لأن الشاشات تُعاد كتابتها
 * بالكامل ومعها كل ما بداخلها.
 *
 * فيها ما لا يتّسع للشريط المصغّر: السرعة والتكرار واللوب و A↔B.
 */

import { esc } from '../utils/dom.js';
import { icon } from './icons.js';
import { api, subscribe } from '../services/audio-service.js';

/** خطوات السرعة — نفس سلّم الظلّ فالتجربة واحدة عبر التطبيق. */
const RATES = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];

/** اللوحة المفتوحة حاليًا. */
let openPanel = null;

/** يغلق اللوحة. **لا يوقف الصوت** — الصوت يكمل في الشريط المصغّر. */
export function closeAudioPanel() {
  openPanel?.destroy();
  openPanel = null;
}

/** يوقف الصوت ويغلق اللوحة معًا. */
export function stopAllAudio() {
  closeAudioPanel();
  api.clear();
}

function clock(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * يبني لوحة تحكّم لمقطع.
 *
 * @param {{ mediaId: string, title?: string, onDelete?: Function, compact?: boolean }} options
 */
export function createAudioPlayer({ mediaId, title = '', onDelete = null, compact = false }) {
  closeAudioPanel();

  const root = document.createElement('div');
  root.className = `aplayer${compact ? ' compact' : ''}`;
  root.innerHTML = `
    <div class="ap-head">
      <button class="ap-play" data-ap="toggle" aria-label="تشغيل">${icon('play', 20)}</button>
      <div class="ap-title">${esc(title)}</div>
      <div class="ap-time"><b data-ap-cur>0:00</b> / <span data-ap-dur>—</span></div>
    </div>

    <div class="ap-track" data-ap="track" role="slider" tabindex="0"
         aria-label="موضع التشغيل" aria-valuemin="0" aria-valuenow="0">
      <div class="ap-loop" data-ap-loop hidden></div>
      <div class="ap-fill" data-ap-fill></div>
      <div class="ap-knob" data-ap-knob></div>
    </div>

    <div class="ap-row">
      <button class="ap-btn" data-ap="back" aria-label="خمس ثوانٍ للخلف">−5<small>s</small></button>
      <button class="ap-btn" data-ap="fwd" aria-label="خمس ثوانٍ للأمام">+5<small>s</small></button>
      <button class="ap-btn" data-ap="rate" aria-label="السرعة">1×</button>
      <button class="ap-btn" data-ap="reps" aria-label="عدد التكرار">${icon('repeat', 14)} <b>1</b></button>
      <button class="ap-btn" data-ap="loop" aria-label="لوب لا نهائي">∞</button>
      <button class="ap-btn" data-ap="ab" aria-label="لوب بين نقطتين">A↔B</button>
      <button class="ap-btn" data-ap="links" aria-label="اربط وصنّف">${icon('tag', 14)}</button>
      ${onDelete ? `<button class="ap-btn danger" data-ap="del" aria-label="حذف">${icon('trash', 14)}</button>` : ''}
    </div>

    <div class="ap-hint" data-ap-hint hidden></div>`;

  const el = (name) => root.querySelector(`[data-ap-${name}]`);
  const btn = (name) => root.querySelector(`[data-ap="${name}"]`);

  /** حالة واجهة A↔B والعدّادات — مصدر الحقيقة في الخدمة. */
  const ui = { rateIndex: RATES.indexOf(1), reps: 1, a: null, b: null };

  function hint(text) {
    const node = el('hint');
    node.textContent = text || '';
    node.hidden = !text;
  }

  /** يرسم من حالة الخدمة — لا يقرأ عنصر صوت. */
  function paint(state) {
    // اللوحة تخصّ مقطعًا بعينه؛ لو شُغِّل غيره لا نعرض تقدّمه هنا.
    const mine = state.mediaId === mediaId;

    const ratio = mine && state.duration ? state.currentTime / state.duration : 0;
    el('fill').style.width = `${ratio * 100}%`;
    el('knob').style.insetInlineStart = `${ratio * 100}%`;
    el('cur').textContent = clock(mine ? state.currentTime : 0);
    el('dur').textContent = mine && state.duration ? clock(state.duration) : '—';
    btn('track').setAttribute('aria-valuenow', Math.round(ratio * 100));

    const playing = mine && state.playing;
    btn('toggle').innerHTML = icon(playing ? 'pause' : 'play', 20);
    btn('toggle').setAttribute('aria-label', playing ? 'إيقاف' : 'تشغيل');
    root.classList.toggle('playing', playing);

    if (mine && state.reps > 1 && state.played > 0) {
      hint(`${state.played + 1} من ${state.reps}`);
    }
  }

  const unsubscribe = subscribe(paint);

  /* ---- السحب على الشريط ---- */

  const track = btn('track');
  let dragging = false;

  function seekTo(clientX) {
    const rect = track.getBoundingClientRect();
    // الصفحة RTL، فالمسافة من الحافّة اليمنى هي التقدّم.
    const rtl = getComputedStyle(track).direction === 'rtl';
    const offset = rtl ? rect.right - clientX : clientX - rect.left;
    api.seekRatio(offset / rect.width);
  }

  track.addEventListener('pointerdown', (event) => {
    dragging = true;
    track.setPointerCapture(event.pointerId);
    seekTo(event.clientX);
  });
  track.addEventListener('pointermove', (event) => { if (dragging) seekTo(event.clientX); });
  track.addEventListener('pointerup', (event) => {
    dragging = false;
    track.releasePointerCapture(event.pointerId);
  });

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') api.seek(api.state.currentTime + 5);
    else if (event.key === 'ArrowLeft') api.seek(api.state.currentTime - 5);
    else return;
    event.preventDefault();
  });

  /* ---- الأزرار ---- */

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-ap]');
    if (!target) return;

    switch (target.dataset.ap) {
      case 'toggle':
        return api.toggle();

      case 'back':
        return api.seek(api.state.currentTime - 5);

      case 'fwd':
        return api.seek(api.state.currentTime + 5);

      case 'rate': {
        ui.rateIndex = (ui.rateIndex + 1) % RATES.length;
        api.setRate(RATES[ui.rateIndex]);
        target.textContent = `${RATES[ui.rateIndex]}×`;
        return;
      }

      case 'reps': {
        // من عشرة فما فوق تكبر الخطوة، فلا تلزمك عشرون ضغطة.
        ui.reps = ui.reps >= 20 ? 1 : ui.reps + (ui.reps >= 10 ? 5 : 1);
        api.setReps(ui.reps);
        target.querySelector('b').textContent = ui.reps;
        target.classList.toggle('on', ui.reps > 1);
        return;
      }

      case 'loop': {
        const on = !api.state.loop;
        api.setLoop(on);
        target.classList.toggle('on', on);
        hint(on ? 'هيفضل يلفّ لحد ما توقفه' : '');
        return;
      }

      case 'ab': {
        // ثلاث ضغطات: تحديد A ← تحديد B ← إلغاء.
        const now = api.state.currentTime;

        if (ui.a === null) {
          ui.a = now;
          target.textContent = 'B؟';
          target.classList.add('on');
          hint(`A عند ${clock(ui.a)} — شغّل لحد نقطة B واضغط تاني`);
          return;
        }

        if (ui.b === null) {
          if (now <= ui.a + 0.3) {
            hint('لازم B تكون بعد A');
            return;
          }
          ui.b = now;
          target.textContent = 'A↔B';
          api.setRange(ui.a, ui.b);

          const duration = api.state.duration || 1;
          const band = el('loop');
          band.hidden = false;
          band.style.insetInlineStart = `${(ui.a / duration) * 100}%`;
          band.style.width = `${((ui.b - ui.a) / duration) * 100}%`;
          hint(`بيلفّ بين ${clock(ui.a)} و${clock(ui.b)}`);
          return;
        }

        ui.a = null;
        ui.b = null;
        api.setRange(null, null);
        target.textContent = 'A↔B';
        target.classList.remove('on');
        el('loop').hidden = true;
        hint('');
        return;
      }

      case 'links':
        // اللوحة نفسها لا تعرف شاشات التطبيق — نُطلق حدثًا يلتقطه app.
        root.dispatchEvent(
          new CustomEvent('audio:links', { bubbles: true, detail: { mediaId } })
        );
        return;

      case 'del':
        if (onDelete) await onDelete();
        return;

      default:
        return;
    }
  });

  const panel = {
    element: root,
    mediaId,
    destroy() {
      unsubscribe();
      root.remove();
      if (openPanel === panel) openPanel = null;
    },
  };

  openPanel = panel;
  return panel;
}

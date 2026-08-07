/**
 * LingoLife — مشغّل الصوت
 *
 * كان التشغيل سطرًا واحدًا: `new Audio(url).play()`. لا إيقاف ولا
 * تقديم ولا تكرار — تسمع الملف مرّةً وينتهي. وهذا لا يكفي للتدريب:
 * الجملة الصعبة تحتاج أن تُعاد عشرين مرة، والمقطعُ داخلها يحتاج أن
 * يُحاصَر بين نقطتين ويُلَفَّ عليه وحده.
 *
 * فيه:
 *   تشغيل/إيقاف · تقديم بالسحب · سرعة · تكرار بعدد · لوب لا نهائي
 *   لوب A↔B بين نقطتين · تخطّي ±5s · حذف بتأكيد
 *
 * مبادئ التنفيذ:
 *  · **مشغّل واحد حيّ في الصفحة.** فتح ثانٍ يوقف الأول تلقائيًا —
 *    لا صوتان معًا أبدًا.
 *  · **`requestAnimationFrame` لا `timeupdate`.** الحدث الأخير يُطلق
 *    4 مرات/ثانية فيتقطّع المؤشّر؛ الإطار يعطي حركة ناعمة ويتوقّف
 *    وحده عند الإيقاف فلا يستهلك بطارية.
 *  · **`URL.revokeObjectURL` عند التدمير** — بدونه يتسرّب الـ Blob
 *    ويظلّ محجوزًا في الذاكرة بعد إغلاق المشغّل.
 */

import { esc } from '../utils/dom.js';
import { icon } from './icons.js';

/** خطوات السرعة — نفس سلّم الظلّ فالتجربة واحدة عبر التطبيق. */
const RATES = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];

/** المشغّل الحيّ الوحيد. */
let active = null;

/** يوقف أي مشغّل شغّال — يُنادى عند مغادرة الشاشة. */
export function stopAllAudio() {
  active?.destroy();
  active = null;
}

/** ثوانٍ → m:ss */
function clock(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * يبني مشغّلًا داخل عنصر.
 *
 * @param {{
 *   url: string,
 *   title?: string,
 *   onDelete?: () => Promise<void>|void,
 *   compact?: boolean
 * }} options
 * @returns {{ element: HTMLElement, destroy: () => void }}
 */
export function createAudioPlayer({ url, title = '', onDelete = null, compact = false }) {
  stopAllAudio();

  const audio = new Audio(url);
  audio.preload = 'metadata';

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
      <button class="ap-btn" data-ap="reps" aria-label="عدد التكرار">${icon('refresh', 14)} <b>1</b></button>
      <button class="ap-btn" data-ap="loop" aria-label="لوب لا نهائي">∞</button>
      <button class="ap-btn" data-ap="ab" aria-label="لوب بين نقطتين">A↔B</button>
      ${onDelete ? `<button class="ap-btn danger" data-ap="del" aria-label="حذف">${icon('trash', 14)}</button>` : ''}
    </div>

    <div class="ap-hint" data-ap-hint hidden></div>`;

  const el = (name) => root.querySelector(`[data-ap-${name}]`);
  const btn = (name) => root.querySelector(`[data-ap="${name}"]`);

  const state = {
    rateIndex: RATES.indexOf(1),
    reps: 1,
    played: 0,
    loop: false,
    /** نقطتا A و B بالثواني، أو null. */
    a: null,
    b: null,
  };

  let frame = null;

  function paint() {
    const duration = audio.duration || 0;
    const ratio = duration ? audio.currentTime / duration : 0;
    el('fill').style.width = `${ratio * 100}%`;
    el('knob').style.insetInlineStart = `${ratio * 100}%`;
    el('cur').textContent = clock(audio.currentTime);
    root.querySelector('[data-ap="track"]').setAttribute('aria-valuenow', Math.round(ratio * 100));
  }

  function loop() {
    paint();
    // لوب A↔B: نرجع إلى A فور تجاوز B — الفحص هنا لا في `timeupdate`
    // لأن الأخير يتأخّر فيُسمع جزء من خارج المقطع.
    if (state.a !== null && state.b !== null && audio.currentTime >= state.b) {
      audio.currentTime = state.a;
    }
    frame = requestAnimationFrame(loop);
  }

  function startFrames() {
    if (!frame) frame = requestAnimationFrame(loop);
  }

  function stopFrames() {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  }

  function setPlayIcon(playing) {
    btn('toggle').innerHTML = playing ? icon('pause', 20) : icon('play', 20);
    btn('toggle').setAttribute('aria-label', playing ? 'إيقاف' : 'تشغيل');
    root.classList.toggle('playing', playing);
  }

  function hint(text) {
    const node = el('hint');
    node.textContent = text || '';
    node.hidden = !text;
  }

  /* ---- أحداث الصوت ---- */

  audio.addEventListener('loadedmetadata', () => {
    el('dur').textContent = clock(audio.duration);
    paint();
  });

  audio.addEventListener('play', () => {
    setPlayIcon(true);
    startFrames();
  });

  audio.addEventListener('pause', () => {
    setPlayIcon(false);
    stopFrames();
    paint();
  });

  audio.addEventListener('ended', () => {
    state.played++;
    // اللوب اللانهائي يسبق العدّ — «∞» تعني بلا حدّ.
    if (state.loop || state.played < state.reps) {
      audio.currentTime = state.a ?? 0;
      audio.play().catch(() => {});
      if (!state.loop) hint(`${state.played + 1} من ${state.reps}`);
      return;
    }
    state.played = 0;
    setPlayIcon(false);
    stopFrames();
    hint('');
  });

  audio.addEventListener('error', () => {
    hint('تعذّر تشغيل الملف');
    setPlayIcon(false);
  });

  /* ---- السحب على الشريط ---- */

  const track = btn('track');

  function seekTo(clientX) {
    const rect = track.getBoundingClientRect();
    // الصفحة RTL، فالمسافة من الحافّة اليمنى هي التقدّم.
    const rtl = getComputedStyle(track).direction === 'rtl';
    const offset = rtl ? rect.right - clientX : clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, offset / rect.width));
    if (audio.duration) {
      audio.currentTime = ratio * audio.duration;
      paint();
    }
  }

  let dragging = false;

  track.addEventListener('pointerdown', (event) => {
    dragging = true;
    track.setPointerCapture(event.pointerId);
    seekTo(event.clientX);
  });

  track.addEventListener('pointermove', (event) => {
    if (dragging) seekTo(event.clientX);
  });

  track.addEventListener('pointerup', (event) => {
    dragging = false;
    track.releasePointerCapture(event.pointerId);
  });

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') audio.currentTime += 5;
    else if (event.key === 'ArrowLeft') audio.currentTime -= 5;
    else return;
    event.preventDefault();
    paint();
  });

  /* ---- الأزرار ---- */

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-ap]');
    if (!target) return;

    switch (target.dataset.ap) {
      case 'toggle':
        if (audio.paused) {
          active = api;
          audio.play().catch(() => hint('تعذّر التشغيل'));
        } else {
          audio.pause();
        }
        return;

      case 'back':
        audio.currentTime = Math.max(0, audio.currentTime - 5);
        return paint();

      case 'fwd':
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
        return paint();

      case 'rate': {
        state.rateIndex = (state.rateIndex + 1) % RATES.length;
        audio.playbackRate = RATES[state.rateIndex];
        target.textContent = `${RATES[state.rateIndex]}×`;
        return;
      }

      case 'reps': {
        state.reps = state.reps >= 20 ? 1 : state.reps + (state.reps >= 10 ? 5 : 1);
        state.played = 0;
        target.querySelector('b').textContent = state.reps;
        target.classList.toggle('on', state.reps > 1);
        return;
      }

      case 'loop': {
        state.loop = !state.loop;
        target.classList.toggle('on', state.loop);
        hint(state.loop ? 'هيفضل يلفّ لحد ما توقفه' : '');
        return;
      }

      case 'ab': {
        // ثلاث ضغطات: تحديد A ← تحديد B ← إلغاء.
        if (state.a === null) {
          state.a = audio.currentTime;
          target.textContent = 'B؟';
          target.classList.add('on');
          hint(`A عند ${clock(state.a)} — شغّل لحد نقطة B واضغط تاني`);
        } else if (state.b === null) {
          const end = audio.currentTime;
          if (end <= state.a + 0.3) {
            hint('لازم B تكون بعد A');
            return;
          }
          state.b = end;
          target.textContent = 'A↔B';
          el('loop').hidden = false;
          const duration = audio.duration || 1;
          el('loop').style.insetInlineStart = `${(state.a / duration) * 100}%`;
          el('loop').style.width = `${((state.b - state.a) / duration) * 100}%`;
          audio.currentTime = state.a;
          hint(`بيلفّ بين ${clock(state.a)} و${clock(state.b)}`);
        } else {
          state.a = null;
          state.b = null;
          target.textContent = 'A↔B';
          target.classList.remove('on');
          el('loop').hidden = true;
          hint('');
        }
        return;
      }

      case 'del': {
        if (!onDelete) return;
        audio.pause();
        await onDelete();
        return;
      }

      default:
        return;
    }
  });

  const api = {
    element: root,
    destroy() {
      stopFrames();
      audio.pause();
      audio.src = '';
      // بدون هذا يظلّ الـ Blob محجوزًا في الذاكرة بعد إغلاق المشغّل.
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      root.remove();
      if (active === api) active = null;
    },
  };

  active = api;
  return api;
}

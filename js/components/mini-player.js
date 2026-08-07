/**
 * LingoLife — الشريط المصغّر
 *
 * يعيش خارج `#app-main` فلا تمسحه إعادة كتابة الشاشات. يظهر فور
 * تشغيل أي صوت ويبقى وأنت تتنقّل بين الذكريات — فتسمع تسجيلك وأنت
 * تقرأ سكريبت مشهد آخر.
 *
 * يختفي وحده حين لا يكون هناك ما يُشغَّل. لا شريط فارغ يأكل مساحة.
 */

import { api, subscribe } from '../services/audio-service.js';
import { icon } from './icons.js';
import { esc } from '../utils/dom.js';

let root = null;
let unsubscribe = null;

function clock(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function build() {
  root = document.createElement('div');
  root.className = 'mini-player';
  root.hidden = true;
  root.innerHTML = `
    <div class="mp-bar" data-mp="bar"><span data-mp-fill></span></div>
    <div class="mp-body">
      <button class="mp-play" data-mp="toggle" aria-label="تشغيل">${icon('play', 18)}</button>
      <div class="mp-info">
        <b data-mp-title></b>
        <span data-mp-sub></span>
      </div>
      <span class="mp-time" data-mp-time>0:00</span>
      <button class="mp-btn" data-mp="back" aria-label="عشر ثوانٍ للخلف">${icon('skipBack', 16)}</button>
      <button class="mp-btn" data-mp="fwd" aria-label="عشر ثوانٍ للأمام">${icon('skipForward', 16)}</button>
      <button class="mp-btn" data-mp="close" aria-label="إغلاق">✕</button>
    </div>`;

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-mp]');
    if (!target) return;

    switch (target.dataset.mp) {
      case 'toggle': return api.toggle();
      case 'back': return api.seek(api.state.currentTime - 10);
      case 'fwd': return api.seek(api.state.currentTime + 10);
      case 'close': return api.clear();
      default: return;
    }
  });

  // السحب على الشريط للتقديم — الصفحة RTL فالمسافة من اليمين هي التقدّم.
  const bar = root.querySelector('[data-mp="bar"]');
  let dragging = false;

  const seekFrom = (clientX) => {
    const rect = bar.getBoundingClientRect();
    const rtl = getComputedStyle(bar).direction === 'rtl';
    const offset = rtl ? rect.right - clientX : clientX - rect.left;
    api.seekRatio(offset / rect.width);
  };

  bar.addEventListener('pointerdown', (event) => {
    dragging = true;
    bar.setPointerCapture(event.pointerId);
    seekFrom(event.clientX);
  });
  bar.addEventListener('pointermove', (event) => { if (dragging) seekFrom(event.clientX); });
  bar.addEventListener('pointerup', (event) => {
    dragging = false;
    bar.releasePointerCapture(event.pointerId);
  });

  document.body.append(root);
  return root;
}

function paint(state) {
  if (!root) return;

  root.hidden = !state.hasTrack;
  document.body.classList.toggle('has-mini-player', state.hasTrack);
  if (!state.hasTrack) return;

  root.querySelector('[data-mp-title]').textContent = state.title;
  root.querySelector('[data-mp-sub]').textContent = state.subtitle || '';
  root.querySelector('[data-mp-time]').textContent =
    `${clock(state.currentTime)} / ${clock(state.duration)}`;

  const ratio = state.duration ? state.currentTime / state.duration : 0;
  root.querySelector('[data-mp-fill]').style.width = `${ratio * 100}%`;

  const toggle = root.querySelector('[data-mp="toggle"]');
  toggle.innerHTML = icon(state.playing ? 'pause' : 'play', 18);
  toggle.setAttribute('aria-label', state.playing ? 'إيقاف' : 'تشغيل');
  root.classList.toggle('playing', state.playing);
}

/** يركّب الشريط ويربطه بالخدمة. يُنادى مرة عند الإقلاع. */
export function mountMiniPlayer() {
  if (root) return root;
  build();
  unsubscribe = subscribe(paint);
  return root;
}

/** يفكّ الشريط — للاختبارات أساسًا. */
export function unmountMiniPlayer() {
  unsubscribe?.();
  unsubscribe = null;
  root?.remove();
  root = null;
  document.body.classList.remove('has-mini-player');
}

/** عنوان مقروء للمقطع الجاري — يستخدمه غيرُنا للعرض. */
export function nowPlayingLabel() {
  const { title, hasTrack } = api.state;
  return hasTrack ? title : '';
}

/**
 * LingoLife — خدمة التشغيل الصوتي
 *
 * عنصر `<audio>` **واحد يعيش خارج الشاشات**. الشاشات تُعاد كتابتها
 * بالكامل عند كل تنقّل، فمشغّل يملك عنصره داخلها يموت مع أول انتقال.
 * هنا العنصر مرفق بـ `document.body` مرة واحدة ويبقى.
 *
 * وبفضل ذلك يستمرّ الصوت حين تخرج من التطبيق تمامًا — تسمع تسجيلك
 * وأنت تكتب في تطبيق آخر، ويظهر التحكّم على شاشة القفل كأي مشغّل
 * موسيقى، عبر **Media Session API**.
 *
 * ⚠️ حدّ لا يمكن تجاوزه: إغلاق التطبيق نهائيًا (سحبه من مبدّل
 *    التطبيقات) يوقف الصوت. المتصفّح لا يمنح صفحة ويب عمرًا بعد
 *    إغلاقها. التصغير والتبديل والقفل — كلها تُبقيه شغّالًا.
 */

/** المستمعون على تغيّر الحالة. */
const listeners = new Set();

/** @type {HTMLAudioElement | null} */
let el = null;

/** الوسيط الجاري. */
let current = null;

/** إعدادات التكرار الحيّة. */
const options = {
  rate: 1,
  reps: 1,
  played: 0,
  loop: false,
  /** نقطتا لوب A↔B بالثواني. */
  a: null,
  b: null,
};

let frame = null;

/** ينشئ العنصر مرة واحدة. */
function element() {
  if (el) return el;

  el = document.createElement('audio');
  // `playsinline` يمنع iOS من فتح مشغّل ملء الشاشة ويُبقي الصوت لنا.
  el.setAttribute('playsinline', '');
  el.preload = 'metadata';
  el.style.display = 'none';
  document.body.append(el);

  el.addEventListener('play', () => {
    startFrames();
    setSessionState('playing');
    emit();
  });

  el.addEventListener('pause', () => {
    stopFrames();
    setSessionState('paused');
    emit();
  });

  el.addEventListener('loadedmetadata', emit);
  el.addEventListener('error', () => emit({ error: true }));

  el.addEventListener('ended', () => {
    options.played++;
    if (options.loop || options.played < options.reps) {
      el.currentTime = options.a ?? 0;
      el.play().catch(() => {});
      emit();
      return;
    }
    options.played = 0;
    stopFrames();
    emit();
  });

  return el;
}

/* ------------------------------------------------------------------ *
 * إطار التحديث
 * ------------------------------------------------------------------ */

function tick() {
  // لوب A↔B يُفحص هنا لا في `timeupdate`: الأخير يتأخّر فيُسمع جزء
  // من خارج المقطع قبل الرجوع.
  if (options.a !== null && options.b !== null && el.currentTime >= options.b) {
    el.currentTime = options.a;
  }
  emit();
  frame = requestAnimationFrame(tick);
}

function startFrames() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function stopFrames() {
  if (frame) cancelAnimationFrame(frame);
  frame = null;
}

/* ------------------------------------------------------------------ *
 * Media Session — التحكّم من شاشة القفل
 * ------------------------------------------------------------------ */

function setSessionState(state) {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
}

function publishMetadata() {
  if (!('mediaSession' in navigator) || !current) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: current.title || 'تسجيل',
    artist: current.subtitle || 'LingoLife',
    album: current.album || 'ذكرياتي اللغوية',
    artwork: current.artwork
      ? [{ src: current.artwork, sizes: '512x512', type: 'image/png' }]
      : [],
  });

  const handlers = {
    play: () => api.play(),
    pause: () => api.pause(),
    stop: () => api.stop(),
    seekbackward: (d) => api.seek(el.currentTime - (d.seekOffset || 10)),
    seekforward: (d) => api.seek(el.currentTime + (d.seekOffset || 10)),
    seekto: (d) => api.seek(d.seekTime),
  };

  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // المتصفّح لا يدعم هذا الإجراء — لا يمنع الباقي.
    }
  }
}

/* ------------------------------------------------------------------ *
 * الإشعارات
 * ------------------------------------------------------------------ */

function emit(extra = {}) {
  const snapshot = api.state;
  for (const listener of listeners) {
    try {
      listener({ ...snapshot, ...extra });
    } catch (error) {
      console.error('[audio] مستمع رمى خطأ', error);
    }
  }
}

/** يشترك في تغيّرات الحالة. يعيد دالة إلغاء. */
export function subscribe(listener) {
  listeners.add(listener);
  listener(api.state);
  return () => listeners.delete(listener);
}

/* ------------------------------------------------------------------ *
 * الواجهة
 * ------------------------------------------------------------------ */

export const api = {
  get state() {
    return {
      mediaId: current?.mediaId ?? null,
      title: current?.title ?? '',
      subtitle: current?.subtitle ?? '',
      playing: Boolean(el && !el.paused && !el.ended),
      currentTime: el?.currentTime ?? 0,
      duration: Number.isFinite(el?.duration) ? el.duration : 0,
      rate: options.rate,
      reps: options.reps,
      played: options.played,
      loop: options.loop,
      a: options.a,
      b: options.b,
      hasTrack: Boolean(current),
    };
  },

  /**
   * يحمّل مقطعًا ويشغّله.
   * @param {{ mediaId: string, url: string, title?: string, subtitle?: string, artwork?: string }} track
   */
  async load(track) {
    const audio = element();

    if (current?.mediaId === track.mediaId) {
      // نفس المقطع: نبدّل التشغيل بدل إعادة التحميل من الصفر.
      return audio.paused ? api.play() : api.pause();
    }

    // نحرّر رابط المقطع السابق حتى لا يتراكم الـ Blob في الذاكرة.
    if (current?.url?.startsWith('blob:')) URL.revokeObjectURL(current.url);

    current = track;
    options.played = 0;
    options.a = null;
    options.b = null;

    audio.src = track.url;
    audio.playbackRate = options.rate;
    publishMetadata();
    emit();

    return api.play();
  },

  async play() {
    if (!el || !current) return;
    try {
      await el.play();
    } catch {
      // المتصفّح يمنع التشغيل التلقائي قبل تفاعل المستخدم.
      emit({ blocked: true });
    }
  },

  pause() {
    el?.pause();
  },

  toggle() {
    if (!el || !current) return;
    return el.paused ? api.play() : api.pause();
  },

  stop() {
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    emit();
  },

  seek(seconds) {
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(el.duration, seconds));
    emit();
  },

  /** يقفز بنسبة من 0 إلى 1. */
  seekRatio(ratio) {
    if (!el || !Number.isFinite(el.duration)) return;
    api.seek(Math.max(0, Math.min(1, ratio)) * el.duration);
  },

  setRate(rate) {
    options.rate = rate;
    if (el) el.playbackRate = rate;
    emit();
  },

  setReps(reps) {
    options.reps = reps;
    options.played = 0;
    emit();
  },

  setLoop(on) {
    options.loop = Boolean(on);
    emit();
  },

  /** يضبط نقطتَي اللوب — تمرير null يلغيه. */
  setRange(a, b) {
    options.a = a;
    options.b = b;
    if (a !== null && el) el.currentTime = a;
    emit();
  },

  /** يفرّغ المشغّل تمامًا — يُنادى عند حذف المقطع الجاري. */
  clear() {
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    el.load();
    if (current?.url?.startsWith('blob:')) URL.revokeObjectURL(current.url);
    current = null;
    stopFrames();
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
    emit();
  },
};

/** هل التحكّم من شاشة القفل مدعوم؟ */
export function hasLockScreenControls() {
  return 'mediaSession' in navigator;
}

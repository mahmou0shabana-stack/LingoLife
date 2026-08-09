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

import { pinMedia, unpinMedia } from './media-service.js';

/** المستمعون على تغيّر الحالة. */
const listeners = new Set();

/** @type {HTMLAudioElement | null} */
let el = null;

/** الوسيط الجاري. */
let current = null;

/**
 * الطابور — المقاطع التي تُشغَّل بالتتابع.
 *
 * ⚠️ **المقطع الواحد طابورٌ من واحد.** لولا ذلك لصار في الخدمة مساران:
 *    «شغّل هذا» و«شغّل هؤلاء»، ولاختلف سلوك النهاية بينهما — فينتهي
 *    المقطع المفرد بشيءٍ وينتهي مقطع الطابور بشيءٍ آخر، ويظهر الفرق
 *    كعطبٍ لا كتصميم.
 */
let queue = { tracks: [], index: 0 };

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
    /*
     * ⚠️ التكرار **قبل** الطابور: «كرّرها ٥ مرات» تعني هذه الخمس، لا
     *    أن ينتقل بعد الأولى. والانتقال لا يحدث إلا بعد استيفاء
     *    التكرار — أو مع اللوب لا يحدث أبدًا، وهو المقصود منه.
     */
    if (options.loop || options.played < options.reps) {
      el.currentTime = options.a ?? 0;
      el.play().catch(() => {});
      emit();
      return;
    }
    options.played = 0;

    if (queue.index + 1 < queue.tracks.length) {
      playAt(queue.index + 1);
      return;
    }

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

/**
 * يشغّل عنصر الطابور رقم `index`.
 *
 * ⚠️ **لا يُحرّر رابط السابق.** الروابط يملكها `media-service`، وهذا
 *    يُعلن ما يستعمله بـ`pinMedia` ولا يُحرّر شيئًا — وإلّا عاد الكاش
 *    هناك برابطٍ ميّت. راجع `releaseUrls`.
 */
async function playAt(index) {
  const track = queue.tracks[index];
  if (!track) return;

  const audio = element();
  queue.index = index;
  current = track;
  options.played = 0;
  options.a = null;
  options.b = null;

  audio.src = track.url;
  audio.playbackRate = options.rate;
  publishMetadata();
  emit();

  return api.play();
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
    /*
     * أزرار «التالي/السابق» على شاشة القفل — تُلغى مع المقطع المفرد
     * فلا يظهر زرٌّ لا يفعل شيئًا.
     */
    nexttrack: queue.tracks.length > 1 ? () => api.next() : null,
    previoustrack: queue.tracks.length > 1 ? () => api.previous() : null,
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
      /** موضعك في الطابور — `total: 1` تعني مقطعًا مفردًا. */
      queueIndex: queue.index,
      queueTotal: queue.tracks.length,
      hasNext: queue.index + 1 < queue.tracks.length,
      hasPrevious: queue.index > 0,
    };
  },

  /**
   * يحمّل مقطعًا ويشغّله — وهو **طابورٌ من واحد**.
   * @param {{ mediaId: string, url: string, title?: string, subtitle?: string, artwork?: string }} track
   */
  async load(track) {
    if (current?.mediaId === track.mediaId && queue.tracks.length <= 1) {
      // نفس المقطع: نبدّل التشغيل بدل إعادة التحميل من الصفر.
      const audio = element();
      return audio.paused ? api.play() : api.pause();
    }
    return api.loadQueue([track], 0);
  },

  /**
   * يحمّل طابورًا ويبدأ من موضعٍ فيه.
   *
   * ⚠️ لا يُشغَّل الطابور من الصفر إن كان الجاري بداخله: تضغط «شغّل
   *    الكل» وأنت تسمع الثالث فيكمل من الثالث. إعادةُ البدء تُلغي ما
   *    سمعتَه بلا أن تطلب.
   *
   * @param {object[]} tracks
   * @param {number} startIndex
   */
  async loadQueue(tracks, startIndex = 0) {
    if (!tracks?.length) return;

    // ما كان مثبَّتًا للطابور السابق يُفكّ، والجديد يُثبَّت.
    unpinMedia(queue.tracks.map((t) => t.mediaId));
    queue = { tracks: [...tracks], index: 0 };
    pinMedia(queue.tracks.map((t) => t.mediaId));

    const resume = current
      ? queue.tracks.findIndex((t) => t.mediaId === current.mediaId)
      : -1;
    return playAt(resume >= 0 ? resume : Math.max(0, Math.min(startIndex, tracks.length - 1)));
  },

  /** التالي في الطابور — أو لا شيء إن كان الأخير. */
  async next() {
    if (queue.index + 1 >= queue.tracks.length) return;
    return playAt(queue.index + 1);
  },

  /**
   * السابق — أو **بداية الجاري** إن مضى عليه أكثر من ثلاث ثوانٍ.
   *
   * ⚠️ سلوكٌ مألوف من كل مُشغّل: «رجوع» في أوّل المقطع تعني السابق،
   *    وفي وسطه تعني «من أوّله». والقفزُ للسابق دائمًا يجعل إعادة
   *    سماع الجاري مستحيلة بزرّ واحد.
   */
  async previous() {
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return api.play();
    }
    if (queue.index === 0) return;
    return playAt(queue.index - 1);
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
    // ⚠️ فكُّ التثبيت لا التحرير: الروابط يملكها `media-service`.
    unpinMedia(queue.tracks.map((t) => t.mediaId));
    queue = { tracks: [], index: 0 };
    current = null;
    if (!el) return void emit();
    el.pause();
    el.removeAttribute('src');
    el.load();
    stopFrames();
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
    emit();
  },
};

/** هل التحكّم من شاشة القفل مدعوم؟ */
export function hasLockScreenControls() {
  return 'mediaSession' in navigator;
}

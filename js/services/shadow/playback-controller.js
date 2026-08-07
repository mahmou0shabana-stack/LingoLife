/**
 * LingoLife — محرّك تشغيل الظلّ
 *
 * قلب الميزة، منقول من `doRepeat` و`_wpDoRepeat` في التطبيق القديم.
 *
 * حُفظ من الأصل شيئان دقيقان دفع ثمنهما مَن كتبه:
 *
 *  1. **رمز الدورة (run token).** كل بدء يزيد الرمز، وكل ردّ نداء
 *     مؤجّل يتحقّق أن رمزه ما زال الحالي قبل أن يكمل. بدونه: تبدّل
 *     الجملة بسرعة فتسمع الجملتين معًا لأن دورة قديمة ما زالت حيّة.
 *
 *  2. **فاصل 60ms قبل النطق.** يمنع تراكب الصوت عند التبديل السريع —
 *     `speechSynthesis.cancel()` ليست فورية في كل المتصفحات.
 *
 * ما تغيّر: كان يقرأ ويكتب في الـ DOM مباشرةً بمتغيّرات عامّة. الآن
 * آلة حالة تُصدِر أحداثًا، فتقدر الواجهة تعرض ما تشاء والاختبار
 * يتحقّق بلا متصفّح مرئي.
 */

import { cancel as cancelSpeech, speak, DEFAULT_RATE } from './tts-controller.js';

/** فاصل يمنع تراكب الأصوات عند التبديل السريع — من التطبيق القديم. */
const ANTI_OVERLAP_MS = 60;

/** أوضاع التكرار. */
export const REPEAT_MODE = Object.freeze({
  /** يكرّر عددًا محدّدًا ثم يتوقّف. */
  COUNT: 'count',
  /** يكرّر بلا نهاية حتى توقفه. */
  CONTINUOUS: 'continuous',
});

/** أوضاع الممارسة. */
export const PRACTICE_MODE = Object.freeze({
  SENTENCE: 'sentence',
  WORD: 'word',
  /** يمرّ على كل المقاطع تباعًا بلا تكرار لكل واحد. */
  CONTINUOUS: 'continuous',
});

/**
 * يحوّل إعدادات الفاصل إلى ملّي ثانية.
 * الوحدتان من التطبيق القديم: خطوة الثانية = 500ms، خطوة الملّي = 100ms.
 */
export function intervalMs({ unit = 's', steps = 2 } = {}) {
  return unit === 's' ? steps * 500 : steps * 100;
}

/** تسمية بشرية للفاصل. */
export function intervalLabel({ unit = 's', steps = 2 } = {}) {
  return unit === 's' ? `${(steps * 0.5).toFixed(1)}s` : `${steps * 100}ms`;
}

/**
 * ينشئ محرّك تشغيل.
 *
 * @param {{
 *   segments: {id: string, text: string}[],
 *   settings: object,
 *   onEvent: (event: object) => void
 * }} config
 */
export function createPlaybackController({
  segments = [],
  settings = {},
  onEvent = () => {},
  /**
   * دالة النطق. تُحقَن لأنها الجزء الوحيد غير الحتمي هنا — فيمكن
   * اختبار آلة الحالة كاملةً بلا أصوات ولا انتظار المتصفّح.
   */
  speaker = speak,
}) {
  const state = {
    index: 0,
    repetition: 0,
    running: false,
    paused: false,
    finished: false,
  };

  let config = {
    rate: settings.speed ?? DEFAULT_RATE,
    voiceName: settings.voiceId ?? null,
    repeatCount: settings.repeatCount ?? 5,
    repeatMode: settings.repeatMode ?? REPEAT_MODE.COUNT,
    intervalUnit: settings.intervalUnit ?? 's',
    intervalSteps: settings.intervalSteps ?? 2,
    practiceMode: settings.practiceMode ?? PRACTICE_MODE.SENTENCE,
    autoAdvance: settings.autoAdvance ?? true,
  };

  /** يُلغي أي دورة قديمة. راجع الشرح أعلى الملف. */
  let runToken = 0;
  let timer = null;
  /** كلمات المقطع الحالي في وضع الكلمة. */
  let words = [];
  let wordIndex = 0;

  function emit(type, extra = {}) {
    onEvent({
      type,
      index: state.index,
      repetition: state.repetition,
      total: segments.length,
      running: state.running,
      paused: state.paused,
      wordIndex,
      ...extra,
    });
  }

  /** النصّ المنطوق حاليًا — جملة أو كلمة حسب الوضع. */
  function currentText() {
    const segment = segments[state.index];
    if (!segment) return '';
    if (config.practiceMode === PRACTICE_MODE.WORD) {
      return words[wordIndex]?.spoken || segment.text;
    }
    return segment.text;
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** يوقف كل صوت ويُبطل كل دورة معلّقة. */
  function halt() {
    runToken++;
    clearTimer();
    cancelSpeech();
  }

  /** دورة تكرار واحدة. */
  async function cycle() {
    if (!state.running || state.paused) return;

    const myToken = runToken;
    state.repetition++;
    emit('repeat', { text: currentText() });

    // الفاصل المانع للتراكب — من التطبيق القديم.
    await new Promise((resolve) => {
      timer = setTimeout(resolve, ANTI_OVERLAP_MS);
    });
    if (myToken !== runToken || !state.running || state.paused) return;

    await speaker(currentText(), { rate: config.rate, voiceName: config.voiceName });
    if (myToken !== runToken || !state.running || state.paused) return;

    const isContinuous = config.repeatMode === REPEAT_MODE.CONTINUOUS;
    const reachedTarget = !isContinuous && state.repetition >= config.repeatCount;

    if (!reachedTarget) {
      timer = setTimeout(() => {
        if (myToken === runToken) cycle();
      }, intervalMs({ unit: config.intervalUnit, steps: config.intervalSteps }));
      return;
    }

    // اكتمل هذا المقطع.
    emit('segment-complete', { repetitions: state.repetition });

    if (config.autoAdvance && state.index < segments.length - 1) {
      next();
      return;
    }

    if (state.index >= segments.length - 1) {
      state.running = false;
      state.finished = true;
      emit('session-complete');
      return;
    }

    state.running = false;
    emit('stop');
  }

  const controller = {
    get state() {
      return { ...state, settings: { ...config } };
    },

    get segments() {
      return segments;
    },

    get currentSegment() {
      return segments[state.index] || null;
    },

    get words() {
      return words;
    },

    /** يبدأ التشغيل من الموضع الحالي. */
    start() {
      if (!segments.length || state.running) return;
      halt();
      state.running = true;
      state.paused = false;
      state.finished = false;
      state.repetition = 0;
      emit('start');
      cycle();
    },

    /** يوقف مؤقتًا مع الاحتفاظ بالموضع وعدّاد التكرار. */
    pause() {
      if (!state.running || state.paused) return;
      state.paused = true;
      halt();
      emit('pause');
    },

    /** يستأنف من حيث توقّف. */
    resume() {
      if (!state.running || !state.paused) return;
      state.paused = false;
      emit('resume');
      // نُنقص العدّاد لأن `cycle` ستزيده — فلا تُحتسب التكرارة مرّتين.
      state.repetition--;
      cycle();
    },

    /** يوقف تمامًا ويصفّر عدّاد التكرار. */
    stop() {
      halt();
      state.running = false;
      state.paused = false;
      state.repetition = 0;
      emit('stop');
    },

    /** ينتقل لمقطع بالفهرس. */
    goTo(index) {
      const clamped = Math.max(0, Math.min(segments.length - 1, index));
      const wasRunning = state.running && !state.paused;
      halt();
      state.index = clamped;
      state.repetition = 0;
      wordIndex = 0;
      words = [];
      emit('seek');
      if (wasRunning) {
        state.running = true;
        cycle();
      } else {
        state.running = false;
      }
    },

    next() {
      if (state.index >= segments.length - 1) {
        halt();
        state.running = false;
        state.finished = true;
        emit('session-complete');
        return;
      }
      controller.goTo(state.index + 1);
    },

    previous() {
      controller.goTo(state.index - 1);
    },

    /** يضبط كلمات المقطع الحالي (وضع الكلمة). */
    setWords(list) {
      words = list || [];
      wordIndex = 0;
    },

    /** يختار كلمة للتدريب عليها وحدها. */
    selectWord(index) {
      const wasRunning = state.running && !state.paused;
      halt();
      wordIndex = Math.max(0, Math.min(words.length - 1, index));
      state.repetition = 0;
      emit('word-select', { word: words[wordIndex] });
      if (wasRunning) {
        state.running = true;
        cycle();
      } else {
        state.running = false;
      }
    },

    /** يعدّل الإعدادات أثناء التشغيل بلا إعادة تشغيل الجلسة. */
    updateSettings(changes) {
      config = { ...config, ...changes };
      emit('settings', { settings: { ...config } });
    },

    /** يحرّر الموارد — يُنادى عند مغادرة الشاشة. */
    destroy() {
      halt();
      state.running = false;
    },
  };

  // `next` تُستخدم داخل `cycle` قبل تعريف الكائن، فنربطها هنا.
  function next() {
    controller.next();
  }

  return controller;
}

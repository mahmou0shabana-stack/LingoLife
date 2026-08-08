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
  /**
   * تدرّب على دورك: النظام ينطق مقاطع الطرف الآخر، ويصمت عند مقاطعك
   * مهلةً تقولها فيها بصوتك، ثم يكمل.
   */
  MY_ROLE: 'myRole',
});

/** حدود الفاصل بالملّي ثانية — للإدخال الحرّ. */
export const INTERVAL_MIN_MS = 0;
export const INTERVAL_MAX_MS = 10000;

/**
 * يحوّل إعدادات الفاصل إلى ملّي ثانية.
 *
 * `intervalMsValue` هو الطريق الحرّ: أيّ رقم بالملّي ثانية تكتبه بنفسك.
 * وحين يغيب نعود لسلّم التطبيق القديم (خطوة الثانية = 500ms، خطوة
 * الملّي = 100ms) — فالجلسات المحفوظة قبل الإدخال الحرّ تعمل كما كانت.
 */
export function intervalMs({ unit = 's', steps = 2, intervalMsValue = null } = {}) {
  if (Number.isFinite(intervalMsValue)) {
    return Math.max(INTERVAL_MIN_MS, Math.min(INTERVAL_MAX_MS, Math.round(intervalMsValue)));
  }
  return unit === 's' ? steps * 500 : steps * 100;
}

/** تسمية بشرية للفاصل. */
export function intervalLabel(settings = {}) {
  const ms = intervalMs(settings);
  // تحت الثانية تُقرأ بالملّي أوضح؛ فوقها بالثواني.
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2).replace(/0$/, '')}s`;
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
    intervalMsValue: settings.intervalMsValue ?? null,
    practiceMode: settings.practiceMode ?? PRACTICE_MODE.SENTENCE,
    autoAdvance: settings.autoAdvance ?? true,
    volume: settings.volume ?? 1,
    /**
     * مصدر الصوت: `human` يعني «تسجيل بشري إن وُجد، وإلا TTS» —
     * نفس سلوك التطبيق القديم. `tts` يفرض النطق الآلي دائمًا.
     */
    audioSource: settings.audioSource ?? 'human',
  };

  /** يُلغي أي دورة قديمة. راجع الشرح أعلى الملف. */
  let runToken = 0;
  let timer = null;
  /** كلمات المقطع الحالي في وضع الكلمة. */
  let words = [];
  let wordIndex = 0;

  /**
   * المقاطع المحدَّدة للتدريب (بند 21).
   *
   * فارغةٌ تعني «كلها». وحين تُملأ يتحرّك التنقّل **داخلها وحدها**:
   * تختار سبع جملٍ من ثمانيَ عشرة فتدور عليها هي، بلا أن تفقد
   * فهارسها الأصلية — فالإبراز في صفحة المصدر يبقى على مكانه الصحيح،
   * ودليل الممارسة يُنسب إلى المقطع الحقيقي لا إلى ترتيبٍ مؤقّت.
   */
  let selection = new Set();

  /** هل هذا الفهرس داخل التحديد؟ (وكلّها داخله حين لا تحديد) */
  function inSelection(index) {
    return selection.size === 0 || selection.has(index);
  }

  /** الفهرس التالي داخل التحديد، أو -1 إن لم يبقَ شيء. */
  function nextSelected(from) {
    for (let i = from + 1; i < segments.length; i++) if (inSelection(i)) return i;
    return -1;
  }

  /** الفهرس السابق داخل التحديد، أو -1. */
  function previousSelected(from) {
    for (let i = from - 1; i >= 0; i--) if (inSelection(i)) return i;
    return -1;
  }

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

  /** هل المقطع الحالي دورُ المستخدم (فيُصمت له)؟ */
  function isMyTurn() {
    return config.practiceMode === PRACTICE_MODE.MY_ROLE && Boolean(segments[state.index]?.isMine);
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

  /** عنصر تشغيل التسجيلات البشرية — واحد يُعاد استخدامه. */
  let humanEl = null;

  /**
   * يشغّل تسجيلًا بشريًا ويعيد وعدًا ينتهي مع انتهائه.
   * لا يُرفَض أبدًا: فشل ملف واحد يجب ألّا يكسر الجلسة.
   */
  function playHuman(url, rate, volume) {
    return new Promise((resolve) => {
      if (!humanEl) {
        humanEl = new Audio();
        humanEl.setAttribute('playsinline', '');
      }
      humanEl.src = url;
      humanEl.playbackRate = Math.max(0.25, Math.min(4, rate));
      humanEl.volume = Math.max(0, Math.min(1, volume));

      const done = () => {
        humanEl.onended = null;
        humanEl.onerror = null;
        resolve({ ok: true });
      };
      humanEl.onended = done;
      humanEl.onerror = done;
      humanEl.play().catch(done);
    });
  }

  /** يوقف كل صوت ويُبطل كل دورة معلّقة. */
  function halt() {
    runToken++;
    clearTimer();
    cancelSpeech();
    if (humanEl) {
      humanEl.pause();
      humanEl.currentTime = 0;
    }
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

    if (isMyTurn()) {
      // دورك: صمت بقدر طول الجملة تقريبًا بدل نطقها لك.
      emit('your-turn', { text: currentText() });
      // ⚠️ لا تسمِّه `words` — الاسم مستعمَل لكلمات وضع الكلمة أعلاه،
      //    وتظليله هنا يفسد التقسيم عند العودة لذلك الوضع.
      const wordCount = currentText().split(/\s+/).length;
      const silence = Math.max(2000, wordCount * 700);
      await new Promise((resolve) => {
        timer = setTimeout(resolve, silence);
      });
    } else {
      // تسجيلك بصوتك أصدق من أي TTS — يُقدَّم عليه متى وُجد.
      const human =
        config.audioSource === 'human' && config.practiceMode !== PRACTICE_MODE.WORD
          ? segments[state.index]?.humanAudioUrl
          : null;

      if (human) {
        emit('source', { source: 'human' });
        await playHuman(human, config.rate, config.volume);
      } else {
        emit('source', { source: 'tts' });
        await speaker(currentText(), {
          rate: config.rate,
          voiceName: config.voiceName,
          volume: config.volume,
        });
      }
    }
    if (myToken !== runToken || !state.running || state.paused) return;

    const isContinuous = config.repeatMode === REPEAT_MODE.CONTINUOUS;
    const reachedTarget = !isContinuous && state.repetition >= config.repeatCount;

    if (!reachedTarget) {
      timer = setTimeout(() => {
        if (myToken === runToken) cycle();
      }, intervalMs(config));
      return;
    }

    /*
     * في وضع الكلمة اكتملت **كلمة** لا مقطع.
     *
     * ⚠️ هذا كان ناقصًا: كان اكتمال تكرارات الكلمة يقفز إلى المقطع
     *    التالي، فلا سبيل إلى المرور على كلمات الجملة تباعًا. «После
     *    того как документ все подпишут» ستّ كلمات — كانت تُقرأ
     *    الأولى ثم تُقفَز الجملة كلها.
     */
    if (config.practiceMode === PRACTICE_MODE.WORD && words.length) {
      emit('word-complete', { index: wordIndex, repetitions: state.repetition });

      if (wordIndex < words.length - 1) {
        if (!config.autoAdvance) {
          state.running = false;
          emit('stop');
          return;
        }
        wordIndex++;
        state.repetition = 0;
        emit('word-select', { word: words[wordIndex], index: wordIndex });
        timer = setTimeout(() => {
          if (myToken === runToken) cycle();
        }, intervalMs(config));
        return;
      }

      // آخر كلمة: المقطع اكتمل بكلماته كلها.
      emit('words-complete', { count: words.length });
    }

    // اكتمل هذا المقطع.
    emit('segment-complete', { repetitions: state.repetition });

    if (config.autoAdvance && nextSelected(state.index) !== -1) {
      next();
      return;
    }

    if (nextSelected(state.index) === -1) {
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
      // `wordIndex` و`words` خارج كائن `state` لأنهما يخصّان وضع
      // الكلمة وحده — لكنهما جزء من الموضع الذي تحتاج الواجهة قراءته،
      // فيُضمّان هنا لا في الداخل.
      return { ...state, wordIndex, wordCount: words.length, settings: { ...config } };
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
      // لا يبدأ من مقطعٍ خارج تحديدك: يقفز لأوّل محدَّد.
      if (!inSelection(state.index)) {
        const first = nextSelected(-1);
        if (first !== -1) state.index = first;
      }
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

    /**
     * التالي — **بحسب الوضع**.
     *
     * ⚠️ كان ينقل المقطع دائمًا حتى في وضع الكلمة، فيقفز الجملة كلها
     *    بينما أنت تتنقّل بين كلماتها. الوضعان يحفظان موضعيهما
     *    مستقلَّين: التنقّل بالكلمات لا يفقدك جملتك، والعودة لوضع
     *    الجملة تجدها حيث تركتها.
     */
    next() {
      if (config.practiceMode === PRACTICE_MODE.WORD && words.length) {
        if (wordIndex < words.length - 1) return controller.selectWord(wordIndex + 1);
        // آخر كلمة: ننتقل للمقطع التالي ونبدأ من كلمته الأولى.
      }

      const target = nextSelected(state.index);
      if (target === -1) {
        halt();
        state.running = false;
        state.finished = true;
        emit('session-complete');
        return;
      }
      controller.goTo(target);
    },

    previous() {
      if (config.practiceMode === PRACTICE_MODE.WORD && words.length && wordIndex > 0) {
        return controller.selectWord(wordIndex - 1);
      }
      const back = previousSelected(state.index);
      if (back !== -1) controller.goTo(back);
    },

    /**
     * يضبط كلمات المقطع الحالي (وضع الكلمة).
     *
     * ⚠️ لا يصفّر الفهرس إن كانت الكلمات نفسها. إعادة الرسم تُنادي
     *    هذه الدالة، فتصفير غير مشروط يُلغي اختيار المستخدم ويُعيد
     *    النطق إلى الكلمة الأولى دائمًا.
     */
    setWords(list) {
      const next = list || [];
      const same =
        next.length === words.length &&
        next.every((word, i) => word.spoken === words[i]?.spoken);

      words = next;
      if (!same) wordIndex = 0;
      else wordIndex = Math.min(wordIndex, Math.max(0, words.length - 1));
    },

    /**
     * يحصر التدريب في مقاطع بعينها (بند 21).
     *
     * @param {number[]|Set<number>} indices فارغةٌ = كلّها
     */
    setSelection(indices) {
      selection = new Set(indices || []);
      emit('selection', { selected: [...selection].sort((a, b) => a - b) });
    },

    get selection() {
      return [...selection].sort((a, b) => a - b);
    },

    /** هل هذا المقطع داخل التدريب الحالي؟ */
    isSelected(index) {
      return inSelection(index);
    },

    /** يختار كلمة للتدريب عليها وحدها. */
    selectWord(index) {
      const wasRunning = state.running && !state.paused;
      halt();
      wordIndex = Math.max(0, Math.min(words.length - 1, index));
      state.repetition = 0;
      emit('word-select', { word: words[wordIndex], index: wordIndex });
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
      if (humanEl) {
        humanEl.src = '';
        humanEl = null;
      }
    },
  };

  // `next` تُستخدم داخل `cycle` قبل تعريف الكائن، فنربطها هنا.
  function next() {
    controller.next();
  }

  return controller;
}

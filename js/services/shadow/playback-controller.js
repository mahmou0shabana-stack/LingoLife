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

/**
 * مصادر الصوت الثلاثة — متمايزة في التسمية عمدًا (بند 22).
 *
 * ⚠️ الاسم القديم كان `'human'`، وهو يعني **تسجيلك أنت**. الاسم كذبةٌ
 *    صغيرة تكبر: حين يدخل الناطق الأصلي يصير في التطبيق «بشريّان»
 *    أحدهما ليس بشرًا أصليًّا والآخر ليس أنت. فصار `'mine'`.
 *
 *    و`normalizeAudioSource` تقرأ القديم فتعيد الجديد — الجلسات
 *    المحفوظة تعمل كما كانت بلا ترقية بيانات ولا لمس سجل.
 */
export const AUDIO_SOURCE = Object.freeze({
  /** النطق الآلي — دائمًا متاح، ولا يُسمَّى بشريًّا أبدًا. */
  TTS: 'tts',
  /** تسجيلك أنت المربوط بهذا المصدر. كان اسمه `human`. */
  MINE: 'mine',
  /** تسجيل ناطقٍ أصلي جُلب من الخارج — للكلمات المفردة فقط. */
  NATIVE: 'native',
});

/** يقبل الاسم القديم `'human'` ويعيد `'mine'`. */
export function normalizeAudioSource(value) {
  if (value === 'human') return AUDIO_SOURCE.MINE;
  return Object.values(AUDIO_SOURCE).includes(value) ? value : AUDIO_SOURCE.MINE;
}

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
  /**
   * يحلّ نطقًا أصليًّا لنصٍّ ما، أو `null`. مَحقون كذلك: المحرّك لا
   * يعرف شبكةً ولا موافقةً — الشاشة تمرّر دالّةً تعرفهما.
   * @type {null | ((text: string) => Promise<{url?: string, speaker?: string|null, status?: string}|null>)}
   */
  nativeResolver = null,
  /**
   * يوقف أي نطقٍ جارٍ فورًا (بند 25 WS41: مزوّدو النطق المولَّد
   * يشغّلون ملفّ صوتٍ لا `speechSynthesis`، فإلغاؤهم إلغاءٌ مختلف).
   * مَحقونة كـ`speaker` بالضبط ولنفس السبب: `halt()` لا يجب أن يعرف
   * أيّ مزوّدٍ نشِط الآن.
   */
  canceler = cancelSpeech,
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
     * مصدر الصوت. `mine` يعني «تسجيلي إن وُجد، وإلا TTS» — نفس سلوك
     * التطبيق القديم تحت اسمٍ صادق. `tts` يفرض الآلي دائمًا.
     * و`native` يُدار خارج المحرّك: الشاشة تحقن الرابط في المقطع.
     */
    audioSource: normalizeAudioSource(settings.audioSource),
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

  /**
   * ═══════════════════════════════════════════════════════════════
   * نافذةُ المصدر — «التنقّل لا يعبر حدَّ مصدره» (WS-A، بندا ٢٦ و٤١)
   * ═══════════════════════════════════════════════════════════════
   *
   * `{from, to}` شاملةُ الطرفين، أو `null` = كلُّ المقاطع.
   *
   * ⚠️ **ولماذا لا نستعمل `selection` الموجودة؟** لأنها تعني شيئًا
   *    آخرَ يملكه المستخدم: «احصر التدريب في الجمل التي اخترتُها»
   *    (بند ٢١). فلو حشرنا فيها حدَّ المصدر لصار حقلٌ واحدٌ بمعنيين:
   *    دخولُك نصًّا مؤقّتًا يمحو اختيارَك، وخروجُك منه يعيده خطأً،
   *    والشاشةُ تُظهر المقطعَ المؤقّت «سطرًا مختارًا». وهو نفسُ العطب
   *    الذي وُثِّق في `relationships.type` و`ctx.fontSize`.
   *
   *    فالحدّان مستقلّان ويتقاطعان: **النافذةُ** تقول أين يعيش
   *    المصدرُ الفعّال، و**التحديدُ** يقول أيَّ جملٍ منه تتدرّب عليها.
   *
   * ⚠️ **وهذا هو الإصلاحُ البنيويّ لا شرطًا على زرّ.** «التالي» و
   *    «السابق» و`goTo` والتقدّمُ التلقائيُّ في `cycle` كلُّها تمرّ من
   *    `nextSelected`/`previousSelected`/`goTo` — فحصرُها هنا يحصر
   *    كلَّ طريقٍ إلى المقاطع دفعةً واحدة، ولا يبقى بابٌ جانبيّ.
   */
  let sourceWindow = null;

  const windowFrom = () => Math.max(0, sourceWindow?.from ?? 0);
  const windowTo = () =>
    Math.min(segments.length - 1, sourceWindow?.to ?? segments.length - 1);

  /**
   * هل النافذةُ تغطّي كلَّ المقاطع؟
   *
   * ⚠️ يفرّق بين «انتهت الجلسة» و«انتهى مصدرٌ مؤقّت». الجلسةُ ملكُ
   *    المصدر الأصليّ؛ فبلوغُ آخرِ جملةٍ في نصٍّ لصقتَه الآن **لا
   *    يُغلق جلستَك** — راجع `cycle`.
   */
  function isWholeSource() {
    return !sourceWindow || (windowFrom() === 0 && windowTo() === segments.length - 1);
  }

  /** هل هذا الفهرس داخل التحديد؟ (وكلّها داخله حين لا تحديد) */
  function inSelection(index) {
    return selection.size === 0 || selection.has(index);
  }

  /** الفهرس التالي داخل التحديد **وداخل المصدر**، أو -1 إن لم يبقَ شيء. */
  function nextSelected(from) {
    const stop = windowTo();
    for (let i = Math.max(from, windowFrom() - 1) + 1; i <= stop; i++) {
      if (inSelection(i)) return i;
    }
    return -1;
  }

  /** الفهرس السابق داخل التحديد **وداخل المصدر**، أو -1. */
  function previousSelected(from) {
    const stop = windowFrom();
    for (let i = Math.min(from, windowTo() + 1) - 1; i >= stop; i--) {
      if (inSelection(i)) return i;
    }
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
    canceler();
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
      // (وهو للجملة لا للكلمة: تسجيلك للجملة كاملة لا يُقصّ.)
      const mine =
        config.audioSource === AUDIO_SOURCE.MINE && config.practiceMode !== PRACTICE_MODE.WORD
          ? segments[state.index]?.humanAudioUrl
          : null;

      /*
       * الناطق الأصلي للكلمة المفردة وحدها: لا يوجد على تلك الخوادم
       * تسجيلٌ لجملتك. والحلّ **مَحقون** (`nativeResolver`) لا مبنيّ
       * هنا — المحرّك لا يعرف شبكةً، فيبقى اختباره حتميًّا.
       */
      let native = null;
      if (!mine && config.audioSource === AUDIO_SOURCE.NATIVE && nativeResolver) {
        native = await nativeResolver(currentText()).catch(() => null);
        if (myToken !== runToken || !state.running || state.paused) return;
      }

      if (mine) {
        emit('source', { source: AUDIO_SOURCE.MINE });
        await playHuman(mine, config.rate, config.volume);
      } else if (native?.url) {
        emit('source', { source: AUDIO_SOURCE.NATIVE, speaker: native.speaker || null });
        await playHuman(native.url, config.rate, config.volume);
      } else {
        // ⚠️ السقوط مُعلَن لا صامت: `fallbackFrom` تخبر الشاشة أن
        //    تقول «مالقيناش تسجيل — نطقناها آليًا». صوتٌ آليّ تظنّه
        //    بشريًّا أسوأ من لا شيء (بند 89).
        emit('source', {
          source: AUDIO_SOURCE.TTS,
          fallbackFrom: config.audioSource === AUDIO_SOURCE.NATIVE ? AUDIO_SOURCE.NATIVE : null,
          reason: native?.status || null,
        });
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
      /*
       * ⚠️ **وانتهاءُ مصدرٍ مؤقّت ليس انتهاءَ الجلسة.**
       *
       *    الجلسةُ ملكُ المصدر الأصليّ. فلو أطلقنا `session-complete`
       *    عند آخرِ جملةٍ في نصٍّ لصقتَه الآن لَأُغلقت جلستُك في
       *    القاعدة وفُتحت نافذةُ ملخّصٍ فوق الشاشة — عقوبةٌ على أنك
       *    شغّلتَ نصًّا مؤقّتًا حتى نهايته.
       *
       *    فالحافّةُ هنا **وقوفٌ** كوقوف «التالي» عند آخر جملة.
       */
      if (!isWholeSource()) {
        emit('stop');
        return;
      }
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
      if (!segments.length) return;
      /*
       * ⚠️ **والبدءُ من نهايةٍ يعود إلى البداية.** كان `state.running`
       *    وحدَه يمنع، فلو ضغطتَ تشغيل بعد آخر جملةٍ لم يحدث شيء:
       *    الموضعُ على الأخيرة والجلسةُ «خلصت» — فتبدأ وتنتهي فورًا.
       *    فالوصولُ إلى النهاية يجعل الضغطةَ **إعادةً** لا عدمًا.
       */
      if (state.running) return;
      if (state.finished && state.index >= segments.length - 1) {
        const first = nextSelected(-1);
        if (first !== -1) state.index = first;
      }
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
      state.finished = false;
      state.repetition = 0;
      emit('stop');
    },

    /**
     * زرُّ التشغيل الواحد — **والمحرّكُ هو مَن يقرّر لا الشاشة**.
     *
     * ⚠️ كانت الشاشة تستنتج بنفسها:
     *
     *     if (running && !paused) pause();
     *     else if (paused) resume();
     *     else start();
     *
     * وهي تقرأ حالتين وتفترض أن تركيبَهما لا يخرج عن ثلاث. وقد خرج:
     * `running=false, paused=true` بعد `goTo` — فيقع النداءُ على
     * `resume()` وتخرج فارغة. الشاشةُ لا تملك أن تعرف كلَّ حالات
     * المحرّك، فصار القرارُ حيث الحالة.
     *
     * ⚠️ **ولا حالةَ ميّتة**: كلُّ تركيبٍ ممكنٍ ينتهي إمّا بصوتٍ وإمّا
     *    بصمتٍ مقصود. لا شيءَ يُترَك بلا فعل.
     */
    toggle() {
      if (state.running && !state.paused) return controller.pause();
      if (state.running && state.paused) return controller.resume();
      /* غيرُ شغّال — بأيّ سببٍ كان: بداية، أو انتهاء، أو حالةٌ ملتبسة. */
      state.paused = false;
      state.finished = false;
      return controller.start();
    },

    /**
     * ينتقل لمقطع بالفهرس.
     *
     * ⚠️ **ويُحصَر داخل نافذة المصدر لا داخل كلّ المقاطع.** هذه هي
     *    البوّابةُ التي تمرّ منها `next` و`previous` و`goSegment`
     *    والشُّرَطُ في أعلى المسرح — فحصرُها هنا يسدّ كلَّ طريق.
     */
    goTo(index) {
      const clamped = Math.max(windowFrom(), Math.min(windowTo(), index));
      const wasRunning = state.running && !state.paused;
      halt();
      state.index = clamped;
      state.repetition = 0;
      wordIndex = 0;
      words = [];
      /*
       * ⚠️ **الوصولُ إلى جملةٍ يُنهي «مؤقّتًا» ويُنهي «خلصت».**
       *
       * كانت `paused` تبقى `true` بعد أن تصير `running` هي `false` —
       * فتصير الحالةُ «موقوفٌ مؤقّتًا وليس شغّالًا»، وهي حالةٌ لا
       * معنى لها. وزرُّ التشغيل يقرأ `paused` فينادي `resume()`،
       * و`resume()` تخرج فورًا لأن `running` كاذبة. **ضغطةٌ ميّتة.**
       *
       * وهذا بالضبط «التحكّم بيشتغل ساعات ويبوظ ساعات»: يعتمد على
       * هل أوقفتَ مؤقّتًا قبل ذلك أم لا. حالةٌ خفيّةٌ تقرّر سلوكَ زرّ.
       */
      state.paused = false;
      state.finished = false;
      emit('seek');
      state.running = wasRunning;
      if (wasRunning) cycle();
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
        /*
         * ═══════════════════════════════════════════════════════
         * ⚠️ **زرُّ «التالي» لا يُنهي جلستك.**
         * ═══════════════════════════════════════════════════════
         *
         * كان يُطلق `session-complete` — فتُغلَق الجلسةُ في القاعدة
         * وتُفتَح نافذةُ ملخّصٍ فوق الشاشة. أي أن **تصفّحك بالأزرار
         * حتى آخر جملة يُنهي عملك**.
         *
         * ⚠️ **قِستُه**: بعد ضغطاتِ «التالي» ظهرت نافذةٌ تقول «خلصت
         *    الجلسة — اتدرّبت على **٠ من ٣**»، وحجبت الشاشةَ كلَّها
         *    (`elementFromPoint` على زرّ التشغيل يعيد `DIV.overlay`).
         *    وهذا نصفُ «التحكّم بيبوظ ساعات»: الأزرارُ لم تُكسَر، بل
         *    صار فوقها غطاء.
         *
         * والاكتمالُ الصادق يقع في `cycle` وحدها: حين **يقرأ**
         * المحرّكُ آخرَ جملةٍ ولا يجد بعدها شيئًا. أمّا الوصولُ
         * بالإصبع فوقوفٌ عند الحافّة لا انتهاء.
         */
        emit('at-end');
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
     * يُلحق مقطعًا مؤقّتًا بآخر القائمة وينتقل إليه فورًا — WS40.
     *
     * ⚠️ **هذا ما يجعل النصّ الخارجيّ مقطعًا حقيقيًّا لا محرّكًا ثانيًا.**
     *    نفسُ `cycle`/`goTo`/`selectWord` تعمل عليه بلا فرقٍ عن أي
     *    مقطعِ سكريبت — لا تكرارَ منطقٍ في مكانين.
     *
     * @param {{id: string, text: string}} segment
     * @returns {number} فهرسه الجديد
     */
    pushSegment(segment) {
      segments.push(segment);
      const index = segments.length - 1;
      controller.goTo(index);
      return index;
    },

    /**
     * يحذف مقطعًا بمعرّفه — للخروج من نصٍّ خارجيّ (بند 18).
     *
     * ⚠️ **ويعود إلى الفهرس المطلوب بعد الحذف**، لا إلى صفرٍ افتراضيّ:
     *    الخروجُ من الممارسة السريعة يجب أن يُعيدك حيث كنتَ بالضبط.
     *
     * @param {string} id
     * @param {number} [returnIndex] الفهرس الذي يُنتقَل إليه بعد الحذف
     */
    dropSegment(id, returnIndex) {
      return controller.dropSegments([id], returnIndex);
    },

    /**
     * يحذف مقاطعَ مصدرٍ مؤقّتٍ كاملًا ويعيدك حيث كنت (WS-A، بند ٢٦).
     *
     * ⚠️ **والنافذةُ تُرفَع أوّلًا.** `goTo` صارت تُحصَر داخل نافذة
     *    المصدر؛ فلو حذفنا ثم انتقلنا والنافذةُ لا تزال على المدى
     *    المحذوف لَقُصَّ هدفُ الرجوع إلى حافّتها — أي لَما رجعتَ إلى
     *    جملتك الأصليّة أبدًا. رفعُ النافذة **جزءٌ من الخروج** لا
     *    ترتيبٌ اعتباطيّ.
     *
     * @param {string[]} ids
     * @param {number} [returnIndex] الفهرس الذي يُنتقَل إليه بعد الحذف
     */
    dropSegments(ids, returnIndex) {
      const kill = new Set([].concat(ids || []).filter(Boolean));
      if (!kill.size) return;

      sourceWindow = null;

      for (let i = segments.length - 1; i >= 0; i -= 1) {
        if (kill.has(segments[i].id)) segments.splice(i, 1);
      }

      const target = returnIndex == null
        ? Math.min(state.index, segments.length - 1)
        : returnIndex;
      controller.goTo(target);
    },

    /**
     * يحدّد **المصدر الفعّال**: أيُّ مدًى من المقاطع يملكه (WS-A، بند ٢٦).
     *
     * ⚠️ **وهذا ليس تحديدًا للتدريب** — راجع الشرح فوق `sourceWindow`.
     *
     * @param {{from: number, to: number}|null} win شاملةُ الطرفين، أو `null` = الكلّ
     */
    setSourceWindow(win) {
      sourceWindow = win && Number.isFinite(win.from) && Number.isFinite(win.to)
        ? { from: win.from, to: win.to }
        : null;
      /* الموضعُ الحاليُّ قد يكون خارجَها الآن — يُجَرّ إلى داخلها. */
      if (state.index < windowFrom() || state.index > windowTo()) {
        controller.goTo(state.index);
      }
      emit('source-window');
    },

    get sourceWindow() {
      return sourceWindow ? { ...sourceWindow } : null;
    },

    /**
     * حدودُ التنقّل الآن — لتقول الشاشةُ الصدقَ بدل أن تُخمّن.
     *
     * ⚠️ **تُشتقّ من نفس الدالّتين اللتين ينقل بهما الزرّان**، فلا
     *    يمكن أن يقول الزرُّ «مُعطَّل» وهو ينقل، ولا العكس.
     */
    get edges() {
      return {
        atStart: previousSelected(state.index) === -1,
        atEnd: nextSelected(state.index) === -1,
        /** عددُ مقاطع المصدر الفعّال — «١ من ١» تعني: لا جيرانَ هنا. */
        count: Math.max(0, windowTo() - windowFrom() + 1),
        position: Math.max(0, state.index - windowFrom() + 1),
        whole: isWholeSource(),
      };
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

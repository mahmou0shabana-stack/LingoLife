/**
 * LingoLife — النطق (Text-to-Speech)
 *
 * منقول من `_speakTTS` و`populateVoices` في محرّك الظلّ القديم.
 * المنطق نفسه: تفضيل صوت روسي، إلغاء ما قبله، احترام السرعة.
 *
 * ما أُضيف: `speak` تعيد وعدًا بدل `onEnd` — لأن محرّك التشغيل
 * صار غير متزامن، ووعدٌ يُنتظر أنظف من ردّ نداء متشعّب.
 *
 * ⚠️ `speechSynthesis` API متقلّبة بين المتصفحات: على iOS لا تُملأ
 *    الأصوات إلا بعد حدث `voiceschanged`، وعلى بعضها يُبتَر النطق
 *    الطويل. كل ذلك معالَج هنا في مكان واحد بدل أن يتسرّب للواجهة.
 */

/** خطوات السرعة من التطبيق القديم — مجرّبة ومريحة للأذن. */
export const RATE_STEPS = Object.freeze([0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0]);
export const RATE_MIN = 0.3;
export const RATE_MAX = 2.0;

/** السرعة الافتراضية. أبطأ من الطبيعي عمدًا — الظلّ يحتاج مهلة. */
export const DEFAULT_RATE = 0.8;

let voices = [];
let voicesReady = null;

/** هل المتصفح يدعم النطق أصلًا؟ */
export function isSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * يحمّل قائمة الأصوات.
 *
 * على iOS تعود `getVoices()` فارغةً في أول نداء ثم تُملأ لاحقًا،
 * فننتظر `voiceschanged` بمهلة قصوى حتى لا نعلّق الواجهة للأبد.
 */
export function loadVoices() {
  if (!isSupported()) return Promise.resolve([]);
  if (voicesReady) return voicesReady;

  voicesReady = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      voices = existing;
      resolve(voices);
      return;
    }

    const timer = setTimeout(() => {
      voices = window.speechSynthesis.getVoices();
      resolve(voices);
    }, 2000);

    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearTimeout(timer);
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      },
      { once: true }
    );
  });

  return voicesReady;
}

/** الأصوات مقسّمة: الروسية أولًا لأنها المقصودة. */
export async function listVoices() {
  await loadVoices();
  const russian = voices.filter((v) => v.lang.startsWith('ru'));
  const others = voices.filter((v) => !v.lang.startsWith('ru'));
  return { russian, others, all: voices };
}

/** يختار صوتًا بالاسم، أو أفضل صوت روسي متاح. */
export function resolveVoice(voiceName) {
  if (voiceName) {
    const exact = voices.find((v) => v.name === voiceName);
    if (exact) return exact;
  }
  return voices.find((v) => v.lang.startsWith('ru')) || null;
}

/**
 * نبضةُ إبقاءِ النطق حيًّا (WS51).
 *
 * ⚠️ **عيبان في `speechSynthesis` على كروم، وكلاهما يضربك أنت تحديدًا:**
 *
 *  ١ · **البترُ بعد ~١٥ ثانية.** نطقٌ طويلٌ يقف في منتصفه ولا يُطلق
 *      `onend` — فيتعلّق الوعدُ في `speak` ولا يبدأ التكرارُ التالي.
 *      وسرعتُك الافتراضيّة `0.8` تُطيل الجملَ، فالحدُّ أقربُ إليك من
 *      غيرك. والعلاجُ المعروف: `pause()` ثم `resume()` قبل الحدّ.
 *
 *  ٢ · **التعليقُ في الخلفيّة.** حين تُقفَل الشاشة قد يُعلّق المتصفّحُ
 *      المحرّكَ بدل أن يوقفه، فيصير `paused` صادقًا والنطقُ ساكنًا.
 *      و`resume()` وحدها تُعيده.
 *
 * وكان أعلى هذا الملفّ يقول إن «بعضها يُبتَر النطقُ الطويل، وكلّ ذلك
 * معالَجٌ هنا في مكانٍ واحد» — **ولم يكن مُعالَجًا.** تعليقٌ يصف نيّةً
 * لا سلوكًا، وهو أسوأُ من لا تعليق: يجعلني أمرّ عليه واثقًا.
 */
const KEEPALIVE_MS = 9000;
let keepAliveTimer = null;

/** الجملةُ المنطوقةُ الآن — لتمييز نهايتها عن نهاية ما قبلها. */
let current = null;

function stopKeepAlive() {
  clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    const synth = window.speechSynthesis;
    if (!synth.speaking) return stopKeepAlive();
    try {
      /* معلَّقٌ في الخلفيّة؟ استئنافٌ وحده يكفي — بلا نبضة. */
      if (synth.paused) synth.resume();
      else { synth.pause(); synth.resume(); }
    } catch { /* متصفّحٌ يرفض النبضة — لا نُسقط الجلسة لأجلها */ }
  }, KEEPALIVE_MS);
}

/** يوقف أي نطق جارٍ فورًا. */
export function cancel() {
  if (!isSupported()) return;
  current = null;
  stopKeepAlive();
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* بعض المتصفحات ترمي إن لم يكن هناك نطق جارٍ */
  }
}

/**
 * ينطق نصًّا ويعيد وعدًا ينتهي مع انتهاء النطق.
 *
 * الوعد **لا يُرفَض** عند خطأ النطق — يُحلّ بـ `{ ok: false }`.
 * السبب: فشل نطق جملة واحدة يجب ألّا يكسر جلسة تدريب كاملة.
 *
 * @param {string} text
 * @param {{ rate?: number, voiceName?: string, signal?: AbortSignal }} options
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export function speak(
  text,
  { rate = DEFAULT_RATE, voiceName = null, volume = 1, signal = null } = {}
) {
  if (!isSupported()) return Promise.resolve({ ok: false, reason: 'unsupported' });
  if (!text || !text.trim()) return Promise.resolve({ ok: false, reason: 'empty' });
  if (signal?.aborted) return Promise.resolve({ ok: false, reason: 'aborted' });

  return new Promise((resolve) => {
    cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.max(RATE_MIN, Math.min(RATE_MAX, rate));
    utterance.pitch = 1;
    utterance.volume = Math.max(0, Math.min(1, volume));

    const voice = resolveVoice(voiceName);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'ru-RU';
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      /*
       * ⚠️ **ولا نُطفئ النبضةَ إلّا إن كنّا نحن أصحابَها.**
       *
       * `speak` تبدأ بـ`cancel()`، وإلغاءُ النطقِ السابق يُطلق
       * `onerror: interrupted` **بعد** أن تكون الجملةُ الجديدة قد بدأت
       * نبضتَها. فلو أطفأ كلُّ منتهٍ النبضةَ بلا شرط، لأطفأ الميّتُ
       * نبضةَ الحيّ — وعاد البترُ من حيث أتى، متقطّعًا يصعب تفسيره.
       */
      if (current === utterance) { current = null; stopKeepAlive(); }
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };

    function onAbort() {
      cancel();
      finish({ ok: false, reason: 'aborted' });
    }

    utterance.onend = () => finish({ ok: true });
    utterance.onerror = (event) => {
      // 'interrupted' و'canceled' نتيجة إلغاء مقصود منّا، لا عطل.
      const reason = event?.error || 'error';
      finish({ ok: reason === 'interrupted' || reason === 'canceled', reason });
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    current = utterance;
    window.speechSynthesis.speak(utterance);
    startKeepAlive();
  });
}

/** أقرب سرعة في السلّم إلى قيمة، مع الإزاحة بخطوة. */
export function stepRate(current, direction) {
  let index = RATE_STEPS.findIndex((v) => Math.abs(v - current) < 0.05);
  if (index === -1) {
    index = RATE_STEPS.reduce(
      (best, value, i) => (Math.abs(value - current) < Math.abs(RATE_STEPS[best] - current) ? i : best),
      0
    );
  }
  const next = Math.max(0, Math.min(RATE_STEPS.length - 1, index + direction));
  return RATE_STEPS[next];
}

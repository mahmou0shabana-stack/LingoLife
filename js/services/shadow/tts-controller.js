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
 *    الأصوات إلا بعد حدث `voiceschanged`. وهذا معالَجٌ هنا في مكان
 *    واحد بدل أن يتسرّب للواجهة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⛔ **قاعدةٌ حاكمة: لا مؤقّتَ يلمس نطقًا جاريًا. أبدًا.**
 * ═══════════════════════════════════════════════════════════════
 *
 * كان أعلى هذا الملفّ سطرٌ يقول إن «بترَ النطق الطويل معالَجٌ هنا».
 * ولم يكن معالَجًا. فذهبتُ في WS51 «أُصلحه» بالحيلة المشهورة:
 * `pause()` ثم `resume()` كلَّ تسع ثوانٍ. **فصنعتُ العطبَ الذي كنتُ
 * أظنّني أمنعه**، وبصورةٍ أسوأ:
 *
 *     سرعة 0.5 → الجملة تحتاج 13000ms → **انقطعت عند 9002ms**
 *     سرعة 0.8 → الجملة تحتاج  8125ms → اكتملت (لم تبلغ العتبة)
 *     سرعة 2.0 → الجملة تحتاج  3250ms → اكتملت
 *
 * فالقطعُ يقع عند **لحظةٍ جداريّةٍ ثابتة** لا عند نسبةٍ من النصّ —
 * ولذلك كانت السرعةُ هي ما يقرّر: أسرِعْ فتنجو قبل العتبة، أبطِئْ
 * فتقع فيها. وهذا بالحرف ما أبلغتَ به.
 *
 * ⚠️ **ولماذا هو خطأٌ معماريٌّ لا خطأُ رقم؟**
 *    لأن رفعَ العتبة إلى ٣٠ ثانيةً كان سيُخفيه لا يُزيله: تبقى في
 *    الشيفرة آليّةٌ تملك أن تقطع نطقًا حيًّا، فتنتظر جملةً أطول أو
 *    سرعةً أبطأ. والعلاجُ الوحيدُ الصادق: **ألّا توجد**.
 *
 * ⚠️ **وإبقاءُ الصفحة حيّةً في الخلفية ليس شغلَ هذا الملفّ.**
 *    هو في `background-audio.js` عبر `AudioContext` — لا يمرّ على
 *    `speechSynthesis` ولا يعرف بوجوده. فإن أردتَ تعديلَ سلوكِ
 *    الخلفية فذاك مكانُه؛ **ولا يُضاف هنا مؤقّتٌ ولا نبضةٌ ولا
 *    `pause()` مهما بدا الداعي**. وهناك اختبارٌ يحرس هذا السطر.
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

/** يوقف أي نطق جارٍ فورًا. */
export function cancel() {
  if (!isSupported()) return;
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
    /*
     * ⚠️ **آخرُ سطرٍ في هذه الدالّة — ولا شيءَ بعده.**
     *    كان بعده `startKeepAlive()`، وهو الذي كان يقطع نطقَك. النطقُ
     *    يبدأ هنا وينتهي بحدثِه هو (`onend`/`onerror`) أو بإلغائك —
     *    لا بمؤقّتٍ من عندنا.
     */
    window.speechSynthesis.speak(utterance);
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

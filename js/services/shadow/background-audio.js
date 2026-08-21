/**
 * LingoLife — إبقاءُ الصفحة حيّةً والصوتُ شغّالًا والشاشةُ مقفولة (WS51)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك، ثم ملفُّك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «الصوت مشتغلش لما بقفل التابلت — والبرنامج القديم فيه الخاصية دي.»
 *
 * وكان معك حقٌّ مرّتين: الخاصيّةُ موجودةٌ عنده فعلًا، وطريقتي الأولى
 * (WS47) لم تكن طريقتَه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ما الذي يفعله ملفُّك بالضبط؟ — `AudioContext` لا أكثر
 * ═══════════════════════════════════════════════════════════════
 *
 * فتّشتُ ملفَّك عن wake lock وعن Media Session وعن صوتٍ صامتٍ يلفّ:
 * **لا شيء من ذلك فيه**. والذي فيه سطران في `§JS-1 : AUDIO ENGINE`:
 *
 * ```
 *   let _AC = null;
 *   function getAC(){ if(!_AC) _AC = new AudioContext(); return _AC; }
 *   ...
 *   function startPlay(){ … sfxGo(); … }      // ← نغمةُ البدء
 * ```
 *
 * فضغطةُ «تشغيل» تُصدر نغمةً صغيرة، والنغمةُ تفتح `AudioContext`
 * **من داخل لمسةِ إصبعك** (وهو الشرط الذي تفرضه المتصفّحات)، وذلك
 * السياقُ يبقى مفتوحًا إلى آخر الجلسة — لا يُغلق ولا يُعلَّق.
 *
 * ⚠️ **وهنا بيتُ القصيد**: كروم على أندرويد **لا يُجمّد صفحةً لها
 *    `AudioContext` في حالة `running`**. فتبقى مؤقّتاتُ `setTimeout`
 *    تلفّ بين التكرارات، ويبقى `speechSynthesis` حيًّا، ويكمل النطقُ
 *    والشاشةُ مقفولة. لم يقصد كاتبُه ذلك — النغمةُ للزينة — لكنه
 *    **أثرٌ حقيقيٌّ مقيسٌ عندك**، وهو الفرقُ الوحيد في بنية الصوت
 *    بين التطبيقين.
 *
 * ═══════════════════════════════════════════════════════════════
 * ولماذا أخفقت محاولتي الأولى؟ — سببان
 * ═══════════════════════════════════════════════════════════════
 *
 *  ١ · **صمتٌ رقميّ لا صوتٌ خافت.** كنتُ أُشغّل WAV سعتُه `1` من
 *      `32767`. وهذا صفرٌ عمليًّا، وأندرويد يصنّفه «غير مسموع» فلا
 *      يمنح الصفحةَ استثناءَ الخلفية أصلًا. صفرٌ بثوبِ رقم.
 *
 *  ٢ · **وعنصرُ `<audio>` ينازع محرّكَ النطق على بؤرة الصوت.**
 *      `speechSynthesis` على أندرويد يمرّ بمحرّك النظام لا بعنصر
 *      الوسائط، فوجودُ عنصرٍ يمسك البؤرة قد **يضرّ** لا ينفع. أي أنني
 *      لم أُخطئ الهدف فقط، بل ربما زدتُ الطين بلّة.
 *
 * ═══════════════════════════════════════════════════════════════
 * فهذه الوحدة تفعل ما يفعله ملفُّك — وتُحكِمه
 * ═══════════════════════════════════════════════════════════════
 *
 * `AudioContext` واحدٌ يُفتَح من لمسة «تشغيل»، وفيه مذبذبٌ حقيقيٌّ
 * بمكسبٍ ضئيلٍ **غيرِ صفريّ** موصولٌ بالمخرَج طوال التشغيل. ثلاثةُ
 * فروقٍ عن الأصل، كلُّها في صالحك:
 *
 *  · **مستمرٌّ لا نغمةٌ عابرة.** عنده النغمةُ تنتهي بعد جزءٍ من ثانية،
 *    ويبقى السياقُ مفتوحًا بلا إخراجٍ — وهو ما يكفي اليوم وقد لا
 *    يكفي غدًا لو شدّد كروم شرطَه إلى «إخراجٌ فعليّ». فالإشارةُ هنا
 *    قائمةٌ ما دام النطقُ قائمًا.
 *
 *  · **٣٠ هرتز تحت عتبة السمع** ومكسبٌ `0.0008` — لا تسمعها أذنُك،
 *    وليست صفرًا فيُهملها المُحسِّن.
 *
 *  · **ويُستأنَف إن عُلِّق.** أندرويد قد يُعلّق السياقَ رغم كلّ شيء؛
 *    فنُصغي لـ`statechange` ولعودةِ الرؤية ونُعيد تشغيله.
 *
 * ⚠️ **وعنصرُ `<audio>` بقي مطفأً افتراضيًّا** خلف `useElementFallback`:
 *    يُجرَّب فقط إن تعذّر `AudioContext` أصلًا، فلا ينازع أحدًا في
 *    الحالة العاديّة.
 */

/** تردّدٌ تحت عتبة السمع البشريّ عمليًّا على مكبّرات الأجهزة. */
const KEEPALIVE_HZ = 30;

/**
 * مكسبٌ ضئيلٌ **غيرُ صفريّ**: لا يُسمَع، ولا يُعدّ صمتًا.
 * ⚠️ الصفرُ هنا يُبطل الغرضَ كلَّه — راجع السببَ ١ فوق.
 */
const KEEPALIVE_GAIN = 0.0008;

/**
 * مهلةُ إغماضٍ بعد آخر إفلات — لا نُخرِس الإشارةَ لحظةَ صمتٍ عابر.
 *
 * ⚠️ **وهذه ليست زينة.** بين جملةٍ وجملةٍ يمرّ سكونٌ قصير، وبين
 *    تكرارَين كذلك. فلو أخرسنا الإشارةَ في كلّ سكون، انتُزع استثناءُ
 *    الخلفية في نفس اللحظة التي **تحتاجه فيها**: الشاشةُ مقفولةٌ،
 *    والصفحةُ صامتةٌ، فتُجمَّد — ولا مؤقّتَ يوقظها للجملة التالية.
 *    فالنافذةُ التي كنّا نموت فيها هي بالضبط ما تسدّه هذه المهلة.
 */
const LINGER_MS = 8000;

let ctx = null;
let osc = null;
let gain = null;
let holders = 0;
let wired = false;
let lingerTimer = null;

/**
 * ⚠️ **علمٌ لا يمسحه `dispose`** — عمدًا. مستمعُ `visibilitychange`
 *    يعيش على `document` لا على السياق، فلو صفّرناه مع كلّ هدمٍ
 *    لتراكم مستمعٌ جديدٌ مع كلّ دخولٍ للشاشة. والمستمعُ نفسُه لا
 *    يضرّ بعد الهدم: يقرأ `holders` فيجده صفرًا فيخرج.
 */
let documentWired = false;

/** عنصرُ الاحتياط — لا يُنشَأ إلّا إن سقط `AudioContext`. */
let el = null;
let elUrl = null;

/** هل المتصفّح يدعم Web Audio أصلًا؟ */
function audioContextCtor() {
  return typeof window !== 'undefined'
    && (window.AudioContext || window.webkitAudioContext);
}

/**
 * يُنشئ السياقَ ويُشغّل الإشارة.
 *
 * ⚠️ **يجب أن يُنادى من داخل لمسةِ المستخدم** (ضغطة «تشغيل») — وإلّا
 *    وُلد السياقُ `suspended` ولم يفعل شيئًا. وهو نفسُ شرطِ ملفّك:
 *    `sfxGo()` تقع داخل `startPlay()` التي تقع داخل الضغطة.
 */
function startSignal() {
  const Ctor = audioContextCtor();
  if (!Ctor) return false;

  try {
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    if (!osc) {
      osc = ctx.createOscillator();
      gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = KEEPALIVE_HZ;
      gain.gain.value = KEEPALIVE_GAIN;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
    } else {
      gain.gain.value = KEEPALIVE_GAIN;
    }
    wireResume();
    return true;
  } catch {
    return false;
  }
}

/**
 * يُخرِس الإشارة بلا هدمِ السياق.
 *
 * ⚠️ **ولا نُغلق `ctx` ولا نوقف المذبذب**: `OscillatorNode` لا يُعاد
 *    تشغيلُه بعد `stop()` أبدًا، و`close()` يجعل أيَّ استئنافٍ لاحقٍ
 *    يحتاج لمسةً جديدة. فالمكسبُ إلى صفرٍ يكفي — والسياقُ يبقى جاهزًا
 *    للجملة التالية بلا أن نسألك ضغطةً ثانية.
 */
function stopSignal() {
  if (gain) gain.gain.value = 0;
}

/** يستأنف السياقَ إن علّقه النظام — عند تغيّر حالته أو عودة الرؤية. */
function revive() {
  if (holders > 0 && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function wireResume() {
  if (!documentWired) {
    documentWired = true;
    document.addEventListener('visibilitychange', revive);
  }
  if (wired || !ctx) return;
  wired = true;
  try { ctx.addEventListener('statechange', revive); } catch { /* متصفّحٌ قديم */ }
}

/* ------------------------------------------------------------------ *
 * الاحتياط: عنصر <audio> — لا يُستعمل إلّا إن تعذّر Web Audio
 * ------------------------------------------------------------------ */

function buildLoopUrl() {
  const rate = 8000;
  const frames = rate / 2;
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const ascii = (at, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * 2, true);
  /* ⚠️ موجةٌ حقيقيّةٌ خافتة — لا `1` كما كانت، فتلك صمتٌ يُهمَل. */
  for (let i = 0; i < frames; i += 1) {
    view.setInt16(44 + i * 2, Math.round(Math.sin((i / rate) * 2 * Math.PI * KEEPALIVE_HZ) * 26), true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function startFallback() {
  try {
    if (!el) {
      elUrl = buildLoopUrl();
      el = new Audio(elUrl);
      el.loop = true;
      el.preload = 'auto';
    }
    if (el.paused) el.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * الواجهة
 * ------------------------------------------------------------------ */

/**
 * يمسك الخلفيّةَ حيّةً. **نادِه من لمسة المستخدم** (ضغطة التشغيل).
 * @returns {Promise<boolean>} هل نجح الإمساك؟
 */
export async function holdBackgroundAudio() {
  clearTimeout(lingerTimer);
  lingerTimer = null;
  holders += 1;
  if (startSignal()) return true;
  return startFallback();
}

/**
 * يُفلت الخلفيّة حين يتوقّف النطق — **بعد مهلة الإغماض** لا في الحال.
 * راجع `LINGER_MS` فوق: السكونُ بين جملتين ليس نهايةَ جلسة.
 */
export function releaseBackgroundAudio() {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  clearTimeout(lingerTimer);
  lingerTimer = setTimeout(() => {
    lingerTimer = null;
    if (holders > 0) return;
    stopSignal();
    el?.pause();
  }, LINGER_MS);
}

/** يهدم كلَّ شيء عند مغادرة الشاشة — فلا يبقى صوتٌ ولا سياقٌ معلَّق. */
export function disposeBackgroundAudio() {
  holders = 0;
  clearTimeout(lingerTimer);
  lingerTimer = null;
  stopSignal();
  try { osc?.stop(); } catch { /* بدأ ولم يبدأ */ }
  osc = null;
  gain = null;
  if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  wired = false;
  if (el) { el.pause(); el.removeAttribute('src'); el.load(); el = null; }
  if (elUrl) { URL.revokeObjectURL(elUrl); elUrl = null; }
}

/** للفحص: حالةُ الإمساك الآن. */
export function backgroundAudioState() {
  return {
    holders,
    contextState: ctx?.state || null,
    gain: gain?.gain.value ?? null,
    usingFallback: Boolean(el && !el.paused),
    lingering: Boolean(lingerTimer),
  };
}

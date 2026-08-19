/**
 * LingoLife — كتاب الظلّ
 *
 * وضع غامر: الشاشة كلها تصير كتابًا مفتوحًا. الصفحة اليسرى «مِمَّ
 * أتعلّم» واليمنى «كيف أجعله لي» — وجها الورقة نفسها لا شاشتان.
 *
 * كل تحكّم التطبيق القديم موجود هنا: السرعة والتكرار والتوقّف
 * ووضع العدّ/المستمر ووضع الكلمة واختيار الصوت ومستوى الصوت
 * وأوضاع العرض. راجع docs/08-shadowing.md
 */

import { html, raw, esc } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { formatDate } from '../utils/dates.js';
import { counted } from '../utils/plural.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { showModal, confirmAction } from '../components/modal.js';
import { navigate } from '../router.js';
import { splitWords, splitSentences } from '../services/shadow/segmenter.js';
import { openLightbox } from '../components/lightbox.js';
import { openShadowForScript, openShadowFromDraft } from '../services/shadow/shadow-entry.js';
import {
  SUBJECT, readDraft, openDraft, saveDraftText,
  addDraftImage, draftImages, ocrIntoDraft, draftSentences, draftedKeys, subjectKey,
} from '../services/study-draft.js';
import { toEgyptian } from '../services/shadow/dialect.js';
import {
  createPlaybackController,
  AUDIO_SOURCE,
  normalizeAudioSource,
  PRACTICE_MODE,
  REPEAT_MODE,
  intervalLabel,
  intervalMs,
  INTERVAL_MIN_MS,
  INTERVAL_MAX_MS,
} from '../services/shadow/playback-controller.js';
import { listVoices, loadVoices, RATE_MIN, RATE_MAX, speak as speakOnce } from '../services/shadow/tts-controller.js';
import { claimAudio, releaseAudio, ownsAudio } from '../services/shadow/audio-bus.js';
import {
  completeSession,
  detectSourceChange,
  loadSession,
  markDifficult,
  recordSegmentPractice,
  savePosition,
  saveSessionSettings,
  describeSource,
  SOURCE_TYPE,
} from '../services/shadow/shadow-session-service.js';
import { markSentence, loadUserDictionary } from '../services/shadow/stress.js';
import {
  loadExpressionIndex, clearExpressionIndex, expressionsIn, expressionDetail,
} from '../services/shadow/analysis-link.js';
import {
  FONTS,
  COVERAGE_NOTE,
  applyFont,
  ensureFontsLoaded,
  fontById,
  fontFullLabel,
  fontsByForm,
  measureCoverage,
} from '../services/shadow/fonts.js';
import { LANGUAGES, languageByCode, translate, translationFailure, isEnabled as trEnabled, setEnabled as setTrEnabled } from '../services/shadow/translate.js';
import { practiceStreak, recentPractice } from '../services/shadow/shadow-session-service.js';
import { scripts, contentBlocks, scenes, sceneMediaLinks, media, shadowSegments, studyDrafts } from '../db/repositories.js';
import {
  urlFor, startRecording, canRecord, addFilesToScene, AUDIO_ROLE, pickFiles,
} from '../services/media-service.js';
import { resolveLinks, LINK } from '../services/link-service.js';
import {
  SAVED_KIND, listSavedTags, addSavedTag, saveItem, listSaved, isSaved,
} from '../services/saved-service.js';
import { listConversationParts } from '../services/content-service.js';
import { savedItems, settings } from '../db/repositories.js';

/** نسبةُ الصفحة اليسرى — تُحفَظ فلا تعيد ضبطها كل جلسة. */
const SPLIT_KEY = 'shadow.split';
import { deleteWithUndo } from '../services/delete-service.js';
import {
  findNativeAudio,
  grantNativeAudio,
  revokeNativeAudio,
  nativeAudioConsent,
  isPronounceableWord,
  nativeCacheStats,
  NATIVE_HOSTS,
} from '../services/shadow/native-audio.js';

/** حالة الشاشة الحيّة. */
let player = null;
let ctx = null;
let recorder = null;
/** مستمع على `document` لأن نوافذ اللوحات تُلحَق خارج `main`. */
let modalClickHandler = null;
/** وضع التحديد ومجموعته (بند 21). */
let selecting = false;
let picked = new Set();

/**
 * طبقةُ قياس عرض الكتاب الحيّة، ومَن الصفحةُ النشِطة في وضع الصفحة
 * الواحدة — 0 الورقة، 1 التدريب. `null` تعني «لم تُقرَّر بعد هذه
 * الجلسة»، فيُختار الافتراضُ (التدريب) عند أوّل دخولٍ فعليّ (WS39).
 */
let bookRO = null;
let activePage = null;

/** أوضاع عرض النصّ. */
const DISPLAY = Object.freeze({ RU: 'ru', EGY: 'egy', HIDDEN: 'hidden' });

/**
 * حجمُ الجملة الافتراضيّ بالبكسل.
 *
 * ⚠️ رقمٌ واحدٌ في أربعة مواضع كان يُكتَب بيدي في كلٍّ منها. ولمّا
 *    نزل الافتراضُ من 41 إلى 30 كان لا بدّ أن ينزل في الأربعة معًا —
 *    وواحدٌ منها هو ما يُكتَب في القاعدة، فاختلافُه يعني حجمًا يُحفَظ
 *    غيرَ الذي يُعرَض.
 */
const DEFAULT_SIZE_PX = 30;

/** يُنادى عند مغادرة الشاشة — بدونه يظلّ الصوت شغّالًا. */
/**
 * الشريطُ العائم — الظلُّ يكمل بعد مغادرة صفحته (WS24).
 *
 * ⚠️ **بلاغُك**: «لما باخرج من الصفحة عايز الصوت يفضل شغّال ويبقى فيه
 *    شريط عايم أوقف بيه الصوت».
 *
 * وكان العكسُ مقصودًا: `disposeShadow` تقتل المحرّك عند كلّ تنقّل، حتى
 * لا يبقى صوتٌ لا تعرف من أين يأتي. والقرارُ نصفُ صحيح: **الصوتُ
 * المجهولُ مصدرُه** هو المشكلة، لا الصوتُ المستمرّ. فالحلُّ أن يبقى
 * ويقول من أين يأتي — لا أن يموت.
 *
 * ⚠️ **ولا يبقى إلّا وهو يعمل فعلًا.** جلسةٌ متوقّفةٌ تُغادرها تُغلَق
 *    كما كانت، فلا يتراكم في الذاكرة محرّكٌ صامتٌ لكلّ جلسةٍ فتحتَها.
 */
let parkedBar = null;
let parked = false;

/**
 * الشريطُ العائم — الجلسة تكمل وأنت خارجها (WS29).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ طلبُك، مؤكَّدًا مرّتين
 * ═══════════════════════════════════════════════════════════════
 *
 * > «أوّل ما أخرج من البرنامج الصوت يفضل شغّال… أو أفلت التابلت،
 * >  ويبقى فيه شريط خارجي أقفله منه أو أتنقّل للجملة اللي بعدها أو
 * >  قبلها.»
 *
 * وكان الشريطُ زرّين: «ارجع» و«◼». فإن أردتَ الجملةَ التالية وأنت
 * ماشٍ — وهذا هو الاستعمالُ الذي وُجد له الشريطُ أصلًا — لزمك أن
 * تفتح الشاشةَ كلَّها. أي أن الشريطَ يحلّ نصفَ المشكلة ويعيدك في
 * نصفها الثاني.
 *
 * فصار **مُشغّلًا كاملًا**: ‹ · تشغيل/إيقاف · › · إغلاق. وعليه اسمُ
 * الجلسة، وضغطتُه تعيدك إليها.
 *
 * ⚠️ **وزرُّ «⏸» غيرُ زرّ «✕»**: الأوّل يوقف الصوتَ ويُبقي الشريطَ
 *    والموضعَ، والثاني ينهي الجلسةَ المُبقاة. خلطُهما كان يعني أن
 *    إيقافًا مؤقّتًا يكلّفك مكانَك.
 *
 * ⚠️ **ولا يظهر الشريطُ إلّا إن كان هناك ما يُسمَع.** شريطٌ يقول
 *    «شغّال» وهو صامتٌ أسوأُ من لا شريط.
 */
function parkShadow() {
  parked = true;
  const title = ctx?.session?.title || 'جلسة ظلّ';
  const sessionId = ctx?.session?.id;
  document.body.classList.remove('shadow-open');

  parkedBar?.remove();
  const bar = document.createElement('div');
  bar.className = 'sh-floating';
  bar.innerHTML = `
    <button class="shf-nav" data-shf="prev" aria-label="الجملة اللي قبلها">‹</button>
    <button class="shf-play" data-shf="play" aria-label="وقّف">⏸</button>
    <button class="shf-nav" data-shf="next" aria-label="الجملة اللي بعدها">›</button>
    <button class="shf-open" data-shf="open" title="ارجع للجلسة">
      <i class="shf-pulse"></i><b></b>
    </button>
    <button class="shf-stop" data-shf="stop" aria-label="اقفل الجلسة">✕</button>`;
  bar.querySelector('b').textContent = title;

  bar.addEventListener('click', (event) => {
    const act = event.target.closest('[data-shf]')?.dataset.shf;
    if (act === 'stop') return stopParked();
    if (act === 'open' && sessionId) return navigate(`/shadow/${sessionId}`);
    if (!player) return undefined;

    if (act === 'play') player.toggle();
    if (act === 'prev') player.previous();
    if (act === 'next') player.next();

    /*
     * ⚠️ **والجلسةُ المُبقاة تُحفَظ موضعُها أيضًا.** كانت أحداثُ
     *    المحرّك تُهمَل وأنت خارج الشاشة (حارسُ `parked`)، فتتنقّل
     *    عشرَ جملٍ وأنت ماشٍ ثم تعود فتجد نفسك حيث تركتَ. الموضعُ
     *    عملُك، ولا يجوز أن يضيع لأنك لم تكن تنظر.
     */
    if (sessionId) savePosition(sessionId, player.state.index).catch(() => {});
    paintFloating();
    return undefined;
  });

  document.body.append(bar);
  parkedBar = bar;
  paintFloating();
}

/** يُبقي شكلَ الشريط العائم مطابقًا لما يحدث فعلًا. */
function paintFloating() {
  if (!parkedBar) return;
  const on = Boolean(player?.state?.running && !player.state.paused);
  const btn = parkedBar.querySelector('[data-shf="play"]');
  if (btn) {
    btn.textContent = on ? '⏸' : '▶';
    btn.setAttribute('aria-label', on ? 'وقّف' : 'كمّل');
  }
  parkedBar.classList.toggle('is-quiet', !on);
}

/**
 * حبلُ مستمعي هذه الشاشة — يُقطَع عند المغادرة فيسقط كلُّ ما عُلِّق به.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وهذا هو أصلُ «التشغيل بيشتغل مرّة ويبوظ مرّة»**
 * ═══════════════════════════════════════════════════════════════
 *
 * `wireInteractions(main)` تعلّق `click` على `#app-main` — وهو عنصرٌ
 * **يعيش عبر الشاشات كلِّها**: يُستبدَل محتواه ولا يُستبدَل هو. وكانت
 * تُنادى في كلّ دخولٍ للظلّ بلا نزعٍ لما قبلها، فتتراكم:
 *
 *     أوّل فتحة  → مستمعٌ واحد   → لمسةٌ = فعلٌ واحد     ✔ يشتغل
 *     تغيّر الصورة → مستمعان     → لمسةٌ = تشغيلٌ ثم إيقاف ✘ صامت
 *     والثالثة   → ثلاثة        → تشغيل، إيقاف، تشغيل   ✔ يشتغل
 *
 * ⚠️ **قِستُه**: بعد الانتقال إلى جلسةٍ أخرى، لمسةٌ واحدة على زرّ
 *    التشغيل تُنتج تتابعَ الحالة `["بيشتغل", "متوقّف"]` ونطقًا `[]`.
 *    والنداءُ البرمجيُّ `.click()` يُنتج تغييرًا واحدًا. فليست اللمسةُ
 *    مضاعَفة — بل **المستمعون** هم المضاعَفون.
 *
 * ⚠️ **ولماذا لم تمسكه فحوصي؟** لأن كلَّ واحدٍ منها يبدأ بـ`reload`
 *    — مستندٌ جديدٌ ومستمعٌ واحد. **انضباطي في «ابدأ من حالةٍ نضيفة»
 *    هو نفسُه ما أخفى العطل**: العيبُ لا يظهر إلّا في الاستعمال
 *    المتّصل، وهو ما يفعله المستعمِلُ ولا يفعله اختباري.
 *
 * والعلاج `AbortSignal` واحد: كلُّ `addEventListener` في هذه الشاشة
 * يأخذه، و`disposeShadow` تقطعه. فلا يُنسى نزعُ مستمعٍ يُضاف غدًا —
 * إن نسي كاتبُه الإشارةَ أسقطه اختبار.
 */
let wires = null;

/** يفتح حبلًا جديدًا بعد قطع القديم. */
function freshWires() {
  wires?.abort();
  wires = new AbortController();
  return wires.signal;
}

/** الخيارُ الذي يأخذه كلُّ مستمعٍ في هذه الشاشة. */
function wired(extra = {}) {
  return { ...extra, signal: wires?.signal };
}

/** يوقف الجلسة المُبقاة ويرفع شريطها. */
function stopParked() {
  parked = false;
  player?.destroy();
  player = null;
  parkedBar?.remove();
  parkedBar = null;
  releaseAudio('session');
}

export function disposeShadow() {
  /*
   * ⚠️ **والتسجيلُ يقف مع مغادرة الشاشة — دائمًا.** وهو خارج شرط
   *    «الجلسة تُبقى شغّالة»: ما يُبقى هو **نطقُ التدريب** لأن له
   *    شريطًا عائمًا فيه أزرارُه؛ أمّا تسجيلٌ ضغطتَه من ورقة الذكرى
   *    فيصير — إن بقي — صوتًا يخرج من شاشةٍ غادرتَها بلا مقبض.
   *
   * ⚠️ ولا يُسكِت الجلسةَ: `releaseAudio` بمُعطًى تُسكِت **إن كان
   *    هو المالك** وحده. فلو كان المالكُ الجلسةَ لم يُمَسّ شيء.
   */
  /*
   * ⚠️ **والتسجيلُ يكمل مع المغادرة — بعد أن صار له شريط** (WS35).
   *
   * كان يُسكَت هنا دائمًا، وعلّلتُه بأن «تسجيلًا ضغطتَه من ورقة الذكرى
   * يصير — إن بقي — صوتًا يخرج من شاشةٍ غادرتَها بلا مقبض». والعلّةُ
   * كانت في **غياب المقبض** لا في بقاء الصوت؛ وقد صار له مقبض.
   */
  paintVoiceBar({ leaving: true });

  /*
   * ⚠️ يُقرأ **قبل** أي تدمير: `running && !paused` تعني أن المحرّك
   *    ينطق الآن. وبعد `destroy()` تصير الحالةُ بلا معنى.
   */
  const speaking = Boolean(player?.state?.running && !player.state.paused);
  if (speaking && ctx?.session?.id) {
    const keep = player;
    parkShadow();
    player = keep;
    /*
     * ⚠️ **والحبلُ يُقطَع هنا أيضًا — وكان لا يُقطَع.**
     *
     * الفرعُ يعود مبكّرًا ليُبقي الصوتَ شغّالًا، فكان يقفز فوق قطع
     * الحبل في آخر الدالّة. فيبقى مستمعو كتابِ الظلّ معلّقين على
     * `#app-main` **وأنت في شاشةٍ أخرى**: ضغطةٌ هناك تمرّ على موزّعٍ
     * يقرأ `ctx` وقد صار `null`.
     *
     * ⚠️ ولا يمسّ ذلك الشريطَ العائم: مستمعُه على الشريط نفسِه بلا
     *    إشارةِ قطع — لأنه ليس من مستمعي الشاشة، بل ما يبقى بعدها.
     */
    wires?.abort();
    wires = null;
    ctx = null;
    recorder?.cancel?.();
    recorder = null;
    clearExpressionIndex();
    /* ⚠️ `.sh-book` تُهدَم مع الشاشة — رقيبٌ عليها بعدها تسرّبٌ لا قياس. */
    bookRO?.disconnect();
    bookRO = null;
    return;
  }

  parkedBar?.remove();
  parkedBar = null;
  player?.destroy();
  player = null;
  /* ⚠️ جلسةٌ مغادَرةٌ تمامًا (لا شيء يُبقيه شغّالًا) لا تترك أثرًا على شاشة القفل. */
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
  closeFontPop();
  selecting = false;
  picked = new Set();
  /* ⚠️ علاماتُ جلسةٍ لا تُورَّث لجلسةٍ بعدها. */
  drafted = new Set();
  nativeMissSaid.clear();
  ctx = null;
  recorder?.cancel?.();
  recorder = null;
  clearExpressionIndex();
  /* ⚠️ `.sh-book` تُهدَم مع الشاشة — رقيبٌ عليها بعدها تسرّبٌ لا قياس. */
  bookRO?.disconnect();
  bookRO = null;
  /* ⚠️ صفحةٌ فُضِّلت في جلسةٍ لا تُفرَض على التالية (بند 6: الافتراضُ التدريب). */
  activePage = null;
  /*
   * ⚠️ **قطعُ الحبل قبل أيّ شيء آخر**: مستمعٌ باقٍ على `#app-main`
   *    يعمل على شاشةٍ لم تعد له.
   */
  wires?.abort();
  wires = null;

  if (modalClickHandler) {
    document.removeEventListener('click', modalClickHandler);
    modalClickHandler = null;
  }
  document.body.classList.remove('shadow-open');
}

/* ------------------------------------------------------------------ *
 * قراءة المصدر
 * ------------------------------------------------------------------ */

async function readCurrentSource(session) {
  if (session.sourceType === 'script') {
    const script = await scripts.get(session.sourceId);
    return script ? { text: script.text || '', version: script.rev ?? null } : null;
  }
  if (session.sourceType === 'contentBlock') {
    const block = await contentBlocks.get(session.sourceId);
    return block ? { text: block.text || '', version: block.rev ?? null } : null;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * النطق الأصلي — بند 22
 * ------------------------------------------------------------------ */

/** التسمية الصادقة: ثلاثة مصادر متمايزة، ولا يُسمَّى المُصنَّع بشريًّا. */
/** اسمٌ قصيرٌ يسع زرَّ لوحةٍ عرضُه 260px. */
const AUDIO_SHORT = Object.freeze({
  [AUDIO_SOURCE.TTS]: 'آليّ',
  [AUDIO_SOURCE.MINE]: 'تسجيلي',
  [AUDIO_SOURCE.NATIVE]: 'أصليّ',
});

const AUDIO_LABEL = Object.freeze({
  [AUDIO_SOURCE.TTS]: '🤖 آلي (TTS)',
  [AUDIO_SOURCE.MINE]: '🎙 تسجيلي',
  [AUDIO_SOURCE.NATIVE]: '🌍 ناطق أصلي',
});

/**
 * ما الذي يمكن اختياره في **هذه** الجلسة؟
 *
 * «تسجيلي» لا يُعرَض بلا تسجيلٍ مربوط — زرٌّ يبدو أنه يعمل وهو لا
 * يعمل ممنوع (بند 89). والآلي دائمًا موجود لأنه دائمًا يعمل.
 */
function audioChoices(hasMine = Boolean(ctx?.humanAudioUrl)) {
  const list = [AUDIO_SOURCE.TTS];
  if (hasMine) list.push(AUDIO_SOURCE.MINE);
  list.push(AUDIO_SOURCE.NATIVE);
  return list;
}

/**
 * المصدر **المتاح فعلًا** في هذه الجلسة.
 *
 * ⚠️ الافتراضي المحفوظ `mine` (ورثناه من `human` القديم)، وجلسةٌ بلا
 *    تسجيل مربوط كانت تعرض «🎙 تسجيلي» وهي تنطق آليًّا — زرٌّ يقول
 *    غير ما يفعل (بند 89). المحرّك كان يسقط إلى TTS صحيحًا؛ الكذبة
 *    كانت في التسمية وحدها، وهي أسوأ ما يكون: تصدّقها.
 */
export function effectiveAudioSource(saved, hasMine) {
  const wanted = normalizeAudioSource(saved);
  return audioChoices(hasMine).includes(wanted) ? wanted : AUDIO_SOURCE.TTS;
}

/**
 * يُمرَّر للمحرّك فيحلّ نطقًا أصليًّا — أو `null` فيسقط إلى TTS.
 *
 * الشبكة والموافقة هنا لا في المحرّك: يبقى المحرّك حتميًّا وقابلًا
 * للاختبار بلا خادم.
 */
async function resolveNative(text) {
  const word = (text || '').trim();
  if (!isPronounceableWord(word)) return { status: 'not-a-word' };
  const result = await findNativeAudio(word);
  return result.status === 'ok' ? result : { status: result.status };
}

/**
 * نصّ الموافقة. يسمّي الخوادم بأسمائها ويقول بالضبط ما الذي يخرج —
 * موافقةٌ لا تعرف على ماذا توافق ليست موافقة.
 */
/**
 * يقول سبب السقوط إلى TTS — مرّةً لكل سبب لا مع كل تكرار.
 *
 * التكرار خمس مرّات لنفس الكلمة يعني خمسة أحداث `source`؛ توستٌ في كل
 * مرّة يجعل الرسالة الصادقة إزعاجًا فتُتجاهَل، وهو نقيض الغرض.
 */
const nativeMissSaid = new Set();
function announceNativeMiss(reason) {
  const key = reason || 'unknown';
  if (nativeMissSaid.has(key)) return;
  nativeMissSaid.add(key);

  const said = {
    'not-a-word': 'الناطق الأصلي للكلمات المفردة بس — الجملة بتتنطق آليًا',
    'not-found': 'مالقيناش تسجيل لناطق أصلي للكلمة دي — نطقناها آليًا',
    offline: 'مفيش إنترنت دلوقتي — نطقناها آليًا',
    // «ما استطعنا السؤال» غير «سألنا فقالوا لا»، والفرق يهمّك: الأولى
    // تُصلَح بشبكةٍ أفضل، والثانية لا.
    unreachable: 'مقدرناش نوصل لخوادم النطق — نطقناها آليًا',
    disabled: 'الناطق الأصلي مقفول — نطقناها آليًا',
  }[key];
  if (said) toast(said);
}

async function askNativeConsent() {
  const ok = await confirmAction({
    title: '🌍 النطق الأصلي',
    message:
      'دي <strong>الميزة الوحيدة في التطبيق اللي بتخرج من جهازك</strong>.<br><br>' +
      'لمّا تشغّلها، <strong>الكلمة الروسية اللي بتتدرّب عليها</strong> هتتبعت ' +
      `لخوادم خارجية (${NATIVE_HOSTS.join(' · ')}) عشان ندوّر على تسجيل ` +
      'لناطق أصلي.<br><br>' +
      '• الكلمة بس هي اللي بتخرج — مش جملتك ولا ذكرياتك ولا أي حاجة تخصّك.<br>' +
      '• اللي بنلاقيه بيتحفظ على جهازك، فالكلمة ما بتخرجش تاني.<br>' +
      '• للكلمات المفردة بس — مفيش تسجيل لجملتك على الخوادم دي.<br>' +
      '• تقدر ترجع في أي وقت، والرجوع بيمسح كل اللي اتجاب.',
    confirmLabel: 'موافق، شغّلها',
  });
  if (!ok) return false;
  ctx.nativeConsent = await grantNativeAudio();
  return true;
}

/**
 * من أين جاءت هذه الجلسة؟ (بند 13)
 *
 * كانت الصفحة اليسرى تقول «المشهد والنصّ الأصلي» — وهي جملةٌ صادقة
 * ولا تفيد: لا تعرف أهذا سكريبتٌ كامل أم دور متحدّثٍ في محادثة أم
 * جملٌ اخترتها بنفسك أم نصٌّ استُخرج من صورة. وثلاثتها الأولى تختلف
 * اختلافًا يغيّر ما تتوقّعه من الجلسة.
 *
 * فصار المصدر مُسمًّى باسمه، **وقابلًا للفتح**: التدريب طبقةٌ فوق
 * المحتوى لا بديلٌ عنه، فطريق العودة إلى الأصل يجب أن يبقى ظاهرًا.
 *
 * @returns {Promise<{icon: string, kind: string, name: string,
 *                    note: string, href: string|null}>}
 */
async function resolveSource(session, segments) {
  // القراءة هنا، والتصنيف في الخدمة — فيبقى منطق الوصف مُختبَرًا
  // بلا تهيئة مستودعات (`describeSource`).
  let resolved = {};
  /**
   * **الأصل كما هو** — لا كما قسّمناه (بند 13).
   *
   * ⚠️ المقاطع مشتقّة، والأصل هو النصّ. حين يقسّم المُقسِّم في موضعٍ
   *    غريب، أو تسأل «هو كان بيقول إيه بالظبط قبل الجملة دي؟»، فليس
   *    في الصفحة ما يجيب. الصورة لها لوحتها منذ البداية، والسكريبت
   *    والمحادثة لم يكن لهما شيء.
   */
  let origin = null;
  /** طريقُ العودة إلى ما جئتَ منه — إن كان غيرَ الذكرى. */
  let backTo = null;

  try {
    if (session.sourceType === SOURCE_TYPE.SCRIPT || session.sourceType === SOURCE_TYPE.SELECTION) {
      const script = await scripts.get(session.sourceId);
      resolved = script ? { title: script.title } : { missing: true };
      if (script?.text) {
        const all = splitSentences(script.text);
        const inSession = new Set(segments.map((s) => (s.sourceTextSnapshot || '').trim()));
        origin = {
          kind: 'text',
          text: script.text,
          // في المختارات: نُعلِّم ما تتدرّب عليه وما تركته، فترى الاختيار
          // في سياقه بدل أن ترى قائمةً بلا أصل.
          sentences: all.map((text) => ({ text, picked: inSession.has(text.trim()) })),
          total: all.length,
        };
      }
    } else if (session.sourceType === SOURCE_TYPE.CONVERSATION) {
      const parts = session.sceneId ? await listConversationParts(session.sceneId) : [];
      // ⚠️ المحادثة تُعرَض **كمحادثة**: أدوارٌ بأصحابها بترتيبها. قائمةٌ
      //    مسطّحة من الجمل تُضيّع مَن قال ماذا — وهو نصف معناها.
      if (parts.length) {
        const inSession = new Set(segments.map((s) => (s.sourceTextSnapshot || '').trim()));
        origin = {
          kind: 'turns',
          turns: parts.map((p) => ({
            speaker: p.speaker || 'المتحدث',
            isMine: Boolean(p.isMine),
            text: p.text || '',
            picked: inSession.has((p.text || '').trim()),
          })),
          total: parts.length,
        };
      }
    } else if (session.sourceType === SOURCE_TYPE.CONTENT_BLOCK) {
      const block = await contentBlocks.get(session.sourceId);
      resolved = block ? { title: block.title } : { missing: true };
      if (block?.text) origin = { kind: 'text', text: block.text };
    } else if (session.sourceType === SOURCE_TYPE.MEDIA_TEXT) {
      resolved = { title: session.title };
    } else if (session.sourceType === SOURCE_TYPE.STUDY_DRAFT) {
      /*
       * ⚠️ والأصلُ هنا **المسودّة كلُّها** لا الجمل المختارة: تسأل
       *    وأنت تتدرّب «الشرح كان بيقول إيه عن دي؟» فتجده تحت يدك
       *    بلا مغادرة. والمؤشَّرُ منها معلَّمٌ كما في المختارات.
       */
      const draft = await studyDrafts.get(session.sourceId);
      resolved = draft ? { title: draft.subjectText || 'مسودّة' } : { missing: true };
      /*
       * ⚠️ **بلاغُك**: «التدرّب على اللي في المسودّة حلو، بس بيخرجني من
       *    النصّ الأصلي — خلّي فيه إمكانية الإنهاء والرجوع له».
       *
       * والمسودّةُ تحفظ مكانَ ميلادها (`sessionId`) منذ WS25، ووصفتُه
       * وقتها بأنه «سياقٌ لا هُويّة» — أي أنه لا يملكها. وهو كذلك،
       * **ولكنّه يكفي لطريق العودة**: من أين جئت، لا أين تعيش.
       */
      if (draft?.sessionId && draft.sessionId !== session.id) {
        backTo = { href: `/shadow/${draft.sessionId}`, label: 'ارجع للنصّ الأصلي' };
      }
      if (draft?.text) {
        const inSession = new Set(segments.map((s) => (s.sourceTextSnapshot || '').trim()));
        const all = draftSentences(draft);
        origin = {
          kind: 'text',
          text: draft.text,
          sentences: all.map((line) => ({ text: line.text, picked: inSession.has(line.text.trim()) })),
          total: all.length,
        };
      }
    }
  } catch {
    resolved = { missing: true };
  }

  const described = describeSource(session, segments, resolved);
  /* طريقُ العودة يسبق «افتح الأصل» العامّ حين يوجد — هو الأدقّ. */
  if (backTo) return { ...described, origin, href: backTo.href, hrefLabel: backTo.label };
  return { ...described, origin };
}

/**
 * بطاقة المصدر أعلى الصفحة اليسرى.
 *
 * ⚠️ **وتضيق حين تكون فوق صورة.** بلاغُك: «كبّر شوية المساحة اللي
 *    بتاخدها، ممكن تصغّر الحاجات اللي فوقيها». والبطاقة كانت ثلاثة
 *    أسطر — نوعٌ واسمٌ وملاحظة — فوق إطارٍ ارتفاعُه 200px في لوحٍ
 *    سقفُه 250. أي: الوصفُ يأخذ رُبعَ ما للموصوف.
 *
 *    فحين توجد صورة تصير سطرًا واحدًا: الاسم وحده والأيقونة، وتسقط
 *    الملاحظةُ لا لأنها بلا قيمة بل لأن قيمتها أقلُّ من البكسلات
 *    التي تأكلها من الصورة. وحين لا توجد صورة تبقى كما هي — الضِّيقُ
 *    ثمنٌ ندفعه لسببٍ قائم، لا عادةٌ نجرّها بعد زوال سببها.
 *
 * @param {object} source وصفُ المصدر.
 * @param {boolean} tight هل فوق الصورة؟ فتضيق.
 */
function sourceBadge(source, tight) {
  return html`
    <div class="sh-source${tight ? ' tight' : ''}">
      <span class="sh-source-icon" aria-hidden="true">${source.icon}</span>
      <span class="sh-source-body">
        ${raw(tight ? '' : html`<b>${source.kind}</b>`)}
        <span class="sh-source-name">${source.name}</span>
        ${raw(!tight && source.note ? html`<small>${source.note}</small>` : '')}
      </span>
      ${raw(
        source.href
          ? html`<button class="sh-source-open" data-sh="open-source"
              data-to="${source.href}">${source.hrefLabel || 'افتح الأصل'}</button>`
          : ''
      )}
    </div>`;
}

/**
 * لوحة الأصل — نظيرة لوحة الصورة، للنصّ (بند 13).
 *
 * الصورة لها إطارها منذ البداية: تُمرَّر داخله وتُثبَّت وتُحجَّم.
 * والسكريبت والمحادثة لم يكن لهما شيء — تراهما مُقسَّمَين إلى مقاطع
 * ممارسة، والأصل غائب. وهو غيابٌ يُحسّ في لحظتين:
 *
 *  · حين يقسّم المُقسِّم في موضعٍ غريب فتريد أن ترى الجملة كما كُتبت.
 *  · وحين تسأل «هو قال إيه قبل دي؟» — والمقاطع لا تحفظ الجوار.
 *
 * فصار لهما إطارٌ بنفس منطق إطار الصورة: **يُمرَّر داخله** فلا يدفع
 * المقاطع لأسفل، **ويُحجَّم** بمقبض، **ويُطوى** حين لا تحتاجه.
 *
 * ⚠️ **عرضٌ محض.** لا يعدّل نصًّا ولا يعيد تقسيمًا ولا يمسّ الجلسة.
 */
function originPanel(source) {
  const origin = source?.origin;
  if (!origin) return '';

  const body =
    origin.kind === 'turns'
      ? origin.turns
          .map(
            (t) => html`
              <div class="sh-origin-turn${t.isMine ? ' mine' : ''}${t.picked ? '' : ' skipped'}">
                <span class="sh-origin-who">${t.speaker}</span>
                <span class="sh-origin-said" dir="ltr" lang="ru">${t.text}</span>
              </div>`
          )
          .join('')
      : origin.sentences
        ? origin.sentences
            .map(
              (s) =>
                html`<span class="sh-origin-sent${s.picked ? '' : ' skipped'}"
                  dir="ltr" lang="ru">${s.text}</span>`
            )
            .join(' ')
        : html`<p class="sh-origin-raw" dir="ltr" lang="ru">${origin.text || ''}</p>`;

  // كم تركتَ خارج الجلسة؟ يُقال بالعدد لا يُترك للتخمين.
  const skipped =
    origin.kind === 'turns'
      ? origin.turns.filter((t) => !t.picked).length
      : (origin.sentences || []).filter((s) => !s.picked).length;

  return html`
    <details class="sh-origin" data-origin ${ctx.originOpen ? 'open' : ''}>
      <summary>
        ${origin.kind === 'turns' ? 'المحادثة الأصلية' : 'النصّ الأصلي'}
        ${raw(
          skipped
            ? html`<span class="sh-origin-note">${skipped} مش في الجلسة دي</span>`
            : ''
        )}
      </summary>
      <div class="sh-origin-scroll" style="--origin-h:${ctx.originHeight}px">
        ${raw(body)}
      </div>
      <div class="sh-origin-grip" data-origin-grip role="separator"
        aria-label="اسحب لتغيير ارتفاع النصّ الأصلي"></div>
    </details>`;
}

/** صورة غلاف المشهد — الصفحة اليسرى تعرض الذكرى لا النصّ وحده. */
async function coverImage(sceneId, session) {
  try {
    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **صورةُ الجلسة أوّلًا — لا غلافُ الذكرى.**
     * ═══════════════════════════════════════════════════════════
     *
     * بلاغُك: «الصورة اللي اخترتها أتدرّب عليها المفروض تتعرض في
     * التابة الرئيسيّة».
     *
     * وكانت الورقةُ تعرض **غلافَ الذكرى** دائمًا. فتفتح صورةً من
     * خمسٍ وتضغط «استخرج النصّ واتدرّب» — فتُبنى جلسةٌ مصدرُها تلك
     * الصورة بعينها، **وتعرض الورقةُ صورةً أخرى**. أي أنك تتدرّب على
     * نصّ صورةٍ وأمامك غيرُها.
     *
     * فالأولويّة: صورةُ **مصدر هذه الجلسة** إن كان مصدرُها صورة، ثم
     * غلافُ الذكرى، ثم أوّلُ صورةٍ فيها.
     */
    if (session?.sourceType === SOURCE_TYPE.MEDIA_TEXT && session.sourceId) {
      const own = await media.get(session.sourceId);
      if (own && (own.mime || '').startsWith('image')) return urlFor(own, { thumb: false });
    }

    if (!sceneId) return null;
    const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
    const cover = links.find((l) => l.roles?.includes('cover')) || links[0];
    if (!cover) return null;
    const record = await media.get(cover.mediaId);
    if (!record || record.kind !== 'image') return null;
    return urlFor(record, { thumb: false });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * العرض
 * ------------------------------------------------------------------ */

export async function renderShadow(main, sessionId) {
  /*
   * العودةُ إلى الجلسة تُنهي الترك تمامًا: شريطٌ يُرفَع، ومحرّكٌ
   * قديمٌ يُدمَّر قبل أن يُبنى الجديد. ولا يُترَك واحدٌ حيًّا مع آخر.
   */
  parked = false;
  parkedBar?.remove();
  parkedBar = null;
  player?.destroy();
  player = null;
  disposeShadow();

  const loaded = await loadSession(sessionId);
  if (!loaded) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الجلسة دي مش موجودة</h2>
        <button class="btn btn-ghost" data-action="go-life">ارجع لحياتي</button>
      </div>`;
    return;
  }

  const { session, segments } = loaded;
  await loadVoices();

  const [current, scene, cover, voices, source] = await Promise.all([
    readCurrentSource(session),
    session.sceneId ? scenes.get(session.sceneId) : null,
    coverImage(session.sceneId, session),
    listVoices(),
    resolveSource(session, segments),
  ]);

  const change = current ? detectSourceChange(session, current) : { changed: false };

  /*
   * التسجيل البشري المربوط بالمصدر — «بشري إن وُجد وإلا TTS» من
   * التطبيق القديم. صار ممكنًا بحقّه الآن لأن الربط صريح في القاعدة:
   * تسجيل مربوط بهذا السكريبت يُنطق بدل الصوت الآلي.
   */
  let humanAudioUrl = null;
  if (session.sourceId) {
    try {
      const links = await resolveLinks(session.sourceId, LINK.AUDIO_SCRIPT);
      const record = links.map((l) => l.entity).find((e) => e?.kind === 'audio' && e.blob);
      if (record) humanAudioUrl = urlFor(record, { thumb: false });
    } catch {
      /* الربط اختياري — غيابه يعني TTS فقط */
    }
  }

  ctx = {
    session,
    segments,
    change,
    scene,
    cover,
    voices,
    source,
    /*
     * ⚠️ **والافتراضُ «مصري» لا «روسي فقط».** لمّا صار «روسي فقط»
     *    يُخفي الترجمةَ فعلًا — كما يقول اسمُه — صارت الجلسةُ الجديدة
     *    تفتح بلا ترجمة، وهو عكسُ ما كان يراه المستعمِل. فالتصحيحُ
     *    الصادقُ للمعنى يلزمه تصحيحُ الافتراض معه، وإلّا بدا كأنه
     *    عطلٌ جديد.
     */
    display: session.displayMode || DISPLAY.EGY,
    volume: session.volume ?? 1,
    lang: session.translationLang || 'ams',
    font: session.fontId || 'philosopher',
    /* ⚠️ يرث `fontId` حين لا يكون له حقلٌ خاصّ — فالجلساتُ القديمة
       تفتح بصفحتين متطابقتين كما تركتَها، ثم تفترقان باختيارك. */
    fontDoc: session.fontDocId || session.fontId || 'philosopher',
    stress: session.showStress ?? true,
    autoRead: false,
    humanAudioUrl,
    // تقرأ `'human'` القديم فتعيد `'mine'` (بلا ترقية بيانات)، ثم
    // تحصره فيما هو متاح فعلًا في هذه الجلسة.
    audioSource: effectiveAudioSource(session.audioSource, Boolean(humanAudioUrl)),
    nativeConsent: await nativeAudioConsent(),
    /* ⚠️ 320 لا 200: الصورةُ صارت أوّلَ الورقة فسقفُ اللوح اتّسع لها.
       ومَن سحب المقبض مرّةً يبقى على ارتفاعه — الافتراضُ لا يدهس اختيارًا. */
    coverHeight: session.coverHeight || 320,
    coverZoom: session.coverZoom || 100,
    coverPinned: session.coverPinned ?? false,
    fontSize: session.fontSize ?? 1,
    /* درجةُ الحجم بالبكسل (§١٩٫٢) — غيرُ النسبة أعلاه. */
    sizePx: session.sizePx || DEFAULT_SIZE_PX,
    // مطويّة افتراضيًّا: الأصل مرجعٌ تفتحه عند الحاجة لا شيءٌ يزاحم
    // ما تتدرّب عليه.
    originOpen: session.originOpen ?? false,
    originHeight: session.originHeight || 160,
  };

  /*
   * ⚠️ **قبل الرسم لا بعده**: العلامةُ تُولد مع السطر. ولو قُرئت بعده
   *    لظهرت السطورُ بلا علامةٍ ثم قفزت العلاماتُ فوقها — ووميضٌ كهذا
   *    يجعلك تشكّ فيما تراه.
   */
  await readDrafted();

  main.innerHTML = shell();
  document.body.classList.add('shadow-open');

  // الخطوط تُحقن مرّة واحدة هنا فلا تُثقل بقية التطبيق.
  ensureFontsLoaded();
  await loadUserDictionary();
  await loadExpressionIndex();

  // الشعلة رقم محسوب من دليل ممارسة حقيقي — لا عدّاد يُزاد يدويًا.
  practiceStreak()
    .then((days) => {
      const el = main.querySelector('[data-streak]');
      if (el) el.textContent = days;
    })
    .catch(() => {});

  player = createPlaybackController({
    segments: segments.map((s) => ({
      id: s.id,
      text: s.sourceTextSnapshot,
      humanAudioUrl,
    })),
    settings: { ...session, volume: ctx.volume, audioSource: ctx.audioSource },
    onEvent: handleEvent,
    nativeResolver: resolveNative,
  });

  player.goTo(session.currentSegmentIndex || 0);
  syncSegment();
  /*
   * ⚠️ الرقائق تُرسَم عند الإقلاع لا عند الطلب (WS24): صارت جزءًا من
   *    المسرح لا لوحةً تُفتَح، فلو انتظرت ضغطةً لبقي تحت الجملة فراغ.
   */
  renderWords();

  /* حبلٌ جديدٌ لهذه الفتحة — يقطع مستمعي الفتحة التي قبلها. */
  freshWires();

  wireSpine(main);
  wireDocSplit(main);
  wirePinch(main);
  wireCoverResize(main);
  wireOriginPanel(main);
  wireInteractions(main);
  wireModalActions();
  wireMediaSession();

  /* ارتفاعُ المستند المحفوظ، ثم السكّة في وضعها الابتدائي. */
  applyDoc(Number(await settings.get(DOC_KEY, 250)) || 0);
  await applySky();
  await readFaces(ctx.session);
  renderFaces();
  await renderWells();
  renderModes();
  renderRail();
  /* رجعتَ والزرُّ عاد أمامك — فالشريطُ يرفع نفسَه. */
  paintVoiceBar();
  wireChips(main);
  /*
   * ⚠️ **قبل المُقلِّب — قرارُه أوّلًا.** `wirePager` تقرأ
   *    `book.dataset.layout` عند أوّل رسمٍ لها، فلا بدّ أن تكون
   *    `wireBookLayout` قد كتبته قبل ذلك (بند 1، WS39).
   */
  wireBookLayout(main);
  wirePager(main);
}

/**
 * ضغطةٌ تسمع الكلمة، وضغطةٌ مطوّلة تفتح أدواتها (WS24).
 *
 * ⚠️ **على `Pointer Events` لا `Touch`** — كالقرص في العارض: إصبعٌ
 *    وفأرةٌ وقلمٌ بمستمعٍ واحد.
 */
function wireChips(main) {
  const host = main.querySelector('[data-words]');
  if (!host) return;
  let timer = null;
  let long = false;

  host.addEventListener('pointerdown', (event) => {
    const chip = event.target.closest('[data-word]');
    if (!chip) return;
    long = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      long = true;
      rail.word = Number(chip.dataset.word);
      rail.tool = 'hear';
      rail.open = true;
      host.querySelectorAll('[data-word]').forEach((n) => n.classList.remove('picked'));
      chip.classList.add('picked');
      renderRail();
    }, 420);
  }, wired());

  const end = (event) => {
    clearTimeout(timer);
    const chip = event.target.closest?.('[data-word]');
    if (!chip || long) return;

    host.querySelectorAll('[data-word]').forEach((n) => n.classList.remove('selected'));
    chip.classList.add('selected');

    const at = Number(chip.dataset.word);

    /*
     * ⚠️ **نقرةٌ تُسمعك الكلمة — ولا تغيّر الوضع.** وهذه المرّة صحيحة:
     *    كان تحتها معالِجٌ ثانٍ يقلب الوضعَ إلى «كلمة» ولا يعيده، فبقي
     *    التعليقُ وعدًا والسلوكُ عكسَه.
     *
     * وفي وضع «كلمة» النقرةُ **تنقّل** داخل الوضع — فهذا هو معناه.
     * وفي وضع «جملة» تُنطَق الكلمةُ **مرّةً خارج المحرّك**: نداءٌ
     * مستقلٌّ للناطق لا يمسّ موضعَ الجلسة ولا وضعَها ولا تكرارَها.
     *
     * ⚠️ ولو كانت الجلسةُ تنطق الآن **تقف** ثم تُنطَق الكلمة. جرّبتُ
     *    أوّلًا ألّا أقاطعها — «نقرةٌ فضوليّةٌ لا تقطع تكرارًا أنت في
     *    وسطه» — فقِستُ النتيجة: النقرةُ **لا تفعل شيئًا** والجملةُ
     *    ماضية. وزرٌّ لا يفعل شيئًا أسوأُ من زرٍّ يقاطع: أنت طلبتَ
     *    الكلمةَ صراحةً. والوقوفُ إيقافٌ لا إنهاء — «تشغيل» تستأنف.
     */
    if (player.state.settings.practiceMode === PRACTICE_MODE.WORD) {
      player.selectWord(at);
      return;
    }

    if (player.state.running && !player.state.paused) player.pause();
    const word = splitWords(ctx.segments[player.state.index]?.sourceTextSnapshot || '')[at];
    if (word) {
      speakOnce(word.spoken, {
        rate: ctx.session.speed ?? 1,
        voiceName: ctx.session.voiceId || null,
        volume: ctx.volume ?? 1,
      });
    }
  };
  host.addEventListener('pointerup', end, wired());
  host.addEventListener('pointercancel', () => clearTimeout(timer), wired());
  host.addEventListener('pointerleave', () => clearTimeout(timer), wired());
}

/**
 * أفعالٌ داخل النوافذ المنبثقة.
 *
 * النوافذ تُلحَق بـ`document.body` لا بـ`main`، فمستمع الشاشة لا
 * يراها. مستمع واحد على `document` يُزال عند مغادرة الظلّ.
 */
function wireModalActions() {
  if (modalClickHandler) document.removeEventListener('click', modalClickHandler);

  modalClickHandler = async (event) => {
    /*
     * ⚠️ **الرجوعُ لأصل المحفوظ (بند 5، WS40).** كانت البيانات
     *    (`sessionId`/`sceneId`) تُكتَب منذ WS35 ولا تُقرَأ في أيّ
     *    شاشة — نسبٌ محفوظٌ بلا بابٍ إليه.
     */
    const gotoBtn = event.target.closest('[data-sh="goto-origin"]');
    if (gotoBtn) {
      const { session, scene } = gotoBtn.dataset;
      if (session) return navigate(`/shadow/${session}`);
      if (scene) return navigate(`/scene/${scene}`);
      return toastError('مفيش مصدرٌ محفوظ لهذه — نصٌّ قديم من قبل الربط');
    }

    const btn = event.target.closest('[data-sh="unsave"]');
    if (!btn) return;

    const item = await savedItems.get(btn.dataset.id);
    await deleteWithUndo({
      repo: savedItems,
      id: btn.dataset.id,
      what: 'المحفوظة دي',
      detail: item?.text || '',
      confirmLabel: 'شيلها',
      // الصفّ يختفي فورًا بدل إعادة بناء اللوحة كلها — والتراجع يعيد
      // إظهاره.
      after: () => btn.closest('.sv-row')?.toggleAttribute('hidden'),
    });
  };

  document.addEventListener('click', modalClickHandler);
}

/**
 * ⚠️ **بنيةُ التصميم الذي سلّمتَه — لا ألوانُه وحدها** (WS24 · مرحلة ٢).
 *
 * أوّلُ محاولةٍ بدّلت الألوان وأبقت التخطيط، وقلتَها بحقّ: «عايزها طبق
 * الأصل». فهذه البنية بحرفها:
 *
 * ```
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ ◆ LingoLife │ زيارة المصنع · 29 مايو · كتاب الظلّ   🔥 12 │
 *  ├──┬───────────────────────────────┬───────────────────────┤
 *  │س │  ورقة                     ‖   │  كون            ┃ سكّة│
 *  │كّ│  ┌─ المستند ─┐             ‖   │   01 / 08  ▏▏▎▏  ┃ أدو│
 *  │ة │  └───────────┘             ‖   │                 ┃ ات │
 *  │ال│  ═══ مقبض السحب ═══        ‖   │   الجملة كبيرة  ┃    │
 *  │تن│  ─ النصّ · 8 جمل ─         ‖   │   والعربيّة تحتها┃    │
 *  │قّ│  ▎ 01 В ходе проверки…     ‖   │                 ┃    │
 *  │ل │  ▎ 02 Прошу рассмотреть…   ‖   │  [رقائق الكلمات]┃    │
 *  │  │  النصّ · ملاحظات · أشخاص   ‖   │   ◀  ▶  ▶▶      ┃    │
 *  ├──┴───────────────────────────────┴───────────────────────┤
 *  │ [لقطة] служебная записка        8 جمل · 12:45 · 125 كلمة │
 *  └──────────────────────────────────────────────────────────┘
 * ```
 *
 * ⚠️ **وكلُّ `data-sh` القديم باقٍ بحرفه.** التخطيط تغيّر والأسلاك لا:
 *    `wireInteractions` لم تُلمَس، فما كان يعمل أمس يعمل اليوم — وهذا
 *    شرطُ ألّا يكون التصميمُ الجميل خسارةً في الوظيفة.
 */
function shell() {
  const { session, segments, scene, cover, change, source, voices } = ctx;
  const idx = session.currentSegmentIndex || 0;
  const title = scene?.titleAr || scene?.titleRu || session.title || 'جلسة ظلّ';

  return html`
    <div class="shadow-app">

      <!-- ══════════ الشريط العلوي ══════════ -->
      <header class="sh-topbar">
        <div class="sh-brand"><i class="sh-diamond"></i> LingoLife</div>
        <span class="sh-vrule"></span>
        <div class="sh-crumb">
          <b>${title}</b>
          <span class="sh-mono">${scene?.date ? formatDate(scene.date) : ''}</span>
          <span class="sh-slash">/</span>
          <span class="sh-mono sh-gold">SHADOWING</span>
        </div>
        <div class="sh-grow"></div>
        <!--
          ⚠️ العدّاد **يُقرأ من قاعدتك**. التصميم يكتب «12 DAY STREAK»
             ثابتةً، والبند 89 يمنع رقمًا بلا مصدر. فقد يكون صفرًا،
             ويُقال صفرًا.
        -->
        <div class="sh-streak" title="أيام متتالية فيها تدريب حقيقي">
          <i></i><b data-streak>—</b> DAY STREAK
        </div>
        <button class="sh-exit" data-sh="exit">${raw(icon('back', 14))} LIBRARY</button>
      </header>

      <div class="sh-body">

        <!-- ══════════ سكّة التنقّل الرأسيّة ══════════ -->
        <nav class="sh-railnav" aria-label="تنقّل">
          <button data-sh="go" data-to="/">NOW</button>
          <button data-sh="go" data-to="/life">LIBRARY</button>
          <button class="on" aria-current="page">SHADOWING</button>
          <button data-sh="go" data-to="/language">VOCABULARY</button>
          <button data-sh="go" data-to="/analysis">REPORTS</button>
        </nav>

        <!-- ══════════ الكتاب ══════════ -->
        <div class="sh-book">
          <!--
            ⚠️ المؤشّرُ **شقيقُ** الصفحات لا ابنُها: ابنٌ داخل حاويةٍ
               تنزلق أفقيًّا ينزلق معها فلا يبقى في مكانه.
          -->
          <div class="sh-pager" data-pager hidden>
            <button data-sh="page-go" data-v="0" aria-label="اذهب لصفحة الأصل">‹ SOURCE</button>
            <button data-sh="page-go" data-v="1" aria-label="اذهب لصفحة التدريب">SHADOWING ›</button>
          </div>

          <div class="sh-pages" data-pages>

            <!-- ─────── الورقة ─────── -->
            <div class="sh-page sh-left">

              <div class="sh-sec-head">
                <span class="sh-mono">SOURCE · ${source?.label || 'TEXT'}</span>
                <span class="sh-pgbtns">
                  <button data-sh="doc" data-fit="fit">FIT</button>
                  <button data-sh="doc" data-fit="full">FULL</button>
                </span>
              </div>

              <!--
                لوحُ المستند: ارتفاعُه متغيّرٌ ويُسحَب بالمقبض تحته،
                فتقرّر أنت كم ترى من الأصل وكم ترى من الجمل.
              -->
              <!-- أشرطةُ المنابع: المصدر · صور · سكريبتات · أصوات -->
              <div class="sh-well-tabs" data-well-tabs></div>

              <div class="sh-doc" data-doc>
                <!--
                  مبدّلُ أوجه المصدر الواحد (WS33) — الشرحُ فوق FACES.
                  لا يظهر إن كان للمصدر وجهٌ واحد.
                -->
                <div class="sh-faces" data-faces hidden></div>
                <div class="sh-face-body" data-face-body hidden></div>
                <div class="sh-well-body" data-well-body hidden></div>
              <!--
                ⚠️ **والصورةُ أوّلًا حين توجد.** كانت آخرَ ما في الورقة:
                   تحت البطاقةِ وتحت لوحةِ الأصل وتحت لافتةِ التقادم —
                   فتبدأ من منتصف اللوح ويُقصّ نصفُها عند سقفه. وهي
                   المنظورُ لا الموصوف؛ فالترتيبُ صار: الصورةُ فوق،
                   وما يصفها تحتها.
              -->
                <div class="sh-sheet${cover ? ' has-cover' : ''}" data-doc-source>
                  ${raw(cover ? coverPanel(cover) : '')}
                  ${raw(sourceBadge(source, Boolean(cover)))}
                  ${raw(originPanel(source))}
                  ${raw(change.changed ? staleBanner(change) : '')}
                </div>
              </div>

              <!-- ⚠️ مقبضٌ ثانٍ غيرُ كعب الكتاب: هذا يقسم **الورقة**. -->
              <div class="sh-docsplit" data-docsplit role="separator"
                   aria-label="اسحب لتغيير حجم المستند">
                <button data-sh="doc" data-fit="none">◂ SOURCE</button>
                <span class="sh-grip"></span>
                <button data-sh="doc" data-fit="full">TRANSCRIPT ▸</button>
              </div>

              <div class="sh-sec-head">
                <span class="sh-mono">TRANSCRIPT · ${segments.length} SENTENCES</span>
                <span class="sh-mono sh-dim">RU → AR</span>
              </div>

              <div class="sh-select-bar" data-select-bar hidden>
                <span class="sh-select-count"><b data-select-count>0</b> / ${segments.length}</span>
                <div class="sh-select-actions">
                  <button data-sh="sel" data-pick="all">الكل</button>
                  <button data-sh="sel" data-pick="none">مسح</button>
                  <button data-sh="sel" data-pick="difficult">صعبة</button>
                  <button data-sh="sel" data-pick="unpracticed">لسه</button>
                </div>
                <button class="sh-select-go" data-sh="sel-apply">تدرّب على المحدَّد</button>
              </div>

              ${raw(fontChip('doc'))}

              <div class="sh-lines" data-lines>
                ${raw(segments.map((seg, i) => lineHtml(seg, i, i === idx)).join(''))}
              </div>

              ${raw(fontPanel())}

              <div class="sh-foot-tabs">
                <button class="on">TRANSCRIPT</button>
                <button data-sh="scratch-open">NOTES</button>
                <button data-sh="toggle-tr">DICTIONARY</button>
                <button data-sh="stress">STRESS</button>
              </div>
            </div>

            <div class="sh-spine" data-spine role="separator"
                 aria-label="اسحب لتغيير حجم الصفحتين"></div>

            <!-- ─────── الكون ─────── -->
            <div class="sh-page sh-right">
              <!-- طبقاتُ الفضاء — داخل الصفحة لا خلف الكتاب. -->
              <div class="sh-plate" aria-hidden="true"></div>
              <div class="sh-stars-far" aria-hidden="true"></div>
              <div class="sh-stars-near" aria-hidden="true"></div>
              <div class="sh-spill" aria-hidden="true"></div>

              <div class="sh-stage-top">
                <div class="sh-mono sh-count">
                  <b data-pos>${idx + 1}</b> / ${String(segments.length).padStart(2, '0')} SENTENCES
                  <span data-status class="sh-dim">جاهز</span>
                </div>
                <!--
                  ⚠️ **الرجوعُ إلى ما جئتَ منه — حيث تنظر لا حيث دفنتُه.**

                     بنيتُه في الجولة الماضية داخل بطاقة المصدر في
                     الصفحة اليسرى، وقلتَ: «بشغّل المسودّة وبادرّب عليها
                     بس مش لاقي رجوع للنصّ الأصلي». وهو موجودٌ — وأنت
                     محقّ: مكانُه كان خطأ. الصفحةُ اليسرى تُطوى على
                     الهاتف، وأنت وقتَ التدريب تنظر إلى **اليمنى** كلَّ
                     الوقت. فزرٌّ في مكانٍ لا تنظر إليه = زرٌّ غير موجود.
                -->
                ${raw(source.hrefLabel ? html`
                  <button class="sh-backsrc" data-sh="open-source" data-to="${source.href}">
                    ↩ ${source.hrefLabel}
                  </button>` : '')}
                <!--
                  ⚠️ **شُرَطٌ لا شريطُ تقدّم.** الشريط يقول «كم قطعتَ»؛
                     والشُّرَط تقول ذلك **وتُنقَر**: كل شرطةٍ جملة، تضغطها
                     فتقفز إليها. رقمٌ صار قائمة — كقاعدة المختبر.
                -->
                <div class="sh-bar" data-bar><span></span></div>
                <span data-counter hidden></span>
                ${raw(fontChip('stage'))}
              </div>

              <div class="sh-hero" data-card>
                <!--
                  ⚠️ **الشارةُ نفسُها هي زرُّ الخروج (بند 17-18).** لا
                     صندوقَ حفظٍ ثانٍ ولا حوارَ خروجٍ منفصل — ضغطةٌ
                     عليها ترجعك لجملة الجلسة، والحفظُ من الزرّ العامّ
                     (🔖) الذي يعمل على أيّ مقطعٍ حاليّ سواءً كان هذا
                     أو جملةً من السكريبت.
                -->
                <div class="sh-hero-top">
                  <button type="button" class="sh-current-lbl" data-current-lbl
                    data-sh="scratch-clear" hidden></button>
                  <!--
                    ⚠️ **زرّان عامّان — يعملان على أيّ مقطعٍ حاليّ**
                       (بند 5، 11، 19): سكريبتٍ كان أو نصًّا لصقتَه
                       الآن. لا نسخةَ ثانية لأيٍّ منهما للنصّ الخارجي.
                  -->
                  <span class="sh-current-tools">
                    <button data-sh="save-item" aria-label="احفظها">🔖</button>
                    <button data-sh="copy-item" aria-label="انسخها">⧉</button>
                    <!--
                      ⚠️ **لوحةٌ كاملةٌ بلا بابٍ إليها (بند 5).** openPanel('difficult')
                         كانت مبنيّةً بكل تفصيلها — تصنيفاتٌ، حذفٌ، والآن
                         الرجوعُ للأصل — ولا زرَّ واحدًا في الشاشة يفتحها.
                    -->
                    <button data-sh="panel" data-panel="difficult" aria-label="المحفوظات والصعب">♡</button>
                  </span>
                </div>
                <div class="sh-current-text" data-text></div>
                <div class="sh-current-tr" dir="rtl" data-tr></div>
                <div class="sh-marks" data-marks></div>

                <!--
                  ⚠️ **مربّعُ النصّ الخارجيّ في مكان الجملة نفسه.**
                     طلبُك: «أجيب نصّ خارجي وأدخله في نفس المكان اللي
                     عارض الجملة، وأشيله وأنسخ التانية، ولما أخلص أرجع
                     أكمّل». وكان في أسفل الشاشة مطويًّا — أي في مكانٍ
                     غيرِ الذي يُقرأ منه. فصار **هنا**: النصُّ يصير
                     **مقطعًا حقيقيًّا** (WS40) يحلّ محلّ الجملة ويُقرأ
                     بنفس المحرّك والسرعة والتكرار وكلّ ميزةٍ أخرى، ثم
                     يُشال فتعود الجلسةُ من حيث وقفت بالضبط.
                -->
                <form class="sh-scratch" data-scratch hidden>
                  <input type="text" name="scratch" dir="ltr" lang="ru" data-scratch-input
                    placeholder="الصق جملتك هنا — هتحلّ محلّ اللي فوق" autocomplete="off" />
                  <button type="submit">اقرأها</button>
                  <button type="button" data-sh="scratch-close" aria-label="اقفل">✕</button>
                </form>
              </div>

              <!--
                رقائقُ الكلمات: ضغطةٌ تسمعها، وضغطةٌ مطوّلة تفتح أدواتها
                في السكّة. والشريطُ تحت كلِّ رقاقةٍ يمتلئ وهي تُنطَق.
              -->
              <div class="sh-chips" data-words></div>
              <div class="sh-hint sh-mono" data-hint>TAP A WORD TO HEAR · HOLD FOR ACTIONS</div>

              <!--
                ⚠️ **لافتةُ «مفيش صوت روسي» اتشالت** (WS36) — بطلبك:
                    «ملهاش لازمة وواخدة مساحة كبيرة».

                    وكانت لها لازمةٌ يوم كُتبت: كنتَ تدوس تشغيل فلا تسمع
                    شيئًا ولا تعرف لماذا. ثم صار على جهازك صوتٌ روسيّ،
                    فصارت لافتةً لا تظهر لك أصلًا — إلّا حين يتأخّر
                    تحميلُ الأصوات لحظةً عند الفتح فتومض ثم تختفي.

                    ⚠️ **والمعلومةُ لم تُرمَ، بل انتقلت**: لوحةُ الصوت في
                    السكّة تقول «مفيش صوت روسي» حين لا يوجد — سطرٌ في
                    مكانِ السؤال، بدل لوحةٍ تحجز رُبعَ المسرح دائمًا.
              -->

              <!--
                ⚠️ مفتاحُ الأوضاع الثلاثة (WS28) — الشرحُ فوق سجلّ
                    MODES في shadow-view.js. ولا backtick هنا: يكسر
                    القالب (فخٌّ وقعتُ فيه ثلاث مرّات).
              -->
              <div class="sh-modes" data-modes role="tablist"
                   aria-label="إيه اللي بيتقرا"></div>

              <div class="sh-transport">
                <button class="sh-nav-btn" data-sh="prev" aria-label="السابق">
                  <i class="sh-ico-prev"></i>
                </button>
                <button class="sh-play" data-sh="play" aria-label="تشغيل">
                  <i class="sh-ico-play"></i>
                </button>
                <button class="sh-nav-btn" data-sh="next" aria-label="التالي">
                  <i class="sh-ico-next"></i>
                </button>
              </div>

              <div class="sh-quickpills">
                <button data-sh="drawer" data-dial="speed">${session.speed}x</button>
                <button data-sh="drawer" data-dial="repeat">×${session.repeatCount}</button>
                <button data-sh="drawer" data-dial="pause">${intervalLabel(session)}</button>
                <button data-sh="toggle-tr">ARABIC</button>
                <button data-sh="scratch-open">✎ MY TEXT</button>
              </div>

              <!-- الحجاب: ضغطةٌ خارج السكّة تغلقها. -->
              <div class="sh-scrim" data-sh="rail-close"></div>

              <!-- ══════════ سكّة الأدوات ══════════ -->
              <div class="sh-toolrail" data-toolrail>
                <span class="sh-rail-ctx sh-mono" data-rail-ctx>الظلّ</span>
                <div class="sh-rail-tools" data-rail-tools></div>
                <div class="sh-grow"></div>
                <button class="sh-rail-toggle" data-sh="rail" aria-label="افتح الأدوات">‹</button>
              </div>

              <aside class="sh-panel" data-panel-host>
                <div class="sh-panel-head">
                  <span class="sh-mono" data-panel-title></span>
                  <button data-sh="rail-close" aria-label="اقفل">✕</button>
                </div>
                <div class="sh-panel-rule"></div>
                <div class="sh-panel-body" data-panel-body></div>
                <div class="sh-panel-foot sh-mono" data-panel-foot></div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════ الشريط السفلي ══════════ -->
      <footer class="sh-bottom">
        <!--
          ⚠️ **ولا مربّعَ يقول «لقطة» وهو فارغ.** التصميم يضع مستطيلًا
             مخطَّطًا مكانَ صورةٍ لا وجودَ لها. وواجهةٌ تعرض إطارًا
             لشيءٍ غير موجود تَعِد بما لا تملك — فإن كان للذكرى غلافٌ
             ظهر، وإلّا فلا شيء.
        -->
        ${raw(cover ? html`<div class="sh-still"><img src="${cover}" alt="" /></div>` : '')}
        <div class="sh-bottom-title">
          <b>${session.title || title}</b>
          <span class="sh-mono sh-dim">${source?.label || 'نصّ'}</span>
        </div>
        <div class="sh-grow"></div>
        <!--
          ⚠️ **ثلاثةُ أرقامٍ لا أربعة.** التصميم يعرض «85% ACCURACY»
             رابعًا، والتطبيق **لا يسمعك** — فلا سبيل إلى قياس دقّة
             نطقك بلا تعرّفٍ على الكلام. ورقمٌ لا مصدر له لا يُعرَض
             (بند 89)، ولا يُستبدَل بتقديرٍ يبدو علمًا.
        -->
        <div class="sh-stats">
          <div><b>${segments.length}</b><span class="sh-mono">SENTENCES</span></div>
          <div><b>${segments.reduce((n, seg) => n + splitWords(seg.sourceTextSnapshot).length, 0)}</b><span class="sh-mono">WORDS</span></div>
          <div><b>${session.totalRepetitions || 0}</b><span class="sh-mono">REPS</span></div>
        </div>
        <button class="sh-overview" data-sh="panel" data-panel="report">SESSION OVERVIEW</button>
      </footer>

      ${raw(settingsDrawer())}

      <!-- مربّع النصّ الخارجي ووجهات حفظه — يظهران بالطلب. -->
    </div>`;
}

/**
 * صفٌّ واحد للتحكّم: منزلق للضبط السريع، وخانة رقم للقيمة بالضبط.
 *
 * المنزلق وحده لا يكفي — 0.85× و0.9× بينهما بكسلان على تابلت. وخانة
 * الرقم وحدها بطيئة. الاثنان معًا على نفس القيمة: تسحب لتقترب، وتكتب
 * حين تعرف ما تريد بالضبط.
 */
function tuner({ key, label, hint, min, max, step, value, unit = '' }) {
  return html`
    <div class="sh-tuner" data-tuner="${key}">
      <div class="sh-tuner-head">
        <span class="sh-tuner-lbl">${label}</span>
        <span class="sh-tuner-box">
          <input type="number" data-tune-num="${key}" value="${value}"
            min="${min}" max="${max}" step="${step}" inputmode="decimal"
            aria-label="${label}" />
          <small>${unit}</small>
        </span>
      </div>
      <input type="range" class="sh-range" data-tune-range="${key}"
        min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" />
      <div class="sh-tuner-hint">${hint}</div>
    </div>`;
}

/**
 * درج الإعدادات — ينزلق من الحافّة ويرجع مكانه.
 *
 * كان كل هذا مبسوطًا في الصفحة اليمنى فأزاح الجملة التي تتدرّب عليها
 * إلى أسفل الشاشة. صار درجًا: يظهر حين تضبط، ويختفي حين تتدرّب.
 */
function settingsDrawer() {
  const { session, voices } = ctx;
  const pauseMs = intervalMs(session);

  return html`
    <div class="sh-drawer-veil" data-drawer-veil hidden></div>
    <aside class="sh-drawer" data-drawer hidden aria-label="إعدادات الظلّ">
      <div class="sh-drawer-head">
        <b>⚙︎ اضبط الظلّ</b>
        <button data-sh="drawer-close" aria-label="إغلاق">✕</button>
      </div>

      <div class="sh-drawer-body">
        ${raw(
          tuner({
            key: 'speed',
            label: '🎚 السرعة',
            hint: 'ابدأ بطيء واطلع بالتدريج. الفرق بين 0.85 و0.9 مسموع.',
            min: RATE_MIN, max: RATE_MAX, step: 0.05,
            value: session.speed ?? 0.8, unit: '×',
          })
        )}

        ${raw(
          tuner({
            key: 'repeat',
            label: '🔁 عدد التكرار',
            hint: 'كام مرّة تتقال الجملة قبل ما ينتقل للي بعدها.',
            min: 1, max: 99, step: 1,
            value: session.repeatCount ?? 5, unit: 'مرّة',
          })
        )}

        ${raw(
          tuner({
            key: 'pause',
            label: '⏳ الفاصل بين التكرارات',
            hint: 'المهلة اللي بتقول فيها الجملة بصوتك. بالملّي ثانية.',
            min: 0, max: 10000, step: 50,
            value: pauseMs, unit: 'ms',
          })
        )}

        ${raw(
          tuner({
            key: 'volume',
            label: '🔊 مستوى الصوت',
            hint: '',
            min: 0, max: 100, step: 1,
            value: Math.round(ctx.volume * 100), unit: '%',
          })
        )}

        <div class="sh-drawer-sec">
          <div class="sh-section-lbl">وضع العرض</div>
          <div class="sh-seg" data-display-seg>
            <button data-sh="display" data-val="ru">RU<small>الروسي</small></button>
            <button data-sh="display" data-val="egy">مصري<small>الترجمة</small></button>
            <button data-sh="display" data-val="hidden">مخفي<small>اكشفها</small></button>
          </div>
        </div>

        <div class="sh-drawer-sec">
          <div class="sh-section-lbl">وضع التكرار</div>
          <div class="sh-seg" data-repeat-seg>
            <button data-sh="mode" data-val="count">بالعدد<small>يقف بعد العدد</small></button>
            <button data-sh="mode" data-val="continuous">مستمرّ<small>بلا توقّف</small></button>
          </div>
        </div>

        <div class="sh-drawer-sec">
          <div class="sh-section-lbl">الصوت المنطوق</div>
          <select class="sh-select" data-sh="voice-select">
            ${raw(voiceOptions(voices, session.voiceId))}
          </select>
        </div>

        <p class="sh-drawer-note">
          الخطّ والنبر والترجمة مع النصّ نفسه — في أسفل الصفحة اليسرى،
          جنب الكلام اللي بتقرأه.
        </p>
      </div>
    </aside>`;
}

/**
 * لوحة الصورة.
 *
 * ثلاث حاجات في تصميم واحد:
 *  · **إطار خاصّ بها** — تتحرّك الصورة داخله بلا أن تأخذ عرض الصفحة،
 *    فتبقى الجمل مقروءة تحتها.
 *  · **تثبيت** — تلتصق أعلى الصفحة فتراها وأنت تقلّب في الجمل، ومع
 *    ذلك تظلّ قابلةً للتمرير داخل إطارها.
 *  · **تحجيم** — مقبض تحت الإطار يغيّر ارتفاعه، لأن صورة الوثيقة
 *    تحتاج مساحةً لا تحتاجها صورة المكان.
 *
 * الارتفاع والتكبير والتثبيت تُحفظ في الجلسة — إعدادك لا يضيع عند
 * إعادة الفتح.
 */
function coverPanel(url) {
  const { coverHeight, coverZoom, coverPinned } = ctx;
  return html`
    <div class="sh-cover-box${coverPinned ? ' pinned' : ''}" data-cover-box
      style="--cover-h:${coverHeight}px;--cover-zoom:${coverZoom}%">
      <!--
        ⚠️ **والقرصُ بإصبعين هنا لا في العارض وحده.**
           بلاغُك: «الصورة مبتكبرش بالإيد». وكانت أزرارُ (+) و(−)
           وحدَها؛ وهي ثاني طريقٍ لا أوّله — الإصبعان ما تمدّه أوّلًا.
           ⚠️ (ولاحظ: لا علامةَ اقتباسٍ خلفيّة في هذا التعليق. وسمُ
              html ينتهي عندها ولو كانت داخل تعليق — وقد أوقعتني.)
      -->
      <div class="sh-cover-scroll" data-cover-scroll data-pinch>
        <img class="sh-cover" src="${url}" alt="الصورة اللي بتتدرّب على نصّها" />
      </div>
      <!--
        ⚠️ **مطويّةٌ خلف زرٍّ واحد** — بلاغُك: «القايمة اللي فيها pin
           واخدة مساحة ملهاش لازمة».

           وكانت خمسةَ أزرارٍ مفتوحةً فوق الصورة دائمًا. وأنا نفسي
           كتبتُ فوق القرص بإصبعين أن أزرار (+) و(−) «ثاني طريقٍ لا
           أوّله» — ثم تركتُها تحجز رُبعَ عرض الصورة في كلّ نظرة.

           فصارت الأدواتُ تحت ⚙ يُفتَح عند الحاجة، والصورةُ لك.
      -->
      <div class="sh-cover-tools" data-cover-tools>
        <button data-sh="cover-tools" class="sh-cover-more" aria-label="أدوات الصورة">⚙</button>
        <span class="sh-cover-rest" data-cover-rest hidden>
          <button data-sh="cover-pin" class="${coverPinned ? 'on' : ''}"
            aria-pressed="${coverPinned ? 'true' : 'false'}" title="ثبّت الصورة وانت بتقلّب">📌</button>
          <button data-sh="cover-zoom" data-dir="-1" aria-label="صغّر">−</button>
          <span class="sh-cover-zoom" data-cover-zoom>${coverZoom}%</span>
          <button data-sh="cover-zoom" data-dir="1" aria-label="كبّر">+</button>
          <button data-sh="cover-fit" title="ارجعها لمقاس الإطار">⤢</button>
        </span>
      </div>
      <div class="sh-cover-grip" data-cover-grip role="separator"
        aria-label="اسحب لتغيير ارتفاع الصورة"></div>
    </div>`;
}

/**
 * لوحة الخطّ — مطويّة حتى تُطلَب.
 *
 * كان زرّ الخطّ يدوّر على العشرة واحدًا واحدًا: للوصول إلى خطٍّ بعينه
 * تضغط خمس مرّات وتقرأ خمسة أشكال لا تريدها. صارت اللوحة تعرضها كلها
 * **بخطّها نفسه** — تختار بالنظر لا بالتجربة.
 *
 * ومقياس الحجم معها، لأن الخطّ والحجم قرارٌ واحد: الخطّ المتّصل صغيرًا
 * غير مقروء، والمطبعي الكبير يبتلع الشاشة.
 *
 * والعيّنة **سيريلية** (`Аа Бб`) لا لاتينية: أنت تختار خطًّا لنصٍّ
 * روسي، فالعيّنة يجب أن تكون بالحروف التي ستقرأها فعلًا — وإن نقصت
 * في الخطّ ظهر ذلك في العيّنة نفسها قبل أن تختاره.
 */
function fontPanel() {
  return html`
    <div class="sh-fontpanel" data-fontpanel hidden>
      <p class="sh-fontpanel-warn" data-font-warn hidden></p>
      ${raw(
        fontsByForm()
          .map(
            (group) => html`
              <div class="sh-fontgroup">
                <h4>${group.label}<small>${group.hint}</small></h4>
                <div class="sh-fontpanel-grid">
                  ${raw(
                    group.fonts
                      .map(
                        (f) => html`
                          <button class="sh-fontchip ${f.id === ctx.font ? 'on' : ''}"
                            data-sh="font-pick" data-font="${f.id}"
                            style="font-family:${f.stack};font-style:${f.style}" lang="ru">
                            <b>Аа</b><small>${f.label}</small>
                          </button>`
                      )
                      .join('')
                  )}
                </div>
              </div>`
          )
          .join('')
      )}
      <div class="sh-fontpanel-size">
        <span>حجم النصّ</span>
        <input type="range" class="sh-range" data-font-size
          min="80" max="180" step="5" value="${Math.round(ctx.fontSize * 100)}"
          aria-label="حجم النصّ" />
        <b data-font-size-label>${Math.round(ctx.fontSize * 100)}%</b>
      </div>
    </div>`;
}

function voiceOptions(voices, selected) {
  const group = (label, list) =>
    list.length
      ? html`<optgroup label="${label}">
          ${raw(
            list
              .map(
                (v) =>
                  html`<option value="${v.name}" ${v.name === selected ? 'selected' : ''}>
                    ${v.name}
                  </option>`
              )
              .join('')
          )}
        </optgroup>`
      : '';
  return group('🇷🇺 روسية', voices.russian) + group('🌐 أخرى', voices.others);
}

function lineHtml(segment, index, isCurrent) {
  const done = segment.repetitionsCompleted > 0;
  const classes = [
    'sh-line',
    isCurrent ? 'current' : '',
    done ? 'practiced' : '',
    segment.practiceStatus === 'difficult' ? 'difficult' : '',
    /* ✎ — الجملةُ دي ليها مسودّة مذاكرة (WS34) */
    hasDraftedText(segment.sourceTextSnapshot) ? 'has-draft' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return html`<button class="${classes}" data-line="${index}">
    <span class="sh-line-pick" data-pick-box aria-hidden="true"></span>
    <span class="n">${index + 1}</span>
    ${raw(
      // في جلسة المحادثة السطر بلا اسمٍ يفقد نصف معناه: أن تعرف مَن
      // يقول ماذا هو الفرق بين نصٍّ ومحادثة (بند 13).
      segment.speaker
        ? html`<span class="sh-line-spk ${segment.isMine ? 'mine' : ''}">${segment.speaker}</span>`
        : ''
    )}
    <span class="tx" data-line-text>${segment.sourceTextSnapshot}${raw(
      segment.translationSnapshot ? html`<span class="tr" hidden>${segment.translationSnapshot}</span>` : ''
    )}</span>
    <span class="meta">
      ${raw(done ? html`<span class="reps">×${segment.repetitionsCompleted}</span>` : '')}
      <span class="sh-line-draft" title="ليها مسودّة مذاكرة">✎</span>
      <span class="ts">${stamp(index)}</span>
      <span class="spk">🔊</span>
    </span>
  </button>`;
}

/**
 * طابع زمني تقديري لبداية الجملة.
 *
 * ⚠️ تقدير من طول النصّ لا قياس من صوت حقيقي — التطبيق ينطق بـ TTS
 *    فلا يوجد شريط صوتي تُقاس عليه المواضع. يُعرض ليساعدك على تقدير
 *    طول المقطع، ولا يُدّعى أنه دقيق.
 */
function stamp(index) {
  let seconds = 0;
  for (let i = 0; i < index; i++) {
    const words = (ctx.segments[i]?.sourceTextSnapshot || '').split(/\s+/).length;
    seconds += Math.max(2, Math.round(words * 0.55) + 1);
  }
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function staleBanner(change) {
  return html`
    <div class="sh-stale">
      <strong>المصدر اتغيّر بعد ما بدأت الجلسة دي.</strong><br />
      اتعملت من نسخة ${change.sessionVersion ?? '؟'} والحالي نسخة
      ${change.currentVersion ?? '؟'} (${change.currentSegmentCount} جملة).
      بنكمّل على اللي بتتدرّب عليه — مش هنبدّله من تحت إيدك.
    </div>`;
}

/* ------------------------------------------------------------------ *
 * الأحداث
 * ------------------------------------------------------------------ */

const $ = (sel) => document.querySelector(sel);

function handleEvent(event) {
  /*
   * ⚠️ **المحرّكُ المتروك لا يكتب في شاشةٍ ليست شاشتَه.**
   *
   * حين يكمل الصوتُ بعد مغادرتك، يبقى المحرّكُ حيًّا ويطلق أحداثَه.
   * وهذه الدالّة تكتب في `[data-text]` و`[data-card]` — فإن دخلتَ
   * جلسةً أخرى وجد عناصرَها فكتب فيها: جملةٌ تتبدّل وحدها، وإطارٌ
   * يضيء بلا سبب، و«التشغيل بيبوظ». وهو عطبٌ أدخلتُه أنا مع الشريط
   * العائم.
   *
   * فالمتروكُ يشتغل ولا يُخبر أحدًا — إلّا حين ينتهي، فيرفع شريطَه.
   */
  if (parked) {
    if (event.type === 'done' || event.type === 'stop' || event.type === 'session-complete') {
      return stopParked();
    }
    /*
     * ⚠️ **لكنّ الشريطَ العائم يتبع الحقيقة.** كان المتروكُ يشتغل ولا
     *    يُخبر أحدًا؛ فلو انتهى تكرارٌ أو أوقفتَ من الشريط بقي شكلُ
     *    الزرّ على حاله. والشريطُ هو كلُّ ما تراه حينها.
     */
    paintFloating();
    return undefined;
  }

  const card = $('[data-card]');
  const play = $('[data-sh="play"]');
  const status = $('[data-status]');

  /* شكلُ الزرّ يتبع الحقيقة بعد كلّ حدث — لا بعد النقر وحده. */
  queueMicrotask(paintTransport);

  switch (event.type) {
    /*
     * ⚠️ زرُّ التشغيل صار **شكلًا** لا حرفًا (WS24): مثلّثٌ يصير
     *    عمودين بالـCSS. فلا يُكتَب فيه نصٌّ يمحو الأيقونة — يُبدَّل
     *    صنفُه وحده.
     */
    case 'start':
    case 'resume':
      /*
       * ⚠️ **`is-live` هي ما يُشغّل شفافيّات §١٩٫٢.** قبل التشغيل
       *    الكلماتُ كلُّها `.94` — كتلةٌ واحدة تُقرأ. وحين ينطق تنقسم:
       *    الحاليّةُ `1`، وما مضى `.44`، وما بقي `.24`. فتصير الجملةُ
       *    خطًّا زمنيًّا. ولا يصحّ أن تُقسَّم وهي صامتة: ما معنى «مضى»
       *    قبل أن يبدأ شيء؟
       */
      document.querySelector('.shadow-app')?.classList.add('is-live');
      play?.classList.add('on');
      if (status) status.textContent = 'بيشتغل';
      break;

    case 'pause':
      play?.classList.remove('on');
      if (status) status.textContent = 'متوقّف';
      card?.classList.remove('speaking');
      break;

    case 'stop':
      document.querySelector('.shadow-app')?.classList.remove('is-live');
      play?.classList.remove('on');
      if (status) status.textContent = 'جاهز';
      card?.classList.remove('speaking');
      highlightWord(-1);
      break;

    case 'repeat': {
      const s = player.state.settings;
      const counting = s.repeatMode === REPEAT_MODE.COUNT;
      const counter = $('[data-counter]');
      const bar = $('[data-bar] > span');
      if (counter) counter.textContent = counting ? `${event.repetition} / ${s.repeatCount}` : `×${event.repetition}`;
      if (bar) bar.style.width = counting ? `${Math.min(100, (event.repetition / s.repeatCount) * 100)}%` : '100%';
      card?.classList.add('speaking');
      card?.classList.remove('your-turn');
      highlightWord(event.wordIndex);
      break;
    }

    case 'your-turn': {
      const card = $('[data-card]');
      card?.classList.add('your-turn');
      const status = $('[data-status]');
      if (status) status.textContent = 'دورك — قول!';
      break;
    }

    /*
     * الحالة تقول **مِن أين** يأتي الصوت الآن، لا «بيشتغل» وحدها.
     * وحين نطلب ناطقًا أصليًّا فلا نجده، نقول ذلك بدل أن نُسمِعك آليًّا
     * وأنت تحسبه بشريًّا (بند 89).
     */
    case 'source': {
      const status = $('[data-status]');
      if (status) {
        status.textContent =
          event.source === AUDIO_SOURCE.MINE ? 'بصوتك'
          : event.source === AUDIO_SOURCE.NATIVE
            ? `ناطق أصلي${event.speaker ? ` · ${event.speaker}` : ''}`
          : event.fallbackFrom === AUDIO_SOURCE.NATIVE ? 'آلي — مالقيناش تسجيل'
          : 'بيشتغل';
      }
      if (event.fallbackFrom === AUDIO_SOURCE.NATIVE) announceNativeMiss(event.reason);
      break;
    }

    case 'seek':
      $('[data-card]')?.classList.remove('your-turn');
      syncSegment();
      break;

    /*
     * ⚠️ لا تستدعِ `syncSegment` هنا.
     *    كانت تستدعيه، فتعيد بناء شرائح الكلمات، و`setWords` تصفّر
     *    الفهرس إلى صفر — فأيًّا كانت الكلمة التي تضغطها تُنطق الأولى.
     *    الاختيار لا يغيّر المقطع، فيكفي إبراز الكلمة.
     */
    case 'word-select':
      $('[data-card]')?.classList.remove('your-turn');
      highlightWord(event.wordIndex);
      // يجلب الكلمة الجارية لمرأى العين حين يمرّ المحرّك عليها وحده.
      document
        .querySelector(`[data-word="${event.wordIndex}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      break;

    case 'words-complete': {
      // مرّ على كلمات الجملة كلها — يعود العدّ للجملة لا للكلمة.
      const done = $('[data-counter]');
      if (done) done.textContent = '—';
      break;
    }

    case 'segment-complete':
      persistSegment(event);
      break;

    case 'session-complete':
      card?.classList.remove('speaking');
      finishSession();
      break;

    /* وصولٌ إلى الحافّة بالإصبع — لا إنهاءَ ولا نافذة. */
    case 'at-end':
      if (status) status.textContent = 'دي آخر جملة';
      break;

    default:
      break;
  }
}

/** يحدّث الصفحتين معًا عند تغيّر المقطع. */
function syncSegment() {
  if (!player || !ctx) return;

  const { index } = player.state;
  const segment = ctx.segments[index];
  if (!segment) return;

  syncMediaSession(segment);

  const textEl = $('[data-text]');
  const trEl = $('[data-tr]');

  if (textEl) {
    // النبر يحتاج HTML، وبدونه نكتب نصًّا خامًا فلا يمرّ شيء غير آمن.
    if (ctx.stress) {
      const marked = markSentence(segment.sourceTextSnapshot);
      textEl.innerHTML = marked.html;
    } else {
      textEl.textContent = segment.sourceTextSnapshot;
    }
    applyFont(textEl, ctx.font);
    textEl.classList.toggle('hidden-mode', ctx.display === DISPLAY.HIDDEN);
  }

  if (trEl) trEl.textContent = translationFor(segment);

  /*
   * ⚠️ **مقطعٌ خارجيٌّ يقول عن نفسه — لا يتظاهر أنه جملة الجلسة (بند
   *    17).** الشارةُ نفسُها التي كانت خاصّةً بالنصّ الخارجي وحده،
   *    الآن تُقرَأ هنا حيث تُقرَأ كلُّ حالةِ المقطع — لا في دالّةٍ
   *    ثانية.
   */
  const lbl = $('[data-current-lbl]');
  const count = $('.sh-count');
  if (lbl) {
    lbl.hidden = !segment.temporary;
    if (segment.temporary) lbl.textContent = '⚡ ذاكِرها دلوقتي';
  }
  if (count) count.hidden = Boolean(segment.temporary);

  /*
   * ⚠️ **حجمُ الخطّ يتبع طولَ الجملة.** الحجمُ الثابت يجعل جملةً من
   *    سطرين تحتاج 431px في مسرحٍ يعطيها 104 — فتفيض على ما تحتها.
   *    والدرجاتُ مقيسةٌ لا مُختارة، والشرحُ فوق `.sh-current-text`.
   */
  const chars = (segment.sourceTextSnapshot || '').length;
  const app = document.querySelector('.shadow-app');
  if (app) app.style.setProperty('--sh-len', chars > 150 ? '.62' : chars > 80 ? '.78' : '1');

  const pos = $('[data-pos]');
  if (pos) pos.textContent = index + 1;
  const counter = $('[data-counter]');
  if (counter) counter.textContent = '—';
  const bar = $('[data-bar] > span');
  if (bar) bar.style.width = '0%';

  document.querySelectorAll('[data-line]').forEach((node) => {
    const isCurrent = Number(node.dataset.line) === index;
    node.classList.toggle('current', isCurrent);
    if (isCurrent) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  /*
   * ⚠️ **الرقائق تُرسَم دائمًا** — كانت `if (!words.hidden)`.
   *
   * في التخطيط القديم كانت لوحةً تُفتح بزرّ، فيصحّ ألّا تُرسَم وهي
   * مطويّة. وفي v5 صارت **جزءًا من المسرح** تحت الجملة. فبقي الشرطُ
   * حارسًا لبابٍ لم يعد موجودًا: أوّلُ ضغطةٍ على الزرّ القديم تُخفيها،
   * ثم لا تُرسَم أبدًا — «الكلمات المقسّمة مش ظاهرة»، ولا تتبدّل مع
   * الجملة — «مفيش سلاسة في الانتقال».
   */
  renderWords();

  renderMarks(segment);
  /*
   * ⚠️ **والمسودّة تتبع الجملة.** لوحةٌ مفتوحةٌ على مسودّة جملةٍ
   *    غادرتَها منذ ثلاث جملٍ تعرض نصًّا يخصّ غيرَ ما أمامك — وهو
   *    أسوأُ من ألّا تُعرَض، لأنك ستكتب فيه.
   */
  /*
   * ⚠️ **والسكّة تتبع الجملة.** كلمةٌ اخترتَها في الجملة السابقة ليست
   *    أمامك الآن، فأدواتُها تختفي — و`renderRail` هي مَن يسأل
   *    `hasPickedWord` من جديد. بلا هذا السطر تبقى الأزرارُ معروضةً
   *    وهي تعمل على رقمٍ في جملةٍ غادرتَها.
   */
  rail.word = -1;
  renderRail();
  if (rail.open && rail.tool === 'draft') renderDraft().catch(() => {});
  savePosition(ctx.session.id, index).catch(() => {});
  // الترجمة الناقصة تُجلب في الخلفية إن فعّل المستخدم ذلك.
  fetchMissingTranslation(segment).catch(() => {});
}

/**
 * ترجمة المقطع حسب وضع العرض.
 *
 * ⚠️ لا تُجلب من الإنترنت. تُقرأ مما هو محفوظ في المقطع، والوضع
 *    المصري يقرّب الترجمة العربية من لهجتك بلا اختراع نصّ جديد.
 */
function translationFor(segment) {
  /*
   * ⚠️ **«روسي فقط» لم تكن تُخفي شيئًا.**
   *
   * الأوضاعُ الثلاثة تصف **ما تراه**: `ru` روسيٌّ بلا ترجمة، و`egy`
   * الاثنان، و`hidden` ترجمةٌ والروسيُّ مضبَّب لتستنتجه. وكانت هذه
   * الدالّة تقرأ `ctx.lang` (مصريّ/فصيح) ولا تقرأ `ctx.display`
   * إطلاقًا — فالترجمةُ تظهر في الأوضاع الثلاثة.
   *
   * ⚠️ **قِستُه**: بعد اختيار «روسي فقط» تبقى «هو هييجي بكرة» تحت
   *    الجملة. أي أن الزرَّ يستجيب ولا يفعل — وهو ما يجعلك تشكّ في
   *    الترجمة كلِّها.
   */
  if (ctx.display === DISPLAY.RU) return '';

  const stored = segment.translationSnapshot;
  if (!stored) return '';
  return ctx.lang === 'ams' ? toEgyptian(stored) : stored;
}

/**
 * يجلب ترجمة مفقودة من الإنترنت **إن فعّلها المستخدم**، ويحفظها في
 * المقطع فتصير جزءًا من بياناتك ولا تُطلب مرّة ثانية.
 */
async function fetchMissingTranslation(segment) {
  if (segment.translationSnapshot) return;
  const el = $('[data-tr]');
  if (el) el.textContent = '⟳ بنترجم…';

  const result = await translate(segment.sourceTextSnapshot, ctx.lang);
  if (!result) {
    /*
     * ⚠️ **الرسالةُ تُشير إلى مكانٍ لا يجده أحد.**
     *
     * بلاغُك: «هي فين الإعدادات اللي أشغّل منها الترجمة دي؟». وكانت
     * تقول «فعّل الترجمة من الإعدادات» — وفي التطبيق **ثلاثةُ أماكن**
     * تُسمّى إعدادات: شاشةُ الإعدادات، ودرجُ الجلسة، وسكّةُ الأدوات.
     * والزرُّ في الدرج.
     *
     * ورسالةٌ تصف طريقًا أضعفُ من زرٍّ يمشيه: فصارت **الرسالةُ هي
     * الزرّ**. ولا تُفعّلها بضغطةٍ صامتة — تفتح نفسَ نافذةِ الإقرار
     * التي تقول إن بياناتك ستخرج من جهازك.
     */
    /*
     * ⚠️ **والرسالةُ تقول أيَّ إخفاقٍ هذا** (WS35).
     *
     * بلاغُك: «ليه الترجمة الأونلاين معدتش شغّالة؟» — وكانت الشاشةُ
     * تقول شيئًا واحدًا في كلّ الحالات: «فعّلها». فمَن فعّلها بالفعل
     * ثم رأى نفسَ الرسالة يظنّ الزرَّ لا يعمل، والحقيقةُ أن الخدمة
     * لم تردّ. حالتان مختلفتان ونصٌّ واحد.
     */
    const why = translationFailure();
    if (el) {
      el.innerHTML = why && !why.includes('مطفيّة')
        ? `<span class="sh-tr-off">${esc(why)}</span>`
        : '<button class="sh-tr-off" data-sh="tr-on">'
          + 'مفيش ترجمة محفوظة للجملة دي — دوس هنا تفعّل الترجمة أونلاين</button>';
    }
    return;
  }

  /* ⚠️ مقطعٌ مؤقّتٌ (نصٌّ خارجيّ، WS40) لا صفَّ له يُحدَّث — تُحفَظ في الذاكرة فقط. */
  const updated = segment.temporary
    ? { ...segment, translationSnapshot: result }
    : await shadowSegments.update(segment.id, { translationSnapshot: result });
  const index = ctx.segments.findIndex((s) => s.id === segment.id);
  if (index >= 0) ctx.segments[index] = updated;
  if (el && player.state.index === index) el.textContent = translationFor(updated);
}

async function persistSegment(event) {
  if (!ctx) return;
  const segment = ctx.segments[event.index];
  if (!segment) return;

  try {
    const updated = await recordSegmentPractice(ctx.session, segment, event.repetitions, {
      speed: player.state.settings.rate,
    });
    ctx.segments[event.index] = updated;

    const node = document.querySelector(`[data-line="${event.index}"]`);
    if (node) {
      node.classList.add('practiced');
      const meta = node.querySelector('.meta');
      if (meta) meta.textContent = `×${updated.repetitionsCompleted}`;
    }
  } catch (error) {
    console.error('[shadow] تعذّر حفظ التكرارات', error);
  }
}

async function finishSession() {
  if (!ctx) return;
  const summary = await completeSession(ctx.session.id);
  if (!summary) return;

  /*
   * ⚠️ **ولا ملخّصَ لجلسةٍ لم تُمارَس.** رأيتُ النافذة تقول «اتدرّبت
   *    على ٠ من ٣ · إجمالي التكرارات ٠ · المدّة دقيقة» — وهي أرقامٌ
   *    صادقةٌ عن لا شيء. نافذةٌ تحتفل بالصفر تُعلّمك ألّا تقرأ
   *    النوافذ.
   *
   *    والاكتمالُ يُسجَّل في القاعدة على أيّ حال — ما يُمنَع هو
   *    **الاحتفالُ** به.
   */
  if (!summary.segmentsPracticed) return;

  const minutes = Math.max(1, Math.round(summary.durationMs / 60000));
  showModal({
    title: '✦ خلصت الجلسة',
    body: html`
      <div class="kv-row"><span class="k">جمل اتدرّبت عليها</span>
        <span class="v num">${summary.segmentsPracticed} من ${summary.segmentsTotal}</span></div>
      <div class="kv-row"><span class="k">إجمالي التكرارات</span>
        <span class="v num">${summary.totalRepetitions}</span></div>
      <div class="kv-row"><span class="k">جمل صعبة</span>
        <span class="v num">${summary.difficultSegments.length}</span></div>
      <div class="kv-row"><span class="k">السرعة</span>
        <span class="v num">${summary.speed}×</span></div>
      <div class="kv-row"><span class="k">المدّة</span>
        <span class="v num">${minutes} دقيقة</span></div>
      <p class="field-hint" style="margin-top:var(--sp-3)">
        الأرقام دي <strong>ممارسة</strong> — مش إتقان. الإتقان بيتسجّل لمّا
        تستخدم الجملة في موقف حقيقي.
      </p>`,
    actions: [{ label: 'تمام', value: null, variant: 'primary' }],
  });
}

/** علامات التعبيرات المحلَّلة داخل الجملة — خفيفة لا تقاطع. */
function renderMarks(segment) {
  const host = $('[data-marks]');
  if (!host) return;
  const found = expressionsIn(segment.sourceTextSnapshot);
  host.innerHTML = found
    .map((e) => `<button class="sh-mark" data-expr="${e.id}">✦ ${esc(e.text)}</button>`)
    .join('');
}

/** درج التحليل — يفتح ويغلق والجلسة كما هي. */
async function openAnalysisDrawer(expressionId) {
  const detail = await expressionDetail(expressionId);
  if (!detail) return;

  const wasPlaying = player.state.running && !player.state.paused;
  player.pause();

  await showModal({
    title: '✦ التعبير ده',
    body: html`
      <p dir="ltr" style="font-size:19px;line-height:1.7;margin-bottom:var(--sp-3)">
        ${detail.text}
      </p>
      ${raw(detail.meaningAr ? html`<div class="kv-row"><span class="k">بالمصري</span>
        <span class="v">${detail.meaningAr}</span></div>` : '')}
      ${raw(detail.literal ? html`<div class="kv-row"><span class="k">حرفيًا</span>
        <span class="v">${detail.literal}</span></div>` : '')}
      <div class="kv-row"><span class="k">السجلّ</span><span class="v">${detail.register || '—'}</span></div>
      <div class="kv-row"><span class="k">ظهر في</span>
        <span class="v num">${detail.sceneCount} مشهد · ${detail.occurrenceCount} مرة</span></div>
      ${raw(detail.explanation ? html`<p class="field-hint" style="margin-top:var(--sp-3)">
        ${detail.explanation}</p>` : '')}`,
    actions: [{ label: 'كمّل التدريب', value: null, variant: 'primary' }],
  });

  // نعيد التشغيل من حيث كان — الدرج لا يفقد الموضع.
  if (wasPlaying) player.resume();
}

/**
 * احكيها الآن — تسجّل نفسك وأنت تعيد السرد بلا قراءة.
 *
 * تُحفظ بدور `retelling` مرتبطة بالمشهد، فتصير دليلًا على أنك
 * استطعت إنتاج اللغة لا مجرّد تكرارها.
 */
async function tellItNow(button) {
  if (recorder) {
    const file = await recorder.stop();
    recorder = null;
    button.classList.remove('recording');
    button.innerHTML = '🗣 احكيها الآن';

    if (!ctx.session.sceneId) return toast('اتسجّل — بس الجلسة مش مربوطة بمشهد');

    await addFilesToScene(ctx.session.sceneId, [file], {
      kind: 'audio',
      roles: [AUDIO_ROLE.RETELLING],
    });
    return toastOk('اتحفظ في الذكرى كإعادة سرد');
  }

  if (!canRecord()) return toastError('المتصفح ده مش بيدعم التسجيل');

  const ok = await confirmAction({
    title: 'احكيها الآن',
    message:
      'اقفل عينك عن النصّ واحكي الموقف بالروسي من دماغك. ده اللي بيحوّل ' +
      'التكرار إلى كلام حقيقي — والتسجيل هيتحفظ في الذكرى.',
    confirmLabel: 'يلا',
  });
  if (!ok) return;

  try {
    player.pause();
    recorder = await startRecording();
    button.classList.add('recording');
    button.innerHTML = '⏹ خلصت';
  } catch {
    toastError('محتاج إذن الميكروفون');
  }
}

/**
 * رقائقُ الكلمات (WS24).
 *
 * ⚠️ كانت أزرارًا تظهر بالطلب وتختفي؛ وصارت **حاضرةً دائمًا تحت
 *    الجملة**، لكلٍّ شريطٌ يمتلئ وهي تُنطَق. والفرق ليس زينةً: الشريط
 *    يقول **أين أنت داخل الكلمة**، وهو ما يحتاجه من يظلّ نطقًا — أمّا
 *    زرٌّ يضيء ويطفئ فيقول «الآن» ولا يقول «كم بقي».
 *
 * ⚠️ **وضغطةٌ تسمع، وضغطةٌ مطوّلة تفتح الأدوات.** الفعلان على نفس
 *    الهدف عمدًا: السماع هو التسعون بالمئة، فيأخذ الضغطة القصيرة.
 */
function renderWords() {
  const host = $('[data-words]');
  if (!host) return;
  const segment = ctx.segments[player.state.index];
  const words = splitWords(segment.sourceTextSnapshot);
  player.setWords(words);
  /*
   * ⚠️ **بند 6: نبرٌ لكل رقاقةٍ لا للجملة الكاملة وحدها.**
   *
   * `markSentence` كانت تُطبَّق على الجملة الكاملة في `[data-text]`
   * فقط — والرقائقُ تحته (`splitWords` وحدها، بلا نبر) تعرض نصًّا
   * خامًا دائمًا. فمن يتتبّع الرقائقَ كلمةً كلمة لا يرى نبرًا إلا في
   * السطر الكبير فوقها، ويبدو كأن النبر «توقّف بعد أوّل جملة».
   * `markSentence` نفسُها — لا حسابٌ ثانٍ — تُستدعى هنا على كلّ كلمة.
   */
  host.innerHTML = words
    .map((w, i) => `<button class="sh-chip" data-word="${i}">
        <span class="sh-chip-w">${ctx.stress ? markSentence(w.display).html : esc(w.display)}</span>
        <span class="sh-chip-bar"><i></i></span>
      </button>`)
    .join('');
}

function highlightWord(wordIndex) {
  const host = $('[data-words]');
  if (!host) return;
  host.querySelectorAll('[data-word]').forEach((node, i) => {
    node.classList.toggle('speaking', i === wordIndex);
    /* وما مضى يبقى ممتلئًا: تقرأ من الشرائط كم قطعتَ من الجملة. */
    node.classList.toggle('past', wordIndex >= 0 && i < wordIndex);
  });
}

/* ================================================================== */
/* سكّة الأدوات الواعية بالسياق (WS24)                                 */
/* ================================================================== */

/**
 * ⚠️ **هذا هو جوابُ «الصفحات دوشة» في كتاب الظلّ.**
 *
 * كان التحكّم منثورًا: شريطٌ سريع، ودرجٌ للإعدادات، وأربعةُ تبويباتٍ
 * أسفل الشاشة، وستّةُ أزرارٍ في صفٍّ، ولوحةُ خطٍّ في الورقة. كلٌّ منها
 * صحيحٌ وحده، ومجموعُها هو الضجيج.
 *
 * فصار الكلُّ في **سكّةٍ واحدة على الحافّة**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وبلاغُك الثاني عنها: «محتواه محتاج ذكاء شوية في التجربة» (WS26)
 * ═══════════════════════════════════════════════════════════════
 *
 * وكان محقًّا. **قِستُ ثلاثةَ عيوبٍ في متصفّحٍ حقيقيّ**، وكلُّها من
 * أصلٍ واحد: السكّة كانت ثلاثَ قوائمَ منفصلةٍ يُنتقَل بينها بـ«سياق»
 * يُكتَب ولا يُمحى.
 *
 *  1. **بابٌ في اتّجاهٍ واحد.** ضغطةٌ مطوّلةٌ على كلمةٍ تكتب
 *     `rail.ctx = 'word'`، **ولا سطرَ في الملفّ كلِّه يعيدها**. فتضيع
 *     السرعةُ والتكرارُ والعرضُ و`PLAY MODE` **إلى آخر الجلسة**.
 *     قِستُها: فتحتُ، ضغطتُ مطوّلًا، ثم نططتُ لجملةٍ وأغلقتُ السكّةَ
 *     وفتحتُها — والقائمةُ ما زالت قائمةَ الكلمة.
 *
 *  2. **وأدواتُ كلمةٍ ليست أمامك.** السياق ينجو من الانتقال إلى جملةٍ
 *     أخرى، والكلمةُ رقمٌ في جملةٍ غادرتَها. فـ«اسمعها» تنطق الكلمةَ
 *     التي تحمل ذلك الرقمَ في الجملة الجديدة — وهذا أسوأُ من زرٍّ
 *     ميت: زرٌّ **يكذب**.
 *
 *  3. **وقائمةٌ ثالثةٌ لا طريقَ إليها.** `source` كانت معرَّفةً بثلاثة
 *     أزرار، ولا موضعَ في الكود يفتحها. كودٌ ميّتٌ يُقرأ كأنه ميزة.
 *
 * ═══════════════════════════════════════════════════════════════
 * فالسكّةُ صارت **قائمةً واحدةً تُشتَقّ من الحال**
 * ═══════════════════════════════════════════════════════════════
 *
 * لا «سياقَ» يُدخَل فيه ويُنسى الخروج. كلُّ أداةٍ تقول متى تصلح
 * (`when`)، والقائمةُ تُبنى في كلّ رسمٍ ممّا يصلح **الآن**. فأدواتُ
 * الكلمة تظهر حين تكون في يدك كلمة، وتختفي حين لا تكون — بلا زرِّ
 * رجوعٍ يُنسى الضغطُ عليه.
 *
 * ⚠️ **وكلُّ أداةٍ تقول قيمتَها على السكّة.** ثمانيةُ رموزٍ مجرّدة لا
 *    تخبرك بشيء: تفتح ثلاثَ لوحاتٍ لتعرف أنك على `1x` و`×3` وجملةٍ
 *    كاملة. فصار الرمزُ ومعه القيمة — تقرأ حالَ جلستك كلَّها بنظرة.
 *
 * ⚠️ **والسِّجلّ سطرٌ لكلّ أداة.** أداةٌ تُضاف غدًا سطرٌ في `TOOLS`
 *    وفرعٌ في `panelFor` — ولا تُلمَس السكّةُ ولا الشاشة. وهو نفسُ
 *    نمط `ASPECTS` و`SCOPES` و`PROMPTS` و`WELLS` في المشروع.
 */
const TOOLS = [
  /* ---- أدواتُ الكلمة: أوّلًا حين تكون في يدك كلمة ---- */
  { id: 'hear', glyph: '♪', label: 'اسمعها', when: hasPickedWord },
  { id: 'save', glyph: '✦', label: 'احفظها', when: hasPickedWord },
  { id: 'hard', glyph: '△', label: 'صعبة', when: hasPickedWord },
  { id: 'meaning', glyph: '⌥', label: 'معناها', when: hasPickedWord },

  /* ---- أدواتُ المسرح: دائمًا ---- */
  { id: 'display', glyph: '◐', label: 'العرض', value: () => DISPLAY_SHORT[ctx.display] || '' },
  { id: 'text', glyph: 'Aa', label: 'الخطّ', value: () => `${ctx.sizePx || DEFAULT_SIZE_PX}px` },
  { id: 'speed', glyph: '▹', label: 'السرعة', value: () => `${ctx.session?.speed ?? 1}x` },
  { id: 'repeat', glyph: '↻', label: 'التكرار', value: () => `×${ctx.session?.repeatCount ?? 1}` },
  { id: 'voice', glyph: '◈', label: 'الصوت',
    value: () => AUDIO_SHORT[ctx.audioSource] || 'آليّ' },
  { id: 'mode', glyph: '⊞', label: 'PLAY MODE',
    value: () => MODE_SHORT[player?.state?.settings?.practiceMode] || 'جملة' },
  /*
   * ⚠️ والقيمةُ تقول إن للجملة الجارية مسودّةً — فلا تُفتَح اللوحةُ لتسأل.
   *    وعلى **الجملة** وحدها: `drafted` مجموعةُ جملٍ، وسؤالُها عن كلمةٍ
   *    مختارةٍ يعطي «لا» دائمًا فيبدو كأن مسودّةَ الكلمة ضاعت.
   */
  { id: 'draft', glyph: '✎', label: 'مسودّة مذاكرة',
    value: () => (hasDraftedText(currentSentenceText()) ? 'فيها' : '') },
  { id: 'sky', glyph: '✧', label: 'الخلفيّة' },
];

/**
 * ما لا يُوضَع في السكّة — **بسببٍ مكتوب**.
 *
 * ⚠️ وهذه ليست قائمةَ إهمال: `doc-fit` وأختاها كنّ في السكّة بلا
 *    طريقٍ إليهنّ، وهنّ **موجوداتٌ مرّتين أصلًا** في الورقة — في
 *    `.sh-pgbtns` أعلى المستند وفي `.sh-docsplit` تحته. فنسخةٌ ثالثةٌ
 *    في السكّة زحمةٌ لا ميزة، وإزالتُها إزالةٌ لا نقص.
 *
 * @type {Record<string, string>}
 */
const NOT_IN_RAIL = Object.freeze({
  'doc-fit': 'موجودة مرّتين في الورقة نفسها: فوق المستند وفي مقبض تقسيمه — والسكّة لا تكرّر',
  'doc-full': 'موجودة مرّتين في الورقة نفسها: فوق المستند وفي مقبض تقسيمه — والسكّة لا تكرّر',
  'doc-none': 'موجودة مرّتين في الورقة نفسها: فوق المستند وفي مقبض تقسيمه — والسكّة لا تكرّر',
});

/** اختصاراتٌ تُقرأ على السكّة — لا تسع اللافتةَ كاملةً. */
const DISPLAY_SHORT = { ru: 'روسي', egy: 'مصري', hidden: 'مخفي' };
const MODE_SHORT = { sentence: 'جملة', word: 'كلمة', continuous: 'متّصل' };

/** حالةُ السكّة — خارج الـDOM كباقي حالات هذه الشاشة. */
const rail = { open: false, tool: 'display', word: -1 };

/**
 * هل في يدك كلمة؟
 *
 * ⚠️ **والسؤالُ عن الـDOM لا عن الرقم.** `rail.word = 3` تبقى ٣ بعد
 *    الانتقال إلى جملةٍ أقصر ليس فيها كلمةٌ ثالثة. فالشرطُ أن تكون
 *    الرقاقةُ **موجودةً الآن** — وهو ما يجعل الأدوات تختفي وحدَها
 *    حين تنتقل، بلا سطرٍ يتذكّر أن يمسح.
 */
function hasPickedWord() {
  return rail.word >= 0 && Boolean(document.querySelectorAll('[data-word]')[rail.word]);
}

/**
 * محتوى اللوحة لكل أداة.
 *
 * ⚠️ **ولا يُخترَع تحكّمٌ جديد هنا.** كل زرٍّ ينادي ما كان يعمل أمس:
 *    `setTuner` و`ctx.display` و`applyFonts`… فالسكّة **بابٌ** لا
 *    محرّك، والوظيفةُ لم تُنقَل بل جُمِعَت.
 */
/** يقول كم كلمةً في الجملة الجارية نعرف نبرها — وما العملُ في الباقي. */
function stressFoot() {
  const text = currentSentenceText();
  if (!text) return 'يغيّر ما تراه لا ما يُنطَق';
  const { known, total } = markSentence(text);
  if (!total) return 'يغيّر ما تراه لا ما يُنطَق';
  if (known === total) return `النبر معروف لكلّ الـ${total} كلمة`;
  return `النبر معروف لـ${known} من ${total} كلمة — الباقي بلا علامة عشان مانخمّنش غلط`;
}

function panelFor(id) {
  const s = ctx.session;
  const on = (a, b) => (a === b ? ' on' : '');
  const pick = (act, val, text, isOn) =>
    `<button data-sh="${act}" data-v="${val}" class="${isOn ? 'on' : ''}">${esc(text)}</button>`;

  if (id === 'display') {
    return {
      title: 'العرض',
      /*
       * ⚠️ **بلاغُك: «ليه النبر (ударение) مش ظاهر؟»**
       *
       * وهو ظاهرٌ — على ما يعرفه القاموسُ المحلّيّ وحده. والقاعدةُ
       * مكتوبةٌ في `stress.js` منذ نقلها: «الكلماتُ غير الموجودة تُترَك
       * بلا علامة بدل تخمين موضعٍ خاطئ — التخمينُ هنا أسوأُ من الصمت».
       * والقاعدةُ صحيحة، **والصمتُ عنها ليس صحيحًا**: أنت ترى جملةً بلا
       * علامةٍ واحدة فتظنّ الميزةَ معطّلة، وهي تعمل ولا تعرف كلماتِك.
       *
       * فصار العددُ مكتوبًا: «٣ من ٧ كلمات نعرف نبرها». `markSentence`
       * كانت تُرجع `known` و`total` من أوّل يوم — ولم يقرأهما أحد.
       */
      foot: stressFoot(),
      groups: [
        { title: 'الترجمة', items:
          `${pick('disp', 'ru', 'روسي فقط', ctx.display === DISPLAY.RU)}
           ${pick('disp', 'egy', 'مصري', ctx.display === DISPLAY.EGY)}
           ${pick('disp', 'hidden', 'مخفي', ctx.display === DISPLAY.HIDDEN)}` },
        { title: 'النبر', items:
          `${pick('stress', '1', 'ظاهر', Boolean(ctx.stress))}
           ${pick('stress', '0', 'مخفي', !ctx.stress)}` },
      ],
    };
  }
  if (id === 'text') {
    return {
      title: 'الخطّ',
      foot: 'يخصّ النصّ الروسي وحده',
      /*
       * ⚠️ **بلاغُك: «خلّي إمكانية تصغير الخطّ أكتر من كده، ويكون ده
       *    الافتراضيّ».** كان أصغرُ ما يمكن 36px وهو كبيرٌ لجملةٍ
       *    طويلة، والافتراضُ 41. فنزل السلّمُ إلى 24 وصار الافتراضُ
       *    30 — ومَن اختار حجمًا يبقى عليه، فالافتراضُ لا يدهس اختيارًا.
       */
      groups: [{ title: 'SENTENCE SIZE', items:
        [['24', 'XS'], ['30', 'S'], ['36', 'M'], ['41', 'L'], ['48', 'XL']].map(([px, label]) =>
          pick('fsize', px, label, Number(ctx.sizePx || DEFAULT_SIZE_PX) === Number(px))).join('') },
      ],
      after: fontPanelBody(),
    };
  }
  if (id === 'speed') {
    return {
      title: 'السرعة',
      foot: 'طبقةُ الصوت لا تتغيّر',
      groups: [{ title: 'سرعة القراءة', items:
        [0.5, 0.75, 0.85, 1, 1.25].map((v) =>
          pick('tune', `speed:${v}`, `${v}x`, Number(s.speed) === v)).join('') }],
    };
  }
  if (id === 'repeat') {
    return {
      title: 'التكرار',
      foot: 'يخصّ الجملة الجارية',
      groups: [
        { title: 'كم مرّة', items: [1, 2, 3, 5, 7].map((v) =>
          pick('tune', `repeat:${v}`, `×${v}`, Number(s.repeatCount) === v)).join('') },
        { title: 'الوقفة بينها', items: [0, 500, 1000, 2000].map((v) =>
          pick('tune', `pause:${v}`, v ? `${v / 1000}ث` : 'بلا', Number(s.intervalMs) === v)).join('') },
      ],
    };
  }
  if (id === 'voice') {
    return {
      title: 'الصوت',
      /*
       * ⚠️ **وهنا مكانُ «مفيش صوت روسي»** بعد أن رُفعت لافتتُها من
       *    المسرح (WS36). المعلومةُ صحيحةٌ ونادرة، فتُقال حيث تُسأل —
       *    في لوحة الصوت — لا في لوحةٍ تحجز رُبعَ الشاشة دائمًا لمن
       *    لا يعنيه الأمر.
       */
      foot: (() => {
        if (!ctx.voices?.russian?.length) {
          return 'مفيش صوت روسي على الجهاز — نزّله من إعدادات الجهاز ← تحويل النصّ لكلام';
        }
        return ctx.humanAudioUrl ? 'تسجيلُك مربوطٌ بهذا المصدر' : 'أصواتُ جهازك — لا شيء يُحمَّل';
      })(),
      /*
       * ⚠️ **تُرسَم من السجلّ لا بأسمائها.**
       *
       * كنتُ أكتب خيارين بيدي: `آليّ` و`أصليّ`. و`audioChoices()` —
       * وهي المرجع — تعرف **ثلاثة**، وتضيف «تسجيلي» حين يكون هناك
       * تسجيلٌ مربوطٌ بالمصدر. فكان التسجيلُ البشريُّ يُقرأ من
       * القاعدة، ويُحسَب في `humanAudioUrl`، ويصله المحرّكُ — **ولا
       * زرَّ يختاره**. بلاغُك: «الصوت البشري مش شغّال».
       *
       * ⚠️ **قِستُه**: تسجيلٌ مربوطٌ بـ`audio:script` وبلوبه موجود،
       *    ولوحةُ الصوت تعرض `["tts","native"]` فقط.
       *
       * وهذا ثالثُ عطلٍ في هذه السلسلة من نفس النوع: **قائمةٌ
       * مكتوبةٌ بيدٍ بجانب سجلٍّ يعرف أكثر منها.** فالقاعدة: مَن له
       * سجلٌّ يُرسَم منه.
       */
      groups: [{ title: 'المصدر', items:
        audioChoices().map((id) =>
          pick('audio-src', id, AUDIO_SHORT[id] || id, ctx.audioSource === id)).join('') }],
      after: `<div class="sh-pgroup"><span>صوت الجهاز</span>${voiceOptions(ctx.voices, s.voiceURI)}</div>`,
    };
  }
  if (id === 'mode') {
    /*
     * ⚠️ **الفرقُ بين قراءة الجملة وقراءة الكلمة كان موجودًا ومخفيًّا.**
     *
     * المحرّك يعرف `PRACTICE_MODE` منذ اليوم الأوّل — جملةً وكلمةً
     * ومتّصلًا — ولم يكن له زرّ. فكان الوضعُ يتبدّل ضمنًا حين تضغط
     * كلمةً، ولا تعرف أنت في أيّهما أنت. وهذا هو «مفيش تناسق».
     *
     * فصار وضعًا **مُعلَنًا تختاره**، ويقول أيُّه مُختار.
     */
    const now = player?.state?.settings?.practiceMode || PRACTICE_MODE.SENTENCE;
    return {
      title: 'PLAY MODE',
      foot: 'الوضعُ يقرّر ما يتكرّر: الجملة أم الكلمة',
      groups: [{ title: 'ما الذي يُقرأ', items:
        `${pick('mode-set', PRACTICE_MODE.SENTENCE, 'جملة كاملة', now === PRACTICE_MODE.SENTENCE)}
         ${pick('mode-set', PRACTICE_MODE.WORD, 'كلمة كلمة', now === PRACTICE_MODE.WORD)}
         ${pick('mode-set', PRACTICE_MODE.CONTINUOUS, 'متّصل بلا تكرار', now === PRACTICE_MODE.CONTINUOUS)}` }],
    };
  }
  if (id === 'sky') {
    /*
     * ⚠️ **الخلفيّةُ صورتُك أنت، لا صورةٌ في المستودع.**
     *
     * النموذجُ يضع `cosmos.png` ملفًّا في الحزمة. وضمُّ صورةٍ بحجم
     * فضاءٍ حقيقيّ إلى تطبيقٍ يُحمَّل على الهاتف ثمنٌ يدفعه كلُّ فتحةٍ
     * بلا أن يختار أحد. فالصورةُ تُرفَع من جهازك مرّةً وتُخزَّن في
     * القاعدة — تعمل بلا شبكة، وتغيّرها متى شئت، ولا تثقل الحزمة.
     */
    return {
      title: 'الخلفيّة',
      foot: 'الصورة تُخزَّن على جهازك — بلا إنترنت',
      groups: [{ title: 'سماء الجلسة', items:
        `<button data-sh="sky-pick">ارفع صورة…</button>
         ${ctx.sky ? '<button data-sh="sky-clear">رجّع النجوم</button>' : ''}` }],
    };
  }
  if (id === 'draft') {
    /*
     * ⚠️ **قشرةٌ الآن، ومحتوًى بعد قراءة.** `panelFor` متزامنة —
     *    وكلُّ أدواتها تقرأ من `ctx` الحاضر. والمسودّة في القاعدة.
     *    فتُرسَم القشرةُ فورًا (فلا تفتح اللوحةُ على بياض) ويملؤها
     *    `renderDraft()` حين تصل. راجعه تحت.
     */
    const subject = draftSubject();
    return {
      title: 'مسودّة مذاكرة',
      foot: subject.kind === SUBJECT.WORD ? 'مسودّة الكلمة دي' : 'مسودّة الجملة دي',
      groups: [],
      after: '<div class="sh-draft" data-draft>بنجيبها…</div>',
    };
  }
  if (id === 'meaning') {
    const w = currentWordText();
    return {
      title: w || 'كلمة',
      foot: 'المعنى يُقرأ من تعبيراتك ومحفوظاتك',
      groups: [{ title: 'ابحث عنها', items:
        `<button data-sh="word-go" data-v="${esc(w)}">افتح صفحة الكلمة</button>` }],
    };
  }
  return { title: 'الأدوات', foot: '', groups: [] };
}

/**
 * يضبط مصدرَ الصوت: الشاشةُ والمحرّكُ والقاعدة معًا.
 *
 * ⚠️ **والموافقةُ قبل «الأصليّ»** — لا نُفعّل ما لم يُوافَق عليه.
 */
async function setAudioSource(next) {
  if (!audioChoices().includes(next)) return undefined;

  if (next === AUDIO_SOURCE.NATIVE && !ctx.nativeConsent.enabled) {
    const granted = await askNativeConsent();
    if (!granted) return undefined;
  }

  ctx.audioSource = next;
  player.updateSettings({ audioSource: next });

  document.querySelectorAll('[data-sh="audio-source"]').forEach((node) => {
    node.classList.toggle('on', next !== AUDIO_SOURCE.TTS);
    node.textContent = AUDIO_LABEL[next];
  });

  toastOk(next === AUDIO_SOURCE.MINE ? 'هيشغّل تسجيلك'
    : next === AUDIO_SOURCE.NATIVE ? 'للكلمات المفردة بس — الجملة هتفضل آلية'
    : 'هينطق آليًا');

  renderRail();
  return saveSessionSettings(ctx.session.id, { audioSource: next }).catch(() => {});
}

/** نصُّ الكلمة المختارة — أو فراغ. */
function currentWordText() {
  const node = document.querySelectorAll('[data-word]')[rail.word];
  return node ? node.textContent.trim() : '';
}

/** جسمُ لوحة الخطّ — يُعاد استعمالُه داخل اللوحة بدل لوحةٍ ثانية. */
function fontPanelBody() {
  return `<div class="sh-pgroup"><span>شكل الحروف</span>
    <div class="sh-pitems">${FONTS.map((f) => `
      <button data-sh="font-pick" data-font="${f.id}" class="${ctx.font === f.id ? 'on' : ''}"
              style="font-family:${f.stack};font-style:${f.style}" lang="ru">${esc(f.label)}</button>`).join('')}
    </div></div>`;
}

/** يرسم السكّة واللوحة من السجلّ — لا من شرطٍ متفرّق. */
function renderRail() {
  const app = document.querySelector('.shadow-app');
  const tools = $('[data-rail-tools]');
  const ctxLbl = $('[data-rail-ctx]');
  if (!app || !tools) return;

  app.classList.toggle('is-rail', rail.open);

  /* القائمةُ تُشتَقّ من الحال في كلّ رسم — لا «سياقَ» يُدخَل ويُنسى. */
  const set = TOOLS.filter((tool) => !tool.when || tool.when());

  /*
   * ⚠️ **واللافتةُ تقول على أيّ كلمةٍ أنت** — لا «كلمة» مجرّدة. كانت
   *    تقول اسمَ السياق وحده، وهو خبرٌ تعرفه من الأزرار نفسها.
   */
  if (ctxLbl) ctxLbl.textContent = hasPickedWord() ? currentWordText() : 'الظلّ';

  /*
   * ⚠️ **وأداةٌ اختفت لا تبقى لوحتُها مفتوحة.** تضغط «معناها» على
   *    كلمة، ثم تنتقل لجملةٍ أخرى فتختفي أدواتُ الكلمة — واللوحةُ
   *    كانت ستبقى تعرض كلمةً لم تعد أمامك. فالرجوعُ إلى أوّل ما يصلح.
   *    ويقع **قبل** رسم الأزرار ليصحّ وسمُ `on` من أوّل مرّة.
   */
  if (!set.some((tool) => tool.id === rail.tool)) {
    rail.tool = set[0]?.id || 'display';
  }

  tools.innerHTML = set.map((t) => {
    const value = t.value?.() || '';
    return `
    <button data-sh="tool" data-v="${t.id}" title="${esc(t.label)}"
            aria-label="${esc(t.label)}${value ? ` — ${esc(value)}` : ''}"
            class="${rail.open && rail.tool === t.id ? 'on' : ''}">
      <b>${t.glyph}</b>${value ? `<i>${esc(value)}</i>` : ''}
    </button>`;
  }).join('');

  const toggle = $('.sh-rail-toggle');
  if (toggle) toggle.textContent = rail.open ? '›' : '‹';

  if (!rail.open) return;
  const def = panelFor(rail.tool);
  const title = $('[data-panel-title]');
  const body = $('[data-panel-body]');
  const foot = $('[data-panel-foot]');
  if (title) title.textContent = def.title;
  if (foot) foot.textContent = def.foot || '';
  if (body) {
    body.innerHTML = def.groups.map((g) => `
      <div class="sh-pgroup"><span>${esc(g.title)}</span>
        <div class="sh-pitems">${g.items}</div></div>`).join('') + (def.after || '');
  }

  /* ⚠️ محتوًى من القاعدة يأتي بعد القشرة — ولا يُنتظَر هنا، فالرسمُ
        متزامنٌ ولا يجوز أن تتأخّر السكّةُ كلُّها على قراءة. */
  if (rail.tool === 'draft') renderDraft().catch(() => {});
}

/** يفتح السكّة على أداةٍ بعينها، أو يغلقها إن كانت مفتوحةً عليها. */
function pickTool(id) {
  /* أفعالٌ فوريّة لا لوحةَ لها: تُنفَّذ وتُغلق. */
  if (id === 'hear') { if (rail.word >= 0) player.selectWord(rail.word); rail.open = false; return renderRail(); }
  if (id === 'save') { document.querySelector('[data-sh="save-item"]')?.click(); rail.open = false; return renderRail(); }
  if (id === 'hard') { document.querySelector('[data-sh="difficult"]')?.click(); rail.open = false; return renderRail(); }

  rail.open = !(rail.open && rail.tool === id);
  rail.tool = id;
  renderRail();
}

/**
 * سماءُ الجلسة — صورةٌ رفعتَها أنت، أو النجومُ المرسومة.
 *
 * ⚠️ ورابطُ الكائن يُحرَّر عند التبديل: كلُّ `createObjectURL` بلا
 *    `revoke` يحجز الصورةَ في الذاكرة إلى أن تُغلق التبويب.
 */
const SKY_KEY = 'shadow.sky';
let skyUrl = null;

async function applySky() {
  const app = document.querySelector('.shadow-app');
  if (skyUrl) { URL.revokeObjectURL(skyUrl); skyUrl = null; }

  const blob = await settings.get(SKY_KEY, null).catch(() => null);
  if (ctx) ctx.sky = Boolean(blob);
  if (!app) return;

  if (!blob) {
    app.style.removeProperty('--sky');
    app.classList.remove('has-sky');
    return;
  }
  skyUrl = URL.createObjectURL(blob);
  app.style.setProperty('--sky', `url("${skyUrl}")`);
  app.classList.add('has-sky');
}

/* ================================================================== */
/* الأوضاع الثلاثة — «إيه اللي بيتقرا» على الشاشة لا في لوحة (WS28)    */
/* ================================================================== */

/**
 * ⚠️ **طلبُك بحرفه**: «عايز يبقى على الشاشة صراحةً تنقّل من مود
 *    الكلمة لمود جملة لمود نصّ. الكلمة دي هقرا الكلمات المقسّمة،
 *    والجملة لو جملة خارجية، والنصّ لو هيكمّل قراءة الجمل اللي
 *    متقسّمة من النصّ».
 *
 * ═══════════════════════════════════════════════════════════════
 * وثلاثةُ أشياء كانت موجودةً ومتفرّقة
 * ═══════════════════════════════════════════════════════════════
 *
 *  · قراءةُ الجمل — زرُّ التشغيل، وهو الوضع الضِّمنيّ.
 *  · قراءةُ الكلمات — `PRACTICE_MODE.WORD`، مدفونٌ في لوحةِ سكّة.
 *  · الجملةُ الخارجيّة — صندوقُ `scratch`، يُفتَح من زرٍّ في القاع.
 *
 * ثلاثةُ أشياءَ من جنسٍ واحد — **ما الذي يُقرأ الآن** — وثلاثةُ
 * أمكنةٍ لا يجمعها شيء، ولا واحدٌ منها يقول لك في أيّها أنت. وهذا
 * أصلُ «مفيش تناسق» الذي بلّغتَ عنه أكثر من مرّة.
 *
 * فصارت **مفتاحًا واحدًا ظاهرًا فوق زرّ التشغيل**: تقرأ منه أين أنت
 * وتنتقل بضغطة.
 *
 * ⚠️ **وسجلٌّ لا شروطٌ متفرّقة.** وضعٌ رابعٌ يُضاف غدًا (وضعُ «دوري»
 *    في المحادثات مثلًا) سطرٌ هنا بـ`enter` و`is` — ولا يُلمَس الرسمُ
 *    ولا المفتاحُ ولا الشاشة. نفسُ نمط `WELLS` و`TOOLS` و`PLACES`.
 *
 * ⚠️ **وكلُّ وضعٍ يُخرج من الآخر صراحةً.** أوّلُ ما جرّبتُه كان
 *    يدخل «كلمة» ويترك صندوقَ الجملة الخارجيّة مفتوحًا تحته، فيصير
 *    زرُّ التشغيل يقرأ نصًّا لا علاقةَ له بالكلمات المعروضة. الدخولُ
 *    الذي لا يُنهي ما قبله هو بالضبط ما كسر وضعَ الكلمة قبل WS27.
 */
const MODES = [
  {
    id: 'text',
    label: 'نصّ',
    hint: 'يمشي في جمل المصدر واحدة ورا التانية',
    /** هل نحن فيه الآن؟ */
    is: () => !hasExternalSegment()
      && player?.state?.settings?.practiceMode !== PRACTICE_MODE.WORD,
    enter: async () => setPractice(PRACTICE_MODE.SENTENCE),
    paint: () => exitExternalText(),
  },
  {
    id: 'word',
    label: 'كلمة',
    hint: 'يقرا الكلمات المقسّمة واحدة واحدة',
    is: () => !hasExternalSegment()
      && player?.state?.settings?.practiceMode === PRACTICE_MODE.WORD,
    enter: async () => setPractice(PRACTICE_MODE.WORD),
    paint: () => exitExternalText(),
  },
  {
    id: 'own',
    label: 'جملة برّه',
    hint: 'الصق جملة من عندك وتتقرا بنفس الإعدادات',
    is: () => hasExternalSegment() || !$('[data-scratch]')?.hidden,
    /* الخروجُ من وضع الكلمة أوّلًا — وإلّا نطق كلمةً من جملةٍ غادرتها. */
    enter: async () => setPractice(PRACTICE_MODE.SENTENCE),
    paint: () => {
      const box = $('[data-scratch]');
      if (!box) return;
      box.hidden = false;
      box.querySelector('[data-scratch-input]')?.focus();
    },
  },
];

/**
 * تذكرةُ تبديل الوضع — تمنع تسابقَ الضغطات.
 * الشرحُ عند `case 'mode-go'`.
 */
let modeTicket = 0;

/** يضبط وضعَ المحرّك ويحفظه — مكانٌ واحدٌ يكتب `practiceMode`. */
async function setPractice(mode) {
  player.updateSettings({ practiceMode: mode });
  document.querySelector('.shadow-app')
    ?.classList.toggle('is-wordmode', mode === PRACTICE_MODE.WORD);
  await saveSessionSettings(ctx.session.id, { practiceMode: mode }).catch(() => {});
}

/** يرسم المفتاح من السجلّ — والمُختارُ يُعرَف من الحال لا من متغيّر. */
function renderModes() {
  const host = $('[data-modes]');
  if (!host || !ctx) return;
  const active = MODES.find((mode) => mode.is()) || MODES[0];
  host.innerHTML = MODES.map((mode) => `
    <button data-sh="mode-go" data-v="${mode.id}" role="tab"
            aria-selected="${mode === active}" title="${esc(mode.hint)}"
            class="${mode === active ? 'on' : ''}">${esc(mode.label)}</button>`).join('');
  const foot = $('[data-modes-hint]');
  if (foot) foot.textContent = active.hint;
}

/* ================================================================== */
/* مسودّة المذاكرة — الحلقة تُقفَل داخل الظلّ (WS25)                    */
/* ================================================================== */

/**
 * ⚠️ **طلبُك**: «الجملة باخدها أدخّلها على شات جيبتي يحلّلهالي — عايز
 *    نتيجة التحليل يبقى فيها حاجة زي مسودة مذاكرة أضيف فيها الحاجات
 *    دي، ويبقى فيه القدرة إني أعمل على جزء منها شادوينج، وممكن أضيف
 *    صورة وأستخرج نصّها».
 *
 * والحلقةُ التي كنتَ تدور فيها: تنسخ الجملة يدويًّا، تخرج، تحلّل،
 * تعود — ولا مكانَ يحفظ ما عدتَ به. فكانت النتيجةُ تعيش في نافذة
 * ChatGPT وحدها، وتضيع بإغلاقها.
 *
 * فصارت الحلقةُ مقفولةً هنا بأربع خطوات في لوحةٍ واحدة:
 *   ١. **انسخ** — الجملةُ إلى الحافظة بضغطة (وهي أوّلُ الخطوات وكانت
 *      أشقَّها: تحديدُ نصٍّ بإصبعك على لوح).
 *   ٢. **الصق** — صندوقٌ يحفظ وأنت تكتب.
 *   ٣. **صورة** — تُضاف، ويُستخرَج نصُّها فيُلحَق بما تحته لا فوقه.
 *   ٤. **تدرّب** — جملُ المسودّة تُقسَّم، وتختار منها ما تشاء.
 *
 * ⚠️ **ولا شبكةَ ولا مفتاح.** التطبيق لا يكلّم ChatGPT ولا يحمل مفتاحه
 *    — أنت مَن يذهب ويعود. راجع `services/study-draft.js`.
 */

/** موضوعُ المسودّة الآن: الكلمةُ المختارة إن كانت، وإلّا الجملةُ الجارية. */
function draftSubject() {
  const word = hasPickedWord() ? currentWordText() : '';
  if (word) return { kind: SUBJECT.WORD, text: word };
  /*
   * ⚠️ **الموضعُ عند المحرّك لا عند `ctx`.** كتبتُها أوّلَ مرّةٍ
   *    `ctx.index` — وهو حقلٌ لا وجودَ له، فكانت اللوحةُ تفتح على
   *    «مفيش جملة مختارة» **دائمًا**، والاختباراتُ الـ915 كلُّها
   *    خضراء. ما أمسكها إلا الضغطُ على الزرّ في متصفّحٍ حقيقيّ.
   */
  const seg = ctx.segments?.[player?.state?.index ?? 0];
  return { kind: SUBJECT.SENTENCE, text: seg?.sourceTextSnapshot || '' };
}

/** المسودّةُ المعروضة الآن — تُمسَك لتعرف الأزرارُ على ماذا تعمل. */
let openDraftId = null;

/**
 * مفاتيحُ الجمل التي لها مسودّة — أثرُ عملك ظاهرًا على السطر (WS34).
 *
 * ⚠️ **تُقرأ مرّةً عند الفتح وتُحدَّث عند الكتابة** لا عند كل رسم:
 *    الرسمُ يحدث مع كل جملةٍ تمرّ، وسؤالُ القاعدة فيه يجعل التنقّلَ
 *    ثقيلًا بلا سبب.
 */
let drafted = new Set();

/**
 * يقرأ «مَن له مسودّة» — **بلا لمس الشاشة**.
 *
 * ⚠️ منفصلةٌ عن الرسم عمدًا: تُنادى مرّةً **قبل** أن تُرسَم السطور
 *    (فتولد عليها العلامة) ومرّةً بعد الحفظ (فتُنعَش). ودالّةٌ واحدة
 *    تفعل الاثنين تلمس DOM لم يُبنَ بعد.
 */
async function readDrafted() {
  if (!ctx?.segments) return;
  try {
    drafted = await draftedKeys(
      SUBJECT.SENTENCE,
      ctx.segments.map((s) => s.sourceTextSnapshot || '')
    );
  } catch {
    /* غيابُ العلامة أهونُ من سقوط الشاشة */
  }
}

/** يعيد القراءة ثم يُنعش السطور — بلا إعادة رسم اللوحة. */
async function refreshDrafted() {
  if (!ctx?.segments) return;
  await readDrafted();
  for (const el of document.querySelectorAll('[data-line]')) {
    const seg = ctx.segments[Number(el.dataset.line)];
    el.classList.toggle('has-draft', hasDraftedText(seg?.sourceTextSnapshot));
  }
  paintToolValue('draft');
}

/**
 * يُحدّث قيمةَ أداةٍ واحدةٍ في السكّة — **بلا إعادة رسم اللوحة**.
 *
 * ⚠️ ناديتُ `renderRail()` أوّلَ مرّة، وهي تعيد بناء جسم اللوحة كلِّه.
 *    فكانت تُمسح `[data-draft-state]` بعد سطرٍ من كتابة «اتحفظت» —
 *    **قِستُه**: النصُّ المقروء بعدها `""`. وأسوأُ من ذلك أنها تُعيد
 *    بناء الصندوق وأنت تكتب فيه، فيقفز مؤشّرُك إلى آخره كلَّ ثانية.
 */
function paintToolValue(id) {
  const tool = TOOLS.find((t) => t.id === id);
  const btn = $(`[data-sh="tool"][data-v="${id}"]`);
  if (!tool || !btn) return;
  const value = tool.value?.() || '';
  const slot = btn.querySelector('i');
  if (value && slot) slot.textContent = value;
  else if (value) btn.insertAdjacentHTML('beforeend', `<i>${esc(value)}</i>`);
  else slot?.remove();
  btn.setAttribute('aria-label', `${tool.label}${value ? ` — ${value}` : ''}`);
}

/** هل لهذا النصّ مسودّةٌ محفوظة؟ — سؤالٌ على المجموعة لا على القاعدة. */
function hasDraftedText(text) {
  const key = subjectKey(text || '');
  return Boolean(key) && drafted.has(key);
}

/** نصُّ الجملة الجارية — بلا الكلمة المختارة، وبلا سقوطٍ إن غاب السياق. */
function currentSentenceText() {
  return ctx?.segments?.[player?.state?.index ?? 0]?.sourceTextSnapshot || '';
}

/**
 * يرسم جسمَ لوحة المسودّة.
 *
 * ⚠️ **ولا تُنشأ مسودّةٌ بمجرّد النظر.** `readDraft` تقرأ ولا تكتب،
 *    فمرورُك على عشرين جملةً لا يترك عشرين صفًّا فارغًا في القاعدة.
 *    الصفُّ يُكتَب عند أوّل حرفٍ تكتبه أو أوّل صورةٍ تضيفها — وهو
 *    نفسُ درسِ `readBlock`/`getBlock` الذي كلّفنا صفوفًا في WS15.
 */
async function renderDraft() {
  const host = $('[data-draft]');
  if (!host) return;

  const subject = draftSubject();
  if (!subject.text) {
    openDraftId = null;
    host.innerHTML = '<p class="sh-draft-empty">مفيش جملة ولا كلمة مختارة دلوقتي.</p>';
    return;
  }

  const draft = await readDraft(subject.kind, subject.text);
  openDraftId = draft?.id || null;

  const images = draft ? await draftImages(draft.id) : [];

  host.innerHTML = `
    <div class="sh-draft-subject">
      <span class="${subject.kind === SUBJECT.WORD ? '' : 'sh-draft-sent'}"
            dir="ltr" lang="ru">${esc(subject.text)}</span>
      <button data-sh="draft-copy" title="انسخها عشان تحلّلها برّه">نسخ</button>
    </div>

    <textarea class="sh-draft-box" data-draft-box dir="auto" rows="7"
      placeholder="الصق هنا تحليل الجملة أو الكلمة…">${esc(draft?.text || '')}</textarea>
    <div class="sh-draft-state" data-draft-state></div>

    <div class="sh-draft-row">
      <button data-sh="draft-img">أضف صورة</button>
      <span data-draft-derived></span>
    </div>
    <p class="sh-draft-count" data-draft-count></p>

    ${images.length ? `<div class="sh-draft-imgs">${images.map((row) => `
      <figure>
        <button data-sh="draft-open" data-v="${row.id}">
          <img src="${urlFor(row, { thumb: true })}" alt="" loading="lazy" />
        </button>
        <button data-sh="draft-ocr" data-v="${row.id}">استخرج نصّها</button>
      </figure>`).join('')}</div>` : ''}`;

  drawDerived(draft?.text || '');
}

/**
 * ما يُشتقّ من نصّ المسودّة: عددُ جملها، وبابُ التدريب عليها.
 *
 * ⚠️ **ويُكتَب وحده لا مع اللوحة كلِّها.** كان يُرسَم داخل `renderDraft`
 *    فقط، و`renderDraft` لا تُنادى وأنت تكتب — لأن إعادةَ رسم اللوحة
 *    تبني `<textarea>` جديدةً فيقفز المؤشّرُ إلى أوّلها وتضيع الكتابة.
 *    فكانت النتيجة: تلصق التحليل، فلا يظهر عدّادٌ ولا زرُّ تدريب،
 *    حتى تنتقل إلى جملةٍ أخرى وتعود. **قِستُه في المتصفّح** — ٤ أسطر
 *    في نافذة الاختيار وصفرٌ في اللوحة، في نفس اللحظة.
 *
 *    فصارا في حاويتين مستقلّتين تُكتَبان من النصّ مباشرةً بعد الحفظ،
 *    والصندوقُ لا يُمَسّ.
 */
function drawDerived(text) {
  const slot = $('[data-draft-derived]');
  const count = $('[data-draft-count]');
  if (!slot || !count) return;

  const lines = draftSentences(text);
  const ru = lines.filter((line) => line.ru).length;

  slot.innerHTML = lines.length
    ? '<button data-sh="draft-shadow">تدرّب على جزء منها</button>'
    : '';
  count.textContent = lines.length ? `${lines.length} جملة · ${ru} فيها روسي` : '';
}

/**
 * يحفظ ما في الصندوق.
 *
 * ⚠️ **ويُنشئ المسودّة عند أوّل حرف** — لا قبله. ولذلك `openDraft`
 *    هنا وحدها، ولا تُنادى من الرسم.
 *
 * ⚠️ **والمهلةُ 600ms** لأن الحفظ عند كل ضغطةِ حرفٍ يكتب في القاعدة
 *    عشرات المرّات في الجملة الواحدة. والوعدُ مكتوبٌ تحت الصندوق
 *    («اتحفظت») لا مُفترَض — صندوقٌ يحفظ بصمتٍ يجعلك تختبره بإغلاق
 *    الصفحة، وهو اختبارٌ مكلف.
 */
let draftTimer = 0;
function scheduleDraftSave(value) {
  const state = $('[data-draft-state]');
  if (state) state.textContent = 'بيتكتب…';

  /* العدُّ وزرُّ التدريب يتبعان ما تكتبه فورًا — لا ينتظران القاعدة. */
  drawDerived(value);

  clearTimeout(draftTimer);
  const subject = draftSubject();
  draftTimer = setTimeout(async () => {
    try {
      if (!openDraftId) {
        const born = await openDraft(subject.kind, subject.text, {
          sessionId: ctx.session?.id || null,
          sceneId: ctx.scene?.id || null,
        });
        openDraftId = born.id;
      }
      await saveDraftText(openDraftId, value);
      const now = $('[data-draft-state]');
      if (now) now.textContent = 'اتحفظت';
      /* العلامةُ على السطر تظهر مع أوّل حرفٍ يُحفَظ — لا عند إعادة الفتح. */
      await refreshDrafted();
    } catch (error) {
      console.error(error);
      const now = $('[data-draft-state]');
      /* ⚠️ فشلُ الحفظ يُقال — الصمتُ هنا يعني ضياعَ ما كتبتَه بلا علمك. */
      if (now) now.textContent = 'مااتحفظتش — جرّب تاني';
    }
  }, 600);
}

/* ================================================================== */
/* منابعُ الذكرى — الورقة تحمل ما في الذكرى كلِّه                       */
/* ================================================================== */

/**
 * ⚠️ **طلبُك**: «أقلّب بين الصور والنصّ يتقسم لجمله تلقائي
 *    والاسكريبتات والفويسات — صفحة الظلّ كأنها بتلود كل الذكرى فيها
 *    بنظام كل حاجة في مكانها».
 *
 * وكانت الورقةُ تعرض **مصدرَ الجلسة وحده**: السكريبت الذي بُنيت منه،
 * ولا شيء غيره. فلو كان في الذكرى صورةٌ أو تسجيلٌ أو سكريبتٌ ثانٍ
 * تُغادر الظلَّ لتراه ثم تعود — وهو ما يكسر الجلسة في كل مرّة.
 *
 * فصارت لوحُ المستند **مُنتقِيًا**: أشرطةٌ فوقه، كلٌّ يقرأ نوعًا.
 *
 * ⚠️ **وسجلٌّ لا شروطٌ متفرّقة**: منبعٌ يُضاف غدًا سطرٌ هنا، ولا
 *    تُلمَس الورقةُ ولا الأشرطة ولا الرسم — نفسُ نمط `SOURCES` في
 *    الكوربوس و`ASPECTS` في الاستوديو.
 *
 * ⚠️ **وما لا شيءَ فيه لا يُعرَض شريطُه.** شريطٌ تضغطه فتجد فراغًا
 *    يَعِدُ بما لا يملك — والقاعدةُ في المشروع أن العدّ يسبق العرض.
 */
const WELLS = {
  images: {
    label: 'صور',
    read: async (sceneId) => {
      const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
      const rows = (await media.getMany(links.map((l) => l.mediaId))).filter(Boolean);
      return rows.filter((row) => (row.mime || row.type || '').startsWith('image'));
    },
    draw: (rows) => rows.map((row) => `
      <button class="sh-well-img" data-sh="well-open" data-v="${row.id}">
        <img src="${urlFor(row, { thumb: true })}" alt="" loading="lazy" />
      </button>`).join(''),
  },

  scripts: {
    label: 'سكريبتات',
    read: (sceneId) => scripts.byIndex('sceneId', sceneId),
    /*
     * ⚠️ **صفٌّ مدمجٌ لكل سكريبت — لا كل جمله مبسوطةً تحته (WS40، بند
     *    3).** كانت تعرض كلَّ جملةٍ في كلّ سكريبت دفعةً واحدة، فذكرى
     *    فيها 8 سكريبتات × 20 جملة تصير 160 سطرًا في تبويبٍ واحد. لا
     *    شيء كان يقرأ تلك الأسطر أصلًا (لا `data-sh` عليها) — معاينةٌ
     *    زخرفيّة لا تفيد، وتُطيل الصفحةَ بلا داعٍ. فصار السطر الواحد
     *    عنوانًا وعددَ جملٍ وزرَّ «تدرّب عليه» — تختار السكريبتَ فتصير
     *    جملُه هي مساحة العمل الرئيسة، لا كل السكريبتات معًا.
     *
     * ⚠️ **والأساسيّ (⭐) أوّلًا.** `isPrimary` موجودةٌ فعلًا في
     *    البيانات (`setPrimaryScript` — سكريبتٌ واحدٌ لكلّ مشهد)،
     *    ولم تكن تُقرَأ هنا قطّ.
     */
    draw: (rows) => [...rows]
      .sort((a, b) => (b.isPrimary || 0) - (a.isPrimary || 0))
      .map((row) => {
        const count = splitSentences(row.text || '').length;
        return `<div class="sh-well-head sh-well-script-row">
          <b>${row.isPrimary ? '⭐ ' : ''}${esc(row.title || 'سكريبت')}</b>
          <span>${count} جملة</span>
          <button data-sh="well-shadow" data-v="${row.id}">تدرّب عليه</button>
        </div>`;
      }).join(''),
  },

  voices: {
    label: 'أصوات',
    read: async (sceneId) => {
      const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
      const rows = (await media.getMany(links.map((l) => l.mediaId))).filter(Boolean);
      return rows.filter((row) => (row.mime || row.type || '').startsWith('audio'));
    },
    draw: (rows) => rows.map((row) => `
      <div class="sh-well-row" data-voice-row="${row.id}">
        <button data-sh="well-play" data-v="${row.id}" aria-label="شغّل">▶</button>
        <span>${esc(row.caption || row.filename || 'تسجيل')}</span>
      </div>`).join(''),
  },
};

/* ------------------------------------------------------------------ */
/* مشغّلُ التسجيلات — **واحدٌ لا واحدٌ لكلّ ضغطة**                      */
/* ------------------------------------------------------------------ */

/**
 * ⚠️ **بلاغُك**: «لما باجي أشغّل واحد بيشتغل وبس مبيتقفلش، واللي بعده
 *    وهكذا، وبيشتغلوا فوق بعض».
 *
 * وهو عيبي بحرفه. كتبتُها سطرًا واحدًا:
 *
 * ```js
 * if (row?.blob) new Audio(urlFor(row)).play();
 * ```
 *
 * وفيه ثلاثةُ أخطاء في سطر:
 *  1. **عنصرُ صوتٍ جديدٌ لكلّ ضغطة** — فلا أحدَ يملك السابقَ ليوقفه،
 *     وتتراكم الأصوات فوق بعضها كما وصفتَ بالضبط.
 *  2. **ولا زرَّ إيقاف** — الزرُّ `▶` أبدًا، فما بدأ لا سبيلَ لإنهائه
 *     إلا بمغادرة الشاشة.
 *  3. **ولا `revokeObjectURL`** — كلُّ ضغطةٍ تحجز الملفَّ في الذاكرة
 *     إلى أن تُغلق التبويب. تسجيلاتٌ طويلةٌ = ذاكرةٌ تُؤكَل بلا رجعة.
 *
 * فصار **مشغّلٌ واحدٌ للشاشة كلِّها**: يوقف ما قبله، ويحرّر رابطَه،
 * ويقلب زرَّه إلى `■`، ويرجع `▶` عند الانتهاء.
 */
const voice = { audio: null, url: null, id: null, title: '' };

/**
 * يوقف التسجيل الجاري ويحرّر رابطَه ويرجّع زرَّه.
 *
 * ⚠️ **ولا يُنادي `releaseAudio`**: هو نفسُه ما يُنادى **من** الناقل.
 *    وإلّا دار الاثنان في حلقة.
 */
function stopVoice() {
  if (voice.audio) {
    voice.audio.pause();
    voice.audio.src = '';
  }
  if (voice.url) URL.revokeObjectURL(voice.url);
  const btn = document.querySelector(`[data-sh="well-play"][data-v="${voice.id}"]`);
  if (btn) { btn.textContent = '▶'; btn.setAttribute('aria-label', 'شغّل'); }
  voice.audio = null;
  voice.url = null;
  voice.id = null;
  voice.title = '';
  paintVoiceBar();
}

/* ------------------------------------------------------------------ *
 * شريطُ التسجيل — «ما اختفى زرُّه لا يبقى صوتُه» بالمعنى الصحيح
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **بلاغُك**: «الفويس لما باجي أشغّله وأنا في الشادوينج وأخرج لتابة
 *    تانية بيقفل — صلّح ده وادّيني تحكّم أكتر برّه.»
 *
 * وكنتُ أنا مَن أقفله عمدًا، بقاعدةٍ كتبتُها: «ما اختفى زرُّه لا يبقى
 * صوتُه». والقاعدةُ صحيحةٌ في نصفها: **صوتٌ بلا مقبضٍ** هو المشكلة.
 * وقد قرأتُها على أنها «فأقفل الصوت»، والقراءةُ الأصحّ: **«فأعطِه
 * مقبضًا»** — كما فعلتُ للجلسة بالشريط العائم بالضبط.
 *
 * فالتسجيلُ الآن يكمل، ويظهر له شريطٌ فيه وقفٌ وإكمالٌ وإنهاء، ويحمل
 * اسمَه فتعرف أيَّ صوتٍ هذا.
 *
 * ⚠️ **ولا يظهر الشريطُ وزرُّه أمامك.** وأنت في تبويب «أصوات» زرُّ
 *    التسجيل موجودٌ ويكفي؛ فالشريطُ يظهر حين **يغيب** الزرّ وحده —
 *    وإلّا صار مقبضان لشيءٍ واحدٍ يتنازعان شكلَه.
 */
let voiceBar = null;


/**
 * يجعل شريطًا عائمًا **يُسحَب بالإصبع ويتذكّر مكانه** (WS36).
 *
 * ⚠️ بلاغُك: «حلو شريط الإيقاف والتشغيل بتاع الفويس… بس خلّيه قابل
 *    للسحب وحطّه من البداية في مكان مناسب».
 *
 * ومكانُه الأوّل كان فوق شريط الجلسة بـ64px — رقمٌ اخترتُه ليتجنّب
 * التراكب، لا لأنه مكانٌ حسن. وهو يقع على يسار الأسفل حيث تُمسك اللوحَ
 * بيدك، فيغطّي ما تقرؤه أحيانًا. فالمكانُ الأوّل صار **أعلى اليمين**
 * بعيدًا عن التحكّم وعن النصّ معًا، ثم هو لك تسحبه حيث شئت.
 *
 * ⚠️ **ولا يهرب خارج الشاشة**: الموضعُ يُقصَر داخل حدودها عند السحب
 *    **وعند القراءة من الذاكرة** — تسحبه إلى طرفٍ على اللوح ثم تفتحه
 *    على الهاتف فيصير خارجَه بلا رجعة.
 *
 * ⚠️ **والسحبُ ليس ضغطة**: تحرّكٌ أقلُّ من 6px يبقى ضغطةً على الزرّ،
 *    وإلّا صار كلُّ إيقافٍ سحبًا صغيرًا لا يوقف شيئًا.
 */
function makeDraggable(outlives, key) {
  const el = outlives;
  const clamp = () => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left), window.innerWidth - r.width - 8);
    const y = Math.min(Math.max(8, r.top), window.innerHeight - r.height - 8);
    el.style.insetInlineStart = 'auto';
    el.style.insetBlockEnd = 'auto';
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  };

  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  })();
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    el.style.insetInlineStart = 'auto';
    el.style.insetBlockEnd = 'auto';
    el.style.left = `${saved.x}px`;
    el.style.top = `${saved.y}px`;
    /* بعد الإلحاق تُعرَف أبعادُه فيُقصَر داخل الشاشة. */
    requestAnimationFrame(clamp);
  }

  let from = null;
  outlives.addEventListener('pointerdown', (event) => {
    /* الأزرارُ تعمل؛ السحبُ من جسم الشريط أو باستمرار الحركة. */
    from = { x: event.clientX, y: event.clientY, box: el.getBoundingClientRect(), moved: false };
  });

  outlives.addEventListener('pointermove', (event) => {
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!from.moved && Math.hypot(dx, dy) < 6) return;
    from.moved = true;
    el.setPointerCapture?.(event.pointerId);
    el.classList.add('is-dragging');
    el.style.insetInlineStart = 'auto';
    el.style.insetBlockEnd = 'auto';
    el.style.left = `${Math.round(from.box.left + dx)}px`;
    el.style.top = `${Math.round(from.box.top + dy)}px`;
    event.preventDefault();
  });

  const end = (event) => {
    if (!from) return;
    const wasDrag = from.moved;
    from = null;
    el.classList.remove('is-dragging');
    if (!wasDrag) return;
    /*
     * ⚠️ **سحبةٌ انتهت فوق زرٍّ لا تضغطه.** و`stopPropagation` على
     *    `pointerup` لا تمنع `click` — هو حدثٌ لاحقٌ مستقلّ. فالعلامةُ
     *    تُترَك على العنصر ويقرؤها معالِجُ الضغط ويتجاهل نفسَه مرّةً.
     */
    el.dataset.dragged = '1';
    clamp();
    const r = el.getBoundingClientRect();
    try {
      localStorage.setItem(key, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
    } catch {
      /* التخزين ممتلئ أو ممنوع — المكانُ لا يُحفظ ولا يُكسَر شيء */
    }
  };
  outlives.addEventListener('pointerup', end);
  outlives.addEventListener('pointercancel', end);
}

/**
 * @param {{leaving?: boolean}} [opts] `leaving` تعني أن الشاشة تُغادَر الآن.
 *
 * ⚠️ **ولماذا لا يكفي سؤالُ الـDOM؟** `disposeShadow` تُنادى **قبل** أن
 *    يُستبدَل محتوى `#app-main`، فزرُّ التسجيل ما زال موجودًا لحظتَها.
 *    فتقول الدالّةُ «زرُّه أمامك» فتمتنع عن الشريط — ثم يُمحى الزرُّ
 *    بعد سطرٍ واحد، فيبقى الصوتُ بلا مقبضٍ أصلًا.
 *
 *    **قِستُه**: تُشغّل تسجيلًا وأنت في تبويب «أصوات» ثم تخرج من
 *    الصفحة ← لا شريطَ ولا زرّ. وهو نفسُ العطب الذي جاء البلاغُ لأجله
 *    عائدًا من بابٍ آخر. فالمغادرةُ **تُصرَّح بها ولا تُستنتَج**.
 */
function paintVoiceBar({ leaving = false } = {}) {
  const live = Boolean(voice.id && voice.audio);
  const onScreen = live && !leaving
    && document.querySelector(`[data-sh="well-play"][data-v="${voice.id}"]`);

  if (!live || onScreen) {
    voiceBar?.remove();
    voiceBar = null;
    return;
  }

  if (!voiceBar) {
    /*
     * ⚠️ **`outlives` اسمٌ يقول لماذا لا يأخذ إشارةَ القطع.**
     *
     * حارسُ المستمعين يفرض `wired()` على كلّ `addEventListener` في هذه
     * الشاشة — وهو صواب. وهذا الشريطُ **يُقصَد به أن يعيش بعدها**:
     * مستمعُه على الشريط نفسِه، والشريطُ يُزال بيده في `paintVoiceBar`.
     * فلو أخذ الإشارةَ لمات مع الشاشة وبقي الصوتُ بلا مقبض — وهو
     * العطبُ الذي وُجد الشريطُ لأجله.
     */
    const outlives = document.createElement('div');
    const bar = outlives;
    bar.className = 'sh-floating sh-vbar';
    bar.innerHTML = `
      <button class="shf-play" data-vb="play" aria-label="وقّف">⏸</button>
      <button class="shf-open" data-vb="name"><i class="shf-pulse"></i><b></b></button>
      <button class="shf-stop" data-vb="stop" aria-label="اقفل التسجيل">✕</button>`;
    outlives.addEventListener('click', (event) => {
      if (outlives.dataset.dragged === '1') {
        outlives.dataset.dragged = '';
        return undefined;
      }
      const act = event.target.closest('[data-vb]')?.dataset.vb;
      if (act === 'stop') return releaseAudio(`voice:${voice.id}`);
      if (act === 'play' && voice.audio) {
        if (voice.audio.paused) voice.audio.play().catch(() => {});
        else voice.audio.pause();
        paintVoiceBar();
      }
      return undefined;
    });
    makeDraggable(bar, 'shadow.voiceBarPos');
    document.body.append(bar);
    voiceBar = bar;
  }

  voiceBar.querySelector('b').textContent = voice.title || 'تسجيل';
  const on = !voice.audio.paused;
  const btn = voiceBar.querySelector('[data-vb="play"]');
  btn.textContent = on ? '⏸' : '▶';
  btn.setAttribute('aria-label', on ? 'وقّف' : 'كمّل');
  voiceBar.classList.toggle('is-quiet', !on);
}

/** يشغّل تسجيلًا — أو يوقفه إن كان هو الجاري. */
async function playVoice(mediaId) {
  /* ضغطةٌ ثانيةٌ على الجاري = إيقاف. وهو ما يجعل الزرَّ بابًا في اتّجاهين. */
  if (voice.id === mediaId) return releaseAudio(`voice:${mediaId}`);

  const row = await media.get(mediaId);
  if (!row?.blob) return toastError('التسجيل ده مش موجود');

  /*
   * ⚠️ **المطالبةُ تُسكِت مَن قبله — أيًّا كان.** لا نكتب هنا «أوقف
   *    الجلسة» ولا «أوقف التسجيل الآخر»: الناقلُ يعرف مالكَه ويُسكته.
   *    وهو ما يجعل بابًا نُضيفه غدًا آمنًا بلا أن نتذكّر هذا السطر.
   */
  claimAudio(`voice:${mediaId}`, stopVoice);

  voice.id = mediaId;
  voice.title = row.caption || row.filename || 'تسجيل';
  voice.url = URL.createObjectURL(row.blob);
  voice.audio = new Audio(voice.url);

  const btn = document.querySelector(`[data-sh="well-play"][data-v="${mediaId}"]`);
  if (btn) { btn.textContent = '■'; btn.setAttribute('aria-label', 'وقّف'); }

  voice.audio.addEventListener('ended', () => releaseAudio(`voice:${mediaId}`));
  /* ⚠️ وملفٌّ تالفٌ يُقال، لا يُترك زرًّا عالقًا على `■` إلى الأبد. */
  voice.audio.addEventListener('error', () => {
    releaseAudio(`voice:${mediaId}`);
    toastError('مش قادر أشغّل التسجيل ده');
  });

  /* الشريطُ يتبع الحالَ الحقيقيّ — ولو أوقفه النظامُ من خارج أزرارنا. */
  voice.audio.addEventListener('pause', paintVoiceBar);
  voice.audio.addEventListener('play', paintVoiceBar);

  try {
    await voice.audio.play();
  } catch {
    releaseAudio(`voice:${mediaId}`);
    toastError('المتصفّح مارضاش يشغّل — دوس تاني');
  }
  paintVoiceBar();
}

/**
 * زرُّ التشغيل — بابٌ واحدٌ لكلّ نطقٍ في هذه الشاشة.
 *
 * ⚠️ **والقرارُ عند المحرّك** (`toggle`) لا هنا: الشاشة كانت تقرأ
 *    `running` و`paused` وتفترض ثلاثَ حالات، وقد خرجت رابعةٌ فماتت
 *    الضغطة. راجع الشرح فوق `toggle` في `playback-controller`.
 */
function togglePlay() {
  /*
   * ⚠️ **محرّكٌ واحدٌ لكلّ نطقٍ الآن (WS40).** كان نصٌّ خارجيّ يشغّل
   *    محرّكًا ثانيًا فاحتاج مُعرِّفًا يميّزه في طابور الصوت المشترك؛
   *    والآن هو مقطعٌ في نفس `player`، فلا يوجد ما يُميَّز.
   */
  claimAudio('session', () => player.pause());
  player.toggle();
  paintTransport();
}

/**
 * يرسم زرَّ التشغيل بحالته الحقيقيّة — ▶ أو ⏸.
 *
 * ⚠️ **وكان لا يتبدّل أبدًا.** زرٌّ شكلُه واحدٌ في الحالتين يجعلك
 *    تخمّن أثرَ ضغطتك، وهو نصفُ «التحكّم بيشتغل ساعات ويبوظ ساعات»:
 *    الشكوى ليست كلُّها عن السلوك، بل عن **ألّا تعرف السلوك**.
 */
function paintTransport() {
  const on = Boolean(player?.state?.running && !player.state.paused);
  const btn = $('[data-sh="play"]');
  if (btn) {
    btn.classList.toggle('is-playing', on);
    btn.setAttribute('aria-label', on ? 'وقّف' : 'شغّل');
  }
  document.querySelector('.shadow-app')?.classList.toggle('is-speaking', on);
  paintFloating();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
}

/**
 * يُسجِّل الظلّ عند نظام التشغيل كصوتٍ حقيقيّ — تحكّمٌ من شاشة القفل
 * وسمّاعة البلوتوث، لا مجرّد صوتٍ مجهول المصدر (بند 4، WS40).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وما لا يفعله هذا — بصراحة
 * ═══════════════════════════════════════════════════════════════
 *
 * Media Session **لا** تمنع المتصفّح من إسكات الصوت حين يغادر التطبيق
 * الخلفيّة أو تُقفَل الشاشة؛ هي فقط تُظهر عناصر تحكّمٍ حقيقية وتُشعر
 * النظامَ أن هذه جلسةُ وسائطَ لا تبويبًا صامتًا — وهو ما يرفع فرصةَ
 * الاستمرار، لا يضمنه.
 *
 * والفرقُ الحقيقيّ بين مصدرَي صوت هذه الشاشة:
 *  · **صوتٌ مسجَّل (`mine`/`native`)** — عنصر `<audio>` حقيقيّ، وهذا
 *    ما تحترمه أنظمة تشغيل الموبايل عادةً في الخلفية، خصوصًا مع
 *    Media Session مسجَّلة.
 *  · **النطقُ الآليّ (`speechSynthesis`)** — API منفصلٌ عن عناصر
 *    الوسائط، ومتصفّحات أندرويد (خصوصًا Chrome وSamsung Internet)
 *    معروفةٌ بإيقافها أو تجميدها حين يغادر التبويب الواجهة. هذا قيدٌ
 *    من المنصّة نفسها — لا سطرَ جافاسكربت هنا يُصلحه، ولا فحصُ
 *    Playwright في بيئة headless يقدر يُحاكي إغلاقَ شاشةٍ حقيقيّ
 *    ليقيسه. التوصية: جرّبها على جهازك الحقيقيّ (Tab S10+) وقارن
 *    سلوك الصوت المسجَّل بالنطق الآليّ في الخلفية.
 */
function wireMediaSession() {
  if (!('mediaSession' in navigator)) return;

  const handlers = {
    play: () => { if (!player?.state?.running || player.state.paused) togglePlay(); },
    pause: () => { if (player?.state?.running && !player.state.paused) togglePlay(); },
    previoustrack: () => player?.previous(),
    nexttrack: () => player?.next(),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* غيرُ مدعوم */ }
  }
}

/** يُحدِّث ما تعرضه شاشةُ القفل — يُنادى كلَّما تبدّلت الجملة. */
function syncMediaSession(segment) {
  if (!('mediaSession' in navigator) || !ctx) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: segment?.sourceTextSnapshot?.slice(0, 80) || ctx.session?.title || 'ظلّ',
    artist: ctx.session?.title || 'LingoLife',
    album: 'الظلّ',
  });
}

/** المنبعُ المفتوح الآن. */
let well = 'source';

/** يرسم الأشرطة ومحتوى المنبع — ولا يعرض شريطًا لمنبعٍ فارغ. */
async function renderWells() {
  const tabs = $('[data-well-tabs]');
  const body = $('[data-well-body]');
  if (!tabs || !body || !ctx?.scene) return;

  const counts = {};
  await Promise.all(Object.entries(WELLS).map(async ([id, w]) => {
    try { counts[id] = (await w.read(ctx.scene.id)) || []; }
    catch { counts[id] = []; }
  }));

  const live = Object.entries(WELLS).filter(([id]) => counts[id].length);
  tabs.innerHTML = [`<button class="${well === 'source' ? 'on' : ''}" data-sh="well" data-v="source">المصدر</button>`]
    .concat(live.map(([id, w]) =>
      `<button class="${well === id ? 'on' : ''}" data-sh="well" data-v="${id}">${w.label} ${counts[id].length}</button>`))
    .join('');

  if (well === 'source' || !WELLS[well] || !counts[well]?.length) {
    body.innerHTML = '';
    body.hidden = true;
    /*
     * ⚠️ **والرجوعُ إلى «المصدر» يعيد الوجهَ الذي اخترتَه** — لا
     *    النصَّ دائمًا. اخترتَ الصورةَ ثم نظرتَ في السكريبتات ثم
     *    عدتَ، فتجد الصورة كما تركتها.
     */
    $('[data-faces]')?.removeAttribute('hidden');
    renderFaces();
    return;
  }
  /* منبعٌ آخر يملأ اللوح: الوجوهُ تختفي معًا. */
  $('[data-doc-source]')?.setAttribute('hidden', '');
  $('[data-face-body]')?.setAttribute('hidden', '');
  $('[data-faces]')?.setAttribute('hidden', '');
  body.hidden = false;
  body.innerHTML = WELLS[well].draw(counts[well]);
}

/* ================================================================== */
/* أوجهُ المصدر الواحد — نصٌّ وصورةٌ وصوت (WS33)                        */
/* ================================================================== */

/**
 * ⚠️ **طلبُك**: «تابة المصدر — الصورة لو مرتبطة بسكريبت أو صوت أقدر
 *    أقلّب بينهم، لأن التلاتة بيمثّلوا سكريبت واحد. افرض أنا عايز
 *    أعرض الصورة أو النصّ أو أسمع الفويس».
 *
 * وهو تمييزٌ دقيق. أشرطةُ المنابع (`WELLS`) تعرض **كلَّ ما في
 * الذكرى**: كلَّ الصور وكلَّ السكريبتات. وهذا شيءٌ آخر: **هذا
 * المصدرُ بعينه** — الورقةُ التي تتدرّب عليها — له وجوهٌ ثلاثة
 * مربوطةٌ ببعضها في `relationships`:
 *
 *     الصورة  ──image:script──▶  السكريبت  ◀──audio:script──  التسجيل
 *
 * فليست ثلاثةَ أشياء، بل **شيءٌ واحدٌ بثلاث واجهات**. والتقليبُ
 * بينها ليس تصفّحًا بل اختيارُ ما تنظر إليه وأنت تتدرّب على نفس
 * الجمل.
 *
 * ⚠️ **وهذا يحلّ بلاغَك الثاني أيضًا**: «استخراج النصّ من الصورة
 *    ساعات بيبقى غبي بيسحب كلّ حاجة، فأحسن أستخرج النصّ من
 *    السكريبت لكن أقراه من الصورة». وهو ما يصير ممكنًا هنا بلا
 *    ميزةٍ جديدة: الجلسةُ مبنيّةٌ من **السكريبت** (نصٌّ نظيف
 *    كتبتَه)، والوجهُ المعروض **الصورة**. النصُّ من هنا والنظرُ من
 *    هناك.
 *
 * ⚠️ **ولا وجهَ بلا شيءٍ خلفه**: وجهٌ لا رابطَ له لا يُعرَض زرُّه.
 */
const FACES = {
  text: {
    label: 'نصّ',
    /* المصدرُ الأصليّ كما هو — لوحةُ `sh-sheet` بحالها. */
    has: () => true,
    show: () => {
      $('[data-doc-source]')?.removeAttribute('hidden');
      $('[data-face-body]')?.setAttribute('hidden', '');
    },
  },

  image: {
    label: 'صورة',
    has: () => Boolean(faceLinks.image),
    show: () => {
      const host = $('[data-face-body]');
      if (!host) return;
      $('[data-doc-source]')?.setAttribute('hidden', '');
      host.hidden = false;
      host.innerHTML = `
        <div class="sh-face-img">
          <img src="${urlFor(faceLinks.image, { thumb: false })}" alt="صورة المصدر" />
        </div>
        <button class="sh-face-open" data-sh="face-open" data-v="${faceLinks.image.id}">
          كبّرها
        </button>`;
    },
  },

  audio: {
    label: 'صوت',
    has: () => Boolean(faceLinks.audio),
    show: () => {
      const host = $('[data-face-body]');
      if (!host) return;
      $('[data-doc-source]')?.setAttribute('hidden', '');
      host.hidden = false;
      const row = faceLinks.audio;
      host.innerHTML = `
        <div class="sh-well-row" data-voice-row="${row.id}">
          <button data-sh="well-play" data-v="${row.id}" aria-label="شغّل">▶</button>
          <span>${esc(row.caption || row.filename || 'تسجيل المصدر')}</span>
        </div>
        <p class="sh-face-note">ده التسجيل المربوط بالمصدر ده — وتقدر تخلّيه
          صوت التدريب من «الصوت ← تسجيلي».</p>`;
    },
  },
};

/** روابطُ هذا المصدر — تُقرأ مرّةً عند الإقلاع. */
let faceLinks = { image: null, audio: null };
let face = 'text';

/**
 * يقرأ وجوهَ المصدر من `relationships`.
 *
 * ⚠️ **والاتّجاهان معًا**: `resolveLinks` تُرجع ما رُبط من الطرفين،
 *    فسواءٌ ربطتَ الصورةَ بالسكريبت أو السكريبتَ بالصورة يُوجَد.
 */
async function readFaces(session) {
  faceLinks = { image: null, audio: null };
  if (!session?.sourceId) return;

  try {
    const [audio, image] = await Promise.all([
      resolveLinks(session.sourceId, LINK.AUDIO_SCRIPT),
      resolveLinks(session.sourceId, LINK.IMAGE_SCRIPT),
    ]);
    faceLinks.audio = audio.map((l) => l.entity).find((e) => e?.blob && e.kind === 'audio') || null;
    faceLinks.image = image.map((l) => l.entity)
      .find((e) => e?.blob && (e.mime || '').startsWith('image')) || null;

    /*
     * ⚠️ **والتسجيلُ المربوط بالصورة وجهٌ أيضًا** — بلاغُك: «الفويس
     *    اللي متلنك مع صورة أو نصّ عايزه يظهر في المصدر المعروض».
     *
     * كنتُ أسأل عن `audio:script` وحدَه. وأنت تربط بالصورة أيضًا —
     * ومن منتقي الصور البصريّ الذي بنيتُه لك في WS34 بالذات، فهو
     * يكتب `audio:image` لا `audio:script`. أي أنّي بنيتُ لك بابًا
     * للربط ثم لم أقرأ ما يكتبه.
     *
     * ⚠️ **والمربوطُ بالسكريبت يسبق**: هو الأدقّ — نطقُ هذا النصّ
     *    بعينه. وما رُبط بالصورة يسدّ حين لا يكون ثَمّ أدقُّ منه.
     */
    if (!faceLinks.audio && faceLinks.image) {
      const viaImage = await resolveLinks(faceLinks.image.id, LINK.AUDIO_IMAGE);
      faceLinks.audio = viaImage.map((l) => l.entity)
        .find((e) => e?.blob && e.kind === 'audio') || null;
    }
    /* ومصدرٌ هو الصورةُ نفسُها (نصٌّ مستخرَج) — نسألها مباشرةً. */
    if (!faceLinks.audio && session.sourceType === SOURCE_TYPE.MEDIA_TEXT) {
      const onImage = await resolveLinks(session.sourceId, LINK.AUDIO_IMAGE);
      faceLinks.audio = onImage.map((l) => l.entity)
        .find((e) => e?.blob && e.kind === 'audio') || null;
    }
  } catch {
    /* غيابُ رابطٍ ليس عطلًا — الوجهُ لا يظهر فحسب. */
  }
}

/** يرسم مبدِّلَ الأوجه — ولا يظهر أصلًا إن كان للمصدر وجهٌ واحد. */
function renderFaces() {
  const host = $('[data-faces]');
  if (!host) return;

  const live = Object.entries(FACES).filter(([, f]) => f.has());
  if (live.length < 2) {
    host.innerHTML = '';
    host.hidden = true;
    FACES.text.show();
    return;
  }

  host.hidden = false;
  if (!FACES[face]?.has()) face = 'text';
  host.innerHTML = live.map(([id, f]) =>
    `<button data-sh="face" data-v="${id}" class="${face === id ? 'on' : ''}">${f.label}</button>`).join('');
  FACES[face].show();
}

/** يقفز إلى جملةٍ بعينها — من شرطةٍ أو من سطرٍ في الورقة. */
function goSegment(index) {
  if (!Number.isFinite(index) || !ctx?.segments[index]) return;
  player.goTo(index);
  syncSegment();
  syncTicks();
  renderWords();
}

/** يحدّث الشُّرَط بعد كل قفزة. */
function syncTicks() {
  const idx = player?.state?.index ?? 0;
  document.querySelectorAll('.sh-tick').forEach((node, i) => {
    node.classList.toggle('on', i === idx);
    node.classList.toggle('past', i < idx);
  });
}

/**
 * ارتفاعُ لوح المستند في الورقة.
 *
 * ⚠️ **ويُحفَظ**، كما حُفظ شقُّ الكتاب. ضبطٌ يضيع بأوّل إعادة رسمٍ
 *    أسوأ من ألّا يوجد: تضبطه كل مرّةٍ فتكفّ عن ضبطه.
 */
const DOC_KEY = 'shadow.doc';
const DOC_MAX = 470;
let docSize = 250;

function setDoc(mode) {
  const next = mode === 'none' ? 0 : mode === 'full' ? DOC_MAX : 250;
  applyDoc(next);
  settings.set(DOC_KEY, next).catch(() => {});
}

function applyDoc(px) {
  docSize = Math.max(0, Math.min(DOC_MAX, px));
  document.querySelector('.shadow-app')?.style.setProperty('--doc', `${docSize}px`);
}

/**
 * قرصٌ بإصبعين على صورة المستند (WS24).
 *
 * ⚠️ **على `Pointer Events`** كقرص العارض: إصبعٌ وفأرةٌ وقلمٌ بمستمعٍ
 *    واحد. ولا يُلمَس تكبيرُ الأزرار — القرصُ يكتب في نفس القيمة
 *    (`coverZoom`)، فيتّفق الطريقان على رقمٍ واحدٍ لا رقمين.
 */
function wirePinch(main) {
  const box = main.querySelector('[data-pinch]');
  if (!box) return;

  const touches = new Map();
  let pinch = null;
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  /*
   * ⚠️ **وإصبعٌ واحدة تسحب الصورة** — بلاغُك: «لما بقرّب الصورة
   *    مبقدرش أحرّكها يمين وشمال».
   *
   *    والسببُ أنّي منعتُه بيدي: `touch-action: none` تأخذ اللمسَ من
   *    المتصفّح لتصل الأحداثُ إلى القرص — وتأخذ معه **التمريرَ**
   *    الذي كان يحرّك الصورة داخل إطارها. فما أخذتُه لزمني أن أردّه:
   *    السحبُ يُكتَب هنا بدل أن يُترَك للمتصفّح.
   */
  let pan = null;

  box.addEventListener('pointerdown', (event) => {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 1) {
      pan = { x: event.clientX, y: event.clientY, left: box.scrollLeft, top: box.scrollTop };
      box.setPointerCapture?.(event.pointerId);
    }
    if (touches.size === 2) {
      pan = null;
      pinch = { start: spread(), from: ctx.coverZoom };
      box.setPointerCapture?.(event.pointerId);
    }
  }, wired());

  box.addEventListener('pointermove', (event) => {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

    /* إصبعٌ واحدة: سحبٌ داخل الإطار. */
    if (touches.size === 1 && pan) {
      event.preventDefault();
      box.scrollLeft = pan.left - (event.clientX - pan.x);
      box.scrollTop = pan.top - (event.clientY - pan.y);
      return;
    }

    if (touches.size !== 2 || !pinch) return;
    event.preventDefault();
    const now = spread();
    if (!pinch.start) return;
    /* نفسُ حدَّي الأزرار — فلا يخرج القرصُ عمّا يقدر عليه الزرّ. */
    ctx.coverZoom = Math.round(Math.max(40, Math.min(400, pinch.from * (now / pinch.start))));
    applyCover();
  }, wired());

  const lift = (event) => {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = null;
    if (!touches.size) pan = null;
  };
  box.addEventListener('pointerup', lift, wired());
  box.addEventListener('pointercancel', lift, wired());
  box.addEventListener('pointerleave', lift, wired());
}

/** يركّب سحبَ مقبض الورقة — بنفس منطق كعب الكتاب. */
function wireDocSplit(main) {
  const handle = main.querySelector('[data-docsplit]');
  const app = main.querySelector('.shadow-app');
  if (!handle || !app) return;

  let from = null;
  handle.addEventListener('pointerdown', (event) => {
    /* الأزرارُ داخل المقبض تعمل، فلا نبتلع ضغطتها. */
    if (event.target.closest('button')) return;
    from = { y: event.clientY, base: docSize };
    app.classList.add('is-docdrag');
    handle.setPointerCapture?.(event.pointerId);
  }, wired());

  handle.addEventListener('pointermove', (event) => {
    if (!from) return;
    applyDoc(from.base + (event.clientY - from.y));
  }, wired());

  const release = () => {
    if (!from) return;
    from = null;
    app.classList.remove('is-docdrag');
    settings.set(DOC_KEY, docSize).catch(() => {});
  };
  handle.addEventListener('pointerup', release, wired());
  handle.addEventListener('pointercancel', release, wired());
}

/* ------------------------------------------------------------------ *
 * التفاعل
 * ------------------------------------------------------------------ */

/**
 * حدود كل قيمة قابلة للضبط ومعناها.
 *
 * جدول واحد بدل شروط متفرّقة: كل مفتاح يعرف مداه، وكيف يُقرأ في
 * الشريط السريع، وأين يُحفظ في الجلسة. إضافة قيمة جديدة سطرٌ هنا.
 */
const TUNERS = {
  speed: {
    min: RATE_MIN, max: RATE_MAX, step: 0.05, decimals: 2,
    label: (v) => `${v}x`,
    patch: (v) => ({ rate: v }),
    persist: (v) => ({ speed: v }),
  },
  repeat: {
    min: 1, max: 99, step: 1, decimals: 0,
    label: (v) => `×${v}`,
    patch: (v) => ({ repeatCount: v }),
    persist: (v) => ({ repeatCount: v }),
  },
  pause: {
    min: INTERVAL_MIN_MS, max: INTERVAL_MAX_MS, step: 50, decimals: 0,
    label: (v) => intervalLabel({ intervalMsValue: v }),
    patch: (v) => ({ intervalMsValue: v }),
    persist: (v) => ({ intervalMsValue: v }),
  },
  volume: {
    min: 0, max: 100, step: 1, decimals: 0,
    label: (v) => `${v}%`,
    patch: (v) => {
      ctx.volume = v / 100;
      return { volume: ctx.volume };
    },
    persist: (v) => ({ volume: v / 100 }),
  },
};

/**
 * يضبط قيمة من المنزلق أو من خانة الرقم.
 *
 * المنزلق وخانة الرقم يقودان نفس القيمة، فيلزم أن يتبع كلٌّ الآخر —
 * وإلا رأيت رقمًا وسمعت غيره. و`silent` يمنع الحفظ أثناء السحب:
 * كتابةٌ لكل بكسل تُثقل القاعدة بلا فائدة.
 */
function setTuner(key, raw, { silent = false } = {}) {
  const spec = TUNERS[key];
  if (!spec) return;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return;

  // التقريب إلى مضاعفات الخطوة يمنع 0.8500000000000001 من الظهور.
  const snapped = Math.round(parsed / spec.step) * spec.step;
  const value = Number(
    Math.max(spec.min, Math.min(spec.max, snapped)).toFixed(spec.decimals)
  );

  // الإعدادُ لك لا للنصّ — محرّكٌ واحدٌ الآن (WS40)، فلا يختلف صوتُ
  // جملةٍ كتبتها عن صوت جملةٍ من السكريبت.
  player?.updateSettings(spec.patch(value));

  const range = document.querySelector(`[data-tune-range="${key}"]`);
  const num = document.querySelector(`[data-tune-num="${key}"]`);
  if (range && Number(range.value) !== value) range.value = value;
  if (num && Number(num.value) !== value) num.value = value;

  const quick = document.querySelector(`[data-dial="${key}"]`);
  if (quick) quick.textContent = spec.label(value);

  /*
   * ⚠️ **ونسخةُ الشاشة تتحدّث مع القاعدة.** كان الحفظ يكتب في
   *    IndexedDB و`ctx.session` يبقى على قيمته الأولى إلى آخر الجلسة.
   *    فكلُّ قارئٍ منه يقرأ ماضيًا: لوحةُ السرعة تُضيء `1x` وأنت على
   *    `0.75`، والسكّةُ تقول رقمًا غيرَ الذي تسمعه.
   *
   *    ⚠️ وكان **موجودًا قبل السكّة**؛ ما كشفه إلا أن القيمة صارت
   *       مكتوبةً حيث تُرى بلا فتح لوحة. عيبٌ صامتٌ سنتين ليس عيبًا
   *       أصغر — هو عيبٌ لم يُقَس.
   */
  Object.assign(ctx.session, spec.persist(value));

  if (silent) return;
  return saveSessionSettings(ctx.session.id, spec.persist(value)).catch(() => {});
}



/* ------------------------------------------------------------------ *
 * مُقلِّبُ الصفحتين على الموبايل (WS38)
 * ------------------------------------------------------------------ */

/**
 * يربط المؤشّر بالانزلاق — والانزلاقَ بالمؤشّر.
 *
 * ⚠️ **ولا يُصنَع السحبُ بيدي.** `scroll-snap` تعطي الزخمَ والتوقّفَ
 *    على الحافّة مجّانًا، وتعمل بالإصبع وبالعجلة وبقارئ الشاشة.
 *    ودَوري هنا أن **أقرأ** أين وصلتَ لا أن أحرّكك.
 *
 * ⚠️ **ولا يظهر المؤشّرُ على اللوح**: هناك الصفحتان معًا أمامك،
 *    فنقطتان تقولان «واحدةٌ من اثنتين» كذبٌ صغير.
 */
function wirePager(main) {
  const pages = main.querySelector('[data-pages]');
  const pager = main.querySelector('[data-pager]');
  const book = main.querySelector('.sh-book');
  if (!pages || !pager || !book) return;

  const paint = () => {
    /*
     * ⚠️ **الوضعُ يُقرأ من `data-layout` لا يُحزَر من عرض التمرير.**
     *    `wireBookLayout` هي وحدَها من تقرّر «واحدةٌ أم اثنتان» —
     *    فيقرأ المُقلِّبُ قرارَها بدل أن يعيد استنتاجه بطريقةٍ أخرى
     *    قد تختلف عند حافّة القياس (بند 1، WS39).
     */
    const on = book.dataset.layout === 'single';
    pager.hidden = !on;
    if (!on) return;
    /* ⚠️ بالنسبة لا بالبكسل: العرضُ يختلف بين جهازٍ وجهاز. */
    const at = Math.round(Math.abs(pages.scrollLeft) / Math.max(1, pages.clientWidth));
    activePage = at;
    for (const b of pager.querySelectorAll('[data-sh="page-go"]')) {
      b.classList.toggle('on', Number(b.dataset.v) === at);
    }
  };

  pages.addEventListener('scroll', paint, wired({ passive: true }));
  /*
   * ⚠️ **`sh-layout` لا `resize` وحده.** حدثُ تغيير حجم النافذة وقراءةُ
   *    `ResizeObserver` لعرض `.sh-book` غيرُ مضمونَي الترتيب — فقد يُعاد
   *    رسمُ هذا المؤشّر بـ`resize` وهو لا يزال يقرأ `data-layout` القديم
   *    قبل أن تكتب `wireBookLayout` القيمة الجديدة. **قِيس**: تصغيرٌ حيٌّ
   *    من عريضٍ إلى ضيّق كان يُبقي المؤشّرَ مختفيًا لدورةٍ واحدة. فتُطلِق
   *    `wireBookLayout` هذا الحدثَ **بعد** كتابة `data-layout` مباشرةً،
   *    فلا سباق.
   */
  book.addEventListener('sh-layout', paint, wired());
  window.addEventListener('resize', paint, wired());
  paint();
}

/**
 * يذهب إلى صفحةٍ بالرقم — من المؤشّر أو من أي زرّ آخر أو من تخطيط
 * الكتاب نفسه عند التحوّل إلى وضع الصفحة الواحدة.
 *
 * `instant`: بلا انزلاقٍ مرئيّ — لتحوّل التخطيط (بند 14) لا لضغطة
 * المستخدم، التي تبقى ناعمةً (بند 3-4).
 */
function goToPage(index, { instant = false } = {}) {
  const pages = $('[data-pages]');
  if (!pages) return;
  activePage = index;
  /*
   * ⚠️ **بـ`.sh-page` لا بترتيب الأبناء.** `pages.children` تضمّ
   *    الكعبَ (`.sh-spine`) بين الصفحتين، فـ`children[1]` كانت تلتقط
   *    الكعبَ لا الصفحةَ اليمنى — والضغطُ على المؤشّر لا يحرّك شيئًا.
   *    **قِيس**: ضغطُ «صفحة التدريب» لا يبدّل المؤشّر ولا الانزلاق.
   */
  const page = pages.querySelectorAll('.sh-page')[index];
  /*
   * ⚠️ **الاتّجاه يُقرأ من التخطيط لا يُفترَض.** الصفحةُ عربيّة (RTL)
   *    فـ`scrollLeft` سالبةٌ أو معكوسةٌ حسب المحرّك. و`scrollIntoView`
   *    على العنصر نفسِه تتكفّل بذلك في كلّ الاتّجاهات.
   */
  page?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
}

/* ------------------------------------------------------------------ *
 * تخطيطُ الكتاب المتكيّف — صفحةٌ واحدةٌ حين يضيق العرضُ الفعليّ (WS39)
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **العرضُ الفعليّ لا عرضُ الشاشة.** `.sh-book` نفسُه — لا
 *    `window.innerWidth` — لأن لوحةَ الأدوات والسكّةَ الجانبيّة
 *    تقتطعان منه، فقد يضيق الكتابُ دون أن تضيق الشاشة (بند 1، 13).
 *
 * ⚠️ **وحدُّ تذبذبٍ (hysteresis) لا رقمٌ واحد.** عرضٌ يتأرجح حول حدٍّ
 *    واحد يقلّب الوضعَ ذهابًا وإيابًا لأقلّ تغييرٍ (شريطُ تمريرٍ ظهر
 *    أو اختفى). فالتحوّل إلى «واحدة» عند <900، ولا عودة إلى «اثنتين»
 *    إلّا بعد ≥924 — نطاقٌ ميّتٌ يمتصّ الاهتزاز (بند 14).
 */
const BOOK_SINGLE_BELOW = 900;
const BOOK_TWO_ABOVE = 924;

/**
 * يراقب عرضَ الكتاب حيًّا ويكتب `data-layout` على `.sh-book` —
 * `"single"` أو `"two"` — التي تقود كلَّ قواعد CSS الجديدة في
 * `shadow.css`، وتُعلِم `wireSpine` باتّجاه السحب الصحيح.
 */
function wireBookLayout(main) {
  const book = main.querySelector('.sh-book');
  const pages = main.querySelector('[data-pages]');
  if (!book || !pages) return;

  let layout = null;

  const apply = (width) => {
    const next = layout === 'single'
      ? (width >= BOOK_TWO_ABOVE ? 'two' : 'single')
      : (width < BOOK_SINGLE_BELOW ? 'single' : 'two');
    if (next === layout) return;
    const prev = layout;
    layout = next;
    book.dataset.layout = next;

    if (next === 'single') {
      /*
       * ⚠️ **افتراضيًّا صفحةُ التدريب — إلّا أن يكون قد اختير غيرُها
       *    فعلًا هذه الجلسة (بند 6).** أوّل دخولٍ بلا قرارٍ سابق يذهب
       *    للشادوينج مباشرةً؛ وأيُّ دخولٍ بعده يُبقيك حيث كنتَ، ولو
       *    جئتَ من عرض الصفحتين معًا.
       */
      if (activePage == null) activePage = 1;
      goToPage(activePage, { instant: true });
    } else if (prev === 'single') {
      /* رجعتا صفحتين معًا؛ الانزلاقُ الأفقيّ للمُقلِّب لا معنى له الآن. */
      pages.scrollLeft = 0;
    }

    /* ⚠️ يُطلَق **بعد** كتابة `data-layout` — انظر التعليق في `wirePager`. */
    book.dispatchEvent(new Event('sh-layout'));
  };

  apply(book.getBoundingClientRect().width);

  bookRO = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width;
    if (width) apply(width);
  });
  bookRO.observe(book);
}

/* ------------------------------------------------------------------ *
 * مفتاحُ الخطّ الصغير — واحدٌ لكلّ صفحة، معروضٌ دائمًا (WS36)
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **بلاغُك**: «التحكّم في شكل الخطّ جميل جدًّا، بس عايز الكنترول
 *    بتاعه يكون ذكيّ وجميل وصغير ومعروض طول الوقت في المكان المناسب
 *    في كلّ صفحة من الصفحتين».
 *
 * وكان الخطُّ يُغيَّر من لوحةٍ تُفتَح من السكّة — أي أنك تترك ما تنظر
 * إليه لتصل إلى إعداده. والخطُّ **قرارٌ بصريّ**: تحكم عليه بالنظر إلى
 * النصّ، فلا يصحّ أن يكون بابُه بعيدًا عنه.
 *
 * فصار على كلّ صفحةٍ شارةٌ صغيرةٌ فيها **حرفٌ روسيٌّ مرسومٌ بالخطّ
 * نفسِه** — لا اسمُ الخطّ. الاسمُ يحتاج قراءةً وترجمةً في رأسك؛ والحرفُ
 * يريك الجوابَ مباشرةً.
 *
 * ⚠️ **ولا تُغلق اللوحةَ ضغطةٌ داخلها.** أوّلُ نسخةٍ أغلقت على أي
 *    `pointerdown` في المستند فكانت تُغلق قبل أن تصل الضغطةُ إلى
 *    الخيار — فيبدو الاختيار بلا أثر.
 */
let fontPop = null;

function closeFontPop() {
  fontPop?.remove();
  fontPop = null;
}

/**
 * يختار خطًّا لصفحة.
 *
 * ⚠️ **الصفحةُ تُقرأ من الزرّ لا تُفترَض.** لوحةُ الخطّ القديمة بلا
 *    `data-page` تعني «المسرح» كما كانت، فلا ينكسر بابٌ قديمٌ لأننا
 *    فتحنا ثانيًا.
 */
function pickFont(page, fontId) {
  if (!fontId || !ctx?.session) return undefined;
  const doc = page === 'doc';
  if (doc) ctx.fontDoc = fontId;
  else ctx.font = fontId;
  applyFonts();
  closeFontPop();
  return saveSessionSettings(ctx.session.id, doc ? { fontDocId: fontId } : { fontId });
}

function toggleFontPop(page, anchor) {
  const already = fontPop?.dataset.page === page;
  closeFontPop();
  if (already) return undefined;

  const current = page === 'doc' ? ctx.fontDoc : ctx.font;
  const pop = document.createElement('div');
  pop.className = 'sh-fontpop';
  pop.dataset.page = page;
  pop.innerHTML = fontsByForm()
    .map((group) => `
      <div class="sh-fontpop-g">${esc(group.label)}</div>
      ${group.fonts.map((f) => `
        <button data-sh="font-pick" data-page="${page}" data-font="${f.id}"
                class="${f.id === current ? 'on' : ''}" title="${esc(f.label)}">
          <span style="font-family:${f.stack};font-style:${f.style}">Аа</span>
          <b>${esc(f.label)}</b>
        </button>`).join('')}`)
    .join('');

  /*
   * ⚠️ **مثبَّتةٌ بالشاشة لا بالصفحة** — بلاغُك: «القايمة نفسها مش
   *    باينة، مختفي نصّها».
   *
   *    كانت تُلحَق داخل `.sh-page`، وللصفحة `overflow` يقصّ ما تجاوزها
   *    — فنصفُ القائمة خلف الحافّة لا سبيل إليه. و`position: fixed`
   *    تخرجها من كلّ قصٍّ مهما كان أبوها.
   *
   * ⚠️ **وتُقلَب لأعلى إن ضاق ما تحتها**: شارةُ المسرح قريبةٌ من قاع
   *    الشاشة أحيانًا، فقائمةٌ تنزل منها تقع خارجها.
   */
  /*
   * ⚠️ **ومستمعُها عليها.** الموزّعُ العامّ معلَّقٌ على `#app-main`،
   *    والقائمةُ صارت في `body` لتهرب من القصّ — فخرجت من مداه.
   *    **قِستُه**: الضغطُ على خطٍّ لا يفعل شيئًا والقائمةُ لا تُغلق.
   *    فالهروبُ من قصٍّ لا يكون بالهروب من الأحداث.
   */
  pop.addEventListener('click', (event) => {
    const b = event.target.closest('[data-sh="font-pick"]');
    if (b) pickFont(b.dataset.page, b.dataset.font);
  }, wired());

  document.body.append(pop);
  const box = anchor.getBoundingClientRect();
  const H = Math.min(pop.scrollHeight + 16, window.innerHeight * 0.46);
  const below = window.innerHeight - box.bottom - 10;
  const top = below >= H ? box.bottom + 6 : Math.max(8, box.top - H - 6);
  const left = Math.min(Math.max(8, box.left), window.innerWidth - pop.offsetWidth - 8);
  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
  fontPop = pop;
  return undefined;
}

/** يُبقي الشارتين مطابقتين لخطَّي الصفحتين. */
function paintFontChips() {
  for (const [page, id] of [['stage', ctx.font], ['doc', ctx.fontDoc]]) {
    const chip = $(`[data-sh="fontpop"][data-page="${page}"] span`);
    if (!chip) continue;
    const f = fontById(id);
    chip.style.fontFamily = f.stack;
    chip.style.fontStyle = f.style;
  }
  for (const btn of document.querySelectorAll('[data-sh="font-pick"][data-page]')) {
    const on = btn.dataset.page === 'doc' ? ctx.fontDoc : ctx.font;
    btn.classList.toggle('on', btn.dataset.font === on);
  }
}

/** الشارةُ نفسُها — حرفٌ بالخطّ الجاري. */
function fontChip(page) {
  return html`<button class="sh-fontchip-mini" data-sh="fontpop" data-page="${page}"
    title="خطّ الصفحة دي" aria-label="خطّ الصفحة دي"><span>Аа</span></button>`;
}

/**
 * يطبّق الخطّ وحجمه — **لكلِّ صفحةٍ خطُّها** (WS36).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ بلاغُك: «لما بغيّره بيغيّر نوع الخطّ في الصفحتين — أنا عايز كل
 *    صفحة لوحدها أتحكّم فيها»
 * ═══════════════════════════════════════════════════════════════
 *
 * وكنتُ كتبتُ هنا بالحرف: «الخطّ قرارٌ للنصّ الروسي كلّه» — وهو تعميمٌ
 * بدا لي بديهيًّا وليس كذلك. الصفحتان تؤدّيان عملين مختلفين:
 *
 *   · **اليمنى** جملةٌ واحدةٌ كبيرة تنطقها — تريدها واضحةً بلا زخرفة.
 *   · **اليسرى** سطورٌ كثيرةٌ تمسحها بعينك — قد تريدها بخطّ يدٍ يشبه
 *     ما تقرؤه في الحياة، أو بخطٍّ أضيقَ يسع أكثر.
 *
 * فصارا خطّين: `ctx.font` للمسرح و`ctx.fontDoc` للسطور.
 *
 * ⚠️ **والقديمُ يبقى**: جلسةٌ محفوظةٌ بـ`fontId` وحده تفتح والخطّان
 *    منها — فلا تتغيّر شاشةٌ تحت يدك لأننا فصلنا حقلًا.
 */
function applyFonts() {
  const font = fontById(ctx.font);

  applyFont($('[data-text]'), ctx.font);
  document.querySelectorAll('.sh-line [data-line-text]')
    .forEach((node) => applyFont(node, ctx.fontDoc));
  /* والأصلُ في لوحة المصدر يتبع صفحتَه أيضًا. */
  document.querySelectorAll('[data-origin-text], .sh-origin-line')
    .forEach((node) => applyFont(node, ctx.fontDoc));
  paintFontChips();

  const app = document.querySelector('.shadow-app');
  if (app) {
    app.style.setProperty('--sh-font-size', ctx.fontSize);
    /*
     * ⚠️ **ودرجةُ البكسل تُطبَّق هنا أيضًا.** كانت تُكتَب عند الضغط
     *    وحده، فتُحفَظ في الجلسة ولا تُقرأ عند فتحها ثانيةً.
     */
    app.style.setProperty('--sh-size', `${ctx.sizePx || DEFAULT_SIZE_PX}px`);
  }

  document.querySelectorAll('[data-font-label]').forEach((n) => {
    n.textContent = fontFullLabel(font);
  });
  document.querySelectorAll('[data-sh="font-pick"]').forEach((n) => {
    n.classList.toggle('on', n.dataset.font === ctx.font);
  });

  const sizeLabel = $('[data-font-size-label]');
  if (sizeLabel) sizeLabel.textContent = `${Math.round(ctx.fontSize * 100)}%`;
}

/**
 * يقيس تغطية السيريلية على هذا الجهاز ويوسم ما ينقصه (بند 17).
 *
 * القياس عند **فتح اللوحة** لا عند الإقلاع: الخطوط تُحمَّل بـ
 * `display=swap` فلا تصل حتى تُطلَب، وقياسٌ مبكّر يتّهمها ظلمًا.
 *
 * وحين لا يصل أيُّ خطٍّ (بلا شبكة، أو شبكةٌ تحجب Google Fonts) نقول
 * ذلك **مرّة واحدة أعلى اللوحة** بدل تسعة تحذيرات متطابقة — المشكلة
 * حينها في الشبكة لا في الخطوط.
 */
let coverageMarked = false;
async function markFontCoverage() {
  if (coverageMarked) return;
  coverageMarked = true;

  let report;
  try {
    report = await measureCoverage();
  } catch {
    coverageMarked = false;
    return;
  }

  const measured = FONTS.filter((f) => f.family);
  const offline = measured.every((f) => report[f.id]?.status === 'not-loaded');

  const warn = $('[data-font-warn]');
  if (warn) {
    warn.hidden = !offline;
    if (offline) warn.textContent = COVERAGE_NOTE['not-loaded'];
  }

  for (const font of FONTS) {
    const chip = document.querySelector(`[data-sh="font-pick"][data-font="${font.id}"]`);
    if (!chip) continue;
    const status = report[font.id]?.status || 'unknown';
    // في حالة انقطاع الشبكة لا نوسم خطًّا بعينه: التحذير أعلاه يكفي.
    const flag = status === 'no-cyrillic' || (status === 'not-loaded' && !offline);
    chip.classList.toggle('lacks', flag);
    if (flag) chip.title = COVERAGE_NOTE[status];
    else chip.removeAttribute('title');
  }
}

/** يفتح الدرج أو يغلقه. */
function toggleDrawer(open) {
  const drawer = $('[data-drawer]');
  const veil = $('[data-drawer-veil]');
  if (!drawer) return;
  const next = open ?? drawer.hidden;
  drawer.hidden = !next;
  if (veil) veil.hidden = !next;
  // التحريك يحتاج إطارًا بعد رفع `hidden` وإلا انتقل فورًا بلا انزلاق.
  requestAnimationFrame(() => drawer.classList.toggle('open', next));
  if (next) drawer.querySelector('input, select, button')?.focus();
}

function setSegActive(container, value) {
  document.querySelectorAll(`${container} button`).forEach((b) => {
    b.classList.toggle('on', b.dataset.val === value);
  });
}

async function toggleRecording(button) {
  if (recorder) {
    const file = await recorder.stop();
    recorder = null;
    button.classList.remove('recording');
    button.innerHTML = '🎙 سجّل الآن';

    if (!ctx.session.sceneId) {
      toast('اتسجّل — بس الجلسة دي مش مربوطة بمشهد فمش هيتحفظ');
      return;
    }

    await addFilesToScene(ctx.session.sceneId, [file], {
      kind: 'audio',
      roles: [AUDIO_ROLE.PRONUNCIATION],
    });
    toastOk('اتحفظ التسجيل في المشهد');
    return;
  }

  if (!canRecord()) return toastError('المتصفح ده مش بيدعم التسجيل');

  try {
    recorder = await startRecording();
    button.classList.add('recording');
    button.innerHTML = '⏹ وقّف التسجيل';
    player.pause();
  } catch (error) {
    console.error(error);
    toastError('محتاج إذن الميكروفون');
  }
}

function showTips() {
  showModal({
    title: '✦ إزاي تستفيد من الظلّ',
    body: html`
      <p style="line-height:1.9;color:var(--ink-soft)">
        <b>الفكرة:</b> تسمع الجملة وتكرّرها فورًا بصوتك — كأنك ظلّ للمتحدّث.
        بيحسّن النطق والإيقاع أسرع من الحفظ.
      </p>
      <div class="kv-row"><span class="k">السرعة</span><span class="v">ابدأ 0.8× واطلع بالتدريج</span></div>
      <div class="kv-row"><span class="k">التكرار</span><span class="v">×10 للجملة الصعبة</span></div>
      <div class="kv-row"><span class="k">التوقّف</span><span class="v">الفاصل اللي بتكرّر فيه</span></div>
      <div class="kv-row"><span class="k">مخفي</span><span class="v">اسمع وقول قبل ما تشوف</span></div>
      <div class="kv-row"><span class="k">الكلمات</span><span class="v">اضغط كلمة تتدرّب عليها لوحدها</span></div>`,
    actions: [{ label: 'يلا نبدأ', value: null, variant: 'primary' }],
  });
}

/* ------------------------------------------------------------------ *
 * النصّ الخارجي
 * ------------------------------------------------------------------ */

/** يعكس مجموعة التحديد على السطور وعلى العدّاد. */
function renderPicked() {
  const count = $('[data-select-count]');
  if (count) count.textContent = picked.size;
  document.querySelectorAll('[data-line]').forEach((node) => {
    node.classList.toggle('picked', picked.has(Number(node.dataset.line)));
  });
}

/** هل المقطعُ الأخير نصٌّ خارجيٌّ عابرٌ — لا صفَّ له في القاعدة (WS40)؟ */
function hasExternalSegment() {
  return Boolean(ctx?.segments?.at(-1)?.temporary);
}

/**
 * يدخل بنصٍّ خارجيّ **كمقطعٍ حقيقيّ** في نفس `ctx.segments` — لا محرّكَ
 * ثانٍ ولا رسمَ يدويّ.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ هذا هو جوهرُ التوحيد الذي طلبتَه (WS40)
 * ═══════════════════════════════════════════════════════════════
 *
 * > «Any text currently being practiced should become a real Shadowing
 * >  Practice Segment and receive the same capabilities, regardless of
 * >  where it came from.»
 *
 * كان هذا النصّ يُقرأ بمحرّكٍ منفصل (`scratchPlayer`) على مقطعٍ وهميّ
 * واحد، ويُكتَب مباشرةً في `[data-text]` بلا `renderWords` — فلا
 * تقسيمَ كلماتٍ، ولا نبرَ متّصلًا بموضعك (بند 15)، ولا حوارَ حفظٍ
 * حقيقيًّا (كان له نسخته الخاصّة `saveScratchTo`). كلُّ ميزةٍ جديدة
 * كانت تحتاج أن تُكتَب **مرّتين**.
 *
 * الآن هو مقطعٌ عاديٌّ — `temporary: true` وحدها تميّزه — يدفعه
 * `player.pushSegment` فيتنقّل إليه بـ`goTo` كأيّ جملة. فيرث مجّانًا:
 * `renderWords` (بند 13)، و`syncSegment`/النبر (بند 15)، وحوارَ
 * الحفظ الموحَّد (بند 5، 19)، وإعداداتِ السرعة والتكرار والصوت
 * (مشتركةٌ أصلًا عبر `player.updateSettings` — بند 14).
 */
function enterExternalText(text) {
  const clean = (text || '').trim();
  if (!clean) return;

  /* ⚠️ أوّل دخولٍ فقط يحفظ موضعك — دخولٌ ثانٍ لا يُبدّل رجوعك (بند 18). */
  if (ctx.returnIndex == null) ctx.returnIndex = player.state.index;

  /* نصٌّ خارجيّ جديد يستبدل القديم — لا يتراكم فوقه. */
  if (hasExternalSegment()) {
    const old = ctx.segments.pop();
    player.dropSegment(old.id, ctx.returnIndex);
  }

  const seg = {
    id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: ctx.session.id,
    sourceObjectId: null,
    sourceTextSnapshot: clean,
    translationSnapshot: null,
    speaker: null,
    isMine: 0,
    order: ctx.segments.length,
    difficulty: 0,
    repetitionsCompleted: 0,
    lastPracticedAt: null,
    practiceStatus: 'pending',
    notes: '',
    /* ⚠️ الشارةُ الوحيدة التي تُميّزه — كلُّ ما عداها يُعامَل كأيّ مقطع. */
    temporary: true,
  };
  ctx.segments.push(seg);
  player.pushSegment({ id: seg.id, text: clean, humanAudioUrl: null });

  const field = $('[data-scratch-input]');
  if (field) field.value = '';
  const box = $('[data-scratch]');
  if (box) box.hidden = true;
  document.querySelector('[data-sh="scratch-open"]')?.classList.remove('on');

  /* المفتاحُ يقرأ الحالَ، والحالُ تغيّر. */
  renderModes();
  /* ⚠️ يبدأ فورًا — لصقتَه لتسمعه، لا لتضغط تشغيلًا بعده. */
  player.start();
}

/**
 * يرجع من النصّ الخارجيّ إلى **نفس** الجملة التي كنتَ عليها (بند 18).
 *
 * ⚠️ **آمنٌ يُنادى دائمًا** — حتى لو فتحتَ الصندوق ولم تلصق فيه شيئًا.
 *    كان أوّلُ سطرٍ هنا `if (!scratchPlayer) return;`، فمَن فتح
 *    الصندوقَ ولم يلصق شيئًا ثم رجع لوضع «جملة» يجده **باقيًا مفتوحًا**
 *    فوق جملته. الإقفالُ لا يحتاج مقطعًا موجودًا، فخرج من تحت الحارس.
 */
function exitExternalText() {
  const box = $('[data-scratch]');
  if (box) box.hidden = true;
  const field = $('[data-scratch-input]');
  if (field) field.value = '';
  document.querySelector('[data-sh="scratch-open"]')?.classList.remove('on');

  if (!hasExternalSegment()) return;

  const seg = ctx.segments.pop();
  const back = ctx.returnIndex ?? Math.max(0, ctx.segments.length - 1);
  ctx.returnIndex = null;
  player.dropSegment(seg.id, Math.min(back, Math.max(0, ctx.segments.length - 1)));
}

/**
 * ينسخ النصّ الحاليّ — جملةً أو كلمةً مختارة — إلى الحافظة (بند 11).
 *
 * ⚠️ **نفسُ منطق اختيار «ماذا» في `openSaveDialog` تمامًا** — لا
 *    قاعدةً ثانية تُكتَب هنا فتختلف يومًا عن أختها.
 */
async function copyCurrentText() {
  const segment = ctx.segments[player.state.index];
  const selectedWord = document.querySelector('[data-word].selected');
  const text = selectedWord
    ? selectedWord.textContent.trim()
    : segment?.sourceTextSnapshot || '';
  if (!text) return toast('مفيش نصّ نسخه');

  try {
    await navigator.clipboard.writeText(text);
    toastOk('اتنسخت');
  } catch {
    toastError('المتصفّح مارضاش ينسخ');
  }
}

/**
 * يحفظ الجملة الحالية أو الكلمة المختارة.
 *
 * الكلمة تسبق الجملة حين تكون مختارة: أنت واقفٌ عندها الآن، فهي ما
 * تقصد حفظه.
 */
async function openSaveDialog() {
  const segment = ctx.segments[player.state.index];
  const selectedWord = document.querySelector('[data-word].selected');

  const kind = selectedWord ? SAVED_KIND.WORD : SAVED_KIND.SENTENCE;
  const defaultText = selectedWord
    ? selectedWord.textContent.trim()
    : segment?.sourceTextSnapshot || '';

  const [tags, already] = await Promise.all([listSavedTags(), isSaved(defaultText, kind)]);

  // القيم تُقرأ داخل `onSubmit`: النافذة تُزال من الـDOM عند الإغلاق.
  await showModal({
    title: already ? '🔖 محفوظة — زوّد تصنيف' : '🔖 احفظ في المحفوظات',
    submitLabel: 'احفظ',
    body: html`
      <div class="field">
        <label for="sv-text">${kind === SAVED_KIND.WORD ? 'الكلمة' : 'الجملة'}</label>
        <textarea id="sv-text" name="text" dir="ltr" lang="ru"
          style="min-height:${kind === SAVED_KIND.WORD ? '52' : '96'}px">${defaultText}</textarea>
      </div>

      <div class="field">
        <label>ليه بتحفظها؟</label>
        <div class="sv-tags">
          ${raw(
            tags
              .map(
                (t) => html`<label class="sv-tag">
                  <input type="checkbox" name="tag_${t.id}" value="1"
                    ${already?.tagIds?.includes(t.id) ? 'checked' : ''} />
                  <span>${t.label}</span>
                </label>`
              )
              .join('')
          )}
        </div>
        <input type="text" name="newTag" placeholder="أو اكتب سبب جديد…" maxlength="80" />
      </div>

      <div class="field">
        <label for="sv-note">ملاحظة (اختياري)</label>
        <input id="sv-note" name="note" type="text" value="${already?.note || ''}"
          placeholder="مثلًا: بنطقها согласовы- غلط" />
      </div>

      <p class="field-hint">
        الحفظ علامة انتباه منك — <strong>مش دليل إتقان</strong>. الإتقان
        بيجي لمّا تستخدمها في موقف حقيقي.
      </p>`,

    async onSubmit(data, close) {
      const text = (data.text || '').trim();
      if (!text) {
        toastError('مفيش نصّ نحفظه');
        throw new Error('فارغ');
      }

      const tagIds = tags.filter((t) => data[`tag_${t.id}`]).map((t) => t.id);
      if (data.newTag?.trim()) tagIds.push((await addSavedTag(data.newTag)).id);

      await saveItem({
        text,
        kind,
        tagIds,
        note: data.note || '',
        translation: segment?.translationSnapshot || '',
        sourceType: ctx.session.sourceType,
        sourceId: ctx.session.sourceId,
        segmentId: segment?.id || null,
        sceneId: ctx.session.sceneId,
        sessionId: ctx.session.id,
      });

      close();
      toastOk(tagIds.length ? 'اتحفظت بتصنيفها' : 'اتحفظت');
    },
  });
}

/** لوحات الشريط السفلي — كلها أرقام حقيقية من القاعدة. */
async function openPanel(name) {
  if (name === 'report') {
    const practiced = ctx.segments.filter((s) => s.repetitionsCompleted > 0);
    const total = ctx.segments.reduce((sum, s) => sum + (s.repetitionsCompleted || 0), 0);
    return showModal({
      title: '📊 تقرير الجلسة',
      body: html`
        <div class="kv-row"><span class="k">جمل اتدرّبت عليها</span>
          <span class="v num">${practiced.length} من ${ctx.segments.length}</span></div>
        <div class="kv-row"><span class="k">إجمالي التكرارات</span><span class="v num">${total}</span></div>
        <div class="kv-row"><span class="k">جمل صعبة</span>
          <span class="v num">${ctx.segments.filter((s) => s.practiceStatus === 'difficult').length}</span></div>
        <div class="kv-row"><span class="k">السرعة</span><span class="v num">${player.state.settings.rate}×</span></div>
        <p class="field-hint" style="margin-top:var(--sp-3)">
          الأرقام دي <strong>ممارسة</strong> — مش إتقان.
        </p>`,
      actions: [{ label: 'تمام', value: null, variant: 'primary' }],
    });
  }

  if (name === 'difficult') {
    // مصدران في لوحة واحدة: ما علّمته «صعبة» أثناء التدريب (خاصّ بهذه
    // الجلسة)، وما حفظته بتصنيفاته (يتبعك عبر الجلسات كلها).
    const hard = ctx.segments.filter((s) => s.practiceStatus === 'difficult');
    const [saved, tags] = await Promise.all([listSaved({ limit: 60 }), listSavedTags()]);
    const label = (id) => tags.find((t) => t.id === id)?.label || id;

    const value = await showModal({
      title: '♡ المحفوظات والصعب',
      body: html`
        <div class="sh-section-lbl" style="text-align:start">🔖 محفوظاتك (${saved.length})</div>
        ${raw(
          saved.length
            ? saved
                .map(
                  (s) => html`<div class="sv-row">
                    <div class="sv-row-main">
                      <span class="ru" dir="ltr" lang="ru">${s.text}</span>
                      ${raw(
                        (s.tagIds || []).length
                          ? html`<span class="sv-row-tags">${raw(
                              s.tagIds.map((t) => html`<span class="sv-chip">${label(t)}</span>`).join('')
                            )}</span>`
                          : ''
                      )}
                      ${raw(s.note ? html`<span class="sv-row-note">${s.note}</span>` : '')}
                    </div>
                    ${raw(s.sessionId || s.sceneId ? html`
                      <button class="row-goto" data-sh="goto-origin"
                        data-session="${s.sessionId || ''}" data-scene="${s.sceneId || ''}"
                        aria-label="ارجع لأصلها">↩</button>` : '')}
                    <button class="row-del" data-sh="unsave" data-id="${s.id}"
                      aria-label="شيلها من المحفوظات">${raw(icon('trash', 15))}</button>
                  </div>`
                )
                .join('')
            : '<p class="field-hint">لسه مفيش محفوظات. اضغط «🔖 احفظها» وانت واقف على جملة أو كلمة.</p>'
        )}

        <div class="sh-section-lbl" style="text-align:start;margin-top:var(--sp-4)">
          ⚑ معلّمة صعبة في الجلسة دي (${hard.length})
        </div>
        ${raw(
          hard.length
            ? hard
                .map(
                  (s) =>
                    html`<div class="kv-row"><span class="k" dir="ltr">${s.sourceTextSnapshot}</span>
                      <span class="v num">×${s.repetitionsCompleted}</span></div>`
                )
                .join('')
            : '<p class="field-hint">مفيش جمل معلّمة صعبة لسه. اضغط «صعبة» على أي جملة.</p>'
        )}`,
      actions: [{ label: 'تمام', value: null, variant: 'primary' }],
    });
    return value;
  }

  if (name === 'history') {
    const rows = await recentPractice(20);
    return showModal({
      title: '🕘 آخر اللي اتدرّبت عليه',
      body: rows.length
        ? rows
            .map(
              (r) =>
                html`<div class="kv-row"><span class="k" dir="ltr">${r.text}</span>
                  <span class="v num">×${r.repetitions}</span></div>`
            )
            .join('')
        : '<p class="field-hint">لسه مفيش ممارسة مسجّلة.</p>',
      actions: [{ label: 'تمام', value: null, variant: 'primary' }],
    });
  }

  // ⚙️ في الشريط السفلي يفتح الدرج نفسه — لا نافذةً تعرض ما في الدرج
  // للقراءة فقط. مدخلان لمكانٍ واحد.
  if (name === 'settings') return toggleDrawer(true);

  if (name === 'online-tr') {
    const online = await trEnabled();
    const ok = await confirmAction({
      title: 'الترجمة عبر الإنترنت',
      message:
        `دلوقتي <strong>${online ? 'مفعّلة' : 'مطفية'}</strong>.<br><br>` +
        'الترجمة المحفوظة عندك بتتعرض دايمًا. دي بس بتجيب الناقص من ' +
        'خدمات خارجية — يعني بتخرج بياناتك برّه جهازك.',
      confirmLabel: online ? 'اطفيها' : 'فعّلها',
    });
    if (!ok) return;
    const now = await setTrEnabled(!online);
    toast(now ? 'الترجمة الأونلاين اتفعّلت' : 'الترجمة الأونلاين اتطفت');
  }
}

function wireInteractions(main) {
  /*
   * ⚠️ **`pointerdown` على المستند يقفل لوحةَ الخطّ الصغيرة — إلّا
   *    داخلها.** أوّلُ نسخةٍ أغلقت على أيّ ضغطة فكانت تُغلق قبل أن تصل
   *    الضغطةُ إلى الخيار، فيبدو الاختيارُ بلا أثر.
   */
  document.addEventListener('pointerdown', (event) => {
    if (!fontPop) return;
    if (event.target.closest('.sh-fontpop')) return;
    if (event.target.closest('[data-sh="fontpop"]')) return;
    closeFontPop();
  }, wired());

  // السحب يطبّق فورًا بلا كتابة في القاعدة؛ الحفظ عند رفع الإصبع.
  main.addEventListener('input', (event) => {
    const key = event.target.dataset.tuneRange || event.target.dataset.tuneNum;
    if (key) return setTuner(key, event.target.value, { silent: true });

    if (event.target.hasAttribute('data-font-size')) {
      ctx.fontSize = Number(event.target.value) / 100;
      applyFonts();
    }

    /* صندوقُ المسودّة يحفظ نفسَه — راجع `scheduleDraftSave`. */
    if (event.target.hasAttribute('data-draft-box')) {
      scheduleDraftSave(event.target.value);
    }
  }, wired());

  main.addEventListener('change', (event) => {
    const key = event.target.dataset.tuneRange || event.target.dataset.tuneNum;
    if (key) return setTuner(key, event.target.value);

    if (event.target.hasAttribute('data-font-size')) {
      return void saveSessionSettings(ctx.session.id, { fontSize: ctx.fontSize }).catch(() => {});
    }

    if (event.target.dataset.sh === 'voice-select') {
      const voiceName = event.target.value;
      player.updateSettings({ voiceName });
      saveSessionSettings(ctx.session.id, { voiceId: voiceName }).catch(() => {});
      toast(`الصوت: ${voiceName}`);
    }
  }, wired());

  main.addEventListener('submit', (event) => {
    if (!event.target.hasAttribute('data-scratch')) return;
    event.preventDefault();
    enterExternalText(new FormData(event.target).get('scratch'));
  }, wired());

  main.addEventListener('click', async (event) => {
    // النقر خارج الدرج يغلقه — كأيّ ورقة منزلقة.
    if (event.target.hasAttribute('data-drawer-veil')) return toggleDrawer(false);

    const line = event.target.closest('[data-line]');
    if (line) {
      const at = Number(line.dataset.line);
      // في وضع التحديد النقر يختار لا ينتقل — وإلا تعذّر الاختيار
      // أصلًا لأن كل نقرة تقفز بالجلسة.
      if (selecting) {
        if (picked.has(at)) picked.delete(at);
        else picked.add(at);
        renderPicked();
        return;
      }
      return player.goTo(at);
    }

    const mark = event.target.closest('[data-expr]');
    if (mark) return openAnalysisDrawer(mark.dataset.expr);

    /*
     * ⚠️ **نقرةُ الكلمة لها بابٌ واحد: `wireChips`.**
     *
     * كان هنا معالِجٌ ثانٍ للشيء نفسه — ويعمل مع الأوّل على نفس
     * النقرة. وكان يكتب:
     *
     *     player.updateSettings({ practiceMode: PRACTICE_MODE.WORD });
     *
     * **ولا سطرَ يعيدها إلى الجملة أبدًا.** فبعد أوّل كلمةٍ تلمسها
     * يصير زرُّ التشغيل ينطق **تلك الكلمة** إلى آخر الجلسة — وهو
     * بلاغُك: «لما باجي أقرا كلمة معدتش بعرف أشغّل جملة تاني».
     *
     * ⚠️ **وقِستُه**: تشغيل ← «Он придёт завтра.» مرّتين. ثم نقرُ
     *    كلمة ← «придёт». ثم تشغيل ← «придёт» «придёт». الجملةُ لا
     *    تعود.
     *
     * ⚠️ وأسوأُ ما فيه أنني كتبتُ فوق `wireChips` تعليقًا يقول
     *    «نقرةٌ تُسمعك الكلمة — **ولا تغيّر الوضع**»، وكان هذا
     *    السطرُ يغيّره من تحتها. تعليقٌ يصف نيّةً لا سلوكًا أسوأُ من
     *    لا تعليق: يجعلك تصدّق أن الأمر مفحوص.
     *
     * والاختيارُ البصريّ انتقل إلى `wireChips` حيث تقع النقرة.
     */

    // كشف الجملة المخفيّة بالنقر عليها
    const text = event.target.closest('[data-text].hidden-mode');
    if (text) {
      text.classList.remove('hidden-mode');
      return;
    }

    const btn = event.target.closest('[data-sh]');
    if (!btn) return;

    switch (btn.dataset.sh) {
      case 'exit':
        return navigate(ctx.session.sceneId ? `/scene/${ctx.session.sceneId}` : '/life');

      // التدريب طبقةٌ فوق المحتوى لا بديلٌ عنه: طريق العودة للأصل
      // يبقى ظاهرًا داخل الجلسة نفسها (بند 13).
      case 'open-source':
        return navigate(btn.dataset.to);

      case 'tips':
        return showTips();

      case 'play':
        return togglePlay();

      // التنقّل يخصّ جمل الجلسة، فالخروج من النصّ الخارجي جزءٌ منه.
      case 'prev': exitExternalText(); return player.previous();
      case 'next': exitExternalText(); return player.next();

      case 'scratch-open': {
        const box = $('[data-scratch]');
        if (!box) return;
        box.hidden = !box.hidden;
        btn.classList.toggle('on', !box.hidden);
        if (!box.hidden) $('[data-scratch-input]')?.focus();
        return;
      }

      case 'scratch-close': {
        const box = $('[data-scratch]');
        if (box) box.hidden = true;
        document.querySelector('[data-sh="scratch-open"]')?.classList.remove('on');
        return;
      }

      case 'scratch-clear':
        return exitExternalText();

      case 'copy-item':
        return copyCurrentText();

      case 'drawer':       return toggleDrawer(true);
      case 'drawer-close': return toggleDrawer(false);

      case 'display': {
        ctx.display = btn.dataset.val;
        setSegActive('[data-display-seg]', ctx.display);
        syncSegment();
        return saveSessionSettings(ctx.session.id, { displayMode: ctx.display });
      }

      /*
       * ⚠️ **تصادمُ اسمٍ أعطبَ إعدادَ الترجمة بالكامل.**
       *
       * لوحةُ العرض في السكّة كانت تُصدر `data-sh="mode"` — وهو نفسُ
       * اسمِ مفتاحِ **نمط التكرار** في الدرج. فضغطُ «مصري» كان يقع
       * في حالةِ التكرار، فتقرأ `dataset.val` (وهو `undefined`)
       * وتضبط التكرارَ على «بالعدد»، **ولا تلمس الترجمة إطلاقًا**.
       *
       * ⚠️ **وقِستُه**: بعد ضغط «مصري» يبقى `ru` هو المُضاء والسكّة
       *    تقول «روسي». عطلٌ صامتٌ تمامًا — لا خطأ ولا رسالة.
       *
       * وهذا ما يجعل `switch` على سلسلةٍ نصّيّة خطِرًا: اسمان
       * يلتقيان بلا أن يشتكي أحد. فصارت لوحةُ العرض `disp`.
       */
      case 'disp': {
        ctx.display = btn.dataset.v;
        await saveSessionSettings(ctx.session.id, { displayMode: ctx.display });
        syncSegment();
        return renderRail();
      }

      case 'mode': {
        const mode = btn.dataset.val === 'continuous' ? REPEAT_MODE.CONTINUOUS : REPEAT_MODE.COUNT;
        player.updateSettings({ repeatMode: mode });
        setSegActive('[data-repeat-seg]', btn.dataset.val);
        return saveSessionSettings(ctx.session.id, { repeatMode: mode });
      }

      /* ---------- WS24 · أفعال البنية الجديدة ---------- */

      /* شرطةٌ في أعلى المسرح — نقرةٌ تقفز إلى جملتها. */
      case 'tick':
        return goSegment(Number(btn.dataset.i));

      /* مقبضُ الورقة — أزرارُه الثلاثة ومقاساتُها. */
      case 'doc':
        return setDoc(btn.dataset.fit);

      case 'rail':
        rail.open = !rail.open;
        return renderRail();

      case 'rail-close':
        rail.open = false;
        return renderRail();

      case 'tool':
        return pickTool(btn.dataset.v);

      /* أزرارُ اللوحة — كلٌّ ينادي ما كان يعمل أصلًا. */
      case 'tune': {
        const [key, value] = String(btn.dataset.v).split(':');
        setTuner(key, Number(value));
        return renderRail();
      }

      case 'fsize': {
        /*
         * §١٩٫٢ — ثلاث درجات لا منزلق: 36 · 41 · 48.
         *
         * ⚠️ **وكانت تكتب البكسل في حقلٍ معناه نسبة.** `ctx.fontSize`
         *    نسبةٌ (1 = 100%) يكتبها منزلقُ الخطّ ويقرأها
         *    `--sh-font-size`؛ وهذه كانت تضع فيها `48`، فتصير
         *    النسبةُ 4800% — وهو ما ظهر حرفيًّا على السكّة حين صارت
         *    تعرض القيَم. حقلٌ بمعنيين يفسد كليهما.
         *
         * ⚠️ **ولم تكن تُحفَظ أصلًا**: تختار الحجمَ ثم تعود للجلسة
         *    فتجده كما كان. فصار له حقلُه `sizePx`.
         */
        const px = Number(btn.dataset.v);
        ctx.sizePx = px;
        document.querySelector('.shadow-app')?.style.setProperty('--sh-size', `${px}px`);
        await saveSessionSettings(ctx.session.id, { sizePx: px });
        return renderRail();
      }

      /*
       * ⚠️ **وكانت تُغيّر متغيّرًا ولا تُخبر المحرّك ولا تحفظ.**
       *
       * `ctx.audioSource = …` وحدها. والمحرّكُ يقرأ من `config` لا من
       * `ctx`، والقاعدةُ لا تعرف شيئًا. فحتى لو وُجد الزرُّ لم يكن
       * ليفعل شيئًا: الصوتُ يبقى آليًّا، والاختيارُ يضيع بإغلاق
       * الجلسة. عطلان في سطرٍ واحد.
       *
       * فصارت تمرّ من `setAudioSource` نفسِها التي يمرّ منها زرُّ
       * الدورة في الدرج — بابٌ واحدٌ يفعل الثلاثة.
       */
      case 'audio-src':
        return setAudioSource(btn.dataset.v);

      /* وجهُ المصدر: نصٌّ أو صورةٌ أو صوت — الشرحُ فوق FACES. */
      case 'face':
        releaseAudio();
        face = btn.dataset.v;
        renderFaces();
        return undefined;

      case 'face-open':
        return openLightbox(btn.dataset.v, ctx.scene?.id);

      case 'well':
        /*
         * ⚠️ **تبديلُ التبويب يُسكِت التسجيل.** بلاغُك: «أشغّل فويس
         *    وأنقل لتاب تانية، يفضل شغّال ومش هلاقي زرار يقفله».
         *    وهو حقٌّ: الزرُّ نفسُه يُمحى مع رسم التبويب الجديد،
         *    فيبقى الصوتُ بلا مقبض.
         *
         * ⚠️ وقاعدةٌ أعمّ من الحالة: **ما اختفى زرُّه لا يبقى صوتُه**.
         */
        /*
         * ⚠️ **ولم يعد يُسكِته** (WS35). كان `releaseAudio()` هنا بقاعدة
         *    «ما اختفى زرُّه لا يبقى صوتُه»، وبلاغُك صحّحها: المطلوبُ
         *    أن يكمل ويكون له مقبض. فالزرُّ يختفي مع التبويب —
         *    و`paintVoiceBar` تعطيه شريطًا بديلًا في نفس اللحظة.
         */
        well = btn.dataset.v;
        await renderWells();
        paintVoiceBar();
        return;

      case 'well-open':
        return openLightbox(btn.dataset.v, ctx.scene.id);

      case 'well-play':
        return playVoice(btn.dataset.v);

      case 'well-shadow': {
        const script = await scripts.get(btn.dataset.v);
        if (!script?.text) return toastError('السكريبت فاضي');
        /* ⚠️ يمرّ من نفس بابِ «سكريبت ← ظلّ» — لا مسارَ ثانٍ يتقادم. */
        return openShadowForScript(script.id, ctx.scene.id);
      }

      /* المفتاحُ على الشاشة — راجع سجلّ MODES. */
      case 'mode-go': {
        const mode = MODES.find((m) => m.id === btn.dataset.v);
        if (!mode) return undefined;
        /* تبديلُ ما يُقرأ يُسكِت ما كان يُقرأ — ومنه تسجيلٌ شغّال. */
        releaseAudio();

        /*
         * ⚠️ **آخرُ ضغطةٍ تفوز — ولو تسابقت الضغطات.**
         *
         * `enter` غيرُ متزامنة (تحفظ في القاعدة). فثلاثُ ضغطاتٍ
         * متتاليةٍ تبدأ ثلاثَ عمليّاتٍ تنتهي بترتيبٍ لا يضمنه أحد.
         * **قِستُه**: كلمة ← جملة برّه ← نصّ، فانتهت «جملة برّه»
         * بعد «نصّ» فأظهرت صندوقَها **فوق وضعِ النصّ**. الشاشةُ تقول
         * حالًا والمحرّكُ في حالٍ آخر.
         *
         * والتذكرةُ تحسم: مَن بدأ ولم يعد الأحدثَ لا يكتب شيئًا.
         */
        const my = ++modeTicket;
        await mode.enter();
        if (my !== modeTicket) return undefined;

        /*
         * ⚠️ **والرسمُ بعد التذكرة لا داخل `enter`.** أوّلُ إصلاحٍ
         *    وضع التذكرةَ حول `renderModes` وحدها، وترك كلَّ وضعٍ
         *    يلمس الـDOM داخل `enter` — أي **قبل** الفحص. فبقي
         *    السباق: «جملة برّه» تُظهر صندوقَها بعد أن أخفاه «نصّ».
         *    **قِستُه**: `hidden === false` بعد الرجوع لوضع النصّ.
         *
         *    فصار `enter` عملًا غيرَ متزامنٍ لا يلمس شاشة، و`paint`
         *    رسمًا متزامنًا لا يقع إلّا للفائز.
         */
        mode.paint?.();
        renderModes();
        renderRail();
        return undefined;
      }

      /*
       * لوحةُ السكّة تبقى: فيها «متّصل بلا تكرار» وهو تفصيلٌ داخل
       * وضع النصّ لا وضعٌ رابع. ⚠️ وتمرّ من `setPractice` نفسِها —
       * مكانٌ واحدٌ يكتب الوضعَ، فلا يفترق البابان بعد شهر.
       */
      case 'mode-set': {
        const mode = btn.dataset.v;
        await setPractice(mode);
        toastOk(mode === PRACTICE_MODE.WORD ? 'بيقرا كلمة كلمة' : mode === PRACTICE_MODE.CONTINUOUS ? 'بيقرا متّصل' : 'بيقرا الجملة كاملة');
        renderModes();
        return renderRail();
      }

      /* ---- مسودّة المذاكرة (WS25) ---- */

      case 'draft-copy': {
        const subject = draftSubject();
        if (!subject.text) return toastError('مفيش جملة مختارة');
        try {
          await navigator.clipboard.writeText(subject.text);
          toastOk('اتنسخت — روح حلّلها وارجع الصقها');
        } catch {
          /* ⚠️ الحافظةُ تُرفَض بلا HTTPS أو بلا إذن. فلا نصمت: نختار
                النصَّ في الصندوق ليكون النسخُ اليدويُّ ضغطةً واحدة. */
          toastError('المتصفّح مارضاش ينسخ — حدّد النصّ وانسخه بإيدك');
        }
        return undefined;
      }

      case 'draft-img': {
        const [file] = await pickFiles({ accept: 'image/*', multiple: false });
        if (!file) return undefined;
        const subject = draftSubject();
        if (!openDraftId) {
          const born = await openDraft(subject.kind, subject.text, {
            sessionId: ctx.session?.id || null,
            sceneId: ctx.scene?.id || null,
          });
          openDraftId = born.id;
        }
        await addDraftImage(openDraftId, file);
        toastOk('الصورة اتضافت للمسودّة');
        return renderDraft();
      }

      case 'draft-open':
        return openLightbox(btn.dataset.v, ctx.scene?.id);

      case 'draft-ocr': {
        if (!openDraftId) return undefined;
        /*
         * ⚠️ **والانتظارُ يُقال.** أوّلُ استخراجٍ يحمّل محرّكَ القراءة،
         *    وهو ثقيلٌ ويأخذ دقائق على شبكةٍ بطيئة. زرٌّ صامتٌ دقيقتين
         *    يقرأه المستخدمُ «مكسور» فيضغطه خمس مرّات.
         */
        const dismiss = toast('بنقرا الصورة… أوّل مرّة بتاخد وقت', { duration: 10 * 60 * 1000 });
        try {
          await ocrIntoDraft(openDraftId, btn.dataset.v);
          dismiss();
          toastOk('النصّ اتضاف تحت اللي في المسودّة');
        } catch (error) {
          dismiss();
          toastError(error.message);
        }
        return renderDraft();
      }

      case 'draft-shadow': {
        if (!openDraftId) return undefined;
        return openShadowFromDraft(openDraftId);
      }

      case 'sky-pick': {
        const [file] = await pickFiles({ accept: 'image/*', multiple: false });
        if (!file) return undefined;
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        await settings.set(SKY_KEY, blob);
        await applySky();
        toastOk('اتغيّرت خلفيّة الجلسة');
        return renderRail();
      }

      case 'sky-clear':
        await settings.remove(SKY_KEY);
        await applySky();
        toast('رجعت النجوم');
        return renderRail();

      case 'word-go': {
        const word = btn.dataset.v;
        if (word) navigate(`/word/${encodeURIComponent(word)}`);
        return undefined;
      }

      /*
       * ⚠️ **وهذا الزرُّ كان يقلب وضعَ التشغيل في السرّ.**
       *
       * كان يُخفي الرقائقَ **ويبدّل** `practiceMode` بين الجملة
       * والكلمة في الحركة نفسها. فتضغط ظانًّا أنك تُظهر شيئًا، فيتغيّر
       * **ما يُنطَق** — «التحكّم في التشغيل بيبوظ معرفش امتى». وأنت لم
       * تطلب تغييرَ الوضع، ولم يقل لك أحدٌ إنه تغيّر.
       *
       * فصار الزرُّ طريقًا **مُعلَنًا** إلى وضع الكلمة، يقول ما فعل،
       * ويمرّ من نفس باب `PLAY MODE` في الدرج — بابٌ واحدٌ للفعل
       * الواحد، فلا ينازع اثنان على قيمةٍ واحدة.
       */
      /*
       * ⚠️ **بابٌ قديمٌ صار يمرّ من المفتاح الجديد.** كان يكتب الوضعَ
       *    بنفسه — بابٌ ثالثٌ لنفس الشيء، وقد كلّفنا عطلًا في WS27.
       *    فصار يستدعي `MODES` كما يستدعيه الزرُّ الظاهر.
       */
      case 'words': {
        const word = player.state.settings.practiceMode === PRACTICE_MODE.WORD;
        await MODES.find((m) => m.id === (word ? 'text' : 'word')).enter();
        document
          .querySelectorAll('[data-sh="words"]')
          .forEach((node) => node.classList.toggle('on', !word));
        renderWords();
        renderModes();
        renderRail();
        toastOk(word ? 'بيقرا الجملة كاملة' : 'بيقرا كلمة كلمة');
        return;
      }

      case 'voices': {
        const select = $('[data-sh="voice-select"]');
        select.hidden = !select.hidden;
        btn.classList.toggle('on', !select.hidden);
        return;
      }

      case 'voice': {
        const select = $('[data-sh="voice-select"]');
        select.hidden = false;
        select.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }

      /* الرسالةُ نفسُها بابٌ — راجع `fetchMissingTranslation`. */
      case 'tr-on': {
        await openPanel('online-tr');
        /* فإن فُعِّلت، تُجلَب ترجمةُ الجملة التي أنت عليها فورًا. */
        if (await trEnabled()) await fetchMissingTranslation(ctx.segments[player.state.index]);
        return;
      }

      case 'toggle-tr': {
        const shown = btn.classList.toggle('on');
        document.querySelectorAll('.sh-line .tr').forEach((n) => { n.hidden = !shown; });
        if (shown && !document.querySelector('.sh-line .tr')) {
          toast('مفيش ترجمات محفوظة للجمل دي');
        }
        return;
      }

      case 'difficult': {
        const segment = ctx.segments[player.state.index];
        const next = segment.practiceStatus !== 'difficult';
        /* ⚠️ مقطعٌ مؤقّتٌ (نصٌّ خارجيّ، WS40) لا صفَّ له يُحدَّث. */
        const updated = segment.temporary
          ? { ...segment, practiceStatus: next ? 'difficult' : 'practiced' }
          : await markDifficult(segment.id, next);
        ctx.segments[player.state.index] = updated;
        const node = document.querySelector(`[data-line="${player.state.index}"]`);
        node?.classList.toggle('difficult', updated.practiceStatus === 'difficult');
        btn.classList.toggle('on', updated.practiceStatus === 'difficult');
        toast(updated.practiceStatus === 'difficult' ? 'اتعلّمت كصعبة' : 'اتشالت من الصعب');
        return;
      }

      case 'save-item':
        return openSaveDialog();

      /* ---- تحديد المقاطع (بند 21) ---- */

      case 'select-mode': {
        selecting = !selecting;
        btn.classList.toggle('on', selecting);
        const bar = $('[data-select-bar]');
        if (bar) bar.hidden = !selecting;
        document.querySelector('[data-lines]')?.classList.toggle('picking', selecting);
        if (!selecting) {
          // الخروج من وضع التحديد يرفع الحصر — لا يُبقيك محصورًا بلا
          // شريطٍ يُذكّرك بأنك محصور.
          picked.clear();
          player.setSelection([]);
        }
        renderPicked();
        return;
      }

      case 'sel': {
        const all = ctx.segments.map((_, i) => i);
        const pick = btn.dataset.pick;
        picked.clear();
        if (pick === 'all') all.forEach((i) => picked.add(i));
        if (pick === 'difficult') {
          all.filter((i) => ctx.segments[i].practiceStatus === 'difficult').forEach((i) => picked.add(i));
        }
        if (pick === 'unpracticed') {
          all.filter((i) => !(ctx.segments[i].repetitionsCompleted > 0)).forEach((i) => picked.add(i));
        }
        renderPicked();
        return;
      }

      case 'sel-apply': {
        if (!picked.size) return toast('محدّدتش أي جملة');
        player.setSelection(picked);
        player.goTo([...picked].sort((a, b) => a - b)[0]);
        toastOk(`التدريب على ${picked.size} جملة`);
        // نخرج من وضع الاختيار ونُبقي الحصر: أنت الآن تتدرّب عليها.
        selecting = false;
        const bar = $('[data-select-bar]');
        if (bar) bar.hidden = true;
        document.querySelector('[data-lines]')?.classList.remove('picking');
        document.querySelector('[data-sh="select-mode"]')?.classList.remove('on');
        return;
      }

      case 'record':
        return toggleRecording(btn);

      case 'tell':
        return tellItNow(btn);

      /*
       * دورةٌ من ثلاثة (بند 22): آلي → تسجيلي (إن وُجد) → ناطق أصلي.
       * والاختيار الثالث يمرّ بموافقةٍ صريحة أوّل مرّة، فإن رُفضت لا
       * يتغيّر شيء — لا نُفعّل ما لم يُوافَق عليه ثم «نتذكّر» لاحقًا.
       */
      case 'audio-source': {
        /* دورةٌ من ثلاثة (بند 22): آلي → تسجيلي (إن وُجد) → ناطق أصلي. */
        const choices = audioChoices();
        const next = choices[(choices.indexOf(ctx.audioSource) + 1) % choices.length];
        return setAudioSource(next);
      }

      case 'my-role': {
        const on = player.state.settings.practiceMode !== PRACTICE_MODE.MY_ROLE;
        player.updateSettings({
          practiceMode: on ? PRACTICE_MODE.MY_ROLE : PRACTICE_MODE.SENTENCE,
          // في وضع الدور نمرّ مرّة واحدة على كل مقطع ونتقدّم تلقائيًا،
          // فالمحادثة تجري كمحادثة لا كتمرين تكرار.
          repeatCount: on ? 1 : ctx.session.repeatCount,
          autoAdvance: true,
        });
        btn.classList.toggle('on', on);
        toast(on ? 'دورك: التطبيق هيسكت عشان تقول' : 'رجعنا للتدريب العادي');
        return;
      }

      case 'go':
        return navigate(btn.dataset.to);

      case 'lang': {
        const index = LANGUAGES.findIndex((l) => l.code === ctx.lang);
        const next = LANGUAGES[(index + 1) % LANGUAGES.length];
        ctx.lang = next.code;
        btn.querySelector('[data-lang-flag]').textContent = next.flag;
        btn.querySelector('[data-lang-label]').textContent = next.label;
        syncSegment();
        return saveSessionSettings(ctx.session.id, { translationLang: next.code });
      }

      case 'font': {
        const panel = $('[data-fontpanel]');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        btn.classList.toggle('on', !panel.hidden);
        if (!panel.hidden) {
          panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          markFontCoverage();
        }
        return;
      }

      case 'font-pick':
        return pickFont(btn.dataset.page, btn.dataset.font);

      case 'page-go':
        return void goToPage(Number(btn.dataset.v));

      /* مفتاحُ الخطّ الصغير المعروض دائمًا على كلّ صفحة. */
      case 'fontpop':
        return toggleFontPop(btn.dataset.page === 'doc' ? 'doc' : 'stage', btn);

      case 'stress': {
        ctx.stress = !ctx.stress;
        btn.classList.toggle('on', ctx.stress);
        syncSegment();
        return saveSessionSettings(ctx.session.id, { showStress: ctx.stress });
      }

      /* ---- لوحة الصورة ---- */

      case 'cover-tools': {
        const rest = $('[data-cover-rest]');
        if (rest) rest.hidden = !rest.hidden;
        return undefined;
      }

      case 'cover-pin': {
        ctx.coverPinned = !ctx.coverPinned;
        const box = $('[data-cover-box]');
        box?.classList.toggle('pinned', ctx.coverPinned);
        btn.classList.toggle('on', ctx.coverPinned);
        btn.setAttribute('aria-pressed', String(ctx.coverPinned));
        toast(ctx.coverPinned ? 'الصورة ثابتة وانت بتقلّب' : 'الصورة بتتحرّك مع الصفحة');
        return saveSessionSettings(ctx.session.id, { coverPinned: ctx.coverPinned });
      }

      case 'cover-zoom': {
        const step = 20 * Number(btn.dataset.dir);
        // 100% تملأ عرض الإطار؛ ما فوقها يفيض فيصير قابلًا للتمرير
        // أفقيًّا ورأسيًّا داخله.
        ctx.coverZoom = Math.max(100, Math.min(400, ctx.coverZoom + step));
        applyCover();
        return saveSessionSettings(ctx.session.id, { coverZoom: ctx.coverZoom });
      }

      case 'cover-fit': {
        ctx.coverZoom = 100;
        applyCover();
        $('[data-cover-scroll]')?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        return saveSessionSettings(ctx.session.id, { coverZoom: 100 });
      }

      case 'panel':
        return openPanel(btn.dataset.panel);

      default:
        return;
    }
  }, wired());

  // الحالة الابتدائية للأزرار
  main.querySelector('[data-sh="stress"]')?.classList.toggle('on', ctx.stress);
  applyFonts();

  setSegActive('[data-display-seg]', ctx.display);
  setSegActive(
    '[data-repeat-seg]',
    ctx.session.repeatMode === REPEAT_MODE.CONTINUOUS ? 'continuous' : 'count'
  );
}

/** يكتب حالة الصورة على المتغيّرات المخصّصة — مصدر واحد للحقيقة. */
function applyCover() {
  const box = $('[data-cover-box]');
  if (!box) return;
  box.style.setProperty('--cover-h', `${ctx.coverHeight}px`);
  box.style.setProperty('--cover-zoom', `${ctx.coverZoom}%`);
  const label = box.querySelector('[data-cover-zoom]');
  if (label) label.textContent = `${ctx.coverZoom}%`;
}

/**
 * مقبض ارتفاع لوحة الأصل، وحفظ حالة طيّها.
 *
 * نفس منطق مقبض الصورة: الحدّ الأدنى يمنع اختفاء اللوحة فيتعذّر
 * إرجاعها، والأعلى يُبقي مقطعًا واحدًا على الأقل مرئيًّا تحتها.
 */
function wireOriginPanel(main) {
  const box = main.querySelector('[data-origin]');
  if (!box) return;

  // الطيّ يُحفظ: مَن يفتح الأصل يفتحه لأنه يحتاجه، ولا يصحّ أن يُغلَق
  // في وجهه عند كل عودة للجلسة.
  box.addEventListener('toggle', () => {
    ctx.originOpen = box.open;
    saveSessionSettings(ctx.session.id, { originOpen: box.open }).catch(() => {});
  }, wired());

  const grip = box.querySelector('[data-origin-grip]');
  const scroll = box.querySelector('.sh-origin-scroll');
  if (!grip || !scroll) return;

  let dragging = false;
  let startY = 0;
  let startH = 0;
  const maxHeight = () => Math.max(120, Math.round(window.innerHeight * 0.55));

  const apply = () => scroll.style.setProperty('--origin-h', `${ctx.originHeight}px`);

  grip.addEventListener('pointerdown', (event) => {
    dragging = true;
    startY = event.clientY;
    startH = scroll.getBoundingClientRect().height;
    grip.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, wired());

  grip.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    ctx.originHeight = Math.max(80, Math.min(maxHeight(), Math.round(startH + (event.clientY - startY))));
    apply();
  }, wired());

  const end = (event) => {
    if (!dragging) return;
    dragging = false;
    grip.releasePointerCapture(event.pointerId);
    saveSessionSettings(ctx.session.id, { originHeight: ctx.originHeight }).catch(() => {});
  };

  grip.addEventListener('pointerup', end, wired());
  grip.addEventListener('pointercancel', end, wired());

  // ولمن لا يسحب — على تابلت بلوحة مفاتيح، أو بلا لمسٍ دقيق.
  grip.tabIndex = 0;
  grip.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0;
    if (!step) return;
    event.preventDefault();
    ctx.originHeight = Math.max(80, Math.min(maxHeight(), ctx.originHeight + step));
    apply();
    saveSessionSettings(ctx.session.id, { originHeight: ctx.originHeight }).catch(() => {});
  }, wired());
}

/**
 * مقبض ارتفاع الصورة.
 *
 * الحدّ الأدنى 90px حتى لا تختفي اللوحة فيتعذّر إرجاعها، والأعلى 70%
 * من ارتفاع النافذة حتى تبقى جملةٌ واحدة على الأقل مرئيّة تحتها.
 */
function wireCoverResize(main) {
  const grip = main.querySelector('[data-cover-grip]');
  const box = main.querySelector('[data-cover-box]');
  if (!grip || !box) return;

  let dragging = false;
  let startY = 0;
  let startH = 0;

  const maxHeight = () => Math.max(140, Math.round(window.innerHeight * 0.7));

  grip.addEventListener('pointerdown', (event) => {
    dragging = true;
    startY = event.clientY;
    startH = box.getBoundingClientRect().height;
    grip.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, wired());

  grip.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    ctx.coverHeight = Math.max(90, Math.min(maxHeight(), Math.round(startH + (event.clientY - startY))));
    applyCover();
  }, wired());

  const end = (event) => {
    if (!dragging) return;
    dragging = false;
    grip.releasePointerCapture(event.pointerId);
    saveSessionSettings(ctx.session.id, { coverHeight: ctx.coverHeight }).catch(() => {});
  };

  grip.addEventListener('pointerup', end, wired());
  grip.addEventListener('pointercancel', end, wired());

  // ولمن لا يسحب: الأسهم تغيّر الارتفاع درجةً درجة.
  grip.tabIndex = 0;
  grip.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0;
    if (!step) return;
    event.preventDefault();
    ctx.coverHeight = Math.max(90, Math.min(maxHeight(), ctx.coverHeight + step));
    applyCover();
    saveSessionSettings(ctx.session.id, { coverHeight: ctx.coverHeight }).catch(() => {});
  }, wired());
}

/**
 * كعب الكتاب — يُسحب لتغيير نسبة الصفحتين.
 * Pointer Events لأن اللمس هو الأصل على تابلت.
 */
function wireSpine(main) {
  const spine = main.querySelector('[data-spine]');
  const book = main.querySelector('.sh-book');
  if (!spine || !book) return;

  let dragging = false;
  let savedSplit = 55;

  /* ما ضبطتَه آخر مرّة — يُقرأ عند الفتح فلا تعيد ضبطه كل جلسة. */
  settings.get(SPLIT_KEY, null).then((stored) => {
    if (!stored || dragging) return;
    savedSplit = stored;
    book.style.setProperty('--split', `${stored}%`);
  }).catch(() => {});

  const apply = (event) => {
    /*
     * ⚠️ **من `data-layout` لا من `matchMedia` (WS39).** كانت تسأل
     *    الشاشةَ مباشرةً عن 900px، وهو غيرُ نقطة تحوّل الكتاب فعليًّا
     *    في نطاق التابلت الرأسيّ (700-899) — فيسحب السحبُ هناك بمحورٍ
     *    خطأ. والآن تسأل قرارَ `wireBookLayout` نفسَه، فلا يمكن أن
     *    يختلفا. (وفي وضع الصفحة الواحدة الكعبُ غيرُ قابلٍ للسحب أصلًا
     *    عبر `pointer-events:none` في CSS، فهذا احتياطٌ إضافيّ فقط.)
     */
    const horizontal = book.dataset.layout !== 'single';
    const pages = book.querySelector('.sh-pages');
    const rect = pages.getBoundingClientRect();
    let ratio = horizontal
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;

    /*
     * ⚠️ **والاتّجاه يُقاس لا يُفترَض.**
     *
     * `--split` عرضُ **الورقة**، والقياسُ من الحافّة اليسرى. فإن كانت
     * الورقةُ يمينَ الكون — وهو ما يحدث حين يُعكَس ترتيب الصفّ — صار
     * السحبُ يمينًا يوسّع ما على اليسار: «اجي يمين يروح شمال».
     *
     * فنسأل الصفحتين أين هما فعلًا بدل أن نفترض من `dir` أو من
     * `flex-direction` — فيصحّ في الحالتين وفي أيّ ترتيبٍ يأتي غدًا.
     */
    if (horizontal) {
      const paper = pages.querySelector('.sh-left').getBoundingClientRect();
      const space = pages.querySelector('.sh-right').getBoundingClientRect();
      if (paper.left > space.left) ratio = 1 - ratio;
    }

    // الحدّان يمنعان اختفاء صفحة تمامًا.
    const clamped = Math.max(0.25, Math.min(0.78, ratio));
    savedSplit = Number((clamped * 100).toFixed(1));
    book.style.setProperty('--split', `${savedSplit}%`);
  };

  spine.addEventListener('pointerdown', (event) => {
    dragging = true;
    spine.classList.add('is-dragging');
    spine.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, wired());
  spine.addEventListener('pointermove', (event) => { if (dragging) apply(event); }, wired());

  const release = (event) => {
    if (!dragging) return;
    dragging = false;
    spine.classList.remove('is-dragging');
    try { spine.releasePointerCapture(event.pointerId); } catch { /* رُفع أصلًا */ }
    /*
     * ⚠️ **ويُحفَظ.** كان يعيش في `style` وحدها، فأوّلُ إعادةِ رسمٍ
     *    تمحوه وتعود الصفحتان إلى ٥٥٪. أن تضبطه كل مرّة أسوأ من ألّا
     *    تضبطه.
     */
    settings.set(SPLIT_KEY, savedSplit).catch(() => {});
  };
  spine.addEventListener('pointerup', release, wired());
  spine.addEventListener('pointercancel', release, wired());
}

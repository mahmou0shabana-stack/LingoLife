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
import { toast, toastOk, toastError } from '../components/toast.js';
import { showModal, confirmAction } from '../components/modal.js';
import { navigate } from '../router.js';
import { splitWords, splitSentences } from '../services/shadow/segmenter.js';
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
import { listVoices, loadVoices, RATE_MIN, RATE_MAX } from '../services/shadow/tts-controller.js';
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
import { LANGUAGES, languageByCode, translate, isEnabled as trEnabled, setEnabled as setTrEnabled } from '../services/shadow/translate.js';
import { practiceStreak, recentPractice } from '../services/shadow/shadow-session-service.js';
import { scripts, contentBlocks, scenes, sceneMediaLinks, media, shadowSegments } from '../db/repositories.js';
import { urlFor, startRecording, canRecord, addFilesToScene, AUDIO_ROLE } from '../services/media-service.js';
import { resolveLinks, LINK } from '../services/link-service.js';
import {
  SAVED_KIND, listSavedTags, addSavedTag, saveItem, listSaved, isSaved,
} from '../services/saved-service.js';
import {
  addExpression, addScript, listConversationParts, EXPRESSION_SOURCE,
} from '../services/content-service.js';
import { savedItems } from '../db/repositories.js';
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
/**
 * محرّك منفصل للنصّ الخارجي.
 *
 * منفصلٌ عمدًا: نصٌّ كتبته الآن ليس جزءًا من الجلسة، فلا يُحسب في
 * تقدّمها ولا يُسجَّل كممارسة على مقطع لم تمرّ عليه — وفي الوقت نفسه
 * يُقرأ بنفس السرعة والتكرار والصوت، لأنها إعداداتك أنت لا إعدادات
 * النصّ.
 */
let scratchPlayer = null;
/** وضع التحديد ومجموعته (بند 21). */
let selecting = false;
let picked = new Set();

/** أوضاع عرض النصّ. */
const DISPLAY = Object.freeze({ RU: 'ru', EGY: 'egy', HIDDEN: 'hidden' });

/** يُنادى عند مغادرة الشاشة — بدونه يظلّ الصوت شغّالًا. */
export function disposeShadow() {
  player?.destroy();
  player = null;
  scratchPlayer?.destroy();
  scratchPlayer = null;
  selecting = false;
  picked = new Set();
  nativeMissSaid.clear();
  ctx = null;
  recorder?.cancel?.();
  recorder = null;
  clearExpressionIndex();
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
    }
  } catch {
    resolved = { missing: true };
  }

  return { ...describeSource(session, segments, resolved), origin };
}

/** بطاقة المصدر أعلى الصفحة اليسرى. */
function sourceBadge(source) {
  return html`
    <div class="sh-source">
      <span class="sh-source-icon" aria-hidden="true">${source.icon}</span>
      <span class="sh-source-body">
        <b>${source.kind}</b>
        <span class="sh-source-name">${source.name}</span>
        ${raw(source.note ? html`<small>${source.note}</small>` : '')}
      </span>
      ${raw(
        source.href
          ? html`<button class="sh-source-open" data-sh="open-source"
              data-to="${source.href}">افتح الأصل</button>`
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
async function coverImage(sceneId) {
  if (!sceneId) return null;
  try {
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
    coverImage(session.sceneId),
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
    display: session.displayMode || DISPLAY.RU,
    volume: session.volume ?? 1,
    lang: session.translationLang || 'ams',
    font: session.fontId || 'philosopher',
    stress: session.showStress ?? true,
    autoRead: false,
    humanAudioUrl,
    // تقرأ `'human'` القديم فتعيد `'mine'` (بلا ترقية بيانات)، ثم
    // تحصره فيما هو متاح فعلًا في هذه الجلسة.
    audioSource: effectiveAudioSource(session.audioSource, Boolean(humanAudioUrl)),
    nativeConsent: await nativeAudioConsent(),
    coverHeight: session.coverHeight || 200,
    coverZoom: session.coverZoom || 100,
    coverPinned: session.coverPinned ?? false,
    fontSize: session.fontSize ?? 1,
    // مطويّة افتراضيًّا: الأصل مرجعٌ تفتحه عند الحاجة لا شيءٌ يزاحم
    // ما تتدرّب عليه.
    originOpen: session.originOpen ?? false,
    originHeight: session.originHeight || 160,
  };

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
  wireSpine(main);
  wireCoverResize(main);
  wireOriginPanel(main);
  wireInteractions(main);
  wireModalActions();
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

function shell() {
  const { session, segments, scene, cover, change, voices, source } = ctx;
  const idx = session.currentSegmentIndex || 0;

  return html`
    <div class="shadow-app">
      <div class="sh-appbar">
        <div class="sh-brand">Lingo<b>Life</b> <i>✦</i></div>
        <nav class="sh-navpills">
          <button data-sh="go" data-to="/">الرئيسية</button>
          <button data-sh="go" data-to="/life">المكتبة</button>
          <button data-sh="go" data-to="/language">لغتي</button>
          <button class="on">Shadowing</button>
        </nav>
        <div class="sh-streak" title="أيام متتالية فيها تدريب حقيقي">🔥 <b data-streak>—</b></div>
      </div>

      <div class="sh-top">
        <button class="sh-pill" data-sh="exit">${raw(icon('back', 15))} رجوع للمكتبة</button>
        <div class="sh-top-title"><span>Shadowing Book · كتاب الظلّ</span></div>
        <button class="sh-pill" data-sh="tips">${raw(icon('info', 15))} نصائح</button>
      </div>

      <div class="sh-book">
        <div class="sh-pages">
          <!-- ─── الصفحة اليسرى: مِمَّ أتعلّم ─── -->
          <div class="sh-page sh-left">
            <div class="sh-page-head">
              <span class="sh-tag">RU 🇷🇺</span>
              <span class="t">المشهد والنصّ الأصلي</span>
            </div>

            ${raw(sourceBadge(source))}
            ${raw(originPanel(source))}
            ${raw(change.changed ? staleBanner(change) : '')}
            ${raw(cover ? coverPanel(cover) : '')}
            ${raw(
              scene
                ? html`<div class="sh-scene-title">🎬 <b>${scene.titleRu || scene.titleAr}</b>
                    ${raw(scene.titleRu && scene.titleAr ? html`<span>(${scene.titleAr})</span>` : '')}
                  </div>`
                : ''
            )}

            <!--
              شريط التحديد (بند 21): يظهر عند طلبه فقط. التدريب على
              سبعٍ من ثمانيَ عشرة لا يحتاج مغادرة الجلسة ولا إعادة
              بنائها — الفهارس تبقى كما هي والمحرّك يدور في المحدَّد.
            -->
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

            <div data-lines class="${''}">
              ${raw(segments.map((s, i) => lineHtml(s, i, i === idx)).join(''))}
            </div>

            ${raw(fontPanel())}

            <div class="sh-left-foot">
              <button class="sh-pill" data-sh="toggle-tr">📖 عرض الترجمة <span class="caret">▾</span></button>
              <button class="sh-pill" data-sh="lang" data-lang="${ctx.lang}">
                <span data-lang-flag>${languageByCode(ctx.lang).flag}</span>
                <span data-lang-label>${languageByCode(ctx.lang).label}</span>
              </button>
              <button class="sh-pill" data-sh="font">✍️ <span data-font-label>الخطّ</span></button>
              <button class="sh-pill" data-sh="stress">◌́ النبر</button>
            </div>
          </div>

          <div class="sh-spine" data-spine role="separator" aria-label="اسحب لتغيير حجم الصفحتين"></div>

          <!-- ─── الصفحة اليمنى: كيف أجعله لي ─── -->
          <div class="sh-page sh-right">
            <div class="sh-page-head">
              <span class="t">✦ محرّك الظلّ</span>
              <span class="sh-tag live" data-status>جاهز</span>
            </div>

            <div>
              <div class="sh-progress-row">
                <span>جملة <b data-pos>${idx + 1}</b> / ${segments.length}</span>
                <span data-counter>—</span>
              </div>
              <div class="sh-bar" data-bar><span></span></div>
            </div>

            <div class="sh-current-card" data-card>
              <div class="sh-current-head">
                <span class="sh-current-lbl" data-current-lbl>الجملة الحالية</span>
                <span class="sh-current-tools">
                  <button data-sh="scratch-open" title="اكتب كلمة أو جملة من برّه">✎</button>
                  <button data-sh="scratch-clear" title="امسح النصّ من مربع القراءة" hidden
                    data-scratch-clear>✕</button>
                </span>
              </div>
              <div class="sh-current-text" data-text></div>
              <div class="sh-current-tr" data-tr></div>
              <div class="sh-marks" data-marks></div>
              <div class="sh-wave">${raw('<i></i>'.repeat(21))}</div>
            </div>

            <!--
              مربع النصّ الخارجي: كلمة أو جملة من خارج المصدر تُقرأ
              هنا بنفس المحرّك — بنفس السرعة والتكرار والصوت — بلا أن
              تُضاف إلى الجلسة ولا تُحسب ممارسةً على نصٍّ لم تتدرّب
              عليه.
            -->
            <form class="sh-scratch" data-scratch hidden>
              <input type="text" name="scratch" dir="ltr" lang="ru" data-scratch-input
                placeholder="اكتب كلمة أو جملة روسية…" autocomplete="off" />
              <button type="submit" class="sh-pill">اقرأها</button>
              <button type="button" class="sh-pill" data-sh="scratch-close">✕</button>
            </form>

            <!--
              وجهات الحفظ (بند 19): النصّ الذي كتبته الآن لا يضيع بمجرّد
              مسحه. يظهر الصفّ حين يكون هناك نصٌّ يُقرأ فعلًا.
            -->
            <div class="sh-scratch-save" data-scratch-save hidden>
              <span>احفظها في:</span>
              <button data-sh="scratch-to" data-to="saved">🔖 المحفوظات</button>
              <button data-sh="scratch-to" data-to="expression">✦ تعبير</button>
              <button data-sh="scratch-to" data-to="script">📄 سكريبت في الذكرى</button>
            </div>

            <!--
              شريط القراءة السريعة: القيم الثلاث الحيّة في سطر واحد،
              والنقر على أيّها يفتح الدرج عندها. كانت هذه القيم ثلاث
              بطاقات تأكل نصف الصفحة، وأنت لا تغيّرها كل جملة —
              تقرأها كثيرًا وتضبطها قليلًا.
            -->
            <button class="sh-quick" data-sh="drawer">
              <span><i>🎚</i><b data-dial="speed">${session.speed}x</b></span>
              <span><i>🔁</i><b data-dial="repeat">×${session.repeatCount}</b></span>
              <span><i>⏳</i><b data-dial="pause">${intervalLabel(session)}</b></span>
              <span class="sh-quick-more">⚙︎ اضبط</span>
            </button>

            <div class="sh-transport">
              <button class="sh-nav-btn" data-sh="prev">⏮ السابق</button>
              <button class="sh-play" data-sh="play" aria-label="تشغيل">▶</button>
              <button class="sh-nav-btn" data-sh="next">التالي ⏭</button>
            </div>

            <div class="sh-seg">
              <button data-sh="words">✦ الكلمات</button>
              <button data-sh="difficult">صعبة</button>
              <button data-sh="save-item">🔖 احفظها</button>
              <button data-sh="select-mode">☑︎ حدّد</button>
              ${raw(
                segments.some((seg) => seg.isMine)
                  ? html`<button data-sh="my-role">🎭 دوري</button>`
                  : html`<button data-sh="audio-source"
                      class="${ctx.audioSource === AUDIO_SOURCE.TTS ? '' : 'on'}"
                      title="اضغط لتبديل مصدر الصوت">
                      ${AUDIO_LABEL[ctx.audioSource]}
                    </button>`
              )}
            </div>

            <div class="sh-words" data-words hidden></div>

            <button class="sh-record" data-sh="record">
              🎙 سجّل الآن
            </button>
            <button class="sh-record ghost" data-sh="tell">
              🗣 احكيها الآن
            </button>
            <div class="sh-hint" data-hint>
              سجّل بصوتك وقارن نفسك بالنطق الأصلي
            </div>
          </div>
        </div>
      </div>

      <!--
        الشريط السفلي بشكل التصميم — وكل زرّ فيه يفعل شيئًا حقيقيًا.
        لا «تحديات» ولا «تقارير» مفبركة: التقارير أرقام الجلسة الفعلية،
        والمفضّلة هي الجمل التي علّمتها صعبة، والسجلّ ممارستك المسجّلة.
      -->
      <div class="sh-bottom">
        <button class="sh-tab" data-sh="panel" data-panel="settings">⚙️<span>الإعدادات</span></button>
        <button class="sh-tab" data-sh="panel" data-panel="report">📊<span>التقرير</span></button>
        <button class="sh-core" data-sh="words" aria-label="تقسيم الكلمات">✦</button>
        <button class="sh-tab" data-sh="panel" data-panel="difficult">♡<span>الصعبة</span></button>
        <button class="sh-tab" data-sh="panel" data-panel="history">🕘<span>السجلّ</span></button>
      </div>

      ${raw(settingsDrawer())}
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
      <div class="sh-cover-scroll" data-cover-scroll>
        <img class="sh-cover" src="${url}" alt="الصورة اللي بتتدرّب على نصّها" />
      </div>
      <div class="sh-cover-tools">
        <button data-sh="cover-pin" class="${coverPinned ? 'on' : ''}"
          aria-pressed="${coverPinned ? 'true' : 'false'}" title="ثبّت الصورة وانت بتقلّب">📌</button>
        <button data-sh="cover-zoom" data-dir="-1" aria-label="صغّر">−</button>
        <span class="sh-cover-zoom" data-cover-zoom>${coverZoom}%</span>
        <button data-sh="cover-zoom" data-dir="1" aria-label="كبّر">+</button>
        <button data-sh="cover-fit" title="ارجعها لمقاس الإطار">⤢</button>
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
  const card = $('[data-card]');
  const play = $('[data-sh="play"]');
  const status = $('[data-status]');

  switch (event.type) {
    case 'start':
    case 'resume':
      if (play) play.textContent = '⏸';
      if (status) status.textContent = 'بيشتغل';
      break;

    case 'pause':
      if (play) play.textContent = '▶';
      if (status) status.textContent = 'متوقّف';
      card?.classList.remove('speaking');
      break;

    case 'stop':
      if (play) play.textContent = '▶';
      if (status) status.textContent = 'جاهز';
      card?.classList.remove('speaking');
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
      if (play) play.textContent = '▶';
      card?.classList.remove('speaking');
      finishSession();
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

  const words = $('[data-words]');
  if (words && !words.hidden) renderWords();

  renderMarks(segment);
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
    if (el) el.textContent = 'مفيش ترجمة محفوظة — فعّل الترجمة من الإعدادات';
    return;
  }

  const updated = await shadowSegments.update(segment.id, { translationSnapshot: result });
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

function renderWords() {
  const host = $('[data-words]');
  if (!host) return;
  const segment = ctx.segments[player.state.index];
  const words = splitWords(segment.sourceTextSnapshot);
  player.setWords(words);
  host.innerHTML = words
    .map((w, i) => `<button class="sh-word" data-word="${i}">${esc(w.display)}</button>`)
    .join('');
}

function highlightWord(wordIndex) {
  const host = $('[data-words]');
  if (!host || host.hidden) return;
  host.querySelectorAll('[data-word]').forEach((node, i) => {
    node.classList.toggle('speaking', i === wordIndex);
  });
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

  // المحرّكان معًا: الإعداد لك لا للنصّ، فلا يختلف صوتُ جملةٍ كتبتها
  // عن صوت جملةٍ من السكريبت.
  const patch = spec.patch(value);
  player?.updateSettings(patch);
  scratchPlayer?.updateSettings(patch);

  const range = document.querySelector(`[data-tune-range="${key}"]`);
  const num = document.querySelector(`[data-tune-num="${key}"]`);
  if (range && Number(range.value) !== value) range.value = value;
  if (num && Number(num.value) !== value) num.value = value;

  const quick = document.querySelector(`[data-dial="${key}"]`);
  if (quick) quick.textContent = spec.label(value);

  if (silent) return;
  return saveSessionSettings(ctx.session.id, spec.persist(value)).catch(() => {});
}

/**
 * يطبّق الخطّ وحجمه على الجملة الحالية وعلى سطور المصدر معًا.
 *
 * كان الخطّ يُطبَّق على البطاقة وحدها، فتقرأ الجملة بخطٍّ وترى بقيّة
 * النصّ بخطٍّ آخر. الخطّ قرارٌ للنصّ الروسي كلّه.
 */
function applyFonts() {
  const font = fontById(ctx.font);

  applyFont($('[data-text]'), ctx.font);
  document.querySelectorAll('.sh-line [data-line-text]').forEach((node) => applyFont(node, ctx.font));

  const app = document.querySelector('.shadow-app');
  if (app) app.style.setProperty('--sh-font-size', ctx.fontSize);

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

/** المحرّك الفاعل الآن: الخارجي إن كان مفتوحًا، وإلا محرّك الجلسة. */
function activePlayer() {
  return scratchPlayer || player;
}

/** يقرأ نصًّا كتبته بنفسك بنفس إعدادات الجلسة. */
function readScratch(text) {
  const clean = (text || '').trim();
  if (!clean) return;

  // محرّك الجلسة يصمت: صوتان معًا لا يُفهم منهما شيء.
  player.pause();
  scratchPlayer?.destroy();

  ctx.scratch = clean;

  scratchPlayer = createPlaybackController({
    segments: [{ id: 'scratch', text: clean }],
    settings: { ...player.state.settings, autoAdvance: false },
    onEvent: handleScratchEvent,
  });

  const textEl = $('[data-text]');
  if (textEl) {
    if (ctx.stress) textEl.innerHTML = markSentence(clean).html;
    else textEl.textContent = clean;
    textEl.classList.remove('hidden-mode');
    applyFonts();
  }

  const trEl = $('[data-tr]');
  if (trEl) trEl.textContent = '';
  const marks = $('[data-marks]');
  if (marks) marks.innerHTML = '';

  const lbl = $('[data-current-lbl]');
  if (lbl) lbl.textContent = '✎ نصّ من عندك';
  $('[data-scratch-clear]')?.removeAttribute('hidden');
  $('[data-scratch-save]')?.removeAttribute('hidden');

  scratchPlayer.start();
}

/**
 * أحداث المحرّك الخارجي.
 *
 * ⚠️ لا `recordSegmentPractice` ولا `savePosition` هنا. تكرار نصٍّ
 *    كتبته الآن ليس ممارسةً على جملةٍ في جلستك — تسجيله كذلك يزوّر
 *    دليل ممارستك (بند 19).
 */
function handleScratchEvent(event) {
  const status = $('[data-status]');
  const counter = $('[data-counter]');
  const card = $('[data-card]');
  const play = $('[data-sh="play"]');

  if (event.type === 'speak-start') {
    if (status) status.textContent = 'بيقرا';
    card?.classList.add('speaking');
    if (counter) counter.textContent = `×${event.repetition}`;
    if (play) play.textContent = '⏸';
  }
  if (event.type === 'speak-end') card?.classList.remove('speaking');
  if (event.type === 'paused') {
    if (status) status.textContent = 'واقف';
    if (play) play.textContent = '▶';
  }
  if (event.type === 'finished' || event.type === 'stopped') {
    if (status) status.textContent = 'جاهز';
    card?.classList.remove('speaking');
    if (play) play.textContent = '▶';
  }
}

/**
 * يحفظ النصّ الخارجي حيث تريد (بند 19).
 *
 * ⚠️ **لا يمسّ مصدر الجلسة.** الممارسة السريعة نصٌّ عابر؛ حفظه يُنشئ
 *    شيئًا جديدًا في مكانه الصحيح ولا يعدّل السكريبت الذي تتدرّب عليه.
 */
async function saveScratchTo(where) {
  const text = (ctx.scratch || '').trim();
  if (!text) return toast('مفيش نصّ نحفظه');

  try {
    if (where === 'saved') {
      await saveItem({
        text,
        kind: text.split(/\s+/).length > 1 ? SAVED_KIND.SENTENCE : SAVED_KIND.WORD,
        sceneId: ctx.session.sceneId,
        sessionId: ctx.session.id,
      });
      return toastOk('اتحفظت في المحفوظات');
    }

    if (where === 'expression') {
      if (!ctx.session.sceneId) return toastError('الجلسة دي مش مربوطة بذكرى');
      /*
       * لا اقتباس هنا: النصّ الخارجي **هو** التعبير نفسه، وتكراره
       * كاقتباسٍ يوهم بسياقٍ لا وجود له. لكن الجلسة تُسجَّل، فتعرف
       * بعد شهرٍ أنك التقطته وأنت تتمرّن لا وأنت تكتب.
       */
      await addExpression(ctx.session.sceneId, {
        text,
        source: { type: EXPRESSION_SOURCE.SHADOW, id: ctx.session.id },
      });
      return toastOk('اتضافت كتعبير في الذكرى');
    }

    if (where === 'script') {
      if (!ctx.session.sceneId) return toastError('الجلسة دي مش مربوطة بذكرى');
      await addScript(ctx.session.sceneId, { title: 'من الممارسة السريعة', text });
      return toastOk('اتضاف سكريبت جديد في الذكرى');
    }
  } catch (err) {
    toastError(err.message || 'مقدرناش نحفظ');
  }
}

/** يرجع من النصّ الخارجي إلى جملة الجلسة. */
function clearScratch() {
  if (!scratchPlayer) return;
  scratchPlayer.destroy();
  scratchPlayer = null;
  ctx.scratch = null;

  const lbl = $('[data-current-lbl]');
  if (lbl) lbl.textContent = 'الجملة الحالية';
  $('[data-scratch-clear]')?.setAttribute('hidden', '');
  $('[data-scratch-save]')?.setAttribute('hidden', '');

  const input = $('[data-scratch-input]');
  if (input) input.value = '';

  // إعادة الرسم تُرجع الجملة وترجمتها وعلاماتها كما كانت.
  syncSegment();
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
        <input type="text" name="newTag" placeholder="أو اكتب سبب جديد…" maxlength="30" />
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
  // السحب يطبّق فورًا بلا كتابة في القاعدة؛ الحفظ عند رفع الإصبع.
  main.addEventListener('input', (event) => {
    const key = event.target.dataset.tuneRange || event.target.dataset.tuneNum;
    if (key) return setTuner(key, event.target.value, { silent: true });

    if (event.target.hasAttribute('data-font-size')) {
      ctx.fontSize = Number(event.target.value) / 100;
      applyFonts();
    }
  });

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
  });

  main.addEventListener('submit', (event) => {
    if (!event.target.hasAttribute('data-scratch')) return;
    event.preventDefault();
    readScratch(new FormData(event.target).get('scratch'));
  });

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

    const word = event.target.closest('[data-word]');
    if (word) {
      document.querySelectorAll('[data-word]').forEach((n) => n.classList.remove('selected'));
      word.classList.add('selected');
      player.updateSettings({ practiceMode: PRACTICE_MODE.WORD });
      player.selectWord(Number(word.dataset.word));
      player.start();
      return;
    }

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

      case 'play': {
        const active = activePlayer();
        if (active.state.running && !active.state.paused) return active.pause();
        if (active.state.paused) return active.resume();
        return active.start();
      }

      // التنقّل يخصّ جمل الجلسة، فالخروج من النصّ الخارجي جزءٌ منه.
      case 'prev': clearScratch(); return player.previous();
      case 'next': clearScratch(); return player.next();

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
        return clearScratch();

      case 'scratch-to':
        return saveScratchTo(btn.dataset.to);

      case 'drawer':       return toggleDrawer(true);
      case 'drawer-close': return toggleDrawer(false);

      case 'display': {
        ctx.display = btn.dataset.val;
        setSegActive('[data-display-seg]', ctx.display);
        syncSegment();
        return saveSessionSettings(ctx.session.id, { displayMode: ctx.display });
      }

      case 'mode': {
        const mode = btn.dataset.val === 'continuous' ? REPEAT_MODE.CONTINUOUS : REPEAT_MODE.COUNT;
        player.updateSettings({ repeatMode: mode });
        setSegActive('[data-repeat-seg]', btn.dataset.val);
        return saveSessionSettings(ctx.session.id, { repeatMode: mode });
      }

      case 'words': {
        const host = $('[data-words]');
        host.hidden = !host.hidden;
        // زرّان يفتحان الكلمات (الشريط السفلي والصفّ الجانبي) — نُبقي
        // إضاءتهما متطابقة مهما ضُغط أيّهما.
        document
          .querySelectorAll('[data-sh="words"]')
          .forEach((node) => node.classList.toggle('on', !host.hidden));
        if (!host.hidden) host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        if (host.hidden) player.updateSettings({ practiceMode: PRACTICE_MODE.SENTENCE });
        else renderWords();
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
        const updated = await markDifficult(segment.id, segment.practiceStatus !== 'difficult');
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
        const choices = audioChoices();
        const next = choices[(choices.indexOf(ctx.audioSource) + 1) % choices.length];

        if (next === AUDIO_SOURCE.NATIVE && !ctx.nativeConsent.enabled) {
          const granted = await askNativeConsent();
          if (!granted) return;
        }

        ctx.audioSource = next;
        player.updateSettings({ audioSource: next });
        btn.classList.toggle('on', next !== AUDIO_SOURCE.TTS);
        btn.textContent = AUDIO_LABEL[next];

        if (next === AUDIO_SOURCE.NATIVE) {
          // نقولها قبل أن يضغط تشغيل، لا بعد أن يسمع صوتًا آليًّا
          // ويظنّه ناطقًا أصليًّا.
          toast('للكلمات المفردة بس — الجملة هتفضل آلية');
        } else {
          toast(next === AUDIO_SOURCE.MINE ? 'هيشغّل تسجيلك' : 'هينطق آليًا');
        }
        return saveSessionSettings(ctx.session.id, { audioSource: next });
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

      case 'font-pick': {
        ctx.font = btn.dataset.font;
        applyFonts();
        return saveSessionSettings(ctx.session.id, { fontId: ctx.font });
      }

      case 'stress': {
        ctx.stress = !ctx.stress;
        btn.classList.toggle('on', ctx.stress);
        syncSegment();
        return saveSessionSettings(ctx.session.id, { showStress: ctx.stress });
      }

      /* ---- لوحة الصورة ---- */

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
  });

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
  });

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
  });

  grip.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    ctx.originHeight = Math.max(80, Math.min(maxHeight(), Math.round(startH + (event.clientY - startY))));
    apply();
  });

  const end = (event) => {
    if (!dragging) return;
    dragging = false;
    grip.releasePointerCapture(event.pointerId);
    saveSessionSettings(ctx.session.id, { originHeight: ctx.originHeight }).catch(() => {});
  };

  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  // ولمن لا يسحب — على تابلت بلوحة مفاتيح، أو بلا لمسٍ دقيق.
  grip.tabIndex = 0;
  grip.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0;
    if (!step) return;
    event.preventDefault();
    ctx.originHeight = Math.max(80, Math.min(maxHeight(), ctx.originHeight + step));
    apply();
    saveSessionSettings(ctx.session.id, { originHeight: ctx.originHeight }).catch(() => {});
  });
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
  });

  grip.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    ctx.coverHeight = Math.max(90, Math.min(maxHeight(), Math.round(startH + (event.clientY - startY))));
    applyCover();
  });

  const end = (event) => {
    if (!dragging) return;
    dragging = false;
    grip.releasePointerCapture(event.pointerId);
    saveSessionSettings(ctx.session.id, { coverHeight: ctx.coverHeight }).catch(() => {});
  };

  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  // ولمن لا يسحب: الأسهم تغيّر الارتفاع درجةً درجة.
  grip.tabIndex = 0;
  grip.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0;
    if (!step) return;
    event.preventDefault();
    ctx.coverHeight = Math.max(90, Math.min(maxHeight(), ctx.coverHeight + step));
    applyCover();
    saveSessionSettings(ctx.session.id, { coverHeight: ctx.coverHeight }).catch(() => {});
  });
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

  const apply = (event) => {
    const horizontal = window.matchMedia('(min-width: 900px)').matches;
    const rect = book.querySelector('.sh-pages').getBoundingClientRect();
    const ratio = horizontal
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    // الحدّان يمنعان اختفاء صفحة تمامًا.
    const clamped = Math.max(0.25, Math.min(0.78, ratio));
    book.style.setProperty('--split', `${(clamped * 100).toFixed(1)}%`);
  };

  spine.addEventListener('pointerdown', (event) => {
    dragging = true;
    spine.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  spine.addEventListener('pointermove', (event) => { if (dragging) apply(event); });
  spine.addEventListener('pointerup', (event) => {
    dragging = false;
    spine.releasePointerCapture(event.pointerId);
  });
}

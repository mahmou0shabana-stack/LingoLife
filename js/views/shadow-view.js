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
import { showModal } from '../components/modal.js';
import { navigate } from '../router.js';
import { splitWords } from '../services/shadow/segmenter.js';
import { toEgyptian } from '../services/shadow/dialect.js';
import {
  createPlaybackController,
  PRACTICE_MODE,
  REPEAT_MODE,
  intervalLabel,
} from '../services/shadow/playback-controller.js';
import { listVoices, loadVoices, stepRate } from '../services/shadow/tts-controller.js';
import {
  completeSession,
  detectSourceChange,
  loadSession,
  markDifficult,
  recordSegmentPractice,
  savePosition,
  saveSessionSettings,
} from '../services/shadow/shadow-session-service.js';
import { markSentence, loadUserDictionary } from '../services/shadow/stress.js';
import { FONTS, applyFont, ensureFontsLoaded, nextFont } from '../services/shadow/fonts.js';
import { LANGUAGES, languageByCode, translate, isEnabled as trEnabled, setEnabled as setTrEnabled } from '../services/shadow/translate.js';
import { practiceStreak, recentPractice } from '../services/shadow/shadow-session-service.js';
import { scripts, contentBlocks, scenes, sceneMediaLinks, media, shadowSegments } from '../db/repositories.js';
import { urlFor, startRecording, canRecord, addFilesToScene, AUDIO_ROLE } from '../services/media-service.js';

/** حالة الشاشة الحيّة. */
let player = null;
let ctx = null;
let recorder = null;

/** أوضاع عرض النصّ. */
const DISPLAY = Object.freeze({ RU: 'ru', EGY: 'egy', HIDDEN: 'hidden' });

/** يُنادى عند مغادرة الشاشة — بدونه يظلّ الصوت شغّالًا. */
export function disposeShadow() {
  player?.destroy();
  player = null;
  ctx = null;
  recorder?.cancel?.();
  recorder = null;
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

  const [current, scene, cover, voices] = await Promise.all([
    readCurrentSource(session),
    session.sceneId ? scenes.get(session.sceneId) : null,
    coverImage(session.sceneId),
    listVoices(),
  ]);

  const change = current ? detectSourceChange(session, current) : { changed: false };

  ctx = {
    session,
    segments,
    change,
    scene,
    cover,
    voices,
    display: session.displayMode || DISPLAY.RU,
    volume: session.volume ?? 1,
    lang: session.translationLang || 'ams',
    font: session.fontId || 'philosopher',
    stress: session.showStress ?? true,
    autoRead: false,
  };

  main.innerHTML = shell();
  document.body.classList.add('shadow-open');

  // الخطوط تُحقن مرّة واحدة هنا فلا تُثقل بقية التطبيق.
  ensureFontsLoaded();
  await loadUserDictionary();

  // الشعلة رقم محسوب من دليل ممارسة حقيقي — لا عدّاد يُزاد يدويًا.
  practiceStreak()
    .then((days) => {
      const el = main.querySelector('[data-streak]');
      if (el) el.textContent = days;
    })
    .catch(() => {});

  player = createPlaybackController({
    segments: segments.map((s) => ({ id: s.id, text: s.sourceTextSnapshot })),
    settings: { ...session, volume: ctx.volume },
    onEvent: handleEvent,
  });

  player.goTo(session.currentSegmentIndex || 0);
  syncSegment();
  wireSpine(main);
  wireInteractions(main);
}

function shell() {
  const { session, segments, scene, cover, change, voices } = ctx;
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

            ${raw(change.changed ? staleBanner(change) : '')}
            ${raw(cover ? html`<img class="sh-cover" src="${cover}" alt="" />` : '')}
            ${raw(
              scene
                ? html`<div class="sh-scene-title">🎬 <b>${scene.titleRu || scene.titleAr}</b>
                    ${raw(scene.titleRu && scene.titleAr ? html`<span>(${scene.titleAr})</span>` : '')}
                  </div>`
                : ''
            )}

            <div data-lines>
              ${raw(segments.map((s, i) => lineHtml(s, i, i === idx)).join(''))}
            </div>

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
              <div class="sh-current-lbl">الجملة الحالية</div>
              <div class="sh-current-text" data-text></div>
              <div class="sh-current-tr" data-tr></div>
              <div class="sh-wave">${raw('<i></i>'.repeat(21))}</div>
            </div>

            <div>
              <div class="sh-section-lbl">إعدادات الظلّ</div>
              <div class="sh-dials">
                ${raw(dial('السرعة', '🎚', `${session.speed}x`, 'speed'))}
                ${raw(dial('التكرار', '🔁', `×${session.repeatCount}`, 'repeat'))}
                ${raw(dial('التوقّف', '⏳', intervalLabel({ unit: session.intervalUnit, steps: session.intervalSteps }), 'pause'))}
              </div>
            </div>

            <div>
              <div class="sh-section-lbl">وضع العرض</div>
              <div class="sh-seg" data-display-seg>
                <button data-sh="display" data-val="ru" class="on">RU<small>الروسي</small></button>
                <button data-sh="display" data-val="egy">مصري<small>الترجمة</small></button>
                <button data-sh="display" data-val="hidden">مخفي<small>اكشفها</small></button>
              </div>
            </div>

            <div>
              <div class="sh-section-lbl">وضع التكرار</div>
              <div class="sh-seg" data-repeat-seg>
                <button data-sh="mode" data-val="count">بالعدد<small>يقف بعد ×${session.repeatCount}</small></button>
                <button data-sh="mode" data-val="continuous">مستمرّ<small>بلا توقّف</small></button>
              </div>
            </div>

            <div class="sh-transport">
              <button class="sh-nav-btn" data-sh="prev">⏮ السابق</button>
              <button class="sh-play" data-sh="play" aria-label="تشغيل">▶</button>
              <button class="sh-nav-btn" data-sh="next">التالي ⏭</button>
            </div>

            <div class="sh-volume">
              <span>🔈</span>
              <input type="range" min="0" max="100" value="${Math.round(ctx.volume * 100)}"
                data-sh="volume" aria-label="مستوى الصوت" />
              <span>🔊</span>
            </div>

            <div class="sh-seg">
              <button data-sh="words">✦ الكلمات</button>
              <button data-sh="difficult">صعبة</button>
              <button data-sh="voices">🎙 الصوت</button>
            </div>

            <div class="sh-words" data-words hidden></div>

            <select class="sh-select" data-sh="voice-select" hidden>
              ${raw(voiceOptions(voices, session.voiceId))}
            </select>

            <button class="sh-record" data-sh="record">
              🎙 سجّل الآن
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
    </div>`;
}

function dial(label, glyph, value, key) {
  return html`
    <div class="sh-dial">
      <span class="sh-dial-mark">⊙</span>
      <div class="sh-dial-lbl">${glyph} ${label}</div>
      <div class="sh-dial-val" data-dial="${key}">${value}</div>
      <div class="sh-dial-btns">
        <button data-sh="dial-down" data-key="${key}" aria-label="أقل">−</button>
        <button data-sh="dial-up" data-key="${key}" aria-label="أكثر">+</button>
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
                  html`<option value="${esc(v.name)}" ${v.name === selected ? 'selected' : ''}>
                    ${esc(v.name)}
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
    <span class="n">${index + 1}</span>
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
      highlightWord(event.wordIndex);
      break;
    }

    case 'seek':
    case 'word-select':
      syncSegment();
      break;

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

/** يعدّل قيمة قرص ويحفظها. */
async function adjustDial(key, direction) {
  const s = player.state.settings;
  const el = document.querySelector(`[data-dial="${key}"]`);

  if (key === 'speed') {
    const next = stepRate(s.rate, direction);
    player.updateSettings({ rate: next });
    if (el) el.textContent = `${next}x`;
    return saveSessionSettings(ctx.session.id, { speed: next });
  }

  if (key === 'repeat') {
    const next = Math.max(1, Math.min(50, s.repeatCount + direction));
    player.updateSettings({ repeatCount: next });
    if (el) el.textContent = `×${next}`;
    document.querySelector('[data-repeat-seg] [data-val="count"] small').textContent =
      `يقف بعد ×${next}`;
    return saveSessionSettings(ctx.session.id, { repeatCount: next });
  }

  if (key === 'pause') {
    const next = Math.max(1, Math.min(60, s.intervalSteps + direction));
    player.updateSettings({ intervalSteps: next });
    if (el) el.textContent = intervalLabel({ unit: s.intervalUnit, steps: next });
    return saveSessionSettings(ctx.session.id, { intervalSteps: next });
  }
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
    const hard = ctx.segments.filter((s) => s.practiceStatus === 'difficult');
    return showModal({
      title: '♡ الجمل الصعبة',
      body: hard.length
        ? hard
            .map(
              (s) =>
                html`<div class="kv-row"><span class="k" dir="ltr">${s.sourceTextSnapshot}</span>
                  <span class="v num">×${s.repetitionsCompleted}</span></div>`
            )
            .join('')
        : '<p class="field-hint">مفيش جمل معلّمة صعبة لسه. اضغط «صعبة» على أي جملة.</p>',
      actions: [{ label: 'تمام', value: null, variant: 'primary' }],
    });
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

  if (name === 'settings') {
    const online = await trEnabled();
    const value = await showModal({
      title: '⚙️ إعدادات الظلّ',
      body: html`
        <div class="kv-row"><span class="k">الخطّ</span>
          <span class="v">${FONTS.find((f) => f.id === ctx.font)?.label}</span></div>
        <div class="kv-row"><span class="k">لغة الترجمة</span>
          <span class="v">${languageByCode(ctx.lang).label}</span></div>
        <div class="kv-row"><span class="k">علامات النبر</span>
          <span class="v">${ctx.stress ? 'مفعّلة' : 'مطفية'}</span></div>
        <div class="kv-row"><span class="k">قراءة مستمرة</span>
          <span class="v">${ctx.autoRead ? 'مفعّلة' : 'مطفية'}</span></div>
        <p class="field-hint" style="margin:var(--sp-3) 0">
          <strong>الترجمة عبر الإنترنت ${online ? 'مفعّلة' : 'مطفية'}.</strong>
          الترجمة المحفوظة عندك بتتعرض دايمًا. دي بس بتجيب الناقص من
          خدمات خارجية — يعني بتخرج بياناتك برّه جهازك.
        </p>`,
      actions: [
        { label: 'إغلاق', value: null, variant: 'ghost' },
        { label: online ? 'اطفي الترجمة الأونلاين' : 'فعّل الترجمة الأونلاين', value: 'submit', variant: 'primary' },
      ],
    });
    if (value === 'submit') {
      const now = await setTrEnabled(!online);
      toast(now ? 'الترجمة الأونلاين اتفعّلت' : 'الترجمة الأونلاين اتطفت');
    }
  }
}

function wireInteractions(main) {
  main.addEventListener('input', (event) => {
    if (event.target.dataset.sh === 'volume') {
      const volume = Number(event.target.value) / 100;
      ctx.volume = volume;
      player.updateSettings({ volume });
      saveSessionSettings(ctx.session.id, { volume }).catch(() => {});
    }
  });

  main.addEventListener('change', (event) => {
    if (event.target.dataset.sh === 'voice-select') {
      const voiceName = event.target.value;
      player.updateSettings({ voiceName });
      saveSessionSettings(ctx.session.id, { voiceId: voiceName }).catch(() => {});
      toast(`الصوت: ${voiceName}`);
    }
  });

  main.addEventListener('click', async (event) => {
    const line = event.target.closest('[data-line]');
    if (line) return player.goTo(Number(line.dataset.line));

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

      case 'tips':
        return showTips();

      case 'play':
        if (player.state.running && !player.state.paused) return player.pause();
        if (player.state.paused) return player.resume();
        return player.start();

      case 'prev': return player.previous();
      case 'next': return player.next();

      case 'dial-up':   return adjustDial(btn.dataset.key, 1);
      case 'dial-down': return adjustDial(btn.dataset.key, -1);

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

      case 'record':
        return toggleRecording(btn);

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
        const next = nextFont(ctx.font);
        ctx.font = next.id;
        btn.querySelector('[data-font-label]').textContent = next.label;
        applyFont($('[data-text]'), ctx.font);
        return saveSessionSettings(ctx.session.id, { fontId: next.id });
      }

      case 'stress': {
        ctx.stress = !ctx.stress;
        btn.classList.toggle('on', ctx.stress);
        syncSegment();
        return saveSessionSettings(ctx.session.id, { showStress: ctx.stress });
      }

      case 'panel':
        return openPanel(btn.dataset.panel);

      default:
        return;
    }
  });

  // الحالة الابتدائية للأزرار
  main.querySelector('[data-sh="stress"]')?.classList.toggle('on', ctx.stress);
  const fontLabel = main.querySelector('[data-font-label]');
  if (fontLabel) fontLabel.textContent = FONTS.find((f) => f.id === ctx.font)?.label || 'الخطّ';

  setSegActive('[data-display-seg]', ctx.display);
  setSegActive(
    '[data-repeat-seg]',
    ctx.session.repeatMode === REPEAT_MODE.CONTINUOUS ? 'continuous' : 'count'
  );
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

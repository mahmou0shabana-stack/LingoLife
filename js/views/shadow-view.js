/**
 * LingoLife — شاشة الظلّ
 *
 * كتاب مفتوح بصفحتين: المصدر على واحدة والممارسة على الأخرى.
 * ليستا شاشتين — هما وجها الورقة نفسها، والجملة الجارية مُبرَزة في
 * الاثنتين معًا فيبقى المستخدم موصولًا بذكراه وهو يتدرّب.
 */

import { html, raw, esc } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { confirmAction } from '../components/modal.js';
import { navigate } from '../router.js';
import { splitWords } from '../services/shadow/segmenter.js';
import {
  createPlaybackController,
  PRACTICE_MODE,
  REPEAT_MODE,
  intervalLabel,
} from '../services/shadow/playback-controller.js';
import { loadVoices, stepRate } from '../services/shadow/tts-controller.js';
import {
  completeSession,
  detectSourceChange,
  loadSession,
  markDifficult,
  recordSegmentPractice,
  savePosition,
  saveSessionSettings,
} from '../services/shadow/shadow-session-service.js';
import { scripts, contentBlocks } from '../db/repositories.js';

/** المحرّك الحيّ للشاشة الحالية. */
let player = null;
let context = null;

/** يُنادى عند مغادرة الشاشة — بدونه يظلّ الصوت شغّالًا. */
export function disposeShadow() {
  player?.destroy();
  player = null;
  context = null;
}

/** يقرأ النصّ الحالي للمصدر لكشف تغيّره. */
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

  // كشف تغيّر المصدر — إبلاغ لا استبدال (بند 17).
  const current = await readCurrentSource(session);
  const change = current ? detectSourceChange(session, current) : { changed: false };

  context = { session, segments, change };

  main.innerHTML = shell(session, segments, change);

  const els = {
    book: main.querySelector('.shadow-book'),
    lines: main.querySelector('[data-lines]'),
    currentText: main.querySelector('[data-current-text]'),
    translation: main.querySelector('[data-translation]'),
    position: main.querySelector('[data-position]'),
    meter: main.querySelector('[data-meter] > span'),
    counter: main.querySelector('[data-counter]'),
    playBtn: main.querySelector('[data-shadow="play"]'),
    words: main.querySelector('[data-words]'),
    speedChip: main.querySelector('[data-chip="speed"] b'),
    repeatChip: main.querySelector('[data-chip="repeat"] b'),
    intervalChip: main.querySelector('[data-chip="interval"] b'),
  };

  player = createPlaybackController({
    segments: segments.map((s) => ({ id: s.id, text: s.sourceTextSnapshot })),
    settings: session,
    onEvent: (event) => handleEvent(event, els),
  });

  player.goTo(session.currentSegmentIndex || 0);
  syncSegmentUi(els);
  wireDivider(main, els.book);
  wireInteractions(main, els);
}

/* ------------------------------------------------------------------ *
 * القالب
 * ------------------------------------------------------------------ */

function shell(session, segments, change) {
  return html`
    <div class="shadow-book">
      <div class="shadow-head">
        <button class="btn btn-ghost btn-sm" data-shadow="exit">${raw(icon('back', 16))}</button>
        <h1>${session.title}</h1>
        <span class="shadow-pos" data-position>1 / ${segments.length}</span>
      </div>

      <div class="shadow-pages">
        <div class="shadow-page shadow-source">
          ${raw(change.changed ? staleBanner(change) : '')}
          <div data-lines>
            ${raw(segments.map((segment, i) => line(segment, i)).join(''))}
          </div>
        </div>

        <div class="shadow-divider" data-divider role="separator"
             aria-label="اسحب لتغيير حجم الصفحتين"></div>

        <div class="shadow-page shadow-practice">
          <div class="shadow-current" data-current-text></div>
          <div class="shadow-translation" data-translation></div>

          <div class="shadow-meter" data-meter><span></span></div>
          <div style="text-align:center" class="text-sm text-soft">
            <span data-counter>—</span>
          </div>

          <div class="shadow-controls">
            <button class="shadow-btn" data-shadow="prev" aria-label="السابق">‹</button>
            <button class="shadow-btn primary" data-shadow="play" aria-label="تشغيل">▶</button>
            <button class="shadow-btn" data-shadow="next" aria-label="التالي">›</button>
          </div>

          <div class="shadow-quick">
            <button class="shadow-chip" data-chip="speed" data-shadow="speed-down">
              سرعة <b>${session.speed}</b>×
            </button>
            <button class="shadow-chip" data-chip="repeat" data-shadow="repeat-up">
              تكرار <b>${session.repeatCount}</b>
            </button>
            <button class="shadow-chip" data-chip="interval" data-shadow="interval-up">
              فاصل <b>${intervalLabel({ unit: session.intervalUnit, steps: session.intervalSteps })}</b>
            </button>
            <button class="shadow-chip" data-shadow="toggle-words">✦ الكلمات</button>
            <button class="shadow-chip" data-shadow="mark-difficult">صعبة</button>
          </div>

          <div class="shadow-words" data-words hidden></div>
        </div>
      </div>
    </div>`;
}

function line(segment, index) {
  const done = segment.repetitionsCompleted > 0;
  const classes = [
    'shadow-line',
    done ? 'practiced' : '',
    segment.practiceStatus === 'difficult' ? 'difficult' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return html`<button class="${classes}" data-line="${index}" dir="auto">
    ${segment.sourceTextSnapshot}
    ${raw(done ? html`<span class="shadow-line-meta">${segment.repetitionsCompleted} تكرار</span>` : '')}
  </button>`;
}

function staleBanner(change) {
  const from = change.sessionVersion ?? '؟';
  const to = change.currentVersion ?? '؟';
  return html`
    <div class="shadow-stale">
      <strong>المصدر اتغيّر بعد ما بدأت الجلسة دي.</strong><br />
      الجلسة اتعملت من نسخة ${from}، والحالي نسخة ${to}
      (${change.currentSegmentCount} جملة دلوقتي).
      بنكمّل على النصّ اللي بتتدرّب عليه — مش هنبدّله من تحت إيدك.
      <button class="btn btn-ghost btn-sm" data-shadow="new-from-current">
        اعمل جلسة جديدة من النسخة الحالية
      </button>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * الأحداث
 * ------------------------------------------------------------------ */

function handleEvent(event, els) {
  switch (event.type) {
    case 'start':
    case 'resume':
      els.playBtn.textContent = '⏸';
      break;

    case 'pause':
    case 'stop':
      els.playBtn.textContent = '▶';
      els.currentText.classList.remove('speaking');
      break;

    case 'repeat': {
      const settings = player.state.settings;
      const isCount = settings.repeatMode === REPEAT_MODE.COUNT;
      els.counter.textContent = isCount
        ? `${event.repetition} / ${settings.repeatCount}`
        : `×${event.repetition}`;
      els.meter.style.width = isCount
        ? `${Math.min(100, (event.repetition / settings.repeatCount) * 100)}%`
        : '100%';
      els.currentText.classList.add('speaking');
      highlightWord(els, event.wordIndex);
      break;
    }

    case 'seek':
    case 'word-select':
      syncSegmentUi(els);
      break;

    case 'segment-complete':
      persistSegment(event);
      break;

    case 'session-complete':
      els.playBtn.textContent = '▶';
      els.currentText.classList.remove('speaking');
      finishSession();
      break;

    default:
      break;
  }
}

/** يحفظ تكرارات المقطع المكتمل — دليل ممارسة لا إتقان. */
async function persistSegment(event) {
  if (!context) return;
  const segment = context.segments[event.index];
  if (!segment) return;

  try {
    const updated = await recordSegmentPractice(
      context.session,
      segment,
      event.repetitions,
      { speed: player.state.settings.rate }
    );
    context.segments[event.index] = updated;

    const node = document.querySelector(`[data-line="${event.index}"]`);
    if (node) {
      node.classList.add('practiced');
      const meta = node.querySelector('.shadow-line-meta');
      if (meta) meta.textContent = `${updated.repetitionsCompleted} تكرار`;
      else node.insertAdjacentHTML('beforeend', `<span class="shadow-line-meta">${updated.repetitionsCompleted} تكرار</span>`);
    }
  } catch (error) {
    console.error('[shadow] تعذّر حفظ التكرارات', error);
  }
}

async function finishSession() {
  if (!context) return;
  const summary = await completeSession(context.session.id);
  if (!summary) return;

  const minutes = Math.max(1, Math.round(summary.durationMs / 60000));
  toastOk(
    `خلصت — ${summary.segmentsPracticed} من ${summary.segmentsTotal} جملة · ` +
      `${summary.totalRepetitions} تكرار · ${minutes} دقيقة`
  );
}

/** يحدّث الصفحتين معًا عند تغيّر المقطع. */
function syncSegmentUi(els) {
  if (!player || !context) return;

  const { index } = player.state;
  const segment = context.segments[index];
  if (!segment) return;

  els.currentText.textContent = segment.sourceTextSnapshot;
  els.translation.textContent = segment.translationSnapshot || '';
  els.position.textContent = `${index + 1} / ${context.segments.length}`;
  els.counter.textContent = '—';
  els.meter.style.width = '0%';

  document.querySelectorAll('[data-line]').forEach((node) => {
    const isCurrent = Number(node.dataset.line) === index;
    node.classList.toggle('current', isCurrent);
    // الرابط البصري: الجملة الجارية تُجلب لمرأى العين في صفحة المصدر.
    if (isCurrent) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  if (!els.words.hidden) renderWords(els);
  savePosition(context.session.id, index).catch(() => {});
}

function renderWords(els) {
  const segment = context.segments[player.state.index];
  const words = splitWords(segment.sourceTextSnapshot);
  player.setWords(words);
  els.words.innerHTML = words
    .map((w, i) => `<button class="shadow-word" data-word="${i}">${esc(w.display)}</button>`)
    .join('');
}

function highlightWord(els, wordIndex) {
  if (els.words.hidden) return;
  els.words.querySelectorAll('[data-word]').forEach((node, i) => {
    node.classList.toggle('speaking', i === wordIndex);
  });
}

/* ------------------------------------------------------------------ *
 * التفاعل
 * ------------------------------------------------------------------ */

function wireInteractions(main, els) {
  main.addEventListener('click', async (event) => {
    const lineNode = event.target.closest('[data-line]');
    if (lineNode) {
      player.goTo(Number(lineNode.dataset.line));
      return;
    }

    const wordNode = event.target.closest('[data-word]');
    if (wordNode) {
      els.words.querySelectorAll('[data-word]').forEach((n) => n.classList.remove('selected'));
      wordNode.classList.add('selected');
      player.updateSettings({ practiceMode: PRACTICE_MODE.WORD });
      player.selectWord(Number(wordNode.dataset.word));
      player.start();
      return;
    }

    const button = event.target.closest('[data-shadow]');
    if (!button) return;

    const settings = player.state.settings;

    switch (button.dataset.shadow) {
      case 'exit':
        return navigate(context.session.sceneId ? `/scene/${context.session.sceneId}` : '/life');

      case 'play':
        if (player.state.running && !player.state.paused) player.pause();
        else if (player.state.paused) player.resume();
        else player.start();
        return;

      case 'prev':
        return player.previous();

      case 'next':
        return player.next();

      case 'speed-down': {
        // نقرة تنزل خطوة، ولمّا نوصل لأبطأ قيمة نلفّ لأسرعها.
        const next = settings.rate <= 0.3 ? 2.0 : stepRate(settings.rate, -1);
        player.updateSettings({ rate: next });
        els.speedChip.textContent = next;
        return saveSessionSettings(context.session.id, { speed: next });
      }

      case 'repeat-up': {
        const next = settings.repeatCount >= 10 ? 1 : settings.repeatCount + 1;
        player.updateSettings({ repeatCount: next });
        els.repeatChip.textContent = next;
        return saveSessionSettings(context.session.id, { repeatCount: next });
      }

      case 'interval-up': {
        const steps = settings.intervalSteps >= 8 ? 1 : settings.intervalSteps + 1;
        player.updateSettings({ intervalSteps: steps });
        els.intervalChip.textContent = intervalLabel({ unit: settings.intervalUnit, steps });
        return saveSessionSettings(context.session.id, { intervalSteps: steps });
      }

      case 'toggle-words': {
        els.words.hidden = !els.words.hidden;
        button.classList.toggle('on', !els.words.hidden);
        if (els.words.hidden) {
          player.updateSettings({ practiceMode: PRACTICE_MODE.SENTENCE });
        } else {
          renderWords(els);
        }
        return;
      }

      case 'mark-difficult': {
        const segment = context.segments[player.state.index];
        const updated = await markDifficult(segment.id, segment.practiceStatus !== 'difficult');
        context.segments[player.state.index] = updated;
        document
          .querySelector(`[data-line="${player.state.index}"]`)
          ?.classList.toggle('difficult', updated.practiceStatus === 'difficult');
        toast(updated.practiceStatus === 'difficult' ? 'اتعلّمت كصعبة' : 'اتشالت من الصعب');
        return;
      }

      case 'new-from-current': {
        const ok = await confirmAction({
          title: 'جلسة جديدة من النسخة الحالية',
          message:
            'هنعمل جلسة جديدة من النصّ الحالي. الجلسة دي هتفضل موجودة زي ما هي بكل تكراراتك.',
          confirmLabel: 'اعمل جديدة',
        });
        if (!ok) return;
        toast('هيتنفّذ مع ربط المصادر — لسه مش جاهز');
        return;
      }

      default:
        return;
    }
  });
}

/**
 * الفاصل القابل للسحب.
 * يعمل بالماوس واللمس معًا عبر Pointer Events — على تابلت اللمس
 * هو الأصل، وأحداث الماوس وحدها لا تكفي.
 */
function wireDivider(main, book) {
  const divider = main.querySelector('[data-divider]');
  if (!divider) return;

  let dragging = false;

  const apply = (event) => {
    const horizontal = window.matchMedia('(min-width: 900px)').matches;
    const rect = book.querySelector('.shadow-pages').getBoundingClientRect();
    const ratio = horizontal
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    // الحدّان يمنعان اختفاء إحدى الصفحتين تمامًا.
    const clamped = Math.max(0.25, Math.min(0.8, ratio));
    book.style.setProperty('--split', `${(clamped * 100).toFixed(1)}%`);
  };

  divider.addEventListener('pointerdown', (event) => {
    dragging = true;
    divider.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  divider.addEventListener('pointermove', (event) => {
    if (dragging) apply(event);
  });

  divider.addEventListener('pointerup', (event) => {
    dragging = false;
    divider.releasePointerCapture(event.pointerId);
  });
}

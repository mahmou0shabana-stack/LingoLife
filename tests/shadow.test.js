/**
 * LingoLife — اختبارات الشادوينج
 *
 * تحرس نقطتين لا يجوز أن تنكسرا:
 *   1. المحرّك المنقول من التطبيق القديم يتصرّف كما كان.
 *   2. التكرار يبقى **دليل ممارسة** ولا يترقّى وحده إلى إتقان.
 */

import { describe, it, expect } from './test-runner.js';
import { splitSentences, splitWords, contentHash, hasCyrillic } from '../js/services/shadow/segmenter.js';
import {
  createPlaybackController,
  REPEAT_MODE,
  PRACTICE_MODE,
  intervalMs,
  intervalLabel,
  INTERVAL_MIN_MS,
  INTERVAL_MAX_MS,
} from '../js/services/shadow/playback-controller.js';
import { stepRate, RATE_STEPS } from '../js/services/shadow/tts-controller.js';
import {
  FONTS,
  FONT_FORMS,
  FONTS_HREF,
  fontById,
  fontFullLabel,
  fontsByForm,
  measureFont,
} from '../js/services/shadow/fonts.js';
import {
  createSession,
  loadSession,
  detectSourceChange,
  recordSegmentPractice,
  savePosition,
  completeSession,
  resumableSessions,
  globalDefaults,
  saveGlobalDefaults,
  describeSource,
  SOURCE_TYPE,
  SEGMENT_STATUS,
} from '../js/services/shadow/shadow-session-service.js';
import { practiceEvidence, shadowSessions, shadowSegments, ALL_REPOS } from '../js/db/repositories.js';
import {
  loadExpressionIndex, clearExpressionIndex, expressionsIn,
} from '../js/services/shadow/analysis-link.js';
import { withTx } from '../js/db/database.js';

/** نطق وهمي فوري — يجعل اختبار آلة الحالة حتميًا. */
const silentSpeaker = () => Promise.resolve({ ok: true });

/** ينتظر حتى يتحقّق شرط أو تنتهي المهلة. */
function waitFor(predicate, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeout) return reject(new Error('انتهت المهلة قبل تحقّق الشرط'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

async function wipeShadow() {
  await withTx(['shadowSessions', 'shadowSegments', 'practiceEvidence'], 'readwrite', (tx) => {
    tx.objectStore('shadowSessions').clear();
    tx.objectStore('shadowSegments').clear();
    tx.objectStore('practiceEvidence').clear();
  });
}

const RU_TEXT = `Привет! Как дела? Я хочу учить русский язык.
Сегодня хорошая погода.`;

/* ================================================================== *
 * التقسيم — منقول من parseCustomText
 * ================================================================== */

describe('تقسيم الجمل', () => {
  it('يقسّم على النقطة وعلامتَي التعجّب والاستفهام', () => {
    const sentences = splitSentences('Привет! Как дела? Я тут.');
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe('Привет!');
  });

  it('يُبقي علامة الترقيم مع جملتها', () => {
    expect(splitSentences('Как дела?')[0]).toBe('Как дела?');
  });

  it('يقسّم على السطر الجديد أيضًا', () => {
    expect(splitSentences(RU_TEXT)).toHaveLength(4);
  });

  it('يستبعد السطور التي لا روسية فيها', () => {
    // حالة شائعة في نصوصك: شرح عربي وسط نصّ روسي.
    const mixed = 'Привет как дела.\nده شرح بالعربي.\nСегодня хорошо.';
    const sentences = splitSentences(mixed);
    expect(sentences).toHaveLength(2);
    expect(sentences.some((s) => s.includes('شرح'))).toBeFalsy();
  });

  it('يسمح بالنصّ غير الروسي عند الطلب', () => {
    const sentences = splitSentences('ده شرح بالعربي كامل.', { requireCyrillic: false });
    expect(sentences).toHaveLength(1);
  });

  it('يتجاهل الشظايا الأقصر من أربعة أحرف', () => {
    // «Да.» ثلاثة أحرف فتسقط، و«Нет.» أربعة فتبقى — وهي فعلًا جملة
    // يصحّ التدرّب عليها. نفس حدّ التطبيق القديم (`length > 3`).
    const sentences = splitSentences('Да. Нет. Привет как дела сегодня.');
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toBe('Нет.');
  });

  it('يعيد مصفوفة فارغة للمدخل الفارغ', () => {
    expect(splitSentences('')).toHaveLength(0);
    expect(splitSentences(null)).toHaveLength(0);
  });
});

describe('تقسيم الكلمات', () => {
  it('ينظّف الترقيم من النطق ويُبقيه في العرض', () => {
    const words = splitWords('Привет, как дела?');
    expect(words).toHaveLength(3);
    expect(words[0].display).toBe('Привет,');
    expect(words[0].spoken).toBe('Привет');
    expect(words[2].spoken).toBe('дела');
  });

  it('يحافظ على ترتيب الكلمات', () => {
    const words = splitWords('один два три');
    expect(words.map((w) => w.spoken).join(' ')).toBe('один два три');
  });

  it('يتعامل مع المسافات المتعدّدة', () => {
    expect(splitWords('  Привет   мир  ')).toHaveLength(2);
  });
});

describe('بصمة المحتوى', () => {
  it('ثابتة لنفس النصّ', () => {
    expect(contentHash('Привет мир')).toBe(contentHash('Привет мир'));
  });

  it('تتغيّر بأي تعديل', () => {
    expect(contentHash('Привет мир') === contentHash('Привет мир!')).toBeFalsy();
  });

  it('تكشف الروسية', () => {
    expect(hasCyrillic('Привет')).toBeTruthy();
    expect(hasCyrillic('hello')).toBeFalsy();
  });
});

/* ================================================================== *
 * إعدادات المحرّك
 * ================================================================== */

describe('السرعة والفواصل', () => {
  it('يتنقّل في سلّم السرعة خطوةً خطوة', () => {
    expect(stepRate(0.8, 1)).toBe(0.9);
    expect(stepRate(0.8, -1)).toBe(0.7);
  });

  it('لا يتجاوز طرفَي السلّم', () => {
    expect(stepRate(2.0, 1)).toBe(2.0);
    expect(stepRate(0.3, -1)).toBe(0.3);
  });

  it('يلتقط أقرب خطوة لقيمة غريبة', () => {
    expect(RATE_STEPS.includes(stepRate(0.83, 0))).toBeTruthy();
  });

  it('يحسب الفاصل بوحدتيه كما في التطبيق القديم', () => {
    expect(intervalMs({ unit: 's', steps: 2 })).toBe(1000);
    expect(intervalMs({ unit: 'ms', steps: 5 })).toBe(500);
    expect(intervalLabel({ unit: 's', steps: 3 })).toBe('1.5s');
  });

  it('القيمة الحرّة بالملّي تسبق سلّم الوحدات', () => {
    // جلسة قديمة فيها unit/steps + قيمة حرّة جديدة: الحرّة هي الحاكمة.
    expect(intervalMs({ unit: 's', steps: 2, intervalMsValue: 250 })).toBe(250);
    expect(intervalLabel({ intervalMsValue: 250 })).toBe('250ms');
    expect(intervalLabel({ intervalMsValue: 1500 })).toBe('1.5s');
  });

  it('القيمة الحرّة تُقصّ عند الحدّين', () => {
    expect(intervalMs({ intervalMsValue: -300 })).toBe(INTERVAL_MIN_MS);
    expect(intervalMs({ intervalMsValue: 999999 })).toBe(INTERVAL_MAX_MS);
  });

  it('غياب القيمة الحرّة يُبقي الجلسات القديمة تعمل كما كانت', () => {
    expect(intervalMs({ unit: 's', steps: 4, intervalMsValue: null })).toBe(2000);
  });
});

/* ================================================================== *
 * آلة حالة التشغيل
 * ================================================================== */

describe('محرّك التشغيل', () => {
  const segments = [
    { id: 'a', text: 'Привет' },
    { id: 'b', text: 'Как дела' },
    { id: 'c', text: 'Хорошо' },
  ];

  function build(settings = {}, onEvent = () => {}) {
    return createPlaybackController({
      segments,
      speaker: silentSpeaker,
      onEvent,
      settings: {
        repeatCount: 2,
        intervalUnit: 'ms',
        intervalSteps: 1,
        autoAdvance: false,
        ...settings,
      },
    });
  }

  it('يكرّر بالعدد المطلوب ثم يقف', async () => {
    let completed = false;
    const player = build({}, (e) => {
      if (e.type === 'segment-complete') completed = true;
    });

    player.start();
    await waitFor(() => completed);
    expect(player.state.repetition).toBe(2);
    player.destroy();
  });

  it('ينتقل تلقائيًا للمقطع التالي عند تفعيل ذلك', async () => {
    const player = build({ autoAdvance: true });
    player.start();
    await waitFor(() => player.state.index === 1);
    expect(player.currentSegment.text).toBe('Как дела');
    player.destroy();
  });

  it('ينهي الجلسة عند آخر مقطع', async () => {
    let done = false;
    const player = build({ autoAdvance: true }, (e) => {
      if (e.type === 'session-complete') done = true;
    });
    player.start();
    await waitFor(() => done, 6000);
    expect(player.state.finished).toBeTruthy();
    player.destroy();
  });

  it('لا يقف في الوضع المستمرّ', async () => {
    const player = build({ repeatMode: REPEAT_MODE.CONTINUOUS });
    player.start();
    await waitFor(() => player.state.repetition >= 4, 5000);
    expect(player.state.running).toBeTruthy();
    player.destroy();
  });

  it('يوقف مؤقتًا ويستأنف بلا فقدان الموضع', async () => {
    const player = build({ repeatMode: REPEAT_MODE.CONTINUOUS });
    player.start();
    await waitFor(() => player.state.repetition >= 2);

    player.pause();
    const at = player.state.repetition;
    expect(player.state.paused).toBeTruthy();

    await new Promise((r) => setTimeout(r, 200));
    expect(player.state.repetition).toBe(at);

    player.resume();
    await waitFor(() => player.state.repetition > at);
    player.destroy();
  });

  it('التنقّل لا يورّث عدّاد المقطع السابق', async () => {
    const player = build({ repeatMode: REPEAT_MODE.CONTINUOUS });
    player.start();
    await waitFor(() => player.state.repetition >= 3);

    player.next();
    expect(player.state.index).toBe(1);
    // التشغيل مستمرّ فالعدّاد يبدأ دورته الأولى فورًا (1 لا 0) — وهو
    // ما يعرضه الشريط «1/5». المهمّ ألّا يحمل عدّاد المقطع السابق.
    expect(player.state.repetition).toBe(1);
    player.destroy();
  });

  it('التنقّل وهو متوقّف يترك العدّاد صفرًا', () => {
    const player = build();
    player.goTo(2);
    expect(player.state.index).toBe(2);
    expect(player.state.repetition).toBe(0);
    expect(player.state.running).toBeFalsy();
    player.destroy();
  });

  it('السابق لا ينزل تحت الصفر', () => {
    const player = build();
    player.previous();
    expect(player.state.index).toBe(0);
    player.destroy();
  });

  it('رمز الدورة يمنع تراكب الجمل عند التبديل السريع', async () => {
    // كان هذا أصعب باج في التطبيق القديم: تبديل سريع فتُسمع جملتان
    // معًا لأن دورة قديمة ما زالت حيّة.
    const spoken = [];
    const player = createPlaybackController({
      segments,
      settings: { repeatCount: 5, intervalUnit: 'ms', intervalSteps: 1, autoAdvance: false },
      speaker: (text) => {
        spoken.push(text);
        return new Promise((r) => setTimeout(() => r({ ok: true }), 30));
      },
    });

    player.start();
    player.goTo(1);
    player.goTo(2);
    await new Promise((r) => setTimeout(r, 400));

    // كل ما نُطق بعد الاستقرار لا بد أن يكون المقطع الأخير وحده.
    const tail = spoken.slice(-3);
    expect(tail.every((t) => t === 'Хорошо')).toBeTruthy();
    player.destroy();
  });

  it('يبدّل الإعدادات أثناء التشغيل بلا إعادة تشغيل', async () => {
    const player = build({ repeatMode: REPEAT_MODE.CONTINUOUS });
    player.start();
    await waitFor(() => player.state.repetition >= 1);

    player.updateSettings({ rate: 1.5 });
    expect(player.state.settings.rate).toBe(1.5);
    expect(player.state.running).toBeTruthy();
    player.destroy();
  });

  it('وضع الكلمة ينطق الكلمة المختارة لا الجملة', async () => {
    const spoken = [];
    const player = createPlaybackController({
      segments,
      settings: {
        practiceMode: PRACTICE_MODE.WORD,
        repeatCount: 1,
        intervalUnit: 'ms',
        intervalSteps: 1,
        autoAdvance: false,
      },
      speaker: (text) => {
        spoken.push(text);
        return Promise.resolve({ ok: true });
      },
    });

    player.setWords(splitWords('Как дела'));
    player.selectWord(1);
    player.start();
    await waitFor(() => spoken.length > 0);
    expect(spoken[0]).toBe('дела');
    player.destroy();
  });
});

/* ================================================================== *
 * الجلسات
 * ================================================================== */

describe('جلسات الظلّ', () => {
  it('تُنشأ من نصّ وتقسّمه إلى مقاطع', async () => {
    await wipeShadow();
    const { session, segments } = await createSession({
      title: 'اجتماع المصنع',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_1',
      sourceVersion: 3,
      sceneId: 'SC_1',
      text: RU_TEXT,
    });

    expect(segments).toHaveLength(4);
    expect(session.sourceVersion).toBe(3);
    expect(session.currentSegmentIndex).toBe(0);
    expect(segments[0].practiceStatus).toBe(SEGMENT_STATUS.PENDING);
  });

  it('ترفض مصدرًا بلا جمل صالحة', async () => {
    await expect(
      createSession({ title: 'فاضي', sourceType: SOURCE_TYPE.SCRIPT, sourceId: 'x', text: 'hi' })
    ).toReject('مفيش جمل');
  });

  it('تحفظ لقطة النصّ لا مرجعًا حيًّا', async () => {
    await wipeShadow();
    const { segments } = await createSession({
      title: 'لقطة',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_2',
      text: RU_TEXT,
    });
    expect(segments[0].sourceTextSnapshot).toBe('Привет!');
  });

  it('تستأنف من الموضع المحفوظ بعد إغلاق التطبيق', async () => {
    await wipeShadow();
    const { session } = await createSession({
      title: 'استئناف',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_3',
      text: RU_TEXT,
    });

    await savePosition(session.id, 2);

    // قراءة جديدة من القاعدة — كأن التطبيق أُغلق وفُتح.
    const reopened = await loadSession(session.id);
    expect(reopened.session.currentSegmentIndex).toBe(2);
    expect(reopened.segments).toHaveLength(4);
    expect(reopened.segments[0].order).toBe(0);
  });

  it('ترث الإعدادات العامّة وتسمح بتجاوزها', async () => {
    await wipeShadow();
    await saveGlobalDefaults({ speed: 0.6, repeatCount: 7 });
    const defaults = await globalDefaults();
    expect(defaults.speed).toBe(0.6);

    const { session } = await createSession({
      title: 'وراثة',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_4',
      text: RU_TEXT,
    });
    expect(session.speed).toBe(0.6);
    expect(session.repeatCount).toBe(7);

    const { session: custom } = await createSession({
      title: 'تجاوز',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_5',
      text: RU_TEXT,
      settings: { speed: 1.2 },
    });
    expect(custom.speed).toBe(1.2);
    expect(custom.repeatCount).toBe(7);

    await saveGlobalDefaults({ speed: 0.8, repeatCount: 5 });
  });
});

/* ================================================================== *
 * كشف تغيّر المصدر
 * ================================================================== */

describe('تغيّر المصدر', () => {
  it('لا ينذر إذا لم يتغيّر شيء', async () => {
    await wipeShadow();
    const { session } = await createSession({
      title: 'ثابت',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_6',
      sourceVersion: 3,
      text: RU_TEXT,
    });

    const result = detectSourceChange(session, { text: RU_TEXT, version: 3 });
    expect(result.changed).toBeFalsy();
  });

  it('ينذر عند تعديل المصدر ويحمل الإصدارين', async () => {
    await wipeShadow();
    const { session } = await createSession({
      title: 'متغيّر',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_7',
      sourceVersion: 3,
      text: RU_TEXT,
    });

    const result = detectSourceChange(session, {
      text: RU_TEXT + '\nНовое предложение здесь.',
      version: 4,
    });

    expect(result.changed).toBeTruthy();
    expect(result.sessionVersion).toBe(3);
    expect(result.currentVersion).toBe(4);
    expect(result.currentSegmentCount).toBe(5);
  });

  it('لا ينذر لمجرّد تغيّر المسافات', async () => {
    await wipeShadow();
    const { session } = await createSession({
      title: 'مسافات',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_8',
      text: RU_TEXT,
    });
    const spaced = RU_TEXT.replace(/\n/g, '\n\n  ');
    expect(detectSourceChange(session, { text: spaced }).changed).toBeFalsy();
  });

  it('المقاطع القديمة تبقى مقروءة بعد تغيّر المصدر', async () => {
    await wipeShadow();
    const { session } = await createSession({
      title: 'قديم',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_9',
      text: RU_TEXT,
    });

    // المصدر تغيّر — والجلسة القديمة لا تُمَسّ.
    const reloaded = await loadSession(session.id);
    expect(reloaded.segments[0].sourceTextSnapshot).toBe('Привет!');
    expect(reloaded.segments).toHaveLength(4);
  });
});

/* ================================================================== *
 * دليل الممارسة — الوعد الأهم
 * ================================================================== */

describe('دليل الممارسة', () => {
  it('يسجّل التكرارات على المقطع والجلسة', async () => {
    await wipeShadow();
    const { session, segments } = await createSession({
      title: 'تسجيل',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_10',
      text: RU_TEXT,
    });

    await recordSegmentPractice(session, segments[0], 10, { speed: 0.8 });

    const updated = await shadowSegments.get(segments[0].id);
    expect(updated.repetitionsCompleted).toBe(10);
    expect(updated.practiceStatus).toBe(SEGMENT_STATUS.PRACTICED);

    const reloadedSession = await shadowSessions.get(session.id);
    expect(reloadedSession.totalRepetitions).toBe(10);
  });

  it('⚠️ التكرار لا يعني إتقانًا ولا استخدامًا حقيقيًا', async () => {
    await wipeShadow();
    const { session, segments } = await createSession({
      title: 'بلا ترقية كاذبة',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_11',
      text: RU_TEXT,
    });

    await recordSegmentPractice(session, segments[0], 50, { speed: 0.8 });

    const evidence = (await practiceEvidence.getAll())[0];
    expect(evidence.practiceType).toBe('shadowing');
    expect(evidence.repetitions).toBe(50);
    expect(evidence.meaning).toBe('practiced');
    // خمسون تكرارًا لا ترفع شيئًا وحدها.
    expect(evidence.impliesMastery).toBeFalsy();
    expect(evidence.impliesRealUsage).toBeFalsy();
  });

  it('يربط الدليل بمشهده وجلسته', async () => {
    await wipeShadow();
    const { session, segments } = await createSession({
      title: 'ربط',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_12',
      sceneId: 'SC_99',
      text: RU_TEXT,
    });

    await recordSegmentPractice(session, segments[1], 3);
    const evidence = (await practiceEvidence.getAll())[0];
    expect(evidence.sceneId).toBe('SC_99');
    expect(evidence.sessionId).toBe(session.id);
    expect(evidence.targetId).toBe(segments[1].id);
  });

  it('يميّز المقاطع الصعبة', async () => {
    await wipeShadow();
    const { session, segments } = await createSession({
      title: 'صعب',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_13',
      text: RU_TEXT,
    });

    await recordSegmentPractice(session, segments[2], 5, { difficult: true });
    const updated = await shadowSegments.get(segments[2].id);
    expect(updated.practiceStatus).toBe(SEGMENT_STATUS.DIFFICULT);
    expect(updated.difficulty).toBe(1);
  });

  it('الملخّص بأرقام حقيقية لا إنجازات مُلفّقة', async () => {
    await wipeShadow();
    const { session, segments } = await createSession({
      title: 'ملخّص',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_14',
      text: RU_TEXT,
    });

    await recordSegmentPractice(session, segments[0], 5);
    await recordSegmentPractice(session, segments[1], 3, { difficult: true });

    const summary = await completeSession(session.id);
    expect(summary.segmentsTotal).toBe(4);
    expect(summary.segmentsPracticed).toBe(2);
    expect(summary.totalRepetitions).toBe(8);
    expect(summary.difficultSegments).toHaveLength(1);
  });
});

/* ================================================================== *
 * الاستئناف
 * ================================================================== */

describe('الجلسات القابلة للاستئناف', () => {
  it('ترتّب الأحدث ممارسةً أولًا', async () => {
    await wipeShadow();
    const a = await createSession({
      title: 'الأولى',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_15',
      text: RU_TEXT,
    });
    const b = await createSession({
      title: 'الثانية',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_16',
      text: RU_TEXT,
    });

    await savePosition(a.session.id, 1);
    const list = await resumableSessions();
    expect(list[0].id).toBe(a.session.id);
    expect(list).toHaveLength(2);
    expect(b.session.title).toBe('الثانية');
  });

  it('تستبعد الجلسات المكتملة', async () => {
    await wipeShadow();
    const { session } = await createSession({
      title: 'مكتملة',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: 'SCR_17',
      text: RU_TEXT,
    });
    await completeSession(session.id);
    expect(await resumableSessions()).toHaveLength(0);
  });
});

/* ================================================================== *
 * تدرّب على دورك
 * ================================================================== */

describe('وضع «تدرّب على دورك»', () => {
  const dialogue = [
    { id: 'a', text: 'Привет как дела', isMine: 0 },
    { id: 'b', text: 'Хорошо спасибо', isMine: 1 },
    { id: 'c', text: 'Отлично рад слышать', isMine: 0 },
  ];

  it('ينطق الطرف الآخر ويصمت في دورك', async () => {
    const spoken = [];
    const turns = [];

    const player = createPlaybackController({
      segments: dialogue,
      settings: {
        practiceMode: PRACTICE_MODE.MY_ROLE,
        repeatCount: 1,
        intervalUnit: 'ms',
        intervalSteps: 1,
        autoAdvance: true,
      },
      speaker: (text) => {
        spoken.push(text);
        return Promise.resolve({ ok: true });
      },
      onEvent: (e) => {
        if (e.type === 'your-turn') turns.push(e.text);
      },
    });

    player.start();
    await waitFor(() => player.state.finished, 12000);

    // مقطعا الطرف الآخر نُطقا، ومقطعي أنا لم يُنطق.
    expect(spoken).toHaveLength(2);
    expect(spoken.join('|')).toBe('Привет как дела|Отлично рад слышать');
    expect(turns).toHaveLength(1);
    expect(turns[0]).toBe('Хорошо спасибо');
    player.destroy();
  });

  it('ينطق كل المقاطع في الوضع العادي', async () => {
    const spoken = [];
    const player = createPlaybackController({
      segments: dialogue,
      settings: {
        practiceMode: PRACTICE_MODE.SENTENCE,
        repeatCount: 1,
        intervalUnit: 'ms',
        intervalSteps: 1,
        autoAdvance: true,
      },
      speaker: (text) => {
        spoken.push(text);
        return Promise.resolve({ ok: true });
      },
    });

    player.start();
    await waitFor(() => player.state.finished, 12000);
    expect(spoken).toHaveLength(3);
    player.destroy();
  });
});

/* ================================================================== *
 * ربط التحليل
 * ================================================================== */

describe('علامات التحليل داخل الظلّ', () => {
  it('يلتقط تعبيرًا محلَّلًا داخل الجملة', async () => {
    await withTx('expressions', 'readwrite', (tx) => tx.objectStore('expressions').clear());
    await ALL_REPOS.expressions.create({
      text: 'спасибо большое',
      normalizedText: 'спасибо большое',
      meaningAr: 'شكرًا جزيلًا',
      register: 'neutral',
    });
    await loadExpressionIndex();

    const found = expressionsIn('Он сказал спасибо большое и ушёл.');
    expect(found).toHaveLength(1);
    expect(found[0].text).toBe('спасибо большое');
  });

  it('لا يلتقط ما ليس في الجملة', async () => {
    expect(expressionsIn('Привет как дела')).toHaveLength(0);
  });

  it('يفضّل التعبير الأطول فلا يبتلعه الأقصر', async () => {
    await ALL_REPOS.expressions.create({
      text: 'спасибо',
      normalizedText: 'спасибо',
      meaningAr: 'شكرًا',
      register: 'neutral',
    });
    await loadExpressionIndex();

    // «спасибо большое» موجود، فلا يُبلَّغ عن «спасибо» وحده داخله.
    const found = expressionsIn('спасибо большое');
    expect(found).toHaveLength(1);
    expect(found[0].text).toBe('спасибо большое');
    clearExpressionIndex();
  });
});

/* ================================================================== *
 * وضع الكلمة — باج تاريخي
 * ================================================================== */

/* ================================================================== *
 * تحديد المقاطع داخل الجلسة (بند 21)
 * ================================================================== */

describe('تحديد المقاطع', () => {
  const five = [
    { id: 'a', text: 'Первая фраза здесь' },
    { id: 'b', text: 'Вторая фраза здесь' },
    { id: 'c', text: 'Третья фраза здесь' },
    { id: 'd', text: 'Четвёртая фраза тут' },
    { id: 'e', text: 'Пятая фраза тут' },
  ];

  function build(settings = {}) {
    return createPlaybackController({
      segments: five,
      speaker: silentSpeaker,
      settings: { repeatCount: 1, intervalMsValue: 0, autoAdvance: false, ...settings },
    });
  }

  it('بلا تحديد: كل المقاطع داخل التدريب', () => {
    const player = build();
    expect(player.selection).toEqual([]);
    expect(player.isSelected(0)).toBe(true);
    expect(player.isSelected(4)).toBe(true);
    player.destroy();
  });

  it('التالي يتخطّى غير المحدَّد', () => {
    const player = build();
    player.setSelection([0, 2, 4]);

    expect(player.state.index).toBe(0);
    player.next();
    expect(player.state.index).toBe(2);   // تخطّى 1
    player.next();
    expect(player.state.index).toBe(4);   // تخطّى 3
    player.destroy();
  });

  it('السابق يتخطّى غير المحدَّد كذلك', () => {
    const player = build();
    player.setSelection([0, 2, 4]);
    player.goTo(4);

    player.previous();
    expect(player.state.index).toBe(2);
    player.previous();
    expect(player.state.index).toBe(0);
    player.destroy();
  });

  it('السابق عند أوّل محدَّد لا يخرج منه', () => {
    const player = build();
    player.setSelection([2, 3]);
    player.goTo(2);
    player.previous();
    // لا يقفز إلى 1 لأنها خارج تحديدك.
    expect(player.state.index).toBe(2);
    player.destroy();
  });

  it('البدء من مقطعٍ خارج التحديد يقفز لأوّل محدَّد', () => {
    const player = build();
    player.goTo(0);
    player.setSelection([3, 4]);
    player.start();
    expect(player.state.index).toBe(3);
    player.destroy();
  });

  it('⚠️ التقدّم التلقائي يدور في المحدَّد وحده ثم ينتهي', async () => {
    const visited = [];
    const player = createPlaybackController({
      segments: five,
      speaker: silentSpeaker,
      settings: { repeatCount: 1, intervalMsValue: 0, autoAdvance: true },
      onEvent: (e) => { if (e.type === 'repeat') visited.push(e.index); },
    });
    player.setSelection([1, 3]);
    player.goTo(1);
    player.start();

    await waitFor(() => !player.state.running, 4000);
    // مرّ على 1 و3 فقط — ولم يلمس 0 ولا 2 ولا 4.
    expect([...new Set(visited)]).toEqual([1, 3]);
    player.destroy();
  });

  it('الفهارس الأصلية تبقى كما هي — لا ترقيمَ مؤقّت', () => {
    const player = build();
    player.setSelection([2, 4]);
    player.goTo(2);
    // المقطع الثالث يبقى الثالث، فالإبراز في صفحة المصدر لا يضلّ
    // ودليل الممارسة يُنسب إلى المقطع الحقيقي.
    expect(player.currentSegment.id).toBe('c');
    player.next();
    expect(player.currentSegment.id).toBe('e');
    player.destroy();
  });

  it('مسح التحديد يرجع الكلّ', () => {
    const player = build();
    player.setSelection([1]);
    expect(player.isSelected(0)).toBe(false);
    player.setSelection([]);
    expect(player.isSelected(0)).toBe(true);
    player.destroy();
  });
});

describe('اختيار الكلمة', () => {
  const one = [{ id: 'a', text: 'Привет как дела сегодня' }];

  it('ينطق الكلمة المختارة لا الأولى دائمًا', async () => {
    const spoken = [];
    const player = createPlaybackController({
      segments: one,
      settings: { repeatCount: 1, intervalUnit: 'ms', intervalSteps: 1, autoAdvance: false,
                  practiceMode: PRACTICE_MODE.WORD },
      speaker: (text) => { spoken.push(text); return Promise.resolve({ ok: true }); },
    });

    const words = splitWords(one[0].text);
    player.setWords(words);
    player.selectWord(3);          // «сегодня»
    player.start();

    await waitFor(() => spoken.length > 0);
    expect(spoken[0]).toBe('сегодня');
    player.destroy();
  });

  it('إعادة ضبط نفس الكلمات لا تُلغي الاختيار', async () => {
    // كان `setWords` يصفّر الفهرس بلا شرط، وإعادة الرسم تناديها —
    // فأيًّا كانت الكلمة المضغوطة تُنطق الأولى.
    const spoken = [];
    const player = createPlaybackController({
      segments: one,
      settings: { repeatCount: 1, intervalUnit: 'ms', intervalSteps: 1, autoAdvance: false,
                  practiceMode: PRACTICE_MODE.WORD },
      speaker: (text) => { spoken.push(text); return Promise.resolve({ ok: true }); },
    });

    player.setWords(splitWords(one[0].text));
    player.selectWord(2);                          // «дела»
    player.setWords(splitWords(one[0].text));      // إعادة رسم
    player.start();

    await waitFor(() => spoken.length > 0);
    expect(spoken[0]).toBe('дела');
    player.destroy();
  });

  /* ---------------------------------------------------------------- *
   * جملة المواصفة بعينها (بند 20)
   *
   * العطل المُبلَّغ كان: «بيقرا أول كلمة بس». أُصلح شقٌّ منه — إعادة
   * الرسم كانت تُلغي الاختيار — لكن الشقّ الأكبر بقي: **لم يكن هناك
   * تسلسلٌ أصلًا**. اكتمال تكرارات الكلمة كان يقفز إلى المقطع التالي،
   * فلا سبيل إلى المرور على كلمات الجملة تباعًا.
   * ---------------------------------------------------------------- */

  const SPEC = [{ id: 'spec', text: 'После того как документ все подпишут' }];
  const SPEC_WORDS = ['После', 'того', 'как', 'документ', 'все', 'подпишут'];

  function wordPlayer(onSpeak, settings = {}) {
    return createPlaybackController({
      segments: SPEC,
      settings: {
        // فاصل صفري: الاختبار يفحص التسلسل لا التوقيت.
        repeatCount: 1, intervalMsValue: 0,
        practiceMode: PRACTICE_MODE.WORD, autoAdvance: true, ...settings,
      },
      speaker: (text) => { onSpeak(text); return Promise.resolve({ ok: true }); },
    });
  }

  it('جملة المواصفة تنقسم إلى ستّ كلمات بالضبط', () => {
    expect(splitWords(SPEC[0].text).map((w) => w.spoken)).toEqual(SPEC_WORDS);
  });

  it('⚠️ التسلسل الكامل: الستّ كلمات كلّها تُقرأ بالترتيب', async () => {
    const spoken = [];
    const player = wordPlayer((t) => spoken.push(t));
    player.setWords(splitWords(SPEC[0].text));
    player.start();

    await waitFor(() => spoken.length >= 6, 4000);
    expect(spoken).toEqual(SPEC_WORDS);
    player.destroy();
  });

  it('كل كلمة تُكرَّر عددها قبل الانتقال للتالية', async () => {
    const spoken = [];
    const player = wordPlayer((t) => spoken.push(t), { repeatCount: 3 });
    player.setWords(splitWords(SPEC[0].text));
    player.start();

    await waitFor(() => spoken.length >= 6, 4000);
    expect(spoken.slice(0, 6)).toEqual([
      'После', 'После', 'После', 'того', 'того', 'того',
    ]);
    player.destroy();
  });

  it('التالي والسابق يتنقّلان بين الكلمات لا بين الجمل', () => {
    const player = wordPlayer(() => {});
    player.setWords(splitWords(SPEC[0].text));

    player.next();
    expect(player.state.wordIndex).toBe(1);
    player.next();
    expect(player.state.wordIndex).toBe(2);
    player.previous();
    expect(player.state.wordIndex).toBe(1);
    // والمقطع لم يتحرّك: التنقّل بالكلمات لا يفقدك جملتك.
    expect(player.state.index).toBe(0);
    player.destroy();
  });

  it('بلا تقدّم تلقائي يقف عند الكلمة ولا يقفز', async () => {
    const spoken = [];
    const player = wordPlayer((t) => spoken.push(t), { autoAdvance: false });
    player.setWords(splitWords(SPEC[0].text));
    player.start();

    await waitFor(() => !player.state.running, 3000);
    expect(spoken).toEqual(['После']);
    player.destroy();
  });

  it('⚠️ الوضعان يحفظان موضعيهما مستقلَّين', () => {
    const player = createPlaybackController({
      segments: [SPEC[0], { id: 'b', text: 'Вторая фраза здесь' }],
      settings: { practiceMode: PRACTICE_MODE.SENTENCE, autoAdvance: false },
      speaker: silentSpeaker,
    });

    // في وضع الجملة: التالي ينقل المقطع.
    player.next();
    expect(player.state.index).toBe(1);

    // ندخل وضع الكلمة على المقطع الثاني.
    player.updateSettings({ practiceMode: PRACTICE_MODE.WORD });
    player.setWords(splitWords('Вторая фраза здесь'));
    player.next();
    expect(player.state.wordIndex).toBe(1);
    // المقطع بقي كما هو — لم تُبتلَع الجملة بتنقّل الكلمات.
    expect(player.state.index).toBe(1);

    // والعودة لوضع الجملة تجد الجملة حيث تُركت.
    player.updateSettings({ practiceMode: PRACTICE_MODE.SENTENCE });
    expect(player.state.index).toBe(1);
    player.destroy();
  });

  it('آخر كلمة تُنهي المقطع لا تعلق عنده', async () => {
    const events = [];
    const player = createPlaybackController({
      segments: SPEC,
      settings: {
        repeatCount: 1, intervalMsValue: 0,
        practiceMode: PRACTICE_MODE.WORD, autoAdvance: true,
      },
      speaker: silentSpeaker,
      onEvent: (e) => events.push(e.type),
    });
    player.setWords(splitWords(SPEC[0].text));
    player.start();

    await waitFor(() => events.includes('words-complete'), 4000);
    expect(events).toContain('words-complete');
    player.destroy();
  });

  it('كلمات مختلفة تصفّر الاختيار', () => {
    const player = createPlaybackController({ segments: one, speaker: silentSpeaker, settings: {} });
    player.setWords(splitWords('один два три'));
    player.selectWord(2);
    player.setWords(splitWords('Привет мир'));
    expect(player.state.running).toBeFalsy();
    player.destroy();
  });
});

/* ================================================================== *
 * الصوت البشري
 * ================================================================== */

describe('مصدر الصوت', () => {
  it('يفضّل التسجيل البشري على TTS حين يوجد', async () => {
    const spoken = [];
    const sources = [];
    // ملف صامت صالح — لا نطق آليًا يُسجَّل حين يعمل البشري.
    const url = URL.createObjectURL(new Blob([new Uint8Array(44)], { type: 'audio/wav' }));

    const player = createPlaybackController({
      segments: [{ id: 'a', text: 'Привет', humanAudioUrl: url }],
      settings: { repeatCount: 1, intervalUnit: 'ms', intervalSteps: 1,
                  autoAdvance: false, audioSource: 'human' },
      speaker: (text) => { spoken.push(text); return Promise.resolve({ ok: true }); },
      onEvent: (e) => { if (e.type === 'source') sources.push(e.source); },
    });

    player.start();
    await waitFor(() => sources.length > 0, 4000);
    expect(sources[0]).toBe('human');
    expect(spoken).toHaveLength(0);
    player.destroy();
    URL.revokeObjectURL(url);
  });

  it('يسقط إلى TTS حين لا تسجيل', async () => {
    const sources = [];
    const player = createPlaybackController({
      segments: [{ id: 'a', text: 'Привет', humanAudioUrl: null }],
      settings: { repeatCount: 1, intervalUnit: 'ms', intervalSteps: 1,
                  autoAdvance: false, audioSource: 'human' },
      speaker: silentSpeaker,
      onEvent: (e) => { if (e.type === 'source') sources.push(e.source); },
    });

    player.start();
    await waitFor(() => sources.length > 0);
    expect(sources[0]).toBe('tts');
    player.destroy();
  });

  it('وضع tts يتجاهل التسجيل البشري', async () => {
    const sources = [];
    const url = URL.createObjectURL(new Blob([new Uint8Array(44)], { type: 'audio/wav' }));
    const player = createPlaybackController({
      segments: [{ id: 'a', text: 'Привет', humanAudioUrl: url }],
      settings: { repeatCount: 1, intervalUnit: 'ms', intervalSteps: 1,
                  autoAdvance: false, audioSource: 'tts' },
      speaker: silentSpeaker,
      onEvent: (e) => { if (e.type === 'source') sources.push(e.source); },
    });

    player.start();
    await waitFor(() => sources.length > 0);
    expect(sources[0]).toBe('tts');
    player.destroy();
    URL.revokeObjectURL(url);
  });
});

/* ------------------------------------------------------------------ *
 * الخطوط — بند 17
 * ------------------------------------------------------------------ */

describe('الخطوط — التسمية بصيغة الكتابة', () => {
  it('كل خطّ ينتمي لعائلة معلَنة', () => {
    const forms = new Set(FONT_FORMS.map((f) => f.id));
    for (const font of FONTS) {
      if (!forms.has(font.form)) throw new Error(`${font.id} في عائلة مجهولة: ${font.form}`);
    }
  });

  it('كل خطّ يظهر في مجموعةٍ واحدة بالضبط', () => {
    const grouped = fontsByForm().flatMap((g) => g.fonts.map((f) => f.id));
    expect(grouped.length).toBe(FONTS.length);
    expect(new Set(grouped).size).toBe(FONTS.length);
  });

  it('الاسم الكامل يحمل العائلة فلا يلتبس خارج اللوحة', () => {
    const noto = fontById('noto');
    expect(fontFullLabel(noto).includes('طباعة')).toBe(true);
    // خطّ الجهاز يقول نفسه، فلا يُسبَق بعائلة.
    expect(fontFullLabel(fontById('system'))).toBe('خطّ جهازك');
  });

  it('لا اسم ذوقيّ باقٍ من التسمية القديمة', () => {
    const tasteful = ['راقص', 'حرّ', 'أنيق', 'كلاسيكي', 'مذكّرة', 'كورالي'];
    for (const font of FONTS) {
      if (tasteful.includes(font.label)) throw new Error(`${font.id} ما زال يحمل اسمًا ذوقيًّا`);
    }
  });

  it('الأسماء لا تتكرّر داخل العائلة الواحدة', () => {
    for (const group of fontsByForm()) {
      const labels = group.fonts.map((f) => f.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('الخطوط — تغطية السيريلية', () => {
  it('كل خطّ مُعلَن بسيريليّة يُطلَب فعلًا من Google Fonts', () => {
    for (const font of FONTS) {
      if (!font.family) continue;
      const asked = font.family.replace(/ /g, '+');
      if (!FONTS_HREF.includes(`family=${asked}`)) {
        throw new Error(`${font.id} مُعرَّف ولا يُطلَب في الرابط`);
      }
    }
  });

  it('الرابط يطلب المجموعة السيريلية صراحةً', () => {
    expect(FONTS_HREF.includes('subset=cyrillic')).toBe(true);
  });

  // ⚠️ الخطّ اللاتينيّ وحده يبدو صالحًا في اللوحة لأن العيّنة تُرسَم
  //    من الاحتياطي — وهو زرٌّ يبدو أنه يعمل وهو لا يعمل. Dancing
  //    Script كان كذلك، فحلّ Bad Script محلّه.
  it('لا خطّ لاتينيٌّ فقط في القائمة', () => {
    for (const font of FONTS) {
      if (font.cyrillic !== true) throw new Error(`${font.id} غير مُعلَن بتغطية سيريلية`);
    }
    expect(FONTS.some((f) => f.id === 'dancing')).toBe(false);
  });

  it('القياس يفرّق بين «لم يصل» و«بلا سيريلية»', () => {
    // خطٌّ باسمٍ لا وجود له: يسقط على الاحتياطي في المسبارين معًا،
    // فالحكم «لم يصل» لا «بلا سيريلية» — لا نتّهم خطًّا حين تُقطع الشبكة.
    const ghost = measureFont({ id: 'ghost', family: 'LingoLifeNoSuchFamily' });
    expect(ghost.status).toBe('not-loaded');
    expect(ghost.cyrillic).toBe(false);
  });

  it('خطّ الجهاز لا يُقاس ولا يُوسَم', () => {
    expect(measureFont(fontById('system')).status).toBe('ok');
  });

  it('لكل حالةٍ نصٌّ صريح عدا السليمة', async () => {
    const { COVERAGE_NOTE } = await import('../js/services/shadow/fonts.js');
    expect(COVERAGE_NOTE.ok).toBe('');
    expect(COVERAGE_NOTE['no-cyrillic'].length > 0).toBe(true);
    expect(COVERAGE_NOTE['not-loaded'].length > 0).toBe(true);
  });

  it('الخطّ المحفوظ باسمٍ اختفى يعود لخطٍّ صالح لا لـundefined', () => {
    // جلسات قديمة تحمل `fontId: 'dancing'` — لا يجوز أن تنكسر.
    const font = fontById('dancing');
    expect(!!font && !!font.stack).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * وصف المصدر — بند 13
 * ------------------------------------------------------------------ */

describe('وصف المصدر', () => {
  const seg = (speaker) => ({ speaker: speaker || null });

  it('السكريبت يُسمّى بعنوانه', () => {
    const d = describeSource(
      { sourceType: SOURCE_TYPE.SCRIPT, sceneId: 's1' },
      [seg(), seg()],
      { title: 'مكالمة القسم' }
    );
    expect(d.kind).toBe('سكريبت');
    expect(d.name).toBe('مكالمة القسم');
    expect(d.note).toBe('2 جملة');
    expect(d.href).toBe('/scene/s1');
  });

  it('محادثةٌ لدور واحد تحمل اسم المتحدّث', () => {
    const d = describeSource(
      { sourceType: SOURCE_TYPE.CONVERSATION },
      [seg('Ирина'), seg('Ирина')]
    );
    expect(d.name).toBe('Ирина');
    // «جزء» لا «جملة»: المحادثة أدوارٌ لا جمل.
    expect(d.note).toBe('2 جزء');
  });

  it('محادثةٌ بأكثر من متحدّث تقول عددهم', () => {
    const d = describeSource(
      { sourceType: SOURCE_TYPE.CONVERSATION },
      [seg('Ирина'), seg('Олег'), seg('Ирина')]
    );
    expect(d.name).toBe('2 متحدّثين');
  });

  it('المختارات تقول إنك أنت مَن اخترتها', () => {
    const d = describeSource(
      { sourceType: SOURCE_TYPE.SELECTION },
      [seg(), seg(), seg()],
      { title: 'النصّ الأساسي' }
    );
    expect(d.kind).toBe('جمل مختارة');
    expect(d.note).toBe('3 جملة اخترتها');
  });

  it('نصّ الصورة لا يُخفي أنه استُخرج آليًّا', () => {
    const d = describeSource({ sourceType: SOURCE_TYPE.MEDIA_TEXT }, [seg()]);
    expect(d.note.includes('مراجَعة يدويًّا')).toBe(true);
  });

  it('مصدرٌ حُذف يُقال صراحةً ولا يُسقط الوصف', () => {
    const d = describeSource(
      { sourceType: SOURCE_TYPE.SCRIPT },
      [seg()],
      { missing: true }
    );
    expect(d.name).toBe('سكريبت بلا عنوان');
    expect(d.note.includes('المصدر مش موجود دلوقتي')).toBe(true);
  });

  it('نوعٌ مجهول لا يكسر الوصف', () => {
    const d = describeSource({ sourceType: 'somethingNew' }, [seg()]);
    expect(d.kind).toBe('مصدر');
    expect(d.note).toBe('1 مقطع');
  });

  it('جلسةٌ بلا ذكرى لا تدّعي رابطًا', () => {
    expect(describeSource({ sourceType: SOURCE_TYPE.SCRIPT }, []).href).toBe(null);
  });

  it('كل نوع مصدر معلَن له وصف', () => {
    for (const type of Object.values(SOURCE_TYPE)) {
      const d = describeSource({ sourceType: type }, []);
      if (d.kind === 'مصدر') throw new Error(`${type} بلا وصف في SOURCE_LABEL`);
    }
  });
});

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
} from '../js/services/shadow/playback-controller.js';
import { stepRate, RATE_STEPS } from '../js/services/shadow/tts-controller.js';
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
  SOURCE_TYPE,
  SEGMENT_STATUS,
} from '../js/services/shadow/shadow-session-service.js';
import { practiceEvidence, shadowSessions, shadowSegments } from '../js/db/repositories.js';
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

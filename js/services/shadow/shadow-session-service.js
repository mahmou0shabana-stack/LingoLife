/**
 * LingoLife — جلسات الظلّ
 *
 * الفكرة الحاكمة: **الظلّ ليس صفحة، بل طبقة ممارسة فوق أي محتوى.**
 * فالجلسة لا تملك نصًّا خاصًّا بها — تعرف من أين جاء نصّها وتظلّ
 * موصولة به.
 *
 * لكنها تحمل **لقطة** من ذلك النصّ لا مرجعًا حيًّا. لو عدّلت السكريبت
 * بعد أسبوع من التدريب، لا يتبدّل ما تتدرّب عليه تحت يدك: نخبرك أن
 * المصدر تغيّر ونتركك تقرّر (بند 17 من المواصفة).
 *
 * راجع docs/08-shadowing.md
 */

import { shadowSessions, shadowSegments, practiceEvidence } from '../../db/repositories.js';
import { settings as settingsRepo } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { contentHash, splitSentences } from './segmenter.js';
import { DEFAULT_RATE } from './tts-controller.js';
import { PRACTICE_MODE, REPEAT_MODE } from './playback-controller.js';

/** أنواع المصادر التي يمكن أن تصبح مادّة ظلّ. */
export const SOURCE_TYPE = Object.freeze({
  SCRIPT: 'script',
  CONTENT_BLOCK: 'contentBlock',
  CONVERSATION: 'conversation',
  SCENE: 'scene',
  SELECTION: 'selection',
  EXPRESSION: 'expression',
  MEDIA_TEXT: 'mediaText',
  /** جملٌ اخترتَها من مسودّة مذاكرة (WS25). */
  STUDY_DRAFT: 'studyDraft',
});

/** حالة الجلسة. */
export const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
});

/** حالة المقطع. */
export const SEGMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PRACTICED: 'practiced',
  DIFFICULT: 'difficult',
});

/** مفتاح الإعدادات العامّة. */
const DEFAULTS_KEY = 'shadow.defaults';

/** الإعدادات الافتراضية للجلسات الجديدة. */
export const FACTORY_DEFAULTS = Object.freeze({
  voiceId: null,
  speed: DEFAULT_RATE,
  repeatCount: 5,
  repeatMode: REPEAT_MODE.COUNT,
  intervalUnit: 's',
  intervalSteps: 2,
  practiceMode: PRACTICE_MODE.SENTENCE,
  displayMode: 'ru',
  autoAdvance: true,
});

/** يقرأ الإعدادات العامّة التي ترثها الجلسات الجديدة. */
export async function globalDefaults() {
  const stored = await settingsRepo.get(DEFAULTS_KEY, {});
  return { ...FACTORY_DEFAULTS, ...stored };
}

/** يحفظ الإعدادات العامّة. لا يمسّ الجلسات القائمة. */
export async function saveGlobalDefaults(changes) {
  const merged = { ...(await globalDefaults()), ...changes };
  await settingsRepo.set(DEFAULTS_KEY, merged);
  return merged;
}

/**
 * ينشئ جلسة ظلّ من نصّ ومصدره.
 *
 * @param {{
 *   title: string,
 *   sourceType: string,
 *   sourceId: string|null,
 *   sourceVersion: number|null,
 *   sceneId: string|null,
 *   text?: string,
 *   segments?: {text: string, translation?: string, sourceObjectId?: string}[],
 *   settings?: object
 * }} input
 */
export async function createSession(input) {
  const defaults = await globalDefaults();

  // إمّا مقاطع جاهزة (اختيار المستخدم) أو نصّ نقسّمه.
  const rawSegments =
    input.segments?.length
      ? input.segments
      : splitSentences(input.text || '').map((text) => ({ text }));

  if (!rawSegments.length) {
    throw new Error('مفيش جمل صالحة للتدريب في المصدر ده.');
  }

  const sourceText = rawSegments.map((s) => s.text).join('\n');

  const session = await shadowSessions.create({
    title: input.title || 'جلسة ظلّ',
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    sourceVersion: input.sourceVersion ?? null,
    // البصمة تُحسب من النصّ المُقسَّم لا من المصدر الخام: تغيير
    // مسافة أو سطر فارغ لا يستحقّ إنذار «المصدر تغيّر».
    sourceHash: contentHash(sourceText),
    sceneId: input.sceneId ?? null,
    lastPracticedAt: null,
    currentSegmentIndex: 0,
    status: SESSION_STATUS.ACTIVE,
    totalRepetitions: 0,
    ...defaults,
    ...(input.settings || {}),
  });

  const segments = await shadowSegments.createMany(
    rawSegments.map((segment, order) => ({
      sessionId: session.id,
      sourceObjectId: segment.sourceObjectId ?? input.sourceId ?? null,
      // لقطة لا مرجع — راجع الشرح أعلى الملف.
      sourceTextSnapshot: segment.text,
      translationSnapshot: segment.translation ?? null,
      // مَن قال هذا المقطع — يفعّل «تدرّب على دورك» في المحادثات.
      speaker: segment.speaker ?? null,
      isMine: segment.isMine ? 1 : 0,
      order,
      difficulty: 0,
      repetitionsCompleted: 0,
      lastPracticedAt: null,
      practiceStatus: SEGMENT_STATUS.PENDING,
      notes: '',
    }))
  );

  return { session, segments };
}

/** يقرأ جلسة بمقاطعها مرتّبة. */
export async function loadSession(sessionId) {
  const session = await shadowSessions.get(sessionId);
  if (!session) return null;

  const segments = (await shadowSegments.byIndex('sessionId', sessionId)).sort(
    (a, b) => a.order - b.order
  );

  return { session, segments };
}

/**
 * يفحص إن كان المصدر تغيّر منذ إنشاء الجلسة.
 *
 * ⚠️ لا يُصلح شيئًا ولا يستبدل شيئًا — يُبلغ فقط. القرار للمستخدم:
 *    يكمل على القديم، أو يحدّث، أو ينشئ جلسة جديدة (بند 17).
 *
 * @param {object} session
 * @param {{ text: string, version?: number }} currentSource
 */
export function detectSourceChange(session, currentSource) {
  if (!currentSource || typeof currentSource.text !== 'string') {
    return { changed: false, reason: 'source-unavailable' };
  }

  const currentSegments = splitSentences(currentSource.text);
  const currentHash = contentHash(currentSegments.join('\n'));
  const changed = currentHash !== session.sourceHash;

  return {
    changed,
    sessionVersion: session.sourceVersion,
    currentVersion: currentSource.version ?? null,
    sessionHash: session.sourceHash,
    currentHash,
    currentSegmentCount: currentSegments.length,
  };
}

/** يحفظ موضع الجلسة — يُنادى عند كل انتقال. */
export async function savePosition(sessionId, index) {
  return shadowSessions.update(sessionId, {
    currentSegmentIndex: index,
    lastPracticedAt: Date.now(),
  });
}

/** يحفظ إعدادات جلسة بعينها (تتجاوز العامّة). */
export async function saveSessionSettings(sessionId, changes) {
  return shadowSessions.update(sessionId, changes);
}

/**
 * يسجّل تكرارات مقطع بعد اكتماله.
 *
 * ⚠️ يرفع `repetitionsCompleted` ويضع الحالة `practiced` — **ولا
 *    يلمس إتقان أي تعبير**. التكرار دليل ممارسة لا دليل إتقان
 *    (بند 19). رفع الإتقان يحتاج استخدامًا حقيقيًا في حياتك.
 */
export async function recordSegmentPractice(session, segment, repetitions, options = {}) {
  const patch = {
    repetitionsCompleted: (segment.repetitionsCompleted || 0) + repetitions,
    lastPracticedAt: Date.now(),
    practiceStatus: options.difficult ? SEGMENT_STATUS.DIFFICULT : SEGMENT_STATUS.PRACTICED,
    difficulty: options.difficult ? (segment.difficulty || 0) + 1 : segment.difficulty || 0,
  };
  /*
   * ⚠️ **مقطعٌ مؤقّتٌ لا صفَّ له في القاعدة (WS40 — نصٌّ خارجيّ).**
   *    لا يوجد سطرٌ نُحدِّثه؛ فنكتفي بدمج التغيير في الذاكرة، وتبقى
   *    شهادةُ الممارسة أدناه — فالتدريبُ حقيقيٌّ ولو كان مصدره عابرًا.
   */
  const updated = segment.temporary ? { ...segment, ...patch } : await shadowSegments.update(segment.id, patch);

  await practiceEvidence.create({
    sessionId: session.id,
    targetType: 'shadowSegment',
    targetId: segment.id,
    sceneId: session.sceneId,
    practiceType: 'shadowing',
    repetitions,
    speed: options.speed ?? session.speed,
    practiceMode: options.practiceMode ?? session.practiceMode,
    text: segment.sourceTextSnapshot,
    sourceLabel: session.title,
    practicedAt: Date.now(),
    // صريح حتى لا يُساء تفسيره لاحقًا عند بناء شاشات الإتقان.
    meaning: 'practiced',
    impliesRealUsage: false,
    impliesMastery: false,
  });

  await shadowSessions.update(session.id, {
    totalRepetitions: (session.totalRepetitions || 0) + repetitions,
    lastPracticedAt: Date.now(),
  });

  return updated;
}

/** يعلّم مقطعًا صعبًا يدويًا. */
export async function markDifficult(segmentId, difficult = true) {
  const segment = await shadowSegments.get(segmentId);
  if (!segment) return null;
  return shadowSegments.update(segmentId, {
    practiceStatus: difficult ? SEGMENT_STATUS.DIFFICULT : SEGMENT_STATUS.PRACTICED,
    difficulty: difficult ? (segment.difficulty || 0) + 1 : 0,
  });
}

/** ينهي الجلسة ويعيد ملخّصًا بأرقام حقيقية لا إنجازات مُلفّقة. */
export async function completeSession(sessionId) {
  const loaded = await loadSession(sessionId);
  if (!loaded) return null;

  const { session, segments } = loaded;
  const practiced = segments.filter((s) => s.repetitionsCompleted > 0);
  const difficult = segments.filter((s) => s.practiceStatus === SEGMENT_STATUS.DIFFICULT);

  await shadowSessions.update(sessionId, {
    status: SESSION_STATUS.COMPLETED,
    lastPracticedAt: Date.now(),
  });

  return {
    sessionId,
    title: session.title,
    segmentsTotal: segments.length,
    segmentsPracticed: practiced.length,
    totalRepetitions: segments.reduce((sum, s) => sum + (s.repetitionsCompleted || 0), 0),
    difficultSegments: difficult,
    speed: session.speed,
    startedAt: session.createdAt,
    lastPracticedAt: Date.now(),
    durationMs: Date.now() - session.createdAt,
  };
}

/**
 * الجلسات القابلة للاستئناف — لشاشة «دلوقتي».
 * الأحدث ممارسةً أولًا، والتي لم تُفتح بعد تأتي بتاريخ إنشائها.
 */
export async function resumableSessions(limit = 5) {
  const all = await shadowSessions.getAll();
  return all
    .filter((s) => s.state === STATE.ACTIVE && s.status === SESSION_STATUS.ACTIVE)
    .sort((a, b) => (b.lastPracticedAt || b.createdAt) - (a.lastPracticedAt || a.createdAt))
    .slice(0, limit);
}

/**
 * سلسلة الأيام المتتالية التي تدرّبت فيها.
 *
 * ⚠️ محسوبة من `practiceEvidence` الحقيقي لا من عدّاد يُزاد يدويًا.
 *    رقم لا يمكن إثباته بالنقر ليس رقمًا (بند 59).
 */
export async function practiceStreak() {
  const rows = await practiceEvidence.getAll();
  if (!rows.length) return 0;

  const days = new Set(
    rows.map((row) => new Date(row.practicedAt).toISOString().slice(0, 10))
  );

  const dayMs = 86400000;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - dayMs).toISOString().slice(0, 10);

  // السلسلة حيّة إن تدرّبت اليوم أو أمس — وإلا فقد انقطعت.
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  let time = new Date(cursor).getTime();
  while (days.has(new Date(time).toISOString().slice(0, 10))) {
    streak++;
    time -= dayMs;
  }
  return streak;
}

/**
 * سجلّ الجمل التي تدرّبت عليها مؤخّرًا — بديل «آخر 20 جملة» القديم.
 *
 * الفارق أن هذا السجلّ مبنيّ على دليل ممارسة حقيقي مربوط بمشهده
 * وجلسته، لا مجرّد نصوص في localStorage.
 */
export async function recentPractice(limit = 20) {
  const rows = await practiceEvidence.getAll();
  const seen = new Map();

  for (const row of rows.sort((a, b) => b.practicedAt - a.practicedAt)) {
    if (!row.text) continue;
    const existing = seen.get(row.text);
    if (existing) {
      existing.repetitions += row.repetitions || 0;
      continue;
    }
    seen.set(row.text, {
      text: row.text,
      repetitions: row.repetitions || 0,
      practicedAt: row.practicedAt,
      sessionId: row.sessionId,
      sceneId: row.sceneId,
      sourceLabel: row.sourceLabel,
    });
    if (seen.size >= limit) break;
  }

  return [...seen.values()];
}

/** جلسات مرتبطة بمصدر بعينه — لعرض «تدرّبت على ده قبل كده». */
export async function sessionsForSource(sourceType, sourceId) {
  const rows = await shadowSessions.byIndex('source', [sourceType, sourceId]);
  return rows.filter((s) => s.state === STATE.ACTIVE);
}

/* ------------------------------------------------------------------ *
 * وصف المصدر — بند 13
 *
 * كانت الصفحة اليسرى تقول «المشهد والنصّ الأصلي»: جملةٌ صادقة ولا
 * تفيد. لا تعرف أهذا سكريبتٌ كامل أم دور متحدّثٍ في محادثة أم جملٌ
 * اخترتها بنفسك أم نصٌّ استُخرج من صورة — وهي فروقٌ تغيّر ما تتوقّعه
 * من الجلسة، وتغيّر إلى أين تعود إن أردت الأصل.
 *
 * الوصف هنا **خالٍ من القاعدة** عمدًا: الشاشة تجلب العنوان وتمرّره،
 * فيبقى المنطق مُختبَرًا بلا تهيئة مستودعات.
 * ------------------------------------------------------------------ */

/** ما يُعرَض لكل نوع مصدر. `unit` وحدة العدّ لأن «جزء» ليست «جملة». */
export const SOURCE_LABEL = Object.freeze({
  [SOURCE_TYPE.SCRIPT]: { icon: '📝', kind: 'سكريبت', unit: 'جملة', fallback: 'سكريبت بلا عنوان' },
  [SOURCE_TYPE.CONVERSATION]: { icon: '💬', kind: 'محادثة', unit: 'جزء', fallback: 'المحادثة كلها' },
  [SOURCE_TYPE.SELECTION]: { icon: '✂️', kind: 'جمل مختارة', unit: 'جملة اخترتها', fallback: 'من سكريبت' },
  // ⚠️ لا نُخفي أن المصدر آليّ: OCR على خطّ يدٍ روسي يخطئ كثيرًا.
  [SOURCE_TYPE.MEDIA_TEXT]: { icon: '🖼️', kind: 'نصّ من صورة', unit: 'جملة', fallback: 'نصّ مستخرَج', caution: 'مراجَعة يدويًّا' },
  [SOURCE_TYPE.CONTENT_BLOCK]: { icon: '🧩', kind: 'مقطع محتوى', unit: 'جملة', fallback: 'مقطع' },
  [SOURCE_TYPE.SCENE]: { icon: '🎬', kind: 'ذكرى', unit: 'مقطع', fallback: 'ذكرى' },
  [SOURCE_TYPE.EXPRESSION]: { icon: '💡', kind: 'تعبير', unit: 'مقطع', fallback: 'تعبير' },
  /*
   * ⚠️ **ولا نُخفي أن المادّة كتابتُك أنت.** المسودّة نصٌّ لصقتَه من
   *    تحليلٍ خارجيّ أو استخرجتَه من صورة — أي أنه لم يمرّ على مصدرٍ
   *    موثوقٍ في التطبيق. فالتحذيرُ مكتوب، كما في نصّ الصورة.
   */
  [SOURCE_TYPE.STUDY_DRAFT]: {
    icon: '✎', kind: 'مسودّة مذاكرة', unit: 'جملة',
    fallback: 'مسودّة', caution: 'نصٌّ لصقتَه بنفسك',
  },
});

const UNKNOWN_SOURCE = { icon: '📄', kind: 'مصدر', unit: 'مقطع', fallback: '—' };

/**
 * @param {object} session
 * @param {{speaker?: string|null}[]} segments
 * @param {{title?: string|null, missing?: boolean}} [resolved]
 *        عنوان المصدر كما قرأته الشاشة، و`missing` حين تعذّرت قراءته.
 * @returns {{icon: string, kind: string, name: string, note: string, href: string|null}}
 */
export function describeSource(session, segments = [], resolved = {}) {
  const spec = SOURCE_LABEL[session?.sourceType] || UNKNOWN_SOURCE;
  const count = segments.length;

  // المتحدّث يُقرأ من المقاطع نفسها: جلسةُ دورٍ واحد تحمل اسمه في
  // كلّ مقطع، وجلسةُ المحادثة كلها تحمل أكثر من اسم.
  let name = resolved.title || spec.fallback;
  if (session?.sourceType === SOURCE_TYPE.CONVERSATION) {
    const speakers = [...new Set(segments.map((s) => s?.speaker).filter(Boolean))];
    if (speakers.length === 1) name = speakers[0];
    else if (speakers.length > 1) name = `${speakers.length} متحدّثين`;
    else name = spec.fallback;
  }

  const parts = [`${count} ${spec.unit}`];
  if (spec.caution) parts.push(spec.caution);
  // مصدرٌ حُذف: الجلسة تبقى صالحة — لقطتها محفوظة في المقاطع — فنقول
  // ذلك بدل أن نصمت أو نسقط الشاشة.
  if (resolved.missing) parts.push('المصدر مش موجود دلوقتي');

  return {
    icon: spec.icon,
    kind: spec.kind,
    name,
    note: parts.join(' · '),
    href: session?.sceneId ? `/scene/${session.sceneId}` : null,
  };
}

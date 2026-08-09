/**
 * LingoLife — قراءة حزمة المشهد والتحقّق منها
 *
 * **الطبقة النحويّة وحدها**: شكل الحزمة وحقولها. لا تلمس القاعدة ولا
 * تعرف ماذا عندك — ذلك عمل `plan.js`.
 *
 * وفصلهما مقصود: التحقّق من الشكل يجب أن يعمل على حزمةٍ في أي جهاز
 * وفي أي وقت، بلا قاعدةٍ مفتوحة. فيمكن اختباره حتميًّا، ويمكن أن يخبرك
 * أن الملفّ تالف قبل أن نلمس بياناتك بشيء.
 *
 * ═══════════════════════════════════════════════════════════════
 * **الرفض بسببه لا بصمت.**
 *
 * حزمةٌ فيها اثنتا عشرة جملة محادثة وواحدةٌ منها بلا نصّ: لا نستورد
 * إحدى عشرة ونسكت عن الثانية عشرة. نقول «الجزء رقم 7 بلا نصّ» —
 * فتُصلحه أنت أو تقبل استبعاده وأنت تعرف.
 * ═══════════════════════════════════════════════════════════════
 */

import {
  PACKAGE_FORMAT_VERSION,
  SUPPORTED,
  NOT_SUPPORTED,
  REQUIRED,
  field,
  collection,
} from './package-format.js';
import { toISODate } from '../../utils/dates.js';

/** خطأٌ يمنع الاستيراد كلّه. */
const fatal = (message, where = null) => ({ level: 'fatal', message, where });

/** تحذيرٌ يستبعد عنصرًا ويُبقي الباقي. */
const warn = (message, where = null) => ({ level: 'warn', message, where });

/** نصٌّ نظيف أو فراغ — لا `undefined` تتسرّب إلى القاعدة. */
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * يقرأ حزمةً من نصّ JSON أو كائنٍ مقروء.
 *
 * @param {string|object} input
 * @returns {{ok: boolean, pkg: object|null, issues: object[]}}
 */
export function parsePackage(input) {
  const issues = [];

  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      // ⚠️ رسالة المحلّل نفسها تُعرَض: «سطر 42» أنفع من «ملف تالف».
      return { ok: false, pkg: null, issues: [fatal(`مش JSON صالح — ${error.message}`)] };
    }
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, pkg: null, issues: [fatal('الحزمة لازم تكون كائن JSON')] };
  }

  // بعض المُنتِجات تلفّ كل شيء في `package` أو `data`.
  const body = raw.package || raw.data || raw;

  /*
   * الإصدار: نقبل غيابه (مُنتِجٌ لا يعرفنا) ونقبل الأقدم، ونرفض الأحدث.
   * ⚠️ صيغةٌ من المستقبل قد تحمل معانيَ لا نعرفها، وقراءتها بقواعد
   *    اليوم تعني تفسيرًا خاطئًا صامتًا — وهو أخطر من الرفض.
   */
  const version = Number(body.formatVersion ?? body.version ?? PACKAGE_FORMAT_VERSION);
  if (Number.isFinite(version) && version > PACKAGE_FORMAT_VERSION) {
    return {
      ok: false,
      pkg: null,
      issues: [fatal(`الحزمة دي بصيغة ${version} وإحنا بنفهم ${PACKAGE_FORMAT_VERSION} — حدّث التطبيق`)],
    };
  }

  /* ---- المشهد: بدونه لا شيء ---- */

  const sceneRaw = body.scene || body.memory || null;
  if (!sceneRaw || typeof sceneRaw !== 'object') {
    return { ok: false, pkg: null, issues: [fatal('الحزمة بلا مشهد — مفيش حاجة نستوردها')] };
  }

  const sceneTitle = text(field(sceneRaw, 'title'));
  if (!sceneTitle) {
    return { ok: false, pkg: null, issues: [fatal('المشهد بلا عنوان', 'scene')] };
  }

  const rawDate = field(sceneRaw, 'date');
  const sceneDate = rawDate ? toISODate(rawDate) : '';
  if (rawDate && !sceneDate) {
    // تاريخٌ لا يُفهَم لا يُخمَّن: مشهدٌ بتاريخ اليوم بدل تاريخه الحقيقي
    // يفسد ترتيب حياتك بلا أن تلاحظ.
    issues.push(warn(`تاريخ المشهد «${rawDate}» مش مفهوم — هيتسجّل بتاريخ النهارده`, 'scene.date'));
  }

  const scene = {
    title: sceneTitle,
    titleRu: text(field(sceneRaw, 'titleRu')),
    date: sceneDate,
    placeName: text(field(sceneRaw, 'placeName')),
    context: text(sceneRaw.context || sceneRaw.summary),
    eventType: text(field(sceneRaw, 'eventType')),
  };

  /* ---- المجموعات ---- */

  const people = [];
  collection(body, 'people').forEach((row, index) => {
    const name = text(field(row, 'speaker') || field(row, 'title'));
    if (!name) return void issues.push(warn(`الشخص رقم ${index + 1} بلا اسم — هيتستبعد`, 'people'));
    people.push({
      name,
      nameRu: text(row.nameRu || row.russianName),
      role: text(row.role),
      company: text(row.company),
      isMine: Boolean(row.isMe || row.isMine),
    });
  });

  const scripts = [];
  collection(body, 'scripts').forEach((row, index) => {
    const body_ = text(field(row, 'text'));
    if (!body_) return void issues.push(warn(`السكريبت رقم ${index + 1} بلا نصّ — هيتستبعد`, 'scripts'));
    scripts.push({
      title: text(field(row, 'title')) || `سكريبت ${index + 1}`,
      text: body_,
      translation: text(field(row, 'translation')),
    });
  });

  const conversationParts = [];
  collection(body, 'conversationParts').forEach((row, index) => {
    const said = text(field(row, 'text'));
    if (!said) {
      return void issues.push(warn(`جزء المحادثة رقم ${index + 1} بلا نصّ — هيتستبعد`, 'conversationParts'));
    }
    conversationParts.push({
      speaker: text(field(row, 'speaker')),
      text: said,
      translation: text(field(row, 'translation')),
      isMine: Boolean(row.isMe || row.isMine),
    });
  });

  const mistakes = [];
  collection(body, 'mistakes').forEach((row, index) => {
    const wrong = text(field(row, 'wrong'));
    const natural = text(field(row, 'natural'));
    if (!wrong || !natural) {
      // ⚠️ التصحيح بنصفٍ واحد ليس تصحيحًا: «قلت كذا» بلا «الصح كذا»
      //    لا يعلّمك شيئًا، والعكس كذلك.
      return void issues.push(
        warn(`التصحيح رقم ${index + 1} ناقص نصفه — هيتستبعد`, 'mistakes')
      );
    }
    mistakes.push({
      wrong,
      natural,
      mistakeType: text(row.mistakeType || row.kind) || 'other',
      explanation: text(field(row, 'note')),
    });
  });

  const expressions = [];
  collection(body, 'expressions').forEach((row, index) => {
    const value = text(field(row, 'text'));
    if (!value) return void issues.push(warn(`التعبير رقم ${index + 1} بلا نصّ — هيتستبعد`, 'expressions'));
    expressions.push({
      text: value,
      meaningAr: text(field(row, 'meaningAr')),
      register: text(row.register) || 'professional',
      note: text(field(row, 'note')),
    });
  });

  const threadRaw = body.eventThread || body.thread || null;
  const eventThread = threadRaw
    ? {
        title: text(field(threadRaw, 'title')),
        description: text(threadRaw.description),
        status: text(threadRaw.status),
      }
    : null;
  if (threadRaw && !eventThread.title) {
    issues.push(warn('الخيط بلا عنوان — هيتستبعد', 'eventThread'));
  }

  /* ---- ما لا نستوعبه: يُعلَن ولا يُبتلَع ---- */

  const skipped = [];
  for (const [kind, reason] of Object.entries(NOT_SUPPORTED)) {
    const found = body[kind];
    const count = Array.isArray(found) ? found.length : found ? 1 : 0;
    if (count) skipped.push({ kind, count, reason });
  }

  return {
    ok: true,
    issues,
    pkg: {
      formatVersion: version,
      scene,
      people,
      eventThread: eventThread?.title ? eventThread : null,
      scripts,
      conversationParts,
      mistakes,
      expressions,
      skipped,
      analysisMetadata: body.analysisMetadata || null,
    },
  };
}

/** أعداد ما في الحزمة — تُعرَض في المعاينة قبل أي كتابة (بند 36). */
export function packageCounts(pkg) {
  if (!pkg) return {};
  return {
    scene: pkg.scene ? 1 : 0,
    people: pkg.people.length,
    eventThread: pkg.eventThread ? 1 : 0,
    scripts: pkg.scripts.length,
    conversationParts: pkg.conversationParts.length,
    mistakes: pkg.mistakes.length,
    expressions: pkg.expressions.length,
  };
}

/** هل في الحزمة ما يستحقّ الاستيراد أصلًا؟ */
export function isEmpty(pkg) {
  const counts = packageCounts(pkg);
  return Object.entries(counts)
    .filter(([kind]) => kind !== 'scene')
    .every(([, n]) => n === 0);
}

export { SUPPORTED, NOT_SUPPORTED };

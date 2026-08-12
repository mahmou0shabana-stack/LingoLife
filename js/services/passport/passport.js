/**
 * LingoLife — الجواز (WS15 · الملحق F1–F2)
 *
 * سؤالٌ واحد: **كل ما يعرفه التطبيق عن هذه الذكرى — أو هذا التعبير —
 * في ورقةٍ واحدة تقرؤها أنت أو تعطيها لمحلِّل.**
 *
 * ═══════════════════════════════════════════════════════════════
 * وما الفرق بينه وبين `getSceneFull`؟
 * ═══════════════════════════════════════════════════════════════
 *
 * `getSceneFull` **قراءةُ قاعدة** تخدم شاشة: صفوفٌ كما هي، بلا ترتيب
 * ولا معنى. والجواز **وثيقة**: أقسامٌ مسمّاة، ولكلٍّ عددٌ ودليل.
 *
 * والفرق الحاسم أنّ الجواز **يقول ما ينقص**:
 *
 * ```
 * ٤ أجزاء محادثة  ·  ٣ تعبيرات  ·  ولا نصَّ أصليًّا — ما اتكتبش
 * ```
 *
 * وقائمةٌ فارغة بلا كلمة تجعل القارئ يظنّ أن التطبيق نسي. أمّا «ما
 * اتكتبش» فمعلومة — وهي **أوّل ما ستفعله بعد قراءة الجواز**.
 *
 * ⚠️ **ولا يستنتج شيئًا.** الملحق في **F6** يطلب ألّا تُلفَّق رؤًى بل
 *    تُهيَّأ بنيةُ الدليل. فما هنا وقائعُ وشواهد — ولا جملةَ تقول
 *    «يبدو أنك تحسّنت» ولا رقمَ بلا سجلٍّ تحته.
 */

import { getSceneFull } from '../scene-service.js';
import {
  listConversationParts, listSceneExpressions, readBlock, MISTAKE_TYPES,
} from '../content-service.js';
import { transcriptOf } from '../transcript-service.js';
import { scenePeople } from '../participant-service.js';
import { threadsOfScene } from '../thread-service.js';
import { typeLabel } from '../type-service.js';
import { expressionLife, STAGE_LABEL } from '../language-service.js';
import { briefSimilar } from '../similarity/similar.js';
import { toISODate, formatDate } from '../../utils/dates.js';

/** إصدار صيغة الجواز — يتغيّر إن تغيّر شكلُ الوثيقة. */
export const PASSPORT_VERSION = 1;

/* ------------------------------------------------------------------ *
 * ما لا يحمله الجواز — وسببه
 * ------------------------------------------------------------------ */

/**
 * ⚠️ ليست نقصًا بل حدودَ الوثيقة. والملحق في **F6** يطلب هذا نصًّا:
 *    بنيةُ الدليل تُهيَّأ، والرأيُ لا يُلفَّق.
 */
export const NOT_IN_PASSPORT = Object.freeze([
  {
    id: 'verdict',
    label: 'حكمٌ على مستواك',
    why: 'الجواز يعرض ما وقع لا ما يعنيه. و«لغتك في المواقف دي كويسة» جملةٌ لا سجلَّ تحتها — وهي أوّل كذبةٍ في ملفٍّ كلُّه شواهد.',
  },
  {
    id: 'progress',
    label: 'تقدُّمٌ بين ذكرى وأخرى',
    why: 'نفس موقف `NOT_MEASURED`: المقارنة تقيس كتابتك في التطبيق لا لغتك.',
  },
  {
    id: 'media-bytes',
    label: 'الصور والأصوات نفسها',
    why: 'الجواز نصٌّ يُقرأ ويُلصَق. الوسائط تخرج في حزمة `.llife` وحدها — وذكرُها هنا بالعدد لا بالبايتات.',
  },
  {
    id: 'private-notes',
    label: 'ملاحظاتك الخاصّة — إلا بطلبك',
    why: '«ملاحظاتي» ما كتبتَه لنفسك، وقد يكون فيه ما لا تريد أن يخرج. فتُدرَج باختيارك لا بالافتراض.',
  },
]);

/* ------------------------------------------------------------------ *
 * أقسام جواز الذكرى
 * ------------------------------------------------------------------ */

/**
 * كل قسمٍ يقول: **ماذا يحمل**، و**بأي عدد**، و**ماذا يعني فراغُه**.
 *
 * إضافة قسمٍ غدًا مدخلٌ هنا — نفس عقد `ASPECTS` و`SCOPES` و`PROMPTS`.
 */
const SCENE_SECTIONS = [
  {
    id: 'conversation',
    label: 'المحادثة',
    unit: 'جزء',
    whyEmpty: 'مفيش محادثة متسجّلة — يعني ما اتكتبش اللي اتقال، مش إن محدّش اتكلّم',
    read: (ctx) => ctx.parts.map((row) => ({
      speaker: row.speaker || '',
      isMe: Boolean(row.isMine),
      ru: row.text || '',
      ar: row.translation || '',
    })),
  },
  {
    id: 'transcript',
    label: 'النصّ الأصلي',
    unit: 'نصّ',
    whyEmpty: 'ما اتكتبش. وهو اللي اتقال فعلًا بأخطائه — وعليه يقوم نصّ التطبيق',
    read: (ctx) => (ctx.transcript?.rawText
      ? [{ raw: ctx.transcript.rawText, clean: ctx.transcript.cleanText || '' }]
      : []),
  },
  {
    id: 'scripts',
    label: 'السكريبتات',
    unit: 'سكريبت',
    whyEmpty: 'مفيش سكريبت — النصوص اللي بتتمرّن عليها',
    read: (ctx) => ctx.full.scripts.map((row) => ({
      title: row.title || '', ru: row.text || '', ar: row.translation || '',
    })),
  },
  {
    id: 'mistakes',
    label: 'خطأ / طبيعي',
    unit: 'تصحيح',
    whyEmpty: 'مفيش تصحيحات — يعني ما راجعتش اللي قلته، مش إنك ما غلطتش',
    read: (ctx) => ctx.full.mistakes.map((row) => ({
      wrong: row.wrong || '',
      natural: row.natural || '',
      kind: mistakeLabel(row.mistakeType),
      note: row.explanation || '',
    })),
  },
  {
    id: 'expressions',
    label: 'التعبيرات',
    unit: 'تعبير',
    whyEmpty: 'مفيش تعبيرات متلقّطة من الذكرى دي',
    read: (ctx) => ctx.expressions.map((row) => ({
      ru: row.text, ar: row.meaningAr || '', register: row.register || '',
    })),
  },
  {
    id: 'people',
    label: 'مين كان هنا',
    unit: 'شخص',
    /* ⚠️ الدليل معه: «حضر» و«اتكلّم» واقعتان مختلفتان (WS9). */
    whyEmpty: 'محدّش معلَن ولا منسوب له كلام',
    read: (ctx) => ctx.people.map((row) => ({
      name: row.name,
      evidence: [row.declared && 'حضر', row.spoke && `اتكلّم ${row.saidCount}`]
        .filter(Boolean).join(' · '),
    })),
  },
  {
    id: 'threads',
    label: 'القصص اللي بتنتمي لها',
    unit: 'قصّة',
    whyEmpty: 'مش في أي قصّة لسّه',
    read: (ctx) => ctx.threads.map((row) => ({ title: row.title, status: row.status || '' })),
  },
  {
    id: 'similar',
    label: 'شبيه بيها',
    unit: 'ذكرى',
    whyEmpty: 'مفيش ذكرى قريبة كفاية',
    /* ⚠️ ترشيحاتٌ لكلٍّ سببها — لا حكمَ بلا دليل (WS14). */
    read: (ctx) => ctx.similar.items.map((row) => ({
      title: row.label, hint: row.hint, why: row.reasons.join(' · '),
    })),
  },
];

/* ------------------------------------------------------------------ *
 * أقسام جواز التعبير
 * ------------------------------------------------------------------ */

const EXPRESSION_SECTIONS = [
  {
    id: 'meaning',
    label: 'المعنى',
    unit: 'سطر',
    whyEmpty: 'المعنى ما اتكتبش',
    read: (ctx) => (ctx.life.expression.meaningAr
      ? [{ ar: ctx.life.expression.meaningAr, note: ctx.life.expression.explanation || '' }]
      : []),
  },
  {
    id: 'occurrences',
    label: 'فين ظهر',
    unit: 'ظهور',
    /* ⚠️ لكلٍّ ذكراه وتاريخُه واقتباسُه — وهي كلُّ «حياة التعبير». */
    whyEmpty: 'ظهر مرّة واحدة بس، في الذكرى اللي اتلقط منها',
    read: (ctx) => ctx.life.occurrences.map((row) => ({
      scene: row.title, date: row.date, kind: row.kind, quote: row.quote || '',
    })),
  },
  {
    id: 'captures',
    label: 'ليه لقطته',
    unit: 'تصنيف',
    /* تصنيفاتُ التقاطك — سببُ التقاطك جزءٌ من قصّته. */
    whyEmpty: 'ما اتلقطش في المحفوظات بتصنيف',
    read: (ctx) => (ctx.life.captureTags || []).filter(Boolean).map((tag) => ({ tag })),
  },
  {
    id: 'stage',
    label: 'المرحلة',
    unit: 'مرحلة',
    whyEmpty: 'بلا مرحلة',
    /* ⚠️ **لا تُرفَع إلا بضغطةٍ منك** — والوقائع منفصلة عن تقديرك. */
    read: (ctx) => [{
      stage: STAGE_LABEL[ctx.life.stage] || ctx.life.stage || 'جديد',
      note: 'المرحلة تقديرك أنت — التطبيق بيعدّ الظهور ومابيرفعهاش',
    }],
  },
];

/* ------------------------------------------------------------------ *
 * البناء
 * ------------------------------------------------------------------ */

/**
 * ⚠️ `MISTAKE_TYPES` **مصفوفةٌ لا خريطة** — والقراءة بالمفتاح مباشرةً
 *    تعطي `undefined` صامتًا فيظهر معرّفٌ إنجليزيّ في وثيقةٍ عربيّة.
 */
const mistakeLabel = (id) =>
  MISTAKE_TYPES.find((row) => row.id === id)?.label || id || '';

function assemble(sections, ctx) {
  return sections.map((section) => {
    const items = section.read(ctx) || [];
    return {
      id: section.id,
      label: section.label,
      unit: section.unit,
      count: items.length,
      items,
      empty: items.length === 0,
      /* ⚠️ الفراغ **يقول سببه**: «مفيش» معلومةٌ، والصمتُ عطل. */
      why: items.length ? '' : section.whyEmpty,
    };
  });
}

/**
 * جوازُ ذكرى.
 *
 * ⚠️ **يقرأ ولا يكتب** — بناؤه مرّتين بلا أثر، كما `planImport`.
 *
 * @param {string} sceneId
 * @param {{withNotes?: boolean}} options `withNotes` باختيارك لا بالافتراض
 */
export async function scenePassport(sceneId, { withNotes = false } = {}) {
  const full = await getSceneFull(sceneId);
  if (!full) throw new Error('الذكرى مش موجودة');

  const [parts, expressions, transcript, people, threads, similar, notes] =
    await Promise.all([
      listConversationParts(sceneId),
      listSceneExpressions(sceneId),
      transcriptOf(sceneId),
      scenePeople(sceneId),
      threadsOfScene(sceneId),
      briefSimilar('scene', sceneId, { limit: 5 }),
      /*
       * ⚠️ `readBlock` لا `getBlock`: الثانية **تُنشئ** الكتلة إن لم
       *    تكن موجودة، فجوازٌ يُبنى على ذكرىً بلا ملاحظات كان يكتب
       *    صفًّا في القاعدة — وهو يُعلن أنه لا يكتب. كشفَه اختبارُ
       *    «يقرأ ولا يكتب» بفارق صفٍّ واحد.
       */
      withNotes ? readBlock(sceneId, 'notes') : Promise.resolve(null),
    ]);

  const ctx = { full, parts, expressions, transcript, people, threads, similar };
  const scene = full.scene;
  const sections = assemble(SCENE_SECTIONS, ctx);

  if (withNotes && notes?.text) {
    sections.push({
      id: 'notes', label: 'ملاحظاتي', unit: 'ملاحظة',
      count: 1, items: [{ text: notes.text }], empty: false, why: '',
    });
  }

  return {
    lingolifePassport: PASSPORT_VERSION,
    kind: 'scene',
    id: sceneId,
    title: scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان',
    head: {
      date: toISODate(scene.date) || scene.date || '',
      situation: typeLabel(scene.type),
      place: scene.placeName || '',
      media: { images: full.counts.images, audio: full.counts.audio },
    },
    sections,
    /* ما ينقص — مجموعًا في مكانٍ واحد كي يُقرأ كقائمة عمل. */
    gaps: sections.filter((s) => s.empty).map((s) => ({ id: s.id, label: s.label, why: s.why })),
    builtAt: new Date().toISOString(),
  };
}

/** جوازُ تعبير. */
export async function expressionPassport(expressionId) {
  const life = await expressionLife(expressionId);
  if (!life) throw new Error('التعبير مش موجود');

  const sections = assemble(EXPRESSION_SECTIONS, { life });

  return {
    lingolifePassport: PASSPORT_VERSION,
    kind: 'expression',
    id: expressionId,
    title: life.expression.text,
    head: {
      register: life.expression.register || '',
      seen: life.occurrences.length,
      scenes: life.sceneCount,
      firstSeen: life.firstSeen || '',
      lastSeen: life.lastSeen || '',
    },
    sections,
    gaps: sections.filter((s) => s.empty).map((s) => ({ id: s.id, label: s.label, why: s.why })),
    builtAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * الوثيقة كما تُقرأ
 * ------------------------------------------------------------------ */

const LINE = {
  conversation: (r) => `- **${r.speaker || (r.isMe ? 'أنا' : 'المتحدث')}:** ${r.ru}${r.ar ? `\n  - ${r.ar}` : ''}`,
  transcript: (r) => `${r.raw}${r.clean ? `\n\n**النسخة المصحّحة:**\n\n${r.clean}` : ''}`,
  scripts: (r) => `- **${r.title || 'سكريبت'}:** ${r.ru}${r.ar ? `\n  - ${r.ar}` : ''}`,
  mistakes: (r) => `- ❌ ${r.wrong} → ✅ ${r.natural}${r.kind ? ` _(${r.kind})_` : ''}${r.note ? `\n  - ${r.note}` : ''}`,
  expressions: (r) => `- **${r.ru}** — ${r.ar}${r.register ? ` _(${r.register})_` : ''}`,
  people: (r) => `- ${r.name}${r.evidence ? ` — ${r.evidence}` : ''}`,
  threads: (r) => `- ${r.title}${r.status ? ` (${r.status})` : ''}`,
  similar: (r) => `- ${r.title}${r.hint ? ` — ${r.hint}` : ''}\n  - ليه: ${r.why}`,
  meaning: (r) => `${r.ar}${r.note ? `\n\n${r.note}` : ''}`,
  occurrences: (r) => `- **${r.scene}** (${r.date})${r.quote ? `\n  - «${r.quote}»` : ''}`,
  captures: (r) => `- ${r.tag}`,
  stage: (r) => `${r.stage} — ${r.note}`,
  notes: (r) => r.text,
};

/**
 * الجواز نصًّا يُقرأ ويُلصَق.
 *
 * ⚠️ **Markdown لا JSON للقارئ البشريّ.** الجواز يُلصَق في محادثةٍ مع
 *    محلِّل أو يُقرأ بعينك، و`JSON` في الحالتين ضجيج. أمّا الآلة فلها
 *    الكائن نفسه.
 *
 * ⚠️ وما ينقص **مكتوبٌ في الوثيقة** لا محذوفٌ منها: قارئٌ لا يعرف أن
 *    النصّ الأصليّ غائبٌ سيظنّ أنه لم يكن هناك ما يُكتَب.
 */
export function passportMarkdown(passport) {
  const out = [`# ${passport.title}`, ''];

  const head = passport.head;
  const bits = passport.kind === 'scene'
    ? [head.date, head.situation, head.place,
      head.media.images && `${head.media.images} صورة`,
      head.media.audio && `${head.media.audio} تسجيل`]
    : [head.register, head.seen && `ظهر ${head.seen} مرّة`,
      head.scenes && `في ${head.scenes} ذكرى`,
      head.firstSeen && `من ${head.firstSeen}`];
  out.push(bits.filter(Boolean).join(' · '), '');

  for (const section of passport.sections) {
    if (section.empty) continue;
    out.push(`## ${section.label}`, '');
    const line = LINE[section.id] || ((r) => `- ${JSON.stringify(r)}`);
    out.push(section.items.map(line).join('\n'), '');
  }

  if (passport.gaps.length) {
    out.push('## اللي ناقص', '');
    out.push(passport.gaps.map((gap) => `- **${gap.label}** — ${gap.why}`).join('\n'), '');
  }

  /*
   * ⚠️ وتذييلٌ يقول ما **ليس** فيه. مَن يقرأ الوثيقة لا يعرف حدودها
   *    إلا إن قيلت له، ووثيقةٌ تبدو كاملةً وهي ناقصة أخطر من ناقصةٍ
   *    تعلن نقصها.
   */
  out.push('---', '');
  out.push('_مفيش في الورقة دي: ' + NOT_IN_PASSPORT.map((r) => r.label).join(' · ') + '._');

  return out.join('\n');
}

/** اسم الملفّ — بلا محارف تكسر نظام الملفّات. */
export function passportFilename(passport) {
  const stamp = new Date().toISOString().slice(0, 10);
  const title = String(passport.title || 'جواز')
    .replace(/[\\/:*?"<>|]/g, '').slice(0, 40).trim();
  return `جواز-${title}-${stamp}.md`;
}

/** أقسامٌ معروفة — للشاشات والاختبارات. */
export const SCENE_SECTION_IDS = SCENE_SECTIONS.map((s) => s.id);
export const EXPRESSION_SECTION_IDS = EXPRESSION_SECTIONS.map((s) => s.id);

/** عرضٌ مختصر للشاشة: كم قسمًا مملوءًا وكم ناقصًا. */
export function passportSummary(passport) {
  const filled = passport.sections.filter((s) => !s.empty);
  return {
    title: passport.title,
    filled: filled.length,
    total: passport.sections.length,
    gaps: passport.gaps.length,
    items: filled.reduce((sum, s) => sum + s.count, 0),
    date: passport.head.date || '',
  };
}

/** تنسيق التاريخ للعرض — يُصدَّر كي لا تعيد الشاشات اشتقاقه. */
export const passportDate = formatDate;

/**
 * LingoLife — مكتبة الطلبات (WS11 · الملحق H)
 *
 * كان في التطبيق **طلبٌ واحد** مكتوبٌ ثابتًا: «حلّل الذكرى دي». وهو
 * سؤالٌ من أسئلةٍ كثيرة تريد أن تسألها لمادّتك نفسها.
 *
 * ═══════════════════════════════════════════════════════════════
 * وثلاثة أشياء تجعل «مكتبة» لا «ثلاثة نصوص»
 * ═══════════════════════════════════════════════════════════════
 *
 * **١. عقدُ الردّ واحدٌ ومُولَّد.** كلُّ طلبٍ هنا يردُّ عليه المحلِّل
 * بـ**حزمة المشهد المُجهَّز نفسها**، والشكلُ يُولَّد من
 * `import/package-format.js` لا يُكتب بيد. راجع `contract.js`.
 *
 * **٢. ولكلٍّ نسخةٌ تُذكَر في الملفّ.** فتعرف بعد شهرين بأي طلبٍ خرج
 * هذا الردّ — كما تحمل ملاحظةُ التطوير `build` نسخة التطبيق.
 *
 * **٣. وتعليماتك تُضاف ولا تُستبدَل.** ما تكتبه أنت يُلحَق بعد العقد،
 * فلا يستطيع أن يمحو قاعدةً من قواعده.
 *
 * ⚠️ **ولا اتّصال ولا مفتاح.** الطلب يُبنى ويُحفَظ على جهازك. ما يخرج
 *    يخرج بيدك، ويُقال لك عدده قبل أن يخرج (الملحق · I2).
 */

import { settings } from '../../db/repositories.js';
import { PACKAGE_FORMAT_VERSION, kindName } from '../import/package-format.js';
import { contractBlock, askedLabels, CONTRACT_VERSION, NEVER_ASKED } from './contract.js';
import { getSceneFull } from '../scene-service.js';
import { listConversationParts, listSceneExpressions } from '../content-service.js';
import { typeLabel } from '../type-service.js';
import { toISODate } from '../../utils/dates.js';

/** إصدار **مغلَّف** الطلب — شكل الملفّ نفسه لا محتواه. */
export const REQUEST_VERSION = 1;

const EXTRA_KEY = 'prompts.extra';

/* ------------------------------------------------------------------ *
 * ما لا يصير طلبًا — وسببه
 * ------------------------------------------------------------------ */

/**
 * ⚠️ أسئلةٌ وجيهةٌ **لا مكان لردّها اليوم** — والسبب بنيويّ لا كسل.
 */
export const NOT_A_PROMPT = Object.freeze([
  {
    id: 'expression-deep-dive',
    label: 'اشرحلي التعبير ده لوحده',
    why: 'الردّ حزمةُ **مشهد**، وحزمةٌ بلا ذكرى تُرفَض في القراءة (`REQUIRED.scene`). فسؤالٌ عن تعبيرٍ وحده لا باب لردّه — والبديل القائم أن تسأل عنه داخل طلب ذكراه.',
  },
  {
    id: 'review-plan',
    label: 'اعملي خطّة مراجعة',
    why: '`reviewSuggestions` مُعلَنٌ أنه لا يُستورَد: جدولة المراجعة لم تُبنَ. فطلبُها اليوم يُخرج ردًّا يُستبعَد كلُّه.',
  },
  {
    id: 'grade-me',
    label: 'قيّم مستواي',
    why: 'راجع `NEVER_ASKED`: ما لا نطلبه لا نصنع له طلبًا.',
  },
]);

export { NEVER_ASKED };

/* ------------------------------------------------------------------ *
 * السجلّ
 * ------------------------------------------------------------------ */

/**
 * كل طلب يقول: **ماذا يسأل**، و**ماذا يحتاج**، و**ماذا يَخرج معه**.
 *
 * إضافة طلبٍ غدًا = مدخلٌ هنا. لا شاشة تُلمَس ولا عقدَ ردٍّ يُكتب —
 * نفس عقد `ASPECTS` و`SCOPES` و`GROUPS`.
 */
export const PROMPTS = Object.freeze([
  {
    id: 'analyze-scene',
    version: 2,
    label: 'حلّل الذكرى دي',
    purpose: 'تطلع بالتعبيرات والتصحيحات والمحادثة من مادّةٍ كتبتَها في ذكرى موجودة.',
    needs: 'scene',
    /* ما لا يُطلَب في هذا السياق تحديدًا — ومعه سببه. */
    omit: { eventThread: 'الخيط قصّةٌ تربطها أنت — والمحلِّل لا يعرف باقي ذكرياتك' },
    intro: [
      'You are helping someone learn Russian from their own real-life situations.',
      'Below is ONE memory they lived, with whatever they already wrote about it.',
      'Your job: pull out the language — what was said, what they got wrong,',
      'and which expressions are worth keeping.',
    ],
  },

  {
    id: 'new-scene',
    version: 1,
    label: 'اعمل ذكرى من مادّة خام',
    purpose: 'عندك تفريغ أو نصّ أو ملاحظات — ومفيش ذكرى لسّه. ده بيطلع الذكرى نفسها ومحتواها.',
    needs: 'material',
    omit: {},
    intro: [
      'You are helping someone turn raw material from a real situation they lived',
      'into a structured memory in their Russian-learning journal.',
      'The material below is what they captured: a transcript, notes, or text',
      'they copied from somewhere.',
      '',
      'Your job: read it and produce the memory — a title, who was there,',
      'what was said, and the language worth keeping from it.',
      '',
      '⚠️ This situation is REAL and already happened. Do not add turns that are',
      'not in the material, do not invent a nicer version of it, and do not',
      'complete a conversation that stops mid-way. If the material is thin,',
      'the reply is thin — that is correct.',
    ],
  },

  {
    id: 'rehearse',
    version: 1,
    label: 'جهّزني للمرّة الجاية',
    purpose: 'هتقابل نفس الموقف تاني — ده بيطلع سكريبتات تتمرّن عليها من نفس الذكرى.',
    needs: 'scene',
    omit: {
      mistakes: 'التصحيح يحتاج ما قلتَه فعلًا — وهذا طلبٌ عمّا ستقوله',
      eventThread: 'الخيط قصّةٌ تربطها أنت',
      people: 'الأشخاص معروفون في الذكرى — ولا يُنشَأ أحدٌ من تمرين',
    },
    intro: [
      'You are helping someone rehearse for a situation they will face AGAIN.',
      'Below is a memory of the last time it happened.',
      '',
      'Your job: write Russian they can practise saying out loud next time —',
      'built from how this actually went, not from a textbook. Include the',
      'expressions they will need.',
      '',
      '⚠️ Scripts are for SPEAKING. Short turns, natural register, the words',
      'a real person uses in this exact setting.',
    ],
  },
]);

export const promptById = (id) => PROMPTS.find((prompt) => prompt.id === id) || null;

/* ------------------------------------------------------------------ *
 * تعليماتك أنت
 * ------------------------------------------------------------------ */

/** ما أضفتَه لكل طلب — خريطةٌ من معرّف الطلب إلى نصّك. */
export async function extraInstructions() {
  const stored = await settings.get(EXTRA_KEY, null);
  return stored && typeof stored === 'object' ? stored : {};
}

/**
 * يحفظ تعليماتك لطلبٍ بعينه.
 *
 * ⚠️ **تُلحَق ولا تُستبدِل.** لو استبدلت العقد أمكن لسطرٍ منك أن يمحو
 *    «لا تخترع وقائع» — وهو أخطر ما في القواعد. فمكانُها بعده دائمًا،
 *    وتحت عنوانٍ يقول إنها منك.
 */
export async function setExtraInstructions(promptId, text) {
  if (!promptById(promptId)) throw new Error(`طلب مش معروف: ${promptId}`);
  const all = await extraInstructions();
  const clean = String(text || '').trim();
  if (clean) all[promptId] = clean;
  else delete all[promptId];
  await settings.set(EXTRA_KEY, all);
  return clean;
}

/* ------------------------------------------------------------------ *
 * البناء
 * ------------------------------------------------------------------ */

/** التعليمات كما تُكتب في الملفّ — عقدٌ، ثم استثناءات الطلب، ثم أنت. */
function instructionsFor(prompt, mine) {
  const omit = Object.keys(prompt.omit || {});
  return [
    ...contractBlock({ omit, intro: prompt.intro }),
    ...(omit.length
      ? ['', 'Do not include these either, for this request specifically:',
        ...omit.map((kind) => `  · ${kind}`)]
      : []),
    ...(mine
      ? ['', 'Extra instructions from the learner themselves — follow these too,',
        'but never at the expense of the rules above:', '', mine]
      : []),
  ];
}

/** محتوى ذكرىً قائمة — نفس ما كان يبنيه `analysis/request.js`. */
async function sceneMaterial(sceneId) {
  const full = await getSceneFull(sceneId);
  if (!full) throw new Error('الذكرى مش موجودة');

  const [parts, expressions] = await Promise.all([
    listConversationParts(sceneId),
    listSceneExpressions(sceneId),
  ]);

  const scene = full.scene;
  return {
    title: scene.titleAr || '',
    titleRu: scene.titleRu || '',
    date: toISODate(scene.date) || scene.date || '',
    situation: typeLabel(scene.type),
    place: scene.placeName || '',
    notes: full.blocks?.find((b) => b.kind === 'notes')?.text || '',

    scripts: full.scripts.map((row) => ({ title: row.title || '', text: row.text || '' })),

    conversation: parts.map((row) => ({
      speaker: row.speaker || '',
      isMe: Boolean(row.isMine),
      text: row.text || '',
      translation: row.translation || '',
    })),

    /*
     * ما عندك بالفعل — يُرسَل كي لا يقترح المحلِّل ما هو مكتوبٌ عندك.
     * (وحتى لو كرّره، فالخطّة تكشف المتطابق وتستعمله ولا تُنشئ ثانيًا.)
     */
    alreadyHave: {
      expressions: expressions.map((row) => ({
        text: row.text, meaningAr: row.meaningAr || '',
      })),
      mistakes: full.mistakes
        .filter((row) => row.state !== 'trashed')
        .map((row) => ({ wrong: row.wrong || '', natural: row.natural || '' })),
    },
  };
}

/**
 * يبني طلبًا.
 *
 * ⚠️ **يقرأ ولا يكتب.** بناؤه مرّتين لا يُغيّر شيئًا — كما `planImport`.
 *
 * @param {string} promptId
 * @param {{sceneId?: string, material?: string, about?: object}} context
 */
export async function buildPrompt(promptId, context = {}) {
  const prompt = promptById(promptId);
  if (!prompt) throw new Error(`طلب مش معروف: ${promptId}`);

  const extras = await extraInstructions();
  const instructions = instructionsFor(prompt, extras[prompt.id]);

  const request = {
    lingolifeAnalysisRequest: REQUEST_VERSION,
    /* أي طلبٍ بأي نسخة — فتعرف بعد شهور بأي سؤالٍ خرج هذا الردّ. */
    prompt: { id: prompt.id, version: prompt.version, label: prompt.label },
    replyFormat: { lingolifeScene: PACKAGE_FORMAT_VERSION, contract: CONTRACT_VERSION },
    instructions,
  };

  if (prompt.needs === 'scene') {
    const sceneId = context.sceneId;
    if (!sceneId) throw new Error('الطلب ده محتاج ذكرى');
    /*
     * ⚠️ **هويّةُ الذكرى، تُرسَل ليُعيدها المحلِّل كما هي.** بها يعرف
     *    الاستيراد أن هذا ردٌّ على ذكرىً بعينها فيكتب فيها، بدل أن
     *    يطابق بالعنوان — والعنوان يتكرّر والمعرّف لا.
     *
     *    ولو أسقطها المحلِّل فلا ضرر: تعود الخطّة إلى «أنشئ جديدة»
     *    وتعرض المتشابهات، وهو سلوكها الأصليّ.
     */
    request.forSceneId = sceneId;
    request.memory = await sceneMaterial(sceneId);
    request.instructions.push(
      '',
      'Copy "forSceneId" from this request into your reply, exactly as it is.',
      'Without it the app cannot tell which memory your reply belongs to,',
      'and will offer to create a duplicate one.'
    );
  } else {
    const material = String(context.material || '').trim();
    if (!material) throw new Error('المادّة الخام فاضية — مفيش حاجة نسأل عنها');
    /*
     * ⚠️ **ولا `forSceneId` هنا** — ولا يُختلَق واحد. لا توجد ذكرى
     *    بعدُ، والردُّ سيمرّ بالخطّة فتقترح إنشاءها وتعرض المتشابه
     *    عندك قبل أن تكتب. وهو نفس المسار لا مسارٌ ثانٍ (C5).
     */
    request.material = {
      text: material,
      hint: String(context.hint || '').trim(),
      /* تاريخُ الواقعة إن عرفتَه — والمحلِّل لا يخمّنه. */
      date: String(context.date || '').trim(),
    };
  }

  return request;
}

/**
 * التعليمات وحدها — **بلا مادّة ولا ذكرى**.
 *
 * ⚠️ لأن معاينتها لا تحتاج شيئًا منهما: العقد والقواعد وتعليماتك
 *    ثابتةٌ مهما كانت الذكرى. وأوّل كتابةٍ بنَت طلبًا كاملًا بمعرّفٍ
 *    وهميّ فرمى، فلم تُفتَح النافذة أصلًا — **كشفَه المتصفّح**.
 */
export async function previewInstructions(promptId) {
  const prompt = promptById(promptId);
  if (!prompt) throw new Error(`طلب مش معروف: ${promptId}`);
  return instructionsFor(prompt, (await extraInstructions())[prompt.id]);
}

/* ------------------------------------------------------------------ *
 * ما سيخرج
 * ------------------------------------------------------------------ */

/**
 * ما الذي سيخرج من جهازك — لتقوله الشاشة **قبل** الحفظ.
 *
 * ⚠️ عددٌ مجرَّد («هيخرج ملف») لا يكفي. أن ترى «٤ أجزاء محادثة و
 *    سكريبتان» يجعل القرار قرارًا، لا موافقةً على المجهول.
 */
export function requestSummary(request) {
  const memory = request?.memory || {};
  const material = request?.material || null;

  return {
    promptId: request?.prompt?.id || 'analyze-scene',
    promptLabel: request?.prompt?.label || 'تحليل',
    title: material ? 'مادّة خام' : (memory.title || 'ذكرى بلا عنوان'),
    /* المادّة الخام تُقاس بحروفها — لا أقسامَ فيها تُعَدّ. */
    rawChars: material ? material.text.length : 0,
    scripts: memory.scripts?.length || 0,
    conversation: memory.conversation?.length || 0,
    speakers: [...new Set((memory.conversation || [])
      .map((row) => row.speaker).filter(Boolean))],
    hasNotes: Boolean(memory.notes),
    expressions: memory.alreadyHave?.expressions?.length || 0,
    mistakes: memory.alreadyHave?.mistakes?.length || 0,
  };
}

/** اسم الملفّ — بتاريخ اليوم كي لا يدهس بعضه بعضًا في مجلّد التنزيلات. */
export function requestFilename(request) {
  const stamp = new Date().toISOString().slice(0, 10);
  const title = (request?.memory?.title || (request?.material ? 'مادّة-خام' : 'ذكرى'))
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 40)
    .trim();
  return `${request?.prompt?.id === 'rehearse' ? 'تحضير' : 'تحليل'}-${title}-${stamp}.json`;
}

/** وصفٌ للشاشة: ماذا يخرج مع كل طلب، وماذا يعود به. */
export function promptCard(prompt) {
  const omit = Object.keys(prompt.omit || {});
  return {
    id: prompt.id,
    label: prompt.label,
    purpose: prompt.purpose,
    version: prompt.version,
    needs: prompt.needs,
    returns: askedLabels({ omit }),
    /* ⚠️ بالاسم العربي: شاشةٌ عربيّةٌ تقول `eventThread` تطلب منك أن تترجم. */
    omitted: Object.entries(prompt.omit || {}).map(([kind, why]) => ({ kind: kindName(kind), why })),
  };
}

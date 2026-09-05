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

/* ================================================================== *
 * برومبتاتُ الجملة الواحدة (WS-SL · بند ١٠)
 * ================================================================== */

/**
 * ⚠️ **ولمَ هنا لا في شاشة الشادوينج؟**
 *
 * لأنّ هذا الملفَّ هو **مكانُ البرومبتات** في التطبيق. وكتابةُ نصٍّ
 * ثابتٍ داخل الواجهة كان سيصنع برومبتًا ثانيًا يفترق عن أخيه بعد
 * أوّل تحسين، ولا تعرف أيَّهما استعملتَ حين يأتيك ناتجٌ غريب.
 *
 * ⚠️ **وشكلُها غيرُ شكل `PROMPTS` أعلاه — عن قصد.** تلك تُبنى من
 *    **ذكرى** كاملةٍ وتعود بحزمةٍ تُستورَد بالتحقّق. وهذه تُبنى من
 *    **جملةٍ واحدة** وتعود بنصٍّ تلصقه بيدك. حاجتان مختلفتان،
 *    فقالبان مختلفان في مكانٍ واحد — لا قالبٌ واحدٌ يتمطّط لهما.
 *
 * ⚠️ **والقالبُ يُملأ بالجملة قبل النسخ** (بند ١٠): تنسخ فتلصق
 *    مباشرةً، بلا أن تعود لتضع الجملةَ بيدك في المحادثة.
 */
export const LEARN_PROMPTS = Object.freeze([
  {
    id: 'sentence-chunks',
    label: 'نسخ برومبت بناء القطع',
    purpose: 'يطلع لك كورات الجملة وأسئلة استرجاعها وتدرّجها وتكراراتها.',
    /*
     * ⚠️ **نفسُ المعرّف — ولا برومبتَ ثانٍ** (بند ٣٤). المحتوى تطوّر إلى
     *    V2، والهُويّةُ `sentence:sentence-chunks` كما هي في الفهرس
     *    الموحَّد. فمفضّلتُك عليه وسجلُّ استعمالِه ينجوان، ولا يظهر في
     *    المكتبة برومبتان متشابهان لا تعرف أيَّهما استعملت.
     */
    build: (sentence) => [
      'You are helping an Arabic speaker build PRODUCTIVE RECALL from one',
      'Russian sentence they met in real life. Output a Draft using EXACTLY',
      'the section headings below, in this order. Omit a section entirely if',
      'it would add nothing — do not pad it.',
      '',
      '════════ THE SOURCE SENTENCE IS AN ANCHOR, NOT A PRISON ════════',
      '',
      'Cores and Variations do NOT have to be exact substrings of the original',
      'sentence. You MAY bring in closely related language from outside it when',
      'that language:',
      '  · naturally belongs to the SAME situation',
      '  · reinforces a productive Core',
      '  · creates useful variation and strengthens recall',
      '  · stays natural professional Russian',
      '',
      'This is CONTROLLED expansion. It is wanted. What is NOT wanted:',
      '  ✗ unrelated vocabulary        ✗ generic textbook filler',
      '  ✗ topic drift                 ✗ invented technical claims',
      'If a sentence is about technical documentation, a connected core such as',
      'тре́бования по документа́ции may earn its place; a core about travel or',
      'food may not. Stay inside one working scene.',
      '',
      '════════ WHAT TO PRODUCE ════════',
      '',
      'A. MICRO CORES — short reusable speaking units.',
      '   Each must be big enough to say on its own and reuse elsewhere.',
      '   ⚠️ Do NOT fragment into single meaningless words to raise the count.',
      '      Good:  тре́бования по документа́ции · я бы снача́ла уточни́л',
      '             при рабо́те с техни́ческой документа́цией · нали́чие докуме́нта',
      '             обраща́ть внима́ние на что? · не то́лько …, но и …',
      '      Bad:   э́тот · вопро́с · по · снача́ла',
      '',
      '   Each core must pass one test: "would this be useful again in another',
      '   real situation?" Do not create a core merely because a phrase exists.',
      '',
      '   ⚠️ But do NOT keep the count artificially low either. "A few good',
      '      ones" must not be read as "always output only three big chunks" —',
      '      a rich sentence needs enough cores to build a real recall chain.',
      '',
      'B. A Russian RECALL QUESTION for the cores worth retrieving.',
      '   ⚠️ SITUATIONAL, not meta-linguistic. The question must sound like',
      '      something that would actually be ASKED INSIDE the real situation,',
      '      so the answer is pulled out by context — not translated.',
      '',
      '      Preferred:  Вы проверяете только наличие документа?',
      '                  Что ещё нужно проверить у документа?',
      '                  На что нужно обратить внимание при работе с документацией?',
      '                  У кого вы бы уточнили этот вопрос?',
      '',
      '      Avoid:      Как сказать …?',
      '                  Как построить фразу …?',
      '                  Какая конструкция используется …?',
      '                  Что мы говорим, если хотим сказать …?',
      '',
      '   These "Как сказать" forms are allowed ONLY when a genuinely',
      '   grammatical pattern cannot be elicited from any situation. They must',
      '   stay rare and secondary — never the dominant style of the chain.',
      '',
      '   ⚠️ THE QUESTION IS RUSSIAN-ONLY. Never put Arabic inside a Вопрос:.',
      '      Bad:  Как сказать «حالة المستند»?',
      '      Bad:  Что значит «الانتباه إلى»?',
      '      Good: Что ещё нужно проверить у документа, кроме его наличия?',
      '            → Его статус.',
      '      Arabic belongs in meanings, notes and translations — never as the',
      '      retrieval trigger. The engine is Russian question → Russian answer.',
      '',
      '   ⚠️ The cue must genuinely TRIGGER its answer. Reject weak pairings',
      '      where the question already contains the answer:',
      '      Weak:      Вопрос: Как сказать «наличие документа»?',
      '                 Ответ:  наличие документа',
      '      Strong:    Вопрос: Что нужно проверить в первую очередь —',
      '                         есть ли сам документ?',
      '                 Ответ:  Наличие документа.',
      '      Stronger:  Вопрос: Вы уже проверили, есть ли сам документ?',
      '                 Ответ:  Да, мы проверили наличие документа.',
      '',
      '   ⚠️ Prefer answers that sound like SPEECH, not dictionary fragments.',
      '      A bare phrase is fine for reviewing a Micro Core, but as the chain',
      '      progresses the answers should become real sentences:',
      '        core:   статус документа',
      '        answer: Нужно проверить статус документа.',
      '',
      'B2. ONE CONNECTED RECALL CHAIN — not isolated flashcards.',
      '   Read together, the Вопрос/Ответ pairs must form a single internal',
      '   sequence inside ONE situation, where each answer prepares the next',
      '   question. The learner should feel "I am inside one situation",',
      '   never "here are six unrelated Russian phrases".',
      '',
      '   Conceptual shape (write the actual Russian naturally):',
      '     What are we working with?      → техническая документация',
      '     What must we pay attention to? → наличие документа',
      '     Only availability?             → нет, ещё и статус',
      '     What else?                     → подписи и подтверждения',
      '     Now say the whole idea.        → full reconstruction',
      '',
      '   ⚠️ ANSWERS GROW. Later answers should REUSE and EXTEND the earlier',
      '      language rather than starting fresh. This progressive reuse is',
      '      deliberate — it is what builds automatic recall:',
      '        1) На наличие документа.',
      '        2) Нет, важно обращать внимание не только на наличие документа,',
      '           но и на его статус.',
      '        3) …не только на наличие документа, но и на его статус,',
      '           подписи и подтверждения.',
      '',
      'C. EXPANSIONS — the same language growing step by step:',
      '   small core → larger combination → near-full sentence.',
      '   These are memory-building stages, not random examples. Order matters.',
      '',
      'D. HIGH-VALUE CORE REPETITION — for EVERY core that genuinely earns',
      '   deliberate repetition, open a CORE FAMILY and give it VARIATIONs',
      '   in different contexts. Judge by: reusability · productive grammar',
      '   frame · workplace usefulness · substitution flexibility ·',
      '   likelihood of reuse.',
      '',
      '   ⚠️ The number of families is ADAPTIVE — decided by the sentence,',
      '      not by a rule:',
      '        ZERO families     if no core deserves deliberate repetition',
      '        ONE family        if a single frame carries the sentence',
      '        SEVERAL families  if several cores are genuinely productive',
      '   ⚠️ Do not inflate the number of families, and do not cap it at one.',
      '   ⚠️ Do NOT give every core the same number of variations',
      '      mechanically — a specialised noun phrase may deserve none.',
      '',
      'E. FULL RECONSTRUCTION — rebuild the complete idea, when useful.',
      '   ⚠️ Its Вопрос: must stay MEANINGFUL INSIDE THE SITUATION, so the',
      '      learner rebuilds the idea rather than reciting a memorised line.',
      '      Good: Что вы поняли при работе с технической документацией?',
      '      Bad:  Повторите исходное предложение.',
      '',
      'F. QUICK RECALL CHAIN — a compact review of answers ALREADY above.',
      '   ⚠️ Do not introduce new material here.',
      '   ⚠️ Same style as the chain: situational Russian question → short',
      '      Russian answer, then progressively larger retrieval. It should',
      '      read like a compressed oral rehearsal of the scene — NOT',
      '      "translation question → lexical label".',
      '',
      '════════ HOW MANY ════════',
      '',
      'Guidance, NOT a quota. Semantic quality beats count.',
      '  Micro Cores roughly 4–8 for a rich sentence · Expansions 2–5',
      '  Variations only where high-value',
      '  Core Families: as many as genuinely deserve repetition — may be 0',
      '  Full Reconstruction usually 1',
      '⚠️ Do NOT inflate the output to hit a number.',
      '⚠️ And do NOT suppress it either: too few cores cannot build a chain.',
      '',
      '════════ EXACT SHAPE ════════',
      '',
      'مسودة — Core Recall V2',
      '',
      'الجملة الأساسية:',
      '<the original sentence>',
      '',
      'MICRO CORE 1',
      '<Russian core, with stress marks>',
      '<its meaning in Egyptian Arabic>',
      'المعنى:',
      '<one line: register, when it is used>',
      'القالب:',
      '<grammatical pattern, e.g. что + verb + чем>',
      'أمثلة:',
      '<a short Russian example>',
      '<its Arabic translation>',
      'Вопрос:',
      '<a SITUATIONAL Russian question — Russian only, no Arabic>',
      'Ответ:',
      '<the Russian answer; a natural spoken answer is better than a bare',
      ' fragment once the chain is under way>',
      '',
      'MICRO CORE 2',
      '…',
      '',
      'EXPANDING RECALL',
      '',
      'EXPANSION 1',
      '<Russian, slightly longer — REUSING the language of the cores above>',
      '<Arabic>',
      '',
      'EXPANSION 2',
      '<Russian, longer still — extending EXPANSION 1, not restarting>',
      '',
      'HIGH-VALUE CORE REPETITION',
      'CORE FAMILY: <the reusable frame>',
      'الأولوية: ★★★',
      'VARIATION 1',
      '<Russian variation>',
      'VARIATION 2',
      '<Russian variation>',
      '',
      '<repeat CORE FAMILY … VARIATION … for each further high-value core,',
      ' or omit this whole section entirely if none deserves repetition>',
      '',
      'FULL RECONSTRUCTION',
      'Вопрос:',
      '<a situational Russian question that invites the whole idea>',
      'Ответ:',
      '<the full rebuilt idea in Russian>',
      '',
      'QUICK RECALL CHAIN',
      '<situational Russian question> → <short Russian answer from above>',
      '<situational Russian question> → <larger Russian answer from above>',
      '',
      '════════ RULES ════════',
      '- Keep the headings EXACTLY as written (MICRO CORE, EXPANSION,',
      '  CORE FAMILY, VARIATION, FULL RECONSTRUCTION, QUICK RECALL CHAIN,',
      '  Вопрос:, Ответ:, المعنى:, القالب:, أمثلة:).',
      '- Number the headings (MICRO CORE 1, MICRO CORE 2, …).',
      '- Keep stress marks where practical.',
      '- Natural professional Russian. No artificial textbook sentences.',
      '- Arabic stays short — it supports understanding, it is not the target.',
      '- Do not invent usages you are unsure about.',
      '',
      '════════ RECALL QUALITY — THE POINT OF THE WHOLE DRAFT ════════',
      '- Russian Recall Questions must be SITUATIONAL whenever possible.',
      '- NEVER put Arabic inside a Russian Recall Question.',
      '- Avoid translation-style questions (Как сказать …?) unless a purely',
      '  grammatical point cannot be elicited from any situation.',
      '- Build ONE CONNECTED recall chain, not isolated flashcards.',
      '- Let the answers GROW: later answers reuse and extend earlier ones.',
      '- The original sentence is the ANCHOR, not the prison.',
      '- Controlled expansion beyond the source sentence is allowed when it',
      '  stays inside the same situation.',
      '- High-value productive Cores deserve MORE repetition than specialised',
      '  noun phrases — do not spread variations evenly for symmetry.',
      '- Do not inflate the output mechanically.',
      '',
      'The learner must not finish thinking "here are six unrelated Russian',
      'phrases". They must finish thinking "I am inside one situation, and',
      'each answer prepared the next one".',
      '',
      'الجملة الأساسية:',
      sentence,
    ].join('\n'),
  },
  {
    id: 'sentence-scene',
    label: 'نسخ برومبت مشهد النقل',
    purpose: 'يطلع لك موقف جديد تستعمل فيه نفس اللغة — حوار أو سرد قصير.',
    build: (sentence) => [
      'You are helping an Arabic speaker learn Russian. Below is ONE sentence',
      'they met in real life.',
      '',
      'Write a SHORT transfer scene: a new, realistic situation where they',
      'would use the same language. Russian only, natural spoken register.',
      '',
      'If it is a dialogue, mark every turn with the speaker name followed by',
      'a colon, like:',
      '',
      'Продавец: ...',
      'Клиент: ...',
      '',
      '⚠️ Rules:',
      '- 4 to 8 turns, or a short paragraph if narration fits better.',
      '- Reuse the language of the original sentence, do not just paraphrase it.',
      '- No Arabic translation, no explanation, no title. The scene only.',
      '',
      'الجملة الأصلية:',
      sentence,
    ].join('\n'),
  },
]);

/** برومبتُ جملةٍ بمعرّفه — أو `null`. */
export const learnPromptById = (id) => LEARN_PROMPTS.find((one) => one.id === id) || null;

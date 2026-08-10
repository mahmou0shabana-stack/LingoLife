/**
 * LingoLife — طلب التحليل الخارجي
 *
 * ═══════════════════════════════════════════════════════════════
 * الفكرة كلها: الردّ حزمةُ استيرادٍ عاديّة
 * ═══════════════════════════════════════════════════════════════
 *
 * الطريق الطبيعيّ لبناء «تحليل بالذكاء الاصطناعي» أن يحمل التطبيق
 * مفتاحًا ويتّصل بخادم. وهو ما **لا يحدث هنا**: لا مفتاح، ولا اتصال،
 * ولا بايتٌ يخرج إلا بيدك.
 *
 * فالبديل ملفّان لا واحد:
 *
 *   ١. **طلبٌ تُصدِّره** — محتوى الذكرى ومعه تعليماتٌ مكتوبة تقول
 *      للمحلِّل ما المطلوب وبأي شكلٍ يردّ.
 *   ٢. **ردٌّ تستورده** — وهو **حزمة المشهد المُجهَّز نفسها** التي
 *      تعرفها `import/parse.js` منذ WS2.
 *
 * وهذا ليس اختصارًا بل هو الصواب: مسار الاستيراد مبنيٌّ ومُختبَرٌ
 * ويمرّ بثلاث طبقات — تحقّقٌ صارم، ثم خطّةٌ لا تكتب شيئًا، ثم تنفيذٌ
 * إمّا كلّه وإمّا لا شيء — **ومعاينةٌ تريك كل صفٍّ قبل الالتزام**.
 * صيغةٌ ثانيةٌ للردّ تعني ثلاث طبقاتٍ ثانية ومعاينةً ثانية، وبابًا
 * جديدًا لبياناتٍ تدخل بلا مراجعة.
 *
 * ⚠️ **وما يخرج يخرج كلّه.** الملفّ فيه نصوص ذكراك بالروسي والعربي
 *    وأسماء مَن تكلّم. لا يعرف التطبيق إلى أين ستأخذه، فيقولها لك
 *    صراحةً في الشاشة قبل الحفظ — لا في سطرٍ صغير بعده.
 */

import { getSceneFull } from '../scene-service.js';
import { listConversationParts, listSceneExpressions } from '../content-service.js';
import { typeLabel } from '../type-service.js';
import { PACKAGE_FORMAT_VERSION } from '../import/package-format.js';
import { toISODate } from '../../utils/dates.js';

/** إصدار صيغة الطلب — يتغيّر إن تغيّر شكلُ ما نطلبه. */
export const REQUEST_VERSION = 1;

/**
 * التعليمات التي تُكتب **داخل** الملفّ.
 *
 * ⚠️ داخل الملفّ لا في وثيقةٍ منفصلة: تفتح الملفّ، تنسخه، تلصقه لأي
 *    محلِّل — فيقرأ ما المطلوب معه. تعليماتٌ في مكانٍ آخر تُنسى.
 *
 * ⚠️ وبالإنجليزيّة لأن المخاطَب نموذجٌ لا أنت، والمصطلحات التقنيّة
 *    (`schema`, `JSON`) لا تُترجَم فتلتبس. أمّا ما تقرؤه أنت فعربيّ.
 */
const INSTRUCTIONS = [
  'You are helping someone learn Russian from their own real-life situations.',
  'Below is one memory (a real situation they lived) with whatever they wrote about it.',
  '',
  'Return ONLY a JSON object — no prose, no markdown fences — using this shape:',
  '{',
  '  "forSceneId": "copy this verbatim from the request — it tells the app which memory this belongs to",',
  '  "scene": { "title": "...", "titleRu": "...", "date": "YYYY-MM-DD" },',
  '  "scripts": [{ "title": "...", "text": "Russian text" }],',
  '  "conversations": [{ "speaker": "name", "text": "Russian", "translation": "Arabic" }],',
  '  "mistakes": [{ "wrong": "...", "natural": "...", "kind": "grammar|gender|case|word|natural|other", "note": "Arabic explanation" }],',
  '  "expressions": [{ "text": "Russian", "meaningAr": "Egyptian Arabic meaning", "register": "professional|technical|daily|formal|informal", "example": "the Russian sentence it appeared in" }]',
  '}',
  '',
  'Rules:',
  '- Every field is optional except the ones already present below; omit what you cannot determine.',
  '- Write all Arabic in EGYPTIAN Arabic (عامية مصرية), not Modern Standard.',
  '- Do NOT invent facts about the situation. Only work from what is given.',
  '- Do NOT claim the learner has mastered anything. Corrections and expressions only.',
  '- Keep Russian exactly as Russian; never transliterate.',
  '- Copy "forSceneId" from the request exactly. Without it the app cannot tell',
  '  which memory your reply belongs to, and will offer to create a duplicate one.',
  '- The reply is imported into an app that shows the user every row before saving,',
  '  so it is safe to suggest — but never to assert something you are unsure of.',
];

/**
 * يبني طلب تحليلٍ لذكرى.
 *
 * ⚠️ **يقرأ ولا يكتب.** لا أثرَ لهذه الدالّة في القاعدة، فتصديرُ الطلب
 *    مرّتين لا يُغيّر شيئًا — كما `planImport` لا تكتب.
 *
 * @param {string} sceneId
 */
export async function buildAnalysisRequest(sceneId) {
  const full = await getSceneFull(sceneId);
  if (!full) throw new Error('الذكرى مش موجودة');

  const [parts, expressions] = await Promise.all([
    listConversationParts(sceneId),
    listSceneExpressions(sceneId),
  ]);

  const scene = full.scene;
  const notes = full.blocks?.find((b) => b.kind === 'notes')?.text || '';

  return {
    lingolifeAnalysisRequest: REQUEST_VERSION,
    /* الصيغة التي يجب أن يردّ بها — نفس حزمة الاستيراد. */
    replyFormat: { lingolifeScene: PACKAGE_FORMAT_VERSION },
    /*
     * ⚠️ **هويّةُ الذكرى، تُرسَل ليُعيدها المحلِّل كما هي.** بها يعرف
     *    الاستيراد أن هذا ردٌّ على ذكرىً بعينها فيكتب فيها، بدل أن
     *    يطابق بالعنوان — والعنوان يتكرّر والمعرّف لا.
     *
     *    ولو أسقطها المحلِّل فلا ضرر: تعود الخطّة إلى «أنشئ جديدة»
     *    وتعرض المتشابهات، وهو سلوكها الأصليّ.
     */
    forSceneId: sceneId,
    instructions: INSTRUCTIONS,

    memory: {
      title: scene.titleAr || '',
      titleRu: scene.titleRu || '',
      date: toISODate(scene.date) || scene.date || '',
      situation: typeLabel(scene.type),
      place: scene.placeName || '',
      notes,

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
    },
  };
}

/**
 * ما الذي سيخرج من جهازك — لتقوله الشاشة **قبل** الحفظ.
 *
 * ⚠️ عددٌ مجرَّد («هيخرج ملف») لا يكفي. أن ترى «٤ أجزاء محادثة و
 *    سكريبتان» يجعل القرار قرارًا، لا موافقةً على المجهول.
 */
export function requestSummary(request) {
  const memory = request?.memory || {};
  return {
    title: memory.title || 'ذكرى بلا عنوان',
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
  const title = (request?.memory?.title || 'ذكرى')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 40)
    .trim();
  return `تحليل-${title}-${stamp}.json`;
}

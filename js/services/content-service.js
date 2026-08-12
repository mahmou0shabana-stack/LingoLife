/**
 * LingoLife — خدمة المحتوى النصّي
 * سكريبتات · محادثة · تصحيحات (خطأ/طبيعي) · تعبيرات · ملاحظات
 */

import {
  scripts,
  scriptVersions,
  contentBlocks,
  conversations,
  conversationParts,
  mistakeComparisons,
  expressions,
  expressionOccurrences,
  scenes,
} from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { normalize } from '../utils/normalization.js';

/* ============================================================
   السكريبتات
   ============================================================ */

export const SCRIPT_TYPES = [
  { id: 'main', label: 'السكريبت الأساسي' },
  { id: 'short', label: 'نسخة مختصرة' },
  { id: 'formal', label: 'نسخة رسمية' },
  { id: 'story', label: 'نسخة سردية' },
  { id: 'detailed', label: 'نسخة مفصّلة' },
  { id: 'alt', label: 'نسخة بديلة' },
];

export function scriptTypeLabel(id) {
  return SCRIPT_TYPES.find((t) => t.id === id)?.label || 'سكريبت';
}

/**
 * يضيف سكريبتًا. أول سكريبت يصير الأساسي تلقائيًا.
 *
 * `sceneType` نوع الموقف الذي يصفه هذا السكريبت — يرث نوع الذكرى
 * افتراضيًّا، ويجوز أن يختلف: ذكرى «فحص» قد يكون فيها سكريبت للمكالمة
 * التي سبقته. `type` شيء آخر تمامًا: صيغة النصّ (أساسي، مختصر، رسمي).
 */
export async function addScript(sceneId, { title, text, type = 'main', sceneType = null }) {
  const existing = await scripts.byIndex('sceneId', sceneId);
  const isFirst = existing.filter((s) => s.state === STATE.ACTIVE).length === 0;

  const script = await scripts.create({
    sceneId,
    title: (title || scriptTypeLabel(type)).trim(),
    text: text || '',
    type,
    sceneType: sceneType || null,
    language: 'ru',
    register: null,
    isPrimary: isFirst ? 1 : 0,
    version: 1,
    source: 'user',
  });

  // نسخة أولى في التاريخ — لا يُحذف أبدًا (بند 28)
  await scriptVersions.create({
    scriptId: script.id,
    version: 1,
    text: script.text,
    title: script.title,
  });

  return script;
}

/** يحدّث سكريبتًا وينشئ نسخة جديدة في التاريخ. */
export async function updateScript(scriptId, { title, text, sceneType }) {
  const current = await scripts.get(scriptId);
  if (!current) throw new Error('السكريبت غير موجود');

  const version = (current.version || 1) + 1;
  const updated = await scripts.update(scriptId, {
    title: title ?? current.title,
    text: text ?? current.text,
    sceneType: sceneType ?? current.sceneType ?? null,
    version,
  });

  await scriptVersions.create({
    scriptId,
    version,
    text: updated.text,
    title: updated.title,
  });

  return updated;
}

/** يعيّن السكريبت الأساسي (واحد فقط لكل مشهد). */
export async function setPrimaryScript(sceneId, scriptId) {
  const list = await scripts.byIndex('sceneId', sceneId);
  for (const s of list) {
    const shouldBe = s.id === scriptId ? 1 : 0;
    if (s.isPrimary !== shouldBe) await scripts.update(s.id, { isPrimary: shouldBe });
  }
}

/* ============================================================
   المحادثة
   ============================================================ */

/** يعيد محادثة المشهد أو ينشئها. */
export async function ensureConversation(sceneId) {
  const existing = await conversations.oneByIndex('sceneId', sceneId);
  if (existing) return existing;
  return conversations.create({ sceneId, title: 'المحادثة الحقيقية' });
}

/** يضيف جزءًا للمحادثة. */
export async function addConversationPart(sceneId, { speaker, text, translation, isMine, personId = null }) {
  const conversation = await ensureConversation(sceneId);
  const parts = await conversationParts.byIndex('conversationId', conversation.id);
  const order = parts.reduce((max, p) => Math.max(max, p.order ?? 0), 0) + 1;

  return conversationParts.create({
    conversationId: conversation.id,
    sceneId,
    order,
    speaker: (speaker || '').trim() || (isMine ? 'أنا' : 'المتحدث'),
    isMine: isMine ? 1 : 0,
    text: (text || '').trim(),
    translation: (translation || '').trim(),
    // ⚠️ `speaker` و`personId` **ليسا بديلين**: الأوّل ما كتبتَه أنت
    //    وقتها، والثاني مَن نظنّه. يبقى الاثنان، فلو أخطأنا في النسبة
    //    ظلّ الأصل مكتوبًا (بند 107).
    personId: personId || null,
    audioMediaId: null,
    timestampMs: null,
    notes: '',
  });
}

/** أجزاء المحادثة مرتّبة. */
export async function listConversationParts(sceneId) {
  const parts = await conversationParts.byIndex('sceneId', sceneId);
  return parts
    .filter((p) => p.state === STATE.ACTIVE)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/* ============================================================
   خطأ / طبيعي
   ============================================================ */

export const MISTAKE_TYPES = [
  { id: 'grammar', label: 'قواعد' },
  { id: 'gender', label: 'جنس الكلمة' },
  { id: 'case', label: 'حالة إعرابية' },
  { id: 'word', label: 'اختيار كلمة' },
  { id: 'natural', label: 'صياغة غير طبيعية' },
  { id: 'other', label: 'أخرى' },
];

/** يضيف مقارنة خطأ/طبيعي. */
export async function addMistake(sceneId, { wrong, natural, explanation, mistakeType = 'other' }) {
  return mistakeComparisons.create({
    sceneId,
    wrong: (wrong || '').trim(),
    natural: (natural || '').trim(),
    explanation: (explanation || '').trim(),
    mistakeType,
    expressionId: null,
    wrongAudioId: null,
    naturalAudioId: null,
  });
}

/* ============================================================
   التعبيرات
   ============================================================ */

export const REGISTERS = [
  { id: 'professional', label: 'مهني', cls: 'pro' },
  { id: 'technical', label: 'تقني', cls: 'tech' },
  { id: 'daily', label: 'يومي', cls: 'daily' },
  { id: 'formal', label: 'رسمي', cls: 'pro' },
  { id: 'informal', label: 'عامّي', cls: 'daily' },
];

export function registerLabel(id) {
  return REGISTERS.find((r) => r.id === id)?.label || '';
}

export function registerClass(id) {
  return REGISTERS.find((r) => r.id === id)?.cls || '';
}

/* ------------------------------------------------------------------ *
 * منشأ الظهور *(بند 38)*
 * ------------------------------------------------------------------ */

/**
 * من أين جاء هذا الظهور.
 *
 * ⚠️ كان `sourceType` يُكتب `'manual'` **دائمًا ولكل ظهور**، و
 *    `sourceQuote` يُكتب `''` — بينما للنداءات الثلاثة منشأٌ مختلفٌ
 *    فعلًا. حقلٌ يُكتب ثابتًا هو حقلٌ ميّت، وهو سادس ما وُجد من هذا
 *    الصنف في هذه الجولة.
 *
 * ⚠️ ولا يُخمَّن منشأ: ظهورٌ لا نعرف من أين جاء يبقى `unknown` ويُقال
 *    ذلك في الشاشة. الظهورات المكتوبة قبل هذا التغيير كلها كذلك —
 *    كانت تقول «يدوي» وهي لا تعرف، ولا نُبقي على ادّعاءٍ لا سند له.
 */
export const EXPRESSION_SOURCE = Object.freeze({
  MANUAL: 'manual',
  IMPORT: 'import',
  SHADOW: 'shadow',
  UNKNOWN: 'unknown',
});

const SOURCE_LABEL = Object.freeze({
  [EXPRESSION_SOURCE.MANUAL]: 'كتبته بإيدك',
  [EXPRESSION_SOURCE.IMPORT]: 'جه مع مشهد مُجهَّز',
  [EXPRESSION_SOURCE.SHADOW]: 'التقطته وإنت بتتمرّن',
  [EXPRESSION_SOURCE.UNKNOWN]: 'مش معروف منين',
});

/** وسم المنشأ بالعربي — والمجهول يُقال ولا يُخفى. */
export function expressionSourceLabel(id) {
  return SOURCE_LABEL[id] || SOURCE_LABEL[EXPRESSION_SOURCE.UNKNOWN];
}

/**
 * يضيف تعبيرًا ويسجّل ظهوره في المشهد.
 * التعبير كيان عالمي واحد — لو موجود نربط ظهورًا جديدًا فقط.
 *
 * `source` منشأ الظهور: `{ type, id, quote }`. يُمرَّر من كل نداء —
 * فمن لم يمرّره لا يُنسَب إلى «يدوي» كذبًا بل إلى `unknown`.
 */
export async function addExpression(
  sceneId,
  { text, meaningAr, register = 'professional', note, source }
) {
  const clean = (text || '').trim();
  if (!clean) throw new Error('نص التعبير مطلوب');

  const normalized = normalize(clean);
  let expression = await expressions.oneByIndex('normalizedText', normalized);
  let isNew = false;

  if (!expression) {
    expression = await expressions.create({
      text: clean,
      normalizedText: normalized,
      meaningAr: (meaningAr || '').trim(),
      meaningEn: '',
      literal: '',
      explanation: (note || '').trim(),
      register,
      naturalness: null,
      masteryState: 'heard',
      language: 'ru',
    });
    isNew = true;
  } else if (meaningAr && !expression.meaningAr) {
    expression = await expressions.update(expression.id, { meaningAr: meaningAr.trim() });
  }

  const known = Object.values(EXPRESSION_SOURCE).includes(source?.type);
  await expressionOccurrences.create({
    expressionId: expression.id,
    sceneId,
    occurredAt: Date.now(),
    kind: 'appeared',
    // الاقتباس هو النصّ حول التعبير في مصدره — لا التعبير نفسه، وإلّا
    // كرّرناه في سطرين وأوهمنا بسياقٍ لا وجود له.
    sourceQuote: (source?.quote || '').trim(),
    sourceType: known ? source.type : EXPRESSION_SOURCE.UNKNOWN,
    sourceId: source?.id || null,
  });

  return { expression, isNew };
}

/** تعبيرات مشهد معيّن مع بيانات كل تعبير. */
export async function listSceneExpressions(sceneId) {
  const occurrences = (await expressionOccurrences.byIndex('sceneId', sceneId))
    // الظهور المُزال يختفي من هذه الذكرى وحدها؛ التعبير نفسه قد يظلّ
    // حيًّا في ذكريات أخرى.
    .filter((o) => o.state === STATE.ACTIVE);
  if (!occurrences.length) return [];

  const unique = [...new Set(occurrences.map((o) => o.expressionId))];
  const records = await expressions.getMany(unique);
  return records.filter(Boolean).filter((e) => e.state === STATE.ACTIVE);
}

/**
 * يشيل تعبيرًا من ذكرى بعينها.
 *
 * الحذف هنا يعني «ما ظهرش في اللحظة دي»، لا «امسح التعبير من حياتي».
 * فنُزيل ظهوره في هذه الذكرى فقط. وإن لم يبقَ له ظهورٌ في أيّ ذكرى،
 * يُنقل التعبير نفسه للسلة — لأن تعبيرًا بلا موطن لا معنى له.
 *
 * @returns {Promise<{ occurrenceIds: string[], trashedExpression: boolean }>}
 *          ما يلزم للتراجع
 */
export async function removeExpressionFromScene(sceneId, expressionId) {
  const here = (await expressionOccurrences.byIndex('sceneId', sceneId)).filter(
    (o) => o.expressionId === expressionId && o.state === STATE.ACTIVE
  );
  for (const occurrence of here) await expressionOccurrences.trash(occurrence.id);

  const remaining = (await expressionOccurrences.byIndex('expressionId', expressionId)).filter(
    (o) => o.state === STATE.ACTIVE
  );
  const trashedExpression = remaining.length === 0;
  if (trashedExpression) await expressions.trash(expressionId);

  return { occurrenceIds: here.map((o) => o.id), trashedExpression };
}

/** يتراجع عن `removeExpressionFromScene` بنفس ما أعادته. */
export async function undoRemoveExpression(expressionId, { occurrenceIds, trashedExpression }) {
  if (trashedExpression) await expressions.restore(expressionId);
  for (const id of occurrenceIds || []) await expressionOccurrences.restore(id);
}

/**
 * عدد المشاهد التي ظهر فيها تعبير — رقم قابل للإثبات بالنقر (بند 58).
 */
export async function expressionSceneCount(expressionId) {
  const occurrences = await expressionOccurrences.byIndex('expressionId', expressionId);
  return new Set(occurrences.map((o) => o.sceneId)).size;
}

/* ============================================================
   الملاحظات والنص الأصلي
   ============================================================ */

/** يقرأ كتلة نصّية بنوعها، أو ينشئها. */
/**
 * يقرأ كتلةً **بلا أن يُنشئها** — أو `null`.
 *
 * ⚠️ و`getBlock` أدناه **تكتب**: تُنشئ الكتلة إن لم تكن موجودة، لأن
 *    المحرِّر يحتاج معرّفًا يحفظ فيه. وهو سلوكٌ صحيحٌ هناك وخطأٌ في كل
 *    قراءةٍ أخرى — فبانَ حين بنى الجوازُ نفسه صفًّا في القاعدة وهو
 *    يُفترَض أنه لا يكتب (WS15). فمَن يقرأ ليعرض يستعمل هذه.
 */
export async function readBlock(sceneId, kind) {
  const blocks = await contentBlocks.byIndex('sceneId', sceneId);
  return blocks.find((row) => row.kind === kind) || null;
}

export async function getBlock(sceneId, kind) {
  const blocks = await contentBlocks.byIndex('sceneId', sceneId);
  const found = blocks.find((b) => b.kind === kind);
  if (found) return found;
  return contentBlocks.create({ sceneId, kind, text: '', version: 1, locked: 0 });
}

/**
 * يحفظ كتلة نصّية.
 * النص الأصلي (rawTranscript) محمي: لا يُستبدل بل تُنشأ كتلة مصحّحة منفصلة
 * (بند 27) — لذلك نمنع الكتابة عليه من هنا.
 */
export async function saveBlock(sceneId, kind, text) {
  const block = await getBlock(sceneId, kind);
  if (block.locked && block.text) {
    throw new Error('النص الأصلي محمي — أنشئ نسخة مصحّحة بدل تعديله');
  }
  return contentBlocks.update(block.id, { text });
}

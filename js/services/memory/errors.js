/**
 * LingoLife — ذاكرةُ الخطأ (WS-C، بنود ١٠…١٤ و٣٦…٣٩ و٥٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الغلطةُ ليست ورقةً تُمزَّق بعد التصحيح
 * ═══════════════════════════════════════════════════════════════
 *
 * البندُ ١٠ يجعلها ميزةً من الدرجة الأولى، وبند ٧١ يختم:
 *
 *     «والتصحيحُ لا يمحو الغلطة.»
 *
 * فالصورتان تعيشان معًا في صفٍّ واحد: `wrong` كما قلتَها، و`natural`
 * كما تُقال. ولا واحدةَ تكتب فوق الأخرى — لا عند الإنشاء ولا عند
 * التصحيح ولا عند الاستيراد.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وبيتُها قائمٌ منذ WS5 — ولم يُبنَ لها بيتٌ ثانٍ
 * ═══════════════════════════════════════════════════════════════
 *
 * `mistakeComparisons` هو الصفُّ نفسُه بمعناه نفسِه. والزيادةُ هنا
 * **حقولٌ اختياريّةٌ وفهارس** لا معمار — راجع الشرحَ فوق المخزن في
 * `schema.js`.
 *
 * ⚠️ **والتصنيفُ لا يُخمَّن** (بند ١١): التطبيقُ لا يعرف أن «заказчик»
 *    بدل «заказчиком» حالةُ آلة. فالنوعُ اختيارُك، و«غير محدَّد» جوابٌ
 *    مشروعٌ لا نقص.
 */

import { mistakeComparisons } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { canonical, patternKey, ORIGIN } from './identity.js';

/**
 * أنواعُ الخطأ — قابلةٌ للتوسعة، وتشمل ما كان في `MISTAKE_TYPES`.
 *
 * ⚠️ **والقديمُ يبقى مقروءًا**: الصفوفُ المكتوبةُ بـ`grammar` أو
 *    `natural` من WS5 لها مدخلٌ هنا، فلا يظهر صفٌّ قديمٌ بنوعٍ مجهول.
 */
export const ERROR_TYPES = Object.freeze([
  { id: 'pronunciation', label: 'نطق' },
  { id: 'stress', label: 'نبر' },
  { id: 'case', label: 'حالة إعرابية' },
  { id: 'ending', label: 'نهاية الكلمة' },
  { id: 'gender', label: 'جنس الكلمة' },
  { id: 'aspect', label: 'الوجه (تام/ناقص)' },
  { id: 'verb', label: 'الفعل' },
  { id: 'preposition', label: 'حرف الجرّ' },
  { id: 'word', label: 'اختيار كلمة' },
  { id: 'order', label: 'ترتيب الكلمات' },
  { id: 'agreement', label: 'مطابقة' },
  { id: 'omission', label: 'كلمة ناقصة' },
  { id: 'extra', label: 'كلمة زايدة' },
  { id: 'register', label: 'مستوى اللغة' },
  /* ─── من WS5، تبقى ليقرأها الصفُّ القديم ─── */
  { id: 'grammar', label: 'قواعد' },
  { id: 'natural', label: 'صياغة غير طبيعية' },
  { id: 'other', label: 'غير محدَّد' },
]);

export const ERROR_TYPE_LABEL = Object.fromEntries(ERROR_TYPES.map((t) => [t.id, t.label]));

/**
 * يسجّل غلطةً — **واقعةٌ منك، لا استنتاجٌ من التطبيق**.
 *
 * ⚠️ **ولا تُستنتَج الصورةُ الخاطئة أبدًا** (بند ٣٦): التطبيقُ لا يعرف
 *    ماذا قلتَ. فـ`wrong` مطلوبٌ صراحةً، وغيابُه يرفض التسجيل بدل أن
 *    يخترع.
 *
 * ⚠️ **و`occurredAt` وقتُ الغلطة لا وقتُ الكتابة** (بند ٢٩): افتراضُه
 *    الآن لأنك تسجّلها الآن، ويُمرَّر صراحةً لو كانت أقدم.
 *
 * ⚠️ **وكلُّ تسجيلٍ صفٌّ جديد** (بندا ١٢ و٣٩): غلطةٌ تتكرّر تُنتج صفًّا
 *    ثانيًا يجمعه `patternKey` بالأوّل — ولا يُزاد عدّادٌ في صفٍّ واحد،
 *    لأن ذلك يمحو **متى** وقعت كلُّ مرّة.
 */
export async function recordError({
  wrong, correct, type = 'other', note = '',
  occurredAt = null, sceneId = null, canonical: canon = null,
  sourceKind = null, sourceId = null, segmentId = null, sessionId = null,
  expressionId = null,
}) {
  const said = (wrong || '').trim();
  const right = (correct || '').trim();
  if (!said) throw new Error('اكتب اللي قلته الأوّل');
  if (!right) throw new Error('اكتب الصح');

  return mistakeComparisons.create({
    /* ⚠️ الاسمان من WS5 — نفسُ الحقلين لا حقلان جديدان بجانبهما. */
    wrong: said,
    natural: right,
    explanation: (note || '').trim(),
    mistakeType: type,
    sceneId,
    expressionId,
    wrongAudioId: null,
    naturalAudioId: null,
    /* ─── WS-C ─── */
    occurredAt: occurredAt ?? Date.now(),
    patternKey: patternKey(said, right),
    canonical: canon || canonical(right).split(' ')[0] || null,
    provenance: { sourceKind, sourceId, segmentId, sessionId },
    /* ⚠️ **الواقعةُ منك دائمًا** — والاستيرادُ لا يكتب واقعةً (بند ١٧). */
    origin: ORIGIN.USER,
  });
}

/** غلطاتٌ نشِطة، الأحدثُ أوّلًا. */
export async function listErrors({ limit = 200 } = {}) {
  const rows = await mistakeComparisons.getAll();
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => (b.occurredAt || b.createdAt || 0) - (a.occurredAt || a.createdAt || 0))
    .slice(0, limit);
}

/**
 * يجمع الغلطاتِ في **أنماط** (بندا ١٢ و٣٩).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولا يُدمَج شيئان لمجرّد أنهما يتشابهان
 * ═══════════════════════════════════════════════════════════════
 *
 * البندُ ١٢ صريح: «لا تدمج غلطتين مختلفتين لمجرّد أن سلسلتيهما تبدوان
 * متشابهتين». فالجمعُ **بالبصمة الحتميّة** وحدَها: نفسُ الخطأ ونفسُ
 * التصحيح بعد التطبيع.
 *
 * · «заказчик → заказчиком» مرّتين = نمطٌ واحدٌ بمرّتين. ✓
 * · «заказчик → заказчиком» و«клиент → клиентом» = **نمطان**، وإن
 *   كانت القاعدةُ النحويّةُ واحدة. فذلك حكمٌ لغويٌّ لا نملكه (بند ٦٨).
 *
 * ⚠️ **والصفوفُ تبقى مفردةً داخل النمط** (بند ٣٩): «وقعت ٣ مرّات»
 *    ومعها الثلاثةُ بتواريخها — فالتقدّمُ يُرى ولا يُمحى.
 */
export function groupByPattern(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.patternKey || patternKey(row.wrong, row.natural);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        patternKey: key,
        wrong: row.wrong,
        natural: row.natural,
        mistakeType: row.mistakeType,
        events: [],
      });
    }
    groups.get(key).events.push(row);
  }
  for (const group of groups.values()) {
    group.events.sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));
    group.times = group.events.length;
    group.firstAt = group.events[0]?.occurredAt ?? null;
    group.lastAt = group.events.at(-1)?.occurredAt ?? null;
  }
  return [...groups.values()].sort((a, b) => b.times - a.times || (b.lastAt || 0) - (a.lastAt || 0));
}

/**
 * ⚠️ **ولا حالةَ «أتقنتَها»** (بند ٣٩).
 *
 * البندُ يسمح بـ«تكرّرت» و«تتحسّن» و«لم تعد تظهر» — ويمنع «mastered».
 * والفرقُ ليس لفظيًّا: «لم تظهر منذ ٣ شهور» واقعةٌ يمكن التحقّق منها،
 * و«أتقنتَها» ادّعاءٌ عن رأسك لا يملكه التطبيق.
 */
export const PATTERN_STATE = Object.freeze({
  ONCE: 'once',
  REPEATED: 'repeated',
  QUIET: 'quiet',
});

export const PATTERN_LABEL = Object.freeze({
  [PATTERN_STATE.ONCE]: 'مرّة واحدة',
  [PATTERN_STATE.REPEATED]: 'اتكرّرت',
  [PATTERN_STATE.QUIET]: 'مظهرتش من فترة',
});

/** ثلاثةُ شهورٍ بالمللي — عتبةُ «مظهرتش من فترة». */
const QUIET_AFTER = 90 * 24 * 60 * 60 * 1000;

export function patternState(group, now = Date.now()) {
  if (!group?.times) return PATTERN_STATE.ONCE;
  if (group.lastAt && now - group.lastAt > QUIET_AFTER) return PATTERN_STATE.QUIET;
  return group.times > 1 ? PATTERN_STATE.REPEATED : PATTERN_STATE.ONCE;
}

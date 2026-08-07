/**
 * LingoLife — ربط الظلّ بالتحليل
 *
 * حين تحوي الجملة التي تتدرّب عليها تعبيرًا حلّلته من قبل، تظهر
 * علامة خفيفة. تفتحها فيُعرض ما تعرفه عن التعبير، وتغلقها فتكمل.
 *
 * ⚠️ **التحليل يخدم الظلّ لا يقاطعه** (بند 20 من المواصفة).
 *    لذلك درج لا صفحة: لا تغادر الجلسة ولا يضيع موضعك ولا إعداداتك.
 *
 * المطابقة تتمّ على النصّ المُطبَّع — فيلتقط التعبير وإن اختلف تشكيله
 * أو حالة أحرفه أو كُتب بـ «е» بدل «ё».
 */

import { expressions, expressionOccurrences } from '../../db/repositories.js';
import { normalize } from '../../utils/normalization.js';
import { STATE } from '../../db/schema.js';

/** كاش للجلسة الواحدة — لا نُعيد قراءة كل التعبيرات مع كل جملة. */
let cache = null;

/** يبني فهرس التعبيرات مرة واحدة عند فتح الظلّ. */
export async function loadExpressionIndex() {
  const rows = (await expressions.getAll()).filter((e) => e.state === STATE.ACTIVE);
  cache = rows
    .map((expression) => ({
      expression,
      normalized: expression.normalizedText || normalize(expression.text),
    }))
    // الأطول أولًا: «спасибо большое» تسبق «спасибо» فلا يبتلعها الأقصر.
    .sort((a, b) => b.normalized.length - a.normalized.length);
  return cache.length;
}

/** يحرّر الفهرس عند مغادرة الشاشة. */
export function clearExpressionIndex() {
  cache = null;
}

/**
 * يجد التعبيرات المحلَّلة الواردة في جملة.
 * @param {string} sentence
 * @returns {{ id: string, text: string, meaningAr: string, register: string }[]}
 */
export function expressionsIn(sentence) {
  if (!cache?.length || !sentence) return [];
  const haystack = normalize(sentence);
  const found = [];
  let consumed = haystack;

  for (const entry of cache) {
    if (!entry.normalized || entry.normalized.length < 3) continue;
    if (!consumed.includes(entry.normalized)) continue;
    found.push(entry.expression);
    // نستهلك المطابقة حتى لا يُبلَّغ عن تعبير داخل تعبير أطول.
    consumed = consumed.replace(entry.normalized, ' ');
  }

  return found;
}

/**
 * تفاصيل تعبير للعرض في الدرج — بأرقام قابلة للإثبات.
 * «ظهر في 7 مشاهد» تعني سبعة سجلّات ظهور حقيقية.
 */
export async function expressionDetail(expressionId) {
  const expression = await expressions.get(expressionId);
  if (!expression) return null;

  const occurrences = await expressionOccurrences.byIndex('expressionId', expressionId);
  const scenes = new Set(occurrences.map((o) => o.sceneId).filter(Boolean));

  return {
    ...expression,
    occurrenceCount: occurrences.length,
    sceneCount: scenes.size,
    firstSeenAt: occurrences.length
      ? Math.min(...occurrences.map((o) => o.occurredAt || o.createdAt))
      : null,
  };
}

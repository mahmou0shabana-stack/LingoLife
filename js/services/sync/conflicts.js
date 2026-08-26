/**
 * LingoLife — التعارضاتُ وحلُّها (WS-G · بنود ١٢ و١٩ و٢٥ و٢٨ و٣٩…٤١)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **البندُ الحامل: لا فقدانَ صامتًا أبدًا** (بند ٤١)
 * ═══════════════════════════════════════════════════════════════
 *
 * حين يكتب جهازان شيئين لا يجتمعان، **يبقى الاثنان** حتى تختار. لا
 * «الأحدثُ يغلب»، ولا فرعٌ يُسقَط، ولا كتابةٌ فوق كتابة.
 *
 * والثمنُ مصرَّحٌ به: خطّةٌ فيها تعارضٌ **لا تُطبَّق**. وهذا مقصود —
 * تطبيقٌ نصفيٌّ يترك جهازًا يظنّ أنه التقى وهو لم يلتقِ.
 *
 * ⚠️ **والتعارضُ كائنٌ لا نصُّ خطأ** (بند ٣٩): له نوعٌ ومعرِّفٌ ثابتٌ
 *    وطرفان موصوفان، فتستطيع شاشةٌ تُبنى غدًا أن تعرضه وتحلَّه بلا أن
 *    تقرأ نصًّا عربيًّا وتحلّله.
 */

/** أنواعُ التعارض — مغلقةٌ عمدًا، و`UNKNOWN` بابُ صدقٍ لا بابُ كسل. */
export const CONFLICT = Object.freeze({
  /** حقلٌ واحدٌ غيّره الجهازان إلى قيمتين (بند ١٢). */
  FIELD: 'FIELD_CONFLICT',
  /** جهازٌ حذف وآخرُ عدّل (بند ١٩). */
  DELETE_EDIT: 'DELETE_EDIT',
  /** نُقلت العقدةُ إلى أبوين مختلفين (بند ٢٨). */
  TREE_MOVE: 'TREE_MOVE',
  /** أُعيد ترتيبُ الأشقّاء على الجهازين معًا (بندا ٢٥ و٦٠). */
  TREE_ORDER: 'TREE_ORDER',
  /** كيانٌ بمفتاحٍ طبيعيٍّ واحدٍ ومعرِّفين — يحتاج قرارًا حين يختلف محتواه. */
  UNIQUE_ENTITY: 'UNIQUE_ENTITY',
  /** حُذفت الحافّةُ هنا وعُدِّلت بياناتُها هناك (بند ٢٤). */
  RELATIONSHIP_METADATA: 'RELATIONSHIP_METADATA',
  /** وصفُ وسيطٍ بلا بايتاتٍ محلّيّة (بند ٣١). */
  BLOB_MISSING: 'BLOB_MISSING',
  UNKNOWN: 'UNKNOWN',
});

/** قراراتُ الحلّ (بند ٤٠). */
export const RESOLUTION = Object.freeze({
  USE_LOCAL: 'USE_LOCAL',
  USE_REMOTE: 'USE_REMOTE',
  /** قيمةٌ ثالثةٌ يكتبها الإنسان — لتعارض النصوص (بند ١٣). */
  MANUAL_VALUE: 'MANUAL_VALUE',
  /** لتعارض الحذف/التعديل وحده. */
  KEEP_DELETE: 'KEEP_DELETE',
  KEEP_EDIT: 'KEEP_EDIT',
});

/** أيُّ القرارات مقبولٌ لأيّ نوع — فلا يُحلّ حذفٌ بـ«استعمل المحلّيّ». */
const ALLOWED = Object.freeze({
  [CONFLICT.FIELD]: [RESOLUTION.USE_LOCAL, RESOLUTION.USE_REMOTE, RESOLUTION.MANUAL_VALUE],
  [CONFLICT.DELETE_EDIT]: [RESOLUTION.KEEP_DELETE, RESOLUTION.KEEP_EDIT],
  [CONFLICT.TREE_MOVE]: [RESOLUTION.USE_LOCAL, RESOLUTION.USE_REMOTE],
  [CONFLICT.TREE_ORDER]: [RESOLUTION.USE_LOCAL, RESOLUTION.USE_REMOTE],
  [CONFLICT.UNIQUE_ENTITY]: [RESOLUTION.USE_LOCAL, RESOLUTION.USE_REMOTE, RESOLUTION.MANUAL_VALUE],
  [CONFLICT.RELATIONSHIP_METADATA]: [RESOLUTION.KEEP_DELETE, RESOLUTION.KEEP_EDIT],
  [CONFLICT.BLOB_MISSING]: [],
  [CONFLICT.UNKNOWN]: [],
});

/**
 * ينشئ تعارضًا.
 *
 * ⚠️ **والمعرِّفُ حتميٌّ من مكانه لا عشوائيّ**: تخطيطُ نفسِ الحزمة
 *    مرّتين يعطي نفسَ المعرِّفات، فشاشةٌ فُتحت وأُغلقت ثم أُعيد التخطيط
 *    لا تفقد ما اخترتَه.
 */
export function makeConflict({
  type, store, recordId, field = null, label = '',
  local = null, remote = null, base = null, extra = null, blocking = true,
}) {
  return {
    id: `${type}|${store}|${recordId}|${field ?? ''}`,
    type,
    store,
    recordId,
    field,
    label,
    local,
    remote,
    base,
    extra,
    blocking,
    resolution: null,
    resolvedValue: undefined,
  };
}

/** طرفٌ في تعارض — قيمةٌ ومَن كتبها ومتى وبأيّ إصدار. */
export function side({ value, device = null, rev = null, at = null, note = '' }) {
  return { value, device, rev, at, note };
}

/**
 * يحلّ تعارضًا داخل خطّة.
 *
 * ⚠️ **ولا يكتب في القاعدة** — يعلّم الخطّةَ وحدها. الكتابةُ خطوةٌ
 *    واحدةٌ لاحقةٌ لكلّ شيء (بندا ٣٦ و٤٨).
 *
 * @param {object} plan
 * @param {string} conflictId
 * @param {string} resolution — من `RESOLUTION`
 * @param {*} [value] — مع `MANUAL_VALUE` وحدها
 */
export function resolveConflict(plan, conflictId, resolution, value) {
  const conflict = plan?.conflicts?.find((c) => c.id === conflictId);
  if (!conflict) throw new Error(`تعارضٌ غير موجود: ${conflictId}`);

  const allowed = ALLOWED[conflict.type] || [];
  if (!allowed.includes(resolution)) {
    throw new Error(
      `قرارٌ لا يصلح لهذا النوع: ${resolution} على ${conflict.type} — المقبول: ${allowed.join(' أو ') || 'لا شيء'}`
    );
  }
  if (resolution === RESOLUTION.MANUAL_VALUE && value === undefined) {
    throw new Error('قيمةٌ يدويّةٌ بلا قيمة');
  }

  conflict.resolution = resolution;
  conflict.resolvedValue = resolution === RESOLUTION.MANUAL_VALUE ? value : undefined;
  return conflict;
}

/** التعارضاتُ الحاجزةُ التي لم تُحلّ بعد. */
export function unresolved(plan) {
  return (plan?.conflicts || []).filter((c) => c.blocking && !c.resolution);
}

/** هل صارت الخطّةُ قابلةً للتطبيق؟ */
export function applicable(plan) {
  return Boolean(plan?.ok) && unresolved(plan).length === 0;
}

/**
 * عرضٌ بشريٌّ مضغوط (بند ٧٢) — أرقامٌ تُقرأ بلا فتح الخطّة.
 *
 * ⚠️ **ولا يُعرَض «تغييراتٌ: ٢٣»** وحدَها: الفعلُ يفترق عن الفعل.
 *    «هيتضاف» غيرُ «هيتحدّث» غيرُ «اتحذف»، ومن يقرأ يقرّر على أساس
 *    الفرق لا على أساس المجموع.
 */
export function planSummary(plan) {
  return {
    added: plan.creates.length + plan.relationshipAdds.length,
    updated: plan.updates.length,
    deleted: plan.deletes.length + plan.relationshipRemoves.length,
    coalesced: plan.entityCoalesces.length + plan.relationshipCoalesces.length,
    conflicts: (plan.conflicts || []).filter((c) => c.blocking).length,
    unresolved: unresolved(plan).length,
    rebuilds: plan.derivedRebuilds.length,
    blobNeeds: plan.blobNeeds.length,
    noops: plan.noops.length,
  };
}

/** نصٌّ عربيٌّ قصيرٌ للسطر الواحد — يقرؤه المطوّر والتقرير. */
export function summaryLine(plan) {
  const s = planSummary(plan);
  return [
    `هيتضاف: ${s.added}`,
    `هيتحدّث تلقائي: ${s.updated}`,
    `اتحذف: ${s.deleted}`,
    s.coalesced ? `اتدمج: ${s.coalesced}` : null,
    `تعارضات محتاجة اختيارك: ${s.conflicts}`,
  ].filter(Boolean).join(' · ');
}

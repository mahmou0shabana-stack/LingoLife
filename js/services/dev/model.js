/**
 * LingoLife — مختبر التطوّر: النموذج
 *
 * ═══════════════════════════════════════════════════════════════
 * ما هذا، وما ليس هو
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا **نظامٌ لإدارة تطوير LingoLife نفسه**، لا لوحةَ مؤشّرات.
 *
 * والفرق ليس في الشكل بل في اتّجاه السببيّة: لوحةُ المؤشّرات تبدأ من
 * رقمٍ تريد عرضه ثم تبحث عمّا يملؤه. وهذا يبدأ من **سؤالٍ تسأله
 * بالفعل** ثم يسجّل ما يجيب عنه.
 *
 * والأسئلة العشرة التي بُني عليها كلُّ حقلٍ هنا:
 *
 *   ١. إيه اللي عايز أطوّره؟            → `title` + `body`
 *   ٢. الملاحظة فين؟                    → `route` + `featureId`
 *   ٣. بتشير لأنهي جزء؟                 → لقطة + `region`
 *   ٤. جديدة ولا مرتبطة بحاجة قديمة؟    → البحث عن الشبيه قبل الإنشاء
 *   ٥. حالتها إيه دلوقتي؟               → `status`
 *   ٦. واقفة ليه؟                       → `blockedReason` + `blockedNote`
 *   ٧. بدأت إمتى؟                       → `createdAt`
 *   ٨. خلصت إمتى؟                       → `resolvedAt`
 *   ٩. اتغيّر إيه فعلًا؟                 → `resolutionNote` + لقطة «بعد»
 *  ١٠. إيه اللي لسه مفتوح؟              → عدٌّ من الحالات، لا تقدير
 *
 * ⚠️ **ولا حقلَ هنا بلا سؤالٍ يجيب عنه.** هذا المشروع دفن سبعة حقولٍ
 *    ميّتة قبل اليوم (`peopleIds`، `caption`، `masteryState`،
 *    `sourceType`، `topicIds`، `journeyId`، `rawTranscript`) — كلُّها
 *    كُتبت «للمستقبل» ثم لم يقرأها أحد. فما لا يُقرَأ لا يُكتَب.
 *
 * ⚠️ **والعضويّة في الـBrief علاقةٌ لا حقل** *(docs/03 §3.6.1)* — نفس
 *    اصطلاح `thread:scene` و`scene:person`. فحذفُ Brief لا يُعيد كتابة
 *    ملاحظاته، والملاحظة تبقى قائمةً بذاتها.
 */

import { membershipKind } from '../link-service.js';

/* ------------------------------------------------------------------ *
 * الحالات
 * ------------------------------------------------------------------ */

/**
 * الحالات التسع.
 *
 * ⚠️ **ولا حالةَ «مؤرشَف» هنا.** الحالة تصف موضع الملاحظة من العمل،
 *    و`STATE` في القاعدة يصف وجودها. خلطُهما يجعل «محلولة» و«محذوفة»
 *    شيئًا واحدًا — والتاريخ يضيع.
 */
export const STATUS = Object.freeze({
  IDEA: 'idea',
  OPEN: 'open',
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  NEEDS_REVIEW: 'needs_review',
  RESOLVED: 'resolved',
  DEFERRED: 'deferred',
  REJECTED: 'rejected',
});

/**
 * كل حالةٍ بوسمها العربيّ، وبما تعنيه — لأن «Planned» و«Deferred»
 * يبدوان متقاربين وهما ليسا كذلك.
 */
export const STATUS_META = Object.freeze({
  [STATUS.IDEA]: {
    label: 'فكرة', tone: 'idea',
    hint: 'خاطر لسه ما اتقررش. مش التزام ولا وعد.',
  },
  [STATUS.OPEN]: {
    label: 'مفتوحة', tone: 'open',
    hint: 'ملاحظة حقيقية مستنية دورها.',
  },
  [STATUS.PLANNED]: {
    label: 'متخطّطة', tone: 'planned',
    hint: 'اتقرر إنها هتتعمل — لسه ما بدأتش.',
  },
  [STATUS.IN_PROGRESS]: {
    label: 'شغّالة', tone: 'progress',
    hint: 'الشغل فيها بدأ فعلًا.',
  },
  [STATUS.BLOCKED]: {
    label: 'واقفة', tone: 'blocked',
    hint: 'مش قادرة تكمل — ولازم يكون فيه سبب مكتوب.',
  },
  [STATUS.NEEDS_REVIEW]: {
    label: 'محتاجة مراجعة', tone: 'review',
    hint: 'اتعملت، ومستنية إنك تبصّ وتقول تمام.',
  },
  [STATUS.RESOLVED]: {
    label: 'اتحلّت', tone: 'resolved',
    hint: 'خلصت — ومعاها مكتوب إيه اللي اتعمل.',
  },
  [STATUS.DEFERRED]: {
    label: 'مؤجَّلة', tone: 'deferred',
    hint: 'قرار تأجيل مش نسيان. ليها سبب وبتفضل في التاريخ.',
  },
  [STATUS.REJECTED]: {
    label: 'مرفوضة', tone: 'rejected',
    hint: 'قرّرت إنها مش هتتعمل. بتفضل عشان ما تتسألش تاني.',
  },
});

/** الحالات التي تُعَدّ «مفتوحة» — أي لم تُغلَق بقرار. */
export const OPEN_STATUSES = Object.freeze([
  STATUS.IDEA, STATUS.OPEN, STATUS.PLANNED,
  STATUS.IN_PROGRESS, STATUS.BLOCKED, STATUS.NEEDS_REVIEW,
]);

/** الحالات المغلقة بقرار — لا تُحذف أبدًا، هي التاريخ نفسه. */
export const CLOSED_STATUSES = Object.freeze([
  STATUS.RESOLVED, STATUS.DEFERRED, STATUS.REJECTED,
]);

/**
 * ترتيب العرض في اللوحة — بترتيب ما يستدعي انتباهك، لا أبجديًّا.
 *
 * الواقف أوّلًا لأنه لا يتحرّك وحده، ثم ما ينتظر نظرتَك، ثم الشغّال.
 */
export const BOARD_ORDER = Object.freeze([
  STATUS.BLOCKED, STATUS.NEEDS_REVIEW, STATUS.IN_PROGRESS,
  STATUS.OPEN, STATUS.PLANNED, STATUS.IDEA,
  STATUS.RESOLVED, STATUS.DEFERRED, STATUS.REJECTED,
]);

/* ------------------------------------------------------------------ *
 * أسباب التوقّف
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **«واقفة» بلا سبب ليست حالة — هي نسيان.**
 *
 * بعد شهرين تفتح اللوحة فترى سبعًا واقفة ولا تعرف أيَّها ينتظرك أنت
 * وأيَّها ينتظر شيئًا آخر. فالسبب **إلزاميّ** عند الانتقال إلى
 * `BLOCKED` — وخدمةُ الحالة ترفض بدونه.
 */
export const BLOCKED_REASON = Object.freeze({
  ARCHITECTURE: 'architecture',
  DEPENDENCY: 'dependency',
  API: 'api',
  DEVICE: 'device',
  PRODUCT: 'product',
  TECHNICAL: 'technical',
  OTHER: 'other',
});

export const BLOCKED_REASON_META = Object.freeze({
  [BLOCKED_REASON.ARCHITECTURE]: {
    label: 'محتاجة قرار معماري',
    hint: 'البنية الحالية ما تستوعبش ده، ولازم قرار قبل الكود.',
  },
  [BLOCKED_REASON.DEPENDENCY]: {
    label: 'مستنية حاجة تانية',
    hint: 'فيه شغل تاني لازم يخلص الأول.',
  },
  [BLOCKED_REASON.API]: {
    label: 'محتاجة API أو خدمة برّه',
    hint: 'مش متاح جوّه التطبيق دلوقتي.',
  },
  [BLOCKED_REASON.DEVICE]: {
    label: 'محتاجة تجربة على الجهاز',
    hint: 'مش هينفع يتأكّد غير على التابلت نفسه.',
  },
  [BLOCKED_REASON.PRODUCT]: {
    label: 'مستنية قرارك إنت',
    hint: 'مش مشكلة تقنية — محتاجة تقرر عايز إيه.',
  },
  [BLOCKED_REASON.TECHNICAL]: {
    label: 'عائق تقني',
    hint: 'المشكلة في التنفيذ نفسه.',
  },
  [BLOCKED_REASON.OTHER]: {
    label: 'سبب تاني',
    hint: 'اكتبه بنفسك تحت.',
  },
});

/* ------------------------------------------------------------------ *
 * الأولويّة
 * ------------------------------------------------------------------ */

export const PRIORITY = Object.freeze({ LOW: 'low', NORMAL: 'normal', HIGH: 'high' });

export const PRIORITY_META = Object.freeze({
  [PRIORITY.LOW]: { label: 'على مهلك', rank: 0 },
  [PRIORITY.NORMAL]: { label: 'عادي', rank: 1 },
  [PRIORITY.HIGH]: { label: 'مهمّ', rank: 2 },
});

/* ------------------------------------------------------------------ *
 * أحداث الخطّ الزمني
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **ولا ضجيج.** كل حدثٍ هنا يجيب عن سؤالٍ ستسأله بعد شهور. وما
 *    لا يُسأل عنه لا يُسجَّل: فتحُ الشاشة، والتمرير، وتعديلُ حرفٍ في
 *    العنوان — كلها أشياءُ تُغرِق التاريخ ولا تقول شيئًا.
 */
export const EVENT = Object.freeze({
  CREATED: 'created',
  STATUS: 'status_changed',
  COMMENT: 'comment_added',
  SHOT: 'screenshot_added',
  BRIEF: 'moved_to_brief',
  BLOCKED: 'blocked',
  RESOLVED: 'resolved',
  REOPENED: 'reopened',
});

export const EVENT_LABEL = Object.freeze({
  [EVENT.CREATED]: 'اتعملت',
  [EVENT.STATUS]: 'الحالة اتغيّرت',
  [EVENT.COMMENT]: 'تعليق اتضاف',
  [EVENT.SHOT]: 'صورة اتضافت',
  [EVENT.BRIEF]: 'اتنقلت لـBrief',
  [EVENT.BLOCKED]: 'وقفت',
  [EVENT.RESOLVED]: 'اتحلّت',
  [EVENT.REOPENED]: 'اتفتحت تاني',
});

/* ------------------------------------------------------------------ *
 * الملاحظة فين — المسار والميزة
 * ------------------------------------------------------------------ */

/**
 * الميزة تُشتقّ من **نمط المسار** لا من المسار نفسه.
 *
 * ⚠️ `/scene/SC_a1b2` و`/scene/SC_c3d4` ملاحظتان على **نفس الشاشة**.
 *    وحفظُ المسار الحرفيّ يجعلهما مجموعتين منفصلتين، فيصير سؤال
 *    «أنهي شاشة عليها أكتر ملاحظات؟» بلا إجابة.
 *
 * والنمط يأتي جاهزًا من الموجِّه (`getCurrentRoute().pattern`)، فلا
 * يُخمَّن هنا.
 */
export const FEATURES = Object.freeze([
  { id: 'now', label: 'دلوقتي', routes: ['/'] },
  { id: 'life', label: 'حياتي والذكرى', routes: ['/life', '/scene/:id', '/day/:date'] },
  { id: 'shadow', label: 'الظلّ', routes: ['/shadow/:id'] },
  { id: 'language', label: 'لغتي', routes: ['/language', '/expression/:id', '/word/:text'] },
  { id: 'atlas', label: 'الأطلس', routes: ['/river', '/facets', '/constellation'] },
  { id: 'analysis', label: 'التحليل', routes: ['/analysis'] },
  { id: 'threads', label: 'القصص', routes: ['/threads', '/thread/:id'] },
  { id: 'studio', label: 'استوديو الإثراء', routes: ['/studio'] },
  { id: 'import', label: 'الاستيراد', routes: ['/import'] },
  { id: 'search', label: 'البحث', routes: ['/search'] },
  { id: 'trash', label: 'السلة', routes: ['/trash'] },
  { id: 'settings', label: 'الإعدادات', routes: ['/settings'] },
  { id: 'dev', label: 'مختبر التطوّر', routes: ['/dev', '/dev/issue/:id', '/dev/brief/:id'] },
]);

const ROUTE_TO_FEATURE = new Map();
for (const feature of FEATURES) {
  for (const route of feature.routes) ROUTE_TO_FEATURE.set(route, feature.id);
}

/** معرّف الميزة من نمط المسار — أو `other` معلَنًا لا مخمَّنًا. */
export function featureOf(routePattern) {
  return ROUTE_TO_FEATURE.get(routePattern) || 'other';
}

export function featureLabel(id) {
  if (id === 'other') return 'مكان تاني';
  return FEATURES.find((row) => row.id === id)?.label || id;
}

/* ------------------------------------------------------------------ *
 * العضويّة
 * ------------------------------------------------------------------ */

/**
 * عضويّة الملاحظة في الـBrief — نفس اصطلاح `thread:scene`.
 *
 * ⚠️ الـBrief حاوٍ (`fromId`) والملاحظة عضو (`toId`). وحذفُ Brief لا
 *    يمسّ ملاحظاته: تعود ملاحظاتٍ مستقلّة، لا صفوفًا يتيمة تشير إلى
 *    حاوٍ غير موجود.
 */
export const BRIEF_ISSUE = membershipKind('brief', 'issue');

/* ------------------------------------------------------------------ *
 * ما ليس مؤشّرًا — وما لن يُعرَض
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **أرقامٌ مرفوضةٌ بقرار، ولكلٍّ سببه.**
 *
 * على نفس مبدأ `NOT_SUPPORTED` (الاستيراد) و`ABSENT_AXES` (الأطلس) و
 * `UNBUILT` (اللغة) و`NOT_MEASURED` (التحليل) و`NOT_BULK_EDITABLE`
 * (الاستوديو): ما نرفض عرضه يُقال **بسببه**.
 *
 * والرفض هنا ليس تواضعًا. رقمٌ كهذا يُغيّر قراراتك فعلًا: ترى «صحّة
 * التطوير ٧٨٪» فتطمئنّ، والرقم مؤلَّفٌ من مقامٍ لا وجود له.
 *
 * واختبارٌ يمنع دخول مدخلٍ هنا بلا سبب مكتوب.
 */
export const NOT_A_METRIC = Object.freeze({
  productivityScore: {
    label: 'Productivity Score',
    reason: 'مقياس إنتاجية يعني إن فيه معدّل «طبيعي» نقيس عليه. مفيش. وملاحظة واحدة كبيرة ممكن تساوي عشرين صغيرة، فالعدّ نفسه مش وحدة قياس',
  },
  healthPercent: {
    label: 'Development Health %',
    reason: 'نسبة محتاجة مقام. مقام إيه — كل الملاحظات اللي ممكن تتكتب؟ ده رقم مش موجود، فالنسبة مؤلَّفة',
  },
  innovationScore: {
    label: 'Innovation Score',
    reason: 'مفيش أي بيانات تحت ده. ولا حتى تعريف يتّفق عليه اتنين',
  },
  completionPercent: {
    label: 'Completion % عامّ',
    reason: 'الإكمال بالنسبة لإيه؟ مفيش قايمة نهائية للشغل، وكل ملاحظة محلولة بتفتح باب لتانية. النسبة هتقول ٩٠٪ وإنت في نصّ الطريق',
  },
  velocity: {
    label: 'Velocity / سرعة التطوير',
    reason: 'بيفترض إن الملاحظات متساوية الحجم. مش متساوية، ومفيش تقدير حجم مكتوب — فالرقم بيقيس عدد مش شغل',
  },
  aiProgress: {
    label: 'أي «تقدّم» مولَّد',
    reason: 'أي رقم مش مشتقّ من السجلات اللي تحت بيبقى تخمين لابس شكل حقيقة. والقاعدة في المشروع ده: كل رقم تحته سجلات تقدر تفتحها',
  },
});

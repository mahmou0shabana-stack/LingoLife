/**
 * LingoLife — صيغة حزمة المشهد المُجهَّز
 *
 * المسار الحقيقي الذي تعيشه:
 *
 *   تفريغ/صوت/صور/ملاحظات → ذكاء خارجي → **حزمة** → معاينة → استيراد
 *
 * لا أن تُعيد إدخال ثمانيَ عشرة تعبيرًا واثنتي عشرة جملة محادثة بيدك
 * واحدةً واحدة (بند 33).
 *
 * ═══════════════════════════════════════════════════════════════
 * مبدآن يحكمان هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * **١. كريمون فيما نقبل، صارمون فيما نلتزم به.**
 *
 * مُخرَج الذكاء الخارجي لا يأتي بصيغةٍ واحدة: مرّةً `scene.title`
 * ومرّةً `scene.titleAr`، ومرّةً التاريخ `2026-04-01` ومرّةً طابعٌ
 * رقمي. فالقراءة تتسامح مع الأشكال المعروفة — **والكتابة لا تتسامح
 * أبدًا**: ما لا نفهمه يُرفَض بسببٍ مكتوب، ولا يُخمَّن.
 *
 * **٢. ما لا يستوعبه التطبيق يُعلَن، ولا يُبتلَع صامتًا.**
 *
 * المواصفة (بند 34) تعدّ اثنين وعشرين نوعًا في الحزمة. والتطبيق اليوم
 * يمثّل سبعةً منها تمثيلًا حقيقيًّا — له شاشةٌ تعرضها وخدمةٌ تكتبها.
 * والباقي إمّا مستودعٌ بلا خدمة، أو ميزةٌ لم تُبنَ، أو قرارٌ مؤجَّل.
 *
 * فاستيراده يعني **كتابة بيانات لا يعرضها شيء** — وهو أسوأ من عدم
 * استيرادها: تظنّ أنها وصلت وهي في العدم. القائمة أدناه تُعلن ذلك
 * صراحةً، والمعاينة تعرضه قبل أن تضغط «استورد» (بند 89).
 */

/**
 * إصدار صيغة الحزمة.
 *
 * ⚠️ منفصلٌ عن `SCHEMA_VERSION` عمدًا — كما في صيغة النسخ الاحتياطي:
 *    الحزمة عقدٌ مع **مُنتِجٍ خارجي** لا يعرف شيئًا عن قاعدتك ولا
 *    يتابع ترقياتها.
 */
export const PACKAGE_FORMAT_VERSION = 1;

/**
 * ما يُستورَد فعلًا — لكلٍّ خدمةٌ تكتبه وشاشةٌ تعرضه.
 *
 * `order` هو ترتيب التنفيذ: ما يُشار إليه يُنشَأ قبل مَن يشير إليه.
 */
export const SUPPORTED = Object.freeze({
  scene: { label: 'الذكرى', order: 1, unit: 'ذكرى' },
  people: { label: 'الأشخاص', order: 2, unit: 'شخص' },
  eventThread: { label: 'الخيط', order: 3, unit: 'خيط' },
  scripts: { label: 'السكريبتات', order: 4, unit: 'سكريبت' },
  conversationParts: { label: 'أجزاء المحادثة', order: 5, unit: 'جزء' },
  mistakes: { label: 'التصحيحات', order: 6, unit: 'تصحيح' },
  expressions: { label: 'التعبيرات', order: 7, unit: 'تعبير' },
});

/**
 * ما **لا** يُستورَد اليوم، ولكلٍّ سببه.
 *
 * ⚠️ هذه ليست قائمةَ إهمال بل **إقرارٌ صريح** — كما في
 *    `NOT_TRASHABLE` و`EXCLUDED_STORES`. والاختبار يقارن بها: كل نوعٍ
 *    في المواصفة إمّا مدعوم وإمّا هنا بسببٍ مكتوب. لا ثالث.
 */
export const NOT_SUPPORTED = Object.freeze({
  media: 'الصور والأصوات ملفّات لا نصّ — تُضاف من الذكرى بعد الاستيراد',
  mediaRoles: 'تتبع الوسائط',
  words: 'مستودعٌ بلا شاشة تعرضه — استيراده كتابةٌ في العدم',
  sentencePatterns: 'مستودعٌ بلا شاشة تعرضه',
  colloquialLanguage: 'اللغة المنطوقة الحقيقية لم تُبنَ بعد كمجال مستقلّ (بنود 38–40)',
  formalLanguage: 'اللغة الرسميّة كمجال مستقلّ لم تُبنَ بعد (بنود 38–40)',
  professionalLanguage: 'لغة المهنة كمجال مستقلّ لم تُبنَ بعد (بنود 38–40)',
  topics: 'مستودعٌ بلا خدمة — والموضوع يُكتب في سياق الذكرى اليوم',
  journeys: 'مستودعٌ بلا خدمة',
  projects: 'قرارُ منتَجٍ مؤجَّل عمدًا — راجع docs/06',
  reviewSuggestions: 'جدولة المراجعة لم تُبنَ بعد',
  analysisMetadata: 'يُحفظ في تقرير الاستيراد لا كبياناتٍ في القاعدة',
  relationships: 'العلاقات بين المشاهد تحتاج مشهدًا آخر موجودًا — تُربَط يدويًّا بعد الاستيراد',
});

/** الأماكن تُكتب في `scene.placeName` لا ككيان — فليست مرفوضة ولا كاملة. */
export const PARTIAL = Object.freeze({
  places: 'يُؤخَذ الاسم في حقل مكان الذكرى؛ المكان ليس كيانًا بعد',
  translations: 'تُؤخَذ مع السكريبت وجزء المحادثة، لا ككيان مستقلّ',
  eventType: 'يُطابَق بنوعٍ عندك أو يُنشَأ — راجع حلّ التكرار',
});

/**
 * الحقول المطلوبة لكل نوع مدعوم.
 * ما ينقصه مطلوبٌ **يُرفَض بسببه** ولا يُخمَّن.
 */
export const REQUIRED = Object.freeze({
  scene: ['title'],
  people: ['name'],
  eventThread: ['title'],
  scripts: ['text'],
  conversationParts: ['text'],
  mistakes: ['wrong', 'natural'],
  expressions: ['text'],
});

/**
 * كل حقلٍ يقرؤه `parse.js` فعلًا — بالاسم القانونيّ ومعه وصفٌ
 * إنجليزيّ **موجَّهٌ للمحلِّل الخارجي**.
 *
 * ⚠️ **ولماذا يعيش هذا هنا لا في نصّ الطلب؟** (الملحق · H5)
 *
 * كان شكلُ الردّ مكتوبًا بيدٍ في `analysis/request.js`: نسخةٌ ثانيةٌ
 * من العقد في ملفٍّ آخر. فأيُّ حقلٍ يُضاف هنا غدًا لا يعرفه الطلب،
 * وأيُّ حقلٍ يُطلَب هناك لا يقرؤه المحلِّل — **والانحرافُ صامت**:
 * المحلِّل يردّ بما طُلب منه، والقارئ يتجاهله، ولا أحدَ يشتكي.
 *
 * فصار الطلب **يُولَّد من هذا الجدول**، واختبارُ ذهابٍ وعودة يبني
 * حزمةً من الشكل المولَّد ويطالب `parsePackage` بأن تقرأ كل حقلٍ فيها.
 * فحقلٌ يُضاف هنا بلا قارئٍ — أو يُقرأ بلا أن يُذكَر — **يُسقط
 * الاختبار**.
 *
 * `req` يعني مطلوبًا، وهو مشتقٌّ من `REQUIRED` ويُحرَس بأن يطابقها.
 */
export const FIELDS = Object.freeze({
  scene: [
    { name: 'title', req: true, hint: 'short Arabic title for the situation' },
    { name: 'titleRu', hint: 'the same title in Russian, if natural' },
    { name: 'date', hint: 'YYYY-MM-DD, only if the material states it' },
    { name: 'placeName', hint: 'where it happened, as plain text' },
    { name: 'eventType', hint: 'kind of situation: meeting, call, inspection…' },
  ],
  people: [
    /*
     * ⚠️ الاسم القانونيّ هنا `name` لا `speaker` — وإن كان القارئ يقبل
     *    الاثنين. `REQUIRED.people` تقول `name`، واختلافُ الجدولين كان
     *    يعني أن يُطلَب مفتاحٌ ويُعلَن غيرُه إلزاميًّا. أظهره اختبارُ
     *    المطابقة بينهما.
     */
    { name: 'name', req: true, hint: 'the person name as it appears' },
    { name: 'nameRu', hint: 'their name in Russian' },
    { name: 'role', hint: 'their role in THIS situation, not their job title' },
    { name: 'company', hint: 'organization, if mentioned' },
    { name: 'isMe', hint: 'true only for the learner themselves' },
  ],
  eventThread: [
    { name: 'title', req: true, hint: 'the ongoing story this belongs to' },
    { name: 'description', hint: 'one line about the story' },
    { name: 'status', hint: 'active | waiting | done' },
  ],
  scripts: [
    { name: 'text', req: true, hint: 'Russian text the learner could rehearse' },
    { name: 'title', hint: 'what this script is for' },
    { name: 'translation', hint: 'Egyptian Arabic translation' },
  ],
  conversationParts: [
    { name: 'text', req: true, hint: 'exactly what was said, in Russian' },
    { name: 'speaker', hint: 'who said it' },
    { name: 'translation', hint: 'Egyptian Arabic translation' },
    { name: 'isMe', hint: 'true when the learner said it' },
  ],
  mistakes: [
    { name: 'wrong', req: true, hint: 'what they actually said' },
    { name: 'natural', req: true, hint: 'what a native would say instead' },
    { name: 'mistakeType', hint: 'grammar | gender | case | word | natural | other' },
    { name: 'note', hint: 'Egyptian Arabic explanation of the difference' },
  ],
  expressions: [
    { name: 'text', req: true, hint: 'the Russian expression, exactly as used' },
    { name: 'meaningAr', hint: 'what it means, in Egyptian Arabic' },
    { name: 'register', hint: 'professional | technical | daily | formal | informal' },
    { name: 'note', hint: 'when and why it is used' },
    { name: 'example', hint: 'the Russian sentence it appeared in' },
  ],
});

/** أسماء بديلة نقبلها للحقل الواحد — الكرم في القراءة وحدها. */
export const FIELD_ALIASES = Object.freeze({
  title: ['title', 'titleAr', 'name', 'label'],
  titleRu: ['titleRu', 'russianTitle', 'title_ru'],
  text: ['text', 'content', 'body', 'russian', 'ru'],
  translation: ['translation', 'translationAr', 'ar', 'arabic', 'meaningAr'],
  speaker: ['speaker', 'person', 'who', 'name'],
  date: ['date', 'occurredAt', 'when'],
  wrong: ['wrong', 'before', 'mistake', 'incorrect'],
  natural: ['natural', 'after', 'correct', 'corrected'],
  meaningAr: ['meaningAr', 'meaning', 'translation', 'ar'],
  note: ['note', 'notes', 'explanation', 'comment'],
  // الجملة التي ورد فيها التعبير — سياقُ ظهوره الحقيقيّ *(بند 38)*.
  example: ['example', 'sourceQuote', 'context', 'sentence', 'usage'],
  placeName: ['placeName', 'place', 'location'],
  eventType: ['eventType', 'type', 'sceneType', 'category'],
});

/**
 * يقرأ حقلًا بأي اسمٍ من أسمائه المقبولة.
 *
 * ⚠️ **الترتيب مقصود**: الاسم القانوني أوّلًا. مُنتِجٌ يرسل `title`
 *    و`name` معًا يعني بالأوّل ما نعنيه، والثاني غالبًا اسم شيءٍ آخر.
 */
export function field(object, name, fallback = undefined) {
  const names = FIELD_ALIASES[name] || [name];
  for (const key of names) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

/**
 * اسمٌ عربيٌّ لكل نوعٍ تعدّه المواصفة.
 *
 * ⚠️ ليس زينة. المعاينة تعرض ما لا يُستورَد بأسمائه، وشاشةٌ عربيّةٌ
 *    كلها تقول لك «reviewSuggestions» تطلب منك أن تترجم بنفسك ما
 *    كان علينا أن نقوله. والاختبار يمنع أن يدخل نوعٌ بلا اسم.
 */
export const KIND_NAMES = Object.freeze({
  scene: 'الذكرى',
  speakers: 'المتحدّثون',
  /*
   * ⚠️ `people` و`speakers` مفتاحان لشيءٍ واحد: المواصفة تسمّيه
   *    `speakers` و`SUPPORTED` تسمّيه `people`. وكان الأوّل وحده
   *    مترجَمًا، فظهرت كلمة `people` بالإنجليزيّة في شاشةٍ عربيّة —
   *    كشفَها النظر في الشاشة لا الاختبار، فصار له اختبارٌ على
   *    `SUPPORTED` لا على `SPEC_KINDS` وحدها.
   */
  people: 'الأشخاص',
  scripts: 'السكريبتات',
  translations: 'الترجمات',
  conversations: 'المحادثة',
  conversationParts: 'أجزاء المحادثة',
  mistakes: 'التصحيحات',
  expressions: 'التعبيرات',
  sentencePatterns: 'أنماط الجُمل',
  words: 'الكلمات',
  colloquialLanguage: 'اللغة المنطوقة',
  formalLanguage: 'اللغة الرسميّة',
  professionalLanguage: 'لغة المهنة',
  media: 'الصور والأصوات',
  mediaRoles: 'أدوار الوسائط',
  relationships: 'العلاقات بين المشاهد',
  topics: 'المواضيع',
  places: 'الأماكن',
  journeys: 'الرحلات',
  eventType: 'نوع الحدث',
  eventThread: 'الخيط',
  projects: 'المشاريع',
  reviewSuggestions: 'اقتراحات المراجعة',
  analysisMetadata: 'بيانات التحليل',
});

/** اسم النوع بالعربية، أو المعرّف كما هو إن كان غريبًا عن المواصفة. */
export function kindName(kind) {
  return KIND_NAMES[kind] || kind;
}

/** كل ما تعدّه المواصفة في الحزمة — مرجعُ الاختبار الذي يمنع النسيان. */
export const SPEC_KINDS = Object.freeze([
  'scene', 'speakers', 'scripts', 'translations', 'conversations',
  'conversationParts', 'mistakes', 'expressions', 'sentencePatterns',
  'words', 'colloquialLanguage', 'formalLanguage', 'professionalLanguage',
  'media', 'mediaRoles', 'relationships', 'topics', 'places', 'journeys',
  'eventType', 'eventThread', 'projects', 'reviewSuggestions',
  'analysisMetadata',
]);

/**
 * مرادفاتٌ في تسمية المجموعات نفسها.
 * `speakers` و`people` شيءٌ واحد، و`conversations` تُقرأ من أجزائها.
 */
export const COLLECTION_ALIASES = Object.freeze({
  people: ['people', 'speakers', 'persons'],
  scripts: ['scripts', 'texts'],
  conversationParts: ['conversationParts', 'conversations', 'conversation', 'dialogue', 'turns'],
  mistakes: ['mistakes', 'corrections', 'beforeNatural'],
  expressions: ['expressions', 'phrases'],
});

/** يقرأ مجموعةً بأي اسمٍ من أسمائها، ويعيد مصفوفةً دائمًا. */
export function collection(pkg, name) {
  const names = COLLECTION_ALIASES[name] || [name];
  for (const key of names) {
    const value = pkg?.[key];
    if (Array.isArray(value)) return value;
    // `conversations: { parts: [...] }` شكلٌ شائع من المُنتِجات.
    if (value && Array.isArray(value.parts)) return value.parts;
  }
  return [];
}

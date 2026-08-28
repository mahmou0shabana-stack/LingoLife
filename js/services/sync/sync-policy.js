/**
 * LingoLife — مصفوفةُ سياسات المزامنة (WS-G · بنود ٩ و١٠ و٤٤ و٤٥ و٧٧ و٧٨)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا قاعدةَ مخزنٍ داخل `if`** (بند ١٠)
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ ما يميّز مخزنًا عن مخزنٍ في الدمج مكتوبٌ هنا في جدولٍ واحدٍ
 * يقرؤه المحرّك ويقرؤه الاختبار. والبديلُ — شروطٌ متناثرةٌ في المخطِّط —
 * يجعل «هل يُزامَن `nativeAudio`؟» سؤالًا لا يُجاب إلا بقراءة الكود
 * كلِّه، ويجعل مخزنًا يُضاف غدًا يمرّ صامتًا بلا قرار.
 *
 * ⚠️ **وكلُّ مخزنٍ في الـschema له سطرٌ هنا** — يحرسه اختبارٌ يقارن
 *    `STORE_NAMES` بمفاتيح هذا الجدول. مخزنٌ بلا سياسةٍ خطأُ بناءٍ لا
 *    قرارٌ ضمنيّ.
 */

import { STORE_NAMES } from '../../db/schema.js';

/**
 * الفئاتُ الستّ.
 *
 * ⚠️ **والفرقُ بينها فرقُ سلوكٍ لا فرقُ تسمية**؛ وإلّا لكانت زينةً.
 */
export const CATEGORY = Object.freeze({
  /** بياناتٌ أصليّة: دمجٌ واعٍ بالحقول، وشاهدُ قبرٍ يسري. */
  CANONICAL: 'CANONICAL',
  /**
   * تاريخٌ شخصيّ يُضاف إليه (بنود ٨ و٤٢ و٦٣ و٦٤).
   *
   * ⚠️ ويفترق عن `CANONICAL` في **اثنين بعينهما**، لا أكثر:
   *    ١. **لا يُدمَج بمفتاحٍ طبيعيّ أبدًا** — وإن وُجد. غلطتان
   *       بنفس `patternKey` **حدثان** لا حدثٌ عدّادُه اثنان (بند ٦٣).
   *    ٢. **لا يُعاد بناؤه** — فليس مشتقًّا من شيء.
   *
   * ⚠️ **ولا أدّعي فرقًا ثالثًا.** كنتُ كتبتُ هنا «وحذفٌ مقابلَ تعديلٍ
   *    يتعارض دائمًا» — وهو صحيحٌ لكنه **ليس فرقًا**: بند ١٩ يجعله
   *    قاعدةً في كلّ المخازن. وفرقٌ مزعومٌ لا يغيّر سطرًا في المحرّك
   *    تسميةٌ تُطمئن ولا تفعل.
   */
  APPEND_ONLY: 'APPEND_ONLY',
  /** حافّةٌ منطقيّة: الهُويّةُ الطرفان والنوع، لا معرِّفُ الصفّ. */
  RELATIONSHIP: 'RELATIONSHIP',
  /** مشتقٌّ يُعاد بناؤه بعد الدمج — ولا يُنقَل صفٌّ منه أبدًا. */
  DERIVED: 'DERIVED',
  /** وصفُ وسيطٍ يُزامَن، وبايتاتُه لا (بنود ٢٩…٣١ و٧٥). */
  BLOB_METADATA: 'BLOB_METADATA',
  /** لا يغادر الجهاز — ولكلٍّ سببٌ مكتوب. */
  LOCAL_ONLY: 'LOCAL_ONLY',
});

const C = CATEGORY;

/**
 * جدولُ السياسات.
 *
 * الحقول:
 *   `category`      من `CATEGORY`
 *   `why`           **سببٌ بالعربيّة لا تعليقٌ اختياريّ** — يُقرأ في
 *                   شاشة التطوير وفي التقرير، ويُلزم كاتبَ المخزن
 *                   القادم أن يفكّر قبل أن يضيف سطرًا.
 *   `uniqueKey`     حقلٌ فريدٌ يفرض **دمجَ كيانات** لا اتّحادَ صفوف.
 *   `localFields`   حقولٌ داخل صفٍّ يُزامَن ولا تغادر هي (بند ٧٧).
 *   `rebuild`       اسمُ إعادة البناء بعد الدمج — للمشتقّ وحده.
 */
export const STORE_POLICY = Object.freeze({
  /* ---------------- نواةُ المحتوى ---------------- */
  scenes: { category: C.CANONICAL, why: 'الذكرى نفسُها — أصلٌ لا مشتقّ' },
  media: {
    category: C.BLOB_METADATA,
    why: 'الوصفُ يُزامَن والبايتاتُ لا — حزمةُ المزامنة ليست نسخةً احتياطيّة',
    /*
     * ⚠️ البلوب يُقصّ عند التصدير ويُوصف في البيان (بند ٧٦).
     *
     * ⚠️ **و`blobPending` و`driveFileId` محلّيّان أيضًا** (WS-H): الأوّل
     *    يقول «البايتاتُ ليست عندي **أنا**» — والتابلتُ عنده والموبايلُ
     *    لا، وكلاهما على حقّ. ونقلُه يجعل جهازًا يزعم نقصًا ليس فيه أو
     *    اكتمالًا لا يملكه.
     *
     *    والثاني معرِّفُ ملفٍّ عند ناقلٍ بعينه — ولو زُومِن لصار قمامةً
     *    يوم يتبدّل الناقل، ولخرق حيادَ النقل الذي يحرسه بند ٩١.
     *
     * ⚠️ **أمّا `contentHash` فيُزامَن** — وهو ليس سهوًا: البصمةُ خاصّةُ
     *    **المحتوى** لا خاصّةُ الجهاز، وهي واحدةٌ عند الجميع. وبها
     *    وحدَها يستطيع جهازٌ لم يرفع الملفَّ أن يتحقّق ممّا نزّله.
     */
    localFields: ['blob', 'thumbBlob', 'blobPending', 'driveFileId'],
  },
  sceneMediaLinks: { category: C.CANONICAL, why: 'ربطُ الوسيط بالذكرى بترتيبه ودوره' },
  scripts: { category: C.CANONICAL, why: 'النصُّ وعقدةُ الشجرة — أثقلُ ما تكتبه بيدك' },
  scriptVersions: {
    category: C.APPEND_ONLY,
    why: 'تاريخُ النسخ — «لا يُحذف أبدًا» منذ بند ٢٨، فلا يُستبدَل هنا أيضًا',
  },
  contentBlocks: { category: C.CANONICAL, why: 'كتلُ نصوص الذكرى' },
  contentVersions: { category: C.APPEND_ONLY, why: 'تاريخُ كتلة النصّ — أخو `scriptVersions`' },
  conversations: { category: C.CANONICAL, why: 'المحادثةُ حاويةٌ لأجزائها' },
  conversationParts: { category: C.CANONICAL, why: 'دورُ المتحدّث بنصّه وترتيبه' },

  /* ---------------- اللغة ---------------- */
  expressions: {
    category: C.CANONICAL,
    uniqueKey: 'normalizedText',
    why: 'التعبيرُ كيانٌ عالميٌّ واحد — واتّحادٌ ساذجٌ يكسر فهرسَ `unique`',
  },
  expressionOccurrences: {
    category: C.APPEND_ONLY,
    why: 'ظهورٌ بتاريخه — واقعةٌ حدثت، لا حقلٌ يُصحَّح',
  },
  sentencePatterns: {
    category: C.CANONICAL,
    uniqueKey: 'normalizedText',
    why: 'نمطٌ عالميٌّ واحد — نفسُ قيد `expressions`',
  },
  words: {
    category: C.CANONICAL,
    uniqueKey: 'normalizedText',
    why: 'الكلمةُ كيانٌ عالميٌّ واحد — نفسُ قيد `expressions`',
  },
  mistakeComparisons: {
    category: C.APPEND_ONLY,
    why: 'غلطةٌ وقعت في يومٍ بعينه — ولا تُجمَع غلطتان لتشابه بصمتهما (بند ٦٣)',
  },

  /* ---------------- التنظيم ---------------- */
  audioRoles: { category: C.CANONICAL, why: 'تصنيفُ الأصوات كيانٌ يُعاد تسميتُه' },
  eventTypes: { category: C.CANONICAL, why: 'نوعُ الموقف كيانٌ في القاعدة منذ v7' },
  eventThreads: { category: C.CANONICAL, why: 'القضيّةُ الممتدّة فوق المشاهد' },
  people: { category: C.CANONICAL, why: 'مكتبةُ الأشخاص' },
  places: { category: C.CANONICAL, why: 'مكتبةُ الأماكن' },
  journeys: { category: C.CANONICAL, why: 'الرحلاتُ كيانٌ تسمّيه وتربط به مشاهدَك' },
  topics: { category: C.CANONICAL, why: 'المواضيع الدائمة' },
  tags: { category: C.CANONICAL, why: 'مفرداتُ التصنيف — يشاركها الجهازان بحكم المعنى' },
  relationships: {
    category: C.RELATIONSHIP,
    why: 'الحافّةُ هُويّتُها طرفاها ونوعُها — ومعرِّفُ الصفّ يختلف بين جهازين لنفس الحافّة',
  },

  /* ---------------- الشادوينج ---------------- */
  shadowSessions: {
    category: C.CANONICAL,
    /*
     * ⚠️ **وموضعُك ليس بياناتِك** (بند ٧٧). الجلسةُ وإعداداتُها ومصدرُها
     *    تُزامَن؛ أمّا «أنا واقفٌ عند الجملة ٧» فحالةُ قراءةٍ على هذا
     *    الجهاز. ونقلُها يعني أن تفتح الموبايل فتقفز من مكانك.
     */
    localFields: ['currentSegmentIndex'],
    why: 'الجلسةُ ومصدرُها وإعداداتُها بياناتُك — وموضعُ القراءة فيها لا',
  },
  shadowSegments: { category: C.CANONICAL, why: 'المقطعُ بلقطته وترتيبه وملاحظاتك عليه' },
  practiceEvidence: {
    category: C.APPEND_ONLY,
    why: 'تدرّبتَ فعلًا في لحظةٍ بعينها — ولا يُلغي تدريبٌ تدريبًا (بند ٦٤)',
  },
  savedItems: { category: C.CANONICAL, why: 'ما التقطتَه بيدك — لقطةٌ نصّيّةٌ تملكها' },
  nativeAudio: {
    category: C.LOCAL_ONLY,
    why: 'بايتاتٌ مجلوبةٌ من الخارج — تُجلَب ثانيةً، وليست بياناتك (مستبعَدةٌ من النسخة أصلًا)',
  },
  generatedAudio: {
    category: C.LOCAL_ONLY,
    why: 'صوتٌ مولَّدٌ محليًّا — يُعاد توليدُه، ونقلُه نقلُ ميجابايتاتٍ بلا معنًى',
  },

  /* ---------------- المراجعة والبحث ---------------- */
  reviewItems: { category: C.CANONICAL, why: 'بطاقةُ مراجعةٍ لها موعدٌ قادم' },
  reviewHistory: { category: C.APPEND_ONLY, why: 'راجعتَ في يومٍ بعينه — سجلٌّ لا حالة' },
  searchIndex: {
    category: C.DERIVED,
    /*
     * ⚠️ **ولا إعادةَ بناءٍ له — لأنه لا يُبنى أصلًا.** `search-service`
     *    يقول ذلك بنصّه: المخزن معرَّفٌ في الـschema منذ البداية ولم
     *    يُكتَب فيه صفٌّ قطّ. فإعلانُ `rebuild: 'search'` هنا كان
     *    سيَعِد بنداءٍ لا وجودَ له.
     */
    rebuild: null,
    why: 'فهرسٌ معكوسٌ مشتقّ — ولا سطرَ في التطبيق يكتبه اليوم، فلا شيءَ يُنقَل ولا شيءَ يُبنى',
  },

  /* ---------------- التحليل ---------------- */
  analysisRuns: {
    category: C.LOCAL_ONLY,
    why: 'جولةُ تحليلٍ بدأتَها على هذا الجهاز — سيرُ عملٍ لا نتيجةٌ مستقرّة',
  },
  analysisProposals: {
    category: C.LOCAL_ONLY,
    why: 'منطقةُ حجرٍ لمقترحاتٍ لم تُقرَّر — ونقلُ نصفِ قرارٍ يجعل الموافقةَ مرّتين ممكنة',
  },

  /* ---------------- النظام ---------------- */
  syncQueue: {
    category: C.LOCAL_ONLY,
    why: 'طابورٌ قديمٌ لم يُستعمَل قطّ — و`changeLog` هو الخَلَف (راجع docs/20 §٢٠٫٣)',
  },
  settings: {
    category: C.CANONICAL,
    /*
     * ⚠️ **ولا يُدمَج ككتلةٍ واحدة** (بند ٤٥): المفتاحُ هو الصفّ،
     *    والسياسةُ لكلّ مفتاحٍ في `SETTING_POLICY` تحت.
     */
    why: 'مفتاحٌ بمفتاح — لا كتلةٌ واحدة، وأكثرُها محلّيٌّ بالقرار',
  },
  projectContext: { category: C.CANONICAL, why: 'سياقُ المشروع الذي تكتبه' },
  promptVersions: { category: C.CANONICAL, why: 'الطلباتُ التي كتبتَها — نصٌّ تملكه' },
  backupHistory: {
    category: C.LOCAL_ONLY,
    why: 'سجلُّ النسخ التي أُخذت **على هذا الجهاز** — ونقلُه يزعم أنك أخذتها هنا',
  },

  /* ---------------- مختبر التطوّر ---------------- */
  devIssues: { category: C.CANONICAL, why: 'ملاحظةُ تطويرٍ تكتبها وتحرّرها' },
  devBriefs: { category: C.CANONICAL, why: 'حزمةُ تطويرٍ فوق الملاحظات' },
  devEvents: { category: C.APPEND_ONLY, why: 'خطٌّ زمنيٌّ «يُضاف إليه ولا يُعدَّل» بنصّ الـschema' },
  devShots: { category: C.CANONICAL, why: 'لقطةٌ مرفقةٌ بملاحظة — رابطٌ يحمل بياناتٍ خاصّة' },

  /* ---------------- المسودّة والمراجع والذاكرة ---------------- */
  studyDrafts: { category: C.CANONICAL, why: 'ما كتبتَه عن الجملة — أثقلُ ما تُنتجه بيدك' },
  referenceRules: { category: C.CANONICAL, why: 'بطاقةُ قاعدةٍ كتبتَها بنفسك' },
  memoryOccurrences: {
    category: C.DERIVED,
    rebuild: 'memory',
    /*
     * ⚠️ **ومعرِّفُه بصمةٌ حتميّة** لا معرِّفٌ مولَّد (`identity.js`). فالجهازان
     *    يحسبان نفسَ المعرِّف لنفس الموضع، ولذلك تبقى وسومُ السياق
     *    (`occurrence:context`) صالحةً بعد إعادة البناء على الجهازين معًا
     *    (بند ٨٠) — وهي الحُجّةُ التي تجعل إعادةَ البناء آمنةً لا مُفقِدة.
     */
    why: 'فهرسُ مواضعَ مشتقٌّ من `scripts` و`studyDrafts` — يُعاد بناؤه ولا يُنقَل',
  },

  /* ---------------- ذاكرةُ اللغة الحيّة v2 (WS-J) ---------------- */

  /**
   * ⚠️ **أصليٌّ لا مشتقّ — والفرقُ يقع على المستخدم مباشرةً.**
   *
   * تصنيفُك لنصٍّ بأنه «أصليّ» أو «مولَّد» **قرارٌ اتّخذتَه بيدك** ولا
   * يمكن لأيّ جهازٍ أن يعيد اشتقاقَه من المحتوى. فلو صُنِّف مشتقًّا
   * لَضاع عند أوّل إعادة بناء، ولَعاد كلُّ نصٍّ «غيرَ محدَّد» بعد كلّ
   * مزامنة — أي لَضاع عملُك كلَّ مرّة.
   *
   * والبصمةُ وحالةُ التحليل تسافران معه: جهازٌ حلّل نصًّا لا يعيد
   * الجارُ تحليلَه بلا سبب.
   */
  memorySources: {
    category: C.CANONICAL,
    why: 'منشأُ النصّ ونسبُه — قرارٌ منك لا يُشتقّ من المحتوى',
  },

  /**
   * ⚠️ **والتحليلُ أصليٌّ أيضًا** — لأنه ثمرةُ جولةٍ خارجيّةٍ مع الذكاء
   *    الاصطناعيّ راجعتَها بنفسك وأقررتَها. ولا يستطيع جهازٌ آخرُ أن
   *    يعيد إنتاجَه من النصّ وحدَه، فإسقاطُه من المزامنة يعني إعادةَ
   *    التحليل كلِّه على كلّ جهاز.
   */
  analysisItems: {
    category: C.CANONICAL,
    uniqueKey: 'key',
    why: 'عنصرُ لغةٍ حلّلَه الذكاءُ وأقررتَه — لا يُعاد اشتقاقُه محلّيًّا',
  },
  analysisEvidence: {
    category: C.APPEND_ONLY,
    why: 'وصلةُ دليلٍ إلى موضعٍ في نصّ — واقعةٌ تُضاف ولا تُدمَج',
  },

  /* ---------------- آلةُ المزامنة نفسُها (v17) ---------------- */
  changeLog: {
    category: C.LOCAL_ONLY,
    why: 'سجلُّ هذا الجهاز — يُصدَّر داخل الحزمة تغييراتٍ، ولا يُستورَد صفوفًا',
  },
  syncPeers: {
    category: C.LOCAL_ONLY,
    why: 'ما يعرفه هذا الجهاز عن جيرانه — معرفةٌ محلّيّةٌ بطبيعتها',
  },
});

/**
 * سياسةُ مفاتيح `settings` — **مفتاحٌ بمفتاح** (بندا ٤٥ و٧٨).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والافتراضُ **محلّيّ**، لا مشترك
 * ═══════════════════════════════════════════════════════════════
 *
 * مفتاحٌ لا سطرَ له هنا لا يغادر الجهاز. والسببُ أن أخطرَ ما في
 * `settings` مفاتيحُ تحمل **معرِّفَ وسيطٍ على هذا الجهاز** أو موضعَ
 * قراءةٍ أو تفضيلَ عتادٍ — ونشرُها يعني ملفَّ PDF لا وجودَ لبايتاته على
 * الموبايل، أو صفحةً تقفز تحت يدك. فمن أراد مشاركةَ مفتاحٍ كتبه هنا
 * صراحةً ومعه سببُه.
 */
export const SETTING_SHARED = Object.freeze({
  'shadow.stressDictionary': 'تصحيحاتُ النبر التي كتبتَها بيدك — بياناتُ لغةٍ لا تفضيلُ جهاز (بند ٧٩)',
  'saved.tags': 'مفرداتُ التصنيف التي أنشأتَها — نفسُ منطق مخزن `tags`',
  'prompts.extra': 'طلباتٌ كتبتَها بنفسك',
  'similarity.different': 'أحكامُك أن هذين ليسا متشابهين — قرارٌ تعبتَ فيه ولا يُعاد',
  'shadow.stressContext': 'سياقاتُ النبر التي حدّدتَها بنفسك',
});

/** لماذا يبقى مفتاحٌ محلّيًّا — يُقرأ في التقرير وفي الاختبار السلبيّ. */
export const SETTING_LOCAL_REASON = Object.freeze({
  'lingolife.activeDB': 'مؤشّرُ خانةٍ في هذا المتصفّح — ونقلُه يوجّه جهازًا إلى قاعدةٍ لا وجودَ لها',
  'ui.lastRoute': 'آخرُ شاشةٍ كنتَ فيها — موضعٌ لا بيان',
  'shadow.split': 'نسبةُ انقسام الصفحة على **هذه** الشاشة',
  'shadow.sky': 'خلفيّةٌ ودرجةُ عتمةٍ لهذه الشاشة',
  'shadow.skyDark': 'عتمةُ الخلفية لهذه الشاشة',
  'shadow.doc': 'موضعُ القراءة في الملفّ — صفحةٌ وتكبير',
  'shadow.reference.view': 'تبويبٌ وصفحةٌ وتكبيرٌ — «أين كنت» لا «ما تملك»',
  'shadow.reference.doc': 'معرِّفُ وسيطِ الملخّص — يشير إلى بايتاتٍ قد لا تكون هنا',
  'shadow.ttsProvider': 'مزوّدُ نطقٍ متاحٌ على هذا الجهاز وحده',
  'shadow.defaults': 'إعداداتُ تشغيلٍ ترتبط بسمّاعة هذا الجهاز',
  'shadow.onlineStress': 'إذنُ شبكةٍ لهذا الجهاز',
  'shadow.onlineTranslation': 'إذنُ شبكةٍ لهذا الجهاز',
  'shadow.nativeAudio': 'إذنُ جلبِ نطقٍ لهذا الجهاز',
  'storage.persistRequested': 'إذنُ تخزينٍ منحه هذا المتصفّح',
  'scene.types': 'بقيّةٌ قديمةٌ رُحِّلت إلى مخزن `eventTypes` في v7',
  'atlas.lenses': 'عدساتُ عرضٍ في هذه الشاشة',
  'sh.debugHitTest': 'مفتاحُ تشخيصٍ للمطوّر',
});

/** هل يُزامَن مفتاحُ إعدادٍ بعينه؟ */
export function settingShared(key) {
  return Object.prototype.hasOwnProperty.call(SETTING_SHARED, key);
}

/** سياسةُ مخزنٍ — ترمي على مخزنٍ مجهولٍ عمدًا. */
export function policyOf(store) {
  const policy = STORE_POLICY[store];
  if (!policy) throw new Error(`مخزنٌ بلا سياسةِ مزامنة: ${store}`);
  return policy;
}

/**
 * هل تُكتَب تغييراتُ هذا المخزن في السجلّ؟
 *
 * ⚠️ **وهذا هو الحارسُ الذي يمنع كارثةَ الأداء.** `rebuildIndex` تكتب
 *    آلافَ صفوف `memoryOccurrences` بنداءٍ واحد؛ ولو سُجِّلت لصار كلُّ
 *    إعادةِ بناءٍ آلافَ صفوفِ سجلٍّ تُصدَّر إلى جهازٍ سيعيد بناءها بنفسه.
 */
export function logged(store) {
  const { category } = policyOf(store);
  return category !== C.DERIVED && category !== C.LOCAL_ONLY;
}

/** هل يعبر هذا المخزنُ في حزمةِ مزامنة؟ — نفسُ سؤال `logged` بمعنًى آخر. */
export const syncable = logged;

/** المخازنُ المشتقّةُ التي يُعاد بناؤها بعد الدمج. */
export const DERIVED_STORES = Object.freeze(
  Object.entries(STORE_POLICY)
    .filter(([, p]) => p.category === C.DERIVED)
    .map(([name]) => name)
);

/** المخازنُ ذاتُ المفتاح الطبيعيّ الفريد — مواضعُ دمج الكيانات. */
export const UNIQUE_STORES = Object.freeze(
  Object.entries(STORE_POLICY)
    .filter(([, p]) => p.uniqueKey)
    .map(([name, p]) => ({ store: name, field: p.uniqueKey }))
);

/**
 * خريطةُ المراجع — **مَن يشير إلى مَن** (بند ١٦).
 *
 * ⚠️ **ولا تُخمَّن**: كلُّ سطرٍ هنا مقروءٌ من الـschema ومن الخدمات، ويحرسه
 *    اختبارٌ يمسح الكود بحثًا عن أيّ حقلٍ باسم `<كيان>Id` لا سطرَ له هنا.
 *    فحقلٌ يُضاف غدًا يُسقط الاختبار بدل أن يترك مرجعًا معلّقًا بعد الدمج.
 *
 * `relationships.fromId/toId` عامّةٌ لكلّ الكيانات، فهي في كلّ صفّ.
 */
export const REFERENCES = Object.freeze({
  expressions: [
    ['expressionOccurrences', 'expressionId'],
    ['mistakeComparisons', 'expressionId'],
    ['relationships', 'fromId'],
    ['relationships', 'toId'],
  ],
  words: [
    ['relationships', 'fromId'],
    ['relationships', 'toId'],
  ],
  sentencePatterns: [
    ['relationships', 'fromId'],
    ['relationships', 'toId'],
  ],
});

/** المخازنُ كلُّها مصنَّفةً — للتقرير ولشاشة التطوير. */
export function policyMatrix() {
  return STORE_NAMES.map((store) => {
    const p = STORE_POLICY[store] || null;
    return {
      store,
      category: p?.category ?? null,
      uniqueKey: p?.uniqueKey ?? null,
      localFields: p?.localFields ?? [],
      synced: p ? logged(store) : false,
      why: p?.why ?? 'بلا سياسة — خطأُ بناء',
    };
  });
}

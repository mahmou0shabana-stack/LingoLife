/**
 * LingoLife — تعريف الـ Schema
 *
 * هذا الملف هو المصدر الوحيد لتعريف الـ stores والفهارس.
 * لا يُنشئ شيئًا بنفسه — `migrations.js` هو من يقرأ منه.
 *
 * ⚠️ قاعدة ملزمة: لا تعدّل تعريف store سبق نشره.
 *    أي تغيير يُضاف كـ migration جديد برقم جديد.
 *    راجع docs/03-architecture.md §3.6
 */

/*
 * ⚠️ لا يوجد SCHEMA_VERSION هنا عمدًا.
 *
 * كان ثابتًا مكتوبًا يدويًا بـ 1 بينما القاعدة تعمل على v2، فكان كل تصدير
 * يختم نفسه بإصدار خاطئ — وهذا يكسر استرجاع النسخ القديمة لأن نظام
 * الترقية يقرأ الرقم ليقرّر ما يطبّقه.
 *
 * إصدار القاعدة له مصدر واحد: `TARGET_VERSION` في `migrations.js`،
 * وهو مشتقّ من الترقيات نفسها فلا يمكن أن يتقادم.
 */

/**
 * اسم قاعدة البيانات الافتراضية.
 *
 * ⚠️ لا تغيّر هذه القيمة — هي موطن بيانات المستخدمين الحاليين، وتغييرها
 *    يعني عالمًا جديدًا فارغًا وفقدان كل شيء.
 *
 * الاسم الفعلي المستخدَم وقت التشغيل يأتي من `db-slots.js`، لأن
 * الاسترجاع الذرّي يحتاج خانتين يتبادلان الدور. الخانة (أ) تحمل هذا
 * الاسم بالذات حتى لا تحتاج البيانات الموجودة أيّ نقل.
 */
export const DB_NAME = 'lingolife';

/**
 * حالات السجل الثلاث (بند 52 من المواصفة).
 * ARCHIVED موجود ويُستثنى من التدفّق اليومي. TRASHED قابل للاسترجاع.
 */
export const STATE = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  TRASHED: 'trashed',
});

/**
 * تعريف الـ stores.
 * keyPath افتراضيًا 'id'. الفهارس مصفوفة من [اسم, keyPath, options?].
 */
export const STORES = {
  /* ---------------------------------------------------------
     نواة المحتوى
     --------------------------------------------------------- */
  scenes: {
    indexes: [
      ['date', 'date'],
      ['state', 'state'],
      ['type', 'type'],
      ['placeId', 'placeId'],
      ['updatedAt', 'updatedAt'],
      ['dirty', 'dirty'],
      ['state_date', ['state', 'date']],
    ],
  },

  /** الوسائط — الـ Blob الأصلي يعيش هنا، بلا أي إعادة ترميز. */
  media: {
    indexes: [
      ['kind', 'kind'],
      ['state', 'state'],
      ['createdAt', 'createdAt'],
      ['dirty', 'dirty'],
      ['contentHash', 'contentHash'],
    ],
  },

  /** الربط ن:م بين المشهد والوسائط + الترتيب + الأدوار. */
  sceneMediaLinks: {
    indexes: [
      ['sceneId', 'sceneId'],
      ['mediaId', 'mediaId'],
      ['scene_order', ['sceneId', 'order']],
      ['roles', 'roles', { multiEntry: true }],
    ],
  },

  scripts: {
    indexes: [
      ['sceneId', 'sceneId'],
      ['type', 'type'],
      ['state', 'state'],
      ['scene_primary', ['sceneId', 'isPrimary']],
    ],
  },

  /** تاريخ نسخ السكريبتات — لا يُحذف أبدًا (بند 28). */
  scriptVersions: {
    indexes: [
      ['scriptId', 'scriptId'],
      ['script_version', ['scriptId', 'version']],
    ],
  },

  /** كتل النصوص: rawTranscript / cleanTranscript / notes / context */
  contentBlocks: {
    indexes: [
      ['sceneId', 'sceneId'],
      ['kind', 'kind'],
      ['scene_kind', ['sceneId', 'kind']],
    ],
  },

  contentVersions: {
    indexes: [
      ['blockId', 'blockId'],
      ['block_version', ['blockId', 'version']],
    ],
  },

  conversations: {
    indexes: [['sceneId', 'sceneId']],
  },

  conversationParts: {
    indexes: [
      ['conversationId', 'conversationId'],
      ['conv_order', ['conversationId', 'order']],
      ['personId', 'personId'],
      // أُضيف في الترقية v2 — يسمح بجلب أجزاء المشهد باستعلام واحد
      ['sceneId', 'sceneId'],
    ],
  },

  /* ---------------------------------------------------------
     اللغة
     --------------------------------------------------------- */

  /** التعبير ككيان عالمي واحد، لا نسخة داخل كل مشهد. */
  expressions: {
    indexes: [
      ['normalizedText', 'normalizedText', { unique: true }],
      ['register', 'register'],
      ['masteryState', 'masteryState'],
      ['state', 'state'],
    ],
  },

  /** قلب Expression Life: كل ظهور بتاريخه ومصدره (بند 38). */
  expressionOccurrences: {
    indexes: [
      ['expressionId', 'expressionId'],
      ['sceneId', 'sceneId'],
      ['expr_time', ['expressionId', 'occurredAt']],
      ['kind', 'kind'],
    ],
  },

  sentencePatterns: {
    indexes: [
      ['normalizedText', 'normalizedText', { unique: true }],
      ['state', 'state'],
    ],
  },

  words: {
    indexes: [
      ['normalizedText', 'normalizedText', { unique: true }],
      ['lemma', 'lemma'],
      ['pos', 'pos'],
      ['state', 'state'],
    ],
  },

  /** Before / Natural — الميزة المميِّزة (بند 30). */
  mistakeComparisons: {
    indexes: [
      ['sceneId', 'sceneId'],
      ['expressionId', 'expressionId'],
      ['mistakeType', 'mistakeType'],
      ['state', 'state'],
    ],
  },

  /* ---------------------------------------------------------
     التنظيم
     --------------------------------------------------------- */
  people: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  places: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  journeys: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  topics: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  tags: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },

  /** محرك العلاقات — يجعل "ظهر في 7 مشاهد" استعلامًا واحدًا (بند 56). */
  relationships: {
    indexes: [
      ['fromId', 'fromId'],
      ['toId', 'toId'],
      ['type', 'type'],
      ['from_type', ['fromId', 'type']],
      ['to_type', ['toId', 'type']],
    ],
  },

  /* ---------------------------------------------------------
     الشادوينج — طبقة ممارسة عامة فوق أي محتوى
     --------------------------------------------------------- */

  /**
   * جلسة ظلّ. تحفظ موضعك وإعداداتك بالضبط، فتغلق التطبيق وتعود
   * للجملة نفسها. مرتبطة دائمًا بمصدرها — لا تعيش معلّقة في الهواء.
   */
  shadowSessions: {
    indexes: [
      ['sourceType', 'sourceType'],
      ['sourceId', 'sourceId'],
      ['sceneId', 'sceneId'],
      ['status', 'status'],
      ['lastPracticedAt', 'lastPracticedAt'],
      ['state', 'state'],
      ['source', ['sourceType', 'sourceId']],
    ],
  },

  /**
   * مقطع ممارسة داخل جلسة.
   *
   * ⚠️ يحمل لقطة من نصّ المصدر وقت الإنشاء (`sourceTextSnapshot`)
   *    لا مرجعًا حيًّا إليه. لو عدّلت السكريبت بعدها، تظل الجلسة
   *    تعرض ما كنت تتدرّب عليه فعلًا بدل أن يتبدّل تحت يدك صامتًا.
   */
  shadowSegments: {
    indexes: [
      ['sessionId', 'sessionId'],
      ['session_order', ['sessionId', 'order']],
      ['sourceObjectId', 'sourceObjectId'],
      ['practiceStatus', 'practiceStatus'],
    ],
  },

  /**
   * دليل ممارسة. تكرار الجملة حدث حقيقي يُسجَّل — لكنه يعني
   * «تُدُرِّب عليها» فقط. لا يرتقي وحده إلى إتقان ولا إلى استخدام
   * حقيقي في الحياة (بند 19 من مواصفة الشادوينج).
   */
  practiceEvidence: {
    indexes: [
      ['sessionId', 'sessionId'],
      ['targetType', 'targetType'],
      ['targetId', 'targetId'],
      ['practiceType', 'practiceType'],
      ['practicedAt', 'practicedAt'],
      ['target', ['targetType', 'targetId']],
    ],
  },

  /**
   * المحفوظات: جملة أو كلمة التقطتها أثناء التدريب لتعود إليها.
   *
   * ⚠️ **لقطة نصّية لا إشارة.** نخزّن النصّ نفسه لا معرّف المقطع، حتى
   *    لو حُذف السكريبت أو غُيّر يبقى ما حفظته كما التقطته. و`sourceId`
   *    و`segmentId` للرجوع إلى الأصل حين يكون موجودًا — لا للاعتماد
   *    عليهما في العرض.
   */
  savedItems: {
    indexes: [
      ['kind', 'kind'],
      ['sourceId', 'sourceId'],
      ['sceneId', 'sceneId'],
      ['normalizedText', 'normalizedText'],
      ['createdAt', 'createdAt'],
    ],
  },

  /**
   * ذاكرة النطق الأصلي (بند 22).
   *
   * تسجيلٌ جُلب من خارج الجهاز يُخزَّن هنا ببايتاته، فلا تغادر الكلمة
   * نفسها إلى خادمٍ خارجي مرّتين. والغياب يُخزَّن أيضًا (`notFound`)
   * لأن كلمةً بلا تسجيل تظلّ بلا تسجيل — وإعادة السؤال كل مرّة مغادرةٌ
   * بلا فائدة.
   *
   * ⚠️ مستبعَد من النسخة الاحتياطية عمدًا: مشتقٌّ يُجلب ثانيةً عند
   *    الحاجة، ولا معنى لتضخيم نسختك ببايتات ليست لك.
   */
  nativeAudio: {
    keyPath: 'word',
    indexes: [['fetchedAt', 'fetchedAt']],
  },

  /* ---------------------------------------------------------
     المراجعة والبحث
     --------------------------------------------------------- */
  reviewItems: {
    indexes: [
      ['dueAt', 'dueAt'],
      ['targetType', 'targetType'],
      ['target', ['targetType', 'targetId']],
    ],
  },

  reviewHistory: {
    indexes: [
      ['itemId', 'itemId'],
      ['reviewedAt', 'reviewedAt'],
    ],
  },

  /** فهرس بحث معكوس يُبنى عند الحفظ لا عند البحث. */
  searchIndex: {
    keyPath: ['token', 'refId'],
    indexes: [
      ['token', 'token'],
      ['refId', 'refId'],
    ],
  },

  /* ---------------------------------------------------------
     التحليل (Living Analysis)
     --------------------------------------------------------- */
  analysisRuns: {
    indexes: [
      ['sceneId', 'sceneId'],
      ['status', 'status'],
      ['requestId', 'requestId'],
    ],
  },

  /** منطقة حجر — لا يدخل شيء للقاعدة قبل موافقة صريحة (بند 18). */
  analysisProposals: {
    indexes: [
      ['runId', 'runId'],
      ['decision', 'decision'],
      ['kind', 'kind'],
    ],
  },

  /* ---------------------------------------------------------
     النظام
     --------------------------------------------------------- */

  /** Outbox للمزامنة مع Drive. */
  syncQueue: {
    indexes: [
      ['status', 'status'],
      ['objectType', 'objectType'],
      ['status_created', ['status', 'createdAt']],
    ],
  },

  settings: { keyPath: 'key', indexes: [] },
  projectContext: { indexes: [['createdAt', 'createdAt']] },
  promptVersions: { indexes: [['category', 'category'], ['createdAt', 'createdAt']] },
  backupHistory: { indexes: [['createdAt', 'createdAt']] },
};

/** أسماء كل الـ stores — يُستخدم في التصدير والإحصاءات. */
export const STORE_NAMES = Object.keys(STORES);

/** الـ stores التي تُصدَّر ضمن النسخة الاحتياطية. */
export const EXPORTABLE_STORES = STORE_NAMES.filter(
  (name) => name !== 'searchIndex' && name !== 'syncQueue'
);

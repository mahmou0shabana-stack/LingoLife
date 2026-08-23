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
  /**
   * أنواع الأحداث — كيانٌ في القاعدة لا كتلة JSON في `settings`.
   *
   * البند 5 يريد معرّفًا ثابتًا وفهارس، والبنود 9–11 تريد إعادة تسمية
   * عامّة وكشف تشابه — وكلاهما استعلامٌ لا قراءةَ كتلة.
   *
   * `normalizedName` مفهرس لأن كشف التعارض (بند 10) يسأل «هل هذا الاسم
   * موجود؟» عند كل ضغطة مفتاح، و`parentId` لأن الشجرة تُبنى بالأب.
   */
  /**
   * تصنيفاتُ الأصوات — كيانٌ لا قائمةٌ ثابتة (v13).
   *
   * ⚠️ المعرّفُ هو الهُويّة: `sceneMediaLinks.roles` تحمله، والاسمُ
   *    هنا. فتغييرُ الاسم يسري على كلّ تسجيلٍ بلا كتابةٍ واحدة.
   */
  audioRoles: {
    indexes: [
      ['normalizedName', 'normalizedName'],
      ['state', 'state'],
      ['order', 'order'],
    ],
  },

  eventTypes: {
    indexes: [
      ['parentId', 'parentId'],
      ['normalizedName', 'normalizedName'],
      ['state', 'state'],
      ['order', 'order'],
    ],
  },

  /**
   * خيوط الأحداث — القضيّة الممتدّة (بنود 24–31).
   *
   * «موضوع الشحنة اللي اتأخّرت» ليس مشهدًا: هو اجتماعٌ ومكالمةٌ وفحصٌ
   * ورسالة على مدى شهرين. الخيط يجمعها **ويعلوها**، والمشهد يبقى
   * مستقلًّا تمامًا (بند 27) — عضويّته علاقةٌ لا حقلٌ فيه.
   *
   * وله **حالة** لأنه قضيّة تُفتَح وتُغلَق، لا موضوعٌ دائم. الموضوع
   * الدائم مكانه `topics`.
   */
  eventThreads: {
    indexes: [
      ['status', 'status'],
      ['state', 'state'],
      ['startDate', 'startDate'],
      ['normalizedName', 'normalizedName'],
    ],
  },

  people: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  places: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  journeys: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  topics: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },
  tags: { indexes: [['normalizedName', 'normalizedName'], ['state', 'state']] },

  /**
   * محرك العلاقات — يجعل «ظهر في 7 مشاهد» استعلامًا واحدًا (بند 56).
   *
   * ⚠️ **`kind` هو الحقل، و`type` أثرٌ مهجور.** وُلد الجدول بحقل
   *    `type`، ثم كتب الكود `kind` وقرأه، وبقي `type` يُكتب معه بلا
   *    أن يُقرأ أبدًا — حقلان لنفس المعنى، وهو ما سمّاه التدقيق «د-5».
   *
   *    و`kind` هو الذي بقي لأنه اصطلاح المشروع كلّه: `media.kind` و
   *    `savedItems.kind` و`contentBlocks.kind`. أمّا `type` فاسمٌ
   *    نتخلّص منه في `scenes` أيضًا لصالح `eventTypeId`.
   *
   *    فهارس `type` تبقى معلَنة: حذف فهرسٍ منشور ممنوع (§3.6 قاعدة 2)،
   *    ورجوعٌ إلى كودٍ أقدم يستعملها. هي وقفٌ لا استعمال.
   */
  relationships: {
    indexes: [
      ['fromId', 'fromId'],
      ['toId', 'toId'],
      ['kind', 'kind'],
      ['from_kind', ['fromId', 'kind']],
      ['to_kind', ['toId', 'kind']],

      // ↓ مهجورة. لا يقرؤها كود اليوم.
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

  /**
   * ذاكرة النطق المولَّد آليًّا — واحدةٌ لكلّ مزوّدات النطق (WS41).
   *
   * `cacheKey` هويّةٌ لا معرّفٌ مولَّد: هاش من النصّ المطبَّع واللغة
   * والمزوّد والصوت وإعداداته، فطلبُ نفس الصوت مرّةً أخرى — ولو من
   * سكريبتٍ آخر أو تكرارًا داخل نفس الجلسة — يُصيب نفس السجلّ ولا
   * يُنشئ توليدًا جديدًا. هذا هو ما يمنع تكرار التوليد عند التكرار
   * (`repeatCount`) أو عند تكرار الكلمة في أكثر من مشهد.
   *
   * ⚠️ مستبعَد من النسخة الاحتياطية عمدًا كأصلها `nativeAudio`: صوتٌ
   *    يُعاد توليده محليًّا عند الحاجة، وليس بياناتك التي فقدانها خسارة.
   */
  generatedAudio: {
    keyPath: 'cacheKey',
    indexes: [
      ['lastUsedAt', 'lastUsedAt'],
      ['providerId', 'providerId'],
    ],
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

  /* ---------------------------------------------------------
     مختبر التطوّر — إدارة تطوير التطبيق نفسه (v11)

     ⚠️ **ولا فهرسَ بلا استعلامٍ يستعمله.** كل فهرسٍ هنا مقابلُ سؤالٍ
        في الشاشة: العدّ بالحالة، والتجميع بالميزة، والخطّ الزمني
        لملاحظةٍ بعينها. وفهرسٌ بلا قارئ كلفةُ كتابةٍ بلا مقابل.

     ⚠️ **ولا حقلَ `briefId`.** عضويّة الملاحظة في الـBrief علاقةٌ في
        `relationships` بنوع `brief:issue` — نفس اصطلاح `thread:scene`
        و`scene:person` *(docs/03 §3.6.1)*.
     --------------------------------------------------------- */

  /** الملاحظة: «عايز أطوّر إيه، وفين، وحالتها إيه». */
  devIssues: {
    indexes: [
      ['status', 'status'],
      ['featureId', 'featureId'],
      ['priority', 'priority'],
      ['createdAt', 'createdAt'],
      ['resolvedAt', 'resolvedAt'],
      ['blockedReason', 'blockedReason'],
      ['state', 'state'],
      ['dirty', 'dirty'],
    ],
  },

  /** الـBrief: تطويرٌ واحدٌ أكبر تحته ملاحظات. */
  devBriefs: {
    indexes: [
      ['status', 'status'],
      ['createdAt', 'createdAt'],
      ['state', 'state'],
      ['dirty', 'dirty'],
    ],
  },

  /**
   * الخطّ الزمني — سجلٌّ يُضاف إليه ولا يُعدَّل.
   *
   * ⚠️ هذا هو **الدليل** تحت كل رقمٍ في اللوحة. ولذلك لا يُكتب فيه
   *    ضجيج: كل نوعٍ هنا يجيب عن سؤالٍ تسأله بعد شهور.
   */
  devEvents: {
    indexes: [
      ['issueId', 'issueId'],
      ['at', 'at'],
      ['kind', 'kind'],
      ['state', 'state'],
      ['dirty', 'dirty'],
    ],
  },

  /**
   * اللقطة المرفقة بملاحظة.
   *
   * ⚠️ **store مستقلٌّ لا علاقةٌ في `relationships`** — والفرق مقصود:
   *    هذا ليس عضويّةً مجرّدة، بل رابطٌ **يحمل بياناتٍ خاصّةً به**:
   *    قبل أم بعد، وأيُّ جزءٍ من الصورة تقصد. وحشرُ ذلك في صفّ علاقةٍ
   *    عامّ يجعل `relationships` مستودعًا لكل شيء بلا شكل.
   */
  devShots: {
    indexes: [
      ['issueId', 'issueId'],
      ['mediaId', 'mediaId'],
      ['phase', 'phase'],
      ['state', 'state'],
      ['dirty', 'dirty'],
    ],
  },

  /* ---------------------------------------------------------
     مسودّة المذاكرة (v12)

     > «الجملة باخدها أدخّلها على شات جيبتي يحلّلهالي — عايز نتيجة
     >  التحليل بتاع الجملة أو الكلمة يبقى فيها حاجة زي مسودة مذاكرة
     >  أضيف فيها الحاجات دي.»

     المسودّة **ملكُ الجملة أو الكلمة لا ملكُ الجلسة**: تفتح الجملة
     نفسها في جلسةٍ ثانيةٍ بعد شهرٍ فتجد ما كتبتَه عنها. ولذلك
     المفتاح نصُّها المُطبَّع لا معرّفُ مقطعٍ يموت بموت جلسته.

     ⚠️ **ولا `mediaId` هنا.** صورُ المسودّة علاقاتٌ في `relationships`
        بنوع `draft:media` — نفسُ اصطلاح `thread:scene` و`brief:issue`.
        فصورةٌ واحدةٌ تخدم مسودّتين، وحذفُ مسودّةٍ لا يمسّ بايتات
        أحد.
     --------------------------------------------------------- */
  studyDrafts: {
    indexes: [
      /* المفتاح المركَّب: «مسودّة هذه الجملة» سؤالٌ يُسأل في كل رسم. */
      ['subject_kind', ['subjectKind', 'subject']],
      ['subject', 'subject'],
      ['subjectKind', 'subjectKind'],
      /* من أين وُلدت — سياقٌ لا هُويّة. */
      ['sceneId', 'sceneId'],
      ['sessionId', 'sessionId'],
      ['updatedAt', 'updatedAt'],
      ['state', 'state'],
      ['dirty', 'dirty'],
    ],
  },

  /* ---------------------------------------------------------
     القواعدُ المهمّة — دفترُ المراجع الشخصيّ (v15، WS-B)

     > «عايز أكون بتدرّب وأبصّ على قاعدة كتبتُها بنفسي من غير ما
     >  أسيب الشادوينج.»

     ⚠️ **ولماذا مخزنٌ جديد وقد قيل «لا تُنشئ مخزنًا لكلّ تبويب»؟**

        لأن التبويبات الأربعة تأخذ **ثلاثةَ بيوتٍ قائمة**: المصدر
        سكريبتاتٌ ومشاهد كما هي، والصورُ في `media`، والـPDF في
        `media` ومفتاحُه الفعّالُ في `settings`. فالمخزنُ الجديد
        **واحدٌ لا أربعة**، ولشيءٍ واحدٍ لا بيتَ له في القاعدة:
        بطاقةُ قاعدةٍ كتبتَها أنت — عنوانٌ ونصٌّ وترتيبٌ وتثبيت.

     ⚠️ **ولماذا ليست `contentBlocks`؟** ذاك مخزنٌ مفتاحُه `sceneId`:
        كتلةُ نصٍّ **تخصّ ذكرى**. وهذه عامّةٌ عمدًا (بند 23-24): تفتح
        أيَّ ذكرى فتجدها. وحشرُها هناك يعني `sceneId` وهميًّا في كلّ
        صفّ — وهو كذبٌ في البيانات لا اختصار.

     ⚠️ **ولا `mediaId` هنا.** صورةُ القاعدة علاقةٌ بنوع `rule:media`
        — نفسُ درس `draft:media` بحرفه: صورةٌ واحدةٌ تخدم قاعدتين،
        وحذفُ قاعدةٍ لا يمسّ بايتاتٍ قد تكون في ذكرى.

     ⚠️ **و`order` عددٌ لا موضعٌ في مصفوفة.** الترتيبُ باللمس (▲▼)
        يبدّل رقمين ويكتب صفّين — لا يعيد كتابة الدفتر كلِّه.
     --------------------------------------------------------- */
  referenceRules: {
    indexes: [
      ['order', 'order'],
      /* 1/0 لا true/false — IndexedDB لا تفهرس المنطقيّ. */
      ['pinned', 'pinned'],
      ['updatedAt', 'updatedAt'],
      ['state', 'state'],
      ['dirty', 'dirty'],
    ],
  },
};

/** أسماء كل الـ stores — يُستخدم في التصدير والإحصاءات. */
export const STORE_NAMES = Object.keys(STORES);

/** الـ stores التي تُصدَّر ضمن النسخة الاحتياطية. */
export const EXPORTABLE_STORES = STORE_NAMES.filter(
  (name) => name !== 'searchIndex' && name !== 'syncQueue'
);

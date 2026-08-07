# 3. المعمارية المقترحة

---

## 3.1 القرارات الجوهرية

| القرار | الاختيار | السبب |
|---|---|---|
| نوع التطبيق | **PWA ثابت** (HTML/CSS/JS) | لا خادم، لا تكلفة، يُثبَّت على التابلت، يعمل offline |
| الإطار | **Vanilla JS + ES Modules** بلا build step | لا `npm install` ولا `vite build` → التطوير من التابلت يصبح ممكنًا فعلًا. أي تعديل = commit مباشر يظهر على الموقع |
| قاعدة البيانات | **IndexedDB** مُطبّعة | تتحمّل جيجابايتات، تخزّن Blobs، فهارس حقيقية، تنجو من تحديثات الكود |
| الوسائط | **Blob داخل IndexedDB** لا Base64 | حجم أصغر 33%، لا سقف نصّي، الأصل يبقى بايت ببايت |
| السحابة | **Google Drive** (تفصيل في مستند 05) | 15GB مجانًا، والمواصفة مبنية عليها |
| التوجيه | **Hash Router** (`#/scene/SC_01J…`) | يعمل على GitHub Pages تحت مسار فرعي بلا أي إعداد خادم |
| التصميم | CSS Custom Properties + Grid/Flex | نفس اللغة البصرية الحالية، بلا مكتبات |

> **لماذا لا React/Vite؟** ليست مسألة تفضيل: أي build step يعني أنك تحتاج بيئة تشغيل كاملة قبل رؤية أي تغيير — وهذا يقتل شرط «التطوير من تابلت». بلا build، الـ commit نفسه هو النشر. الثمن: كتابة يدوية أكثر في طبقة العرض، وهذا ثمن مقبول لتطبيق شخصي.

---

## 3.2 الطبقات

```
┌─────────────────────────────────────────────┐
│  Views + Components   (العرض والتفاعل فقط)   │
├─────────────────────────────────────────────┤
│  Services   (منطق المنتج: مشهد/وسائط/بحث…)   │
├─────────────────────────────────────────────┤
│  Repositories   (CRUD + استعلامات مفهرسة)    │
├─────────────────────────────────────────────┤
│  Database   (IndexedDB + Migrations)         │
├─────────────────────────────────────────────┤
│  Sync   (Outbox → Google Drive)              │
└─────────────────────────────────────────────┘
```

**قاعدة صارمة:** الطبقة العليا لا تتخطّى الطبقة التي تحتها مباشرة. `scene-view.js` لا يلمس IndexedDB أبدًا — يمرّ عبر `scene-service.js`. هذا ما يجعل التعديل بـ Claude Code آمنًا: كل تغيير محصور في ملف واحد معروف.

---

## 3.3 بنية المجلدات

```
lingolife/
├─ index.html
├─ manifest.webmanifest
├─ service-worker.js
├─ README.md
├─ CHANGELOG.md
├─ STATUS.md                  ← ما يعمل / جزئي / غير منفَّذ
│
├─ css/
│  ├─ tokens.css              ← الألوان والخطوط (منقولة من الـ prototype)
│  ├─ base.css  layout.css  journal.css
│  ├─ scene.css  media.css  language.css
│  └─ responsive.css
│
├─ js/
│  ├─ app.js  router.js  state.js
│  │
│  ├─ db/
│  │  ├─ database.js          ← فتح/ترقية IndexedDB
│  │  ├─ migrations.js        ← مصفوفة ترقيات، للأمام فقط
│  │  └─ repositories/        ← ملف لكل store
│  │
│  ├─ services/
│  │  ├─ scene-service.js     media-service.js    script-service.js
│  │  ├─ language-service.js  search-service.js   review-service.js
│  │  ├─ trash-service.js     analysis-service.js
│  │  └─ export-service.js    import-service.js   backup-service.js
│  │
│  ├─ sync/
│  │  ├─ google-auth.js       drive-client.js
│  │  ├─ sync-queue.js        conflict-resolver.js
│  │  └─ workspace.js
│  │
│  ├─ views/                  ← now, life, language, scene, focus,
│  │                            expression-life, person, place,
│  │                            search, review, analysis, settings, trash
│  ├─ components/             ← scene-hero, image-mosaic, audio-player,
│  │                            script-panel, mistake-comparison,
│  │                            expression-card, action-menu, modal, toast…
│  └─ utils/
│     ├─ ids.js  dates.js  normalization.js
│     ├─ validation.js  files.js  blobs.js  hash.js
│
├─ assets/{icons,fonts}
├─ docs/                      ← هذه المستندات
└─ tests/                     ← QA checklist + اختبارات يدوية/آلية
```

---

## 3.4 نموذج البيانات (IndexedDB)

**اسم القاعدة:** `lingolife` · **الإصدار الابتدائي:** `1`

### حقول مشتركة في كل سجل

```js
{
  id:        "SC_01JD8F…",   // ULID — مرتّب زمنيًا وثابت للأبد
  createdAt: 1738000000000,
  updatedAt: 1738000000000,
  rev:       3,              // يزيد مع كل تعديل — أساس كشف التعارض
  state:     "active",       // active | archived | trashed
  deletedAt: null,
  dirty:     true            // ينتظر المزامنة مع Drive
}
```

### الـ Stores

**نواة المحتوى**

| Store | المفتاح | فهارس أساسية | الغرض |
|---|---|---|---|
| `scenes` | id | `date`, `state`, `type`, `placeId`, `updatedAt` | المشهد + بياناته الوصفية فقط (بلا وسائط) |
| `media` | id | `kind`, `state`, `createdAt` | **Blob الأصلي** + `thumbBlob` + `mime` + `bytes` + `durationMs` |
| `sceneMediaLinks` | id | `sceneId`, `mediaId`, `[sceneId+order]`, `roles` | الربط ن:م + الترتيب + الأدوار (غلاف/استرجاع/خط زمني) |
| `scripts` | id | `sceneId`, `[sceneId+isPrimary]`, `type` | السكريبتات |
| `scriptVersions` | id | `[scriptId+version]` | تاريخ النسخ — **لا يُحذف أبدًا** |
| `contentBlocks` | id | `sceneId`, `kind` | Raw Transcript / Clean / ملاحظات |
| `contentVersions` | id | `[blockId+version]` | تاريخ نسخ النصوص |
| `conversations` | id | `sceneId` | المحادثة |
| `conversationParts` | id | `[conversationId+order]`, `personId` | أجزاء المحادثة |

**اللغة**

| Store | المفتاح | فهارس | الغرض |
|---|---|---|---|
| `expressions` | id | `normalizedText` (unique)، `register`، `masteryState` | التعبير ككيان عالمي واحد |
| `expressionOccurrences` | id | `expressionId`, `sceneId`, `[expressionId+occurredAt]` | **قلب Expression Life** — كل ظهور بتاريخه ومصدره |
| `sentencePatterns` | id | `normalizedText` | الأنماط |
| `words` | id | `lemma`, `normalizedText` | الكلمات |
| `mistakeComparisons` | id | `sceneId`, `expressionId`, `mistakeType` | Before / Natural |

**التنظيم**

| Store | المفتاح | فهارس | الغرض |
|---|---|---|---|
| `people` / `places` / `journeys` / `topics` / `tags` | id | `name`, `normalizedName` | كيانات مستقلة |
| `relationships` | id | `fromId`, `toId`, `type`, `[fromId+type]` | **محرك العلاقات** — يجعل «ظهر في 7 مشاهد» استعلامًا واحدًا |

**المراجعة والنظام**

| Store | المفتاح | فهارس | الغرض |
|---|---|---|---|
| `reviewItems` | id | `dueAt`, `targetType` | جدولة SRS |
| `reviewHistory` | id | `itemId`, `reviewedAt` | سجل المراجعات |
| `searchIndex` | token | `token`, `refId` | فهرس بحث معكوس مبني محليًا |
| `analysisRuns` | id | `sceneId`, `status`, `requestId` | تاريخ التحليل |
| `analysisProposals` | id | `runId`, `decision` | **منطقة حجر** — لا يدخل شيء للقاعدة قبل الموافقة |
| `syncQueue` | id | `[status+createdAt]` | Outbox للمزامنة |
| `settings` / `projectContext` / `promptVersions` / `backupHistory` | id | — | إعدادات وسياق |

### لماذا هذا التطبيع مهم عمليًا

مثال حقيقي — «التعبير `находиться на контроле у заказчика` ظهر في 8 مشاهد»:

```js
// استعلام واحد على فهرس واحد — يعمل بنفس السرعة مع 5 مشاهد أو 5000
const occurrences = await repo.expressionOccurrences.byIndex('expressionId', expId);
// → 8 سجلات، كل واحد فيه sceneId + occurredAt + sourceQuote + kind
```

في البنية الحالية هذا يتطلب تحميل كل المشاهد وفكّ JSON كل واحد منها. الفرق بين ميزة تعمل وميزة مستحيلة.

---

## 3.5 استراتيجية الوسائط

```
رفع صورة
  ├─ الأصل → media.blob        (File كما هو، بلا أي إعادة ترميز)
  ├─ thumb → media.thumbBlob   (400px، WebP، للعرض السريع فقط)
  └─ سجل sceneMediaLinks       (الترتيب + الأدوار)
```

- **الأصل لا يُمس إطلاقًا** — يُصدَّر لاحقًا بنفس البايتات (بند 20 من المواصفة).
- عرض الصور عبر `URL.createObjectURL(blob)` مع كاش LRU و`revokeObjectURL` عند الخروج من الشاشة — بدون هذا تتسرّب الذاكرة على التابلت.
- التسجيل الصوتي: `MediaRecorder` بصيغة `audio/webm;codecs=opus` عند ~48kbps → **~0.35 ميجا للدقيقة**. هذه هي الصيغة الأصلية للتسجيل لا ضغطًا مدمّرًا.
- `IntersectionObserver` لتحميل الصور كسولًا.

---

## 3.6 الترقيات (Migrations) — ضمانة عدم ضياع البيانات

```js
// js/db/migrations.js
export const MIGRATIONS = [
  { v: 1, up(db, tx) { /* إنشاء الـ stores والفهارس */ } },
  { v: 2, up(db, tx) { /* إضافة store جديد */ } },
  { v: 3, up(db, tx) { /* إضافة فهرس + تعبئة حقل جديد بقيمة افتراضية */ } },
];
```

**القواعد الملزمة:**
1. للأمام فقط. لا تعديل على ترقية سبق نشرها — الترقية الجديدة تُضاف كرقم جديد.
2. ممنوع `deleteObjectStore` أو حذف فهرس يحمل بيانات. إعادة التسمية = إنشاء جديد + نسخ + إبقاء القديم دورة كاملة.
3. حقل جديد = قيمة افتراضية، لا كسر للسجلات القديمة.
4. **نسخة احتياطية تلقائية قبل أي ترقية** تغيّر الرقم الرئيسي، تُحفظ في `backupHistory`.
5. `SCHEMA_VERSION` يُكتب في كل تصدير وفي `workspace.manifest.json`.

---

## 3.7 Service Worker — المصيدة الأخطر

الخطر العملي: يبقى التابلت عالقًا على نسخة كود قديمة، أو أسوأ — كاش تالف يظهر كـ«ضياع بيانات» وهو ليس كذلك.

```
index.html و ملفات js/css  →  Network-first ثم كاش كاحتياط
الخطوط والأيقونات          →  Cache-first
بيانات المستخدم            →  لا تُخزَّن في الكاش إطلاقًا (كلها في IndexedDB)
```

- كاش باسم إصدار: `lingolife-v{BUILD}` — كل نشر يحذف الكاشات القديمة.
- عند اكتشاف نسخة جديدة: **إشعار للمستخدم** «تحديث جاهز — إعادة تحميل» بدل `skipWaiting()` صامت أثناء الكتابة.
- زر «تحديث إجباري» في الإعدادات: يفرغ الكاش ويعيد التسجيل — **دون لمس IndexedDB**. هذا التمييز حاسم.

---

## 3.8 المزامنة (Local-first)

```
تعديل المستخدم
   ↓
حفظ في IndexedDB  ← نجاح فوري، بلا انتظار إنترنت
   ↓
"محفوظ محليًا" في الواجهة
   ↓
إدراج في syncQueue (dirty)
   ↓
مزامنة مؤجّلة (debounce ~10 ثوانٍ) عند توفر الشبكة
   ↓
"محفوظ في Drive"
```

- **لا شيء في التطبيق ينتظر الإنترنت.** التحرير يعمل offline كاملًا.
- رفع الكائنات المتغيّرة فقط (dirty tracking) لا القاعدة كلها.
- كشف التعارض بـ `rev` + `updatedAt` + `contentHash`. عند التعارض: عرض النسختين واختيار المستخدم (احتفظ بالمحلي / بالسحابي / بالاثنين كنسختين). **لا كتابة صامتة فوق الأحدث.**
- الوسائط تُرفع مرة واحدة (Blob غير قابل للتغيير) — التعارضات محصورة في البيانات النصية.

---

## 3.9 الأداء

المواصفة تشترط العمل مع 1000+ مشهد و10000+ تعبير:

- لا تحميل للقاعدة كاملة عند الإقلاع — فقط `settings` + آخر مشهد + صفحة NOW.
- التصفّح بالمؤشرات (cursors) وليس `getAll()`.
- Virtual scrolling للقوائم فوق 100 عنصر.
- فهرس البحث المعكوس يُبنى تدريجيًا عند الحفظ، لا عند البحث.
- الصور: thumbnails فقط في القوائم، الأصل عند الفتح فقط.

---

## 3.10 معايير القبول للمعمارية

قبل اعتبار الأساس جاهزًا:

1. مشهد فيه 20 صورة + 10 ملفات صوت يُحفظ ويُفتح خلال ثانية.
2. إغلاق المتصفح تمامًا وإعادة فتحه → كل البيانات موجودة.
3. **نشر نسخة كود جديدة → صفر تأثير على البيانات.** (الاختبار الأهم)
4. ترقية schema من v1 إلى v2 → لا سجل واحد يُفقد.
5. الصورة المصدَّرة مطابقة بايت ببايت للأصل المرفوع.
6. فصل الإنترنت → التحرير يعمل بالكامل.
7. `expressionOccurrences` يعطي Expression Life باستعلام واحد.

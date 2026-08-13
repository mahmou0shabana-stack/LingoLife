/**
 * LingoLife — الترقيات (Migrations)
 *
 * القواعد الملزمة (docs/03-architecture.md §3.6):
 *
 *  1. للأمام فقط. لا تعدّل ترقية سبق نشرها — أضف رقمًا جديدًا.
 *  2. ممنوع deleteObjectStore أو حذف فهرس يحمل بيانات.
 *     إعادة التسمية = إنشاء جديد + نسخ + إبقاء القديم دورة كاملة.
 *  3. أي حقل جديد يأتي بقيمة افتراضية — لا كسر للسجلات القديمة.
 *  4. الترقية تعمل داخل transaction الترقية فقط (versionchange).
 *
 * هذا الملف هو الضمانة الفعلية بأن تحديث الكود لا يمسّ بياناتك.
 */

import { STORES, STATE } from './schema.js';
import { BUILT_IN_EVENT_TYPES } from './seeds.js';

/**
 * تطبيعٌ مبسَّط للترقيات وحدها.
 *
 * ⚠️ **لا تستورد `utils/normalization.js` هنا.** الترقية المنشورة لا
 *    يتغيّر سلوكها أبدًا (§3.6)، وذلك الملفّ يتحسّن مع الوقت — فلو
 *    استوردناه لتبدّل ما كتبته ترقيةُ الأمس كلما حسّنّا التطبيع اليوم.
 *    والقيمة المكتوبة هنا **مؤقّتة على أي حال**: الخدمة تعيد حسابها
 *    بالتطبيع الكامل عند أوّل كتابة على السجل.
 */
function simpleNormalize(text) {
  return (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * ينشئ store مع فهارسه من تعريف schema.
 * @param {IDBDatabase} db
 * @param {string} name
 */
function createStore(db, name) {
  const def = STORES[name];
  if (!def) throw new Error(`تعريف الـ store غير موجود: ${name}`);
  if (db.objectStoreNames.contains(name)) return;

  const store = db.createObjectStore(name, {
    keyPath: def.keyPath || 'id',
  });

  for (const [idxName, keyPath, options] of def.indexes || []) {
    store.createIndex(idxName, keyPath, options || {});
  }
}

/**
 * يضيف فهرسًا إلى store قائم إن لم يكن موجودًا.
 * آمن للاستدعاء المتكرر.
 */
export function addIndexIfMissing(tx, storeName, idxName, keyPath, options = {}) {
  const store = tx.objectStore(storeName);
  if (!store.indexNames.contains(idxName)) {
    store.createIndex(idxName, keyPath, options);
  }
}

/**
 * يمرّ على كل سجلات store ويطبّق دالة تحويل.
 * يُستخدم لتعبئة حقل جديد بقيمة افتراضية.
 */
export function backfill(tx, storeName, transform) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore(storeName);
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      const updated = transform(cursor.value);
      if (updated !== undefined && updated !== null) {
        cursor.update(updated);
      }
      cursor.continue();
    };
  });
}

/**
 * قائمة الترقيات. الترتيب تصاعدي إلزامي.
 * @type {{ v: number, note: string, up: (db: IDBDatabase, tx: IDBTransaction) => void }[]}
 */
export const MIGRATIONS = [
  {
    v: 1,
    note: 'إنشاء الـ schema الأولي — 30 store',
    up(db) {
      for (const name of Object.keys(STORES)) {
        createStore(db, name);
      }
    },
  },

  {
    v: 2,
    note: 'فهرس sceneId على أجزاء المحادثة — لجلب أجزاء المشهد باستعلام واحد',
    up(db, tx) {
      addIndexIfMissing(tx, 'conversationParts', 'sceneId', 'sceneId');
      // سجلات قديمة قد لا تحمل الحقل — نعطيها قيمة افتراضية بدل كسرها.
      return backfill(tx, 'conversationParts', (rec) => {
        if (rec.sceneId === undefined) {
          rec.sceneId = null;
          return rec;
        }
      });
    },
  },

  {
    v: 3,
    note: 'الشادوينج — جلسات ومقاطع ودليل ممارسة',
    up(db) {
      // stores جديدة بالكامل: لا سجل قائم يُمَسّ، والترقية إضافة محضة.
      createStore(db, 'shadowSessions');
      createStore(db, 'shadowSegments');
      createStore(db, 'practiceEvidence');
    },
  },

  {
    v: 4,
    note: 'ربط الوسائط بالنصوص وببعضها + تصنيف التسجيلات',
    up(db, tx) {
      // فهرس مركّب يجعل «هات كل ما يرتبط بهذا العنصر من هذا النوع»
      // استعلامًا واحدًا بدل مسح كل الروابط وتصفيتها في الذاكرة.
      addIndexIfMissing(tx, 'relationships', 'from_to', ['fromId', 'toId']);
      addIndexIfMissing(tx, 'relationships', 'kind', 'kind');

      // تصنيف حرّ للتسجيلات فوق الدور المحدود.
      return backfill(tx, 'media', (record) => {
        if (record.tags === undefined) {
          record.tags = [];
          return record;
        }
      });
    },
  },

  {
    v: 5,
    note: 'المحفوظات — جمل وكلمات تلتقطها أثناء التدريب بتصنيفاتها',
    up(db) {
      // store جديد بالكامل: إضافة محضة لا تمسّ سجلًا قائمًا.
      createStore(db, 'savedItems');
    },
  },

  {
    v: 6,
    note: 'ذاكرة النطق الأصلي — تسجيل مجلوب يُحفظ فلا تتكرّر مغادرة الكلمة',
    up(db) {
      // store جديد بالكامل: إضافة محضة لا تمسّ سجلًا قائمًا، ولا
      // يحتاج ردمًا — فارغٌ يعني «ما جُلب شيء بعد»، وهو الصحيح.
      createStore(db, 'nativeAudio');
    },
  },

  {
    v: 7,
    note: 'الأنواع تصير كيانات في القاعدة — بلا لمس مشهدٍ واحد',
    /*
     * ⚠️ أخطر ترقية في المشروع: كل الترقيات قبلها **تضيف بجانب**
     *    بياناتك، وهذه أوّل واحدة تنقل معنًى قائمًا من مكان إلى مكان.
     *
     * والحيلة التي تجعلها آمنة: **البذر بالمعرّفات الحالية نفسها**
     *    (`meeting`, `inspection`, …). `scene.type` يحمل هذه
     *    المعرّفات أصلًا، فبمجرّد وجودها في `eventTypes` يصير كل
     *    مشهدٍ موصولًا بنوعه — بلا كتابة بايتٍ واحد في `scenes`.
     *
     * وأربع شبكات أمان:
     *  1. `settings['scene.types']` **لا يُحذف** (بند 107). لو انكشف
     *     عطبٌ بعد أسبوع، تخصيصاتك ما زالت حيث كانت.
     *  2. `scene.type` **لا يُحذف** ولا يُغيَّر — يُوسَم مهجورًا فقط.
     *  3. `scene.eventTypeId` يُملأ منه، والحقلان يُكتبان معًا دورةً
     *     كاملة (§3.6).
     *  4. البذر بـ`put` لا `add`: ترقيةٌ أُعيد تشغيلها لا تنفجر.
     */
    up(db, tx) {
      createStore(db, 'eventTypes');
      const types = tx.objectStore('eventTypes');
      const now = Date.now();

      const record = (type) => ({
        ...type,
        // التطبيع هنا نسخةٌ **مبسَّطة عمدًا** من `utils/normalization.js`:
        // الترقية لا تستورد من طبقةٍ تتغيّر (راجع ترويسة `seeds.js`).
        // والخدمة تعيد حسابه بالتطبيع الكامل عند أوّل كتابة.
        normalizedName: simpleNormalize(type.label),
        createdAt: now,
        updatedAt: now,
      });

      for (const seed of BUILT_IN_EVENT_TYPES) types.put(record(seed));

      // تخصيصاتك تُكتب فوق المبذور بنفس المعرّف، والجديد يُضاف.
      const stored = tx.objectStore('settings').get('scene.types');
      stored.onsuccess = () => {
        const custom = stored.result?.value;
        if (!Array.isArray(custom)) return;

        for (const type of custom) {
          if (!type?.id) continue;
          const existing = types.get(type.id);
          existing.onsuccess = () => {
            const base = existing.result || {
              parentId: null, aliases: [], icon: null, color: null,
              builtIn: false, order: 999, createdAt: now,
            };
            const label = type.label ?? base.label;
            types.put({
              ...base,
              ...type,
              label,
              normalizedName: simpleNormalize(label),
              state: type.archived ? STATE.ARCHIVED : base.state || STATE.ACTIVE,
              updatedAt: now,
            });
          };
        }
      };

      // الحقل الجديد على المشاهد. `type` يبقى كما هو — هذه إضافة لا نقل.
      return backfill(tx, 'scenes', (scene) => {
        if (scene.eventTypeId === undefined) {
          scene.eventTypeId = scene.type ?? null;
          return scene;
        }
      });
    },
  },

  {
    v: 8,
    note: 'العلاقات: `kind` هو الحقل، و`type` يُترك أثرًا مهجورًا',
    /*
     * «د-5» في التدقيق: حقلان لنفس المعنى. وُلد الجدول بـ`type`، ثم
     * كتب الكود `kind` **وقرأه**، وبقي `type` يُكتب معه بلا أن يُقرأ.
     *
     * والازدواج ليس تشويهًا جماليًّا: الخيوط (WS1-ج) تُبنى فوق هذا
     * الجدول مباشرةً، فتنظيفه الآن تنظيفُ جدولٍ صغير، وتأجيله تنظيفُه
     * وتحته خيوط.
     *
     * ⚠️ و`type` **لا يُحذف من السجلات**. حذف حقلٍ من بياناتٍ قائمة
     *    ترقيةٌ إتلافية، والقاعدة تمنعها. يتوقّف عن الكتابة فحسب،
     *    فيذبل مع السجلات الجديدة ويبقى في القديمة شاهدًا.
     */
    up(db, tx) {
      // فهارس `kind` المركّبة: تحوّل «هات روابط هذا العنصر من هذا
      // النوع» من مسحٍ في الذاكرة إلى إصابةِ فهرس.
      addIndexIfMissing(tx, 'relationships', 'kind', 'kind');
      addIndexIfMissing(tx, 'relationships', 'from_kind', ['fromId', 'kind']);
      addIndexIfMissing(tx, 'relationships', 'to_kind', ['toId', 'kind']);

      // سجلٌّ كُتب قبل أن يبدأ الكود بكتابة `kind` (أي قبل v4) يحمل
      // `type` وحده. بلا هذا الردم يصير غير مرئيّ للاستعلام الجديد.
      return backfill(tx, 'relationships', (row) => {
        if (row.kind === undefined && row.type !== undefined) {
          row.kind = row.type;
          return row;
        }
      });
    },
  },

  {
    v: 9,
    note: 'خيوط الأحداث — القضيّة الممتدّة فوق المشاهد لا داخلها',
    up(db) {
      // store جديد بالكامل: إضافة محضة لا تمسّ سجلًا قائمًا.
      //
      // ⚠️ ولا حقلَ يُضاف إلى `scenes`. عضويّة المشهد في الخيط
      //    **علاقةٌ** في `relationships` لا حقلٌ فيه (بند 27): المشهد
      //    يبقى مستقلًّا، وخيطٌ يُحذف لا يترك أثرًا في ذكرياتك.
      createStore(db, 'eventThreads');
    },
  },

  {
    v: 10,
    note: 'منشأ الظهور: ادّعاءٌ ثابتٌ يصير إقرارًا بالجهل',
    /*
     * `expressionOccurrences.sourceType` كان يُكتب `'manual'` **ثابتًا
     * لكل ظهور** ولمساراته الثلاثة كلها (بند 38). فظهورٌ جاء من
     * استيرادٍ أو من الظلّ يقول «كتبته بإيدك» وهو لا يعرف.
     *
     * ⚠️ **وهذه ليست ترقيةً إتلافية** رغم أنها تكتب فوق قيمة: الحقل
     *    كان ثابتًا لا يحمل خبرًا، فلا معلومةَ فيه تضيع. تحويله إلى
     *    `'unknown'` يستبدل ادّعاءً بلا سند بإقرارٍ صادق، لا أكثر.
     *
     * ⚠️ ولا تُحوَّل إلا `'manual'` وحدها. الظهورات المكتوبة **بعد**
     *    بند 38 تحمل `import` أو `shadow` أو `manual` عن معرفة — لكن
     *    الترقية تجري مرّةً واحدة عند الانتقال من v9، وقبلها لا وجود
     *    لغير `'manual'`. فلا لبس.
     *
     * وما تعرفه أنت يبقى لك: زرٌّ في الإعدادات يقول «الظهورات دي
     * كتبتها بإيدي» يرجّعها. التطبيق لا يدّعي، وإنت تقرّ.
     */
    up(db, tx) {
      return backfill(tx, 'expressionOccurrences', (row) => {
        if (row.sourceType === 'manual') {
          row.sourceType = 'unknown';
          return row;
        }
      });
    },
  },

  {
    v: 11,
    note: 'مختبر التطوّر — إدارة تطوير التطبيق نفسه',
    /*
     * أربعة stores جديدة بالكامل: **إضافةٌ محضة لا تمسّ سجلًا قائمًا**،
     * ولا حقلَ يُضاف إلى أي store منشور. فذكرياتك لا تُقرأ ولا تُكتب
     * في هذه الترقية إطلاقًا.
     *
     * ⚠️ ولا حقلَ `briefId` على الملاحظة: العضويّة **علاقةٌ** في
     *    `relationships` بنوع `brief:issue` — نفس ما فُعل بالخيوط في
     *    v9 وبالمشاركين في WS9 (بلا ترقيةٍ أصلًا). فحذفُ Brief لا
     *    يُعيد كتابة ملاحظاته، وهي تبقى قائمةً بذاتها.
     *
     * ⚠️ واللقطات تُخزَّن في `media` القائم لا في مستودعٍ رابع للصور.
     *    `devShots` يحمل ما يخصّ الملاحظة وحدها: قبل أم بعد، وأيُّ
     *    جزءٍ من الصورة. والبايتات حيث تعرف بقيّةُ التطبيق أن تجدها —
     *    فالنسخة الاحتياطيّة تأخذها بلا أن تتعلّم شيئًا جديدًا.
     */
    up(db) {
      for (const name of ['devIssues', 'devBriefs', 'devEvents', 'devShots']) {
        createStore(db, name);
      }
    },
  },

  {
    v: 12,
    note: 'مسودّة المذاكرة — ما تكتبه عن الجملة يبقى للجملة',
    /*
     * store واحد جديد: **إضافةٌ محضة**. لا سجلَّ قائمًا يُقرأ ولا
     * يُكتَب، ولا حقلَ يُضاف إلى store منشور. ذكرياتُك لا تُلمَس في
     * هذه الترقية إطلاقًا — كما في v11 بالضبط.
     *
     * ⚠️ ولا علاقةَ لها بـ`contentBlocks` رغم أن كليهما «نصٌّ حرّ».
     *    الكتلة تخصّ **ذكرى** وفهرسُها `scene_kind` يفرض واحدةً لكلّ
     *    نوعٍ في كلّ ذكرى؛ والمسودّة تخصّ **جملةً أو كلمة**، وقد
     *    تكون الجملة في ذكرياتٍ عدّة أو في لا ذكرى. فحشرُها هناك
     *    يعني تلويثَ `sceneId` بمعنًى ثانٍ — وهو أوّلُ الطريق إلى
     *    حقلٍ لا أحدَ يعرف ماذا يعني بعد سنة.
     */
    up(db) {
      createStore(db, 'studyDrafts');
    },
  },

  // ------------------------------------------------------------------
  // الترقيات القادمة تُضاف هنا برقم جديد.
  // ممنوع تعديل ترقية سبق نشرها — راجع docs/03-architecture.md §3.6
  // ------------------------------------------------------------------
];

/** أعلى إصدار في قائمة الترقيات — هو إصدار قاعدة البيانات المطلوب. */
export const TARGET_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.v), 1);

/**
 * ينفّذ كل الترقيات اللازمة للانتقال من oldVersion إلى newVersion.
 * يُستدعى داخل onupgradeneeded حصرًا.
 */
export function runMigrations(db, tx, oldVersion, newVersion) {
  const applied = [];
  for (const migration of MIGRATIONS) {
    if (migration.v > oldVersion && migration.v <= newVersion) {
      migration.up(db, tx);
      applied.push(migration.v);
    }
  }
  return applied;
}

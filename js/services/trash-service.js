/**
 * LingoLife — السلة كمنظومة واحدة
 *
 * القاعدة التي تحرسها هذه الخدمة سطرٌ واحد:
 *
 *   **لا شيء يختفي من الواجهة ويبقى عالقًا في القاعدة.**
 *
 * كان الحذف موزَّعًا: `repo.trash()` يُنادى من سبعة مواضع، وشاشة السلة
 * تقرأ المشاهد وحدها. فكل ما عداها كان يختفي بعد زوال إشعار «تراجع»
 * ويبقى في القاعدة بلا طريق إليه — موجودٌ ومفقود معًا.
 *
 * الحلّ ليس إضافة الأنواع الستّة الباقية يدويًّا، بل **سجلّ واحد**
 * (`TRASHABLE`) هو مصدر الحقيقة: منه تُبنى الشاشة، وعليه يُختبَر أن كل
 * مستودعٍ يمكن نقله للسلة مسجَّلٌ فيه. مَن يضيف نوعًا جديدًا ولا يسجّله
 * يسقط اختبارُه — لا مستخدمُه.
 *
 * ثلاث دقائق تستحقّ الانتباه:
 *
 *  · **العنصر المعروض ليس دائمًا السجلّ المحذوف.** إزالة صورة من ذكرى
 *    تنقل *الرابط* للسلة ويبقى الملفّ سليمًا. الصفّ يُبنى من الرابط
 *    ويُعرَض بالصورة — لأن ما تتذكّره أنت هو الصورة لا الرابط.
 *
 *  · **الاستعادة تُعيد العلاقة لا السجلّ وحده.** سكريبتٌ يعود بينما
 *    ذكراه في السلة يعود إلى العدم نفسه. لذلك نكشف السلسلة ونعرضها.
 *
 *  · **الأرشفة ليست حذفًا.** النوع المؤرشف لا يدخل السلة: هو قرارٌ
 *    بإخفائه من قوائم الاختيار، لا بالتخلّص منه.
 */

import { STATE, STORES } from '../db/schema.js';
import {
  ALL_REPOS,
  scenes,
  scripts,
  conversationParts,
  mistakeComparisons,
  expressions,
  expressionOccurrences,
  savedItems,
  sceneMediaLinks,
  media,
} from '../db/repositories.js';
import { scriptTypeLabel } from './content-service.js';

/* ------------------------------------------------------------------ *
 * قراءة المحذوف
 * ------------------------------------------------------------------ */

/**
 * يقرأ سجلات مستودع المنقولة للسلة.
 *
 * يستعمل فهرس `state` حيث وُجد. وحيث لم يوجد يمسح المستودع ويصفّي —
 * وهو مقبولٌ هنا وحده: السلة تُفتح نادرًا وتحمل قليلًا، والبديل ترقيةُ
 * schema لأجل شاشةٍ واحدة.
 */
function hasStateIndex(storeName) {
  return (STORES[storeName]?.indexes || []).some(([name]) => name === 'state');
}

async function trashedIn(repo) {
  if (hasStateIndex(repo.storeName)) {
    try {
      return await repo.byIndex('state', STATE.TRASHED);
    } catch {
      /* الفهرس غائب في قاعدة أقدم من تعريفه — نكمل بالمسح */
    }
  }
  const all = await repo.getAll();
  return all.filter((r) => r.state === STATE.TRASHED);
}

/** نصّ مقتطع لعنوان الصفّ. */
function clip(text, max = 70) {
  const clean = (text || '').trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * قراءةٌ لا تنفجر على مفتاحٍ غائب.
 *
 * ⚠️ ضرورية لا تجميلية: صفوف السلة تُبنى بمتابعة مفاتيح خارجية
 *    (`mediaId`، `expressionId`). سجلٌّ ناقص — من استيرادٍ مبتور أو
 *    ترقيةٍ قديمة — كان يُسقِط `listTrash` كلها، فتختفي **كل** السلة
 *    بسبب صفٍّ واحد. وهذا نقيض الغرض من الشاشة نفسها.
 */
async function safeGet(repo, id) {
  if (!id) return null;
  try {
    return (await repo.get(id)) || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * السجلّ — مصدر الحقيقة الوحيد
 * ------------------------------------------------------------------ */

/**
 * كل نوع يمكن نقله إلى السلة.
 *
 * @typedef {object} TrashKind
 * @property {string} store اسم الـ store — مفتاح المطابقة في الاختبار
 * @property {object} repo
 * @property {string} label اسم النوع للعرض
 * @property {string} icon
 * @property {number} order ترتيب المجموعة في الشاشة
 * @property {(record: object) => Promise<object>} row يبني صفّ العرض
 */
export const TRASHABLE = Object.freeze([
  {
    store: 'scenes',
    repo: scenes,
    label: 'ذكريات',
    icon: 'life',
    order: 1,
    async row(record) {
      return {
        title: record.titleAr || record.titleRu || 'ذكرى بلا عنوان',
        subtitle: record.date || '',
        sceneId: null,
      };
    },
  },

  {
    store: 'scripts',
    repo: scripts,
    label: 'سكريبتات',
    icon: 'script',
    order: 2,
    async row(record) {
      return {
        title: record.title || scriptTypeLabel(record.type),
        subtitle: clip(record.text),
        ru: true,
        sceneId: record.sceneId || null,
      };
    },
  },

  {
    store: 'conversationParts',
    repo: conversationParts,
    label: 'أجزاء محادثة',
    icon: 'chat',
    order: 3,
    async row(record) {
      return {
        title: clip(record.text) || 'جزء بلا نصّ',
        subtitle: record.speaker || '',
        ru: true,
        sceneId: record.sceneId || null,
      };
    },
  },

  {
    store: 'mistakeComparisons',
    repo: mistakeComparisons,
    label: 'تصحيحات',
    icon: 'compare',
    order: 4,
    async row(record) {
      return {
        title: clip(record.natural) || clip(record.wrong) || 'تصحيح',
        subtitle: record.wrong ? `بدل: ${clip(record.wrong, 40)}` : '',
        ru: true,
        sceneId: record.sceneId || null,
      };
    },
  },

  {
    store: 'expressions',
    repo: expressions,
    label: 'تعبيرات',
    icon: 'language',
    order: 5,
    async row(record) {
      return {
        title: record.text,
        subtitle: record.meaningAr || '',
        ru: true,
        sceneId: null,
      };
    },
  },

  {
    /*
     * الظهور المُزال: التعبير حيٌّ في ذكرياتٍ أخرى، وما شِيل هو ظهوره
     * في هذه الذكرى وحدها. يُعرَض بنصّ تعبيره لا بمعرّفه، وإلا كان
     * صفًّا لا يعني شيئًا.
     */
    store: 'expressionOccurrences',
    repo: expressionOccurrences,
    label: 'تعبيرات مشالة من ذكرى',
    icon: 'language',
    order: 6,
    async row(record) {
      const expression = await safeGet(expressions, record.expressionId);
      return {
        title: expression?.text || 'تعبير',
        subtitle: 'اتشال من ذكرى واحدة',
        ru: true,
        sceneId: record.sceneId || null,
        /* استعادته وحده لا تكفي إن كان تعبيره نفسه في السلة. */
        alsoRestore: expression?.state === STATE.TRASHED
          ? [{ store: 'expressions', id: expression.id }]
          : [],
      };
    },
  },

  {
    store: 'savedItems',
    repo: savedItems,
    label: 'محفوظات',
    icon: 'tag',
    order: 7,
    async row(record) {
      return {
        title: record.text,
        subtitle: record.note || (record.kind === 'word' ? 'كلمة' : 'جملة'),
        ru: true,
        sceneId: record.sceneId || null,
      };
    },
  },

  {
    /*
     * الصور والأصوات: ما يُنقَل للسلة هو الرابط بالذكرى، والملفّ يبقى
     * سليمًا في `media`. الصفّ يُبنى من الرابط ويُعرَض بالملفّ.
     */
    store: 'sceneMediaLinks',
    repo: sceneMediaLinks,
    label: 'صور وأصوات مشالة من ذكرى',
    icon: 'image',
    order: 8,
    async row(record) {
      const file = await safeGet(media, record.mediaId);
      const isAudio = file?.kind === 'audio';
      return {
        title: file?.caption || file?.filename || (isAudio ? 'تسجيل' : 'صورة'),
        subtitle: isAudio ? 'تسجيل صوتي' : 'صورة',
        icon: isAudio ? 'mic' : 'image',
        mediaId: record.mediaId,
        sceneId: record.sceneId || null,
      };
    },
  },
]);

/**
 * مستودعات لا تدخل السلة، ولكلٍّ سببه.
 *
 * ⚠️ هذه ليست قائمةَ إهمال بل **إقرارٌ صريح**. الاختبار يقارن بها:
 *    كل مستودع إمّا في `TRASHABLE` وإمّا هنا بسببٍ مكتوب. لا ثالث.
 */
export const NOT_TRASHABLE = Object.freeze({
  scriptVersions: 'تاريخ السكريبت لا يُحذف أبدًا (بند 28)',
  contentVersions: 'تاريخ الكتل لا يُحذف',
  contentBlocks: 'تُنشأ مع المشهد وتموت معه — لا تُحذف وحدها',
  conversations: 'حاوية للأجزاء؛ يُحذف الجزء لا الحاوية',
  sentencePatterns: 'يُولَّد من التحليل — لا حذف من الواجهة بعد',
  words: 'تُولَّد من التحليل — لا حذف من الواجهة بعد',
  people: 'لا حذف من الواجهة بعد (WS1-ب)',
  places: 'لا حذف من الواجهة بعد',
  journeys: 'لا حذف من الواجهة بعد',
  topics: 'لا حذف من الواجهة بعد',
  tags: 'لا حذف من الواجهة بعد',
  relationships: 'تُزال بإلغاء الربط لا بالسلة',
  shadowSessions: 'لا حذف من الواجهة بعد',
  shadowSegments: 'تتبع جلستها',
  practiceEvidence: 'دليل ممارسة مؤرَّخ — لا يُحذف (بند 19)',
  reviewItems: 'يُولَّد من جدولة المراجعة',
  reviewHistory: 'سجلّ مراجعة — لا يُحذف',
  analysisRuns: 'تاريخ التحليل يبقى (بند 93)',
  analysisProposals: 'تتبع تشغيلها',
  media: 'الملفّ يبقى؛ ما يُشال هو ربطه بالذكرى',
  syncQueue: 'طابور تشغيل داخلي',
  nativeAudio: 'ذاكرة تسجيلات خارجية — تُمسح كلها من الإعدادات لا واحدًا واحدًا',
  projectContext: 'إعدادات لا محتوى',
  promptVersions: 'إعدادات لا محتوى',
  backupHistory: 'سجلّ النسخ — لا يُحذف',
});

/** يجد تعريف نوعٍ باسم الـ store. */
export function kindOf(store) {
  return TRASHABLE.find((k) => k.store === store) || null;
}

/* ------------------------------------------------------------------ *
 * الاستعلام
 * ------------------------------------------------------------------ */

/**
 * كل ما في السلة، مجمَّعًا بالنوع والأحدث أولًا.
 *
 * @returns {Promise<{ store, label, icon, order, items: object[] }[]>}
 */
export async function listTrash() {
  const groups = await Promise.all(
    TRASHABLE.map(async (kind) => {
      const records = await trashedIn(kind.repo);
      const items = await Promise.all(
        records.map(async (record) => {
          const base = {
            id: record.id,
            store: kind.store,
            icon: kind.icon,
            deletedAt: record.deletedAt || record.updatedAt || 0,
            alsoRestore: [],
          };
          try {
            return { ...base, ...(await kind.row(record)) };
          } catch {
            /*
             * سجلٌّ لا نعرف كيف نعرضه **يظهر ولا يُبتلَع**. إخفاؤه
             * يعيدنا إلى العطل الأصلي بالضبط: شيءٌ في القاعدة بلا
             * طريق إليه. صفٌّ بلا عنوان أفضل من غياب.
             */
            return { ...base, title: `عنصر غير مقروء (${kind.store})`, subtitle: record.id };
          }
        })
      );
      items.sort((a, b) => b.deletedAt - a.deletedAt);
      return { store: kind.store, label: kind.label, icon: kind.icon, order: kind.order, items };
    })
  );

  return groups.filter((g) => g.items.length).sort((a, b) => a.order - b.order);
}

/** عدد ما في السلة — لشارة الشاشة. */
export async function trashCount() {
  const groups = await listTrash();
  return groups.reduce((sum, g) => sum + g.items.length, 0);
}

/* ------------------------------------------------------------------ *
 * الاستعادة
 * ------------------------------------------------------------------ */

/**
 * هل استعادة هذا العنصر تكفي لرؤيته؟
 *
 * سكريبتٌ يعود بينما ذكراه في السلة يعود إلى الاختفاء نفسه. نكشف ذلك
 * **قبل** الاستعادة فيقرّر المستخدم، بدل أن نستعيد شيئًا لا يظهر.
 *
 * @returns {Promise<{ blocked: boolean, sceneId?: string, sceneTitle?: string }>}
 */
export async function restoreBlockedBy(item) {
  const scene = await safeGet(scenes, item.sceneId);
  if (!scene) return { blocked: false };
  if (scene.state !== STATE.TRASHED) return { blocked: false };
  return {
    blocked: true,
    sceneId: scene.id,
    sceneTitle: scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان',
  };
}

/**
 * يستعيد عنصرًا وما يلزم لرؤيته.
 *
 * @param {object} item صفٌّ من `listTrash`
 * @param {{ withScene?: boolean }} options استعادة الذكرى الحاوية معه
 */
export async function restoreItem(item, { withScene = false } = {}) {
  const kind = kindOf(item.store);
  if (!kind) throw new Error(`نوع غير مسجَّل في السلة: ${item.store}`);

  // التبعيّات أولًا: التعبير قبل ظهوره، والذكرى قبل ما فيها — وإلا
  // استعدنا سجلًّا يبقى محجوبًا.
  for (const dep of item.alsoRestore || []) {
    const depKind = kindOf(dep.store);
    if (depKind) await depKind.repo.restore(dep.id);
  }

  if (withScene) {
    const scene = await safeGet(scenes, item.sceneId);
    if (scene?.state === STATE.TRASHED) await scenes.restore(item.sceneId);
  }

  await kind.repo.restore(item.id);
}

/* ------------------------------------------------------------------ *
 * الحذف النهائي
 * ------------------------------------------------------------------ */

/**
 * ما الذي يفقده الحذف النهائي معه؟
 *
 * البند 12 يمنع تدمير المرتبطات صامتًا. نحسبها **قبل** السؤال فيظهر
 * في التأكيد ما سيُفقَد بالاسم والعدد.
 *
 * @returns {Promise<{ label: string, count: number }[]>}
 */
export async function linkedTo(item) {
  const out = [];

  if (item.store === 'scenes') {
    const [sceneScripts, parts, mistakes, links] = await Promise.all([
      scripts.byIndex('sceneId', item.id),
      conversationParts.byIndex('sceneId', item.id),
      mistakeComparisons.byIndex('sceneId', item.id),
      sceneMediaLinks.byIndex('sceneId', item.id),
    ]);
    if (sceneScripts.length) out.push({ label: 'سكريبت', count: sceneScripts.length });
    if (parts.length) out.push({ label: 'جزء محادثة', count: parts.length });
    if (mistakes.length) out.push({ label: 'تصحيح', count: mistakes.length });
    if (links.length) out.push({ label: 'صورة أو تسجيل', count: links.length });
  }

  if (item.store === 'expressions') {
    const occurrences = await expressionOccurrences.byIndex('expressionId', item.id);
    if (occurrences.length) out.push({ label: 'ظهور في ذكرى', count: occurrences.length });
  }

  return out;
}

/**
 * محوٌ نهائي — بلا رجعة.
 *
 * ⚠️ لا تُنادَ إلا بعد تأكيدٍ صريحٍ ثانٍ يعرض `linkedTo` (بند 12).
 *    ولا تمسّ `media`: الملفّ يبقى وإن مُحي ربطه.
 */
export async function destroyItem(item) {
  const kind = kindOf(item.store);
  if (!kind) throw new Error(`نوع غير مسجَّل في السلة: ${item.store}`);
  await kind.repo.destroy(item.id);
}

/**
 * فحص سلامة: هل يوجد محذوفٌ في مستودعٍ غير مسجَّل؟
 *
 * هذه هي الدالّة التي يستعملها الاختبار الحارس. تُصدق حين يضيف أحدهم
 * `repo.trash()` لمستودعٍ جديد وينسى تسجيله — فيسقط الاختبار قبل أن
 * يختفي شيءٌ من أمام المستخدم.
 *
 * @returns {Promise<{ store: string, count: number }[]>} مستودعات فيها
 *          محذوفٌ ولا تظهر في السلة
 */
export async function findStrandedTrash() {
  const covered = new Set(TRASHABLE.map((k) => k.store));
  const stranded = [];

  await Promise.all(
    Object.entries(ALL_REPOS).map(async ([store, repo]) => {
      if (covered.has(store)) return;
      const rows = await trashedIn(repo);
      if (rows.length) stranded.push({ store, count: rows.length });
    })
  );

  return stranded.sort((a, b) => a.store.localeCompare(b.store));
}

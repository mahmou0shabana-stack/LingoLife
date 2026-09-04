/**
 * LingoLife — فهرسُ البرومبتات الموحَّد (WS-PL3 · بنود ٢ و٨ و٦٠ و٦١)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العطبُ الذي وُلدت هذه الوحدةُ لإصلاحه — وهو عطبُ **تسميةٍ** لا عدّاد
 * ═══════════════════════════════════════════════════════════════
 *
 * كانت الشاشةُ تقول «كل البرومبتات · ٠» وبجوارها «طلبات التحليل · ٣».
 * والرقمان صحيحان كلاهما: الأوّلُ يعدُّ صفوفَ `promptVersions`، والثاني
 * يعدُّ مصفوفةً مُجمَّدةً في `library.js`. **والكذبةُ في الكلمة «كل»**.
 *
 * ولم تكن الشاشةُ تعرض وجهين لمجموعةٍ واحدة، بل **كونين منفصلين**:
 * قائمتان مختلفتان وعارضان مختلفان (`builtinListHtml` و`builtinViewerHtml`).
 * فالإصلاحُ ليس رقمًا يُجمَع، بل طبقةٌ تجعل الكونَين كونًا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **اكتشافُ الفهرسِ الموحَّد لا يعني توحيدَ التخزين** (بند ٢)
 * ═══════════════════════════════════════════════════════════════
 *
 * أسهلُ حلٍّ — وأسوؤه — أن نَنسخ البرومبتاتِ المبنيّةَ إلى
 * `promptVersions` فتصير الشاشةُ قائمةً واحدة. وهذا يصنع **حقيقتين
 * لبرومبتٍ واحد**: لو حسَّنّا `analyze-scene` في الكود غدًا، بقيت
 * النسخةُ المنسوخةُ في قاعدتك كما هي، ولا تعرف أيَّهما استُعمل.
 *
 * فهذه الوحدةُ **تقرأ ولا تنسخ**. كلُّ مصدرٍ يبقى صاحبَ حقيقته:
 *
 *   شخصيّ   → `promptVersions`  (يُكتَب فيه)
 *   تحليل   → `PROMPTS`          (مُجمَّدٌ في الكود — مولِّدٌ لا نصّ)
 *   جملة    → `LEARN_PROMPTS`    (مُجمَّدٌ في الكود — قالبٌ بمتغيّر)
 *   إعدادات → `settings`         (يُكتَب عبر خدمته وحدَها)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولمَ `previewInstructions` هي الجسدُ الصادقُ لطلب التحليل**
 * ═══════════════════════════════════════════════════════════════
 *
 * طلباتُ التحليل ليست نصًّا ثابتًا: `buildPrompt` يبني **حزمةَ JSON**
 * تحتاج ذكرى كاملة. فلا «جسدَ» لها تنسخه بلا ذكرى. لكنّ
 * `previewInstructions` تعيد التعليماتِ وحدَها بلا مادّةٍ ولا ذكرى —
 * وهي بالضبط ما يقرؤه الإنسانُ ويصلح للنسخ.
 *
 * فالمعروضُ هنا تعليماتُها الحقيقيّة، **لا نسخةٌ ثانيةٌ منها**، ومسارُ
 * الاستعمال الفعليّ يبقى `buildPrompt` كما هو (قيد المالك ١).
 */

import { settings } from '../../db/repositories.js';
import {
  PROMPTS, LEARN_PROMPTS, previewInstructions, extraInstructions, promptById,
} from './library.js';
import {
  listPrompts, createPrompt, toggleFavorite, markOpened, markCopied,
  NO_CATEGORY, tagKey,
} from './user-prompts.js';

/* ------------------------------------------------------------------ *
 * الهُويّة
 * ------------------------------------------------------------------ */

/**
 * أصنافُ المصادر.
 *
 * ⚠️ **وهذه أسماءٌ داخليّةٌ لا تُعرَض** (بند ٥): الشاشةُ تعرض
 *    `SOURCE_LABEL`، لأنّ المستعمِلَ يسأل «ما نوعُ هذا البرومبت؟»
 *    لا «أين ثابتُه في الجافاسكربت؟».
 */
export const SOURCE = Object.freeze({
  PERSONAL: 'personal',
  ANALYSIS: 'analysis',
  SENTENCE: 'sentence',
  EXTRA: 'extra',
});

/** ما يراه الإنسان. */
export const SOURCE_LABEL = Object.freeze({
  [SOURCE.PERSONAL]: 'شخصي',
  [SOURCE.ANALYSIS]: 'تحليل',
  [SOURCE.SENTENCE]: 'جملة',
  [SOURCE.EXTRA]: 'إعدادات',
});

/**
 * مفتاحُ الفهرس — **صنفُ المصدر ومعرّفُه فيه** (بندا ٦٠ و٦١).
 *
 * ⚠️ **ولا العنوانُ هُويّةً أبدًا.** «Core Chunks» قد يكون برومبتًا
 *    مبنيًّا ونسخةً شخصيّةً منه في وقتٍ واحد، وهما شيئان يجب أن
 *    يتعايشا. ودمجُهما بالعنوان يُخفي أحدَهما بلا أن يُخطئ أحد.
 *
 * ⚠️ **وإعادةُ تسمية برومبتك لا تكسر مفضّلتَه**: المفتاحُ معرّفُ الصفّ
 *    لا عنوانُه.
 */
export const catalogKey = (kind, id) => `${kind}:${id}`;

/* ------------------------------------------------------------------ *
 * تفضيلاتُك على ما لا تملكه
 * ------------------------------------------------------------------ */

const META_KEY = 'prompts.catalogMeta';

/**
 * مفضّلةُ برومبتٍ مبنيٍّ واستعمالُه — **في تفضيلاتك لا في كوده**
 * (بندا ٩ و٤٨).
 *
 * ⚠️ **ولمَ لا نكتب `favorite` على `PROMPTS`؟** لأنها مُجمَّدةٌ
 *    بـ`Object.freeze`، ولأنّ تفضيلَك رأيُك أنت لا صفةٌ في المنتَج.
 *    وبرومبتٌ مبنيٌّ يتغيّر مع تحديث التطبيق، ورأيُك فيه لا يتغيّر معه.
 */
export async function catalogMeta() {
  const stored = await settings.get(META_KEY, null);
  return stored && typeof stored === 'object' ? stored : {};
}

async function patchMeta(key, patch) {
  const all = await catalogMeta();
  const next = { ...all, [key]: { ...(all[key] || {}), ...patch } };
  await settings.set(META_KEY, next);
  return next[key];
}

/* ------------------------------------------------------------------ *
 * بناءُ العنصر
 * ------------------------------------------------------------------ */

/**
 * القالبُ يُعرَض بمتغيّره ظاهرًا (قيد المالك ٢).
 *
 * ⚠️ **وهذا النصُّ متغيّرٌ حقيقيٌّ لا زينة**: `findPlaceholders` تكشف
 *    `[...]`، فيملؤه المستعمِلُ من المكتبة بآلةِ المتغيّرات القائمة
 *    (بند ٣٩) — ويملؤه الشادوينج بالجملة الحاليّة. **برومبتٌ واحدٌ
 *    بهُويّةٍ واحدة، وسياقان يملآنه.** لا صفٌّ ثانٍ للشادوينج.
 */
export const SENTENCE_SLOT = '[ضع الجملة الروسية هنا]';

const personalItem = (row) => ({
  catalogId: catalogKey(SOURCE.PERSONAL, row.id),
  sourceKind: SOURCE.PERSONAL,
  sourceId: row.id,
  title: row.title || 'بلا عنوان',
  body: row.body || '',
  purpose: row.purpose || '',
  category: row.category || NO_CATEGORY,
  tags: row.tags || [],
  editable: true,
  deletable: true,
  copyable: true,
  favorite: Boolean(row.favorite),
  opens: row.opens || 0,
  copies: row.copies || 0,
  lastOpenedAt: row.lastOpenedAt || null,
  lastCopiedAt: row.lastCopiedAt || null,
  lastModified: row.updatedAt || null,
  row,
});

const frozenItem = (kind, one, body, meta) => ({
  catalogId: catalogKey(kind, one.id),
  sourceKind: kind,
  sourceId: one.id,
  title: one.label || one.id,
  body,
  purpose: one.purpose || '',
  category: SOURCE_LABEL[kind],
  tags: [],
  /*
   * ⚠️ **لا تحريرَ مباشرًا لما تملكه آلةُ التطبيق** (بندا ٦ و٣١):
   *    طلبُ التحليل عقدُ ردٍّ يقرؤه الاستيراد، وتحريرُه يكسر الخطَّ
   *    كلَّه بلا عَرَضٍ ظاهر. والبابُ المفتوح: «انسخه إلى برومبتاتي».
   */
  editable: false,
  deletable: false,
  copyable: true,
  favorite: Boolean(meta?.favorite),
  opens: meta?.opens || 0,
  copies: meta?.copies || 0,
  lastOpenedAt: meta?.lastOpenedAt || null,
  lastCopiedAt: meta?.lastCopiedAt || null,
  lastModified: null,
});

/* ------------------------------------------------------------------ *
 * جمعُ الفهرس
 * ------------------------------------------------------------------ */

/**
 * كلُّ ما يمكنك اكتشافُه في المكتبة — من مصادره كلِّها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ومصدرٌ يسقط لا يُفرغ المكتبة** (بند ٥٩)
 * ═══════════════════════════════════════════════════════════════
 *
 * لو فشلت قراءةُ `promptVersions` بقيت البرومبتاتُ المبنيّةُ ظاهرة،
 * ويعود الخطأُ في `errors` لتقوله الشاشةُ صراحةً. والبديلُ — أن يرمي
 * الجمعُ كلُّه — يُخفي عائلةَ برومبتاتٍ كاملةً خلف عطبٍ في غيرها.
 *
 * @returns {Promise<{items: object[], errors: {source: string, message: string}[]}>}
 */
export async function buildCatalog() {
  const errors = [];
  const items = [];
  const meta = await catalogMeta().catch(() => ({}));

  /* ١) برومبتاتك — المصدرُ الوحيدُ الذي يُكتَب فيه. */
  try {
    for (const row of await listPrompts()) items.push(personalItem(row));
  } catch (error) {
    errors.push({ source: SOURCE.PERSONAL, message: error?.message || 'تعذّرت قراءة برومبتاتك' });
  }

  /* ٢) طلباتُ التحليل — تعليماتُها الحقيقيّةُ بلا ذكرى. */
  try {
    for (const one of PROMPTS) {
      const lines = await previewInstructions(one.id);
      items.push(frozenItem(
        SOURCE.ANALYSIS, one, (lines || []).join('\n'),
        meta[catalogKey(SOURCE.ANALYSIS, one.id)]
      ));
    }
  } catch (error) {
    errors.push({ source: SOURCE.ANALYSIS, message: error?.message || 'تعذّرت قراءة طلبات التحليل' });
  }

  /* ٣) برومبتاتُ الجملة — القالبُ بمتغيّره ظاهرًا. */
  try {
    for (const one of LEARN_PROMPTS) {
      items.push(frozenItem(
        SOURCE.SENTENCE, one, one.build(SENTENCE_SLOT),
        meta[catalogKey(SOURCE.SENTENCE, one.id)]
      ));
    }
  } catch (error) {
    errors.push({ source: SOURCE.SENTENCE, message: error?.message || 'تعذّرت قراءة برومبتات الجملة' });
  }

  /* ٤) تعليماتُك المضافة — وما كتبتَه فعلًا فقط. */
  try {
    const extras = await extraInstructions();
    for (const [promptId, text] of Object.entries(extras)) {
      const body = String(text || '').trim();
      /*
       * ⚠️ **ولا عنصرَ لتعليماتٍ فارغة** (بند ٤٧): إظهارُ ثلاثةِ صفوفٍ
       *    فارغةٍ لأنّ المفاتيحَ الثلاثةَ موجودةٌ يصنع عددًا كاذبًا.
       */
      if (!body) continue;
      const owner = promptById(promptId);
      items.push({
        catalogId: catalogKey(SOURCE.EXTRA, promptId),
        sourceKind: SOURCE.EXTRA,
        sourceId: promptId,
        title: `تعليماتك على «${owner?.label || promptId}»`,
        body,
        purpose: 'تُلحَق بهذا الطلب في كلّ مرّة — ولا تستبدل قواعده.',
        category: SOURCE_LABEL[SOURCE.EXTRA],
        tags: [],
        /* تُحرَّر — لكن عبر خدمتها هي، لا بنسخةٍ ثانيةٍ هنا (قيد ٣). */
        editable: true,
        deletable: false,
        copyable: true,
        favorite: Boolean(meta[catalogKey(SOURCE.EXTRA, promptId)]?.favorite),
        opens: meta[catalogKey(SOURCE.EXTRA, promptId)]?.opens || 0,
        copies: meta[catalogKey(SOURCE.EXTRA, promptId)]?.copies || 0,
        lastOpenedAt: meta[catalogKey(SOURCE.EXTRA, promptId)]?.lastOpenedAt || null,
        lastCopiedAt: meta[catalogKey(SOURCE.EXTRA, promptId)]?.lastCopiedAt || null,
        lastModified: null,
      });
    }
  } catch (error) {
    errors.push({ source: SOURCE.EXTRA, message: error?.message || 'تعذّرت قراءة تعليماتك' });
  }

  return { items, errors };
}

/* ------------------------------------------------------------------ *
 * الأوجه والعدّ
 * ------------------------------------------------------------------ */

export const VIEW = Object.freeze({
  ALL: 'all',
  MINE: 'mine',
  FAV: 'fav',
  RECENT: 'recent',
});

/** استُعمل فعلًا — فتحًا أو نسخًا. أساسُ «الأخيرة» عبر المصادر (بند ١٠). */
const used = (item) => item.lastOpenedAt || item.lastCopiedAt;
const usedAt = (item) => Math.max(item.lastOpenedAt || 0, item.lastCopiedAt || 0);

/**
 * العدّادُ من نفس دلالةِ القائمة (بندا ٢١ و٤٧).
 *
 * ⚠️ **ولا رقمَ يُحسَب بطريقٍ ثانٍ**: لو عدَّت «الكل» من مكانٍ وعرضت
 *    القائمةُ من مكانٍ آخر، افترقا يومًا بلا أن يُخطئ أحدُهما ظاهريًّا.
 */
export function countsOf(items) {
  const counts = {
    [VIEW.ALL]: items.length,
    [VIEW.MINE]: 0,
    [VIEW.FAV]: 0,
    [VIEW.RECENT]: 0,
    bySource: {},
  };
  for (const item of items) {
    if (item.sourceKind === SOURCE.PERSONAL) counts[VIEW.MINE] += 1;
    if (item.favorite) counts[VIEW.FAV] += 1;
    if (used(item)) counts[VIEW.RECENT] += 1;
    counts.bySource[item.sourceKind] = (counts.bySource[item.sourceKind] || 0) + 1;
  }
  return counts;
}

/** التصنيفاتُ عبر الفهرس — بعددٍ حقيقيّ (بند ٥٤). */
export function catalogCategories(items) {
  const counts = new Map();
  for (const item of items) {
    const name = item.category || NO_CATEGORY;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/* ------------------------------------------------------------------ *
 * البحثُ والتصفية
 * ------------------------------------------------------------------ */

const haystack = (item) => [
  item.title, item.body, item.purpose, item.category,
  SOURCE_LABEL[item.sourceKind], (item.tags || []).join(' '),
].join('\n').toLocaleLowerCase('ar');

/**
 * تصفيةٌ تُركَّب: وجهٌ + مصدرٌ + تصنيفٌ + وسمٌ + بحث (بند ٥٦).
 *
 * ⚠️ **والبحثُ يعبر المصادرَ كلَّها** (بند ١١): «تحليل» تجد الطلبَ
 *    المبنيّ، و«Core» تجد قالبَك الشخصيّ. ومصدرٌ لا يُبحَث فيه مصدرٌ
 *    غيرُ موجودٍ عمليًّا مهما ظهر في تبويب.
 */
export function filterCatalog(items, filters = {}) {
  const { view = VIEW.ALL, query = '', category = '', tag = '', source = '' } = filters;
  let list = items;

  if (view === VIEW.MINE) list = list.filter((one) => one.sourceKind === SOURCE.PERSONAL);
  else if (view === VIEW.FAV) list = list.filter((one) => one.favorite);
  else if (view === VIEW.RECENT) list = list.filter(used);

  if (source) list = list.filter((one) => one.sourceKind === source);
  if (category) list = list.filter((one) => (one.category || NO_CATEGORY) === category);
  if (tag) list = list.filter((one) => (one.tags || []).some((t) => tagKey(t) === tagKey(tag)));

  const needle = String(query || '').trim().toLocaleLowerCase('ar');
  if (needle) list = list.filter((one) => haystack(one).includes(needle));

  return view === VIEW.RECENT
    ? [...list].sort((a, b) => usedAt(b) - usedAt(a))
    : list;
}

/* ------------------------------------------------------------------ *
 * الأفعال — كلٌّ إلى صاحب حقيقته
 * ------------------------------------------------------------------ */

/**
 * يقلب المفضّلة **في المكان الصحيح** (بندا ٩ و٤٨).
 *
 * الشخصيُّ حقلٌ على صفّه، وغيرُه سطرٌ في تفضيلاتك. وفي الحالتين
 * لا يُمَسُّ كودُ برومبتٍ مبنيّ.
 */
export async function toggleCatalogFavorite(item) {
  if (item.sourceKind === SOURCE.PERSONAL) return toggleFavorite(item.sourceId);
  const next = !item.favorite;
  await patchMeta(item.catalogId, { favorite: next });
  return next;
}

/** يسجّل فتحًا — لكلّ المصادر، كلٌّ في مخزنه. */
export async function markCatalogOpened(item) {
  if (item.sourceKind === SOURCE.PERSONAL) return markOpened(item.sourceId);
  return patchMeta(item.catalogId, {
    opens: (item.opens || 0) + 1, lastOpenedAt: Date.now(),
  });
}

/** يسجّل نسخةً **نجحت** — لا ضغطة (نفس قاعدة `markCopied`). */
export async function markCatalogCopied(item) {
  if (item.sourceKind === SOURCE.PERSONAL) return markCopied(item.sourceId);
  return patchMeta(item.catalogId, {
    copies: (item.copies || 0) + 1, lastCopiedAt: Date.now(),
  });
}

/**
 * «أنشئ نسخةً قابلةً للتعديل» (بندا ٣٢ و٥٣).
 *
 * ⚠️ **ولا ارتباطَ صامتًا بالأصل** (قاعدة ١١): الناتجُ صفٌّ شخصيٌّ
 *    بمعرّفٍ جديدٍ لا يعرف أباه. فلو تغيّر المبنيُّ مع تحديثٍ غدًا لم
 *    تتغيّر نسختُك — وهو المقصود. وذكرُ المصدر يبقى في **الغرض**
 *    نصًّا يقرؤه الإنسان، لا حقلَ ربطٍ يوهم بتتبّعٍ لا يقع.
 */
export async function copyToPersonal(item) {
  return createPrompt({
    title: item.title,
    body: item.body,
    purpose: item.purpose,
    category: NO_CATEGORY,
    tags: [],
  });
}

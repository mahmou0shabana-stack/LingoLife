/**
 * LingoLife — برومبتاتُك أنت (WS-PL · بنود ١٠ إلى ١٧ و٤٨ و٤٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما وجدتُه في التدقيق — وهو غيرُ ما تتوقّعه المواصفة
 * ═══════════════════════════════════════════════════════════════
 *
 * «مكتبة الطلبات» القائمةُ **ليست مكتبةَ برومبتاتٍ يملكها المستعمل**.
 * هي **سجلٌّ مكتوبٌ في الكود** من ثلاثة طلبات (`analyze-scene` و
 * `new-scene` و`rehearse`) في `library.js`، كلٌّ منها يبني **حزمة JSON**
 * تمرّ على خطّ الاستيراد. و`PROMPTS` مُجمَّدةٌ بـ`Object.freeze`.
 *
 * والذي يملكه المستعملُ منها شيءٌ واحد: `settings['prompts.extra']` —
 * خريطةُ «تعليماتٍ إضافيّة» تُلحَق بكلّ طلب.
 *
 * فلا وجودَ لإنشاءٍ ولا حذفٍ ولا تصنيفاتٍ ولا وسومٍ ولا مفضّلة. أي أنّ
 * البرومبتاتِ التي تكتبها في ChatGPT — Core Chunks وTransfer Scene —
 * **لا مكانَ لها في التطبيق أصلًا**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا لا ترقيةَ مخطَّطٍ رغم ذلك (بندا ٤٨ و٧٣-T)
 * ═══════════════════════════════════════════════════════════════
 *
 * لأنّ المخزنَ **موجودٌ منذ زمن ونائم**:
 *
 *     promptVersions: { indexes: [['category', …], ['createdAt', …]] }
 *
 * له مستودعٌ في `repositories.js`، وسياسةُ مزامنةٍ تقول عنه حرفيًّا
 * «الطلباتُ التي كتبتَها — نصٌّ تملكه» (`C.CANONICAL`)، وفهرسان هما
 * بالضبط ما تحتاجه هذه الشاشة. **ولا يكتب فيه سطرٌ واحدٌ من الكود.**
 *
 * فالمطلوبُ أن يُستعمَل لا أن يُخترَع. لا هجرةَ بيانات، ولا رقمَ مخطَّطٍ
 * جديد، ولا مسارَ نسخٍ احتياطيٍّ ثانٍ — التغطيةُ قائمةٌ من قبلُ.
 *
 * ⚠️ **والطلباتُ الثلاثةُ المبنيّةُ لا تُمَسّ** (بند ٤٨): هي عقدُ ردٍّ
 *    يقرؤه الاستيراد، لا نصٌّ تحرّره. ودمجُها في مخزنٍ قابلٍ للتحرير
 *    يكسر خطَّ التحليل كلَّه. فتبقى حيث هي، وتُعرَض في المكتبة قسمًا
 *    مستقلًّا للقراءة.
 */

import { promptVersions } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';

/* ------------------------------------------------------------------ *
 * الشكل
 * ------------------------------------------------------------------ */

/**
 * صفُّ برومبت.
 *
 * ⚠️ **والحقولُ كلُّها على الصفّ لا في مخزنٍ ثانٍ**: `category` مفهرَسٌ
 *    أصلًا في المخطَّط، و`tags` مصفوفةٌ على الصفّ لأنّ الوسمَ هنا
 *    **واجهةُ تصفيةٍ** لا كيانٌ له صفحتُه. ومخزنُ `tags` العامُّ لأشياءَ
 *    أخرى، وخلطُهما يجعل حذفَ وسمٍ من هناك يُفرغ تصنيفَ برومبتٍ هنا.
 *
 * @typedef {{
 *   id: string, title: string, body: string, purpose: string,
 *   category: string, tags: string[], favorite: boolean,
 *   copies: number, opens: number,
 *   lastCopiedAt: number|null, lastOpenedAt: number|null,
 *   createdAt: number, updatedAt: number,
 * }} UserPrompt
 */

/** «بلا تصنيف» — قيمةٌ حقيقيّةٌ لا فراغ، كي يفهرسها المخزن. */
export const NO_CATEGORY = 'بدون تصنيف';

/** يوحّد وسمًا: بلا `#` وبلا مسافاتٍ زائدة، ويحفظ الحالة كما كتبتَها. */
export const normalizeTag = (tag) => String(tag || '')
  .replace(/^#/, '')
  .replace(/\s+/g, ' ')
  .trim();

/** مفتاحُ مقارنةِ الوسوم — الحالةُ لا تصنع وسمين. */
export const tagKey = (tag) => normalizeTag(tag).toLocaleLowerCase('ar');

const cleanTags = (tags) => {
  const seen = new Map();
  for (const one of tags || []) {
    const name = normalizeTag(one);
    if (!name) continue;
    if (!seen.has(tagKey(name))) seen.set(tagKey(name), name);
  }
  return [...seen.values()];
};

const now = () => Date.now();

/* ------------------------------------------------------------------ *
 * القراءة
 * ------------------------------------------------------------------ */

/** كلُّ برومبتاتك الحيّة — الأحدثُ تعديلًا أوّلًا. */
export async function listPrompts() {
  const rows = await promptVersions.getAll();
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export const getPrompt = (id) => promptVersions.get(id);

/**
 * التصنيفاتُ **من بياناتك** لا من قائمةٍ مكتوبةٍ في الكود (بند ١٠).
 *
 * ⚠️ ولا تُفرَض «Shadowing» و«Work» على أحد: التصنيفُ يُولَد حين تكتبه
 *    على برومبت، ويختفي حين لا يبقى فيه شيء. فلا مخزنَ تصنيفاتٍ يتقادم.
 */
export function categoriesOf(rows) {
  const counts = new Map();
  for (const row of rows) {
    const name = row.category || NO_CATEGORY;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/** الوسومُ المستعمَلةُ فعلًا وعددُ كلٍّ منها. */
export function tagsOf(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const tag of row.tags || []) {
      const key = tagKey(tag);
      if (!key) continue;
      const at = counts.get(key) || { name: normalizeTag(tag), count: 0 };
      at.count += 1;
      counts.set(key, at);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
}

/* ------------------------------------------------------------------ *
 * البحث (بند ٩)
 * ------------------------------------------------------------------ */

/**
 * فهرسُ بحثٍ يُبنى **مرّةً لكلّ قراءة** لا مرّةً لكلّ ضغطةِ مفتاح.
 *
 * ⚠️ **ولمَ فهرسٌ أصلًا؟** لأنّ متن البرومبت قد يبلغ عشراتِ الآلاف من
 *    الحروف، وألفَ برومبتٍ تعني ميغابايتاتٍ. وبناءُ `toLowerCase` لها
 *    كلِّها عند كلّ حرفٍ تكتبه في البحث هو نفسُ العطب الذي قِيس في
 *    مُتصفِّح الورشة (WS-P): مسحٌ كاملٌ كلَّ ٤٠ مِلّي ثانية.
 *
 * @param {UserPrompt[]} rows
 * @returns {Map<string,string>} معرِّفٌ ← سلسلةُ بحثٍ جاهزة
 */
export function buildSearchIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    index.set(row.id, [
      row.title || '',
      row.purpose || '',
      row.category || '',
      (row.tags || []).join(' '),
      row.body || '',
    ].join('\n').toLowerCase());
  }
  return index;
}

/**
 * يصفّي البرومبتات — **بمعايير مجتمعة** (بندا ٣٨ و٣٩).
 *
 * @param {UserPrompt[]} rows
 * @param {{query?: string, category?: string, tag?: string,
 *          favorite?: boolean, index?: Map<string,string>}} filters
 */
export function filterPrompts(rows, filters = {}) {
  const needle = String(filters.query || '').trim().toLowerCase();
  const index = filters.index;

  return rows.filter((row) => {
    if (filters.favorite && !row.favorite) return false;
    if (filters.category && (row.category || NO_CATEGORY) !== filters.category) return false;
    if (filters.tag && !(row.tags || []).some((one) => tagKey(one) === tagKey(filters.tag))) {
      return false;
    }
    if (!needle) return true;
    const hay = index?.get(row.id)
      ?? `${row.title}\n${row.purpose}\n${row.category}\n${(row.tags || []).join(' ')}\n${row.body}`
        .toLowerCase();
    return hay.includes(needle);
  });
}

/** ترتيباتٌ مدعومةٌ — **كلُّها مبنيّةٌ على حقلٍ حقيقيّ** (بند ٥٦). */
export const SORTS = Object.freeze({
  UPDATED: 'updated',
  TITLE: 'title',
  CREATED: 'created',
  COPIED: 'copied',
});

export const SORT_LABEL = Object.freeze({
  [SORTS.UPDATED]: 'آخر تعديل',
  [SORTS.TITLE]: 'الاسم',
  [SORTS.CREATED]: 'الأقدم',
  [SORTS.COPIED]: 'الأكثر نسخًا',
});

export function sortPrompts(rows, sort = SORTS.UPDATED) {
  const out = [...rows];
  if (sort === SORTS.TITLE) {
    return out.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ar'));
  }
  if (sort === SORTS.CREATED) return out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  /*
   * ⚠️ **«الأكثر نسخًا» يُعرَض فقط لأنّ العدّ حقيقيّ** (بندا ١٤ و٥٠):
   *    `copies` يزيد عند نسخةٍ فعليّةٍ نجحت، ولا يُخمَّن ولا يُقدَّر.
   */
  if (sort === SORTS.COPIED) {
    return out.sort((a, b) => (b.copies || 0) - (a.copies || 0)
      || (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/* ------------------------------------------------------------------ *
 * الكتابة (بنود ١٥ إلى ١٧ و٣١)
 * ------------------------------------------------------------------ */

/**
 * ينشئ برومبتًا.
 *
 * ⚠️ **ولا برومبتَ شبح** (بند ١٥): العنوانُ والمتنُ أدنى ما يُقبَل،
 *    وما دونهما يرمي قبل أن يُكتَب صفٌّ — فلا يبقى في القاعدة سجلٌّ
 *    فارغٌ لا تعرف من أين جاء.
 */
export async function createPrompt({
  title, body, purpose = '', category = '', tags = [], favorite = false,
} = {}) {
  const name = String(title || '').trim();
  if (!name) throw new Error('البرومبت محتاج اسم');
  /*
   * ⚠️ **والمتنُ يُحفَظ كما هو — بلا `trim` ولا تطبيع** (بنود ٣٤ و٦٢
   *    و٦٣): المسافاتُ البادئةُ والأسطرُ الفارغةُ والفواصلُ جزءٌ من
   *    البرومبت. و«تنظيفٌ» صغيرٌ هنا يغيّر ما تلصقه في ChatGPT.
   */
  const text = String(body ?? '');
  if (!text.trim()) throw new Error('البرومبت فاضي');

  const stamp = now();
  return promptVersions.create({
    title: name,
    body: text,
    purpose: String(purpose || '').trim(),
    category: String(category || '').trim() || NO_CATEGORY,
    tags: cleanTags(tags),
    favorite: Boolean(favorite),
    copies: 0,
    opens: 0,
    lastCopiedAt: null,
    lastOpenedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  });
}

/**
 * يعدّل بياناتِ برومبتٍ — **بنفس المعرّف** (بند ١٧).
 *
 * ⚠️ إعادةُ التسمية تعديلُ حقلٍ لا إنشاءُ صفٍّ جديد: المعرّفُ هُويّةُ
 *    المزامنة والنسخ الاحتياطيّ، وتبديلُه يجعل الجهازَ الآخر يرى
 *    برومبتًا جديدًا بجوار القديم بدل أن يرى اسمًا تغيّر.
 */
export async function updatePrompt(id, changes = {}) {
  const patch = { updatedAt: now() };
  if ('title' in changes) {
    const name = String(changes.title || '').trim();
    if (!name) throw new Error('الاسم ماينفعش يبقى فاضي');
    patch.title = name;
  }
  if ('body' in changes) {
    const text = String(changes.body ?? '');
    if (!text.trim()) throw new Error('البرومبت ماينفعش يبقى فاضي');
    patch.body = text;
  }
  if ('purpose' in changes) patch.purpose = String(changes.purpose || '').trim();
  if ('category' in changes) {
    patch.category = String(changes.category || '').trim() || NO_CATEGORY;
  }
  if ('tags' in changes) patch.tags = cleanTags(changes.tags);
  if ('favorite' in changes) patch.favorite = Boolean(changes.favorite);
  return promptVersions.update(id, patch);
}

/** يقلب المفضّلة ويعيد الحالة الجديدة (بند ١٢). */
export async function toggleFavorite(id) {
  const row = await promptVersions.get(id);
  if (!row) throw new Error('البرومبت ده مابقاش موجود');
  await promptVersions.update(id, { favorite: !row.favorite, updatedAt: now() });
  return !row.favorite;
}

/**
 * ينسخ برومبتًا نسخةً مستقلّة (بند ١٦).
 *
 * ⚠️ **ولا يُنسَخ تاريخُ الاستعمال**: «نُسخ ١٢ مرّة» حقيقةٌ عن الأصل
 *    وحدَه. ونقلُها إلى النسخة يجعل الرقمَ زخرفةً — وهو ما ينهى عنه
 *    البندُ ٥٠ صراحةً.
 */
export async function duplicatePrompt(id) {
  const row = await promptVersions.get(id);
  if (!row) throw new Error('البرومبت ده مابقاش موجود');
  return createPrompt({
    title: `${row.title} — نسخة`,
    body: row.body,
    purpose: row.purpose,
    category: row.category,
    tags: row.tags,
    favorite: false,
  });
}

/**
 * ⚠️ **الحذفُ إلى السلّة لا إلى العدم** (بند ٦٧): التطبيقُ كلُّه يحذف
 *    إلى السلّة منذ WS0، والبرومبتُ نصٌّ كتبتَه في ساعات. فيمرّ من
 *    نفس الباب ويعود من نفس الباب.
 */
export const trashPrompt = (id) => promptVersions.trash(id);

/* ------------------------------------------------------------------ *
 * الاستعمالُ الحقيقيّ (بنود ١٣ و١٤ و٥٠)
 * ------------------------------------------------------------------ */

/**
 * يسجّل نسخةً **نجحت فعلًا**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لا عدّادَ إلّا عن فعلٍ وقع** (بندا ١٤ و٥٠ · قاعدة ٩)
 * ═══════════════════════════════════════════════════════════════
 *
 * تُنادى **بعد** أن تعود الحافظةُ بنجاح، لا عند الضغط. فلو فشل النسخُ
 * (إذنٌ مرفوضٌ أو سياقٌ غيرُ آمن) لم يزد الرقم — لأنّ «نُسخ ١٢ مرّة»
 * يجب أن تعني اثنتي عشرة نسخةً في يدك، لا اثنتي عشرة ضغطة.
 *
 * ⚠️ **ولا تُمَسّ `updatedAt`**: النسخُ ليس تعديلًا. ولو لمسناها لقفز
 *    كلُّ برومبتٍ تنسخه إلى رأس «آخر تعديل» فيصير الترتيبُ كاذبًا.
 */
export async function markCopied(id) {
  return bumpUse(id, (row) => ({ copies: (row.copies || 0) + 1, lastCopiedAt: now() }));
}

/** يسجّل فتحًا — أساسُ «الأخيرة» (بند ١٣). */
export async function markOpened(id) {
  return bumpUse(id, (row) => ({ opens: (row.opens || 0) + 1, lastOpenedAt: now() }));
}

/**
 * يكتب عدّادَ استعمالٍ **بلا ختم `updatedAt`**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولمَ لا `repo.update` هنا؟** — عطبٌ كشفه الاختبارُ ١٤
 * ═══════════════════════════════════════════════════════════════
 *
 * `repository.update` تمرّ على `stampUpdate`، وهي تكتب
 * `updatedAt: Date.now()` **فوق** أيّ قيمةٍ تمرّرها. فكان تعليقُ
 * «لا تُمَسّ `updatedAt`» أعلاه **دعوى بلا تنفيذ**: كلُّ نسخةٍ كانت
 * تقفز بالبرومبت إلى رأس «آخر تعديل»، فيصير الترتيبُ سجلَّ نسخٍ
 * بعنوانِ تعديل — وهو نوعُ الرقم الكاذب الذي ينهى عنه البندُ ٥٠.
 *
 * فالكتابةُ هنا `putRaw`: صفٌّ نبنيه بأنفسنا، نحفظ فيه `updatedAt`
 * كما هي، ونرفع `rev` ونرفع `dirty` **يدويًّا** كما تفعل `stampUpdate`
 * تمامًا — كي يبقى الصفُّ مرئيًّا للمزامنة ولسجلّ التغيير بلا نقصان.
 */
async function bumpUse(id, patch) {
  const row = await promptVersions.get(id);
  if (!row) return null;
  const next = {
    ...row,
    ...patch(row),
    updatedAt: row.updatedAt,
    rev: (row.rev || 0) + 1,
    dirty: 1,
  };
  await promptVersions.putRaw(next);
  return next;
}

/**
 * «الأخيرة» — **بآخر فتحٍ حقيقيّ لا بآخر تعديل** (بند ١٣).
 *
 * ⚠️ وبرومبتٌ لم يُفتَح قطُّ لا يظهر هنا. وتسميةُ «آخر تعديل» «آخر
 *    استعمال» كذبةٌ صغيرةٌ تجعل القائمةَ بلا معنى.
 */
export function recentPrompts(rows, limit = 20) {
  return rows
    .filter((row) => row.lastOpenedAt || row.lastCopiedAt)
    .sort((a, b) => Math.max(b.lastOpenedAt || 0, b.lastCopiedAt || 0)
      - Math.max(a.lastOpenedAt || 0, a.lastCopiedAt || 0))
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * التصنيفات (بند ١٠)
 * ------------------------------------------------------------------ */

/**
 * يعيد تسمية تصنيفٍ في كلّ برومبتاته.
 *
 * ⚠️ **ولا يُنشأ كيانُ تصنيف**: الاسمُ حقلٌ على الصفّ، وإعادةُ التسمية
 *    كتابةٌ على الصفوف التي تحمله. فلا مخزنَ ثانٍ يتقادم، ولا تصنيفٌ
 *    يتيمٌ يبقى بعد آخر برومبتٍ فيه.
 */
export async function renameCategory(from, to) {
  const name = String(to || '').trim();
  if (!name) throw new Error('اسم التصنيف ماينفعش يبقى فاضي');
  const rows = (await listPrompts()).filter((row) => (row.category || NO_CATEGORY) === from);
  for (const row of rows) await promptVersions.update(row.id, { category: name, updatedAt: now() });
  return rows.length;
}

/**
 * يُفرغ تصنيفًا — **بنقل برومبتاته لا بحذفها** (بند ١٠).
 *
 * ⚠️ **ولا يُحذف برومبتٌ صامتًا مع تصنيفه.** هذا أخطرُ ما في إدارة
 *    التصنيفات: «احذف التصنيف» تبدو عمليّةَ ترتيب، وقد تمحو عشرين
 *    برومبتًا كتبتَها. فالنقلُ إلى «بدون تصنيف» هو الفعلُ، والحذفُ
 *    نتيجةٌ لخلوّه.
 */
export async function clearCategory(name, moveTo = NO_CATEGORY) {
  return renameCategory(name, moveTo);
}

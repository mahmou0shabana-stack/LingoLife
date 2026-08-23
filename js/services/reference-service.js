/**
 * LingoLife — دفترُ المراجع (WS-B)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * > «وأنا بتدرّب بحتاج أبصّ على قاعدة كتبتُها، أو صورة، أو ملفّ
 * >  الـPDF اللي لخّصت فيه القواعد — من غير ما أسيب الشادوينج
 * >  وأرجع ألاقي الجملة ضاعت.»
 *
 * فالمرجعُ **رفيقُ التدريب لا شاشةٌ بديلة**. وهذا الملفّ هو كلُّ ما
 * يخصّ بياناتِ ذلك الرفيق: القواعدُ وصورُها، والصورُ المرجعيّة،
 * وملفُّ القواعد، وأين كنتَ في كلٍّ منها.
 *
 * ═══════════════════════════════════════════════════════════════
 * أين تسكن هذه الأشياء — وخدمةٌ واحدةٌ لا أربع
 * ═══════════════════════════════════════════════════════════════
 *
 * | الشيء              | بيتُه                                  | جديد؟ |
 * |--------------------|----------------------------------------|-------|
 * | بطاقةُ القاعدة      | `referenceRules` (v15)                 | نعم   |
 * | صورةُ القاعدة       | علاقة `rule:media` + بايتاتٌ في `media`| لا    |
 * | الصورُ المرجعيّة    | `media.kind = 'reference'`             | لا    |
 * | ملفُّ القواعد        | `media.kind = 'doc'`                   | لا    |
 * | الملفُّ الفعّال       | مفتاحٌ في `settings`                    | لا    |
 * | حالةُ الورشة        | مفتاحٌ في `settings`                    | لا    |
 *
 * ⚠️ **أربعةُ تبويباتٍ لا تعني أربعةَ مخازن** (بند 41). المخزنُ
 *    الجديدُ واحدٌ، ولشيءٍ واحدٍ لم يكن له بيت: بطاقةُ قاعدةٍ كتبتَها
 *    أنت. أمّا البقيّةُ فبيوتُها قائمةٌ منذ سنة.
 *
 * ⚠️ **وعامٌّ لا خاصٌّ بذكرى** (بندا 23 و24): «متثبتة في أي صفحة
 *    شادوينج افتحها». فلا `sceneId` على القاعدة ولا على الملفّ —
 *    وذلك قرارٌ في البيانات لا في الواجهة.
 *
 * ⚠️ **ولا يعرف هذا الملفُّ الـDOM.** الواجهةُ تنادي، وهو يقرأ
 *    ويكتب — نفسُ خطّ `study-draft.js` و`saved-service.js`.
 */

import { referenceRules, media, relationships, settings } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { link, unlink } from './link-service.js';
import { storeStandaloneImage, storeDocument } from './media-service.js';

/* ================================================================== */
/* الثوابت                                                             */
/* ================================================================== */

/** نوعُ العلاقة بين القاعدة وصورتها — نفسُ اصطلاح `draft:media`. */
export const RULE_MEDIA = 'rule:media';

/** `media.kind` للصور المرجعيّة العامّة (لا صورِ ذكرى). */
export const REFERENCE_IMAGE_KIND = 'reference';

/** `media.kind` لملفّ القواعد الشخصيّ. */
export const REFERENCE_DOC_KIND = 'doc';

/**
 * مفاتيحُ `settings`.
 *
 * ⚠️ **مفتاحان لا واحد**، والفرقُ مقصود: الأوّلُ **ما تملك** (أيُّ
 *    ملفٍّ هو ملخّصُك)، والثاني **أين كنت** (تبويبٌ وصفحةٌ وتكبير).
 *    ومسحُ «أين كنت» عند خللٍ في العرض يجب ألّا يفكّ ملفَّك.
 */
export const REF_KEY = Object.freeze({
  DOC: 'shadow.reference.doc',
  VIEW: 'shadow.reference.view',
});

/** التبويباتُ الأربعة — المعرّفاتُ هي عقدُ الواجهة. */
export const REF_TAB = Object.freeze({
  SOURCE: 'source',
  RULES: 'rules',
  DOC: 'doc',
  IMAGES: 'images',
});

/** أوضاعُ ملء الصفحة في عارض الملفّ. */
export const FIT = Object.freeze({
  WIDTH: 'width',
  PAGE: 'page',
  FREE: 'free',
});

/** الحالةُ الافتراضيّة للورشة — أوّلُ فتحةٍ في العمر. */
const DEFAULT_VIEW = Object.freeze({
  tab: REF_TAB.SOURCE,
  collapsed: false,
  doc: { page: 1, zoom: 1, fit: FIT.WIDTH },
  rules: { openId: null, query: '' },
  images: { openId: null },
});

/* ================================================================== */
/* القواعدُ المهمّة — قراءة                                            */
/* ================================================================== */

/**
 * كلُّ القواعد الحيّة مرتّبةً: المثبَّتُ أوّلًا ثم `order`.
 *
 * ⚠️ **والترتيبُ يُحسم هنا لا في الواجهة.** ثلاثةُ أماكنَ تعرض
 *    القواعد (القائمةُ، ووضعُ القراءة، والسابق/التالي)، ولو رتّب
 *    كلٌّ منها بنفسه لاختلف «التالي» عمّا تراه العين.
 *
 * @returns {Promise<object[]>}
 */
export async function listRules() {
  const rows = await referenceRules.getAll();
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort(sortRules);
}

/** المقارِنُ الوحيد لترتيب القواعد. */
function sortRules(a, b) {
  const pin = (b.pinned || 0) - (a.pinned || 0);
  if (pin) return pin;
  const order = (a.order || 0) - (b.order || 0);
  if (order) return order;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

/** قاعدةٌ بمعرّفها. */
export function getRule(id) {
  return referenceRules.get(id);
}

/**
 * بحثٌ محلّيٌّ في العنوان والنصّ والوسوم.
 *
 * ⚠️ **بلا فهرسٍ وبلا شبكة** (بند 38). الدفترُ عشراتٌ لا آلاف،
 *    والمسحُ في الذاكرة أسرعُ من فتح فهرسٍ عليه — وأصدق: يبحث في
 *    النصّ كما كتبتَه لا في نسخةٍ مطبَّعةٍ تتقادم.
 *
 * @param {object[]} rules نتيجةُ `listRules`
 * @param {string} query
 */
export function searchRules(rules, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return rules;
  return rules.filter((row) =>
    `${row.title || ''}\n${row.text || ''}\n${(row.tags || []).join(' ')}`
      .toLowerCase()
      .includes(q));
}

/* ================================================================== */
/* القواعدُ المهمّة — كتابة                                            */
/* ================================================================== */

/**
 * ينشئ قاعدةً جديدة في آخر الدفتر.
 *
 * ⚠️ **ولا يُشترط الاثنان** (بند 6): عنوانٌ بلا نصّ، أو صورةٌ بلا
 *    نصّ، أو الثلاثة. الشرطُ الوحيد ألّا تكون البطاقةُ فارغةً تمامًا
 *    — وذلك تفحصه الواجهةُ قبل النداء، ويفحصه هذا أيضًا.
 */
export async function createRule({ title = '', text = '', tags = [], note = '' } = {}) {
  const clean = { title: title.trim(), text: text.trim() };
  if (!clean.title && !clean.text) throw new Error('اكتب عنوان أو نصّ للقاعدة');

  const rows = await referenceRules.getAll();
  const max = rows.reduce((m, row) => Math.max(m, row.order || 0), 0);

  return referenceRules.create({
    title: clean.title,
    text: clean.text,
    tags: [...tags],
    note,
    order: max + 1,
    pinned: 0,
  });
}

/** يعدّل قاعدةً — العنوانُ أو النصُّ أو الوسومُ أو الملاحظة. */
export async function updateRule(id, changes = {}) {
  const patch = {};
  if (changes.title !== undefined) patch.title = String(changes.title).trim();
  if (changes.text !== undefined) patch.text = String(changes.text).trim();
  if (changes.tags !== undefined) patch.tags = [...changes.tags];
  if (changes.note !== undefined) patch.note = changes.note;
  if (!Object.keys(patch).length) return referenceRules.get(id);
  return referenceRules.update(id, patch);
}

/** يقلب التثبيت. */
export async function toggleRulePin(id) {
  const row = await referenceRules.get(id);
  if (!row) return null;
  return referenceRules.update(id, { pinned: row.pinned ? 0 : 1 });
}

/**
 * جيرانُ قاعدةٍ **داخل فئتها** — مثبَّتةٌ مع مثبَّتة، وعاديّةٌ مع عاديّة.
 *
 * ⚠️ **والسهمُ لا يعبر حدَّ التثبيت.** المثبَّتُ يعلو في العرض دائمًا،
 *    فلو رفع السهمُ بطاقةً عاديّةً فوق آخرِ مثبَّتة لَما كان أمامه
 *    إلّا أن **يثبّتها** — أي أن يفعل شيئًا لم تطلبه بضغطةِ ترتيب.
 *    فالحدُّ حدٌّ: تُثبَّت بزرّ التثبيت، وتُرتَّب بالسهم.
 */
function siblings(rules, row) {
  return rules.filter((one) => (one.pinned || 0) === (row.pinned || 0));
}

/**
 * ينقل قاعدةً خطوةً لأعلى أو لأسفل **بين جيرانها المرئيّين**.
 *
 * ⚠️ **والجيرةُ مرئيّةٌ لا رقميّة.** لو بدّلنا `order` مع الأقربِ
 *    رقمًا لقفزت البطاقةُ فوق بطاقاتٍ لم يقصدها السهم. فنقرأ القائمةَ
 *    **كما تُعرَض** ونبدّل مع الجار الذي تراه العين.
 *
 * ⚠️ **وصفّان يُكتبان لا الدفترُ كلُّه**: تبديلُ رقمين.
 *
 * @param {string} id
 * @param {-1|1} delta ‏-1 لأعلى، 1 لأسفل
 * @returns {Promise<boolean>} هل تحرّكت فعلًا
 */
export async function moveRule(id, delta) {
  const rules = await listRules();
  const self = rules.find((row) => row.id === id);
  if (!self) return false;

  const group = siblings(rules, self);
  const at = group.findIndex((row) => row.id === id);
  const to = at + (delta < 0 ? -1 : 1);
  if (to < 0 || to >= group.length) return false;

  const a = group[at];
  const b = group[to];
  const orderA = a.order || 0;
  const orderB = b.order || 0;

  /* رقمان متساويان (بياناتٌ قديمة) لا يتبادلان شيئًا — نفرّقهما. */
  const [nextA, nextB] = orderA === orderB
    ? (delta < 0 ? [orderB - 1, orderB] : [orderB + 1, orderB])
    : [orderB, orderA];

  await referenceRules.update(a.id, { order: nextA });
  await referenceRules.update(b.id, { order: nextB });
  return true;
}

/**
 * هل يستطيع السهمُ تحريكَ هذه القاعدة؟ — لتعطيل الزرّ بدل خذلانه.
 *
 * @returns {{up: boolean, down: boolean}}
 */
export function moveAffordance(rules, row) {
  const group = siblings(rules, row);
  const at = group.findIndex((one) => one.id === row.id);
  return { up: at > 0, down: at >= 0 && at < group.length - 1 };
}

/**
 * يحذف قاعدةً إلى السلّة — **ولا يمسّ بايتاتِ صورةٍ** (بند 10).
 *
 * ⚠️ الصورةُ في `media` قد تكون في ذكرى، أو في قاعدةٍ أخرى. فالمحذوفُ
 *    البطاقةُ، والعلاقةُ تبقى كما هي: التراجعُ يعيد كلَّ شيءٍ بصفٍّ
 *    واحد. وهو نفسُ عهدِ `draft:media`.
 */
export async function trashRule(id) {
  await referenceRules.trash(id);
}

/** يرجّع قاعدةً من السلّة — الصورُ عائدةٌ معها لأنها لم تُمَسّ. */
export async function restoreRule(id) {
  await referenceRules.restore(id);
}

/* ================================================================== */
/* صورُ القاعدة                                                        */
/* ================================================================== */

/** صورُ قاعدةٍ بترتيب إضافتها — وصورةٌ حُذفت تختفي ولا تُسقط الشاشة. */
export async function ruleImages(ruleId) {
  const rows = await relationships.byIndex('from_kind', [ruleId, RULE_MEDIA]);
  const live = rows.filter((row) => row.state === STATE.ACTIVE);
  const found = await media.getMany(live.map((row) => row.toId));
  return found.filter(Boolean);
}

/**
 * كلُّ القواعد **ومعها صورُها** — بثلاثة استعلاماتٍ لا بثلاثةٍ لكلّ قاعدة.
 *
 * ⚠️ **ولماذا لا `ruleImages` في حلقة؟** لأنها معاملةٌ لكلّ قاعدة.
 *    دفترٌ فيه أربعون قاعدةً يعني أربعين فتحةَ معاملةٍ في كلّ رسم —
 *    والرسمُ يحدث مع كلّ ضغطةِ ترتيبٍ وكلّ حرفٍ في البحث. فالقراءةُ
 *    بالنوع مرّةً ثم التجميعُ في الذاكرة.
 *
 * @returns {Promise<object[]>} كلُّ صفٍّ فيه `images` مصفوفةً (قد تكون فارغة)
 */
export async function rulesWithImages() {
  const rules = await listRules();
  if (!rules.length) return rules;

  const links = (await relationships.byIndex('kind', RULE_MEDIA))
    .filter((row) => row.state === STATE.ACTIVE);

  const wanted = [...new Set(links.map((row) => row.toId))];
  const rows = (await media.getMany(wanted)).filter(Boolean);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const grouped = new Map();
  for (const row of links) {
    const pic = byId.get(row.toId);
    /* ⚠️ صورةٌ حُذفت تختفي من البطاقة ولا تُسقط الدفتر. */
    if (!pic || pic.state !== STATE.ACTIVE) continue;
    if (!grouped.has(row.fromId)) grouped.set(row.fromId, []);
    grouped.get(row.fromId).push(pic);
  }

  return rules.map((rule) => ({ ...rule, images: grouped.get(rule.id) || [] }));
}

/**
 * يضيف صورةً لقاعدة.
 *
 * ⚠️ **و`kind` هنا `reference` لا `image`.** فتبويبُ الصور يعرض
 *    «صورَك المرجعيّة» كلَّها — وصورةُ قاعدةٍ منها بطبيعتها. ولو
 *    خزّنّاها `image` لَما ميّزها فهرسُ `kind` عن صور الذكريات.
 */
export async function addRuleImage(ruleId, file) {
  const record = await storeStandaloneImage(file, { kind: REFERENCE_IMAGE_KIND });
  await link(ruleId, record.id, RULE_MEDIA);
  return record;
}

/** يربط صورةً موجودةً بقاعدة — بلا نسخِ بايتات (بند 59). */
export async function attachRuleImage(ruleId, mediaId) {
  await link(ruleId, mediaId, RULE_MEDIA);
}

/** يفكّ صورةً عن قاعدة — البايتاتُ باقيةٌ في `media`. */
export async function detachRuleImage(ruleId, mediaId) {
  return unlink(ruleId, mediaId, RULE_MEDIA);
}

/* ================================================================== */
/* الصورُ المرجعيّة العامّة                                            */
/* ================================================================== */

/**
 * كلُّ الصور المرجعيّة — المربوطةُ بقاعدةٍ والحرّةُ معًا.
 *
 * ⚠️ **فهرسُ `kind` يجيب الاثنين بنداءٍ واحد** — لأن صورةَ القاعدة
 *    تُخزَّن `reference` أيضًا. فلا مسحَ لـ`media` كلِّه، ولا جدولَ
 *    ثانٍ للعضويّة العامّة.
 */
export async function listReferenceImages() {
  const rows = await media.byIndex('kind', REFERENCE_IMAGE_KIND);
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/** يضيف صورةً مرجعيّةً حرّة — بلا قاعدةٍ تملكها. */
export async function addReferenceImage(file) {
  return storeStandaloneImage(file, { kind: REFERENCE_IMAGE_KIND });
}

/* ================================================================== */
/* ملخّصُ القواعد — الملفُّ الشخصيّ                                     */
/* ================================================================== */

/**
 * الملفُّ الفعّال الآن — **عامٌّ لكلّ جلسات الظلّ** (بند 23).
 *
 * @returns {Promise<object|null>} سجلُّ `media` أو `null`
 */
export async function activeDoc() {
  const stored = await settings.get(REF_KEY.DOC, null);
  if (!stored?.mediaId) return null;

  const row = await media.get(stored.mediaId);
  /*
   * ⚠️ **ملفٌّ اختفى لا يُسقط التبويب** (بند 58): المفتاحُ يبقى
   *    مكتوبًا (فلعلّ استرجاعًا يعيده)، والواجهةُ تعرض «اختار ملفّ».
   */
  if (!row || row.state !== STATE.ACTIVE || !row.blob) return null;
  return row;
}

/** كلُّ الملفّات المخزّنة — لو أردتَ التبديل بينها لاحقًا. */
export async function listDocs() {
  const rows = await media.byIndex('kind', REFERENCE_DOC_KIND);
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * يرفع ملفًّا ويجعله الملخّصَ الفعّال.
 *
 * ⚠️ **والصفحةُ تعود إلى 1 عند تبديل الملفّ** — لا عند العودة إليه.
 *    «صفحة 17» وعدٌ في ملفٍّ بعينه؛ ولو حُمل على ملفٍّ آخر لفتحتَ
 *    صفحةً لا تعني شيئًا.
 */
export async function setActiveDoc(file) {
  if (!file) throw new Error('اختار ملفّ الأوّل');
  const record = await storeDocument(file, { kind: REFERENCE_DOC_KIND });
  await settings.set(REF_KEY.DOC, { mediaId: record.id, at: Date.now() });
  await patchView({ doc: { ...DEFAULT_VIEW.doc } });
  return record;
}

/** يختار ملفًّا مخزَّنًا سلفًا — بلا رفعٍ ثانٍ لنفس البايتات. */
export async function chooseDoc(mediaId) {
  await settings.set(REF_KEY.DOC, { mediaId, at: Date.now() });
  await patchView({ doc: { ...DEFAULT_VIEW.doc } });
}

/**
 * يفكّ الملفَّ الفعّال.
 *
 * @param {{deleteBytes?: boolean}} options
 *   `deleteBytes` يرمي السجلَّ في السلّة أيضًا (قابلٌ للاسترجاع).
 */
export async function clearActiveDoc({ deleteBytes = false } = {}) {
  const stored = await settings.get(REF_KEY.DOC, null);
  await settings.remove(REF_KEY.DOC);
  await patchView({ doc: { ...DEFAULT_VIEW.doc } });
  if (deleteBytes && stored?.mediaId) await media.trash(stored.mediaId);
  return stored?.mediaId || null;
}

/* ================================================================== */
/* حالةُ الورشة — «أين كنت»                                            */
/* ================================================================== */

/**
 * يقرأ حالةَ الورشة مدموجةً بالافتراضيّ.
 *
 * ⚠️ **الدمجُ عميقٌ لمستوًى واحد** — لأن حالةً محفوظةً من نسخةٍ أقدم
 *    لا تعرف مفتاحًا أضفناه اليوم، فتُقرأ `undefined` ويسقط العارض
 *    على `zoom` غيرِ موجود. والدمجُ يمنع ذلك بلا ترقية.
 */
export async function readView() {
  const stored = await settings.get(REF_KEY.VIEW, null);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_VIEW };
  return {
    ...DEFAULT_VIEW,
    ...stored,
    doc: { ...DEFAULT_VIEW.doc, ...(stored.doc || {}) },
    rules: { ...DEFAULT_VIEW.rules, ...(stored.rules || {}) },
    images: { ...DEFAULT_VIEW.images, ...(stored.images || {}) },
  };
}

/**
 * يكتب تعديلًا جزئيًّا على الحالة.
 *
 * ⚠️ **جزئيٌّ لأن كلَّ تبويبٍ يملك حالتَه** (بند 27): كتابةُ صفحة
 *    الملفّ يجب ألّا تمسح القاعدةَ المفتوحة في تبويبٍ آخر.
 */
export async function patchView(patch = {}) {
  const current = await readView();
  const next = {
    ...current,
    ...patch,
    doc: { ...current.doc, ...(patch.doc || {}) },
    rules: { ...current.rules, ...(patch.rules || {}) },
    images: { ...current.images, ...(patch.images || {}) },
  };
  await settings.set(REF_KEY.VIEW, next);
  return next;
}

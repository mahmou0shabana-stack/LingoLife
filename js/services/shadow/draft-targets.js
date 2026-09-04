/**
 * LingoLife — هُويّةُ أهداف المسودّة V2 (WS-DV2 · بنود ٤٠ و٤١ و٦٣)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لماذا لا يصلح الترتيبُ هُويّةً — والخطأُ الذي كِدتُ أرتكبه
 * ═══════════════════════════════════════════════════════════════
 *
 * أوّلُ تصميمٍ اقترحتُه كان مفتاحًا مركَّبًا: `core#1` و`core#2`. وهو
 * **ترتيبٌ يلبس ثوبَ هُويّة**. أدرِج قطعةً جديدةً بين الأولى والثانية:
 *
 *     قبل:  core#1=أ   core#2=ب   core#3=ج
 *     بعد:  core#1=أ   core#2=جديد   core#3=ب   core#4=ج
 *
 * فتصير «ب» هي `core#3` بعد أن كانت `core#2` — ويرث «جديد» تقدُّمَ «ب»
 * وهو لم يُقرَأ بعد. **ولا رسالةَ خطأ**: كلُّ مفتاحٍ صحيحٌ في ذاته.
 *
 * فالمعرّفُ هنا **يُولَد مرّةً ويعيش** — كما فعل `sentenceIds` في WS-SC.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولا ترقيةَ مخطَّطٍ — والدليلُ في المخزن نفسِه
 * ═══════════════════════════════════════════════════════════════
 *
 * `studyDrafts` في `schema.js` لا يعرف حقلَ `learnChunks` الذي أضافته
 * WS-SL، وهو يُحفَظ ويُزامَن منذ ذلك الحين. لأن مخازنَ IndexedDB تحفظ
 * أشياءَ لا أعمدة، و`stampUpdate` تدمج `{...record, ...changes}` بلا
 * قائمةٍ بيضاء، وسياسةُ المزامنة تُصنّف المخزنَ كلَّه `CANONICAL`.
 *
 * فحقلٌ جديدٌ هنا **لا فهرسَ له ولا رقمَ مخطَّطٍ يتغيّر**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وما لم آخذه من `reconcileIds` — عن قصد
 * ═══════════════════════════════════════════════════════════════
 *
 * تلك الدالّةُ (WS-SC) لها **خطوةٌ ثانيةٌ بالموضع**: نصٌّ تغيّر يرث
 * معرّفَ من كان مكانَه. وهو صحيحٌ للجُمَل — تُعيد صياغةَ جملةٍ فتبقى
 * هي. وهو **خطأٌ هنا**: قطعةٌ مسحتَها وكتبتَ مكانَها أخرى ترث «خلصت»
 * من سابقتها، فيقول لك التطبيقُ إنك أتقنتَ نصًّا لم ترَه.
 *
 * فالمطابقةُ هنا بالنصّ **أو لا شيء**: ما تغيّر نصُّه يأخذ معرّفًا
 * جديدًا، ويبدأ من الصفر. وهو ما يطلبه البند ٤١ حرفيًّا: لا انتقالَ
 * إلّا حين تكون المطابقةُ **بلا لبس**.
 */

import { studyDrafts } from '../../db/repositories.js';
import { subjectKey } from '../study-draft.js';

/** الحقلُ على سجلّ المسودّة — لا فهرسَ له ولا مخطَّط. */
export const TARGET_IDS = 'targetIds';

/**
 * أدوارُ الهدف — ما يُتعلَّم منه، وما هو سقالةٌ حوله (بند ١).
 *
 * ⚠️ **و`RECALL_CUE` ليس `SECTION.RECALL` القديم.** ذاك (WS-DR) عربيٌّ
 *    يسأل وروسيٌّ يجيب — `unit(ru, ar, RECALL)`. وهذا روسيٌّ يسأل
 *    وروسيٌّ يجيب (بند ٣). نفسُ الكلمة، شكلان متعاكسان — ولو وضعتُ
 *    سؤالَ V2 في الدور القديم لَحلّ الروسيُّ محلَّ العربيّ فظهر ترجمةً.
 */
export const ROLE = Object.freeze({
  MICRO_CORE: 'micro_core',
  RECALL_CUE: 'recall_cue',
  EXPANSION: 'expansion',
  VARIATION: 'variation',
  FULL_BUILD: 'full_build',
  EXAMPLE: 'example',
  MEANING: 'meaning',
  NOTE: 'note',
  PATTERN: 'pattern',
  SECTION: 'section',
  METADATA: 'metadata',
});

/**
 * ما يجوز أن يصير هدفَ نُطقٍ افتراضيًّا (بند ٢٧).
 *
 * ⚠️ **وهذه هي الجملةُ التي كانت تُضخّم العدّ.** كان الاختيارُ
 *    `units.filter(one => isCyrillic(one.ru))` — فأيُّ سطرٍ سيريليٍّ
 *    هدفُ نُطق، بما فيه سؤالُ الاسترجاع وعنوانُ القسم. ومن هنا جاء
 *    «٥ قطع ← ١٠ أزواج» بلا تفسير.
 */
export const SPEECH_ROLES = Object.freeze(new Set([
  ROLE.MICRO_CORE, ROLE.EXPANSION, ROLE.VARIATION, ROLE.FULL_BUILD,
]));

/** اختياريٌّ — يُضاف بطلبك لا بالصمت (بندا ١٣ و١٤). */
export const OPTIONAL_SPEECH_ROLES = Object.freeze(new Set([ROLE.EXAMPLE]));

/** ما لا يُنطَق أبدًا — سقالةٌ تُعرَض ولا تُقرأ (بندا ١٢ و٤٤). */
export const isSpeechRole = (role) => SPEECH_ROLES.has(role);

function newId() {
  return `DT_${Date.now().toString(36).toUpperCase()}_${
    Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

/**
 * بصمةُ هدفٍ للمطابقة — **دورُه وسياقُه ونصُّه**.
 *
 * ⚠️ **ولمَ الدورُ جزءٌ منها؟** لأنّ البند ٩ يقتضي أن يظهر
 *    `Я бы сначала уточнил детали` قطعةً أساسيّةً **وتكرارًا** في آنٍ
 *    واحد. فلو كان النصُّ وحدَه البصمةَ لَابتلع أحدُهما الآخر، ولَشارك
 *    هدفان مختلفان حالةَ «خلصت» نفسَها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والسياقُ جزءٌ منها — نقصٌ كشفه المالك في تصميمي**
 * ═══════════════════════════════════════════════════════════════
 *
 * «الدورُ والنصّ» يكفيان **فقط حين تكون البصمةُ فريدة**. وتكراران
 * بنفس الإجابة وسؤالَي استرجاعٍ مختلفين ليسا كذلك: يميّزهما المؤلّفُ
 * بسؤالِهما، وبصمتُهما الأولى واحدة. فكان الدلوُ يوزّع المعرّفَين
 * **بترتيب الظهور** — أي بالموضع، وهو نفسُه العيبُ الذي رفضتُ لأجله
 * `core#1`. فتُبدِّل ترتيبَهما فتنتقل «خلصت» إلى الآخر بصمت.
 *
 * فسؤالُ الاسترجاع وعائلةُ القلب والقسمُ الأب تدخل البصمةَ متى وُجدت.
 */
export function fingerprint(role, ru, context = {}) {
  /*
   * ⚠️ **ولا فاصلَ مطبوعًا بين حقولٍ يكتبها إنسان.**
   *
   * أوّلُ كتابةٍ وصلت الحقولَ بـ`|`، و`subjectKey` لا تحذف هذا الحرف —
   * تحذف النبرَ وتوحّد المسافاتِ والحالةَ فقط. فسؤالٌ فيه `|` يصنع
   * بصمةَ هدفٍ آخر:
   *
   *     cue='أ|ب' · family='ج'   ←┐ بصمةٌ واحدة: «R|أ|ب|ج|…»
   *     cue='أ'   · family='ب|ج' ←┘  الفاصلُ ينزلق بين حقلين متجاورين
   *
   * فيتشارك هدفان مختلفان معرّفًا واحدًا وحالةَ «خلصت» معه. و`JSON`
   * يهرّب المحارفَ ويُطوّل السلاسلَ بأطوالها، فلا يصنع أيُّ محتوًى
   * حدًّا كاذبًا.
   */
  return JSON.stringify([
    role,
    subjectKey(context.cue || ''),
    subjectKey(context.family || ''),
    subjectKey(context.parent || ''),
    subjectKey(ru || ''),
  ]);
}

/** بصمةُ صفٍّ محفوظٍ أو مقروء — نفسُ الحقول من نفس الشكل. */
const printOf = (one) => fingerprint(one.role, one.ru, one);

/** ينقل حقولَ السياق إن وُجدت — ولا يخترع مفاتيحَ فارغة. */
function withContext(base, one) {
  const out = { ...base };
  if (one.cue) out.cue = one.cue;
  if (one.family) out.family = one.family;
  if (one.parent) out.parent = one.parent;
  return out;
}

/** المعرّفاتُ المحفوظة — مصفوفةُ `{id, role, ru}` أو `[]`. */
export function storedTargets(draft) {
  const saved = draft?.[TARGET_IDS];
  return Array.isArray(saved) ? saved.filter((one) => one && one.id) : [];
}

/**
 * يوفّق المعرّفاتِ المحفوظةَ على الأهداف المقروءة الآن.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ خاصّيّاتٌ تُقاس لا تُدَّعى (بند ٤٠)
 * ═══════════════════════════════════════════════════════════════
 *
 *   إعادةُ الترتيب  → المعرّفُ يبقى (المطابقةُ بالبصمة لا بالموضع)
 *   إدراجٌ قبله     → يبقى
 *   حذفُ جارِه      → يبقى
 *   نصٌّ لم يتغيّر  → يبقى، ومعه تقدُّمُه
 *   نصٌّ تغيّر      → **معرّفٌ جديد**، ولا يرث شيئًا
 *   متطابقان نصًّا  → بصمتاهما تفترقان بالسؤال أو العائلة، فلا لبس
 *   ولا يميّزهما شيء  → إن تساوى العددُ بقيت المعرّفات، وإلّا **تُولَد
 *                       جديدةً ويُبلَّغ الالتباس** — ولا اختيارَ بالموضع
 *
 * @param {{role: string, ru: string}[]} parsed الأهدافُ كما قُرئت الآن
 * @param {{id: string, role: string, ru: string}[]} before المحفوظُ سابقًا
 * @returns {{targets: object[], changed: boolean, minted: number, kept: number,
 *            ambiguous: {print: string, before: number, after: number}[]}}
 */
export function reconcileTargets(parsed, before = []) {
  const oldBy = new Map();
  for (const one of before) {
    const key = printOf(one);
    if (!oldBy.has(key)) oldBy.set(key, []);
    oldBy.get(key).push(one);
  }
  const newBy = new Map();
  parsed.forEach((one, i) => {
    const key = printOf(one);
    if (!newBy.has(key)) newBy.set(key, []);
    newBy.get(key).push(i);
  });

  let kept = 0;
  let minted = 0;
  const ambiguous = [];
  const out = new Array(parsed.length).fill(null);

  for (const [key, slots] of newBy) {
    const olds = oldBy.get(key) || [];

    /* (١) فريدٌ هنا وهناك — مطابقةٌ بلا لبس، فيبقى المعرّفُ ومعه التقدّم. */
    if (slots.length === 1 && olds.length === 1) {
      out[slots[0]] = olds[0].id;
      kept += 1;
      continue;
    }

    /*
     * (٢) عددان متساويان وأكثرُ من واحد: أهدافٌ **لا يميّزها شيءٌ مؤلَّف**
     *     — نفسُ الدور والسؤال والعائلة والنصّ. فلا فرقَ يراه المستعمِلُ
     *     بينها، وإبقاءُ المعرّفات بترتيبها لا ينقل حكمًا إلى هدفٍ
     *     **مختلف**، ويمنع تولُّدَ معرّفاتٍ جديدةٍ في كلّ فتحة.
     */
    if (olds.length > 1 && slots.length === olds.length) {
      slots.forEach((at, i) => { out[at] = olds[i].id; });
      kept += slots.length;
      continue;
    }

    /*
     * (٣) وإلّا فالعددُ تغيّر ومعه الالتباس: أُدرج مثيلٌ أو حُذف، ولا
     *     سبيلَ لمعرفة أيُّ القديم نجا.
     *
     * ⚠️ **ولا يُختار الأوّلُ بالموضع** (شرط المالك ٣): تلك هي الحالةُ
     *    التي تنقل «خلصت» إلى هدفٍ لم يُفتَح. فتُولَد معرّفاتٌ جديدةٌ
     *    للدلو كلِّه — يخسر التقدّمَ ولا يكذب — ويُبلَّغ الالتباسُ صراحةً.
     */
    if (olds.length) {
      ambiguous.push({ print: key, before: olds.length, after: slots.length });
    }
    slots.forEach((at) => { out[at] = newId(); minted += 1; });
  }

  const targets = parsed.map((one, i) => withContext(
    { id: out[i] || newId(), role: one.role, ru: one.ru }, one
  ));

  const same = before.length === targets.length
    && before.every((one, i) => one.id === targets[i].id && printOf(one) === printOf(targets[i]));

  return { targets, changed: !same, minted, kept, ambiguous };
}

/**
 * يقرأ المعرّفاتِ ويكتبها **إن تغيّرت فقط**.
 *
 * ⚠️ **ولا كتابةَ في كلّ رسمة**: `studyDrafts.update` ترفع `rev` وتضع
 *    `dirty=1`، فكتابةٌ بلا تغييرٍ تجعل كلَّ فتحةِ شاشةٍ تعديلًا يُزامَن.
 *
 * @returns {Promise<{id, role, ru}[]>}
 */
export async function ensureTargetIds(draft, parsed) {
  if (!draft?.id) return reconcileTargets(parsed, []).targets;
  const { targets, changed } = reconcileTargets(parsed, storedTargets(draft));
  if (changed) await studyDrafts.update(draft.id, { [TARGET_IDS]: targets });
  return targets;
}

/**
 * خريطةُ بصمةٍ ← معرّف، لأجل شريط الاسترجاع السريع (بندا ١١ و٤٢).
 *
 * ⚠️ **الشريطُ سطحُ مراجعةٍ لا أهدافٌ ثانية.** إجاباتُه تُعيد نصَّ
 *    أهدافٍ موجودةٍ حرفيًّا، فلو صارت أهدافًا لَقال العدّادُ «٢٢» عن
 *    أحدَ عشرَ هدفًا حقيقيًّا — وهو بالضبط التضخيمُ الذي ينهى عنه
 *    البند ١١.
 *
 * ⚠️ **والمطابقةُ بالنصّ وحدَه هنا — عن قصدٍ لا سهوًا**: الشريطُ يذكر
 *    الإجابةَ بلا دورِها، فالبحثُ عن أيّ هدفٍ يحمل هذا النصّ هو
 *    المطلوب. وهذا **عكسُ** قاعدة الهُويّة أعلاه، ولذلك خريطةٌ منفصلة.
 */
export function textIndex(targets) {
  const byText = new Map();
  for (const one of targets) {
    if (!isSpeechRole(one.role)) continue;
    const key = subjectKey(one.ru || '');
    if (!key) continue;
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(one.id);
  }
  return byText;
}

/**
 * يربط إجاباتِ الشريط السريع بأهدافها القائمة.
 *
 * @returns {{ref: string|null, ru: string, cue: string}[]} `ref` معرّفُ
 *          الهدف القائم، و`null` حين تكون الإجابةُ فريدةً فعلًا —
 *          وتلك تُبلَّغ ولا تُبتلَع (بند ١١).
 */
export function linkQuickChain(chain, targets) {
  const byText = textIndex(targets);
  return (chain || []).map((one) => {
    const base = { cue: one.cue || '', ru: one.ru || '' };
    const hits = byText.get(subjectKey(one.ru || '')) || [];
    /*
     * ⚠️ **ولا يُؤخَذ أوّلُ مطابقٍ نصّيّ** (شرط المالك ٥): نصٌّ يطابق
     *    هدفين هو سؤالٌ بلا جواب، والاختيارُ بالموضع يربط المراجعةَ
     *    بهدفٍ ليس هدفَها. فتُقال الحالةُ كما هي، وتقرّر الشاشة.
     */
    if (hits.length === 1) return { ...base, ref: hits[0], state: 'linked' };
    if (hits.length > 1) return { ...base, ref: null, state: 'ambiguous', candidates: hits };
    return { ...base, ref: null, state: 'unique' };
  });
}

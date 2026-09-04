/**
 * LingoLife — نموذجُ التعلّم الموحَّد V1/V2 (WS-DV2 · بنود ١٤ إلى ١٧ و٢٨ و٣٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لماذا طبقةٌ واحدةٌ فوق نسختين
 * ═══════════════════════════════════════════════════════════════
 *
 * الشاشةُ يجب ألّا تعرف أيَّ نسخةٍ هذه المسودّة. فلو سألت `if (v2)` في
 * كلّ موضعِ رسمٍ لَتضاعف كلُّ عرضٍ وكلُّ عدّاد، ولَنسي أحدُهما إصلاحًا
 * ناله الآخر. فهنا **شكلٌ واحدٌ يخرج**، ومصدرُه يختلف:
 *
 *     V2 → `parseDraftV2` بأدوارٍ صريحة
 *     V1 → `coreChunks` كما هي، مُلبَسةً نفسَ الشكل
 *
 * ⚠️ **ولا يُخترَع لـV1 ما ليس فيه** (بند ٣٠): لا أسئلةَ استرجاعٍ، ولا
 *    تكراراتٍ، ولا إعادةَ بناء. مسودّةٌ قديمةٌ تُعرَض قديمةً — قطعٌ
 *    وأمثلتُها، وكفى. والادّعاءُ بغير ذلك يخترع تعلُّمًا لم يُكتَب.
 */

import { ROLE, SPEECH_ROLES, OPTIONAL_SPEECH_ROLES, isSpeechRole, ensureTargetIds, storedTargets, reconcileTargets, linkQuickChain } from './draft-targets.js';
import { isDraftV2, parseDraftV2 } from './draft-v2.js';
import { coreChunks, chunkStates, CHUNK_STATE, CHUNK_STATES } from './sentence-learning.js';
import { studyDrafts } from '../../db/repositories.js';

/** أسماءُ المجموعات كما يراها الإنسان (بند ٢٨). */
export const GROUP_LABEL = Object.freeze({
  [ROLE.MICRO_CORE]: 'الكور الأساسية',
  [ROLE.EXPANSION]: 'التدرّج',
  [ROLE.VARIATION]: 'التكرارات',
  [ROLE.FULL_BUILD]: 'إعادة البناء',
  [ROLE.EXAMPLE]: 'الأمثلة',
});

/** ترتيبُ المجموعات في الشاشة — من الأصغر إلى إعادة البناء (بند ٢٦). */
export const GROUP_ORDER = Object.freeze([
  ROLE.MICRO_CORE, ROLE.EXPANSION, ROLE.VARIATION, ROLE.FULL_BUILD, ROLE.EXAMPLE,
]);

/**
 * يُلبس قطعَ V1 شكلَ الأهداف — **بلا اختراع**.
 *
 * ⚠️ والمثالُ في V1 يبقى مثالًا كذلك: كان يُحسَب هدفًا فيقفز العدّ.
 */
function fromV1(draft) {
  const targets = [];
  for (const chunk of coreChunks(draft)) {
    targets.push({
      role: ROLE.MICRO_CORE, ru: chunk.ru, ar: chunk.ar, cue: '', family: '', parent: '',
      sense: chunk.sense || [], patterns: chunk.patterns || [], examples: chunk.examples || [],
    });
    for (const ex of chunk.examples || []) {
      targets.push({
        role: ROLE.EXAMPLE, ru: ex.ru, ar: ex.ar || '', cue: '', family: '',
        parent: chunk.ru, sense: [], patterns: [], examples: [],
      });
    }
  }
  return { version: 1, targets, chain: [], families: [], source: '' };
}

/**
 * نموذجُ التعلّم لمسودّةٍ — أدوارٌ ومعرّفاتٌ وحالاتٌ وعدّادات.
 *
 * ⚠️ **ويكتب المعرّفاتِ إن تغيّرت فقط** — راجع `ensureTargetIds`.
 *
 * @param {object} draft سجلُّ المسودّة
 * @param {{write?: boolean}} options `write:false` لقراءةٍ بلا حفظ
 */
function shape(read, withIds, states) {
  const targets = read.targets.map((one, i) => ({
    ...one,
    id: withIds[i]?.id || '',
    state: states[withIds[i]?.id] || CHUNK_STATE.NEW,
  }));
  return {
    version: read.version,
    targets,
    groups: groupsOf(targets),
    counts: countsOf(targets),
    chain: linkQuickChain(read.chain, withIds),
    families: read.families,
    source: read.source,
  };
}

/**
 * نفسُ النموذج **بلا وعدٍ ولا كتابة** — لقائمة الجمل الصفراء.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولمَ نسخةٌ متزامنة؟** (بندا ٤٩ و٥٠)
 * ═══════════════════════════════════════════════════════════════
 *
 * صفُّ الجملة يُرسَم لكلّ جملةٍ في السكريبت — مئاتٌ منها. ولو نادى كلٌّ
 * منها `learnModel` لَصار في كلّ رسمةٍ **مئةُ وعدٍ ومئةُ كتابةٍ في
 * IndexedDB**: `ensureTargetIds` ترفع `rev` وتضع `dirty=1`، فيصير مجرَّدُ
 * فتحِ الشاشة تعديلًا يُزامَن مئةَ مرّة.
 *
 * فالقراءةُ هنا خالصة، والمعرّفاتُ تُوفَّق في الذاكرة ولا تُحفَظ.
 * والكتابةُ تقع مرّةً واحدةً حين تفتح لوحَ التعلّم فعلًا.
 */
export function learnModelSync(draft) {
  const text = draft?.text || '';
  const read = isDraftV2(text) ? parseDraftV2(text) : fromV1(draft);
  const withIds = reconcileTargets(read.targets, storedTargets(draft)).targets;
  return shape(read, withIds, chunkStates(draft));
}

export async function learnModel(draft, { write = true } = {}) {
  if (!write) return learnModelSync(draft);
  const text = draft?.text || '';
  const read = isDraftV2(text) ? parseDraftV2(text) : fromV1(draft);
  const withIds = await ensureTargetIds(draft, read.targets);
  return shape(read, withIds, chunkStates(draft));
}

/** مجموعاتٌ بالدور، بترتيبٍ ثابتٍ وبترتيبٍ مؤلَّفٍ داخلَ كلٍّ (بند ٢٨). */
export function groupsOf(targets) {
  return GROUP_ORDER
    .map((role) => ({
      role,
      label: GROUP_LABEL[role],
      optional: OPTIONAL_SPEECH_ROLES.has(role),
      items: targets.filter((one) => one.role === role),
    }))
    .filter((group) => group.items.length);
}

/**
 * العدّادُ الدلاليّ — **ولا مجموعَ بلا تفصيله** (بند ١٥).
 *
 * ⚠️ **وهذا هو ردُّ التمريرة على «٤٤ وحدة».** كلُّ رقمٍ هنا يعرف ما
 *    يعدّ، والمجموعُ مشتقٌّ من مفرداته لا محسوبٌ بطريقٍ ثانٍ — فلا
 *    يفترقان يومًا بلا أن يُخطئ أحدُهما ظاهريًّا.
 */
export function countsOf(targets) {
  const byRole = {};
  const doneByRole = {};
  for (const one of targets) {
    byRole[one.role] = (byRole[one.role] || 0) + 1;
    if (one.state === CHUNK_STATE.DONE) doneByRole[one.role] = (doneByRole[one.role] || 0) + 1;
  }
  const speech = [...SPEECH_ROLES].reduce((sum, role) => sum + (byRole[role] || 0), 0);
  const done = [...SPEECH_ROLES].reduce((sum, role) => sum + (doneByRole[role] || 0), 0);
  return { byRole, doneByRole, speech, done, examples: byRole[ROLE.EXAMPLE] || 0 };
}

/**
 * تفصيلُ ما اخترتَه للتدريب (بندا ١٤ و٢٨).
 *
 * ⚠️ **ولا رقمَ بلا سببه**: «٦ محدَّدة» وحدَها هي نفسُ عيب «١٠ أزواج».
 *    فالخارجُ هنا مجموعٌ **ومعه من أين جاء**، والشاشةُ تعرضهما معًا.
 */
export function selectionSummary(targets, selectedIds) {
  const chosen = new Set(selectedIds || []);
  const picked = targets.filter((one) => chosen.has(one.id));
  const breakdown = GROUP_ORDER
    .map((role) => ({
      role,
      label: GROUP_LABEL[role],
      count: picked.filter((one) => one.role === role).length,
    }))
    .filter((row) => row.count);
  return { total: picked.length, breakdown, targets: picked };
}

/**
 * ما يدخل الشادوينج فعلًا — **بالدور لا بالحروف** (بند ٢٧ · قيدُ المالك ٣).
 *
 * ⚠️ **وهذه الدالّةُ هي بديلُ `practiceUnits` لمسودّات V2.** تلك كانت
 *    `filter(isCyrillic)`، فتُدخل سؤالَ الاسترجاع والمثالَ والعنوان.
 *    وهنا لا يمرّ إلّا دورٌ في القائمة البيضاء — والمثالُ بطلبٍ صريح.
 */
export function speechTargets(targets, { withExamples = false } = {}) {
  return targets.filter((one) => isSpeechRole(one.role)
    || (withExamples && OPTIONAL_SPEECH_ROLES.has(one.role)));
}

/**
 * ملخّصٌ مضغوطٌ لصفّ الجملة الصفراء (بندا ١٨ و١٩).
 *
 * ⚠️ **ولا تُفتَح كلُّ مسودّةٍ تحت كلّ جملة** (بند ١٩): هذا سطرٌ واحدٌ
 *    يقول ما فيه، والتوسيعُ للجملة المفتوحة وحدَها.
 */
export function sentenceSummary(model) {
  const { counts } = model;
  return {
    version: model.version,
    speech: counts.speech,
    done: counts.done,
    rows: GROUP_ORDER
      .filter((role) => SPEECH_ROLES.has(role) && counts.byRole[role])
      .map((role) => ({
        role,
        label: GROUP_LABEL[role],
        total: counts.byRole[role],
        done: counts.doneByRole[role] || 0,
      })),
    examples: counts.examples,
  };
}

/**
 * يكتب حالةَ هدفٍ بمعرّفه الثابت.
 *
 * ⚠️ **والغيابُ هو «لم تبدأ»** — فلا تُراكم المفاتيحُ لأهدافٍ حُذفت.
 */
export async function setTargetState(draftId, targetId, state) {
  if (!draftId || !targetId) return null;
  const draft = await studyDrafts.get(draftId);
  if (!draft) return null;
  const next = { ...chunkStates(draft) };
  if (state === CHUNK_STATE.PRACTICING || state === CHUNK_STATE.DONE) next[targetId] = state;
  else delete next[targetId];
  return studyDrafts.update(draftId, { [CHUNK_STATES]: next });
}

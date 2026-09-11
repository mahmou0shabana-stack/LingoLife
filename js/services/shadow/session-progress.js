/**
 * LingoLife — تقدّمُ جلسة الظلّ: أين أنت، وكم خلصت، وكم بقي (WS-PR)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العطبُ الذي وُلدت هذه الوحدةُ لإصلاحه — وقِستُه قبل أن أكتب سطرًا
 * ═══════════════════════════════════════════════════════════════
 *
 * كانت الشاشةُ تقول أثناء تدريب المسودّة:
 *
 *     4 / 03 SENTENCES
 *
 * موضعٌ رابعٌ في ثلاثٍ. والسببُ رقمان كلاهما خاطئ:
 *
 *   البسط  — `player.state.index` **فهرسٌ مطلق** في `ctx.segments`،
 *            ومقاطعُ التدريب تُلحَق **بعد** مقاطع المصدر. فأوّلُ وحدةِ
 *            تدريبٍ فهرسُها ٣ لا ٠.
 *   المقام — `segments.length` **مجمَّدٌ لحظةَ الرسم**، وقد كان ثلاثةً
 *            قبل أن تُلحَق الستَّ عشرةَ وحدة.
 *
 * والمحرّكُ يعرف الجوابَ الصحيح: `player.sourceWindow` هي `{from, to}`
 * التي تحصر التنقّلَ في مقاطع المصدر الجاري وحدَه. فالموضعُ يُحسَب
 * **داخل النافذة** لا في المصفوفة كلِّها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وثلاثةُ أرقامٍ لا رقمان — ولا يجوز خلطُها
 * ═══════════════════════════════════════════════════════════════
 *
 * الطلبُ نهى صراحةً عن أن يُعَدَّ «أنت الآن عند الوحدة ١٢» بمعنى «أنهيتَ
 * اثنتي عشرة». وفي التطبيق **ثلاث** إشاراتٍ حقيقيّةٍ مختلفةُ المصدر
 * ومختلفةُ البقاء:
 *
 *   الموضعُ   `index - from + 1`            ملاحةٌ خالصة. لا تعني شيئًا
 *                                            عن الإتقان.
 *   مارستَ    `segment.repetitionsCompleted` يرتفع حين تكتمل دورةُ
 *                                            تكرار. ومقاطعُ التدريب
 *                                            **مؤقّتةٌ في الذاكرة**
 *                                            (`temporary: true`) فلا
 *                                            صفَّ لها في القاعدة —
 *                                            فهذا الرقمُ لا ينجو من
 *                                            إعادة التحميل، ويُقال ذلك.
 *   خلصت      `CHUNK_STATE.DONE` بمعرّف الهدف حكمُك أنت، مكتوبٌ على
 *                                            سجلّ المسودّة — **ينجو**.
 *
 * فالوحدةُ هنا تحسبها كلَّها وتسمّي كلًّا باسمه، ولا تجمع ما لا يُجمَع.
 *
 * ⚠️ **وحسابٌ خالصٌ بلا قاعدةٍ ولا DOM**: تُنادى مع كلّ نقلةِ وحدة،
 *    فلو لمست IndexedDB لَصار التنقّلُ كتابةً تُزامَن. وهي تأخذ ما
 *    بيد الشاشة وتُعيد أرقامًا.
 */

import { ROLE, isSpeechRole } from './draft-targets.js';
import { GROUP_LABEL } from './draft-learning.js';
import { CHUNK_STATE } from './sentence-learning.js';
import { CHAIN_PARENT } from './draft-v2.js';

/**
 * أقسامُ الجلسة كما يراها المتعلّم.
 *
 * ⚠️ **وشريطُ الاسترجاع السريع قسمٌ بذاته** (بند ٩): وحداتُه أسئلةٌ
 *    وإجاباتٌ بالدور، لكنّها **مراجعةٌ مضغوطةٌ** لا استرجاعُ قلبٍ
 *    بعينه. ودمجُها في «أسئلة الاسترجاع» يُخفي أنّك دخلت المراجعة.
 */
export const CHAIN_SECTION = 'quick_chain';

export const SECTION_LABEL = Object.freeze({
  ...GROUP_LABEL,
  [ROLE.RECALL_CUE]: 'الأسئلة',
  [ROLE.RECALL_ANSWER]: 'الإجابات',
  [CHAIN_SECTION]: 'Quick Recall',
});

/** ترتيبُ الأقسام في التفصيل — بترتيب ظهورها المؤلَّف. */
export const SECTION_ORDER = Object.freeze([
  ROLE.MICRO_CORE, ROLE.RECALL_CUE, ROLE.RECALL_ANSWER,
  ROLE.EXPANSION, ROLE.VARIATION, ROLE.FULL_BUILD, ROLE.EXAMPLE,
  CHAIN_SECTION,
]);

/** القسمُ الذي تنتمي إليه وحدةٌ — والشريطُ يسبق الدور. */
export function sectionOf(target) {
  if (!target) return '';
  if (target.parent === CHAIN_PARENT) return CHAIN_SECTION;
  return target.role || '';
}

/**
 * تقدّمُ الجلسة الجارية.
 *
 * @param {object[]} segments   `ctx.segments` كاملةً
 * @param {{from:number,to:number}|null} window `player.sourceWindow`
 * @param {number} index        `player.state.index` — فهرسٌ مطلق
 * @param {Map<string,object>} byId  معرّفُ هدفٍ ← هدفُ المسودّة بدوره وحاله
 *
 * @returns {{
 *   total:number, position:number, remaining:number,
 *   practised:number, done:number,
 *   percentDone:number, percentPractised:number, percentPosition:number,
 *   hasRoles:boolean,
 *   section:{key:string,label:string,index:number,total:number}|null,
 *   sections:{key:string,label:string,total:number,done:number,practised:number,at:boolean}[],
 *   pair:{index:number,total:number,part:string}|null,
 *   next:{key:string,label:string}|null,
 *   units:{id:string,key:string,done:boolean,practised:boolean,at:boolean}[],
 * }}
 */
export function sessionProgress(segments, window, index, byId = new Map()) {
  const all = Array.isArray(segments) ? segments : [];
  /*
   * ⚠️ **ولا نافذةَ تعني الجلسةَ كلَّها** — وهي حالُ المصدر الأصليّ.
   *    فلا يصلح `?? 0` وحدَه هنا: لا بدّ من مقامٍ يتبع الطول الحاليّ.
   */
  const from = Math.max(0, window?.from ?? 0);
  const to = Math.min(all.length - 1, window?.to ?? (all.length - 1));
  const units = [];

  let position = 0;
  let done = 0;
  let practised = 0;
  const bySection = new Map();

  for (let i = from; i <= to; i += 1) {
    const seg = all[i];
    if (!seg) continue;
    const target = seg.targetId ? byId.get(seg.targetId) : null;
    const key = sectionOf(target);
    const isDone = target?.state === CHUNK_STATE.DONE;
    const isPractised = (seg.repetitionsCompleted || 0) > 0;
    const at = i === index;
    if (at) position = units.length + 1;
    if (isDone) done += 1;
    if (isPractised) practised += 1;

    if (key) {
      if (!bySection.has(key)) bySection.set(key, { key, total: 0, done: 0, practised: 0, at: false, seen: 0 });
      const box = bySection.get(key);
      box.total += 1;
      if (isDone) box.done += 1;
      if (isPractised) box.practised += 1;
      if (at) { box.at = true; box.seen = box.total; }
    }
    units.push({ id: seg.id, key, done: isDone, practised: isPractised, at, target });
  }

  const total = units.length;
  const hasRoles = units.some((one) => one.key);

  /*
   * ⚠️ **والقسمُ يُقاس بترتيب الوحدة داخله لا بعدد ما مضى منه**: قد
   *    تقفز إلى الوحدة الأخيرة في قسمٍ، فيقول «٧ / ٧» وهو صحيح — أنت
   *    السابعة — ولا يقول إنّك أنهيتَ سبعًا. ولذلك اسمُه «موضع».
   */
  const atUnit = units.find((one) => one.at) || null;
  const atKey = atUnit?.key || '';
  const box = atKey ? bySection.get(atKey) : null;
  const section = box
    ? { key: atKey, label: SECTION_LABEL[atKey] || atKey, index: box.seen, total: box.total }
    : null;

  /*
   * ⚠️ **ووعيُ الزوج** (بند ٨): الزوجُ سؤالٌ وإجابتُه، ورقمُه ترتيبُ
   *    سؤاله بين أسئلة الجلسة. فحين تكون على الإجابة يُنسَب الزوجُ
   *    إلى **السؤال الذي يسبقها**، لا إلى ترتيبها بين الإجابات —
   *    وإلّا انفصل نصفا الزوج في العدّ وقالا رقمين مختلفين.
   */
  const cues = units.filter((one) => one.target?.role === ROLE.RECALL_CUE);
  let pair = null;
  if (atUnit?.target?.role === ROLE.RECALL_CUE) {
    pair = { index: cues.indexOf(atUnit) + 1, total: cues.length, part: 'q' };
  } else if (atUnit?.target?.role === ROLE.RECALL_ANSWER) {
    const at = units.indexOf(atUnit);
    let owner = -1;
    for (let i = at - 1; i >= 0; i -= 1) {
      if (units[i].target?.role === ROLE.RECALL_CUE) { owner = cues.indexOf(units[i]); break; }
    }
    pair = { index: owner + 1, total: cues.length, part: 'a' };
  }

  const nextUnit = atUnit ? units[units.indexOf(atUnit) + 1] : null;
  const next = nextUnit
    ? { key: nextUnit.key, label: SECTION_LABEL[nextUnit.key] || nextUnit.key }
    : null;

  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return {
    total,
    position,
    remaining: Math.max(0, total - done),
    practised,
    done,
    percentDone: pct(done),
    percentPractised: pct(practised),
    percentPosition: pct(position),
    hasRoles,
    section,
    /*
     * ⚠️ **ولا قسمَ بصفرٍ كاذب** (بند ١٤): قسمٌ لم يُؤلَّف لا يُعرَض
     *    «٠ / ٠». والترتيبُ ثابتٌ، والموجودُ وحدَه يظهر.
     */
    sections: SECTION_ORDER
      .filter((key) => bySection.has(key))
      .map((key) => {
        const one = bySection.get(key);
        return {
          key, label: SECTION_LABEL[key] || key,
          total: one.total, done: one.done, practised: one.practised, at: one.at,
        };
      }),
    pair,
    next,
    units,
  };
}

/**
 * خريطةُ معرّفٍ ← هدف، من نموذج المسودّة.
 *
 * ⚠️ **ولا تُبنى من النصّ**: الوحدةُ تحمل `targetId` ثابتًا، والنصُّ قد
 *    يتكرّر حرفيًّا في هدفين — وهو ما نهى عنه عقدُ الهُويّة في WS-DV2.
 */
export function targetIndex(model) {
  const out = new Map();
  for (const one of model?.targets || []) if (one.id) out.set(one.id, one);
  return out;
}

/** أهي وحدةُ قلبٍ دلاليّة؟ — لأجل عدٍّ لا يخلط السؤالَ بالقلب. */
export const isCoreUnit = (target) => isSpeechRole(target?.role);

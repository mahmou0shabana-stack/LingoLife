/**
 * LingoLife — إحصاءُ النقص: قراءةٌ واحدةٌ للعالم كلّه
 *
 * ═══════════════════════════════════════════════════════════════
 * قراءةٌ واحدة، لا استعلامٌ لكل ذكرى
 * ═══════════════════════════════════════════════════════════════
 *
 * الاستوديو يسأل سؤالًا عن **كل** ذكرياتك دفعةً واحدة: «إيه الناقص
 * فين؟». والطريق الساذج أن يُسأل لكل ذكرى على حدة — فتصير شاشةٌ
 * واحدةٌ ألفَ استعلام على قاعدةٍ فيها ألف ذكرى.
 *
 * فالعالم يُقرأ **ستّ قراءات ثابتة** مهما كبر: الذكريات، وأجزاء
 * المحادثة، وروابط المشاركة، وروابط الخيوط، والأشخاص، والخيوط. ثم
 * تُبنى منها خرائطُ في الذاكرة، وكلُّ سؤالٍ بعدها إصابةُ `Map`.
 *
 * ⚠️ وقُيس هذا في WS8 لا خُمِّن: كل شيءٍ خطّيّ عند ٣٠٠٠ ذكرى، والثمن
 *    الحقيقيّ كان دائمًا عددَ الاستعلامات لا حجمَ المقروء.
 *
 * ═══════════════════════════════════════════════════════════════
 * والدليل يأتي إليك
 * ═══════════════════════════════════════════════════════════════
 *
 * أصعب ما في إثراء مئتَي ذكرى ليس الضغط — بل **التذكّر**. «اجتماع
 * ١٢ مارس» وحده لا يقول شيئًا، فتفتحه لتعرف ما فيه، فتكون قد فتحت
 * مئتين.
 *
 * فكل صفٍّ في مجموعة العمل يحمل ما نعرفه عنه بالفعل: مَن تكلّم فيه،
 * وفي أي قصّة هو، وأين كان. تقرأ السطر فتعرف ما تكتب بلا أن تفتح.
 */

import {
  scenes, conversationParts, relationships, people, eventThreads, contentBlocks,
} from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { SCENE_PERSON } from '../participant-service.js';
import { THREAD_SCENE } from '../thread-service.js';
import { typeLabel } from '../type-service.js';
import { ASPECTS, aspectById } from './aspects.js';

/**
 * العالم كما هو الآن — خرائطُ جاهزةٌ للسؤال.
 *
 * @returns {Promise<object>}
 */
export async function readWorld() {
  const [sceneRows, parts, joinRows, threadRows, personRows, threads, blocks] = await Promise.all([
    scenes.getActive(),
    conversationParts.getAll(),
    // إصابةُ فهرس `kind` — لا مسحَ كاملًا لـ`relationships`.
    relationships.byIndex('kind', SCENE_PERSON),
    relationships.byIndex('kind', THREAD_SCENE),
    people.getAll(),
    eventThreads.getAll(),
    /* قراءةٌ سابعةٌ ثابتة — لا استعلامٌ لكل ذكرى. */
    contentBlocks.getAll(),
  ]);

  const live = new Set(sceneRows.map((row) => row.id));

  const declaredByScene = new Map();
  for (const row of joinRows) {
    if (row.state !== STATE.ACTIVE || !live.has(row.fromId)) continue;
    if (!declaredByScene.has(row.fromId)) declaredByScene.set(row.fromId, []);
    declaredByScene.get(row.fromId).push(row.toId);
  }

  const speakersByScene = new Map();
  for (const part of parts) {
    if (part.state !== STATE.ACTIVE || !part.personId || !live.has(part.sceneId)) continue;
    if (!speakersByScene.has(part.sceneId)) speakersByScene.set(part.sceneId, []);
    const list = speakersByScene.get(part.sceneId);
    if (!list.includes(part.personId)) list.push(part.personId);
  }

  /*
   * ⚠️ الحاوي `fromId` والعضو `toId` — الخيط يحوي الذكرى، فالخريطة
   *    من الذكرى إلى خيوطها تُقلب هنا مرّةً بدل أن تُقلب في كل سؤال.
   */
  const threadsByScene = new Map();
  const scenesByThread = new Map();
  for (const row of threadRows) {
    if (row.state !== STATE.ACTIVE || !live.has(row.toId)) continue;
    if (!threadsByScene.has(row.toId)) threadsByScene.set(row.toId, []);
    threadsByScene.get(row.toId).push(row.fromId);
    if (!scenesByThread.has(row.fromId)) scenesByThread.set(row.fromId, new Set());
    scenesByThread.get(row.fromId).add(row.toId);
  }

  /* أيُّ ذكرى نصُّها الأصليّ مكتوبٌ فعلًا — الفارغ ليس مكتوبًا. */
  const rawByScene = new Set(
    blocks
      .filter((row) => row.state === STATE.ACTIVE && row.kind === 'rawTranscript'
        && String(row.text || '').trim())
      .map((row) => row.sceneId)
  );

  // مَن حُذف لا يُعرَض اسمُه ولا يُقترَح.
  const livePeople = personRows.filter((row) => row.state !== STATE.TRASHED);

  return {
    scenes: sceneRows,
    personName: new Map(livePeople.map((row) => [row.id, row.name])),
    threadTitle: new Map(
      threads.filter((row) => row.state !== STATE.TRASHED).map((row) => [row.id, row.title])
    ),
    rawByScene,
    declaredByScene,
    speakersByScene,
    threadsByScene,
    scenesByThread,
  };
}

/* ------------------------------------------------------------------ *
 * الإحصاء
 * ------------------------------------------------------------------ */

/**
 * كم ذكرى ينقصها كلُّ وجه.
 *
 * ⚠️ **والنسبة تُعرَض مع الرقم لا وحدها.** «٪٦٠ ناقص» على تسع ذكريات
 *    ليست كـ«٪٦٠» على تسعمئة، والنسبةُ وحدها تُخفي الفرق.
 *
 * @returns {Promise<{total:number, aspects:object[]}>}
 */
export async function censusGaps(world = null) {
  const w = world || await readWorld();
  const total = w.scenes.length;

  const rows = ASPECTS.map((aspect) => {
    const missing = w.scenes.filter((scene) => aspect.missing(scene, w));
    return {
      id: aspect.id,
      label: aspect.label,
      why: aspect.why,
      since: aspect.since,
      bulk: aspect.bulk,
      bulkReason: aspect.bulkReason || '',
      missing: missing.length,
      filled: total - missing.length,
      /** ما عندنا عنه دليلٌ جاهز — وهو الأسهل ملؤه. */
      withEvidence: missing.filter((scene) => aspect.evidence(scene, w).length).length,
    };
  });

  return {
    total,
    /*
     * الأكثر نقصًا أوّلًا — لأنه أكبر ما يمكن أن تُصلحه في جلسة.
     * وعند التساوي بالاسم، فلا يتراقص الترتيب بين فتحةٍ وأخرى.
     */
    aspects: rows.sort((a, b) => b.missing - a.missing || a.label.localeCompare(b.label, 'ar')),
    world: w,
  };
}

/* ------------------------------------------------------------------ *
 * مجموعة العمل
 * ------------------------------------------------------------------ */

/**
 * الشرائح — مُشتقّةٌ من الواقع لا مخمَّنة.
 *
 * ⚠️ ولا شريحةَ تقترح **قيمة**. «الذكريات اللي فيها إيجور اتكلّم»
 *    واقعة؛ أمّا «يمكن مارينا كانت معاه» فتخمينٌ، وأداةٌ تخمّن ثم
 *    تكتب مئتَي صفّ تفسد ذاكرتك وأنت تظنّها تساعدك.
 */
export const COHORTS = Object.freeze([
  {
    id: 'all',
    label: 'كل الناقص',
    hint: 'كل الذكريات اللي الوجه ده ناقص فيها',
    keep: () => true,
  },
  {
    id: 'evidence',
    label: 'اللي عندنا عنها دليل',
    hint: 'فيها متكلّمين أو قصّة أو مكان — تقدر تملاها من غير ما تفتحها',
    keep: (row) => row.evidence.length > 0,
  },
  {
    id: 'bare',
    label: 'اللي مالهاش أي دليل',
    hint: 'مفيش فيها كلام ولا قصّة — دي محتاجة إنك تفتحها وتفتكر',
    keep: (row) => row.evidence.length === 0,
  },
]);

/**
 * الذكريات التي ينقصها وجهٌ ما، ومعها دليلُ كلٍّ.
 *
 * @param {string} aspectId
 * @param {object} [options]
 * @param {string} [options.cohort]  معرّف شريحة من `COHORTS`
 * @param {string} [options.query]   ترشيحٌ نصّيّ على العنوان
 * @param {object} [options.world]
 */
export async function workingSet(aspectId, { cohort = 'all', query = '', world = null } = {}) {
  const aspect = aspectById(aspectId);
  if (!aspect) throw new Error(`وجه إثراء مش معروف: ${aspectId}`);

  const w = world || await readWorld();
  const slice = COHORTS.find((row) => row.id === cohort) || COHORTS[0];
  const needle = String(query || '').trim().toLowerCase();

  const rows = w.scenes
    .filter((scene) => aspect.missing(scene, w))
    .map((scene) => ({
      id: scene.id,
      title: scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان',
      date: scene.date,
      current: aspect.current(scene, w),
      evidence: aspect.evidence(scene, w),
    }))
    .filter((row) => slice.keep(row))
    .filter((row) => !needle || row.title.toLowerCase().includes(needle))
    // الأحدث أوّلًا: ما زال في ذاكرتك، فملؤه أصدق.
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.id.localeCompare(b.id));

  return {
    aspect: {
      id: aspect.id,
      label: aspect.label,
      why: aspect.why,
      since: aspect.since,
      bulk: aspect.bulk,
      bulkReason: aspect.bulkReason || '',
      fill: aspect.fill,
      input: aspect.input,
    },
    rows,
    /** أعداد كل شريحة — لتُعرَض على الأزرار قبل الضغط. */
    counts: Object.fromEntries(COHORTS.map((slice_) => [
      slice_.id,
      w.scenes
        .filter((scene) => aspect.missing(scene, w))
        .filter((scene) => slice_.keep({ evidence: aspect.evidence(scene, w) }))
        .length,
    ])),
    world: w,
  };
}

/* ------------------------------------------------------------------ *
 * الأثر — ما الذي يفتحه الملء
 * ------------------------------------------------------------------ */

/**
 * ماذا سيصير بعد الكتابة — بأرقامٍ مُشتقّة لا بتشجيع.
 *
 * ⚠️ **قبل وبعد، لا «بعد» وحده.** أن يُقال «هيبقى في ٣٦ ذكرى» بلا
 *    «كان في ٢» يجعل الرقم بلا معنى — فلا تعرف هل صنعتَ شيئًا.
 *
 * @returns {{label:string, before:number, after:number}[]}
 */
export function impactOf(aspectId, value, sceneIds, world) {
  const ids = new Set(sceneIds || []);
  if (!ids.size) return [];

  if (aspectId === 'participants') {
    const chosen = Array.isArray(value) ? value : [value].filter(Boolean);
    return chosen.map((personId) => {
      // «في كام ذكرى» = الاتحاد نفسه الذي يقرؤه الأطلس (WS9).
      const before = new Set();
      for (const [sceneId, list] of world.declaredByScene) {
        if (list.includes(personId)) before.add(sceneId);
      }
      for (const [sceneId, list] of world.speakersByScene) {
        if (list.includes(personId)) before.add(sceneId);
      }
      const after = new Set(before);
      for (const id of ids) after.add(id);
      return {
        label: world.personName.get(personId) || 'شخص',
        before: before.size,
        after: after.size,
      };
    });
  }

  if (aspectId === 'thread') {
    const threadId = String(value || '');
    const before = world.scenesByThread.get(threadId) || new Set();
    const after = new Set(before);
    for (const id of ids) after.add(id);
    return [{
      label: world.threadTitle.get(threadId) || 'القصّة',
      before: before.size,
      after: after.size,
    }];
  }

  if (aspectId === 'place') {
    const name = String(value || '').trim();
    if (!name) return [];
    const before = world.scenes.filter(
      (scene) => String(scene.placeName || '').trim() === name
    ).length;
    return [{ label: name, before, after: before + ids.size }];
  }

  if (aspectId === 'type') {
    const typeId = String(value || '');
    const before = world.scenes.filter((scene) => scene.type === typeId).length;
    /*
     * ⚠️ الوسم لا المعرّف. الذكرى تحمل `phone` وتُعرَض «مكالمة» — وأن
     *    يظهر المعرّف الخام في شاشةٍ يعني أن يقرأ المستخدم اسمًا
     *    داخليًّا لا يعرفه، فيظنّه خطأً أو نوعًا آخر.
     */
    return [{ label: typeLabel(typeId) || typeId, before, after: before + ids.size }];
  }

  return [];
}

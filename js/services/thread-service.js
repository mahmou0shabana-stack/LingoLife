/**
 * LingoLife — خيوط الأحداث
 *
 * «موضوع الشحنة اللي اتأخّرت» ليس مشهدًا: هو اجتماعٌ يوم الأحد،
 * ومكالمةٌ بعده بيومين، وفحصٌ في الموقع، ورسالةٌ في آخر الشهر. أربعة
 * مشاهد وقصّةٌ واحدة.
 *
 * ───────────────────────────────────────────────────────────────
 * الخيط **قضيّة تُفتَح وتُغلَق**، لا موضوعٌ دائم.
 *
 * وهذا قرارٌ مقصود يفرّق بين شيئين متشابهين: «التعامل مع الجمارك»
 * موضوعٌ لا ينتهي — مكانه `topics`. و«شحنة أبريل اللي اتأخّرت» قضيّة
 * لها بداية ونهاية وحالة، وسؤالها الحاكم: **«إيه اللي لسه مفتوح؟»**
 *
 * ولذلك للخيط `status` و`endDate`، ولا شيء منهما لـ`topic`.
 * ───────────────────────────────────────────────────────────────
 *
 * وثلاث قواعد بنيوية:
 *
 *  · **العضويّة علاقةٌ لا حقل** (بند 27). المشهد لا يحمل `threadId`؛
 *    صفٌّ في `relationships` يربطهما. فالمشهد يبقى مستقلًّا تمامًا،
 *    وخيطٌ يُحذف لا يترك أثرًا في ذكرياتك.
 *
 *  · **العلاقات مُصنَّفة لا عامّة** (بند 28). «مرتبط» لا تقول شيئًا؛
 *    «نتيجة لـ» و«ردٌّ على» و«أُعيد فتحه بعد» تقول القصّة.
 *
 *  · **الاقتراحات بأدلّة معلَنة** (بند 31). لا «ذكاء» مُدَّعى: نفس
 *    الشخص، نفس المكان، تقارب التواريخ — تُعرَض بسببها وتنتظر تأكيدك.
 */

import { eventThreads, relationships, scenes, conversationParts } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { normalize } from '../utils/normalization.js';
import { newId, PREFIX } from '../utils/ids.js';
import { link, unlink, linksOf, membershipKind, containersOf } from './link-service.js';
import { toISODate } from '../utils/dates.js';

/**
 * حالات الخيط.
 *
 * ⚠️ ليست زينة: هي ما يجعل «إيه اللي لسه مفتوح؟» سؤالًا له جواب.
 *    و«أُعيد فتحه» حالةٌ مستقلّة عن «نشط» عمدًا — قضيّةٌ ظننتَها
 *    انتهت ثم عادت ليست كقضيّةٍ لم تنتهِ قطّ.
 */
export const THREAD_STATUS = Object.freeze({
  ACTIVE: 'active',
  WAITING: 'waiting',
  PAUSED: 'paused',
  RESOLVED: 'resolved',
  REOPENED: 'reopened',
});

export const THREAD_STATUS_LABEL = Object.freeze({
  active: 'نشط',
  waiting: 'مستنّي ردّ',
  paused: 'موقوف',
  resolved: 'خلص',
  reopened: 'اتفتح تاني',
});

/** الحالات التي تعني «لسه مفتوح». */
export const OPEN_STATUSES = Object.freeze([
  THREAD_STATUS.ACTIVE,
  THREAD_STATUS.WAITING,
  THREAD_STATUS.REOPENED,
]);

/**
 * نوع الرابط بين الخيط ومشاهده — بالاصطلاح العامّ `<حاوٍ>:<عضو>`.
 *
 * ⚠️ **الخيط حاوٍ، وليس أعلى مستوًى نهائيًّا.** لا شيء في هذا الملفّ
 *    يفترض أن فوقه لا شيء: العضويّة علاقةٌ بالاصطلاح نفسه، فيوم يصير
 *    المشروع كيانًا يكفيه `project:thread` و`project:scene` بلا لمس
 *    سطرٍ هنا ولا حقلٍ في القاعدة. راجع `link-service.membershipKind`.
 */
export const THREAD_SCENE = membershipKind('thread', 'scene');

/**
 * العلاقات المُصنَّفة بين مشهدين (بند 28).
 *
 * ⚠️ **لا «مرتبط» عامّة.** رابطٌ بلا تصنيف يقول «فيه حاجة بينهم»
 *    ولا يقول ماذا — وبعد شهر لن تتذكّر. `label` ما تراه من الطرف
 *    الأوّل، و`inverse` ما تراه من الثاني: «أ نتيجة لـ ب» تعني
 *    «ب أدّى إلى أ».
 */
export const SCENE_RELATIONS = Object.freeze({
  continued_from: { label: 'كملة لـ', inverse: 'كمل فيها' },
  follow_up_to: { label: 'متابعة لـ', inverse: 'اتتابعت في' },
  same_topic_as: { label: 'نفس الموضوع', inverse: 'نفس الموضوع' },
  result_of: { label: 'نتيجة لـ', inverse: 'أدّى لـ' },
  resolved_by: { label: 'اتحلّت بـ', inverse: 'حلّت' },
  reopened_after: { label: 'اتفتحت تاني بعد', inverse: 'اتفتح بعدها' },
  parallel_to: { label: 'بالتوازي مع', inverse: 'بالتوازي مع' },
});

function toView(record) {
  return {
    id: record.id,
    title: record.title,
    description: record.description || '',
    status: record.status || THREAD_STATUS.ACTIVE,
    startDate: record.startDate || null,
    endDate: record.endDate || null,
    color: record.color || null,
    archived: record.state === STATE.ARCHIVED,
    isOpen: OPEN_STATUSES.includes(record.status || THREAD_STATUS.ACTIVE),
  };
}

/* ------------------------------------------------------------------ *
 * القراءة
 * ------------------------------------------------------------------ */

export async function listThreads({ includeArchived = false, onlyOpen = false } = {}) {
  const rows = await eventThreads.getAll();
  return rows
    .filter((r) => r.state !== STATE.TRASHED && (includeArchived || r.state !== STATE.ARCHIVED))
    .map(toView)
    .filter((t) => !onlyOpen || t.isOpen)
    // الأحدث بدايةً أوّلًا: القصّة الجارية أقرب إلى ذهنك من قصّةٍ قديمة.
    .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
}

export async function getThread(id) {
  const record = await eventThreads.get(id);
  return record ? toView(record) : null;
}

/** «إيه اللي لسه مفتوح؟» — السؤال الذي وُجد الخيط لأجله. */
export async function openThreads() {
  return listThreads({ onlyOpen: true });
}

/* ------------------------------------------------------------------ *
 * الكتابة
 * ------------------------------------------------------------------ */

export async function createThread({ title, description = '', status = THREAD_STATUS.ACTIVE,
  startDate = null, color = null } = {}) {
  const clean = (title || '').trim();
  if (!clean) throw new Error('عنوان الخيط مطلوب');

  const created = await eventThreads.create({
    id: newId(PREFIX.THREAD),
    title: clean,
    normalizedName: normalize(clean),
    description: (description || '').trim(),
    status,
    startDate,
    endDate: null,
    /*
     * ⚠️ **لا حقول عضويّة هنا.** كانت الخطّة الأولى تحمل `projectIds`
     *    و`journeyIds` و`personIds` — مصفوفاتٌ فارغة على كل خيط تنتظر
     *    ميزاتٍ لم تُبنَ. وهي تناقض القاعدة المكتوبة أعلى هذا الملفّ:
     *    العضويّة علاقةٌ لا حقل. أُزيلت.
     *
     *    والأشخاص والأماكن تُشتقّ من مشاهد الخيط (`threadSummary`) لا
     *    تُملأ يدويًّا — رقمٌ محسوب أصدق من حقلٍ تنسى تحديثه.
     */
    color,
  });
  return toView(created);
}

export async function updateThread(id, changes) {
  const current = await eventThreads.get(id);
  if (!current) throw new Error('الخيط ده مش موجود');

  const patch = { ...changes };
  if (changes.title !== undefined) patch.normalizedName = normalize(changes.title);
  if (changes.archived !== undefined) {
    patch.state = changes.archived ? STATE.ARCHIVED : STATE.ACTIVE;
    delete patch.archived;
  }

  /*
   * ⚠️ `endDate` تتبع الحالة ولا تُكتب يدويًّا:
   *    - «خلص» يختم اليوم إن لم يكن مختومًا.
   *    - «اتفتح تاني» **يمسح الختم**، وإلا بقيت قضيّةٌ مفتوحة تحمل
   *      تاريخ انتهاء — وهو تناقضٌ يظهر في كل شاشة تعرضها.
   */
  if (changes.status === THREAD_STATUS.RESOLVED && !current.endDate) {
    patch.endDate = toISODate(Date.now());
  }
  if (changes.status && OPEN_STATUSES.includes(changes.status)) {
    patch.endDate = null;
  }

  return toView(await eventThreads.update(id, patch));
}

export async function archiveThread(id, archived = true) {
  return updateThread(id, { archived });
}

/* ------------------------------------------------------------------ *
 * العضويّة — علاقةٌ لا حقل
 * ------------------------------------------------------------------ */

export async function addSceneToThread(threadId, sceneId) {
  const row = await link(threadId, sceneId, THREAD_SCENE);
  // بداية الخيط هي أقدم مشاهده — تُحسَب لا تُكتب.
  await syncThreadDates(threadId);
  return row;
}

export async function removeSceneFromThread(threadId, sceneId) {
  const removed = await unlink(threadId, sceneId, THREAD_SCENE);
  if (removed) await syncThreadDates(threadId);
  return removed;
}

/** مشاهد الخيط بترتيبها الزمني — القصّة كما جرت. */
export async function threadScenes(threadId) {
  const rows = await linksOf(threadId, THREAD_SCENE);
  const found = await scenes.getMany(rows.map((r) => r.otherId));
  return found
    .filter((s) => s && s.state === STATE.ACTIVE)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * ما يحوي **الخيط نفسه**، إن وُجد.
 *
 * ⚠️ اليوم تعود فارغةً دائمًا: لا كيان فوق الخيط بعد. وهي موجودة
 *    لتُثبت أن البنية لا تفترض أنه القمّة — يوم يصير المشروع كيانًا
 *    تعود مملوءةً بلا تعديل سطرٍ هنا. وحضورها الآن دليلٌ يُختبَر لا
 *    وعدٌ في تعليق.
 */
export async function containersOfThread(threadId) {
  return containersOf(threadId);
}

/** الخيوط التي ينتمي إليها مشهد. */
export async function threadsOfScene(sceneId) {
  const rows = await linksOf(sceneId, THREAD_SCENE);
  const found = await eventThreads.getMany(rows.map((r) => r.otherId));
  return found.filter((t) => t && t.state !== STATE.TRASHED).map(toView);
}

/** يُبقي `startDate` على أقدم مشاهد الخيط. */
async function syncThreadDates(threadId) {
  const list = await threadScenes(threadId);
  if (!list.length) return;
  await eventThreads.update(threadId, { startDate: list[0].date });
}

/* ------------------------------------------------------------------ *
 * العلاقات المُصنَّفة بين المشاهد
 * ------------------------------------------------------------------ */

export async function relateScenes(fromSceneId, toSceneId, kind) {
  if (!SCENE_RELATIONS[kind]) throw new Error('نوع علاقة مش معروف');
  return link(fromSceneId, toSceneId, `scene:${kind}`);
}

export async function unrelateScenes(fromSceneId, toSceneId, kind) {
  return unlink(fromSceneId, toSceneId, `scene:${kind}`);
}

/**
 * علاقات مشهدٍ بالمشاهد الأخرى، كلٌّ بتصنيفها **من جهة هذا المشهد**.
 *
 * الاتجاه يهمّ: «أ نتيجة لـ ب» يجب أن تُقرأ من ب كـ«أدّى لـ أ». عرضها
 * بنفس النصّ من الطرفين يقلب المعنى.
 */
export async function sceneRelations(sceneId) {
  const out = [];
  for (const kind of Object.keys(SCENE_RELATIONS)) {
    const rows = await linksOf(sceneId, `scene:${kind}`);
    for (const row of rows) {
      const outgoing = row.fromId === sceneId;
      const scene = await scenes.get(row.otherId);
      if (!scene || scene.state !== STATE.ACTIVE) continue;
      out.push({
        kind,
        scene,
        label: outgoing ? SCENE_RELATIONS[kind].label : SCENE_RELATIONS[kind].inverse,
        outgoing,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * الاقتراحات — بأدلّة معلَنة (بند 31)
 * ------------------------------------------------------------------ */

/** أيامٌ بين تاريخين نصّيّين. */
function daysBetween(a, b) {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

/**
 * خيوطٌ قد ينتمي إليها هذا المشهد.
 *
 * ⚠️ **لا ذكاء مُدَّعى.** كل اقتراحٍ يحمل أدلّته بالنصّ: «نفس الشخص +
 *    بعد يومين». تقرؤها فتوافق أو ترفض. اقتراحٌ بلا سببٍ معروض هو
 *    تخمينٌ يطلب ثقةً لم يكسبها.
 *
 * @returns {Promise<{thread: object, score: number, reasons: string[]}[]>}
 */
export async function suggestThreadsFor(sceneId, { maxDays = 30 } = {}) {
  const scene = await scenes.get(sceneId);
  if (!scene) return [];

  const already = new Set((await threadsOfScene(sceneId)).map((t) => t.id));
  const candidates = (await listThreads()).filter((t) => !already.has(t.id));
  if (!candidates.length) return [];

  const myPeople = new Set(
    (await conversationParts.byIndex('sceneId', sceneId))
      .filter((p) => p.state === STATE.ACTIVE && p.personId)
      .map((p) => p.personId)
  );

  const out = [];
  for (const thread of candidates) {
    const members = await threadScenes(thread.id);
    if (!members.length) continue;

    const reasons = [];
    let score = 0;

    // ① أشخاصٌ مشتركون — أقوى دليل: القصّة الواحدة يصنعها أهلها.
    const theirPeople = new Set();
    for (const member of members) {
      const parts = await conversationParts.byIndex('sceneId', member.id);
      for (const part of parts) {
        if (part.state === STATE.ACTIVE && part.personId) theirPeople.add(part.personId);
      }
    }
    const shared = [...myPeople].filter((p) => theirPeople.has(p));
    if (shared.length) {
      score += 3 * shared.length;
      reasons.push(shared.length === 1 ? 'نفس الشخص' : `${shared.length} أشخاص مشتركين`);
    }

    // ② قرب التاريخ — كلّما قرُب زاد الاحتمال.
    const nearest = members.reduce(
      (best, m) => Math.min(best, daysBetween(scene.date, m.date)),
      Infinity
    );
    if (nearest <= maxDays) {
      score += Math.max(1, 4 - Math.floor(nearest / 7));
      reasons.push(nearest === 0 ? 'نفس اليوم' : `فرق ${nearest} يوم`);
    }

    // ③ نفس المكان.
    if (scene.placeName && members.some((m) => m.placeName === scene.placeName)) {
      score += 2;
      reasons.push(`نفس المكان (${scene.placeName})`);
    }

    // ④ نفس نوع الحدث — أضعف دليل: «اجتماع شغل» يجمع أشياء كثيرة
    //    غير مترابطة، فلا يكفي وحده.
    if (scene.type && members.some((m) => m.type === scene.type)) {
      score += 1;
      reasons.push('نفس نوع الحدث');
    }

    // دليلٌ واحد ضعيف ليس اقتراحًا. نطلب دليلين أو دليلًا قويًّا.
    if (score >= 3 && reasons.length >= 2) out.push({ thread, score, reasons });
  }

  return out.sort((a, b) => b.score - a.score);
}

/**
 * ينشئ خيطًا من مشاهد مختارة — الإنشاء بأثر رجعي (بند 30).
 * تكتشف بعد شهرين أن أربعة مواقف كانت قصّةً واحدة، فتجمعها.
 */
export async function threadFromScenes(title, sceneIds) {
  const thread = await createThread({ title });
  for (const sceneId of sceneIds) await addSceneToThread(thread.id, sceneId);
  return getThread(thread.id);
}

/* ------------------------------------------------------------------ *
 * ملخّص الخيط
 * ------------------------------------------------------------------ */

/**
 * ملخّصٌ **كل رقمٍ فيه قابل للنقر** (بند 66) — ولذلك يعيد المعرّفات
 * لا الأعداد وحدها.
 */
export async function threadSummary(id) {
  const thread = await getThread(id);
  if (!thread) return null;

  const list = await threadScenes(id);
  const personIds = new Set();
  const placeNames = new Set();

  for (const scene of list) {
    if (scene.placeName) placeNames.add(scene.placeName);
    const parts = await conversationParts.byIndex('sceneId', scene.id);
    for (const part of parts) {
      if (part.state === STATE.ACTIVE && part.personId) personIds.add(part.personId);
    }
  }

  return {
    thread,
    scenes: list,
    sceneIds: list.map((s) => s.id),
    personIds: [...personIds],
    places: [...placeNames],
    from: list[0]?.date || thread.startDate || null,
    to: list[list.length - 1]?.date || null,
    // ⚠️ مدّةٌ بين أوّل حدثٍ وآخره — **لا «مدّة القضيّة»**. قضيّةٌ
    //    مفتوحة لم يقع فيها شيءٌ منذ شهر مدّتها أطول مما نعرف.
    spanDays: list.length > 1 ? daysBetween(list[0].date, list[list.length - 1].date) : 0,
  };
}

/** كم مشهدًا في كل خيط — لعرضه في القائمة بمسحةٍ واحدة. */
export async function threadSceneCounts() {
  const rows = await relationships.getAll();
  const counts = new Map();
  for (const row of rows) {
    if (row.state !== STATE.ACTIVE || row.kind !== THREAD_SCENE) continue;
    counts.set(row.fromId, (counts.get(row.fromId) || 0) + 1);
  }
  return counts;
}

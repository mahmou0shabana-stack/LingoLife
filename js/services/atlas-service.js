/**
 * LingoLife — الأطلس: نموذج القراءة الواحد
 *
 * كل شاشات الأطلس — النهر، اليوم، الأشجار، المحور — تقرأ من **هنا**،
 * وهذه تقرأ من `scenes` و`relationships` و`conversationParts` كما هي.
 *
 * ═══════════════════════════════════════════════════════════════
 * **لا عالمَ ثانيًا.**
 * ═══════════════════════════════════════════════════════════════
 *
 * الإغراء الطبيعي في بناء أطلس أن تُنشئ له مستودعًا خاصًّا: صفٌّ لكل
 * ذكرى فيه نوعها ومكانها وأشخاصها، مُحدَّثٌ عند كل تعديل. وهو أسرع
 * قراءةً وأسوأ ما يمكن فعله هنا: نسخةٌ ثانية من الحقيقة تفترق عن
 * الأولى عند أوّل تعديلٍ ينسى تحديثها، فترى الذكرى في شاشةٍ بنوعٍ
 * وفي أخرى بنوعٍ آخر — ولا تعرف أيّهما تصدّق.
 *
 * فالمحاور **تُشتقّ عند القراءة** من مصادرها الأصليّة. وهذا أبطأ،
 * والبطء يُعالَج بالفهارس وبالصفحات لا بالنسخ.
 *
 * ═══════════════════════════════════════════════════════════════
 * من أين يأتي كل محور — ولماذا بعضها غائب
 * ═══════════════════════════════════════════════════════════════
 *
 * | المحور   | المصدر                            | الحال            |
 * |----------|-----------------------------------|------------------|
 * | الزمن    | `scene.date` + فهرس `date`        | كامل             |
 * | النوع    | `scene.type` + `typeTree()`       | كامل، وشجريّ     |
 * | الخيط    | علاقة `thread:scene`              | كامل             |
 * | الشخص    | `conversationParts.personId`      | **مُشتقّ**       |
 * | المكان   | `scene.placeName` نصًّا مطبَّعًا    | جزئيّ            |
 * | الموضوع  | —                                 | **غائب**         |
 *
 * ⚠️ **الشخص مُشتقٌّ لا مُعلَن.** على `scene` حقلٌ اسمه `peopleIds`
 *    يُكتب `[]` عند الإنشاء **ولا يُملأ في أي مكان** — حقلٌ ميّت من
 *    الجيل الأوّل. والحقيقة الوحيدة عن «مَن كان في هذه الذكرى» هي
 *    `personId` على أجزاء المحادثة. فنشتقّ منها ولا نقرأ الحقل الميّت،
 *    وهو نفس مبدأ §3.6.1: **العضويّة علاقةٌ لا حقل**.
 *
 *    ونتيجته صادقة بحدودها: مَن حضر ولم يتكلّم لا يظهر. وهذا أصدق من
 *    حقلٍ فارغٍ يوهم بأنه لم يحضر أحد.
 *
 * ⚠️ **المكان نصٌّ لا كيان.** `scene.placeId` يبقى `null` دائمًا و
 *    `resolvePlace()` مكتوبةٌ وغير موصولة. فالتجميع على النصّ
 *    المطبَّع: «مكتب الشركة» و«مكتب الشركه» يجتمعان، ولا يُنشأ كيان.
 *
 * ⚠️ **المواضيع والرحلات والمشاريع غائبة، وتُعلَن غيابها.** مستودعاتٌ
 *    بلا خدمة تكتبها، فمحورٌ عليها يعرض صفرًا دائمًا. ومرشّحٌ لا يرشّح
 *    شيئًا أسوأ من مرشّحٍ غير موجود (بند 89).
 */

import { scenes, relationships, conversationParts, people, expressionOccurrences,
  expressions, mistakeComparisons, scripts, shadowSessions } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { normalize } from '../utils/normalization.js';
import { toISODate, daysBetween } from '../utils/dates.js';
import { THREAD_SCENE } from './thread-service.js';

/* ------------------------------------------------------------------ *
 * المحاور: ما له بيانات وما لا
 * ------------------------------------------------------------------ */

/** محاور التصفية التي يفهمها الأطلس كلّه — شكلٌ واحد لكل الشاشات. */
export const AXIS = Object.freeze({
  TYPE: 'typeId',
  PLACE: 'placeKey',
  PERSON: 'personId',
  THREAD: 'threadId',
});

/**
 * ما لا محورَ له اليوم ولماذا — يُعلَن ولا يُعرَض كمرشّحٍ فارغ.
 *
 * ⚠️ نفس مبدأ `NOT_SUPPORTED` في الاستيراد: القائمة إقرارٌ صريح لا
 *    نسيان، والاختبار يقارن بها.
 */
export const ABSENT_AXES = Object.freeze({
  topic: 'المواضيع مستودعٌ بلا خدمة تكتبه — المحور هيرجّع صفر دايمًا',
  journey: 'الرحلات مستودعٌ بلا خدمة تكتبه',
  project: 'المشروع قرارُ منتَجٍ مؤجَّل عمدًا — راجع docs/06',
});

/* ------------------------------------------------------------------ *
 * اشتقاق المحاور
 * ------------------------------------------------------------------ */

/** مفتاح تجميع المكان — النصّ المطبَّع، فلا ينقسم مكانٌ واحد بإملائين. */
export function placeKey(name) {
  return normalize(name || '');
}

/**
 * محاور مجموعةٍ من الذكريات دفعةً واحدة.
 *
 * ⚠️ عبر الفهارس لا بمسح المستودع: صفحةٌ من ثلاثين ذكرى تعني ستّين
 *    إصابة فهرس، لا قراءةَ كل أجزاء المحادثة في القاعدة.
 *
 * @param {object[]} sceneRows
 * @returns {Promise<Map<string, {typeId, placeKey, placeName, personIds, threadIds}>>}
 */
export async function facetsFor(sceneRows) {
  const rows = sceneRows.filter(Boolean);
  const ids = rows.map((s) => s.id);

  const [partGroups, linkGroups] = await Promise.all([
    Promise.all(ids.map((id) => conversationParts.byIndex('sceneId', id))),
    Promise.all(ids.map((id) => relationships.byIndex('toId', id))),
  ]);

  const map = new Map();
  rows.forEach((scene, i) => {
    const personIds = [...new Set(
      partGroups[i]
        .filter((part) => part.state === STATE.ACTIVE && part.personId)
        .map((part) => part.personId)
    )];

    const threadIds = linkGroups[i]
      .filter((row) => row.state === STATE.ACTIVE && row.kind === THREAD_SCENE)
      .map((row) => row.fromId);

    map.set(scene.id, {
      typeId: scene.type || 'other',
      placeName: scene.placeName || '',
      placeKey: placeKey(scene.placeName),
      personIds,
      threadIds,
    });
  });

  return map;
}

/**
 * معرّفات الذكريات التي يسمح بها مرشّح.
 *
 * `null` تعني «بلا تقييد» — وهي ليست مجموعةً فارغة: الفرق بين «كل
 * الذكريات» و«لا ذكرى تطابق» فرقٌ يظهر للمستخدم.
 *
 * @param {{typeId?, placeKey?, personId?, threadId?}} filters
 * @returns {Promise<Set<string>|null>}
 */
export async function allowedSceneIds(filters = {}) {
  const sets = [];

  if (filters[AXIS.PERSON]) {
    const parts = await conversationParts.byIndex('personId', filters[AXIS.PERSON]);
    sets.push(new Set(
      parts.filter((p) => p.state === STATE.ACTIVE).map((p) => p.sceneId).filter(Boolean)
    ));
  }

  if (filters[AXIS.THREAD]) {
    const links = await relationships.byIndex('from_kind', [filters[AXIS.THREAD], THREAD_SCENE]);
    sets.push(new Set(links.filter((l) => l.state === STATE.ACTIVE).map((l) => l.toId)));
  }

  if (!sets.length) return null;
  // تقاطع: مرشّحان معًا يعنيان «الاثنان» لا «أحدهما».
  return sets.reduce((a, b) => new Set([...a].filter((id) => b.has(id))));
}

/** هل تجتاز الذكرى المرشّحات التي تُقرأ من حقولها مباشرةً؟ */
function passesDirect(scene, filters) {
  if (filters[AXIS.TYPE] && (scene.type || 'other') !== filters[AXIS.TYPE]) return false;
  if (filters[AXIS.PLACE] && placeKey(scene.placeName) !== filters[AXIS.PLACE]) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * نهر الزمن
 * ------------------------------------------------------------------ */

/**
 * صفحةٌ من النهر — **مجمَّعةٌ باليوم**، من الأحدث للأقدم.
 *
 * ⚠️ اليوم هو الوحدة لا الذكرى: موقفان في يومٍ واحد جزءٌ من يومٍ واحد
 *    عشتَه، وفصلُهما بفجوةِ «بعد 0 يوم» يكذب على القارئ. وهو أيضًا ما
 *    يجعل «شاشة اليوم» امتدادًا طبيعيًّا لا شاشةً غريبة.
 *
 * @param {{before?: string, limit?: number, filters?: object}} options
 *        `before` تاريخٌ نبدأ قبله (للتحميل التدريجي).
 * @returns {Promise<{days: object[], hasMore: boolean, filtered: boolean}>}
 */
export async function riverPage({ before = null, limit = 12, filters = {} } = {}) {
  const allowed = await allowedSceneIds(filters);
  const active = Object.values(AXIS).some((axis) => filters[axis]);

  const keep = (scene) =>
    scene.state === STATE.ACTIVE &&
    passesDirect(scene, filters) &&
    (!allowed || allowed.has(scene.id));

  /*
   * نجمع حتى يكتمل `limit + 1` يومًا: الزائد لنعرف أن هناك مزيدًا،
   * **ولنحسب فجوة اليوم الأخير** — والفجوة لا تُعرَف إلا بمعرفة ما
   * قبلها.
   *
   * ⚠️ حلقةٌ لا سقفٌ مقدَّر. «اقرأ ستّين ذكرى، فاثنتا عشرة يومًا
   *    ستكتمل غالبًا» تقديرٌ يصحّ حتى يومٍ فيه ذكرياتٌ كثيرة، فتعود
   *    الصفحة ناقصةً بلا أن تقول. وهو نفس السقف الصامت الذي أُزيل من
   *    «حياتي».
   */
  const dayOf = (scene) => toISODate(scene.date) || scene.date || '';

  const byDay = new Map();
  let cursorDate = before;
  let cursorOpen = true;      // هل نستثني `cursorDate` نفسه؟
  let chunkSize = 60;
  let exhausted = false;

  while (byDay.size <= limit && !exhausted) {
    const chunk = await scenes.page({
      index: 'date',
      direction: 'prev',
      limit: chunkSize,
      range: cursorDate ? IDBKeyRange.upperBound(cursorDate, cursorOpen) : null,
      filter: keep,
    });

    /*
     * ⚠️ `page` تقيس حدّها على ما **بعد** الترشيح. فدفعةٌ ممتلئة قد
     *    تكون انقطعت في منتصف يوم، ويومٌ نصفه مقروء يُحسَب كاملًا ثم
     *    نتجاوزه — فتختفي ذكرياتٌ من النهر بلا أن يقول أحد.
     *
     *    فاليوم الأخير في دفعةٍ ممتلئة **يُؤجَّل**، ويُعاد قراءته من
     *    أوّله في الدورة التالية (حدٌّ شامل). ودفعةٌ ناقصة تعني أن
     *    المؤشّر نفد، فكل ما فيها كامل.
     */
    const complete = chunk.length < chunkSize;
    const lastDay = chunk.length ? dayOf(chunk.at(-1)) : null;
    let committed = 0;

    for (const scene of chunk) {
      const key = dayOf(scene);
      if (!complete && key === lastDay) continue;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(scene);
      committed++;
    }

    if (complete) {
      exhausted = true;
    } else if (committed === 0) {
      // يومٌ واحد أكبر من الدفعة كلها — نوسّعها بدل أن ندور بلا نهاية.
      chunkSize *= 4;
    } else {
      cursorDate = lastDay;
      cursorOpen = false;     // شامل: نعيد قراءة اليوم المؤجَّل كاملًا
    }
  }

  const allDays = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const hasMore = allDays.length > limit;
  const shown = allDays.slice(0, limit);

  const facets = await facetsFor(shown.flatMap(([, list]) => list));

  const days = shown.map(([date, list], index) => {
    // الفجوة إلى اليوم **الأقدم** التالي — ولو كان خارج الصفحة.
    const next = allDays[index + 1];
    return {
      date,
      scenes: list.map((scene) => ({ ...scene, facets: facets.get(scene.id) })),
      gapDays: next ? daysBetween(date, next[0]) : null,
    };
  });

  return { days, hasMore, filtered: active, cursor: shown.at(-1)?.[0] || null };
}

/* ------------------------------------------------------------------ *
 * اليوم
 * ------------------------------------------------------------------ */

/**
 * كل ما جرى في يومٍ واحد.
 *
 * ⚠️ **يقرأ ولا يخمّن.** يومٌ بلا ذكريات يعود فارغًا صراحةً، ولا
 *    يُملأ بأقرب يومٍ له — «مفيش حاجة في اليوم ده» جوابٌ صحيح.
 *
 * @param {string} date تاريخ ISO
 */
export async function dayDetail(date) {
  const key = toISODate(date);
  if (!key) return null;

  const rows = (await scenes.byIndex('date', key)).filter((s) => s.state === STATE.ACTIVE);
  const facets = await facetsFor(rows);
  const ids = rows.map((s) => s.id);

  const [partGroups, occurrenceGroups, mistakeGroups, scriptGroups] = await Promise.all([
    Promise.all(ids.map((id) => conversationParts.byIndex('sceneId', id))),
    Promise.all(ids.map((id) => expressionOccurrences.byIndex('sceneId', id))),
    Promise.all(ids.map((id) => mistakeComparisons.byIndex('sceneId', id))),
    Promise.all(ids.map((id) => scripts.byIndex('sceneId', id))),
  ]);

  const alive = (list) => list.filter((row) => row.state === STATE.ACTIVE);

  const personIds = [...new Set(rows.flatMap((s) => facets.get(s.id).personIds))];
  const threadIds = [...new Set(rows.flatMap((s) => facets.get(s.id).threadIds))];

  const expressionIds = [...new Set(
    occurrenceGroups.flat().filter((o) => o.state === STATE.ACTIVE).map((o) => o.expressionId)
  )];

  const [peopleRows, expressionRows] = await Promise.all([
    people.getMany(personIds),
    expressions.getMany(expressionIds),
  ]);

  /*
   * جلسات الظلّ في هذا اليوم — ممارسةٌ حدثت، لا إتقانٌ حصل.
   * ⚠️ تُقاس بيومها لا بذكراها: قد تتدرّب اليوم على سكريبتٍ من الشهر
   *    الماضي، وهي حينئذٍ من يومك هذا لا من ذلك.
   */
  const practice = (await shadowSessions.getAll())
    .filter((s) => s.state === STATE.ACTIVE && toISODate(s.createdAt) === key);

  return {
    date: key,
    scenes: rows
      .map((scene) => ({ ...scene, facets: facets.get(scene.id) }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    people: peopleRows.filter((p) => p && p.state !== STATE.TRASHED),
    threadIds,
    expressions: expressionRows.filter((e) => e && e.state === STATE.ACTIVE),
    conversationParts: alive(partGroups.flat()).length,
    mistakes: alive(mistakeGroups.flat()).length,
    scripts: alive(scriptGroups.flat()).length,
    practice: practice.length,
  };
}

/**
 * اليوم السابق واللاحق **اللذان فيهما ذكريات** — لا اليوم التقويمي.
 *
 * ⚠️ التنقّل بيومٍ تقويميّ في حياةٍ فيها فجوةُ شهرٍ يعني ثلاثين ضغطة
 *    على شاشاتٍ فارغة. فالسهم يقفز إلى ما فيه شيء.
 */
export async function adjacentDays(date) {
  const key = toISODate(date);
  const [olderRows, newerRows] = await Promise.all([
    scenes.page({
      index: 'date', direction: 'prev', limit: 1,
      range: IDBKeyRange.upperBound(key, true),
      filter: (s) => s.state === STATE.ACTIVE,
    }),
    scenes.page({
      index: 'date', direction: 'next', limit: 1,
      range: IDBKeyRange.lowerBound(key, true),
      filter: (s) => s.state === STATE.ACTIVE,
    }),
  ]);

  return {
    older: olderRows[0] ? toISODate(olderRows[0].date) : null,
    newer: newerRows[0] ? toISODate(newerRows[0].date) : null,
  };
}

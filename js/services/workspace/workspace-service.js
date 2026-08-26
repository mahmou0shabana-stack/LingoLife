/**
 * LingoLife — نموذجُ ورشة المحتوى الموحَّدة (WS-F)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **طبقةُ تفاعلٍ فوق نفس البيانات — لا مصدرَ حقيقةٍ ثانٍ** (بند ٧٩)
 * ═══════════════════════════════════════════════════════════════
 *
 * لا مخزنَ جديد، ولا شجرةَ ثانية، ولا نموذجَ وسائطَ موازيًا. كلُّ ما
 * هنا يقرأ `scripts` و`relationships` و`media` نفسَها التي يقرؤها
 * وضعُ التنظيم والصفحةُ القديمة، ويكتب بـ`link`/`unlink` نفسِهما.
 *
 * فلو ربطتَ صوتًا هنا رأيتَه هناك، ولو أعدتَ التسميةَ هنا تغيّر الاسمُ
 * في كلّ مكان. والوعدُ هذا ليس تعليقًا: `workspace-service` **لا
 * تستورد المستودعاتِ لتكتب فيها بيدها** إلّا حيث لا بديل، وحارسٌ
 * نصّيٌّ يمنعها أن تنشئ مخزنًا خاصًّا بها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الثغرةُ التي وجدتُها في `organizeBoard` — وسببُ وجود هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * `organizeBoard` تنزل بعمقٍ **تحت عقدة الرحلة وحدَها**:
 *
 *     treeByScript.set(id, journey ? await subtreeOf(journey.id) : []);
 *
 * و`partsOf` تُرجِع الأبناءَ **المباشرين** بلا تعمّق. فسكريبتٌ بنيتُه
 * «سكريبت ← جزء ← جولة» كانت جولتُه **لا تظهر هدفَ ربطٍ أصلًا** —
 * لا لأن النموذجَ يعجز، بل لأن القراءةَ لا تنزل إليها.
 *
 * وبند ٤ يطلب العمقَ الحرّ لأيّ عقدةٍ بلا اشتراط «رحلة» فوقها. فهذه
 * القراءةُ تنزل من **كلّ جذرٍ** بـ`subtreeOf` العامّة — وعقدةُ الرحلة
 * تصير ابنًا عاديًّا فيها، لا بابًا شرطيًّا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وثلاثةُ استعلاماتٍ لا مئتان (بند ٩١ و١٢٢)
 * ═══════════════════════════════════════════════════════════════
 *
 * `subtreeOf` تسأل القاعدةَ مرّتين **لكلّ عقدة**. على مئة عقدةٍ ذلك
 * مئتا رحلة. وفهرسُ `kind` على `relationships` قائمٌ منذ v8، فتُقرَأ
 * الروابطُ كلُّها **مرّةً واحدة** وتُبنى الشجرةُ في الذاكرة.
 *
 * والثمنُ المعلوم: نقرأ روابطَ العضويّة في التطبيق كلِّه لا في هذه
 * الذكرى وحدَها. والسجلُّ الواحد بضعةُ حقولٍ صغيرة، فألفٌ منها أرخصُ
 * بكثيرٍ من مئتي رحلةٍ إلى القاعدة — وهذا قياسٌ لا تخمين (راجع تقرير
 * الأداء في `docs/11-workspace.md`).
 */

import { scripts, media, relationships } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { getSceneFull } from '../scene-service.js';
import { addScript, updateScript } from '../content-service.js';
import { LINK, link, unlink } from '../link-service.js';
import {
  PART_OF, addNode, moveNodeTo, NODE_KIND, NODE_KIND_LABEL,
} from '../organize-service.js';

export { NODE_KIND, NODE_KIND_LABEL, PART_OF };

/** أنواعُ المحتوى الثلاثة التي يراها المستعمِل — ولا رابعَ (بند ٢). */
export const ITEM = Object.freeze({ TEXT: 'text', AUDIO: 'audio', IMAGE: 'image' });

/** ⚠️ نفسُ حارس WS56: عمقٌ أقصى يمنع دورةً في البيانات أن تُعلّق الرسم. */
const MAX_DEPTH = 12;

const linkKindFor = (kind) => (kind === 'audio' ? LINK.AUDIO_SCRIPT : LINK.IMAGE_SCRIPT);

/* ================================================================== *
 * القراءة — لوحةُ الورشة
 * ================================================================== */

/**
 * لوحةُ الورشة كاملةً لذكرى.
 *
 * @param {string} sceneId
 * @returns {Promise<{scene, roots, treeByRoot, targets, targetById,
 *                    audio, images, looseTexts, unlinked, linkedTo, counts}|null>}
 */
export async function workspaceBoard(sceneId) {
  const [full, memberRows, audioRows, imageRows] = await Promise.all([
    getSceneFull(sceneId),
    relationships.byIndex('kind', PART_OF),
    relationships.byIndex('kind', LINK.AUDIO_SCRIPT),
    relationships.byIndex('kind', LINK.IMAGE_SCRIPT),
  ]);
  if (!full) return null;

  const active = (rows) => rows.filter((row) => row.state === STATE.ACTIVE);

  /* خريطةُ الأبناء — مبنيّةٌ مرّةً من قراءةٍ واحدة. */
  const childrenOf = new Map();
  const parentOf = new Map();
  for (const row of active(memberRows)) {
    if (!childrenOf.has(row.fromId)) childrenOf.set(row.fromId, []);
    childrenOf.get(row.fromId).push(row);
    parentOf.set(row.toId, row.fromId);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  /*
   * الجذور: سكريبتاتُ الذكرى كلُّها — **وليست واحدةً** (بند ٥).
   * ⚠️ ويُستبعَد ما له أبٌ: نصٌّ جانبيٌّ نُقل داخل الشجرة لا يبقى جذرًا.
   */
  const roots = full.scripts
    .filter((row) => !parentOf.has(row.id))
    .sort((a, b) => (b.isPrimary || 0) - (a.isPrimary || 0)
      || (a.createdAt || 0) - (b.createdAt || 0));

  /* كلُّ المعرّفات المحتملة تحت الجذور — بلا سؤالِ القاعدة. */
  const wanted = new Set();
  const collect = (id, depth, seen) => {
    if (depth > MAX_DEPTH || seen.has(id)) return;
    seen.add(id);
    for (const row of childrenOf.get(id) || []) {
      wanted.add(row.toId);
      collect(row.toId, depth + 1, seen);
    }
  };
  for (const root of roots) collect(root.id, 0, new Set());

  const nodeRows = wanted.size ? await scripts.getMany([...wanted]) : [];
  const nodeById = new Map(
    nodeRows.filter((row) => row && row.state === STATE.ACTIVE).map((row) => [row.id, row])
  );

  /* ================================================================ *
   * الشجرة — عميقةٌ من الجذر مباشرةً، بلا اشتراط «رحلة»
   * ================================================================ */
  const targets = [];
  const buildTree = (parentId, path, depth, seen) => {
    if (depth > MAX_DEPTH || seen.has(parentId)) return [];
    const here = new Set(seen).add(parentId);

    const out = [];
    for (const row of childrenOf.get(parentId) || []) {
      const node = nodeById.get(row.toId);
      if (!node) continue;                       /* محذوفٌ أو خارج الذكرى */
      const myPath = [...path, node.title];
      const children = buildTree(node.id, myPath, depth + 1, here);
      out.push({ node, link: row, depth, path: myPath, children });
    }
    return out;
  };

  const treeByRoot = new Map();
  for (const root of roots) treeByRoot.set(root.id, buildTree(root.id, [root.title], 0, new Set()));

  const pushTarget = (node, path, depth, rootId) => {
    targets.push({
      id: node.id,
      title: node.title,
      kind: node.nodeKind || NODE_KIND.CUSTOM,
      depth,
      rootId,
      hidden: node.hidden === 1,
      hasText: Boolean((node.text || '').trim()),
      path,
    });
  };
  for (const root of roots) {
    pushTarget(root, [root.title], 0, root.id);
    const walk = (rows) => {
      for (const row of rows) {
        pushTarget(row.node, row.path, row.depth + 1, root.id);
        walk(row.children);
      }
    };
    walk(treeByRoot.get(root.id) || []);
  }
  const targetById = new Map(targets.map((row) => [row.id, row]));

  /* ================================================================ *
   * الوسائط — وأين ترتبط **داخل هذه الذكرى**
   * ================================================================ */
  const images = full.media.filter((row) => row.kind === 'image');
  const audio = full.media.filter((row) => row.kind === 'audio');
  const mediaIds = new Set([...images, ...audio].map((row) => row.id));

  /*
   * ⚠️ **ولا يُعرَض رابطٌ في ذكرى أخرى.** الملفُّ الواحد قد يخدم
   *    ذكرياتٍ عدّة (WS56)، وعرضُ ارتباطه هناك هنا يربك أكثرَ ممّا
   *    يفيد — ولا يُمَسّ عند إعادة الربط (بند ١٠٦).
   */
  /*
   * ⚠️ **وجهاتٌ لا وجهة** (WS-F2، بنود ٣٩…٤٢). كان الحقلُ واحدًا
   *    فكانت الشاشةُ تدّعي أن الملفَّ لا يسكن إلّا مكانًا واحدًا —
   *    والبنيةُ تسمح بالاثنين. مخطّطٌ واحدٌ قد يخدم المرحلةَ والجزءَ
   *    الثالثَ والثامن، ولا تُنسَخ بايتاتُه مرّةً واحدة.
   */
  const linkedTo = new Map();
  for (const row of active([...audioRows, ...imageRows])) {
    const mediaId = mediaIds.has(row.fromId) ? row.fromId
      : (mediaIds.has(row.toId) ? row.toId : null);
    if (!mediaId) continue;
    const targetId = mediaId === row.fromId ? row.toId : row.fromId;
    if (!targetById.has(targetId)) continue;
    if (!linkedTo.has(mediaId)) linkedTo.set(mediaId, []);
    if (!linkedTo.get(mediaId).includes(targetId)) linkedTo.get(mediaId).push(targetId);
  }

  /*
   * ⚠️ **عدّادان مسمّيان لا عددٌ ملتبس** (بند ٥٤): `own` ما عُلِّق على
   *    العقدة نفسِها، و`sub` ما تحتها. وخلطُهما في رقمٍ واحدٍ يجعل
   *    «🎙 ٩» على مرحلةٍ لا يُعرَف أهي تسعةٌ لها أم لأبنائها.
   */
  const own = new Map();
  for (const id of targetById.keys()) own.set(id, { audio: [], images: [] });
  for (const row of audio) {
    for (const at of linkedTo.get(row.id) || []) own.get(at)?.audio.push(row);
  }
  for (const row of images) {
    for (const at of linkedTo.get(row.id) || []) own.get(at)?.images.push(row);
  }

  const subTotals = new Map();
  const totalsFor = (id) => {
    if (subTotals.has(id)) return subTotals.get(id);
    const kids = (childrenOf.get(id) || []).filter((row) => nodeById.has(row.toId));
    let a = 0; let i = 0;
    for (const row of kids) {
      const mine = own.get(row.toId) || { audio: [], images: [] };
      const deep = totalsFor(row.toId);
      a += mine.audio.length + deep.audio;
      i += mine.images.length + deep.images;
    }
    const out = { audio: a, images: i };
    subTotals.set(id, out);
    return out;
  };
  for (const row of targets) {
    row.own = {
      audio: (own.get(row.id) || { audio: [] }).audio.length,
      images: (own.get(row.id) || { images: [] }).images.length,
    };
    row.sub = totalsFor(row.id);
    row.children = (childrenOf.get(row.id) || []).filter((one) => nodeById.has(one.toId)).length;
  }

  /*
   * ⚠️ **النصوصُ السائبة** (بند ١٩): سكريبتُ ذكرًى لا أبناءَ له —
   *    «ملاحظةٌ لصقتَها ولم تقرّر مكانها بعد». وهي جذرٌ **و** بطاقةٌ
   *    في المكتب معًا، لأنها الاثنان فعلًا.
   *
   * ⚠️ **والسكريبتُ الأساسيُّ ليس منها** — وهذا خطأٌ أمسكته التجربة:
   *    كانت الشاشةُ تعدّ سكريبتَ الذكرى الأساسيَّ «غير مربوط»، فيقول
   *    الفلترُ «٥ لسّه ما رتّبتهمش» وفيهم النصُّ الأصليُّ للذكرى.
   *    و«غير مربوط» معناها **الكومةُ المنتظِرة** (بند ٢١)، والنصُّ
   *    الأساسيُّ ليس منتظِرًا شيئًا: هو المكان نفسُه.
   */
  const looseTexts = roots.filter((row) => row.isPrimary !== 1
    && !(childrenOf.get(row.id) || []).some((one) => nodeById.has(one.toId)));

  const unlinked = {
    audio: audio.filter((row) => !linkedTo.has(row.id)),
    images: images.filter((row) => !linkedTo.has(row.id)),
    texts: looseTexts,
  };

  return {
    scene: full.scene,
    roots,
    treeByRoot,
    targets,
    targetById,
    audio,
    images,
    looseTexts,
    unlinked,
    linkedTo,
    counts: {
      roots: roots.length,
      nodes: targets.length - roots.length,
      audio: audio.length,
      images: images.length,
      unlinked: unlinked.audio.length + unlinked.images.length + unlinked.texts.length,
    },
  };
}

/** مسارٌ مقروءٌ لهدف — «PHASE 2 · VERSION 1 · PART 3» (بند ١٠). */
export function pathLabel(target) {
  return (target?.path || []).join(' · ');
}

/** وجهاتُ عنصرٍ داخل هذه الذكرى — قائمةٌ دائمًا، فارغةٌ إن لم يُربَط. */
export function destinationsOf(board, mediaId) {
  return board?.linkedTo.get(mediaId) || [];
}

/* ================================================================== *
 * الكتابة — كلُّها عبر الخدمات القائمة
 * ================================================================== */

/**
 * يربط عناصرَ مختارةً بعقدةٍ واحدة — أو يفكّها.
 *
 * ⚠️ **ولا نسخةَ ثانيةً من منطق النقل** (بند ٤٥ و١٠٥ و١٠٦): يُنادى
 *    `linkItemsTo` من WS56 حرفيًّا، فضمانُ «لا يُمَسّ رابطٌ في ذكرى
 *    أخرى» يبقى ضمانًا واحدًا في مكانٍ واحد. ولو أعدتُ كتابتَه هنا
 *    لَافترق السلوكان بعد أوّلِ إصلاح.
 */
export async function linkSelection(mediaIds, targetId, board, { mode = 'attach' } = {}) {
  const { linkItemsTo } = await import('../organize-service.js');
  return linkItemsTo(mediaIds, targetId, {
    scopeIds: [...board.targetById.keys()],
    /* ⚠️ الورشةُ تُضيف ولا تهدم (بند ٤٠) — والفكُّ فعلٌ صريحٌ وحدَه. */
    mode,
  });
}

/**
 * ينشئ سكريبتًا رئيسيًّا جديدًا في الذكرى (بند ٦٤).
 *
 * ⚠️ وهو سكريبتٌ حقيقيٌّ بـ`sceneId` — أي **تراه الصفحةُ القديمة**،
 *    وهذا هو المقصود: «سكريبت رئيسيّ» ليس عقدةً داخليّة.
 */
export async function createMainScript(sceneId, { title, text = '' } = {}) {
  return addScript(sceneId, { title: (title || 'سكريبت جديد').trim(), text, type: 'alt' });
}

/**
 * ينشئ نصًّا جانبيًّا سائبًا — يظهر في «غير مربوط» بلا مكانٍ بعد.
 *
 * ⚠️ **والسائبُ سكريبتُ ذكرًى لا عقدةٌ يتيمة.** لو أنشأناه بـ
 *    `sceneId: null` وبلا أبٍ لَما وصل إليه أحدٌ أبدًا: لا الصفحةُ
 *    القديمة تفهرسه (لأن `null` لا يُفهرَس)، ولا الورشةُ تجده (لأنها
 *    تنزل من الجذور). أي ملفٌّ يُكتَب ثم يُفقَد.
 */
export async function addLooseText(sceneId, { title, text = '' } = {}) {
  return addScript(sceneId, { title: (title || 'نصّ جديد').trim(), text, type: 'alt' });
}

/**
 * يضع نصًّا سائبًا داخل الشجرة تحت عقدة.
 *
 * ⚠️ **ويُنزَع `sceneId` عند الدخول** — وهذا هو بند ١١٣ بعينه: عقدةٌ
 *    داخل شجرةٍ يجب ألّا تظهر سكريبتًا مستقلًّا في الصفحة القديمة.
 *    وIndexedDB لا تفهرس `null`، فالإخفاءُ **بحكم البناء** لا بتصفيةٍ
 *    نضيفها ونسهو عنها لاحقًا (راجع رأس `organize-service`).
 */
export async function placeTextUnder(nodeId, parentId) {
  await moveNodeTo(nodeId, parentId);
  await scripts.update(nodeId, { sceneId: null, isPrimary: 0 });
  return true;
}

/**
 * يُخرج عقدةً من الشجرة فتعود نصًّا سائبًا في الذكرى.
 *
 * ⚠️ وهو عكسُ `placeTextUnder` تمامًا: يُفَكّ رابطُ العضويّة **ويُعاد**
 *    `sceneId`، وإلّا صارت العقدةُ لا في شجرةٍ ولا في ذكرى — أي ضائعة.
 */
export async function detachToLoose(nodeId, sceneId) {
  const rows = (await relationships.byIndex('to_kind', [nodeId, PART_OF]))
    .filter((row) => row.state === STATE.ACTIVE);
  for (const row of rows) await relationships.destroy(row.id);
  await scripts.update(nodeId, { sceneId });
  return true;
}

/**
 * ينشئ نصًّا داخل عقدةٍ أو بجانبها (بندا ٢٤ و٢٥).
 *
 * @param {'inside'|'after'} where
 */
export async function addTextAt(targetId, where, { title, text = '', nodeKind } = {}) {
  if (where === 'inside') {
    return addNode(targetId, {
      title, text, nodeKind: nodeKind || NODE_KIND.CUSTOM, semanticType: 'custom',
    });
  }

  /*
   * «بعد ده» = ابنٌ لأبِ الهدف، مُدرَجٌ في الموضع التالي مباشرةً.
   * ⚠️ وهدفٌ بلا أبٍ (جذر) لا يقبل شقيقًا في الشجرة — فالشقيقُ هنا
   *    سكريبتٌ رئيسيٌّ آخر، وهو الجوابُ الصادق لا رسالةُ خطأ.
   */
  const parentRow = (await relationships.byIndex('to_kind', [targetId, PART_OF]))
    .find((row) => row.state === STATE.ACTIVE);
  if (!parentRow) return null;

  const siblings = (await relationships.byIndex('from_kind', [parentRow.fromId, PART_OF]))
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const at = siblings.findIndex((row) => row.toId === targetId);

  return addNode(parentRow.fromId, {
    title, text, nodeKind: nodeKind || NODE_KIND.CUSTOM, semanticType: 'custom',
    at: at >= 0 ? at + 2 : null,
  });
}

/** يكتب نصَّ عقدة — **عبر `updateScript`** فتُحفَظ نسخةٌ في التاريخ (بند ٦٠). */
export async function saveNodeText(nodeId, { title, text }) {
  return updateScript(nodeId, { title, text });
}

/* ================================================================== *
 * اللصقُ المنظَّم — الخطّةُ ثمّ الالتزام
 * ================================================================== */

/**
 * يفحص تعارضَ العناوين مع الأبناء القائمين (بند ٦٧).
 *
 * ⚠️ **ولا يُدمَج بالاسم أبدًا.** «PART 1» تحت أبٍ فيه «PART 1» ليست
 *    هي هي: الاسمُ وصفٌ لا هُويّة. فيُبلَّغ التعارضُ ويُترَك القرارُ
 *    لك — «أضِف» أو «تخطَّ» أو «أعِد التسمية».
 */
export async function conflictsFor(parentId, proposal) {
  const rows = (await relationships.byIndex('from_kind', [parentId, PART_OF]))
    .filter((row) => row.state === STATE.ACTIVE);
  if (!rows.length) return [];

  const existing = (await scripts.getMany(rows.map((row) => row.toId)))
    .filter((row) => row && row.state === STATE.ACTIVE);
  const byTitle = new Map(existing.map((row) => [row.title.trim(), row]));

  return proposal.nodes
    .filter((node) => !node.parentId && byTitle.has(node.title.trim()))
    .map((node) => ({
      id: node.id,
      title: node.title,
      existingId: byTitle.get(node.title.trim()).id,
    }));
}

/**
 * يلتزم بشجرةٍ مقترَحة تحت عقدة.
 *
 * ⚠️ **ولا تُنشَأ عقدةٌ واحدةٌ قبل موافقتك** (بند ٣١): هذه الدالّةُ لا
 *    تُنادى إلّا من زرّ «وافق» في المراجعة. والمحلّلُ نفسُه لا يستورد
 *    مستودعًا واحدًا — فلا يستطيع الكتابةَ ولو أردتُ.
 *
 * ⚠️ **وما يخرج منها عُقَدٌ عاديّةٌ تمامًا** (بند ٣٥): تُسمّى وتُرتَّب
 *    وتُنقَل وتُخفى ويُربَط بها صوتٌ وصورةٌ ويُفتَح عليها الظلّ. ولا
 *    علامةَ «مستورَدة» تعاملها معاملةً خاصّة.
 *
 * @param {string} parentId
 * @param {object} proposal ناتجُ `parsePaste` بعد تعديلات المراجعة
 * @param {{ excluded?: Set<string>|string[] }} options
 * @returns {Promise<{created: number, byId: Map<string,string>}>}
 */
export async function commitPaste(parentId, proposal, { excluded = [] } = {}) {
  const skip = new Set(excluded);
  const byId = new Map();
  let created = 0;

  /*
   * ⚠️ **بالترتيب الأصليّ لا بالتوازي.** `addNode` تقرأ الأشقّاءَ لتحسب
   *    الترتيب، ونداءان متوازيان يقرآن نفسَ العدد فيتساوى ترتيبُهما —
   *    ثم يصير ترتيبُ المتساويَين رهنَ القاعدة، أي عشوائيًّا بين جلستين.
   */
  for (const node of proposal.nodes) {
    if (skip.has(node.id)) continue;
    /* أبٌ مُستبعَدٌ يُصعِد أبناءَه إلى أقربِ جدٍّ باقٍ — لا يُسقطهم. */
    let parent = node.parentId;
    while (parent && skip.has(parent)) {
      parent = proposal.nodes.find((row) => row.id === parent)?.parentId || null;
    }
    const under = parent ? byId.get(parent) : parentId;
    if (!under) continue;

    const made = await addNode(under, {
      title: node.title,
      text: node.text || '',
      nodeKind: node.kind || NODE_KIND.CUSTOM,
      semanticType: node.kind || 'custom',
    });
    byId.set(node.id, made.id);
    created += 1;
  }

  return { created, byId };
}

/** يربط وسيطًا واحدًا بهدفٍ — «اربط الصوت الحالي هنا» (بندا ١٦ و٤٧). */
export async function linkOneTo(mediaId, targetId, board) {
  return linkSelection([mediaId], targetId, board);
}

/** يفكّ ربطَ وسيطٍ داخل هذه الذكرى وحدَها. */
export async function unlinkOne(mediaId, board, targetId = null) {
  const item = await media.get(mediaId);
  if (!item) return false;
  const kind = linkKindFor(item.kind);
  const at = destinationsOf(board, mediaId);
  /*
   * ⚠️ **ويُفَكّ ما سمّيتَه وحدَه** (بند ٤٠): فكُّ «أ · جزء ١» لا يمسّ
   *    «ب · جزء ٤». وبلا الوجهة المحدَّدة يُفَكّ الأوّلُ فقط — لا الكلّ،
   *    لأن «فكّ الربط» فعلٌ مفردٌ لا كنس.
   */
  const which = targetId && at.includes(targetId) ? targetId : at[0];
  if (!which) return false;
  await unlink(mediaId, which, kind);
  return true;
}

/** ⚠️ يُستعمَل في الاختبار وحدَه — يثبت أن الربطَ يمرّ بـ`link` القائمة. */
export const __linkPrimitives = { link, unlink, linkKindFor };

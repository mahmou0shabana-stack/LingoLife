/**
 * LingoLife — نموذجُ القراءة والربط لوضع التنظيم (WS56 · تجريبيّ)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لا قاعدةَ بيانات ثانية، ولا نوعَ ربطٍ جديد.**
 * ═══════════════════════════════════════════════════════════════
 *
 * هذه الوحدة **لا تملك بيانات**. تقرأ من `scene-service` و
 * `media-service` و`link-service` نفسِها التي تقرأ منها الصفحةُ
 * الحاليّة، وتكتب بـ`link()`/`unlink()` نفسِهما.
 *
 * والفرقُ بين الوضعين **فرقُ عرضٍ لا فرقُ حقيقة**: لو ربطتَ صورةً
 * بسكريبتٍ هنا، رأيتَه في نافذة الربط القديمة، والعكس. ولو كان لكلٍّ
 * تخزينُه لافترقا بعد أسبوعٍ وما عرفتَ أيَّهما الصحيح.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا «الجزء» سكريبتٌ بلا `sceneId` لا نوعٌ جديد؟
 * ═══════════════════════════════════════════════════════════════
 *
 * الطلبُ يقول: «لا تبنِ نظامَ أشجارٍ كبيرًا»، ويقول أيضًا إن الصفحة
 * الحاليّة **يجب ألّا تتغيّر**. والحلّان الواضحان يكسران أحدَهما:
 *
 *   · store جديد `scriptParts` → ترقيةُ schema، ونظامٌ ثانٍ للنصوص
 *     بلا نُسَخٍ ولا شادوينج ولا تحرير — أي إعادةُ بناء `scripts`.
 *   · سكريبتٌ بـ`sceneId` وحقل `parentId` → الصفحةُ القديمة تقرأ
 *     `scripts.byIndex('sceneId')` **بلا تصفية**، فتظهر الأجزاءُ فيها
 *     سكريبتاتٍ مستقلّة. وهذا تغييرٌ في الوضع القديم بالضبط.
 *
 * فالجزءُ **سجلُّ `scripts` كاملُ الحقوق** — نُسَخٌ وتحريرٌ وشادوينج —
 * لكن `sceneId` فيه `null`. وIndexedDB **لا تفهرس `null`**، فالصفحةُ
 * القديمة لا تراه أصلًا: لا بتصفيةٍ أضفناها، بل **بحكم البناء**.
 * وانتماؤه لأبيه علاقةٌ في `relationships` بصيغة العضويّة القائمة
 * (`script:script`) — وهي الصيغةُ التي كُتبت في `link-service` لهذا
 * الغرض بالذات.
 *
 * ونكسبُ مجّانًا: الصوتُ والصورةُ يرتبطان بالجزء **بنفس نوعَي الربط**
 * (`audio:script` و`image:script`) لأن الجزءَ سكريبت. لا نوعَ ثالث.
 */

import { scripts, media, relationships } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { getSceneFull } from './scene-service.js';
import { addScript, updateScript } from './content-service.js';
import {
  LINK, link, unlink, linksOf, membershipKind,
} from './link-service.js';
import {
  NODE_KIND, NODE_KIND_LABEL, TEMPLATE_KEY, templateById,
} from './hyperlingual.js';

export { NODE_KIND, NODE_KIND_LABEL };

/**
 * انتماءُ العقدة إلى أبيها — بصيغة العضويّة القائمة.
 *
 * ⚠️ **ونوعٌ واحدٌ لكلّ المستويات** (WS57). الجزءُ والمرحلةُ والجولةُ
 *    ونصُّ التدريب كلُّها `script:script`، ويميّزها `nodeKind` على
 *    السجلّ. ولو صنعنا `script:phase` و`phase:part` و`part:round`
 *    لصار نقلُ عقدةٍ من مستوًى إلى آخر **تغييرَ نوعِ رابط** — أي
 *    حذفًا وإنشاءً بدل تحديثِ أب. والطلبُ يريد النقلَ سهلًا (بند ٨).
 */
export const PART_OF = membershipKind('script', 'script');

/** نوعُ الربط المناسب لكلّ وسيط — الصوتُ والصورةُ لا يتشاركان نوعًا. */
const linkKindFor = (kind) => (kind === 'audio' ? LINK.AUDIO_SCRIPT : LINK.IMAGE_SCRIPT);

/* ================================================================== *
 * القراءة
 * ================================================================== */

/**
 * أبناءُ عقدةٍ مرتَّبين — **بالرابط لا بالسجلّ**.
 *
 * ⚠️ والترتيبُ صفةُ العضويّة لا صفةُ العقدة: عقدةٌ تُنقَل إلى أبٍ آخر
 *    تأخذ ترتيبَها هناك ولا تحمل معها ترتيبَها القديم.
 *
 * @returns {Promise<{node: object, link: object}[]>}
 */
export async function childRowsOf(scriptId) {
  const rows = (await relationships.byIndex('from_kind', [scriptId, PART_OF]))
    .filter((row) => row.state === STATE.ACTIVE);
  if (!rows.length) return [];

  const nodes = (await scripts.getMany(rows.map((row) => row.toId)))
    .filter((row) => row && row.state === STATE.ACTIVE);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return rows
    .filter((row) => byId.has(row.toId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((row) => ({ node: byId.get(row.toId), link: row }));
}

/**
 * أجزاءُ سكريبتٍ عاديّ — **بلا جذر الرحلة**.
 *
 * ⚠️ **والاستثناءُ هو بيتُ القصيد**: عقدةُ الرحلة ابنٌ من أبناء
 *    السكريبت في القاعدة، لكنّها ليست «جزءًا» في المعنى الذي يفهمه
 *    المستعمِل. ولولا هذا السطر لظهرت «رحلة التدريب» بندًا في قائمة
 *    أجزاء السكريبت العاديّ — وهو خلطٌ بين شيئين قال الطلبُ صراحةً
 *    ألّا يُخلَطا (بند ١٩).
 */
export async function partsOf(scriptId) {
  return (await childRowsOf(scriptId))
    .filter(({ node }) => node.nodeKind !== NODE_KIND.JOURNEY)
    .map(({ node }) => node);
}

/** جذرُ رحلة التدريب تحت سكريبتٍ — أو `null` إن كان سكريبتًا عاديًّا. */
export async function journeyOf(scriptId) {
  const rows = await childRowsOf(scriptId);
  return rows.find(({ node }) => node.nodeKind === NODE_KIND.JOURNEY)?.node || null;
}

/**
 * الشجرةُ كاملةً تحت عقدة — بعمقٍ غيرِ محدود.
 *
 * ⚠️ **وحارسُ العمق ليس تجميلًا.** العُقَدُ تُنقَل بين الآباء، ودورةٌ
 *    (أبٌ صار ابنَ ابنِه) تجعل هذا النداءَ لا ينتهي. المنعُ في
 *    `moveNodeTo` هو الدفاعُ الأوّل، وهذا الثاني — لأن بياناتٍ قديمةً
 *    أو مستوردةً قد تحمل ما لم يمرّ بذلك المنع.
 */
export async function subtreeOf(scriptId, { depth = 0, seen = new Set(), path = [] } = {}) {
  if (depth > 12 || seen.has(scriptId)) return [];
  seen.add(scriptId);

  const rows = await childRowsOf(scriptId);
  const out = [];
  for (const { node, link } of rows) {
    /*
     * ⚠️ **المسارُ يُبنى نازلًا لا صاعدًا.** أوّلُ صياغةٍ حاولت
     *    استنتاجَه من قائمةٍ مسطّحة بتتبّع «آخرِ عنوانٍ عند كلّ عمق»،
     *    وهي حيلةٌ تعمل حتى تتفرّع الشجرةُ فتُنسَب العقدةُ إلى عمٍّ
     *    لا إلى أبيها. والنزولُ يعرف الأبَ يقينًا لأنه واقفٌ فيه.
     */
    const here = [...path, node.title];
    const children = await subtreeOf(node.id, { depth: depth + 1, seen, path: here });
    out.push({ node, link, depth, path: here, children });
  }
  return out;
}

/** الشجرةُ مسطَّحةً — لقوائم الأهداف وعمليّاتِ الشجرة كلِّها. */
export function flattenTree(tree, out = []) {
  for (const row of tree) {
    out.push(row);
    flattenTree(row.children, out);
  }
  return out;
}

/**
 * لوحةُ التنظيم كاملةً — **قراءةٌ واحدةٌ لا قراءةٌ لكلّ بطاقة**.
 *
 * ⚠️ وتُبنى خريطةُ الروابط مرّةً من `relationships` كلِّها لهذه الذكرى،
 *    لا بسؤالٍ لكلّ وسيطٍ على حدة. ذكرى فيها ٢٢ عنصرًا كانت ستصير ٢٢
 *    رحلةً إلى القاعدة، وعلى اللوح يُحَسّ ذلك.
 */
export async function organizeBoard(sceneId) {
  const full = await getSceneFull(sceneId);
  if (!full) return null;

  const images = full.media.filter((m) => m.kind === 'image');
  const audio = full.media.filter((m) => m.kind === 'audio');
  const topScripts = full.scripts;

  /*
   * الأجزاءُ ورحلةُ التدريب لكلّ سكريبت — وكلُّها عُقَدٌ تصلح أهدافَ
   * ربطٍ بدورها، مهما عمقت (بند ٢٣).
   */
  const partsByScript = new Map();
  const journeyByScript = new Map();
  const treeByScript = new Map();
  for (const script of topScripts) {
    partsByScript.set(script.id, await partsOf(script.id));
    const journey = await journeyOf(script.id);
    journeyByScript.set(script.id, journey);
    treeByScript.set(script.id, journey ? await subtreeOf(journey.id) : []);
  }

  /*
   * كلُّ هدفِ ربطٍ ممكن — بمسارٍ قابلٍ للقراءة لا بمعرّف.
   *
   * ⚠️ **والعمقُ يُحمَل في `path` لا في التداخل.** قائمةُ الأهداف
   *    قائمةٌ مسطّحة؛ ولو كانت شجرةً متداخلةً لاحتاجت الواجهةُ أن
   *    تفكّها من جديد، ولاحتاج كلُّ مستوًى جديدٍ تعديلًا فيها.
   */
  const targets = [];
  const pushTarget = (node, kind, path, depth) => {
    targets.push({
      id: node.id,
      title: node.title,
      kind,
      depth,
      hidden: node.hidden === 1,
      /* أوّلُ عنصرٍ في المسار هو السكريبتُ الأصليّ، وآخرُه هذه العقدة. */
      path,
      parentTitle: path.length > 1 ? path[path.length - 2] : null,
    });
  };

  for (const script of topScripts) {
    pushTarget(script, 'script', [script.title], 0);
    for (const part of partsByScript.get(script.id) || []) {
      pushTarget(part, 'part', [script.title, part.title], 1);
    }
    for (const row of flattenTree(treeByScript.get(script.id) || [])) {
      pushTarget(row.node, row.node.nodeKind || 'custom',
        [script.title, ...row.path], row.depth + 1);
    }
  }
  const targetById = new Map(targets.map((t) => [t.id, t]));

  /*
   * روابطُ كلّ وسيطٍ إلى أهداف هذه الذكرى وحدَها.
   * ⚠️ والتصفيةُ بـ`targetById` مقصودة: الوسيطُ قد يكون مرتبطًا
   *    بسكريبتٍ في ذكرى أخرى (الملفُّ الواحد يعيش في أكثر من ذكرى)،
   *    وعرضُ ذلك هنا يربكُ أكثر ممّا يفيد.
   */
  const linkedTo = new Map();
  for (const item of [...images, ...audio]) {
    const rows = await linksOf(item.id, linkKindFor(item.kind));
    const hit = rows.map((row) => row.otherId).find((id) => targetById.has(id)) || null;
    if (hit) linkedTo.set(item.id, hit);
  }

  const itemsOf = (targetId) => ({
    audio: audio.filter((m) => linkedTo.get(m.id) === targetId),
    images: images.filter((m) => linkedTo.get(m.id) === targetId),
  });

  /** يُلحق وسائطَ كلّ عقدةٍ بالشجرة، ويجمع العدّادات صاعدًا. */
  const decorate = (rows) => rows.map((row) => {
    const children = decorate(row.children);
    const own = itemsOf(row.node.id);
    return {
      ...row,
      ...own,
      children,
      totals: {
        audio: own.audio.length + children.reduce((n, c) => n + c.totals.audio, 0),
        images: own.images.length + children.reduce((n, c) => n + c.totals.images, 0),
      },
    };
  });

  const scriptRows = topScripts.map((script) => {
    const own = itemsOf(script.id);
    const parts = (partsByScript.get(script.id) || []).map((part) => ({
      part, ...itemsOf(part.id),
    }));
    const journey = journeyByScript.get(script.id) || null;
    const tree = decorate(treeByScript.get(script.id) || []);
    const journeyTotals = {
      audio: tree.reduce((n, c) => n + c.totals.audio, 0),
      images: tree.reduce((n, c) => n + c.totals.images, 0),
    };

    return {
      script,
      parts,
      /* `null` لسكريبتٍ عاديّ — والواجهةُ لا ترسم أدواتِ الرحلة بدونه. */
      journey,
      tree,
      /*
       * ⚠️ **«مُعطَّلة» ليست «غير موجودة».** الرحلةُ المخفيّة تبقى في
       *    الشجرة كاملةً، ويُعلَن أنها معطَّلة — لأن إخفاءَها هو ما
       *    يجعل التعطيلَ آمنًا بديلًا عن الحذف (بند ٢٢).
       */
      journeyDisabled: Boolean(journey?.hidden === 1),
      ...own,
      /* عدّادُ السكريبت يشمل أجزاءَه ورحلتَه — «🎙٢ 🖼٤» تعني الكلّ. */
      totals: {
        audio: own.audio.length
          + parts.reduce((n, p) => n + p.audio.length, 0) + journeyTotals.audio,
        images: own.images.length
          + parts.reduce((n, p) => n + p.images.length, 0) + journeyTotals.images,
      },
    };
  });

  const unlinked = {
    audio: audio.filter((m) => !linkedTo.has(m.id)),
    images: images.filter((m) => !linkedTo.has(m.id)),
  };

  return {
    scene: full.scene,
    scripts: scriptRows,
    targets,
    images,
    audio,
    unlinked,
    linkedTo,
    counts: {
      images: images.length,
      audio: audio.length,
      scripts: topScripts.length,
      parts: targets.filter((t) => t.kind === 'part').length,
      journeys: scriptRows.filter((r) => r.journey).length,
      nodes: targets.filter((t) => t.depth > 0).length,
    },
  };
}

/* ================================================================== *
 * الكتابة — ولا شيءَ منها يقع تلقائيًّا
 * ================================================================== */

/**
 * يربط وسائطَ مختارةً بهدفٍ واحد — أو يفكّها إن كان الهدفُ `null`.
 *
 * ⚠️ **«اربط» هنا تعني «انقل»، وهذا فرقٌ جوهريّ.**
 *    لو أبقينا الروابطَ القديمة لصارت الصورةُ مرتبطةً بسكريبتين، ولما
 *    استطاعت اللوحةُ أن تقول «هي في الفحص البصري» بجوابٍ واحد.
 *    والطلبُ يقول: «تغيير الربط… العلاقةُ وحدَها هي ما يتغيّر» —
 *    فيُفَكّ القديمُ **داخل هذه الذكرى** ويُعقَد الجديد.
 *
 * ⚠️ **ولا يُمَسّ رابطٌ خارج هذه الذكرى.** الملفُّ الواحد قد يخدم
 *    ذكرياتٍ عدّة؛ وتنظيمُك هنا ليس إذنًا بهدم تنظيمِك هناك.
 *
 * @param {string[]} mediaIds
 * @param {string|null} targetId سكريبتٌ أو جزء — أو `null` لفكّ الربط
 * @param {{ scopeIds?: string[] }} options `scopeIds` أهدافُ هذه الذكرى
 * @returns {Promise<{linked: number, unlinked: number}>}
 */
export async function linkItemsTo(mediaIds, targetId, { scopeIds = [] } = {}) {
  const scope = new Set(scopeIds);
  const rows = (await media.getMany(mediaIds)).filter(Boolean);
  let linked = 0;
  let unlinked = 0;

  for (const item of rows) {
    const kind = linkKindFor(item.kind);
    const existing = await linksOf(item.id, kind);

    for (const row of existing) {
      if (row.otherId === targetId) continue;
      if (scope.size && !scope.has(row.otherId)) continue;   /* ذكرى أخرى — لا تُمَسّ */
      await unlink(item.id, row.otherId, kind);
      unlinked += 1;
    }

    if (targetId) {
      await link(item.id, targetId, kind);
      linked += 1;
    }
  }

  return { linked, unlinked };
}

/* ================================================================== *
 * العُقَد — الجزءُ والمرحلةُ والجولةُ ونصُّ التدريب، بدالّةٍ واحدة
 * ================================================================== */

/**
 * ينشئ عقدةً تحت أبٍ ما.
 *
 * ⚠️ `sceneId: null` **هو الحارس** الذي يبقي الصفحةَ القديمة كما هي —
 *    راجع رأسَ الملفّ. تغييرُه إلى `sceneId` حقيقيّ يجعل كلَّ مرحلةٍ
 *    وكلَّ جولةٍ تظهر هناك سكريبتًا مستقلًّا.
 *
 * @param {string} parentId
 * @param {{ title?: string, text?: string, nodeKind?: string,
 *           semanticType?: string, templateKey?: string,
 *           templateVersion?: string, derivedFromScriptId?: string,
 *           at?: number }} options
 *        `at` موضعُ الإدراج بين الأشقّاء (١-based)؛ الافتراضُ الآخِر.
 */
export async function addNode(parentId, {
  title, text = '', nodeKind = NODE_KIND.PART, semanticType = 'custom',
  templateKey = null, templateVersion = null, derivedFromScriptId = null, at = null,
} = {}) {
  const parent = await scripts.get(parentId);
  if (!parent) throw new Error('العقدة الأمّ غير موجودة');

  const siblings = await childRowsOf(parentId);
  const node = await addScript(null, {
    title: (title || 'عقدة جديدة').trim(),
    text,
    type: 'alt',
    sceneType: parent.sceneType || null,
  });

  /*
   * ⚠️ **والعقدةُ ليست «السكريبت الأساسيّ» أبدًا.** `addScript` تجعل
   *    أوّلَ سكريبتٍ في مشهدٍ أساسيًّا، وتعدّ الأشقّاءَ بـ
   *    `byIndex('sceneId')` — و`null` لا يُفهرَس، فتظنّ كلَّ عقدةٍ
   *    أوّلَ سكريبتٍ في مشهدها. علَمٌ كاذبٌ يبقى في البيانات لو تُرك.
   */
  const patch = { nodeKind, semanticType };
  if (node.isPrimary) patch.isPrimary = 0;
  /*
   * ⚠️ **والمنشأُ يُسجَّل ولا يَحكم** (بند ٢٧). `templateKey` يقول من
   *    أين جاءت هذه العقدة، ولا سطرَ واحدٌ في التطبيق يقرؤه ليمنع
   *    تعديلًا أو إعادةَ ترتيب. أثرٌ تاريخيّ، لا قيد.
   */
  if (templateKey) patch.templateKey = templateKey;
  if (templateVersion) patch.templateVersion = templateVersion;
  if (derivedFromScriptId) patch.derivedFromScriptId = derivedFromScriptId;
  await scripts.update(node.id, patch);

  const row = await link(parentId, node.id, PART_OF);
  if (row) {
    const order = Number.isInteger(at) ? at : siblings.length + 1;
    await relationships.update(row.id, { order });
    if (Number.isInteger(at)) await resequence(parentId);
  }
  return { ...node, ...patch };
}

/** توافقٌ مع WS56 — الجزءُ عقدةٌ من نوع `part`. */
export async function addPart(scriptId, { title, text = '' }) {
  const siblings = await partsOf(scriptId);
  return addNode(scriptId, {
    title: title || `جزء ${siblings.length + 1}`,
    text,
    nodeKind: NODE_KIND.PART,
  });
}

/**
 * يُعيد ترقيمَ أشقّاءِ أبٍ ١، ٢، ٣… بترتيبهم الحاليّ.
 *
 * ⚠️ **بلا هذا تتراكم الفجوات والتساوي.** الإدراجُ في الوسط والتكرارُ
 *    والنقلُ من أبٍ آخر كلُّها تُنتج أرقامًا متساويةً، وترتيبُ
 *    المتساويَين يصير رهنَ ترتيبِ القاعدة — أي عشوائيًّا بين جلستين.
 */
async function resequence(parentId) {
  const rows = await childRowsOf(parentId);
  let n = 0;
  for (const { link: row } of rows) {
    n += 1;
    if (row.order !== n) await relationships.update(row.id, { order: n });
  }
}

/** يعيد تسمية عقدة — **ولا يمسّ هُويّتها الداخليّة** (بند ١١). */
export async function renameNode(nodeId, title) {
  const clean = String(title || '').trim();
  if (!clean) throw new Error('الاسم مايصحّش يكون فاضي');
  return scripts.update(nodeId, { title: clean });
}

/** يكتب نصَّ عقدة — عبر `updateScript` فتُحفَظ نسخةٌ في التاريخ. */
export async function setNodeText(nodeId, text) {
  return updateScript(nodeId, { text: String(text ?? '') });
}

/**
 * يُخفي عقدةً أو يُظهرها — **حفظٌ لا حذف** (بند ١٠).
 *
 * ⚠️ والفرقُ جوهريّ: المخفيّةُ تبقى في القاعدة بكلّ أبنائها وروابطها،
 *    ولا تُعرَض في المسار المعتاد. وهذا ما يجعل «عطّل الرحلة» بديلًا
 *    آمنًا عن حذف عشرات العُقَد (بند ٢٢).
 */
export async function setNodeHidden(nodeId, hidden) {
  return scripts.update(nodeId, { hidden: hidden ? 1 : 0 });
}

/**
 * ينقل عقدةً خطوةً لأعلى أو لأسفل بين أشقّائها.
 *
 * ⚠️ **ولا يمسّ نصًّا ولا وسيطًا** (بند ٩) — يبدّل رقمَي ترتيبٍ على
 *    رابطَين، لا أكثر.
 */
export async function moveNode(parentId, nodeId, direction) {
  const rows = await childRowsOf(parentId);
  const at = rows.findIndex(({ node }) => node.id === nodeId);
  const to = at + (direction === 'up' ? -1 : 1);
  if (at < 0 || to < 0 || to >= rows.length) return false;

  await relationships.update(rows[at].link.id, { order: to + 1 });
  await relationships.update(rows[to].link.id, { order: at + 1 });
  await resequence(parentId);
  return true;
}

/**
 * ينقل عقدةً إلى أبٍ آخر.
 *
 * ⚠️ **والمنعُ من الدورة شرطُ سلامةٍ لا تجميل.** جعلُ عقدةٍ ابنًا
 *    لأحد أحفادِها يصنع حلقةً مغلقة: `subtreeOf` تدور بلا نهاية،
 *    والشجرةُ كلُّها تختفي من الشاشة لأن رسمَها لا ينتهي.
 */
export async function moveNodeTo(nodeId, newParentId) {
  if (!newParentId || nodeId === newParentId) return false;

  const descendants = new Set(
    flattenTree(await subtreeOf(nodeId)).map((row) => row.node.id)
  );
  if (descendants.has(newParentId)) {
    throw new Error('مينفعش تنقل العقدة جوّه واحدة من أبنائها');
  }

  const oldParents = (await linksOf(nodeId, PART_OF))
    .filter((row) => row.fromId !== nodeId);
  for (const row of oldParents) await relationships.destroy(row.id);

  const siblings = await childRowsOf(newParentId);
  const row = await link(newParentId, nodeId, PART_OF);
  if (row) await relationships.update(row.id, { order: siblings.length + 1 });
  for (const old of oldParents) await resequence(old.fromId);
  return true;
}

/**
 * ينسخ عقدةً بكلّ أبنائها وروابط وسائطها.
 *
 * ⚠️ **والوسائطُ تُربَط ولا تُنسَخ.** النسخةُ الجديدة تشير إلى نفس
 *    ملفّ الصوت ونفس الصورة — لأن تكرار المحتوى هو ما منعناه في WS56،
 *    وتكرارُ عقدةٍ تنظيميّة ليس استثناءً منه.
 */
export async function duplicateNode(parentId, nodeId, { suffix = ' (نسخة)' } = {}) {
  const source = await scripts.get(nodeId);
  if (!source) throw new Error('العقدة غير موجودة');

  const copy = await addNode(parentId, {
    title: `${source.title}${suffix}`,
    text: source.text || '',
    nodeKind: source.nodeKind || NODE_KIND.PART,
    semanticType: source.semanticType || 'custom',
    templateKey: source.templateKey || null,
    templateVersion: source.templateVersion || null,
    derivedFromScriptId: source.derivedFromScriptId || null,
  });
  if (source.hidden === 1) await setNodeHidden(copy.id, true);

  for (const kind of [LINK.AUDIO_SCRIPT, LINK.IMAGE_SCRIPT]) {
    for (const row of await linksOf(nodeId, kind)) {
      await link(row.otherId, copy.id, kind);
    }
  }

  for (const { node } of await childRowsOf(nodeId)) {
    await duplicateNode(copy.id, node.id, { suffix: '' });
  }
  return copy;
}

/**
 * سياساتُ حذف عقدةٍ لها أبناء (بند ٣١) — **ولا واحدةَ منها صامتة**.
 */
export const DELETE_POLICY = Object.freeze({
  /** العقدةُ وحدَها، وأبناؤها يصعدون إلى جدّهم. */
  LIFT: 'lift',
  /** العقدةُ وكلُّ ما تحتها. */
  CASCADE: 'cascade',
});

/**
 * يحذف عقدةً بسياسةٍ صريحة.
 *
 * ⚠️ **وما كان مرتبطًا بها يعود «غير مربوط» لا يُحذَف.** صورةٌ ربطتَها
 *    بمرحلةٍ ثم حذفتَ المرحلة ما زالت صورتَك — ولو ذهبت معها لكان
 *    حذفُ تنظيمٍ حذفًا لمحتوى.
 *
 * ⚠️ **والنصوصُ تذهب إلى السلة لا إلى العدم** — تُسترجَع من السلة
 *    كأيّ سكريبت، لأنها سكريبتاتٌ فعلًا.
 */
export async function removeNode(nodeId, { policy = DELETE_POLICY.CASCADE } = {}) {
  const parentRow = (await linksOf(nodeId, PART_OF)).find((row) => row.toId === nodeId);
  const parentId = parentRow?.fromId || null;
  const children = await childRowsOf(nodeId);

  if (policy === DELETE_POLICY.LIFT && parentId) {
    for (const { node } of children) await moveNodeTo(node.id, parentId);
  }

  const doomed = policy === DELETE_POLICY.CASCADE
    ? [nodeId, ...flattenTree(await subtreeOf(nodeId)).map((row) => row.node.id)]
    : [nodeId];

  for (const id of doomed) {
    for (const row of await linksOf(id)) await relationships.destroy(row.id);
    await scripts.trash(id);
  }

  if (parentId) await resequence(parentId);
  return { removed: doomed.length };
}

/** توافقٌ مع WS56 — حذفُ جزءٍ بلا أبناءٍ سلوكُه كما كان. */
export async function removePart(partId) {
  await removeNode(partId, { policy: DELETE_POLICY.CASCADE });
  return true;
}

/* ================================================================== *
 * رحلةُ التدريب
 * ================================================================== */

/**
 * ينشئ رحلةَ تدريبٍ تحت سكريبتٍ قائم — **بلا مساسٍ بالسكريبت نفسِه**.
 *
 * ⚠️ **والسكريبتُ الأصليّ يبقى سكريبتًا كاملًا** (بند ٣ و٢١): نصُّه
 *    ونطقُه وصورُه كما هي، ولا يُنسَخ ولا يُستبدَل ولا يصير مجرّدَ
 *    غلافٍ للرحلة. الرحلةُ تُضاف **تحته**، وهو يبقى فوقها.
 *
 * @param {string} scriptId
 * @param {{ templateId?: string }} options
 */
export async function createJourney(scriptId, { templateId = 'empty' } = {}) {
  const script = await scripts.get(scriptId);
  if (!script) throw new Error('السكريبت غير موجود');
  const existing = await journeyOf(scriptId);
  if (existing) return existing;

  const template = templateById(templateId);
  const journey = await addNode(scriptId, {
    title: 'رحلة التدريب',
    nodeKind: NODE_KIND.JOURNEY,
    semanticType: 'journey',
    templateKey: template.id === 'empty' ? null : TEMPLATE_KEY,
    templateVersion: template.version,
    derivedFromScriptId: scriptId,
  });

  /*
   * ⚠️ **المراحلُ تُنشَأ مرّةً ثم تُنسى.** لا شيءَ يربطها بالقالب بعد
   *    هذه اللحظة: `semanticType` هُويّةٌ داخليّةٌ تبقى لتعرف ما كانت،
   *    و`templateVersion` أثرٌ تاريخيّ. ولا آليّةَ في التطبيق تُعيد
   *    مزامنتَها مع قالبٍ أحدث — وهذا هو المطلوب بالضبط (بند ٧).
   */
  let order = 0;
  for (const phase of template.phases) {
    order += 1;
    await addNode(journey.id, {
      title: phase.title,
      nodeKind: NODE_KIND.PHASE,
      semanticType: phase.key,
      templateKey: TEMPLATE_KEY,
      templateVersion: template.version,
      derivedFromScriptId: scriptId,
      at: order,
    });
  }

  return journey;
}

/** يُعطّل رحلةً أو يُعيدها — إخفاءٌ للجذر، والأبناءُ كما هم (بند ٢٢). */
export async function setJourneyEnabled(journeyId, enabled) {
  return setNodeHidden(journeyId, !enabled);
}

/* ================================================================== *
 * سلامةُ الحذف من الوضع القديم (بند ٣٢)
 * ================================================================== */

/**
 * كلُّ العُقَد تحت سكريبتٍ — أجزاءً ورحلةً ومراحلَ وجولات.
 *
 * ⚠️ **وهذه هي الثغرةُ التي وثّقتُها في WS56 وتركتُها.** كتبتُ حينها:
 *    «الجزءُ يصير يتيمًا لو حُذف أبوه من الصفحة القديمة… إصلاحُه يمسّ
 *    حذفَ الوضع القديم، والبند ٢٢ يمنع». وكان الحدُّ مقبولًا حين كان
 *    اليتيمُ جزءًا أو جزأين.
 *
 *    وقد صار قد يكون **رحلةَ تدريبٍ من ثلاثين عقدة**. فالحدُّ الذي
 *    قبلتُه أمس لا يُقبَل اليوم — لا لأنّي غيّرتُ رأيي، بل لأن ما
 *    يحرسه تغيّر حجمُه.
 */
export async function descendantIdsOf(scriptId) {
  return flattenTree(await subtreeOf(scriptId)).map((row) => row.node.id);
}

/**
 * سلّةُ شجرةٍ كاملة، واستعادتُها — **بلا نافذةٍ ولا تأكيد**.
 *
 * ⚠️ **ولا تُنادَى وحدَها من واجهة.** هي نصفُ عمليّةٍ: التأكيدُ
 *    والتراجعُ في `deleteWithUndo`، وهذه تُمرَّر إليها `cascade`.
 *    استعمالُها مباشرةً يحذف بلا سؤالٍ — وهو ما لا يفعله هذا التطبيق.
 */
export async function trashSubtree(scriptId) {
  const ids = await descendantIdsOf(scriptId);
  for (const id of ids) await scripts.trash(id);
  return ids;
}

/**
 * يُرجِع من السلة كلَّ ما تحت سكريبت.
 *
 * ⚠️ **ويُقرأ من السلة لا من الشجرة.** `subtreeOf` تتخطّى المحذوف
 *    (`STATE.ACTIVE` فقط)، فهي عمياءُ عمّا نريد إرجاعَه بالضبط.
 *    فنمرّ على الروابط نفسِها — وهي لم تُمَسّ — ونصعد منها إلى العُقَد.
 */
export async function restoreSubtree(scriptId, { depth = 0, seen = new Set() } = {}) {
  if (depth > 12 || seen.has(scriptId)) return 0;
  seen.add(scriptId);

  const rows = (await relationships.byIndex('from_kind', [scriptId, PART_OF]))
    .filter((row) => row.state === STATE.ACTIVE);

  let n = 0;
  for (const row of rows) {
    const node = await scripts.get(row.toId);
    if (node && node.state !== STATE.ACTIVE) {
      await scripts.restore(row.toId);
      n += 1;
    }
    n += await restoreSubtree(row.toId, { depth: depth + 1, seen });
  }
  return n;
}

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
import { addScript } from './content-service.js';
import {
  LINK, link, unlink, linksOf, membershipKind,
} from './link-service.js';

/** انتماءُ الجزء إلى سكريبته — بصيغة العضويّة القائمة. */
export const PART_OF = membershipKind('script', 'script');

/** نوعُ الربط المناسب لكلّ وسيط — الصوتُ والصورةُ لا يتشاركان نوعًا. */
const linkKindFor = (kind) => (kind === 'audio' ? LINK.AUDIO_SCRIPT : LINK.IMAGE_SCRIPT);

/* ================================================================== *
 * القراءة
 * ================================================================== */

/** أجزاءُ سكريبتٍ مرتَّبةً — فارغةٌ للسكريبت الذي لا أجزاءَ له. */
export async function partsOf(scriptId) {
  const rows = (await relationships.byIndex('from_kind', [scriptId, PART_OF]))
    .filter((row) => row.state === STATE.ACTIVE);
  if (!rows.length) return [];

  const list = (await scripts.getMany(rows.map((row) => row.toId)))
    .filter((row) => row && row.state === STATE.ACTIVE);

  /* الترتيبُ على الرابط لا على السجلّ — الجزءُ قد يُنقَل بين سكريبتين. */
  const orderOf = new Map(rows.map((row) => [row.toId, row.order ?? 0]));
  return list.sort((a, b) => (orderOf.get(a.id) ?? 0) - (orderOf.get(b.id) ?? 0));
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

  /* الأجزاءُ لكلّ سكريبت — وهي سكريبتاتٌ تصلح أهدافَ ربطٍ بدورها. */
  const partsByScript = new Map();
  for (const script of topScripts) partsByScript.set(script.id, await partsOf(script.id));

  /* كلُّ هدفِ ربطٍ ممكن: سكريبتٌ أو جزء. */
  const targets = [];
  for (const script of topScripts) {
    targets.push({ id: script.id, title: script.title, kind: 'script', parentTitle: null });
    for (const part of partsByScript.get(script.id) || []) {
      targets.push({ id: part.id, title: part.title, kind: 'part', parentTitle: script.title });
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

  const scriptRows = topScripts.map((script) => {
    const own = itemsOf(script.id);
    const parts = (partsByScript.get(script.id) || []).map((part) => ({
      part, ...itemsOf(part.id),
    }));
    return {
      script,
      parts,
      ...own,
      /* عدّادُ السكريبت يشمل أجزاءَه — «الفحص البصري 🎙٢ 🖼٤» تعني الكلّ. */
      totals: {
        audio: own.audio.length + parts.reduce((n, p) => n + p.audio.length, 0),
        images: own.images.length + parts.reduce((n, p) => n + p.images.length, 0),
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
 * الأجزاء
 * ================================================================== */

/**
 * يضيف جزءًا إلى سكريبت.
 *
 * ⚠️ `sceneId: null` **هو الحارس** الذي يبقي الصفحةَ القديمة كما هي —
 *    راجع رأسَ الملفّ. تغييرُه إلى `sceneId` حقيقيّ يجعل الأجزاءَ
 *    تظهر هناك سكريبتاتٍ مستقلّة.
 */
export async function addPart(scriptId, { title, text = '' }) {
  const parent = await scripts.get(scriptId);
  if (!parent) throw new Error('السكريبت غير موجود');

  const siblings = await partsOf(scriptId);
  const part = await addScript(null, {
    title: (title || `جزء ${siblings.length + 1}`).trim(),
    text,
    type: 'alt',
    sceneType: parent.sceneType || null,
  });

  /*
   * ⚠️ **والجزءُ ليس أساسيًّا أبدًا.** `addScript` تجعل أوّلَ سكريبتٍ
   *    في مشهدٍ أساسيًّا، وهي تعدّ الأشقّاءَ بـ`byIndex('sceneId')` —
   *    و`null` لا يُفهرَس، فتظنّ كلَّ جزءٍ أوّلَ سكريبتٍ في مشهده
   *    وتضع له `isPrimary: 1`. لا ضررَ اليومَ لأن لا أحدَ يقرأ
   *    `isPrimary` خارج نطاق مشهد، لكنّه علَمٌ كاذبٌ يبقى في البيانات.
   */
  if (part.isPrimary) await scripts.update(part.id, { isPrimary: 0 });

  const row = await link(scriptId, part.id, PART_OF);
  if (row) await relationships.update(row.id, { order: siblings.length + 1 });
  return part;
}

/**
 * يحذف جزءًا: الرابطُ يُفَكّ، والنصُّ يذهب إلى السلة.
 *
 * ⚠️ **وما كان مرتبطًا بالجزء يعود «غير مربوط» لا يُحذَف.** صورةٌ
 *    ربطتَها بجزءٍ ثم حذفتَ الجزء ما زالت صورتَك — ولو ذهبت معه لكان
 *    حذفُ تنظيمٍ حذفًا لمحتوى.
 */
export async function removePart(partId) {
  const rows = await linksOf(partId, PART_OF);
  for (const row of rows) await relationships.destroy(row.id);

  for (const kind of [LINK.AUDIO_SCRIPT, LINK.IMAGE_SCRIPT]) {
    for (const row of await linksOf(partId, kind)) await relationships.destroy(row.id);
  }

  await scripts.trash(partId);
  return true;
}

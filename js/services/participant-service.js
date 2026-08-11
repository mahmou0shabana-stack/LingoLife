/**
 * LingoLife — مَن كان في الذكرى
 *
 * ═══════════════════════════════════════════════════════════════
 * حاضرٌ ومتكلِّمٌ شيئان
 * ═══════════════════════════════════════════════════════════════
 *
 * كان الأطلس وشاشة الذكرى يشتقّان الأشخاص من **مَن تكلّم** وحده
 * (`conversationParts.personId`). وكان ذلك حدًّا نُعلنه في `STATUS.md`:
 * «مَن حضر ولم يتكلّم لا يظهر — ولا مصدرَ في التطبيق يقوله».
 *
 * والحدّ حقيقيّ: في اجتماعٍ من خمسة يتكلّم اثنان، فتختفي ثلاثةٌ من
 * ذاكرتك لأنهم صمتوا. وفي زيارةٍ للطبيب معك زوجتُك لم تنطق، فكأنها
 * لم تكن.
 *
 * فصار للذكرى **مشاركون** يُعلَنون، و**متكلّمون** يُشتقّون — ولا
 * يُخلَطان:
 *
 *   مشارك  ←  أنت قلتَ إنه كان هناك.        (علاقةٌ صريحة)
 *   متكلّم  ←  له جملةٌ في المحادثة.          (دليلٌ مُشتقّ)
 *
 * ومَن تكلّم **كان هناك بالضرورة** — فالمجموعتان تتّحدان في العرض،
 * ولكلّ شخصٍ يظهر **سببُ ظهوره** مكتوبًا: حضر، أم تكلّم، أم الاثنان.
 * رقمٌ بلا مصدر ليس رقمًا (بند 89).
 *
 * ═══════════════════════════════════════════════════════════════
 * ولماذا علاقةٌ لا حقل
 * ═══════════════════════════════════════════════════════════════
 *
 * على `scene` حقلٌ اسمه `peopleIds` يُكتب `[]` عند الإنشاء **ولا
 * يُملأ في أي مكان** — حقلٌ ميّت، وهو ما كان سيغري بملئه هنا.
 *
 * ولا يُملأ: العضويّة في هذا المشروع **علاقةٌ لا حقل**، وهو اصطلاحٌ
 * سبق أن اختير للخيوط (`thread:scene`) واشترى ثلاثة أشياء تشتريها
 * المشاركة أيضًا:
 *
 *  1. **لا مصفوفةٌ تُصان.** حذفُ شخصٍ لا يعني إعادة كتابة كل ذكرياته.
 *  2. **لا جدول جديد.** `relationships` يستوعب الزوج بلا ترقية.
 *  3. **الاتجاه محفوظ.** الذكرى حاوٍ (`fromId`) والشخص عضو (`toId`)،
 *     فسؤال «مَن كان في هذه الذكرى؟» و«في أي ذكرياتٍ كان؟» كلاهما
 *     إصابةُ فهرس.
 *
 * ⚠️ ولا ترقيةَ لقاعدة البيانات: `relationships` عندها فهارس `kind`
 *    و`from_kind` و`to_kind` منذ v8. النوع الجديد صفوفٌ لا مخطَّط.
 */

import { conversationParts, scenes, people, relationships } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { link, unlink, linksOf, membershipKind } from './link-service.js';

/**
 * عضويّة الشخص في الذكرى — بنفس اصطلاح `thread:scene`.
 *
 * ⚠️ الذكرى هي الحاوي هنا لا الشخص: أنت تسأل «مين كان في الذكرى دي؟»
 *    أكثر ممّا تسأل «إيه الذكريات اللي فيها فلان؟» — والاتجاهان
 *    مقروءان على أي حال، لكن الاصطلاح يلزم أن يكون واحدًا.
 */
export const SCENE_PERSON = membershipKind('scene', 'person');

/* ------------------------------------------------------------------ *
 * الكتابة
 * ------------------------------------------------------------------ */

/** يعلن أن هذا الشخص كان في هذه الذكرى. مُتسامحٌ مع التكرار. */
export async function addParticipant(sceneId, personId) {
  if (!sceneId || !personId) return null;
  return link(sceneId, personId, SCENE_PERSON);
}

/**
 * يرفع إعلانَ المشاركة.
 *
 * ⚠️ **ولا يمسّ كلامه.** لو كان له جملةٌ في المحادثة ظلّ ظاهرًا
 *    بدليل الكلام — لأن ذلك واقعةٌ لا إعلان. ورفعُ الإعلان لا يمحو
 *    واقعة.
 */
export async function removeParticipant(sceneId, personId) {
  return unlink(sceneId, personId, SCENE_PERSON);
}

/** يضبط قائمة المشاركين دفعةً واحدة — للنماذج متعدّدة الاختيار. */
export async function setParticipants(sceneId, personIds) {
  const wanted = new Set((personIds || []).filter(Boolean));
  const current = new Set(await participantIds(sceneId));

  for (const id of wanted) if (!current.has(id)) await addParticipant(sceneId, id);
  for (const id of current) if (!wanted.has(id)) await removeParticipant(sceneId, id);

  return [...wanted];
}

/* ------------------------------------------------------------------ *
 * القراءة
 * ------------------------------------------------------------------ */

/** معرّفات المشاركين المُعلَنين في ذكرى — بلا تحقّقٍ من حياة الشخص. */
export async function participantIds(sceneId) {
  const rows = await linksOf(sceneId, SCENE_PERSON);
  return rows.map((row) => (row.fromId === sceneId ? row.toId : row.fromId));
}

/** الذكريات التي أُعلن فيها هذا الشخص مشاركًا. */
export async function scenesOfParticipant(personId) {
  const rows = await linksOf(personId, SCENE_PERSON);
  return rows.map((row) => (row.toId === personId ? row.fromId : row.toId));
}

/**
 * مَن كان في الذكرى — **بدليل كلٍّ**.
 *
 * ⚠️ الاتحاد لا أحدهما: مَن تكلّم كان هناك بالضرورة، ومَن أعلنتَه قد
 *    يكون صمت. فالعرض يجمعهما ويقول لكلٍّ لماذا ظهر.
 *
 * @returns {Promise<{id, name, declared, spoke, saidCount}[]>}
 */
export async function scenePeople(sceneId) {
  const [declared, parts, personRows] = await Promise.all([
    participantIds(sceneId),
    conversationParts.byIndex('sceneId', sceneId),
    people.getAll(),
  ]);

  const known = new Map(
    personRows.filter((row) => row.state !== STATE.TRASHED).map((row) => [row.id, row])
  );

  const said = new Map();
  for (const part of parts) {
    if (part.state !== STATE.ACTIVE || !part.personId) continue;
    said.set(part.personId, (said.get(part.personId) || 0) + 1);
  }

  const ids = new Set([...declared, ...said.keys()]);
  return [...ids]
    .filter((id) => known.has(id))
    .map((id) => ({
      id,
      name: known.get(id).name,
      // ⚠️ العلَمان منفصلان عمدًا: الشاشة تقول «حضر» أو «اتكلّم» أو
      //    الاثنين، ولا تدمجهما في «موجود» فتخسر الفرق.
      declared: declared.includes(id),
      spoke: said.has(id),
      saidCount: said.get(id) || 0,
    }))
    .sort((a, b) => b.saidCount - a.saidCount || a.name.localeCompare(b.name, 'ar'));
}

/**
 * كل الأشخاص في كل الذكريات — بعدد ذكريات كلٍّ.
 *
 * ⚠️ **يُقرأ مرّةً لكل الذكريات** لا مرّةً لكل ذكرى: الأطلس يحتاج
 *    الخريطة كلها، ونداءُ `scenePeople` ألفَ مرّة يجعل صفحةً واحدة
 *    ألفَ استعلام.
 *
 * @returns {Promise<Map<string, {scenes:Set<string>, declared:Set<string>, spoke:Set<string>}>>}
 */
export async function peopleSceneMap() {
  const [linkRows, parts, sceneRows] = await Promise.all([
    // كل روابط المشاركة دفعةً واحدة — إصابةُ فهرس `kind` لا مسحٌ كامل.
    relationships.byIndex('kind', SCENE_PERSON),
    conversationParts.getAll(),
    scenes.getActive(),
  ]);

  const live = new Set(sceneRows.map((row) => row.id));
  const map = new Map();
  const entry = (personId) => {
    if (!map.has(personId)) {
      map.set(personId, { scenes: new Set(), declared: new Set(), spoke: new Set() });
    }
    return map.get(personId);
  };

  for (const row of linkRows) {
    if (row.state !== STATE.ACTIVE || !live.has(row.fromId)) continue;
    const row_ = entry(row.toId);
    row_.scenes.add(row.fromId);
    row_.declared.add(row.fromId);
  }

  for (const part of parts) {
    if (part.state !== STATE.ACTIVE || !part.personId || !live.has(part.sceneId)) continue;
    const row_ = entry(part.personId);
    row_.scenes.add(part.sceneId);
    row_.spoke.add(part.sceneId);
  }

  return map;
}

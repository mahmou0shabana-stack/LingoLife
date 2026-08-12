/**
 * LingoLife — الأشخاص
 *
 * المستودع `people` موجود منذ أوّل يوم وفارغ، و`conversationParts.personId`
 * موجود ودائمًا `null`. الفتحات محفورة وتنتظر — وهذا ما يملؤها.
 *
 * ───────────────────────────────────────────────────────────────
 * لماذا يستحقّ المتحدّث كيانًا؟
 *
 * لأن `speaker` نصٌّ حرّ اليوم، فـ«أليكسي» و«Алексей» و«م. أليكسي»
 * ثلاثة أشخاص عند التطبيق وواحدٌ عندك. ومعنى ذلك أن سؤالًا بديهيًّا —
 * «فين كل الكلام اللي قاله أليكسي؟» — لا جواب له.
 *
 * وحين يصير كيانًا يصير الجواب استعلامًا: مشاهده، محادثاته، تعبيراته،
 * أوّل لقاء وآخره. وكلّها أرقامٌ قابلة للنقر لا للعرض.
 * ───────────────────────────────────────────────────────────────
 *
 * والنمط هنا **هو نفسه نمط الأنواع بحرفه** (`type-service.js`):
 * كيانٌ بمعرّف ثابت واسمٍ للعرض واسمٍ مطبَّع وأسماء بديلة وحالة. وهو
 * ما سيتكرّر في المشاريع والخيوط — بُني مرّةً ليُقرأ ثلاثًا.
 *
 * ⚠️ **قاعدة حاكمة: لا دمج تلقائي.** المطابقة بالتطبيع تقترح ولا
 *    تقرّر. شخصان باسمٍ متشابه قد يكونان اثنين فعلًا، والخطأ هنا
 *    يخلط كلام رجلين — وهو خطأٌ لا يُكتشَف بسهولة بعد شهر.
 */

import { people, conversationParts, scenes, expressionOccurrences } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { normalize } from '../utils/normalization.js';
import { newId, PREFIX } from '../utils/ids.js';

/**
 * أدوار جاهزة — نقطة بداية لا قائمة مغلقة.
 * الدور يصف علاقته بك في السياق، لا وظيفته في الحياة.
 */
export const PERSON_ROLES = Object.freeze([
  'زميل', 'مدير', 'مرؤوس', 'عميل', 'مورّد', 'موظّف حكومي',
  'دكتور', 'جار', 'صاحب', 'قريب', 'مدرّس', 'غريب',
]);

/** ألوان بطاقة المتحدّث في المحادثة — تُميّز الأصوات بالنظر. */
export const PERSON_COLORS = Object.freeze([
  '#8B5CF6', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#6366F1',
]);

/** الاسم الذي يحمله جزءُ محادثةٍ يخصّك أنت. */
export const ME = Object.freeze({ id: 'me', label: 'أنا' });

/** شكل الصفّ كما تراه الشاشات. */
function toView(record) {
  return {
    id: record.id,
    name: record.name,
    nameRu: record.nameRu || '',
    nameAr: record.nameAr || '',
    aliases: record.aliases || [],
    role: record.role || '',
    company: record.company || '',
    relation: record.relation || '',
    color: record.color || null,
    photoMediaId: record.photoMediaId || null,
    note: record.note || '',
    isMe: Boolean(record.isMe),
    archived: record.state === STATE.ARCHIVED,
    lastSeenAt: record.lastSeenAt || null,
  };
}

/** كل الأسماء التي يُعرَف بها الشخص — للمطابقة. */
function namesOf(record) {
  return [record.name, record.nameRu, record.nameAr, ...(record.aliases || [])]
    .filter(Boolean)
    .map(normalize);
}

/* ------------------------------------------------------------------ *
 * القراءة
 * ------------------------------------------------------------------ */

export async function listPeople({ includeArchived = false } = {}) {
  const rows = await people.getAll();
  return rows
    .filter((r) => r.state !== STATE.TRASHED && (includeArchived || r.state !== STATE.ARCHIVED))
    // آخر مَن تكلّم معه أوّلًا: المنتقي يُفتح على مَن تحتاجه غالبًا.
    .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) ||
      String(a.name).localeCompare(String(b.name), 'ar'))
    .map(toView);
}

export async function getPerson(id) {
  const record = await people.get(id);
  return record ? toView(record) : null;
}

/**
 * يجد شخصًا باسمٍ مكتوب — بالتطبيع وبالأسماء البديلة.
 * @returns {Promise<object|null>}
 */
export async function findByName(name) {
  const target = normalize(name || '');
  if (!target) return null;
  const rows = await people.getAll();
  const hit = rows.find(
    (r) => r.state !== STATE.TRASHED && namesOf(r).includes(target)
  );
  return hit ? toView(hit) : null;
}

/* ------------------------------------------------------------------ *
 * الكتابة
 * ------------------------------------------------------------------ */

export async function checkPersonName(name, { excludeId = null } = {}) {
  const clean = (name || '').trim();
  if (!clean) return { conflict: false, empty: true };
  const existing = await findByName(clean);
  return {
    conflict: Boolean(existing) && existing.id !== excludeId,
    existing: existing && existing.id !== excludeId ? existing : null,
  };
}

/**
 * يضيف شخصًا.
 * @param {{name: string, nameRu?: string, nameAr?: string, role?: string,
 *          company?: string, relation?: string, aliases?: string[],
 *          color?: string, photoMediaId?: string, note?: string,
 *          isMe?: boolean}} input
 */
export async function addPerson(input) {
  const name = (input.name || '').trim();
  if (!name) throw new Error('اسم الشخص مطلوب');

  const { conflict, existing } = await checkPersonName(name);
  if (conflict) throw new Error(`«${existing.name}» موجود بالفعل.`);

  const count = (await people.getAll()).length;
  const created = await people.create({
    id: newId(PREFIX.PERSON),
    name,
    normalizedName: normalize(name),
    nameRu: (input.nameRu || '').trim(),
    nameAr: (input.nameAr || '').trim(),
    aliases: input.aliases || [],
    role: (input.role || '').trim(),
    company: (input.company || '').trim(),
    relation: (input.relation || '').trim(),
    // لونٌ بالدور فلا يتكرّر لونان متجاوران — والتغيير ممكن دائمًا.
    color: input.color || PERSON_COLORS[count % PERSON_COLORS.length],
    photoMediaId: input.photoMediaId || null,
    note: (input.note || '').trim(),
    isMe: input.isMe ? 1 : 0,
    lastSeenAt: null,
  });
  return toView(created);
}

export async function updatePerson(id, changes) {
  const current = await people.get(id);
  if (!current) throw new Error('الشخص ده مش موجود');

  if (changes.name !== undefined) {
    const { conflict, existing } = await checkPersonName(changes.name, { excludeId: id });
    if (conflict) throw new Error(`«${existing.name}» موجود بالفعل.`);
  }

  const patch = { ...changes };
  if (changes.name !== undefined) patch.normalizedName = normalize(changes.name);
  if (changes.archived !== undefined) {
    patch.state = changes.archived ? STATE.ARCHIVED : STATE.ACTIVE;
    delete patch.archived;
  }
  return toView(await people.update(id, patch));
}

/**
 * يؤرشف شخصًا — لا يحذفه.
 * ⚠️ الحذف يترك أجزاء محادثة بلا متحدّث. الأرشفة تُخفيه من المنتقي
 *    وتُبقي كلامه منسوبًا إليه.
 */
export async function archivePerson(id, archived = true) {
  return updatePerson(id, { archived });
}

export async function addPersonAlias(id, alias) {
  const clean = (alias || '').trim();
  if (!clean) throw new Error('الاسم البديل مطلوب');

  const owner = await findByName(clean);
  if (owner && owner.id !== id) {
    throw new Error(`«${clean}» اسمٌ لـ«${owner.name}» بالفعل.`);
  }

  const current = await people.get(id);
  if (!current) throw new Error('الشخص ده مش موجود');
  const aliases = current.aliases || [];
  if (aliases.some((a) => normalize(a) === normalize(clean))) return toView(current);
  return updatePerson(id, { aliases: [...aliases, clean] });
}

export async function removePersonAlias(id, alias) {
  const current = await people.get(id);
  if (!current) throw new Error('الشخص ده مش موجود');
  return updatePerson(id, {
    aliases: (current.aliases || []).filter((a) => normalize(a) !== normalize(alias)),
  });
}

/**
 * يضمّ شخصًا إلى آخر — **بأمرك أنت وحدك** (الملحق · G3/G4).
 *
 * هذا نظير `mergeInto` في الأنواع بحرفه، ولنفس السبب: التخلّص من
 * المكرَّر بلا فقدان بياناته.
 *
 * ما ينتقل:
 *   1. **كلامه** — كل `conversationParts.personId`.
 *   2. **حضوره** — روابط `scene:person`، بلا تكرارٍ لما هو موجود.
 *   3. **اسمه** — يصير اسمًا بديلًا للباقي، ومعه أسماؤه البديلة.
 *
 * ⚠️ **والقديم يُؤرشَف لا يُحذَف.** لو كان الضمّ غلطًا فكلامه منسوبٌ
 *    للباقي — لكن اسمه وأسماءه ما زالت موجودة، والصفّ قائمٌ يُستعاد.
 *    حذفٌ حقيقيّ هنا يجعل الغلطة غير قابلةٍ للرجوع.
 *
 * ⚠️ ولا يُنادى تلقائيًّا من أي مكان. كاشف المكرَّر يقترح، وأنت تضغط.
 *
 * @returns {Promise<{parts:number, scenes:number, aliases:string[]}>}
 */
export async function mergePeople(fromId, toId) {
  if (!fromId || !toId || fromId === toId) {
    throw new Error('الضمّ محتاج شخصين مختلفين');
  }
  const [from, to] = await Promise.all([people.get(fromId), people.get(toId)]);
  if (!from) throw new Error('الشخص اللي هيتضمّ مش موجود');
  if (!to) throw new Error('الشخص اللي هيستقبل مش موجود');

  /* ١ · كلامه */
  const parts = (await conversationParts.byIndex('personId', fromId))
    .filter((row) => row.state !== STATE.TRASHED);
  await Promise.all(parts.map((row) => conversationParts.update(row.id, { personId: toId })));

  /*
   * ٢ · حضوره
   *
   * ⚠️ عبر خدمة المشاركين لا عبر `relationships` مباشرةً: العضويّة
   *    علاقةٌ لا حقل (§3.6.1)، ومَن يعرف شكلها هو مالكُها.
   */
  const { addParticipant, removeParticipant, scenesOfParticipant } =
    await import('./participant-service.js');
  const mine = await scenesOfParticipant(fromId);
  const theirs = new Set(await scenesOfParticipant(toId));
  let moved = 0;
  for (const sceneId of mine) {
    await removeParticipant(sceneId, fromId);
    if (theirs.has(sceneId)) continue;
    await addParticipant(sceneId, toId);
    moved += 1;
  }

  /* ٣ · اسمه */
  const known = new Set((to.aliases || []).map((a) => normalize(a)));
  known.add(normalize(to.name));
  const added = [from.name, from.nameRu, from.nameAr, ...(from.aliases || [])]
    .map((name) => (name || '').trim())
    .filter((name) => name && !known.has(normalize(name)))
    .filter((name, index, all) => all.findIndex((x) => normalize(x) === normalize(name)) === index);

  if (added.length) {
    await people.update(toId, { aliases: [...(to.aliases || []), ...added] });
  }
  await updatePerson(fromId, { archived: true });

  return { parts: parts.length, scenes: moved, aliases: added };
}

/* ------------------------------------------------------------------ *
 * الربط بأجزاء المحادثة
 * ------------------------------------------------------------------ */

/**
 * ينسب جزء محادثة إلى شخص.
 *
 * ⚠️ **النصّ الحرّ يبقى** (بند 107). `speaker` هو ما كتبتَه أنت وقتها،
 *    و`personId` هو مَن نظنّه. لو أخطأنا في النسبة، الأصل ما زال
 *    مكتوبًا ويمكن الرجوع إليه.
 */
export async function assignSpeaker(partId, personId) {
  const part = await conversationParts.get(partId);
  if (!part) throw new Error('الجزء ده مش موجود');

  const person = personId ? await people.get(personId) : null;
  if (personId && !person) throw new Error('الشخص ده مش موجود');

  if (person) {
    // «آخر مرّة اتكلّم فيها» يُقرأ من تاريخ المشهد لا من ساعة الجهاز.
    const scene = part.sceneId ? await scenes.get(part.sceneId) : null;
    const seen = scene?.date ? new Date(scene.date).getTime() : Date.now();
    if (!person.lastSeenAt || seen > person.lastSeenAt) {
      await people.update(person.id, { lastSeenAt: seen });
    }
  }

  return conversationParts.update(partId, { personId: personId || null });
}

/**
 * يقترح شخصًا لنصٍّ حرّ — **اقتراحٌ لا نسبة**.
 *
 * @returns {Promise<{person: object, confidence: 'exact'|'alias'}|null>}
 */
export async function suggestPerson(speakerText) {
  const clean = (speakerText || '').trim();
  if (!clean || clean === ME.label) return null;

  const target = normalize(clean);
  const rows = await people.getAll();

  for (const row of rows) {
    if (row.state === STATE.TRASHED) continue;
    if (normalize(row.name) === target) return { person: toView(row), confidence: 'exact' };
  }
  for (const row of rows) {
    if (row.state === STATE.TRASHED) continue;
    if (namesOf(row).includes(target)) return { person: toView(row), confidence: 'alias' };
  }
  return null;
}

/**
 * أسماء المتحدّثين الحرّة التي لا شخص لها بعد.
 *
 * ⚠️ لا نُنشئ أشخاصًا منها تلقائيًّا. «أليكسي» و«Алексей» و«م. أليكسي»
 *    قد يكونون واحدًا وقد يكونون ثلاثة — والخطأ هنا يخلط كلام رجلين،
 *    وهو خطأٌ لا يُكتشَف بسهولة بعد شهر. فنعرض ونترك القرار لك.
 *
 * @returns {Promise<{speaker: string, parts: number, scenes: number,
 *                    suggestion: object|null}[]>}
 */
export async function unlinkedSpeakers() {
  const parts = await conversationParts.getAll();
  const groups = new Map();

  for (const part of parts) {
    if (part.state !== STATE.ACTIVE || part.personId) continue;
    const label = (part.speaker || '').trim();
    if (!label || label === ME.label || part.isMine) continue;

    const key = normalize(label);
    const group = groups.get(key) || { speaker: label, parts: 0, scenes: new Set() };
    group.parts++;
    if (part.sceneId) group.scenes.add(part.sceneId);
    groups.set(key, group);
  }

  const out = [];
  for (const group of groups.values()) {
    out.push({
      speaker: group.speaker,
      parts: group.parts,
      scenes: group.scenes.size,
      suggestion: await suggestPerson(group.speaker),
    });
  }
  return out.sort((a, b) => b.parts - a.parts);
}

/**
 * ينسب **كل** أجزاء المحادثة التي تحمل هذا الاسم الحرّ إلى شخص.
 * يُنادى بعد أن تقرّر أنت، لا قبله.
 */
export async function linkSpeakerTo(speakerText, personId) {
  const target = normalize(speakerText || '');
  if (!target) return 0;

  const parts = await conversationParts.getAll();
  const affected = parts.filter(
    (p) => p.state === STATE.ACTIVE && !p.personId && normalize(p.speaker || '') === target
  );
  for (const part of affected) await assignSpeaker(part.id, personId);
  return affected.length;
}

/* ------------------------------------------------------------------ *
 * صفحة الشخص
 * ------------------------------------------------------------------ */

/**
 * كل ما يخصّ شخصًا — أرقامٌ قابلة للنقر لا للعرض.
 *
 * @returns {Promise<{person: object, parts: object[], sceneIds: string[],
 *   scenes: object[], expressions: number, firstMet: string|null,
 *   lastMet: string|null}>}
 */
export async function personProfile(id) {
  const person = await getPerson(id);
  if (!person) return null;

  const parts = (await conversationParts.byIndex('personId', id))
    .filter((p) => p.state === STATE.ACTIVE);

  const sceneIds = [...new Set(parts.map((p) => p.sceneId).filter(Boolean))];
  const sceneRows = (await scenes.getMany(sceneIds))
    .filter((s) => s && s.state === STATE.ACTIVE)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  /*
   * التعبيرات التي ظهرت في مشاهده. ⚠️ **«ظهرت في مشهدٍ معه» ليست
   *    «قالها هو»** — قد تكون أنت مَن قالها. فالرقم يُعرَض بوصفه
   *    «تعبيرات من مشاهدكما» لا «تعبيراته» (بند 89).
   */
  const occurrences = await Promise.all(
    sceneIds.map((sceneId) => expressionOccurrences.byIndex('sceneId', sceneId))
  );
  const expressionIds = new Set(
    occurrences.flat().filter((o) => o.state === STATE.ACTIVE).map((o) => o.expressionId)
  );

  return {
    person,
    parts,
    sceneIds,
    scenes: sceneRows,
    expressions: expressionIds.size,
    firstMet: sceneRows[0]?.date || null,
    lastMet: sceneRows[sceneRows.length - 1]?.date || null,
  };
}

/** كم جزء محادثة لكل شخص — لعرضه في القائمة بمسحةٍ واحدة. */
export async function speakingCounts() {
  const parts = await conversationParts.getAll();
  const counts = new Map();
  for (const part of parts) {
    if (part.state !== STATE.ACTIVE || !part.personId) continue;
    counts.set(part.personId, (counts.get(part.personId) || 0) + 1);
  }
  return counts;
}

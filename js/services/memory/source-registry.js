/**
 * LingoLife — سجلُّ المصادر: ما عندي، وما تغيّر، وما حُلِّل (WS-J · بنود ٩ و١٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **بصمتان لا واحدة — وهذا كلُّ سرّ التحليل التزايُديّ**
 * ═══════════════════════════════════════════════════════════════
 *
 *   `contentHash`   بصمةُ النصّ **الآن**
 *   `analyzedHash`  بصمةُ النصّ **يومَ حُلِّل بنجاح**
 *
 * ومنهما تُقرأ الحالةُ كلُّها بلا حقلٍ ثالثٍ يُنسى تحديثُه:
 *
 *   لا سطرَ أصلًا            → لم يُحلَّل قطّ
 *   `analyzedHash` فارغ      → لم يُحلَّل قطّ
 *   متساويتان                → مُحلَّلٌ وحديث
 *   مختلفتان                 → اتعدّل بعد آخر تحليل
 *   الصفُّ اختفى              → محذوفٌ بعد التحليل
 *
 * فحين تعدّل نصًّا واحدًا من ثلاثين، **هو وحدَه** يصير `CHANGED` —
 * والتسعةُ والعشرون تبقى `CURRENT` فلا تُرسَل ثانيةً. وهذا هو الفرقُ
 * بين حزمةٍ من ٣ نصوصٍ وحزمةٍ من ٣٠.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا يُكتَب صفُّ محتوًى واحدٌ من هذا الملفّ**
 * ═══════════════════════════════════════════════════════════════
 *
 * السجلُّ يقرأ `scripts` و`studyDrafts` و`conversations`، ويكتب في
 * `memorySources` وحدَه. فتحليلُ نصٍّ لا يلمس النصَّ — وهو ما يجعل
 * البندَ الأوّل («التحليلُ لا يعيد كتابة ما حدث») ضمانةً بنيويّةً لا
 * وعدًا في تعليق.
 */

import {
  memorySources, scripts, studyDrafts, conversations, conversationParts,
} from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { EVIDENCE, ORIGIN, hashText } from './provenance.js';

/** أنواعُ المصادر التي تدخل التحليل — نفسُ ما يفهرسه `indexer.js`. */
export const SOURCE_KIND = Object.freeze({
  SCRIPT: 'script',
  DRAFT: 'draft',
  CONVERSATION: 'conversation',
});

/** حالةُ التحليل — مشتقّةٌ من البصمتين لا مخزَّنةٌ بذاتها. */
export const ANALYSIS_STATE = Object.freeze({
  NEVER: 'never',
  CURRENT: 'current',
  CHANGED: 'changed',
  DELETED: 'deleted',
  EXCLUDED: 'excluded',
});

export const STATE_LABEL = Object.freeze({
  [ANALYSIS_STATE.NEVER]: 'نصّ جديد',
  [ANALYSIS_STATE.CURRENT]: 'سبق تحليله',
  [ANALYSIS_STATE.CHANGED]: 'اتعدّل بعد آخر تحليل',
  [ANALYSIS_STATE.DELETED]: 'اتشال بعد التحليل',
  [ANALYSIS_STATE.EXCLUDED]: 'مستبعَد',
});

/** مفتاحُ المصدر — مستقرٌّ ومقروءٌ ويُستعمَل معرِّفًا للصفّ نفسِه. */
export const keyOf = (kind, id) => `${kind}:${id}`;

/* ------------------------------------------------------------------ *
 * قراءةُ المصادر الحيّة
 * ------------------------------------------------------------------ */

/**
 * يقرأ كلَّ المصادر القابلة للتحليل بنصوصها ومقاطعها.
 *
 * ⚠️ **والمحادثةُ مصدرٌ واحدٌ فيه أدوار** لا مصادرَ بعدد أدوارها —
 *    وإلّا صارت محادثةٌ من عشرين دورًا «عشرين موقفًا حقيقيًّا».
 */
export async function readLiveSources({ onProgress } = {}) {
  const [scriptRows, draftRows, convRows] = await Promise.all([
    scripts.getAll(), studyDrafts.getAll(), conversations.getAll(),
  ]);

  const alive = (rows) => rows.filter((row) => row.state !== STATE.TRASHED);
  const out = [];

  for (const row of alive(scriptRows)) {
    out.push({
      key: keyOf(SOURCE_KIND.SCRIPT, row.id),
      kind: SOURCE_KIND.SCRIPT,
      sourceId: row.id,
      title: row.title || '',
      language: row.language || 'ru',
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
      sceneId: row.sceneId || null,
      segments: [{ id: `${row.id}#0`, text: row.text || '', speaker: null, order: 0 }],
      text: row.text || '',
    });
  }

  for (const row of alive(draftRows)) {
    const text = row.text || row.content || '';
    out.push({
      key: keyOf(SOURCE_KIND.DRAFT, row.id),
      kind: SOURCE_KIND.DRAFT,
      sourceId: row.id,
      title: row.title || 'مسودّة',
      language: 'ru',
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
      sceneId: row.sceneId || null,
      segments: [{ id: `${row.id}#0`, text, speaker: null, order: 0 }],
      text,
    });
  }

  if (convRows.length) {
    const parts = await conversationParts.getAll();
    const byConv = new Map();
    for (const part of alive(parts)) {
      if (!byConv.has(part.conversationId)) byConv.set(part.conversationId, []);
      byConv.get(part.conversationId).push(part);
    }
    for (const row of alive(convRows)) {
      const mine = (byConv.get(row.id) || []).sort((a, b) => (a.order || 0) - (b.order || 0));
      out.push({
        key: keyOf(SOURCE_KIND.CONVERSATION, row.id),
        kind: SOURCE_KIND.CONVERSATION,
        sourceId: row.id,
        title: row.title || 'محادثة',
        language: 'ru',
        createdAt: row.createdAt ?? null,
        updatedAt: row.updatedAt ?? null,
        sceneId: row.sceneId || null,
        segments: mine.map((part, i) => ({
          id: `${part.id}`,
          text: part.text || '',
          /* ⚠️ اسمُ المتحدّث بيانٌ مصاحبٌ — ولا يدخل النصَّ المنطوق أبدًا. */
          speaker: part.speakerLabel || part.personId || null,
          order: part.order ?? i,
        })),
        text: mine.map((part) => part.text || '').join('\n'),
      });
    }
  }

  onProgress?.({ done: out.length, total: out.length });
  return out;
}

/* ------------------------------------------------------------------ *
 * المزامنةُ بين الواقع والسجلّ
 * ------------------------------------------------------------------ */

/**
 * يمسح المصادرَ ويحدّث بصماتِها — **ولا يغيّر تصنيفًا اخترتَه**.
 *
 * ⚠️ **والصفُّ الجديدُ يدخل `unknown` صراحةً** (القرارُ في ترويسة
 *    `provenance.js`): لا نعرف منشأَ ما كُتب قبل اليوم، ولا نخمّنه.
 *
 * @param {{onProgress?: Function}} options
 */
export async function scanSources({ onProgress } = {}) {
  const live = await readLiveSources();
  const known = await memorySources.getAll();
  const byKey = new Map(known.map((row) => [row.id, row]));

  const seen = new Set();
  let added = 0;
  let changed = 0;
  let unchanged = 0;
  let done = 0;

  for (const source of live) {
    seen.add(source.key);
    /* eslint-disable-next-line no-await-in-loop -- بصمةٌ بعد بصمة */
    const contentHash = await hashText(source.text);
    const existing = byKey.get(source.key);
    done += 1;
    onProgress?.({ done, total: live.length, title: source.title });

    if (!existing) {
      /* eslint-disable-next-line no-await-in-loop */
      await memorySources.create({
        id: source.key,
        sourceKind: source.kind,
        sourceId: source.sourceId,
        title: source.title,
        language: source.language,
        chars: source.text.length,
        contentHash,
        analyzedHash: null,
        analyzedAt: null,
        /* ⚠️ لا تخمين — راجع ترويسة `provenance.js`. */
        evidenceClass: EVIDENCE.UNKNOWN,
        originType: ORIGIN.UNKNOWN,
        derivedFrom: [],
        excluded: 0,
        missing: 0,
      });
      added += 1;
      continue;
    }

    const moved = existing.contentHash !== contentHash
      || existing.title !== source.title
      || existing.missing === 1;
    if (moved) {
      /* eslint-disable-next-line no-await-in-loop */
      await memorySources.update(existing.id, {
        contentHash,
        title: source.title,
        chars: source.text.length,
        /* ⚠️ وعاد بعد غياب: يُرفَع علمُ الفقد ولا يُمسّ تصنيفُه. */
        missing: 0,
      });
      if (existing.contentHash !== contentHash) changed += 1; else unchanged += 1;
    } else {
      unchanged += 1;
    }
  }

  /*
   * ⚠️ **والمحذوفُ يُعلَّم ولا يُمحى** (بند ٩): سطرُه يحمل تاريخَ تحليله،
   *    وهو ما تحتاجه شهادةُ الحذف (tombstone) لتُخرِج أدلّتَه من الحالة
   *    بلا إعادة تحليل الباقي.
   */
  let missing = 0;
  for (const row of known) {
    if (seen.has(row.id) || row.missing === 1) continue;
    /* eslint-disable-next-line no-await-in-loop */
    await memorySources.update(row.id, { missing: 1 });
    missing += 1;
  }

  return { total: live.length, added, changed, unchanged, missing };
}

/** حالةُ التحليل لصفٍّ — مشتقّةٌ لا مخزَّنة. */
export function stateOf(row) {
  if (!row) return ANALYSIS_STATE.NEVER;
  if (row.missing === 1) return ANALYSIS_STATE.DELETED;
  if (row.excluded === 1) return ANALYSIS_STATE.EXCLUDED;
  if (!row.analyzedHash) return ANALYSIS_STATE.NEVER;
  return row.analyzedHash === row.contentHash
    ? ANALYSIS_STATE.CURRENT
    : ANALYSIS_STATE.CHANGED;
}

/** كلُّ المصادر بحالتها — ما تقرؤه شاشةُ المراجعة. */
export async function listSources() {
  const rows = await memorySources.getAll();
  return rows
    .map((row) => ({ ...row, analysisState: stateOf(row) }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** ملخّصٌ يُعرَض قبل التصدير (بند ١٠). */
export async function registrySummary() {
  const rows = await listSources();
  const count = (fn) => rows.filter(fn).length;
  return {
    total: rows.length,
    primary: count((r) => r.evidenceClass === EVIDENCE.PRIMARY),
    derived: count((r) => r.evidenceClass === EVIDENCE.DERIVED),
    unknown: count((r) => r.evidenceClass === EVIDENCE.UNKNOWN),
    never: count((r) => r.analysisState === ANALYSIS_STATE.NEVER),
    current: count((r) => r.analysisState === ANALYSIS_STATE.CURRENT),
    changed: count((r) => r.analysisState === ANALYSIS_STATE.CHANGED),
    deleted: count((r) => r.analysisState === ANALYSIS_STATE.DELETED),
    excluded: count((r) => r.analysisState === ANALYSIS_STATE.EXCLUDED),
  };
}

/**
 * يصنّف مصدرًا — **الفعلُ الوحيدُ الذي يكتب منشأً**، وبيدك وحدَك.
 */
export async function classifySource(key, { evidenceClass, originType, derivedFrom }) {
  const patch = {};
  if (evidenceClass) patch.evidenceClass = evidenceClass;
  if (originType) patch.originType = originType;
  if (Array.isArray(derivedFrom)) patch.derivedFrom = derivedFrom.filter(Boolean);
  if (!Object.keys(patch).length) return null;
  return memorySources.update(key, patch);
}

/** يستبعد مصدرًا من التحليل أو يعيده. */
export const setExcluded = (key, excluded) =>
  memorySources.update(key, { excluded: excluded ? 1 : 0 });

/**
 * يسجّل أن مصادرَ حُلِّلت بنجاح — **بعد الالتزام لا قبله** (بند ٥ حرف G).
 *
 * ⚠️ **والبصمةُ المسجَّلةُ هي التي أُرسلت، لا التي في القاعدة الآن.**
 *    لو عدّلتَ النصَّ أثناء دورة التحليل ثم سجّلنا البصمةَ الحاليّة،
 *    لَبدا تعديلُك محلَّلًا وهو لم يُرسَل قطّ — ولَما طُلبت إعادةُ تحليله
 *    أبدًا. فالمُرسَلُ يُمرَّر صراحةً من الحزمة.
 */
export async function markAnalyzed(entries = []) {
  let written = 0;
  for (const { key, hash } of entries) {
    if (!key || !hash) continue;
    /* eslint-disable-next-line no-await-in-loop */
    const row = await memorySources.get(key);
    if (!row) continue;
    /* eslint-disable-next-line no-await-in-loop */
    await memorySources.update(key, { analyzedHash: hash, analyzedAt: Date.now() });
    written += 1;
  }
  return written;
}

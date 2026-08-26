/**
 * LingoLife — تصديرُ ذاكرة اللغة واستيرادُ الإثراء (WS-C، بنود ١٥…١٩ و٤٦ و٥٧…٥٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الحدُّ الذي لا يُعبَر: مَن يملك الواقعة
 * ═══════════════════════════════════════════════════════════════
 *
 * البندُ ١٧ يرسمه بحرفه:
 *
 *     الذكاءُ الخارجيُّ يجوز أن يقول: «هذه الكلمةُ إداريّةُ الطابع».
 *     ولا يجوز أن يقول: «قابلتَها يوم ٥ يونيو» ولا «تدرّبتَ عليها ٨ مرّات».
 *
 * والوقائعُ تأتي من مكانٍ واحد: ما سجّله التطبيقُ لحظةَ وقوعه. فالمستوردُ
 * هنا **لا يستطيع** أن يكتب واقعةً — لا لأننا نثق بأنه لن يفعل، بل لأن
 * `sanitize` تُسقط كلَّ حقلٍ خارج قائمة الإثراء المسموحة، ويفحص ذلك
 * اختبارٌ دائم.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والتصديرُ عرضٌ مُشتقٌّ لا نسخةٌ ثانيةٌ من القاعدة (بند ١٥)
 * ═══════════════════════════════════════════════════════════════
 *
 * النسخةُ الاحتياطيّةُ الكاملةُ موجودةٌ منذ WS0 وتصدّر كلَّ شيء. وهذا
 * التصديرُ **وثيقةٌ للقراءة الخارجيّة**: كياناتٌ وأعدادٌ وأخطاءٌ بلا
 * بايتاتٍ ولا صورٍ ولا صوت. وتوليدُه من المخازن المُطبَّعة أصدقُ من
 * حفظه: لا يتقادم، ولا يحتاج مزامنةً مع ما اشتُقّ منه.
 */

import { canonical, ORIGIN } from './identity.js';
import { memoryOverview, searchMemory, entityMemory } from './memory-service.js';
import { listErrors, groupByPattern } from './errors.js';

/** صيغةُ التبادل — مُصدَّرةٌ لأن الاختبارَ والمستوردَ يقرآنها. */
export const FORMAT = 'living-language-memory';
export const FORMAT_VERSION = 1;

/**
 * حقولُ الإثراء المسموحة — **قائمةُ سماحٍ لا قائمةُ منع** (بند ١٧).
 *
 * ⚠️ **والفرقُ حاسم**: قائمةُ المنع تنسى ما لم يُخترَع بعد، فحقلٌ جديدٌ
 *    في ملفٍّ مستورَدٍ يمرّ لأن أحدًا لم يمنعه. وقائمةُ السماح تُسقط
 *    كلَّ ما ليس فيها — فما لم يُذكَر هنا **لا يدخل**، اليوم وبعد سنة.
 */
export const ENRICHMENT_FIELDS = Object.freeze([
  'register',
  'domain',
  'usageNote',
  'explanation',
  'relatedForms',
  'confidenceNote',
]);

/**
 * حقولٌ لا يملكها الاستيرادُ أبدًا — تُذكَر صراحةً ليقرأها الإنسانُ
 * والاختبارُ معًا.
 */
export const FORBIDDEN_FIELDS = Object.freeze([
  'positions', 'sources', 'captures', 'practices', 'errors',
  'firstSeen', 'lastSeen', 'occurredAt', 'practicedAt', 'createdAt',
  'wrong', 'natural', 'saved', 'tagIds', 'note',
]);

/**
 * يبني وثيقةَ ذاكرة اللغة.
 *
 * @param {{ limit?: number, includeSources?: boolean }} options
 */
export async function buildMemoryExport({ limit = 500, includeSources = true } = {}) {
  const [overview, entities, errorRows] = await Promise.all([
    memoryOverview({ limit: 30 }),
    searchMemory('', { limit }),
    listErrors({ limit: 500 }),
  ]);

  const patterns = groupByPattern(errorRows);

  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    generatedAt: Date.now(),
    /*
     * ⚠️ **قسمان منفصلان لا قسمٌ واحد** (بند ١٧): `observed` ما لاحظه
     *    التطبيق، و`enrichment` ما يُسمَح للتحليل الخارجيّ أن يملأه.
     *    والفصلُ في **بنية الملفّ** لا في تعليقٍ يُقرأ ويُنسى.
     */
    observed: {
      overview,
      entities: entities.map((one) => ({
        canonical: one.canonical,
        surface: one.surface,
        kind: one.kind,
        status: one.status,
        counts: {
          positions: one.positions,
          sources: one.sources,
          practices: one.practised,
          errors: one.errors,
        },
        saved: one.saved,
        ...(includeSources ? {} : {}),
      })),
      errors: patterns.map((group) => ({
        patternKey: group.patternKey,
        wrong: group.wrong,
        correct: group.natural,
        type: group.mistakeType,
        times: group.times,
        firstAt: group.firstAt,
        lastAt: group.lastAt,
      })),
    },
    /* يُملأ خارجًا ثم يعود — فارغٌ عند التصدير. */
    enrichment: { entities: [], errors: [] },
  };
}

/**
 * يقرأ ملفًّا مستورَدًا ويصفّيه — **ولا يكتب شيئًا** (بند ١٨).
 *
 * ⚠️ **والفحصُ قبل العرض، والعرضُ قبل الالتزام.** ثلاثُ خطواتٍ لا
 *    واحدة: `parseEnrichment` تصفّي، والشاشةُ تعرض، و`applyEnrichment`
 *    تكتب بعد ضغطتك.
 *
 * @returns {{ok: boolean, error?: string, entities: object[], errors: object[],
 *            dropped: string[], unknown: string[]}}
 */
export function parseEnrichment(raw, { knownCanonicals = null } = {}) {
  let doc = raw;
  if (typeof raw === 'string') {
    try { doc = JSON.parse(raw); } catch { return fail('الملفّ مش JSON صالح'); }
  }
  if (!doc || typeof doc !== 'object') return fail('الملفّ فاضي');
  if (doc.format !== FORMAT) return fail(`مش ملفّ ${FORMAT}`);
  if (Number(doc.version) !== FORMAT_VERSION) {
    return fail(`إصدار ${doc.version} — المعروف ${FORMAT_VERSION}`);
  }

  const dropped = new Set();
  const unknown = [];

  const entities = (doc.enrichment?.entities || [])
    .map((one) => {
      const key = canonical(one?.canonical || one?.text || '');
      if (!key) return null;
      /* ⚠️ كيانٌ لا نعرفه يُعلَن ولا يُخلَق (بند ١٨). */
      if (knownCanonicals && !knownCanonicals.has(key)) { unknown.push(key); return null; }
      return { canonical: key, ...sanitize(one, dropped) };
    })
    .filter(Boolean);

  const errors = (doc.enrichment?.errors || [])
    .map((one) => {
      const key = String(one?.patternKey || '').trim();
      if (!key) return null;
      return { patternKey: key, ...sanitize(one, dropped) };
    })
    .filter(Boolean);

  return { ok: true, entities, errors, dropped: [...dropped], unknown: [...new Set(unknown)] };
}

function fail(error) {
  return { ok: false, error, entities: [], errors: [], dropped: [], unknown: [] };
}

/**
 * يُبقي حقولَ الإثراء وحدَها.
 *
 * ⚠️ **وما يُسقَط يُبلَّغ به** (بند ١٨): ملفٌّ يحاول كتابةَ `firstSeen`
 *    لا يُرفَض صامتًا — يُقال لك إن هذا الحقلَ أُسقِط. فتعرف أن التحليلَ
 *    الخارجيَّ تجاوز حدَّه، ولا تكتشفه بعد شهر.
 */
function sanitize(one, dropped) {
  const out = {};
  for (const [field, value] of Object.entries(one || {})) {
    if (field === 'canonical' || field === 'patternKey' || field === 'text') continue;
    if (ENRICHMENT_FIELDS.includes(field)) out[field] = value;
    else dropped.add(field);
  }
  return out;
}

/**
 * يوازن المستورَدَ بما هو مكتوب — **قبل** أن يُكتَب شيء (بند ١٨).
 *
 * @returns {{added: object[], changed: object[], conflicts: object[]}}
 */
export async function planEnrichment(parsed, { readCurrent }) {
  const added = [];
  const changed = [];
  const conflicts = [];

  for (const one of parsed.entities) {
    /* eslint-disable-next-line no-await-in-loop -- كيانٌ بعد كيان */
    const current = await readCurrent(one.canonical);
    const previous = current?.enrichment || null;
    if (!previous) { added.push(one); continue; }

    const diffs = Object.keys(one).filter(
      (field) => field !== 'canonical' && previous[field] !== undefined && previous[field] !== one[field]
    );
    /*
     * ⚠️ **وما كتبتَه بيدك يفوز** (بند ٤٦): تعارضٌ على حقلٍ مصدرُه
     *    `USER` يُعرَض تعارضًا ولا يُطبَّق. والإثراءُ لا يدهس ملاحظتَك
     *    ولا تصنيفك ولا تاريخَك — أبدًا.
     */
    if (diffs.length && previous.origin === ORIGIN.USER) conflicts.push({ ...one, diffs });
    else if (diffs.length) changed.push({ ...one, diffs });
  }

  return { added, changed, conflicts };
}

/**
 * يكتب الإثراءَ المقبول — **مؤشَّرًا بمصدره** (بند ٤٧).
 *
 * ⚠️ **وحتميُّ التكرار** (بند ١٩): الكتابةُ استبدالٌ بمفتاحِ الكيان لا
 *    إضافة. فاستيرادُ نفس الملفّ مرّتين يعطي نفسَ النتيجة بالضبط: لا
 *    كياناتٌ مضاعَفة ولا وقائعُ مكرّرة — ولا وقائعَ أصلًا، فالإثراءُ
 *    لا يملكها.
 */
export async function applyEnrichment(plan, { writeEnrichment }) {
  let written = 0;
  for (const one of [...plan.added, ...plan.changed]) {
    /* eslint-disable-next-line no-await-in-loop -- كتابةٌ بعد كتابة */
    await writeEnrichment(one.canonical, {
      ...stripMeta(one),
      origin: ORIGIN.AI_IMPORT,
      importedAt: Date.now(),
    });
    written += 1;
  }
  return { written, skipped: plan.conflicts.length };
}

function stripMeta(one) {
  const { canonical: _c, diffs: _d, ...rest } = one;
  return rest;
}

/** قالبُ التحليل الخارجيّ — نصٌّ يُنسَخ، ولا يُنادى منه ذكاءٌ أبدًا (بند ٥٨). */
export function analysisPrompt() {
  return [
    'أنت محلّلٌ لغويٌّ روسيّ. أُعطيك وثيقةَ ذاكرة لغة بصيغة',
    `\`${FORMAT}\` إصدار ${FORMAT_VERSION}.`,
    '',
    'اقرأ قسم `observed` — وهو **وقائع** سجّلها التطبيق. لا تعدّله.',
    'واملأ قسم `enrichment` وحدَه.',
    '',
    'مسموحٌ لك في كلّ كيان:',
    ENRICHMENT_FIELDS.map((f) => `  · ${f}`).join('\n'),
    '',
    'ممنوعٌ منعًا باتًّا:',
    '  · اختراعُ تواريخ أو أعدادِ ظهورٍ أو تدريب',
    '  · تعديلُ `wrong` أو `correct` في الأخطاء',
    '  · حذفُ أيّ شيءٍ من `observed`',
    '  · تغييرُ `canonical` أو `patternKey` — هي المفاتيح',
    '',
    'إن لم تكن واثقًا، اكتب ذلك في `confidenceNote` ولا تخمّن.',
    'أعِد **JSON صارمًا** بنفس البنية، والقسمُ `observed` كما أعطيتُك حرفيًّا.',
  ].join('\n');
}

export { entityMemory };

/**
 * LingoLife — ذاكرةُ اللغة الحيّة (WS-C)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما تحرسه — والبندُ ٦٦ يقول ما لا يكفي
 * ═══════════════════════════════════════════════════════════════
 *
 * > «Avoid flattering tests like: dashboard contains the word encounters.»
 *
 * فالمحروسُ هنا **سلوكُ النموذج** لا نصُّ الشاشة:
 *
 *  · هُويّةُ الكيان: النبرُ والحرفُ الكبيرُ والترقيمُ لا تصنع كياناتٍ ثانية.
 *  · هُويّةُ الموضع: تكرارُ الكلمة في الجملة موضعان، وإعادةُ الفهرسة
 *    ليست ظهورًا جديدًا، ونفسُ الجملة في مصدرين ظهوران.
 *  · الحدثُ يُضاف ولا يدهس: التصحيحُ لا يمحو الغلطة.
 *  · الاستيرادُ لا يملك واقعةً، ولا يدهس ما كتبتَه، ولا يتضاعف.
 *  · لا تاريخَ مخترَعٌ لما لا واقعةَ مؤرَّخةً له.
 */

import { describe, it, expect } from './test-runner.js';
import { normalize } from '../js/utils/normalization.js';
import {
  ENTITY_KIND, SOURCE_KIND, ORIGIN,
  canonical, trackable, sourceKey, occurrenceId, patternKey, wordPositions,
} from '../js/services/memory/identity.js';
import { rowsForSource, indexSource, rebuildIndex, forgetSource, indexStats }
  from '../js/services/memory/indexer.js';
import {
  flagsForWords, entityMemory, memoryOverview, searchMemory,
  statusOf, markFor, MEMORY_STATUS, RECURRENT_SOURCES,
} from '../js/services/memory/memory-service.js';
import {
  recordError, listErrors, groupByPattern, patternState,
  PATTERN_STATE, ERROR_TYPE_LABEL,
} from '../js/services/memory/errors.js';
import {
  FORMAT, FORMAT_VERSION, ENRICHMENT_FIELDS,
  buildMemoryExport, parseEnrichment, planEnrichment, applyEnrichment, analysisPrompt,
} from '../js/services/memory/exchange.js';
import { memoryOccurrences, mistakeComparisons, scripts, savedItems } from '../js/db/repositories.js';
import { STATE, STORES } from '../js/db/schema.js';
import { TARGET_VERSION } from '../js/db/migrations.js';
import { splitWords } from '../js/services/shadow/segmenter.js';

const TAG = `WSC-${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------------ *
 * الهُويّة — حسابٌ خالص
 * ------------------------------------------------------------------ */

describe('WS-C · هُويّةُ الكيان', () => {
  it('١ · ⚠️ علامةُ النبر لا تصنع كيانًا ثانيًا (بند ٥٣)', () => {
    /*
     * العطبُ الحقيقيّ: الرقائقُ تُرسَم **معلَّمةً** (WS52)، فكلمةٌ
     * تلمسها هناك تصل بعلامةٍ فوقها. ولو كانت العلامةُ تفرّق لصارت
     * «согласова́ние» كيانًا لا يعرف تاريخَ «согласование».
     */
    expect(canonical('согласова́ние')).toBe(canonical('согласование'));
    expect(canonical('Согласова́ние!')).toBe('согласование');
  });

  it('٢ · والحرفُ الكبيرُ والترقيمُ و«ё» كذلك', () => {
    expect(canonical('Документ')).toBe(canonical('документ'));
    expect(canonical('документ,')).toBe(canonical('документ'));
    expect(canonical('ещё')).toBe(canonical('еще'));
  });

  it('٣ · ⚠️ ولا يُدمَج تصريفان — لا محلّلَ صرفيًّا يبرّر ذلك (بندا ٤ و٦٨)', () => {
    /*
     * «заполнен» و«заполнена» فعلٌ واحدٌ لغويًّا. ولا نملك ما يُثبت
     * ذلك آليًّا، فلا نجمعهما — والصمتُ أصدقُ من دمجٍ مخترَع.
     */
    expect(canonical('заполнен') === canonical('заполнена')).toBe(false);
    expect(canonical('идти') === canonical('шёл')).toBe(false);
  });

  it('٤ · ⚠️ ولا يُشتقّ كلُّ ثنائيٍّ من كلّ جملة (بند ٣)', () => {
    /* الكلمةُ كلمةٌ واحدة؛ وما فيه مسافةٌ ليس كلمة. */
    expect(trackable('согласование', ENTITY_KIND.WORD)).toBe(true);
    expect(trackable('на согласование', ENTITY_KIND.WORD)).toBe(false);
    expect(trackable('на согласование', ENTITY_KIND.PHRASE)).toBe(true);
    expect(trackable('   ', ENTITY_KIND.WORD)).toBe(false);
  });

  it('٥ · ومفتاحُ المصدر يفرّق بين مصدرين (بند ٣٤)', () => {
    expect(sourceKey(SOURCE_KIND.SCRIPT, 'A')).toBe('script:A');
    expect(sourceKey(SOURCE_KIND.SCRIPT, 'A') === sourceKey(SOURCE_KIND.SCRIPT, 'B')).toBe(false);
    /* ونوعان مختلفان بنفس المعرِّف ليسا واحدًا. */
    expect(sourceKey(SOURCE_KIND.DRAFT, 'A') === sourceKey(SOURCE_KIND.SCRIPT, 'A')).toBe(false);
  });

  it('٦ · ⚠️ وبصمةُ الموضع تجعل إعادةَ الفهرسة لا تُضاعف (بند ٣٤)', () => {
    const one = { canonical: 'док', sourceKey: 'script:A', sentenceIndex: 0, wordIndex: 2 };
    expect(occurrenceId(one)).toBe(occurrenceId({ ...one }));
    /* وموضعان في نفس الجملة بصمتان. */
    expect(occurrenceId(one) === occurrenceId({ ...one, wordIndex: 3 })).toBe(false);
  });

  it('٧ · ومواضعُ الكلمات تحفظ الصورةَ كما كُتبت (بند ٤)', () => {
    const out = wordPositions('Документ уже полностью заполнен.', splitWords);
    expect(out).toHaveLength(4);
    expect(out[0].surface).toBe('Документ');
    expect(out[0].canonical).toBe('документ');
    /* ⚠️ الصورةُ لا تُشتقّ من المفتاح — الحرفُ الكبيرُ باقٍ. */
    expect(out[0].surface === out[0].canonical).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * الفهرس — دالّةٌ خالصةٌ أوّلًا
 * ------------------------------------------------------------------ */

describe('WS-C · فهرسُ المواضع', () => {
  it('٨ · ⚠️ الكلمةُ المكرّرةُ في جملةٍ موضعان لا موضع (بند ٣٤)', () => {
    const rows = rowsForSource({
      kind: SOURCE_KIND.SCRIPT, id: 'S1', text: 'Это очень очень важно сегодня.',
    });
    const ochen = rows.filter((row) => row.canonical === 'очень');
    expect(ochen).toHaveLength(2);
    expect(ochen[0].wordIndex === ochen[1].wordIndex).toBe(false);
    /* وبصمتاهما مختلفتان، فلا تدهس إحداهما الأخرى. */
    expect(ochen[0].id === ochen[1].id).toBe(false);
  });

  it('٩ · ⚠️ ونفسُ الجملة في مصدرين ظهوران لا واحد (بند ٣٤)', () => {
    const text = 'Документ направили на согласование.';
    const a = rowsForSource({ kind: SOURCE_KIND.SCRIPT, id: 'A', text });
    const b = rowsForSource({ kind: SOURCE_KIND.SCRIPT, id: 'B', text });
    const key = 'согласование';
    expect(a.find((r) => r.canonical === key).id === b.find((r) => r.canonical === key).id)
      .toBe(false);
  });

  it('١٠ · وكلُّ صفٍّ يعرف موضعَه بدقّة (بند ٥)', () => {
    const rows = rowsForSource({
      kind: SOURCE_KIND.SCRIPT, id: 'S2', title: 'اجتماع',
      text: 'Первое предложение здесь. Документ направили на согласование.',
      sceneId: 'SCN_1',
    });
    const hit = rows.find((row) => row.canonical === 'согласование');
    expect(hit.sentenceIndex).toBe(1);
    expect(hit.wordIndex).toBe(3);
    expect(hit.sourceTitle).toBe('اجتماع');
    expect(hit.sceneId).toBe('SCN_1');
    /* والجملةُ المحيطةُ معه — «أرِني السياق» بلا فتح المصدر (بند ٣٠). */
    expect(hit.sentence).toContain('согласование');
  });

  it('١١ · ⚠️ ولا تاريخَ شخصيًّا في صفوف الفهرس (بندا ٦٧ و٢٩)', () => {
    /*
     * وجودُ الكلمة في نصّك واقعةٌ عن **النصّ**. ومتى قرأتَه أنت شيءٌ
     * لا يعرفه التطبيق — فلا حقلَ هنا يدّعي معرفتَه.
     */
    const [row] = rowsForSource({ kind: SOURCE_KIND.SCRIPT, id: 'S3', text: 'Документ готов.' });
    for (const banned of ['occurredAt', 'firstSeen', 'lastSeen', 'seenAt', 'encounteredAt']) {
      expect(`${banned}:${banned in row}`).toBe(`${banned}:false`);
    }
  });
});

/* ------------------------------------------------------------------ *
 * الفهرس في القاعدة
 * ------------------------------------------------------------------ */

describe('WS-C · الفهرس في القاعدة', () => {
  const SRC = { kind: SOURCE_KIND.SCRIPT, id: `${TAG}-A`, title: 'أ', text: 'Документ направили на согласование.' };

  it('١٢ · ⚠️ وإعادةُ الفهرسة لا تُضاعف صفًّا واحدًا (بندا ١٩ و٥٦)', async () => {
    await indexSource(SRC);
    const first = (await memoryOccurrences.byIndex('sourceKey', sourceKey(SRC.kind, SRC.id))).length;
    expect(first > 0).toBe(true);

    await indexSource(SRC);
    const second = (await memoryOccurrences.byIndex('sourceKey', sourceKey(SRC.kind, SRC.id))).length;
    expect(`second:${second}`).toBe(`second:${first}`);

    await forgetSource(SRC.kind, SRC.id);
  });

  it('١٣ · وحذفُ مصدرٍ يُسقط مواضعَه وحدَها (بند ٤٥)', async () => {
    const other = { ...SRC, id: `${TAG}-B`, text: 'Другое предложение полностью здесь.' };
    await indexSource(SRC);
    await indexSource(other);

    await forgetSource(SRC.kind, SRC.id);
    expect(await memoryOccurrences.byIndex('sourceKey', sourceKey(SRC.kind, SRC.id))).toHaveLength(0);
    /* والآخرُ لم يُمَسّ. */
    expect((await memoryOccurrences.byIndex('sourceKey', sourceKey(other.kind, other.id))).length > 0)
      .toBe(true);

    await forgetSource(other.kind, other.id);
  });

  it('١٤ · ⚠️ وإعادةُ البناء لا تلمس تاريخَك الشخصيّ (بند ٥٦)', async () => {
    const src = await (await fetch('../js/services/memory/indexer.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    for (const banned of ['savedItems', 'practiceEvidence', 'mistakeComparisons']) {
      expect(`${banned}:${code.includes(banned)}`).toBe(`${banned}:false`);
    }
  });
});

/* ------------------------------------------------------------------ *
 * ذاكرةُ الخطأ
 * ------------------------------------------------------------------ */

describe('WS-C · ذاكرةُ الخطأ', () => {
  const mine = async () => (await listErrors({ limit: 500 }))
    .filter((row) => (row.explanation || '').startsWith(TAG));

  it('١٥ · ⚠️ الصورتان تعيشان معًا — التصحيحُ لا يمحو الغلطة (بندا ١٠ و٧١)', async () => {
    const row = await recordError({
      wrong: 'Я связался с заказчик.',
      correct: 'Я связался с заказчиком.',
      type: 'case',
      note: `${TAG} أوّل`,
    });
    expect(row.wrong).toBe('Я связался с заказчик.');
    expect(row.natural).toBe('Я связался с заказчиком.');
    /* ⚠️ ولا حقلَ واحدًا يحمل الاثنين — صفٌّ يحتفظ بالنسختين. */
    expect(row.wrong === row.natural).toBe(false);
    expect(Number.isFinite(row.occurredAt)).toBe(true);
  });

  it('١٦ · ⚠️ ولا تُستنتَج الصورةُ الخاطئة أبدًا (بند ٣٦)', async () => {
    await expect(recordError({ wrong: '', correct: 'Я связался с заказчиком.' })).toReject();
    await expect(recordError({ wrong: 'شيء', correct: '' })).toReject();
  });

  it('١٧ · ⚠️ وتكرارُ الغلطة صفٌّ ثانٍ لا عدّادٌ يُزاد (بندا ١٢ و٣٩)', async () => {
    await recordError({
      wrong: 'Я связался с заказчик.',
      correct: 'Я связался с заказчиком.',
      type: 'case',
      note: `${TAG} تاني`,
    });

    const rows = await mine();
    const groups = groupByPattern(rows);
    const group = groups.find((g) => g.patternKey === patternKey(
      'Я связался с заказчик.', 'Я связался с заказчиком.'
    ));
    expect(group.times).toBe(2);
    /* ⚠️ والحدثان يبقيان مفردَين — التقدّمُ يُرى ولا يُمحى (بند ٣٩). */
    expect(group.events).toHaveLength(2);
    expect(group.events[0].id === group.events[1].id).toBe(false);
    expect(group.firstAt <= group.lastAt).toBe(true);
  });

  it('١٨ · ⚠️ ولا تُجمَع غلطتان لمجرّد تشابه حروفهما (بند ١٢)', async () => {
    await recordError({
      wrong: 'Я связался с клиент.',
      correct: 'Я связался с клиентом.',
      type: 'case',
      note: `${TAG} تالت`,
    });
    const groups = groupByPattern(await mine());
    /*
     * القاعدةُ النحويّةُ واحدة (آلةٌ بعد «с»)، والتطبيقُ لا يعرف ذلك.
     * فنمطان لا نمطٌ واحد — وبند ٦٨ يمنع ادّعاءَ المعرفة.
     */
    expect(groups).toHaveLength(2);
  });

  it('١٩ · وحالةُ النمط مسمّاةٌ ولا تدّعي «أتقنتَها» (بند ٣٩)', () => {
    const once = { times: 1, lastAt: Date.now() };
    const twice = { times: 2, lastAt: Date.now() };
    const old = { times: 3, lastAt: Date.now() - 200 * 24 * 3600 * 1000 };
    expect(patternState(once)).toBe(PATTERN_STATE.ONCE);
    expect(patternState(twice)).toBe(PATTERN_STATE.REPEATED);
    expect(patternState(old)).toBe(PATTERN_STATE.QUIET);
    expect(Object.values(PATTERN_STATE).includes('mastered')).toBe(false);
  });

  it('٢٠ · وأنواعُ WS5 القديمةُ تبقى مقروءة', () => {
    expect(ERROR_TYPE_LABEL.grammar).toBe('قواعد');
    expect(ERROR_TYPE_LABEL.natural).toBe('صياغة غير طبيعية');
    expect(ERROR_TYPE_LABEL.other).toBe('غير محدَّد');
  });

  it('٢١ · ⚠️ والواقعةُ منك — لا من استيراد (بند ١٧)', async () => {
    const rows = await mine();
    for (const row of rows) expect(row.origin).toBe(ORIGIN.USER);
  });
});

/* ------------------------------------------------------------------ *
 * القراءة والعدّ
 * ------------------------------------------------------------------ */

describe('WS-C · الأعدادُ مسمّاةٌ لا مبهمة', () => {
  it('٢٢ · ⚠️ أربعةُ أعدادٍ مختلفةٍ لا «تكرار» واحد (بند ٨)', async () => {
    const src = { kind: SOURCE_KIND.SCRIPT, id: `${TAG}-C`, title: 'ج', text: 'Документ направили на согласование.' };
    await indexSource(src);
    const memory = await entityMemory('согласование');
    for (const field of ['positions', 'sources', 'captures', 'practices', 'errors']) {
      expect(`${field}:${typeof memory.counts[field]}`).toBe(`${field}:number`);
    }
    /* ⚠️ ولا حقلَ اسمُه `frequency` — البندُ يمنعه بالاسم. */
    expect('frequency' in memory.counts).toBe(false);
    await forgetSource(src.kind, src.id);
  });

  it('٢٣ · ⚠️ وقراءةُ الجملة مرّتين لا تزيد المواضع (بند ٨)', async () => {
    const src = { kind: SOURCE_KIND.SCRIPT, id: `${TAG}-D`, text: 'Документ направили на согласование.' };
    await indexSource(src);
    const first = (await entityMemory('согласование')).counts.positions;
    /* «فتحُ الجملة» في التطبيق قراءةٌ لا كتابة — ونحاكيه بقراءتين. */
    await entityMemory('согласование');
    await entityMemory('согласование');
    const after = (await entityMemory('согласование')).counts.positions;
    expect(`positions:${after}`).toBe(`positions:${first}`);
    await forgetSource(src.kind, src.id);
  });

  it('٢٤ · ⚠️ ولا تاريخَ لما لا واقعةَ مؤرَّخةً له (بندا ٢٩ و٦٧)', async () => {
    const src = { kind: SOURCE_KIND.SCRIPT, id: `${TAG}-E`, text: 'Совершенно новое незнакомое предложение.' };
    await indexSource(src);
    const memory = await entityMemory('незнакомое');
    /* موجودةٌ في نصّك — ولا نعرف متى قرأتَها. */
    expect(memory.counts.positions > 0).toBe(true);
    expect(memory.firstSeen).toBe(null);
    expect(memory.lastSeen).toBe(null);
    await forgetSource(src.kind, src.id);
  });

  it('٢٥ · والحالةُ تُشتقّ من وقائعَ صريحةٍ لا من درجة (بند ٩)', () => {
    expect(statusOf({ positions: 1, sources: 1 })).toBe(MEMORY_STATUS.NEW);
    expect(statusOf({ positions: 3, sources: 2 })).toBe(MEMORY_STATUS.SEEN_AGAIN);
    expect(statusOf({ saved: true })).toBe(MEMORY_STATUS.SAVED);
    expect(statusOf({ practised: 2 })).toBe(MEMORY_STATUS.PRACTISED);
    expect(statusOf({ errors: 1 })).toBe(MEMORY_STATUS.ERROR_HISTORY);
  });

  it('٢٦ · ⚠️ وعلامةٌ واحدةٌ على الرقاقة لا خمس (بندا ٢٣ و٦٣)', () => {
    /* الغلطةُ أوّلًا، ثم المحفوظة، ثم المتكرّرة. */
    expect(markFor({ errors: 1, saved: true, sources: 9 })).toBe('error');
    expect(markFor({ errors: 0, saved: true, sources: 9 })).toBe('saved');
    expect(markFor({ errors: 0, saved: false, sources: RECURRENT_SOURCES })).toBe('recurrent');
    /* ⚠️ والتكرارُ ليس أهمّيّة: مصدرٌ واحدٌ مهما تكرّر فيه لا يُعلَّم. */
    expect(markFor({ errors: 0, saved: false, sources: 1, positions: 40 })).toBe(null);
  });
});

/* ------------------------------------------------------------------ *
 * البحثُ الدفعيّ — بند ٤٢
 * ------------------------------------------------------------------ */

describe('WS-C · البحثُ الدفعيّ', () => {
  it('٢٧ · ⚠️ جملةٌ كاملةٌ في نداءٍ واحدٍ لا نداءً لكلّ رقاقة (بند ٤٢)', async () => {
    const src = {
      kind: SOURCE_KIND.SCRIPT, id: `${TAG}-F`,
      text: 'Документ направили на согласование сегодня утром.',
    };
    await indexSource(src);

    const words = ['Документ', 'направили', 'на', 'согласование', 'сегодня', 'утром'];
    const flags = await flagsForWords(words);
    expect(flags.size).toBe(6);
    expect(flags.get('согласование').positions > 0).toBe(true);
    /* ⚠️ والمفتاحُ مطبَّعٌ — «Документ» تجد «документ». */
    expect(flags.get('документ').positions > 0).toBe(true);

    await forgetSource(src.kind, src.id);
  });

  it('٢٨ · ⚠️ والدالّةُ تُستدعى بقائمةٍ لا بكلمة — يحرسه توقيعُها', async () => {
    const src = await (await fetch('../js/services/memory/memory-service.js')).text();
    expect(src.includes('export async function flagsForWords(texts)')).toBe(true);
    /* وقائمةٌ فارغةٌ لا تسأل القاعدةَ أصلًا. */
    expect((await flagsForWords([])).size).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * التبادل مع التحليل الخارجيّ
 * ------------------------------------------------------------------ */

describe('WS-C · حدُّ الإثراء الخارجيّ', () => {
  it('٢٩ · الوثيقةُ موسومةٌ بصيغتها وإصدارها (بند ٥٧)', async () => {
    const doc = await buildMemoryExport({ limit: 10 });
    expect(doc.format).toBe(FORMAT);
    expect(doc.version).toBe(FORMAT_VERSION);
    /* ⚠️ وقسمان منفصلان — المُلاحَظُ والمُثرى (بند ١٧). */
    expect(typeof doc.observed).toBe('object');
    expect(typeof doc.enrichment).toBe('object');
    expect(doc.enrichment.entities).toHaveLength(0);
  });

  it('٣٠ · ⚠️ والاستيرادُ لا يستطيع كتابةَ واقعة (بندا ١٧ و٥٣)', () => {
    const evil = {
      format: FORMAT, version: FORMAT_VERSION,
      enrichment: {
        entities: [{
          canonical: 'согласование',
          register: 'formal',
          /* محاولاتُ اختلاقِ تاريخ — كلُّها تُسقَط. */
          firstSeen: 1700000000000,
          positions: 99,
          practices: 8,
          saved: true,
          note: 'ملاحظتي المزوَّرة',
        }],
      },
    };
    const parsed = parseEnrichment(evil);
    expect(parsed.ok).toBe(true);
    const one = parsed.entities[0];
    expect(one.register).toBe('formal');
    for (const banned of ['firstSeen', 'positions', 'practices', 'saved', 'note']) {
      expect(`${banned}:${banned in one}`).toBe(`${banned}:false`);
    }
    /* ⚠️ وما أُسقِط يُبلَّغ به — لا رفضٌ صامت (بند ١٨). */
    expect(parsed.dropped).toContain('firstSeen');
    expect(parsed.dropped).toContain('note');
  });

  it('٣١ · وكيانٌ مجهولٌ يُعلَن ولا يُخلَق (بند ١٨)', () => {
    const doc = {
      format: FORMAT, version: FORMAT_VERSION,
      enrichment: { entities: [{ canonical: 'неизвестное', register: 'formal' }] },
    };
    const parsed = parseEnrichment(doc, { knownCanonicals: new Set(['согласование']) });
    expect(parsed.entities).toHaveLength(0);
    expect(parsed.unknown).toContain('неизвестное');
  });

  it('٣٢ · وملفٌّ بصيغةٍ أو إصدارٍ غريبٍ يُرفَض بوضوح', () => {
    expect(parseEnrichment('{}').ok).toBe(false);
    expect(parseEnrichment('لا JSON').ok).toBe(false);
    expect(parseEnrichment({ format: FORMAT, version: 99 }).ok).toBe(false);
  });

  it('٣٣ · ⚠️ والاستيرادُ مرّتين لا يُضاعف شيئًا (بند ١٩)', async () => {
    const doc = {
      format: FORMAT, version: FORMAT_VERSION,
      enrichment: { entities: [{ canonical: 'согласование', register: 'formal', domain: 'admin' }] },
    };
    const store = new Map();
    const readCurrent = async (key) => ({ enrichment: store.get(key) || null });
    const writeEnrichment = async (key, value) => store.set(key, value);

    for (let i = 0; i < 2; i += 1) {
      /* eslint-disable-next-line no-await-in-loop -- تسلسلٌ مقصود */
      const plan = await planEnrichment(parseEnrichment(doc), { readCurrent });
      /* eslint-disable-next-line no-await-in-loop */
      await applyEnrichment(plan, { writeEnrichment });
    }
    expect(store.size).toBe(1);
    expect(store.get('согласование').register).toBe('formal');
    expect(store.get('согласование').origin).toBe(ORIGIN.AI_IMPORT);
  });

  it('٣٤ · ⚠️ ولا يدهس ما كتبتَه بيدك (بند ٤٦)', async () => {
    const doc = {
      format: FORMAT, version: FORMAT_VERSION,
      enrichment: { entities: [{ canonical: 'согласование', register: 'casual' }] },
    };
    const store = new Map([['согласование', { register: 'formal', origin: ORIGIN.USER }]]);
    const plan = await planEnrichment(parseEnrichment(doc), {
      readCurrent: async (key) => ({ enrichment: store.get(key) || null }),
    });
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.changed).toHaveLength(0);

    await applyEnrichment(plan, { writeEnrichment: async (k, v) => store.set(k, v) });
    /* ⚠️ ما كتبتَه باقٍ كما هو. */
    expect(store.get('согласование').register).toBe('formal');
    expect(store.get('согласование').origin).toBe(ORIGIN.USER);
  });

  it('٣٥ · وقالبُ التحليل يمنع الاختلاقَ صراحةً (بند ٥٨)', () => {
    const text = analysisPrompt();
    expect(text).toContain(FORMAT);
    expect(text).toContain('اختراعُ تواريخ');
    for (const field of ENRICHMENT_FIELDS) expect(text).toContain(field);
  });

  it('٣٦ · ⚠️ ولا نداءَ لذكاءٍ من داخل التطبيق (بندا ١٦ و٤٣)', async () => {
    for (const file of ['exchange.js', 'memory-service.js', 'indexer.js', 'errors.js', 'identity.js']) {
      /* eslint-disable-next-line no-await-in-loop -- ملفٌّ بعد ملفّ */
      const src = await (await fetch(`../js/services/memory/${file}`)).text();
      const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
      for (const banned of ['fetch(', 'openai', 'anthropic', 'XMLHttpRequest', 'api.']) {
        expect(`${file}:${banned}:${code.includes(banned)}`).toBe(`${file}:${banned}:false`);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * القاعدة والنسخة الاحتياطيّة
 * ------------------------------------------------------------------ */

describe('WS-C · القاعدة', () => {
  it('٣٧ · المخزنُ الجديدُ معرَّفٌ ومُرقًّى (بند ٥٤)', () => {
    expect(STORES.memoryOccurrences).toBeTruthy();
    expect(TARGET_VERSION >= 16).toBe(true);
    /* والفهارسُ التي يعتمد عليها البحثُ الدفعيّ موجودة. */
    const names = STORES.memoryOccurrences.indexes.map(([n]) => n);
    expect(names).toContain('canonical');
    expect(names).toContain('sourceKey');
  });

  it('٣٨ · وذاكرةُ الخطأ لم تُنقَل إلى مخزنٍ ثانٍ (بند ١ و٥٤)', () => {
    const names = STORES.mistakeComparisons.indexes.map(([n]) => n);
    /* الفهارسُ القديمةُ باقيةٌ — والجديدةُ أُضيفت إليها. */
    expect(names).toContain('sceneId');
    expect(names).toContain('mistakeType');
    expect(names).toContain('patternKey');
    expect(names).toContain('occurredAt');
    /* ⚠️ ولا مخزنَ اسمُه `languageErrors` ولا `memoryErrors`. */
    expect('languageErrors' in STORES).toBe(false);
    expect('memoryErrors' in STORES).toBe(false);
  });

  it('٣٩ · ⚠️ والفهرسُ المشتقُّ خارج السلّة — لأنه يُعاد بناؤه (بند ٥٦)', async () => {
    const src = await (await fetch('../js/services/trash-service.js')).text();
    expect(src.includes('memoryOccurrences:')).toBe(true);
  });

  it('٤٠ · والبحثُ لا يطلب منك كتابةَ النبر (بند ٦٤)', async () => {
    const src = { kind: SOURCE_KIND.SCRIPT, id: `${TAG}-G`, text: 'Документ направили на согласование.' };
    await indexSource(src);
    const found = await searchMemory('согласование');
    expect(found.some((one) => one.canonical === 'согласование')).toBe(true);
    /* وبالنبر أيضًا — الاثنان مفتاحٌ واحد. */
    const marked = await searchMemory('согласова́ние');
    expect(marked.some((one) => one.canonical === 'согласование')).toBe(true);
    await forgetSource(src.kind, src.id);
  });
});

/* ══════════════════════════════════════════════════════════════════
   WS-C2 · تمريرةُ الإكمال
   ══════════════════════════════════════════════════════════════════ */

describe('WS-C2 · فهرسةُ المحادثات', () => {
  it('٤١ · المحادثةُ **مصدرٌ واحدٌ بأجزاء** — لا مصدرٌ لكلّ جزء (بند ٤٥)', () => {
    const rows = rowsForSource({
      kind: SOURCE_KIND.CONVERSATION, id: 'CNV_1', title: 'محادثة',
      units: [
        { key: 'P1', text: 'Документ готов.', speaker: 'المتحدث ١', order: 1 },
        { key: 'P2', text: 'Документ направили на согласование.', speaker: 'المتحدث ٢', order: 2 },
        { key: 'P3', text: 'Я проверю согласование завтра.', speaker: 'المتحدث ١', order: 3 },
      ],
    });

    const soglas = rows.filter((r) => r.canonical === 'согласование');
    const dokument = rows.filter((r) => r.canonical === 'документ');

    /* ⚠️ موضعان لكلٍّ — والمصدرُ **واحد**. */
    expect(soglas).toHaveLength(2);
    expect(dokument).toHaveLength(2);
    expect(new Set(rows.map((r) => r.sourceKey)).size).toBe(1);
    /* وكلُّ موضعٍ يعرف جزأَه ومتحدّثَه (بندا ٢٧ و٢٩). */
    expect(soglas[0].unitKey).toBe('P2');
    expect(soglas[1].unitKey).toBe('P3');
    expect(soglas[0].speaker).toBe('المتحدث ٢');
  });

  it('٤٢ · ⚠️ وجزءان مختلفان بصمتان — فتعديلُ جزءٍ لا يزيح غيرَه (بند ٥٤)', () => {
    const one = occurrenceId({
      canonical: 'док', sourceKey: 'conversation:C', unitKey: 'P1', sentenceIndex: 0, wordIndex: 0,
    });
    const two = occurrenceId({
      canonical: 'док', sourceKey: 'conversation:C', unitKey: 'P2', sentenceIndex: 0, wordIndex: 0,
    });
    expect(one === two).toBe(false);
    /* والسكريبتُ بلا وحدةٍ يبقى ببصمته القديمة حرفيًّا. */
    expect(occurrenceId({ canonical: 'док', sourceKey: 'script:A', sentenceIndex: 1, wordIndex: 2 }))
      .toBe('MOC_script:A_1_2_док');
  });

  it('٤٣ · ⚠️ والمتحدّثُ والترجمةُ لا يدخلان الفهرس (بندا ٢٩ و٣٠)', () => {
    const rows = rowsForSource({
      kind: SOURCE_KIND.CONVERSATION, id: 'CNV_2',
      units: [{
        key: 'P1', text: 'Документ готов.',
        speaker: 'المتحدث', translation: 'المستند جاهز.',
      }],
    });
    const keys = rows.map((r) => r.canonical);
    /* «المتحدث» ليست مفردةً روسيّة، والعربيُّ ترجمةٌ لا مادّةُ فهرسة. */
    expect(keys.some((k) => k.includes('المتحدث'))).toBe(false);
    expect(keys.some((k) => k.includes('المستند'))).toBe(false);
    expect(keys).toContain('документ');
    /* والترجمةُ محفوظةٌ في المنشأ تُعرَض. */
    expect(rows[0].unitTranslation).toBe('المستند جاهز.');
  });

  it('٤٤ · وإزالةُ كلمةٍ من جزءٍ تُسقط موضعَها وحدَه', () => {
    const before = rowsForSource({
      kind: SOURCE_KIND.CONVERSATION, id: 'CNV_3',
      units: [
        { key: 'P1', text: 'Документ направили на согласование.' },
        { key: 'P2', text: 'Я проверю согласование завтра.' },
      ],
    });
    const after = rowsForSource({
      kind: SOURCE_KIND.CONVERSATION, id: 'CNV_3',
      units: [
        { key: 'P1', text: 'Документ направили на согласование.' },
        { key: 'P2', text: 'Я проверю завтра.' },
      ],
    });
    const count = (rows) => rows.filter((r) => r.canonical === 'согласование').length;
    expect(count(before)).toBe(2);
    expect(count(after)).toBe(1);
    /* وبصمةُ الجزء الأوّل لم تتغيّر — فملاحظتُك عليه تبقى في مكانها. */
    const keep = (rows) => rows.find((r) => r.canonical === 'согласование' && r.unitKey === 'P1').id;
    expect(keep(after)).toBe(keep(before));
  });
});

describe('WS-C2 · سياقُ الظهور', () => {
  it('٤٥ · ⚠️ ولا يُخزَّن في الفهرس المشتقّ — يحرسه فحصُ نصّ (بندا ٥٣ و٥٤)', async () => {
    const src = await (await fetch('../js/services/memory/context.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    /*
     * الملاحظةُ تُكتَب بـ`link`/`unlink` في `relationships` — ولا
     * `memoryOccurrences.update` ولا `putRaw` هنا إطلاقًا. فإعادةُ بناء
     * الفهرس لا تمسّها.
     */
    expect(code.includes('memoryOccurrences.update')).toBe(false);
    expect(code.includes('memoryOccurrences.putRaw')).toBe(false);
    expect(code.includes('memoryOccurrences.putManyRaw')).toBe(false);
    expect(code.includes("link(")).toBe(true);
  });

  it('٤٦ · ⚠️ وإعادةُ بناء الفهرس لا تمسّ الروابط (بند ٥٤)', async () => {
    const src = await (await fetch('../js/services/memory/indexer.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    for (const banned of ['relationships', 'unlink', 'link-service']) {
      expect(`${banned}:${code.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٤٧ · والمشتقُّ من المصدر متمايزٌ عن وسمِك (بندا ٢٤ و٤٤)', async () => {
    const { CONTEXT_ORIGIN } = await import('../js/services/memory/context.js');
    expect(CONTEXT_ORIGIN.USER).toBe(ORIGIN.USER);
    expect(CONTEXT_ORIGIN.DERIVED_SOURCE).toBe('derived_source');
    expect(CONTEXT_ORIGIN.USER === CONTEXT_ORIGIN.DERIVED_SOURCE).toBe(false);
  });
});

describe('WS-C2 · تصحيحُ الغلطة تدريبٌ لا غلطةٌ ثانية', () => {
  it('٤٨ · ⚠️ ولا مُشغِّلَ ثانٍ ولا مسارَ نطقٍ جديد (بند ٢)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const at = src.indexOf('async function enterCorrectionSource');
    expect(at > 0).toBe(true);
    const body = src.slice(at, at + 3200);
    /* نفسُ الباب: مقاطعُ في نفس الجلسة ونافذةُ مصدر. */
    expect(body.includes('player.pushSegment')).toBe(true);
    expect(body.includes('player.setSourceWindow')).toBe(true);
    /* ولا جلسةَ ولا مسار. */
    expect(body.includes('createSession')).toBe(false);
    expect(body.includes('navigate(')).toBe(false);
    /* ولا محرّكَ نطقٍ خاصّ. */
    expect(body.includes('speechSynthesis')).toBe(false);
    expect(body.includes('createPlaybackController')).toBe(false);
  });

  it('٤٩ · ⚠️ والنصُّ الفعّالُ هو الصحيحُ لا الخطأ (بند ٣)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const at = src.indexOf('async function enterCorrectionSource');
    const body = src.slice(at, at + 3200);
    expect(body.includes('error?.natural')).toBe(true);
    /* ⚠️ ولا يدخل `wrong` قائمةَ المقاطع أبدًا — الخطأُ تاريخٌ يُقرأ. */
    expect(body.includes('error.wrong')).toBe(false);
    expect(body.includes('sourceTextSnapshot: text.trim()')).toBe(true);
  });

  it('٥٠ · ⚠️ ولا يكتب في سجلّ الأخطاء إطلاقًا (بند ٦)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const at = src.indexOf('async function enterCorrectionSource');
    const body = src.slice(at, at + 3200);
    for (const banned of ['recordError', 'mistakeComparisons.create', 'patternKey']) {
      expect(`${banned}:${body.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٥١ · والتدريبُ يحمل منشأَ التصحيح — رابطٌ لا تطابقُ نصّ (بند ٥٦)', async () => {
    const src = await (await fetch('../js/services/shadow/shadow-session-service.js')).text();
    expect(src.includes('correctionOf: segment.correctionOf || null')).toBe(true);
    /* ⚠️ ولا يتغيّر معنى الصفّ: هو تدريبٌ لا واقعةُ خطأ. */
    expect(src.includes("meaning: 'practiced'")).toBe(true);
    expect(src.includes('impliesMastery: false')).toBe(true);
  });
});

describe('WS-C2 · واجهةُ التبادل', () => {
  it('٥٢ · ⚠️ والمراجعةُ لا تكتب — الإلغاءُ لا يمرّ على كتابة (بند ٤٢)', async () => {
    const src = await (await fetch('../js/modals/memory-exchange.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    /* البابُ لا يستورد `applyEnrichment` أصلًا — فلا يستطيع الكتابة. */
    expect(code.includes('applyEnrichment')).toBe(false);
    expect(code.includes('writeEnrichment')).toBe(false);
    expect(code.includes('putRaw')).toBe(false);
  });

  it('٥٣ · ⚠️ ولا نداءَ شبكةٍ ولا ذكاءٍ في بابِ التبادل (بندا ٦٠ و٦١)', async () => {
    const src = await (await fetch('../js/modals/memory-exchange.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    for (const banned of ['fetch(', 'openai', 'anthropic', 'XMLHttpRequest', 'api.openai']) {
      expect(`${banned}:${code.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٥٤ · والمراجعةُ تعرض المرفوضَ لا تُسقطه بصمت (بند ١٣)', async () => {
    const src = await (await fetch('../js/modals/memory-exchange.js')).text();
    expect(src.includes('parsed.dropped')).toBe(true);
    expect(src.includes('plan.conflicts')).toBe(true);
    expect(src.includes('parsed.unknown')).toBe(true);
    /* ⚠️ والجامُّ ثانويٌّ داخل `details` لا تجربةً أولى (بند ١٢). */
    expect(src.includes('<details class="mx-details">')).toBe(true);
  });

  it('٥٥ · ⚠️ ولا يُخلَق ظهورٌ من ملفٍّ مستورَد — مهما ادّعى (بند ٥٢)', () => {
    const evil = {
      format: FORMAT, version: FORMAT_VERSION,
      enrichment: {
        entities: [{
          canonical: 'согласование',
          register: 'formal',
          encounteredInConversation: true,
          conversationId: 'CNV_9',
          speaker: 'المتحدث ٢',
          sentenceIndex: 0,
        }],
      },
    };
    const parsed = parseEnrichment(evil);
    const one = parsed.entities[0];
    expect(one.register).toBe('formal');
    for (const banned of ['encounteredInConversation', 'conversationId', 'speaker', 'sentenceIndex']) {
      expect(`${banned}:${banned in one}`).toBe(`${banned}:false`);
      expect(parsed.dropped).toContain(banned);
    }
  });

  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ حارسُ الأخضرِ الكاذب: زرٌّ في نافذةٍ لا يسمعه مستمعُ `main`
   * ═══════════════════════════════════════════════════════════════
   *
   * «تدرّب على الصح» كان له `case` في مُبدِّل `data-sh`، وذلك
   * المُبدِّلُ معلَّقٌ على `main` بينما النوافذُ تُلحَق بـ
   * `document.body`. فالنقرةُ لم تصل يومًا، والنافذةُ كانت تُغلَق
   * فيبدو أن شيئًا حدث — ومرّ تأكيدي صدفةً لأن جملةَ السكريبت
   * والتصحيحَ ينتهيان بالكلمة نفسِها.
   *
   * فهذا الحارسُ عامٌّ لا خاصٌّ بزرَّين: كلُّ `data-sh` تُرسَم داخل
   * `openWordMemory` يجب أن تُوصَل داخلها، وألّا يكون لها `case`.
   */
  it('٥٦ · ⚠️ أزرارُ نافذة الذاكرة موصولةٌ داخلها لا في مستمع الشاشة', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const start = src.indexOf('async function openWordMemory(');
    expect(start > -1).toBe(true);
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end);

    const actions = [...new Set(
      [...body.matchAll(/data-sh="([a-z-]+)"/g)].map((m) => m[1])
    )];
    /* حتى لا يمرّ الحارسُ فارغًا لو تغيّر شكلُ الرسم. */
    expect(actions.length >= 2).toBe(true);
    expect(actions).toContain('fix-practice');
    expect(actions).toContain('occ-context');

    for (const one of actions) {
      /* موصولٌ داخل النافذة نفسِها. */
      expect(`${one}:wired`).toBe(
        `${one}:${body.includes(`closest('[data-sh="${one}"]')`) ? 'wired' : 'unwired'}`
      );
      /* ولا `case` له في مُبدِّل `main` — لأنّه لن يُنادى أبدًا. */
      expect(`${one}:${src.includes(`case '${one}'`)}`).toBe(`${one}:false`);
    }
  });

  it('٥٧ · ⚠️ والإغلاقُ نداءٌ حقيقيٌّ لا نقرةٌ ملفَّقة على مُحدِّد', async () => {
    const modal = await (await fetch('../js/components/modal.js')).text();
    expect(modal.includes('export function closeOverlayOf')).toBe(true);
    expect(modal.includes('overlay.__close = finish')).toBe(true);

    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    expect(code.includes('closeOverlayOf')).toBe(true);
    /* والنقرةُ الملفَّقةُ على زرِّ النافذة راحت بلا رجعة. */
    expect(code.includes(".overlay [data-close]")).toBe(false);
    expect(code.includes('.overlay button[type="submit"]')).toBe(false);
  });

  it('٥٨ · ⚠️ والدخولُ في التصحيح بعد أن تُغلَق النافذة فعلًا (بند ٤)', async () => {
    const src = await (await fetch('../js/views/shadow-view.js')).text();
    const start = src.indexOf('async function openWordMemory(');
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end);
    /* النيّةُ تُسجَّل داخل النافذة… */
    expect(body.includes('leavingFor = fixBtn.dataset.id')).toBe(true);
    /* …و`await showModal` يفصل بينها وبين التنفيذ. */
    expect(body.includes('await showModal({')).toBe(true);
    expect(body.indexOf('await showModal({') < body.indexOf('enterCorrectionSource(error)')).toBe(true);
    /* ولا انتظارَ زمنيٌّ أعمى بدل الوعد. */
    expect(body.includes('setTimeout')).toBe(false);
  });
});

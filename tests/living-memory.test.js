/**
 * LingoLife — ذاكرةُ اللغة الحيّة v2: الأدلّةُ أوّلًا (WS-J)
 *
 * ⚠️ **والاختبارُ الحاكمُ هنا واحد:** أن نصًّا مولَّدًا من نصٍّ حقيقيّ
 *    **لا يزيد موقفًا حقيقيًّا واحدًا** مهما تكرّرت الكلمةُ فيه. وكلُّ
 *    ما عداه خدمةٌ لهذه القاعدة.
 */

import { describe, it, expect } from './test-runner.js';
import { resetDevices, on, TABLET } from './sync-devices.js';

import { scenes, memorySources } from '../js/db/repositories.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import {
  EVIDENCE, ORIGIN, classOfOrigin, rootsOf, splitOccurrences, hashText,
} from '../js/services/memory/provenance.js';
import {
  ANALYSIS_STATE, scanSources, listSources, stateOf, classifySource,
  markAnalyzed, registrySummary, keyOf, setExcluded,
} from '../js/services/memory/source-registry.js';
import {
  buildPackages, suggestSelection, analyzedHashesOf, splitByChars, VERSION, FORMAT,
} from '../js/services/memory/export-v2.js';
import {
  countForm, countLemma, measure, verify, VERIFY,
} from '../js/services/memory/counting.js';

/* ------------------------------------------------------------------ *
 * أدوات
 * ------------------------------------------------------------------ */

const RAW_TEXT = 'Документы необходимо предоставить заказчику.';
const RAW_TEXT_2 = 'Мы направили документы на согласование.';
const DERIVED_TEXT = 'Все документы необходимо заранее предоставить заказчику. '
  + 'Документы должны быть полными. Документы проверяются.';

/** يبني مشهدًا ونصوصَه ثم يمسح السجلّ — كما يفعل التطبيقُ عند الفتح. */
async function seed(texts) {
  const scene = await scenes.create({ titleAr: 'موقف حقيقي', date: '2026-01-05' });
  const made = {};
  for (const [name, text] of Object.entries(texts)) {
    /* eslint-disable-next-line no-await-in-loop */
    const script = await addScript(scene.id, { title: name, text });
    made[name] = keyOf('script', script.id);
  }
  await scanSources();
  return made;
}

const mark = (key, evidenceClass, originType, derivedFrom = []) =>
  classifySource(key, { evidenceClass, originType, derivedFrom });

const registryMap = async () =>
  new Map((await listSources()).map((row) => [row.id, row]));

/** مقاطعُ نصٍّ للعدّ — كما تصل من الحزمة. */
const segsOf = (pkg) => pkg.sources.flatMap((doc) =>
  doc.segments.map((seg) => ({
    sourceKey: doc.sourceKey, segmentId: seg.segmentId, text: seg.text,
  })));

/* ================================================================== *
 * أ · ب · ج — أصليٌّ ومولَّد
 * ================================================================== */

describe('WS-J · أصليٌّ ومولَّد', () => {
  it('أ · نصٌّ مولَّدٌ من أصليّ لا يزيد المواقفَ الحقيقيّة', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, DERIVED: DERIVED_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.DERIVED, EVIDENCE.DERIVED, ORIGIN.AI_IMPROVED, [keys.RAW]);
      return keys;
    });

    const index = await on(TABLET, registryMap);
    /* «документы» مرّةً في الأصليّ وثلاثًا في المولَّد. */
    const occ = [
      { sourceKey: made.RAW },
      { sourceKey: made.DERIVED }, { sourceKey: made.DERIVED }, { sourceKey: made.DERIVED },
    ];
    const split = splitOccurrences(occ, index);

    expect(split.realSituations).toBe(1);
    expect(split.rawOccurrences).toBe(1);
    expect(split.derivedAppearances).toBe(3);
    /* ═══ ولا مجموعَ اسمُه «٤ ظهورات حقيقيّة» ═══ */
    expect(split.rawOccurrences === 4).toBe(false);
  });

  it('ب · ونصّان أصليّان مختلفان = موقفان', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW1: RAW_TEXT, RAW2: RAW_TEXT_2 });
      await mark(keys.RAW1, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.RAW2, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    const index = await on(TABLET, registryMap);
    const split = splitOccurrences(
      [{ sourceKey: made.RAW1 }, { sourceKey: made.RAW2 }], index
    );
    expect(split.realSituations).toBe(2);
    expect(split.rawOccurrences).toBe(2);
  });

  it('ج · وخمسةُ نصوصٍ مولَّدةٍ من جذرٍ واحدٍ تبقى موقفًا واحدًا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({
        RAW: RAW_TEXT, D1: DERIVED_TEXT, D2: DERIVED_TEXT,
        D3: DERIVED_TEXT, D4: DERIVED_TEXT, D5: DERIVED_TEXT,
      });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      for (const name of ['D1', 'D2', 'D3', 'D4', 'D5']) {
        /* eslint-disable-next-line no-await-in-loop */
        await mark(keys[name], EVIDENCE.DERIVED, ORIGIN.AI_SHADOWING, [keys.RAW]);
      }
      return keys;
    });

    const index = await on(TABLET, registryMap);
    const occ = [
      { sourceKey: made.RAW },
      ...['D1', 'D2', 'D3', 'D4', 'D5'].map((n) => ({ sourceKey: made[n] })),
    ];
    const split = splitOccurrences(occ, index);
    expect(split.realSituations).toBe(1);
    expect(split.derivedAppearances).toBe(5);
  });

  it('ج٢ · ⚠️ والنسبُ يصمد لأجيال — حفيدٌ يعود لجذّه', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, IMPROVED: DERIVED_TEXT, SHADOW: DERIVED_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.IMPROVED, EVIDENCE.DERIVED, ORIGIN.AI_IMPROVED, [keys.RAW]);
      /* ⚠️ الحفيدُ مولودٌ من المحسَّنة لا من الخام. */
      await mark(keys.SHADOW, EVIDENCE.DERIVED, ORIGIN.AI_SHADOWING, [keys.IMPROVED]);
      return keys;
    });

    const index = await on(TABLET, registryMap);
    const lineage = rootsOf(made.SHADOW, index);
    expect(lineage.roots.length).toBe(1);
    expect(lineage.roots[0]).toBe(made.RAW);
    expect(lineage.depth >= 2).toBe(true);
  });

  it('ج٣ · وحلقةٌ في النسب لا تُعلِّق البحث', async () => {
    const index = new Map([
      ['a', { evidenceClass: EVIDENCE.DERIVED, derivedFrom: ['b'] }],
      ['b', { evidenceClass: EVIDENCE.DERIVED, derivedFrom: ['a'] }],
    ]);
    const lineage = rootsOf('a', index);
    expect(lineage.cyclic).toBe(true);
    expect(lineage.roots.length).toBe(0);
  });

  it('ج٤ · و«غير محدَّد» لا يُحسَب أصليًّا ولا مولَّدًا', async () => {
    await resetDevices();
    const made = await on(TABLET, () => seed({ RAW: RAW_TEXT }));
    const index = await on(TABLET, registryMap);
    /* لم يُصنَّف — والافتراضُ `unknown` لا `primary`. */
    expect(index.get(made.RAW).evidenceClass).toBe(EVIDENCE.UNKNOWN);
    const split = splitOccurrences([{ sourceKey: made.RAW }], index);
    expect(split.realSituations).toBe(0);
    expect(split.unknownOccurrences).toBe(1);
  });

  it('ج٥ · ونوعُ المنشأ يقترح صنفَه ولا يُفرَض على القديم', () => {
    expect(classOfOrigin(ORIGIN.RAW_TRANSCRIPT)).toBe(EVIDENCE.PRIMARY);
    expect(classOfOrigin(ORIGIN.AI_SHADOWING)).toBe(EVIDENCE.DERIVED);
    expect(classOfOrigin(ORIGIN.UNKNOWN)).toBe(EVIDENCE.UNKNOWN);
    expect(classOfOrigin(undefined)).toBe(EVIDENCE.UNKNOWN);
  });
});

/* ================================================================== *
 * د · هـ · و · ز — التصدير وحالةُ التحليل
 * ================================================================== */

describe('WS-J · التصديرُ وحالةُ التحليل', () => {
  it('د · ⚠️ أوّلُ تصديرٍ يحمل النصَّ الأصليَّ كاملًا لا إحصاءً', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const { packages, summary } = await on(TABLET, () =>
      buildPackages({ selected: [made.RAW] }));

    expect(packages.length).toBe(1);
    const pkg = packages[0];
    expect(pkg.format).toBe(FORMAT);
    expect(pkg.version).toBe(VERSION);
    expect(pkg.sources.length).toBe(1);

    /* ═══ النصُّ نفسُه بحرفه — لا `{canonical, positions}` ═══ */
    expect(pkg.sources[0].segments[0].text).toBe(RAW_TEXT);
    expect(pkg.sources[0].evidenceClass).toBe(EVIDENCE.PRIMARY);
    expect(typeof pkg.sources[0].contentHash).toBe('string');
    expect(pkg.sources[0].segments[0].segmentId.length > 0).toBe(true);
    expect(summary.selectedNew).toBe(1);

    /* والعقدُ داخل الحزمة لا في رسالةٍ تُنسى. */
    expect(pkg.contract.rules.length > 5).toBe(true);
  });

  it('هـ · ⚠️ والجولةُ الثانية لا تعيد إرسال ما حُلِّل', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const texts = {};
      for (let i = 1; i <= 6; i++) texts[`S${i}`] = `${RAW_TEXT} ${i}`;
      const keys = await seed(texts);
      for (const key of Object.values(keys)) {
        /* eslint-disable-next-line no-await-in-loop */
        await mark(key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      }
      return keys;
    });

    /* الجولةُ الأولى: الستّةُ كلُّها. */
    const all = Object.values(made);
    const first = await on(TABLET, () => buildPackages({ selected: all }));
    expect(first.packages[0].sources.length).toBe(6);

    /* تُسجَّل بصماتُها كما أُرسلت. */
    await on(TABLET, () => markAnalyzed(analyzedHashesOf(first.packages)));

    /* نصٌّ سابعٌ جديد. */
    const seventh = await on(TABLET, async () => {
      const rows = await scenes.getAll();
      const script = await addScript(rows[0].id, { title: 'S7', text: `${RAW_TEXT_2} 7` });
      await scanSources();
      const key = keyOf('script', script.id);
      await mark(key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return key;
    });

    /* الاقتراحُ التلقائيُّ = الجديدُ وحدَه. */
    const suggested = await on(TABLET, suggestSelection);
    expect(suggested.length).toBe(1);
    expect(suggested[0]).toBe(seventh);

    const second = await on(TABLET, () => buildPackages({ selected: suggested }));
    /* ═══ نصٌّ واحدٌ لا سبعة ═══ */
    expect(second.packages[0].sources.length).toBe(1);
    expect(second.summary.reused).toBe(6);
    /* والستّةُ مذكورةٌ ببصماتها لا بنصوصها. */
    expect(second.packages[0].alreadyAnalyzed.length).toBe(6);
    expect(JSON.stringify(second.packages[0]).includes(RAW_TEXT_2)).toBe(true);
    expect(second.packages[0].alreadyAnalyzed[0].analyzedHash.length).toBe(64);
  });

  it('و · ونصٌّ تعدّل بعد تحليله يُعلَّم «اتعدّل»', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const built = await on(TABLET, () => buildPackages({ selected: [made.RAW] }));
    await on(TABLET, () => markAnalyzed(analyzedHashesOf(built.packages)));

    let rows = await on(TABLET, listSources);
    expect(stateOf(rows[0])).toBe(ANALYSIS_STATE.CURRENT);

    /* تعديلٌ حقيقيٌّ للنصّ. */
    await on(TABLET, async () => {
      const id = rows[0].sourceId;
      await updateScript(id, { text: `${RAW_TEXT} تعديل` });
      await scanSources();
    });

    rows = await on(TABLET, listSources);
    expect(stateOf(rows[0])).toBe(ANALYSIS_STATE.CHANGED);

    /* ويُقترَح تلقائيًّا لإعادة التحليل. */
    const suggested = await on(TABLET, suggestSelection);
    expect(suggested.includes(made.RAW)).toBe(true);
  });

  it('ز · ونصٌّ حُذف بعد تحليله يُنتج شهادةَ حذفٍ بلا مسّ الباقي', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, KEEP: RAW_TEXT_2 });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.KEEP, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const built = await on(TABLET, () => buildPackages({ selected: Object.values(made) }));
    await on(TABLET, () => markAnalyzed(analyzedHashesOf(built.packages)));

    /* يُحذف الأوّلُ من القاعدة. */
    await on(TABLET, async () => {
      const { scripts } = await import('../js/db/repositories.js');
      const rows = await listSources();
      const target = rows.find((row) => row.id === made.RAW);
      await scripts.destroy(target.sourceId);
      await scanSources();
    });

    const rows = await on(TABLET, listSources);
    const gone = rows.find((row) => row.id === made.RAW);
    const kept = rows.find((row) => row.id === made.KEEP);

    expect(stateOf(gone)).toBe(ANALYSIS_STATE.DELETED);
    /* ⚠️ والباقي لم يُمَسّ — لا يعود «محتاجًا إعادةَ تحليل». */
    expect(stateOf(kept)).toBe(ANALYSIS_STATE.CURRENT);

    const next = await on(TABLET, () => buildPackages({ selected: [] }));
    expect(next.packages[0].tombstones.length).toBe(1);
    expect(next.packages[0].tombstones[0].sourceKey).toBe(made.RAW);
  });

  it('ز٢ · والمستبعَدُ لا يدخل الاقتراحَ التلقائيّ', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ A: RAW_TEXT, B: RAW_TEXT_2 });
      await mark(keys.A, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.B, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await setExcluded(keys.B, true);
      return keys;
    });
    const suggested = await on(TABLET, suggestSelection);
    expect(suggested.length).toBe(1);
    expect(suggested[0]).toBe(made.A);
  });

  it('ز٣ · والمولَّدُ لا يُقترَح تلقائيًّا ولو كان جديدًا (بند ١١)', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, D: DERIVED_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.D, EVIDENCE.DERIVED, ORIGIN.AI_IMPROVED, [keys.RAW]);
    });
    const suggested = await on(TABLET, suggestSelection);
    expect(suggested.length).toBe(1);
  });

  it('ز٤ · والتجزئةُ تحترم السقفَ ولا تقصّ نصًّا', () => {
    const docs = [
      { sourceKey: 'a', chars: 60 },
      { sourceKey: 'b', chars: 60 },
      { sourceKey: 'c', chars: 300 },
    ];
    const batches = splitByChars(docs, 100);
    expect(batches.length).toBe(3);
    expect(batches[0].length).toBe(1);
    /* ⚠️ ونصٌّ أكبرُ من السقف يُرسَل وحدَه كاملًا — لا نصفَ جملة. */
    expect(batches[2][0].chars).toBe(300);
  });
});

/* ================================================================== *
 * ح · ط — العدُّ المزدوج
 * ================================================================== */

describe('WS-J · العدُّ والتحقّق', () => {
  it('ح · عددان متطابقان = متحقَّق', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, RAW2: RAW_TEXT_2 });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.RAW2, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    const { packages } = await on(TABLET, () =>
      buildPackages({ selected: Object.values(made) }));
    const segments = segsOf(packages[0]);

    const app = countForm('документы', segments);
    expect(app.total).toBe(2);

    const ai = { claimed: 2, references: app.hits };
    const check = verify(ai, app);
    expect(check.status).toBe(VERIFY.VERIFIED);
    expect(check.claimed).toBe(2);
    expect(check.counted).toBe(2);
  });

  it('ط · ⚠️ وعددان مختلفان = مراجعة، ولا يُحسَم بصمت', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    const { packages } = await on(TABLET, () => buildPackages({ selected: [made.RAW] }));
    const segments = segsOf(packages[0]);

    const app = countForm('документы', segments);
    const ai = { claimed: 5, references: [] };
    const check = verify(ai, app);

    expect(check.status).toBe(VERIFY.REVIEW);
    expect(check.claimed).toBe(5);
    expect(check.counted).toBe(1);
    /* والفرقُ يُعرَض بمواضعه. */
    expect(check.extra.length).toBe(1);
  });

  it('ط٢ · وتحليلٌ بلا عددٍ لا يُعَدّ خلافًا', () => {
    const check = verify({ claimed: null }, { total: 3, hits: [] });
    expect(check.status).toBe(VERIFY.NOT_CLAIMED);
  });

  it('ط٣ · ⚠️ والمطابقةُ على حدود الكلمة — «дом» ليست في «домашний»', () => {
    const segments = [{ sourceKey: 's', segmentId: 'g', text: 'Домашний дом и домик.' }];
    expect(countForm('дом', segments).total).toBe(1);
  });

  it('ط٤ · والمفردةُ تُعَدّ بصيغها بلا عدّ موضعٍ مرّتين', () => {
    const segments = [{
      sourceKey: 's', segmentId: 'g',
      text: 'Документ и документы и документов.',
    }];
    const lemma = countLemma(['документ', 'документы', 'документов'], segments);
    expect(lemma.total).toBe(3);
  });

  it('ط٥ · والقياسُ يفصل الخامَ عن المولَّد ولا يجمعهما', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, D: DERIVED_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.D, EVIDENCE.DERIVED, ORIGIN.AI_IMPROVED, [keys.RAW]);
      return keys;
    });
    const { packages } = await on(TABLET, () =>
      buildPackages({ selected: Object.values(made) }));
    const segments = segsOf(packages[0]);
    const index = await on(TABLET, registryMap);

    const hits = countForm('документы', segments).hits;
    const m = measure(hits, index);

    expect(m.realSituations).toBe(1);
    expect(m.rawOccurrences).toBe(1);
    expect(m.derivedAppearances >= 2).toBe(true);
    /* ⚠️ ولا حقلَ `total` يغري بجمعهما. */
    expect(m.total === undefined).toBe(true);
  });
});

/* ================================================================== *
 * ق — حصانةُ ما حدث
 * ================================================================== */

describe('WS-J · ما حدث لا يُعاد كتابتُه', () => {
  it('ق · ⚠️ التحليلُ لا يملك سبيلًا لتعديل نصٍّ ولا تاريخ', async () => {
    await resetDevices();
    const before = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      const { scripts } = await import('../js/db/repositories.js');
      const rows = await scripts.getAll();
      return { key: keys.RAW, row: rows[0] };
    });

    /* دورةٌ كاملة: بناءُ حزمةٍ ثم تسجيلُ التحليل. */
    const built = await on(TABLET, () => buildPackages({ selected: [before.key] }));
    await on(TABLET, () => markAnalyzed(analyzedHashesOf(built.packages)));

    const after = await on(TABLET, async () => {
      const { scripts } = await import('../js/db/repositories.js');
      const rows = await scripts.getAll();
      return rows[0];
    });

    /* ═══ النصُّ والتاريخُ والمراجعةُ كما كانت ═══ */
    expect(after.text).toBe(before.row.text);
    expect(after.createdAt).toBe(before.row.createdAt);
    expect(after.updatedAt).toBe(before.row.updatedAt);
    expect(after.rev).toBe(before.row.rev);
  });

  it('ق٢ · وحالةُ التحليل تعيش في سجلٍّ منفصل لا في صفّ النصّ', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    const built = await on(TABLET, () => buildPackages({ selected: [made.RAW] }));
    await on(TABLET, () => markAnalyzed(analyzedHashesOf(built.packages)));

    const script = await on(TABLET, async () => {
      const { scripts } = await import('../js/db/repositories.js');
      return (await scripts.getAll())[0];
    });
    /* ⚠️ ولا أثرَ للتحليل على صفّ المحتوى. */
    expect(script.analyzedHash === undefined).toBe(true);
    expect(script.evidenceClass === undefined).toBe(true);

    const row = await on(TABLET, () => memorySources.get(made.RAW));
    expect(row.analyzedHash.length).toBe(64);
  });

  it('ق٣ · والبصمةُ لا تتغيّر إلّا بتغيّر النصّ', async () => {
    const a = await hashText('Документы необходимо предоставить.');
    const b = await hashText('  Документы необходимо предоставить.  ');
    const c = await hashText('Документы необходимо предоставить!');
    expect(a).toBe(b);
    expect(a === c).toBe(false);
    expect(a.length).toBe(64);
  });

  it('ق٤ · والمسحُ المتكرّر لا يبدّل تصنيفًا اخترتَه', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    await on(TABLET, scanSources);
    await on(TABLET, scanSources);
    const row = await on(TABLET, () => memorySources.get(made.RAW));
    expect(row.evidenceClass).toBe(EVIDENCE.PRIMARY);
    expect(row.originType).toBe(ORIGIN.RAW_TRANSCRIPT);
  });

  it('ق٥ · وملخّصُ السجلّ يعدّ الأصنافَ الثلاثة منفصلة', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const keys = await seed({ A: RAW_TEXT, B: RAW_TEXT_2, C: DERIVED_TEXT });
      await mark(keys.A, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.C, EVIDENCE.DERIVED, ORIGIN.AI_IMPROVED, [keys.A]);
    });
    const s = await on(TABLET, registrySummary);
    expect(s.total).toBe(3);
    expect(s.primary).toBe(1);
    expect(s.derived).toBe(1);
    expect(s.unknown).toBe(1);
  });
});

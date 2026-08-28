/**
 * LingoLife — «لغتي» والتحليلُ التزايُديّ (WS-J · بنود ٥…٢٣)
 *
 * ⚠️ **الشرطُ الحاكمُ الذي تخدمه أغلبُ هذه الاختبارات واحد:**
 *    لا شيءَ ممّا تفعله أنت (حفظٌ · تدريبٌ · تعليمٌ من الشادوينج) ولا
 *    شيءَ ممّا يُولَّد من نصوصك يزيد **موقفًا حقيقيًّا** واحدًا.
 *
 * ⚠️ **ولا يُسمَح لمحاكٍ أن يثبت نفسَه**: العناصرُ تُكتَب بالمستودعات
 *    نفسِها التي يكتب بها التطبيق، والفهرسُ يُبنى من القاعدة لا من
 *    كائنٍ نصنعه في الاختبار.
 */

import { describe, it, expect } from './test-runner.js';
import { resetDevices, on, sendTo, TABLET, MOBILE } from './sync-devices.js';

import {
  scenes, analysisItems, analysisEvidence, memorySources, savedItems,
} from '../js/db/repositories.js';
import { EXPORTABLE_STORES } from '../js/db/schema.js';
import { logged } from '../js/services/sync/sync-policy.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import { scripts } from '../js/db/repositories.js';
import { saveItem, SAVED_KIND } from '../js/services/saved-service.js';
import { EVIDENCE, ORIGIN } from '../js/services/memory/provenance.js';
import {
  scanSources, listSources, classifySource, keyOf, markSent,
} from '../js/services/memory/source-registry.js';
import { buildPackages, analyzedHashesOf, suggestSelection } from '../js/services/memory/export-v2.js';
import {
  analysisSnapshot, planRemovals, applyRemovals, pruneMissingSources,
  incrementalStatus, REMOVAL,
} from '../js/services/memory/analysis-state.js';
import {
  parseAnalysis, planImport, applyImport, RESULT_FORMAT, RESULT_VERSION,
} from '../js/services/memory/import-v2.js';
import {
  buildLanguageIndex, queryLanguage, relationsOf, evidenceOf,
  PROVENANCE, SIGNAL, SORT, ITEM_TYPE,
} from '../js/services/memory/my-language.js';
import { invalidateLanguage } from '../js/services/memory/language-cache.js';
import { VERIFY } from '../js/services/memory/counting.js';

/* ------------------------------------------------------------------ *
 * أدوات
 * ------------------------------------------------------------------ */

const RAW = 'Документы необходимо предоставить заказчику.';
const RAW2 = 'Мы направили документы на согласование в понедельник.';
const DERIVED = 'Документы должны быть полными. Документы проверяются каждый день.';

async function seed(texts) {
  const scene = await scenes.create({ titleAr: 'موقف', date: '2026-04-04' });
  const made = {};
  for (const [name, text] of Object.entries(texts)) {
    /* eslint-disable-next-line no-await-in-loop */
    const script = await addScript(scene.id, { title: name, text });
    made[name] = { key: keyOf('script', script.id), id: script.id, seg: `${script.id}#0` };
  }
  await scanSources();
  return made;
}

const mark = (key, evidenceClass, originType, derivedFrom = []) =>
  classifySource(key, { evidenceClass, originType, derivedFrom });

const file = (items, extra = {}) => JSON.stringify({
  format: RESULT_FORMAT, version: RESULT_VERSION, part: 1, parts: 1,
  analyzedSources: [], items, ...extra,
});

const wordItem = (over = {}) => ({
  key: 'word:документ:default',
  itemType: 'word',
  lemma: 'документ',
  pos: 'noun',
  register: 'formal',
  domain: 'work',
  forms: ['документ', 'документы'],
  claimedCount: null,
  evidence: [],
  ...over,
});

/** يستورد ملفًّا كاملًا بالموافقة على كلّ ما لم يُحجَب. */
async function importFile(text, { acceptAll = false } = {}) {
  const plan = await planImport({ parsed: parseAnalysis(text) });
  if (acceptAll) for (const row of plan.rows) row.accept = true;
  return applyImport(plan);
}

const buildIndex = () => { invalidateLanguage(); return buildLanguageIndex(); };

/* ================================================================== *
 * أ — الجولةُ الأولى والجولاتُ التالية
 * ================================================================== */

describe('WS-J · التحليلُ التزايُديّ', () => {
  it('أ١ · أوّلُ جولةٍ تقول إنها الأولى ولا تحمل حالةً سابقة', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const built = await on(TABLET, () => buildPackages({ selected: [made.RAW.key] }));
    expect(built.packages[0].round).toBe('first');
    expect(built.packages[0].analysisState).toBeFalsy();
    expect(built.summary.firstRun).toBe(true);
  });

  it('أ٢ · والجولةُ التالية تحمل حالةً مضغوطةً بلا نصٍّ واحد', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));

    const built = await on(TABLET, () => buildPackages({ selected: [made.RAW.key] }));
    const pkg = built.packages[0];

    expect(pkg.round).toBe('incremental');
    expect(pkg.analysisState.items.length).toBe(1);
    expect(pkg.analysisState.items[0].key).toBe('word:документ:default');

    /*
     * ═══ ولا نصَّ في الحالة — وهذا هو كلُّ معنى «مضغوطة» ═══
     * والقياسُ على النصّ نفسِه لا على الحجم: جملةٌ من نصّك لو تسرّبت
     * لَصارت الحزمةُ الخامسةُ بحجم الأولى بلا أن يشتكي شيء.
     */
    const asText = JSON.stringify(pkg.analysisState);
    expect(asText.includes('необходимо')).toBe(false);
    expect(asText.includes('заказчику')).toBe(false);
    expect(asText.length < 2000).toBe(true);
  });

  it('أ٣ · والنصُّ الذي سبق تحليلُه لا يُقترَح ثانيةً', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ A: RAW, B: RAW2 });
      await mark(keys.A.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.B.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    /* أُرسل الأوّلُ وحُلِّل. */
    await on(TABLET, async () => {
      const built = await buildPackages({ selected: [made.A.key] });
      await markSent(analyzedHashesOf(built.packages));
      await importFile(file([wordItem({
        evidence: [{ sourceKey: made.A.key, segmentId: made.A.seg, quote: 'Документы' }],
      })], { analyzedSources: [made.A.key] }));
    });

    const next = await on(TABLET, suggestSelection);
    expect(next).toHaveLength(1);
    expect(next[0]).toBe(made.B.key);

    const status = await on(TABLET, incrementalStatus);
    expect(status.firstRun).toBe(false);
    expect(status.current).toBe(1);
    expect(status.never).toBe(1);
  });

  it('أ٤ · وحذفٌ اقترحه التحليلُ يُرفَض ما دام دليلُه قائمًا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, async () => {
      const built = await buildPackages({ selected: [made.RAW.key] });
      await markSent(analyzedHashesOf(built.packages));
      await importFile(file([wordItem({
        evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
      })], { analyzedSources: [made.RAW.key] }));
    });

    const planned = await on(TABLET, () => planRemovals([
      { key: 'word:документ:default', reason: 'reconsidered' },
    ]));
    expect(planned[0].verdict).toBe(REMOVAL.EVIDENCE_STANDS);

    const done = await on(TABLET, () => applyRemovals(planned));
    expect(done.removed).toBe(0);
    expect(done.refused).toBe(1);
    expect(await on(TABLET, () => analysisItems.getAll())).toHaveLength(1);
  });

  it('أ٥ · ويُقبَل حين يتغيّر النصُّ الذي بُني عليه', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, async () => {
      const built = await buildPackages({ selected: [made.RAW.key] });
      await markSent(analyzedHashesOf(built.packages));
      await importFile(file([wordItem({
        evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
      })], { analyzedSources: [made.RAW.key] }));
      /* النصُّ تعدّل بعد التحليل. */
      await updateScript(made.RAW.id, { text: `${RAW} Ещё строка.` });
      await scanSources();
    });

    const planned = await on(TABLET, () => planRemovals([
      { key: 'word:документ:default', reason: 'source_changed' },
    ]));
    expect(planned[0].verdict).toBe(REMOVAL.ALLOWED);

    const done = await on(TABLET, () => applyRemovals(planned));
    expect(done.removed).toBe(1);
    expect(await on(TABLET, () => analysisItems.getAll())).toHaveLength(0);
    /* ووصلاتُ دليله تُسحَب معه فلا تبقى معلَّقة. */
    expect(await on(TABLET, () => analysisEvidence.getAll())).toHaveLength(0);
  });

  it('أ٦ · والنصُّ المحذوفُ تُسحَب أدلّتُه ويبقى العنصرُ بلا محو', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ A: RAW, B: RAW2 });
      await mark(keys.A.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.B.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      evidence: [
        { sourceKey: made.A.key, segmentId: made.A.seg, quote: 'Документы' },
        { sourceKey: made.B.key, segmentId: made.B.seg, quote: 'документы' },
      ],
    })])));

    const before = await on(TABLET, () => analysisItems.getAll());
    expect(before[0].realSituations).toBe(2);

    await on(TABLET, async () => {
      /* ⚠️ حذفٌ ناعمٌ بالمستودع نفسِه — نفسُ ما تفعله شاشةُ الحذف. */
      await scripts.trash(made.A.id);
      await scanSources();
    });
    const pruned = await on(TABLET, pruneMissingSources);
    expect(pruned.droppedLinks).toBe(1);

    const after = await on(TABLET, () => analysisItems.getAll());
    /* ═══ العنصرُ باقٍ، وعدُّه أُعيد من الباقي ═══ */
    expect(after).toHaveLength(1);
    expect(after[0].realSituations).toBe(1);
    expect(after[0].rawOccurrences).toBe(1);
  });
});

/* ================================================================== *
 * ب — نموذج «لغتي» الموحَّد
 * ================================================================== */

describe('WS-J · لغتي — عنصرٌ واحدٌ بإشاراتٍ منفصلة', () => {
  it('ب١ · رأسُ العدّ مفرداتٌ مميَّزةٌ لا صيغ', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      forms: ['документ', 'документы', 'документов', 'документам'],
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));

    const index = await on(TABLET, buildIndex);
    /* ═══ مفردةٌ واحدةٌ رغم أربع صيغ ═══ */
    expect(index.totals.words).toBe(1);
    expect(index.totals.observedForms >= 1).toBe(true);
  });

  it('ب٢ · وحفظُ صيغةٍ يُحَلّ إلى نفس العنصر لا إلى عنصرٍ ثانٍ', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));

    /* المستخدمُ يحفظ الصيغةَ المصرَّفة، لا المفردة. */
    await on(TABLET, () => saveItem({ text: 'документы', kind: SAVED_KIND.WORD }));

    const index = await on(TABLET, buildIndex);
    expect(index.totals.words).toBe(1);

    const one = index.byKey.get('word:документ:default');
    expect(one.saved).toBe(1);
    expect(one.hasAnalysis).toBe(true);
    expect(one.hasLearner).toBe(true);
    /* والإشارتان مسمّاتان ومنفصلتان — لا «مصدرٌ» واحدٌ مبهم. */
    expect(one.signals).toContain(SIGNAL.SAVED);
    expect(one.signals).toContain(SIGNAL.ANALYZED);
  });

  it('ب٣ · والحفظُ والتدريبُ لا يزيدان موقفًا حقيقيًّا واحدًا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));

    const before = await on(TABLET, buildIndex);
    const was = before.byKey.get('word:документ:default');
    expect(was.realSituations).toBe(1);

    /* ثلاثةُ أفعالٍ منك على نفس الكلمة. */
    await on(TABLET, async () => {
      await saveItem({ text: 'документы', kind: SAVED_KIND.WORD });
      await saveItem({ text: 'документ', kind: SAVED_KIND.WORD });
      const { practiceEvidence } = await import('../js/db/repositories.js');
      await practiceEvidence.create({
        targetType: 'shadowSegment', practiceType: 'shadowing',
        text: 'документы', repetitions: 12, practicedAt: Date.now(),
        impliesRealUsage: false, impliesMastery: false,
      });
    });

    const after = await on(TABLET, buildIndex);
    const now = after.byKey.get('word:документ:default');

    /* ═══ الرقمُ الحاكمُ لم يتحرّك ═══ */
    expect(now.realSituations).toBe(1);
    expect(now.rawOccurrences).toBe(1);
    /*
     * والإشاراتُ ارتفعت بأسمائها. **وحفظان اثنان** («документы»
     * و«документ») يجتمعان على عنصرٍ واحدٍ — وهذا بعينه شرطُ التوحيد:
     * عنصرٌ واحدٌ يحمل إشارتَي حفظٍ، لا عنصران بإشارةٍ لكلٍّ منهما.
     */
    expect(now.saved).toBe(2);
    expect(now.practised).toBe(12);
    expect(now.shadowed).toBe(1);
  });

  it('ب٤ · والمولَّدُ لا يزيد المواقفَ ولو تكرّرت الكلمةُ فيه', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW, GEN: DERIVED });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.GEN.key, EVIDENCE.DERIVED, ORIGIN.AI_SHADOWING, [keys.RAW.key]);
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));

    const index = await on(TABLET, buildIndex);
    const one = index.byKey.get('word:документ:default');
    expect(one.realSituations).toBe(1);
    expect(one.derivedAppearances).toBe(2);
    expect(one.provenance).toBe(PROVENANCE.PRIMARY);

    const split = await on(TABLET, () => evidenceOf('word:документ:default'));
    /* ═══ قائمتان لا قائمةٌ واحدة ═══ */
    expect(split.primary).toHaveLength(1);
    expect(split.derived).toHaveLength(2);
    expect(split.realSituations).toBe(1);
  });

  it('ب٥ · والمجهولُ يبقى مجهولًا ولا يُحسَب موقفًا', async () => {
    await resetDevices();
    const made = await on(TABLET, () => seed({ RAW }));

    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })]), { acceptAll: true }));

    const index = await on(TABLET, buildIndex);
    const one = index.byKey.get('word:документ:default');
    expect(one.realSituations).toBe(0);
    expect(one.unknownOccurrences).toBe(1);
    expect(one.provenance).toBe(PROVENANCE.UNKNOWN_ONLY);
  });

  it('ب٦ · والأوجهُ تتركّب: «أو» داخل الوجه و«و» بينها', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([
      wordItem({
        evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
      }),
      wordItem({
        key: 'word:предоставить:default', lemma: 'предоставить', pos: 'verb',
        register: 'formal', forms: ['предоставить'],
        evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'предоставить' }],
      }),
      wordItem({
        key: 'word:заказчик:default', lemma: 'заказчик', pos: 'noun',
        register: 'neutral', forms: ['заказчику'],
        evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'заказчику' }],
      }),
    ])));

    const index = await on(TABLET, buildIndex);

    /* قيمتان من وجهٍ واحد = «أو». */
    expect(queryLanguage(index, { pos: ['noun', 'verb'] })).toHaveLength(3);
    /* ووجهان = «و». */
    expect(queryLanguage(index, { pos: ['noun'], register: ['formal'] })).toHaveLength(1);
    expect(queryLanguage(index, { pos: ['noun'], register: ['neutral'] })).toHaveLength(1);
    /* والبحثُ فوق التصفية. */
    expect(queryLanguage(index, { search: 'заказ' })).toHaveLength(1);
  });

  it('ب٧ · والصيغُ والعائلةُ تُفحَصان منفصلتين', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([
      wordItem({
        familyId: 'документ', forms: ['документ', 'документы', 'документации'],
        evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
      }),
      wordItem({
        key: 'word:документация:default', lemma: 'документация',
        familyId: 'документ', forms: ['документация'],
        evidence: [],
      }),
    ]), { acceptAll: true }));

    const index = await on(TABLET, buildIndex);
    const rel = relationsOf(index, 'word:документ:default');

    expect(rel.family).toHaveLength(1);
    expect(rel.family[0].lemma).toBe('документация');
    /* المرئيُّ فعلًا مفصولٌ عمّا صرّح به التحليلُ ولم نره. */
    expect(rel.forms.observed.length >= 1).toBe(true);
    expect(rel.forms.unseen).toContain('документации');
    expect(index.totals.families).toBe(1);
  });

  it('ب٨ · وعدُّ التحليل يبقى مرئيًّا، والخلافُ يبقى «محتاج مراجعة»', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      claimedCount: 34,
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })]), { acceptAll: true }));

    const index = await on(TABLET, buildIndex);
    const one = index.byKey.get('word:документ:default');

    expect(one.aiClaimedCount).toBe(34);
    expect(one.rawOccurrences).toBe(1);
    expect(one.verifyStatus).toBe(VERIFY.REVIEW);
    /* ولا حقلَ مجموعٍ يخفي الخلاف. */
    expect(one.total === undefined).toBe(true);
    expect(index.totals.needsReview).toBe(1);
  });

  it('ب٩ · وما علّمتَه أنت وحدَك يُعرَض «من غير تحليل» ولا يُخفى', async () => {
    await resetDevices();
    await on(TABLET, () => seed({ RAW }));
    await on(TABLET, () => saveItem({ text: 'привет', kind: SAVED_KIND.WORD }));

    const index = await on(TABLET, buildIndex);
    const mine = index.items.filter((one) => one.learnerOnly);
    expect(mine).toHaveLength(1);
    expect(mine[0].lemma).toBe('привет');
    expect(mine[0].realSituations).toBe(0);
    expect(mine[0].provenance).toBe(PROVENANCE.NONE);
    expect(index.totals.learnerOnly).toBe(1);
    expect(queryLanguage(index, { signal: [SIGNAL.LEARNER_ONLY] })).toHaveLength(1);
  });
});

/* ================================================================== *
 * ج — المقياسُ والتغطية
 * ================================================================== */

describe('WS-J · المقياسُ والتغطية', () => {
  it('ج١ · عشرةُ آلافِ عنصرٍ وثلاثون ألفَ دليل: بناءٌ واستعلامٌ محتمَلان', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const POS = ['noun', 'verb', 'adj', 'adv'];
    const REG = ['formal', 'neutral', 'colloquial'];

    await on(TABLET, async () => {
      const now = Date.now();
      for (let batch = 0; batch < 5; batch++) {
        const items = [];
        const links = [];
        for (let i = 0; i < 2000; i++) {
          const n = batch * 2000 + i;
          const key = `word:слово${n}:default`;
          items.push({
            id: `ANI_perf_${n}`, key, itemType: 'word', lemma: `слово${n}`,
            pos: POS[n % 4], register: REG[n % 3], domain: 'work',
            familyId: `fam${n % 500}`, forms: [`слово${n}`],
            rawOccurrences: 0, realSituations: 0, derivedAppearances: 0,
            derivedSources: 0, unknownOccurrences: 0,
            aiClaimedCount: null, verifyStatus: 'verified',
            analyzedAt: now, analysisSource: 'ai', rev: 1,
          });
          for (let k = 0; k < 3; k++) {
            links.push({
              id: `ANE_perf_${n}_${k}`, itemKey: key, sourceKey: made.RAW.key,
              segmentId: made.RAW.seg, at: k, form: `слово${n}`,
              quote: `слово${n}`, aiNote: null, createdAt: now,
            });
          }
        }
        /* eslint-disable-next-line no-await-in-loop */
        await analysisItems.putManyRaw(items);
        /* eslint-disable-next-line no-await-in-loop */
        await analysisEvidence.putManyRaw(links);
      }
    });

    const t0 = performance.now();
    const index = await on(TABLET, buildIndex);
    const buildMs = performance.now() - t0;

    expect(index.totals.words >= 10000).toBe(true);

    const t1 = performance.now();
    const filtered = queryLanguage(index, {
      pos: ['noun', 'verb'], register: ['formal'], sort: SORT.SITUATIONS,
    });
    const queryMs = performance.now() - t1;

    expect(filtered.length > 0).toBe(true);
    /*
     * ⚠️ **عتبتان مقيستان لا مخترعتان.** قيست على نفس المتصفّح الذي
     *    يشغّل هذه المجموعة؛ والهامشُ واسعٌ لأن جهازَ الاختبار ليس
     *    التابلت. والغرضُ إمساكُ انحدارٍ من رتبةٍ أعلى (مسحٌ داخل حلقة
     *    مثلًا) لا معايرةُ مللي ثانية.
     */
    if (buildMs > 12000) throw new Error(`بناءُ الفهرس بطيء: ${Math.round(buildMs)} م.ث`);
    if (queryMs > 1500) throw new Error(`الاستعلام بطيء: ${Math.round(queryMs)} م.ث`);
    expect(buildMs < 12000).toBe(true);
    expect(queryMs < 1500).toBe(true);

    /*
     * ⚠️ **والرقمُ المقيسُ يُطبَع لا يُخبَّأ.** تقريرٌ يقول «سريع» بلا
     *    رقمٍ لا يُصدَّق ولا يُقارَن بعد ستّة أشهر.
     */
    console.warn(`[perf] WS-J index: ${index.totals.all} عنصر · `
      + `بناء ${Math.round(buildMs)} م.ث · استعلام ${Math.round(queryMs)} م.ث`);
  });

  it('ج٢ · ومخازنُ WS-J الثلاثةُ تدخل النسخةَ الاحتياطيّةَ والمزامنة', async () => {
    for (const store of ['memorySources', 'analysisItems', 'analysisEvidence']) {
      expect(EXPORTABLE_STORES).toContain(store);
      expect(logged(store)).toBe(true);
    }
  });

  it('ج٣ · وعنصرُ تحليلٍ يعبر إلى الجهاز الثاني بالمزامنة', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));

    /* ⚠️ تبادلٌ باتّجاهٍ واحدٍ يكفي هنا: الموبايلُ فارغٌ ولا شيءَ يعود منه. */
    await sendTo(TABLET, MOBILE);

    const there = await on(MOBILE, () => analysisItems.getAll());
    expect(there).toHaveLength(1);
    expect(there[0].key).toBe('word:документ:default');
    /*
     * ⚠️ **وتصنيفُ المنشأ يعبر معه** — وإلّا عاد كلُّ نصٍّ «غيرَ محدَّد»
     *    على الجهاز الثاني، فاختلف رقمُ «المواقف الحقيقية» بين جهازين
     *    يقرآن نفسَ البيانات.
     */
    const rows = await on(MOBILE, () => memorySources.getAll());
    expect(rows.some((row) => row.evidenceClass === EVIDENCE.PRIMARY)).toBe(true);
  });
});

/* ================================================================== *
 * د — حرّاسٌ بنيويّون
 * ================================================================== */

describe('WS-J · حرّاسُ لغتي', () => {
  it('د١ · حسابُ المواقف الحقيقيّة لا يقرأ محفوظاتٍ ولا تدريبًا', async () => {
    /*
     * ⚠️ **حارسٌ يقيس المصدرَ لا النيّة.** لو أضاف أحدٌ غدًا
     *    `one.realSituations += 1` داخل حلقة المحفوظات لَما سقط
     *    اختبارٌ سلوكيٌّ واحدٌ إلّا بحالةٍ بعينها. فهنا نقيس أن الحلقةَ
     *    التي تُنتج الرقمَ تقرأ `analysisEvidence` وحدَها.
     */
    const text = await fetch('../js/services/memory/my-language.js').then((r) => r.text());

    const from = text.indexOf('for (const row of alive(saved))');
    const to = text.indexOf('/* ── ٥.');
    if (from < 0 || to < 0) throw new Error('ما لقيتش كتلةَ إشارات المتعلّم');
    const learnerBlock = text.slice(from, to);

    for (const field of ['realSituations', 'rawOccurrences', 'derivedAppearances']) {
      if (learnerBlock.includes(field)) {
        throw new Error(`كتلةُ المتعلّم تكتب ${field} — دي طبقةٌ تانية`);
      }
    }
    expect(learnerBlock.includes('realSituations')).toBe(false);
  });

  it('د٢ · وشاشةُ لغتي لا تكتب في القاعدة', async () => {
    const text = await fetch('../js/views/my-language-view.js').then((r) => r.text());
    for (const call of ['.create(', '.update(', '.putRaw(', '.putManyRaw(', '.destroy(']) {
      if (text.includes(call)) throw new Error(`الشاشة تكتب مباشرةً: ${call}`);
    }
  });

  it('د٣ · ولوحةُ تاريخِ اللغة من التدريب لا تكتب ولا تبني فهرسًا', async () => {
    const text = await fetch('../js/modals/language-history.js').then((r) => r.text());
    for (const call of ['.create(', '.update(', '.putRaw(', '.destroy(']) {
      if (text.includes(call)) throw new Error(`اللوحة تكتب: ${call}`);
    }
    /* ⚠️ وبناءُ الفهرس داخل جلسةِ تدريبٍ تعليقٌ لا يُغتفَر — راجع ترويستها. */
    expect(text.includes('buildLanguageIndex')).toBe(false);
    expect(text).toContain('cachedLanguage');
  });

  it('د٤ · وكلُّ عمليّةٍ طويلةٍ في مسار لغتي تُري تقدُّمَها', async () => {
    const text = await fetch('../js/views/my-language-view.js').then((r) => r.text());
    expect(text).toContain('withProgress');
    /* ولا إشعارَ «بيتجهّز…» بدلًا من لوحة. */
    expect(/toast\(\s*['"]بيجمّع/.test(text)).toBe(false);
  });

  it('د٥ · وكلُّ كتابةٍ تمسّ لغتك تُبطِل الفهرس', async () => {
    /*
     * ⚠️ **العطبُ الذي يمنعه هذا:** تحفظ كلمةً من التدريب، تفتح
     *    «لغتي»، فلا تجدها — لأن الفهرسَ بُني قبل حفظك.
     */
    const files = [
      'services/saved-service.js',
      'services/shadow/shadow-session-service.js',
      'services/memory/import-v2.js',
    ];
    for (const path of files) {
      /* eslint-disable-next-line no-await-in-loop */
      const text = await fetch(`../js/${path}`).then((r) => r.text());
      if (!text.includes('invalidateLanguage')) {
        throw new Error(`كتابةٌ بلا إبطالٍ للفهرس: ${path}`);
      }
    }
    expect(files).toHaveLength(3);
  });
});

/* ================================================================== *
 * هـ — تجربةُ المنتَج: حقيقةُ المصادر · التغطية · السياق (WS-K)
 * ================================================================== */

describe('WS-K · لوحةُ لغتي', () => {
  it('هـ١ · حقيقةُ المصادر كتلتان ونصفٌ — والمجهولُ لا يندسّ في الأصليّ', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW, GEN: DERIVED, MYSTERY: RAW2 });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.GEN.key, EVIDENCE.DERIVED, ORIGIN.AI_SHADOWING, [keys.RAW.key]);
      /* MYSTERY يبقى غيرَ مصنَّف. */
      return keys;
    });

    await on(TABLET, () => importFile(file([wordItem({
      evidence: [
        { sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' },
        { sourceKey: made.MYSTERY.key, segmentId: made.MYSTERY.seg, quote: 'документы' },
      ],
    })]), { acceptAll: true }));

    const index = await on(TABLET, buildIndex);
    const truth = index.sourceTruth;

    expect(truth.primary.sources).toBe(1);
    expect(truth.primary.realSituations).toBe(1);
    expect(truth.derived.sources).toBe(1);
    expect(truth.unknown.sources).toBe(1);
    /* ═══ والمجهولُ في خانته لا في خانة الأصليّ ═══ */
    expect(truth.unknown.unknownOccurrences).toBe(1);
    expect(truth.primary.rawOccurrences).toBe(1);
  });

  it('هـ٢ · وتغطيةُ التحليل بصيغةٍ مكتوبة: المستبعَدُ خارجَ المقام', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ A: RAW, B: RAW2, C: DERIVED });
      await mark(keys.A.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    /* حُلِّل واحدٌ من ثلاثة. */
    await on(TABLET, async () => {
      const built = await buildPackages({ selected: [made.A.key] });
      await markSent(analyzedHashesOf(built.packages));
      await importFile(file([wordItem({
        evidence: [{ sourceKey: made.A.key, segmentId: made.A.seg, quote: 'Документы' }],
      })], { analyzedSources: [made.A.key] }));
    });

    const before = await on(TABLET, buildIndex);
    expect(before.coverage.eligible).toBe(3);
    expect(before.coverage.covered).toBe(1);
    expect(before.coverage.percent).toBe(33);
    expect(before.coverage.formula.length > 10).toBe(true);

    /*
     * ⚠️ **واستبعادُك نصًّا لا يُعاقَب عليه**: يخرج من المقام فترتفع
     *    التغطيةُ إلى النصف، لا تنخفض.
     */
    const { setExcluded } = await import('../js/services/memory/source-registry.js');
    await on(TABLET, () => setExcluded(made.C.key, true));
    const after = await on(TABLET, buildIndex);
    expect(after.coverage.eligible).toBe(2);
    expect(after.coverage.percent).toBe(50);
  });

  it('هـ٣ · ونصٌّ اتعدّل بعد تحليله يُعَدّ غيرَ مغطًّى', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ A: RAW });
      await mark(keys.A.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    await on(TABLET, async () => {
      const built = await buildPackages({ selected: [made.A.key] });
      await markSent(analyzedHashesOf(built.packages));
      await importFile(file([wordItem({
        evidence: [{ sourceKey: made.A.key, segmentId: made.A.seg, quote: 'Документы' }],
      })], { analyzedSources: [made.A.key] }));
    });
    expect((await on(TABLET, buildIndex)).coverage.percent).toBe(100);

    await on(TABLET, async () => {
      await updateScript(made.A.id, { text: `${RAW} Ещё строка.` });
      await scanSources();
    });
    const after = await on(TABLET, buildIndex);
    expect(after.coverage.percent).toBe(0);
    expect(after.coverage.changed).toBe(1);
  });

  it('هـ٤ · والأكثرُ حضورًا مقياسان يعطيان ترتيبين مختلفين', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ A: RAW, B: RAW2, GEN: DERIVED });
      await mark(keys.A.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.B.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.GEN.key, EVIDENCE.DERIVED, ORIGIN.AI_SHADOWING, [keys.A.key]);
      return keys;
    });

    await on(TABLET, () => importFile(file([
      /* «документ»: موقفان حقيقيّان + ظهوران مولَّدان = ٤ ظهورات. */
      wordItem({
        evidence: [
          { sourceKey: made.A.key, segmentId: made.A.seg, quote: 'Документы' },
          { sourceKey: made.B.key, segmentId: made.B.seg, quote: 'документы' },
        ],
      }),
      /* «согласование»: موقفٌ واحدٌ فقط. */
      wordItem({
        key: 'word:согласование:default', lemma: 'согласование',
        forms: ['согласование'],
        evidence: [{ sourceKey: made.B.key, segmentId: made.B.seg, quote: 'согласование' }],
      }),
    ])));

    const index = await on(TABLET, buildIndex);
    const { topPresent } = await import('../js/services/memory/my-language.js');

    const bySituations = topPresent(index, { by: 'situations' });
    const byOccurrences = topPresent(index, { by: 'occurrences' });

    expect(bySituations[0].lemma).toBe('документ');
    expect(bySituations[0].score).toBe(2);
    /* ═══ والظهوراتُ تشمل المولَّد، فالرقمُ أكبرُ والمعنى مختلف ═══ */
    expect(byOccurrences[0].score).toBe(4);
    expect(byOccurrences[0].score === bySituations[0].score).toBe(false);
  });

  it('هـ٥ · و«أنا علّمت عليهم» لا يدخلها ما لم تلمسه', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));

    const { learnerCurated } = await import('../js/services/memory/my-language.js');
    expect(learnerCurated(await on(TABLET, buildIndex)).total).toBe(0);

    await on(TABLET, () => saveItem({ text: 'документы', kind: SAVED_KIND.WORD }));
    const mine = learnerCurated(await on(TABLET, buildIndex));
    expect(mine.total).toBe(1);
    expect(mine.words).toBe(1);
    expect(mine.saved).toBe(1);
  });

  it('هـ٦ · والاكتشافاتُ الحديثةُ من طوابعَ حقيقيّةٍ — ولا تُختلَق', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    await on(TABLET, () => importFile(file([wordItem({
      evidence: [{ sourceKey: made.RAW.key, segmentId: made.RAW.seg, quote: 'Документы' }],
    })])));
    /* وعنصرُ متعلّمٍ بلا `analyzedAt` أصلًا. */
    await on(TABLET, () => saveItem({ text: 'привет', kind: SAVED_KIND.WORD }));

    const index = await on(TABLET, buildIndex);
    const { recentDiscoveries } = await import('../js/services/memory/my-language.js');
    const found = recentDiscoveries(index, { days: 30 });

    expect(found).toHaveLength(1);
    expect(found[0].lemma).toBe('документ');
    /* ═══ والذي بلا طابعٍ لم يُعطَ تاريخًا ليدخل ═══ */
    expect(index.byKey.get('word:привет:learner')?.analyzedAt).toBeFalsy();
  });

  it('هـ٧ · وكلُّ صيغةٍ بعددها، والوسمُ وجهٌ يُصفّى به', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ A: RAW, B: RAW2 });
      await mark(keys.A.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.B.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });
    await on(TABLET, () => importFile(file([wordItem({
      evidence: [
        { sourceKey: made.A.key, segmentId: made.A.seg, quote: 'Документы' },
        { sourceKey: made.B.key, segmentId: made.B.seg, quote: 'документы' },
      ],
    })])));
    await on(TABLET, () => saveItem({
      text: 'документы', kind: SAVED_KIND.WORD, tagIds: ['hard'],
    }));

    const index = await on(TABLET, buildIndex);
    const one = index.byKey.get('word:документ:default');
    expect(one.formCounts.документы).toBe(2);
    expect(one.savedTags).toContain('hard');

    /* والوجهُ يصفّي فعلًا. */
    expect(queryLanguage(index, { tag: ['hard'] })).toHaveLength(1);
    expect(index.facets.tag.some((t) => t.value === 'hard')).toBe(true);
  });

  it('هـ٨ · وفتحُ المصدر كاملًا يعطي مقاطعَه ويعلّم الموضع', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const { sourceContext, spans, splitHighlights } =
      await import('../js/services/memory/source-context.js');
    const ctx = await on(TABLET, () => sourceContext(made.RAW.key, made.RAW.seg, 'Документы'));

    expect(ctx.missing).toBe(false);
    expect(ctx.title).toBe('RAW');
    expect(ctx.segments.length > 0).toBe(true);
    expect(ctx.segments[0].isTarget).toBe(true);
    expect(ctx.segments[0].hits.length).toBe(1);

    /* والتقسيمُ يعطي أجزاءً لا HTML. */
    const parts = splitHighlights(ctx.segments[0].text, ctx.segments[0].hits);
    expect(parts.some((p) => p.hit)).toBe(true);
    expect(parts.map((p) => p.text).join('')).toBe(ctx.segments[0].text);

    /*
     * ⚠️ **وحدودُ الكلمات هنا كحدودها في العدّ.** لو أبرزنا «дом»
     *    داخل «домашний» لَاختلف ما تراه عمّا يُعَدّ.
     */
    expect(spans('домашний дом', 'дом')).toHaveLength(1);
  });

  it('هـ٩ · ومصدرٌ اتشال يقول إنه اتشال ولا يفتح شاشةً فاضية', async () => {
    await resetDevices();
    await on(TABLET, () => seed({ RAW }));
    const { sourceContext } = await import('../js/services/memory/source-context.js');
    const ctx = await on(TABLET, () => sourceContext('script:SCR_مش_موجود', null, 'x'));
    expect(ctx.missing).toBe(true);
    expect(ctx.segments).toHaveLength(0);
  });
});

describe('WS-K · حرّاسُ اللوحة', () => {
  it('و١ · ولا رقمَ مكتوبٌ بيدٍ في شاشة لغتي', async () => {
    /*
     * ⚠️ **حارسٌ ضدّ «لوحةٍ للعرض».** أسهلُ طريقةٍ لجعل الشاشة تبدو
     *    كصورة المرجع أن تُكتَب أرقامُها. فالمقاييسُ كلُّها تمرّ من
     *    `totals`/`sourceTruth`/`coverage`، ولا رقمَ ثلاثيَّ الخانات
     *    في نصّ الشاشة.
     */
    const text = await fetch('../js/views/my-language-view.js').then((r) => r.text());
    const body = text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
    const suspicious = [...body.matchAll(/>\s*([0-9]{3,})\s*</g)].map((m) => m[1]);
    if (suspicious.length) throw new Error(`رقمٌ مكتوبٌ بيد: ${suspicious.join(', ')}`);
    expect(text).toContain('built.totals');
    expect(text).toContain('built.sourceTruth');
  });

  it('و٢ · وخدمةُ السياق لا تبني HTML', async () => {
    /*
     * ⚠️ **بناءُ `<mark>` في خدمةٍ يعني نصًّا غيرَ مهرَّبٍ يمرّ للشاشة.**
     *    وهو بابُ ثغرةٍ افتُتح مرّةً في هذا المشروع، فالخدمةُ تعطي
     *    أجزاءً والشاشةُ تهرّبها.
     */
    const text = await fetch('../js/services/memory/source-context.js').then((r) => r.text());
    const body = text.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body.includes('<mark')).toBe(false);
    expect(body.includes('innerHTML')).toBe(false);
  });

  it('و٣ · وقصّةُ الحياة لوحةٌ لا تنقُّل — فالتصفيةُ لا تضيع', async () => {
    const text = await fetch('../js/views/my-language-view.js').then((r) => r.text());
    const at = text.indexOf("if (action === 'ml-open')");
    const end = text.indexOf("if (action === 'ml-close')");
    const block = text.slice(at, end);
    /* فتحُ القصّة لا ينادي `navigate` — وإلّا أُعيد رسمُ الشاشة من الصفر. */
    expect(block.includes('navigate(')).toBe(false);
    expect(block).toContain('paintStory');
  });

  it('و٤ · والتبويباتُ العليا أنواعٌ لا أوجه', async () => {
    /*
     * ⚠️ جعلُ «فعل» أو «عامّي» تبويبًا أعلى يمنع «فعل عامّي» أصلًا،
     *    لأن التبويبَ واحدٌ لا يُجمَع.
     */
    const text = await fetch('../js/views/my-language-view.js').then((r) => r.text());
    const at = text.indexOf('const TABS = [');
    const block = text.slice(at, text.indexOf('];', at));
    for (const facetish of ['noun', 'verb', 'formal', 'colloquial', 'عامي', 'مهني']) {
      if (block.includes(facetish)) throw new Error(`وجهٌ تسلّل للتبويبات: ${facetish}`);
    }
    expect(block).toContain('ITEM_TYPE.WORD');
  });
});

/**
 * LingoLife — استيرادُ نتيجة التحليل بالتحقّق (WS-J · بنود ١٢ و١٣ و٢٦)
 *
 * ⚠️ **والاختبارُ الحاكمُ هنا: استشهادٌ لا يصمد على النصّ لا يُخزَّن —
 *    ولو وافق المستخدمُ على العنصر.** لأن العنصرَ رأيٌ له أن يقبله،
 *    والاستشهادَ ادّعاءٌ عن نصِّه هو، وهذا لا يُقبَل بالموافقة بل
 *    بالمطابقة.
 *
 * ⚠️ **ولا يُسمَح لمحاكٍ أن يثبت نفسَه** (قاعدةٌ من WS-H): كلُّ ما
 *    يُختبَر هنا يمرّ على النصوص الحقيقيّة في القاعدة عبر
 *    `readLiveSources`، لا على قائمةِ مقاطعَ نبنيها في الاختبار.
 */

import { describe, it, expect } from './test-runner.js';
import { resetDevices, on, TABLET } from './sync-devices.js';

import { scenes, analysisItems, analysisEvidence, memorySources } from '../js/db/repositories.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import { EVIDENCE, ORIGIN } from '../js/services/memory/provenance.js';
import {
  scanSources, listSources, classifySource, keyOf, markSent, ANALYSIS_STATE,
} from '../js/services/memory/source-registry.js';
import { buildPackages, analyzedHashesOf, CONTRACT } from '../js/services/memory/export-v2.js';
import { VERIFY } from '../js/services/memory/counting.js';
import { isRunning } from '../js/components/progress.js';
import {
  parseAnalysis, planImport, applyImport, importTotals,
  VERDICT, FORBIDDEN, RESULT_FORMAT, RESULT_VERSION, evidenceId,
} from '../js/services/memory/import-v2.js';

/* ------------------------------------------------------------------ *
 * أدوات
 * ------------------------------------------------------------------ */

const RAW_TEXT = 'Документы необходимо предоставить заказчику.';
const DERIVED_TEXT = 'Документы должны быть полными. Документы проверяются. '
  + 'Документы необходимо предоставить.';

async function seed(texts) {
  const scene = await scenes.create({ titleAr: 'موقف حقيقي', date: '2026-02-02' });
  const made = {};
  for (const [name, text] of Object.entries(texts)) {
    /* eslint-disable-next-line no-await-in-loop */
    const script = await addScript(scene.id, { title: name, text });
    made[name] = { key: keyOf('script', script.id), id: script.id };
  }
  await scanSources();
  return made;
}

const mark = (key, evidenceClass, originType, derivedFrom = []) =>
  classifySource(key, { evidenceClass, originType, derivedFrom });

/** ينتظر شرطًا في الـDOM — النوافذُ ترسم بعد `await` لا فورًا. */
async function settle(check, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const value = check();
    if (value) return value;
    /* eslint-disable-next-line no-await-in-loop */
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('الشرط ما تحقّقش في الوقت المسموح');
}

const overlays = () => [...document.querySelectorAll('.overlay')];
const topOverlay = () => overlays()[overlays().length - 1];
const topModal = () => topOverlay()?.querySelector('.modal');
const closeAll = () => overlays().forEach((one) => one.__close?.(null));

/**
 * ينتظر حتى يُفرَج مفتاحُ التقدُّم قبل فتح الشاشة ثانيةً.
 *
 * ⚠️ **وهذا حارسُ المنتَج يعمل، لا عطبٌ فيه.** `withProgress` تمنع
 *    تشغيلًا ثانيًا بنفس المفتاح ما دام الأوّلُ حيًّا — وبطاقةُ التقدُّم
 *    تبقى حيّةً لحظاتٍ بعد انتهائها (حركةُ الخروج). فاختبارٌ يفتح
 *    الشاشةَ مرّتين متلاحقتين يُرفَض فتحُه الثاني بحقّ. وقد كلّفني
 *    هذا فشلَين قرأتُهما أوّلَ الأمر «النافذة ما فتحتش».
 */
const idle = (key) => settle(() => !isRunning(key));

/** مقطعُ سكريبتٍ واحدٍ معرِّفُه ثابتٌ — كما يبنيه `readLiveSources`. */
const segOf = (one) => `${one.id}#0`;

/** ملفُّ نتيجةٍ صغير. */
const result = (items, extra = {}) => ({
  format: RESULT_FORMAT,
  version: RESULT_VERSION,
  part: 1,
  parts: 1,
  analyzedSources: [],
  items,
  ...extra,
});

const item = (over = {}) => ({
  key: 'word:документ:default',
  itemType: 'word',
  lemma: 'документ',
  forms: ['документы', 'документ'],
  meaningAr: 'مستند',
  claimedCount: null,
  evidence: [],
  ...over,
});

/* ================================================================== *
 * أ — القراءةُ والرفض
 * ================================================================== */

describe('WS-J · قراءةُ نتيجة التحليل', () => {
  it('أ١ · يرفض ما ليس من الصيغة بدل أن يبتلعه', () => {
    let caught = '';
    try {
      parseAnalysis(JSON.stringify({ format: 'something-else', version: 2 }));
    } catch (error) { caught = error.message; }
    expect(caught.length > 0).toBe(true);
  });

  it('أ٢ · ولا «ينقذ» JSON من داخل كلامٍ محيط', () => {
    let caught = '';
    try {
      parseAnalysis(`طبعًا! إليك التحليل: ${JSON.stringify(result([item()]))}`);
    } catch (error) { caught = error.message; }
    /* ⚠️ لو التقطنا أوّلَ `{` لَقبِلنا نصفَ ملفٍّ مبتورٍ بصمت. */
    expect(caught.length > 0).toBe(true);
  });

  it('أ٣ · ويرفض إصدارًا غير مدعوم', () => {
    let caught = '';
    try {
      parseAnalysis(JSON.stringify({ format: RESULT_FORMAT, version: 99, items: [] }));
    } catch (error) { caught = error.message; }
    expect(caught.length > 0).toBe(true);
  });

  it('أ٤ · الحقولُ التي يملكها التطبيقُ تُسقَط — وتُعرَض أنها أُسقِطت', () => {
    const parsed = parseAnalysis(JSON.stringify(result([
      item({ realSituations: 34, practiceCount: 9, firstSeenAt: 111 }),
    ])));

    const one = parsed.items[0];
    expect(one.realSituations === undefined).toBe(true);
    expect(one.practiceCount === undefined).toBe(true);
    expect(one.firstSeenAt === undefined).toBe(true);
    expect(parsed.dropped.length).toBe(3);
    expect(parsed.dropped.map((d) => d.field).join(' ')).toContain('realSituations');
  });

  it('أ٥ · وقائمةُ الممنوع تشمل كلَّ ما يضخّم رقمًا (بند ٢)', () => {
    for (const field of ['realSituations', 'rawOccurrences', 'derivedAppearances',
      'practiceCount', 'mistakeCount', 'firstSeenAt', 'total']) {
      expect(FORBIDDEN).toContain(field);
    }
  });

  it('أ٦ · وشكلُ الردّ الموصوفُ في الحزمة هو نفسُه ما يقبله المستورِد', () => {
    /*
     * ⚠️ **عقدٌ واحدٌ لا وصفان.** لو وصفنا الشكلَ في الحزمة والمستوردُ
     *    يقرأ شكلًا آخرَ لَصار كلُّ ردٍّ صحيحٍ مرفوضًا، ولَظنّ المستخدمُ
     *    أن التحليلَ أخطأ.
     */
    const parsed = parseAnalysis(JSON.stringify(CONTRACT.responseFormat));
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].claimedCount).toBe(12);
    expect(parsed.items[0].evidence.length).toBe(1);
    expect(parsed.analyzedSources.length).toBe(1);
    expect(parsed.removed.length).toBe(1);
  });
});

/* ================================================================== *
 * ب — الاستشهادُ يُفتَح على نصّه
 * ================================================================== */

describe('WS-J · الاستشهادُ يُفتَح على نصّه', () => {
  it('ب١ · استشهادٌ صحيحٌ يمرّ ويُعَدّ سليمًا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        evidence: [{
          sourceKey: made.RAW.key,
          segmentId: segOf(made.RAW),
          quote: 'Документы необходимо',
        }],
      })]))),
    }));

    expect(plan.rows[0].verdict).toBe(VERDICT.CLEAN);
    expect(plan.rows[0].evidence.kept.length).toBe(1);
    expect(plan.rows[0].evidence.rejected.length).toBe(0);
    expect(plan.rows[0].accept).toBe(true);
  });

  it('ب٢ · مصدرٌ لا وجودَ له يُرفَض ويُحجَب العنصرُ افتراضيًّا', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
    });

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        evidence: [{ sourceKey: 'script:SCR_مخترَع', segmentId: 'SCR_مخترَع#0', quote: 'شيء' }],
      })]))),
    }));

    expect(plan.rows[0].verdict).toBe(VERDICT.BLOCKED);
    expect(plan.rows[0].accept).toBe(false);
    expect(plan.rows[0].evidence.rejected[0].why).toContain('مصدر');
  });

  it('ب٣ · ومقطعٌ لا وجودَ له في مصدرٍ موجود يُرفَض كذلك', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        evidence: [{ sourceKey: made.RAW.key, segmentId: 'مقطع-مخترَع', quote: 'Документы' }],
      })]))),
    }));

    expect(plan.rows[0].verdict).toBe(VERDICT.BLOCKED);
    expect(plan.rows[0].evidence.rejected[0].why).toContain('مقطع');
  });

  it('ب٤ · واقتباسٌ ليس في النصّ يُرفَض ولو كان المصدرُ والمقطعُ صحيحين', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        evidence: [{
          sourceKey: made.RAW.key,
          segmentId: segOf(made.RAW),
          /* جملةٌ لم تُكتَب قطّ في هذا النصّ. */
          quote: 'Мы направили счёт в банк',
        }],
      })]))),
    }));

    expect(plan.rows[0].verdict).toBe(VERDICT.BLOCKED);
    expect(plan.rows[0].evidence.rejected[0].why).toContain('الاقتباس');
  });
});

/* ================================================================== *
 * ج — العدُّ يُعاد لا يُصدَّق
 * ================================================================== */

describe('WS-J · العدُّ يُعاد لا يُصدَّق', () => {
  it('ج١ · عددٌ مطابقٌ يُسجَّل «متطابق»', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        claimedCount: 1,
        evidence: [{
          sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
        }],
      })]))),
    }));

    expect(plan.rows[0].count.status).toBe(VERIFY.VERIFIED);
    expect(plan.rows[0].count.counted).toBe(1);
  });

  it('ج٢ · وادّعاءٌ مضخَّمٌ يُرفَع للمراجعة ولا يُخزَّن مكانَ عدِّنا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        claimedCount: 34,
        evidence: [{
          sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
        }],
      })]))),
    }));

    const row = plan.rows[0];
    expect(row.verdict).toBe(VERDICT.REVIEW);
    expect(row.count.status).toBe(VERIFY.REVIEW);
    expect(row.count.claimed).toBe(34);
    expect(row.count.counted).toBe(1);

    await on(TABLET, async () => {
      row.accept = true;
      await applyImport(plan);
    });
    const [stored] = await on(TABLET, () => analysisItems.getAll());
    /* ═══ عدُّ التطبيق هو المخزَّن، وادّعاءُ التحليل بجانبه لا مكانَه ═══ */
    expect(stored.rawOccurrences).toBe(1);
    expect(stored.aiClaimedCount).toBe(34);
    expect(stored.verifyStatus).toBe(VERIFY.REVIEW);
  });

  it('ج٣ · والمولَّدُ لا يزيد المواقفَ الحقيقيّة ولو تكرّرت الكلمةُ فيه', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, DERIVED: DERIVED_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.DERIVED.key, EVIDENCE.DERIVED, ORIGIN.AI_IMPROVED, [keys.RAW.key]);
      return keys;
    });

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        evidence: [{
          sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
        }],
      })]))),
    }));

    const row = plan.rows[0];
    expect(row.measured.rawOccurrences).toBe(1);
    expect(row.measured.realSituations).toBe(1);
    /* ثلاثُ «Документы» في النصّ المولَّد. */
    expect(row.measured.derivedAppearances).toBe(3);

    const totals = importTotals(plan.rows);
    expect(totals.realSituations).toBe(1);
    expect(totals.derivedAppearances).toBe(3);
    /* ═══ ولا مجموعَ يقول «٤ ظهورات حقيقيّة» ═══ */
    expect(totals.rawOccurrences === 4).toBe(false);
  });

  it('ج٤ · ومصدرٌ غيرُ مصنَّفٍ يُعَدّ ويُقال ولا يدخل المواقفَ', async () => {
    await resetDevices();
    const made = await on(TABLET, () => seed({ RAW: RAW_TEXT }));

    const plan = await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        evidence: [{
          sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
        }],
      })]))),
    }));

    const row = plan.rows[0];
    expect(row.measured.unknownOccurrences).toBe(1);
    expect(row.measured.realSituations).toBe(0);
    expect(row.onlyUnknown).toBe(true);
    expect(row.verdict).toBe(VERDICT.REVIEW);
  });
});

/* ================================================================== *
 * د — لا كتابةَ قبل الموافقة
 * ================================================================== */

describe('WS-J · لا كتابةَ قبل الموافقة', () => {
  it('د١ · الخطّةُ وحدَها لا تكتب صفًّا واحدًا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, () => planImport({
      parsed: parseAnalysis(JSON.stringify(result([item({
        evidence: [{
          sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
        }],
      })]))),
    }));

    expect(await on(TABLET, () => analysisItems.getAll())).toHaveLength(0);
    expect(await on(TABLET, () => analysisEvidence.getAll())).toHaveLength(0);
  });

  it('د٢ · وما لم تقبله لا يُكتَب', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const done = await on(TABLET, async () => {
      const plan = await planImport({
        parsed: parseAnalysis(JSON.stringify(result([
          item({
            evidence: [{
              sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
            }],
          }),
          item({ key: 'word:второй:default', lemma: 'второй', forms: ['второй'] }),
        ]))),
      });
      plan.rows[1].accept = false;
      return applyImport(plan);
    });

    expect(done.added).toBe(1);
    expect(done.skipped).toBe(1);
    const stored = await on(TABLET, () => analysisItems.getAll());
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe('word:документ:default');
  });

  it('د٣ · واستشهادٌ مخترَعٌ لا يُخزَّن ولو قبِلتَ العنصرَ بيدك', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, async () => {
      const plan = await planImport({
        parsed: parseAnalysis(JSON.stringify(result([item({
          evidence: [
            { sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы' },
            { sourceKey: 'script:SCR_مخترَع', segmentId: 'SCR_مخترَع#0', quote: 'كلام' },
          ],
        })]))),
      });
      expect(plan.rows[0].verdict).toBe(VERDICT.BLOCKED);
      /* المستخدمُ يقبل العنصرَ رغم الحجب. */
      plan.rows[0].accept = true;
      await applyImport(plan);
    });

    expect(await on(TABLET, () => analysisItems.getAll())).toHaveLength(1);
    const links = await on(TABLET, () => analysisEvidence.getAll());
    /* ═══ موضعٌ واحدٌ محسوبٌ من النصّ — ولا أثرَ للمصدر المخترَع ═══ */
    expect(links).toHaveLength(1);
    expect(links[0].sourceKey).toBe(made.RAW.key);
    expect(links.some((one) => one.sourceKey.includes('مخترَع'))).toBe(false);
  });
});

/* ================================================================== *
 * هـ — ما يُكتَب وكيف
 * ================================================================== */

describe('WS-J · ما يُكتَب وكيف', () => {
  it('هـ١ · العنصرُ يُخزَّن بمقاييسَ منفصلةٍ ولا حقلَ اسمُه total', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT, DERIVED: DERIVED_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      await mark(keys.DERIVED.key, EVIDENCE.DERIVED, ORIGIN.AI_IMPROVED, [keys.RAW.key]);
      return keys;
    });

    await on(TABLET, async () => {
      const plan = await planImport({
        parsed: parseAnalysis(JSON.stringify(result([item({
          evidence: [{
            sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
          }],
        })]))),
      });
      await applyImport(plan);
    });

    const [stored] = await on(TABLET, () => analysisItems.getAll());
    expect(stored.rawOccurrences).toBe(1);
    expect(stored.realSituations).toBe(1);
    expect(stored.derivedAppearances).toBe(3);
    /*
     * ═══ ولا حقلَ مجموعٍ واحد ═══
     * وجودُه يغري بعرضه، وعرضُه هو الجملةُ التي يمنعها البندُ ٢.
     */
    expect(stored.total === undefined).toBe(true);
    expect(stored.count === undefined).toBe(true);
    expect(stored.occurrences === undefined).toBe(true);
  });

  it('هـ٢ · وإعادةُ الاستيراد تُحدِّث ولا تُضاعف', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const file = JSON.stringify(result([item({
      evidence: [{ sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы' }],
    })]));

    const twice = await on(TABLET, async () => {
      const one = await applyImport(await planImport({ parsed: parseAnalysis(file) }));
      const two = await applyImport(await planImport({ parsed: parseAnalysis(file) }));
      return { one, two };
    });

    expect(twice.one.added).toBe(1);
    expect(twice.two.added).toBe(0);
    expect(twice.two.updated).toBe(1);
    expect(await on(TABLET, () => analysisItems.getAll())).toHaveLength(1);
    /* ⚠️ ومعرِّفُ الوصلة حتميّ — فلا صفَّ دليلٍ مكرَّر. */
    expect(await on(TABLET, () => analysisEvidence.getAll())).toHaveLength(1);
  });

  it('هـ٣ · ومعرِّفُ الوصلة يفصل أجزاءه بمحرفٍ مرئيّ', () => {
    /*
     * ⚠️ **وقعت في هذا مرّتين** (راجع `baseline.js`): فاصلٌ غيرُ مرئيٍّ
     *    يجعل الملفَّ ثنائيًّا في عين `grep`، وحذفُه يلصق المفتاحين
     *    فيتصادمان بصمت.
     */
    const a = evidenceId('ab', 'c', 'd', 0);
    const b = evidenceId('a', 'bc', 'd', 0);
    expect(a === b).toBe(false);
    for (const ch of a) expect(ch.charCodeAt(0) >= 32).toBe(true);
  });
});

/* ================================================================== *
 * و — «أُرسِل» ليست «حُلِّل»
 * ================================================================== */

describe('WS-J · إيصالُ الإرسال', () => {
  it('و١ · النسخُ يسجّل «أُرسِل» ولا يغيّر حالةَ التحليل', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    await on(TABLET, async () => {
      const built = await buildPackages({ selected: [made.RAW.key] });
      await markSent(analyzedHashesOf(built.packages));
    });

    const row = await on(TABLET, () => memorySources.get(made.RAW.key));
    expect(row.sentHash.length).toBe(64);
    /* ═══ ولم يصر محلَّلًا بمجرّد النسخ ═══ */
    expect(row.analyzedHash).toBeFalsy();
    const [meta] = await on(TABLET, () => listSources());
    expect(meta.analysisState).toBe(ANALYSIS_STATE.NEVER);
  });

  it('و٢ · والاستيرادُ يعلّم بالبصمةِ المُرسَلة لا بالتي في القاعدة الآن', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const sent = await on(TABLET, async () => {
      const built = await buildPackages({ selected: [made.RAW.key] });
      await markSent(analyzedHashesOf(built.packages));
      return (await memorySources.get(made.RAW.key)).sentHash;
    });

    /* ⚠️ التعديلُ يقع **أثناء** دورة التحليل — وهو ما يكشف العطب. */
    await on(TABLET, async () => {
      await updateScript(made.RAW.id, { text: `${RAW_TEXT} Ещё одна строка.` });
      await scanSources();
    });

    await on(TABLET, async () => {
      const plan = await planImport({
        parsed: parseAnalysis(JSON.stringify(result([item({
          evidence: [{
            sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
          }],
        })], { analyzedSources: [made.RAW.key] }))),
      });
      await applyImport(plan);
    });

    const row = await on(TABLET, () => memorySources.get(made.RAW.key));
    expect(row.analyzedHash).toBe(sent);
    expect(row.analyzedHash === row.contentHash).toBe(false);
    /* ═══ فالنصُّ المعدَّل يبقى «اتعدّل بعد آخر تحليل» ويُقترَح ثانيةً ═══ */
    const [meta] = await on(TABLET, () => listSources());
    expect(meta.analysisState).toBe(ANALYSIS_STATE.CHANGED);
  });

  it('و٣ · وما لم يُرسَل من هذا الجهاز لا يُعلَّم — ويُقال', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const keys = await seed({ RAW: RAW_TEXT });
      await mark(keys.RAW.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
      return keys;
    });

    const done = await on(TABLET, async () => {
      const plan = await planImport({
        parsed: parseAnalysis(JSON.stringify(result([item({
          evidence: [{
            sourceKey: made.RAW.key, segmentId: segOf(made.RAW), quote: 'Документы',
          }],
        })], { analyzedSources: [made.RAW.key] }))),
      });
      return applyImport(plan);
    });

    expect(done.marked).toBe(0);
    expect(done.unmarked).toBe(1);
    const row = await on(TABLET, () => memorySources.get(made.RAW.key));
    expect(row.analyzedHash).toBeFalsy();
  });
});

/* ================================================================== *
 * ز — حرّاسٌ بنيويّون
 * ================================================================== */

describe('WS-J · حرّاسُ الاستيراد', () => {
  it('ز١ · شاشةُ الاستيراد لا تكتب في القاعدة بنفسها', async () => {
    /*
     * ⚠️ **بابٌ لا منطق.** لحظةَ تكتب النافذةُ صفًّا بنفسها يصير القرارُ
     *    غيرَ قابلٍ للاختبار بلا متصفّح — وهذا بالضبط كيف تتسرّب
     *    الكتابةُ قبل الموافقة.
     */
    const text = await fetch('../js/modals/memory-import.js').then((r) => r.text());
    for (const call of ['.create(', '.update(', '.putRaw(', '.putManyRaw(', '.destroy(']) {
      if (text.includes(call)) throw new Error(`نافذةُ الاستيراد تكتب مباشرةً: ${call}`);
    }
    expect(text).toContain('applyImport');
  });

  it('ز٢ · ولا زرَّ «اقبل الكل» يلغي المراجعة', async () => {
    const text = await fetch('../js/modals/memory-import.js').then((r) => r.text());
    /* موافقةٌ جماعيّةٌ بضغطةٍ تعني أن الشاشةَ لم تُقرَأ أصلًا. */
    expect(/data-mi(-[a-z]+)?="accept-all"/.test(text)).toBe(false);
    expect(/forEach\(\s*\(?\w+\)?\s*=>\s*\{?\s*\w+\.accept\s*=\s*true/.test(text)).toBe(false);
  });

  it('ز٤ · والشاشتان تفتحان فعلًا وتُغلَقان بلا خطأ', async () => {
    /*
     * ⚠️ **استيرادُ الوحدة لا يثبت أنها تعمل.** «فحصُ رسم الوحدات»
     *    يستوردها فقط؛ وهذا يفتحها ويقرأ ما رسمَته ثم يغلقها.
     */
    await resetDevices();
    await on(TABLET, () => seed({ RAW: RAW_TEXT }));

    const { openAnalysisImport } = await import('../js/modals/memory-import.js');
    const promise = openAnalysisImport();
    await settle(() => document.querySelector('[data-mi-text]'));
    expect(Boolean(document.querySelector('[data-mi-text]'))).toBe(true);
    topOverlay().__close(null);
    await promise;
    expect(document.querySelectorAll('.overlay')).toHaveLength(0);
  });

  it('ز٣ · والمستوردُ لا يكتب حقلًا من قائمة الممنوع', async () => {
    const text = await fetch('../js/services/memory/import-v2.js').then((r) => r.text());
    /* نقرأ ما يُبنى في `fields` وحدَه — لا الملفَّ كلَّه. */
    const at = text.indexOf('const fields = {');
    const end = text.indexOf('};', at);
    const block = text.slice(at, end);
    for (const field of ['practiceCount', 'timesUsed', 'mistakeCount', 'firstSeenAt']) {
      if (new RegExp(`\\b${field}\\s*:`).test(block)) {
        throw new Error(`المستوردُ يكتب حقلًا يملكه التطبيق: ${field}`);
      }
    }
    /* ولا حقلَ مجموعٍ واحد. */
    expect(/\btotal\s*:/.test(block)).toBe(false);
  });
});

/* ================================================================== *
 * ح — أعطابٌ وقعت في التجربة الحيّة (لا في الوحدة)
 *
 * ⚠️ **هذه الأربعةُ لم يكشفها اختبارٌ واحد.** كلُّ محرّكٍ كان سليمًا،
 *    والعطبُ في الوصل: زرٌّ يموت، وشارةٌ لا تتغيّر، واختيارٌ يُحسَب
 *    مرّةً. فمكانُ الاختبار حيث وقع العطبُ — في الشاشة نفسِها.
 * ================================================================== */

describe('WS-J · أعطابُ الشاشة الحيّة', () => {
  it('ح١ · إرسالٌ بلا لصقٍ لا يقتل زرَّ الإرسال', async () => {
    /*
     * ⚠️ `showModal` تعطّل الزرَّ قبل `onSubmit` وتعيد تفعيلَه **عند
     *    الرمي وحدَه**. فكلُّ خروجٍ مؤدَّبٍ كان يترك نافذةً بزرٍّ لا
     *    يُضغَط: يصحّح المستخدمُ ما نبّهناه عليه ثم لا يجد بابًا.
     */
    await resetDevices();
    await on(TABLET, () => seed({ RAW: RAW_TEXT }));

    const { openAnalysisImport } = await import('../js/modals/memory-import.js');
    const promise = openAnalysisImport();
    await settle(() => document.querySelector('[data-mi-text]'));

    const submit = topModal().querySelector('button[type="submit"]');
    submit.click();
    await settle(() => submit.disabled === false);
    expect(submit.disabled).toBe(false);

    closeAll();
    await promise;
  });

  it('ح٢ · تصنيفُ نصٍّ يغيّر الشارةَ التي أمامك', async () => {
    /* كانت `repaint()` ترسم القائمةَ خلف النافذة وحدَها. */
    await resetDevices();
    await on(TABLET, () => seed({ RAW: RAW_TEXT }));

    const { openMemoryReview } = await import('../js/modals/memory-review.js');
    await idle('memory-scan');
    const promise = openMemoryReview();
    await settle(() => document.querySelector('.mr-title'));

    document.querySelector('.mr-title').click();
    const select = await settle(() => document.querySelector('[data-mr-origin]'));
    expect(topModal().querySelector('[data-mr-badge]').textContent.trim()).toBe('غير محدَّد');

    select.value = 'raw_transcript';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(() => topModal().querySelector('[data-mr-badge]')?.textContent.trim() === 'محتوى أصلي');
    expect(topModal().querySelector('[data-mr-badge]').textContent.trim()).toBe('محتوى أصلي');

    closeAll();
    await promise;
  });

  it('ح٣ · وما صنّفتَه أصليًّا يدخل الاختيارَ بلا إعادة فتح', async () => {
    /*
     * ⚠️ العطبُ الأصليّ: `suggestSelection()` تُحسَب مرّةً عند الفتح
     *    وكلُّ شيءٍ يومَها مجهول. فتصنّف نصًّا — وهو الفعلُ الذي جئتَ
     *    من أجله — ثم يقال لك «اختار نص واحد على الأقل».
     */
    await resetDevices();
    await on(TABLET, () => seed({ RAW: RAW_TEXT }));

    const { openMemoryReview } = await import('../js/modals/memory-review.js');
    await idle('memory-scan');
    const promise = openMemoryReview();
    await settle(() => document.querySelector('.mr-title'));

    const picked = () => document.querySelectorAll('[data-mr-toggle][aria-pressed="true"]').length;
    expect(picked()).toBe(0);

    document.querySelector('.mr-title').click();
    const select = await settle(() => document.querySelector('[data-mr-origin]'));
    select.value = 'raw_transcript';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(() => picked() === 1);
    expect(picked()).toBe(1);

    closeAll();
    await promise;
  });

  it('ح٤ · وما نزعتَه بيدك لا يعيده الاقتراح', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const keys = await seed({ A: RAW_TEXT, B: 'Мы направили счёт заказчику.' });
      await mark(keys.A.key, EVIDENCE.PRIMARY, ORIGIN.RAW_TRANSCRIPT);
    });

    const { openMemoryReview } = await import('../js/modals/memory-review.js');
    await idle('memory-scan');
    const promise = openMemoryReview();
    await settle(() => document.querySelector('[data-mr-toggle]'));

    const picked = () => [...document.querySelectorAll('[data-mr-toggle]')]
      .filter((one) => one.getAttribute('aria-pressed') === 'true')
      .map((one) => one.dataset.mrToggle);

    const [first] = picked();
    expect(Boolean(first)).toBe(true);

    /* انزعه بيدك… */
    document.querySelector(`[data-mr-toggle="${first}"]`).click();
    await settle(() => !picked().includes(first));

    /* …ثم صنّف النصَّ الآخر: التحديثُ يجب ألّا يعيد المنزوع. */
    const other = [...document.querySelectorAll('.mr-title')]
      .find((node) => node.closest('[data-mr-row]').dataset.mrRow !== first);
    other.click();
    const select = await settle(() => document.querySelector('[data-mr-origin]'));
    select.value = 'raw_transcript';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(() => picked().length === 1);

    expect(picked().includes(first)).toBe(false);

    closeAll();
    await promise;
  });
});

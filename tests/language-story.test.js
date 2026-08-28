/**
 * LingoLife — قصّةُ العنصر والمتحدّثون والاستمراريّة (WS-L · بنود ٣٠…٥٤)
 *
 * ⚠️ **الشرطُ الحاكمُ هنا واحد: رقمٌ عن حياتك لا يملؤه غيرُك.**
 *    اقتراحُ التحليل ليس غلطتَك، والنسخةُ المولَّدةُ ليست موقفًا، ووقتُ
 *    كتابة الصفّ ليس وقتَ الحدث. وكلُّ اختبارٍ هنا يمنع واحدةً من هذه
 *    الثلاث من التسلّل إلى ما تقرؤه عن نفسك.
 *
 * ⚠️ **ولا كائناتٍ مصنوعةً في الاختبار**: الصفوفُ تُكتَب بالمستودعات
 *    نفسِها التي يكتب بها التطبيق، والقصّةُ تُبنى من القاعدة.
 */

import { describe, it, expect } from './test-runner.js';
import { resetDevices, on, TABLET } from './sync-devices.js';

import {
  scenes, savedItems, practiceEvidence, mistakeComparisons, media,
  conversations, conversationParts, analysisItems,
} from '../js/db/repositories.js';
import { EXPORTABLE_STORES } from '../js/db/schema.js';
import { logged } from '../js/services/sync/sync-policy.js';
import { addScript } from '../js/services/content-service.js';
import { EVIDENCE, ORIGIN } from '../js/services/memory/provenance.js';
import { ORIGIN as INFO_ORIGIN } from '../js/services/memory/identity.js';
import {
  scanSources, classifySource, keyOf, markSent,
} from '../js/services/memory/source-registry.js';
import {
  parseAnalysis, planImport, applyImport, RESULT_FORMAT, RESULT_VERSION,
} from '../js/services/memory/import-v2.js';
import { buildLanguageIndex, evidenceOf } from '../js/services/memory/my-language.js';
import { invalidateLanguage } from '../js/services/memory/language-cache.js';
import { sourceContext } from '../js/services/memory/source-context.js';
import { analysisSnapshot } from '../js/services/memory/analysis-state.js';
import {
  itemStory, classifyMistake, timelineOf, describeDerived, reasonsFor,
  MISTAKE_KIND, EVENT,
} from '../js/services/memory/item-story.js';

/* ------------------------------------------------------------------ *
 * أدوات
 * ------------------------------------------------------------------ */

const RAW = 'Документы необходимо предоставить заказчику.';
const GEN = 'Документы должны быть полными. Документы проверяются каждый день.';

const file = (items, extra = {}) => JSON.stringify({
  format: RESULT_FORMAT, version: RESULT_VERSION, part: 1, parts: 1,
  analyzedSources: [], items, ...extra,
});

const DOC = (over = {}) => ({
  key: 'word:документ:default',
  itemType: 'word',
  lemma: 'документ',
  pos: 'noun',
  register: 'formal',
  domain: 'work',
  forms: ['документ', 'документы'],
  evidence: [],
  ...over,
});

async function importFile(text) {
  const plan = await planImport({ parsed: parseAnalysis(text) });
  for (const row of plan.rows) row.accept = true;
  return applyImport(plan);
}

/** يبني الفهرسَ من القاعدة ويُرجع عنصرًا واحدًا بأدلّته. */
async function storyOf(key) {
  invalidateLanguage();
  const built = await buildLanguageIndex();
  const item = built.items.find((one) => one.key === key);
  if (!item) throw new Error(`عنصرٌ غيرُ موجود: ${key}`);
  const evidence = await evidenceOf(key);
  return { item, evidence, story: await itemStory(item, evidence), built };
}

/** نصٌّ عاديٌّ داخل مشهدٍ له تاريخٌ حقيقيّ. */
async function seedScript({ title, text, date = '2026-04-04' }) {
  const scene = await scenes.create({ titleAr: 'موقف', date });
  const script = await addScript(scene.id, { title, text });
  await scanSources();
  return { key: keyOf('script', script.id), id: script.id, seg: `${script.id}#0`, sceneId: scene.id };
}

/* ================================================================== *
 * ط — المتحدّثون: البند ٥٤
 * ================================================================== */

describe('WS-L · المحادثةُ ومتحدّثوها', () => {
  it('ط١ · دورٌ لكلّ متحدّث — والمتحدّثُ يظهر جنبَ دوره هو', async () => {
    await resetDevices();

    /*
     * ⚠️ **بذرةٌ حقيقيّةٌ لا مُلفَّقة**: محادثةٌ بدورين واسمَين مخزَّنين،
     *    تُكتَب بمستودعات التطبيق، ويُقرأ منها كما يقرأ التطبيق.
     */
    const made = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'مكتب الشغل', date: '2026-05-05' });
      const conv = await conversations.create({
        title: 'كلام مع المدير', sceneId: scene.id, language: 'ru',
      });
      const first = await conversationParts.create({
        conversationId: conv.id, order: 0,
        speakerLabel: 'المدير',
        text: 'Документы необходимо предоставить заказчику.',
      });
      const second = await conversationParts.create({
        conversationId: conv.id, order: 1,
        speakerLabel: 'أنا',
        text: 'Хорошо, я подготовлю их сегодня.',
      });
      await scanSources();
      const key = keyOf('conversation', conv.id);
      await classifySource(key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      return { key, first: first.id, second: second.id, sceneId: scene.id };
    });

    await on(TABLET, () => importFile(file([
      DOC({ evidence: [{ sourceKey: made.key, segmentId: made.first, quote: 'Документы' }] }),
      DOC({
        key: 'word:подготовить:default', lemma: 'подготовить', pos: 'verb',
        forms: ['подготовить', 'подготовлю'],
        evidence: [{ sourceKey: made.key, segmentId: made.second, quote: 'подготовлю' }],
      }),
    ])));

    /* ── الدليلُ في قصّة الحياة يحمل المتحدّثَ الصحيح ── */
    const one = await on(TABLET, () => evidenceOf('word:документ:default'));
    expect(one.primary).toHaveLength(1);
    expect(one.primary[0].speaker).toBe('المدير');

    const two = await on(TABLET, () => evidenceOf('word:подготовить:default'));
    expect(two.primary[0].speaker).toBe('أنا');

    /*
     * ⚠️ **ونفسُ الاسم في النصّ الكامل.** لو قرأت الشاشتان المتحدّثَ من
     *    مصدرين مختلفين لَجاز أن ينسب الدليلُ الكلامَ لواحدٍ والنصُّ
     *    الكاملُ لآخر — وهو أسوأُ من ألّا نعرض متحدّثًا أصلًا.
     */
    const ctx = await on(TABLET, () => sourceContext(made.key, made.first, 'Документы'));
    expect(ctx.missing).toBe(false);
    expect(ctx.segments).toHaveLength(2);
    expect(ctx.segments[0].speaker).toBe('المدير');
    expect(ctx.segments[0].isTarget).toBe(true);
    expect(ctx.segments[1].speaker).toBe('أنا');
    expect(ctx.segments[1].isTarget).toBe(false);
  });

  it('ط٢ · ودورٌ بلا اسمٍ يبقى بلا اسم — ولا يُستنتَج من جاره', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const conv = await conversations.create({ title: 'كلام', language: 'ru' });
      const named = await conversationParts.create({
        conversationId: conv.id, order: 0, speakerLabel: 'أحمد', text: 'Привет.',
      });
      const blank = await conversationParts.create({
        conversationId: conv.id, order: 1, text: 'Документы готовы.',
      });
      await scanSources();
      return { key: keyOf('conversation', conv.id), named: named.id, blank: blank.id };
    });

    const ctx = await on(TABLET, () => sourceContext(made.key, made.blank, 'Документы'));
    expect(ctx.segments[0].speaker).toBe('أحمد');
    /* ⚠️ `null` تعني «مش معروف» — والاختراعُ هنا نسبةُ كلامٍ لمن لم يقله. */
    expect(ctx.segments[1].speaker).toBe(null);
  });

  it('ط٣ · والمحادثةُ موقفٌ واحدٌ مهما كثُرت أدوارُها', async () => {
    /*
     * ⚠️ حارسُ البند ١٦ من جهة المتحدّثين: عشرون دورًا في محادثةٍ ليست
     *    عشرين موقفًا حقيقيًّا. والكسرُ هنا يضاعف «مواقفك» بلا أن يشتكي
     *    شيءٌ في الشاشة.
     */
    await resetDevices();
    const made = await on(TABLET, async () => {
      const conv = await conversations.create({ title: 'اجتماع', language: 'ru' });
      const ids = [];
      for (let i = 0; i < 4; i += 1) {
        /* eslint-disable-next-line no-await-in-loop */
        const part = await conversationParts.create({
          conversationId: conv.id, order: i,
          speakerLabel: i % 2 === 0 ? 'المدير' : 'أنا',
          text: 'Документы нужны.',
        });
        ids.push(part.id);
      }
      await scanSources();
      const key = keyOf('conversation', conv.id);
      await classifySource(key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      return { key, ids };
    });

    await on(TABLET, () => importFile(file([DOC({
      evidence: made.ids.map((id) => ({
        sourceKey: made.key, segmentId: id, quote: 'Документы',
      })),
    })])));

    const one = await on(TABLET, () => evidenceOf('word:документ:default'));
    expect(one.primary).toHaveLength(4);
    /* أربعةُ أدلّةٍ ومصدرٌ واحد — فالمواقفُ الحقيقيّةُ واحد. */
    expect(one.realSituations).toBe(1);
  });
});

/* ================================================================== *
 * ي — أصنافُ الغلطة: البند ٣٤
 * ================================================================== */

describe('WS-L · أربعةُ أشياءَ تُسمّى غلطة', () => {
  it('ي١ · التصنيفُ الأربعةُ صريحٌ ولا يُخمَّن', async () => {
    const derived = new Set(['script:GEN']);
    expect(classifyMistake({ wrong: 'a', natural: 'b' })).toBe(MISTAKE_KIND.LEARNER);
    expect(classifyMistake({ origin: INFO_ORIGIN.AI_IMPORT })).toBe(MISTAKE_KIND.AI_CORRECTION);
    expect(classifyMistake({ mistakeType: 'style' })).toBe(MISTAKE_KIND.STYLE);
    expect(classifyMistake({ sourceKey: 'script:GEN' }, { derivedSources: derived }))
      .toBe(MISTAKE_KIND.DERIVED_REWRITE);

    /*
     * ⚠️ **والقديمُ بلا `origin` غلطتُك.** صفوفُ ما قبل هذا الحقل كتبتَها
     *    أنت من شاشة الغلطات؛ فمعاملتُها اقتراحَ تحليلٍ تمحو تاريخًا
     *    حقيقيًّا. والافتراضُ يميل إلى ما هو أصدقُ لا إلى ما هو أسهل.
     */
    expect(classifyMistake({ wrong: 'x', natural: 'y', origin: undefined }))
      .toBe(MISTAKE_KIND.LEARNER);
  });

  it('ي٢ · واقتراحُ التحليل لا يزيد «غلطاتك» ولا واحدة', async () => {
    await resetDevices();
    const made = await on(TABLET, () => seedScript({ title: 'RAW', text: RAW }));
    await on(TABLET, async () => {
      await classifySource(made.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: made.key, segmentId: made.seg, quote: 'Документы' }],
      })]));

      /* غلطةٌ واحدةٌ سجّلتَها أنت، وثلاثةٌ اقترحها التحليل أو الأسلوب. */
      await mistakeComparisons.create({
        wrong: 'документ', natural: 'документы', canonical: 'документ',
        occurredAt: Date.parse('2026-05-01'),
      });
      await mistakeComparisons.create({
        wrong: 'документ', natural: 'документы', canonical: 'документ',
        origin: INFO_ORIGIN.AI_IMPORT,
      });
      await mistakeComparisons.create({
        wrong: 'документ', natural: 'документация', canonical: 'документ',
        mistakeType: 'style',
      });
      await mistakeComparisons.create({
        wrong: 'документ', natural: 'документы', canonical: 'документ',
        mistakeType: 'natural_style',
      });
    });

    const { item, story } = await on(TABLET, () => storyOf('word:документ:default'));

    /* ═══ رقمٌ عن حياتك: واحد. لا أربعة. ═══ */
    expect(story.counts.learnerMistakes).toBe(1);
    expect(story.counts.proposedFixes).toBe(3);
    expect(item.errors).toBe(1);
    expect(item.proposedFixes).toBe(3);
    expect(story.mistakes.learner).toHaveLength(1);
    expect(story.mistakes.proposed).toHaveLength(3);

    /* والخطُّ الزمنيُّ لا يحمل إلّا غلطتَك — والاقتراحُ رأيٌ لا واقعة. */
    const inTimeline = story.timeline.filter((one) => one.kind === EVENT.MISTAKE);
    expect(inTimeline).toHaveLength(1);
    expect(inTimeline[0].natural).toBe('документы');
  });

  it('ي٣ · وفرقُ النسخة المولَّدة ليس غلطةً أصلًا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const raw = await seedScript({ title: 'RAW', text: RAW });
      const scene = await scenes.create({ titleAr: 'تدريب', date: '2026-04-06' });
      const gen = await addScript(scene.id, { title: 'GEN', text: GEN });
      await scanSources();
      const genKey = keyOf('script', gen.id);
      await classifySource(raw.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await classifySource(genKey, {
        evidenceClass: EVIDENCE.DERIVED, originType: ORIGIN.AI_SHADOWING, derivedFrom: [raw.key],
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: raw.key, segmentId: raw.seg, quote: 'Документы' }],
      })]));
      await mistakeComparisons.create({
        wrong: 'документ', natural: 'документы', canonical: 'документ', sourceKey: genKey,
      });
      return { raw, genKey };
    });

    const { item, story } = await on(TABLET, () => storyOf('word:документ:default'));
    expect(story.counts.learnerMistakes).toBe(0);
    expect(item.errors).toBe(0);
    expect(story.mistakes.proposed[0].kind).toBe(MISTAKE_KIND.DERIVED_REWRITE);
  });
});

/* ================================================================== *
 * ك — الخطُّ الزمنيّ: البند ٣٢
 * ================================================================== */

describe('WS-L · الخطُّ الزمنيُّ لا يخترع تاريخًا', () => {
  it('ك١ · تاريخُ الموقف من المشهد لا من وقت كتابة النصّ', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const one = await seedScript({ title: 'RAW', text: RAW, date: '2026-03-11' });
      await classifySource(one.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: one.key, segmentId: one.seg, quote: 'Документы' }],
      })]));
      return one;
    });

    const { story } = await on(TABLET, () => storyOf('word:документ:default'));
    const situation = story.timeline.find((one) => one.kind === EVENT.SITUATION);
    expect(Boolean(situation)).toBe(true);
    expect(situation.at).toBe(Date.parse('2026-03-11'));

    /*
     * ⚠️ **و`updatedAt` ليس تاريخَ الحدث.** لو تسرّب لَصار «أوّل مرّة
     *    شفتها» يومَ إضافتك للنصّ — وقد يفصل بينهما شهران. والقياسُ هنا
     *    على القيمة نفسِها لا على وجود الحقل.
     */
    expect(situation.at === Date.now()).toBe(false);
    expect(situation.at < Date.parse('2026-03-12')).toBe(true);
  });

  it('ك٢ · وموقفٌ بلا تاريخ يُعرَض بلا تاريخ ولا يُرتَّب زمنيًّا', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      /* نصٌّ بلا مشهد — فلا تاريخَ يُثبت متى وقع. */
      const script = await addScript(null, { title: 'بلا مشهد', text: RAW });
      await scanSources();
      const key = keyOf('script', script.id);
      await classifySource(key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: key, segmentId: `${script.id}#0`, quote: 'Документы' }],
      })]));
      return { key };
    });

    const { story } = await on(TABLET, () => storyOf('word:документ:default'));
    const undatedSituations = story.undated.filter((one) => one.kind === EVENT.SITUATION);
    expect(undatedSituations).toHaveLength(1);
    expect(story.timeline.filter((one) => one.kind === EVENT.SITUATION)).toHaveLength(0);
    expect(story.counts.undatedEvents > 0).toBe(true);

    /* ⚠️ ولا حدثَ بلا تاريخٍ يتسلّل إلى الترتيب — ولو بصفرٍ يبدو قديمًا. */
    expect(story.timeline.every((one) => Number.isFinite(one.at))).toBe(true);
  });

  it('ك٣ · والترتيبُ زمنيٌّ صاعدٌ عبر الطبقات كلِّها', async () => {
    expect(timelineOf([
      { kind: EVENT.SAVED, at: 300 },
      { kind: EVENT.SITUATION, at: 100 },
      { kind: EVENT.PRACTISED, at: null },
      { kind: EVENT.MISTAKE, at: 200 },
    ]).map((one) => one.at)).toEqual([100, 200, 300]);
  });

  it('ك٤ · ويومُ الغلطة `occurredAt` لا يومُ تسجيلها', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const one = await seedScript({ title: 'RAW', text: RAW });
      await classifySource(one.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: one.key, segmentId: one.seg, quote: 'Документы' }],
      })]));
      await mistakeComparisons.create({
        wrong: 'документ', natural: 'документы', canonical: 'документ',
        occurredAt: Date.parse('2026-01-09'),
      });
      /* غلطةٌ بلا يومٍ معروف — تُعرَض ولا تُرتَّب. */
      await mistakeComparisons.create({
        wrong: 'документы', natural: 'документ', canonical: 'документ',
      });
    });

    const { story } = await on(TABLET, () => storyOf('word:документ:default'));
    const dated = story.timeline.filter((one) => one.kind === EVENT.MISTAKE);
    expect(dated).toHaveLength(1);
    expect(dated[0].at).toBe(Date.parse('2026-01-09'));
    expect(story.mistakes.learner).toHaveLength(2);
    expect(story.undated.filter((one) => one.kind === EVENT.MISTAKE)).toHaveLength(1);
  });
});

/* ================================================================== *
 * ل — النسبُ والتسجيلاتُ وأسبابُ الوجود: بنود ٣٠ و٣٣ و٣٨
 * ================================================================== */

describe('WS-L · نسبُ المولَّد وتسجيلاتُك', () => {
  it('ل١ · كلُّ ظهورٍ مولَّدٍ يقول نوعَ اشتقاقه وأصلَه بالاسم', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const raw = await seedScript({ title: 'محضر الاجتماع', text: RAW });
      const scene = await scenes.create({ titleAr: 'تدريب', date: '2026-04-06' });
      const gen = await addScript(scene.id, { title: 'نصّ تدريب', text: GEN });
      await scanSources();
      const genKey = keyOf('script', gen.id);
      await classifySource(raw.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await classifySource(genKey, {
        evidenceClass: EVIDENCE.DERIVED, originType: ORIGIN.AI_SHADOWING, derivedFrom: [raw.key],
      });
      await importFile(file([DOC({
        evidence: [
          { sourceKey: raw.key, segmentId: raw.seg, quote: 'Документы' },
          { sourceKey: genKey, segmentId: `${gen.id}#0`, quote: 'Документы должны' },
        ],
      })]));
      return { raw, genKey };
    });

    const { item, story } = await on(TABLET, () => storyOf('word:документ:default'));

    /*
     * ⚠️ **والدليلُ فهرسُ ظهوراتٍ لا فهرسُ استشهادات.** النصُّ المولَّد
     *    يحمل «Документы» مرّتين، فسطران — وهذا صادق. والمهمُّ أن
     *    المصدرَ المولَّدَ واحدٌ ولا يُقرأ موقفَين.
     */
    expect(story.derived).toHaveLength(2);
    expect(new Set(story.derived.map((one) => one.sourceKey)).size).toBe(1);
    expect(item.realSituations).toBe(1);

    for (const one of story.derived) {
      expect(one.originType).toBe(ORIGIN.AI_SHADOWING);
      expect(one.originLabel.length > 0).toBe(true);
      /*
       * ⚠️ **والأصلُ بنصّه لا بمفتاحه.** «مشتقّ من script:SCR_01M…» لا
       *    يقول شيئًا لقارئٍ بشريّ.
       */
      expect(one.parents).toHaveLength(1);
      expect(one.parents[0].title).toBe('محضر الاجتماع');
    }
  });

  it('ل٢ · وتسجيلاتُك تُعَدّ وتُوصَف بلا تنزيلِ بايتٍ واحد', async () => {
    await resetDevices();
    const seeded = await on(TABLET, async () => {
      const one = await seedScript({ title: 'RAW', text: RAW });
      await classifySource(one.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: one.key, segmentId: one.seg, quote: 'Документы' }],
      })]));

      /* تسجيلٌ بايتاتُه هنا، وآخرُ على Drive وحدَه. */
      const here = await media.create({ kind: 'audio', bytes: 4096, blob: new Blob(['x']) });
      const cloud = await media.create({ kind: 'audio', bytes: 8192, blobPending: 1 });
      await practiceEvidence.create({
        targetType: 'shadowVoice', practiceType: 'voiceAttempt',
        targetText: 'документы', mediaId: here.id,
        practicedAt: Date.parse('2026-06-01'), durationMs: 1500,
      });
      await practiceEvidence.create({
        targetType: 'shadowVoice', practiceType: 'voiceAttempt',
        targetText: 'документы', mediaId: cloud.id,
        practicedAt: Date.parse('2026-06-02'), durationMs: 1700,
      });
      return { here: here.id, cloud: cloud.id };
    });

    const { item, story } = await on(TABLET, () => storyOf('word:документ:default'));
    expect(story.counts.recordings).toBe(2);
    expect(item.recordings).toBe(2);

    /* الأحدثُ أوّلًا — لأن آخرَ محاولةٍ هي ما تريد سماعَه. */
    expect(story.recordings[0].mediaId).toBe(seeded.cloud);
    expect(story.recordings[0].cloudOnly).toBe(true);
    expect(story.recordings[0].local).toBe(false);
    expect(story.recordings[0].bytes).toBe(8192);
    expect(story.recordings[1].local).toBe(true);
    expect(story.recordings[1].cloudOnly).toBe(false);

    /* والتسجيلُ حدثٌ في خطّك الزمنيّ لأنه واقعةٌ منك. */
    expect(story.timeline.filter((one) => one.kind === EVENT.RECORDED)).toHaveLength(2);
  });

  it('ل٣ · وحارسٌ: قصّةُ العنصر لا تجلب وسائطَ من السحابة', async () => {
    /*
     * ⚠️ **فتحُ قصّةٍ ينزّل ميجاباتٍ صامتة** لو نادت `ensureBytes`. البند
     *    ٣٣ صريح: نقول «على Drive» ويُجلَب المطلوبُ وحدَه عند الضغط.
     */
    const text = await fetch('../js/services/memory/item-story.js').then((r) => r.text());
    const body = text.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body.includes('ensureBytes')).toBe(false);
    expect(body.includes('media-service')).toBe(false);
  });

  it('ل٤ · وسببٌ ثانٍ لا يصنع عنصرًا ثانيًا', async () => {
    /*
     * ⚠️ البند ٣٨: كلمةٌ من موقفٍ ثم حفظتَها ثم تدرّبتَ عليها **واحدة**
     *    بثلاث إشارات — لا ثلاثةُ صفوفٍ في ثلاث شاشات كما كان قبل WS-J.
     */
    await resetDevices();
    await on(TABLET, async () => {
      const one = await seedScript({ title: 'RAW', text: RAW });
      await classifySource(one.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: one.key, segmentId: one.seg, quote: 'Документы' }],
      })]));
      const { saveItem, SAVED_KIND } = await import('../js/services/saved-service.js');
      await saveItem({ text: 'документы', kind: SAVED_KIND.WORD });
      await practiceEvidence.create({
        targetType: 'sentence', practiceType: 'shadowing',
        targetText: 'документы', practicedAt: Date.parse('2026-06-10'), repetitions: 3,
      });
    });

    const { built, item, story } = await on(TABLET, () => storyOf('word:документ:default'));
    const same = built.items.filter((one) => one.lemma === 'документ');
    expect(same).toHaveLength(1);

    const ids = story.reasons.map((one) => one.id);
    expect(ids).toContain('real');
    expect(ids).toContain('analyzed');
    expect(ids).toContain('marked');
    expect(ids).toContain('practised');

    /* وإشاراتٌ متعدّدةٌ لا تزيد موقفًا حقيقيًّا واحدًا. */
    expect(item.rawOccurrences > 0).toBe(true);
    expect(item.realSituations).toBe(1);
  });

  it('ل٥ · وسببٌ غيرُ متحقّقٍ لا يُكتَب', async () => {
    const ids = reasonsFor({
      rawOccurrences: 0, hasAnalysis: false, saved: 0,
      derivedAppearances: 2, practised: 0, errors: 0, recordings: 0,
    }).map((one) => one.id);
    expect(ids).toEqual(['derived']);
  });

  it('ل٦ · ونسبُ أصلٍ محذوفٍ يُسقَط ولا يُخترَع اسمُه', async () => {
    const rows = describeDerived(
      [{ sourceKey: 'script:GEN', quote: 'x' }],
      [{ id: 'script:GEN', title: 'مولَّد', originType: ORIGIN.AI_SHADOWING, derivedFrom: ['script:GONE'] }],
    );
    expect(rows[0].parents).toHaveLength(0);
    expect(rows[0].originLabel.length > 0).toBe(true);
  });
});

/* ================================================================== *
 * م — استمراريّةُ التصدير: البند ٤١
 * ================================================================== */

describe('WS-L · حالةُ التحليل تكفي لاستكمال الفهم', () => {
  it('م١ · الحالةُ تحمل الصيغَ والسجلَّ والمجالَ والثقةَ ونسبَ المصادر', async () => {
    await resetDevices();
    const made = await on(TABLET, async () => {
      const raw = await seedScript({ title: 'محضر', text: RAW });
      const scene = await scenes.create({ titleAr: 'تدريب', date: '2026-04-06' });
      const gen = await addScript(scene.id, { title: 'مولَّد', text: GEN });
      await scanSources();
      const genKey = keyOf('script', gen.id);
      await classifySource(raw.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await classifySource(genKey, {
        evidenceClass: EVIDENCE.DERIVED, originType: ORIGIN.AI_SHADOWING, derivedFrom: [raw.key],
      });
      /*
       * ⚠️ **والدورةُ كاملةٌ هنا عمدًا.** النصُّ لا يصير «محلَّلًا» إلّا
       *    إن أُرسل فعلًا: `buildPackages` يكتب إيصالَ الإرسال، والاستيرادُ
       *    يعلّم به. ولو قفزنا فوق الإرسال لَاختبرنا ادّعاءً لا دورة.
       */
      const { buildPackages, analyzedHashesOf } =
        await import('../js/services/memory/export-v2.js');
      const built = await buildPackages({ selected: [raw.key, genKey] });
      /* إيصالُ الإرسال يُكتَب لحظةَ النسخ — وهو ما يجعل «محلَّل» ادّعاءً مُثبَتًا. */
      await markSent(analyzedHashesOf(built.packages));

      await importFile(file([DOC({
        confidence: 0.9,
        evidence: [
          { sourceKey: raw.key, segmentId: raw.seg, quote: 'Документы' },
          { sourceKey: genKey, segmentId: `${gen.id}#0`, quote: 'Документы должны' },
        ],
      })], { analyzedSources: [raw.key, genKey] }));
      const { saveItem, SAVED_KIND } = await import('../js/services/saved-service.js');
      await saveItem({ text: 'документы', kind: SAVED_KIND.WORD });
      await mistakeComparisons.create({
        wrong: 'документ', natural: 'документы', canonical: 'документ',
        occurredAt: Date.parse('2026-02-02'), mistakeType: 'form',
      });
      return { raw, genKey };
    });

    const snap = await on(TABLET, () => analysisSnapshot());
    const one = snap.items.find((row) => row.key === 'word:документ:default');
    expect(Boolean(one)).toBe(true);
    expect(one.forms).toContain('документы');
    expect(one.register).toBe('formal');
    expect(one.domain).toBe('work');

    const derived = snap.sources.find((row) => row.sourceKey === made.genKey);
    expect(Boolean(derived)).toBe(true);
    expect(derived.evidenceClass).toBe(EVIDENCE.DERIVED);
    expect(derived.derivedFrom).toContain(made.raw.key);

    /* ── إشاراتُ المتعلّم: ما علّمتَه وما أخطأتَ فيه ── */
    expect(snap.learnerSignals.markedKeys).toContain('word:документ:default');
    expect(snap.learnerSignals.mistakes).toHaveLength(1);
    expect(snap.learnerSignals.mistakes[0].natural).toBe('документы');
  });

  it('م٢ · ولا نصَّ مصدرٍ ولا هُويّةَ جهازٍ ولا متّجهَ مزامنةٍ في الحالة', async () => {
    /*
     * ⚠️ **حالةٌ تُنسَخ إلى محادثةٍ خارجيّة.** تسرّبُ `deviceId` أو
     *    `vector` يعني إرسالَ بنيةِ مزامنتك إلى طرفٍ لا شأنَ له بها،
     *    وتسرّبُ النصّ يجعل الحزمةَ الخامسةَ بحجم الأولى.
     */
    await resetDevices();
    await on(TABLET, async () => {
      const raw = await seedScript({ title: 'محضر', text: RAW });
      await classifySource(raw.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: raw.key, segmentId: raw.seg, quote: 'Документы' }],
      })]));
    });

    const snap = await on(TABLET, () => analysisSnapshot());
    const asText = JSON.stringify(snap);
    expect(asText.includes('необходимо')).toBe(false);
    expect(asText.includes('предоставить')).toBe(false);
    expect(asText.includes('deviceId')).toBe(false);
    expect(asText.includes('"vector"')).toBe(false);
    expect(asText.includes('changeLog')).toBe(false);
  });
});

/* ================================================================== *
 * ن — النسخُ والمزامنة: البند ٥١
 * ================================================================== */

describe('WS-L · كلُّ ما كتبتَه يُنسَخ ويُزامَن', () => {
  it('ن١ · مخازنُ القصّة كلُّها داخل النسخة الاحتياطيّة', async () => {
    /*
     * ⚠️ **مخزنٌ خارجَ النسخة يعني تاريخًا يُمحى بتبديل جهاز.** والقياسُ
     *    هنا على القائمة المُصدَّرة نفسِها لا على نيّةٍ في ترويسة.
     */
    for (const store of [
      'memorySources', 'analysisItems', 'analysisEvidence',
      'savedItems', 'practiceEvidence', 'mistakeComparisons', 'media',
      'conversations', 'conversationParts',
    ]) {
      if (!EXPORTABLE_STORES.includes(store)) throw new Error(`مخزنٌ خارج النسخة: ${store}`);
    }
    expect(EXPORTABLE_STORES.includes('analysisItems')).toBe(true);
  });

  it('ن٢ · والمكتوبُ منها بيدك مسجَّلٌ في دفتر المزامنة', async () => {
    /*
     * ⚠️ **المشتقُّ لا يُزامَن والأصيلُ يجب.** `analysisEvidence` وصلاتٌ
     *    تُعاد من التحليل، أمّا `savedItems` و`mistakeComparisons` فهي
     *    تاريخُك الذي لا يُعاد بناؤه من شيء.
     */
    for (const store of ['savedItems', 'mistakeComparisons', 'practiceEvidence', 'memorySources']) {
      if (!logged(store)) throw new Error(`مخزنٌ غيرُ مسجَّل: ${store}`);
    }
    expect(logged('analysisItems')).toBe(true);
  });

  it('ن٣ · والتصنيفُ الذي اخترتَه يعبر إلى الجهاز الآخر', async () => {
    const { sendTo, MOBILE } = await import('./sync-devices.js');
    await resetDevices();
    const made = await on(TABLET, async () => {
      const raw = await seedScript({ title: 'محضر', text: RAW });
      await classifySource(raw.key, {
        evidenceClass: EVIDENCE.PRIMARY, originType: ORIGIN.RAW_TRANSCRIPT,
      });
      await importFile(file([DOC({
        evidence: [{ sourceKey: raw.key, segmentId: raw.seg, quote: 'Документы' }],
      })]));
      return raw;
    });

    await sendTo(TABLET, MOBILE);

    const there = await on(MOBILE, async () => {
      const { listSources } = await import('../js/services/memory/source-registry.js');
      const rows = await listSources();
      invalidateLanguage();
      const built = await buildLanguageIndex();
      return {
        cls: rows.find((row) => row.id === made.key)?.evidenceClass || null,
        items: built.items.length,
      };
    });
    expect(there.cls).toBe(EVIDENCE.PRIMARY);
    expect(there.items).toBe(1);
  });
});

/**
 * LingoLife — سياقُ المسودّة في اللوح الأيمن أثناء التدريب (WS-DV3)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العطبُ الذي وُلدت هذه الملفّاتُ لتمنع عودتَه
 * ═══════════════════════════════════════════════════════════════
 *
 * تبدأ التدريبَ على أهدافٍ مختارةٍ من مسودّة، فتختفي المسودّةُ من
 * اللوح. والسببُ أنّ `resolveDraft` تقرأ `material.get(index)` —
 * خريطةٌ بُنيت لمقاطع **المصدر الأصليّ** وحدَها — ومقاطعُ التدريب
 * تُلحَق بعدها، فيقع الفهرسُ خارجَها. فيعرض اللوحُ «لسّه مفيش مادّة
 * على الجملة دي» ويدعوك للصق تحليلٍ **هو نفسُه ما تنطقه الآن**.
 *
 * وقِستُه حيًّا قبل الإصلاح: `groups:0 · cards:0` وعنوانٌ يقول
 * «الجملة ٤» في نصٍّ من ثلاث جمل.
 *
 * ⚠️ **والنسبُ لم يكن موجودًا أصلًا**: `pickTargetsToPractice` كانت
 *    تضع `draftId` وتُسقط `id` الهدف، و`shadowChunk` لا تضع وسمًا
 *    البتّة — فالنسبُ محبوسٌ في نصّ `sourceId` يُقرأ بالتقطيع.
 *
 * ⚠️ **وهذه الحرّاسُ تقيس الكودَ لا النثر** (قاعدةُ البيت): لا تسأل
 *    «هل الكلمةُ مذكورة» بل «هل الوسمُ يحمل `targetId`، وهل اللوحُ
 *    يسأل النسبَ قبل النصّ، وهل يقرأ بالمتزامنة لا بالكاتبة».
 */

import { describe, it, expect } from './test-runner.js';
import { parseDraftV2 } from '../js/services/shadow/draft-v2.js';
import { learnModelSync } from '../js/services/shadow/draft-learning.js';
import { ROLE } from '../js/services/shadow/draft-targets.js';
import { createDraft, saveDraftText, SUBJECT } from '../js/services/study-draft.js';
import { studyDrafts } from '../js/db/repositories.js';

const TAG = `DC-${Math.random().toString(36).slice(2, 7)}`;

const MOTHER = 'При работе с технической документацией важно обращать внимание '
  + 'не только на наличие документа, но и на его статус.';

const DRAFT = [
  'مسودة — Core Recall V2', '',
  'الجملة الأساسية:', MOTHER, '━━━━━━━━━━',
  'MICRO CORE 1', 'при работе с технической документацией', 'وإحنا بنشتغل على التوثيق',
  'Вопрос:', 'С чем мы сейчас работаем?', 'Ответ:', 'С технической документацией.',
  'MICRO CORE 2', 'наличие документа', 'وجود المستند',
  'Вопрос:', 'На что важно обратить внимание в первую очередь?',
  'Ответ:', 'На наличие документа.',
  'MICRO CORE 3', 'статус документа', 'حالة المستند',
  'Вопрос:', 'Только на наличие?', 'Ответ:', 'Нет, нужно проверить ещё статус документа.',
  'EXPANDING RECALL',
  'EXPANSION 1', 'Важно обращать внимание на наличие документа.',
  'HIGH-VALUE CORE REPETITION',
  'CORE FAMILY: не только …, но и …', 'الأولوية: ★★★',
  'VARIATION 1', 'Мы проверяем не только документы, но и оборудование.',
  'VARIATION 2', 'Не только сроки, но и качество.',
  'FULL RECONSTRUCTION',
  'Вопрос:', 'Что вы поняли при работе с технической документацией?',
  'Ответ:', MOTHER,
].join('\n');

/** مسودّةٌ محفوظةٌ فعلًا — لأن النسبَ يمرّ بالقاعدة. */
async function seed(text = DRAFT, subject = `${TAG}-${Math.random().toString(36).slice(2, 6)}`) {
  const d = await createDraft(SUBJECT.SENTENCE, subject, { sceneId: null });
  await saveDraftText(d.id, text);
  return studyDrafts.get(d.id);
}

let VIEW = '';
const view = async () => {
  if (!VIEW) VIEW = await (await fetch('../js/views/shadow-view.js')).text();
  return VIEW;
};

/* ================================================================== *
 * أ) النسب: من مقطع التدريب إلى هدف المسودّة
 * ================================================================== */
describe('WS-DV3 · النسبُ بمعرّفٍ ثابتٍ لا بنصّ', () => {
  it('١ · وسمُ المنتقي يضع `draftId` و`targetId` معًا', async () => {
    const src = await view();
    /*
     * ⚠️ يقيس **الوسمَ نفسَه** لا وجودَ الكلمة: لو عاد أحدُهما ليُسقَط
     *    لَسقط هذا الحارس. وكان `stamp: (seg) => ({ ...seg, draftId })`
     *    — بلا هدفٍ أصلًا.
     */
    expect(src).toContain('stamp: (seg, i) => ({ ...seg, draftId, targetId: picked[i]?.id');
  });

  it('٢ · وبابُ القطعة الواحدة يضع النسبَ كذلك — وكان بلا وسم', async () => {
    const src = await view();
    expect(src).toContain('stamp: (seg) => ({ ...seg, draftId: openDraftId, targetId: id })');
  });

  it('٣ · و`enterTempSource` تمرّر رقمَ الصفّ للوسم', async () => {
    const src = await view();
    /* بلا `i` لا يستطيع النادي أن يعرف أيَّ هدفٍ لهذا المقطع. */
    expect(src).toContain('stamp ? stamp(seg, i) : seg');
  });

  it('٤ · واللوحُ يسأل النسبَ **قبل** الرجوع إلى النصّ', async () => {
    const src = await view();
    const lineage = src.indexOf('const lineage = draftLineage();');
    const byText = src.indexOf('await resolveDraft({ kind: SUBJECT.SENTENCE, text: source })');
    expect(lineage > 0).toBe(true);
    expect(byText > 0).toBe(true);
    /* الترتيبُ هو الحُكم: النسبُ أوّلًا، والنصُّ احتياطًا. */
    expect(lineage < byText).toBe(true);
  });

  it('٥ · والنسبُ يُقرأ من المقطع لا يُخمَّن من نصّه', async () => {
    const src = await view();
    expect(src).toContain('function draftLineage()');
    expect(src).toContain('if (!seg?.draftId) return null;');
    expect(src).toContain('targetId: seg.targetId');
  });
});

/* ================================================================== *
 * ب) ما يُعرَض: الجملةُ الأمّ والسؤالُ والجوابُ والدور
 * ================================================================== */
describe('WS-DV3 · اللوحُ يعرض سياقَ الهدف الجاري', () => {
  it('٦ · الهدفُ الجاري يُحَلّ بمعرّفه إلى قلبٍ بسؤاله وجوابه', async () => {
    const draft = await seed();
    const model = learnModelSync(draft);
    const core = model.targets.find((t) => t.ru === 'наличие документа');

    expect(Boolean(core)).toBe(true);
    expect(core.role).toBe(ROLE.MICRO_CORE);
    expect(core.cue).toBe('На что важно обратить внимание в первую очередь?');
    expect(core.reply).toBe('На наличие документа.');
    await studyDrafts.trash(draft.id);
  });

  it('٧ · والجملةُ الأمُّ تُقرأ من المسودّة لا من نصّ الهدف', async () => {
    const draft = await seed();
    const model = learnModelSync(draft);
    expect(model.source).toBe(MOTHER);
    /* والهدفُ الجاري نصُّه أقصرُ منها — فلا يصلح بديلًا عنها. */
    const core = model.targets.find((t) => t.ru === 'статус документа');
    expect(core.ru === model.source).toBe(false);
    await studyDrafts.trash(draft.id);
  });

  it('٨ · وتكرارٌ يُحَلّ إلى عائلتِه لا إلى عائلةٍ أخرى', async () => {
    const draft = await seed();
    const model = learnModelSync(draft);
    const vars = model.targets.filter((t) => t.role === ROLE.VARIATION);
    expect(vars).toHaveLength(2);
    for (const one of vars) expect(one.family).toBe('не только …, но и …');
    /* والعائلةُ لها أولويّتُها المؤلَّفة. */
    expect(model.families[0].label).toBe('не только …, но и …');
    expect(model.families[0].priority).toBe('★★★');
    await studyDrafts.trash(draft.id);
  });

  it('٩ · وإعادةُ البناء تُحَلّ بدورها وسؤالِها', async () => {
    const draft = await seed();
    const model = learnModelSync(draft);
    const full = model.targets.find((t) => t.role === ROLE.FULL_BUILD);
    expect(Boolean(full)).toBe(true);
    expect(full.cue).toBe('Что вы поняли при работе с технической документацией?');
    expect(full.ru).toBe(MOTHER);
    await studyDrafts.trash(draft.id);
  });

  it('١٠ · والسؤالُ يسبق الجوابَ في الرسم — وإلّا صار الاسترجاعُ قراءةً', async () => {
    const src = await view();
    const cue = src.indexOf('class="sh-now-cue"');
    const reply = src.indexOf('class="sh-now-reply"');
    expect(cue > 0).toBe(true);
    expect(reply > 0).toBe(true);
    expect(cue < reply).toBe(true);
  });

  it('١١ · والهدفُ الجاري يُبرَز داخل بنيته لا يُنتزَع منها', async () => {
    const src = await view();
    expect(src).toContain("now ? 'is-now' : ''");
    expect(src).toContain('const now = activeTargetId && chunk.id === activeTargetId;');
  });
});

/* ================================================================== *
 * ج) ما لا يجوز أن يقع
 * ================================================================== */
describe('WS-DV3 · عرضٌ لا محرّكُ تدريبٍ ثانٍ', () => {
  it('١٢ · لوحُ السياق يقرأ بالمتزامنة — فلا كتابةَ من مجرّد رسم', async () => {
    const src = await view();
    /*
     * ⚠️ `learnModel` تكتب `targetIds`؛ و`learnModelSync` لا تكتب.
     *    ولوحُ السياق يُرسَم مع **كلّ نقلةِ هدف** — فكتابةٌ هنا تعني
     *    `rev++` و`dirty=1` عشراتِ المرّات في جلسةٍ واحدة.
     */
    expect(src).toContain('const model = learnModelSync(draft);');
    expect(src).toContain('viaLineage ? viaLineage.model :');
  });

  it('١٣ · والتحليلُ يُخزَّن بالمعرّف والمراجعة — فلا يُعاد في كلّ رسمة', async () => {
    const src = await view();
    expect(src).toContain('draftModelCache.draftId === draftId && draftModelCache.rev === draft.rev');
  });

  it('١٤ · ولا يُحَلّ سياقٌ إلّا عند تغيّر الهدف — لا مع نبض الصوت', async () => {
    const src = await view();
    /*
     * ⚠️ `renderLearn` تُنادى من `syncSegment` (نقلةُ مقطع) ومن
     *    `renderRail` (فتحُ اللوح) ومن أفعالٍ صريحة — ولا شيءَ منها
     *    في مسار `timeupdate`. وهذا الحارسُ يقيس ذلك بنيويًّا.
     */
    const ticks = src.match(/ontimeupdate|'timeupdate'/g) || [];
    for (const at of ticks) {
      const i = src.indexOf(at);
      const window = src.slice(i, i + 600);
      expect(window.includes('renderLearn')).toBe(false);
      expect(window.includes('modelForDraft')).toBe(false);
    }
  });

  it('١٥ · ونصٌّ مكرَّرٌ حرفيًّا لا يجرّ مسودّةَ غيره', async () => {
    /*
     * ⚠️ **هذا هو سببُ وجود النسب أصلًا.** مسودّتان مختلفتان قد يكون
     *    فيهما هدفٌ بنفس النصّ تمامًا. فالبحثُ بالنصّ يصيب مرّةً
     *    ويُخطئ صامتًا مرّة — والمعرّفُ لا يخطئ.
     */
    const a = await seed(DRAFT, `${TAG}-توأم-أ`);
    const b = await seed(DRAFT, `${TAG}-توأم-ب`);

    const ma = learnModelSync(await studyDrafts.get(a.id));
    const mb = learnModelSync(await studyDrafts.get(b.id));

    const ta = ma.targets.find((t) => t.ru === 'наличие документа');
    const tb = mb.targets.find((t) => t.ru === 'наличие документа');

    /* نفسُ النصّ، ومعرّفان مختلفان، وكلٌّ في مسودّته. */
    expect(ta.ru).toBe(tb.ru);
    expect(ta.id === tb.id).toBe(false);
    expect(ma.targets.some((t) => t.id === tb.id)).toBe(false);

    await studyDrafts.trash(a.id);
    await studyDrafts.trash(b.id);
  });

  it('١٦ · ولا يُخترَع دورٌ لمسودّة V1', async () => {
    const draft = await seed(['требование', 'مطلب', 'الإحساس:', 'رسميّة'].join('\n'),
      `${TAG}-قديمة`);
    const model = learnModelSync(draft);
    expect(model.version).toBe(1);
    /* لا أسئلةَ استرجاعٍ ولا عائلاتٍ تُخترَع لما لم يُكتَب. */
    expect(model.targets.every((t) => !t.cue)).toBe(true);
    expect(model.families).toHaveLength(0);
    await studyDrafts.trash(draft.id);
  });

  it('١٧ · والسياقُ لا يُرسَم بلا هدفٍ جارٍ — فلا صندوقٌ فارغ', async () => {
    const src = await view();
    expect(src).toContain("if (!activeTargetId || !model?.targets?.length) return '';");
  });

  it('١٨ · ولا زرَّ تشغيلٍ ولا تسجيلٍ داخل صندوق السياق', async () => {
    const src = await view();
    const at = src.indexOf('function activeContextHtml');
    const body = src.slice(at, src.indexOf('\n}', at));
    /* ⚠️ محرّكُ الشادوينج يبقى صاحبَ الحقيقة — لا تشغيلَ ثانٍ هنا. */
    expect(body.includes('data-sh="play"')).toBe(false);
    expect(body.includes('data-sh="chunk-shadow"')).toBe(false);
    expect(body.includes('data-sh="say"')).toBe(false);
  });
});

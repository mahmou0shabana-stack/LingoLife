/**
 * LingoLife — هُويّةُ أهداف المسودّة V2 (WS-DV2 · بنود ٤٠ و٤١ و٦٣ و٦٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما يُقاس هنا هو **ما ينكسر بصمت**
 * ═══════════════════════════════════════════════════════════════
 *
 * هُويّةٌ بالموضع لا تُخطئ أبدًا في وجهك: كلُّ مفتاحٍ صحيحٌ في ذاته،
 * والتطبيقُ يعمل، والرقمُ يظهر. لكنّك تُدرج قطعةً في أوّل المسودّة
 * فيرث الجديدُ «خلصت» من جارِه. فكلُّ اختبارٍ هنا يُمسك انتقالًا
 * كان سيقع بلا رسالةِ خطأ.
 */

import { describe, it, expect } from './test-runner.js';
import {
  ROLE, TARGET_IDS, SPEECH_ROLES, OPTIONAL_SPEECH_ROLES, isSpeechRole,
  fingerprint, storedTargets, reconcileTargets, ensureTargetIds,
  textIndex, linkQuickChain,
} from '../js/services/shadow/draft-targets.js';
import { studyDrafts } from '../js/db/repositories.js';

const TAG = `DT-${Math.random().toString(36).slice(2, 7)}`;

/** أهدافٌ مقروءةٌ الآن — دورٌ ونصّ. */
const t = (role, ru) => ({ role, ru });

const CORE_A = t(ROLE.MICRO_CORE, 'тре́бования по документа́ции');
const CORE_B = t(ROLE.MICRO_CORE, 'не совсе́м поня́тны');
const CORE_C = t(ROLE.MICRO_CORE, 'уточни́ть э́тот вопро́с');

const idOf = (targets, ru) => targets.find((one) => one.ru === ru)?.id || null;

/* ================================================================== *
 * الخاصّيّاتُ الستّ التي طلبها المالك
 * ================================================================== */
describe('WS-DV2 · المعرّفُ يُولَد مرّةً ويعيش', () => {
  it('١ · أوّلُ قراءةٍ تُولّد معرّفًا لكلّ هدف', async () => {
    const { targets, minted, kept } = reconcileTargets([CORE_A, CORE_B, CORE_C], []);
    expect(targets).toHaveLength(3);
    expect(minted).toBe(3);
    expect(kept).toBe(0);
    /* ولا معرّفَ يتكرّر. */
    expect(new Set(targets.map((one) => one.id)).size).toBe(3);
  });

  it('٢ · ⚠️ إعادةُ الترتيب لا تغيّر معرّفًا واحدًا', async () => {
    const first = reconcileTargets([CORE_A, CORE_B, CORE_C], []).targets;
    /* نقلبُ الترتيبَ رأسًا على عقب. */
    const after = reconcileTargets([CORE_C, CORE_B, CORE_A], first).targets;

    expect(idOf(after, CORE_A.ru)).toBe(idOf(first, CORE_A.ru));
    expect(idOf(after, CORE_B.ru)).toBe(idOf(first, CORE_B.ru));
    expect(idOf(after, CORE_C.ru)).toBe(idOf(first, CORE_C.ru));
  });

  it('٣ · ⚠️ والإدراجُ في الأوّل لا يُزحزح مَن بعدَه', async () => {
    /*
     * ⚠️ **هذه هي الحالةُ التي أسقطت تصميمي الأوّل.** بمفتاحٍ بالموضع
     *    كان `core#1` يصير للجديد، فيرث تقدُّمَ «أ» وهو لم يُقرأ بعد.
     */
    const first = reconcileTargets([CORE_A, CORE_B, CORE_C], []).targets;
    const fresh = t(ROLE.MICRO_CORE, 'у отве́тственного специали́ста');
    const after = reconcileTargets([fresh, CORE_A, CORE_B, CORE_C], first).targets;

    expect(after).toHaveLength(4);
    expect(idOf(after, CORE_A.ru)).toBe(idOf(first, CORE_A.ru));
    expect(idOf(after, CORE_B.ru)).toBe(idOf(first, CORE_B.ru));
    expect(idOf(after, CORE_C.ru)).toBe(idOf(first, CORE_C.ru));
    /* والجديدُ وحدَه هو الذي وُلد. */
    expect(reconcileTargets([fresh, CORE_A, CORE_B, CORE_C], first).minted).toBe(1);
  });

  it('٤ · وحذفُ جارٍ لا يمسّ الباقين', async () => {
    const first = reconcileTargets([CORE_A, CORE_B, CORE_C], []).targets;
    const after = reconcileTargets([CORE_A, CORE_C], first).targets;

    expect(after).toHaveLength(2);
    expect(idOf(after, CORE_A.ru)).toBe(idOf(first, CORE_A.ru));
    expect(idOf(after, CORE_C.ru)).toBe(idOf(first, CORE_C.ru));
  });

  it('٥ · ونصٌّ لم يتغيّر يُبقي معرّفَه — فيُبقي تقدُّمَه', async () => {
    const first = reconcileTargets([CORE_A, CORE_B], []).targets;
    const again = reconcileTargets([CORE_A, CORE_B], first);
    expect(again.kept).toBe(2);
    expect(again.minted).toBe(0);
    expect(again.changed).toBe(false);
  });

  it('٦ · ⚠️ ونصٌّ تغيّر يأخذ معرّفًا جديدًا — ولا يرث «خلصت»', async () => {
    /*
     * ⚠️ **هنا افترقتُ عن `reconcileIds` عمدًا.** لها خطوةٌ بالموضع
     *    تُورِّث المعرّفَ لمن حلَّ مكانَ غيره. وهي صحيحةٌ للجُمَل، وكارثةٌ
     *    هنا: قطعةٌ كتبتَها للتوّ تُعرَض «خلصت» لأنّ سابقتَها كانت كذلك.
     */
    const first = reconcileTargets([CORE_A, CORE_B], []).targets;
    const edited = t(ROLE.MICRO_CORE, 'не о́чень поня́тны');
    const after = reconcileTargets([CORE_A, edited], first);

    expect(after.kept).toBe(1);
    expect(after.minted).toBe(1);
    expect(idOf(after.targets, CORE_A.ru)).toBe(idOf(first, CORE_A.ru));
    /* والمعرّفُ الجديدُ ليس معرّفَ من كان مكانَه. */
    expect(idOf(after.targets, edited.ru) === idOf(first, CORE_B.ru)).toBe(false);
  });

  it('٧ · ⚠️ وهدفان متطابقان في كلّ شيءٍ يبقيان اثنين', async () => {
    const twin = t(ROLE.VARIATION, 'Я бы сначала уточнил детали.');
    const first = reconcileTargets([twin, twin], []).targets;

    expect(first).toHaveLength(2);
    expect(first[0].id === first[1].id).toBe(false);

    /* وعددٌ ثابتٌ يُبقي المعرّفات — فلا تتولّد جديدةٌ في كلّ فتحة. */
    const after = reconcileTargets([twin, twin], first);
    expect(after.targets[0].id).toBe(first[0].id);
    expect(after.targets[1].id).toBe(first[1].id);
    expect(after.ambiguous).toHaveLength(0);
  });
});

/* ================================================================== *
 * الدورُ جزءٌ من الهُويّة (بند ٩)
 * ================================================================== */
describe('WS-DV2 · الدورُ يفصل ما يتشابه نصُّه', () => {
  it('٨ · ⚠️ قطعةٌ أساسيّةٌ وتكرارٌ بنفس النصّ هدفان لا هدف', async () => {
    /*
     * ⚠️ البندُ ٩ يقتضي تكرارَ الهيكل نفسِه في سياقاتٍ مختلفة. فلو كان
     *    النصُّ وحدَه بصمةً لَشارك القلبُ وتكرارُه حالةَ «خلصت» — فيقول
     *    التطبيقُ إنك أتممتَ تكرارًا لم تفتحه.
     */
    const text = 'Я бы снача́ла уточни́л э́тот вопро́с.';
    const core = t(ROLE.MICRO_CORE, text);
    const vari = t(ROLE.VARIATION, text);
    const { targets } = reconcileTargets([core, vari], []);

    expect(targets).toHaveLength(2);
    expect(targets[0].id === targets[1].id).toBe(false);
    expect(fingerprint(ROLE.MICRO_CORE, text) === fingerprint(ROLE.VARIATION, text)).toBe(false);
  });

  it('٩ · وتغيُّرُ الدور وحدَه يُولّد هُويّةً جديدة', async () => {
    const text = 'уточни́ть э́тот вопро́с';
    const first = reconcileTargets([t(ROLE.MICRO_CORE, text)], []).targets;
    const after = reconcileTargets([t(ROLE.EXPANSION, text)], first);
    expect(after.minted).toBe(1);
  });
});

/* ================================================================== *
 * أدوارُ النُّطق (بندا ٢٧ و٤٤)
 * ================================================================== */
describe('WS-DV2 · ما يُنطَق وما لا يُنطَق', () => {
  it('١٠ · أربعةُ أدوارٍ تُنطَق افتراضيًّا لا غير', async () => {
    expect(SPEECH_ROLES.size).toBe(4);
    expect(isSpeechRole(ROLE.MICRO_CORE)).toBe(true);
    expect(isSpeechRole(ROLE.EXPANSION)).toBe(true);
    expect(isSpeechRole(ROLE.VARIATION)).toBe(true);
    expect(isSpeechRole(ROLE.FULL_BUILD)).toBe(true);
  });

  it('١١ · ⚠️ وسؤالُ الاسترجاع والسقالةُ لا تُنطَق', async () => {
    for (const role of [ROLE.RECALL_CUE, ROLE.MEANING, ROLE.NOTE,
      ROLE.PATTERN, ROLE.SECTION, ROLE.METADATA]) {
      expect(isSpeechRole(role)).toBe(false);
    }
  });

  it('١٢ · والمثالُ اختياريٌّ لا افتراضيّ (بندا ١٣ و٦١)', async () => {
    expect(isSpeechRole(ROLE.EXAMPLE)).toBe(false);
    expect(OPTIONAL_SPEECH_ROLES.has(ROLE.EXAMPLE)).toBe(true);
  });

  it('١٣ · و`RECALL_CUE` دورٌ مستقلٌّ عن استرجاع V1', async () => {
    /* اسمان متشابهان وشكلان متعاكسان — راجع ترويسة الوحدة. */
    expect(ROLE.RECALL_CUE).toBe('recall_cue');
    expect(ROLE.RECALL_CUE === 'recall').toBe(false);
  });
});

/* ================================================================== *
 * الشريطُ السريع سطحُ مراجعة (بندا ١١ و٤٢)
 * ================================================================== */
describe('WS-DV2 · الشريطُ السريع لا يضاعف العدّ', () => {
  it('١٤ · ⚠️ إجابةٌ تُعيد نصَّ هدفٍ قائمٍ تشير إليه ولا تصير هدفًا', async () => {
    const { targets } = reconcileTargets([CORE_A, CORE_B, CORE_C], []);
    const chain = [
      { cue: 'Каки́е тре́бования?', ru: 'тре́бования по документа́ции' },
      { cue: 'Что ну́жно сде́лать?', ru: 'уточни́ть э́тот вопро́с' },
    ];
    const linked = linkQuickChain(chain, targets);

    expect(linked).toHaveLength(2);
    expect(linked[0].ref).toBe(idOf(targets, CORE_A.ru));
    expect(linked[1].ref).toBe(idOf(targets, CORE_C.ru));
    /* ولا معرّفَ جديدًا وُلد لأجل الشريط. */
    expect(linked.every((one) => targets.some((x) => x.id === one.ref))).toBe(true);
  });

  it('١٥ · وإجابةٌ فريدةٌ فعلًا تُبلَّغ ولا تُبتلَع', async () => {
    const { targets } = reconcileTargets([CORE_A], []);
    const linked = linkQuickChain([{ cue: 'سؤال', ru: 'не́что но́вое' }], targets);
    /* `null` تعني «فريدة» — والشاشةُ تقرّر، ولا تُخفى بصمت. */
    expect(linked[0].ref).toBe(null);
  });

  it('١٦ · والفهرسُ النصّيُّ يتجاهل ما لا يُنطَق', async () => {
    const { targets } = reconcileTargets([
      CORE_A, t(ROLE.RECALL_CUE, 'С чего́ бы ты на́чал?'),
    ], []);
    const index = textIndex(targets);
    /* سؤالُ الاسترجاع ليس هدفًا يُشار إليه من الشريط. */
    expect(index.size).toBe(1);
  });
});

/* ================================================================== *
 * الحفظُ على السجلّ — بلا ترقيةِ مخطَّط (بند ٤٠)
 * ================================================================== */
describe('WS-DV2 · المعرّفاتُ تعيش على سجلّ المسودّة', () => {
  const makeDraft = () => studyDrafts.create({
    subject: `${TAG}-${Math.random().toString(36).slice(2, 7)}`,
    subjectKind: 'sentence',
    text: 'مسودّةُ اختبار',
  });

  it('١٧ · تُكتَب في حقلٍ لا فهرسَ له ولا مخطَّط', async () => {
    const draft = await makeDraft();
    const targets = await ensureTargetIds(draft, [CORE_A, CORE_B]);

    const saved = await studyDrafts.get(draft.id);
    expect(storedTargets(saved)).toHaveLength(2);
    expect(saved[TARGET_IDS][0].id).toBe(targets[0].id);
    await studyDrafts.trash(draft.id);
  });

  it('١٨ · وتعيش عبر إعادةِ الفتح', async () => {
    const draft = await makeDraft();
    const first = await ensureTargetIds(draft, [CORE_A, CORE_B, CORE_C]);

    const reopened = await studyDrafts.get(draft.id);
    const again = await ensureTargetIds(reopened, [CORE_C, CORE_A, CORE_B]);

    expect(idOf(again, CORE_A.ru)).toBe(idOf(first, CORE_A.ru));
    expect(idOf(again, CORE_B.ru)).toBe(idOf(first, CORE_B.ru));
    expect(idOf(again, CORE_C.ru)).toBe(idOf(first, CORE_C.ru));
    await studyDrafts.trash(draft.id);
  });

  it('١٩ · ⚠️ ولا كتابةَ حين لا شيءَ يتغيّر', async () => {
    /*
     * ⚠️ `update` ترفع `rev` وتضع `dirty=1`. فكتابةٌ في كلّ رسمةٍ تجعل
     *    مجرَّدَ فتحِ الشاشة تعديلًا يُزامَن — ضجيجٌ في سجلّ التغيير
     *    ونقلٌ بلا سبب.
     */
    const draft = await makeDraft();
    await ensureTargetIds(draft, [CORE_A, CORE_B]);
    const after = await studyDrafts.get(draft.id);
    const rev = after.rev;

    await ensureTargetIds(after, [CORE_A, CORE_B]);
    expect((await studyDrafts.get(draft.id)).rev).toBe(rev);
    await studyDrafts.trash(draft.id);
  });

  it('١٩-ب · ⚠️ ونفسُ السجلّ في اليد يعطي نفسَ المعرّفات — لا لقطةً جامدة', async () => {
    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **العطبُ الذي مرّ من تحت ١٨ و١٩ — وقِستُه في المتصفّح**
     * ═══════════════════════════════════════════════════════════════
     *
     * الاختباران فوقُ يُعيدان القراءةَ من القاعدة بين النداءين
     * (`studyDrafts.get`). والشاشةُ **لا تفعل ذلك**: `resolveDraft`
     * تُعيد لقطةً محفوظةً في الذاكرة جُمعت مرّةً عند تحميل الجلسة،
     * فيُنادى `ensureTargetIds` على **نفس الكائن** في كلّ رسمة.
     *
     * فكان الحقلُ يُكتَب في القاعدة ولا يظهر في اللقطة، فتقرأ الرسمةُ
     * التاليةُ `[]` وتُولّد معرّفاتٍ جديدةً وتكتبها — دورةٌ لا تنتهي.
     * وقِستُه حيًّا: `DT_…6C68_*` ثمّ `DT_…6D3X_*` بعد ضغطةٍ واحدة.
     *
     * ولذلك يمسك هذا الاختبارُ **المرجعَ نفسَه** بلا إعادة قراءة —
     * وهو الشكلُ الوحيدُ الذي يُخفق قبل الإصلاح.
     */
    const draft = await makeDraft();
    const first = await ensureTargetIds(draft, [CORE_A, CORE_B, CORE_C]);
    const again = await ensureTargetIds(draft, [CORE_A, CORE_B, CORE_C]);

    expect(idOf(again, CORE_A.ru)).toBe(idOf(first, CORE_A.ru));
    expect(idOf(again, CORE_B.ru)).toBe(idOf(first, CORE_B.ru));
    expect(idOf(again, CORE_C.ru)).toBe(idOf(first, CORE_C.ru));

    /* واللقطةُ نفسُها صارت تعرف — فلا تُعيد الكتابةَ في كلّ رسمة. */
    expect(storedTargets(draft)).toHaveLength(3);
    const rev = (await studyDrafts.get(draft.id)).rev;
    await ensureTargetIds(draft, [CORE_A, CORE_B, CORE_C]);
    expect((await studyDrafts.get(draft.id)).rev).toBe(rev);
    await studyDrafts.trash(draft.id);
  });

  it('٢٠ · ومسودّةٌ بلا معرّفاتٍ بعدُ تُقرأ فارغةً لا تُخطئ', async () => {
    expect(storedTargets(null)).toHaveLength(0);
    expect(storedTargets({})).toHaveLength(0);
    expect(storedTargets({ [TARGET_IDS]: 'مش مصفوفة' })).toHaveLength(0);
  });
});

/* ================================================================== *
 * الالتباس: بصمةٌ لا تكفي وحدَها (شروط المالك ١ إلى ٤)
 * ================================================================== */
describe('WS-DV2 · حين لا تكفي البصمة', () => {
  const ANSWER = 'Я бы сначала уточнил детали.';

  /** تكراران بنفس الإجابة وسؤالين مختلفين — مثالُ المالك حرفيًّا. */
  const V1 = { role: ROLE.VARIATION, ru: ANSWER, cue: 'Что бы ты сделал сначала?' };
  const V2 = { role: ROLE.VARIATION, ru: ANSWER, cue: 'Что нужно сделать перед проверкой?' };

  it('٢١ · ⚠️ سؤالان مختلفان يفصلان هدفين بنفس الإجابة', async () => {
    /*
     * ⚠️ **هذه الحالةُ أسقطت بصمتي الأولى.** «الدورُ والنصّ» جعلاهما
     *    واحدًا، فوزّع الدلوُ المعرّفَين بترتيب الظهور — أي بالموضع.
     */
    expect(fingerprint(V1.role, V1.ru, V1) === fingerprint(V2.role, V2.ru, V2)).toBe(false);

    const first = reconcileTargets([V1, V2], []).targets;
    expect(first).toHaveLength(2);
    expect(first[0].id === first[1].id).toBe(false);
  });

  it('٢٢ · ⚠️ وتبديلُ ترتيبهما لا ينقل «خلصت» من أحدهما للآخر', async () => {
    const first = reconcileTargets([V1, V2], []).targets;
    const idV1 = first[0].id;
    const idV2 = first[1].id;

    /* نقلبُهما — ولو كانت المطابقةُ بالموضع لَتبادلا المعرّفَين. */
    const after = reconcileTargets([V2, V1], first);
    expect(after.targets[0].id).toBe(idV2);
    expect(after.targets[1].id).toBe(idV1);
    expect(after.ambiguous).toHaveLength(0);
    expect(after.minted).toBe(0);
  });

  it('٢٣ · وعائلتان مختلفتان تفصلان كذلك', async () => {
    const a = { role: ROLE.VARIATION, ru: ANSWER, family: 'я бы сначала уточнил…' };
    const b = { role: ROLE.VARIATION, ru: ANSWER, family: 'уточнить вопрос' };
    expect(fingerprint(a.role, a.ru, a) === fingerprint(b.role, b.ru, b)).toBe(false);

    const first = reconcileTargets([a, b], []).targets;
    const after = reconcileTargets([b, a], first);
    expect(after.targets[0].id).toBe(first[1].id);
    expect(after.targets[1].id).toBe(first[0].id);
  });

  it('٢٤ · ⚠️ وإدراجُ مثيلٍ لا يميّزه شيءٌ يُبلَّغ ولا يُخمَّن', async () => {
    /*
     * ⚠️ **شرطُ المالك ٣ بعينه.** ثلاثةُ أهدافٍ لا يفرّقها سؤالٌ ولا
     *    عائلةٌ ولا نصّ، وكان اثنان. فأيُّ القديمين هو الأوّلُ الآن؟
     *    لا جواب. والاختيارُ بالموضع يُسلِّم «خلصت» لهدفٍ لم يُفتَح —
     *    فتُولَد معرّفاتٌ جديدةٌ ويُقال الالتباسُ صراحةً.
     */
    const twin = t(ROLE.VARIATION, ANSWER);
    const first = reconcileTargets([twin, twin], []).targets;
    const before = new Set(first.map((one) => one.id));

    const after = reconcileTargets([twin, twin, twin], first);

    expect(after.ambiguous).toHaveLength(1);
    expect(after.ambiguous[0].before).toBe(2);
    expect(after.ambiguous[0].after).toBe(3);
    expect(after.minted).toBe(3);
    expect(after.kept).toBe(0);
    /* ولا معرّفَ قديمٍ نجا — فلا تقدُّمَ ينتقل. */
    expect(after.targets.some((one) => before.has(one.id))).toBe(false);
  });

  it('٢٥ · وحذفُ أحد المتماثلين يُبلَّغ كذلك', async () => {
    const twin = t(ROLE.VARIATION, ANSWER);
    const first = reconcileTargets([twin, twin, twin], []).targets;
    const after = reconcileTargets([twin, twin], first);

    expect(after.ambiguous).toHaveLength(1);
    expect(after.kept).toBe(0);
    expect(after.minted).toBe(2);
  });

  it('٢٦ · والملتبسُ لا يمسّ غيرَه من الأهداف', async () => {
    const twin = t(ROLE.VARIATION, ANSWER);
    const solo = t(ROLE.MICRO_CORE, 'уточнить этот вопрос');
    const first = reconcileTargets([solo, twin, twin], []).targets;
    const soloId = first[0].id;

    const after = reconcileTargets([solo, twin, twin, twin], first);
    /* الملتبسُ وحدَه يُولَد من جديد، والمنفردُ يحتفظ بمعرّفه. */
    expect(after.targets[0].id).toBe(soloId);
    expect(after.ambiguous).toHaveLength(1);
  });
});

/* ================================================================== *
 * الشريطُ السريع لا يخمّن (شرط المالك ٥)
 * ================================================================== */
describe('WS-DV2 · ربطُ الشريط آمنٌ من الالتباس', () => {
  it('٢٧ · مطابقٌ واحدٌ فقط يُربَط', async () => {
    const { targets } = reconcileTargets([CORE_A, CORE_B], []);
    const linked = linkQuickChain([{ cue: 'س', ru: CORE_A.ru }], targets);
    expect(linked[0].state).toBe('linked');
    expect(linked[0].ref).toBe(idOf(targets, CORE_A.ru));
  });

  it('٢٨ · ⚠️ ومطابقان يُبلَّغان ولا يُختار أوّلُهما', async () => {
    /*
     * ⚠️ نصٌّ يطابق هدفين هو سؤالٌ بلا جواب. وأخذُ الأوّل يربط المراجعةَ
     *    بهدفٍ ليس هدفَها — فيُظهر تقدّمًا في غير موضعه.
     */
    const twinA = { role: ROLE.MICRO_CORE, ru: 'уточнить детали', cue: 'أ' };
    const twinB = { role: ROLE.VARIATION, ru: 'уточнить детали', cue: 'ب' };
    const { targets } = reconcileTargets([twinA, twinB], []);

    const linked = linkQuickChain([{ cue: 'س', ru: 'уточнить детали' }], targets);
    expect(linked[0].state).toBe('ambiguous');
    expect(linked[0].ref).toBe(null);
    expect(linked[0].candidates).toHaveLength(2);
  });

  it('٢٩ · وإجابةٌ بلا نظيرٍ تُقال «فريدة» لا «مربوطة»', async () => {
    const { targets } = reconcileTargets([CORE_A], []);
    const linked = linkQuickChain([{ cue: 'س', ru: 'нечто новое' }], targets);
    expect(linked[0].state).toBe('unique');
    expect(linked[0].ref).toBe(null);
  });
});

/* ================================================================== *
 * ترميزُ البصمة — لا حدَّ كاذبًا من محتوًى مؤلَّف
 * ================================================================== */
describe('WS-DV2 · البصمةُ لا تُخدَع بمحرف فاصل', () => {
  it('٣٠ · ⚠️ فاصلٌ في نصٍّ مؤلَّفٍ لا يصنع تصادمًا', async () => {
    /*
     * ⚠️ **وأوّلُ حارسٍ كتبتُه هنا كان أجوف.** اخترتُ زوجًا ظننتُه
     *    يتصادم، فمرّ الاختبارُ قبل الإصلاح وبعده — لأنّ الزوجَ لم يكن
     *    يتصادم أصلًا. قِستُه فبان:
     *
     *        cue='а|б' · ru='в'   →  R|а|б|||в
     *        cue='а'   · ru='б|в' →  R|а|||б|в     ← مختلفتان
     *
     *    والتصادمُ الحقيقيُّ حين ينزلق الفاصلُ بين **حقلين متجاورين**:
     *
     *        cue='а|б' · family='в' →  R|а|б|в|г|д
     *        cue='а'   · family='б|в' →  R|а|б|в|г|д   ← متساويتان
     *
     *    فاختبارٌ يمرّ قبل الإصلاح لا يحرس شيئًا.
     */
    const left = fingerprint(ROLE.VARIATION, 'д', { cue: 'а|б', family: 'в', parent: 'г' });
    const right = fingerprint(ROLE.VARIATION, 'д', { cue: 'а', family: 'б|в', parent: 'г' });
    expect(left === right).toBe(false);

    /* والوصلُ بـ`|` كان يجعلهما واحدًا — نُثبت ذلك صراحةً. */
    const glued = (role, ru, c) => `${role}|${c.cue || ''}|${c.family || ''}|${c.parent || ''}|${ru}`;
    expect(glued(ROLE.VARIATION, 'д', { cue: 'а|б', family: 'в', parent: 'г' }))
      .toBe(glued(ROLE.VARIATION, 'д', { cue: 'а', family: 'б|в', parent: 'г' }));

    /* وهدفان كهذين يبقيان اثنين بمعرّفين. */
    const { targets } = reconcileTargets([
      { role: ROLE.VARIATION, ru: 'д', cue: 'а|б', family: 'в', parent: 'г' },
      { role: ROLE.VARIATION, ru: 'д', cue: 'а', family: 'б|в', parent: 'г' },
    ], []);
    expect(targets).toHaveLength(2);
    expect(targets[0].id === targets[1].id).toBe(false);
  });

  it('٣١ · واقتباسٌ أو شرطةٌ مائلةٌ في النصّ لا تكسر الترميز', async () => {
    const odd = fingerprint(ROLE.MICRO_CORE, 'он сказал: "да" \\ нет');
    /* سلسلةٌ صالحةٌ تُقرأ إلى خمسة حقول. */
    const back = JSON.parse(odd);
    expect(Array.isArray(back)).toBe(true);
    expect(back).toHaveLength(5);
    expect(back[0]).toBe(ROLE.MICRO_CORE);
  });

  it('٣٢ · والبصمةُ نفسُها لنفس المدخلات — حتميّةٌ لا عشوائيّة', async () => {
    const a = fingerprint(ROLE.EXPANSION, 'уточнить', { cue: 'что?', family: 'ф' });
    const b = fingerprint(ROLE.EXPANSION, 'уточнить', { cue: 'что?', family: 'ф' });
    expect(a).toBe(b);
  });
});

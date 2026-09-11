/**
 * LingoLife — تقدّمُ جلسة الظلّ (WS-PR)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العطبُ المقيسُ قبل كتابة سطرٍ واحد
 * ═══════════════════════════════════════════════════════════════
 *
 * كانت الشاشةُ تقول أثناء تدريب المسودّة: **«4 / 03 SENTENCES»** —
 * موضعٌ رابعٌ في ثلاثٍ. رقمان كلاهما خاطئ:
 *
 *   البسط  `player.state.index` فهرسٌ **مطلقٌ** في `ctx.segments`،
 *          ومقاطعُ التدريب تُلحَق بعد مقاطع المصدر.
 *   المقام `segments.length` **مجمَّدٌ لحظةَ الرسم**.
 *
 * والجوابُ في المحرّك: `sourceWindow` تحصر التنقّل. فكلاهما منها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ وثلاثةُ أرقامٍ لا رقمان
 * ═══════════════════════════════════════════════════════════════
 *
 *   موضعك  ملاحةٌ خالصة — لا تعني إتقانًا.
 *   مارست  `repetitionsCompleted` — في الذاكرة، لا ينجو من التحميل.
 *   خلصت   `CHUNK_STATE.DONE` بمعرّف الهدف — ينجو.
 *
 * والطلبُ نهى صراحةً عن خلطها. فأكثرُ ما يُقاس هنا أنّها **لا تتحرّك
 * معًا**.
 */

import { describe, it, expect } from './test-runner.js';
import {
  sessionProgress, targetIndex, sectionOf, CHAIN_SECTION, SECTION_LABEL,
} from '../js/services/shadow/session-progress.js';
import { learnModelSync } from '../js/services/shadow/draft-learning.js';
import { ROLE } from '../js/services/shadow/draft-targets.js';
import { CHUNK_STATE, CHUNK_STATES } from '../js/services/shadow/sentence-learning.js';
import { CHAIN_PARENT } from '../js/services/shadow/draft-v2.js';

const V3 = [
  'الجملة الأساسية:',
  'При рабо́те с документа́цией ва́жно проверя́ть ста́тус.',
  'وإحنا بنشتغل على التوثيق مهم نتحقق من الحالة',
  '',
  'MICRO CORE 1',
  'при рабо́те с документа́цией',
  'وإحنا بنشتغل على التوثيق',
  'Вопрос:',
  'С чем мы рабо́таем?',
  'بنشتغل على إيه؟',
  'Ответ:',
  'С документа́цией.',
  'على التوثيق',
  'Вопрос:',
  'Э́то на́ша зада́ча?',
  'دي مهمتنا؟',
  'Ответ:',
  'Да, э́то часть рабо́ты.',
  'أيوه دي جزء من الشغل',
  '',
  'MICRO CORE 2',
  'ста́тус докуме́нта',
  'حالة المستند',
  '',
  'EXPANDING RECALL',
  'EXPANSION 1',
  'Ва́жно проверя́ть ста́тус докуме́нта.',
  'مهم نتحقق من حالة المستند',
  '',
  'HIGH-VALUE CORE REPETITION',
  'CORE FAMILY: ва́жно + инфинити́в',
  'VARIATION 1',
  'Ва́жно проверя́ть сро́ки.',
  'مهم نتحقق من المواعيد',
  '',
  'FULL RECONSTRUCTION',
  'Вопрос:',
  'Что ва́жно при рабо́те с документа́цией?',
  'إيه المهم وإحنا بنشتغل على التوثيق؟',
  'Ответ:',
  'При рабо́те с документа́цией ва́жно проверя́ть ста́тус.',
  'وإحنا بنشتغل على التوثيق مهم نتحقق من الحالة',
  '',
  'QUICK RECALL CHAIN',
  'Вопрос:',
  'С чем мы рабо́таем?',
  'بنشتغل على إيه؟',
  'Ответ:',
  'С документа́цией.',
  'على التوثيق',
].join('\n');

/*
 * ⚠️ **والمعرّفاتُ تُثبَّت بـ`targetIds` — وإلّا سُكَّت من جديدٍ في كلّ
 *    قراءة، فلا تطابق الحالاتُ المكتوبةَ بمعرّفاتِ قراءةٍ سابقة.**
 *    أمسك هذا الحارسُ نفسُه غلطةً في كتابته: كتبتُ الحالاتِ بمعرّفاتِ
 *    نموذجٍ ثمّ قرأتُ نموذجًا ثانيًا، فقال «٠ خلصت» وهو مُحقّ.
 */
const BASE = learnModelSync({ text: V3 });
const model = (states = {}) =>
  learnModelSync({ text: V3, [CHUNK_STATES]: states, targetIds: BASE.targets });

/**
 * جلسةٌ كما تبنيها الشاشة: ثلاثُ جملِ مصدرٍ ثمّ وحداتُ التدريب مُلحَقة.
 *
 * ⚠️ **وهذا الشكلُ هو العطبُ نفسُه**: الإلحاقُ بعد المصدر هو ما يجعل
 *    الفهرسَ المطلقَ يكذب. فالتركيبةُ تُحاكي الحقيقةَ لا تُبسّطها.
 */
function buildSession(m, { done = new Set(), practised = new Set() } = {}) {
  const source = [0, 1, 2].map((i) => ({ id: `src-${i}`, sourceTextSnapshot: `جملة ${i}` }));
  const units = m.targets
    .filter((one) => one.role !== ROLE.EXAMPLE)
    .map((one, i) => ({
      id: `pick-${i}`,
      sourceTextSnapshot: one.ru,
      draftId: 'D1',
      targetId: one.id,
      temporary: true,
      repetitionsCompleted: practised.has(one.id) ? 1 : 0,
    }));
  void done;
  const segments = source.concat(units);
  return { segments, window: { from: source.length, to: segments.length - 1 } };
}

const doneStates = (n) => {
  const out = {};
  for (const one of BASE.targets.filter((o) => o.role !== ROLE.EXAMPLE).slice(0, n)) {
    out[one.id] = CHUNK_STATE.DONE;
  }
  return out;
};

/* ================================================================== *
 * أ) الموضع — العطبُ المُبلَّغ                                          *
 * ================================================================== */
describe('WS-PR · الموضعُ داخل النافذة لا في المصفوفة', () => {
  it('١ · المجموعُ عددُ وحدات النافذة لا طولُ المصفوفة', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.from, targetIndex(m));
    /* ثلاثُ جملِ مصدرٍ + وحداتُ التدريب — والمجموعُ وحداتُ التدريب وحدَها. */
    expect(segments.length > at.total).toBe(true);
    expect(at.total).toBe(window.to - window.from + 1);
  });

  it('٢ · ⚠️ وأوّلُ وحدةٍ موضعُها ١ لا ٤ — وهو العطبُ بعينه', async () => {
    /*
     * ⚠️ قِيس في المتصفّح قبل الإصلاح: «4 / 03 SENTENCES» ثمّ «7 / 03».
     *    البسطُ فهرسٌ مطلق، والمقامُ مجمَّدٌ من لحظة الرسم.
     */
    const m = model();
    const { segments, window } = buildSession(m);
    expect(window.from).toBe(3);
    expect(sessionProgress(segments, window, 3, targetIndex(m)).position).toBe(1);
    expect(sessionProgress(segments, window, 6, targetIndex(m)).position).toBe(4);
  });

  it('٣ · وآخرُ وحدةٍ موضعُها المجموع — لا يتجاوزه', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.to, targetIndex(m));
    expect(at.position).toBe(at.total);
    expect(at.next).toBe(null);
  });

  it('٤ · وجلسةٌ بلا نافذةٍ هي الجلسةُ كلُّها', async () => {
    const segments = [0, 1, 2].map((i) => ({ id: `s${i}`, sourceTextSnapshot: `ج${i}` }));
    const at = sessionProgress(segments, null, 1);
    expect(at.total).toBe(3);
    expect(at.position).toBe(2);
    /* ⚠️ ولا أقسامَ ولا إتمامٌ يُخترَع لجلسةٍ بلا مسودّة. */
    expect(at.hasRoles).toBe(false);
    expect(at.sections).toHaveLength(0);
  });
});

/* ================================================================== *
 * ب) الموضعُ ليس الإتمام                                               *
 * ================================================================== */
describe('WS-PR · موضعٌ وإتمامٌ رقمان لا رقم', () => {
  it('٥ · التنقّلُ وحدَه لا يرفع «خلصت» ولا ينقص «فاضل»', async () => {
    /*
     * ⚠️ **شرطُ الطلب حرفيًّا**: «لا تُعامِل (أنت عند الوحدة ١٢) على
     *    أنّها (أنهيتَ اثنتي عشرة)». فالمقياسُ أن يتحرّك أحدُهما
     *    ويثبت الآخر.
     */
    const m = model();
    const { segments, window } = buildSession(m);
    const byId = targetIndex(m);
    const first = sessionProgress(segments, window, window.from, byId);
    const later = sessionProgress(segments, window, window.from + 5, byId);
    expect(later.position).toBe(first.position + 5);
    expect(later.done).toBe(first.done);
    expect(later.remaining).toBe(first.remaining);
    expect(later.percentDone).toBe(first.percentDone);
  });

  it('٦ · و«خلصت» ترفع الإتمامَ ولا تحرّك الموضع', async () => {
    const m0 = model();
    const { segments, window } = buildSession(m0);
    const before = sessionProgress(segments, window, window.from + 3, targetIndex(m0));
    const m1 = model(doneStates(2));
    const after = sessionProgress(segments, window, window.from + 3, targetIndex(m1));
    expect(after.position).toBe(before.position);
    expect(after.done).toBe(2);
    expect(after.remaining).toBe(before.remaining - 2);
    expect(after.percentDone > before.percentDone).toBe(true);
  });

  it('٧ · و«مارست» ثالثٌ مستقلٌّ — دليلُ ممارسةٍ لا إتقان', async () => {
    /*
     * ⚠️ **ولمَ ثالثٌ؟** `repetitionsCompleted` يرتفع باكتمال دورةِ
     *    تكرار، ومقاطعُ التدريب مؤقّتةٌ في الذاكرة فلا ينجو من إعادة
     *    التحميل. وتسميتُه «خلصت» تَعِدُ ببقاءٍ لا يملكه.
     */
    const m = model();
    const ids = m.targets.filter((o) => o.role !== ROLE.EXAMPLE).slice(0, 3).map((o) => o.id);
    const { segments, window } = buildSession(m, { practised: new Set(ids) });
    const at = sessionProgress(segments, window, window.from, targetIndex(m));
    expect(at.practised).toBe(3);
    expect(at.done).toBe(0);
    expect(at.remaining).toBe(at.total);
  });

  it('٨ · و«فاضل» يُقاس بالإتمام لا بالموضع', async () => {
    const m = model(doneStates(4));
    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.to, targetIndex(m));
    expect(at.position).toBe(at.total);
    expect(at.remaining).toBe(at.total - 4);
    expect(at.remaining > 0).toBe(true);
  });
});

/* ================================================================== *
 * ج) الأقسامُ الدلاليّة                                                *
 * ================================================================== */
describe('WS-PR · القسمُ الجاري وتفصيلُ الأقسام', () => {
  it('٩ · القلبُ قلبٌ والسؤالُ سؤالٌ — ولا يُخلَطان', async () => {
    /*
     * ⚠️ **شرطُ الطلب**: «لا تُصنِّف الأسئلةَ قلوبًا». والتصنيفُ هنا
     *    من الدور المؤلَّف لا من النصّ.
     */
    const m = model();
    const { segments, window } = buildSession(m);
    const byId = targetIndex(m);
    const first = sessionProgress(segments, window, window.from, byId);
    expect(first.section.key).toBe(ROLE.MICRO_CORE);
    expect(first.section.label).toBe(SECTION_LABEL[ROLE.MICRO_CORE]);

    const second = sessionProgress(segments, window, window.from + 1, byId);
    expect(second.section.key).toBe(ROLE.RECALL_CUE);
    expect(second.section.label).toBe('الأسئلة');
  });

  it('١٠ · وشريطُ الاسترجاع السريع قسمٌ بذاته لا سؤالٌ عاديّ', async () => {
    /*
     * ⚠️ **بند ٩ من الطلب**: وحداتُه أسئلةٌ وإجاباتٌ بالدور، لكنّها
     *    مراجعةٌ مضغوطةٌ لا استرجاعُ قلبٍ بعينه. ودمجُها يُخفي أنّك
     *    دخلتَ المراجعة.
     */
    const m = model();
    const chain = m.targets.filter((one) => one.parent === CHAIN_PARENT);
    expect(chain.length > 0).toBe(true);
    expect(sectionOf(chain[0])).toBe(CHAIN_SECTION);
    expect(SECTION_LABEL[CHAIN_SECTION]).toBe('Quick Recall');

    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.to, targetIndex(m));
    expect(at.section.key).toBe(CHAIN_SECTION);
    /* ولا يزيد عدَّ القلوب. */
    const cores = at.sections.find((one) => one.key === ROLE.MICRO_CORE);
    expect(cores.total).toBe(2);
  });

  it('١١ · وإعادةُ البناء تشارك في التقدّم بقسمها', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.from, targetIndex(m));
    const full = at.sections.find((one) => one.key === ROLE.FULL_BUILD);
    expect(Boolean(full)).toBe(true);
    expect(full.total).toBe(1);
  });

  it('١٢ · وموضعُك داخل القسم يُقاس بترتيبك فيه', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const byId = targetIndex(m);
    /* الوحدةُ الرابعة: سؤالُ الزوج الثاني — الثاني في قسم الأسئلة. */
    const at = sessionProgress(segments, window, window.from + 3, byId);
    expect(at.section.key).toBe(ROLE.RECALL_CUE);
    expect(at.section.index).toBe(2);
    expect(at.section.total >= 2).toBe(true);
  });

  it('١٣ · ⚠️ ولا قسمَ بصفرٍ كاذبٍ لم يُؤلَّف', async () => {
    /*
     * ⚠️ **بند ١٤**: «لا تعرض أقسامًا صفريّةً لم تُؤلَّف». فمسودّةٌ فيها
     *    قلوبٌ فقط تعرض صفًّا واحدًا — لا سبعةَ صفوفٍ أصفارًا تُوهم
     *    بعملٍ لم يُطلَب.
     */
    const lean = learnModelSync({ text: ['MICRO CORE 1', 'ста́тус', 'حالة',
      'MICRO CORE 2', 'нали́чие', 'وجود'].join('\n') });
    const { segments, window } = buildSession(lean);
    const at = sessionProgress(segments, window, window.from, targetIndex(lean));
    expect(at.sections).toHaveLength(1);
    expect(at.sections[0].key).toBe(ROLE.MICRO_CORE);
    expect(at.sections[0].total).toBe(2);
  });

  it('١٤ · وتفصيلُ الأقسام يجمع إلى المجموع — فلا وحدةَ تضيع', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.from, targetIndex(m));
    const sum = at.sections.reduce((n, one) => n + one.total, 0);
    expect(sum).toBe(at.total);
  });
});

/* ================================================================== *
 * د) وعيُ الزوج                                                        *
 * ================================================================== */
describe('WS-PR · السؤالُ وإجابتُه زوجٌ واحد', () => {
  it('١٥ · السؤالُ يقول رقمَ زوجه والإجابةُ تقول نفسَ الرقم', async () => {
    /*
     * ⚠️ **والإجابةُ تُنسَب إلى سؤالها لا إلى ترتيبها بين الإجابات.**
     *    لو عُدَّت بترتيبها لَقال نصفا الزوج رقمين مختلفين، وانكسر
     *    «السلسلةُ المتّصلة» التي بُنيت عليها المسودّة كلُّها.
     */
    const m = model();
    const { segments, window } = buildSession(m);
    const byId = targetIndex(m);
    const q = sessionProgress(segments, window, window.from + 1, byId);
    const a = sessionProgress(segments, window, window.from + 2, byId);
    expect(q.pair.part).toBe('q');
    expect(a.pair.part).toBe('a');
    expect(a.pair.index).toBe(q.pair.index);

    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **وأوّلُ صياغةٍ لهذا الحارس مرّت على كودٍ خاطئ — قِستُ ذلك**
     * ═══════════════════════════════════════════════════════════════
     *
     * أبطلتُ «الإجابةُ تُنسَب إلى سؤالها» ووضعتُ مكانها «تُرقَّم بترتيبها
     * بين الإجابات»، فبقي الحارسُ أخضر: أوّلُ زوجين في المسودّة
     * متناوبان تمامًا، فالرقمان يتّفقان بالصدفة.
     *
     * والفرقُ يظهر حيث **يوجد سؤالٌ بلا إجابة**: سؤالُ إعادة البناء
     * (جوابُه هو نصُّ الهدف نفسِه فلا وحدةَ إجابةٍ له). فبعده تتقدّم
     * الأسئلةُ خطوةً ولا تتقدّم الإجاباتُ — وهنا يفترق العدّان.
     */
    const cueIds = m.targets.filter((o) => o.role === ROLE.RECALL_CUE);
    const ansIds = m.targets.filter((o) => o.role === ROLE.RECALL_ANSWER);
    expect(cueIds.length > ansIds.length).toBe(true);

    const units = sessionProgress(segments, window, window.from, byId).units;
    const lastA = units.map((one, i) => [one, i])
      .filter(([one]) => one.target?.role === ROLE.RECALL_ANSWER).pop();
    const at = sessionProgress(segments, window, window.from + lastA[1], byId);
    expect(at.pair.part).toBe('a');
    /* آخرُ إجابةٍ هي الثالثةُ ترتيبًا، وسؤالُها هو الرابع. */
    expect(at.pair.index).toBe(cueIds.length);
    expect(at.pair.index).toBe(ansIds.length + 1);
  });

  it('١٦ · وزوجان تحت قلبٍ واحدٍ يُعَدّان اثنين', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const byId = targetIndex(m);
    const second = sessionProgress(segments, window, window.from + 3, byId);
    expect(second.pair.index).toBe(2);
    expect(second.pair.part).toBe('q');
    const itsAnswer = sessionProgress(segments, window, window.from + 4, byId);
    expect(itsAnswer.pair.index).toBe(2);
    expect(itsAnswer.pair.part).toBe('a');
  });

  it('١٧ · وعلى السؤال يُعرَف أنّ الإجابةَ هي التالية', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.from + 1, targetIndex(m));
    expect(at.next.key).toBe(ROLE.RECALL_ANSWER);
  });

  it('١٨ · ووحدةٌ ليست سؤالًا ولا إجابةً بلا زوج', async () => {
    const m = model();
    const { segments, window } = buildSession(m);
    const at = sessionProgress(segments, window, window.from, targetIndex(m));
    expect(at.pair).toBe(null);
  });
});

/* ================================================================== *
 * هـ) الشاشةُ والأداء                                                  *
 * ================================================================== */
describe('WS-PR · حرّاسٌ على الشاشة', () => {
  let VIEW = '';
  const view = async () => {
    if (!VIEW) VIEW = await (await fetch('../js/views/shadow-view.js')).text();
    return VIEW;
  };

  it('١٩ · العدّادُ القديمُ صار يقرأ النافذة — لا الفهرسَ المطلق', async () => {
    const src = await view();
    expect(src).toContain('pos.textContent = String(index - from + 1)');
    /* ⚠️ والمقامُ عنصرٌ يُكتَب لا نصٌّ مجمَّدٌ لحظةَ الرسم. */
    expect(src).toContain('data-pos-total');
  });

  it('٢٠ · وسطرُ التقدّم يتبع نقلةَ الوحدة لا نبضَ الصوت', async () => {
    const src = await view();
    /*
     * ⚠️ **شرطُ الأداء**: `timeupdate` يقع عشراتِ المرّات في الثانية.
     *    فلو نُودي الحسابُ منه لَصار كلُّ تشغيلٍ عاصفةَ رسمٍ وقراءة.
     *    و`syncSegment` تُنادى عند تغيّر الوحدة وحدَها.
     */
    const at = src.indexOf('function syncSegment()');
    const body = src.slice(at, src.indexOf('\nfunction ', at + 10));
    expect(body.includes('renderProgress()')).toBe(true);

    /*
     * ⚠️ **وأوّلُ صياغةٍ لهذا الحارس قاست نثرًا لا كودًا**: اشترطت
     *    ألّا ترد كلمةُ `timeupdate` في جسم الدالّة — فسقط الحارسُ على
     *    **تعليقي أنا** الذي يشرح أنّها لا ترد. حارسٌ يقرأ التعليقاتِ
     *    يحرس الكتابةَ لا السلوك.
     *
     *    فالمقياسُ الصحيح: `renderProgress` تُنادى من مواضعَ معدودةٍ
     *    كلُّها أحداثٌ ذاتُ معنًى، و«النبضة» ليست منها.
     */
    const calls = (src.match(/renderProgress\(\)/g) || []).length;
    expect(calls <= 5).toBe(true);
    const tick = src.indexOf("case 'tick':");
    expect(src.slice(tick, tick + 400).includes('renderProgress')).toBe(false);
  });

  it('٢١ · ولا كتابةَ في القاعدة من رسم التقدّم', async () => {
    const src = await view();
    const at = src.indexOf('async function renderProgress()');
    const body = src.slice(at, src.indexOf('\n}\n', at));
    /* ⚠️ `learnModel` تكتب `targetIds`؛ و`modelForDraft` تقرأ وتخزّن. */
    expect(body.includes('learnModel(')).toBe(false);
    expect(body.includes('modelForDraft')).toBe(true);
    for (const bad of ['.update(', '.put(', 'setTargetState']) {
      expect(body.includes(bad)).toBe(false);
    }
  });

  it('٢٢ · و«خلصت» تُبطل النموذجَ المخزَّن — وإلّا تجمّد الرقم', async () => {
    const src = await view();
    /*
     * ⚠️ **رقمٌ صحيحٌ لحظةَ حُسب وكاذبٌ بعدها أسوأُ من غيابه.** الحالةُ
     *    تُكتَب فيرتفع `rev`، والنموذجُ المخزَّنُ بالمراجعة يبقى قديمًا
     *    ما لم يُبطَل.
     */
    const at = src.indexOf("case 'chunk-state': {");
    const body = src.slice(at, at + 1100);
    expect(body.includes('draftModelCache = {')).toBe(true);
    expect(body.includes('renderProgress()')).toBe(true);
  });

  it('٢٣ · ولا يُحفَظ موضعٌ داخل مصدرٍ مؤقّت', async () => {
    const src = await view();
    /*
     * ⚠️ **نفسُ عيب الفهرس المطلق من بابٍ آخر**: مقاطعُ التدريب لا
     *    تُبعَث بعد إعادة التحميل، فحفظُ فهرسٍ منها يُوقفك غدًا على
     *    جملةٍ أخرى صادف أن فهرسَها هو نفسُه.
     */
    expect(src).toContain('if (!activeSegment()?.temporary) savePosition(');
  });

  it('٢٤ · وحالةُ طيّ التفصيل خارج الرسم فلا تنطبق مع كلّ نقلة', async () => {
    const src = await view();
    expect(src).toContain('let progMapOpen = false;');
    const at = src.indexOf("case 'prog-map':");
    expect(src.slice(at, at + 120).includes('progMapOpen = !progMapOpen;')).toBe(true);
  });

  it('٢٥ · وشريطُ الجلسة ليس شريطَ التكرار', async () => {
    const src = await view();
    /*
     * ⚠️ `[data-bar]` يقيس دورةَ تكرارِ **وحدةٍ واحدة** ويرجع إلى
     *    الصفر مع كلّ نقلة. ولو أُعيد استعمالُه للجلسة لَكذب أحدُهما
     *    دائمًا. فعنصران منفصلان بقصد.
     */
    expect(src).toContain('data-prog');
    expect(src).toContain('sh-prog-bar');
    const at = src.indexOf("case 'repeat': {");
    expect(src.slice(at, at + 500).includes('[data-prog]')).toBe(false);
  });
});

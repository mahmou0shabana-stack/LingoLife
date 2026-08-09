/**
 * LingoLife — اختبارات حياة التعبير والكلمة
 *
 * أربع قواعد تُحرَس:
 *
 *  1. **الواقعة واقعة والتقدير تقدير** — الظهور يُحسَب من القاعدة،
 *     والمرحلة لا يرفعها إلا نداءٌ صريح. لو رفعها شيءٌ آخر يومًا،
 *     يسقط اختبار.
 *  2. **العدّ يشير إلى ما يُفتَح** — «ظهر خمس مرّات» لا يعدّ ظهورًا
 *     في ذكرى محذوفة، وإلا صار الرقم يشير إلى العدم.
 *  3. **الكلمة مُشتقّة لا مخزَّنة** — لا مستودعَ ثانيًا لها، وحدودُ
 *     الاشتقاق (المطابقة النصّيّة) معلومةٌ ومُختبَرة.
 *  4. **ما لا يُبنى مُعلَن** — كل مدخلٍ في `UNBUILT` معه سببٌ مكتوب،
 *     كما في `ABSENT_AXES` و`NOT_SUPPORTED`.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, expressions, expressionOccurrences, savedItems,
  conversationParts, scripts, people, eventThreads, relationships,
} from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { createScene } from '../js/services/scene-service.js';
import { resetTypes } from '../js/services/type-service.js';
import {
  addConversationPart, addExpression, addScript,
  EXPRESSION_SOURCE, expressionSourceLabel,
} from '../js/services/content-service.js';
import { saveItem, SAVED_KIND } from '../js/services/saved-service.js';
import {
  STAGES, STAGE_LABEL, stageIndex, UNBUILT,
  expressionLife, setStage, wordLife, languageOverview,
  unknownOriginCount, claimUnknownOrigins,
} from '../js/services/language-service.js';
import { wipeProbe, openAt, txDone, getAll } from './db-probe.js';

async function fresh() {
  await openDB();
  for (const repo of [
    scenes, expressions, expressionOccurrences, savedItems,
    conversationParts, scripts, people, eventThreads, relationships,
  ]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

const scene = (titleAr, date) => createScene({ titleAr, date, type: 'meeting' });

/* ================================================================== */

describe('المراحل — تقديرك أنت', () => {
  it('ستّ مراحل، لكل واحدة وسمٌ وتلميح', async () => {
    expect(STAGES.length).toBe(6);
    for (const stage of STAGES) {
      expect(Boolean(stage.id && stage.label && stage.hint)).toBe(true);
    }
    expect(STAGE_LABEL.used).toBe('استخدمته');
  });

  it('الترتيب يتصاعد، والمجهول يقع على الأولى لا على سالب واحد', async () => {
    expect(stageIndex('heard')).toBe(0);
    expect(stageIndex('automatic')).toBe(5);
    expect(stageIndex('لا-وجود-لها')).toBe(0);
  });

  it('مرحلةٌ غير معروفة تُرفَض ولا تُكتَب', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'по итогам' });

    let threw = false;
    try {
      await setStage(expression.id, 'أسطوري');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect((await expressions.get(expression.id)).masteryState).toBe('heard');
  });

  it('المرحلة تتغيّر بالنداء الصريح وحده', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'по итогам' });

    await setStage(expression.id, 'used');
    expect((await expressionLife(expression.id)).stage).toBe('used');
  });

  it('⚠️ الظهور المتكرّر لا يرفع المرحلة — الممارسة ليست إتقانًا', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const c = await scene('ج', '2026-04-03');

    const { expression } = await addExpression(a.id, { text: 'по итогам' });
    await addExpression(b.id, { text: 'по итогам' });
    await addExpression(c.id, { text: 'по итогам' });

    const life = await expressionLife(expression.id);
    expect(life.occurrences.length).toBe(3);
    // ظهر ثلاث مرّات — وما زال حيث تركتَه.
    expect(life.stage).toBe('heard');
  });
});

/* ================================================================== */

describe('حياة التعبير — الوقائع', () => {
  it('الظهورات مرتّبة بالتاريخ، وأوّلُها وآخرُها معلومان', async () => {
    await fresh();
    const b = await scene('المتأخّرة', '2026-06-10');
    const a = await scene('المبكّرة', '2026-04-01');

    const { expression } = await addExpression(b.id, { text: 'на самом деле' });
    await addExpression(a.id, { text: 'на самом деле' });

    const life = await expressionLife(expression.id);
    expect(life.occurrences.map((o) => o.date)).toEqual(['2026-04-01', '2026-06-10']);
    expect(life.firstSeen).toBe('2026-04-01');
    expect(life.lastSeen).toBe('2026-06-10');
  });

  it('عنوان كل ظهور من ذكراه، فالخطّ الزمنيّ يُقرأ بلا فتح', async () => {
    await fresh();
    const s = await scene('قعدة الشلّة', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'кстати' });

    const life = await expressionLife(expression.id);
    expect(life.occurrences[0].title).toBe('قعدة الشلّة');
    expect(life.occurrences[0].sceneId).toBe(s.id);
  });

  it('⚠️ الظهور في ذكرى محذوفة لا يُعَدّ — الرقم يشير إلى ما يُفتَح', async () => {
    await fresh();
    const a = await scene('باقية', '2026-04-01');
    const b = await scene('هتتحذف', '2026-04-02');

    const { expression } = await addExpression(a.id, { text: 'вроде бы' });
    await addExpression(b.id, { text: 'вроде бы' });
    expect((await expressionLife(expression.id)).occurrences.length).toBe(2);

    await scenes.trash(b.id);
    const life = await expressionLife(expression.id);
    expect(life.occurrences.length).toBe(1);
    expect(life.sceneCount).toBe(1);
    expect(life.lastSeen).toBe('2026-04-01');
  });

  it('ظهورٌ أُزيل من ذكراه يختفي، والتعبير يبقى حيًّا في غيرها', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const { expression } = await addExpression(a.id, { text: 'зато' });
    await addExpression(b.id, { text: 'зато' });

    const rows = await expressionOccurrences.byIndex('expressionId', expression.id);
    await expressionOccurrences.trash(rows.find((r) => r.sceneId === a.id).id);

    const life = await expressionLife(expression.id);
    expect(life.occurrences.length).toBe(1);
    expect(life.occurrences[0].sceneId).toBe(b.id);
  });

  it('ذكريتان في نفس اليوم ظهوران وذكريتان', async () => {
    await fresh();
    const a = await scene('صبحًا', '2026-04-01');
    const b = await scene('مساءً', '2026-04-01');
    const { expression } = await addExpression(a.id, { text: 'по идее' });
    await addExpression(b.id, { text: 'по идее' });

    const life = await expressionLife(expression.id);
    expect(life.occurrences.length).toBe(2);
    expect(life.sceneCount).toBe(2);
  });

  it('التقاطك لنفس النصّ يظهر بأسبابه', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'связь' });
    await saveItem({ text: 'связь', kind: SAVED_KIND.WORD, tagIds: ['hard', 'pron'] });

    const life = await expressionLife(expression.id);
    expect(life.captureTags.sort()).toEqual(['صعبة', 'نطقها صعب']);
  });

  it('تعبيرٌ غير موجود أو محذوف يعطي لا شيء، ولا يرمي', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'ага' });

    expect(await expressionLife('لا-يوجد')).toBe(null);
    await expressions.trash(expression.id);
    expect(await expressionLife(expression.id)).toBe(null);
  });
});

/* ================================================================== */

describe('حياة الكلمة — مُشتقّة لا مخزَّنة', () => {
  it('تُوجَد في المحادثة وفي السكريبت، وتُنسَب إلى ذكرياتها', async () => {
    await fresh();
    const a = await scene('مكالمة', '2026-04-01');
    const b = await scene('اجتماع', '2026-04-05');
    await addConversationPart(a.id, { speaker: 'أنا', text: 'связь плохая' });
    await addScript(b.id, { title: 'س', text: 'проверка связь сегодня' });

    const life = await wordLife('связь');
    expect(life.inConversation).toBe(1);
    expect(life.inScripts).toBe(1);
    expect(life.scenes.map((s) => s.title)).toEqual(['مكالمة', 'اجتماع']);
  });

  it('⚠️ المطابقة نصّيّة لا صرفيّة — وهو حدٌّ مُعلَن', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'أنا', text: 'вчера шёл дождь' });

    // «идти» و«шёл» فعلٌ واحد صرفيًّا — ولا شيء هنا يعرف ذلك.
    expect((await wordLife('идти')).scenes.length).toBe(0);
    expect((await wordLife('шёл')).scenes.length).toBe(1);
  });

  it('الكلمة كاملةً لا جزءًا من غيرها', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'أنا', text: 'связьный кабель' });

    // «связь» داخل «связьный» ليست وقوعًا للكلمة.
    expect((await wordLife('связь')).inConversation).toBe(0);
  });

  it('التعبيرات التي تحويها مدخلٌ إلى حياةٍ أوسع', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addExpression(s.id, { text: 'по итогам встречи', meaningAr: 'بناءً على النتائج' });

    const life = await wordLife('итогам');
    expect(life.expressions.length).toBe(1);
    expect(life.expressions[0].meaningAr).toBe('بناءً على النتائج');
  });

  it('التقاطاتك تُعَدّ، والجملة المحفوظة ليست كلمة', async () => {
    await fresh();
    await saveItem({ text: 'связь', kind: SAVED_KIND.WORD, tagIds: ['hard'] });
    await saveItem({ text: 'связь', kind: SAVED_KIND.SENTENCE });

    const life = await wordLife('связь');
    expect(life.captured).toBe(1);
    expect(life.captureTags).toEqual(['صعبة']);
  });

  it('ذكرى محذوفة تخرج من نتائج الكلمة', async () => {
    await fresh();
    const s = await scene('هتتحذف', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'أنا', text: 'связь плохая' });
    expect((await wordLife('связь')).scenes.length).toBe(1);

    await scenes.trash(s.id);
    expect((await wordLife('связь')).scenes.length).toBe(0);
  });

  it('نصٌّ فارغ يعطي لا شيء ولا يرمي', async () => {
    await fresh();
    expect(await wordLife('')).toBe(null);
    expect(await wordLife('   ')).toBe(null);
    expect(await wordLife(null)).toBe(null);
  });

  it('لا يكتب هذا شيئًا في مستودع `words`', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addConversationPart(s.id, { speaker: 'أنا', text: 'связь плохая' });
    await wordLife('связь');

    // العالم الثاني لا يُنشأ من وراء ظهرك.
    expect((await languageOverview()).unbuilt.words).toBe(0);
  });
});

/* ================================================================== */

describe('لغتي — كل رقمٍ معه ما يفسّره', () => {
  it('الأكثر ظهورًا أوّلًا، ومعه عدّه ومعناه', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');

    await addExpression(a.id, { text: 'редкое', meaningAr: 'نادر' });
    await addExpression(a.id, { text: 'частое', meaningAr: 'شائع' });
    await addExpression(b.id, { text: 'частое' });

    const view = await languageOverview();
    expect(view.expressions.total).toBe(2);
    expect(view.expressions.top[0].text).toBe('частое');
    expect(view.expressions.top[0].seen).toBe(2);
    expect(view.expressions.top[0].meaningAr).toBe('شائع');
  });

  it('التساوي يُرتَّب بالنصّ فلا يتبدّل الترتيب بين قراءتين', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addExpression(s.id, { text: 'ббб' });
    await addExpression(s.id, { text: 'ааа' });

    const first = (await languageOverview()).expressions.top.map((r) => r.text);
    const second = (await languageOverview()).expressions.top.map((r) => r.text);
    expect(first).toEqual(['ааа', 'ббб']);
    expect(second).toEqual(first);
  });

  it('المراحل الستّ كلها تُعرَض ولو بصفر', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'по итогам' });
    await setStage(expression.id, 'used');

    const view = await languageOverview();
    expect(view.expressions.byStage.length).toBe(6);
    expect(view.expressions.byStage.find((r) => r.id === 'used').count).toBe(1);
    expect(view.expressions.byStage.find((r) => r.id === 'heard').count).toBe(0);
  });

  it('الكلمات والجُمل مفصولتان', async () => {
    await fresh();
    await saveItem({ text: 'связь', kind: SAVED_KIND.WORD });
    await saveItem({ text: 'мост', kind: SAVED_KIND.WORD });
    await saveItem({ text: 'как дела', kind: SAVED_KIND.SENTENCE });

    const view = await languageOverview();
    expect(view.words.total).toBe(2);
    expect(view.sentences.total).toBe(1);
  });

  it('التعبير المحذوف يخرج من العدّ ومن القائمة', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'зато' });
    await addExpression(s.id, { text: 'кстати' });

    await expressions.trash(expression.id);
    const view = await languageOverview();
    expect(view.expressions.total).toBe(1);
    expect(view.expressions.top.map((r) => r.text)).toEqual(['кстати']);
  });

  it('السقف يُحترَم', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    for (let i = 0; i < 12; i += 1) await addExpression(s.id, { text: `слово${i}` });

    expect((await languageOverview({ limit: 5 })).expressions.top.length).toBe(5);
  });

  it('عالمٌ فارغ يعطي أصفارًا صادقة لا يرمي', async () => {
    await fresh();
    const view = await languageOverview();
    expect(view.expressions.total).toBe(0);
    expect(view.expressions.top).toEqual([]);
    expect(view.words.total).toBe(0);
    expect(view.expressions.byStage.length).toBe(6);
  });
});

/* ================================================================== */

describe('منشأ الظهور — من فين جه', () => {
  it('كل مصدرٍ معه وسمٌ عربيّ، والمجهول له وسمٌ كمان', async () => {
    for (const id of Object.values(EXPRESSION_SOURCE)) {
      expect(expressionSourceLabel(id).length > 0).toBe(true);
    }
    // ولا يُترَك المجهول بلا كلمة: قيمةٌ لا نعرفها تقع على «مش معروف».
    expect(expressionSourceLabel('حاجة-مخترعة'))
      .toBe(expressionSourceLabel(EXPRESSION_SOURCE.UNKNOWN));
  });

  it('⚠️ نداءٌ بلا منشأ لا يُنسَب إلى «يدوي» كذبًا', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'по итогам' });

    const life = await expressionLife(expression.id);
    expect(life.occurrences[0].source).toBe(EXPRESSION_SOURCE.UNKNOWN);
  });

  it('المنشأ يُكتب كما مُرِّر — والمسارات الثلاثة تختلف فعلًا', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01');
    const b = await scene('ب', '2026-04-02');
    const c = await scene('ج', '2026-04-03');

    const { expression } = await addExpression(a.id, {
      text: 'по итогам', source: { type: EXPRESSION_SOURCE.MANUAL },
    });
    await addExpression(b.id, {
      text: 'по итогам',
      source: { type: EXPRESSION_SOURCE.IMPORT, quote: 'По итогам встречи решили.' },
    });
    await addExpression(c.id, {
      text: 'по итогام', source: { type: EXPRESSION_SOURCE.SHADOW, id: 'SES_1' },
    });

    const life = await expressionLife(expression.id);
    expect(life.occurrences.map((o) => o.source))
      .toEqual([EXPRESSION_SOURCE.MANUAL, EXPRESSION_SOURCE.IMPORT]);
    expect(life.occurrences[1].quote).toBe('По итогам встречи решили.');
  });

  it('منشأٌ غير معروف يقع على «مش معروف» ولا يُكتب كما جاء', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, {
      text: 'зато', source: { type: 'حاجة-مخترعة' },
    });

    expect((await expressionLife(expression.id)).occurrences[0].source)
      .toBe(EXPRESSION_SOURCE.UNKNOWN);
  });

  it('معرّف المصدر يُحفَظ — تعرف أي جلسةٍ التقطته فيها', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, {
      text: 'кстати', source: { type: EXPRESSION_SOURCE.SHADOW, id: 'SES_7' },
    });

    const rows = await expressionOccurrences.byIndex('expressionId', expression.id);
    expect(rows[0].sourceId).toBe('SES_7');
  });

  it('الاقتباس يُشذَّب، والفارغ يبقى فارغًا لا مسافة', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, {
      text: 'зато', source: { type: EXPRESSION_SOURCE.IMPORT, quote: '  Зато честно.  ' },
    });
    const b = await scene('ب', '2026-04-02');
    await addExpression(b.id, {
      text: 'зато', source: { type: EXPRESSION_SOURCE.IMPORT, quote: '   ' },
    });

    const life = await expressionLife(expression.id);
    expect(life.occurrences[0].quote).toBe('Зато честно.');
    expect(life.occurrences[1].quote).toBe('');
  });

  /*
   * ⚠️ حدٌّ معروف يُوثَّق باختبارٍ لا بجملةٍ في ملفّ: الظهورات المكتوبة
   *    قبل بند 38 تحمل `'manual'` حرفيًّا للمسارات الثلاثة كلها، فلا
   *    سبيل لتمييزها بلا ترقيةٍ تكتب في بيانات المستخدم.
   */
  it('⚠️ ظهورٌ قديم يقول «يدوي» ولو جاء من غيره — حدٌّ موثَّق', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, {
      text: 'вроде', source: { type: EXPRESSION_SOURCE.IMPORT },
    });

    // نحاكي صفًّا كُتب قبل التغيير: `sourceType` ثابتٌ بلا معنى.
    const [row] = await expressionOccurrences.byIndex('expressionId', expression.id);
    await expressionOccurrences.update(row.id, { sourceType: 'manual', sourceId: null });

    expect((await expressionLife(expression.id)).occurrences[0].source)
      .toBe(EXPRESSION_SOURCE.MANUAL);
  });
});

/* ================================================================== */

/* ==================================================================
 * ترقية v10 — ادّعاءٌ ثابتٌ يصير إقرارًا بالجهل
 *
 * ⚠️ تُبنى قاعدةٌ على v9 بيدٍ، فيها ظهوراتٌ بالشكل الذي كان
 *    (`sourceType: 'manual'` للمسارات الثلاثة كلها)، ثم تُرقّى ويُسأل:
 *    هل صار الادّعاء إقرارًا، وهل بقي كل شيءٍ آخر؟
 * ================================================================== */

const PROBE_DB = 'v10-origin-migration-probe';

describe('ترقية v10 — منشأ الظهورات القديمة', () => {
  it('«يدوي» الثابت يصير «مش معروف»', async () => {
    await wipeProbe(PROBE_DB);

    let db = await openAt(PROBE_DB, 9);
    let tx = db.transaction('expressionOccurrences', 'readwrite');
    // ثلاثة ظهورات كما كانت تُكتب: النوع واحدٌ والمنشأ ثلاثة.
    for (const id of ['OC_a', 'OC_b', 'OC_c']) {
      tx.objectStore('expressionOccurrences').put({
        id, expressionId: 'EXP_1', sceneId: 'SC_1', state: 'active',
        occurredAt: 1, kind: 'appeared', sourceQuote: '', sourceType: 'manual',
      });
    }
    await txDone(tx);
    db.close();

    db = await openAt(PROBE_DB, 10);
    const rows = await getAll(db, 'expressionOccurrences');
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.sourceType === 'unknown')).toBe(true);
    db.close();
  });

  it('⚠️ لا تلمس إلا `sourceType` — باقي الصفّ كما هو', async () => {
    await wipeProbe(PROBE_DB);

    let db = await openAt(PROBE_DB, 9);
    let tx = db.transaction('expressionOccurrences', 'readwrite');
    tx.objectStore('expressionOccurrences').put({
      id: 'OC_keep', expressionId: 'EXP_7', sceneId: 'SC_9', state: 'active',
      occurredAt: 12345, kind: 'appeared', sourceQuote: 'اقتباس محفوظ',
      sourceType: 'manual',
    });
    await txDone(tx);
    db.close();

    db = await openAt(PROBE_DB, 10);
    const [row] = await getAll(db, 'expressionOccurrences');
    expect(row.expressionId).toBe('EXP_7');
    expect(row.sceneId).toBe('SC_9');
    expect(row.occurredAt).toBe(12345);
    expect(row.sourceQuote).toBe('اقتباس محفوظ');
    expect(row.sourceType).toBe('unknown');
    db.close();
  });

  it('منشأٌ معروف لا يُمسّ — وليست ترقيةً عمياء', async () => {
    await wipeProbe(PROBE_DB);

    let db = await openAt(PROBE_DB, 9);
    let tx = db.transaction('expressionOccurrences', 'readwrite');
    tx.objectStore('expressionOccurrences').put({
      id: 'OC_i', expressionId: 'EXP_1', sceneId: 'SC_1', state: 'active',
      occurredAt: 1, kind: 'appeared', sourceQuote: '', sourceType: 'import',
    });
    tx.objectStore('expressionOccurrences').put({
      id: 'OC_s', expressionId: 'EXP_1', sceneId: 'SC_2', state: 'active',
      occurredAt: 2, kind: 'appeared', sourceQuote: '', sourceType: 'shadow',
    });
    await txDone(tx);
    db.close();

    db = await openAt(PROBE_DB, 10);
    const byId = new Map((await getAll(db, 'expressionOccurrences')).map((r) => [r.id, r]));
    expect(byId.get('OC_i').sourceType).toBe('import');
    expect(byId.get('OC_s').sourceType).toBe('shadow');
    db.close();
  });

  it('قاعدةٌ بلا ظهورات ترقّى بلا سقوط', async () => {
    await wipeProbe(PROBE_DB);
    let db = await openAt(PROBE_DB, 9);
    db.close();
    db = await openAt(PROBE_DB, 10);
    expect((await getAll(db, 'expressionOccurrences')).length).toBe(0);
    db.close();
  });

  it('إعادة تشغيلها محايدة — لا تُفسد ما أصلحته', async () => {
    await wipeProbe(PROBE_DB);

    let db = await openAt(PROBE_DB, 9);
    let tx = db.transaction('expressionOccurrences', 'readwrite');
    tx.objectStore('expressionOccurrences').put({
      id: 'OC_x', expressionId: 'EXP_1', sceneId: 'SC_1', state: 'active',
      occurredAt: 1, kind: 'appeared', sourceQuote: '', sourceType: 'manual',
    });
    await txDone(tx);
    db.close();

    db = await openAt(PROBE_DB, 10);
    db.close();

    /*
     * بعد الترقية تقرّ بأنها لك، ثم تُرقّى القاعدة مرّةً أخرى (إصدارٌ
     * أعلى) — إقرارُك يجب أن يبقى، لا أن تُعيد الترقية طمسه.
     */
    db = await openAt(PROBE_DB, 10);
    let tx2 = db.transaction('expressionOccurrences', 'readwrite');
    tx2.objectStore('expressionOccurrences').put({
      id: 'OC_x', expressionId: 'EXP_1', sceneId: 'SC_1', state: 'active',
      occurredAt: 1, kind: 'appeared', sourceQuote: '', sourceType: 'manual',
    });
    await txDone(tx2);
    db.close();

    db = await openAt(PROBE_DB, 11);
    const [row] = await getAll(db, 'expressionOccurrences');
    expect(row.sourceType).toBe('manual');
    db.close();
    await wipeProbe(PROBE_DB);
  });
});

/* ================================================================== */

describe('إقرارك بما تعرفه — لا التطبيق', () => {
  it('العدّ يقول كم ظهورًا مجهولًا', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addExpression(s.id, { text: 'зато' });                       // مجهول
    await addExpression(s.id, {
      text: 'кстати', source: { type: EXPRESSION_SOURCE.MANUAL },
    });

    expect(await unknownOriginCount()).toBe(1);
  });

  it('الإقرار يحوّل المجهول إلى «كتبته بإيدك» ولا يمسّ غيره', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'зато' });
    const b = await scene('ب', '2026-04-02');
    await addExpression(b.id, {
      text: 'зато', source: { type: EXPRESSION_SOURCE.IMPORT },
    });

    expect(await claimUnknownOrigins()).toBe(1);
    const life = await expressionLife(expression.id);
    expect(life.occurrences.map((o) => o.source))
      .toEqual([EXPRESSION_SOURCE.MANUAL, EXPRESSION_SOURCE.IMPORT]);
    expect(await unknownOriginCount()).toBe(0);
  });

  it('إقرارٌ على عالمٍ بلا مجهول لا يفعل شيئًا ولا يرمي', async () => {
    await fresh();
    expect(await claimUnknownOrigins()).toBe(0);
  });

  it('⚠️ الظهور المحذوف لا يُعَدّ ولا يُقَرّ به', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const { expression } = await addExpression(s.id, { text: 'зато' });
    const [row] = await expressionOccurrences.byIndex('expressionId', expression.id);
    await expressionOccurrences.trash(row.id);

    expect(await unknownOriginCount()).toBe(0);
    expect(await claimUnknownOrigins()).toBe(0);
    // وما زال في السلة كما هو — الإقرار لا يستعيد محذوفًا.
    expect((await expressionOccurrences.get(row.id)).sourceType)
      .toBe(EXPRESSION_SOURCE.UNKNOWN);
  });
});

/* ================================================================== */

describe('ما لم يُبنَ — مُعلَنٌ لا مسكوتٌ عنه', () => {
  it('كل مدخلٍ في `UNBUILT` معه سببٌ مكتوب', async () => {
    const entries = Object.entries(UNBUILT);
    expect(entries.length > 0).toBe(true);
    for (const [key, reason] of entries) {
      // سببٌ حقيقيّ يشرح، لا «مش متاح».
      expect(typeof reason === 'string' && reason.length > 30).toBe(true);
      expect(key.length > 0).toBe(true);
    }
  });

  it('⚠️ المستودعان المُعلَنان ما زالا بلا كاتب — فلو كتب فيهما شيء انتبهنا', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addExpression(s.id, { text: 'по итогам', meaningAr: 'بناءً على' });
    await addConversationPart(s.id, { speaker: 'أنا', text: 'по итогам встречи' });
    await saveItem({ text: 'связь', kind: SAVED_KIND.WORD });

    const view = await languageOverview();
    expect(view.unbuilt.words).toBe(0);
    expect(view.unbuilt.sentencePatterns).toBe(0);
    // ولكل صفرٍ منهما سببٌ مكتوب — لا يُعرَض كإنجازٍ ناقص.
    expect(Boolean(UNBUILT.words && UNBUILT.sentencePatterns)).toBe(true);
  });
});

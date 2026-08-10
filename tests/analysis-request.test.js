/**
 * LingoLife — اختبارات طلب التحليل الخارجي
 *
 * أربع قواعد تُحرَس:
 *
 *  1. **الطلب يقرأ ولا يكتب** — كما `planImport`. تصديرُه مرّتين لا
 *     يترك أثرًا في القاعدة.
 *  2. **الردّ حزمةُ استيرادٍ عاديّة** — الرحلة كاملةً تُختبَر: طلبٌ
 *     يخرج، وردٌّ يُصاغ على الصيغة المعلَنة فيه، ويمرّ بـ`parse`
 *     و`plan` و`apply` بلا صيغةٍ ثانية ولا بابٍ جانبيّ.
 *  3. **ما يخرج معلومٌ قبل خروجه** — `requestSummary` تعدّ ما في
 *     الملفّ، فالشاشة تقوله بعدده لا بوصفٍ عامّ.
 *  4. **التعليمات داخل الملفّ** — لا في وثيقةٍ تُنسى.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventThreads, relationships, conversationParts, conversations,
  expressions, expressionOccurrences, mistakeComparisons, scripts, contentBlocks,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { resetTypes } from '../js/services/type-service.js';
import {
  addConversationPart, addExpression, addScript, addMistake, saveBlock,
} from '../js/services/content-service.js';
import { parsePackage } from '../js/services/import/parse.js';
import { planImport, ACTION } from '../js/services/import/plan.js';
import { applyImport } from '../js/services/import/apply.js';
import {
  REQUEST_VERSION, buildAnalysisRequest, requestSummary, requestFilename,
} from '../js/services/analysis/request.js';

async function fresh() {
  await openDB();
  for (const repo of [
    scenes, people, eventThreads, relationships, conversations, conversationParts,
    expressions, expressionOccurrences, mistakeComparisons, scripts, contentBlocks,
  ]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

/** ذكرى فيها من كل شيء — كي يحمل الطلب ما يُحلَّل فعلًا. */
async function fullScene() {
  const scene = await createScene({
    titleAr: 'اجتماع الشحنة المتأخرة', titleRu: 'Встреча',
    date: '2026-04-02', type: 'meeting', placeName: 'مكتب ТрансЛогистика',
  });
  await addScript(scene.id, { title: 'السكريبت', text: 'Груз задержался на таможне.' });
  await addConversationPart(scene.id, { speaker: 'إيجور', text: 'Груз задержался.', translation: 'الشحنة اتأخرت.' });
  await addConversationPart(scene.id, { speaker: 'أنا', text: 'На сколько дней?', translation: 'كام يوم؟', isMine: true });
  await addExpression(scene.id, { text: 'по итогам', meaningAr: 'بناءً على النتائج' });
  await addMistake(scene.id, { wrong: 'я ждать', natural: 'я жду', mistakeType: 'grammar' });
  await saveBlock(scene.id, 'notes', 'لازم أراجع كلمات الجمارك.');
  return scene;
}

/* ================================================================== */

describe('طلب التحليل — ما فيه', () => {
  it('يحمل محتوى الذكرى كلّه', async () => {
    await fresh();
    const scene = await fullScene();

    const request = await buildAnalysisRequest(scene.id);
    expect(request.memory.title).toBe('اجتماع الشحنة المتأخرة');
    expect(request.memory.date).toBe('2026-04-02');
    expect(request.memory.place).toBe('مكتب ТрансЛогистика');
    expect(request.memory.scripts.length).toBe(1);
    expect(request.memory.conversation.length).toBe(2);
    expect(request.memory.notes).toBe('لازم أراجع كلمات الجمارك.');
  });

  it('نوع الموقف بوسمه العربي لا بمعرّفه', async () => {
    await fresh();
    const scene = await fullScene();
    expect((await buildAnalysisRequest(scene.id)).memory.situation).toBe('اجتماع شغل');
  });

  it('«مَن يتكلّم» محفوظ، ومَن أنت معلوم', async () => {
    await fresh();
    const scene = await fullScene();

    const { conversation } = (await buildAnalysisRequest(scene.id)).memory;
    expect(conversation[0].speaker).toBe('إيجور');
    expect(conversation[0].isMe).toBe(false);
    expect(conversation[1].isMe).toBe(true);
  });

  it('⚠️ ما عندك بالفعل يُرسَل — فلا يقترح المحلِّل ما هو مكتوب', async () => {
    await fresh();
    const scene = await fullScene();

    const { alreadyHave } = (await buildAnalysisRequest(scene.id)).memory;
    expect(alreadyHave.expressions[0].text).toBe('по итогам');
    expect(alreadyHave.mistakes[0].natural).toBe('я жду');
  });

  it('⚠️ التعليمات داخل الملفّ لا في وثيقةٍ تُنسى', async () => {
    await fresh();
    const scene = await fullScene();
    const request = await buildAnalysisRequest(scene.id);

    expect(Array.isArray(request.instructions)).toBe(true);
    const text = request.instructions.join('\n');
    // الصيغة المطلوبة، ومنعُ الاختراع، والعامّية المصرية.
    expect(text.includes('JSON')).toBe(true);
    expect(text.includes('EGYPTIAN')).toBe(true);
    expect(text.includes('Do NOT invent')).toBe(true);
  });

  it('⚠️ ويُعلن الصيغة التي يجب أن يردّ بها', async () => {
    await fresh();
    const scene = await fullScene();
    const request = await buildAnalysisRequest(scene.id);

    expect(request.lingolifeAnalysisRequest).toBe(REQUEST_VERSION);
    // نفس مفتاح حزمة الاستيراد — لا صيغةَ ثانية.
    expect(request.replyFormat.lingolifeScene).toBe(1);
  });

  it('ذكرى غير موجودة ترمي برسالةٍ مفهومة', async () => {
    await fresh();
    let message = '';
    try {
      await buildAnalysisRequest('لا-يوجد');
    } catch (err) {
      message = err.message;
    }
    expect(message).toBe('الذكرى مش موجودة');
  });

  it('⚠️ يقرأ ولا يكتب — لا أثرَ له في القاعدة', async () => {
    await fresh();
    const scene = await fullScene();

    const before = JSON.stringify([
      (await scenes.getAll()).length,
      (await expressions.getAll()).length,
      (await mistakeComparisons.getAll()).length,
      (await conversationParts.getAll()).length,
    ]);

    await buildAnalysisRequest(scene.id);
    await buildAnalysisRequest(scene.id);

    const after = JSON.stringify([
      (await scenes.getAll()).length,
      (await expressions.getAll()).length,
      (await mistakeComparisons.getAll()).length,
      (await conversationParts.getAll()).length,
    ]);
    expect(after).toBe(before);
  });
});

/* ================================================================== */

describe('ما سيخرج — معلومٌ بعدده قبل خروجه', () => {
  it('الملخّص يعدّ كل ما في الملفّ', async () => {
    await fresh();
    const scene = await fullScene();
    const summary = requestSummary(await buildAnalysisRequest(scene.id));

    expect(summary.title).toBe('اجتماع الشحنة المتأخرة');
    expect(summary.scripts).toBe(1);
    expect(summary.conversation).toBe(2);
    expect(summary.expressions).toBe(1);
    expect(summary.mistakes).toBe(1);
    expect(summary.hasNotes).toBe(true);
  });

  it('⚠️ وأسماء مَن تكلّم — فتعرف أن اسمًا سيخرج', async () => {
    await fresh();
    const scene = await fullScene();
    const summary = requestSummary(await buildAnalysisRequest(scene.id));
    expect(summary.speakers.sort()).toEqual(['أنا', 'إيجور']);
  });

  it('ذكرى خالية: أصفارٌ صادقة لا سقوط', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'فاضية', date: '2026-04-01', type: 'meeting' });
    const summary = requestSummary(await buildAnalysisRequest(scene.id));
    expect(summary.scripts).toBe(0);
    expect(summary.conversation).toBe(0);
    expect(summary.speakers).toEqual([]);
    expect(summary.hasNotes).toBe(false);
  });

  it('اسم الملفّ بلا محارف تكسر نظام الملفّات', async () => {
    const name = requestFilename({ memory: { title: 'قعدة/الشلّة: "الكبيرة"' } });
    expect(/[\\/:*?"<>|]/.test(name)).toBe(false);
    expect(name.endsWith('.json')).toBe(true);
  });
});

/* ================================================================== */

describe('⚠️ الرحلة كاملةً — والردّ حزمةُ استيرادٍ عاديّة', () => {
  it('ردٌّ على الصيغة المعلَنة يمرّ بالمسار نفسه ويُكتب', async () => {
    await fresh();
    const scene = await fullScene();
    const request = await buildAnalysisRequest(scene.id);

    /*
     * ردٌّ كما يكتبه محلِّلٌ خارجيّ: يقرأ `replyFormat` من الطلب،
     * ويستعمل نفس أسماء الحقول المكتوبة في `instructions`.
     */
    const reply = {
      lingolifeScene: request.replyFormat.lingolifeScene,
      // كما تطلب التعليمات: يُعاد المعرّف كما هو.
      forSceneId: request.forSceneId,
      scene: { title: request.memory.title, date: request.memory.date },
      mistakes: [{
        wrong: 'на завод', natural: 'на заводе',
        kind: 'case', note: 'المكان اللي إنت فيه بياخد حرف الجرّ.',
      }],
      expressions: [{
        text: 'по накладной', meaningAr: 'حسب البوليصة',
        register: 'professional', example: 'Груз оформлен по накладной.',
      }],
    };

    const { ok, pkg } = parsePackage(reply);
    expect(ok).toBe(true);

    const plan = await planImport(pkg);
    // ⚠️ يُكتب **جوّه الذكرى نفسها** لا في ذكرى ثانية — بالهويّة لا بالاسم.
    expect(plan.scene.action).toBe(ACTION.ATTACH);
    expect(plan.scene.targetId).toBe(scene.id);

    const report = await applyImport(plan);
    expect((await scenes.getActive()).length).toBe(1);
    expect(report.written.mistake).toBe(1);
    expect(report.written.expression).toBe(1);

    const added = (await expressions.getAll()).find((e) => e.text === 'по накладной');
    expect(added.meaningAr).toBe('حسب البوليصة');
    expect((await mistakeComparisons.getAll())[1].sceneId).toBe(scene.id);
  });

  /*
   * ⚠️ القاعدة الأصليّة تبقى قاعدةً: مطابقةُ الاسم تخمين، فالافتراض
   *    إنشاءٌ ومعه البديل. المعرّف وحده هو الاستثناء، لأنه هويّة.
   */
  it('⚠️ ردٌّ أسقط المعرّف يعود للسلوك الأصلي — إنشاءٌ ومعه البديل', async () => {
    await fresh();
    const scene = await fullScene();
    const request = await buildAnalysisRequest(scene.id);

    const { pkg } = parsePackage({
      lingolifeScene: 1,
      // مفيش `forSceneId` — محلِّلٌ أهملها.
      scene: { title: request.memory.title, date: request.memory.date },
      expressions: [{ text: 'по накладной' }],
    });

    const plan = await planImport(pkg);
    expect(plan.scene.action).toBe(ACTION.CREATE);
    // والذكرى المتطابقة معروضةٌ كبديلٍ تختاره أنت.
    expect(plan.scene.alternatives.some((a) => a.id === scene.id)).toBe(true);
  });

  it('⚠️ ومعرّفٌ لذكرى محذوفة لا يُصدَّق — ولا يرمي', async () => {
    await fresh();
    const scene = await fullScene();
    const request = await buildAnalysisRequest(scene.id);
    await scenes.trash(scene.id);

    const { pkg } = parsePackage({
      lingolifeScene: 1,
      forSceneId: request.forSceneId,
      scene: { title: request.memory.title, date: request.memory.date },
      expressions: [{ text: 'по накладной' }],
    });

    const plan = await planImport(pkg);
    expect(plan.scene.action).toBe(ACTION.CREATE);
    expect(plan.scene.targetId).toBe(null);
  });

  it('⚠️ و`example` في الردّ يصير اقتباس الظهور — بند 38', async () => {
    await fresh();
    const scene = await fullScene();
    const request = await buildAnalysisRequest(scene.id);

    const { pkg } = parsePackage({
      lingolifeScene: request.replyFormat.lingolifeScene,
      forSceneId: request.forSceneId,
      scene: { title: request.memory.title, date: request.memory.date },
      expressions: [{ text: 'по накладной', example: 'Груз оформлен по накладной.' }],
    });
    await applyImport(await planImport(pkg));

    const added = (await expressions.getAll()).find((e) => e.text === 'по накладной');
    const [row] = await expressionOccurrences.byIndex('expressionId', added.id);
    expect(row.sourceQuote).toBe('Груз оформлен по накладной.');
    expect(row.sourceType).toBe('import');
  });

  it('ردٌّ يكرّر ما عندك يُستعمَل ولا يُنشَأ ثانيًا', async () => {
    await fresh();
    const scene = await fullScene();
    const request = await buildAnalysisRequest(scene.id);

    const { pkg } = parsePackage({
      lingolifeScene: 1,
      forSceneId: request.forSceneId,
      scene: { title: request.memory.title, date: request.memory.date },
      // التعبير نفسه الموجود عندك بالفعل.
      expressions: [{ text: 'по итогам', meaningAr: 'بناءً على النتائج' }],
    });
    await applyImport(await planImport(pkg));

    expect((await expressions.getAll()).length).toBe(1);
  });

  it('ردٌّ تالف يُرفَض قبل أن يمسّ شيئًا', async () => {
    await fresh();
    const scene = await fullScene();
    const before = (await expressions.getAll()).length;

    const { ok, issues } = parsePackage({ nonsense: true });
    expect(ok).toBe(false);
    expect(issues.some((i) => i.level === 'fatal')).toBe(true);
    expect((await expressions.getAll()).length).toBe(before);
  });
});

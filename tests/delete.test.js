/**
 * LingoLife — اختبارات مبدأ الحذف
 *
 * الحذف في هذا التطبيق نقلٌ إلى السلة لا محو، ولكل حذفٍ طريق رجوع.
 * هذه الاختبارات تحرس ما لا تراه العين في الواجهة: أن المحذوف يختفي
 * من العرض **ويبقى في القاعدة**، وأن الاستعادة تعيده كما كان.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes,
  scripts,
  conversationParts,
  mistakeComparisons,
  expressions,
  expressionOccurrences,
} from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import {
  addScript,
  addConversationPart,
  addMistake,
  addExpression,
  listConversationParts,
  listSceneExpressions,
  removeExpressionFromScene,
  undoRemoveExpression,
} from '../js/services/content-service.js';
import { getSceneFull } from '../js/services/scene-service.js';

async function scene(title = 'ذكرى للاختبار') {
  await openDB();
  return scenes.create({ titleAr: title, type: 'inspection', date: '2026-01-01' });
}

describe('الحذف — السكريبت', () => {
  it('النقل للسلة يخفيه من الذكرى ويُبقيه في القاعدة', async () => {
    const s = await scene();
    const script = await addScript(s.id, { title: 'الأساسي', text: 'Привет мир.' });

    await scripts.trash(script.id);

    expect((await getSceneFull(s.id)).scripts.length).toBe(0);
    // الشرط الذي يجعل التراجع ممكنًا: السجل لم يُمحَ.
    const raw = await scripts.get(script.id);
    expect(raw.state).toBe(STATE.TRASHED);
  });

  it('الاستعادة ترجعه بنصّه كما كان', async () => {
    const s = await scene();
    const script = await addScript(s.id, { title: 'الأساسي', text: 'Привет мир.' });

    await scripts.trash(script.id);
    await scripts.restore(script.id);

    const list = (await getSceneFull(s.id)).scripts;
    expect(list.length).toBe(1);
    expect(list[0].text).toBe('Привет мир.');
  });
});

describe('الحذف — أجزاء المحادثة والتصحيحات', () => {
  it('الجزء المحذوف يختفي من ترتيب المحادثة ويرجع بمكانه', async () => {
    const s = await scene();
    await addConversationPart(s.id, { speaker: 'Алексей', text: 'Первая.' });
    const second = await addConversationPart(s.id, { speaker: 'أنا', text: 'Вторая.' });
    await addConversationPart(s.id, { speaker: 'Алексей', text: 'Третья.' });

    await conversationParts.trash(second.id);
    expect((await listConversationParts(s.id)).map((p) => p.text)).toEqual(['Первая.', 'Третья.']);

    await conversationParts.restore(second.id);
    // يعود إلى موضعه الأصلي لا إلى آخر القائمة: الترتيب محفوظ في السجل.
    expect((await listConversationParts(s.id)).map((p) => p.text)).toEqual([
      'Первая.',
      'Вторая.',
      'Третья.',
    ]);
  });

  it('التصحيح المحذوف يختفي ويرجع', async () => {
    const s = await scene();
    const mistake = await addMistake(s.id, { wrong: 'Я идти.', natural: 'Я иду.' });

    await mistakeComparisons.trash(mistake.id);
    expect((await getSceneFull(s.id)).mistakes.length).toBe(0);

    await mistakeComparisons.restore(mistake.id);
    expect((await getSceneFull(s.id)).mistakes.length).toBe(1);
  });
});

describe('الحذف — التعبير يُشال من ذكرى لا من الحياة', () => {
  it('يشيله من هذه الذكرى ويُبقيه في ذكرى أخرى', async () => {
    const a = await scene('الأولى');
    const b = await scene('التانية');
    const text = `согласование-${Date.now()}`;
    await addExpression(a.id, { text, meaningAr: 'توافق' });
    await addExpression(b.id, { text, meaningAr: 'توافق' });

    const found = (await listSceneExpressions(a.id)).find((e) => e.text === text);
    await removeExpressionFromScene(a.id, found.id);

    expect((await listSceneExpressions(a.id)).some((e) => e.id === found.id)).toBe(false);
    // ⚠️ الجوهر: «شيله من هنا» ليس «امسحه من حياتي».
    expect((await listSceneExpressions(b.id)).some((e) => e.id === found.id)).toBe(true);
    expect((await expressions.get(found.id)).state).toBe(STATE.ACTIVE);
  });

  it('التعبير بلا ظهورٍ باقٍ يُنقل للسلة، والتراجع يرجّعه بظهوره', async () => {
    const s = await scene();
    const text = `однократное-${Date.now()}`;
    await addExpression(s.id, { text });
    const found = (await listSceneExpressions(s.id)).find((e) => e.text === text);

    const undoData = await removeExpressionFromScene(s.id, found.id);
    expect(undoData.trashedExpression).toBe(true);
    expect((await expressions.get(found.id)).state).toBe(STATE.TRASHED);

    await undoRemoveExpression(found.id, undoData);
    expect((await listSceneExpressions(s.id)).some((e) => e.id === found.id)).toBe(true);
    expect(
      (await expressionOccurrences.byIndex('expressionId', found.id)).every(
        (o) => o.state === STATE.ACTIVE
      )
    ).toBe(true);
  });
});

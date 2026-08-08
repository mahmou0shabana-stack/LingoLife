/**
 * LingoLife — اختبارات السلة
 *
 * القاعدة المحروسة هنا واحدة:
 *
 *   **لا شيء يختفي من الواجهة ويبقى عالقًا في القاعدة.**
 *
 * سبق أن انكسرت: أُضيف حذفٌ بالسلة لستّة أنواع بينما الشاشة تقرأ
 * المشاهد وحدها، فكان كل ما عداها يختفي بعد زوال إشعار «تراجع» ويبقى
 * محفوظًا بلا طريق إليه.
 *
 * فآخر اختبارٍ هنا (**الحارس**) لا يفحص نوعًا بعينه، بل يفحص القاعدة
 * نفسها: يضع محذوفًا في **كل** مستودع في التطبيق، ثم يطالب بأن يكون
 * كلٌّ منه إمّا ظاهرًا في السلة وإمّا مُقرًّا باستثنائه بسببٍ مكتوب.
 * مَن يضيف نوعًا جديدًا وينسى تسجيله يسقط اختبارُه لا مستخدمُه.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  ALL_REPOS,
  scenes,
  scripts,
  conversationParts,
  mistakeComparisons,
  expressions,
  expressionOccurrences,
  savedItems,
  media,
  sceneMediaLinks,
} from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import {
  TRASHABLE,
  NOT_TRASHABLE,
  listTrash,
  trashCount,
  restoreItem,
  restoreBlockedBy,
  destroyItem,
  linkedTo,
  findStrandedTrash,
} from '../js/services/trash-service.js';
import { trashScene } from '../js/services/scene-service.js';
import {
  addScript,
  addConversationPart,
  addMistake,
  addExpression,
  listSceneExpressions,
  removeExpressionFromScene,
  listConversationParts,
} from '../js/services/content-service.js';
import { getSceneFull } from '../js/services/scene-service.js';
import { saveItem, listSaved } from '../js/services/saved-service.js';
import { removeFromScene } from '../js/services/media-service.js';

/** يمسح كل ما في السلة قبل كل اختبار فلا تتداخل الحالات. */
async function emptyTrash() {
  await openDB();
  for (const repo of Object.values(ALL_REPOS)) {
    const all = await repo.getAll();
    for (const row of all) {
      if (row.state === STATE.TRASHED) await repo.destroy(row.id);
    }
  }
}

async function scene(title = 'ذكرى للسلة') {
  await openDB();
  return scenes.create({ titleAr: title, type: 'inspection', date: '2026-03-01' });
}

/** يجد صفًّا في السلة بمستودعه ومعرّفه. */
async function findInTrash(store, id) {
  for (const group of await listTrash()) {
    const hit = group.items.find((i) => i.store === store && i.id === id);
    if (hit) return hit;
  }
  return null;
}

/** WAV صامت صالح — لاختبار الصوت كما تراه الواجهة. */
function silentWav() {
  const rate = 8000;
  const samples = rate;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return new Blob([buffer], { type: 'audio/wav' });
}

/* ================================================================== *
 * كل نوع: يظهر، يُعرَف نوعه، ويرجع
 * ================================================================== */

describe('السلة — الذكرى', () => {
  it('تظهر بنوعها وترجع', async () => {
    await emptyTrash();
    const s = await scene('اجتماع المصنع');
    await trashScene(s.id);

    const row = await findInTrash('scenes', s.id);
    expect(row !== null).toBe(true);
    expect(row.title).toBe('اجتماع المصنع');

    await restoreItem(row);
    expect((await scenes.get(s.id)).state).toBe(STATE.ACTIVE);
    expect(await findInTrash('scenes', s.id)).toBe(null);
  });
});

describe('السلة — السكريبت', () => {
  it('يظهر بعنوانه ونصّه ويرجع بعد انتهاء مهلة التراجع', async () => {
    await emptyTrash();
    const s = await scene();
    const script = await addScript(s.id, { title: 'الأساسي', text: 'Сегодня мы проверяли линию.' });

    await scripts.trash(script.id);

    // ⚠️ جوهر العطل القديم: هنا كان يختفي ولا يظهر في السلة أبدًا.
    const row = await findInTrash('scripts', script.id);
    expect(row !== null).toBe(true);
    expect(row.title).toBe('الأساسي');
    expect(row.subtitle).toContain('Сегодня');

    await restoreItem(row);
    expect((await getSceneFull(s.id)).scripts.length).toBe(1);
  });
});

describe('السلة — جزء المحادثة', () => {
  it('يظهر بمتحدّثه ويرجع إلى موضعه', async () => {
    await emptyTrash();
    const s = await scene();
    await addConversationPart(s.id, { speaker: 'Алексей', text: 'Первая.' });
    const second = await addConversationPart(s.id, { speaker: 'Алексей', text: 'Вторая.' });
    await addConversationPart(s.id, { speaker: 'أنا', text: 'Третья.' });

    await conversationParts.trash(second.id);

    const row = await findInTrash('conversationParts', second.id);
    expect(row !== null).toBe(true);
    expect(row.subtitle).toBe('Алексей');

    await restoreItem(row);
    expect((await listConversationParts(s.id)).map((p) => p.text)).toEqual([
      'Первая.',
      'Вторая.',
      'Третья.',
    ]);
  });
});

describe('السلة — التصحيح', () => {
  it('يظهر بالصواب والخطأ ويرجع', async () => {
    await emptyTrash();
    const s = await scene();
    const mistake = await addMistake(s.id, { wrong: 'Я идти.', natural: 'Я иду.' });

    await mistakeComparisons.trash(mistake.id);

    const row = await findInTrash('mistakeComparisons', mistake.id);
    expect(row !== null).toBe(true);
    expect(row.title).toBe('Я иду.');
    expect(row.subtitle).toContain('Я идти.');

    await restoreItem(row);
    expect((await getSceneFull(s.id)).mistakes.length).toBe(1);
  });
});

describe('السلة — المحفوظات', () => {
  it('تظهر بنصّها وملاحظتها وترجع', async () => {
    await emptyTrash();
    const text = `сохранённое-${Date.now()}`;
    const saved = await saveItem({ text, tagIds: ['hard'], note: 'لساني بيتعثر' });

    await savedItems.trash(saved.id);
    // نتحرّى هذا العنصر لا العدد: اختباراتٌ أخرى تترك محفوظاتٍ حيّة.
    expect((await listSaved()).some((s) => s.id === saved.id)).toBe(false);

    const row = await findInTrash('savedItems', saved.id);
    expect(row !== null).toBe(true);
    expect(row.title).toBe(text);
    expect(row.subtitle).toBe('لساني بيتعثر');

    await restoreItem(row);
    expect((await listSaved()).some((s) => s.id === saved.id)).toBe(true);
  });
});

describe('السلة — التعبير وظهوره', () => {
  it('التعبير المُشال من ذكرى يظهر بنصّه لا بمعرّفه', async () => {
    await emptyTrash();
    const a = await scene('الأولى');
    const b = await scene('التانية');
    const text = `выражение-${Date.now()}`;
    await addExpression(a.id, { text, meaningAr: 'تعبير' });
    await addExpression(b.id, { text, meaningAr: 'تعبير' });

    const found = (await listSceneExpressions(a.id)).find((e) => e.text === text);
    await removeExpressionFromScene(a.id, found.id);

    // التعبير حيٌّ في «التانية»، فالمشال هو ظهوره في «الأولى».
    const occurrence = (await expressionOccurrences.byIndex('sceneId', a.id))[0];
    const row = await findInTrash('expressionOccurrences', occurrence.id);
    expect(row !== null).toBe(true);
    expect(row.title).toBe(text);

    await restoreItem(row);
    expect((await listSceneExpressions(a.id)).some((e) => e.id === found.id)).toBe(true);
  });

  it('⚠️ استعادة الظهور تُعيد معه تعبيره المؤرشف — وإلا بقي محجوبًا', async () => {
    await emptyTrash();
    const s = await scene();
    const text = `единственное-${Date.now()}`;
    await addExpression(s.id, { text });
    const found = (await listSceneExpressions(s.id)).find((e) => e.text === text);

    // ظهورٌ واحد فقط ⇒ التعبير نفسه يُنقل للسلة معه.
    await removeExpressionFromScene(s.id, found.id);
    expect((await expressions.get(found.id)).state).toBe(STATE.TRASHED);

    const occurrence = (await expressionOccurrences.byIndex('sceneId', s.id))[0];
    const row = await findInTrash('expressionOccurrences', occurrence.id);
    expect(row.alsoRestore.length).toBe(1);

    await restoreItem(row);
    // لو استُعيد الظهور وحده لظلّ التعبير مؤرشفًا فما ظهر شيء.
    expect((await expressions.get(found.id)).state).toBe(STATE.ACTIVE);
    expect((await listSceneExpressions(s.id)).some((e) => e.id === found.id)).toBe(true);
  });
});

describe('السلة — الصور والأصوات', () => {
  it('الصورة المشالة تظهر ككيان مفهوم وترجع، والملفّ لم يُمَسّ', async () => {
    await emptyTrash();
    const s = await scene();
    const file = await media.create({
      kind: 'image', filename: 'doc.png', mime: 'image/png',
      blob: new Blob(['x'], { type: 'image/png' }), bytes: 1, caption: 'وثيقة الفحص',
    });
    await sceneMediaLinks.create({ sceneId: s.id, mediaId: file.id, order: 0 });

    const linkId = await removeFromScene(s.id, file.id);

    const row = await findInTrash('sceneMediaLinks', linkId);
    expect(row !== null).toBe(true);
    expect(row.title).toBe('وثيقة الفحص');
    expect(row.subtitle).toBe('صورة');
    // الملفّ نفسه سليم — ما شِيل هو ربطه بالذكرى.
    expect((await media.get(file.id)).state).toBe(STATE.ACTIVE);

    await restoreItem(row);
    expect((await getSceneFull(s.id)).media.length).toBe(1);
  });

  it('التسجيل المشال يُعرَف كصوت لا كصورة', async () => {
    await emptyTrash();
    const s = await scene();
    const file = await media.create({
      kind: 'audio', filename: 'v.wav', mime: 'audio/wav',
      blob: silentWav(), bytes: 100, caption: 'تسجيل الاجتماع',
    });
    await sceneMediaLinks.create({ sceneId: s.id, mediaId: file.id, order: 0 });

    const linkId = await removeFromScene(s.id, file.id);
    const row = await findInTrash('sceneMediaLinks', linkId);

    expect(row.subtitle).toBe('تسجيل صوتي');
    expect(row.icon).toBe('mic');
  });
});

/* ================================================================== *
 * الاستعادة تُعيد العلاقة لا السجلّ وحده
 * ================================================================== */

describe('السلة — سلامة العلاقات عند الاستعادة', () => {
  it('تكشف أن الذكرى الحاوية في السلة قبل الاستعادة', async () => {
    await emptyTrash();
    const s = await scene('ذكرى محذوفة');
    const script = await addScript(s.id, { title: 'الأساسي', text: 'Текст.' });

    await scripts.trash(script.id);
    await trashScene(s.id);

    const row = await findInTrash('scripts', script.id);
    const blocker = await restoreBlockedBy(row);

    expect(blocker.blocked).toBe(true);
    expect(blocker.sceneTitle).toBe('ذكرى محذوفة');
  });

  it('استعادةٌ مع الذكرى تُظهر الاثنين فعلًا', async () => {
    await emptyTrash();
    const s = await scene();
    const script = await addScript(s.id, { title: 'الأساسي', text: 'Текст.' });
    await scripts.trash(script.id);
    await trashScene(s.id);

    const row = await findInTrash('scripts', script.id);
    await restoreItem(row, { withScene: true });

    expect((await scenes.get(s.id)).state).toBe(STATE.ACTIVE);
    expect((await getSceneFull(s.id)).scripts.length).toBe(1);
  });

  it('لا حجب حين تكون الذكرى سليمة', async () => {
    await emptyTrash();
    const s = await scene();
    const script = await addScript(s.id, { title: 'الأساسي', text: 'Текст.' });
    await scripts.trash(script.id);

    const row = await findInTrash('scripts', script.id);
    expect((await restoreBlockedBy(row)).blocked).toBe(false);
  });
});

/* ================================================================== *
 * الحذف النهائي
 * ================================================================== */

describe('السلة — الحذف النهائي', () => {
  it('يعرض ما سيُفقَد مع الذكرى قبل السؤال', async () => {
    await emptyTrash();
    const s = await scene();
    await addScript(s.id, { title: 'أ', text: 'Раз.' });
    await addScript(s.id, { title: 'ب', text: 'Два.' });
    await addConversationPart(s.id, { speaker: 'Алексей', text: 'Реплика.' });
    await trashScene(s.id);

    const row = await findInTrash('scenes', s.id);
    const links = await linkedTo(row);

    // بند 12: لا تدمير صامت — الأعداد تُعرض بالاسم.
    expect(links.find((l) => l.label === 'سكريبت').count).toBe(2);
    expect(links.find((l) => l.label === 'جزء محادثة').count).toBe(1);
  });

  it('المحو النهائي يشيله من القاعدة ومن السلة', async () => {
    await emptyTrash();
    const s = await scene();
    const script = await addScript(s.id, { title: 'الأساسي', text: 'Текст.' });
    await scripts.trash(script.id);

    const row = await findInTrash('scripts', script.id);
    await destroyItem(row);

    expect(await scripts.get(script.id)).toBe(undefined);
    expect(await findInTrash('scripts', script.id)).toBe(null);
  });
});

/* ================================================================== *
 * الحارس — يمنع رجوع العطل نفسه
 * ================================================================== */

describe('السلة — الحارس', () => {
  it('العدّ يساوي مجموع ما في المجموعات', async () => {
    await emptyTrash();
    const s = await scene();
    const script = await addScript(s.id, { title: 'أ', text: 'Раз.' });
    await scripts.trash(script.id);
    await trashScene(s.id);

    expect(await trashCount()).toBe(2);
  });

  it('كل مستودع في التطبيق إمّا في السلة وإمّا مُقَرٌّ باستثنائه', () => {
    const registered = new Set(TRASHABLE.map((k) => k.store));
    const excused = new Set(Object.keys(NOT_TRASHABLE));
    const unaccounted = Object.keys(ALL_REPOS).filter(
      (store) => !registered.has(store) && !excused.has(store)
    );
    // لا مستودع بلا قرار: إمّا يظهر في السلة وإمّا سببٌ مكتوب لغيابه.
    expect(unaccounted).toEqual([]);
  });

  it('⚠️ الحارس: محذوفٌ في أي مستودع إمّا يظهر في السلة وإمّا مُستثنى صراحةً', async () => {
    await emptyTrash();

    // نضع محذوفًا في **كل** مستودع — بما فيها ما لا يُحذف اليوم من
    // الواجهة، فلو فُتح له حذفٌ غدًا انكشف غيابه هنا لا عند المستخدم.
    const planted = [];
    for (const [store, repo] of Object.entries(ALL_REPOS)) {
      const record = await repo.create({});
      await repo.trash(record.id);
      planted.push({ store, id: record.id });
    }

    const groups = await listTrash();
    const surfaced = new Set();
    for (const group of groups) {
      for (const item of group.items) surfaced.add(`${item.store}:${item.id}`);
    }

    const missing = planted.filter(
      (p) => !surfaced.has(`${p.store}:${p.id}`) && !(p.store in NOT_TRASHABLE)
    );
    expect(missing.map((m) => m.store)).toEqual([]);

    // والوجه الآخر: ما لا تعرضه السلة يجب أن يكون مُقَرًّا باستثنائه.
    const stranded = await findStrandedTrash();
    expect(stranded.every((s) => s.store in NOT_TRASHABLE)).toBe(true);

    await emptyTrash();
  });
});

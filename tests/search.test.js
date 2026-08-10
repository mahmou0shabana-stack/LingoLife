/**
 * LingoLife — اختبارات البحث
 *
 * البحث يمرّ على المجالات الخمسة: الذكريات والسكريبتات والتعبيرات
 * وأجزاء المحادثة والمحفوظات. وما يحرسه هذا الملفّ ثلاثة أشياء:
 *
 *  · أن التطبيع يعمل فعلًا — «اجتماعه» تجد «اجتماعة»، و«еще» تجد «ещё».
 *  · أن المحذوف لا يظهر في النتائج.
 *  · أن الخروج المبكّر لا يكسر العدّ: نطلب `limit + 1` لنعرف أن هناك
 *    المزيد، ولا نعرض الزائد.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { scenes, scripts, expressions, savedItems } from '../js/db/repositories.js';
import {
  addScript,
  addConversationPart,
  addExpression,
} from '../js/services/content-service.js';
import { saveItem } from '../js/services/saved-service.js';
import { searchAll, SEARCH_GROUPS } from '../js/services/search-service.js';
import { searchScenes } from '../js/services/scene-service.js';

/** كلمة فريدة لكل اختبار — القاعدة مشتركة بين الملفّات. */
const tag = () => `zz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function scene(fields = {}) {
  await openDB();
  return scenes.create({ titleAr: 'ذكرى', type: 'inspection', date: '2026-08-01', ...fields });
}

/** يجد مجموعةً في النتيجة بمفتاحها. */
const group = (result, key) => result.groups.find((g) => g.key === key) || null;

describe('البحث — المجالات الخمسة', () => {
  it('يجد الذكرى بعنوانها وسياقها ومكانها', async () => {
    const word = tag();
    await scene({ titleAr: `اجتماع ${word}` });
    await scene({ titleAr: 'ذكرى تانية', context: `سياق فيه ${word}` });
    await scene({ titleAr: 'ذكرى تالتة', placeName: `مصنع ${word}` });

    const found = group(await searchAll(word), 'scenes');
    expect(found.items.length).toBe(3);
  });

  it('يجد السكريبت بنصّه لا بعنوانه وحده', async () => {
    const word = tag();
    const s = await scene();
    await addScript(s.id, { title: 'الأساسي', text: `Один пункт ${word} согласовывается.` });

    const found = group(await searchAll(word), 'scripts');
    expect(found.items.length).toBe(1);
    expect(found.items[0].title).toBe('الأساسي');
    // المقتطف يُظهر **لماذا** طابق.
    expect(found.items[0].excerpt).toContain(word);
  });

  it('يجد جزء المحادثة بنصّه وبمتحدّثه', async () => {
    const word = tag();
    const s = await scene();
    await addConversationPart(s.id, { speaker: `Алексей${word}`, text: 'Реплика.' });
    await addConversationPart(s.id, { speaker: 'Иван', text: `Текст ${word}.` });

    const found = group(await searchAll(word), 'conversationParts');
    expect(found.items.length).toBe(2);
  });

  it('يجد التعبير بنصّه وبمعناه العربي', async () => {
    const word = tag();
    const s = await scene();
    await addExpression(s.id, { text: `выражение-${word}`, meaningAr: 'تعبير' });

    const found = group(await searchAll(word), 'expressions');
    expect(found.items.length).toBe(1);
  });

  it('يجد المحفوظة بنصّها وملاحظتها', async () => {
    const word = tag();
    await saveItem({ text: `сохранённое ${word}`, note: 'صعبة' });

    const found = group(await searchAll(word), 'savedItems');
    expect(found.items.length).toBe(1);
    expect(found.items[0].subtitle).toBe('صعبة');
  });

  it('يبحث في المجالات كلها دفعةً واحدة', async () => {
    const word = tag();
    const s = await scene({ titleAr: `ذكرى ${word}` });
    await addScript(s.id, { title: 'أ', text: `текст ${word}` });
    await addExpression(s.id, { text: `выр ${word}` });
    await saveItem({ text: `сохр ${word}` });

    const keys = (await searchAll(word)).groups.map((g) => g.key).sort();
    expect(keys).toEqual(['expressions', 'savedItems', 'scenes', 'scripts']);
  });
});

describe('البحث — التطبيع', () => {
  it('العربية: التاء المربوطة والهاء سواء', async () => {
    const word = tag();
    await scene({ titleAr: `مطابقة ${word}` });
    // يكتبها المستخدم بالهاء — ويجب أن يجدها.
    const found = group(await searchAll(`مطابقه ${word}`), 'scenes');
    expect(found.items.length).toBe(1);
  });

  it('العربية: الألف بهمزتها وبدونها سواء', async () => {
    const word = tag();
    await scene({ titleAr: `إجتماع ${word}` });
    const found = group(await searchAll(`اجتماع ${word}`), 'scenes');
    expect(found.items.length).toBe(1);
  });

  it('الروسية: ё و е سواء', async () => {
    const word = tag();
    const s = await scene();
    await addScript(s.id, { title: 'أ', text: `Один пункт ещё ${word}.` });
    // يكتبها بلا نقطتين — كما يفعل الروس أنفسهم.
    const found = group(await searchAll(`еще ${word}`), 'scripts');
    expect(found.items.length).toBe(1);
  });

  it('كل الكلمات لازم تطابق لا واحدة منها', async () => {
    const word = tag();
    await scene({ titleAr: `فحص داخلي ${word}` });
    await scene({ titleAr: `فحص خارجي ${word}` });

    const both = group(await searchAll(`فحص داخلي ${word}`), 'scenes');
    expect(both.items.length).toBe(1);
  });
});

describe('البحث — ما لا يظهر', () => {
  it('المحذوف لا يظهر في النتائج', async () => {
    const word = tag();
    const s = await scene({ titleAr: `ذكرى ${word}` });
    const script = await addScript(s.id, { title: `سكريبت ${word}`, text: 'نص' });

    expect(group(await searchAll(word), 'scripts').items.length).toBe(1);

    await scripts.trash(script.id);
    expect(group(await searchAll(word), 'scripts')).toBe(null);

    await scenes.trash(s.id);
    expect(group(await searchAll(word), 'scenes')).toBe(null);
  });

  it('البحث الفارغ لا يعيد شيئًا — ولا يمسح القاعدة بحثًا عن لا شيء', async () => {
    expect((await searchAll('')).total).toBe(0);
    expect((await searchAll('   ')).groups.length).toBe(0);
  });
});

describe('البحث — الحدود والتصفية', () => {
  it('يقف عند الحدّ ويُعلم أن هناك المزيد', async () => {
    const word = tag();
    for (let i = 0; i < 5; i++) await scene({ titleAr: `ذكرى ${i} ${word}` });

    const found = group(await searchAll(word, { limit: 3 }), 'scenes');
    // ثلاثة تُعرض، والرابعة المطلوبة لم تُعرض وإنما دلّت على وجود المزيد.
    expect(found.items.length).toBe(3);
    expect(found.more).toBe(true);
  });

  it('لا يدّعي وجود مزيد حين لا يوجد', async () => {
    const word = tag();
    await scene({ titleAr: `وحيدة ${word}` });
    expect(group(await searchAll(word, { limit: 3 }), 'scenes').more).toBe(false);
  });

  it('التصفية تحصر البحث بمجموعة واحدة', async () => {
    const word = tag();
    const s = await scene({ titleAr: `ذكرى ${word}` });
    await addScript(s.id, { title: 'أ', text: `текст ${word}` });

    const only = await searchAll(word, { only: 'scripts' });
    expect(only.groups.length).toBe(1);
    expect(only.groups[0].key).toBe('scripts');
  });

  it('كل مجموعة معلَنة لأزرار التصفية', () => {
    expect(SEARCH_GROUPS.length).toBe(5);
    expect(SEARCH_GROUPS.every((g) => g.key && g.label && g.icon)).toBe(true);
  });
});

describe('البحث — searchScenes بلا مسحٍ كامل', () => {
  it('تعيد الأحدث أولًا وتقف عند الحدّ', async () => {
    const word = tag();
    await scene({ titleAr: `قديمة ${word}`, date: '2020-01-01' });
    await scene({ titleAr: `أحدث ${word}`, date: '2030-01-01' });

    const rows = await searchScenes(word, { limit: 1 });
    expect(rows.length).toBe(1);
    // المؤشّر يمرّ تنازليًّا بالتاريخ، فالأحدث هي التي تُلتقط أولًا.
    expect(rows[0].titleAr).toBe(`أحدث ${word}`);
  });
});

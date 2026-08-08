/**
 * LingoLife — اختبارات المحفوظات
 *
 * تحرس ثلاثة أشياء يسهل أن تنكسر بصمت: أن الحفظ لقطة نصّية لا إشارة
 * إلى مقطع قد يُحذف، وأن حفظ نفس النصّ مرّتين يضمّ الأسباب بدل أن
 * يضاعف السجل، وأن الحفظ **لا يُدّعى إتقانًا**.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import { savedItems, settings, shadowSegments } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import {
  SAVED_KIND,
  BUILT_IN_TAGS,
  listSavedTags,
  addSavedTag,
  saveItem,
  listSaved,
  isSaved,
  toggleItemTag,
  savedCounts,
} from '../js/services/saved-service.js';

/** يمسح المحفوظات والتصنيفات المضافة قبل كل اختبار. */
async function fresh() {
  await openDB();
  for (const row of await savedItems.getAll()) await savedItems.destroy(row.id);
  await settings.remove('saved.tags');
}

/** نصّ فريد لكل اختبار — الضمّ يعتمد على تطابق النصّ. */
const unique = (base) => `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

describe('المحفوظات — الحفظ', () => {
  it('تحفظ جملة بتصنيفاتها', async () => {
    await fresh();
    const text = unique('согласование');
    await saveItem({ text, tagIds: ['hard', 'pron'], note: 'اللسان بيتعثر' });

    const rows = await listSaved();
    expect(rows.length).toBe(1);
    expect(rows[0].tagIds).toEqual(['hard', 'pron']);
    expect(rows[0].note).toBe('اللسان بيتعثر');
    expect(rows[0].kind).toBe(SAVED_KIND.SENTENCE);
  });

  it('ترفض النصّ الفارغ', async () => {
    await fresh();
    let error = null;
    try {
      await saveItem({ text: '   ' });
    } catch (err) {
      error = err;
    }
    expect(error !== null).toBe(true);
  });

  it('⚠️ الحفظ انتباه لا إتقان', async () => {
    await fresh();
    const row = await saveItem({ text: unique('внимание'), tagIds: ['hard'] });
    // بند 19: علامةٌ منك على نصّ، لا دليلٌ على أنك تعلّمته.
    expect(row.impliesMastery).toBe(false);
    expect(row.impliesRealUsage).toBe(false);
  });

  it('⚠️ لقطة نصّية: حذف المقطع لا يفقدك ما حفظته', async () => {
    await fresh();
    const segment = await shadowSegments.create({
      sessionId: 'SHS_TEST',
      order: 0,
      sourceTextSnapshot: 'Один пункт ещё согласовывается.',
    });
    const text = unique('снимок');
    await saveItem({ text, segmentId: segment.id });

    await shadowSegments.destroy(segment.id);

    const rows = await listSaved();
    expect(rows.length).toBe(1);
    // النصّ نفسه محفوظ، لا معرّفٌ يشير إلى العدم.
    expect(rows[0].text).toBe(text);
  });
});

describe('المحفوظات — الضمّ لا التضاعف', () => {
  it('حفظ نفس النصّ مرّتين يضمّ التصنيفات في سجل واحد', async () => {
    await fresh();
    const text = unique('повторная');
    await saveItem({ text, tagIds: ['hard'] });
    await saveItem({ text, tagIds: ['again'] });

    const rows = await listSaved();
    expect(rows.length).toBe(1);
    expect(rows[0].tagIds.sort()).toEqual(['again', 'hard']);
  });

  it('نفس النصّ ككلمة وكجملة سجلّان — وهما شيئان مختلفان', async () => {
    await fresh();
    const text = unique('линия');
    await saveItem({ text, kind: SAVED_KIND.SENTENCE });
    await saveItem({ text, kind: SAVED_KIND.WORD });

    expect((await listSaved()).length).toBe(2);
    expect((await listSaved({ kind: SAVED_KIND.WORD })).length).toBe(1);
  });

  it('isSaved تجد المحفوظ ولا تجد غيره', async () => {
    await fresh();
    const text = unique('найдено');
    await saveItem({ text });
    expect((await isSaved(text)) !== null).toBe(true);
    expect(await isSaved(unique('нетто'))).toBe(null);
  });
});

describe('المحفوظات — التصنيفات', () => {
  it('تبدأ بالتصنيفات المدمجة', async () => {
    await fresh();
    expect((await listSavedTags()).length).toBe(BUILT_IN_TAGS.length);
  });

  it('تضيف تصنيفًا جديدًا ولا تكرّره', async () => {
    await fresh();
    const first = await addSavedTag('بتلخبطني');
    const again = await addSavedTag('بتلخبطنى');
    // المقارنة على النصّ المُطبَّع: ياء وألف مقصورة نفس السبب.
    expect(again.id).toBe(first.id);
    expect((await listSavedTags()).length).toBe(BUILT_IN_TAGS.length + 1);
  });

  it('تشيل تصنيفًا من محفوظ وتعيده', async () => {
    await fresh();
    const row = await saveItem({ text: unique('переключение'), tagIds: ['hard'] });
    await toggleItemTag(row.id, 'hard');
    expect((await savedItems.get(row.id)).tagIds).toEqual([]);
    await toggleItemTag(row.id, 'hard');
    expect((await savedItems.get(row.id)).tagIds).toEqual(['hard']);
  });

  it('العدّ لكل تصنيف', async () => {
    await fresh();
    await saveItem({ text: unique('a'), tagIds: ['hard', 'again'] });
    await saveItem({ text: unique('b'), tagIds: ['hard'] });
    const counts = await savedCounts();
    expect(counts.get('hard')).toBe(2);
    expect(counts.get('again')).toBe(1);
  });
});

describe('المحفوظات — الحذف بتراجع', () => {
  it('النقل للسلة يخفيه ويُبقيه، والاستعادة ترجّعه', async () => {
    await fresh();
    const row = await saveItem({ text: unique('удаление'), tagIds: ['hard'] });

    await savedItems.trash(row.id);
    expect((await listSaved()).length).toBe(0);
    expect((await savedItems.get(row.id)).state).toBe(STATE.TRASHED);

    await savedItems.restore(row.id);
    expect((await listSaved()).length).toBe(1);
  });
});

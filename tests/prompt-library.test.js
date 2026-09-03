/**
 * LingoLife — مكتبةُ البرومبتات: الخدمةُ والشاشة (WS-PL · بنود ٦ إلى ١٧ و٣٧ إلى ٥٦ و٦٧)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي كان موجودًا قبل هذه التمريرة — بالتدقيق لا بالانطباع
 * ═══════════════════════════════════════════════════════════════
 *
 * «مكتبةُ الطلبات» لم تكن مكتبةَ برومبتات. كانت `PROMPTS` مصفوفةً
 * `Object.freeze` فيها **ثلاثةُ طلباتِ تحليلٍ مبنيّة** تبني حزمَ JSON
 * لمسار الاستيراد. والشيءُ الوحيدُ الذي كنتَ تملك كتابتَه هو حقلٌ نصّيٌّ
 * واحدٌ في `settings['prompts.extra']`. فلا إنشاءَ ولا تعديلَ ولا حذف.
 *
 * وفي المقابل كان `promptVersions` **مخزنًا نائمًا**: موجودًا في
 * `schema.js` بفهرسَي `category` و`createdAt`، وله مستودعٌ في
 * `repositories.js`، وله سياسةُ مزامنةٍ `CANONICAL` — **ولا كاتبَ له
 * إطلاقًا**. ولذلك لم تحتج هذه التمريرةُ ترقيةَ مخطَّطٍ (بند ٤٤).
 *
 * ⚠️ **وأخطرُ ما تحرسه هذه الملفّات ثلاثةٌ:**
 *
 *   · **المعرّفُ لا يتبدّل لسببٍ عرضيّ** (بند ٤٨): إعادةُ التسمية تعديلُ
 *     حقلٍ. ولو أنشأت صفًّا جديدًا لرأى الجهازُ الآخرُ برومبتًا زائدًا
 *     بجوار القديم بدل اسمٍ تغيّر.
 *   · **لا رقمَ إلّا عن فعلٍ وقع** (بند ٥٠ · قاعدة ٩): `copies` يزيد بعد
 *     نجاح النسخ، ولا يلمس `updatedAt` — وإلّا صار «آخر تعديل» كاذبًا.
 *   · **لا يُحذَف برومبتٌ صامتًا** (بندا ١٠ و٦٧): إفراغُ تصنيفٍ **نقلٌ**،
 *     والحذفُ إلى السلّة لا إلى العدم.
 *
 * ⚠️ **وطلباتُ التحليل الثلاثةُ لا تُمَسّ** (بند ٠): آخِرُ describe يقيس
 *    أنّها ما زالت ثلاثةً بمعرّفاتها، وأنّ مسارَها القديم قائم.
 */

import { describe, it, expect } from './test-runner.js';
import {
  NO_CATEGORY, listPrompts, getPrompt, categoriesOf, tagsOf,
  buildSearchIndex, filterPrompts, sortPrompts, SORTS,
  createPrompt, updatePrompt, toggleFavorite, duplicatePrompt, trashPrompt,
  markCopied, markOpened, recentPrompts, renameCategory, clearCategory,
} from '../js/services/prompts/user-prompts.js';
import { renderPrompts, handlePromptsAction, resetPrompts } from '../js/views/prompts-view.js';
import { PROMPTS } from '../js/services/prompts/library.js';
import { promptVersions } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { TRASHABLE } from '../js/services/trash-service.js';

const TAG = `PL-${Math.random().toString(36).slice(2, 7)}`;
const wait = (ms = 90) => new Promise((done) => { setTimeout(done, ms); });
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const BODY = [
  '§1 الهدف:', '',
  'حوّل الجملة الروسية لـ Core Chunks.', '',
  '§2 المدخلات:', '',
  '[ضع الجملة الروسية هنا]', '',
  'كلمة مميّزة: сотру́дник',
].join('\n');

/** ينشئ برومبتًا موسومًا بهذه الجولة كي لا تختلط الجولات. */
const seed = (extra = {}) => createPrompt({
  title: `${TAG} برومبت`, body: BODY, category: `${TAG}-شادوينج`, tags: [TAG], ...extra,
});

/** برومبتاتُ هذه الجولة وحدَها. */
const mine = async () => (await listPrompts()).filter((row) => (row.tags || []).includes(TAG));

/* ================================================================== */
describe('WS-PL · المخزنُ النائمُ صار مكتبةً (بندا ٦ و٤٤)', () => {
  it('١ · الإنشاءُ يكتب في promptVersions نفسِه — بلا مخزنٍ موازٍ', async () => {
    /* ⚠️ «Do not create a parallel prompt system» — الحارسُ هنا. */
    const made = await seed({ title: `${TAG} الأول` });
    const row = await promptVersions.get(made.id);
    expect(row.title).toBe(`${TAG} الأول`);
    expect(row.state).toBe(STATE.ACTIVE);
  });

  it('٢ · المتنُ يُحفَظ كما هو — بلا trim ولا تطبيع', async () => {
    const raw = '   سطر بمسافات بادئة\n\n\n\nنهاية   ';
    const made = await createPrompt({ title: `${TAG} خام`, body: raw, tags: [TAG] });
    expect((await getPrompt(made.id)).body).toBe(raw);
  });

  it('٣ · برومبتٌ بلا اسمٍ يُرفَض قبل أن يُكتَب صفّ', async () => {
    await expect(createPrompt({ title: '  ', body: BODY })).toReject();
  });

  it('٤ · وبرومبتٌ بلا متنٍ يُرفَض كذلك', async () => {
    await expect(createPrompt({ title: `${TAG} شبح`, body: '   ' })).toReject();
  });

  it('٥ · بلا تصنيفٍ يقع في «بدون تصنيف» لا في فراغ', async () => {
    const made = await createPrompt({ title: `${TAG} بلا`, body: BODY, tags: [TAG] });
    expect((await getPrompt(made.id)).category).toBe(NO_CATEGORY);
  });
});

/* ================================================================== */
describe('WS-PL · المعرّفُ هُويّةٌ لا زينة (بندا ١٧ و٤٨)', () => {
  it('٦ · إعادةُ التسمية تعديلُ حقلٍ بنفس المعرّف', async () => {
    const made = await seed({ title: `${TAG} قديم` });
    await updatePrompt(made.id, { title: `${TAG} جديد` });
    const row = await getPrompt(made.id);
    expect(row.id).toBe(made.id);
    expect(row.title).toBe(`${TAG} جديد`);
  });

  it('٧ · ولا يُنشأ صفٌّ ثانٍ عند إعادة التسمية', async () => {
    const before = (await mine()).length;
    const made = await seed();
    await updatePrompt(made.id, { title: `${TAG} مُعاد` });
    expect((await mine()).length).toBe(before + 1);
  });

  it('٨ · التعديلُ يحرّك updatedAt', async () => {
    const made = await seed();
    await wait(20);
    await updatePrompt(made.id, { purpose: 'غرضٌ جديد' });
    expect((await getPrompt(made.id)).updatedAt > made.updatedAt).toBeTruthy();
  });

  it('٩ · واسمٌ فارغٌ يُرفَض فلا يضيع البرومبت في القائمة', async () => {
    const made = await seed();
    await expect(updatePrompt(made.id, { title: '   ' })).toReject();
  });

  it('١٠ · والمتنُ لا يصير فارغًا بحفظةٍ خاطئة', async () => {
    const made = await seed();
    await expect(updatePrompt(made.id, { body: '  ' })).toReject();
    expect((await getPrompt(made.id)).body).toBe(BODY);
  });

  it('١١ · التكرارُ نسخةٌ مستقلّةٌ بمعرّفٍ آخر', async () => {
    const made = await seed({ title: `${TAG} أصل` });
    const copy = await duplicatePrompt(made.id);
    expect(copy.id === made.id).toBeFalsy();
    expect(copy.body).toBe(BODY);
  });

  it('١٢ · والنسخةُ لا ترث تاريخَ استعمالِ الأصل', async () => {
    /* ⚠️ «نُسخ ١٢ مرّة» حقيقةٌ عن الأصل — ونقلُها للنسخة يجعلها زخرفة. */
    const made = await seed();
    await markCopied(made.id);
    await markCopied(made.id);
    const copy = await duplicatePrompt(made.id);
    expect(copy.copies).toBe(0);
    expect(copy.lastCopiedAt).toBe(null);
  });
});

/* ================================================================== */
describe('WS-PL · لا رقمَ إلّا عن فعلٍ وقع (بندا ١٤ و٥٠ · قاعدة ٩)', () => {
  it('١٣ · النسخُ الناجحُ يزيد العدّاد واحدًا', async () => {
    const made = await seed();
    await markCopied(made.id);
    expect((await getPrompt(made.id)).copies).toBe(1);
  });

  it('١٤ · والنسخُ لا يلمس updatedAt فلا يكذب «آخر تعديل»', async () => {
    const made = await seed();
    await wait(20);
    await markCopied(made.id);
    expect((await getPrompt(made.id)).updatedAt).toBe(made.updatedAt);
  });

  it('١٥ · الفتحُ يسجَّل مستقلًّا عن النسخ', async () => {
    const made = await seed();
    await markOpened(made.id);
    const row = await getPrompt(made.id);
    expect(row.opens).toBe(1);
    expect(row.copies).toBe(0);
  });

  it('١٦ · «الأخيرة» تُبنى على فتحٍ حقيقيٍّ لا على تعديل', async () => {
    const touched = await seed({ title: `${TAG} مفتوح` });
    const untouched = await seed({ title: `${TAG} ما اتفتحش` });
    await markOpened(touched.id);
    const ids = recentPrompts(await mine()).map((one) => one.id);
    expect(ids).toContain(touched.id);
    expect(ids.includes(untouched.id)).toBeFalsy();
  });

  it('١٧ · والأحدثُ فتحًا في الرأس', async () => {
    const older = await seed({ title: `${TAG} أقدم` });
    const newer = await seed({ title: `${TAG} أحدث` });
    await markOpened(older.id);
    await wait(20);
    await markOpened(newer.id);
    expect(recentPrompts(await mine())[0].id).toBe(newer.id);
  });

  it('١٨ · «الأكثر نسخًا» ترتيبٌ فوق عددٍ حقيقيّ', async () => {
    const many = await seed({ title: `${TAG} كتير` });
    const few = await seed({ title: `${TAG} قليل` });
    await markCopied(many.id);
    await markCopied(many.id);
    await markCopied(few.id);
    const sorted = sortPrompts(await mine(), SORTS.COPIED);
    expect(sorted[0].id).toBe(many.id);
  });
});

/* ================================================================== */
describe('WS-PL · البحثُ والتصفية (بنود ٣٧ إلى ٣٩ و٥٦)', () => {
  it('١٩ · الفهرسُ يُبنى مرّةً ويغطّي كلَّ صفّ', async () => {
    const rows = await mine();
    expect(buildSearchIndex(rows).size).toBe(rows.length);
  });

  it('٢٠ · البحثُ يصيب المتنَ لا الاسمَ وحدَه', async () => {
    const rows = await mine();
    const hits = filterPrompts(rows, { query: 'сотру́дник', index: buildSearchIndex(rows) });
    expect(hits.length > 0).toBeTruthy();
  });

  it('٢١ · ويصيب الغرضَ والوسم', async () => {
    const made = await seed({ purpose: 'قزحيّةٌ نادرةُ اللفظ' });
    const rows = await mine();
    const hits = filterPrompts(rows, { query: 'قزحيّة', index: buildSearchIndex(rows) });
    expect(hits.map((one) => one.id)).toContain(made.id);
  });

  it('٢٢ · البحثُ بلا نصٍّ لا يصفّي شيئًا', async () => {
    const rows = await mine();
    expect(filterPrompts(rows, { query: '   ' })).toHaveLength(rows.length);
  });

  it('٢٣ · التصنيفُ والوسمُ والمفضّلةُ تجتمع', async () => {
    const made = await seed({ title: `${TAG} مجمع`, favorite: true });
    const rows = await mine();
    const hits = filterPrompts(rows, {
      category: `${TAG}-شادوينج`, tag: TAG, favorite: true, index: buildSearchIndex(rows),
    });
    expect(hits.map((one) => one.id)).toContain(made.id);
    expect(hits.every((one) => one.favorite)).toBeTruthy();
  });

  it('٢٤ · التصنيفاتُ مشتقّةٌ من البيانات لا مكتوبةٌ في الكود', async () => {
    await seed({ category: `${TAG}-جديدٌ تمامًا` });
    expect(categoriesOf(await mine()).map((one) => one.name))
      .toContain(`${TAG}-جديدٌ تمامًا`);
  });

  it('٢٥ · والوسومُ كذلك — وبعددٍ حقيقيّ', async () => {
    const rows = await mine();
    const found = tagsOf(rows).find((one) => one.name === TAG);
    expect(found.count).toBe(rows.length);
  });

  it('٢٦ · ترتيبُ «الأقدم» يعتمد createdAt', async () => {
    const rows = sortPrompts(await mine(), SORTS.CREATED);
    expect(rows[0].createdAt <= rows[rows.length - 1].createdAt).toBeTruthy();
  });

  it('٢٧ · والترتيبُ لا يغيّر المصفوفةَ الأصليّة', async () => {
    const rows = await mine();
    const first = rows[0].id;
    sortPrompts(rows, SORTS.TITLE);
    expect(rows[0].id).toBe(first);
  });
});

/* ================================================================== */
describe('WS-PL · لا يُحذَف برومبتٌ صامتًا (بندا ١٠ و٦٧)', () => {
  it('٢٨ · المفضّلةُ تنقلب وتعود', async () => {
    const made = await seed();
    expect(await toggleFavorite(made.id)).toBe(true);
    expect(await toggleFavorite(made.id)).toBe(false);
  });

  it('٢٩ · إعادةُ تسمية التصنيف تنقل كلَّ برومبتاته', async () => {
    const a = await seed({ category: `${TAG}-قديم` });
    const b = await seed({ category: `${TAG}-قديم` });
    expect(await renameCategory(`${TAG}-قديم`, `${TAG}-جديد`)).toBe(2);
    expect((await getPrompt(a.id)).category).toBe(`${TAG}-جديد`);
    expect((await getPrompt(b.id)).category).toBe(`${TAG}-جديد`);
  });

  it('٣٠ · وإفراغُ التصنيف نقلٌ — لا يفقد برومبتًا واحدًا', async () => {
    /*
     * ⚠️ أخطرُ زرٍّ في إدارة التصنيفات: «احذف التصنيف» تبدو ترتيبًا
     *    وقد تمحو عشرين برومبتًا. فالحارسُ يعدّ الصفوفَ قبلَه وبعدَه.
     */
    await seed({ category: `${TAG}-مؤقّت` });
    await seed({ category: `${TAG}-مؤقّت` });
    const before = (await mine()).length;
    await clearCategory(`${TAG}-مؤقّت`);
    const after = await mine();
    expect(after.length).toBe(before);
    expect(after.filter((one) => one.category === NO_CATEGORY).length >= 2).toBeTruthy();
  });

  it('٣١ · والحذفُ إلى السلّة لا إلى العدم', async () => {
    const made = await seed({ title: `${TAG} للسلة` });
    await trashPrompt(made.id);
    expect((await promptVersions.get(made.id)).state).toBe(STATE.TRASHED);
  });

  it('٣٢ · والمحذوفُ يغادر قائمةَ المكتبة', async () => {
    const made = await seed({ title: `${TAG} مختفٍ` });
    await trashPrompt(made.id);
    expect((await mine()).map((one) => one.id).includes(made.id)).toBeFalsy();
  });

  it('٣٣ · والسلّةُ تعرف البرومبتات فعلًا', () => {
    /* ⚠️ كانت `promptVersions` مُدرَجةً «إعدادات لا محتوى» — فما كانت تُعرَض. */
    expect(TRASHABLE.some((one) => one.store === 'promptVersions')).toBeTruthy();
  });
});

/* ================================================================== */
describe('WS-PL · الشاشةُ: العارضُ هو البطل (بنود ٣ و٤ و٤١ و٥٩)', () => {
  const host = document.createElement('div');

  it('٣٤ · الشاشةُ ثلاثةُ ألواحٍ لا أعمدةٌ ضيّقةٌ كثيرة', async () => {
    /* ⚠️ «Do not recreate the old Workspace too-many-narrow-columns problem». */
    document.body.append(host);
    resetPrompts();
    await renderPrompts(host);
    expect($$('.pl > section, .pl > aside', host)).toHaveLength(3);
  });

  it('٣٥ · وفيها لوحٌ جانبيٌّ وقائمةٌ وعارض', () => {
    expect($$('.pl-side', host)).toHaveLength(1);
    expect($$('.pl-list', host)).toHaveLength(1);
    expect($$('.pl-viewer', host)).toHaveLength(1);
  });

  it('٣٦ · العددُ المعروضُ حقيقيٌّ لا زخرفة', async () => {
    const shown = host.querySelector('.pl-count').textContent.trim();
    const rows = $$('.pl-row', host).length;
    expect(shown.startsWith(String(rows))).toBeTruthy();
  });

  it('٣٧ · فتحُ برومبتٍ يعرض متنَه كما هو', async () => {
    const made = await seed({ title: `${TAG} للعرض` });
    await renderPrompts(host);
    await handlePromptsAction('pl-open', made.id);
    await wait();
    const doc = host.querySelector('[data-pl-doc]');
    expect(doc.textContent).toContain('сотру́дник');
  });

  it('٣٨ · والمتنُ في `pre` كي تنجو المسافاتُ والأسطر', () => {
    expect($$('[data-pl-doc] pre.pl-block', host).length > 0).toBeTruthy();
  });

  it('٣٩ · والكتلُ مجموعةً تعيد النصَّ الأصليَّ حرفًا بحرف', async () => {
    const text = $$('[data-pl-doc] pre.pl-block', host)
      .map((one) => one.textContent).join('\n\n');
    expect(text).toBe(BODY);
  });

  it('٤٠ · والمتغيّرُ يظهر حقلًا يُملأ', () => {
    expect($$('[data-pl-var]', host).length).toBe(1);
  });

  it('٤١ · التصفيةُ الفعّالةُ معلَنةٌ على الشاشة — «ليه بشوف دول؟»', async () => {
    await handlePromptsAction('pl-cat', `${TAG}-شادوينج`);
    await wait();
    expect($$('.pl-active .pl-chip', host).length > 0).toBeTruthy();
    await handlePromptsAction('pl-clear');
    await wait();
  });

  it('٤٢ · وفي العرض الضيّق يبقى طريقٌ ظاهرٌ للقائمة', () => {
    /* ⚠️ حين يأخذ العارضُ الشاشةَ كلَّها لا يبقى للقائمة أثرٌ مستنتَج. */
    expect($$('.pl-back', host).length).toBe(1);
  });

  it('٤٣ · وزرُّ الرجوع يفتح القائمةَ فعلًا', async () => {
    await handlePromptsAction('pl-open', (await mine())[0].id);
    await wait();
    expect(host.querySelector('.pl').dataset.plList).toBe('shut');
    await handlePromptsAction('pl-back');
    await wait();
    expect(host.querySelector('.pl').dataset.plList).toBe('open');
  });
});

/* ================================================================== */
describe('WS-PL · طلباتُ التحليل الثلاثةُ لم تُمَسّ (بند ٠)', () => {
  it('٤٤ · ما زالت ثلاثةً بمعرّفاتها', () => {
    /*
     * ⚠️ هذه ليست برومبتاتِ مستعمِلٍ — هي طلباتُ تحليلٍ مبنيّةٌ تبني حزمَ
     *    JSON لمسار الاستيراد. وإدخالُها في مكتبة البرومبتات يخلط
     *    طبقتين: ما كتبتَه أنت، وما يبنيه التطبيق.
     */
    expect(PROMPTS).toHaveLength(3);
    expect(Object.isFrozen(PROMPTS)).toBeTruthy();
  });

  it('٤٥ · ولها وجهٌ مستقلٌّ في الشاشة لا يختلط بالمكتبة', async () => {
    /*
     * ⚠️ **لوحٌ واحدٌ في الصفحة لا اثنان.** `paint` تستعلم عن
     *    `[data-pl-list-pane]` من `document` — فلو بقي مضيفُ الوصف
     *    السابق معلّقًا رسمت فيه، وقاس هذا الاختبارُ شاشةً غيرَ التي فتح.
     */
    document.querySelectorAll('[data-pl]').forEach((one) => one.parentElement?.remove());
    const host = document.createElement('div');
    document.body.append(host);
    resetPrompts();
    await renderPrompts(host);
    await handlePromptsAction('pl-view', 'builtin');
    await wait();
    expect($$('.pl-row', host)).toHaveLength(3);
    host.remove();
  });

  it('٤٦ · وبرومبتاتُ المستعمِل لا تدخل مصفوفةَ الطلبات المبنيّة', async () => {
    await seed({ title: `${TAG} دخيل` });
    expect(PROMPTS).toHaveLength(3);
  });
});

/* ================================================================== */
describe('WS-PL · تنظيفُ ما زرعته هذه الجولة', () => {
  it('٤٧ · تُحذف صفوفُ الجولة نهائيًّا', async () => {
    const rows = await mine();
    await promptVersions.destroyMany(rows.map((one) => one.id));
    expect(await mine()).toHaveLength(0);
    document.querySelectorAll('.pl').forEach((one) => one.closest('div')?.remove());
  });
});

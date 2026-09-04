/**
 * LingoLife — الفهرسُ الموحَّد للبرومبتات (WS-PL3 · بنود ٦٧ و٧٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي تحرسه هذه الاختبارات
 * ═══════════════════════════════════════════════════════════════
 *
 * العطبُ الأصليُّ لم يكن رقمًا خاطئًا بل **كلمةً كاذبة**: «كل البرومبتات»
 * تعدُّ صفوفَ `promptVersions` وحدَها، فتقول صفرًا وفي التطبيق ثلاثةُ
 * طلباتٍ وبرومبتا جملة. فأوّلُ ما يُحرَس هنا: أن يكون «الكلُّ» كلًّا.
 *
 * وثلاثةُ أشياءَ تنكسر بصمتٍ لو ساءت الطبقة:
 *
 *   ١) **حقيقتان لبرومبتٍ واحد**: لو نُسخ المبنيُّ إلى `promptVersions`
 *      صار في القاعدة نصٌّ يتجمّد بينما يتطوّر أصلُه في الكود. فالحارسُ
 *      يقيس أنّ الفهرسَ **يقرأ ولا يكتب**.
 *
 *   ٢) **الهُويّةُ بالعنوان**: «Core Chunks» مبنيًّا وشخصيًّا في وقتٍ
 *      واحد. ودمجُهما بالعنوان يُخفي أحدَهما بلا رسالةِ خطأ.
 *
 *   ٣) **مفضّلةٌ تكتب في كودٍ مُجمَّد**: تُرمى أو — أسوأ — تُكتَب في
 *      نسخةٍ ثانيةٍ من البرومبت.
 */

import { describe, it, expect } from './test-runner.js';
import {
  buildCatalog, filterCatalog, countsOf, catalogCategories, catalogKey,
  toggleCatalogFavorite, markCatalogOpened, markCatalogCopied,
  copyToPersonal, catalogMeta, SOURCE, SOURCE_LABEL, VIEW, SENTENCE_SLOT,
} from '../js/services/prompts/catalog.js';
import { PROMPTS, LEARN_PROMPTS, promptById } from '../js/services/prompts/library.js';
import { createPrompt, updatePrompt, trashPrompt, listPrompts } from '../js/services/prompts/user-prompts.js';
import { findPlaceholders } from '../js/services/prompts/prompt-text.js';

const TAG = `CAT-${Math.random().toString(36).slice(2, 7)}`;

const seed = (title, body, extra = {}) => createPrompt({
  title, body, tags: [TAG], ...extra,
});

/** عناصرُ هذا الملفِّ وحدَه — لا القاعدةَ كلَّها. */
const mineOnly = (items) => items.filter((one) => (one.tags || []).includes(TAG));

const catalog = async () => (await buildCatalog()).items;

const findBy = (items, kind, id) =>
  items.find((one) => one.catalogId === catalogKey(kind, id)) || null;

/** يقشّر التعليقات — فيقيس الحارسُ الكودَ لا شرحَه. */
const bare = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');

const sourceOf = (path) => fetch(path).then((r) => r.text());

/* ================================================================== *
 * الفهرسُ يجمع المصادر (بنود ١ إلى ٤)
 * ================================================================== */
describe('WS-PL3 · الفهرسُ الموحَّد يجمع ما كان مفرَّقًا', () => {
  it('١ · برومبتاتك الشخصيّةُ تدخل الفهرس', async () => {
    const made = await seed(`${TAG} شخصي`, 'نصُّ برومبتٍ شخصيّ.');
    const items = await catalog();
    const found = findBy(items, SOURCE.PERSONAL, made.id);
    expect(found).toBeTruthy();
    expect(found.sourceKind).toBe(SOURCE.PERSONAL);
    await trashPrompt(made.id);
  });

  it('٢ · وطلباتُ التحليل المبنيّةُ تدخله كذلك', async () => {
    const items = await catalog();
    for (const one of PROMPTS) {
      const found = findBy(items, SOURCE.ANALYSIS, one.id);
      expect(found).toBeTruthy();
      /* ⚠️ وجسدُها تعليماتُها الحقيقيّة لا عنوانُها. */
      expect(found.body.length > 40).toBe(true);
    }
  });

  it('٣ · وبرومبتا الجملة — وهما الصومعةُ التي صنعتُها في WS-SL', async () => {
    const items = await catalog();
    for (const one of LEARN_PROMPTS) {
      expect(findBy(items, SOURCE.SENTENCE, one.id)).toBeTruthy();
    }
  });

  it('٤ · و«الكلُّ» يساوي مجموعَ ما في القائمة — لا صفوفَ مخزنٍ واحد', async () => {
    const made = await seed(`${TAG} مجموع`, 'متن.');
    const items = await catalog();
    const counts = countsOf(items);

    expect(counts[VIEW.ALL]).toBe(items.length);
    /* العطبُ الأصليُّ: «الكل» أصغرُ من «التحليل». */
    expect(counts[VIEW.ALL] >= PROMPTS.length + LEARN_PROMPTS.length).toBe(true);
    await trashPrompt(made.id);
  });

  it('٥ · وبلا برومبتٍ شخصيٍّ واحدٍ يبقى الفهرسُ غيرَ فارغ', async () => {
    /*
     * ⚠️ **هذا هو البندُ ٢٠ بعينه**: الشاشةُ الفارغةُ كانت تقول «مفيش
     *    برومبتات» والتطبيقُ فيه خمسة. فالفهرسُ لا يُفرَغ بغياب
     *    الشخصيّ — و«برومبتاتي» وحدَها هي التي تَفرُغ.
     */
    const items = await catalog();
    const builtins = items.filter((one) => one.sourceKind !== SOURCE.PERSONAL);
    expect(builtins.length >= PROMPTS.length + LEARN_PROMPTS.length).toBe(true);
  });
});

/* ================================================================== *
 * الأوجهُ والعدّ (بنود ٢١ و٢٢ و٤٧)
 * ================================================================== */
describe('WS-PL3 · العدّادُ يقول ما يعنيه اسمُه', () => {
  it('٦ · «برومبتاتي» تعدُّ الشخصيَّ وحدَه', async () => {
    const made = await seed(`${TAG} لي`, 'متن.');
    const items = await catalog();
    const mine = filterCatalog(items, { view: VIEW.MINE });

    expect(countsOf(items)[VIEW.MINE]).toBe(mine.length);
    expect(mine.every((one) => one.sourceKind === SOURCE.PERSONAL)).toBe(true);
    await trashPrompt(made.id);
  });

  it('٧ · وتصفيةُ المصدر تعطي عائلتَه بالضبط', async () => {
    const items = await catalog();
    const analysis = filterCatalog(items, { source: SOURCE.ANALYSIS });
    expect(analysis).toHaveLength(PROMPTS.length);
    expect(analysis.every((one) => one.editable === false)).toBe(true);
  });

  it('٨ · والعددُ من نفس دالّةِ القائمة — لا من طريقٍ ثانٍ', async () => {
    const made = await seed(`${TAG} تناسق`, 'متن.', { favorite: true });
    const items = await catalog();
    const counts = countsOf(items);

    expect(filterCatalog(items, { view: VIEW.FAV })).toHaveLength(counts[VIEW.FAV]);
    expect(filterCatalog(items, { view: VIEW.MINE })).toHaveLength(counts[VIEW.MINE]);
    expect(filterCatalog(items, { view: VIEW.RECENT })).toHaveLength(counts[VIEW.RECENT]);
    await trashPrompt(made.id);
  });
});

/* ================================================================== *
 * البحث عبر المصادر (بنود ١١ و٥٦)
 * ================================================================== */
describe('WS-PL3 · البحثُ يعبر المصادر', () => {
  it('٩ · كلمةٌ من تعليمات طلبِ التحليل تجده', async () => {
    const items = await catalog();
    /* كلمةٌ موجودةٌ في تعليمات `analyze-scene` الحقيقيّة. */
    const hits = filterCatalog(items, { query: 'russian' });
    expect(hits.some((one) => one.sourceKind === SOURCE.ANALYSIS)).toBe(true);
  });

  it('١٠ · وكلمةٌ من متنِ برومبتك الشخصيِّ تجده', async () => {
    const made = await seed(`${TAG} بحث`, 'كلمةٌ نادرةٌ جدًّا: زقنبوت.');
    const items = await catalog();
    const hits = filterCatalog(items, { query: 'زقنبوت' });
    expect(mineOnly(hits)).toHaveLength(1);
    await trashPrompt(made.id);
  });

  it('١١ · والبحثُ يُركَّب مع تصفيةِ المصدر', async () => {
    const made = await seed(`${TAG} تركيب`, 'russian كلمةٌ مشتركة.');
    const items = await catalog();

    const onlyMine = filterCatalog(items, { query: 'russian', source: SOURCE.PERSONAL });
    expect(onlyMine.every((one) => one.sourceKind === SOURCE.PERSONAL)).toBe(true);

    const onlyAnalysis = filterCatalog(items, { query: 'russian', source: SOURCE.ANALYSIS });
    expect(onlyAnalysis.every((one) => one.sourceKind === SOURCE.ANALYSIS)).toBe(true);
    await trashPrompt(made.id);
  });
});

/* ================================================================== *
 * الهُويّة (بنود ٦٠ و٦١)
 * ================================================================== */
describe('WS-PL3 · الهُويّةُ مصدرٌ ومعرّفٌ لا عنوان', () => {
  it('١٢ · عنوانان متطابقان من مصدرين يتعايشان', async () => {
    const twin = LEARN_PROMPTS[0].label;
    const made = await seed(twin, 'نسختي أنا.');
    const items = await catalog();
    const same = items.filter((one) => one.title === twin);

    expect(same.length >= 2).toBe(true);
    expect(new Set(same.map((one) => one.catalogId)).size).toBe(same.length);
    await trashPrompt(made.id);
  });

  it('١٣ · وإعادةُ التسمية لا تغيّر هُويّةَ الفهرس', async () => {
    const made = await seed(`${TAG} قديم`, 'متن.');
    const before = findBy(await catalog(), SOURCE.PERSONAL, made.id);

    await updatePrompt(made.id, { title: `${TAG} جديد` });
    const after = findBy(await catalog(), SOURCE.PERSONAL, made.id);

    expect(after.catalogId).toBe(before.catalogId);
    expect(after.title).toBe(`${TAG} جديد`);
    await trashPrompt(made.id);
  });
});

/* ================================================================== *
 * القراءةُ فقط وسلامةُ المصدر (بنود ٦ و٣١ و٣٢ و٧٠)
 * ================================================================== */
describe('WS-PL3 · المبنيُّ يُقرأ ويُنسَخ ولا يُحرَّر', () => {
  it('١٤ · طلبُ التحليل غيرُ قابلٍ للتحرير ولا للحذف', async () => {
    const one = findBy(await catalog(), SOURCE.ANALYSIS, PROMPTS[0].id);
    expect(one.editable).toBe(false);
    expect(one.deletable).toBe(false);
    expect(one.copyable).toBe(true);
  });

  it('١٥ · ونسخُه إلى برومبتاتي يعطي هُويّةً جديدةً ولا يمسّ الأصل', async () => {
    const before = JSON.stringify(PROMPTS[0]);
    const item = findBy(await catalog(), SOURCE.ANALYSIS, PROMPTS[0].id);

    const copy = await copyToPersonal(item);
    const after = findBy(await catalog(), SOURCE.PERSONAL, copy.id);

    expect(after.sourceKind).toBe(SOURCE.PERSONAL);
    expect(after.editable).toBe(true);
    expect(after.body).toBe(item.body);
    /* والأصلُ كما هو — حرفًا بحرف. */
    expect(JSON.stringify(PROMPTS[0])).toBe(before);
    expect(promptById(PROMPTS[0].id).editable === undefined).toBe(true);
    await trashPrompt(copy.id);
  });

  it('١٦ · والمصفوفةُ المبنيّةُ مُجمَّدةٌ فعلًا — لا بالنيّة', async () => {
    expect(Object.isFrozen(PROMPTS)).toBe(true);
    expect(Object.isFrozen(LEARN_PROMPTS)).toBe(true);
  });

  it('١٧ · وتعديلُ برومبتٍ شخصيٍّ لا يمسّ غيرَه', async () => {
    const a = await seed(`${TAG} أ`, 'متنُ أ.');
    const b = await seed(`${TAG} ب`, 'متنُ ب.');

    await updatePrompt(a.id, { body: 'متنُ أ بعد التعديل.' });
    const items = await catalog();

    expect(findBy(items, SOURCE.PERSONAL, a.id).body).toBe('متنُ أ بعد التعديل.');
    expect(findBy(items, SOURCE.PERSONAL, b.id).body).toBe('متنُ ب.');
    await trashPrompt(a.id);
    await trashPrompt(b.id);
  });
});

/* ================================================================== *
 * المفضّلةُ والأخيرةُ عبر المصادر (بنود ٩ و١٠ و٤٨)
 * ================================================================== */
describe('WS-PL3 · رأيُك فيما لا تملكه يُحفَظ عندك', () => {
  it('١٨ · تفضيلُ برومبتٍ مبنيٍّ يعمل ولا يكتب في كوده', async () => {
    const id = LEARN_PROMPTS[0].id;
    const before = JSON.stringify(LEARN_PROMPTS[0].label);

    const item = findBy(await catalog(), SOURCE.SENTENCE, id);
    const now = await toggleCatalogFavorite(item);
    expect(now).toBe(true);

    const after = findBy(await catalog(), SOURCE.SENTENCE, id);
    expect(after.favorite).toBe(true);
    expect(JSON.stringify(LEARN_PROMPTS[0].label)).toBe(before);
    expect(LEARN_PROMPTS[0].favorite === undefined).toBe(true);

    /* ونعيدها كما كانت كي لا يُلوَّث ما بعدَها. */
    await toggleCatalogFavorite(after);
    expect(findBy(await catalog(), SOURCE.SENTENCE, id).favorite).toBe(false);
  });

  it('١٩ · وتفضيلُ الشخصيِّ يُكتَب على صفّه هو', async () => {
    const made = await seed(`${TAG} مفضّل`, 'متن.');
    const item = findBy(await catalog(), SOURCE.PERSONAL, made.id);

    await toggleCatalogFavorite(item);
    expect(findBy(await catalog(), SOURCE.PERSONAL, made.id).favorite).toBe(true);
    await trashPrompt(made.id);
  });

  it('٢٠ · و«الأخيرة» تشمل المبنيَّ والشخصيَّ معًا', async () => {
    const made = await seed(`${TAG} أخير`, 'متن.');
    const items = await catalog();

    await markCatalogOpened(findBy(items, SOURCE.PERSONAL, made.id));
    await markCatalogOpened(findBy(items, SOURCE.ANALYSIS, PROMPTS[0].id));

    const recent = filterCatalog(await catalog(), { view: VIEW.RECENT });
    expect(recent.some((one) => one.sourceId === made.id)).toBe(true);
    expect(recent.some((one) => one.sourceKind === SOURCE.ANALYSIS)).toBe(true);
    await trashPrompt(made.id);
  });

  it('٢١ · والنسخُ يُسجَّل لكلّ المصادر', async () => {
    const item = findBy(await catalog(), SOURCE.SENTENCE, LEARN_PROMPTS[1].id);
    const before = item.copies;
    await markCatalogCopied(item);

    const after = findBy(await catalog(), SOURCE.SENTENCE, LEARN_PROMPTS[1].id);
    expect(after.copies).toBe(before + 1);
  });
});

/* ================================================================== *
 * قالبُ الجملة — هُويّةٌ واحدةٌ وسياقان (قيد المالك ٢ · بند ٣٩)
 * ================================================================== */
describe('WS-PL3 · قالبُ الجملة يُعرَض بمتغيّره', () => {
  it('٢٢ · المتغيّرُ ظاهرٌ في المكتبة ويُكشَف بآلةِ المتغيّرات القائمة', async () => {
    const item = findBy(await catalog(), SOURCE.SENTENCE, LEARN_PROMPTS[0].id);
    expect(item.body).toContain(SENTENCE_SLOT);

    const slots = findPlaceholders(item.body);
    expect(slots.length >= 1).toBe(true);
  });

  it('٢٣ · وهُويّتُه من المكتبة هي هُويّتُه من الشادوينج — لا صفَّ ثانٍ', async () => {
    /*
     * ⚠️ الشادوينجُ ينادي `build(sentence)` بالجملة الحاليّة، والمكتبةُ
     *    تنادي `build(SENTENCE_SLOT)`. **دالّةٌ واحدةٌ ومعرّفٌ واحد** —
     *    والفرقُ قيمةٌ تُمرَّر لا سجلٌّ يُنشأ.
     */
    const one = LEARN_PROMPTS[0];
    const fromLibrary = findBy(await catalog(), SOURCE.SENTENCE, one.id);
    const filled = one.build('Э́то сло́во.');

    expect(fromLibrary.catalogId).toBe(catalogKey(SOURCE.SENTENCE, one.id));
    expect(filled).toContain('Э́то сло́во.');
    /* والقالبُ نفسُه لم يتغيّر بالملء. */
    expect(findBy(await catalog(), SOURCE.SENTENCE, one.id).body).toContain(SENTENCE_SLOT);
  });
});

/* ================================================================== *
 * حرّاسٌ بنيويّون — يقيسون الكود (بنود ٢ و٥٩ و٧٠)
 * ================================================================== */
describe('WS-PL3 · حرّاسُ البنية', () => {
  it('٢٤ · ⚠️ الفهرسُ يقرأ ولا ينسخ: لا كتابةَ لمخزن البرومبتات فيه', async () => {
    const src = bare(await sourceOf('../js/services/prompts/catalog.js'));
    /*
     * ⚠️ **هذا هو حارسُ البند ٢ المركزيّ.** لو نسخ الفهرسُ المبنيَّ إلى
     *    `promptVersions` لصار في التطبيق حقيقتان لبرومبتٍ واحد. والكتابةُ
     *    الوحيدةُ المسموحة هي `createPrompt` داخل «انسخه إلى برومبتاتي» —
     *    وتلك بطلبٍ صريحٍ منك لا في أثناء الجمع.
     */
    expect(src.includes('promptVersions')).toBe(false);
    expect(src.includes('.create(')).toBe(false);
  });

  it('٢٥ · وكلُّ مصدرٍ في حِرزه: سقوطُ واحدٍ لا يُفرغ المكتبة', async () => {
    const src = bare(await sourceOf('../js/services/prompts/catalog.js'));
    const guards = (src.match(/try\s*\{/g) || []).length;
    /* أربعةُ مصادرَ = أربعةُ حروز، والخامسُ لقراءة التفضيلات. */
    expect(guards >= 4).toBe(true);
    expect(src).toContain('errors.push');
  });

  it('٢٦ · ولا نصَّ برومبتٍ مكتوبٌ في الفهرس — المصادرُ تملك متونَها', async () => {
    const src = bare(await sourceOf('../js/services/prompts/catalog.js'));
    /* لو ظهر متنُ برومبتٍ هنا لصار هذا الملفُّ مصدرًا خامسًا صامتًا. */
    expect(src.includes('You are helping')).toBe(false);
  });

  it('٢٧ · والتصنيفاتُ تُشتَقُّ من الفهرس لا من قائمةٍ مكتوبة', async () => {
    const made = await seed(`${TAG} مصنَّف`, 'متن.', { category: `${TAG}-فئة` });
    const cats = catalogCategories(await catalog());

    const mine = cats.find((one) => one.name === `${TAG}-فئة`);
    expect(mine).toBeTruthy();
    expect(mine.count).toBe(1);
    /* وللمبنيّ تصنيفُه المشتقُّ من نوعه لا «بدون تصنيف». */
    expect(cats.some((one) => one.name === SOURCE_LABEL[SOURCE.ANALYSIS])).toBe(true);
    await trashPrompt(made.id);
  });

  it('٢٨ · ولا يتسرّب برومبتٌ محذوفٌ إلى الفهرس', async () => {
    const made = await seed(`${TAG} محذوف`, 'متن.');
    await trashPrompt(made.id);
    expect(findBy(await catalog(), SOURCE.PERSONAL, made.id)).toBe(null);
  });

  it('٢٩ · وتفضيلاتُ المبنيِّ في مخزنِ التفضيلات لا في المخزن الشخصيّ', async () => {
    const item = findBy(await catalog(), SOURCE.SENTENCE, LEARN_PROMPTS[1].id);
    await markCatalogOpened(item);

    const meta = await catalogMeta();
    expect(Boolean(meta[item.catalogId])).toBe(true);

    /* ولا صفَّ جديدًا في برومبتاتك مقابلَه. */
    const rows = await listPrompts();
    expect(rows.some((row) => row.title === item.title)).toBe(false);
  });
});

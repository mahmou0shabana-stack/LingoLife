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
import {
  PROMPTS, LEARN_PROMPTS, promptById, setExtraInstructions, extraInstructions,
} from '../js/services/prompts/library.js';
import { createPrompt, updatePrompt, trashPrompt, listPrompts } from '../js/services/prompts/user-prompts.js';
import { findPlaceholders } from '../js/services/prompts/prompt-text.js';
import { renderPrompts, handlePromptsAction, resetPrompts } from '../js/views/prompts-view.js';

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

/* ================================================================== *
 * تعليماتُك المحفوظةُ في الإعدادات (قيد المالك ٣ · بنود ٧ و٣٤ و٧٠)
 * ================================================================== */
describe('WS-PL3 · تعليماتُك تُكتَب في مصدرها هي', () => {
  const OWNER = PROMPTS[0].id;
  const MINE = `تعليماتي ${TAG}: خلّي الأمثلة قصيرة.`;

  it('٣٠ · تعليماتٌ فيها نصٌّ حقيقيٌّ تدخل الفهرس عنصرًا', async () => {
    await setExtraInstructions(OWNER, MINE);
    const item = findBy(await catalog(), SOURCE.EXTRA, OWNER);

    expect(item).toBeTruthy();
    expect(item.body).toBe(MINE);
    expect(item.editable).toBe(true);
    /* ولا تُحذَف من هنا — حذفُها إفراغُ حقلٍ في الإعدادات. */
    expect(item.deletable).toBe(false);
  });

  it('٣١ · وتعليماتٌ فارغةٌ لا تصنع عنصرًا كاذبًا (بند ٤٧)', async () => {
    await setExtraInstructions(OWNER, '   ');
    expect(findBy(await catalog(), SOURCE.EXTRA, OWNER)).toBe(null);
    await setExtraInstructions(OWNER, MINE);
  });

  it('٣٢ · ⚠️ وتحريرُها يكتب في الإعدادات — ولا صفَّ جديدًا في برومبتاتك', async () => {
    /*
     * ⚠️ **هذا هو الحارسُ المركزيُّ للقيد الثالث.** أسهلُ تنفيذٍ — وأسوؤه
     *    — أن يُنسَخ النصُّ إلى `promptVersions` ليصير قابلًا للتحرير
     *    كالبقيّة. فتصير لنصٍّ واحدٍ نسختان: واحدةٌ تُلحَق بالطلب فعلًا
     *    وأخرى تراها في الشاشة. ويمرّ ذلك بلا عَرَضٍ حتى تتغيّر إحداهما.
     */
    const before = (await listPrompts()).length;
    const next = `${MINE} وزوّد مثالًا.`;

    await setExtraInstructions(OWNER, next);
    const stored = await extraInstructions();

    expect(stored[OWNER]).toBe(next);
    expect(findBy(await catalog(), SOURCE.EXTRA, OWNER).body).toBe(next);
    /* ولا صفَّ واحدًا زاد في مخزن البرومبتات. */
    expect((await listPrompts()).length).toBe(before);
  });

  it('٣٣ · والشاشةُ توجّه الحفظَ إلى الإعدادات لا إلى المخزن', async () => {
    const src = bare(await sourceOf('../js/views/prompts-view.js'));
    /*
     * حارسٌ يقيس الكود: لا بدّ من فرعٍ يكتب `setExtraInstructions`
     * قبل أن يصل الحفظُ إلى `updatePrompt`.
     */
    const at = src.indexOf('setExtraInstructions(row.sourceId');
    const to = src.indexOf('updatePrompt(row.sourceId');
    expect(at > 0).toBe(true);
    expect(at < to).toBe(true);
  });
});

/* ================================================================== *
 * المفضّلةُ والأخيرةُ عبر المصادر الأربعة (بنود ٩ و١٠ و٤٨ و٦١)
 * ================================================================== */
describe('WS-PL3 · المفضّلةُ والأخيرةُ تعبران المصادرَ كلَّها', () => {
  /**
   * عيّنةٌ من كلّ مصدرٍ — والرابعُ تعليماتُك.
   *
   * ⚠️ **وتزرع الشخصيَّ بنفسها.** أوّلُ كتابةٍ افترضت وجودَ برومبتٍ
   *    شخصيٍّ في القاعدة، والاختباراتُ السابقةُ ترمي ما تزرعه في السلّة
   *    — فعادت العيّنةُ ثلاثةً وفيها `undefined`. والفشلُ كان في
   *    **تجهيزِ الاختبار** لا في الفهرس: عيّنةٌ تعتمد على أثرِ غيرِها
   *    تقيس ترتيبَ التشغيل لا السلوك.
   */
  let seeded = null;
  const sample = async () => {
    if (!seeded) seeded = await seed(`${TAG} عيّنة`, 'متنُ العيّنة.');
    const items = await catalog();
    return [
      items.find((one) => one.catalogId === catalogKey(SOURCE.PERSONAL, seeded.id)),
      items.find((one) => one.sourceKind === SOURCE.ANALYSIS),
      items.find((one) => one.sourceKind === SOURCE.SENTENCE),
      items.find((one) => one.sourceKind === SOURCE.EXTRA),
    ];
  };

  it('٣٤ · المصادرُ الأربعةُ حاضرةٌ في الفهرس', async () => {
    const four = await sample();
    expect(four.filter(Boolean)).toHaveLength(4);
    expect(new Set(four.map((one) => one.sourceKind)).size).toBe(4);
  });

  it('٣٥ · والتفضيلُ يعمل على كلٍّ منها بهُويّتها الثابتة', async () => {
    const four = await sample();

    for (const one of four) {
      const now = await toggleCatalogFavorite(one);
      expect(now).toBe(true);
    }

    const after = await catalog();
    for (const one of four) {
      const fresh = after.find((x) => x.catalogId === one.catalogId);
      expect(fresh.favorite).toBe(true);
      /* والهُويّةُ هي `مصدر:معرّف` لا العنوان. */
      expect(fresh.catalogId).toBe(catalogKey(one.sourceKind, one.sourceId));
    }

    /* ونُعيدها كما كانت. */
    for (const one of after.filter((x) => four.some((f) => f.catalogId === x.catalogId))) {
      await toggleCatalogFavorite(one);
    }
  });

  it('٣٦ · و«الأخيرة» تجمع الأربعةَ معًا', async () => {
    const four = await sample();
    for (const one of four) await markCatalogOpened(one);

    const recent = filterCatalog(await catalog(), { view: VIEW.RECENT });
    const kinds = new Set(recent.map((one) => one.sourceKind));
    for (const one of four) expect(kinds.has(one.sourceKind)).toBe(true);
  });

  it('٣٧ · ⚠️ والمصادرُ المبنيّةُ تبقى كما هي حرفًا بحرف', async () => {
    /*
     * ⚠️ تفضيلٌ أو فتحٌ أو نسخٌ — لا شيءَ منها يلمس الكودَ المُجمَّد.
     *    والمقارنةُ بالتسلسل لا بالمرجع: مرجعٌ واحدٌ يمرّ ولو تغيّر جوفُه.
     */
    const before = JSON.stringify({ p: PROMPTS, l: LEARN_PROMPTS });

    const four = await sample();
    for (const one of four) {
      await markCatalogOpened(one);
      await markCatalogCopied(one);
    }

    expect(JSON.stringify({ p: PROMPTS, l: LEARN_PROMPTS })).toBe(before);
    expect(Object.isFrozen(PROMPTS)).toBe(true);
    expect(Object.isFrozen(LEARN_PROMPTS)).toBe(true);
  });

  it('٣٨ · وتفضيلاتُ غيرِ الشخصيِّ في مخزن التفضيلات وحدَه', async () => {
    const meta = await catalogMeta();
    const four = await sample();
    for (const one of four.filter((x) => x.sourceKind !== SOURCE.PERSONAL)) {
      expect(Boolean(meta[one.catalogId])).toBe(true);
      expect(one.catalogId.startsWith(`${one.sourceKind}:`)).toBe(true);
    }
    if (seeded) { await trashPrompt(seeded.id); seeded = null; }
  });
});

/* ================================================================== *
 * الشاشة: بنيةٌ ومحرّر (بندا ٦٨ و٦٩)
 * ================================================================== */
describe('WS-PL3 · الشاشةُ لوحان ومحرّرٌ يبدأ بالمتن', () => {
  const wait = (ms = 90) => new Promise((done) => { setTimeout(done, ms); });
  const $$$ = (sel, root) => [...root.querySelectorAll(sel)];
  let host = null;

  /** شاشةٌ نظيفةٌ — و`paint` تستعلم من `document` فلا يبقى مضيفٌ قديم. */
  const screen = async () => {
    document.querySelectorAll('[data-pl]').forEach((one) => one.parentElement?.remove());
    host = document.createElement('div');
    document.body.append(host);
    resetPrompts();
    await renderPrompts(host);
    await wait();
    return host;
  };

  it('٣٩ · لا عمودَ تصنيفاتٍ دائمًا — لوحان فقط', async () => {
    await screen();
    expect($$$('.pl > section, .pl > aside', host)).toHaveLength(2);
    expect($$$('.pl-side', host)).toHaveLength(0);
    host.remove();
  });

  it('٤٠ · والتصفيةُ في المتناول: أوجهٌ ومدخلُ تصنيفات', async () => {
    await screen();
    expect($$$('.pl-faces .pl-face', host).length >= 4).toBe(true);
    expect($$$('[data-action="pl-cats"]', host)).toHaveLength(1);
    host.remove();
  });

  it('٤١ · والدرجُ يُفتَح ويُغلَق', async () => {
    await screen();
    expect($$$('[data-pl-drawer]', host)).toHaveLength(0);

    await handlePromptsAction('pl-cats');
    await wait();
    expect($$$('[data-pl-drawer]', host)).toHaveLength(1);

    await handlePromptsAction('pl-cats');
    await wait();
    expect($$$('[data-pl-drawer]', host)).toHaveLength(0);
    host.remove();
  });

  it('٤٢ · وتصفيةُ المصدر تُعلَن ثم تُمسَح', async () => {
    await screen();
    await handlePromptsAction('pl-source', SOURCE.SENTENCE);
    await wait();

    const chips = $$$('.pl-active .pl-chip', host).map((one) => one.textContent.trim());
    expect(chips.some((one) => one.includes(SOURCE_LABEL[SOURCE.SENTENCE]))).toBe(true);
    expect($$$('.pl-row', host)).toHaveLength(LEARN_PROMPTS.length);

    await handlePromptsAction('pl-clear');
    await wait();
    expect($$$('.pl-active', host)).toHaveLength(0);
    host.remove();
  });

  it('٤٣ · والتحديدُ ظاهرٌ وواحدٌ لا أكثر', async () => {
    const made = await seed(`${TAG} تحديد`, 'متن التحديد.');
    await screen();
    await handlePromptsAction('pl-open', catalogKey(SOURCE.PERSONAL, made.id));
    await wait();

    expect($$$('.pl-row.is-on', host)).toHaveLength(1);
    expect($$$('[aria-selected="true"]', host)).toHaveLength(1);
    host.remove();
    await trashPrompt(made.id);
  });

  it('٤٤ · والسكّةُ مضغوطةٌ بصنف الورشة نفسِه (بند ١٨)', async () => {
    await screen();
    expect(document.body.classList.contains('ws-rail-compact')).toBe(true);
    /* ولا صنفَ سكّةٍ ثانٍ اخترعناه. */
    const src = bare(await sourceOf('../js/views/prompts-view.js'));
    expect(src).toContain('ws-rail-compact');
    expect(src.includes('pl-rail-compact')).toBe(false);
    host.remove();
  });

  it('٤٥ · ومدخلُ الإنشاءِ واحدٌ في الشاشة كلِّها (بند ١٩)', async () => {
    await screen();
    expect($$$('[data-action="pl-new"]', host)).toHaveLength(1);
    host.remove();
  });

  it('٤٦ · والمحرّرُ يبدأ بالاسم والمتن، والتنظيمُ مطويّ', async () => {
    const made = await seed(`${TAG} محرّر`, 'متنٌ للتحرير.');
    await screen();
    await handlePromptsAction('pl-open', catalogKey(SOURCE.PERSONAL, made.id));
    await wait();
    await handlePromptsAction('pl-edit');
    await wait();

    expect($$$('[data-pl-title]', host)).toHaveLength(1);
    expect($$$('[data-pl-body]', host)).toHaveLength(1);

    const meta = host.querySelector('[data-pl-meta]');
    expect(Boolean(meta)).toBe(true);
    /* ⚠️ مطويّةٌ افتراضيًّا — ولا تُطلَب منك قبل اللصق (بند ٢٤). */
    expect(meta.open).toBe(false);
    /* وحقولُ التنظيم موجودةٌ داخلها لا محذوفة (بند ٢٥). */
    expect($$$('[data-pl-meta] [data-pl-category]', host)).toHaveLength(1);
    host.remove();
    await trashPrompt(made.id);
  });

  it('٤٧ · ولا زرَّ حفظٍ يمتدّ نصفَ الشاشة (بند ٢٧)', async () => {
    const made = await seed(`${TAG} أزرار`, 'متن.');
    await screen();
    await handlePromptsAction('pl-open', catalogKey(SOURCE.PERSONAL, made.id));
    await wait();
    await handlePromptsAction('pl-edit');
    await wait();

    const acts = $$$('.pl-acts .btn', host).map((one) => one.textContent.trim());
    expect(acts).toContain('احفظ');
    expect(acts).toContain('إلغاء');
    /* والإلغاءُ شبحيٌّ لا مساوٍ للحفظ في الوزن. */
    const cancel = $$$('.pl-acts .btn', host).find((one) => one.textContent.trim() === 'إلغاء');
    expect(cancel.classList.contains('btn-ghost')).toBe(true);
    host.remove();
    await trashPrompt(made.id);
  });

  it('٤٨ · ⚠️ ولصقٌ ضخمٌ يُحفَظ حرفًا بحرف بلا تطبيع', async () => {
    /*
     * ⚠️ **أخطرُ ما تفعله شاشةٌ ببرومبتك أن «تُصلحه»**: تحذف سطرًا
     *    فارغًا أو تُطبّع مسافة. فيخرج من الحافظة نصٌّ غيرُ الذي لصقتَه،
     *    ولا تعرف السببَ إلّا حين يأتيك ناتجٌ غريبٌ من ChatGPT.
     */
    const huge = [
      '§1 الهدف:', '', '   مسافاتٌ بادئة   ', '',
      'Русский текст с ударе́нием.', '{ "json": [1, 2] }',
      '━━━━━━━━━━', '[ضع الجملة الروسية هنا]', '',
      'x'.repeat(50000),
    ].join('\n');

    const made = await seed(`${TAG} ضخم`, huge);
    const item = findBy(await catalog(), SOURCE.PERSONAL, made.id);

    expect(item.body).toBe(huge);
    expect(item.body.length).toBe(huge.length);
    /* والمتغيّرُ نجا فيُكشَف. */
    expect(findPlaceholders(item.body).length >= 1).toBe(true);
    await trashPrompt(made.id);
  });

  it('٤٩ · والإلغاءُ بلا تغييرٍ لا يسأل ولا يفقد شيئًا', async () => {
    const made = await seed(`${TAG} إلغاء`, 'متنٌ أصليّ.');
    await screen();
    await handlePromptsAction('pl-open', catalogKey(SOURCE.PERSONAL, made.id));
    await wait();
    await handlePromptsAction('pl-edit');
    await wait();
    await handlePromptsAction('pl-cancel');
    await wait();

    expect($$$('[data-pl-body]', host)).toHaveLength(0);
    expect(findBy(await catalog(), SOURCE.PERSONAL, made.id).body).toBe('متنٌ أصليّ.');
    host.remove();
    await trashPrompt(made.id);
  });

  it('٥٠ · والحفظُ يكتب المتنَ الجديد ويعود للقراءة', async () => {
    const made = await seed(`${TAG} حفظ`, 'قبل.');
    await screen();
    await handlePromptsAction('pl-open', catalogKey(SOURCE.PERSONAL, made.id));
    await wait();
    await handlePromptsAction('pl-edit');
    await wait();

    host.querySelector('[data-pl-body]').value = 'بعد.\n\nسطرٌ ثانٍ.';
    await handlePromptsAction('pl-save');
    await wait(200);

    expect(findBy(await catalog(), SOURCE.PERSONAL, made.id).body).toBe('بعد.\n\nسطرٌ ثانٍ.');
    expect($$$('[data-pl-body]', host)).toHaveLength(0);
    host.remove();
    await trashPrompt(made.id);
  });

  it('٥١ · ولا زرَّ تعديلٍ على ما تملكه آلةُ التطبيق (بند ٣١)', async () => {
    await screen();
    await handlePromptsAction('pl-open', catalogKey(SOURCE.ANALYSIS, PROMPTS[0].id));
    await wait();

    const acts = $$$('.pl-acts button', host).map((one) => one.textContent.trim());
    expect(acts.some((one) => one === 'تعديل')).toBe(false);
    expect(acts.some((one) => one.includes('انسخه لبرومبتاتي'))).toBe(true);
    /* ومسارُ الاستعمالِ المولِّدُ باقٍ (قيد المالك ١). */
    expect($$$('.pl-use', host)).toHaveLength(1);
    host.remove();
  });

  it('٥٢ · وحتى لو نُودي الفعلُ مباشرةً لا يدخل التحرير', async () => {
    await screen();
    await handlePromptsAction('pl-open', catalogKey(SOURCE.SENTENCE, LEARN_PROMPTS[0].id));
    await wait();
    await handlePromptsAction('pl-edit');
    await wait();
    /* ⚠️ حارسٌ خلف إخفاء الزرّ: الإخفاءُ وحدَه ليس منعًا. */
    expect($$$('[data-pl-body]', host)).toHaveLength(0);
    host.remove();
  });
});

/* ================================================================== *
 * القياس — بمصادرَ مختلطةٍ لا بشخصيٍّ وحدَه (بند ٦٢)
 * ================================================================== */
describe('WS-PL3 · القياس', () => {
  it('٥٣ · جمعُ فهرسٍ فيه ٢٠٠٠ برومبتٍ شخصيٍّ ومبنيّاتُه تحت ٦٠٠ms', async () => {
    /*
     * ⚠️ **ولا تُبنى الفرضيّةُ على «عشراتٍ فقط»** (بند ٤١): المكتبةُ
     *    تكبر، والطبقةُ الجديدةُ تقرأ أربعةَ مصادرَ لا واحدًا. فالقياسُ
     *    هنا على حجمٍ لن تبلغه قريبًا — كي يبقى الهامشُ معلومًا.
     *
     * ⚠️ **والبذرُ خارج القياس**: ٢٠٠٠ كتابةٍ في IndexedDB تقيس القاعدةَ
     *    لا الفهرس. المقيسُ هو `buildCatalog` وحدَها.
     */
    const bulk = [];
    for (let i = 0; i < 2000; i += 1) {
      bulk.push(createPrompt({
        title: `${TAG} حجم ${i}`,
        body: `متنٌ رقم ${i} فيه كلمةٌ مميّزة: قنديل${i}.`,
        category: `${TAG}-ف${i % 12}`,
        tags: [TAG, `و${i % 7}`],
      }));
    }
    await Promise.all(bulk);

    const at = performance.now();
    const { items: all } = await buildCatalog();
    const assembly = performance.now() - at;

    const t1 = performance.now();
    const mine = filterCatalog(all, { view: VIEW.MINE });
    const mineMs = performance.now() - t1;

    const t2 = performance.now();
    const hits = filterCatalog(all, { query: 'قنديل1999' });
    const searchMs = performance.now() - t2;

    const t3 = performance.now();
    const counts = countsOf(all);
    const countMs = performance.now() - t3;

    const t4 = performance.now();
    const cats = catalogCategories(all);
    const catMs = performance.now() - t4;

    console.warn(`[perf] WS-PL3 · ${all.length} عنصرًا · جمع ${assembly.toFixed(0)}ms`
      + ` · برومبتاتي ${mineMs.toFixed(1)}ms · بحثٌ في المتن ${searchMs.toFixed(1)}ms`
      + ` · عدّ ${countMs.toFixed(1)}ms · تصنيفات ${catMs.toFixed(1)}ms`);

    expect(all.length >= 2000).toBe(true);
    expect(mine.length >= 2000).toBe(true);
    expect(hits.length >= 1).toBe(true);
    expect(counts[VIEW.ALL]).toBe(all.length);
    expect(cats.length >= 12).toBe(true);

    expect(assembly < 600).toBe(true);
    /* والتصفيةُ في الذاكرة — فميزانيّتُها أضيقُ بكثير. */
    expect(mineMs < 60).toBe(true);
    expect(searchMs < 120).toBe(true);
    expect(countMs < 60).toBe(true);

    /* ونظافةُ ما بعدَه: ٢٠٠٠ صفٍّ لا تُترَك للاختبارات التالية. */
    const mineRows = (await listPrompts()).filter((row) => (row.tags || []).includes(TAG));
    await Promise.all(mineRows.map((row) => trashPrompt(row.id)));
  });
});

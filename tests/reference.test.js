/**
 * LingoLife — ورشةُ المراجع (WS-B)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما تحرسه هذه الاختبارات — وما لا تحرسه
 * ═══════════════════════════════════════════════════════════════
 *
 * الوعدُ الأساسيّ في WS-B ليس «يفتح الملفّ»، بل:
 *
 *     تتنقّل بين المصدر والقواعد والملفّ والصور
 *     **وسياقُ التدريب حيٌّ كما تركتَه**.
 *
 * وذلك الوعدُ ينكسر في ثلاثة أماكن، ولكلٍّ حارسٌ هنا:
 *
 *  ١ · **في البيانات** — قاعدةٌ تُحذَف فتأخذ معها بايتاتِ صورةٍ
 *      مشتركة، أو ملفٌّ يُنسَخ لكلّ ذكرى بدل أن يكون واحدًا عامًّا.
 *
 *  ٢ · **في الحالة** — تبويبٌ يكتب فيدهس حالةَ تبويبٍ آخر، أو صفحةُ
 *      ملفٍّ تُنسى بين الجلسات.
 *
 *  ٣ · **في الشاشة** — `renderWells` تلمس المشغّلَ أو تُخرج من النصّ
 *      الخارجيّ أو تُلغي المقطعَ المحدَّد. وهذا لا يُكتشَف إلّا بفحص
 *      نصٍّ، لأن كتابةَ سطرٍ كهذا لا تُسقط اختبارًا.
 *
 * ⚠️ **وما لا تحرسه**: رسمَ صفحةِ الـPDF نفسَها. ذلك يحتاج متصفّحًا
 *    ولوحةَ رسمٍ وملفًّا حقيقيًّا — قِيس بمسبار Playwright حقيقيّ
 *    (صفحة 1 → 3، تكبير، خروجٌ وعودة) وسُجّل في تقرير WS-B. أمّا هنا
 *    فالمحروسُ **العقد**: أن المكتبةَ تُستورَد كسلًا، وأن العارضَ لا
 *    يعرف الصوتَ ولا القاعدة.
 */

import { describe, it, expect } from './test-runner.js';
import {
  REF_KEY, REF_TAB, FIT, RULE_MEDIA, REFERENCE_IMAGE_KIND, REFERENCE_DOC_KIND,
  listRules, rulesWithImages, searchRules, getRule,
  createRule, updateRule, toggleRulePin, moveRule, moveAffordance,
  trashRule, restoreRule,
  ruleImages, addRuleImage, attachRuleImage, detachRuleImage,
  listReferenceImages, addReferenceImage,
  activeDoc, listDocs, setActiveDoc, chooseDoc, clearActiveDoc,
  readView, patchView,
} from '../js/services/reference-service.js';
import { referenceRules, relationships, media, settings } from '../js/db/repositories.js';
import { STATE, STORES } from '../js/db/schema.js';
import { TARGET_VERSION } from '../js/db/migrations.js';

/* ------------------------------------------------------------------ *
 * أدواتٌ صغيرة
 * ------------------------------------------------------------------ */

/** بادئةٌ فريدةٌ لكلّ تشغيل — فلا تختلط قواعدُ اختبارٍ بقواعد آخر. */
const TAG = `WSB-${Math.random().toString(36).slice(2, 8)}`;

/** ينشئ قاعدةً موسومةً بالبادئة. */
const mkRule = (name, extra = {}) => createRule({ title: `${TAG} ${name}`, ...extra });

/** قواعدُ هذا التشغيل وحدَها، بترتيب العرض. */
async function mine() {
  return (await listRules()).filter((row) => (row.title || '').startsWith(TAG));
}

/** صورةٌ صغيرةٌ حقيقيّة — بكسلٌ شفّاف بصيغة PNG. */
function tinyPng(name = 'pic.png') {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: 'image/png' });
}

/** «ملفّ» للاختبار — البايتاتُ لا تُفكّ هنا، فأيُّ بايتاتٍ تكفي. */
function fakePdf(name = 'rules.pdf') {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])],
    name, { type: 'application/pdf' });
}

const readSrc = async (path) => (await fetch(path)).text();

/**
 * ماسحُ تعليقاتٍ يعرف السلاسل — نفسُ درس `study-draft.test.js`.
 *
 * ⚠️ **ولا `replace` واحدة**: سطرٌ فيه `accept: 'image/*'` يفتح
 *    تعليقًا وهميًّا يبتلع نصفَ الملفّ، فيصرخ الحارسُ في الصواب.
 */
function codeOnly(src) {
  let out = '';
  let i = 0;
  let quote = null;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (quote) {
      if (ch === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (ch === quote) quote = null;
      out += ch; i += 1; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; i += 1; continue; }
    if (ch === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2; continue;
    }
    out += ch; i += 1;
  }
  return out;
}

/** يقتطع جسمَ دالّةٍ من نصّ الملفّ (بلا تعليقاتها). */
function bodyOf(code, header, stop) {
  const from = code.indexOf(header);
  if (from < 0) return '';
  const to = code.indexOf(stop, from + header.length);
  return code.slice(from, to < 0 ? code.length : to);
}

/* ================================================================== *
 * ١) الترقية والمخزن — إضافةٌ محضة (بند 41)
 * ================================================================== */

describe('WS-B · المخزن', () => {
  it('مخزنٌ واحدٌ جديدٌ لا أربعة — تبويبٌ لا يعني مخزنًا', () => {
    expect(Boolean(STORES.referenceRules)).toBe(true);
    /* التبويباتُ الثلاثةُ الأخرى تسكن مخازنَ منشورة. */
    expect(Boolean(STORES.media)).toBe(true);
    expect(Boolean(STORES.relationships)).toBe(true);
    expect(Boolean(STORES.settings)).toBe(true);
  });

  it('ولا `sceneId` على القاعدة — عامّةٌ بالتصميم (بندا 23-24)', () => {
    const names = STORES.referenceRules.indexes.map(([name]) => name);
    expect(names.includes('sceneId')).toBe(false);
    expect(names.includes('order')).toBe(true);
    expect(names.includes('pinned')).toBe(true);
  });

  it('والترقيةُ وصلت v15', () => {
    expect(TARGET_VERSION >= 15).toBe(true);
  });
});

/* ================================================================== *
 * ٢) القواعد — إنشاءٌ وتحريرٌ وحذفٌ وتراجع (بنود 6-10)
 * ================================================================== */

describe('WS-B · القواعد', () => {
  it('عنوانٌ وحدَه يكفي — ونصٌّ وحدَه يكفي (بند 6)', async () => {
    const onlyTitle = await mkRule('عنوان فقط');
    const onlyText = await createRule({ text: `${TAG} نصّ بلا عنوان` });
    expect(Boolean(onlyTitle.id)).toBe(true);
    expect(Boolean(onlyText.id)).toBe(true);
    await referenceRules.destroy(onlyText.id);
  });

  it('والفارغةُ تمامًا تُرفَض', async () => {
    await expect(createRule({ title: '   ', text: '' })).toReject();
  });

  it('التحريرُ يعدّل ولا يُنشئ صفًّا ثانيًا (بند 9)', async () => {
    const row = await mkRule('قبل');
    const before = (await mine()).length;
    await updateRule(row.id, { title: `${TAG} بعد`, text: 'شرح', tags: ['نطق'] });
    const after = await getRule(row.id);
    expect(after.title).toBe(`${TAG} بعد`);
    expect(after.text).toBe('شرح');
    expect(after.tags).toEqual(['نطق']);
    expect((await mine()).length).toBe(before);
  });

  it('والحذفُ إلى السلّة والتراجعُ يعيدها (بند 10)', async () => {
    const row = await mkRule('للحذف');
    await trashRule(row.id);
    expect((await mine()).some((one) => one.id === row.id)).toBe(false);
    expect((await getRule(row.id)).state).toBe(STATE.TRASHED);

    await restoreRule(row.id);
    expect((await mine()).some((one) => one.id === row.id)).toBe(true);
  });
});

/* ================================================================== *
 * ٣) الترتيب (بند 11)
 * ================================================================== */

describe('WS-B · الترتيب', () => {
  it('الجديدةُ تنزل آخرَ الدفتر', async () => {
    const a = await mkRule('ت-أ');
    const b = await mkRule('ت-ب');
    expect(b.order > a.order).toBe(true);
  });

  it('و▲ تبدّل مع الجار المرئيّ لا مع الأقرب رقمًا', async () => {
    const rows = [];
    for (const n of ['ر1', 'ر2', 'ر3']) rows.push(await mkRule(n));

    const before = (await mine()).map((one) => one.title);
    const third = before[before.length - 1];
    const second = before[before.length - 2];

    await moveRule(rows[2].id, -1);
    const after = (await mine()).map((one) => one.title);
    expect(after[after.length - 2]).toBe(third);
    expect(after[after.length - 1]).toBe(second);
  });

  it('وسهمٌ خارج الدفتر لا يفعل شيئًا ولا يرمي', async () => {
    const rows = await mine();
    const first = rows[0];
    /*
     * ⚠️ **`false` لا استثناء**: الشاشةُ تعطّل الزرّ، لكن الخدمةَ لا
     *    تعتمد على ذلك — نداءٌ من مكانٍ آخر يجب أن يرجع بلا ضرر.
     */
    expect(await moveRule(first.id, -1)).toBe(false);
    expect(await moveRule('RRL_لا-وجود-له', 1)).toBe(false);
  });

  it('والسهمُ لا يعبر حدَّ التثبيت — يُثبَّت بزرّه لا بالترتيب', async () => {
    const pinned = await mkRule('مثبَّتة');
    await toggleRulePin(pinned.id);

    const rows = await mine();
    const pins = rows.filter((one) => one.pinned);
    const plain = rows.filter((one) => !one.pinned);
    expect(pins.length).toBe(1);
    /* المثبَّتةُ أوّلًا في العرض. */
    expect(rows[0].id).toBe(pinned.id);

    /* أوّلُ العاديّات لا يستطيع الصعودَ فوق المثبَّتة. */
    expect(await moveRule(plain[0].id, -1)).toBe(false);
    expect((await getRule(plain[0].id)).pinned).toBeFalsy();

    await toggleRulePin(pinned.id);
    expect((await getRule(pinned.id)).pinned).toBeFalsy();
  });

  it('و`moveAffordance` تصف ما يستطيعه السهم فعلًا', async () => {
    const rows = await mine();
    expect(moveAffordance(rows, rows[0]).up).toBe(false);
    expect(moveAffordance(rows, rows[0]).down).toBe(true);
    expect(moveAffordance(rows, rows[rows.length - 1]).down).toBe(false);
  });
});

/* ================================================================== *
 * ٤) البحث (بند 38)
 * ================================================================== */

describe('WS-B · البحث', () => {
  it('يبحث في العنوان والنصّ والوسوم — ومحلّيًّا بلا شبكة', async () => {
    const row = await mkRule('بحث', { text: 'المجهور والمهموس', tags: ['صوتيّات'] });
    const rows = await mine();

    expect(searchRules(rows, 'المهموس').some((one) => one.id === row.id)).toBe(true);
    expect(searchRules(rows, 'صوتيّات').some((one) => one.id === row.id)).toBe(true);
    expect(searchRules(rows, 'بحث').some((one) => one.id === row.id)).toBe(true);
    expect(searchRules(rows, 'كلمةٌ لا توجد').length).toBe(0);
  });

  it('وبحثٌ فارغٌ يعيد كلَّ شيء لا لا شيء', async () => {
    const rows = await mine();
    expect(searchRules(rows, '   ').length).toBe(rows.length);
  });
});

/* ================================================================== *
 * ٥) الصور — العلاقةُ تُحذَف والبايتاتُ تبقى (بندا 10 و59)
 * ================================================================== */

describe('WS-B · صورُ القاعدة', () => {
  it('الصورةُ تُخزَّن في `media` والعضويّةُ علاقةٌ `rule:media`', async () => {
    const rule = await mkRule('بصورة');
    const pic = await addRuleImage(rule.id, tinyPng());

    expect(pic.kind).toBe(REFERENCE_IMAGE_KIND);
    const links = await relationships.byIndex('from_kind', [rule.id, RULE_MEDIA]);
    expect(links.length).toBe(1);
    expect(links[0].toId).toBe(pic.id);

    const pics = await ruleImages(rule.id);
    expect(pics.map((one) => one.id)).toEqual([pic.id]);
  });

  it('وحذفُ القاعدة لا يمسّ بايتاتِ صورتها (بند 10)', async () => {
    const rule = await mkRule('حذفٌ بصورة');
    const pic = await addRuleImage(rule.id, tinyPng());

    await trashRule(rule.id);
    const still = await media.get(pic.id);
    expect(still.state).toBe(STATE.ACTIVE);
    expect(Boolean(still.blob)).toBe(true);

    /* والتراجعُ يعيد البطاقةَ بصورتها لأن العلاقةَ لم تُمَسّ. */
    await restoreRule(rule.id);
    expect((await ruleImages(rule.id)).length).toBe(1);
  });

  it('وصورةٌ واحدةٌ تخدم قاعدتين بلا نسخِ بايتات (بند 59)', async () => {
    const a = await mkRule('مشتركة-أ');
    const b = await mkRule('مشتركة-ب');
    const pic = await addRuleImage(a.id, tinyPng());
    await attachRuleImage(b.id, pic.id);

    expect((await ruleImages(b.id)).map((one) => one.id)).toEqual([pic.id]);

    /* فكُّ إحداهما لا يفكّ الأخرى ولا يحذف البايتات. */
    await detachRuleImage(a.id, pic.id);
    expect((await ruleImages(a.id)).length).toBe(0);
    expect((await ruleImages(b.id)).length).toBe(1);
    expect((await media.get(pic.id)).state).toBe(STATE.ACTIVE);
  });

  it('و`rulesWithImages` تجمع الصورَ بلا استعلامٍ لكلّ قاعدة', async () => {
    const rows = (await rulesWithImages()).filter((one) => (one.title || '').startsWith(TAG));
    /* كلُّ صفٍّ يحمل `images` — ولو فارغة، فلا تفحص الشاشةُ الوجود. */
    for (const row of rows) expect(Array.isArray(row.images)).toBe(true);
    const withPic = rows.find((one) => one.images.length);
    expect(Boolean(withPic)).toBe(true);
  });

  it('والصورُ المرجعيّةُ الحرّةُ تظهر في نفس القائمة (بند 17)', async () => {
    const free = await addReferenceImage(tinyPng('free.png'));
    const all = await listReferenceImages();
    expect(all.some((one) => one.id === free.id)).toBe(true);
    /* وصورُ القواعد منها أيضًا — نفسُ `kind`. */
    expect(all.every((one) => one.kind === REFERENCE_IMAGE_KIND)).toBe(true);
  });
});

/* ================================================================== *
 * ٦) الملفّ — عامٌّ وثابت (بنود 19-23)
 * ================================================================== */

describe('WS-B · ملخّصُ القواعد', () => {
  it('يُخزَّن في `media` بنوعِ مستندٍ لا صورة، والفعّالُ مفتاحٌ عامّ', async () => {
    const row = await setActiveDoc(fakePdf('قواعدي.pdf'));
    expect(row.kind).toBe(REFERENCE_DOC_KIND);
    expect(row.mime).toBe('application/pdf');

    const stored = await settings.get(REF_KEY.DOC, null);
    expect(stored.mediaId).toBe(row.id);

    /* ⚠️ **ولا `sceneId` عليه** — وهو مِلاكُ «عامّ» كلِّه (بند 23). */
    expect(row.sceneId === undefined || row.sceneId === null).toBe(true);

    const live = await activeDoc();
    expect(live.id).toBe(row.id);
  });

  it('واستبدالُه يعيد الصفحةَ إلى 1 — «صفحة 17» وعدٌ في ملفٍّ بعينه', async () => {
    await patchView({ doc: { page: 17, zoom: 2, fit: FIT.FREE } });
    expect((await readView()).doc.page).toBe(17);

    await setActiveDoc(fakePdf('غيره.pdf'));
    const view = await readView();
    expect(view.doc.page).toBe(1);
    expect(view.doc.fit).toBe(FIT.WIDTH);
  });

  it('واختيارُ ملفٍّ مخزَّنٍ سلفًا لا يرفع بايتاتٍ ثانية (بند 59)', async () => {
    const first = await setActiveDoc(fakePdf('أ.pdf'));
    await setActiveDoc(fakePdf('ب.pdf'));
    const before = (await listDocs()).length;

    await chooseDoc(first.id);
    expect((await activeDoc()).id).toBe(first.id);
    expect((await listDocs()).length).toBe(before);
  });

  it('وملفٌّ اختفى يُرجِع `null` ولا يرمي (بند 58)', async () => {
    const row = await setActiveDoc(fakePdf('سيختفي.pdf'));
    await media.trash(row.id);
    expect(await activeDoc()).toBe(null);
    /* والمفتاحُ باقٍ — فاسترجاعٌ من السلّة يعيده بلا إعادة إرفاق. */
    expect(Boolean((await settings.get(REF_KEY.DOC, null))?.mediaId)).toBe(true);
  });

  it('وفكُّه يمسح المفتاح ويعيد الصفحة', async () => {
    await setActiveDoc(fakePdf('للفكّ.pdf'));
    await patchView({ doc: { page: 9 } });
    await clearActiveDoc({ deleteBytes: true });

    expect(await activeDoc()).toBe(null);
    expect(await settings.get(REF_KEY.DOC, null)).toBe(null);
    expect((await readView()).doc.page).toBe(1);
  });
});

/* ================================================================== *
 * ٧) حالةُ الورشة — لكلّ تبويبٍ حالتُه (بنود 22 و26 و27)
 * ================================================================== */

describe('WS-B · حالةُ الورشة', () => {
  it('الافتراضُ «المصدر» — لا يُفتَح الملفُّ فوق التدريب (بند 26)', async () => {
    await settings.remove(REF_KEY.VIEW);
    const view = await readView();
    expect(view.tab).toBe(REF_TAB.SOURCE);
    expect(view.doc.page).toBe(1);
    expect(view.doc.fit).toBe(FIT.WIDTH);
  });

  it('وصفحةُ الملفّ تعبر الجلسات (بند 22)', async () => {
    await patchView({ doc: { page: 17, zoom: 1.5, fit: FIT.FREE, scroll: 0.4 } });
    /* قراءةٌ جديدةٌ من القاعدة — كأنّها جلسةٌ أخرى. */
    const view = await readView();
    expect(view.doc.page).toBe(17);
    expect(view.doc.zoom).toBe(1.5);
    expect(view.doc.fit).toBe(FIT.FREE);
    expect(view.doc.scroll).toBe(0.4);
  });

  it('وتبويبٌ يكتب لا يدهس حالةَ تبويبٍ آخر (بند 27)', async () => {
    await patchView({ tab: REF_TAB.RULES, rules: { openId: 'RRL_مفتوحة', query: 'نبر' } });
    await patchView({ doc: { page: 3 } });
    await patchView({ images: { openId: 'MED_صورة' } });

    const view = await readView();
    expect(view.rules.openId).toBe('RRL_مفتوحة');
    expect(view.rules.query).toBe('نبر');
    expect(view.doc.page).toBe(3);
    expect(view.images.openId).toBe('MED_صورة');
    expect(view.tab).toBe(REF_TAB.RULES);
  });

  it('وحالةٌ محفوظةٌ من نسخةٍ أقدم لا تُسقط العارض', async () => {
    /* ⚠️ صفٌّ بلا `doc` إطلاقًا — كما لو كُتب قبل أن يوجد المفتاح. */
    await settings.set(REF_KEY.VIEW, { tab: REF_TAB.DOC });
    const view = await readView();
    expect(view.doc.page).toBe(1);
    expect(view.rules.openId).toBe(null);
  });
});

/* ================================================================== *
 * ٨) الحُرّاس المعماريّون — ما لا يُكتشَف إلّا بفحص نصّ
 * ================================================================== */

describe('WS-B · الحُرّاس', () => {
  it('⚠️ ورشةُ المراجع لا تلمس المشغّلَ ولا المقطعَ الفعّال (بنود 4 و25 و46-48)', async () => {
    const code = codeOnly(await readSrc('../js/views/shadow-view.js'));
    /*
     * ⚠️ **ولا تُنهِ القطعةَ عند `/*`** — الماسحُ نزع التعليقات فلم
     *    يبق منها شيء، فتمتدّ القطعةُ إلى آخر الملفّ وتبتلع نصفَ
     *    الشاشة. (سقط هذا الحارسُ في الصواب مرّةً بهذا بالضبط.)
     */
    const render = bodyOf(code, 'async function renderWells()', 'function wellScroller');
    const open = bodyOf(code, 'async function openWell(', 'function rulesWellHtml');

    expect(render.length > 200).toBe(true);
    expect(open.length > 40).toBe(true);
    expect(open.length < 900).toBe(true);

    for (const banned of [
      'exitExternalText',   // النصُّ الخارجيّ يبقى (بند 46)
      'exitPhrase',         // المقطعُ المحدَّد يبقى (بند 47)
      'setPractice',        // النطاقُ لا يعود إلى «جملة»
      'player.',            // لا لمسَ للمشغّل
      'renderShadow',       // ولا إعادةَ بناءٍ للجلسة (بند 25)
      'navigate(',          // ولا تنقّلَ في المسار (بند 4)
      'releaseAudio',       // ولا إسكاتَ لما يُقرأ (بند 49)
    ]) {
      expect(`${banned}:${render.includes(banned) || open.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('وبابٌ واحدٌ لتبديل الشريط — `openWell` لا إسنادٌ متفرّق', async () => {
    const code = codeOnly(await readSrc('../js/views/shadow-view.js'));
    /*
     * ⚠️ **الإسنادُ المتفرّق هو ما يُنسي الحفظ.** لو كتب أحدُهم غدًا
     *    `well = 'doc'` في مكانٍ آخر لَتبدّل الشريطُ بلا أن تُحفظ
     *    الحالةُ ولا يُحفَظ موضعُ التمرير — عطبٌ صامت.
     */
    /* ⚠️ و`=` وحدَها لا `==`: `well === 'source'` مقارنةٌ لا إسناد. */
    const writes = code.match(/(?<![\w.])well\s*=(?!=)/g) || [];
    /*
     * ثلاثةٌ مشروعة: التصريحُ الأوّل، وترميمُ التبويب المحفوظ عند فتح
     * الجلسة، والإسنادُ داخل `openWell`.
     */
    expect(writes.length).toBe(3);
  });

  it('وعارضُ الملفّ لا يعرف الصوتَ ولا المؤقّتاتِ الحيّة (بندا 49 و50)', async () => {
    const code = codeOnly(await readSrc('../js/components/pdf-viewer.js'));
    for (const banned of ['speechSynthesis', 'AudioContext', 'new Audio', 'setInterval']) {
      expect(`${banned}:${code.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('ولا يعرف قاعدةَ البيانات — يأخذ بايتاتٍ ويردّ حالة', async () => {
    const code = codeOnly(await readSrc('../js/components/pdf-viewer.js'));
    expect(code.includes('repositories.js')).toBe(false);
    expect(code.includes('reference-service')).toBe(false);
  });

  it('والمكتبةُ تُستورَد كسلًا لا في رأس الملفّ (بند 57)', async () => {
    const code = codeOnly(await readSrc('../js/components/pdf-viewer.js'));
    /* لا `import ... from 'vendor'` ساكن — والاستيرادُ نداءٌ لا جملة. */
    expect(/^import[^\n]*vendor/m.test(code)).toBe(false);
    expect(/\bimport\s*\(/.test(code)).toBe(true);

    const view = codeOnly(await readSrc('../js/views/shadow-view.js'));
    expect(/^import[^\n]*pdf-viewer/m.test(view)).toBe(false);
    expect(view.includes("await import('../components/pdf-viewer.js')")).toBe(true);
  });

  it('ومستنداتُ المستخدم ليست أصولَ بناءٍ تُخزَّن مسبقًا (بند 43)', async () => {
    const sw = await readSrc('../service-worker.js');
    const shell = sw.slice(sw.indexOf('const SHELL = ['), sw.indexOf('];', sw.indexOf('const SHELL = [')));

    /* المكتبةُ المورَّدة ليست في التخزين المسبق — تُجلَب عند أوّل حاجة. */
    expect(shell.includes('vendor')).toBe(false);
    expect(shell.includes('pdfjs')).toBe(false);
    /* لكنّها تُخزَّن «الكاش أوّلًا» بعد أوّل جلبة، فتعمل بلا شبكة (بند 42). */
    expect(sw.includes('isVendor')).toBe(true);
  });

  it('ونصُّ القاعدة يُهرَّب قبل أن يصير فقرات (بند 37)', async () => {
    const code = codeOnly(await readSrc('../js/views/shadow-view.js'));
    const fn = bodyOf(code, 'function paragraphs(', '\n/*');
    expect(fn.includes('esc(')).toBe(true);
  });

  it('ولا تُخلَط ملفّاتُ المنهج بملفّك (بند 44)', async () => {
    const code = codeOnly(await readSrc('../js/services/reference-service.js'));
    /* خدمةُ المراجع لا تعرف المنهجَ ولا محرّكَ النطق. */
    expect(code.includes('curriculum')).toBe(false);
    expect(code.includes('pronunciation')).toBe(false);
  });

  it('ولا OCR ولا تحليلَ آليًّا للملفّ (بند 45)', async () => {
    const ref = codeOnly(await readSrc('../js/services/reference-service.js'));
    const pdf = codeOnly(await readSrc('../js/components/pdf-viewer.js'));
    for (const banned of ['extractText', 'ocr', 'analyze']) {
      expect(`${banned}:${ref.includes(banned) || pdf.includes(banned)}`).toBe(`${banned}:false`);
    }
  });
});

/* ================================================================== *
 * ٩) التنظيف — لا يبقى أثرٌ لهذا التشغيل
 * ================================================================== */

describe('WS-B · تنظيف', () => {
  it('يمحو قواعدَ الاختبار وصورَها ومفاتيحَه', async () => {
    for (const row of await referenceRules.getAll()) {
      if (!(row.title || '').startsWith(TAG)) continue;
      const links = await relationships.byIndex('from_kind', [row.id, RULE_MEDIA]);
      for (const link of links) {
        await media.destroy(link.toId).catch(() => {});
        await relationships.destroy(link.id).catch(() => {});
      }
      await referenceRules.destroy(row.id);
    }

    for (const row of await media.byIndex('kind', REFERENCE_DOC_KIND)) {
      await media.destroy(row.id).catch(() => {});
    }
    await settings.remove(REF_KEY.DOC);
    await settings.remove(REF_KEY.VIEW);

    expect((await mine()).length).toBe(0);
    expect(await activeDoc()).toBe(null);
  });
});

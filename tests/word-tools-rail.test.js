/**
 * LingoLife — أدواتُ الكلمة والسكّةُ مفتوحة (WS-DV4)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العطبُ — وتصحيحُ تشخيصٍ سابقٍ لي
 * ═══════════════════════════════════════════════════════════════
 *
 * بُلِّغ العطبُ بوصفِه «أدواتُ الكلمة لا تعمل **أثناء تدريب المسودّة**»،
 * وأنا نفسي أكّدتُ ذلك في تمريرةٍ سابقة بعد أن جرّبتُ المصدرَ الأصليَّ
 * والسكّةُ **مغلقة** ثمّ التدريبَ والسكّةُ **مفتوحة** — فقارنتُ حالين
 * يختلفان في متغيّرين وعزوتُ الفرقَ إلى أحدهما.
 *
 * والقياسُ الصحيحُ بأربع حالات:
 *
 *     أصليّ · سكّةٌ مغلقة   → span.sh-chip-w   ✓
 *     أصليّ · سكّةٌ مفتوحة  → div.sh-scrim     ✗
 *     تدريب · سكّةٌ مفتوحة  → div.sh-scrim     ✗
 *     تدريب · سكّةٌ مغلقة   → span.sh-chip-w   ✓
 *
 * فالفاصلُ **حالُ السكّة لا نوعُ المقطع**. و`.sh-scrim` بـ`inset: 0`
 * و`pointer-events: auto` كان يغطّي الكتابَ كلَّه، فلا تصل لمسةٌ إلى
 * رقاقة كلمة. أي أنّ أدواتِ الكلمة كلَّها كانت متعذّرةً كلّما كانت
 * السكّةُ مفتوحة — وهي مفتوحةٌ افتراضًا في تدريب المسودّة، فبدا
 * العطبُ خاصًّا بها.
 *
 * ⚠️ **ودليلُ أنّه معروفٌ من قبل**: `beginPhrase` تُغلق السكّةَ صراحةً
 *    بتعليقٍ يقول إنّ «كلَّ لمسةٍ على كلمةٍ تُغلق السكّةَ ولا تصل إلى
 *    الرقاقة». عولج العرَضُ موضعيًّا ولم يُعالَج سببُه.
 */

import { describe, it, expect } from './test-runner.js';

let VIEW = '';
let CSS = '';
const view = async () => {
  if (!VIEW) VIEW = await (await fetch('../js/views/shadow-view.js')).text();
  return VIEW;
};
const css = async () => {
  if (!CSS) CSS = await (await fetch('../css/shadow.css')).text();
  return CSS;
};

describe('WS-DV4 · الحجابُ يُرى ولا يُمسك', () => {
  it('١ · الحجابُ لا يلتقط اللمسَ حين تُفتَح السكّة', async () => {
    const text = await css();
    /*
     * ⚠️ الحارسُ يقيس القاعدةَ نفسَها لا وجودَ الصنف: عودةُ
     *    `pointer-events: auto` إليها تُعيد العطبَ كما كان.
     */
    const rule = text.match(/\.shadow-app\.is-rail \.sh-scrim \{[^}]*\}/);
    expect(Boolean(rule)).toBe(true);
    expect(rule[0].includes('pointer-events: auto')).toBe(false);
    expect(rule[0].includes('opacity: 1')).toBe(true);
  });

  it('٢ · ورقاقةُ الكلمة تمرّ فلا تُغلِق السكّة', async () => {
    const src = await view();
    expect(src).toContain("!event.target.closest('[data-word]')");
  });

  it('٣ · واللمسُ خارجَها يُغلقها — كما كان الحجابُ يفعل', async () => {
    const src = await view();
    expect(src).toContain('if (rail.open');
    /* ⚠️ والسكّةُ صارت عنقودَ الحافّة (WS-TOOLS-LAYOUT · بند ٤) — والشرطُ
          هو هو: لا يُغلَق اللوحُ بلمسةٍ على بابٍ من أبوابه. */
    expect(src).toContain("!event.target.closest('.sh-edge')");
    expect(src).toContain("!event.target.closest('.sh-panel')");
  });

  it('٤ · ⚠️ والتحكّمُ مستثنًى — انحدارٌ أحدثتُه ثمّ أمسكتُه', async () => {
    /*
     * ⚠️ أوّلُ كتابةٍ لهذا الحارس أغلقت السكّةَ عند لمس «التالي»
     *    فلم ينقّل. و`.sh-transport` و`.sh-modes` مرفوعان فوق الحجاب
     *    بـ`z-index: 12` عمدًا (WS31 ثمّ WS44) — والحارسُ يجب أن
     *    يحاكيَ ما كان الحجابُ يغطّيه لا أكثر.
     */
    const src = await view();
    expect(src).toContain("!event.target.closest('.sh-transport')");
    expect(src).toContain("!event.target.closest('.sh-modes')");

    const text = await css();
    /*
     * ⚠️ **ولـ`.sh-modes, .sh-transport` كتلتان في التنسيق**: واحدةٌ
     *    للالتصاق وأخرى للرفع. وأوّلُ صياغةٍ لهذا الحارس التقطت الأولى
     *    فسقط وهو مُحقّ. فيُطلَب الرفعُ بعينه لا أوّلُ كتلةٍ تحمل الاسم.
     */
    const lifted = text.match(/\.sh-modes,\s*\n\s*\.sh-transport \{[^}]*\}/g) || [];
    expect(lifted.some((one) => one.includes('z-index: 12'))).toBe(true);
  });

  it('٥ · ولا أداةَ كلمةٍ جديدة — الأدواتُ القائمة كما هي', async () => {
    const src = await view();
    /*
     * ⚠️ الطلبُ كان «افتح **نفسَ** الأدوات» — فلا يجوز أن تولد أداةٌ
     *    خامسةٌ باسمٍ جديد. هذه الأربعةُ مشروطةٌ بـ`hasPickedWord`
     *    وحدَها، وهي نفسُها قبل هذه التمريرة وبعدها.
     */
    for (const id of ['hear', 'save', 'meaning', 'pron']) {
      expect(src).toContain(`{ id: '${id}',`);
    }
  });

  it('٦ · وتحليلُ النطق يمرّ بالخدمة القائمة لا بنسخةٍ ثانية', async () => {
    const src = await view();
    /*
     * ⚠️ **وعدُّ الاستيرادات ليس مقياسًا**: أوّلُ صياغةٍ اشترطت استيرادًا
     *    واحدًا من `services/pronunciation/`، وهناك خمسةٌ — وكلُّها
     *    **إعادةُ استعمالٍ** لا ازدواج. فالمقياسُ الصحيح: أن يكون
     *    التحليلُ مستوردًا من خدمته، وألّا تُعرَّف في الشاشة دالّةٌ
     *    تحليلٍ ثانية تحمل نفس المسؤوليّة.
     */
    expect(src).toContain("import { analyzePronunciation } from '../services/pronunciation/analysis.js'");
    expect(src.includes('function analyzePronunciation')).toBe(false);
  });

  it('٧ · والسكّةُ تبقى مفتوحةً بعد مسك الكلمة — لا تُغلَق', async () => {
    const src = await view();
    /* المسكُ المطوّل يفتح سياقَ الكلمة داخل نفس السكّة. */
    const at = src.indexOf('long = true;');
    const body = src.slice(at, at + 320);
    expect(body.includes('rail.open = true')).toBe(true);
    expect(body.includes("rail.tool = 'hear'")).toBe(true);
  });

  it('٨ · ونقلةُ الهدف تُنسي الكلمةَ — فلا أدواتُ كلمةٍ غادرتها', async () => {
    const src = await view();
    /* `syncSegment` تُصفّر `rail.word` عند كلّ نقلة. */
    expect(src).toContain('rail.word = -1;');
  });

  it('٩ · والنسبُ لا يُمَسّ من فتح أدوات الكلمة', async () => {
    const src = await view();
    /*
     * ⚠️ `draftLineage` تقرأ المقطعَ نفسَه؛ ولا شيءَ في مسار الكلمة
     *    يكتب `draftId` أو `targetId`. فلو ظهرت كتابةٌ لهما خارج
     *    وسمَي الإنشاء لَانكسر هذا الحارس.
     */
    /*
     * ⚠️ **وعدُّ ظهورِ `targetId:` في الملفّ كلِّه ليس مقياسًا — أمسكه
     *    انحدارٌ كاذب.** كانت أوّلُ صياغةٍ تشترط «ثلاثةً لا أكثر»، فسقط
     *    الحارسُ حين أضافت WS-DI قارئًا جديدًا للنسب (`activeDraftModel`)
     *    — وهو **قراءةٌ** لا كتابة. فالعددُ كان يعدّ سطورًا لا يعدّ
     *    كتابات، وهو نفسُ عيبِ «عدُّ الاستيرادات» في الحارس ٦.
     *
     *    فالمقياسُ صار على الشيء نفسِه: النسبُ يُكتَب في **وسمَي
     *    الإنشاء** وحدَهما، ولا يُكتَب في مسار الكلمة البتّة.
     */
    const stamps = (src.match(/stamp: \([^)]*\) => \(\{ \.\.\.seg,[^)]*targetId/g) || []).length;
    expect(stamps).toBe(2);
    /* والثالثُ يسم المسودّةَ وحدَها (مراجعةُ جملها) — فلا هدفَ له. */
    expect((src.match(/stamp: \([^)]*\) => \(\{ \.\.\.seg,/g) || []).length).toBe(3);

    /* ولا سطرَ في مسار الكلمة يمسّ النسب. */
    const at = src.indexOf('long = true;');
    const body = src.slice(at, src.indexOf('}, 420);', at));
    expect(body.includes('targetId')).toBe(false);
    expect(body.includes('draftId')).toBe(false);
  });

  it('١٠ · و`beginPhrase` تبقى تُغلق السكّة — سلوكٌ مقصودٌ لا أثرٌ للعطب', async () => {
    const src = await view();
    /*
     * ⚠️ إغلاقُها هناك ليس التفافًا على الحجاب فحسب: وضعُ المقطع
     *    يحتاج الشاشةَ كلَّها لتحديد مدًى بالإصبع. فيبقى كما هو،
     *    ويُذكَر هنا صراحةً حتى لا يُزال ظنًّا أنّه من بقايا العطب.
     */
    const at = src.indexOf('function beginPhrase()');
    const body = src.slice(at, at + 800);
    expect(body.includes('rail.open = false;')).toBe(true);
  });

  it('١١ · ومسارُ الكلمة لا يكتب شيئًا — لا هدفًا ولا دليلًا ولا مراجعة', async () => {
    const src = await view();
    /*
     * ⚠️ الحارسُ يقيس **جسمَ المسك المطوّل نفسَه** لا أثرًا جانبيًّا:
     *    فتحُ أدوات الكلمة رسمٌ خالص — `rail.*` و`paintWordPick`
     *    و`renderRail`. وأيُّ كتابةٍ تدخل هنا تعني `rev++` و`dirty=1`
     *    لكلّ كلمةٍ تمسكها، وهي تسافر على الشبكة في المزامنة.
     *
     *    ولذلك يُقاس الجسمُ حرفيًّا: لا `await` ولا `update(` ولا
     *    `put(` ولا `record`/`save` — والقياسُ ينكسر لو أُقحمت.
     */
    const at = src.indexOf('long = true;');
    const body = src.slice(at, src.indexOf('}, 420);', at));
    for (const write of ['await', '.update(', '.put(', 'record', 'save']) {
      expect(body.includes(write)).toBe(false);
    }
    /* ولا `paintWordPick` نفسُها تكتب: تُبدّل صنفًا في الـDOM لا أكثر. */
    const pick = src.indexOf('function paintWordPick(at) {');
    expect(src.slice(pick, pick + 200).includes('classList.toggle')).toBe(true);
  });
});

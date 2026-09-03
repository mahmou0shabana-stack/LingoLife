/**
 * LingoLife — قراءةُ نصّ البرومبت (WS-PL · بنود ١٩ إلى ٢٦ و٥١ و٥٢ و٦٢ إلى ٦٤)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الخطرُ الذي تحرسه هذه الملفّات
 * ═══════════════════════════════════════════════════════════════
 *
 * البرومبتُ ليس «محتوًى» تعرضه الشاشة كما تشاء — هو **نصٌّ ستلصقه في
 * ChatGPT حرفًا بحرف**. فأيُّ لمسةٍ تجميليّةٍ تقع عليه في الطريق —
 * `trim` صغير، أو تطبيعُ مسافة، أو مُصيِّرُ Markdown يبتلع `#` و`*` —
 * تخرج من الحافظة نصًّا **ليس** الذي بنيتَه.
 *
 * فهذه الاختباراتُ تحرس ثلاثةَ أشياءَ لا رابعَ لها:
 *
 *   ١) **الكشفُ متحفّظ**: ما شككنا فيه يبقى نصًّا، لا يصير حقلًا.
 *   ٢) **التعبئةُ خالصة**: `fillTemplate` تعيد نسخةً ولا تلمس مصدرَها.
 *   ٣) **المخطَّطُ للتنقّل لا للتنسيق**: يقرأ العناوينَ ولا يغيّر سطرًا.
 *
 * ⚠️ **وقاعدةُ ٤ هي أخطرُ ما هنا**: «Runtime placeholder values must not
 *    corrupt saved templates». ولذلك لا يكفي أن يكون الناتجُ صحيحًا —
 *    يُفحَص **المصدرُ نفسُه بعد النداء** في اختبارٍ مستقلّ.
 */

import { describe, it, expect } from './test-runner.js';
import {
  findPlaceholders, fillTemplate, unfilledCount,
  outlineOf, blockDir, readingBlocks,
} from '../js/services/prompts/prompt-text.js';

/* برومبتٌ على شكل برومبتاتك الحقيقيّة — لا مثالٌ نظيفٌ مخترَع. */
const CORE = [
  'مسودة — Core Chunks', '',
  '§1 الهدف:', '',
  'حوّل الجملة الروسية لـ Core Chunks جاهزة للشادوينج.', '',
  '━━━━━━━━━━━━━━', '',
  '§2 المدخلات:', '',
  '[ضع الجملة الروسية هنا]', '',
  '[ضع الترجمة هنا]', '',
  '§3 القواعد:', '',
  '1. لا تخترع كلمات.',
  '2. حافظ على النبر: сотру́дник', '',
  'FINAL DIRECTIVE', '',
  'رجّع الناتج كما هو بدون شرح.',
].join('\n');

/* ================================================================== */
describe('WS-PL · كشفُ المتغيّرات متحفّظ (بندا ١٩ و٢٠)', () => {
  it('١ · يجد الحقولَ البشريّةَ بأسمائها', () => {
    const found = findPlaceholders(CORE).map((one) => one.name);
    expect(found).toEqual(['ضع الجملة الروسية هنا', 'ضع الترجمة هنا']);
  });

  it('٢ · لا يقرأ رابطَ Markdown حقلًا', () => {
    expect(findPlaceholders('شوف [الدليل الكامل](https://x.dev) هنا')).toHaveLength(0);
  });

  it('٣ · لا يقرأ فهرسةَ مصفوفةٍ حقلًا', () => {
    expect(findPlaceholders('rows[userName] و data[0]')).toHaveLength(0);
  });

  it('٤ · لا يقرأ صنفَ تعبيرٍ منتظمٍ حقلًا', () => {
    expect(findPlaceholders('الصيغة /^[a-z]+[0-9]$/ لازم تتحقق')).toHaveLength(0);
  });

  it('٥ · لا يقرأ مرجعًا لاتينيًّا قصيرًا حقلًا', () => {
    expect(findPlaceholders('راجع [1] و[ref] و[TODO]')).toHaveLength(0);
  });

  it('٦ · لا يقرأ قوسًا فيه رموزٌ وحدَها حقلًا', () => {
    expect(findPlaceholders('الشكل [ ... ] و[ - ] و[123]')).toHaveLength(0);
  });

  it('٧ · الظهورُ المتكرِّرُ حقلٌ واحدٌ بمواضعَ كثيرة', () => {
    const found = findPlaceholders('[الاسم] ثم [الاسم] مرّةً أخرى');
    expect(found).toHaveLength(1);
    expect(found[0].at).toHaveLength(2);
  });

  it('٨ · قوسٌ مفتوحٌ بلا نظيرٍ لا يبتلع بقيّةَ النصّ', () => {
    /* ⚠️ لولا `[^[\]\n]` لالتهم القوسُ الأوّلُ كلَّ ما بعده. */
    const found = findPlaceholders('[ضع الجملة هنا\nسطر تاني [الترجمة هنا]');
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('الترجمة هنا');
  });
});

/* ================================================================== */
describe('WS-PL · التعبئةُ خالصةٌ والقالبُ لا يُمَسّ (بندا ٢١ و٥٤ · قاعدة ٤)', () => {
  it('٩ · تملأ ما أعطيتَه', () => {
    const out = fillTemplate(CORE, { 'ضع الجملة الروسية هنا': 'Он прие́хал.' });
    expect(out).toContain('Он прие́хал.');
  });

  it('١٠ · وتترك ما لم تملأه ظاهرًا لا فراغًا', () => {
    const out = fillTemplate(CORE, { 'ضع الجملة الروسية هنا': 'Он прие́хал.' });
    expect(out).toContain('[ضع الترجمة هنا]');
  });

  it('١١ · القالبُ الأصليُّ بعد النداء هو هو — حرفًا بحرف', () => {
    /*
     * ⚠️ **هذا هو الاختبارُ الذي تقوم عليه قاعدةُ ٤ كلُّها.** فحصُ الناتج
     *    وحدَه لا يكفي: دالّةٌ تكتب في مصدرها ثمّ تعيده تنجح فيه وتُفسد
     *    مكتبتَك. فالمقياسُ هنا **المصدرُ بعد النداء** لا الناتج.
     */
    const before = CORE;
    fillTemplate(CORE, { 'ضع الجملة الروسية هنا': 'س', 'ضع الترجمة هنا': 'ص' });
    expect(CORE).toBe(before);
  });

  it('١٢ · النداءُ مرّتين بنفس القيم يعطي نفسَ الناتج', () => {
    const values = { 'ضع الترجمة هنا': 'وصل الموظّف.' };
    expect(fillTemplate(CORE, values)).toBe(fillTemplate(CORE, values));
  });

  it('١٣ · قيمةٌ فارغةٌ أو مسافاتٌ لا تمحو الحقل', () => {
    const out = fillTemplate(CORE, { 'ضع الترجمة هنا': '   ' });
    expect(out).toContain('[ضع الترجمة هنا]');
  });

  it('١٤ · التعبئةُ لا تلمس ما ليس حقلًا', () => {
    const src = 'شوف [الدليل](https://x.dev) و rows[i]';
    expect(fillTemplate(src, { الدليل: 'ص', i: 'ع' })).toBe(src);
  });

  it('١٥ · بلا قيمٍ إطلاقًا يعود النصُّ كما هو', () => {
    expect(fillTemplate(CORE)).toBe(CORE);
  });

  it('١٦ · عدُّ ما بقي بلا قيمةٍ حقيقيٌّ لا مُقدَّر', () => {
    expect(unfilledCount(CORE)).toBe(2);
    expect(unfilledCount(CORE, { 'ضع الترجمة هنا': 'وصل.' })).toBe(1);
  });

  it('١٧ · المسافاتُ البادئةُ والأسطرُ الفارغةُ تنجو من التعبئة', () => {
    const src = '    سطر بمسافات\n\n\n[الحقل]\n\n   نهاية   ';
    const out = fillTemplate(src, { الحقل: 'قيمة' });
    expect(out).toBe('    سطر بمسافات\n\n\nقيمة\n\n   نهاية   ');
  });
});

/* ================================================================== */
describe('WS-PL · المخطَّطُ للتنقّل لا للتنسيق (بندا ٢٣ و٢٤)', () => {
  it('١٨ · يقرأ «§1» علامةَ قسم', () => {
    const kinds = outlineOf(CORE).filter((one) => one.kind === 'section');
    expect(kinds.length >= 3).toBeTruthy();
  });

  it('١٩ · يقرأ «FINAL DIRECTIVE» عنوانًا لاتينيًّا كبيرًا', () => {
    expect(outlineOf(CORE).map((one) => one.text)).toContain('FINAL DIRECTIVE');
  });

  it('٢٠ · يقرأ «SECTION 4» و«STEP 2» أقسامًا', () => {
    const out = outlineOf('SECTION 4\n\nنصّ\n\nSTEP 2\n\nنصّ');
    expect(out.map((one) => one.text)).toEqual(['SECTION 4', 'STEP 2']);
  });

  it('٢١ · الفاصلُ الزخرفيُّ حدٌّ لا عنوان', () => {
    expect(outlineOf(CORE).map((one) => one.text)).toEqual([
      '§1 الهدف:', '§2 المدخلات:', '§3 القواعد:', 'FINAL DIRECTIVE',
    ]);
  });

  it('٢٢ · بنودُ القائمة المتلاصقةُ ليست أقسامًا', () => {
    /* ⚠️ «1. …» و«2. …» متلاصقان — قائمةٌ لا قسمان (وهما في CORE). */
    const texts = outlineOf(CORE).map((one) => one.text);
    expect(texts.includes('1. لا تخترع كلمات.')).toBeFalsy();
  });

  it('٢٣ · والسطرُ المرقَّمُ الواقفُ وحدَه قسمٌ', () => {
    const out = outlineOf('١) الهدف\n\nنصّ طويل هنا\n\n٢) القواعد\n\nنصّ');
    expect(out).toHaveLength(2);
  });

  it('٢٤ · الفقرةُ الطويلةُ ليست عنوانًا مهما بدت', () => {
    const long = `القواعد: ${'كلمة '.repeat(30)}`;
    expect(outlineOf(long)).toHaveLength(0);
  });

  it('٢٥ · يقبل عنوانَ Markdown ولا يفرضه', () => {
    const out = outlineOf('## المدخلات\n\nنصّ');
    expect(out[0].text).toBe('المدخلات');
  });

  it('٢٦ · رقمُ السطر حقيقيٌّ يُقاد به التنقّل', () => {
    const out = outlineOf(CORE);
    expect(CORE.split('\n')[out[0].line]).toBe('§1 الهدف:');
  });
});

/* ================================================================== */
describe('WS-PL · الاتّجاهُ بالغلبة لا بالأوّل (بندا ٢٥ و٢٦)', () => {
  it('٢٧ · فقرةٌ عربيّةٌ تبدأ برقمٍ تبقى يمينًا', () => {
    /* ⚠️ `dir="auto"` وحدَها تحكم بأوّل حرفٍ ذي اتّجاه — فتقلبها. */
    expect(blockDir('§1 الهدف من هذا القسم شرحُ القاعدة')).toBe('rtl');
  });

  it('٢٨ · فقرةٌ روسيّةٌ فيها كلمةٌ عربيّةٌ تبقى يسارًا', () => {
    expect(blockDir('Сотру́дник прие́хал в о́фис ра́но (موظّف)')).toBe('ltr');
  });

  it('٢٩ · فقرةٌ بلا حروفٍ تعود يمينًا افتراضًا', () => {
    expect(blockDir('123 --- 456')).toBe('rtl');
  });

  it('٣٠ · القسمةُ إلى كتلٍ لا تغيّر حرفًا', () => {
    const blocks = readingBlocks(CORE);
    expect(blocks.map((one) => one.text).join('\n\n')).toBe(CORE);
  });

  it('٣١ · ولكلّ كتلةٍ اتّجاهُها المستقلّ', () => {
    const blocks = readingBlocks('نصّ عربيّ كامل\n\nСотру́дник прие́хал в о́фис');
    expect(blocks.map((one) => one.dir)).toEqual(['rtl', 'ltr']);
  });

  it('٣٢ · نصٌّ فارغٌ لا كتلَ له', () => {
    expect(readingBlocks('')).toHaveLength(0);
  });
});

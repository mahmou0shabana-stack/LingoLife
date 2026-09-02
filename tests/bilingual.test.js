/**
 * LingoLife — الأزواج الثنائيّة: روسيٌّ ↔ عربيّ (WS-D)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما تحرسه هذه الاختبارات
 * ═══════════════════════════════════════════════════════════════
 *
 * الوعدُ في WS-D ليس «العربيّ يظهر»، بل:
 *
 *     الترجمةُ **الصحيحة** ملتصقةٌ بجملتها **الصحيحة**،
 *     وما لا دليلَ عليه يُعلَن لا يُخمَّن.
 *
 * فالمحروسُ ثلاثة:
 *
 *  ١ · **ألّا يُخترَع قِران.** أخطرُ فشلٍ هنا ليس زوجًا ناقصًا بل
 *      زوجًا مخترَعًا: تراه فتصدّقه فتحفظ ترجمةً ليست ترجمته. ولذلك
 *      أكثرُ الاختبارات تفحص **الامتناع** لا الإنتاج.
 *
 *  ٢ · **ألّا يدخل العربيُّ مقطعَ تدريب.** وهو الغرضُ الأوّل من
 *      الورك-ستريم (بند ١٢).
 *
 *  ٣ · **ألّا يُفكَّ قِرانٌ بتعديل نصّ** (بند ١٩)، وألّا يتكرّر نصٌّ
 *      عربيٌّ بعد إصلاحٍ يدويّ (بند ٤٣).
 */

import { describe, it, expect } from './test-runner.js';
import {
  SCRIPT, PAIR_STATUS, ROLE,
  classifyScript, isRussian, isArabic, inlinePair,
  parseBilingual, summarize, restatus,
  attachTranslation, detachTranslation, practiceUnits,
} from '../js/services/shadow/bilingual.js';
import { draftPairs } from '../js/services/study-draft.js';

/** اختصارٌ: حالاتُ الوحدات بالترتيب. */
const statuses = (units) => units.map((u) => u.status);
/** اختصارٌ: أزواجٌ نصّيّةٌ مبسّطة للمقارنة. */
const pairs = (units) => units.map((u) => [u.ru, u.ar]);

/* ================================================================== *
 * ١) تصنيفُ الكتابة (بند ٤)
 * ================================================================== */

describe('WS-D · تصنيفُ الكتابة', () => {
  it('يميّز السيريليَّ من العربيّ', () => {
    expect(classifyScript('Во время проверки мы обнаружили.')).toBe(SCRIPT.CYRILLIC);
    expect(classifyScript('خلال الفحص اكتشفنا حالة عدم مطابقة.')).toBe(SCRIPT.ARABIC);
  });

  it('⚠️ ولا يصنّف الترقيمَ ولا الأرقامَ لغة', () => {
    /* بند ٤ صراحةً: «لا تصنّف الترقيم لغة». */
    expect(classifyScript('2025 / + / =')).toBe(SCRIPT.NEUTRAL);
    expect(classifyScript('— — —')).toBe(SCRIPT.NEUTRAL);
    expect(classifyScript('12345')).toBe(SCRIPT.NEUTRAL);
    /*
     * والأرقامُ الهنديّة تقع داخل كتلة اليونيكود العربيّة، فلولا
     * استثناؤها لصار سطرُ رقمِ صفحةٍ «جملةً عربيّة» تُقرَن بما فوقها.
     */
    expect(classifyScript('٢٠٢٥')).toBe(SCRIPT.NEUTRAL);
  });

  it('⚠️ واللاتينيّةُ والأرقامُ المغروسةُ لا تسلب الجملةَ لغتَها (بند ١٦)', () => {
    expect(classifyScript('Стандарт ISO 9001 применяется.')).toBe(SCRIPT.CYRILLIC);
    expect(classifyScript('Толщина покрытия составляет 3 мм.')).toBe(SCRIPT.CYRILLIC);
    expect(classifyScript('№ 4 и +5% в норме.')).toBe(SCRIPT.CYRILLIC);
    expect(classifyScript('سمك الطلاء 3 مم.')).toBe(SCRIPT.ARABIC);
    expect(classifyScript('المعيار ISO 9001 مطبَّق.')).toBe(SCRIPT.ARABIC);
  });

  it('والتشكيلُ لا يرجّح كفّةً', () => {
    expect(classifyScript('لا تنسَ مراجعةَ التاريخِ.')).toBe(SCRIPT.ARABIC);
  });

  it('والمختلطُ فعلًا يُعلَن مختلطًا لا يُنسَب لأحدهما', () => {
    expect(classifyScript('акт вскрытия محضر فتح')).toBe(SCRIPT.MIXED);
  });

  it('والمختصرانِ يتّفقان مع التصنيف', () => {
    expect(isRussian('Документ подписан.')).toBe(true);
    expect(isRussian('تم التوقيع.')).toBe(false);
    expect(isArabic('تم التوقيع.')).toBe(true);
    expect(isArabic('2025')).toBe(false);
  });
});

/* ================================================================== *
 * ٢) الزوجُ داخل سطرٍ واحد (بندا ١٥ و٣٨)
 * ================================================================== */

describe('WS-D · الزوجُ داخل سطر', () => {
  it('§38 «акт вскрытия — محضر فتح العبوة» تنقسم زوجًا', () => {
    expect(inlinePair('акт вскрытия — محضر فتح العبوة'))
      .toEqual({ ru: 'акт вскрытия', ar: 'محضر فتح العبوة' });
  });

  it('ويقبل النقطتين وعلامةَ المساواة بفراغٍ حولهما', () => {
    expect(inlinePair('накладная : بوليصة الشحن').ru).toBe('накладная');
    expect(inlinePair('пломба = ختم').ar).toBe('ختم');
  });

  it('⚠️ ولا يقسم روسيًّا سليمًا (بند ١٥)', () => {
    /* الطرفان روسيّان — لا زوجَ هنا. */
    expect(inlinePair('Внимание: текст важный')).toBe(null);
    /* والشرطةُ داخل الكلمة لا تُقطَع. */
    expect(inlinePair('из-за проверки')).toBe(null);
    expect(inlinePair('кто-то пришёл')).toBe(null);
  });

  it('ولا يقسم عربيًّا سليمًا', () => {
    expect(inlinePair('ملاحظة: لا تنسَ التاريخ')).toBe(null);
  });

  it('⚠️ وفاصلان في سطرٍ واحدٍ يُلغيان الثقة', () => {
    /* البنيةُ لم تعد قاطعةً: أيُّ الفاصلين هو الحدّ؟ */
    expect(inlinePair('акт — محضر — ثالث')).toBe(null);
  });
});

/* ================================================================== *
 * ٣) حالاتُ القبول الحرفيّة (بنود ٣٥…٤٠)
 * ================================================================== */

describe('WS-D · حالاتُ القبول', () => {
  it('§35 ثلاثةُ أزواجٍ متناوبة → ثلاثُ وحداتٍ مقترنة', () => {
    const { units } = parseBilingual([
      'Во время проверки мы обнаружили несоответствие.',
      'خلال الفحص اكتشفنا حالة عدم مطابقة.',
      '',
      'Документ уже полностью заполнен.',
      'تم بالفعل استكمال المستند بالكامل.',
      '',
      'Сейчас одно замечание ещё согласовывается.',
      'يوجد حاليًا ملاحظة واحدة ما زالت قيد الاعتماد.',
    ].join('\n'));

    expect(units.length).toBe(3);
    expect(statuses(units)).toEqual([
      PAIR_STATUS.PAIRED_STRONG, PAIR_STATUS.PAIRED_STRONG, PAIR_STATUS.PAIRED_STRONG,
    ]);
    expect(units[1].ru).toBe('Документ уже полностью заполнен.');
    expect(units[1].ar).toBe('تم بالفعل استكمال المستند بالكامل.');

    /* ⚠️ ولا مقطعَ تدريبٍ عربيّ — الغرضُ الأوّل (بند ١٢). */
    expect(practiceUnits(units).length).toBe(3);
    expect(practiceUnits(units).every((u) => isRussian(u.ru))).toBe(true);
  });

  it('§36 روسيٌّ بلا ترجمة → يبقى، ولا يُختلَق له عربيّ', () => {
    const { units } = parseBilingual(
      'Сначала мы провели визуальный осмотр.\nПотом проверили документы.',
    );
    expect(units.length).toBe(2);
    expect(statuses(units)).toEqual([
      PAIR_STATUS.UNPAIRED_RUSSIAN, PAIR_STATUS.UNPAIRED_RUSSIAN,
    ]);
    expect(units.every((u) => u.ar === '')).toBe(true);
  });

  it('§37 ثلاثُ روسيّاتٍ مقابل عربيّتين → مراجعةٌ لا قِران', () => {
    const { units } = parseBilingual([
      'Первое предложение.', 'Второе предложение.', 'Третье предложение.',
      '',
      'الجملة الأولى.', 'الجملة الثانية.',
    ].join('\n'));

    /* ⚠️ ولا يُقرَن أوّلُ اثنين ويُترَك الثالث — ذاك تخمينٌ بنصف دليل. */
    expect(units.every((u) => u.status === PAIR_STATUS.NEEDS_REVIEW)).toBe(true);
    expect(units.every((u) => !(u.ru && u.ar))).toBe(true);
  });

  it('§39 الملاحظةُ لا تصير ترجمةً للجملة السابقة', () => {
    const { units } = parseBilingual([
      'Документ был подписан.',
      '',
      'ملاحظة:',
      'لا تنسَ مراجعة التاريخ.',
    ].join('\n'));

    const russian = units.find((u) => u.ru);
    expect(russian.ru).toBe('Документ был подписан.');
    expect(russian.ar).toBe('');
    /* والعربيُّ باقٍ معروضًا لا محذوفًا — لكنه ليس ترجمة. */
    expect(units.some((u) => u.ar.includes('لا تنسَ'))).toBe(true);
  });

  it('§40 الأرقامُ تبقى داخل الزوج', () => {
    const { units } = parseBilingual(
      'Толщина покрытия составляет 3 мм.\nسمك الطلاء 3 مم.',
    );
    expect(units.length).toBe(1);
    expect(units[0].status).toBe(PAIR_STATUS.PAIRED_STRONG);
    expect(units[0].ru.includes('3 мм')).toBe(true);
    expect(units[0].ar.includes('3 مم')).toBe(true);
  });
});

/* ================================================================== *
 * ٤) البنيةُ الأصعب (بنود ٧ و٣٠ و٣١ و٣٣ و٣٤)
 * ================================================================== */

describe('WS-D · البنيةُ الأصعب', () => {
  it('§7 فقرتان متساويتا العدد تُقرَنان بالترتيب', () => {
    const { units } = parseBilingual(
      'Первое предложение. Второе предложение.\n\nالجملة الأولى. الجملة الثانية.',
    );
    expect(units.length).toBe(2);
    expect(statuses(units)).toEqual([
      PAIR_STATUS.PAIRED_STRUCTURAL, PAIR_STATUS.PAIRED_STRUCTURAL,
    ]);
    expect(pairs(units)[0]).toEqual(['Первое предложение.', 'الجملة الأولى.']);
  });

  it('§33 عربيٌّ ثانٍ لا يُلصَق بالترجمة', () => {
    const { units } = parseBilingual([
      'Документ подписан.',
      'تم توقيع المستند.',
      'وهذه ملاحظة إضافية طويلة عن التاريخ.',
    ].join('\n'));

    const paired = units.find((u) => u.ru);
    expect(paired.ar).toBe('تم توقيع المستند.');
    /* ⚠️ ولا يُضَمّ الثاني — «لا تدمج نصَّ الملاحظة في الترجمة صامتًا». */
    expect(paired.ar.includes('ملاحظة')).toBe(false);
    expect(units.some((u) => !u.ru && u.ar.includes('ملاحظة'))).toBe(true);
  });

  it('§34 عربيٌّ واحدٌ لعدّة روسيّاتٍ لا يُكرَّر عليها', () => {
    const { units } = parseBilingual(
      'Первое. Второе. Третье.\n\nملخص عربي واحد لكل ما سبق.',
    );
    /* لا تُنسَخ نفسُ الجملة العربيّة على ثلاثة مقاطع. */
    const withAr = units.filter((u) => u.ar);
    expect(withAr.length).toBe(1);
    expect(units.every((u) => u.status === PAIR_STATUS.NEEDS_REVIEW)).toBe(true);
  });

  it('§30 عنوانٌ عربيٌّ لا يُقرَن بما قبله', () => {
    const { units } = parseBilingual(
      'المستندات\n\nДокумент подписан.\nتم توقيع المستند.',
    );
    const head = units[0];
    expect(head.ru).toBe('');
    expect(head.ar).toBe('المستندات');
    /* والزوجُ الحقيقيُّ بعده سليم. */
    expect(units[1].ru).toBe('Документ подписан.');
    expect(units[1].ar).toBe('تم توقيع المستند.');
  });

  it('§31 عنوانٌ روسيٌّ لا يبتلع الفقرةَ العربيّةَ بعده', () => {
    const { units } = parseBilingual('Документы\n\nتم توقيع المستند.');
    const head = units.find((u) => u.ru === 'Документы');
    expect(Boolean(head)).toBe(true);
    expect(head.ar).toBe('');
  });

  it('§32 وترتيبُ المصدر لا يُعاد', () => {
    const { units } = parseBilingual([
      'Первое.', 'الأولى.', '', 'Второе.', 'الثانية.', '', 'Третье.', 'الثالثة.',
    ].join('\n'));
    expect(units.map((u) => u.ru)).toEqual(['Первое.', 'Второе.', 'Третье.']);
  });
});

/* ================================================================== *
 * ٥) التعديلُ اليدويّ (بنود ١٩ و٢٠ و٤٢ و٤٣)
 * ================================================================== */

describe('WS-D · التعديلُ اليدويّ', () => {
  it('§42 تعديلُ النصّ لا يفكّ القِران', () => {
    const one = {
      ru: 'Документ подписан.', ar: 'تم التوقيع.', status: PAIR_STATUS.PAIRED_STRONG,
    };
    /* الروسيُّ يُصحَّح… */
    const a = restatus({ ...one, ru: 'Документ уже подписан.' });
    expect(a.ar).toBe('تم التوقيع.');
    expect(a.status).toBe(PAIR_STATUS.PAIRED_STRONG);

    /* …والعربيُّ يُصحَّح، والقِرانُ باقٍ في الحالتين. */
    const b = restatus({ ...one, ar: 'تم توقيع المستند.' });
    expect(b.ru).toBe('Документ подписан.');
    expect(b.status).toBe(PAIR_STATUS.PAIRED_STRONG);
  });

  it('§43 ربطُ ترجمةٍ صحيحةٍ يزيلها من مكانها القديم — بلا تكرار', () => {
    const units = [
      { ru: 'Первое.', ar: 'ترجمة خاطئة.', status: PAIR_STATUS.PAIRED_STRONG },
      { ru: '', ar: 'الترجمة الصحيحة.', status: PAIR_STATUS.UNPAIRED_ARABIC },
    ];
    const next = attachTranslation(units, 0, 1);

    expect(next[0].ar).toBe('الترجمة الصحيحة.');
    /* ⚠️ ولا يبقى النصُّ العربيُّ في مكانين. */
    const copies = next.filter((u) => u.ar === 'الترجمة الصحيحة.').length;
    expect(copies).toBe(1);
    /* والوحدةُ المانحةُ فرغت فاختفت — لا صفوفَ خاوية. */
    expect(next.length).toBe(1);
    /* ولا تكرارَ للمصدر الروسيّ. */
    expect(next.filter((u) => u.ru === 'Первое.').length).toBe(1);
  });

  it('وفكُّ الترجمة يُبقي الروسيَّ مقطعَ تدريبٍ بلا ترجمة (بند ١٣)', () => {
    const units = [
      { ru: 'Документ подписан.', ar: 'تم التوقيع.', status: PAIR_STATUS.PAIRED_STRONG },
    ];
    const next = detachTranslation(units, 0);
    expect(next[0].ru).toBe('Документ подписан.');
    expect(next[0].ar).toBe('');
    expect(next[0].status).toBe(PAIR_STATUS.UNPAIRED_RUSSIAN);
    expect(practiceUnits(next).length).toBe(1);
  });

  it('وربطُ نصٍّ عربيٍّ مكتوبٍ بحرّيّة يعمل أيضًا', () => {
    const units = [{ ru: 'Документ.', ar: '', status: PAIR_STATUS.UNPAIRED_RUSSIAN }];
    const next = attachTranslation(units, 0, -1, 'المستند.');
    expect(next[0].ar).toBe('المستند.');
    expect(next[0].status).toBe(PAIR_STATUS.PAIRED_STRONG);
  });
});

/* ================================================================== *
 * ٦) العربيُّ لا يصير مقطعَ تدريب (بندا ١٢ و١٤)
 * ================================================================== */

describe('WS-D · العربيُّ ليس مادّةَ نطق', () => {
  it('⚠️ لا وحدةَ تدريبٍ مصدرُها عربيّ — مهما كان الشكل', () => {
    const samples = [
      'Документ подписан.\nتم التوقيع.',
      'المستندات\n\nتم التوقيع.',
      'ملاحظة:\nلا تنسَ التاريخ.',
      'الجملة الأولى.\nالجملة الثانية.',
    ];
    for (const text of samples) {
      const { units } = parseBilingual(text);
      for (const one of practiceUnits(units)) {
        expect(`${one.ru}|${classifyScript(one.ru)}`).toBe(`${one.ru}|${SCRIPT.CYRILLIC}`);
      }
    }
  });

  it('ونصٌّ عربيٌّ خالصٌ لا يعطي مقاطعَ تدريبٍ إطلاقًا', () => {
    const { units } = parseBilingual('الجملة الأولى.\nالجملة الثانية.');
    expect(practiceUnits(units).length).toBe(0);
  });
});

/* ================================================================== *
 * ٧) الإحصاءُ والمسودّة
 * ================================================================== */

describe('WS-D · الإحصاء والمسودّة', () => {
  it('الإحصاءُ محسوبٌ من الوحدات لا مُدَّعًى', () => {
    const { units, stats } = parseBilingual(
      'Первое.\nالأولى.\n\nВторое.\n\nثالثة عربية لوحدها.',
    );
    expect(stats.total).toBe(units.length);
    expect(stats.paired + stats.russianOnly + stats.arabicOnly + stats.review)
      .toBe(units.length);
    expect(summarize(units).total).toBe(units.length);
  });

  it('⚠️ ومسودّةٌ بلا `pairs` تُشتَقّ الآن — بلا ترقية (بند ٢١)', () => {
    /* سجلٌّ قديمٌ كما كُتب قبل WS-D: `text` وحدَه. */
    const legacy = { text: 'Документ подписан.\nتم التوقيع.' };
    const derived = draftPairs(legacy);
    expect(derived.length).toBe(1);
    expect(derived[0].ar).toBe('تم التوقيع.');
  });

  it('والمحفوظُ يغلب المشتقَّ — وإلّا ضاع إصلاحُك اليدويّ', () => {
    const fixed = [{ ru: 'Документ.', ar: 'إصلاح يدوي.', status: PAIR_STATUS.PAIRED_STRONG }];
    const draft = { text: 'Документ подписан.\nتم التوقيع.', pairs: fixed };
    expect(draftPairs(draft)).toEqual(fixed);
  });
});

/* ================================================================== *
 * ٨) الحُرّاس — ما لا يُكتشَف إلّا بفحص نصّ
 * ================================================================== */

const readSrc = async (path) => (await fetch(path)).text();

describe('WS-D · الحُرّاس', () => {
  it('⚠️ ولا ذكاءَ اصطناعيٍّ ولا شبكةَ في المحلّل (بندا ٥٠ و٥٢)', async () => {
    const src = await readSrc('../js/services/shadow/bilingual.js');
    for (const banned of ['fetch(', 'XMLHttpRequest', 'translate(', 'openai', 'api.', 'embedding']) {
      expect(`${banned}:${src.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('⚠️ والعربيُّ لا يدخل محرّكَ النطق ولا النبر (بندا ٤٥ و٤٦)', async () => {
    /*
     * ⚠️ **الاتّجاهُ الذي يهمّ هو الدخول لا الخروج.** المحرّكُ لا
     *    يعرف `translationSnapshot` أصلًا — وهذا ما نحرسه: لو استورد
     *    أحدُهم الترجمةَ إلى مسار التحليل غدًا لَغذّى مُقطِّعًا روسيًّا
     *    بنصٍّ عربيّ.
     */
    const engine = await readSrc('../js/services/pronunciation/engine.js');
    const stress = await readSrc('../js/services/shadow/stress.js');
    for (const src of [engine, stress]) {
      expect(src.includes('translationSnapshot')).toBe(false);
      expect(src.includes('bilingual.js')).toBe(false);
    }
  });

  it('⚠️ والمسودّةُ تمرّر ترجمتَها إلى الجلسة — السطرُ الذي كان ناقصًا', async () => {
    const src = await readSrc('../js/services/shadow/shadow-entry.js');
    const at = src.indexOf('export async function openShadowFromDraft');
    expect(at > 0).toBe(true);
    const fn = src.slice(at, src.indexOf('\n/**', at + 10));
    /*
     * ⚠️ **تغيّر المرساةُ ولم يتغيّر المحروس** (WS-DR · بندا ٩ و٣٨).
     *
     *    كان السطرُ `translation: one.ar` حرفيًّا. وصار يمرّ عبر
     *    `pairTranslation(one).primary` لأن «إثبات / تأكيد» معنيان
     *    لعنصرٍ واحد، والذي يدخل التدريبَ هو الذي **اخترتَه** منهما.
     *
     *    والمحروسُ نفسُه: أن يصل ما في `ar` إلى `translation` في
     *    الجلسة. وحارسٌ يسقط لأنّ اسمَ الدالّة تغيّر لا يحرس شيئًا.
     */
    expect(fn.includes('translation:')).toBe(true);
    expect(fn.includes('pairTranslation(one).primary')).toBe(true);
  });

  it('⚠️ ولا مسارَ مُصغَّرٌ للمسودّة — تُنتج مقاطعَ عاديّة (بند ٥٩)', async () => {
    const src = await readSrc('../js/services/shadow/shadow-entry.js');
    const at = src.indexOf('export async function openShadowFromDraft');
    const fn = src.slice(at, src.indexOf('\n/**', at + 10));
    /*
     * البابُ واحد: `createSession` نفسُها التي يمرّ منها السكريبت
     * والمحادثة والصورة. ولا مُشغّلَ ولا نسخَ ولا نبرَ خاصٌّ بالمسودّة.
     */
    expect(fn.includes('createSession(')).toBe(true);
    for (const banned of ['createPlaybackController', 'markSentence', 'analyzeWord', 'ttsSpeaker']) {
      expect(`${banned}:${fn.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('⚠️ وكلُّ كتلةِ نصٍّ في المراجعة تعلن اتّجاهها (بندا ٥٣ و٥٤)', async () => {
    const src = await readSrc('../js/modals/pair-review.js');
    /*
     * ⚠️ **الوراثةُ عطبٌ هنا.** الصفحةُ RTL، ونصٌّ روسيٌّ بلا `dir`
     *    تنقلب علاماتُه: «Документ.» تُعرَض «.Документ». ولا يُمسَك
     *    ذلك باختبارِ نصّ إلّا بفحص أن الوسمَ مكتوبٌ أصلًا.
     */
    expect(src.includes('dir="ltr" lang="ru"')).toBe(true);
    expect(src.includes('dir="rtl" lang="ar"')).toBe(true);
  });
});

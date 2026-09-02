/**
 * LingoLife — قراءةُ مسودّة ChatGPT بقالبها (WS-DR · بنود ٣٠ إلى ٣٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي كان مكسورًا — بالقياس لا بالانطباع
 * ═══════════════════════════════════════════════════════════════
 *
 * على مسودّةٍ حقيقيّةٍ من مسودّاتك أعطى المحلّلُ القديم:
 *
 *     ٣٠ وحدة · ٤ مقترنة · ١٧ «عربي بلا أصل» · ٨ «محتاجة مراجعة»
 *
 * أي **٢٥ إنذارًا كاذبًا من ٣٠**: عناوينُ الأقسام تُقرأ محتوًى، والشرحُ
 * يُتَّهم بأنّه ترجمةٌ ضاع أصلُها، والمقطعُ الروسيُّ القصيرُ يُقرأ عنوانًا
 * فلا يُقرَن بترجمته، والفاصلُ الزخرفيُّ يصير صفًّا فارغًا.
 *
 * ⚠️ **والمقياسُ هنا هو الدور لا العدد.** لا يكفي أن تقلّ الإنذارات؛
 *    يجب أن يكون لكلّ سطرٍ **الدورُ الصحيح**: الشرحُ شرحٌ، والقالبُ
 *    قالبٌ، والاسترجاعُ معكوسُ الاتّجاه. ولذلك تُفحَص الأدوارُ بأسمائها.
 *
 * ⚠️ **ولا يُخفَّف الحذرُ حيث لا قالب** (بند ١٣): آخِرُ describe يحرس
 *    أنّ النصَّ الثنائيَّ العاديَّ ما زال يذهب إلى المراجعة عند الالتباس.
 */

import { describe, it, expect } from './test-runner.js';
import {
  SECTION, matchSection, isSeparator, looksDraft, looksDocTitle,
  splitAlternatives, translationView, ruleOf,
} from '../js/services/shadow/draft-structure.js';
import { parseBilingual, PAIR_STATUS, summarize } from '../js/services/shadow/bilingual.js';

/** المسودّةُ المرجعيّة — من البند ٤٦ حرفًا بحرف. */
const FIXTURE = [
  'مسودة — Core Chunks', '',
  'الجملة الأساسية:', '',
  'Та́кже мы обсуди́ли, что докуме́нты должны́ быть предста́влены зара́нее.', '',
  'كذلك ناقشنا أن المستندات يجب أن تُقدَّم مسبقًا.', '',
  '━━━━━━━━━━━━━━', '',
  'содержа́ть', '',
  'يحتوي على / يتضمن', '',
  'الإحساس:', '',
  'ليس معرفة شيء جديد، بل إزالة عدم الوضوح.', '',
  'أمثلة:', '',
  'Докуме́нт соде́ржит ва́жную информа́цию.', '',
  'المستند يحتوي على معلومات مهمة.', '',
  'Отчёт соде́ржит необходи́мые да́нные.', '',
  'التقرير يحتوي على البيانات المطلوبة.', '',
  '━━━━━━━━━━━━━━', '',
  'подтвержде́ние', '',
  'إثبات / تأكيد', '',
  'القالب:', '',
  'должен / должны́ + быть + اسم مفعول', '',
  'مقارنة:', '',
  'подтвержде́ние', '',
  'إثبات', '',
  'подтвержде́ния', '',
  'إثباتات / تأكيدات', '',
  'إعادة البناء:', '',
  'Я ду́маю, что необходи́мо уточни́ть тре́бования процеду́ры.', '',
  'أعتقد أنه من الضروري توضيح متطلبات الإجراء.', '',
  'أسئلة الاسترجاع:', '',
  'كيف تقول:', '',
  'أريد توضيح التفاصيل.', '',
  'Я хочу́ уточни́ть де́тали.', '',
  'شريط الاسترجاع السريع:', '',
  'зара́нее', '',
  'مسبقًا / من قبل',
].join('\n');

const parse = (text) => parseBilingual(text).units;
const find = (units, ru) => units.find((one) => (one.one || one).ru === ru);
const statusOf = (units, ru) => find(units, ru)?.status;
const arabicUnit = (units, ar) => units.find((one) => one.ar === ar);

/* ================================================================== *
 * أ · عناوينُ الأقسام (بند ٤)
 * ================================================================== */

describe('WS-DR · أ · عناوينُ الأقسام', () => {
  it('١ · تُعرَف بأسمائها المعروفة', () => {
    expect(matchSection('الإحساس:')).toBe(SECTION.SENSE);
    expect(matchSection('أمثلة:')).toBe(SECTION.EXAMPLES);
    expect(matchSection('القالب:')).toBe(SECTION.TEMPLATE);
    expect(matchSection('مقارنة:')).toBe(SECTION.COMPARE);
    expect(matchSection('إعادة البناء:')).toBe(SECTION.REBUILD);
    expect(matchSection('أسئلة الاسترجاع:')).toBe(SECTION.RECALL);
    expect(matchSection('شريط الاسترجاع السريع:')).toBe(SECTION.STRIP);
  });

  /*
   * ⚠️ **وهذا هو البندُ ٣ بعينه**: قالبٌ ثابتٌ نعمة، وهشاشةٌ أمامَ
   *    تغيّرٍ صغيرٍ لعنة. نقطتان أو لا، همزةٌ أو لا، مسافةٌ أو زخرفة.
   */
  it('٢ · وتتسامح مع النقطتين والمسافة والهمزة والزخرفة (بند ٣٠-P و٣٠-Q)', () => {
    expect(matchSection('الإحساس')).toBe(SECTION.SENSE);
    expect(matchSection('الاحساس:')).toBe(SECTION.SENSE);
    expect(matchSection('  الإحساس  :  ')).toBe(SECTION.SENSE);
    expect(matchSection('الإحساس：')).toBe(SECTION.SENSE);
    expect(matchSection('**أمثلة**')).toBe(SECTION.EXAMPLES);
    expect(matchSection('امثله:')).toBe(SECTION.EXAMPLES);
    expect(matchSection('اعادة البناء')).toBe(SECTION.REBUILD);
  });

  it('٣ · وجملةٌ تبدأ بالكلمة ليست عنوانًا', () => {
    expect(matchSection('الإحساس هنا مختلف تمامًا عن غيره في هذا السياق')).toBe(null);
    expect(matchSection('أمثلة كتيرة على الكلمة دي موجودة في الملف')).toBe(null);
  });

  it('٤ · والفواصلُ الزخرفيّةُ تُعرَف بأشكالها (بند ٣٠-L)', () => {
    expect(isSeparator('━━━━━━━━━━━━━━')).toBe(true);
    expect(isSeparator('----------')).toBe(true);
    expect(isSeparator('======')).toBe(true);
    expect(isSeparator('· · ·')).toBe(true);
    /* وليست كلَّ شرطةٍ فاصلًا. */
    expect(isSeparator('—')).toBe(false);
    expect(isSeparator('كلام')).toBe(false);
  });

  it('٥ · وعنوانُ الوثيقة يُعرَف في المقدّمة وحدَها', () => {
    expect(looksDocTitle('مسودة — Core Chunks')).toBe(true);
    expect(looksDocTitle('Draft: chunks')).toBe(true);
    /* جملةٌ تنتهي بنقطةٍ ليست عنوانًا مهما بدأت. */
    expect(looksDocTitle('مسودة كتبتها امبارح.')).toBe(false);
    expect(looksDocTitle('المستند يحتوي على معلومات')).toBe(false);
  });
});

/* ================================================================== *
 * ب · بدائلُ الترجمة: «/» (بنود ٦ و٧ و٣١)
 * ================================================================== */

describe('WS-DR · ب · الشرطةُ المائلة', () => {
  it('٦ · «إثبات / تأكيد» بديلان لعنصرٍ واحدٍ لا عنصران', () => {
    expect(splitAlternatives('إثبات / تأكيد')).toEqual(['إثبات', 'تأكيد']);
    expect(splitAlternatives('يحتوي على / يتضمن')).toEqual(['يحتوي على', 'يتضمن']);
    expect(splitAlternatives('مسبقًا / من قبل')).toEqual(['مسبقًا', 'من قبل']);
    expect(splitAlternatives('إثباتات / تأكيدات')).toEqual(['إثباتات', 'تأكيدات']);
  });

  it('٧ · وثلاثةُ بدائلَ كذلك', () => {
    expect(splitAlternatives('يوضح / يستفسر عن التفاصيل / يحدد بدقة'))
      .toEqual(['يوضح', 'يستفسر عن التفاصيل', 'يحدد بدقة']);
  });

  it('٨ · وصيغٌ روسيّةٌ بديلةٌ تُقسَم كذلك (بند ٧)', () => {
    expect(splitAlternatives('должен / должны́')).toEqual(['должен', 'должны́']);
  });

  /* ⚠️ ولا تُقسَم كلُّ شرطةٍ — التاريخُ والكسرُ ليسا بديلين. */
  it('٩ · والتواريخُ والكسورُ لا تُقسَم', () => {
    expect(splitAlternatives('2025/09/01')).toEqual(['2025/09/01']);
    expect(splitAlternatives('1/2')).toEqual(['1/2']);
  });

  it('١٠ · وبلا شرطةٍ يبقى النصُّ واحدًا', () => {
    expect(splitAlternatives('تأكيد')).toEqual(['تأكيد']);
    expect(splitAlternatives('')).toEqual([]);
  });

  /*
   * ⚠️ **الأساسيّةُ والبدائلُ تُشتقّان عند القراءة** (بند ٦): المخزَّنُ
   *    يبقى سلسلةً واحدةً كما لصقتَها — بلا هجرةِ بيانات.
   */
  it('١١ · والأساسيّةُ اختيارُك، والباقي يبقى', () => {
    const first = translationView('إثبات / تأكيد', 0);
    expect(first.primary).toBe('إثبات');
    expect(first.alts).toEqual(['تأكيد']);
    expect(first.hasAlts).toBe(true);

    const second = translationView('إثبات / تأكيد', 1);
    expect(second.primary).toBe('تأكيد');
    expect(second.alts).toEqual(['إثبات']);
    /* والكلُّ محفوظٌ في الحالتين — لا حذفَ لبديل. */
    expect(second.all).toEqual(['إثبات', 'تأكيد']);
  });

  it('١٢ · واختيارٌ خارجَ المدى يعود للأوّل بلا سقوط', () => {
    expect(translationView('إثبات / تأكيد', 9).primary).toBe('إثبات');
    expect(translationView('تأكيد', 3).primary).toBe('تأكيد');
  });
});

/* ================================================================== *
 * ج · القراءةُ بالدور — المسودّةُ المرجعيّة (بنود ٣٠ إلى ٣٤)
 * ================================================================== */

describe('WS-DR · ج · الأدوارُ في المسودّة المرجعيّة', () => {
  it('١٣ · النصُّ يُعرَف مسودّةً بقالبه', () => {
    expect(looksDraft(FIXTURE)).toBe(true);
    /* ⚠️ وعنوانٌ واحدٌ لا يكفي — «مقارنة:» قد تقع في أيّ نصّ. */
    expect(looksDraft('مقارنة:\n\nكلام عادي.')).toBe(false);
  });

  /*
   * ⚠️ **هذا هو الرقمُ الذي بدأت منه التمريرة.** قبلها: ٢٥ إنذارًا
   *    كاذبًا من ٣٠. وبعدها يجب أن يكون **صفرًا** — لا لأنّ الحذرَ
   *    ضعُف، بل لأنّ كلَّ سطرٍ صار له دورٌ معروف.
   */
  it('١٤ · ولا إنذارَ كاذبًا واحدًا فيها', () => {
    const stats = summarize(parse(FIXTURE));
    expect(stats.arabicOnly).toBe(0);
    expect(stats.review).toBe(0);
    expect(stats.russianOnly).toBe(0);
    expect(stats.needs).toBe(0);
    expect(stats.settled).toBe(stats.total);
  });

  it('١٥ · والمقطعُ الروسيُّ القصيرُ يُقرَن بترجمته عبر السطر الفارغ', () => {
    const units = parse(FIXTURE);
    expect(statusOf(units, 'содержа́ть')).toBe(PAIR_STATUS.PAIRED_STRONG);
    expect(find(units, 'содержа́ть').ar).toBe('يحتوي على / يتضمن');
    expect(statusOf(units, 'зара́нее')).toBe(PAIR_STATUS.PAIRED_STRONG);
    expect(find(units, 'зара́нее').ar).toBe('مسبقًا / من قبل');
  });

  /* ⚠️ **بندُ ٣٢ بحرفه**: الشرحُ ليس «عربيًّا بلا أصل». */
  it('١٦ · والشرحُ تحت «الإحساس» ملاحظةٌ لا ترجمةٌ ناقصة', () => {
    const one = arabicUnit(parse(FIXTURE), 'ليس معرفة شيء جديد، بل إزالة عدم الوضوح.');
    expect(Boolean(one)).toBe(true);
    expect(one.status).toBe(PAIR_STATUS.NOTE);
    expect(one.section).toBe(SECTION.SENSE);
    /* ولا يُقرأ روسيًّا ولا يدخل التدريب. */
    expect(one.ru).toBe('');
  });

  it('١٧ · وعناوينُ الأقسام بنيةٌ لا محتوى', () => {
    const units = parse(FIXTURE);
    const heads = units.filter((one) => one.status === PAIR_STATUS.SECTION_HEAD);
    expect(heads.length >= 8).toBe(true);
    expect(heads.some((one) => one.ar === 'الإحساس:')).toBe(true);
    expect(heads.some((one) => one.ar === 'أمثلة:')).toBe(true);
    /* ⚠️ ولا يُقرَن «أمثلة» بأوّل جملةٍ روسيّةٍ بعدها (بند ٣٣). */
    expect(heads.every((one) => !one.ru)).toBe(true);
  });

  it('١٨ · وكتلةُ الأمثلة زوجان لا زوجٌ ولا أربعةُ يتامى (بند ٣٣)', () => {
    const units = parse(FIXTURE);
    const first = find(units, 'Докуме́нт соде́ржит ва́жную информа́цию.');
    const second = find(units, 'Отчёт соде́ржит необходи́мые да́нные.');
    expect(first.ar).toBe('المستند يحتوي على معلومات مهمة.');
    expect(second.ar).toBe('التقرير يحتوي على البيانات المطلوبة.');
    expect(first.section).toBe(SECTION.EXAMPLES);
  });

  it('١٩ · والقالبُ رمزٌ نحويٌّ لا جملةٌ تُنطَق ولا ترجمةٌ تُنتظَر', () => {
    const one = parse(FIXTURE).find((row) => row.status === PAIR_STATUS.TEMPLATE);
    expect(Boolean(one)).toBe(true);
    expect(one.raw).toContain('должен');
    expect(one.ru).toBe('');
    expect(one.ar).toBe('');
  });

  /* ⚠️ **بندُ ٣٤**: الاتّجاهُ معكوسٌ — العربيُّ يسأل والروسيُّ يجيب. */
  it('٢٠ · وسؤالُ الاسترجاع اتّجاهُه معكوسٌ ولا يُقرأ «روسيًّا وترجمتَه»', () => {
    const one = parse(FIXTURE).find((row) => row.status === PAIR_STATUS.RECALL);
    expect(Boolean(one)).toBe(true);
    expect(one.ru).toBe('Я хочу́ уточни́ть де́тали.');
    expect(one.ar).toBe('أريد توضيح التفاصيل.');
    expect(one.prompt).toBe(true);
  });

  it('٢١ · والمقارنةُ صيغتان وترجمتاهما', () => {
    const units = parse(FIXTURE);
    expect(find(units, 'подтвержде́ния').ar).toBe('إثباتات / تأكيدات');
    expect(find(units, 'подтвержде́ния').section).toBe(SECTION.COMPARE);
  });

  it('٢٢ · والفاصلُ الزخرفيُّ لا يصير صفًّا فارغًا في المراجعة', () => {
    const units = parse(FIXTURE);
    const bars = units.filter((one) => one.status === PAIR_STATUS.DIVIDER);
    expect(bars.length).toBe(2);
    /* ولا وحدةَ فارغةَ الطرفين بحالةِ «محتاجة مراجعة». */
    const empties = units.filter((one) =>
      !one.ru && !one.ar && one.status === PAIR_STATUS.NEEDS_REVIEW);
    expect(empties).toHaveLength(0);
  });

  it('٢٣ · وعنوانُ الوثيقة لا يُوسَم «عربيًّا بلا أصل»', () => {
    const one = arabicUnit(parse(FIXTURE), 'مسودة — Core Chunks');
    expect(one.status).toBe(PAIR_STATUS.SECTION_HEAD);
  });
});

/* ================================================================== *
 * د · المتانة: تغيّراتٌ صغيرةٌ لا تكسر الاستيراد (بند ٣٠)
 * ================================================================== */

describe('WS-DR · د · متانةُ القالب', () => {
  const head = 'مسودة — Core Chunks\n\nالإحساس:\n\nشرح.\n\n━━━━━━\n\n';

  it('٢٤ · أسطرٌ فارغةٌ زائدةٌ لا تكسر القران (بند ٣٠-M)', () => {
    const units = parse(`${head}содержа́ть\n\n\n\nيحتوي على`);
    expect(statusOf(units, 'содержа́ть')).toBe(PAIR_STATUS.PAIRED_STRONG);
  });

  it('٢٥ · وبلا سطرٍ فارغٍ بينهما كذلك (بند ٣٠-N)', () => {
    const units = parse(`${head}содержа́ть\nيحتوي على`);
    expect(statusOf(units, 'содержа́ть')).toBe(PAIR_STATUS.PAIRED_STRONG);
  });

  it('٢٦ · ومسافاتٌ زائدةٌ لا تُغيّر شيئًا (بند ٣٠-O)', () => {
    const units = parse(`${head}   содержа́ть   \n\n   يحتوي على   `);
    expect(statusOf(units, 'содержа́ть')).toBe(PAIR_STATUS.PAIRED_STRONG);
  });

  it('٢٧ · وعنوانٌ بلا نقطتين يعمل كما هو (بند ٣٠-P)', () => {
    const units = parse('مسودة — Core Chunks\n\nأمثلة\n\nЯ ду́маю.\n\nأعتقد.\n\n━━━━\n\nالإحساس\n\nشرحٌ عربيّ.');
    const note = arabicUnit(units, 'شرحٌ عربيّ.');
    expect(note.status).toBe(PAIR_STATUS.NOTE);
    expect(statusOf(units, 'Я ду́маю.')).toBe(PAIR_STATUS.PAIRED_STRONG);
  });

  /*
   * ⚠️ **وهذا حارسُ البند ١٣**: الذكاءُ في فهم المعروف لا في الجرأة
   *    على المجهول. سطرٌ عربيٌّ يتيمٌ في قسمِ أزواجٍ يبقى إنذارًا صادقًا.
   */
  it('٢٨ · وسطرٌ عربيٌّ يتيمٌ حقيقيٌّ **يصل** إلى المراجعة (بند ٣٠-R)', () => {
    const units = parse(`${head}أمثلة:\n\nЯ ду́маю.\n\nأعتقد.\n\nسطر عربي زائد بلا أصل.`);
    const orphan = arabicUnit(units, 'سطر عربي زائد بلا أصل.');
    expect(orphan.status).toBe(PAIR_STATUS.UNPAIRED_ARABIC);
    expect(summarize(units).needs >= 1).toBe(true);
  });

  it('٢٩ · وقاعدةُ قسمٍ مجهولٍ هي الافتراضيّةُ لا سقوط', () => {
    expect(ruleOf('لا-يوجد').pairs).toBe(true);
    expect(ruleOf(undefined).pairs).toBe(true);
  });
});

/* ================================================================== *
 * هـ · النصُّ العاديُّ لم يتغيّر حذرُه (بند ١٣)
 * ================================================================== */

describe('WS-DR · هـ · خارجَ المسودّة الحذرُ كما هو', () => {
  /*
   * ⚠️ **هذا الاختبارُ هو الذي فرض التصميمَ كلَّه.**
   *
   *    `Документы\n\nتم توقيع المستند.` و`содержа́ть\n\nيحتوي على`
   *    **متطابقان في الشكل تمامًا**: سطرٌ سيريليٌّ قصيرٌ وحدَه، فراغ،
   *    سطرٌ عربيّ. والمطلوبُ منهما متضادّ.
   *
   *    فلا يفرّق بينهما إلّا **السياق**: الثاني داخلَ وثيقةٍ فيها
   *    عناوينُ أقسامٍ وفواصل. ولذلك يسأل المحلّلُ «هل هذه مسودّة؟»
   *    قبل أن يقرأ — راجع `looksDraft`.
   */
  it('٣٠ · §٣١ ما زال قائمًا: عنوانٌ روسيٌّ لا يبتلع الفقرةَ بعده', () => {
    const units = parse('Документы\n\nتم توقيع المستند.');
    const head2 = units.find((one) => one.ru === 'Документы');
    expect(Boolean(head2)).toBe(true);
    expect(head2.ar).toBe('');
  });

  it('٣١ · ونصٌّ ثنائيٌّ عاديٌّ يُقرَن كما كان', () => {
    const units = parse('Документ подписан.\nتم توقيع المستند.');
    expect(units[0].ru).toBe('Документ подписан.');
    expect(units[0].ar).toBe('تم توقيع المستند.');
  });

  it('٣٢ · والوعيُ بالقالب يُفرَض صراحةً حين يُطلَب', () => {
    /* بلا قالبٍ ظاهرٍ لا يُقرَن… */
    expect(parseBilingual('содержа́ть\n\nيحتوي على').units[0].ar).toBe('');
    /* …وبطلبٍ صريحٍ يُقرَن. */
    const forced = parseBilingual('содержа́ть\n\nيحتوي على', { draft: true }).units;
    expect(forced[0].ar).toBe('يحتوي على');
  });
});

/**
 * LingoLife — اختبارات استيراد المشهد المُجهَّز
 *
 * القاعدتان المحروستان:
 *
 *  1. **الرفض بسببه لا بصمت.** حزمةٌ فيها اثنتا عشرة جملة وواحدةٌ
 *     تالفة: لا نستورد إحدى عشرة ونسكت عن الثانية عشرة.
 *  2. **ما لا يستوعبه التطبيق يُعلَن.** استيراد بياناتٍ لا تعرضها
 *     شاشةٌ أسوأ من عدم استيرادها: تظنّها وصلت وهي في العدم.
 */

import { describe, it, expect } from './test-runner.js';
import {
  PACKAGE_FORMAT_VERSION,
  SUPPORTED,
  NOT_SUPPORTED,
  PARTIAL,
  SPEC_KINDS,
  field,
  collection,
} from '../js/services/import/package-format.js';
import { parsePackage, packageCounts, isEmpty } from '../js/services/import/parse.js';

/** حزمةٌ صغيرة صالحة — نبني عليها الحالات. */
const basePackage = () => ({
  formatVersion: 1,
  scene: {
    title: 'اجتماع مراجعة الوثائق',
    titleRu: 'Совещание по документам',
    date: '2026-04-01',
    placeName: 'المكتب',
    eventType: 'اجتماع شغل',
  },
  speakers: [{ name: 'Алексей', role: 'زميل' }],
  scripts: [{ title: 'مكالمة القسم', text: 'Документ уже подписан.' }],
  conversationParts: [
    { speaker: 'Алексей', text: 'Документ подписан.', translation: 'الورقة اتوقّعت' },
    { speaker: 'أنا', text: 'Спасибо.', isMe: true },
  ],
  mistakes: [{ wrong: 'Я идти.', natural: 'Я иду.', note: 'الفعل بيتصرّف' }],
  expressions: [{ text: 'направить на согласование', meaningAr: 'يبعت للموافقة' }],
  eventThread: { title: 'شحنة أبريل' },
});

describe('الاستيراد — القراءة الكريمة', () => {
  it('يقرأ حزمةً كاملة', () => {
    const { ok, pkg, issues } = parsePackage(basePackage());
    expect(ok).toBe(true);
    expect(issues.length).toBe(0);
    expect(pkg.scene.title).toBe('اجتماع مراجعة الوثائق');
    expect(pkg.people.length).toBe(1);
    expect(pkg.conversationParts.length).toBe(2);
    expect(pkg.eventThread.title).toBe('شحنة أبريل');
  });

  it('يقبل نصّ JSON كما يقبل الكائن', () => {
    const { ok, pkg } = parsePackage(JSON.stringify(basePackage()));
    expect(ok).toBe(true);
    expect(pkg.scripts.length).toBe(1);
  });

  /*
   * ⚠️ مُخرَج الذكاء الخارجي لا يأتي بصيغةٍ واحدة. الكرم هنا وحده —
   *    في القراءة — والكتابة لا تتسامح.
   */
  it('يقبل أسماء الحقول البديلة', () => {
    const { ok, pkg } = parsePackage({
      scene: { titleAr: 'اجتماع', when: '2026-04-01', location: 'المكتب', category: 'فحص' },
      persons: [{ who: 'Ирина' }],
      dialogue: [{ person: 'Ирина', content: 'Привет.', arabic: 'أهلًا' }],
      corrections: [{ before: 'Я идти.', after: 'Я иду.' }],
      phrases: [{ text: 'на согласовании', meaning: 'تحت الموافقة' }],
    });
    expect(ok).toBe(true);
    expect(pkg.scene.title).toBe('اجتماع');
    expect(pkg.scene.placeName).toBe('المكتب');
    expect(pkg.scene.eventType).toBe('فحص');
    expect(pkg.people[0].name).toBe('Ирина');
    expect(pkg.conversationParts[0].translation).toBe('أهلًا');
    expect(pkg.mistakes[0].natural).toBe('Я иду.');
    expect(pkg.expressions[0].meaningAr).toBe('تحت الموافقة');
  });

  it('يقبل الحزمة ملفوفةً في `package` أو `data`', () => {
    expect(parsePackage({ package: basePackage() }).ok).toBe(true);
    expect(parsePackage({ data: basePackage() }).ok).toBe(true);
  });

  it('يقبل المحادثة ككائنٍ فيه `parts`', () => {
    const pkg = basePackage();
    delete pkg.conversationParts;
    pkg.conversations = { parts: [{ speaker: 'Олег', text: 'Да.' }] };
    const parsed = parsePackage(pkg);
    expect(parsed.pkg.conversationParts.length).toBe(1);
  });

  it('الاسم القانوني يسبق البديل', () => {
    // مُنتِجٌ يرسل الاثنين يعني بالأوّل ما نعنيه.
    expect(field({ title: 'الصح', name: 'حاجة تانية' }, 'title')).toBe('الصح');
  });
});

describe('الاستيراد — الرفض بسببه', () => {
  it('نصٌّ ليس JSON يُرفَض برسالة المحلّل نفسها', () => {
    const { ok, issues } = parsePackage('{ مش json }');
    expect(ok).toBe(false);
    expect(issues[0].level).toBe('fatal');
    expect(issues[0].message.includes('JSON')).toBe(true);
  });

  it('حزمةٌ بلا مشهد تُرفَض كلها', () => {
    const { ok, issues } = parsePackage({ expressions: [{ text: 'x' }] });
    expect(ok).toBe(false);
    expect(issues[0].message.includes('بلا مشهد')).toBe(true);
  });

  it('مشهدٌ بلا عنوان يُرفَض', () => {
    const { ok, issues } = parsePackage({ scene: { date: '2026-04-01' } });
    expect(ok).toBe(false);
    expect(issues[0].where).toBe('scene');
  });

  /*
   * ⚠️ صيغةٌ من المستقبل قد تحمل معانيَ لا نعرفها، وقراءتها بقواعد
   *    اليوم تفسيرٌ خاطئ صامت — أخطر من الرفض.
   */
  it('صيغةٌ أحدث مما نفهم تُرفَض ولا تُخمَّن', () => {
    const { ok, issues } = parsePackage({ ...basePackage(), formatVersion: PACKAGE_FORMAT_VERSION + 1 });
    expect(ok).toBe(false);
    expect(issues[0].message.includes('حدّث التطبيق')).toBe(true);
  });

  it('غياب الإصدار مقبول — المُنتِج لا يعرفنا', () => {
    const pkg = basePackage();
    delete pkg.formatVersion;
    expect(parsePackage(pkg).ok).toBe(true);
  });

  it('العنصر التالف يُستبعَد وحده ويُقال رقمه', () => {
    const pkg = basePackage();
    pkg.conversationParts.splice(1, 0, { speaker: 'حد', text: '   ' });
    const { ok, pkg: parsed, issues } = parsePackage(pkg);

    expect(ok).toBe(true);
    // الاثنان الصالحان بقيا…
    expect(parsed.conversationParts.length).toBe(2);
    // …والتالف قيل رقمه.
    const said = issues.find((i) => i.where === 'conversationParts');
    expect(said.level).toBe('warn');
    expect(said.message.includes('رقم 2')).toBe(true);
  });

  it('التصحيح بنصفٍ واحد ليس تصحيحًا', () => {
    const pkg = basePackage();
    pkg.mistakes.push({ wrong: 'Я идти.' });
    const { pkg: parsed, issues } = parsePackage(pkg);
    expect(parsed.mistakes.length).toBe(1);
    expect(issues.some((i) => i.where === 'mistakes')).toBe(true);
  });

  it('تاريخٌ لا يُفهَم يُقال ولا يُخمَّن', () => {
    const pkg = basePackage();
    pkg.scene.date = 'الأربعاء اللي فات';
    const { ok, pkg: parsed, issues } = parsePackage(pkg);
    expect(ok).toBe(true);
    expect(parsed.scene.date).toBe('');
    expect(issues.some((i) => i.where === 'scene.date')).toBe(true);
  });

  it('التاريخ بطابعٍ رقمي يُقرأ', () => {
    const pkg = basePackage();
    pkg.scene.date = new Date(2026, 3, 1).getTime();
    expect(parsePackage(pkg).pkg.scene.date).toBe('2026-04-01');
  });
});

describe('الاستيراد — ما لا يُستورَد يُعلَن', () => {
  /*
   * ⚠️ **جوهر هذا القسم.** كتابة بياناتٍ لا تعرضها شاشة أسوأ من عدم
   *    كتابتها: تظنّها وصلت وهي في العدم (بند 89).
   */
  it('يُبلِّغ عمّا في الحزمة ولا يستوعبه التطبيق', () => {
    const pkg = basePackage();
    pkg.words = [{ text: 'документ' }, { text: 'согласование' }];
    pkg.projects = [{ title: 'مشروع الشحنات' }];
    pkg.colloquialLanguage = [{ text: 'ну да' }];

    const { pkg: parsed } = parsePackage(pkg);
    const kinds = parsed.skipped.map((s) => s.kind).sort();
    expect(kinds).toEqual(['colloquialLanguage', 'projects', 'words']);

    const words = parsed.skipped.find((s) => s.kind === 'words');
    expect(words.count).toBe(2);
    // ولكلٍّ سببٌ مكتوب لا مجرّد «غير مدعوم».
    expect(words.reason.length > 10).toBe(true);
  });

  it('حزمةٌ نظيفة لا تُبلِّغ عن شيء', () => {
    expect(parsePackage(basePackage()).pkg.skipped.length).toBe(0);
  });

  /*
   * ⚠️ **الحارس البنيوي.** كل نوعٍ تعدّه المواصفة إمّا مدعوم، وإمّا
   *    مُعلَنٌ بسببٍ مكتوب، وإمّا جزئيّ بحدوده. لا رابع — ومَن يضيف
   *    نوعًا للمواصفة ولا يقرّر فيه يسقط اختبارُه لا مستخدمُه.
   */
  it('لا نوع في المواصفة بلا قرار', () => {
    // `speakers` و`conversations` مرادفان لمدعومَين.
    const aliases = { speakers: 'people', conversations: 'conversationParts' };
    const undecided = SPEC_KINDS.filter((kind) => {
      const key = aliases[kind] || kind;
      return !(key in SUPPORTED) && !(key in NOT_SUPPORTED) && !(key in PARTIAL);
    });
    expect(undecided).toEqual([]);
  });

  it('لكل مستبعَد سببٌ مفهوم لا كلمة واحدة', () => {
    for (const [kind, reason] of Object.entries(NOT_SUPPORTED)) {
      if (!reason || reason.length < 12) throw new Error(`${kind} مستبعَد بسببٍ غامض`);
    }
  });

  it('المشروع مستبعَد بوصفه قرارًا مؤجَّلًا لا نقصًا', () => {
    // ⚠️ الفرق يهمّ: «لم يُبنَ» تُصلَح ببنائه، و«قرار مؤجَّل» يُراجَع.
    expect(NOT_SUPPORTED.projects.includes('مؤجَّل')).toBe(true);
  });
});

describe('الاستيراد — الأعداد', () => {
  it('تُحسَب من المقروء لا من المكتوب في الحزمة', () => {
    const pkg = basePackage();
    pkg.expressions.push({ meaningAr: 'بلا نصّ' });   // تالف
    const counts = packageCounts(parsePackage(pkg).pkg);
    expect(counts.expressions).toBe(1);
    expect(counts.conversationParts).toBe(2);
    expect(counts.scene).toBe(1);
  });

  it('حزمةٌ بمشهدٍ وحده تُعتبر فارغة', () => {
    const { pkg } = parsePackage({ scene: { title: 'بس عنوان' } });
    expect(isEmpty(pkg)).toBe(true);
  });

  it('وبعنصرٍ واحد لا تكون فارغة', () => {
    const { pkg } = parsePackage({ scene: { title: 'ذكرى' }, expressions: [{ text: 'x' }] });
    expect(isEmpty(pkg)).toBe(false);
  });
});

describe('الاستيراد — قراءة المجموعات', () => {
  it('تعيد مصفوفةً دائمًا مهما كان الشكل', () => {
    expect(collection({}, 'people')).toEqual([]);
    expect(collection({ people: null }, 'people')).toEqual([]);
    expect(collection({ people: 'مش مصفوفة' }, 'people')).toEqual([]);
    expect(collection({ speakers: [{ name: 'أ' }] }, 'people').length).toBe(1);
  });
});

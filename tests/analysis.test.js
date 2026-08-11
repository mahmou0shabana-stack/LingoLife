/**
 * LingoLife — اختبارات التحليل المُشتقّ
 *
 * أربع قواعد تُحرَس:
 *
 *  1. **لا يُختلَق تقدّم** *(بند 74)* — ولا نسبةَ أخطاء، ولا حجمَ
 *     مفردات، ولا طلاقة. وكل ما لا يُقاس مُعلَنٌ بسببٍ مكتوب.
 *  2. **الرقم يشير إلى ما يُفتَح** — تصحيحٌ في ذكرى محذوفة لا يُعَدّ،
 *     وإلّا صار العدد يشير إلى العدم.
 *  3. **الممارسة ليست إتقانًا** — الأرقام تعود ومعها ما تعنيه، ولا
 *     تُقرأ على غير معناها في شاشةٍ قادمة.
 *  4. **لا عالمَ ثانيًا** — «لغتك بتحصل فين» تُقرأ من `facetTree`
 *     نفسها التي تبني شاشة المحاور، فلا رقمان لسؤالٍ واحد.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, eventThreads, relationships, conversationParts,
  expressions, expressionOccurrences, mistakeComparisons, scripts,
  savedItems, practiceEvidence,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { addPerson } from '../js/services/person-service.js';
import { resetTypes } from '../js/services/type-service.js';
import { addConversationPart, addMistake } from '../js/services/content-service.js';
import { saveItem, SAVED_KIND } from '../js/services/saved-service.js';
import { facetTree } from '../js/services/atlas-service.js';
import {
  NOT_MEASURED, mistakePatterns, captureReasons, whereRussianLives,
  rhythm, practiceReality, analysisOverview,
} from '../js/services/analysis-service.js';

async function fresh() {
  await openDB();
  for (const repo of [
    scenes, people, eventThreads, relationships, conversationParts,
    expressions, expressionOccurrences, mistakeComparisons, scripts,
    savedItems, practiceEvidence,
  ]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

const scene = (titleAr, date, extra = {}) =>
  createScene({ titleAr, date, type: 'meeting', ...extra });

/* ================================================================== */

describe('أنماط الأخطاء — واقعةٌ لا نسبة', () => {
  it('يتجمّعن بالنوع، والأكثر أوّلًا، ومعهنّ أمثلتهنّ', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addMistake(s.id, { wrong: 'один несоответствие', natural: 'одно несоответствие', mistakeType: 'gender' });
    await addMistake(s.id, { wrong: 'два стол', natural: 'два стола', mistakeType: 'gender' });
    await addMistake(s.id, { wrong: 'я ждать', natural: 'я жду', mistakeType: 'grammar' });

    const out = await mistakePatterns();
    expect(out.total).toBe(3);
    expect(out.types[0].label).toBe('جنس الكلمة');
    expect(out.types[0].count).toBe(2);
    /*
     * ⚠️ الاثنان معًا — لا «أوّلهما». إنشاؤهما متتاليًا لا يضمن
     *    `createdAt` مختلفًا، فتأكيدُ الأوّل كان **ينجح بالحظّ**: مرّ
     *    مرّتين ثم سقط بلا تغييرٍ في الكود. الترتيبُ نفسه له اختبارُه
     *    تحت، بطوابع يضبطها هو.
     */
    expect(out.types[0].items.map((row) => row.natural).sort())
      .toEqual(['два стола', 'одно несоответствие'].sort());
  });

  it('⚠️ والأحدث أوّلًا — ترتيبٌ قاطع لا رهنَ ترتيب المفاتيح', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const older = await addMistake(s.id, { wrong: 'a', natural: 'الأقدم', mistakeType: 'gender' });
    const newer = await addMistake(s.id, { wrong: 'b', natural: 'الأحدث', mistakeType: 'gender' });

    // طابعان مختلفان صراحةً — الإنشاء المتتالي قد يقع في ميلّيةٍ واحدة.
    await mistakeComparisons.putRaw({ ...older, createdAt: 1000 });
    await mistakeComparisons.putRaw({ ...newer, createdAt: 2000 });

    const out = await mistakePatterns();
    expect(out.types[0].items.map((row) => row.natural)).toEqual(['الأحدث', 'الأقدم']);
  });

  it('كل مثالٍ يعرف ذكراه — الرقم مدخلٌ لا زينة', async () => {
    await fresh();
    const s = await scene('قعدة الشلّة', '2026-04-01');
    await addMistake(s.id, { wrong: 'a', natural: 'b', mistakeType: 'case' });

    const out = await mistakePatterns();
    expect(out.types[0].items[0].sceneId).toBe(s.id);
    expect(out.types[0].items[0].sceneTitle).toBe('قعدة الشلّة');
  });

  it('⚠️ تصحيحٌ في ذكرى محذوفة لا يُعَدّ', async () => {
    await fresh();
    const a = await scene('باقية', '2026-04-01');
    const b = await scene('هتتحذف', '2026-04-02');
    await addMistake(a.id, { wrong: 'a', natural: 'b', mistakeType: 'gender' });
    await addMistake(b.id, { wrong: 'c', natural: 'd', mistakeType: 'gender' });
    expect((await mistakePatterns()).total).toBe(2);

    await scenes.trash(b.id);
    expect((await mistakePatterns()).total).toBe(1);
  });

  it('عدد الأمثلة محدود، والباقي معلومٌ لا مخفيّ', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    for (let i = 0; i < 7; i += 1) {
      await addMistake(s.id, { wrong: `x${i}`, natural: `y${i}`, mistakeType: 'case' });
    }

    const out = await mistakePatterns({ examples: 3 });
    expect(out.types[0].count).toBe(7);
    expect(out.types[0].items.length).toBe(3);
  });

  it('⚠️ ولا تُعاد نسبةُ أخطاء — المقام مجهول', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addMistake(s.id, { wrong: 'a', natural: 'b', mistakeType: 'gender' });

    const out = await mistakePatterns();
    // لو ظهر حقلٌ اسمه نسبة يومًا، فقد سقط بند 74.
    expect(out.rate).toBe(undefined);
    expect(out.percent).toBe(undefined);
    expect(Boolean(NOT_MEASURED.errorRate)).toBe(true);
  });

  it('عالمٌ بلا تصحيحات يعطي صفرًا صادقًا', async () => {
    await fresh();
    const out = await mistakePatterns();
    expect(out.total).toBe(0);
    expect(out.types).toEqual([]);
  });
});

/* ================================================================== */

describe('ما تلتقطه ولماذا', () => {
  it('يتجمّع بالتصنيف بوسمه العربي', async () => {
    await fresh();
    await saveItem({ text: 'связь', kind: SAVED_KIND.WORD, tagIds: ['hard'] });
    await saveItem({ text: 'мост', kind: SAVED_KIND.WORD, tagIds: ['hard', 'pron'] });

    const out = await captureReasons();
    expect(out.total).toBe(2);
    expect(out.tags[0].label).toBe('صعبة');
    expect(out.tags[0].count).toBe(2);
    expect(out.tags.find((t) => t.id === 'pron').count).toBe(1);
  });

  it('بلا تصنيف يُعرَض كما هو لا يُطرَح صامتًا', async () => {
    await fresh();
    await saveItem({ text: 'связь', kind: SAVED_KIND.WORD });
    await saveItem({ text: 'мост', kind: SAVED_KIND.WORD, tagIds: ['hard'] });

    const out = await captureReasons();
    expect(out.total).toBe(2);
    expect(out.untagged).toBe(1);
  });

  it('المحفوظة المحذوفة تخرج من العدّ', async () => {
    await fresh();
    const item = await saveItem({ text: 'связь', kind: SAVED_KIND.WORD, tagIds: ['hard'] });
    await savedItems.trash(item.id);
    expect((await captureReasons()).total).toBe(0);
  });
});

/* ================================================================== */

describe('أين لغتك تعيش — من الأطلس لا من عدٍّ ثانٍ', () => {
  it('⚠️ العدد يطابق ما يقوله الأطلس نفسه', async () => {
    await fresh();
    const a = await scene('أ', '2026-04-01', { type: 'phone', placeName: 'المكتب' });
    await scene('ب', '2026-04-02', { type: 'phone', placeName: 'المكتب' });
    await scene('ج', '2026-04-03', { type: 'meeting' });

    const [mine, tree] = await Promise.all([whereRussianLives(), facetTree()]);
    const treeTypes = new Map(tree.types.map((t) => [t.id, t.count]));
    for (const row of mine.types) expect(row.count).toBe(treeTypes.get(row.id));
    expect(mine.places[0].count).toBe(tree.places[0].count);
  });

  it('⚠️ الأنواع مرتّبة بالعدد — والأطلس لا يرتّبها', async () => {
    await fresh();
    await scene('أ', '2026-04-01', { type: 'meeting' });
    await scene('ب', '2026-04-02', { type: 'phone' });
    await scene('ج', '2026-04-03', { type: 'phone' });
    await scene('د', '2026-04-04', { type: 'phone' });

    const out = await whereRussianLives();
    expect(out.types[0].id).toBe('phone');
    expect(out.types[0].count).toBe(3);
  });

  it('لكل نوعٍ وسمٌ عربيّ لا معرّفٌ خام', async () => {
    await fresh();
    await scene('أ', '2026-04-01', { type: 'meeting' });
    const out = await whereRussianLives();
    expect(out.types[0].label).toBe('اجتماع شغل');
  });

  it('السقف يُحترَم', async () => {
    await fresh();
    for (let i = 0; i < 6; i += 1) {
      await scene(`ذكرى ${i}`, `2026-04-0${i + 1}`, { placeName: `مكان ${i}` });
    }
    expect((await whereRussianLives({ limit: 3 })).places.length).toBe(3);
  });

  it('مَن تكلّم يظهر في الناس', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    const person = await addPerson({ name: 'إيجور' });
    await addConversationPart(s.id, { speaker: 'إيجور', text: 'Привет', personId: person.id });

    const out = await whereRussianLives();
    expect(out.people[0].label).toBe('إيجور');
    expect(out.people[0].count).toBe(1);
  });
});

/* ================================================================== */

describe('الإيقاع — واقعةٌ لا حكم', () => {
  it('يعدّ الذكريات والأيام والمدى', async () => {
    await fresh();
    await scene('أ', '2026-04-01');
    await scene('ب', '2026-04-01');   // نفس اليوم
    await scene('ج', '2026-04-11');

    const out = await rhythm();
    expect(out.total).toBe(3);
    expect(out.days).toBe(2);
    expect(out.span).toBe(10);
  });

  it('أطول فترة سكوت معلومةٌ بطرفيها', async () => {
    await fresh();
    await scene('أ', '2026-04-01');
    await scene('ب', '2026-04-03');
    await scene('ج', '2026-06-03');

    const out = await rhythm();
    expect(out.longestGap.days).toBe(61);
    expect(out.longestGap.from).toBe('2026-04-03');
    expect(out.longestGap.to).toBe('2026-06-03');
  });

  it('التوزيع الشهريّ مرتّبٌ تصاعديًّا', async () => {
    await fresh();
    await scene('ج', '2026-06-01');
    await scene('أ', '2026-04-01');
    await scene('ب', '2026-04-20');

    const out = await rhythm();
    expect(out.byMonth.map((m) => m.month)).toEqual(['2026-04', '2026-06']);
    expect(out.byMonth[0].count).toBe(2);
  });

  it('⚠️ ولا يُعاد منه «تقدّم» — بند 74', async () => {
    await fresh();
    await scene('أ', '2026-04-01');
    const out = await rhythm();
    expect(out.progress).toBe(undefined);
    expect(out.trend).toBe(undefined);
    expect(Boolean(NOT_MEASURED.progress)).toBe(true);
  });

  it('عالمٌ فارغ يعطي أصفارًا ولا يرمي', async () => {
    await fresh();
    const out = await rhythm();
    expect(out.total).toBe(0);
    expect(out.longestGap).toBe(null);
    expect(out.byMonth).toEqual([]);
  });
});

/* ================================================================== */

describe('الممارسة — ولا تُقرأ إتقانًا', () => {
  it('⚠️ الرقم يعود ومعه ما يعنيه ولا يعنيه', async () => {
    await fresh();
    await practiceEvidence.create({
      sessionId: 'SES_1', targetType: 'shadowSegment', targetId: 'SEG_1',
      practiceType: 'shadowing', repetitions: 5, practicedAt: Date.parse('2026-04-01'),
      meaning: 'practiced', impliesRealUsage: false, impliesMastery: false,
    });

    const out = await practiceReality();
    expect(out.repetitions).toBe(5);
    // العَلَمان يرافقان الرقم، فلا تقرؤه شاشةٌ قادمة على غير معناه.
    expect(out.meansMastery).toBe(false);
    expect(out.meansRealUsage).toBe(false);
  });

  it('يعدّ الجلسات والأيام بلا تكرار', async () => {
    await fresh();
    const day = Date.parse('2026-04-01T10:00:00Z');
    for (const [session, at] of [['SES_1', day], ['SES_1', day + 3600e3], ['SES_2', day + 86400e3]]) {
      await practiceEvidence.create({
        sessionId: session, targetType: 'shadowSegment', targetId: 'SEG',
        practiceType: 'shadowing', repetitions: 2, practicedAt: at,
        meaning: 'practiced', impliesRealUsage: false, impliesMastery: false,
      });
    }

    const out = await practiceReality();
    expect(out.sessions).toBe(2);
    expect(out.days).toBe(2);
    expect(out.repetitions).toBe(6);
  });

  it('بلا ممارسة: أصفارٌ لا سقوط', async () => {
    await fresh();
    const out = await practiceReality();
    expect(out.repetitions).toBe(0);
    expect(out.sessions).toBe(0);
  });
});

/* ================================================================== */

describe('ما لا يُقاس — مُعلَنٌ لا مسكوتٌ عنه', () => {
  it('كل مدخلٍ في `NOT_MEASURED` معه سببٌ حقيقيّ', async () => {
    const entries = Object.entries(NOT_MEASURED);
    expect(entries.length > 0).toBe(true);
    for (const [key, reason] of entries) {
      expect(key.length > 0).toBe(true);
      // سببٌ يشرح، لا «مش متاح».
      expect(typeof reason === 'string' && reason.length > 40).toBe(true);
    }
  });

  it('النظرة العامّة تحمل الإعلان معها', async () => {
    await fresh();
    const out = await analysisOverview();
    expect(out.notMeasured).toBe(NOT_MEASURED);
    expect(Boolean(out.notMeasured.fluency)).toBe(true);
  });

  it('⚠️ النظرة العامّة لا تعيد رقمًا مركَّبًا واحدًا', async () => {
    await fresh();
    const s = await scene('ذكرى', '2026-04-01');
    await addMistake(s.id, { wrong: 'a', natural: 'b', mistakeType: 'gender' });

    const out = await analysisOverview();
    // «درجة لغتك ٧٢» هي بالضبط ما يمنعه بند 74.
    expect(out.score).toBe(undefined);
    expect(out.level).toBe(undefined);
    expect(out.grade).toBe(undefined);
  });

  it('النظرة العامّة تجمع الأقسام كلها على عالمٍ فارغ', async () => {
    await fresh();
    const out = await analysisOverview();
    expect(out.mistakes.total).toBe(0);
    expect(out.captures.total).toBe(0);
    expect(out.rhythm.total).toBe(0);
    expect(out.practice.repetitions).toBe(0);
    expect(out.expressionAppearances).toBe(0);
  });
});

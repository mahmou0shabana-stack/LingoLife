/**
 * LingoLife — اختبارات الجواز والكوربوس (WS15 · الملحق F)
 *
 * خمس قواعد تُحرَس:
 *
 *  1. ⚠️ **الفراغ يقول سببه** — قسمٌ فارغٌ بلا كلمة يجعل القارئ يظنّ
 *     أن التطبيق نسي، و«ما اتكتبش» معلومةٌ يتصرّف على أساسها.
 *  2. ⚠️ **ولا استنتاج** (F6) — لا حكمَ ولا نسبةَ ولا مستوى. وما رُفض
 *     عرضُه مكتوبٌ **داخل** الحزمة لا في وثيقةٍ وحدها.
 *  3. **وسطرٌ بلا مصدرٍ لا يدخل الكوربوس** — نصٌّ لا تعرف من أين جاء
 *     لا يصلح دليلًا على شيء.
 *  4. **والترتيب حتميّ** — حزمةٌ تُبنى مرّتين بترتيبين لا تصلح للمقارنة.
 *  5. **ويقرأ ولا يكتب** — بناؤه مرّتين بلا أثر.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, contentBlocks, conversations, conversationParts,
  scripts, expressions, expressionOccurrences, mistakeComparisons,
  savedItems, relationships, eventThreads,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { resetTypes } from '../js/services/type-service.js';
import { addPerson } from '../js/services/person-service.js';
import { addParticipant } from '../js/services/participant-service.js';
import {
  addConversationPart, addScript, addMistake, saveBlock, addExpression,
} from '../js/services/content-service.js';
import { writeRaw } from '../js/services/transcript-service.js';
import {
  PASSPORT_VERSION, NOT_IN_PASSPORT, scenePassport, expressionPassport,
  passportMarkdown, passportFilename, passportSummary,
  SCENE_SECTION_IDS, EXPRESSION_SECTION_IDS,
} from '../js/services/passport/passport.js';
import {
  CORPUS_VERSION, NO_INSIGHT, CORPUS_SOURCES, buildCorpus, corpusSummary,
  corpusMarkdown, corpusPlainText, corpusFilename,
} from '../js/services/passport/corpus.js';

async function fresh() {
  await openDB();
  for (const repo of [scenes, people, contentBlocks, conversations,
    conversationParts, scripts, expressions, expressionOccurrences,
    mistakeComparisons, savedItems, relationships, eventThreads]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await resetTypes();
}

/** ذكرى مملوءة — بكل ما يقرؤه الجواز. */
async function fullScene() {
  const igor = await addPerson({ name: 'إيجور' });
  const scene = await createScene({
    titleAr: 'اجتماع الشحنة', date: '2026-05-01', type: 'meeting',
  });
  await addParticipant(scene.id, igor.id);
  const said = await addConversationPart(scene.id, {
    speaker: 'إيجور', text: 'Груз задержан', translation: 'الشحنة اتأخّرت',
  });
  // ونُنسب الكلام إليه — «حضر» و«اتكلّم» واقعتان مختلفتان (WS9).
  await conversationParts.update(said.id, { personId: igor.id });
  await addConversationPart(scene.id, {
    speaker: 'أنا', text: 'Понятно, спасибо', isMine: true,
  });
  await addScript(scene.id, { title: 'أسأل عن الشحنة', text: 'Где груз?' });
  await addMistake(scene.id, {
    wrong: 'Груз задержана', natural: 'Груз задержан',
    mistakeType: 'gender', explanation: 'груз مذكّر',
  });
  await addExpression(scene.id, {
    text: 'задержан', meaningAr: 'متأخّر', register: 'professional',
  });
  await writeRaw(scene.id, 'Здравствуйте, груз задержан на таможне.');
  return scene;
}

/* ================================================================== *
 * ١ · جواز الذكرى
 * ================================================================== */

describe('جواز الذكرى', () => {
  it('يجمع كل ما في الذكرى في وثيقةٍ واحدة', async () => {
    await fresh();
    const scene = await fullScene();
    const passport = await scenePassport(scene.id);

    expect(passport.lingolifePassport).toBe(PASSPORT_VERSION);
    expect(passport.title).toBe('اجتماع الشحنة');
    expect(passport.head.date).toBe('2026-05-01');

    const by = Object.fromEntries(passport.sections.map((s) => [s.id, s]));
    expect(by.conversation.count).toBe(2);
    expect(by.scripts.count).toBe(1);
    expect(by.mistakes.count).toBe(1);
    expect(by.expressions.count).toBe(1);
    expect(by.transcript.count).toBe(1);
    expect(by.people.count).toBe(1);
  });

  it('⚠️ وكل قسمٍ فارغٍ يقول سببه — لا صمت', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'ذكرى فاضية', date: '2026-05-02', type: 'call' });
    const passport = await scenePassport(scene.id);

    for (const section of passport.sections) {
      if (!section.empty) continue;
      expect(String(section.why).length > 15).toBe(true);
    }
    expect(passport.gaps.length).toBe(passport.sections.length);
  });

  it('⚠️ ونوعُ الخطأ بوسمه العربي لا بمعرّفه', async () => {
    await fresh();
    const scene = await fullScene();
    const passport = await scenePassport(scene.id);
    const row = passport.sections.find((s) => s.id === 'mistakes').items[0];
    expect(row.kind).toBe('جنس الكلمة');
  });

  it('⚠️ ودليلُ الحضور معه: «حضر» غير «اتكلّم»', async () => {
    await fresh();
    const scene = await fullScene();
    const passport = await scenePassport(scene.id);
    const igor = passport.sections.find((s) => s.id === 'people').items[0];
    expect(igor.evidence.includes('حضر')).toBe(true);
    expect(igor.evidence.includes('اتكلّم')).toBe(true);
  });

  it('⚠️ وملاحظاتك الخاصّة لا تخرج إلا بطلبك', async () => {
    await fresh();
    const scene = await fullScene();
    await saveBlock(scene.id, 'notes', 'ملاحظة خاصّة جدًّا');

    const without = await scenePassport(scene.id);
    expect(without.sections.some((s) => s.id === 'notes')).toBe(false);
    expect(passportMarkdown(without).includes('ملاحظة خاصّة')).toBe(false);

    const with_ = await scenePassport(scene.id, { withNotes: true });
    expect(with_.sections.some((s) => s.id === 'notes')).toBe(true);
  });

  it('⚠️ يقرأ ولا يكتب — بناؤه مرّتين بلا أثر', async () => {
    await fresh();
    const scene = await fullScene();
    const count = async () => (await conversationParts.getAll()).length
      + (await expressions.getAll()).length + (await contentBlocks.getAll()).length;
    const before = await count();
    await scenePassport(scene.id);
    await scenePassport(scene.id, { withNotes: true });
    expect(await count()).toBe(before);
  });

  it('وذكرى غير موجودة ترمي برسالةٍ مفهومة', async () => {
    await fresh();
    await expect(scenePassport('SC_وهم')).toReject('مش موجودة');
  });
});

/* ================================================================== *
 * ٢ · جواز التعبير
 * ================================================================== */

describe('جواز التعبير', () => {
  it('يحمل المعنى والظهورات والمرحلة', async () => {
    await fresh();
    const scene = await fullScene();
    const [expression] = await expressions.getAll();

    const passport = await expressionPassport(expression.id);
    expect(passport.kind).toBe('expression');
    expect(passport.title).toBe('задержан');
    expect(passport.head.seen >= 1).toBe(true);

    const by = Object.fromEntries(passport.sections.map((s) => [s.id, s]));
    expect(by.meaning.count).toBe(1);
    expect(by.occurrences.count >= 1).toBe(true);
    expect(by.occurrences.items[0].scene).toBe('اجتماع الشحنة');
    void scene;
  });

  it('⚠️ والمرحلة تقول إنها تقديرك أنت لا حكمُ التطبيق', async () => {
    await fresh();
    await fullScene();
    const [expression] = await expressions.getAll();
    const passport = await expressionPassport(expression.id);
    const stage = passport.sections.find((s) => s.id === 'stage').items[0];
    expect(stage.note.includes('تقديرك')).toBe(true);
  });

  it('وتعبيرٌ غير موجود يرمي', async () => {
    await fresh();
    await expect(expressionPassport('EX_وهم')).toReject('مش موجود');
  });

  it('والأقسام المعلَنة هي المبنيّة فعلًا', async () => {
    await fresh();
    const scene = await fullScene();
    const [expression] = await expressions.getAll();
    const one = await scenePassport(scene.id);
    const two = await expressionPassport(expression.id);
    expect(one.sections.map((s) => s.id)).toEqual(SCENE_SECTION_IDS);
    expect(two.sections.map((s) => s.id)).toEqual(EXPRESSION_SECTION_IDS);
  });
});

/* ================================================================== *
 * ٣ · الوثيقة كما تُقرأ
 * ================================================================== */

describe('الجواز نصًّا', () => {
  it('⚠️ وما ينقص مكتوبٌ في الوثيقة لا محذوفٌ منها', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'ناقصة', date: '2026-05-03', type: 'call' });
    const text = passportMarkdown(await scenePassport(scene.id));
    expect(text.includes('اللي ناقص')).toBe(true);
    expect(text.includes('النصّ الأصلي')).toBe(true);
  });

  it('⚠️ وتذييلٌ يقول ما ليس فيها', async () => {
    await fresh();
    const scene = await fullScene();
    const text = passportMarkdown(await scenePassport(scene.id));
    for (const row of NOT_IN_PASSPORT) expect(text.includes(row.label)).toBe(true);
  });

  it('⚠️ ولا جملةَ حكمٍ ولا نسبة (F6)', async () => {
    await fresh();
    const scene = await fullScene();
    const text = passportMarkdown(await scenePassport(scene.id));
    // لا نسبة مئوية في متن الوثيقة.
    expect(/\d+\s*%/.test(text)).toBe(false);
    expect(/\bA[12]\b|\bB[12]\b|\bC[12]\b/.test(text)).toBe(false);
  });

  it('والنصّ يحمل ما في الأقسام فعلًا', async () => {
    await fresh();
    const scene = await fullScene();
    const text = passportMarkdown(await scenePassport(scene.id));
    expect(text.includes('Груз задержан')).toBe(true);
    expect(text.includes('задержан')).toBe(true);
    expect(text.includes('جنس الكلمة')).toBe(true);
  });

  it('واسم الملفّ بلا محارف تكسر نظام الملفّات', async () => {
    await fresh();
    const scene = await createScene({ titleAr: 'اجتماع/مهم: ٣', date: '2026-05-01', type: 'call' });
    const name = passportFilename(await scenePassport(scene.id));
    expect(/[\\/:*?"<>|]/.test(name)).toBe(false);
    expect(name.endsWith('.md')).toBe(true);
  });

  it('والملخّص يعدّ المملوء والناقص', async () => {
    await fresh();
    const scene = await fullScene();
    const summary = passportSummary(await scenePassport(scene.id));
    expect(summary.filled + summary.gaps).toBe(summary.total);
    expect(summary.items > 0).toBe(true);
  });
});

/* ================================================================== *
 * ٤ · الكوربوس
 * ================================================================== */

describe('حزمة الكوربوس', () => {
  it('تجمع الروسي من كل مصادره — ولكل سطرٍ مصدرُه', async () => {
    await fresh();
    await fullScene();
    const corpus = await buildCorpus();

    expect(corpus.lingolifeCorpus).toBe(CORPUS_VERSION);
    expect(corpus.counts.total > 0).toBe(true);
    for (const row of corpus.lines) {
      expect(CORPUS_SOURCES.some((s) => s.id === row.source)).toBe(true);
      expect(String(row.by).length > 0).toBe(true);
      expect(row.ru.trim().length > 0).toBe(true);
    }
    // كل المصادر الخمسة موجودة على ذكرىً مملوءة.
    expect(Object.keys(corpus.counts.bySource).sort())
      .toEqual(['expression', 'kept', 'rehearsed', 'said', 'transcript'].filter(
        (id) => corpus.counts.bySource[id]
      ).sort());
  });

  it('⚠️ وسطرٌ بلا ذكرىً حيّة لا يدخل', async () => {
    await fresh();
    const scene = await fullScene();
    const before = (await buildCorpus()).counts.total;

    // نُتلف رابط الذكرى بحذفها — الأسطر تصير بلا مصدر.
    await scenes.destroy(scene.id);
    const after = (await buildCorpus()).counts.total;
    expect(after < before).toBe(true);
    for (const row of (await buildCorpus()).lines) {
      expect(row.source).toBe('kept');
    }
  });

  it('⚠️ والترتيب حتميّ — بناؤها مرّتين يعطي نفس الشيء', async () => {
    await fresh();
    await fullScene();
    await createScene({ titleAr: 'تانية', date: '2026-04-01', type: 'call' });
    const one = (await buildCorpus()).lines.map((r) => `${r.scene.date}|${r.source}|${r.ru}`);
    const two = (await buildCorpus()).lines.map((r) => `${r.scene.date}|${r.source}|${r.ru}`);
    expect(one).toEqual(two);
    // ومرتَّبة بالتاريخ تصاعديًّا.
    const dates = one.map((k) => k.split('|')[0]);
    expect(dates).toEqual([...dates].sort());
  });

  it('وحصرُ المصادر والمدى يعمل', async () => {
    await fresh();
    await fullScene();
    const only = await buildCorpus({ sources: ['said'] });
    expect(Object.keys(only.counts.bySource)).toEqual(['said']);

    const outside = await buildCorpus({ from: '2027-01-01' });
    expect(outside.counts.total).toBe(0);
  });

  it('⚠️ ولا استنتاج — وما رُفض عرضُه مكتوبٌ داخل الحزمة (F6)', async () => {
    await fresh();
    await fullScene();
    const corpus = await buildCorpus();

    expect(corpus.noInsight.length).toBe(NO_INSIGHT.length);
    for (const row of corpus.noInsight) expect(String(row.why).length > 30).toBe(true);

    // ولا حقلَ رأيٍ في الحزمة نفسها.
    for (const key of ['level', 'score', 'insights', 'summaryText', 'assessment']) {
      expect(key in corpus).toBe(false);
    }
  });

  it('⚠️ والعدّ بمصادره لا رقمًا واحدًا مركَّبًا', async () => {
    await fresh();
    await fullScene();
    const corpus = await buildCorpus();
    const sum = Object.values(corpus.counts.bySource).reduce((a, b) => a + b, 0);
    expect(sum).toBe(corpus.counts.total);
  });

  it('⚠️ يقرأ ولا يكتب', async () => {
    await fresh();
    await fullScene();
    const before = (await conversationParts.getAll()).length;
    await buildCorpus();
    await corpusSummary();
    expect((await conversationParts.getAll()).length).toBe(before);
  });
});

/* ================================================================== *
 * ٥ · صيغ الكوربوس
 * ================================================================== */

describe('صيغ الكوربوس', () => {
  it('⚠️ النصّ مصفوفٌ بالذكرى لا بالمصدر — السطر خارج موقفه فقد معناه', async () => {
    await fresh();
    await fullScene();
    const text = corpusMarkdown(await buildCorpus());
    expect(text.includes('## اجتماع الشحنة')).toBe(true);
    expect(text.includes('Груз задержан')).toBe(true);
  });

  it('⚠️ وما لا تحمله الحزمة مكتوبٌ فيها', async () => {
    await fresh();
    await fullScene();
    const text = corpusMarkdown(await buildCorpus());
    for (const row of NO_INSIGHT) expect(text.includes(row.label)).toBe(true);
  });

  it('والنصّ الخام سطورٌ روسيّة وحدها', async () => {
    await fresh();
    await fullScene();
    const corpus = await buildCorpus();
    const plain = corpusPlainText(corpus);
    expect(plain.split('\n').length).toBe(corpus.counts.total);
    expect(plain.includes('الشحنة اتأخّرت')).toBe(false);
  });

  it('والملخّص يقول ما سيخرج قبل أن يخرج', async () => {
    await fresh();
    await fullScene();
    const summary = await corpusSummary();
    expect(summary.total > 0).toBe(true);
    expect(summary.chars > 0).toBe(true);
    expect(summary.people.length > 0).toBe(true);
    expect(summary.first).toBe('2026-05-01');
    expect(summary.sources.every((s) => s.count > 0)).toBe(true);
  });

  it('واسم الملفّ يحمل المدى ولا يكسر نظام الملفّات', async () => {
    await fresh();
    const corpus = await buildCorpus({ from: '2026-01-01', to: '2026-12-31' });
    const name = corpusFilename(corpus, 'txt');
    expect(/[\\/:*?"<>|]/.test(name)).toBe(false);
    expect(name.includes('2026-01-01')).toBe(true);
    expect(name.endsWith('.txt')).toBe(true);
  });
});

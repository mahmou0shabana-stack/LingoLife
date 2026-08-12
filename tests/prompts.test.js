/**
 * LingoLife — اختبارات مكتبة الطلبات (WS11/WS12 · الملحق H + C)
 *
 * خمس قواعد تُحرَس:
 *
 *  1. ⚠️ **شكل الردّ لا ينحرف عن القارئ** — وهي كلُّ فائدة H5. اختبارُ
 *     ذهابٍ وعودة يبني حزمةً من الشكل المولَّد ويطالب `parsePackage`
 *     بأن تقرأ **كل حقلٍ فيها**. فحقلٌ يُضاف بلا قارئ، أو يُقرأ بلا
 *     أن يُذكَر، يُسقط الاختبار.
 *  2. **ما لا يُستوعَب يُقال للمحلِّل صراحةً** — لا كي يُهمَل صامتًا.
 *  3. **الطلب يقرأ ولا يكتب** — بناؤه مرّتين بلا أثر.
 *  4. **تعليماتك تُلحَق ولا تُستبدِل** — فسطرٌ منك لا يمحو «ماتخترعش».
 *  5. ⚠️ **ومسارُ «ذكرى من مادّة خام» هو المسار نفسه** (C5): بلا
 *     `forSceneId`، والردّ حزمةٌ عاديّة تمرّ بالخطّة والمعاينة.
 */

import { describe, it, expect } from './test-runner.js';
import { openDB } from '../js/db/database.js';
import {
  scenes, people, contentBlocks, conversations, conversationParts,
  scripts, expressions, expressionOccurrences, mistakeComparisons, settings,
} from '../js/db/repositories.js';
import { createScene } from '../js/services/scene-service.js';
import { resetTypes } from '../js/services/type-service.js';
import { addConversationPart } from '../js/services/content-service.js';
import {
  SUPPORTED, REQUIRED, FIELDS, NOT_SUPPORTED, PACKAGE_FORMAT_VERSION,
} from '../js/services/import/package-format.js';
import {
  replyShape, contractRules, contractBlock, ASKED_KINDS, CONTRACT_VERSION,
} from '../js/services/prompts/contract.js';
import {
  PROMPTS, NOT_A_PROMPT, NEVER_ASKED, promptById, promptCard,
  buildPrompt, previewInstructions, requestSummary, requestFilename,
  extraInstructions, setExtraInstructions,
} from '../js/services/prompts/library.js';
import { buildAnalysisRequest } from '../js/services/analysis/request.js';
import { parsePackage } from '../js/services/import/parse.js';
import { planImport, ACTION } from '../js/services/import/plan.js';

async function fresh() {
  await openDB();
  for (const repo of [scenes, people, contentBlocks, conversations,
    conversationParts, scripts, expressions, expressionOccurrences, mistakeComparisons]) {
    for (const row of await repo.getAll()) await repo.destroy(row.id);
  }
  await settings.remove('prompts.extra');
  await resetTypes();
}

async function seededScene() {
  const scene = await createScene({
    titleAr: 'اجتماع الشحنة', date: '2026-05-01', type: 'meeting',
  });
  await addConversationPart(scene.id, { speaker: 'إيجور', text: 'Груз задержан' });
  return scene;
}

/* ================================================================== *
 * ١ · العقد — مُولَّدٌ لا مكتوبٌ بيد
 * ================================================================== */

describe('عقد الردّ · مُولَّد من صيغة الحزمة', () => {
  it('⚠️ كل نوعٍ مدعوم مذكورٌ في الشكل — فما يُضاف غدًا يُطلَب تلقائيًّا', () => {
    const text = replyShape().join('\n');
    for (const kind of Object.keys(SUPPORTED)) {
      if (!text.includes(`"${kind}"`)) {
        throw new Error(`«${kind}» مدعومٌ في القراءة ولا يُطلَب في الردّ`);
      }
    }
    expect(ASKED_KINDS.length).toBe(Object.keys(SUPPORTED).length);
    // ⚠️ ولكلٍّ حقولٌ فعلًا — لا سطرٌ فارغٌ صحيحُ الشكل.
    for (const kind of ASKED_KINDS) {
      expect((FIELDS[kind] || []).length > 0).toBe(true);
    }
  });

  it('⚠️ وكل حقلٍ مطلوبٍ مذكورٌ بالاسم', () => {
    const text = replyShape().join('\n');
    for (const [kind, fields] of Object.entries(REQUIRED)) {
      for (const name of fields) {
        if (!text.includes(`"${name}"`)) {
          throw new Error(`«${kind}.${name}» مطلوبٌ ولا يُذكَر في الشكل`);
        }
      }
      // و`FIELDS` تعرفه أيضًا — وإلا انفصل الجدولان.
      const known = (FIELDS[kind] || []).filter((f) => f.req).map((f) => f.name);
      expect(known.sort()).toEqual([...fields].sort());
    }
  });

  it('⚠️ وما لا يُستوعَب يُقال للمحلِّل بأسمائه لا يُهمَل صامتًا', () => {
    const text = contractRules().join('\n');
    for (const [kind, why] of Object.entries(NOT_SUPPORTED)) {
      expect(text.includes(kind)).toBe(true);
      expect(String(why).length > 10).toBe(true);
    }
  });

  it('والشكل المولَّد بلا فاصلةٍ أخيرة — مثالٌ صالح', () => {
    const lines = replyShape();
    expect(lines[0]).toBe('{');
    expect(lines[lines.length - 1]).toBe('}');
    expect(lines[lines.length - 2].endsWith(',')).toBe(false);
  });

  it('وما يُستبعَد لطلبٍ بعينه يختفي من شكله', () => {
    const withThread = replyShape().join('\n');
    const without = replyShape({ omit: ['eventThread'] }).join('\n');
    expect(withThread.includes('"eventThread"')).toBe(true);
    expect(without.includes('"eventThread"')).toBe(false);
  });

  it('⚠️ ونسخة العقد هي نسخة الحزمة — لا رقمان يفترقان', () => {
    expect(CONTRACT_VERSION).toBe(PACKAGE_FORMAT_VERSION);
  });
});

/* ================================================================== *
 * ٢ · ذهابٌ وعودة — الحارس الحقيقي لـH5
 * ================================================================== */

describe('⚠️ الشكل المولَّد يقرؤه القارئ نفسه', () => {
  /**
   * يبني حزمةً تملأ **كل** حقلٍ يذكره العقد، بقيمٍ مميَّزة.
   * ⚠️ القيمة تحمل اسم حقلها، فلو قرأ القارئُ حقلًا في موضع آخر
   *    ظهر ذلك في المقارنة بدل أن يمرّ.
   */
  function packageFromContract() {
    const value = (kind, name) => {
      if (name === 'date') return '2026-05-01';
      if (name === 'isMe') return false;
      if (name === 'status') return 'active';
      if (name === 'register') return 'professional';
      if (name === 'mistakeType') return 'grammar';
      if (name === 'eventType') return 'اجتماع';
      return `${kind}.${name}`;
    };
    const rowOf = (kind) => Object.fromEntries(
      (FIELDS[kind] || []).map((f) => [f.name, value(kind, f.name)])
    );

    const pkg = { lingolifeScene: PACKAGE_FORMAT_VERSION };
    for (const kind of ASKED_KINDS) {
      pkg[kind] = (kind === 'scene' || kind === 'eventThread')
        ? rowOf(kind)
        : [rowOf(kind)];
    }
    return pkg;
  }

  it('كل حقلٍ يذكره العقد يصل إلى المقروء — ولا حقلَ يضيع', async () => {
    const { pkg, issues } = parsePackage(JSON.stringify(packageFromContract()));
    expect(issues.filter((i) => i.level === 'fatal')).toHaveLength(0);
    expect(Boolean(pkg)).toBe(true);

    /* الذكرى */
    expect(pkg.scene.title).toBe('scene.title');
    expect(pkg.scene.titleRu).toBe('scene.titleRu');
    expect(pkg.scene.placeName).toBe('scene.placeName');
    expect(pkg.scene.eventType).toBe('اجتماع');
    expect(pkg.scene.date).toBe('2026-05-01');

    /* الأشخاص */
    expect(pkg.people[0].name).toBe('people.name');
    expect(pkg.people[0].nameRu).toBe('people.nameRu');
    expect(pkg.people[0].role).toBe('people.role');
    expect(pkg.people[0].company).toBe('people.company');

    /* السكريبت */
    expect(pkg.scripts[0].text).toBe('scripts.text');
    expect(pkg.scripts[0].title).toBe('scripts.title');
    expect(pkg.scripts[0].translation).toBe('scripts.translation');

    /* المحادثة */
    expect(pkg.conversationParts[0].text).toBe('conversationParts.text');
    expect(pkg.conversationParts[0].speaker).toBe('conversationParts.speaker');
    expect(pkg.conversationParts[0].translation).toBe('conversationParts.translation');

    /* التصحيح */
    expect(pkg.mistakes[0].wrong).toBe('mistakes.wrong');
    expect(pkg.mistakes[0].natural).toBe('mistakes.natural');
    expect(pkg.mistakes[0].mistakeType).toBe('grammar');
    expect(pkg.mistakes[0].explanation).toBe('mistakes.note');

    /* التعبير */
    expect(pkg.expressions[0].text).toBe('expressions.text');
    expect(pkg.expressions[0].meaningAr).toBe('expressions.meaningAr');
    expect(pkg.expressions[0].note).toBe('expressions.note');
    expect(pkg.expressions[0].example).toBe('expressions.example');

    /* الخيط */
    expect(pkg.eventThread.title).toBe('eventThread.title');
    expect(pkg.eventThread.description).toBe('eventThread.description');
  });

  it('⚠️ وما يُعلَن أنه لا يُستورَد يُستبعَد بسببه لا صامتًا', async () => {
    const pkg = packageFromContract();
    pkg.topics = [{ name: 'الجمارك' }];
    const { pkg: read } = parsePackage(JSON.stringify(pkg));
    const skipped = read.skipped.find((row) => row.kind === 'topics');
    expect(Boolean(skipped)).toBe(true);
    expect(String(skipped.reason).length > 10).toBe(true);
  });
});

/* ================================================================== *
 * ٣ · السجلّ
 * ================================================================== */

describe('مكتبة الطلبات · السجلّ', () => {
  it('كل طلبٍ يقول ما يسأله وما يحتاجه وبماذا يرجع', () => {
    expect(PROMPTS.length >= 3).toBe(true);
    for (const prompt of PROMPTS) {
      expect(String(prompt.label).length > 0).toBe(true);
      expect(String(prompt.purpose).length > 20).toBe(true);
      expect(['scene', 'material'].includes(prompt.needs)).toBe(true);
      expect(prompt.version >= 1).toBe(true);
      expect(promptCard(prompt).returns.length > 0).toBe(true);
    }
  });

  it('⚠️ وما يُستبعَد من طلبٍ له سببٌ مكتوب', () => {
    for (const prompt of PROMPTS) {
      for (const [kind, why] of Object.entries(prompt.omit || {})) {
        expect(Object.keys(SUPPORTED).includes(kind)).toBe(true);
        expect(String(why).length > 20).toBe(true);
      }
    }
  });

  it('⚠️ وما لا يصير طلبًا له سببٌ بنيويّ', () => {
    expect(NOT_A_PROMPT.length > 0).toBe(true);
    for (const row of NOT_A_PROMPT) expect(String(row.why).length > 30).toBe(true);
    expect(NEVER_ASKED.length > 0).toBe(true);
    for (const row of NEVER_ASKED) expect(String(row.why).length > 30).toBe(true);
  });

  it('⚠️ ولكل نوعٍ مدعوم اسمٌ عربيّ — لا كلمةَ إنجليزيّةٍ في شاشةٍ عربيّة', () => {
    for (const prompt of PROMPTS) {
      const card = promptCard(prompt);
      for (const name of [...card.returns, ...card.omitted.map((row) => row.kind)]) {
        if (/^[a-zA-Z]+$/.test(name)) {
          throw new Error(`«${name}» بيتعرض بالإنجليزي — ناقص في KIND_NAMES`);
        }
      }
    }
  });

  it('⚠️ ومعاينة التعليمات لا تحتاج ذكرى ولا مادّة', async () => {
    await fresh();
    for (const prompt of PROMPTS) {
      const lines = await previewInstructions(prompt.id);
      expect(lines.join('\n').includes('EGYPTIAN')).toBe(true);
    }
  });

  it('وطلبٌ مجهول يرمي', async () => {
    await expect(buildPrompt('مش-موجود', {})).toReject('مش معروف');
  });
});

/* ================================================================== *
 * ٤ · البناء
 * ================================================================== */

describe('مكتبة الطلبات · البناء', () => {
  it('«حلّل الذكرى دي» يحمل محتواها ومعرّفها', async () => {
    await fresh();
    const scene = await seededScene();
    const request = await buildPrompt('analyze-scene', { sceneId: scene.id });

    expect(request.forSceneId).toBe(scene.id);
    expect(request.memory.title).toBe('اجتماع الشحنة');
    expect(request.memory.conversation.length).toBe(1);
    expect(request.prompt.id).toBe('analyze-scene');
    expect(request.replyFormat.lingolifeScene).toBe(PACKAGE_FORMAT_VERSION);
  });

  it('⚠️ يقرأ ولا يكتب — بناؤه مرّتين بلا أثر', async () => {
    await fresh();
    const scene = await seededScene();
    const before = (await scenes.getAll()).length + (await expressions.getAll()).length;
    await buildPrompt('analyze-scene', { sceneId: scene.id });
    await buildPrompt('rehearse', { sceneId: scene.id });
    const after = (await scenes.getAll()).length + (await expressions.getAll()).length;
    expect(after).toBe(before);
  });

  it('⚠️ «جهّزني» لا يطلب تصحيحات — والسبب مكتوب في السجلّ', async () => {
    await fresh();
    const scene = await seededScene();
    const request = await buildPrompt('rehearse', { sceneId: scene.id });
    const text = request.instructions.join('\n');
    expect(text.includes('"scripts"')).toBe(true);
    expect(text.includes('"mistakes": [')).toBe(false);
    expect(String(promptById('rehearse').omit.mistakes).length > 20).toBe(true);
  });

  it('والباب القديم `buildAnalysisRequest` ما زال يعمل بنفس عقده', async () => {
    await fresh();
    const scene = await seededScene();
    const request = await buildAnalysisRequest(scene.id);
    expect(request.forSceneId).toBe(scene.id);
    expect(Array.isArray(request.instructions)).toBe(true);
    const text = request.instructions.join('\n');
    expect(text.includes('JSON')).toBe(true);
    expect(text.includes('EGYPTIAN')).toBe(true);
    expect(text.includes('Do NOT invent')).toBe(true);
  });

  it('وذكرى غير موجودة ترمي برسالةٍ مفهومة', async () => {
    await fresh();
    await expect(buildPrompt('analyze-scene', { sceneId: 'SC_وهم' })).toReject('مش موجودة');
  });
});

/* ================================================================== *
 * ٥ · تعليماتك أنت
 * ================================================================== */

describe('تعليماتك تُلحَق ولا تُستبدِل', () => {
  it('⚠️ تظهر **بعد** القواعد، والقواعد باقية', async () => {
    await fresh();
    const scene = await seededScene();
    await setExtraInstructions('analyze-scene', 'ركّز على لغة المخازن.');

    const request = await buildPrompt('analyze-scene', { sceneId: scene.id });
    const text = request.instructions.join('\n');

    expect(text.includes('ركّز على لغة المخازن.')).toBe(true);
    // القاعدة الأخطر ما زالت موجودة، وقبلها.
    expect(text.includes('Do NOT invent')).toBe(true);
    expect(text.indexOf('Do NOT invent') < text.indexOf('ركّز على')).toBe(true);
  });

  it('وتُمحى بنصٍّ فارغ', async () => {
    await fresh();
    await setExtraInstructions('analyze-scene', 'حاجة');
    expect(Object.keys(await extraInstructions())).toEqual(['analyze-scene']);
    await setExtraInstructions('analyze-scene', '   ');
    expect(Object.keys(await extraInstructions())).toEqual([]);
  });

  it('ولطلبٍ مجهول ترمي', async () => {
    await fresh();
    await expect(setExtraInstructions('مش-موجود', 'حاجة')).toReject('مش معروف');
  });
});

/* ================================================================== *
 * ٦ · ذكرى من مادّة خام (C1–C5)
 * ================================================================== */

describe('ذكرى من مادّة خام', () => {
  it('⚠️ بلا `forSceneId` — ولا يُختلَق واحد', async () => {
    await fresh();
    const request = await buildPrompt('new-scene', {
      material: 'Здравствуйте, груз задержан на таможне.',
      hint: 'مكالمة مع المخزن',
      date: '2026-05-04',
    });
    expect(request.forSceneId).toBe(undefined);
    expect(request.material.text.includes('груз')).toBe(true);
    expect(request.material.hint).toBe('مكالمة مع المخزن');
    expect(request.material.date).toBe('2026-05-04');
  });

  it('ومادّةٌ فاضية ترمي بدل أن تُخرج ملفًّا فاضيًا', async () => {
    await fresh();
    await expect(buildPrompt('new-scene', { material: '   ' })).toReject('فاضية');
  });

  it('⚠️ ويقول للمحلِّل إن الموقف حقيقيّ فلا يُكمِله', async () => {
    await fresh();
    const request = await buildPrompt('new-scene', { material: 'حاجة' });
    const text = request.instructions.join('\n');
    expect(text.includes('REAL and already happened')).toBe(true);
    expect(text.includes('do not invent a nicer version')).toBe(true);
  });

  it('⚠️ والردّ حزمةٌ عاديّة تمرّ بالخطّة — مفيش مسار تاني (C5)', async () => {
    await fresh();
    // ردٌّ على طلبٍ بلا ذكرى: حزمةٌ كاملة بلا `forSceneId`.
    const reply = {
      lingolifeScene: PACKAGE_FORMAT_VERSION,
      scene: { title: 'مكالمة الجمارك', date: '2026-05-04' },
      conversationParts: [{ speaker: 'إيجور', text: 'Груз задержан' }],
      expressions: [{ text: 'задержан', meaningAr: 'متأخّر' }],
    };
    const { pkg, issues } = parsePackage(JSON.stringify(reply));
    expect(issues.filter((i) => i.level === 'fatal')).toHaveLength(0);

    const plan = await planImport(pkg);
    // بلا معرّف: الخطّة تقترح **إنشاء** ذكرى — وهو سلوكها الأصليّ.
    expect(plan.scene.action).toBe(ACTION.CREATE);
    // ولا كتابة حدثت.
    expect((await scenes.getAll()).length).toBe(0);
  });

  it('واسم الملفّ يفرّق بين طلبٍ وآخر', async () => {
    await fresh();
    const scene = await seededScene();
    const raw = await buildPrompt('new-scene', { material: 'حاجة' });
    const rehearse = await buildPrompt('rehearse', { sceneId: scene.id });
    expect(requestFilename(raw).startsWith('تحليل-')).toBe(true);
    expect(requestFilename(rehearse).startsWith('تحضير-')).toBe(true);
    expect(requestFilename(raw).includes('/')).toBe(false);
  });

  it('⚠️ والملخّص يقيس المادّة بحروفها لا بأقسامٍ لا وجود لها', async () => {
    await fresh();
    const request = await buildPrompt('new-scene', { material: 'اثنعشر حرف' });
    const summary = requestSummary(request);
    expect(summary.rawChars > 0).toBe(true);
    expect(summary.conversation).toBe(0);
    expect(summary.promptId).toBe('new-scene');
  });
});

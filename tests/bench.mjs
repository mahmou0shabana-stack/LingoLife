/**
 * LingoLife — قياس الأداء على حجمٍ حقيقي *(WS8 · بند 105)*
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا أداةٌ لا بوّابة في CI
 * ═══════════════════════════════════════════════════════════════
 *
 * زمنُ التشغيل يتبع الجهاز الذي يقيسه: عدّاءُ CI اليوم أبطأ من عدّاء
 * الغد، فبوّابةٌ على المليّات تسقط لأسبابٍ لا علاقة لها بالكود. فهذه
 * **أداةٌ تُشغَّل عند الشكّ** ونتائجُها مكتوبةٌ في `docs/09` لتُقارَن.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولا يُقاس بـ`page.goto`
 * ═══════════════════════════════════════════════════════════════
 *
 * أوّل قياسٍ أجريتُه أعطى **كل** شاشةٍ نفس الرقم تقريبًا: 12.6 ثانية.
 * لأن طلبات الخطوط المحجوبة تُضيف مهلةً ثابتة لكل تنقّل — فكنتُ أقيس
 * الحاجز لا التطبيق.
 *
 * فالقياس هنا **داخل الصفحة** حول دالّة الرسم وحدها، والخطوط تُجهَض
 * فورًا بدل أن تنتظر المهلة.
 *
 * ⚠️ وثلاث جولاتٍ لا تكفي: `facetTree` أعطت وسيطًا 136ms في ثلاث
 *    جولات و71ms في إحدى عشرة. الفرق كان ضجيجًا، وكاد يدفعني إلى
 *    «تحسين» ما ليس بطيئًا.
 *
 * التشغيل:
 *   python3 -m http.server 8124 &
 *   node tests/bench.mjs http://localhost:8124 [عدد الذكريات]
 */

import { chromium } from 'playwright';

const baseUrl = (process.argv[2] || 'http://localhost:8124').replace(/\/$/, '');
const TARGET = Number(process.argv[3] || 1000);
const RUNS = 11;

/*
 * ⚠️ ملفٌّ شخصيٌّ منفصل عن أي تجربةٍ أخرى: البذر هنا بالآلاف، ولا يجوز
 *    أن يختلط بقاعدةٍ تُستعمل للتحقّق اليدوي.
 */
const PROFILE = process.env.BENCH_PROFILE || '/tmp/lingolife-bench-profile';

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: process.env.CHROMIUM_PATH || undefined,
  viewport: { width: 1280, height: 800 },
});
const page = context.pages()[0] || (await context.newPage());

// المهلة تُقاس، فلا تُنتظَر: الإجهاض فوري.
await context.route('**/service-worker.js', (route) => route.abort());
await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
await context.route('https://fonts.gstatic.com/**', (route) => route.abort());

await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

/* ------------------------------------------------------------------ *
 * البذر — يُستأنف ولا يُعاد
 * ------------------------------------------------------------------ */

console.log(`بذر حتى ${TARGET} ذكرى…`);
const seeded = await page.evaluate(async (n) => {
  const { openDB } = await import('/js/db/database.js');
  await openDB();
  const { scenes } = await import('/js/db/repositories.js');
  const have = (await scenes.getActive()).length;
  if (have >= n) return { have, added: 0 };

  const { createScene } = await import('/js/services/scene-service.js');
  const { addPerson, listPeople } = await import('/js/services/person-service.js');
  const { addConversationPart, addExpression, addMistake, addScript, EXPRESSION_SOURCE } =
    await import('/js/services/content-service.js');
  const { saveItem, SAVED_KIND } = await import('/js/services/saved-service.js');

  // ⚠️ يُعاد استعمال الموجود: `addPerson` ترفض الاسم المكرّر بحقّ.
  const known = await listPeople();
  const people = [];
  for (const name of ['إيجور', 'مارينا', 'أنّا', 'سيرجي', 'أولغا']) {
    people.push(known.find((p) => p.name === name) || await addPerson({ name }));
  }

  const types = ['meeting', 'phone', 'doctor', 'gov', 'study', 'travel'];
  const places = ['المكتب', 'البيت', 'المصلحة', 'العيادة', 'الكافيه', 'المحطة'];
  const words = ['накладная', 'согласование', 'несоответствие', 'таможня', 'поставка', 'договор'];

  for (let i = have; i < n; i += 1) {
    const day = new Date(2023, 0, 1 + Math.floor(i * 0.9)).toISOString().slice(0, 10);
    const scene = await createScene({
      titleAr: `ذكرى رقم ${i}`, titleRu: `Ситуация ${i}`, date: day,
      type: types[i % types.length], placeName: places[i % places.length],
    });
    const person = people[i % people.length];
    await addConversationPart(scene.id, {
      speaker: person.name, personId: person.id,
      text: `Груз ${i} задержался на таможне.`, translation: 'الشحنة اتأخرت',
    });
    await addConversationPart(scene.id, {
      speaker: 'أنا', isMine: true, text: `На сколько дней ${i}?`, translation: 'كام يوم؟',
    });
    if (i % 2 === 0) await addScript(scene.id, { title: 'سكريبت', text: `Обсуждали поставку ${i}.` });
    if (i % 3 === 0) {
      await addMistake(scene.id, {
        wrong: `один несоответствие ${i}`, natural: `одно несоответствие ${i}`,
        mistakeType: ['gender', 'case', 'grammar', 'word'][i % 4], explanation: 'شرح',
      });
    }
    // تعبيراتٌ تتكرّر عبر الذكريات — وهو الحال الحقيقيّ لا تعبيرٌ لكل ذكرى.
    await addExpression(scene.id, {
      text: `${words[i % words.length]} ${i % 40}`, meaningAr: 'معنى',
      source: { type: EXPRESSION_SOURCE.MANUAL },
    });
    if (i % 5 === 0) {
      await saveItem({ text: `${words[i % words.length]}${i}`, kind: SAVED_KIND.WORD, tagIds: ['hard'] });
    }
  }
  return { have, added: n - have };
}, TARGET);
console.log(`  كان ${seeded.have} · أُضيف ${seeded.added}`);

/* ------------------------------------------------------------------ *
 * القياس
 * ------------------------------------------------------------------ */

const report = await page.evaluate(async (runs) => {
  const { openDB } = await import('/js/db/database.js');
  await openDB();
  const { primeTypes } = await import('/js/services/type-service.js');
  await primeTypes();

  const repos = await import('/js/db/repositories.js');
  const census = {};
  for (const key of ['scenes', 'conversationParts', 'expressions', 'expressionOccurrences',
    'mistakeComparisons', 'scripts', 'savedItems']) {
    census[key] = (await repos[key].getAll()).length;
  }
  const sceneId = (await repos.scenes.getActive())[0].id;

  const host = document.createElement('div');
  document.body.append(host);

  const stat = async (fn) => {
    const times = [];
    for (let i = 0; i < runs; i += 1) {
      const start = performance.now();
      await fn();
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return {
      median: Math.round(times[Math.floor(runs / 2)]),
      min: Math.round(times[0]),
      max: Math.round(times.at(-1)),
    };
  };

  const views = {
    'حياتي': async () => (await import('/js/views/life-view.js')).renderLife(host),
    'النهر': async () => (await import('/js/views/river-view.js')).renderRiver(host),
    'المحاور': async () => (await import('/js/views/facets-view.js')).renderFacets(host),
    'لغتي': async () => (await import('/js/views/language-view.js')).renderLanguage(host),
    'تحليل': async () => (await import('/js/views/analysis-view.js')).renderAnalysis(host),
    'الكوكبة': async () => (await import('/js/views/constellation-view.js')).renderConstellation(host),
    'الذكرى': async () => (await import('/js/views/scene-view.js')).renderScene(host, sceneId),
  };

  const { analysisOverview } = await import('/js/services/analysis-service.js');
  const { languageOverview, wordLife } = await import('/js/services/language-service.js');
  const { facetTree, riverPage } = await import('/js/services/atlas-service.js');
  const { searchAll } = await import('/js/services/search-service.js');

  const services = {
    'analysisOverview': () => analysisOverview(),
    'languageOverview': () => languageOverview({ limit: 60 }),
    'facetTree': () => facetTree(),
    'riverPage': () => riverPage({ limit: 40 }),
    'wordLife': () => wordLife('таможня'),
    'searchAll': () => searchAll('груз'),
  };

  const out = { census, views: {}, services: {} };
  for (const [name, fn] of Object.entries(views)) {
    try { out.views[name] = await stat(fn); } catch (err) { out.views[name] = { error: err.message }; }
  }
  for (const [name, fn] of Object.entries(services)) {
    try { out.services[name] = await stat(fn); } catch (err) { out.services[name] = { error: err.message }; }
  }

  host.remove();
  return out;
}, RUNS);

console.log('\nالحجم:');
for (const [key, n] of Object.entries(report.census)) console.log(`  ${key.padEnd(24)} ${n}`);

const line = (name, s) => `  ${name.padEnd(20)} ${
  s.error ? `✗ ${s.error}` : `${String(s.median).padStart(5)}ms  (${s.min}–${s.max})`}`;

console.log(`\nالشاشات — وسيط ${RUNS} جولات:`);
for (const [name, s] of Object.entries(report.views)) console.log(line(name, s));
console.log('\nالخدمات:');
for (const [name, s] of Object.entries(report.services)) console.log(line(name, s));

await context.close();

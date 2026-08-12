/**
 * LingoLife — تشغيل الاختبارات بلا واجهة
 *
 * يفتح `tests/index.html` في متصفح حقيقي ويطبع النتيجة، ويُنهي العملية
 * برمز خطأ عند أي فشل — فيصلح للـ CI وللتشغيل المحلي على السواء.
 *
 * ⚠️ Playwright **ليست اعتمادية للمشروع**. لا يوجد package.json ولا
 *    node_modules في المستودع، والتطبيق نفسه لا يستورد شيئًا منها.
 *    تُثبَّت مؤقتًا في بيئة التشغيل فقط. المشروع يبقى HTML/CSS/JS خامًا
 *    بلا خطوة بناء، تفتحه بخادم ساكن وينتهي الأمر.
 *
 * التشغيل:
 *   python3 -m http.server 8124 &
 *   node tests/run-headless.mjs http://localhost:8124
 */

import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:8124';
const url = `${baseUrl.replace(/\/$/, '')}/tests/index.html?run=1`;

// المسار الذي هيّأته البيئة مسبقًا، إن وُجد.
const executablePath = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();

page.on('pageerror', (error) => console.error('[pageerror]', error.message));
page.on('console', (message) => {
  // خطوط جوجل قد لا تكون متاحة في بيئة مغلقة — ليست فشلًا.
  if (message.type() === 'error' && !message.text().includes('fonts.googleapis')) {
    console.error('[console]', message.text());
  }
});

console.log(`تشغيل: ${url}\n`);
await page.goto(url);
// ⚠️ التوقيع `waitForFunction(fn, arg, options)`. تمرير الخيارات في
//    موضع `arg` يجعلها وسيطًا للدالّة لا خيارًا — فتظلّ مهلة 30 ثانية
//    الافتراضية سارية. لم يظهر ذلك إلا حين تجاوزت الاختبارات نصف دقيقة.
await page.waitForFunction(() => window.__testResult, null, { timeout: 180_000 });

const result = await page.evaluate(() => window.__testResult);

let suite = null;
for (const test of result.results) {
  if (test.suite !== suite) {
    suite = test.suite;
    console.log(`\n${suite}`);
  }
  console.log(`  ${test.ok ? '✓' : '✗'} ${test.name} (${test.ms}ms)`);
  if (!test.ok) console.log(`      ${test.error.split('\n').join('\n      ')}`);
}

console.log(`\n${result.passed}/${result.total} نجح · ${result.failed} فشل`);

/* ------------------------------------------------------------------ *
 * فحص إقلاع التطبيق
 *
 * الاختبارات وحدها لا تكفي: سبق أن مرّت الثلاثون كلها بينما كان
 * التطبيق يسقط عند الإقلاع على استيراد محذوف لا يلمسه أيٌّ منها.
 * ------------------------------------------------------------------ */

console.log('\nفحص إقلاع التطبيق');
const appPage = await browser.newPage();
const bootErrors = [];
appPage.on('pageerror', (error) => bootErrors.push(error.message));

await appPage.goto(`${baseUrl.replace(/\/$/, '')}/index.html#/settings`);
await appPage.waitForTimeout(2500);

const hasExport = await appPage.locator('[data-action="export-llife"]').count();
const hasRestore = await appPage.locator('[data-action="restore-llife"]').count();

if (bootErrors.length) console.log(`  ✗ أخطاء إقلاع: ${bootErrors.join(' | ')}`);
else console.log('  ✓ يُقلع بلا أخطاء');

if (!hasExport || !hasRestore) console.log('  ✗ أزرار النسخ الاحتياطي غير موجودة');
else console.log('  ✓ شاشة الإعدادات كاملة');

/* ------------------------------------------------------------------ *
 * فحص كل شاشة تُفتَح بلا مُعطى
 *
 * ⚠️ فحص رسم الوحدات يستورد الملفّ فيكشف استيرادًا مكسورًا في أعلاه —
 *    **ولا يكشف اسمًا ناقصًا داخل دالّة**. استعملتُ `STATE` في
 *    `scene-view` بلا استيرادها، فمرّت الاختبارات الخمسمئة وفحص
 *    الوحدات وفحص الإقلاع كلها، لأن الإقلاع يزور `/settings` وحدها.
 *
 *    فصار كل مسارٍ بلا مُعطى يُفتَح ويُطالَب بألّا يرمي. والمسارات ذات
 *    المُعطى (`/scene/:id`) تحتاج بياناتٍ مزروعة — تُغطّى بالاختبارات
 *    وبالتجربة في متصفّح.
 * ------------------------------------------------------------------ */

console.log('\nفحص الشاشات');

/*
 * ⚠️ **الشاشة الفارغة تُثبت القليل.** أوّل نسخةٍ من هذا الفحص مرّت على
 *    استيرادٍ محذوف لأن القاعدة كانت فارغة، فرسمت الشاشة حالتها
 *    الفارغة ولم تبلغ السطر المكسور. فنزرع أوّلًا ما يُشغّل المسارات
 *    الحقيقيّة: ذكرى وشخص وخيط وتعبير وكلمة محفوظة.
 */
/*
 * ⚠️ **`browser.newPage()` يفتح سياقًا جديدًا في كل مرّة**، ولكل سياقٍ
 *    تقسيمُ تخزينٍ مستقلّ. فكانت البذرة تُكتَب في قاعدةٍ لا تراها أيُّ
 *    صفحةٍ بعدها: تقول البذرة `ذكريات=1` وتقول كل شاشةٍ `ذكريات=0`،
 *    والقاعدة موجودةٌ والشقّ صحيح — لأنها ببساطة قاعدةٌ أخرى.
 *    قِسْتُ ذلك قبل إصلاحه: `p1.context() === p2.context()` ← `false`.
 *
 *    فسياقٌ واحدٌ للبذرة وللشاشات كلها. ونمنع عامل الخدمة داخله: لا
 *    فائدة منه هنا، وقد يُقدّم وحدةً مخزّنةً بدل التي على القرص.
 */
const sweepContext = await browser.newContext();
await sweepContext.route('**/service-worker.js', (route) => route.abort());

const seedPage = await sweepContext.newPage();
await seedPage.goto(`${baseUrl.replace(/\/$/, '')}/index.html`);
await seedPage.waitForTimeout(1200);
const seededSceneId = await seedPage.evaluate(async (base) => {
  const { openDB } = await import(`${base}/js/db/database.js`);
  await openDB();
  const { createScene } = await import(`${base}/js/services/scene-service.js`);
  const { addPerson } = await import(`${base}/js/services/person-service.js`);
  const { createThread, addSceneToThread } = await import(`${base}/js/services/thread-service.js`);
  const { addConversationPart, addExpression, addScript } =
    await import(`${base}/js/services/content-service.js`);
  const { saveItem, SAVED_KIND } = await import(`${base}/js/services/saved-service.js`);

  const scene = await createScene({
    titleAr: 'فحص الشاشات', titleRu: 'Проверка', date: '2026-05-01',
    type: 'meeting', placeName: 'المكتب',
  });
  const person = await addPerson({ name: 'فاحص' });
  const thread = await createThread({ title: 'خيط الفحص' });
  await addSceneToThread(thread.id, scene.id);
  await addConversationPart(scene.id, { speaker: 'فاحص', text: 'Проверка', personId: person.id });
  await addScript(scene.id, { title: 'سكريبت', text: 'Проверка связи' });
  await addExpression(scene.id, { text: 'по итогам', meaningAr: 'بناءً على النتائج' });
  await saveItem({ text: 'связь', kind: SAVED_KIND.WORD, sceneId: scene.id, tagIds: ['hard'] });

  return scene.id;
}, baseUrl.replace(/\/$/, ''));
await seedPage.close();

const ROUTES = ['/', '/life', '/language', '/river', '/facets', '/constellation',
  '/analysis',
  '/threads', '/search', '/trash', '/import', '/studio', '/dev', '/duplicates',
  '/settings',
  // ومسارات بمُعطى — على ما زُرع للتوّ.
  `/scene/${seededSceneId}`, '/day/2026-05-01'];

const routeFailures = [];
for (const route of ROUTES) {
  const errors = [];
  const page = await sweepContext.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl.replace(/\/$/, '')}/index.html#${route}`);
  /*
   * ⚠️ الانتظار على **اختفاء الدوّارة** لا على مدّةٍ مقدَّرة: تسعمئة
   *    مليّة كانت تكفي الشاشات الخفيفة وتقيس شاشة الذكرى وهي نصف
   *    مرسومة — فيمرّ عطبٌ لأن السطر المكسور لم يُبلَغ بعد.
   */
  await page.waitForFunction(
    () => !document.querySelector('#app-main .loading'),
    null,
    { timeout: 15_000 }
  ).catch(() => {});
  await page.waitForTimeout(250);

  // شاشةٌ سقطت تعرض لوحة الخطأ العامّة بدل محتواها.
  const crashed = await page.locator('.empty-state h2', { hasText: 'حصل خطأ في العرض' }).count();
  if (errors.length || crashed) routeFailures.push(`${route} → ${errors[0] || 'لوحة خطأ'}`);
  await page.close();
}
await sweepContext.close();

if (routeFailures.length) for (const row of routeFailures) console.log(`  ✗ ${row}`);
else console.log(`  ✓ ${ROUTES.length} شاشة تُفتَح بلا خطأ`);

/* ------------------------------------------------------------------ *
 * فحص رسم الوحدات
 *
 * ⚠️ الاختبارات تستورد الخدمات لا الشاشات، وفحص الإقلاع يلمس شاشة
 *    واحدة. فحين قُسِّم `app.js` إلى وحدات، انكسر مسارَا استيراد
 *    ديناميكيّين ونقص استيرادٌ واحد — ولم يسقط شيءٌ من ذلك.
 *
 *    هذا الفحص يستورد **كل** وحدة في `js/` فيكشف أي مسار خاطئ أو
 *    تصدير مفقود أو دورة استيراد، قبل أن يكتشفها المستخدم بضغطة زرّ.
 * ------------------------------------------------------------------ */

console.log('\nفحص رسم الوحدات');

// القائمة تُمسح من القرص عند كل تشغيل، فلا يوجد ملفٌّ يتقادم: وحدة
// جديدة تدخل الفحص تلقائيًّا بمجرّد وجودها.
const modules = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) modules.push(full.replace(/\\/g, '/'));
  }
})('js');

const modulePage = await browser.newPage();
// لا بدّ من أصلٍ حقيقي قبل الاستيراد: صفحة `about:blank` لا تحلّ مسارًا.
await modulePage.goto(`${baseUrl.replace(/\/$/, '')}/index.html`);
const moduleFailures = await modulePage.evaluate(
  async ({ base, paths }) => {
    const failures = [];
    for (const path of paths) {
      try {
        await import(`${base}/${path}`);
      } catch (err) {
        failures.push(`${path} → ${err.message}`);
      }
    }
    return failures;
  },
  { base: baseUrl.replace(/\/$/, ''), paths: modules }
);

console.log(`  (${modules.length} وحدة)`);

if (moduleFailures.length) {
  for (const failure of moduleFailures) console.log(`  ✗ ${failure}`);
} else {
  console.log('  ✓ كل الوحدات تُستورَد بلا خطأ');
}

await browser.close();

/* ------------------------------------------------------------------ *
 * فحص التهريب المزدوج
 *
 * ⚠️ الوسم `html` يهرّب كل قيمةٍ مُدرَجة وحده. فـ`${esc(x)}` بداخله
 *    تهريبٌ مرّتين: عنوانٌ فيه علامة اقتباس يُعرَض `&quot;` حرفيًّا،
 *    وذكرى اسمها «قعدة "الشلّة"» تظهر مشوّهة.
 *
 *    ولم يكشفه أي اختبار: النصوص التجريبية كلها بلا محارف خاصّة،
 *    فالتهريب المزدوج لا أثر له عليها. ظهر أوّل ما عُرضت رسالة محلّل
 *    JSON — وفيها علامات اقتباس دائمًا.
 *
 *    و`esc` **داخل قالبٍ عادي** صحيحةٌ ولازمة: لا وسمَ يهرّب هناك.
 *    فالفحص يفرّق بين الحالتين ولا يمنع الثانية.
 * ------------------------------------------------------------------ */

console.log('\nفحص التهريب المزدوج');

/** مواضع `${esc(` التي يهرّبها وسم `html` مرّةً ثانية. */
function doubleEscapes(source) {
  const hits = [];
  const stack = [];
  let i = 0;

  const lineAt = (index) => source.slice(0, index).split('\n').length;

  while (i < source.length) {
    const c = source[i];

    if (c === '/' && source[i + 1] === '/' && stack.length === 0) {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? source.length : nl;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    // نصٌّ عادي — لا يُفسَّر ما بداخله.
    if ((c === '"' || c === "'") && (!stack.length || stack.at(-1).kind === 'expr')) {
      i += 1;
      while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1;
      i += 1;
      continue;
    }
    if (c === '`') {
      if (stack.at(-1)?.kind === 'tpl') stack.pop();
      else {
        let k = i - 1;
        while (k >= 0 && ' \n\t'.includes(source[k])) k -= 1;
        stack.push({ kind: 'tpl', tagged: source.slice(k - 3, k + 1) === 'html' });
      }
      i += 1;
      continue;
    }
    if (c === '$' && source[i + 1] === '{' && stack.at(-1)?.kind === 'tpl') {
      // أي قالبٍ موسوم في السلسلة يهرّب النتيجة، ولو كان المباشر عاديًّا.
      const escaped = stack.some((f) => f.kind === 'tpl' && f.tagged);
      if (escaped && source.slice(i + 2).replace(/^[\s(]+/, '').startsWith('esc(')) {
        hits.push({ line: lineAt(i), kind: 'esc' });
      }
      // نحفظ بدايته لنفحص **الإدراج كلّه** عند إغلاقه، لا أوّل حروفه.
      stack.push({ kind: 'expr', outer: true, escaped, start: i + 2, line: lineAt(i) });
      i += 2;
      continue;
    }
    if (c === '{' && stack.at(-1)?.kind === 'expr') {
      stack.push({ kind: 'expr' });
      i += 1;
      continue;
    }
    if (c === '}' && stack.at(-1)?.kind === 'expr') {
      const frame = stack.pop();
      /*
       * ⚠️ الفحص على الإدراج كامِلًا لا على أوّله.
       *
       *    `${html`…`}` شكلٌ نادر، والشائع `${cond ? html`…` : ''}` و
       *    `${list.map((x) => html`…`).join('')}`. وكلّها تُنتج نصًّا
       *    يهرّبه القالب الخارجي فتُطبَع الوسوم حرفيًّا: «في
       *    &lt;bdi&gt;المكتب&lt;/bdi&gt;».
       *
       *    وفحصُ أوّل الحروف وحده مرّ على البُنية الشائعة — أُعيد
       *    العطب تجريبًا فلم يسقط الفحص. فصار على المدى كلّه: أي
       *    `html`` بداخله بلا `raw(` في أوّله.
       */
      if (frame.outer && frame.escaped) {
        const body = source.slice(frame.start, i);
        if (body.includes('html`') && !body.trimStart().startsWith('raw(')) {
          hits.push({ line: frame.line, kind: 'html' });
        }
      }
      i += 1;
      continue;
    }
    i += c === '\\' ? 2 : 1;
  }

  return hits;
}

const WHY = {
  esc: 'esc() جوّه html بتهرّب مرتين',
  html: 'قالب html جوّه html بلا raw() — الوسوم هتتطبع حرفيًّا',
};

const escapeIssues = [];
for (const path of modules) {
  for (const hit of doubleEscapes(readFileSync(path, 'utf8'))) {
    escapeIssues.push(`${path}:${hit.line} — ${WHY[hit.kind]}`);
  }
}

if (escapeIssues.length) {
  for (const issue of escapeIssues) console.log(`  ✗ ${issue}`);
} else {
  console.log('  ✓ مفيش تهريب مزدوج');
}

const bootOk =
  bootErrors.length === 0 &&
  hasExport > 0 &&
  hasRestore > 0 &&
  routeFailures.length === 0 &&
  moduleFailures.length === 0 &&
  escapeIssues.length === 0;
process.exit(result.failed || !bootOk ? 1 : 0);

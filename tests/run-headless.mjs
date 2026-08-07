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
await page.waitForFunction(() => window.__testResult, { timeout: 180_000 });

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

await browser.close();

const bootOk = bootErrors.length === 0 && hasExport > 0 && hasRestore > 0;
process.exit(result.failed || !bootOk ? 1 : 0);

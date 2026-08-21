/**
 * LingoLife — قياسُ تغطية النبر: قبل الطبقة الجديدة وبعدها (WS55)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لماذا في متصفّحٍ حقيقيٍّ لا في Node؟
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن الحلّالَ يقرأ `settings` من IndexedDB (ذاكرةُ حسمِ الملتبسات)،
 * ويجلب المعجمَ بـ`fetch`. وتقليدُ الاثنين في Node يقيس **تقليدي أنا**
 * لا التطبيق. فالقياسُ يجري حيث يجري التطبيق.
 *
 * ⚠️ **والقياسُ مرّتان في نفس الجلسة**: مرّةً والمعجمُ غائب (وهو حرفيًّا
 *    سلوكُ ما قبل WS55)، ثم مرّةً بعد تحميله. فالفرقُ فرقٌ مقيسٌ لا
 *    مُستذكَرٌ من فرعٍ قديم.
 *
 * التشغيل:
 *   python3 -m http.server 8124 &
 *   node scripts/stress-coverage.mjs http://localhost:8124
 */

import { chromium } from 'playwright';

const baseUrl = (process.argv[2] || 'http://localhost:8124').replace(/\/$/, '');
const executablePath = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`${baseUrl}/tests/index.html`);

const result = await page.evaluate(async (origin) => {
  const engine = await import(`${origin}/js/services/pronunciation/engine.js`);
  const store = await import(`${origin}/js/services/pronunciation/stress/lexicon-store.js`);
  const facade = await import(`${origin}/js/services/pronunciation/stress-resolver.js`);
  const { RUNNING_TEXT } = await import(`${origin}/tests/fixtures/stress-benchmark-corpus.js`);

  /* التقطيعُ نفسُه الذي تستعمله الواجهة: كلماتٌ روسيّةٌ بلا ترقيم. */
  const words = [];
  for (const line of RUNNING_TEXT) {
    const tokens = line.split(/\s+/)
      .map((t) => t.replace(/[.,!?;:—«»""''()]/g, '').toLowerCase())
      .filter((t) => /^[а-яё-]+$/.test(t));
    tokens.forEach((t, i) => words.push({ t, prev: tokens[i - 1] || null, next: tokens[i + 1] || null }));
  }

  function measure() {
    engine.clearPronunciationCache();
    const tally = {
      TOTAL_WORDS: words.length,
      USER_OVERRIDE: 0, EXPLICIT_TEXT: 0, BUILT_IN_VERIFIED: 0,
      OFFLINE_KNOWN: 0, CONTEXT_RESOLVED: 0, RULE: 0,
      PREDICTED: 0, AMBIGUOUS: 0, UNKNOWN_STRESS: 0,
    };
    for (const { t, prev, next } of words) {
      const { stress } = engine.analyzeWord(t, { previousWord: prev, nextWord: next });
      if (stress.ambiguous) { tally.AMBIGUOUS += 1; continue; }
      switch (stress.origin) {
        case 'USER_OVERRIDE': tally.USER_OVERRIDE += 1; break;
        case 'EXPLICIT_TEXT': tally.EXPLICIT_TEXT += 1; break;
        case 'BUILT_IN_VERIFIED': tally.BUILT_IN_VERIFIED += 1; break;
        case 'OFFLINE_KNOWN': tally.OFFLINE_KNOWN += 1; break;
        case 'CONTEXT_HOMOGRAPH': tally.CONTEXT_RESOLVED += 1; break;
        case 'RULE': tally.RULE += 1; break;
        case 'PREDICTED': tally.PREDICTED += 1; break;
        default: tally.UNKNOWN_STRESS += 1;
      }
    }
    return tally;
  }

  store.__resetLexicon();
  const before = measure();
  await facade.warmStressResolver();
  const after = measure();
  return { before, after, meta: store.lexiconMeta() };
}, baseUrl);

await browser.close();

/* ------------------------------------------------------------------ */

const KEYS = [
  'TOTAL_WORDS', 'USER_OVERRIDE', 'EXPLICIT_TEXT', 'BUILT_IN_VERIFIED',
  'OFFLINE_KNOWN', 'CONTEXT_RESOLVED', 'RULE', 'PREDICTED',
  'AMBIGUOUS', 'UNKNOWN_STRESS',
];

const pct = (n, total) => (total ? `${((n / total) * 100).toFixed(1)}%` : '—');
const pad = (s, n) => String(s).padEnd(n);

console.log('\n═══ تغطيةُ النبر — قبل وبعد ═══\n');
console.log(`${pad('المقياس', 20)}${pad('قبل', 18)}بعد`);
console.log('─'.repeat(56));
for (const key of KEYS) {
  const b = result.before[key];
  const a = result.after[key];
  const total = result.after.TOTAL_WORDS;
  const bs = key === 'TOTAL_WORDS' ? String(b) : `${b} (${pct(b, total)})`;
  const as = key === 'TOTAL_WORDS' ? String(a) : `${a} (${pct(a, total)})`;
  console.log(`${pad(key, 20)}${pad(bs, 18)}${as}`);
}

/*
 * ⚠️ **ولا يُجمَع المعجميُّ مع المتنبَّإ به في رقمٍ واحد.**
 *    «٩٤٪ تغطية» تخفي الفرقَ بين معرفةٍ وتخمين. فالرقمان منفصلان،
 *    والثاني صفرٌ اليوم لأن التنبّؤ مطفأ — ويجب أن يبقى ظاهرًا صفرًا
 *    لا أن يُدمَج فيختفي يومَ يُشغَّل.
 */
const lexical = (t) => t.USER_OVERRIDE + t.EXPLICIT_TEXT + t.BUILT_IN_VERIFIED
  + t.OFFLINE_KNOWN + t.CONTEXT_RESOLVED + t.RULE;

console.log('─'.repeat(56));
console.log(`${pad('معرفةٌ معجميّة', 20)}${pad(pct(lexical(result.before), result.before.TOTAL_WORDS), 18)}${pct(lexical(result.after), result.after.TOTAL_WORDS)}`);
console.log(`${pad('تنبّؤ', 20)}${pad(pct(result.before.PREDICTED, result.before.TOTAL_WORDS), 18)}${pct(result.after.PREDICTED, result.after.TOTAL_WORDS)}`);
console.log(`\nالمعجم: ${result.meta.ready ? `${result.meta.forms.toLocaleString()} صيغة` : 'لم يُحمَّل'}`);

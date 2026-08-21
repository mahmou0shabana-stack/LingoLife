/**
 * LingoLife — تصديرُ معجم النبر إلى ملفٍّ خفيفٍ يعمل بلا إنترنت (WS55)
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا تصديرٌ وقتَ البناء لا نموذجٌ وقتَ التشغيل؟
 * ═══════════════════════════════════════════════════════════════
 *
 * LingoLife تطبيقُ متصفّحٍ خالص: جافاسكربت خامٌّ بلا خطوة بناء، يُخدَم
 * ملفّاتٍ ساكنةً من GitHub Pages، بلا خادمٍ ولا بايثون. فأيُّ حلٍّ
 * يتطلّب PyTorch — كـSilero Stress — لا مكانَ له في زمن التشغيل:
 * لا لأنه رديء، بل لأنه **لا يوجد مكانٌ يُشغَّل فيه**.
 *
 * والحلُّ الذي يناسب هذا المعمار: **يُصدَّر المعجمُ مرّةً هنا**، فيصير
 * ملفَّ بياناتٍ ساكنًا يقرؤه المتصفّحُ كأيّ ملفٍّ آخر، ويُخزَّن مع
 * التطبيق فيعمل بلا شبكةٍ إلى الأبد.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ المصدرُ والرخصة — والالتزامُ الذي يتبعهما
 * ═══════════════════════════════════════════════════════════════
 *
 *   المصدر : OpenRussian.org عبر github.com/Badestrand/russian-dictionary
 *   الرخصة : Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)
 *
 * ورخصةُ «النسبة والمشاركة بالمثل» ليست تفصيلًا يُذكَر في حاشية: هي
 * تُلزمنا بأمرين، ونُنفّذهما لا نكتفي بذكرهما:
 *   ١ · **النسبة** — مكتوبةٌ في رأس الملفّ المُصدَّر نفسِه، فتسافر مع
 *       البيانات ولا تنفصل عنها مهما نُسخت.
 *   ٢ · **المشاركة بالمثل** — أيُّ تعديلٍ على هذه البيانات يخضع لنفس
 *       الرخصة. مكتوبٌ في `docs/` لمن يأتي بعدنا.
 *
 * التشغيل:
 *   node scripts/build-stress-lexicon.mjs <مجلَّدُ ملفّات CSV>
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2] || '/tmp';
const OUT = new URL('../assets/stress-lexicon.json', import.meta.url).pathname;

/** علامةُ النبر في بيانات OpenRussian: فاصلةٌ عليا **بعد** الحرف. */
const MARK = "'";
const VOWELS = 'аоэуыиеёюя';

/**
 * يستخرج «رقمَ حرف العلّة المشدَّد» من صيغةٍ معلَّمة.
 *
 * ⚠️ **ورقمُ الحرف لا موضعُه في النصّ** — لنفس السبب الذي في
 *    `stress-resolver.js`: الموضعُ يتزحزح مع أيّ إعادة كتابة، والرقمُ
 *    ثابتٌ لأن عددَ حروف العلّة لا يتغيّر.
 *
 * @returns {{ bare: string, ordinal: number }|null}
 */
function parseForm(cell) {
  if (!cell) return null;
  const raw = cell.trim().toLowerCase();
  /* خليّةٌ فيها فاصلةٌ أو مسافةٌ ليست صيغةً واحدة (مثل «то'й, то'ю»). */
  if (!raw || /[\s,;/*()]/.test(raw)) return null;
  /* حروفٌ روسيّةٌ وعلامةُ نبرٍ وشرطةٌ فقط. */
  if (!/^[а-яё'-]+$/.test(raw)) return null;

  const bare = raw.split(MARK).join('');
  if (!bare || bare.length < 2) return null;

  const vowels = [...bare].filter((ch) => VOWELS.includes(ch));
  if (!vowels.length) return null;

  /*
   * ⚠️ **الكلمةُ أحاديّةُ الحركة تُستبعَد عمدًا.** المحرّكُ يعرف نبرَها
   *    بقاعدةٍ (`rule_monosyllable`) بلا معجم، فإدخالُها هنا تضخيمٌ
   *    بلا فائدة — وهي عشراتُ الآلاف من الصيغ.
   */
  if (vowels.length === 1) return null;

  /* `ё` مشدَّدةٌ دائمًا — والمحرّكُ يعرفها بقاعدةٍ كذلك. */
  if (bare.includes('ё')) return null;

  let ordinal = -1;
  let seen = -1;
  const chars = [...raw];
  for (let i = 0; i < chars.length; i += 1) {
    if (!VOWELS.includes(chars[i])) continue;
    seen += 1;
    if (chars[i + 1] === MARK) { ordinal = seen; break; }
  }
  if (ordinal < 0) return null;              /* صيغةٌ بلا علامة — تُهمَل */
  return { bare, ordinal };
}

/* ------------------------------------------------------------------ */

const FILES = ['nouns', 'verbs', 'adjectives', 'others'];
/** الأعمدةُ التي لا تحمل صيغًا روسيّةً أبدًا — تُقفَز بلا فحص. */
const SKIP = new Set(['translations_en', 'translations_de', 'gender', 'aspect',
  'animate', 'indeclinable', 'sg_only', 'pl_only', 'bare']);

const stress = new Map();      /* bare → Set(ordinal) — كلُّ قراءةٍ ممكنة */
const headword = new Map();    /* bare → Set(ordinal) — قراءةُ المدخَل المعجميّ وحدَها */
let cells = 0;

for (const name of FILES) {
  const path = join(SRC, `ru-${name}.csv`);
  if (!existsSync(path)) { console.warn(`⚠️ ناقص: ${path}`); continue; }
  const lines = readFileSync(path, 'utf8').split('\n');
  const header = lines[0].split('\t');

  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i].split('\t');
    for (let c = 0; c < row.length; c += 1) {
      if (SKIP.has(header[c])) continue;
      cells += 1;
      const form = parseForm(row[c]);
      if (!form) continue;
      if (!stress.has(form.bare)) stress.set(form.bare, new Set());
      stress.get(form.bare).add(form.ordinal);

      /*
       * ⚠️ **وهل هذه قراءةُ «عنوانِ المدخَل» أم صيغةٌ مصرَّفةٌ لمدخَلٍ آخر؟**
       *
       * سؤالٌ يبدو تفصيليًّا، وهو الذي ينقذ التغطيةَ كلَّها. `вода` تظهر
       * بنبرين في البيانات: `вода́` عنوانُ مدخَلها، و`во́да` مضافٌ إليه
       * مفردٌ لمدخَلٍ نادرٍ اسمُه `вод`. ولو عاملناهما سواءً لصارت
       * **«ماء» كلمةً ملتبسةً** ولَما نطقناها أبدًا. وكذلك `после`:
       * `по́сле` حرفُ الجرّ، و`после́` مجرورُ `посол` (سفير).
       *
       * والقراءتان ليستا متساويتين في الاحتمال: عنوانُ المدخَل هو ما
       * تلقاه في النصّ، وصيغةُ مدخَلٍ نادرٍ استثناء. فنميّزهما هنا،
       * ونحسم بعدُ على أساسٍ من البيانات لا من الحدس.
       */
      if (header[c] === 'accented' && row[0]?.trim().toLowerCase() === form.bare) {
        if (!headword.has(form.bare)) headword.set(form.bare, new Set());
        headword.get(form.bare).add(form.ordinal);
      }
    }
  }
  console.log(`${name}: ${lines.length - 1} صفًّا · المعجم الآن ${stress.size} صيغة`);
}

/* ------------------------------------------------------------------ *
 * الفرزُ: صيغةٌ واحدةُ النبر vs متجانسةٌ بنبرين
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **والمتجانساتُ لا تُحسَم هنا ولا تُرمى.**
 *
 * `замок` لها نبران صحيحان (`за́мок` قلعة · `замо́к` قُفل)، واختيارُ
 * أحدهما بالإملاء وحدَه **قلبٌ للمعنى**. فتُصدَّر في جدولٍ منفصلٍ
 * بوصفها ملتبسة، ويقرّر المحلّلُ ماذا يفعل بها — والافتراضُ أن يسأل
 * لا أن يخمّن.
 */
const single = new Map();
const ambiguous = new Map();
/** صيغٌ حُسمت بأنها عنوانُ مدخَلٍ واحد، ولها قراءةٌ أخرى نادرة. */
const withAlt = new Map();

for (const [bare, set] of stress) {
  if (set.size === 1) { single.set(bare, [...set][0]); continue; }

  const heads = headword.get(bare);
  if (heads && heads.size === 1) {
    /*
     * قراءةُ عنوانِ المدخَل وحدَها — تُحسَم، **وتُحفَظ الأخرى** لتظهر
     * في الوضع المتقدّم: «فيه قراءة تانية نادرة». حسمٌ لا إخفاء.
     */
    const chosen = [...heads][0];
    single.set(bare, chosen);
    withAlt.set(bare, [...set].filter((o) => o !== chosen).sort((a, b) => a - b));
    continue;
  }

  /*
   * ⚠️ **عنوانان اثنان = التباسٌ حقيقيّ** — `за́мок` قلعةٌ و`замо́к` قُفل،
   *    وكلاهما مدخَلٌ قائمٌ بذاته. هنا لا يُحسَم بحال، ويُسأل المستخدم.
   */
  ambiguous.set(bare, [...set].sort((a, b) => a - b));
}

/*
 * التخزينُ مجموعاتٌ بحسب رقم الحركة: `{"1": "слово слово ..."}`.
 * أصغرُ كثيرًا من كائنٍ بمفتاحٍ لكلّ كلمة، ويُبنى منه `Map` في نداءٍ واحد.
 */
const buckets = {};
for (const [bare, ordinal] of single) {
  (buckets[ordinal] ||= []).push(bare);
}
for (const k of Object.keys(buckets)) buckets[k] = buckets[k].sort().join(' ');

const payload = {
  _license: 'CC BY-SA 4.0',
  _source: 'OpenRussian.org · github.com/Badestrand/russian-dictionary',
  _attribution: 'Данные словаря: OpenRussian.org (CC BY-SA 4.0). '
    + 'Изменения: извлечены только пары «форма → номер ударного гласного».',
  _note: 'مُصدَّرٌ بـscripts/build-stress-lexicon.mjs — لا يُحرَّر باليد.',
  _generated: new Date().toISOString().slice(0, 10),
  forms: buckets,
  ambiguous: Object.fromEntries([...ambiguous].sort()),
  alt: Object.fromEntries([...withAlt].sort()),
};

writeFileSync(OUT, JSON.stringify(payload));
const bytes = Buffer.byteLength(JSON.stringify(payload));

console.log('\n═══ النتيجة ═══');
console.log(`خلايا فُحصت      : ${cells.toLocaleString()}`);
console.log(`صيغٌ أحاديّةُ النبر: ${single.size.toLocaleString()}`);
console.log(`صيغٌ ملتبسة      : ${ambiguous.size.toLocaleString()}`);
console.log(`حُسمت بعنوان المدخَل: ${withAlt.size.toLocaleString()} (ولها قراءةٌ نادرةٌ محفوظة)`);
console.log(`الحجم            : ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`المخرَج           : ${OUT}`);

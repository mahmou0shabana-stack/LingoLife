/**
 * LingoLife — قراءةُ مسودّة V2: أدوارٌ لا أزواج (WS-DV2 · بنود ١ إلى ١٣ و٣١ إلى ٣٣)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العطبُ الذي وُلدت هذه الوحدةُ لإصلاحه
 * ═══════════════════════════════════════════════════════════════
 *
 * كان اختيارُ أهداف النُّطق سطرًا واحدًا في `bilingual.js`:
 *
 *     units.filter((one) => one.ru && isCyrillic(one.ru))
 *
 * **فأيُّ سطرٍ سيريليٍّ هدفُ نُطق.** ومن هنا جاء «٥ قطع ← ١٠ أزواج»
 * بلا تفسير: المثالُ تحت القطعة سيريليّ، وسؤالُ الاسترجاع سيريليّ،
 * وعنوانُ القسم قد يكون سيريليًّا. فيُعَدُّ الجميعُ هدفًا، ويقرؤه
 * الشادوينج بصوتٍ عالٍ.
 *
 * فالدورُ هنا **يُقرأ من بنيةٍ مؤلَّفةٍ صريحة**، وأهليّةُ النُّطق تأتي
 * من قائمةٍ بيضاءَ لا من نوع الحروف (قيد المالك ٣).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والعنوانُ يقطع القسمَ ولو غاب الفاصل (قيدُ المالك ١ · بند ٣٢)
 * ═══════════════════════════════════════════════════════════════
 *
 * كان القسمُ في V1 يمتدُّ حتى `━━━` أو عنوانٍ جديد. فمسودّةٌ نُسي فيها
 * فاصلٌ واحدٌ تُلحِق «القطعة ٢» بالقطعة ١ صامتةً. وفي V2 العناوينُ
 * صريحةٌ ومرقَّمة، فهي وحدَها تكفي حدًّا — والفاصلُ زينةٌ تُحترَم ولا
 * يُعتمَد عليها.
 *
 * ⚠️ **ولا مسارَ V1 يُمَسّ.** هذه الوحدةُ تُقرأ فقط حين تُكتشَف بنيةُ V2
 *    صراحةً؛ وما دونَها يبقى على محلّله القديم كما هو (بند ٣٠).
 */

import { ROLE } from './draft-targets.js';
import { classifyScript, SCRIPT } from './bilingual.js';
import { subjectKey } from '../study-draft.js';

/* ================================================================== *
 * ١) تطبيعُ العنوان — والترقيمُ لا يصنع عنوانًا جديدًا
 * ================================================================== */

/**
 * يطبّع سطرًا ليُقارَن بعنوان.
 *
 * ⚠️ **ويُحذَف الترقيمُ من آخره**: «MICRO CORE 1» و«MICRO CORE 2»
 *    عنوانان لنفس النوع، والرقمُ ترتيبٌ لا هُويّة. ولو دخل المقارنةَ
 *    لَاحتجنا صفًّا في الجدول لكل رقم.
 */
function normalizeHead(line) {
  return String(line || '')
    .normalize('NFC')
    .replace(/[̀-ͯ҃-҉]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/^[\s*_#•·—–\-«"'[(【〈]+/, '')
    .replace(/[\s*_#•·—–:：.،,)\]】〉»"']+$/, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    /* الترقيمُ في آخر العنوان — عربيًّا كان أو لاتينيًّا. */
    .replace(/\s*[\d٠-٩]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** أقسامُ V2 — كلٌّ ومرادفاتُه. */
const HEADS = [
  [ROLE.MICRO_CORE, ['micro core', 'micro cores', 'قطعة أساسية', 'القطع الأساسية', 'كور', 'الكور']],
  [ROLE.EXPANSION, ['expansion', 'expansions', 'expanding recall', 'التدرج', 'التوسع', 'توسعة', 'البناء التدريجي']],
  [ROLE.VARIATION, ['variation', 'variations', 'تكرار', 'التكرارات', 'تنويع', 'التنويعات']],
  [ROLE.FULL_BUILD, ['full reconstruction', 'full build', 'إعادة البناء الكامل', 'إعادة البناء', 'البناء الكامل']],
];

/** عناوينُ سقالةٍ — تُفهَم ولا تصير أهدافًا (بند ١٢). */
const SUPPORT_HEADS = [
  ['family', ['core family', 'عائلة', 'عائلة القلب', 'العائلة']],
  ['priority', ['priority', 'الأولوية', 'الاولويه']],
  ['chain', ['quick recall chain', 'شريط الاسترجاع السريع', 'الاسترجاع السريع', 'سلسلة الاسترجاع']],
  ['repetition', ['high-value core repetition', 'high value core repetition', 'تكرار القلب المهم']],
  ['meaning', ['المعنى', 'الإحساس', 'الاحساس', 'الحس']],
  ['pattern', ['القالب', 'النمط', 'التركيب']],
  ['examples', ['أمثلة', 'امثلة', 'الأمثلة', 'الامثلة', 'مثال', 'examples']],
  ['note', ['ملاحظة', 'ملحوظة', 'تنبيه', 'note']],
  ['source', ['الجملة الأساسية', 'الجملة الأصلية', 'الأصل', 'النص الأصلي']],
];

/** سؤالٌ وجوابٌ — تسميتان تنظيميّتان لا تُنطَقان أبدًا (بند ٤). */
const CUE_WORDS = ['вопрос', 'سؤال', 'question'];
const ANSWER_WORDS = ['ответ', 'إجابة', 'الإجابة', 'جواب', 'answer'];

const INDEX = new Map();
for (const [role, words] of HEADS) for (const w of words) INDEX.set(normalizeHead(w), { kind: 'role', role });
for (const [id, words] of SUPPORT_HEADS) for (const w of words) INDEX.set(normalizeHead(w), { kind: 'support', id });
for (const w of CUE_WORDS) INDEX.set(normalizeHead(w), { kind: 'cue' });
for (const w of ANSWER_WORDS) INDEX.set(normalizeHead(w), { kind: 'answer' });

/**
 * يقرأ سطرًا: أهو عنوان؟ وما بعده على نفس السطر؟
 *
 * ⚠️ **والقيمةُ قد تكون على السطر نفسِه بعد النقطتين** («Вопрос: …»)
 *    أو على السطر التالي. وكلاهما يقع في مسودّاتٍ حقيقيّة.
 */
export function readHead(line) {
  const raw = String(line || '');
  const at = raw.search(/[:：]/);
  if (at >= 0) {
    const found = INDEX.get(normalizeHead(raw.slice(0, at)));
    if (found) return { ...found, rest: raw.slice(at + 1).trim() };
  }
  const whole = INDEX.get(normalizeHead(raw));
  return whole ? { ...whole, rest: '' } : null;
}

const isSeparatorLine = (line) => /^[\s]*[━─—–\-=_·•]{3,}[\s]*$/.test(String(line || ''));
const isRu = (text) => classifyScript(text) === SCRIPT.CYRILLIC;
const isAr = (text) => classifyScript(text) === SCRIPT.ARABIC;

/* ================================================================== *
 * ٢) الكشف — بنيةٌ صريحةٌ لا حدس (بند ٣١)
 * ================================================================== */

/**
 * هل هذه مسودّةُ V2؟
 *
 * ⚠️ **ولا تكفي `Вопрос:` وحدَها.** ملاحظةٌ قديمةٌ قد تحمل سؤالًا
 *    روسيًّا، وترقيتُها إلى V2 تُلبسها بنيةً لم يقصدها مؤلّفُها —
 *    وهو ما ينهى عنه البند ٣١ («لا ترقيةَ كاذبةً للملاحظات القديمة»).
 *    فالمطلوبُ **عنوانُ قسمٍ بنيويٌّ واحدٌ على الأقلّ**.
 */
export function isDraftV2(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const head = readHead(line);
    if (!head) continue;
    if (head.kind === 'role') return true;
    if (head.kind === 'support' && ['family', 'chain', 'repetition'].includes(head.id)) return true;
  }
  return false;
}

/* ================================================================== *
 * ٣) القراءة
 * ================================================================== */

const blank = () => ({
  ru: '', ar: '', cue: '', family: '', parent: '',
  sense: [], patterns: [], examples: [],
});

/**
 * يقرأ مسودّةَ V2 إلى أدوارٍ وهرميّة.
 *
 * ⚠️ **والترتيبُ المؤلَّف يُحفَظ كما هو** (بند ٧): لا فرزَ أبجديًّا ولا
 *    بالطول ولا بترتيبٍ «تربويٍّ» نستنبطه. المؤلّفُ الخارجيُّ يقرّر،
 *    والتطبيقُ يعرض ما كُتب.
 *
 * @returns {{version: number, targets: object[], chain: {cue,ru}[],
 *            families: {label: string, priority: string}[], source: string}}
 */
export function parseDraftV2(text) {
  const lines = String(text || '').split(/\r?\n/);

  const targets = [];
  const chain = [];
  const families = [];
  let source = '';

  let role = null;          /* دورُ القسم الجاري */
  let family = '';          /* عائلةُ القلب الجارية */
  let sub = null;           /* وضعُ سقالةٍ فرعيّ: meaning · pattern · examples · note */
  let inChain = false;      /* داخلَ شريط الاسترجاع السريع */
  let inSource = false;
  let pendingCue = '';      /* سؤالٌ ينتظر إجابته */
  let expectCue = false;    /* «Вопрос:» بلا نصٍّ على سطره */
  let expectAnswer = false;
  let open = null;          /* الهدفُ المفتوح، تُلحَق به السقالة */

  const push = (ru, ar = '') => {
    const one = blank();
    one.role = role;
    one.ru = ru.trim();
    one.ar = ar.trim();
    one.cue = pendingCue;
    one.family = role === ROLE.VARIATION ? family : '';
    one.parent = '';
    targets.push(one);
    open = one;
    pendingCue = '';
    return one;
  };

  /**
   * «Ответ:» — **يلتصق بالهدف المفتوح ولا يُنشئ ثانيًا** (قيدُ المالك ٢).
   *
   * ⚠️ **وأوّلُ كتابةٍ أنشأت هدفًا لكلّ إجابة.** فقطعةٌ نصُّها سطرٌ
   *    صريحٌ ثمّ «Вопрос/Ответ» يعيد النصَّ نفسَه صارت **قطعتين**:
   *
   *        MICRO CORE 1
   *        требования по документации   ← هدف
   *        Вопрос: …
   *        Ответ: требования по документации   ← هدفٌ ثانٍ بنفس النصّ
   *
   *    فقال العدّادُ «٥ قطع» عن ثلاث — وهو بعينه عيبُ «٥ ← ١٠» الذي
   *    جاءت هذه التمريرةُ لإصلاحه، وقد كِدتُ أُعيد إنتاجَه بشكلٍ آخر.
   *    أمسكه التثبيتُ الدقيقُ للنصوص، لا عدٌّ إجماليّ.
   */
  const answer = (text) => {
    if (inChain) { chain.push({ cue: pendingCue, ru: text }); pendingCue = ''; return; }
    /* إجابةٌ تُعيد نصَّ الهدف المفتوح: سؤالُها له، ولا هدفَ جديد. */
    if (open && subjectKey(open.ru) === subjectKey(text)) {
      if (pendingCue) { open.cue = pendingCue; pendingCue = ''; }
      return;
    }
    /* وهدفٌ مفتوحٌ بلا نصٍّ بعدُ يأخذ الإجابةَ نصًّا له. */
    if (open && !open.ru) {
      open.ru = text;
      if (pendingCue) { open.cue = pendingCue; pendingCue = ''; }
      return;
    }
    push(text);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    /* الفاصلُ يُنهي هدفًا مفتوحًا ولا يُنهي قسمًا (بند ٣٢). */
    if (isSeparatorLine(trimmed)) { open = null; sub = null; continue; }

    const head = readHead(trimmed);
    if (head) {
      if (head.kind === 'role') {
        /*
         * ⚠️ **العنوانُ حدٌّ بذاته** (قيدُ المالك ١): لا ينتظر فاصلًا.
         *    فمسودّةٌ نُسي فيها `━━━` لا تُلحق قطعتَها بسابقتها.
         */
        role = head.role;
        sub = null; open = null; inChain = false; inSource = false;
        if (head.rest) push(head.rest);
        continue;
      }
      if (head.kind === 'cue') {
        if (head.rest) { pendingCue = head.rest; expectCue = false; } else expectCue = true;
        sub = null;
        continue;
      }
      if (head.kind === 'answer') {
        if (head.rest) { answer(head.rest); expectAnswer = false; } else expectAnswer = true;
        sub = null;
        continue;
      }
      /* سقالة. */
      if (head.id === 'chain') { inChain = true; role = null; open = null; sub = null; continue; }
      if (head.id === 'family') {
        family = head.rest || '';
        families.push({ label: family, priority: '' });
        role = ROLE.VARIATION; open = null; sub = null; inChain = false;
        continue;
      }
      if (head.id === 'priority') {
        if (families.length) families[families.length - 1].priority = head.rest;
        continue;
      }
      if (head.id === 'repetition') { role = ROLE.VARIATION; open = null; sub = null; continue; }
      if (head.id === 'source') { inSource = true; role = null; open = null; sub = null; continue; }
      sub = head.id;
      if (head.rest && open) attachSupport(open, sub, head.rest);
      continue;
    }

    /* سطرٌ عاديّ. */
    if (inSource) { if (!source && isRu(trimmed)) source = trimmed; continue; }

    if (expectCue) {
      pendingCue = trimmed; expectCue = false; continue;
    }
    if (expectAnswer) { answer(trimmed); expectAnswer = false; continue; }

    if (inChain) {
      /* «سؤال → جواب» على سطرٍ واحد، أو سطران متتاليان. */
      const arrow = trimmed.split(/\s*(?:→|←|=>|->)\s*/);
      if (arrow.length === 2) { chain.push({ cue: arrow[0].trim(), ru: arrow[1].trim() }); continue; }
      if (pendingCue) { chain.push({ cue: pendingCue, ru: trimmed }); pendingCue = ''; }
      else pendingCue = trimmed;
      continue;
    }

    if (sub === 'examples') {
      if (!open) continue;
      if (isRu(trimmed)) open.examples.push({ ru: trimmed, ar: '' });
      else if (open.examples.length) open.examples[open.examples.length - 1].ar = trimmed;
      continue;
    }
    if (sub && open) { attachSupport(open, sub, trimmed); continue; }

    /*
     * ⚠️ **ولا هدفَ بلا دورٍ مُعلَن** (قيدُ المالك ٣): سطرٌ روسيٌّ خارجَ
     *    أيّ قسمٍ لا يصير هدفَ نُطقٍ لمجرّد أنه سيريليّ. وهذا بالضبط ما
     *    كان يفعله المرشّحُ القديم.
     */
    if (!role) continue;

    if (isRu(trimmed)) push(trimmed);
    else if (isAr(trimmed) && open && !open.ar) open.ar = trimmed;
    else if (open) open.sense.push(trimmed);
  }

  /* الأمثلةُ أهدافٌ اختياريّةٌ بدورها الخاصّ (بند ١٣). */
  const flat = [];
  for (const one of targets) {
    flat.push(one);
    for (const ex of one.examples) {
      flat.push({
        ...blank(), role: ROLE.EXAMPLE, ru: ex.ru, ar: ex.ar,
        parent: one.ru, family: one.family,
      });
    }
  }

  return { version: 2, targets: flat, chain, families, source };
}

function attachSupport(target, kind, text) {
  if (kind === 'pattern') target.patterns.push(text);
  else if (kind === 'meaning') { if (!target.ar) target.ar = text; else target.sense.push(text); }
  else target.sense.push(text);
}

/* ================================================================== *
 * ٤) العدّ — دلالةٌ لا رقمٌ مبهم (بنود ١٥ و٥٣)
 * ================================================================== */

/**
 * يعدُّ بالأدوار.
 *
 * ⚠️ **ولا رقمَ مجمَّعٍ بلا تفصيله** (بند ١٥): «١٨ عنصر تدريب» وحدَها
 *    هي نفسُ عيب «٤٤ وحدة» — رقمٌ لا يقول ما يعدّ. فالمجموعُ هنا يُشتقّ
 *    من التفصيل، ولا يُحسَب بطريقٍ ثانٍ.
 */
export function countRoles(targets) {
  const by = {};
  for (const one of targets) by[one.role] = (by[one.role] || 0) + 1;
  const speech = (by[ROLE.MICRO_CORE] || 0) + (by[ROLE.EXPANSION] || 0)
    + (by[ROLE.VARIATION] || 0) + (by[ROLE.FULL_BUILD] || 0);
  return { by, speech, examples: by[ROLE.EXAMPLE] || 0 };
}

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
  ['meaning', ['المعنى']],
  /*
   * ⚠️ **و«الإحساس» فُصل عن «المعنى» (WS-DI · بند ٥).** كان مرادفًا له،
   *    و`attachSupport` تضع أوّلَ نصٍّ في `ar` — فسطرُ الإحساس كان
   *    يحلّ محلَّ ترجمة القلب حين تسبقه. وهما شيئان: المعنى ترجمةٌ،
   *    والإحساسُ صورةٌ ذهنيّةٌ تشرح **لِمَ** تُقال هكذا.
   */
  ['feel', ['الإحساس', 'الاحساس', 'الحس', 'feel']],
  /*
   * ⚠️ **والجذرُ والعيلةُ سقالةٌ لا هدف** (بند ٥): سطرٌ روسيٌّ فيه
   *    عائلةُ كلمةٍ ليس جملةً تُنطَق في الشادوينج. ولولا هذا العنوانُ
   *    لَوقع سطرُ العائلة في `if (isRu) push(...)` فصار هدفَ نُطقٍ
   *    وضخّم عدَّ القلوب — وهو بعينه العيبُ الذي وُجدت V2 لإبطاله.
   */
  ['roots', ['الجذر والعيلة', 'الجذر والعائلة', 'الجذر و العيلة', 'الجذر',
    'العيلة', 'العائلة الاشتقاقية', 'root and family', 'word family']],
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

/**
 * الشكلُ الخام لهدفٍ مقروء.
 *
 * ⚠️ **و`pairs` هي أزواجُ الاسترجاع المؤلَّفة** (WS-DI · بند ٢). كان
 *    `cue` و`reply` سلسلتين مفردتين، فقلبٌ فيه سؤالان يفقد أوّلَهما
 *    صامتًا: الثاني يكتب فوق الأوّل. وهما يبقيان — أوّلُ زوجٍ — لأنّ
 *    `fingerprint` تقرأ `cue`، وتغييرُ ذلك يغيّر كلَّ معرّفٍ مسكوك.
 */
const blank = () => ({
  ru: '', ar: '', cue: '', reply: '', family: '', parent: '',
  sense: [], patterns: [], examples: [], pairs: [], roots: [], feel: [],
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
  /* ⚠️ وترجمةُ الجملة الأساسيّة تُقرأ كذلك — البرومبتُ صار يطلبها. */
  let sourceAr = '';

  let role = null;          /* دورُ القسم الجاري */
  let family = '';          /* عائلةُ القلب الجارية */
  let sub = null;           /* وضعُ سقالةٍ فرعيّ: meaning · pattern · examples · note */
  let inChain = false;      /* داخلَ شريط الاسترجاع السريع */
  let inSource = false;
  let pendingCue = '';      /* سؤالٌ ينتظر إجابته */
  let pendingCueAr = '';    /* ترجمةُ ذلك السؤال */
  let expectCue = false;    /* «Вопрос:» بلا نصٍّ على سطره */
  let expectAnswer = false;
  let open = null;          /* الهدفُ المفتوح، تُلحَق به السقالة */

  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **خانةُ العربيّة — ولمَ لم تكن تكفي قاعدةُ «أوّلُ عربيٍّ للقلب»**
   * ═══════════════════════════════════════════════════════════════
   *
   * البرومبتُ الجديد يشترط أن تتبع **كلَّ** سطرٍ روسيٍّ ترجمتُه فورًا —
   * ومنها سطرُ السؤال وسطرُ الإجابة. والقاعدةُ القديمة كانت:
   *
   *     else if (isAr(line) && open && !open.ar) open.ar = line;
   *
   * فترجمةُ السؤال كانت تنزل على **ترجمة القلب** حين يكون القلبُ بلا
   * ترجمةٍ بعد، أو تضيع في `sense` حين يكون له واحدة. وفي الحالين
   * السؤالُ يظهر بلا سنَدٍ عربيّ — وهو نصفُ ما طُلب عرضُه.
   *
   * فصارت الترجمةُ تُسنَد إلى **آخر سطرٍ روسيٍّ قُرئ**، أيًّا كان دورُه.
   */
  let arSlot = null;        /* دالّةٌ تستقبل ترجمةَ آخر سطرٍ روسيّ */

  const push = (ru, ar = '') => {
    const one = blank();
    one.role = role;
    one.ru = ru.trim();
    one.ar = ar.trim();
    one.cue = pendingCue;
    one.family = role === ROLE.VARIATION ? family : '';
    one.parent = '';
    /*
     * ⚠️ **و`before` ترتيبٌ مؤلَّفٌ لا زينة**: هنا سبق السؤالُ نصَّه
     *    («Вопрос:» ثمّ «Ответ:» يحمل النصّ)، وهناك تبع القلبَ. فلو
     *    سُطِّحت الوحداتُ بترتيبٍ واحدٍ لَنطق الشادوينج إجابةَ إعادةِ
     *    البناء **قبل** سؤالها — أي صار الاسترجاعُ قراءة.
     */
    if (pendingCue) {
      one.pairs.push({ cue: pendingCue, cueAr: pendingCueAr, reply: '', replyAr: '', before: true });
    }
    targets.push(one);
    open = one;
    pendingCue = '';
    pendingCueAr = '';
    arSlot = (text) => { if (!one.ar) one.ar = text; else one.sense.push(text); };
    return one;
  };

  /** يسجّل زوجَ استرجاعٍ على هدفٍ مفتوح، ويُبقي الأوّلَ في `cue`/`reply`. */
  const addPair = (target, reply) => {
    const pair = { cue: pendingCue, cueAr: pendingCueAr, reply, replyAr: '' };
    target.pairs.push(pair);
    if (!target.cue) target.cue = pendingCue;
    if (!target.reply) target.reply = reply;
    pendingCue = '';
    pendingCueAr = '';
    arSlot = (text) => { pair.replyAr = pair.replyAr || text; };
    return pair;
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
    if (inChain) {
      const link = { cue: pendingCue, cueAr: pendingCueAr, ru: text, ar: '' };
      chain.push(link);
      pendingCue = '';
      pendingCueAr = '';
      arSlot = (ar) => { link.ar = link.ar || ar; };
      return;
    }
    /* إجابةٌ تُعيد نصَّ الهدف المفتوح: سؤالُها له، ولا هدفَ جديد. */
    if (open && subjectKey(open.ru) === subjectKey(text)) {
      if (pendingCue) addPair(open, '');
      return;
    }
    /* وهدفٌ مفتوحٌ بلا نصٍّ بعدُ يأخذ الإجابةَ نصًّا له. */
    if (open && !open.ru) {
      open.ru = text;
      const slot = open;
      if (pendingCue) addPair(open, '');
      arSlot = (ar) => { if (!slot.ar) slot.ar = ar; else slot.sense.push(ar); };
      return;
    }

    /*
     * ═══════════════════════════════════════════════════════════════
     * ⚠️ **وإجابةُ الاسترجاع أطولُ من قلبها — ولا تصير قلبًا ثانيًا**
     * ═══════════════════════════════════════════════════════════════
     *
     * الشرطُ فوقُ يقبل الإجابةَ **إن طابقت نصَّ القلب حرفًا بحرف** فقط،
     * وذلك كان يكفي حين كان البرومبتُ يطلب «الإجابةُ = نفسُ القلب».
     * ثمّ صار يطلب إجابةً **منطوقةً طبيعيّة**:
     *
     *     MICRO CORE 2
     *     наличие документа
     *     Вопрос: На что важно обратить внимание в первую очередь?
     *     Ответ:  На наличие документа.        ← ليست حرفيّةً
     *
     * فتسقط إلى `push` وتصير **قلبًا ثانيًا**. وقِستُه: ثلاثةُ قلوبٍ
     * مؤلَّفةٍ تُقرأ ستّة، والعدّادُ يقول ١١ هدفَ نُطق. وهو بعينه تضخُّمُ
     * العدّ الذي وُجدت WS-DV2 لإبطاله — عاد من بابٍ آخر.
     *
     * فالسؤالُ هو الحَكَم: **«Ответ:» تتبع «Вопрос:» داخل هدفٍ مفتوح**،
     * فهي إجابةُ ذلك الهدف مهما طالت. تُعلَّق عليه ولا تُنشئ ثانيًا.
     *
     * ⚠️ **والقلبُ يبقى هُويّةَ التعلّم والتدريب**: `ru` لم يُمَسّ، فلا
     *    تتغيّر البصمةُ ولا المعرّفُ ولا حالةُ «خلصت». و`reply` عرضٌ
     *    في سطح الاسترجاع لا هدفٌ يُعَدّ.
     *
     * ⚠️ **وإجابةٌ بلا سؤالٍ تبقى كما كانت** (تُدفَع هدفًا): غيابُ
     *    `Вопрос:` يعني أنّها ليست إجابةَ استرجاعٍ لهذا الهدف، وقلبُ
     *    ذلك كان سيبتلع أسطرًا مؤلَّفةً قائمةً بذاتها.
     */
    if (open && pendingCue) {
      addPair(open, text);
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
        if (head.rest) {
          pendingCue = head.rest; pendingCueAr = ''; expectCue = false;
          arSlot = (ar) => { pendingCueAr = pendingCueAr || ar; };
        } else { expectCue = true; pendingCueAr = ''; }
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
    if (inSource) {
      if (!source && isRu(trimmed)) source = trimmed;
      else if (source && !sourceAr && isAr(trimmed)) sourceAr = trimmed;
      continue;
    }

    if (expectCue) {
      pendingCue = trimmed;
      pendingCueAr = '';
      expectCue = false;
      arSlot = (ar) => { pendingCueAr = pendingCueAr || ar; };
      continue;
    }
    if (expectAnswer) { answer(trimmed); expectAnswer = false; continue; }

    if (inChain) {
      /*
       * ⚠️ **وترجمةُ سطرِ الشريط تُقرأ قبل أن تُحسَب سؤالًا.** الشريطُ
       *    يتناوب سؤالًا فجوابًا، والبرومبتُ الجديد يدسّ بينهما سطرَ
       *    ترجمة. فبلا هذا السطر تصير الترجمةُ العربيّةُ «سؤالًا» في
       *    الشريط، ويخرج الجوابُ الحقيقيُّ ترجمةً لسؤالٍ لم يُكتَب.
       */
      if (isAr(trimmed) && arSlot) { arSlot(trimmed); arSlot = null; continue; }
      /* «سؤال → جواب» على سطرٍ واحد، أو سطران متتاليان. */
      const arrow = trimmed.split(/\s*(?:→|←|=>|->)\s*/);
      if (arrow.length === 2) { chain.push({ cue: arrow[0].trim(), ru: arrow[1].trim(), cueAr: '', ar: '' }); continue; }
      if (pendingCue) {
        const link = { cue: pendingCue, cueAr: pendingCueAr, ru: trimmed, ar: '' };
        chain.push(link);
        pendingCue = ''; pendingCueAr = '';
        arSlot = (ar) => { link.ar = link.ar || ar; };
      } else {
        pendingCue = trimmed;
        pendingCueAr = '';
        arSlot = (ar) => { pendingCueAr = pendingCueAr || ar; };
      }
      continue;
    }

    if (sub === 'examples') {
      if (!open) continue;
      if (isRu(trimmed)) open.examples.push({ ru: trimmed, ar: '' });
      else if (open.examples.length) open.examples[open.examples.length - 1].ar = trimmed;
      continue;
    }
    /*
     * ⚠️ **والجذرُ والعيلةُ زوجٌ مرتَّب لا سطران سائبان** (بند 4B):
     *    سطرٌ روسيٌّ فيه أفرادُ العائلة، وتحته عربيٌّ يترجمهم **بنفس
     *    الترتيب**. ففصلُهما في حقلين يفقد التقابل، وهو كلُّ فائدتهما.
     */
    if (sub === 'roots') {
      if (!open) continue;
      if (isRu(trimmed)) open.roots.push({ ru: trimmed, ar: '' });
      else if (open.roots.length) open.roots[open.roots.length - 1].ar = trimmed;
      else open.roots.push({ ru: '', ar: trimmed });
      continue;
    }
    if (sub === 'feel') {
      if (open) open.feel.push(trimmed);
      continue;
    }
    if (sub && open) { attachSupport(open, sub, trimmed); continue; }

    /*
     * ⚠️ **وترجمةُ آخر سطرٍ روسيٍّ تذهب إليه هو** — سؤالًا كان أو
     *    إجابةً أو قلبًا. راجع شرحَ `arSlot` أعلاه.
     */
    if (isAr(trimmed) && arSlot) { arSlot(trimmed); arSlot = null; continue; }

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

  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **سؤالُ الاسترجاع وحدةُ نُطقٍ حقيقيّة — تصحيحُ تصميمٍ سابق**
   * ═══════════════════════════════════════════════════════════════
   *
   * كانت WS-DV2 تحفظ `Вопрос:` **سلسلةً على الهدف** (`cue`) وتعرضها
   * سقالةً لا تُنطَق. وكان ذلك صحيحًا في نصفه وخاطئًا في نصفه:
   *
   *   صحيح  — ألّا تُعَدَّ قلبًا أساسيًّا؛ سؤالٌ ليس قلبًا.
   *   خاطئ  — ألّا تُنطَق؛ المتعلّمُ **يجب أن يسمع السؤالَ الروسيّ**
   *           ويفهمه ويستحضر الجواب. السؤالُ مُدخَلٌ روسيٌّ بذاته.
   *
   * فصارت الأزواجُ وحداتٍ مسطَّحةً بدورين خاصّين — تُنطَق وتُنتقى،
   * ولا تدخل عدَّ القلوب. والفصلُ بين **عدّ الأدوار** و**عدّ وحدات
   * التدريب** هو ما يجعل الاثنين صادقين معًا (`speech` و`units`).
   *
   * ⚠️ **وهُويّةُ القلب لم تُمَسّ**: `ru` كما هو، و`cue` أوّلُ زوجٍ كما
   *    كان — فبصمةُ `fingerprint` ثابتةٌ ولا معرّفَ مسكوكٌ يندثر.
   *
   * ⚠️ **ولا تُبنى وحدةُ إجابةٍ حين تكون الإجابةُ هي القلبَ نفسَه**:
   *    ذلك يضاعف النصَّ نفسَه وحدتين — وهو تضخُّمُ العدّ من بابٍ ثالث.
   */
  const recallUnits = (one, { before }) => {
    const out = [];
    for (const pair of one.pairs) {
      if (Boolean(pair.before) !== before) continue;
      if (pair.cue) {
        out.push({
          ...blank(), role: ROLE.RECALL_CUE, ru: pair.cue, ar: pair.cueAr,
          parent: one.ru, family: one.family,
        });
      }
      if (pair.reply && subjectKey(pair.reply) !== subjectKey(one.ru)) {
        out.push({
          ...blank(), role: ROLE.RECALL_ANSWER, ru: pair.reply, ar: pair.replyAr,
          parent: one.ru, family: one.family, cue: pair.cue,
        });
      }
    }
    return out;
  };

  /* الأمثلةُ أهدافٌ اختياريّةٌ بدورها الخاصّ (بند ١٣). */
  const flat = [];
  for (const one of targets) {
    /* والترتيبُ المؤلَّف: ما سبق نصَّه يسبقه، وما تبعه يتبعه. */
    flat.push(...recallUnits(one, { before: true }));
    flat.push(one);
    flat.push(...recallUnits(one, { before: false }));
    for (const ex of one.examples) {
      flat.push({
        ...blank(), role: ROLE.EXAMPLE, ru: ex.ru, ar: ex.ar,
        parent: one.ru, family: one.family,
      });
    }
  }

  /*
   * ⚠️ **وشريطُ الاسترجاع السريع يُنطَق هو الآخر** (بند 4J): هو السلسلةُ
   *    الذهنيّةُ المضغوطة، وأهمُّ ما يُتدرَّب عليه بصوتٍ عالٍ. وكان
   *    `chain` يُربَط بأهدافٍ قائمةٍ **للعرض فقط** ولا يدخل التدريب.
   *
   * ⚠️ **و`parent: 'chain'` يفصل بصمتَه عن بصمة القلب**: إجابةُ الشريط
   *    قد تعيد نصَّ هدفٍ قائمٍ حرفيًّا، فلولا الأبُ لتصادمت البصمتان
   *    وتشارك هدفان حالةَ «خلصت» — وهو عيبُ الهُويّة بعينه.
   */
  for (const link of chain) {
    if (link.cue) {
      flat.push({
        ...blank(), role: ROLE.RECALL_CUE, ru: link.cue, ar: link.cueAr || '',
        parent: CHAIN_PARENT,
      });
    }
    if (link.ru) {
      flat.push({
        ...blank(), role: ROLE.RECALL_ANSWER, ru: link.ru, ar: link.ar || '',
        parent: CHAIN_PARENT, cue: link.cue || '',
      });
    }
  }

  return { version: 2, targets: flat, chain, families, source, sourceAr };
}

/** أبُ وحدات الشريط السريع — يفصل بصمتَها عن بصمة الأهداف القائمة. */
export const CHAIN_PARENT = '__chain__';

function attachSupport(target, kind, text) {
  if (kind === 'pattern') target.patterns.push(text);
  else if (kind === 'meaning') { if (!target.ar) target.ar = text; else target.sense.push(text); }
  else if (kind === 'feel') target.feel.push(text);
  else if (kind === 'roots') target.roots.push({ ru: text, ar: '' });
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

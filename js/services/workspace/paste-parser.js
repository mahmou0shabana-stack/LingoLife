/**
 * LingoLife — محلّلُ اللصق المنظَّم (WS-F · بنود ٢٧…٣٤ و٦٧ و٩٢ و٩٣)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **حتميٌّ بالكامل — ولا سطرَ ذكاءٍ اصطناعيٍّ فيه** (بند ٩٠)
 * ═══════════════════════════════════════════════════════════════
 *
 * البنيةُ موجودةٌ في العناوين التي كتبتَها بيدك. فلا حاجةَ لنموذجٍ
 * يخمّنها، والتخمينُ هنا أسوأُ من العجز: عقدةٌ في غير مكانها تُكتشَف
 * بعد أسبوعين، وعقدةٌ لم تُقترَح تُصلَح في ثانية.
 *
 * وما لا نعرفه **يُعرَض** لا يُخمَّن ولا يُرمى (بند ٣٠).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا حرفَ يضيع** (بند ٩٣)
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ سطرٍ في المدخل يذهب إلى واحدٍ من ثلاثة، ولا رابعَ:
 *
 *   · سطرُ عنوانٍ  → صار عقدةً (وعنوانُها هو السطرُ كما كتبتَه)
 *   · سطرُ نصٍّ    → دخل نصَّ العقدة التي فوقه
 *   · تمهيدٌ       → ما قبل أوّلِ عنوان، ويُعرَض تمهيدًا لا يُبتلَع
 *
 * ويُرجِع المحلّلُ `accounting` يُثبت ذلك عددًا — لأن «لم يضع شيء»
 * دعوى تُقاس لا تُقال.
 */

/**
 * سُلَّمُ المستويات — **موثَّقٌ لأنّه قرار** (بند ٢٩).
 *
 * الرقمُ الأصغر أعلى. والأسبقيّةُ هذه اختيارٌ لا قانونَ لغة:
 *
 *   ١ مرحلة   PHASE
 *   ٢ نسخة    VERSION
 *   ٣ جزء     PART
 *   ٤ جولة    ROUND
 *   ٥ مستوى   LEVEL
 *   ٦ قسم     SECTION
 *
 * ⚠️ **ولا يُفرَض تسلسلٌ كامل** (بند ٢٩): «مرحلة ← جزء» صحيحةٌ بلا
 *    نسخةٍ بينهما، لأن الإسنادَ يكون **لأقرب أبٍ أعلى** لا لمستوًى
 *    بعينه. ولو اشترطنا السلسلةَ كاملةً لَما مرّ أشيعُ شكلٍ عندك.
 *
 * ⚠️ و«مستوى» و«قسم» ليس لهما `nodeKind` في WS57، فيُخزَّنان `custom`
 *    ويبقى `marker` أثرًا يقول من أين جاءا. اختراعُ نوعٍ جديدٍ في
 *    المخزن لأجل كلمةٍ في عنوانٍ ملصوقٍ إسرافٌ لا مبرّرَ له.
 */
export const MARKERS = Object.freeze([
  { marker: 'PHASE', level: 1, kind: 'phase', words: ['phase', 'مرحلة'] },
  { marker: 'VERSION', level: 2, kind: 'version', words: ['version', 'نسخة'] },
  { marker: 'PART', level: 3, kind: 'part', words: ['part', 'جزء'] },
  { marker: 'ROUND', level: 4, kind: 'round', words: ['round', 'جولة'] },
  { marker: 'LEVEL', level: 5, kind: 'custom', words: ['level', 'مستوى'] },
  { marker: 'SECTION', level: 6, kind: 'custom', words: ['section', 'قسم'] },
]);

const BY_WORD = new Map();
for (const row of MARKERS) for (const word of row.words) BY_WORD.set(word, row);

/** أعمقُ مستوًى معروف — يُستعمَل سقفًا للعناوين المجهولة المُرقّاة. */
export const DEEPEST = MARKERS[MARKERS.length - 1].level;

const BY_LEVEL = new Map(MARKERS.map((row) => [row.level, row]));

/**
 * صفُّ المستوى — والنوعُ يتبع المستوى لا الكلمةَ المكتوبة.
 *
 * فإن لم يكن للمستوى صفٌّ معروف (لن يحدث اليوم) رجعنا لِما قالته
 * الكلمةُ نفسُها، وهو أصدقُ من `custom` أعمى.
 */
const at_level = (level, known) => BY_LEVEL.get(level) || known || null;

/**
 * أقصى طولِ سطرٍ يُقبَل عنوانًا.
 *
 * ⚠️ **وهذا الحدُّ هو ما يمنع الجملةَ أن تصير مرحلة.** «جزء ٣ من
 *    الشحنة وصل متأخّرًا وسبب ذلك…» جملةٌ تبدأ بكلمةٍ ورقم، ولو قبلناها
 *    عنوانًا لتفتّت نصُّك إلى عُقَدٍ بلا معنى. والسطرُ الطويل نصٌّ
 *    بالافتراض، والقصيرُ عنوانٌ مرشَّح — ثم أنت تحكم في المراجعة.
 */
const MAX_HEADING = 90;

/** أرقامٌ عربيّةٌ ولاتينيّة — «١٥» و«15» سواء. */
const DIGITS = '0-9٠-٩۰-۹';
/** حروفُ الكلمات: لاتينيّةٌ وعربيّة. */
const LETTERS = 'A-Za-z؀-ۿ';

/*
 * صيغةُ سطر العنوان:
 *
 *   [علامةُ ماركداون اختياريّة] كلمة  رقم[حرفُ لاحقة]  [فاصل] [بقيّة]
 *
 * ⚠️ **والرقمُ شرطٌ لا زينة.** بدونه تصير كلُّ فقرةٍ تبدأ بـ«جزء»
 *    عنوانًا. ووجودُ الرقم هو ما يفصل «PART 1» عن «Part of the load».
 *
 * ⚠️ ولاحقةُ الحرف («1B») مقصودة: مراحلُك تحمل «١ب» فعلًا.
 */
const HEADING_RE = new RegExp(
  `^[ \\t]*(?:#{1,6}[ \\t]+)?([${LETTERS}]+)[ \\t]*([${DIGITS}]+[${LETTERS}]?)[ \\t]*(?:([—–:·.،ـ\\-]+)[ \\t]*)?(.*)$`
);

/**
 * أقصى عددِ كلماتٍ بعد الرقم حين **لا** يوجد فاصلٌ من علامات الترقيم.
 *
 * ⚠️ **بلا هذا يصير النثرُ عناوين.** «PART 1 is where we begin the
 *    story» سطرٌ قصيرٌ يبدأ بكلمةٍ ورقم — وبلا حدٍّ للكلمات كان يمرّ
 *    عنوانًا فيفتّت فقرةً إلى عقدة. أمّا «PART 1 — التغليف والحماية»
 *    فالشرطةُ فيه إعلانُ عنوانٍ صريح، فلا حدَّ عليه.
 *
 *    والمراجعةُ (بند ٣٢) تبقى صمّامَ الأمان الأخير، لكنّ مراجعةَ أربعين
 *    عنوانًا كاذبًا مراجعةٌ لا تُقرَأ.
 */
const BARE_WORDS = 5;

/** سطرٌ يبدو عنوانًا بلا كلمةٍ معروفة — ماركداون أو حروفٌ كبيرةٌ كلُّها. */
const MD_RE = /^[ \t]*#{1,6}[ \t]+\S/;
const SHOUT_RE = new RegExp(`^[ \\t]*[${LETTERS}${DIGITS} \\t—–:·.،_\\-]+$`);

const toLatinDigits = (s) => s.replace(
  /[٠-٩۰-۹]/g,
  (d) => String((d.codePointAt(0) - (d <= '٩' ? 0x0660 : 0x06F0)))
);

/**
 * هل هذا السطرُ عنوانٌ معروف؟ — وما مستواه؟
 * @returns {{marker,level,kind,number,rest,title}|null}
 */
export function headingOf(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING) return null;

  const hit = HEADING_RE.exec(trimmed);
  if (!hit) return null;

  const row = BY_WORD.get(hit[1].toLowerCase());
  if (!row) return null;

  const separator = hit[3] || '';
  const rest = (hit[4] || '').trim();
  /* بلا فاصلٍ صريح: عنوانٌ قصيرٌ نعم، وجملةٌ لا. */
  if (!separator && rest && rest.split(/\s+/).length > BARE_WORDS) return null;

  return {
    marker: row.marker,
    level: row.level,
    kind: row.kind,
    number: toLatinDigits(hit[2]),
    rest,
    /* ⚠️ **العنوانُ هو السطرُ كما كتبتَه** (بند ٢٨) — لا الجزءُ بعد الشرطة. */
    title: trimmed.replace(/^#{1,6}[ \t]+/, ''),
  };
}

/**
 * هل يبدو عنوانًا لكن بنوعٍ لا نعرفه؟ (بند ٣٠)
 *
 * ⚠️ **ولا يُرقَّى تلقائيًّا.** يُعرَض «عنوانٌ محتمل · نوعٌ غير معروف»
 *    وأنت تقرّر. واختراعُ مستوًى له تخمينٌ — وهذا الملفُّ لا يخمّن.
 */
export function looksLikeHeading(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING) return false;
  if (headingOf(trimmed)) return false;

  if (MD_RE.test(trimmed)) return true;

  /* حروفٌ كبيرةٌ كلُّها ولا نقطةَ نهايةِ جملة — شكلُ عنوانٍ صريح. */
  const latin = trimmed.replace(new RegExp(`[^${LETTERS}]`, 'g'), '');
  const hasLatin = /[A-Za-z]/.test(latin);
  if (hasLatin && latin === latin.toUpperCase() && SHOUT_RE.test(trimmed)) return true;

  return false;
}

/**
 * يحلّل نصًّا ملصوقًا إلى شجرةٍ مقترَحة.
 *
 * ⚠️ **مرورٌ واحدٌ على الأسطر** (بند ٩٢): لا بحثَ في النصّ كلِّه لكلّ
 *    عنوان. ثلاثمئةُ عقدةٍ تُحلَّل في مرورٍ خطّيٍّ واحد.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والمراجعةُ تُعيد التحليل ولا تُحرّر شجرةً محفوظة**
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ تعديلٍ في المراجعة (رقِّ عنوانًا · اخفضه نصًّا · غيّر مستواه)
 * يُخزَّن قرارًا مفتاحُه **رقمُ السطر**، ثم يُعاد التحليلُ من الخام.
 * فالشجرةُ مشتقّةٌ دائمًا، ولا حالتان يجب أن تتّفقا.
 *
 * ورقمُ السطر مفتاحٌ **ثابت**: معرّفُ العقدة (`P3`) يتزحزح كلّما تغيّر
 * الشكل، فإعادةُ تسميةٍ محفوظةٌ به تقفز إلى عقدةٍ أخرى.
 *
 * @param {string} input
 * @param {{ levels?: Record<number, number>, demote?: number[],
 *           renames?: Record<number, string> }} options
 *        `levels`  رقمُ السطر → المستوى (يُرقّي مجهولًا أو يزيح معلومًا)
 *        `demote`  أسطرٌ تُعامَل نصًّا مهما بدت عنوانًا (بند ٣٢)
 *        `renames` رقمُ السطر → العنوان الذي كتبتَه
 * @returns {{ ok, reason, nodes, unknown, duplicates, preamble,
 *             counts, accounting, raw }}
 */
export function parsePaste(input, { levels = {}, demote = [], renames = {} } = {}) {
  const forcedText = new Set(demote);
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const text = String(input ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const nodes = [];
  const unknown = [];
  const preambleLines = [];
  /* ⚠️ كلُّ سطرٍ يُوسَم بمصيره — وهو ما يجعل «لم يضع شيء» قابلًا للعدّ. */
  const fate = new Array(lines.length).fill(null);

  /* مكدّسُ الآباء: أحدثُ عقدةٍ عند كلّ مستوًى مفتوح. */
  const stack = [];
  let current = null;

  lines.forEach((line, at) => {
    /* ⚠️ «خُذه نصًّا» قرارٌ صريحٌ يعلو على كلّ كشف (بند ٣٢). */
    const known = forcedText.has(at) ? null : headingOf(line);
    const forced = has(levels, at) ? Number(levels[at]) : null;

    /*
     * ⚠️ **والمجهولُ لا يصير عنوانًا إلّا بقرارك.** بلا ترقيةٍ يبقى
     *    نصًّا — لأن ترك النصّ نصًّا لا يخسر شيئًا، وترقيتَه بلا إذنٍ
     *    تفتّت فقرةً إلى عقدة.
     */
    const maybe = !known && !forcedText.has(at) && looksLikeHeading(line);
    if (maybe && forced === null) unknown.push({ at, line: line.trim() });

    const level = known ? (forced ?? known.level)
      : (maybe && forced !== null ? forced : null);
    if (level === null) {
      fate[at] = current ? { to: 'node', id: current.id } : { to: 'preamble' };
      if (current) current.lines.push(line);
      else preambleLines.push(line);
      return;
    }

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack.length ? stack[stack.length - 1] : null;

    const node = {
      id: `P${nodes.length + 1}`,
      at,
      level,
      /*
       * ⚠️ **وإزاحةُ المستوى تُزيح النوعَ معه.** أوّلُ صياغةٍ أبقت
       *    `marker` من الكلمة المكتوبة، فكانت عقدةٌ نقلتَها إلى مستوى
       *    «نسخة» تُخزَّن `part` — عمقٌ في الشجرة ونوعٌ يكذّبه.
       */
      marker: at_level(level, known)?.marker || 'UNKNOWN',
      kind: at_level(level, known)?.kind || 'custom',
      /* ⚠️ وما أعدتَ تسميتَه في المراجعة يعلو على السطر كما جاء. */
      title: has(renames, at) ? String(renames[at]).trim()
        : (known ? known.title : line.trim()),
      parentId: parent ? parent.id : null,
      lines: [],
      /* ⚠️ المجهولُ المرقَّى يظلّ معلومًا أنّه كان مجهولًا (بند ١١٧). */
      wasUnknown: !known,
    };
    nodes.push(node);
    stack.push(node);
    current = node;
    fate[at] = { to: 'heading', id: node.id };
  });

  for (const node of nodes) node.text = node.lines.join('\n').trim();
  const preamble = preambleLines.join('\n').trim();

  /*
   * ⚠️ **تكرارُ العنوان لا يُدمَج بالاسم** (بند ٦٧). الاسمُ ليس هُويّة:
   *    «جزء ١» تحت مرحلتين مختلفتين شيئان مختلفان تمامًا. فيُبلَّغ
   *    التكرارُ **بين الأشقّاء** وحدَه، وقرارُ الدمج لك.
   */
  const duplicates = [];
  const seen = new Map();
  for (const node of nodes) {
    const key = `${node.parentId || '·'} ${node.title.trim()}`;
    if (seen.has(key)) duplicates.push({ id: node.id, title: node.title, ofId: seen.get(key) });
    else seen.set(key, node.id);
  }

  const byKind = {};
  for (const node of nodes) byKind[node.marker] = (byKind[node.marker] || 0) + 1;

  const accounting = {
    lines: lines.length,
    headingLines: fate.filter((f) => f?.to === 'heading').length,
    textLines: fate.filter((f) => f?.to === 'node').length,
    preambleLines: fate.filter((f) => f?.to === 'preamble').length,
    /* ⚠️ صفرٌ دائمًا — وإن لم يكن فثمّة عطبٌ يُعرَض لا يُخفى. */
    unassigned: fate.filter((f) => f === null).length,
  };

  /*
   * ⚠️ **العمقُ يُحسَب مرّةً نازلًا لا بحثًا لكلّ عقدة.** الصيغةُ الأولى
   *    كتبتُها `nodes.find` داخل حلقة — أي تربيعيّةً على مدخلٍ قد يكون
   *    ثلاثمئةَ عقدة، وبند ٩٢ يطلب الخطّيّة صراحةً.
   */
  const depthById = new Map();
  let depth = 0;
  for (const node of nodes) {
    const d = node.parentId ? (depthById.get(node.parentId) || 0) + 1 : 1;
    depthById.set(node.id, d);
    if (d > depth) depth = d;
  }

  return {
    /* ⚠️ «ما لقيتش هيكل» ليس فشلًا صامتًا — النصُّ الخام باقٍ (بند ١١٨). */
    ok: nodes.length > 0,
    reason: nodes.length ? null : 'no-headings',
    nodes: nodes.map(({ lines: _drop, ...rest }) => rest),
    unknown,
    duplicates,
    preamble,
    counts: { nodes: nodes.length, byKind, depth, unknown: unknown.length },
    accounting,
    raw: text,
  };
}

/**
 * يبني شجرةً متداخلةً من القائمة المسطّحة — للعرض وحدَه.
 *
 * ⚠️ والمسطَّحُ هو الأصل: العمليّاتُ (نقلٌ، استبعادٌ، تغييرُ مستوًى)
 *    تعمل عليه، والتداخلُ يُشتقّ عند كلّ رسم. ولو خزّنّا المتداخلَ
 *    لصار لكلّ عمليّةٍ حالتان يجب أن تتّفقا.
 */
export function nestProposal(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = [];
  for (const node of nodes) {
    const row = byId.get(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(row);
    else roots.push(row);
  }
  return roots;
}

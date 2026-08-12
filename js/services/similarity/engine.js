/**
 * LingoLife — محرّك التشابه الموحَّد (الملحق · G + K)
 *
 * الملحق يطلب في **K7** ألّا يكون في التطبيق محرّكا تشابهٍ منفصلان.
 * وحين فُتِّش الكود وُجد **ثلاثة**:
 *
 *   `import/plan.js` · `type-service.js` · `dev/issue-service.js`
 *
 * ⚠️ **والمكرَّر لم يكن `editDistance`** — تلك مشتركةٌ في
 * `utils/normalization.js` منذ اليوم الأوّل. المكرَّر كان **السياسة**:
 * كل موضعٍ اخترع حدَّه (٢ أو ٣)، وصياغةَ سببه، وترتيبَ نتائجه. وتلك
 * السياسات **تختلف فعلًا وعن قصد**:
 *
 * | | الاستيراد | الأنواع |
 * |---|---|---|
 * | «أحمد» داخل «أحمد صلاح» | سببٌ يُعرَض | **يُستبعَد** |
 * | لماذا | تخصيصٌ يحتاج قرارك | تفريعٌ لا تكرار — والاقتراح «انقله تحته» |
 *
 * فالتوحيد الصادق ليس أن تصير سياسةً واحدة، بل أن يصير الاختلاف
 * **مُعلَنًا في ملفٍّ يُقرأ** بدل أن يكون مصادفةً في ثلاثة ملفّات.
 *
 * ---
 *
 * ## المحرّك لا يكتب — بالبناء لا بالوعد
 *
 * **G3: «لا تدمج تلقائيًّا أبدًا».** هذا الملفّ لا يستورد `db/` ولا
 * يصدّر دالّةً تكتب. أقصى ما يقوله «هو هو» (`CERTAIN`) — ويبقى القرار
 * قرارك. واختبارٌ يقرأ نصّ الملفّ ويسقط إن ظهر فيه استيرادُ مستودع.
 *
 * ## وكل رقمٍ تحته إشارةٌ مسمّاة
 *
 * لا تُرجَع درجةٌ عارية. الدرجة **مجموع إشاراتٍ لكلٍّ منها اسمٌ ووزنٌ
 * وسببٌ مكتوب** — كما في مختبر التطوّر: رقمٌ بلا سجلٍّ تحته ليس رقمًا.
 */

import { normalize, editDistance, tokenize } from '../../utils/normalization.js';

/* ------------------------------------------------------------------ *
 * الإشارات
 * ------------------------------------------------------------------ */

/** أسماء الإشارات — المفاتيح التي يذكرها كل ملفّ سياسة. */
export const SIGNAL = Object.freeze({
  SAME: 'same',
  ALIAS: 'alias',
  TYPO: 'typo',
  PART: 'part',
  WORDS: 'words',
  CONTEXT: 'context',
  SHARED: 'shared',
});

/** الحكم — أربع درجاتٍ لا نسبة مئويّة. */
export const VERDICT = Object.freeze({
  CERTAIN: 'certain',
  LIKELY: 'likely',
  MAYBE: 'maybe',
  NONE: 'none',
});

export const VERDICT_META = Object.freeze({
  [VERDICT.CERTAIN]: {
    label: 'هو هو',
    hint: 'الاسم واحدٌ بعد التطبيع — ومع ذلك الدمج قرارك أنت',
    rank: 3,
  },
  [VERDICT.LIKELY]: { label: 'أغلب الظنّ', hint: 'إشاراتٌ قويّة أكثر من واحدة', rank: 2 },
  [VERDICT.MAYBE]: { label: 'يمكن', hint: 'إشارةٌ واحدة — انظر بنفسك', rank: 1 },
  [VERDICT.NONE]: { label: 'لأ', hint: 'مفيش إشارة', rank: 0 },
});

/**
 * ⚠️ **لماذا لا نسبة مئويّة؟**
 *
 * «٨٧٪ متشابهان» رقمٌ لا يعني شيئًا: ٨٧٪ من ماذا؟ ولا يقبل تحقّقًا.
 * أربع درجاتٍ لكلٍّ منها شرطٌ مكتوب أصدق، وتُقرأ في نصف ثانية.
 */
const LIKELY_AT = 6;
const MAYBE_AT = 2;

/**
 * سجلّ الإشارات.
 *
 * كلٌّ تأخذ موضوعين **مُهيَّأين** (`prepare`) وتعيد `{ weight, why }`
 * أو `null`. إضافة إشارةٍ غدًا = سطرٌ هنا واسمُها في ملفّ سياسة.
 */
const SIGNALS = Object.freeze({
  [SIGNAL.SAME]: {
    id: SIGNAL.SAME,
    label: 'نفس الاسم',
    test(a, b) {
      if (!a.primary || a.primary !== b.primary) return null;
      return { weight: 100, why: 'نفس الاسم بالضبط' };
    },
  },

  [SIGNAL.ALIAS]: {
    id: SIGNAL.ALIAS,
    label: 'اسمٌ تاني',
    test(a, b) {
      if (!a.primary && !b.primary) return null;
      // الاسم الأوّل هو الاسم؛ ما بعده أسماء بديلة — والفرق يُقال.
      const hit = (a.aliases.includes(b.primary) && b.primary)
        || (b.aliases.includes(a.primary) && a.primary);
      if (!hit) return null;
      return { weight: 90, why: 'اسمٌ تاني لنفس الحاجة عندك' };
    },
  },

  [SIGNAL.TYPO]: {
    id: SIGNAL.TYPO,
    label: 'تقاربٌ إملائيّ',
    test(a, b, profile) {
      const limit = profile.typoLimit ?? 2;
      let best = limit + 1;
      for (const one of a.names) {
        for (const two of b.names) {
          if (one === two) continue;
          const distance = editDistance(one, two, limit);
          if (distance < best) best = distance;
        }
      }
      if (best <= limit) {
        return {
          weight: Math.max(1, (limit + 1 - best) * 2),
          distance: best,
          why: `الفرق ${best === 1 ? 'حرف واحد' : `${best} حروف`}`,
        };
      }

      /*
       * ⚠️ وعلى مستوى الكلمة حين يطلب الملفُّ ذلك.
       *
       * عنوانان طويلان لا يتقاربان ككلٍّ ولو كانت الغلطة حرفًا واحدًا
       * في كلمةٍ واحدة: «الشادوينج بطيء» و«زرّ الشادوينچ مش شغال»
       * بينهما مسافةٌ كبيرة، والكلمةُ الفارقة حرفٌ واحد. فمَن يقارن
       * عناوين يحتاج الاثنين.
       */
      if (!profile.typoTokens) return null;
      for (const one of a.tokens) {
        for (const two of b.tokens) {
          if (one === two || one.length < 3 || two.length < 3) continue;
          if (editDistance(one, two, limit) <= limit) {
            return { weight: 1, why: 'كلمةٌ قريبة إملائيًّا' };
          }
        }
      }
      return null;
    },
  },

  [SIGNAL.PART]: {
    id: SIGNAL.PART,
    label: 'جزءٌ من',
    test(a, b) {
      for (const one of a.names) {
        for (const two of b.names) {
          if (one === two || !one || !two) continue;
          if (one.includes(two) || two.includes(one)) {
            return { weight: 3, why: 'الاسم ده جزءٌ من التاني' };
          }
        }
      }
      return null;
    },
  },

  [SIGNAL.WORDS]: {
    id: SIGNAL.WORDS,
    label: 'كلماتٌ مشتركة',
    test(a, b) {
      const shared = [...a.tokens].filter((token) => b.tokens.has(token));
      if (!shared.length) return null;
      return {
        weight: Math.min(shared.length * 2, 12),
        shared,
        why: `كلمات مشتركة: ${shared.slice(0, 3).join('، ')}`,
      };
    },
  },

  [SIGNAL.CONTEXT]: {
    id: SIGNAL.CONTEXT,
    label: 'نفس السياق',
    test(a, b, profile) {
      if (!a.context || a.context !== b.context) return null;
      return { weight: 2, why: profile.contextWhy || 'في نفس المكان' };
    },
  },

  /**
   * وسومٌ مشتركة — وهي **أقوى إشارةٍ في الذكريات**.
   *
   * كلمتان مشتركتان بين ذكريتين قد تكونان مصادفة. أمّا أن يكون فيهما
   * **نفس الشخص** أو أن تكونا في **نفس القصّة** فليس مصادفة: تلك
   * روابطُ أنشأتَها أنت بيدك — ولذلك تزن ٥ مقابل ٢ للكلمة:
   * شخصٌ مشترك واحدٌ أثقل من كلمتين مشتركتين في عنوان.
   *
   * والوسم `"person:P12"` لا `"إيجور"`: المعرّف لا يلتبس، والاسم
   * المعروض يجيء من `tagLabels`.
   */
  [SIGNAL.SHARED]: {
    id: SIGNAL.SHARED,
    label: 'روابط مشتركة',
    test(a, b) {
      const shared = [...a.tags].filter((tag) => b.tags.has(tag));
      if (!shared.length) return null;
      const names = shared.map((tag) => a.tagLabels[tag] || b.tagLabels[tag] || tag);
      return {
        weight: Math.min(shared.length * 5, 15),
        shared,
        why: `مشترك: ${names.slice(0, 3).join('، ')}`,
      };
    },
  },
});

/** كل الإشارات المعروفة — للشاشات والاختبارات. */
export const ALL_SIGNALS = Object.freeze(
  Object.values(SIGNALS).map(({ id, label }) => ({ id, label }))
);

/* ------------------------------------------------------------------ *
 * ملفّات السياسة
 * ------------------------------------------------------------------ */

/**
 * ملفُّ سياسةٍ يقول أربعة أشياء: **ما يُحتسَب** (`use`)، و**ما يَنقض**
 * (`reject`)، و**ما لا يُحتسَب ولماذا** (`ignored`)، و**بأي حدّ**.
 *
 * ⚠️ و`ignored` ليس زينة: هو المكان الذي كان فيه الاختلافُ بين الثلاثة
 *    ضمنيًّا. واختبارٌ يسقط إن استُبعدت إشارةٌ بلا سبب مكتوب.
 *
 * ⚠️ والفرق بين `reject` و`ignored` هو جوهر التوحيد:
 *
 * | «فحص» و«فحص سريع» | الاستيراد | الأنواع |
 * |---|---|---|
 * | `PART` | في `use` — سببٌ يُعرَض | في `reject` — **ينقض الزوج كلّه** |
 *
 * فليست إشارةً مهملةً في أحدهما ومحسوبةً في الآخر، بل **إشارةً معناها
 * معكوس**: في الأنواع وجودُها دليلُ تفريعٍ لا تكرار.
 */
export const PROFILES = Object.freeze({
  /** مطابقة الأسماء عند الاستيراد — أشخاص وأنواع وخيوط. */
  names: {
    id: 'names',
    label: 'أسماء',
    use: [SIGNAL.SAME, SIGNAL.ALIAS, SIGNAL.TYPO, SIGNAL.PART],
    typoLimit: 2,
    why: { [SIGNAL.PART]: 'الاسم ده جزءٌ من اسمٍ عندك' },
    ignored: {
      [SIGNAL.WORDS]: 'الأسماء كلمةٌ أو كلمتان — و«محمد» مشتركةٌ بين نصف الناس',
      [SIGNAL.CONTEXT]: 'الأسماء تُطابَق عبر الحزم، ولا سياق مشترك يُعتمد عليه',
      [SIGNAL.SHARED]: 'الشخص لا يحمل وسومًا — روابطه هي مشاهده، وهي كثيرةٌ ومشتركةٌ بطبعها',
    },
    note: 'الاحتواء سببٌ **يُعرَض**: «أحمد» و«أحمد صلاح» تخصيصٌ يحتاج قرارك، وهو أجدر بالعرض من فرق حرفين.',
  },

  /** الأنواع المكرّرة — بند ١١. */
  labels: {
    id: 'labels',
    label: 'أسماء الأنواع',
    use: [SIGNAL.SAME, SIGNAL.ALIAS, SIGNAL.TYPO],
    reject: {
      [SIGNAL.PART]: 'كلمةٌ داخل أخرى («فحص» و«فحص سريع») تفريعٌ لا تكرار — والاقتراح الصحيح «انقله تحته» لا «ادمجهما»',
    },
    typoLimit: 2,
    ignored: {
      [SIGNAL.WORDS]: 'اسمُ النوع كلمةٌ أو كلمتان، فالكلمة المشتركة تعني الاحتواء — وقد نُقض',
      [SIGNAL.CONTEXT]: 'الأب شرطُ قبولٍ لا إشارةَ ترجيح: نوعان تحت أبوين مختلفين لا يُقارَنان أصلًا',
      [SIGNAL.SHARED]: 'النوع كيانٌ بلا روابط يحملها — أبوه شرطُ قبولٍ لا وسمًا يُقارَن',
    },
  },

  /** عناوين ملاحظات التطوير — مختبر التطوّر. */
  titles: {
    id: 'titles',
    label: 'عناوين',
    use: [SIGNAL.SAME, SIGNAL.WORDS, SIGNAL.TYPO, SIGNAL.CONTEXT],
    typoLimit: 2,
    // العنوان جملةٌ لا اسم — فالتقارب يُقاس على الكلمة أيضًا.
    typoTokens: true,
    contextWhy: 'على نفس الشاشة',
    ignored: {
      [SIGNAL.PART]: 'عنوانٌ داخل عنوانٍ أطول شائعٌ في الملاحظات ولا يعني تكرارًا',
      [SIGNAL.ALIAS]: 'الملاحظة عنوانٌ واحدٌ لا كيانٌ له أسماء — ولا حقلَ بديلٍ في نموذجها',
      [SIGNAL.SHARED]: 'الشاشة هي الوسم الوحيد للملاحظة، وهي محسوبةٌ في `CONTEXT`',
    },
  },

  /** نصوصٌ طويلة — الذكريات والتعبيرات (K). */
  texts: {
    id: 'texts',
    label: 'نصوص',
    use: [SIGNAL.SHARED, SIGNAL.WORDS, SIGNAL.CONTEXT],
    contextWhy: 'نفس النوع',
    ignored: {
      [SIGNAL.SAME]: 'ذكريتان بنفس العنوان بالضبط ليستا واحدة — «مكالمة مع إيجور» تتكرّر كل أسبوع',
      [SIGNAL.TYPO]: 'مسافة التحرير على فقرةٍ كاملة كلفتُها طول×طول ومعناها صفر',
      [SIGNAL.PART]: 'احتواء نصٍّ لنصّ نادرٌ وغير دالّ',
      [SIGNAL.ALIAS]: 'النصّ ليس كيانًا مسمّى — لا أسماء بديلة له في أي مستودع',
    },
  },
});

/* ------------------------------------------------------------------ *
 * التهيئة والمقارنة
 * ------------------------------------------------------------------ */

/**
 * يحوّل موضوعًا خامًا إلى صورةٍ مقارَنة.
 *
 * @param {{names?: string[], text?: string, context?: string}} raw
 */
export function prepare(raw = {}) {
  const names = (raw.names || []).map((name) => normalize(name || '')).filter(Boolean);
  const text = raw.text ? normalize(raw.text) : '';
  return {
    primary: names[0] || '',
    names,
    aliases: names.slice(1),
    text,
    tokens: new Set(tokenize([...(raw.names || []), raw.text || ''].filter(Boolean).join(' '))),
    context: raw.context || '',
    tags: new Set(raw.tags || []),
    tagLabels: raw.tagLabels || {},
  };
}

function verdictOf(score, signals) {
  if (signals.some((s) => s.id === SIGNAL.SAME || s.id === SIGNAL.ALIAS)) return VERDICT.CERTAIN;
  if (score >= LIKELY_AT) return VERDICT.LIKELY;
  if (score >= MAYBE_AT) return VERDICT.MAYBE;
  return VERDICT.NONE;
}

/**
 * يقارن موضوعين بملفّ سياسةٍ مسمّى.
 *
 * @returns {{score:number, verdict:string, signals:object[], why:string[]}}
 */
export function compare(rawA, rawB, profileId = 'names') {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`ملفّ تشابهٍ مش معروف: ${profileId}`);

  const a = rawA?.tokens instanceof Set ? rawA : prepare(rawA);
  const b = rawB?.tokens instanceof Set ? rawB : prepare(rawB);

  /*
   * ⚠️ النقض **قبل** الحساب: إشارةٌ ناقضة تُنهي المقارنة، ولا تُطرَح
   *    من درجةٍ فتترك الزوج معلَّقًا بدرجةٍ منخفضة. والسبب يُعاد كي
   *    يُقرأ في الشاشة، لا كي يُبتلَع صامتًا.
   */
  for (const [id, why] of Object.entries(profile.reject || {})) {
    if (SIGNALS[id].test(a, b, profile)) {
      return { score: 0, verdict: VERDICT.NONE, signals: [], why: [], rejected: { id, why } };
    }
  }

  const signals = [];
  let score = 0;
  for (const id of profile.use) {
    const hit = SIGNALS[id].test(a, b, profile);
    if (!hit) continue;
    const why = profile.why?.[id] || hit.why;
    signals.push({ id, label: SIGNALS[id].label, why, weight: hit.weight, distance: hit.distance });
    score += hit.weight;
  }

  return {
    score,
    verdict: verdictOf(score, signals),
    signals,
    why: signals.map((s) => s.why),
    rejected: null,
  };
}

/**
 * يرتّب مرشَّحين حول هدفٍ واحد.
 *
 * ⚠️ **الترتيب حتميّ**: عند تساوي الدرجة نفصل بالمعرّف. ترتيبٌ يعتمد
 *    على ترتيب المدخلات يمرّ في الاختبار مرّةً ويسقط مرّة — وقد وقع
 *    ذلك فعلًا في `mistakePatterns` وكلّفنا ساعة.
 *
 * @param {object} target الموضوع الخام
 * @param {object[]} items الصفوف كما هي
 * @param {object} options
 * @param {string} options.profile اسم ملفّ السياسة
 * @param {(item:object)=>object} options.shape يحوّل الصفّ إلى موضوع
 * @param {string} [options.min] أدنى حكمٍ يُقبل
 * @param {number} [options.limit]
 * @param {(item:object)=>string} [options.idOf]
 */
export function rank(target, items, {
  profile,
  shape,
  min = VERDICT.MAYBE,
  limit = 6,
  idOf = (item) => item?.id || '',
  tie = null,
} = {}) {
  const floor = VERDICT_META[min].rank;
  const base = prepare(shape(target));
  const targetId = idOf(target);

  const out = [];
  for (const item of items) {
    if (idOf(item) === targetId) continue;
    const result = compare(base, prepare(shape(item)), profile);
    if (VERDICT_META[result.verdict].rank < floor) continue;
    out.push({ item, ...result });
  }

  out.sort((x, y) =>
    VERDICT_META[y.verdict].rank - VERDICT_META[x.verdict].rank
    || y.score - x.score
    || (tie ? tie(x.item, y.item) : 0)
    || String(idOf(x.item)).localeCompare(String(idOf(y.item))));

  return limit ? out.slice(0, limit) : out;
}

/**
 * يبحث عن أزواجٍ متشابهة **داخل** مجموعةٍ واحدة (G1).
 *
 * ⚠️ كل زوجٍ مرّةً واحدة: `j = i + 1`. زوجٌ يظهر مرّتين مقلوبًا يجعل
 *    عدّاد «فيه ١٢ تكرار» ضِعف الحقيقة.
 *
 * @param {object[]} items
 * @param {object} options نفس خيارات `rank` مع `pairFilter` اختياري
 */
export function pairs(items, {
  profile,
  shape,
  min = VERDICT.MAYBE,
  idOf = (item) => item?.id || '',
  accept = null,
} = {}) {
  const floor = VERDICT_META[min].rank;
  const prepared = items.map((item) => ({ item, subject: prepare(shape(item)) }));

  const found = [];
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i];
      const b = prepared[j];
      if (accept && !accept(a.item, b.item)) continue;
      const result = compare(a.subject, b.subject, profile);
      if (VERDICT_META[result.verdict].rank < floor) continue;
      found.push({ a: a.item, b: b.item, ...result });
    }
  }

  found.sort((x, y) =>
    VERDICT_META[y.verdict].rank - VERDICT_META[x.verdict].rank
    || y.score - x.score
    || String(idOf(x.a)).localeCompare(String(idOf(y.a))));

  return found;
}

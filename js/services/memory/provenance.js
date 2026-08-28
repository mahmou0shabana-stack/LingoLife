/**
 * LingoLife — منشأُ النصّ ونسبُه (WS-J · بنود ٢ و٣)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الفرقُ الحاكم: نصٌّ حدث، ونصٌّ صُنع من نصٍّ حدث**
 * ═══════════════════════════════════════════════════════════════
 *
 * ثلاثةُ نصوصٍ قد تحمل كلمةَ «документы»:
 *
 *   RAW_001        «Документы необходимо предоставить.»
 *   AI_IMPROVED    نسخةٌ صحّحها التحليل
 *   SHADOWING      نصُّ تدريبٍ مولَّدٌ منها
 *
 * والكلمةُ فيها ثلاثًا. لكنّ **الموقفَ الحقيقيَّ واحد** — لأن الاثنين
 * الأخيرين وُلدا من الأوّل ولم يقعا في حياتك.
 *
 * فلو جمعناها «٣ ظهورات حقيقيّة» لَكذبنا على المستخدم في الرقم الوحيد
 * الذي جاء يسأل عنه: **كم مرّةً قابلتُ هذه الكلمةَ فعلًا؟**
 *
 * ولذلك يفصل هذا الملفّ صنفَ الدليل عن نوع المنشأ:
 *
 *   `evidenceClass`  هل هذا دليلٌ على ما حدث؟   (أصليّ / مولَّد / غير محدَّد)
 *   `originType`     كيف وُجد بالضبط؟            (تفريغ · نصُّك · تحسينُ ذكاء…)
 *
 * والأوّلُ هو الذي يحكم العدّ. والثاني وصفٌ يُقرأ ويُصفَّى به.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **و«غير محدَّد» صنفٌ ثالثٌ حقيقيّ — لا حالةٌ مؤقّتة**
 * ═══════════════════════════════════════════════════════════════
 *
 * التطبيقُ لم يسجّل يومًا هل كتبتَ سكريبتًا بيدك أم ولّدَه تحليل. فكلُّ
 * ما في قاعدتك اليومَ **مجهولُ المنشأ بحكم التاريخ**.
 *
 * والخياران المغريان كلاهما كذب:
 *   · «افترضها أصليّة» يضخّم مواقفَك الحقيقيّة بكلّ نصٍّ مولَّدٍ عندك؛
 *   · «استنتجها من نوع السكريبت» تخمينٌ يلبس ثوبَ البيانات — فـ`formal`
 *     يصف **الصيغة** لا المنشأ، وقد تكون كتبتَها بنفسك.
 *
 * فالمجهولُ يبقى مجهولًا، **ويُستثنى من عدّ المواقف الحقيقيّة** حتى
 * تصنّفه بنفسك. رقمٌ ناقصٌ صادقٌ خيرٌ من رقمٍ كاملٍ مخترَع.
 */

/** صنفُ الدليل — وهو وحدَه ما يحكم عدّ المواقف الحقيقيّة. */
export const EVIDENCE = Object.freeze({
  /** وقع في حياتك: تفريغٌ حقيقيّ، نصٌّ كتبتَه، محادثةٌ جرت. */
  PRIMARY: 'primary',
  /** صُنع من نصٍّ آخر: تحسينٌ، تصحيحٌ، مادّةُ تدريبٍ مولَّدة. */
  DERIVED: 'derived',
  /** لم يُصنَّف بعد — ولا يُخمَّن (راجع ترويسة الملفّ). */
  UNKNOWN: 'unknown',
});

/** كيف وُجد النصُّ بالضبط — قابلٌ للتوسيع بلا كسرِ صفٍّ قديم. */
export const ORIGIN = Object.freeze({
  RAW_TRANSCRIPT: 'raw_transcript',
  AUTHENTIC_USER_TEXT: 'authentic_user_text',
  AI_IMPROVED: 'ai_improved',
  AI_CORRECTED: 'ai_corrected',
  AI_SHADOWING: 'ai_shadowing',
  AI_PRACTICE: 'ai_practice',
  AI_DIALOGUE: 'ai_generated_dialogue',
  OTHER: 'other',
  UNKNOWN: 'unknown',
});

/** نصٌّ عربيٌّ للمستخدم — بلا مصطلحاتٍ تقنيّة (بند ٣٨). */
export const EVIDENCE_LABEL = Object.freeze({
  [EVIDENCE.PRIMARY]: 'محتوى أصلي',
  [EVIDENCE.DERIVED]: 'محتوى مولَّد',
  [EVIDENCE.UNKNOWN]: 'غير محدَّد',
});

export const ORIGIN_LABEL = Object.freeze({
  [ORIGIN.RAW_TRANSCRIPT]: 'تفريغ موقف حقيقي',
  [ORIGIN.AUTHENTIC_USER_TEXT]: 'نصّ كتبتَه بنفسك',
  [ORIGIN.AI_IMPROVED]: 'نسخة محسَّنة',
  [ORIGIN.AI_CORRECTED]: 'نسخة مصحَّحة',
  [ORIGIN.AI_SHADOWING]: 'نصّ تدريب مولَّد',
  [ORIGIN.AI_PRACTICE]: 'مادّة تمرين مولَّدة',
  [ORIGIN.AI_DIALOGUE]: 'حوار مولَّد',
  [ORIGIN.OTHER]: 'غير ذلك',
  [ORIGIN.UNKNOWN]: 'غير معروف',
});

/**
 * الصنفُ الذي يقترحه نوعُ المنشأ — **اقتراحٌ للواجهة لا حكمٌ تلقائيّ**.
 *
 * ⚠️ ويُستعمَل حين **تختار أنت** نوعَ المنشأ، فيملأ الصنفَ معه بدل أن
 *    تختار مرّتين. ولا يُنادى أبدًا على صفٍّ قديمٍ لم تصنّفه.
 */
export function classOfOrigin(originType) {
  switch (originType) {
    case ORIGIN.RAW_TRANSCRIPT:
    case ORIGIN.AUTHENTIC_USER_TEXT:
      return EVIDENCE.PRIMARY;
    case ORIGIN.AI_IMPROVED:
    case ORIGIN.AI_CORRECTED:
    case ORIGIN.AI_SHADOWING:
    case ORIGIN.AI_PRACTICE:
    case ORIGIN.AI_DIALOGUE:
      return EVIDENCE.DERIVED;
    default:
      return EVIDENCE.UNKNOWN;
  }
}

/**
 * جذورُ الدليل الأصليّ لمصدرٍ ما — بصعودِ سلسلة الاشتقاق كلِّها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والنسبُ يصمد لأجيال** (بند ٣)
 * ═══════════════════════════════════════════════════════════════
 *
 *   RAW_001
 *     ├── نسخةٌ محسَّنة
 *     │     └── نصُّ تدريبٍ مولَّدٌ **من المحسَّنة**
 *     └── حوارٌ مولَّد
 *
 * فنصُّ التدريب حفيدٌ لا ابن، وجذرُه ما زال `RAW_001`. ولو اكتفينا
 * بأبٍ واحدٍ لَانقطع النسبُ عند الجيل الثاني وصار الحفيدُ «موقفًا
 * حقيقيًّا» جديدًا.
 *
 * ⚠️ **وحلقةٌ في النسب لا تُعلِّق البحث.** ملفٌّ تالفٌ أو تحريرٌ يدويٌّ قد
 *    يجعل أ ابنَ ب وب ابنَ أ. فالمزارُ يُتتبَّع، والدخولُ مرّتين توقّف.
 *
 * @param {string} key مفتاحُ المصدر (`script:ID`)
 * @param {Map<string, {evidenceClass, derivedFrom}>} index كلُّ المصادر بمفاتيحها
 * @returns {{roots: string[], depth: number, cyclic: boolean}}
 */
export function rootsOf(key, index) {
  const seen = new Set();
  const roots = new Set();
  let cyclic = false;
  let depth = 0;

  const walk = (at, level) => {
    if (!at) return;
    if (seen.has(at)) { cyclic = true; return; }
    seen.add(at);
    depth = Math.max(depth, level);

    const row = index.get(at);
    if (!row) {
      /*
       * ⚠️ **وأبٌ مفقودٌ ليس جذرًا.** لو عدّدناه جذرًا لَحُسب موقفًا
       *    حقيقيًّا لا نملك نصَّه أصلًا. فيُهمَل، والحفيدُ يبقى بلا
       *    جذرٍ حتى يعود أبوه أو تصنّفه بنفسك.
       */
      return;
    }

    const parents = Array.isArray(row.derivedFrom) ? row.derivedFrom.filter(Boolean) : [];

    if (row.evidenceClass === EVIDENCE.PRIMARY) {
      roots.add(at);
      /*
       * ⚠️ **ونقف عند أوّل أصليّ.** نصٌّ أصليٌّ قد يُسجَّل له أبٌ (نُسخ
       *    من محادثةٍ مثلًا) — وهو مع ذلك دليلٌ على ما حدث بذاته.
       *    فالصعودُ فوقه يجعل موقفَين موقفًا واحدًا.
       */
      return;
    }

    if (!parents.length) return;
    for (const parent of parents) walk(parent, level + 1);
  };

  walk(key, 0);
  return { roots: [...roots], depth, cyclic };
}

/**
 * يفصل ظهوراتٍ إلى: خام · مواقفُ حقيقيّة · ظهوراتٌ مولَّدة (بند ٢).
 *
 * ⚠️ **والثلاثةُ لا تُجمَع في رقمٍ واحدٍ أبدًا.** «٣٤ ظهورًا حقيقيًّا»
 *    جملةٌ ممنوعةٌ بالبند نصًّا حين يكون فيها مولَّد.
 *
 * @param {{sourceKey: string}[]} occurrences مواضعُ الظهور
 * @param {Map<string, object>} index سجلُّ المصادر
 */
export function splitOccurrences(occurrences = [], index = new Map()) {
  const situations = new Set();
  let raw = 0;
  let derived = 0;
  let unknown = 0;

  for (const one of occurrences) {
    const row = index.get(one.sourceKey);
    const evidence = row?.evidenceClass || EVIDENCE.UNKNOWN;

    if (evidence === EVIDENCE.PRIMARY) {
      raw += 1;
      situations.add(one.sourceKey);
      continue;
    }
    if (evidence === EVIDENCE.DERIVED) {
      derived += 1;
      /*
       * ⚠️ **والمولَّدُ لا يزيد المواقفَ ولو كان جذرُه غيرَ مذكورٍ بعد.**
       *    جذرُه إن وُجد سيُحسَب من ظهوره هو في نصّه الأصليّ. وإضافتُه
       *    هنا تعني عدَّ نفس الموقف مرّتين من بابين.
       */
      continue;
    }
    /* غيرُ المحدَّد لا يُحسَب أصليًّا ولا مولَّدًا — يُعَدّ ويُقال. */
    unknown += 1;
  }

  return {
    rawOccurrences: raw,
    realSituations: situations.size,
    derivedAppearances: derived,
    unknownOccurrences: unknown,
    situationKeys: [...situations],
  };
}

/**
 * بصمةُ محتوًى مستقرّة — أساسُ «هل تغيّر هذا النصّ؟» (بند ٩).
 *
 * ⚠️ **وتُحسَب على النصّ المُطبَّع سطريًّا لا على الصفّ كلِّه.** لو دخل
 *    `updatedAt` في البصمة لَتغيّرت مع كلّ لمسةٍ للصفّ ولَطلب النظامُ
 *    إعادةَ تحليلٍ لنصٍّ لم يتبدّل فيه حرف.
 */
export async function hashText(text) {
  const normal = String(text ?? '').replace(/\r\n/g, '\n').trim();
  const bytes = new TextEncoder().encode(normal);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * LingoLife — طبقةُ المصدر الفعّال وذاكرتُه (WS-E، بنود ٣ و٧ و٨ و١٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا ملفٌّ مستقلٌّ لهذا
 * ═══════════════════════════════════════════════════════════════
 *
 * `shadow-view.js` ثمانيةُ آلاف سطرٍ من الرسم واللمس والصوت. وقواعدُ
 * «أيُّ مصدرٍ فعّالٌ الآن» و«ما الذي يُستعاد حين أعود إليه» قواعدُ
 * **حسابٍ خالص**: تأخذ حالةً وتردّ حالة، ولا تلمس DOM ولا صوتًا.
 *
 * فخرجت هنا لتُختبَر بلا متصفّح — وهذا هو الفرقُ بين «الانتقالُ يبدو
 * أنعم» و«الانتقالُ صحيح».
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ طبقتان لا طبقةٌ واحدة (بند ٣)
 * ═══════════════════════════════════════════════════════════════
 *
 * **المصدر** (أصل · مسودّة · مؤقّت) شيء، و**المقطع** داخله شيءٌ آخر،
 * و**النطاق** (كلمة · مقطع · جملة) ثالث، و**المنبع** (مصدر · قواعد ·
 * ملفّ · صور) رابع. وتبديلُ إحداها لا يُصفّر الأخرى.
 *
 * وكان الخلطُ بينها هو العطبَ الذي أصلحته WS-A في المفتاح؛ وهذا
 * الملفُّ يمنع عودتَه من بابٍ آخر: **المصدرُ يُعرَف من المقطع نفسِه**
 * لا من متغيّرٍ يُكتَب بيدٍ في مكانين.
 */

/** الأنواعُ الثلاثةُ للمصدر الفعّال — ولا رابعَ اليوم. */
export const SOURCE_KIND = Object.freeze({
  ORIGINAL: 'original',
  DRAFT: 'draft',
  EXTERNAL: 'external',
});

/** اسمُ كلِّ نوعٍ كما يُعرَض — قصيرٌ لأنه شارةٌ لا جملة (بند ٤٣). */
export const KIND_LABEL = Object.freeze({
  [SOURCE_KIND.ORIGINAL]: 'الأصل',
  [SOURCE_KIND.DRAFT]: 'المسودّة',
  [SOURCE_KIND.EXTERNAL]: 'نصّ مؤقّت',
});

/**
 * نوعُ المصدر الذي ينتمي إليه هذا المقطع.
 *
 * ⚠️ **يُقرأ من المقطع لا من متغيّرِ حالة.** لو كان «أيُّ مصدرٍ فعّال»
 *    متغيّرًا منفصلًا لَأمكن أن يفترق عن الواقع: يُسقَط المصدرُ ويبقى
 *    المتغيّرُ يقول إنه هناك. أمّا المقطعُ الفعّالُ فهو الحقيقةُ نفسُها
 *    (WS-A)، فسؤالُه لا يكذب.
 */
export function kindOf(segment) {
  if (!segment) return SOURCE_KIND.ORIGINAL;
  if (segment.draftId) return SOURCE_KIND.DRAFT;
  if (segment.temporary) return SOURCE_KIND.EXTERNAL;
  return SOURCE_KIND.ORIGINAL;
}

/**
 * مفتاحُ الذاكرة لهذا المقطع.
 *
 * ⚠️ **ومسودّتان مختلفتان مفتاحان** — وإلّا ورثت الثانيةُ موضعَ الأولى.
 *    والأصلُ مفتاحٌ واحدٌ لأنه واحد.
 */
export function sourceKeyOf(segment) {
  const kind = kindOf(segment);
  if (kind === SOURCE_KIND.DRAFT) return `draft:${segment.draftId}`;
  if (kind === SOURCE_KIND.EXTERNAL) return `external:${segment.sourceId || 'ext'}`;
  return SOURCE_KIND.ORIGINAL;
}

/**
 * مدى المصدر المُركَّب (مسودّة أو مؤقّت) في قائمة المقاطع.
 *
 * ⚠️ **واحدٌ في كلّ لحظة، وفي آخر القائمة، ومتّصل** — تمامًا كما وضعت
 *    WS-A النصَّ المؤقّت. والمسودّةُ تدخل من نفس الباب فترث نفسَ
 *    الضمانة: `setSourceWindow` تحصر التنقّل فيه، و«الرجوع للأصل»
 *    وحدَه يرفع الحصر (بندا ٢٦ و٦٠).
 *
 * @returns {{from: number, to: number, kind: string, key: string}|null}
 */
export function overlayRangeIn(segments) {
  const list = segments || [];
  const at = list.findIndex((one) => kindOf(one) !== SOURCE_KIND.ORIGINAL);
  if (at < 0) return null;
  return {
    from: at,
    to: list.length - 1,
    kind: kindOf(list[at]),
    key: sourceKeyOf(list[at]),
  };
}

/**
 * يلتقط ما يستحقّ أن يُستعاد من مصدرٍ تغادره (بند ٧).
 *
 * ⚠️ **ومعرِّفُ المقطع مع رقمه — والمعرِّفُ هو الأصدق** (بند ١٩).
 *    الأرقامُ تنزاح: مسودّةٌ حُذف منها سطرٌ تجعل «٧» جملةً أخرى. أمّا
 *    المعرِّفُ فيدلّ على ما كنتَ عليه أو لا يدلّ على شيء — ولا يكذب.
 */
export function captureState({
  index = 0, segmentId = null, practiceMode = 'sentence',
  word = -1, phrase = null, display = null, scroll = 0, wellTab = null,
} = {}) {
  return {
    index,
    segmentId,
    practiceMode,
    word,
    /* المدى يُنسَخ لا يُشار إليه — الأصلُ يتبدّل تحت يدك. */
    phrase: phrase && phrase.from >= 0 && phrase.to >= phrase.from
      ? { from: phrase.from, to: phrase.to, segmentId: phrase.segmentId || segmentId }
      : null,
    display,
    scroll,
    wellTab,
  };
}

/**
 * يحوّل لقطةً محفوظةً إلى **خطّةِ استعادةٍ صالحةٍ الآن** (بند ٨).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والاستعادةُ تُصفَّى قبل أن تُنفَّذ — ولا تُقصَّ إلى أقرب موجود
 * ═══════════════════════════════════════════════════════════════
 *
 * البندُ صريح: «لا تستعد اختيارًا غيرَ صالح، ولا تُقصّه بصمتٍ إلى
 * كلمةٍ لا علاقة لها». والفرقُ عمليّ: مسودّةٌ كانت كلمتُك فيها رقم ٩،
 * ثم عدّلتَها فصارت الجملةُ أربعَ كلمات. القصُّ يعطيك الكلمةَ الرابعة
 * — وهي ليست كلمتَك، والتطبيقُ يدّعي أنه تذكّر. والصوابُ أن يقول
 * «لا كلمةَ محفوظة» ويعود إلى نطاق الجملة.
 *
 * @param {object|null} snap اللقطة المحفوظة
 * @param {{segments: object[], wordCount: number, from?: number, to?: number}} now
 * @returns {{index: number, practiceMode: string, word: number,
 *            phrase: {from: number, to: number}|null, display: string|null,
 *            scroll: number, wellTab: string|null, dropped: string[]}}
 */
export function planRestore(snap, now) {
  const segments = now?.segments || [];
  const from = Number.isInteger(now?.from) ? now.from : 0;
  const to = Number.isInteger(now?.to) ? now.to : Math.max(from, segments.length - 1);
  const dropped = [];

  if (!snap) {
    return {
      index: from, practiceMode: 'sentence', word: -1, phrase: null,
      display: null, scroll: 0, wellTab: null, dropped: ['no-snapshot'],
    };
  }

  /*
   * ⚠️ **المعرِّفُ أوّلًا ثم الرقم** (بند ١٩). ولو ضاع الاثنان وقعنا
   *    على أوّل مقطعٍ في المصدر — لا على مقطعٍ من مصدرٍ آخر.
   */
  let index = -1;
  if (snap.segmentId) {
    const at = segments.findIndex((one) => one?.id === snap.segmentId);
    if (at >= from && at <= to) index = at;
  }
  if (index < 0 && Number.isInteger(snap.index) && snap.index >= from && snap.index <= to) {
    index = snap.index;
    if (snap.segmentId) dropped.push('segment-id');
  }
  if (index < 0) {
    index = from;
    dropped.push('index');
  }

  /* الكلمةُ صالحةٌ فقط إن كنّا على نفس المقطع وكان الرقمُ موجودًا فيه. */
  const sameSegment = !snap.segmentId || segments[index]?.id === snap.segmentId;
  const words = Number.isInteger(now?.wordCount) ? now.wordCount : 0;
  let word = -1;
  if (sameSegment && Number.isInteger(snap.word) && snap.word >= 0 && snap.word < words) {
    word = snap.word;
  } else if (snap.word >= 0) {
    dropped.push('word');
  }

  /* والمدى مثلُها — ورقماه معًا لا أحدُهما. */
  let phrase = null;
  if (snap.phrase && sameSegment
    && snap.phrase.from >= 0 && snap.phrase.to < words
    && snap.phrase.to >= snap.phrase.from) {
    phrase = { from: snap.phrase.from, to: snap.phrase.to };
  } else if (snap.phrase) {
    dropped.push('phrase');
  }

  /*
   * ⚠️ **ونطاقُ «كلمة» لا يُستعاد بلا كلمةٍ صالحة**، و«مقطع» لا
   *    يُستعاد بلا مدًى — وإلّا فتحتَ وضعًا فارغًا لا تعرف لماذا فُتح.
   */
  let practiceMode = snap.practiceMode || 'sentence';
  if (practiceMode === 'phrase' && !phrase) { practiceMode = 'sentence'; dropped.push('phrase-mode'); }

  return {
    index,
    practiceMode,
    word,
    phrase,
    display: snap.display ?? null,
    scroll: Number.isFinite(snap.scroll) ? snap.scroll : 0,
    wellTab: snap.wellTab ?? null,
    dropped,
  };
}

/**
 * ذاكرةُ المصادر — خريطةٌ في الذاكرة لا في القاعدة (بندا ٥٧ و٥٨).
 *
 * ⚠️ **ولا تُكتَب في IndexedDB**: «كنتَ نازلًا ٣٤٠ بكسل وماسكًا الكلمة
 *    الثالثة» حالةُ جلسةٍ لا وعدٌ يعبر الأيام. وكتابتُها تعني قرصًا
 *    يعمل مع كلّ لمسة. والوعودُ التي تعبر (تبويبُ المنبع، صفحةُ
 *    الملفّ) محفوظةٌ أصلًا في مكانها من WS-B.
 */
export function createSourceMemory() {
  const store = new Map();
  return {
    save(key, snap) { if (key) store.set(key, snap); },
    read(key) { return store.get(key) || null; },
    forget(key) { store.delete(key); },
    keys() { return [...store.keys()]; },
    clear() { store.clear(); },
    get size() { return store.size; },
  };
}

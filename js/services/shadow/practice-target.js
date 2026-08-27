/**
 * LingoLife — هدفُ التدريب: مُحلٌّ واحدٌ لا أربعة (WS-I · بنود ٢…٧)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **العطبُ الذي وُجد: للنطاق الواحد مُحلّان، وكلاهما ينطق غيرَه**
 * ═══════════════════════════════════════════════════════════════
 *
 * كان تحديدُ المقطع يعيش في الشاشة (`phrase.from/.to`)، **والمحرّكُ لا
 * يعرف أن نطاقًا اسمه «مقطع» موجودٌ أصلًا**. فكان في `playback-controller`:
 *
 *     function currentText() {
 *       if (practiceMode === WORD) return words[wordIndex].spoken;
 *       return segment.text;            // ← الجملةُ كلُّها
 *     }
 *
 * ووضعُ المقطع كان يضبط المحرّكَ على `SENTENCE`. فينتج طريقان:
 *
 *   ▶ الزرُّ الرئيسيّ  → `segment.text`      → **الجملةُ كلُّها**
 *   «اسمع المقطع»      → `phraseSpoken()`    → المدى **بلا ترقيم**
 *
 * أي أن أوضحَ زرٍّ في الشاشة يتجاهل تحديدَك، والزرَّ الآخرَ يحذف
 * الفواصلَ من نصٍّ تعلّمُه أنت بفواصله.
 *
 * ⚠️ **والمدى نفسُه لم يكن معطوبًا**: `pickPhraseWord` تطبّع بـ
 *    `Math.min/Math.max` منذ WS-A، فالاتّجاهُ المعكوس كان يعمل. العطبُ
 *    في **حلّ النصّ** وفي **حدّ النطق**، لا في حالة التحديد.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا وحدةٌ خالصةٌ بلا DOM ولا قاعدة؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن بند ٢٤ يطلب مساواةً حرفيّةً عند حدّ النطق. ودالّةٌ تقرأ
 * `document.querySelector` لا تُختبَر إلّا بمتصفّحٍ وشاشةٍ مرسومة، فيصير
 * الاختبارُ بطيئًا وهشًّا — ويُغري بالتساهل (`includes`) بدل المساواة.
 *
 * فهنا **مدخلاتٌ ومخرجات**: كلماتٌ ونطاقٌ ورقمان، ونصٌّ واحد.
 */

/** النطاقاتُ الثلاثة — متمايزةٌ عمدًا (بند ٣). */
export const SCOPE = Object.freeze({
  /** كلمةٌ واحدةٌ ممسوكة. */
  WORD: 'word',
  /** الجملةُ الفعّالةُ كاملة. */
  SENTENCE: 'sentence',
  /** مدًى متّصلٌ من الكلمات. */
  PHRASE: 'phrase',
});

/**
 * يطبّع مدًى مهما كان اتّجاهُ الالتقاط (بند ٥).
 *
 * ⚠️ **والاتّجاهُ لا يعكس المنطوق أبدًا**: من الكلمة ٧ إلى ٣ هو نفسُه
 *    من ٣ إلى ٧ — لأن النصَّ يُقرأ بترتيبه لا بترتيب أصابعك.
 *
 * @returns {{from: number, to: number}|null} `null` إن كان المدى خارج الحدّ.
 */
export function normalizeRange(anchor, focus, count) {
  const total = Number.isFinite(count) ? count : 0;
  if (total <= 0) return null;
  if (!Number.isInteger(anchor) || !Number.isInteger(focus)) return null;

  const from = Math.min(anchor, focus);
  const to = Math.max(anchor, focus);
  if (from < 0 || to >= total) return null;
  return { from, to };
}

/**
 * نصُّ مدًى من الكلمات — **كما كُتب**.
 *
 * ⚠️ **`display` لا `spoken`** (بند ٦). `splitWords` تبني الاثنين:
 *
 *     'заполнен,' → { display: 'заполнен,', spoken: 'заполнен' }
 *
 * و`spoken` وُجدت لنطق **كلمةٍ مفردة**، حيث الفاصلةُ الملتصقةُ بها
 * ضجيج. أمّا في مدًى فالفاصلةُ **بنية**: «полностью заполнен, и документ»
 * بلا فاصلةٍ جملةٌ أخرى إيقاعًا. فالمدى يُبنى من `display`.
 *
 * ⚠️ **ولا مسافةَ تُدَسّ قبل علامة.** الوصلُ بمسافةٍ بين الرموز لا يمكن
 *    أن يفعل ذلك: العلامةُ ملتصقةٌ برمزها منذ التقسيم، فلا تصير رمزًا
 *    مستقلًّا يُوصَل.
 */
function joinRange(words, from, to) {
  return words
    .slice(from, to + 1)
    .map((word) => word?.display ?? '')
    .filter((piece) => piece.length > 0)
    .join(' ');
}

/**
 * يحسم هدفَ التدريب الحاليّ — **المرجعُ الوحيد**.
 *
 * @param {object} input
 * @param {{display: string, spoken: string}[]} input.words كلماتُ الجملة الحيّة.
 * @param {string} input.sentence نصُّ الجملة كاملًا كما هو.
 * @param {string} input.scope أحدُ `SCOPE`.
 * @param {number} [input.wordIndex] الكلمةُ الممسوكة — لنطاق الكلمة.
 * @param {number} [input.anchor] مرساةُ المدى.
 * @param {number} [input.focus] طرفُ المدى الآخر.
 * @param {string|null} [input.segmentId] هُويّةُ الجملة — للمفتاح لا للنصّ.
 *
 * @returns {{
 *   scope: string, text: string, from: number|null, to: number|null,
 *   ok: boolean, why?: string
 * }}
 */
export function resolveTarget({
  words = [],
  sentence = '',
  scope = SCOPE.SENTENCE,
  wordIndex = -1,
  anchor = -1,
  focus = -1,
  segmentId = null,
} = {}) {
  const list = Array.isArray(words) ? words : [];

  if (scope === SCOPE.WORD) {
    const word = list[wordIndex];
    if (!word) return fail(SCOPE.WORD, 'مفيش كلمة ممسوكة');
    /*
     * ⚠️ **والكلمةُ وحدَها تُنطَق بلا ترقيمها.** «документ,» بفاصلةٍ
     *    تُنطَق بوقفةٍ لا معنى لها حين تتدرّب على الكلمة نفسِها. وهذا
     *    سلوكُ الكلمة منذ WS42 ولم يُبلَّغ عنه — فيبقى.
     */
    return {
      scope: SCOPE.WORD,
      text: word.spoken || word.display || '',
      from: wordIndex,
      to: wordIndex,
      ok: true,
      key: targetKey({ segmentId, scope: SCOPE.WORD, from: wordIndex, to: wordIndex }),
    };
  }

  if (scope === SCOPE.PHRASE) {
    const range = normalizeRange(anchor, focus, list.length);
    if (!range) return fail(SCOPE.PHRASE, 'مدًى غير صالح');
    const text = joinRange(list, range.from, range.to);
    if (!text) return fail(SCOPE.PHRASE, 'المدى فاضي');
    return {
      scope: SCOPE.PHRASE,
      text,
      from: range.from,
      to: range.to,
      ok: true,
      key: targetKey({ segmentId, scope: SCOPE.PHRASE, from: range.from, to: range.to }),
    };
  }

  /*
   * ⚠️ **والجملةُ تُقرأ من نصّها لا من وصلِ كلماتها.** الوصلُ يطبّع
   *    المسافاتِ المتعدّدة ويسقط ما لا يُعَدّ كلمة، فيعطي نصًّا **شبيهًا**
   *    بالجملة لا الجملةَ نفسَها. وبند ٣ يقول «الجملة كاملة» بالضبط.
   */
  const text = String(sentence || '').trim();
  if (!text) return fail(SCOPE.SENTENCE, 'مفيش جملة فعّالة');
  return {
    scope: SCOPE.SENTENCE,
    text,
    from: null,
    to: null,
    ok: true,
    key: targetKey({ segmentId, scope: SCOPE.SENTENCE }),
  };
}

const fail = (scope, why) => ({ scope, text: '', from: null, to: null, ok: false, why });

/**
 * مفتاحُ الهدف — **من الهُويّة لا من النصّ** (بند ١٢).
 *
 * ⚠️ **ولماذا لا يُطابَق بالنصّ؟** لأن الجملةَ الواحدة قد تتكرّر حرفيًّا
 *    في ذكريين، و«да» قد تكون في عشرين موضعًا. فالنصُّ يجمع ما ليس
 *    واحدًا. أمّا `segmentId` فهو صفُّ `shadowSegments` — هُويّةٌ قائمةٌ
 *    في القاعدة منذ v3، ولها فهرسُها.
 *
 * ⚠️ **والنطاقُ جزءٌ من المفتاح** (بند ١٥): مفتاحُ الجملة غيرُ مفتاح
 *    المقطع داخلها، فلا يختلط سجلّاهما. وهو الفرقُ الذي طلبتَه بالحرف:
 *    «لا تخلط كلَّ تسجيلات الجملة في كلّ مقطعٍ فيها».
 */
export function targetKey({ segmentId, scope, from = null, to = null }) {
  if (!segmentId || !scope) return null;
  if (scope === SCOPE.SENTENCE) return `${segmentId}|${scope}`;
  if (from === null || to === null) return null;
  return `${segmentId}|${scope}|${from}-${to}`;
}

/** وصفٌ عربيٌّ للنطاق — للعرض في سجلّ المحاولات. */
export const SCOPE_LABEL = Object.freeze({
  [SCOPE.WORD]: 'كلمة',
  [SCOPE.SENTENCE]: 'جملة',
  [SCOPE.PHRASE]: 'مقطع',
});

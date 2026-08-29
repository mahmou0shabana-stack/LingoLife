/**
 * LingoLife — التقريبُ للأذن العربيّة (WS-N · §23)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **يُبنى من الصوت لا من الإملاء — والفرقُ ليس تفصيلًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * لو كُتب هذا الملفُّ على الحروف الروسيّة لأعطى `молоко` = «مولوكو»،
 * وهي بالضبط اللكنةُ التي جاء المتعلّمُ ليتخلّص منها: ثلاثُ `о` كاملات
 * حيث لا توجد إلّا واحدة. فالمدخَلُ هنا **مقاطعُ التحليل الصوتيّة**
 * (`sounds` بعد القواعد)، لا نصُّ الكلمة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وهو تقريبٌ مُعلَنٌ — لا نسخٌ صوتيّ**
 * ═══════════════════════════════════════════════════════════════
 *
 * الـIPA هو المرجعُ الرسميّ. وهذا سطرٌ يساعدك تنطق أوّلَ مرّة، ولذلك
 * يحمل وسمَه معه دائمًا: «تقريب للأذن العربية».
 *
 * وثلاثةُ مواقفَ لا رابع:
 *   · **آمن** — لكلّ صوتٍ مقابلٌ عربيٌّ لا يُضلّل.
 *   · **آمنٌ بتحفّظ** — يُكتَب ومعه ملاحظةٌ تقول أين يقصر (الاختزال).
 *   · **يُحجَب** — حين تكون الكتابةُ العربيّةُ ستُعلّم صوتًا **خطأً**
 *     (`ы`)، فالصمتُ خيرٌ من تعليمِ «и» مكانها.
 */

/**
 * السواكن — والحروفُ الثلاثةُ الممدودةُ (`پ ڤ ژ`) مقصودة.
 *
 * ⚠️ **ولماذا `پ` لا `ب`؟** لأن `ب` تُعلِّم صوتًا **آخر** موجودًا في
 *    الروسيّة نفسِها (`б`)، فيختلط عليك `парк` و`барк`. و`پ` غيرُ
 *    عربيّةٍ أصلًا لكنّها مقروءةٌ في مصر (بيتزا · پيتزا)، وتقول لك
 *    صراحةً: «هذا صوتٌ ليس عندنا».
 */
const CONSONANT = Object.freeze({
  b: 'ب', p: 'پ', v: 'ڤ', f: 'ف', 'ɡ': 'ج', k: 'ك', d: 'د', t: 'ت',
  z: 'ز', s: 'س', x: 'خ', m: 'م', n: 'ن', r: 'ر', j: 'ي',
  'ɫ': 'ل', 'lʲ': 'ل',
  'ʐ': 'ژ', 'ʂ': 'ش', ts: 'تس', 'tɕ': 'تش', 'ɕː': 'شّ',
});

/** حروفٌ ليست من العربيّة الفصحى — تُذكَر مرّةً في الملاحظات. */
const EXTENDED = 'پڤژ';

/**
 * الحركاتُ بعد ساكنٍ **صلب**.
 * `null` تعني: لا مقابلَ أمينًا — يُحجَب التقريبُ كلُّه.
 */
const AFTER_HARD = Object.freeze({
  a: 'ا', o: 'و', u: 'و', e: 'يه', i: 'ي',
  'ɐ': 'َ', 'ɪ': 'ِ', 'ə': 'َ',
  'ɨ': null,
});

/**
 * والحركاتُ بعد ساكنٍ **ليّن**.
 *
 * ⚠️ **و`ي` تُضاف قبل الحركات الخلفيّة وحدَها.** `мя` = «ميا» صحيحة،
 *    لكنّ `ме` = «مِيي» تُدخِل صوتًا ليس هناك. فالليونةُ قبل `e`/`i`
 *    محمولةٌ في الحركة نفسِها، وقبل `a`/`o`/`u` تحتاج `ي` صريحة.
 */
const AFTER_SOFT = Object.freeze({
  a: 'يا', o: 'يو', u: 'يو', e: 'ي', i: 'ي',
  'ɐ': 'َ', 'ɪ': 'ِ', 'ə': 'َ',
  'ɨ': null,
});

/** وفي أوّل الكلمة لا ساكنَ تحمله الحركةُ القصيرة — فتُكتَب بحرفٍ. */
const WORD_INITIAL = Object.freeze({
  a: 'أَ', o: 'أو', u: 'أو', e: 'إي', i: 'إي',
  'ɐ': 'أَ', 'ɪ': 'إِ', 'ə': 'أَ',
  'ɨ': null,
});

/** الحركاتُ المختزَلةُ التي تُكتَب حركةً قصيرةً — ومعها تحفّظُها. */
const REDUCED = new Set(['ɐ', 'ɪ', 'ə']);

const REDUCED_NOTE = 'الحركات القصيرة هنا (فتحة/كسرة) أخفت وأسرع من نظيرتها في العربي — '
  + 'مش حركة كاملة.';
const EXTENDED_NOTE = 'الحروف «پ ڤ ژ» مش من العربي الفصيح، بس مكتوبة كده عشان الأصوات دي '
  + 'مش موجودة عندنا.';
const SOFT_NOTE = 'الساكن الليّن اللسان بيقرب فيه من سقف الحلق — الكتابة العربية '
  + 'مبتظهرش الفرق ده، فاسمعه ولا تعتمد على الشكل.';

/**
 * يبني تقريبَ مقطعٍ واحد من أصواته.
 *
 * @returns {{ text: string, blocked: string|null, soft: boolean, extended: boolean,
 *             reduced: boolean }}
 */
function syllableEar(sounds, { wordInitial }) {
  let text = '';
  let blocked = null;
  let soft = false;
  let extended = false;
  let reduced = false;
  let prevWasConsonant = false;

  for (const sound of sounds) {
    if (sound.type === 'silent') continue;
    if (!sound.ipa) continue;

    if (sound.type === 'consonant') {
      const isSoft = sound.ipa.endsWith('ʲ') && sound.ipa !== 'j';
      const base = isSoft ? sound.ipa.slice(0, -1) : sound.ipa;
      const letter = CONSONANT[sound.ipa] ?? CONSONANT[base];
      if (!letter) { blocked = sound.ipa; break; }
      if (isSoft) soft = true;
      if ([...letter].some((ch) => EXTENDED.includes(ch))) extended = true;
      text += letter;
      prevWasConsonant = true;
      continue;
    }

    if (sound.type === 'vowel') {
      const atStart = wordInitial && !text && !prevWasConsonant;
      const table = atStart ? WORD_INITIAL : (soft && prevWasConsonant ? AFTER_SOFT : AFTER_HARD);
      const glyph = table[sound.ipa];
      if (!glyph) { blocked = sound.ipa; break; }
      if (REDUCED.has(sound.ipa)) reduced = true;
      text += glyph;
      prevWasConsonant = false;
      /* الليونةُ صفةُ الساكن الذي مضى — لا تعبر إلى الحركة التالية. */
      soft = false;
      continue;
    }
  }

  return { text, blocked, soft, extended, reduced };
}

/**
 * التقريبُ الكاملُ للكلمة — مقطعًا مقطعًا.
 *
 * ⚠️ **ولا يُبنى نصٌّ واحدٌ ملتصق.** «إِمييِت» تُقرأ خطأً؛ و«إِ · مي · يِت»
 *    تُقرأ كما تُنطَق، وتُبقي المقاطعَ — وهي وحدةُ التدريب أصلًا (§32).
 *
 * @param {object} analysis نتيجةُ `analyzeWord` (الطبقةُ المعجميّة)
 * @returns {{
 *   available: boolean, syllables: string[], text: string|null,
 *   stressedIndex: number, notes: string[], reason: string|null,
 * }}
 */
export function arabicEar(analysis) {
  const missing = {
    available: false, syllables: [], text: null, stressedIndex: -1, notes: [], reason: null,
  };
  if (!analysis?.supported || !analysis.pronunciation?.ipa) {
    return { ...missing, reason: 'التحليل الصوتي نفسه مش مكتمل، فمفيش تقريب نكتبه.' };
  }

  const bySyllable = new Map();
  for (const sound of analysis.sounds) {
    const at = sound.syllable ?? 0;
    if (!bySyllable.has(at)) bySyllable.set(at, []);
    bySyllable.get(at).push(sound);
  }

  const parts = [];
  const notes = new Set();
  for (let i = 0; i < analysis.syllables.length; i += 1) {
    const built = syllableEar(bySyllable.get(i) || [], { wordInitial: i === 0 });
    if (built.blocked) {
      return {
        ...missing,
        reason: `الصوت [${built.blocked}] مفيش حرف عربي بيوصّفه من غير ما يعلّمك صوت تاني — `
          + `فأحسن ما أكتبش تقريب ناقص.`,
      };
    }
    if (!built.text) {
      return { ...missing, reason: 'فيه مقطع مالوش مقابل عربي أمين.' };
    }
    if (built.extended) notes.add(EXTENDED_NOTE);
    if (built.reduced) notes.add(REDUCED_NOTE);
    if (built.soft) notes.add(SOFT_NOTE);
    parts.push(built.text);
  }

  if (!parts.length) return { ...missing, reason: 'مفيش مقاطع نبني عليها.' };

  return {
    available: true,
    syllables: parts,
    text: parts.join(' · '),
    stressedIndex: analysis.stress.ordinal,
    notes: [...notes],
    reason: null,
  };
}

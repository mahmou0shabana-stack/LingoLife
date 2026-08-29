/**
 * LingoLife — الجردُ الصوتيّ الروسيّ (WS52)
 *
 * ═══════════════════════════════════════════════════════════════
 * هذا ملفُّ **حقائق** لا ملفُّ منطق
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ ما هنا مُثبَتٌ في `docs/russian-pronunciation-spec.md §20.3`،
 * وكلُّ قاعدةٍ في `rules/` تقرأ من هنا ولا تُعيد تعريفَ حرفٍ عندها.
 *
 * ⚠️ **ولا يُضاف حرفٌ ولا زوجٌ هنا بلا بندٍ في المواصفة.** هذه الجداولُ
 *    هي ما يجعل «القاعدة» قابلةً للاختبار: لو تسلّل حرفٌ خطأٌ إلى
 *    `ALWAYS_HARD` لانكسرت عشراتُ الكلمات بلا أن تُخطئ قاعدةٌ واحدة.
 */

/** علامةُ النبر المركّبة — تُوضَع **بعد** حرف العلّة. */
export const STRESS_MARK = '́';

/** حروفُ العلّة العشرة. */
export const VOWELS = 'аоэуыиеёюя';

/**
 * الحروفُ التي تُليِّن ما قبلها.
 * ⚠️ و`и` منها — وهو ما ينساه المتعلّمون: `тихо` فيها `т` ليّنة.
 */
export const SOFTENING_VOWELS = 'еёиюя';

/** الحروفُ اليوتيّة: قد تُنتج `j` + حركة بحسب موضعها. */
export const IOTATED = 'еёюя';

/** قيمةُ الحركة حين **لا** تكون يوتيّة (أي بعد ساكن). */
export const VOWEL_SOUND = Object.freeze({
  а: 'a', о: 'o', э: 'e', у: 'u', ы: 'ɨ', и: 'i',
  е: 'e', ё: 'o', ю: 'u', я: 'a',
});

/** الحركةُ التي تلي `j` حين تكون يوتيّة. */
export const IOTATED_SOUND = Object.freeze({ е: 'e', ё: 'o', ю: 'u', я: 'a' });

/* ------------------------------------------------------------------ *
 * السواكن
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **صلبةٌ دائمًا — مهما تلاها** (`RU_CONS_ALWAYS_HARD`).
 *    ولا حتى `и` أو `е` أو `ь` تُليّنها. و`и` بعدها تُنطَق `ɨ`.
 */
export const ALWAYS_HARD = 'жшц';

/** ⚠️ **ليّنةٌ دائمًا — مهما تلاها** (`RU_CONS_ALWAYS_SOFT`). */
export const ALWAYS_SOFT = 'чщй';

/**
 * الرنّاناتُ (сонорные).
 *
 * ⚠️ **مجهورةٌ بلا زوجٍ مهموس** — فلا تُهمَس في آخر الكلمة، **ولا
 *    تُجهِّر ما قبلها**. وتعميمُ «المجهورُ يُهمَس آخرًا» عليها هو
 *    أشهرُ إفراطٍ في هذه العائلة: `стол` و`дом` لا يتغيّران.
 */
export const SONORANTS = 'лмнрй';

/** مهموسةٌ بلا زوجٍ مجهور — فلا تُجهَّر أبدًا. */
export const UNPAIRED_VOICELESS = 'хцчщ';

/** أزواجُ الجهر/الهمس — المفتاحُ مجهورٌ والقيمةُ مهموسة. */
export const VOICED_TO_VOICELESS = Object.freeze({
  б: 'п', в: 'ф', г: 'к', д: 'т', ж: 'ш', з: 'с',
});

/** والعكسُ — يُشتقّ لا يُكتَب مرّتين. */
export const VOICELESS_TO_VOICED = Object.freeze(
  Object.fromEntries(Object.entries(VOICED_TO_VOICELESS).map(([v, f]) => [f, v]))
);

/** قيمةُ الساكن صلبًا. */
export const CONSONANT_HARD = Object.freeze({
  б: 'b', п: 'p', в: 'v', ф: 'f', г: 'ɡ', к: 'k', д: 'd', т: 't',
  ж: 'ʐ', ш: 'ʂ', з: 'z', с: 's', х: 'x', ц: 'ts', ч: 'tɕ', щ: 'ɕː',
  й: 'j', л: 'ɫ', м: 'm', н: 'n', р: 'r',
});

/**
 * قيمةُ الساكن ليّنًا.
 *
 * ⚠️ **و`л` وحدَها تبدّل رمزَها لا تُضيف علامة**: الصلبةُ `ɫ` مُظلَمةٌ
 *    والليّنةُ `lʲ`. أمّا الباقي فيأخذ `ʲ`.
 */
export const CONSONANT_SOFT = Object.freeze({
  б: 'bʲ', п: 'pʲ', в: 'vʲ', ф: 'fʲ', г: 'ɡʲ', к: 'kʲ', д: 'dʲ', т: 'tʲ',
  з: 'zʲ', с: 'sʲ', х: 'xʲ', л: 'lʲ', м: 'mʲ', н: 'nʲ', р: 'rʲ',
  ч: 'tɕ', щ: 'ɕː', й: 'j',
});

export const isVowel = (ch) => VOWELS.includes(ch);
export const isConsonant = (ch) => Object.hasOwn(CONSONANT_HARD, ch);
export const isSonorant = (ch) => SONORANTS.includes(ch);
export const isPairedVoiced = (ch) => Object.hasOwn(VOICED_TO_VOICELESS, ch);
export const isPairedVoiceless = (ch) => Object.hasOwn(VOICELESS_TO_VOICED, ch);
export const isPaired = (ch) => isPairedVoiced(ch) || isPairedVoiceless(ch);

/* ------------------------------------------------------------------ *
 * فئاتُ الفونيمات — **الطبقةُ التي تسأل عنها القواعدُ بدل القوائم** (WS-N)
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **ولماذا فئةٌ مسمّاةٌ بدل `if (next in ['б','д','г'])`؟**
 *
 * لأن القائمةَ الحرفيّةَ تُنسَخ. كُتبت مرّةً في `RU_REGRESSIVE_VOICING`
 * ومرّةً في `RU_CROSS_WORD_VOICING`، وفي الثانية سقط استثناءُ `в`
 * فخرجت «докуме́нт все» بجيمٍ مجهورة. عطبٌ لم تُخطئ فيه قاعدةٌ واحدة —
 * أخطأ فيه **تكرارُ التصنيف**.
 *
 * فالتصنيفُ هنا مرّةً واحدة، والقواعدُ تسأل: «ما فئةُ ما بعدي؟».
 * و`в` فئةٌ **قائمةٌ بذاتها** لأنها كذلك في الروسيّة فعلًا: مجهورةٌ
 * تُهمَس كغيرها، ولا تُجهِّر ما قبلها كغيرها (§10 من الطلب).
 */
export const PHONEME_CLASS = Object.freeze({
  VOWEL: 'VOWEL',
  SONORANT: 'SONORANT',
  /** عائقٌ مجهورٌ له زوجٌ مهموس — وحدَه يُطلِق التجهيرَ الرجعيّ. */
  VOICED_OBSTRUENT: 'VOICED_OBSTRUENT',
  /** عائقٌ مهموسٌ له زوجٌ مجهور — يُطلِق الهمسَ ويقبل التجهير. */
  VOICELESS_OBSTRUENT: 'VOICELESS_OBSTRUENT',
  /** `х ц ч щ`: مهموسةٌ بلا زوج — تُطلِق الهمسَ ولا تُجهَّر أبدًا. */
  UNPAIRED_VOICELESS: 'UNPAIRED_VOICELESS',
  /** `в`/`в'`: مجهورةٌ لا تُجهِّر ما قبلها — استثناءٌ منصوصٌ لا صدفة. */
  V_SPECIAL: 'V_SPECIAL',
  /** علامتان بلا صوت. */
  SIGN: 'SIGN',
  /** ما ليس روسيًّا أصلًا. */
  OTHER: 'OTHER',
});

/** فئةُ الحرف الروسيّ — مصدرُ التصنيف الوحيد. */
export function phonemeClass(ch) {
  if (!ch) return PHONEME_CLASS.OTHER;
  if (ch === 'ь' || ch === 'ъ') return PHONEME_CLASS.SIGN;
  if (isVowel(ch)) return PHONEME_CLASS.VOWEL;
  if (ch === 'в') return PHONEME_CLASS.V_SPECIAL;
  if (isSonorant(ch)) return PHONEME_CLASS.SONORANT;
  if (isPairedVoiced(ch)) return PHONEME_CLASS.VOICED_OBSTRUENT;
  if (UNPAIRED_VOICELESS.includes(ch)) return PHONEME_CLASS.UNPAIRED_VOICELESS;
  if (isPairedVoiceless(ch)) return PHONEME_CLASS.VOICELESS_OBSTRUENT;
  return PHONEME_CLASS.OTHER;
}

/**
 * هل هذه الفئةُ تُطلِق تجهيرًا رجعيًّا على ما قبلها؟
 *
 * ⚠️ **`в` خارجها والرنّاناتُ خارجها — وهذا هو نصفُ الظاهرة.** المتعلّم
 *    يسمع «مجهور» فيعمّم؛ والمصدرُ يستثني الاثنين صراحةً. فالسؤالُ
 *    يُطرَح على الفئة، فلا يُنسى الاستثناءُ في موضعٍ ويُذكَر في آخر.
 */
export const classTriggersVoicing = (cls) => cls === PHONEME_CLASS.VOICED_OBSTRUENT;

/** وهل تُطلِق همسًا رجعيًّا؟ — المهموساتُ كلُّها، مزدوجةً وغيرَ مزدوجة. */
export const classTriggersDevoicing = (cls) => cls === PHONEME_CLASS.VOICELESS_OBSTRUENT
  || cls === PHONEME_CLASS.UNPAIRED_VOICELESS;

/** وصفٌ عربيٌّ للفئة — للشرح لا للمنطق. */
export const PHONEME_CLASS_LABEL = Object.freeze({
  VOWEL: 'حرف علّة',
  SONORANT: 'رنّانة',
  VOICED_OBSTRUENT: 'عائق مجهور',
  VOICELESS_OBSTRUENT: 'عائق مهموس',
  UNPAIRED_VOICELESS: 'مهموس بلا زوج مجهور',
  V_SPECIAL: '«в» — مجهورة بس مبتجهّرش اللي قبلها',
  SIGN: 'علامة بلا صوت',
  OTHER: 'مش روسي',
});

/**
 * سلّمُ الرنين لقانون الرنين الصاعد (`RU_SYLLABIFICATION`).
 * ٤ حركة · ٣ رنّانة · ٢ عائقةٌ مجهورة · ١ عائقةٌ مهموسة.
 */
export function sonority(ch) {
  if (isVowel(ch)) return 4;
  if (isSonorant(ch)) return 3;
  if (isPairedVoiced(ch)) return 2;
  if (isConsonant(ch)) return 1;
  return 0;
}

/* ------------------------------------------------------------------ *
 * التقريبُ السيريليّ للمتعلّم — **وليس IPA**
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **وهذا هو النسخُ المدرسيُّ الروسيُّ نفسُه، لا اختراعًا منّا.**
 *
 * `ъ` للحركة المختزَلة من الدرجة الثانية، و`а` للأولى — فترى بعينك
 * أن `молоко` هي `[мълако́]`: الأولى أخفتُ من الثانية. ولو صيّرناهما
 * `а` واحدةً لكنّا **علّمناك الخرافةَ** التي مُنِعت صراحةً: «كلُّ `о`
 * غير مشدّدة تبقى `а`».
 */
export const IPA_TO_CYRILLIC = Object.freeze({
  a: 'а', o: 'о', e: 'э', u: 'у', i: 'и', 'ɨ': 'ы',
  'ɐ': 'а', 'ə': 'ъ', 'ɪ': 'и',
  b: 'б', p: 'п', v: 'в', f: 'ф', 'ɡ': 'г', k: 'к', d: 'д', t: 'т',
  'ʐ': 'ж', 'ʂ': 'ш', z: 'з', s: 'с', x: 'х', ts: 'ц', 'tɕ': 'ч', 'ɕː': 'щ',
  j: 'й', 'ɫ': 'л', 'lʲ': "л'",
  /*
   * ⚠️ **الرنّاناتُ كانت ناقصةً هنا** فخرجت `молоко` بحرفٍ لاتينيّ:
   *    `[mълако́]`. عطبٌ لا يكسر قاعدةً ولا اختبارَ منطق — يكسر
   *    **القراءة** وحدَها، ولا يظهر إلّا حين تنظر إلى المخرَج بعينك.
   *    ولذلك بدأتُ بفحصٍ يطبع الكلماتِ قبل أن أكتب اختبارًا واحدًا.
   */
  m: 'м', n: 'н', r: 'р',
});

/** يحوّل قيمةَ IPA إلى تقريبٍ سيريليّ — والعلامةُ `'` للّيونة. */
export function toCyrillic(ipa) {
  if (!ipa) return '';
  if (Object.hasOwn(IPA_TO_CYRILLIC, ipa)) return IPA_TO_CYRILLIC[ipa];
  if (ipa.endsWith('ʲ')) {
    const base = IPA_TO_CYRILLIC[ipa.slice(0, -1)];
    return base ? `${base}'` : ipa;
  }
  return ipa;
}

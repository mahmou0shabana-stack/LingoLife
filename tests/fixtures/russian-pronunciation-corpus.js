/**
 * LingoLife — كوربوسُ اختبار النطق الروسيّ (WS52)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الحالاتُ السالبةُ نصفُ الكوربوس — وهي النصفُ الأهمّ
 * ═══════════════════════════════════════════════════════════════
 *
 * أخطرُ عطبٍ في محرّكٍ لغويّ ليس قاعدةً **غائبة** — تلك يكتشفها
 * المتعلّمُ فيسأل. الأخطرُ قاعدةٌ **صحيحةٌ تنطلق أوسعَ من مداها**:
 * تُنتج نطقًا واثقًا خاطئًا، فيحفظه المتعلّمُ ويكرّره ولا يشكّ.
 *
 * فلكلّ قاعدةٍ هنا حقلان:
 *   `rules`   — معرِّفاتٌ **يجب** أن تنطلق
 *   `notRules`— معرِّفاتٌ **يجب ألّا** تنطلق
 *
 * ومثالٌ على ما يحرسه هذا: `много` تنتهي بـ`ого` ولا تدخل قاعدةَ
 * `-ово`؛ و`точный` فيها `чн` ولا تصير `шн`؛ و`стол` مجهورةُ الآخر
 * ولا تُهمَس. كلُّها كلماتٌ **شائعةٌ جدًّا**، وخطأٌ فيها يفسد جملًا
 * كثيرة.
 *
 * ⚠️ **ولا كلمةَ هنا مكتوبةٌ في المحرّك.** الكوربوسُ يفحص القواعدَ
 *    ولا يُغذّيها؛ ولو حُذف هذا الملفّ لما تغيّر نطقُ حرفٍ واحد.
 */

/**
 * @typedef {Object} CorpusCase
 * @property {string}   word        الكلمة (بعلامةِ نبرٍ إن كانت معروفة)
 * @property {number}  [stress]     رقمُ حرف العلّة المشدَّد المتوقَّع
 * @property {string}  [stressSource] مصدرُ النبر المتوقَّع
 * @property {string[]}[syllables]  المقاطعُ المتوقَّعة
 * @property {string}  [simple]     التقريبُ السيريليُّ المتوقَّع
 * @property {string}  [ipa]        الـIPA المتوقَّع
 * @property {string[]}[rules]      قواعدُ يجب أن تنطلق
 * @property {string[]}[notRules]   قواعدُ يجب ألّا تنطلق
 * @property {string[]}[flags]      أعلامٌ متوقَّعة
 * @property {string}   note        لماذا هذه الحالةُ في الكوربوس
 * @property {string}  [ref]        المرجع
 */

/* ================================================================== *
 * أ · حالاتٌ موجبة
 * ================================================================== */

export const POSITIVE = Object.freeze([
  /* ---- درجتا الاختزال: قلبُ المسألة ---- */
  {
    word: 'молоко́', stress: 2, syllables: ['мо', 'ло', 'ко'],
    simple: 'мълако́', ipa: 'məɫɐˈko',
    rules: ['RU_RED_A_O_WEAK', 'RU_RED_A_O_PRETONIC1', 'RU_VOWEL_STRESSED'],
    note: 'الكلمةُ التي تفضح خرافةَ «كلّ о غير مشدّدة تبقى а»: أوّلُها [ə] وثانيها [ɐ]',
    ref: 'studme.org · Гласные первого предударного слога',
  },
  {
    word: 'хорошо́', stress: 2, simple: 'хърашо́', ipa: 'xərɐˈʂo',
    rules: ['RU_RED_A_O_WEAK', 'RU_RED_A_O_PRETONIC1'],
    note: 'نفسُ البنية بثلاثة о — ولكلٍّ قيمتُها',
  },
  {
    word: 'вода́', stress: 1, simple: 'вада́', ipa: 'vɐˈda',
    rules: ['RU_RED_A_O_PRETONIC1'], notRules: ['RU_RED_A_O_WEAK'],
    note: 'о واحدةٌ قبل النبر مباشرةً — الدرجةُ الأولى وحدَها',
  },
  {
    word: 'го́род', stress: 0, simple: 'го́рът', ipa: 'ˈɡorət',
    rules: ['RU_RED_A_O_WEAK', 'RU_FINAL_DEVOICING'], notRules: ['RU_RED_A_O_PRETONIC1'],
    note: 'اختزالٌ بعد النبر + همسٌ نهائيّ في كلمةٍ واحدة',
  },
  {
    word: 'окно́', stress: 1, simple: 'акно́', ipa: 'ɐˈkno',
    rules: ['RU_RED_A_O_PRETONIC1'],
    note: 'بدايةُ الكلمة المطلقة تأخذ الدرجةَ الأولى ولو لم تكن قبل النبر مباشرةً',
  },

  /* ---- إيكانيه ---- */
  {
    word: 'лиса́', stress: 1, simple: "л'иса́", ipa: 'lʲɪˈsa',
    rules: ['RU_RED_SOFT_IKANYE', 'RU_PALATALIZATION_BY_VOWEL'],
    note: 'زوجُ الإيكانيه — يجب أن يطابق «леса» حرفًا بحرف',
    ref: 'иканье · «лес, лис — [л\'иса]»',
  },
  {
    word: 'леса́', stress: 1, simple: "л'иса́", ipa: 'lʲɪˈsa',
    rules: ['RU_RED_SOFT_IKANYE'],
    note: 'النصفُ الثاني من الزوج — التطابقُ هو الاختبار',
  },
  {
    word: 'пята́к', stress: 1, simple: "п'ита́к", ipa: 'pʲɪˈtak',
    rules: ['RU_RED_SOFT_IKANYE'],
    note: 'مثالُ المصدر حرفيًّا: пятак [pʲɪˈtak]',
  },
  {
    word: 'часы́', stress: 1, simple: 'чисы́', ipa: 'tɕɪˈsɨ',
    rules: ['RU_CONS_ALWAYS_SOFT', 'RU_RED_SOFT_IKANYE'],
    note: '`а` بعد ч الليّنة دائمًا تدخل الإيكانيه لا الأكانيه',
  },

  /* ---- الهسيسيّات ---- */
  {
    word: 'жена́', stress: 1, simple: 'жына́', ipa: 'ʐɨˈna',
    rules: ['RU_CONS_ALWAYS_HARD', 'RU_RED_AFTER_HUSHING_E'],
    note: 'مثالُ المصدر: ж[ыэ]лать وأخواتُها — الدرجةُ الأولى',
  },
  {
    word: 'цена́', stress: 1, simple: 'цына́', ipa: 'tsɨˈna',
    rules: ['RU_RED_AFTER_HUSHING_E'],
    note: 'ц[ыэ]на — نصُّ المصدر',
  },
  {
    word: 'со́лнце', stress: 0, simple: 'со́нцъ', ipa: 'ˈsontsə',
    rules: ['RU_CLUSTER_UNPRONOUNCED', 'RU_RED_AFTER_HUSHING_WEAK'],
    notRules: ['RU_RED_AFTER_HUSHING_E'],
    note: '⚠️ بعد النبر بعد ц تكون [ə] لا [ɨ] — وهو ما أخطأتُ فيه أوّلَ مرّة بتعميم مقتطفٍ يصف موضعًا واحدًا',
  },
  {
    word: 'жить', stress: 0, simple: "жы́т'", ipa: 'ˈʐɨtʲ',
    rules: ['RU_CONS_ALWAYS_HARD'], notRules: ['RU_PALATALIZATION_BY_VOWEL'],
    note: '`и` لا تليّن ж — وتُنطَق هي نفسُها [ɨ]',
  },
  { word: 'цирк', stress: 0, simple: 'цы́рк', ipa: 'ˈtsɨrk',
    rules: ['RU_CONS_ALWAYS_HARD'], note: 'نفسُ الأثر مع ц' },

  /* ---- الصلابةُ والليونة ---- */
  { word: 'лес', stress: 0, simple: "л'э́с", ipa: 'ˈlʲes',
    rules: ['RU_PALATALIZATION_BY_VOWEL'], note: 'л ليّنةٌ قبل е' },
  { word: 'ла́па', stress: 0, simple: 'ла́пъ', ipa: 'ˈɫapə',
    notRules: ['RU_PALATALIZATION_BY_VOWEL'], note: 'ل صلبةٌ قبل а — النصفُ المضادُّ لـ«лес»' },
  { word: 'соль', stress: 0, simple: "со́л'", ipa: 'ˈsolʲ',
    rules: ['RU_PALATALIZATION_BY_SOFT_SIGN'], note: 'ь تليّن ولا صوتَ لها' },
  { word: 'ночь', stress: 0, simple: 'но́ч', ipa: 'ˈnotɕ',
    rules: ['RU_CONS_ALWAYS_SOFT'], notRules: ['RU_PALATALIZATION_BY_SOFT_SIGN'],
    note: '⚠️ ь بعد ч علامةٌ صرفيّةٌ لا صوتيّة — والترتيبُ وحدَه يمنعها' },
  { word: 'мышь', stress: 0, simple: 'мы́ш', ipa: 'ˈmɨʂ',
    rules: ['RU_CONS_ALWAYS_HARD'], notRules: ['RU_PALATALIZATION_BY_SOFT_SIGN'],
    note: 'ш تبقى صلبةً رغم ь' },

  /* ---- الجهرُ والهمس ---- */
  { word: 'друг', stress: 0, simple: 'дру́к', ipa: 'ˈdruk',
    rules: ['RU_FINAL_DEVOICING'], note: 'همسٌ نهائيّ' },
  { word: 'хлеб', stress: 0, simple: "хл'э́п", ipa: 'ˈxlʲep',
    rules: ['RU_FINAL_DEVOICING', 'RU_PALATALIZATION_BY_VOWEL'], note: 'همسٌ نهائيّ مع ليونة' },
  { word: 'любо́вь', stress: 1, simple: "л'убо́ф'", ipa: 'lʲuˈbofʲ',
    rules: ['RU_FINAL_DEVOICING'],
    note: '⚠️ الليونةُ محفوظةٌ بعد الهمس؛ و`в` نفسُها تُهمَس وإن كانت لا تُجهِّر غيرَها' },
  { word: 'ло́дка', stress: 0, simple: 'ло́ткъ', ipa: 'ˈɫotkə',
    rules: ['RU_REGRESSIVE_DEVOICING'], note: 'مماثلةٌ رجعيّةٌ بالهمس' },
  { word: 'про́сьба', stress: 0, simple: "про́з'бъ", ipa: 'ˈprozʲbə',
    syllables: ['про', 'сьба'],
    rules: ['RU_REGRESSIVE_VOICING'], note: 'مماثلةٌ رجعيّةٌ بالجهر + تقطيعٌ لا يبدأ مقطعًا بـ`ь`' },
  { word: 'сде́лать', stress: 0, simple: "зд'э́лът'", ipa: 'ˈzdʲeɫətʲ',
    rules: ['RU_REGRESSIVE_VOICING'],
    note: 'تجهيرٌ — والمماثلةُ بالليونة مؤجَّلةٌ صراحةً فالـд تبقى صلبةً هنا' },
  { word: 'по́езд', stress: 0, simple: 'по́йьст', ipa: 'ˈpojɪst',
    rules: ['RU_FINAL_DEVOICING', 'RU_REGRESSIVE_DEVOICING'],
    note: '⚠️ الحالةُ التي تُثبِت الترتيب: الهمسُ النهائيُّ يُغذّي المماثلةَ الرجعيّة' },
  { word: 'вчера́', stress: 1, simple: 'фчира́', ipa: 'ftɕɪˈra',
    rules: ['RU_REGRESSIVE_DEVOICING'], note: '`в` تُهمَس قبل مهموس' },

  /* ---- الأورثوإبيا والعناقيد ---- */
  { word: 'коне́чно', stress: 1, simple: "кан'э́шнъ", ipa: 'kɐˈnʲeʂnə',
    rules: ['RU_ORTHO_CHN_SHN'], note: 'نواةُ قائمةِ чн←шн' },
  { word: 'ску́чно', stress: 0, simple: 'ску́шнъ', ipa: 'ˈskuʂnə',
    rules: ['RU_ORTHO_CHN_SHN'], note: 'نفسُ القائمة' },
  { word: 'мя́гкий', stress: 0, ipa: 'ˈmʲaxkʲɪj',
    rules: ['RU_ORTHO_GK_HK'], note: 'гк←хк في جذر мяг-' },
  { word: 'лёгкий', stress: 0, stressSource: 'rule_yo', ipa: 'ˈlʲoxkʲɪj',
    rules: ['RU_ORTHO_GK_HK'], note: 'гк←хк في جذر лёг- + النبرُ من ё بلا قاموس' },
  { word: 'ме́стный', stress: 0, simple: "м'э́сный", ipa: 'ˈmʲesnɨj',
    rules: ['RU_CLUSTER_UNPRONOUNCED'], note: 'стн←сн' },
  { word: 'се́рдце', stress: 0, simple: "с'э́рцъ", ipa: 'ˈsʲertsə',
    rules: ['RU_CLUSTER_UNPRONOUNCED'], note: 'рдц←рц' },
  { word: 'учи́ться', stress: 1, simple: 'учи́цъ', ipa: 'uˈtɕitsə',
    syllables: ['у', 'чи', 'ца'],
    rules: ['RU_CLUSTER_TSYA'], note: '-ться←-ца' },
  { word: 'лётчик', stress: 0, stressSource: 'rule_yo', ipa: 'ˈlʲotɕɪk',
    rules: ['RU_CLUSTER_TCH_DCH'], note: 'тч تندمج' },

  /* ---- المعجم ---- */
  { word: 'что', stress: 0, simple: 'што́', ipa: 'ˈʂto',
    rules: ['RU_LEXICAL_ORTHOEPIC_EXCEPTION'], flags: ['LEXICAL_EXCEPTION'],
    note: 'استثناءٌ معجميٌّ — ويجب أن يُعلَن كذلك لا كقاعدةٍ مُنتِجة' },
  { word: 'сего́дня', stress: 1, ipa: 'sʲɪˈvodnʲɪ',
    rules: ['RU_LEXICAL_ORTHOEPIC_EXCEPTION'], flags: ['LEXICAL_EXCEPTION'],
    note: 'г←в داخل الكلمة، فلا تلتقطها قاعدةُ النهاية' },
]);

/* ================================================================== *
 * ب · حالاتٌ سالبة — «القاعدةُ **لا** تنطلق هنا»
 * ================================================================== */

export const NEGATIVE = Object.freeze([
  /* ---- الرنّاناتُ لا تُهمَس ---- */
  { word: 'стол', simple: 'сто́л', notRules: ['RU_FINAL_DEVOICING'],
    note: '⚠️ л رنّانةٌ بلا زوجٍ مهموس — أشهرُ إفراطٍ في الهمس النهائيّ' },
  { word: 'дом', simple: 'до́м', notRules: ['RU_FINAL_DEVOICING'], note: 'م كذلك' },
  { word: 'сын', simple: 'сы́н', notRules: ['RU_FINAL_DEVOICING'], note: 'н كذلك' },
  { word: 'ца́рь', notRules: ['RU_FINAL_DEVOICING'], note: 'р كذلك، مع ليونة' },
  { word: 'май', notRules: ['RU_FINAL_DEVOICING'], note: 'й كذلك' },

  /* ---- الرنّاناتُ و`в` لا تُجهِّران ---- */
  { word: 'сло́во', simple: 'сло́въ', notRules: ['RU_REGRESSIVE_VOICING'],
    note: 'с قبل л لا تُجهَّر', },
  { word: 'смотре́ть', notRules: ['RU_REGRESSIVE_VOICING'], note: 'с قبل м لا تُجهَّر' },
  { word: 'плотва́', simple: 'платва́', ipa: 'pɫɐˈtva',
    rules: ['RU_VOICING_V_NEUTRAL'], notRules: ['RU_REGRESSIVE_VOICING'],
    note: '⚠️ مثالُ المصدر بعينه: т لا تُجهَّر قبل в' },
  { word: 'свой', rules: ['RU_VOICING_V_NEUTRAL'], notRules: ['RU_REGRESSIVE_VOICING'],
    note: 'с لا تُجهَّر قبل в' },
  { word: 'хвост', notRules: ['RU_REGRESSIVE_VOICING'], note: 'х لا زوجَ مجهورًا لها أصلًا' },
  { word: 'изба́', notRules: ['RU_REGRESSIVE_DEVOICING'],
    note: 'з قبل б المجهورة — لا شيءَ يحدث' },

  /* ---- الأورثوإبيا لا تُعمَّم ---- */
  { word: 'то́чный', simple: 'то́чный', notRules: ['RU_ORTHO_CHN_SHN'],
    note: '⚠️ чн تبقى чн خارج القائمة المغلقة' },
  { word: 'про́чный', notRules: ['RU_ORTHO_CHN_SHN'], note: 'كذلك' },
  { word: 'ве́чный', notRules: ['RU_ORTHO_CHN_SHN'], note: 'كذلك' },
  { word: 'ночно́й', notRules: ['RU_ORTHO_CHN_SHN'], note: 'كذلك' },
  { word: 'мно́го', simple: 'мно́гъ', ipa: 'ˈmnoɡə', notRules: ['RU_ORTHO_GO_ENDING'],
    note: '⚠️ تنتهي بـого وليست نهايةً صرفيّة — ولولا المنعُ لصارت «мнова»' },
  { word: 'стро́го', notRules: ['RU_ORTHO_GO_ENDING'], note: 'كذلك' },
  { word: 'убо́го', notRules: ['RU_ORTHO_GO_ENDING'], note: 'كذلك' },
  { word: 'снег', notRules: ['RU_CLUSTER_UNPRONOUNCED'], note: 'сн أصليّةٌ — لا شيءَ يُحذَف' },
  { word: 'стена́', notRules: ['RU_CLUSTER_UNPRONOUNCED'], note: 'ست ليست стн' },
  { word: 'щека́', notRules: ['RU_CLUSTER_SCH_ZCH'], note: 'щ أصليّةٌ لا ناتجةٌ عن сч' },
  { word: 'чай', notRules: ['RU_CLUSTER_TCH_DCH'], note: 'ч وحدَها ليست тч' },

  /* ---- الاختزالُ لا يمسّ المشدَّد ---- */
  { word: 'жёны', stressSource: 'rule_yo', notRules: ['RU_RED_AFTER_HUSHING_E'],
    note: 'ё مشدَّدةٌ دائمًا فلا تُختزَل' },
  { word: 'пять', notRules: ['RU_RED_SOFT_IKANYE'], note: 'я مشدَّدةٌ — لا إيكانيه' },
  { word: 'шары́', stress: 1, notRules: ['RU_RED_AFTER_HUSHING_E'],
    note: '⚠️ а بعد ш تدخل الأكانيه لا قاعدةَ الهسيسيّات — تلك لـ`е` وحدَها' },
]);

/* ================================================================== *
 * ج · النبرُ المجهول — وهو سلوكٌ مقصودٌ لا نقص
 * ================================================================== */

export const UNKNOWN_STRESS_CASES = Object.freeze([
  { word: 'замок', note: '⚠️ за́мок قلعةٌ وзамо́к قُفل — والتخمينُ هنا يقلب المعنى' },
  { word: 'счастье', note: 'كلمةٌ خارج القاموس — تُحلَّل عناقيدُها ولا يُدّعى نطقُها' },
  { word: 'необходимо', note: 'من جملتك المرجعيّة — طويلةٌ وخارج القاموس' },
]);

/**
 * الجملةُ المرجعيّةُ التي طلبتَها بالحرف.
 * ⚠️ **ولا كلمةَ منها مكتوبةٌ في المحرّك** — تُعامَل ككلّ نصٍّ آخر،
 *    وما لا يُعرَف نبرُه يُعلَن مجهولًا لا يُخمَّن.
 */
export const REFERENCE_SENTENCE =
  'После того как документ все подпишут, мне необходимо подготовить план '
  + 'устранения замечаний.';

export const CORPUS_SIZE = Object.freeze({
  positive: POSITIVE.length,
  negative: NEGATIVE.length,
  unknownStress: UNKNOWN_STRESS_CASES.length,
});

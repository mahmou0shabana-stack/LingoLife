/**
 * LingoLife — منهجُ الصوتيّات الروسيّة الصريح (WS58)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ طبقتان تتعايشان — لا طبقةٌ تبتلع الأخرى
 * ═══════════════════════════════════════════════════════════════
 *
 * الطبقةُ الأولى: **القاعدةُ التي تعلّمتَها** — بلغتها، بمصطلحها،
 * بأمثلتها. والثانيةُ: **ما يعرفه المحرّكُ بدقّةٍ أعلى**. والخطأُ
 * الذي يُرتكَب عادةً هو أن الثانيةَ تُلغي الأولى: «هذا مغطًّى بقاعدةٍ
 * صوتيّةٍ حديثةٍ أدقّ» — فيختفي المصطلحُ الذي بنيتَ عليه فهمَك كلَّه،
 * ويبقى رمزُ IPA لا يقول لك شيئًا.
 *
 * فهنا: `TEACHING_RULES` تحفظ الطبقةَ الأولى **بمعرِّفٍ وحالةٍ ومصدر**،
 * و`engineRuleIds` تربطها بالثانية. و«ربطٌ» لا «استبدال»: `مرقق` تبقى
 * ظاهرةً، و`[lʲ]` يُضاف إليها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وحالةُ المصدر (`sourceStatus`) ليست تفصيلًا إداريًّا**
 * ═══════════════════════════════════════════════════════════════
 *
 * الملفّاتُ الثلاثةُ المطلوبةُ — «ملحوظات صوتية.pdf» و«النبر.pdf»
 * و«الأصوات المجهورة و المهموسة.pdf» — **لم تصل هذه الجلسة**. بحثتُ
 * في نظام الملفّات كلِّه، وفي مجلَّد المرفوعات، وفي Google Drive: لا
 * أثرَ لها.
 *
 * والبندُ ٦٧ يقول: «إن كان شيءٌ في الـPDF غيرَ مقروءٍ أو ملتبسًا فبلِّغ
 * عن البند بعينه، **ولا تستبدل به افتراضًا**». فالقرارُ هنا ليس أن
 * أخترع محتوى الملفّات من الطلب، ولا أن أتوقّف فلا أسلّم شيئًا — بل أن
 * **أُعلن مصدرَ كلّ بندٍ على البند نفسِه**:
 *
 *   · `PDF_VERIFIED`     — قرأتُه في الملفّ. **ولا بندَ يحمله اليوم.**
 *   · `PROMPT_CHECKLIST` — من قائمة التدقيق في الطلب نفسِه (٥أ…٧ح).
 *   · `ENGINE_ORIGIN`    — لا مصدرَ منهجيًّا له؛ توسيعٌ من المحرّك.
 *
 * فحين تصل الملفّاتُ لا يُعاد بناءُ شيء: تُرفَع الحالةُ إلى
 * `PDF_VERIFIED` ويُضاف ما لم تُعدِّده قائمةُ التدقيق. و**اختبارٌ
 * يَعُدّ** الأصنافَ الثلاثة، فلا يمرّ ادّعاءُ أمانةٍ للمصدر بلا مصدر.
 */

import { allRuleIds, ruleById } from './rule-registry.js';
import { LEXICON, LEXICAL_RULE } from './pronunciation-lexicon.js';

/* ================================================================== *
 * المفردات
 * ================================================================== */

/** الوثائقُ الثلاث — بعناوينها كما وردت في الطلب. */
export const SOURCE_DOC = Object.freeze({
  NOTES: 'ملحوظات صوتية',
  STRESS: 'النبر',
  VOICING: 'الأصوات المجهورة والمهموسة',
  /** ما لا أصلَ له في الوثائق الثلاث — توسيعُ المحرّك (بند ٤٤). */
  ENGINE: 'توسيع المحرّك',
});

/**
 * حالةُ التغطية — **سبعُ حالاتٍ صريحة، ولا «غالبًا مغطّاة»** (بند ٨).
 */
export const COVERAGE = Object.freeze({
  /** المحرّكُ ينفّذها، والأمثلةُ تمرّ. */
  COVERED: 'COVERED',
  /** جزءٌ منها منفَّذٌ وجزءٌ لا — والفرقُ مكتوب. */
  PARTIAL: 'PARTIAL',
  /** معروفةٌ ولم تُنفَّذ. */
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  /** تُعلَّم ولا تُنفَّذ لأنها مفهومٌ لا تحويل. */
  CURRICULUM_ONLY: 'CURRICULUM_ONLY',
  /** المحرّكُ يقول أدقَّ مِمّا تقوله القاعدةُ التعليميّة. */
  ENGINE_MORE_PRECISE: 'ENGINE_MORE_PRECISE',
  /** المصادرُ تختلف — يُعرَض الوجهان ولا يُحسَم. */
  DISPUTED: 'DISPUTED',
  /** تخصّ كلماتٍ بعينها لا نمطًا. */
  LEXICAL: 'LEXICAL',
});

/** أصلُ البند: مطلوبٌ من المنهج، أم توسيعٌ علميٌّ فوقه (بند ٤٣). */
export const PROVENANCE = Object.freeze({
  SOURCE_REQUIRED: 'SOURCE_REQUIRED',
  ENGINE_EXPANSION: 'ENGINE_EXPANSION',
});

/**
 * من أين جاء **نصُّ** البند — لا من أين جاء تنفيذُه.
 * ⚠️ راجع الرأسَ أعلاه: هذا الحقلُ هو ما يمنع ادّعاءَ أمانةٍ لمصدرٍ
 *    لم يُقرأ. ولا يجوز رفعُ بندٍ إلى `PDF_VERIFIED` إلّا بعد قراءة
 *    الملفّ فعلًا.
 */
export const SOURCE_STATUS = Object.freeze({
  PDF_VERIFIED: 'PDF_VERIFIED',
  PROMPT_CHECKLIST: 'PROMPT_CHECKLIST',
  ENGINE_ORIGIN: 'ENGINE_ORIGIN',
});

/**
 * المصطلحاتُ العربيّةُ الإلزاميّة (بند ٣).
 *
 * ⚠️ **وهي ليست ترجمةً — هي النموذجُ الذهنيّ.** «hard/soft» تصف
 *    اللسانَ الروسيّ؛ و«مفخم/مرقق» تصف ما تعلّمتَه أنت. واستبدالُ
 *    الثانية بالأولى ليس تحديثَ مصطلح، بل هدمُ الجسر الذي تعبر عليه
 *    من معرفتك إلى اللغة.
 */
export const TERM = Object.freeze({
  HARD: 'مفخم',
  SOFT: 'مرقق',
  VOICED: 'مجهور',
  VOICELESS: 'مهموس',
  STRESS: 'النبر',
  REDUCED: 'مختزل',
  VOWEL: 'حرف متحرك',
  CONSONANT: 'حرف ساكن',
});

/** المقابلُ التقنيّ — يظهر في الوضع المتقدّم **بجانب** العربيّ لا بدلًا منه. */
export const TERM_TECHNICAL = Object.freeze({
  مفخم: 'hard / non-palatalized',
  مرقق: 'soft / palatalized',
  مجهور: 'voiced',
  مهموس: 'voiceless',
  النبر: 'stress / ударение',
  مختزل: 'reduced vowel',
  'حرف متحرك': 'vowel',
  'حرف ساكن': 'consonant',
});

/* ================================================================== *
 * بنودُ المنهج
 * ================================================================== */

/**
 * كلُّ بندٍ تعليميٍّ في الوثائق الثلاث + توسيعاتُ المحرّك فوقها.
 *
 * الحقول:
 *  · `id`            معرِّفٌ ثابتٌ لا يتغيّر بإعادة الصياغة.
 *  · `doc`/`section` من أين — والقسمُ برقم بند الطلب حتى تصل الملفّات.
 *  · `terms`         أيُّ مصطلحٍ إلزاميٍّ يحمله هذا البند.
 *  · `examples`      أمثلةُ المصدر — **تُثبِت التغطيةَ ولا تُعرِّفها** (بند ١١).
 *  · `counter`       أمثلةٌ مضادّة: تُثبِت أن القاعدةَ **لا** تُفرِط.
 *  · `engineRuleIds` القواعدُ المُنفِّذة — تُدقَّق آليًّا على السجلّ.
 *  · `status`        من `COVERAGE`.
 */
export const TEACHING_RULES = Object.freeze([

  /* ──────────────────────────────────────────────────────────────
     الوثيقةُ الأولى — ملحوظات صوتية (٥أ … ٥ن)
     ────────────────────────────────────────────────────────────── */

  {
    id: 'TEACH_SOFTENING_LETTERS',
    doc: SOURCE_DOC.NOTES,
    section: '5A',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'الحروف اللي بترقّق اللي قبلها',
    arabicExplanation:
      'الحروف «е ё я ю и» والعلامة «ь» بترقّق الحرف الساكن اللي قبلها. '
      + 'يعني اللسان بيقرب من سقف الحلق وقت ما تنطقه.',
    terms: [TERM.SOFT, TERM.CONSONANT],
    examples: [
      { word: 'ле́с', shows: 'л مرقق قبل е' },
      { word: 'ти́хо', shows: 'т مرقق قبل и' },
      { word: 'со́ль', shows: 'л مرقق بـ ь' },
      { word: 'мя́со', shows: 'м مرقق قبل я' },
      { word: 'нёс', shows: 'н مرقق قبل ё' },
      { word: 'лю́ди', shows: 'л و д مرققتان' },
    ],
    counter: [
      { word: 'ла́па', shows: 'л مفخم — مفيش حرف مرقّق بعده' },
      {
        word: 'жи́знь',
        shows: 'ж فضل مفخم رغم и بعده',
        /* ⚠️ والـ`н` فيها تُرقَّق بـ`ь` **بحقّ** — فالمنعُ على قاعدةِ
           الحركة وحدَها، لا على البند كلِّه. */
        notRules: ['RU_PALATALIZATION_BY_VOWEL'],
      },
    ],
    engineRuleIds: ['RU_PALATALIZATION_BY_VOWEL', 'RU_PALATALIZATION_BY_SOFT_SIGN'],
    status: COVERAGE.COVERED,
    notes: 'المحرّك يضيف الرمزَ الصوتيّ ([lʲ] وأخواته) فوق المصطلح، ولا يستبدله.',
  },

  {
    id: 'TEACH_ALWAYS_HARD',
    doc: SOURCE_DOC.NOTES,
    section: '5B',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'ш · ж · ц — مفخمين دائمًا',
    arabicExplanation:
      'التلاتة دول مفخمين على طول، مهما جه بعدهم. حتى «и» و«е» و«ь» مبيرققوهمش.',
    terms: [TERM.HARD, TERM.CONSONANT],
    examples: [
      { word: 'жи́знь', shows: 'ж مفخم و и بعده بتتسمع «ы»' },
      { word: 'ши́ть', shows: 'ш مفخم و и بعده «ы»' },
      { word: 'ци́рк', shows: 'ц مفخم و и بعده «ы»' },
      { word: 'маши́на', shows: 'ш مفخم في وسط الكلمة' },
    ],
    counter: [
      { word: 'ча́с', shows: 'ч مرقق — مش من العيلة دي' },
    ],
    engineRuleIds: ['RU_CONS_ALWAYS_HARD'],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ «и بعدهم تتنطق ы» منفَّذةٌ في `buildSegments` لا في قاعدةٍ مسجَّلة — '
      + 'أثرٌ مباشرٌ للصلابة لا قاعدةٌ مستقلّة. مغطّاةٌ باختبارٍ صريح، '
      + 'ومذكورةٌ هنا حتى لا تُحسَب تغطيةً ضمنيّة.',
  },

  {
    id: 'TEACH_ALWAYS_SOFT',
    doc: SOURCE_DOC.NOTES,
    section: '5C',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'щ · ч — مرققين دائمًا',
    arabicExplanation: 'الاتنين دول مرققين على طول، حتى قدّام «а» و«о» و«у».',
    terms: [TERM.SOFT, TERM.CONSONANT],
    examples: [
      { word: 'ча́с', shows: 'ч مرقق قدّام а' },
      { word: 'щу́ка', shows: 'щ مرقق قدّام у' },
      { word: 'ча́й', shows: 'ч مرقق في أوّل الكلمة' },
    ],
    counter: [
      { word: 'ши́ть', shows: 'ш مفخم — العيلة التانية' },
    ],
    engineRuleIds: ['RU_CONS_ALWAYS_SOFT'],
    status: COVERAGE.COVERED,
    notes:
      'المحرّك يضمّ `й` إلى العائلة نفسِها (`ALWAYS_SOFT = чщй`) — '
      + 'توسيعٌ صحيحٌ فوق ما تعدّده قائمةُ التدقيق، لا بديلٌ عنه.',
  },

  {
    id: 'TEACH_VOWEL_AFTER_CH_SHCH',
    doc: SOURCE_DOC.NOTES,
    section: '5D',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'الحركة غير المنبورة بعد ч / щ',
    arabicExplanation:
      'بما إن «ч» و«щ» مرققين دايمًا، الحركة اللي بعدهم لو مش منبورة '
      + 'بتقرب من «и» — عشان كده «часы» بتتسمع «чисы».',
    terms: [TERM.SOFT, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'часы́', shows: 'а بعد ч غير منبورة → [ɪ]' },
      { word: 'щаве́ль', shows: 'а بعد щ غير منبورة → [ɪ]' },
    ],
    counter: [
      { word: 'ча́с', shows: 'а منبورة — متختزلش' },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE'],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ صياغةُ المصدر نفسِها غيرُ متحقَّقٍ منها (الملفّ لم يصل). '
      + 'المُغطّى هو الظاهرةُ كما تصفها قائمةُ التدقيق: سلوكُ الحركة بعد ч/щ.',
  },

  {
    id: 'TEACH_GO_ENDING_V',
    doc: SOURCE_DOC.NOTES,
    section: '5E',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'نهاية ‎-его / -ого: الـ«г» بتتنطق «в»',
    arabicExplanation:
      'في آخر الصفات والضمائر، «-ого» بتتقال «-ово» و«-его» بتتقال «-ево».',
    terms: [TERM.VOICED, TERM.CONSONANT],
    examples: [
      { word: 'его́', shows: 'г → в' },
      { word: 'кра́сного', shows: 'نهاية صفة' },
      { word: 'сего́дня', shows: 'г → в جوّه الكلمة — حالة معجمية' },
    ],
    counter: [
      { word: 'мно́го', shows: '«ого» مش نهاية صرفية — الـ г بتفضل г' },
      { word: 'стро́го', shows: 'زيّها' },
      { word: 'до́лго', shows: 'زيّها' },
    ],
    engineRuleIds: ['RU_ORTHO_GO_ENDING', 'RU_LEXICAL_ORTHOEPIC_EXCEPTION'],
    status: COVERAGE.COVERED,
    notes:
      'المحرّك يقرّر بالتركيب الصرفيّ لا بالإملاء: قائمةُ منعٍ '
      + '(`GO_ENDING_EXCLUSIONS`) تحمي «много» وأخواتها. والمنهجُ يعلّم الظاهرة، '
      + 'والمحرّكُ يقرّر انطباقَها على هذه الكلمة (بند ٥هـ).',
  },

  {
    id: 'TEACH_GK_HK',
    doc: SOURCE_DOC.NOTES,
    section: '5F',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'гк بتتنطق хк',
    arabicExplanation: 'في عيلة «лёгкий» و«мягкий»، الـ«г» بتبقى «х» عشان تسهّل النطق.',
    terms: [TERM.VOICELESS, TERM.CONSONANT],
    examples: [
      { word: 'лёгкий', shows: 'гк → хк' },
      { word: 'мя́гкий', shows: 'гк → хк' },
      { word: 'ле́гче', shows: 'гч → хч' },
      { word: 'мя́гче', shows: 'гч → хч' },
    ],
    counter: [
      { word: 'до́лго', shows: 'г عادية — مفيش гк' },
    ],
    engineRuleIds: ['RU_ORTHO_GK_HK'],
    status: COVERAGE.COVERED,
    notes: 'مقيَّدةٌ بجذرَي лёг-/мяг- لا بكلّ عنقود гк — القاعدةُ `PROVISIONAL` في المحرّك.',
  },

  {
    id: 'TEACH_VH_FH',
    doc: SOURCE_DOC.NOTES,
    section: '5G',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'вх بتتنطق фх',
    arabicExplanation: 'الـ«в» بتفقد جهرها قدّام «х» المهموسة — «вход» بتتقال «фход».',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'вхо́д', shows: 'в → ф قدّام х' },
    ],
    counter: [
      { word: 'вода́', shows: 'в فضلت مجهورة قدّام حرف متحرك' },
    ],
    engineRuleIds: ['RU_REGRESSIVE_DEVOICING'],
    status: COVERAGE.ENGINE_MORE_PRECISE,
    notes:
      'مفيش قاعدةٌ خاصّةٌ بـ«вх» — القاعدةُ العامّةُ للمماثلة الرجعيّة تكفيها، '
      + 'وهي أعمُّ وأصدق: نفسُ السببِ يفسّر «вчера» و«всё». '
      + '(بند ١١: المثالُ يُثبِت التغطيةَ ولا يُعرِّف التنفيذ.)',
  },

  {
    id: 'TEACH_SCH_TO_SHCH',
    doc: SOURCE_DOC.NOTES,
    section: '5H',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'сч بتتنطق щ',
    arabicExplanation: '«сч» بتتنطق صوت واحد طويل مرقق زيّ «щ».',
    terms: [TERM.SOFT],
    examples: [
      { word: 'сча́стье', shows: 'сч → щ' },
      { word: 'счёт', shows: 'сч → щ' },
      { word: 'во́зчик', shows: 'зч → щ' },
    ],
    counter: [
      { word: 'сто́л', shows: 'с عادية — مفيش сч' },
    ],
    engineRuleIds: ['RU_CLUSTER_SCH_ZCH'],
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'TEACH_STL_SL',
    doc: SOURCE_DOC.NOTES,
    section: '5I',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'стл بتتنطق сл — الـ«т» مبتتنطقش',
    arabicExplanation: 'فيه «т» مكتوبة ومش بتتنطق — «счастливый» بتتقال «щасливый».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'счастли́вый', shows: 'стл → сл' },
    ],
    counter: [
      { word: 'стла́ть', shows: 'стл في أوّل الكلمة — بتتنطق كاملة' },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    notes: 'شرطُ الموضع (ليست في أوّل الكلمة) أرخصُ من قائمة استثناءات.',
  },

  {
    id: 'TEACH_VSTV_LOSS',
    doc: SOURCE_DOC.NOTES,
    section: '5J',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'вств — أوّل «в» مبتتنطقش',
    arabicExplanation: 'في «здравствуйте» و«чувство» الـ«в» الأولى ساقطة من النطق.',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'здра́вствуйте', shows: 'в الأولى ساقطة' },
      { word: 'чу́вство', shows: 'в الأولى ساقطة' },
    ],
    counter: [
      { word: 'сво́й', shows: 'в بتتنطق عادي' },
    ],
    engineRuleIds: ['RU_LEXICAL_ORTHOEPIC_EXCEPTION'],
    status: COVERAGE.LEXICAL,
    notes:
      '⚠️ معجميّةٌ عمدًا لا نمطيّة. عنقودُ «вств» ليس مطّردًا، وتعميمُه قاعدةً '
      + 'يُسقط كلماتٍ لا تسقط فيها الـв. مدخلان في `pronunciation-lexicon.js` '
      + 'يُعيدان الكتابةَ ثم يدخل الناتجُ خطَّ المعالجة كاملًا.',
  },

  {
    id: 'TEACH_ZDN_ZN',
    doc: SOURCE_DOC.NOTES,
    section: '5K',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'здн بتتنطق зн',
    arabicExplanation: 'الـ«д» مكتوبة ومش بتتنطق — «праздник» بتتقال «празник».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'пра́здник', shows: 'здн → зн' },
      { word: 'по́здно', shows: 'здн → зн' },
    ],
    counter: [
      { word: 'зда́ние', shows: 'зд من غير н — بتتنطق كاملة' },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'TEACH_LNC_NC',
    doc: SOURCE_DOC.NOTES,
    section: '5L',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'лнц بتتنطق нц',
    arabicExplanation: 'الـ«л» مبتتنطقش — «солнце» بتتقال «сонце».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'со́лнце', shows: 'лнц → нц' },
    ],
    counter: [
      { word: 'коне́ц', shows: 'ц من غير лн' },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'TEACH_RDC_RC',
    doc: SOURCE_DOC.NOTES,
    section: '5M',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'рдц بتتنطق рц',
    arabicExplanation: 'الـ«д» مبتتنطقش — «сердце» بتتقال «серце».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'се́рдце', shows: 'рдц → рц' },
      /* ⚠️ نفسُ الجذر بصيغةٍ أخرى — **تعميمٌ سليمٌ لا استثناء**، فهي
         مثالٌ يُثبِت أن القاعدةَ ليست حفظًا لكلمةٍ واحدة (بند ١١). */
      { word: 'се́рдца', shows: 'نفس الجذر — نفس السقوط' },
    ],
    counter: [
      { word: 'се́рый', shows: 'ر عادية — مفيش рдц' },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'TEACH_ZHCH_SHCH',
    doc: SOURCE_DOC.NOTES,
    section: '5N',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'жч بتتنطق щ',
    arabicExplanation: '«жч» بتتنطق صوت واحد طويل مرقق زيّ «щ» — «мужчина» بتتقال «мущина».',
    terms: [TERM.SOFT],
    examples: [
      { word: 'мужчи́на', shows: 'жч → щ' },
      { word: 'перебе́жчик', shows: 'жч → щ' },
      { word: 'весну́шчатый', shows: 'шч → щ' },
    ],
    counter: [
      { word: 'мужско́й', shows: 'жск — مش жч، الـж بتتهمس عادي' },
      { word: 'му́жество', shows: 'ж لوحدها — مفيش تغيير' },
    ],
    engineRuleIds: ['RU_CLUSTER_ZHCH_SHCH'],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ **كانت `NOT_IMPLEMENTED` حتى WS58.** قبلها كانت `RU_REGRESSIVE_DEVOICING` '
      + 'تهمس الـж قبل ч فتُنتج «мушчина» — نطقٌ لا يقوله روسيّ، ولم يُسقِط اختبارًا '
      + 'لأن كلَّ قاعدةٍ فيه على حدة صحيحة. القاعدةُ الجديدةُ `PROVISIONAL` '
      + 'لأن صفحتَي المصدر محجوبتان عن هذه البيئة.',
  },

  /* ──────────────────────────────────────────────────────────────
     الوثيقةُ الثانية — النبر (٦أ … ٦ح)
     ────────────────────────────────────────────────────────────── */

  {
    id: 'TEACH_STRESS_WHAT',
    doc: SOURCE_DOC.STRESS,
    section: '6A',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'النبر إيه؟',
    arabicExplanation:
      'في كل كلمة روسية فيه حرف متحرك واحد بس بيتقال بصوت أقوى وأطول وأوضح — '
      + 'ده النبر. والمقطع اللي فيه اسمه المقطع المنبور.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'молоко́', shows: 'النبر على الحرف المتحرك التالت' },
      { word: 'ко́мната', shows: 'النبر على الأوّل' },
    ],
    counter: [],
    engineRuleIds: ['RU_VOWEL_STRESSED'],
    status: COVERAGE.COVERED,
    notes:
      'المحرّك يعطي رقمَ الحركة ورقمَ المقطع والمجموع — لا مجرّد علامة. '
      + 'والنبرُ يُخزَّن **رقمَ حركةٍ** لا موضعَ حرف، فيبقى صحيحًا بعد إعادة الكتابة.',
  },

  {
    id: 'TEACH_STRESS_LEARN_WITH_WORD',
    doc: SOURCE_DOC.STRESS,
    section: '6B',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'اتعلّم النبر مع الكلمة نفسها',
    arabicExplanation:
      'مفيش قاعدة عامة بتقولك النبر فين في الروسي. النبر جزء من الكلمة، '
      + 'زيّ حروفها — تتعلّمه معاها وتسمعه معاها.',
    terms: [TERM.STRESS],
    examples: [
      { word: 'докуме́нт', shows: 'النبر محفوظ في القاموس المُراجَع' },
      { word: 'логисти́ческой', shows: 'النبر من المعجم المدمج' },
    ],
    counter: [],
    engineRuleIds: [],
    status: COVERAGE.CURRICULUM_ONLY,
    notes:
      '⚠️ **ولا قاعدةَ محرّكٍ هنا عمدًا.** البندُ ٤١ صريح: `StressResolver` '
      + 'هو مصدرُ الحقيقة الوحيد، ولا يُبنى له نظيرٌ للمنهج. '
      + 'فالمنهجُ **يستهلكه** ولا يوازيه: ٥٠٧ آلاف صيغةٍ بلا إنترنت، '
      + 'وأولويّةٌ صريحةٌ من تحديدك أنت إلى المعجم إلى «مجهول».',
  },

  {
    id: 'TEACH_O_WITH_WITHOUT_STRESS',
    doc: SOURCE_DOC.STRESS,
    section: '6C',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'о منبورة و о غير منبورة',
    arabicExplanation:
      'الـ«о» المنبورة بتتقال «о» كاملة. واللي من غير نبر مبتتقالش «о» — '
      + 'بتختزل. وفيه درجتين: اللي قبل النبر على طول أوضح من اللي بعيدة عنه.',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'молоко́', shows: 'تلات о: [ə] · [ɐ] · [o] منبورة' },
      { word: 'хорошо́', shows: 'نفس التدرّج' },
      { word: 'за́мок', shows: 'о بعد النبر → [ə]' },
    ],
    counter: [
      {
        word: 'ко́т',
        shows: 'о منبورة — متختزلش',
        notRules: ['RU_RED_A_O_PRETONIC1', 'RU_RED_A_O_WEAK'],
      },
    ],
    engineRuleIds: ['RU_VOWEL_STRESSED', 'RU_RED_A_O_PRETONIC1', 'RU_RED_A_O_WEAK'],
    status: COVERAGE.ENGINE_MORE_PRECISE,
    notes:
      '⚠️ **والمحرّك يرفض الخرافةَ الشائعة** «كلّ о غير منبورة = а». '
      + 'يعطي [ɐ] للدرجة الأولى و[ə] للثانية، والنسخُ السيريليُّ يعرضهما '
      + '«а» و«ъ» فترى الفرقَ بعينك. القاعدةُ التعليميّةُ تبقى ظاهرةً فوقهما.',
  },

  {
    id: 'TEACH_YA_STRESS',
    doc: SOURCE_DOC.STRESS,
    section: '6D',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'я منبورة وغير منبورة',
    arabicExplanation:
      'الـ«я» المنبورة بتتقال كاملة. وغير المنبورة بتقرب من «и»: '
      + 'في أوّل الكلمة بتتسمع «йи»، وجوّه الكلمة بعد حرف مرقق بتتسمع «и».',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL, TERM.SOFT],
    examples: [
      { word: 'мя́со', shows: 'я منبورة → [a] بعد م مرققة' },
      { word: 'язы́к', shows: 'я في أوّل الكلمة غير منبورة → [jɪ]' },
      { word: 'пята́к', shows: 'я جوّه الكلمة غير منبورة → [ɪ]' },
    ],
    counter: [
      {
        word: 'мя́гкий',
        shows: 'я منبورة — متختزلش',
        /* الاختزالُ يقع على `и` في النهاية بحقّ — والدعوى عن `я` وحدَها. */
        unchanged: 'я',
      },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE', 'RU_VOWEL_STRESSED'],
    status: COVERAGE.COVERED,
    notes:
      'الحالاتُ الثلاثُ مغطّاةٌ فعلًا ومُختبَرة. و«я» في أوّل الكلمة تمرّ '
      + 'بصوتَين (`й` + حركة) فيراها الاختزالُ «بعد مرقق» — وهو الصواب.',
  },

  {
    id: 'TEACH_E_STRESS_POSITIONS',
    doc: SOURCE_DOC.STRESS,
    section: '6E',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'е منبورة · قبل النبر · بعد النبر',
    arabicExplanation:
      'الـ«е» المنبورة بتتقال «э» كاملة. واللي قبل النبر بتقرب من «и». '
      + 'واللي بعد النبر أخفت وأقصر.',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'ле́с', shows: 'е منبورة → [e]' },
      { word: 'лиса́', shows: 'قبل النبر بعد مرقق → [ɪ]' },
      { word: 'ле́са', shows: 'المقارنة: نفس الصوت في «лиса» و«леса» غير المنبورتين' },
      { word: 'лю́ди', shows: 'и بعد النبر → [ɪ] درجة تانية' },
    ],
    counter: [
      {
        word: 'жена́',
        shows: 'е بعد ж مفخم → [ɨ] مش [ɪ] — عيلة تانية',
        notRules: ['RU_RED_SOFT_IKANYE'],
      },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE', 'RU_VOWEL_STRESSED'],
    status: COVERAGE.PARTIAL,
    notes:
      '⚠️ **جزئيّةٌ بصدقٍ لا بنقصِ عمل.** المحرّك يفرّق «قبل النبر» عن «بعده» '
      + 'في **الدرجة** (`reduction.degree` = ١ أو ٢) ويعرضها في التقريب '
      + 'السيريليّ («и» مقابل «ь»)، لكنه يُخرج رمزَ IPA واحدًا [ɪ] للاثنين '
      + 'لأننا لم نتحقّق من رمزٍ أضيقَ لكلٍّ منهما ([иэ] مقابل [ь] في النسخ '
      + 'المدرسيّ الروسيّ). فالفرقُ **محفوظٌ في البيانات ومعروضٌ للمتعلّم**، '
      + 'وغيرُ مُدَّعًى في IPA. راجع بند ٢٢.',
  },

  {
    id: 'TEACH_ONE_VOWEL_WORD',
    doc: SOURCE_DOC.STRESS,
    section: '6F',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'الكلمة اللي فيها حرف متحرك واحد',
    arabicExplanation:
      'لو الكلمة فيها حرف متحرك واحد بس، فالنبر عليه بالضرورة — مفيش اختيار تاني.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'дом', shows: 'حرف متحرك واحد — النبر عليه' },
      { word: 'нож', shows: 'زيّها' },
      { word: 'стол', shows: 'زيّها' },
    ],
    counter: [
      { word: 'в', shows: 'مفيش حرف متحرك خالص — مفيش نبر، ومفيش مقاطع' },
    ],
    engineRuleIds: [],
    status: COVERAGE.COVERED,
    notes:
      'منفَّذةٌ في `StressResolver` (مزوّدُ أحاديّ المقطع) لا في قاعدةٍ '
      + 'من سجلّ النطق — والفصلُ مقصود: النبرُ يُحَلّ **قبل** القواعد لا بينها. '
      + 'والكلمةُ بلا حركة (حرفُ جرٍّ مثل «в») لا يُختلَق لها نبرٌ ولا مقاطع.',
  },

  {
    id: 'TEACH_YO_CARRIES_STRESS',
    doc: SOURCE_DOC.STRESS,
    section: '6G',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'ё دايمًا منبورة',
    arabicExplanation:
      'لو لقيت «ё» في الكلمة، فالنبر عليها. دي أسهل علامة نبر في الروسي كله.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'нёс', shows: 'ё منبورة' },
      { word: 'счёт', shows: 'ё منبورة' },
      { word: 'лёгкий', shows: 'ё منبورة حتى مع مقاطع تانية' },
    ],
    counter: [
      { word: 'все', shows: 'е مش ё — القاعدة مبتنطبقش' },
    ],
    engineRuleIds: [],
    status: COVERAGE.COVERED,
    notes:
      'منفَّذةٌ في `StressResolver` (مزوّدُ ё) — مصدرُ النبر واحدٌ للمنهج '
      + 'وللمحرّك (بند ٤١).',
  },

  {
    id: 'TEACH_STRESS_CHANGES_MEANING',
    doc: SOURCE_DOC.STRESS,
    section: '6H',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'النبر ممكن يغيّر المعنى',
    arabicExplanation:
      'نفس الحروف بالظبط، والنبر هو اللي بيفرق: «за́мок» قلعة، و«замо́к» قفل.',
    terms: [TERM.STRESS],
    examples: [
      { word: 'за́мок', shows: 'قلعة' },
      { word: 'замо́к', shows: 'قفل' },
    ],
    counter: [
      { word: 'до́м', shows: 'مفيش قراءة تانية — مفيش التباس' },
    ],
    engineRuleIds: [],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ **والالتباسُ يُحفَظ ولا يُحسَم عشوائيًّا** (بند ٤٢). '
      + '`StressResolver` يعلّم الكلمةَ `ambiguous` ويعرض القراءتين الحقيقيّتين '
      + 'فقط — لا كلَّ حروف العلّة. واختيارُك يُحفَظ **للسياق** لا للكلمة، '
      + 'فلا تصير القلعةُ قفلًا في كلّ نصٍّ قادم.',
  },

  /* ──────────────────────────────────────────────────────────────
     الوثيقةُ الثالثة — الأصوات المجهورة والمهموسة (٧أ … ٧ح)
     ────────────────────────────────────────────────────────────── */

  {
    id: 'TEACH_VOICED_VOICELESS_PAIRS',
    doc: SOURCE_DOC.VOICING,
    section: '7A',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'أزواج المجهور والمهموس',
    arabicExplanation:
      'ستّة أزواج: كل واحد فيهم نفس مخرج النطق بالظبط، والفرق إن الأوّل '
      + 'الحبال الصوتية بتهتزّ معاه والتاني لأ.\n'
      + 'б↔п · г↔к · д↔т · з↔с · в↔ф · ж↔ш',
    terms: [TERM.VOICED, TERM.VOICELESS, TERM.CONSONANT],
    /*
     * ⚠️ **وأمثلتُه كلماتٌ يظهر فيها الزوجُ عاملًا لا كلماتٌ تحوي حرفًا.**
     *    كتبتُ أوّلَ مرّة «бок / пок» لأعرض الزوجَ بعينه، فسقط الاختبار
     *    بحقّ: الكلمتان لا تُطلِقان قاعدةَ جهرٍ واحدة. والجدولُ لا يُثبَت
     *    بعرضِ حرفَيه، بل بكلمةٍ **يتبدّل فيها أحدُهما إلى الآخر**.
     */
    examples: [
      { word: 'но́ж', shows: 'ж ← ш — الزوج شغّال في آخر الكلمة' },
      { word: 'ло́дка', shows: 'д ← т — الزوج شغّال قدّام مهموس' },
      { word: 'про́сьба', shows: 'с ← з — الزوج شغّال في الاتّجاه التاني' },
    ],
    counter: [
      { word: 'до́м', shows: 'м رنّانة — مجهورة من غير زوج مهموس' },
    ],
    engineRuleIds: ['RU_FINAL_DEVOICING', 'RU_REGRESSIVE_DEVOICING', 'RU_REGRESSIVE_VOICING'],
    status: COVERAGE.COVERED,
    notes:
      'الأزواجُ نفسُها جدولٌ في `alphabet.js` (`VOICED_TO_VOICELESS`) — '
      + '**حقائقُ لا منطق**، والعكسُ يُشتقّ منها ولا يُكتَب مرّتين. '
      + 'وكلُّ قاعدةِ جهرٍ تقرأ منه ولا تُعيد تعريفَ حرف.',
  },

  {
    id: 'TEACH_REGRESSIVE_EFFECT',
    doc: SOURCE_DOC.VOICING,
    section: '7B',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'الصوت اللي بعده بيأثّر على اللي قبله',
    arabicExplanation:
      'دي القاعدة المركزية كلها: في الروسي التأثير بيمشي من ورا لقدّام. '
      + 'الحرف بيتشكّل على مزاج اللي بعده، مش اللي قبله.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'ло́дка', shows: 'д اتهمست بسبب к' },
      { word: 'про́сьба', shows: 'с اتجهّرت بسبب б' },
    ],
    counter: [
      { word: 'ба́шня', shows: 'ш مهموسة قبل رنّانة — مفيش تأثير' },
    ],
    engineRuleIds: ['RU_REGRESSIVE_DEVOICING', 'RU_REGRESSIVE_VOICING'],
    status: COVERAGE.COVERED,
    notes:
      'المحرّكُ يمرّ على الأصوات **من آخر الكلمة إلى أوّلها** حرفيًّا — '
      + 'الاتّجاهُ ليس تفصيلَ تنفيذ: `поезд` تحتاج أن تُهمَس الـд أوّلًا '
      + 'حتى تجد الـз ما يُهمِسها.',
  },

  {
    id: 'TEACH_VOICED_TO_VOICELESS',
    doc: SOURCE_DOC.VOICING,
    section: '7C',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'مجهور بيبقى مهموس',
    arabicExplanation: 'لو الحرف المجهور جه قبل حرف مهموس، بيفقد جهره.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'ло́дка', shows: 'д → т قبل к' },
      { word: 'ло́жка', shows: 'ж → ш قبل к' },
      { word: 'вхо́д', shows: 'в → ф قبل х' },
    ],
    counter: [
      { word: 'до́брый', shows: 'б قبل رنّانة — فضلت مجهورة' },
    ],
    engineRuleIds: ['RU_REGRESSIVE_DEVOICING'],
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'TEACH_VOICELESS_TO_VOICED',
    doc: SOURCE_DOC.VOICING,
    section: '7D',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'مهموس بيبقى مجهور',
    arabicExplanation: 'والعكس: لو الحرف المهموس جه قبل حرف مجهور مزدوج، بيتجهّر.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'экза́мен', shows: 'к → г قبل з' },
      { word: 'про́сьба', shows: 'с → з قبل б' },
      { word: 'сда́ть', shows: 'с → з قبل д' },
    ],
    counter: [
      { word: 'плотва́', shows: 'т قبل в — مبتتجهّرش، الـв استثناء' },
      { word: 'сха́пать', shows: 'с قبل х — х مهموسة بلا زوج، مبتجهّرش' },
    ],
    engineRuleIds: ['RU_REGRESSIVE_VOICING'],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ مثالُ «экзамен» يُظهر الظاهرةَ فعلًا (к→г مسجَّلةٌ في الأثر) '
      + 'لكنّ نطقَه الكامل **جزئيّ**: الـ«э» غيرُ المنبورة مؤجَّلةٌ صراحةً '
      + '(`RU_UNSTRESSED_E_CARET`) فيُحجَب الـIPA. صدقٌ في الجزء خيرٌ من '
      + 'كمالٍ مُلفَّق (بند ٢٢).',
  },

  {
    id: 'TEACH_CROSS_WORD_EFFECT',
    doc: SOURCE_DOC.VOICING,
    section: '7E',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'التأثير بيعدّي حدود الكلمة',
    arabicExplanation:
      'الكلام مش كلمات مفصولة — الكلمتين بيتنطقوا ملزوقين. '
      + 'فآخر حرف في الكلمة بيتأثّر بأوّل حرف في اللي بعدها.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'к де́лу', shows: 'к → г بسبب д', context: ['к', 'де́лу'] },
      { word: 'от до́ма', shows: 'т → д بسبب д', context: ['от', 'до́ма'] },
      { word: 'но́ж бы́л', shows: 'ж فضلت مجهورة بسبب б', context: ['но́ж', 'бы́л'] },
      { word: 'в па́рке', shows: 'в → ф بسبب п', context: ['в', 'па́рке'] },
    ],
    counter: [
      { word: 'но́ж мо́й', shows: 'م رنّانة — الهمس النهائي بيحصل عادي', context: ['но́ж', 'мо́й'] },
      { word: 'ра́з в', shows: 'в مبتحميش الجهر', context: ['ра́з', 'в'] },
    ],
    engineRuleIds: [
      'RU_CROSS_WORD_VOICED_KEPT', 'RU_CROSS_WORD_VOICING', 'RU_CROSS_WORD_DEVOICING',
    ],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ **وكانت `PARTIAL` بتناقضٍ داخليٍّ حتى WS58.** '
      + '«наш дом» كانت تُجهَّر و«нож дом» تُهمَس — جملتان متناقضتان عن الحدّ '
      + 'الواحد، لأن الهمسَ النهائيَّ كان يسبق قاعدةَ الحدّ فلا تصل. '
      + '`RU_CROSS_WORD_VOICED_KEPT` تمنعه الآن حين تبدأ الكلمةُ التاليةُ '
      + 'بعائقٍ مجهور. وما زال **العروضُ** (أين تقف أنت) غيرَ معروف — '
      + 'ومعلَنٌ في `RU_CROSS_WORD_PROSODY` المؤجَّلة، ولذلك الحالةُ '
      + '`PROVISIONAL` في المحرّك لا `VERIFIED`.',
  },

  {
    id: 'TEACH_SAME_TYPE_NO_CHANGE',
    doc: SOURCE_DOC.VOICING,
    section: '7F',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'لو مفيش سبب — مفيش تغيير',
    arabicExplanation:
      'مش كل حرف بيتغيّر. لو الاتنين من نفس النوع، أو اللي بعده رنّان أو حرف '
      + 'متحرك، فالحرف بيتنطق زيّ ما هو مكتوب بالظبط.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    /*
     * ⚠️ **بندٌ يُثبَت بالغياب — والاختبارُ يقيس الغيابَ لا الحضور.**
     *    `expectsNoChange` تقول للكوربوس: لا تطلب قاعدةً تنطلق هنا؛
     *    اطلب أن **يخرج الحرفُ المذكورُ كما كُتب**. وهو الفحصُ الوحيدُ
     *    الذي يصدق على بندٍ معناه «لا يحدث شيء».
     */
    expectsNoChange: true,
    examples: [
      { word: 'сто́л', shows: 'с مهموسة قبل т مهموسة — مفيش تغيير', unchanged: 'с' },
      { word: 'до́м', shows: 'د مجهورة والـم رنّانة — مفيش تغيير', unchanged: 'д' },
      { word: 'шка́ф', shows: 'ф مهموسة أصلًا في الآخر — مفيش «همس»', unchanged: 'ф' },
    ],
    counter: [],
    engineRuleIds: ['RU_VOICING_SONORANT_NEUTRAL'],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ **والصمتُ لا يُعلِّم.** `RU_VOICING_SONORANT_NEUTRAL` قاعدةٌ '
      + '**مانعةٌ تُسجَّل في الأثر** بدل أن تسكت: المتعلّم يقرأ «الـл هنا حمت '
      + 'الـс من التجهير» بدل أن يرى غيابًا يظنّه سهوًا. وخريطةُ الصوت '
      + '(`sound-map.js`) تعلّم كلَّ صوتٍ `changed: false` صراحةً.',
  },

  {
    id: 'TEACH_FINAL_DEVOICING',
    doc: SOURCE_DOC.VOICING,
    section: '7G',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'الهمس في آخر الكلمة',
    arabicExplanation:
      'أيّ حرف مجهور مزدوج في آخر الكلمة بيفقد جهره — «нож» بتتقال «нош».',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'но́ж', shows: 'ж → ш' },
      { word: 'дру́г', shows: 'г → к' },
      { word: 'ра́з', shows: 'з → с' },
      { word: 'любо́вь', shows: 'в → ф حتى مع ь' },
    ],
    counter: [
      { word: 'шка́ф', shows: 'ф مهموسة أصلًا — مفيش تغيير' },
      { word: 'сто́л', shows: 'л رنّانة — مبتفقدش جهرها' },
      { word: 'до́м', shows: 'م رنّانة — زيّها' },
    ],
    engineRuleIds: ['RU_FINAL_DEVOICING'],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ **والرنّاناتُ خارجَها** — وهو أشهرُ إفراطٍ في هذه القاعدة: '
      + 'المتعلّم يسمع «مجهور» فيظنّها تشمل л م н р. الشرطُ `isPairedVoiced` '
      + 'وحدَه يمنع ذلك بلا قائمة استثناءات.',
  },

  {
    id: 'TEACH_V_SPECIAL',
    doc: SOURCE_DOC.VOICING,
    section: '7H',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PROMPT_CHECKLIST,
    arabicTitle: 'الـ«в» حالة خاصة',
    arabicExplanation:
      'الـ«в» غريبة: هي **بتتأثّر** زيّ أيّ حرف مجهور (بتتهمس في الآخر وقدّام '
      + 'المهموس)، لكنها **مبتأثّرش** — مبتجهّرش الحرف اللي قبلها.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'плотва́', shows: 'т فضلت مهموسة قدّام в' },
      /* ⚠️ **الوجهُ الثاني للاستثناء — وقاعدتُه غيرُ قاعدته.** «в
         مبتجهّرش اللي قبلها» يحرسها `RU_VOICING_V_NEUTRAL`؛ أمّا «в
         نفسها بتتهمس» فقاعدتان عاديّتان. والخلطُ بينهما هو ما يقلب
         الاستثناءَ على رأسه، فيُسمَّى لكلٍّ قاعدتُه هنا. */
      { word: 'любо́вь', shows: 'в نفسها اتهمست في الآخر → ф', expectRule: 'RU_FINAL_DEVOICING' },
      { word: 'вчера́', shows: 'в نفسها اتهمست قدّام ч → ф', expectRule: 'RU_REGRESSIVE_DEVOICING' },
    ],
    counter: [
      { word: 'сда́ть', shows: 'с اتجهّرت قدّام д — لأن д مش в' },
    ],
    engineRuleIds: ['RU_VOICING_V_NEUTRAL'],
    status: COVERAGE.COVERED,
    notes:
      '⚠️ **في اتّجاهٍ واحدٍ فقط، والخلطُ يقلب الاستثناءَ على رأسه.** '
      + 'المنعُ على «التجهير نحو اليسار» لا على `в` نفسِها. '
      + 'والاستثناءُ يعبر حدَّ الكلمة أيضًا (`ра́з в` تُهمَس).',
  },

  /* ──────────────────────────────────────────────────────────────
     توسيعُ المحرّك — علمٌ فوق المنهج، لا بديلٌ عنه (بندا ٤٣ و٤٤)
     ────────────────────────────────────────────────────────────── */

  {
    id: 'ENGINE_CLUSTER_STN_NTSK',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'عناقيد تانية فيها ساكن مش بيتنطق',
    arabicExplanation: 'زيّ «стн» في «местный» و«нтск» في «гигантский».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'ме́стный', shows: 'стн → сн' },
      { word: 'гига́нтский', shows: 'нтск → нск' },
    ],
    counter: [{ word: 'сто́л', shows: 'ست عادية' }],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    notes: 'نفسُ قاعدةِ ٥ط/٥ك/٥ل/٥م، بعناقيدَ لم تُعدِّدها قائمةُ التدقيق.',
  },

  {
    id: 'ENGINE_CLUSTER_LONG_HUSHING',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'сш/зш و сж/зж — صوت واحد طويل',
    arabicExplanation: '«сш» بتتنطق «ш» طويلة، و«сж» بتتنطق «ж» طويلة.',
    terms: [TERM.HARD],
    examples: [
      { word: 'не́сший', shows: 'сш → шш' },
      { word: 'сжа́ть', shows: 'сж → жж' },
    ],
    counter: [{ word: 'ши́ть', shows: 'ш مفردة' }],
    engineRuleIds: ['RU_CLUSTER_SH_LONG', 'RU_CLUSTER_ZH_LONG'],
    status: COVERAGE.COVERED,
    notes: 'зж/жж داخل الجذر مؤجَّلةٌ صراحةً — المصدرُ نفسُه يعطي وجهين.',
  },

  {
    id: 'ENGINE_CLUSTER_TS_FAMILY',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'тс/дс قبل ‎-ск- و ‎-тся/-ться و тч/дч',
    arabicExplanation:
      '«советский» بتتقال «совецкий»، و«учиться» بتتقال «учица»، و«лётчик» بتتقال «лёчик».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'сове́тский', shows: 'тс+ск → цк' },
      { word: 'учи́ться', shows: '-ться → -ца' },
      { word: 'лётчик', shows: 'тч → ч' },
    ],
    counter: [{ word: 'то́т', shows: 'т مفردة' }],
    engineRuleIds: ['RU_CLUSTER_TS_DS', 'RU_CLUSTER_TSYA', 'RU_CLUSTER_TCH_DCH'],
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'ENGINE_GEMINATION',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'الساكن المكرَّر صوت واحد أطول',
    arabicExplanation: '«ванна» فيها «н» واحدة ممدودة، مش «ن» مرّتين.',
    terms: [TERM.CONSONANT],
    examples: [{ word: 'ва́нна', shows: 'нн → н طويلة' }],
    counter: [{ word: 'о́н', shows: 'н مفردة' }],
    engineRuleIds: ['RU_GEMINATION'],
    status: COVERAGE.COVERED,
    notes: '`PROVISIONAL`: المصدرُ يستثني بعضَ المُعرَّبات.',
  },

  {
    id: 'ENGINE_CHN_SHN',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'чн بتتنطق шн — في قائمة مغلقة بس',
    arabicExplanation: '«конечно» بتتقال «конешно». دي مش قاعدة لكل «чн».',
    terms: [],
    examples: [
      { word: 'коне́чно', shows: 'чн → шн' },
      { word: 'ску́чно', shows: 'чн → шн' },
    ],
    counter: [
      { word: 'то́чный', shows: 'чн بتفضل чн' },
      { word: 'ве́чный', shows: 'زيّها' },
    ],
    engineRuleIds: ['RU_ORTHO_CHN_SHN'],
    status: COVERAGE.LEXICAL,
    notes: 'قائمةٌ مغلقةٌ + نمطُ أسماء الآباء على ‎-ична.',
  },

  {
    id: 'ENGINE_VARIANT_CHN',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'كلمات ليها نطقين — والاتنين مقبولين',
    arabicExplanation: '«булочная» بتتقال بـ«чн» أو بـ«шн»، والمصادر مش متّفقة.',
    terms: [],
    /* ⚠️ **ولا تُطلِق قاعدةً عمدًا** — مدخَلُ `VARIANT` بلا `rewrite`،
       فلا أثرَ له في سجلّ القواعد. إثباتُه أن التحليلَ يخرج موسومًا
       `LEXICAL_EXCEPTION` بنطقَين معروضَين. */
    expectsLexical: true,
    examples: [
      { word: 'було́чная', shows: 'نطقان مقبولان' },
      { word: 'моло́чный', shows: 'زيّها' },
    ],
    counter: [],
    engineRuleIds: ['RU_LEXICAL_ORTHOEPIC_EXCEPTION'],
    status: COVERAGE.DISPUTED,
    notes: '⚠️ مدخلاتُ `VARIANT` **لا تُحوِّل شيئًا** — تُعلِّم النتيجةَ ولا تمسّها.',
  },

  {
    id: 'ENGINE_SOFTNESS_ASSIMILATION',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'ترقيق مماثِل — اختياريّ ومتغيّر',
    arabicExplanation:
      'زمان كانوا بيقولوا «сьнег» بترقيق. دلوقتي الاتنين مقبولين والأغلب بينطقها مفخمة.',
    terms: [TERM.SOFT, TERM.HARD],
    examples: [{ word: 'сне́г', shows: 'с قد تُنطق مرققة عند بعض المتحدّثين' }],
    counter: [],
    engineRuleIds: ['RU_SOFTNESS_ASSIMILATION'],
    status: COVERAGE.DISPUTED,
    notes:
      '⚠️ **تنطلق ولا تمسّ الصوت.** لو رقّقناها لعلّمنا نطقًا قديمًا على أنه '
      + 'المعيار؛ ولو سكتنا لأخفينا ظاهرةً ستسمعها. فالوسمُ ثالثُ الحلّين.',
  },

  {
    id: 'ENGINE_LOANWORD_HARD_E',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'مُعرَّبات بتفضل مفخمة قدّام е',
    arabicExplanation: '«пастель» بتتقال «пастэль» — الـ«т» فضلت مفخمة.',
    terms: [TERM.HARD],
    examples: [{ word: 'пасте́ль', shows: 'т مفخمة قدّام е' }],
    counter: [{ word: 'те́ло', shows: 'т مرققة عادي' }],
    engineRuleIds: ['RU_LOANWORD_HARD_BEFORE_E'],
    status: COVERAGE.LEXICAL,
    notes:
      'قائمةٌ قصيرةٌ عمدًا: المصدرُ نفسُه يقول «لا قواعدَ ثابتة، ارجع لمعجمٍ '
      + 'أورثوإبيّ» — ونحن لا نملك حقَّ نسخِ معجم.',
  },

  {
    id: 'ENGINE_QUANTITATIVE_REDUCTION',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'اختزال كمّي — أقصر بس الصوت متغيّرش',
    arabicExplanation:
      '«ы» و«у» و«ю» بيقصروا لما ميبقوش منبورين، بس صوتهم مبيتغيّرش زيّ «о».',
    terms: [TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'любо́вь', shows: 'ю غير منبورة — أقصر بس [u]' },
      { word: 'му́зыка', shows: 'ы غير منبورة — أقصر بس [ɨ] زيّ ما هي' },
    ],
    counter: [
      { word: 'молоко́', shows: 'о بتتغيّر فعلًا — اختزال كيفيّ مش كمّي' },
      /* ⚠️ **ونقلتُها من الأمثلة إلى هنا بعد أن أسقطت الاختبار بحقّ.**
         كتبتُ «му́жество — у منبورة» في خانة الأمثلة، وهي بذلك **مثالٌ
         مضادّ**: المنبورةُ لا تُختزَل أصلًا، لا كمًّا ولا كيفًا. */
      { word: 'му́жество', shows: 'у منبورة — مفيش اختزال', notRules: ['RU_VOWEL_QUANTITATIVE_ONLY'] },
    ],
    engineRuleIds: ['RU_VOWEL_QUANTITATIVE_ONLY'],
    status: COVERAGE.COVERED,
    notes:
      '`PROVISIONAL` بأضعفِ ادّعاءٍ ممكن: لم يصل مقتطفٌ يذكرها بأعيانها، '
      + 'فاخترنا **ألّا ندّعي تحوّلًا** أصلًا.',
  },

  {
    id: 'ENGINE_HUSHING_E_REDUCTION',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'е بعد ж/ш/ц غير منبورة',
    arabicExplanation: 'قبل النبر بتقرب من «ы»، وبعيد عنه بتبقى صوت غامض قصير.',
    terms: [TERM.REDUCED, TERM.HARD, TERM.VOWEL],
    examples: [
      { word: 'жена́', shows: 'е قبل النبر → [ɨ]' },
      { word: 'со́лнце', shows: 'е بعد النبر → [ə]' },
    ],
    counter: [{ word: 'ле́с', shows: 'е بعد مرقق — عيلة الإيكانيه' }],
    engineRuleIds: ['RU_RED_AFTER_HUSHING_E', 'RU_RED_AFTER_HUSHING_WEAK'],
    status: COVERAGE.COVERED,
    notes: '',
  },
]);

/* ================================================================== *
 * التدقيقُ الآليّ (بند ٩)
 * ================================================================== */

/** بندٌ بمعرّفه. */
export function teachingRuleById(id) {
  return TEACHING_RULES.find((t) => t.id === id) || null;
}

/** أيُّ بنودِ المنهج تُنفِّذها هذه القاعدةُ الهندسيّة؟ */
export function teachingRulesForEngineRule(ruleId) {
  return TEACHING_RULES.filter((t) => t.engineRuleIds.includes(ruleId));
}

/** بنودُ وثيقةٍ بعينها. */
export function teachingRulesForDoc(doc) {
  return TEACHING_RULES.filter((t) => t.doc === doc);
}

/**
 * **الفحصُ الذي يُسقِط اختبارًا لو اختفى بندٌ في إعادة هيكلة** (بند ٩).
 *
 * ⚠️ **ولا يفحص السلوكَ — يفحص الاتّساق.** أن تكون كلُّ قاعدةٍ مذكورةٍ
 *    في المنهج موجودةً في السجلّ فعلًا، وأن يكون لكلّ بندٍ حالةٌ صريحة،
 *    وألّا يبقى في المحرّك سلوكٌ لا يعرفه المنهج. أمّا هل تُنتج القاعدةُ
 *    الصوتَ الصحيح — فذلك عملُ الكوربوس، لا هذا.
 */
export function curriculumAudit() {
  const known = new Set(allRuleIds());
  known.add(LEXICAL_RULE.id);   /* معجميّةٌ لا تُسجَّل في السجلّ التنفيذيّ */

  const missingEngineRules = [];
  const missingStatus = [];
  const missingExamples = [];
  const referenced = new Set();

  for (const item of TEACHING_RULES) {
    for (const id of item.engineRuleIds) {
      referenced.add(id);
      if (!known.has(id)) missingEngineRules.push({ teaching: item.id, ruleId: id });
    }
    if (!Object.hasOwn(COVERAGE, item.status)) missingStatus.push(item.id);
    /*
     * ⚠️ بندٌ بلا مثالٍ بندٌ لا يُختبَر — إلّا المفاهيمَ المحضة
     *    (`CURRICULUM_ONLY`) التي لا تحوّل شيئًا لتُقاس.
     */
    if (!item.examples.length && item.status !== COVERAGE.CURRICULUM_ONLY) {
      missingExamples.push(item.id);
    }
  }

  /* قواعدُ في المحرّك لا يذكرها أيُّ بندٍ منهجيّ — فجوةُ **توثيقٍ** لا سلوك. */
  const unmappedEngineRules = allRuleIds().filter((id) => !referenced.has(id));

  return {
    missingEngineRules,
    missingStatus,
    missingExamples,
    unmappedEngineRules,
    ok: !missingEngineRules.length && !missingStatus.length
      && !missingExamples.length && !unmappedEngineRules.length,
  };
}

/** إحصاءٌ للتقرير والاختبار — بلا حسابٍ في الواجهة. */
export function curriculumStats() {
  const byStatus = {};
  const byDoc = {};
  const bySourceStatus = {};
  let examples = 0;
  let counter = 0;

  for (const item of TEACHING_RULES) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byDoc[item.doc] = (byDoc[item.doc] || 0) + 1;
    bySourceStatus[item.sourceStatus] = (bySourceStatus[item.sourceStatus] || 0) + 1;
    examples += item.examples.length;
    counter += item.counter.length;
  }
  return {
    total: TEACHING_RULES.length,
    byStatus,
    byDoc,
    bySourceStatus,
    examples,
    counter,
    lexiconEntries: Object.keys(LEXICON).length,
  };
}

/**
 * وصفُ حالةِ المصدر للعرض — **الجملةُ التي تمنع ادّعاءَ أمانةٍ بلا مصدر**.
 */
export const SOURCE_STATUS_LABEL = Object.freeze({
  PDF_VERIFIED: 'مقروء من الملفّ الأصليّ',
  PROMPT_CHECKLIST: 'من قائمة التدقيق في الطلب — الملفّ الأصليّ لسه ما وصلش',
  ENGINE_ORIGIN: 'توسيع من المحرّك — مالوش أصل في الملفّات التلاتة',
});

/** شرحُ القاعدة الهندسيّة كما يراها المنهج — لا كما يراها المطوّر. */
export function engineRuleWithTeaching(ruleId) {
  const rule = ruleById(ruleId);
  const teaching = teachingRulesForEngineRule(ruleId);
  if (!rule && !teaching.length) return null;
  return { rule, teaching };
}

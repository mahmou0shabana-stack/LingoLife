/**
 * LingoLife — منهجُ الصوتيّات الروسيّة الصريح
 * (WS58 بناءً · WS59 تحقّقًا من الملفّات الحقيقيّة)
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
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وهذه النسخةُ مقروءةٌ من الملفّات نفسِها** (WS59)
 * ═══════════════════════════════════════════════════════════════
 *
 * بُنيت طبقةُ المنهج في WS58 من **قائمة التدقيق في الطلب** لأن الملفّات
 * لم تكن قد وصلت. وقد وصلت الآن، فقُرئت الصفحاتُ التسعُ كلُّها، وأُعيد
 * اشتقاقُ كلّ بندٍ من الصفحة لا من القائمة. والنصُّ الخامُّ محفوظٌ في
 * `docs/sources/` ليقارن مَن شاء.
 *
 * وما تغيّر ليس عددًا في تقرير:
 *
 *  · **الأمثلةُ كانت من عندي.** كتبتُ للترقيق «лес، тихо، соль» —
 *    ولا واحدةَ منها في الملفّ. والملفُّ يعلّم بـ**أزواجٍ متقابلة**:
 *    `ма́ма` مفخّمة مقابل `ме́ч` مرقّقة، `ла́мпа` مقابل `лист`،
 *    `ру́чка` مقابل `слова́рь`. والزوجُ **هو** الدرس: أن تسمع نفسَ
 *    الحرف مرّتين فتعرف الفرق. ومثالي المنفردُ كان يشرح ولا يُسمِع.
 *
 *  · **صياغةُ الاختزال كانت صياغتي لا صياغتَه.** كتبتُ «وفيه درجتين:
 *    اللي قبل النبر أوضح من اللي بعيدة» — والملفُّ يقول جملةً واحدةً
 *    بسيطة: «إذا لم يكن عليه النبر ينطق ( а )». الدرجتان معرفةُ
 *    **المحرّك**، وقد تسرّبت إلى الطبقة التعليميّة فادّعت أن المعلّمة
 *    قالتها. فرُدَّت إلى موضعها.
 *
 *  · **بنودٌ لم تكن في القائمة أصلًا**: «الحرف بدون نبر ينطق قصيرًا
 *    وبسرعة»، و«е المنبورة تُنطَق э في معظم الكلمات وе في بعضها»،
 *    وزوجُ `му́ка`/`мука́`، ومثالُ `ого́нь` المضادّ.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وحالةُ المصدر ≠ نضجُ المحرّك** (بند ٢٢ من الطلب)
 * ═══════════════════════════════════════════════════════════════
 *
 * `sourceStatus` يجيب: **هل يطلب الملفُّ تعليمَ هذا؟**
 * و`status` في سجلّ القواعد يجيب: **هل الدليلُ العلميُّ كافٍ لهذا
 * التحويل بعينه؟** سؤالان مختلفان، ولا يُرقّي أحدُهما الآخر.
 *
 * فملفٌّ يذكر «гк تُنطَق хк» **يُثبِت أنك تريد تعليمَها**، ولا يُثبِت
 * حدودَ الظاهرة ولا رمزَها الصوتيَّ الدقيق. ولذلك بقيت
 * `RU_ORTHO_GK_HK` مبدئيّةً بعد التحقّق كما كانت قبله.
 */

import { allRuleIds, ruleById } from './rule-registry.js';
import { LEXICON, LEXICAL_RULE } from './pronunciation-lexicon.js';

/* ================================================================== *
 * المفردات
 * ================================================================== */

/** الوثائقُ الثلاث — بعناوينها ومواضعها. */
export const SOURCE_DOC = Object.freeze({
  NOTES: 'ملحوظات صوتية',
  STRESS: 'النبر',
  VOICING: 'الأصوات المجهورة والمهموسة',
  /** ما لا أصلَ له في الوثائق الثلاث — توسيعُ المحرّك (بند ٤٤). */
  ENGINE: 'توسيع المحرّك',
});

/** بياناتُ الملفّات كما وصلت — للتقرير وللتتبّع (بند ١١). */
export const PDF_SOURCES = Object.freeze([
  {
    doc: SOURCE_DOC.NOTES,
    file: 'ملحوظات صوتية.pdf',
    pages: 4,
    author: 'أ / هبه الإبياري',
    raw: 'docs/sources/01-ملحوظات-صوتية.txt',
  },
  {
    doc: SOURCE_DOC.STRESS,
    file: 'النبر.pdf',
    pages: 3,
    author: 'أ / هبه الإبياري',
    raw: 'docs/sources/02-النبر.txt',
  },
  {
    doc: SOURCE_DOC.VOICING,
    file: 'الأصوات المجهورة و المهموسة.pdf',
    pages: 2,
    author: 'أ / هبه الإبياري',
    raw: 'docs/sources/03-الأصوات-المجهورة-والمهموسة.txt',
  },
]);

/**
 * حالةُ التغطية — **سبعُ حالاتٍ صريحة، ولا «غالبًا مغطّاة»** (بند ٨).
 */
export const COVERAGE = Object.freeze({
  COVERED: 'COVERED',
  PARTIAL: 'PARTIAL',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  CURRICULUM_ONLY: 'CURRICULUM_ONLY',
  ENGINE_MORE_PRECISE: 'ENGINE_MORE_PRECISE',
  DISPUTED: 'DISPUTED',
  LEXICAL: 'LEXICAL',
});

/** أصلُ البند: مطلوبٌ من المنهج، أم توسيعٌ علميٌّ فوقه (بند ٤٣). */
export const PROVENANCE = Object.freeze({
  SOURCE_REQUIRED: 'SOURCE_REQUIRED',
  ENGINE_EXPANSION: 'ENGINE_EXPANSION',
});

/**
 * من أين جاء **نصُّ** البند — لا من أين جاء تنفيذُه (بند ٢٢).
 *
 * ⚠️ **و`PROMPT_CHECKLIST` اختفت من هذا الجدول عمدًا.** كانت حالةً
 *    مؤقّتةً معناها «الملفُّ لم يصل»؛ وقد وصل. فكلُّ بندٍ اليوم إمّا
 *    مقروءٌ من صفحةٍ بعينها، أو **مُعلَنٌ أنه ليس في الملفّ**.
 */
export const SOURCE_STATUS = Object.freeze({
  /** قُرئ من الملفّ، وصفحتُه مسجَّلة. */
  PDF_VERIFIED: 'PDF_VERIFIED',
  /** كان في قائمة التدقيق ولم يُوجَد في الملفّ — لا يُدَّعى تحقّقُه. */
  PROMPT_ONLY: 'PROMPT_ONLY',
  /** بُحث عنه في الملفّ ولم يوجد أثرٌ له. */
  NOT_FOUND_IN_PDF: 'NOT_FOUND_IN_PDF',
  /** لا أصلَ منهجيًّا له — توسيعُ محرّك. */
  ENGINE_ORIGIN: 'ENGINE_ORIGIN',
});

/**
 * المصطلحاتُ العربيّةُ الإلزاميّة (بند ٣) — **وكلُّها في الملفّات فعلًا**.
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

/**
 * بنودُ WS58 التي **قسّمها المصدرُ إلى أدقّ منها** (بند ٢٤).
 *
 * ⚠️ **ولا يُحذَف معرِّفٌ بصمت.** البندُ القديم لم يكن خطأً — كان
 *    **أخشنَ من المصدر**: الملفُّ يفصل `я` إلى ثلاث حالاتٍ بأمثلةٍ
 *    مستقلّة، و`е` إلى ثلاث. فبدل توسيعِ بندٍ واحدٍ حتى يفقد معناه،
 *    يُقسَّم — ويبقى أثرُ القسمة هنا حتى يعرف قارئُ الغد أين ذهب.
 */
export const SUPERSEDED = Object.freeze({
  TEACH_YA_STRESS: ['TEACH_YA_STRESSED', 'TEACH_YA_UNSTRESSED_INITIAL', 'TEACH_YA_UNSTRESSED_MEDIAL'],
  TEACH_E_STRESS_POSITIONS: ['TEACH_E_STRESSED', 'TEACH_E_BEFORE_STRESS', 'TEACH_E_AFTER_STRESS'],
});

/* ================================================================== *
 * بنودُ المنهج
 * ================================================================== */

/**
 * كلُّ بندٍ تعليميٍّ في الوثائق الثلاث + توسيعاتُ المحرّك فوقها.
 *
 * الحقول:
 *  · `id`            معرِّفٌ ثابتٌ لا يتغيّر بإعادة الصياغة.
 *  · `doc`/`page`    الوثيقةُ والصفحةُ — فيُعاد إلى الموضع (بند ١١).
 *  · `sourceText`    **نصُّ المصدر حرفيًّا** — لا صياغتي.
 *  · `arabicExplanation` شرحٌ للمتعلّم قد يوسّع نصَّ المصدر ولا يناقضه.
 *  · `examples`      وكلُّ مثالٍ يحمل `fromSource` — فلا يختلط
 *                    مثالُ المعلّمة بمثالٍ أضفتُه أنا (بند ٩).
 *  · `gloss`         معنى الكلمة **كما كتبته المعلّمة** حيث ذكرته.
 *  · `divergence`    حيث يفترق المصدرُ عن المحرّك — يُكتَب ولا يُخفى.
 */
export const TEACHING_RULES = Object.freeze([

  /* ──────────────────────────────────────────────────────────────
     الوثيقةُ الأولى — ملحوظات صوتية · ٤ صفحات · ١٤ بندًا
     ────────────────────────────────────────────────────────────── */

  {
    id: 'TEACH_SOFTENING_LETTERS',
    doc: SOURCE_DOC.NOTES,
    page: 1,
    section: 'الحروف التي ترقق الحرف الساكن الذي يأتي قبلها',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'الحروف التي ترقق الحرف الساكن الذي يأتي قبلها',
    sourceText: 'الحروف التي ترقق الحرف الساكن الذي يأتي قبلها: '
      + 'أصوات اليوت ( е - ё - я - ю ) — и — ь',
    arabicExplanation:
      'الحروف دي بترقّق الحرف الساكن اللي قبلها: أصوات اليوت (е ё я ю)، '
      + 'وكمان (и)، وعلامة (ь).\n'
      + 'وأحسن طريقة تحسّ بالفرق: اسمع نفس الحرف مرّتين — مرّة مفخم ومرّة مرقق.',
    terms: [TERM.SOFT, TERM.HARD, TERM.CONSONANT],
    /*
     * ⚠️ **أزواجٌ لا مفردات — وهذا اختيارُ المعلّمة لا اختياري.**
     *    الملفُّ يضع لكلّ ساكنٍ مثالَين: مفخّمًا ومرقّقًا. والفرقُ
     *    بينهما هو الدرس؛ ومثالٌ مفردٌ يصف الليونةَ ولا يُسمِعها.
     */
    examples: [
      { word: 'ма́ма', gloss: 'ماما', shows: 'صوت м مفخم', fromSource: true,
        pairWith: 'ме́ч', expectHardness: { letter: 'м', label: 'مفخم' } },
      { word: 'ме́ч', gloss: 'سيف', shows: 'صوت м مرقق', fromSource: true,
        expectHardness: { letter: 'м', label: 'مرقق' } },
      { word: 'ла́мпа', gloss: 'لمبة — مصباح', shows: 'صوت л مفخم', fromSource: true,
        pairWith: 'ли́ст', expectHardness: { letter: 'л', label: 'مفخم' } },
      { word: 'ли́ст', gloss: 'ورقة شجر', shows: 'صوت л مرقق', fromSource: true,
        expectHardness: { letter: 'л', label: 'مرقق' } },
      { word: 'ру́чка', gloss: 'قلم جاف', shows: 'صوت р مفخم', fromSource: true,
        pairWith: 'слова́рь', expectHardness: { letter: 'р', label: 'مفخم' } },
      { word: 'слова́рь', gloss: 'قاموس', shows: 'صوت р مرقق', fromSource: true,
        expectHardness: { letter: 'р', label: 'مرقق' } },
    ],
    counter: [
      { word: 'жи́знь', shows: 'ж فضل مفخم رغم и بعده', fromSource: false,
        notRules: ['RU_PALATALIZATION_BY_VOWEL'] },
    ],
    engineRuleIds: ['RU_PALATALIZATION_BY_VOWEL', 'RU_PALATALIZATION_BY_SOFT_SIGN'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      'الأزواجُ الستّةُ كلُّها تمرّ: `ма́ма` [m] مقابل `ме́ч` [mʲ]، '
      + '`ла́мпа` [ɫ] مقابل `ли́ст` [lʲ]، `ру́чка` [r] مقابل `слова́рь` [rʲ]. '
      + '⚠️ وأمثلةُ WS58 (лес/тихо/соль/مясо/нёс/люди) لم تكن من الملفّ — '
      + 'أُزيلت وحلّت محلَّها أزواجُ المصدر.',
  },

  {
    id: 'TEACH_ALWAYS_HARD',
    doc: SOURCE_DOC.NOTES,
    page: 1,
    section: 'الحروف ( ш - ж - ц ) دائما مفخمين',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'ш · ж · ц — دائما مفخمين',
    sourceText: 'الحروف ( ш - ж - ц ) دائما مفخمين . '
      + 'و إذا جاء بعدهم حرف ( и ) ينطق ( ы )',
    arabicExplanation:
      'التلاتة دول مفخمين على طول. ولو جه بعدهم حرف (и) بيتنطق (ы).',
    terms: [TERM.HARD, TERM.CONSONANT],
    examples: [
      { word: 'оши́бка', gloss: 'خطأ', shows: 'и بعد ш بتتنطق ы', fromSource: true },
      { word: 'жизнь', gloss: 'حياة', shows: 'и بعد ж بتتنطق ы', fromSource: true },
      { word: 'цирк', gloss: 'سيرك', shows: 'и بعد ц بتتنطق ы', fromSource: true },
    ],
    counter: [
      { word: 'ме́ч', shows: 'ч مرقق — مش من العيلة دي', fromSource: true },
    ],
    engineRuleIds: ['RU_CONS_ALWAYS_HARD'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '⚠️ «и بعدهم تُنطَق ы» منفَّذةٌ في `buildSegments` لا في قاعدةٍ مسجَّلة — '
      + 'أثرٌ مباشرٌ للصلابة لا قاعدةٌ مستقلّة. مغطّاةٌ باختبارٍ صريح على '
      + 'أمثلة المصدر الثلاثة، ومذكورةٌ هنا حتى لا تُحسَب تغطيةً ضمنيّة.',
  },

  {
    id: 'TEACH_ALWAYS_SOFT',
    doc: SOURCE_DOC.NOTES,
    page: 2,
    section: 'الحروف ( ч - щ ) دائما مرققين',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'ч · щ — دائما مرققين',
    sourceText: 'الحروف ( ч - щ ) دائما مرققين',
    arabicExplanation: 'الاتنين دول مرققين على طول، حتى قدّام (а) و(о) و(у).',
    terms: [TERM.SOFT, TERM.CONSONANT],
    examples: [
      { word: 'ме́ч', gloss: 'سيف', shows: 'ч مرقق في آخر الكلمة', fromSource: true },
      { word: 'щётка', gloss: 'فرشاة', shows: 'щ مرقق قدّام ё', fromSource: true },
    ],
    counter: [
      { word: 'жизнь', shows: 'ж مفخم — العيلة التانية', fromSource: true },
    ],
    engineRuleIds: ['RU_CONS_ALWAYS_SOFT'],
    status: COVERAGE.COVERED,
    divergence:
      'المحرّك يضمّ `й` إلى العائلة نفسِها (`ALWAYS_SOFT = чщй`) والملفُّ '
      + 'يذكر `ч` و`щ` فقط — توسيعٌ صحيحٌ فوق المصدر، لا مخالفةٌ له.',
    notes: '',
  },

  {
    id: 'TEACH_A_AFTER_CH_SHCH',
    doc: SOURCE_DOC.NOTES,
    page: 2,
    section: 'حرف ( а ) بعد ( ч ) أو ( щ ) بدون نبر',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'а بعد ч أو щ من غير نبر تُنطَق и',
    sourceText: 'إذا جاء حرف ( а ) بعد حرف ( ч ) أو ( щ ) '
      + 'و لم يكن حرف ( а ) عليه النبر ينطق ( и )',
    arabicExplanation:
      'لو حرف (а) جه بعد (ч) أو (щ) ومكانش عليه النبر — بيتنطق (и).',
    terms: [TERM.SOFT, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'часы́', gloss: 'ساعة يد — ساعة حائط', shows: 'а بعد ч من غير نبر → и', fromSource: true },
      { word: 'пло́щадь', gloss: 'ميدان', shows: 'а بعد щ من غير نبر → и', fromSource: true },
    ],
    counter: [
      { word: 'ча́с', shows: 'а عليها النبر — متتغيّرش', fromSource: false,
        notRules: ['RU_RED_SOFT_IKANYE'] },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE'],
    status: COVERAGE.COVERED,
    divergence:
      '⚠️ **صياغةُ WS58 كانت أوسعَ من المصدر.** كتبتُ «سلوك الحركة بعد ч/щ» '
      + 'عمومًا؛ والملفُّ يخصّ **حرف `а` غيرَ المنبور** بعدهما تحديدًا. '
      + 'وقاعدةُ المحرّك (`RU_RED_SOFT_IKANYE`) أوسعُ من الاثنين — تشمل '
      + '`е` و`я` و`и` بعد أيّ مرقَّق — وهو توسيعٌ صحيحٌ يبقى.',
    notes: 'مثالُ WS58 «щавель» لم يكن من الملفّ؛ حلّ محلَّه `пло́щадь`.',
  },

  {
    id: 'TEACH_GO_ENDING_V',
    doc: SOURCE_DOC.NOTES,
    page: 2,
    section: 'حرف ( г ) بين е و о أو بين о و о',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'г في ( его ) و( ого ) تُنطَق в — وأحيانًا تبقى г',
    sourceText: 'حرف ( г ) إذا جاء بين е و о بهذا الشكل ( его ) '
      + 'أو بين о و о ( ого ) يتم نطقه ( в ) . '
      + 'و لكن أحيانا ينطق بصوته الأصلي ( г )',
    arabicExplanation:
      'حرف (г) لمّا يجي في (его) أو (ого) بيتنطق (в). '
      + 'بس مش دايمًا — في كلمات بيفضل (г) زيّ ما هو.',
    terms: [TERM.VOICED, TERM.CONSONANT],
    examples: [
      { word: 'сего́дня', gloss: 'النهاردة', shows: 'حرف г ينطق в', fromSource: true },
      { word: 'но́вого', gloss: 'جديد ( في حالة الإضافة )', shows: 'حرف г ينطق в', fromSource: true },
    ],
    /*
     * ⚠️ **والملفُّ يعطي المثالَين المضادَّين بنفسِه** — وهذا أثمنُ ما
     *    في هذا البند. `ого́нь` فيها «ого» في **أوّل** الكلمة، و`мно́го`
     *    فيها «ого» في آخرها وليست نهايةً صرفيّة. فالمعلّمةُ لا تقول
     *    «القاعدة» فحسب، بل تقول **أين لا تنطبق** — وهو بالضبط ما
     *    يحرسه شرطُ المحرّك وقائمةُ منعِه.
     */
    counter: [
      { word: 'ого́нь', gloss: 'نار — حريق', shows: 'حرف г ينطق г كما هو', fromSource: true },
      { word: 'мно́го', gloss: 'كثيرا — الكثير من', shows: 'حرف г ينطق г كما هو', fromSource: true },
    ],
    engineRuleIds: ['RU_ORTHO_GO_ENDING', 'RU_LEXICAL_ORTHOEPIC_EXCEPTION'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      'المثالان المضادّان يمرّان لسببين مختلفين: `ого́нь` لأن الشرط نهايةُ '
      + 'كلمةٍ (`(?:ог|ег)о$`) وهي تبدأ بها لا تنتهي؛ و`мно́го` بقائمة المنع '
      + '`GO_ENDING_EXCLUSIONS`. و`сего́дня` مدخَلٌ معجميٌّ لأن الـ`г` فيها '
      + 'داخل الكلمة لا في آخرها.',
  },

  {
    id: 'TEACH_GK_HK',
    doc: SOURCE_DOC.NOTES,
    page: 2,
    section: '( гк ) يتم نطقهم ( хк )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'гк تُنطَق хк',
    sourceText: '( гк ) يتم نطقهم ( хк )',
    arabicExplanation: 'الحرفين (гк) بيتنطقوا (хк) — الـ«г» بتبقى «х».',
    terms: [TERM.VOICELESS, TERM.CONSONANT],
    examples: [
      { word: 'лёгкий', gloss: 'سهل', shows: 'гк → хк', fromSource: true },
      { word: 'мя́гкий', gloss: 'مя́гкий знак ( ь )', shows: 'гк → хк', fromSource: true },
    ],
    counter: [
      { word: 'мно́го', shows: 'г عادية — مفيش гк', fromSource: true },
    ],
    engineRuleIds: ['RU_ORTHO_GK_HK'],
    status: COVERAGE.COVERED,
    divergence:
      'الملفُّ يذكر `гк` وحدَها؛ والمحرّك يعالج `гч` أيضًا (`ле́гче`، `мя́гче`) '
      + '— توسيعٌ فوق المصدر مسجَّلٌ في `ENGINE_GK_HCH_EXTENSION`.',
    notes:
      '⚠️ وحالةُ القاعدة في المحرّك `PROVISIONAL` **ولم تتغيّر بالتحقّق** '
      + '(بند ٢٣): الملفُّ يُثبِت أنك تريد تعليمَها، ولا يُثبِت حدودَ '
      + 'الظاهرة — وهي مقيَّدةٌ بجذرَي лёг-/мяг- لأن التعميم لم يصل عليه دليل.',
  },

  {
    id: 'TEACH_VH_FH',
    doc: SOURCE_DOC.NOTES,
    page: 3,
    section: '( вх ) يتم نطقهم ( фх )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'вх تُنطَق фх',
    sourceText: '( вх ) يتم نطقهم ( фх )',
    arabicExplanation: 'الـ(в) بتفقد جهرها قدّام (х) المهموسة.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'вход', gloss: 'مدخل', shows: 'в → ф قدّام х', fromSource: true },
    ],
    counter: [
      { word: 'вода́', shows: 'в فضلت مجهورة قدّام حرف متحرك', fromSource: true },
    ],
    engineRuleIds: ['RU_REGRESSIVE_DEVOICING'],
    status: COVERAGE.ENGINE_MORE_PRECISE,
    divergence:
      'الملفُّ يعطي العنقودَ `вх` بعينه؛ والمحرّك ينفّذه بقاعدةِ المماثلة '
      + 'الرجعيّة العامّة — أعمُّ وأصدق: نفسُ السببِ يفسّر `всегда́` و`вчера́`. '
      + '(بند ١١: المثالُ يُثبِت التغطيةَ ولا يُعرِّف التنفيذ.)',
    notes: '`вход` → `фхо́т` — والـ`д` النهائيّةُ تُهمَس أيضًا بقاعدةٍ أخرى.',
  },

  {
    id: 'TEACH_SCH_TO_SHCH',
    doc: SOURCE_DOC.NOTES,
    page: 3,
    section: '( сч ) يتم نطقهم ( щ )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'сч تُنطَق щ',
    sourceText: '( сч ) يتم نطقهم ( щ )',
    arabicExplanation: '«сч» بتتنطق صوت واحد طويل مرقق زيّ «щ».',
    terms: [TERM.SOFT],
    examples: [
      { word: 'сча́стье', gloss: 'سعادة', shows: 'сч → щ', fromSource: true },
    ],
    counter: [
      { word: 'ру́чка', shows: 'ч من غير с قبلها', fromSource: true },
    ],
    engineRuleIds: ['RU_CLUSTER_SCH_ZCH'],
    status: COVERAGE.COVERED,
    divergence:
      'المحرّك يعالج `зч` أيضًا (`во́зчик`) والملفُّ يذكر `сч` وحدَها — توسيع.',
    notes: '',
  },

  {
    id: 'TEACH_STL_SL',
    doc: SOURCE_DOC.NOTES,
    page: 3,
    section: '( стл ) يتم نطقهم ( сл )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'стл تُنطَق сл',
    sourceText: '( стл ) يتم نطقهم ( сл ) — счастли́вый — '
      + '( сч يتم نطقهم щ ) ( حرف а يتم نطقه и )',
    arabicExplanation:
      'الـ(т) في (стл) مبتتنطقش.\n'
      + 'وكلمة «счастли́вый» فيها **تلات ظواهر مع بعض**: стл بقت сл، '
      + 'و сч بقت щ، و а بقت и.',
    terms: [TERM.CONSONANT, TERM.REDUCED],
    /*
     * ⚠️ **والملفُّ يشرح الكلمةَ الواحدةَ بثلاث ظواهر — وهذا يستحقّ
     *    اختبارًا واحدًا يفحص الثلاثةَ معًا**، لا ثلاثةَ اختباراتٍ
     *    منفصلة. لأن السؤال الحقيقيّ هو: هل تتراكم القواعدُ على كلمةٍ
     *    واحدةٍ بالترتيب الصحيح؟
     */
    examples: [
      { word: 'счастли́вый', gloss: 'سعيد', shows: 'стل→сл + сч→щ + а→и معًا', fromSource: true },
    ],
    counter: [
      { word: 'стла́ть', shows: 'стл في أوّل الكلمة — بتتنطق كاملة', fromSource: false },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '`счастли́вый` → `щисл\'и́вый` [ɕːɪˈslʲivɨj] — الظواهرُ الثلاثُ '
      + 'تظهر كلُّها في مخرَجٍ واحد، وهو ما يطلبه الملفُّ حرفيًّا.',
  },

  {
    id: 'TEACH_VSTV_LOSS',
    doc: SOURCE_DOC.NOTES,
    page: 3,
    section: '( вств ) يتم نطقهم ( ств )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'вств تُنطَق ств',
    sourceText: '( вств ) يتم نطقهم ( ств )',
    arabicExplanation: 'أوّل (в) في (вств) مبتتنطقش.',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'здра́вствуйте', gloss: 'مرحبا', shows: 'в الأولى ساقطة', fromSource: true },
      { word: 'чу́вство', gloss: 'إحساس', shows: 'в الأولى ساقطة', fromSource: true },
    ],
    counter: [
      { word: 'свет', shows: 'в بتتنطق عادي — مفيش вств', fromSource: true },
    ],
    engineRuleIds: ['RU_LEXICAL_ORTHOEPIC_EXCEPTION'],
    status: COVERAGE.LEXICAL,
    divergence:
      '⚠️ **الملفُّ يذكرها قاعدةَ عنقودٍ عامّة، والمحرّك ينفّذها معجميًّا** '
      + 'بمدخلَين هما بالضبط مثالا الملفّ. ولم أعمّمها بعد التحقّق (بند ١٤): '
      + 'عنقودُ `вств` ليس مطّردًا في الروسيّة، وتعميمُه يُسقِط كلماتٍ لا '
      + 'تسقط فيها الـ`в`. فالتغطيةُ كاملةٌ لمثالَي المصدر، والفرقُ مكتوبٌ '
      + 'لا مخفيّ.',
    notes: '',
  },

  {
    id: 'TEACH_ZDN_ZN',
    doc: SOURCE_DOC.NOTES,
    page: 3,
    section: '( здн ) يتم نطقهم ( зн )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'здн تُنطَق зн',
    sourceText: '( здн ) يتم نطقهم ( зн )',
    arabicExplanation: 'الـ(д) مكتوبة ومش بتتنطق.',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'пра́здник', gloss: 'عيد — حفلة — احتفال', shows: 'здн → зн', fromSource: true },
      { word: 'по́здно', gloss: 'متأخرا', shows: 'здн → зн', fromSource: true },
    ],
    counter: [
      { word: 'зда́ние', shows: 'зд من غير н — بتتنطق كاملة', fromSource: false },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes: '',
  },

  {
    id: 'TEACH_LNC_NC',
    doc: SOURCE_DOC.NOTES,
    page: 4,
    section: '( лнц ) يتم نطقهم ( нц )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'лнц تُنطَق нц',
    sourceText: '( лнц ) يتم نطقهم ( нц )',
    arabicExplanation: 'الـ(л) مبتتنطقش.',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'со́лнце', gloss: 'شمس', shows: 'лнц → нц', fromSource: true },
    ],
    counter: [
      { word: 'ла́мпа', shows: 'л بتتنطق عادي', fromSource: true },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes: '',
  },

  {
    id: 'TEACH_RDC_RC',
    doc: SOURCE_DOC.NOTES,
    page: 4,
    section: '( рдц ) يتم نطقهم ( рц )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'рдц تُنطَق рц',
    sourceText: '( рдц ) يتم نطقهم ( рц )',
    arabicExplanation: 'الـ(д) مبتتنطقش.',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'се́рдце', gloss: 'قلب', shows: 'рдц → рц', fromSource: true },
    ],
    counter: [
      { word: 'ру́чка', shows: 'р عادية — مفيش рдц', fromSource: true },
    ],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes: '',
  },

  {
    id: 'TEACH_ZHCH_SHCH',
    doc: SOURCE_DOC.NOTES,
    page: 4,
    section: '( жч ) يتم نطقهم ( щ )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'жч تُنطَق щ',
    sourceText: '( жч ) يتم نطقهم ( щ )',
    arabicExplanation: '«жч» بتتنطق صوت واحد طويل مرقق زيّ «щ».',
    terms: [TERM.SOFT],
    examples: [
      { word: 'мужчи́на', gloss: 'رجل', shows: 'жч → щ', fromSource: true },
    ],
    counter: [
      { word: 'жизнь', shows: 'ж لوحدها — مفيش تغيير', fromSource: true },
    ],
    engineRuleIds: ['RU_CLUSTER_ZHCH_SHCH'],
    status: COVERAGE.COVERED,
    divergence:
      'المحرّك يعالج `шч` أيضًا (`весну́шчатый`) والملفُّ يذكر `жч` وحدَها.',
    notes:
      '⚠️ **والقاعدةُ تبقى `PROVISIONAL` بعد التحقّق** (بند ٢٣). الملفُّ '
      + 'يُثبِت أنّ الظاهرةَ مطلوبةُ التعليم — وهو ما كان ينقصها في WS58 — '
      + 'ولا يُثبِت الرمزَ الصوتيَّ [ɕː] ولا حدودَ العنقود. وصفحاتُ المصادر '
      + 'الأكاديميّة ما زالت محجوبةً عن هذه البيئة.',
  },

  /* ──────────────────────────────────────────────────────────────
     الوثيقةُ الثانية — النبر Ударе́ние · ٣ صفحات · ١٤ بندًا
     ────────────────────────────────────────────────────────────── */

  {
    id: 'TEACH_STRESS_WHAT',
    doc: SOURCE_DOC.STRESS,
    page: 1,
    section: 'النبر Ударе́ние',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'النبر إيه؟',
    sourceText: 'النبر هو شرطة مائلة توضع فوق حرف متحرك واحد فقط في الكلمة '
      + 'و تعطيه قوة و مد في النطق',
    arabicExplanation:
      'النبر شرطة مائلة بتتحطّ فوق **حرف متحرك واحد بس** في الكلمة، '
      + 'وبتدّيه قوّة ومدّ في النطق.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'рабо́та', gloss: 'عمل', shows: 'النبر على о التانية', fromSource: true },
      { word: 'ва́за', gloss: 'فازة — زهرية', shows: 'النبر على а الأولى', fromSource: true },
      { word: 'са́хар', gloss: 'سكر', shows: 'النبر على а الأولى', fromSource: true },
    ],
    counter: [],
    engineRuleIds: ['RU_VOWEL_STRESSED'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      'المحرّك يعطي رقمَ الحركة ورقمَ المقطع والمجموع — لا مجرّد علامة. '
      + 'والنبرُ يُخزَّن **رقمَ حركةٍ** لا موضعَ حرف، فيبقى صحيحًا بعد إعادة الكتابة.',
  },

  {
    id: 'TEACH_UNSTRESSED_SHORT',
    doc: SOURCE_DOC.STRESS,
    page: 1,
    section: 'النبر Ударе́ние',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'الحرف المتحرك من غير نبر: قصير وسريع',
    sourceText: 'أي حرف متحرك بدون علامة النبر ينطق بشكل قصير و بسرعة',
    arabicExplanation:
      'أيّ حرف متحرك ملوش نبر بيتنطق **قصير وبسرعة** — مش بنفس القوّة.',
    terms: [TERM.STRESS, TERM.VOWEL, TERM.REDUCED],
    /*
     * ⚠️ **بندٌ جديدٌ لم تكن قائمةُ التدقيق تعرفه** — وهو أساسُ فكرة
     *    «الاختزال» كلِّها في المصدر. المعلّمةُ تصف **الطولَ والسرعةَ**
     *    قبل أن تصف تغيّرَ الجرس؛ والمحرّكُ يسمّي ذلك «اختزالًا كمّيًّا»
     *    حين لا يتغيّر الجرس، و«كيفيًّا» حين يتغيّر.
     */
    examples: [
      { word: 'рабо́та', gloss: 'عمل', shows: 'الـ а والـ о الأولى أقصر من المنبورة', fromSource: true },
      { word: 'му́ка', gloss: 'عذاب', shows: 'الـ а الأخيرة قصيرة', fromSource: true },
    ],
    counter: [],
    engineRuleIds: ['RU_VOWEL_QUANTITATIVE_ONLY', 'RU_RED_A_O_WEAK', 'RU_RED_A_O_PRETONIC1'],
    status: COVERAGE.ENGINE_MORE_PRECISE,
    divergence:
      'الملفُّ يصف **قِصَرًا وسرعة** فحسب؛ والمحرّك يفرّق بين اختزالٍ '
      + '**كمّيّ** (أقصر والجرسُ كما هو: `ы у ю`) واختزالٍ **كيفيّ** '
      + '(الجرسُ نفسُه يتغيّر: `а о е я`). الوصفان لا يتناقضان — الثاني أدقّ.',
    notes: '',
  },

  {
    id: 'TEACH_STRESS_LEARN_WITH_WORD',
    doc: SOURCE_DOC.STRESS,
    page: 1,
    section: 'النبر Ударе́ние',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'احفظ الكلمة بموقع نبرها',
    sourceText: 'يجب حفظ الكلمات بموقع النبر الصحيح عن طريق مد الصوت في '
      + 'الحرف المتحرك صاحب النبر',
    arabicExplanation:
      'مفيش قاعدة بتقولك النبر فين. لازم تحفظ الكلمة بموقع نبرها — '
      + 'وأسهل طريقة إنك **تمدّ صوتك** في الحرف المتحرك اللي عليه النبر.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'рабо́та', gloss: 'عمل', shows: 'مدّ الـ о المنبورة', fromSource: true },
      { word: 'ва́за', gloss: 'فازة — زهرية', shows: 'مدّ الـ а المنبورة', fromSource: true },
      { word: 'са́хар', gloss: 'سكر', shows: 'مدّ الـ а الأولى', fromSource: true },
    ],
    counter: [],
    engineRuleIds: [],
    status: COVERAGE.CURRICULUM_ONLY,
    divergence: null,
    notes:
      '⚠️ **ولا قاعدةَ محرّكٍ هنا عمدًا.** البندُ ٤١ صريح: `StressResolver` '
      + 'هو مصدرُ الحقيقة الوحيد، ولا يُبنى له نظيرٌ للمنهج. فالمنهجُ '
      + '**يستهلكه** ولا يوازيه: ٥٠٧ آلاف صيغةٍ بلا إنترنت، وأولويّةٌ '
      + 'صريحةٌ من تحديدك أنت إلى المعجم إلى «مجهول».\n'
      + 'ونصيحةُ «مدّ الصوت» تُنفَّذ عمليًّا في «تدريب النطق» — البطيءُ '
      + 'المتّصلُ يفعل بالضبط ما تصفه المعلّمة.',
  },

  {
    id: 'TEACH_STRESS_AFFECTS_VOWELS',
    doc: SOURCE_DOC.STRESS,
    page: 1,
    section: 'بعض الحروف المتحركة يتأثر نطقها حسب موقع النبر',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'موقع النبر بيغيّر نطق بعض الحروف المتحركة',
    sourceText: 'بعض الحروف المتحركة يتأثر نطقها حسب موقع النبر في الكلمة',
    arabicExplanation:
      'مش كل الحروف المتحركة بتتأثّر بالنبر بنفس الدرجة. فيه حروف '
      + '(о · я · е) نطقها بيتغيّر حسب مكان النبر، وحروف تانية بتقصر بس.',
    terms: [TERM.STRESS, TERM.VOWEL, TERM.REDUCED],
    examples: [
      { word: 'окно́', gloss: 'شباك', shows: 'о غير منبورة بتتغيّر', fromSource: true },
      { word: 'му́ка', gloss: 'عذاب', shows: 'у منبورة، а غير منبورة', fromSource: true },
    ],
    counter: [],
    engineRuleIds: ['RU_VOWEL_STRESSED', 'RU_VOWEL_QUANTITATIVE_ONLY'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      'جملةٌ تمهيديّةٌ في الملفّ تُقدِّم أقسام о و я و е. أُدرجت بندًا '
      + 'مستقلًّا لأنها **ملاحظةٌ صريحة** لا عنوانًا: تقول إن التأثّرَ '
      + 'انتقائيٌّ لا عامّ — وهو ما ينفّذه المحرّك بالضبط.',
  },

  {
    id: 'TEACH_O_WITH_WITHOUT_STRESS',
    doc: SOURCE_DOC.STRESS,
    page: 1,
    section: 'حرف ( о )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'حرف о — منبور وغير منبور',
    sourceText: 'حرف ( о ): إذا كان عليه النبر ينطق ( о ) '
      + 'و إذا لم يكن عليه النبر ينطق ( а )',
    arabicExplanation:
      'الـ(о) اللي عليها النبر بتتنطق (о). واللي مالهاش نبر بتتنطق (а).',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'окно́', gloss: 'شباك', shows: 'о الأولى من غير نبر → а', fromSource: true },
      { word: 'вода́', gloss: 'ماء', shows: 'о من غير نبر → а', fromSource: true },
      { word: 'сло́во', gloss: 'كلمة', shows: 'о الأولى منبورة، التانية لأ', fromSource: true },
      { word: 'Москва́', gloss: 'موسكو', shows: 'о من غير نبر → а', fromSource: true },
    ],
    counter: [],
    engineRuleIds: ['RU_VOWEL_STRESSED', 'RU_RED_A_O_PRETONIC1', 'RU_RED_A_O_WEAK'],
    status: COVERAGE.ENGINE_MORE_PRECISE,
    divergence:
      '⚠️ **هنا يفترق المصدرُ عن المحرّك، والطبقتان تبقيان.**\n'
      + 'الملفُّ يقول جملةً واحدة: «غير المنبورة تُنطَق а». والمحرّك يفرّق '
      + 'درجتين: [ɐ] في المقطع السابق للنبر مباشرةً (وهي قريبةٌ من `а` '
      + 'فعلًا فالتعليمُ صادق)، و[ə] فيما بعُد (أخفتُ وأغمض). '
      + 'و`сло́во` تُظهِر ذلك: المصدرُ يقول «а»، والمحرّك يقول [ə] — '
      + 'وهو فرقٌ **في الدقّة لا في الاتّجاه**، فلا تحذيرَ للمتعلّم (بند ٢٨).',
    notes:
      '⚠️ **وصياغةُ WS58 كانت تدّعي على المعلّمة ما لم تقله.** كتبتُ في '
      + 'الشرح «وفيه درجتين: اللي قبل النبر أوضح من اللي بعيدة» — تلك '
      + 'معرفةُ المحرّك تسرّبت إلى الطبقة التعليميّة. فرُدّت إلى `divergence` '
      + 'حيث تنتمي، وبقي نصُّ الملفّ نصَّ الملفّ.',
  },

  {
    id: 'TEACH_YA_STRESSED',
    doc: SOURCE_DOC.STRESS,
    page: 2,
    section: 'حرف ( я )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'я عليها النبر',
    sourceText: 'حرف ( я ): إذا كان عليه النبر ينطق ( я )',
    arabicExplanation: 'الـ(я) اللي عليها النبر بتتنطق (я) كاملة.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'мя́со', gloss: 'لحمة', shows: 'я منبورة بعد م مرققة', fromSource: true },
      { word: 'я́блоко', gloss: 'تفاحة', shows: 'я منبورة في أوّل الكلمة', fromSource: true },
    ],
    counter: [
      { word: 'язы́к', shows: 'я من غير نبر — النبر على ы', fromSource: true,
        notStressed: 'я' },
    ],
    engineRuleIds: ['RU_VOWEL_STRESSED'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes: 'قُسِم عن `TEACH_YA_STRESS` في WS58 لأن الملفَّ يفصل ثلاثَ حالاتٍ بأمثلةٍ مستقلّة.',
  },

  {
    id: 'TEACH_YA_UNSTRESSED_INITIAL',
    doc: SOURCE_DOC.STRESS,
    page: 2,
    section: 'حرف ( я )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'я من غير نبر في أوّل الكلمة',
    sourceText: 'إذا كان بدون نبر و جاء أول حرف في الكلمة ينطق ( е ) مكسورة',
    arabicExplanation:
      'الـ(я) من غير نبر لو كانت **أوّل حرف** في الكلمة بتتنطق (е) مكسورة — '
      + 'يعني صوت زيّ «يِ».',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'язы́к', gloss: 'لغة — لسان', shows: 'я أوّل الكلمة من غير نبر', fromSource: true },
      { word: 'Япо́ния', gloss: 'اليابان', shows: 'я أوّل الكلمة من غير نبر', fromSource: true },
    ],
    counter: [
      { word: 'я́блоко', shows: 'я أوّل الكلمة بس عليها النبر', fromSource: true,
        notRules: ['RU_RED_SOFT_IKANYE'] },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '`язы́к` → `йизы́к` [jɪˈzɨk] و`Япо́ния` → `йипо́н\'ьйь` — '
      + 'والـ`й` تظهر لأن `я` يوتيّةٌ في أوّل الكلمة، ثم تدخل حركتُها '
      + 'الإيكانيه بوصفها «بعد مرقَّق». وهو بالضبط «е مكسورة» التي يصفها الملفّ.',
  },

  {
    id: 'TEACH_YA_UNSTRESSED_MEDIAL',
    doc: SOURCE_DOC.STRESS,
    page: 2,
    section: 'حرف ( я )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'я من غير نبر في وسط الكلمة',
    sourceText: 'إذا كان بدون نبر و جاء في وسط الكلمة ينطق ( и )',
    arabicExplanation: 'الـ(я) من غير نبر في **وسط** الكلمة بتتنطق (и).',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'ме́сяц', gloss: 'شهر', shows: 'я وسط الكلمة من غير نبر → и', fromSource: true },
      { word: 'мясни́к', gloss: 'جزار', shows: 'я وسط الكلمة من غير نبر → и', fromSource: true },
    ],
    counter: [
      { word: 'мя́со', shows: 'я وسط الكلمة بس عليها النبر', fromSource: true,
        unchanged: 'я' },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes: '`ме́сяц` → `м\'э́с\'ьц` و`мясни́к` → `м\'исн\'и́к` — الاثنان يمرّان.',
  },

  {
    id: 'TEACH_E_STRESSED',
    doc: SOURCE_DOC.STRESS,
    page: 2,
    section: 'حرف ( е )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'е عليها النبر — غالبًا э وأحيانًا е',
    sourceText: 'حرف ( е ): إذا كان عليه علامة النبر ففي معظم الكلمات ينطق ( э ) — '
      + 'пе́карь. وفي بعض الكلمات ينطق بصوته الأصلي ( е ) — приве́т',
    arabicExplanation:
      'الـ(е) اللي عليها النبر بتتنطق (э) في معظم الكلمات، '
      + 'وفي بعض الكلمات بتتنطق بصوتها الأصلي (е).',
    terms: [TERM.STRESS, TERM.VOWEL],
    /*
     * ⚠️ **بندٌ جديدٌ كليًّا — ولم تكن قائمةُ التدقيق تذكره.**
     *    والملفُّ **لا يعطي قاعدةً** تفصل «معظم الكلمات» عن «بعضها»:
     *    يعطي مثالًا لكلٍّ ويسكت. فالمحرّكُ لا يستطيع أن يفرّق ما لم
     *    يُفرَّق له، ونحن لا نخترع القاعدةَ الغائبة (بند ٢٧).
     */
    examples: [
      { word: 'пе́карь', gloss: 'خباز', shows: 'е منبورة تُنطَق э', fromSource: true },
      { word: 'приве́т', gloss: 'مرحبا', shows: 'е منبورة تبقى е', fromSource: true },
    ],
    counter: [
      { word: 'стена́', shows: 'е من غير نبر — النبر على а', fromSource: true,
        notStressed: 'е' },
    ],
    engineRuleIds: ['RU_VOWEL_STRESSED'],
    status: COVERAGE.PARTIAL,
    divergence:
      '⚠️ **والالتباسُ في المصدر نفسِه — مسجَّلٌ لا مُصلَّح.**\n'
      + 'الملفُّ يذكر نطقَين للـ`е` المنبورة ولا يعطي قاعدةً تحدّد أيَّهما '
      + 'لأيّ كلمة: «في معظم الكلمات… وفي بعض الكلمات…». والمحرّك يُخرج '
      + 'قيمةً واحدةً [e] للاثنين (`пе́карь` → [ˈpʲekərʲ]، `приве́т` → '
      + '[prʲɪˈvʲet]) — أي أنه **يغطّي المثالَين ولا يميّز بينهما**. '
      + 'واختراعُ قائمةِ كلماتٍ تفصلهما ادّعاءٌ لا يسنده الملفُّ ولا مصدرٌ '
      + 'وصلني. فالحالةُ `PARTIAL` صادقةً.',
    notes: '',
  },

  {
    id: 'TEACH_E_BEFORE_STRESS',
    doc: SOURCE_DOC.STRESS,
    page: 3,
    section: 'حرف ( е )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'е قبل النبر تُنطَق и',
    sourceText: 'إذا جاء حرف ( е ) في الكلمة قبل علامة النبر ينطق ( и )',
    arabicExplanation: 'الـ(е) اللي جاية **قبل** النبر بتتنطق (и).',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'стена́', gloss: 'حائط', shows: 'е قبل النبر → и', fromSource: true },
      { word: 'телеви́зор', gloss: 'تلفاز', shows: 'الـ е الاتنين قبل النبر → и', fromSource: true },
    ],
    counter: [
      { word: 'пе́карь', shows: 'е عليها النبر — متتغيّرش', fromSource: true,
        notRules: ['RU_RED_SOFT_IKANYE'] },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '`стена́` → `ст\'ина́` و`телеви́зор` → `т\'ьл\'ив\'и́зър` — '
      + 'يطابقان وصفَ المصدر تمامًا.',
  },

  {
    id: 'TEACH_E_AFTER_STRESS',
    doc: SOURCE_DOC.STRESS,
    page: 3,
    section: 'حرف ( е )',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'е بعد النبر تُنطَق э',
    sourceText: 'إذا جاء حرف ( е ) في الكلمة بعد علامة النبر ينطق ( э )',
    arabicExplanation:
      'الـ(е) اللي جاية **بعد** النبر بتتنطق (э) — قصيرة وخفيفة.',
    terms: [TERM.STRESS, TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'учи́тель', gloss: 'معلم', shows: 'е بعد النبر', fromSource: true },
      { word: 'се́рдце', gloss: 'قلب', shows: 'е الأخيرة بعد النبر', fromSource: true },
    ],
    counter: [
      { word: 'стена́', shows: 'е قبل النبر لا بعده', fromSource: true,
        notRules: ['RU_RED_AFTER_HUSHING_WEAK'] },
    ],
    engineRuleIds: ['RU_RED_SOFT_IKANYE', 'RU_RED_AFTER_HUSHING_WEAK'],
    status: COVERAGE.ENGINE_MORE_PRECISE,
    divergence:
      '⚠️ **أوضحُ افتراقٍ بين الملفّ والمحرّك — والمحرّكُ يبقى كما هو (بند ١٣).**\n'
      + 'الملفُّ يقول إن `е` بعد النبر تُنطَق [э]. والمحرّك يُخرج:\n'
      + '· `учи́тель` → `учи́т\'ьл\'` [uˈtɕitʲɪlʲ] — أي [ɪ] بعد مرقَّق.\n'
      + '· `се́рдце` → `с\'э́рцъ` [ˈsʲertsə] — أي [ə] بعد `ц` المفخَّمة.\n'
      + 'والمعيارُ الروسيُّ الحديث مع المحرّك: الحركةُ بعد النبر تُختزَل '
      + 'ولا تبقى [ɛ] كاملة. ووصفُ الملفّ **تبسيطٌ تعليميٌّ نافع** — يمنعك '
      + 'أن تنطقها [и] واضحة — ولا يُنتج نطقًا خاطئًا، فلا تحذيرَ للمتعلّم '
      + '(بند ٢٨)، والطبقتان معروضتان معًا.',
    notes: '',
  },

  {
    id: 'TEACH_ONE_VOWEL_WORD',
    doc: SOURCE_DOC.STRESS,
    page: 3,
    section: 'ملحوظات مهمة',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'الكلمة اللي فيها حرف متحرك واحد',
    sourceText: 'إذا احتوت الكلمة على حرف متحرك واحد فقط يكون هو صاحب النبر',
    arabicExplanation:
      'لو الكلمة فيها حرف متحرك واحد بس، فالنبر عليه بالضرورة — مفيش اختيار تاني.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'он', gloss: 'هو', shows: 'حرف متحرك واحد — النبر عليه', fromSource: true },
      { word: 'нож', gloss: 'سكين', shows: 'زيّها', fromSource: true },
    ],
    counter: [
      { word: 'в', shows: 'مفيش حرف متحرك خالص — مفيش نبر ومفيش مقاطع', fromSource: true },
    ],
    engineRuleIds: [],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      'منفَّذةٌ في `StressResolver` (مزوّدُ أحاديّ المقطع) لا في قاعدةٍ '
      + 'من سجلّ النطق — والفصلُ مقصود: النبرُ يُحَلّ **قبل** القواعد لا بينها.',
  },

  {
    id: 'TEACH_YO_CARRIES_STRESS',
    doc: SOURCE_DOC.STRESS,
    page: 3,
    section: 'ملحوظات مهمة',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'ё دائمًا صاحبة النبر',
    sourceText: 'حرف ( ё ) يكون دائما صاحب النبر',
    arabicExplanation:
      'لو لقيت (ё) في الكلمة، فالنبر عليها. دي أسهل علامة نبر في الروسي كله.',
    terms: [TERM.STRESS, TERM.VOWEL],
    examples: [
      { word: 'актёр', gloss: 'ممثل', shows: 'ё منبورة', fromSource: true },
      { word: 'щётка', gloss: 'فرشاة', shows: 'ё منبورة', fromSource: true },
      { word: 'лёгкий', gloss: 'سهل', shows: 'ё منبورة', fromSource: true },
    ],
    counter: [
      { word: 'ме́ч', shows: 'е مش ё — القاعدة مبتنطبقش', fromSource: true },
    ],
    engineRuleIds: [],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      'منفَّذةٌ في `StressResolver` (مزوّدُ ё) — مصدرُ النبر واحدٌ للمنهج '
      + 'وللمحرّك (بند ٤١). و`актёр` → `акт\'о́р` بلا علامةٍ مكتوبة.',
  },

  {
    id: 'TEACH_STRESS_CHANGES_MEANING',
    doc: SOURCE_DOC.STRESS,
    page: 3,
    section: 'ملحوظات مهمة',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'اختلاف موقع النبر قد يغيّر معنى الكلمة',
    sourceText: 'اختلاف موقع النبر قد يغير معنى الكلمة — '
      + 'за́мок قلعة / замо́к قفل — му́ка عذاب / мука́ دقيق',
    arabicExplanation:
      'نفس الحروف بالظبط، والنبر هو اللي بيفرق في المعنى.',
    terms: [TERM.STRESS],
    examples: [
      { word: 'за́мок', gloss: 'قلعة', shows: 'النبر على الأولى', fromSource: true, pairWith: 'замо́к' },
      { word: 'замо́к', gloss: 'قفل', shows: 'النبر على التانية', fromSource: true },
      { word: 'му́ка', gloss: 'عذاب', shows: 'النبر على الأولى', fromSource: true, pairWith: 'мука́' },
      { word: 'мука́', gloss: 'دقيق', shows: 'النبر على التانية', fromSource: true },
    ],
    counter: [
      { word: 'он', shows: 'حرف متحرك واحد — مفيش التباس ممكن', fromSource: true },
    ],
    engineRuleIds: [],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '⚠️ **والالتباسُ يُحفَظ ولا يُحسَم عشوائيًّا** (بند ٤٢). '
      + '`StressResolver` يعلّم الكلمةَ `ambiguous` ويعرض القراءتين الحقيقيّتين '
      + 'فقط — لا كلَّ حروف العلّة. واختيارُك يُحفَظ **للسياق** لا للكلمة، '
      + 'فلا تصير القلعةُ قفلًا في كلّ نصٍّ قادم.\n'
      + 'وزوجُ `му́ка`/`мука́` جديدٌ من الملفّ — لم يكن في قائمة التدقيق.',
  },

  /* ──────────────────────────────────────────────────────────────
     الوثيقةُ الثالثة — الأصوات المجهورة والمهموسة · صفحتان · ٨ بنود
     ────────────────────────────────────────────────────────────── */

  {
    id: 'TEACH_VOICED_VOICELESS_PAIRS',
    doc: SOURCE_DOC.VOICING,
    page: 1,
    section: 'جدول الأصوات المجهورة والمهموسة',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'أزواج المجهور والمهموس',
    sourceText: 'الأصوات المجهورة / الأصوات المهموسة: '
      + 'б-п · г-к · д-т · з-с · в-ф · ж-ш',
    arabicExplanation:
      'ستّة أزواج: كل واحد فيهم نفس مخرج النطق، والفرق إن الحبال الصوتية '
      + 'بتهتزّ مع المجهور ومبتهتزّش مع المهموس.\n'
      + 'б↔п · г↔к · д↔т · з↔с · в↔ф · ж↔ш',
    terms: [TERM.VOICED, TERM.VOICELESS, TERM.CONSONANT],
    examples: [
      { word: 'нож', gloss: 'سكين', shows: 'ж ← ш — الزوج شغّال', fromSource: true },
      { word: 'друг', gloss: 'صديق', shows: 'г ← к — الزوج شغّال', fromSource: true },
      { word: 'раз', gloss: 'مرة', shows: 'з ← с — الزوج شغّال', fromSource: true },
    ],
    counter: [
      { word: 'он', shows: 'н رنّانة — مجهورة من غير زوج مهموس', fromSource: true },
    ],
    engineRuleIds: ['RU_FINAL_DEVOICING', 'RU_REGRESSIVE_DEVOICING', 'RU_REGRESSIVE_VOICING'],
    status: COVERAGE.COVERED,
    divergence:
      'جدولُ الملفّ ستّةُ أزواجٍ بالضبط، وهو نفسُ `VOICED_TO_VOICELESS` '
      + 'في `alphabet.js` حرفًا بحرف.',
    notes:
      'الأزواجُ **حقائقُ لا منطق**، والعكسُ يُشتقّ منها ولا يُكتَب مرّتين. '
      + 'وكلُّ قاعدةِ جهرٍ تقرأ منه ولا تُعيد تعريفَ حرف.',
  },

  {
    id: 'TEACH_REGRESSIVE_EFFECT',
    doc: SOURCE_DOC.VOICING,
    page: 1,
    section: 'إذا توالى صوتان أحدهما مجهور و الآخر مهموس',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'الصوت التاني بيأثّر على الأوّل',
    sourceText: 'إذا توالى صوتان أحدهما مجهور و الآخر مهموس '
      + 'يقوم الثاني بالتأثير على الأول و يجعله من نفس نوعه',
    arabicExplanation:
      'دي القاعدة المركزية كلها: التأثير بيمشي **من ورا لقدّام**. '
      + 'الصوت التاني بيخلّي الأوّل من نفس نوعه.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'всегда́', gloss: 'دائما', shows: 'в اتهمست بسبب с', fromSource: true },
      { word: 'экза́мен', gloss: 'امتحان', shows: 'к اتجهّرت بسبب з', fromSource: true },
    ],
    counter: [
      { word: 'ва́за', shows: 'в و з مجهورين — مفيش تأثير', fromSource: true },
    ],
    engineRuleIds: ['RU_REGRESSIVE_DEVOICING', 'RU_REGRESSIVE_VOICING'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      'المحرّكُ يمرّ على الأصوات **من آخر الكلمة إلى أوّلها** حرفيًّا — '
      + 'الاتّجاهُ ليس تفصيلَ تنفيذ بل ترجمةٌ مباشرةٌ لجملة الملفّ.',
  },

  {
    id: 'TEACH_VOICED_TO_VOICELESS',
    doc: SOURCE_DOC.VOICING,
    page: 1,
    section: 'مجهور + مهموس = مهموس + مهموس',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'مجهور + مهموس = مهموس + مهموس',
    sourceText: 'مجهور + مهموس = مهموس + مهموس — '
      + 'всегда́ ( حرف в ينطق ф )',
    arabicExplanation:
      'لو المجهور جه قبل مهموس، بيفقد جهره ويبقى الاتنين مهموسين.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'всегда́', gloss: 'دائما', shows: 'حرف в ينطق ф', fromSource: true },
      { word: 'вход', gloss: 'مدخل', shows: 'в → ф قدّام х', fromSource: true },
    ],
    counter: [
      { word: 'вода́', shows: 'в قدّام حرف متحرك — فضلت مجهورة', fromSource: true },
    ],
    engineRuleIds: ['RU_REGRESSIVE_DEVOICING'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '⚠️ سطرُ المعادلة في الملفّ مكتوبٌ من اليمين لليسار، ويخرجه '
      + 'الاستخراجُ الآليُّ معكوسًا. قُرئ يدويًّا: **مجهور + مهموس = '
      + 'مهموس + مهموس** — ومثالُ `всегда́` (в→ф) يؤكّد القراءة.',
  },

  {
    id: 'TEACH_VOICELESS_TO_VOICED',
    doc: SOURCE_DOC.VOICING,
    page: 1,
    section: 'مهموس + مجهور = مجهور + مجهور',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'مهموس + مجهور = مجهور + مجهور',
    sourceText: 'مهموس + مجهور = مجهور + مجهور — '
      + 'экза́мен ( حرف к ينطق г )',
    arabicExplanation:
      'والعكس: لو المهموس جه قبل مجهور، بيتجهّر ويبقى الاتنين مجهورين.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'экза́мен', gloss: 'امتحان', shows: 'حرف к ينطق г', fromSource: true },
    ],
    counter: [
      { word: 'свет', gloss: 'ضوء', shows: 'с قدّام в — مبتتجهّرش', fromSource: true,
        notRules: ['RU_REGRESSIVE_VOICING'] },
    ],
    engineRuleIds: ['RU_REGRESSIVE_VOICING'],
    status: COVERAGE.PARTIAL,
    divergence: null,
    notes:
      '⚠️ **الظاهرةُ مغطّاةٌ والكلمةُ جزئيّة — والفرقُ يُقال لا يُخفى.**\n'
      + '`экза́мен` تُطلِق `RU_REGRESSIVE_VOICING` فعلًا (к→г كما يقول الملفّ) '
      + 'ويظهر ذلك في الأثر وفي قسم «مجهور/مهموس». لكنّ **النطقَ الكاملَ '
      + 'محجوب** لأن `э` غيرَ المنبورة مؤجَّلةٌ صراحةً في '
      + '`RU_UNSTRESSED_E_CARET`: لم يصل مقتطفٌ يحدّد قيمتَها، والملفُّ '
      + 'لا يعلّم `э` أصلًا. فبحثتُ عنها في التحقّق ولم أجد ما يرفع التأجيل، '
      + 'ولم أخترع قيمةً لتبدو المصفوفةُ خضراء (بند ١٤).',
  },

  {
    id: 'TEACH_CROSS_WORD_EFFECT',
    doc: SOURCE_DOC.VOICING,
    page: 2,
    section: 'ليس شرطا أن يتوالى الصوتان في نفس الكلمة',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'التأثير بيعدّي حدود الكلمة',
    sourceText: 'ليس شرطا لتطبيق القاعدة أن يتوالى الصوتان '
      + '( المجهور و المهموس ) في نفس الكلمة — в па́рке ( в ينطق ф )',
    arabicExplanation:
      'الكلام مش كلمات مفصولة. آخر حرف في الكلمة بيتأثّر بأوّل حرف '
      + 'في اللي بعدها.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'в па́рке', gloss: 'في الحديقة', shows: 'в ينطق ф بسبب п',
        fromSource: true, context: ['в', 'па́рке'] },
    ],
    counter: [
      { word: 'нож мой', shows: 'م رنّانة — الهمس النهائي بيحصل عادي',
        fromSource: false, context: ['нож', 'мой'], notRules: ['RU_CROSS_WORD_VOICED_KEPT'] },
    ],
    engineRuleIds: [
      'RU_CROSS_WORD_VOICED_KEPT', 'RU_CROSS_WORD_VOICING', 'RU_CROSS_WORD_DEVOICING',
    ],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '⚠️ **مثالُ الملفّ الحرفيُّ يمرّ** (بند ١٧): `в па́рке` → الـ`в` '
      + 'تُنطَق `ф`، و`RU_CROSS_WORD_DEVOICING` هي التي تُطلَق فتقول '
      + '«التأثير جاي من الكلمة اللي بعدها» — وهو نصُّ درس الملفّ. '
      + 'ولولا نقلُ أولويّتها في WS58 من ٦٦٠ إلى ٥٩٥ لَما انطلقت مرّةً، '
      + 'ولَنُسِب الهمسُ إلى آخر الكلمة وحدَه فضاع الدرس.\n'
      + 'وما زال **العروضُ** (أين تقف أنت) غيرَ معروف — معلَنٌ في '
      + '`RU_CROSS_WORD_PROSODY` المؤجَّلة، ولذلك القواعدُ `PROVISIONAL`.',
  },

  {
    id: 'TEACH_SAME_TYPE_NO_CHANGE',
    doc: SOURCE_DOC.VOICING,
    page: 2,
    section: 'إذا توالى صوتان من نفس النوع',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'لو الصوتين من نفس النوع — مفيش تغيير',
    sourceText: 'إذا توالى صوتان من نفس النوع لا يحدث أي تغيير — '
      + 'всегда́ ( حرف г يظل كما هو г )',
    arabicExplanation:
      'مش كل حرف بيتغيّر. لو الاتنين من نفس النوع، الحرف بيتنطق '
      + 'زيّ ما هو مكتوب بالظبط.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    expectsNoChange: true,
    /*
     * ⚠️ **والملفُّ يستعمل `всегда́` مرّتين في صفحتين — وهذا تعليمٌ بارع:**
     *    نفسُ الكلمة تُظهر القاعدةَ وحدَّها معًا. الـ`в` تتغيّر لأن بعدها
     *    مهموسًا، والـ`г` **لا** تتغيّر لأن بعدها مجهورًا. فيتعلّم القارئُ
     *    أن القاعدةَ انتقائيّةٌ لا شاملة — من كلمةٍ واحدة.
     */
    examples: [
      { word: 'всегда́', gloss: 'دائما', shows: 'حرف г يظل كما هو г',
        fromSource: true, unchanged: 'г' },
      { word: 'шкаф', gloss: 'دوالب', shows: 'ф مهموسة أصلًا في الآخر',
        fromSource: true, unchanged: 'ф' },
    ],
    counter: [],
    engineRuleIds: ['RU_VOICING_SONORANT_NEUTRAL'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '⚠️ **والصمتُ لا يُعلِّم.** `RU_VOICING_SONORANT_NEUTRAL` قاعدةٌ '
      + '**مانعةٌ تُسجَّل في الأثر** بدل أن تسكت، وخريطةُ الصوت تعلّم كلَّ '
      + 'صوتٍ `changed: false` صراحةً — فيرى المتعلّم أن «لا شيء» جوابٌ '
      + 'لا سهوٌ.',
  },

  {
    id: 'TEACH_FINAL_DEVOICING',
    doc: SOURCE_DOC.VOICING,
    page: 2,
    section: 'آخر صوت في الكلمة',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'الهمس في آخر الكلمة',
    sourceText: 'إذا كان آخر صوت في الكلمة صوتا مجهورا يجب نطقه مهموسا '
      + 'و اذا كان آخر صوت مهموسا يظل كما هو',
    arabicExplanation:
      'أيّ حرف مجهور في آخر الكلمة بيفقد جهره. ولو كان مهموس أصلًا — بيفضل زيّ ما هو.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'нож', gloss: 'سكين', shows: 'ж ينطق ш', fromSource: true },
      { word: 'друг', gloss: 'صديق', shows: 'г ينطق к', fromSource: true },
      { word: 'раз', gloss: 'مرة', shows: 'з ينطق с', fromSource: true },
    ],
    counter: [
      { word: 'шкаф', gloss: 'دوالب', shows: 'ф يظل كما هو', fromSource: true,
        unchanged: 'ф' },
      { word: 'он', shows: 'н رنّانة — مبتفقدش جهرها', fromSource: true,
        notRules: ['RU_FINAL_DEVOICING'] },
    ],
    engineRuleIds: ['RU_FINAL_DEVOICING'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '⚠️ **والملفُّ يعطي المثالَ المضادَّ بنفسِه: `шкаф`** — أي أنه يعلّم '
      + '«متى لا تنطبق» في نفس السطر. والرنّاناتُ خارجَها في المحرّك '
      + '(`isPairedVoiced` وحدَها هي الشرط)، وهو أشهرُ إفراطٍ في هذه القاعدة.',
  },

  {
    id: 'TEACH_V_SPECIAL',
    doc: SOURCE_DOC.VOICING,
    page: 2,
    section: 'ملحوظة مهمة',
    provenance: PROVENANCE.SOURCE_REQUIRED,
    sourceStatus: SOURCE_STATUS.PDF_VERIFIED,
    arabicTitle: 'حرف в لا يؤثر ولكن يتم التأثير عليه',
    sourceText: 'حرف ( в ) لا يؤثر ولكن يتم التأثير عليه — '
      + 'всегда́ ( حرف в ينطق ф ) — свет ( حرف с يظل كما هو )',
    arabicExplanation:
      'الـ(в) غريبة: **بيتأثّر عليها** زيّ أيّ حرف مجهور، لكنها '
      + '**مبتأثّرش** — مبتجهّرش الحرف اللي قبلها.',
    terms: [TERM.VOICED, TERM.VOICELESS],
    examples: [
      { word: 'всегда́', gloss: 'دائما', shows: 'حرف в ينطق ф — يتم التأثير عليه',
        fromSource: true, expectRule: 'RU_REGRESSIVE_DEVOICING' },
      { word: 'свет', gloss: 'ضوء', shows: 'حرف с يظل كما هو — в لا يؤثر',
        fromSource: true, expectRule: 'RU_VOICING_V_NEUTRAL' },
    ],
    counter: [
      { word: 'сда́ть', shows: 'с اتجهّرت قدّام д — لأن د مش в', fromSource: false,
        notRules: ['RU_VOICING_V_NEUTRAL'] },
    ],
    engineRuleIds: ['RU_VOICING_V_NEUTRAL', 'RU_REGRESSIVE_DEVOICING'],
    status: COVERAGE.COVERED,
    divergence: null,
    notes:
      '⚠️ **ومثالا الملفّ يُظهران الوجهين بقاعدتين مختلفتين** — وهو ما '
      + 'يمنع الخلطَ الذي يقلب الاستثناءَ على رأسه: `свет` يحرسها '
      + '`RU_VOICING_V_NEUTRAL` (المنعُ في اتّجاهٍ واحد)، و`всегда́` تُهمَس '
      + 'فيها الـ`в` بقاعدةٍ عاديّة. فلكلّ مثالٍ قاعدتُه المسمّاة في الاختبار.',
  },

  /* ──────────────────────────────────────────────────────────────
     توسيعُ المحرّك — علمٌ فوق المنهج، لا بديلٌ عنه (بندا ٤٣ و٤٤)
     ────────────────────────────────────────────────────────────── */

  {
    id: 'ENGINE_GK_HCH_EXTENSION',
    doc: SOURCE_DOC.ENGINE,
    page: null,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    arabicTitle: 'гч كمان بتتنطق хч — فوق ما يذكره الملفّ',
    sourceText: null,
    arabicExplanation: 'زيّ гк بالظبط: «ле́гче» بتتقال «ле́хче».',
    terms: [TERM.VOICELESS, TERM.CONSONANT],
    examples: [
      { word: 'ле́гче', shows: 'гч → хч', fromSource: false },
      { word: 'мя́гче', shows: 'гч → хч', fromSource: false },
    ],
    counter: [{ word: 'мно́го', shows: 'г عادية', fromSource: false }],
    engineRuleIds: ['RU_ORTHO_GK_HK'],
    divergence:
      'الملفُّ يذكر `гк` وحدَها في صفحته الثانية. و`гч` نفسُ الظاهرة '
      + '(تخالفٌ في الجذرَين نفسِهما) ويعالجها المحرّك — فتُسجَّل هنا '
      + '**توسيعًا مُعلَنًا** لا تُخبَّأ داخل بند الملفّ.',
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'ENGINE_CLUSTER_STN_NTSK',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    page: null,
    arabicTitle: 'عناقيد تانية فيها ساكن مش بيتنطق',
    arabicExplanation: 'زيّ «стн» في «местный» و«нтск» في «гигантский».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'ме́стный', shows: 'стн → сн', fromSource: false },
      { word: 'гига́нтский', shows: 'нтск → нск', fromSource: false },
    ],
    counter: [{ word: 'сто́л', shows: 'ست عادية', fromSource: false }],
    engineRuleIds: ['RU_CLUSTER_UNPRONOUNCED'],
    divergence: null,
    status: COVERAGE.COVERED,
    notes: 'نفسُ قاعدةِ ٥ط/٥ك/٥ل/٥م، بعناقيدَ لم تُعدِّدها قائمةُ التدقيق.',
  },

  {
    id: 'ENGINE_CLUSTER_LONG_HUSHING',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    page: null,
    arabicTitle: 'сш/зш و сж/зж — صوت واحد طويل',
    arabicExplanation: '«сш» بتتنطق «ш» طويلة، و«сж» بتتنطق «ж» طويلة.',
    terms: [TERM.HARD],
    examples: [
      { word: 'не́сший', shows: 'сш → шш', fromSource: false },
      { word: 'сжа́ть', shows: 'сж → жж', fromSource: false },
    ],
    counter: [{ word: 'ши́ть', shows: 'ш مفردة', fromSource: false }],
    engineRuleIds: ['RU_CLUSTER_SH_LONG', 'RU_CLUSTER_ZH_LONG'],
    divergence: null,
    status: COVERAGE.COVERED,
    notes: 'зж/жж داخل الجذر مؤجَّلةٌ صراحةً — المصدرُ نفسُه يعطي وجهين.',
  },

  {
    id: 'ENGINE_CLUSTER_TS_FAMILY',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    page: null,
    arabicTitle: 'тс/дс قبل ‎-ск- و ‎-тся/-ться و тч/дч',
    arabicExplanation:
      '«советский» بتتقال «совецкий»، و«учиться» بتتقال «учица»، و«лётчик» بتتقال «лёчик».',
    terms: [TERM.CONSONANT],
    examples: [
      { word: 'сове́тский', shows: 'тс+ск → цк', fromSource: false },
      { word: 'учи́ться', shows: '-ться → -ца', fromSource: false },
      { word: 'лётчик', shows: 'тч → ч', fromSource: false },
    ],
    counter: [{ word: 'то́т', shows: 'т مفردة', fromSource: false }],
    engineRuleIds: ['RU_CLUSTER_TS_DS', 'RU_CLUSTER_TSYA', 'RU_CLUSTER_TCH_DCH'],
    divergence: null,
    status: COVERAGE.COVERED,
    notes: '',
  },

  {
    id: 'ENGINE_GEMINATION',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    page: null,
    arabicTitle: 'الساكن المكرَّر صوت واحد أطول',
    arabicExplanation: '«ванна» فيها «н» واحدة ممدودة، مش «ن» مرّتين.',
    terms: [TERM.CONSONANT],
    examples: [{ word: 'ва́нна', shows: 'нн → н طويلة', fromSource: false }],
    counter: [{ word: 'о́н', shows: 'н مفردة', fromSource: false }],
    engineRuleIds: ['RU_GEMINATION'],
    divergence: null,
    status: COVERAGE.COVERED,
    notes: '`PROVISIONAL`: المصدرُ يستثني بعضَ المُعرَّبات.',
  },

  {
    id: 'ENGINE_CHN_SHN',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    page: null,
    arabicTitle: 'чн بتتنطق шн — في قائمة مغلقة بس',
    arabicExplanation: '«конечно» بتتقال «конешно». دي مش قاعدة لكل «чн».',
    terms: [],
    examples: [
      { word: 'коне́чно', shows: 'чн → шн', fromSource: false },
      { word: 'ску́чно', shows: 'чн → шн', fromSource: false },
    ],
    counter: [
      { word: 'то́чный', shows: 'чн بتفضل чн', fromSource: false },
      { word: 'ве́чный', shows: 'زيّها', fromSource: false },
    ],
    engineRuleIds: ['RU_ORTHO_CHN_SHN'],
    divergence: null,
    status: COVERAGE.LEXICAL,
    notes: 'قائمةٌ مغلقةٌ + نمطُ أسماء الآباء على ‎-ична.',
  },

  {
    id: 'ENGINE_VARIANT_CHN',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    page: null,
    arabicTitle: 'كلمات ليها نطقين — والاتنين مقبولين',
    arabicExplanation: '«булочная» بتتقال بـ«чн» أو بـ«шн»، والمصادر مش متّفقة.',
    terms: [],
    /* ⚠️ **ولا تُطلِق قاعدةً عمدًا** — مدخَلُ `VARIANT` بلا `rewrite`،
       فلا أثرَ له في سجلّ القواعد. إثباتُه أن التحليلَ يخرج موسومًا
       `LEXICAL_EXCEPTION` بنطقَين معروضَين. */
    expectsLexical: true,
    examples: [
      { word: 'було́чная', shows: 'نطقان مقبولان', fromSource: false },
      { word: 'моло́чный', shows: 'زيّها', fromSource: false },
    ],
    counter: [],
    engineRuleIds: ['RU_LEXICAL_ORTHOEPIC_EXCEPTION'],
    divergence: null,
    status: COVERAGE.DISPUTED,
    notes: '⚠️ مدخلاتُ `VARIANT` **لا تُحوِّل شيئًا** — تُعلِّم النتيجةَ ولا تمسّها.',
  },

  {
    id: 'ENGINE_SOFTNESS_ASSIMILATION',
    doc: SOURCE_DOC.ENGINE,
    section: '—',
    provenance: PROVENANCE.ENGINE_EXPANSION,
    sourceStatus: SOURCE_STATUS.ENGINE_ORIGIN,
    page: null,
    arabicTitle: 'ترقيق مماثِل — اختياريّ ومتغيّر',
    arabicExplanation:
      'زمان كانوا بيقولوا «сьнег» بترقيق. دلوقتي الاتنين مقبولين والأغلب بينطقها مفخمة.',
    terms: [TERM.SOFT, TERM.HARD],
    examples: [{ word: 'сне́г', shows: 'с قد تُنطق مرققة عند بعض المتحدّثين', fromSource: false }],
    counter: [],
    engineRuleIds: ['RU_SOFTNESS_ASSIMILATION'],
    divergence: null,
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
    page: null,
    arabicTitle: 'مُعرَّبات بتفضل مفخمة قدّام е',
    arabicExplanation: '«пастель» بتتقال «пастэль» — الـ«т» فضلت مفخمة.',
    terms: [TERM.HARD],
    examples: [{ word: 'пасте́ль', shows: 'т مفخمة قدّام е', fromSource: false }],
    counter: [{ word: 'те́ло', shows: 'т مرققة عادي', fromSource: false }],
    engineRuleIds: ['RU_LOANWORD_HARD_BEFORE_E'],
    divergence: null,
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
    page: null,
    arabicTitle: 'اختزال كمّي — أقصر بس الصوت متغيّرش',
    arabicExplanation:
      '«ы» و«у» و«ю» بيقصروا لما ميبقوش منبورين، بس صوتهم مبيتغيّرش زيّ «о».',
    terms: [TERM.REDUCED, TERM.VOWEL],
    examples: [
      { word: 'любо́вь', shows: 'ю غير منبورة — أقصر بس [u]', fromSource: false },
      { word: 'му́зыка', shows: 'ы غير منبورة — أقصر بس [ɨ] زيّ ما هي', fromSource: false },
    ],
    counter: [
      { word: 'молоко́', shows: 'о بتتغيّر فعلًا — اختزال كيفيّ مش كمّي', fromSource: false },
      /* ⚠️ **ونقلتُها من الأمثلة إلى هنا بعد أن أسقطت الاختبار بحقّ.**
         كتبتُ «му́жество — у منبورة» في خانة الأمثلة، وهي بذلك **مثالٌ
         مضادّ**: المنبورةُ لا تُختزَل أصلًا، لا كمًّا ولا كيفًا. */
      { word: 'му́жество', shows: 'у منبورة — مفيش اختزال', fromSource: false,
        notRules: ['RU_VOWEL_QUANTITATIVE_ONLY'] },
    ],
    engineRuleIds: ['RU_VOWEL_QUANTITATIVE_ONLY'],
    divergence: null,
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
    page: null,
    arabicTitle: 'е بعد ж/ш/ц غير منبورة',
    arabicExplanation: 'قبل النبر بتقرب من «ы»، وبعيد عنه بتبقى صوت غامض قصير.',
    terms: [TERM.REDUCED, TERM.HARD, TERM.VOWEL],
    examples: [
      { word: 'жена́', shows: 'е قبل النبر → [ɨ]', fromSource: false },
      { word: 'со́лнце', shows: 'е بعد النبر → [ə]', fromSource: false },
    ],
    counter: [{ word: 'ле́с', shows: 'е بعد مرقق — عيلة الإيكانيه', fromSource: false }],
    engineRuleIds: ['RU_RED_AFTER_HUSHING_E', 'RU_RED_AFTER_HUSHING_WEAK'],
    divergence: null,
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

  /*
   * ⚠️ **بندٌ يقول «قرأتُه في الملفّ» ولا يقول أين — ادّعاءٌ لا أثرَ له**
   *    (بند ١١). فالصفحةُ شرطُ الترقية، لا زينة.
   */
  const verifiedWithoutPage = TEACHING_RULES
    .filter((t) => t.sourceStatus === SOURCE_STATUS.PDF_VERIFIED)
    .filter((t) => !Number.isInteger(t.page) || !t.sourceText)
    .map((t) => t.id);

  /* والعكسُ: بندٌ يذكر صفحةً وهو ليس من ملفّ. */
  const pageWithoutSource = TEACHING_RULES
    .filter((t) => t.sourceStatus === SOURCE_STATUS.ENGINE_ORIGIN && t.page !== null)
    .map((t) => t.id);

  /*
   * ⚠️ **ولا معرِّفَ من WS58 يختفي بصمت** (بند ٢٤). إمّا موجودٌ اليوم،
   *    وإمّا مذكورٌ في `SUPERSEDED` مع مَن حلّ محلَّه.
   */
  const ids = new Set(TEACHING_RULES.map((t) => t.id));
  const brokenSupersession = Object.entries(SUPERSEDED)
    .filter(([old, heirs]) => ids.has(old) || heirs.some((h) => !ids.has(h)))
    .map(([old]) => old);

  return {
    missingEngineRules,
    missingStatus,
    missingExamples,
    unmappedEngineRules,
    verifiedWithoutPage,
    pageWithoutSource,
    brokenSupersession,
    ok: !missingEngineRules.length && !missingStatus.length
      && !missingExamples.length && !unmappedEngineRules.length
      && !verifiedWithoutPage.length && !pageWithoutSource.length
      && !brokenSupersession.length,
  };
}

/** إحصاءٌ للتقرير والاختبار — بلا حسابٍ في الواجهة. */
export function curriculumStats() {
  const byStatus = {};
  const byDoc = {};
  const bySourceStatus = {};
  let examples = 0;
  let counter = 0;

  let sourceExamples = 0;
  let engineExamples = 0;
  let sourceCounter = 0;

  for (const item of TEACHING_RULES) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byDoc[item.doc] = (byDoc[item.doc] || 0) + 1;
    bySourceStatus[item.sourceStatus] = (bySourceStatus[item.sourceStatus] || 0) + 1;
    examples += item.examples.length;
    counter += item.counter.length;
    /*
     * ⚠️ **ولا يُجمَع مثالُ المعلّمة مع مثالٍ أضفتُه أنا** (بند ٩).
     *    رقمٌ واحدٌ يقول «١٤٠ مثالًا» يُخفي السؤالَ الوحيدَ المهمّ:
     *    كم منها من الملفّ؟
     */
    sourceExamples += item.examples.filter((e) => e.fromSource).length;
    engineExamples += item.examples.filter((e) => !e.fromSource).length;
    sourceCounter += item.counter.filter((e) => e.fromSource).length;
  }
  return {
    total: TEACHING_RULES.length,
    byStatus,
    byDoc,
    bySourceStatus,
    examples,
    counter,
    sourceExamples,
    engineExamples,
    sourceCounter,
    pdfVerified: TEACHING_RULES.filter((t) => t.sourceStatus === SOURCE_STATUS.PDF_VERIFIED).length,
    lexiconEntries: Object.keys(LEXICON).length,
  };
}

/**
 * وصفُ حالةِ المصدر للعرض — **الجملةُ التي تمنع ادّعاءَ أمانةٍ بلا مصدر**.
 */
export const SOURCE_STATUS_LABEL = Object.freeze({
  PDF_VERIFIED: 'مقروء من الملفّ الأصليّ',
  PROMPT_ONLY: 'كان في الطلب ومش موجود في الملفّ',
  NOT_FOUND_IN_PDF: 'اتدوّر عليه في الملفّ وما اتلقاش',
  ENGINE_ORIGIN: 'توسيع من المحرّك — مالوش أصل في الملفّات التلاتة',
});

/** بنودُ وثيقةٍ بصفحاتها — للمصفوفة والتقرير. */
export function sourceItemsOf(doc) {
  return TEACHING_RULES
    .filter((t) => t.doc === doc && t.sourceStatus === SOURCE_STATUS.PDF_VERIFIED)
    .sort((a, b) => a.page - b.page);
}

/** شرحُ القاعدة الهندسيّة كما يراها المنهج — لا كما يراها المطوّر. */
export function engineRuleWithTeaching(ruleId) {
  const rule = ruleById(ruleId);
  const teaching = teachingRulesForEngineRule(ruleId);
  if (!rule && !teaching.length) return null;
  return { rule, teaching };
}

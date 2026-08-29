/**
 * LingoLife — الجهرُ والهمس (WS52 · ٦٠٠–٦٤٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ المرورُ من آخر الكلمة إلى أوّلها — وليس اختيارَ أسلوب
 * ═══════════════════════════════════════════════════════════════
 *
 * المماثلةُ في الروسيّة **رجعيّة**: المؤثِّرُ على اليمين والمتأثِّرُ على
 * اليسار. ولذلك أثرٌ يتسلسل:
 *
 *      по-ез-д
 *          ↓  الـ`д` نهائيّةٌ فتُهمَس    → т
 *        ↓    والـ`з` صارت قبل مهموسٍ  → с
 *      [по́йьст]
 *
 * فلو طُبِّقت المماثلةُ **قبل** الهمسِ النهائيّ لما وجدت الـ`з` مُطلِقًا
 * أصلًا، ولخرجت `[по́йьзт]` — وهي كلمةٌ لا ينطقها روسيّ. ولذلك
 * ٦٠٠ قبل ٦٣٠، والمرورُ يمينًا←يسارًا؛ وكلاهما مُثبَّتٌ باختبار.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والمانعان (٦١٠ و٦٢٠) **قبل** المُطلِقَين (٦٣٠ و٦٤٠)
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن «أوّلُ مطابِقٍ يفوز». فلو جاء `RU_REGRESSIVE_VOICING` أوّلًا
 * لجهّر الـ`т` في `плотва` قبل أن يُسأل: «وهل `в` تُجهِّر أصلًا؟».
 * والجوابُ لا — وهو استثناءٌ منصوصٌ عليه في مصدر جامعة موسكو.
 */

import {
  registerRule, RULE_CATEGORY, STAGE, STATUS, EVIDENCE, SCOPE,
} from '../rule-registry.js';
import {
  VOICED_TO_VOICELESS, VOICELESS_TO_VOICED, isSonorant, isPairedVoiced, isPairedVoiceless,
} from '../alphabet.js';

const MSU_ASSIM = 'МГУ · fonetica/kons/n-21.htm «Ассимиляция согласных по глухости/звонкости»';

/** يقتبس حرفًا داخل جملةٍ عربيّة — والعلامتان لتفصله عن العربيّ حوله. */
const q = (ch) => `«${ch}»`;

registerRule({
  id: 'RU_FINAL_DEVOICING',
  category: RULE_CATEGORY.DEVOICING,
  stage: STAGE.VOICING,
  priority: 600,
  summary: 'المجهورُ المزدوجُ يفقد جهرَه في آخر الكلمة',
  explain: 'الحرف المجهور في آخر الكلمة بيفقد جهره — «друг» بتتقال «друк».',
  source: 'МГУ · fonetica/kons/n-22.htm + Грамота.ру «сад [сат]»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ `isPairedVoiced` وحدَها هي الشرط — **والرنّاناتُ ليست مزدوجة**
   *    فلا تدخل. وهذا ما يمنع `стол`←`стоԓ` و`дом`←`том`: أشهرُ
   *    إفراطٍ في هذه القاعدة، ويقع لأن المتعلّم يسمع «مجهور» فيظنّها
   *    تشمل `л` و`м` و`н` و`р`.
   */
  scope: SCOPE.WORD_FINAL,
  applies: (ctx) => ctx.isFinal && isPairedVoiced(ctx.letter),
  describe: (ctx) => `${q(ctx.letter)} في آخر الكلمة بتفقد جهرها، `
    + `فبتتسمع ${q(VOICED_TO_VOICELESS[ctx.letter])}.`,
  transform: (ctx) => ({ letter: VOICED_TO_VOICELESS[ctx.letter], voiced: false }),
});

/*
 * ══════════════════════════════════════════════════════════════════
 * ⚠️ **قاعدةُ الرنّانات كانت واحدةً — وكان ذلك هو العطب** (WS-N · §18)
 * ══════════════════════════════════════════════════════════════════
 *
 * كانت `RU_VOICING_SONORANT_NEUTRAL` تنطلق حين يكون **الحرفُ نفسُه**
 * رنّانةً **أو** حين يكون **ما بعده** رنّانة، وتقول في الحالتين جملةً
 * واحدة: «л م н р й مبيأثّروش على اللي قبلهم، ومبيفقدوش جهرهم».
 *
 * فحين حلّلنا `име́ет` انطلقت على الـ`м` — وهي رنّانةٌ بين حركتين لا
 * شيءَ عندها معرَّضٌ للهمس أصلًا — **وظهر في شرح الكلمة حرفُ `л` الذي
 * لا وجودَ له فيها**. والقارئُ يقرأ قاعدةً عن حرفٍ ليس أمامه، فيظنّ
 * المحرّكَ يهذي، وهو محقّ.
 *
 * والعطبُ ثلاثيٌّ في سطرٍ واحد:
 *   ① **شرطان مختلفان في قاعدةٍ واحدة** — «أنا رنّانة» و«ما بعدي
 *      رنّانة» ظاهرتان لهما متأثّران مختلفان.
 *   ② **تنطلق حيث لا شيءَ على المحكّ** — فتصير خبرًا بلا حدث.
 *   ③ **شرحٌ عامٌّ يسمّي الفئةَ كلَّها** بدل الحرف الذي أطلقها.
 *
 * والعلاجُ ليس الحذفَ (§1: المعرفةُ صحيحة، والتطبيقُ كان واسعًا)، بل:
 * قاعدتان بشرطَين دقيقَين، ولكلٍّ **شرحٌ يسمّي حرفَها**، ولا تنطلق
 * واحدةٌ منهما إلّا حيث كان الهمسُ/التجهيرُ **متوقَّعًا فامتنع**.
 */
registerRule({
  id: 'RU_SONORANT_KEEPS_VOICE',
  category: RULE_CATEGORY.VOICING,
  stage: STAGE.VOICING,
  priority: 610,
  summary: 'الرنّانةُ لا تُهمَس — لا في آخر الكلمة ولا قبل مهموس',
  explain: 'الرنّانات («л م н р й») مجهورة من غير زوج مهموس، فمبتفقدش جهرها.',
  source: `${MSU_ASSIM} + Грамота.ру`,
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **والشرطُ يسأل: هل كان الهمسُ متوقَّعًا هنا؟** رنّانةٌ بين حركتين
   *    (`име́ет`) لا أحدَ يتوقّع همسَها، فالكلامُ عنها حشوٌ لا درس.
   *    أمّا في آخر الكلمة (`стол`, `дом`) أو قبل مهموس (`полка`) فهو
   *    بالضبط الموضعُ الذي يُعمِّم فيه المتعلّم قاعدةَ الهمس فيُخطئ.
   */
  applies: (ctx) => isSonorant(ctx.letter)
    && (ctx.isFinal || (ctx.nextIsConsonant && ctx.nextVoiced === false)),
  describe: (ctx) => (ctx.isFinal
    ? `${q(ctx.letter)} رنّانة، فمبتفقدش جهرها في آخر الكلمة زيّ ما بيحصل مع «б د г».`
    : `${q(ctx.letter)} رنّانة، فمبتتهمسش رغم إن ${q(ctx.nextLetter)} اللي بعدها مهموسة.`),
  transform: () => ({ blocked: true }),
});

registerRule({
  id: 'RU_SONORANT_NO_TRIGGER',
  trigger: 'next',
  category: RULE_CATEGORY.VOICING,
  stage: STAGE.VOICING,
  priority: 612,
  summary: 'الرنّانةُ لا تُجهِّر المهموسَ الذي قبلها',
  explain: 'الرنّانات مبتجهّرش اللي قبلها — بعكس «б д г ж з».',
  source: `${MSU_ASSIM} + Грамота.ру`,
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **والمتأثِّرُ هنا مهموسٌ مزدوجٌ وحدَه.** لو كان ما قبل الرنّانة
   *    مجهورًا (`обмен`) فلا شيءَ كان سيقع أصلًا — التجهيرُ لا يقع على
   *    مجهور. فذكرُها هناك حشو، وذكرُها في `слово` درسٌ حقيقيّ: المتعلّم
   *    يسمع «الرنّانةُ مجهورة» فيتوقّع أن تُجهِّر الـ`с`، ولا تفعل.
   */
  applies: (ctx) => isPairedVoiceless(ctx.letter)
    && ctx.nextIsConsonant && isSonorant(ctx.nextLetter),
  describe: (ctx) => `${q(ctx.nextLetter)} رنّانة، فمش بتجهّر ${q(ctx.letter)} اللي قبلها — `
    + `بتفضل زيّ ما هي.`,
  transform: () => ({ blocked: true }),
});

registerRule({
  id: 'RU_VOICING_V_NEUTRAL',
  trigger: 'next',
  category: RULE_CATEGORY.VOICING,
  stage: STAGE.VOICING,
  priority: 620,
  summary: 'в لا تُجهِّر ما قبلها — وتُهمَس هي نفسُها',
  explain: '«в» غريبة: مبتجهّرش اللي قبلها، بس هي نفسها بتفقد جهرها في آخر الكلمة أو قدّام مهموس.',
  source: `${MSU_ASSIM} · «Исключением являются звонкие [в]/[в'] … перед которыми глухие согласные не озвончаются»`,
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **في اتّجاهٍ واحدٍ فقط.** المنعُ على «التجهير نحو اليسار» لا
   *    على `в` نفسِها: `любовь`←[lʲʊˈbofʲ] و`вчера`←[ftɕɪˈra]. واستنتاجُ
   *    «إذن `в` لا تُهمَس» خطأٌ شائعٌ يقلب الاستثناءَ على رأسه.
   *
   * ⚠️ **وشرطُ `nextVoiced`**: لو كانت `в` نفسُها قد هُمِست في دورةٍ
   *    سابقة (ونحن نمرّ يمينًا←يسارًا فقد هُمِست فعلًا) فهي حينئذٍ
   *    مُطلِقُ همسٍ عاديّ، ولا يبقى لها امتياز.
   */
  applies: (ctx) => ctx.nextLetter === 'в' && ctx.nextVoiced === true
    && isPairedVoiceless(ctx.letter),
  describe: (ctx) => `${q(ctx.letter)} مبتتجهّرش هنا: ${q('в')} اللي بعدها مجهورة، `
    + `بس هي الاستثناء الوحيد اللي مبيجهّرش اللي قبله.`,
  transform: () => ({ blocked: true }),
});

registerRule({
  id: 'RU_REGRESSIVE_DEVOICING',
  trigger: 'next',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.VOICING,
  priority: 630,
  summary: 'المجهورُ المزدوجُ يُهمَس قبل مهموس',
  explain: 'الحرف بيتأثّر باللي بعده: «лодка» بتتقال «лотка».',
  source: MSU_ASSIM,
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => isPairedVoiced(ctx.letter)
    && ctx.nextIsConsonant && ctx.nextVoiced === false,
  describe: (ctx) => `${q(ctx.nextLetter)} اللي بعدها مهموسة، فـ${q(ctx.letter)} بتتهمس معاها `
    + `وبتتسمع ${q(VOICED_TO_VOICELESS[ctx.letter])}.`,
  transform: (ctx) => ({ letter: VOICED_TO_VOICELESS[ctx.letter], voiced: false }),
});

registerRule({
  id: 'RU_REGRESSIVE_VOICING',
  trigger: 'next',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.VOICING,
  priority: 640,
  summary: 'المهموسُ المزدوجُ يُجهَّر قبل مجهورٍ مزدوج',
  explain: 'الحرف المهموس بيتجهّر قبل حرف مجهور: «просьба» بتتقال «прозьба».',
  source: MSU_ASSIM,
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **والمُطلِقُ يجب أن يكون مزدوجًا.** `х ц ч щ` مهموسةٌ بلا زوجٍ
   *    مجهور، فلا تُجهِّر شيئًا — والشرطُ `isPairedVoiced(next)` يمنع
   *    ذلك وحدَه بلا قائمة.
   */
  applies: (ctx) => isPairedVoiceless(ctx.letter)
    && ctx.nextIsConsonant && isPairedVoiced(ctx.nextLetter) && ctx.nextVoiced === true,
  describe: (ctx) => `${q(ctx.nextLetter)} اللي بعدها مجهورة، فـ${q(ctx.letter)} بتتجهّر معاها `
    + `وبتتسمع ${q(VOICELESS_TO_VOICED[ctx.letter])}.`,
  transform: (ctx) => ({ letter: VOICELESS_TO_VOICED[ctx.letter], voiced: true }),
});

/* ------------------------------------------------------------------ *
 * عبر حدود الكلمات — الكلامُ المتّصل (WS54)
 * ------------------------------------------------------------------ */

const MSU_CROSS = 'studme.org · «Ассимиляция в области согласных»: '
  + '«на стыке предлога со словом (к делу [g d\'elu]) … к бане [гбане], от дома [оддома]»';

/**
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الهمسُ النهائيُّ يمتنع قبل مجهورٍ في الكلمة التالية** (WS58)
 * ═══════════════════════════════════════════════════════════════
 *
 * **والعطبُ الذي أصلحته هذه القاعدة كان تناقضًا داخليًّا لا نقصَ تغطية.**
 *
 * كان المحرّك يقول:
 *   · `наш дом`  → `[наж дом]`  — لأن `RU_CROSS_WORD_VOICING` تُجهِّر.
 *   · `нож дом`  → `[нош дом]`  — لأن الهمسَ النهائيَّ (٦٠٠) يسبقها.
 *
 * فالساكنُ **المهموس** يُجهَّر قبل الكلمة المجهورة، و**المجهورُ** يُهمَس
 * قبلها. جملتان متناقضتان عن الحدّ الواحد، ولا واحدةَ منهما تُخطئ
 * قاعدةً بمفردها: `RU_CROSS_WORD_VOICING` صحيحةٌ، و`RU_FINAL_DEVOICING`
 * صحيحةٌ، والعطبُ في **ما بينهما** — أنّ الأولى لا تُطبَّق إلّا حيث لا
 * تصل الثانية. وهذه أخبثُ عائلةِ عطبٍ في محرّكِ قواعد.
 *
 * والوصفُ المعياريُّ يحسم: الهمسُ في آخر **الكلمة الصوتيّة** يقع قبل
 * الوقفة، وقبل حركةٍ، وقبل رنّانة، وقبل `в`/`j`، وقبل مهموس — **ولا
 * يقع قبل عائقٍ مجهور**، فتغلب المماثلةُ الرجعيّةُ ويبقى الجهر.
 *
 * ⚠️ **ودليلُها هو دليلُ أختِها لا دليلٌ جديد.** المصدرُ نفسُه
 *    (`MSU_CROSS`) يعطي `от дома [оддома]`: `т` تُجهَّر قبل `д` عبر
 *    الحدّ. وعكسُها — أنّ `д` لا تُهمَس في الموضع نفسِه — هو الوجهُ
 *    الثاني للظاهرة عينِها. ولذلك نفسُ الحالة `PROVISIONAL` ونفسُ
 *    التحفّظ: **لا نعرف أين تقف أنت** (`RU_CROSS_WORD_PROSODY`).
 *
 * ⚠️ **وهي «مانعة» لا «مُحوِّلة» — والفرقُ مقصود.** لا تفعل شيئًا
 *    بالصوت: تمنع ٦٠٠ من الوصول إليه فحسب. فيبقى الجهرُ الأصليُّ كما
 *    بُني، ويُسجَّل في الأثر **سببُ بقائه** — وهو ما يعلّمه بند ٧هـ.
 */
registerRule({
  id: 'RU_CROSS_WORD_VOICED_KEPT',
  trigger: 'nextWord',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.VOICING,
  /* ⚠️ **قبل ٦٠٠ وإلّا لم تُطلَق مرّةً واحدة** — «أوّلُ مطابِقٍ يفوز». */
  priority: 590,
  summary: 'المجهورُ في آخر الكلمة يبقى مجهورًا قبل عائقٍ مجهورٍ في الكلمة التالية',
  explain: 'الكلمتين بيتنطقوا ملزوقين، فالحرف المجهور في الآخر مبيفقدش جهره — «нож был» بتتقال «نوж بыл» مش «нош».',
  source: `${MSU_CROSS} — الوجهُ الثاني للظاهرة نفسِها`,
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **و`в` والرنّاناتُ مستثناةٌ هنا كما في ٦٥٠ — بل هنا آكد.**
   *    الوصفُ المعياريُّ يذكر `в` و`j` والرنّاناتِ صراحةً ضمن ما **يقع
   *    الهمسُ قبله**: `раз в день` → `[рас]`, `нож мой` → `[нош]`.
   *    فلو نسيناها لجعلنا `в` تحمي الجهرَ وهي لا تُجهِّر أصلًا — نفسُ
   *    الخطأ الذي وقع في ٦٥٠ أوّلَ مرّة، من الباب نفسِه.
   */
  scope: SCOPE.CONNECTED_SPEECH,
  applies: (ctx) => ctx.isFinal && Boolean(ctx.nextWordFirst)
    && isPairedVoiced(ctx.letter)
    && isPairedVoiced(ctx.nextWordFirst)
    && ctx.nextWordFirst !== 'в'
    && !isSonorant(ctx.nextWordFirst),
  describe: (ctx) => `الكلمة اللي بعدها بتبدأ بـ${q(ctx.nextWordFirst)} المجهورة، `
    + `فـ${q(ctx.letter)} مبتفقدش جهرها هنا رغم إنها في آخر الكلمة.`,
  transform: () => ({ blocked: true, crossWord: true }),
});

registerRule({
  id: 'RU_CROSS_WORD_VOICING',
  trigger: 'nextWord',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.VOICING,
  priority: 650,
  summary: 'آخرُ الكلمة يُجهَّر قبل مجهورٍ مزدوجٍ في أوّل الكلمة التالية',
  explain: 'الكلمتين بيتنطقوا ملزوقين: «к делу» بتتقال «гделу» — الـ«к» بتتجهّر.',
  source: MSU_CROSS,
  /*
   * ⚠️ **مبدئيّةٌ لا مُتحقَّقة — والسببُ في المصدر نفسِه.**
   *    يشترط «слов, произносимых без паузы»: أي أن المماثلةَ تقع إن
   *    وُصلت الكلمتان بلا وقفة. **ونحن لا نعرف أين تقف أنت.** فنُطبّقها
   *    على الجار المباشر ونُعلن الشرطَ الذي لا نملكه — راجع
   *    `RU_CROSS_WORD_PROSODY` في المؤجَّل.
   */
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **واستثناءُ `в` والرنّانات يعبر الحدَّ معها — ونسيتُه أوّلَ مرّة.**
   *
   * كتبتُ الشرطَ «مهموسٌ قبل مجهورٍ مزدوج» فحسب، فخرجت
   * «докуме́нт все» → `[дъкум'э́нд]`: الـ`т` تجهّرت قبل `в`. وهو نفسُ
   * الخطأ الذي تحرس منه `RU_VOICING_V_NEUTRAL` **داخل** الكلمة —
   * وقد تسلّل من الباب الخلفيّ حين عبرنا الحدّ.
   *
   * والدرسُ أن قاعدةً جديدةً تعمل في سياقٍ جديدٍ لا ترث الموانعَ
   * تلقائيًّا: كلُّ مانعٍ يُعاد ذكرُه أو يُعاد اكتشافُه بخطأٍ مرئيّ.
   */
  scope: SCOPE.CONNECTED_SPEECH,
  applies: (ctx) => ctx.isFinal && Boolean(ctx.nextWordFirst)
    && isPairedVoiceless(ctx.letter)
    && isPairedVoiced(ctx.nextWordFirst)
    && ctx.nextWordFirst !== 'в'
    && !isSonorant(ctx.nextWordFirst),
  describe: (ctx) => `${q(ctx.letter)} في آخر الكلمة بتتنطق ${q(ctx.letter)} لوحدها — `
    + `بس لو وصلتها بالكلمة اللي بعدها من غير وقفة، `
    + `${q(ctx.nextWordFirst)} المجهورة بتقرّبها من ${q(VOICELESS_TO_VOICED[ctx.letter])}.`,
  transform: (ctx) => ({ letter: VOICELESS_TO_VOICED[ctx.letter], voiced: true, crossWord: true }),
});

registerRule({
  id: 'RU_CROSS_WORD_DEVOICING',
  trigger: 'nextWord',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.VOICING,
  /*
   * ⚠️ **كانت ٦٦٠ — أي أنها لم تُطلَق مرّةً واحدةً منذ كُتبت** (WS58).
   *
   * قاعدةُ الهمس النهائيّ (٦٠٠) تسبقها، وشرطُها أوسع (`isFinal` وحدَه)،
   * و«أوّلُ مطابِقٍ يفوز» — فكلُّ حالةٍ تصلح لهذه تلتقطها تلك أوّلًا.
   * كودٌ ميّتٌ لا يُسقِط اختبارًا لأن **النتيجةَ الصوتيّةَ صحيحةٌ على
   * أيّ حال**: الحرفُ يُهمَس بالقاعدتين معًا. الضائعُ هو **التفسير** —
   * والبندُ ٧هـ يطلبه صراحةً: «الصوتُ اللي بعده أثّر على اللي قبله»،
   * ولو عبر حدّ الكلمة.
   *
   * فنُقدِّمها إلى ٥٩٥. والمخرَجُ لا يتغيّر حرفًا، والأثرُ يتغيّر كلَّه.
   */
  priority: 595,
  summary: 'آخرُ الكلمة يُهمَس قبل مهموسٍ في أوّل الكلمة التالية',
  /*
   * ⚠️ **والصياغةُ تذكر السببين لا سببًا واحدًا — وهذا شرطُ صدقها.**
   *    `нож` مهموسةُ الآخرِ وحدَها بلا جار. فلو قلنا «الكلمةُ التالية
   *    همستها» لادّعينا سببًا ليس وحدَه كافيًا ولا وحدَه لازمًا. أمّا
   *    «مهموسٌ من ناحيتين» فصادقةٌ في الحالتين.
   */
  explain: 'آخر الكلمة بيتهمس أصلًا — وهنا كمان اللي بعده مهموس، فالهمس مأكّد من ناحيتين.',
  source: MSU_CROSS,
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  scope: SCOPE.CONNECTED_SPEECH,
  applies: (ctx) => ctx.isFinal && Boolean(ctx.nextWordFirst)
    && isPairedVoiced(ctx.letter)
    && (isPairedVoiceless(ctx.nextWordFirst) || 'хцчщ'.includes(ctx.nextWordFirst)),
  describe: (ctx) => `${q(ctx.letter)} بتتهمس في آخر الكلمة أصلًا، `
    + `و${q(ctx.nextWordFirst)} اللي بتبدأ بيها الكلمة اللي بعدها مهموسة كمان — `
    + `فالهمس مأكّد من ناحيتين.`,
  transform: (ctx) => ({ letter: VOICED_TO_VOICELESS[ctx.letter], voiced: false, crossWord: true }),
});

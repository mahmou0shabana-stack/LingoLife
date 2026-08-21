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
  registerRule, RULE_CATEGORY, STAGE, STATUS, EVIDENCE,
} from '../rule-registry.js';
import {
  VOICED_TO_VOICELESS, VOICELESS_TO_VOICED, isSonorant, isPairedVoiced, isPairedVoiceless,
} from '../alphabet.js';

const MSU_ASSIM = 'МГУ · fonetica/kons/n-21.htm «Ассимиляция согласных по глухости/звонкости»';

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
  applies: (ctx) => ctx.isFinal && isPairedVoiced(ctx.letter),
  transform: (ctx) => ({ letter: VOICED_TO_VOICELESS[ctx.letter], voiced: false }),
});

registerRule({
  id: 'RU_VOICING_SONORANT_NEUTRAL',
  category: RULE_CATEGORY.VOICING,
  stage: STAGE.VOICING,
  priority: 610,
  summary: 'الرنّاناتُ لا تُطلِق مماثلةً ولا تُهمَس',
  explain: '«л م н р й» مبيأثّروش على اللي قبلهم، ومبيفقدوش جهرهم.',
  source: `${MSU_ASSIM} + Грамота.ру`,
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **قاعدةٌ مانعةٌ تُسجَّل في الأثر.** كان يكفي أن تصمت القواعدُ
   *    الأخرى فلا يحدث شيء — لكنّ **الصمتَ لا يُعلِّم**. المتعلّم يحتاج
   *    أن يقرأ: «`л` هنا حمَت الـ`с` من التجهير»، لا أن يرى غيابًا
   *    يظنّه سهوًا. ولذلك تُطلَق صراحةً وتُوقف البقيّة.
   */
  applies: (ctx) => isSonorant(ctx.letter)
    || (Boolean(ctx.nextLetter) && isSonorant(ctx.nextLetter)),
  transform: () => ({ blocked: true }),
});

registerRule({
  id: 'RU_VOICING_V_NEUTRAL',
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
  transform: () => ({ blocked: true }),
});

registerRule({
  id: 'RU_REGRESSIVE_DEVOICING',
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
  transform: (ctx) => ({ letter: VOICED_TO_VOICELESS[ctx.letter], voiced: false }),
});

registerRule({
  id: 'RU_REGRESSIVE_VOICING',
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
  transform: (ctx) => ({ letter: VOICELESS_TO_VOICED[ctx.letter], voiced: true }),
});

/* ------------------------------------------------------------------ *
 * عبر حدود الكلمات — الكلامُ المتّصل (WS54)
 * ------------------------------------------------------------------ */

const MSU_CROSS = 'studme.org · «Ассимиляция в области согласных»: '
  + '«на стыке предлога со словом (к делу [g d\'elu]) … к бане [гбане], от дома [оддома]»';

registerRule({
  id: 'RU_CROSS_WORD_VOICING',
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
  applies: (ctx) => ctx.isFinal && Boolean(ctx.nextWordFirst)
    && isPairedVoiceless(ctx.letter)
    && isPairedVoiced(ctx.nextWordFirst)
    && ctx.nextWordFirst !== 'в'
    && !isSonorant(ctx.nextWordFirst),
  transform: (ctx) => ({ letter: VOICELESS_TO_VOICED[ctx.letter], voiced: true, crossWord: true }),
});

registerRule({
  id: 'RU_CROSS_WORD_DEVOICING',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.VOICING,
  priority: 660,
  summary: 'آخرُ الكلمة يُهمَس قبل مهموسٍ في أوّل الكلمة التالية',
  explain: 'وبالعكس: الحرف المجهور في آخر الكلمة بيفقد جهره لو اللي بعده مهموس.',
  source: MSU_CROSS,
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **ولا تُضيف شيئًا فوق الهمس النهائيّ (٦٠٠) إلّا في الترير.**
   *    الحرفُ في آخر الكلمة مهموسٌ أصلًا بقاعدة ٦٠٠. وهذه تُسجّل
   *    **السببَ الثاني** حين يوجد: أن ما بعده مهموسٌ أيضًا. فالنتيجةُ
   *    واحدةٌ والتفسيرُ أغنى — وهو ما يطلبه المتعلّم.
   */
  applies: (ctx) => ctx.isFinal && Boolean(ctx.nextWordFirst)
    && isPairedVoiced(ctx.letter)
    && (isPairedVoiceless(ctx.nextWordFirst) || 'хцчщ'.includes(ctx.nextWordFirst)),
  transform: (ctx) => ({ letter: VOICED_TO_VOICELESS[ctx.letter], voiced: false, crossWord: true }),
});

/**
 * LingoLife — القواعدُ الأورثوإبيّة على مستوى الحروف (WS52 · ٣٠٠–٣٦٠)
 *
 * ⚠️ **ولماذا على الحروف قبل الأصوات؟**
 *
 * لأن المصادرَ تصف هذه الظواهرَ إملائيًّا: «سُكونُ `т` في `стн`»،
 * «`-ого` تُنطَق `-ово`». وتطبيقُها على الحروف يجعل ناتجَها يدخل
 * بقيّةَ خطّ المعالجة **كأنه مكتوبٌ هكذا أصلًا**: فالـ`в` الناتجةُ من
 * `-ого` تُهمَس وتُختزَل حركتُها كأيّ `в`، بلا سطرٍ خاصٍّ يتذكّرها.
 *
 * ⚠️ **وثابتٌ يحرسه اختبار**: ولا واحدةٌ من هذه الإعادات تُغيّر **عددَ
 *    حروف العلّة**. عليه يقوم `stress-resolver` كلُّه (رقمُ الحركة لا
 *    موضعُ الحرف). فلو أضاف أحدٌ غدًا قاعدةً تحذف حركةً أو تزيدها،
 *    انكسر النبرُ في كلّ كلمة — والاختبارُ يمسكها في نفس اللحظة.
 */

import {
  registerRule, RULE_CATEGORY, STAGE, STATUS, EVIDENCE,
} from '../rule-registry.js';
import { isGoEndingExcluded, isChnShn } from '../pronunciation-lexicon.js';

/** ساكنان متماثلان متجاوران — يصيران صوتًا واحدًا طويلًا. */
const GEMINATE = /([бвгджзклмнпрстфхц])\1/g;

/** أداةٌ صغيرة: استبدالٌ يسجّل ما غيّره. */
function swap(word, pattern, replacer) {
  const hits = [];
  const out = word.replace(pattern, (...args) => {
    const at = args[args.length - 2];
    const match = args[0];
    const to = replacer(...args);
    if (to !== match) hits.push({ at, from: match, to });
    return to;
  });
  return hits.length ? { word: out, hits } : null;
}

registerRule({
  id: 'RU_ORTHO_GO_ENDING',
  category: RULE_CATEGORY.ORTHOEPY,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 300,
  summary: 'نهايةُ المضاف إليه ‎-ого/-его تُنطَق ‎-ово/-ево',
  explain: 'آخر الصفات والضمائر «-ого» و«-его» بتتنطق «-ово» و«-ево» — الـ«г» بتبقى «в».',
  source: 'orfogrammka.ru · «Буква г в окончаниях -ого/-его»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **والشرطُ المانعُ أهمُّ من الشرط المُطلِق هنا.**
   *    `много` تنتهي بـ`ого` وليست نهايةً صرفيّة. ولولا المنعُ لصارت
   *    «мнова» — على كلمةٍ من أكثر كلمات الروسيّة ورودًا. راجع
   *    `GO_ENDING_EXCLUSIONS` في المعجم.
   */
  applies: (word) => /(?:ог|ег)о$/.test(word) && !isGoEndingExcluded(word),
  transform: (word) => swap(word, /(ог|ег)о$/, (_m, head) => `${head[0]}во`),
});

registerRule({
  id: 'RU_ORTHO_CHN_SHN',
  category: RULE_CATEGORY.ORTHOEPY,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 310,
  summary: 'чн تُنطَق شн في مجموعةٍ معجميّةٍ مغلقة',
  explain: 'دي حالة معجمية خاصة: «конечно» بتتنطق «конешно» — مش قاعدة لكل «чн».',
  source: 'МГУ · orfoepija/tabl/chn_cht_zhd.htm + russkiymir.ru',
  status: STATUS.LEXICAL,
  evidence: EVIDENCE.SNIPPET,
  /* ⚠️ قائمةٌ مغلقةٌ لا نمطٌ عامّ: `точный` و`прочный` تبقيان كما هما. */
  applies: (word) => isChnShn(word) && word.includes('чн'),
  transform: (word) => swap(word, /чн/g, () => 'шн'),
});

registerRule({
  id: 'RU_ORTHO_GK_HK',
  category: RULE_CATEGORY.ORTHOEPY,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 320,
  summary: 'гк/гч تُنطَقان хк/хч في جذرَي لёг- ومяг-',
  explain: '«мягкий» بتتنطق «мяхкий» — الـ«г» بتبقى «х» عشان تسهّل النطق.',
  source: 'أورثوإبيا · «Сочетания гк, гч произносятся как [хк], [хч\']»',
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **مقيَّدةٌ بالجذر لا بالعنقود.** الظاهرةُ تخالفٌ (диссимиляция)
   *    موصوفٌ لهذين الجذرين؛ وتعميمُها على كلّ `гк` ادّعاءٌ لم يصل
   *    عليه دليل.
   */
  applies: (word) => /^(?:лёг|лег|мяг|мягч|легч)/.test(word) && /г[кч]/.test(word),
  transform: (word) => swap(word, /г([кч])/g, (_m, next) => `х${next}`),
});

registerRule({
  id: 'RU_CLUSTER_UNPRONOUNCED',
  category: RULE_CATEGORY.CONSONANT_CLUSTER,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 330,
  summary: 'ساكنٌ لا يُنطَق داخل عناقيدَ بعينها',
  explain: 'فيه حرف مكتوب ومش بيتنطق — «местный» بتتقال «месный».',
  source: 'МГУ · orfoepija/sochetan.htm',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (word) => /стн|здн|нтск|ндск|рдц|лнц/.test(word)
    || (word.indexOf('стл') > 0),
  transform: (word) => {
    const hits = [];
    let out = word;
    const drop = [
      [/стн/g, 'сн'], [/здн/g, 'зн'],
      [/нтск/g, 'нск'], [/ндск/g, 'нск'],
      [/рдц/g, 'рц'], [/лнц/g, 'нц'],
    ];
    for (const [pattern, to] of drop) {
      const step = swap(out, pattern, () => to);
      if (step) { out = step.word; hits.push(...step.hits); }
    }
    /*
     * ⚠️ **و`стл` تُشترَط ألّا تكون في أوّل الكلمة.** `счастливый`
     *    تُختزَل، لكنّ `стлать` تُنطَق كاملةً — العنقودُ فيها بدايةُ
     *    جذرٍ لا التقاءَ لواحق. شرطُ الموضع أرخصُ من قائمةِ استثناءات.
     */
    if (out.indexOf('стл') > 0) {
      const step = swap(out, /(?!^)стл/g, () => 'сл');
      if (step) { out = step.word; hits.push(...step.hits); }
    }
    return hits.length ? { word: out, hits } : null;
  },
});

registerRule({
  id: 'RU_CLUSTER_SH_LONG',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 332,
  summary: 'сш/зш على حدّ السابقة أو اللاحقة → [ʂː] طويلةٌ صلبة',
  explain: '«сш» و«зш» بيتنطقوا «ш» واحدة طويلة — «несший» بتتقال «нешший».',
  source: 'أورثوإبيا · «Сочетания сж, зж, сш, зш … произносятся как долгие твердые [ж], [ш]: несший — не[ш]ий»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (word) => /[сз]ш/.test(word),
  transform: (word) => swap(word, /[сз]ш/g, () => 'шш'),
});

registerRule({
  id: 'RU_CLUSTER_ZH_LONG',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 333,
  summary: 'сж/зж على حدّ السابقة → [ʐː] طويلةٌ صلبة',
  explain: '«сж» و«зж» بيتنطقوا «ж» واحدة طويلة — «сжать» بتتقال «жжать».',
  source: 'أورثوإبيا · «сжать – [ж]ать, разжать – ра[ж]ать»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **حدُّ السابقة وحدَه — و`зж`/`жж` داخل الجذر مؤجَّلة.**
   *    المصدرُ يعطي للجذر وجهين («долгий мягкий [ж'ж'] или твёрдый
   *    [жж]») ولا يحسم. فنكتفي بما حُسِم: `сж`/`зж` في أوّل الكلمة أو
   *    بعد سابقة. راجع `RU_ZH_LONG_IN_ROOT` في المؤجَّل.
   */
  applies: (word) => /^[сз]ж/.test(word) || /^(?:раз|из|воз|без|над|под)ж/.test(word),
  transform: (word) => swap(word, /^([сз])ж|^((?:раз|из|воз|без|над|под))ж/,
    (_m, a, pre) => (a ? 'жж' : `${pre.slice(0, -1)}жж`)),
});

registerRule({
  id: 'RU_CLUSTER_TS_DS',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 334,
  summary: 'тс/дс قبل لاحقة ‎-ск- تُنطَقان [ц]',
  explain: '«советский» بتتقال «совецкий» — الـ«тс» بتبقى «ц».',
  source: 'أورثوإبيا · «Сочетания тс, дс на стыке корня и суффикса произносится как [ц]: заво[ц]кой»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /* ⚠️ مقيَّدةٌ بلاحقةِ النسبة — لا كلُّ `тс` في اللغة. */
  applies: (word) => /[тд]ск/.test(word),
  transform: (word) => swap(word, /[тд]ск/g, () => 'цк'),
});

registerRule({
  id: 'RU_GEMINATION',
  category: RULE_CATEGORY.CONSONANT_CLUSTER,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 335,
  summary: 'الساكنان المتماثلان يُنطَقان صوتًا واحدًا طويلًا',
  explain: 'الحرف المكرَّر بيتنطق صوت واحد بس أطول — «ванна» مش «ван-на».',
  source: 'МГУ · orfoepija/dolgije.htm «Двойные согласные произносятся как один долгий звук»',
  /*
   * ⚠️ **مبدئيّةٌ لأن المصدرَ نفسَه يستثني:** «Не во всех иноязычных
   *    словах двойным согласным на письме соответствует долгое
   *    звучание». فالقاعدةُ صحيحةٌ في الأصيل، ومداها في المُعرَّب
   *    غيرُ محسوم. ولذلك نُعلّمها `PROVISIONAL` لا `VERIFIED`.
   */
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  applies: (word) => GEMINATE.test(word),
  /*
   * ⚠️ **تُسجِّل ولا تُعيد الكتابة — والدمجُ في بناء الأصوات.**
   *
   * جرّبتُ أوّلًا أن أكتب `нн` ← `нː` هنا، فخرجت `ː` حرفًا لا يعرفه
   * جدولُ الأصوات فسقط المقطعُ كلُّه إلى «غير مغطّى». والصوابُ أن
   * إعادةَ الكتابة تعمل على **حروفٍ روسيّة** فقط، وأن الطولَ صفةُ
   * صوتٍ لا حرفٌ في الكلمة. فيبقى الحرفان هنا، ويجمعهما
   * `buildSegments` في صوتٍ واحدٍ موسومٍ بـ`long`.
   */
  transform: (word) => {
    const hits = [];
    GEMINATE.lastIndex = 0;
    let m;
    while ((m = GEMINATE.exec(word)) !== null) {
      hits.push({ at: m.index, from: m[0], to: `${m[1]}ː` });
    }
    return hits.length ? { word, hits } : null;
  },
});

registerRule({
  id: 'RU_CLUSTER_SCH_ZCH',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 340,
  summary: 'сч/зч تُنطَقان صوتًا واحدًا طويلًا ليّنًا [ɕː]',
  explain: '«сч» بتتنطق زيّ «щ» — صوت واحد طويل وليّن.',
  source: 'МГУ · orfoepija/tabl/sch.htm',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (word) => /[сз]ч/.test(word),
  transform: (word) => swap(word, /[сз]ч/g, () => 'щ'),
});

registerRule({
  id: 'RU_CLUSTER_TSYA',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 350,
  summary: 'نهايةُ الفعل ‎-тся/-ться تُنطَق [ца]',
  explain: '«-тся» و«-ться» الاتنين بيتنطقوا «-ца».',
  source: 'МГУ · orfoepija/sochetan.htm',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /* ⚠️ نهايةُ كلمةٍ حصرًا — ولا تُطلَق في وسطها. */
  applies: (word) => /(?:ться|тся)$/.test(word),
  transform: (word) => swap(word, /(?:ться|тся)$/, () => 'ца'),
});

registerRule({
  id: 'RU_CLUSTER_TCH_DCH',
  category: RULE_CATEGORY.ASSIMILATION,
  stage: STAGE.ORTHOEPIC_REWRITE,
  priority: 360,
  summary: 'тч/дч تندمجان في ч واحدة',
  explain: 'الحرفين «тч» بيندمجوا في صوت «ч» واحد — «лётчик» بتتقال «лёчик».',
  source: 'МГУ · orfoepija/tabl/tch.htm',
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **ولا ندّعي طولًا.** المصدرُ يصف [ч':] طويلة، ونحن نُخرج `ч`
   *    واحدةً بلا علامةِ طول — لأن تمثيلَ الطول يحتاج آليّةً لم
   *    نبنِها، وادّعاءُ رمزٍ لا تُنتجه القواعدُ تزييفٌ مهما صغر.
   */
  applies: (word) => /[тд]ч/.test(word),
  transform: (word) => swap(word, /[тд]ч/g, () => 'ч'),
});

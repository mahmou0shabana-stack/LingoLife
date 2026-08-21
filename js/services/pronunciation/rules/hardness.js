/**
 * LingoLife — الصلابةُ والليونة (WS52 · ٤٠٠–٤٣٠)
 *
 * ⚠️ **أوّلُ مطابِقٍ يفوز، والترتيبُ هو المعنى.**
 *
 * `ж ш ц` صلبةٌ دائمًا **مهما تلاها** — فلو جاءت قاعدةُ «يلين قبل
 * `и`» أوّلًا لأنتجت `жʲ` وهو صوتٌ لا وجود له في الروسيّة. ولذلك
 * القاعدتان المطلقتان (٤٠٠ و٤١٠) **قبل** المشروطتين (٤٢٠ و٤٣٠)،
 * والرقمُ هو ما يضمن ذلك لا ترتيبُ السطور.
 */

import {
  registerRule, RULE_CATEGORY, STAGE, STATUS, EVIDENCE,
} from '../rule-registry.js';
import { ALWAYS_HARD, ALWAYS_SOFT, SOFTENING_VOWELS } from '../alphabet.js';

/**
 * مُعرَّباتٌ يبقى ساكنُها صلبًا قبل `е` — بدليلٍ صريحٍ لكلٍّ منها.
 * ⚠️ ولا يُضاف إليها بالحدس: ما لا مصدرَ له يبقى خارجَها.
 */
const LOAN_HARD_E = new Set(['антре', 'безе', 'гофре', 'кюре', 'пастель']);

registerRule({
  id: 'RU_CONS_ALWAYS_HARD',
  category: RULE_CATEGORY.HARDNESS,
  stage: STAGE.HARDNESS,
  priority: 400,
  summary: 'ж ش ц صلبةٌ دائمًا مهما تلاها',
  explain: '«ж» و«ш» و«ц» صلبين دايمًا — حتى لو بعدهم «и» أو «е» أو «ь».',
  source: 'Грамота.ру · «Твёрдые и мягкие согласные звуки»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => ALWAYS_HARD.includes(ctx.letter),
  transform: () => ({ soft: false }),
});

registerRule({
  id: 'RU_CONS_ALWAYS_SOFT',
  category: RULE_CATEGORY.HARDNESS,
  stage: STAGE.HARDNESS,
  priority: 410,
  summary: 'ч щ й ليّنةٌ دائمًا مهما تلاها',
  explain: '«ч» و«щ» و«й» ليّنين دايمًا — حتى قدّام «а» و«о» و«у».',
  source: 'Грамота.ру · «Твёрдые и мягкие согласные звуки»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => ALWAYS_SOFT.includes(ctx.letter),
  transform: () => ({ soft: true }),
});

registerRule({
  id: 'RU_PALATALIZATION_BY_VOWEL',
  category: RULE_CATEGORY.PALATALIZATION,
  stage: STAGE.HARDNESS,
  priority: 420,
  summary: 'الساكنُ المزدوجُ يلين قبل е ё и ю я',
  explain: 'الحرف بيلين قدّام «е ё и ю я» — الـ«л» في «лес» مش زيّ الـ«л» في «лапа».',
  source: 'Грамота.ру · «Твёрдые и мягкие согласные звуки»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => Boolean(ctx.next) && SOFTENING_VOWELS.includes(ctx.next),
  transform: () => ({ soft: true }),
});

registerRule({
  id: 'RU_PALATALIZATION_BY_SOFT_SIGN',
  category: RULE_CATEGORY.PALATALIZATION,
  stage: STAGE.HARDNESS,
  priority: 430,
  summary: 'ь تليّن ما قبلها ولا صوتَ لها',
  explain: '«ь» مالهاش صوت — شغلتها إنها تليّن الحرف اللي قبلها.',
  source: 'Грамота.ру · «Твёрдые и мягкие согласные звуки»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **وبعد `ж ш ц ч щ` تكون `ь` علامةً صرفيّةً لا صوتيّة**
   *    (`мышь`, `ночь`, `рожь`). والقاعدتان ٤٠٠/٤١٠ تسبقانها فتفوزان،
   *    فلا تصل هذه إلى تلك الحروف أصلًا — **الترتيبُ يكفي، ولا حاجةَ
   *    لشرطٍ مكرَّرٍ هنا**. ولو عُكس الترتيبُ يومًا لظهر العطبُ فورًا
   *    في اختبارات `мышь` و`ночь`.
   */
  applies: (ctx) => ctx.next === 'ь',
  transform: () => ({ soft: true }),
});

registerRule({
  id: 'RU_SOFTNESS_ASSIMILATION',
  category: RULE_CATEGORY.PALATALIZATION,
  stage: STAGE.HARDNESS,
  priority: 440,
  summary: 'س/ز قبل ساكنٍ أسنانيٍّ ليّن: تليينٌ **اختياريّ**',
  explain: 'زمان كانوا بيقولوا «сьнег» و«зьдесь» بتليين. دلوقتي الاتنين مقبولين، والأغلب بينطقها صلبة.',
  source: 'МГУ · fonetica/kons/n-27.htm + «ассимилятивное смягчение … факультативно, необязательно»',
  /*
   * ⚠️ **مُختلَفٌ فيها — ولذلك لا تُحوِّل شيئًا.**
   *
   * المصدرُ صريح: التليينُ المماثِل **آخذٌ في الاختفاء**، وكان لازمًا
   * حتى منتصف القرن العشرين، وبقي في نطق المسرح إلى آخره، وهو اليوم
   * «اختياريٌّ غيرُ مطّرد» يوجد عند بعض المتحدّثين ويغيب عند غيرهم.
   *
   * فلو ليّنّا `с` في `снег` لعلّمناك نطقًا **قديمًا** على أنه المعيار.
   * ولو سكتنا لأخفينا ظاهرةً ستسمعها من متحدّثين كبار. فالحلُّ الثالث:
   * **تنطلق القاعدة، وتقول إن هناك وجهين، ولا تمسّ الصوت**. وهذا هو
   * معنى `DISPUTED` عمليًّا — لا وسمٌ على ورق.
   */
  status: STATUS.DISPUTED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => 'сз'.includes(ctx.letter)
    && 'тднсзл'.includes(ctx.next || '')
    && SOFTENING_VOWELS.includes(ctx.afterNext || ''),
  /* ⚠️ `soft` تبقى كما قرّرتها القواعدُ قبلها؛ نُضيف وسمًا لا تحويلًا. */
  transform: (ctx) => ({ soft: ctx.soft, variant: 'قد تُنطق ليّنة عند بعض المتحدّثين' }),
});

registerRule({
  id: 'RU_LOANWORD_HARD_BEFORE_E',
  category: RULE_CATEGORY.HARDNESS,
  stage: STAGE.HARDNESS,
  /*
   * ⚠️ **قبل التليين العامّ (٤٢٠) لا بعده — والترتيبُ هو كلُّ القاعدة.**
   *    وضعتُها أوّلًا عند ٤٥٠ فلم تنطلق مرّةً واحدة: «أوّلُ مطابِقٍ
   *    يفوز»، و٤٢٠ ترى `е` بعد `т` فتُليّنها وتنتهي المسألة. فقاعدةٌ
   *    مكتوبةٌ ومختبَرةُ الشروطِ ولا تعمل أبدًا — لأن رقمَها خطأ.
   */
  priority: 415,
  summary: 'مُعرَّباتٌ يبقى الساكنُ فيها صلبًا قبل e',
  explain: 'في كلمات مستوردة الحرف بيفضل صلب قبل «е» — «пасте́ль» بتتقال «пастэль».',
  source: 'أورثوإبيا · «Устойчиво сохраняют произношение твёрдого согласного слова, заимствованные из французского с конечным ударным слогом: антре́, безе́, гофре́, кюре́, пасте́ль»',
  /*
   * ⚠️ **قائمةٌ قصيرةٌ عمدًا — والعريضةُ مؤجَّلةٌ بنصّ المصدر نفسِه:**
   *    «В связи с отсутствием твёрдых правил и меняющейся нормой
   *    эталонное произношение следует выяснять из орфоэпических
   *    словарей». أي أن المصدرَ يقول: لا قاعدةَ، ارجع لمعجم. ونحن لا
   *    نملك حقَّ نسخِ معجم، فلا نخترع قائمةً من عندنا (§39).
   */
  status: STATUS.LEXICAL,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => ctx.next === 'е' && LOAN_HARD_E.has(ctx.word),
  transform: () => ({ soft: false, loan: true }),
});

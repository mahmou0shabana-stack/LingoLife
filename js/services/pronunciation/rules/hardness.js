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
  registerRule, RULE_CATEGORY, STAGE, CONFIDENCE, EVIDENCE,
} from '../rule-registry.js';
import { ALWAYS_HARD, ALWAYS_SOFT, SOFTENING_VOWELS } from '../alphabet.js';

registerRule({
  id: 'RU_CONS_ALWAYS_HARD',
  category: RULE_CATEGORY.HARDNESS,
  stage: STAGE.HARDNESS,
  priority: 400,
  summary: 'ж ش ц صلبةٌ دائمًا مهما تلاها',
  explain: '«ж» و«ш» و«ц» صلبين دايمًا — حتى لو بعدهم «и» أو «е» أو «ь».',
  source: 'Грамота.ру · «Твёрдые и мягкие согласные звуки»',
  confidence: CONFIDENCE.HIGH,
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
  confidence: CONFIDENCE.HIGH,
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
  confidence: CONFIDENCE.HIGH,
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
  confidence: CONFIDENCE.HIGH,
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

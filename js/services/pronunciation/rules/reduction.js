/**
 * LingoLife — اختزالُ الحركات (WS52 · ٥٠٠–٥٥٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الخرافةُ التي **لا** يُنفِّذها هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * «كلُّ `о` غير مشدّدة تبقى `а`» — هذا ما يقوله نصفُ الإنترنت، وهو
 * **خطأ**. الصحيحُ درجتان:
 *
 *   молоко́   →   [мъ-ла-ко́]
 *                  ↑   ↑
 *                  │   └── الدرجةُ الأولى: قبل النبر مباشرةً → [ɐ]
 *                  └────── الدرجةُ الثانية: أبعد → [ə]
 *
 * فلو صيّرنا الاثنتين `а` واحدةً لكنّا **علّمنا الخرافةَ** ونحن نظنّ
 * أننا نُعلّم قاعدة. والفرقُ مسموعٌ حقًّا، وهو نصفُ «اللكنة».
 *
 * ═══════════════════════════════════════════════════════════════
 * وكلُّ قاعدةٍ هنا **تمتنع إن كان النبرُ مجهولًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن «الدرجةَ الأولى» و«الثانية» تُعرَّفان بالنسبة إلى موضع النبر.
 * فبلا نبرٍ لا موضعَ ولا درجة — والامتناعُ هو الجواب، لا الافتراضُ أن
 * النبرَ على الأخير. راجع `docs/russian-pronunciation-spec.md §20.6`.
 */

import {
  registerRule, RULE_CATEGORY, STAGE, STATUS, EVIDENCE,
} from '../rule-registry.js';
import { VOWEL_SOUND, ALWAYS_HARD } from '../alphabet.js';

/**
 * درجةُ الاختزال بحسب الموضع.
 *  ١ · المقطعُ السابقُ للنبر مباشرةً، **أو** بدايةُ الكلمة المطلقة.
 *  ٢ · ما عدا ذلك.
 */
function degreeOf(ctx) {
  if (ctx.ordinal === ctx.stressOrdinal - 1) return 1;
  if (ctx.wordInitial) return 1;
  return 2;
}

/** هل يجوز لقاعدةِ اختزالٍ أن تعمل أصلًا؟ */
const stressed = (ctx) => ctx.ordinal === ctx.stressOrdinal;
const usable = (ctx) => ctx.stressKnown;

registerRule({
  id: 'RU_VOWEL_STRESSED',
  category: RULE_CATEGORY.VOWEL_REDUCTION,
  stage: STAGE.VOWEL_REDUCTION,
  priority: 500,
  summary: 'الحركةُ المشدَّدةُ لا تُختزَل',
  explain: 'حرف العلّة المشدّد بيتنطق كامل وواضح.',
  source: 'studme.org · «Современный русский язык. Фонетика»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => usable(ctx) && stressed(ctx),
  transform: (ctx) => ({ ipa: ctx.baseIpa, stressed: true }),
});

registerRule({
  id: 'RU_RED_A_O_PRETONIC1',
  category: RULE_CATEGORY.VOWEL_REDUCTION,
  stage: STAGE.VOWEL_REDUCTION,
  priority: 510,
  summary: 'а/о بعد صلبٍ قبل النبر مباشرةً أو في بداية الكلمة → [ɐ]',
  explain: 'الـ«о» اللي قبل المشدّدة على طول بتتنطق قريبة من «а».',
  source: 'studme.org · «В первом предударном слоге и в абсолютном начале слова безударные А, О обозначают звук [ʌ]»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => usable(ctx) && !stressed(ctx)
    && 'ао'.includes(ctx.letter) && !ctx.prevSoft && degreeOf(ctx) === 1,
  transform: () => ({ ipa: 'ɐ', reduction: { degree: 1, quality: 'qualitative' } }),
});

registerRule({
  id: 'RU_RED_A_O_WEAK',
  category: RULE_CATEGORY.VOWEL_REDUCTION,
  stage: STAGE.VOWEL_REDUCTION,
  priority: 520,
  summary: 'а/о بعد صلبٍ في بقيّة المواضع → [ə]',
  explain: 'الـ«о» البعيدة عن النبر بتبقى أخفت — صوت غامض قصير.',
  source: 'studme.org · «во втором предударном и заударном слогах — [ъ]»',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => usable(ctx) && !stressed(ctx)
    && 'ао'.includes(ctx.letter) && !ctx.prevSoft,
  transform: () => ({ ipa: 'ə', reduction: { degree: 2, quality: 'qualitative' } }),
});

registerRule({
  id: 'RU_RED_SOFT_IKANYE',
  category: RULE_CATEGORY.VOWEL_REDUCTION,
  stage: STAGE.VOWEL_REDUCTION,
  priority: 530,
  summary: 'إيكانيه: е/я/а بعد ليّنٍ غيرَ مشدَّدةٍ تتوحّد في [ɪ]',
  explain: 'بعد حرف ليّن، الـ«е» والـ«я» غير المشدّدين بيقربوا من «и» — عشان كده «лиса» و«леса» بيتنطقوا زيّ بعض.',
  source: 'МФШ/иканье · «лес, лис — [л\'иса]; нёс — [н\'ису]; пять — [п\'итак]» + пятак [pʲɪˈtak]',
  status: STATUS.VERIFIED,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ و`а` منها — وهذا ما يفسّر `часы` → [tɕɪˈsɨ]. `ч` ليّنةٌ دائمًا،
   *    فالـ`а` بعدها تدخل الإيكانيه لا الأكانيه. ومَن يظنّ الإيكانيه
   *    خاصًّا بـ`е`/`я` يُخطئ في كلّ كلمةٍ تبدأ بـ`ча`/`ща`.
   */
  /*
   * ⚠️ **و`и` منها أيضًا — وقد نسيتُها أوّلَ مرّة.**
   *
   * كنتُ أُدخِل `и` في «الاختزال الكمّيّ» فتخرج `лиса` بـ[i] و`леса`
   * بـ[ɪ] — **متمايزتين**. والمصدرُ يقول عكسَ ذلك حرفيًّا: «لес, лис —
   * [л'иса]»، أي أنهما **تتطابقان**؛ ونصُّ الحركات يقول إن [ɪ] هو
   * أليفونُ /i/ غيرِ المشدَّد (`пятак [pʲɪˈtak]`).
   *
   * والعطبُ لم يكن ليظهر في اختبارٍ يسأل «هل انطلقت القاعدة؟» — لأن
   * قاعدةً انطلقت فعلًا، الخاطئةَ. ظهر حين طبعتُ الكلمتين متجاورتين
   * ونظرتُ. ولهذا الكوربوسُ يضع `лиса`/`леса` **زوجًا** لا مفردتين.
   */
  applies: (ctx) => usable(ctx) && !stressed(ctx)
    && (('еяа'.includes(ctx.letter) && ctx.prevSoft)
      || (ctx.letter === 'и' && ctx.baseIpa !== 'ɨ')),
  transform: (ctx) => ({
    ipa: 'ɪ',
    /*
     * ⚠️ **والدرجةُ محفوظةٌ وإن تساوى الرمز.** المصادرُ تفرّق [иэ] عن
     *    [ь]؛ ونحن نحفظ الفرقَ في `degree` ولا نزعم رمزًا IPA أضيقَ
     *    لم نتحقّق منه. جزئيٌّ صحيحٌ خيرٌ من كاملٍ ملفَّق (§16).
     */
    reduction: { degree: degreeOf(ctx), quality: 'qualitative' },
  }),
});

registerRule({
  id: 'RU_RED_AFTER_HUSHING_E',
  category: RULE_CATEGORY.VOWEL_REDUCTION,
  stage: STAGE.VOWEL_REDUCTION,
  priority: 540,
  summary: 'е غيرُ المشدَّدة بعد ж/ш/ц → [ɨ]',
  explain: 'بعد «ж» و«ш» و«ц»، الـ«е» غير المشدّدة بتقرب من «ы» — «жена» بتتقال «жына».',
  source: 'diktory.com · «После твердых шипящих [ж], [ш] и после [ц] на месте е произносится [ыэ]»',
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **و`а`/`о` بعد الهسيسيّات لا تدخل هنا** — تُعامَل معاملةَ ما بعد
   *    الصلب (٥١٠/٥٢٠)، فـ`шары́` تعطي [ʂɐˈrɨ]. ونمطُ `жалеть →
   *    [жыл'эт']` موسكوفيٌّ قديمٌ متغيّرٌ اليوم، ومؤجَّلٌ صراحةً في
   *    المواصفة §20.8 — لا منسيّ.
   */
  applies: (ctx) => usable(ctx) && !stressed(ctx)
    && ctx.letter === 'е' && ALWAYS_HARD.includes(ctx.prevLetter)
    /*
     * ⚠️ **الدرجةُ الأولى وحدَها — وقد عمّمتُها أوّلَ مرّة فأخطأت.**
     *
     * أمثلةُ المصدر كلُّها في المقطع السابق للنبر: `ж[ыэ]лать`،
     * `ш[ыэ]птать`، `ц[ыэ]на`. ولمّا عمّمتُها على كلّ موضعٍ خرجت
     * `солнце` → [сонцы] — وهي [сонцъ]. فالمقتطفُ يصف موضعًا بعينه،
     * وقراءتُه على أنه يصف كلَّ المواضع **زيادةٌ منّي لا منه**.
     */
    && degreeOf(ctx) === 1,
  transform: (ctx) => ({ ipa: 'ɨ', reduction: { degree: degreeOf(ctx), quality: 'qualitative' } }),
});

registerRule({
  id: 'RU_RED_AFTER_HUSHING_WEAK',
  category: RULE_CATEGORY.VOWEL_REDUCTION,
  stage: STAGE.VOWEL_REDUCTION,
  priority: 545,
  summary: 'е بعد ж/ш/ц في المواضع البعيدة عن النبر → [ə]',
  explain: 'بعيد عن النبر بعد «ж ш ц»، الـ«е» بتبقى صوت غامض قصير — «солнце» بتتقال «сонцъ».',
  source: 'studme.org · «во втором предударном и заударном слогах — [ъ]» (تطبيقًا على ما بعد الصلب عمومًا)',
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  applies: (ctx) => usable(ctx) && !stressed(ctx)
    && ctx.letter === 'е' && ALWAYS_HARD.includes(ctx.prevLetter),
  transform: (ctx) => ({ ipa: 'ə', reduction: { degree: degreeOf(ctx), quality: 'qualitative' } }),
});

registerRule({
  id: 'RU_VOWEL_QUANTITATIVE_ONLY',
  category: RULE_CATEGORY.VOWEL_REDUCTION,
  stage: STAGE.VOWEL_REDUCTION,
  priority: 550,
  summary: 'ы/у/ю تُختزَل كمًّا لا كيفًا',
  explain: '«ы» و«у» بيقصروا لما ميبقوش مشدّدين، بس صوتهم مبيتغيّرش.',
  source: 'مصادرُ الاختزال الكمّيّ/الكيفيّ (عامّ)',
  /*
   * ⚠️ **ثقةٌ متوسّطةٌ عمدًا، والموقفُ أضعفُ ادّعاءٍ ممكن.**
   *    لم يصل مقتطفٌ يذكر هذه الثلاثة بأعيانها، فاخترنا **ألّا ندّعي
   *    تحوّلًا** أصلًا. لو ثبت لاحقًا تغيّرٌ طفيف، تُصحَّح القاعدةُ بلا
   *    أن تكون قد كذبت على المتعلّم. وهذا هو الفرقُ بين «لا أعرف» و
   *    «أعرف خطأً».
   */
  status: STATUS.PROVISIONAL,
  evidence: EVIDENCE.SNIPPET,
  /*
   * ⚠️ **و`ю` معها — وكانت ساقطةً فخرجت `любовь` ناقصةً حرفًا.**
   *    لم تنطبق عليها قاعدةٌ واحدة، فبقيت `unresolved` وحُجِبت من
   *    المخرَج: `[л'бо́ф']`. والدرسُ أن **الفجوةَ في التغطية تُخرج
   *    ناتجًا مشوَّهًا لا رسالةَ خطأ** — ولذلك يمرّ الكوربوسُ على كلّ
   *    حروف العلّة العشرة لا على المشهورة منها.
   */
  /*
   * ⚠️ **و`и` بعد `ж ш ц` منها — وكانت تسقط بين قاعدتين.**
   *    نقلتُ `и` إلى الإيكانيه (٥٣٠) وهي مشروطةٌ بـ`baseIpa !== 'ɨ'`،
   *    فبقيت `и` التي صارت `[ɨ]` بعد هسيسيّةٍ **بلا قاعدةٍ إطلاقًا**:
   *    `нешший` تخرج ناقصةً حرفًا. فجوةٌ لم يصنعها خطأٌ في قاعدة، بل
   *    **حدٌّ بين قاعدتين لم ينظر إليه أحد**. وهي أخفى من الخطأ لأن
   *    كلَّ قاعدةٍ على حدة صحيحة.
   */
  applies: (ctx) => usable(ctx) && !stressed(ctx)
    && ('ыую'.includes(ctx.letter) || (ctx.letter === 'и' && ctx.baseIpa === 'ɨ')),
  transform: (ctx) => ({
    ipa: ctx.baseIpa || VOWEL_SOUND[ctx.letter],
    reduction: { degree: degreeOf(ctx), quality: 'quantitative' },
  }),
});

/**
 * LingoLife — محرّكُ النطق الروسيّ (WS52)
 *
 * ═══════════════════════════════════════════════════════════════
 * حتميٌّ · بلا إنترنت · بقواعدَ مكتوبة · قابلٌ للتفسير
 * ═══════════════════════════════════════════════════════════════
 *
 * لا نموذجَ لغويًّا ولا تخمينَ احتمالاتٍ يُقدَّم بوصفه حقيقةً لغويّة.
 * كلُّ تحويلٍ هنا يعود إلى بندٍ في `docs/russian-pronunciation-spec.md`
 * بمعرِّفٍ ومصدرٍ واختبارات. ونفسُ المدخَل يعطي نفسَ المخرَج دائمًا.
 *
 * ⚠️ **والقيمةُ التعليميّةُ في الأثر لا في النتيجة.** «молоко → [мълако́]»
 *    سطرٌ يُحفَظ؛ أمّا «لماذا الـ`о` الأولى غير الثانية» فهو ما يجعلك
 *    تنطق الكلمةَ التاليةَ صحيحًا بلا أن تسأل عنها.
 *
 * ⚠️ **وهو لا يقول لك إن نطقَك خطأ.** لا ميكروفون، ولا تقييم، ولا
 *    درجات. سؤالُه واحد: «كيف تُحلَّل هذه الكلمةُ ولماذا؟».
 */

import {
  VOWELS, IOTATED, IOTATED_SOUND, VOWEL_SOUND, ALWAYS_HARD,
  CONSONANT_HARD, CONSONANT_SOFT, STRESS_MARK,
  isVowel, isConsonant, isSonorant, isPairedVoiced, toCyrillic,
} from './alphabet.js';
import { resolveStress, STRESS_STATUS, STRESS_SOURCE, stripStress } from './stress-resolver.js';
import { syllabify } from './syllabifier.js';
import {
  rulesForStage, STAGE, RULESET_VERSION, ruleById, SCOPE, PRONUNCIATION_ANALYSIS_VERSION,
} from './rule-registry.js';
import { lexiconEntry, LEXICAL_RULE, LEXICAL_CATEGORY } from './pronunciation-lexicon.js';

/* ⚠️ الاستيرادُ لأثرِه الجانبيّ: تسجيلُ القواعد. والترتيبُ بينها
 *    **لا يعتمد على ترتيب هذه السطور** — السجلُّ يفرز بالأولويّة. */
import './rules/orthoepic.js';
import './rules/hardness.js';
import './rules/reduction.js';
import './rules/voicing.js';

export { RULESET_VERSION, PRONUNCIATION_ANALYSIS_VERSION, STRESS_STATUS, STRESS_SOURCE };

/** أعلامُ الحالة — لا نسبةَ ثقةٍ عالميّةٌ واحدة (§31 من الطلب). */
export const FLAG = Object.freeze({
  VERIFIED_RULE: 'VERIFIED_RULE',
  LEXICAL_EXCEPTION: 'LEXICAL_EXCEPTION',
  PARTIAL_ANALYSIS: 'PARTIAL_ANALYSIS',
  UNKNOWN_STRESS: 'UNKNOWN_STRESS',
  UNSUPPORTED_CONTEXT: 'UNSUPPORTED_CONTEXT',
});

/** أوضاعُ العرض — والافتراضُ `SIMPLE` دائمًا (§20 من الطلب). */
export const DISPLAY_MODE = Object.freeze({
  SIMPLE: 'simple',
  SOUNDS: 'sounds',
  IPA: 'ipa',
  RULES: 'rules',
});

const PUNCT = /[.,!?;:،؟«»""''()[\]—–-]/g;

/** يُطبِّع كلمةً: صغيرةُ الحروف، بلا ترقيم، مع حفظ `ё` وعلامة النبر. */
export function normalizeWord(raw) {
  return String(raw || '').toLowerCase().replace(PUNCT, '').trim();
}

/* ================================================================== *
 * ④ إعادةُ الكتابة على الحروف
 * ================================================================== */

/**
 * ⚠️ **والمعجمُ يسبق القواعدَ هنا — لا يتأخّر عنها.**
 *
 * كتبتُ في المواصفة أوّلَ مرّة أن «المعجمَ آخرًا لأنه تجاوز»، وهو
 * صحيحٌ في المعنى وخاطئٌ في الموضع: مدخَلُ المعجم يتجاوز **الإملاء**
 * لا **النتيجة**. فحين يقول «`что` اقرأها `што`» فالمقصودُ أن تدخل
 * `што` خطَّ المعالجة كاملًا — تُختزَل حركتُها ويُهمَس آخرُها كأيّ
 * كلمة. ولو أخّرناه لكان علينا كتابةُ النطق النهائيّ يدويًّا في كلّ
 * مدخَل، فيتجمّد عند لحظة كتابته ولا يستفيد من تحسّن القواعد.
 */
function rewriteLetters(word) {
  const trace = [];
  let out = word;

  const entry = lexiconEntry(word);
  if (entry?.rewrite) {
    trace.push({
      ruleId: LEXICAL_RULE.id,
      category: LEXICAL_RULE.category,
      scope: SCOPE.LEXICAL,
      at: 0,
      from: out,
      to: entry.rewrite,
      why: entry.explain,
      source: entry.source,
      lexical: true,
      changed: out !== entry.rewrite,
      /* المُطلِقُ هو الكلمةُ نفسُها — ومداها كلُّ حروفها. */
      trigger: { side: 'self', grapheme: out, at: 0, span: [0, out.length] },
    });
    out = entry.rewrite;
  }

  for (const rule of rulesForStage(STAGE.ORTHOEPIC_REWRITE)) {
    if (!rule.applies(out)) continue;
    const result = rule.transform(out);
    if (!result) continue;
    for (const hit of result.hits) {
      trace.push({
        ruleId: rule.id,
        category: rule.category,
        scope: rule.scope,
        at: hit.at,
        from: hit.from,
        to: hit.to,
        why: rule.explain,
        source: rule.source,
        changed: hit.from !== hit.to,
        trigger: {
          side: 'self',
          grapheme: hit.from,
          at: hit.at,
          span: [hit.at, hit.at + String(hit.from || '').length],
        },
      });
    }
    out = result.word;
  }
  return { word: out, trace, lexical: entry || null };
}

/* ================================================================== *
 * ⑤ حرفٌ ← صوتٌ أساسيّ
 * ================================================================== */

/**
 * يبني المقاطعَ الصوتيّة من الحروف.
 *
 * ⚠️ **واليوتيّاتُ لها تحقّقان لا واحد.** `я` بعد ساكنٍ تُليّنه وتُعطي
 *    `a` وحدَها (`мя` = `mʲa`)؛ وفي أوّل الكلمة أو بعد حركةٍ أو بعد
 *    `ь`/`ъ` تُعطي `j` + `a`. وخلطُهما يجعل `мясо` تُنطَق «مياسو»
 *    بصوتَين حيث لا يوجد إلّا واحد.
 */
function buildSegments(word) {
  const chars = [...word];
  const segments = [];
  let ordinal = -1;

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const prev = chars[i - 1];

    if (ch === 'ь' || ch === 'ъ') {
      segments.push({ letter: ch, sourceIndex: i, type: 'silent', ipa: '', rules: [] });
      continue;
    }

    if (isVowel(ch)) {
      ordinal += 1;
      const iotates = (IOTATED.includes(ch) || ch === 'и')
        && (i === 0 || isVowel(prev) || prev === 'ь' || prev === 'ъ')
        /* ⚠️ و`и` تُنتج `j` بعد `ь` وحدَها (`соловьи`) لا في أوّل الكلمة. */
        && !(ch === 'и' && prev !== 'ь');

      if (iotates) {
        segments.push({
          letter: 'й', sourceIndex: i, type: 'consonant', ipa: 'j',
          soft: true, voiced: true, sonorant: true, synthetic: true, rules: [],
        });
      }

      /* ⚠️ `и` بعد `ж ш ц` تُنطَق `ɨ` — أثرٌ مباشرٌ لصلابتها الدائمة. */
      const base = (ch === 'и' && ALWAYS_HARD.includes(prev))
        ? 'ɨ'
        : (iotates ? IOTATED_SOUND[ch] || VOWEL_SOUND[ch] : VOWEL_SOUND[ch]);

      segments.push({
        letter: ch, sourceIndex: i, type: 'vowel', ipa: base, baseIpa: base,
        ordinal, stressed: false, reduction: null, rules: [],
      });
      continue;
    }

    if (isConsonant(ch)) {
      /*
       * ⚠️ **الساكنان المتماثلان صوتٌ واحدٌ طويل** (`RU_GEMINATION`).
       *    `ванна` صوتُ `н` واحدٌ ممدود، لا `н` مرّتين. والطولُ **صفةُ
       *    صوتٍ** لا حرفٌ في الكلمة — ولذلك يُجمَع هنا لا في إعادة
       *    الكتابة، فتبقى إعادةُ الكتابة على حروفٍ روسيّةٍ خالصة.
       */
      if (chars[i + 1] === ch) {
        segments.push({
          letter: ch, written: ch, sourceIndex: i, type: 'consonant', ipa: CONSONANT_HARD[ch],
          soft: false, voiced: isPairedVoiced(ch) || isSonorant(ch),
          sonorant: isSonorant(ch), long: true, rules: [],
        });
        i += 1;               /* الحرفُ الثاني ابتُلع في الصوت نفسِه */
        continue;
      }
      /*
       * ⚠️ **و`written` نسخةٌ لا تُمَسّ — و`letter` تتبدّل** (WS58).
       *
       *    قواعدُ الجهر تكتب على `seg.letter` (`ж` ← `ш`) لأن القواعدَ
       *    التاليةَ تسأل عن الحرف **بعد** التحويل. وكان أثرُ ذلك أنّ
       *    «المكتوب» يضيع: `нож` تعرض «ш → ш» بدل «ж → ш» — أي أنها
       *    تُخفي بالضبط الشيءَ الذي جاء المتعلّمُ ليراه (بند ٢٠).
       */
      segments.push({
        letter: ch, written: ch, sourceIndex: i, type: 'consonant', ipa: CONSONANT_HARD[ch],
        soft: false, voiced: isPairedVoiced(ch) || isSonorant(ch),
        sonorant: isSonorant(ch), rules: [],
      });
      continue;
    }

    /* حرفٌ لا نعرفه (لاتينيّ، رقم…) — يمرّ بلا ادّعاءِ صوت. */
    segments.push({ letter: ch, sourceIndex: i, type: 'other', ipa: null, rules: [] });
  }
  return segments;
}

/* ================================================================== *
 * ⑧ الصلابةُ والليونة
 * ================================================================== */

/**
 * مُطلِقُ القاعدة — **الحرفُ الذي جعلها تنطلق، بموضعه** (WS-N · §19).
 *
 * ⚠️ **ولا يُترَك للواجهة أن تخمّنه.**
 *
 * كان الأثرُ يحمل «أين وقع الأثر» (`at`) ولا يحمل «مَن سبّبه». فحين
 * انطلقت قاعدةُ الرنّانات على `м` في `име́ет` لم يكن في السطر ما يقول
 * أيُّ حرفٍ أطلقها — فعُرِضت بشرحها العامّ الذي يذكر `л`، ولا سبيلَ
 * لأحدٍ أن يكتشف الكذبةَ برمجيًّا.
 *
 * فالآن كلُّ قاعدةٍ تُصرّح: مُطلِقي **أنا** (`self`)، أم **الحرفُ الذي
 * بعدي** (`next`)، أم **أوّلُ الكلمة التالية** (`nextWord`). وطبقةُ
 * التحقّق ترفض أيَّ قاعدةٍ لا يوجد مُطلِقُها في النصّ فعلًا.
 */
function triggerOf(rule, { self, next, nextWordFirst }) {
  const side = rule.trigger || 'self';
  if (side === 'next' && next) {
    return { side, grapheme: next.written ?? next.letter ?? next, at: next.at ?? next.sourceIndex ?? null };
  }
  if (side === 'nextWord' && nextWordFirst) {
    return { side, grapheme: nextWordFirst, at: null };
  }
  return { side: 'self', grapheme: self.written ?? self.letter, at: self.sourceIndex };
}

function applyHardness(segments, chars, trace, word) {
  const rules = rulesForStage(STAGE.HARDNESS);
  for (const seg of segments) {
    if (seg.type !== 'consonant' || seg.synthetic) continue;
    /*
     * ⚠️ `afterNext` للقواعد التي تسأل عن ليونةِ **الجار** لا عن حرفٍ
     *    واحدٍ بعدها: `снег` تحتاج أن ترى `е` بعد `н` لتعرف أن `н`
     *    ليّنة، فتقرّر هل تُطلق التليينَ المماثِل.
     */
    const ctx = {
      letter: seg.letter,
      next: chars[seg.sourceIndex + 1] || '',
      afterNext: chars[seg.sourceIndex + 2] || '',
      soft: seg.soft,
      word,
    };

    for (const rule of rules) {
      if (!rule.applies(ctx)) continue;
      const out = rule.transform(ctx);
      const { soft } = out;
      /* وسمٌ لا تحويل — القواعدُ المُختلَفُ فيها تقول ولا تفرض. */
      if (out.variant) seg.variant = out.variant;
      const before = seg.ipa;
      seg.soft = soft;
      seg.ipa = soft
        ? (CONSONANT_SOFT[seg.letter] || CONSONANT_HARD[seg.letter])
        : CONSONANT_HARD[seg.letter];
      seg.rules.push(rule.id);
      trace.push({
        ruleId: rule.id, category: rule.category, scope: rule.scope, at: seg.sourceIndex,
        from: seg.letter, to: seg.ipa,
        why: rule.describe?.(ctx, out) || rule.explain, source: rule.source,
        changed: before !== seg.ipa,
        trigger: triggerOf(rule, {
          self: seg,
          next: ctx.next ? { letter: ctx.next, at: seg.sourceIndex + 1 } : null,
        }),
      });
      break;   /* ⚠️ أوّلُ مطابِقٍ يفوز — دلالةُ هذه المرحلة. */
    }
  }
}

/* ================================================================== *
 * ⑨ اختزالُ الحركات
 * ================================================================== */

function applyReduction(segments, stress, trace) {
  const rules = rulesForStage(STAGE.VOWEL_REDUCTION);
  const stressKnown = stress.status === STRESS_STATUS.KNOWN && stress.ordinal >= 0;

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.type !== 'vowel') continue;

    /* أقربُ ساكنٍ قبلها — يقرّر «بعد صلبٍ» أم «بعد ليّن». */
    let prev = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (segments[j].type === 'consonant') { prev = segments[j]; break; }
      if (segments[j].type === 'vowel') break;
    }

    const ctx = {
      letter: seg.letter,
      baseIpa: seg.baseIpa,
      ordinal: seg.ordinal,
      stressOrdinal: stress.ordinal,
      stressKnown,
      prevSoft: Boolean(prev?.soft),
      prevLetter: prev?.letter || '',
      /* ⚠️ **صوتٌ ولّده المحرّكُ لا حرفٌ في الكتابة** — والفرقُ يُقال
         للمتعلّم بلغته لا يُطوى (§15 من طلب WS-N). */
      prevSynthetic: Boolean(prev?.synthetic),
      /* ⚠️ «بدايةُ الكلمة المطلقة» = لا صوتَ قبلها إطلاقًا. */
      wordInitial: i === 0,
    };

    let fired = false;
    for (const rule of rules) {
      if (!rule.applies(ctx)) continue;
      const out = rule.transform(ctx);
      const before = seg.ipa;
      seg.ipa = out.ipa;
      seg.stressed = Boolean(out.stressed);
      seg.reduction = out.reduction || null;
      seg.rules.push(rule.id);
      trace.push({
        ruleId: rule.id, category: rule.category, scope: rule.scope, at: seg.sourceIndex,
        from: seg.letter, to: seg.ipa,
        why: rule.describe?.(ctx, out) || rule.explain, source: rule.source,
        degree: out.reduction?.degree ?? null,
        /* ⚠️ **والمشدَّدةُ «تغيّرت» وإن تساوى الرمز**: القاعدةُ هي التي
           جعلتها كاملةً بدل مختزَلة — وهو خبرٌ، لا صمت. */
        changed: before !== seg.ipa || Boolean(out.stressed),
        trigger: triggerOf(rule, { self: seg }),
      });
      fired = true;
      break;
    }

    /*
     * ⚠️ **ولا قاعدةَ انطبقت؟ لا نخترع.** الحركةُ تبقى بقيمتها
     *    الأساسيّة وتُعلَّم `unresolved`، فيرتفع `PARTIAL_ANALYSIS`
     *    ويُحجَب الـIPA. صمتٌ صادقٌ خيرٌ من قيمةٍ مُلفَّقة.
     */
    if (!fired) seg.unresolved = !stressKnown ? 'stress' : 'rule';
  }
}

/* ================================================================== *
 * ⑩ الجهرُ والهمس — يمينًا ← يسارًا
 * ================================================================== */

function applyVoicing(segments, trace, nextWordFirst) {
  const rules = rulesForStage(STAGE.VOICING);
  const sounding = segments.filter((s) => s.type === 'consonant' || s.type === 'vowel');

  for (let k = sounding.length - 1; k >= 0; k -= 1) {
    const seg = sounding[k];
    if (seg.type !== 'consonant' || seg.synthetic) continue;

    const next = sounding[k + 1] || null;
    const ctx = {
      letter: seg.letter,
      isFinal: !next,
      nextLetter: next?.letter || '',
      nextVoiced: next ? Boolean(next.voiced) : null,
      nextIsConsonant: next?.type === 'consonant',
      /* أوّلُ صوتٍ في الكلمة التالية — للمماثلة عبر الحدّ. */
      nextWordFirst: next ? '' : (nextWordFirst || ''),
    };

    for (const rule of rules) {
      if (!rule.applies(ctx)) continue;
      const out = rule.transform(ctx);
      seg.rules.push(rule.id);
      const trigger = triggerOf(rule, { self: seg, next, nextWordFirst });

      if (out.blocked) {
        /* ⚠️ **والمانعُ قد يكون عابرًا للحدّ أيضًا** (WS58): `нож был`
           يبقى مجهورًا **بسبب الكلمة التالية**، فالوسمُ حقٌّ للمانع
           كما هو حقٌّ للمُحوِّل — وبدونه لا تعرف الواجهةُ أن الحدَّ فعل
           شيئًا، فتصمت عن أوضح ما يعلّمه البند ٧هـ. */
        if (out.crossWord) seg.crossWord = true;
        trace.push({
          ruleId: rule.id, category: rule.category, scope: rule.scope, at: seg.sourceIndex,
          from: seg.letter, to: seg.ipa,
          why: rule.describe?.(ctx, out) || rule.explain, source: rule.source,
          blocked: true,
          /* ⚠️ **والمانعُ لم يُغيّر شيئًا — والحقلُ يقولها صراحةً.**
             طبقةُ التحقّق تسأل: «هل غيّرتَ أو منعتَ تغييرًا كان واقعًا؟»،
             فلا يمرّ مانعٌ ينطلق حيث لا شيءَ على المحكّ. */
          changed: false,
          trigger,
        });
        break;
      }

      const before = seg.ipa;
      seg.letter = out.letter;
      seg.voiced = out.voiced;
      if (out.crossWord) seg.crossWord = true;
      seg.ipa = seg.soft
        ? (CONSONANT_SOFT[out.letter] || CONSONANT_HARD[out.letter])
        : CONSONANT_HARD[out.letter];
      trace.push({
        ruleId: rule.id, category: rule.category, scope: rule.scope, at: seg.sourceIndex,
        from: before, to: seg.ipa,
        why: rule.describe?.(ctx, out) || rule.explain, source: rule.source,
        changed: before !== seg.ipa,
        trigger,
      });
      break;
    }
  }
}

/* ================================================================== *
 * ⑫ المخرجات
 * ================================================================== */

/** يربط كلَّ مقطعٍ صوتيٍّ بالمقطع اللفظيّ الذي يقع فيه. */
function mapSyllables(syllables) {
  const ofLetter = [];
  let at = 0;
  syllables.forEach((syl, index) => {
    for (let i = 0; i < syl.text.length; i += 1) ofLetter[at + i] = index;
    at += syl.text.length;
  });
  return ofLetter;
}

function buildOutputs(segments, syllables, stress, ofLetter) {
  const stressSyllable = stress.status === STRESS_STATUS.KNOWN ? stress.ordinal : -1;

  let ipa = '';
  let simple = '';
  let complete = true;
  let stressMarked = false;

  for (const seg of segments) {
    if (seg.type === 'silent') continue;
    if (seg.ipa === null || seg.ipa === '' || seg.unresolved) { complete = false; continue; }

    /* علامةُ النبر IPA توضَع قبل **أوّل** صوتٍ في المقطع المشدَّد. */
    if (!stressMarked && stressSyllable >= 0 && ofLetter[seg.sourceIndex] === stressSyllable) {
      ipa += 'ˈ';
      stressMarked = true;
    }
    ipa += seg.ipa;

    /*
     * ⚠️ **والدرجةُ الثانية بعد ليّنٍ تُكتَب `ь` لا `и`** — وهو ما
     *    تفعله كتبُ الروسيّة نفسُها: `[ие]` في المقطع السابق للنبر
     *    و`[ь]` في غيره. الرمزان يخرجان من IPA واحدٍ `[ɪ]` لأننا لم
     *    نتحقّق من رمزٍ أضيقَ لكلٍّ منهما — **لكنّ الدرجةَ محفوظةٌ في
     *    البيانات**، فالنسخُ السيريليُّ يستطيع أن يفرّق ما لا يجرؤ
     *    الـIPA على ادّعائه.
     */
    if (seg.type === 'vowel' && seg.ipa === 'ɪ' && seg.reduction?.degree === 2) simple += 'ь';
    else simple += toCyrillic(seg.ipa);
    /* الطولُ يُرى في التقريب أيضًا — لا في الـIPA وحدَه. */
    if (seg.long) { ipa += 'ː'; simple += 'ː'; }

    if (seg.type === 'vowel' && seg.stressed) simple += STRESS_MARK;
  }

  /*
   * ⚠️ **وناقصٌ يعني `null` لا نصًّا مبتورًا.**
   *
   * كان المخرَجُ يعرض ما بقي: `счастье` بلا نبرٍ تخرج `[щст'й]` —
   * حروفٌ ساكنةٌ متلاصقةٌ لا تُنطَق ولا تُقرأ. وهي **أسوأُ من الصمت**
   * لأنها تبدو جوابًا. فإمّا نطقٌ كاملٌ تُبرِّره القواعد، وإمّا
   * لا شيءٌ ورسالةٌ تقول لماذا.
   */
  return {
    ipa: complete && stressSyllable >= 0 ? ipa : null,
    simple: complete && stressSyllable >= 0 ? simple : null,
    complete,
  };
}

/**
 * جدولُ «الأصوات» — حرفٌ ← صوتٌ ← وصفٌ عربيّ.
 *
 * ⚠️ **و`ofLetter` يُمرَّر ولا يُعاد حسابُه** (WS58). خريطةُ الصوت
 *    (`sound-map.js`) تحتاج أن تعرف أيَّ مقطعٍ يقع فيه كلُّ صوت، ولو
 *    حسبتها عندها لصار للتقطيع مصدران يفترقان أوّلَ مرّةٍ يتغيّر أحدُهما.
 */
function buildSounds(segments, ofLetter) {
  return segments
    .filter((s) => s.type !== 'other')
    .map((seg) => {
      const labels = [];
      if (seg.type === 'silent') labels.push(seg.letter === 'ь' ? 'بتليّن اللي قبلها' : 'فاصل');
      if (seg.type === 'consonant') labels.push(seg.soft ? 'ليّن' : 'صلب');
      if (seg.type === 'consonant' && seg.rules.includes('RU_FINAL_DEVOICING')) labels.push('فقد جهره في آخر الكلمة');
      if (seg.type === 'consonant' && seg.rules.includes('RU_REGRESSIVE_DEVOICING')) labels.push('اتهمس بتأثير اللي بعده');
      if (seg.type === 'consonant' && seg.rules.includes('RU_REGRESSIVE_VOICING')) labels.push('اتجهّر بتأثير اللي بعده');
      if (seg.type === 'vowel' && seg.stressed) labels.push('مشدّد');
      if (seg.reduction?.quality === 'qualitative') {
        labels.push(seg.reduction.degree === 1 ? 'مختزل (درجة أولى)' : 'مختزل (درجة تانية)');
      }
      if (seg.reduction?.quality === 'quantitative') labels.push('أقصر بس متغيّرش');
      if (seg.long) labels.push('طويل (حرفين صوت واحد)');
      /* ⚠️ **انتقالٌ صوتيٌّ لا حرفٌ مخفيّ** (§15): `име́ет` فيها [j] بين
         الحركتين ولا `й` في كتابتها. والوسمُ هنا كي لا تعرضه الواجهةُ
         بطاقةَ حرفٍ فيبحث عنه القارئُ في الإملاء. */
      if (seg.synthetic) labels.push('انتقال صوتي — مش حرف مكتوب');
      if (seg.crossWord) labels.push('اتأثّر بالكلمة اللي بعدها');
      if (seg.variant) labels.push(seg.variant);
      if (seg.unresolved) labels.push(seg.unresolved === 'stress' ? 'محتاج النبر' : 'مش مغطّى');
      return {
        letter: seg.letter,
        /** الحرفُ كما كُتب — قبل أيّ تحويلِ جهر. */
        written: seg.written ?? seg.letter,
        /** صوتٌ ولّدته القواعدُ ولا حرفَ له في الإملاء (`й` الانزلاقيّة). */
        synthetic: Boolean(seg.synthetic),
        crossWord: Boolean(seg.crossWord),
        ipa: seg.ipa || null,
        cyrillic: seg.ipa ? toCyrillic(seg.ipa) : null,
        type: seg.type,
        at: seg.sourceIndex,
        syllable: ofLetter?.[seg.sourceIndex] ?? null,
        stressed: Boolean(seg.stressed),
        soft: seg.type === 'consonant' ? Boolean(seg.soft) : null,
        reduction: seg.reduction,
        /* ⚠️ **الحقيقةُ لا النصُّ وحدَه** (WS58): كانت `unresolved` تصل
           إلى `labels` كجملةٍ عربيّةٍ ولا تصل كحقلٍ يُفحَص — فلم تستطع
           خريطةُ الصوت أن تعرف أن مقطعًا نصفُه محلول، وعرضته كاملًا. */
        unresolved: seg.unresolved || null,
        rules: [...seg.rules],
        labels,
      };
    });
}

/* ================================================================== *
 * الحفظُ المؤقّت
 * ================================================================== */

/**
 * ⚠️ **وهذه ليست ذاكرةَ الصوت المولَّد.** تلك تحفظ ملفّاتِ نطقٍ
 *    ثقيلةً في IndexedDB؛ وهذه تحفظ **تحليلًا لغويًّا** خفيفًا في
 *    الذاكرة. خلطُهما يجعل تحسينَ القواعد يتطلّب مسحَ الصوت، وتغييرَ
 *    الصوت يُبطل تحليلًا صحيحًا. نظامان منفصلان بالتصميم (§23، §27).
 */
const CACHE_LIMIT = 400;
const cache = new Map();

function cacheKey(word, stress, contextKey) {
  return `${RULESET_VERSION}|${word}|${stress.ordinal}|${stress.source}|${contextKey}`;
}

export { SCOPE };

/** ⚠️ للاختبارات وللقياس. */
export function clearPronunciationCache() {
  cache.clear();
}

export function pronunciationCacheSize() {
  return cache.size;
}

/* ================================================================== *
 * الواجهة
 * ================================================================== */

/**
 * يحلّل كلمةً روسيّةً واحدة.
 *
 * @param {string} raw الكلمةُ كما ظهرت للمستخدم
 * @param {{
 *   overrideStressOrdinal?: number|null,
 *   previousWord?: string|null,
 *   nextWord?: string|null,
 * }} options
 *   ⚠️ `previousWord`/`nextWord` **يُستعملان في موضعين لا موضع**:
 *      المماثلةُ الصوتيّةُ عبر حدّ الكلمة (WS54)، وحسمُ المتجانِسات
 *      في `StressResolver` (WS55). وما زال غيرَ مدعومٍ هو **العروضُ**
 *      نفسُه — أين تقف أنت في الجملة — ومُعلَنٌ في
 *      `RU_CROSS_WORD_PROSODY` المؤجَّلة. راجع §20.8 في المواصفة.
 */
export function analyzeWord(raw, {
  overrideStressOrdinal = null, previousWord = null, nextWord = null, connected = true,
} = {}) {
  const original = String(raw || '');
  const normalized = normalizeWord(original);
  const bare = stripStress(normalized);

  if (!bare || ![...bare].some((ch) => VOWELS.includes(ch) || isConsonant(ch))) {
    return {
      originalText: original,
      normalizedText: bare,
      supported: false,
      flags: [FLAG.UNSUPPORTED_CONTEXT],
      rulesetVersion: RULESET_VERSION,
      warnings: ['مفيش حروف روسية نحلّلها'],
      appliedRules: [],
      syllables: [],
      sounds: [],
      pronunciation: { simple: '', ipa: null },
      stress: { status: STRESS_STATUS.UNKNOWN, ordinal: -1, source: STRESS_SOURCE.UNKNOWN },
    };
  }

  /*
   * ⚠️ **والجارَان يُمرَّران إلى حلّال النبر أيضًا — لا إلى القواعد وحدَها.**
   *    حسمُ المتجانسات يحتاج السياق: `замок` في «за́мок на горе» غيرُها
   *    في «замо́к на двери». فالسياقُ الذي بُني للمماثلة الصوتيّة يخدم
   *    النبرَ كذلك، بلا بنيةٍ ثانية.
   */
  const stress = resolveStress(normalized, {
    overrideOrdinal: overrideStressOrdinal, previousWord, nextWord,
  });
  /*
   * ⚠️ **و`connected` جزءٌ من المفتاح لا خيارُ عرض** (WS-N · §45).
   *
   * الطبقةُ المعجميّةُ والطبقةُ المتّصلةُ تُحسَبان **لنفس الكلمة ونفس
   * الجارَين**، ولا يفرقهما إلّا هذا العلم. فلو سقط من المفتاح لعادت
   * الثانيةُ بنتيجة الأولى — أي لعاد العطبُ نفسُه من باب الذاكرة بدل
   * باب القواعد: `име́ет` تنتهي بـ`д` منفردةً لأن أحدًا حلّلها قبل
   * قليلٍ داخل جملة.
   */
  const contextKey = `${previousWord || ''}>${nextWord || ''}|${connected ? 'cx' : 'lex'}`;
  const key = cacheKey(bare, stress, contextKey);
  if (cache.has(key)) return cache.get(key);

  const trace = [];
  const { word: rewritten, trace: rewriteTrace, lexical } = rewriteLetters(bare);
  trace.push(...rewriteTrace);

  const chars = [...rewritten];
  const segments = buildSegments(rewritten);
  const syllables = syllabify(rewritten);

  /*
   * ⚠️ **والكلامُ المتّصلُ صار مدعومًا — جزئيًّا وبإعلان.**
   *    أوّلُ حرفٍ روسيٍّ في الكلمة التالية يكفي للمماثلة عبر الحدّ،
   *    ولا نحتاج تحليلَها كاملةً. وما لا نعرفه (أين تقف أنت) معلَنٌ
   *    في `RU_CROSS_WORD_PROSODY` المؤجَّلة.
   */
  const nextFirst = connected
    ? (normalizeWord(nextWord || '').replace(/[^а-яё]/g, '')[0] || '')
    : '';

  applyHardness(segments, chars, trace, rewritten);
  applyReduction(segments, stress, trace);
  applyVoicing(segments, trace, nextFirst);

  const ofLetter = mapSyllables(syllables);
  const outputs = buildOutputs(segments, syllables, stress, ofLetter);
  const sounds = buildSounds(segments, ofLetter);

  const flags = [];
  const warnings = [];
  if (stress.status === STRESS_STATUS.UNKNOWN) {
    flags.push(FLAG.UNKNOWN_STRESS);
    warnings.push('النبر غير مؤكد — اختار حرف العلّة الصح وأنا أفتكره.');
  }
  if (lexical) {
    flags.push(FLAG.LEXICAL_EXCEPTION);
    if (lexical.category === LEXICAL_CATEGORY.VARIANT) {
      warnings.push(`نطقان مقبولان: ${lexical.variants}`);
    }
  }
  if (!outputs.complete) {
    flags.push(FLAG.PARTIAL_ANALYSIS);
    if (stress.status !== STRESS_STATUS.UNKNOWN) {
      warnings.push('فيه أصوات لسه مش مغطّاة بقواعد — النطق ناقص مش مخمّن.');
    }
  }
  if (!flags.length) flags.push(FLAG.VERIFIED_RULE);

  const result = Object.freeze({
    originalText: original,
    normalizedText: bare,
    rewrittenText: rewritten,
    supported: true,
    stress: {
      status: stress.status,
      ordinal: stress.ordinal,
      source: stress.source,
      /* ⚠️ أثرُ النبر **سابقٌ** لأثر القواعد — ومن أصلٍ مختلف. */
      origin: stress.detail?.origin || null,
      maturity: stress.detail?.status || null,
      ambiguous: Boolean(stress.detail?.ambiguous),
      variants: stress.detail?.variants || null,
      variantOrdinals: stress.detail?.variantOrdinals || null,
      alternates: stress.detail?.alternates || null,
      provider: stress.detail?.provider || null,
      trace: stress.detail?.trace || [],
      disagreement: stress.detail?.disagreement || null,
      syllableNumber: stress.ordinal >= 0 ? stress.ordinal + 1 : null,
      total: stress.syllables,
    },
    syllables: syllables.map((s) => s.text),
    sounds,
    pronunciation: { simple: outputs.simple, ipa: outputs.ipa },
    appliedRules: trace,
    ruleIds: [...new Set(trace.map((t) => t.ruleId))],
    flags,
    warnings,
    lexical: lexical
      ? { category: lexical.category, reason: lexical.reason, source: lexical.source }
      : null,
    context: {
      previousWord,
      nextWord,
      /** هل سُمح للجار أصلًا بأن يؤثّر؟ (طبقةُ التحليل تقرّر — لا المحرّك) */
      connected,
      /* المماثلةُ الجهريّةُ عبر الحدّ مدعومة؛ وما عداها (الوقف، ы بعد
         حرف الجرّ، الليونة عبر الحدّ) لا — والتمييزُ مقصود. */
      crossWordSupported: Boolean(nextFirst),
      crossWordApplied: segments.some((s) => s.crossWord),
    },
    rulesetVersion: RULESET_VERSION,
  });

  /* أقدمُ مدخَلٍ يخرج — كافٍ لجلسةِ ظلٍّ طويلة، وبلا نموّ بلا حدّ. */
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

/**
 * يحلّل جملةً: كلمةً كلمة، مع تمرير الجارَين.
 *
 * ⚠️ **ولا يدّعي الكلامَ المتّصل.** كلُّ نتيجةٍ تحمل
 *    `context.crossWordSupported = false` صراحةً — فالبنيةُ جاهزةٌ
 *    والسلوكُ غيرُ مُنفَّذ، والفرقُ بينهما هو ما يُطلَب الإفصاحُ عنه.
 */
export function analyzeSentence(text, { overrides = {} } = {}) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  return words.map((word, i) => analyzeWord(word, {
    overrideStressOrdinal: Object.hasOwn(overrides, i) ? overrides[i] : null,
    previousWord: words[i - 1] || null,
    nextWord: words[i + 1] || null,
  }));
}

/** بياناتٌ مضغوطةٌ تُحفَظ مع الكلمة المحفوظة (§24 من الطلب). */
export function pronunciationMetadata(analysis) {
  if (!analysis?.supported) return null;
  return {
    normalizedWord: analysis.normalizedText,
    stressOrdinal: analysis.stress.ordinal,
    stressSource: analysis.stress.source,
    ruleIds: analysis.ruleIds,
    rulesetVersion: analysis.rulesetVersion,
    /*
     * ⚠️ **حقلٌ يُضاف ولا يَحذف** (WS-N · §0 و§50). الصفوفُ المحفوظةُ
     *    قبل اليوم تبقى كما هي بلا هذا الحقل، ويُقرَأ غيابُه «تحليلٌ
     *    بالبنية القديمة» — لا «صفٌّ تالف». ولا يُمَسّ نصُّك ولا وسمُك
     *    ولا تسجيلُك ولا تاريخُك في «لغتي» عند إعادة الحساب.
     */
    analysisVersion: PRONUNCIATION_ANALYSIS_VERSION,
  };
}

export { ruleById };

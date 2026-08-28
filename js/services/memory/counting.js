/**
 * LingoLife — العدُّ الحتميُّ والتحقّق (WS-J · بنود ١٣ و١٤)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **سبعةُ أعدادٍ لا عددٌ واحد — وخلطُها هو الكذبة**
 * ═══════════════════════════════════════════════════════════════
 *
 *   صيغةٌ ظاهرة   «документов» بحرفها
 *   مفردة         `документ` بكلّ صيغها
 *   معنًى          `идти` حركةً ≠ `идти` سيرَ عمل
 *   عائلة          согласовать · согласование · согласованный
 *   ظهورٌ خام      كلُّ موضعٍ في نصٍّ أصليّ
 *   موقفٌ حقيقيّ    عددُ النصوص الأصليّة المختلفة
 *   ظهورٌ مولَّد     مواضعُ في مادّةٍ مشتقّة
 *
 * وجمعُ اثنين منها في رقمٍ واحدٍ يُنتج جملةً كاذبةً بلا أن يكذب أحد:
 * «٣٤ ظهورًا حقيقيًّا» حين تكون ١١ خامًا و٢٣ مولَّدة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ومَن يملك أيَّ رقم**
 * ═══════════════════════════════════════════════════════════════
 *
 * التحليلُ أقوى ما يكون في **التجميع الدلاليّ**: أن يقول إن
 * «согласовали» و«согласуем» مفردةٌ واحدة. وهو حكمٌ لغويٌّ لا يملكه
 * التطبيق (`identity.js` يصرّح أنه لا محلّلَ صرفيًّا فيه).
 *
 * والتطبيقُ أقوى ما يكون في **العدّ**: النصوصُ عنده، فالعدُّ حسابٌ لا
 * رأي.
 *
 * فالتقسيمُ: التحليلُ يقول «هذه الصيغُ مفردةٌ واحدة»، والتطبيقُ يعدّها
 * بنفسه في النصوص. وحين يختلف الرقمان **لا يُختار أحدُهما بصمت** —
 * تُرفَع الحالةُ للمراجعة ويُعرَض الفرق.
 */

import { EVIDENCE } from './provenance.js';

/** حالةُ المطابقة بين عدّ التحليل وعدّ التطبيق. */
export const VERIFY = Object.freeze({
  VERIFIED: 'verified',
  REVIEW: 'review',
  /** التحليلُ لم يذكر عددًا — فلا خلافَ ولا تطابق. */
  NOT_CLAIMED: 'not_claimed',
});

export const VERIFY_LABEL = Object.freeze({
  [VERIFY.VERIFIED]: 'متطابق',
  [VERIFY.REVIEW]: 'محتاج مراجعة',
  [VERIFY.NOT_CLAIMED]: 'بلا عدّ من التحليل',
});

/**
 * يعدّ ظهوراتِ نصٍّ في مصادرَ بعينها — **حسابٌ من النصّ لا من ادّعاء**.
 *
 * ⚠️ **والمطابقةُ على حدود الكلمات لا على أيّ تطابقٍ جزئيّ.** «дом»
 *    داخل «домашний» ليست ظهورًا لـ«дом»، وعدُّها كذلك يضخّم كلَّ
 *    كلمةٍ قصيرة. والروسيّةُ تكتب بحروفٍ لا تحدّها `\b` في جافاسكربت
 *    بشكلٍ موثوق، فنحدّها بأنفسنا: ما قبلَها وما بعدَها ليس حرفًا.
 *
 * @param {string} needle الصيغةُ المطلوبة
 * @param {{sourceKey: string, segmentId: string, text: string}[]} segments
 * @returns {{total: number, hits: object[]}}
 */
export function countForm(needle, segments = []) {
  const term = String(needle || '').trim();
  if (!term) return { total: 0, hits: [] };

  const lower = term.toLowerCase();
  const isLetter = (ch) => Boolean(ch) && /[\p{L}\p{N}]/u.test(ch);
  const hits = [];

  for (const seg of segments) {
    const text = String(seg.text || '');
    const hay = text.toLowerCase();
    let at = hay.indexOf(lower);
    while (at !== -1) {
      const before = at > 0 ? hay[at - 1] : '';
      const after = at + lower.length < hay.length ? hay[at + lower.length] : '';
      if (!isLetter(before) && !isLetter(after)) {
        hits.push({
          sourceKey: seg.sourceKey,
          segmentId: seg.segmentId,
          at,
          quote: text.slice(at, at + term.length),
        });
      }
      at = hay.indexOf(lower, at + 1);
    }
  }
  return { total: hits.length, hits };
}

/**
 * يعدّ مفردةً بكلّ صيغها التي أقرّها التحليل.
 *
 * ⚠️ **ولا يُعَدُّ موضعٌ مرّتين** ولو طابق صيغتين. «документ» و«документы»
 *    صيغتان، والموضعُ الواحدُ يطابق أطولَهما فقط — فلو عددنا كلَّ
 *    مطابقةٍ لَتضاعف الرقمُ بعدد الصيغ المتداخلة.
 */
export function countLemma(forms = [], segments = []) {
  const seen = new Set();
  const hits = [];
  /* الأطولُ أوّلًا كي يفوز على ما هو جزءٌ منه. */
  const ordered = [...new Set(forms.filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  for (const form of ordered) {
    for (const hit of countForm(form, segments).hits) {
      const at = `${hit.sourceKey}#${hit.segmentId}#${hit.at}`;
      if (seen.has(at)) continue;
      seen.add(at);
      hits.push({ ...hit, form });
    }
  }
  return { total: hits.length, hits };
}

/**
 * يفصل مواضعَ إلى المقاييس السبعة (بند ٢).
 *
 * @param {object[]} hits مواضعُ يحمل كلٌّ منها `sourceKey`
 * @param {Map<string, object>} registry سجلُّ المصادر
 */
export function measure(hits = [], registry = new Map()) {
  const situations = new Set();
  const derivedSources = new Set();
  let raw = 0;
  let derived = 0;
  let unknown = 0;

  for (const hit of hits) {
    const row = registry.get(hit.sourceKey);
    const cls = row?.evidenceClass || EVIDENCE.UNKNOWN;
    if (cls === EVIDENCE.PRIMARY) {
      raw += 1;
      situations.add(hit.sourceKey);
    } else if (cls === EVIDENCE.DERIVED) {
      derived += 1;
      derivedSources.add(hit.sourceKey);
    } else {
      unknown += 1;
    }
  }

  return {
    rawOccurrences: raw,
    realSituations: situations.size,
    derivedAppearances: derived,
    derivedSources: derivedSources.size,
    unknownOccurrences: unknown,
    /*
     * ⚠️ **ولا حقلَ اسمُه `total`.** وجودُه يغري بعرضه، وعرضُه هو
     *    بالضبط الجملةُ التي يمنعها البندُ ٢. فمن أراد مجموعًا فليجمع
     *    بيده وليُسمِّ ما جمع.
     */
  };
}

/**
 * يقارن عدَّ التحليل بعدّ التطبيق — **ولا يحسم** (بند ١٣).
 *
 * @param {{claimed: number|null, references?: object[]}} ai
 * @param {{total: number, hits: object[]}} app
 */
export function verify(ai = {}, app = {}) {
  const claimed = Number.isFinite(ai.claimed) ? ai.claimed : null;
  const counted = Number.isFinite(app.total) ? app.total : 0;

  if (claimed === null) {
    return { status: VERIFY.NOT_CLAIMED, claimed: null, counted, missing: [], extra: [] };
  }

  const key = (one) => `${one.sourceKey}#${one.segmentId}`;
  const appKeys = new Set((app.hits || []).map(key));
  const aiKeys = new Set((ai.references || []).map(key));

  /*
   * ⚠️ **والفرقُ يُعرَض بمواضعه لا برقمه.** «التحليل ١٢ والتطبيق ١٣»
   *    لا يقول للمستخدم أين ينظر. فنقول أيَّ موضعٍ رآه أحدُهما ولم
   *    يرَه الآخر — وذلك وحدَه ما يُمكِّن من الحكم.
   */
  const missing = [...aiKeys].filter((k) => !appKeys.has(k));
  const extra = [...appKeys].filter((k) => !aiKeys.has(k));

  const same = claimed === counted && missing.length === 0 && extra.length === 0;
  return {
    status: same ? VERIFY.VERIFIED : VERIFY.REVIEW,
    claimed,
    counted,
    missing,
    extra,
  };
}

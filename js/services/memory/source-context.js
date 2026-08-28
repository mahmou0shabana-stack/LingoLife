/**
 * LingoLife — فتحُ الموضع على سياقه الكامل (WS-J UX · بند ٢٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الاقتباسُ وحدَه ليس دليلًا — إنه إشارةٌ إلى دليل**
 * ═══════════════════════════════════════════════════════════════
 *
 * «Документы необходимо» سطرٌ مقتطَع. وهو يُثبت أن الكلمةَ وردت، ولا
 * يقول **في أيّ موقف**: مَن كان يتكلّم؟ وماذا قيل قبلها وبعدها؟ وهل
 * كانت طلبًا أم اعتراضًا؟
 *
 * وذلك بالضبط هو الفرقُ بين «أرشيفِ لغةٍ من حياتك» و«قائمةِ مفردات».
 * فمن أيّ موضعٍ في «قصّة العنصر» يجب أن يُفتَح **النصُّ الأصليُّ كاملًا**
 * بمقاطعه ومتحدّثيه، والموضعُ مُبرَزٌ فيه.
 *
 * ⚠️ **والنصُّ يُقرأ حيًّا لا من صورةٍ مخزَّنةٍ في صفّ الدليل.** لو
 *    نسخنا الفقرةَ المحيطةَ داخل `analysisEvidence` لَتجمّدت: تعدّل
 *    النصَّ فيبقى الدليلُ يعرض ما لم يعد موجودًا. فالمصدرُ يُقرأ الآن،
 *    وإن اختفى قيل ذلك صراحةً.
 *
 * ⚠️ **ولا يُخترَع تاريخ.** المصدرُ قد لا يحمل تاريخًا، فيُقال «من غير
 *    تاريخ» — راجع البند ٤.
 */

import { readLiveSources } from './source-registry.js';
import { listSources } from './source-registry.js';

/**
 * يقرأ مصدرًا كاملًا بمقاطعه ومتحدّثيه، ويعلّم المقطعَ المطلوب.
 *
 * @param {string} sourceKey مفتاحُ المصدر (`script:ID`)
 * @param {string|null} segmentId المقطعُ المُبرَز
 * @param {string} [needle] النصُّ المطلوبُ إبرازُه داخل المقطع
 * @returns {Promise<object|null>}
 */
export async function sourceContext(sourceKey, segmentId = null, needle = '') {
  const [live, registry] = await Promise.all([readLiveSources(), listSources()]);
  const source = live.find((one) => one.key === sourceKey);
  const meta = registry.find((one) => one.id === sourceKey);

  if (!source) {
    /*
     * ⚠️ **والغيابُ يُوصَف ولا يُبتلَع.** نصٌّ حذفتَه يجب أن يقول إنه
     *    محذوف، لا أن تفتح شاشةً فارغة تبدو عطبًا.
     */
    return {
      missing: true,
      sourceKey,
      title: meta?.title || sourceKey,
      evidenceClass: meta?.evidenceClass || null,
      at: meta?.updatedAt ?? null,
      segments: [],
    };
  }

  return {
    missing: false,
    sourceKey,
    sourceId: source.sourceId,
    sourceKind: source.kind,
    title: source.title || sourceKey,
    /* ⚠️ `null` تعني «لا نعرف» — والشاشةُ تكتبها. */
    at: source.updatedAt ?? source.createdAt ?? null,
    sceneId: source.sceneId || null,
    evidenceClass: meta?.evidenceClass || null,
    originType: meta?.originType || null,
    segments: source.segments.map((seg) => ({
      id: seg.id,
      order: seg.order,
      speaker: seg.speaker ?? null,
      text: seg.text || '',
      isTarget: segmentId ? seg.id === segmentId : false,
      /* مواضعُ الإبراز داخل المقطع — تُحسَب هنا فلا تفعلها الشاشة. */
      hits: needle ? spans(seg.text || '', needle) : [],
    })),
  };
}

/**
 * مواضعُ ظهور نصٍّ داخل مقطع — على حدود الكلمات.
 *
 * ⚠️ **ونفسُ قاعدة `countForm`**: «дом» داخل «домашний» ليست ظهورًا.
 *    ولو أبرزناها هنا وحدَها لَاختلف ما تراه عمّا يُعَدّ، وهو أسوأُ من
 *    ألّا نُبرز شيئًا.
 */
export function spans(text, needle) {
  const term = String(needle || '').trim().toLowerCase();
  if (!term) return [];
  const hay = String(text || '').toLowerCase();
  const isLetter = (ch) => Boolean(ch) && /[\p{L}\p{N}]/u.test(ch);

  const out = [];
  let at = hay.indexOf(term);
  while (at !== -1) {
    const before = at > 0 ? hay[at - 1] : '';
    const after = at + term.length < hay.length ? hay[at + term.length] : '';
    if (!isLetter(before) && !isLetter(after)) out.push({ from: at, to: at + term.length });
    at = hay.indexOf(term, at + 1);
  }
  return out;
}

/**
 * يقسّم نصًّا إلى أجزاءٍ مُبرَزةٍ وغيرِ مُبرَزة — جاهزةً للرسم بلا HTML خامّ.
 *
 * ⚠️ **ولا تُبنى سلسلةُ HTML هنا.** بناءُ `<mark>` في خدمةٍ يعني نصًّا
 *    غيرَ مهرَّبٍ يمرّ إلى الشاشة، وهو بابُ ثغرةٍ افتُتح مرّةً في هذا
 *    المشروع. فالخدمةُ تعطي أجزاءً، والشاشةُ تهرّبها كعادتها.
 */
export function splitHighlights(text, hits = []) {
  const source = String(text || '');
  if (!hits.length) return [{ text: source, hit: false }];

  const out = [];
  let at = 0;
  for (const one of hits) {
    if (one.from > at) out.push({ text: source.slice(at, one.from), hit: false });
    out.push({ text: source.slice(one.from, one.to), hit: true });
    at = one.to;
  }
  if (at < source.length) out.push({ text: source.slice(at), hit: false });
  return out;
}

/**
 * LingoLife — إعادةُ تحليل الكلمات المحفوظة (WS54)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **التحليلُ ليس حقيقةً مجمَّدة**
 * ═══════════════════════════════════════════════════════════════
 *
 * قواعدُ هذا المحرّك تتحسّن — بعضُها اليوم `PROVISIONAL` وسيصير غدًا
 * `VERIFIED` أو يُصحَّح. ولو حفظنا مع كلّ كلمةٍ **شرحَها النهائيّ**
 * لتجمّد عند لحظة حفظه، ولصار تحسينُ قاعدةٍ يعني تحريرَ مئات الصفوف
 * بيدك — أو تركَها تكذب بهدوء.
 *
 * فالمحفوظُ مع الكلمة ثلاثةٌ لا أكثر: **النبرُ ومصدرُه**،
 * **معرِّفاتُ القواعد**، **وإصدارُ مجموعة القواعد**. والشرحُ يُشتقّ
 * عند العرض. فحين يرتفع الإصدار:
 *
 *   · تُعرَف كلُّ كلمةٍ حُلِّلت بإصدارٍ أقدم — بمقارنةِ رقمٍ واحد.
 *   · وتُعرَف الكلماتُ التي تمسّها قاعدةٌ بعينها — بمعرِّفها.
 *   · وتُعاد تحليلًا بلا أن تُحرّر واحدةً.
 *
 * ⚠️ **وإعادةُ التحليل لا تُتلف شيئًا.** لا تمسّ نصَّك ولا تصنيفاتك
 *    ولا ملاحظاتك — تكتب حقلَ `pronunciation` وحدَه. وصفٌّ بلا هذا
 *    الحقل (محفوظٌ قبل WS52) يُملأ ولا يُكسَر.
 */

import { savedItems } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { SAVED_KIND } from '../saved-service.js';
import {
  analyzeWord, pronunciationMetadata, RULESET_VERSION, PRONUNCIATION_ANALYSIS_VERSION,
} from './engine.js';

/**
 * هل تحليلُ هذا الصفّ متقادم؟
 *
 * ⚠️ **وسؤالان لا سؤال** (WS-N · §49). القواعدُ قد تتحسّن فيتغيّر
 *    **الجواب**، وبنيةُ التحليل قد تتغيّر فيتغيّر **شكلُ الجواب**.
 *    وصفٌّ محفوظٌ ببنيةٍ قديمة يحمل قواعدَ صحيحةً ولا يحمل الطبقتين،
 *    فقراءتُه كأنّه جديدٌ تُظهِر «منفردة» فارغة. متقادمٌ إذن — لا تالف.
 */
export function isStale(meta) {
  if (!meta) return true;                       /* بلا تحليلٍ أصلًا */
  if (meta.rulesetVersion !== RULESET_VERSION) return true;
  return meta.analysisVersion !== PRONUNCIATION_ANALYSIS_VERSION;
}

/**
 * يمسح المحفوظاتِ ويقول ما الذي يحتاج إعادةَ تحليل — **بلا كتابة**.
 *
 * @param {{ ruleId?: string|null }} filter
 *        `ruleId` لتضييق النطاق على قاعدةٍ بعينها صُحِّحت.
 */
export async function findStale({ ruleId = null } = {}) {
  const rows = await savedItems.getAll();
  return rows
    .filter((row) => row.state === STATE.ACTIVE && row.kind === SAVED_KIND.WORD)
    .filter((row) => {
      if (ruleId) {
        /* قاعدةٌ بعينها: يعنينا مَن استعملها فقط. */
        return (row.pronunciation?.ruleIds || []).includes(ruleId);
      }
      return isStale(row.pronunciation);
    });
}

/**
 * يُعيد تحليلَ ما تقادم ويكتب النتيجة.
 *
 * ⚠️ **والنبرُ الذي أكّدتَه بنفسك يبقى نبرَك.** إعادةُ التحليل تُعيد
 *    تشغيل القواعد، ولا تُعيد النظر في ما قلتَه أنت: `stressOrdinal`
 *    المنسوبُ `user_confirmed` يُمرَّر كتجاوزٍ صريح. ولولا ذلك لضاع
 *    تصحيحُك مع أوّل ترقيةِ قواعد — وهو أسوأُ ما يمكن أن تفعله ترقية.
 *
 * @returns {Promise<{ scanned: number, updated: number, version: string, ids: string[] }>}
 */
export async function reanalyzeSaved({ ruleId = null, limit = Infinity } = {}) {
  const stale = (await findStale({ ruleId })).slice(0, limit);
  const ids = [];

  for (const row of stale) {
    const keepUserStress = row.pronunciation?.stressSource === 'user_confirmed'
      && Number.isInteger(row.pronunciation?.stressOrdinal)
      ? row.pronunciation.stressOrdinal
      : null;

    const fresh = pronunciationMetadata(
      analyzeWord(row.text, { overrideStressOrdinal: keepUserStress })
    );
    if (!fresh) continue;
    await savedItems.update(row.id, { pronunciation: fresh });
    ids.push(row.id);
  }

  return { scanned: stale.length, updated: ids.length, version: RULESET_VERSION, ids };
}

/**
 * تقريرٌ سريع: كم كلمةً على أيّ إصدار؟ — لواجهةٍ مستقبليّةٍ ولتقاريرنا.
 */
export async function analysisCoverage() {
  const rows = await savedItems.getAll();
  const words = rows.filter((r) => r.state === STATE.ACTIVE && r.kind === SAVED_KIND.WORD);
  const byVersion = new Map();
  let none = 0;
  for (const row of words) {
    const v = row.pronunciation?.rulesetVersion;
    if (!v) { none += 1; continue; }
    byVersion.set(v, (byVersion.get(v) || 0) + 1);
  }
  /* بنيةُ التحليل تُعَدّ على حدة — فقد تتقادم وحدَها بلا تغيّرِ قاعدة. */
  const legacyStructure = words.filter((r) => r.pronunciation
    && r.pronunciation.analysisVersion !== PRONUNCIATION_ANALYSIS_VERSION).length;

  return {
    total: words.length,
    current: byVersion.get(RULESET_VERSION) || 0,
    stale: words.length - (byVersion.get(RULESET_VERSION) || 0),
    withoutAnalysis: none,
    legacyStructure,
    analysisVersion: PRONUNCIATION_ANALYSIS_VERSION,
    versions: Object.fromEntries(byVersion),
  };
}

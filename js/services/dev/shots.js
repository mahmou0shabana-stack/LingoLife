/**
 * LingoLife — مختبر التطوّر: اللقطات و«أنهي جزء بالظبط»
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لماذا تُرفَق اللقطة ولا تُلتقَط من داخل التطبيق
 * ═══════════════════════════════════════════════════════════════
 *
 * المتصفّح **لا يعطي صفحةً صورةَ نفسها**. والطرق المتاحة كلها لا تصلح
 * هنا، ولكلٍّ سببٌ مقيسٌ لا مفترَض:
 *
 *  · **مكتبةٌ ترسم الـDOM على canvas** (html2canvas وأخواتها) — تخالف
 *    قاعدة المشروع الأولى: **بلا مكتبات خارجيّة وبلا خطوة بناء**. وهي
 *    فوق ذلك تعيد رسم الصفحة بتقريبٍ لا يطابقها، فتشكو من شيءٍ وتصوّر
 *    شيئًا آخر.
 *  · **`getDisplayMedia`** — غير مدعومةٍ في متصفّحات أندرويد، وجهازك
 *    تابلت. فزرٌّ يعتمد عليها زرُّ شكلٍ عندك.
 *  · **`foreignObject` في SVG** — لا يقرأ ملفّات CSS الخارجيّة ويلوّث
 *    الـcanvas، فيخرج شيءٌ لا يشبه شاشتك.
 *
 * فالطريق الصادق: **تصوّر الشاشة بجهازك** (على Tab S10+ بمسح الكفّ أو
 * زرّ التشغيل مع خفض الصوت)، ثم تُرفقها. وهذا **أفضل** لا مجرّد بديل:
 * لقطة الجهاز هي ما رأيتَه فعلًا — بخطوطه وبشريط النظام وبكل شيء —
 * لا إعادةَ رسمٍ تقريبيّة.
 *
 * ═══════════════════════════════════════════════════════════════
 * والمنطقة تُخزَّن نِسَبًا لا بكسلات
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ `{x, y, w, h}` كلُّها من ٠ إلى ١. لقطة التابلت ٢٨٠٠ بكسل عرضًا
 *    وتُعرَض على ٣٤٠، وحفظُ البكسلات يجعل الإشارة تقع في مكانٍ آخر
 *    عند أول عرضٍ بمقاسٍ مختلف — أو في التصدير.
 */

import { devShots, media } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { storeStandaloneImage, urlFor } from '../media-service.js';
import { EVENT } from './model.js';
import { devEvents } from '../../db/repositories.js';

/** قبل التنفيذ أم بعده — وهو ما يصنع المقارنة. */
export const PHASE = Object.freeze({ BEFORE: 'before', AFTER: 'after' });

export const PHASE_LABEL = Object.freeze({
  [PHASE.BEFORE]: 'قبل',
  [PHASE.AFTER]: 'بعد',
});

/** يتحقّق أن المنطقة نِسَبٌ صالحة — أو يردّ `null` بلا ادّعاء. */
export function normalizeRegion(region) {
  if (!region) return null;
  const { x, y, w, h } = region;
  const nums = [x, y, w, h];
  if (nums.some((n) => typeof n !== 'number' || Number.isNaN(n))) return null;
  // منطقةٌ بلا مساحة ليست إشارة.
  if (w <= 0 || h <= 0) return null;
  const clamp = (n) => Math.min(1, Math.max(0, n));
  const nx = clamp(x);
  const ny = clamp(y);
  return {
    x: nx,
    y: ny,
    w: Math.min(1 - nx, clamp(w)),
    h: Math.min(1 - ny, clamp(h)),
  };
}

/**
 * يرفق لقطةً بملاحظة.
 *
 * @param {string} issueId
 * @param {File|Blob} file
 * @param {object} [options]
 * @param {string} [options.phase]   `before` (الافتراضيّ) أو `after`
 * @param {object} [options.region]  نِسَبٌ من ٠ إلى ١
 * @param {string} [options.caption]
 */
export async function attachShot(issueId, file, { phase = PHASE.BEFORE, region = null, caption = '' } = {}) {
  if (!issueId) throw new Error('اللقطة محتاجة ملاحظة');
  if (!file) throw new Error('مفيش صورة');

  const saved = await storeStandaloneImage(file);
  const shot = await devShots.create({
    issueId,
    mediaId: saved.id,
    phase: phase === PHASE.AFTER ? PHASE.AFTER : PHASE.BEFORE,
    region: normalizeRegion(region),
    caption: String(caption || '').trim(),
  });

  await devEvents.create({
    issueId,
    kind: EVENT.SHOT,
    at: Date.now(),
    from: null,
    to: null,
    note: phase === PHASE.AFTER ? 'صورة بعد التنفيذ' : '',
    ref: shot.id,
  });

  return shot;
}

/** يعدّل المنطقة أو الوصف على لقطةٍ قائمة — بلا حدث: ضبطُ إشارةٍ ليس تاريخًا. */
export async function updateShot(shotId, { region, caption } = {}) {
  const patch = {};
  if (region !== undefined) patch.region = normalizeRegion(region);
  if (caption !== undefined) patch.caption = String(caption || '').trim();
  if (!Object.keys(patch).length) return devShots.get(shotId);
  return devShots.update(shotId, patch);
}

/**
 * يشيل لقطة — إلى السلّة لا إلى العدم، كباقي المشروع.
 *
 * ⚠️ **والملفّ نفسه يبقى.** ما يُشال هو **إرفاق** اللقطة بالملاحظة، لا
 *    الصورة — وهي نفس قاعدة `sceneMediaLinks` حرفيًّا: «الملفّ يبقى؛
 *    ما يُشال هو ربطه». ومحوُ الملفّ هنا كان سيجعل `media` تُنقَل
 *    للسلّة وهي مُعلَنةٌ أنها لا تُنقَل — فيصير سلوكان لقاعدةٍ واحدة.
 */
export async function removeShot(shotId) {
  const shot = await devShots.get(shotId);
  if (!shot) return false;
  await devShots.trash(shotId);
  return true;
}

/**
 * لقطات ملاحظة، مقروءةً للعرض — ومعها رابط الصورة.
 *
 * ⚠️ الترتيب: «قبل» ثم «بعد» دائمًا. المقارنة تُقرأ في اتّجاهٍ واحد،
 *    وعكسُها يجعل «بعد» تبدو كأنها الحال القائمة.
 */
export async function shotsOf(issueId) {
  const rows = (await devShots.byIndex('issueId', issueId))
    .filter((row) => row.state === STATE.ACTIVE);

  const ids = rows.map((row) => row.mediaId).filter(Boolean);
  const files = await media.getMany(ids);
  const byId = new Map(files.filter(Boolean).map((row) => [row.id, row]));

  return rows
    .map((row) => {
      const file = byId.get(row.mediaId);
      return {
        ...row,
        /* الوسيط المحذوف لا يُعرض صفًّا مكسورًا — يُسقَط. */
        media: file && file.state !== STATE.TRASHED ? file : null,
      };
    })
    .filter((row) => row.media)
    .sort((a, b) => {
      if (a.phase !== b.phase) return a.phase === PHASE.BEFORE ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
}

/** رابطٌ للعرض — يمرّ بكاش الوسائط نفسه فلا يُنشَأ رابطان لملفّ. */
export function shotUrl(shot, { thumb = false } = {}) {
  return shot?.media ? urlFor(shot.media, { thumb }) : '';
}

/** هل عندها مقارنة قبل/بعد كاملة؟ — يُقرَأ في اللوحة وفي التصدير. */
export function hasComparison(shots) {
  return shots.some((row) => row.phase === PHASE.BEFORE)
    && shots.some((row) => row.phase === PHASE.AFTER);
}

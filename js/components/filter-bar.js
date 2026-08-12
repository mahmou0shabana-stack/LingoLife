/**
 * LingoLife — شريط الفلترة المطويّ (WS18)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ المقياس الذي بُني عليه هذا الملفّ — مقيسٌ لا موصوف
 * ═══════════════════════════════════════════════════════════════
 *
 * على الهاتف (412×915)، في `/dev`:
 *
 * ```
 * أوّلُ ملاحظةٍ تبدأ عند 772px  =  ٨٤٪ من الشاشة
 * أربعُ قوائم فلترة، واحدةٌ تحت الأخرى، قبل أن ترى شيئًا
 * ```
 *
 * وقلتَها: **«الصفحات دوشة، ومش عارف فين بيودّي على فين، إرهاق شديد»**.
 * فهذه أوّلُ قطعةٍ في المشروع النجاحُ فيها أن يصير على الشاشة **أقلّ**.
 *
 * ═══════════════════════════════════════════════════════════════
 * والقاعدة: الأدوات تنطوي، والمحتوى لا
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **لكنها تُفتَح تلقائيًّا إن كان فيها فلترٌ شغّال.** وهذا ليس
 *    استثناءً بل جوهر الأمر: فلترٌ مخفيٌّ وفعّال أسوأ من فلترٍ ظاهر —
 *    ترى قائمةً ناقصةً ولا تعرف لماذا، فتظنّ أن بياناتك ضاعت.
 *
 * ⚠️ **والعدد على الزرّ.** «فلترة ③» تقول لك بلا فتحٍ أن ثلاثة قيودٍ
 *    تعمل الآن. زرٌّ مطويٌّ بلا عدّاد يُخفي الحالة لا الضجيج.
 */

import { html, raw } from '../utils/dom.js';
import { icon } from './icons.js';

/**
 * يبني شريط فلترةٍ مطويًّا.
 *
 * @param {object} options
 * @param {number} options.active كم فلترًا يعمل الآن
 * @param {string} options.body   محتوى الشريط (HTML جاهز)
 * @param {string} [options.label]
 * @param {string} [options.clear] فعلُ زرّ «شيل الفلاتر» — يظهر إن وُجد فلتر
 */
export function filterBar({ active = 0, body, label = 'فلترة', clear = '' }) {
  return html`
    <details class="filter-bar"${raw(active ? ' open' : '')}>
      <summary class="fb-summary">
        ${raw(icon('search', 15))}
        <span>${label}</span>
        ${raw(active ? html`<span class="fb-n">${active}</span>` : '')}
      </summary>
      <div class="fb-body">
        ${raw(body)}
        ${raw(active && clear
          ? html`<button class="mini-btn fb-clear" data-dev="${clear}" data-action="${clear}">
              شيل الفلاتر
            </button>`
          : '')}
      </div>
    </details>`;
}

/** يعدّ ما هو غيرُ فارغٍ في كائن الفلاتر — العدّاد على الزرّ. */
export function activeCount(filters = {}) {
  return Object.values(filters).filter((v) => v !== '' && v !== null && v !== undefined).length;
}

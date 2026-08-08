/**
 * LingoLife — منتقي نوع الحدث
 *
 * حقلٌ صغير يتكرّر في كل نموذج يسأل «نوع إيه؟»: نموذج الذكرى، ونموذج
 * السكريبت، وما سيأتي. وُضع في وحدة مستقلّة لأنه سيتكرّر أكثر — وليعرف
 * مَن يعدّله أنه يعدّله في مكان واحد.
 */

import { html, raw, esc } from '../utils/dom.js';
import { icon } from './icons.js';
import { typeTree } from '../services/type-service.js';

/**
 * خيارات المنتقي: الجذور وفروعها في `optgroup` واحد لكل جذر.
 * الفرع يبقى ظاهرًا تحت أبيه فلا تضيع علاقتهما.
 */
export async function typeOptions(selected) {
  const tree = await typeTree();
  return tree
    .map((root) => {
      const self = `<option value="${root.id}"${root.id === selected ? ' selected' : ''}>${esc(root.label)}</option>`;
      if (!root.children.length) return self;
      const kids = root.children
        .map(
          (c) =>
            `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>&nbsp;&nbsp;↳ ${esc(c.label)}</option>`
        )
        .join('');
      return `<optgroup label="${esc(root.label)}">${self}${kids}</optgroup>`;
    })
    .join('');
}

/** الحقل كاملًا: المنتقي وزرّ إدارة الأنواع بجانبه. */
export async function typeSelect(name, selected) {
  return html`
    <div class="type-field">
      <select id="f-${name}" name="${name}">${raw(await typeOptions(selected))}</select>
      <button type="button" class="btn btn-ghost btn-sm" data-action="manage-types">
        ${raw(icon('plus', 15))} أنواع
      </button>
    </div>`;
}

/**
 * يعيد بناء خيارات منتقٍ مفتوح بعد تعديل الأنواع.
 * يحاول إبقاء ما كان مختارًا؛ فإن أُرشِف أو دُمج يقع على أول خيار.
 */
export async function refreshTypeSelect(select) {
  const previous = select.value;
  select.innerHTML = await typeOptions(previous);
  if (select.value !== previous) select.selectedIndex = 0;
}

/** قائمة بسيطة من `{id,label}` — للأنواع الثابتة كصيغة النصّ. */
export function selectOptions(items, selected) {
  return items
    .map((t) => `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${t.label}</option>`)
    .join('');
}

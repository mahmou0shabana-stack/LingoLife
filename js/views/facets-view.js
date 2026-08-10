/**
 * LingoLife — أشجار المحاور: «إيه اللي عندي؟»
 *
 * النهر يجيب «إيه اللي حصل بعد إيه؟»، وهذه تجيب سؤالًا قبله:
 * **«إيه المحاور اللي حياتي متقسّمة عليها، وقد إيه في كل واحد؟»**
 *
 * ═══════════════════════════════════════════════════════════════
 * ثلاث قواعد
 * ═══════════════════════════════════════════════════════════════
 *
 * **١. الأشجار تُبنى ممّا في ذكرياتك لا ممّا في جداول التعريف.**
 *
 * عندك أربعةَ عشرَ نوعَ حدثٍ مُعرَّفًا وتسعةٌ منها مستعملة. عرضُ
 * الأربعةَ عشرَ يعني خمسة أزرارٍ تُفرّغ النهر عند الضغط. فالصفر لا
 * يُعرَض، وما يُعرَض قابلٌ للضغط دائمًا (بند 89).
 *
 * **٢. كل رقمٍ مدخلٌ لا زينة** (بند 66).
 *
 * تضغط «إيجور ٤» فيُصفّى النهر على إيجور. الرقم وعدٌ بأنك ستجد أربعة،
 * والضغط يفي به.
 *
 * **٣. ما لا محورَ له يُعلَن في مكانه** لا يُحذف من الشاشة صامتًا.
 */

import { html, raw } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { typeLabel, typeTree } from '../services/type-service.js';
import { THREAD_STATUS_LABEL } from '../services/thread-service.js';
import { AXIS, ABSENT_AXES, facetTree } from '../services/atlas-service.js';

/** صفٌّ واحد: اسمٌ وعددٌ يُضغطان معًا. */
function facetRow(axis, id, label, count, { depth = 0, extra = '' } = {}) {
  return html`
    <button class="fc-row" data-action="facet-open" data-axis="${axis}" data-id="${id}"
            data-label="${label}" style="--depth:${depth}">
      <span class="fc-label"><bdi>${label}</bdi></span>
      ${raw(extra)}
      <span class="fc-count">${count}</span>
    </button>`;
}

function section(title, iconName, rows, emptyNote) {
  return html`
    <section class="fc-section">
      <h3>${raw(icon(iconName, 17))} ${title}</h3>
      ${raw(rows.length ? rows.join('') : html`<p class="fc-empty">${emptyNote}</p>`)}
    </section>`;
}

export async function renderFacets(main) {
  const [tree, types] = await Promise.all([facetTree(), typeTree({ includeArchived: true })]);

  const typeCount = new Map(tree.types.map((t) => [t.id, t.count]));

  /*
   * النوع شجريّ — والفرع يُعرَض تحت أصله ولو كان الأصل نفسه بلا
   * ذكريات: «فحص ← داخلي» يفقد معناه إن عُرض «داخلي» وحده.
   */
  const typeRows = [];
  for (const root of types) {
    const kids = (root.children || []).filter((child) => typeCount.get(child.id));
    const own = typeCount.get(root.id) || 0;
    if (!own && !kids.length) continue;

    if (own) typeRows.push(facetRow(AXIS.TYPE, root.id, root.label, own));
    else typeRows.push(html`<div class="fc-row is-parent"><span class="fc-label">${root.label}</span></div>`);

    for (const child of kids) {
      typeRows.push(facetRow(AXIS.TYPE, child.id, child.label, typeCount.get(child.id), { depth: 1 }));
    }
  }

  const placeRows = tree.places.map((place) =>
    facetRow(AXIS.PLACE, place.key, place.label, place.count)
  );

  const peopleRows = tree.people.map((person) =>
    facetRow(AXIS.PERSON, person.id, person.label, person.count)
  );

  const threadRows = tree.threads.map((thread) =>
    facetRow(AXIS.THREAD, thread.id, thread.label, thread.count, {
      extra: html`<span class="fc-status is-${thread.status}">${
        THREAD_STATUS_LABEL[thread.status] || thread.status
      }</span>`,
    })
  );

  main.innerHTML = html`
    <div class="view-head rv-head">
      <div>
        <h1>محاور حياتك</h1>
        <div class="sub">${tree.total} ذكرى — مقسومة بأكتر من طريقة</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="go-constellation">
        ${raw(icon('person', 15))} الكوكبة
      </button>
    </div>

    ${raw(tree.total ? '' : html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('life'))}</div>
        <h2>مفيش ذكريات لسه</h2>
        <p>المحاور بتتبني من ذكرياتك، مش من جداول التعريف.</p>
        <button class="btn btn-primary" data-action="new-scene">سجّل ذكرى</button>
      </div>`)}

    ${raw(tree.total ? html`
      <div class="fc-board">
      ${raw(section('النوع', 'star', typeRows, 'مفيش أنواع مستعملة'))}
      ${raw(section('الأشخاص', 'person', peopleRows,
        'مفيش أشخاص مربوطين بالمحادثات لسه — اربطهم من «مين بيتكلم».'))}
      ${raw(section('المكان', 'place', placeRows, 'مفيش أماكن مكتوبة في ذكرياتك'))}
      ${raw(section('الخيوط', 'link', threadRows, 'مفيش خيوط فيها ذكريات'))}
      </div>
    ` : '')}

    <details class="fc-absent">
      <summary>محاور مش موجودة — والسبب مكتوب</summary>
      ${raw(Object.entries(ABSENT_AXES).map(([, reason]) => html`<p>${reason}</p>`).join(''))}
      <p class="fc-note">
        والمكان بيتجمّع بالاسم المكتوب مش ككيان، فـ«مكتب الشركة»
        و«مكتب الشركه» بيتحسبوا واحد — لكن مفيش صفحة للمكان لسه.
      </p>
      <p class="fc-note">
        والأشخاص بتتحسب من اللي اتكلّموا في المحادثة. مين حضر وما
        اتكلّمش مش هيتعدّ — مفيش مصدر يقوله.
      </p>
    </details>`;
}

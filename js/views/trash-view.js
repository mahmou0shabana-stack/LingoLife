/**
 * LingoLife — سلة المهملات
 * ثلاث حالات: نشط / مؤرشف / في السلة. الحذف النهائي بتأكيد صريح (بند 52).
 */

import { listTrashed, restoreScene } from '../services/scene-service.js';
import { scenes } from '../db/repositories.js';
import { html, raw } from '../utils/dom.js';
import { relativeTime } from '../utils/dates.js';
import { icon } from '../components/icons.js';
import { toastOk } from '../components/toast.js';
import { confirmAction } from '../components/modal.js';
import { refresh } from '../router.js';

export async function renderTrash(main) {
  const items = await listTrashed();

  if (!items.length) {
    main.innerHTML = html`
      <button class="back-row" data-action="back">${raw(icon('back'))} رجوع</button>
      <div class="empty-state">
        <div class="glyph">${raw(icon('trash'))}</div>
        <h2>السلة فاضية</h2>
        <p>أي ذكرى تنقلها للسلة هتفضل هنا لحد ما تسترجعها أو تمسحها نهائيًا.</p>
      </div>`;
    return;
  }

  main.innerHTML = html`
    <button class="back-row" data-action="back">${raw(icon('back'))} رجوع</button>
    <div class="view-head">
      <h1>سلة المهملات</h1>
      <div class="sub">${items.length} عنصر · قابل للاسترجاع</div>
    </div>

    ${raw(
      items
        .map(
          (scene) => html`
            <div class="panel" style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:center">
              <div style="min-width:0">
                <strong>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</strong>
                <div class="text-sm text-faint">اتنقلت ${relativeTime(scene.deletedAt)}</div>
              </div>
              <div style="display:flex;gap:var(--sp-2);flex:none">
                <button class="mini-btn" data-action="restore-scene" data-id="${scene.id}">استرجاع</button>
                <button class="mini-btn" data-action="destroy-scene" data-id="${scene.id}"
                  style="color:var(--red)">حذف نهائي</button>
              </div>
            </div>`
        )
        .join('')
    )}`;
}

/** إجراءات السلة — يُستدعى من app.js. */
export async function handleTrashAction(action, id) {
  if (action === 'restore-scene') {
    await restoreScene(id);
    toastOk('الذكرى رجعت');
    await refresh();
    return true;
  }

  if (action === 'destroy-scene') {
    const ok = await confirmAction({
      title: 'حذف نهائي',
      message:
        'ده هيمسح الذكرى دي من الجهاز نهائيًا. مفيش تراجع بعد كده. متأكد؟',
      confirmLabel: 'امسح نهائيًا',
      danger: true,
    });
    if (!ok) return true;
    await scenes.destroy(id);
    toastOk('اتمسحت نهائيًا');
    await refresh();
    return true;
  }

  return false;
}

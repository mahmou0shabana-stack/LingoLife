/**
 * LingoLife — سلة المهملات
 *
 * كانت تعرض المشاهد وحدها بينما التطبيق ينقل سبعة أنواع إلى السلة —
 * فكان كل ما عدا الذكرى يختفي بعد زوال إشعار «تراجع» ويبقى في القاعدة
 * بلا طريق إليه.
 *
 * صارت تُبنى من `TRASHABLE` في `trash-service.js`: مجموعةٌ لكل نوع،
 * والنوع مكتوبٌ صراحةً على الصفّ فتعرف ما تستعيده. والحذف النهائي
 * يعرض ما سيُفقَد معه قبل أن يسأل (بند 12).
 */

import { html, raw, esc } from '../utils/dom.js';
import { relativeTime } from '../utils/dates.js';
import { icon } from '../components/icons.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { confirmAction, showModal } from '../components/modal.js';
import { refresh } from '../router.js';
import {
  listTrash,
  restoreItem,
  restoreBlockedBy,
  destroyItem,
  linkedTo,
} from '../services/trash-service.js';

/** الصفوف المعروضة الآن — نقرأ منها عند الضغط بدل إعادة الاستعلام. */
let shown = new Map();

function itemRow(item) {
  return html`
    <div class="trash-row">
      <span class="trash-icon">${raw(icon(item.icon || 'trash', 17))}</span>
      <div class="trash-main">
        <div class="trash-title${item.ru ? ' ru' : ''}"
          ${raw(item.ru ? 'dir="ltr" lang="ru"' : '')}>${item.title}</div>
        ${raw(item.subtitle ? html`<div class="trash-sub">${item.subtitle}</div>` : '')}
        <div class="trash-when">اتشال ${relativeTime(item.deletedAt)}</div>
      </div>
      <div class="trash-tools">
        <button class="mini-btn" data-action="trash-restore" data-key="${item.store}:${item.id}">
          ${raw(icon('restore', 15))} استرجاع
        </button>
        <button class="mini-btn danger" data-action="trash-destroy"
          data-key="${item.store}:${item.id}">
          حذف نهائي
        </button>
      </div>
    </div>`;
}

export async function renderTrash(main) {
  const groups = await listTrash();

  shown = new Map();
  for (const group of groups) {
    for (const item of group.items) shown.set(`${item.store}:${item.id}`, item);
  }

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (!total) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('trash'))}</div>
        <h2>السلة فاضية</h2>
        <p>أي حاجة تحذفها — ذكرى أو سكريبت أو صورة أو تعبير — هتفضل هنا
          لحد ما تسترجعها أو تمسحها نهائيًا.</p>
      </div>`;
    return;
  }

  main.innerHTML = html`
    <div class="view-head">
      <h1>سلة المهملات</h1>
      <div class="sub">${total} عنصر · كلها قابلة للاسترجاع</div>
    </div>

    ${raw(
      groups
        .map(
          (group) => html`
            <section class="trash-group">
              <div class="group-label">
                ${group.label}
                <span class="count">${group.items.length}</span>
              </div>
              <div class="panel trash-list">
                ${raw(group.items.map(itemRow).join(''))}
              </div>
            </section>`
        )
        .join('')
    )}`;
}

/** إجراءات السلة — يُستدعى من app.js. */
export async function handleTrashAction(action, id, target) {
  const key = target?.dataset?.key;

  if (action === 'trash-restore') {
    const item = shown.get(key);
    if (!item) return true;

    // سكريبتٌ يعود بينما ذكراه في السلة يعود إلى الاختفاء نفسه —
    // نكشفها قبل الاستعادة فيقرّر المستخدم.
    const blocker = await restoreBlockedBy(item);
    let withScene = false;

    if (blocker.blocked) {
      const value = await showModal({
        title: 'الذكرى نفسها في السلة',
        body: html`
          <p style="line-height:1.9;color:var(--ink-soft)">
            «${item.title}» تابع لذكرى <strong>${blocker.sceneTitle}</strong>
            وهي نفسها في السلة. لو رجّعناه لوحده مش هيبان في أي شاشة.
          </p>`,
        actions: [
          { label: 'إلغاء', value: null, variant: 'ghost' },
          { label: 'رجّع الاتنين', value: 'submit', variant: 'primary' },
        ],
      });
      if (value !== 'submit') return true;
      withScene = true;
    }

    try {
      await restoreItem(item, { withScene });
      toastOk(withScene ? 'رجعوا الاتنين' : 'رجع تاني');
    } catch (err) {
      toastError(err.message || 'مقدرناش نرجّعه');
    }
    await refresh();
    return true;
  }

  if (action === 'trash-destroy') {
    const item = shown.get(key);
    if (!item) return true;

    // البند 12: لا تدمير صامت للمرتبطات — نعرضها بالاسم والعدد.
    const links = await linkedTo(item);
    const linkLines = links.length
      ? `<br><br>هيتشال معاه:<br>${links
          .map((l) => `· ${l.count} ${esc(l.label)}`)
          .join('<br>')}`
      : '';

    const ok = await confirmAction({
      title: 'حذف نهائي',
      message:
        `«${esc(item.title)}»${linkLines}<br><br>` +
        '<strong>ده هيمسحه من الجهاز نهائيًا. مفيش تراجع بعد كده.</strong>',
      confirmLabel: 'امسح نهائيًا',
      danger: true,
    });
    if (!ok) return true;

    try {
      await destroyItem(item);
      toast('اتمسح نهائيًا');
    } catch (err) {
      toastError(err.message || 'مقدرناش نمسحه');
    }
    await refresh();
    return true;
  }

  return false;
}

/**
 * LingoLife — شاشة "حياتي"
 * السيرة البصرية لرحلتك اللغوية — خط زمني مجمّع بالشهر، لا مدير ملفات (بند 7).
 */

import { listScenesByMonth } from '../services/scene-service.js';
import { html, raw } from '../utils/dom.js';
import { formatMonth, formatDate } from '../utils/dates.js';
import { sceneTypeLabel } from '../config.js';
import { icon } from '../components/icons.js';

function sceneCard(scene) {
  return html`
    <button class="scene-card" data-action="open-scene" data-id="${scene.id}">
      <div class="thumb">
        <div class="no-img">${raw(icon('image', 22))}</div>
      </div>
      <div class="body">
        <div class="meta-row">
          <span>${formatDate(scene.date)}</span>
          <span class="badge">${sceneTypeLabel(scene.type)}</span>
        </div>
        <h3>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h3>
        ${raw(scene.titleRu ? html`<div class="ru">${scene.titleRu}</div>` : '')}
      </div>
    </button>`;
}

export async function renderLife(main) {
  const groups = await listScenesByMonth({ limit: 200 });

  if (!groups.length) {
    main.innerHTML = html`
      <div class="view-head">
        <h1>حياتي</h1>
        <div class="sub">الخط الزمني لذكرياتك اللغوية</div>
      </div>
      <div class="empty-state">
        <div class="glyph">${raw(icon('life'))}</div>
        <h2>الخط الزمني فاضي</h2>
        <p>أول ما تضيف ذكرى هتلاقيها هنا مرتّبة بالشهر والسنة.</p>
        <button class="btn btn-primary" data-action="new-scene">
          ${raw(icon('plus', 18))} أضف ذكرى
        </button>
      </div>`;
    return;
  }

  const total = groups.reduce((sum, g) => sum + g.scenes.length, 0);

  main.innerHTML = html`
    <div class="view-head">
      <h1>حياتي</h1>
      <div class="sub">${total} ذكرى · ${groups.length} شهر</div>
    </div>

    ${raw(
      groups
        .map(
          (group) => html`
            <section class="timeline-group">
              <div class="group-label">
                ${formatMonth(group.date)}
                <span class="count">${group.scenes.length} ذكرى</span>
              </div>
              <div class="scene-list">
                ${raw(group.scenes.map(sceneCard).join(''))}
              </div>
            </section>`
        )
        .join('')
    )}

    <div class="not-yet">
      ${raw(icon('info', 18))}
      <div>
        <strong>عروض إضافية قادمة:</strong> أماكن، أشخاص، مواضيع، ورحلات —
        المرحلة 4.
      </div>
    </div>`;
}

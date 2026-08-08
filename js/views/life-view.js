/**
 * LingoLife — شاشة "حياتي"
 * السيرة البصرية للرحلة — خط زمني مجمّع بالشهر، لا مدير ملفات (بند 7).
 */

import { listScenesByMonth } from '../services/scene-service.js';
import { media, sceneMediaLinks } from '../db/repositories.js';
import { urlFor, releaseUrls } from '../services/media-service.js';
import { html, raw } from '../utils/dom.js';
import { formatMonth, formatDate } from '../utils/dates.js';
import { typeLabel } from '../services/type-service.js';
import { icon } from '../components/icons.js';

/** يجهّز صور الغلاف لكل المشاهد دفعة واحدة. */
async function coverMap(allScenes) {
  const map = new Map();
  const direct = allScenes.filter((s) => s.coverMediaId);
  const rest = allScenes.filter((s) => !s.coverMediaId);

  const directMedia = await media.getMany(direct.map((s) => s.coverMediaId));
  direct.forEach((s, i) => {
    if (directMedia[i]) map.set(s.id, directMedia[i]);
  });

  await Promise.all(
    rest.map(async (s) => {
      const links = await sceneMediaLinks.byIndex('sceneId', s.id);
      const first = links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      if (!first) return;
      const m = await media.get(first.mediaId);
      if (m?.kind === 'image') map.set(s.id, m);
    })
  );

  return map;
}

function sceneCard(scene, cover) {
  return html`
    <button class="scene-card" data-action="open-scene" data-id="${scene.id}">
      <div class="thumb">
        ${raw(
          cover
            ? html`<img src="${urlFor(cover)}" alt="" loading="lazy">`
            : raw(icon('image'))
        )}
      </div>
      <div class="body">
        <div class="meta-row">
          <span>${formatDate(scene.date)}</span>
          <span class="chip">${typeLabel(scene.type)}</span>
        </div>
        <h3>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h3>
        ${raw(scene.titleRu ? html`<div class="ru" dir="ltr" lang="ru">${scene.titleRu}</div>` : '')}
      </div>
    </button>`;
}

export async function renderLife(main) {
  releaseUrls();
  const groups = await listScenesByMonth({ limit: 200 });

  if (!groups.length) {
    main.innerHTML = html`
      <div class="view-head">
        <div>
          <h1>حياتي</h1>
          <div class="sub">الخط الزمني لذكرياتك اللغوية</div>
        </div>
      </div>
      <div class="empty-state">
        <div class="glyph">${raw(icon('life'))}</div>
        <h2>الخط الزمني لسه فاضي</h2>
        <p>أول ما تضيف ذكرى هتلاقيها هنا مرتّبة بالشهر والسنة.</p>
        <button class="btn btn-primary" data-action="new-scene">
          ${raw(icon('plus', 18))} أضف ذكرى
        </button>
      </div>`;
    return;
  }

  const all = groups.flatMap((g) => g.scenes);
  const covers = await coverMap(all);
  const total = all.length;

  main.innerHTML = html`
    <div class="view-head">
      <div>
        <h1>حياتي</h1>
        <div class="sub">${total} ذكرى · ${groups.length} شهر</div>
      </div>
      <button class="btn btn-primary btn-sm" data-action="new-scene">
        ${raw(icon('plus', 16))} ذكرى جديدة
      </button>
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
                ${raw(group.scenes.map((s) => sceneCard(s, covers.get(s.id))).join(''))}
              </div>
            </section>`
        )
        .join('')
    )}`;
}

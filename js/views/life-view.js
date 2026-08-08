/**
 * LingoLife — شاشة "حياتي"
 * السيرة البصرية للرحلة — خط زمني مجمّع بالشهر، لا مدير ملفات (بند 7).
 */

import { listScenesByMonth, countScenes } from '../services/scene-service.js';
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

/** كم ذكرى تُجلب في كل دفعة. */
const PAGE = 40;

/** قسم شهرٍ كامل — يُبنى عند أول رسم وعند كل دفعة تالية. */
function monthSection(group, covers) {
  return html`
    <section class="timeline-group" data-month="${group.key}">
      <div class="group-label">
        ${formatMonth(group.date)}
        <span class="count">${group.scenes.length} ذكرى</span>
      </div>
      <div class="scene-list">
        ${raw(group.scenes.map((s) => sceneCard(s, covers.get(s.id))).join(''))}
      </div>
    </section>`;
}

export async function renderLife(main) {
  releaseUrls();
  const [groups, total] = await Promise.all([
    listScenesByMonth({ limit: PAGE }),
    countScenes(),
  ]);

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

  main.innerHTML = html`
    <div class="view-head">
      <div>
        <h1>حياتي</h1>
        <div class="sub">${total} ذكرى في خطّك الزمني</div>
      </div>
      <button class="btn btn-primary btn-sm" data-action="new-scene">
        ${raw(icon('plus', 16))} ذكرى جديدة
      </button>
    </div>

    <div data-timeline>
      ${raw(groups.map((group) => monthSection(group, covers)).join(''))}
    </div>

    ${raw(all.length < total ? html`<div class="load-more" data-load-more></div>` : '')}`;

  if (all.length < total) wireLoadMore(main, all.length, total);
}

/**
 * تحميل تدريجي عند بلوغ آخر الصفحة.
 *
 * كان السقف 200 ذكرى **صامتًا**: تفتح «حياتي» فترى مئتين ولا شيء يقول
 * إن وراءها المزيد. الآن العدّاد يذكر الكلّ، والباقي يأتي وأنت تنزل.
 */
function wireLoadMore(main, loaded, total) {
  const sentinel = main.querySelector('[data-load-more]');
  if (!sentinel) return;

  let offset = loaded;
  let busy = false;

  const observer = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || busy || offset >= total) return;
    busy = true;
    sentinel.textContent = 'بيجيب المزيد…';

    const next = await listScenesByMonth({ limit: PAGE, offset });
    const rows = next.flatMap((g) => g.scenes);
    if (!rows.length) {
      observer.disconnect();
      sentinel.remove();
      return;
    }

    const covers = await coverMap(rows);
    const host = main.querySelector('[data-timeline]');

    for (const group of next) {
      // الشهر الذي بدأ في الدفعة السابقة يكمل فيه بدل أن يتكرّر عنوانه.
      const section = host.querySelector(`[data-month="${group.key}"]`);
      const cards = group.scenes.map((s) => sceneCard(s, covers.get(s.id))).join('');

      if (section) {
        section.querySelector('.scene-list').insertAdjacentHTML('beforeend', cards);
        // وعدّاده يزيد معه، وإلا قال «3 ذكرى» فوق تسعٍ منها.
        const badge = section.querySelector('.count');
        const soFar = section.querySelectorAll('.scene-card').length;
        if (badge) badge.textContent = `${soFar} ذكرى`;
      } else {
        host.insertAdjacentHTML('beforeend', monthSection(group, covers));
      }
    }

    offset += rows.length;
    busy = false;
    sentinel.textContent = '';
    if (offset >= total) {
      observer.disconnect();
      sentinel.remove();
    }
  }, { rootMargin: '300px' });

  observer.observe(sentinel);
}

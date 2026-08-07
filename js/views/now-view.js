/**
 * LingoLife — شاشة "دلوقتي"
 *
 * تجيب سؤالًا واحدًا: "أي جزء من حياتي اللغوية أرجعله دلوقتي؟" (بند 6)
 * ليست لوحة إحصاءات.
 */

import { latestScene, listScenes, countActiveScenes } from '../services/scene-service.js';
import { sceneMediaLinks, media, expressions } from '../db/repositories.js';
import { urlFor } from '../services/media-service.js';
import { html, raw } from '../utils/dom.js';
import { formatDate, relativeDate } from '../utils/dates.js';
import { sceneTypeLabel } from '../config.js';
import { icon } from '../components/icons.js';

/** يجلب صورة غلاف مشهد (المصغّرة) إن وُجدت. */
async function coverOf(scene) {
  if (!scene) return null;
  if (scene.coverMediaId) {
    const m = await media.get(scene.coverMediaId);
    if (m) return m;
  }
  const links = await sceneMediaLinks.byIndex('sceneId', scene.id);
  const first = links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  return first ? media.get(first.mediaId) : null;
}

export async function renderNow(main) {
  const [scene, total, recent, expressionCount] = await Promise.all([
    latestScene(),
    countActiveScenes(),
    listScenes({ limit: 4 }),
    expressions.count(),
  ]);

  if (!scene) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('leaf'))}</div>
        <h2>ابدأ أول ذكرى</h2>
        <p>
          كل لحظة حقيقية عشتها — اجتماع، رحلة، مكالمة، موقف يومي — ممكن تتحوّل
          هنا لذكرى لغوية تقدر ترجعلها وتشوف لغتك اتغيّرت إزاي.
        </p>
        <button class="btn btn-primary" data-action="new-scene">
          ${raw(icon('plus', 18))} أضف ذكرى
        </button>
      </div>`;
    return;
  }

  const cover = await coverOf(scene);
  const others = recent.filter((s) => s.id !== scene.id).slice(0, 3);
  const otherCovers = await Promise.all(others.map(coverOf));

  main.innerHTML = html`
    <div class="hero" data-action="open-scene" data-id="${scene.id}" role="button" tabindex="0">
      ${raw(
        cover
          ? html`<img src="${urlFor(cover, { thumb: false })}" alt="">`
          : '<div class="hero-fallback"></div>'
      )}
      <div class="hero-body">
        <div class="eyebrow">${relativeDate(scene.date)} · ${sceneTypeLabel(scene.type)}</div>
        <h2>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h2>
        ${raw(scene.titleRu && scene.titleAr ? html`<div class="hero-ru ru" dir="ltr" lang="ru">${scene.titleRu}</div>` : '')}
        ${raw(scene.context ? html`<p class="hero-ctx">${scene.context}</p>` : '')}
        <div class="hero-actions">
          <button class="btn btn-primary btn-sm" data-action="open-scene" data-id="${scene.id}">
            ${raw(icon('leaf', 16))} عيش اللحظة تاني
          </button>
          <button class="btn btn-glass btn-sm" data-action="retell" data-id="${scene.id}">
            ${raw(icon('mic', 16))} احكيها بالروسي
          </button>
        </div>
      </div>
    </div>

    <div class="now-grid">
      <section class="sec">
        <div class="sec-head">
          <h2>${raw(icon('review'))} جاهزة للاسترجاع</h2>
        </div>
        ${raw(
          others.length
            ? html`
                <div class="recall-row">
                  ${raw(
                    others
                      .map((s, i) => {
                        const c = otherCovers[i];
                        return html`
                          <button class="recall-card" data-action="open-scene" data-id="${s.id}">
                            <span class="thumb">
                              ${raw(c ? html`<img src="${urlFor(c)}" alt="" loading="lazy">` : raw(icon('image')))}
                            </span>
                            <b>${s.titleAr || s.titleRu || 'ذكرى'}</b>
                            <span class="d">${formatDate(s.date)}</span>
                          </button>`;
                      })
                      .join('')
                  )}
                </div>`
            : html`<p class="text-sm text-faint" style="margin:0">
                أول ما تبقى عندك أكتر من ذكرى، هتلاقي هنا اللي محتاج ترجعله.
              </p>`
        )}
      </section>

      <section class="sec">
        <div class="sec-head">
          <h2>${raw(icon('sparkle'))} عالمك</h2>
        </div>
        <div class="kv-row"><span class="k">ذكريات</span><span class="v num">${total}</span></div>
        <div class="kv-row"><span class="k">تعبيرات</span><span class="v num">${expressionCount}</span></div>
        <div class="kv-row"><span class="k">آخر إضافة</span><span class="v">${relativeDate(scene.date)}</span></div>
      </section>
    </div>`;
}

/**
 * LingoLife — شاشة "الآن"
 *
 * تجيب سؤالًا واحدًا: "أي جزء من حياتي اللغوية أعود إليه الآن؟"
 * ليست لوحة إحصاءات (بند 6).
 */

import { latestScene, countActiveScenes } from '../services/scene-service.js';
import { html, raw } from '../utils/dom.js';
import { formatDate, relativeDate } from '../utils/dates.js';
import { sceneTypeLabel } from '../config.js';
import { icon } from '../components/icons.js';

export async function renderNow(main) {
  const [scene, total] = await Promise.all([latestScene(), countActiveScenes()]);

  if (!scene) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('leaf'))}</div>
        <h2>لسه معندكش ذكريات</h2>
        <p>
          كل لحظة حقيقية عشتها — اجتماع، رحلة، مكالمة، موقف يومي — ممكن تتحوّل
          هنا لذكرى لغوية تقدر ترجعلها.
        </p>
        <button class="btn btn-primary" data-action="new-scene">
          ${raw(icon('plus', 18))} ابدأ أول ذكرى
        </button>
      </div>`;
    return;
  }

  main.innerHTML = html`
    <button class="hero-card" data-action="open-scene" data-id="${scene.id}">
      <div class="no-img"></div>
      <div class="hero-body">
        <div class="eyebrow">استكمل من هنا</div>
        <h2>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h2>
        ${raw(scene.titleRu && scene.titleAr ? html`<div class="hero-ru ru">${scene.titleRu}</div>` : '')}
        <div class="hero-meta">
          ${formatDate(scene.date)} · ${sceneTypeLabel(scene.type)}${raw(
            scene.placeName ? ` · ${scene.placeName}` : ''
          )}
        </div>
      </div>
    </button>

    ${raw(
      scene.context
        ? html`<div class="panel"><p class="text-soft" style="margin:0">${scene.context}</p></div>`
        : ''
    )}

    <div class="section-label">${raw(icon('db', 16))} عالمك دلوقتي</div>
    <div class="panel">
      <div class="kv-row">
        <span class="k">ذكريات نشطة</span>
        <span class="v num">${total}</span>
      </div>
      <div class="kv-row">
        <span class="k">آخر إضافة</span>
        <span class="v">${relativeDate(scene.date)}</span>
      </div>
    </div>

    <div class="not-yet">
      ${raw(icon('info', 18))}
      <div>
        <strong>لسه في الطريق:</strong> "ذكرى جاهزة للرجوع"، "تعبير ظهر تاني"،
        و"في مثل هذا اليوم" — دي أقسام المرحلة 4 (المراجعة الحيّة).
      </div>
    </div>`;
}

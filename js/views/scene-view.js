/**
 * LingoLife — شاشة المشهد
 *
 * المشهد صفحة journal واحدة طويلة (بند 10)، لا تبويبات مجزّأة.
 * في المرحلة 0: اللحظة والبيانات الوصفية تعمل فعلًا.
 * أقسام الوسائط والنصوص واللغة تُبنى في المرحلة 1 — ومعلَّمة بوضوح.
 */

import { getSceneFull } from '../services/scene-service.js';
import { html, raw } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';
import { sceneTypeLabel } from '../config.js';
import { icon } from '../components/icons.js';

/** أقسام المشهد — نفس ترتيب المواصفة (بند 10). */
const SECTIONS = [
  { id: 'moment', label: 'اللحظة', phase: 0 },
  { id: 'images', label: 'الصور', phase: 1 },
  { id: 'voices', label: 'الأصوات', phase: 1 },
  { id: 'scripts', label: 'السكريبتات', phase: 1 },
  { id: 'conversation', label: 'المحادثة', phase: 1 },
  { id: 'mistakes', label: 'خطأ / طبيعي', phase: 1 },
  { id: 'language', label: 'اللغة', phase: 2 },
  { id: 'recall', label: 'الاسترجاع', phase: 4 },
];

function comingSection(section) {
  return html`
    <section id="sec-${section.id}" class="not-yet" style="margin-bottom:var(--sp-3)">
      ${raw(icon('info', 18))}
      <div>
        <strong>${section.label}</strong> — يُبنى في المرحلة ${section.phase}.
      </div>
    </section>`;
}

export async function renderScene(main, sceneId) {
  const full = await getSceneFull(sceneId);

  if (!full) {
    main.innerHTML = html`
      <button class="back-row" data-action="back">${raw(icon('back'))} رجوع</button>
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الذكرى دي مش موجودة</h2>
        <p>يمكن تكون اتنقلت لسلة المهملات أو اتمسحت.</p>
        <button class="btn btn-ghost" data-action="go-life">افتح حياتي</button>
      </div>`;
    return;
  }

  const { scene, counts } = full;

  main.innerHTML = html`
    <button class="back-row" data-action="back">${raw(icon('back'))} رجوع</button>

    <div class="view-head">
      <h1>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h1>
      ${raw(scene.titleRu && scene.titleAr ? html`<div class="ru text-soft">${scene.titleRu}</div>` : '')}
      <div class="sub" style="margin-top:var(--sp-2)">
        ${formatDate(scene.date)} · ${sceneTypeLabel(scene.type)}${raw(
          scene.placeName ? ` · ${scene.placeName}` : ''
        )}
      </div>
    </div>

    <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-5)">
      <button class="mini-btn" data-action="edit-scene" data-id="${scene.id}">تعديل البيانات</button>
      <button class="mini-btn" data-action="trash-scene" data-id="${scene.id}">نقل للسلة</button>
    </div>

    <nav class="section-label" aria-label="أقسام الذكرى">
      ${raw(
        SECTIONS.map(
          (s) =>
            html`<button class="mini-btn" data-action="scroll-to" data-target="sec-${s.id}">${s.label}</button>`
        ).join('')
      )}
    </nav>

    <section id="sec-moment" class="panel">
      <h3>اللحظة</h3>
      <div class="kv-row"><span class="k">التاريخ</span><span class="v">${formatDate(scene.date)}</span></div>
      <div class="kv-row"><span class="k">النوع</span><span class="v">${sceneTypeLabel(scene.type)}</span></div>
      <div class="kv-row"><span class="k">المكان</span><span class="v">${scene.placeName || '—'}</span></div>
      <div class="kv-row"><span class="k">الصور</span><span class="v num">${counts.images}</span></div>
      <div class="kv-row"><span class="k">الأصوات</span><span class="v num">${counts.audio}</span></div>
      <div class="kv-row"><span class="k">السكريبتات</span><span class="v num">${counts.scripts}</span></div>
      ${raw(
        scene.context
          ? html`<p class="text-soft" style="margin:var(--sp-3) 0 0">${scene.context}</p>`
          : ''
      )}
    </section>

    ${raw(SECTIONS.filter((s) => s.phase > 0).map(comingSection).join(''))}`;
}

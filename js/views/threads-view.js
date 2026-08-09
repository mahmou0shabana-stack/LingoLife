/**
 * LingoLife — الخيوط: القائمة والصفحة
 *
 * القائمة تُفتَح على سؤالٍ واحد: **«إيه اللي لسه مفتوح؟»** فالمفتوح
 * أوّلًا، والمنتهي مطويٌّ تحته. خيطٌ خلص لا يستحقّ أن يزاحم قضيّةً
 * تنتظرك.
 *
 * والصفحة تعرض القصّة **كما جرت** — بترتيبها الزمني وبالفجوات بين
 * أحداثها. «بعد ١٢ يوم» جزءٌ من القصّة لا حشو: هي المدّة التي انتظرتَ
 * فيها ردًّا.
 */

import { html, raw, esc } from '../utils/dom.js';
import { formatDate, relativeDate } from '../utils/dates.js';
import { icon } from '../components/icons.js';
import { typeLabel } from '../services/type-service.js';
import { getPerson } from '../services/person-service.js';
import {
  THREAD_STATUS,
  THREAD_STATUS_LABEL,
  listThreads,
  threadSummary,
  threadSceneCounts,
} from '../services/thread-service.js';

/** رقاقة الحالة بلونها — تُقرأ قبل أن تُقرأ. */
function statusChip(status) {
  return html`<span class="thread-status is-${status}">${THREAD_STATUS_LABEL[status] || status}</span>`;
}

function threadCard(thread, count) {
  return html`
    <a class="thread-card${thread.isOpen ? '' : ' is-done'}" href="#/thread/${thread.id}">
      <div class="thread-card-head">
        <b>${thread.title}</b>
        ${raw(statusChip(thread.status))}
      </div>
      ${raw(thread.description ? html`<p class="thread-card-desc">${thread.description}</p>` : '')}
      <div class="thread-card-meta">
        <span>${count} حدث</span>
        ${raw(thread.startDate ? html`<span>من ${formatDate(thread.startDate)}</span>` : '')}
        ${raw(thread.endDate ? html`<span>لـ ${formatDate(thread.endDate)}</span>` : '')}
      </div>
    </a>`;
}

export async function renderThreads(main) {
  const [threads, counts] = await Promise.all([listThreads(), threadSceneCounts()]);
  const open = threads.filter((t) => t.isOpen);
  const done = threads.filter((t) => !t.isOpen);

  if (!threads.length) {
    main.innerHTML = html`
      <div class="view-head">
        <h1>الخيوط</h1>
        <div class="sub">القصص اللي بتمتدّ على أكتر من موقف</div>
      </div>
      <div class="empty-state">
        <div class="glyph">${raw(icon('link'))}</div>
        <h2>لسه مفيش خيوط</h2>
        <p>
          الخيط بيجمع مواقف بتخصّ قضيّة واحدة — اجتماع ومكالمة وفحص
          كلهم عن نفس الشحنة. تعمله من أي ذكرى بزرّ «اربطها بقصّة».
        </p>
      </div>`;
    return;
  }

  main.innerHTML = html`
    <div class="view-head">
      <h1>الخيوط</h1>
      <div class="sub">${open.length} لسه مفتوح · ${done.length} خلص</div>
    </div>

    ${raw(
      open.length
        ? html`<div class="thread-list">
            ${raw(open.map((t) => threadCard(t, counts.get(t.id) || 0)).join(''))}
          </div>`
        : html`<p class="field-hint">مفيش حاجة مفتوحة دلوقتي.</p>`
    )}

    ${raw(
      done.length
        ? html`<details class="thread-done">
            <summary>${done.length} خيط خلص</summary>
            <div class="thread-list">
              ${raw(done.map((t) => threadCard(t, counts.get(t.id) || 0)).join(''))}
            </div>
          </details>`
        : ''
    )}`;
}

/* ------------------------------------------------------------------ *
 * صفحة الخيط
 * ------------------------------------------------------------------ */

/** الفجوة بين حدثين — جزءٌ من القصّة لا حشو. */
function gap(days) {
  if (!days) return '';
  // جمع «يوم» في العربية: مثنًّى، ثم جمع قلّة (٣–١٠)، ثم تمييز مفرد.
  const text =
    days === 1 ? 'بعد يوم'
    : days === 2 ? 'بعد يومين'
    : days <= 10 ? `بعد ${days} أيام`
    : `بعد ${days} يومًا`;
  return html`<div class="thread-gap"><span>${text}</span></div>`;
}

function daysBetween(a, b) {
  return Math.round(Math.abs(new Date(a) - new Date(b)) / 86_400_000);
}

export async function renderThread(main, id) {
  const summary = await threadSummary(id);

  if (!summary) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الخيط ده مش موجود</h2>
        <button class="btn btn-ghost" data-action="go-threads">ارجع للخيوط</button>
      </div>`;
    return;
  }

  const { thread, scenes: list, personIds, places, from, to, spanDays } = summary;

  // أسماء الأشخاص لا معرّفاتهم — والرقم قابل للنقر (بند 66).
  const persons = (await Promise.all(personIds.map(getPerson))).filter(Boolean);

  const timeline = list
    .map((scene, index) => {
      const before = index > 0 ? gap(daysBetween(list[index - 1].date, scene.date)) : '';
      return html`${raw(before)}
        <a class="thread-event" href="#/scene/${scene.id}">
          <span class="thread-event-date">${formatDate(scene.date)}</span>
          <span class="thread-event-main">
            <b>${scene.titleAr || scene.titleRu || 'ذكرى'}</b>
            <small>${typeLabel(scene.type)}${scene.placeName ? ` · ${scene.placeName}` : ''}</small>
          </span>
          <button class="mini-btn" data-action="thread-remove-scene"
            data-thread="${thread.id}" data-id="${scene.id}"
            title="شيله من الخيط">${raw(icon('close', 14))}</button>
        </a>`;
    })
    .join('');

  main.innerHTML = html`
    <div class="view-head">
      <h1>${thread.title}</h1>
      <div class="sub">
        ${raw(statusChip(thread.status))}
        ${raw(from ? html`<span> · من ${formatDate(from)}</span>` : '')}
        ${raw(
          to && to !== from
            ? html`<span> لـ ${formatDate(to)} · ${spanDays} يوم</span>`
            : ''
        )}
      </div>
    </div>

    ${raw(thread.description ? html`<p class="thread-desc">${thread.description}</p>` : '')}

    <div class="panel thread-actions">
      <label for="th-status">الحالة</label>
      <select id="th-status" data-thread-status data-id="${thread.id}">
        ${raw(
          Object.values(THREAD_STATUS)
            .map(
              (s) =>
                `<option value="${s}"${s === thread.status ? ' selected' : ''}>${THREAD_STATUS_LABEL[s]}</option>`
            )
            .join('')
        )}
      </select>
      <button class="btn btn-ghost btn-sm" data-action="thread-edit" data-id="${thread.id}">
        ${raw(icon('edit', 15))} عدّل
      </button>
    </div>

    <!--
      ⚠️ الملخّص أرقامٌ قابلة للنقر لا للعرض (بند 66): كل رقمٍ هنا
         مقروءٌ من القاعدة، ومَن يظهر اسمه له صفحة.
    -->
    <div class="panel thread-summary">
      <h3>${raw(icon('info', 17))} الملخّص</h3>
      <div class="kv-row"><span class="k">أحداث</span><span class="v num">${list.length}</span></div>
      ${raw(
        persons.length
          ? html`<div class="kv-row">
              <span class="k">مين فيها</span>
              <span class="v">${raw(persons.map((p) => esc(p.name)).join(' · '))}</span>
            </div>`
          : ''
      )}
      ${raw(
        places.length
          ? html`<div class="kv-row">
              <span class="k">أماكن</span><span class="v">${raw(places.map(esc).join(' · '))}</span>
            </div>`
          : ''
      )}
      ${raw(
        // ⚠️ «المدّة» هنا بين أوّل حدثٍ وآخره — لا مدّة القضيّة. قضيّةٌ
        //    مفتوحة لم يقع فيها شيءٌ منذ شهر أطول مما نعرف، ولا ندّعي.
        list.length > 1
          ? html`<p class="field-hint">
              ${spanDays} يوم بين أوّل حدث وآخره${thread.isOpen ? ' — والقصّة لسه مكمّلة' : ''}.
            </p>`
          : ''
      )}
    </div>

    ${raw(
      list.length
        ? html`<div class="thread-timeline">${raw(timeline)}</div>`
        : html`<div class="empty-state">
            <h2>الخيط لسه فاضي</h2>
            <p>افتح أي ذكرى واربطها بالخيط ده.</p>
          </div>`
    )}`;
}

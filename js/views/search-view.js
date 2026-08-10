/**
 * LingoLife — شاشة البحث
 *
 * كان المسار موثّقًا في `router.js` وغير مسجَّل، والدالّة مكتوبة ولا
 * تُنادى. هذه هي الشاشة التي كانت ناقصة.
 *
 * البحث هنا **عبر المجالات** لا في الذكريات وحدها: تكتب كلمةً روسية
 * فتجدها في سكريبت، وفي جزء محادثة قالها أحدهم، وفي تعبير تعلّمته،
 * وفي جملةٍ حفظتها — لأنها كلها مكان واحد في حياتك لا خمسة أماكن.
 */

import { html, raw, $ } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { navigate } from '../router.js';
import { searchAll, SEARCH_GROUPS } from '../services/search-service.js';

/** آخر ما بُحث عنه — يبقى في الحقل عند العودة للشاشة. */
let lastQuery = '';
let activeGroup = null;

function resultRow(item) {
  return html`
    <button class="search-row" data-search-go data-href="${item.href}">
      <div class="search-row-main">
        <div class="search-row-title${item.ru ? ' ru' : ''}"
          ${raw(item.ru ? 'dir="ltr" lang="ru"' : '')}>${item.title}</div>
        ${raw(item.subtitle ? html`<div class="search-row-sub">${item.subtitle}</div>` : '')}
        ${raw(
          item.excerpt
            ? html`<div class="search-row-excerpt"${raw(item.ru ? ' dir="ltr" lang="ru"' : '')}>${item.excerpt}</div>`
            : ''
        )}
      </div>
      ${raw(icon('back', 15))}
    </button>`;
}

function resultsHtml(result, query) {
  if (!query.trim()) {
    return html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('search'))}</div>
        <h2>دوّر في حياتك كلها</h2>
        <p>اكتب كلمة بالعربي أو بالروسي — هتلاقيها في الذكريات
          والسكريبتات والمحادثات والتعبيرات والمحفوظات مرّة واحدة.</p>
      </div>`;
  }

  if (!result.total) {
    return html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('search'))}</div>
        <h2>مفيش نتايج لـ«${query}»</h2>
        <p>جرّب كلمة أقصر، أو شيل التصفية لو مفعّلة.</p>
      </div>`;
  }

  return result.groups
    .map(
      (group) => html`
        <section class="search-group">
          <div class="group-label">
            ${group.label}
            <span class="count">${group.items.length}${group.more ? '+' : ''}</span>
          </div>
          <div class="panel search-list">
            ${raw(group.items.map(resultRow).join(''))}
          </div>
        </section>`
    )
    .join('');
}

export async function renderSearch(main) {
  const result = lastQuery.trim()
    ? await searchAll(lastQuery, { only: activeGroup })
    : { groups: [], total: 0 };

  main.innerHTML = html`
    <div class="view-head">
      <h1>بحث</h1>
      <div class="sub">في الذكريات والسكريبتات والمحادثات واللغة</div>
    </div>

    <div class="search-box">
      ${raw(icon('search', 18))}
      <input type="search" data-search-input value="${lastQuery}"
        placeholder="اكتب كلمة بالعربي أو بالروسي…" autocomplete="off" />
      <button type="button" data-search-clear aria-label="امسح" ${raw(lastQuery ? '' : 'hidden')}>✕</button>
    </div>

    <div class="search-filters" data-search-filters>
      <button class="chip-btn ${activeGroup ? '' : 'on'}" data-search-filter="">الكل</button>
      ${raw(
        SEARCH_GROUPS.map(
          (g) => html`<button class="chip-btn ${activeGroup === g.key ? 'on' : ''}"
            data-search-filter="${g.key}">${g.label}</button>`
        ).join('')
      )}
    </div>

    <div data-search-results>${raw(resultsHtml(result, lastQuery))}</div>`;

  wire(main);
  $('[data-search-input]')?.focus();
}

/** يعيد رسم النتائج وحدها — الحقل لا يُلمس فلا يفقد التركيز. */
async function rerender() {
  const host = $('[data-search-results]');
  if (!host) return;

  const result = lastQuery.trim()
    ? await searchAll(lastQuery, { only: activeGroup })
    : { groups: [], total: 0 };

  host.innerHTML = resultsHtml(result, lastQuery);

  const clear = $('[data-search-clear]');
  if (clear) clear.hidden = !lastQuery;

  document.querySelectorAll('[data-search-filter]').forEach((btn) => {
    btn.classList.toggle('on', (btn.dataset.searchFilter || null) === activeGroup);
  });
}

function wire(main) {
  // مهلة قصيرة: البحث عند كل حرف يُشغّل مؤشّرات لا لزوم لها، وانتظارٌ
  // أطول يجعل الكتابة تبدو ثقيلة. 180ms وسطٌ محسوس.
  let timer = null;
  main.addEventListener('input', (event) => {
    if (!event.target.hasAttribute('data-search-input')) return;
    lastQuery = event.target.value;
    clearTimeout(timer);
    timer = setTimeout(rerender, 180);
  });

  main.addEventListener('click', (event) => {
    const clear = event.target.closest('[data-search-clear]');
    if (clear) {
      lastQuery = '';
      const input = $('[data-search-input]');
      if (input) { input.value = ''; input.focus(); }
      return void rerender();
    }

    const filter = event.target.closest('[data-search-filter]');
    if (filter) {
      activeGroup = filter.dataset.searchFilter || null;
      return void rerender();
    }

    const go = event.target.closest('[data-search-go]');
    if (go) navigate(go.dataset.href);
  });
}

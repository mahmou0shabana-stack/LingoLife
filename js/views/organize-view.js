/**
 * LingoLife — وضعُ التنظيم والربط (WS56 · **تجريبيّ**)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **وضعٌ ثانٍ على نفس البيانات — لا صفحةٌ بديلة.**
 * ═══════════════════════════════════════════════════════════════
 *
 * `scene-view.js` باقيةٌ كما هي حرفًا بحرف. هذه شاشةٌ أخرى تقرأ نفسَ
 * الذكرى وتكتب نفسَ الروابط، وتُفتَح باختيارك وتُغلَق باختيارك.
 *
 * والسؤالُ الذي تجيب عنه ليس «ما في هذه الذكرى؟» — الصفحةُ القديمة
 * تجيبه جيّدًا. سؤالُها: **«ما الذي لم أنظّمه بعد؟»**
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ثلاثةُ قراراتٍ في التصميم تستحقّ التسجيل
 * ═══════════════════════════════════════════════════════════════
 *
 * ١ · **الملخّصُ أوّلًا والتفصيلُ عند الطلب.** الصفحةُ القديمة تفتح
 *     كلَّ سكريبتٍ بنصّه الكامل، فذكرى بأربعة سكريبتاتٍ تصير مترين
 *     من التمرير. هنا: سطرٌ لكلّ سكريبت بعدّاداته، والنصُّ خلف لمسة.
 *
 * ٢ · **«غير مربوط» حالةٌ لا خطأ.** لا لونَ تحذيرٍ ولا علامةَ تعجّب:
 *     صندوقٌ محايدٌ يقول «دول لسه ما نظّمتهمش». التنظيمُ اختيارٌ، ومَن
 *     يوبّخك على تركه يجعلك تتجنّب الشاشة كلَّها.
 *
 * ٣ · **الاختيارُ لا يُعيد الرسم.** لمسةٌ على صورةٍ في ورشة الربط
 *     تبدّل صنفَ عنصرٍ واحدٍ وعدّادَ الشريط — لا `innerHTML` كامل.
 *     إعادةُ الرسم على كلّ لمسةٍ تُفقِد موضعَ التمرير، وعلى لوحٍ فيه
 *     اثنتا عشرة صورةً يعني ذلك أنك تفقد مكانك اثنتَي عشرة مرّة.
 */

import { html, raw, formatDuration } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';
import { icon } from '../components/icons.js';
import { showModal } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { typeLabel } from '../services/type-service.js';
import { urlFor, releaseUrls, AUDIO_ROLE_LABEL } from '../services/media-service.js';
import { threadsOfScene } from '../services/thread-service.js';
import { scenePeople as scenePeopleWithEvidence } from '../services/participant-service.js';
import { listConversationParts, getBlock } from '../services/content-service.js';
import {
  organizeBoard, linkItemsTo, addPart, removePart,
  addNode, renameNode, setNodeHidden, moveNode, duplicateNode, removeNode,
  createJourney, setJourneyEnabled, NODE_KIND, NODE_KIND_LABEL, DELETE_POLICY,
} from '../services/organize-service.js';
import { JOURNEY_TEMPLATES } from '../services/hyperlingual.js';

/* ================================================================== *
 * الحالة — عابرةٌ عمدًا
 * ================================================================== */

/**
 * ⚠️ **ولا شيءَ منها يُحفَظ في القاعدة.** ما تختاره الآن ليس بيانًا
 *    عن ذكرياتك، بل عن الدقيقة التي أنت فيها. حفظُه يعني أن تفتح
 *    الشاشةَ غدًا فتجد سبعةَ عناصرَ مختارةً لا تذكر لماذا.
 */
const state = {
  sceneId: null,
  screen: 'board',      /* board | bulk | script */
  scriptId: null,
  selection: new Set(),
  targetId: null,
  filter: 'all',        /* all | unlinked | linked | images | audio */
  query: '',
  /** العُقَدُ المفرودة — مفتوحةٌ بلمسةٍ لا بسهمٍ صغير (بند ٣٦). */
  expanded: new Set(),
};

let board = null;
let wires = null;

const reset = (sceneId) => {
  state.sceneId = sceneId;
  state.screen = 'board';
  state.scriptId = null;
  state.selection = new Set();
  state.targetId = null;
  state.filter = 'all';
  state.query = '';
  state.expanded = new Set();
};

/* ================================================================== *
 * قطعٌ صغيرة
 * ================================================================== */

const countChip = (audio, images) => html`
  <span class="org-counts">
    ${raw(audio ? html`<b>${raw(icon('mic'))} ${audio}</b>` : '')}
    ${raw(images ? html`<b>${raw(icon('image'))} ${images}</b>` : '')}
    ${raw(!audio && !images ? '<i>فاضي</i>' : '')}
  </span>`;

/** وجهُ العنصر: الصورةُ صورةٌ، والصوتُ دَورُه ومدّته (نفس مبدأ WS34). */
function itemFace(item) {
  if (item.kind === 'image') {
    return html`<img src="${urlFor(item, { thumb: true })}" alt="" loading="lazy">`;
  }
  return html`<span class="org-audioface">${raw(icon('mic'))}</span>`;
}

function itemName(item) {
  if (item.caption) return item.caption;
  if (item.kind === 'audio') {
    const role = AUDIO_ROLE_LABEL[item.role] || 'تسجيل';
    return item.durationMs ? `${role} · ${formatDuration(item.durationMs)}` : role;
  }
  return 'صورة';
}

/**
 * اسمُ ما ارتبط به عنصرٌ — «الفحص البصري · القياسات» بلا معرّفات.
 *
 * ⚠️ **والفاصلُ نقطةٌ وسطى لا `›`.** جرّبتُ السهمَ فرأيتُه في اللقطة
 *    ينقلب في السياق العربيّ ويُقرأ فاصلةً: «الفحص البصري ، القياسات».
 *    و`›` محرفٌ **ذو اتجاه** ينعكس في RTL؛ أمّا `·` فمحايدةٌ ثنائيّة
 *    الاتجاه، تُقرأ كما هي في الاتّجاهين.
 */
const PATH_SEP = ' · ';
function targetLabel(targetId) {
  const target = board?.targets.find((t) => t.id === targetId);
  if (!target) return null;
  /*
   * ⚠️ **المسارُ كاملًا هنا وحدَه** (بند ٢٤): «مرتبط بـ» يجب أن تكفي
   *    لتعرف أين العنصر بلا فتحِ شيء. أمّا في القوائم فالإزاحةُ تكفي
   *    والمسارُ الكاملُ يطيلها بلا فائدة.
   */
  return target.path?.length ? target.path.join(PATH_SEP) : target.title;
}

/* ================================================================== *
 * ١ · اللوحة
 * ================================================================== */

function passport(scene, people, threads) {
  return html`
    <header class="org-passport">
      <div class="org-pass-main">
        <h1>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h1>
        <div class="org-pass-meta">
          <span>${raw(icon('calendar'))} ${formatDate(scene.date)}</span>
          <span>${raw(icon('tag'))} ${typeLabel(scene.type)}</span>
          ${raw(scene.placeName ? html`<span>${raw(icon('place'))} ${scene.placeName}</span>` : '')}
          ${raw(people.length
    ? html`<span>${raw(icon('person'))} ${people.map((p) => p.name).join('، ')}</span>` : '')}
          ${raw(threads.map((t) => html`<span>${raw(icon('link'))} ${t.title}</span>`).join(''))}
        </div>
      </div>
      <div class="org-pass-side">
        <span class="org-flag">تجريبي</span>
        <button class="org-exit" data-org="exit">
          ${raw(icon('back'))} ارجع للعرض الحالي
        </button>
      </div>
    </header>`;
}

function summaryRow(data, conversationCount, hasTranscript) {
  const cells = [
    { key: 'images', label: 'الصور', n: data.counts.images, ic: 'image', to: 'images' },
    { key: 'audio', label: 'الأصوات', n: data.counts.audio, ic: 'mic', to: 'audio' },
    { key: 'scripts', label: 'السكريبتات', n: data.counts.scripts, ic: 'script', to: null },
    { key: 'conv', label: 'المحادثة', n: conversationCount, ic: 'chat', to: null },
    { key: 'raw', label: 'النصّ الأصلي', n: hasTranscript ? 1 : 0, ic: 'note', to: null },
  ];

  return html`
    <div class="org-summary">
      ${raw(cells.map((c) => html`
        <button class="org-sum${c.n ? '' : ' is-zero'}"
                data-org="${c.to ? 'bulk-filter' : 'noop'}" data-v="${c.to || ''}">
          <span class="ic">${raw(icon(c.ic))}</span>
          <b>${c.n}</b>
          <span class="t">${c.label}</span>
          ${raw(c.to && c.n ? '<span class="all">عرض الكل</span>' : '')}
        </button>`).join(''))}
    </div>`;
}

/** سطرُ سكريبتٍ مضغوط — لا نصَّ كاملًا (بند ٨). */
function scriptRow(row) {
  const { script, parts, totals, journey, tree, journeyDisabled } = row;
  return html`
    <li class="org-script">
      <button class="org-script-main" data-org="open-script" data-id="${script.id}">
        <span class="org-script-t">${script.title}</span>
        ${raw(journey ? html`<span class="org-tag${journeyDisabled ? ' is-off' : ''}"
          >رحلة تدريب · ${tree.length}${raw(journeyDisabled ? ' · مُعطَّلة' : '')}</span>` : '')}
        ${raw(countChip(totals.audio, totals.images))}
      </button>
      ${raw(parts.length ? html`
        <ul class="org-parts">
          ${raw(parts.map((p) => html`
            <li>
              <button class="org-part" data-org="open-script" data-id="${p.part.id}">
                <span>${p.part.title}</span>
                ${raw(countChip(p.audio.length, p.images.length))}
              </button>
            </li>`).join(''))}
        </ul>` : '')}
    </li>`;
}

/** صندوقُ «غير مربوط» — محايدُ اللون عن قصد. */
function unlinkedBox(unlinked) {
  const total = unlinked.audio.length + unlinked.images.length;
  if (!total) {
    return html`<div class="org-unlinked is-clear">
      ${raw(icon('check'))} كل حاجة اتنظّمت
    </div>`;
  }
  return html`
    <div class="org-unlinked">
      <div class="org-unlinked-head">
        <h3>غير مربوط</h3>
        ${raw(countChip(unlinked.audio.length, unlinked.images.length))}
      </div>
      <p>دول في الذكرى فعلًا — بس لسه ما نظّمتهمش. تقدر تسيبهم كده.</p>
      <div class="org-strip">
        ${raw([...unlinked.images, ...unlinked.audio].slice(0, 10).map((m) => html`
          <span class="org-strip-cell">${raw(itemFace(m))}</span>`).join(''))}
        ${raw(total > 10 ? html`<span class="org-strip-more">+${total - 10}</span>` : '')}
      </div>
      <button class="org-btn org-btn-go" data-org="bulk">
        ${raw(icon('link'))} رتّب واربط
      </button>
    </div>`;
}

/** النظرةُ الشاملة (بند ٢٨) — التنظيمُ كلُّه في ثوانٍ. */
function overview(data) {
  const rows = data.scripts.map((row) => html`
    <li><span>${row.script.title}</span>${raw(countChip(row.totals.audio, row.totals.images))}</li>`);
  rows.push(html`
    <li class="is-loose"><span>غير مربوط</span>${raw(
    countChip(data.unlinked.audio.length, data.unlinked.images.length))}</li>`);

  return html`
    <section class="org-overview">
      <h3>نظرة سريعة</h3>
      <ul>${raw(rows.join(''))}</ul>
    </section>`;
}

function renderBoard(data, extras) {
  return html`
    ${raw(passport(data.scene, extras.people, extras.threads))}

    <div class="org-actions">
      <button class="org-add" data-org="add">${raw(icon('plus'))} إضافة</button>
      <button class="org-btn" data-org="bulk">${raw(icon('link'))} ترتيب وربط</button>
    </div>

    ${raw(summaryRow(data, extras.conversationCount, extras.hasTranscript))}

    <section class="org-block">
      <div class="org-block-head">
        <h2>السكريبتات</h2>
        <button class="org-btn org-btn-sm" data-org="add-script">${raw(icon('plus'))} سكريبت</button>
      </div>
      ${raw(data.scripts.length
    ? html`<ul class="org-scripts">${raw(data.scripts.map(scriptRow).join(''))}</ul>`
    : html`<p class="org-empty">مفيش سكريبتات لسه.</p>`)}
    </section>

    ${raw(unlinkedBox(data.unlinked))}
    ${raw(data.scripts.length ? overview(data) : '')}`;
}

/* ================================================================== *
 * ٢ · ورشةُ الربط الجماعيّ
 * ================================================================== */

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'unlinked', label: 'غير مربوط' },
  { id: 'linked', label: 'مربوط' },
  { id: 'images', label: 'صور' },
  { id: 'audio', label: 'أصوات' },
];

function visibleItems(data) {
  const query = state.query.trim().toLowerCase();
  return [...data.images, ...data.audio].filter((item) => {
    const isLinked = data.linkedTo.has(item.id);
    if (state.filter === 'unlinked' && isLinked) return false;
    if (state.filter === 'linked' && !isLinked) return false;
    if (state.filter === 'images' && item.kind !== 'image') return false;
    if (state.filter === 'audio' && item.kind !== 'audio') return false;
    if (query && !itemName(item).toLowerCase().includes(query)) return false;
    return true;
  });
}

function itemCell(item, data) {
  const on = state.selection.has(item.id);
  const linkedName = targetLabel(data.linkedTo.get(item.id));
  return html`
    <button class="org-cell${on ? ' on' : ''}" data-org="pick" data-id="${item.id}"
            aria-pressed="${on ? 'true' : 'false'}">
      <span class="org-cell-face">
        ${raw(itemFace(item))}
        <b class="org-tick">✓</b>
      </span>
      <span class="org-cell-name">${itemName(item)}</span>
      ${raw(linkedName
    ? html`<span class="org-cell-link">${raw(icon('link'))} ${linkedName}</span>`
    : '<span class="org-cell-link is-loose">غير مربوط</span>')}
    </button>`;
}

function renderBulk(data) {
  const items = visibleItems(data);
  /*
   * ⚠️ **الأهدافُ شجرةٌ بالإزاحة لا مساراتٌ كاملة** (بند ٢٣).
   *    «التغليف والحماية · رحلة التدريب · المرحلة ٢ · الروسية فقط»
   *    في زرٍّ واحدٍ عرضُه ٢٦٠px يلتفّ على أربعة أسطرٍ ولا يُقرأ.
   *    فالعنوانُ وحدَه، والانتماءُ تقوله الإزاحة — والمسارُ الكاملُ
   *    يبقى في `title` لمن يطيل الضغط.
   */
  const targets = [
    ...data.targets.map((t) => ({
      id: t.id,
      label: t.title,
      full: t.path.join(PATH_SEP),
      depth: Math.min(t.depth, 4),
      hidden: t.hidden,
    })),
    { id: '__none__', label: 'بدون ربط', full: 'بدون ربط', depth: 0, hidden: false },
  ];

  return html`
    <header class="org-bulkhead">
      <button class="org-back" data-org="board">${raw(icon('back'))} رجوع</button>
      <h2>ترتيب وربط</h2>
      <span class="org-flag">تجريبي</span>
    </header>

    <div class="org-bulk">
      <aside class="org-targets">
        <h3>اربط بـ</h3>
        ${raw(targets.length === 1
    ? html`<p class="org-empty">أضف سكريبت الأوّل عشان تربط بيه.</p>`
    : html`<ul>${raw(targets.map((t) => html`
            <li>
              <button class="org-target${state.targetId === t.id ? ' on' : ''}${t.depth ? ' is-part' : ''}${t.hidden ? ' is-off' : ''}"
                      data-org="target" data-id="${t.id}" title="${t.full}"
                      style="--d:${t.depth}">
                ${t.label}
              </button>
            </li>`).join(''))}</ul>`)}
      </aside>

      <div class="org-pool">
        <div class="org-toolbar">
          <div class="org-filters">
            ${raw(FILTERS.map((f) => html`
              <button class="org-chip${state.filter === f.id ? ' on' : ''}"
                      data-org="filter" data-v="${f.id}">${f.label}</button>`).join(''))}
          </div>
          <input class="org-search" type="search" data-org-search placeholder="دوّر باسم العنصر…"
                 value="${state.query}">
        </div>

        ${raw(items.length
    ? html`<div class="org-grid">${raw(items.map((i) => itemCell(i, data)).join(''))}</div>`
    : html`<p class="org-empty">مفيش عناصر بالفلتر ده.</p>`)}
      </div>
    </div>

    <div class="org-bar" data-org-bar>
      <span class="org-bar-count" data-org-count>${state.selection.size} مختار</span>
      <button class="org-btn org-btn-sm" data-org="pick-all">اختار الظاهر</button>
      <button class="org-btn org-btn-sm" data-org="pick-none">إلغاء الاختيار</button>
      <button class="org-btn org-btn-go" data-org="apply">${raw(icon('link'))} ربط المحدد</button>
    </div>`;
}

/* ================================================================== *
 * ٣ · تفصيلُ السكريبت
 * ================================================================== */

function linkedList(items, data) {
  if (!items.length) return html`<p class="org-empty">مفيش.</p>`;
  return html`<ul class="org-linked">
    ${raw(items.map((m) => html`
      <li>
        <span class="org-linked-face">${raw(itemFace(m))}</span>
        <span class="org-linked-name">${itemName(m)}</span>
        <button class="org-btn org-btn-sm" data-org="relink" data-id="${m.id}">
          ${raw(icon('link'))} تغيير الربط
        </button>
      </li>`).join(''))}
  </ul>`;
}

/**
 * فهرسُ كلّ عقدةٍ في اللوحة — **بناءٌ واحدٌ بدل بحثٍ في كلّ نداء**.
 *
 * ⚠️ وكانت الصياغةُ الأولى تبحث في `data.scripts` ثم في `parts` بيدها،
 *    فلم تكن ترى ما هو أعمق من جزء. والشجرةُ الآن بلا سقفِ عمق،
 *    فالبحثُ اليدويُّ لكلّ مستوًى ليس حلًّا — الفهرسُ هو الحلّ.
 */
function indexBoard(data) {
  const index = new Map();
  const walk = (rows, parentId, parentTitle, rootId) => {
    for (const row of rows) {
      index.set(row.node.id, {
        record: row.node,
        audio: row.audio,
        images: row.images,
        children: row.children,
        totals: row.totals,
        parentId,
        parentTitle,
        rootId,
        isTop: false,
        path: row.path,
      });
      walk(row.children, row.node.id, row.node.title, rootId);
    }
  };

  for (const top of data.scripts) {
    index.set(top.script.id, {
      record: top.script,
      audio: top.audio,
      images: top.images,
      children: [],
      totals: top.totals,
      parentId: null,
      parentTitle: null,
      rootId: top.script.id,
      isTop: true,
      row: top,
      path: [top.script.title],
    });
    for (const part of top.parts) {
      index.set(part.part.id, {
        record: part.part,
        audio: part.audio,
        images: part.images,
        children: [],
        totals: { audio: part.audio.length, images: part.images.length },
        parentId: top.script.id,
        parentTitle: top.script.title,
        rootId: top.script.id,
        isTop: false,
        path: [top.script.title, part.part.title],
      });
    }
    walk(top.tree, top.journey?.id || top.script.id,
      top.journey?.title || top.script.title, top.script.id);
  }
  return index;
}

/** صفُّ عقدةٍ في شجرة الرحلة — بأدواتها كلِّها في متناول الإبهام. */
function nodeRow(entry, expanded) {
  const { record, children, totals } = entry;
  const open = expanded.has(record.id);
  const hidden = record.hidden === 1;

  return html`
    <li class="org-node${hidden ? ' is-hidden' : ''}" data-node="${record.id}">
      <div class="org-node-row">
        <button class="org-node-twist" data-org="twist" data-id="${record.id}"
                aria-expanded="${open ? 'true' : 'false'}"
                aria-label="${open ? 'اطوِ' : 'افرد'}">${open ? '−' : '+'}</button>
        <button class="org-node-main" data-org="open-script" data-id="${record.id}">
          <span class="org-node-t">${record.title}</span>
          ${raw(hidden ? '<span class="org-tag">مخفيّة</span>' : '')}
          ${raw(countChip(totals.audio, totals.images))}
        </button>
        <div class="org-node-tools">
          <button class="org-icobtn" data-org="node-up" data-id="${record.id}"
                  aria-label="حرّك لفوق">▲</button>
          <button class="org-icobtn" data-org="node-down" data-id="${record.id}"
                  aria-label="حرّك لتحت">▼</button>
          <button class="org-icobtn" data-org="node-menu" data-id="${record.id}"
                  aria-label="خيارات">⋯</button>
        </div>
      </div>
      ${raw(open && children.length ? html`
        <ul class="org-nodes">${raw(children.map((c) => nodeRow({
    record: c.node, children: c.children, totals: c.totals,
  }, expanded)).join(''))}</ul>` : '')}
    </li>`;
}

/**
 * قسمُ رحلة التدريب — **مفصولٌ عن السكريبت الأصليّ بخطٍّ وعنوان**.
 *
 * ⚠️ والفصلُ مطلبٌ صريح (بند ١٩): السكريبتُ الأصليّ هو الموضوعُ كما
 *    هو، والرحلةُ مادّةٌ مشتقّةٌ منه. ودمجُهما في قائمةٍ واحدةٍ يجعل
 *    «المرحلة ١» تبدو نسخةً أخرى من النصّ الأصليّ — وهي ليست كذلك.
 */
function journeySection(top, expanded) {
  if (!top.journey) {
    return html`
      <section class="org-block org-journey-invite">
        <h3>رحلة تدريب</h3>
        <p>السكريبت ده عاديّ دلوقتي. تقدر تضيف تحته رحلة تدريب —
           والنصّ والصوت والصور بتوعه هيفضلوا زيّ ما هم.</p>
        <button class="org-btn org-btn-go" data-org="journey-new" data-id="${top.script.id}">
          ${raw(icon('plus'))} أنشئ رحلة تدريب
        </button>
      </section>`;
  }

  const nodes = top.tree;
  const version = top.journey.templateVersion;

  return html`
    <section class="org-block org-journey">
      <div class="org-journey-head">
        <div>
          <h3>${top.journey.title}</h3>
          <p class="org-journey-meta">
            ${nodes.length} مرحلة${raw(version
    ? html` · من قالب هايبر-لينغوال v${version}` : '')}
            ${raw(top.journeyDisabled ? '<b class="org-tag">مُعطَّلة</b>' : '')}
          </p>
        </div>
        <div class="org-rowbtns">
          <button class="org-btn org-btn-sm" data-org="journey-toggle"
                  data-id="${top.journey.id}" data-v="${top.journeyDisabled ? 'on' : 'off'}">
            ${top.journeyDisabled ? 'رجّع الرحلة' : 'عطّل الرحلة'}
          </button>
          <button class="org-btn org-btn-sm" data-org="node-add-child" data-id="${top.journey.id}">
            ${raw(icon('plus'))} مرحلة
          </button>
        </div>
      </div>

      ${raw(top.journeyDisabled ? html`
        <p class="org-empty">الرحلة مُعطَّلة — محفوظة بالكامل ومش ظاهرة في التدريب.
           كلّ حاجة جوّاها لسه موجودة.</p>` : '')}

      ${raw(nodes.length
    ? html`<ul class="org-nodes is-root">${raw(nodes.map((n) => nodeRow({
      record: n.node, children: n.children, totals: n.totals,
    }, expanded)).join(''))}</ul>`
    : html`<p class="org-empty">الرحلة فاضية — أضف أوّل مرحلة.</p>`)}
    </section>`;
}

function renderScriptDetail(data) {
  const index = indexBoard(data);
  const entry = index.get(state.scriptId);
  if (!entry) return html`<p class="org-empty">السكريبت ده مش موجود.</p>`;

  const { record, audio, images, isTop } = entry;
  const top = isTop ? entry.row : null;
  const kindLabel = NODE_KIND_LABEL[record.nodeKind] || null;

  return html`
    <header class="org-bulkhead">
      <button class="org-back" data-org="board">${raw(icon('back'))} رجوع</button>
      <h2>${record.title}</h2>
      ${raw(isTop ? '<span class="org-flag">تجريبي</span>'
    : html`<span class="org-tag">${kindLabel || 'عقدة'}</span>`)}
    </header>

    ${raw(entry.path.length > 1
    ? html`<p class="org-crumb">${entry.path.slice(0, -1).join(' · ')}</p>` : '')}

    <div class="org-detail">
      <section class="org-text${isTop ? ' is-origin' : ''}">
        <div class="org-block-head">
          <h3>${isTop ? 'السكريبت الأصليّ' : 'النصّ'}</h3>
          <div class="org-rowbtns">
            <button class="org-btn org-btn-sm" data-org="rename" data-id="${record.id}">
              ${raw(icon('edit'))} الاسم
            </button>
            <button class="org-btn org-btn-sm" data-org="edit-script" data-id="${record.id}">
              ${raw(icon('script'))} النصّ
            </button>
            <button class="org-btn org-btn-sm" data-org="shadow" data-id="${record.id}">
              ${raw(icon('book'))} تدرّب
            </button>
          </div>
        </div>
        <p class="org-body ru" dir="ltr" lang="ru">${record.text || '—'}</p>
      </section>

      <section class="org-block">
        <div class="org-block-head">
          <h3>الأصوات المرتبطة ${raw(audio.length ? html`<b>${audio.length}</b>` : '')}</h3>
        </div>
        ${raw(linkedList(audio, data))}
      </section>

      <section class="org-block">
        <div class="org-block-head">
          <h3>الصور المرتبطة ${raw(images.length ? html`<b>${images.length}</b>` : '')}</h3>
        </div>
        ${raw(linkedList(images, data))}
      </section>

      ${raw(!isTop ? html`
      <section class="org-block">
        <div class="org-block-head">
          <h3>اللي جوّه</h3>
          <button class="org-btn org-btn-sm" data-org="node-add-child" data-id="${record.id}">
            ${raw(icon('plus'))} أضف جوّه
          </button>
        </div>
        ${raw(entry.children.length
    ? html`<ul class="org-nodes is-root">${raw(entry.children.map((c) => nodeRow({
      record: c.node, children: c.children, totals: c.totals,
    }, state.expanded)).join(''))}</ul>`
    : html`<p class="org-empty">فاضية — وده تمام.</p>`)}
      </section>` : '')}

      ${raw(top ? html`
      <section class="org-block">
        <div class="org-block-head">
          <h3>الأجزاء</h3>
          <button class="org-btn org-btn-sm" data-org="add-part" data-id="${record.id}">
            ${raw(icon('plus'))} إضافة جزء
          </button>
        </div>
        ${raw(top.parts.length
    ? html`<ul class="org-parts is-detail">${raw(top.parts.map((p) => html`
            <li>
              <button class="org-part" data-org="open-script" data-id="${p.part.id}">
                <span>${p.part.title}</span>
                ${raw(countChip(p.audio.length, p.images.length))}
              </button>
              <button class="org-btn org-btn-sm danger" data-org="del-part" data-id="${p.part.id}">
                ${raw(icon('trash'))}
              </button>
            </li>`).join(''))}</ul>`
    : html`<p class="org-empty">السكريبت ده من غير أجزاء — وده تمام.</p>`)}
      </section>

      ${raw(journeySection(top, state.expanded))}` : '')}

      <div class="org-detail-foot">
        <button class="org-btn org-btn-go" data-org="bulk-here" data-id="${record.id}">
          ${raw(icon('link'))} اربط عناصر بالسكريبت ده
        </button>
      </div>
    </div>`;
}

/* ================================================================== *
 * نوافذ
 * ================================================================== */

/** قائمةُ الإضافة الواحدة (بند ٦) — بابٌ واحدٌ لا خمسةُ أزرارٍ متفرّقة. */
async function openAddMenu(sceneId) {
  const options = [
    { id: 'image', label: 'صورة', hint: 'تقدر تختار أكتر من صورة مرّة واحدة', ic: 'image' },
    { id: 'script', label: 'سكريبت / نصّ', hint: 'النصّ اللي قلته أو المفروض تقوله', ic: 'script' },
    { id: 'audio', label: 'صوت', hint: 'ملفات صوت — أو سجّل دلوقتي', ic: 'mic' },
    { id: 'conversation', label: 'محادثة', hint: 'سؤال وجواب', ic: 'chat' },
    { id: 'raw', label: 'نصّ أصلي', hint: 'التفريغ الخام زيّ ما هو', ic: 'note' },
  ];

  /*
   * ⚠️ **لمسةٌ واحدةٌ تختار وتغلق — ولا زرَّ «تمام» ميّتًا تحتها.**
   *
   *    والنافذةُ لا تُمرِّر دالّةَ إغلاقٍ إلى `onMount` (راجع
   *    `components/modal.js`)، فالخيارُ يُسجَّل ثم يُنقَر زرُّ الإلغاء
   *    القائم. يبدو التفافًا، وهو أنظفُ من البديلين: إضافةُ زرِّ تأكيدٍ
   *    لا يفعل شيئًا بعد أن اخترتَ، أو تعديلُ عقد `showModal` كلِّه
   *    لأجل نافذةٍ واحدة.
   */
  let picked = null;
  await showModal({
    title: 'تضيف إيه؟',
    actions: [{ label: 'إلغاء', value: null, variant: 'ghost' }],
    body: html`<div class="org-addmenu">
      ${raw(options.map((o) => html`
        <button type="button" class="org-addopt" data-pick="${o.id}">
          <span class="ic">${raw(icon(o.ic))}</span>
          <b>${o.label}</b>
          <span>${o.hint}</span>
        </button>`).join(''))}
    </div>`,
    onMount(modal) {
      const closer = modal.querySelector('.modal-actions button[type="button"]');
      modal.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', () => { picked = btn.dataset.pick; closer?.click(); });
      });
    },
  });
  if (!picked) return;

  if (picked === 'image') {
    const { handleAddImages } = await import('../modals/media-actions.js');
    return handleAddImages(sceneId);
  }
  if (picked === 'audio') {
    const { handleAddAudio } = await import('../modals/media-actions.js');
    return handleAddAudio(sceneId);
  }
  if (picked === 'script') {
    const { openScriptModal } = await import('../modals/content-modals.js');
    return openScriptModal(sceneId);
  }
  if (picked === 'conversation') {
    const { openPartModal } = await import('../modals/content-modals.js');
    return openPartModal(sceneId);
  }
  const { openRawTranscriptModal } = await import('../modals/transcript-modals.js');
  return openRawTranscriptModal(sceneId);
}

/* ================================================================== *
 * نوافذُ شجرة الرحلة
 * ================================================================== */

/** أبو عقدةٍ من الفهرس — الشجرةُ محمولةٌ في `board` فلا نسأل القاعدة. */
function parentOfNode(nodeId) {
  return indexBoard(board).get(nodeId)?.parentId || null;
}

/**
 * اختيارُ قالب الرحلة مع **معاينةٍ قبل الإنشاء** (بند ٣٠).
 *
 * ⚠️ والمعاينةُ ليست تزيينًا: ثمانيَ عشرةَ مرحلةً تُنشَأ دفعةً واحدة،
 *    ومَن لم يرَ ما سيأتي سيجد نفسَه يحذف نصفَها.
 */
async function askJourneyTemplate() {
  let picked = null;
  await showModal({
    title: 'رحلة تدريب جديدة',
    actions: [{ label: 'إلغاء', value: null, variant: 'ghost' }],
    body: html`<div class="org-addmenu">
      ${raw(JOURNEY_TEMPLATES.map((t) => html`
        <button type="button" class="org-addopt" data-pick="${t.id}">
          <span class="ic">${raw(icon(t.id === 'empty' ? 'plus' : 'script'))}</span>
          <b>${t.label}</b>
          <span>${t.hint}</span>
        </button>`).join(''))}
      <details class="org-preview">
        <summary>شوف مراحل القالب</summary>
        <ol>${raw(JOURNEY_TEMPLATES[0].phases.map((p) => html`<li>${p.title}</li>`).join(''))}</ol>
      </details>
    </div>`,
    onMount(modal) {
      const closer = modal.querySelector('.modal-actions button[type="button"]');
      modal.querySelectorAll('[data-pick]').forEach((b) => {
        b.addEventListener('click', () => { picked = b.dataset.pick; closer?.click(); });
      });
    },
  });
  return picked;
}

/**
 * إضافةُ عقدةٍ تحت أخرى — الاسمُ والنوع.
 *
 * ⚠️ **والنوعُ يُعرَض هنا وحدَه، ولا يظهر في الصفوف** (بند ١٥).
 *    «مرحلة» و«جولة» تساعدك لحظةَ الإنشاء؛ أمّا وسمُ كلّ صفٍّ بنوعه
 *    فيملأ الشاشةَ بمصطلحاتٍ لا تضيف شيئًا فوق العنوان الذي كتبتَه.
 */
const NEW_NODE_KINDS = [
  { id: NODE_KIND.PHASE, label: 'مرحلة' },
  { id: NODE_KIND.PART, label: 'جزء' },
  { id: NODE_KIND.ROUND, label: 'جولة' },
  { id: NODE_KIND.TRAINING, label: 'نصّ تدريب' },
  { id: NODE_KIND.CUSTOM, label: 'حاجة تانية' },
];

async function askNewNode(parentId) {
  const kinds = NEW_NODE_KINDS;
  let made = null;

  await showModal({
    title: 'إضافة جوّه',
    submitLabel: 'أضف',
    body: html`
      <div class="field">
        <label for="node-title">الاسم</label>
        <input id="node-title" name="title" type="text" placeholder="مثلًا: القياسات">
      </div>
      <div class="field">
        <label>النوع</label>
        <div class="org-pickrows">
          ${raw(kinds.map((k, i) => html`
            <label class="pick-row">
              <input type="radio" name="kind" value="${k.id}" ${i === 0 ? 'checked' : ''}>
              <span>${k.label}</span>
            </label>`).join(''))}
        </div>
      </div>`,
    async onSubmit(form, close) {
      const title = (form.title || '').trim();
      if (!title) { toastError('اكتب اسم'); return; }
      made = await addNode(parentId, {
        title, nodeKind: form.kind || NODE_KIND.CUSTOM, semanticType: 'custom',
      });
      close();
    },
  });
  return made;
}

/**
 * قائمةُ خيارات عقدة — إعادةُ تسميةٍ وإخفاءٌ وتكرارٌ وحذف.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **نافذةٌ واحدةٌ تُبدّل خطوتَها — لا نافذةٌ تفتح نافذة.**
 * ═══════════════════════════════════════════════════════════════
 *
 * أوّلُ صياغةٍ كانت: نافذةُ خيارات، تُغلَق، ثم تُفتَح نافذةُ الاسم.
 * وسقطت في التحقّق الميدانيّ سقوطًا محيّرًا: الاسمُ يُحفَظ في القاعدة
 * بنجاح، ثم **تختفي الشجرةُ كلُّها** وأجد نفسي على اللوحة.
 *
 * والسببُ في `components/layers.js`: كلُّ نافذةٍ تدفع مدخلًا في
 * تاريخ المتصفّح (`pushState`)، وإغلاقُها ينادي `history.back()`.
 * ففتحُ الثانية قبل أن تستقرّ رجعةُ الأولى يشتبك مع عدّاد التجاهل،
 * فتصل رجعةٌ حقيقيّةٌ إلى الموجّه — فيُعاد بناءُ الشاشة من أوّلها.
 *
 * ⚠️ **ولم يكن الحلُّ انتظارَ مئةِ مللي ثانية.** ذلك يُخفي السباقَ ولا
 *    يُنهيه، ويعود على جهازٍ أبطأ. فالحلُّ ألّا تُفتَح نافذةٌ ثانية
 *    أصلًا: **نافذةٌ واحدةٌ** تستبدل محتواها، فمدخلُ تاريخٍ واحدٌ من
 *    أوّلها إلى آخرها.
 */
async function openNodeMenu(nodeId, main) {
  const entry = indexBoard(board).get(nodeId);
  if (!entry) return undefined;
  const { record } = entry;
  const hidden = record.hidden === 1;
  const kids = entry.children.length;

  const options = [
    { id: 'rename', label: 'غيّر الاسم', hint: 'الاسم بس — المعنى الداخليّ ما بيتغيّرش' },
    { id: 'text', label: 'حرّر النصّ', hint: 'يتحفظ في تاريخ السكريبت' },
    { id: 'hide', label: hidden ? 'رجّعها' : 'اخفيها',
      hint: hidden ? 'ترجع للرحلة' : 'تفضل محفوظة ومش ظاهرة' },
    { id: 'dup', label: 'كرّرها', hint: 'بنسخة من اللي جوّاها وروابطها' },
    { id: 'add', label: 'أضف جوّه', hint: 'جزء أو جولة أو نصّ تدريب' },
    { id: 'shadow', label: 'تدرّب عليها', hint: 'تفتح في كتاب الظلّ' },
    { id: 'delete', label: 'احذفها', hint: kids ? `فيها ${kids} عنصر جوّه` : 'تروح للسلة' },
  ];

  const optionList = options.map((o) => html`
    <button type="button" class="org-addopt${o.id === 'delete' ? ' is-danger' : ''}"
            data-step="${o.id}">
      <b>${o.label}</b><span>${o.hint}</span>
    </button>`).join('');

  const renameStep = html`
    <div class="field">
      <label for="rn">الاسم الجديد</label>
      <input id="rn" name="title" type="text" value="${record.title}">
    </div>`;

  /*
   * ⚠️ **وخطوةُ «أضف جوّه» هنا لا في نافذةٍ ثانية.** كانت آخرَ سلسلةٍ
   *    باقية، فسقطت في التحقّق كما سقطت إعادةُ التسمية قبلها — ولنفس
   *    السبب. فالقاعدةُ صارت: **قائمةُ العقدة لا تفتح نافذةً أبدًا.**
   */
  const addStep = html`
    <div class="field">
      <label for="node-title">الاسم</label>
      <input id="node-title" name="title" type="text" placeholder="مثلًا: القياسات">
    </div>
    <div class="field">
      <label>النوع</label>
      <div class="org-pickrows">
        ${raw(NEW_NODE_KINDS.map((k, i) => html`
          <label class="pick-row">
            <input type="radio" name="kind" value="${k.id}" ${i === 0 ? 'checked' : ''}>
            <span>${k.label}</span>
          </label>`).join(''))}
      </div>
    </div>`;

  const deleteStep = html`
    <p>اللي مربوط بيها من صوت وصور هيرجع «غير مربوط» — مش هيتمسح.</p>
    <div class="org-addmenu">
      ${raw(kids ? html`
        <button type="button" class="org-addopt" data-go="${DELETE_POLICY.LIFT}">
          <b>احذفها هي بس</b><span>الـ${kids} اللي جوّاها هيطلعوا مكانها</span>
        </button>
        <button type="button" class="org-addopt is-danger" data-go="${DELETE_POLICY.CASCADE}">
          <b>احذفها هي وكلّ اللي جوّاها</b><span>${kids + 1} عنصر هيروحوا السلة</span>
        </button>` : html`
        <button type="button" class="org-addopt is-danger" data-go="${DELETE_POLICY.CASCADE}">
          <b>احذفها</b><span>هتروح للسلة</span>
        </button>`)}
    </div>`;

  let result = null;

  await showModal({
    title: record.title,
    submitLabel: 'تمام',
    body: html`
      <input type="hidden" name="act" data-act>
      <input type="hidden" name="policy" data-policy>
      <div class="org-addmenu" data-panel>${raw(optionList)}</div>`,
    onMount(modal) {
      const panel = modal.querySelector('[data-panel]');
      const act = modal.querySelector('[data-act]');
      const policy = modal.querySelector('[data-policy]');
      const form = modal.querySelector('[data-modal-form]');
      const submit = modal.querySelector('.modal-actions button[type="submit"]');
      /* الخطوةُ الأولى اختيارٌ بلمسة — فزرُّ «تمام» لا معنى له فيها. */
      submit.style.display = 'none';

      const toStep = (markup) => {
        panel.classList.remove('org-addmenu');
        panel.innerHTML = markup;
        submit.style.display = '';
        modal.querySelector('input[type="text"]')?.focus();
      };

      panel.addEventListener('click', (event) => {
        const pick = event.target.closest('[data-step]');
        const go = event.target.closest('[data-go]');
        if (go) {
          act.value = 'delete';
          policy.value = go.dataset.go;
          form.requestSubmit();
          return;
        }
        if (!pick) return;
        act.value = pick.dataset.step;
        if (pick.dataset.step === 'rename') { toStep(renameStep); return; }
        if (pick.dataset.step === 'add') { toStep(addStep); return; }
        if (pick.dataset.step === 'delete') { toStep(deleteStep); return; }
        form.requestSubmit();
      });
    },
    onSubmit(data, close) {
      result = {
        act: data.act || null,
        title: (data.title || '').trim(),
        kind: data.kind || null,
        policy: data.policy || null,
      };
      close();
    },
  });

  if (!result?.act) return undefined;
  const { act, title, kind, policy } = result;

  if (act === 'rename') {
    if (!title) return undefined;
    await renameNode(nodeId, title);
    toastOk('الاسم اتغيّر');
    return refresh(main);
  }

  if (act === 'text') {
    /*
     * ⚠️ **ومعرّفُ الذكرى يُمرَّر وإن كانت العقدةُ بلا `sceneId`.**
     *    النافذةُ تُنهي عملَها بـ`reloadScene(sceneId)`؛ ولو مرّرنا
     *    `null` — وهو `sceneId` العقدة الحقيقيّ — لصار المسارُ
     *    `/scene/null` وقُذفنا إلى شاشةٍ لا وجودَ لها.
     */
    const { openScriptModal } = await import('../modals/content-modals.js');
    await openScriptModal(state.sceneId, nodeId);
    return refresh(main);
  }

  if (act === 'hide') {
    await setNodeHidden(nodeId, !hidden);
    toastOk(hidden ? 'رجعت' : 'اتخفت — ولسه محفوظة');
    return refresh(main);
  }

  if (act === 'dup') {
    if (!entry.parentId) return toastError('مينفعش نكرّر السكريبت الأصليّ من هنا');
    await duplicateNode(entry.parentId, nodeId);
    toastOk('اتكرّرت');
    return refresh(main);
  }

  if (act === 'add') {
    if (!title) { toastError('اكتب اسم'); return undefined; }
    await addNode(nodeId, { title, nodeKind: kind || NODE_KIND.CUSTOM, semanticType: 'custom' });
    state.expanded.add(nodeId);
    toastOk('اتضافت');
    return refresh(main);
  }

  if (act === 'shadow') {
    const { openShadowForScript } = await import('../services/shadow/shadow-entry.js');
    return openShadowForScript(nodeId, state.sceneId);
  }

  if (act === 'delete' && policy) {
    const { removed } = await removeNode(nodeId, { policy });
    toastOk(`اتشال ${removed} عنصر — موجودين في السلة`);
    if (state.scriptId === nodeId) state.screen = 'board';
    return refresh(main);
  }

  return undefined;
}

/**
 * منتقي الهدف لعنصرٍ واحد (بند ٩) — **بلا مصطلحاتِ قاعدةِ بيانات**.
 * لا «relationship» ولا «kind»: «اربط الصوت ده بـ» ثم أسماءٌ عربيّة.
 */
async function openTargetPicker(itemIds, data, { title } = {}) {
  const rows = [
    ...data.targets.map((t) => ({
      id: t.id,
      label: t.parentTitle ? `${t.parentTitle}${PATH_SEP}${t.title}` : t.title,
    })),
    { id: '__none__', label: 'بدون ربط' },
  ];
  if (rows.length === 1) {
    toastError('أضف سكريبت الأوّل');
    return false;
  }

  const current = itemIds.length === 1 ? data.linkedTo.get(itemIds[0]) : null;
  let chosen = null;

  await showModal({
    title: title || 'اربط بـ',
    submitLabel: 'تمام',
    body: html`<div class="org-pickrows">
      ${raw(rows.map((r) => html`
        <label class="pick-row">
          <input type="radio" name="target" value="${r.id}" ${r.id === current ? 'checked' : ''}>
          <span>${r.label}</span>
        </label>`).join(''))}
    </div>`,
    onSubmit(form, close) { chosen = form.target || null; close(); },
  });

  if (!chosen) return false;
  const targetId = chosen === '__none__' ? null : chosen;
  const scopeIds = data.targets.map((t) => t.id);
  const result = await linkItemsTo(itemIds, targetId, { scopeIds });

  toastOk(targetId
    ? `اتربط ${result.linked} عنصر بـ«${targetLabel(targetId)}»`
    : `اتفكّ ربط ${result.unlinked} عنصر`);
  return true;
}

/* ================================================================== *
 * الرسم والأحداث
 * ================================================================== */

function paint(main, data, extras) {
  const screen = state.screen === 'bulk' ? renderBulk(data)
    : state.screen === 'script' ? renderScriptDetail(data)
      : renderBoard(data, extras);
  main.innerHTML = html`<div class="org-root" data-org-root>${raw(screen)}</div>`;
}

let extrasCache = null;

async function refresh(main) {
  board = await organizeBoard(state.sceneId);
  if (!board) return;
  paint(main, board, extrasCache);
}

/**
 * ⚠️ **تبديلُ الاختيار لا يُعيد الرسم.** يُبدَّل صنفُ الخليّة وعدّادُ
 *    الشريط فقط — راجع القرار ٣ في رأس الملفّ.
 */
function paintSelection(root) {
  root.querySelectorAll('[data-org="pick"]').forEach((cell) => {
    const on = state.selection.has(cell.dataset.id);
    cell.classList.toggle('on', on);
    cell.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const counter = root.querySelector('[data-org-count]');
  if (counter) counter.textContent = `${state.selection.size} مختار`;
}

export async function renderOrganize(main, sceneId) {
  releaseUrls();
  wires?.abort();
  wires = new AbortController();

  if (state.sceneId !== sceneId) reset(sceneId);
  state.sceneId = sceneId;

  board = await organizeBoard(sceneId);
  if (!board) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الذكرى دي مش موجودة</h2>
        <button class="btn btn-ghost" data-action="go-life">افتح حياتي</button>
      </div>`;
    return;
  }

  const [people, threads, conversation, rawBlock] = await Promise.all([
    scenePeopleWithEvidence(sceneId).catch(() => []),
    threadsOfScene(sceneId).catch(() => []),
    listConversationParts(sceneId).catch(() => []),
    getBlock(sceneId, 'rawTranscript').catch(() => ({ text: '' })),
  ]);
  extrasCache = {
    people,
    threads,
    conversationCount: conversation.length,
    hasTranscript: Boolean(rawBlock?.text),
  };

  paint(main, board, extrasCache);

  main.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-org]');
    if (!btn || !main.contains(btn)) return;
    const action = btn.dataset.org;
    const id = btn.dataset.id || null;
    const root = main.querySelector('[data-org-root]');

    switch (action) {
      case 'noop':
        return;

      /* ---- تنقّل ---- */
      case 'exit': {
        const { navigate } = await import('../router.js');
        return navigate(`/scene/${state.sceneId}`);
      }
      case 'board':
        state.screen = 'board';
        state.selection.clear();
        return refresh(main);

      case 'bulk':
        state.screen = 'bulk';
        state.selection.clear();
        return refresh(main);

      case 'bulk-here':
        state.screen = 'bulk';
        state.targetId = id;
        state.selection.clear();
        return refresh(main);

      case 'bulk-filter':
        state.screen = 'bulk';
        state.filter = btn.dataset.v || 'all';
        state.selection.clear();
        return refresh(main);

      case 'open-script':
        state.screen = 'script';
        state.scriptId = id;
        return refresh(main);

      /* ---- إضافة ---- */
      case 'add':
        await openAddMenu(state.sceneId);
        return refresh(main);

      case 'add-script': {
        const { openScriptModal } = await import('../modals/content-modals.js');
        await openScriptModal(state.sceneId);
        return refresh(main);
      }

      case 'edit-script': {
        const { openScriptModal } = await import('../modals/content-modals.js');
        await openScriptModal(state.sceneId, id);
        return refresh(main);
      }

      case 'shadow': {
        const { openShadowForScript } = await import('../services/shadow/shadow-entry.js');
        return openShadowForScript(id, state.sceneId);
      }

      /* ---- الأجزاء ---- */
      case 'add-part': {
        let title = '';
        await showModal({
          title: 'جزء جديد',
          submitLabel: 'أضف',
          body: html`<div class="field">
            <label for="part-title">اسم الجزء</label>
            <input id="part-title" name="title" type="text" placeholder="مثلًا: القياسات">
          </div>`,
          onSubmit(form, close) { title = (form.title || '').trim(); close(); },
        });
        if (!title) return undefined;
        await addPart(id, { title });
        toastOk('الجزء اتضاف');
        return refresh(main);
      }

      case 'del-part': {
        let go = false;
        await showModal({
          title: 'تشيل الجزء ده؟',
          submitLabel: 'شيله',
          body: html`<p>اللي مربوط بيه هيرجع «غير مربوط» — مش هيتمسح.</p>`,
          onSubmit(_data, close) { go = true; close(); },
        });
        if (!go) return undefined;
        await removePart(id);
        toastOk('اتشال');
        state.screen = 'board';
        return refresh(main);
      }

      /* ---- شجرةُ الرحلة ---- */

      case 'twist':
        if (state.expanded.has(id)) state.expanded.delete(id);
        else state.expanded.add(id);
        return refresh(main);

      case 'journey-new': {
        const template = await askJourneyTemplate();
        if (!template) return undefined;
        const journey = await createJourney(id, { templateId: template });
        state.expanded.add(journey.id);
        toastOk('الرحلة اتعملت — وكلّ حاجة فيها قابلة للتعديل');
        return refresh(main);
      }

      case 'journey-toggle': {
        const turnOn = btn.dataset.v === 'on';
        await setJourneyEnabled(id, turnOn);
        toastOk(turnOn ? 'الرحلة رجعت' : 'الرحلة اتعطّلت — محفوظة بالكامل');
        return refresh(main);
      }

      case 'node-up':
      case 'node-down': {
        const parentId = parentOfNode(id);
        if (!parentId) return undefined;
        const moved = await moveNode(parentId, id, action === 'node-up' ? 'up' : 'down');
        return moved ? refresh(main) : undefined;
      }

      case 'node-add-child': {
        const made = await askNewNode(id);
        if (!made) return undefined;
        state.expanded.add(id);
        toastOk('اتضافت');
        return refresh(main);
      }

      case 'node-menu':
        return openNodeMenu(id, main);

      case 'rename': {
        const entry = indexBoard(board).get(id);
        if (!entry) return undefined;
        let title = null;
        await showModal({
          title: 'غيّر الاسم',
          submitLabel: 'احفظ',
          body: html`<div class="field">
            <label for="rn2">الاسم</label>
            <input id="rn2" name="title" type="text" value="${entry.record.title}">
          </div>`,
          onSubmit(form, close) { title = (form.title || '').trim(); close(); },
        });
        if (!title) return undefined;
        await renameNode(id, title);
        toastOk('الاسم اتغيّر');
        return refresh(main);
      }

      /* ---- الربط ---- */
      case 'relink': {
        const done = await openTargetPicker([id], board, { title: 'اربط العنصر ده بـ' });
        return done ? refresh(main) : undefined;
      }

      case 'pick':
        if (state.selection.has(id)) state.selection.delete(id);
        else state.selection.add(id);
        return paintSelection(root);

      case 'pick-all': {
        for (const item of visibleItems(board)) state.selection.add(item.id);
        return paintSelection(root);
      }

      case 'pick-none':
        state.selection.clear();
        return paintSelection(root);

      case 'target':
        state.targetId = state.targetId === id ? null : id;
        root.querySelectorAll('[data-org="target"]').forEach((node) => {
          node.classList.toggle('on', node.dataset.id === state.targetId);
        });
        return undefined;

      case 'filter':
        state.filter = btn.dataset.v || 'all';
        return refresh(main);

      case 'apply': {
        if (!state.selection.size) return toastError('اختار عناصر الأوّل');
        /*
         * ⚠️ **وبلا هدفٍ مختار نسأل بدل أن نرفض.** رسالةُ «اختار هدف»
         *    تُعيدك إلى العمود لتضغط ثم تعود — ونحن نعرف ما تريد.
         */
        const ids = [...state.selection];
        if (!state.targetId) {
          const done = await openTargetPicker(ids, board, { title: 'اربط المحدد بـ' });
          if (!done) return undefined;
          state.selection.clear();
          return refresh(main);
        }
        const targetId = state.targetId === '__none__' ? null : state.targetId;
        const scopeIds = board.targets.map((t) => t.id);
        const result = await linkItemsTo(ids, targetId, { scopeIds });
        toastOk(targetId
          ? `اتربط ${result.linked} عنصر بـ«${targetLabel(targetId)}»`
          : `اتفكّ ربط ${result.unlinked} عنصر`);
        state.selection.clear();
        return refresh(main);
      }

      default:
        return undefined;
    }
  }, { signal: wires.signal });

  main.addEventListener('input', (event) => {
    const input = event.target.closest('[data-org-search]');
    if (!input) return;
    state.query = input.value;
    refresh(main).then(() => {
      const next = main.querySelector('[data-org-search]');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });
  }, { signal: wires.signal });
}

/**
 * يُنادى عند **مغادرة الوضع** — لا عند إنعاشه في مكانه.
 *
 * ⚠️ **وهو الفرق الذي يحسم أين تفتح الشاشةُ في المرّة القادمة.**
 *
 *    `renderOrganize` تُنادى من مسارين: الموجّهُ حين تدخل الوضع،
 *    و`reloadScene` حين تضيف صورةً وأنت داخله. ولو أعادت الضبطَ في
 *    الحالتين لقذفتك الإضافةُ من ورقة السكريبت إلى اللوحة.
 *
 *    ولو لم تُعده أبدًا لحدث العكسُ — وقد حدث في التحقّق الميدانيّ:
 *    فتحتُ سكريبتًا، خرجتُ للوضع القديم، عدتُ… فوجدتُ نفسي في ورقة
 *    السكريبت لا في اللوحة، وزرُّ «ترتيب وربط» غيرُ موجودٍ أصلًا.
 *
 *    و«المغادرة» هي بالضبط ما يُنادي هذه الدالّة (`view()` في
 *    `app.js`)، فالضبطُ يقع هنا لا هناك: تُغادر فتبدأ من اللوحة،
 *    وتُنعَش في مكانك فتبقى فيه.
 */
export function disposeOrganize() {
  wires?.abort();
  wires = null;
  board = null;
  state.screen = 'board';
  state.scriptId = null;
  state.selection = new Set();
  state.targetId = null;
  state.filter = 'all';
  state.query = '';
  state.expanded = new Set();
}

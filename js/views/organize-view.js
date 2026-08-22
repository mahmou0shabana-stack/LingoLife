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
} from '../services/organize-service.js';

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
  return target.parentTitle ? `${target.parentTitle}${PATH_SEP}${target.title}` : target.title;
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
  const { script, parts, totals } = row;
  return html`
    <li class="org-script">
      <button class="org-script-main" data-org="open-script" data-id="${script.id}">
        <span class="org-script-t">${script.title}</span>
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
  const targets = [
    ...data.targets.map((t) => ({
      id: t.id,
      label: t.parentTitle ? `${t.parentTitle}${PATH_SEP}${t.title}` : t.title,
      part: t.kind === 'part',
    })),
    { id: '__none__', label: 'بدون ربط', part: false },
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
              <button class="org-target${state.targetId === t.id ? ' on' : ''}${t.part ? ' is-part' : ''}"
                      data-org="target" data-id="${t.id}">
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

function renderScriptDetail(data) {
  const top = data.scripts.find((r) => r.script.id === state.scriptId);
  const inPart = !top
    ? data.scripts.flatMap((r) => r.parts.map((p) => ({ ...p, parent: r.script })))
      .find((p) => p.part.id === state.scriptId)
    : null;

  const record = top ? top.script : inPart?.part;
  if (!record) return html`<p class="org-empty">السكريبت ده مش موجود.</p>`;

  const audio = top ? top.audio : inPart.audio;
  const images = top ? top.images : inPart.images;

  return html`
    <header class="org-bulkhead">
      <button class="org-back" data-org="board">${raw(icon('back'))} رجوع</button>
      <h2>${record.title}</h2>
      <span class="org-flag">تجريبي</span>
    </header>

    ${raw(inPart ? html`<p class="org-crumb">جزء من: ${inPart.parent.title}</p>` : '')}

    <div class="org-detail">
      <section class="org-text">
        <div class="org-block-head">
          <h3>النصّ</h3>
          <div class="org-rowbtns">
            <button class="org-btn org-btn-sm" data-org="edit-script" data-id="${record.id}">
              ${raw(icon('edit'))} تعديل
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
      </section>` : '')}

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
}

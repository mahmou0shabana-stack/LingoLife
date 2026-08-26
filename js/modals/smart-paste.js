/**
 * LingoLife — اللصقُ المنظَّم: تحليل ← مراجعة ← التزام (WS-F · بنود ٢٧…٣٤)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا تُنشَأ عقدةٌ واحدةٌ من هنا** (بندا ٣١ و٤٢-الروح)
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا الملفُّ **لا يستورد `commitPaste` ولا `addNode` ولا مستودعًا**.
 * فالإلغاءُ صفرُ كتاباتٍ **بنيةً لا وعدًا**: لا يملك أن يكتب ولو
 * أردتُ. ويحرسه اختبارٌ نصّيّ — كما في بابِ تبادل الذاكرة (WS-C2).
 *
 * يعيد `{ ok, proposal, excluded }` والمستدعي هو من يلتزم.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والنصُّ الخام باقٍ حتى اللحظة الأخيرة** (بند ٣٣)
 * ═══════════════════════════════════════════════════════════════
 *
 * لا يُعاد كتابةُ ما لصقتَه ولا يُستهلَك. يبقى في `state.raw`، ومعروضًا
 * تحت «النصّ الخام» لتقارنه بالمقترَح. وكلُّ تعديلٍ في المراجعة
 * **يُعيد التحليلَ منه** — فلا نسخةَ ثانيةٌ تنحرف عنه.
 */

import { html, raw } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toastError } from '../components/toast.js';
import { parsePaste, MARKERS, DEEPEST } from '../services/workspace/paste-parser.js';
import { looksLikeDialogue } from '../services/workspace/speaker-parser.js';

const LEVEL_LABEL = Object.freeze({
  1: 'مرحلة', 2: 'نسخة', 3: 'جزء', 4: 'جولة', 5: 'مستوى', 6: 'قسم',
});

const MAX_INPUT = 2_000_000;

/**
 * يفتح تدفّقَ اللصق المنظَّم.
 *
 * @param {{ parentLabel: string, seed?: string }} config
 * @returns {Promise<{ok: true, proposal: object, excluded: string[]}|null>}
 */
export async function openSmartPaste({ parentLabel, seed = '' } = {}) {
  /* قراراتُ المراجعة — مفاتيحُها **أرقامُ الأسطر** لأنها وحدَها تثبت. */
  const state = {
    raw: seed,
    levels: {},
    demote: [],
    renames: {},
    splits: {},
    excluded: new Set(),
    /** العقدةُ المفتوحةُ حدودُها الآن — واحدةٌ فقط، وإلّا صارت جدولًا. */
    cutting: null,
    parsed: null,
  };

  const reparse = () => {
    state.parsed = parsePaste(state.raw, {
      levels: state.levels,
      demote: state.demote,
      renames: state.renames,
      splits: state.splits,
    });
    /* ⚠️ استبعادٌ لعقدةٍ اختفت بعد إعادة التحليل يُنظَّف، وإلّا بقي شبحًا. */
    const alive = new Set(state.parsed.nodes.map((node) => node.id));
    for (const id of [...state.excluded]) if (!alive.has(id)) state.excluded.delete(id);
    return state.parsed;
  };

  let decided = null;

  await showModal({
    title: `استيراد نصّ منظَّم — تحت: ${parentLabel}`,
    wide: true,
    submitLabel: 'وافق واستورد',
    body: html`
      <div class="sp-wrap" data-sp>
        <div class="sp-stage" data-sp-stage="input">
          <p class="sp-hint">
            الصق النصّ كما هو. البرنامج بيقرأ العناوين اللي كتبتَها
            (PHASE · VERSION · PART · ROUND) ويقترح الشجرة —
            <b>مفيش ذكاء اصطناعي ولا تخمين</b>.
          </p>
          <textarea class="sp-paste" data-sp-input rows="14"
                    placeholder="الصق هنا…">${seed}</textarea>
          <div class="sp-row">
            <button type="button" class="btn btn-primary" data-sp="parse">حلّل</button>
          </div>
        </div>

        <div class="sp-stage" data-sp-stage="review" hidden></div>
      </div>`,
    onMount(root) {
      const stage = (name) => {
        root.querySelectorAll('[data-sp-stage]').forEach((node) => {
          node.hidden = node.dataset.spStage !== name;
        });
        /*
         * ⚠️ **وزرُّ «وافق» لا يُعرَض قبل المراجعة.** لو ظلّ ظاهرًا في
         *    مرحلة اللصق لأمكن الالتزامُ بلا أن ترى شيئًا — وهو بالضبط
         *    ما يمنعه بند ٣١.
         */
        const submit = root.querySelector('.modal-actions button[type="submit"]');
        if (submit) submit.hidden = name !== 'review';
      };
      stage('input');

      const review = root.querySelector('[data-sp-stage="review"]');

      const paint = () => {
        const parsed = state.parsed;
        review.innerHTML = parsed.ok ? reviewHtml(parsed, state) : failureHtml(parsed);
        stage('review');
      };

      root.addEventListener('click', (event) => {
        const act = event.target.closest('[data-sp]')?.dataset.sp;
        if (!act) return;

        if (act === 'parse') {
          const input = root.querySelector('[data-sp-input]');
          const text = String(input?.value ?? '');
          if (!text.trim()) return toastError('مفيش نصّ اتلصق');
          if (text.length > MAX_INPUT) return toastError('النصّ أكبر من اللازم');
          state.raw = text;
          reparse();
          return paint();
        }

        if (act === 'back') { stage('input'); return undefined; }

        const row = event.target.closest('[data-sp-at]');
        const at = row ? Number(row.dataset.spAt) : null;

        if (act === 'promote' && at !== null) {
          state.levels[at] = Number(event.target.closest('[data-sp-lvl]')?.dataset.spLvl || 3);
          reparse(); return paint();
        }
        if (act === 'demote' && at !== null) {
          state.demote = [...new Set([...state.demote, at])];
          delete state.levels[at];
          reparse(); return paint();
        }
        if (act === 'out' && at !== null) {
          const level = Math.max(1, (state.parsed.nodes.find((n) => n.at === at)?.level || 2) - 1);
          state.levels[at] = level; reparse(); return paint();
        }
        if (act === 'in' && at !== null) {
          const level = Math.min(DEEPEST, (state.parsed.nodes.find((n) => n.at === at)?.level || 1) + 1);
          state.levels[at] = level; reparse(); return paint();
        }
        /*
         * ⚠️ **التقسيمُ حدٌّ لا محرّرُ نصّ** (بند ١٦): تفتح حدودَ عقدةٍ
         *    واحدة، وتلمس السطرَ الذي يبدأ منه الجزءُ الجديد. ولا كتابةَ
         *    حرٍّ في المتن — ذاك مشروعٌ آخر لم يُطلَب.
         */
        if (act === 'cut-open') {
          const id = event.target.closest('[data-sp-id]')?.dataset.spId;
          state.cutting = state.cutting === id ? null : id;
          return paint();
        }
        if (act === 'cut-at' && at !== null) {
          const node = state.parsed.nodes.find((n) => n.bodyAt?.includes(at));
          /*
           * ⚠️ **ويُرفَض ما يصنع جزءًا فارغًا** (بندا ٧١ و٧٨) — ولا
           *    يُقَصّ صامتًا: تُقال العلّةُ كما هي.
           */
          if (!node || node.bodyAt[0] === at) {
            return toastError('مينفعش التقسيم هنا لأنه هيعمل جزء فاضي');
          }
          state.splits[at] = { title: `${node.title} — تكملة`, level: node.level };
          state.cutting = null;
          reparse(); return paint();
        }
        if (act === 'cut-undo' && at !== null) {
          delete state.splits[at];
          reparse(); return paint();
        }

        /*
         * ⚠️ **والدمجُ خفضٌ لا آليّةٌ ثالثة** (بند ١٧): عنوانُ الثانية
         *    يصير سطرًا في متن الأولى، فيسيل المتنُ ولا يضيع العنوان.
         *    وعنوانُ الأولى هو الباقي — وتقدر تعدّله بالحقل نفسِه.
         */
        if (act === 'merge-up') {
          const id = event.target.closest('[data-sp-id]')?.dataset.spId;
          const list = state.parsed.nodes;
          const idx = list.findIndex((n) => n.id === id);
          if (idx <= 0) return toastError('مفيش جزء قبله يتدمج فيه');
          const node = list[idx];
          if (node.synthetic) { delete state.splits[node.at]; reparse(); return paint(); }
          state.demote = [...new Set([...state.demote, node.at])];
          delete state.levels[node.at];
          reparse(); return paint();
        }

        if (act === 'skip') {
          const id = event.target.closest('[data-sp-id]')?.dataset.spId;
          if (!id) return undefined;
          if (state.excluded.has(id)) state.excluded.delete(id);
          else state.excluded.add(id);
          return paint();
        }
        return undefined;
      });

      /* إعادةُ التسمية تُحفَظ عند مغادرة الحقل — لا عند كلّ حرف. */
      root.addEventListener('change', (event) => {
        const field = event.target.closest('[data-sp-rename]');
        if (!field) return;
        state.renames[Number(field.dataset.spRename)] = field.value;
        reparse();
        /* ⚠️ ولا يُعاد الرسمُ هنا: إعادةُ الرسم أثناء الكتابة تقتل التركيز. */
        const row = field.closest('[data-sp-at]');
        if (row) row.classList.add('is-edited');
      });

      if (seed.trim()) {
        state.raw = seed;
        reparse();
        paint();
      }
    },
    onSubmit(_data, close) {
      if (!state.parsed?.ok) return toastError('مفيش هيكل نلتزم بيه');
      const keep = state.parsed.nodes.filter((node) => !state.excluded.has(node.id));
      if (!keep.length) return toastError('كل العُقَد مستبعَدة');
      decided = {
        ok: true,
        proposal: state.parsed,
        excluded: [...state.excluded],
      };
      return close();
    },
  });

  return decided;
}

/* ================================================================== *
 * الرسم
 * ================================================================== */

/**
 * تقريرُ الاستيراد (بند ١١٧) — **ولا شيءَ مخفيّ**.
 */
function reportHtml(parsed) {
  const kinds = Object.entries(parsed.counts.byKind)
    .map(([marker, n]) => `${n} ${LEVEL_LABEL[MARKERS.find((m) => m.marker === marker)?.level] || marker}`)
    .join(' · ');

  return html`
    <div class="sp-report">
      <p class="sp-found"><b>اكتشفنا:</b> ${kinds || '—'}</p>
      <p class="sp-dim">
        ${parsed.counts.nodes} عقدة · عمق ${parsed.counts.depth} ·
        ${parsed.accounting.textLines} سطر نصّ ·
        ${parsed.accounting.headingLines} سطر عنوان
      </p>
      <!--
        ⚠️ **حسابُ الأسطر معروضٌ لا مخفيّ** (بند ٩٣). «صفر سطر ضايع»
           دعوى تُقاس، ولو صارت غيرَ صفرٍ يومًا رأيتَها هنا قبل أن
           تلتزم — لا بعد أسبوعين وأنت تبحث عن فقرةٍ اختفت.
      -->
      <p class="sp-audit ${parsed.accounting.unassigned ? 'is-bad' : ''}">
        أسطر مش متحسِّبة: <b>${parsed.accounting.unassigned}</b>
      </p>
    </div>`;
}

function unknownHtml(parsed) {
  if (!parsed.unknown.length) return '';
  const options = MARKERS
    .map((row) => html`<button type="button" class="sp-lvl" data-sp="promote"
            data-sp-lvl="${row.level}">${LEVEL_LABEL[row.level]}</button>`)
    .join('');
  /* ⚠️ نصٌّ جاهزٌ يُحقَن بـ`raw` — و`html` تُهرِّب ما تُدخِله وإلّا طُبعت الوسوم. */

  return html`
    <!--
      ⚠️ **العنوانُ المجهول لا يُرمى ولا يُخمَّن** (بند ٣٠): يُعرَض
         ويُنتظَر قرارُك. وافتراضُه اليوم «نصّ عاديّ» — لأن ترك النصّ
         نصًّا لا يخسر شيئًا، والترقيةَ بلا إذنٍ تفتّت فقرة.
    -->
    <div class="sp-block">
      <h4>عناوين محتملة · نوع غير معروف (${parsed.unknown.length})</h4>
      <p class="sp-dim">دلوقتي بتتحسب <b>نصّ عادي</b>. لو واحد منها عنوان، اختار مستواه.</p>
      <ul class="sp-unknown">
        ${raw(parsed.unknown.map((row) => html`
          <li data-sp-at="${row.at}">
            <span class="sp-line" dir="auto">${row.line}</span>
            <span class="sp-lvls">${raw(options)}</span>
          </li>`).join(''))}
      </ul>
    </div>`;
}

function duplicatesHtml(parsed) {
  if (!parsed.duplicates.length) return '';
  return html`
    <!--
      ⚠️ **ولا يُدمَج شيءٌ بالاسم** (بند ٦٧): الاسمُ وصفٌ لا هُويّة.
    -->
    <div class="sp-block sp-warn">
      <h4>عناوين متكرّرة بين إخوة (${parsed.duplicates.length})</h4>
      <p class="sp-dim">هتتعمل عُقَد منفصلة — مش هيتدمجوا. استبعِد اللي مش عايزه.</p>
      <p class="sp-dups">${parsed.duplicates.map((row) => row.title).join(' · ')}</p>
    </div>`;
}

/**
 * حدودُ التقسيم لعقدةٍ — أسطرُ متنها، وأوّلُها لا يصلح حدًّا.
 */
function cutLinesHtml(node, parsed) {
  const lines = parsed.raw.split('\n');
  return html`
    <ul class="sp-cuts">
      <li class="sp-cuts-hint">المس السطر اللي يبدأ منه الجزء الجديد:</li>
      ${raw((node.bodyAt || []).map((at, i) => {
        const text = (lines[at] || '').trim();
        if (!text) return '';
        const first = i === 0;
        return html`
          <li>
            <button type="button" class="sp-cut ${first ? 'is-off' : ''}"
                    data-sp="cut-at" data-sp-at="${at}" ${first ? 'disabled' : ''}
                    dir="auto" title="${first ? 'أوّل سطر — هيسيب جزء فاضي' : 'قسّم من هنا'}">
              <span class="sp-cut-n">${first ? '—' : '✂'}</span>
              <span class="sp-cut-t">${text.slice(0, 70)}</span>
            </button>
          </li>`;
      }).join(''))}
    </ul>`;
}

function treeHtml(parsed, state) {
  const lines = parsed.raw.split('\n');
  return html`
    <div class="sp-block">
      <h4>الشجرة المقترَحة</h4>
      <ul class="sp-tree">
        ${raw(parsed.nodes.map((node, i) => {
          const off = Math.min(node.level, 6);
          const dropped = state.excluded.has(node.id);
          const dialogue = looksLikeDialogue(node.text || '');
          const open = state.cutting === node.id;
          const prev = parsed.nodes[i - 1];
          /*
           * ⚠️ **سياقٌ لا اسمٌ وحدَه** (بند ١٩): قرارُ الدمج والتقسيم
           *    لا يُتَّخذ من عنوانٍ مجرَّد. فأوّلُ سطرين من المتن معروضان،
           *    والجارُ الذي فوقه مذكور — وإلّا فأنت تقرّر وأنت أعمى.
           */
          const peek = (node.bodyAt || []).slice(0, 2)
            .map((at) => (lines[at] || '').trim()).filter(Boolean).join(' · ');

          return html`
          <li class="sp-node ${dropped ? 'is-out' : ''} ${open ? 'is-cutting' : ''}"
              data-sp-at="${node.at}" data-sp-id="${node.id}"
              style="--sp-off:${off}">
            <div class="sp-node-row">
              <button type="button" class="sp-skip" data-sp="skip"
                      aria-pressed="${dropped ? 'true' : 'false'}"
                      title="${dropped ? 'رجّعه' : 'استبعِده'}">${dropped ? '↺' : '✕'}</button>
              <span class="sp-kind">${LEVEL_LABEL[node.level] || node.marker}</span>
              <input class="sp-title" data-sp-rename="${node.at}"
                     value="${node.title}" dir="auto" aria-label="عنوان العقدة">
              <span class="sp-meta">
                ${(node.text || '').length} حرف${dialogue ? ' · 💬' : ''}${node.synthetic ? ' · مقسوم' : ''}
              </span>
            </div>
            ${raw(peek ? html`<p class="sp-peek" dir="auto">${peek}</p>` : '')}
            <div class="sp-node-acts">
              <button type="button" data-sp="out" title="ارفعه مستوى" aria-label="ارفعه مستوى">‹</button>
              <button type="button" data-sp="in" title="نزّله مستوى" aria-label="نزّله مستوى">›</button>
              <button type="button" data-sp="demote" title="خلّيه نصّ عادي" aria-label="خلّيه نصّ">¶</button>
              <button type="button" data-sp="cut-open"
                      aria-expanded="${open ? 'true' : 'false'}"
                      ${(node.bodyAt || []).length < 2 ? 'disabled' : ''}>قسّم</button>
              <button type="button" data-sp="merge-up"
                      ${prev ? '' : 'disabled'}
                      title="${prev ? `ادمجه في: ${prev.title}` : 'مفيش جزء قبله'}">ادمج فوق</button>
            </div>
            ${raw(open ? cutLinesHtml(node, parsed) : '')}
          </li>`;
        }).join(''))}
      </ul>
    </div>`;
}

function preambleHtml(parsed) {
  if (!parsed.preamble) return '';
  return html`
    <!--
      ⚠️ **ما قبل أوّلِ عنوانٍ يُعرَض ولا يُبتلَع** (بند ٩٣). هو نصٌّ
         كتبتَه، ولا عقدةَ له بعد — فيُقال ذلك صراحةً.
    -->
    <div class="sp-block sp-warn">
      <h4>نصّ قبل أوّل عنوان (${parsed.preamble.length} حرف)</h4>
      <p class="sp-dim">ده مش هيدخل أيّ عقدة. لو مهمّ، ارجع وحطّ له عنوان.</p>
      <pre class="sp-pre" dir="auto">${parsed.preamble.slice(0, 600)}</pre>
    </div>`;
}

function reviewHtml(parsed, state) {
  return html`
    ${raw(reportHtml(parsed))}
    ${raw(unknownHtml(parsed))}
    ${raw(duplicatesHtml(parsed))}
    ${raw(treeHtml(parsed, state))}
    ${raw(preambleHtml(parsed))}
    <details class="sp-details">
      <summary>النصّ الخام (${parsed.raw.length} حرف)</summary>
      <pre class="sp-pre" dir="auto">${parsed.raw.slice(0, 4000)}</pre>
    </details>
    <div class="sp-row">
      <button type="button" class="btn btn-ghost" data-sp="back">‹ رجوع للّصق</button>
    </div>`;
}

/**
 * ⚠️ **الفشلُ لا يُتلِف اللصق** (بند ١١٨).
 */
function failureHtml(parsed) {
  return html`
    <div class="sp-block sp-warn">
      <h4>مش قادر أحدّد الهيكل بأمان</h4>
      <p class="sp-dim">
        مالقيتش عناوين زي <code>PHASE 1</code> أو <code>PART 3</code>.
        نصُّك <b>محفوظ زيّ ما هو</b> — تقدر ترجع تظبّط العناوين،
        أو تضيفه نصًّا واحدًا من «+ نصّ».
      </p>
      <pre class="sp-pre" dir="auto">${parsed.raw.slice(0, 2000)}</pre>
    </div>
    <div class="sp-row">
      <button type="button" class="btn btn-ghost" data-sp="back">‹ رجوع وعدّل</button>
    </div>`;
}

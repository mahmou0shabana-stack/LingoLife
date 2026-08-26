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
    excluded: new Set(),
    parsed: null,
  };

  const reparse = () => {
    state.parsed = parsePaste(state.raw, {
      levels: state.levels,
      demote: state.demote,
      renames: state.renames,
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

function treeHtml(parsed, state) {
  return html`
    <div class="sp-block">
      <h4>الشجرة المقترَحة</h4>
      <ul class="sp-tree">
        ${raw(parsed.nodes.map((node) => {
          const off = Math.min(node.level, 6);
          const dropped = state.excluded.has(node.id);
          const dialogue = looksLikeDialogue(node.text || '');
          return html`
          <li class="sp-node ${dropped ? 'is-out' : ''}"
              data-sp-at="${node.at}" data-sp-id="${node.id}"
              style="--sp-off:${off}">
            <button type="button" class="sp-skip" data-sp="skip"
                    aria-pressed="${dropped ? 'true' : 'false'}"
                    title="${dropped ? 'رجّعه' : 'استبعِده'}">${dropped ? '↺' : '✕'}</button>
            <span class="sp-kind">${LEVEL_LABEL[node.level] || node.marker}</span>
            <input class="sp-title" data-sp-rename="${node.at}"
                   value="${node.title}" dir="auto" aria-label="عنوان العقدة">
            <span class="sp-meta">
              ${(node.text || '').length} حرف${dialogue ? ' · 💬 محادثة' : ''}
            </span>
            <span class="sp-nudge">
              <button type="button" data-sp="out" title="ارفعه مستوى">‹</button>
              <button type="button" data-sp="in" title="نزّله مستوى">›</button>
              <button type="button" data-sp="demote" title="خلّيه نصّ عادي">¶</button>
            </span>
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

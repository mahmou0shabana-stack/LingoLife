/**
 * LingoLife — ورشةُ مراجعة التصدير (WS-J · بندا ١٠ و٢٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **البندُ ٢٥ غيرُ قابلٍ للتفاوض: النصُّ يُرى قبل أن يُرسَل**
 * ═══════════════════════════════════════════════════════════════
 *
 * كان الزرُّ «صدّر ذاكرة اللغة» يبني ملفًّا ويعطيك إيّاه. فلا تعرف —
 * قبل أن تلصقه في محادثةٍ مع طرفٍ ثالث — ما الذي فيه بالضبط.
 *
 * وهذه ليست مسألةَ راحةٍ بل مسألةُ **ملكيّةٍ للبيانات**: النصوصُ هنا
 * تفريغاتُ مواقفَ حقيقيّةٍ من عملك وحياتك. فمن حقّك أن تفتح كلَّ نصٍّ
 * وتقرأه وتستبعده قبل أن يغادر جهازك.
 *
 * ولذلك ثلاثةُ أشياءَ في هذه الشاشة ليست تحسينًا:
 *   · فتحُ أيّ مصدرٍ وقراءةُ **نصّه الكامل** بمقاطعه ومتحدّثيه؛
 *   · إدراجُه أو استبعادُه بضغطة؛
 *   · وملخّصٌ صريحٌ يقول ماذا سيخرج وكم حجمُه قبل أيّ تصدير.
 *
 * ⚠️ **ولا يُعرَض JSON خامًّا كمعاينةٍ أساسيّة** (بند ٣٤): المستخدمُ
 *    يقرأ نصَّه الروسيَّ كما كتبه، لا صفًّا من قاعدة بيانات. والـJSON
 *    متاحٌ خلف تفصيلٍ ثانويٍّ لمن أراده.
 */

import { html, raw, formatBytes, copyToClipboard } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { withProgress } from '../components/progress.js';
import {
  EVIDENCE, EVIDENCE_LABEL, ORIGIN, ORIGIN_LABEL, classOfOrigin,
} from '../services/memory/provenance.js';
import {
  ANALYSIS_STATE, STATE_LABEL, listSources, scanSources, classifySource,
  setExcluded, readLiveSources, registrySummary,
} from '../services/memory/source-registry.js';
import {
  buildPackages, suggestSelection, analyzedHashesOf, MAX_CHARS,
} from '../services/memory/export-v2.js';
import { markSent } from '../services/memory/source-registry.js';
import { incrementalStatus } from '../services/memory/analysis-state.js';

/** المصافي — تُجمَع ولا تتنافى. */
const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'primary', label: 'أصلي' },
  { id: 'derived', label: 'مولَّد' },
  { id: 'unknown', label: 'غير محدَّد' },
  { id: 'new', label: 'جديد' },
  { id: 'changed', label: 'اتعدّل' },
  { id: 'analyzed', label: 'سبق تحليله' },
  { id: 'excluded', label: 'مستبعَد' },
];

const matches = (row, filter) => {
  switch (filter) {
    case 'primary': return row.evidenceClass === EVIDENCE.PRIMARY;
    case 'derived': return row.evidenceClass === EVIDENCE.DERIVED;
    case 'unknown': return row.evidenceClass === EVIDENCE.UNKNOWN;
    case 'new': return row.analysisState === ANALYSIS_STATE.NEVER;
    case 'changed': return row.analysisState === ANALYSIS_STATE.CHANGED;
    case 'analyzed': return row.analysisState === ANALYSIS_STATE.CURRENT;
    case 'excluded': return row.excluded === 1;
    default: return true;
  }
};

/**
 * يفتح ورشةَ المراجعة.
 *
 * ⚠️ **والمسحُ أوّلًا بتقدُّمٍ حقيقيّ** (بند ٢٧): على قاعدةٍ فيها مئاتُ
 *    النصوص، حسابُ البصمات ليس لحظيًّا. فيُعرَض «١٨ من ٣٢» لا دوّارةٌ
 *    صامتة.
 */
export async function openMemoryReview() {
  const scanned = await withProgress({
    key: 'memory-scan',
    title: 'ذاكرة اللغة',
    stages: ['بيدوّر على النصوص', 'بيحسب البصمات', 'بيقارن بالتحليل السابق'],
  }, async (bar) => {
    bar.stage(0).indeterminate('بيقرا مصادرك…');
    const live = await readLiveSources();
    bar.stage(1).set({ done: 0, total: live.length });

    const result = await scanSources({
      onProgress: ({ done, total, title }) =>
        bar.stage(1, `بيحسب بصمة: ${title || ''}`).set({ done, total }),
    });

    bar.stage(2).indeterminate('بيقارن بحالة التحليل…');
    const rows = await listSources();
    bar.done(`${rows.length} نص · ${result.added} جديد · ${result.changed} اتعدّل`);
    return rows;
  });

  if (scanned?.skipped) return null;

  const state = {
    rows: scanned,
    filter: 'all',
    selected: new Set(await suggestSelection()),
    /*
     * ⚠️ **وما نزعتَه بيدك يبقى منزوعًا.** الاقتراحُ يُعاد حسابُه بعد
     *    كلّ تصنيف، فبلا هذه المجموعةِ يعود ما استبعدتَه إلى الاختيار
     *    كلَّما صنّفتَ نصًّا آخرَ — وهو أسوأُ ما يمكن أن تفعله شاشةٌ
     *    مبنيّةٌ على أن الاختيارَ اختيارُك.
     */
    dropped: new Set(),
    open: null,
  };

  /**
   * يعيد قراءةَ السجلّ ويضمّ ما صار مقترَحًا.
   *
   * ⚠️ **بلا هذا كان التصنيفُ بلا أثر.** فتحتَ نصًّا مجهولًا وقلتَ إنه
   *    «تفريغُ موقفٍ حقيقيّ» — وهو الفعلُ الذي جئتَ من أجله — ثم ضغطتَ
   *    «جهّز الحزمة» فقيل لك «اختار نص واحد على الأقل»: لأن قائمةَ
   *    الاختيار حُسبت مرّةً عند الفتح حين كان كلُّ شيءٍ مجهولًا.
   */
  const refresh = async () => {
    state.rows = await listSources();
    for (const key of await suggestSelection()) {
      if (!state.dropped.has(key)) state.selected.add(key);
    }
    for (const row of state.rows) {
      if (row.excluded === 1 || row.missing === 1) state.selected.delete(row.id);
    }
  };

  return showModal({
    title: 'مراجعة التصدير — ذاكرة اللغة',
    wide: true,
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: '<div data-mr-root></div>',
    onMount(root) {
      const host = root.querySelector('[data-mr-root]');

      const paint = async () => {
        const [summary, inc] = await Promise.all([registrySummary(), incrementalStatus()]);
        const shown = state.rows.filter((row) => matches(row, state.filter));
        const chosen = state.rows.filter((row) => state.selected.has(row.id));
        const chars = chosen.reduce((sum, row) => sum + (row.chars || 0), 0);

        host.innerHTML = html`
          <div class="mr">
            <!-- ══ الملخّصُ قبل أيّ تصدير (بند ١٠) ══ -->
            <div class="mr-sum">
              <span><b>${summary.total}</b> نص متاح</span>
              <span><b>${summary.primary}</b> أصلي</span>
              <span><b>${summary.derived}</b> مولَّد</span>
              <span class="mr-warn"><b>${summary.unknown}</b> غير محدَّد</span>
              <span><b>${summary.current}</b> سبق تحليله</span>
            </div>

            <div class="mr-sum mr-sum-pick">
              <span>هيتصدّر: <b>${chosen.length}</b> نص</span>
              <span><b>${chars.toLocaleString('en')}</b> حرف</span>
              <span>${Math.max(1, Math.ceil(chars / MAX_CHARS))} حزمة</span>
              <span>مش هيتبعت تاني: <b>${summary.current}</b></span>
            </div>

            <!--
              ⚠️ **والجولةُ تقول أيَّ جولةٍ هي** (بند ٨). بلا هذا السطر
                 لا يعرف المستخدمُ لماذا صارت الحزمةُ الرابعةُ أصغرَ من
                 الأولى بعشرين ضعفًا، فيظنّ أن شيئًا سقط.
            -->
            <p class="mr-round">
              ${raw(inc.firstRun ? html`
                <b>أول جولة تحليل.</b> النصوص اللي هتختارها هتتبعت كاملة.`
    : html`
                <b>جولة تكميلية.</b> التحليل عارف
                ${inc.knownItems} عنصر من قبل، وحالتهم بتتبعت مضغوطة
                (${inc.stateChars.toLocaleString('en')} حرف) من غير أي
                نصّ. النصوص اللي سبق تحليلها مش هتتبعت تاني.`)}
              ${raw(inc.deleted ? html`
                <br>وفيه ${inc.deleted} نص اتشال بعد ما اتحلّل —
                هتتبعت شهادة حذفه عشان التحليل يسحب اللي بناه عليه.` : '')}
            </p>

            ${raw(summary.unknown ? html`
            <p class="mr-hint">
              فيه ${summary.unknown} نص لسه ما اتحدّدش أصلي ولا مولَّد.
              دول مش هيتحسبوا في «المواقف الحقيقية» لحد ما تحدّدهم.
            </p>` : '')}

            <div class="mr-filters">
              ${raw(FILTERS.map((f) => html`
                <button type="button" data-mr-filter="${f.id}"
                        class="${state.filter === f.id ? 'on' : ''}">${f.label}</button>`).join(''))}
            </div>

            <div class="mr-rows">
              ${raw(shown.map(rowHtml).join('') || '<p class="field-hint">مفيش نتايج للفلتر ده.</p>')}
            </div>

            <div class="btn-row mr-acts">
              <button type="button" class="btn" data-mr="export">جهّز الحزمة</button>
              <button type="button" class="btn btn-ghost" data-mr="import">استورد تحليل</button>
            </div>
          </div>`;
      };

      const rowHtml = (row) => {
        const cls = row.evidenceClass || EVIDENCE.UNKNOWN;
        const picked = state.selected.has(row.id);
        return html`
          <div class="mr-row ${picked ? 'is-on' : ''}" data-mr-row="${row.id}">
            <button type="button" class="mr-pick" data-mr-toggle="${row.id}"
                    aria-pressed="${picked}" aria-label="اختيار">${picked ? '✓' : ''}</button>
            <div class="mr-main">
              <button type="button" class="mr-title" data-mr-open="${row.id}">${row.title || '(بلا عنوان)'}</button>
              <div class="mr-tags">
                <span class="mr-tag is-${cls}">${EVIDENCE_LABEL[cls]}</span>
                <span class="mr-tag">${STATE_LABEL[row.analysisState]}</span>
                <span class="mr-tag mr-dim">${row.chars || 0} حرف</span>
              </div>
            </div>
            <button type="button" class="mr-ex" data-mr-exclude="${row.id}">
              ${row.excluded === 1 ? 'رجّع' : 'استبعد'}
            </button>
          </div>`;
      };

      host.addEventListener('click', async (event) => {
        const t = event.target;

        const filter = t.closest('[data-mr-filter]')?.dataset.mrFilter;
        if (filter) { state.filter = filter; return paint(); }

        const toggle = t.closest('[data-mr-toggle]')?.dataset.mrToggle;
        if (toggle) {
          if (state.selected.has(toggle)) {
            state.selected.delete(toggle);
            state.dropped.add(toggle);
          } else {
            state.selected.add(toggle);
            state.dropped.delete(toggle);
          }
          return paint();
        }

        const open = t.closest('[data-mr-open]')?.dataset.mrOpen;
        if (open) {
          return openSource(open, state, async () => {
            await refresh();
            return paint();
          });
        }

        const exclude = t.closest('[data-mr-exclude]')?.dataset.mrExclude;
        if (exclude) {
          const row = state.rows.find((r) => r.id === exclude);
          const next = row.excluded !== 1;
          await setExcluded(exclude, next);
          /* الاستبعادُ نزعٌ صريحٌ — فلا يعيده الاقتراحُ عند أوّل تحديث. */
          if (next) state.dropped.add(exclude);
          else state.dropped.delete(exclude);
          await refresh();
          return paint();
        }

        const act = t.closest('[data-mr]')?.dataset.mr;
        if (act === 'export') return runExport(state);
        if (act === 'import') {
          const { openAnalysisImport } = await import('./memory-import.js');
          return openAnalysisImport();
        }
        return null;
      });

      paint();
    },
  });
}

/* ------------------------------------------------------------------ *
 * معاينةُ نصٍّ كاملًا — البندُ ٢٥ بعينه
 * ------------------------------------------------------------------ */

async function openSource(key, state, repaint) {
  const live = await readLiveSources();
  const source = live.find((one) => one.key === key);
  const meta = state.rows.find((row) => row.id === key);
  if (!source) return toastError('النصّ ده مش موجود دلوقتي');

  return showModal({
    title: source.title || 'نصّ',
    wide: true,
    actions: [{ label: 'تمام', value: null, variant: 'ghost' }],
    body: html`
      <div class="mr-view">
        <div class="mr-meta" data-mr-meta>
          <span class="mr-tag is-${meta.evidenceClass}" data-mr-badge>${EVIDENCE_LABEL[meta.evidenceClass]}</span>
          <span class="mr-tag">${STATE_LABEL[meta.analysisState]}</span>
          <span class="mr-tag mr-dim">${meta.chars} حرف</span>
        </div>

        <!-- ══ التصنيف: قرارُك أنت، لا استنتاجُ التطبيق ══ -->
        <label class="field-label">ده نص إيه؟</label>
        <select data-mr-origin>
          ${raw(Object.values(ORIGIN).map((id) => html`
            <option value="${id}" ${meta.originType === id ? 'selected' : ''}>
              ${ORIGIN_LABEL[id]}</option>`).join(''))}
        </select>
        <p class="field-hint">
          «محتوى مولَّد» يتحلّل كمادّة تعليمية، ومش هيأثّر على عدد
          المواقف الحقيقية ولا على استخدامك الفعلي للّغة.
        </p>

        <!-- ══ النصُّ الكامل — مقروءًا لا JSON ══ -->
        <h4>النصّ الكامل</h4>
        <div class="mr-text" dir="ltr" lang="ru">
          ${raw(source.segments.map((seg) => html`
            <p class="mr-seg">
              ${raw(seg.speaker ? html`<b class="mr-spk">${String(seg.speaker)}</b>` : '')}
              ${seg.text}
            </p>`).join(''))}
        </div>

        <details class="mr-json">
          <summary>البيانات الخام (للتفصيل)</summary>
          <pre class="mx-pre" dir="ltr">${JSON.stringify(
    { key, meta: { ...meta }, segments: source.segments }, null, 2
  )}</pre>
        </details>
      </div>`,
    onMount(root) {
      root.querySelector('[data-mr-origin]')?.addEventListener('change', async (event) => {
        const originType = event.target.value;
        /* ⚠️ والصنفُ يُشتقّ من اختيارك أنت — لا من تخمينٍ على نصٍّ قديم. */
        const evidenceClass = classOfOrigin(originType);
        await classifySource(key, { originType, evidenceClass });

        /*
         * ⚠️ **والشارةُ التي تنظر إليها تتغيّر، لا التي خلفك.** كانت
         *    `repaint()` ترسم القائمةَ تحت هذه النافذة وحدَها، فتصنّف
         *    نصًّا وتبقى الشارةُ أمامك «غير محدَّد» — فتظنّ أن الاختيار
         *    لم يُسجَّل وتعيده.
         */
        const badge = root.querySelector('[data-mr-badge]');
        if (badge) {
          badge.className = `mr-tag is-${evidenceClass}`;
          badge.textContent = EVIDENCE_LABEL[evidenceClass];
        }

        toastOk('اتسجّل');
        await repaint();
      });
    },
  });
}

/* ------------------------------------------------------------------ *
 * التصدير
 * ------------------------------------------------------------------ */

async function runExport(state) {
  const selected = [...state.selected];
  if (!selected.length) return toast('اختار نص واحد على الأقل');

  const built = await withProgress({
    key: 'memory-export',
    title: 'تجهيز حزمة التحليل',
    stages: ['بيقرا المصادر', 'بيجمع النصوص', 'بيقسّم الحزم', 'جاهزة'],
  }, async (bar) => {
    const STEP = { read: 0, collect: 1, split: 2, done: 3 };
    return buildPackages({
      selected,
      onProgress: (p) => {
        bar.stage(STEP[p.stage] ?? 0, p.label);
        if (p.total > 1) bar.set({ done: p.done, total: p.total });
      },
    }).then((result) => {
      bar.done(`${result.summary.selected} نص · ${result.packages.length} حزمة`);
      return result;
    });
  });

  if (built?.skipped) return null;
  return showPackages(built);
}

function showPackages({ packages, summary }) {
  const texts = packages.map((pkg) => JSON.stringify(pkg, null, 2));
  const bytes = texts.reduce((sum, t) => sum + new Blob([t]).size, 0);

  return showModal({
    title: 'الحزمة جاهزة',
    wide: true,
    actions: [{ label: 'اقفل', value: null, variant: 'ghost' }],
    body: html`
      <div class="mr-out">
        <div class="mr-sum">
          <span><b>${summary.selected}</b> نص</span>
          <span><b>${summary.selectedNew}</b> جديد</span>
          <span><b>${summary.selectedChanged}</b> اتعدّل</span>
          <span><b>${summary.reused}</b> مش هيتبعت تاني</span>
          <span>${formatBytes(bytes)}</span>
        </div>
        ${raw(summary.selectedDerived ? html`
        <p class="mr-hint">
          فيه ${summary.selectedDerived} نص مولَّد جوّه الحزمة. هيتحلّل
          كمادّة تعليمية، ومش هيأثّر على المواقف الحقيقية ولا على
          استخدامك الفعلي.
        </p>` : '')}
        ${raw(packages.length > 1 ? html`
        <p class="field-hint">
          الحزم اتقسمت لـ${packages.length} أجزاء عشان الحجم. ابعت كل
          جزء لوحده بالترتيب.
        </p>` : '')}
        <div class="mr-parts">
          ${raw(packages.map((pkg, i) => html`
            <div class="mr-part">
              <span>جزء ${i + 1} من ${packages.length} · ${pkg.sources.length} نص</span>
              <button type="button" class="btn btn-sm" data-mr-copy="${i}">انسخ</button>
            </div>`).join(''))}
        </div>
        <p class="field-hint">
          بعد ما التحليل يرجّعلك النتيجة، افتح «استورد تحليل» عشان
          تراجعها قبل ما تتسجّل.
        </p>
      </div>`,
    onMount(root) {
      root.addEventListener('click', async (event) => {
        const at = event.target.closest('[data-mr-copy]')?.dataset.mrCopy;
        if (at === undefined) return;
        const index = Number(at);
        const ok = await copyToClipboard(texts[index]);
        if (!ok) return toastError('مقدرناش ننسخ');
        /*
         * ⚠️ **يُسجَّل «أُرسِل» ولا يُسجَّل «حُلِّل».** النسخُ ليس تحليلًا:
         *    لو علّمناه محلَّلًا لَبدا نصٌّ نسختَه ولم تحلّله محلَّلًا فلا
         *    يُقترَح ثانيةً أبدًا. لكنّ النسخَ **هو** لحظةُ مغادرة الحزمة
         *    الجهازَ، فتُحفَظ بصمتُها إيصالًا (`markSent`) ليعرف
         *    الاستيرادُ لاحقًا أيَّ نصٍّ قرأه التحليلُ بالضبط — لا أيَّ
         *    نصٍّ في القاعدة الآن. راجع ترويسة `markSent`.
         */
        await markSent(analyzedHashesOf([packages[index]]));
        return toastOk('اتنسخ — الصقه في التحليل');
      });
    },
  });
}

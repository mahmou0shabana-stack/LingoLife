/**
 * LingoLife — مراجعةُ نتيجة التحليل قبل تسجيلها (WS-J · بندا ١٢ و٢٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **بابٌ لا منطق** — والمحرّكُ في `import-v2.js`
 * ═══════════════════════════════════════════════════════════════
 *
 * هذا الملفُّ لا يقرّر شيئًا: `parseAnalysis` تفصل ما لا يُقبَل،
 * و`planImport` تفتح كلَّ استشهادٍ على نصّه وتعيد العدَّ، و`applyImport`
 * تكتب. وهنا **عرضٌ وضغطة**. والسببُ أن كلَّ ما يقرّر قابلٌ للاختبار
 * بلا متصفّح، وكلُّ ما هنا ليس كذلك.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والفصلُ الذي يجب أن يُرى بالعين: اقتراحٌ ≠ واقعة**
 * ═══════════════════════════════════════════════════════════════
 *
 * في كلّ بطاقةٍ عمودان لا واحد:
 *
 *   ما قاله التحليل        ادّعاءٌ — العددُ والمعنى والسجلّ
 *   ما وجده التطبيق        واقعةٌ — مواضعُ محسوبةٌ من نصوصك تُفتَح
 *
 * ولو دُمجا في سطرٍ واحد («١٢ ظهورًا») لَما أمكن بعد شهرٍ أن يعرف أحدٌ
 * أيُّهما قال الرقم. والفصلُ هنا هو نفسُه البندُ ٢ في الواجهة.
 *
 * ⚠️ **ولا زرَّ «اقبل الكل» بلا مراجعة.** يبدو تسهيلًا، وهو في الحقيقة
 *    إلغاءٌ للشاشة كلِّها: من ضغطه مرّةً سيضغطه دائمًا. والقبولُ
 *    الافتراضيُّ موجودٌ للسليم، والمحجوبُ يُفتَح بيدك.
 */

import { html, raw, copyToClipboard } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { withProgress } from '../components/progress.js';
import { VERIFY, VERIFY_LABEL } from '../services/memory/counting.js';
import { CONTRACT } from '../services/memory/export-v2.js';
import {
  parseAnalysis, planImport, applyImport, importTotals,
  VERDICT, VERDICT_LABEL, ITEM_TYPE_LABEL,
} from '../services/memory/import-v2.js';

/**
 * يفتح شاشةَ الاستيراد: لصقٌ أو ملفّ، ثم مراجعة.
 */
/**
 * يعيد تفعيلَ زرِّ الإرسال بعد خروجٍ مبكِّرٍ من `onSubmit`.
 *
 * ⚠️ **وإلّا مات الزرُّ إلى الأبد.** `showModal` تعطّله قبل نداء
 *    `onSubmit` وتعيد تفعيلَه **عند الرمي وحدَه**. فكلُّ خروجٍ مؤدَّبٍ
 *    («الصق النتيجة الأول»، «مفيش حاجة موافق عليها») كان يترك النافذةَ
 *    مفتوحةً بزرٍّ لا يُضغَط: يصلّح المستخدمُ ما نبّهناه عليه ثم لا يجد
 *    بابًا. وهو عطبٌ صامتٌ لأن كلَّ شيءٍ آخرَ يبدو سليمًا.
 */
const rearm = (root) => {
  const button = root?.querySelector('button[type="submit"]');
  if (button) button.disabled = false;
};

export async function openAnalysisImport() {
  let text = '';
  let formRoot = null;

  const chosen = await showModal({
    title: 'استورد نتيجة التحليل',
    wide: true,
    submitLabel: 'راجع النتيجة',
    body: html`
      <div class="mi-in">
        <p class="field-hint">
          الصق ردّ التحليل كامل هنا، أو اختار الملفّ اللي نزّلته.
          <b>التطبيق مش بيكلّم أي ذكاء اصطناعي</b> — الملفّ بيخرج بإيدك
          وبيرجع بإيدك.
        </p>

        <input type="file" accept="application/json,.json,.txt" data-mi-file>

        <label class="field-label">أو الصقه هنا</label>
        <textarea data-mi-text rows="8" dir="ltr" spellcheck="false"
                  placeholder='{"format":"living-language-analysis","version":2,…}'></textarea>

        <details class="mi-schema">
          <summary>الشكل المطلوب من التحليل</summary>
          <p class="field-hint">
            ده نفس الشكل اللي بيتبعت جوّه الحزمة — مش محتاج تنسخه، بس
            لو التحليل رجّع حاجة تانية هتلاقي الفرق من هنا.
          </p>
          <button type="button" class="btn btn-sm btn-ghost" data-mi="copy-schema">
            انسخ الشكل
          </button>
          <pre class="mx-pre" dir="ltr">${JSON.stringify(CONTRACT.responseFormat, null, 2)}</pre>
        </details>
      </div>`,
    onMount(root) {
      formRoot = root;
      const area = root.querySelector('[data-mi-text]');

      root.querySelector('[data-mi-file]')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        area.value = await file.text();
        toastOk(`اتقرا: ${file.name}`);
      });

      root.querySelector('[data-mi="copy-schema"]')?.addEventListener('click', async () => {
        const ok = await copyToClipboard(JSON.stringify(CONTRACT.responseFormat, null, 2));
        return ok ? toastOk('اتنسخ') : toastError('مقدرناش ننسخ');
      });
    },
    onSubmit(_data, close) {
      /*
       * ⚠️ **والقراءةُ من العنصر لا من `FormData`.** المحتوى قد يأتي من
       *    ملفٍّ كُتب في المربّع برمجيًّا، و`FormData` تقرؤه — لكنّ اسمَ
       *    الحقل لو نُسي مرّةً لَعاد فارغًا بصمت. فالمصدرُ واحدٌ صريح.
       */
      const area = formRoot?.querySelector('[data-mi-text]');
      text = area?.value || '';
      if (!text.trim()) {
        rearm(formRoot);
        return toast('الصق النتيجة الأول');
      }
      return close();
    },
  });

  if (chosen !== 'submit') return null;
  return reviewAnalysis(text);
}

/* ------------------------------------------------------------------ *
 * المراجعة
 * ------------------------------------------------------------------ */

async function reviewAnalysis(text) {
  let parsed;
  try {
    parsed = parseAnalysis(text);
  } catch (error) {
    return toastError(error.message);
  }
  if (!parsed.items.length) {
    return toastError('الملفّ مفيهوش عناصر صالحة.');
  }

  const plan = await withProgress({
    key: 'memory-import-plan',
    title: 'بيراجع نتيجة التحليل',
    stages: ['بيقرا نصوصك', 'بيتحقّق من الاستشهادات', 'بيعيد العدّ'],
  }, async (bar) => {
    bar.stage(0).indeterminate('بيقرا مصادرك…');
    return planImport({
      parsed,
      onProgress: ({ done, total, label }) => {
        bar.stage(2, `بيعدّ: ${label || ''}`).set({ done, total });
      },
    }).then((built) => {
      bar.done(`${built.summary.total} عنصر · ${built.summary.blocked} محجوب`);
      return built;
    });
  });

  if (plan?.skipped) return null;

  const state = { plan, filter: 'all', open: new Set() };
  let formRoot = null;

  return showModal({
    title: 'راجع التحليل قبل ما يتسجّل',
    wide: true,
    submitLabel: 'سجّل اللي وافقت عليه',
    body: '<div data-mi-root></div>',
    onMount(root) {
      formRoot = root;
      const host = root.querySelector('[data-mi-root]');

      const paint = () => {
        const { summary } = state.plan;
        const rows = state.plan.rows.filter((row) =>
          state.filter === 'all' || row.verdict === state.filter);
        const totals = importTotals(state.plan.rows);

        host.innerHTML = html`
          <div class="mi">
            <div class="mr-sum">
              <span><b>${summary.total}</b> عنصر</span>
              <span><b>${summary.added}</b> جديد</span>
              <span><b>${summary.updated}</b> هيتحدّث</span>
              <span class="mr-warn"><b>${summary.review}</b> محتاج مراجعة</span>
              <span class="mi-bad"><b>${summary.blocked}</b> استشهاد ما ثبتش</span>
            </div>

            <!--
              ⚠️ **والأرقامُ مفصولةٌ هنا كما في القاعدة** (بند ٢): «مواقف
                 حقيقية» عددُ النصوص الأصليّة المختلفة، و«ظهورات مولَّدة»
                 رقمٌ آخرُ لا يُجمَع معه أبدًا.
            -->
            <div class="mr-sum mr-sum-pick">
              <!--
                ⚠️ **وهذا صفُّ «ما ستوافق عليه» لا صفُّ الملفّ كلِّه.**
                   بلا هذه الكلمة يقرأ القارئُ أصفارًا بجانب بطاقاتٍ
                   تعرض أعدادًا فيظنّ العدَّ معطوبًا، والحقيقةُ أنه لم
                   يوافق على شيءٍ بعد.
              -->
              <span><b>${totals.items}</b> هيتسجّل</span>
              <span>مواقف حقيقية: <b>${totals.realSituations}</b></span>
              <span>ظهورات في نصّ أصلي: <b>${totals.rawOccurrences}</b></span>
              <span>ظهورات في محتوى مولَّد: <b>${totals.derivedAppearances}</b></span>
              <span class="mr-warn">في مصادر غير محدَّدة: <b>${totals.unknownOccurrences}</b></span>
            </div>

            ${raw(summary.evidenceRejected ? html`
            <p class="mi-warn">
              ${summary.evidenceRejected} استشهاد مش موجود في نصوصك —
              اتشالوا خالص ومش هيتسجّلوا ولا لو وافقت على العنصر.
            </p>` : '')}

            ${raw(state.plan.dropped.length ? html`
            <details class="mi-dropped">
              <summary>
                ${state.plan.dropped.length} حقل التحليل حاول يكتبهم وإحنا رفضناهم
              </summary>
              <p class="field-hint">
                دي حقول التطبيق لوحده اللي بيحسبها من نصوصك: عدد المواقف
                الحقيقية، وكام مرّة اتدرّبت، وإمتى قابلت الكلمة أول مرّة.
              </p>
              <ul class="mi-list">
                ${raw(state.plan.dropped.map((one) => html`
                  <li><code>${one.field}</code> في <b dir="ltr">${one.key}</b></li>`).join(''))}
              </ul>
            </details>` : '')}

            ${raw(state.plan.warnings.length ? html`
            <details class="mi-dropped">
              <summary>${state.plan.warnings.length} ملاحظة على الملفّ</summary>
              <ul class="mi-list">
                ${raw(state.plan.warnings.map((one) => html`<li>${one}</li>`).join(''))}
              </ul>
            </details>` : '')}

            <div class="mr-filters">
              <button type="button" data-mi-filter="all"
                      class="${state.filter === 'all' ? 'on' : ''}">الكل</button>
              <button type="button" data-mi-filter="${VERDICT.CLEAN}"
                      class="${state.filter === VERDICT.CLEAN ? 'on' : ''}">سليم</button>
              <button type="button" data-mi-filter="${VERDICT.REVIEW}"
                      class="${state.filter === VERDICT.REVIEW ? 'on' : ''}">محتاج مراجعة</button>
              <button type="button" data-mi-filter="${VERDICT.BLOCKED}"
                      class="${state.filter === VERDICT.BLOCKED ? 'on' : ''}">استشهاد ما ثبتش</button>
            </div>

            <div class="mi-rows">
              ${raw(rows.map(cardHtml).join('') || '<p class="field-hint">مفيش عناصر هنا.</p>')}
            </div>
          </div>`;
      };

      const cardHtml = (row) => {
        const open = state.open.has(row.key);
        const m = row.measured;
        return html`
          <div class="mi-card is-${row.verdict} ${row.accept ? 'is-on' : ''}">
            <div class="mi-head">
              <button type="button" class="mr-pick" data-mi-toggle="${row.key}"
                      aria-pressed="${row.accept}" aria-label="موافقة">${row.accept ? '✓' : ''}</button>
              <button type="button" class="mi-name" data-mi-open="${row.key}">
                <b dir="ltr" lang="ru">${row.item.lemma || row.key}</b>
                <span class="mr-tag mr-dim">${ITEM_TYPE_LABEL[row.item.itemType]}</span>
                <span class="mr-tag is-${row.verdict}">${VERDICT_LABEL[row.verdict]}</span>
                ${raw(row.isNew ? '<span class="mr-tag">جديد</span>' : '<span class="mr-tag">تحديث</span>')}
              </button>
            </div>

            <!-- ══ عمودان: ادّعاءٌ ثم واقعة ══ -->
            <div class="mi-two">
              <div class="mi-side">
                <h5>اللي التحليل قاله</h5>
                <p class="mi-claim">
                  ${raw(row.count.claimed === null
    ? 'ما ذكرش عدد'
    : html`عدّ <b>${row.count.claimed}</b> ظهور`)}
                </p>
                ${raw(row.item.meaningAr ? html`<p>${row.item.meaningAr}</p>` : '')}
                ${raw(row.item.register || row.item.domain ? html`
                  <p class="mr-dim">${[row.item.register, row.item.domain].filter(Boolean).join(' · ')}</p>` : '')}
                ${raw(Number.isFinite(row.item.confidence) ? html`
                  <p class="mr-dim">درجة يقينه: ${row.item.confidence}</p>` : '')}
              </div>

              <div class="mi-side">
                <h5>اللي التطبيق لقاه في نصوصك</h5>
                <p class="mi-fact">
                  <b>${m.rawOccurrences}</b> في نصّ أصلي ·
                  <b>${m.realSituations}</b> موقف حقيقي
                </p>
                <p class="mr-dim">
                  ${m.derivedAppearances} في محتوى مولَّد ·
                  ${m.unknownOccurrences} في مصادر غير محدَّدة
                </p>
                <!--
                  ⚠️ **و«١ و١» ليست رسالة.** حين يتّفق الرقمان ويختلف
                     الموضعُ كان السطرُ يقول «التحليل ١ والتطبيق ١»
                     فيبدو خطأً في الشاشة لا في البيانات. فالفرقُ
                     يُسمّى بنوعه: عددٌ مختلف، أو موضعٌ مختلف.
                -->
                <p class="mi-verify is-${row.count.status}">
                  ${VERIFY_LABEL[row.count.status]}
                  ${raw(row.count.status !== VERIFY.REVIEW ? '' : (
    row.count.claimed === row.count.counted
      ? html` — العدد واحد بس المواضع مختلفة`
      : html` — التحليل ${row.count.claimed} والتطبيق ${row.count.counted}`))}
                </p>
              </div>
            </div>

            ${raw(row.onlyUnknown ? html`
            <p class="mi-warn">
              كل مواضعها في مصادر لسه ما اتحدّدش إذا كانت أصلية ولا
              مولَّدة — فمش هتتحسب في المواقف الحقيقية.
            </p>` : '')}

            ${raw(row.evidence.rejected.length ? html`
            <div class="mi-bad-box">
              <b>${row.evidence.rejected.length} استشهاد ما ثبتش على النصّ:</b>
              <ul class="mi-list">
                ${raw(row.evidence.rejected.map((one) => html`
                  <li>
                    <span class="mi-why">${one.why}</span>
                    <code dir="ltr">${one.sourceKey} · ${one.segmentId}</code>
                    ${raw(one.quote ? html`<q dir="ltr" lang="ru">${one.quote}</q>` : '')}
                  </li>`).join(''))}
              </ul>
            </div>` : '')}

            ${raw(open ? html`
            <div class="mi-hits">
              <h5>المواضع اللي التطبيق عدّها (${row.hits.length})</h5>
              ${raw(row.hits.length ? row.hits.map((hit) => html`
                <p class="mr-seg" dir="ltr" lang="ru">
                  <span class="mr-dim" dir="rtl">${hit.sourceKey}</span>
                  ${hit.quote}
                </p>`).join('') : '<p class="field-hint">مفيش ولا موضع — الكلمة دي مش في نصوصك.</p>')}
            </div>` : '')}
          </div>`;
      };

      host.addEventListener('click', (event) => {
        const t = event.target;

        const filter = t.closest('[data-mi-filter]')?.dataset.miFilter;
        if (filter) { state.filter = filter; return paint(); }

        const toggle = t.closest('[data-mi-toggle]')?.dataset.miToggle;
        if (toggle) {
          const row = state.plan.rows.find((one) => one.key === toggle);
          row.accept = !row.accept;
          return paint();
        }

        const open = t.closest('[data-mi-open]')?.dataset.miOpen;
        if (open) {
          if (state.open.has(open)) state.open.delete(open);
          else state.open.add(open);
          return paint();
        }
        return null;
      });

      paint();
    },

    async onSubmit(_data, close) {
      const accepted = state.plan.rows.filter((row) => row.accept);
      if (!accepted.length) {
        rearm(formRoot);
        return toast('مفيش حاجة موافق عليها — وافق على عنصر واحد على الأقل.');
      }

      const done = await withProgress({
        key: 'memory-import-apply',
        title: 'بيسجّل التحليل',
        stages: ['بيسجّل العناصر', 'بيسجّل النصوص المحلَّلة', 'خلص'],
      }, async (bar) => {
        const STEP = { items: 0, sources: 1, done: 2 };
        return applyImport(state.plan, {
          onProgress: (p) => {
            bar.stage(STEP[p.stage] ?? 0, p.label);
            if (p.total > 1) bar.set({ done: p.done, total: p.total });
          },
        }).then((result) => {
          bar.done(`${result.added} جديد · ${result.updated} اتحدّث`);
          return result;
        });
      });

      /* ألغى شريطَ التقدُّم — النافذةُ تبقى، والزرُّ يعود صالحًا. */
      if (done?.skipped) {
        rearm(formRoot);
        return null;
      }

      close();
      /*
       * ⚠️ **و«ما لم يُعلَّم» يُقال لا يُبتلَع.** نصٌّ حلّله الذكاءُ لكنّه
       *    لم يخرج من هذا الجهاز (وصل من جهازٍ آخر مثلًا) لا نعرف أيَّ
       *    نسخةٍ منه قُرئت — فيبقى «جديدًا» ويُقترَح ثانيةً. وسكوتُنا
       *    عن ذلك يجعله يبدو عطبًا.
       */
      if (done.unmarked) {
        toast(`${done.unmarked} نص اتحلّل بس مش هيتعلّم — الحزمة بتاعته ما خرجتش من الجهاز ده.`);
      }
      return toastOk(
        `اتسجّل: ${done.added} جديد · ${done.updated} تحديث · ${done.evidenceRows} موضع دليل`
      );
    },
  });
}

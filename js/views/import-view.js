/**
 * LingoLife — استيراد مشهدٍ مُجهَّز: المعاينة قبل الالتزام (بند 36)
 *
 * ثلاث مراحل لا رابعة: **الصق → عايِن → استورد**.
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا معاينةٌ أصلًا؟
 * ═══════════════════════════════════════════════════════════════
 *
 * لأن الاستيراد يكتب في **ذاكرتك**، لا في ملفٍّ تعيد فتحه. حزمةٌ
 * فيها ثمانيةَ عشرَ تعبيرًا واثنتا عشرة جملة تدخل بضغطةٍ واحدة —
 * وإصلاحها بعد ذلك ثمانيةَ عشرَ فتحًا وحذفًا.
 *
 * فالشاشة تجيب أربعة أسئلة قبل أي كتابة:
 *
 *  · **إيه اللي جاي؟** أعدادٌ حقيقية محسوبةٌ من المقروء لا من
 *    المكتوب في الحزمة.
 *  · **إيه اللي هيتعمل جديد وإيه اللي هيتوصّل بحاجة عندك؟** ولكل
 *    قرارٍ سببه المكتوب.
 *  · **إيه اللي مش هيدخل؟** ما استبعدتَه أنت، وما لا يستوعبه
 *    التطبيق أصلًا — بسببه لا بصمت.
 *  · **إيه اللي مش مفهوم في الحزمة؟** تحذيرات القراءة بأرقام
 *    عناصرها.
 *
 * ولا رقمَ هنا بلا مصدر: كل عددٍ يُحسَب من القرارات في لحظة عرضه،
 * فلو استبعدتَ سبعة نزل الرقم سبعة (بند 89).
 */

import { html, raw, $, esc, downloadBlob } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { navigate } from '../router.js';
import { parsePackage } from '../services/import/parse.js';
import { planImport, decide, ACTION } from '../services/import/plan.js';
import { kindName } from '../services/import/package-format.js';
import { plural, counted } from '../utils/plural.js';
import { applyImport } from '../services/import/apply.js';
import {
  buildAnalysisRequest, requestSummary, requestFilename,
} from '../services/analysis/request.js';
import { confirmAction } from '../components/modal.js';

/**
 * حالة الشاشة.
 *
 * ⚠️ خارج الرسم عمدًا: الشاشة تُعاد كتابتها بالكامل عند كل تبديل
 *    خانة، ولو عاشت الحالة في الـ DOM لضاعت مع أول إعادة رسم.
 *    وتموت عند مغادرة الشاشة — حزمةٌ نصف مراجَعة لا تستحقّ البقاء.
 */
let state = { stage: 'paste', text: '', issues: [], pkg: null, plan: null, report: null };

export function resetImport() {
  state = { stage: 'paste', text: '', issues: [], pkg: null, plan: null, report: null };
}

/* ------------------------------------------------------------------ *
 * قطع العرض
 * ------------------------------------------------------------------ */

const KIND_LABEL = {
  scene: 'الذكرى',
  eventType: 'نوع الحدث',
  person: 'شخص',
  eventThread: 'الخيط',
  script: 'سكريبت',
  conversationPart: 'جملة محادثة',
  mistake: 'تصحيح',
  expression: 'تعبير',
};

function actionChip(decision) {
  if (decision.action === ACTION.USE_EXISTING) {
    return html`<span class="imp-chip is-reuse">هيتوصّل بالموجود</span>`;
  }
  if (decision.action === ACTION.ATTACH) {
    return html`<span class="imp-chip is-reuse">هيتكتب جوّه ذكرى موجودة</span>`;
  }
  return html`<span class="imp-chip is-new">جديد</span>`;
}

/**
 * صفّ قرارٍ واحد.
 *
 * الخانة والسبب والبدائل في مكانٍ واحد: القرار وسببه لا يُفصَلان،
 * وإلا صار الاختيار تخمينًا.
 */
function decisionRow(decision, { toggle = true } = {}) {
  const alternatives = decision.alternatives || [];
  return html`
    <div class="imp-row${decision.include ? '' : ' is-off'}">
      <label class="imp-pick">
        <input type="checkbox" data-imp-toggle="${decision.id}"
               ${decision.include ? 'checked' : ''} ${toggle ? '' : 'disabled'}>
        <span class="imp-label"><bdi>${decision.label || '—'}</bdi></span>
      </label>
      <div class="imp-meta">
        ${raw(actionChip(decision))}
        <span class="imp-why">${decision.why}</span>
      </div>
      ${raw(alternatives.length ? html`
        <div class="imp-alts">
          <span class="imp-alts-head">${
            decision.action === ACTION.CREATE
              ? 'فيه حاجة شبهه عندك — تحبّ توصّله بيها؟'
              : 'أو وصّله بـ:'
          }</span>
          ${raw(alternatives.map((a) => html`
            <button class="imp-alt" data-imp-link="${decision.id}" data-target="${a.id}">
              <bdi>${a.label}</bdi>
              <em>${a.why}</em>
            </button>`).join(''))}
          ${raw(decision.action === ACTION.CREATE ? '' : html`
            <button class="imp-alt is-plain" data-imp-unlink="${decision.id}">
              لأ — اعمله جديد
            </button>`)}
        </div>` : '')}
    </div>`;
}

/** قسمٌ كامل: عنوانه، وعدده المحسوب الآن، وصفوفه. */
function section(title, decisions, options = {}) {
  if (!decisions.length) return '';
  const on = decisions.filter((d) => d.include).length;
  return html`
    <section class="imp-section">
      <h3>
        ${title}
        <span class="imp-count">${on === decisions.length
          ? on
          : `${on} من ${decisions.length}`}</span>
      </h3>
      ${raw(decisions.map((d) => decisionRow(d, options)).join(''))}
    </section>`;
}

/** ما لا يستوعبه التطبيق — مُعلَنًا بسببه، لا مبتلَعًا صامتًا. */
function cannotAbsorb(items) {
  if (!items.length) return '';
  return html`
    <section class="imp-section is-muted">
      <h3>مش هيدخل — والسبب مكتوب</h3>
      <p class="imp-note">
        دي حاجات في الحزمة التطبيق لسه ما بيعرضهاش. استيرادها يعني
        كتابة بيانات ما فيش شاشة تفتحها — فتفتكرها وصلت وهي مش
        موجودة. سايبينها بره وقايلينلك.
      </p>
      ${raw(items.map((item) => html`
        <div class="imp-row is-muted">
          <span class="imp-label">${kindName(item.kind)}</span>
          <div class="imp-meta">
            <span class="imp-chip">${item.count}</span>
            <span class="imp-why">${item.reason}</span>
          </div>
        </div>`).join(''))}
    </section>`;
}

/** تحذيرات القراءة: عنصرٌ استُبعد لنقصٍ فيه، بترتيبه في الحزمة. */
function issueList(issues) {
  const warnings = issues.filter((i) => i.level === 'warn');
  if (!warnings.length) return '';
  return html`
    <section class="imp-section is-warn">
      <h3>حاجات مش مفهومة في الحزمة</h3>
      ${raw(warnings.map((w) => html`
        <div class="imp-row is-muted">
          <span class="imp-label">${w.message}</span>
        </div>`).join(''))}
    </section>`;
}

/* ------------------------------------------------------------------ *
 * المراحل
 * ------------------------------------------------------------------ */

function pasteStage() {
  const fatal = state.issues.filter((i) => i.level === 'fatal');
  return html`
    <div class="view-head">
      <h1>استيراد مشهد مُجهَّز</h1>
      <div class="sub">من تحليلٍ خارجي — تعاين الأول، وتستورد بعدين</div>
    </div>

    <div class="card imp-intro">
      <p>
        لو حوّلت تفريغ موقف أو صوره لحزمة تحليل بره التطبيق، الصقها
        هنا. هنقراها ونوريك بالظبط إيه اللي هيتكتب في ذكرياتك — وإيه
        اللي مش هيدخل وليه — <b>قبل</b> ما نكتب أي حاجة.
      </p>
    </div>

    ${raw(fatal.length ? html`
      <div class="card imp-fatal">
        <b>الحزمة دي ما ينفعش نقراها</b>
        ${raw(fatal.map((f) => html`<p>${f.message}</p>`).join(''))}
      </div>` : '')}

    <textarea class="imp-paste" data-imp-text
              placeholder="الصق محتوى الحزمة (JSON) هنا…"
              dir="ltr" spellcheck="false">${state.text}</textarea>

    <div class="imp-actions">
      <button class="btn btn-ghost" data-action="import-file">
        ${raw(icon('upload'))} اختار ملف
      </button>
      <button class="btn btn-primary" data-action="import-check">افحص الحزمة</button>
    </div>`;
}

function previewStage() {
  const plan = state.plan;
  const summary = plan.summary;
  const newCount = Object.values(summary.created).reduce((a, b) => a + b, 0);
  const reuseCount = Object.values(summary.reused).reduce((a, b) => a + b, 0);

  return html`
    <div class="view-head">
      <h1>معاينة قبل الاستيراد</h1>
      <div class="sub"><bdi>${plan.scene.label}</bdi></div>
    </div>

    <div class="card imp-summary">
      <div class="imp-figure">
        <b>${newCount}</b>
        <span>${plural(newCount, 'حاجة جديدة', 'حاجتين جداد', 'حاجات جديدة')}</span>
      </div>
      <div class="imp-figure">
        <b>${reuseCount}</b>
        <span>هيتوصّل بحاجة عندك</span>
      </div>
      <div class="imp-figure${summary.excluded ? ' is-off' : ''}">
        <b>${summary.excluded}</b>
        <!--
          «مستبعَد» بلا «باختيارك»: بعضه اختيارك وبعضه بدأ مطفأً —
          متحدّثٌ لم تعرّفه الحزمة مثلًا. ونسبةُ فعلٍ لمن لم يفعله
          كذبةٌ صغيرة لكنها كذبة.
        -->
        <span>مش هيتكتب</span>
      </div>
    </div>

    ${raw(section('الذكرى', [plan.scene], { toggle: false }))}
    ${raw(section('نوع الحدث', [plan.eventType]))}
    ${raw(plan.eventThread ? section('الخيط', [plan.eventThread]) : '')}
    ${raw(section('الأشخاص', plan.people))}
    ${raw(plan.extraSpeakers.length ? html`
      <section class="imp-section">
        <h3>
          اتكلّموا في المحادثة والحزمة ما عرّفتهمش
          <span class="imp-count">${plan.extraSpeakers.filter((d) => d.include).length}
            من ${plan.extraSpeakers.length}</span>
        </h3>
        <p class="imp-note">
          مش لازم تعملهم دلوقتي: اسم المتحدّث بيتحفظ زي ما هو في
          المحادثة، وتقدر تربطه بشخص في أي وقت من «مين بيتكلم».
        </p>
        ${raw(plan.extraSpeakers.map((d) => decisionRow(d)).join(''))}
      </section>` : '')}
    ${raw(section('السكريبتات', plan.scripts))}
    ${raw(section('المحادثة', plan.conversationParts))}
    ${raw(section('التصحيحات', plan.mistakes))}
    ${raw(section('التعبيرات', plan.expressions))}
    ${raw(issueList(state.issues))}
    ${raw(cannotAbsorb(plan.cannotAbsorb))}

    <div class="imp-actions is-sticky">
      <button class="btn btn-ghost" data-action="import-back">ارجع</button>
      <button class="btn btn-primary" data-action="import-apply"
              ${summary.empty ? 'disabled' : ''}>
        استورد
      </button>
    </div>`;
}

function reportStage() {
  const report = state.report;
  /*
   * ⚠️ الأنواع التي لها اسمٌ عندك وحدها.
   *
   * الدفتر يسجّل معها صفوفًا داخليّة — نسخة السكريبت الأولى، كتلة
   * النصّ الأصلي، ظهور التعبير، علاقة الخيط بالذكرى — وهي ليست
   * أشياءَ استوردتَها بل أجزاءٌ ممّا استوردتَه. عرضُها يعني عدّ
   * السكريبت مرّتين. تبقى في الدفتر لأن التراجع يحتاجها، ولا تظهر
   * هنا لأن العدّ المزدوج رقمٌ كاذب (بند 89).
   */
  const rows = Object.entries(report.written)
    .filter(([kind]) => KIND_LABEL[kind])
    .map(([kind, n]) => html`<li><b>${n}</b> ${KIND_LABEL[kind]}</li>`)
    .join('');

  if (!report.ok) {
    return html`
      <div class="view-head"><h1>الاستيراد ما تمّش</h1></div>
      <div class="card imp-fatal">
        <p>${report.failed}</p>
        <p class="imp-note">
          ما اتكتبش حاجة في ذكرياتك — كل اللي اتكتب اتشال تاني، عشان
          ما تفضلش عندك ذكرى ناقصة تفتكرها كاملة.
        </p>
      </div>
      <div class="imp-actions">
        <button class="btn btn-primary" data-action="import-back">ارجع للمعاينة</button>
      </div>`;
  }

  return html`
    <div class="view-head">
      <h1>تمّ الاستيراد</h1>
      <div class="sub">ده اللي اتكتب فعلًا</div>
    </div>

    <div class="card">
      <ul class="imp-report">${raw(rows || '<li>ما اتكتبش حاجة</li>')}</ul>
      ${raw(report.notes.length ? html`
        <div class="imp-note">
          ${raw(report.notes.map((n) => html`<p>${n}</p>`).join(''))}
        </div>` : '')}
    </div>

    ${raw(cannotAbsorb(report.cannotAbsorb))}

    <div class="imp-actions">
      <button class="btn btn-ghost" data-action="import-new">استورد حزمة تانية</button>
      <button class="btn btn-primary" data-action="import-open"
              data-id="${report.sceneId}">افتح الذكرى</button>
    </div>`;
}

export async function renderImport(main) {
  if (state.stage === 'preview' && state.plan) main.innerHTML = previewStage();
  else if (state.stage === 'report' && state.report) main.innerHTML = reportStage();
  else main.innerHTML = pasteStage();
}

/* ------------------------------------------------------------------ *
 * الأفعال — تُستدعى من `app.js`
 * ------------------------------------------------------------------ */

async function rerender() {
  const main = $('#app-main');
  if (main) await renderImport(main);
}

/** يقرأ ما في المربّع قبل أي إعادة رسم — وإلا ضاع ما كتبتَه. */
function captureText() {
  const box = $('[data-imp-text]');
  if (box) state.text = box.value;
}

export async function handleImportAction(action, target) {
  /*
   * تصدير طلب تحليل *(WS6-ب)*.
   *
   * ⚠️ هنا لأن **الردّ يعود من هذه الشاشة نفسها**: الطلب يخرج، وما
   *    يعود حزمةُ استيرادٍ عاديّة تمرّ بالمعاينة كأي حزمة. وضعُه في
   *    ملفٍّ ثالث يفصل شقّي رحلةٍ واحدة.
   */
  if (action === 'analysis-request') {
    const sceneId = target?.dataset.id;
    if (!sceneId) return true;

    const request = await buildAnalysisRequest(sceneId);
    const summary = requestSummary(request);

    /*
     * ⚠️ **يُقال ما سيخرج قبل أن يخرج** — بعدده لا بوصفٍ عامّ. الملفّ
     *    فيه نصوص ذكراك وأسماء مَن تكلّم، والتطبيق لا يعرف إلى أين
     *    ستأخذه. «موافق» على المجهول ليست موافقة.
     */
    const bits = [
      summary.scripts && counted(summary.scripts, 'سكريبت', 'سكريبتين', 'سكريبتات'),
      summary.conversation
        && counted(summary.conversation, 'جزء محادثة', 'جزأين من المحادثة', 'أجزاء محادثة'),
      summary.expressions && counted(summary.expressions, 'تعبير', 'تعبيرين', 'تعبيرات'),
      summary.mistakes && counted(summary.mistakes, 'تصحيح', 'تصحيحين', 'تصحيحات'),
      summary.hasNotes && 'ملاحظاتك',
    ].filter(Boolean);

    const who = summary.speakers.length
      ? ` وأسماء: ${summary.speakers.join('، ')}.`
      : '';

    const ok = await confirmAction({
      title: 'الملف ده هيطلع من جهازك',
      message:
        `هيتحفظ ملف فيه <strong>${esc(summary.title)}</strong>: `
        + `${bits.length ? esc(bits.join('، ')) : 'العنوان والتاريخ بس'}.${esc(who)}`
        + '<br><br>التطبيق <strong>مش هيبعته لحدّ</strong> — هيحفظه على جهازك وبس. '
        + 'إنت اللي تديه لأي محلِّل تختاره، وساعتها بيخرج من عندك. '
        + '<br><br>وردّه بترجّعه من نفس الشاشة دي، وهتشوف كل سطر قبل ما يتكتب.',
      confirmLabel: 'احفظ الملف',
    });
    if (!ok) return true;

    downloadBlob(
      new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' }),
      requestFilename(request)
    );
    toastOk('اتحفظ — افتحه، انسخه لأي محلِّل، ورجّع ردّه هنا');
    return true;
  }

  if (action === 'import-file') {
    const file = await pickJson();
    if (!file) return true;
    state.text = await file.text();
    return check();
  }

  if (action === 'import-check') {
    captureText();
    return check();
  }

  if (action === 'import-back') {
    state.stage = 'paste';
    state.report = null;
    await rerender();
    return true;
  }

  if (action === 'import-new') {
    resetImport();
    await rerender();
    return true;
  }

  if (action === 'import-open') {
    const id = target?.dataset.id;
    resetImport();
    navigate(id ? `/scene/${id}` : '/life');
    return true;
  }

  if (action === 'import-apply') {
    const dismiss = toast('بيتكتب…', { duration: 60_000 });
    try {
      state.report = await applyImport(state.plan, state.pkg);
      state.stage = 'report';
      if (state.report.ok) toastOk('اتكتب في ذكرياتك');
      else toastError('ما تمّش — وما اتكتبش حاجة');
    } catch (error) {
      toastError(error.message);
    } finally {
      dismiss();
    }
    await rerender();
    return true;
  }

  return false;
}

/** فحص النصّ الملصوق ثم التخطيط — الرفض هنا بسببه لا بصمت. */
async function check() {
  const { ok, pkg, issues } = parsePackage(state.text || '');
  state.issues = issues;

  if (!ok) {
    state.pkg = null;
    state.plan = null;
    state.stage = 'paste';
    await rerender();
    return true;
  }

  state.pkg = pkg;
  state.plan = await planImport(pkg);
  state.stage = 'preview';
  await rerender();
  return true;
}

/**
 * تبديل خانةٍ أو ربطٍ ببديل.
 *
 * ⚠️ يمرّ بـ`decide` لا بالتعديل المباشر: هي التي ترفض فعلًا مجهولًا
 *    أو «وصّله بالموجود» بلا هدف، وهي التي تُعيد حساب الأرقام.
 */
export async function handleImportChange(element) {
  const id = element.dataset.impToggle;
  if (!id || !state.plan) return false;
  state.plan = decide(state.plan, id, { include: element.checked });
  await rerender();
  return true;
}

export async function handleImportLink(element) {
  if (!state.plan) return false;

  const linkId = element.dataset.impLink;
  if (linkId) {
    state.plan = decide(state.plan, linkId, {
      action: ACTION.USE_EXISTING,
      targetId: element.dataset.target,
    });
    await rerender();
    return true;
  }

  const unlinkId = element.dataset.impUnlink;
  if (unlinkId) {
    state.plan = decide(state.plan, unlinkId, { action: ACTION.CREATE });
    await rerender();
    return true;
  }

  return false;
}

/** منتقي ملفات — نفس نمط شاشة الإعدادات. */
function pickJson() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,.txt';
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    // الإلغاء لا يُطلق حدثًا في كل المتصفحات — نعتمد على عودة التركيز.
    window.addEventListener(
      'focus',
      () => setTimeout(() => resolve(input.files?.[0] || null), 400),
      { once: true }
    );
    input.click();
  });
}

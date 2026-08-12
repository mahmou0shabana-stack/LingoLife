/**
 * LingoLife — مكتبة الطلبات (WS11/WS12 · الملحق H + C)
 *
 * ثلاثة أسئلة تسألها لمادّتك، وكلُّها تعود **بنفس الحزمة** فتمرّ بنفس
 * المعاينة. ولا مسارَ ثانٍ يلتفّ حول الاستيراد (C5).
 *
 * ⚠️ **والشاشة تقول ما يخرج قبل أن يخرج.** الملفّ فيه نصوصك بالروسي
 *    والعربي وأسماء مَن تكلّم، والتطبيق لا يعرف إلى أين ستأخذه.
 */

import { html, raw, $, esc, downloadBlob, copyToClipboard } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { toastOk, toastError } from '../components/toast.js';
import { confirmAction, showModal } from '../components/modal.js';
import { navigate, refresh } from '../router.js';
import { scenes } from '../db/repositories.js';
import {
  PROMPTS, NOT_A_PROMPT, NEVER_ASKED, promptById, promptCard,
  buildPrompt, previewInstructions, requestSummary, requestFilename,
  extraInstructions, setExtraInstructions,
} from '../services/prompts/library.js';
import { CONTRACT_VERSION } from '../services/prompts/contract.js';

/**
 * حالة الشاشة — خارج الرسم عمدًا: الشاشة تُعاد كتابتها كاملةً.
 */
let state = { open: null, material: '', hint: '', date: '', sceneId: '' };

export function resetPrompts() {
  state = { open: null, material: '', hint: '', date: '', sceneId: '' };
}

/* ------------------------------------------------------------------ *
 * القطع
 * ------------------------------------------------------------------ */

function card(prompt, mine) {
  const info = promptCard(prompt);
  const open = state.open === prompt.id;

  return html`
    <section class="pr-card${open ? ' is-open' : ''}">
      <button class="pr-head" data-action="prompt-open" data-id="${prompt.id}">
        <span class="pr-title">${info.label}</span>
        <span class="pr-ver">نسخة ${info.version}</span>
      </button>
      <p class="pr-purpose">${info.purpose}</p>

      <div class="pr-returns">
        <b>بيرجع بـ:</b> ${info.returns.join(' · ')}
      </div>

      ${raw(info.omitted.length ? html`
        <details class="pr-omit">
          <summary>وفيه حاجات مش بنطلبها في الطلب ده — وليه</summary>
          <dl class="pr-why-list">
            ${raw(info.omitted.map((row) => html`
              <dt>${row.kind}</dt><dd>${row.why}</dd>`).join(''))}
          </dl>
        </details>` : '')}

      ${raw(mine ? html`
        <div class="pr-mine">
          <b>تعليماتك:</b> ${mine}
        </div>` : '')}

      ${raw(open ? body(prompt) : '')}

      <div class="pr-actions">
        ${raw(open ? '' : html`
          <button class="mini-btn" data-action="prompt-open" data-id="${prompt.id}">
            ${raw(icon('play', 14))} استعمله
          </button>`)}
        <button class="mini-btn" data-action="prompt-extra" data-id="${prompt.id}">
          ${raw(icon('edit', 14))} ${mine ? 'عدّل تعليماتك' : 'ضيف تعليماتك'}
        </button>
        <button class="mini-btn" data-action="prompt-peek" data-id="${prompt.id}">
          ${raw(icon('eye', 14))} شوف التعليمات كلها
        </button>
      </div>
    </section>`;
}

/** جسمُ الطلب المفتوح — يختلف بحسب ما يحتاجه. */
function body(prompt) {
  if (prompt.needs === 'material') {
    return html`
      <div class="pr-body">
        <label class="pr-label" for="pr-material">
          الصق التفريغ أو الملاحظات أو أي نصّ من الموقف
        </label>
        <textarea id="pr-material" class="pr-material" data-pr-material
          placeholder="اللي اتقال، أو اللي كتبته وقتها، أو نصّ نقلته من ورقة…"
          spellcheck="false">${state.material}</textarea>

        <div class="pr-row">
          <input class="pr-input" data-pr-hint value="${state.hint}"
            maxlength="200" placeholder="الموقف كان إيه؟ (اختياري)">
          <input class="pr-input pr-date" data-pr-date type="date" value="${state.date}">
        </div>

        <p class="pr-note">
          ⚠️ الردّ هيعدّي على <b>نفس المعاينة</b> بتاعة الاستيراد — هتشوف
          كل سطر قبل ما يتكتب، والتطبيق هيوريك لو فيه ذكرى شبهها عندك.
        </p>

        <button class="btn btn-primary" data-action="prompt-build" data-id="${prompt.id}">
          ${raw(icon('download'))} اعمل الطلب
        </button>
      </div>`;
  }

  return html`
    <div class="pr-body">
      <label class="pr-label" for="pr-scene">اختار الذكرى</label>
      <select id="pr-scene" class="pr-input" data-pr-scene>
        <option value="">— اختار —</option>
        ${raw(state.sceneOptions || '')}
      </select>

      <p class="pr-note">
        ⚠️ معرّف الذكرى بيتبعت مع الطلب، فالردّ بيرجع <b>عليها هي</b> مش
        على ذكرى جديدة.
      </p>

      <button class="btn btn-primary" data-action="prompt-build" data-id="${prompt.id}">
        ${raw(icon('download'))} اعمل الطلب
      </button>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * الشاشة
 * ------------------------------------------------------------------ */

export async function renderPrompts(main) {
  const [mine, sceneRows] = await Promise.all([
    extraInstructions(),
    scenes.page({ index: 'date', direction: 'prev', limit: 60 }),
  ]);

  state.sceneOptions = sceneRows
    .map((row) => html`
      <option value="${row.id}"${row.id === state.sceneId ? ' selected' : ''}>
        ${row.titleAr || row.titleRu || 'ذكرى بلا عنوان'} — ${row.date || ''}
      </option>`)
    .join('');

  main.innerHTML = html`
    <div class="view-head">
      <h1>مكتبة الطلبات</h1>
      <div class="sub">
        ٣ طلبات · كلها بتردّ بنفس الحزمة (عقد ${CONTRACT_VERSION}) وبتعدّي على نفس المعاينة
      </div>
    </div>

    <div class="card pr-intro">
      <p>
        التطبيق <b>مش بيتّصل بحاجة ومفيهوش مفتاح</b>. بيعمل ملف طلب،
        وإنت اللي تديه لأي محلِّل تختاره، وترجّع ردّه في
        <a href="#/import">شاشة الاستيراد</a>.
      </p>
    </div>

    ${raw(PROMPTS.map((prompt) => card(prompt, mine[prompt.id])).join(''))}

    <details class="sec pr-limits">
      <summary>وفيه أسئلة مابنعملهاش طلب — وليه</summary>
      <dl class="pr-why-list">
        ${raw(NOT_A_PROMPT.map((row) => html`
          <dt>${row.label}</dt><dd>${row.why}</dd>`).join(''))}
      </dl>
    </details>

    <details class="sec pr-limits">
      <summary>وحاجات مابنطلبهاش من أي محلِّل خالص — وليه</summary>
      <dl class="pr-why-list">
        ${raw(NEVER_ASKED.map((row) => html`
          <dt>${row.label}</dt><dd>${row.why}</dd>`).join(''))}
      </dl>
    </details>`;
}

/* ------------------------------------------------------------------ *
 * الأفعال
 * ------------------------------------------------------------------ */

/** يقرأ ما في الخانات قبل أي إعادة رسم — وإلا ضاع ما كتبتَه. */
function capture() {
  const material = $('[data-pr-material]');
  if (material) state.material = material.value;
  const hint = $('[data-pr-hint]');
  if (hint) state.hint = hint.value;
  const date = $('[data-pr-date]');
  if (date) state.date = date.value;
  const scene = $('[data-pr-scene]');
  if (scene) state.sceneId = scene.value;
}

/**
 * ما سيخرج — بعدده لا بوصفٍ عامّ.
 *
 * ⚠️ «موافق» على المجهول ليست موافقة. وهي نفس الجملة التي حكمت
 *    WS6-ب، وتبقى هنا لأنها لم تكن عن طلبٍ بعينه بل عن **ما يخرج**.
 */
async function confirmExport(request) {
  const summary = requestSummary(request);

  const what = summary.rawChars
    ? `المادّة الخام اللي لصقتها (<strong>${summary.rawChars}</strong> حرف)`
    : [
        summary.scripts && `${summary.scripts} سكريبت`,
        summary.conversation && `${summary.conversation} جزء محادثة`,
        summary.expressions && `${summary.expressions} تعبير`,
        summary.mistakes && `${summary.mistakes} تصحيح`,
        summary.hasNotes && 'ملاحظاتك',
      ].filter(Boolean).join('، ') || 'العنوان والتاريخ بس';

  const who = summary.speakers.length
    ? ` وأسماء: ${summary.speakers.join('، ')}.`
    : '';

  return confirmAction({
    title: 'الملف ده هيطلع من جهازك',
    message:
      `طلب «<strong>${esc(summary.promptLabel)}</strong>» فيه `
      + `${esc(summary.title)}: ${what}.${esc(who)}`
      + '<br><br>التطبيق <strong>مش هيبعته لحدّ</strong> — هيحفظه على جهازك وبس. '
      + 'إنت اللي تديه لأي محلِّل تختاره، وساعتها بيخرج من عندك. '
      + '<br><br>وردّه بترجّعه في شاشة الاستيراد، وهتشوف كل سطر قبل ما يتكتب.',
    confirmLabel: 'احفظ الملف',
  });
}

/** إجراءات مكتبة الطلبات — تُستدعى من app.js. */
export async function handlePromptsAction(action, id, target) {
  const promptId = target?.dataset?.id;

  if (action === 'prompt-open') {
    capture();
    state.open = state.open === promptId ? null : promptId;
    await refresh();
    return true;
  }

  if (action === 'prompt-peek') {
    const prompt = promptById(promptId);
    if (!prompt) return true;
    /*
     * ⚠️ التعليمات تُعرَض **كما تُرسَل** لا موصوفةً. أن تقرأ ما سيقرؤه
     *    المحلِّل هو الفرق بين أداةٍ تفهمها وصندوقٍ تثق فيه.
     *
     * ⚠️ وبلا ذكرى ولا مادّة: التعليمات لا تعتمد عليهما. وأوّل كتابةٍ
     *    بنَت طلبًا كاملًا بمعرّفٍ وهميّ فرمى ولم تُفتَح النافذة.
     */
    const text = (await previewInstructions(promptId)).join('\n');
    await showModal({
      title: `تعليمات «${prompt.label}»`,
      wide: true,
      body: html`
        <p class="pr-peek-note">
          دي بالإنجليزي لأن اللي بيقراها نموذج مش إنت. والشكل ده
          <b>مولَّد</b> من صيغة الحزمة — مش مكتوب بإيد.
        </p>
        <pre class="pr-peek" dir="ltr">${text}</pre>`,
      actions: [
        { label: 'انسخ', value: 'copy', variant: 'ghost' },
        { label: 'تمام', value: null, variant: 'primary' },
      ],
    }).then((value) => {
      if (value === 'copy') {
        copyToClipboard(text);
        toastOk('اتنسخت');
      }
    });
    return true;
  }

  if (action === 'prompt-extra') {
    const prompt = promptById(promptId);
    if (!prompt) return true;
    const all = await extraInstructions();

    let typed = null;
    const done = await showModal({
      title: `تعليماتك لـ«${prompt.label}»`,
      body: html`
        <p style="color:var(--ink-soft);line-height:1.8;font-size:var(--fs-sm)">
          بتتضاف <b>بعد</b> القواعد الأساسية ومابتلغيهاش — عشان سطر منك
          مايقدرش يمسح «ماتخترعش وقايع».
        </p>
        <textarea name="extra" class="pr-material" rows="5"
          placeholder="مثلًا: ركّز على لغة المخازن والشحن، وسيبك من الرسمي.">${all[promptId] || ''}</textarea>`,
      submitLabel: 'احفظ',
      onSubmit: (data, finish) => {
        typed = data.extra;
        finish();
      },
    });
    if (done !== 'submit') return true;

    await setExtraInstructions(promptId, typed);
    toastOk(String(typed || '').trim() ? 'اتحفظت' : 'اتشالت');
    await refresh();
    return true;
  }

  if (action === 'prompt-build') {
    capture();
    const prompt = promptById(promptId);
    if (!prompt) return true;

    let request;
    try {
      request = await buildPrompt(promptId, {
        sceneId: state.sceneId,
        material: state.material,
        hint: state.hint,
        date: state.date,
      });
    } catch (err) {
      toastError(err.message || 'مقدرناش نعمل الطلب');
      return true;
    }

    if (!(await confirmExport(request))) return true;

    downloadBlob(
      new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' }),
      requestFilename(request)
    );
    toastOk('اتحفظ — افتحه، انسخه لأي محلِّل، ورجّع ردّه في الاستيراد');
    return true;
  }

  /*
   * «جهّزني» من داخل الذكرى — طلبٌ من المكتبة بلا مرورٍ بالشاشة.
   *
   * ⚠️ وهو **نفس المسار** لا اختصارًا حوله: نفس البناء، ونفس التأكيد
   *    الذي يقول ما سيخرج، ونفس الردّ الذي يعود بالمعاينة.
   */
  if (action === 'rehearse-request') {
    const sceneId = target?.dataset?.id;
    if (!sceneId) return true;

    let request;
    try {
      request = await buildPrompt('rehearse', { sceneId });
    } catch (err) {
      toastError(err.message || 'مقدرناش نعمل الطلب');
      return true;
    }
    if (!(await confirmExport(request))) return true;

    downloadBlob(
      new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' }),
      requestFilename(request)
    );
    toastOk('اتحفظ — رجّع ردّه في شاشة الاستيراد');
    return true;
  }

  if (action === 'prompt-library') {
    navigate('/prompts');
    return true;
  }

  return false;
}

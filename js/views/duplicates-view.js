/**
 * LingoLife — شاشة المكرَّر (WS14 · الملحق G)
 *
 * ⚠️ **شاشةٌ تقترح ولا تفعل.** لا زرَّ «اضمّ كل المتشابه»، ولا فعلَ
 *    جَماعيّ إطلاقًا. كل زوجٍ قرارٌ وحده، لأن الغلطة هنا تخلط كلام
 *    شخصين — وهي غلطةٌ لا تُكتشَف بعد شهر.
 *
 * وثلاثة أفعالٍ لا أكثر: **اضمّهم** · **مش هما** · **سيبهم**.
 * والثالث هو الافتراضيّ ولا يحتاج زرًّا.
 */

import { html, raw } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { toastOk, toastError } from '../components/toast.js';
import { confirmAction } from '../components/modal.js';
import { refresh } from '../router.js';
import {
  SCOPES, NOT_DEDUPED, scanAll, mergePair, markDifferent, unmarkDifferent,
  judgements, scopeById,
} from '../services/similarity/duplicates.js';
import { VERDICT } from '../services/similarity/engine.js';

/** الأزواج المعروضة الآن — نقرأ منها عند الضغط بدل إعادة الاستعلام. */
let shown = new Map();

/** المجال المفتوح — يبقى بين الرسمات. */
let openScope = null;

/** هل نعرض ما قلتَ عنه «مش هما»؟ */
let showDismissed = false;

/* ------------------------------------------------------------------ *
 * القطع
 * ------------------------------------------------------------------ */

const VERDICT_CLASS = {
  [VERDICT.CERTAIN]: 'is-certain',
  [VERDICT.LIKELY]: 'is-likely',
  [VERDICT.MAYBE]: 'is-maybe',
};

function side(entry) {
  return html`
    <div class="dup-side">
      <div class="dup-name">${entry.label}</div>
      ${raw(entry.hint ? html`<div class="dup-hint">${entry.hint}</div>` : '')}
    </div>`;
}

/**
 * ⚠️ **أزرارُ القرار في صفٍّ واحد** لا زرٌّ تحت كل اسم.
 *
 * الأوّل كان يضع «خلّي ده» تحت كلٍّ، فيصير ارتفاع العمودين مختلفًا
 * حين يكون لأحدهما وصفٌ وللآخر لا — والأهمّ أن القرار **واحدٌ بين
 * ثلاثة**، فصفٌّ واحد يقوله أصدق من زرّين متباعدين.
 *
 * وكلٌّ يحمل **الاسم في نصّه** لا «ده»: ضغطةٌ خاطئة هنا تدمج شخصين.
 */
function decisions(pair, scope) {
  const keep = (entry, other) => html`
    <button class="mini-btn" data-action="dup-merge"
      data-key="${pair.key}" data-keep="${entry.id}" data-drop="${other.id}">
      ${raw(icon('check', 14))} خلّي «${entry.label}»
    </button>`;

  return html`
    <div class="dup-actions">
      ${raw(scope.merge && !pair.dismissed
        ? keep(pair.a, pair.b) + keep(pair.b, pair.a)
        : '')}
      ${raw(pair.dismissed
        ? html`<button class="mini-btn" data-action="dup-undismiss" data-key="${pair.key}">
            ${raw(icon('restore', 14))} رجّعه للاقتراحات
          </button>`
        : html`<button class="mini-btn" data-action="dup-different" data-key="${pair.key}">
            مش هما
          </button>`)}
    </div>`;
}

function pairCard(pair, scope) {
  return html`
    <div class="dup-pair ${VERDICT_CLASS[pair.verdict] || ''}${pair.dismissed ? ' is-dismissed' : ''}">
      <div class="dup-verdict">${pair.verdictLabel}</div>

      <div class="dup-sides">
        ${raw(side(pair.a))}
        <div class="dup-vs">؟</div>
        ${raw(side(pair.b))}
      </div>

      <ul class="dup-why">
        ${raw(pair.why.map((line) => html`<li>${line}</li>`).join(''))}
      </ul>

      ${raw(decisions(pair, scope))}
    </div>`;
}

function scopeSection(group) {
  const scope = scopeById(group.id);
  if (!group.pairs.length) {
    /*
     * ⚠️ والرسالة تفرّق بين الحالتين. «مفيش مكرَّر» في وضع المراجعة
     *    كذبٌ صغير: فيه، لكنك قلت عنه «مش هما».
     */
    return html`
      <div class="dup-clean">
        ${raw(icon('check', 16))}
        ${showDismissed
          ? `مفيش حاجة قلت عنها «مش هما» في ${group.label}`
          : `مفيش مكرَّر في ${group.label}`}
      </div>`;
  }

  return html`
    ${raw(scope.merge
      ? html`<p class="dup-note">⚠️ الضمّ: ${scope.mergeHint}</p>`
      : html`<p class="dup-note">⚠️ ${scope.whyNoMerge}</p>`)}
    ${raw(group.pairs.map((pair) => pairCard(pair, scope)).join(''))}`;
}

/* ------------------------------------------------------------------ *
 * الشاشة
 * ------------------------------------------------------------------ */

export async function renderDuplicates(main) {
  const [scan, dismissedKeys] = await Promise.all([
    scanAll(),
    judgements(),
  ]);

  // ولو كنّا نعرض المرفوض نُعيد القراءة شاملةً — سؤالٌ ثانٍ لا فلترة.
  const groups = showDismissed
    ? await Promise.all(SCOPES.map(async (scope) => {
        const { findDuplicates } = await import('../services/similarity/duplicates.js');
        return {
          id: scope.id,
          label: scope.label,
          pairs: (await findDuplicates(scope.id, { includeDismissed: true }))
            .filter((pair) => pair.dismissed),
        };
      }))
    : scan.scopes;

  shown = new Map();
  for (const group of groups) for (const pair of group.pairs) shown.set(pair.key, pair);

  const current = groups.find((group) => group.id === openScope) || groups[0];
  openScope = current?.id || null;

  main.innerHTML = html`
    <div class="view-head">
      <h1>المكرَّر</h1>
      <div class="sub">
        ${scan.total ? `${scan.total} زوج محتاج قرارك` : 'مفيش حاجة مكرَّرة'}
        · مفيش حاجة بتتدمج لوحدها
      </div>
    </div>

    <div class="chip-row">
      ${raw(groups.map((group) => html`
        <button class="chip${group.id === openScope ? ' is-on' : ''}"
          data-action="dup-scope" data-scope="${group.id}">
          ${group.label}
          <span class="chip-n">${group.pairs.length}</span>
        </button>`).join(''))}
    </div>

    ${raw(current ? scopeSection(current) : '')}

    ${raw(dismissedKeys.size || showDismissed
      ? html`
        <button class="mini-btn dup-toggle" data-action="dup-toggle-dismissed">
          ${showDismissed
            ? 'رجّع للاقتراحات المفتوحة'
            : `شوف الـ${dismissedKeys.size} اللي قلت عنهم «مش هما»`}
        </button>`
      : '')}

    <details class="sec dup-limits">
      <summary>وفيه حاجات مش بنكشف فيها مكرَّر — وليه</summary>
      <dl class="dup-why-list">
        ${raw(NOT_DEDUPED.map((entry) => html`
          <dt>${entry.label}</dt>
          <dd>${entry.why}</dd>`).join(''))}
      </dl>
    </details>`;
}

/* ------------------------------------------------------------------ *
 * الأفعال
 * ------------------------------------------------------------------ */

/** إجراءات شاشة المكرَّر — تُستدعى من app.js. */
export async function handleDuplicatesAction(action, id, target) {
  const key = target?.dataset?.key;

  if (action === 'dup-scope') {
    openScope = target.dataset.scope;
    await refresh();
    return true;
  }

  if (action === 'dup-toggle-dismissed') {
    showDismissed = !showDismissed;
    await refresh();
    return true;
  }

  if (action === 'dup-different' || action === 'dup-undismiss') {
    const pair = shown.get(key);
    if (!pair) return true;
    const fn = action === 'dup-different' ? markDifferent : unmarkDifferent;
    await fn(pair.scopeId, pair.a.id, pair.b.id);

    /*
     * ⚠️ والتراجع يُخرجك من وضع المراجعة. طلبتَ رجوعه للاقتراحات —
     *    فيُعرَض هناك. وإبقاؤك في قائمةٍ يختفي منها للتوّ بلا كلمة
     *    يجعل الزرّ يبدو كأنه حذفه. (كشفَه المتصفّح لا الاختبار.)
     */
    if (action === 'dup-undismiss') showDismissed = false;
    toastOk(action === 'dup-different' ? 'خلاص، مش هنقترحهم تاني' : 'رجعوا للاقتراحات');
    await refresh();
    return true;
  }

  if (action === 'dup-merge') {
    const pair = shown.get(key);
    if (!pair) return true;
    const scope = scopeById(pair.scopeId);
    const keepId = target.dataset.keep;
    const dropId = target.dataset.drop;
    const keep = pair.a.id === keepId ? pair.a : pair.b;
    const drop = pair.a.id === dropId ? pair.a : pair.b;

    /*
     * ⚠️ التأكيد يقول **ما سيحدث بالاسم** لا «هل أنت متأكد؟». والسؤال
     *    المجرّد يُضغط عليه «نعم» بلا قراءة.
     */
    const ok = await confirmAction({
      title: 'اضمّهم في واحد',
      message: `«${drop.label}» هيتضمّ في «${keep.label}».<br><br>${scope.mergeHint}.`
        + '<br><br>ده مش بيتلغى بضغطة — بس مفيش حاجة بتتحذف.',
      confirmLabel: 'اضمّهم',
      danger: true,
    });
    if (!ok) return true;

    try {
      await mergePair(pair.scopeId, keepId, dropId, { confirm: true });
      toastOk(`اتضمّوا في «${keep.label}»`);
    } catch (err) {
      toastError(err.message || 'مقدرناش نضمّهم');
    }
    await refresh();
    return true;
  }

  return false;
}

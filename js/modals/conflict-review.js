/**
 * LingoLife — مراجعةُ تعارضات المزامنة (WS-H · بنود ١٢ و١٣ و٣٤)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **تعرض ما كشفه WS-G — ولا تكشف شيئًا بنفسها**
 * ═══════════════════════════════════════════════════════════════
 *
 * لا نموذجَ تعارضٍ ثانيًا هنا: الأنواعُ الثمانيةُ ومعرِّفاتُها وطرفاها
 * كلُّها من `services/sync/conflicts.js` كما هي. وهذا الملفّ **يترجمها
 * إلى عربيّةٍ يقرؤها إنسان** ويعيد قرارَه إلى نفس `resolveConflict`.
 *
 * ⚠️ **ولا يكتب في القاعدة حرفًا** (بند ١٣). الخطّةُ كائنٌ في الذاكرة،
 *    والقرارُ يعلّمها، والكتابةُ خطوةٌ واحدةٌ بعد أن تُغلَق النافذةُ
 *    بـ«طبّق». و«إلغاء» = **صفرُ كتابات** — لا لأننا نتراجع، بل لأنه
 *    لم يُكتَب شيءٌ أصلًا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا مصطلحاتٍ في نصّ المستخدم** (بند ٣٤)
 * ═══════════════════════════════════════════════════════════════
 *
 * لا يظهر هنا `FIELD_CONFLICT` ولا `version vector` ولا `originSeq`.
 * يظهر: «النصّ عندك» و«النصّ على الجهاز التاني» وزرّان. والنوعُ التقنيّ
 * يبقى في التشخيص لمن يبحث عنه.
 */

import { html, raw } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { CONFLICT, RESOLUTION, resolveConflict, unresolved } from '../services/sync/conflicts.js';

/** اسمُ المخزن كما يقوله إنسان. */
const STORE_LABEL = {
  scripts: 'نصّ',
  scenes: 'ذكرى',
  media: 'ملف',
  relationships: 'رابط',
  savedItems: 'محفوظة',
  studyDrafts: 'مسودّة',
  referenceRules: 'قاعدة',
  mistakeComparisons: 'غلطة',
  settings: 'إعداد',
  people: 'شخص',
  places: 'مكان',
  expressions: 'تعبير',
  words: 'كلمة',
};

/** اسمُ الحقل كما يقوله إنسان. */
const FIELD_LABEL = {
  title: 'العنوان',
  text: 'النصّ',
  note: 'الملاحظة',
  caption: 'الوصف',
  value: 'القيمة',
  order: 'الترتيب',
  meaningAr: 'المعنى',
  explanationAr: 'الشرح',
  label: 'الاسم',
  name: 'الاسم',
};

const storeName = (store) => STORE_LABEL[store] || store;
const fieldName = (field) => FIELD_LABEL[field] || field;

/**
 * يعرض قيمةً بأمان.
 *
 * ⚠️ **والاتّجاهُ يُعلَن على الكتلة** — نفسُ درس WS-D: نصٌّ روسيٌّ داخل
 *    صفحةٍ عربيّةٍ تنقلب علاماتُه فتقرأ «.Документ». و`dir="auto"` يقرّر
 *    من أوّل حرفٍ قويّ، وهو الصواب هنا لأن القيمَ مختلطةٌ بطبعها.
 */
function valueBlock(value, note) {
  if (value === null || value === undefined) {
    return html`<p class="cf-value cf-empty">— مفيش —</p>`;
  }
  const text = typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value);
  const short = text.length > 600 ? `${text.slice(0, 600)}…` : text;
  return html`
    <p class="cf-side">${note || ''}</p>
    <div class="cf-value" dir="auto">${short}</div>`;
}

/** بطاقةُ تعارضٍ واحد — العنوانُ والطرفان والأزرار. */
function conflictCard(conflict, index) {
  const chosen = conflict.resolution;
  const pick = (value, label, hint = '') => html`
    <button type="button" class="btn cf-pick ${chosen === value ? 'is-picked' : ''}"
            data-cf="${conflict.id}" data-pick="${value}">
      ${label}${raw(hint ? html`<small>${hint}</small>` : '')}
    </button>`;

  let head = '';
  let body = '';
  let actions = '';

  if (conflict.type === CONFLICT.FIELD || conflict.type === CONFLICT.UNIQUE_ENTITY) {
    head = `تعارض في ${fieldName(conflict.field)} — ${storeName(conflict.store)}`;
    body = html`
      <div class="cf-pair">
        <div class="cf-col">${raw(valueBlock(conflict.local.value, 'على الجهاز ده'))}</div>
        <div class="cf-col">${raw(valueBlock(conflict.remote.value, 'على الجهاز التاني'))}</div>
      </div>`;
    actions = html`
      ${raw(pick(RESOLUTION.USE_LOCAL, 'استخدم نسخة الجهاز ده'))}
      ${raw(pick(RESOLUTION.USE_REMOTE, 'استخدم النسخة التانية'))}`;
  } else if (conflict.type === CONFLICT.DELETE_EDIT) {
    head = `${storeName(conflict.store)} اتحذف على جهاز واتعدّل على التاني`;
    body = html`
      <div class="cf-pair">
        <div class="cf-col">${raw(valueBlock(
          conflict.local.value ? 'موجود ومعدَّل' : 'محذوف', conflict.local.note))}</div>
        <div class="cf-col">${raw(valueBlock(
          conflict.remote.value ? 'موجود ومعدَّل' : 'محذوف', conflict.remote.note))}</div>
      </div>`;
    actions = html`
      ${raw(pick(RESOLUTION.KEEP_DELETE, 'احتفظ بالحذف'))}
      ${raw(pick(RESOLUTION.KEEP_EDIT, 'استرجع النسخة المعدَّلة'))}`;
  } else if (conflict.type === CONFLICT.TREE_MOVE) {
    head = 'الجزء ده اتنقل لمكانين مختلفين';
    body = html`
      <div class="cf-pair">
        <div class="cf-col">${raw(valueBlock(conflict.local.value, 'مكانه هنا'))}</div>
        <div class="cf-col">${raw(valueBlock(conflict.remote.value, 'مكانه هناك'))}</div>
      </div>`;
    actions = html`
      ${raw(pick(RESOLUTION.USE_LOCAL, 'احتفظ بالمكان الحالي'))}
      ${raw(pick(RESOLUTION.USE_REMOTE, 'استخدم المكان التاني'))}`;
  } else if (conflict.type === CONFLICT.TREE_ORDER) {
    head = 'ترتيب الأجزاء اتغيّر على الجهازين';
    const list = (ids) => html`<ol class="cf-order" dir="auto">${
      raw((ids || []).map((id) => html`<li>${String(id).slice(0, 22)}</li>`).join(''))
    }</ol>`;
    body = html`
      <div class="cf-pair">
        <div class="cf-col"><p class="cf-side">الترتيب هنا</p>${raw(list(conflict.local.value))}</div>
        <div class="cf-col"><p class="cf-side">الترتيب هناك</p>${raw(list(conflict.remote.value))}</div>
      </div>`;
    actions = html`
      ${raw(pick(RESOLUTION.USE_LOCAL, 'احتفظ بترتيبي'))}
      ${raw(pick(RESOLUTION.USE_REMOTE, 'استخدم الترتيب التاني'))}`;
  } else if (conflict.type === CONFLICT.RELATIONSHIP_METADATA) {
    head = 'رابط اتفكّ على جهاز واتعدّل على التاني';
    body = html`<p class="cf-side">${conflict.label}</p>`;
    actions = html`
      ${raw(pick(RESOLUTION.KEEP_DELETE, 'سيبه مفكوك'))}
      ${raw(pick(RESOLUTION.KEEP_EDIT, 'رجّع الرابط'))}`;
  } else {
    head = conflict.label || 'تعارض';
    body = html`<p class="cf-side">النوع ده محتاج قرارك، والتفاصيل في التشخيص.</p>`;
  }

  return html`
    <section class="cf-card ${chosen ? 'is-done' : ''}" data-cf-card="${conflict.id}">
      <h4 class="cf-head"><span class="cf-num">${index + 1}</span> ${head}</h4>
      ${raw(body)}
      <div class="cf-actions">${raw(actions)}</div>
    </section>`;
}

/**
 * يفتح مراجعةَ التعارضات.
 *
 * @param {object} plan — خطّةُ WS-G كما هي
 * @returns {Promise<{applied: boolean, resolutions: Array}>}
 */
export async function openConflictReview(plan) {
  const blocking = unresolved(plan);
  if (!blocking.length) return { applied: false, resolutions: [], reason: 'مفيش تعارض' };

  let decided = false;

  const render = (root) => {
    const remaining = unresolved(plan).length;
    root.querySelector('[data-cf-list]').innerHTML =
      plan.conflicts.filter((c) => c.blocking).map(conflictCard).join('');
    const bar = root.querySelector('[data-cf-status]');
    bar.textContent = remaining
      ? `فاضل ${remaining} قرار`
      : 'كل التعارضات اتحلّت — تقدر تطبّق دلوقتي';
    bar.classList.toggle('is-ready', remaining === 0);
    /*
     * ⚠️ **وزرُّ التطبيق يُقفَل حتى يُحسَم كلُّ تعارض.** والعثورُ عليه
     *    بـ`[data-value="submit"]` لا بسمةٍ خاصّة: `showModal` ترسم
     *    الأزرارَ بنفسها ولا تمرّر سماتٍ إضافيّة، واختراعُ مسارٍ لذلك
     *    كان سيعني تعديلَ نافذةٍ يستعملها عشرون موضعًا.
     */
    const apply = root.querySelector('.modal-actions [data-value="submit"]');
    if (apply) apply.disabled = remaining > 0;
  };

  const body = html`
    <div class="cf-wrap">
      <p class="field-hint">
        الجهازين اتغيّروا في نفس الحتّة. <strong>مفيش حاجة اتكتبت لسه</strong> —
        اختار، وأنا هطبّق بعد ما تخلّص.
      </p>
      <div class="cf-status" data-cf-status></div>
      <div data-cf-list></div>
    </div>`;

  await showModal({
    title: 'تعارض محتاج قرارك',
    wide: true,
    body,
    actions: [
      { label: 'إلغاء — متكتبش حاجة', value: null, variant: 'ghost' },
      { label: 'طبّق قراراتي', value: 'submit', variant: 'primary' },
    ],
    onMount(root) {
      render(root);
      root.addEventListener('click', (event) => {
        const button = event.target.closest('[data-pick]');
        if (button) {
          /*
           * ⚠️ **والقرارُ يعلّم الخطّةَ فقط.** `resolveConflict` من WS-G
           *    لا تلمس القاعدة — تكتب `resolution` على الكائن. ولذلك
           *    يمكنك أن تبدّل رأيك عشرَ مرّاتٍ بلا أثرٍ في أيّ مكان.
           */
          resolveConflict(plan, button.dataset.cf, button.dataset.pick);
          render(root);
          return;
        }
        if (event.target.closest('.modal-actions [data-value="submit"]')) decided = true;
      });
    },
  });

  /*
   * ⚠️ **والإلغاءُ يمسح القرارات.** خطّةٌ نصفُ محلولةٍ تُترَك في الذاكرة
   *    قد تُطبَّق لاحقًا بقراراتٍ نسيتَ أنك اخترتَها. فالإلغاءُ يعيدها
   *    كما وُلدت.
   */
  if (!decided) {
    for (const conflict of plan.conflicts) {
      conflict.resolution = null;
      conflict.resolvedValue = undefined;
    }
    return { applied: false, cancelled: true, resolutions: [] };
  }

  return {
    applied: true,
    resolutions: plan.conflicts
      .filter((c) => c.resolution)
      .map((c) => ({ id: c.id, resolution: c.resolution, value: c.resolvedValue })),
  };
}

/**
 * LingoLife — منتقي المتحدّث
 *
 * السؤال «مين بيتكلم؟» يتكرّر في كل جزء محادثة تضيفه — وهو أكثر حقلٍ
 * تكتبه في التطبيق. فكتابته نصًّا حرًّا في كل مرّة تعني ثلاثة أشياء
 * سيّئة معًا: مجهودٌ متكرّر، وأخطاء إملاء تفرّق الشخص الواحد، وسؤالٌ
 * بديهيّ بلا جواب — «فين كل الكلام اللي قاله أليكسي؟».
 *
 * ⚠️ **والنصّ الحرّ يبقى ممكنًا.** مَن لا تعرف اسمه، أو مَن لن يتكرّر،
 *    لا يستحقّ بطاقةً في مكتبتك. إجبارك على إنشاء شخصٍ لكل صوتٍ عابر
 *    يحوّل المكتبة إلى مقبرة. فالمنتقي يقبل الاثنين.
 */

import { html, raw, esc } from '../utils/dom.js';
import { icon } from './icons.js';
import { ME, listPeople, suggestPerson } from '../services/person-service.js';

/**
 * الحقل: قائمة بمَن تعرفهم، و«شخص جديد» يفتح خانة اسم.
 *
 * @param {{selectedId?: string|null, freeText?: string, isMine?: boolean}} state
 */
export async function speakerSelect(state = {}) {
  const people = await listPeople();
  const { selectedId = null, freeText = '', isMine = false } = state;

  const options = people
    .map(
      (p) => html`<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>
        ${esc(p.name)}${p.role ? ` — ${esc(p.role)}` : ''}
      </option>`
    )
    .join('');

  return html`
    <div class="speaker-field" data-speaker-field>
      <select name="personId" data-speaker-pick aria-label="مين بيتكلم">
        <option value="me" ${isMine ? 'selected' : ''}>🙋 ${ME.label}</option>
        ${raw(people.length ? html`<optgroup label="اللي تعرفهم">${raw(options)}</optgroup>` : '')}
        <!--
          الافتراضي: «اكتب اسمًا». وهو مكافئ «شخص تاني» في النموذج
          القديم — أغلب أجزاء المحادثة يقولها غيرك، وافتراض أنها لك
          يجعلك تصحّح في كل مرّة.
        -->
        <option value="" ${!isMine && !selectedId ? 'selected' : ''}>✎ اكتب اسمًا</option>
      </select>
      <button type="button" class="btn btn-ghost btn-sm" data-action="manage-people">
        ${raw(icon('plus', 15))} أشخاص
      </button>

      <!--
        خانة الاسم الحرّ: تظهر حين لا تختار أحدًا من القائمة. ولا
        تختفي بياناتها عند التبديل — قد تعود إليها.
      -->
      <input type="text" name="speaker" data-speaker-text
        placeholder="اسم المتحدّث… مثلًا Алексей" value="${esc(freeText)}"
        autocomplete="off" ${selectedId || isMine ? 'hidden' : ''} />

      <p class="field-hint" data-speaker-hint hidden></p>
    </div>`;
}

/**
 * يُفعّل المنتقي داخل نافذة: إظهار خانة الاسم، واقتراح شخصٍ مطابق.
 *
 * الاقتراح **يُعرَض ولا يُطبَّق**: تكتب «Алексей» فنقول «ده أليكسي
 * اللي تعرفه؟» ومعه زرّ. الربط الصامت يخلط كلام رجلين، والخطأ فيه
 * لا يُكتشَف بعد شهر.
 *
 * @param {HTMLElement} root الحاوية التي فيها الحقل
 */
export function wireSpeakerSelect(root) {
  const field = root.querySelector('[data-speaker-field]');
  if (!field) return;

  const pick = field.querySelector('[data-speaker-pick]');
  const text = field.querySelector('[data-speaker-text]');
  const hint = field.querySelector('[data-speaker-hint]');

  const sync = () => {
    // القيمة الفارغة تعني «اكتب اسمًا»، و`me` تعني أنت.
    text.hidden = pick.value !== '';
    if (!text.hidden) text.focus();
    hint.hidden = true;
  };

  pick.addEventListener('change', sync);

  /*
   * ⚠️ مزامنةٌ أولى عند التركيب. بدونها تبدأ الحالة متناقضة: المنتقي
   *    يعرض خيارًا وخانةُ الاسم تعرض عكسه — ظهر ذلك في التحقّق البصري
   *    لا في اختبار. و`focus` مُستثنًى هنا: التركيز عند الفتح يخطف
   *    المؤشّر من أوّل حقلٍ في النموذج.
   */
  text.hidden = pick.value !== '';
  hint.hidden = true;

  let timer = null;
  text.addEventListener('input', () => {
    clearTimeout(timer);
    hint.hidden = true;
    const value = text.value.trim();
    if (value.length < 2) return;

    // مهلةٌ قصيرة: الاقتراح عند التوقّف عن الكتابة لا عند كل حرف.
    timer = setTimeout(async () => {
      const match = await suggestPerson(value);
      if (!match || text.value.trim() !== value) return;
      hint.hidden = false;
      hint.innerHTML =
        `ده <strong>${esc(match.person.name)}</strong> اللي تعرفه؟ ` +
        `<button type="button" class="btn btn-ghost btn-sm" data-speaker-use="${match.person.id}">اربطه بيه</button>`;
    }, 350);
  });

  field.addEventListener('click', (event) => {
    const button = event.target.closest('[data-speaker-use]');
    if (!button) return;
    pick.value = button.dataset.speakerUse;
    sync();
  });
}

/**
 * يقرأ اختيار المنتقي من بيانات النموذج.
 *
 * @returns {{personId: string|null, speaker: string, isMine: boolean}}
 */
export function readSpeaker(data, known = []) {
  const picked = data.personId || '';

  if (picked === 'me') return { personId: null, speaker: ME.label, isMine: true };

  if (picked) {
    const person = known.find((p) => p.id === picked);
    // ⚠️ `speaker` يُملأ باسم الشخص لا يُترك فارغًا: كل قارئٍ قديم
    //    (شاشة المشهد، مدخل الظلّ، السلة) يقرأه، ولا يجوز أن تظهر
    //    أجزاء بلا متحدّث لأننا صرنا نعرف مَن هو.
    return { personId: picked, speaker: person?.name || '', isMine: false };
  }

  return { personId: null, speaker: (data.speaker || '').trim(), isMine: false };
}

/**
 * يعيد بناء خيارات المنتقي في مكانه بعد إضافة شخص من المكتبة.
 *
 * لا نُعيد رسم النموذج كلّه: المستخدم كتب الكلام والترجمة بالفعل،
 * وإعادة الرسم تمسحهما. نستبدل الخيارات وحدها ونُبقي كل شيء آخر.
 */
export async function refreshSpeakerSelect(field) {
  const pick = field.querySelector('[data-speaker-pick]');
  if (!pick) return;

  const previous = pick.value;
  const people = await listPeople();
  const group = people.length
    ? `<optgroup label="اللي تعرفهم">${people
        .map((p) => `<option value="${p.id}">${esc(p.name)}${p.role ? ` — ${esc(p.role)}` : ''}</option>`)
        .join('')}</optgroup>`
    : '';

  pick.innerHTML =
    `<option value="me">🙋 ${ME.label}</option>${group}<option value="">✎ اكتب اسمًا</option>`;

  // أحدث مَن أُضيف هو غالبًا مَن فتح المكتبة لأجله. وإن كان اختياره
  // السابق ما زال موجودًا فهو أولى.
  const stillThere = [...pick.options].some((o) => o.value === previous);
  pick.value = stillThere && previous ? previous : people[0]?.id || 'me';
  pick.dispatchEvent(new Event('change', { bubbles: true }));
}

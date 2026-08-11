/**
 * LingoLife — مَن كان معك؟
 *
 * ⚠️ **اختيارٌ متعدّد لا واحد.** ذكرى الاجتماع فيها خمسة، وزيارة
 *    الطبيب فيها اثنان. ونموذجٌ يسأل «مين الشخص؟» بالمفرد يجعلك تختار
 *    واحدًا وتنسى الباقي.
 *
 * ⚠️ **وإضافةُ شخصٍ جديد من هنا لا من شاشةٍ أخرى** *(B3)*. أن تغادر
 *    النموذج لتُنشئ شخصًا ثم تعود لتختاره احتكاكٌ بلا سبب — وغالبًا
 *    تكتشف أن الشخص جديدٌ **وأنت تملأ الذكرى**.
 *
 * ⚠️ **ومَن تكلّم يُعرَض ولا يُطفأ.** له جملةٌ في المحادثة، وذلك
 *    واقعةٌ لا إعلانٌ ترفعه بمربّع اختيار. فيظهر مُعلَّمًا بأنه هناك
 *    بدليل كلامه، ولا يُلمَس.
 */

import { html, raw, esc } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { listPeople, addPerson } from '../services/person-service.js';
import {
  scenePeople, participantIds, setParticipants,
} from '../services/participant-service.js';
import { reloadScene } from '../ui-state.js';

/** صفُّ شخصٍ في المنتقي. */
export function personRow(person, { checked, locked, why }) {
  return html`
    <label class="pp-row${locked ? ' is-locked' : ''}">
      <input type="checkbox" name="participant" value="${person.id}"
             ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''}>
      <span class="pp-name"><bdi>${person.name}</bdi></span>
      ${raw(person.role ? html`<span class="pp-role">${person.role}</span>` : '')}
      ${raw(why ? html`<span class="pp-why">${why}</span>` : '')}
    </label>`;
}

/**
 * مَن عُلِّم عليه **إعلانًا** في المنتقي.
 *
 * ⚠️ مُصدَّرةٌ لتُختبَر. الخطأ الذي كانت فيه لا تراه اختبارات الخدمة —
 *    الخدمة تُنفّذ ما تُعطى، والغلط كان في **ما نقرؤه من الشاشة**.
 *
 * ⚠️ و`:checked` تلتقط المربّع المُعطَّل أيضًا. المُعطَّل لا يُرسَل مع
 *    النموذج، لكن القراءة هنا من الـDOM مباشرةً — فبلا هذا الترشيح
 *    يصير كلُّ مَن تكلّم **مُعلَنًا** عند أوّل حفظة، ويذوب الفرق بين
 *    واقعةٍ وإعلان: وهو الفرق الذي وُجد WS9 له.
 */
export function readPicked(root = document) {
  return [...root.querySelectorAll('.pp-list input[name="participant"]:checked')]
    .filter((box) => !box.disabled)
    .map((box) => box.value);
}

export async function openParticipantsModal(sceneId) {
  const [all, here, declared] = await Promise.all([
    listPeople(),
    scenePeople(sceneId),
    participantIds(sceneId),
  ]);

  // مَن تكلّم: يظهر ولا يُطفأ — واقعةٌ لا إعلان.
  const spoke = new Map(here.filter((p) => p.spoke).map((p) => [p.id, p]));
  const declaredSet = new Set(declared);

  const value = await showModal({
    title: 'مين كان معاك؟',
    submitLabel: 'احفظ',
    body: html`
      <p class="field-hint">
        علّم على اللي كانوا هناك — حتى لو ماتكلّموش.
        اللي ليه كلام في المحادثة بيبان لوحده ومش محتاج تعليم.
      </p>

      <div class="pp-list">
        ${raw(all.length
          ? all.map((person) => personRow(person, {
              checked: declaredSet.has(person.id) || spoke.has(person.id),
              locked: spoke.has(person.id),
              why: spoke.has(person.id) ? 'اتكلّم' : '',
            })).join('')
          : html`<p class="fc-empty">لسه مفيش أشخاص — اكتب اسم تحت وهيتضاف.</p>`)}
      </div>

      <div class="field" style="margin-top:var(--sp-4)">
        <label for="pp-new">تضيف حد جديد؟</label>
        <input id="pp-new" name="newName" type="text" placeholder="الاسم"
               autocomplete="off" />
      </div>`,

    async onSubmit(data, close) {
      /*
       * ⚠️ الاسم الجديد يُنشأ **ويُعلَّم** في نفس الحفظة. أن يُنشأ ثم
       *    يُطلَب منك فتحُ النموذج ثانيةً لتعليمه هو الاحتكاك نفسه
       *    الذي جاء الحقل ليمنعه.
       */
      const fresh = (data.newName || '').trim();
      /*
       * ⚠️ تُقرأ من الـDOM لا من `FormData`: خانات الاختيار تحمل الاسم
       *    نفسه، و`Object.fromEntries` تُبقي آخر واحدة وحدها — فتضيع
       *    كل مَن علّمتَ عليهم إلا الأخير. (وانظر `readPicked`.)
       */
      const picked = readPicked();

      if (fresh) {
        try {
          const person = await addPerson({ name: fresh });
          picked.push(person.id);
        } catch (err) {
          toastError(err.message || 'مقدرناش نضيف الشخص');
          throw err;
        }
      }

      /*
       * ⚠️ مَن تكلّم مربّعُه مُعطَّل، والمُعطَّل **لا يُرسَل** في النموذج.
       *    فلو حفظنا المختار وحده رفعنا إعلانَ مشاركته — وهو ما قد
       *    يكون أعلنتَه صراحةً قبل أن يتكلّم.
       */
      for (const id of declaredSet) if (spoke.has(id)) picked.push(id);

      await setParticipants(sceneId, picked);
      close();
      toastOk('اتحفظ');
      reloadScene(sceneId);
    },
  });

  return value;
}

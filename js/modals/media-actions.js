/**
 * LingoLife — إضافة الوسائط والتسجيل
 *
 * ثلاثة أفعال تبدأ من زرّ وتنتهي بملفٍّ في الذكرى: اختيار صور، اختيار
 * صوت، والتسجيل المباشر.
 */

import { html, raw } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import {
  addFilesToScene, pickFiles, startRecording, canRecord, AUDIO_ROLE,
} from '../services/media-service.js';
import { reloadScene } from '../ui-state.js';

export async function handleAddImages(sceneId) {
  const files = await pickFiles({ accept: 'image/*', multiple: true });
  if (!files.length) return;

  const dismiss = toast(`بيتحفظ ${files.length} ملف…`, { duration: 60000 });
  const result = await addFilesToScene(sceneId, files, { kind: 'image' });
  dismiss();

  if (result.added) toastOk(`اتضاف ${result.added} صورة بحجمها الأصلي`);
  if (result.failed) toastError(`${result.failed} ملف فشل`);
  reloadScene(sceneId);
}


/**
 * يسأل عن التصنيف — **ويسمح بصنعِ واحدٍ جديدٍ من نفس النافذة** (WS37).
 *
 * ⚠️ بلاغُك: «لما أضيف فويس المفروض يسألني على التصنيف، ولو مش موجود
 *    أضيفه أنا أو أعدّل واحد قديم ويتعدّل في البرنامج كله».
 *
 * وكان التصنيفُ يُفرَض: كلُّ ملفٍّ تضيفه «التسجيل الأصلي» وكلُّ تسجيلٍ
 * تسجّله «إعادة سرد» — بلا سؤال. فتنتهي بعشرين تسجيلًا كلُّها بنفس
 * الاسم لأن أحدًا لم يسألك.
 *
 * ⚠️ **والإنشاءُ من هنا لا من شاشةٍ أخرى.** لحظةُ الحاجة إلى تصنيفٍ
 *    جديدٍ هي لحظةُ إضافة الصوت؛ وإرسالُك إلى الإعدادات لتعود يعني
 *    أنك ستختار «ملاحظة» وتمضي.
 *
 * @returns {Promise<string|null>} معرّفُ التصنيف، أو `null` إن أُلغيت.
 */
export async function askAudioRole({ title = 'التسجيل ده إيه؟', suggest = null } = {}) {
  const { listRoles, addRole } = await import('../services/audio-role-service.js');
  let roles = await listRoles();

  let picked = suggest && roles.some((r) => r.id === suggest) ? suggest : roles[0]?.id || null;
  let created = null;

  const rowsHtml = (list, current) => list
    .map((r) => `
      <label class="pick-row">
        <input type="radio" name="role" value="${r.id}" ${r.id === current ? 'checked' : ''} />
        <span>${r.label}</span>
      </label>`)
    .join('');

  await showModal({
    title,
    submitLabel: 'تمام',
    body: html`
      <div class="field" data-role-list>${raw(rowsHtml(roles, picked))}</div>
      <div class="field">
        <label for="new-role">مش لاقي اللي عايزه؟ اكتب تصنيف جديد</label>
        <div style="display:flex;gap:var(--sp-2)">
          <input id="new-role" name="newRole" type="text" placeholder="مثلًا: كلام المدرّس" />
          <button type="button" class="btn btn-ghost" data-add-role>أضف</button>
        </div>
        <p class="field-hint" data-role-note></p>
      </div>`,
    onMount(modal) {
      const note = modal.querySelector('[data-role-note]');
      modal.querySelector('[data-add-role]').addEventListener('click', async () => {
        const input = modal.querySelector('#new-role');
        try {
          const row = await addRole(input.value);
          created = row.id;
          roles = await listRoles();
          modal.querySelector('[data-role-list]').innerHTML = rowsHtml(roles, created);
          input.value = '';
          note.textContent = 'اتضاف — ومختار دلوقتي';
        } catch (error) {
          /* ⚠️ سببُ الرفض يُقال: «فيه تصنيف بنفس الاسم» ليس «فشل». */
          note.textContent = error.message;
        }
      });
    },
    onSubmit(data, close) {
      picked = data.role || created || picked;
      close();
    },
  });

  return picked;
}

export async function handleAddAudio(sceneId) {
  const files = await pickFiles({ accept: 'audio/*', multiple: true });
  if (!files.length) return;

  /* ⚠️ السؤالُ **قبل** الحفظ: بعده يصير تصحيحًا لا اختيارًا. */
  const role = await askAudioRole({ suggest: AUDIO_ROLE.ORIGINAL });
  if (!role) return;

  const dismiss = toast('بيتحفظ…', { duration: 60000 });
  const result = await addFilesToScene(sceneId, files, { kind: 'audio', role });
  dismiss();

  if (result.added) toastOk(`اتضاف ${result.added} ملف صوت`);
  if (result.failed) toastError(`${result.failed} ملف فشل`);
  reloadScene(sceneId);
}

/** التسجيل الجاري — لو موجود، الضغطة التانية بتوقّفه. */
let activeRecording = null;

export async function handleRecord(sceneId, buttonEl, role = AUDIO_ROLE.RETELLING) {
  if (activeRecording) {
    const { session, timer, btn } = activeRecording;
    clearInterval(timer);
    btn?.classList.remove('recording');
    activeRecording = null;

    const file = await session.stop();
    /*
     * ⚠️ **والسؤالُ بعد الوقف لا قبل البدء** هنا وحدَه: تسجيلٌ يبدأ
     *    بنافذةٍ يفوته أوّلُ ما أردتَ قولَه. فالتصنيفُ يُسأل والصوتُ
     *    في اليد، ورفضُ الاختيار يحفظه بالافتراض لا يرميه.
     */
    const chosen = (await askAudioRole({ title: 'التسجيل ده إيه؟', suggest: role })) || role;
    const result = await addFilesToScene(sceneId, [file], { kind: 'audio', role: chosen });
    if (result.added) toastOk('التسجيل اتحفظ');
    else toastError('فشل حفظ التسجيل');
    reloadScene(sceneId);
    return;
  }

  if (!canRecord()) {
    toastError('المتصفح ده مش بيدعم التسجيل الصوتي');
    return;
  }

  try {
    const session = await startRecording();
    buttonEl?.classList.add('recording');

    const timeEl = document.querySelector('[data-rec-time]');
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      if (timeEl) {
        timeEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }
    }, 250);

    activeRecording = { session, timer, btn: buttonEl };
    toast('بيسجّل… اضغط تاني علشان توقف');
  } catch (err) {
    console.error(err);
    toastError('مقدرناش نوصل للميكروفون — اسمح بالإذن وجرّب تاني');
  }
}

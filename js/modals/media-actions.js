/**
 * LingoLife — إضافة الوسائط والتسجيل
 *
 * ثلاثة أفعال تبدأ من زرّ وتنتهي بملفٍّ في الذكرى: اختيار صور، اختيار
 * صوت، والتسجيل المباشر.
 */

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

export async function handleAddAudio(sceneId) {
  const files = await pickFiles({ accept: 'audio/*', multiple: true });
  if (!files.length) return;

  const dismiss = toast('بيتحفظ…', { duration: 60000 });
  const result = await addFilesToScene(sceneId, files, { kind: 'audio', role: AUDIO_ROLE.ORIGINAL });
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
    const result = await addFilesToScene(sceneId, [file], { kind: 'audio', role });
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

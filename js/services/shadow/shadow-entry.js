/**
 * LingoLife — مداخل الظلّ
 *
 * الظلّ **طبقة ممارسة عامّة** لا شاشة مستقلّة: أي مصدر لغوي في
 * التطبيق يدخلها بلا نسخ ولصق. أربعة مداخل: سكريبت، محادثة، جمل
 * مختارة، ونصّ مستخرج من صورة.
 *
 * أُخرجت من `app.js` لأنها ستكبر — بند 76 يعد بمصادر أخرى بعد.
 */

import { html, raw } from '../../utils/dom.js';
import { navigate } from '../../router.js';
import { scenes, scripts, media } from '../../db/repositories.js';
import { listConversationParts } from '../content-service.js';
import { splitSentences } from './segmenter.js';
import { createSession, sessionsForSource, SOURCE_TYPE } from './shadow-session-service.js';
import { urlFor } from '../media-service.js';
import { showModal } from '../../components/modal.js';
import { toast, toastOk, toastError } from '../../components/toast.js';

/**
 * يفتح الظلّ على سكريبت — **بلا نسخ ولصق**.
 *
 * لو فيه جلسة سابقة على نفس السكريبت نستأنفها بدل إنشاء واحدة
 * جديدة: تكراراتك السابقة وموضعك جزء من عملك، لا شيء يُرمى.
 */
export async function openShadowForScript(scriptId, sceneId) {
  const script = await scripts.get(scriptId);
  if (!script?.text?.trim()) {
    return toastError('السكريبت ده فاضي — مفيش حاجة نتدرّب عليها');
  }

  const existing = await sessionsForSource(SOURCE_TYPE.SCRIPT, scriptId);
  if (existing.length) {
    const resume = existing.sort(
      (a, b) => (b.lastPracticedAt || b.createdAt) - (a.lastPracticedAt || a.createdAt)
    )[0];
    return navigate(`/shadow/${resume.id}`);
  }

  const scene = sceneId ? await scenes.get(sceneId) : null;

  try {
    const { session, segments } = await createSession({
      title: scene?.titleAr || script.title || 'تدريب بالظلّ',
      sourceType: SOURCE_TYPE.SCRIPT,
      sourceId: scriptId,
      sourceVersion: script.rev ?? null,
      sceneId: sceneId || script.sceneId || null,
      text: script.text,
    });
    toastOk(`${segments.length} جملة جاهزة للتدريب`);
    navigate(`/shadow/${session.id}`);
  } catch (error) {
    console.error(error);
    toastError(error.message);
  }
}

/**
 * محادثة ← ظلّ.
 *
 * الأجزاء مقاطع جاهزة بترتيبها — لا نمرّ على مُقسِّم الجمل، لأن
 * تقسيم المحادثة موجود أصلًا: كل جزء جملة متحدّث.
 */
export async function openShadowForConversation(sceneId) {
  const parts = (await listConversationParts(sceneId)).filter((p) => p.text?.trim());
  if (!parts.length) return toastError('مفيش أجزاء محادثة في الذكرى دي');

  const speakers = [...new Set(parts.map((p) => p.speaker || 'المتحدث'))];

  // ⚠️ القيم تُقرأ داخل onSubmit لا بعد إغلاق النافذة: النافذة تُزال من
  //    الـ DOM عند الإغلاق، فقراءة الحقول بعدها تعيد فراغًا دائمًا.
  let form = null;
  await showModal({
    title: 'تدرّب على المحادثة',
    submitLabel: 'ابدأ',
    body: html`
      <p class="text-soft text-sm" style="line-height:1.9">
        ${parts.length} جزء من ${speakers.length} متحدّث.
      </p>
      <div class="field">
        <label for="c-speaker">تتدرّب على مين؟</label>
        <select id="c-speaker" name="speaker">
          <option value="">المحادثة كلها</option>
          ${raw(speakers.map((sp) => `<option value="${sp}">${sp} فقط</option>`).join(''))}
        </select>
      </div>`,
    onSubmit(data, close) {
      form = data;
      close();
    },
  });
  if (!form) return;

  const speaker = form.speaker || '';
  const chosen = speaker ? parts.filter((p) => (p.speaker || 'المتحدث') === speaker) : parts;
  if (!chosen.length) return toastError('مفيش أجزاء للمتحدّث ده');

  const scene = await scenes.get(sceneId);

  const { session, segments } = await createSession({
    title: `${scene?.titleAr || 'محادثة'}${speaker ? ` — ${speaker}` : ''}`,
    sourceType: SOURCE_TYPE.CONVERSATION,
    sourceId: chosen[0].conversationId,
    sceneId,
    segments: chosen.map((part) => ({
      text: part.text,
      translation: part.translation || null,
      sourceObjectId: part.id,
      speaker: part.speaker || null,
      isMine: Boolean(part.isMine),
    })),
  });

  toastOk(`${segments.length} جزء جاهز للتدريب`);
  navigate(`/shadow/${session.id}`);
}

/**
 * تحديد جمل ← ظلّ.
 *
 * الجلسة تحمل الجمل المختارة وحدها. تظلّ مرتبطة بالسكريبت الأصلي
 * فيبقى كشف تغيّر المصدر عاملًا.
 */
export async function openShadowSelection(scriptId, sceneId) {
  const script = await scripts.get(scriptId);
  if (!script?.text?.trim()) return toastError('السكريبت فاضي');

  const sentences = splitSentences(script.text);
  if (!sentences.length) return toastError('مفيش جمل صالحة');

  let form = null;
  await showModal({
    title: 'اختار الجمل',
    submitLabel: 'ابدأ بالمحدّد',
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        علّم اللي عايز تتدرّب عليه بس.
      </p>
      ${raw(
        sentences
          .map(
            (text, i) => html`
              <label class="pick-row">
                <input type="checkbox" name="s${i}" value="${i}" checked />
                <span dir="ltr">${text}</span>
              </label>`
          )
          .join('')
      )}`,
    // FormData لا تحمل إلا المربّعات المؤشَّرة، فالمفاتيح الموجودة هي
    // المختارة بالضبط.
    onSubmit(data, close) {
      form = data;
      close();
    },
  });
  if (!form) return;

  const picked = Object.values(form)
    .map((value) => sentences[Number(value)])
    .filter(Boolean);
  if (!picked.length) return toastError('ماخترتش أي جملة');

  const scene = sceneId ? await scenes.get(sceneId) : null;

  const { session } = await createSession({
    title: `${scene?.titleAr || 'مختارات'} — ${picked.length} جملة`,
    sourceType: SOURCE_TYPE.SELECTION,
    sourceId: scriptId,
    sourceVersion: script.rev ?? null,
    sceneId: sceneId || script.sceneId || null,
    segments: picked.map((text) => ({ text })),
  });

  toastOk(`${picked.length} جملة جاهزة`);
  navigate(`/shadow/${session.id}`);
}

/**
 * صورة ← ظلّ.
 *
 * ⚠️ **الصورة لا تُمسّ إطلاقًا.** النصّ المستخرَج يُحفظ كمحتوى مشتقّ
 *    مرتبط بها، والأصل يبقى ببايتاته كما رُفع.
 *
 * ولأن OCR على خطّ يد روسي يخطئ كثيرًا، تمرّ النتيجة على **مراجعة
 * قابلة للتعديل** قبل بناء الجلسة. لا نبني تدريبًا على نصّ لم تره.
 */
export async function openShadowFromImage(mediaId, sceneId) {
  const record = await media.get(mediaId);
  if (!record?.blob) return toastError('الصورة دي مش موجودة');

  const { extractText, isAvailableOffline } = await import('./ocr.js');
  const offline = await isAvailableOffline();

  if (!offline && !navigator.onLine) {
    return toastError('استخراج النصّ محتاج إنترنت — أو ضمّ نسخة محلّية بـ scripts/vendor-tesseract.sh');
  }

  const dismiss = toast(offline ? 'بنقرا الصورة…' : 'بنحمّل محرّك القراءة… أول مرة بتاخد وقت', {
    duration: 10 * 60 * 1000,
  });

  let extracted = '';
  try {
    const result = await extractText(record.blob, {
      onProgress: ({ status, progress }) => {
        console.info(`[ocr] ${status} ${Math.round(progress * 100)}%`);
      },
    });
    extracted = result.text;
  } catch (error) {
    dismiss();
    console.error(error);
    return toastError(`تعذّر استخراج النصّ: ${error.message}`);
  }
  dismiss();

  if (!extracted.trim()) return toastError('مالقيتش نصّ في الصورة دي');

  let form = null;
  await showModal({
    title: 'راجع النصّ قبل ما نبدأ',
    submitLabel: 'ابدأ التدريب',
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        القراءة الآلية بتغلط في الخطّ اليدوي. صحّح اللي محتاج تصحيح —
        <strong>الصورة نفسها مش هتتغيّر</strong>.
      </p>
      <div class="field">
        <textarea name="text" dir="ltr" lang="ru" rows="9"
          style="font-size:15px;line-height:1.9">${extracted}</textarea>
      </div>`,
    onSubmit(data, close) {
      form = data;
      close();
    },
  });
  if (!form) return;

  const reviewed = (form.text || '').trim() || extracted;
  const scene = sceneId ? await scenes.get(sceneId) : null;

  try {
    const { session, segments } = await createSession({
      title: `${scene?.titleAr || 'صورة'} — نصّ مستخرَج`,
      sourceType: SOURCE_TYPE.MEDIA_TEXT,
      sourceId: mediaId,
      sceneId,
      text: reviewed,
    });
    toastOk(`${segments.length} جملة جاهزة`);
    navigate(`/shadow/${session.id}`);
  } catch (error) {
    toastError(error.message);
  }
}

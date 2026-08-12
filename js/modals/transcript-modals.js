/**
 * LingoLife — نماذج النصّ الأصلي
 *
 * ⚠️ **وضع التركيز** *(A6)* ليس زينة: النصّ الأصلي أطولُ ما تكتبه في
 *    التطبيق، وكتابتُه في مربّعٍ صغير بين عشرة أقسامٍ أخرى تجعلك تكتب
 *    أقلّ ممّا تذكر. فيُكتب في شاشةٍ فارغةٍ إلا منه.
 *
 * ⚠️ **ولا حدَّ لعدد المحارف** *(A7)*. حدٌّ تعسّفيّ على ما قيل في اجتماعٍ
 *    ساعتين يعني أن تختار ما تنساه.
 */

import { html, raw } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { writeRaw, writeClean, transcriptOf } from '../services/transcript-service.js';
import { reloadScene } from '../ui-state.js';

/** كتابة الأصل — مرّةً واحدة، والنموذج يقولها قبل الحفظ لا بعده. */
export async function openRawTranscriptModal(sceneId) {
  const state = await transcriptOf(sceneId);
  if (state.locked) {
    toastError('النصّ الأصلي اتكتب خلاص — اعمل نسخة مصحّحة');
    return;
  }

  await showModal({
    title: 'النصّ الأصلي',
    submitLabel: 'احفظ',
    wide: true,
    body: html`
      <p class="field-hint">
        اكتب اللي اتقال زيّ ما اتقال — بأخطائه. ده بيتحفظ
        <strong>مرّة واحدة</strong> وبعدها مابيتعدّلش، والتصحيح بيبقى
        نسخة تانية جنبه. الغلط نفسه هو اللي التحليل و«خطأ/طبيعي»
        بيشتغلوا عليه.
      </p>
      <textarea name="text" class="tr-editor ru" dir="auto" rows="14"
                placeholder="Здравствуйте, я хотел спросить…"></textarea>`,

    async onSubmit(data, close) {
      const text = String(data.text || '').trim();
      if (!text) {
        toastError('اكتب حاجة الأول');
        return;
      }
      try {
        await writeRaw(sceneId, text);
        close();
        toastOk('اتحفظ — ومقفول دلوقتي');
        reloadScene(sceneId);
      } catch (err) {
        toastError(err.message);
        throw err;
      }
    },
  });
}

/** النسخة المصحّحة — تُعدَّل بحرّيّة، وتبدأ فارغةً أو بنسخةٍ من الأصل. */
export async function openCleanTranscriptModal(sceneId) {
  const state = await transcriptOf(sceneId);

  await showModal({
    title: 'النسخة المصحّحة',
    submitLabel: 'احفظ',
    wide: true,
    body: html`
      <p class="field-hint">
        دي بتتعدّل براحتك. الأصل فوق مابيتلمسش —
        <strong>الفرق بينهم هو اللي بتتعلّم منه</strong>.
      </p>
      ${raw(!state.hasClean && state.hasRaw ? html`
        <button type="button" class="btn btn-ghost btn-sm" data-tr="seed">
          ابدأ بنسخة من الأصل
        </button>` : '')}
      <textarea name="text" class="tr-editor ru" dir="auto" rows="14"
                placeholder="النصّ بعد التصحيح…">${state.cleanText}</textarea>`,

    onMount() {
      document.querySelector('[data-tr="seed"]')?.addEventListener('click', () => {
        const box = document.querySelector('.tr-editor');
        if (box && !box.value.trim()) box.value = state.rawText;
      });
    },

    async onSubmit(data, close) {
      await writeClean(sceneId, data.text);
      close();
      toastOk('اتحفظت');
      reloadScene(sceneId);
    },
  });
}

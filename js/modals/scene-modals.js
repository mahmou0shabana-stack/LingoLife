/**
 * LingoLife — نموذجا الذكرى
 *
 * إنشاء ذكرى وتعديل بياناتها. أُخرجا من `app.js` مع بقية النماذج:
 * كان الملفّ يحمل التوجيه والنماذج والعارض ومداخل الظلّ معًا، فصار كل
 * إضافةٍ تمرّ من عنق واحد.
 */

import { html, raw } from '../utils/dom.js';
import { today } from '../utils/dates.js';
import { navigate } from '../router.js';
import { scenes } from '../db/repositories.js';
import { createScene } from '../services/scene-service.js';
import { showModal } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { typeSelect } from '../components/type-select.js';
import { reloadScene } from '../ui-state.js';

export async function openNewSceneModal() {
  const typeField = await typeSelect('type');
  await showModal({
    title: 'ذكرى جديدة',
    submitLabel: 'أنشئ',
    body: html`
      <div class="field">
        <label for="f-titleAr">العنوان بالعربي *</label>
        <input id="f-titleAr" name="titleAr" type="text" required
          placeholder="مثلًا: مراجعة عدم المطابقة" />
      </div>
      <div class="field">
        <label for="f-titleRu">العنوان بالروسي</label>
        <input id="f-titleRu" name="titleRu" type="text" dir="ltr" lang="ru"
          placeholder="Согласование несоответствия" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="f-date">التاريخ</label>
          <input id="f-date" name="date" type="date" value="${today()}" />
        </div>
        <div class="field">
          <label for="f-type">النوع</label>
          ${raw(typeField)}
        </div>
      </div>
      <div class="field">
        <label for="f-place">المكان</label>
        <input id="f-place" name="placeName" type="text" placeholder="المصنع — موسكو" />
      </div>
      <div class="field">
        <label for="f-context">سياق قصير</label>
        <textarea id="f-context" name="context" placeholder="إيه اللي حصل في اللحظة دي؟"></textarea>
      </div>`,

    async onSubmit(data, close) {
      if (!data.titleAr?.trim()) {
        toastError('العنوان بالعربي مطلوب');
        throw new Error('العنوان مطلوب');
      }
      const scene = await createScene(data);
      close();
      toastOk('الذكرى اتحفظت');
      navigate(`/scene/${scene.id}`);
    },
  });
}

export async function openEditSceneModal(sceneId) {
  const scene = await scenes.get(sceneId);
  if (!scene) return;

  const typeField = await typeSelect('type', scene.type);
  await showModal({
    title: 'تعديل بيانات الذكرى',
    body: html`
      <div class="field">
        <label for="e-titleAr">العنوان بالعربي</label>
        <input id="e-titleAr" name="titleAr" type="text" value="${scene.titleAr || ''}" />
      </div>
      <div class="field">
        <label for="e-titleRu">العنوان بالروسي</label>
        <input id="e-titleRu" name="titleRu" type="text" dir="ltr" lang="ru" value="${scene.titleRu || ''}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="e-date">التاريخ</label>
          <input id="e-date" name="date" type="date" value="${scene.date || today()}" />
        </div>
        <div class="field">
          <label for="f-type">النوع</label>
          ${raw(typeField)}
        </div>
      </div>
      <div class="field">
        <label for="e-place">المكان</label>
        <input id="e-place" name="placeName" type="text" value="${scene.placeName || ''}" />
      </div>
      <div class="field">
        <label for="e-context">سياق قصير</label>
        <textarea id="e-context" name="context">${scene.context || ''}</textarea>
      </div>`,

    async onSubmit(data, close) {
      await scenes.update(sceneId, data);
      close();
      toastOk('اتحفظ');
      reloadScene(sceneId);
    },
  });
}

/**
 * LingoLife — نماذج محتوى الذكرى
 *
 * السكريبت وجزء المحادثة والتصحيح والتعبير. أربعة نماذج يجمعها أنها
 * كلها تكتب داخل ذكرى ثم تعيد رسمها.
 *
 * ⚠️ القيم تُقرأ داخل `onSubmit` لا بعد إغلاق النافذة: النافذة تُزال
 *    من الـDOM عند الإغلاق، فالقراءة بعده تعيد فراغًا دائمًا.
 */

import { html, raw } from '../utils/dom.js';
import { scenes, scripts } from '../db/repositories.js';
import {
  addScript, updateScript, SCRIPT_TYPES,
  addConversationPart, addMistake, MISTAKE_TYPES,
  addExpression, REGISTERS,
} from '../services/content-service.js';
import { showModal } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { typeSelect, selectOptions } from '../components/type-select.js';
import { ui, reloadScene } from '../ui-state.js';

export async function openScriptModal(sceneId, scriptId = null) {
  const existing = scriptId ? await scripts.get(scriptId) : null;

  // نوع الموقف يرث نوع الذكرى، ويجوز أن يختلف: ذكرى «فحص» قد يكون
  // فيها سكريبت للمكالمة التي سبقته.
  const scene = await scenes.get(sceneId);
  const sceneTypeField = await typeSelect('sceneType', existing?.sceneType || scene?.type);

  await showModal({
    title: existing ? 'تعديل السكريبت' : 'سكريبت جديد',
    body: html`
      <div class="field-row">
        <div class="field">
          <label for="s-title">الاسم</label>
          <input id="s-title" name="title" type="text" value="${existing?.title || ''}"
            placeholder="السكريبت الأساسي" />
        </div>
        <div class="field">
          <label for="s-type">صيغة النص</label>
          <select id="s-type" name="type">${raw(selectOptions(SCRIPT_TYPES, existing?.type))}</select>
        </div>
      </div>
      <div class="field">
        <label for="f-sceneType">نوع الموقف</label>
        ${raw(sceneTypeField)}
      </div>
      <div class="field">
        <label for="s-text">النص بالروسي</label>
        <textarea id="s-text" name="text" dir="ltr" lang="ru" style="min-height:180px"
          placeholder="Сегодня мы обсуждали…">${existing?.text || ''}</textarea>
      </div>`,

    async onSubmit(data, close) {
      if (existing) {
        await updateScript(scriptId, data);
      } else {
        const created = await addScript(sceneId, data);
        ui.activeScriptId = created.id;
      }
      close();
      toastOk(existing ? 'اتحفظ — واتسجّلت نسخة في التاريخ' : 'السكريبت اتضاف');
      reloadScene(sceneId);
    },
  });
}

export async function openPartModal(sceneId) {
  await showModal({
    title: 'جزء من المحادثة',
    submitLabel: 'أضف',
    body: html`
      <div class="field-row">
        <div class="field">
          <label for="p-speaker">المتحدث</label>
          <input id="p-speaker" name="speaker" type="text" placeholder="Алексей" />
        </div>
        <div class="field">
          <label for="p-mine">مين بيتكلم</label>
          <select id="p-mine" name="isMine">
            <option value="">شخص تاني</option>
            <option value="1">أنا</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="p-text">الكلام بالروسي</label>
        <textarea id="p-text" name="text" dir="ltr" lang="ru"
          placeholder="Сейчас одно несоответствие ещё согласовывается."></textarea>
      </div>
      <div class="field">
        <label for="p-tr">الترجمة (اختياري)</label>
        <input id="p-tr" name="translation" type="text" placeholder="دلوقتي في عدم مطابقة واحد لسه بيتوافق عليه" />
      </div>`,

    async onSubmit(data, close) {
      if (!data.text?.trim()) {
        toastError('الكلام مطلوب');
        throw new Error('فارغ');
      }
      await addConversationPart(sceneId, data);
      close();
      toastOk('الجزء اتضاف');
      reloadScene(sceneId);
    },
  });
}

export async function openMistakeModal(sceneId) {
  await showModal({
    title: 'تصحيح — خطأ / طبيعي',
    submitLabel: 'أضف',
    body: html`
      <div class="field">
        <label for="m-wrong">اللي قلته</label>
        <textarea id="m-wrong" name="wrong" dir="ltr" lang="ru"
          placeholder="Сейчас один несоответствие согласовывается."></textarea>
      </div>
      <div class="field">
        <label for="m-nat">اللي المفروض يتقال</label>
        <textarea id="m-nat" name="natural" dir="ltr" lang="ru"
          placeholder="Сейчас одно несоответствие ещё согласовывается."></textarea>
      </div>
      <div class="field">
        <label for="m-type">نوع الخطأ</label>
        <select id="m-type" name="mistakeType">${raw(selectOptions(MISTAKE_TYPES, 'gender'))}</select>
      </div>
      <div class="field">
        <label for="m-exp">الشرح بالمصري</label>
        <textarea id="m-exp" name="explanation"
          placeholder="несоответствие كلمة محايدة، فبنقول одно مش один."></textarea>
      </div>`,

    async onSubmit(data, close) {
      if (!data.wrong?.trim() || !data.natural?.trim()) {
        toastError('لازم تكتب النسختين');
        throw new Error('ناقص');
      }
      await addMistake(sceneId, data);
      close();
      toastOk('التصحيح اتضاف');
      reloadScene(sceneId);
    },
  });
}

export async function openExpressionModal(sceneId) {
  await showModal({
    title: 'تعبير جديد',
    submitLabel: 'أضف',
    body: html`
      <div class="field">
        <label for="x-text">التعبير بالروسي</label>
        <input id="x-text" name="text" type="text" dir="ltr" lang="ru"
          placeholder="направить на согласование" />
      </div>
      <div class="field">
        <label for="x-mean">معناه بالمصري</label>
        <input id="x-mean" name="meaningAr" type="text" placeholder="يبعت للموافقة" />
      </div>
      <div class="field">
        <label for="x-reg">التصنيف</label>
        <select id="x-reg" name="register">${raw(selectOptions(REGISTERS, 'professional'))}</select>
      </div>
      <div class="field">
        <label for="x-note">ملاحظة (اختياري)</label>
        <textarea id="x-note" name="note" placeholder="بيتقال في الشغل الرسمي"></textarea>
      </div>`,

    async onSubmit(data, close) {
      if (!data.text?.trim()) {
        toastError('نص التعبير مطلوب');
        throw new Error('فارغ');
      }
      const { isNew } = await addExpression(sceneId, data);
      close();
      toastOk(isNew ? 'التعبير اتضاف' : 'التعبير موجود — سجّلنا ظهوره في الذكرى دي');
      reloadScene(sceneId);
    },
  });
}

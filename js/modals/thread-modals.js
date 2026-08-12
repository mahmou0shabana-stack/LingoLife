/**
 * LingoLife — نوافذ الخيوط
 *
 * «بتكمّل قصّة موجودة؟» — السؤال الذي يحوّل ذكرياتٍ متفرّقة إلى قصص.
 *
 * ⚠️ **بأسماء بشريّة لا معرّفات** (بند 29): تختار «شحنة أبريل اللي
 *    اتأخّرت»، لا `THR_01K…`. والاقتراحات تحمل أسبابها بالنصّ فتعرف
 *    لماذا اقترحناها قبل أن توافق.
 */

import { html, raw, esc } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { formatDate } from '../utils/dates.js';
import {
  THREAD_STATUS,
  THREAD_STATUS_LABEL,
  listThreads,
  createThread,
  updateThread,
  getThread,
  addSceneToThread,
  threadsOfScene,
  suggestThreadsFor,
} from '../services/thread-service.js';

/**
 * يربط ذكرى بقصّة: خيطٌ قائم، أو جديد، أو لا شيء.
 *
 * الخيار الثالث ليس مهربًا: **أغلب الذكريات أحداثٌ مستقلّة**، وإجبارك
 * على وضع كلٍّ منها في قصّة يفرّغ القصّة من معناها.
 */
export async function openThreadLinkModal(sceneId, onDone) {
  const [current, all, suggestions] = await Promise.all([
    threadsOfScene(sceneId),
    listThreads(),
    suggestThreadsFor(sceneId),
  ]);

  const currentIds = new Set(current.map((t) => t.id));
  const available = all.filter((t) => !currentIds.has(t.id));

  let result = null;

  const value = await showModal({
    title: 'بتكمّل قصّة موجودة؟',
    submitLabel: 'اربط',
    body: html`
      ${raw(
        current.length
          ? html`<p class="field-hint">
              الذكرى دي في: <strong>${raw(current.map((t) => esc(t.title)).join(' · '))}</strong>
            </p>`
          : ''
      )}

      ${raw(
        suggestions.length
          ? html`
            <div class="thread-suggest">
              <h4>${suggestions.length === 1 ? 'اقتراح' : 'اقتراحات'}</h4>
              <!--
                ⚠️ كل اقتراح بسببه. اقتراحٌ بلا سببٍ معروض تخمينٌ يطلب
                   ثقةً لم يكسبها (بند 31).
              -->
              ${raw(
                suggestions
                  .map(
                    (s) => html`
                      <label class="thread-suggest-row">
                        <input type="radio" name="pick" value="${s.thread.id}" />
                        <span>
                          <b>${s.thread.title}</b>
                          <small>${s.reasons.join(' + ')}</small>
                        </span>
                      </label>`
                  )
                  .join('')
              )}
            </div>`
          : ''
      )}

      ${raw(
        available.length
          ? html`
            <div class="field">
              <label for="th-pick">أو اختر خيطًا</label>
              <select id="th-pick" name="existing">
                <option value="">—</option>
                ${raw(
                  available
                    .map(
                      (t) =>
                        `<option value="${t.id}">${t.title} — ${THREAD_STATUS_LABEL[t.status]}</option>`
                    )
                    .join('')
                )}
              </select>
            </div>`
          : ''
      )}

      <div class="field">
        <label for="th-new">أو ابدأ قصّة جديدة</label>
        <input id="th-new" name="newTitle" type="text" maxlength="160"
          placeholder="مثلًا: شحنة أبريل اللي اتأخّرت" autocomplete="off" />
      </div>

      <p class="field-hint">
        ولو ده حدث مستقلّ، اقفل النافذة — <strong>مش كل ذكرى لازم تبقى
        في قصّة</strong>.
      </p>`,

    onSubmit(data, close) {
      result = data;
      close();
    },
  });

  if (value !== 'submit' || !result) return;

  try {
    const title = (result.newTitle || '').trim();
    // الترتيب مقصود: ما كتبتَه بيدك يسبق ما اخترته من قائمة، وكلاهما
    // يسبق الاقتراح — الأقرب إلى نيّتك أوّلًا.
    if (title) {
      const thread = await createThread({ title });
      await addSceneToThread(thread.id, sceneId);
      toastOk(`بدأنا «${thread.title}» وضفنا الذكرى فيها.`);
    } else {
      const threadId = result.existing || result.pick;
      if (!threadId) return toast('ماخترتش حاجة.');
      await addSceneToThread(threadId, sceneId);
      const thread = await getThread(threadId);
      toastOk(`ضفناها في «${thread.title}».`);
    }
    onDone?.();
  } catch (err) {
    toastError(err.message || 'مقدرناش نربط');
  }
}

/** تعديل عنوان الخيط ووصفه وحالته. */
export async function openThreadEditModal(threadId, onDone) {
  const thread = await getThread(threadId);
  if (!thread) return;

  let form = null;
  const value = await showModal({
    title: 'تعديل الخيط',
    body: html`
      <div class="field">
        <label for="te-title">العنوان</label>
        <input id="te-title" name="title" type="text" maxlength="160"
          value="${thread.title}" />
      </div>
      <div class="field">
        <label for="te-desc">الوصف (اختياري)</label>
        <textarea id="te-desc" name="description"
          placeholder="القصّة دي عن إيه بالظبط؟">${thread.description}</textarea>
      </div>
      <div class="field">
        <label for="te-status">الحالة</label>
        <select id="te-status" name="status">
          ${raw(
            Object.values(THREAD_STATUS)
              .map(
                (s) =>
                  `<option value="${s}"${s === thread.status ? ' selected' : ''}>${THREAD_STATUS_LABEL[s]}</option>`
              )
              .join('')
          )}
        </select>
      </div>
      ${raw(
        thread.endDate
          ? html`<p class="field-hint">اتقفلت في ${formatDate(thread.endDate)}.</p>`
          : ''
      )}`,
    onSubmit(data, close) {
      form = data;
      close();
    },
  });

  if (value !== 'submit' || !form) return;
  if (!form.title?.trim()) return toastError('العنوان مطلوب');

  try {
    await updateThread(threadId, {
      title: form.title.trim(),
      description: (form.description || '').trim(),
      status: form.status,
    });
    toastOk('اتحفظ.');
    onDone?.();
  } catch (err) {
    toastError(err.message || 'مقدرناش نحفظ');
  }
}

/**
 * LingoLife — ربط الوسائط وتصنيفها
 *
 * الذكرى ليست أكوامًا منفصلة: **هذه الصورة** لها **هذا السكريبت**
 * و**هذا التسجيل**. بدون ربط صريح تبقى المطابقة في رأسك وحدك.
 */

import { html, raw } from '../utils/dom.js';
import { media, scripts, sceneMediaLinks } from '../db/repositories.js';
import { urlFor } from '../services/media-service.js';
import { LINK, AUDIO_TAGS, link, unlink, resolveLinks, setTags } from '../services/link-service.js';
import { showModal } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { reloadScene } from '../ui-state.js';

/**
 * منتقي الطرف المقابل — **بالنظر لا بالاسم** (WS34).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ بلاغُك: «ربط الفويسات بالصور اتفقنا نعملها بشكل بصريّ بدل
 *    العناوين علشان نسهّل الربط»
 * ═══════════════════════════════════════════════════════════════
 *
 * وكان السطر `m.caption || m.filename` — أي `IMG_20260514_093311.jpg`.
 * وهو اسمٌ **لا يدلّ على شيء**: تعرف صورتَك حين تراها لا حين تقرأ
 * رقمَ عدّادِ الكاميرا. فكان الربطُ تخمينًا، ولذلك لم يُستعمَل.
 *
 * فالصورةُ تُعرَض صورةً، والتسجيلُ يُعرَض بدَورِه ومدّته — لأن
 * التسجيلَ لا صورةَ له، ودَورُه («نطق»، «إعادة سرد») هو أقربُ ما
 * يميّزه.
 *
 * ⚠️ **ومربّعُ الاختيار يبقى.** جرّبتُ إخفاءه والاكتفاءَ بإطارٍ
 *    مضيء، فصار على المستعمِل أن يستنتج أنه اختار — والاستنتاجُ
 *    ليس تأكيدًا. فالإطارُ **مع** العلامة.
 */
function mediaPicker(rows, linkedIds, isAudio) {
  return html`<div class="pair-grid">
    ${raw(
      rows
        .map((m) => {
          const on = linkedIds.has(m.id);
          const face = m.kind === 'image'
            ? html`<img src="${urlFor(m, { thumb: true })}" alt="" loading="lazy" />`
            : html`<span class="pair-audio">♪</span>`;
          const name = m.caption || (m.kind === 'image' ? 'صورة' : 'تسجيل');
          return html`<label class="pair-cell${on ? ' on' : ''}">
            <input type="checkbox" name="media:${m.id}" ${on ? 'checked' : ''} />
            <span class="pair-face">${raw(face)}<b class="pair-tick">✓</b></span>
            <span class="pair-name">${name}</span>
          </label>`;
        })
        .join('')
    )}
  </div>${raw(
    isAudio ? '<p class="field-hint">دوس على الصورة اللي التسجيل ده بتاعها.</p>' : ''
  )}`;
}

/**
 * ربط وسيط بالنصوص وبالوسائط الأخرى، وتصنيفه.
 *
 * الذكرى ليست أكوامًا منفصلة: **هذه الصورة** لها **هذا السكريبت**
 * و**هذا التسجيل**. بدون ربط صريح تبقى المطابقة في رأسك وحدك.
 */
export async function openLinksModal(mediaId, sceneId) {
  const record = await media.get(mediaId);
  if (!record) return;

  const isAudio = record.kind === 'audio';
  const [sceneScripts, sceneMedia, existing] = await Promise.all([
    scripts.byIndex('sceneId', sceneId),
    (async () => {
      const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
      const rows = await Promise.all(links.map((l) => media.get(l.mediaId)));
      return rows.filter((m) => m && m.id !== mediaId);
    })(),
    resolveLinks(mediaId),
  ]);

  const linkedIds = new Set(existing.map((e) => e.entity.id));
  const tags = record.tags || [];

  // الصوت يُربط بالصور، والصورة تُربط بالأصوات — الطرف المقابل دائمًا.
  const others = sceneMedia.filter((m) => (isAudio ? m.kind === 'image' : m.kind === 'audio'));
  const pairKind = isAudio ? LINK.AUDIO_IMAGE : LINK.IMAGE_SCRIPT;
  const scriptKind = isAudio ? LINK.AUDIO_SCRIPT : LINK.IMAGE_SCRIPT;

  let form = null;
  await showModal({
    title: isAudio ? 'اربط التسجيل وصنّفه' : 'اربط الصورة',
    submitLabel: 'احفظ',
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3)">
        ${record.caption || record.filename}
      </p>

      ${raw(
        isAudio
          ? html`<div class="field">
              <label>التصنيف</label>
              <div class="tag-pick">
                ${raw(
                  AUDIO_TAGS.map(
                    (tag) => html`<label class="tag-chip${tags.includes(tag) ? ' on' : ''}">
                      <input type="checkbox" name="tag:${tag}" ${tags.includes(tag) ? 'checked' : ''} />
                      <span>${tag}</span>
                    </label>`
                  ).join('')
                )}
              </div>
            </div>`
          : ''
      )}

      ${raw(
        sceneScripts.length
          ? html`<div class="field">
              <label>${isAudio ? 'بينطق أنهي سكريبت؟' : 'أنهي سكريبت بيشرحها؟'}</label>
              ${raw(
                sceneScripts
                  .map(
                    (sc) => html`<label class="pick-row">
                      <input type="checkbox" name="script:${sc.id}" ${linkedIds.has(sc.id) ? 'checked' : ''} />
                      <span dir="ltr">${(sc.text || '').slice(0, 90) || sc.title || 'سكريبت'}</span>
                    </label>`
                  )
                  .join('')
              )}
            </div>`
          : html`<p class="field-hint">مفيش سكريبتات في الذكرى دي لسه.</p>`
      )}

      ${raw(
        others.length
          ? html`<div class="field">
              <label>${isAudio ? 'التسجيل ده بتاع أنهي صورة؟' : 'أنهي تسجيل صوت الصورة دي؟'}</label>
              ${raw(mediaPicker(others, linkedIds, isAudio))}
            </div>`
          : ''
      )}`,
    /*
     * ⚠️ **الإطارُ يتبع المربّعَ لحظةَ الضغط لا لحظةَ الرسم.**
     *    بدونها تختار صورةً فلا يتغيّر شيءٌ تراه — والمربّعُ مُخفًى
     *    بصريًّا، فتظنّ أن ضغطتَك لم تصل وتضغط ثانيةً فتُلغيها.
     */
    onMount(modal) {
      for (const box of modal.querySelectorAll('.pair-cell input')) {
        box.addEventListener('change', () => {
          box.closest('.pair-cell')?.classList.toggle('on', box.checked);
        });
      }
    },
    onSubmit(data, close) {
      form = data;
      close();
    },
  });

  if (!form) return;

  const keys = Object.keys(form);
  const picked = (prefix) =>
    new Set(keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)));

  const wantScripts = picked('script:');
  const wantMedia = picked('media:');

  // نُطبّق الفرق فقط: نربط الجديد ونفكّ ما أُزيل.
  await Promise.all([
    ...[...wantScripts].map((id) => link(mediaId, id, scriptKind)),
    ...[...wantMedia].map((id) => link(mediaId, id, pairKind)),
    ...existing
      .filter((e) => !wantScripts.has(e.entity.id) && !wantMedia.has(e.entity.id))
      .map((e) => unlink(mediaId, e.entity.id, e.kind)),
  ]);

  if (isAudio) {
    await setTags(mediaId, [...picked('tag:')]);
  }

  toastOk('اتحفظت الروابط');
  reloadScene(sceneId);
}

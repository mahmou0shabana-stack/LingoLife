/**
 * LingoLife — عارض الصورة
 *
 * يفتح الصورة بحجمها الكامل مع ما يمكن فعله بها: تعيينها غلافًا،
 * ربطها بنصّ أو صوت، استخراج نصّها للتدرّب، تنزيل الأصل، وإزالتها من
 * الذكرى بتأكيدٍ وتراجع.
 */

import { html, raw } from '../utils/dom.js';
import { media } from '../db/repositories.js';
import { setCover, removeFromScene, undoRemove, urlFor } from '../services/media-service.js';
import { resolveLinks } from '../services/link-service.js';
import { toastOk } from './toast.js';
import { actWithUndo } from '../services/delete-service.js';
import { reloadScene } from '../ui-state.js';
import { openLinksModal } from '../modals/link-modal.js';
import { openShadowFromImage } from '../services/shadow/shadow-entry.js';

/** عارض الصورة — مع تعيين غلاف وتنزيل الأصل وإزالة. */
export async function openLightbox(mediaId, sceneId) {
  const record = await media.get(mediaId);
  if (!record) return;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = html`
    <button class="lightbox-close" aria-label="إغلاق">✕</button>
    <img src="${urlFor(record, { thumb: false })}" alt="${record.caption || ''}">
    <div class="lightbox-bar">
      <button data-lb="cover">اجعلها الغلاف</button>
      <button data-lb="links">اربطها بصوت أو نصّ</button>
      <button data-lb="shadow">استخرج النصّ واتدرّب</button>
      <button data-lb="download">نزّل الأصل</button>
      <button data-lb="remove" class="danger">شيلها من الذكرى</button>
    </div>
    <div class="lightbox-links" data-lb-links></div>`;

  // نعرض ما هو مرتبط بها فعلًا — لا يحتاج المستخدم أن يتذكّر.
  resolveLinks(mediaId)
    .then((links) => {
      const host = box.querySelector('[data-lb-links]');
      if (!host || !links.length) return;
      host.innerHTML = links
        .map((l) => {
          const label = l.entity.kind === 'audio'
            ? `🎙 ${l.entity.caption || l.entity.filename}`
            : `📄 ${(l.entity.text || '').slice(0, 40) || 'سكريبت'}`;
          return `<span class="link-badge">${label}</span>`;
        })
        .join('');
    })
    .catch(() => {});

  const close = () => {
    box.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  box.addEventListener('click', async (e) => {
    if (e.target === box || e.target.closest('.lightbox-close')) return close();

    const action = e.target.closest('[data-lb]')?.dataset.lb;
    if (!action) return;

    if (action === 'cover') {
      await setCover(sceneId, mediaId);
      close();
      toastOk('بقت الغلاف');
      reloadScene(sceneId);
    }

    if (action === 'links') {
      close();
      openLinksModal(mediaId, sceneId);
    }

    if (action === 'shadow') {
      close();
      openShadowFromImage(mediaId, sceneId);
    }

    if (action === 'download') {
      const { downloadBlob } = await import('../utils/dom.js');
      // الأصل كما رُفع — بايت ببايت
      downloadBlob(record.blob, record.filename || `${record.id}.jpg`);
    }

    if (action === 'remove') {
      // الملف نفسه يبقى في `media`؛ الذي يُشال هو ربطه بالذكرى —
      // فالتراجع لا يحتاج أن يجد الـ Blob من جديد.
      let linkId = null;
      await actWithUndo({
        what: 'الصورة دي',
        detail: record.caption || record.filename || '',
        confirmLabel: 'شيلها',
        remove: async () => {
          linkId = await removeFromScene(sceneId, mediaId);
          close();
        },
        restore: () => undoRemove(linkId),
        after: () => reloadScene(sceneId),
      });
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.append(box);
}

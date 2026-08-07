/**
 * LingoLife — خدمة الوسائط
 *
 * ⚠️ قاعدة ملزمة (بند 20): الملف الأصلي يُخزَّن كـ Blob كما جاء، بايت ببايت.
 *    المصغّرة كائن منفصل للعرض السريع — ولا تحلّ محلّ الأصل أبدًا.
 */

import { media, sceneMediaLinks, scenes } from '../db/repositories.js';
import { STATE } from '../db/schema.js';

/** أقصى بُعد للمصغّرة. الأصل لا يُمسّ. */
const THUMB_MAX = 480;

/** أدوار الصورة (بند 18) — صورة واحدة قد تحمل أكثر من دور. */
export const ROLE = Object.freeze({
  COVER: 'cover',
  RECALL: 'recall',
  TIMELINE: 'timeline',
  EDUCATIONAL: 'educational',
});

/** أدوار الصوت (بند 21). */
export const AUDIO_ROLE = Object.freeze({
  ORIGINAL: 'original',
  SCRIPT_VOICE: 'scriptVoice',
  CONVERSATION: 'conversation',
  RETELLING: 'retelling',
  PRONUNCIATION: 'pronunciation',
  NOTE: 'note',
});

export const AUDIO_ROLE_LABEL = {
  original: 'التسجيل الأصلي',
  scriptVoice: 'صوت السكريبت',
  conversation: 'المحادثة',
  retelling: 'إعادة سرد',
  pronunciation: 'نطق',
  note: 'ملاحظة صوتية',
};

/**
 * يولّد مصغّرة من صورة. يفشل بهدوء ويعيد null — الأصل هو المهم.
 * @returns {Promise<{blob: Blob, width: number, height: number} | null>}
 */
async function makeThumb(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    return { blob, width: w, height: h };
  } catch (err) {
    console.warn('[media] تعذّر توليد المصغّرة — الأصل محفوظ كما هو', err);
    return null;
  }
}

/** يقرأ أبعاد الصورة الأصلية. */
async function imageSize(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

/** يقرأ مدة ملف صوتي بالملّي ثانية. */
function audioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (ms) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.addEventListener('loadedmetadata', () => {
      const d = audio.duration;
      done(Number.isFinite(d) ? Math.round(d * 1000) : null);
    });
    audio.addEventListener('error', () => done(null));
    audio.src = url;
    // بعض صيغ webm لا تعلن المدة — لا ننتظر للأبد
    setTimeout(() => done(null), 4000);
  });
}

/** الترتيب التالي داخل المشهد. */
async function nextOrder(sceneId) {
  const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
  return links.reduce((max, l) => Math.max(max, l.order ?? 0), 0) + 1;
}

/**
 * يضيف ملفات (صور أو صوت) إلى مشهد.
 * @param {string} sceneId
 * @param {File[]} files
 * @param {{ kind?: 'image'|'audio', role?: string }} options
 * @returns {Promise<{added: number, failed: number, mediaIds: string[]}>}
 */
export async function addFilesToScene(sceneId, files, options = {}) {
  const list = [...files];
  const result = { added: 0, failed: 0, mediaIds: [] };
  let order = await nextOrder(sceneId);

  for (const file of list) {
    try {
      const kind = options.kind || (file.type.startsWith('audio') ? 'audio' : 'image');

      const record = {
        kind,
        // الأصل كما جاء — بلا إعادة ترميز
        blob: file,
        mime: file.type || (kind === 'image' ? 'image/jpeg' : 'audio/webm'),
        filename: file.name || `${kind}-${Date.now()}`,
        bytes: file.size,
        thumbBlob: null,
        width: null,
        height: null,
        durationMs: null,
        caption: '',
        notes: '',
      };

      if (kind === 'image') {
        const [thumb, size] = await Promise.all([makeThumb(file), imageSize(file)]);
        if (thumb) record.thumbBlob = thumb.blob;
        record.width = size.width;
        record.height = size.height;
      } else {
        record.durationMs = await audioDuration(file);
      }

      const saved = await media.create(record);

      await sceneMediaLinks.create({
        sceneId,
        mediaId: saved.id,
        order: order++,
        roles: options.role ? [options.role] : [],
        label: '',
      });

      result.added++;
      result.mediaIds.push(saved.id);
    } catch (err) {
      console.error('[media] فشل إضافة ملف', file?.name, err);
      result.failed++;
    }
  }

  // أول صورة تصبح الغلاف تلقائيًا لو لم يكن هناك غلاف
  if (result.added && (options.kind || 'image') === 'image') {
    const scene = await scenes.get(sceneId);
    if (scene && !scene.coverMediaId) {
      await scenes.update(sceneId, { coverMediaId: result.mediaIds[0] });
    }
  }

  return result;
}

/** يعيّن صورة كغلاف للمشهد. */
export async function setCover(sceneId, mediaId) {
  await scenes.update(sceneId, { coverMediaId: mediaId });

  // نحدّث الأدوار على الروابط ليبقى الدور مقروءًا من الرابط أيضًا
  const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
  for (const link of links) {
    const has = (link.roles || []).includes(ROLE.COVER);
    const shouldHave = link.mediaId === mediaId;
    if (has === shouldHave) continue;
    const roles = (link.roles || []).filter((r) => r !== ROLE.COVER);
    if (shouldHave) roles.push(ROLE.COVER);
    await sceneMediaLinks.update(link.id, { roles });
  }
}

/**
 * يزيل وسيطًا من مشهد (إلى السلة، قابل للاسترجاع).
 * الملف الأصلي يبقى في `media` — لا نتلف بيانات بصمت (بند 52).
 */
export async function removeFromScene(sceneId, mediaId) {
  const links = await sceneMediaLinks.byIndex('sceneId', sceneId);
  const link = links.find((l) => l.mediaId === mediaId);
  if (link) await sceneMediaLinks.trash(link.id);

  const scene = await scenes.get(sceneId);
  if (scene?.coverMediaId === mediaId) {
    const rest = links.filter((l) => l.mediaId !== mediaId && l.state === STATE.ACTIVE);
    const replacement = rest[0]?.mediaId || null;
    await scenes.update(sceneId, { coverMediaId: replacement });
  }
  return link?.id || null;
}

/** يتراجع عن الإزالة. */
export async function undoRemove(linkId) {
  if (linkId) await sceneMediaLinks.restore(linkId);
}

/* ------------------------------------------------------------
   روابط الكائنات (Object URLs)
   ------------------------------------------------------------ */

const urlCache = new Map();

/**
 * يعطي رابط عرض لوسيط. يفضّل المصغّرة للقوائم.
 * الروابط مخزّنة مؤقتًا ثم تُحرَّر بـ releaseUrls عند مغادرة الشاشة —
 * بدون ذلك تتسرّب الذاكرة على التابلت.
 */
export function urlFor(mediaRecord, { thumb = true } = {}) {
  if (!mediaRecord) return null;
  const blob = thumb && mediaRecord.thumbBlob ? mediaRecord.thumbBlob : mediaRecord.blob;
  if (!blob) return null;

  const key = `${mediaRecord.id}:${thumb && mediaRecord.thumbBlob ? 't' : 'o'}`;
  if (urlCache.has(key)) return urlCache.get(key);

  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

/** يحرّر كل الروابط المخزّنة. يُستدعى عند تغيير الشاشة. */
export function releaseUrls() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

/* ------------------------------------------------------------
   التسجيل الصوتي
   ------------------------------------------------------------ */

/** هل التسجيل مدعوم في هذا المتصفح؟ */
export function canRecord() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

/**
 * يبدأ تسجيلًا صوتيًا.
 * Opus تقريبًا 0.35 ميجا للدقيقة — وهذه صيغة التقاط أصلية لا ضغط مدمّر.
 * @returns {Promise<{stop: () => Promise<File>, cancel: () => void}>}
 */
export async function startRecording() {
  if (!canRecord()) throw new Error('المتصفح ده مش بيدعم التسجيل الصوتي');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType = preferred.find((t) => MediaRecorder.isTypeSupported(t)) || '';

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data.size) chunks.push(e.data);
  });
  recorder.start();

  const cleanup = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop() {
      return new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            cleanup();
            const type = recorder.mimeType || 'audio/webm';
            const ext = type.includes('mp4') ? 'm4a' : 'webm';
            const blob = new Blob(chunks, { type });
            resolve(new File([blob], `تسجيل-${Date.now()}.${ext}`, { type }));
          },
          { once: true }
        );
        recorder.stop();
      });
    },
    cancel() {
      try {
        recorder.stop();
      } catch {
        /* متوقف بالفعل */
      }
      cleanup();
    },
  };
}

/* ------------------------------------------------------------
   اختيار الملفات
   ------------------------------------------------------------ */

/**
 * يفتح منتقي الملفات ويعيد الملفات المختارة.
 * @param {{ accept?: string, multiple?: boolean, capture?: boolean }} options
 * @returns {Promise<File[]>}
 */
export function pickFiles({ accept = 'image/*', multiple = true, capture = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    if (capture) input.capture = 'environment';
    input.style.display = 'none';

    input.addEventListener(
      'change',
      () => {
        const files = [...(input.files || [])];
        input.remove();
        resolve(files);
      },
      { once: true }
    );

    // لو ألغى المستخدم، لا يقع حدث change في كل المتصفحات — ننظّف لاحقًا
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (document.body.contains(input)) {
            input.remove();
            resolve([]);
          }
        }, 500);
      },
      { once: true }
    );

    document.body.append(input);
    input.click();
  });
}

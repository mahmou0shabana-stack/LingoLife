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
  /*
   * ⚠️ **دورٌ جديدٌ أصغرُ ما يكفي** (WS-I · بند ١٨).
   *
   *    سُئل أوّلًا: أيكفي `pronunciation`؟ ولا يكفي — وهو مستعمَلٌ منذ
   *    WS23 لتسجيلاتٍ تُلقى على الذكرى **بلا هدفِ تدريبٍ ولا مدًى**.
   *    فلو خُلطا لَظهرت تلك التسجيلاتُ القديمةُ في سجلّ محاولاتِ كلّ
   *    جملةٍ في الذكرى — وهو بالضبط الخلطُ الذي يمنعه بند ١٥.
   *
   *    والمعرِّفُ هو الهُويّة (راجع `audio-role-service`)، فتسميتُه
   *    تُعدَّل من الشاشة بلا هجرة.
   */
  MY_VOICE: 'myVoice',
});

export const AUDIO_ROLE_LABEL = {
  original: 'التسجيل الأصلي',
  scriptVoice: 'صوت السكريبت',
  conversation: 'المحادثة',
  retelling: 'إعادة سرد',
  pronunciation: 'نطق',
  note: 'ملاحظة صوتية',
  myVoice: 'صوتي أنا',
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

/**
 * وسائط الذكرى بترتيب عرضها.
 *
 * ⚠️ **بالترتيب المحفوظ في الرابط لا في `media`.** الصور تُرتَّب داخل
 *    الذكرى، والملفّ نفسه قد يظهر في ذكرياتٍ عدّة بترتيبٍ مختلف — فما
 *    يحكم هو الرابط.
 */
export async function sceneMedia(sceneId, kind = null) {
  const links = (await sceneMediaLinks.byIndex('sceneId', sceneId))
    .filter((link) => link.state === STATE.ACTIVE)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const rows = await media.getMany(links.map((link) => link.mediaId));
  return rows
    .filter((row) => row && row.state === STATE.ACTIVE)
    .filter((row) => !kind || row.kind === kind);
}

/**
 * يكتب وصف الوسيط.
 *
 * ⚠️ `caption` كان يُكتب `''` عند الإنشاء **ولا يُملأ في أي مكان** —
 *    حقلٌ ميّت كـ`peopleIds`. والعارض كان يعرض اسم الملفّ بدلًا منه:
 *    `IMG_20260212.jpg` مكان «لافتة المستودع».
 */
export async function setCaption(mediaId, caption) {
  return media.update(mediaId, { caption: (caption || '').trim() });
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

/**
 * يخزّن صورةً **بلا مشهد** — للقطات مختبر التطوّر.
 *
 * ⚠️ نفس مسار `addFilesToScene` في كل ما يخصّ البايتات: الأصل بلا
 *    إعادة ترميز، ومصغّرةٌ للعرض، والمقاسات. الفرق الوحيد أنه لا
 *    يُنشئ رابطًا بمشهد — فاللقطة ليست ذكرى.
 *
 * ⚠️ وتُخزَّن في `media` لا في مستودعٍ جديد للصور: النسخة الاحتياطيّة
 *    والسلّة وتحرير الروابط كلها تعرف هذا المكان بالفعل.
 */
export async function storeStandaloneImage(file, { kind = 'image' } = {}) {
  const record = {
    kind,
    blob: file,
    mime: file.type || 'image/png',
    filename: file.name || `shot-${Date.now()}`,
    bytes: file.size,
    thumbBlob: null,
    width: null,
    height: null,
    durationMs: null,
    caption: '',
    notes: '',
  };

  const [thumb, size] = await Promise.all([makeThumb(file), imageSize(file)]);
  if (thumb) record.thumbBlob = thumb.blob;
  record.width = size.width;
  record.height = size.height;

  return media.create(record);
}

/**
 * يخزّن **مستندًا** بلا مشهد — ملخّصُ القواعد الشخصيّ (WS-B).
 *
 * ⚠️ **ولماذا دالّةٌ ثانيةٌ بدل `storeStandaloneImage` بـ`kind` آخر؟**
 *    لأن تلك تُنادي `createImageBitmap` مرّتين على البايتات. وملفُّ
 *    PDF ليس صورة: النداءان يفشلان فيُبتلع الفشل ويُكتب السجل —
 *    فيعمل الأمرُ **بالمصادفة** لا بالتصميم، ويدفع ثمنَ محاولتين
 *    على ملفٍّ قد يكون عشرة ميغابايت. فالفرقُ صريحٌ هنا.
 *
 * ⚠️ **والبايتاتُ في `media` كغيرها**: النسخةُ الاحتياطيّة والسلّةُ
 *    تعرفان هذا المكان، ولا يتعلّم أحدهما شيئًا جديدًا.
 *
 * @param {File|Blob} file
 * @param {{kind?: string}} options
 */
export async function storeDocument(file, { kind = 'doc' } = {}) {
  return media.create({
    kind,
    blob: file,
    mime: file.type || 'application/pdf',
    filename: file.name || `doc-${Date.now()}`,
    bytes: file.size,
    thumbBlob: null,
    width: null,
    height: null,
    durationMs: null,
    caption: '',
    notes: '',
  });
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
/* ------------------------------------------------------------------ *
 * الوسائطُ السحابيّة — جلبٌ كسولٌ بلا مشغّلٍ ثانٍ (WS-H، بندا ٧ و١٧)
 * ------------------------------------------------------------------ */

/**
 * جالبُ البايتات الغائبة — يُحقَن من طبقة السحابة عند الربط.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا حقنٌ لا استيراد؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * لو استوردت خدمةُ الوسائط طبقةَ السحابة لصارت **كلُّ صورةٍ في التطبيق**
 * تجرّ معها Google Drive — في الإقلاع، وفي الاختبار، وعند من لم يربط
 * حسابًا أصلًا. والاتّجاهُ الصحيح معكوس: السحابةُ تُعرّف نفسَها للوسائط،
 * والوسائطُ لا تعرف أن السحابة موجودة.
 *
 * فبلا ربط: `null`، والسلوكُ كما كان قبل WS-H بالضبط.
 */
let cloudFetcher = null;

/** تُنادى مرّةً عند ربط السحابة. */
export function setCloudFetcher(fetcher) {
  cloudFetcher = typeof fetcher === 'function' ? fetcher : null;
}

/** هل وصف الوسيط موجودٌ وبايتاتُه لا؟ */
export function isCloudOnly(record) {
  return Boolean(record) && !record.blob && record.blobPending === 1;
}

/**
 * يضمن وجودَ البايتات ثم يعيد الصفَّ الكامل.
 *
 * ⚠️ **وبعدها يُستعمَل المسارُ العاديّ حرفًا بحرف**: `urlFor` نفسُها،
 *    و`audio-service` نفسُها، و`lightbox` نفسُها. فلا «مشغّلُ سحابة»
 *    ولا «عارضُ سحابة» — هما نفسُ الاثنين، والفرقُ أن البايتات وصلت.
 */
export async function ensureBytes(mediaId, { role = 'original' } = {}) {
  const record = await media.get(mediaId);
  if (!record) return { ok: false, reason: 'الوسيط غير موجود' };
  if (record.blob) return { ok: true, record, alreadyLocal: true };
  if (!isCloudOnly(record)) {
    return { ok: false, reason: 'الملف مش موجود ومش على Drive', record };
  }
  if (!cloudFetcher) return { ok: false, reason: 'Google Drive مش متصل', record };

  const outcome = await cloudFetcher(mediaId, role);
  if (!outcome?.ok) return { ok: false, reason: outcome?.reason || 'فشل التنزيل', record };
  return { ok: true, record: await media.get(mediaId), alreadyLocal: false };
}

export function urlFor(mediaRecord, { thumb = true } = {}) {
  if (!mediaRecord) return null;
  const blob = thumb && mediaRecord.thumbBlob ? mediaRecord.thumbBlob : mediaRecord.blob;
  /*
   * ⚠️ **وتبقى متزامنةً تعيد `null`.** جعلُها غيرَ متزامنةٍ كان سيقلب
   *    ثمانيةَ عشرَ موضعَ نداءٍ في الشاشات إلى انتظار — أي إعادةَ كتابة
   *    كلِّ ما يعرض صورةً. فالعقدُ باقٍ: من أراد البايتات ينادي
   *    `ensureBytes` أوّلًا، ومن أراد أن يعرض حالةً ينادي `isCloudOnly`.
   */
  if (!blob) return null;

  const key = `${mediaRecord.id}:${thumb && mediaRecord.thumbBlob ? 't' : 'o'}`;
  if (urlCache.has(key)) return urlCache.get(key);

  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

/**
 * وسائطُ قيد الاستعمال الآن، لا تُحرَّر روابطها.
 *
 * ⚠️ **مالكٌ واحد للرابط.** كانت خدمة الصوت تُحرّر رابط المقطع السابق
 *    بنفسها بينما الكاش هنا لا يزال يحتفظ به — فيعود `urlFor` برابطٍ
 *    ميّت. المسار الحيّ الذي كشفه: شغّل تسجيلًا، ثم آخر، ثم عُد
 *    للأوّل → «الملف مش موجود» وهو موجود.
 *
 *    فالملكيّة هنا وحدها، والمُشغّل **يُعلن ما يستعمله** ولا يُحرّر.
 */
const pinned = new Set();

/** يثبّت وسائط فلا يُحرّرها تغيير الشاشة. */
export function pinMedia(ids) {
  for (const id of [].concat(ids)) if (id) pinned.add(id);
}

/** يفكّ التثبيت — ولا يُحرّر فورًا: `releaseUrls` صاحبة القرار. */
export function unpinMedia(ids) {
  for (const id of [].concat(ids)) pinned.delete(id);
}

/**
 * يحرّر الروابط المخزّنة. يُستدعى عند تغيير الشاشة.
 *
 * ⚠️ ما هو مثبَّت يبقى: الصوت يكمل بعد مغادرة الشاشة عمدًا (راجع
 *    `audio-service`)، وتحريرُ رابطه يقطعه عند أوّل تقديمٍ أو إعادة.
 */
export function releaseUrls() {
  for (const [key, url] of urlCache) {
    if (pinned.has(key.slice(0, key.lastIndexOf(':')))) continue;
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
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

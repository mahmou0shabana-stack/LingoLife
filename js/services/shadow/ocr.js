/**
 * LingoLife — استخراج النصّ من الصور (OCR)
 *
 * منقول من مسار Tesseract في التطبيق القديم، بمصدرين لا مصدر واحد:
 *
 *   1. **نسخة محلّية** في `vendor/tesseract/` → يعمل offline تمامًا،
 *      ويحترم مبدأ «لا شيء ينتظر الإنترنت».
 *   2. **CDN** → احتياط حين لا تكون النسخة المحلّية موجودة.
 *
 * يُجرَّب المحلّي أوّلًا دائمًا. هذا يعني أن التطبيق يعمل بلا النسخة
 * المحلّية (لكن بحاجة إلى شبكة لأوّل تحميل)، ويعمل بها بلا شبكة أصلًا.
 *
 * ⚠️ ملفات Tesseract ليست في المستودع افتراضيًا لأنها ~20MB
 *    (المحرّك + بيانات اللغة الروسية). لضمّها:
 *
 *        bash scripts/vendor-tesseract.sh
 *
 *    راجع docs/08-shadowing.md §8.9
 *
 * والنصّ المستخرَج **لا يستبدل الصورة أبدًا** — يُحفظ كمحتوى مشتقّ
 * مرتبط بها، والصورة تبقى بأصلها بلا أي تعديل.
 */

/** مسار النسخة المحلّية داخل المستودع. */
const LOCAL_BASE = new URL('../../../vendor/tesseract/', import.meta.url).href;

/** إصدار مثبّت — ترقيته قرار واعٍ لا تحديث تلقائي. */
const VERSION = '5.1.1';

const CDN = {
  script: `https://unpkg.com/tesseract.js@${VERSION}/dist/tesseract.min.js`,
  worker: `https://unpkg.com/tesseract.js@${VERSION}/dist/worker.min.js`,
  core: `https://unpkg.com/tesseract.js-core@${VERSION}/tesseract-core-simd.wasm.js`,
  langPath: 'https://tessdata.projectnaptha.com/4.0.0',
};

const LOCAL = {
  script: `${LOCAL_BASE}tesseract.min.js`,
  worker: `${LOCAL_BASE}worker.min.js`,
  core: `${LOCAL_BASE}tesseract-core-simd.wasm.js`,
  langPath: LOCAL_BASE,
};

let loadPromise = null;
let activeSource = null;
let worker = null;

/** هل الملف موجود فعلًا؟ نطلب رأسه فقط بلا تنزيل. */
async function exists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/** يحمّل سكربتًا بوسم `<script>` ويعيد وعدًا. */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error(`تعذّر تحميل ${src}`));
    document.head.append(tag);
  });
}

/**
 * يحمّل المحرّك من أفضل مصدر متاح.
 * @returns {Promise<{ source: 'local'|'cdn' }>}
 */
export function loadEngine() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (window.Tesseract) {
      activeSource = activeSource || 'preloaded';
      return { source: activeSource };
    }

    // المحلّي أوّلًا — يعمل بلا شبكة ولا يخالف مبدأ العمل offline.
    if (await exists(LOCAL.script)) {
      await loadScript(LOCAL.script);
      activeSource = 'local';
      return { source: 'local' };
    }

    if (!navigator.onLine) {
      throw new Error('استخراج النصّ محتاج إنترنت — أو ضمّ نسخة محلّية بـ scripts/vendor-tesseract.sh');
    }

    await loadScript(CDN.script);
    activeSource = 'cdn';
    return { source: 'cdn' };
  })().catch((error) => {
    // نُفرغ الوعد حتى تُعاد المحاولة لاحقًا بدل تعليق الميزة للأبد.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

/** هل المحرّك متاح دون إنترنت؟ */
export async function isAvailableOffline() {
  return exists(LOCAL.script);
}

/** مصدر المحرّك المستخدَم حاليًا. */
export function engineSource() {
  return activeSource;
}

/**
 * يستخرج النصّ الروسي من صورة.
 *
 * @param {Blob|File|string} image
 * @param {{ onProgress?: (p: {status: string, progress: number}) => void }} options
 * @returns {Promise<{ text: string, confidence: number, source: string }>}
 */
export async function extractText(image, { onProgress } = {}) {
  const { source } = await loadEngine();
  const paths = source === 'local' ? LOCAL : CDN;

  if (!worker) {
    worker = await window.Tesseract.createWorker('rus', 1, {
      workerPath: paths.worker,
      corePath: paths.core,
      langPath: paths.langPath,
      logger: (message) => {
        onProgress?.({ status: message.status, progress: message.progress ?? 0 });
      },
    });
  }

  const { data } = await worker.recognize(image);

  return {
    text: (data.text || '').trim(),
    confidence: data.confidence ?? 0,
    source,
  };
}

/** يحرّر الـ worker — يُنادى عند مغادرة الشاشة. */
export async function releaseEngine() {
  if (!worker) return;
  try {
    await worker.terminate();
  } catch {
    /* أفضل جهد */
  }
  worker = null;
}

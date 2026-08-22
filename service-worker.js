/**
 * LingoLife — Service Worker
 *
 * ⚠️ قاعدة حاكمة: هذا الملف يتعامل مع **الكود فقط**.
 *    بيانات المستخدم كلها في IndexedDB ولا يقترب منها أي سطر هنا.
 *    مسح الكاش لا يمسح ولا سجلًا واحدًا من بياناتك.
 *    راجع docs/04-storage-decision.md §4.5 الطبقة 2
 *
 * الاستراتيجية:
 *   HTML/JS/CSS  → Network-first (أحدث كود دائمًا، والكاش احتياط عند انقطاع الشبكة)
 *   الخطوط/الصور → Cache-first (لا تتغيّر)
 *   التحديث      → إشعار للمستخدم، لا skipWaiting صامت أثناء الكتابة
 */

/** يُستبدل تلقائيًا في GitHub Action عند النشر. */
const BUILD = '__BUILD__';
const CACHE = `lingolife-${BUILD}`;

/** هيكل التطبيق — يُخزَّن مسبقًا ليعمل offline من أول تحميل. */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/components.css',
  './css/journal.css',
  './css/layout.css',
  './css/responsive.css',
  './css/audio.css',
  './css/shadow.css',
  './css/organize.css',
  './css/tokens.css',
  './js/app.js',
  './js/components/audio-player.js',
  './js/components/icons.js',
  './js/components/mini-player.js',
  './js/components/modal.js',
  './js/components/toast.js',
  './js/config.js',
  './js/db/database.js',
  './js/db/db-slots.js',
  './js/db/migrations.js',
  './js/db/repositories.js',
  './js/db/repository.js',
  './js/db/schema.js',
  './js/router.js',
  './js/services/backup/backup-format.js',
  './js/services/backup/backup-migrations.js',
  './js/services/backup/deserialize.js',
  './js/services/backup/export.js',
  './js/services/backup/restore.js',
  './js/services/backup/serialize.js',
  './js/services/backup/validate.js',
  './js/services/shadow/analysis-link.js',
  './js/services/shadow/dialect.js',
  './js/services/shadow/fonts.js',
  './js/services/shadow/ocr.js',
  './js/services/shadow/stress.js',
  './js/services/shadow/translate.js',
  './js/services/shadow/playback-controller.js',
  './js/services/shadow/segmenter.js',
  './js/services/shadow/shadow-session-service.js',
  './js/services/shadow/tts-controller.js',
  './js/services/audio-service.js',
  './js/services/link-service.js',
  './js/services/organize-service.js',
  './js/services/content-service.js',
  './js/services/export-service.js',
  './js/services/media-service.js',
  './js/services/scene-service.js',
  './js/services/storage-service.js',
  './js/utils/crc32.js',
  './js/utils/dates.js',
  './js/utils/dom.js',
  './js/utils/ids.js',
  './js/utils/normalization.js',
  './js/utils/zip.js',
  './js/views/language-view.js',
  './js/views/life-view.js',
  './js/views/now-view.js',
  './js/views/scene-view.js',
  './js/views/settings-view.js',
  './js/views/organize-view.js',
  './js/views/shadow-view.js',
  './js/views/trash-view.js',
  './assets/icons/icon.svg',
];

/* ------------------------------------------------------------
   التثبيت
   ------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll يفشل كليًا لو سقط ملف واحد — نضيف فرديًا لنتحمّل النقص.
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] تعذّر تخزين', url, err);
          })
        )
      );
    })()
  );
});

/* ------------------------------------------------------------
   التفعيل — حذف الكاشات القديمة فقط
   ------------------------------------------------------------ */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('lingolife-') && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/* ------------------------------------------------------------
   التحديث بأمر المستخدم فقط
   ------------------------------------------------------------ */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_BUILD') {
    event.ports[0]?.postMessage({ build: BUILD });
  }
});

/* ------------------------------------------------------------
   الجلب
   ------------------------------------------------------------ */

const isAsset = (url) =>
  /\.(?:woff2?|ttf|otf|png|jpe?g|svg|webp|ico)$/i.test(url.pathname) ||
  url.hostname === 'fonts.gstatic.com';

/**
 * معجمُ النبر — بياناتٌ ساكنةٌ ثقيلة، تُعامَل معاملةَ الخطّ لا الكود (WS55).
 *
 * ⚠️ **ولماذا «الكاش أولًا» وهو ملفُّ `.json`؟**
 *    لأنه ليس بياناتٍ متغيّرة: يُولَّد مرّةً في البناء ولا يتبدّل بعده.
 *    و«الشبكة أولًا» كانت ستُنزّل ١٫٥ ميغابايت في كلّ جلسةِ ظلٍّ تفتحها
 *    — على لوحٍ ببياناتٍ محدودة، هذا ثمنٌ بلا مقابل.
 *
 * ⚠️ **ولا يتقادم:** اسمُ الكاش مربوطٌ بـ`BUILD`، فأيُّ نشرٍ جديد يبدأ
 *    كاشًا جديدًا ويحذف القديم — فيُجلَب المعجمُ المُحدَّثُ مرّةً واحدة.
 *
 * ⚠️ **وليس في `SHELL` عمدًا.** التخزينُ المسبق يعني تنزيلَه على كلّ
 *    جهازٍ يفتح التطبيق ولو لم يفتح الظلَّ قطّ. فيُخزَّن **عند أوّل
 *    استعمالٍ حقيقيّ** — وبعدها يعمل بلا شبكةٍ إلى الأبد.
 */
const isLexicon = (url) => url.pathname.endsWith('/assets/stress-lexicon.json');

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET فقط. طلبات Drive وغيرها تمرّ مباشرة بلا اعتراض.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (!sameOrigin && !isFont) return;

  // الأصول الثابتة: الكاش أولًا
  if (isAsset(url) || isFont || (sameOrigin && isLexicon(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // الكود والصفحات: الشبكة أولًا
  if (sameOrigin) {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // تنقّل بلا شبكة وبلا كاش → نعيد هيكل التطبيق (التوجيه بالـ hash يتكفّل بالباقي)
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }

    return new Response('غير متصل', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

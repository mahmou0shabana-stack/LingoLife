/**
 * LingoLife — عارضُ ملخّص القواعد (WS-B)
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا عارضٌ مكتوبٌ لا `<iframe>`
 * ═══════════════════════════════════════════════════════════════
 *
 * الإطارُ سطرٌ واحد ويعمل على سطح المكتب. وعلى **اللوح** — وهو
 * الجهازُ المقصود — عارضُ المتصفّح الداخليّ إمّا لا يوجد أصلًا فيُنزَّل
 * الملفّ إلى تطبيقٍ خارجيّ (فتخرج من الشادوينج، وهو بالضبط ما يطلب
 * البندُ 2 ألّا يحدث)، وإمّا يوجد بشريطِ أدواتٍ لا نتحكّم فيه ولا
 * يحفظ لنا صفحةً ولا تكبيرًا. والبندُ 22 يقول إن حفظَ الصفحة **حرج**.
 *
 * فالعارضُ هنا يرسم الصفحةَ بنفسه على `canvas`، ويملك الرقمَ والتكبيرَ
 * والملء — فيستطيع أن يعيدك إلى صفحة 17 بعد خمس دقائقٍ من التدريب.
 *
 * ═══════════════════════════════════════════════════════════════
 * ثلاثةُ قراراتٍ في هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * **١ · صفحةٌ واحدةٌ في كلّ لحظة لا شريطٌ متّصل.** الشريطُ المتّصل
 * أجملُ ويُكلّف فكَّ ترميز كلّ صفحةٍ مرّت تحت الإصبع. والبند 57 صريح:
 * «لا تفكّ ترميز كلّ الصور بأعلى دقّةٍ معًا». والصفحةُ الواحدة تعطي
 * البندَ 21 كلَّ ما طلب (رقمٌ وقفزٌ وتاليةٌ وسابقة) بذاكرةٍ ثابتة.
 *
 * **٢ · المكتبةُ تُستورَد كسلًا.** `pdf.js` مورَّدةٌ في `vendor/`
 * وحجمُها 2.5 ميغابايت. البند 57: «لا تُحمِّل الملفَّ والورشةُ
 * مغلقة». فالاستيرادُ يحدث عند أوّل فتحةٍ للتبويب — لا عند فتح الظلّ.
 *
 * **٣ · لا يعرف هذا الملفُّ قاعدةَ البيانات.** يأخذ بايتاتٍ وحالةً
 * ويردّ حالةً — ومَن يحفظها هو `reference-service`. فالعارضُ يصلح
 * لأيّ مستندٍ غدًا بلا أن يتعلّم من أين جاء.
 *
 * ⚠️ **ولا يمسّ الصوت أبدًا** (بندا 49 و50): لا `speechSynthesis` هنا
 *    ولا `AudioContext` ولا مؤقّت. فتحُ الملفّ وإغلاقُه لا يمرّان
 *    بمحرّك النطق ولا يوقظانه.
 */

/* ------------------------------------------------------------------ */
/* تحميلُ المكتبة — مرّةً واحدةً في عمر الصفحة                          */
/* ------------------------------------------------------------------ */

/** وعدُ التحميل — يُشارَك فلا تُستورَد المكتبةُ مرّتين. */
let libPromise = null;

/**
 * ⚠️ **`import.meta.url` لا مسارٌ مكتوبٌ بيد.** التطبيقُ يُنشَر تحت
 *    مجلّدٍ فرعيّ في GitHub Pages، ومسارٌ مطلقٌ يبدأ بـ`/` يصيب جذرَ
 *    النطاق فيفشل هناك ويعمل محلّيًّا — أسوأُ أنواع الأعطال.
 */
function vendorUrl(file) {
  return new URL(`../../vendor/pdfjs/${file}`, import.meta.url).href;
}

async function loadPdfLib() {
  if (!libPromise) {
    libPromise = import(/* @vite-ignore */ vendorUrl('pdf.mjs')).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = vendorUrl('pdf.worker.mjs');
      return lib;
    }).catch((err) => {
      /* فشلُ تحميلٍ لا يُسمَّم الوعدَ إلى الأبد — المحاولةُ الثانية تُعاد. */
      libPromise = null;
      throw err;
    });
  }
  return libPromise;
}

/* ------------------------------------------------------------------ */
/* حدودُ التكبير                                                       */
/* ------------------------------------------------------------------ */

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

/** أوضاعُ الملء — نفسُ ثوابت `reference-service.FIT` نصًّا. */
const FIT = { WIDTH: 'width', PAGE: 'page', FREE: 'free' };

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ------------------------------------------------------------------ */
/* العارض                                                             */
/* ------------------------------------------------------------------ */

/**
 * يركّب عارضًا داخل عنصر.
 *
 * @param {object} options
 * @param {HTMLElement} options.host العنصرُ الحاوي — يُفرَّغ ويُملأ
 * @param {Blob} options.blob بايتاتُ الملفّ من `media`
 * @param {{page?: number, zoom?: number, fit?: string, scroll?: number}} options.state
 * @param {(patch: object) => void} [options.onState] يُنادى عند كلّ تبدّل
 * @returns {Promise<{destroy: () => void, state: () => object}>}
 */
export async function mountPdfViewer({ host, blob, state = {}, onState = null }) {
  host.innerHTML = `
    <div class="sh-pdf" data-pdf>
      <div class="sh-pdf-stage" data-pdf-stage>
        <div class="sh-pdf-msg" data-pdf-msg>بنفتح الملفّ…</div>
        <canvas data-pdf-canvas hidden></canvas>
      </div>
      <div class="sh-pdf-bar" data-pdf-bar hidden>
        <button data-sh="pdf-page" data-v="-1" aria-label="الصفحة السابقة">‹</button>
        <span class="sh-pdf-num">
          <input type="number" data-pdf-input min="1" inputmode="numeric" aria-label="رقم الصفحة">
          <span data-pdf-total></span>
        </span>
        <button data-sh="pdf-page" data-v="1" aria-label="الصفحة التالية">›</button>
        <span class="sh-pdf-sp"></span>
        <button data-sh="pdf-zoom" data-v="-1" aria-label="صغّر">−</button>
        <button data-sh="pdf-fit" data-v="width" data-pdf-fitw>ملء العرض</button>
        <button data-sh="pdf-fit" data-v="page" data-pdf-fitp>الصفحة كاملة</button>
        <button data-sh="pdf-zoom" data-v="1" aria-label="كبّر">+</button>
      </div>
    </div>`;

  const stage = host.querySelector('[data-pdf-stage]');
  const canvas = host.querySelector('[data-pdf-canvas]');
  const msg = host.querySelector('[data-pdf-msg]');
  const bar = host.querySelector('[data-pdf-bar]');
  const input = host.querySelector('[data-pdf-input]');
  const total = host.querySelector('[data-pdf-total]');

  const view = {
    page: Math.max(1, Number(state.page) || 1),
    zoom: clamp(Number(state.zoom) || 1, ZOOM_MIN, ZOOM_MAX),
    fit: state.fit || FIT.WIDTH,
    scroll: Number(state.scroll) || 0,
  };

  let doc = null;
  let dead = false;
  /** مهمّةُ الرسم الجارية — تُلغى قبل بدءِ غيرها. */
  let task = null;
  /** آخرُ صفحةٍ طُلبت — تمنع سباقَ ضغطتين متتاليتين. */
  let wanted = 0;
  /**
   * المقياسُ المرسومُ فعلًا آخرَ مرّة.
   *
   * ⚠️ **ولولاه لقفزت أوّلُ ضغطةِ تكبير.** في «ملء العرض» يكون
   *    `view.zoom` رقمًا خاملًا (1 غالبًا) بينما المرسومُ 1.8؛ فلو
   *    انطلق `+` من الخامل لَصغُرت الصفحةُ عند طلبِ تكبيرها.
   */
  let shownScale = 1;

  function fail(text) {
    if (dead) return;
    msg.textContent = text;
    msg.hidden = false;
    canvas.hidden = true;
  }

  /* ---------------- التحميل ---------------- */

  try {
    const lib = await loadPdfLib();
    if (dead) return deadHandle();

    const bytes = await blob.arrayBuffer();
    if (dead) return deadHandle();

    doc = await lib.getDocument({
      data: bytes,
      /*
       * ⚠️ **الخطوطُ القياسيّة من `vendor/` لا من الشبكة** (بند 42).
       *    ملفٌّ لا يُضمِّن `Helvetica` لا يُرسَم نصُّه بدونها — وطلبُها
       *    من شبكةٍ يكسر «يعمل بلا إنترنت».
       */
      standardFontDataUrl: vendorUrl('standard_fonts/'),
      /* لا تُقيَّم نصوصٌ من مستندٍ خارجيّ — والملفُّ ملفُّك، ومع ذلك. */
      isEvalSupported: false,
    }).promise;
  } catch (err) {
    console.warn('[pdf] تعذّر فتح الملفّ', err);
    fail('مقدرناش نفتح الملفّ ده. جرّب ترفعه تاني أو تختار غيره.');
    /*
     * ⚠️ **`deadHandle` لا `handle` هنا.** المستمعون والمراقبُ أسفلَ
     *    الدالّة لم يُنشَأوا بعد (هم `const` في منطقةٍ ميّتة)، فمقبضٌ
     *    يغلقهم يرمي `ReferenceError` عند أوّل تبديل تبويب. ولا شيءَ
     *    يُغلَق أصلًا: لم يُربَط شيء.
     */
    return deadHandle();
  }

  if (dead) return deadHandle();

  view.page = clamp(view.page, 1, doc.numPages);
  total.textContent = `/ ${doc.numPages}`;
  input.max = String(doc.numPages);
  bar.hidden = false;

  /* ---------------- الرسم ---------------- */

  /**
   * يرسم الصفحةَ الحاليّة.
   *
   * ⚠️ **ويُلغي ما قبله.** ضغطُ «التالية» ثلاثَ مرّاتٍ بسرعةٍ يبدأ
   *    ثلاثَ مهمّاتٍ على نفس اللوحة، فتنتهي أيُّها اتّفق — وقد تظهر
   *    الصفحةُ 5 بعد 7. `RenderTask.cancel` هي البابُ الصحيح، وترمي
   *    `RenderingCancelledException` نبتلعها عمدًا.
   */
  async function draw() {
    if (dead || !doc) return;
    const want = ++wanted;

    try { task?.cancel(); } catch { /* لا شيء */ }
    task = null;

    let page;
    try {
      page = await doc.getPage(view.page);
    } catch {
      fail('الصفحة دي مش قادرين نقراها.');
      return;
    }
    if (dead || want !== wanted) return;

    const scale = fitScale(page);
    shownScale = scale;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: scale * dpr });

    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;

    const ctx2d = canvas.getContext('2d', { alpha: false });
    ctx2d.fillStyle = '#fff';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    try {
      task = page.render({ canvasContext: ctx2d, viewport });
      await task.promise;
    } catch (err) {
      /* الإلغاءُ ليس عطلًا. */
      if (!/cancel/i.test(err?.name || err?.message || '')) {
        console.warn('[pdf] تعذّر رسم الصفحة', err);
        fail('حصلت مشكلة في رسم الصفحة دي.');
      }
      return;
    } finally {
      task = null;
    }

    if (dead || want !== wanted) return;

    msg.hidden = true;
    canvas.hidden = false;
    input.value = String(view.page);
    bar.querySelector('[data-pdf-fitw]')?.classList.toggle('on', view.fit === FIT.WIDTH);
    bar.querySelector('[data-pdf-fitp]')?.classList.toggle('on', view.fit === FIT.PAGE);

    /* موضعُ التمرير داخل الصفحة — نسبةً لا بكسلًا، فيصمد مع التكبير. */
    requestAnimationFrame(() => {
      if (dead) return;
      const span = stage.scrollHeight - stage.clientHeight;
      stage.scrollTop = span > 0 ? Math.round(span * view.scroll) : 0;
    });
  }

  /** يحسب مقياسَ العرض من وضع الملء ومن عرض المسرح الفعليّ. */
  function fitScale(page) {
    const base = page.getViewport({ scale: 1 });
    /* حشوةٌ صغيرةٌ لئلّا يلتصق الورقُ بالحافّة ويختفي شريطُ التمرير. */
    const boxW = Math.max(80, stage.clientWidth - 12);
    const boxH = Math.max(80, stage.clientHeight - 12);

    if (view.fit === FIT.WIDTH) return boxW / base.width;
    if (view.fit === FIT.PAGE) return Math.min(boxW / base.width, boxH / base.height);
    return view.zoom;
  }

  /* ---------------- التغييرات ---------------- */

  function push(patch) {
    Object.assign(view, patch);
    onState?.({ page: view.page, zoom: view.zoom, fit: view.fit, scroll: view.scroll });
  }

  function goPage(next) {
    const page = clamp(Math.round(next), 1, doc.numPages);
    if (page === view.page) return;
    /* صفحةٌ جديدة تبدأ من أعلاها — لا من موضع الصفحة التي تركتَها. */
    push({ page, scroll: 0 });
    draw();
  }

  function stepZoom(dir) {
    /*
     * ⚠️ **التكبيرُ اليدويّ يفكّ الملء.** لو بقي «ملء العرض» فعّالًا
     *    لَتجاهل `fitScale` رقمَ التكبير تمامًا — فتضغط `+` ولا يتغيّر
     *    شيء. فالضغطةُ تقول «أنا أقرّر المقاس الآن».
     */
    const from = view.fit === FIT.FREE ? view.zoom : shownScale;
    push({ fit: FIT.FREE, zoom: clamp(from + dir * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX) });
    draw();
  }

  function setFit(mode) {
    push({ fit: mode });
    draw();
  }

  /* ---------------- الأحداث ---------------- */

  const onBar = (event) => {
    const btn = event.target.closest('[data-sh]');
    if (!btn || !host.contains(btn)) return;
    event.preventDefault();
    const what = btn.dataset.sh;
    if (what === 'pdf-page') goPage(view.page + Number(btn.dataset.v));
    else if (what === 'pdf-zoom') stepZoom(Number(btn.dataset.v));
    else if (what === 'pdf-fit') setFit(btn.dataset.v);
  };

  const onInput = () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) goPage(n);
  };

  /** ⚠️ التمريرُ يُكتَب مؤجَّلًا — لا كتابةَ في القاعدة لكلّ بكسل. */
  let scrollTimer = 0;
  const onScroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (dead) return;
      const span = stage.scrollHeight - stage.clientHeight;
      push({ scroll: span > 0 ? clamp(stage.scrollTop / span, 0, 1) : 0 });
    }, 260);
  };

  /**
   * ⚠️ **إعادةُ الرسم عند تغيّر العرض — للملء وحدَه.** «ملء العرض»
   *    مقاسٌ مشتقٌّ من عرض المسرح؛ وقلبُ اللوح أو طيُّ السكّة يغيّره،
   *    فتبقى الصفحةُ بمقاسٍ قديمٍ ما لم تُرسَم ثانية. أمّا التكبيرُ
   *    اليدويُّ فرقمٌ اخترتَه — لا يُمَسّ.
   */
  let sizeTimer = 0;
  const observer = new ResizeObserver(() => {
    if (dead || view.fit === FIT.FREE) return;
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => { if (!dead) draw(); }, 180);
  });

  host.addEventListener('click', onBar);
  input.addEventListener('change', onInput);
  stage.addEventListener('scroll', onScroll, { passive: true });
  observer.observe(stage);

  await draw();

  return handle();

  /* ---------------- المقبض ---------------- */

  function handle() {
    return {
      state: () => ({ ...view }),
      pages: () => doc?.numPages || 0,
      destroy() {
        if (dead) return;
        dead = true;
        clearTimeout(scrollTimer);
        clearTimeout(sizeTimer);
        observer.disconnect();
        host.removeEventListener('click', onBar);
        input?.removeEventListener('change', onInput);
        stage?.removeEventListener('scroll', onScroll);
        try { task?.cancel(); } catch { /* لا شيء */ }
        /*
         * ⚠️ **و`doc.destroy()` ليست تزيينًا**: تُنهي عاملَ الخيط
         *    الخلفيّ وتحرّر بايتاتِ الصفحات المفكوكة. بدونها يبقى
         *    عاملٌ حيًّا لكلّ فتحةِ تبويب.
         */
        try { doc?.destroy(); } catch { /* لا شيء */ }
        doc = null;
      },
    };
  }

  function deadHandle() {
    return { state: () => ({ ...view }), pages: () => 0, destroy() {} };
  }
}

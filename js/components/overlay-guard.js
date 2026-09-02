/**
 * LingoLife — عزلُ الطبقات: ما يعلو بصريًّا يعلو تفاعليًّا (WS-P2 · بند ٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **العطبُ من الجهاز الحقيقيّ — وسببُه ليس ما يبدو**
 * ═══════════════════════════════════════════════════════════════
 *
 * بلاغُك بحرفه: تفتح صورة، تضغط في الفراغ جنبها لتقفلها، **فتُقفَل
 * الصورةُ وينفّذ نفسُ اللمس شيئًا في الصفحة تحتها** — يُغلَق لوحٌ أو
 * يتبدّل محتوًى لم تلمسه.
 *
 * والتفسيرُ الأوّل الذي يقفز إلى الذهن — «الخلفيّةُ لا تغطّي الشاشة» —
 * **خاطئ**: `.lightbox` عنصرٌ `position: fixed; inset: 0` بـ`z-index`
 * ٦٥. هو يغطّي كلَّ شيءٍ فعلًا.
 *
 * السببُ الحقيقيُّ في **ترتيب الأحداث**:
 *
 *     pointerdown  ← على المسرح
 *     pointerup    ← المستمعُ ينادي close() ويحذف العنصر من الـDOM
 *     ────────────────  العارضُ لم يعُد موجودًا  ────────────────
 *     click        ← المتصفّحُ يولّدها الآن، فيفحص النقطةَ من جديد
 *                     ويجدُ تحتها زرَّ الورشة — فيضغطه
 *
 * وعلى الفأرة لا يظهر العطب: كروم يحسب هدفَ `click` من زوج
 * `mousedown/mouseup`، فحذفُ الهدف يجعلها تقع على `body` بلا أثر.
 * أمّا اللمسُ فيولّد `click` **بفحصٍ جديدٍ للنقطة** بعد `touchend`.
 * فالعطبُ لمسيٌّ بحت — ولهذا لم تره قياساتُ المتصفّح في WS-P.
 *
 * ═══════════════════════════════════════════════════════════════
 * والعلاجُ ثلاثُ طبقاتٍ لا واحدة — ولا مؤقّتٌ في أيٍّ منها
 * ═══════════════════════════════════════════════════════════════
 *
 * ١. **الإغلاقُ يقع على `click` لا على `pointerup`** (في العارض نفسِه):
 *    عندها تكون السلسلةُ قد اكتملت والعنصرُ ما يزال موجودًا، فالهدفُ
 *    محسومٌ قبل الحذف.
 *
 * ٢. **حاجزُ الإيماءة**: مهما كان بابُ الإغلاق (زرّ · Escape · رجوعُ
 *    النظام)، يُنصَب عند التفكيك مستمعٌ في **طور الالتقاط** يبتلع ما
 *    تبقّى من **هذه الإيماءة** — ويُرفَع عند أوّل `pointerdown` جديد.
 *    فهو محدودٌ بالإيماءة لا بزمنٍ مخترَع (بند ٥: «لا تحلّها بمؤقّتات»).
 *
 * ٣. **الخلفيّةُ لا تستقبل مؤشّرًا أصلًا** ما دامت الطبقةُ مفتوحة:
 *    `body.overlay-open` تُطفئ `pointer-events` على القشرة والشاشة
 *    والمشغّل والأزرار العائمة. فحتى لو تسرّب حدثٌ، لا يجد هدفًا.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا لا `inert` على كلّ إخوة `body`؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * لأنّ `.toast-host` أخٌ كذلك، وفيه **زرُّ التراجع**. وطبقةٌ تُبطِل
 * التراجعَ عن حذفٍ وقع لتوّه تخلق عطبًا أسوأ ممّا تصلح. فالعزلُ
 * مُسمًّى: القشرةُ والشاشةُ والمشغّلُ والعائمات — والتوستُ يبقى حيًّا
 * عمدًا وهو فوق الطبقات أصلًا (`--z-toast: 90` > `--z-overlay: 70`).
 */

/** كم طبقةً مفتوحةٌ الآن — فطبقتان لا تُطفئان العزلَ عند إغلاق واحدة. */
let open = 0;

/** ما حُفظ ليُستعاد عند إغلاق آخِر طبقة. */
let restore = null;

/* ================================================================== *
 * حاجزُ الإيماءة
 * ================================================================== */

const SWALLOW = ['click', 'auxclick', 'pointerup', 'mouseup', 'touchend'];

/**
 * يبتلع بقيّةَ الإيماءة الجارية — ثمّ يرفع نفسَه.
 *
 * ⚠️ **يُرفَع بحدثٍ لا بمؤقّت**: أوّلُ `pointerdown` أو `touchstart` هو
 *    إيماءةٌ **جديدة** بحكم التعريف، فالحاجزُ لا شأنَ له بها. وبلا
 *    ذلك كان يلزمنا رقمٌ بالمِلّي ثانية نخترعه ونتمنّى أن يصحّ.
 */
export function swallowGestureTail({ trusted = (event) => event.isTrusted } = {}) {
  /*
   * ⚠️ **`trusted` مَنفذُ اختبارٍ مقصود، لا بابٌ خلفيّ.** `isTrusted`
   *    سمةٌ **غيرُ قابلةٍ لإعادة التعريف** على كلّ حدثٍ بحكم المواصفة،
   *    فلا يمكن لاختبارٍ داخل الصفحة أن يصنع حدثًا «حقيقيًّا». وبلا
   *    هذا المَنفذ يبقى المسارُ الأهمُّ بلا اختبارٍ أصلًا.
   *
   *    والإثباتُ النهائيُّ يبقى في مسبار اللمس الحقيقيّ — وهو الذي
   *    أظهر العطبَ أوّلًا ثم أظهر زوالَه.
   */
  let done = false;

  const lift = () => {
    if (done) return;
    done = true;
    for (const type of SWALLOW) window.removeEventListener(type, eat, true);
    window.removeEventListener('pointerdown', lift, true);
    window.removeEventListener('touchstart', lift, true);
  };

  function eat(event) {
    /* ⚠️ لا يُبتلَع إلّا ما وُلِد من إيماءةٍ سابقة — والمُصطنَعُ برمجيًّا
     *    (`element.click()`) ليس منها، ولولا هذا لَكسرنا الاختبارات
     *    والأزرارَ التي تُنقَر من كود. */
    if (!trusted(event)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    if (event.type === 'click') lift();
  }

  for (const type of SWALLOW) window.addEventListener(type, eat, true);
  window.addEventListener('pointerdown', lift, true);
  window.addEventListener('touchstart', lift, true);
  return lift;
}

/* ================================================================== *
 * حبسُ التركيز
 * ================================================================== */

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

function trapTab(root) {
  return (event) => {
    if (event.key !== 'Tab') return;
    const stops = [...root.querySelectorAll(FOCUSABLE)]
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}

/* ================================================================== *
 * العقد
 * ================================================================== */

/**
 * يعزل ما تحت الطبقة، ويحبس التركيزَ فيها.
 *
 * @param {HTMLElement} root عنصرُ الطبقة (الخلفيّة الكاملة)
 * @param {{ focus?: boolean }} [options]
 * @returns {() => void} `release` — يُنادى **بعد** حذف العنصر من الصفحة
 */
export function isolateBehind(root, { focus = true } = {}) {
  const wasFocused = document.activeElement;
  const onKey = trapTab(root);
  root.addEventListener('keydown', onKey);

  open += 1;
  if (open === 1) {
    /*
     * ⚠️ **قفلُ التمرير بصنفٍ لا بكتابة `style` مباشرة**: شاشاتٌ أخرى
     *    (الورشة · الظلّ) تكتب `overflow` على `body` بنفسها، وكتابةٌ
     *    ثانيةٌ فوقها تضيع عند الاستعادة.
     */
    document.body.classList.add('overlay-open');
    restore = { scrollY: window.scrollY };
  }

  if (focus) {
    const first = root.querySelector(FOCUSABLE);
    /* ⚠️ `preventScroll` — وإلّا قفزت الصفحةُ تحت الطبقة قبل قفلها. */
    if (first) first.focus({ preventScroll: true });
  }

  let released = false;
  return function release({ swallow = true } = {}) {
    if (released) return;
    released = true;
    root.removeEventListener('keydown', onKey);
    open = Math.max(0, open - 1);

    if (open === 0) {
      document.body.classList.remove('overlay-open');
      if (restore) window.scrollTo({ top: restore.scrollY });
      restore = null;
    }

    /*
     * ⚠️ **يُعاد التركيزُ إلى مَن فتح الطبقة** (بند ٣١): وإلّا سقط
     *    التركيزُ إلى `body` فضاع مكانُ قارئ الشاشة ولوحةِ المفاتيح.
     */
    if (wasFocused && wasFocused.isConnected && typeof wasFocused.focus === 'function') {
      wasFocused.focus({ preventScroll: true });
    }

    if (swallow) swallowGestureTail();
  };
}

/** هل هناك طبقةٌ عازلةٌ مفتوحةٌ الآن؟ — للاختبار وللحرّاس. */
export const isIsolated = () => open > 0;

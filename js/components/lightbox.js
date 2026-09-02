/**
 * LingoLife — عارض الصورة
 *
 * ═══════════════════════════════════════════════════════════════
 * ثلاثة أشياء يفعلها بصورةٍ في هذا التطبيق تحديدًا
 * ═══════════════════════════════════════════════════════════════
 *
 * **١. تتنقّل بين صور الذكرى بلا إغلاقٍ وفتح.** كان كل تصفّحٍ لصورتين
 * يعني إغلاقًا وضغطةً وفتحًا — والذكرى فيها ستّ صور غالبًا.
 *
 * **٢. تُكبّر لتقرأ.** الصور هنا ليست ذكرياتٍ بصريّة وحدها: كثيرٌ منها
 * **لافتاتٌ وأوراقٌ فيها روسيّة تريد قراءتها**. وصورةٌ محصورةٌ في
 * الشاشة تجعل ذلك مستحيلًا.
 *
 * **٣. تسمّيها.** `caption` كان حقلًا ميّتًا يُكتب `''` ولا يُملأ في أي
 * مكان، فيعرض العارض اسم الملفّ: `IMG_20260212.jpg` مكان «لافتة
 * المستودع». والاسم هو ما تبحث به بعد سنة.
 *
 * وما كان يفعله من قبل باقٍ كما هو: الغلاف، والربط، واستخراج النصّ،
 * وتنزيل الأصل، والإزالة بتأكيدٍ وتراجع.
 */

import { html, raw } from '../utils/dom.js';
import { media } from '../db/repositories.js';
import {
  setCover, removeFromScene, undoRemove, urlFor, sceneMedia, setCaption,
} from '../services/media-service.js';
import { resolveLinks } from '../services/link-service.js';
import { toastOk } from './toast.js';
import { actWithUndo } from '../services/delete-service.js';
import { refreshSceneIfShowing } from '../ui-state.js';
import { openLinksModal } from '../modals/link-modal.js';
import { openShadowFromImage } from '../services/shadow/shadow-entry.js';
import { icon } from './icons.js';
import { pushLayer, dropLayer } from './layers.js';
import { isolateBehind } from './overlay-guard.js';

/** مستويات التكبير — ثلاثةٌ تكفي لقراءة لافتة. */
const ZOOMS = [1, 2, 3];

/**
 * يفتح عارض الصورة.
 *
 * @param {string} mediaId الصورة المطلوبة
 * @param {string} sceneId ذكراها — منها تُشتقّ بقيّة الصور للتنقّل
 */
export async function openLightbox(mediaId, sceneId) {
  const record = await media.get(mediaId);
  if (!record) return;

  /*
   * كل صور الذكرى للتنقّل بينها. وإن تعذّر (صورةٌ خارج ذكرى) فالعارض
   * يعمل على واحدةٍ — لا يسقط.
   */
  const images = sceneId ? await sceneMedia(sceneId, 'image') : [record];
  let index = Math.max(0, images.findIndex((row) => row.id === mediaId));
  if (!images.length) images.push(record);

  let zoom = 0;
  let pan = { x: 0, y: 0 };
  /*
   * ⚠️ **تكبيرٌ حرٌّ بالإصبعين** — بلاغُك: «تكبير وتصغير الصورة بإيدي
   *    بالتاتش مش بالزراير بس». الأزرار تقفز بين مقاساتٍ معدودة،
   *    والقرصُ يعطي أي مقاسٍ بينها. فالحرّ يغلب المعدود حين يوجد،
   *    ويُلغى بالزرّ فيعود إلى القفزات.
   *
   * ⚠️ **والأزرار تبقى**: القرص ليس بديلًا بل ثاني طريق — ومَن على
   *    شاشةٍ بلا لمسٍ يحتاجها.
   */
  let free = null;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = html`
    <button class="lightbox-close" aria-label="إغلاق">✕</button>

    <div class="lb-stage" data-lb-stage>
      <img data-lb-img alt="">
    </div>

    <div class="lb-caption">
      <input type="text" data-lb-caption maxlength="200"
             placeholder="سمّيها — الاسم ده هتلاقيها بيه بعد سنة">
    </div>

    <div class="lb-nav" data-lb-nav>
      <button class="lb-arrow" data-lb="prev" aria-label="السابقة">${raw(icon('back', 18))}</button>
      <span class="lb-count" data-lb-count></span>
      <button class="lb-arrow is-next" data-lb="next" aria-label="التالية">${raw(icon('back', 18))}</button>
    </div>

    <div class="lightbox-bar">
      <button data-lb="zoom" data-lb-zoom>كبّر</button>
      <button data-lb="cover">اجعلها الغلاف</button>
      <button data-lb="links">اربطها بصوت أو نصّ</button>
      <button data-lb="shadow">استخرج النصّ واتدرّب</button>
      <button data-lb="download">نزّل الأصل</button>
      <button data-lb="remove" class="danger">شيلها من الذكرى</button>
    </div>
    <div class="lightbox-links" data-lb-links></div>`;

  const img = box.querySelector('[data-lb-img]');
  const stage = box.querySelector('[data-lb-stage]');
  const captionInput = box.querySelector('[data-lb-caption]');

  const currentRow = () => images[index];

  /** يحفظ الوصف إن تغيّر — بلا زرّ حفظ. */
  async function flushCaption() {
    const row = currentRow();
    const value = captionInput.value.trim();
    if (!row || value === (row.caption || '')) return;
    row.caption = value;
    await setCaption(row.id, value).catch(() => {});
  }

  function applyZoom() {
    const scale = free ?? ZOOMS[zoom];
    if (scale <= 1.01) pan = { x: 0, y: 0 };
    img.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    stage.classList.toggle('is-zoomed', scale > 1.01);
    box.querySelector('[data-lb-zoom]').textContent =
      scale <= 1.01 ? 'كبّر' : `${scale.toFixed(1)}× — صغّر`;
  }

  async function show(next) {
    await flushCaption();
    index = (next + images.length) % images.length;
    const row = currentRow();

    img.src = urlFor(row, { thumb: false });
    img.alt = row.caption || '';
    captionInput.value = row.caption || '';
    zoom = 0;
    pan = { x: 0, y: 0 };
    applyZoom();

    const nav = box.querySelector('[data-lb-nav]');
    nav.hidden = images.length < 2;
    box.querySelector('[data-lb-count]').textContent = `${index + 1} / ${images.length}`;

    // الروابط تخصّ الصورة المعروضة — تُعاد قراءتها مع كل تنقّل.
    const host = box.querySelector('[data-lb-links]');
    host.innerHTML = '';
    resolveLinks(row.id)
      .then((links) => {
        if (currentRow()?.id !== row.id) return;
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
  }

  /*
   * ⚠️ **زرُّ رجوع النظام يقفل الصورة لا الصفحة** — بلاغُك بحرفه:
   *    «لما باجي أرجع لورا الصورة مبتتقفلش، بس الصفحة نفسها بترجع
   *    لورا». الصورة طبقةٌ فوق الشاشة لا وجهةٌ تُغادَر إليها.
   */
  let layer = null;
  let release = null;
  let closed = false;
  const close = async () => {
    /* ⚠️ إغلاقان متتاليان (زرٌّ ثم رجوعُ نظام) لا يُنقصان العدّاد مرّتين. */
    if (closed) return;
    closed = true;
    await flushCaption();
    box.remove();
    document.removeEventListener('keydown', onKey);
    /*
     * ⚠️ **العزلُ يُرفَع بعد الحذف لا قبله** (WS-P2 · بند ٥): وهو الذي
     *    ينصب حاجزَ الإيماءة فيبتلع ما تبقّى من اللمسة التي أغلقتنا —
     *    فلا تكمل طريقَها إلى زرٍّ في الورشة تحتنا.
     */
    if (release) { release(); release = null; }
    if (layer) {
      dropLayer(layer);
      layer = null;
    }
    /*
     * ⚠️ **تُنعَش شاشةُ الذكرى إن كانت معروضة — ولا يُنتقَل إليها.**
     *    كانت `reloadScene`، وفرعُها الآخر ينادي `navigate`. فمَن فتح
     *    الصورة من داخل كتاب الظلّ كان إغلاقُها يقذفه خارج جلسته.
     */
    if (sceneId) refreshSceneIfShowing(sceneId);
  };

  /*
   * ⚠️ السهمان **مكانيّان لا منطقيّان**: الصفحة RTL، فالأقدم على
   *    اليمين. سهم اليمين يذهب للسابقة وسهم اليسار للتالية — وهو ما
   *    تتوقّعه العين لأن ذلك اتجاه الشريط المعروض أمامك.
   */
  const onKey = (event) => {
    if (event.key === 'Escape') return void close();
    if (event.target === captionInput) return;
    if (event.key === 'ArrowRight') show(index - 1);
    if (event.key === 'ArrowLeft') show(index + 1);
    if (event.key === ' ') {
      event.preventDefault();
      /* الزرّ يُلغي التكبير الحرّ ويعود إلى المقاسات المعدودة. */
      free = null;
      zoom = (zoom + 1) % ZOOMS.length;
      applyZoom();
    }
  };

  /* ---- السحب: تنقّل حين لا تكبير، وتحريك حين تكبير ---- */

  let drag = null;

  /**
   * الأصابع الملامسة الآن.
   *
   * ⚠️ `Pointer Events` لا `Touch Events`: تغطّي الإصبع والفأرة والقلم
   *    بمستمعٍ واحد، فلا يُكتب المنطق مرّتين.
   */
  const touches = new Map();
  let pinch = null;

  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  /** منتصفُ الإصبعين — نقطةُ الارتكاز التي يجب ألّا تتحرّك (WS-P2 · بند ٦). */
  const midpoint = () => {
    const [a, b] = [...touches.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  stage.addEventListener('pointerdown', (event) => {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) {
      /* بدأ القرص: نُلغي السحب كي لا يتحرّك الإطار مع التكبير. */
      drag = null;
      /*
       * ⚠️ **القرصُ يكبّر حول ما بين إصبعيك لا حول مركز الصورة**
       *    (WS-P2 · بند ٦). التكبيرُ حول المركز يجعل ما تقرصه ينزلق
       *    بعيدًا كلّما كبّرت — فتقرص السطرَ الروسيَّ في الزاوية فيهرب
       *    منك. والارتكازُ الصادق أن تبقى النقطةُ تحت أصابعك مكانَها.
       */
      pinch = {
        start: spread(), from: free ?? ZOOMS[zoom],
        focal: midpoint(), panFrom: { ...pan },
      };
      return;
    }
    drag = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', (event) => {
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinch && touches.size === 2) {
      const now = spread();
      if (pinch.start > 0) {
        /* ⚠️ مُقيَّدٌ بين ١ و٦: تكبيرٌ بلا حدٍّ يضيّع الصورة خارج الشاشة. */
        const next = Math.min(6, Math.max(1, pinch.from * (now / pinch.start)));
        /*
         * المركزُ غيرُ المحوَّل هو مركزُ المسرح — الصورةُ موسّطةٌ فيه
         * بـflex. ومنه تُحسَب الإزاحةُ التي تُبقي نقطةَ الارتكاز ثابتة:
         *
         *     pan' = f − c − (f − c − pan) × (s'/s)
         */
        const box2 = stage.getBoundingClientRect();
        const cx = box2.left + box2.width / 2;
        const cy = box2.top + box2.height / 2;
        const ratio = next / pinch.from;
        pan = next <= 1.01 ? { x: 0, y: 0 } : {
          x: pinch.focal.x - cx - (pinch.focal.x - cx - pinch.panFrom.x) * ratio,
          y: pinch.focal.y - cy - (pinch.focal.y - cy - pinch.panFrom.y) * ratio,
        };
        free = next;
        applyZoom();
      }
      return;
    }

    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
    if ((free ?? ZOOMS[zoom]) <= 1.01) return;
    pan = { x: drag.panX + dx, y: drag.panY + dy };
    applyZoom();
  });

  const liftFinger = (event) => {
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = null;
  };
  stage.addEventListener('pointercancel', liftFinger);

  stage.addEventListener('pointerup', (event) => {
    const wasPinching = Boolean(pinch);
    liftFinger(event);
    /* بعد القرص لا تنقّل: رفعُ الإصبع نهايةُ تكبيرٍ لا سحبةُ تصفّح. */
    if (wasPinching) { drag = null; return; }
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const moved = drag.moved;
    const dy = event.clientY - drag.y;

    /*
     * ⚠️ **«هل الإصبعُ على الصورة؟» يُقاس بالموضع لا بـ`event.target`.**
     *
     * `pointerdown` ينادي `setPointerCapture` على **المسرح**، ومن
     * ثَمّ تُعاد توجيهُ كلّ الأحداث التالية إليه — فيصير `event.target`
     * هو المسرحَ دائمًا، ولو كان إصبعُك في منتصف الصورة.
     *
     * ⚠️ **قِستُه**: أوّلُ كتابةٍ استعملت `event.target === img`،
     *    فصارت الضغطةُ على الصورة نفسِها **تُغلِق العارض** — عكسُ
     *    المقصود تمامًا. الالتقاطُ يُصلح السحبَ ويكذب على الهدف.
     *
     * و`getBoundingClientRect` تصف الصورةَ بعد التكبير والتحريك،
     * فهي صادقةٌ في كلّ الحالات.
     */
    const r = img.getBoundingClientRect();
    const onImage = event.clientX >= r.left && event.clientX <= r.right
      && event.clientY >= r.top && event.clientY <= r.bottom;

    drag = null;

    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **الفراغُ حول الصورة يُغلِق — لا يُكبّر.**
     * ═══════════════════════════════════════════════════════════
     *
     * بلاغُك: «المفروض أضغط في الفراغ جنبها تقفل، لكن ما بيحصلش —
     * ده بيقلب على الصورة اللي بعدها وبعدين يبوظ».
     *
     * والسببُ أن هذا المستمعَ على **المسرح كلِّه** لا على الصورة.
     * فالفراغُ حولها كان يدخل في «ضغطةٌ بلا سحبٍ تُكبّر».
     * ⚠️ **قِستُه**: `elementFromPoint` في الفراغ يعيد `DIV.lb-stage`،
     *    وبعد الضغطة يصير التكبير `2.0×` والعارضُ مفتوح.
     *
     * وتكبيرُ الصورة يُخرج أطرافَها فوق زرّ الإغلاق، فتضغط X فتقع
     * على الصورة فتُكبَّر أكثر — وهذا «أفضل أضغط كذا مرّة لحدّ ما
     * يقفل». عطلٌ واحدٌ يبدو ثلاثة.
     *
     * فالقسمةُ صارت كما يتوقّعها كلُّ من رأى عارضَ صورٍ قبلُ:
     * **على الصورة = تكبير، وحولها = إغلاق.**
     */
    /*
     * ⚠️ **وما هي «الضغطة»؟ ليست حركةً صفرًا.**
     *
     * كان الشرط `!moved`، و`moved` تصير صادقةً بعد **٦ بكسل**. وكلُّ
     * إصبعٍ على لوحٍ ينزلق أكثر من ستّة. فالضغطةُ التي تنزلق سبعةً
     * لم تكن تُغلِق ولا تُكبّر ولا تنقل — **لا تفعل شيئًا**. وهذا هو
     * «بيبوظ ومعدش بيقفل».
     *
     * ⚠️ **قِستُه**: ضغطةٌ بانزلاق ٩px تركت العارضَ مفتوحًا بلا أثر.
     *
     * فالحدّان صارا اثنين لأنهما سؤالان مختلفان:
     *   · `moved` (٦px) — «هل أبدأ تحريكَ الصورة المكبَّرة؟»
     *   · `isTap` (١٦px) — «هل قصد أن يضغط؟»
     * وخلطُهما جعل الجوابَ عن الأوّل يقتل الثاني.
     */
    const isTap = Math.hypot(dx, dy) < 16;

    if (isTap && !onImage) return void close();

    // مكبَّرة: السحب حرّكها ولا ينقل. غير مكبَّرة: سحبةٌ عريضة تنقل.
    if (zoom > 0 || free) return;

    /*
     * ⚠️ **وسحبةُ التصفّح أفقيّةٌ صراحةً.** كان الشرط `|dx| > 40`
     *    وحده، فإصبعٌ ينزلق قليلًا وهو يضغط — وهو ما تفعله كلُّ يدٍ
     *    على لوح — كان ينقل الصورة. فصار يشترط أن يكون الأفقيُّ
     *    **أكبر من الرأسيّ**، والعتبةُ 60 لا 40.
     */
    if (moved && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      return void show(dx > 0 ? index - 1 : index + 1);
    }

    // ضغطةٌ على الصورة نفسها تُكبّر — أسرع من قصد الزرّ على تابلت.
    if (isTap && onImage) {
      /* الزرّ يُلغي التكبير الحرّ ويعود إلى المقاسات المعدودة. */
      free = null;
      zoom = (zoom + 1) % ZOOMS.length;
      applyZoom();
    }
  });

  box.addEventListener('click', async (event) => {
    if (event.target === box || event.target.closest('.lightbox-close')) return void close();

    const action = event.target.closest('[data-lb]')?.dataset.lb;
    if (!action) return;

    if (action === 'prev') return void show(index - 1);
    if (action === 'next') return void show(index + 1);

    if (action === 'zoom') {
      /* الزرّ يُلغي التكبير الحرّ ويعود إلى المقاسات المعدودة. */
      free = null;
      zoom = (zoom + 1) % ZOOMS.length;
      return applyZoom();
    }

    if (action === 'cover') {
      await setCover(sceneId, currentRow().id);
      await close();
      toastOk('بقت الغلاف');
    }

    if (action === 'links') {
      const id = currentRow().id;
      await close();
      openLinksModal(id, sceneId);
    }

    if (action === 'shadow') {
      const id = currentRow().id;
      await close();
      openShadowFromImage(id, sceneId);
    }

    if (action === 'download') {
      const { downloadBlob } = await import('../utils/dom.js');
      const row = currentRow();
      // الأصل كما رُفع — بايت ببايت
      downloadBlob(row.blob, row.filename || `${row.id}.jpg`);
    }

    if (action === 'remove') {
      // الملف نفسه يبقى في `media`؛ الذي يُشال هو ربطه بالذكرى —
      // فالتراجع لا يحتاج أن يجد الـ Blob من جديد.
      const row = currentRow();
      let linkId = null;
      await actWithUndo({
        what: 'الصورة دي',
        detail: row.caption || row.filename || '',
        confirmLabel: 'شيلها',
        remove: async () => {
          linkId = await removeFromScene(sceneId, row.id);
          await close();
        },
        restore: () => undoRemove(linkId),
        after: () => refreshSceneIfShowing(sceneId),
      });
    }
  });

  captionInput.addEventListener('blur', flushCaption);

  /*
   * ⚠️ **دورانُ الجهاز يعيد حساب الإطار** (بند ٧): المسرحُ يتغيّر عرضًا
   *    وطولًا، والإزاحةُ المحفوظةُ تصير خارجه فتختفي الصورةُ الظاهرة.
   *    فالإزاحةُ تُصفَّر عند التغيّر — أصدقُ من إبقائها على قياسٍ مات.
   */
  const onResize = () => { pan = { x: 0, y: 0 }; applyZoom(); };
  window.addEventListener('resize', onResize, { passive: true });
  const stopResize = () => window.removeEventListener('resize', onResize);

  document.addEventListener('keydown', onKey);
  layer = pushLayer(() => { close(); }, { id: 'lightbox' });
  document.body.append(box);
  /*
   * ⚠️ **العزلُ بعد الإلحاق**: `isolateBehind` تنقل التركيزَ إلى أوّل
   *    عنصرٍ داخل الطبقة، وذلك مستحيلٌ قبل وجودها في الصفحة.
   */
  const dropIsolation = isolateBehind(box);
  release = () => { stopResize(); dropIsolation(); };
  await show(index);
}

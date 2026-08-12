/**
 * LingoLife — سطرا المكان في القشرة (WS23)
 *
 * ═══════════════════════════════════════════════════════════════
 * سطران، ولا شيءَ ثالث
 * ═══════════════════════════════════════════════════════════════
 *
 * ```
 *  ┌───────────────────────────────────────────┐
 *  │  ▣   ‹ رجوع لـ حياتي            🗑  ⚙   │  ← من أين
 *  │      عشا عند أنيا                        │  ← أين أنت
 *  └───────────────────────────────────────────┘
 * ```
 *
 * وكانا قبل اليوم: **«LingoLife»** و**«حياتك. لغتك. ذاكرتك.»** — أي
 * سطرين من الزينة في أثبت مكانٍ على الشاشة، بينما بلاغُك يقول **«مش
 * عارف فين بيودّي على فين»**.
 *
 * ⚠️ **والشعار لا يُحذَف — يعود إلى بيته.** في «دلوقتي» (وهي البيت،
 *    ولا رجوعَ منها) يظهر الاسم والشعار كما كانا. وفي غيرها يظهر
 *    المكان. فالهُويّة حيث تبدأ، والدلالة حيث تتوه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ثلاثة أشياء تجعله صادقًا
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **١ · النوع أوّلًا، ثم الاسم.** «ذكرى» تُكتَب فورًا وبلا انتظار،
 *    ثم يحلّ محلّها «عشا عند أنيا» حين تصل من القاعدة. فلا ترى قشرةً
 *    فارغةً تومض ثم تمتلئ.
 *
 * ⚠️ **٢ · وآخرُ طلبٍ هو الذي يكتب.** قراءةُ الاسم من IndexedDB غيرُ
 *    متزامنة، وأنت تضغط أسرع منها. فلولا الرقمُ التسلسليّ لكتب طلبٌ
 *    قديمٌ اسمَ شاشةٍ غادرتَها فوق اسم التي أنت فيها.
 *
 * ⚠️ **٣ · وفوقه طبقةٌ؟ فالرجوع «اقفل».** إن كانت نافذةٌ أو صورةٌ
 *    مفتوحة فزرُّ الرجوع يغلقها هي — فيجب أن يقول ذلك. زرٌّ مكتوبٌ
 *    عليه «رجوع لـ حياتي» ثم يغلق نافذةً هو كذبةٌ صغيرة، وهي أسوأ من
 *    زرٍّ بلا اسم.
 */

import { $ } from '../utils/dom.js';
import { getCurrentRoute, backTo } from '../router.js';
import { placeKind, placeOf, isHome } from '../services/places.js';
import { hasLayer } from './layers.js';

/** يُبطل نتيجةَ كلّ قراءةٍ سبقت آخرَ تنقّل. */
let ticket = 0;

/** ما يظهر في البيت — الهُويّة حيث تبدأ. */
const BRAND = { name: 'LingoLife', tagline: 'حياتك. لغتك. ذاكرتك.' };

/**
 * يُحدِّث سطرَي المكان.
 *
 * يُنادى بعد كل رسمِ شاشة، وبعد كل فتحِ طبقةٍ أو إغلاقها.
 */
export function syncPlace() {
  const brand = $('#place-brand');
  const now = $('#place-now');
  const backBtn = $('#app-back');
  const backText = $('#place-back-text');
  if (!brand || !now || !backBtn || !backText) return;

  const path = getCurrentRoute()?.path || '/';
  const layered = hasLayer();
  const home = isHome(path);
  const mine = ++ticket;

  /* ---- السطر الأعلى: من أين ---- */
  const from = backTo();
  if (layered) {
    backBtn.hidden = false;
    backText.textContent = 'اقفل';
  } else if (home || !from) {
    backBtn.hidden = true;
    backText.textContent = 'رجوع';
  } else {
    backBtn.hidden = false;
    /* النوعُ فورًا، والاسمُ بعينه حين يصل. */
    backText.textContent = `رجوع لـ ${placeKind(from)}`;
    placeOf(from).then((place) => {
      if (mine !== ticket || !place.label) return;
      backText.textContent = `رجوع لـ ${place.label}`;
    });
  }

  /* ---- السطر الأسفل: أين أنت ---- */
  brand.hidden = !home;
  if (home) {
    brand.textContent = BRAND.name;
    now.textContent = BRAND.tagline;
    now.classList.remove('is-place');
    return;
  }

  now.classList.add('is-place');
  now.textContent = placeKind(path);
  placeOf(path).then((place) => {
    if (mine !== ticket || !place.label) return;
    now.textContent = place.label;
    /*
     * ونضع النوعَ في التلميح لا في السطر: «ذكرى · عشا عند أنيا» يملأ
     * السطرَ بما تعرفه أصلًا من الشاشة تحته.
     */
    now.title = place.title ? `${place.kind}: ${place.title}` : place.kind;
  });
}

/**
 * يبدأ متابعة الطبقات.
 *
 * فتحُ نافذةٍ لا يُعيد رسم الشاشة (وهذا مقصود — الطبقة ليست وجهة)،
 * فلولا هذا لبقي الزرّ مكتوبًا عليه «رجوع لـ حياتي» وهو يغلق النافذة.
 */
export function startPlace() {
  document.body.addEventListener('layers:change', syncPlace);
}

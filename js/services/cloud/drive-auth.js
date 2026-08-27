/**
 * LingoLife — تفويضُ Google (WS-H · نموذجُ الرمز)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الرمزُ يعيش في الذاكرة ويموت معها — بقرار**
 * ═══════════════════════════════════════════════════════════════
 *
 * لا `localStorage`، ولا IndexedDB، ولا كوكي. ومعنى ذلك عمليًّا أنك
 * ستضغط «اربط» بعد كلّ إقلاعٍ للتطبيق — وهو ثمنٌ مقبولٌ لمكسبٍ ليس
 * مقبولًا التنازلُ عنه:
 *
 *   · رمزٌ محفوظٌ في `localStorage` يقرؤه **أيُّ سكربتٍ** يعمل على
 *     نفس الأصل. وهذا تطبيقُ ذكرياتٍ، لا خزنةُ أسرار.
 *   · ورمزٌ في القاعدة يدخل **النسخةَ الاحتياطيّة**، فتحمل ملفًّا
 *     تشاركه يومًا وفيه إذنٌ حيٌّ إلى Drive حسابك.
 *
 * ولذلك يحرسه اختباران: أحدهما يمسح القاعدةَ والحزمَ والنسخ، والآخر
 * يفحص ناتجَ التشخيص نفسَه.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا رمزَ تجديدٍ في المتصفّح أصلًا**
 * ═══════════════════════════════════════════════════════════════
 *
 * نموذجُ الرمز (GIS Token Model) لا يعطي `refresh_token` ولا يحتاج
 * `client_secret`: يعطي رمزَ وصولٍ عمرُه ~ساعة. فانتهاءُ الإذن
 * **حالةٌ عاديّةٌ متوقّعة** (`AUTH_REQUIRED`) لا عطبٌ طارئ — وهذا سببُ
 * وجود تلك الحالة في آلة الحالات منذ اليوم الأوّل.
 *
 * ⚠️ **والمكتبةُ تُحمَّل من Google ولا يمكن نسخُها محلّيًّا**: النصُّ
 *    نفسُه يتحقّق من أصله. فبلا إنترنت لا يُبنى الربطُ أصلًا — وهو
 *    مقبولٌ لأن الربطَ فعلٌ يحتاج الشبكةَ بحكم تعريفه.
 */

import { DRIVE_CLIENT_ID, DRIVE_SCOPE, driveConfigured } from './drive-config.js';
import { FAIL, TransportError } from './transport.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** ⚠️ الرمزُ هنا وحدَه — متغيّرٌ في وحدةٍ، لا مخزنٌ دائم. */
let accessToken = null;
let expiresAt = 0;
let tokenClient = null;
let account = null;
let gisPromise = null;

/** هامشٌ قبل الانتهاء — فلا نبدأ رفعًا برمزٍ يموت في منتصفه. */
const EXPIRY_MARGIN_MS = 90_000;

/** يحمّل مكتبةَ Google مرّةً واحدة. */
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(window.google.accounts.oauth2); return; }

    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    const script = existing || document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;

    script.addEventListener('load', () => {
      if (window.google?.accounts?.oauth2) resolve(window.google.accounts.oauth2);
      else reject(new TransportError(FAIL.UNKNOWN, 'مكتبة Google اتحمّلت بس مفيهاش oauth2'));
    }, { once: true });

    script.addEventListener('error', () => {
      gisPromise = null;
      reject(new TransportError(FAIL.OFFLINE, 'مقدرناش نحمّل مكتبة Google — فيه إنترنت؟'));
    }, { once: true });

    if (!existing) document.head.append(script);
  });
  return gisPromise;
}

/** هل بيدنا رمزٌ صالحٌ الآن؟ */
export function hasValidToken() {
  return Boolean(accessToken) && Date.now() < expiresAt - EXPIRY_MARGIN_MS;
}

/** الرمزُ الحاليّ — للاستعمال الداخليّ في الناقل وحدَه. */
export function currentToken() {
  return hasValidToken() ? accessToken : null;
}

export function currentAccount() {
  return account;
}

/**
 * يطلب رمزًا.
 *
 * @param {{ silent?: boolean }} options — `silent` يحاول بلا نافذةٍ
 *   منبثقة (ينجح لو الإذنُ ممنوحٌ سلفًا في هذه الجلسة).
 *
 * ⚠️ **والنافذةُ المنبثقة تحتاج أن تكون داخل إيماءةِ مستخدم.** فلو
 *    نودي هذا من مؤقّتٍ خلفيّ حجبه المتصفّح. ولذلك المزامنةُ التلقائيّة
 *    **لا تطلب رمزًا أبدًا**: تنتقل إلى `AUTH_REQUIRED` وتنتظر ضغطتَك.
 */
export function requestToken({ silent = false } = {}) {
  if (!driveConfigured()) {
    return Promise.reject(new TransportError(FAIL.AUTH, 'مفيش مُعرِّف عميل Google متظبّط'));
  }
  if (hasValidToken()) return Promise.resolve({ ok: true, account, cached: true });

  return loadGis().then((oauth2) => new Promise((resolve, reject) => {
    tokenClient = oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          const category = response.error === 'access_denied' ? FAIL.PERMISSION : FAIL.AUTH;
          reject(new TransportError(category, textFor(response.error)));
          return;
        }
        accessToken = response.access_token;
        expiresAt = Date.now() + (Number(response.expires_in || 3600) * 1000);
        resolve({ ok: true, account, cached: false, scope: response.scope });
      },
      error_callback: (error) => {
        /* إغلاقُ النافذة أو حجبُها — ليس عطبًا، وليس رفضًا. */
        reject(new TransportError(FAIL.AUTH, textFor(error?.type || 'popup_closed')));
      },
    });

    try {
      tokenClient.requestAccessToken({ prompt: silent ? 'none' : '' });
    } catch (error) {
      reject(new TransportError(FAIL.AUTH, error?.message || 'فشل طلب الإذن'));
    }
  }));
}

const textFor = (code) => ({
  access_denied: 'رفضت الإذن — Drive مش هيتربط',
  popup_closed: 'قفلت نافذة Google قبل ما تخلّص',
  popup_failed_to_open: 'المتصفّح حجب نافذة Google — اسمح بالنوافذ المنبثقة للموقع ده',
  immediate_failed: 'محتاج تأذن بنفسك المرّة دي',
}[code] || `فشل التفويض (${code})`);

/**
 * ينسى الرمزَ **ويسحبه من Google أيضًا**.
 *
 * ⚠️ **ونسيانُه محلّيًّا وحدَه ليس فكَّ ارتباط**: الإذنُ يبقى ممنوحًا في
 *    حسابك، فأيُّ تبويبٍ يفتح التطبيقَ يأخذ رمزًا صامتًا. فالسحبُ من
 *    Google هو ما يجعل «افصل» تعني ما تقوله.
 */
export async function revokeToken() {
  const token = accessToken;
  accessToken = null;
  expiresAt = 0;
  account = null;
  if (!token) return { revoked: false };

  try {
    const oauth2 = await loadGis();
    await new Promise((resolve) => oauth2.revoke(token, resolve));
    return { revoked: true };
  } catch {
    /* السحبُ فشل — والرمزُ نُسي محلّيًّا على أيّة حال. */
    return { revoked: false, forgotten: true };
  }
}

/** يُبطل الرمزَ محلّيًّا — يُنادى عند ردّ 401 فيُطلَب واحدٌ جديد. */
export function invalidateToken() {
  accessToken = null;
  expiresAt = 0;
}

/**
 * ⚠️ **للاختبار وحدَه** — يحقن رمزًا فيُختبَر الناقلُ بلا نافذةِ Google.
 *
 * وهو نفسُ ما يفعله `__forceDeviceId` في `device.js` ولنفس السبب: أن
 * يُختبَر ما فوق الحدّ بلا أن يُستدعى ما تحته. ولا سطرَ في التطبيق
 * يناديها.
 */
export function __forceToken(token, { ttlMs = 3_600_000, email = null } = {}) {
  accessToken = token;
  expiresAt = token ? Date.now() + ttlMs : 0;
  account = email;
  return token;
}

/** يسجّل البريدَ بعد قراءته من Drive (`about.get`) — للعرض لا للهُويّة. */
export function rememberAccount(email) {
  account = email || null;
  return account;
}

/**
 * حالةُ التفويض — **بلا الرمز نفسِه** (بند ٣٥).
 *
 * ⚠️ ولا يعود هنا `accessToken` ولو للتشخيص: ناتجُ التشخيص يُنسَخ
 *    ويُلصَق في رسائل، ورمزٌ حيٌّ في رسالةٍ إذنٌ مُعطًى لمن يقرؤها.
 */
export function authStatus() {
  return {
    configured: driveConfigured(),
    authorized: hasValidToken(),
    account,
    expiresInSec: hasValidToken() ? Math.round((expiresAt - Date.now()) / 1000) : 0,
    scope: DRIVE_SCOPE,
  };
}

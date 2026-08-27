/**
 * LingoLife — حالاتُ المزامنة (WS-H · بندا ١٠ و٤٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **حالةٌ واحدةٌ معلنة، لا خمسةُ منطقيّاتٍ متناثرة**
 * ═══════════════════════════════════════════════════════════════
 *
 * البديلُ الذي يمنعه بند ١٠ صراحةً:
 *
 *     connected = true
 *     syncing = true
 *     authExpired = true
 *     offline = false
 *     error = true
 *
 * خمسةُ منطقيّاتٍ تعني اثنتين وثلاثين تركيبة، أكثرُها بلا معنى، ولا
 * أحدَ يعرف ماذا تعرض الشاشةُ في أيٍّ منها. فالحالةُ **واحدةٌ** تُشتَقّ
 * منها الشاشةُ كلُّها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **و«تمت المزامنة» لها معنًى محدَّد** (بند ٤٦)
 * ═══════════════════════════════════════════════════════════════
 *
 * `READY` لا تعني «نجح آخرُ رفع». تعني أربعةً معًا:
 *
 *   ١. كلُّ تغييراتي المحلّيّة صارت في حزمةٍ مرفوعة
 *   ٢. وكلُّ حزمةٍ بعيدةٍ أعرفها طُبِّقت
 *   ٣. ولا تعارضَ ينتظر قرارًا
 *   ٤. ونقاطُ التفتيش كُتبت
 *
 * وما دون ذلك ليس `READY` — ولا يُقال للمستخدم «تمت» وهو ليس تامًّا.
 *
 * ⚠️ **ولا تعني أن الجهازَ الآخر استلم.** ذاك خبرٌ لا نملكه حتى يكتب
 *    الجارُ إقرارَه. فالنصُّ «تم الرفع · الجهاز التاني هيستلم أول ما
 *    يفتح» حين نعرف أنه لم يقرّ بعد.
 */

/** الحالاتُ — مغلقةٌ عمدًا. */
export const SYNC = Object.freeze({
  /** لا ناقلَ مربوط. التطبيقُ يعمل كما هو. */
  DISCONNECTED: 'DISCONNECTED',
  /** ربطٌ جارٍ. */
  CONNECTING: 'CONNECTING',
  /** كلُّ شيءٍ التقى — بالمعنى الأربعيّ فوق. */
  READY: 'READY',
  /** تغييراتٌ محلّيّةٌ لم تُرفَع بعد. */
  LOCAL_PENDING: 'LOCAL_PENDING',
  /** دورةُ مزامنةٍ جارية. */
  SYNCING: 'SYNCING',
  /** خطّةٌ تنتظر قرارَك — ولا تُطبَّق قبله. */
  CONFLICT: 'CONFLICT',
  /** مربوطٌ بلا شبكة. ليس عطبًا. */
  OFFLINE: 'OFFLINE',
  /** انتهى الإذن أو سُحب. */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /**
   * ⚠️ **حالةٌ أضفتُها ولم تكن في قائمتك — ولها سبب** (بند ٥ من طلبك).
   *
   * بعد استرجاع نسخةٍ أقدم، المزامنةُ **موقوفةٌ بقرارٍ** لا معطّلةٌ
   * بعطب. وليست `ERROR` (لم يفشل شيء)، ولا `DISCONNECTED` (الناقلُ
   * مربوط)، ولا `CONFLICT` (لا خطّةَ ولا تعارضَ حقول). وبلا حالةٍ لها
   * كانت ستُخبَّأ في منطقيٍّ جانبيّ — وهو بالضبط ما يمنعه بند ١٠.
   */
  RESTORED_HOLD: 'RESTORED_HOLD',
  /** فشلٌ ليس إذنًا ولا انقطاعَ شبكة. */
  ERROR: 'ERROR',
});

/**
 * الانتقالاتُ المسموحة.
 *
 * ⚠️ **وانتقالٌ غير مُعلَنٍ يرمي.** الغرضُ أن يسقط خطأُ البرمجة في
 *    الاختبار لا أن يظهر للمستخدم شاشةٌ لا معنى لها.
 *
 * ⚠️ **و`OFFLINE ← CONNECTING` كان ناقصًا، وأسقطه الاختبار.** كُتب
 *    الجدولُ أوّلَ مرّةٍ على أن الانقطاعَ يُعالَج بإعادة `syncNow`، وهو
 *    صحيحٌ للانقطاع اللحظيّ وخطأٌ لما بعده: `transport.connect()` يُنادى
 *    عند عودة الشبكة، فتنتقل الحالةُ إلى `CONNECTING` — ومن `OFFLINE`
 *    كانت ترمي. أي أن **الجهازَ الذي فقد الشبكةَ لا يستطيع أن يعود
 *    إليها أبدًا** حتى يُقفَل التطبيقُ ويُفتَح. وهو ما يقع كلَّ يومٍ في
 *    قطارٍ أو مصعد، ولم يكن ليظهر إلّا في يدك.
 *
 *    والقاعدةُ التي استُخلصت: كلُّ حالةٍ **ساكنة** — لا دورةَ جاريةً
 *    فيها ولا قرارَ منتظرًا — يجوز منها الانتقالُ إلى `CONNECTING`؛
 *    فإعادةُ الربط فعلٌ مشروعٌ في أيّ لحظةِ سكون، والممنوعُ أن يقع
 *    وسطَ `SYNCING` أو فوق `CONFLICT` أو `RESTORED_HOLD` ينتظران قرارك.
 */
const MOVES = Object.freeze({
  DISCONNECTED: ['CONNECTING'],
  CONNECTING: ['READY', 'LOCAL_PENDING', 'RESTORED_HOLD', 'AUTH_REQUIRED', 'OFFLINE', 'ERROR', 'DISCONNECTED'],
  READY: ['CONNECTING', 'LOCAL_PENDING', 'SYNCING', 'OFFLINE', 'AUTH_REQUIRED', 'RESTORED_HOLD', 'DISCONNECTED', 'ERROR'],
  LOCAL_PENDING: ['CONNECTING', 'SYNCING', 'OFFLINE', 'AUTH_REQUIRED', 'RESTORED_HOLD', 'DISCONNECTED', 'ERROR'],
  SYNCING: ['READY', 'LOCAL_PENDING', 'CONFLICT', 'OFFLINE', 'AUTH_REQUIRED', 'ERROR', 'DISCONNECTED'],
  CONFLICT: ['SYNCING', 'LOCAL_PENDING', 'READY', 'DISCONNECTED', 'OFFLINE', 'ERROR'],
  OFFLINE: ['CONNECTING', 'SYNCING', 'READY', 'LOCAL_PENDING', 'AUTH_REQUIRED', 'DISCONNECTED', 'ERROR'],
  AUTH_REQUIRED: ['CONNECTING', 'DISCONNECTED'],
  RESTORED_HOLD: ['SYNCING', 'READY', 'LOCAL_PENDING', 'DISCONNECTED', 'OFFLINE', 'ERROR'],
  ERROR: ['SYNCING', 'CONNECTING', 'READY', 'LOCAL_PENDING', 'OFFLINE', 'AUTH_REQUIRED', 'DISCONNECTED'],
});

export function canMove(from, to) {
  return Boolean(MOVES[from]?.includes(to));
}

/**
 * نصُّ الحالة للمستخدم العاديّ (بند ٣٤) — بلا مصطلحات.
 *
 * ⚠️ ولا يظهر هنا `version vector` ولا `FIELD_CONFLICT` ولا
 *    `blobPending`. تلك للتشخيص، وهذه لإنسانٍ يريد أن يعرف: هل بياناتي
 *    واصلة؟
 */
export const SYNC_TEXT = Object.freeze({
  DISCONNECTED: 'غير متصل',
  CONNECTING: 'بيتصل…',
  READY: 'تمت المزامنة',
  LOCAL_PENDING: 'في انتظار المزامنة',
  SYNCING: 'بيزامن…',
  CONFLICT: 'يوجد تعارض يحتاج قرارك',
  OFFLINE: 'مفيش إنترنت — هيكمّل أول ما يرجع',
  AUTH_REQUIRED: 'انتهى اتصال Google Drive',
  RESTORED_HOLD: 'المزامنة موقوفة بعد استرجاع نسخة',
  ERROR: 'المزامنة وقفت — بياناتك على الجهاز زي ما هي',
});

/** هل هذه الحالةُ تسمح ببدء دورةٍ تلقائيّة؟ */
export function autoSyncAllowed(state) {
  return state === SYNC.READY || state === SYNC.LOCAL_PENDING;
}

/**
 * آلةُ الحالات — كائنٌ صغيرٌ بمشتركين.
 *
 * ⚠️ **ولا تحمل بيانات، تحمل حالةً وسياقًا للعرض.** كلُّ حقيقةٍ عن
 *    بياناتك مكانُها القاعدة؛ وما هنا وصفُ ما يجري الآن.
 */
export function createStateMachine(initial = SYNC.DISCONNECTED) {
  let state = initial;
  let context = {};
  const listeners = new Set();
  const history = [];

  const emit = () => {
    const snapshot = { state, text: SYNC_TEXT[state], ...context };
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[sync] مستمعُ حالةٍ رمى — لا يوقف المزامنة', error);
      }
    }
  };

  return {
    get state() { return state; },
    get context() { return { ...context }; },
    snapshot() { return { state, text: SYNC_TEXT[state], ...context }; },
    /** آخرُ عشرِ انتقالاتٍ — للتشخيص لا للمنطق. */
    trail() { return history.slice(-10); },

    to(next, patch = {}) {
      if (next === state) {
        context = { ...context, ...patch };
        emit();
        return state;
      }
      if (!canMove(state, next)) {
        throw new Error(`انتقالُ حالةٍ غير مسموح: ${state} ← ${next}`);
      }
      history.push({ from: state, to: next, at: Date.now() });
      state = next;
      context = { ...context, ...patch };
      emit();
      return state;
    },

    patch(values) {
      context = { ...context, ...values };
      emit();
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(this.snapshot());
      return () => listeners.delete(listener);
    },
  };
}

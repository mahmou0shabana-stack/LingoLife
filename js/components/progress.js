/**
 * LingoLife — لوحةُ تقدُّمٍ للعمليّات الطويلة (قاعدةٌ عامّةٌ في التطبيق)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لماذا لوحةٌ لا إشعار**
 * ═══════════════════════════════════════════════════════════════
 *
 * الإشعارُ (`toast`) يقول «بيتجهّز…» ثم يختفي بعد ثوانٍ، والعمليّةُ
 * تكمل دقيقةً بعده. فيبقى المستخدمُ أمام شاشةٍ ساكنةٍ لا يعرف: أشتغلَ
 * التطبيقُ أم تجمّد؟ أضغط الزرَّ ثانيةً؟
 *
 * ولذلك:
 *   · اللوحةُ **تبقى** ما دامت العمليّةُ حيّة، ولا تختفي بمؤقّت؛
 *   · وتُركَّب على `document.body` لا داخل الشاشة — فإعادةُ رسم
 *     الشاشة أثناء العمليّة لا تمحوها (وهذا يحدث فعلًا: `refresh()`
 *     يُنادى بعد كلّ خطوة في الإعدادات والسحابة)؛
 *   · ومفتاحٌ واحدٌ لكلّ عمليّة يمنع تشغيلَها مرّتين بالتوازي.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا نسبةَ مُختلَقة**
 * ═══════════════════════════════════════════════════════════════
 *
 * النسبةُ تُحسَب من `done/total` أو `bytes/totalBytes` **حين تُعرَف**.
 * وحين لا تُعرَف — كضغط أرشيفٍ أو مسحٍ لقاعدةٍ لا نعرف طولها سلفًا —
 * يظهر شريطٌ غيرُ محدَّدٍ ونصُّ مرحلةٍ صريح. ولا يُملأ الشريطُ بالوقت
 * ولا بالتخمين: شريطٌ يقول ٩٠٪ ثم يقف دقيقتين أسوأُ من شريطٍ يتحرّك
 * بلا رقم.
 *
 * ⚠️ **و«إلغاء» لا يظهر إلّا حيث الإلغاءُ آمن.** استرجاعُ نسخةٍ في
 *    منتصفه ليس فيه زرُّ إلغاء: البنيةُ ذرّيّةٌ (خانتان وسهم) والإلغاءُ
 *    الحقيقيُّ هو ألّا تُحوَّل الخانة. وعرضُ زرٍّ لا يفعل ذلك كذبٌ
 *    يُفقد الثقةَ في اللحظة الحرجة بعينها.
 */

/** العمليّاتُ الحيّةُ الآن — المفتاحُ يمنع التشغيلَ المزدوج. */
const live = new Map();

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement('div');
  host.className = 'pg-host';
  /*
   * ⚠️ `polite` لا `assertive`: قارئُ الشاشة يقرأ التقدّمَ بين الجُمل
   *    ولا يقاطع المستخدمَ عند كلّ ملفّ.
   */
  host.setAttribute('aria-live', 'polite');
  document.body.append(host);
  return host;
}

const pct = (done, total) =>
  (Number.isFinite(done) && Number.isFinite(total) && total > 0)
    ? Math.max(0, Math.min(100, Math.round((done / total) * 100)))
    : null;

/** حجمٌ مقروء — نسخةٌ محلّيّةٌ صغيرةٌ كي لا يستورد المكوِّنُ خدمة. */
function bytesLabel(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/**
 * يبدأ عمليّةً ويعرض لوحتَها.
 *
 * @param {object} input
 * @param {string} input.key      مفتاحٌ فريدٌ للعمليّة — يمنع التكرار.
 * @param {string} input.title    اسمُ العمليّة كما يفهمه المستخدم.
 * @param {string[]} [input.stages] أسماءُ المراحل — تُعرَض «٢ من ٤».
 * @param {() => void} [input.onCancel] يُعرَض زرُّ إلغاءٍ **فقط** إن مُرِّر.
 * @returns {object|null} مقبضٌ للتحكّم، أو `null` إن كانت العمليّةُ جاريةً بالفعل.
 */
export function startProgress({ key, title, stages = [], onCancel = null }) {
  if (live.has(key)) return null;

  const node = document.createElement('div');
  node.className = 'pg-card';
  node.setAttribute('role', 'group');
  node.setAttribute('aria-label', title);

  const state = {
    stage: 0,
    label: '',
    done: null,
    total: null,
    bytes: null,
    totalBytes: null,
    status: 'running',
  };

  let onRetry = null;

  function paint() {
    const percent = pct(state.bytes, state.totalBytes) ?? pct(state.done, state.total);
    const counts = (Number.isFinite(state.done) && Number.isFinite(state.total) && state.total > 0)
      ? `${state.done} / ${state.total}`
      : '';
    const size = (Number.isFinite(state.bytes) && Number.isFinite(state.totalBytes))
      ? `${bytesLabel(state.bytes)} من ${bytesLabel(state.totalBytes)}`
      : '';

    const stageLine = stages.length
      ? `<span class="pg-stage">مرحلة ${state.stage + 1} من ${stages.length}</span>`
      : '';

    const bar = state.status === 'running'
      ? (percent === null
        ? '<div class="pg-bar is-indef"><i></i></div>'
        : `<div class="pg-bar"><i style="inline-size:${percent}%"></i></div>`)
      : '';

    node.className = `pg-card is-${state.status}`;
    node.innerHTML = `
      <div class="pg-top">
        <strong class="pg-title">${title}</strong>
        ${stageLine}
      </div>
      <div class="pg-label">${state.label || (stages[state.stage] || '')}</div>
      ${bar}
      <div class="pg-meta">
        ${percent !== null ? `<b>${percent}%</b>` : ''}
        ${counts ? `<span>${counts}</span>` : ''}
        ${size ? `<span>${size}</span>` : ''}
      </div>
      <div class="pg-actions"></div>`;

    const actions = node.querySelector('.pg-actions');
    if (state.status === 'failed' && onRetry) {
      const retry = document.createElement('button');
      retry.className = 'btn btn-sm';
      retry.textContent = 'جرّب تاني';
      retry.addEventListener('click', () => { close(); onRetry(); });
      actions.append(retry);
    }
    if (state.status !== 'running') {
      const ok = document.createElement('button');
      ok.className = 'btn btn-ghost btn-sm';
      ok.textContent = 'تمام';
      ok.addEventListener('click', close);
      actions.append(ok);
    } else if (onCancel) {
      /* ⚠️ ولا يظهر إلّا إن مرَّره النداءُ صراحةً — راجع ترويسةَ الملفّ. */
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost btn-sm';
      cancel.textContent = 'إلغاء';
      cancel.addEventListener('click', () => {
        state.label = 'بيلغي…';
        paint();
        onCancel();
      });
      actions.append(cancel);
    }
  }

  /**
   * يُفرِج عن المفتاح — **عند انتهاء العمل لا عند اختفاء البطاقة**.
   *
   * ⚠️ **وقع هذا فعلًا:** كان المفتاحُ يبقى محجوزًا حتى تضغط «تمام»،
   *    فيقال لك «العمليّة دي شغّالة بالفعل» عن عمليّةٍ **انتهت** —
   *    وأنت تراها منتهيةً أمامك. والبطاقةُ تبقى لتُقرأ (بند التقدُّم
   *    يقول ذلك صراحةً)، لكنّ بقاءَها ليس بقاءَ العمل. فالحجزُ يُرفَع
   *    عند `done`/`fail`/`cancelled`، والبطاقةُ تنصرف على مهلها.
   */
  const release = () => live.delete(key);

  function close() {
    release();
    node.classList.add('pg-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    /* ⚠️ وشبكةُ أمانٍ لو لم تُطلَق الحركةُ أصلًا (تفضيلُ تقليل الحركة). */
    setTimeout(() => node.remove(), 400);
  }

  ensureHost().append(node);
  paint();

  const handle = {
    /** ينتقل إلى مرحلةٍ بالاسم أو بالرقم، ويصفّر عدّادَ المرحلة السابقة. */
    stage(nameOrIndex, label = null) {
      const index = typeof nameOrIndex === 'number'
        ? nameOrIndex
        : Math.max(0, stages.indexOf(nameOrIndex));
      state.stage = index;
      state.label = label ?? stages[index] ?? '';
      state.done = null;
      state.total = null;
      state.bytes = null;
      state.totalBytes = null;
      paint();
      return handle;
    },

    /** يحدّث الأرقام. ما لم يُمرَّر يبقى كما هو. */
    set({ label, done, total, bytes, totalBytes } = {}) {
      if (label !== undefined) state.label = label;
      if (done !== undefined) state.done = done;
      if (total !== undefined) state.total = total;
      if (bytes !== undefined) state.bytes = bytes;
      if (totalBytes !== undefined) state.totalBytes = totalBytes;
      paint();
      return handle;
    },

    /** مرحلةٌ لا يُعرَف طولُها — شريطٌ غيرُ محدَّدٍ ونصٌّ صريح. */
    indeterminate(label) {
      state.label = label;
      state.done = null;
      state.total = null;
      state.bytes = null;
      state.totalBytes = null;
      paint();
      return handle;
    },

    /** نهايةٌ ناجحةٌ بتفاصيلَ مفيدة — تبقى على الشاشة حتى يغلقها. */
    done(label) {
      state.status = 'ok';
      state.label = label;
      release();
      paint();
      return handle;
    },

    /** فشلٌ صريحٌ مع «جرّب تاني» إن كانت الإعادةُ ممكنة. */
    fail(label, { retry = null } = {}) {
      state.status = 'failed';
      state.label = label;
      onRetry = retry;
      release();
      paint();
      return handle;
    },

    /** أُلغيت بطلب المستخدم. */
    cancelled(label = 'اتلغت') {
      state.status = 'cancelled';
      state.label = label;
      release();
      paint();
      return handle;
    },

    close,
    get key() { return key; },
  };

  live.set(key, handle);
  return handle;
}

/** هل العمليّةُ دي شغّالة دلوقتي؟ */
export const isRunning = (key) => live.has(key);

/**
 * يشغّل عمليّةً طويلةً مرّةً واحدةً — ويمنع الضغطةَ المزدوجة.
 *
 * ⚠️ **والمنعُ بنيويٌّ لا بتعطيل زرّ.** تعطيلُ الزرّ يُنسى في مسارٍ
 *    واحدٍ من خمسة، ثم يُعاد رسمُ الشاشةُ فيعود الزرُّ نشطًا وهي ما زالت
 *    تعمل. أمّا المفتاحُ هنا فيعيش خارج الشاشة، فيصمد أمام إعادة الرسم.
 *
 * @param {object} input نفسُ وسائط `startProgress`.
 * @param {(handle: object) => Promise<any>} run
 */
export async function withProgress(input, run) {
  const handle = startProgress(input);
  if (!handle) {
    const { toast } = await import('./toast.js');
    toast('العمليّة دي شغّالة بالفعل');
    return { skipped: true };
  }
  try {
    return await run(handle);
  } catch (error) {
    handle.fail(error?.message || String(error));
    throw error;
  }
}

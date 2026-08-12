/**
 * LingoLife — «طوّر ده»: تسجيل ملاحظةٍ من أي شاشة
 *
 * ═══════════════════════════════════════════════════════════════
 * الملاحظة تُكتب حيث رأيتَها
 * ═══════════════════════════════════════════════════════════════
 *
 * أن تفتح شاشةً أخرى لتكتب ملاحظةً عن هذه الشاشة يعني شيئين: أن
 * تفقد المكان، وأن تكتب «فيه حاجة في الكتاب مش مظبوطة» بعد دقيقةٍ
 * من نسيان ما هي بالضبط.
 *
 * فالنموذج يُفتَح فوق الشاشة نفسها، **ويلتقط مكانك تلقائيًّا**:
 * نمطَ المسار للتجميع، والمسار الحرفيّ للرجوع، ونسخةَ البناء.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ويسأل «دي جديدة ولا مرتبطة بحاجة قديمة؟» قبل الحفظ
 * ═══════════════════════════════════════════════════════════════
 *
 * ثلاثة أبواب لا واحد — وهي نفس قاعدة الاستيراد *(docs/10)*:
 *
 *   · **ضيفها لـBrief موجود**   — نفس التطوير الأكبر
 *   · **اعملها ملاحظة جديدة**   — الافتراضيّ
 *   · **شوف الشبيه**            — تفتحه فتقرّر
 *
 * **ولا دمجَ تلقائيّ أبدًا.** الشبه دليلٌ يُعرَض بسببه («على نفس
 * الشاشة»، «كلمات مشتركة: الكتاب»)، والحاسم أنت.
 */

import { html, raw, $, $$, esc } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toastOk, toastError } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { getCurrentRoute, navigate } from '../router.js';
import { pickFiles } from '../services/media-service.js';
import { PRIORITY, PRIORITY_META, STATUS, featureOf, featureLabel } from '../services/dev/model.js';
import { createIssue, similarIssues, moveToBrief } from '../services/dev/issue-service.js';
import { listBriefs, createBrief } from '../services/dev/brief-service.js';
import { attachShot } from '../services/dev/shots.js';
import { appBuild } from '../services/dev/build.js';

/* ------------------------------------------------------------------ *
 * التقاط المكان
 * ------------------------------------------------------------------ */

/**
 * أين أنت الآن — من الموجِّه لا بالتخمين.
 *
 * ⚠️ النمط (`/scene/:id`) للتجميع، والمسار الحرفيّ (`/scene/SC_a1`)
 *    للرجوع. حفظُ الحرفيّ وحده يجعل «أنهي شاشة عليها أكتر ملاحظات؟»
 *    بلا إجابة، وحفظُ النمط وحده يجعلك لا تعرف أي ذكرى كانت.
 */
export function whereAmI() {
  const route = getCurrentRoute();
  const pattern = route?.pattern || '/';
  return {
    routePattern: pattern,
    routePath: route?.path || '/',
    featureId: featureOf(pattern),
    featureLabel: featureLabel(featureOf(pattern)),
  };
}

/* ------------------------------------------------------------------ *
 * النموذج
 * ------------------------------------------------------------------ */

/** حالةٌ تعيش طول عمر النموذج — الصور تُختار قبل أن تُحفظ الملاحظة. */
let draft = null;

/*
 * ⚠️ **اللقطة تُرفَق ولا تُلتقَط** — راجع `services/dev/shots.js` للسبب
 *    كاملًا: المتصفّح لا يعطي الصفحة صورةَ نفسها، و`getDisplayMedia`
 *    غير مدعومة على أندرويد، ومكتبةُ رسمٍ للـDOM تخالف قاعدة المشروع.
 *    فتصوّر بجهازك ثم تُرفق — وهي أصدق لأنها ما رأيتَه فعلًا.
 *
 * ⚠️ ولا يُكتب هذا داخل قالب `html` مهما كان مغريًا: **علامةٌ خلفيّة
 *    داخل القالب تُنهيه** ولو كانت في تعليق HTML. سقط التطبيق كلّه
 *    بذلك مرّةً قبل اليوم، وسقط الآن مرّةً ثانية — ومسكه فحصُ الإقلاع
 *    وفحصُ الوحدات في نفس الثانية.
 */
export async function openImproveModal() {
  const here = whereAmI();
  const [briefs, build] = await Promise.all([listBriefs({ onlyActive: true }), appBuild()]);

  draft = { files: [], similar: [], briefId: '', shotPreview: [] };

  await showModal({
    title: 'طوّر ده',
    submitLabel: 'احفظ الملاحظة',
    body: html`
      <div class="imp-where">
        ${raw(icon('place'))}
        <div>
          <strong>${here.featureLabel}</strong>
          <code>${here.routePattern}</code>
        </div>
      </div>

      <div class="field">
        <label for="iv-title">عايز تطوّر إيه؟</label>
        <input id="iv-title" name="title" type="text" autocomplete="off"
               placeholder="زرّ التشغيل صغير" required />
      </div>

      <!-- الشبيه يظهر هنا وأنت بتكتب، قبل ما تحفظ -->
      <div class="imp-similar" id="iv-similar" hidden></div>

      <div class="field">
        <label for="iv-body">تعليقك</label>
        <textarea id="iv-body" name="body" rows="3"
                  placeholder="اكتب براحتك — ده اللي هتقراه بعد شهور"></textarea>
      </div>

      <div class="imp-row">
        <div class="field">
          <label for="iv-priority">الأولويّة</label>
          <select id="iv-priority" name="priority">
            ${raw(Object.entries(PRIORITY_META).map(([id, meta]) => html`
              <option value="${id}" ${id === PRIORITY.NORMAL ? 'selected' : ''}>${meta.label}</option>`).join(''))}
          </select>
        </div>
        <div class="field">
          <label for="iv-status">ابدأها كـ</label>
          <select id="iv-status" name="status">
            <option value="${STATUS.OPEN}" selected>مفتوحة</option>
            <option value="${STATUS.IDEA}">فكرة</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label for="iv-brief">تحت Brief؟</label>
        <select id="iv-brief" name="briefId">
          <option value="">— لوحدها —</option>
          ${raw(briefs.map((row) => html`
            <option value="${row.id}">${row.title}</option>`).join(''))}
          <option value="__new">+ اعمل Brief جديد…</option>
        </select>
        <input id="iv-new-brief" name="newBrief" type="text" hidden
               placeholder="اسم الـBrief الجديد" autocomplete="off" />
      </div>

      <div class="imp-shots">
        <button type="button" class="btn btn-ghost btn-sm" data-improve="pick">
          ${raw(icon('image'))} أرفق لقطة
        </button>
        <p class="field-hint">
          صوّر الشاشة بجهازك (مسح الكفّ أو زرّ التشغيل + خفض الصوت)،
          وبعدين أرفقها من هنا. بعد ما تحفظ تقدر تحدّد الجزء المقصود.
        </p>
        <div class="imp-thumbs" id="iv-thumbs"></div>
      </div>

      <div class="field">
        <label for="iv-accept">إمتى تعتبرها خلصت؟ <span class="opt">(اختياري)</span></label>
        <input id="iv-accept" name="acceptance" type="text" autocomplete="off"
               placeholder="الزرّ يبقى 56px ودايري" />
      </div>`,

    onMount() {
      wireDraft(here);
    },

    async onSubmit(data, close) {
      const title = String(data.title || '').trim();
      if (!title) {
        toastError('اكتب عايز تطوّر إيه');
        return;
      }

      try {
        const issue = await createIssue({
          title,
          body: data.body,
          routePattern: here.routePattern,
          routePath: here.routePath,
          priority: data.priority || PRIORITY.NORMAL,
          status: data.status || STATUS.OPEN,
          acceptance: data.acceptance,
          build,
        });

        /* الـBrief: موجودٌ أو جديدٌ يُنشأ في نفس الحفظة. */
        let briefId = data.briefId || '';
        if (briefId === '__new') {
          const name = String(data.newBrief || '').trim();
          briefId = name ? (await createBrief({ title: name })).id : '';
        }
        if (briefId) await moveToBrief(issue.id, briefId);

        for (const file of draft.files) {
          await attachShot(issue.id, file).catch(() => {});
        }

        close();
        toastOk('اتسجّلت');
      } catch (err) {
        toastError(err.message || 'مقدرناش نحفظ');
        throw err;
      }
    },
  });
}

/* ------------------------------------------------------------------ *
 * التوصيل
 * ------------------------------------------------------------------ */

function wireDraft(here) {
  const titleInput = $('#iv-title');
  const similarBox = $('#iv-similar');
  const briefSelect = $('#iv-brief');
  const newBrief = $('#iv-new-brief');

  /*
   * ⚠️ البحث عن الشبيه **وأنت بتكتب** لا بعد الحفظ. أن تُنشأ الملاحظة
   *    ثم يُقال لك «فيه واحدة زيّها» يعني أن عندك اتنتين الآن.
   */
  /*
   * ⚠️ **المؤقّت يعيش بعد النموذج.** تكتب العنوان فيبدأ الانتظار، ثم
   *    تحفظ أو تُغلق قبل أن ينتهي — فيولّع البحثُ على نموذجٍ لم يعد
   *    موجودًا، ويكتب في حالةٍ ذهبت. كان يرمي
   *    `Cannot set properties of null` في وحدة التحكّم، ولا يظهر في
   *    الشاشة — فلا تعرف أنه يحدث.
   *
   *    كشفه تحقّقُ المتصفّح لا الاختبار: الاختبارات تستدعي الخدمة،
   *    وهذا زمنٌ بين ضغطتين.
   */
  let timer;
  let alive = true;
  const stop = () => {
    alive = false;
    clearTimeout(timer);
  };
  // النموذج يُنزَع من الـDOM عند الإغلاق بأي طريق — إغلاقًا أو حفظًا أو Escape.
  const host = titleInput?.closest('.overlay');
  if (host) new MutationObserver((_, observer) => {
    if (!document.body.contains(host)) {
      stop();
      observer.disconnect();
    }
  }).observe(document.body, { childList: true });

  titleInput?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const title = titleInput.value.trim();
      if (title.length < 3) {
        if (similarBox) similarBox.hidden = true;
        return;
      }
      const found = await similarIssues({ title, featureId: here.featureId });
      // قد يكون النموذج أُغلق أثناء القراءة — فلا يُكتب في لا شيء.
      if (!alive || !draft) return;
      draft.similar = found;
      renderSimilar(similarBox, found);
    }, 300);
  });

  briefSelect?.addEventListener('change', () => {
    newBrief.hidden = briefSelect.value !== '__new';
    if (!newBrief.hidden) newBrief.focus();
  });

  $('[data-improve="pick"]')?.addEventListener('click', async () => {
    const files = await pickFiles({ accept: 'image/*', multiple: true });
    if (!files?.length) return;
    draft.files.push(...files);
    renderThumbs();
  });

  similarBox?.addEventListener('click', (event) => {
    const node = event.target.closest('[data-similar]');
    if (!node) return;
    // يفتح الملاحظة القديمة — والنموذج يُغلَق، فلا يُنشأ تكرارٌ بالغلط.
    navigate(`/dev/issue/${node.dataset.similar}`);
    $('.modal-backdrop')?.remove();
    document.body.classList.remove('modal-open');
  });
}

function renderSimilar(box, found) {
  if (!found.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = html`
    <p class="imp-similar-head">
      ${raw(icon('info'))}
      فيه ${found.length === 1 ? 'ملاحظة' : `${found.length} ملاحظات`} مفتوحة ممكن تكون نفس الحاجة:
    </p>
    ${raw(found.map((row) => html`
      <button type="button" class="imp-sim" data-similar="${row.issue.id}">
        <span class="imp-sim-title">${row.issue.title}</span>
        <span class="imp-sim-why">${row.why.join(' · ')}</span>
      </button>`).join(''))}
    <p class="imp-similar-foot">
      لو دي نفسها — افتحها وضيف تعليقك عليها. ولو مختلفة كمّل عادي،
      <strong>مفيش حاجة بتتدمج لوحدها</strong>.
    </p>`;
}

function renderThumbs() {
  const box = $('#iv-thumbs');
  if (!box) return;
  box.innerHTML = '';
  draft.files.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const wrap = document.createElement('div');
    wrap.className = 'imp-thumb';
    wrap.innerHTML = `<img src="${url}" alt=""><button type="button" data-drop="${i}"
      aria-label="شيل الصورة">×</button>`;
    wrap.querySelector('[data-drop]').addEventListener('click', () => {
      URL.revokeObjectURL(url);
      draft.files.splice(i, 1);
      renderThumbs();
    });
    box.append(wrap);
  });
}

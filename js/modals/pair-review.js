/**
 * LingoLife — مراجعةُ الأزواج قبل الالتزام (WS-D، بنود ١٠…١١ و٢٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا مراجعةٌ أصلًا
 * ═══════════════════════════════════════════════════════════════
 *
 * المحلّلُ بنيويٌّ لا دلاليّ: يقرأ الشكلَ فيصيب غالبًا، ويعلن جهلَه
 * حين يلتبس. والبندُ ١٠ صريح: **لا التزامَ صامتٍ بقرانٍ غيرِ مؤكَّد**.
 *
 * فهذه النافذةُ تعرض ما فهمه — زوجًا زوجًا — وتترك لك ثلاثةَ أفعال:
 * تؤكّد، أو تفكّ، أو تربط سطرًا عربيًّا آخر.
 *
 * ⚠️ **وليست جدولَ إدارة** (بند ١١): لا أعمدةَ ولا مصفوفة. بطاقةٌ لكلّ
 *    زوج: الروسيُّ فوق والعربيُّ تحته، وتفهمها بنظرةٍ واحدة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الاتّجاهان صريحان — والصمتُ عنهما عطب (بندا ٥٣ و٥٤)
 * ═══════════════════════════════════════════════════════════════
 *
 * صفحةُ التطبيق عربيّةٌ (`dir="rtl"`). ونصٌّ روسيٌّ داخلها **يرث
 * الاتّجاه**، فتنقلب علاماتُه: «Документ.» تُعرَض «.Документ»، والقوسان
 * يتبادلان، والأرقامُ تقفز إلى الطرف الخطأ. وهذا لا يظهر في اختبارِ
 * نصٍّ — يظهر للعين وحدَها.
 *
 * فكلُّ كتلةٍ تعلن اتّجاهها بنفسها: `dir="ltr"` للروسيّ و`dir="rtl"`
 * للعربيّ — **على العنصر لا على الصفحة**.
 */

import { html, raw, esc } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import {
  PAIR_STATUS, STATUS_LABEL, STRUCTURAL, SETTLED,
  attachTranslation, detachTranslation, restatus,
} from '../services/shadow/bilingual.js';
import { translationView, SECTION_LABEL } from '../services/shadow/draft-structure.js';

/** هل هذه الوحدةُ صالحةٌ لتصير مقطعَ تدريب؟ */
const practicable = (one) => Boolean(one.ru);

/**
 * ⚠️ **البنيةُ تُعرَض ولا تُنادي عليك** (WS-DR · بندا ١٢ و٣٧).
 *
 *    عنوانُ القسم والشرحُ والقالبُ والفاصلُ **مفهومةٌ تمامًا**، فلا
 *    تُعطى بطاقةً بحجم بطاقةِ الزوج ولا زرًّا يطلب إصلاحًا. تظهر سطرًا
 *    هادئًا يقول «فهمتُ هذا» — لأنّ إخفاءها كذبٌ بالحذف، وتضخيمها
 *    إغراقٌ يُخفي الشكَّ الحقيقيَّ وسط الضجيج.
 */
const isQuiet = (one) => STRUCTURAL.has(one.status);

/** الوحداتُ العربيّةُ الحرّة — مرشّحاتُ الربط اليدويّ. */
function freeArabic(units) {
  return units
    .map((one, i) => ({ one, i }))
    .filter(({ one }) => one.ar && !one.ru);
}

/**
 * يرسم بطاقةَ زوجٍ واحد.
 *
 * ⚠️ **والحالةُ مكتوبةٌ لا ملوّنةٌ فقط**: لونٌ وحدَه لا يُقرأ على شاشةٍ
 *    في الشمس، ولا يعرفه مَن لا يميّز الألوان.
 */
function cardHtml(one, i, units) {
  /* البنيةُ سطرٌ هادئٌ لا بطاقة — راجع `isQuiet`. */
  if (isQuiet(one)) {
    const body = one.ar || one.raw || '';
    return html`
      <p class="pr-quiet" data-pr-quiet="${i}">
        <span class="pr-quiet-kind">${STATUS_LABEL[one.status] || ''}</span>
        <span dir="auto">${body}</span>
      </p>`;
  }

  const canPick = practicable(one);
  const others = freeArabic(units).filter(({ i: at }) => at !== i);
  const view = translationView(one.ar || '', one.primary || 0);

  return html`
    <article class="pr-card${canPick ? '' : ' is-orphan'}" data-pr-card="${i}">
      <div class="pr-head">
        <label class="pr-pick">
          <input type="checkbox" data-pr-use="${i}" ${canPick ? 'checked' : ''}
                 ${canPick ? '' : 'disabled'}>
          <span class="pr-num">${i + 1}</span>
        </label>
        <span class="pr-status pr-${one.status}">${STATUS_LABEL[one.status] || one.status}</span>
        ${raw(one.section && SECTION_LABEL[one.section]
          ? html`<span class="pr-section">${SECTION_LABEL[one.section]}</span>` : '')}
      </div>

      ${raw(one.ru
        ? html`<p class="pr-ru" dir="ltr" lang="ru">${one.ru}</p>`
        : html`<p class="pr-missing">مفيش أصل روسي — ده نصّ عربي لوحده</p>`)}

      ${raw(one.ar
        ? html`<p class="pr-ar" dir="rtl" lang="ar">${view.primary}</p>`
        : html`<p class="pr-missing">بدون ترجمة</p>`)}

      <!--
        ⚠️ **البدائلُ معروضةٌ لا مطويّة، والاختيارُ لك** (بندا ٨ و٣٨).
           «إثبات / تأكيد» معنيان لعنصرٍ روسيٍّ **واحد** — لا عنصران.
           فتظهر البدائلُ أزرارًا تختار منها ما تريده ترجمةً أساسيّةً
           في التدريب، **والباقي لا يُحذَف**: يبقى في الحقل كما لصقتَه.
      -->
      ${raw(view.hasAlts ? html`
        <div class="pr-alts">
          <span class="pr-alts-lab">معاني تانية:</span>
          ${raw(view.all.map((one2, at) => html`
            <button type="button" class="pr-alt ${at === (one.primary || 0) ? 'is-on' : ''}"
                    data-pr-primary="${i}" data-pr-choice="${at}"
                    aria-pressed="${at === (one.primary || 0) ? 'true' : 'false'}"
                    dir="rtl" lang="ar">${one2}</button>`).join(''))}
        </div>` : '')}

      <div class="pr-acts">
        ${raw(one.ar
          ? html`<button type="button" data-pr-detach="${i}">فكّ الترجمة</button>`
          : '')}
        ${raw(others.length && one.ru
          ? html`<button type="button" data-pr-attach="${i}">${one.ar ? 'غيّر الترجمة' : 'اربط ترجمة'}</button>`
          : '')}
      </div>

      ${raw(others.length && one.ru
        ? html`
          <div class="pr-choose" data-pr-choose="${i}" hidden>
            <p class="pr-hint">اختار السطر العربي الصحيح:</p>
            ${raw(others.map(({ one: other, i: at }) => html`
              <button type="button" class="pr-cand" data-pr-take="${i}" data-pr-from="${at}"
                      dir="rtl" lang="ar">${other.ar}</button>`).join(''))}
          </div>`
        : '')}
    </article>`;
}

/** رأسُ النافذة — إحصاءٌ محسوبٌ من الوحدات نفسِها. */
function headHtml(units) {
  /*
   * ═══════════════════════════════════════════════════════════
   * ⚠️ **الرقمُ الأوّلُ يقول ما فُهم لا ما بقي** (بند ١٢)
   * ═══════════════════════════════════════════════════════════
   *
   * كان الرأسُ يقول على مسودّةٍ حقيقيّة: «٤ مقترنة · ١ روسي بلا
   * ترجمة · ١٧ عربي لوحده». رقمٌ صادقٌ حسابيًّا، ورسالةٌ كاذبةٌ
   * تمامًا: يوحي بأن الاستيرادَ فشل، بينما ٢٥ من الثلاثين كانت
   * عناوينَ وشروحًا مفهومةً لا ينقصها شيء.
   *
   * والآن: **«٢٤ اتعرفت · ٠ محتاجة مراجعتك»** — ثمّ التفصيلُ لمن
   * أراده. فتعرف من السطر الأوّل هل تقرأ أم تُصلح.
   */
  const settled = units.filter((one) => SETTLED.has(one.status)).length;
  const needs = units.length - settled;
  const paired = units.filter((one) => one.ru && one.ar && !isQuiet(one)).length;
  const quiet = units.filter(isQuiet).length;

  return html`
    <p class="pr-sum">
      <b class="pr-ok">${settled}</b> وحدة اتعرفت
      ${raw(needs ? html` · <b class="pr-warn">${needs}</b> محتاجة مراجعتك` : ' · مفيش حاجة محتاجة مراجعة')}
    </p>
    <p class="pr-sum pr-sum-fine">
      ${paired} زوج للتدريب ${raw(quiet ? html`· ${quiet} عنوان وشرح وقالب` : '')}
    </p>
    <p class="pr-note">
      اللي عليه علامة هيدخل التدريب. الشرح والعناوين مش أزواج ناقصة — دي بنية المسودّة.
    </p>`;
}

/**
 * يفتح مراجعةَ الأزواج.
 *
 * @param {{units: object[], title?: string}} options
 * @returns {Promise<{units: object[], picked: object[]}|null>}
 */
export async function openPairReview({ units, title = '' }) {
  /* نسخةٌ نعمل عليها — المصدرُ لا يُمَسّ حتى تضغط «ابدأ». */
  let working = units.map((one) => ({ ...one }));
  /* ما ألغى المستخدمُ تأشيرَه — بالفهرس في `working`. */
  let skipped = new Set();

  let result = null;

  await showModal({
    title: title ? `راجع الأزواج · ${title}` : 'راجع الأزواج',
    submitLabel: 'ابدأ بالمحدّد',
    wide: true,
    body: html`<div class="pair-review" data-pr-root></div>`,
    onMount(root) {
      const host = root.querySelector('[data-pr-root]');

      const paint = () => {
        host.innerHTML = headHtml(working)
          + working.map((one, i) => cardHtml(one, i, working)).join('');
        /* التأشيرُ الملغى يبقى ملغًى عبر إعادات الرسم. */
        for (const at of skipped) {
          const box = host.querySelector(`[data-pr-use="${at}"]`);
          if (box) box.checked = false;
        }
      };

      host.addEventListener('change', (event) => {
        const box = event.target.closest('[data-pr-use]');
        if (!box) return;
        const at = Number(box.dataset.prUse);
        if (box.checked) skipped.delete(at);
        else skipped.add(at);
      });

      host.addEventListener('click', (event) => {
        const detach = event.target.closest('[data-pr-detach]');
        if (detach) {
          working = detachTranslation(working, Number(detach.dataset.prDetach));
          skipped = new Set();
          paint();
          return;
        }

        const ask = event.target.closest('[data-pr-attach]');
        if (ask) {
          const panel = host.querySelector(`[data-pr-choose="${ask.dataset.prAttach}"]`);
          if (panel) panel.hidden = !panel.hidden;
          return;
        }

        /*
         * ⚠️ **اختيارُ الترجمة الأساسيّة لا يحذف البدائل** (بند ٣٨):
         *    يُكتَب رقمُ اختيارك في `primary` و`ar` يبقى كما لصقتَه.
         */
        const pick = event.target.closest('[data-pr-primary]');
        if (pick) {
          const at = Number(pick.dataset.prPrimary);
          const choice = Number(pick.dataset.prChoice);
          working = working.map((one, i) => (i === at ? { ...one, primary: choice } : one));
          paint();
          return;
        }

        const take = event.target.closest('[data-pr-take]');
        if (take) {
          /*
           * ⚠️ **والنقلُ يفرّغ المانح** — راجع `attachTranslation`.
           *    فلا يبقى السطرُ العربيُّ في مكانين بعد الإصلاح (بند ٤٣).
           */
          working = attachTranslation(
            working,
            Number(take.dataset.prTake),
            Number(take.dataset.prFrom),
          );
          skipped = new Set();
          paint();
        }
      });

      paint();
    },
    onSubmit(_data, close) {
      const units2 = working.map(restatus);
      result = {
        units: units2,
        picked: units2.filter((one, i) => practicable(one) && !skipped.has(i)),
      };
      close();
    },
  });

  return result;
}

/* ما يُصدَّر للاختبار وحدَه — لا تستعمله الشاشة. */
export const __test = { freeArabic, practicable, PAIR_STATUS };

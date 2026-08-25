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
import { PAIR_STATUS, STATUS_LABEL, attachTranslation, detachTranslation, restatus }
  from '../services/shadow/bilingual.js';

/** هل هذه الوحدةُ صالحةٌ لتصير مقطعَ تدريب؟ */
const practicable = (one) => Boolean(one.ru);

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
  const canPick = practicable(one);
  const others = freeArabic(units).filter(({ i: at }) => at !== i);

  return html`
    <article class="pr-card${canPick ? '' : ' is-orphan'}" data-pr-card="${i}">
      <div class="pr-head">
        <label class="pr-pick">
          <input type="checkbox" data-pr-use="${i}" ${canPick ? 'checked' : ''}
                 ${canPick ? '' : 'disabled'}>
          <span class="pr-num">${i + 1}</span>
        </label>
        <span class="pr-status pr-${one.status}">${STATUS_LABEL[one.status] || one.status}</span>
      </div>

      ${raw(one.ru
        ? html`<p class="pr-ru" dir="ltr" lang="ru">${one.ru}</p>`
        : html`<p class="pr-missing">مفيش أصل روسي — ده نصّ عربي لوحده</p>`)}

      ${raw(one.ar
        ? html`<p class="pr-ar" dir="rtl" lang="ar">${one.ar}</p>`
        : html`<p class="pr-missing">بدون ترجمة</p>`)}

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
  const paired = units.filter((one) => one.ru && one.ar).length;
  const bare = units.filter((one) => one.ru && !one.ar).length;
  const orphan = units.filter((one) => !one.ru && one.ar).length;

  return html`
    <p class="pr-sum">
      <b>${paired}</b> مقترنة ·
      <b>${bare}</b> روسي بلا ترجمة ·
      <b>${orphan}</b> عربي لوحده
    </p>
    <p class="pr-note">
      اللي عليه علامة هيدخل التدريب. العربي لوحده مش هيدخل — هو ترجمة مش جملة تتنطق.
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

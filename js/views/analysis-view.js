/**
 * LingoLife — «إيه اللي بيانك بيقوله؟»
 *
 * ═══════════════════════════════════════════════════════════════
 * ثلاث قواعد
 * ═══════════════════════════════════════════════════════════════
 *
 * **١. كل رقمٍ معه دليله في نفس الشاشة** *(بند 66)*. «١٢ تصحيح في جنس
 *    الكلمة» يفتح تحته الأمثلة نفسها — لا رقمٌ يطلب منك أن تصدّقه.
 *
 * **٢. لا يُختلَق تقدّم** *(بند 74)*. مفيش «تحسّنت ٪كذا»، ولا شريط
 *    يمتلئ. ما لا يُقاس مكتوبٌ في آخر الشاشة بسببه لا مطويٌّ عنك.
 *
 * **٣. الفراغ يُقال ولا يُزيَّن.** قسمٌ بلا بيانات يقول ما الذي يملؤه،
 *    فتعرف أن الصفر صادقٌ لا عطب.
 */

import { html, raw } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { formatDate } from '../utils/dates.js';
import { counted, plural } from '../utils/plural.js';
import { analysisOverview } from '../services/analysis-service.js';

/** قسمٌ بعنوانٍ وعدد — والفراغ يقول ما الذي يملؤه. */
function section(title, iconName, count, body, emptyNote) {
  return html`
    <section class="fc-section">
      <h3>${raw(icon(iconName, 17))} ${title}
        ${raw(count ? html`<span class="fc-count">${count}</span>` : '')}</h3>
      ${raw(body || html`<p class="fc-empty">${emptyNote}</p>`)}
    </section>`;
}

/**
 * نمط خطأ: النوع وعدده، وتحته التصحيحات نفسها.
 *
 * ⚠️ لا نسبة *(راجع `NOT_MEASURED.errorRate`)*: نعرف كم تصحيحًا كتبتَ،
 *    ولا نعرف كم جملةً قلتَها صحيحة. الكسر بلا مقام ليس نسبة.
 */
function mistakeGroup(group) {
  return html`
    <details class="an-group">
      <summary>
        <span class="an-name">${group.label}</span>
        <span class="fc-count">${group.count}</span>
      </summary>
      ${raw(group.items.map((item) => html`
        <button class="an-case" data-action="open-scene" data-id="${item.sceneId}">
          <span class="an-wrong" dir="ltr" lang="ru">${item.wrong}</span>
          <span class="an-natural" dir="ltr" lang="ru">${item.natural}</span>
          ${raw(item.explanation ? html`<span class="an-why">${item.explanation}</span>` : '')}
          <span class="an-where"><bdi>${item.sceneTitle}</bdi></span>
        </button>`).join(''))}
      ${raw(group.count > group.items.length
        ? html`<p class="fc-empty">وفيه
            ${counted(group.count - group.items.length, 'تصحيح', 'تصحيحين', 'تصحيحات')}
            تاني من النوع ده في ذكرياتهم.</p>`
        : '')}
    </details>`;
}

/** صفُّ محور — يفتح النهر مُصفّى عليه، كما في شاشة المحاور. */
function facetRow(axis, row) {
  return html`
    <button class="fc-row" data-action="facet-open" data-axis="${axis}"
            data-id="${row.id || row.key}" data-label="${row.label}">
      <span class="fc-label"><bdi>${row.label}</bdi></span>
      <span class="fc-count">${row.count}</span>
    </button>`;
}

export async function renderAnalysis(main) {
  const data = await analysisOverview();
  const { mistakes, captures, where, rhythm, practice } = data;

  const empty = !mistakes.total && !captures.total && !rhythm.total && !practice.repetitions;

  main.innerHTML = html`
    <div class="view-head">
      <h1>إيه اللي بيانك بيقوله</h1>
      <div class="sub">كله محسوب من اللي عندك — مفيش تخمين ولا حاجة بتخرج من جهازك</div>
    </div>

    ${raw(empty ? html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('gauge'))}</div>
        <h2>لسه مفيش حاجة نقراها</h2>
        <p>
          التحليل ده بيتبني من تصحيحاتك ومحفوظاتك وذكرياتك. أضف
          «خطأ / طبيعي» في أي ذكرى، وهتلاقي هنا أنماط بتتكرّر.
        </p>
        <button class="btn btn-ghost" data-action="go-river">افتح النهر</button>
      </div>` : html`
      <div class="fc-board">

      ${raw(section('أنماط بتتكرّر في تصحيحاتك', 'compare', mistakes.total,
        mistakes.types.map(mistakeGroup).join(''),
        'أضف «خطأ / طبيعي» في ذكرياتك، وهنا هتشوف نوع الغلط اللي بيرجع.'))}

      ${raw(section('بتلتقط إيه وليه', 'book', captures.total,
        captures.tags.length ? html`
          ${raw(captures.tags.map((tag) => html`
            <div class="fc-row is-plain">
              <span class="fc-label">${tag.label}</span>
              <span class="fc-count">${tag.count}</span>
            </div>`).join(''))}
          ${raw(captures.untagged ? html`
            <p class="fc-empty">
              و${counted(captures.untagged, 'محفوظة', 'محفوظتين', 'محفوظات')} بلا تصنيف.
            </p>` : '')}
          <p class="lg-note">
            ده سجلّ اللي استوقفك — <strong>مش عدد الكلمات اللي تعرفها</strong>.
            اللي بقى عاديًّا عندك مش بتلتقطه أصلًا.
          </p>` : '',
        'لمّا تحفظ كلمة أو جملة وتقول ليه، هنا هيبان نوع الصعوبة الغالب عندك.'))}

      <!--
        ⚠️ ثلاثة أقسام لا قسمٌ بثلاثة عناوين فرعيّة. السبب معماريّ
           وبصريّ معًا: القسم لا ينقسم بين عمودين، فواحدٌ طويلٌ يقفز
           كلّه إلى العمود الثاني ويترك الأوّل فارغًا — رأيتُه في لقطةٍ
           على مقاس التابلت. وثلاثةٌ قصيرة تنضغط. وهو أيضًا ما تفعله
           شاشة المحاور أصلًا.

        ⚠️ ولا علامةَ اقتباسٍ مائلة في تعليقٍ داخل قالب: هي تُنهي
           القالب نفسه. أسقطتْ صفحاتِ التطبيق كلَّها لحظةَ كتابتها.
      -->
      ${raw(where.types.length ? section('لغتك بتحصل في أي مواقف', 'star', 0,
        where.types.map((row) => facetRow('typeId', row)).join('')) : '')}

      ${raw(where.people.length ? section('مع مين', 'person', 0,
        where.people.map((row) => facetRow('personId', row)).join('')) : '')}

      ${raw(where.places.length ? section('وفين', 'place', 0,
        where.places.map((row) => facetRow('placeName', row)).join('')) : '')}

      ${raw(!where.types.length && !where.people.length && !where.places.length
        ? section('لغتك بتحصل فين', 'place', 0, '',
          'لمّا تبقى عندك ذكريات بأنواع وأماكن وناس، هنا هيبان فين روسيّتك بتعيش.')
        : '')}

      ${raw(section('إيقاعك', 'clock', 0, rhythm.total ? html`
        <div class="lg-stages">
          <div class="lg-stage"><b>${rhythm.total}</b>
            <span>${plural(rhythm.total, 'ذكرى', 'ذكريتين', 'ذكريات')}</span></div>
          <div class="lg-stage"><b>${rhythm.days}</b>
            <span>${plural(rhythm.days, 'يوم', 'يومين', 'أيام')}</span></div>
          ${raw(rhythm.span ? html`
            <div class="lg-stage"><b>${rhythm.span}</b>
              <span>يوم بين أوّل وآخر واحدة</span></div>` : '')}
        </div>
        ${raw(rhythm.longestGap && rhythm.longestGap.days > 1 ? html`
          <p class="fc-empty">
            أطول فترة من غير تسجيل:
            ${counted(rhythm.longestGap.days, 'يوم', 'يومين', 'أيام')} —
            من ${formatDate(rhythm.longestGap.from)}
            لـ${formatDate(rhythm.longestGap.to)}.
          </p>` : '')}
        <p class="lg-note">
          ده بيقول <strong>إمتى كتبت</strong>، مش إمتى عشت. شهر من غير تسجيل
          ممكن يكون شهر سفر اتكلّمت فيه روسي كل يوم.
        </p>` : '',
        'أوّل ما تبقى عندك ذكريات بتواريخ، هنا هيبان إيقاعك.'))}

      ${raw(section('تمرّنت قدّ إيه', 'mic', 0, practice.repetitions ? html`
        <div class="lg-stages">
          <div class="lg-stage"><b>${practice.repetitions}</b><span>تكرار</span></div>
          <div class="lg-stage"><b>${practice.sessions}</b>
            <span>${plural(practice.sessions, 'جلسة', 'جلستين', 'جلسات')}</span></div>
          <div class="lg-stage"><b>${practice.days}</b>
            <span>${plural(practice.days, 'يوم', 'يومين', 'أيام')}</span></div>
        </div>
        <p class="lg-note">
          الأرقام دي معناها <strong>«اتمرّنت»</strong> وبس — مش «استخدمتها»
          ولا «أتقنتها». خمسين تكرار في الظلّ مش معناها إنك بتقولها لبني آدم.
        </p>` : '',
        'لمّا تشتغل في كتاب الظلّ، هنا هيبان اللي اتمرّنت عليه فعلًا.'))}
      </div>
    `)}

    <details class="fc-absent">
      <summary>ليه مفيش «تحسّنت ٪كذا»؟</summary>
      ${raw(Object.entries(data.notMeasured).map(([, reason]) =>
        html`<p>${reason}</p>`).join(''))}
    </details>`;
}

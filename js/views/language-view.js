/**
 * LingoLife — شاشة «لغتي» وصفحة التعبير
 *
 * كانت هذه الشاشة أربعة أرقامٍ صادقةٍ لا تُضغَط، وصندوقًا يقول «المرحلة
 * 2 قادمة». صارت أرقامًا **تفتح ما وراءها** (بند 66).
 *
 * ═══════════════════════════════════════════════════════════════
 * وقائعُ في جهة، وتقديرك في جهة
 * ═══════════════════════════════════════════════════════════════
 *
 * صفحة التعبير تعرض شيئين لا يختلطان:
 *
 *  · **أين ظهر ومتى** — من ظهوراته الحقيقيّة في ذكرياتك. لا تُقدَّر
 *    ولا تُخمَّن.
 *  · **في أي مرحلة هو** — بقولك أنت، ومكتوبٌ تحته أنه قولك. لأن
 *    الممارسة ليست إتقانًا، والظهور ليس استعمالًا — ومَن يعرف أنك
 *    «بقيت تقولها من غير ما تفكّر» هو أنت وحدك.
 */

import { html, raw, $ } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { navigate } from '../router.js';
import { formatDate, daysBetween, dayCount } from '../utils/dates.js';
import { counted } from '../utils/plural.js';

import { toast, toastOk, toastError } from '../components/toast.js';
import {
  STAGES, STAGE_LABEL, UNBUILT,
  languageOverview, expressionLife, setStage,
} from '../services/language-service.js';
import { expressionSourceLabel } from '../services/content-service.js';
/* اختيارُ ملفٍّ محلّيّ — نفسُ الباب الذي تستعمله بقيّة الشاشات. */
import { pickFiles } from '../services/media-service.js';

/* ------------------------------------------------------------------ *
 * لغتي
 * ------------------------------------------------------------------ */

function stageBar(byStage, total) {
  if (!total) return '';
  return html`
    <div class="lg-stages">
      ${raw(byStage.filter((s) => s.count).map((s) => html`
        <div class="lg-stage">
          <b>${s.count}</b>
          <span>${s.label}</span>
        </div>`).join(''))}
    </div>
    <p class="lg-note">
      المراحل دي <strong>بقولك إنت</strong> — التطبيق ما بيرفعش حد
      منها لوحده. الممارسة مش إتقان، والظهور مش استخدام.
    </p>`;
}

/*
 * ⚠️ العدد في الشارة **لا بدّ أن يوافق ما تحته**. كان السقف ثمانيةً
 *    والشارة تقول تسعة، فيُعرَض ثمانية بلا كلمة — رقمٌ يخالف قائمته
 *    ولا يقول لماذا، وهو أسوأ من رقمٍ أكبر.
 *
 *    فسقفٌ يسع الاستعمال العاديّ، وسطرٌ صريح إن جاوزَه شيء.
 */
const TOP_LIMIT = 60;

/**
 * لوحةُ ذاكرة اللغة (WS-C، بنود ٢٠…٢٢ و٤٩ و٦٥).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولا رقمَ زينةٍ ولا رقمَ يُخفي مصدرَه
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ عددٍ هنا يقول **من أيّ نوعٍ هو**: «موضع في نصوصك» واقعةٌ عن
 * النصّ، و«مرّة تدريب» واقعةٌ عنك، و«غلطة» واقعةٌ سجّلتَها بيدك.
 * وجمعُها في رقمٍ واحدٍ اسمُه «تكرار» هو ما يمنعه بند ٨.
 *
 * ⚠️ **والفارغُ يُشرَح ولا يُملأ ببياناتٍ وهميّة** (بند ٦٥): تثبيتٌ قديمٌ
 *    بلا وقائعَ يقرأ لماذا اللوحةُ صامتة، ولا يرى أرقامًا مخترَعةً
 *    لتبدو ممتلئة.
 */
/** أسماءٌ عربيّةٌ لأنواع المصادر — لا `script` في شاشةٍ عربيّة. */
const SOURCE_LABEL = Object.freeze({
  script: 'سكريبتات',
  draft: 'مسودّات',
  conversation: 'محادثات',
  external: 'نصّ مؤقّت',
});

function memoryBoard(memory) {
  const has = memory.index.positions > 0 || memory.saved.total > 0 || memory.errors.total > 0;

  if (!has) {
    return html`
      <section class="lg-section">
        <h3>${raw(icon('book', 17))} ذاكرة اللغة</h3>
        <p class="lg-note">
          الذاكرة بتكبر من نصوصك ومن اللي بتعمله: كلمة تحفظها، جملة
          تتدرّب عليها، غلطة تسجّلها. لسه مفيش حاجة مفهرَسة —
          ${memory.index.indexable
            ? `عندك ${memory.index.indexable} نصّ جاهز للفهرسة.`
            : 'ابدأ بإضافة نصّ أصلي.'}
        </p>
        <button class="btn btn-ghost" data-action="mem-rebuild">افهرس نصوصي دلوقتي</button>
      </section>`;
  }

  return html`
    <section class="lg-section">
      <h3>${raw(icon('book', 17))} ذاكرة اللغة</h3>

      <!--
        ⚠️ كلُّ عددٍ باسمه ونوعه — لا «تكرار» واحدٌ مبهم (بند ٨).
      -->
      <div class="mem-board">
        <div class="mem-stat">
          <b>${memory.index.forms}</b>
          <span>صيغة في نصوصك</span>
        </div>
        <div class="mem-stat">
          <b>${memory.index.positions}</b>
          <span>موضع مفهرَس</span>
        </div>
        <div class="mem-stat">
          <b>${memory.index.sources}</b>
          <span>مصدر</span>
        </div>
        <div class="mem-stat">
          <b>${memory.saved.total}</b>
          <span>محفوظة</span>
        </div>
        <div class="mem-stat">
          <b>${memory.practice.events}</b>
          <span>مرّة تدريب</span>
        </div>
        <div class="mem-stat${memory.errors.total ? ' is-err' : ''}">
          <b>${memory.errors.total}</b>
          <span>غلطة مسجَّلة</span>
        </div>
      </div>

      ${raw(memory.errors.recurring ? html`
        <p class="lg-note">
          فيه ${counted(memory.errors.recurring, 'نمط', 'نمطين', 'أنماط')} غلط
          اتكرّر أكتر من مرّة — التكرار ده جزء من تاريخك، مش حاجة تتمسح.
        </p>` : '')}

      ${raw(memory.recurring.length ? html`
        <h4 class="mem-h">بتتكرّر في أكتر من مصدر</h4>
        <div class="lg-words">
          ${raw(memory.recurring.map((one) => html`
            <button class="lg-word" data-action="open-word" data-text="${one.surface}"
                    dir="ltr" lang="ru">${one.surface}
              <span class="mem-dim">${one.sources}</span>
            </button>`).join(''))}
        </div>` : '')}

      <!--
        ⚠️ **ولا يُقال «قابلتَها ٧ مرّات»** (بند ٦٧): الفهرسُ يعرف أين
           الكلمةُ في نصوصك، ولا يعرف متى قرأتَها أنت.
      -->
      <!--
        ⚠️ **تفصيلٌ بالمصدر — ومواضعُ ومصادرُ عمودان لا واحد** (بند ٦٤).
           محادثةٌ فيها الكلمةُ ثلاثًا = ٣ مواضع في **مصدرٍ واحد**.
      -->
      ${raw(Object.keys(memory.index.byKind || {}).length ? html`
        <h4 class="mem-h">من فين</h4>
        <ul class="mem-kinds">
          ${raw(Object.entries(memory.index.byKind).map(([kind, one]) => html`
            <li>
              <b>${SOURCE_LABEL[kind] || kind}</b>
              <span class="mem-dim">${one.sources} مصدر · ${one.positions} موضع</span>
            </li>`).join(''))}
        </ul>` : '')}

      <p class="lg-note">
        «موضع» يعني الكلمة مكتوبة هناك في نصّك — مش يعني إنك قابلتها
        يومها. التواريخ بتيجي من وقائع حقيقية بس: حفظ · تدريب · غلطة.
      </p>

      <!--
        ⚠️ **بابان لا شاشتان** (بند ٥٨): التصدير والاستيراد فعلان على
           نفس الذاكرة، فمكانُهما معها لا في «إدارة» منفصلة.
      -->
      <!--
        ⚠️ **والبابُ الجديدُ أوّلًا، والقديمُ يبقى ولا يُزال** (WS-J).
           v2 يرسل نصوصَك كاملةً ويعرضها عليك قبل أن تغادر، و v1 يرسل
           إحصاءً بلا نصّ. وحذفُ v1 اليومَ يكسر ملفَّ إثراءٍ عائدًا من
           جولةٍ لم تُغلَق بعد — فيبقى بابًا ثانويًّا حتى يفرغ.
      -->
      <div class="mem-acts">
        <button class="btn" data-action="mem-review">راجع وصدّر ذاكرة اللغة</button>
        <button class="btn btn-ghost" data-action="mem-analysis-import">استورد نتيجة تحليل</button>
        <button class="btn btn-ghost" data-action="mem-rebuild">أعِد بناء الفهرس</button>
      </div>

      <details class="mem-old">
        <summary>الطريقة القديمة (إحصاء بلا نصّ)</summary>
        <p class="field-hint">
          دي بتبعت أعداد بس من غير نصوصك، فالتحليل بيجاوب من معرفته
          العامة مش من لغتك إنت. سيبها للملفّات اللي لسه شغّالة عليها.
        </p>
        <div class="mem-acts">
          <button class="btn btn-ghost" data-action="mem-export">تصدير للتحليل</button>
          <button class="btn btn-ghost" data-action="mem-import">استيراد تحليل</button>
        </div>
      </details>
    </section>`;
}

export async function renderLanguage(main) {
  const [data, memory] = await Promise.all([
    languageOverview({ limit: TOP_LIMIT }),
    import('../services/memory/memory-service.js').then((m) => m.memoryOverview({ limit: 10 }))
      .catch(() => null),
  ]);
  const hidden = data.expressions.total - data.expressions.top.length;
  const empty = !data.expressions.total && !data.words.total && !data.sentences.total
    && !(memory?.index.positions || memory?.saved.total || memory?.errors.total);

  main.innerHTML = html`
    <div class="view-head">
      <h1>لغتي</h1>
      <div class="sub">اللغة اللي اتكوّنت من مواقفك الحقيقية</div>
    </div>

    ${raw(empty ? html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('language'))}</div>
        <h2>عالم اللغة لسه فاضي</h2>
        <p>
          التعبيرات والكلمات بتتولد من الذكريات نفسها — مش بتتكتب في
          قوائم منفصلة. أضف تعبير من أي ذكرى وهتلاقيه هنا برحلته.
        </p>
        <button class="btn btn-ghost" data-action="go-river">افتح النهر</button>
      </div>` : html`
      <div class="fc-board">

      ${raw(memory ? memoryBoard(memory) : '')}

      <section class="lg-section">
        <h3>${raw(icon('star', 17))} التعبيرات
          <span class="fc-count">${data.expressions.total}</span></h3>
        ${raw(stageBar(data.expressions.byStage, data.expressions.total))}
        ${raw(data.expressions.top.map((row) => html`
          <button class="lg-row" data-action="open-expression" data-id="${row.id}">
            <span class="lg-ru" dir="ltr" lang="ru">${row.text}</span>
            ${raw(row.meaningAr ? html`<span class="lg-ar">${row.meaningAr}</span>` : '')}
            <span class="lg-meta">
              <span class="rv-tag is-plain">${STAGE_LABEL[row.stage]}</span>
              ${raw(row.seen
                ? html`<span class="fc-count">${counted(row.seen, 'ظهور', 'ظهوران', 'ظهورات')}</span>`
                : '')}
            </span>
          </button>`).join(''))}
        ${raw(hidden > 0 ? html`
          <p class="lg-note">
            دي أكتر ${TOP_LIMIT} تعبير ظهورًا. فاضل
            ${counted(hidden, 'تعبير', 'تعبيرين', 'تعبيرات')} — تلاقيهم
            في ذكرياتهم أو من البحث.
          </p>` : '')}
      </section>

      ${raw(data.words.total ? html`
        <section class="lg-section">
          <h3>${raw(icon('book', 17))} كلمات التقطتها
            <span class="fc-count">${data.words.total}</span></h3>
          <div class="lg-words">
            ${raw(data.words.top.map((row) => html`
              <button class="lg-word" data-action="open-word" data-text="${row.text}"
                      dir="ltr" lang="ru">${row.text}</button>`).join(''))}
          </div>
        </section>` : '')}

      ${raw(data.sentences.total ? html`
        <section class="lg-section">
          <h3>${raw(icon('script', 17))} جُمل محفوظة
            <span class="fc-count">${data.sentences.total}</span></h3>
          <p class="lg-note">
            بتتحفظ من كتاب الظلّ بتصنيفٍ بيقول ليه التقطتها.
          </p>
        </section>` : '')}
      </div>
    `)}

    <details class="fc-absent">
      <summary>ليه مفيش «أنماط جُمل» ولا قاموس كلمات كامل؟</summary>
      ${raw(Object.entries(UNBUILT).map(([, reason]) => html`<p>${reason}</p>`).join(''))}
      <p class="fc-note">
        الرقم في المستودعين دلوقتي:
        <bdi>words = ${data.unbuilt.words}</bdi> ·
        <bdi>sentencePatterns = ${data.unbuilt.sentencePatterns}</bdi>.
        مستودعٌ فاضي بيفضل فاضي لحد ما يبقى فيه حاجة تكتب فيه.
      </p>
    </details>`;
}

/* ------------------------------------------------------------------ *
 * صفحة التعبير
 * ------------------------------------------------------------------ */

export async function renderExpression(main, expressionId) {
  const life = await expressionLife(expressionId);

  if (!life) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>التعبير ده مش موجود</h2>
        <button class="btn btn-ghost" data-action="go-language">افتح لغتي</button>
      </div>`;
    return;
  }

  const { expression, occurrences, firstSeen, lastSeen, sceneCount, captureTags } = life;
  const span = firstSeen && lastSeen && firstSeen !== lastSeen
    ? daysBetween(firstSeen, lastSeen)
    : 0;

  main.innerHTML = html`

    <div class="view-head">
      <h1 class="lg-title" dir="ltr" lang="ru">${expression.text}</h1>
      ${raw(expression.meaningAr ? html`<div class="sub">${expression.meaningAr}</div>` : '')}
    </div>

    ${raw(expression.explanation ? html`
      <div class="card"><p style="margin:0">${expression.explanation}</p></div>` : '')}

    <div class="card rv-day-stats">
      ${raw(occurrences.length ? html`
        <div class="rv-stat"><b>${occurrences.length}</b>
          <span>${occurrences.length === 1 ? 'ظهور' : occurrences.length === 2 ? 'ظهوران' : 'ظهورات'}</span>
        </div>` : '')}
      ${raw(sceneCount ? html`
        <div class="rv-stat"><b>${sceneCount}</b>
          <span>${sceneCount === 1 ? 'ذكرى' : sceneCount === 2 ? 'ذكريتان' : 'ذكريات'}</span>
        </div>` : '')}
      ${raw(span ? html`
        <div class="rv-stat"><b>${span}</b><span>يوم بين أوّل وآخر مرّة</span></div>` : '')}
    </div>

    <!--
      الوقائع: أين ظهر ومتى. لا تقدير هنا — كل سطرٍ ذكرى تفتحها
      وتتأكّد بنفسك.
    -->
    <section class="lg-section">
      <h3>${raw(icon('clock', 17))} فين قابلته</h3>
      ${raw(occurrences.length ? occurrences.map((row, i) => {
        const gap = i > 0 ? daysBetween(occurrences[i - 1].date, row.date) : 0;
        return html`
          ${raw(gap > 1 ? html`<div class="rv-gap"><span>${dayCount(gap)}</span></div>` : '')}
          <button class="rv-scene" data-action="open-scene" data-id="${row.sceneId}">
            <span class="rv-scene-title"><bdi>${row.title}</bdi></span>
            <span class="rv-scene-meta">
              <span class="rv-tag is-plain">${formatDate(row.date)}</span>
              <span class="rv-tag is-plain">${expressionSourceLabel(row.source)}</span>
              ${raw(row.quote ? html`<span class="rv-tag is-plain" dir="ltr" lang="ru">${row.quote}</span>` : '')}
            </span>
          </button>`;
      }).join('') : html`
        <p class="lg-note">
          لسه ما ظهرش في ذكرى — أضفه لذكرى وهيبان هنا بتاريخه.
        </p>`)}
    </section>

    <!--
      وتقديرك أنت — منفصلٌ عن الوقائع بقصد، ومكتوبٌ أنه قولك.
    -->
    <section class="lg-section">
      <h3>${raw(icon('check', 17))} إنت فين معاه؟</h3>
      <div class="lg-stage-pick">
        ${raw(STAGES.map((stage) => html`
          <button class="lg-stage-btn${life.stage === stage.id ? ' is-on' : ''}"
                  data-action="set-stage" data-id="${expression.id}" data-stage="${stage.id}">
            <b>${stage.label}</b>
            <span>${stage.hint}</span>
          </button>`).join(''))}
      </div>
      <p class="lg-note">
        ده <strong>قولك إنت</strong>، مش حساب التطبيق. الظهور مش
        استخدام، والتكرار في الظلّ مش إتقان — إنت اللي عارف.
      </p>
    </section>

    ${raw(captureTags.length ? html`
      <section class="lg-section">
        <h3>${raw(icon('star', 17))} التقطته لأنه</h3>
        <div class="rv-people">
          ${raw(captureTags.map((tag) => html`<span class="rv-tag">${tag}</span>`).join(''))}
        </div>
      </section>` : '')}`;
}

/* ------------------------------------------------------------------ *
 * صفحة الكلمة
 * ------------------------------------------------------------------ */

export async function renderWord(main, text) {
  const { wordLife } = await import('../services/language-service.js');
  const life = await wordLife(text);

  if (!life) {
    main.innerHTML = html`
      <div class="empty-state"><h2>كلمة فاضية</h2></div>`;
    return;
  }

  main.innerHTML = html`

    <div class="view-head">
      <h1 class="lg-title" dir="ltr" lang="ru">${life.text}</h1>
      <div class="sub">فين قابلت الكلمة دي</div>
    </div>

    <div class="card rv-day-stats">
      ${raw(life.captured ? html`
        <div class="rv-stat"><b>${life.captured}</b><span>مرّة التقطتها</span></div>` : '')}
      ${raw(life.inConversation ? html`
        <div class="rv-stat"><b>${life.inConversation}</b><span>في المحادثة</span></div>` : '')}
      ${raw(life.inScripts ? html`
        <div class="rv-stat"><b>${life.inScripts}</b><span>في السكريبتات</span></div>` : '')}
    </div>

    ${raw(life.captureTags.length ? html`
      <section class="lg-section">
        <h3>التقطتها لأنها</h3>
        <div class="rv-people">
          ${raw(life.captureTags.map((tag) => html`<span class="rv-tag">${tag}</span>`).join(''))}
        </div>
      </section>` : '')}

    ${raw(life.expressions.length ? html`
      <section class="lg-section">
        <h3>${raw(icon('star', 17))} في تعبيرات</h3>
        ${raw(life.expressions.map((row) => html`
          <button class="lg-row" data-action="open-expression" data-id="${row.id}">
            <span class="lg-ru" dir="ltr" lang="ru">${row.text}</span>
            ${raw(row.meaningAr ? html`<span class="lg-ar">${row.meaningAr}</span>` : '')}
          </button>`).join(''))}
      </section>` : '')}

    ${raw(life.scenes.length ? html`
      <section class="lg-section">
        <h3>${raw(icon('clock', 17))} في ذكريات</h3>
        ${raw(life.scenes.map((row) => html`
          <button class="rv-scene" data-action="open-scene" data-id="${row.id}">
            <span class="rv-scene-title"><bdi>${row.title}</bdi></span>
            <span class="rv-scene-meta">
              <span class="rv-tag is-plain">${formatDate(row.date)}</span>
            </span>
          </button>`).join(''))}
      </section>` : '')}

    <p class="lg-note">
      ⚠️ البحث ده <strong>نصّي مش صرفي</strong>: «идти» مش هتلاقي
      «шёл». محتاج محلّل صرفي روسي، ومفيش واحد في التطبيق.
    </p>`;
}

/* ------------------------------------------------------------------ *
 * الأفعال
 * ------------------------------------------------------------------ */

export async function handleLanguageAction(action, target) {
  if (action === 'go-language') {
    navigate('/language');
    return true;
  }

  if (action === 'open-expression') {
    navigate(`/expression/${target?.dataset.id}`);
    return true;
  }

  if (action === 'open-word') {
    navigate(`/word/${encodeURIComponent(target?.dataset.text || '')}`);
    return true;
  }

  /*
   * ⚠️ **إعادةُ بناء الفهرس لا تمسّ تاريخَك** (بندا ٥٦ و٧١).
   *
   *    الفهرسُ مشتقٌّ من `scripts` و`studyDrafts`، فإعادةُ بنائه تقرأ
   *    منهما وتكتب في `memoryOccurrences` وحدَه. والمحفوظاتُ والتدريبُ
   *    والغلطاتُ لا تُقرَأ هنا أصلًا — يحرسه اختبارٌ نصّيّ.
   */
  if (action === 'mem-rebuild') {
    try {
      const { rebuildIndex, indexStats } = await import('../services/memory/indexer.js');
      const { sources } = await rebuildIndex();
      const stats = await indexStats();
      toastOk(`اتفهرس ${sources} مصدر · ${stats.forms} صيغة في ${stats.positions} موضع`);
      const main = $('#app-main');
      if (main) await renderLanguage(main);
    } catch (error) {
      toastError(error.message);
    }
    return true;
  }

  /*
   * ذاكرةُ اللغة v2 — **ولا شبكةَ هنا أيضًا** (بندا ٦٠ و٦١): الحزمةُ
   * تُبنى وتُنسَخ بيدك، والنتيجةُ تعود بيدك.
   *
   * ⚠️ **والشاشةُ تُعاد رسمُها بعد الاستيراد** لأن الأعدادَ المعروضة
   *    فوقها اشتُقّت قبله؛ وتركُها يجعل استيرادًا نجح يبدو أنه لم يقع.
   */
  if (action === 'mem-review') {
    try {
      const { openMemoryReview } = await import('../modals/memory-review.js');
      await openMemoryReview();
      const main = $('#app-main');
      if (main) await renderLanguage(main);
    } catch (error) {
      toastError(error.message);
    }
    return true;
  }

  if (action === 'mem-analysis-import') {
    try {
      const { openAnalysisImport } = await import('../modals/memory-import.js');
      await openAnalysisImport();
      const main = $('#app-main');
      if (main) await renderLanguage(main);
    } catch (error) {
      toastError(error.message);
    }
    return true;
  }

  /* التصدير — بابٌ يفتح نافذةً، ولا شبكةَ فيه (بندا ٦٠ و٦١). */
  if (action === 'mem-export') {
    const { openMemoryExport } = await import('../modals/memory-exchange.js');
    await openMemoryExport();
    return true;
  }

  /*
   * ⚠️ **الاستيرادُ أربعُ خطواتٍ لا واحدة** (بند ١١):
   *    اختر ← حلِّل ← راجِع ← وافق. ولا كتابةَ قبل الرابعة.
   *
   * ⚠️ **والإلغاءُ لا يمرّ على سطرِ كتابةٍ واحد** (بند ٤٢):
   *    `openEnrichmentReview` ترجع `null`، والدالّةُ تخرج قبل
   *    `applyEnrichment` — لا «تراجُعٌ» بعد كتابة.
   */
  if (action === 'mem-import') {
    try {
      const [files, exchange, memory] = await Promise.all([
        pickFiles({ accept: 'application/json,.json', multiple: false }),
        import('../modals/memory-exchange.js'),
        import('../services/memory/memory-service.js'),
      ]);
      const [file] = files;
      if (!file) return true;

      const text = await exchange.readEnrichmentFile(file);
      const known = await memory.knownCanonicals();
      const parsed = exchange.parseEnrichment(text, { knownCanonicals: known });
      if (!parsed.ok) {
        toastError(parsed.error);
        return true;
      }

      const { planEnrichment, applyEnrichment } = await import('../services/memory/exchange.js');
      const plan = await planEnrichment(parsed, { readCurrent: memory.readEnrichment });

      const decision = await exchange.openEnrichmentReview({ parsed, plan });
      if (!decision?.ok) {
        toast('اتلغى — مااتكتبش حاجة');
        return true;
      }

      const result = await applyEnrichment(plan, { writeEnrichment: memory.writeEnrichment });
      toastOk(result.written
        ? `اتسجّل ${result.written} إثراء · ${result.skipped} تعارض اتساب زي ما هو`
        : 'مفيش جديد — الملفّ ده اتسجّل قبل كده');
      const main = $('#app-main');
      if (main) await renderLanguage(main);
    } catch (error) {
      toastError(error.message);
    }
    return true;
  }

  if (action === 'set-stage') {
    try {
      await setStage(target.dataset.id, target.dataset.stage);
      toastOk(`اتسجّلت: ${STAGE_LABEL[target.dataset.stage]}`);
      const main = $('#app-main');
      if (main) await renderExpression(main, target.dataset.id);
    } catch (error) {
      toastError(error.message);
    }
    return true;
  }

  return false;
}

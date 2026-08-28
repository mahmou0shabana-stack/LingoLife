/**
 * LingoLife — تاريخُ اللغة من داخل التدريب (WS-J · بند ٢٣)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لوحةٌ خفيفةٌ لا مغادرةٌ للتدريب**
 * ═══════════════════════════════════════════════════════════════
 *
 * أنت في منتصف جلسة: الصوتُ مضبوطٌ والسرعةُ والتكرارُ والمقطعُ محدَّد.
 * فسؤالُ «الكلمة دي شفتها قبل كده فين؟» يجب أن يُجاب **بلا أن يضيع
 * كلُّ ذلك**. ومغادرةُ الشاشة إلى «لغتي» تعني العودةَ لضبط كلّ شيءٍ من
 * جديد — فيصير الجوابُ أغلى من السؤال، فلا يُسأل.
 *
 * ولذلك: نافذةٌ فوق الجلسة، تقرأ **الفهرسَ المحفوظ** ولا تبني شيئًا،
 * وتُغلَق فتعود إلى نفس المقطع بنفس الإعدادات.
 *
 * ⚠️ **وإن لم يكن الفهرسُ مبنيًّا لا نبنيه هنا.** بناؤه على قاعدةٍ
 *    ناضجةٍ ليس لحظيًّا، وتعليقُ جلسةِ تدريبٍ ثانيتين لسؤالٍ جانبيٍّ
 *    مقايضةٌ خاسرة. فنقول بصراحةٍ إنه غيرُ جاهزٍ ونعرض البابَ إلى
 *    «لغتي» لمن أراد.
 *
 * ⚠️ **ولا يُكتَب شيءٌ من هنا.** فتحُ تاريخِ كلمةٍ ليس واقعةً في حياتك
 *    اللغويّة، وتسجيلُه «اطّلاع» يخلق تاريخًا لم يحدث — وهو بالضبط ما
 *    يمنعه البندُ ١ (التحليلُ لا يعيد كتابة ما حدث).
 */

import { html, raw } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { navigate } from '../router.js';
import { normalize } from '../utils/normalization.js';
import { cachedLanguage } from '../services/memory/language-cache.js';
import {
  evidenceOf, relationsOf, PROVENANCE_LABEL, ITEM_TYPE_LABEL,
} from '../services/memory/my-language.js';
import { toastOk, toastError } from '../components/toast.js';

/**
 * يفتح تاريخَ نصٍّ (كلمة · مقطع · جملة) فوق شاشة التدريب.
 *
 * @param {string} text النصُّ كما هو على الشاشة
 * @param {'word'|'phrase'|'sentence'} kind
 */
export async function openLanguageHistory(text, kind = 'word') {
  const clean = (text || '').trim();
  if (!clean) return null;

  const index = cachedLanguage();
  if (!index) return notReady(clean);

  /*
   * ⚠️ **والحلُّ بصيغةٍ أقرّها التحليلُ لا بتجذيرٍ نخترعه.** راجع
   *    ترويسة `my-language.js`: لا محلّلَ صرفيًّا في التطبيق.
   */
  const key = index.formIndex.get(normalize(clean));
  const one = key ? index.byKey.get(key) : null;
  if (!one) return unknownYet(clean, kind);

  const evidence = await evidenceOf(one.key);
  const rel = relationsOf(index, one.key);

  return showModal({
    title: 'تاريخها في لغتي',
    wide: true,
    /*
     * ⚠️ **و«ارجع للتدريب» هو الزرُّ الأساسيّ** (بند ٣٦): اللوحةُ
     *    ضيفٌ على الجلسة، والخروجُ منها إلى الجلسة لا إلى شاشةٍ أخرى.
     *    و«احفظها» فعلٌ سريعٌ بلا نموذجٍ يقطع التدريب (بند ١٧).
     */
    actions: [
      { label: 'افتح القصة كاملة', value: 'open', variant: 'ghost' },
      { label: 'احفظها', value: 'save', variant: 'ghost' },
      { label: 'ارجع للتدريب', value: null, variant: 'primary' },
    ],
    body: html`
      <div class="lh">
        <div class="lh-head">
          <b dir="ltr" lang="ru">${one.lemma || clean}</b>
          <span class="ml-tag">${ITEM_TYPE_LABEL[one.itemType] || one.itemType}</span>
          ${raw(one.pos ? html`<span class="ml-tag">${one.pos}</span>` : '')}
          <span class="mr-tag is-${one.provenance}">${PROVENANCE_LABEL[one.provenance]}</span>
        </div>

        ${raw(one.meaningAr ? html`<p class="ml-mean-big">${one.meaningAr}</p>` : '')}

        <!-- ⚠️ الأرقامُ مفصولةٌ هنا كما في كلّ شاشةٍ أخرى (بند ٢). -->
        <div class="mr-sum mr-sum-pick">
          <span>مواقف حقيقية: <b>${one.realSituations}</b></span>
          <span>في مولَّد: <b>${one.derivedAppearances}</b></span>
          <span>حفظتها: <b>${one.saved}</b></span>
          <span>اتدرّبت: <b>${one.practised}</b></span>
        </div>

        ${raw(evidence.primary.length ? html`
          <h5>آخر مواقف حقيقية</h5>
          <ul class="ml-cites">
            ${raw(evidence.primary.slice(0, 3).map((row) => html`
              <li class="ml-cite">
                <span class="ml-cite-head"><b>${row.title}</b></span>
                <q dir="ltr" lang="ru">${row.quote}</q>
              </li>`).join(''))}
          </ul>`
    : '<p class="lh-empty">لسه مفيش دليل من نصّ أصلي.</p>')}

        ${raw(evidence.derived.length ? html`
          <p class="lh-empty">
            وكمان ${evidence.derived.length} ظهور في محتوى مولَّد —
            مش محسوب في المواقف الحقيقية.
          </p>` : '')}

        <!-- ══ صيغٌ وعائلةٌ — مختصرًا، والتفصيلُ في «لغتي» (بند ٣٥) ══ -->
        ${raw(rel.forms.observed.length ? html`
        <p class="lh-empty">
          صيغ شفتها:
          ${raw(rel.forms.observed.slice(0, 6).map((f) => html`
            <span class="ml-tag" dir="ltr" lang="ru">${f}</span>`).join(' '))}
        </p>` : '')}
        ${raw(rel.family.length ? html`
        <p class="lh-empty">
          من نفس العائلة:
          ${raw(rel.family.slice(0, 5).map((o) => html`
            <span class="ml-tag" dir="ltr" lang="ru">${o.lemma}</span>`).join(' '))}
        </p>` : '')}
        ${raw(one.verifyStatus === 'review' ? html`
        <p class="lh-empty mr-warn">
          عدّ التحليل مختلف عن عدّ التطبيق — محتاج مراجعة في «لغتي».
        </p>` : '')}
      </div>`,
    onSubmit(_data, close) { close(); },
  }).then(async (value) => {
    if (value === 'save') {
      /*
       * ⚠️ **ويُحفَظ النصُّ كما حدّدتَه بالضبط** (بند ٣٧): لا مفردةُ
       *    التحليل ولا صيغتُه الأساسيّة. «был связан с» تبقى كما هي،
       *    والربطُ بالعنصر يقع في القراءة لا بتغيير ما حفظتَه.
       */
      try {
        const { saveItem, SAVED_KIND } = await import('../services/saved-service.js');
        await saveItem({
          text: clean,
          kind: kind === 'phrase' ? SAVED_KIND.PHRASE
            : (kind === 'sentence' ? SAVED_KIND.SENTENCE : SAVED_KIND.WORD),
        });
        toastOk('اتحفظت');
      } catch (error) { toastError(error.message); }
      return value;
    }
    /*
     * ⚠️ **والانتقالُ بعد الإغلاق لا قبله.** التنقّلُ ونافذةٌ مفتوحةٌ
     *    يترك طبقةً معلَّقةً فوق الشاشة الجديدة — وهو عطبٌ أُصلح مرّةً
     *    في `closeOverlayOf`، ولا يُعاد بابُه من هنا.
     */
    if (value === 'open') navigate(`/my-language/${encodeURIComponent(one.key)}`);
    return value;
  });
}

/** الفهرسُ لم يُبنَ بعدُ — نقولها ولا نبنيه في منتصف جلسة. */
function notReady(text) {
  return showModal({
    title: 'تاريخها في لغتي',
    actions: [
      { label: 'افتح «لغتي»', value: 'open', variant: 'ghost' },
      { label: 'ارجع للتدريب', value: null, variant: 'primary' },
    ],
    body: html`
      <div class="lh">
        <p class="lh-empty">
          «لغتي» لسه ما اتجمّعتش في الجلسة دي. افتحها مرة واحدة
          وهتلاقي التاريخ متاح هنا على طول من غير انتظار.
        </p>
        <p class="field-hint" dir="ltr" lang="ru">${text}</p>
      </div>`,
  }).then((value) => {
    if (value === 'open') navigate('/my-language');
    return value;
  });
}

/** نصٌّ لا يعرفه التحليلُ بعد — وهذا خبرٌ لا خطأ. */
function unknownYet(text, kind) {
  return showModal({
    title: 'تاريخها في لغتي',
    actions: [{ label: 'تمام', value: null, variant: 'primary' }],
    body: html`
      <div class="lh">
        <p class="field-hint" dir="ltr" lang="ru">${text}</p>
        <p class="lh-empty">
          لسه مالهاش تاريخ في «لغتي». يعني التحليل ما ذكرش الصيغة دي
          لأي مفردة لحد دلوقتي.
          ${raw(kind === 'word'
    ? 'تقدر تحفظها من «احفظها» وهتظهر في لغتي كإشارة منك.'
    : 'تقدر تحفظها وهتظهر في لغتي كإشارة منك.')}
        </p>
        <!--
          ⚠️ **ولا نقول «كلمة جديدة».** غيابُها عن التحليل لا يعني أنها
             جديدةٌ عليك: قد تكون في عشرة نصوصٍ لم تُحلَّل بعد. والفرقُ
             بين «لا نعرف» و«لا وجود» هو نفسُ الفرق الذي يقوم عليه
             هذا العمل كلُّه.
        -->
        <p class="field-hint">
          ده مش معناه إنها ما ظهرتش في نصوصك — معناه إن التحليل
          لسه ما وصلهاش.
        </p>
      </div>`,
  });
}

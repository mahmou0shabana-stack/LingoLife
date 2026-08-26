/**
 * LingoLife — تصديرُ ذاكرة اللغة ومراجعةُ الإثراء (WS-C2، بنود ٨…١٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ محرّكُ الاستيراد **لم يُكتَب هنا** — كُتب في WS-C ومُختبَر
 * ═══════════════════════════════════════════════════════════════
 *
 * `parseEnrichment` و`planEnrichment` و`applyEnrichment` موجودةٌ منذ
 * WS-C ولها ثمانيةُ اختبارات. وبند ٨ صريح: «ابنِ الواجهةَ حول الخدمات
 * القائمة، ولا تُعِد كتابة المحرّك».
 *
 * فهذا الملفُّ **بابٌ لا منطق**: يختار ملفًّا، ويعرض ما ستفعله الخطّة،
 * وينتظر ضغطتَك. وكلُّ قرارٍ عمّا يُقبَل ويُرفَض يقع هناك.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولا كتابةَ قبل الموافقة — وهذا يُختبَر لا يُوعَد به
 * ═══════════════════════════════════════════════════════════════
 *
 * `openEnrichmentReview` **لا تكتب شيئًا**: ترجع خطّةً وقرارًا. والكتابةُ
 * في `applyEnrichment` التي يناديها المستدعي بعد `ok === true`. فإلغاءُ
 * النافذة لا يمرّ على سطرِ كتابةٍ واحد (بند ٤٢).
 */

import { html, raw } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toastError } from '../components/toast.js';
import {
  FORMAT, FORMAT_VERSION, ENRICHMENT_FIELDS, FORBIDDEN_FIELDS,
  buildMemoryExport, parseEnrichment, planEnrichment, analysisPrompt,
} from '../services/memory/exchange.js';

/* ------------------------------------------------------------------ *
 * التصدير
 * ------------------------------------------------------------------ */

/**
 * أنواعُ التصدير (بند ٩).
 *
 * ⚠️ **و«التزايُديّ» يقول حدَّه بصراحة**: البندُ يمنع تزييفَه. التطبيقُ
 *    لا يسجّل «أيُّ نصٍّ حُلِّل خارجًا من قبل» — تلك واقعةٌ تقع في
 *    ChatGPT لا هنا. فالمتاحُ الصادق: تصديرٌ بلا أمثلةِ المصادر
 *    (أصغرُ وأسرعُ في اللصق)، ويُقال إنه ليس تتبّعًا لما حُلِّل.
 */
export const EXPORT_KIND = Object.freeze({
  FULL: 'full',
  COMPACT: 'compact',
});

/** يبني الوثيقةَ ويعيدها نصًّا جاهزًا للحفظ أو النسخ. */
export async function buildExportText(kind = EXPORT_KIND.FULL) {
  const doc = await buildMemoryExport({
    limit: kind === EXPORT_KIND.FULL ? 800 : 200,
    includeSources: kind === EXPORT_KIND.FULL,
  });
  return JSON.stringify(doc, null, 2);
}

/**
 * نافذةُ التصدير — تنزيلٌ أو نسخٌ، ومعها القالبُ الذي تُعطيه للتحليل.
 *
 * ⚠️ **ولا شبكةَ ولا نداءَ ذكاء** (بندا ٦٠ و٦١): الملفُّ يخرج من يدك
 *    ويعود بيدك. التطبيقُ لا يعرف ChatGPT ولا يكلّمه.
 */
export async function openMemoryExport() {
  let kind = EXPORT_KIND.FULL;

  return showModal({
    title: 'تصدير للتحليل',
    wide: true,
    submitLabel: 'اقفل',
    body: html`
      <div class="mx-export">
        <p class="mx-note">
          الملفّ ده بتاخده لـChatGPT (أو أي تحليل خارجي) وبيرجع بإضافات
          وصفية بس. <b>التطبيق نفسه مش بيكلّم أي ذكاء اصطناعي.</b>
        </p>

        <div class="mx-kinds" data-mx-kinds>
          <button type="button" class="on" data-mx-kind="${EXPORT_KIND.FULL}">
            تحليل كامل
            <span>كل الكيانات + أمثلة من مصادرك</span>
          </button>
          <button type="button" data-mx-kind="${EXPORT_KIND.COMPACT}">
            مختصر
            <span>الكيانات والأعداد بس — ملفّ أصغر</span>
          </button>
        </div>

        <!--
          ⚠️ **الحدُّ يُقال ولا يُزيَّف** (بند ٩): «تزايُديّ» حقيقيّ يحتاج
             أن يعرف التطبيقُ ما حُلِّل خارجًا — وهو لا يعرف. فالمختصرُ
             ملفٌّ أصغر، لا تتبّعٌ لما سبق تحليله.
        -->
        <p class="mx-warn">
          مفيش «تحليل تزايدي» حقيقي دلوقتي: التطبيق مش بيسجّل إيه اللي
          اتحلّل برّه قبل كده. «مختصر» يعني ملفّ أصغر بس.
        </p>

        <div class="mx-acts">
          <button type="button" class="btn btn-ghost" data-mx="download">نزّل الملفّ</button>
          <button type="button" class="btn btn-ghost" data-mx="copy">انسخ الملفّ</button>
          <button type="button" class="btn btn-ghost" data-mx="prompt">انسخ تعليمات التحليل</button>
        </div>

        <details class="mx-details">
          <summary>تعليمات التحليل (اللي هتديها للـAI)</summary>
          <pre class="mx-pre">${analysisPrompt()}</pre>
        </details>

        <p class="mx-meta">
          الصيغة: <code>${FORMAT}</code> · الإصدار ${FORMAT_VERSION} ·
          حقول الإثراء المسموحة: ${ENRICHMENT_FIELDS.join(' · ')}
        </p>
      </div>`,
    onMount(root) {
      root.querySelector('[data-mx-kinds]')?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-mx-kind]');
        if (!btn) return;
        kind = btn.dataset.mxKind;
        root.querySelectorAll('[data-mx-kind]').forEach((n) => n.classList.toggle('on', n === btn));
      });

      root.addEventListener('click', async (event) => {
        const act = event.target.closest('[data-mx]')?.dataset.mx;
        if (!act) return;

        try {
          if (act === 'prompt') {
            await navigator.clipboard.writeText(analysisPrompt());
            return;
          }
          const text = await buildExportText(kind);
          if (act === 'copy') {
            await navigator.clipboard.writeText(text);
            return;
          }
          /* تنزيلٌ محلّيٌّ خالص — `blob:` لا شبكة. */
          const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = `living-memory-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch (error) {
          toastError(error.message);
        }
      });
    },
    onSubmit(_data, close) { close(); },
  });
}

/* ------------------------------------------------------------------ *
 * المراجعة
 * ------------------------------------------------------------------ */

/** أسماءٌ عربيّةٌ لحقول الإثراء — لا مصطلحاتِ قاعدةٍ في شاشةٍ عربيّة. */
const FIELD_LABEL = Object.freeze({
  register: 'مستوى اللغة',
  domain: 'المجال',
  usageNote: 'ملاحظة استعمال',
  explanation: 'شرح',
  relatedForms: 'صيغ قريبة',
  confidenceNote: 'درجة اليقين',
});

const fieldLine = (one) => Object.entries(one)
  .filter(([k]) => k !== 'canonical' && k !== 'patternKey' && k !== 'diffs')
  .map(([k, v]) => `${FIELD_LABEL[k] || k}: ${v}`)
  .join(' · ');

/**
 * يعرض ما ستفعله الخطّة **قبل** أن تُنفَّذ (بنود ١١…١٤).
 *
 * ⚠️ **ولا JSON خامٌّ كتجربةٍ أولى** (بند ١٢): الخامُّ تحت `details`
 *    لمن أراد، والأصلُ بطاقاتٌ تُقرَأ.
 *
 * @returns {Promise<{ok: boolean, plan: object}|null>} `null` = ألغيت
 */
export async function openEnrichmentReview({ parsed, plan }) {
  let approved = false;

  await showModal({
    title: 'راجع التحليل قبل ما يتسجّل',
    wide: true,
    submitLabel: 'وافق وسجّل',
    body: html`
      <div class="mx-review">
        <p class="mx-sum">
          <b>${plan.added.length}</b> إضافة ·
          <b>${plan.changed.length}</b> تعديل ·
          <b class="is-warn">${plan.conflicts.length}</b> تعارض ·
          <b class="is-bad">${parsed.dropped.length}</b> حقل مرفوض ·
          <b>${parsed.unknown.length}</b> كيان مجهول
        </p>

        ${raw(!plan.added.length && !plan.changed.length && !plan.conflicts.length ? html`
          <p class="mx-empty">
            مفيش جديد — الملفّ ده اتسجّل قبل كده أو مفيهوش حاجة تتضاف.
          </p>` : '')}

        ${raw(plan.added.length ? html`
          <h4 class="mx-h">هيتضاف</h4>
          <ul class="mx-list">
            ${raw(plan.added.map((one) => html`
              <li>
                <b dir="ltr" lang="ru">${one.canonical}</b>
                <span class="mx-dim">${fieldLine(one)}</span>
              </li>`).join(''))}
          </ul>` : '')}

        ${raw(plan.changed.length ? html`
          <h4 class="mx-h">هيتعدّل</h4>
          <ul class="mx-list">
            ${raw(plan.changed.map((one) => html`
              <li>
                <b dir="ltr" lang="ru">${one.canonical}</b>
                <span class="mx-dim">${fieldLine(one)}</span>
              </li>`).join(''))}
          </ul>` : '')}

        <!--
          ⚠️ **والتعارضُ يُعرَض ولا يُطبَّق** (بندا ١٣ و١٤): اللي كتبته
             بإيدك بيكسب افتراضيًّا، واقتراحُ التحليل يُعرَض بجانبه
             لتقرأه — لا ليدهسه.
        -->
        ${raw(plan.conflicts.length ? html`
          <h4 class="mx-h is-warn">تعارض مع حاجة إنت كتبتها — اللي بتاعك اتساب</h4>
          <ul class="mx-list mx-conflicts">
            ${raw(plan.conflicts.map((one) => html`
              <li>
                <b dir="ltr" lang="ru">${one.canonical}</b>
                <span class="mx-dim">اقتراح التحليل: ${fieldLine(one)}</span>
                <span class="mx-keep">اللي عندك اتساب زي ما هو</span>
              </li>`).join(''))}
          </ul>` : '')}

        <!--
          ⚠️ **والمرفوضُ يُعرَض لا يُسقَط بصمت** (بند ١٣): لو حاول
             التحليلُ يكتب تاريخًا أو عدّادَ تدريب، لازم تشوف إنه حاول.
        -->
        ${raw(parsed.dropped.length ? html`
          <h4 class="mx-h is-bad">حقول اترفضت — التحليل مش بيملك تاريخك</h4>
          <ul class="mx-list mx-dropped">
            ${raw(parsed.dropped.map((f) => html`
              <li>
                <b>${f}</b>
                <span class="mx-dim">
                  ${FORBIDDEN_FIELDS.includes(f)
                    ? 'ده واقعة من وقائعك — بتتسجّل من التطبيق بس'
                    : 'حقل مش معروف في صيغة الإثراء'}
                </span>
              </li>`).join(''))}
          </ul>` : '')}

        ${raw(parsed.unknown.length ? html`
          <h4 class="mx-h">كيانات مش موجودة عندك</h4>
          <p class="mx-dim" dir="ltr" lang="ru">${parsed.unknown.join(' · ')}</p>
          <p class="mx-note">
            مااتعملتش — الإثراء بيوصف حاجة موجودة، مش بيخترع كلمات.
          </p>` : '')}

        <details class="mx-details">
          <summary>الملفّ الخام</summary>
          <pre class="mx-pre" dir="ltr">${JSON.stringify({ parsed, plan }, null, 2).slice(0, 6000)}</pre>
        </details>
      </div>`,
    onSubmit(_data, close) {
      approved = true;
      close();
    },
  });

  /* ⚠️ الإلغاءُ يرجع بلا كتابةٍ واحدة — البابُ نفسُه لا يكتب. */
  return approved ? { ok: true, plan } : null;
}

/** يقرأ ملفًّا ويردّ نصَّه — مع حدٍّ يمنع ملفًّا يُجمّد اللوح (بند ١٦). */
export async function readEnrichmentFile(file) {
  const MAX = 8 * 1024 * 1024;
  if (!file) throw new Error('مااخترتش ملفّ');
  if (file.size > MAX) throw new Error('الملفّ كبير أوي — أكتر من 8 ميجا');
  return file.text();
}

export { parseEnrichment, planEnrichment };

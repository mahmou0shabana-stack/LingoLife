/**
 * LingoLife — مختبر التطوّر: التصدير
 *
 * ═══════════════════════════════════════════════════════════════
 * الهدف: ملفٌّ يُفهَم بلا أن تشرح من أوّله
 * ═══════════════════════════════════════════════════════════════
 *
 * ما يخرج من هنا يُرسَل لمن سينفّذ. فالمعيار ليس «هل صدّرنا كل
 * الحقول؟» بل **«هل يكفي هذا الملفّ ليبدأ أحدٌ الشغل بلا سؤال؟»**
 *
 * ولذلك يحمل ما لا تحمله قاعدةٌ عادية:
 *   · **«ممنوع يتكسر»** — أثمنُ سطرٍ في الملفّ. إصلاحٌ يكسر شيئًا
 *     آخر ليس إصلاحًا، ومَن ينفّذ لا يعرف ما لا تقوله له.
 *   · **«إمتى أعتبرها خلصت»** — فلا يُسلَّم شيءٌ ويُردّ.
 *   · **سبب التوقّف** — فلا يبدأ أحدٌ فيما هو موقوفٌ على قرارك.
 *   · **قبل/بعد** — حين توجد، وهي أوضح من أي وصف.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا PDF عبر طباعة المتصفّح لا بكاتبٍ نكتبه
 * ═══════════════════════════════════════════════════════════════
 *
 * كتابة PDF بيدنا ممكنةٌ تقنيًّا — المشروع كتب ZIP بيده فعلًا. لكن
 * **العربيّة تكسرها**: خطوط PDF القياسيّة الأربعة عشر لا تحوي حرفًا
 * عربيًّا واحدًا، وتضمينُ خطٍّ يعني تفريعَه (subsetting) وتشكيلَ
 * الحروف ووصلَها وترتيبَ الاتّجاهين — وهذا عملُ مكتبةٍ كاملة، لا
 * دالّةٍ في ملفّ.
 *
 * والمتصفّح **يفعل ذلك أصلًا وبإتقان**. فالزرّ يفتح صفحةً مُعدّةً
 * للطباعة، وتختار «حفظ كـPDF» — فيخرج ملفٌّ عربيُّه سليمٌ وصوره
 * بداخله. وهذا ليس تنازلًا: هو الطريق الذي يعطي أفضل نتيجةٍ فعلًا.
 *
 * ⚠️ **والحزمة (`.zip`) هي الأنسب لمن سينفّذ**: نصٌّ يُقرأ آليًّا،
 *    وJSON مُهيكَل، والصور ملفّاتٍ حقيقيّة بجانبهما — لا روابط
 *    `data:` ضخمةً تُفسد النصّ.
 */

import { createZipBuilder } from '../../utils/zip.js';
import { downloadBlob, esc } from '../../utils/dom.js';
import { media } from '../../db/repositories.js';
import {
  STATUS_META, BLOCKED_REASON_META, PRIORITY_META, featureLabel,
} from './model.js';
import { briefSummary, BRIEF_STATUS_LABEL } from './brief-service.js';
import { shotsOf, PHASE, PHASE_LABEL } from './shots.js';
import { timelineOf } from './issue-service.js';

/* ------------------------------------------------------------------ *
 * جمع ما يُصدَّر
 * ------------------------------------------------------------------ */

/** اسم ملفٍّ آمنٍ على كل نظام. */
export function safeName(text, fallback = 'brief') {
  const clean = String(text || '').trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return clean || fallback;
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * يجمع كل ما يلزم للتصدير — قراءةٌ واحدة، ثم تُشتقّ منها كل الصيغ.
 *
 * ⚠️ **ولا صيغةَ تقرأ من القاعدة بنفسها.** ثلاث صيغٍ تقرأ ثلاث مرّات
 *    تفترق أوّلَ مرّةٍ تتغيّر فيها ملاحظةٌ بينها — فيقول الـMarkdown
 *    شيئًا والـJSON شيئًا آخر عن نفس الشغل.
 */
export async function collectBrief(briefId, { build = '' } = {}) {
  const summary = await briefSummary(briefId);
  if (!summary) throw new Error('الـBrief مش موجود');

  const issues = await Promise.all(summary.issues.map(async (issue) => {
    const [shots, events] = await Promise.all([shotsOf(issue.id), timelineOf(issue.id)]);
    return { issue, shots, events };
  }));

  return { brief: summary.brief, summary, issues, build, exportedAt: Date.now() };
}

/** مجموعة ملاحظاتٍ مختارةٍ بلا Brief — «جاهز للتطوير» بالانتقاء. */
export async function collectIssues(issueRows, { title = 'ملاحظات مختارة', build = '' } = {}) {
  const issues = await Promise.all(issueRows.map(async (issue) => {
    const [shots, events] = await Promise.all([shotsOf(issue.id), timelineOf(issue.id)]);
    return { issue, shots, events };
  }));

  return {
    brief: { id: null, title, description: '', acceptance: '', doNotBreak: '', status: 'active' },
    summary: null,
    issues,
    build,
    exportedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ *
 * Markdown
 * ------------------------------------------------------------------ */

const when = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—');

/**
 * Markdown — الصيغة التي تُقرأ آليًّا وبالعين معًا.
 *
 * ⚠️ الصور تُذكَر بأسمائها لا بروابط `data:`. رابطٌ من ملايين المحارف
 *    داخل نصٍّ يجعل الملفّ غير قابلٍ للقراءة أصلًا — وفي الحزمة تكون
 *    الصور ملفّاتٍ بجانبه بنفس الأسماء.
 */
export function briefMarkdown(bundle) {
  const { brief, issues, build, summary } = bundle;
  const out = [];

  out.push(`# ${brief.title}`, '');
  if (brief.description) out.push(brief.description, '');

  out.push('| | |', '|---|---|');
  out.push(`| اتصدّر | ${when(bundle.exportedAt)} |`);
  if (build) out.push(`| نسخة التطبيق | \`${build}\` |`);
  out.push(`| عدد الملاحظات | ${issues.length} |`);
  if (summary) out.push(`| مفتوح / مقفول | ${summary.open} / ${summary.closed} |`);
  out.push('');

  if (brief.acceptance) {
    out.push('## إمتى أعتبره خلص', '', brief.acceptance, '');
  }

  /*
   * ⚠️ «ممنوع يتكسر» قبل الملاحظات لا بعدها: مَن يقرأ يبدأ من أوّل
   *    الملفّ، والقيد الذي يأتي بعد الشغل يأتي متأخّرًا.
   */
  if (brief.doNotBreak) {
    out.push('## ⚠️ ممنوع يتكسر', '', brief.doNotBreak, '');
  }

  out.push('---', '');

  issues.forEach(({ issue, shots, events }, i) => {
    const meta = STATUS_META[issue.status];
    out.push(`## ${i + 1}. ${issue.title}`, '');

    out.push('| | |', '|---|---|');
    out.push(`| الحالة | ${meta?.label || issue.status} |`);
    out.push(`| الأولويّة | ${PRIORITY_META[issue.priority]?.label || issue.priority} |`);
    out.push(`| الشاشة | ${featureLabel(issue.featureId)}${issue.routePattern ? ` (\`${issue.routePattern}\`)` : ''} |`);
    out.push(`| اتفتحت | ${when(issue.createdAt)} |`);
    if (issue.resolvedAt) out.push(`| اتحلّت | ${when(issue.resolvedAt)} |`);
    if (issue.build) out.push(`| نسخة التطبيق وقتها | \`${issue.build}\` |`);
    out.push('');

    if (issue.body) out.push('**ملاحظتي:**', '', issue.body, '');

    if (issue.blockedReason) {
      const reason = BLOCKED_REASON_META[issue.blockedReason];
      out.push(`> ⛔ **واقفة:** ${reason?.label || issue.blockedReason}`);
      if (issue.blockedNote) out.push(`> ${issue.blockedNote}`);
      out.push('');
    }

    if (issue.acceptance) out.push('**إمتى أعتبرها خلصت:**', '', issue.acceptance, '');

    if (issue.resolutionNote) {
      out.push('**اللي اتعمل:**', '', issue.resolutionNote, '');
    }

    if (shots.length) {
      out.push('**الصور:**', '');
      for (const shot of shots) {
        const bits = [`\`${shotFilename(issue, shot)}\``, PHASE_LABEL[shot.phase]];
        if (shot.region) bits.push(regionWords(shot.region));
        if (shot.caption) bits.push(shot.caption);
        out.push(`- ${bits.join(' · ')}`);
      }
      out.push('');
    }

    const reopened = events.filter((row) => row.kind === 'reopened').length;
    if (reopened) out.push(`> 🔁 اتفتحت تاني ${reopened} مرّة`, '');

    out.push('');
  });

  return out.join('\n');
}

/**
 * وصفُ المنطقة بالكلام — لأن `{x:0.1,y:0.7}` لا تقول شيئًا لقارئ.
 *
 * ⚠️ ولا يُقال «يمين» و«شمال» بحساب الـLTR: الواجهة عربيّة، فالنسبة
 *    الصغيرة في `x` هي **يمين** الشاشة لا يسارها.
 */
export function regionWords(region) {
  if (!region) return '';
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const side = cx < 0.34 ? 'يمين' : cx > 0.66 ? 'شمال' : 'نصّ';
  const level = cy < 0.34 ? 'فوق' : cy > 0.66 ? 'تحت' : 'وسط';
  return `الجزء المقصود: ${level} ${side}`;
}

/** اسم ملفّ اللقطة داخل الحزمة — ثابتٌ بين الصيغ. */
export function shotFilename(issue, shot) {
  const ext = (shot.media?.mime || 'image/png').split('/')[1]?.split('+')[0] || 'png';
  return `shots/${issue.id}-${shot.phase}-${shot.id.slice(-6)}.${ext}`;
}

/* ------------------------------------------------------------------ *
 * JSON
 * ------------------------------------------------------------------ */

/** JSON مُهيكَل — نفس المحتوى، لمن يقرأ آليًّا. */
export function briefJson(bundle) {
  const { brief, issues, build } = bundle;
  return {
    format: 'lingolife.dev-brief',
    version: 1,
    exportedAt: new Date(bundle.exportedAt).toISOString(),
    appBuild: build || null,
    brief: {
      id: brief.id,
      title: brief.title,
      description: brief.description || '',
      acceptance: brief.acceptance || '',
      doNotBreak: brief.doNotBreak || '',
      status: brief.status,
    },
    issues: issues.map(({ issue, shots, events }) => ({
      id: issue.id,
      title: issue.title,
      body: issue.body || '',
      status: issue.status,
      statusLabel: STATUS_META[issue.status]?.label || issue.status,
      priority: issue.priority,
      feature: { id: issue.featureId, label: featureLabel(issue.featureId) },
      route: { pattern: issue.routePattern || '', path: issue.routePath || '' },
      acceptance: issue.acceptance || '',
      blocked: issue.blockedReason
        ? {
          reason: issue.blockedReason,
          label: BLOCKED_REASON_META[issue.blockedReason]?.label || issue.blockedReason,
          note: issue.blockedNote || '',
        }
        : null,
      resolution: issue.resolvedAt
        ? { note: issue.resolutionNote || '', at: new Date(issue.resolvedAt).toISOString() }
        : null,
      createdAt: new Date(issue.createdAt).toISOString(),
      appBuild: issue.build || null,
      shots: shots.map((shot) => ({
        file: shotFilename(issue, shot),
        phase: shot.phase,
        region: shot.region,
        regionWords: regionWords(shot.region),
        caption: shot.caption || '',
      })),
      /* الخطّ الزمنيّ يخرج كاملًا: «اتغيّر إيه ومتى» جزءٌ من الطلب. */
      timeline: events.map((row) => ({
        kind: row.kind,
        at: new Date(row.at).toISOString(),
        from: row.from,
        to: row.to,
        note: row.note || '',
      })),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * الحزمة
 * ------------------------------------------------------------------ */

/**
 * حزمة `.zip`: نصٌّ وJSON والصور ملفّاتٍ حقيقيّة.
 *
 * وهذه هي الصيغة المقصودة حين تريد أن يبدأ أحدٌ الشغل: يفتح
 * `brief.md` فيفهم، ويفتح الصور فيرى، ويقرأ `brief.json` آليًّا.
 */
export async function briefZip(bundle) {
  const zip = createZipBuilder();

  zip.addText('brief.md', briefMarkdown(bundle));
  zip.addText('brief.json', JSON.stringify(briefJson(bundle), null, 2));

  for (const { issue, shots } of bundle.issues) {
    for (const shot of shots) {
      const file = shot.media?.blob || (shot.mediaId
        ? (await media.get(shot.mediaId))?.blob
        : null);
      if (file) await zip.addBlob(shotFilename(issue, shot), file);
    }
  }

  return zip.finalize();
}

/* ------------------------------------------------------------------ *
 * صفحة الطباعة → PDF
 * ------------------------------------------------------------------ */

/**
 * صفحةٌ مُعدّةٌ للطباعة — والمتصفّح يحوّلها PDF.
 *
 * ⚠️ الأنماط **داخل الصفحة** لا مربوطة بملفّ: نافذة الطباعة أصلٌ
 *    منفصل، وربطُ `components.css` فيها يعطي صفحةً بلا شكل.
 */
export function briefPrintHtml(bundle, shotSrc = () => '') {
  const { brief, issues, build } = bundle;

  const issueHtml = issues.map(({ issue, shots }, i) => {
    const meta = STATUS_META[issue.status];
    const blocked = issue.blockedReason
      ? `<p class="blocked"><strong>⛔ واقفة:</strong> ${esc(BLOCKED_REASON_META[issue.blockedReason]?.label || '')}${
        issue.blockedNote ? ` — ${esc(issue.blockedNote)}` : ''}</p>`
      : '';

    const shotHtml = shots.length
      ? `<div class="shots">${shots.map((shot) => {
        const src = shotSrc(shot);
        const box = shot.region
          ? `<span class="mark" style="inset-inline-start:${shot.region.x * 100}%;top:${shot.region.y * 100}%;inline-size:${shot.region.w * 100}%;block-size:${shot.region.h * 100}%"></span>`
          : '';
        return `<figure>
            <div class="shot-wrap">${src ? `<img src="${src}" alt="">` : ''}${box}</div>
            <figcaption>${esc(PHASE_LABEL[shot.phase])}${shot.caption ? ` — ${esc(shot.caption)}` : ''}${
          shot.region ? ` · ${esc(regionWords(shot.region))}` : ''}</figcaption>
          </figure>`;
      }).join('')}</div>`
      : '';

    return `<section class="issue">
      <h2>${i + 1}. ${esc(issue.title)}</h2>
      <div class="tags">
        <span class="tag">${esc(meta?.label || issue.status)}</span>
        <span class="tag">${esc(PRIORITY_META[issue.priority]?.label || '')}</span>
        <span class="tag">${esc(featureLabel(issue.featureId))}</span>
        ${issue.routePattern ? `<code>${esc(issue.routePattern)}</code>` : ''}
      </div>
      ${issue.body ? `<p>${esc(issue.body).replace(/\n/g, '<br>')}</p>` : ''}
      ${blocked}
      ${issue.acceptance ? `<p class="accept"><strong>إمتى أعتبرها خلصت:</strong> ${esc(issue.acceptance)}</p>` : ''}
      ${issue.resolutionNote ? `<p class="done"><strong>اللي اتعمل:</strong> ${esc(issue.resolutionNote)}</p>` : ''}
      ${shotHtml}
    </section>`;
  }).join('');

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(brief.title)}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, "Segoe UI", sans-serif; color: #1F2430;
         line-height: 1.7; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  .meta { color: #6B7280; font-size: 12px; margin-bottom: 18px; }
  .box { border: 1px solid #E5E1D6; border-radius: 8px; padding: 12px 14px;
         margin-bottom: 14px; background: #FAF8F2; }
  .box.warn { border-color: #D08A00; background: #FFF6E5; }
  .box h3 { margin: 0 0 6px; font-size: 13px; }
  .issue { border-top: 1px solid #E5E1D6; padding-top: 14px; margin-top: 14px;
           break-inside: avoid; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
          font-size: 11px; color: #4B5563; }
  .tag { border: 1px solid #E5E1D6; border-radius: 99px; padding: 1px 9px; }
  code { background: #EFECFD; padding: 1px 5px; border-radius: 4px; font-size: 11px; }
  p { margin: 0 0 8px; font-size: 13px; }
  .blocked { color: #B45309; }
  .done { color: #15803D; }
  .shots { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
  figure { margin: 0; max-inline-size: 46%; }
  .shot-wrap { position: relative; border: 1px solid #E5E1D6; border-radius: 6px;
               overflow: hidden; }
  .shot-wrap img { display: block; inline-size: 100%; }
  /* إشارتك على الصورة تُطبَع معها — وإلّا ضاع «أنهي جزء». */
  .mark { position: absolute; border: 3px solid #D6414B; border-radius: 4px;
          background: rgba(214,65,75,0.12); }
  figcaption { font-size: 11px; color: #6B7280; margin-top: 4px; }
</style></head><body>
  <h1>${esc(brief.title)}</h1>
  <div class="meta">
    اتصدّر ${when(bundle.exportedAt)}${build ? ` · نسخة التطبيق ${esc(build)}` : ''}
    · ${issues.length} ملاحظة
  </div>
  ${brief.description ? `<p>${esc(brief.description).replace(/\n/g, '<br>')}</p>` : ''}
  ${brief.acceptance ? `<div class="box"><h3>إمتى أعتبره خلص</h3><p>${esc(brief.acceptance)}</p></div>` : ''}
  ${brief.doNotBreak ? `<div class="box warn"><h3>⚠️ ممنوع يتكسر</h3><p>${esc(brief.doNotBreak)}</p></div>` : ''}
  ${issueHtml}
</body></html>`;
}

/* ------------------------------------------------------------------ *
 * التنزيل
 * ------------------------------------------------------------------ */

export function downloadMarkdown(bundle) {
  const text = briefMarkdown(bundle);
  downloadBlob(new Blob([text], { type: 'text/markdown' }),
    `${safeName(bundle.brief.title)}-${stamp()}.md`);
}

export function downloadJson(bundle) {
  const text = JSON.stringify(briefJson(bundle), null, 2);
  downloadBlob(new Blob([text], { type: 'application/json' }),
    `${safeName(bundle.brief.title)}-${stamp()}.json`);
}

export async function downloadZip(bundle) {
  const blob = await briefZip(bundle);
  downloadBlob(blob, `${safeName(bundle.brief.title)}-${stamp()}.zip`);
}

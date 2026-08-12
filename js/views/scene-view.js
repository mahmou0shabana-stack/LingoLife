/**
 * LingoLife — لوحة الذكرى (Scene Journal Board)
 *
 * صفحة واحدة طويلة، كل الأقسام حاضرة في أماكنها من أول لحظة (بند 10).
 * القسم الفاضي يظهر كخانة جاهزة للإضافة — لا اعتذار ولا "قريبًا".
 */

import { getSceneFull } from '../services/scene-service.js';
import { transcriptOf } from '../services/transcript-service.js';
import { listConversationParts, listSceneExpressions, getBlock, scriptTypeLabel, registerLabel, registerClass } from '../services/content-service.js';
import { urlFor, releaseUrls, AUDIO_ROLE_LABEL } from '../services/media-service.js';
import { html, raw, formatDuration } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';
import { typeLabel } from '../services/type-service.js';
import { AXIS, pivotsFor, facetTree } from '../services/atlas-service.js';
import { STAGE_LABEL, expressionLife } from '../services/language-service.js';
import { counted } from '../utils/plural.js';
import { threadsOfScene } from '../services/thread-service.js';
import { scenePeople as scenePeopleWithEvidence } from '../services/participant-service.js';
import { icon } from '../components/icons.js';

/** أقسام اللوحة — العدد يظهر في الفهرس المصغّر. */
const SECTIONS = [
  { id: 'moment', label: 'اللحظة' },
  { id: 'images', label: 'الصور', count: 'images' },
  { id: 'voices', label: 'الأصوات', count: 'audio' },
  { id: 'scripts', label: 'السكريبتات', count: 'scripts' },
  { id: 'conversation', label: 'المحادثة', count: 'parts' },
  { id: 'transcript', label: 'النصّ الأصلي' },
  { id: 'mistakes', label: 'خطأ / طبيعي', count: 'mistakes' },
  { id: 'language', label: 'اللغة', count: 'expressions' },
  { id: 'recall', label: 'احكيها' },
  { id: 'notes', label: 'ملاحظاتي' },
];

/** خانة فاضية موحّدة الشكل. */
function slot(action, id, iconName, title, hint) {
  return html`
    <button class="slot-empty" data-action="${action}" data-id="${id}">
      <span class="ic">${raw(icon(iconName))}</span>
      <span class="t">${title}</span>
      <span class="h">${hint}</span>
    </button>`;
}

/** ترويسة قسم مع زر إضافة. */
function head(iconName, title, count, action, sceneId, addLabel) {
  return html`
    <div class="sec-head">
      <h2>${raw(icon(iconName))} ${title}${raw(count ? html` <span class="count">${count}</span>` : '')}</h2>
      ${raw(
        action
          ? html`<button class="add" data-action="${action}" data-id="${sceneId}">
              ${raw(icon('plus'))} ${addLabel || 'إضافة'}
            </button>`
          : ''
      )}
    </div>`;
}

/** موجة صوتية زخرفية — تمثيل بصري، لا تحليل للصوت. */
function wave(seed = 1) {
  const bars = Array.from({ length: 22 }, (_, i) => {
    const h = 20 + Math.abs(Math.sin((i + seed) * 1.7)) * 80;
    return `<i style="height:${h}%"></i>`;
  }).join('');
  return `<span class="wave" aria-hidden="true">${bars}</span>`;
}

/* ============================================================
   الأقسام
   ============================================================ */

function sectionImages(scene, images, coverId) {
  const shown = images.slice(0, 6);
  const extra = images.length - shown.length;

  let body;
  if (!images.length) {
    // شبكة شبح تحجز الشكل النهائي حتى وهي فاضية
    body = html`
      <div class="mosaic">
        <button class="tile-add" data-action="add-images" data-id="${scene.id}"
          style="grid-column:span 2;grid-row:span 2;aspect-ratio:auto">
          ${raw(icon('plus'))}
          <span>أضف صور</span>
        </button>
        <div class="tile-ghost"></div>
        <div class="tile-ghost"></div>
        <div class="tile-ghost"></div>
        <div class="tile-ghost"></div>
      </div>`;
  } else {
    body = html`
      <div class="mosaic">
        ${raw(
          shown
            .map((m, i) => {
              const isLast = i === shown.length - 1 && extra > 0;
              return html`
                <button class="tile" data-action="open-image" data-id="${m.id}" data-scene="${scene.id}">
                  <img src="${urlFor(m)}" alt="${m.caption || 'صورة من الذكرى'}" loading="lazy">
                  ${raw(m.id === coverId ? '<span class="badge-cover">الغلاف</span>' : '')}
                  ${raw(isLast ? html`<span class="more-count">+${extra}</span>` : '')}
                </button>`;
            })
            .join('')
        )}
        <button class="tile-add" data-action="add-images" data-id="${scene.id}">
          ${raw(icon('plus'))}
          <span>إضافة</span>
        </button>
      </div>`;
  }

  return html`
    <section class="sec" id="sec-images">
      ${raw(head('image', 'الصور', images.length || '', 'add-images', scene.id, 'أضف'))}
      ${raw(body)}
    </section>`;
}

function sectionVoices(scene, audio) {
  const body = audio.length
    ? audio
        .map(
          (m, i) => html`
            <div class="voice-row">
              <button class="play-btn" data-action="play-audio" data-id="${m.id}" aria-label="تشغيل">
                ${raw(icon('play'))}
              </button>
              <div class="info">
                <b>${m.caption || m.filename}</b>
                <span class="role">${AUDIO_ROLE_LABEL[m.role] || 'تسجيل'}</span>
                ${raw(
                  m.tags?.length
                    ? html`<span class="link-badges">${raw(
                        m.tags.map((t) => html`<span class="link-badge tag">${t}</span>`).join('')
                      )}</span>`
                    : ''
                )}
              </div>
              ${raw(wave(i + 1))}
              <span class="dur">${formatDuration(m.durationMs)}</span>
              <button class="row-del" data-action="delete-audio" data-id="${m.id}"
                data-scene="${scene.id}" aria-label="حذف التسجيل">
                ${raw(icon('trash', 16))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-audio', scene.id, 'mic', 'أضف صوت أو سجّل', 'التسجيل الأصلي، صوتك، أو أجزاء المحادثة');

  return html`
    <section class="sec" id="sec-voices">
      ${raw(head('mic', 'الأصوات', audio.length || '', 'add-audio', scene.id, 'أضف'))}
      ${raw(body)}
      ${raw(
        audio.length
          ? html`<div class="script-foot">
              ${raw(audio.length > 1
                ? html`<button class="mini-btn" data-action="play-all-audio" data-id="${scene.id}">
                    ${raw(icon('play'))} شغّلهم كلهم
                  </button>`
                : '')}
              <button class="mini-btn" data-action="record-audio" data-id="${scene.id}">
                ${raw(icon('mic'))} سجّل صوتك
              </button>
            </div>`
          : ''
      )}
    </section>`;
}

/**
 * مَن كان هنا.
 *
 * ⚠️ **مُشتقٌّ من نفس مصدر الأطلس** — `personId` على أجزاء المحادثة —
 *    لا من `scene.peopleIds`. ذلك الحقل يُكتب `[]` عند الإنشاء ولا
 *    يُملأ في أي مكان، وقراءته هنا تُظهر «مفيش حد» في ذكرى فيها
 *    ثلاثة تكلّموا.
 *
 * ⚠️ **وحاضرٌ ومتكلّمٌ شيئان** *(WS9)*. كان القسم يعرض مَن تكلّم وحده،
 *    فيختفي مَن حضر وصمت. فصار يعرض الاتحاد، **ويقول لكلٍّ لماذا
 *    ظهر** — لأن «كان هناك» و«قال جملة» واقعتان مختلفتان، ودمجُهما
 *    في «موجود» يخسر الفرق.
 */
function sectionPeople(scene, people, unlinked) {
  return html`
    <section class="sec" id="sec-people">
      ${raw(head('person', 'مين كان هنا', people.length || '',
        'edit-participants', scene.id, 'مين كمان'))}

      ${raw(people.length || unlinked.length ? html`
      <div class="people-row">
        ${raw(people.map((person) => html`
          <button class="rv-person" data-action="facet-open"
                  data-axis="personId" data-id="${person.id}" data-label="${person.name}">
            ${raw(icon('person', 15))} <bdi>${person.name}</bdi>
            <span class="pv-why">${person.spoke
              ? (person.declared ? 'حضر واتكلّم' : `اتكلّم ${person.saidCount}`)
              : 'حضر'}</span>
            <span class="pivot-count">${person.count}</span>
          </button>`).join(''))}

        ${raw(unlinked.map((name) => html`
          <button class="rv-person is-loose" data-action="manage-people" title="اربطه بشخص">
            <bdi>${name}</bdi>
            <span class="pivot-count">?</span>
          </button>`).join(''))}
      </div>` : html`
      <div class="text-sm text-faint">
        مين كان معاك في اللحظة دي؟ اللي بيتكلّم في المحادثة بيبان هنا
        لوحده — واللي حضر وسكت تقوله إنت.
      </div>`)}

      <p class="rv-hint">
        «حضر» يعني إنت قلت إنه كان هناك. «اتكلّم» يعني له جملة في
        المحادثة. والرقم عدد ذكرياتك معه كلها.
      </p>
    </section>`;
}

function sectionScripts(scene, scriptList, activeId) {
  if (!scriptList.length) {
    return html`
      <section class="sec wide" id="sec-scripts">
        ${raw(head('script', 'السكريبتات', '', 'add-script', scene.id, 'أضف'))}
        ${raw(slot('add-script', scene.id, 'script', 'أضف أول سكريبت', 'النص اللي قلته أو اللي المفروض تقوله'))}
      </section>`;
  }

  const active = scriptList.find((s) => s.id === activeId) || scriptList.find((s) => s.isPrimary) || scriptList[0];

  return html`
    <section class="sec wide" id="sec-scripts">
      ${raw(head('script', 'السكريبتات', scriptList.length, 'add-script', scene.id, 'أضف'))}

      <div class="tabs" role="tablist">
        ${raw(
          scriptList
            .map(
              (s) => html`
                <button class="tab ${s.id === active.id ? 'active' : ''}" role="tab"
                  data-action="show-script" data-id="${s.id}" data-scene="${scene.id}">
                  ${s.title || scriptTypeLabel(s.type)}${raw(s.isPrimary ? ' ★' : '')}
                </button>`
            )
            .join('')
        )}
      </div>

      <div class="script-body ru" dir="ltr" lang="ru">${active.text || ''}</div>

      <div class="script-foot">
        <button class="mini-btn" data-action="edit-script" data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('edit'))} تعديل
        </button>
        <button class="mini-btn" data-action="copy-script" data-id="${active.id}">
          ${raw(icon('copy'))} نسخ
        </button>
        <button class="mini-btn" data-action="shadow-script"
          data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('play'))} تدرّب بالظلّ
        </button>
        <button class="mini-btn" data-action="shadow-selection"
          data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('check'))} تدرّب على جمل مختارة
        </button>
        ${raw(
          active.isPrimary
            ? ''
            : html`<button class="mini-btn" data-action="primary-script" data-id="${active.id}" data-scene="${scene.id}">
                ${raw(icon('star'))} اجعله الأساسي
              </button>`
        )}
        <button class="mini-btn danger" data-action="delete-script"
          data-id="${active.id}" data-scene="${scene.id}">
          ${raw(icon('trash'))} حذف
        </button>
      </div>
    </section>`;
}

function sectionConversation(scene, parts) {
  const body = parts.length
    ? parts
        .map(
          (p) => html`
            <div class="bubble-row ${p.isMine ? 'mine' : ''}">
              <span class="avatar">${(p.speaker || '؟').slice(0, 1)}</span>
              <div class="bubble">
                <div class="who">${p.speaker}</div>
                <div class="txt ru" dir="ltr" lang="ru">${p.text}</div>
                ${raw(p.translation ? html`<div class="foot">${p.translation}</div>` : '')}
              </div>
              <button class="row-del" data-action="delete-part" data-id="${p.id}"
                data-scene="${scene.id}" aria-label="حذف الجزء">
                ${raw(icon('trash', 15))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-part', scene.id, 'chat', 'أضف أجزاء المحادثة', 'مين قال إيه — بالترتيب');

  return html`
    <section class="sec wide" id="sec-conversation">
      ${raw(head('chat', 'المحادثة الحقيقية', parts.length || '', 'add-part', scene.id, 'أضف جزء'))}
      ${raw(body)}
      ${raw(
        parts.length
          ? html`<div class="script-foot">
              <button class="mini-btn" data-action="shadow-conversation" data-scene="${scene.id}">
                ${raw(icon('play'))} تدرّب بالظلّ
              </button>
            </div>`
          : ''
      )}
    </section>`;
}

function sectionMistakes(scene, mistakes) {
  const body = mistakes.length
    ? mistakes
        .map(
          (m) => html`
            <div class="mistake">
              <div class="m-line wrong">
                <span class="mark">✕</span>
                <span class="ru" dir="ltr" lang="ru">${m.wrong}</span>
              </div>
              <div class="m-arrow">↓</div>
              <div class="m-line right">
                <span class="mark">✓</span>
                <span class="ru" dir="ltr" lang="ru">${m.natural}</span>
              </div>
              ${raw(m.explanation ? html`<div class="m-note">${m.explanation}</div>` : '')}
              <button class="row-del corner" data-action="delete-mistake" data-id="${m.id}"
                data-scene="${scene.id}" aria-label="حذف التصحيح">
                ${raw(icon('trash', 15))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-mistake', scene.id, 'compare', 'أضف تصحيح', 'اللي قلته مقابل اللي المفروض يتقال');

  return html`
    <section class="sec wide" id="sec-mistakes">
      ${raw(head('compare', 'خطأ / طبيعي', mistakes.length || '', 'add-mistake', scene.id, 'أضف'))}
      ${raw(body)}
    </section>`;
}

function sectionLanguage(scene, expressionList) {
  const body = expressionList.length
    ? expressionList
        .map(
          (e) => html`
            <div class="lang-row">
              <button class="txt" data-action="open-expression" data-id="${e.id}">
                <span class="ru" dir="ltr" lang="ru">${e.text}</span>
                ${raw(e.meaningAr ? html`<span class="meaning">${e.meaningAr}</span>` : '')}
              </button>
              ${raw(
                /*
                 * ⚠️ المرحلة تظهر **حين تكون خبرًا**. «سمعته» هي حال كل
                 *    تعبيرٍ لم تحكم عليه بعد، فطبعُها على كل سطر يزحم
                 *    النصّ الروسيّ حتى يلتفّ — ولا يقول شيئًا.
                 */
                e.masteryState && e.masteryState !== 'heard'
                  ? html`<span class="tag is-stage">${STAGE_LABEL[e.masteryState]}</span>`
                  : ''
              )}
              ${raw(
                e.register
                  ? html`<span class="tag ${registerClass(e.register)}">${registerLabel(e.register)}</span>`
                  : ''
              )}
              <button class="row-del" data-action="delete-expression" data-id="${e.id}"
                data-scene="${scene.id}" aria-label="حذف التعبير">
                ${raw(icon('trash', 15))}
              </button>
            </div>`
        )
        .join('')
    : slot('add-expression', scene.id, 'language', 'أضف تعبير', 'التعبيرات اللي اتعلمتها من اللحظة دي');

  return html`
    <section class="sec" id="sec-language">
      ${raw(head('language', 'اللغة جوّه الذكرى', expressionList.length || '', 'add-expression', scene.id, 'أضف'))}
      ${raw(body)}
    </section>`;
}

/**
 * رحلة التعبير — **أين قابلتَه غير هنا**.
 *
 * ⚠️ كان هنا شريطٌ من ستّ مراحل ومؤشّرٌ يقول «دلوقتي» تحت واحدة.
 *    وكان يقول «سمعته» **دائمًا ولكل تعبير إلى الأبد**: الحقل الذي
 *    يقرؤه يُكتب مرّةً عند الإنشاء ولا يرفعه شيءٌ في التطبيق كلّه.
 *    شريطُ تقدّمٍ لا يتقدّم أسوأ من غيابه — يَعِد بقياسٍ لا يقع.
 *    والمرحلة انتقلت لصفحة التعبير، حيث تختارها **بيدك**.
 *
 * ⚠️ ثم أوّل بديلٍ كتبتُه سرد التعبيرات كلها — فصار القسم نسخةً ثانية
 *    من «اللغة جوّه الذكرى» فوقه مباشرةً: نفس التعبير مرّتين في شاشة
 *    واحدة. رأيتُ ذلك في لقطةٍ من متصفّح لا في مراجعةِ كود.
 *
 *    فالقسم لا يعرض إلا ما له حياةٌ **خارج هذه الذكرى** — وإلّا اختفى.
 *    تعبيرٌ قابلتَه هنا وحدَه لا رحلةَ له بعد، وسطرٌ يقول «أول مرّة»
 *    يملأ الشاشة بلا خبر.
 */
function sectionLife(journeys) {
  if (!journeys.length) return '';

  return html`
    <section class="sec" id="sec-life">
      ${raw(head('clock', 'رحلة التعبير', journeys.length, null))}
      <div class="text-sm text-faint mb-2">
        التعبيرات دي قابلتها في ذكريات تانية كمان.
      </div>
      ${raw(journeys.map(({ expression, elsewhere }) => html`
        <button class="lg-row" data-action="open-expression" data-id="${expression.id}">
          <span class="lg-ru" dir="ltr" lang="ru">${expression.text}</span>
          ${raw(expression.meaningAr ? html`<span class="lg-ar">${expression.meaningAr}</span>` : '')}
          <span class="lg-meta">
            ${raw(expression.masteryState && expression.masteryState !== 'heard'
              ? html`<span class="rv-tag is-plain">${STAGE_LABEL[expression.masteryState]}</span>`
              : '')}
            <span class="fc-count">كمان في
              ${counted(elsewhere.length, 'ذكرى', 'ذكريتين', 'ذكريات')}</span>
          </span>
          <span class="lg-where">${elsewhere.slice(0, 3).map((o) => o.title).join(' · ')}</span>
        </button>`).join(''))}
    </section>`;
}

function sectionRecall(scene, hasImage) {
  return html`
    <section class="sec" id="sec-recall">
      ${raw(head('mic', 'احكيها دلوقتي', '', null))}
      <div class="tell-now">
        <p>
          ${hasImage
            ? 'بصّ على الصورة واحكي الموقف بالروسي من غير ما تقرأ السكريبت.'
            : 'افتكر الموقف واحكيه بالروسي من غير ما تقرأ السكريبت.'}
        </p>
        <button class="rec-btn" data-action="record-retell" data-id="${scene.id}" aria-label="ابدأ التسجيل">
          ${raw(icon('mic'))}
        </button>
        <div class="rec-time" data-rec-time>00:00</div>
      </div>
    </section>`;
}

/**
 * النصّ الأصلي — سابعُ حقلٍ ميّتٍ يُحيا.
 *
 * ⚠️ **محدودُ الارتفاع من أوّل يوم** *(A5)*. الملحق يعالجه على أنه
 *    معروضٌ ويطلب تحديد ارتفاعه، والحقيقة أنه لم يكن معروضًا أصلًا.
 *    فلا يُبنى مفتوحًا ثم يُقيَّد: يُبنى مقيَّدًا، ويُفتَح بطلبك.
 *
 * ⚠️ **والأصل يُكتب مرّةً ثم يُقفَل** *(بند 27)*. النصّ الذي كتبتَه
 *    ساعتها هو ما قيل فعلًا بأخطائه، وتصحيحُه فوق نفسه يمحو الفرق
 *    بين ما قلتَه وما كان ينبغي — وعليه يقوم نصفُ التطبيق.
 */
function sectionTranscript(scene, t) {
  const long = t.rawText.length > 600;

  if (!t.hasRaw) {
    return html`
      <section class="sec" id="sec-transcript">
        ${raw(head('script', 'النصّ الأصلي', '', null))}
        <p class="tr-why">
          اللي اتقال فعلًا، بأخطائه. بيتكتب <strong>مرّة واحدة</strong>
          وبعدها مابيتعدّلش — والتصحيح بيبقى نسخة تانية جنبه.
        </p>
        ${raw(slot('write-raw', scene.id, 'script', 'اكتب النصّ الأصلي',
          'من غير ما تظبّطه — الغلط نفسه هو الفايدة'))}
      </section>`;
  }

  return html`
    <section class="sec" id="sec-transcript">
      ${raw(head('script', 'النصّ الأصلي', '', null))}

      <div class="tr-block${long ? ' is-clipped' : ''}" data-tr-block>
        <span class="tr-lock" title="مقفول — بند 27">${raw(icon('eyeOff'))} مابيتعدّلش</span>
        <p class="tr-text ru" dir="auto">${t.rawText}</p>
        ${raw(long ? html`
          <button class="tr-more" data-action="tr-expand">اقرا الباقي</button>` : '')}
      </div>

      <div class="tr-tools">
        <button class="btn btn-ghost btn-sm" data-action="tr-copy" data-id="${scene.id}">
          ${raw(icon('copy'))} انسخ
        </button>
        <button class="btn btn-ghost btn-sm" data-action="tr-focus" data-id="${scene.id}">
          ${raw(icon('eye'))} وضع التركيز
        </button>
      </div>

      ${raw(t.hasClean ? html`
        <div class="tr-clean">
          <div class="tr-clean-head">
            <h3>${raw(icon('check'))} النسخة المصحّحة</h3>
            <button class="add" data-action="tr-edit-clean" data-id="${scene.id}">
              ${raw(icon('edit'))} عدّل
            </button>
          </div>
          <p class="tr-text ru" dir="auto">${t.cleanText}</p>
        </div>`
        : html`
        <button class="tr-addclean" data-action="tr-edit-clean" data-id="${scene.id}">
          ${raw(icon('plus'))} اعمل نسخة مصحّحة
          <span>الأصل بيفضل زيّ ما هو — دي بتعيش جنبه</span>
        </button>`)}
    </section>`;
}

function sectionNotes(scene, notesText) {
  return html`
    <section class="sec" id="sec-notes">
      ${raw(head('note', 'ملاحظاتي', '', null))}
      <textarea class="notes-area" data-notes data-id="${scene.id}"
        placeholder="أي حاجة عايز تفتكرها عن اللحظة دي…">${notesText || ''}</textarea>
    </section>`;
}

/* ============================================================
   العرض الكامل
   ============================================================ */

/**
 * من هذه الذكرى إلى ما يشبهها — مداخل الأطلس من داخل الذكرى.
 *
 * ⚠️ هذا هو الاستعمال الحقيقي للأطلس: تقرأ ذكرى فتسأل «إمتى تاني
 *    قابلت الراجل ده؟» — لا تفتح شجرةً وتبحث عن اسمه فيها.
 *
 * ⚠️ ولا يُعرَض محورٌ إلا إن كان وراءه غيرها (تُصفّيه `pivotsFor`):
 *    «شوف باقي ذكرياتك في المكان ده» على ذكرى وحيدةٍ هناك وعدٌ كاذب —
 *    تضغطه فتجدها هي.
 */
function pivotRow(pivots) {
  if (!pivots.length) return '';
  const word = {
    [AXIS.TYPE]: 'زيّها',
    [AXIS.PLACE]: 'في',
    [AXIS.PERSON]: 'مع',
    [AXIS.THREAD]: 'في قصّة',
  };
  return html`
    <div class="pivot-row">
      <span class="pivot-head">شوف كمان:</span>
      ${raw(pivots.map((pivot) => html`
        <button class="pivot" data-action="facet-open"
                data-axis="${pivot.axis}" data-id="${pivot.value}" data-label="${pivot.label}">
          ${word[pivot.axis]}${raw(pivot.label ? html` <bdi>${pivot.label}</bdi>` : '')}
          <span class="pivot-count">${pivot.count}</span>
        </button>`).join(''))}
    </div>`;
}

export async function renderScene(main, sceneId, options = {}) {
  releaseUrls();

  const full = await getSceneFull(sceneId);
  if (!full) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('info'))}</div>
        <h2>الذكرى دي مش موجودة</h2>
        <p>يمكن تكون اتنقلت لسلة المهملات أو اتمسحت.</p>
        <button class="btn btn-ghost" data-action="go-life">افتح حياتي</button>
      </div>`;
    return;
  }

  const { scene, media: mediaItems, scripts: scriptList, mistakes } = full;
  const images = mediaItems.filter((m) => m.kind === 'image');
  const audio = mediaItems.filter((m) => m.kind === 'audio');

  const [parts, expressionList, notesBlock, threads, pivots, tree, transcript] = await Promise.all([
    listConversationParts(sceneId),
    listSceneExpressions(sceneId),
    getBlock(sceneId, 'notes'),
    threadsOfScene(sceneId),
    pivotsFor(sceneId),
    facetTree(),
    transcriptOf(sceneId),
  ]);

  /*
   * أين ظهر كل تعبير **غير هنا** — وهو وحده ما يجعل «رحلة التعبير»
   * رحلةً. يُقرأ من `expressionLife` نفسها التي تقرؤها صفحة التعبير،
   * فلا يقول الرقمُ هنا شيئًا ويقول هناك غيره.
   */
  const journeys = [];
  for (const expression of expressionList) {
    const life = await expressionLife(expression.id);
    const seen = new Map();
    for (const occurrence of life?.occurrences || []) {
      if (occurrence.sceneId !== sceneId) seen.set(occurrence.sceneId, occurrence);
    }
    if (seen.size) journeys.push({ expression, elsewhere: [...seen.values()] });
  }

  /*
   * مَن كان هنا — **مُعلَنٌ ومُشتقّ معًا** *(WS9)*. الخدمة تجمع
   * المشاركين الذين أعلنتَهم والمتكلّمين الذين لهم جملة، وتقول لكلٍّ
   * لماذا ظهر. والعدد الظاهر بجانبه عدد ذكرياتك **معه** كلّها من
   * الأطلس، فيصير مدخلًا لا رقمًا محلّيًّا.
   */
  const here = await scenePeopleWithEvidence(sceneId);
  const scenePeople = here.map((person) => ({
    ...person,
    count: tree.people.find((row) => row.id === person.id)?.count || 0,
  }));

  // متحدّثون بأسمائهم النصّية بلا شخصٍ مربوط — يُعرَضون ليُربطوا.
  const looseSpeakers = [...new Set(
    parts.filter((p) => !p.personId && !p.isMine && p.speaker).map((p) => p.speaker)
  )];

  const counts = {
    images: images.length,
    audio: audio.length,
    scripts: scriptList.length,
    parts: parts.length,
    mistakes: mistakes.length,
    expressions: expressionList.length,
  };

  const cover = images.find((m) => m.id === scene.coverMediaId) || images[0] || null;

  main.innerHTML = html`

    <div class="scene-top">
      <div class="titles">
        <h1>${scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان'}</h1>
        ${raw(scene.titleRu && scene.titleAr ? html`<div class="title-ru ru" dir="ltr" lang="ru">${scene.titleRu}</div>` : '')}
        <div class="meta-chips">
          <span class="chip">${raw(icon('calendar'))} ${formatDate(scene.date)}</span>
          <span class="chip">${raw(icon('tag'))} ${typeLabel(scene.type)}</span>
          ${raw(
            scene.placeName
              ? html`<span class="chip">${raw(icon('place'))} ${scene.placeName}</span>`
              : html`<button class="chip editable empty" data-action="edit-scene" data-id="${scene.id}">
                  ${raw(icon('place'))} أضف المكان
                </button>`
          )}
          <!--
            الخيوط التي تنتمي إليها الذكرى — بأسمائها لا بمعرّفاتها
            (بند 29)، وكلٌّ منها رابطٌ إلى قصّته.
          -->
          ${raw(
            threads
              .map(
                (t) =>
                  html`<a class="chip chip-thread" href="#/thread/${t.id}">
                    ${raw(icon('link'))} ${t.title}
                  </a>`
              )
              .join('')
          )}
          <button class="chip editable" data-action="thread-link" data-id="${scene.id}">
            ${raw(icon('link'))} ${threads.length ? 'اربطها بقصّة تانية' : 'اربطها بقصّة'}
          </button>
          <button class="chip editable" data-action="edit-scene" data-id="${scene.id}">
            ${raw(icon('edit'))} تعديل
          </button>
        </div>
        ${raw(pivotRow(pivots))}
      </div>

      <div class="top-actions">
        <button class="star-btn ${scene.isFavorite ? 'on' : ''}" data-action="toggle-fav"
          data-id="${scene.id}" aria-label="مفضّلة">${raw(icon('star'))}</button>
        <button class="tool-btn" data-action="export-scene" data-id="${scene.id}">
          ${raw(icon('download'))} تصدير
        </button>
        <button class="tool-btn" data-action="analysis-request" data-id="${scene.id}">
          ${raw(icon('sparkle'))} حلّلها
        </button>
        <button class="tool-btn" data-action="trash-scene" data-id="${scene.id}">
          ${raw(icon('trash'))} السلة
        </button>
      </div>
    </div>

    <nav class="mini-index" aria-label="أقسام الذكرى">
      ${raw(
        SECTIONS.map((s) => {
          const n = s.count ? counts[s.count] : null;
          return html`
            <button class="index-btn" data-action="scroll-to" data-target="sec-${s.id}">
              ${s.label}${raw(n ? html` <span class="n">${n}</span>` : '')}
            </button>`;
        }).join('')
      )}
    </nav>

    <section id="sec-moment">
      ${raw(
        cover
          ? html`
              <button class="scene-hero" data-action="open-image" data-id="${cover.id}" data-scene="${scene.id}">
                <img src="${urlFor(cover, { thumb: false })}" alt="صورة الذكرى">
                <span class="cap">
                  <b>${scene.titleAr || 'اللحظة'}</b>
                  <span>${formatDate(scene.date)}${raw(scene.placeName ? ` · ${scene.placeName}` : '')}</span>
                </span>
              </button>`
          : html`
              <button class="scene-hero is-empty" data-action="add-images" data-id="${scene.id}">
                ${raw(icon('image'))}
                <span class="t">أضف صورة اللحظة</span>
                <span class="text-sm">الصورة هي اللي بترجّعك للموقف</span>
              </button>`
      )}
      ${raw(
        scene.context
          ? html`<div class="sec" style="margin-bottom:var(--sp-4)">
              <p class="text-soft" style="margin:0;line-height:1.9">${scene.context}</p>
            </div>`
          : ''
      )}
    </section>

    <div class="board">
      ${raw(sectionImages(scene, images, scene.coverMediaId))}
      ${raw(sectionVoices(scene, audio))}
      ${raw(sectionLanguage(scene, expressionList))}
      ${raw(sectionScripts(scene, scriptList, options.activeScriptId))}
      ${raw(sectionConversation(scene, parts))}
      ${raw(sectionTranscript(scene, transcript))}
      ${raw(sectionPeople(scene, scenePeople, looseSpeakers))}
      ${raw(sectionMistakes(scene, mistakes))}
      ${raw(sectionLife(journeys))}
      ${raw(sectionRecall(scene, images.length > 0))}
      ${raw(sectionNotes(scene, notesBlock.text))}
    </div>`;
}

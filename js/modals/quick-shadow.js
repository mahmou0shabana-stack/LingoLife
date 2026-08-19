/**
 * LingoLife — الظلُّ السريع: نصٌّ من برّه، بلا ذكرى (WS38)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «خلّي زرار شادوينج سحري عايم في أي مكان في البرنامج، لو حبّيت
 * >  أجيب نصّ خارجي أو صورة خارجية مش موجودة في ذكرى وعايز أذاكرها
 * >  مباشرة من غير ما أسجّلها في البرنامج — بس تتسجّل بعد كده في
 * >  دلوقتي، ويبقى فيه أوبشن إني أضيفها كذكرى.»
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ «من غير ما أسجّلها» و«تتسجّل بعد كده» ليستا متناقضتين
 * ═══════════════════════════════════════════════════════════════
 *
 * المقصودُ ليس **ألّا يُحفَظ شيء** — لو لم يُحفَظ لما ظهر في «دلوقتي»
 * ولما أمكن أن يصير ذكرى. المقصودُ ألّا يُطلَب منك **قرارٌ** قبل أن
 * تتدرّب: لا عنوانٌ ولا تاريخٌ ولا نوعُ حدثٍ ولا مكان.
 *
 * فالنصُّ يُحفَظ **مسودّةً بلا ذكرى** (`sceneId: null` — وهو مسموحٌ في
 * `studyDrafts` منذ WS25، وكُتب وقتها أن الذكرى «سياقٌ لا هُويّة»).
 * والجلسةُ تُبنى منها فتظهر في «دلوقتي» مع بقيّة جلساتك تلقائيًّا.
 * وحين تقرّر، تصير ذكرى — بعد أن تكون قد استفدتَ منها.
 *
 * ⚠️ **والجلسةُ تُبنى مباشرةً — لا عبر `openShadowFromDraft`.**
 *
 *    تلك الدالّة تفتح لوحةً ثانيةً «اختار من المسودّة»، لأن مسودّةً
 *    عاديّة نصٌّ مختلط: تحليلٌ عربيٌّ وأمثلةٌ روسيّة وعناوين، فلا يصحّ
 *    بناء جلسةٍ من كلّ سطرٍ فيها بلا اختيار. ومسودّةُ الظلّ السريع
 *    **ليست كذلك**: كلُّ ما فيها هو ما لصقتَه أنت الآن. فسؤالُك «اختار
 *    الجمل» بعد أن ضغطتَ «ابدأ» بالفعل ينفي بالضبط ما طلبتَه: أن
 *    تذاكرها **مباشرة**. فتُبنى الجلسةُ هنا بنفس الاستدعاء
 *    (`createSession` بـ`SOURCE_TYPE.STUDY_DRAFT`) بلا لوحةٍ وسيطة.
 */

import { html, raw } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toast, toastOk, toastError } from '../components/toast.js';
import { navigate } from '../router.js';

/**
 * يفتح لوحةَ «ذاكِرها دلوقتي».
 *
 * ⚠️ **والصورةُ تمرّ بمراجعةِ نصّها** كما في «صورة ← ظلّ»: القراءةُ
 *    الآليّة تخطئ في الخطّ اليدويّ، ولا يُبنى تدريبٌ على نصٍّ لم تره.
 */
export async function openQuickShadow() {
  let form = null;
  let picked = null;

  await showModal({
    title: 'ذاكِرها دلوقتي',
    submitLabel: 'ابدأ',
    wide: true,
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3);line-height:1.9">
        الصق نصًّا روسيًّا أو هات صورة — <strong>من غير ما تعمل ذكرى</strong>.
        هتلاقيها بعد كده في «دلوقتي»، وتقدر تضيفها كذكرى وقت ما تحبّ.
      </p>
      <div class="field">
        <textarea name="text" dir="ltr" lang="ru" rows="7"
          placeholder="الصق الروسي هنا…"
          style="font-size:15px;line-height:1.9"></textarea>
      </div>
      <div class="field">
        <button type="button" class="btn btn-ghost" data-quick-img>هات صورة واستخرج نصّها</button>
        <p class="field-hint" data-quick-note></p>
      </div>`,
    onMount(modal) {
      const note = modal.querySelector('[data-quick-note]');
      modal.querySelector('[data-quick-img]').addEventListener('click', async () => {
        const { pickFiles } = await import('../services/media-service.js');
        const files = await pickFiles({ accept: 'image/*', multiple: false });
        if (!files.length) return;
        picked = files[0];
        note.textContent = 'بنقرا الصورة…';
        try {
          const { extractText } = await import('../services/shadow/ocr.js');
          const { text } = await extractText(picked);
          const box = modal.querySelector('[name="text"]');
          box.value = [box.value.trim(), text.trim()].filter(Boolean).join('\n');
          /* ⚠️ النصُّ يُلحَق لا يُستبدَل: قد تكون لصقتَ شيئًا قبلها. */
          note.textContent = text.trim() ? 'اتقرا — راجعه قبل ما تبدأ' : 'مالقيتش نصّ في الصورة';
        } catch (error) {
          note.textContent = `تعذّر استخراج النصّ: ${error.message}`;
        }
      });
    },
    onSubmit(data, close) {
      form = data;
      close();
    },
  });

  if (!form) return;
  const text = (form.text || '').trim();
  if (!text) return toastError('مفيش نصّ نتدرّب عليه');

  const dismiss = toast('بنجهّز…', { duration: 30000 });
  try {
    const {
      openDraft, saveDraftText, addDraftImage, practicableSentences, SUBJECT,
    } = await import('../services/study-draft.js');

    /*
     * ⚠️ **موضوعُ المسودّة أوّلُ سطرٍ لا النصُّ كلُّه.** المفتاحُ يُطبَّع
     *    من الموضوع، ونصٌّ من ألف حرفٍ يصنع مفتاحًا لا يتكرّر أبدًا —
     *    فتفقد المسودّةُ خاصّتَها الأولى: أن تجدها حين تعود للجملة.
     */
    const subject = text.split(/\n/)[0].slice(0, 120).trim() || text.slice(0, 120);
    const created = await openDraft(SUBJECT.SENTENCE, subject, {});
    /*
     * ⚠️ **`draft` هي ما رجع من الحفظ — لا ما رجع من الإنشاء.**
     *    `openDraft` تُنشئ الصفّ بـ`text: ''` ثم `saveDraftText` تكتب
     *    النصّ الحقيقيّ. أوّل نسخةٍ من هذا الكود استمرّت تستعمل
     *    الكائن القديم (`created`) بعد الحفظ، فبقي `draft.text` فارغًا
     *    في الذاكرة رغم أنه صحيحٌ في القاعدة — فلا تُقسَّم منه جملةٌ
     *    واحدة. **قِيس**: `practicableSentences(created)` تُرجع `[]`
     *    دائمًا، والشاشةُ تصمت وتغلق النافذةَ بلا نقلة.
     */
    const draft = await saveDraftText(created.id, text);
    if (picked) {
      try {
        await addDraftImage(draft.id, picked);
      } catch {
        /* الصورةُ زيادةٌ — نصُّها في يدك أصلًا فلا نُفشل التدريب لأجلها */
      }
    }

    /*
     * ⚠️ **جلسةٌ تُبنى هنا مباشرةً — لا عبر `openShadowFromDraft`.**
     *
     *    تلك الدالّة تفتح لوحةً ثانيةً «اختار من المسودّة» لأن مسودّةً
     *    عاديّة نصٌّ مختلط: تحليلٌ عربيٌّ وأمثلةٌ روسيّة وعناوين، فلا
     *    يصحّ بناء جلسةٍ من كلّ سطرٍ فيها بلا اختيار.
     *
     *    ومسودّةُ الظلّ السريع **ليست كذلك**: كلُّ ما فيها هو ما لصقتَه
     *    أنت الآن أو استخرجناه من صورتك للتوّ — لا شرحَ فيها ولا
     *    عناوين. فسؤالُك «اختار الجمل» بعد أن ضغطتَ «ابدأ» بالفعل هو
     *    بالضبط ما نفى عنه بلاغُك: «أذاكرها **مباشرة**».
     */
    const lines = practicableSentences(draft);
    if (!lines.length) {
      dismiss();
      return toastError('مفيش جمل روسي نتدرّب عليها — راجع النصّ');
    }

    const { createSession, SOURCE_TYPE } = await import('../services/shadow/shadow-session-service.js');
    const { session, segments } = await createSession({
      title: draft.subjectText || 'ذاكِرها دلوقتي',
      sourceType: SOURCE_TYPE.STUDY_DRAFT,
      sourceId: draft.id,
      sceneId: null,
      segments: lines.map((line) => ({ text: line.text })),
    });

    dismiss();
    toastOk(`${segments.length} جملة جاهزة`);
    return void navigate(`/shadow/${session.id}`);
  } catch (error) {
    dismiss();
    return toastError(error.message || 'مقدرناش نجهّزها');
  }
}

/**
 * يحوّل مسودّةً بلا ذكرى إلى ذكرى.
 *
 * ⚠️ **ولا تُنسَخ المسودّة — تُنسَب.** النصُّ يصير سكريبتًا في الذكرى
 *    الجديدة، والمسودّةُ تُربَط بها (`sceneId`) فتبقى واحدةً لا اثنتين
 *    تفترقان عند أوّل تعديل.
 */
export async function promoteDraftToScene(draftId) {
  const { studyDrafts } = await import('../db/repositories.js');
  const draft = await studyDrafts.get(draftId);
  if (!draft) return toastError('المسودّة دي مش موجودة');
  if (draft.sceneId) return toastError('دي متسجّلة في ذكرى أصلًا');

  let form = null;
  await showModal({
    title: 'خلّيها ذكرى',
    submitLabel: 'اعملها',
    body: html`
      <div class="field">
        <label for="q-title">اسم الذكرى</label>
        <input id="q-title" name="titleAr" type="text"
          value="${draft.subjectText || 'نصّ خارجي'}" />
      </div>
      <div class="field">
        <label for="q-date">التاريخ</label>
        <input id="q-date" name="date" type="date"
          value="${new Date().toISOString().slice(0, 10)}" />
      </div>
      <p class="field-hint">النصّ هيتحفظ كسكريبت جوّه الذكرى، والمسودّة هتبقى تابعة ليها.</p>`,
    onSubmit(data, close) {
      form = data;
      close();
    },
  });
  if (!form) return undefined;

  try {
    const { createScene } = await import('../services/scene-service.js');
    const { addScript } = await import('../services/content-service.js');
    const scene = await createScene({
      titleAr: (form.titleAr || '').trim() || 'نصّ خارجي',
      date: form.date || new Date().toISOString().slice(0, 10),
    });
    await addScript(scene.id, { title: draft.subjectText || 'نصّ خارجي', text: draft.text || '' });
    await studyDrafts.update(draftId, { sceneId: scene.id });
    toastOk('بقت ذكرى');
    return void navigate(`/scene/${scene.id}`);
  } catch (error) {
    return toastError(error.message || 'مقدرناش نعملها');
  }
}

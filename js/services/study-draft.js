/**
 * LingoLife — مسودّة المذاكرة (WS25)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك بحرفه
 * ═══════════════════════════════════════════════════════════════
 *
 * > «وأنا شغّال على الشادوينج، في الجملة باخدها أدخّلها على شات جيبتي
 * >  يحلّلهالي — عايز بقى نتيجة التحليل بتاع الجملة أو الكلمة يبقى
 * >  فيها حاجة زي **مسودة مذاكرة** كدا أضيف فيها الحاجات دي، ويبقى
 * >  فيه القدرة إني أعمل على جزء منها شادوينج برضو — يعني الجمل اللي
 * >  فيها تتقسم وكدا — وممكن أضيف في المسودة **صورة وأستخرج نصّها**
 * >  برضو.»
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والقرارُ الأوّل: **المسودّة مِلكُ الجملة لا مِلكُ الجلسة**
 * ═══════════════════════════════════════════════════════════════
 *
 * كان أسهلَ أن أربطها بمقطعٍ (`shadowSegments.id`) — المعرّفُ في يدي
 * وقتَ الكتابة. ولكن المقطعَ يموت بموت جلسته: تُعيد بناءَ الجلسة من
 * السكريبت بعد شهر، أو يتغيّر المصدرُ فتُقسَّم من جديد، فتضيع كلُّ
 * مسودّاتك ولا يقول أحدٌ لماذا.
 *
 * والجملةُ نفسُها تبقى. فالمفتاحُ نصُّها **مُطبَّعًا**: تفتحها في أيّ
 * جلسةٍ وأيّ ذكرى فتجد ما كتبتَه عنها. و`sessionId` و`sceneId` يُكتبان
 * لكنهما **سياقٌ لا هُويّة** — «وُلدت هنا»، لا «تعيش هنا».
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ والتطبيعُ مكتوبٌ هنا لا مستوردٌ من البحث
 * ═══════════════════════════════════════════════════════════════
 *
 * تطبيعُ البحث يُسقط علاماتِ الترقيم كلَّها ليجد «الجملة» في «الجملة؟».
 * وهذا صحيحٌ للبحث وخطأٌ هنا: `Я не знаю.` و`Я не знаю?` جملتان
 * تُذاكَران بغير ما تُذاكَر به الأخرى — واحدةٌ خبرٌ والثانية سؤال.
 *
 * فالتطبيعُ هنا **أقلُّ عدوانًا**: مسافاتٌ تُوحَّد، وحالةُ الحروف
 * تُوحَّد، والنبرُ (`́`) يُسقَط لأنه زينةُ عرضٍ لا حرف. وما عدا ذلك
 * يبقى.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولا شبكةَ ولا مفتاح
 * ═══════════════════════════════════════════════════════════════
 *
 * المسودّةُ **صندوقٌ تلصق فيه**، لا وسيطٌ يتكلّم مع ChatGPT. أنت
 * تنسخ الجملة، وتذهب حيث شئت، وتعود باللصق. التطبيقُ لا يرسل شيئًا
 * ولا يحمل مفتاحًا — راجع `docs/12-analysis-request.md`.
 */

import { studyDrafts, media, relationships } from '../db/repositories.js';
import { STATE } from '../db/schema.js';
import { splitSentences } from './shadow/segmenter.js';
import { storeStandaloneImage } from './media-service.js';
import { link } from './link-service.js';

/**
 * موضوعُ المسودّة: جملةٌ أم كلمة.
 *
 * ⚠️ **والفرقُ ليس تزيينًا.** مسودّةُ كلمةٍ يُتوقَّع فيها صرفٌ وحالاتٌ
 *    وأمثلة؛ ومسودّةُ جملةٍ يُتوقَّع فيها تركيبٌ وسياق. والشاشة تقول
 *    أيَّهما تفتح، فلا تخلط ما كتبتَه عن `знать` بما كتبتَه عن جملةٍ
 *    فيها `знаю`.
 */
export const SUBJECT = Object.freeze({
  SENTENCE: 'sentence',
  WORD: 'word',
});

/** نوعُ العلاقة بين المسودّة وصورها. */
export const DRAFT_MEDIA = 'draft:media';

/**
 * مفتاحُ الموضوع — راجع شرح التطبيع أعلى الملفّ.
 *
 * @param {string} text
 * @returns {string}
 */
export function subjectKey(text) {
  return String(text || '')
    .normalize('NFC')
    /* النبرُ علامةُ عرضٍ نضعها نحن — لا فرقَ بين `зна́ю` و`знаю`. */
    .replace(/́/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* ------------------------------------------------------------------ */
/* القراءة                                                             */
/* ------------------------------------------------------------------ */

/**
 * مسودّةُ موضوعٍ إن وُجدت — **بلا إنشاء**.
 *
 * ⚠️ والفرقُ بينها وبين `openDraft` هو نفسُ درسِ `readBlock`/`getBlock`
 *    في `content-service`: القراءةُ التي تكتب تبني صفوفًا فارغة في
 *    القاعدة لكلّ جملةٍ مررتَ عليها. والشاشةُ تمرّ على كلّ جملة.
 *
 * @param {string} kind من `SUBJECT`
 * @param {string} text نصُّ الجملة أو الكلمة
 * @returns {Promise<object|null>}
 */
export async function readDraft(kind, text) {
  const key = subjectKey(text);
  if (!key) return null;
  const rows = await studyDrafts.byIndex('subject_kind', [kind, key]);
  return rows.find((row) => row.state === STATE.ACTIVE) || null;
}

/** هل لهذا الموضوع مسودّة فيها شيء؟ — سؤالُ النقطة على الجملة. */
export async function hasDraft(kind, text) {
  const draft = await readDraft(kind, text);
  if (!draft) return false;
  if (draft.text?.trim()) return true;
  return (await draftImages(draft.id)).length > 0;
}

/** كلُّ مسودّات جلسةٍ — الأحدثُ أوّلًا. */
export async function draftsOfSession(sessionId) {
  const rows = await studyDrafts.byIndex('sessionId', sessionId);
  return rows
    .filter((row) => row.state === STATE.ACTIVE)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/* ------------------------------------------------------------------ */
/* الكتابة                                                             */
/* ------------------------------------------------------------------ */

/**
 * يفتح مسودّةَ موضوعٍ — ويُنشئها إن لم تكن.
 *
 * @param {string} kind من `SUBJECT`
 * @param {string} text نصُّ الجملة أو الكلمة كما يُعرَض
 * @param {{sessionId?: string, sceneId?: string}} [where] سياقُ الميلاد
 */
export async function openDraft(kind, text, where = {}) {
  const key = subjectKey(text);
  if (!key) throw new Error('مفيش جملة ولا كلمة نفتحلها مسودّة');

  const existing = await readDraft(kind, text);
  if (existing) return existing;

  return studyDrafts.create({
    subjectKind: kind,
    subject: key,
    /* النصُّ كما يُعرَض — المفتاحُ مُطبَّعٌ ولا يصلح للقراءة. */
    subjectText: String(text).trim(),
    sessionId: where.sessionId || null,
    sceneId: where.sceneId || null,
    text: '',
    updatedAt: Date.now(),
  });
}

/** يحفظ نصَّ المسودّة كما هو — بلا تنظيفٍ ولا تقسيم. */
export async function saveDraftText(draftId, text) {
  return studyDrafts.update(draftId, {
    text: String(text ?? ''),
    updatedAt: Date.now(),
  });
}

/**
 * يُلحق نصًّا بآخر المسودّة بدل أن يستبدلها.
 *
 * ⚠️ **والإلحاقُ لا الاستبدال** لأن مصادرَ المسودّة تتراكم: تحليلُ
 *    ChatGPT، ثم نصٌّ من صورة، ثم ملاحظةٌ بيدك. ودالّةٌ تستبدل تمحو
 *    ما قبلها بلا سؤال — وهو أوّلُ ما سيحدث حين تضغط «استخرج النصّ»
 *    وأنت ناسٍ أن في المسودّة شيئًا.
 */
export async function appendDraftText(draftId, addition, heading = '') {
  const draft = await studyDrafts.get(draftId);
  if (!draft) throw new Error('المسودّة دي مش موجودة');

  const piece = [heading, String(addition || '').trim()].filter(Boolean).join('\n');
  if (!piece) return draft;

  const merged = [draft.text?.trim(), piece].filter(Boolean).join('\n\n');
  return saveDraftText(draftId, merged);
}

/* ------------------------------------------------------------------ */
/* الصور                                                               */
/* ------------------------------------------------------------------ */

/**
 * يضيف صورةً للمسودّة.
 *
 * ⚠️ والبايتاتُ في `media` كباقي صور التطبيق، والعضويّةُ **علاقة**
 *    بنوع `draft:media`. فالنسخةُ الاحتياطيّة تأخذها بلا أن تتعلّم
 *    شيئًا جديدًا، وحذفُ المسودّة لا يمسّ صورةً قد تكون في ذكرى.
 */
export async function addDraftImage(draftId, file) {
  const record = await storeStandaloneImage(file, { kind: 'image' });
  await link(draftId, record.id, DRAFT_MEDIA);
  return record;
}

/** صورُ المسودّة بترتيب إضافتها. */
export async function draftImages(draftId) {
  const rows = await relationships.byIndex('from_kind', [draftId, DRAFT_MEDIA]);
  const live = rows.filter((row) => row.state === STATE.ACTIVE);
  const found = await media.getMany(live.map((row) => row.toId));
  /* ⚠️ صورةٌ حُذفت تختفي من القائمة ولا تُسقط الشاشة. */
  return found.filter(Boolean);
}

/**
 * يستخرج نصَّ صورةٍ ويُلحقه بالمسودّة.
 *
 * ⚠️ **ولا يُستبدَل شيء ولا تُمسّ الصورة**: نفسُ عهد `openShadowFromImage`
 *    — البايتاتُ كما رُفعت، والمستخرَجُ محتوًى مشتقٌّ يُضاف.
 *
 * ⚠️ **ولا مراجعةَ إجباريّة هنا** — بخلاف مدخل «صورة ← ظلّ». وهناك
 *    فرق: هناك يصير النصُّ **مادّةَ تدريب** فيُنطَق بأخطائه؛ وهنا
 *    يقع في **مسودّة** أنت تحرّرها بيدك على أيّ حال. فنافذةُ مراجعةٍ
 *    قبل اللصق في صندوقٍ قابلٍ للتحرير خطوةٌ بلا مقابل.
 *
 * @returns {Promise<{text: string, draft: object}>}
 */
export async function ocrIntoDraft(draftId, mediaId, { onProgress } = {}) {
  const record = await media.get(mediaId);
  if (!record?.blob) throw new Error('الصورة دي مش موجودة');

  const { extractText } = await import('./shadow/ocr.js');
  const result = await extractText(record.blob, { onProgress });
  const text = (result?.text || '').trim();

  if (!text) throw new Error('مالقيتش نصّ في الصورة دي');

  const draft = await appendDraftText(draftId, text, `— نصّ من صورة: ${record.filename || ''} —`);
  return { text, draft };
}

/* ------------------------------------------------------------------ */
/* الجمل — «أعمل على جزء منها شادوينج»                                 */
/* ------------------------------------------------------------------ */

/**
 * جملُ المسودّة — **مُشتقّةٌ عند الطلب لا مخزَّنة**.
 *
 * ⚠️ نفسُ قرار أشرطة المنابع: التقسيمُ اشتقاقٌ من النصّ، فتخزينُه
 *    نسخةٌ ثانيةٌ تتقادم كلّما حرّرتَ المسودّة.
 *
 * ⚠️ **ويُصفَّى ما لا يصلح للنطق.** تحليلُ ChatGPT عربيٌّ في معظمه:
 *    شروحٌ وترجماتٌ وعناوين. والذي تتدرّب عليه هو **الروسيّ** منه.
 *    فالمُقسِّم يعطي كلَّ شيء، وهذه تعلّم كلَّ سطرٍ هل فيه سيريليّة
 *    — ولا تحذف شيئًا، بل تقول `ru` لكلّ جملة فتختار أنت على علم.
 *
 * @param {object|string} draftOrText
 * @returns {{text: string, ru: boolean}[]}
 */
export function draftSentences(draftOrText) {
  const text = typeof draftOrText === 'string' ? draftOrText : draftOrText?.text || '';
  /*
   * ⚠️ **و`requireCyrillic: false` قصدًا** — وهو خلافُ كلّ نداءٍ آخر
   *    لهذه الدالّة في التطبيق.
   *
   *    المُقسِّم يُسقط ما لا سيريليّةَ فيه، لأن نداءاته الأخرى تبني
   *    **مقاطعَ تُنطَق** فسطرٌ عربيٌّ فيها خطأ. وهنا نبني **عرضًا
   *    للمسودّة كلِّها**: أنت طلبتَ أن «الجمل اللي فيها تتقسم»، وجملُ
   *    المسودّة عربيّةٌ في معظمها. فلو أسقطناها لرأيتَ سطرين من
   *    عشرين وظننتَ التقسيمَ مكسورًا.
   *
   *    والفرزُ يقع في `ru` لا في الحذف: تُعرَض كلُّها، ويُؤشَّر
   *    الصالحُ للنطق وحده.
   */
  return splitSentences(text, { requireCyrillic: false }).map((line) => ({
    text: line,
    ru: /[Ѐ-ӿ]/.test(line),
  }));
}

/**
 * الجملُ الروسيّة وحدها — ما يصلح أن يكون مادّةَ ظلّ.
 *
 * تُستعمل في الاقتراح الأوّل: تُفتَح النافذة والروسيُّ مؤشَّرٌ والعربيُّ
 * لا — لأن هذا هو المقصود في تسع مرّاتٍ من عشر، ويبقى لك تغييرُه.
 */
export function practicableSentences(draftOrText) {
  return draftSentences(draftOrText).filter((line) => line.ru);
}

/* ------------------------------------------------------------------ */
/* السلّة                                                              */
/* ------------------------------------------------------------------ */

/** يرمي مسودّةً في السلّة — تُستعاد منها كأيّ شيء آخر. */
export async function trashDraft(draftId) {
  return studyDrafts.trash(draftId);
}

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
import { parseBilingual } from './shadow/bilingual.js';
import { translationView, looksDraft } from './shadow/draft-structure.js';
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

/**
 * أيُّ هذه النصوص له مسودّة؟ — **سؤالٌ واحدٌ لا سؤالٌ لكلّ جملة** (WS34).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ بلاغُك: «خلّي اللي أضيفه في المسودّة يبقى متلينك مع الجملة،
 *    ووقت ما أجي أعملها شادوينج في أيّ وقت يقول لي إن ليها مسودّة»
 * ═══════════════════════════════════════════════════════════════
 *
 * والربطُ كان موجودًا من أوّل يوم — المسودّةُ مفتاحُها نصُّ الجملة
 * مُطبَّعًا، فهي تتبع الجملةَ عبر الجلسات كلِّها. **الناقصُ أن تراه**:
 * كتبتَ `hasDraft` لأجل «النقطة على الجملة» ثم لم تُرسَم النقطةُ قطّ،
 * فصار الربطُ حقيقةً في القاعدة وغيبًا على الشاشة. ومَن لا يرى أثرَ
 * ما كتبه يظنّه ضاع.
 *
 * ⚠️ **ولا تُنادى `hasDraft` لكلّ جملة**: جلسةٌ فيها ستّون جملةً تعني
 *    ستّين رحلةً إلى القاعدة عند كلّ رسم. فمرورٌ واحدٌ يبني المجموعة.
 *
 * @param {string} kind من `SUBJECT`
 * @param {string[]} texts نصوصُ الجمل كما تُعرَض
 * @returns {Promise<Set<string>>} مفاتيحُ ما له مسودّة (من `subjectKey`)
 */
export async function draftedKeys(kind, texts) {
  const wanted = new Set((texts || []).map(subjectKey).filter(Boolean));
  const found = new Set();
  if (!wanted.size) return found;

  /* الحقلان `subjectKind` و`subject` — لا `kind` ولا `subjectKey`. */
  const rows = (await studyDrafts.byIndex('subjectKind', kind)).filter(
    (row) => row.state === STATE.ACTIVE && wanted.has(row.subject)
  );

  /*
   * ⚠️ **ومسودّةٌ فارغةٌ ليست مسودّة.** الصفُّ يُنشأ عند أوّل صورةٍ
   *    تُضاف حتى قبل أن تكتب حرفًا، فلو عدّدنا الصفوفَ وحدها لظهرت
   *    النقطةُ على جملةٍ لا شيء فيها — وهو كذبٌ صغيرٌ يُفقد النقطةَ
   *    معناها كلَّه.
   */
  for (const row of rows) {
    if (row.text?.trim()) {
      found.add(row.subject);
      continue;
    }
    if ((await draftImages(row.id)).length) found.add(row.subject);
  }

  return found;
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
  const { cleanExtractedText } = await import('./shadow/text-cleanup.js');
  const result = await extractText(record.blob, { onProgress });
  /* ⚠️ تنظيفٌ قبل المراجعة اليدويّة لا بديلًا عنها (بند 9، WS40). */
  const text = cleanExtractedText(result?.text || '');

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
/* الأزواج الثنائيّة: روسيٌّ ↔ عربيّ (WS-D)                             */
/* ------------------------------------------------------------------ */

/**
 * أزواجُ المسودّة — **المحفوظُ إن وُجد، وإلّا فقراءةٌ بنيويّةٌ الآن**.
 *
 * ⚠️ **ولماذا حقلٌ محفوظٌ أصلًا ما دام الاشتقاقُ ممكنًا؟**
 *
 *    لأن **الإصلاحَ اليدويَّ لا يُشتَقّ**. المحلّلُ يقرأ البنيةَ فيصيب
 *    غالبًا؛ وحين يخطئ تُصلحه أنت (بند ٢٠) — ولو كان كلُّ شيءٍ
 *    مشتقًّا لضاع إصلاحُك عند أوّل إعادة قراءة، ولوجدتَ نفسك تُصلح
 *    نفسَ الزوج كلّ مرّة.
 *
 * ⚠️ **وحقلٌ جديدٌ بلا ترقية** (بند ٢١): سجلّاتُ المسودّات القديمة لا
 *    تحمل `pairs`، وقارئُها هنا يسأل «هل هي موجودة؟» لا «ما قيمتها؟»
 *    — فتُشتَقّ لها عند أوّل قراءة. ولا مخزنَ جديدٌ ولا هجرةَ بيانات.
 *
 * @param {object|string} draftOrText
 * @returns {object[]} وحداتُ `bilingual.parseBilingual`
 */
export function draftPairs(draftOrText) {
  if (typeof draftOrText !== 'string' && Array.isArray(draftOrText?.pairs)) {
    return draftOrText.pairs;
  }
  const text = typeof draftOrText === 'string' ? draftOrText : draftOrText?.text || '';
  /* ⚠️ الوعيُ بالقالب يُقرَّر من النصّ نفسِه — راجع `looksDraft`. */
  return parseBilingual(text, { draft: looksDraft(text) }).units;
}

/**
 * إعادةُ قراءةِ المسودّة بعد تغيُّر نصِّها — **بحفظ تصحيحاتك** (بند ٤٠).
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ لماذا لا يُعاد التحليلُ من تلقائه
 * ═══════════════════════════════════════════════════════════════
 *
 * `draftPairs` تُفضّل المحفوظَ على المشتقّ، وهذا مقصودٌ منذ WS-D: ما
 * أصلحتَه بيدك لا يُشتَقّ. ولكنّك قد تُلحق تحليلًا جديدًا بالمسودّة،
 * فيصير المحفوظُ أقدمَ من نصِّه.
 *
 * فإعادةُ القراءة **فعلٌ صريحٌ تطلبه أنت**، وهي:
 *
 *   · تقرأ النصَّ الحاليَّ من جديد،
 *   · ثمّ تُعيد إلى كلّ وحدةٍ ما أصلحتَه فيها سابقًا — **بمطابقة
 *     النصّ الروسيّ**، وهو أثبتُ هُويّةٍ متاحةٍ هنا،
 *   · وتقول لك بالعدد كم تصحيحًا نجا وكم سقط.
 *
 * ⚠️ **ولا تُطابَق بالفهرس أبدًا.** سطرٌ يُضاف في الأعلى يزيح كلَّ ما
 *    بعده، فتنتقل تصحيحاتُك إلى وحداتٍ ليست لها — وهو إفسادٌ صامتٌ
 *    أسوأُ من الفقد الصريح.
 *
 * @param {object} draft صفُّ المسودّة
 * @returns {{units: object[], kept: number, lost: number}}
 */
export function reparseDraft(draft) {
  const text = draft?.text || '';
  const fresh = parseBilingual(text, { draft: looksDraft(text) }).units;
  const old = Array.isArray(draft?.pairs) ? draft.pairs : [];

  /* تصحيحاتُك وحدها — لا كلُّ وحدةٍ قديمة. */
  const edits = new Map();
  for (const one of old) {
    const key = (one.ru || '').trim();
    if (!key) continue;
    /*
     * ⚠️ **و`primary: 0` ليس اختيارًا** — هو الافتراض. كشفه اختبارُ ١٣:
     *    كنتُ أعدّ كلَّ رقمٍ صحيحٍ «تصحيحًا»، فيُحسَب الصفرُ اختيارًا
     *    ويُبلَّغ عن تصحيحاتٍ نجت ولم تكن موجودةً أصلًا. و`saveDraftPairs`
     *    نفسُها لا تحفظ إلّا `> 0` — فالمقياسان يتّفقان الآن.
     */
    if (one.manual || (Number.isInteger(one.primary) && one.primary > 0)) edits.set(key, one);
  }

  let kept = 0;
  const units = fresh.map((one) => {
    const was = edits.get((one.ru || '').trim());
    if (!was) return one;
    kept += 1;
    return {
      ...one,
      ...(was.manual ? { ar: was.ar, manual: true } : {}),
      ...(Number.isInteger(was.primary) && was.primary > 0 ? { primary: was.primary } : {}),
    };
  });

  return { units, kept, lost: edits.size - kept };
}

/**
 * يحفظ الأزواجَ بعد مراجعتك — **ولا يلمس نصَّ المسودّة** (بند ١٨).
 *
 * ⚠️ **الخامُ يبقى.** `text` هو ما لصقتَه أو استُخرج، و`pairs` قراءتُنا
 *    البنيويّةُ له بعد تصحيحك. فلو أخطأ المحلّلُ غدًا في نمطٍ جديد
 *    استطعتَ أن ترى الأصلَ وتقارن — وهو ما يمنعه حذفُ الخام.
 */
export async function saveDraftPairs(draftId, pairs) {
  return studyDrafts.update(draftId, {
    pairs: (pairs || []).map((one) => ({
      ru: one.ru || '',
      ar: one.ar || '',
      status: one.status,
      ...(one.manual ? { manual: true } : {}),
      /*
       * ⚠️ **وما يُهمَل هنا يضيع** (WS-DR). كانت هذه الدالّةُ تُسقط كلَّ
       *    حقلٍ عدا الأربعةِ الأولى، فكان الحفظُ يمحو دورَ الوحدة:
       *    «شرح» و«عنوان قسم» و«قالب» تعود كلُّها بلا هُويّةٍ بعد أوّل
       *    مراجعةٍ تحفظها — فيرجع الإنذارُ الكاذبُ من باب الحفظ.
       *
       * ⚠️ **ولا حقلَ جديدٌ في المخطَّط** (بند ٤٤): `pairs` مصفوفةٌ حرّةٌ
       *    على الصفّ منذ WS-D. وهذه إضافةُ مفاتيحَ داخلها، لا عمودٌ
       *    جديدٌ ولا هجرة.
       */
      ...(one.section ? { section: one.section } : {}),
      ...(one.raw ? { raw: one.raw } : {}),
      ...(one.prompt ? { prompt: true } : {}),
      /* اختيارُك للترجمة الأساسيّة من البدائل (بند ٨) — رقمٌ لا نصّ. */
      ...(Number.isInteger(one.primary) && one.primary > 0 ? { primary: one.primary } : {}),
    })),
    updatedAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ */
/* بدائلُ الترجمة واختيارُ الأساسيّة (بنود ٦ و٨ و٣٨)                    */
/* ------------------------------------------------------------------ */

/**
 * قراءةُ ترجمةِ وحدةٍ: الأساسيّةُ والبدائل.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الاشتقاقُ عند القراءة — ولا تُلمَس بايتةٌ في القاعدة**
 * ═══════════════════════════════════════════════════════════════
 *
 * المخزَّنُ يبقى كما لصقتَه: «إثبات / تأكيد» سلسلةً واحدة. والبدائلُ
 * تُقرأ منها في كلّ مرّة. فمسودّاتُك القديمةُ كلُّها تفهم نفسَها فورًا
 * بلا ترقيةٍ ولا هجرة — وهو ما يطلبه البندُ ٦ صراحةً: «إن كان التخزينُ
 * الحاليُّ لا يمثّل مصفوفة، احفظه بأمانٍ واشتقّ البدائل عند القراءة».
 *
 * ⚠️ **و`primary` رقمٌ لا نصّ.** لو خزّنّا النصَّ المفضَّل لصار نسخةً
 *    ثانيةً تتقادم عند أوّل تصحيحٍ إملائيٍّ في الأصل. والرقمُ يشير،
 *    ولا يكرّر.
 *
 * @param {{ar?: string, primary?: number}} pair
 */
export function pairTranslation(pair) {
  return translationView(pair?.ar || '', pair?.primary || 0);
}

/**
 * يختار البديلَ الأساسيَّ لوحدةٍ — **بلا حذفِ الباقي** (بند ٣٨).
 *
 * ⚠️ **وهذا تفضيلُ عرضٍ لا حكمٌ لغويّ.** «إثبات» و«تأكيد» كلتاهما
 *    صحيحة، وأنت تختار ما يخدم سياقَ تدريبك الآن. والبدائلُ تبقى
 *    كاملةً في `ar`، فتغيّر رأيَك غدًا بلا خسارة.
 *
 * @param {object[]} pairs
 * @param {number} at فهرسُ الوحدة
 * @param {number} choice فهرسُ البديل داخل ترجمتها
 */
export function choosePrimary(pairs, at, choice) {
  return (pairs || []).map((one, i) => {
    if (i !== at) return one;
    const view = translationView(one.ar || '', 0);
    if (choice < 0 || choice >= view.all.length) return one;
    return { ...one, primary: choice };
  });
}

/* ------------------------------------------------------------------ */
/* السلّة                                                              */
/* ------------------------------------------------------------------ */

/** يرمي مسودّةً في السلّة — تُستعاد منها كأيّ شيء آخر. */
export async function trashDraft(draftId) {
  return studyDrafts.trash(draftId);
}

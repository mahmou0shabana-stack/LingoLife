/**
 * LingoLife — اختبارات مسودّة المذاكرة (WS25)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الحارسان الحقيقيّان هنا اثنان
 * ═══════════════════════════════════════════════════════════════
 *
 *  1. **«القراءة لا تكتب».** الشاشة تنادي `readDraft` على كلّ جملةٍ
 *     تمرّ عليها. فلو كتبت — كما فعلت `getBlock` في WS15 — لبنيتَ
 *     صفًّا فارغًا لكلّ جملةٍ في كلّ جلسة. والاختبار يعدّ الصفوف قبل
 *     وبعد، فلا يمرّ الرجوعُ إلى ذلك السلوك بصمت.
 *
 *  2. **«المسودّة تنجو من الجلسة».** وهو سببُ وجود المفتاح النصّي
 *     أصلًا. يُختبَر بجلستين مختلفتين على نفس الجملة.
 *
 * وباقي الاختبارات تصف سلوكًا كتبتُه للتوّ فأعرفه.
 */

import { describe, it, expect } from './test-runner.js';
import {
  SUBJECT, DRAFT_MEDIA, subjectKey,
  readDraft, openDraft, saveDraftText, appendDraftText,
  addDraftImage, draftImages, draftSentences, practicableSentences,
  hasDraft, draftsOfSession, trashDraft,
} from '../js/services/study-draft.js';
import { studyDrafts, relationships, media } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { TRASHABLE, NOT_TRASHABLE } from '../js/services/trash-service.js';
import { SOURCE_TYPE, SOURCE_LABEL } from '../js/services/shadow/shadow-session-service.js';

/* ------------------------------------------------------------------ *
 * ماسحُ التعليقات — يقرأ الكود لا النثر
 * ------------------------------------------------------------------ *
 *
 * ⚠️ **وكتبتُه ماسحًا حقيقيًّا لا `replace` واحدة.** كانت الحُرّاسُ
 *    كلُّها تنزع التعليقات بـ`/\/\*[\s\S]*?\*\//g` — وهي تكفي حتى
 *    يوجد في الملفّ سطرٌ فيه:
 *
 *        pickFiles({ accept: 'image/*', ... })
 *
 *    فالـ`/*` **داخل السلسلة** يفتح تعليقًا وهميًّا يبتلع كلَّ ما
 *    بعده حتى أوّل `*​/` حقيقيّ — فابتلع في حالتنا نصفَ المُوزِّع،
 *    فأبلغ حارسٌ عن ستّة أزرارٍ «بلا معالِج» وأربعةٌ منها سليمة.
 *
 *    وحارسٌ يصرخ في الصواب أسوأُ من لا حارس: هو أوّلُ ما يُعلَّم
 *    الناسُ تجاهلَه. فصار المسحُ يعرف السلاسل والقوالبَ والمحارفَ
 *    المهروبة.
 */
function codeOnly(src) {
  let out = '';
  let i = 0;
  let quote = null;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (quote) {
      if (ch === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (ch === quote) quote = null;
      out += ch; i += 1; continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; out += ch; i += 1; continue; }

    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }

    out += ch; i += 1;
  }
  return out;
}

/** يمسح كلّ المسودّات — لا نبني على بقايا اختبارٍ سابق. */
async function wipe() {
  for (const row of await studyDrafts.getAll()) await studyDrafts.destroy(row.id);
}

describe('مسودّة المذاكرة · المفتاح', () => {
  it('المسافاتُ تُوحَّد وحالةُ الحروف تُوحَّد', () => {
    expect(subjectKey('  Я   НЕ  знаю ')).toBe('я не знаю');
  });

  it('⚠️ والنبرُ يسقط — لأنه زينةُ عرضٍ نضعها نحن لا حرفٌ كتبه أحد', () => {
    expect(subjectKey('зна́ю')).toBe(subjectKey('знаю'));
  });

  it('⚠️ وعلامةُ الاستفهام تبقى — خبرٌ وسؤالٌ يُذاكَران بغير ما يُذاكَر به الآخر', () => {
    expect(subjectKey('Я не знаю.') === subjectKey('Я не знаю?')).toBe(false);
  });

  it('والفراغُ مفتاحٌ فارغ — فلا مسودّةَ له', async () => {
    expect(subjectKey('   ')).toBe('');
    expect(await readDraft(SUBJECT.SENTENCE, '  ')).toBe(null);
  });
});

describe('مسودّة المذاكرة · القراءة لا تكتب', () => {
  it('⚠️ الحارس: readDraft على جملةٍ بلا مسودّة لا تبني صفًّا', async () => {
    await wipe();
    const before = (await studyDrafts.getAll()).length;

    for (const text of ['Раз.', 'Два.', 'Три.', 'Четыре.', 'Пять.']) {
      expect(await readDraft(SUBJECT.SENTENCE, text)).toBe(null);
    }

    const after = (await studyDrafts.getAll()).length;
    expect(after).toBe(before);
  });

  it('و`openDraft` تكتب — مرّةً واحدةً لا مرّتين', async () => {
    await wipe();
    const first = await openDraft(SUBJECT.SENTENCE, 'Я тебя понимаю.');
    const again = await openDraft(SUBJECT.SENTENCE, 'я  ТЕБЯ понимаю.');
    expect(again.id).toBe(first.id);
    expect((await studyDrafts.getAll()).length).toBe(1);
  });

  it('والجملةُ والكلمةُ موضوعان مختلفان ولو تطابق النصّ', async () => {
    await wipe();
    const sentence = await openDraft(SUBJECT.SENTENCE, 'знаю');
    const word = await openDraft(SUBJECT.WORD, 'знаю');
    expect(word.id === sentence.id).toBe(false);
  });
});

describe('مسودّة المذاكرة · تنجو من الجلسة', () => {
  it('⚠️ الحارس: جملةٌ فُتحت مسودّتُها في جلسة تُوجَد في جلسةٍ ثانية', async () => {
    await wipe();
    const born = await openDraft(SUBJECT.SENTENCE, 'Мне очень приятно.', {
      sessionId: 'SHS_OLD_SESSION',
      sceneId: 'SC_OLD',
    });
    await saveDraftText(born.id, 'приятно = مبسوط');

    /* جلسةٌ أخرى تمامًا، نفسُ الجملة. */
    const found = await readDraft(SUBJECT.SENTENCE, 'Мне очень приятно.');
    expect(found.id).toBe(born.id);
    expect(found.text).toBe('приятно = مبسوط');
  });

  it('و`sessionId` سياقُ ميلادٍ لا هُويّة — يُقرأ منه ولا يُقيَّد به', async () => {
    await wipe();
    await openDraft(SUBJECT.WORD, 'связь', { sessionId: 'SHS_A' });
    await openDraft(SUBJECT.WORD, 'путь', { sessionId: 'SHS_A' });
    await openDraft(SUBJECT.WORD, 'дом', { sessionId: 'SHS_B' });

    expect((await draftsOfSession('SHS_A')).length).toBe(2);
    expect((await draftsOfSession('SHS_B')).length).toBe(1);
  });
});

describe('مسودّة المذاكرة · الإلحاق لا الاستبدال', () => {
  it('⚠️ نصٌّ ثانٍ يُضاف تحت الأوّل — ولا يمحوه', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.SENTENCE, 'Как дела?');
    await saveDraftText(draft.id, 'تحليل من الشات');
    const merged = await appendDraftText(draft.id, 'نصّ من صورة', '— من صورة —');

    expect(merged.text.includes('تحليل من الشات')).toBe(true);
    expect(merged.text.includes('نصّ من صورة')).toBe(true);
    expect(merged.text.indexOf('تحليل') < merged.text.indexOf('نصّ من صورة')).toBe(true);
  });

  it('وإلحاقُ فراغٍ لا يفعل شيئًا — ولا يضيف أسطرًا بيضاء', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.SENTENCE, 'Хорошо.');
    await saveDraftText(draft.id, 'أوكي');
    const same = await appendDraftText(draft.id, '   ');
    expect(same.text).toBe('أوكي');
  });
});

describe('مسودّة المذاكرة · الجمل', () => {
  const MIXED = 'تحليل الجملة:\nЯ не знаю. Он придёт завтра.\nالمعنى: مش عارف.';

  it('التقسيمُ مُشتقٌّ عند الطلب لا مخزَّن', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.SENTENCE, 'Я не знаю.');
    await saveDraftText(draft.id, MIXED);

    const stored = await studyDrafts.get(draft.id);
    /* ⚠️ لا حقلَ `sentences` في الصفّ — لو وُجد لتقادم مع أوّل تعديل. */
    expect(stored.sentences).toBe(undefined);
    expect(draftSentences(stored).length > 1).toBe(true);
  });

  it('⚠️ وكلُّ جملةٍ تقول هل فيها روسي — ولا تُحذف العربيّة', () => {
    const lines = draftSentences(MIXED);
    expect(lines.some((line) => line.ru)).toBe(true);
    expect(lines.some((line) => !line.ru)).toBe(true);
    /* لا حذف: العربيُّ حاضرٌ ليؤشَّر إن أردتَه. */
    expect(lines.length > practicableSentences(MIXED).length).toBe(true);
  });

  it('والصالحُ للتدريب هو الروسيُّ وحده', () => {
    const ru = practicableSentences(MIXED);
    expect(ru.length > 0).toBe(true);
    expect(ru.every((line) => /[Ѐ-ӿ]/.test(line.text))).toBe(true);
  });
});

describe('مسودّة المذاكرة · الصور', () => {
  it('الصورةُ تُخزَّن في media والعضويّةُ علاقة — لا حقلَ mediaId', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.WORD, 'окно');
    const file = new File([new Uint8Array([1, 2, 3])], 'ана.png', { type: 'image/png' });
    const stored = await addDraftImage(draft.id, file);

    expect(stored.id.startsWith('MED_')).toBe(true);
    const row = await studyDrafts.get(draft.id);
    expect(row.mediaId).toBe(undefined);

    const links = await relationships.byIndex('from_kind', [draft.id, DRAFT_MEDIA]);
    expect(links.length).toBe(1);

    const back = await draftImages(draft.id);
    expect(back.map((r) => r.id)).toEqual([stored.id]);

    await media.destroy(stored.id);
  });

  it('⚠️ وصورةٌ حُذفت تختفي من القائمة ولا تُسقط الشاشة', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.WORD, 'дверь');
    const file = new File([new Uint8Array([9])], 'x.png', { type: 'image/png' });
    const stored = await addDraftImage(draft.id, file);

    await media.destroy(stored.id);
    expect(await draftImages(draft.id)).toEqual([]);
  });
});

describe('مسودّة المذاكرة · السلّة وما يُقال عنها', () => {
  it('⚠️ المسودّة تدخل السلّة — تحليلٌ لصقتَه ليس له نسخةٌ ثانية', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.SENTENCE, 'До свидания.');
    await saveDraftText(draft.id, 'وداعًا');
    await trashDraft(draft.id);

    const row = await studyDrafts.get(draft.id);
    expect(row.state).toBe(STATE.TRASHED);
    /* والمرميّةُ لا تُقرأ كأنها حيّة. */
    expect(await readDraft(SUBJECT.SENTENCE, 'До свидания.')).toBe(null);

    await studyDrafts.restore(draft.id);
    expect((await readDraft(SUBJECT.SENTENCE, 'До свидания.')).id).toBe(draft.id);
  });

  it('و`studyDrafts` مسجَّلٌ في سجلّ السلّة لا مستثنًى', () => {
    const inTrash = TRASHABLE.some((kind) => kind.store === 'studyDrafts');
    expect(inTrash).toBe(true);
    expect('studyDrafts' in NOT_TRASHABLE).toBe(false);
  });

  it('⚠️ ونوعُ المصدر الجديد له وصفٌ يقول إن النصّ كتابتُك أنت', () => {
    const spec = SOURCE_LABEL[SOURCE_TYPE.STUDY_DRAFT];
    expect(Boolean(spec)).toBe(true);
    /* التحذيرُ مكتوبٌ لا مفترَض — كما في نصّ الصورة. */
    expect(Boolean(spec.caution)).toBe(true);
  });
});

describe('مسودّة المذاكرة · هل فيها شيء', () => {
  it('مسودّةٌ فارغةٌ ليست مسودّة — فلا نقطةَ على جملةٍ لم تكتب فيها', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.SENTENCE, 'Ничего.');
    expect(await hasDraft(SUBJECT.SENTENCE, 'Ничего.')).toBe(false);

    await saveDraftText(draft.id, 'حاجة');
    expect(await hasDraft(SUBJECT.SENTENCE, 'Ничего.')).toBe(true);
  });

  it('وصورةٌ بلا نصٍّ تكفي — الصورةُ محتوًى لا زينة', async () => {
    await wipe();
    const draft = await openDraft(SUBJECT.WORD, 'стол');
    expect(await hasDraft(SUBJECT.WORD, 'стол')).toBe(false);

    const file = new File([new Uint8Array([7])], 'y.png', { type: 'image/png' });
    const stored = await addDraftImage(draft.id, file);
    expect(await hasDraft(SUBJECT.WORD, 'стол')).toBe(true);

    await media.destroy(stored.id);
  });
});

/* ================================================================== *
 * السكّة الجانبية (WS26) — تُقرأ من المصدر لا من نسخةٍ هنا
 * ================================================================== *
 *
 * ⚠️ `shadow-view.js` وحدةُ شاشةٍ تمسّ الـDOM عند التحميل، فلا تُستورَد
 *    في مجموعةٍ تعمل بلا شاشة. فالحارسُ يقرأ **مصدرها** — نفسُ ما
 *    يفعله `places.test.js` مع `app.js`، ولنفس السبب: قائمةٌ منسوخةٌ
 *    هنا تتقادم بصمت، وهي بالضبط ما يزعم الاختبار أنه يمنعه.
 */
describe('سكّة الأدوات · لا بابَ في اتّجاهٍ واحد', () => {
  let source = '';

  it('⚠️ الحارس: لا «سياق» يُكتَب في السكّة — القائمة تُشتَقّ من الحال', async () => {
    source = await (await fetch('/js/views/shadow-view.js')).text();

    /*
     * كان `rail.ctx = 'word'` يُكتَب ولا يُمحى، فتضيع أدواتُ التشغيل
     * إلى آخر الجلسة. **قِستُه في متصفّح.** فلا يعود حقلٌ بهذا المعنى.
     */
    /*
     * ⚠️ **والتعليقاتُ تُنزَع قبل البحث.** أوّلُ مرّةٍ شغّلتُه سقط —
     *    على **شرحي أنا** للعيب في رأس `TOOLS`. حارسٌ يقرأ النثرَ
     *    كأنه كودٌ يمنعك من أن تكتب لماذا أصلحتَ الشيء.
     */
    const code = codeOnly(source);

    const writes = code.match(/rail\.ctx\s*=/g) || [];
    expect(writes).toEqual([]);
  });

  it('وكلُّ أداةٍ في السجلّ لها رمزٌ ولافتة', () => {
    const block = source.slice(source.indexOf('const TOOLS = ['));
    const ids = [...block.slice(0, block.indexOf('\n];')).matchAll(/id: '([a-z-]+)'/g)]
      .map((hit) => hit[1]);
    expect(ids.length > 8).toBe(true);
    /* لا معرّفَ مكرّرًا: زرّان بنفس المعرّف يفتحان نفس اللوحة مرّتين. */
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('⚠️ وأدواتُ الكلمة كلُّها مشروطةٌ بوجود كلمة — لا زرَّ يعمل على فراغ', () => {
    const block = source.slice(source.indexOf('const TOOLS = ['));
    const body = block.slice(0, block.indexOf('\n];'));
    for (const id of ['hear', 'save', 'hard', 'meaning']) {
      const line = body.split('\n').find((row) => row.includes(`id: '${id}'`));
      expect(Boolean(line && line.includes('when:'))).toBe(true);
    }
  });

  it('⚠️ وكلُّ مرفوضٍ من السكّة بسببٍ مكتوبٍ لا بحذفٍ صامت', () => {
    const block = source.slice(source.indexOf('const NOT_IN_RAIL = '));
    const body = block.slice(0, block.indexOf('});'));
    const reasons = [...body.matchAll(/:\s*'([^']*)'/g)].map((hit) => hit[1]);
    expect(reasons.length > 0).toBe(true);
    expect(reasons.filter((why) => why.trim().length < 15)).toEqual([]);
  });

  it('ولا سجلَّ `TOOLSETS` بعد — القائمتان الميّتتان راحتا', () => {
    expect(source.includes('const TOOLSETS')).toBe(false);
  });
});

/* ================================================================== *
 * التشغيل — حُرّاسٌ على أعطالٍ بلّغ عنها المستعمِل (WS27)
 * ================================================================== *
 *
 * ⚠️ كلُّ واحدٍ هنا يحرس **عطلًا وقع فعلًا** وقِيس في متصفّح، لا
 *    احتمالًا تخيّلتُه. والقراءة من مصدر الشاشة لأنها وحدةُ DOM لا
 *    تُستورَد في مجموعةٍ بلا شاشة — نفسُ نهج `places.test.js`.
 */
describe('التشغيل · لا بابين لفعلٍ واحد', () => {
  let code = '';

  it('⚠️ الحارس: نقرةُ الكلمة لا تقلب وضعَ التدريب', async () => {
    const source = await (await fetch('/js/views/shadow-view.js')).text();
    code = codeOnly(source);

    /*
     * كان معالِجٌ ثانٍ للنقرة يكتب `practiceMode: PRACTICE_MODE.WORD`
     * ولا يعيدها أبدًا، فيصير زرُّ التشغيل ينطق تلك الكلمة إلى آخر
     * الجلسة. **قِيس**: تشغيل ← جملة، نقرُ كلمة، تشغيل ← الكلمة.
     *
     * فالوضعُ لا يُكتَب إلّا حيث يختاره المستعمِل صراحةً.
     */
    /*
     * ⚠️ **والحارسُ يقيس المعنى لا العدد.** كتبتُه أوّلًا «لا تزيد
     *    الكتاباتُ عن أربع» فسقط على خمسٍ كلُّها مشروعة. وعدَدٌ
     *    سقفُه رأيٌ لا حارس: يسقط على الصواب ويمرّ على الخطأ.
     *
     *    والقاعدةُ الحقيقيّة: الوضعُ يُكتَب من **اختيارٍ في يد
     *    المستعمِل** — متغيّرٍ جاء من زرّ — لا من ثابتٍ مكتوبٍ في
     *    الكود. فلا `practiceMode: PRACTICE_MODE.WORD` حرفيًّا في
     *    أيّ موضع؛ وهو بالضبط ما كان في المعالِج المحذوف.
     */
    const hardcoded = code.match(/practiceMode:\s*PRACTICE_MODE\.WORD/g) || [];
    expect(hardcoded).toEqual([]);

    /* ولا يُكتَب داخل معالِج الرقائق. */
    const chips = code.slice(code.indexOf('function wireChips'));
    const body = chips.slice(0, chips.indexOf('\n}\n'));
    expect(body.includes('practiceMode:')).toBe(false);
  });

  /*
   * ⚠️ **هذه الحُرّاسُ الثلاثةُ استُبدلت — وأقول لماذا.**
   *
   * كانت تحرس المقابلات: «التشغيل يُسكِت التسجيل»، «التسجيل يوقف
   * الجلسة»، «المغادرة توقف التسجيل». وهي حراسةُ ثقوبٍ **بعد أن
   * تُكتشَف**: في الشاشة أربعةُ مصادرِ صوت، فالمقابلاتُ اثنتا عشرة،
   * ولا يُكتَب منها إلّا ما يخطر بالبال.
   *
   * ⚠️ **وقِستُ ما لم يخطر**: تقلّبُ تبويبِ المنبع يترك التسجيلَ
   *    شغّالًا وزرُّه اختفى معه؛ وتغييرُ الوضع كذلك. الحُرّاسُ الثلاثةُ
   *    كانت خضراءَ والعطلان قائمان.
   *
   * فصار الحارسُ على **القاعدة** لا على أمثلتها: كلُّ مَن يُصدر
   * صوتًا يطالب بالناقل، ولا أحدَ يُصدر صوتًا بلا مطالبة.
   */
  it('⚠️ الحارس: لا مصدرَ صوتٍ بلا مطالبةٍ بالناقل', () => {
    /* كلُّ نداءٍ لبدء صوتٍ في الشاشة، ومعه شرطُ أن تسبقه مطالبة. */
    expect(code.includes("claimAudio(`voice:")).toBe(true);
    expect(code.includes('claimAudio(id, () => active.pause())')).toBe(true);

    /*
     * ولا `new Audio` خارج `playVoice` — أيّ مُشغّلٍ ثانٍ يتسلّل
     * يفلت من الناقل، وهو بالضبط ما فعلتُه أنا في WS25.
     */
    const audios = (code.match(/new Audio\(/g) || []).length;
    expect(audios).toBe(1);
  });

  it('⚠️ وكلُّ بابٍ يُخفي زرَّ الصوت يُسكته قبل أن يُخفيه', () => {
    /* تبويبُ المنبع يمحو زرَّ «■»، وتبديلُ الوضع يعيد رسم المسرح. */
    for (const kase of ["case 'well':", "case 'mode-go':"]) {
      const at = code.indexOf(kase);
      expect(at > 0).toBe(true);
      expect(code.slice(at, at + 260).includes('releaseAudio(')).toBe(true);
    }
  });

  it('⚠️ ومغادرةُ الشاشة تُسكِت التسجيل ولا تمسّ الجلسة', () => {
    const at = code.indexOf('export function disposeShadow');
    const block = code.slice(at, at + 700);
    /* بمُعطًى: تُسكِت إن كان التسجيلُ هو المالك وحده. */
    expect(block.includes('releaseAudio(`voice:')).toBe(true);
    expect(block.includes('releaseAudio()')).toBe(false);
  });

  it('⚠️ وقرارُ زرّ التشغيل عند المحرّك لا عند الشاشة', () => {
    /*
     * كانت الشاشة تستنتج من `running` و`paused` وتفترض ثلاثَ حالات،
     * وقد خرجت رابعة (`running=false, paused=true` بعد `goTo`) فماتت
     * الضغطة. **وهذا هو «بيشتغل ساعات ويبوظ ساعات».**
     */
    const at = code.indexOf('function togglePlay');
    /* ⚠️ حتى قوسِ الإغلاق لا بعدَد محارف: 400 محرفًا تبتلع الدالّةَ
       التي تليها، فيقرأ الحارسُ سطرًا ليس من شأنه. */
    const block = code.slice(at, code.indexOf('\n}', at));
    expect(block.includes('.toggle()')).toBe(true);
    expect(block.includes('.state.paused')).toBe(false);
  });

  it('⚠️ والشريط العائم مُشغّلٌ كامل لا زرّا إغلاق', () => {
    const at = code.indexOf('function parkShadow');
    const block = code.slice(at, code.indexOf('function paintFloating'));
    for (const act of ['prev', 'play', 'next', 'open', 'stop']) {
      expect(block.includes(`data-shf="${act}"`)).toBe(true);
    }
    /* والموضعُ يُحفَظ وأنت خارجها — التنقّلُ عملٌ لا يضيع. */
    expect(block.includes('savePosition(')).toBe(true);
  });

  it('ورسالةُ «مفيش ترجمة» بابٌ لا وصفُ طريق', () => {
    expect(code.includes('data-sh="tr-on"')).toBe(true);
    /*
     * ولا تُحيل إلى «الإعدادات» — ثلاثةُ أماكن في التطبيق بهذا الاسم.
     * ⚠️ ويُفحَص `code` (بلا تعليقات) لا المصدرُ الخام: أوّلُ تشغيلٍ
     *    سقط على **شرحي للعيب** الذي يقتبس العبارةَ القديمة. وهو
     *    نفسُ درسِ حارس السكّة قبله — الحارسُ يقرأ الكود لا النثر.
     */
    expect(code.includes('فعّل الترجمة من الإعدادات')).toBe(false);
  });
});

describe('التشغيل · الجملة الطويلة لا تدهس ما تحتها', () => {
  it('⚠️ الحارس: حجمُ الجملة يتبع طولَها', async () => {
    const view = await (await fetch('/js/views/shadow-view.js')).text();
    const css = await (await fetch('/css/shadow.css')).text();

    /* الرسمُ يكتب الطول… */
    expect(view.includes("setProperty('--sh-len'")).toBe(true);

    /*
     * ⚠️ …ويُقرأ حيث **تُحسَم** القيمة. كتبتُه أوّلًا في قاعدةٍ أدنى
     *    تخصّصًا فلم يعمل، وبقيت الجملة تحتاج 431px. فالحارسُ يطلبه
     *    في القاعدتين اللتين تغلبان.
     */
    for (const rule of [
      '.shadow-app.is-rail .sh-current-text',
      '.shadow-app:not(.is-rail) .sh-current-text',
    ]) {
      const at = css.lastIndexOf(rule);
      expect(at > 0).toBe(true);
      expect(css.slice(at, at + 160).includes('--sh-len')).toBe(true);
    }
  });

  it('⚠️ والرقائق مقيَّدةٌ بحدَّين — سقفٌ وقاع', () => {
    /* السقفُ يمنعها أن تأكل المسرح، والقاعُ يمنع الهاتفَ أن يسحقها. */
    return fetch('/css/shadow.css').then(async (r) => {
      const css = await r.text();
      const at = css.lastIndexOf('.sh-chips {');
      const block = css.slice(at, at + 700);
      expect(block.includes('max-height')).toBe(true);
      expect(block.includes('min-height')).toBe(true);
    });
  });
});

/* ================================================================== *
 * الإعدادات — حارسٌ عامّ على تصادم الأسماء (WS28)
 * ================================================================== */

describe('الإعدادات · كل زرّ له معالِجٌ واحد', () => {
  let code = '';
  let raw = '';

  it('⚠️ الحارس: كل اسم فعلٍ يُصدره الرسم له `case` في المُوزِّع', async () => {
    raw = await (await fetch('/js/views/shadow-view.js')).text();
    code = codeOnly(raw);

    /* ما يُصدره الرسم: سماتٌ مكتوبةٌ حرفيًّا، وما تولّده `pick`. */
    const emitted = new Set([
      ...[...code.matchAll(/data-sh="([a-z-]+)"/g)].map((h) => h[1]),
      ...[...code.matchAll(/\bpick\('([a-z-]+)'/g)].map((h) => h[1]),
    ]);
    const handled = new Set([...code.matchAll(/case '([a-z-]+)':/g)].map((h) => h[1]));

    /*
     * ما يُعالَج **خارج** المُوزِّع — بسببٍ مكتوبٍ لكلّ واحد، كسائر
     * سجلّات «ما لا نفعله» في المشروع. وسطرٌ يُضاف هنا قرارٌ، وغيابُه
     * سهوٌ يُسقط الاختبار.
     */
    const ELSEWHERE = {
      'voice-select': 'قائمة select لا زرّ — حدثُها change لا click، فلا مكانَ لها في مُوزِّع النقر',
      unsave: 'داخل نافذة المحفوظات، ولها مستمعُها على document لأن النوافذ تُلحَق بـbody لا بالشاشة',
    };
    for (const [name, why] of Object.entries(ELSEWHERE)) {
      expect(why.length > 25).toBe(true);
      handled.add(name);
    }

    /*
     * ⚠️ **هذا الحارسُ وُلد من عطلٍ صامتٍ تمامًا.** لوحةُ العرض كانت
     *    تُصدر `mode` — وهو اسمُ فعلٍ آخر (نمط التكرار). فضغطُ
     *    «مصري» يقع في الحالة الخطأ فتقرأ سمةً غيرَ موجودة وتضبط
     *    التكرار، **ولا تلمس الترجمة**. ولا خطأ ولا رسالة.
     *
     *    ولأن التصادمَ نفسَه لا يُكشَف بالاسم (كلاهما له `case`)،
     *    يمسك هذا الحارسُ أخاه: فعلٌ يُصدَر بلا معالِج. والتصادمُ
     *    نفسُه له اختبارُه تحت.
     */
    const orphans = [...emitted].filter((name) => !handled.has(name));
    expect(orphans).toEqual([]);
  });

  it('⚠️ ولوحةُ العرض لا تُسمّى باسم نمط التكرار', () => {
    /* الاسمان كانا `mode` كلاهما — وهو ما أعطب الترجمة بالكامل. */
    const at = code.indexOf("id === 'display'");
    const panel = code.slice(at, at + 700);
    expect(panel.includes("pick('mode'")).toBe(false);
    expect(panel.includes("pick('disp'")).toBe(true);
  });

  it('⚠️ وحجمُ الخطّ بالبكسل لا يُكتَب في حقلِ النسبة', () => {
    /*
     * `ctx.fontSize` نسبةٌ (1 = 100%)، وكانت `fsize` تضع فيها `48`
     * فتصير 4800% — وقد ظهرت حرفيًّا على السكّة. حقلٌ بمعنيين
     * يفسد كليهما، فصار للبكسل حقلُه.
     */
    const at = code.indexOf("case 'fsize'");
    const block = code.slice(at, at + 420);
    expect(block.includes('ctx.fontSize =')).toBe(false);
    expect(block.includes('ctx.sizePx =')).toBe(true);
    /* ويُحفَظ — كان يُطبَّق ولا يبقى بعد إغلاق الجلسة. */
    expect(block.includes('saveSessionSettings')).toBe(true);
  });

  it('⚠️ وكلا متغيّرَي الخطّ في القاعدة التي تحسم', async () => {
    const css = await (await fetch('/css/shadow.css')).text();
    for (const rule of [
      '.shadow-app.is-rail .sh-current-text',
      '.shadow-app:not(.is-rail) .sh-current-text',
    ]) {
      const at = css.lastIndexOf(rule);
      const block = css.slice(at, at + 190);
      /* البكسل من الدرجات، والنسبة من المنزلق — وإلّا فأحدهما بلا أثر. */
      expect(block.includes('--sh-size')).toBe(true);
      expect(block.includes('--sh-font-size')).toBe(true);
    }
  });

  it('⚠️ ومفتاحُ الأوضاع الثلاثة على الشاشة لا في لوحة', () => {
    expect(raw.includes('data-modes')).toBe(true);
    const at = code.indexOf('const MODES = [');
    const block = code.slice(at, code.indexOf('\n];', at));
    const ids = [...block.matchAll(/id: '([a-z]+)'/g)].map((h) => h[1]);
    expect(ids).toEqual(['text', 'word', 'own']);
    /* وكلٌّ يقول متى هو المُختار، ويدخل بفعل. */
    expect((block.match(/is: \(\)/g) || []).length).toBe(3);
    expect((block.match(/enter: async/g) || []).length).toBe(3);
  });

  it('⚠️ وإغلاقُ العارض لا ينقل أحدًا', async () => {
    const lb = await (await fetch('/js/components/lightbox.js')).text();
    /*
     * كان يُنادي `reloadScene`، وفرعُها الآخر `navigate`. فمَن فتح
     * صورةً من داخل كتاب الظلّ كان إغلاقُها يقذفه خارج جلسته.
     * **قِيس**: بعد الإغلاق يبقى المسارُ على `/shadow/`.
     */
    const lbCode = codeOnly(lb);
    expect(lbCode.includes('reloadScene')).toBe(false);
    expect(lbCode.includes('refreshSceneIfShowing')).toBe(true);
  });
});

/* ================================================================== *
 * عارضُ الصور — الضغطةُ والفراغُ والالتقاط (WS30)
 * ================================================================== */

describe('العارض · الفراغُ يُغلِق والصورةُ تُكبّر', () => {
  let code = '';

  it('⚠️ الحارس: «هل هو على الصورة؟» بالموضع لا بـ`event.target`', async () => {
    code = codeOnly(await (await fetch('/js/components/lightbox.js')).text());

    /*
     * `pointerdown` ينادي `setPointerCapture` على المسرح، فيصير
     * `event.target` هو المسرحَ في كلّ حدثٍ بعده — ولو كان إصبعُك
     * في منتصف الصورة. **قِستُه**: بـ`event.target === img` صارت
     * الضغطةُ على الصورة **تُغلِق العارض**، عكسَ المقصود.
     */
    const at = code.indexOf('const onImage');
    expect(at > 0).toBe(true);
    /* ⚠️ والقياسُ يسبق الاسم: `const r = img.getBoundingClientRect()`
       فوقه بسطر. حارسٌ يقرأ إلى الأمام وحده يفوته ما بُني له. */
    const block = code.slice(at - 120, at + 200);
    expect(block.includes('getBoundingClientRect')).toBe(true);
    expect(block.includes('event.target')).toBe(false);
  });

  it('⚠️ وحدُّ «الضغطة» أوسعُ من حدِّ «السحب» — وهما سؤالان', () => {
    /*
     * كان الشرطُ `!moved` و`moved` تصير صادقةً بعد ٦px — وكلُّ إصبعٍ
     * على لوحٍ ينزلق أكثر. فالضغطةُ التي تنزلق سبعةً لا تُغلِق ولا
     * تُكبّر ولا تنقل: **لا تفعل شيئًا**.
     */
    expect(code.includes('const isTap')).toBe(true);
    const at = code.indexOf('const isTap');
    const line = code.slice(at, at + 90);
    /* الحدُّ مقيسٌ لا مُختار: ١٦px تسع انزلاقَ إصبعٍ ولا تسع سحبة. */
    expect(/16/.test(line)).toBe(true);
  });

  it('⚠️ وسحبةُ التصفّح أفقيّةٌ صراحةً — لا مجرّد بعيدة', () => {
    const at = code.indexOf('show(dx > 0');
    expect(at > 0).toBe(true);
    /* الشرطُ قبلها يقارن الأفقيَّ بالرأسيّ، وإلّا قلبت سحبةٌ مائلة. */
    const before = code.slice(Math.max(0, at - 220), at);
    expect(before.includes('Math.abs(dy)')).toBe(true);
  });

  it('⚠️ وصورةُ الجلسة تُعرَض — لا غلافُ الذكرى دائمًا', async () => {
    const view = codeOnly(await (await fetch('/js/views/shadow-view.js')).text());
    const at = view.indexOf('async function coverImage');
    const block = view.slice(at, at + 700);
    /*
     * تفتح صورةً من خمسٍ وتتدرّب على نصّها، فتُبنى جلسةٌ مصدرُها تلك
     * الصورة — وكانت الورقةُ تعرض غيرَها. أي: تتدرّب على نصّ صورةٍ
     * وأمامك أخرى.
     */
    expect(block.includes('SOURCE_TYPE.MEDIA_TEXT')).toBe(true);
    expect(block.includes('session.sourceId')).toBe(true);
  });
});

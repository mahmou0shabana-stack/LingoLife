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
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

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

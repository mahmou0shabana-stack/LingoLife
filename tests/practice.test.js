/**
 * LingoLife — هدفُ التدريب: النطاقاتُ الثلاثة بالحرف (WS-I · بنود ٢٤ و٢٥)
 *
 * ⚠️ **مساواةٌ حرفيّةٌ لا `includes`.** البندُ صريح، والسببُ أن
 *    `includes` تمرّ على كلّ العيوب التي أُبلِغ عنها: قراءةُ الجملة
 *    كلِّها تحتوي المقطع، وقراءةُ كلمةٍ واحدةٍ يحتويها المقطع. فاختبارٌ
 *    متساهلٌ هنا **يخضرّ على العطب نفسِه**.
 */

import { describe, it, expect } from './test-runner.js';
import { splitWords } from '../js/services/shadow/segmenter.js';
import {
  SCOPE, resolveTarget, normalizeRange, targetKey,
} from '../js/services/shadow/practice-target.js';

/** الجملةُ التي جاءت في البلاغ بحرفها. */
const SENTENCE = 'Протокол уже полностью заполнен, и документ направили на согласование.';

/** يحلّ هدفًا على جملةٍ ما — نفسُ ما تفعله الشاشةُ والمحرّك. */
function on(sentence, options) {
  return resolveTarget({
    words: splitWords(sentence),
    sentence,
    segmentId: 'SEG_TEST',
    ...options,
  });
}

describe('WS-I · النطاقاتُ الثلاثة', () => {
  it('١ · ⚠️ المقطعُ المحدَّد يُقرأ بالحرف — لا الجملةَ ولا كلمةً منه (بند ٢٤)', () => {
    const words = splitWords(SENTENCE);
    /* نتأكّد أوّلًا أن الفهارس هي التي نظنّها — وإلّا اختبرنا شيئًا آخر. */
    expect(words[2].display).toBe('полностью');
    expect(words[5].display).toBe('документ');

    const target = on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 2, focus: 5 });

    expect(target.ok).toBe(true);
    expect(target.scope).toBe('phrase');
    /* ═══ المساواةُ الحرفيّة ═══ */
    expect(target.text).toBe('полностью заполнен, и документ');
  });

  it('٢ · والكلمةُ تُقرأ بالحرف', () => {
    const target = on(SENTENCE, { scope: SCOPE.WORD, wordIndex: 5 });
    expect(target.text).toBe('документ');
  });

  it('٣ · والجملةُ تُقرأ كاملةً بالحرف', () => {
    const target = on(SENTENCE, { scope: SCOPE.SENTENCE });
    expect(target.text).toBe('Протокол уже полностью заполнен, и документ направили на согласование.');
  });

  it('٤ · ⚠️ والثلاثةُ لا تتساوى — فلا «إصلاحٌ» يجعلها كلَّها الجملة (بند ٣)', () => {
    const word = on(SENTENCE, { scope: SCOPE.WORD, wordIndex: 5 }).text;
    const phrase = on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 2, focus: 5 }).text;
    const sentence = on(SENTENCE, { scope: SCOPE.SENTENCE }).text;

    expect(word === phrase).toBe(false);
    expect(phrase === sentence).toBe(false);
    expect(word === sentence).toBe(false);
    /* وطولُها يتصاعد — الكلمةُ داخل المقطع داخل الجملة. */
    expect(word.length < phrase.length).toBe(true);
    expect(phrase.length < sentence.length).toBe(true);
  });
});

describe('WS-I · مصفوفةُ المديات (بند ٢٥)', () => {
  it('٥ · مدًى من كلمتين', () => {
    expect(on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 2, focus: 3 }).text)
      .toBe('полностью заполнен,');
  });

  it('٦ · مدًى من أربع كلمات', () => {
    expect(on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 5, focus: 8 }).text)
      .toBe('документ направили на согласование.');
  });

  it('٧ · مدًى يبدأ من أوّل الجملة', () => {
    expect(on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 0, focus: 2 }).text)
      .toBe('Протокол уже полностью');
  });

  it('٨ · مدًى ينتهي بآخر الجملة — بنقطتها', () => {
    expect(on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 6, focus: 8 }).text)
      .toBe('направили на согласование.');
  });

  it('٩ · ⚠️ ومدًى فيه ترقيمٌ داخليّ يحتفظ به (بند ٦)', () => {
    const text = on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 3, focus: 4 }).text;
    expect(text).toBe('заполнен, и');
    /* ولا مسافةَ دُسّت قبل الفاصلة. */
    expect(text.includes(' ,')).toBe(false);
    /* ولا فاصلةَ تضاعفت. */
    expect(text.split(',').length).toBe(2);
  });

  it('١٠ · ⚠️ والاتّجاهُ لا يعكس المنطوق (بند ٥)', () => {
    const forward = on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 2, focus: 5 }).text;
    const reverse = on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 5, focus: 2 }).text;

    expect(reverse).toBe('полностью заполнен, и документ');
    expect(forward).toBe(reverse);
    /* والتطبيعُ نفسُه يُختبَر مباشرةً. */
    expect(JSON.stringify(normalizeRange(7, 3, 9))).toBe(JSON.stringify({ from: 3, to: 7 }));
    expect(JSON.stringify(normalizeRange(3, 7, 9))).toBe(JSON.stringify({ from: 3, to: 7 }));
  });

  it('١١ · وعلاماتُ النبر تبقى كما هي في النصّ', () => {
    /* U+0301 — تركيبيّةٌ تلتصق بالحرف قبلها. */
    const stressed = 'Протоко́л уже́ по́лностью запо́лнен, и докуме́нт';
    const target = resolveTarget({
      words: splitWords(stressed), sentence: stressed,
      scope: SCOPE.PHRASE, anchor: 2, focus: 5, segmentId: 'SEG_S',
    });
    expect(target.text).toBe('по́лностью запо́лнен, и докуме́нт');
    /* ولم تُبتَر العلامةُ التركيبيّة. */
    expect(target.text.includes('́')).toBe(true);
  });

  it('١٢ · وتبديلُ التحديد سريعًا لا يخلّف بقايا', () => {
    const words = splitWords(SENTENCE);
    const runs = [[0, 1], [3, 6], [7, 8], [2, 5]];
    const seen = runs.map(([a, b]) => resolveTarget({
      words, sentence: SENTENCE, scope: SCOPE.PHRASE, anchor: a, focus: b, segmentId: 'S',
    }).text);

    expect(seen[0]).toBe('Протокол уже');
    expect(seen[1]).toBe('заполнен, и документ направили');
    expect(seen[2]).toBe('на согласование.');
    /* والأخيرُ هو الأخيرُ — لا الأوّلُ عالقًا. */
    expect(seen[3]).toBe('полностью заполнен, и документ');
  });

  it('١٣ · ومدًى خارجَ الحدّ يُرفَض ولا يُنطَق نصفُه', () => {
    expect(on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 2, focus: 99 }).ok).toBe(false);
    expect(on(SENTENCE, { scope: SCOPE.PHRASE, anchor: -1, focus: 3 }).ok).toBe(false);
    expect(on(SENTENCE, { scope: SCOPE.PHRASE, anchor: 2, focus: 99 }).text).toBe('');
  });
});

describe('WS-I · المصادرُ المختلفة ودورُ المتحدّث', () => {
  /*
   * ⚠️ **والمصدرُ لا يغيّر النطاق** (بند ٢٥). المُحلُّ لا يعرف من أين
   *    جاء النصّ — سكريبتًا كان أم مسودّةً أم نصًّا مؤقّتًا — وهذا هو
   *    سببُ تطابق السلوك في الثلاثة.
   */
  const CASES = [
    ['المصدر الأصليّ', 'Он сказал, что документ готов.'],
    ['مسودّة مذاكرة', 'Я написал, что всё понятно.'],
    ['نصّ مؤقّت للتصحيح', 'Это, кажется, правильно.'],
  ];

  it('١٤ · نفسُ النطاق في المصادر الثلاثة', () => {
    for (const [label, sentence] of CASES) {
      const words = splitWords(sentence);
      const phrase = resolveTarget({
        words, sentence, scope: SCOPE.PHRASE, anchor: 0, focus: 1, segmentId: 'S',
      });
      const expected = `${words[0].display} ${words[1].display}`;
      if (phrase.text !== expected) {
        throw new Error(`${label}: متوقّع «${expected}» ووُجد «${phrase.text}»`);
      }
      /* والجملةُ كاملةٌ كما كُتبت. */
      expect(resolveTarget({ words, sentence, scope: SCOPE.SENTENCE }).text).toBe(sentence);
    }
    expect(CASES.length).toBe(3);
  });

  it('١٥ · ⚠️ واسمُ المتحدّث بيانٌ لا نصٌّ يُنطَق (بند ٧)', () => {
    /*
     * في المحادثة يعيش اسمُ المتحدّث في حقلٍ مستقلٍّ على المقطع
     * (`segment.speaker`)، ولا يدخل `sourceTextSnapshot`. والمُحلُّ
     * لا يقرأ إلّا النصّ — فلا سبيلَ لتسرّبه أصلًا.
     */
    const turn = 'Да, я думаю, что это правильно.';
    const segment = { id: 'SEG_C', speaker: 'المتحدّث ١', sourceTextSnapshot: turn };

    const target = resolveTarget({
      words: splitWords(segment.sourceTextSnapshot),
      sentence: segment.sourceTextSnapshot,
      scope: SCOPE.SENTENCE,
      segmentId: segment.id,
    });

    expect(target.text).toBe('Да, я думаю, что это правильно.');
    expect(target.text.includes('المتحدّث')).toBe(false);
    expect(target.text.includes('Speaker')).toBe(false);

    /* ومقطعٌ داخل الدور كذلك. */
    const phrase = resolveTarget({
      words: splitWords(turn), sentence: turn,
      scope: SCOPE.PHRASE, anchor: 2, focus: 3, segmentId: segment.id,
    });
    expect(phrase.text).toBe('думаю, что');
    expect(phrase.text.includes('المتحدّث')).toBe(false);
  });
});

describe('WS-I · مفتاحُ الهدف (بندا ١٢ و١٥)', () => {
  it('١٦ · ⚠️ ومفتاحُ الجملة غيرُ مفتاح المقطع داخلها', () => {
    const sentence = targetKey({ segmentId: 'SEG_1', scope: SCOPE.SENTENCE });
    const phrase = targetKey({ segmentId: 'SEG_1', scope: SCOPE.PHRASE, from: 2, to: 5 });
    const other = targetKey({ segmentId: 'SEG_1', scope: SCOPE.PHRASE, from: 3, to: 6 });

    expect(sentence === phrase).toBe(false);
    expect(phrase === other).toBe(false);
    expect(sentence).toBe('SEG_1|sentence');
    expect(phrase).toBe('SEG_1|phrase|2-5');
  });

  it('١٧ · ⚠️ والنصُّ المتطابقُ في جملتين لا يوحّد مفتاحَهما', () => {
    /*
     * «да» تتكرّر في عشرين موضعًا. فلو كانت الهُويّةُ نصًّا لَاختلطت
     * تسجيلاتُ عشرين هدفًا في واحد.
     */
    const a = targetKey({ segmentId: 'SEG_A', scope: SCOPE.SENTENCE });
    const b = targetKey({ segmentId: 'SEG_B', scope: SCOPE.SENTENCE });
    expect(a === b).toBe(false);
  });

  it('١٨ · وبلا هُويّةِ جملةٍ لا مفتاح — فلا يُختلَق واحد', () => {
    expect(targetKey({ segmentId: null, scope: SCOPE.SENTENCE })).toBe(null);
    expect(targetKey({ segmentId: 'S', scope: SCOPE.PHRASE, from: null, to: null })).toBe(null);
  });
});

/* ================================================================== *
 * محاولاتُ صوتي — تخزينٌ ونسبةٌ وسجلّ (بنود ٨…١٩ و٢٦…٢٩)
 * ================================================================== */

import { media, practiceEvidence, scenes } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';
import { AUDIO_ROLE } from '../js/services/media-service.js';
import {
  saveAttempt, listAttempts, countByTarget, VOICE_TARGET_TYPE,
} from '../js/services/shadow/voice-attempts.js';

/** بايتاتُ صوتٍ صغيرةٌ لكنها حقيقيّة — لا بلوبٌ من بايتين. */
function voiceBlob(seed = 1) {
  const bytes = new Uint8Array(512);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * seed + 7) % 251;
  return new File([bytes], `صوتي-${seed}.webm`, { type: 'audio/webm' });
}

/** هدفٌ جاهزٌ للحفظ — كما تبنيه الشاشة. */
function targetFor(segmentId, scope, from = null, to = null, text = 'نصّ') {
  return {
    ok: true,
    key: targetKey({ segmentId, scope, from, to }),
    scope, from, to, text,
    segmentId,
    sessionId: `SESS_${segmentId}`,
    sceneId: null,
    sourceType: 'script',
    sourceId: 'SCR_X',
  };
}

let n = 0;
const freshSegment = () => `SEG_WSI_${Date.now()}_${n++}`;

describe('WS-I · محاولاتُ صوتي', () => {
  it('١٩ · تُحفَظ وتُقرأ بكلّ نسبتها (بند ١٣)', async () => {
    const seg = freshSegment();
    const target = targetFor(seg, SCOPE.PHRASE, 2, 5, 'полностью заполнен, и документ');

    const saved = await saveAttempt({ file: voiceBlob(3), target, durationMs: 2400 });
    expect(saved.ok).toBe(true);

    const rows = await listAttempts(target.key);
    expect(rows.length).toBe(1);
    const attempt = rows[0];

    expect(Boolean(attempt.mediaId)).toBe(true);
    expect(attempt.scope).toBe('phrase');
    expect(attempt.from).toBe(2);
    expect(attempt.to).toBe(5);
    expect(attempt.text).toBe('полностью заполнен, и документ');
    expect(attempt.durationMs).toBe(2400);
    expect(Number.isFinite(attempt.createdAt)).toBe(true);

    /* والبايتاتُ في صفّ وسائطٍ عاديّ. */
    const row = await media.get(attempt.mediaId);
    expect(row.kind).toBe('audio');
    expect(row.blob.size).toBe(512);
    expect(row.state).toBe(STATE.ACTIVE);
  });

  it('٢٠ · ⚠️ وسجلُّ الجملة لا يختلط بسجلّ المقطع داخلها (بند ١٥)', async () => {
    const seg = freshSegment();
    const sentence = targetFor(seg, SCOPE.SENTENCE, null, null, 'الجملة كلها');
    const phrase = targetFor(seg, SCOPE.PHRASE, 2, 5, 'مقطع منها');

    await saveAttempt({ file: voiceBlob(1), target: sentence });
    await saveAttempt({ file: voiceBlob(2), target: sentence });
    await saveAttempt({ file: voiceBlob(4), target: phrase });

    const onSentence = await listAttempts(sentence.key);
    const onPhrase = await listAttempts(phrase.key);

    expect(onSentence.length).toBe(2);
    expect(onPhrase.length).toBe(1);
    /* ⚠️ ولم تُعَد تصنيفُ تسجيلات الجملة مقاطعَ. */
    expect(onSentence.every((row) => row.scope === 'sentence')).toBe(true);
    expect(onPhrase[0].scope).toBe('phrase');
    /* ولا تسجيلَ ظهر في الاثنين. */
    const ids = new Set([...onSentence, ...onPhrase].map((r) => r.mediaId));
    expect(ids.size).toBe(3);
  });

  it('٢١ · والمحاولاتُ تتراكم ولا يُكتَب فوق سابقة (بند ١٤)', async () => {
    const seg = freshSegment();
    const target = targetFor(seg, SCOPE.SENTENCE);

    for (let i = 0; i < 3; i++) {
      /* eslint-disable-next-line no-await-in-loop */
      await saveAttempt({ file: voiceBlob(i + 1), target });
    }

    const rows = await listAttempts(target.key);
    expect(rows.length).toBe(3);
    /* والأحدثُ أوّلًا. */
    expect(rows[0].createdAt >= rows[1].createdAt).toBe(true);
    expect(rows[1].createdAt >= rows[2].createdAt).toBe(true);
    /* وثلاثةُ ملفّاتٍ مستقلّة — لا واحدٌ استُبدل. */
    expect(new Set(rows.map((r) => r.mediaId)).size).toBe(3);
  });

  it('٢٢ · ⚠️ واللقطةُ المجمَّدة لا تُعاد نسبتُها ولو تبدّل الهدف (بندا ١١ و٢٧)', async () => {
    const segA = freshSegment();
    const segB = freshSegment();

    /* بدأ التسجيلُ على «أ» — فجُمِّدت لقطتُها. */
    const frozen = targetFor(segA, SCOPE.SENTENCE, null, null, 'الجملة أ');

    /* ثم تبدّلت الشاشةُ إلى «ب» أثناء التسجيل. */
    const live = targetFor(segB, SCOPE.SENTENCE, null, null, 'الجملة ب');
    expect(live.key === frozen.key).toBe(false);

    /* والحفظُ يقرأ اللقطةَ وحدَها. */
    await saveAttempt({ file: voiceBlob(9), target: frozen });

    const onA = await listAttempts(frozen.key);
    const onB = await listAttempts(live.key);

    expect(onA.length).toBe(1);
    expect(onA[0].text).toBe('الجملة أ');
    /* ═══ ولا محاولةَ تسرّبت إلى «ب» ═══ */
    expect(onB.length).toBe(0);
  });

  it('٢٣ · ونفسُ الشيء على المديات', async () => {
    const seg = freshSegment();
    const frozen = targetFor(seg, SCOPE.PHRASE, 1, 3, 'المدى الأوّل');
    const live = targetFor(seg, SCOPE.PHRASE, 4, 6, 'المدى التاني');

    await saveAttempt({ file: voiceBlob(5), target: frozen });

    expect((await listAttempts(frozen.key)).length).toBe(1);
    expect((await listAttempts(live.key)).length).toBe(0);
  });

  it('٢٤ · ⚠️ وحذفُ محاولةٍ لا يمسّ أخواتِها (بند ١٩)', async () => {
    const seg = freshSegment();
    const target = targetFor(seg, SCOPE.SENTENCE);

    const a = await saveAttempt({ file: voiceBlob(1), target });
    const b = await saveAttempt({ file: voiceBlob(2), target });
    const c = await saveAttempt({ file: voiceBlob(3), target });
    expect((await listAttempts(target.key)).length).toBe(3);

    /* الحذفُ بسلّة التطبيق — نفسُ ما تفعله اللوحة. */
    await media.trash(b.mediaId);

    const left = await listAttempts(target.key);
    expect(left.length).toBe(2);
    expect(left.some((row) => row.mediaId === b.mediaId)).toBe(false);
    /* والباقيان سليمان ببايتاتهما. */
    expect((await media.get(a.mediaId)).blob.size).toBe(512);
    expect((await media.get(c.mediaId)).blob.size).toBe(512);

    /*
     * ⚠️ **وصفُّ الدليل باقٍ — لا يُحذف بالتصميم.** والمعروضُ يُصفّى
     *    بحالة الوسيط، فلا يظهر سطرٌ يشغّل لا شيء.
     */
    const evidence = await practiceEvidence.byIndex('target', [VOICE_TARGET_TYPE, target.key]);
    expect(evidence.length).toBe(3);
  });

  it('٢٥ · وحفظةٌ واحدةٌ = ملفٌّ واحد، والعرضُ المتكرّر لا يضاعف (بند ٢٩)', async () => {
    const seg = freshSegment();
    const target = targetFor(seg, SCOPE.SENTENCE);

    const saved = await saveAttempt({ file: voiceBlob(6), target });

    /* ثلاثُ قراءاتٍ متتالية. */
    const a = await listAttempts(target.key);
    const b = await listAttempts(target.key);
    const c = await listAttempts(target.key);

    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    expect(c.length).toBe(1);
    expect(a[0].mediaId).toBe(saved.mediaId);
    expect(c[0].mediaId).toBe(saved.mediaId);

    const evidence = await practiceEvidence.byIndex('target', [VOICE_TARGET_TYPE, target.key]);
    expect(evidence.length).toBe(1);
  });

  it('٢٦ · ⚠️ و«إلغاء» صفرُ كتابات — بحكم البنية لا بتنظيف (بند ٢٨)', async () => {
    const seg = freshSegment();
    const target = targetFor(seg, SCOPE.SENTENCE);

    const mediaBefore = (await media.getAll()).length;
    const evidenceBefore = (await practiceEvidence.getAll()).length;

    /*
     * تسجيلٌ ثم معاينةٌ ثم إلغاء: اللوحةُ تبني `File` و`ObjectURL`
     * وتُسقطهما. ولا نداءَ لـ`saveAttempt` — وهي **الوحيدةُ التي تكتب**.
     */
    const file = voiceBlob(8);
    const url = URL.createObjectURL(file);
    URL.revokeObjectURL(url);

    expect((await media.getAll()).length).toBe(mediaBefore);
    expect((await practiceEvidence.getAll()).length).toBe(evidenceBefore);
    expect((await listAttempts(target.key)).length).toBe(0);
  });

  it('٢٧ · وتسجيلٌ فاضٍ أو بلا هدفٍ يُرفَض ولا يكتب', async () => {
    const seg = freshSegment();
    const target = targetFor(seg, SCOPE.SENTENCE);
    const before = (await media.getAll()).length;

    expect((await saveAttempt({ file: new File([], 'x.webm'), target })).ok).toBe(false);
    expect((await saveAttempt({ file: voiceBlob(1), target: { key: null } })).ok).toBe(false);

    expect((await media.getAll()).length).toBe(before);
  });
});

describe('WS-I · التوافقُ مع السحابة والنسخ (بندا ٢٢ و٢٣)', () => {
  it('٢٨ · التسجيلُ وسيطٌ عاديّ — فهو مؤهَّلٌ لرفع Drive بلا مسارٍ خاصّ', async () => {
    const { createBlobUploader } = await import('../js/services/cloud/media-upload.js');
    const seg = freshSegment();
    const saved = await saveAttempt({
      file: voiceBlob(2), target: targetFor(seg, SCOPE.SENTENCE),
    });

    /* لا اتّصالَ ولا شبكة — نسأل الطابورَ عمّا ينتظر الرفع فقط. */
    const uploader = createBlobUploader({});
    const waiting = await uploader.pending();

    expect(waiting.some((row) => row.id === saved.mediaId)).toBe(true);

    const ready = await uploader.readiness();
    expect(ready.audio > 0).toBe(true);
  });

  it('٢٩ · والنسخةُ الكاملةُ تحمل بايتاتِه والخفيفةُ تحمل وصفَه', async () => {
    const { buildBackup } = await import('../js/services/backup/export.js');
    const seg = freshSegment();
    const saved = await saveAttempt({
      file: voiceBlob(7), target: targetFor(seg, SCOPE.SENTENCE, null, null, 'نصّ للنسخ'),
    });

    const full = await buildBackup(() => {}, { withBlobs: true });
    const light = await buildBackup(() => {}, { withBlobs: false });

    /* الكاملةُ تُدرج بايتاتِه في بيان الملفّات. */
    expect(full.manifest.blobs.some((b) => b.mediaId === saved.mediaId)).toBe(true);
    /* والخفيفةُ تُعلن حذفَه ولا تصمت عنه. */
    expect((light.manifest.omittedBlobs || []).some((b) => b.mediaId === saved.mediaId)).toBe(true);
    /* والوصفُ في الاثنتين — صفُّ الوسيط وصفُّ الدليل سجلّان عاديّان. */
    expect(light.manifest.counts.media > 0).toBe(true);
    expect(light.manifest.counts.practiceEvidence > 0).toBe(true);
    expect(light.blob.size < full.blob.size).toBe(true);
  });
});

describe('WS-I · القياس (بند ٣١)', () => {
  it('٣٠ · ⚠️ وسجلُّ الهدف استعلامان لا استعلامٌ لكلّ محاولة', async () => {
    const seg = freshSegment();
    const target = targetFor(seg, SCOPE.SENTENCE);
    for (let i = 0; i < 10; i++) {
      /* eslint-disable-next-line no-await-in-loop */
      await saveAttempt({ file: voiceBlob(i + 1), target });
    }

    /* نعدّ نداءات المخزن فعلًا — لا نفترضها. */
    const realIndex = practiceEvidence.byIndex;
    const realMany = media.getMany;
    const realGet = media.get;
    let indexCalls = 0; let manyCalls = 0; let getCalls = 0;
    practiceEvidence.byIndex = (...args) => { indexCalls += 1; return realIndex.apply(practiceEvidence, args); };
    media.getMany = (...args) => { manyCalls += 1; return realMany.apply(media, args); };
    media.get = (...args) => { getCalls += 1; return realGet.apply(media, args); };

    let rows;
    const started = performance.now();
    try {
      rows = await listAttempts(target.key);
    } finally {
      practiceEvidence.byIndex = realIndex;
      media.getMany = realMany;
      media.get = realGet;
    }
    const ms = Math.round(performance.now() - started);

    console.log('[WS-I قياس] سجلّ ١٠ محاولات', JSON.stringify({
      attempts: rows.length, indexCalls, manyCalls, getCalls, ms,
    }));

    expect(rows.length).toBe(10);
    /* ═══ استعلامٌ مفهرسٌ واحد + قراءةٌ دفعيّةٌ واحدة ═══ */
    expect(indexCalls).toBe(1);
    expect(manyCalls).toBe(1);
    /* ⚠️ ولا قراءةَ مفردةً لكلّ محاولة — وهي بالضبط صورةُ N+1. */
    expect(getCalls).toBe(0);
  });

  it('٣١ · وفتحُ هدفٍ بلا محاولاتٍ لا يقرأ وسائطَ أصلًا', async () => {
    const empty = targetFor(freshSegment(), SCOPE.SENTENCE);
    const realMany = media.getMany;
    let manyCalls = 0;
    media.getMany = (...args) => { manyCalls += 1; return realMany.apply(media, args); };
    try {
      const rows = await listAttempts(empty.key);
      expect(rows.length).toBe(0);
    } finally { media.getMany = realMany; }
    expect(manyCalls).toBe(0);
  });

  it('٣٢ · وعدُّ عدّة أهدافٍ قراءةٌ واحدةٌ لا قراءةٌ لكلّ هدف', async () => {
    const keys = [];
    for (let i = 0; i < 4; i++) {
      const target = targetFor(freshSegment(), SCOPE.SENTENCE);
      keys.push(target.key);
      /* eslint-disable-next-line no-await-in-loop */
      await saveAttempt({ file: voiceBlob(i + 1), target });
    }

    const realIndex = practiceEvidence.byIndex;
    let calls = 0;
    practiceEvidence.byIndex = (...args) => { calls += 1; return realIndex.apply(practiceEvidence, args); };
    let counts;
    try { counts = await countByTarget(keys); } finally { practiceEvidence.byIndex = realIndex; }

    expect(calls).toBe(1);
    expect(counts.size).toBe(4);
    expect(counts.get(keys[0])).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   الحرّاسُ البنيويّون (بند ٣٢)

   ⚠️ **والدرسُ المكتوبُ بثمنِه في WS-H يُعاد هنا: قِسِ الكودَ لا النصّ.**
      كتبتُ هناك حارسًا يمنع كلمةَ «drive» فسقط على `driveFileId` —
      وهو **اسمُ حقلٍ محلّيّ** في ملفٍّ كان يفعل الصوابَ بعينه. فصار
      الحارسُ يعاقب الالتزامَ لأنه ذكر اسمَه.

      فهنا: تُنزَع التعليقاتُ أوّلًا، ويُقاس **الاستيرادُ ونداءُ الواجهة**
      لا ورودُ الكلمة. وترويسةُ `voice-attempts.js` نفسُها تشرح لماذا لا
      مخزنَ ثالث — ولو قِسنا النصّ لَأسقطها شرحُها.
   ═══════════════════════════════════════════════════════════════════ */

/** الملفّاتُ التي أنشأتها هذه التمريرةُ — وهي وحدَها موضعُ الحكم. */
const WS_I_FILES = [
  'services/shadow/practice-target.js',
  'services/shadow/voice-attempts.js',
  'modals/voice-attempts.js',
];

/** وملفّاتُ الظلّ التي مسّتها. */
const TOUCHED_FILES = [
  'services/shadow/playback-controller.js',
  'views/shadow-view.js',
];

const srcOf = (path) => fetch(`../js/${path}`).then((r) => {
  if (!r.ok) throw new Error(`ملفٌّ غير موجود: ${path}`);
  return r.text();
});

const srcsOf = (paths) => Promise.all(paths.map(async (p) => [p, await srcOf(p)]));

/** الكودُ بلا تعليقات — فلا يُحاسَب ملفٌّ على شرحِه. */
const codeOf = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/** أسطرُ الاستيراد وحدَها. */
const importsOf = (source) =>
  [...source.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('WS-I · الحرّاسُ البنيويّون (بند ٣٢)', () => {
  it('٣٣ · ⚠️ ولا مشغّلَ صوتٍ ثانٍ — التشغيلُ من `audio-service` وحدَه', async () => {
    const forbidden = [
      'new Audio(', "createElement('audio'", 'createElement("audio"',
      'AudioContext', 'webkitAudioContext',
    ];
    const offenders = [];
    for (const [path, source] of await srcsOf(WS_I_FILES)) {
      const code = codeOf(source);
      for (const needle of forbidden) {
        if (code.includes(needle)) offenders.push(`${path}: «${needle}»`);
      }
    }
    if (offenders.length) throw new Error(`مشغّلُ صوتٍ ثانٍ:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);

    /*
     * والنفيُ وحدَه لا يكفي: لا بدّ أن تُثبِت النافذةُ أنها **تستعمل**
     * المشغّلَ القائم، وإلّا لَكان الحارسُ يخضرّ على نافذةٍ لا تشغّل شيئًا.
     */
    const modal = await srcOf('modals/voice-attempts.js');
    expect(importsOf(modal).some((s) => s.endsWith('audio-service.js'))).toBe(true);
    expect(codeOf(modal).includes('audio.load(')).toBe(true);
  });

  it('٣٤ · ⚠️ ولا خدمةَ نطقٍ ثانية — النطقُ يمرّ بـ`tts-controller` كما كان', async () => {
    const forbidden = ['speechSynthesis', 'SpeechSynthesisUtterance'];
    const offenders = [];
    for (const [path, source] of await srcsOf(WS_I_FILES)) {
      const code = codeOf(source);
      for (const needle of forbidden) {
        if (code.includes(needle)) offenders.push(`${path}: «${needle}»`);
      }
    }
    if (offenders.length) throw new Error(`خدمةُ نطقٍ ثانية:\n${offenders.join('\n')}`);

    /*
     * والمحرّكُ لم يُستبدَل: `playback-controller` ما زال ينادي `speaker`
     * المحقونَ من الخارج، وإنّما صار **يسأل المُحلَّ عن النصّ** قبله.
     * فالتغييرُ في تحديد الهدف لا في مَن ينطقه.
     */
    const controller = codeOf(await srcOf('services/shadow/playback-controller.js'));
    expect(controller.includes('await speaker(currentText()')).toBe(true);
    expect(controller.includes('resolveTarget(')).toBe(true);
  });

  it('٣٥ · ⚠️ ولا مخزنَ تسجيلٍ خاصًّا بالظلّ — ولا حقلَ في المخطّط', async () => {
    /*
     * البرهانُ على «بلا هجرة» ليس ادّعاءً في تعليق: المخطّطُ لا يعرف
     * كلمةً من مفرداتِ هذه التمريرة، وسلسلةُ الترقيات لم يزدها أحد.
     */
    const schema = codeOf(await srcOf('db/schema.js'));
    for (const word of ['shadowVoice', 'voiceAttempt', 'attempts', 'recordings']) {
      if (schema.includes(word)) throw new Error(`المخطّطُ ذكر «${word}» — أي أن مخزنًا أُضيف`);
    }

    const migrations = await srcOf('db/migrations.js');
    for (const word of ['shadowVoice', 'voiceAttempt']) {
      if (codeOf(migrations).includes(word)) throw new Error(`ترقيةٌ تذكر «${word}»`);
    }
    /* وآخرُ ترقيةٍ ما زالت ١٧ — لم تتحرّك لأجل التسجيل. */
    expect(/\bv:\s*17\b/.test(migrations)).toBe(true);
    expect(/\bv:\s*18\b/.test(migrations)).toBe(false);

    /* والخدمةُ تكتب في المخازن القائمة وحدَها. */
    const service = await srcOf('services/shadow/voice-attempts.js');
    const specs = importsOf(service);
    expect(specs.some((s) => s.endsWith('repositories.js'))).toBe(true);
    const writes = [...codeOf(service).matchAll(/\b(\w+)\.create\(/g)].map((m) => m[1]);
    expect(writes.sort().join(',')).toBe('media,practiceEvidence,sceneMediaLinks');
  });

  it('٣٦ · ⚠️ ولا نداءَ Drive ولا سحابةً من شاشة التدريب (بند ٢٢)', async () => {
    /*
     * التسجيلُ يصل إلى Drive **لأنه وسيطٌ عاديّ**، لا لأن الشاشةَ ترفعه.
     * فوجودُ استيرادٍ من طبقة السحابة هنا يعني أننا بنينا مسارًا موازيًا —
     * وهو ما يمنعه البندُ ٢٢ نصًّا.
     */
    const banned = ['gapi.', 'googleapis', 'accounts.google', 'gsi/client', 'access_token'];
    const offenders = [];
    for (const [path, source] of await srcsOf([...WS_I_FILES, ...TOUCHED_FILES])) {
      const code = codeOf(source).toLowerCase();
      for (const word of banned) {
        if (code.includes(word)) offenders.push(`${path}: «${word}»`);
      }
      for (const spec of importsOf(source)) {
        if (spec.includes('/cloud/')) offenders.push(`${path} ← ${spec}`);
      }
    }
    if (offenders.length) throw new Error(`السحابةُ تسرّبت لشاشة التدريب:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);
  });

  it('٣٧ · ⚠️ ولا إذنَ ميكروفون إلّا بلمسةِ تسجيل (بند ٢٠)', async () => {
    /*
     * `getUserMedia` يُظهر نافذةَ إذنٍ فورًا. فلو نُودي عند فتح النافذة —
     * أو أسوأ، عند تحميل الوحدة — لَسأل التطبيقُ عن الميكروفون قبل أن
     * يطلب المستخدمُ شيئًا. فالنداءُ الوحيدُ يبقى داخل `media-service`،
     * وهذه التمريرةُ تناديه من معالِج زرٍّ لا غير.
     */
    for (const [path, source] of await srcsOf(WS_I_FILES)) {
      if (codeOf(source).includes('getUserMedia')) {
        throw new Error(`${path} ينادي الميكروفونَ مباشرةً بدل \`startRecording\``);
      }
    }

    const modal = codeOf(await srcOf('modals/voice-attempts.js'));
    /* النداءُ مرّةٌ واحدةٌ فقط، وهي داخلَ دالّةِ البدء. */
    expect([...modal.matchAll(/\bstartRecording\(/g)].length).toBe(1);
    const begin = modal.slice(modal.indexOf('async function beginRecording'));
    expect(begin.slice(0, begin.indexOf('\n}')).includes('startRecording(')).toBe(true);
  });

  it('٣٨ · ⚠️ ولا كتابةَ قبل «احفظ» (بند ٢٨)', async () => {
    /*
     * البندُ ٢٨ يشترط أن يكون «إلغاء» صفرَ كتابات. والاختبارُ ٢٦ يثبته
     * سلوكًا؛ وهذا يثبته **بنيةً**: النافذةُ لا تملك سبيلًا للكتابة أصلًا
     * إلّا عبر `saveAttempt` — فلا `create` ولا `update` مباشرة.
     */
    const modal = codeOf(await srcOf('modals/voice-attempts.js'));
    const direct = [...modal.matchAll(/\b(media|practiceEvidence|sceneMediaLinks)\.(create|update|put)\(/g)];
    if (direct.length) throw new Error(`النافذةُ تكتب مباشرةً: ${direct.map((m) => m[0]).join(', ')}`);
    expect(direct.length).toBe(0);

    /* وما تناديه من المستودع قراءةٌ وحدَها. */
    const repoCalls = [...modal.matchAll(/\bmedia\.(\w+)\(/g)].map((m) => m[1]);
    expect([...new Set(repoCalls)].sort().join(',')).toBe('get');
  });

  it('٣٩ · ⚠️ ولا هُويّةَ بالنصّ وحدَه (بند ١٢)', async () => {
    /*
     * لو صار النصُّ هو المفتاح لَاختلطت جملتان متطابقتان في مصدرين —
     * والاختبارُ ١٧ يمنعه سلوكًا. وهنا بنيةً: `targetKey` لا تُنتج مفتاحًا
     * بلا `segmentId`، والخدمةُ تكتب `targetId: target.key` لا النصّ.
     */
    const resolver = codeOf(await srcOf('services/shadow/practice-target.js'));
    expect(resolver.includes('if (!segmentId || !scope) return null;')).toBe(true);

    const service = codeOf(await srcOf('services/shadow/voice-attempts.js'));
    expect(service.includes('targetId: target.key')).toBe(true);

    /*
     * ⚠️ **والمقاسُ هو الكتابةُ وحدَها لا الملفُّ كلُّه — وأوّلُ صياغةٍ
     *    خلطت بينهما.** كتبتُ الشرطَ على نصّ الملفّ فسقط على
     *    `text: row.targetText` داخل `listAttempts` — وذاك **قراءةٌ**
     *    تعرض النصَّ للعرض، لا كتابةً تجعله هُويّة. فعاد الحارسُ يعاقب
     *    الصوابَ كما فعل مع `driveFileId` في WS-H.
     *
     *    فالمقيسُ الآن: وسائطُ `practiceEvidence.create` وحدَها.
     */
    const at = service.indexOf('practiceEvidence.create(');
    expect(at).toBe(service.lastIndexOf('practiceEvidence.create('));
    const write = service.slice(at, service.indexOf('});', at));

    /* `text` يُكتَب في `targetText` لا في `text` — والسببُ في ترويسة الملفّ. */
    expect(/^\s*text:/m.test(write)).toBe(false);
    expect(write.includes('targetText:')).toBe(true);
    expect(write.includes('repetitions: 0')).toBe(true);
  });

  it('٤٠ · ⚠️ ولا اسمَ متحدّثٍ في المنطوق (بند ٧)', async () => {
    /*
     * المُحلُّ **دالّةٌ خالصةٌ بلا استيرادٍ واحد**: لا DOM ولا قاعدةَ
     * بيانات ولا مخزنَ حالة. فلا سبيلَ لديه أصلًا إلى بياناتِ المتحدّث،
     * ولا إلى نصٍّ غيرِ الذي يُمرَّر إليه. وهذا أقوى من نفيِ كلمة.
     */
    const resolver = await srcOf('services/shadow/practice-target.js');
    expect(importsOf(resolver).length).toBe(0);
    const code = codeOf(resolver).toLowerCase();
    for (const word of ['speaker', 'document', 'window', 'indexeddb']) {
      if (code.includes(word)) throw new Error(`المُحلُّ لم يعد خالصًا — ذكر «${word}»`);
    }
  });

  it('٤١ · ⚠️ ومحرّكُ WS-G لم يُمَسّ (نهيٌ صريح)', async () => {
    const SYNC = [
      'change-log', 'conflicts', 'device', 'logical-state', 'merge-apply',
      'merge-planner', 'sync-package', 'sync-policy', 'sync-service',
    ].map((n) => `services/sync/${n}.js`);

    const offenders = [];
    for (const [path, source] of await srcsOf(SYNC)) {
      for (const spec of importsOf(source)) {
        if (spec.includes('/shadow/')) offenders.push(`${path} ← ${spec}`);
      }
      if (codeOf(source).includes('shadowVoice')) offenders.push(`${path}: shadowVoice`);
    }
    if (offenders.length) throw new Error(`WS-I تسرّب إلى WS-G:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);

    /*
     * وسياسةُ `practiceEvidence` كما كانت: المخزنُ نفسُه يُزامَن، فالمحاولةُ
     * تعبر الأجهزةَ بالسياسة القائمة لا بسياسةٍ كُتبت لها.
     */
    const policy = await srcOf('services/sync/sync-policy.js');
    expect(policy.includes('practiceEvidence')).toBe(true);
    expect(codeOf(policy).includes('voiceAttempt')).toBe(false);
  });
});

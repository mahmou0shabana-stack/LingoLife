/**
 * LingoLife — انحدارُ المسار الحقيقيّ (WS-H · طورُ التحقّق على جهازين)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ما يُقاس هنا: هل يُنادى الشيءُ — لا هل يعمل إن نُودي**
 * ═══════════════════════════════════════════════════════════════
 *
 * الاختباراتُ القائمةُ في `cloud.test.js` تُثبت أن كلّ قطعةٍ سليمة:
 * الرافعُ يرفع، والمنزّلُ ينزّل، والمحرّكُ يدمج. وكانت تنادي كلَّ قطعةٍ
 * **صراحةً** ثم تتحقّق.
 *
 * وذلك بالضبط ما أخفى العطبَ الذي تجده في `pushMedia`: الرافعُ كان
 * سليمًا ولم يكن يناديه أحدٌ في الدورة. فالاختبارُ يخضرّ، والمستخدمُ
 * يضغط «شغّل» على الموبايل فلا يجد بايتة.
 *
 * فقاعدةُ هذا الملفّ: **لا نداءَ يدويٌّ لقطعةٍ يفترَض أن تناديها الدورة.**
 * ندفع البيانات، ونشغّل `syncNow`، ونسأل الجهازَ الآخر.
 */

import { describe, it, expect } from './test-runner.js';
import { TABLET, MOBILE, resetDevices, on, activate, rowsOn, rowOn } from './sync-devices.js';

import { scenes, media, practiceEvidence, shadowSessions } from '../js/db/repositories.js';
import { addScript } from '../js/services/content-service.js';
import { createSession } from '../js/services/shadow/shadow-session-service.js';
import { splitWords } from '../js/services/shadow/segmenter.js';
import { SCOPE, resolveTarget, targetKey } from '../js/services/shadow/practice-target.js';
import {
  saveAttempt, listAttempts, VOICE_TARGET_TYPE,
} from '../js/services/shadow/voice-attempts.js';

import { createMockCloud, createMockTransport } from '../js/services/cloud/mock-transport.js';
import { createCloudSync } from '../js/services/cloud/cloud-sync.js';
import { createTransferManager } from '../js/services/cloud/media-transfer.js';
import { createBlobUploader } from '../js/services/cloud/media-upload.js';
import { sha256Hex } from '../js/services/cloud/transport.js';
import { createSyncPackage } from '../js/services/sync/sync-package.js';
import { setCloudFetcher, ensureBytes } from '../js/services/media-service.js';
import { findSecrets } from '../js/services/cloud/secrets.js';
import {
  JOURNAL, journal, journalRows, journalClear, journalText, journalCounts,
} from '../js/services/cloud/sync-journal.js';

/* ------------------------------------------------------------------ *
 * أدوات
 * ------------------------------------------------------------------ */

const SENTENCE = 'Протокол уже полностью заполнен, и документ направили на согласование.';

/** حجمُ التسجيل في اختبار «لا بايتات في JSON» — كبيرٌ كفايةً ليكون القياسُ حاسمًا. */
const AUDIO_BYTES = 64 * 1024;

/** بايتاتُ صوتٍ حقيقيّةٌ قابلةٌ للبصم — لا بلوبٌ من بايتين. */
function voiceBlob(seed = 1, bytes = 900) {
  const data = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) data[i] = (i * 31 + seed * 17) % 256;
  return new File([data], `صوتي-${seed}.webm`, { type: 'audio/webm' });
}

/**
 * طاقمُ جهازٍ **بنفس تركيب `attachCloud`** — لا تركيبٍ أسهلَ للاختبار.
 *
 * ⚠️ وهذا شرطُ صحّة هذا الملفّ كلِّه: لو بنينا هنا تركيبًا يختلف عن
 *    الإنتاج لَعُدنا إلى المشكلة نفسِها من بابٍ آخر.
 */
function makeRig(names = [TABLET, MOBILE]) {
  const cloud = createMockCloud();
  const rigs = {};
  for (const name of names) {
    const transport = createMockTransport(cloud);
    const uploads = createBlobUploader(transport);
    rigs[name] = {
      transport,
      uploads,
      transfers: createTransferManager(transport),
      sync: createCloudSync(transport, { debounceMs: 5, uploader: uploads }),
    };
  }
  return { cloud, rigs };
}

const syncOn = async (name, rig, options) => { activate(name); return rig.sync.syncNow(options); };
const connectOn = async (name, rig) => { activate(name); return rig.sync.connect(); };

/** يبذر جلسةَ تدريبٍ حقيقيّةً ويعيد أوّلَ مقطعٍ فيها. */
async function seedSession(title = 'بلاغُ التحقّق') {
  const scene = await scenes.create({ titleAr: 'الموافقة على المستند', date: '2026-08-27' });
  const script = await addScript(scene.id, { title, text: SENTENCE });
  const { session, segments } = await createSession({
    title, sourceType: 'script', sourceId: script.id, sceneId: scene.id, text: SENTENCE,
  });
  /*
   * ⚠️ **والحقلُ في القاعدة `sourceTextSnapshot` لا `text`** — وقد كتبتُ
   *    `text` أوّلَ مرّةٍ فسقطت أربعةُ اختباراتٍ على نصٍّ فارغ. والاسمُ
   *    مقصودٌ في المخطّط: المقطعُ يحمل **لقطةً** من نصّ المصدر لا مرجعًا
   *    إليه، فتعديلُ السكريبت لاحقًا لا يغيّر ما تدرّبتَ عليه.
   */
  return { scene, script, session, segment: normalizeSegment(segments[0]) };
}

/** يعطي المقطعَ حقلَ `text` كما تراه الشاشةُ والمحرّك. */
const normalizeSegment = (row) => (row ? { ...row, text: row.sourceTextSnapshot } : row);

/** هدفُ «الجملة كاملة» لمقطعٍ بعينه. */
const sentenceTarget = (segment, extra = {}) => ({
  key: targetKey({ segmentId: segment.id, scope: SCOPE.SENTENCE }),
  scope: SCOPE.SENTENCE,
  segmentId: segment.id,
  text: segment.text,
  ...extra,
});

/* ================================================================== *
 * ١ · القراءة: جملةٌ كاملةٌ مقابل مقطعٍ مُختار
 * ================================================================== */

describe('WS-H · القراءةُ عند حدّ النطق', () => {
  it('١ · «اقرأ الجملة» يرسل الجملةَ كاملةً بالحرف — لا جزءًا منها', () => {
    const words = splitWords(SENTENCE);
    const target = resolveTarget({ words, sentence: SENTENCE, scope: SCOPE.SENTENCE, segmentId: 'S' });

    /* ═══ مساواةٌ حرفيّة — لا `includes` ولا `startsWith` ═══ */
    expect(target.text).toBe('Протокол уже полностью заполнен, и документ направили на согласование.');
  });

  it('٢ · ⚠️ ووجودُ تحديدٍ سابقٍ لا يقتطع الجملةَ حين يُطلَب نطاقُ الجملة', () => {
    /*
     * صلبُ البلاغ: التحديدُ **حالةٌ في الشاشة**، والنطاقُ المطلوبُ هو ما
     * يقرّر. فطلبُ الجملة مع مدًى محفوظٍ في السياق يجب أن يعطي الجملةَ
     * كاملةً — لا المدى.
     */
    const words = splitWords(SENTENCE);
    const withRange = resolveTarget({
      words, sentence: SENTENCE, scope: SCOPE.SENTENCE, segmentId: 'S',
      anchor: 2, focus: 5,
    });
    expect(withRange.text).toBe(SENTENCE);
    expect(withRange.scope).toBe('sentence');
  });

  it('٣ · و«اقرأ المقطع» يرسل المقطعَ وحدَه — لا الجملة', () => {
    const words = splitWords(SENTENCE);
    const target = resolveTarget({
      words, sentence: SENTENCE, scope: SCOPE.PHRASE, segmentId: 'S', anchor: 2, focus: 5,
    });
    expect(target.text).toBe('полностью заполнен, и документ');
  });

  it('٤ · ⚠️ والاثنان لا يتساويان — فلا «إصلاحٌ» يوحّدهما', () => {
    const words = splitWords(SENTENCE);
    const whole = resolveTarget({ words, sentence: SENTENCE, scope: SCOPE.SENTENCE, segmentId: 'S' }).text;
    const part = resolveTarget({
      words, sentence: SENTENCE, scope: SCOPE.PHRASE, segmentId: 'S', anchor: 2, focus: 5,
    }).text;
    expect(whole === part).toBe(false);
    expect(whole.length > part.length).toBe(true);
  });
});

/* ================================================================== *
 * ٢ · التسجيلُ ونسبتُه — وبقاؤها بعد «إعادة الفتح»
 * ================================================================== */

describe('WS-H · نسبةُ تسجيل الظلّ وبقاؤها', () => {
  it('٥ · التسجيلُ يُنسَب إلى جملته بعينها', async () => {
    await resetDevices();
    const { segment } = await on(TABLET, () => seedSession());

    const saved = await on(TABLET, () =>
      saveAttempt({ file: voiceBlob(1), target: sentenceTarget(segment), durationMs: 1500 }));
    expect(saved.ok).toBe(true);

    const rows = await on(TABLET, () =>
      listAttempts(targetKey({ segmentId: segment.id, scope: SCOPE.SENTENCE })));
    expect(rows.length).toBe(1);
    expect(rows[0].text).toBe(SENTENCE);
    expect(rows[0].mediaId).toBe(saved.mediaId);
  });

  it('٦ · ⚠️ والنسبةُ تبقى بعد إغلاق التطبيق وفتحِه — لأنها في القاعدة لا في الذاكرة', async () => {
    await resetDevices();
    const { segment } = await on(TABLET, () => seedSession());
    const key = targetKey({ segmentId: segment.id, scope: SCOPE.SENTENCE });

    await on(TABLET, () => saveAttempt({ file: voiceBlob(2), target: sentenceTarget(segment) }));

    /*
     * ⚠️ **و«إعادةُ الفتح» هنا ليست ادّعاءً.** `on(...)` تعيد تنشيطَ
     *    الجهاز وتفتح القاعدةَ من جديد، ولا شيءَ من حالة النافذة يبقى:
     *    لا `frozen` ولا قائمةٌ في الذاكرة. فما يُقرأ الآن مقروءٌ من
     *    IndexedDB وحدَها — وهو معنى «بعد إعادة الفتح».
     */
    const afterReopen = await on(TABLET, () => listAttempts(key));
    expect(afterReopen.length).toBe(1);
    expect(afterReopen[0].scope).toBe('sentence');
    expect(afterReopen[0].text).toBe(SENTENCE);

    /* والصفُّ نفسُه يحمل هُويّةَ المقطع — لا النصَّ وحدَه. */
    const evidence = (await on(TABLET, () => practiceEvidence.getAll()))
      .filter((row) => row.targetType === VOICE_TARGET_TYPE);
    expect(evidence.length).toBe(1);
    expect(evidence[0].segmentId).toBe(segment.id);
    expect(evidence[0].targetId).toBe(key);
  });

  it('٧ · وجلسةُ الظلّ نفسُها ما زالت موجودةً وتحمل المقطع', async () => {
    await resetDevices();
    const { session, segment } = await on(TABLET, () => seedSession());
    const rows = await on(TABLET, () => shadowSessions.getAll());
    expect(rows.some((row) => row.id === session.id)).toBe(true);
    expect(segment.text).toBe(SENTENCE);
  });
});

/* ================================================================== *
 * ٣ · المسارُ الحقيقيّ: تابلت ← موبايل، بلا نداءٍ يدويّ
 * ================================================================== */

describe('WS-H · تسجيلُ الظلّ يعبر إلى الجهاز الآخر', () => {
  it('٨ · ⚠️ ودورةُ المزامنة وحدَها تكفي — لا ضغطةَ «ارفع الملفّات»', async () => {
    await resetDevices();
    const { cloud, rigs } = makeRig();

    const made = await on(TABLET, async () => {
      const { segment } = await seedSession();
      const saved = await saveAttempt({
        file: voiceBlob(3), target: sentenceTarget(segment), durationMs: 2100,
      });
      return { segment, mediaId: saved.mediaId };
    });

    await connectOn(TABLET, rigs[TABLET]);

    /* ═══ لا `uploadPending` هنا — الدورةُ وحدَها ═══ */
    const round = await syncOn(TABLET, rigs[TABLET]);
    expect(round.ok).toBe(true);
    expect(round.media.uploaded).toBe(1);

    /* والبايتاتُ فعلًا على السحابة — يُسأل الناقلُ لا التقرير. */
    activate(TABLET);
    const remote = await rigs[TABLET].transport.hasBlob(made.mediaId, 'original');
    expect(Boolean(remote)).toBe(true);

    /* والبصمةُ كُتبت في السجلّ فتُزامَن جاهزة. */
    const row = await rowOn(TABLET, 'media', made.mediaId);
    expect(row.contentHash.length).toBe(64);
    expect(Boolean(row.driveFileId)).toBe(true);

    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    /* الموبايلُ يرى الصفَّ ودليلَ الممارسة معه. */
    const onMobile = await rowOn(MOBILE, 'media', made.mediaId);
    expect(Boolean(onMobile)).toBe(true);
    expect(onMobile.contentHash).toBe(row.contentHash);

    const evidence = (await rowsOn(MOBILE, 'practiceEvidence'))
      .filter((r) => r.targetType === VOICE_TARGET_TYPE);
    expect(evidence.length).toBe(1);
    expect(evidence[0].segmentId).toBe(made.segment.id);

    /* ويشغّلها بنفس طريق الشاشة — ومعه تحقّقُ البصمة قبل الكتابة. */
    activate(MOBILE);
    setCloudFetcher((id, role) => rigs[MOBILE].transfers.ensureLocal(id, { role }));
    const got = await ensureBytes(made.mediaId);
    setCloudFetcher(null);
    expect(got.ok).toBe(true);

    const fetched = await rowOn(MOBILE, 'media', made.mediaId);
    expect(Boolean(fetched.blob)).toBe(true);
    expect(await sha256Hex(fetched.blob)).toBe(row.contentHash);
    void cloud;
  });

  it('٩ · ⚠️ ولا بايتاتِ صوتٍ خامًا داخل حزمة JSON (بند صريح)', async () => {
    await resetDevices();

    const made = await on(TABLET, async () => {
      const { segment } = await seedSession();
      const saved = await saveAttempt({ file: voiceBlob(4, AUDIO_BYTES), target: sentenceTarget(segment) });
      return saved;
    });

    const pkg = await on(TABLET, () => createSyncPackage({ peerVector: {}, peerId: null }));
    const text = JSON.stringify(pkg);

    /*
     * ⚠️ **والقياسُ ثلاثيّ، لأن كلَّ واحدٍ وحدَه يُخدَع:**
     *   · لا حقلَ `blob` في صفّ الوسيط — الحقلُ محلّيٌّ بالسياسة؛
     *   · ولا سلسلةَ base64 طويلة تشبه بايتاتٍ مهرَّبة؛
     *   · وحجمُ الحزمة صغيرٌ مقارنةً بالملفّ — فلو كان بداخلها لَانتفخت.
     */
    /*
     * ⚠️ **والصفُّ في `record` للإضافة و`payload` للحذف — لا `value`.**
     *    أخطأتُ الاسمَ مرّتين قبل أن أقرأ `sync-package.js`، والاختبارُ
     *    كان يخضرّ على مجموعةٍ فارغة… أي أنه لم يكن يفحص شيئًا. ولذلك
     *    الشرطُ `length > 0` أوّلًا: **مجموعةٌ فارغةٌ تُسقِط الاختبار**
     *    بدل أن تمرّره.
     */
    const mediaRows = pkg.changes
      .filter((change) => change.store === 'media')
      .map((change) => change.record ?? change.payload)
      .filter(Boolean);
    expect(mediaRows.length > 0).toBe(true);
    for (const row of mediaRows) {
      expect(row.blob === undefined || row.blob === null).toBe(true);
      expect(row.thumbBlob === undefined || row.thumbBlob === null).toBe(true);
    }

    expect(/[A-Za-z0-9+/]{2000,}={0,2}/.test(text)).toBe(false);

    /*
     * ⚠️ **والحدُّ يُقاس بالملفّ لا برقمٍ اخترتُه.** كتبتُه أوّلَ مرّةٍ
     *    `< 4096` فسقط لأن الحزمةَ تحمل مشهدًا وسكريبتًا وجلسةً ومقاطعَ
     *    ودليلَ ممارسة — وكلُّها سجلّاتٌ مشروعة. والادّعاءُ الحقيقيّ:
     *    البايتاتُ ليست بالداخل. فلو كانت، لَتجاوزت الحزمةُ حجمَ الملفّ
     *    نفسِه (وbase64 يزيده الثلث).
     */
    expect(text.length < AUDIO_BYTES).toBe(true);

    /*
     * ⚠️ **وبيانُ البلوبات يَعِد ولا يحمل.** هذا هو المكانُ الذي كان
     *    يمكن أن تُهرَّب فيه البايتاتُ «بحسن نيّة»: قائمةٌ فيها الوسيطُ
     *    وبصمتُه… وبايتاتُه. فنتأكّد أنه يذكر الملفَّ ولا يحمله.
     */
    expect(pkg.blobManifest.length > 0).toBe(true);
    for (const entry of pkg.blobManifest) {
      expect(entry.blob === undefined).toBe(true);
      expect(entry.bytes === undefined || typeof entry.bytes === 'number').toBe(true);
    }

    /* والبصمةُ أو المعرِّفُ هما ما يعبر — وهو المقصود. */
    void made;
  });
});

/* ================================================================== *
 * ٤ · الدورةُ الساكنة والحتميّة
 * ================================================================== */

describe('WS-H · الدورةُ الساكنة (قياسٌ بالعدّ)', () => {
  it('١٠ · ⚠️ ودورةٌ بلا تغييرٍ: صفرُ حزمٍ وصفرُ وسائطَ ونداءاتٌ قليلة', async () => {
    await resetDevices();
    const { rigs } = makeRig();

    await on(TABLET, async () => {
      const { segment } = await seedSession();
      await saveAttempt({ file: voiceBlob(5), target: sentenceTarget(segment) });
    });

    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);
    await syncOn(TABLET, rigs[TABLET]);

    /* ══ الآن كلُّ شيءٍ هادئ. نقيس دورةً إضافيّةً بلا أيّ تغيير. ══ */
    activate(TABLET);
    const before = rigs[TABLET].transport.stats();
    const idle = await syncOn(TABLET, rigs[TABLET]);
    const after = rigs[TABLET].transport.stats();

    const delta = {};
    let total = 0;
    for (const [key, value] of Object.entries(after)) {
      const d = value - (before[key] || 0);
      if (d > 0) { delta[key] = d; total += d; }
    }

    expect(idle.ok).toBe(true);
    /* لا حزمةَ صادرة… */
    expect(idle.pushed.uploaded).toBe(false);
    /* …ولا بايتةَ وسيطٍ تُرفَع، ولا حتى محاولة. */
    expect(idle.media.ran).toBe(false);
    expect(idle.media.uploaded).toBe(0);
    expect((delta.putBlob || 0)).toBe(0);
    expect((delta.pushPackage || 0)).toBe(0);

    /*
     * ⚠️ **والنداءاتُ الباقيةُ استكشافٌ لا رفع**: اكتشافُ الكون، وسردُ
     *    الحزم، وسردُ حالات الأجهزة. وهي الحدُّ الأدنى الذي لا يمكن
     *    الاستغناءُ عنه: بدونها لا يعرف الجهازُ أن جارَه كتب شيئًا.
     *    فالسقفُ هنا يحرس ألّا يتسلّل نداءٌ زائدٌ بلا انتباه.
     */
    expect(total <= 6).toBe(true);
  });

  it('١١ · ⚠️ وتطبيقُ نفس الحزمة مرّتين لا يضاعف سجلًّا واحدًا', async () => {
    await resetDevices();
    const { rigs } = makeRig();

    const made = await on(TABLET, async () => {
      const { segment } = await seedSession();
      const saved = await saveAttempt({ file: voiceBlob(6), target: sentenceTarget(segment) });
      return { segment, mediaId: saved.mediaId };
    });

    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const countOnce = (await rowsOn(MOBILE, 'practiceEvidence'))
      .filter((r) => r.targetType === VOICE_TARGET_TYPE).length;
    const mediaOnce = (await rowsOn(MOBILE, 'media')).length;

    /* ═══ نفسُ الحزمة تُقرأ وتُطبَّق ثانيةً وثالثة ═══ */
    await syncOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const countThrice = (await rowsOn(MOBILE, 'practiceEvidence'))
      .filter((r) => r.targetType === VOICE_TARGET_TYPE).length;
    const mediaThrice = (await rowsOn(MOBILE, 'media')).length;

    expect(countThrice).toBe(countOnce);
    expect(mediaThrice).toBe(mediaOnce);
    expect(countOnce).toBe(1);

    /* والنسبةُ لم تتبدّل مع التكرار. */
    const rows = (await rowsOn(MOBILE, 'practiceEvidence'))
      .filter((r) => r.targetType === VOICE_TARGET_TYPE);
    expect(rows[0].segmentId).toBe(made.segment.id);
    expect(rows[0].mediaId).toBe(made.mediaId);
  });

  it('١٢ · والعودةُ من الموبايل إلى التابلت تصل بدورةٍ واحدةٍ لكلٍّ', async () => {
    await resetDevices();
    const { rigs } = makeRig();

    const seed = await on(TABLET, () => seedSession());
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    /* الموبايلُ يسجّل على نفس الجملة. */
    const fromMobile = await on(MOBILE, async () => {
      const segment = (await rowsOn(MOBILE, 'shadowSegments'))
        .map(normalizeSegment)
        .find((row) => row.text === SENTENCE);
      expect(Boolean(segment)).toBe(true);
      return saveAttempt({ file: voiceBlob(7), target: sentenceTarget(segment) });
    });
    expect(fromMobile.ok).toBe(true);

    await syncOn(MOBILE, rigs[MOBILE]);
    await syncOn(TABLET, rigs[TABLET]);

    const back = (await rowsOn(TABLET, 'practiceEvidence'))
      .filter((r) => r.targetType === VOICE_TARGET_TYPE);
    expect(back.length).toBe(1);
    expect(back[0].mediaId).toBe(fromMobile.mediaId);

    const bytes = await rowOn(TABLET, 'media', fromMobile.mediaId);
    expect(Boolean(bytes)).toBe(true);
    void seed;
  });
});

/* ================================================================== *
 * ٥ · الدفتر: يقول ما يكفي، ولا يقول سرًّا
 * ================================================================== */

describe('WS-H · دفترُ المزامنة', () => {
  it('١٣ · يسجّل الدورةَ والحزمَ والوسائطَ بما يكفي للتشخيص', async () => {
    await resetDevices();
    journalClear();
    const { rigs } = makeRig();

    await on(TABLET, async () => {
      const { segment } = await seedSession();
      await saveAttempt({ file: voiceBlob(8), target: sentenceTarget(segment) });
    });

    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    const counts = journalCounts();
    expect((counts[JOURNAL.SYNC_START] || 0) >= 1).toBe(true);
    expect((counts[JOURNAL.SYNC_END] || 0) >= 1).toBe(true);
    expect((counts[JOURNAL.PKG_DISCOVERED] || 0) >= 1).toBe(true);
    expect((counts[JOURNAL.PKG_UPLOADED] || 0) >= 1).toBe(true);
    expect((counts[JOURNAL.MEDIA_UPLOADED] || 0) >= 1).toBe(true);

    /* وسطرُ النهاية يحمل عددَ النداءات — وهو ما يُقرأ عند شكوى البطء. */
    const end = journalRows({ event: JOURNAL.SYNC_END }).pop();
    expect(typeof end.apiCalls).toBe('number');
    expect(typeof end.ms).toBe('number');
    expect(end.mediaUploaded).toBe(1);
  });

  it('١٤ · ⚠️ ورمزٌ يُحقَن صراحةً لا يخرج في الدفتر ولا في نصّه', async () => {
    journalClear();

    /*
     * ⚠️ **الحقنُ متعمَّدٌ وبكلّ الأشكال التي رأيتُها تتسرّب:**
     *   · مفتاحٌ محظورٌ صريح؛
     *   · مفتاحٌ بريءُ الاسم قيمتُه ترويسةُ تفويض؛
     *   · رمزُ Google بشكله المعروف داخل نصٍّ حرّ؛
     *   · وسرٌّ مدفونٌ على عمق ثلاث طبقات.
     */
    journal(JOURNAL.NOTE, {
      access_token: 'ya29.SECRET-TOP-LEVEL',
      detail: 'Authorization: Bearer ya29.SECRET-IN-TEXT',
      nested: { deeper: { accessToken: 'ya29.SECRET-DEEP' } },
      harmless: 'كلُّ شيءٍ تمام',
    });

    const rows = journalRows();
    const text = journalText();

    expect(findSecrets(rows).length).toBe(0);
    expect(text.includes('SECRET-TOP-LEVEL')).toBe(false);
    expect(text.includes('SECRET-IN-TEXT')).toBe(false);
    expect(text.includes('SECRET-DEEP')).toBe(false);
    expect(text.includes('ya29.')).toBe(false);
    expect(text.includes('Bearer')).toBe(false);

    /* والحقلُ البريءُ يبقى — فالتنقيةُ ليست محوًا للدفتر. */
    expect(text.includes('كلُّ شيءٍ تمام')).toBe(true);
  });

  it('١٥ · ⚠️ ونوعٌ غيرُ معلَنٍ يُكتَب «unknown» ولا يمرّ بلا انتباه', () => {
    journalClear();
    journal('something.invented', { a: 1 });
    const row = journalRows()[0];
    expect(row.event).toBe('unknown');
    expect(row.raw).toBe('something.invented');
  });

  it('١٦ · والدفترُ لا يرمي مهما أُعطي — لأنه أداةُ مراقبةٍ لا طرفٌ في الدورة', () => {
    journalClear();
    const cyclic = { name: 'دائريّ' };
    cyclic.self = cyclic;
    /* لو رمى هذا لَأسقط دورةَ مزامنةٍ حقيقيّة. */
    expect(Boolean(journal(JOURNAL.NOTE, cyclic))).toBe(true);
    expect(Boolean(journal(JOURNAL.NOTE, null))).toBe(true);
    expect(journalRows().length >= 2).toBe(true);
  });
});

/**
 * LingoLife — حادثةُ الجهازين الحقيقيّة: تابلتٌ ناضجٌ وموبايلٌ لا يصله شيء
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الشرطُ الذي لم يصنعه أيُّ اختبارٍ قبل اليوم**
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ اختباراتِ المزامنة القائمة تبني بياناتِها **بعد** أن صار
 * `changeLog` موجودًا — فالسجلُّ ممتلئٌ عندها دائمًا، والحزمةُ
 * التفاضليّةُ تحمل كلَّ شيءٍ صدفةً. حتى الاختباران المسمّيان «خطّ أساس»
 * (٤٦ و٤٧ في `sync.test.js`) يفعلان ذلك.
 *
 * والواقعُ غيرُ ذلك: التابلتُ عاش سنةً قبل v17. فحين وصلت الترقيةُ
 * وجدت مئاتِ الصفوف و**أنشأت سجلًّا فارغًا**. فلا سطرَ يصف تلك الصفوف،
 * ولا حزمةَ تحملها، ولا شيءَ يصل الموبايلَ — والاثنان يقولان «تمّت
 * المزامنة».
 *
 * فالسطرُ الفاصلُ في هذا الملفّ هو `ageDatabase()`: يُفرِّغ السجلَّ
 * ويترك الصفوفَ — أي يصنع «قاعدةً أقدمَ من سجلِّها» بالضبط.
 *
 * ⚠️ **ولا نداءَ يدويٌّ لشيءٍ يفترَض أن تفعله الدورة.** لا
 *    `publishBaseline` ولا `uploadPending` ولا حقنَ حزمة. ندفع
 *    البيانات، ونضغط ما يضغطه الزرّ، ونسأل الجهازَ الآخر.
 */

import { describe, it, expect } from './test-runner.js';
import { TABLET, MOBILE, resetDevices, on, activate, rowsOn, rowOn } from './sync-devices.js';

import { scenes, media, shadowSessions } from '../js/db/repositories.js';
import { addScript } from '../js/services/content-service.js';
import { createSession } from '../js/services/shadow/shadow-session-service.js';
import { withTx, req } from '../js/db/database.js';
import { deviceId, localDevice } from '../js/services/sync/device.js';
import { baselineStatus, publishBaseline, baselineStores } from '../js/services/sync/baseline.js';

import { createMockCloud, createMockTransport } from '../js/services/cloud/mock-transport.js';
import { createCloudSync } from '../js/services/cloud/cloud-sync.js';
import { createTransferManager } from '../js/services/cloud/media-transfer.js';
import { createBlobUploader } from '../js/services/cloud/media-upload.js';
import { sha256Hex } from '../js/services/cloud/transport.js';
import { setCloudFetcher, ensureBytes } from '../js/services/media-service.js';
import { syncSummary } from '../js/views/cloud-actions.js';

/* ------------------------------------------------------------------ *
 * أدوات
 * ------------------------------------------------------------------ */

const SENTENCE = 'Протокол уже полностью заполнен, и документ направили на согласование.';
const MARK = 'ذكرى التابلت التي لا تُخطئها العين';

function bytesOf(seed = 1, n = 700) {
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = (i * 29 + seed * 13) % 256;
  return new Blob([data], { type: 'audio/webm' });
}

/**
 * طاقمُ جهازٍ **بنفس تركيب `attachCloud`** — لا تركيبٍ أسهل.
 * (الدرسُ الذي سبق: طاقمٌ يخالف الإنتاجَ يوافقه في العطب فيخفيه.)
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

const syncOn = async (name, rig) => { activate(name); return rig.sync.syncNow(); };
const connectOn = async (name, rig) => { activate(name); return rig.sync.connect(); };

/**
 * ⚠️ **«يُشيخ» القاعدةَ: صفوفٌ بلا سجلّ.**
 *    وهذا ما تتركه ترقيةُ v17 حرفيًّا على جهازٍ فيه بيانات — مخزنُ
 *    سجلٍّ جديدٌ فارغ، وبياناتٌ لا يعرفها.
 */
async function ageDatabase() {
  await withTx('changeLog', 'readwrite', (tx) => req(tx.objectStore('changeLog').clear()));
}

/** بياناتٌ ناضجةٌ كالتي على التابلت. */
async function buildMature() {
  const scene = await scenes.create({ titleAr: MARK, date: '2025-03-14' });
  const script = await addScript(scene.id, { title: 'نصُّ التابلت', text: SENTENCE });
  const { session, segments } = await createSession({
    title: 'جلسةُ التابلت', sourceType: 'script', sourceId: script.id,
    sceneId: scene.id, text: SENTENCE,
  });
  const audio = await media.create({
    kind: 'audio', mime: 'audio/webm', blob: bytesOf(1), bytes: 700, filename: 'tablet.webm',
  });
  return {
    scene: scene.id, script: script.id, session: session.id,
    segment: segments[0].id, audio: audio.id,
  };
}

/* ================================================================== *
 * ١ · الحادثة بعينها
 * ================================================================== */

describe('WS-H · حادثةُ «تمّت المزامنة» وما وصل شيء', () => {
  it('١ · ⚠️ قاعدةٌ أقدمُ من سجلِّها = صفوفٌ بلا تغطية (إعادةُ إنتاج الشرط)', async () => {
    await resetDevices();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);

    const status = await on(TABLET, () => baselineStatus());
    /* الصفوفُ باقية… */
    expect((await rowsOn(TABLET, 'scenes')).length).toBe(1);
    /* …والسجلُّ لا يعرف منها شيئًا. */
    expect((await rowsOn(TABLET, 'changeLog')).length).toBe(0);
    expect(status.pending > 0).toBe(true);
  });

  it('٢ · ⚠️ والتابلتُ ينشرها بدورةٍ عاديّةٍ واحدة — بلا زرٍّ خاصّ', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);

    await connectOn(TABLET, rigs[TABLET]);
    const round = await syncOn(TABLET, rigs[TABLET]);

    expect(round.ok).toBe(true);
    expect(round.baseline.written > 0).toBe(true);
    /* ═══ وهذا هو السطرُ الذي كان `false` قبل الإصلاح ═══ */
    expect(round.pushed.uploaded).toBe(true);
    expect(round.counts.changesUploaded > 0).toBe(true);
  });

  it('٣ · ⚠️⚠️ والموبايلُ يستقبلها بدورةٍ واحدة — الحادثةُ بعينها', async () => {
    await resetDevices();
    const { rigs } = makeRig();

    /* ── التابلت: قاعدةٌ ناضجةٌ سبقت السحابة ── */
    const made = await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    /* ── الموبايل: بياناتُه الخاصّةُ التي لا علاقةَ لها ── */
    const own = await on(MOBILE, async () => {
      const scene = await scenes.create({ titleAr: 'ذكرى الموبايل وحدَه', date: '2026-02-02' });
      return scene.id;
    });

    await connectOn(MOBILE, rigs[MOBILE]);
    const got = await syncOn(MOBILE, rigs[MOBILE]);

    /* ═══ ذكرى التابلت موجودةٌ عبر مسار القراءة العاديّ ═══ */
    const arrived = await rowOn(MOBILE, 'scenes', made.scene);
    expect(Boolean(arrived)).toBe(true);
    expect(arrived.titleAr).toBe(MARK);

    expect(Boolean(await rowOn(MOBILE, 'scripts', made.script))).toBe(true);
    expect(Boolean(await rowOn(MOBILE, 'shadowSessions', made.session))).toBe(true);
    expect(Boolean(await rowOn(MOBILE, 'shadowSegments', made.segment))).toBe(true);
    expect(Boolean(await rowOn(MOBILE, 'media', made.audio))).toBe(true);

    /* ⚠️ وبياناتُ الموبايل الخاصّةُ لم تُمسّ. */
    expect(Boolean(await rowOn(MOBILE, 'scenes', own))).toBe(true);

    /* والعدّادُ يقول ما حدث فعلًا. */
    expect(got.counts.packagesDiscovered >= 1).toBe(true);
    expect(got.counts.recordsApplied > 0).toBe(true);
  });

  it('٤ · وثلاثُ دوراتٍ إضافيّةٍ لا تُضاعف صفًّا واحدًا', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    const made = await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const once = {
      scenes: (await rowsOn(MOBILE, 'scenes')).length,
      scripts: (await rowsOn(MOBILE, 'scripts')).length,
      media: (await rowsOn(MOBILE, 'media')).length,
      segments: (await rowsOn(MOBILE, 'shadowSegments')).length,
    };

    await syncOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    expect((await rowsOn(MOBILE, 'scenes')).length).toBe(once.scenes);
    expect((await rowsOn(MOBILE, 'scripts')).length).toBe(once.scripts);
    expect((await rowsOn(MOBILE, 'media')).length).toBe(once.media);
    expect((await rowsOn(MOBILE, 'shadowSegments')).length).toBe(once.segments);
    expect(Boolean(await rowOn(MOBILE, 'scenes', made.scene))).toBe(true);
  });

  it('٥ · والعودةُ: تعديلٌ جديدٌ على الموبايل يصل التابلت', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const fresh = await on(MOBILE, async () => {
      const scene = await scenes.create({ titleAr: 'كتبها الموبايل بعد اللقاء', date: '2026-08-28' });
      return scene.id;
    });

    await syncOn(MOBILE, rigs[MOBILE]);
    await syncOn(TABLET, rigs[TABLET]);

    const back = await rowOn(TABLET, 'scenes', fresh);
    expect(Boolean(back)).toBe(true);
    expect(back.titleAr).toBe('كتبها الموبايل بعد اللقاء');
  });

  it('٦ · ودورةٌ ساكنةٌ بعد الالتقاء = صفرٌ حقيقيّ', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);
    await syncOn(TABLET, rigs[TABLET]);

    const idleA = await syncOn(TABLET, rigs[TABLET]);
    const idleB = await syncOn(MOBILE, rigs[MOBILE]);

    for (const idle of [idleA, idleB]) {
      expect(idle.ok).toBe(true);
      expect(idle.baseline.written).toBe(0);
      expect(idle.counts.recordsApplied).toBe(0);
      expect(idle.counts.mediaUploaded).toBe(0);
      expect(idle.pushed.uploaded).toBe(false);
    }
  });
});

/* ================================================================== *
 * ٢ · خطُّ الأساس: حتميّةٌ واستئنافٌ وحدود
 * ================================================================== */

describe('WS-H · خطُّ الأساس', () => {
  it('٧ · ⚠️ حتميّ: تشغيلُه مرّتين لا يكتب سطرًا ثانيًا لنفس الصفّ', async () => {
    await resetDevices();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);

    const first = await on(TABLET, () => publishBaseline());
    const logAfterFirst = (await rowsOn(TABLET, 'changeLog')).length;

    const second = await on(TABLET, () => publishBaseline());
    const logAfterSecond = (await rowsOn(TABLET, 'changeLog')).length;

    expect(first.written > 0).toBe(true);
    expect(second.written).toBe(0);
    expect(logAfterSecond).toBe(logAfterFirst);
  });

  it('٨ · وقابلٌ للاستئناف: سقفٌ يترك الباقيَ ويكمله النداءُ التالي', async () => {
    await resetDevices();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);

    const before = await on(TABLET, () => baselineStatus());
    expect(before.pending > 2).toBe(true);

    const part = await on(TABLET, () => publishBaseline({ batch: 1, limit: 2 }));
    expect(part.complete).toBe(false);
    expect(part.written).toBe(2);
    expect(part.remaining > 0).toBe(true);

    const rest = await on(TABLET, () => publishBaseline());
    expect(rest.complete).toBe(true);

    const after = await on(TABLET, () => baselineStatus());
    expect(after.pending).toBe(0);
  });

  it('٩ · ⚠️ ولا يلمس صفَّ بياناتٍ واحدًا — يكتب في السجلّ فقط', async () => {
    await resetDevices();
    const made = await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);

    const sceneBefore = await rowOn(TABLET, 'scenes', made.scene);
    await on(TABLET, () => publishBaseline());
    const sceneAfter = await rowOn(TABLET, 'scenes', made.scene);

    expect(sceneAfter.rev).toBe(sceneBefore.rev);
    expect(sceneAfter.updatedAt).toBe(sceneBefore.updatedAt);
    expect(sceneAfter.titleAr).toBe(sceneBefore.titleAr);
  });

  it('١٠ · ولا ينشر مخزنًا مشتقًّا ولا محلّيًّا', async () => {
    const stores = baselineStores();
    /* المشتقُّ يُعاد بناؤه عند الجار، والمحلّيُّ لا يغادر أصلًا. */
    expect(stores.includes('searchIndex')).toBe(false);
    expect(stores.includes('changeLog')).toBe(false);
    expect(stores.includes('syncPeers')).toBe(false);
    /* والأصليُّ يُنشَر. */
    expect(stores.includes('scenes')).toBe(true);
    expect(stores.includes('media')).toBe(true);
  });
});

/* ================================================================== *
 * ٣ · هُويّةُ الجهاز
 * ================================================================== */

describe('WS-H · هُويّةُ الجهاز', () => {
  it('١١ · ⚠️ جهازان = هُويّتان مختلفتان', async () => {
    await resetDevices();
    activate(TABLET);
    const a = deviceId();
    activate(MOBILE);
    const b = deviceId();

    expect(typeof a).toBe('string');
    expect(a.length > 0).toBe(true);
    expect(a === b).toBe(false);
  });

  it('١٢ · والهُويّةُ ثابتةٌ عبر القراءات المتكرّرة على نفس الجهاز', async () => {
    activate(TABLET);
    const first = deviceId();
    const second = deviceId();
    const third = localDevice().id;
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('١٣ · ⚠️ ولا تُشتقّ من حسابٍ ولا تُنقَل في حزمة', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(TABLET);
    const a = deviceId();
    activate(MOBILE);
    const b = deviceId();

    /*
     * ⚠️ **الجهازان على نفس الحساب ونفس الكون، وتبادلا حزمًا كاملة.**
     *    فلو كانت الهُويّةُ مشتقّةً من الحساب، أو عبرت في حزمةٍ فكُتبت
     *    عند الجار، لَتساوتا هنا — ولَصار كلُّ جهازٍ يستثني حزمَ الآخر
     *    ظنًّا أنها حزمُه هو. وهذا بالضبط أحدُ الاحتمالات التي طُلب
     *    نفيُها.
     */
    expect(a === b).toBe(false);
  });

  it('١٤ · وحزمةُ التابلت ليست مستثناةً عند الموبايل', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    const made = await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    /* ⚠️ والاتّصالُ قبل السؤال — الناقلُ يرفض الاستعلامَ قبله عمدًا. */
    await connectOn(MOBILE, rigs[MOBILE]);
    const listed = await rigs[MOBILE].transport.listPackages({ exclude: deviceId() });
    expect(listed.length >= 1).toBe(true);

    const got = await syncOn(MOBILE, rigs[MOBILE]);
    expect(got.counts.packagesDownloaded >= 1).toBe(true);
    expect(Boolean(await rowOn(MOBILE, 'scenes', made.scene))).toBe(true);
  });
});

describe('WS-H · ترتيبُ الحزمة يخصّ مؤلِّفَها', () => {
  it('١٤ب · ⚠️ وحزمتان متتاليتان من نفس الجهاز لا تحملان اسمًا واحدًا', async () => {
    /*
     * ⚠️ **العطبُ الثاني بعينه.** بعد أن يستقبل الموبايلُ خطَّ أساسِ
     *    التابلت يصير أعلى رقمٍ في متّجهه رقمَ **التابلت**. وكان اسمُ
     *    الملفّ يُشتقّ من ذلك الأعلى، فتأخذ كلُّ حزمةٍ يرفعها الموبايلُ
     *    بعدها نفسَ الاسم — فيقول الناقلُ «موجودةٌ سلفًا» ويضيع التغيير.
     */
    await resetDevices();
    const { rigs } = makeRig();
    await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const one = await on(MOBILE, async () =>
      (await scenes.create({ titleAr: 'أولى', date: '2026-08-01' })).id);
    await syncOn(MOBILE, rigs[MOBILE]);
    const two = await on(MOBILE, async () =>
      (await scenes.create({ titleAr: 'تانية', date: '2026-08-02' })).id);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(TABLET);
    await syncOn(TABLET, rigs[TABLET]);

    /* ═══ الاثنتان تصلان — لا واحدةٌ تمحو الأخرى ═══ */
    expect(Boolean(await rowOn(TABLET, 'scenes', one))).toBe(true);
    expect(Boolean(await rowOn(TABLET, 'scenes', two))).toBe(true);
  });
});

/* ================================================================== *
 * ٤ · الوسائط: وصفٌ يصل، وبايتاتٌ عند الطلب
 * ================================================================== */

describe('WS-H · الوسائط بعد الالتقاء', () => {
  it('١٥ · وصفُ الوسيط يصل، وبايتاتُه تبقى كسولةً حتى تُطلَب', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    const made = await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const row = await rowOn(MOBILE, 'media', made.audio);
    expect(Boolean(row)).toBe(true);
    /* ⚠️ ولا بايتةَ نزلت — وهذا مقصود: ٣٣١ ميجابايت لا تُجلَب لتزامنِ سجلّات. */
    expect(Boolean(row.blob)).toBe(false);
    expect(typeof row.contentHash).toBe('string');
  });

  it('١٦ · وطلبُها يجلبها بالبصمة الصحيحة عبر المسار العاديّ', async () => {
    await resetDevices();
    const { rigs } = makeRig();
    const made = await on(TABLET, buildMature);
    await on(TABLET, ageDatabase);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const expected = (await rowOn(TABLET, 'media', made.audio)).contentHash;

    activate(MOBILE);
    setCloudFetcher((id, role) => rigs[MOBILE].transfers.ensureLocal(id, { role }));
    const got = await ensureBytes(made.audio);
    setCloudFetcher(null);

    expect(got.ok).toBe(true);
    const after = await rowOn(MOBILE, 'media', made.audio);
    expect(Boolean(after.blob)).toBe(true);
    expect(await sha256Hex(after.blob)).toBe(expected);
  });
});

/* ================================================================== *
 * ٥ · نصُّ النتيجة — لا «كل حاجة متزامنة» إلّا بحقّها
 * ================================================================== */

describe('WS-H · صدقُ نصّ النتيجة', () => {
  it('١٧ · ⚠️ ولا يقول «كل حاجة متزامنة» أبدًا', () => {
    const samples = [
      syncSummary(null),
      syncSummary({}),
      syncSummary({ recordsReceived: 10, recordsApplied: 10 }),
      syncSummary({ packagesDiscovered: 3, packagesApplied: 0 }),
      syncSummary({ packagesFailed: 2 }),
      syncSummary({ baselinePublished: 412, changesUploaded: 412 }),
    ];
    for (const text of samples) {
      expect(text.includes('كل حاجة متزامنة')).toBe(false);
    }
  });

  it('١٨ · ودورةٌ بلا جديدٍ تقول أصفارَها صراحة', () => {
    const text = syncSummary({});
    expect(text).toContain('مفيش تغييرات جديدة');
    expect(text).toContain('رفع 0');
    expect(text).toContain('تنزيل 0');
  });

  it('١٩ · ⚠️ وحزمٌ اكتُشفت ولم تُطبَّق لا تُعرَض نجاحًا صامتًا', () => {
    const text = syncSummary({ packagesDiscovered: 4, packagesApplied: 0 });
    expect(text).toContain('4');
    expect(text).toContain('ما اتطبّقش');
    expect(text.includes('مفيش تغييرات جديدة')).toBe(false);
  });

  it('٢٠ · وفشلُ تطبيقِ حزمةٍ يُعلَن بعلامة تحذير', () => {
    const text = syncSummary({ packagesFailed: 2, recordsReceived: 5, recordsApplied: 5 });
    expect(text).toContain('⚠️');
    expect(text).toContain('ما اتطبّقتش');
  });

  it('٢١ · والنجاحُ يقول أرقامَه: نزّلنا · طبّقنا · الموجود سلفًا', () => {
    const text = syncSummary({
      recordsReceived: 428, recordsApplied: 421, recordsUnchanged: 7, mediaPending: 3,
    });
    expect(text).toContain('428');
    expect(text).toContain('421');
    expect(text).toContain('7');
    expect(text).toContain('3');
  });
});

/* ================================================================== *
 * ٦ · حارسٌ: لا حرفَ تحكّمٍ خامّ في الشجرة
 * ================================================================== */

describe('WS-H · نظافةُ المصدر', () => {
  it('٢٢ · ⚠️ ولا بايتَ تحكّمٍ خامّ في ملفّات المزامنة', async () => {
    /*
     * ⚠️ **وقعت فيها مرّتين.** فاصلُ مفاتيحَ كتبتُه حرفًا غيرَ مرئيّ
     *    فصار `baseline.js` «ملفًّا ثنائيًّا» لا يظهر في `grep`؛ ثم
     *    نظّفتُ البايتات فاختفى الفاصلُ والتصق المفتاحان — تصادمٌ صامت.
     *    فالحارسُ هنا يمنع الاثنين: الهروبُ مسموح، والحرفُ الخامُّ لا.
     */
    const files = [
      'services/sync/baseline.js', 'services/sync/change-log.js',
      'services/sync/sync-package.js', 'services/cloud/cloud-sync.js',
      'services/cloud/sync-journal.js',
    ];
    const offenders = [];
    for (const path of files) {
      /* eslint-disable-next-line no-await-in-loop */
      const text = await fetch(`../js/${path}`).then((r) => r.text());
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        const ok = code === 9 || code === 10 || code === 13 || code >= 32;
        if (!ok) { offenders.push(`${path}@${i} = U+${code.toString(16)}`); break; }
      }
    }
    if (offenders.length) throw new Error(`حرفُ تحكّمٍ خامّ:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);
  });
});

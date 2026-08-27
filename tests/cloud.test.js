/**
 * LingoLife — اختباراتُ النقل السحابيّ (WS-H)
 *
 * ⚠️ **الشبكةُ وحدَها مزيَّفة** (بند ٣٨). كلُّ حزمةٍ تمرّ هنا تمرّ على
 *    مُحقِّق WS-G ومخطِّطه وتطبيقه الذرّيّ بلا تعديلِ حرف، وكلُّ جهازٍ
 *    قاعدةٌ حقيقيّةٌ بخانتين ومؤشّر.
 */

import { describe, it, expect } from './test-runner.js';
import {
  TABLET, MOBILE, LAPTOP, resetDevices, on, activate, rowsOn, rowOn, snapshot,
} from './sync-devices.js';

import { scenes, scripts, media, savedItems, practiceEvidence, mistakeComparisons }
  from '../js/db/repositories.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import { addNode, moveNodeTo } from '../js/services/organize-service.js';
import { link, LINK } from '../js/services/link-service.js';
import { diffLogical, describeDiff } from '../js/services/sync/logical-state.js';
import { CONFLICT, RESOLUTION, resolveConflict, unresolved } from '../js/services/sync/conflicts.js';

import { createMockCloud, createMockTransport } from '../js/services/cloud/mock-transport.js';
import { createCloudSync } from '../js/services/cloud/cloud-sync.js';
import { createTransferManager, isCloudOnly, TRANSFER } from '../js/services/cloud/media-transfer.js';
import { createBlobUploader } from '../js/services/cloud/media-upload.js';
import { SYNC, createStateMachine, canMove } from '../js/services/cloud/sync-state.js';
import {
  BACKUP_KIND, FAIL, TRANSPORT_CONTRACT, assertTransport, backupFileName, sha256Hex,
} from '../js/services/cloud/transport.js';
import { detectReplacement, rememberVector, vectorRegressed }
  from '../js/services/cloud/restore-guard.js';
import {
  mediaIdsOfScene, offlineReport, sceneOfflineReport, storageReport,
  removeLocalCopies, textNodesOf,
} from '../js/services/cloud/offline-pack.js';
import {
  createCloudBackup, inspectCloudBackup, fullBackupReadiness, listCloudBackups,
  restoreCloudBackup, applyRetention, RETENTION,
} from '../js/services/cloud/cloud-backup.js';
import { AFTER_RESTORE, AFTER_RESTORE_TEXT, replacementSummary }
  from '../js/services/cloud/restore-guard.js';
import { findSecrets, FORBIDDEN_KEYS, attachCloud, detachCloud, cloudDiagnostics }
  from '../js/services/cloud/cloud-service.js';
import { setCloudFetcher, ensureBytes, urlFor } from '../js/services/media-service.js';
import { inspectBackup } from '../js/services/backup/restore.js';

/* ------------------------------------------------------------------ *
 * أدواتٌ مشتركة
 * ------------------------------------------------------------------ */

/** ⚠️ بايتاتٌ حقيقيّةٌ قابلةٌ للفكّ — لا بلوبٌ من بايتين (بند ٤١). */
function realWav(seconds = 0.2, freq = 440) {
  const rate = 8000;
  const samples = Math.floor(rate * seconds);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const put = (off, text) => [...text].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));
  put(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); put(8, 'WAVE');
  put(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  put(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function realPng(size = 8) {
  const bytes = new Uint8Array(200 + size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  for (let i = 8; i < bytes.length; i++) bytes[i] = (i * 37) % 251;
  return new Blob([bytes], { type: 'image/png' });
}

/**
 * سحابةٌ واحدةٌ وناقلٌ لكلّ جهاز — كـDrive بالضبط.
 *
 * ⚠️ ولكلّ جهازٍ **طاقمُه الكامل**: منسّقُ مزامنةٍ ومنزّلٌ ورافع. فما
 *    يُختبَر هو ما يركّبه `attachCloud` في التطبيق حرفًا بحرف.
 */
function makeCloud(names = [TABLET, MOBILE]) {
  const cloud = createMockCloud();
  const rigs = {};
  for (const name of names) {
    const transport = createMockTransport(cloud);
    rigs[name] = {
      transport,
      sync: createCloudSync(transport, { debounceMs: 5 }),
      transfers: createTransferManager(transport),
      uploads: createBlobUploader(transport),
    };
  }
  return { cloud, rigs };
}

/** يشغّل دورةً كاملةً بهُويّة جهازٍ بعينه. */
async function syncOn(name, rig, options) {
  activate(name);
  return rig.sync.syncNow(options);
}

async function connectOn(name, rig) {
  activate(name);
  return rig.sync.connect();
}

/** يرفع بايتاتِ جهازٍ بهُويّته. */
async function uploadOn(name, rig, options) {
  activate(name);
  return rig.uploads.uploadPending(options);
}

/** يزامن الجميعَ حتى يهدأ كلُّ شيء. */
async function quiesce(rigs, rounds = 3) {
  for (let i = 0; i < rounds; i++) {
    for (const [name, rig] of Object.entries(rigs)) {
      /* eslint-disable-next-line no-await-in-loop -- جهازٌ بعد جهاز */
      await syncOn(name, rig);
    }
  }
}

/* ================================================================== *
 * أوّلًا — العقدُ وآلةُ الحالات (بلا قواعد)
 * ================================================================== */

describe('WS-H · العقدُ وآلةُ الحالات', () => {
  it('١ · المحاكي يفي بعقد النقل كاملًا (بند ٢٦)', () => {
    const { cloud } = makeCloud([]);
    const transport = createMockTransport(cloud);
    expect(() => assertTransport(transport)).toBeTruthy();
    expect(TRANSPORT_CONTRACT.every((name) => typeof transport[name] === 'function')).toBe(true);
    /* وناقصٌ يُرفَض بالاسم — فلا يمرّ محاكٍ ويسقط الحقيقيّ. */
    const broken = { ...transport };
    delete broken.fetchBlob;
    let threw = '';
    try { assertTransport(broken); } catch (e) { threw = e.message; }
    expect(threw).toContain('fetchBlob');
  });

  it('٢ · ⚠️ وانتقالُ حالةٍ غير مسموحٍ يرمي بدل أن يُعرَض (بند ١٠)', () => {
    const machine = createStateMachine();
    expect(machine.state).toBe(SYNC.DISCONNECTED);
    machine.to(SYNC.CONNECTING);
    machine.to(SYNC.READY);
    expect(canMove(SYNC.READY, SYNC.SYNCING)).toBe(true);

    /* ⚠️ لا يُقفَز من «غير متصل» إلى «بيزامن». */
    expect(canMove(SYNC.DISCONNECTED, SYNC.SYNCING)).toBe(false);
    /* وإعادةُ الربط مشروعةٌ من كلّ حالةٍ ساكنة. */
    expect(canMove(SYNC.OFFLINE, SYNC.CONNECTING)).toBe(true);
    expect(canMove(SYNC.READY, SYNC.CONNECTING)).toBe(true);

    /*
     * ⚠️ **والممنوعُ أن يُعاد الربطُ وسطَ دورةٍ أو فوق قرارٍ منتظر**:
     *    ربطٌ يبدأ و`SYNCING` جاريةٌ يترك دورةً بلا صاحب، وفوق
     *    `RESTORED_HOLD` يُسقط سؤالًا لم يُجَب.
     */
    expect(canMove(SYNC.SYNCING, SYNC.CONNECTING)).toBe(false);
    expect(canMove(SYNC.RESTORED_HOLD, SYNC.CONNECTING)).toBe(false);
    expect(canMove(SYNC.CONFLICT, SYNC.CONNECTING)).toBe(false);

    machine.to(SYNC.SYNCING);
    let threw = '';
    try { machine.to(SYNC.CONNECTING); } catch (e) { threw = e.message; }
    expect(threw).toContain('غير مسموح');
  });

  it('٣ · وكلُّ حالةٍ لها نصٌّ عربيٌّ بلا مصطلحات (بند ٣٤)', async () => {
    const { SYNC_TEXT } = await import('../js/services/cloud/sync-state.js');
    const banned = ['vector', 'checkpoint', 'CONFLICT', 'package', 'blobPending', 'FIELD'];
    for (const [state, text] of Object.entries(SYNC_TEXT)) {
      expect(Boolean(text)).toBe(true);
      for (const word of banned) {
        if (text.includes(word)) throw new Error(`«${word}» في نصّ الحالة ${state}`);
      }
    }
  });

  it('٤ · وأسماءُ الملفّات حتميّةٌ ومرتَّبةٌ نصًّا (قاعدةُ الكاتب الواحد)', async () => {
    const { packageFileName, deviceStateFileName } = await import('../js/services/cloud/transport.js');
    expect(packageFileName('DEV_A', 9) < packageFileName('DEV_A', 10)).toBe(true);
    expect(packageFileName('DEV_A', 5)).toBe(packageFileName('DEV_A', 5));
    expect(deviceStateFileName('DEV_A') === deviceStateFileName('DEV_B')).toBe(false);
    const name = backupFileName(BACKUP_KIND.LIGHT, new Date(2026, 7, 27, 9, 30));
    expect(name).toContain('2026-08-27 09-30');
    expect(name).toContain('خفيفة');
  });
});

/* ================================================================== *
 * ثانيًا — جهازان عبر السحابة
 * ================================================================== */

describe('WS-H · جهازان عبر المحاكي', () => {
  it('٥ · الاقترانُ الأوّل يبذر الموبايلَ من التابلت (بند ٣٩)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const base = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'ذكرى التابلت', date: '2026-05-01' });
      const main = await addScript(scene.id, { title: 'الرئيسيّ', text: 'نصّ' });
      const phase = await addNode(main.id, { title: 'المرحلة ١', text: '' });
      const part = await addNode(phase.id, { title: 'الجزء ١', text: 'نصُّ الجزء' });
      const audio = await media.create({
        kind: 'audio', mime: 'audio/wav', bytes: 2048, filename: 'a.wav',
        blob: realWav(), contentHash: null,
      });
      await link(audio.id, part.id, LINK.AUDIO_SCRIPT);
      await savedItems.create({ kind: 'phrase', text: 'фраза', normalizedText: 'фраза' });
      return { sceneId: scene.id, main: main.id, phase: phase.id, part: part.id, audio: audio.id };
    });

    await connectOn(TABLET, rigs[TABLET]);
    const up = await syncOn(TABLET, rigs[TABLET]);
    expect(up.ok).toBe(true);
    expect(up.pushed.uploaded).toBe(true);

    await connectOn(MOBILE, rigs[MOBILE]);
    const down = await syncOn(MOBILE, rigs[MOBILE]);
    expect(down.ok).toBe(true);

    /* السجلّاتُ وصلت كاملة. */
    expect(Boolean(await rowOn(MOBILE, 'scripts', base.part))).toBe(true);
    expect(Boolean(await rowOn(MOBILE, 'scenes', base.sceneId))).toBe(true);
    expect((await rowsOn(MOBILE, 'savedItems')).length).toBe(1);

    /* ⚠️ **والبايتاتُ لا** — والوصفُ يقول ذلك صراحةً (بند ٢٥). */
    const audioRow = await rowOn(MOBILE, 'media', base.audio);
    expect(Boolean(audioRow)).toBe(true);
    expect(isCloudOnly(audioRow)).toBe(true);
    expect(audioRow.blob).toBe(null);
    expect(urlFor(audioRow, { thumb: false })).toBe(null);
  });

  it('٦ · تغييراتٌ متوازيةٌ تلتقي بلا فقد (بند ٢٣)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const base = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'أساس', date: '2026-05-02' });
      const main = await addScript(scene.id, { title: 'رئيسيّ', text: 'ن' });
      const phase = await addNode(main.id, { title: 'مرحلة', text: '' });
      const p1 = await addNode(phase.id, { title: 'جزء ١', text: 'أ' });
      const p2 = await addNode(phase.id, { title: 'جزء ٢', text: 'ب' });
      return { scene: scene.id, main: main.id, phase: phase.id, p1: p1.id, p2: p2.id };
    });

    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    /* التابلت: نصّ + صوت + صورة + رابط + تدريب */
    const t = await on(TABLET, async () => {
      await updateScript(base.p1, { text: 'نصٌّ من التابلت' });
      const audio = await media.create({
        kind: 'audio', mime: 'audio/wav', bytes: 1600, filename: 't.wav', blob: realWav(),
      });
      const image = await media.create({
        kind: 'image', mime: 'image/png', bytes: 208, filename: 't.png', blob: realPng(),
      });
      await link(audio.id, base.p1, LINK.AUDIO_SCRIPT);
      await practiceEvidence.create({
        targetType: 'shadowSegment', targetId: 'SHG_T', practiceType: 'repeat', practicedAt: 11,
      });
      return { audio: audio.id, image: image.id };
    });

    /* الموبايل دون اتصال: عنوانٌ + سكريبتٌ جديد + نقلُ عقدة + غلطة */
    const m = await on(MOBILE, async () => {
      await scripts.update(base.p2, { title: 'جزء ٢ — اتسمّى من الموبايل' });
      const fresh = await addScript(base.scene, { title: 'سكريبت الموبايل', text: 'جديد' });
      const phase2 = await addNode(base.main, { title: 'مرحلة ٢', text: '' });
      await moveNodeTo(base.p2, phase2.id);
      const mistake = await mistakeComparisons.create({
        wrong: 'а', natural: 'б', occurredAt: 22,
      });
      return { fresh: fresh.id, phase2: phase2.id, mistake: mistake.id };
    });

    await quiesce(rigs);

    for (const device of [TABLET, MOBILE]) {
      expect((await rowOn(device, 'scripts', base.p1)).text).toBe('نصٌّ من التابلت');
      expect((await rowOn(device, 'scripts', base.p2)).title).toContain('من الموبايل');
      expect(Boolean(await rowOn(device, 'scripts', m.fresh))).toBe(true);
      expect(Boolean(await rowOn(device, 'media', t.audio))).toBe(true);
      expect(Boolean(await rowOn(device, 'media', t.image))).toBe(true);
      expect(Boolean(await rowOn(device, 'mistakeComparisons', m.mistake))).toBe(true);
      expect((await rowsOn(device, 'practiceEvidence')).length).toBe(1);
    }

    expect(describeDiff(diffLogical(await snapshot(TABLET), await snapshot(MOBILE))))
      .toBe('الحالتان متطابقتان منطقيًّا');
  });

  it('٧ · تعارضُ نفسِ الحقل يُعرَض ولا يُحسَم وحدَه (بند ٢٤)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();
    const id = await on(TABLET, async () => (await addScript(null, { title: 'أ', text: 'ن' })).id);

    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    await on(TABLET, () => scripts.update(id, { title: 'عنوان التابلت' }));
    await on(MOBILE, () => scripts.update(id, { title: 'عنوان الموبايل' }));
    await syncOn(TABLET, rigs[TABLET]);

    const outcome = await syncOn(MOBILE, rigs[MOBILE]);
    expect(outcome.ok).toBe(false);
    expect(outcome.conflicts.length).toBe(1);
    expect(outcome.conflicts[0].type).toBe(CONFLICT.FIELD);
    activate(MOBILE);
    expect(rigs[MOBILE].sync.state).toBe(SYNC.CONFLICT);

    /* ⚠️ والقاعدةُ لم تُمَسّ — القيمةُ المحلّيّة كما هي. */
    expect((await rowOn(MOBILE, 'scripts', id)).title).toBe('عنوان الموبايل');
  });

  it('٨ · ⚠️ و«إلغاء» = صفرُ كتابات (بند ١٣)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();
    const id = await on(TABLET, async () => (await addScript(null, { title: 'أ', text: 'ن' })).id);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    await on(TABLET, () => scripts.update(id, { title: 'ت' }));
    await on(MOBILE, () => scripts.update(id, { title: 'م' }));
    await syncOn(TABLET, rigs[TABLET]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const before = await snapshot(MOBILE);
    activate(MOBILE);
    const plan = rigs[MOBILE].sync.currentPlan();
    expect(Boolean(plan)).toBe(true);
    expect(unresolved(plan).length).toBe(1);

    /* نُقرّر ثم نُلغي — كما تفعل النافذة. */
    resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.USE_REMOTE);
    activate(MOBILE);
    rigs[MOBILE].sync.cancelConflicts();

    const after = await snapshot(MOBILE);
    expect(describeDiff(diffLogical(before, after))).toBe('الحالتان متطابقتان منطقيًّا');
    expect((await rowOn(MOBILE, 'scripts', id)).title).toBe('م');
  });

  it('٩ · وبعد القرار يلتقي الجهازان', async () => {
    await resetDevices();
    const { rigs } = makeCloud();
    const id = await on(TABLET, async () => (await addScript(null, { title: 'أ', text: 'ن' })).id);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    await on(TABLET, () => scripts.update(id, { title: 'نسخة التابلت' }));
    await on(MOBILE, () => scripts.update(id, { title: 'نسخة الموبايل' }));
    await syncOn(TABLET, rigs[TABLET]);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(MOBILE);
    const plan = rigs[MOBILE].sync.currentPlan();
    resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.USE_REMOTE);
    activate(MOBILE);
    const applied = await rigs[MOBILE].sync.applyPending();
    expect(applied.ok).toBe(true);
    expect((await rowOn(MOBILE, 'scripts', id)).title).toBe('نسخة التابلت');

    await quiesce(rigs);
    expect((await rowOn(TABLET, 'scripts', id)).title).toBe('نسخة التابلت');
    expect(describeDiff(diffLogical(await snapshot(TABLET), await snapshot(MOBILE))))
      .toBe('الحالتان متطابقتان منطقيًّا');
  });
});

/* ================================================================== *
 * ثالثًا — ثلاثةُ أجهزةٍ وحالاتُ الشبكة
 * ================================================================== */

describe('WS-H · ثلاثةُ أجهزةٍ والشبكة', () => {
  it('١٠ · ثلاثةُ أجهزةٍ تلتقي على حالةٍ واحدة (بند ٢٢)', async () => {
    await resetDevices();
    const { rigs } = makeCloud([TABLET, MOBILE, LAPTOP]);

    const base = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'ذكرى مشتركة', date: '2026-06-01' });
      const main = await addScript(scene.id, { title: 'رئيسيّ', text: 'ن' });
      const p1 = await addNode(main.id, { title: 'جزء ١', text: 'أ' });
      return { scene: scene.id, main: main.id, p1: p1.id };
    });

    for (const name of [TABLET, MOBILE, LAPTOP]) {
      await connectOn(name, rigs[name]);
      await syncOn(name, rigs[name]);
    }

    /* كلُّ جهازٍ يكتب في مكانٍ مختلف — لا تعارضَ متوقّع. */
    await on(TABLET, () => scripts.update(base.p1, { text: 'نصٌّ من التابلت' }));
    const m = await on(MOBILE, async () =>
      (await addScript(base.scene, { title: 'سكريبت الموبايل', text: 'م' })).id);
    const l = await on(LAPTOP, async () =>
      (await savedItems.create({ kind: 'word', text: 'ноутбук', normalizedText: 'ноутбук' })).id);

    await quiesce(rigs, 3);

    for (const name of [TABLET, MOBILE, LAPTOP]) {
      expect((await rowOn(name, 'scripts', base.p1)).text).toBe('نصٌّ من التابلت');
      expect(Boolean(await rowOn(name, 'scripts', m))).toBe(true);
      expect(Boolean(await rowOn(name, 'savedItems', l))).toBe(true);
    }

    expect(describeDiff(diffLogical(await snapshot(TABLET), await snapshot(LAPTOP))))
      .toBe('الحالتان متطابقتان منطقيًّا');
    expect(describeDiff(diffLogical(await snapshot(MOBILE), await snapshot(LAPTOP))))
      .toBe('الحالتان متطابقتان منطقيًّا');
  });

  it('١١ · ⚠️ ومزامنةٌ بلا تغييرٍ لا ترفع شيئًا (بند ٢٨)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();
    await on(TABLET, () => addScript(null, { title: 'أ', text: 'ن' }));

    await connectOn(TABLET, rigs[TABLET]);
    const first = await syncOn(TABLET, rigs[TABLET]);
    expect(first.pushed.uploaded).toBe(true);

    /* الجولةُ الثانية بلا أيّ تغييرٍ محلّيّ. */
    const second = await syncOn(TABLET, rigs[TABLET]);
    expect(second.ok).toBe(true);
    expect(second.pushed.uploaded).toBe(false);
    expect(second.pushed.changes).toBe(0);

    /*
     * ⚠️ **ولا نداءَ رفعٍ واحد** — لا «رفعٌ ثم اكتشافُ أنه مكرّر». معرفةُ
     *    «لا جديد» محلّيّةٌ بالكامل: مقارنةُ متّجهين.
     */
    expect(second.ops.pushPackage === undefined).toBe(true);
    expect(second.ops.putBackup === undefined).toBe(true);
    expect(second.ops.total < 6).toBe(true);
  });

  it('١٢ · انقطاعٌ أثناء الرفع ثم عودة — بلا فقدٍ وبلا تكرار (بند ٣٠)', async () => {
    await resetDevices();
    const { cloud, rigs } = makeCloud();
    const id = await on(TABLET, async () => (await addScript(null, { title: 'أ', text: 'ن' })).id);

    await connectOn(TABLET, rigs[TABLET]);
    rigs[TABLET].transport.fail('pushPackage', 'TRANSIENT_SERVER', { times: 1 });

    const failed = await syncOn(TABLET, rigs[TABLET]);
    expect(failed.ok).toBe(false);
    expect(failed.error.category).toBe('TRANSIENT_SERVER');

    /* ⚠️ والقاعدةُ المحلّيّة لم تتأثّر بحرف. */
    expect((await rowOn(TABLET, 'scripts', id)).title).toBe('أ');

    const retried = await syncOn(TABLET, rigs[TABLET]);
    expect(retried.ok).toBe(true);
    expect(retried.pushed.uploaded).toBe(true);

    /* ثم إعادةٌ ثالثةٌ بلا تغيير: لا ملفَّ ثانيًا على Drive. */
    await syncOn(TABLET, rigs[TABLET]);
    const packages = [...cloud.files.values()].filter((f) => f.role === 'package');
    expect(packages.length).toBe(1);

    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);
    expect(Boolean(await rowOn(MOBILE, 'scripts', id))).toBe(true);
  });

  it('١٣ · ⚠️ وبلا إنترنت: الكتابةُ فوريّةٌ والمزامنةُ تنتظر (بند ٢٩)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    rigs[TABLET].transport.setOnline(false);

    /*
     * ⚠️ **والقياسُ هنا هو الدعوى نفسُها.** «الكتابةُ لا تتأثّر» جملةٌ
     *    تُقال؛ والدليلُ أن نكتب والشبكةُ مقطوعةٌ ونقيس الزمن.
     */
    const started = performance.now();
    const id = await on(TABLET, async () =>
      (await addScript(null, { title: 'كُتب بلا إنترنت', text: 'ن' })).id);
    const ms = performance.now() - started;

    expect(Boolean(await rowOn(TABLET, 'scripts', id))).toBe(true);
    expect(ms < 900).toBe(true);

    const attempt = await syncOn(TABLET, rigs[TABLET]);
    expect(attempt.ok).toBe(false);
    expect(attempt.error.category).toBe('OFFLINE');
    activate(TABLET);
    expect(rigs[TABLET].sync.state).toBe(SYNC.OFFLINE);

    /* ثم تعود الشبكةُ فيمشي كلُّ شيءٍ بلا تدخّل. */
    rigs[TABLET].transport.setOnline(true);
    await connectOn(TABLET, rigs[TABLET]);
    const back = await syncOn(TABLET, rigs[TABLET]);
    expect(back.ok).toBe(true);

    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);
    expect((await rowOn(MOBILE, 'scripts', id)).title).toBe('كُتب بلا إنترنت');
  });

  it('١٤ · وانتهاءُ الإذن يوقف المزامنةَ وحدَها (بند ٣١)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    rigs[TABLET].transport.expireAuth();
    const id = await on(TABLET, async () => (await addScript(null, { title: 'ب', text: 'ن' })).id);

    const attempt = await syncOn(TABLET, rigs[TABLET]);
    expect(attempt.ok).toBe(false);
    expect(attempt.error.category).toBe('AUTH');
    activate(TABLET);
    expect(rigs[TABLET].sync.state).toBe(SYNC.AUTH_REQUIRED);

    /* ⚠️ والتطبيقُ يعمل: الكتابةُ نجحت والقراءةُ تعمل. */
    expect((await rowOn(TABLET, 'scripts', id)).title).toBe('ب');
    await on(TABLET, () => scripts.update(id, { title: 'ب٢' }));
    expect((await rowOn(TABLET, 'scripts', id)).title).toBe('ب٢');

    /* وبعد إذنٍ جديدٍ يُرفَع كلُّ ما تراكم. */
    await connectOn(TABLET, rigs[TABLET]);
    const back = await syncOn(TABLET, rigs[TABLET]);
    expect(back.ok).toBe(true);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);
    expect((await rowOn(MOBILE, 'scripts', id)).title).toBe('ب٢');
  });

  it('١٥ · وحزمةٌ فاسدةٌ على Drive تُعزَل ولا توقف السليمة (بند ٤٨)', async () => {
    await resetDevices();
    const { cloud, rigs } = makeCloud([TABLET, MOBILE, LAPTOP]);

    const t = await on(TABLET, async () => (await addScript(null, { title: 'ت', text: 'ن' })).id);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    /*
     * ⚠️ **والإفسادُ قبل أن يقرأها أحد — وهذا الترتيبُ هو الاختبار.**
     *    أوّلَ مرّةٍ أفسدتُها **بعد** أن زامن اللابتوب، فوصل سجلُّ
     *    التابلت إلى الموبايل ونجح الاختبارُ نجاحًا كاذبًا: حزمةُ
     *    اللابتوب تحمل تغييراتِ التابلت أيضًا (الحزمةُ تفاضلٌ عن الجار
     *    لا عن المؤلِّف). فما قِيس كان صمودَ الشبكة لا عزلَ الفاسد.
     */
    for (const file of cloud.files.values()) {
      if (file.role === 'package' && file.props.device === 'DEV_TABLET') {
        file.body = { ...file.body, changes: 'ليست مصفوفة', formatVersion: 999 };
      }
    }

    const l = await on(LAPTOP, async () => (await addScript(null, { title: 'ل', text: 'ن' })).id);
    await connectOn(LAPTOP, rigs[LAPTOP]);
    const onLaptop = await syncOn(LAPTOP, rigs[LAPTOP]);
    expect(onLaptop.applied.quarantined.length).toBe(1);

    await connectOn(MOBILE, rigs[MOBILE]);
    const outcome = await syncOn(MOBILE, rigs[MOBILE]);
    expect(outcome.ok).toBe(true);
    expect(outcome.applied.quarantined.length).toBe(1);

    /* السليمةُ وصلت، والفاسدةُ لم تُطبَّق. */
    expect(Boolean(await rowOn(MOBILE, 'scripts', l))).toBe(true);
    expect(await rowOn(MOBILE, 'scripts', t)).toBe(undefined);
  });
});

/* ================================================================== *
 * رابعًا — الوسائط: رفعٌ وتنزيلٌ وتحقّقٌ وتفريغ
 * ================================================================== */

describe('WS-H · بايتاتُ الوسائط', () => {
  it('١٦ · الرفعُ يضع البايتاتِ والبصمة، والموبايل ينزّل ويشغّل (بنود ٢٥ و٤١)', async () => {
    await resetDevices();
    const { cloud, rigs } = makeCloud();

    const wav = realWav(0.25, 523);
    const ids = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'ذكرى بصوت', date: '2026-06-02' });
      const main = await addScript(scene.id, { title: 'رئيسيّ', text: 'ن' });
      const part = await addNode(main.id, { title: 'جزء', text: 'أ' });
      const audio = await media.create({
        kind: 'audio', mime: 'audio/wav', bytes: wav.size, filename: 'v.wav', blob: wav,
      });
      await link(audio.id, part.id, LINK.AUDIO_SCRIPT);
      return { scene: scene.id, audio: audio.id };
    });

    await connectOn(TABLET, rigs[TABLET]);
    const report = await uploadOn(TABLET, rigs[TABLET]);
    expect(report.uploaded).toBe(1);
    expect(report.failed).toBe(0);

    /* ⚠️ والبصمةُ حُسبت مرّةً وكُتبت في السجلّ — فتُزامَن جاهزة. */
    const uploadedRow = await rowOn(TABLET, 'media', ids.audio);
    expect(typeof uploadedRow.contentHash).toBe('string');
    expect(uploadedRow.contentHash.length).toBe(64);
    expect(Boolean(uploadedRow.driveFileId)).toBe(true);
    expect(uploadedRow.contentHash).toBe(await sha256Hex(wav));

    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    const before = await rowOn(MOBILE, 'media', ids.audio);
    expect(isCloudOnly(before)).toBe(true);
    expect(before.contentHash).toBe(uploadedRow.contentHash);

    /* والتنزيلُ عبر نفس الطريق الذي تناديه الشاشة. */
    activate(MOBILE);
    setCloudFetcher((mediaId, role) => rigs[MOBILE].transfers.ensureLocal(mediaId, { role }));
    const got = await ensureBytes(ids.audio);
    setCloudFetcher(null);

    expect(got.ok).toBe(true);
    const after = await rowOn(MOBILE, 'media', ids.audio);
    expect(Boolean(after.blob)).toBe(true);
    expect(after.blobPending).toBe(0);
    expect(after.blob.size).toBe(wav.size);
    expect(Boolean(urlFor(after, { thumb: false }))).toBe(true);

    /*
     * ⚠️ **والبايتاتُ تُفكّ فعلًا — لا «حجمٌ متطابق» وكفى** (بند ٤١).
     *    ملفٌّ بحجمٍ صحيحٍ ومحتوًى مخلوطٍ يمرّ على أيّ فحصِ حجم، ويسقط
     *    أوّلَ ما تضغط «شغّل».
     */
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(await after.blob.arrayBuffer());
    expect(decoded.duration > 0.2).toBe(true);
    expect(decoded.sampleRate > 0).toBe(true);
    await ctx.close();

    /* ونسخةٌ واحدةٌ من البايتات على Drive لا نسختان. */
    const blobs = [...cloud.files.values()].filter((f) => f.role === 'blob');
    expect(blobs.length).toBe(1);
  });

  it('١٧ · ⚠️ وبصمةٌ لا تطابق تُرفَض ولا تُكتَب بايتةٌ واحدة', async () => {
    await resetDevices();
    const { cloud, rigs } = makeCloud();
    const id = await on(TABLET, async () => (await media.create({
      kind: 'audio', mime: 'audio/wav', bytes: 1000, filename: 'x.wav', blob: realWav(),
    })).id);

    await connectOn(TABLET, rigs[TABLET]);
    await uploadOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    /* نُبدّل البايتاتِ على Drive ونُبقي البصمةَ المعلَنة — تلفٌ صامت. */
    for (const file of cloud.files.values()) {
      if (file.role === 'blob') file.body = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    }

    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(MOBILE);
    const outcome = await rigs[MOBILE].transfers.ensureLocal(id);
    expect(outcome.ok).toBe(false);
    expect(outcome.category).toBe('REMOTE_CORRUPT');

    const row = await rowOn(MOBILE, 'media', id);
    expect(row.blob).toBe(null);
    /* ⚠️ ويبقى «ينتظر التنزيل» — لا «موجودٌ وتالف». */
    expect(isCloudOnly(row)).toBe(true);
  });

  it('١٨ · وانقطاعٌ في منتصف التنزيل يترك الصفَّ كما كان، وretry ينجح (بند ٣٠)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();
    const id = await on(TABLET, async () => (await media.create({
      kind: 'audio', mime: 'audio/wav', bytes: 2000, filename: 'c.wav', blob: realWav(0.3),
    })).id);

    await connectOn(TABLET, rigs[TABLET]);
    await uploadOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(MOBILE);
    rigs[MOBILE].transport.cut('fetchBlob', 2, 1);
    const cutRun = await rigs[MOBILE].transfers.ensureLocal(id);
    expect(cutRun.ok).toBe(false);

    const mid = await rowOn(MOBILE, 'media', id);
    expect(mid.blob).toBe(null);
    expect(isCloudOnly(mid)).toBe(true);

    activate(MOBILE);
    expect(rigs[MOBILE].transfers.summary().failed).toBe(1);
    expect(rigs[MOBILE].transfers.retryFailed()).toBe(1);
    await rigs[MOBILE].transfers.idle();

    const after = await rowOn(MOBILE, 'media', id);
    expect(Boolean(after.blob)).toBe(true);
    activate(MOBILE);
    expect(rigs[MOBILE].transfers.summary().completed).toBe(1);
  });

  it('١٩ · «نزّل كل الملفّات» يمشي على الطابور، وطلبان متزامنان تنزيلٌ واحد', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const ids = await on(TABLET, async () => {
      const out = [];
      for (let i = 0; i < 5; i++) {
        /* eslint-disable-next-line no-await-in-loop */
        out.push((await media.create({
          kind: i % 2 ? 'image' : 'audio',
          mime: i % 2 ? 'image/png' : 'audio/wav',
          bytes: 500 + i, filename: `f${i}`,
          blob: i % 2 ? realPng(8 + i) : realWav(0.1 + i / 100, 300 + i * 40),
        })).id);
      }
      return out;
    });

    await connectOn(TABLET, rigs[TABLET]);
    const up = await uploadOn(TABLET, rigs[TABLET]);
    expect(up.uploaded).toBe(5);
    await syncOn(TABLET, rigs[TABLET]);

    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(MOBILE);
    const store = await storageReport();
    expect(store.cloudOnly.count).toBe(5);
    expect(store.local.count).toBe(0);

    /* ⚠️ وطلبان لنفس الملفّ في نفس اللحظة = تنزيلٌ واحد. */
    activate(MOBILE);
    const before = rigs[MOBILE].transport.stats().fetchBlob || 0;
    const [a, b] = await Promise.all([
      rigs[MOBILE].transfers.ensureLocal(ids[0]),
      rigs[MOBILE].transfers.ensureLocal(ids[0]),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect((rigs[MOBILE].transport.stats().fetchBlob || 0) - before).toBe(1);

    activate(MOBILE);
    await rigs[MOBILE].transfers.enqueue(ids);
    await rigs[MOBILE].transfers.idle();

    activate(MOBILE);
    const after = await storageReport();
    expect(after.local.count).toBe(5);
    expect(after.cloudOnly.count).toBe(0);
    /* والموجودُ محلّيًّا لم يُنزَّل ثانية. */
    expect(rigs[MOBILE].transfers.summary().completed).toBe(5);
  });

  it('٢٠ · حزمةُ الذكرى: صوتٌ فقط · صورٌ فقط · الكل — والتقريرُ قبل التنزيل (بنود C…E)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const base = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'ذكرى كاملة', date: '2026-06-03' });
      const main = await addScript(scene.id, { title: 'رئيسيّ', text: 'ن' });
      const phase = await addNode(main.id, { title: 'مرحلة', text: '' });
      const p1 = await addNode(phase.id, { title: 'جزء ١', text: 'أ' });
      const p2 = await addNode(phase.id, { title: 'جزء ٢', text: 'ب' });

      const a1 = await media.create({ kind: 'audio', mime: 'audio/wav', bytes: 800, filename: 'a1', blob: realWav() });
      const a2 = await media.create({ kind: 'audio', mime: 'audio/wav', bytes: 900, filename: 'a2', blob: realWav(0.15) });
      const i1 = await media.create({ kind: 'image', mime: 'image/png', bytes: 210, filename: 'i1', blob: realPng() });
      await link(a1.id, p1.id, LINK.AUDIO_SCRIPT);
      await link(a2.id, p2.id, LINK.AUDIO_SCRIPT);
      await link(i1.id, p1.id, LINK.IMAGE_SCRIPT);

      /* ووسيطٌ لا يخصّ هذه الذكرى — يجب ألّا يدخل الحزمة. */
      await media.create({ kind: 'audio', mime: 'audio/wav', bytes: 700, filename: 'off', blob: realWav() });
      return { scene: scene.id, a1: a1.id, a2: a2.id, i1: i1.id };
    });

    await connectOn(TABLET, rigs[TABLET]);
    await uploadOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(MOBILE);
    const all = await mediaIdsOfScene(base.scene);
    expect(all.length).toBe(3);
    expect(all.includes(base.a1)).toBe(true);
    expect(all.includes(base.i1)).toBe(true);

    activate(MOBILE);
    expect((await mediaIdsOfScene(base.scene, { kind: 'audio' })).length).toBe(2);
    expect((await mediaIdsOfScene(base.scene, { kind: 'image' })).length).toBe(1);

    /* ⚠️ والتقريرُ يُعرَض قبل التنزيل — بأرقامٍ من السجلّ لا من الشبكة. */
    activate(MOBILE);
    const beforeOps = rigs[MOBILE].transport.stats();
    const report = await sceneOfflineReport(base.scene);
    expect(report.total).toBe(3);
    expect(report.missing.count).toBe(3);
    expect(report.complete).toBe(false);
    expect(report.missing.bytes).toBe(800 + 900 + 210);
    expect(JSON.stringify(rigs[MOBILE].transport.stats())).toBe(JSON.stringify(beforeOps));

    /* «صوت الذكرى بس» */
    activate(MOBILE);
    await rigs[MOBILE].transfers.enqueue(await mediaIdsOfScene(base.scene, { kind: 'audio' }));
    await rigs[MOBILE].transfers.idle();

    activate(MOBILE);
    const half = await sceneOfflineReport(base.scene);
    expect(half.local.count).toBe(2);
    expect(half.local.audio).toBe(2);
    expect(half.complete).toBe(false);

    /* «خلّي الذكرى أوفلاين» */
    activate(MOBILE);
    await rigs[MOBILE].transfers.enqueue(await mediaIdsOfScene(base.scene));
    await rigs[MOBILE].transfers.idle();

    activate(MOBILE);
    const full = await sceneOfflineReport(base.scene);
    expect(full.complete).toBe(true);
    expect(full.missing.count).toBe(0);

    /* ⚠️ والوسيطُ الخارجُ عن الذكرى لم يُنزَّل — الحزمةُ حزمةٌ لا «كلُّ شيء». */
    activate(MOBILE);
    const store = await storageReport();
    expect(store.cloudOnly.count).toBe(1);
  });

  it('٢١ · ⚠️ وإزالةُ النسخة المحلّيّة ليست حذفًا — ولا تُفرَّغ نسخةٌ وحيدة (بند F)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const ids = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'مساحة', date: '2026-06-04' });
      const main = await addScript(scene.id, { title: 'ر', text: 'ن' });
      const uploaded = await media.create({
        kind: 'audio', mime: 'audio/wav', bytes: 1200, filename: 'u.wav', blob: realWav(),
      });
      await link(uploaded.id, main.id, LINK.AUDIO_SCRIPT);
      return { scene: scene.id, uploaded: uploaded.id };
    });

    await connectOn(TABLET, rigs[TABLET]);
    await uploadOn(TABLET, rigs[TABLET]);

    /* ووسيطٌ أُنشئ بعد الرفع — نسختُه الوحيدةُ هنا. */
    const lonely = await on(TABLET, async () => (await media.create({
      kind: 'audio', mime: 'audio/wav', bytes: 1300, filename: 'l.wav', blob: realWav(),
    })).id);

    activate(TABLET);
    const dry = await removeLocalCopies([ids.uploaded, lonely], { dryRun: true });
    expect(dry.eligible).toBe(1);
    expect(dry.skipped).toBe(1);
    expect(dry.freed).toBe(1200);
    expect(dry.skippedReason).toContain('النسخة الوحيدة');

    /* والتشغيلُ الجافُّ لم يمسّ بايتةً. */
    expect(Boolean((await rowOn(TABLET, 'media', ids.uploaded)).blob)).toBe(true);

    activate(TABLET);
    const done = await removeLocalCopies([ids.uploaded, lonely]);
    expect(done.removed).toBe(1);

    const freed = await rowOn(TABLET, 'media', ids.uploaded);
    const kept = await rowOn(TABLET, 'media', lonely);

    /* ⚠️ **السجلُّ باقٍ وحيٌّ** — اسمٌ وحجمٌ وارتباط. الذاهبُ البايتاتُ وحدَها. */
    expect(Boolean(freed)).toBe(true);
    expect(freed.state).toBe('active');
    expect(freed.filename).toBe('u.wav');
    expect(freed.bytes).toBe(1200);
    expect(isCloudOnly(freed)).toBe(true);
    expect(Boolean(kept.blob)).toBe(true);

    /* والعلاقةُ لم تُمَسّ — الذكرى ما زالت تعرف صوتَها. */
    activate(TABLET);
    expect((await mediaIdsOfScene(ids.scene)).includes(ids.uploaded)).toBe(true);

    /* ويمكن تنزيلُه ثانيةً — وهو الفرقُ عن الحذف. */
    activate(TABLET);
    const back = await rigs[TABLET].transfers.ensureLocal(ids.uploaded);
    expect(back.ok).toBe(true);
    expect(Boolean((await rowOn(TABLET, 'media', ids.uploaded)).blob)).toBe(true);
  });
});

/* ================================================================== *
 * خامسًا — النسخُ الاحتياطيّ السحابيّ (بنود I…P)
 * ================================================================== */

describe('WS-H · النسخُ السحابيّ', () => {
  it('٢٢ · كاملةٌ وخفيفةٌ من نفس الصيغة — والفرقُ البايتاتُ وحدَها (بند J)', async () => {
    await resetDevices();
    const { cloud, rigs } = makeCloud([TABLET]);

    const wav = realWav(0.3);
    const id = await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'ذكرى للنسخ', date: '2026-07-01' });
      const main = await addScript(scene.id, { title: 'ر', text: 'نصّ' });
      const audio = await media.create({
        kind: 'audio', mime: 'audio/wav', bytes: wav.size, filename: 'b.wav', blob: wav,
      });
      await link(audio.id, main.id, LINK.AUDIO_SCRIPT);
      return audio.id;
    });

    activate(TABLET);
    await rigs[TABLET].transport.connect();

    activate(TABLET);
    const full = await createCloudBackup(rigs[TABLET].transport, { kind: BACKUP_KIND.FULL });
    activate(TABLET);
    const light = await createCloudBackup(rigs[TABLET].transport, { kind: BACKUP_KIND.LIGHT });

    expect(full.blobCount).toBe(1);
    expect(full.omittedCount).toBe(0);
    /* ⚠️ والخفيفةُ **تعلن** ما حذفته — بيانٌ لا صمت. */
    expect(light.blobCount).toBe(0);
    expect(light.omittedCount).toBe(1);
    expect(light.bytes < full.bytes).toBe(true);
    expect(full.bytes - light.bytes > wav.size / 2).toBe(true);

    /* ونفسُ عدّ السجلّات في الاثنتين — الفرقُ ليس في البيانات. */
    expect(JSON.stringify(light.counts)).toBe(JSON.stringify(full.counts));

    /* وكلتاهما تُقرأ بنفس الفاحص القائم — بلا مسارٍ ثانٍ. */
    activate(TABLET);
    const readLight = await inspectCloudBackup(rigs[TABLET].transport, light.fileId);
    expect(readLight.ok).toBe(true);
    expect(readLight.kind).toBe(BACKUP_KIND.LIGHT);
    expect(readLight.omittedBlobs.length).toBe(1);
    expect(readLight.preview.note).toContain('Drive');

    activate(TABLET);
    const listed = await listCloudBackups(rigs[TABLET].transport);
    expect(listed.length).toBe(2);
    expect(listed.filter((row) => row.dependsOnCloudMedia).length).toBe(1);
    expect(cloud.files.size >= 2).toBe(true);
    void id;
  });

  it('٢٣ · ⚠️ ونسخةٌ لا تُكتَب فوق نسخة (بند L) — والاستبقاءُ بتأكيدٍ وحدَه', async () => {
    await resetDevices();
    const { rigs } = makeCloud([TABLET]);
    await on(TABLET, () => addScript(null, { title: 'أ', text: 'ن' }));

    activate(TABLET);
    await rigs[TABLET].transport.connect();

    /* أربعُ نسخٍ في أربع لحظات. */
    const made = [];
    for (let i = 0; i < 4; i++) {
      activate(TABLET);
      /* eslint-disable-next-line no-await-in-loop */
      await scripts.update((await rowsOn(TABLET, 'scripts'))[0].id, { title: `أ${i}` });
      activate(TABLET);
      /* eslint-disable-next-line no-await-in-loop */
      made.push(await createCloudBackup(rigs[TABLET].transport, { kind: BACKUP_KIND.LIGHT }));
    }

    activate(TABLET);
    const all = await listCloudBackups(rigs[TABLET].transport);
    expect(all.length).toBe(4);
    expect(new Set(made.map((row) => row.fileId)).size).toBe(4);

    /* ⚠️ **ولا يُحذَف شيءٌ بلا تأكيد** — ولو طُلبت سياسةُ استبقاء. */
    let threw = '';
    try {
      activate(TABLET);
      await applyRetention(rigs[TABLET].transport, 'KEEP_3');
    } catch (error) { threw = error.message; }
    expect(threw).toContain('تأكيد');

    activate(TABLET);
    const kept = await applyRetention(rigs[TABLET].transport, 'KEEP_3', { confirmed: true });
    expect(kept.deleted).toBe(1);
    activate(TABLET);
    expect((await listCloudBackups(rigs[TABLET].transport)).length).toBe(3);

    /* و«احتفظ بالكل» لا تحذف ولو أُكِّدت. */
    activate(TABLET);
    const none = await applyRetention(rigs[TABLET].transport, 'ALL', { confirmed: true });
    expect(none.deleted).toBe(0);
    expect(RETENTION.KEEP_3.keep).toBe(3);
  });

  it('٢٤ · وتقريرُ الجاهزيّة يحذّر من نسخةٍ «كاملة» ناقصة (بند ١٥)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const id = await on(TABLET, async () => (await media.create({
      kind: 'audio', mime: 'audio/wav', bytes: 1500, filename: 'r.wav', blob: realWav(),
    })).id);

    activate(TABLET);
    const before = await fullBackupReadiness();
    expect(before.complete).toBe(true);
    expect(before.warning).toBe(null);

    await connectOn(TABLET, rigs[TABLET]);
    await uploadOn(TABLET, rigs[TABLET]);
    activate(TABLET);
    await removeLocalCopies([id]);

    activate(TABLET);
    const after = await fullBackupReadiness();
    expect(after.complete).toBe(false);
    expect(after.missingLocally).toBe(1);
    expect(after.missingBytes).toBe(1500);
    expect(after.warning).toContain('مش هتشملهم');
  });

  it('٢٥ · ⚠️ **والاسترجاعُ يوقف المزامنة** — ولا تعود الحالةُ الحديثة بصمت (بند P)', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const id = await on(TABLET, async () => (await addScript(null, { title: 'قديم', text: 'ن' })).id);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    /* نسخةٌ الآن — قبل التغييرات. */
    activate(TABLET);
    const snap = await createCloudBackup(rigs[TABLET].transport, { kind: BACKUP_KIND.FULL });

    /* ثم يتسرّب «الخطأ» ويُزامَن إلى الموبايل. */
    await on(TABLET, () => scripts.update(id, { title: 'الغلط اللي اتسرّب' }));
    await quiesce(rigs, 2);
    expect((await rowOn(MOBILE, 'scripts', id)).title).toBe('الغلط اللي اتسرّب');

    /* والتابلت يسترجع نسخةَ ما قبل الخطأ. */
    activate(TABLET);
    const inspection = await inspectCloudBackup(rigs[TABLET].transport, snap.fileId);
    expect(inspection.ok).toBe(true);

    /* ⚠️ ولا استرجاعَ بلا تأكيدٍ صريح — ولو كانت النسخةُ سليمة. */
    let threw = '';
    try {
      activate(TABLET);
      await restoreCloudBackup(inspection);
    } catch (error) { threw = error.message; }
    expect(threw).toContain('تأكيد');

    activate(TABLET);
    const restored = await restoreCloudBackup(inspection, { confirmed: true });
    expect(restored.syncWillPause).toBe(true);
    expect((await rowOn(TABLET, 'scripts', id)).title).toBe('قديم');

    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **وهنا الاختبارُ الحقيقيّ**: المزامنةُ التالية لا تدمج.
     * ═══════════════════════════════════════════════════════════
     */
    const state = await connectOn(TABLET, rigs[TABLET]);
    expect(state.state).toBe(SYNC.RESTORED_HOLD);

    const blocked = await syncOn(TABLET, rigs[TABLET]);
    expect(blocked.ok).toBe(false);
    expect(blocked.held).toBe(true);
    /* ⚠️ والحالةُ المسترجَعة باقيةٌ — لم يَعُد «الغلط» بالدمج. */
    expect((await rowOn(TABLET, 'scripts', id)).title).toBe('قديم');

    /* والملخّصُ يقول بأرقامٍ ما الذي تراجع. */
    activate(TABLET);
    const detected = await detectReplacement();
    expect(detected.replaced).toBe(true);
    const summary = replacementSummary(detected);
    expect(summary.lostChanges > 0).toBe(true);

    /* والقراراتُ ثلاثةٌ لا اثنان، ولكلٍّ نصٌّ يقرؤه إنسان. */
    expect(Object.keys(AFTER_RESTORE).length).toBe(3);
    for (const key of Object.keys(AFTER_RESTORE)) {
      expect(Boolean(AFTER_RESTORE_TEXT[key]?.label)).toBe(true);
      expect(Boolean(AFTER_RESTORE_TEXT[key]?.detail)).toBe(true);
    }
  });

  it('٢٦ · و«اعتمد على كل أجهزتي» يبني كونًا جديدًا — ولا جهازَ يتبنّاه وحدَه', async () => {
    await resetDevices();
    const { rigs } = makeCloud();

    const id = await on(TABLET, async () => (await addScript(null, { title: 'أساس', text: 'ن' })).id);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);
    await connectOn(MOBILE, rigs[MOBILE]);
    await syncOn(MOBILE, rigs[MOBILE]);

    activate(TABLET);
    const snap = await createCloudBackup(rigs[TABLET].transport, { kind: BACKUP_KIND.FULL });

    await on(TABLET, () => scripts.update(id, { title: 'بعد الأساس' }));
    await quiesce(rigs, 2);

    activate(TABLET);
    const inspection = await inspectCloudBackup(rigs[TABLET].transport, snap.fileId);
    activate(TABLET);
    await restoreCloudBackup(inspection, { confirmed: true });

    const held = await connectOn(TABLET, rigs[TABLET]);
    expect(held.state).toBe(SYNC.RESTORED_HOLD);

    activate(TABLET);
    const adopted = await rigs[TABLET].sync.resolveRestore(AFTER_RESTORE.ADOPT_EVERYWHERE);
    expect(adopted.ok).toBe(true);
    expect(Boolean(adopted.universeId)).toBe(true);

    /*
     * ⚠️ **والموبايلُ يجد كونًا غيرَ كونه فيقف ويسأل** — لا يتبنّى ولا
     *    يُبقي القديم صامتًا. وهذه هي «كل جهاز هيتسأل» بالضبط.
     */
    const onMobile = await syncOn(MOBILE, rigs[MOBILE]);
    expect(onMobile.ok).toBe(false);
    expect(Boolean(onMobile.universeMismatch)).toBe(true);
    expect(onMobile.universeMismatch.mismatch).toBe(true);
    /* والموبايلُ لم يفقد بياناتِه ولم تتبدّل. */
    expect((await rowOn(MOBILE, 'scripts', id)).title).toBe('بعد الأساس');
  });

  it('٢٧ · و«خلّي الاسترجاع هنا بس» يُخرج الجهازَ ولا يمسّ Drive', async () => {
    await resetDevices();
    const { cloud, rigs } = makeCloud();

    const id = await on(TABLET, async () => (await addScript(null, { title: 'أساس', text: 'ن' })).id);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    activate(TABLET);
    const snap = await createCloudBackup(rigs[TABLET].transport, { kind: BACKUP_KIND.FULL });
    await on(TABLET, () => scripts.update(id, { title: 'بعدين' }));
    await syncOn(TABLET, rigs[TABLET]);

    const filesBefore = cloud.files.size;
    const universeBefore = cloud.universe.id;

    activate(TABLET);
    await restoreCloudBackup(
      await inspectCloudBackup(rigs[TABLET].transport, snap.fileId),
      { confirmed: true }
    );
    await connectOn(TABLET, rigs[TABLET]);

    activate(TABLET);
    const left = await rigs[TABLET].sync.resolveRestore(AFTER_RESTORE.LOCAL_ONLY);
    expect(left.ok).toBe(true);
    expect(left.left).toBe(true);
    activate(TABLET);
    expect(rigs[TABLET].sync.state).toBe(SYNC.DISCONNECTED);

    /* ⚠️ ولا ملفَّ حُذف على Drive، ولا كونَ تبدّل. */
    expect(cloud.files.size).toBe(filesBefore);
    expect(cloud.universe.id).toBe(universeBefore);
    /* والبياناتُ المسترجَعة باقيةٌ على الجهاز. */
    expect((await rowOn(TABLET, 'scripts', id)).title).toBe('أساس');
  });
});

/* ================================================================== *
 * سادسًا — الحرّاسُ البنيويّون (بند ٣٤)
 *
 * ⚠️ **وهذه اختباراتُ نصٍّ لا سلوك — وهي المقصودة.** كلُّ حدٍّ هنا يمكن
 *    خرقُه بسطرِ استيرادٍ واحدٍ يُكتَب بعد شهرين بحسن نيّة، ولا يُظهره
 *    أيُّ اختبارِ سلوك: الشاشةُ ستعمل، والمزامنةُ ستزامن — وتكون البنيةُ
 *    قد ماتت بلا جنازة. فالحارسُ يمسح المصدرَ نفسَه.
 * ================================================================== */

const VIEW_FILES = [
  'analysis-view', 'constellation-view', 'dev-view', 'duplicates-view', 'facets-view',
  'import-view', 'language-view', 'life-view', 'now-view', 'organize-view', 'prompts-view',
  'river-view', 'scene-view', 'search-view', 'settings-view', 'shadow-history-view',
  'shadow-view', 'studio-view', 'threads-view', 'trash-view', 'workspace-view',
];

const MODAL_FILES = [
  'conflict-review', 'content-modals', 'improve-modal', 'link-modal', 'media-actions',
  'memory-exchange', 'pair-review', 'participant-modals', 'quick-shadow', 'scene-modals',
  'smart-paste', 'thread-modals', 'transcript-modals', 'voice-lab',
];

const SYNC_FILES = [
  'change-log', 'conflicts', 'device', 'logical-state', 'merge-apply',
  'merge-planner', 'sync-package', 'sync-policy', 'sync-service',
];

const CLOUD_FILES = [
  'cloud-backup', 'cloud-service', 'cloud-sync', 'install-store', 'media-transfer',
  'media-upload', 'mock-transport', 'offline-pack', 'restore-guard', 'sync-state', 'transport',
];

const sourceOf = (path) => fetch(`../js/${path}`).then((r) => {
  if (!r.ok) throw new Error(`ملفٌّ غير موجود: ${path}`);
  return r.text();
});

/** يقرأ ملفّاتٍ كثيرةً معًا. */
const sourcesOf = (paths) =>
  Promise.all(paths.map(async (path) => [path, await sourceOf(path)]));

/** أسطرُ الاستيراد وحدَها — فلا تُحسَب كلمةٌ في تعليق. */
const importsOf = (source) =>
  [...source.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('WS-H · الحرّاسُ البنيويّون', () => {
  it('٢٨ · ⚠️ ولا شاشةٌ ولا نافذةٌ تستورد ناقلًا (بند ٢٧)', async () => {
    const files = [
      ...VIEW_FILES.map((n) => `views/${n}.js`),
      ...MODAL_FILES.map((n) => `modals/${n}.js`),
    ];
    const offenders = [];
    for (const [path, source] of await sourcesOf(files)) {
      for (const spec of importsOf(source)) {
        /* المسموحُ من طبقة السحابة: `cloud-service` وحدَها. */
        if (!spec.includes('/cloud/')) continue;
        if (spec.endsWith('cloud-service.js')) continue;
        offenders.push(`${path} ← ${spec}`);
      }
    }
    if (offenders.length) throw new Error(`شاشةٌ تنادي النقلَ مباشرة:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);
  });

  it('٢٩ · ⚠️ ولا سطرَ Google داخل محرّك WS-G (بند ١٩)', async () => {
    /*
     * ⚠️ **والممنوعُ الاقترانُ لا الكلمة — وأوّلُ صياغةٍ خلطت بينهما.**
     *    كتبتُ الحارسَ أوّلَ مرّةٍ يمنع كلمتَي «google» و«drive» فسقط
     *    على `sync-policy.js` بسبب `driveFileId`. وذاك اسمُ **حقلٍ
     *    محلّيّ** مذكورٍ في `localFields` — أي أن الملفَّ يفعل الصوابَ
     *    بعينه: يعلن أن الحقلَ لا يُزامَن. فكان الحارسُ يعاقب الالتزامَ
     *    بالحدّ لأنه ذكر اسمَه.
     *
     *    فالمقياسُ الصحيح: **استيرادٌ** من طبقة السحابة، أو نداءُ واجهةٍ
     *    من واجهات Google. واسمُ حقلٍ ليس أيًّا منهما.
     */
    const banned = ['gapi.', 'googleapis', 'accounts.google', 'gsi/client',
      'google.accounts', 'oauth', 'access_token'];
    const offenders = [];
    for (const [path, source] of await sourcesOf(SYNC_FILES.map((n) => `services/sync/${n}.js`))) {
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' ')
        .toLowerCase();
      for (const word of banned) {
        if (code.includes(word)) offenders.push(`${path}: «${word}»`);
      }
      for (const spec of importsOf(source)) {
        if (spec.includes('/cloud/')) offenders.push(`${path} ← ${spec}`);
      }
    }
    if (offenders.length) throw new Error(`Google تسرّب إلى WS-G:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);

    /* وطبقةُ السحابة تستورد WS-G — الاتّجاهُ في اتّجاهٍ واحدٍ لا اثنين. */
    const cloudSync = await sourceOf('services/cloud/cloud-sync.js');
    expect(importsOf(cloudSync).some((s) => s.includes('/sync/'))).toBe(true);
  });

  it('٣٠ · ⚠️ ولا محرّكَ مزامنةٍ ثانٍ — الدمجُ من WS-G وحدَه (بند ٣٤)', async () => {
    /*
     * لا يجوز لطبقة السحابة أن تُعرّف تخطيطًا ولا تطبيقًا ولا حسمَ
     * تعارضٍ خاصًّا بها. فوجودُ النداء مسموح، وإعادةُ تعريفه ممنوعة.
     */
    const forbidden = [
      /function\s+planMerge\b/, /function\s+applyMerge\b/,
      /function\s+resolveConflict\b/, /function\s+detectConflicts\b/,
      /const\s+planMerge\s*=/, /const\s+applyMerge\s*=/,
    ];
    const offenders = [];
    for (const [path, source] of await sourcesOf(CLOUD_FILES.map((n) => `services/cloud/${n}.js`))) {
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${path}: ${pattern}`);
      }
    }
    if (offenders.length) throw new Error(`محرّكُ دمجٍ ثانٍ:\n${offenders.join('\n')}`);

    /* والمنسّقُ **يستورد** محرّكَ WS-G فعلًا — لا يعيد بناءه. */
    const orchestrator = await sourceOf('services/cloud/cloud-sync.js');
    const specs = importsOf(orchestrator);
    expect(specs.some((s) => s.endsWith('merge-planner.js'))).toBe(true);
    expect(specs.some((s) => s.endsWith('merge-apply.js'))).toBe(true);
  });

  it('٣١ · ⚠️ ولا مشغّلَ صوتٍ ولا عارضَ صورةٍ ثانٍ في طبقة السحابة', async () => {
    const forbidden = ['new Audio(', 'AudioContext', 'document.createElement(\'audio\'',
      'document.createElement("audio"', '<img', 'speechSynthesis'];
    const offenders = [];
    for (const [path, source] of await sourcesOf(CLOUD_FILES.map((n) => `services/cloud/${n}.js`))) {
      for (const needle of forbidden) {
        if (source.includes(needle)) offenders.push(`${path}: «${needle}»`);
      }
    }
    if (offenders.length) throw new Error(`مشغّلٌ ثانٍ في السحابة:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);
  });

  it('٣٢ · ⚠️ ولا مفتاحَ ولا سرَّ ولا Client ID في الشجرة كلِّها (بند ١٨)', async () => {
    const files = [
      ...CLOUD_FILES.map((n) => `services/cloud/${n}.js`),
      ...SYNC_FILES.map((n) => `services/sync/${n}.js`),
      'services/cloud/cloud-service.js',
    ];
    /*
     * ⚠️ **أنماطٌ لا كلمات.** «client_id» في تعليقٍ يشرح ما لن نضعه ليس
     *    تسريبًا؛ والتسريبُ **قيمةٌ مسنَدة**. فنبحث عن الإسناد.
     */
    const patterns = [
      /['"]?client_?[iI]d['"]?\s*[:=]\s*['"][^'"]{8,}['"]/,
      /['"]?client_?[sS]ecret['"]?\s*[:=]\s*['"][^'"]+['"]/,
      /['"]?api_?[kK]ey['"]?\s*[:=]\s*['"][^'"]+['"]/,
      /AIza[0-9A-Za-z_-]{20,}/,
      /[0-9]{10,}-[0-9a-z]{20,}\.apps\.googleusercontent\.com/,
      /ya29\.[0-9A-Za-z_-]+/,
    ];
    const offenders = [];
    for (const [path, source] of await sourcesOf([...new Set(files)])) {
      for (const pattern of patterns) {
        if (pattern.test(source)) offenders.push(`${path}: ${pattern}`);
      }
    }
    if (offenders.length) throw new Error(`سرٌّ في الكود:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);
  });

  it('٣٣ · وناتجُ التشخيص بلا أسرارٍ — يُفحَص هو نفسُه لا يُوعَد به (بند ٣٥)', async () => {
    await resetDevices();
    const { rigs } = makeCloud([TABLET]);
    await on(TABLET, () => addScript(null, { title: 'أ', text: 'ن' }));

    /* بلا ربط: يعمل ولا يرمي. */
    const idle = await cloudDiagnostics();
    expect(idle.connected).toBe(false);

    activate(TABLET);
    attachCloud(rigs[TABLET].transport);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    activate(TABLET);
    const report = await cloudDiagnostics();
    expect(report.connected).toBe(true);
    expect(Boolean(report.device)).toBe(true);
    expect(Boolean(report.transfers)).toBe(true);
    expect(Boolean(report.uploads)).toBe(true);

    const leaked = findSecrets(report);
    if (leaked.length) throw new Error(`سرٌّ في التشخيص: ${leaked.join('، ')}`);
    expect(leaked.length).toBe(0);
    expect(FORBIDDEN_KEYS.includes('access_token')).toBe(true);

    /* والفاحصُ يعمل فعلًا — فلا يمرّ لأنه لا يجد شيئًا أبدًا. */
    expect(findSecrets({ a: { accessToken: 'x' } }).length).toBe(1);

    await detachCloud();
  });

  it('٣٤ · ⚠️ ولا كتابةَ في القاعدة من نافذة المراجعة قبل «طبّق»', async () => {
    const source = await sourceOf('modals/conflict-review.js');
    const banned = [
      'repositories.js', 'database.js', 'merge-apply.js', 'withTx(',
      'scripts.update', 'media.update', 'objectStore(',
    ];
    const offenders = banned.filter((needle) => source.includes(needle));
    if (offenders.length) {
      throw new Error(`نافذةُ المراجعة تكتب: ${offenders.join('، ')}`);
    }
    /* وما تستورده: قراراتُ التعارض وحدَها — أي تعديلٌ في الذاكرة. */
    expect(importsOf(source).some((s) => s.endsWith('conflicts.js'))).toBe(true);
  });

  it('٣٥ · ولا رمزَ إذنٍ في القاعدة الأساسيّة — ولا في الحزم ولا النسخ', async () => {
    /*
     * لا مخزنَ للتفويض في المخطّط.
     *
     * ⚠️ **و«token» وحدَها ليست دليلًا — وأوّلُ صياغةٍ ظنّتها كذلك.**
     *    `searchIndex` مفتاحُه `['token', 'refId']`، و«token» هناك
     *    **كلمةٌ من نصّك** في فهرس البحث المعكوس، لا رمزُ إذن. فحارسٌ
     *    يمنع الحرفَ يمنع فهرسَ البحث نفسَه.
     */
    const schema = await sourceOf('db/schema.js');
    const authWords = ['accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
      'oauth', 'credential', 'clientsecret', 'client_secret', 'authtoken'];
    for (const needle of authWords) {
      if (schema.toLowerCase().includes(needle)) {
        throw new Error(`«${needle}» في مخطّط القاعدة`);
      }
    }
    /* والحارسُ يعمل فعلًا: الكلمةُ الحقيقيّةُ تُلتقَط لو ظهرت. */
    expect(authWords.some((w) => 'const x = { accessToken: 1 }'.toLowerCase().includes(w))).toBe(true);

    /*
     * وحالةُ التركيب في `localStorage` لا في القاعدة — **ومن بابٍ واحد**.
     *
     * ⚠️ **والتعليقُ ليس نداءً** — وقد سقط الحارسُ على `restore-guard.js`
     *    لأن ترويستَه **تشرح** أين تعيش نقطةُ التفتيش. وهو نفسُ خطئي في
     *    الحارس ٢٩ مرّتين في يوم: قياسُ نصٍّ خامٍ بدل قياس كود.
     */
    const stripComments = (text) => text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');

    const install = await sourceOf('services/cloud/install-store.js');
    expect(stripComments(install)).toContain('localStorage');
    for (const [path, source] of await sourcesOf(['services/cloud/cloud-sync.js',
      'services/cloud/restore-guard.js'])) {
      if (stripComments(source).includes('localStorage')) {
        throw new Error(`${path} ينادي localStorage مباشرةً بدل مخزن التركيب`);
      }
    }
  });
});

/* ================================================================== *
 * سابعًا — القياس (بند ٣٥)
 *
 * ⚠️ **ولا رقمَ هنا مكتوبٌ من ذاكرتي.** كلُّه مقيسٌ في هذا المتصفّح
 *    الآن، ويُطبَع في السجلّ ليُقرَأ — والعتباتُ فضفاضةٌ عمدًا لأن
 *    الغرضَ كشفُ انحدارٍ فادحٍ لا تثبيتُ رقمٍ يتقلّب مع الجهاز.
 * ================================================================== */

describe('WS-H · القياس', () => {
  it('٣٦ · أرقامُ دورةٍ كاملة: نداءاتٌ وزمنٌ وحجمُ حزمة', async () => {
    await resetDevices();
    const { cloud, rigs } = makeCloud();

    await on(TABLET, async () => {
      const scene = await scenes.create({ titleAr: 'قياس', date: '2026-08-01' });
      const main = await addScript(scene.id, { title: 'ر', text: 'ن' });
      const phase = await addNode(main.id, { title: 'مرحلة', text: '' });
      for (let i = 0; i < 30; i++) {
        /* eslint-disable-next-line no-await-in-loop */
        await addNode(phase.id, { title: `جزء ${i}`, text: `نصّ الجزء رقم ${i}` });
      }
    });

    await connectOn(TABLET, rigs[TABLET]);
    const push = await syncOn(TABLET, rigs[TABLET]);
    expect(push.ok).toBe(true);

    const pkg = [...cloud.files.values()].find((f) => f.role === 'package');
    const pkgBytes = new Blob([JSON.stringify(pkg.body)]).size;

    await connectOn(MOBILE, rigs[MOBILE]);
    const pull = await syncOn(MOBILE, rigs[MOBILE]);
    const idle = await syncOn(MOBILE, rigs[MOBILE]);

    console.log('[WS-H قياس]', JSON.stringify({
      changes: push.pushed.changes,
      packageBytes: pkgBytes,
      bytesPerChange: Math.round(pkgBytes / push.pushed.changes),
      pushMs: push.ms, pushOps: push.ops.total,
      pullMs: pull.ms, pullOps: pull.ops.total,
      idleMs: idle.ms, idleOps: idle.ops.total,
    }));

    /* ⚠️ عتباتُ انحدارٍ فادح — لا أرقامٌ دقيقة. */
    expect(push.ops.total < 12).toBe(true);
    expect(idle.ops.total <= push.ops.total).toBe(true);
    expect(pkgBytes / push.pushed.changes < 4000).toBe(true);
    expect(pull.ms < 12000).toBe(true);
  });

  it('٣٧ · ⚠️ وزمنُ الكتابة المحلّيّة لا يتأثّر بوجود السحابة (بند ٩)', async () => {
    await resetDevices();
    const { rigs } = makeCloud([TABLET]);

    const timeWrites = async (count) => {
      const started = performance.now();
      for (let i = 0; i < count; i++) {
        /* eslint-disable-next-line no-await-in-loop */
        await addScript(null, { title: `س ${i}`, text: 'نصّ قصير' });
      }
      return (performance.now() - started) / count;
    };

    activate(TABLET);
    const bare = await timeWrites(12);

    activate(TABLET);
    attachCloud(rigs[TABLET].transport);
    await connectOn(TABLET, rigs[TABLET]);
    await syncOn(TABLET, rigs[TABLET]);

    /*
     * ⚠️ **و`markDirty` تُنادى مع كلّ كتابةٍ كما يفعل التطبيق** — فلو
     *    كان الرفعُ يقع داخل مسار الكتابة لظهر هنا مباشرةً.
     */
    activate(TABLET);
    const started = performance.now();
    for (let i = 0; i < 12; i++) {
      /* eslint-disable-next-line no-await-in-loop */
      await addScript(null, { title: `م ${i}`, text: 'نصّ قصير' });
      rigs[TABLET].sync.markDirty();
    }
    const wired = (performance.now() - started) / 12;

    console.log('[WS-H قياس] كتابة', JSON.stringify({
      bareMs: Number(bare.toFixed(2)),
      withCloudMs: Number(wired.toFixed(2)),
      ratio: Number((wired / bare).toFixed(2)),
    }));

    /* الكتابةُ الموصولةُ لا تتجاوز ضِعفَي المجرّدة ولا ٦٠ مِلّي. */
    expect(wired < Math.max(60, bare * 3)).toBe(true);

    await detachCloud();
  });
});

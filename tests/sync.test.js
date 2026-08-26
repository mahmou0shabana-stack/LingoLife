/**
 * LingoLife — اختباراتُ أساسِ المزامنة (WS-G)
 *
 * ⚠️ **كلُّ سيناريو هنا يعمل على قاعدتين حقيقيّتين** — لا كائناتٍ في
 *    الذاكرة تتظاهر بأنها مستودعات (بند ٩٠). فما يمرّ هنا يمرّ على
 *    جهازك، وما يسقط هنا كان سيسقط عليه.
 */

import { describe, it, expect } from './test-runner.js';
import {
  TABLET, MOBILE, LAPTOP, SPARE,
  resetDevices, on, cloneDevice, pair, packageFrom, planOn, applyOn,
  sendTo, snapshot, rowsOn, rowOn, activate,
} from './sync-devices.js';

import { scripts, media, expressions, relationships, savedItems, practiceEvidence,
  mistakeComparisons, expressionOccurrences, settings, scenes } from '../js/db/repositories.js';
import { addScript, updateScript } from '../js/services/content-service.js';
import { addNode, moveNodeTo, moveNode, PART_OF } from '../js/services/organize-service.js';
import { link, unlink, LINK } from '../js/services/link-service.js';
import { STATE } from '../js/db/schema.js';

import { diffLogical, describeDiff } from '../js/services/sync/logical-state.js';
import { CONFLICT, RESOLUTION, resolveConflict, applicable, planSummary } from '../js/services/sync/conflicts.js';
import { validateSyncPackage } from '../js/services/sync/sync-package.js';
import { createPackageFor } from '../js/services/sync/sync-service.js';
import { STORE_POLICY, policyMatrix, settingShared, CATEGORY } from '../js/services/sync/sync-policy.js';
import { STORE_NAMES } from '../js/db/schema.js';
import { localVector } from '../js/services/sync/sync-service.js';
import { edgeKey, survivorId } from '../js/services/sync/merge-planner.js';

/* ------------------------------------------------------------------ *
 * عالمُ الأساس
 * ------------------------------------------------------------------ */

/** ⚠️ يُبنى بالخدمات الحقيقيّة — لا `put` خام. */
async function buildBase() {
  const scene = await scenes.create({ titleAr: 'ذكرى الأساس', date: '2026-05-01' });
  const main = await addScript(scene.id, { title: 'السكريبت الرئيسيّ', text: 'نصُّ الأساس' });
  const phase1 = await addNode(main.id, { title: 'المرحلة ١', text: '' });
  const part1 = await addNode(phase1.id, { title: 'الجزء ١', text: 'نصُّ الجزء الأوّل' });
  const part2 = await addNode(phase1.id, { title: 'الجزء ٢', text: 'نصُّ الجزء الثاني' });

  const audioX = await media.create({ kind: 'audio', mime: 'audio/webm', bytes: 1024, filename: 'X.weba' });
  const imageY = await media.create({ kind: 'image', mime: 'image/png', bytes: 512, filename: 'Y.png' });

  return {
    sceneId: scene.id, mainId: main.id, phase1: phase1.id,
    part1: part1.id, part2: part2.id, audioX: audioX.id, imageY: imageY.id,
  };
}

/** يجهّز جهازين مستنسخين ومقترنين، ويعيد معرِّفات الأساس. */
async function twoDevices() {
  await resetDevices();
  const base = await on(TABLET, buildBase);
  await cloneDevice(TABLET, MOBILE);
  await pair(TABLET, MOBILE);
  return base;
}

const titleOf = async (device, id) => (await rowOn(device, 'scripts', id))?.title;
const textOf = async (device, id) => (await rowOn(device, 'scripts', id))?.text;

async function edgesOn(device, kind = null) {
  const rows = await rowsOn(device, 'relationships');
  return rows.filter((r) => !kind || r.kind === kind).map(edgeKey).sort();
}

/* ================================================================== *
 * أوّلًا — السياسةُ والصيغة (بلا قواعدَ ولا أجهزة)
 * ================================================================== */

describe('WS-G · السياسةُ والصيغة', () => {
  it('١ · كلُّ مخزنٍ في الـschema له سياسةٌ مكتوبةٌ بسببها (بند ١٠)', () => {
    const missing = STORE_NAMES.filter((name) => !STORE_POLICY[name]);
    expect(missing.join(' ') || 'لا شيء').toBe('لا شيء');

    const noReason = policyMatrix().filter((row) => !row.why || row.why.length < 12);
    expect(noReason.map((r) => r.store).join(' ') || 'لا شيء').toBe('لا شيء');
  });

  it('٢ · ⚠️ والمشتقُّ والمحلّيُّ لا يُزامَنان — بالاسم لا بالنيّة (بندا ٩ و٤٤)', () => {
    const matrix = Object.fromEntries(policyMatrix().map((r) => [r.store, r]));
    for (const store of ['memoryOccurrences', 'searchIndex']) {
      expect(matrix[store].category).toBe(CATEGORY.DERIVED);
      expect(matrix[store].synced).toBe(false);
    }
    for (const store of ['nativeAudio', 'generatedAudio', 'syncQueue', 'changeLog', 'syncPeers',
      'backupHistory', 'analysisRuns', 'analysisProposals']) {
      expect(matrix[store].category).toBe(CATEGORY.LOCAL_ONLY);
      expect(matrix[store].synced).toBe(false);
    }
  });

  it('٣ · ⚠️ والإعداداتُ مفتاحٌ بمفتاح، والافتراضُ محلّيّ (بندا ٤٥ و٧٨)', () => {
    /* بياناتُ لغةٍ كتبتَها — تُزامَن. */
    expect(settingShared('shadow.stressDictionary')).toBe(true);
    expect(settingShared('saved.tags')).toBe(true);
    /* حالةُ جهازٍ أو موضعُ قراءة — لا تُزامَن (بند ٧٧). */
    for (const key of ['shadow.split', 'shadow.sky', 'shadow.doc', 'ui.lastRoute',
      'shadow.reference.view', 'shadow.reference.doc', 'shadow.ttsProvider']) {
      expect(settingShared(key)).toBe(false);
    }
    /* ومفتاحٌ لم يُذكَر قطّ محلّيٌّ بالافتراض. */
    expect(settingShared('مفتاحٌ لم يوجد بعد')).toBe(false);
  });

  it('٤ · هُويّةُ الحافّة طرفاها ونوعُها لا معرِّفُ صفّها (بند ٢٢)', () => {
    const a = { id: 'REL_1', fromId: 'A', toId: 'B', kind: 'audio:script' };
    const b = { id: 'REL_2', fromId: 'B', toId: 'A', kind: 'audio:script' };
    expect(edgeKey(a)).toBe(edgeKey(b));
    expect(edgeKey({ ...a, kind: 'image:script' }) === edgeKey(a)).toBe(false);
    /* والباقي أصغرُ المعرِّفات نصًّا — حتميّةٌ يحسبها الجهازان معًا. */
    expect(survivorId(['REL_9', 'REL_2', 'REL_5'])).toBe('REL_2');
    expect(survivorId(['REL_5', 'REL_2', 'REL_9'])).toBe('REL_2');
  });

  it('٥ · التحقّقُ يرفض الصيغةَ والإصدارَ والمخزنَ المجهول (بند ٧٠)', () => {
    expect(validateSyncPackage(null).ok).toBe(false);
    expect(validateSyncPackage({ format: 'شيء آخر', version: 1 }).ok).toBe(false);
    expect(validateSyncPackage({
      format: 'lingolife-sync', version: 99, packageId: 'P', sourceDeviceId: 'D', changes: [],
    }).ok).toBe(false);

    const base = {
      format: 'lingolife-sync', version: 1, packageId: 'P', sourceDeviceId: 'D', changes: [],
    };
    expect(validateSyncPackage(base).ok).toBe(true);

    const bad = (change) => validateSyncPackage({ ...base, changes: [change] });
    expect(bad({ originDevice: 'D', originSeq: 1, store: 'لا وجود له', recordId: 'X', op: 'put', record: {} }).ok).toBe(false);
    expect(bad({ originDevice: 'D', originSeq: 1, store: 'memoryOccurrences', recordId: 'X', op: 'put', record: { id: 'X' } }).ok).toBe(false);
    expect(bad({ originDevice: 'D', originSeq: 1, store: 'scripts', recordId: 'X', op: 'شيء', record: { id: 'X' } }).ok).toBe(false);
    expect(bad({ originDevice: 'D', originSeq: 1, store: 'scripts', recordId: 'X', op: 'put', record: { id: 'مختلف' } }).ok).toBe(false);
    expect(bad({ originDevice: 'D', originSeq: 1, store: 'scripts', recordId: 'X', op: 'put', record: { id: 'X' } }).ok).toBe(true);
  });

  it('٦ · ⚠️ ومعرِّفُ تغييرٍ مكرَّرٌ داخل الحزمة يُرفَض (بند ٧٠)', () => {
    const change = { originDevice: 'D', originSeq: 4, store: 'scripts', recordId: 'X', op: 'put', record: { id: 'X' } };
    const result = validateSyncPackage({
      format: 'lingolife-sync', version: 1, packageId: 'P', sourceDeviceId: 'D',
      changes: [change, { ...change }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('مكرَّر'))).toBe(true);
  });

  it('٧ · ⚠️ وحزمةٌ فيها بايتاتٌ تُرفَض — الحزمةُ تصف ولا تحمل (بند ٧٥)', () => {
    const result = validateSyncPackage({
      format: 'lingolife-sync', version: 1, packageId: 'P', sourceDeviceId: 'D', changes: [],
      blobManifest: [{ mediaId: 'MED_1', blob: 'AAAA' }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('بايتات'))).toBe(true);
  });

  it('٨ · ⚠️ وحقلٌ محلّيٌّ تسلّل إلى الحزمة يُرفَض (بند ٧٧)', () => {
    const result = validateSyncPackage({
      format: 'lingolife-sync', version: 1, packageId: 'P', sourceDeviceId: 'D',
      changes: [{
        originDevice: 'D', originSeq: 1, store: 'shadowSessions', recordId: 'SHS_1',
        op: 'put', record: { id: 'SHS_1', currentSegmentIndex: 7 },
      }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('تسلّل'))).toBe(true);
  });
});

/* ================================================================== *
 * ثانيًا — السجلُّ والهُويّة على قاعدةٍ حقيقيّة
 * ================================================================== */

describe('WS-G · سجلُّ التغيير', () => {
  it('٩ · كلُّ كتابةٍ تترك سطرًا — والحذفُ الصلبُ يترك شاهدَ قبر', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const script = await addScript(null, { title: 'أ', text: 'ب' });
      await updateScript(script.id, { title: 'ج' });
      const rel = await link(script.id, 'MED_X', LINK.AUDIO_SCRIPT);
      await relationships.destroy(rel.id);

      const log = await rowsOn(TABLET, 'changeLog');
      const forScript = log.filter((r) => r.recordId === script.id && r.store === 'scripts');
      expect(forScript.length >= 2).toBe(true);
      /* الإنشاءُ بلا أساسٍ ولا قائمةِ حقول = «الصفُّ كلُّه». */
      expect(forScript[0].baseRev).toBe(null);
      expect(forScript[0].fields).toBe(null);
      /* والتعديلُ يحمل ما تغيّر فعلًا. */
      const edit = forScript.find((r) => r.fields?.includes('title'));
      expect(Boolean(edit)).toBe(true);

      const removal = log.find((r) => r.op === 'remove' && r.recordId === rel.id);
      expect(Boolean(removal)).toBe(true);
      /* ⚠️ وصورةُ الصفّ محفوظةٌ — وإلّا لَما عرف الجارُ أيَّ حافّةٍ فُكَّت. */
      expect(removal.payload.kind).toBe(LINK.AUDIO_SCRIPT);
      expect(removal.payload.toId).toBe('MED_X');
    });
  });

  it('١٠ · ⚠️ ولا يُسجَّل المشتقُّ ولا المحلّيّ (حارسُ الأداء)', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const { memoryOccurrences, nativeAudio } = await import('../js/db/repositories.js');
      await memoryOccurrences.putManyRaw([
        { id: 'MOC_1', canonical: 'x', sourceKey: 's:1', kind: 'word' },
        { id: 'MOC_2', canonical: 'y', sourceKey: 's:1', kind: 'word' },
      ]);
      await nativeAudio.putRaw({ word: 'привет', fetchedAt: Date.now() });
      const log = await rowsOn(TABLET, 'changeLog');
      expect(log.filter((r) => r.store === 'memoryOccurrences')).toHaveLength(0);
      expect(log.filter((r) => r.store === 'nativeAudio')).toHaveLength(0);
    });
  });

  it('١١ · ⚠️ وحفظُ نفسِ القيمة لا يُنتج حقلًا متغيّرًا (تعارضٌ من لا شيء)', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const script = await addScript(null, { title: 'ثابت', text: 'نصّ' });
      await scripts.update(script.id, { title: 'ثابت' });
      const log = await rowsOn(TABLET, 'changeLog');
      const last = log.filter((r) => r.recordId === script.id).at(-1);
      expect(last.fields).toEqual([]);
    });
  });

  it('١٢ · ⚠️ والإعداداتُ المحلّيّةُ لا تدخل السجلَّ أصلًا (بند ٧٧)', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      await settings.set('shadow.split', 0.42);
      await settings.set('ui.lastRoute', '/workspace/X');
      await settings.set('shadow.stressDictionary', { привет: 'приве́т' });
      const log = await rowsOn(TABLET, 'changeLog');
      const keys = log.filter((r) => r.store === 'settings').map((r) => r.recordId);
      expect(keys).toEqual(['shadow.stressDictionary']);
    });
  });
});

/* ================================================================== *
 * ثالثًا — السيناريوهاتُ الكبرى (بنود ٥٣…٦٧)
 * ================================================================== */

describe('WS-G · السيناريو ١ — تغييراتٌ لا تتصادم (بند ٥٣)', () => {
  it('١٣ · الجهازان يعملان دون اتّصال ثم يلتقيان بلا تعارضٍ واحد', async () => {
    const base = await twoDevices();

    /* ---- التابلت: عدّل الجزء ١، وأضاف الجزء ٣ وصوتًا وربطه ---- */
    const tablet = await on(TABLET, async () => {
      await updateScript(base.part1, { text: 'نصُّ الجزء الأوّل — بعد تعديل التابلت' });
      const part3 = await addNode(base.phase1, { title: 'الجزء ٣', text: 'جديد' });
      const audioA = await media.create({ kind: 'audio', mime: 'audio/webm', bytes: 2048, filename: 'A.weba' });
      await link(audioA.id, part3.id, LINK.AUDIO_SCRIPT);
      return { part3: part3.id, audioA: audioA.id };
    });

    /* ---- الموبايل: سمّى المرحلة، وأضاف صورةً وربطها، وحفظ عبارةً وسجّل تدريبًا ---- */
    const mobile = await on(MOBILE, async () => {
      await scripts.update(base.phase1, { title: 'المرحلة الأولى — باسمٍ من الموبايل' });
      const imageB = await media.create({ kind: 'image', mime: 'image/png', bytes: 700, filename: 'B.png' });
      await link(imageB.id, base.part2, LINK.IMAGE_SCRIPT);
      const saved = await savedItems.create({ kind: 'phrase', text: 'спасибо большое', normalizedText: 'спасибо большое' });
      const evidence = await practiceEvidence.create({
        targetType: 'shadowSegment', targetId: 'SHG_X', practiceType: 'repeat', practicedAt: Date.now(),
      });
      return { imageB: imageB.id, saved: saved.id, evidence: evidence.id };
    });

    /* ---- التبادلُ في الاتّجاهين ---- */
    const toMobile = await sendTo(TABLET, MOBILE);
    expect(toMobile.plan.conflicts).toHaveLength(0);
    expect(toMobile.ok).toBe(true);

    const toTablet = await sendTo(MOBILE, TABLET);
    expect(toTablet.plan.conflicts).toHaveLength(0);
    expect(toTablet.ok).toBe(true);

    /* ---- كلُّ ما كتبه كلٌّ منهما موجودٌ عند الاثنين ---- */
    for (const device of [TABLET, MOBILE]) {
      expect(await textOf(device, base.part1)).toContain('بعد تعديل التابلت');
      expect(await titleOf(device, base.phase1)).toContain('من الموبايل');
      expect(Boolean(await rowOn(device, 'scripts', tablet.part3))).toBe(true);
      expect(Boolean(await rowOn(device, 'media', tablet.audioA))).toBe(true);
      expect(Boolean(await rowOn(device, 'media', mobile.imageB))).toBe(true);
      expect(Boolean(await rowOn(device, 'savedItems', mobile.saved))).toBe(true);
      expect(Boolean(await rowOn(device, 'practiceEvidence', mobile.evidence))).toBe(true);

      const edges = await edgesOn(device);
      expect(edges.includes(edgeKey({ fromId: tablet.audioA, toId: tablet.part3, kind: LINK.AUDIO_SCRIPT }))).toBe(true);
      expect(edges.includes(edgeKey({ fromId: mobile.imageB, toId: base.part2, kind: LINK.IMAGE_SCRIPT }))).toBe(true);
    }
  });

  it('١٤ · ⚠️ والحالتان المنطقيّتان تتطابقان — لا بالعدد بل بالمحتوى (بندا ٨٧ و٨٨)', async () => {
    const diff = diffLogical(await snapshot(TABLET), await snapshot(MOBILE));
    expect(describeDiff(diff)).toBe('الحالتان متطابقتان منطقيًّا');
  });

  it('١٥ · ⚠️ وبايتاتُ الوسيط لم تعبر — والوصفُ يقول ذلك صراحةً (بندا ٣١ و٧٥)', async () => {
    const rows = await rowsOn(MOBILE, 'media');
    const fromTablet = rows.find((r) => r.filename === 'A.weba');
    expect(Boolean(fromTablet)).toBe(true);
    expect(fromTablet.bytes).toBe(2048);
    /* ⚠️ ولا يُزعَم أن الملفَّ هنا. */
    expect(fromTablet.blobPending).toBe(1);
    expect(fromTablet.blob).toBe(null);
  });
});

describe('WS-G · السيناريو ٢ — حقلان مختلفان في صفٍّ واحد (بند ٥٤)', () => {
  it('١٦ · العنوانُ من هنا والنصُّ من هناك — ولا تعارض (بند ١١)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.update(base.mainId, { text: 'نصٌّ من التابلت' }));
    await on(MOBILE, () => scripts.update(base.mainId, { title: 'عنوانٌ من الموبايل' }));

    const a = await sendTo(TABLET, MOBILE);
    const b = await sendTo(MOBILE, TABLET);
    expect(a.plan.conflicts).toHaveLength(0);
    expect(b.plan.conflicts).toHaveLength(0);

    for (const device of [TABLET, MOBILE]) {
      expect(await titleOf(device, base.mainId)).toBe('عنوانٌ من الموبايل');
      expect(await textOf(device, base.mainId)).toBe('نصٌّ من التابلت');
    }
    expect(diffLogical(await snapshot(TABLET), await snapshot(MOBILE)).same).toBe(true);
  });
});

describe('WS-G · السيناريو ٣ — نفسُ الحقل (بند ٥٥)', () => {
  it('١٧ · تعارضٌ حاجزٌ واحد، والقيمتان محفوظتان قبل القرار (بندا ١٢ و٤١)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.update(base.mainId, { title: 'التغليف والحماية' }));
    await on(MOBILE, () => scripts.update(base.mainId, { title: 'التغليف الفنّي' }));

    const pkg = await packageFrom(TABLET, MOBILE);
    const plan = await planOn(MOBILE, pkg);

    expect(plan.conflicts).toHaveLength(1);
    const conflict = plan.conflicts[0];
    expect(conflict.type).toBe(CONFLICT.FIELD);
    expect(conflict.field).toBe('title');
    /* ⚠️ **والطرفان محفوظان** — لا أحدَ يغلب قبل أن تختار. */
    expect(conflict.local.value).toBe('التغليف الفنّي');
    expect(conflict.remote.value).toBe('التغليف والحماية');
    expect(applicable(plan)).toBe(false);
  });

  it('١٨ · ⚠️ والتطبيقُ يرفض قبل القرار — لا نصفَ دمج (بند ٤١)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.update(base.mainId, { title: 'ت' }));
    await on(MOBILE, () => scripts.update(base.mainId, { title: 'م' }));
    const pkg = await packageFrom(TABLET, MOBILE);
    const plan = await planOn(MOBILE, pkg);
    await expect(applyOn(MOBILE, plan)).toReject('محتاج قرارَك');
    /* والقاعدةُ لم تُمَسّ. */
    expect(await titleOf(MOBILE, base.mainId)).toBe('م');
  });

  it('١٩ · «استعمل نسخةَ التابلت» يلتقيان على نصّه', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.update(base.mainId, { title: 'نسخةُ التابلت' }));
    await on(MOBILE, () => scripts.update(base.mainId, { title: 'نسخةُ الموبايل' }));

    const pkg = await packageFrom(TABLET, MOBILE);
    const plan = await planOn(MOBILE, pkg);
    resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.USE_REMOTE);
    await applyOn(MOBILE, plan);
    expect(await titleOf(MOBILE, base.mainId)).toBe('نسخةُ التابلت');

    /* ثم يرجع القرارُ إلى التابلت فيلتقيان. */
    const back = await sendTo(MOBILE, TABLET);
    expect(back.ok).toBe(true);
    expect(await titleOf(TABLET, base.mainId)).toBe('نسخةُ التابلت');
  });

  it('٢٠ · «استعمل نسختي» تُبقي المحلّيّ — والفرعُ الآخر لم يُكتَب', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.update(base.mainId, { title: 'نسخةُ التابلت' }));
    await on(MOBILE, () => scripts.update(base.mainId, { title: 'نسخةُ الموبايل' }));

    const pkg = await packageFrom(TABLET, MOBILE);
    const plan = await planOn(MOBILE, pkg);
    resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.USE_LOCAL);
    await applyOn(MOBILE, plan);
    expect(await titleOf(MOBILE, base.mainId)).toBe('نسخةُ الموبايل');
  });

  it('٢١ · ⚠️ وقرارٌ لا يصلح لنوعه يُرفَض بالاسم (بند ٤٠)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.update(base.mainId, { title: 'ت' }));
    await on(MOBILE, () => scripts.update(base.mainId, { title: 'م' }));
    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));
    let threw = '';
    try {
      resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.KEEP_DELETE);
    } catch (error) {
      threw = error.message;
    }
    expect(threw).toContain('لا يصلح');
  });

  it('٢٢ · وقيمةٌ ثالثةٌ يكتبها الإنسان مقبولةٌ للنصوص (بند ١٣)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.update(base.mainId, { title: 'ت' }));
    await on(MOBILE, () => scripts.update(base.mainId, { title: 'م' }));
    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));
    resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.MANUAL_VALUE, 'عنوانٌ كتبتُه أنا');
    await applyOn(MOBILE, plan);
    expect(await titleOf(MOBILE, base.mainId)).toBe('عنوانٌ كتبتُه أنا');
  });
});

describe('WS-G · السيناريو ٤ — حذفٌ مقابلَ تعديل (بند ٥٦)', () => {
  it('٢٣ · تعارضُ حذف/تعديل — لا حذفٌ صامتٌ ولا بعثٌ صامت (بند ١٩)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part2, { text: 'الجزء ٢ بعد تعديل التابلت' }));
    await on(MOBILE, () => scripts.trash(base.part2));

    const plan = await planOn(TABLET, await packageFrom(MOBILE, TABLET));
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].type).toBe(CONFLICT.DELETE_EDIT);
    expect(applicable(plan)).toBe(false);
  });

  it('٢٤ · «سيبه محذوف» يُنهي الصفَّ', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part2, { text: 'معدَّل' }));
    await on(MOBILE, () => scripts.trash(base.part2));
    const plan = await planOn(TABLET, await packageFrom(MOBILE, TABLET));
    resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.KEEP_DELETE);
    await applyOn(TABLET, plan);
    expect(await rowOn(TABLET, 'scripts', base.part2)).toBe(undefined);
  });

  it('٢٥ · «سيب النسخة المعدَّلة» يُعيده حيًّا بنصِّه', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part2, { text: 'نصٌّ نجا من الحذف' }));
    await on(MOBILE, () => scripts.trash(base.part2));
    const plan = await planOn(TABLET, await packageFrom(MOBILE, TABLET));
    resolveConflict(plan, plan.conflicts[0].id, RESOLUTION.KEEP_EDIT);
    await applyOn(TABLET, plan);
    const row = await rowOn(TABLET, 'scripts', base.part2);
    expect(row.state).toBe(STATE.ACTIVE);
    expect(row.text).toBe('نصٌّ نجا من الحذف');
  });

  it('٢٦ · حذفٌ مقابلَ سكون: الحذفُ يسري بلا سؤال (بند ١٨)', async () => {
    const base = await twoDevices();
    await on(MOBILE, () => scripts.trash(base.part2));
    const outcome = await sendTo(MOBILE, TABLET);
    expect(outcome.plan.conflicts).toHaveLength(0);
    expect((await rowOn(TABLET, 'scripts', base.part2)).state).toBe(STATE.TRASHED);
  });

  it('٢٧ · حذفٌ مقابلَ حذف: شاهدُ قبرٍ واحدٌ بلا تعارض (بند ٢٠)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => scripts.trash(base.part2));
    await on(MOBILE, () => scripts.trash(base.part2));
    const a = await sendTo(TABLET, MOBILE);
    const b = await sendTo(MOBILE, TABLET);
    expect(a.plan.conflicts).toHaveLength(0);
    expect(b.plan.conflicts).toHaveLength(0);
    for (const device of [TABLET, MOBILE]) {
      expect((await rowOn(device, 'scripts', base.part2)).state).toBe(STATE.TRASHED);
    }
    expect(diffLogical(await snapshot(TABLET), await snapshot(MOBILE)).same).toBe(true);
  });
});

describe('WS-G · السيناريو ٥ — كيانٌ فريدٌ بمعرِّفين (بند ٥٧)', () => {
  it('٢٨ · «согласование» مرّتين تصير كيانًا واحدًا وتاريخُ الاثنين ينجو', async () => {
    const base = await twoDevices();

    const t = await on(TABLET, async () => {
      const expression = await expressions.create({
        text: 'согласование', normalizedText: 'согласование', meaningAr: 'موافقة',
      });
      const occurrence = await expressionOccurrences.create({
        expressionId: expression.id, sceneId: base.sceneId, occurredAt: 1000, kind: 'heard',
      });
      return { id: expression.id, occurrence: occurrence.id };
    });

    const m = await on(MOBILE, async () => {
      const expression = await expressions.create({
        text: 'согласование', normalizedText: 'согласование', register: 'formal',
      });
      const mistake = await mistakeComparisons.create({
        expressionId: expression.id, wrong: 'согласованиe', natural: 'согласование', occurredAt: 2000,
      });
      return { id: expression.id, mistake: mistake.id };
    });

    expect(t.id === m.id).toBe(false);

    const toMobile = await sendTo(TABLET, MOBILE);
    expect(toMobile.ok).toBe(true);
    const toTablet = await sendTo(MOBILE, TABLET);
    expect(toTablet.ok).toBe(true);

    const survivor = survivorId([t.id, m.id]);
    const gone = survivor === t.id ? m.id : t.id;

    for (const device of [TABLET, MOBILE]) {
      const rows = (await rowsOn(device, 'expressions'))
        .filter((r) => r.normalizedText === 'согласование');
      /* ⚠️ كيانٌ واحدٌ — وفهرسُ `unique` كان سيرفض غيرَ ذلك. */
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(survivor);
      /* وحقولُ الخاسر لم تُهدَر: ما كان فارغًا عند الباقي مُلئ منه. */
      expect(rows[0].meaningAr).toBe('موافقة');
      expect(rows[0].register).toBe('formal');

      /* والتاريخُ من الجهازين موجودٌ ويشير إلى الباقي. */
      const occ = await rowOn(device, 'expressionOccurrences', t.occurrence);
      const mis = await rowOn(device, 'mistakeComparisons', m.mistake);
      expect(Boolean(occ)).toBe(true);
      expect(Boolean(mis)).toBe(true);
      expect(occ.expressionId).toBe(survivor);
      expect(mis.expressionId).toBe(survivor);
      /* ولا مرجعَ معلّقٌ على الخاسر. */
      expect(await rowOn(device, 'expressions', gone)).toBe(undefined);
    }

    expect(diffLogical(await snapshot(TABLET), await snapshot(MOBILE)).same).toBe(true);
  });

  it('٢٩ · ⚠️ ومعنيان مختلفان لنفس الكيان تعارضٌ يُعرَض لا ابتلاع', async () => {
    await twoDevices();
    await on(TABLET, () => expressions.create({
      text: 'вскрыть', normalizedText: 'вскрыть', meaningAr: 'يفتح بحذر',
    }));
    await on(MOBILE, () => expressions.create({
      text: 'вскрыть', normalizedText: 'вскрыть', meaningAr: 'يفضّ الختم',
    }));

    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));
    const conflict = plan.conflicts.find((c) => c.type === CONFLICT.UNIQUE_ENTITY);
    expect(Boolean(conflict)).toBe(true);
    expect(conflict.field).toBe('meaningAr');
    expect(applicable(plan)).toBe(false);
  });
});

describe('WS-G · السيناريوهان ٦ و٧ — نقلُ العُقَد (بندا ٥٨ و٥٩)', () => {
  it('٣٠ · نقلٌ هنا وتعديلُ نصٍّ هناك — الاثنان ينجوان بلا تعارض (بند ٢٧)', async () => {
    const base = await twoDevices();
    const phase2 = await on(TABLET, async () => {
      const node = await addNode(base.mainId, { title: 'المرحلة ٢', text: '' });
      await moveNodeTo(base.part2, node.id);
      return node.id;
    });
    await on(MOBILE, () => updateScript(base.part2, { text: 'نصٌّ عدّله الموبايل' }));

    const a = await sendTo(TABLET, MOBILE);
    const b = await sendTo(MOBILE, TABLET);
    expect(a.plan.conflicts).toHaveLength(0);
    expect(b.plan.conflicts).toHaveLength(0);

    for (const device of [TABLET, MOBILE]) {
      expect(await textOf(device, base.part2)).toBe('نصٌّ عدّله الموبايل');
      const edges = await edgesOn(device, PART_OF);
      expect(edges.includes(edgeKey({ fromId: phase2, toId: base.part2, kind: PART_OF }))).toBe(true);
      expect(edges.includes(edgeKey({ fromId: base.phase1, toId: base.part2, kind: PART_OF }))).toBe(false);
    }
    expect(diffLogical(await snapshot(TABLET), await snapshot(MOBILE)).same).toBe(true);
  });

  it('٣١ · نقلان إلى أبوين مختلفين — تعارضُ نقلٍ بلا اختيارٍ اعتباطيّ (بند ٢٨)', async () => {
    const base = await twoDevices();
    const phaseA = await on(TABLET, async () => {
      const node = await addNode(base.mainId, { title: 'المرحلة أ', text: '' });
      await moveNodeTo(base.part2, node.id);
      return node.id;
    });
    const phaseB = await on(MOBILE, async () => {
      const node = await addNode(base.mainId, { title: 'المرحلة ب', text: '' });
      await moveNodeTo(base.part2, node.id);
      return node.id;
    });

    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));
    const conflict = plan.conflicts.find((c) => c.type === CONFLICT.TREE_MOVE);
    expect(Boolean(conflict)).toBe(true);
    expect(conflict.extra.childId).toBe(base.part2);
    expect(conflict.extra.localParent).toBe(phaseB);
    expect(conflict.extra.remoteParent).toBe(phaseA);
    expect(applicable(plan)).toBe(false);

    /* والقرارُ يُنفَّذ فعلًا — أبٌ واحدٌ لا اثنان. */
    resolveConflict(plan, conflict.id, RESOLUTION.USE_REMOTE);
    await applyOn(MOBILE, plan);
    const parents = (await rowsOn(MOBILE, 'relationships'))
      .filter((r) => r.kind === PART_OF && r.toId === base.part2)
      .map((r) => r.fromId);
    expect(parents).toEqual([phaseA]);
  });
});

describe('WS-G · السيناريو ٨ — إعادةُ الترتيب (بند ٦٠)', () => {
  it('٣٢ · ترتيبان مستقلّان يُنتجان تعارضَ ترتيبٍ واحدًا لكلّ أب (بند ٢٥)', async () => {
    const base = await twoDevices();
    const part3 = await on(TABLET, async () => {
      const node = await addNode(base.phase1, { title: 'الجزء ٣', text: '' });
      return node.id;
    });
    /* ⚠️ العقدةُ الثالثةُ تُضاف قبل الاستنساخ حتى يكون الأساسُ A B C. */
    await cloneDevice(TABLET, MOBILE);
    await pair(TABLET, MOBILE);

    await on(TABLET, () => moveNode(base.phase1, base.part2, 'up'));   // B A C
    await on(MOBILE, () => moveNode(base.phase1, part3, 'up'));        // A C B

    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));
    const orderConflicts = plan.conflicts.filter((c) => c.type === CONFLICT.TREE_ORDER);
    /* ⚠️ **واحدٌ لا أربعة** — الترتيبُ خاصّةُ قائمةٍ لا خاصّةُ حافّة. */
    expect(orderConflicts).toHaveLength(1);
    expect(orderConflicts[0].recordId).toBe(base.phase1);
    expect(orderConflicts[0].local.value).toHaveLength(3);
    expect(orderConflicts[0].remote.value).toHaveLength(3);
    /* ولا ترتيبَ ثالثٌ اختُرع. */
    expect(plan.conflicts.filter((c) => c.field === 'order')).toHaveLength(0);
    expect(applicable(plan)).toBe(false);

    resolveConflict(plan, orderConflicts[0].id, RESOLUTION.USE_REMOTE);
    await applyOn(MOBILE, plan);
    const after = (await rowsOn(MOBILE, 'relationships'))
      .filter((r) => r.kind === PART_OF && r.fromId === base.phase1)
      .sort((a, b) => a.order - b.order)
      .map((r) => r.toId);
    expect(after).toEqual([base.part2, base.part1, part3]);
  });

  it('٣٣ · إضافتان متوازيتان لا تُنتجان تعارضَ ترتيبٍ (بند ٢٦)', async () => {
    const base = await twoDevices();
    const c = await on(TABLET, async () => (await addNode(base.phase1, { title: 'ج', text: '' })).id);
    const d = await on(MOBILE, async () => (await addNode(base.phase1, { title: 'د', text: '' })).id);

    const a = await sendTo(TABLET, MOBILE);
    const b = await sendTo(MOBILE, TABLET);
    expect(a.plan.conflicts).toHaveLength(0);
    expect(b.plan.conflicts).toHaveLength(0);

    for (const device of [TABLET, MOBILE]) {
      const children = (await rowsOn(device, 'relationships'))
        .filter((r) => r.kind === PART_OF && r.fromId === base.phase1)
        .map((r) => r.toId).sort();
      expect(children).toEqual([base.part1, base.part2, c, d].sort());
    }
    expect(diffLogical(await snapshot(TABLET), await snapshot(MOBILE)).same).toBe(true);
  });
});

describe('WS-G · السيناريوهان ٩ و١٠ — الحوافّ (بندا ٦١ و٦٢)', () => {
  it('٣٤ · نفسُ الرابط على الجهازين يصير حافّةً واحدة (بند ٢٢)', async () => {
    const base = await twoDevices();
    const relT = await on(TABLET, () => link(base.audioX, base.part1, LINK.AUDIO_SCRIPT));
    const relM = await on(MOBILE, () => link(base.audioX, base.part1, LINK.AUDIO_SCRIPT));
    expect(relT.id === relM.id).toBe(false);

    await sendTo(TABLET, MOBILE);
    await sendTo(MOBILE, TABLET);

    const keep = survivorId([relT.id, relM.id]);
    for (const device of [TABLET, MOBILE]) {
      const rows = (await rowsOn(device, 'relationships'))
        .filter((r) => r.kind === LINK.AUDIO_SCRIPT && r.toId === base.part1);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(keep);
    }
    expect(diffLogical(await snapshot(TABLET), await snapshot(MOBILE)).same).toBe(true);
  });

  it('٣٥ · وربطُ نفسِ الصوت بجزأين مختلفين اتّحادٌ لا تعارض (بند ٦٢)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => link(base.audioX, base.part1, LINK.AUDIO_SCRIPT));
    await on(MOBILE, () => link(base.audioX, base.part2, LINK.AUDIO_SCRIPT));

    const a = await sendTo(TABLET, MOBILE);
    const b = await sendTo(MOBILE, TABLET);
    expect(a.plan.conflicts).toHaveLength(0);
    expect(b.plan.conflicts).toHaveLength(0);

    for (const device of [TABLET, MOBILE]) {
      const targets = (await rowsOn(device, 'relationships'))
        .filter((r) => r.kind === LINK.AUDIO_SCRIPT && r.fromId === base.audioX)
        .map((r) => r.toId).sort();
      expect(targets).toEqual([base.part1, base.part2].sort());
    }
  });

  it('٣٦ · ⚠️ وفكُّ الرابط يسري ولا يُبعَث (بند ٢٣)', async () => {
    await resetDevices();
    const fresh = await on(TABLET, async () => {
      const b = await buildBase();
      await link(b.audioX, b.part1, LINK.AUDIO_SCRIPT);
      return b;
    });
    await cloneDevice(TABLET, MOBILE);
    await pair(TABLET, MOBILE);

    await on(MOBILE, () => unlink(fresh.audioX, fresh.part1, LINK.AUDIO_SCRIPT));
    const outcome = await sendTo(MOBILE, TABLET);
    expect(outcome.plan.conflicts).toHaveLength(0);
    expect(outcome.plan.relationshipRemoves.length >= 1).toBe(true);

    /*
     * ⚠️ **وهذا هو المسار الذي لا يعمل بلا سجلّ.** `unlink()` تمحو
     *    الصفَّ محوًا، فمزامنةٌ تقارن القاعدتين ترى «رابطٌ عند التابلت
     *    وليس عند الموبايل» فتستنتج أن الموبايل ينقصه — وتُعيده.
     */
    expect(await edgesOn(TABLET, LINK.AUDIO_SCRIPT)).toHaveLength(0);
    expect(diffLogical(await snapshot(TABLET), await snapshot(MOBILE)).same).toBe(true);
  });
});

describe('WS-G · السيناريوهان ١١ و١٢ — التاريخُ لا يُستبدَل (بندا ٦٣ و٦٤)', () => {
  it('٣٧ · غلطتان مستقلّتان بنفس النمط تبقيان حدثين لا حدثًا بعدّاد', async () => {
    const base = await twoDevices();
    const t = await on(TABLET, () => mistakeComparisons.create({
      sceneId: base.sceneId, wrong: 'Спасибо большой', natural: 'Спасибо большое',
      patternKey: 'спасибо большой→спасибо большое', occurredAt: 1000,
    }));
    const m = await on(MOBILE, () => mistakeComparisons.create({
      sceneId: base.sceneId, wrong: 'Спасибо большой', natural: 'Спасибо большое',
      patternKey: 'спасибо большой→спасибо большое', occurredAt: 2000,
    }));

    await sendTo(TABLET, MOBILE);
    await sendTo(MOBILE, TABLET);

    for (const device of [TABLET, MOBILE]) {
      const rows = (await rowsOn(device, 'mistakeComparisons'))
        .filter((r) => r.patternKey === 'спасибо большой→спасибо большое');
      /* ⚠️ **حدثان** — ولا يُدمَجان بالمفتاح الطبيعيّ مهما تطابق. */
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.occurredAt).sort((x, y) => x - y)).toEqual([1000, 2000]);
    }
    expect(Boolean(await rowOn(TABLET, 'mistakeComparisons', m.id))).toBe(true);
    expect(Boolean(await rowOn(MOBILE, 'mistakeComparisons', t.id))).toBe(true);
  });

  it('٣٨ · وتدريبان مستقلّان يجتمعان بلا استنتاجِ إتقان', async () => {
    await twoDevices();
    await on(TABLET, () => practiceEvidence.create({
      targetType: 'shadowSegment', targetId: 'SHG_1', practiceType: 'repeat', practicedAt: 111,
    }));
    await on(MOBILE, () => practiceEvidence.create({
      targetType: 'shadowSegment', targetId: 'SHG_1', practiceType: 'repeat', practicedAt: 222,
    }));
    await sendTo(TABLET, MOBILE);
    await sendTo(MOBILE, TABLET);

    for (const device of [TABLET, MOBILE]) {
      const rows = await rowsOn(device, 'practiceEvidence');
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.practicedAt).sort((a, b) => a - b)).toEqual([111, 222]);
    }
  });
});

describe('WS-G · السيناريوهان ١٤ و١٥ — الحتميّةُ والترتيب (بندا ٦٦ و٦٧)', () => {
  it('٣٩ · تطبيقُ نفسِ الحزمة مرّتين لا يُضاعف شيئًا (بندا ٥٠ و٦٦)', async () => {
    const base = await twoDevices();
    await on(TABLET, async () => {
      await updateScript(base.part1, { text: 'مرّةً واحدة' });
      await link(base.audioX, base.part1, LINK.AUDIO_SCRIPT);
      await savedItems.create({ kind: 'phrase', text: 'фраза', normalizedText: 'фраза' });
    });

    const pkg = await packageFrom(TABLET, MOBILE);
    const first = await planOn(MOBILE, pkg);
    expect(first.counts.accepted > 0).toBe(true);
    await applyOn(MOBILE, first);

    const before = await snapshot(MOBILE);

    /* نفسُ الحزمة بالضبط، مرّةً ثانية. */
    const second = await planOn(MOBILE, pkg);
    expect(second.counts.accepted).toBe(0);
    expect(second.creates).toHaveLength(0);
    expect(second.updates).toHaveLength(0);
    expect(second.relationshipAdds).toHaveLength(0);
    expect(second.conflicts).toHaveLength(0);
    expect(second.noops.length >= 1).toBe(true);

    await applyOn(MOBILE, second);
    const after = await snapshot(MOBILE);
    expect(describeDiff(diffLogical(before, after))).toBe('الحالتان متطابقتان منطقيًّا');
  });

  it('٤٠ · حزمتان مستقلّتان تلتقيان بأيّ ترتيبٍ طُبِّقتا (بند ٦٧)', async () => {
    /*
     * ⚠️ **ولا يكفي جهازان لهذا الاختبار.** يلزم **نسختان من نفس
     *    الأساس** تُطبَّق على كلٍّ منهما الحزمتان بترتيبٍ معكوس. ولو
     *    استعملنا نفسَ الجهاز مرّتين لَكان الثاني يبدأ من نتيجة الأوّل
     *    — وهو ما يجعل السؤالَ بلا معنى.
     */
    await resetDevices([TABLET, MOBILE, LAPTOP, SPARE]);
    const base = await on(TABLET, buildBase);
    await cloneDevice(TABLET, MOBILE);
    await cloneDevice(TABLET, LAPTOP);
    await cloneDevice(TABLET, SPARE);
    await pair(TABLET, MOBILE);
    await pair(TABLET, LAPTOP);
    await pair(SPARE, MOBILE);
    await pair(SPARE, LAPTOP);

    await on(MOBILE, () => updateScript(base.part1, { text: 'نصٌّ من الموبايل' }));
    await on(LAPTOP, () => scripts.update(base.part2, { title: 'عنوانٌ من اللابتوب' }));

    const pkgM = await packageFrom(MOBILE, TABLET);
    const pkgL = await packageFrom(LAPTOP, TABLET);

    /* التابلت: م ثم ل */
    await applyOn(TABLET, await planOn(TABLET, pkgM));
    await applyOn(TABLET, await planOn(TABLET, pkgL));

    /* الاحتياطيّ: ل ثم م */
    await applyOn(SPARE, await planOn(SPARE, pkgL));
    await applyOn(SPARE, await planOn(SPARE, pkgM));

    const ab = await snapshot(TABLET);
    const ba = await snapshot(SPARE);
    expect(describeDiff(diffLogical(ab, ba))).toBe('الحالتان متطابقتان منطقيًّا');
    expect(await textOf(SPARE, base.part1)).toBe('نصٌّ من الموبايل');
    expect(await titleOf(TABLET, base.part2)).toBe('عنوانٌ من اللابتوب');
  });
});

/* ================================================================== *
 * رابعًا — الحدودُ والضماناتُ الباقية
 * ================================================================== */

describe('WS-G · التشغيلُ الجافّ والقرارات', () => {
  it('٤١ · التخطيطُ وحدَه لا يكتب حرفًا (بندا ٣٦ و٣٨)', async () => {
    const base = await twoDevices();
    await on(TABLET, async () => {
      await updateScript(base.part1, { text: 'تغييرٌ لن يُطبَّق' });
      await link(base.imageY, base.part1, LINK.IMAGE_SCRIPT);
      await scenes.create({ titleAr: 'ذكرى جديدة', date: '2026-06-01' });
    });

    const before = await snapshot(MOBILE);
    const pkg = await packageFrom(TABLET, MOBILE);
    const plan = await planOn(MOBILE, pkg);

    /* الخطّةُ تعرف ما ستفعل… */
    expect(plan.creates.length + plan.updates.length + plan.relationshipAdds.length >= 3).toBe(true);
    /* …ولا شيءَ منه وقع. */
    const after = await snapshot(MOBILE);
    expect(describeDiff(diffLogical(before, after))).toBe('الحالتان متطابقتان منطقيًّا');
    expect(await textOf(MOBILE, base.part1)).toBe('نصُّ الجزء الأوّل');
  });

  it('٤٢ · وملخّصُ الخطّة يفرّق بين الفعل والفعل (بند ٧٢)', async () => {
    const base = await twoDevices();
    await on(TABLET, async () => {
      await updateScript(base.part1, { text: 'تعديل' });
      await scenes.create({ titleAr: 'إضافة', date: '2026-06-02' });
      await scripts.trash(base.part2);
    });
    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));
    const summary = planSummary(plan);
    expect(summary.added >= 1).toBe(true);
    expect(summary.updated >= 1).toBe(true);
    expect(summary.conflicts).toBe(0);
  });
});

describe('WS-G · التسليمُ والجيرانُ المتعدّدون', () => {
  it('٤٣ · ⚠️ التصديرُ ليس تسليمًا — والإقرارُ وحدَه يُثبِت (بند ٦٨)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part1, { text: 'شيءٌ يُرسَل' }));

    const { peers, acknowledgePackage } = await import('../js/services/sync/sync-service.js');
    activate(TABLET);
    const pkg = await createPackageFor(`DEV_${MOBILE.toUpperCase()}`);

    activate(TABLET);
    let peer = (await peers()).find((p) => p.id === `DEV_${MOBILE.toUpperCase()}`);
    const packaged = Object.values(peer.packagedVector || {}).reduce((s, n) => s + n, 0);
    const acked = Object.values(peer.ackedVector || {}).reduce((s, n) => s + n, 0);
    expect(packaged > 0).toBe(true);
    /* ⚠️ **ولم يصل شيءٌ بعد** — حزمةٌ بُنيت وقد تضيع في الطريق. */
    expect(acked).toBe(0);

    /* ⚠️ ولا تُمسَح علامةُ `dirty` بمجرّد البناء (اختبارٌ سلبيّ). */
    const dirtyRows = (await rowsOn(TABLET, 'scripts')).filter((r) => r.dirty === 1);
    expect(dirtyRows.length > 0).toBe(true);

    activate(TABLET);
    await acknowledgePackage(`DEV_${MOBILE.toUpperCase()}`, pkg.packageId);
    activate(TABLET);
    peer = (await peers()).find((p) => p.id === `DEV_${MOBILE.toUpperCase()}`);
    expect(Object.values(peer.ackedVector).reduce((s, n) => s + n, 0) > 0).toBe(true);
  });

  it('٤٤ · وإقرارٌ لحزمةٍ أخرى يُرفَض بالاسم', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part1, { text: 'x' }));
    activate(TABLET);
    await createPackageFor(`DEV_${MOBILE.toUpperCase()}`);
    const { acknowledgePackage } = await import('../js/services/sync/sync-service.js');
    activate(TABLET);
    await expect(acknowledgePackage(`DEV_${MOBILE.toUpperCase()}`, 'PKG_مزيَّف')).toReject('حزمةٍ أخرى');
  });

  it('٤٥ · ثلاثةُ أجهزة: ما يكتبه اللابتوب يصل الموبايلَ عبر التابلت (بند ٦٩)', async () => {
    await resetDevices();
    const base = await on(TABLET, buildBase);
    await cloneDevice(TABLET, MOBILE);
    await cloneDevice(TABLET, LAPTOP);
    await pair(TABLET, MOBILE);
    await pair(TABLET, LAPTOP);

    await on(LAPTOP, () => updateScript(base.part1, { text: 'كتبه اللابتوب' }));

    /* اللابتوب ← التابلت */
    const first = await sendTo(LAPTOP, TABLET);
    expect(first.ok).toBe(true);
    expect(await textOf(TABLET, base.part1)).toBe('كتبه اللابتوب');

    /* التابلت ← الموبايل: والتغييرُ يبقى منسوبًا للابتوب */
    const pkg = await packageFrom(TABLET, MOBILE);
    const forwarded = pkg.changes.find((c) => c.recordId === base.part1);
    expect(Boolean(forwarded)).toBe(true);
    expect(forwarded.originDevice).toBe('DEV_LAPTOP');

    const second = await sendTo(TABLET, MOBILE);
    expect(second.ok).toBe(true);
    expect(await textOf(MOBILE, base.part1)).toBe('كتبه اللابتوب');
  });

  it('٤٦ · وجهازٌ فارغٌ يُبذَر بحزمةِ خطِّ أساسٍ كاملة (بند ٨٦ حالة أ)', async () => {
    await resetDevices();
    const base = await on(TABLET, buildBase);
    /* الموبايلُ لم يُستنسَخ — قاعدةٌ فارغةٌ تمامًا. */
    await on(MOBILE, async () => {});
    expect(await rowsOn(MOBILE, 'scripts')).toHaveLength(0);

    const outcome = await sendTo(TABLET, MOBILE);
    expect(outcome.ok).toBe(true);
    expect(outcome.plan.conflicts).toHaveLength(0);
    expect(Boolean(await rowOn(MOBILE, 'scripts', base.mainId))).toBe(true);
    expect(Boolean(await rowOn(MOBILE, 'scripts', base.part2))).toBe(true);
    expect((await edgesOn(MOBILE, PART_OF)).length >= 3).toBe(true);
  });

  it('٤٧ · وجهازان بتاريخين مستقلّين يلتقيان بمصالحةٍ كاملة (بند ٨٦ حالة ب)', async () => {
    await resetDevices();
    const t = await on(TABLET, buildBase);
    const m = await on(MOBILE, buildBase);
    /* ⚠️ لا استنساخَ ولا اقتران — كلٌّ بنى عالمَه وحدَه. */
    expect(t.mainId === m.mainId).toBe(false);

    const a = await sendTo(TABLET, MOBILE);
    const b = await sendTo(MOBILE, TABLET);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    for (const device of [TABLET, MOBILE]) {
      expect(Boolean(await rowOn(device, 'scripts', t.mainId))).toBe(true);
      expect(Boolean(await rowOn(device, 'scripts', m.mainId))).toBe(true);
    }
    expect(describeDiff(diffLogical(await snapshot(TABLET), await snapshot(MOBILE))))
      .toBe('الحالتان متطابقتان منطقيًّا');
  });
});

describe('WS-G · اللغةُ والذاكرة', () => {
  it('٤٨ · تصحيحاتُ النبر بياناتُ لغةٍ تُزامَن (بند ٧٩)', async () => {
    await twoDevices();
    await on(TABLET, () => settings.set('shadow.stressDictionary', { вскрыть: 'вскры́ть' }));
    const outcome = await sendTo(TABLET, MOBILE);
    expect(outcome.ok).toBe(true);
    activate(MOBILE);
    expect(await settings.get('shadow.stressDictionary')).toEqual({ вскрыть: 'вскры́ть' });
  });

  it('٤٩ · ⚠️ وتصحيحان مختلفان لنفس القاموس تعارضٌ يُعرَض (بند ٧٩)', async () => {
    await twoDevices();
    await on(TABLET, () => settings.set('shadow.stressDictionary', { звонить: 'звони́ть' }));
    await on(MOBILE, () => settings.set('shadow.stressDictionary', { звонить: 'зво́нить' }));
    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].store).toBe('settings');
    expect(plan.conflicts[0].recordId).toBe('shadow.stressDictionary');
    expect(applicable(plan)).toBe(false);
  });

  it('٥٠ · ⚠️ ولا يعبر «أين كنت» ولا مقاسُ الشاشة (بند ٧٧)', async () => {
    await twoDevices();
    await on(TABLET, async () => {
      await settings.set('shadow.split', 0.73);
      await settings.set('ui.lastRoute', '/workspace/SCR_X');
      await settings.set('shadow.reference.doc', 'MED_محلّيّ');
    });
    const pkg = await packageFrom(TABLET, MOBILE);
    expect(pkg.changes.filter((c) => c.store === 'settings')).toHaveLength(0);

    await sendTo(TABLET, MOBILE);
    activate(MOBILE);
    expect(await settings.get('shadow.split')).toBe(null);
    expect(await settings.get('ui.lastRoute')).toBe(null);
    expect(await settings.get('shadow.reference.doc')).toBe(null);
  });

  it('٥١ · وسمُ السياق على الظهور ينجو بعد إعادة بناء الفهرس (بند ٨٠)', async () => {
    const { indexSource } = await import('../js/services/memory/indexer.js');
    const { addContext, userContextIds } = await import('../js/services/memory/context.js');
    const { rebuildIndex } = await import('../js/services/memory/indexer.js');

    await resetDevices();
    const base = await on(TABLET, async () => {
      const b = await buildBase();
      await updateScript(b.part1, { text: 'Упаковка защитная' });
      return b;
    });
    await cloneDevice(TABLET, MOBILE);
    await pair(TABLET, MOBILE);

    const occurrenceId = await on(TABLET, async () => {
      await indexSource({ kind: 'script', id: base.part1, title: 'ج١', text: 'Упаковка защитная' });
      const rows = await rowsOn(TABLET, 'memoryOccurrences');
      return rows[0]?.id ?? null;
    });
    expect(Boolean(occurrenceId)).toBe(true);

    await on(TABLET, () => addContext(occurrenceId, 'TAG_شغل'));
    await on(MOBILE, () => scenes.create({ titleAr: 'محتوًى غيرُ ذي صلة', date: '2026-07-01' }));

    const outcome = await sendTo(TABLET, MOBILE);
    expect(outcome.ok).toBe(true);

    /*
     * ⚠️ **والفهرسُ لم يعبر — أُعيد بناؤه.** وهذا هو الاختبارُ الحقيقيّ:
     *    معرِّفُ الظهور **بصمةٌ حتميّةٌ من المحتوى**، فيحسبه الموبايلُ
     *    بنفسه فيصيب نفسَ المعرِّف — فتجد ملاحظتُك موضعَها.
     */
    activate(MOBILE);
    await rebuildIndex();
    const stillThere = await on(MOBILE, () => userContextIds(occurrenceId));
    expect(stillThere).toEqual(['TAG_شغل']);
    /* ولا صفَّ فهرسٍ واحدٌ عبر في الحزمة. */
    expect(outcome.pkg.changes.filter((c) => c.store === 'memoryOccurrences')).toHaveLength(0);
  });

  it('٥٢ · ⚠️ والنقلُ لا يرفع سلطةَ الذكاء الاصطناعيّ فوق ما كتبتَه (بند ٤٣)', async () => {
    const { ORIGIN } = await import('../js/services/memory/identity.js');
    await twoDevices();
    const id = await on(TABLET, async () => {
      const row = await mistakeComparisons.create({
        wrong: 'a', natural: 'b', explanationAr: 'شرحٌ كتبتُه بيدي', origin: ORIGIN.USER,
      });
      return row.id;
    });
    await cloneDevice(TABLET, MOBILE);
    await pair(TABLET, MOBILE);

    await on(MOBILE, () => mistakeComparisons.update(id, {
      explanationAr: 'شرحٌ من تحليلٍ خارجيّ', origin: ORIGIN.AI_IMPORT,
    }));
    await on(TABLET, () => mistakeComparisons.update(id, { explanationAr: 'شرحي بعد التنقيح' }));

    const plan = await planOn(TABLET, await packageFrom(MOBILE, TABLET));
    /*
     * ⚠️ **ولا يغلب أحدُهما آليًّا.** النقلُ لا يملك سلطةً على البيانات:
     *    فحين يختلف الشرحان يُعرَض الاثنان ويُسأل صاحبُهما — ولا يُقال
     *    «الأحدثُ» فيكتب استيرادٌ خارجيٌّ فوق ما كتبتَه بيدك.
     */
    const conflict = plan.conflicts.find((c) => c.field === 'explanationAr');
    expect(Boolean(conflict)).toBe(true);
    expect(conflict.local.value).toBe('شرحي بعد التنقيح');
    expect(conflict.remote.value).toBe('شرحٌ من تحليلٍ خارجيّ');
    expect(applicable(plan)).toBe(false);
  });
});

describe('WS-G · الحدودُ الصلبة', () => {
  it('٥٣ · ⚠️ ولا نداءَ شبكةٍ في أيّ وحدةٍ من وحدات المزامنة (بند ٩١)', async () => {
    const files = [
      'device', 'change-log', 'sync-policy', 'sync-package',
      'merge-planner', 'merge-apply', 'conflicts', 'logical-state', 'sync-service',
    ];
    const banned = [
      'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator.sendBeacon',
      'googleapis', 'firebase', 'supabase', 'oauth', 'accessToken', 'apiKey',
    ];
    for (const name of files) {
      const source = await (await fetch(`/js/services/sync/${name}.js`)).text();
      for (const needle of banned) {
        if (source.includes(needle)) {
          throw new Error(`«${needle}» موجودةٌ في ${name}.js — والمزامنةُ محايدةُ النقل (بند ٩١)`);
        }
      }
    }
  });

  it('٥٤ · والنسخةُ الاحتياطيّةُ لا تحمل سجلَّ جهازٍ آخر (بند ٤٧)', async () => {
    const { BACKUP_STORES } = await import('../js/services/backup/serialize.js');
    expect(BACKUP_STORES.includes('changeLog')).toBe(false);
    expect(BACKUP_STORES.includes('syncPeers')).toBe(false);
    /* وما كان يُنسَخ ما زال يُنسَخ. */
    for (const store of ['scenes', 'scripts', 'media', 'relationships', 'savedItems']) {
      expect(BACKUP_STORES.includes(store)).toBe(true);
    }
  });

  it('٥٥ · وفشلُ التحقّق لا يترك القاعدةَ النشطة نصفَ مدموجة (بندا ١٧ و٤٩)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part1, { text: 'تعديلٌ سليم' }));
    const plan = await planOn(MOBILE, await packageFrom(TABLET, MOBILE));

    /*
     * ⚠️ **نكسر الخطّةَ عمدًا**: حافّةٌ تجعل عقدةً أبًا لنفسها. والفحصُ
     *    بعد الدمج يجب أن يمسكها **قبل** أن يتحرّك المؤشّر.
     */
    plan.relationshipAdds.push({
      recordId: 'REL_مكسورة',
      record: {
        id: 'REL_مكسورة', fromId: base.part1, toId: base.part1, kind: PART_OF,
        order: 1, note: '', state: STATE.ACTIVE, createdAt: 1, updatedAt: 1, rev: 1, dirty: 1,
      },
      edge: 'x',
    });

    const before = await snapshot(MOBILE);
    await expect(applyOn(MOBILE, plan)).toReject('مش سليمة');
    const after = await snapshot(MOBILE);
    expect(describeDiff(diffLogical(before, after))).toBe('الحالتان متطابقتان منطقيًّا');
    expect(await textOf(MOBILE, base.part1)).toBe('نصُّ الجزء الأوّل');
  });

  it('٥٦ · وحزمةٌ من إصدارٍ غيرِ مدعومٍ لا تُطبَّق جزئيًّا (بند ٧٠)', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part1, { text: 'لن يصل' }));
    const pkg = await packageFrom(TABLET, MOBILE);
    const poisoned = { ...pkg, version: 99 };

    const plan = await planOn(MOBILE, poisoned);
    expect(plan.ok).toBe(false);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    await expect(applyOn(MOBILE, plan)).toReject('غيرُ صالحة');
    expect(await textOf(MOBILE, base.part1)).toBe('نصُّ الجزء الأوّل');
  });

  it('٥٧ · والحزمةُ لا تحمل بايتاتٍ ولو صورةً واحدة (بندا ٧٥ و٧٦)', async () => {
    await resetDevices();
    await on(TABLET, async () => {
      const bytes = new Uint8Array(4096).fill(7);
      await media.create({
        kind: 'image', mime: 'image/png', bytes: 4096, filename: 'كبيرة.png',
        blob: new Blob([bytes], { type: 'image/png' }),
        thumbBlob: new Blob([bytes.slice(0, 64)], { type: 'image/webp' }),
      });
    });
    await on(MOBILE, async () => {});

    const pkg = await packageFrom(TABLET, MOBILE);
    const change = pkg.changes.find((c) => c.store === 'media');
    expect('blob' in change.record).toBe(false);
    expect('thumbBlob' in change.record).toBe(false);
    /* والبيانُ يصف: حجمٌ ونوعٌ ودورٌ — بلا بايتة. */
    expect(pkg.blobManifest.length >= 2).toBe(true);
    expect(pkg.blobManifest.some((b) => b.role === 'thumbnail')).toBe(true);
    /* وحجمُ الحزمة نصًّا يبقى بالكيلوبايتات لا بالميجابايتات. */
    expect(JSON.stringify(pkg).length < 4096).toBe(true);
  });

  it('٥٨ · ⚠️ ولا تُقبَل حزمةٌ من هذا الجهاز نفسِه عائدةً إليه', async () => {
    const base = await twoDevices();
    await on(TABLET, () => updateScript(base.part1, { text: 'من التابلت' }));
    const pkg = await packageFrom(TABLET, MOBILE);
    /* نُعيدها إلى مؤلِّفها. */
    const plan = await planOn(TABLET, pkg);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.noops.length >= 1).toBe(true);
  });
});

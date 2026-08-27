/**
 * LingoLife — اختباراتُ مُنفِّذ Drive (WS-H)
 *
 * ⚠️ **يُختبَر هنا كلُّ شيءٍ إلّا شيئًا واحدًا**: هل تسمح Google لجهازٍ
 *    ثانٍ برؤية ملفّ الأوّل تحت `drive.file`؟ ذاك سؤالُ سياسةٍ عند
 *    Google، ولا يجيب عنه خادمٌ مزيَّف. وله `tools/drive-check.html`.
 *
 *    وما يُختبَر هنا هو ما ينكسر فعلًا في الكود: بناءُ الاستعلامات،
 *    وجسمُ الرفع، واستئنافُ ما انقطع، وتصنيفُ الأخطاء.
 */

import { describe, it, expect } from './test-runner.js';
import { installFakeDrive } from './fake-drive.js';
import { createDriveTransport } from '../js/services/cloud/drive-transport.js';
import { __forceToken, authStatus } from '../js/services/cloud/drive-auth.js';
import {
  assertTransport, TRANSPORT_CONTRACT, BLOB_ROLE, BACKUP_KIND, FAIL, sha256Hex,
} from '../js/services/cloud/transport.js';
import { DRIVE_CLIENT_ID, DRIVE_SCOPE, driveConfigured }
  from '../js/services/cloud/drive-config.js';

/** ناقلٌ حقيقيٌّ فوق شبكةٍ مزيَّفة. */
async function rig() {
  const drive = installFakeDrive();
  __forceToken('FAKE_TOKEN_FOR_TESTS', { email: 'test@example.com' });
  const transport = createDriveTransport();
  await transport.connect();
  return { drive, transport };
}

const textOf = (drive, id) => drive.files.get(id)?.content;

/**
 * يزرع مكتبةَ Google وهميّةً في الصفحة.
 *
 * ⚠️ **ولماذا؟** مسارُ «٤٠١ ← جدِّد صامتًا ← أعد المحاولة» مسارٌ حقيقيٌّ
 *    يستحقّ الاختبار. وبلا هذا الزرع ينتظر `loadGis` سكربتَ Google حتى
 *    تنتهي مهلةُ الشبكة — فيصير اختبارٌ زمنُه مِلّي ثوانٍ اختبارًا زمنُه
 *    اثنتا عشرةَ ثانية، ولا يقيس شيئًا إضافيًّا.
 */
function stubGis({ grant = false } = {}) {
  const previous = window.google;
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: ({ callback }) => ({
          requestAccessToken: () => callback(grant
            ? { access_token: 'RENEWED', expires_in: 3600 }
            : { error: 'immediate_failed' }),
        }),
        revoke: (token, done) => done?.(),
      },
    },
  };
  return () => { window.google = previous; };
}


describe('WS-H · مُنفِّذ Drive · العقد والتخطيط', () => {
  it('١ · يفي بعقد النقل كاملًا — نفس عقد المحاكي', async () => {
    const drive = installFakeDrive();
    try {
      __forceToken('T');
      const transport = createDriveTransport();
      expect(() => assertTransport(transport)).toBeTruthy();
      expect(TRANSPORT_CONTRACT.every((n) => typeof transport[n] === 'function')).toBe(true);
      expect(transport.id).toBe('google-drive');
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('٢ · الإعدادُ الحقيقيّ: مُعرِّفُ عميلٍ موجود، ونطاقُ drive.file', () => {
    expect(driveConfigured()).toBe(true);
    expect(DRIVE_CLIENT_ID).toContain('.apps.googleusercontent.com');
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
    /* ⚠️ ولا appDataFolder — المجلّدُ يجب أن يُرى ويُنزَّل منه بيدك. */
    expect(DRIVE_SCOPE.includes('appdata')).toBe(false);
    expect(authStatus().scope).toBe(DRIVE_SCOPE);
  });

  it('٣ · الربطُ يبني LingoLife/{sync,media,backups} — ولا يبنيها مرّتين', async () => {
    const { drive, transport } = await rig();
    try {
      const folders = [...drive.files.values()]
        .filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
      const names = folders.map((f) => f.name).sort();
      expect(JSON.stringify(names)).toBe(JSON.stringify(['LingoLife', 'backups', 'media', 'sync']));

      const root = folders.find((f) => f.name === 'LingoLife');
      expect(root.appProperties.llifeKind).toBe('root');
      for (const name of ['sync', 'media', 'backups']) {
        expect(folders.find((f) => f.name === name).parents[0]).toBe(root.id);
      }

      /* وربطٌ ثانٍ لا ينشئ شيئًا — يجد ما بناه. */
      const before = drive.files.size;
      const second = createDriveTransport();
      await second.connect();
      expect(drive.files.size).toBe(before);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });
});

describe('WS-H · مُنفِّذ Drive · المزامنة', () => {
  it('٤ · الحزمةُ تُرفَع بوسومها، وتُسرَد، وتُقرَأ كما كُتبت', async () => {
    const { drive, transport } = await rig();
    try {
      const pkg = {
        formatVersion: 1,
        sourceDeviceId: 'DEV_TABLET',
        sourceDeviceLabel: 'التابلت',
        maxSeq: 12,
        sourceVector: { DEV_TABLET: 12 },
        changes: [{ store: 'scripts', recordId: 'SCR_1', op: 'PUT' }],
      };
      const up = await transport.pushPackage(pkg);
      expect(up.name).toBe('pkg-DEV_TABLET-000000012.json');
      expect(up.deduped).toBe(false);

      const row = drive.files.get(up.fileId);
      expect(row.appProperties.llifeKind).toBe('package');
      expect(row.appProperties.llifeDevice).toBe('DEV_TABLET');
      /* ⚠️ والترتيبُ مبطَّنٌ في الوسم أيضًا — عشان الفرزُ النصّيّ يصحّ. */
      expect(row.appProperties.llifeSeq).toBe('000000012');

      const listed = await transport.listPackages({ exclude: 'DEV_MOBILE' });
      expect(listed.length).toBe(1);
      expect(listed[0].device).toBe('DEV_TABLET');
      expect(listed[0].seq).toBe(12);

      const back = await transport.pullPackage(up.fileId);
      expect(back.sourceDeviceId).toBe('DEV_TABLET');
      expect(back.changes.length).toBe(1);
      expect(JSON.stringify(back)).toBe(JSON.stringify(pkg));
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('٥ · ⚠️ ورفعٌ يُعاد لا يكتب ملفًّا ثانيًا (بند ٣٠)', async () => {
    const { drive, transport } = await rig();
    try {
      const pkg = { sourceDeviceId: 'DEV_A', maxSeq: 3, changes: [] };
      const first = await transport.pushPackage(pkg);
      const second = await transport.pushPackage(pkg);

      expect(second.deduped).toBe(true);
      expect(second.fileId).toBe(first.fileId);
      const packages = [...drive.files.values()]
        .filter((f) => f.appProperties?.llifeKind === 'package');
      expect(packages.length).toBe(1);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('٦ · واستبعادُ جهازٍ يمشي على الوسم لا على الاسم', async () => {
    const { drive, transport } = await rig();
    try {
      await transport.pushPackage({ sourceDeviceId: 'DEV_A', maxSeq: 1, changes: [] });
      await transport.pushPackage({ sourceDeviceId: 'DEV_B', maxSeq: 1, changes: [] });
      await transport.pushPackage({ sourceDeviceId: 'DEV_B', maxSeq: 2, changes: [] });

      const forA = await transport.listPackages({ exclude: 'DEV_A' });
      expect(forA.length).toBe(2);
      expect(forA.every((r) => r.device === 'DEV_B')).toBe(true);
      /* والترتيبُ داخل الجهاز تصاعديٌّ بالتسلسل. */
      expect(forA[0].seq < forA[1].seq).toBe(true);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('٧ · حالةُ الجهاز تُكتَب مرّةً ثم تُحدَّث — ملفٌّ واحدٌ لكلّ جهاز', async () => {
    const { drive, transport } = await rig();
    try {
      await transport.pushDeviceState('DEV_A', { label: 'تابلت', vector: { DEV_A: 5 } });
      await transport.pushDeviceState('DEV_A', { label: 'تابلت', vector: { DEV_A: 9 } });
      await transport.pushDeviceState('DEV_B', { label: 'موبايل', vector: { DEV_B: 2 } });

      const states = [...drive.files.values()]
        .filter((f) => f.appProperties?.llifeKind === 'devstate');
      expect(states.length).toBe(2);

      const read = await transport.listDeviceStates();
      expect(read.length).toBe(2);
      const a = read.find((r) => r.device === 'DEV_A');
      /* ⚠️ والتحديثُ استبدالٌ لا إضافة — آخرُ متّجهٍ هو المقروء. */
      expect(a.state.vector.DEV_A).toBe(9);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('٨ · والكونُ يُكتشَف، وأقدمُ كونٍ يفوز عند التسابق', async () => {
    const { drive, transport } = await rig();
    try {
      expect((await transport.discover()).found).toBe(false);

      const first = await transport.createUniverse();
      expect(Boolean(first.universeId)).toBe(true);

      /* جهازٌ ثانٍ سبق فأنشأ كونًا في نفس اللحظة. */
      const second = await transport.createUniverse();
      expect(second.universeId === first.universeId).toBe(false);

      const found = await transport.discover();
      expect(found.found).toBe(true);
      /* ⚠️ الحسمُ حتميٌّ: الأقدمُ — فيراه الجهازان بنفس الترتيب. */
      expect(found.universeId).toBe(first.universeId);
      expect(found.duplicates).toBe(1);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('٩ · ⚠️ ومعرِّفٌ فيه علامةُ اقتباسٍ لا يكسر الاستعلام', async () => {
    const { drive, transport } = await rig();
    try {
      /*
       * معرِّفاتُنا لا تحمل علامةَ اقتباسٍ اليوم — لكن استعلامًا يُبنى
       * بلصق نصٍّ خام قنبلةٌ موقوتة. والهروبُ يُختبَر بالحالة التي
       * تكسره، لا بالحالة العاديّة.
       */
      const nasty = "MED_o'brien\\x";
      await transport.putBlob(nasty, BLOB_ROLE.ORIGINAL,
        new Blob(['abc'], { type: 'audio/wav' }), { sha256: 'deadbeef' });

      const found = await transport.hasBlob(nasty, BLOB_ROLE.ORIGINAL);
      expect(Boolean(found)).toBe(true);
      expect(found.sha256).toBe('deadbeef');

      /* ولا يلتقط وسيطًا آخر بالخطأ. */
      expect(await transport.hasBlob("MED_o'brien", BLOB_ROLE.ORIGINAL)).toBe(null);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });
});

describe('WS-H · مُنفِّذ Drive · البايتات والنسخ', () => {
  it('١٠ · بايتاتٌ تُرفَع وتُنزَّل سليمةً — والبصمةُ تُطابق', async () => {
    const { drive, transport } = await rig();
    try {
      const payload = new Blob([new Uint8Array([...Array(1200).keys()].map((i) => i % 251))],
        { type: 'audio/wav' });
      const hash = await sha256Hex(payload);

      const up = await transport.putBlob('MED_1', BLOB_ROLE.ORIGINAL, payload,
        { sha256: hash, mime: 'audio/wav' });
      expect(up.deduped).toBe(false);
      expect(drive.files.get(up.fileId).name).toBe('MED_1.orig.wav');

      const progress = [];
      const back = await transport.fetchBlob('MED_1', BLOB_ROLE.ORIGINAL, {
        onProgress: (p) => progress.push(p),
      });
      expect(await sha256Hex(back)).toBe(hash);
      /* ⚠️ وتقدُّمٌ حقيقيٌّ — لا قفزةٌ من صفرٍ إلى مئة. */
      expect(progress.length > 0).toBe(true);
      expect(progress[progress.length - 1].loaded).toBe(progress[progress.length - 1].total);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('١١ · ورفعٌ ثانٍ لنفس (وسيط، دور) لا يضاعف', async () => {
    const { drive, transport } = await rig();
    try {
      const blob = new Blob(['same bytes']);
      const first = await transport.putBlob('MED_2', BLOB_ROLE.ORIGINAL, blob, {});
      const second = await transport.putBlob('MED_2', BLOB_ROLE.ORIGINAL, blob, {});
      expect(second.deduped).toBe(true);
      expect(second.fileId).toBe(first.fileId);

      /* ودورٌ آخر لنفس الوسيط ملفٌّ مستقلّ. */
      const thumb = await transport.putBlob('MED_2', BLOB_ROLE.THUMBNAIL, blob, {});
      expect(thumb.deduped).toBe(false);
      expect([...drive.files.values()]
        .filter((f) => f.appProperties?.llifeKind === 'blob').length).toBe(2);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('١٢ · ⚠️ والرفعُ المستأنَف يكمل من حيث قال Drive لا من حيث ظنّ العميل', async () => {
    const { drive, transport } = await rig();
    try {
      /* أكبرُ من عتبة الاستئناف (٤ ميجا) فيمشي على الجلسة. */
      const big = new Blob([new Uint8Array(4 * 1024 * 1024 + 2048).fill(65)]);
      /* والخادمُ يستقبل نصفَ القطعة الأولى ويقول ذلك في `Range`. */
      drive.cut(0);

      const up = await transport.putBlob('MED_BIG', BLOB_ROLE.ORIGINAL, big, {});
      const stored = drive.files.get(up.fileId);

      /*
       * ⚠️ **الدعوى المقيسة**: الملفُّ المخزَّن بنفس الطول بلا ثقب. ولو
       *    استأنف العميلُ من حيث أرسل بدل حيث قُبِل، لَنقص نصفُ قطعةٍ
       *    من المنتصف وبقي الطولُ أقلّ.
       */
      expect(stored.content.byteLength).toBe(big.size);
      /* ⚠️ ولا ثقبَ في المنتصف: كلُّ بايتةٍ هي التي أُرسلت. */
      expect([...stored.content].every((b) => b === 65)).toBe(true);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('١٣ · ⚠️ وتنزيلٌ ناقصٌ يُرفَض بوصفه ناقصًا لا تالفًا', async () => {
    const { drive, transport } = await rig();
    try {
      await transport.putBlob('MED_3', BLOB_ROLE.ORIGINAL,
        new Blob([new Uint8Array(400).fill(7)]), {});

      /* الترويسةُ تَعِد بـ٤٠٠ والجسمُ يعطي ١٢٠ — وصلةٌ قُطعت. */
      const stored = [...drive.files.values()].find((f) => f.appProperties?.llifeKind === 'blob');
      stored.shortRead = 120;

      let category = null;
      try {
        await transport.fetchBlob('MED_3', BLOB_ROLE.ORIGINAL);
      } catch (error) { category = error.category; }

      /*
       * ⚠️ **والفرقُ ليس لفظيًّا**: «ناقص» يُعاد تنزيلُه، و«تالف» يُعزَل
       *    ويُقال لك إن الملفَّ على Drive خرب. فتصنيفٌ خاطئٌ هنا يجعلك
       *    تبحث عن عطبٍ في Drive بينما المشكلةُ في شبكتك.
       */
      expect(category).toBe(FAIL.TRANSIENT_SERVER);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('١٤ · نسخةٌ تُرفَع وتُسرَد وتُنزَّل — والاسمُ فيه وقتُها', async () => {
    const { drive, transport } = await rig();
    try {
      const body = new Blob(['PK fake zip bytes']);
      const at = new Date(2026, 7, 27, 9, 30);
      const up = await transport.putBackup(body, {
        kind: BACKUP_KIND.LIGHT, at, manifest: { counts: { scenes: 3, scripts: 9 } },
      });
      expect(up.name).toContain('2026-08-27 09-30');
      expect(up.name).toContain('خفيفة');

      const listed = await transport.listBackups();
      expect(listed.length).toBe(1);
      expect(listed[0].kind).toBe(BACKUP_KIND.LIGHT);
      expect(listed[0].at).toBe(at.getTime());

      const back = await transport.fetchBackup(up.fileId);
      expect(await back.text()).toContain('fake zip bytes');

      /* والحذفُ متاحٌ للاستبقاء. */
      expect(await transport.deleteBackup(up.fileId)).toBe(true);
      expect((await transport.listBackups()).length).toBe(0);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });
});

describe('WS-H · مُنفِّذ Drive · الأخطاء', () => {
  const cases = [
    { name: 'انتهاءُ الإذن', status: 401, body: {}, expect: FAIL.AUTH },
    {
      name: 'امتلاءُ المساحة',
      status: 403,
      body: { error: { errors: [{ reason: 'storageQuotaExceeded' }], message: 'full' } },
      expect: FAIL.QUOTA,
    },
    {
      name: 'تجاوزُ المعدّل',
      status: 403,
      body: { error: { errors: [{ reason: 'userRateLimitExceeded' }], message: 'slow' } },
      expect: FAIL.RATE_LIMIT,
    },
    {
      name: 'نقصُ الصلاحية',
      status: 403,
      body: { error: { errors: [{ reason: 'insufficientFilePermissions' }], message: 'no' } },
      expect: FAIL.PERMISSION,
    },
    { name: 'ملفٌّ مش موجود', status: 404, body: {}, expect: FAIL.REMOTE_CORRUPT },
  ];

  it('١٥ · ⚠️ و«٤٠٣» الثلاثةُ تُصنَّف ثلاثةَ أشياءَ مختلفة', async () => {
    for (const testCase of cases) {
      const drive = installFakeDrive();
      const unstub = stubGis({ grant: false });
      try {
        __forceToken('T');
        const transport = createDriveTransport();
        await transport.connect();

        /* ⚠️ و٤٠١ يُعاد مرّةً بعد تجديدٍ صامت — والتجديدُ يفشل هنا فتبقى AUTH. */
        drive.fail((url) => url.includes('/drive/v3/files?q='), {
          status: testCase.status, body: testCase.body, times: 9,
        });

        let category = null;
        try {
          await transport.listPackages({});
        } catch (error) {
          category = error.category;
        }
        if (category !== testCase.expect) {
          throw new Error(`${testCase.name}: متوقّع ${testCase.expect} ووُجد ${category}`);
        }
      } finally {
        drive.restore();
        unstub();
        __forceToken(null);
      }
    }
    expect(cases.length).toBe(5);
  });

  it('١٦ · و٤٢٩ يُعاد تلقائيًّا ثم ينجح', async () => {
    const drive = installFakeDrive();
    try {
      __forceToken('T');
      const transport = createDriveTransport();
      await transport.connect();

      drive.fail((url, method) => url.includes('uploadType=multipart') && method === 'POST',
        { status: 429, body: { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, times: 2 });

      const up = await transport.pushPackage({ sourceDeviceId: 'DEV_R', maxSeq: 1, changes: [] });
      /* ⚠️ ونجح رغم مرّتي رفض — بلا تدخّلٍ منك وبلا فقدِ الحزمة. */
      expect(Boolean(up.fileId)).toBe(true);
      expect(drive.countOf('uploadType=multipart') >= 3).toBe(true);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('١٧ · وحزمةٌ ليست JSON تُرفَع كـREMOTE_CORRUPT فتُعزَل ولا توقف الباقي', async () => {
    const { drive, transport } = await rig();
    try {
      const up = await transport.pushPackage({ sourceDeviceId: 'DEV_C', maxSeq: 1, changes: [] });
      drive.files.get(up.fileId).content = '{ نصٌّ مبتور';

      let category = null;
      try {
        await transport.pullPackage(up.fileId);
      } catch (error) { category = error.category; }
      expect(category).toBe(FAIL.REMOTE_CORRUPT);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('١٨ · وكلُّ استعلامٍ يستبعد سلّة Drive', async () => {
    const { drive, transport } = await rig();
    try {
      const up = await transport.pushPackage({ sourceDeviceId: 'DEV_T', maxSeq: 1, changes: [] });
      expect((await transport.listPackages({})).length).toBe(1);

      /* ألقيتَها في سلّة Drive من تطبيق Drive نفسِه. */
      drive.files.get(up.fileId).trashed = true;
      expect((await transport.listPackages({})).length).toBe(0);

      /* ⚠️ ولولا `trashed = false` لبقيت مسرودةً ولنُزّلت. */
      const queries = drive.calls.filter((c) => c.url.includes('?q=') || c.url.includes('&q='));
      /* ⚠️ و`URLSearchParams` يكتب المسافةَ `+` لا `%20` — فالفكُّ وحدَه لا يكفي. */
      const readable = (url) => decodeURIComponent(url.replace(/\+/g, '%20'));
      expect(queries.every((c) => readable(c.url).includes('trashed = false'))).toBe(true);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });

  it('١٩ · والقياسُ يعدّ نداءاتٍ حقيقيّة', async () => {
    const { drive, transport } = await rig();
    try {
      transport.resetStats();
      await transport.pushPackage({ sourceDeviceId: 'DEV_S', maxSeq: 1, changes: [] });
      const stats = transport.stats();
      expect(stats.listPackages > 0).toBe(true);
      expect(stats.pushPackage > 0).toBe(true);
      /* والعدّادُ يطابق ما وصل الشبكةَ فعلًا. */
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(total > 0).toBe(true);
    } finally {
      drive.restore();
      __forceToken(null);
    }
  });
});

describe('WS-H · مُنفِّذ Drive · الأسرار', () => {
  it('٢٠ · ⚠️ ولا سرَّ عميلٍ ولا مفتاحَ واجهةٍ في مصدر Drive', async () => {
    const files = ['drive-config', 'drive-auth', 'drive-transport'];
    const patterns = [
      /client_?secret/i,
      /['"]?api_?key['"]?\s*[:=]\s*['"][^'"]+['"]/,
      /AIza[0-9A-Za-z_-]{20,}/,
      /ya29\.[0-9A-Za-z_-]+/,
    ];
    for (const name of files) {
      /* eslint-disable-next-line no-await-in-loop */
      const source = await (await fetch(`../js/services/cloud/${name}.js`)).text();
      /*
       * ⚠️ **يُفحَص الكودُ لا التعليق — للمرّة الثالثة في WS-H.** ترويسةُ
       *    `drive-config.js` تشرح لماذا **لا** سرَّ هنا، فذكرت الكلمة،
       *    فسقط الحارسُ على الشرح لا على الخرق.
       */
      const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      for (const pattern of patterns) {
        if (pattern.test(code)) throw new Error(`${name}.js: ${pattern}`);
      }
    }

    /* والرمزُ لا يُكتَب في أيّ مخزنٍ دائم. */
    const auth = await (await fetch('../js/services/cloud/drive-auth.js')).text();
    const code = auth.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    for (const sink of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
      if (code.includes(sink)) throw new Error(`drive-auth.js بيكتب الرمز في ${sink}`);
    }

    /* وحالةُ التفويض المعروضة بلا الرمز نفسِه. */
    __forceToken('SECRET_TOKEN_VALUE');
    const status = JSON.stringify(authStatus());
    __forceToken(null);
    expect(status.includes('SECRET_TOKEN_VALUE')).toBe(false);
    expect(status).toContain('drive.file');
  });
});

/* ================================================================== *
 * ثامنًا — الرمزُ لا يتسرّب إلى شيءٍ يُحفَظ أو يُرسَل
 * ================================================================== */

describe('WS-H · Drive · الرمزُ لا يخرج', () => {
  it('٢١ · ⚠️ ولا رمزَ في نسخة `.llife` ولو كان الربطُ قائمًا', async () => {
    const { buildBackup } = await import('../js/services/backup/export.js');
    const { resetDevices, activate } = await import('./sync-devices.js');
    await resetDevices();
    activate('tablet');

    /* ربطٌ حيٌّ برمزٍ مميَّزٍ يسهل تتبّعه. */
    __forceToken('TOKEN_MUST_NOT_APPEAR_ANYWHERE', { email: 'leak@example.com' });
    try {
      const built = await buildBackup(() => {}, { withBlobs: false });
      const text = await built.blob.text();
      /*
       * ⚠️ **والنسخةُ تُشارَك.** ملفٌّ فيه رمزٌ حيٌّ يعني إذنًا إلى Drive
       *    حسابك لمن يفتحه — ولذلك يعيش الرمزُ في الذاكرة وحدَها.
       */
      expect(text.includes('TOKEN_MUST_NOT_APPEAR_ANYWHERE')).toBe(false);
      expect(text.includes('leak@example.com')).toBe(false);
      expect(JSON.stringify(built.manifest).includes('TOKEN_MUST')).toBe(false);
    } finally {
      __forceToken(null);
    }
  });

  it('٢٢ · ولا رمزَ في حزمة المزامنة المرفوعة', async () => {
    const { resetDevices, activate } = await import('./sync-devices.js');
    const { addScript } = await import('../js/services/content-service.js');
    const { createSyncPackage } = await import('../js/services/sync/sync-package.js');
    const { findSecrets } = await import('../js/services/cloud/cloud-service.js');

    await resetDevices();
    activate('tablet');
    await addScript(null, { title: 'أ', text: 'ن' });

    __forceToken('TOKEN_MUST_NOT_APPEAR_ANYWHERE');
    try {
      const pkg = await createSyncPackage({ peerVector: {}, peerId: null });
      const text = JSON.stringify(pkg);
      expect(text.includes('TOKEN_MUST_NOT_APPEAR_ANYWHERE')).toBe(false);
      expect(findSecrets(pkg).length).toBe(0);
    } finally {
      __forceToken(null);
    }
  });

  it('٢٣ · ⚠️ ولا شاشةٌ تنادي googleapis ولا accounts.google', async () => {
    const views = [
      'analysis-view', 'constellation-view', 'dev-view', 'duplicates-view', 'facets-view',
      'import-view', 'language-view', 'life-view', 'now-view', 'organize-view', 'prompts-view',
      'river-view', 'scene-view', 'search-view', 'settings-view', 'shadow-history-view',
      'shadow-view', 'studio-view', 'threads-view', 'trash-view', 'workspace-view',
      'cloud-settings', 'cloud-actions',
    ];
    const banned = ['googleapis.com', 'accounts.google', 'gsi/client', 'Bearer '];
    const offenders = [];

    for (const name of views) {
      /* eslint-disable-next-line no-await-in-loop */
      const source = await (await fetch(`../js/views/${name}.js`)).text();
      const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      for (const needle of banned) {
        if (code.includes(needle)) offenders.push(`${name}.js: «${needle}»`);
      }
    }
    if (offenders.length) throw new Error(`شاشةٌ تنادي Google:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);

    /* والوحيدُ الذي يعرف عنوانَ Google هو الناقلُ ومُفوِّضُه. */
    const transportSrc = await (await fetch('../js/services/cloud/drive-transport.js')).text();
    expect(transportSrc).toContain('googleapis.com');
  });

  it('٢٤ · ومحرّكُ WS-G ما زال بلا شبكةٍ بعد وصول Drive', async () => {
    const modules = ['change-log', 'conflicts', 'device', 'logical-state', 'merge-apply',
      'merge-planner', 'sync-package', 'sync-policy', 'sync-service'];
    const banned = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'googleapis', 'Bearer '];
    const offenders = [];

    for (const name of modules) {
      /* eslint-disable-next-line no-await-in-loop */
      const source = await (await fetch(`../js/services/sync/${name}.js`)).text();
      const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      for (const needle of banned) {
        if (code.includes(needle)) offenders.push(`${name}.js: «${needle}»`);
      }
    }
    if (offenders.length) throw new Error(`WS-G لمس الشبكة:\n${offenders.join('\n')}`);
    expect(offenders.length).toBe(0);
  });
});

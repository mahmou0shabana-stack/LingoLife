/**
 * LingoLife — مُنفِّذ Google Drive (WS-H · العقدُ الحقيقيّ)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **يفي بنفس العقد الذي يفي به المحاكي — بالحرف**
 * ═══════════════════════════════════════════════════════════════
 *
 * ولذلك `attachCloud(driveTransport)` و`attachCloud(mockTransport)`
 * يمرّان على **نفس السطور** في المنسّق والطابور والنسخ. فما نجح في
 * ٣٧ اختبارًا ضدّ المحاكي يمشي هنا، وما ينكسر هنا ينكسر في النقل لا في
 * الدلالة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **`appProperties` لا `properties` — والفرقُ خصوصيّة**
 * ═══════════════════════════════════════════════════════════════
 *
 *   properties      يقرؤها **أيُّ تطبيقٍ** له وصولٌ للملفّ
 *   appProperties   خاصّةٌ بهذا العميل وحدَه
 *
 * وكلُّ ما نكتبه وسمٌ داخليّ (نوعُ الملفّ، الجهازُ المؤلِّف، الترتيب،
 * البصمة). فلا داعيَ أن يقرأه غيرُنا، والبحثُ بها أسرعُ وأدقُّ من
 * تخمين المعنى من الاسم.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والتخطيطُ ظاهرٌ في «My Drive» لا مخفيّ**
 * ═══════════════════════════════════════════════════════════════
 *
 *   LingoLife/
 *     ├── sync/      حزمٌ + حالةُ كلّ جهاز
 *     ├── media/     بايتاتُ الصوت والصور
 *     └── backups/   أرشيفاتُ .llife المؤرَّخة
 *
 * تراه بعينك، وتنزّل منه بيدك، ولا تمحوه «إدارةُ التطبيقات». وهو سببُ
 * رفض `appDataFolder` من الأساس.
 */

import {
  BACKUP_KIND, BLOB_ROLE, FAIL, TransportError, UNIVERSE_PREFIX,
  backupFileName, blobFileName, deviceStateFileName, packageFileName,
} from './transport.js';
import {
  requestToken, currentToken, invalidateToken, revokeToken,
  hasValidToken, rememberAccount, currentAccount,
} from './drive-auth.js';
import { newId } from '../../utils/ids.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_MIME = 'application/json';
const BACKUP_MIME = 'application/x-lingolife-backup';

/** أسماءُ المجلّدات — ثابتةٌ فتُقرأ في Drive بعينك. */
const ROOT_NAME = 'LingoLife';
const SUB = Object.freeze({ SYNC: 'sync', MEDIA: 'media', BACKUPS: 'backups' });

/** وسومُ `appProperties` — مكتوبةٌ مرّةً فلا تتفرّق حروفُها. */
const TAG = Object.freeze({
  KIND: 'llifeKind',
  DEVICE: 'llifeDevice',
  SEQ: 'llifeSeq',
  MEDIA: 'llifeMedia',
  ROLE: 'llifeRole',
  SHA: 'llifeSha256',
  UNIVERSE: 'llifeUniverse',
  BACKUP_KIND: 'llifeBackupKind',
  AT: 'llifeAt',
});

const KIND = Object.freeze({
  ROOT: 'root',
  FOLDER: 'folder',
  UNIVERSE: 'universe',
  PACKAGE: 'package',
  DEVSTATE: 'devstate',
  BLOB: 'blob',
  BACKUP: 'backup',
});

/** فوق هذا الحجم يُرفَع الملفّ على دفعاتٍ قابلةٍ للاستئناف. */
const RESUMABLE_ABOVE = 4 * 1024 * 1024;
const CHUNK = 4 * 1024 * 1024;

/** أقصى إعاداتٍ للمحاولة عند عطبٍ مؤقّت. */
const MAX_RETRY = 4;

/* ------------------------------------------------------------------ *
 * تصنيفُ أخطاء Drive
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **والسببُ يُقرأ من جسم الردّ لا من رقم الحالة وحدَه.** Drive يعيد
 *    `403` لثلاثة أشياءَ مختلفةٍ تمامًا: امتلاءُ المساحة، وتجاوزُ
 *    المعدّل، ونقصُ الصلاحية. وأوّلُها يحتاج قرارًا منك، والثاني
 *    يحتاج انتظارًا، والثالث يحتاج إذنًا جديدًا — فخلطُها في «خطأ ٤٠٣»
 *    يترك المستخدمَ بلا فعلٍ يفعله.
 */
function classifyDrive(status, body) {
  const reason = body?.error?.errors?.[0]?.reason
    || body?.error?.status
    || '';

  if (status === 401) return FAIL.AUTH;
  if (status === 403) {
    if (/storageQuotaExceeded|quotaExceeded/i.test(reason)) return FAIL.QUOTA;
    if (/rateLimitExceeded|userRateLimitExceeded|RESOURCE_EXHAUSTED/i.test(reason)) return FAIL.RATE_LIMIT;
    return FAIL.PERMISSION;
  }
  if (status === 404) return FAIL.REMOTE_CORRUPT;
  if (status === 429) return FAIL.RATE_LIMIT;
  if (status >= 500) return FAIL.TRANSIENT_SERVER;
  return FAIL.UNKNOWN;
}

const messageOf = (body, fallback) =>
  body?.error?.message || body?.error_description || fallback;

/* ------------------------------------------------------------------ *
 * المُنفِّذ
 * ------------------------------------------------------------------ */

/**
 * @param {{ onOps?: Function }} options
 */
export function createDriveTransport({ onOps = null } = {}) {
  const counts = {};
  /** ذاكرةُ معرِّفات المجلّدات — تمنع بحثًا لكلّ رفع. */
  let folders = { root: null, sync: null, media: null, backups: null };
  let connected = false;

  const tick = (op) => {
    counts[op] = (counts[op] || 0) + 1;
    onOps?.(op, counts[op]);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * نداءٌ واحدٌ إلى Drive — بالرمز، وبالتراجع الأُسّيّ، وبتصنيف الخطأ.
   *
   * ⚠️ **و`401` يُعاد مرّةً واحدةً بعد إبطال الرمز.** الرمزُ قد يكون
   *    انتهى بين نداءين، وطلبٌ صامتٌ جديدٌ ينجح غالبًا بلا إزعاجك.
   *    فإن فشل الصامتُ فهي `AUTH_REQUIRED` حقيقيّةٌ تنتظر ضغطتَك.
   */
  async function call(op, url, { method = 'GET', headers = {}, body = null, raw = false,
    retry = 0, reauthed = false } = {}) {
    tick(op);
    const token = currentToken();
    if (!token) throw new TransportError(FAIL.AUTH, 'مفيش إذن Drive صالح');

    let response;
    try {
      response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...headers },
        body,
      });
    } catch {
      /* فشلُ الشبكة نفسِها — لا ردَّ أصلًا. */
      if (retry < MAX_RETRY) {
        await sleep(2 ** retry * 500);
        return call(op, url, { method, headers, body, raw, retry: retry + 1, reauthed });
      }
      throw new TransportError(FAIL.OFFLINE, 'مفيش إنترنت — Drive مش رادّ');
    }

    if (response.ok) return raw ? response : safeJson(response);

    const parsed = await safeJson(response).catch(() => null);
    const category = classifyDrive(response.status, parsed);

    if (category === FAIL.AUTH && !reauthed) {
      invalidateToken();
      try {
        await requestToken({ silent: true });
      } catch {
        throw new TransportError(FAIL.AUTH, 'انتهى إذن Drive — محتاج تربط تاني');
      }
      return call(op, url, { method, headers, body, raw, retry, reauthed: true });
    }

    if ((category === FAIL.RATE_LIMIT || category === FAIL.TRANSIENT_SERVER) && retry < MAX_RETRY) {
      const after = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 2 ** retry * 700);
      return call(op, url, { method, headers, body, raw, retry: retry + 1, reauthed });
    }

    throw new TransportError(category, messageOf(parsed, `Drive ردّ ${response.status}`), {
      status: response.status,
    });
  }

  const safeJson = async (response) => {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { raw: text }; }
  };

  /* ---------------- الاستعلام ---------------- */

  /** يهرب علامةَ اقتباسٍ في قيمةٍ داخل `q` — وإلّا كُسِر الاستعلام. */
  const q = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const hasProp = (key, value) =>
    `appProperties has { key='${q(key)}' and value='${q(value)}' }`;

  const FIELDS = 'files(id,name,size,createdTime,modifiedTime,appProperties,mimeType)';

  /**
   * يسرد ملفّاتٍ باستعلام.
   *
   * ⚠️ **و`trashed = false` في كلّ استعلام.** ملفٌّ في سلّة Drive يبقى
   *    مسرودًا بلا هذا الشرط، فتُنزَّل حزمةٌ حذفتَها أو تُحسَب نسخةٌ
   *    ألقيتَها موجودةً — وهو خطأٌ صامتٌ لا يظهر إلّا بعد أن تفرّغ السلّة.
   */
  async function list(op, query, { pageSize = 200, order = null } = {}) {
    const out = [];
    let pageToken = null;
    do {
      const url = new URL(`${API}/files`);
      url.searchParams.set('q', `${query} and trashed = false`);
      url.searchParams.set('fields', `nextPageToken,${FIELDS}`);
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('spaces', 'drive');
      if (order) url.searchParams.set('orderBy', order);
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      /* eslint-disable-next-line no-await-in-loop -- صفحةٌ بعد صفحة */
      const page = await call(op, url.toString());
      out.push(...(page?.files || []));
      pageToken = page?.nextPageToken || null;
    } while (pageToken);
    return out;
  }

  /* ---------------- الرفع ---------------- */

  /** رفعٌ بسيطٌ متعدّدُ الأجزاء — للملفّات الصغيرة (JSON). */
  async function uploadMultipart(op, metadata, blob, { fileId = null } = {}) {
    const boundary = `llife${newId('B')}`;
    const head =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
      + `${JSON.stringify(metadata)}\r\n`
      + `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;

    const body = new Blob([head, blob, tail]);
    const url = new URL(`${UPLOAD}/files${fileId ? `/${fileId}` : ''}`);
    url.searchParams.set('uploadType', 'multipart');
    url.searchParams.set('fields', 'id,name,size,appProperties');

    return call(op, url.toString(), {
      method: fileId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }

  /**
   * رفعٌ قابلٌ للاستئناف — للبايتات والنسخ.
   *
   * ⚠️ **ولماذا يستحقّ التعقيد؟** ملفُّ صوتٍ من ٤٠ ميجابايت على شبكةِ
   *    موبايلٍ متقطّعة يفشل في المنتصف كثيرًا؛ والرفعُ البسيط يعيد
   *    الأربعين من الصفر في كلّ مرّة. وهنا تُرفَع القطعةُ التي سقطت
   *    وحدَها.
   */
  async function uploadResumable(op, metadata, blob) {
    tick(`${op}:init`);
    const token = currentToken();
    if (!token) throw new TransportError(FAIL.AUTH, 'مفيش إذن Drive صالح');

    const initUrl = new URL(`${UPLOAD}/files`);
    initUrl.searchParams.set('uploadType', 'resumable');
    initUrl.searchParams.set('fields', 'id,name,size,appProperties');

    const init = await fetch(initUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': blob.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(blob.size),
      },
      body: JSON.stringify(metadata),
    }).catch(() => null);

    if (!init || !init.ok) {
      const parsed = init ? await safeJson(init).catch(() => null) : null;
      throw new TransportError(
        init ? classifyDrive(init.status, parsed) : FAIL.OFFLINE,
        messageOf(parsed, 'مقدرناش نبدأ الرفع')
      );
    }

    const session = init.headers.get('location');
    if (!session) throw new TransportError(FAIL.UNKNOWN, 'Drive مبعتش عنوان جلسة الرفع');

    let offset = 0;
    let attempt = 0;
    while (offset < blob.size) {
      const end = Math.min(offset + CHUNK, blob.size);
      const chunk = blob.slice(offset, end);
      tick(`${op}:chunk`);

      /* eslint-disable-next-line no-await-in-loop -- قطعةٌ بعد قطعة */
      const put = await fetch(session, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${offset}-${end - 1}/${blob.size}`,
        },
        body: chunk,
      }).catch(() => null);

      if (!put) {
        if (attempt >= MAX_RETRY) throw new TransportError(FAIL.OFFLINE, 'الرفع اتقطع');
        attempt += 1;
        /* eslint-disable-next-line no-await-in-loop */
        await sleep(2 ** attempt * 600);
        continue;
      }

      if (put.status === 308) {
        /*
         * ⚠️ **والموضعُ التالي يُقرأ من Drive لا يُفترَض.** قد يكون
         *    استقبل أقلَّ ممّا أرسلنا، والافتراضُ يترك ثقبًا في الملفّ.
         */
        const range = put.headers.get('range');
        const received = range ? Number(range.split('-')[1]) + 1 : end;
        offset = Number.isFinite(received) ? received : end;
        attempt = 0;
        continue;
      }

      if (put.ok) return safeJson(put);

      /* eslint-disable-next-line no-await-in-loop */
      const parsed = await safeJson(put).catch(() => null);
      const category = classifyDrive(put.status, parsed);
      if ((category === FAIL.RATE_LIMIT || category === FAIL.TRANSIENT_SERVER)
        && attempt < MAX_RETRY) {
        attempt += 1;
        /* eslint-disable-next-line no-await-in-loop */
        await sleep(2 ** attempt * 700);
        continue;
      }
      throw new TransportError(category, messageOf(parsed, 'فشل الرفع'), { status: put.status });
    }

    /* وصلنا النهايةَ بلا ردٍّ نهائيّ — نسأل عن الملفّ. */
    throw new TransportError(FAIL.UNKNOWN, 'الرفع خلص من غير ردّ نهائي من Drive');
  }

  const upload = (op, metadata, blob) =>
    (blob.size > RESUMABLE_ABOVE
      ? uploadResumable(op, metadata, blob)
      : uploadMultipart(op, metadata, blob));

  /* ---------------- المجلّدات ---------------- */

  async function findOrCreateFolder(name, { parent = null, kind = KIND.FOLDER } = {}) {
    const scope = parent ? ` and '${q(parent)}' in parents` : ` and ${hasProp(TAG.KIND, KIND.ROOT)}`;
    const found = await list('listFolders',
      `mimeType = '${FOLDER_MIME}' and name = '${q(name)}'${scope}`);
    if (found.length) return found[0].id;

    const created = await call('createFolder', `${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': JSON_MIME },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        ...(parent ? { parents: [parent] } : {}),
        appProperties: { [TAG.KIND]: kind },
      }),
    });
    return created.id;
  }

  /** يضمن وجودَ الشجرة كلِّها — مرّةً في الجلسة. */
  async function ensureFolders() {
    if (folders.root && folders.sync && folders.media && folders.backups) return folders;
    const root = folders.root || await findOrCreateFolder(ROOT_NAME, { kind: KIND.ROOT });
    const [sync, media, backups] = await Promise.all([
      findOrCreateFolder(SUB.SYNC, { parent: root }),
      findOrCreateFolder(SUB.MEDIA, { parent: root }),
      findOrCreateFolder(SUB.BACKUPS, { parent: root }),
    ]);
    folders = { root, sync, media, backups };
    return folders;
  }

  /* ================================================================ *
   * العقد
   * ================================================================ */

  const transport = {
    id: 'google-drive',
    label: 'Google Drive',

    /* ---------------- الاتّصال ---------------- */

    async connect() {
      tick('connect');
      await requestToken();
      /*
       * بريدُ الحساب للعرض وحدَه — والهُويّةُ الحقيقيّةُ للكون هي
       * `universeId` لا البريد (بند ٢٢).
       */
      try {
        const about = await call('about', `${API}/about?fields=user(emailAddress)`);
        rememberAccount(about?.user?.emailAddress || null);
      } catch { /* البريدُ زينةٌ — غيابُه لا يمنع الربط */ }

      await ensureFolders();
      connected = true;
      return { ok: true, account: currentAccount() };
    },

    async disconnect() {
      tick('disconnect');
      connected = false;
      folders = { root: null, sync: null, media: null, backups: null };
      await revokeToken();
      return true;
    },

    isConnected() { return connected && hasValidToken(); },
    identity() { return this.isConnected() ? { account: currentAccount() } : null; },

    /* ---------------- الكونُ السحابيّ ---------------- */

    async discover() {
      const rows = await list('discover', hasProp(TAG.KIND, KIND.UNIVERSE),
        { order: 'createdTime' });
      if (!rows.length) return { found: false, universeId: null };

      /*
       * ⚠️ **وأقدمُ كونٍ هو الكون.** لو تسابق جهازان على الإنشاء في نفس
       *    اللحظة (أوّلُ ربطٍ لجهازين معًا) لَوُجد ملفّان. والحسمُ
       *    بقاعدةٍ حتميّةٍ لا بمن سأل أوّلًا: **الأقدمُ يفوز**، ويراها
       *    الجهازان بنفس الترتيب فيتّفقان بلا تفاوض.
       */
      const first = rows[0];
      return {
        found: true,
        universeId: first.appProperties?.[TAG.UNIVERSE] || first.name,
        createdAt: Date.parse(first.createdTime) || null,
        supersededBy: first.appProperties?.supersededBy || null,
        fileId: first.id,
        duplicates: rows.length - 1,
      };
    },

    async createUniverse({ supersedes = null } = {}) {
      const { root } = await ensureFolders();
      const universeId = newId(UNIVERSE_PREFIX);
      const body = new Blob([JSON.stringify({
        universeId, createdAt: Date.now(), supersedes: supersedes || null,
      }, null, 1)], { type: JSON_MIME });

      await uploadMultipart('createUniverse', {
        name: `universe-${universeId}.json`,
        parents: [root],
        appProperties: {
          [TAG.KIND]: KIND.UNIVERSE,
          [TAG.UNIVERSE]: universeId,
          ...(supersedes ? { supersedes } : {}),
        },
      }, body);

      return { universeId };
    },

    async supersedeUniverse(newUniverseId) {
      const found = await this.discover();
      if (!found.found || !found.fileId) return false;
      await call('supersedeUniverse', `${API}/files/${found.fileId}?fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': JSON_MIME },
        body: JSON.stringify({ appProperties: { supersededBy: newUniverseId } }),
      });
      return true;
    },

    /* ---------------- المزامنة ---------------- */

    async pushPackage(pkg) {
      const { sync } = await ensureFolders();
      const seq = pkg.maxSeq ?? 0;
      const name = packageFileName(pkg.sourceDeviceId, seq);

      /*
       * ⚠️ **والحزمةُ لا تُكتَب مرّتين.** رفعٌ يُعاد بعد ردٍّ ضائع يجد
       *    الملفَّ باسمه الحتميّ فيعود بمعرِّفه — بلا نسخةٍ ثانيةٍ ولا
       *    تكرارٍ دلاليّ. وهذا هو ما يجعل «أعد المحاولة» آمنًا دائمًا.
       */
      const existing = await list('listPackages',
        `${hasProp(TAG.KIND, KIND.PACKAGE)} and name = '${q(name)}'`);
      if (existing.length) return { fileId: existing[0].id, name, deduped: true };

      const body = new Blob([JSON.stringify(pkg)], { type: JSON_MIME });
      const created = await upload('pushPackage', {
        name,
        parents: [sync],
        appProperties: {
          [TAG.KIND]: KIND.PACKAGE,
          [TAG.DEVICE]: pkg.sourceDeviceId,
          [TAG.SEQ]: String(seq).padStart(9, '0'),
        },
      }, body);

      return { fileId: created.id, name, deduped: false };
    },

    async listPackages({ exclude = null } = {}) {
      const rows = await list('listPackages', hasProp(TAG.KIND, KIND.PACKAGE),
        { order: 'name' });
      return rows
        .map((row) => ({
          fileId: row.id,
          name: row.name,
          device: row.appProperties?.[TAG.DEVICE] || '',
          seq: Number(row.appProperties?.[TAG.SEQ] || 0),
        }))
        .filter((row) => !exclude || row.device !== exclude)
        .sort((a, b) => (a.device === b.device
          ? a.seq - b.seq
          : (a.device < b.device ? -1 : 1)));
    },

    async pullPackage(fileId) {
      const response = await call('pullPackage', `${API}/files/${fileId}?alt=media`,
        { raw: true });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        /* ⚠️ ملفٌّ تالفٌ يُرفَع كـ`REMOTE_CORRUPT` فيعزله المنسّق ولا يوقف الباقي. */
        throw new TransportError(FAIL.REMOTE_CORRUPT, 'ملف الحزمة مش JSON سليم');
      }
    },

    /**
     * حالةُ الجهاز — **وهي الإقرارُ أيضًا** (`pushAck` في كلامك).
     *
     * ⚠️ ولا ملفَّ إقرارٍ ثالث: المتّجهُ في `dev-<جهاز>.json` هو نفسُه
     *    ما يقرأه الجيرانُ ليعرفوا ما وصله. وملفٌّ ثانٍ يحمل نفسَ
     *    الحقيقة يعني مصدرَي حقيقةٍ يتفرّقان.
     */
    async pushDeviceState(deviceId, state) {
      const { sync } = await ensureFolders();
      const name = deviceStateFileName(deviceId);
      const body = new Blob([JSON.stringify(state)], { type: JSON_MIME });

      const existing = await list('listDeviceStates',
        `${hasProp(TAG.KIND, KIND.DEVSTATE)} and name = '${q(name)}'`);

      /* كاتبٌ واحد: الجهازُ يكتب ملفَّه هو، فلا سباقَ على صفٍّ واحد. */
      if (existing.length) {
        const updated = await uploadMultipart('pushDeviceState',
          { appProperties: { [TAG.AT]: String(Date.now()) } }, body,
          { fileId: existing[0].id });
        return { fileId: updated.id };
      }

      const created = await uploadMultipart('pushDeviceState', {
        name,
        parents: [sync],
        appProperties: {
          [TAG.KIND]: KIND.DEVSTATE,
          [TAG.DEVICE]: deviceId,
          [TAG.AT]: String(Date.now()),
        },
      }, body);
      return { fileId: created.id };
    },

    async listDeviceStates() {
      const rows = await list('listDeviceStates', hasProp(TAG.KIND, KIND.DEVSTATE));
      const out = [];
      for (const row of rows) {
        /* eslint-disable-next-line no-await-in-loop -- جهازٌ بعد جهاز، وهم قليل */
        const response = await call('pullDeviceState', `${API}/files/${row.id}?alt=media`,
          { raw: true }).catch(() => null);
        if (!response) continue;
        /* eslint-disable-next-line no-await-in-loop */
        const text = await response.text();
        try {
          out.push({ device: row.appProperties?.[TAG.DEVICE] || '', state: JSON.parse(text) });
        } catch { /* حالةٌ تالفةٌ تُتخطّى — ولا توقف الباقي */ }
      }
      return out;
    },

    /* ---------------- الوسائط ---------------- */

    /**
     * بحثٌ مُوجَّهٌ عن بايتاتِ وسيطٍ بعينه.
     *
     * ⚠️ **ولا يُسرَد مخزنُ الوسائط كلُّه للعثور على ملفّ.** استعلامٌ
     *    على وسمين يعود بصفٍّ واحد، وسردُ ألفٍ لاختيار واحدٍ منها
     *    يكلّف صفحاتٍ من النداءات على تابلت.
     */
    async hasBlob(mediaId, role) {
      const rows = await list('hasBlob',
        `${hasProp(TAG.KIND, KIND.BLOB)} and ${hasProp(TAG.MEDIA, mediaId)} `
        + `and ${hasProp(TAG.ROLE, role)}`);
      if (!rows.length) return null;
      return {
        fileId: rows[0].id,
        bytes: Number(rows[0].size || 0),
        sha256: rows[0].appProperties?.[TAG.SHA] || null,
      };
    },

    async putBlob(mediaId, role, blob, { sha256 = null, mime = '' } = {}) {
      const existing = await transport.hasBlob(mediaId, role);
      /* ⚠️ تُكتَب مرّةً لكلّ (وسيط، دور) — فالرفعُ المعاد لا يضاعف. */
      if (existing) return { ...existing, deduped: true };

      const { media } = await ensureFolders();
      const created = await upload('putBlob', {
        name: blobFileName(mediaId, role, mime || blob.type),
        parents: [media],
        appProperties: {
          [TAG.KIND]: KIND.BLOB,
          [TAG.MEDIA]: mediaId,
          [TAG.ROLE]: role,
          ...(sha256 ? { [TAG.SHA]: sha256 } : {}),
        },
      }, blob);

      return { fileId: created.id, bytes: blob.size, sha256, deduped: false };
    },

    /**
     * @param {{ known?: {fileId: string, bytes: number} }} options — وصفٌ
     *   سبق أن سُئل عنه، فلا يُسأل مرّتين.
     *
     * ⚠️ **والبحثُ مرّتين قِيس فوُجد.** طابورُ التنزيل يسأل `hasBlob`
     *    ليعرف البصمةَ ومعرِّفَ الملفّ، ثم كان `fetchBlob` يسأل ثانيةً
     *    عن نفس الشيء — نداءٌ زائدٌ **لكلّ ملفّ**. وعلى «نزّل كل
     *    الملفّات» بخمسمئة ملفٍّ يعني خمسمئة نداءٍ لا تشتري شيئًا،
     *    وتقرّبك من حدّ المعدّل بلا سبب.
     */
    async fetchBlob(mediaId, role, { onProgress = null, signal = null, known = null } = {}) {
      const remote = known?.fileId ? known : await transport.hasBlob(mediaId, role);
      if (!remote) {
        throw new TransportError(FAIL.REMOTE_CORRUPT, 'بايتات الوسيط مش موجودة على Drive');
      }
      return download('fetchBlob', remote.fileId, remote.bytes, { onProgress, signal });
    },

    async listBlobs() {
      const rows = await list('listBlobs', hasProp(TAG.KIND, KIND.BLOB));
      return rows.map((row) => ({
        mediaId: row.appProperties?.[TAG.MEDIA] || '',
        role: row.appProperties?.[TAG.ROLE] || BLOB_ROLE.ORIGINAL,
        bytes: Number(row.size || 0),
        sha256: row.appProperties?.[TAG.SHA] || null,
        fileId: row.id,
      }));
    },

    /* ---------------- النسخُ الاحتياطيّة ---------------- */

    async putBackup(blob, { kind = BACKUP_KIND.FULL, manifest = null, at = new Date() } = {}) {
      const { backups } = await ensureFolders();
      const when = at instanceof Date ? at : new Date(at);
      const name = backupFileName(kind, when);

      const created = await upload('putBackup', {
        name,
        parents: [backups],
        appProperties: {
          [TAG.KIND]: KIND.BACKUP,
          [TAG.BACKUP_KIND]: kind,
          [TAG.AT]: String(when.getTime()),
          ...(manifest?.counts
            ? { llifeRecords: String(Object.values(manifest.counts).reduce((a, b) => a + b, 0)) }
            : {}),
        },
      }, new Blob([blob], { type: BACKUP_MIME }));

      return { fileId: created.id, name, bytes: blob.size };
    },

    async listBackups() {
      const rows = await list('listBackups', hasProp(TAG.KIND, KIND.BACKUP));
      return rows
        .map((row) => ({
          fileId: row.id,
          name: row.name,
          kind: row.appProperties?.[TAG.BACKUP_KIND] || BACKUP_KIND.FULL,
          bytes: Number(row.size || 0),
          at: Number(row.appProperties?.[TAG.AT] || Date.parse(row.createdTime) || 0),
          blobCount: null,
        }))
        .sort((a, b) => b.at - a.at);
    },

    async fetchBackup(fileId, { onProgress = null } = {}) {
      const meta = await call('backupMeta', `${API}/files/${fileId}?fields=size`);
      return download('fetchBackup', fileId, Number(meta?.size || 0),
        { onProgress, type: BACKUP_MIME });
    },

    /**
     * ⚠️ خارجَ العقد — والاستبقاءُ يفحص وجودَها قبل النداء.
     *
     * ⚠️ **و«مش موجود» نجاحٌ لا فشل — وأسقطه الاختبار.** الحذفُ ليس
     *    مُتماثلًا (idempotent) بطبعه: لو نجح على Drive وضاع ردُّه في
     *    الطريق، أعادت طبقةُ المحاولة النداءَ فوجدت الملفَّ قد ذهب —
     *    فقالت «ملف تالف» عن عمليّةٍ **بلغت غرضَها بالضبط**.
     *
     *    والغرضُ هنا «ألّا يبقى هذا الملفّ»؛ وهو متحقّقٌ في الحالتين.
     */
    async deleteBackup(fileId) {
      try {
        await call('deleteBackup', `${API}/files/${fileId}`, { method: 'DELETE', raw: true });
      } catch (error) {
        if (error?.category !== FAIL.REMOTE_CORRUPT) throw error;
      }
      return true;
    },

    /* ---------------- القياس ---------------- */

    stats() { return { ...counts }; },
    resetStats() { for (const key of Object.keys(counts)) delete counts[key]; },

    /** تخطيطُ المجلّدات كما هو على Drive — للتشخيص والتقرير. */
    layout() { return { ...folders, rootName: ROOT_NAME }; },
  };

  /**
   * تنزيلٌ متدفّقٌ بتقدُّمٍ حقيقيّ.
   *
   * ⚠️ **ولا يُبنى البلوب إلّا بعد وصول آخر بايت.** قراءةُ التدفّق
   *    قطعةً قطعةً تعطي تقدُّمًا صادقًا (لا شريطًا يقفز من صفرٍ إلى
   *    مئة)، والانقطاعُ في المنتصف يرمي **قبل** أن يُبنى شيءٌ يُكتَب.
   */
  async function download(op, fileId, expectedBytes, { onProgress = null, signal = null,
    type = null } = {}) {
    const response = await call(op, `${API}/files/${fileId}?alt=media`, { raw: true });

    if (!response.body) {
      const blob = await response.blob();
      onProgress?.({ loaded: blob.size, total: blob.size });
      return type ? new Blob([blob], { type }) : blob;
    }

    const reader = response.body.getReader();
    const total = expectedBytes || Number(response.headers.get('content-length')) || 0;
    const chunks = [];
    let loaded = 0;

    for (;;) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw new TransportError(FAIL.OFFLINE, 'أُلغي التنزيل');
      }
      /* eslint-disable-next-line no-await-in-loop -- قطعةٌ بعد قطعة */
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress?.({ loaded, total });
    }

    /*
     * ⚠️ **وردٌّ ناقصٌ يُرفَض هنا لا في المستدعي.** تنزيلٌ انقطع يعطي
     *    بايتاتٍ صحيحةً جزئيًّا؛ ولو مُرّرت لكان فحصُ البصمة سيسقط —
     *    لكنّه سيسقط بوصفها «تالفة» بدل «ناقصة»، ونحن نعرف الفرق.
     */
    if (total && loaded < total) {
      throw new TransportError(FAIL.TRANSIENT_SERVER,
        `التنزيل اتقطع عند ${loaded} من ${total} بايت`);
    }

    return new Blob(chunks, {
      type: type || response.headers.get('content-type') || 'application/octet-stream',
    });
  }

  return transport;
}

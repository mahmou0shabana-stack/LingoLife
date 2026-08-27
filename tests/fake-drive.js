/**
 * LingoLife — خادمُ Drive مزيَّفٌ في الذاكرة (WS-H)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولماذا هذا موجودٌ بجانب `mock-transport.js`؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * المحاكي هناك يزيّف **الناقلَ** نفسَه: يفي بالعقد بلا أن يعرف HTTP.
 * وهو يختبر ما فوق الناقل — المنسّقَ والطابورَ والنسخ.
 *
 * وهذا يزيّف **الشبكةَ تحت الناقل**: يردّ على `fetch` بردودِ Drive
 * الحقيقيّةِ الشكل. وهو يختبر ما لا يختبره ذاك إطلاقًا:
 *
 *   · هل بُني `q` صحيحًا؟ (وعلامةُ اقتباسٍ في معرِّفٍ تكسره)
 *   · هل جسمُ `multipart/related` مبنيٌّ كما يقبله Drive؟
 *   · هل يُستأنَف الرفعُ من حيث قال Drive لا من حيث ظننّا؟
 *   · هل يُصنَّف `403` الثلاثةُ ثلاثةَ أشياءَ مختلفة؟
 *
 * ⚠️ **وهو ليس بديلًا عن Drive الحقيقيّ.** لا يجيب عن سؤالِ الصلاحية
 *    (هل يرى جهازٌ ثانٍ ملفَّ الأوّل تحت `drive.file`؟) — وذاك سؤالٌ
 *    لا يجيب عنه إلّا Google.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let nextId = 1;

/**
 * ينشئ خادمًا ويستبدل `window.fetch`.
 *
 * @returns {{ files: Map, restore: Function, fail: Function, calls: Array, cut: Function }}
 */
export function installFakeDrive() {
  const files = new Map();
  const calls = [];
  const faults = [];
  const original = window.fetch;
  /** جلساتُ الرفع المستأنَف: عنوان → { fileId, meta, chunks, size } */
  const sessions = new Map();

  const fail = (match, { status = 500, body = null, times = 1 } = {}) => {
    faults.push({ match, status, body, times });
  };

  /** يقطع جلسةَ رفعٍ بعد قطعةٍ بعينها — لاختبار الاستئناف. */
  let cutAfterChunk = -1;
  const cut = (index) => { cutAfterChunk = index; };

  const takeFault = (url, method) => {
    const hit = faults.find((f) => f.times > 0 && f.match(url, method));
    if (!hit) return null;
    hit.times -= 1;
    return hit;
  };

  const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });

  /* ---------------------------------------------------------------- *
   * مفسّرُ الاستعلام — يكفي ما نستعمله، ويرفض ما لا يفهمه بدل أن يتجاهله
   * ---------------------------------------------------------------- */

  function matchesQuery(file, query) {
    /* ⚠️ والشروطُ تُفصَل على ` and ` في المستوى الأعلى فقط — و`has {…}`
       فيها `and` داخليّة، فنحميها أوّلًا. */
    /* ⚠️ ولا حرفَ تحكّمٍ حرفيٌّ في المصدر — يُكتَب بالهروب فيُقرَأ. */
    const AND = '\u0001';
    const guarded = query.replace(/has\s*\{([^}]*)\}/g, (m, inner) =>
      `has {${inner.split(' and ').join(AND)}}`);

    return guarded.split(' and ').every((rawClause) => {
      const clause = rawClause.trim().split(AND).join(' and ');
      if (!clause) return true;
      if (clause === 'trashed = false') return !file.trashed;

      let m = clause.match(/^appProperties has \{ key='(.*?)' and value='(.*?)' \}$/);
      if (m) {
        const key = unescape(m[1]);
        const value = unescape(m[2]);
        return (file.appProperties || {})[key] === value;
      }

      m = clause.match(/^name = '(.*)'$/);
      if (m) return file.name === unescape(m[1]);

      m = clause.match(/^mimeType = '(.*)'$/);
      if (m) return file.mimeType === unescape(m[1]);

      m = clause.match(/^'(.*)' in parents$/);
      if (m) return (file.parents || []).includes(unescape(m[1]));

      throw new Error(`استعلامٌ لا يفهمه الخادمُ المزيَّف: «${clause}»`);
    });
  }

  const unescape = (value) => value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

  /* ---------------------------------------------------------------- *
   * تحليلُ multipart
   * ---------------------------------------------------------------- */

  /**
   * ⚠️ **يُقسَّم على البايتات لا على النصّ.** أوّلُ صياغةٍ قرأت الجسمَ
   *    بـ`.text()` فمرّت بايتاتُ الصوت على فكِّ UTF-8 وعادت مشوّهة —
   *    فسقط اختبارُ البصمة. والملفُّ الثنائيُّ لا يُقسَّم كنصّ.
   */
  async function parseMultipart(body, contentType) {
    const boundary = /boundary=(.+)$/.exec(contentType || '')?.[1];
    if (!boundary) throw new Error('multipart بلا boundary');

    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    const marker = encoder.encode(`--${boundary}`);
    const cuts = indexesOf(bytes, marker);
    if (cuts.length < 3) throw new Error(`multipart فيه ${cuts.length} فاصل`);

    const sliceBody = (from, to) => {
      const part = bytes.subarray(from, to);
      const blank = indexesOf(part, encoder.encode('\r\n\r\n'))[0];
      if (blank === undefined) return new Uint8Array(0);
      let start = blank + 4;
      let end = part.length;
      /* الجزءُ ينتهي بـ CRLF قبل الفاصل التالي */
      if (end >= start + 2) end -= 2;
      return part.slice(start, end);
    };

    const metaBytes = sliceBody(cuts[0] + marker.length, cuts[1]);
    const contentBytes = sliceBody(cuts[1] + marker.length, cuts[2]);
    return { metadata: JSON.parse(decoder.decode(metaBytes)), content: contentBytes };
  }

  /** مواضعُ ظهورِ نمطٍ من البايتات. */
  function indexesOf(haystack, needle) {
    const found = [];
    outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) continue outer;
      }
      found.push(i);
      i += needle.length - 1;
    }
    return found;
  }

  /* ---------------------------------------------------------------- *
   * الموجّه
   * ---------------------------------------------------------------- */

  window.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (options.method || 'GET').toUpperCase();
    calls.push({ url, method });

    const fault = takeFault(url, method);
    if (fault) {
      return json(fault.body || { error: { message: 'عطبٌ محقون' } }, fault.status,
        fault.status === 429 ? { 'retry-after': '0' } : {});
    }

    const parsed = new URL(url);
    const path = parsed.pathname;

    /* ---- سرد ---- */
    if (path === '/drive/v3/files' && method === 'GET') {
      const query = parsed.searchParams.get('q') || '';
      const rows = [...files.values()].filter((f) => matchesQuery(f, query));
      const order = parsed.searchParams.get('orderBy');
      if (order === 'name') rows.sort((a, b) => (a.name < b.name ? -1 : 1));
      if (order === 'createdTime') rows.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
      return json({ files: rows.map(publicView) });
    }

    /* ---- إنشاءُ بيانٍ فقط (مجلّد) ---- */
    if (path === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(options.body);
      return json(publicView(put(meta, '')));
    }

    /* ---- رفعٌ متعدّدُ الأجزاء (إنشاءٌ أو تعديل) ---- */
    if (path === '/upload/drive/v3/files' && method === 'POST'
      && parsed.searchParams.get('uploadType') === 'multipart') {
      const { metadata, content } = await parseMultipart(options.body,
        options.headers?.['Content-Type']);
      return json(publicView(put(metadata, content)));
    }

    const patchMatch = path.match(/^\/upload\/drive\/v3\/files\/(.+)$/);
    if (patchMatch && method === 'PATCH') {
      const file = files.get(patchMatch[1]);
      if (!file) return json({ error: { message: 'مش موجود' } }, 404);
      const { metadata, content } = await parseMultipart(options.body,
        options.headers?.['Content-Type']);
      file.content = content;
      file.appProperties = { ...file.appProperties, ...(metadata.appProperties || {}) };
      return json(publicView(file));
    }

    /* ---- بدءُ رفعٍ مستأنَف ---- */
    if (path === '/upload/drive/v3/files' && method === 'POST'
      && parsed.searchParams.get('uploadType') === 'resumable') {
      const meta = JSON.parse(options.body);
      const session = `https://www.googleapis.com/upload/drive/v3/files?upload_id=U${nextId++}`;
      sessions.set(session, {
        meta,
        size: Number(options.headers['X-Upload-Content-Length']),
        received: 0,
        chunks: [],
        seen: 0,
      });
      return new Response('', { status: 200, headers: { location: session } });
    }

    /* ---- قطعةُ رفعٍ مستأنَف ---- */
    if (sessions.has(url) && method === 'PUT') {
      const session = sessions.get(url);
      const range = options.headers?.['Content-Range'] || '';
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(range);
      if (!m) return json({ error: { message: 'Content-Range غلط' } }, 400);
      const [, startStr, endStr] = m;
      const start = Number(startStr);
      const end = Number(endStr);

      const chunkBytes = new Uint8Array(await new Response(options.body).arrayBuffer());

      /*
       * ⚠️ **وهنا نحاكي أخطرَ سلوكٍ في الاستئناف**: Drive قد يستقبل
       *    أقلَّ ممّا أُرسل ويقول ذلك في `Range`. فلو استأنف العميلُ من
       *    حيث ظنّ لا من حيث قيل، تُرك ثقبٌ في الملفّ.
       */
      const accepted = session.seen === cutAfterChunk
        ? Math.max(1, Math.floor(chunkBytes.length / 2))
        : chunkBytes.length;
      session.seen += 1;

      session.chunks.push({ start, bytes: chunkBytes.slice(0, accepted) });
      session.received = start + accepted;

      if (session.received >= session.size) {
        const ordered = session.chunks.sort((a, b) => a.start - b.start);
        const content = new Uint8Array(session.size);
        for (const piece of ordered) content.set(piece.bytes, piece.start);
        sessions.delete(url);
        return json(publicView(put(session.meta, content)));
      }
      return new Response('', {
        status: 308,
        headers: { range: `bytes=0-${session.received - 1}` },
      });
    }

    /* ---- تنزيل / بيان / حذف ---- */
    const fileMatch = path.match(/^\/drive\/v3\/files\/(.+)$/);
    if (fileMatch) {
      const file = files.get(fileMatch[1]);
      if (!file) return json({ error: { message: 'File not found' } }, 404);

      if (method === 'DELETE') {
        files.delete(file.id);
        /* ⚠️ **و`204` لا تحمل جسمًا.** `new Response('', {status:204})` يرمي —
           وذاك الرميُ ظهر للناقل كعطبِ شبكةٍ فأعاد المحاولة. */
        return new Response(null, { status: 204 });
      }

      if (method === 'PATCH') {
        const meta = JSON.parse(options.body);
        file.appProperties = { ...file.appProperties, ...(meta.appProperties || {}) };
        return json(publicView(file));
      }

      if (parsed.searchParams.get('alt') === 'media') {
        /*
         * ⚠️ `shortRead` يحاكي أخطرَ ردٍّ: ترويسةٌ تَعِد بطولٍ والجسمُ
         *    أقصرُ منه — وهو ما يقع حين تُقطَع الوصلةُ في المنتصف.
         */
        const body = file.shortRead
          ? (file.content.slice ? file.content.slice(0, file.shortRead) : file.content)
          : file.content;
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'Content-Length': String(sizeOf(file.content)),
          },
        });
      }
      return json(publicView(file));
    }

    if (path === '/drive/v3/about') {
      return json({ user: { emailAddress: 'test@example.com' } });
    }

    throw new Error(`مسارٌ لا يعرفه الخادمُ المزيَّف: ${method} ${path}`);
  };

  function put(meta, content) {
    const id = `FKD${nextId++}`;
    const row = {
      id,
      name: meta.name || id,
      mimeType: meta.mimeType || (content ? 'application/json' : FOLDER_MIME),
      parents: meta.parents || [],
      appProperties: { ...(meta.appProperties || {}) },
      content,
      trashed: false,
      createdTime: new Date(Date.now() + nextId).toISOString(),
    };
    files.set(id, row);
    return row;
  }

  const sizeOf = (content) => (content == null
    ? 0
    : (content.byteLength ?? new Blob([content]).size));

  const publicView = (file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: String(sizeOf(file.content)),
    appProperties: file.appProperties,
    createdTime: file.createdTime,
    modifiedTime: file.createdTime,
  });

  return {
    files,
    calls,
    fail,
    cut,
    restore() { window.fetch = original; },
    countOf: (needle) => calls.filter((c) => c.url.includes(needle)).length,
  };
}

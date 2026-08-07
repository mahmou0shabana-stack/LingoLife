/**
 * LingoLife — قارئ وكاتب ZIP (طريقة STORE فقط)
 *
 * لماذا ZIP بلا ضغط؟
 *   الصور JPEG/WebP والصوت Opus مضغوطة أصلًا. إعادة ضغطها تستهلك بطارية
 *   التابلت مقابل توفير يقارب الصفر. وبطريقة STORE تبقى بايتات كل ملف
 *   متّصلة داخل الأرشيف — فيمكن سحب صورة واحدة بـ `blob.slice` بلا فكّ
 *   الأرشيف كله، وهذا ما يجعل الاسترجاع ممكنًا على تابلت بذاكرة محدودة.
 *
 * ولماذا ZIP أصلًا؟
 *   صيغة مفتوحة عمرها أربعون عامًا. لو اختفى LingoLife غدًا تظل نسختك
 *   الاحتياطية مقروءة بأي أداة على أي نظام — وهذا نصّ مبدأ الملكية في
 *   docs/04-storage-decision.md §4.5.
 *
 * يدعم ZIP64 تلقائيًا: أرشيف يتجاوز 4GB أو ملف مفرد يتجاوز 4GB أو أكثر
 * من 65534 عنصرًا. بدون ذلك كانت النسخة الاحتياطية ستتلف صامتةً عند
 * أول مكتبة صور كبيرة.
 *
 * راجع docs/07-backup-format.md §7.3
 */

import { crc32, crc32Blob } from './crc32.js';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;

/** حدّ الأربعة جيجا — فوقه نحتاج حقول ZIP64. */
const U32_MAX = 0xffffffff;
const U16_MAX = 0xffff;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ------------------------------------------------------------------ *
 * الكتابة
 * ------------------------------------------------------------------ */

/** يحوّل تاريخًا إلى زوج (وقت، تاريخ) بصيغة DOS القديمة التي تلزمها ZIP. */
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * يبني أرشيف ZIP على شكل قائمة أجزاء، ثم يجمعها في Blob واحد.
 *
 * الأجزاء تبقى مراجع لـ Blobs — المتصفح يحتفظ بها مدعومة بالقرص ولا
 * يحمّلها في الذاكرة. لذلك يمكن بناء أرشيف بحجم جيجابايتات على تابلت.
 */
export function createZipBuilder() {
  /** @type {(Uint8Array | Blob)[]} */
  const parts = [];
  /** @type {{name: Uint8Array, crc: number, size: number, offset: number}[]} */
  const entries = [];
  let offset = 0;

  function push(part) {
    parts.push(part);
    offset += part instanceof Blob ? part.size : part.length;
  }

  /** يكتب الترويسة المحلية ويعيد إزاحتها. */
  function writeLocalHeader(nameBytes, crcValue, size, at) {
    const zip64 = size > U32_MAX || at > U32_MAX;
    const extraLen = zip64 ? 20 : 0;
    const header = new Uint8Array(30 + nameBytes.length + extraLen);
    const view = new DataView(header.buffer);
    const { time, date } = dosDateTime(new Date());

    view.setUint32(0, SIG_LOCAL, true);
    view.setUint16(4, zip64 ? 45 : 20, true); // الإصدار المطلوب للفكّ
    view.setUint16(6, 0x0800, true); // بت 11 — اسم الملف بترميز UTF-8
    view.setUint16(8, 0, true); // 0 = STORE بلا ضغط
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crcValue, true);
    view.setUint32(18, zip64 ? U32_MAX : size, true); // الحجم المضغوط = الأصلي
    view.setUint32(22, zip64 ? U32_MAX : size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, extraLen, true);
    header.set(nameBytes, 30);

    if (zip64) {
      const ex = 30 + nameBytes.length;
      view.setUint16(ex, 0x0001, true); // معرّف حقل ZIP64
      view.setUint16(ex + 2, 16, true);
      view.setBigUint64(ex + 4, BigInt(size), true);
      view.setBigUint64(ex + 12, BigInt(size), true);
    }

    return header;
  }

  const builder = {
    /**
     * يضيف عنصرًا من بايتات في الذاكرة (JSON غالبًا).
     * @param {string} name
     * @param {Uint8Array} bytes
     */
    addBytes(name, bytes) {
      const nameBytes = encoder.encode(name);
      const crcValue = crc32(bytes);
      const at = offset;
      push(writeLocalHeader(nameBytes, crcValue, bytes.length, at));
      push(bytes);
      entries.push({ name: nameBytes, crc: crcValue, size: bytes.length, offset: at });
      return { crc: crcValue, size: bytes.length };
    },

    /** يضيف نصًا. */
    addText(name, text) {
      return builder.addBytes(name, encoder.encode(text));
    },

    /**
     * يضيف Blob دون قراءته في الذاكرة دفعةً واحدة.
     * @param {string} name
     * @param {Blob} blob
     * @param {number} [precomputedCrc] — لتفادي قراءة ثانية إن حُسب مسبقًا
     */
    async addBlob(name, blob, precomputedCrc) {
      const nameBytes = encoder.encode(name);
      const crcValue = precomputedCrc ?? (await crc32Blob(blob));
      const at = offset;
      push(writeLocalHeader(nameBytes, crcValue, blob.size, at));
      push(blob);
      entries.push({ name: nameBytes, crc: crcValue, size: blob.size, offset: at });
      return { crc: crcValue, size: blob.size };
    },

    /** عدد العناصر المضافة حتى الآن. */
    get count() {
      return entries.length;
    },

    /** الحجم الحالي بالبايت. */
    get bytes() {
      return offset;
    },

    /**
     * يكتب الفهرس المركزي والخاتمة ويعيد الأرشيف كاملًا.
     * @returns {Blob}
     */
    finalize(mimeType = 'application/zip') {
      const centralStart = offset;

      for (const entry of entries) {
        const bigSize = entry.size > U32_MAX;
        const bigOffset = entry.offset > U32_MAX;
        const zip64 = bigSize || bigOffset;
        // حقل ZIP64 يحمل فقط القيم التي تجاوزت 32 بت، وبترتيب ثابت.
        const extraLen = zip64 ? 4 + (bigSize ? 16 : 0) + (bigOffset ? 8 : 0) : 0;

        const header = new Uint8Array(46 + entry.name.length + extraLen);
        const view = new DataView(header.buffer);
        const { time, date } = dosDateTime(new Date());

        view.setUint32(0, SIG_CENTRAL, true);
        view.setUint16(4, 45, true); // نسخة المُنتِج
        view.setUint16(6, zip64 ? 45 : 20, true);
        view.setUint16(8, 0x0800, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, time, true);
        view.setUint16(14, date, true);
        view.setUint32(16, entry.crc, true);
        view.setUint32(20, bigSize ? U32_MAX : entry.size, true);
        view.setUint32(24, bigSize ? U32_MAX : entry.size, true);
        view.setUint16(28, entry.name.length, true);
        view.setUint16(30, extraLen, true);
        view.setUint16(32, 0, true); // طول التعليق
        view.setUint16(34, 0, true); // رقم القرص
        view.setUint16(36, 0, true); // سمات داخلية
        view.setUint32(38, 0, true); // سمات خارجية
        view.setUint32(42, bigOffset ? U32_MAX : entry.offset, true);
        header.set(entry.name, 46);

        if (zip64) {
          const ex = 46 + entry.name.length;
          view.setUint16(ex, 0x0001, true);
          view.setUint16(ex + 2, extraLen - 4, true);
          let at = ex + 4;
          if (bigSize) {
            view.setBigUint64(at, BigInt(entry.size), true);
            view.setBigUint64(at + 8, BigInt(entry.size), true);
            at += 16;
          }
          if (bigOffset) view.setBigUint64(at, BigInt(entry.offset), true);
        }

        push(header);
      }

      const centralSize = offset - centralStart;
      const needsZip64 =
        entries.length > U16_MAX - 1 || centralStart > U32_MAX || centralSize > U32_MAX;

      if (needsZip64) {
        const eocd64 = new Uint8Array(56 + 20);
        const view = new DataView(eocd64.buffer);
        view.setUint32(0, SIG_EOCD64, true);
        view.setBigUint64(4, BigInt(44), true); // حجم ما تبقى من السجل
        view.setUint16(12, 45, true);
        view.setUint16(14, 45, true);
        view.setUint32(16, 0, true);
        view.setUint32(20, 0, true);
        view.setBigUint64(24, BigInt(entries.length), true);
        view.setBigUint64(32, BigInt(entries.length), true);
        view.setBigUint64(40, BigInt(centralSize), true);
        view.setBigUint64(48, BigInt(centralStart), true);
        // المُحدِّد — يخبر القارئ أين يجد سجل ZIP64 أعلاه
        view.setUint32(56, SIG_EOCD64_LOCATOR, true);
        view.setUint32(60, 0, true);
        view.setBigUint64(64, BigInt(centralStart + centralSize), true);
        view.setUint32(72, 1, true);
        push(eocd64);
      }

      const eocd = new Uint8Array(22);
      const view = new DataView(eocd.buffer);
      view.setUint32(0, SIG_EOCD, true);
      view.setUint16(4, 0, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, Math.min(entries.length, U16_MAX), true);
      view.setUint16(10, Math.min(entries.length, U16_MAX), true);
      view.setUint32(12, Math.min(centralSize, U32_MAX), true);
      view.setUint32(16, Math.min(centralStart, U32_MAX), true);
      view.setUint16(20, 0, true);
      push(eocd);

      return new Blob(parts, { type: mimeType });
    },
  };

  return builder;
}

/* ------------------------------------------------------------------ *
 * القراءة
 * ------------------------------------------------------------------ */

/** يقرأ شريحة من Blob كـ DataView. */
async function viewOf(blob, start, end) {
  const buf = await blob.slice(start, end).arrayBuffer();
  return new DataView(buf);
}

/** يبحث عن خاتمة الأرشيف بالمسح من النهاية للخلف. */
async function findEocd(blob) {
  // التعليق قد يصل إلى 64KB، والخاتمة 22 بايت — نمسح آخر 66KB ويكفي.
  const tailSize = Math.min(blob.size, 66 * 1024);
  const start = blob.size - tailSize;
  const view = await viewOf(blob, start, blob.size);

  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      return { view, offsetInTail: i, tailStart: start };
    }
  }
  throw new Error('ليس ملف ZIP سليمًا — لم تُعثر على خاتمة الأرشيف.');
}

/**
 * يفتح أرشيف ZIP للقراءة الكسولة.
 *
 * لا يُقرأ أي محتوى هنا — فقط الفهرس. استخراج عنصر يعيد `blob.slice`،
 * أي مرجعًا لا نسخة. فتح أرشيف بحجم 10GB يكلّف كيلوبايتات.
 *
 * @param {Blob} blob
 */
export async function openZip(blob) {
  const { view, offsetInTail, tailStart } = await findEocd(blob);

  let entryCount = view.getUint16(offsetInTail + 10, true);
  let centralSize = view.getUint32(offsetInTail + 12, true);
  let centralStart = view.getUint32(offsetInTail + 16, true);

  // أي قيمة مشبعة تعني أن الحقيقة في سجل ZIP64 قبل الخاتمة.
  if (entryCount === U16_MAX || centralSize === U32_MAX || centralStart === U32_MAX) {
    const locatorAt = tailStart + offsetInTail - 20;
    if (locatorAt < 0) throw new Error('أرشيف ZIP64 ناقص — مُحدِّد الخاتمة مفقود.');
    const loc = await viewOf(blob, locatorAt, locatorAt + 20);
    if (loc.getUint32(0, true) !== SIG_EOCD64_LOCATOR) {
      throw new Error('أرشيف ZIP64 تالف — توقيع المُحدِّد غير مطابق.');
    }
    const eocd64At = Number(loc.getBigUint64(8, true));
    const rec = await viewOf(blob, eocd64At, eocd64At + 56);
    if (rec.getUint32(0, true) !== SIG_EOCD64) {
      throw new Error('أرشيف ZIP64 تالف — توقيع الخاتمة غير مطابق.');
    }
    entryCount = Number(rec.getBigUint64(32, true));
    centralSize = Number(rec.getBigUint64(40, true));
    centralStart = Number(rec.getBigUint64(48, true));
  }

  const central = await viewOf(blob, centralStart, centralStart + centralSize);
  const bytes = new Uint8Array(central.buffer);
  /** @type {Map<string, {name: string, size: number, crc: number, headerOffset: number}>} */
  const entries = new Map();

  let p = 0;
  for (let i = 0; i < entryCount; i++) {
    if (central.getUint32(p, true) !== SIG_CENTRAL) {
      throw new Error(`فهرس الأرشيف تالف عند العنصر ${i}.`);
    }
    const crcValue = central.getUint32(p + 16, true);
    let size = central.getUint32(p + 24, true);
    const nameLen = central.getUint16(p + 28, true);
    const extraLen = central.getUint16(p + 30, true);
    const commentLen = central.getUint16(p + 32, true);
    let headerOffset = central.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (size === U32_MAX || headerOffset === U32_MAX) {
      // نمرّ على الحقول الإضافية بحثًا عن حقل ZIP64 (المعرّف 0x0001).
      let ex = p + 46 + nameLen;
      const exEnd = ex + extraLen;
      while (ex + 4 <= exEnd) {
        const id = central.getUint16(ex, true);
        const len = central.getUint16(ex + 2, true);
        if (id === 0x0001) {
          let at = ex + 4;
          if (size === U32_MAX) {
            size = Number(central.getBigUint64(at, true));
            at += 16; // الحجم الأصلي ثم المضغوط
          }
          if (headerOffset === U32_MAX) headerOffset = Number(central.getBigUint64(at, true));
          break;
        }
        ex += 4 + len;
      }
    }

    entries.set(name, { name, size, crc: crcValue, headerOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  /** يحسب أين تبدأ بايتات العنصر فعليًا (بعد ترويسته المحلية). */
  async function dataStart(entry) {
    const local = await viewOf(blob, entry.headerOffset, entry.headerOffset + 30);
    if (local.getUint32(0, true) !== SIG_LOCAL) {
      throw new Error(`ترويسة تالفة للعنصر: ${entry.name}`);
    }
    return entry.headerOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  }

  const archive = {
    entries,

    /** هل العنصر موجود؟ */
    has(name) {
      return entries.has(name);
    },

    /** أسماء العناصر. */
    names() {
      return [...entries.keys()];
    },

    /**
     * يعيد العنصر كـ Blob — شريحة لا نسخة، بلا تكلفة ذاكرة.
     * @param {string} name
     * @param {string} type — نوع MIME المطلوب
     */
    async blob(name, type = 'application/octet-stream') {
      const entry = entries.get(name);
      if (!entry) throw new Error(`عنصر غير موجود في الأرشيف: ${name}`);
      const start = await dataStart(entry);
      return blob.slice(start, start + entry.size, type);
    },

    /** يعيد العنصر كنص. */
    async text(name) {
      const part = await archive.blob(name);
      return part.text();
    },

    /** يعيد العنصر مُحلَّلًا من JSON. */
    async json(name) {
      return JSON.parse(await archive.text(name));
    },
  };

  return archive;
}

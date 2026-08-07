/**
 * LingoLife — CRC-32 (متعدد الحدود IEEE 802.3)
 *
 * صيغة ZIP تُلزم بوجود CRC-32 لكل عنصر. فبمجرد أن تكون النسخة الاحتياطية
 * ملف ZIP، يصبح كشف التلف مجانيًا — لا يحتاج حقلًا إضافيًا ولا اتفاقًا خاصًا،
 * وأي أداة zip في الدنيا تستطيع التحقق منه.
 *
 * راجع docs/07-backup-format.md §7.6
 */

/** جدول 256 مدخلًا يُبنى مرة واحدة عند أول استخدام. */
let TABLE = null;

function buildTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

/**
 * يحدّث قيمة CRC جارية بقطعة بايتات.
 * التقسيم على قطع يسمح بحساب ملف كبير بلا تحميله كله في الذاكرة.
 *
 * @param {Uint8Array} bytes
 * @param {number} seed — القيمة الجارية (0 للبداية)
 * @returns {number} CRC غير منتهٍ — مرّره لـ crc32Final
 */
export function crc32Update(bytes, seed = 0) {
  if (!TABLE) TABLE = buildTable();
  let crc = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    crc = (TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * CRC-32 لمصفوفة بايتات كاملة.
 * @param {Uint8Array} bytes
 * @returns {number}
 */
export function crc32(bytes) {
  return crc32Update(bytes, 0);
}

/**
 * CRC-32 لـ Blob بالقراءة على قطع — لا يحمّل الملف كله في الذاكرة.
 * @param {Blob} blob
 * @param {number} chunkSize
 * @returns {Promise<number>}
 */
export async function crc32Blob(blob, chunkSize = 4 * 1024 * 1024) {
  let crc = 0;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const slice = blob.slice(offset, Math.min(offset + chunkSize, blob.size));
    const bytes = new Uint8Array(await slice.arrayBuffer());
    crc = crc32Update(bytes, crc);
  }
  return crc;
}

/** يحوّل CRC إلى نص ست عشري ثابت الطول — للعرض والمقارنة. */
export function crc32Hex(value) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * LingoLife — المعرّفات
 *
 * ULID مبسّط: 48-bit طابع زمني (Base32) + 16 محرفًا عشوائيًا.
 * الخاصية المهمة: المعرّفات مرتّبة زمنيًا كنص — فترتيب المفاتيح في
 * IndexedDB يعطي ترتيبًا زمنيًا مجانًا، بلا فهرس إضافي.
 *
 * البادئة تجعل المعرّف مقروءًا للبشر في Drive وفي ملفات التصدير.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32 — بلا I L O U
const RANDOM_LEN = 16;

/** بادئات الكيانات. */
export const PREFIX = Object.freeze({
  SCENE: 'SC',
  MEDIA: 'MED',
  LINK: 'LNK',
  SCRIPT: 'SCR',
  SCRIPT_VERSION: 'SCV',
  BLOCK: 'BLK',
  BLOCK_VERSION: 'BLV',
  CONVERSATION: 'CNV',
  CONV_PART: 'CVP',
  EXPRESSION: 'EXP',
  OCCURRENCE: 'OCC',
  PATTERN: 'PAT',
  WORD: 'WRD',
  MISTAKE: 'MIS',
  PERSON: 'PSN',
  PLACE: 'PLC',
  JOURNEY: 'JRN',
  TOPIC: 'TPC',
  TAG: 'TAG',
  RELATION: 'REL',
  REVIEW: 'RVW',
  REVIEW_LOG: 'RVL',
  ANALYSIS_RUN: 'ANR',
  PROPOSAL: 'PRP',
  SYNC: 'SYN',
  CONTEXT: 'CTX',
  PROMPT: 'PMT',
  BACKUP: 'BAK',
  SHADOW_SESSION: 'SHS',
  SHADOW_SEGMENT: 'SHG',
  EVIDENCE: 'EVD',
  SAVED: 'SAV',
  NATIVE_AUDIO: 'NAU',
  EVENT_TYPE: 'ETY',
  THREAD: 'THR',

  /* مختبر التطوّر */
  DEV_ISSUE: 'DVI',
  DEV_BRIEF: 'DVB',
  DEV_EVENT: 'DVE',
  DEV_SHOT: 'DVS',
});

function encodeTime(ms, len = 10) {
  let out = '';
  let value = ms;
  for (let i = len - 1; i >= 0; i--) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function randomPart(len = RANDOM_LEN) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

/**
 * ينشئ معرّفًا جديدًا.
 * @param {string} prefix — من PREFIX
 * @returns {string} مثل "SC_01JD8FQK2M_7X3PQR9TZK4MB2VH"
 */
export function newId(prefix) {
  return `${prefix}_${encodeTime(Date.now())}_${randomPart()}`;
}

/** يستخرج البادئة من معرّف. */
export function prefixOf(id) {
  return typeof id === 'string' ? id.split('_')[0] : null;
}

/** يستخرج وقت الإنشاء من المعرّف (تقريبي، بالملّي ثانية). */
export function timeOf(id) {
  const part = typeof id === 'string' ? id.split('_')[1] : null;
  if (!part) return null;
  let value = 0;
  for (const ch of part) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    value = value * 32 + idx;
  }
  return value;
}

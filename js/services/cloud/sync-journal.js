/**
 * LingoLife — دفترُ المزامنة (WS-H · طورُ التحقّق الحقيقيّ)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لماذا دفترٌ واحدٌ لا `console.log` في كلّ طبقة**
 * ═══════════════════════════════════════════════════════════════
 *
 * الفحصُ على جهازين حقيقيّين لا يعطيك طرفيّةً مفتوحة. التابلتُ في يدك،
 * والموبايلُ في اليد الأخرى، والسؤالُ الذي ستقفُ عنده هو: «رفع ولّا
 * لأ؟ وصلت ولّا لأ؟ Drive ردّ بإيه؟». وهذه أسئلةٌ لا تُجاب برسائلَ
 * متناثرةٍ في طرفيّةٍ لا تراها.
 *
 * فالدفترُ **مكانٌ واحدٌ** تكتب فيه كلُّ الطبقات — الناقلُ والمنسّقُ
 * وناقلُ الوسائط — ويُقرأ من شاشةٍ واحدةٍ في مختبر التطوّر، ويُنسَخ
 * نصًّا فيُرسَل.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والتنقيةُ عند الباب لا عند النداء**
 * ═══════════════════════════════════════════════════════════════
 *
 * لو كانت القاعدةُ «لا تكتب الرمزَ في الدفتر» لَوجب أن يتذكّرها كلُّ
 * مَن يكتب، اليومَ وبعد سنة. وهي تُنسى مرّةً واحدةً فيتسرّب الرمزُ إلى
 * نصٍّ يُرسَل في محادثة.
 *
 * فالمنعُ هنا **بنيويّ**: كلُّ سطرٍ يمرّ بـ`scrub` قبل أن يُخزَّن،
 * فتُحذَف المفاتيحُ المحظورة أيًّا كان مَن كتبها، وتُقصَّ أيُّ قيمةٍ
 * نصّيّةٍ تشبه رمزًا. ويحرسه اختبارٌ يحقن رمزًا صراحةً ثم يقرأ الدفتر.
 */

import { FORBIDDEN_KEYS } from './secrets.js';

/** سعةُ الدفتر — أسطرٌ تكفي دورةً كاملةً بوسائطها ولا تُثقل الذاكرة. */
const CAPACITY = 400;

/**
 * أنواعُ الأحداث — **مُعلَنةٌ لا حرّة**.
 *
 * ⚠️ ونوعٌ لا يُعلَن هنا يُكتَب `unknown` صراحةً بدل أن يمرّ بلا انتباه.
 *    فالقارئُ يعرف أن ثمّة شيئًا يُبلَّغ عنه بلا اسمٍ في الجدول.
 */
export const JOURNAL = Object.freeze({
  /* الدورة */
  SYNC_START: 'sync.start',
  SYNC_END: 'sync.end',
  SYNC_FAILED: 'sync.failed',
  SYNC_SKIPPED: 'sync.skipped',

  /* الحزم */
  PKG_DISCOVERED: 'pkg.discovered',
  PKG_DOWNLOADED: 'pkg.downloaded',
  PKG_UPLOADED: 'pkg.uploaded',
  PKG_QUARANTINED: 'pkg.quarantined',
  PKG_SKIPPED: 'pkg.skipped',

  /* السجلّات */
  RECORDS_APPLIED: 'records.applied',
  RECORDS_SKIPPED: 'records.skipped',

  /* الوسائط */
  MEDIA_HASH_WANTED: 'media.hashWanted',
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DOWNLOADED: 'media.downloaded',
  MEDIA_VERIFY_FAILED: 'media.verifyFailed',

  /* الناقل */
  HTTP: 'http',
  RETRY: 'retry',
  AUTH_REQUIRED: 'auth.required',
  AUTH_REFRESHED: 'auth.refreshed',

  /* غيرُ ذلك */
  UNIVERSE: 'universe',
  CONFLICT: 'conflict',
  RESTORE_HOLD: 'restore.hold',
  BACKUP: 'backup',
  NOTE: 'note',
});

const KNOWN = new Set(Object.values(JOURNAL));

/*
 * أنماطٌ تُشبه رمزًا حتى لو لم يكن مفتاحُها محظورًا.
 *
 * ⚠️ **والقيمةُ تُفحَص لا المفتاحُ وحدَه.** حقلٌ اسمُه `detail` قيمتُه
 *    «Bearer ya29.…» يمرّ من فحص المفاتيح سالمًا — والرمزُ فيه كاملًا.
 */
const TOKENISH = [
  /\bBearer\s+\S+/gi,
  /\bya29\.[A-Za-z0-9._-]+/g,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\b/g,
];

const maskText = (text) => {
  let out = text;
  for (const pattern of TOKENISH) out = out.replace(pattern, '⟨محجوب⟩');
  return out;
};

/**
 * ينظّف قيمةً قبل تخزينها — تُنادى على كلّ سطرٍ بلا استثناء.
 *
 * ويقصّ العمقَ أيضًا: كائنٌ متداخلٌ بلا حدٍّ يجعل الدفترَ نسخةً من
 * القاعدة، وهو ما لا يُقرأ ولا يُرسَل.
 */
export function scrub(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskText(value.length > 300 ? `${value.slice(0, 300)}…` : value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 4) return '…';

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => scrub(item, depth + 1));
  }
  if (typeof value !== 'object') return String(value);

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key)) continue;
    /* ولا مفتاحَ يحمل «token» أو «secret» في اسمه أيًّا كانت صياغتُه. */
    if (/token|secret|password|credential/i.test(key)) continue;
    out[key] = scrub(child, depth + 1);
  }
  return out;
}

let rows = [];
let seq = 0;
let enabled = true;
const listeners = new Set();

/**
 * يكتب سطرًا.
 *
 * ⚠️ **ولا يرمي أبدًا.** الدفترُ أداةُ مراقبة؛ ولو أسقط دورةَ مزامنةٍ
 *    لصار هو العطبَ الذي جاء يكشفه.
 */
export function journal(event, detail = {}) {
  if (!enabled) return null;
  try {
    seq += 1;
    const row = {
      n: seq,
      at: Date.now(),
      event: KNOWN.has(event) ? event : 'unknown',
      ...(KNOWN.has(event) ? {} : { raw: String(event).slice(0, 60) }),
      ...scrub(detail),
    };
    rows.push(row);
    if (rows.length > CAPACITY) rows = rows.slice(-CAPACITY);
    for (const listener of listeners) {
      try { listener(row); } catch { /* مستمعٌ يرمي لا يوقف الكتابة */ }
    }
    return row;
  } catch {
    return null;
  }
}

/** كلُّ الأسطر — نسخةٌ، فلا يعبث القارئُ بالأصل. */
export function journalRows({ since = 0, event = null } = {}) {
  return rows
    .filter((row) => row.n > since && (!event || row.event === event))
    .map((row) => ({ ...row }));
}

/** عددُ الأسطر لكلّ نوع — الملخّصُ الذي يُقرأ قبل التفاصيل. */
export function journalCounts() {
  const out = {};
  for (const row of rows) out[row.event] = (out[row.event] || 0) + 1;
  return out;
}

/**
 * نصٌّ يُنسَخ ويُرسَل — وهو الشكلُ الذي سيصلني من الجهاز الحقيقيّ.
 *
 * ⚠️ ويمرّ بالتنقية **مرّةً ثانية** عند التصدير. الأسطرُ منقّاةٌ أصلًا،
 *    لكنّ التصديرَ هو ما يغادر الجهاز فعلًا — فالحارسُ الأخيرُ عنده.
 */
export function journalText({ limit = CAPACITY } = {}) {
  const slice = rows.slice(-limit);
  const stamp = (ms) => new Date(ms).toISOString().slice(11, 23);
  return slice.map((row) => {
    const { n, at, event, ...rest } = row;
    const body = JSON.stringify(scrub(rest));
    return `${String(n).padStart(4, '0')} ${stamp(at)} ${event} ${body}`;
  }).join('\n');
}

/** يفرّغ الدفتر — قبل بدء فحصٍ جديدٍ كي لا يختلط بما قبله. */
export function journalClear() {
  rows = [];
  seq = 0;
  return true;
}

/** يوقف الكتابةَ أو يعيدها — الاختباراتُ تستعمله للعزل. */
export function journalEnabled(next) {
  if (typeof next === 'boolean') enabled = next;
  return enabled;
}

/** اشتراكٌ حيٌّ — تستعمله شاشةُ المختبر لتُحدَّث أثناء الدورة. */
export function onJournal(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

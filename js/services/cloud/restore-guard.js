/**
 * LingoLife — حارسُ الاسترجاع (WS-H · بند ٥ من الطلب، وبند P من المواصفة)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **الكارثةُ التي يمنعها هذا الملفّ**
 * ═══════════════════════════════════════════════════════════════
 *
 * تسرّب خطأٌ اليوم وزُومِن إلى التابلت والموبايل. فتسترجع على التابلت
 * نسخةَ الأسبوع الماضي. ثم تعمل المزامنةُ تلقائيًّا…
 *
 *   الموبايلُ يرسل تاريخَه كلَّه ← الدمجُ يُعيد الحالةَ الحديثة
 *   ← **الاسترجاعُ يُلغى في ثوانٍ، بصمت.**
 *
 * وهذا ليس عطبًا في WS-G: الدمجُ فعل ما وُجد له بالضبط. العطبُ أن
 * **الاسترجاع والدمج فعلان متضادّان** وقد سُمح لهما بالتتابع بلا سؤال.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والكشفُ بلا خطّافٍ في كود الاسترجاع**
 * ═══════════════════════════════════════════════════════════════
 *
 * كان أسهلَ شيءٍ أن ينادي `restore.js` هذا الملفَّ عند نجاحه. ورُفض:
 * فطبقةُ النسخ الاحتياطيّ لا يجوز أن تعرف المزامنة، وأيُّ مسارٍ آخر
 * يستبدل القاعدةَ غدًا كان سيفلت من الخطّاف صامتًا.
 *
 * فالكشفُ **بالمقارنة**: المزامنةُ تحفظ آخرَ متّجهٍ رأته في
 * `localStorage` (خارج القاعدة، فينجو من استبدالها). وعند الإقلاع
 * تقارن:
 *
 *     المتّجهُ في القاعدة   {}                 ← بعد استرجاع
 *     المتّجهُ المحفوظ      {DEV_TABLET: 512}  ← ما كنّا نعرفه
 *
 * ومتّجهٌ **تراجَع** يعني شيئًا واحدًا: القاعدةُ استُبدلت من تحت
 * المزامنة. وهي حقيقةٌ تكشف نفسَها، ولا تعتمد على أن يتذكّرها أحد.
 *
 * ⚠️ **ولا يُخلَط الجهازُ الجديد بالجهاز المُسترجَع**: الجديدُ متّجهُه
 *    فارغٌ **ولا نقطةَ محفوظةً له أصلًا**. فالشرطُ وجودُ نقطةٍ سابقة.
 */

import { withTx } from '../../db/database.js';
import { vectorOf } from '../sync/change-log.js';
import { INSTALL, readInstall, writeInstall } from './install-store.js';

const CHECKPOINT_KEY = INSTALL.VECTOR_SEEN;
const read = readInstall;
const write = writeInstall;

/** آخرُ متّجهٍ رأته المزامنةُ على هذا التركيب. */
export function lastSeenVector() {
  const raw = read(CHECKPOINT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.vector === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** يسجّل المتّجهَ الحاليّ — يُنادى بعد كلّ دورةِ مزامنةٍ ناجحة. */
export function rememberVector(vector, extra = {}) {
  return write(CHECKPOINT_KEY, JSON.stringify({
    vector: { ...vector }, at: Date.now(), ...extra,
  }));
}

/** ينسى النقطة — بعد فكِّ الارتباط أو بعد اعتماد قرارٍ يُلغيها. */
export function forgetVector() {
  return write(CHECKPOINT_KEY, null);
}

/**
 * هل تراجع المتّجه؟
 *
 * ⚠️ **والتراجعُ لا يقع في التشغيل العاديّ أبدًا**: الدمجُ يزيد
 *    `originSeq` ولا ينقصه، والكتابةُ المحلّيّة تزيده. فأيُّ نقصانٍ
 *    — في أيّ مؤلِّفٍ واحد — استبدالٌ للقاعدة، لا تشغيلٌ عاديّ.
 */
export function vectorRegressed(seen, current) {
  if (!seen) return false;
  for (const [device, seq] of Object.entries(seen)) {
    if (Number(current?.[device] ?? 0) < Number(seq)) return true;
  }
  return false;
}

/**
 * يفحص القاعدةَ النشطة بحثًا عن استبدالٍ وقع تحت المزامنة.
 *
 * @returns {Promise<{replaced: boolean, seen: object|null, current: object, at: number|null}>}
 */
export async function detectReplacement() {
  const current = await withTx('changeLog', 'readonly', (tx) => vectorOf(tx));
  const checkpoint = lastSeenVector();
  return {
    replaced: vectorRegressed(checkpoint?.vector, current),
    seen: checkpoint?.vector ?? null,
    seenAt: checkpoint?.at ?? null,
    current,
  };
}

/**
 * قراراتُ ما بعد الاسترجاع (بند P).
 *
 * ⚠️ **ثلاثةٌ لا اثنان.** «ادمج» و«لا تدمج» تترك أخطرَ حالةٍ بلا جواب:
 *    أن تريد النسخةَ المسترجَعة **على كلّ أجهزتك**. وهي بالضبط سببُ
 *    الاسترجاع حين يكون الخطأُ قد انتشر.
 */
export const AFTER_RESTORE = Object.freeze({
  /** الاسترجاعُ محلّيٌّ فقط: يغادر هذا الجهازُ الكونَ، والباقي لا يُمَسّ. */
  LOCAL_ONLY: 'LOCAL_ONLY',
  /** يُعتمَد على الجميع: كونٌ جديد، وكلُّ جهازٍ **يُسأل** قبل أن يتبنّاه. */
  ADOPT_EVERYWHERE: 'ADOPT_EVERYWHERE',
  /** يُلغى أثرُ الاسترجاع: تعود المزامنةُ وتعود الحالةُ الحديثة بالدمج. */
  RESUME_SYNC: 'RESUME_SYNC',
});

/** وصفٌ عربيٌّ لكلّ قرار — يقرؤه المستخدم لا المطوّر. */
export const AFTER_RESTORE_TEXT = Object.freeze({
  LOCAL_ONLY: {
    label: 'خلّي الاسترجاع على الجهاز ده بس',
    detail: 'الجهاز ده هيخرج من المزامنة. أجهزتك التانية وDrive مش هيتغيّروا.',
  },
  ADOPT_EVERYWHERE: {
    label: 'اعتمد النسخة دي على كل أجهزتي',
    detail: 'هنرفع النسخة المسترجَعة كحالة جديدة، وكل جهاز تاني هيتسأل قبل ما ياخدها — مش هيتغيّر لوحده.',
  },
  RESUME_SYNC: {
    label: 'ألغِ الاسترجاع وكمّل مزامنة',
    detail: 'المزامنة هترجع طبيعي، والحالة الأحدث من أجهزتك هترجع بالدمج.',
  },
});

/**
 * ملخّصٌ يُعرَض قبل القرار — أرقامٌ لا مصطلحات.
 *
 * ⚠️ ولا يُطلَب قرارٌ بلا معلومة: «كام تغيير كان عندي وضاع؟» سؤالٌ
 *    يستحقّ جوابًا قبل أن تختار.
 */
export function replacementSummary({ seen, current, seenAt }) {
  const devices = [...new Set([...Object.keys(seen || {}), ...Object.keys(current || {})])];
  const lost = devices
    .map((device) => ({
      device,
      before: Number(seen?.[device] ?? 0),
      after: Number(current?.[device] ?? 0),
    }))
    .filter((row) => row.after < row.before);

  return {
    seenAt,
    lostChanges: lost.reduce((sum, row) => sum + (row.before - row.after), 0),
    devices: lost,
  };
}

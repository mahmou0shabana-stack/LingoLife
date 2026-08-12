/**
 * LingoLife — عقد الردّ، مُولَّدًا من صيغة الحزمة (الملحق · H5)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ العطب الذي يعالجه هذا الملفّ كان صامتًا
 * ═══════════════════════════════════════════════════════════════
 *
 * `analysis/request.js` كان يكتب شكل الردّ **بيده**:
 *
 * ```js
 * '  "expressions": [{ "text": "Russian", "meaningAr": "...", … }]',
 * ```
 *
 * وهو **نسخةٌ ثانيةٌ من العقد** في ملفٍّ آخر. فلو أُضيف حقلٌ في
 * `package-format.js` غدًا لم يعرفه الطلب، ولو طُلب حقلٌ لا يقرؤه
 * القارئُ ردَّه المحلِّلُ فتجاهله الاستيراد.
 *
 * **والانحراف لا يشتكي منه أحد**: المحلِّل يردّ بما طُلب منه، والقارئ
 * يتجاهل ما لا يعرف، وأنت ترى نتيجةً ناقصةً وتظنّ المحلِّل قصّر.
 *
 * فصار الشكلُ **يُولَّد** من `FIELDS` و`REQUIRED` و`NOT_SUPPORTED`،
 * ومعه اختبارُ ذهابٍ وعودة يبني حزمةً من الشكل المولَّد ويطالب
 * `parsePackage` بأن تقرأ كل حقلٍ فيها.
 *
 * ═══════════════════════════════════════════════════════════════
 * وبالإنجليزيّة — لأن المخاطَب نموذجٌ لا أنت
 * ═══════════════════════════════════════════════════════════════
 *
 * والمصطلحات التقنيّة (`JSON`, `schema`) لا تُترجَم فتلتبس. أمّا ما
 * تقرؤه أنت في الشاشة فعربيٌّ كلُّه.
 */

import {
  SUPPORTED, REQUIRED, FIELDS, NOT_SUPPORTED, PACKAGE_FORMAT_VERSION,
  kindName,
} from '../import/package-format.js';

/**
 * إصدار العقد — **مربوطٌ بصيغة الحزمة لا مستقلٌّ عنها**.
 *
 * ⚠️ رقمٌ ثانٍ يُدار بيدٍ يعني رقمين يفترقان. وهذا العقد ليس شيئًا
 *    غير الحزمة: هو وصفُها للمحلِّل.
 */
export const CONTRACT_VERSION = PACKAGE_FORMAT_VERSION;

/** الأنواع التي تُطلَب في الردّ، مرتَّبةً كما تُنفَّذ. */
export const ASKED_KINDS = Object.freeze(
  Object.entries(SUPPORTED)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([kind]) => kind)
);

/** هل هذا النوع مجموعةٌ أم كائنٌ واحد؟ */
const SINGLE = new Set(['scene', 'eventThread']);

function fieldLine(entry) {
  const value = entry.req ? `<${entry.hint}>` : `<optional — ${entry.hint}>`;
  return `"${entry.name}": "${value}"`;
}

/**
 * شكلُ الردّ كأسطرٍ جاهزةٍ للكتابة داخل الطلب.
 *
 * ⚠️ **ولا يُبنى بـ`JSON.stringify`.** الشكل هنا وصفٌ لا قيمة: فيه
 *    `<optional — …>` وتعليقاتٌ للقارئ، ولو مرّ على مُسلسِلٍ صار
 *    نصًّا يظنّه النموذج قيمةً حرفيّةً فيعيدها كما هي.
 *
 * @param {{omit?: string[]}} options أنواعٌ لا تُطلَب في هذا السياق
 */
export function replyShape({ omit = [] } = {}) {
  const skip = new Set(omit);
  const lines = ['{'];

  for (const kind of ASKED_KINDS) {
    if (skip.has(kind)) continue;
    const fields = FIELDS[kind];
    /*
     * ⚠️ **نوعٌ مدعومٌ بلا حقولٍ مُعلَنة يرمي — لا يُطبَع فارغًا.**
     *
     * أوّل كتابةٍ كانت `FIELDS[kind] || []`، فنوعٌ يُضاف إلى `SUPPORTED`
     *    غدًا كان يطبع `"topics": [{ }]` — سطرًا صحيحَ الشكل فارغَ
     *    المعنى يمرّ على كل اختبار. كشفَه كسرٌ متعمَّد.
     */
    if (!fields?.length) {
      throw new Error(`«${kind}» مدعومٌ في القراءة وبلا حقولٍ في العقد — أضفها في FIELDS`);
    }
    const body = fields.map(fieldLine).join(', ');
    lines.push(SINGLE.has(kind)
      ? `  "${kind}": { ${body} },`
      : `  "${kind}": [{ ${body} }],`);
  }

  // ⚠️ الفاصلة الأخيرة تُشال: `JSON` لا يقبلها، ومثالٌ غير صالحٍ يعلّم
  //    النموذج شكلًا غير صالح.
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  lines.push('}');
  return lines;
}

/**
 * القواعد المشتقّة من العقد — لا المكتوبة بيد.
 *
 * ثلاث مجموعات: **ما هو إلزاميّ** (من `REQUIRED`)، و**ما لا يُرسَل**
 * (من `NOT_SUPPORTED`)، ثم قواعد اللغة والأمانة.
 */
export function contractRules() {
  const required = ASKED_KINDS
    .filter((kind) => (REQUIRED[kind] || []).length)
    .map((kind) => `  · ${kind}: ${REQUIRED[kind].join(', ')}`);

  return [
    'Rules — the app enforces these when reading your reply:',
    '',
    'Required fields (a row missing one of these is dropped with a warning):',
    ...required,
    '',
    'Everything else is optional. Omit what you cannot determine —',
    'an omitted field is fine, an invented one is not.',
    '',
    /*
     * ⚠️ وتُقال أسماءُ ما لا يُستوعَب **صراحةً**. المحلِّل يحبّ أن
     *    يكون كاملًا فيرسل `topics` و`words` وغيرها، والقارئ يتجاهلها
     *    صامتًا — فيضيع جهدُه وتظنّ أنت أن التطبيق استوعبها.
     */
    'Do NOT include these keys — the app has no place to put them yet,',
    'and will list them as skipped:',
    ...Object.entries(NOT_SUPPORTED).map(([kind, why]) => `  · ${kind} — ${why}`),
    '',
    'Language and honesty:',
    '- Write ALL Arabic in EGYPTIAN Arabic (عامية مصرية), not Modern Standard.',
    '- Keep Russian exactly as Russian; never transliterate.',
    '- Do NOT invent facts about the situation. Only work from what is given.',
    '- Do NOT claim the learner has mastered anything.',
    '- The reply is imported into an app that shows the user every row before',
    '  saving, so it is safe to suggest — but never to assert what you are unsure of.',
    '',
    'Return ONLY the JSON object — no prose, no markdown fences.',
  ];
}

/**
 * ما **لا** نطلبه من أي محلِّل — ولكلٍّ سببه.
 *
 * ⚠️ ليست قائمةَ نقص. هي حدودُ ما نأتمن عليه محلِّلًا خارجيًّا، وتُعرَض
 *    في شاشة المكتبة كي يكون الحدُّ مقروءًا لا مضمَرًا.
 */
export const NEVER_ASKED = Object.freeze([
  {
    id: 'mastery',
    label: 'مستوى إتقانك',
    why: 'المرحلة لا يرفعها إلا ضغطةٌ منك (docs/09 §WS5). ومحلِّلٌ يقول «أتقنتَ ده» يكتب حكمًا على تعلُّمك من نصٍّ رآه مرّة.',
  },
  {
    id: 'progress',
    label: 'تقدُّمك ونسبة تحسُّنك',
    why: 'نفس موقف `NOT_MEASURED` في التحليل: رقمٌ بلا تعريفٍ دقيقٍ وبلا سجلٍّ تحته ليس رقمًا — ولا يصير رقمًا لأن نموذجًا قاله.',
  },
  {
    id: 'invented-scene',
    label: 'مواقف لم تحدث',
    why: 'الذكرى واقعةٌ عشتَها. تمرينٌ مؤلَّفٌ يدخل بينها يفسد كل ما يقوم على الوقائع — التحليل، وحياة التعبير، و«خطأ/طبيعي».',
  },
  {
    id: 'corrected-raw',
    label: 'نسخة «مصحّحة» من نصّك الأصلي',
    why: 'الأصل ما قيل بأخطائه، وهو مقفولٌ بأوّل كتابة (docs/15 §١٥٫١). التصحيح كتلةٌ **بجانبه** تكتبها أنت.',
  },
]);

/**
 * كتلة العقد كاملةً — شكلٌ وقواعد.
 *
 * @param {{omit?: string[], intro?: string[]}} options
 */
export function contractBlock({ omit = [], intro = [] } = {}) {
  return [
    ...intro,
    '',
    `Reply with a lingolifeScene package, version ${PACKAGE_FORMAT_VERSION}, shaped like this:`,
    '',
    ...replyShape({ omit }),
    '',
    ...contractRules(),
  ];
}

/** أسماء ما يُطلَب بالعربية — للشاشة. */
export function askedLabels({ omit = [] } = {}) {
  const skip = new Set(omit);
  return ASKED_KINDS.filter((kind) => !skip.has(kind)).map(kindName);
}

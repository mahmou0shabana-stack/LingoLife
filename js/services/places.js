/**
 * LingoLife — «أنا فين، والرجوع هيوَدّيني فين» (WS23)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك بحرفه
 * ═══════════════════════════════════════════════════════════════
 *
 * > «الصفحات دوشة، **ومش عارف فين بيودّي على فين**، إرهاق شديد.»
 *
 * وهذا نصفُ بلاغٍ عن الضجيج ونصفٌ عن **الضياع** — وهما مشكلتان. الضجيج
 * عالجَته `filter-bar` بأن جعلت على الشاشة أقلّ. والضياع لا يُعالَج
 * بالحذف: **يُعالَج بأن تقول الشاشةُ اسمها**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا لم يكفِ ما هو موجود؟ — لأن كلَّ شاشةٍ تسمّي نفسها بنفسها
 * ═══════════════════════════════════════════════════════════════
 *
 * لكلِّ شاشةٍ `<h1>` في أعلى محتواها. وهذا لا يكفي لسببين مقيسين:
 *
 *  1. **يختفي بأوّل تمرير.** المحتوى يتحرّك والقشرة تثبت، فبعد شبرٍ
 *     واحدٍ من التمرير لا يبقى على الشاشة شيءٌ يقول أين أنت.
 *  2. **ولا يقول من أين جئت.** «مختبر التطوّر» عنوانٌ صحيح، لكنه لا
 *     يخبرك أن الرجوع سيعيدك إلى «الذكرى» التي كنتَ تكتب عنها.
 *
 * فالمكان سطران في القشرة: **من أين** فوق، و**أين أنت** تحت. وهما
 * يعيشان في مكانٍ واحدٍ لا يتحرّك أبدًا — راجع `components/place.js`.
 *
 * ═══════════════════════════════════════════════════════════════
 * والسِّجلّ هنا سطرٌ لكلّ شاشة — لا أكثر
 * ═══════════════════════════════════════════════════════════════
 *
 * شاشةٌ تُضاف غدًا تُسمّى بسطرٍ واحدٍ في `PLACES`، ولا تُلمَس القشرة
 * ولا `app.js`. وإن نُسي السطر **يسقط اختبار**: `tests/places.test.js`
 * يقرأ مساراتِ `app.js` من مصدرها ويطالب كلَّ واحدٍ منها باسم.
 *
 * ⚠️ **والاسمُ اسمان.** `name` نوعُ المكان («ذكرى»، «تعبير») و`of()`
 *    اسمُه بعينه («عشا عند أنيا»). الأوّل ثابتٌ يُعرَض فورًا، والثاني
 *    يحتاج قراءةً من القاعدة فيحلّ محلّه حين يصل. ولو تعذّرت القراءة
 *    — سجلٌّ محذوف، معرّفٌ خطأ — يبقى الأوّل. **ولا يرمي شيءٌ هنا
 *    أبدًا**: اسمٌ ناقصٌ في القشرة لا يجوز أن يمنع رسمَ الشاشة.
 */

import {
  scenes, eventThreads, expressions, devIssues, devBriefs, shadowSessions,
} from '../db/repositories.js';
import { formatDate } from '../utils/dates.js';

/**
 * أسماءُ الأماكن.
 *
 * `name` — نوعُ المكان، ثابتٌ ويظهر فورًا.
 * `of(params)` — اسمُه بعينه، يُقرأ من القاعدة (اختياريّ).
 * `home` — البيت: لا رجوعَ منه، وفيه يبقى شعارُ التطبيق مكانَ الاسم.
 */
export const PLACES = {
  '/': { name: 'دلوقتي', home: true },

  /* ---- الحياة ---- */
  '/life': { name: 'حياتي' },
  '/scene/:id': {
    name: 'ذكرى',
    of: async ({ id }) => {
      const scene = await scenes.get(id);
      return scene?.titleAr || scene?.titleRu || '';
    },
  },
  /*
   * ⚠️ **وضعٌ ثانٍ على نفس الذكرى — تجريبيّ** (WS56). له اسمُه في
   *    القشرة لأنه مكانٌ حقيقيٌّ تقف فيه، لا نافذةٌ فوق مكان.
   */
  '/organize/:id': {
    name: 'تنظيم وربط',
    of: async ({ id }) => {
      const scene = await scenes.get(id);
      return scene?.titleAr || scene?.titleRu || '';
    },
  },
  /*
   * ⚠️ **الورشةُ مكانٌ ثالثٌ على نفس الذكرى — تجريبيّة** (WS-F).
   *    ولا تُلغي الوضعَ القديم ولا الصفحةَ القديمة (بند ٧٨).
   */
  '/workspace/:id': {
    name: 'ورشة المحتوى',
    of: async ({ id }) => {
      const scene = await scenes.get(id);
      return scene?.titleAr || scene?.titleRu || '';
    },
  },
  '/threads': { name: 'خيوط الأحداث' },
  '/thread/:id': {
    name: 'خيط',
    of: async ({ id }) => (await eventThreads.get(id))?.title || '',
  },

  /* ---- الزمن ---- */
  '/river': { name: 'النهر' },
  '/day/:date': { name: 'يوم', of: ({ date }) => formatDate(date) },
  '/facets': { name: 'الأوجه' },
  '/constellation': { name: 'الكوكبة' },

  /* ---- اللغة ---- */
  /*
   * ⚠️ **«لغتي» صارت شاشةً أخرى (WS-J) — وهذه سُمّيت بما هي.**
   *    هذه الشاشةُ فهرسُ الذاكرة وأبوابُ التصدير والاستيراد؛ و«لغتي»
   *    هي المستكشفُ الموحَّد. واسمان متطابقان في القشرة يجعلان زرَّ
   *    الرجوع يقول «لغتي» وأنت راجعٌ إلى غيرها.
   */
  '/language': { name: 'ذاكرة اللغة' },
  '/my-language': { name: 'لغتي' },
  /* ⚠️ والمفتاحُ `word:документ:default` — يُعرَض جزؤه الأوسط لا كلُّه. */
  '/my-language/:key': {
    name: 'عنصر لغوي',
    of: ({ key }) => decodeURIComponent(key || '').split(':')[1] || '',
  },
  '/expression/:id': {
    name: 'تعبير',
    of: async ({ id }) => (await expressions.get(id))?.text || '',
  },
  /* ⚠️ الكلمة مُعطاها نصُّها لا معرّفُها — فلا قراءةَ لها من القاعدة. */
  '/word/:text': { name: 'كلمة', of: ({ text }) => text },
  '/shadow/:id': {
    name: 'الظلّ',
    of: async ({ id }) => (await shadowSessions.get(id))?.title || '',
  },
  '/shadow-history': { name: 'كل جلسات الظلّ' },

  /* ---- الأدوات ---- */
  '/search': { name: 'بحث' },
  '/analysis': { name: 'تحليل' },
  '/studio': { name: 'الاستوديو' },
  '/import': { name: 'استيراد' },
  '/prompts': { name: 'مكتبة الطلبات' },
  '/duplicates': { name: 'المكرَّر' },
  '/trash': { name: 'سلة المهملات' },
  '/settings': { name: 'الإعدادات' },

  /* ---- مختبر التطوّر ---- */
  '/dev': { name: 'مختبر التطوّر' },
  '/dev/issue/:id': {
    name: 'ملاحظة',
    of: async ({ id }) => (await devIssues.get(id))?.title || '',
  },
  '/dev/brief/:id': {
    name: 'حزمة تطوير',
    of: async ({ id }) => (await devBriefs.get(id))?.title || '',
  },
};

/**
 * ما لا يُسمّى — **بسببٍ مكتوب**.
 *
 * السجلُّ فارغٌ اليوم عن قصد: كلُّ مسارٍ مسجَّلٍ في `app.js` له اسم.
 * وهو موجودٌ ليبقى الرفضُ **قرارًا مكتوبًا** لا سهوًا؛ فإن جاء غدًا
 * مسارٌ لا يستحقّ اسمًا (شاشةُ تحويلٍ تختفي فورًا مثلًا) يُكتَب هنا
 * بسببه، ويمرّ الاختبار — ولا يمرّ نسيانٌ صامت.
 *
 * @type {Record<string, string>}
 */
export const NOT_A_PLACE = {};

/* ------------------------------------------------------------------ */
/* المطابقة                                                            */
/* ------------------------------------------------------------------ */

/**
 * يحوّل نمطًا (`/scene/:id`) إلى مُطابِقٍ وأسماءِ مُعطياته.
 *
 * ⚠️ يُبنى مرّةً واحدة عند التحميل لا عند كل تنقّل: التنقّل يحدث مئات
 *    المرّات في الجلسة، وبناءُ عشرين `RegExp` في كلّ مرّةٍ عملٌ بلا داعٍ.
 */
const MATCHERS = Object.entries(PLACES).map(([pattern, place]) => {
  const names = [];
  const source = pattern
    .replace(/\/:([^/]+)/g, (_, name) => {
      names.push(name);
      return '/([^/]+)';
    })
    .replace(/\//g, '\\/');
  return { pattern, place, names, regex: new RegExp(`^${source}$`) };
});

/** يطابق مسارًا حقيقيًّا بنمطٍ مسجَّل. */
function matchPlace(path) {
  const clean = (path || '/').split('?')[0];
  for (const entry of MATCHERS) {
    const hit = clean.match(entry.regex);
    if (!hit) continue;
    const params = {};
    entry.names.forEach((name, i) => {
      try {
        params[name] = decodeURIComponent(hit[i + 1]);
      } catch {
        params[name] = hit[i + 1];
      }
    });
    return { ...entry, params };
  }
  return null;
}

/** نوعُ المكان وحده — بلا أيّ قراءةٍ من القاعدة، فيُعرَض فورًا. */
export function placeKind(path) {
  return matchPlace(path)?.place.name || '';
}

/** هل هذا هو البيت؟ (لا رجوعَ منه، وفيه يظهر الشعار) */
export function isHome(path) {
  return Boolean(matchPlace(path)?.place.home);
}

/**
 * الاسمُ الكامل لمكان — نوعُه، واسمُه بعينه إن أمكنت قراءتُه.
 *
 * @param {string} path مسارٌ حقيقيّ مثل `/scene/SC_01H…`
 * @returns {Promise<{kind: string, title: string, label: string}>}
 *          `label` هو ما يُعرَض: الاسمُ بعينه إن وُجد، وإلا النوع.
 */
export async function placeOf(path) {
  const hit = matchPlace(path);
  if (!hit) return { kind: '', title: '', label: '' };

  const kind = hit.place.name;
  let title = '';
  try {
    /*
     * ⚠️ ولا يرمي: سجلٌّ محذوفٌ أو معرّفٌ خطأ يعطيك «ذكرى» بلا اسم —
     *    وهو أصدقُ من شاشةِ خطأٍ في القشرة كلِّها.
     */
    title = (await hit.place.of?.(hit.params)) || '';
  } catch {
    title = '';
  }

  return { kind, title, label: title || kind };
}

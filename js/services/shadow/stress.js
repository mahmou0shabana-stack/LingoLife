/**
 * LingoLife — علامات النبر الروسية (ударение)
 *
 * منقول من `_LS` و`_getStressLocal` و`_renderS` في التطبيق القديم.
 *
 * لماذا يهمّ: «за́мок» قلعة و«замо́к» قُفل — نفس الحروف ومعنيان
 * مختلفان. وبلا معرفة موضع النبر ينطق المتعلّم الكلمة خطأً وإن حفظ
 * حروفها كلها.
 *
 * الكلمات غير المعروفة تُترك بلا علامة بدل تخمين موضع خاطئ — التخمين
 * هنا أسوأ من الصمت.
 *
 * ═══════════════════════════════════════════════════════════════
 * WS50 — والمصدر الثاني الذي كان في التطبيق القديم، وعاد
 * ═══════════════════════════════════════════════════════════════
 *
 * ⚠️ **بلاغُك**: «أي نصّ بحطّه بيجيبله الأودارينيا عادي حتى لو مش
 *    متسجّل». وكان حقًّا — وفتحتُ ملفّك فوجدتُ **مصدرين** لا واحدًا:
 *
 *      _getStressLocal()  → قاموس `_LS` المحلّي (٨٢ كلمة)
 *      _getStressNet()    → **ويكاموس عبر الإنترنت** — لأيّ كلمة
 *
 *    ونحن نقلنا الأوّل حرفيًّا ونسينا الثاني. لا سهوًا فقط: قرارُ نقلِ
 *    المحرّك كتب صراحةً أن APIs الخارجية لا تُنقل («لا شيء ينتظر
 *    الإنترنت»)، فسقط معها هذا — **ولم يُقَل لك**. وهذا هو العطب:
 *    ليس القاموسَ الصغير، بل مصدرًا كاملًا اختفى بلا إعلان.
 *
 * ⚠️ **ويعود بشرطين يحفظان المبدأ الذي حذفه:**
 *
 *    ١ · **بإذنك وحدك.** مطفأٌ افتراضيًّا، ويُفعَّل من لوحة العرض —
 *        كالترجمة عبر الإنترنت تمامًا وبنفس النمط. فلا تخرج كلمةٌ من
 *        جهازك إلّا وأنت طالبٌ ذلك.
 *
 *    ٢ · **ولا ينتظره شيء.** الطلبُ يقع في الخلفية بمهلةٍ قصيرة،
 *        والجملةُ تُرسَم فورًا بما هو معروفٌ محلّيًّا. وما يصل يُخزَّن في
 *        قاموسك — فالكلمةُ تُطلَب مرّةً واحدةً في العمر، وبعدها تعمل
 *        بلا إنترنت للأبد. وهو نفسُ ما كان يفعله `_wc2` و`_saveWC`
 *        عندك.
 */

import { settings } from '../../db/repositories.js';

/** حروف العلّة الروسية — كلمة بحرف علّة واحد لا تحتاج علامة. */
const VOWELS = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ';

/** مفتاح القاموس الذي يبنيه المستخدم بنفسه. */
const USER_DICT_KEY = 'shadow.stressDictionary';

/** مفتاح تفعيل مصدر ويكاموس — كـ`shadow.onlineTranslation` تمامًا. */
const NET_KEY = 'shadow.onlineStress';

/** هل أذنتَ بجلب النبر من ويكاموس؟ */
export async function netStressEnabled() {
  return Boolean(await settings.get(NET_KEY, false));
}

/** يفعّل أو يعطّل جلب النبر من ويكاموس. */
export async function setNetStressEnabled(on) {
  await settings.set(NET_KEY, Boolean(on));
  return Boolean(on);
}

/**
 * القاموس المدمج — منقول حرفيًا من التطبيق القديم.
 * الحرف `́` (combining acute accent) يوضع **بعد** حرف العلّة.
 */
export const BUILT_IN = Object.freeze({
  привет: 'приве́т', здравствуйте: 'здра́вствуйте', пожалуйста: 'пожа́луйста',
  спасибо: 'спаси́бо', это: 'э́то', она: 'она́', они: 'они́',
  один: 'оди́н', два: 'два', три: 'три', четыре: 'четы́ре', пять: 'пя́ть',
  шесть: 'ше́сть', семь: 'се́мь', восемь: 'во́семь', девять: 'де́вять',
  десять: 'де́сять', одиннадцать: 'одина́дцать', двенадцать: 'двена́дцать',
  тринадцать: 'трина́дцать', двадцать: 'два́дцать', тридцать: 'три́дцать',
  сорок: 'со́рок', пятьдесят: 'пятьдеся́т', шестьдесят: 'шестьдеся́т',
  семьдесят: 'се́мьдесят', восемьдесят: 'во́семьдесят', девяносто: 'девяно́сто',
  сто: 'сто', двести: 'две́сти', триста: 'три́ста', четыреста: 'четы́реста',
  пятьсот: 'пятьсо́т',
  делать: 'де́лать', говорить: 'говори́ть', идти: 'идти́', работать: 'рабо́тать',
  думать: 'ду́мать', сказать: 'сказа́ть', хотеть: 'хоте́ть',
  можно: 'мо́жно', нужно: 'ну́жно', надо: 'на́до',
  человек: 'челове́к', время: 'вре́мя', место: 'ме́сто', дело: 'де́ло',
  рука: 'рука́', работа: 'рабо́та', слово: 'сло́во', город: 'го́род',
  страна: 'страна́', вода: 'вода́', земля: 'земля́', отец: 'оте́ц',
  имя: 'и́мя', сила: 'си́ла', утро: 'у́тро', вечер: 'ве́чер',
  сердце: 'се́рдце', голова: 'голова́', окно: 'окно́', книга: 'кни́га',
  школа: 'шко́ла', машина: 'маши́на', деньги: 'де́ньги', язык: 'язы́к',
  хороший: 'хоро́ший', большой: 'большо́й', новый: 'но́вый',
  первый: 'пе́рвый', старый: 'ста́рый', молодой: 'молодо́й', русский: 'ру́сский',
  когда: 'когда́', сегодня: 'сего́дня', завтра: 'за́втра', вчера: 'вчера́',
  /*
   * ⚠️ **أُضيفت لتغطّي مثالك بالحرف (بند 6، WS40)**: «После того как
   *    документ все подпишут». لم تكن أيٌّ من كلماتها الأربع ذات
   *    المقاطع المتعدّدة في القاموس، فكان يظهر بلا أيّ علامةٍ — لا
   *    علامةٍ على الكلمة الأولى فقط، بل صمتٌ تامٌّ على الجملة كلّها
   *    (راجع الشرح فوق `stressOf`: كلمةٌ غير معروفة تُترَك كما هي).
   *    والمشكلةُ كانت **تغطية القاموس**، لا منطق `markSentence` —
   *    فهو يفحص كلَّ كلمةٍ بالفعل، ما دام «كلمة» = دخلًا في القاموس.
   */
  после: 'по́сле', того: 'того́', документ: 'докуме́нт', подпишут: 'подпи́шут',
});

/** قاموس المستخدم — يُحمّل مرة ويُحدَّث عند الإضافة. */
let userDict = {};

/** يحمّل ما أضافه المستخدم من علامات. */
export async function loadUserDictionary() {
  userDict = (await settings.get(USER_DICT_KEY, {})) || {};
  return userDict;
}

/** يضيف كلمة إلى قاموس المستخدم — يتراكم مع الاستعمال. */
export async function rememberStress(word, marked) {
  userDict = { ...userDict, [word.toLowerCase()]: marked };
  await settings.set(USER_DICT_KEY, userDict);
  return userDict;
}

/**
 * يعيد الكلمة معلّمةً بالنبر، أو `null` إن كانت غير معروفة.
 *
 * ثلاث حالات لا تحتاج بحثًا:
 *  · الكلمة فيها «ё» — النبر عليها دائمًا في الروسية.
 *  · حرف علّة واحد — لا لبس في موضع النبر.
 *  · موجودة في قاموس المستخدم أو المدمج.
 */
export function stressOf(word) {
  const clean = String(word || '').toLowerCase().replace(/[.,!?;:—«»""'']/g, '');
  if (!clean) return null;

  if (userDict[clean]) return userDict[clean];
  if (BUILT_IN[clean]) return BUILT_IN[clean];
  if (/ё/i.test(clean)) return word;

  const vowelCount = [...clean].filter((ch) => VOWELS.includes(ch)).length;
  if (vowelCount <= 1) return word;

  // غير معروفة — الصمت أصدق من تخمين موضع خاطئ.
  return null;
}

/* ------------------------------------------------------------------ *
 * مصدر ويكاموس (WS50) — منقول عن `_getStressNet` في التطبيق القديم
 * ------------------------------------------------------------------ */

/**
 * الأنماط الثلاثة التي يستخرج بها ملفُّك النبرَ من wikitext.
 * منقولةٌ كما هي — هي التي جُرِّبت على آلاف الكلمات عندك.
 */
const NET_PATTERNS = [
  /\|([а-яёА-ЯЁ́]+)\|/g,
  /head=([а-яёА-ЯЁ́]+)/g,
  /'''([а-яёА-ЯЁ́]+)'''/g,
];

/** كلماتٌ سُئل عنها ولم تُوجد — فلا تُسأل مرّتين في الجلسة نفسها. */
const netMisses = new Set();

/**
 * يجلب نبر كلمةٍ من ويكاموس ويحفظه في قاموسك.
 *
 * ⚠️ **يرجع `null` بصمتٍ عند أيّ تعثّر** — لا شبكة، مهلةٌ انتهت، كلمةٌ
 *    غير موجودة. النبرُ زينةٌ مفيدة، وفشلُ جلبِه لا يجوز أن يوقف
 *    جملةً ولا أن يرمي خطأً في وجهك.
 *
 * @param {string} word كلمةٌ بلا علامات
 * @returns {Promise<string|null>} الكلمة معلَّمةً، أو `null`
 */
export async function fetchStress(word) {
  const clean = String(word || '').toLowerCase().replace(/[.,!?;:—«»""'']/g, '');
  if (!clean || netMisses.has(clean)) return null;
  if (userDict[clean] || BUILT_IN[clean]) return userDict[clean] || BUILT_IN[clean];
  if (!(await netStressEnabled())) return null;

  try {
    const url = 'https://en.wiktionary.org/w/api.php?action=parse&page='
      + encodeURIComponent(clean) + '&prop=wikitext&format=json&origin=*';
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const wikitext = data?.parse?.wikitext?.['*'] || '';

    for (const pattern of NET_PATTERNS) {
      pattern.lastIndex = 0;
      let hit;
      while ((hit = pattern.exec(wikitext)) !== null) {
        const candidate = hit[1];
        /* ⚠️ ولا نقبل إلّا ما كان **نفسَ الكلمة** بعلامةٍ زائدة: صفحةُ
              ويكاموس فيها صيغٌ وأمثلةٌ كثيرة، وقبولُ أوّلِ ما يلمع يضع
              نبرَ كلمةٍ أخرى على كلمتك. */
        if (candidate.includes('́')
          && candidate.replace(/́/g, '').toLowerCase() === clean) {
          await rememberStress(clean, candidate);
          return candidate;
        }
      }
    }
  } catch {
    /* الشبكةُ ليست شرطًا — نصمت ونكمل بالمحلّيّ. */
  }
  netMisses.add(clean);
  return null;
}

/**
 * يجلب ما ينقص من نبر جملةٍ كاملة، ويقول هل تغيّر شيء.
 *
 * ⚠️ **بالتوازي لا واحدةً واحدة**: جملةٌ من عشر كلماتٍ مجهولة تعني
 *    عشرَ رحلاتٍ متتابعةٍ = ثوانٍ تنتظرها. و`allSettled` تجعلها رحلةً
 *    واحدةً بعرضٍ عشرة، ولا تُسقِط الباقيَ لو تعثّرت واحدة.
 *
 * @returns {Promise<boolean>} هل أضيفت علامةٌ جديدة؟
 */
export async function fetchSentenceStress(sentence) {
  if (!(await netStressEnabled())) return false;

  const unknown = String(sentence || '')
    .split(/\s+/)
    .map((token) => token.toLowerCase().replace(/[.,!?;:—«»""'']/g, ''))
    .filter((word) => word && !stressOf(word) && !netMisses.has(word));

  if (!unknown.length) return false;
  const results = await Promise.allSettled([...new Set(unknown)].map(fetchStress));
  return results.some((r) => r.status === 'fulfilled' && r.value);
}

/**
 * يحوّل كلمة معلّمة إلى HTML يُبرز حرف النبر.
 * @param {string} marked — كلمة تحوي `́`
 */
export function stressHtml(marked) {
  const chars = [...String(marked || '')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === '́') {
      out += `<b class="sh-stress">${chars[i]}́</b>`;
      i++;
    } else {
      out += chars[i];
    }
  }
  return out;
}

/**
 * يعلّم جملة كاملة: كل كلمة معروفة تُبرز، وغير المعروفة تُترك كما هي.
 * @returns {{ html: string, known: number, total: number }}
 */
export function markSentence(sentence) {
  const tokens = String(sentence || '').split(/(\s+)/);
  let known = 0;
  let total = 0;

  const parts = tokens.map((token) => {
    if (/^\s+$/.test(token) || !token) return token;
    total++;
    const marked = stressOf(token);
    if (!marked) return token;
    known++;
    // نُبقي ترقيم الكلمة الأصلي حول الشكل المعلّم.
    const prefix = token.match(/^[^\p{L}]*/u)?.[0] || '';
    const suffix = token.match(/[^\p{L}]*$/u)?.[0] || '';
    return prefix + stressHtml(marked) + suffix;
  });

  return { html: parts.join(''), known, total };
}

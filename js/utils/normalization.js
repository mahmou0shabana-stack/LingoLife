/**
 * LingoLife — تطبيع النصوص للبحث (بند 43)
 *
 * الهدف: أن يجد البحث "ещё" عند كتابة "еще"، و"المطابقة" عند كتابة "مطابقه".
 * تُستخدم أيضًا لبناء `normalizedText` الذي يمنع تكرار التعبيرات.
 */

/** محارف التشكيل العربي. */
const AR_DIACRITICS = /[ً-ْٰـ]/g;

/**
 * علاماتُ النبر الروسيّة — حادّةٌ وثقيلة.
 *
 * ⚠️ **وليست حرفًا بل علامةٌ فوقه**، فحذفُها كحذف تشكيل العربيّة تمامًا
 *    (سطرٌ فوق). ولا يوجد حرفٌ سيريليٌّ مركَّبٌ مع الحادّة في يونيكود،
 *    فـ`NFKC` تتركها منفصلةً ولا تدمجها.
 */
const RU_STRESS = /[̀́]/g;

/**
 * تطبيع الروسية:
 *  - ё → е (المتحدثون يكتبونها بالشكلين)
 *  - إزالة علامة النبر
 *  - أحرف صغيرة
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ علامةُ النبر كانت تصنع كلمتين من كلمة — عطبٌ قِيس
 * ═══════════════════════════════════════════════════════════════
 *
 * قِستُه قبل الإصلاح:
 *
 *     normalize('согласование')   → 'согласование'
 *     normalize('согласова́ние')   → 'согласова́ние'
 *     متساويان؟ **لا**
 *
 * والحرفُ الكبيرُ والترقيمُ و«ё» كانت كلُّها موحَّدةً بالفعل — والنبرُ
 * وحدَه شاذّ. وأثرُه أن الكلمةَ المعلَّمةَ في الرقائق (WS52 ترسمها
 * معلَّمة) تصير **كيانًا ثانيًا** لا يعرف تاريخَ الأوّل: بحثُك عن
 * «согласование» لا يجدها، وذاكرةُ اللغة تعدّها كلمةً جديدةً لم ترَها
 * قطّ. وهو بعينه ما يمنعه بند ٥٣ في WS-C.
 *
 * ⚠️ **والحدُّ المعروف**: صفوفٌ فُهرست قبل هذا السطر بعلامةٍ في نصّها
 *    تحمل رمزًا قديمًا في `searchIndex`. ولذلك بُني «إعادةُ بناء
 *    الفهرس» (بند ٥٦) — والمصدرُ الأصليّ لم يُمَسّ فيُعاد منه.
 */
export function normalizeRussian(text) {
  return (text || '').toLowerCase().replace(RU_STRESS, '').replace(/ё/g, 'е');
}

/**
 * تطبيع العربية:
 *  - إزالة التشكيل والتطويل
 *  - أ/إ/آ → ا
 *  - ى → ي  ·  ة → ه  ·  ؤ/ئ → ء
 */
export function normalizeArabic(text) {
  return (text || '')
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء');
}

/**
 * التطبيع الشامل — يُطبَّق على أي نص قبل الفهرسة أو المقارنة.
 * يوحّد المسافات ويزيل الترقيم ويطبّع العربية والروسية معًا.
 */
export function normalize(text) {
  if (!text) return '';
  let out = String(text).toLowerCase();
  out = out.normalize('NFKC');
  out = normalizeRussian(out);
  out = normalizeArabic(out);
  // ترقيم لاتيني وعربي وروسي
  out = out.replace(/[.,!?;:()[\]{}"'«»—–\-_/\\|@#$%^&*+=~`،؛؟…]/g, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * مسافة تحرير بحدٍّ أعلى: نتوقّف حالما نتجاوزه بدل إكمال المصفوفة.
 *
 * ⚠️ **الحدّ ليس تحسينًا فقط بل جزءٌ من العقد**: ما يتجاوزه يعود
 *    `limit + 1` لا المسافة الحقيقية. فالسؤال المطروح دائمًا «هل
 *    هذان متقاربان؟» لا «كم بينهما بالضبط؟»، والثاني لا يحتاجه أحد.
 *
 * تُستعمَل حيث نقترح تشابهًا: أنواع الأحداث المكرّرة (بند 11)،
 * ومطابقة أسماء الحزمة المستوردة بما عندك. ولذلك تعيش هنا لا في
 * إحداهما — الثانية لا تستورد من الأولى لتأخذ حرفًا مشتركًا.
 */
export function editDistance(a, b, limit = 3) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      best = Math.min(best, row[j]);
    }
    if (best > limit) return limit + 1;
    prev = row;
  }
  return prev[b.length];
}

/** أرقام عربية-هندية إلى لاتينية. */
export function normalizeDigits(text) {
  return (text || '').replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660)
  );
}

/** كلمات وقف — لا فائدة من فهرستها. */
const STOP_WORDS = new Set([
  // عربية
  'في', 'من', 'الى', 'الي', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
  'ان', 'انا', 'كان', 'كانت', 'هو', 'هي', 'ما', 'لا', 'يا', 'او', 'و',
  // روسية
  'и', 'в', 'на', 'с', 'по', 'не', 'что', 'это', 'как', 'а', 'но', 'к', 'у', 'же',
  'из', 'за', 'то', 'о', 'для',
  // إنجليزية
  'the', 'a', 'an', 'of', 'to', 'in', 'is', 'it', 'and', 'or', 'for', 'on', 'at',
]);

/**
 * يقسّم نصًا إلى رموز (tokens) صالحة للفهرسة.
 * يتجاهل الرموز الأقصر من حرفين وكلمات الوقف.
 */
export function tokenize(text) {
  const normalized = normalize(text);
  if (!normalized) return [];
  return [...new Set(
    normalized
      .split(' ')
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
  )];
}

/**
 * هل يطابق النص عبارة البحث؟ (بحث بسيط "يحتوي")
 * للعبارة الدقيقة ضع البحث بين علامتَي اقتباس.
 */
export function matches(haystack, needle) {
  if (!needle) return true;
  const query = needle.trim();

  // بحث بالعبارة الدقيقة
  if (query.length > 1 && query.startsWith('"') && query.endsWith('"')) {
    return normalize(haystack).includes(normalize(query.slice(1, -1)));
  }

  const terms = tokenize(query);
  if (!terms.length) return normalize(haystack).includes(normalize(query));
  const hay = normalize(haystack);
  return terms.every((term) => hay.includes(term));
}

/**
 * LingoLife — سجلّ مزوّدي النطق (WS41، بند 1 وبند 18)
 *
 * مكانٌ واحد يعرف كل مزوّدٍ مسجَّل، ويحلّ «مَن يُستعمَل الآن» حسب
 * ترتيب سقوطٍ مُعَدّ: مفضَّلٌ ← فمزوّدٌ آخر ← فحالةٌ صريحة «غير متاح»
 * (بند 18) — **بلا تبديلٍ صامت** إلى مزوّدٍ قد يكون مكلفًا (سحابيًّا
 * مثلًا) لمجرّد أن الأوّل تعطّل.
 *
 * ⚠️ لا يعرف السجلّ شيئًا عن الشادوينج ولا عن الذاكرة المشتركة —
 *    هذا محضُ فهرسٍ ومحلِّل ترتيب. الربط بمحرّك التشغيل في مكانٍ آخر
 *    (بند 25، الخطوة 4) حتى يبقى قابلًا للاختبار بمعزل.
 */

const providers = new Map();

/** يسجّل مزوّدًا. استدعاءٌ ثانٍ بنفس `id` يستبدل الأوّل. */
export function registerProvider(provider) {
  if (!provider?.id) throw new Error('provider.id مطلوب');
  providers.set(provider.id, provider);
  return provider;
}

export function unregisterProvider(id) {
  providers.delete(id);
}

export function getProvider(id) {
  return providers.get(id) || null;
}

export function listProviders() {
  return [...providers.values()];
}

/** يمسح السجلّ بالكامل — للاختبارات وحدها. */
export function clearRegistry() {
  providers.clear();
}

/**
 * يحلّ أوّل مزوّدٍ متاحٍ فعليًّا من قائمة تفضيلٍ مرتَّبة (بند 18).
 *
 * @param {string[]} orderedIds — معرّفات المزوّدين بترتيب الأفضلية.
 * @returns {Promise<{provider: object, availability: object}|null>}
 *   `null` يعني: كل المفضَّلين تعذَّر الوصول إليهم — على الطالب أن
 *   يعرض حالة «غير متاح» صراحةً، لا أن يخمّن مزوّدًا لم يُطلَب.
 */
export async function resolvePreferredProvider(orderedIds) {
  for (const id of orderedIds || []) {
    const provider = providers.get(id);
    if (!provider) continue;
    const availability = await provider.isAvailable().catch(() => ({
      available: false,
      status: 'error',
      reason: 'تعذّر فحص التوفّر',
    }));
    if (availability.available) return { provider, availability };
  }
  return null;
}

/** حالة كل مزوّدٍ مسجَّل — للوحة الإعدادات (بند 9، 17). */
export async function allAvailability() {
  const list = listProviders();
  const results = await Promise.all(
    list.map(async (provider) => ({
      provider,
      availability: await provider.isAvailable().catch(() => ({
        available: false,
        status: 'error',
        reason: 'تعذّر فحص التوفّر',
      })),
    }))
  );
  return results;
}

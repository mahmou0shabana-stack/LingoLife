/**
 * LingoLife — محوّل المزوّد إلى `speaker`/`canceler` المحرّك (WS41، بند 25 خطوة 4)
 *
 * `playback-controller.js` لا يعرف مزوّدين ولا ذاكرة صوت — يعرف فقط
 * `speaker(text, {rate, voiceName, volume}) => Promise<{ok, reason}>`
 * و`canceler()`. هذا الملفّ هو الجسر: يحلّ مزوّدًا من السجلّ، يستشير
 * الذاكرة المشتركة قبل أي توليد (بند CRITICAL 11-14)، ثم يشغّل الناتج.
 *
 * ⚠️ **لا يلمس `cycle()` ولا أي منطق تقسيمٍ أو تكرار.** هذا حَقنٌ في
 *    نقطة الحقن الموجودة أصلًا (`speaker`/`canceler`) — لا تغييرٌ في
 *    آلة الحالة نفسها (بند 19).
 */

import { getProvider, resolvePreferredProvider } from './registry.js';
import { synthesizeWithCache } from './audio-cache.js';
import { BROWSER_PROVIDER_ID } from './browser-provider.js';

/**
 * @param {{
 *   providerId: string|null,
 *   language?: string,
 *   fallbackOrder?: string[],
 *   onSource?: (info: {providerId: string, cached: boolean, provenance: string}) => void,
 * }} options
 */
export function createTTSSpeaker({
  providerId: initialProviderId = null,
  language = 'ru',
  fallbackOrder = null,
  onSource = () => {},
} = {}) {
  /*
   * ⚠️ **متغيّرٌ لا ثابت — عمدًا.** لوحة «مصدر النطق» (WS41-E) تبدّل
   *    المزوّد أثناء الجلسة عبر `setProviderId()` بلا إعادة بناء
   *    `playback-controller.js` كلّه — فالموضعُ وعدّاد التكرار
   *    والتحديد كلّها تبقى كما هي، لأن المحرّك لا يُلمَس إطلاقًا.
   */
  let providerId = initialProviderId;
  let activeProvider = null;
  let audioEl = null;
  let currentObjectUrl = null;

  /*
   * ══════════ جيلُ الطلب — حارسُ العمل البائت (WS-VC1A · العطب ٣) ══════════
   *
   * ⚠️ **`cancel()` كانت تُلغي ما يُسمَع، لا ما يُولَّد.** وبين السطرين
   *    انتظارٌ طويل: `synthesizeWithCache` قد تستغرق ثوانيَ عند مزوّدٍ
   *    مولِّد (جسرٌ محلّيّ مثلًا). فلو أُلغي النطقُ في تلك الأثناء —
   *    بضغطة تسجيل، أو بكلمةٍ أخرى، أو بمالكِ صوتٍ جديد — مضى التوليدُ
   *    إلى نهايته ثمّ **بدأ التشغيلَ بعد الإلغاء**: صوتُ مرجعٍ ينطلق
   *    والميكروفونُ مفتوح.
   *
   * ⚠️ **ورقمٌ لا رايةٌ منطقيّة**: `cancelled = true` تصلح لطلبٍ واحد،
   *    ومع طلبين متتابعين يُلغي الثاني رايةَ الأوّل فيعود الأوّلُ حيًّا.
   *    والرقمُ يتزايد، فكلُّ طلبٍ يعرف جيلَه ولا يخلطه بجيل غيره.
   *
   * ⚠️ **ويُفحَص بعد كلّ انتظار** لا مرّةً واحدة: حلُّ المزوّد انتظارٌ
   *    أيضًا، والإلغاءُ قد يقع فيه.
   */
  let generation = 0;

  async function resolveActiveProvider() {
    if (providerId) {
      const direct = getProvider(providerId);
      if (direct) {
        const availability = await direct.isAvailable().catch(() => ({ available: false }));
        if (availability.available) return direct;
      }
    }
    const order = fallbackOrder || [providerId, BROWSER_PROVIDER_ID].filter(Boolean);
    const resolved = await resolvePreferredProvider(order);
    return resolved?.provider || null;
  }

  function playBlob(blob, rate, volume) {
    return new Promise((resolve) => {
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.setAttribute('playsinline', '');
      }
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = URL.createObjectURL(blob);
      audioEl.src = currentObjectUrl;
      audioEl.playbackRate = Math.max(0.25, Math.min(4, rate || 1));
      audioEl.volume = Math.max(0, Math.min(1, volume ?? 1));

      const done = (ok, reason) => {
        audioEl.onended = null;
        audioEl.onerror = null;
        resolve({ ok, reason });
      };
      audioEl.onended = () => done(true);
      audioEl.onerror = () => done(false, 'playback-error');
      audioEl.play().catch(() => done(false, 'playback-blocked'));
    });
  }

  async function speak(text, { rate, voiceName = null, volume = 1 } = {}) {
    /*
     * ⚠️ **وطلبٌ جديدٌ يُبطل ما قبله بحكم التعريف**: العنصرُ واحدٌ
     *    و`speechSynthesis` واحد، فنطقان معًا مستحيلان أصلًا. والرقمُ
     *    يجعل ذلك **معلومًا** للطلب القديم بدل أن يكتشفه بالتصادم.
     */
    const myGeneration = ++generation;
    const stale = () => myGeneration !== generation;

    const provider = await resolveActiveProvider();
    if (stale()) return { ok: false, reason: 'aborted' };
    activeProvider = provider;
    if (!provider) return { ok: false, reason: 'no-provider-available' };

    if (provider.id === BROWSER_PROVIDER_ID) {
      /*
       * ⚠️ **ولا فحصَ بعد هذا الانتظار**: `speechSynthesis` ينطق بنفسه
       *    ويُلغى بنفسه (`cancel()` أدناه تصل إليه عبر `provider.cancel`)،
       *    فالوعدُ لا يعود إلّا وقد انتهى النطقُ أو أُلغي. لا شيءَ
       *    يبدأ **بعد** عودته حتّى يُحرَس.
       */
      const result = await provider.synthesize({ text, language, voiceId: voiceName, speed: rate, volume });
      onSource({ providerId: provider.id, cached: false, provenance: result.provenance });
      return { ok: !result.error, reason: result.error || undefined };
    }

    // مزوّدٌ يُنتج ملفًّا: الذاكرة أوّلًا — بلا توليدٍ إن وُجد (CRITICAL).
    const { blob, provenance, cached, error } = await synthesizeWithCache({
      provider, text, language, voiceId: voiceName, speed: rate,
    });
    /*
     * ⚠️ **وهنا بيتُ القصيد**: التوليدُ انتهى، والإلغاءُ وقع أثناءه.
     *    فيُرمى الناتجُ (وقد خُزِّن في الذاكرة فلا يضيع عملُه) ولا
     *    يُشغَّل. بلا هذا السطر يبدأ الصوتُ بعد أن فُتح الميكروفون.
     */
    if (stale()) return { ok: false, reason: 'aborted' };
    if (error) return { ok: false, reason: error };
    if (!blob) return { ok: false, reason: 'no-audio' };

    onSource({ providerId: provider.id, cached, provenance });
    return playBlob(blob, rate, volume);
  }

  function cancel() {
    /* ⚠️ الرقمُ أوّلًا: ما ينتظر الآن يجد نفسَه بائتًا حين يعود. */
    generation += 1;
    activeProvider?.cancel?.();
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
  }

  /** يبدّل المزوّد المفضَّل — للوحة «مصدر النطق» (WS41-E) أثناء الجلسة. */
  function setProviderId(id) {
    providerId = id;
  }

  function getProviderId() {
    return providerId;
  }

  return { speak, cancel, setProviderId, getProviderId };
}

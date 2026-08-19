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
    const provider = await resolveActiveProvider();
    activeProvider = provider;
    if (!provider) return { ok: false, reason: 'no-provider-available' };

    if (provider.id === BROWSER_PROVIDER_ID) {
      const result = await provider.synthesize({ text, language, voiceId: voiceName, speed: rate, volume });
      onSource({ providerId: provider.id, cached: false, provenance: result.provenance });
      return { ok: !result.error, reason: result.error || undefined };
    }

    // مزوّدٌ يُنتج ملفًّا: الذاكرة أوّلًا — بلا توليدٍ إن وُجد (CRITICAL).
    const { blob, provenance, cached, error } = await synthesizeWithCache({
      provider, text, language, voiceId: voiceName, speed: rate,
    });
    if (error) return { ok: false, reason: error };
    if (!blob) return { ok: false, reason: 'no-audio' };

    onSource({ providerId: provider.id, cached, provenance });
    return playBlob(blob, rate, volume);
  }

  function cancel() {
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

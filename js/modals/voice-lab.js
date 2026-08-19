/**
 * LingoLife — مختبر الأصوات A/B/C (WS41-E، بند 10)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «واجهةُ تطويرٍ صغيرة تقارن جودة أصوات روسيّة: تكتب جملةً واحدة،
 * >  تختار مزوّدًا/صوتًا لكلٍّ من A وB وC، تولّد/تشغّل كلًّا، وتقارن
 * >  بسرعة. ليست ميزةً دائمةً في التنقّل الرئيسيّ الآن — قد تعيش
 * >  داخل أدوات المطوّر/إعدادات الصوت مبدئيًّا.»
 *
 * ⚠️ **لا زرّ تشغيلٍ ميّت.** كلُّ مزوّدٍ في القائمة يحمل حالته
 *    الصادقة من `isAvailable()` الحقيقية — لا افتراضًا متفائلًا.
 *
 * ⚠️ **نفس الذاكرة المشتركة.** التشغيل هنا يمرّ من `synthesizeWithCache`
 *    — نفس الدالّة التي يمرّ منها محرّك الشادوينج — فمقارنةُ نفس
 *    الجملة بنفس المزوّد مرّتين لا تُولِّد إلا مرّةً واحدة (بند CRITICAL).
 */

import { html, raw, esc } from '../utils/dom.js';
import { showModal } from '../components/modal.js';
import { toastError } from '../components/toast.js';
import { ensureTTSProvidersRegistered } from '../services/shadow/tts/bootstrap.js';
import { getProvider, allAvailability } from '../services/shadow/tts/registry.js';
import { synthesizeWithCache } from '../services/shadow/tts/audio-cache.js';
import { claimAudio, releaseAudio } from '../services/shadow/audio-bus.js';
import { PROVIDER_TYPE } from '../services/shadow/tts/types.js';

const EXAMPLE_SENTENCE =
  'После того как документ все подпишут, мне необходимо подготовить план устранения замечаний.';
const ROWS = ['A', 'B', 'C'];
const AUDIO_OWNER = 'voice-lab';

export async function openVoiceLab() {
  ensureTTSProvidersRegistered();
  const availability = await allAvailability();
  if (!availability.length) return toastError('مفيش مزوّد نطق مسجَّل أصلًا');

  let audioEl = null;

  const providerOptions = (selected) => availability.map(({ provider, availability: a }) => `
    <option value="${esc(provider.id)}" ${!a.available ? 'disabled' : ''} ${provider.id === selected ? 'selected' : ''}>
      ${esc(provider.name)}${a.available ? '' : ` — ${esc(a.reason || 'غير متاح')}`}
    </option>`).join('');

  await showModal({
    title: 'مختبر الأصوات — A/B/C',
    wide: true,
    actions: [{ label: 'قفل', value: null, variant: 'ghost' }],
    body: html`
      <p class="text-soft text-sm" style="margin-bottom:var(--sp-3);line-height:1.8">
        قارِن جودةَ نطق أكثر من مزوّدٍ لنفس الجملة — أداةُ تطويرٍ، لا جزءٌ من التدريب العاديّ.
      </p>
      <div class="field">
        <textarea data-vl-text dir="ltr" lang="ru" rows="3"
          style="font-size:15px;line-height:1.8">${EXAMPLE_SENTENCE}</textarea>
      </div>
      ${raw(ROWS.map((row, i) => html`
        <div class="field" data-vl-row="${row}"
          style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;padding:8px;border:1px solid var(--line,#e5e5e5);border-radius:8px">
          <b style="min-width:1.2em">${row}</b>
          <select data-vl-provider="${row}" style="flex:1;min-width:140px">
            ${raw(providerOptions(availability[Math.min(i, availability.length - 1)]?.provider.id))}
          </select>
          <select data-vl-voice="${row}" style="flex:1;min-width:120px"><option value="">أوّل صوتٍ متاح</option></select>
          <button type="button" data-vl-play="${row}" class="btn btn-ghost">شغّل ▶</button>
          <span class="field-hint" data-vl-status="${row}" style="width:100%"></span>
        </div>`).join(''))}
    `,
    async onMount(modal) {
      async function fillVoices(row) {
        const providerSelect = modal.querySelector(`[data-vl-provider="${row}"]`);
        const voiceSelect = modal.querySelector(`[data-vl-voice="${row}"]`);
        const status = modal.querySelector(`[data-vl-status="${row}"]`);
        const provider = getProvider(providerSelect.value);
        voiceSelect.innerHTML = '<option value="">…</option>';
        if (!provider) return;
        try {
          const voices = await provider.getVoices();
          voiceSelect.innerHTML = `<option value="">أوّل صوتٍ متاح</option>${voices
            .map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`)
            .join('')}`;
        } catch {
          status.textContent = 'تعذّر جلب قائمة الأصوات';
        }
      }

      ROWS.forEach((row) => {
        modal.querySelector(`[data-vl-provider="${row}"]`)
          .addEventListener('change', () => fillVoices(row));
        fillVoices(row);

        modal.querySelector(`[data-vl-play="${row}"]`).addEventListener('click', async () => {
          const text = modal.querySelector('[data-vl-text]').value.trim();
          const status = modal.querySelector(`[data-vl-status="${row}"]`);
          if (!text) return toastError('اكتب جملةً أوّلًا');

          const providerId = modal.querySelector(`[data-vl-provider="${row}"]`).value;
          const voiceId = modal.querySelector(`[data-vl-voice="${row}"]`).value || null;
          const provider = getProvider(providerId);
          if (!provider) { status.textContent = 'مزوّدٌ غير متاح'; return; }

          status.textContent = 'بيولّد…';
          try {
            if (provider.type === PROVIDER_TYPE.BROWSER) {
              /* ⚠️ ينطق مباشرةً — لا `audioBlob` يُشغَّل هنا (راجع browser-provider.js). */
              claimAudio(AUDIO_OWNER, () => provider.cancel());
              const result = await provider.synthesize({ text, language: 'ru', voiceId, speed: 1 });
              releaseAudio(AUDIO_OWNER);
              status.textContent = result.error ? `فشل: ${result.error}` : 'نطق مباشرةً (بلا تخزين)';
              return;
            }

            const { blob, provenance, cached, error } = await synthesizeWithCache({
              provider, text, language: 'ru', voiceId, speed: 1,
            });
            if (error) { status.textContent = `فشل: ${error}`; return; }
            if (!blob) { status.textContent = 'مفيش صوتٌ ناتج'; return; }

            if (!audioEl) { audioEl = new Audio(); audioEl.setAttribute('playsinline', ''); }
            claimAudio(AUDIO_OWNER, () => audioEl.pause());
            audioEl.src = URL.createObjectURL(blob);
            await audioEl.play().catch(() => {});
            status.textContent = `${cached ? 'من الذاكرة — بلا توليدٍ جديد' : 'وُلِّد الآن'} · ${provenance}`;
          } catch (err) {
            status.textContent = `فشل: ${err.message || err}`;
          }
        });
      });
    },
  });

  releaseAudio(AUDIO_OWNER);
  if (audioEl) {
    audioEl.pause();
    audioEl.src = '';
  }
}

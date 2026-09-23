/**
 * LingoLife — Voice Center V1.0C · لوحةُ الصوت السريعة في شاشة الظلّ
 *
 * ⚠️ **تُركَّب الشاشةُ الحقيقيّة** (`renderShadow`) على جلسةٍ حقيقيّةٍ في
 *    قاعدة جهازٍ معزول، وتُضغَط الأزرارُ وتُسحَب المنزلقات — ولا يُقرأ
 *    مصدرٌ. وناطقُ المتصفّح محقونٌ يسجّل سرعةَ كلّ جملةٍ وصوتَها
 *    وارتفاعَها، فيُعرَف أنّ التغييرَ **وصل إلى ما يُسمَع** لا أنّه كُتب.
 */

import { describe, it, expect } from './test-runner.js';
import { resetDevices, on, TABLET } from './sync-devices.js';

const until = async (check, ms = 5000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('انتهت المهلة');
    await new Promise((r) => setTimeout(r, 20));
  }
};

/** ناطقٌ بديلٌ بصوتين مسمّيين — يسجّل ما طُلب ولا يُصدر صوتًا. */
function stubSpeech() {
  const spoken = [];
  const voices = [
    { name: 'Milena', lang: 'ru-RU', default: false, voiceURI: 'Milena', localService: true },
    { name: 'Yuri', lang: 'ru-RU', default: false, voiceURI: 'Yuri', localService: true },
  ];
  class U extends EventTarget {
    constructor(t) { super(); this.text = t; this.rate = 1; this.voice = null; this.volume = 1; }
  }
  const saved = {
    synth: Object.getOwnPropertyDescriptor(window, 'speechSynthesis'),
    utter: Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance'),
  };
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: U, configurable: true });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      speak(u) {
        spoken.push({ rate: u.rate, voice: u.voice?.name || null, volume: u.volume });
        u.onstart?.({});
        setTimeout(() => { u.onend?.({}); u.dispatchEvent(new Event('end')); }, 120);
      },
      cancel() {}, pause() {}, resume() {},
      speaking: false, paused: false, pending: false,
      addEventListener() {}, removeEventListener() {}, onvoiceschanged: null,
    },
  });
  const restore = () => {
    for (const [key, d] of [['speechSynthesis', saved.synth], ['SpeechSynthesisUtterance', saved.utter]]) {
      if (d) Object.defineProperty(window, key, d);
      else delete window[key];
    }
  };
  return { spoken, restore };
}

/** يركّب الشاشةَ على جلسةٍ جديدة — ويعيد أدواتِ القياس ومفكِّكَها. */
async function mountShadow() {
  const speech = stubSpeech();
  await resetDevices([TABLET]);
  await on(TABLET, () => {});
  const { createSession, SOURCE_TYPE } = await import('../js/services/shadow/shadow-session-service.js');
  const { session } = await createSession({
    sourceType: SOURCE_TYPE.SELECTION,
    text: 'Нам нужно перейти к документации.\nЗаказ готов.',
    settings: { speed: 0.8, repeatCount: 5, volume: 1, voiceId: 'Milena' },
  });
  const view = await import('../js/views/shadow-view.js');
  const main = document.createElement('main');
  main.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none';
  document.body.append(main);
  await view.renderShadow(main, session.id);
  await until(() => main.querySelector('[data-sh="qv"]'));
  const $ = (sel) => main.querySelector(sel);
  const dispose = () => {
    try { view.disposeShadow(); } catch { /* الشاشةُ ماتت أصلًا */ }
    main.remove();
    speech.restore();
  };
  return { main, $, session, speech, dispose };
}

/** يسحب منزلقًا كما يسحبه الإصبع: `input` مع الحركة ثمّ `change` عند الرفع. */
function drag(range, value) {
  range.value = String(value);
  range.dispatchEvent(new Event('input', { bubbles: true }));
  range.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Voice Center V1.0C · لوحةُ الصوت السريعة', () => {
  it('١ · تُفتَح وتُغلَق: بزرّها، وبلمسةٍ خارجها، وبـEscape، وبرابط المتقدّم', async () => {
    const t = await mountShadow();
    try {
      const btn = t.$('[data-sh="qv"]');
      const pop = () => document.querySelector('.sh-qv-pop');
      expect(`مغلقةٌ أوّلًا: ${!pop()} · ${btn.getAttribute('aria-expanded')}`).toBe('مغلقةٌ أوّلًا: true · false');

      /* ⚠️ الزرُّ داخل صفّ التشغيل وبعد الميكروفون — ولا يُزاحمه. */
      expect(`بعد الميكروفون: ${btn.previousElementSibling?.classList.contains('sh-rec-btn')}`)
        .toBe('بعد الميكروفون: true');

      btn.click();
      expect(`فُتحت: ${!!pop()} · ${btn.getAttribute('aria-expanded')}`).toBe('فُتحت: true · true');
      /* ستّةُ عناصرَ لا غير: المصدر، والصوت، والسرعة، والارتفاع، والتكرار، والمتقدّم. */
      expect([...pop().querySelectorAll('select, input, button')].map((n) => n.dataset.sh || n.dataset.tuneRange))
        .toEqual(['qv-provider', 'voice-select', 'speed', 'volume', 'repeat', 'qv-advanced']);
      btn.click();
      expect(`زرُّها يغلقها: ${!pop()}`).toBe('زرُّها يغلقها: true');

      btn.click();
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(`لمسةٌ خارجها: ${!pop()} · ${btn.getAttribute('aria-expanded')}`).toBe('لمسةٌ خارجها: true · false');

      btn.click();
      pop().querySelector('select').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(`لمسةٌ داخلها لا تغلقها: ${!!pop()}`).toBe('لمسةٌ داخلها لا تغلقها: true');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(`Escape: ${!pop()}`).toBe('Escape: true');

      btn.click();
      pop().querySelector('[data-sh="qv-advanced"]').click();
      const drawer = t.$('[data-drawer]');
      expect(`المتقدّم: اللوحةُ ${pop() ? 'باقية' : 'أُغلقت'} · المركزُ ${drawer.hidden ? 'مغلق' : 'مفتوح'} · المتقدّمُ ${drawer.querySelector('.sh-cc-adv')?.open ? 'مفتوح' : 'مطويّ'}`)
        .toBe('المتقدّم: اللوحةُ أُغلقت · المركزُ مفتوح · المتقدّمُ مفتوح');
    } finally {
      t.dispose();
    }
    expect(`تموت مع الشاشة: ${!document.querySelector('.sh-qv-pop')}`).toBe('تموت مع الشاشة: true');
  });

  it('٢ · ضبطُها يصل إلى ما يُسمَع فورًا، ويُحفَظ في حقول الجلسة نفسِها', async () => {
    const t = await mountShadow();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      /* تُرسَم من الجلسة لا من افتراض. */
      expect([...pop.querySelectorAll('[data-qv-val]')].map((n) => n.textContent))
        .toEqual(['0.8x', '100%', '×5']);
      /*
       * ⚠️ **وقائمةُ أصوات الجهاز تُخزَّن مرّةً للصفحة كلِّها** (`loadVoices`)
       *    — ففي التشغيل الكامل تحمل ما حمّله اختبارٌ سبق، لا ناطقَنا. فلا
       *    يُفترَض أنّ «Yuri» فيها: يُقرأ ما فيها، وإن غاب يُضاف خيارُه إلى
       *    المنتقيَين كما يضيفه جهازٌ نزّل الصوت، ويُنتظَر من النطق ما
       *    يحلّه المحرّكُ فعلًا (الاسم إن عرفه، وإلّا الافتراضيّ).
       */
      const { listVoices } = await import('../js/services/shadow/tts-controller.js');
      const known = (await listVoices()).all.map((v) => v.name);
      const voice = pop.querySelector('[data-sh="voice-select"]');
      expect(voice.value).toBe(known.includes('Milena') ? 'Milena' : '');
      const drawerVoice = t.$('[data-drawer] [data-sh="voice-select"]');
      for (const select of [voice, drawerVoice]) {
        if (![...select.options].some((o) => o.value === 'Yuri')) select.append(new Option('Yuri', 'Yuri'));
      }

      t.$('[data-sh="play"]').click();
      await until(() => t.speech.spoken.length >= 1);

      drag(pop.querySelector('[data-tune-range="speed"]'), 1.2);
      drag(pop.querySelector('[data-tune-range="volume"]'), 40);
      drag(pop.querySelector('[data-tune-range="repeat"]'), 7);
      voice.value = 'Yuri';
      voice.dispatchEvent(new Event('change', { bubbles: true }));

      /* ⚠️ والجلسةُ ما زالت تنطق — فالجملةُ التالية تحمل الجديد. */
      const before = t.speech.spoken.length;
      await until(() => t.speech.spoken.length > before);
      const last = t.speech.spoken[t.speech.spoken.length - 1];
      const heard = known.includes('Yuri') ? 'Yuri' : null;
      expect(`يُسمَع: ${last.rate} · ${last.voice} · ${last.volume}`).toBe(`يُسمَع: 1.2 · ${heard} · 0.4`);
      expect([...pop.querySelectorAll('[data-qv-val]')].map((n) => n.textContent))
        .toEqual(['1.2x', '40%', '×7']);
      t.$('[data-sh="play"]').click();

      /* ⚠️ **ولا مخزنَ ثانيًا**: نفسُ حقول الجلسة التي يكتبها مركزُ التدريب. */
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions } = await import('../js/db/repositories.js');
      const row = await shadowSessions.get(t.session.id);
      expect({ speed: row.speed, volume: row.volume, repeatCount: row.repeatCount, voiceId: row.voiceId })
        .toEqual({ speed: 1.2, volume: 0.4, repeatCount: 7, voiceId: 'Yuri' });
      expect(row.voiceByProvider).toEqual({ browser: 'Yuri' });

      /* ومركزُ التدريب يتبعها — ضابطٌ واحدٌ ببابين. */
      const drawer = t.$('[data-drawer]');
      expect([
        drawer.querySelector('[data-tune-range="speed"]').value,
        drawer.querySelector('[data-tune-range="volume"]').value,
        drawer.querySelector('[data-tune-range="repeat"]').value,
        drawer.querySelector('[data-sh="voice-select"]').value,
      ]).toEqual(['1.2', '40', '7', 'Yuri']);

      /*
       * وتُفتَح ثانيةً على ما اختير — لا على الصوت الأوّل. (تُرسَم من
       * قائمة الجهاز، فالاسمُ يظهر إن كان فيها؛ وإلّا فلا يظهر القديمُ.)
       */
      t.$('[data-sh="qv"]').click();
      t.$('[data-sh="qv"]').click();
      expect(document.querySelector('.sh-qv-pop [data-sh="voice-select"]').value)
        .toBe(known.includes('Yuri') ? 'Yuri' : '');
    } finally {
      t.dispose();
    }
  });

  it('٣ · ولا تنازعُ على الناقل: اللوحةُ لا تطالب ولا تحرّر، والجلسةُ تبقى تنطق', async () => {
    const t = await mountShadow();
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const changes = [];
    const unwatch = bus.watchAudio((owner) => changes.push(owner));
    try {
      t.$('[data-sh="play"]').click();
      await until(() => t.speech.spoken.length >= 1);
      expect(`المالك: ${bus.audioOwner()}`).toBe('المالك: session');
      changes.length = 0;

      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      drag(pop.querySelector('[data-tune-range="speed"]'), 1);
      drag(pop.querySelector('[data-tune-range="volume"]'), 70);
      drag(pop.querySelector('[data-tune-range="repeat"]'), 3);
      const voice = pop.querySelector('[data-sh="voice-select"]');
      voice.value = 'Yuri';
      voice.dispatchEvent(new Event('change', { bubbles: true }));
      t.$('[data-sh="qv"]').click();

      const before = t.speech.spoken.length;
      await until(() => t.speech.spoken.length > before);
      expect(`تبدّلُ المالك: ${changes.length ? changes.join(',') : 'لا شيء'}`).toBe('تبدّلُ المالك: لا شيء');
      expect(`ما زال: ${bus.audioOwner()} · يعمل: ${t.$('[data-sh="play"]').classList.contains('on')}`)
        .toBe('ما زال: session · يعمل: true');
    } finally {
      unwatch();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });
});

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
        spoken.push({ text: u.text, rate: u.rate, voice: u.voice?.name || null, volume: u.volume });
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
async function mountShadow({ provider = null } = {}) {
  const speech = stubSpeech();
  const registry = await import('../js/services/shadow/tts/registry.js');
  if (provider) registry.registerProvider(provider);
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
    /*
     * ⚠️ **يُوقَف التدريبُ قبل المغادرة.** الشاشةُ تُبقي جلسةً تنطق حيّةً
     *    بعد مغادرتها (الشريطُ العائم) — وهذا مقصود. لكنّه في الاختبار
     *    يعني محرّكًا من اختبارٍ سابقٍ ينطق في ناطق الاختبار التالي:
     *    هكذا سقط ٦ في التشغيل الكامل («نُطق: 1» بلا أيّ ضغطة).
     */
    const play = $('[data-sh="play"]');
    if (play?.classList.contains('on')) play.click();
    try { view.disposeShadow(); } catch { /* الشاشةُ ماتت أصلًا */ }
    main.remove();
    speech.restore();
    if (provider) registry.unregisterProvider(provider.id);
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
      /* ستّةُ عناصرَ لا غير: المصدر، والصوت (وتجربتُه بجانبه)، والسرعة، والارتفاع، والتكرار، والمتقدّم. */
      expect([...pop().querySelectorAll('select, input, button')].map((n) => n.dataset.sh || n.dataset.tuneRange))
        .toEqual(['qv-provider', 'voice-select', 'qv-preview', 'speed', 'volume', 'repeat', 'qv-advanced']);
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

/** مزوّدٌ محقونٌ يسجّل ما طُلب منه — ويعيد صمتًا قصيرًا حقيقيًّا يُشغَّل. */
function fakeProvider(id) {
  const calls = [];
  const wav = () => {
    const n = 8000 * 0.2;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i += 1) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    return new Blob([buf], { type: 'audio/wav' });
  };
  return {
    calls,
    provider: {
      id, name: 'مزوّد الاختبار', type: 'piper',
      supportsOffline: true, supportsStreaming: false,
      supportsWord: true, supportsSentence: true, supportsLongText: true,
      async isAvailable() { return { available: true, status: 'ready_offline', reason: '' }; },
      async getVoices() { return []; },
      async synthesize({ text, voiceId, speed }) {
        calls.push({ text, voiceId, speed });
        return {
          audioBlob: wav(), audioUrl: null, playedDirectly: false, duration: 0.2,
          provider: id, voiceId, cacheKey: null,
          provenance: 'piper_generated', cached: false, error: null,
        };
      },
      cancel() {},
    },
  };
}

/** يختار صوتًا في منتقي اللوحة — ويضيف خيارَه إن لم يكن في قائمة الجهاز. */
function chooseVoice(pop, name) {
  const select = pop.querySelector('[data-sh="voice-select"]');
  if (![...select.options].some((o) => o.value === name)) select.append(new Option(name, name));
  select.value = name;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Voice Center V1.0C · «جرّب الصوت» في اللوحة السريعة', () => {
  it('٤ · التجربةُ بالصوت المختار — وتغييرُه يصل إلى التجربة التالية فورًا', async () => {
    /*
     * ⚠️ **يُقاس عند المزوّد لا عند الأذن.** قائمةُ أصوات المتصفّح تُخزَّن
     *    مرّةً للصفحة، فاسمُ الصوت المسموع يتبع ما حمّله اختبارٌ سبق. أمّا
     *    المزوّدُ المحقونُ فيتلقّى `voiceId` كما طلبته الشاشةُ بالحرف.
     */
    const fake = fakeProvider('qv-fake');
    const t = await mountShadow({ provider: fake.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      const providerSelect = pop.querySelector('[data-sh="qv-provider"]');
      providerSelect.value = 'qv-fake';
      providerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      chooseVoice(pop, 'Yuri');

      /* السطرُ يقول المزوّدَ والصوتَ والتوفّر — ممّا قاله المزوّدُ نفسُه. */
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد الاختبار · Yuri · متاح');

      pop.querySelector('[data-sh="qv-preview"]').click();
      await until(() => fake.calls.length >= 1);
      expect(fake.calls[0]).toEqual({ text: 'Привет! Так звучит этот голос.', voiceId: 'Yuri', speed: 0.8 });
      await until(() => pop.querySelector('[data-sh="qv-preview"]').textContent === '▶');

      chooseVoice(pop, 'Milena');
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد الاختبار · Milena · متاح');
      pop.querySelector('[data-sh="qv-preview"]').click();
      await until(() => fake.calls.length >= 2);
      expect(`التجربةُ الثانية بـ ${fake.calls[1].voiceId}`).toBe('التجربةُ الثانية بـ Milena');
    } finally {
      t.dispose();
    }
  });

  it('٥ · ولا تتنازع مع التدريب: تطالب بالناقل فيقف، وتحرّره عند انتهائها أو إيقافها', async () => {
    const t = await mountShadow();
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="play"]').click();
      await until(() => t.speech.spoken.length >= 1);
      expect(`قبل: ${bus.audioOwner()}`).toBe('قبل: session');

      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      const tryBtn = pop.querySelector('[data-sh="qv-preview"]');
      const from = t.speech.spoken.length;
      tryBtn.click();
      expect(`أثناءها: ${bus.audioOwner()} · التدريبُ ${t.$('[data-sh="play"]').classList.contains('on') ? 'يعمل' : 'واقف'} · ${tryBtn.textContent}`)
        .toBe('أثناءها: speak · التدريبُ واقف · ■');

      /* ⚠️ لا صوتان معًا: كلُّ ما قيل بعد الضغطة هو التجربةُ وحدَها. */
      await until(() => tryBtn.textContent === '▶');
      const after = t.speech.spoken.slice(from).map((u) => u.text);
      expect(after).toEqual(['Привет! Так звучит этот голос.']);
      expect(`بعدها: ${bus.audioOwner() ?? 'لا مالك'}`).toBe('بعدها: لا مالك');

      /* والإيقافُ من نفس الزرّ هو إسكاتُ الناقل الموجود. */
      tryBtn.click();
      expect(bus.audioOwner()).toBe('speak');
      tryBtn.click();
      expect(`أُوقفت: ${bus.audioOwner() ?? 'لا مالك'} · ${tryBtn.textContent}`).toBe('أُوقفت: لا مالك · ▶');

      /* وإغلاقُ اللوحة أثناءها يوقفها كذلك. */
      tryBtn.click();
      t.$('[data-sh="qv"]').click();
      expect(`أُغلقت أثناءها: ${bus.audioOwner() ?? 'لا مالك'}`).toBe('أُغلقت أثناءها: لا مالك');

      /* والتدريبُ يعود بزرّه ومالكِه. */
      t.$('[data-sh="play"]').click();
      expect(`ثمّ: ${bus.audioOwner()}`).toBe('ثمّ: session');
    } finally {
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٦ · وبلا تجربةٍ لا يتغيّر شيء: لا نطقَ عند الفتح، ولا مالكَ، والزرُّ ساكن', async () => {
    const t = await mountShadow();
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const changes = [];
    const unwatch = bus.watchAudio((owner) => changes.push(owner));
    try {
      for (let i = 0; i < 3; i += 1) {
        t.$('[data-sh="qv"]').click();
        await new Promise((r) => setTimeout(r, 60));
        t.$('[data-sh="qv"]').click();
      }
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await new Promise((r) => setTimeout(r, 200));
      expect(`نُطق: ${t.speech.spoken.length} · مالك: ${bus.audioOwner() ?? 'لا أحد'} · تبدّل: ${changes.length}`)
        .toBe('نُطق: 0 · مالك: لا أحد · تبدّل: 0');
      const tryBtn = pop.querySelector('[data-sh="qv-preview"]');
      expect(`${tryBtn.textContent} · ${tryBtn.getAttribute('aria-pressed')}`).toBe('▶ · false');
      expect(pop.querySelector('[data-qv-info]').textContent.startsWith('المتصفّح')).toBe(true);
    } finally {
      unwatch();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });
});

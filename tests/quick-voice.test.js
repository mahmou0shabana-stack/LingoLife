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
import { BROWSER_PROVIDER_ID as BROWSER_ID } from '../js/services/shadow/tts/browser-provider.js';

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
/* القسمُ المتذكَّر محلّيًّا يعبر الاختبارات في نفس الصفحة — فيُمحى قبل كلّ تركيبٍ وبعده. */
const QV_SECTION_KEY = 'lingolife.quickVoice.section';
const forgetSection = () => { try { localStorage.removeItem(QV_SECTION_KEY); } catch { /* محجوب */ } };

async function mountShadow({ provider = null } = {}) {
  forgetSection();
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
    forgetSection();
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
      /* ستّةُ عناصرَ لا غير: المصدر، والصوت (وتجربتُه، و«كلّ الأصوات» المطويّ بمقارنته وبحثه)، والسرعة، والارتفاع، والتكرار، والمتقدّم. */
      expect([...pop().querySelectorAll('select, input, button')].map((n) => n.dataset.sh || n.dataset.tuneRange || ('qvSearch' in n.dataset ? 'qv-search' : null)))
        .toEqual(['qv-provider', 'voice-select', 'qv-preview', 'qv-locate', 'speed', 'volume', 'repeat', 'qv-cmp-close', 'qv-search', 'qv-cache-clear', 'qv-advanced']);
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
  it('٤ · التجربةُ بصوت المزوّد المفعَّل — وتغييرُه يصل إلى التجربة التالية فورًا، ولا يتسرّب إليها صوتُ الجهاز', async () => {
    /*
     * ⚠️ **يُقاس عند المزوّد لا عند الأذن.** قائمةُ أصوات المتصفّح تُخزَّن
     *    مرّةً للصفحة، فاسمُ الصوت المسموع يتبع ما حمّله اختبارٌ سبق. أمّا
     *    المزوّدُ المحقونُ فيتلقّى `voiceId` كما طلبته الشاشةُ بالحرف.
     *
     * ⚠️ **وكان هذا الحارسُ يشترط العكس** قبل متصفّح الأصوات: صوتُ الجهاز
     *    يُسلَّم لمزوّدٍ آخر (`Yuri` إلى المحقون). وذلك هو التسرّبُ الذي
     *    بُنيت الخريطةُ في الخطوة ١ لمنعه — فانقلب الشرطُ هنا صراحةً.
     */
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-boris"]').click();
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');

      pop.querySelector('[data-sh="qv-preview"]').click();
      await until(() => lib.calls.length >= 1);
      expect(lib.calls[0]).toEqual({ text: 'Привет! Так звучит этот голос.', voiceId: 'ru-boris', speed: 0.8 });
      await until(() => pop.querySelector('[data-sh="qv-preview"]').textContent === '▶');

      pop.querySelector('[data-sh="qv-pick"][data-v="ru-anna"]').click();
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-anna · متاح');
      /* وصوتُ جهازٍ يُختار في منتقيه لا يصل إلى هذا المزوّد. */
      chooseVoice(pop, 'Yuri');
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-anna · متاح');
      pop.querySelector('[data-sh="qv-preview"]').click();
      await until(() => lib.calls.length >= 2);
      expect(`التجربةُ الثانية بـ ${lib.calls[1].voiceId}`).toBe('التجربةُ الثانية بـ ru-anna');
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

/** مزوّدٌ بمكتبة أصواتٍ من `getVoices()` — ويسجّل بأيّ صوتٍ طُلب منه. */
function libraryProvider(id) {
  const base = fakeProvider(id);
  base.provider.name = 'مزوّد المكتبة';
  base.provider.getVoices = async () => [
    { id: 'ru-anna', name: 'Anna', language: 'ru-RU' },
    { id: 'ru-boris', name: 'Boris', language: 'ru-RU' },
    { id: 'en-carl', name: 'Carl', language: 'en-US' },
  ];
  return base;
}

/** يفتح قسمَ «كلّ الأصوات» كما يفتحه الإصبع — وينتظر أن تُجلَب القائمة. */
async function openBrowser(pop, expectId) {
  const details = pop.querySelector('[data-qv-browse]');
  /* ⚠️ وقد يكون مفتوحًا أصلًا — القسمُ المتذكَّرُ يُفتَح مع اللوحة. */
  if (!details.open) details.querySelector('summary').click();
  await until(() => pop.querySelector(`[data-sh="qv-pick"][data-v="${expectId}"]`));
}

/**
 * البطاقةُ كما تُقرأ: الاسم | المزوّد | اللغة | التوفّر | مختارة؟ — كلٌّ من خانته.
 * ⚠️ من القائمة الكاملة وحدها: «المفضّلة» و«الأخيرة» تُرسمان نفسَ البطاقات.
 */
const cardsOf = (pop, providerId) => [...pop.querySelectorAll(`[data-qv-list] [data-sh="qv-pick"][data-p="${providerId}"]`)]
  .map((b) => [
    b.querySelector('.sh-qv-name')?.textContent,
    b.querySelector('[data-tag="provider"]')?.textContent,
    b.querySelector('[data-tag="lang"]')?.textContent ?? '',
    b.querySelector('[data-tag="avail"]')?.textContent ?? '',
    b.getAttribute('aria-pressed'),
  ].join('|'));

describe('Voice Center V1.0C · متصفّحُ الأصوات في اللوحة السريعة', () => {
  it('٧ · يُحمَّل من getVoices() لكلّ مزوّدٍ متاح — حين يُفتَح القسمُ وحدَه', async () => {
    const lib = libraryProvider('qv-lib');
    let asked = 0;
    const real = lib.provider.getVoices;
    lib.provider.getVoices = async () => { asked += 1; return real(); };
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      /* ⚠️ مطويٌّ ولم يُسأل أحد: فتحُ اللوحة لا يجلب شيئًا. */
      expect(`مطويّ: ${!pop.querySelector('[data-qv-browse]').open} · سُئل: ${asked} · بطاقات: ${pop.querySelectorAll('[data-sh="qv-pick"]').length}`)
        .toBe('مطويّ: true · سُئل: 0 · بطاقات: 0');

      await openBrowser(pop, 'ru-anna');
      expect(`سُئل: ${asked}`).toBe('سُئل: 1');
      /* كلُّ بطاقة: الاسمُ · المزوّد · اللغة · وحالُ الاختيار. */
      expect(cardsOf(pop, 'qv-lib')).toEqual([
        'Anna|مزوّد المكتبة|ru-RU|بلا نت|false',
        'Boris|مزوّد المكتبة|ru-RU|بلا نت|false',
        'Carl|مزوّد المكتبة|en-US|بلا نت|false',
      ]);
    } finally {
      t.dispose();
    }
  });

  it('٨ · والبحثُ يصفّي القائمةَ نفسَها بالاسم وباللغة', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      const search = pop.querySelector('[data-qv-search]');
      const type = (q) => { search.value = q; search.dispatchEvent(new Event('input', { bubbles: true })); };
      const names = () => cardsOf(pop, 'qv-lib').map((c) => c.split('|')[0]);

      type('bor');
      expect(names()).toEqual(['Boris']);
      type('EN-us');
      expect(names()).toEqual(['Carl']);
      type('ru-');
      expect(names()).toEqual(['Anna', 'Boris']);
      type('zzz');
      expect(`${names().length} · ${pop.querySelector('.sh-qv-empty')?.textContent}`).toBe('0 · مفيش صوت بالبحث ده');
      type('');
      expect(names()).toEqual(['Anna', 'Boris', 'Carl']);
    } finally {
      t.dispose();
    }
  });

  it('٩ · الاختيارُ يكتب في إعداد الصوت الموجود، والسطرُ والمحرّكُ يتبعانه فورًا', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-boris"]').click();

      expect(`المزوّد: ${pop.querySelector('[data-sh="qv-provider"]').value}`).toBe('المزوّد: qv-lib');
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');
      expect(cardsOf(pop, 'qv-lib').map((c) => c.split('|').pop())).toEqual(['false', 'true', 'false']);

      /* ⚠️ في الخريطة نفسِها — وصوتُ المتصفّح القديمُ باقٍ كما كان. */
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions } = await import('../js/db/repositories.js');
      const row = await shadowSessions.get(t.session.id);
      expect(`${row.voiceByProvider?.['qv-lib']} · القديم ${row.voiceId}`).toBe('ru-boris · القديم Milena');

      /* والمحرّكُ ينطق به — بلا إعادة فتح. */
      t.$('[data-sh="play"]').click();
      await until(() => lib.calls.length >= 1);
      expect(`المحرّك طلب: ${lib.calls[0].voiceId}`).toBe('المحرّك طلب: ru-boris');
    } finally {
      t.dispose();
    }
  });

  it('١٠ · وتجربةُ البطاقة بصوتها هي — ولا تغيّر المختار', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-boris"]').click();

      const tryAnna = pop.querySelector('[data-sh="qv-try"][data-v="ru-anna"]');
      tryAnna.click();
      await until(() => lib.calls.length >= 1);
      expect(lib.calls[0]).toEqual({ text: 'Привет! Так звучит этот голос.', voiceId: 'ru-anna', speed: 0.8 });
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');

      /* وبطاقاتُ مزوّدٍ غيرِ المفعَّل لا تُجرَّب قبل اختيارها (لا مُكيِّفَ ثانيًا). */
      const others = [...pop.querySelectorAll('[data-sh="qv-try"]')].filter((b) => b.dataset.p !== 'qv-lib');
      expect(`معطّلة: ${others.every((b) => b.disabled)}`).toBe('معطّلة: true');
    } finally {
      t.dispose();
    }
  });

  it('١١ · ولا تنازعَ على الناقل: الجلبُ والبحثُ والاختيارُ صامتة، والتجربةُ تطالب ثمّ تحرّر', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const changes = [];
    const unwatch = bus.watchAudio((owner) => changes.push(owner));
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      const search = pop.querySelector('[data-qv-search]');
      search.value = 'ru';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-anna"]').click();
      await new Promise((r) => setTimeout(r, 150));
      expect(`صامتة: نُطق ${t.speech.spoken.length + lib.calls.length} · تبدّل ${changes.length}`)
        .toBe('صامتة: نُطق 0 · تبدّل 0');

      /* التدريبُ يعمل — ثمّ تجربةُ بطاقة: تطالب فيقف، وتحرّر عند انتهائها. */
      t.$('[data-sh="play"]').click();
      await until(() => lib.calls.length >= 1);
      expect(`قبل: ${bus.audioOwner()}`).toBe('قبل: session');
      const tryBoris = pop.querySelector('[data-sh="qv-try"][data-v="ru-boris"]');
      tryBoris.click();
      expect(`أثناءها: ${bus.audioOwner()} · التدريبُ ${t.$('[data-sh="play"]').classList.contains('on') ? 'يعمل' : 'واقف'} · ${tryBoris.textContent}`)
        .toBe('أثناءها: speak · التدريبُ واقف · ■');
      await until(() => lib.calls.some((c) => c.voiceId === 'ru-boris'));
      await until(() => tryBoris.textContent === '▶');
      expect(`بعدها: ${bus.audioOwner() ?? 'لا مالك'}`).toBe('بعدها: لا مالك');

      /* والإيقافُ من البطاقة نفسِها. */
      tryBoris.click();
      tryBoris.click();
      expect(`أُوقفت: ${bus.audioOwner() ?? 'لا مالك'} · ${tryBoris.textContent}`).toBe('أُوقفت: لا مالك · ▶');
    } finally {
      unwatch();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });
});

/** يحمّل أوراقَ أنماط التطبيق الحقيقيّة في صفحة الاختبار — ويعيد مُزيلَها. */
async function withAppStyles() {
  const files = ['tokens', 'base', 'layout', 'components', 'shadow'];
  const links = await Promise.all(files.map((name) => new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `../css/${name}.css`;
    link.onload = () => resolve(link);
    link.onerror = () => resolve(link);
    document.head.append(link);
  })));
  return () => links.forEach((link) => link.remove());
}

describe('Voice Center V1.0C · بطاقاتُ متصفّح الأصوات', () => {
  it('١٢ · البطاقةُ المختارة: شارةٌ واحدةٌ في رأسها، وخاناتٌ منفصلة، وتنتقل مع الاختيار', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      /*
       * ⚠️ قبل الاختيار قد تكون بطاقةُ صوت الجهاز (Milena) هي المختارةَ —
       *    وهذا صحيح: هي صوتُ الجلسة والمزوّدُ المفعَّلُ المتصفّح. فالشرطُ:
       *    لا شيءَ من المكتبة، وشارةٌ واحدةٌ على الأكثر.
       */
      const libOn = () => pop.querySelectorAll('[data-qv-list] .sh-qv-card.on [data-p="qv-lib"]').length;
      expect(`قبل الاختيار: مكتبةٌ مختارة ${libOn()} · شاراتٌ ≤ ١: ${pop.querySelectorAll('[data-qv-list] .sh-qv-sel').length <= 1}`)
        .toBe('قبل الاختيار: مكتبةٌ مختارة 0 · شاراتٌ ≤ ١: true');

      pop.querySelector('[data-sh="qv-pick"][data-v="ru-boris"]').click();
      const on = [...pop.querySelectorAll('[data-qv-list] .sh-qv-card.on')];
      expect(`مختارة: ${on.length} · ${on[0]?.querySelector('.sh-qv-name')?.textContent}`).toBe('مختارة: 1 · Boris');
      const badge = on[0].querySelector('.sh-qv-head > .sh-qv-sel');
      expect(`الشارة: ${badge?.textContent} · في رأس البطاقة: ${!!badge}`).toBe('الشارة: ✓ المختار · في رأس البطاقة: true');
      expect(pop.querySelectorAll('[data-qv-list] .sh-qv-sel').length).toBe(1);
      expect(on[0].querySelector('[data-sh="qv-pick"]').getAttribute('aria-label')).toBe('Boris — المختار');
      /* الخاناتُ عناصرُ منفصلة — لا سطرٌ بفواصل. */
      expect([...on[0].querySelectorAll('.sh-qv-tag')].map((n) => `${n.dataset.tag}=${n.textContent}`))
        .toEqual(['provider=مزوّد المكتبة', 'lang=ru-RU', 'avail=بلا نت']);

      pop.querySelector('[data-sh="qv-pick"][data-v="ru-anna"]').click();
      expect([...pop.querySelectorAll('[data-qv-list] .sh-qv-card.on .sh-qv-name')].map((n) => n.textContent)).toEqual(['Anna']);
      expect(pop.querySelectorAll('[data-qv-list] .sh-qv-sel').length).toBe(1);
    } finally {
      t.dispose();
    }
  });

  it('١٣ · زرُّ التجربة: يُرى وهو يعمل، ويوقفه نفسُه، ويعود وحده حين تنتهي', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-boris"]').click();
      const btn = (id) => pop.querySelector(`[data-sh="qv-try"][data-v="${id}"]`);
      const state = (b) => `${b.textContent} · ${b.classList.contains('is-playing') ? 'يعمل' : 'ساكن'} · ${b.getAttribute('aria-pressed')} · ${b.getAttribute('aria-label')}`;

      expect(state(btn('ru-anna'))).toBe('▶ · ساكن · false · جرّب Anna');
      btn('ru-anna').click();
      expect(state(btn('ru-anna'))).toBe('■ · يعمل · true · أوقف تجربة Anna');
      expect(`غيرُها ساكن: ${[...pop.querySelectorAll('[data-qv-list] .sh-qv-try.is-playing')].length}`).toBe('غيرُها ساكن: 1');

      btn('ru-anna').click();
      expect(`${state(btn('ru-anna'))} · ${bus.audioOwner() ?? 'لا مالك'}`).toBe('▶ · ساكن · false · جرّب Anna · لا مالك');

      btn('ru-boris').click();
      expect(state(btn('ru-boris'))).toBe('■ · يعمل · true · أوقف تجربة Boris');
      await until(() => !btn('ru-boris').classList.contains('is-playing'));
      expect(`${state(btn('ru-boris'))} · ${bus.audioOwner() ?? 'لا مالك'}`).toBe('▶ · ساكن · false · جرّب Boris · لا مالك');
    } finally {
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('١٤ · ولا يفيض شيء: لا تمريرَ أفقيّ، والاسمُ الطويلُ يُقصّ، وارتفاعُ اللوحة والقائمة محكوم', async () => {
    /*
     * ⚠️ **بأوراق الأنماط الحقيقيّة** — صفحةُ الاختبار بلا أنماط التطبيق،
     *    فالقياسُ بدونها يقيس HTML عاريًا. واللوحةُ عرضُها
     *    `min(280px, 100vw - 32px)` = ٢٨٠ من ٣١٢px فما فوق — أي نفسُ العرض
     *    على ٣٢٠ و٤١٢ وسطح المكتب. ويُقاس فوق ذلك عرضٌ أضيق (٢٤٠) هامشًا.
     */
    const unstyle = await withAppStyles();
    const lib = libraryProvider('qv-lib');
    const longName = 'Александра-Вероника Длинноимённая (Premium Neural Multilingual)';
    const baseVoices = lib.provider.getVoices;
    lib.provider.getVoices = async () => [
      ...(await baseVoices()),
      { id: 'ru-long', name: longName, language: 'ru-RU-x-very-long-regional-variant-tag' },
    ];
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-long');
      const list = pop.querySelector('[data-qv-list]');
      list.scrollTop = 0;
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-long"]').click();
      /* ⚠️ المختارُ آخرُ القائمة — ويُرى بلا تمرير (القائمةُ تمرّ إليه وحدَها). */
      const lr = list.getBoundingClientRect();
      const cr = list.querySelector('.sh-qv-card.on').getBoundingClientRect();
      expect(`المختارُ يُرى: ${cr.top >= lr.top - 1 && cr.bottom <= lr.bottom + 1}`).toBe('المختارُ يُرى: true');

      for (const width of [null, 240]) {
        if (width) pop.style.inlineSize = `${width}px`;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const label = width ? `${width}px` : `${Math.round(pop.getBoundingClientRect().width)}px`;
        expect(`${label} · اللوحةُ تفيض: ${pop.scrollWidth > pop.clientWidth + 1} · القائمةُ تفيض: ${list.scrollWidth > list.clientWidth + 1}`)
          .toBe(`${label} · اللوحةُ تفيض: false · القائمةُ تفيض: false`);
        const box = list.getBoundingClientRect();
        const out = [...list.querySelectorAll('.sh-qv-card, .sh-qv-card *')].filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1);
        });
        expect(`${label} · خارجَ القائمة: ${out.length}`).toBe(`${label} · خارجَ القائمة: 0`);
        const name = list.querySelector('[data-v="ru-long"] .sh-qv-name');
        expect(`${label} · الاسمُ يُقصّ: ${name.scrollWidth > name.clientWidth} · ${getComputedStyle(name).textOverflow}`)
          .toBe(`${label} · الاسمُ يُقصّ: true · ellipsis`);
        /* والشارةُ لا يدفعها الاسمُ الطويلُ خارجًا. */
        const sel = list.querySelector('[data-v="ru-long"] .sh-qv-sel').getBoundingClientRect();
        expect(`${label} · الشارةُ داخلها: ${sel.right <= box.right + 1 && sel.width > 20}`).toBe(`${label} · الشارةُ داخلها: true`);
      }
      expect(`ارتفاعُ القائمة ≤ ١٨٠: ${list.getBoundingClientRect().height <= 180.5} · اللوحة ≤ ٤٢٠: ${pop.getBoundingClientRect().height <= 420.5}`)
        .toBe('ارتفاعُ القائمة ≤ ١٨٠: true · اللوحة ≤ ٤٢٠: true');
    } finally {
      t.dispose();
      unstyle();
    }
  });

  it('١٥ · ولا تغييرَ في الصوت: إعادةُ الرسم أثناء التجربة لا توقفها ولا تطلب نطقًا ولا تمسّ الناقل', async () => {
    const lib = libraryProvider('qv-lib');
    /* توليدٌ يقف حتّى نفتحه — فالتجربةُ «تعمل» ما شئنا، بلا مهلةٍ مقدَّرة. */
    let release = null;
    const realSynth = lib.provider.synthesize;
    lib.provider.synthesize = async (req) => {
      await new Promise((r) => { release = r; });
      return realSynth(req);
    };
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-boris"]').click();
      pop.querySelector('[data-sh="qv-try"][data-v="ru-anna"]').click();
      await until(() => release);
      const changes = [];
      const unwatch = bus.watchAudio((owner) => changes.push(owner));

      const search = pop.querySelector('[data-qv-search]');
      search.value = 'ann';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-carl"]')?.click();
      unwatch();

      const anna = pop.querySelector('[data-sh="qv-try"][data-v="ru-anna"]');
      expect(`بعد إعادة الرسم: ${anna.classList.contains('is-playing') ? 'تعمل' : 'توقفت'} · المالك ${bus.audioOwner()} · تبدّل ${changes.length}`)
        .toBe('بعد إعادة الرسم: تعمل · المالك speak · تبدّل 0');
      release();
      await until(() => lib.calls.length >= 1);
      expect(`طُلب: ${lib.calls.length} · بصوت ${lib.calls[0].voiceId}`).toBe('طُلب: 1 · بصوت ru-anna');
    } finally {
      release?.();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });
});

/** سطورُ التفاصيل المفتوحة كما تُقرأ: «العنوان=القيمة». */
const factsOf = (pop, voiceId) => {
  const card = pop.querySelector(`[data-sh="qv-pick"][data-v="${voiceId}"]`)?.closest('.sh-qv-card');
  return [...(card?.querySelectorAll('[data-qv-details] .sh-qv-fact') || [])]
    .map((f) => `${f.querySelector('dt').textContent}=${f.querySelector('dd').textContent}`);
};
const infoBtn = (pop, voiceId) => pop.querySelector(`[data-sh="qv-info"][data-v="${voiceId}"]`);

describe('Voice Center V1.0C · تفاصيلُ الصوت في متصفّح الأصوات', () => {
  it('١٦ · تُفتَح من زرّ «i» تحت بطاقتها وحدها — وواحدةٌ في كلّ مرّة، ويغلقها زرُّها', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      expect(`مغلقة: ${pop.querySelectorAll('[data-qv-details]').length}`).toBe('مغلقة: 0');

      infoBtn(pop, 'ru-anna').click();
      const openCards = () => [...pop.querySelectorAll('[data-qv-details]')]
        .map((d) => d.closest('.sh-qv-card').querySelector('.sh-qv-name').textContent);
      expect(openCards()).toEqual(['Anna']);
      expect(infoBtn(pop, 'ru-anna').getAttribute('aria-expanded')).toBe('true');
      /* ⚠️ البطاقةُ باقيةٌ كما هي — التفاصيلُ تحتها لا بدلَها. */
      expect(`البطاقةُ باقية: ${!!pop.querySelector('[data-sh="qv-pick"][data-v="ru-anna"]')} · التجربةُ باقية: ${!!pop.querySelector('[data-sh="qv-try"][data-v="ru-anna"]')}`)
        .toBe('البطاقةُ باقية: true · التجربةُ باقية: true');

      infoBtn(pop, 'ru-boris').click();
      expect(openCards()).toEqual(['Boris']);
      infoBtn(pop, 'ru-boris').click();
      expect(`${openCards().length} · ${infoBtn(pop, 'ru-boris').getAttribute('aria-expanded')}`).toBe('0 · false');
    } finally {
      t.dispose();
    }
  });

  it('١٧ · تعرض ما قاله المزوّدُ فقط — وما لم يُعطَ لا يُعرَض سطرُه', async () => {
    const lib = libraryProvider('qv-lib');
    const baseVoices = lib.provider.getVoices;
    lib.provider.getVoices = async () => [...(await baseVoices()), { id: 'x-nolang', name: 'NoLang' }];
    /* مزوّدٌ ثانٍ لم يُعلن قدرةَ البثّ، وحالتُه كلمةٌ لا ترجمةَ لها عندنا. */
    const bare = libraryProvider('qv-bare');
    bare.provider.name = 'مزوّد بلا إعلان';
    delete bare.provider.supportsStreaming;
    bare.provider.isAvailable = async () => ({ available: true, status: 'something_new', reason: '' });
    bare.provider.getVoices = async () => [{ id: 'b-one', name: 'One', language: 'ru' }];
    const registry = await import('../js/services/shadow/tts/registry.js');
    registry.registerProvider(bare.provider);
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'b-one');

      infoBtn(pop, 'ru-anna').click();
      expect(factsOf(pop, 'ru-anna')).toEqual([
        'الاسم=Anna', 'المزوّد=مزوّد المكتبة', 'اللغة=ru-RU',
        'التوفّر=متاح · بلا نت', 'يعمل بلا إنترنت=نعم', 'بثٌّ متدفّق=لا',
      ]);

      /* ⚠️ بلا لغةٍ في getVoices() — فلا سطرَ لغة، لا «غير معروف». */
      infoBtn(pop, 'x-nolang').click();
      expect(factsOf(pop, 'x-nolang').some((f) => f.startsWith('اللغة='))).toBe(false);

      /* ⚠️ وبلا إعلان بثٍّ ولا ترجمةٍ للحالة — لا سطرَ بثٍّ، والتوفّرُ «متاح» وحده. */
      infoBtn(pop, 'b-one').click();
      expect(factsOf(pop, 'b-one')).toEqual([
        'الاسم=One', 'المزوّد=مزوّد بلا إعلان', 'اللغة=ru', 'التوفّر=متاح', 'يعمل بلا إنترنت=نعم',
      ]);
    } finally {
      t.dispose();
      registry.unregisterProvider('qv-bare');
    }
  });

  it('١٨ · وفتحُها لا يُصدر صوتًا ولا يمسّ الناقل', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const changes = [];
    const unwatch = bus.watchAudio((owner) => changes.push(owner));
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      for (const id of ['ru-anna', 'ru-boris', 'ru-carl', 'ru-carl', 'ru-anna']) {
        (infoBtn(pop, id) || infoBtn(pop, 'en-carl')).click();
      }
      await new Promise((r) => setTimeout(r, 250));
      expect(`نطقُ الجهاز ${t.speech.spoken.length} · طلبٌ من المزوّد ${lib.calls.length} · مالك ${bus.audioOwner() ?? 'لا أحد'} · تبدّل ${changes.length}`)
        .toBe('نطقُ الجهاز 0 · طلبٌ من المزوّد 0 · مالك لا أحد · تبدّل 0');
      expect(`لا زرَّ تجربةٍ يعمل: ${pop.querySelectorAll('.is-playing').length === 0}`).toBe('لا زرَّ تجربةٍ يعمل: true');
    } finally {
      unwatch();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('١٩ · والمختارُ لا يتغيّر — ولا تجربةٌ تعمل تتوقّف', async () => {
    const lib = libraryProvider('qv-lib');
    let release = null;
    const realSynth = lib.provider.synthesize;
    lib.provider.synthesize = async (req) => {
      await new Promise((r) => { release = r; });
      return realSynth(req);
    };
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-boris"]').click();
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions } = await import('../js/db/repositories.js');
      const before = await shadowSessions.get(t.session.id);

      pop.querySelector('[data-sh="qv-try"][data-v="ru-anna"]').click();
      await until(() => release);
      infoBtn(pop, 'ru-anna').click();
      infoBtn(pop, 'en-carl').click();

      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');
      expect([...pop.querySelectorAll('[data-qv-list] .sh-qv-card.on .sh-qv-name')].map((n) => n.textContent)).toEqual(['Boris']);
      expect(pop.querySelector('[data-sh="qv-provider"]').value).toBe('qv-lib');
      await new Promise((r) => setTimeout(r, 150));
      const after = await shadowSessions.get(t.session.id);
      expect(`${after.voiceByProvider?.['qv-lib']} · ${after.voiceId} · ${after.updatedAt === before.updatedAt ? 'لم يُكتَب' : 'كُتب'}`)
        .toBe(`ru-boris · Milena · لم يُكتَب`);
      expect(`التجربةُ تعمل: ${pop.querySelector('[data-sh="qv-try"][data-v="ru-anna"]').classList.contains('is-playing')} · ${bus.audioOwner()}`)
        .toBe('التجربةُ تعمل: true · speak');
    } finally {
      release?.();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٢٠ · ولا تفيض — بأنماط التطبيق، باسمٍ ولغةٍ طويلين، على ٢٨٠ و٢٤٠', async () => {
    const unstyle = await withAppStyles();
    const lib = libraryProvider('qv-lib');
    const baseVoices = lib.provider.getVoices;
    lib.provider.getVoices = async () => [
      ...(await baseVoices()),
      { id: 'ru-long', name: 'Александра-Вероника Длинноимённая (Premium Neural Multilingual)',
        language: 'ru-RU-x-very-long-regional-variant-tag' },
    ];
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-long');
      infoBtn(pop, 'ru-long').click();
      const list = pop.querySelector('[data-qv-list]');
      const dl = pop.querySelector('[data-qv-details]');
      for (const width of [null, 240]) {
        if (width) pop.style.inlineSize = `${width}px`;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const label = width ? `${width}px` : `${Math.round(pop.getBoundingClientRect().width)}px`;
        expect(`${label} · تفيض: اللوحة ${pop.scrollWidth > pop.clientWidth + 1} · القائمة ${list.scrollWidth > list.clientWidth + 1} · التفاصيل ${dl.scrollWidth > dl.clientWidth + 1}`)
          .toBe(`${label} · تفيض: اللوحة false · القائمة false · التفاصيل false`);
        const box = list.getBoundingClientRect();
        const out = [...dl.querySelectorAll('*')].filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1);
        });
        expect(`${label} · خارجَ القائمة: ${out.length}`).toBe(`${label} · خارجَ القائمة: 0`);
        /*
         * ⚠️ **والزرّان في سطر البطاقة لا تحتها** — قِيس عطبٌ فعليّ: التفافُ
         *    البطاقة للتفاصيل ألقى «i» و▶ إلى سطرٍ ثانٍ في **كلّ** بطاقة
         *    (٦٠ ← ١٠٠px). فمركزُ كلٍّ منهما داخل ارتفاع جسم البطاقة.
         */
        const offRow = [...list.querySelectorAll('.sh-qv-card')].filter((card) => {
          const body = card.querySelector('.sh-qv-pick').getBoundingClientRect();
          return [...card.querySelectorAll('.sh-qv-i, .sh-qv-try')].some((b) => {
            const r = b.getBoundingClientRect();
            const mid = (r.top + r.bottom) / 2;
            return mid < body.top || mid > body.bottom;
          });
        });
        expect(`${label} · بطاقاتٌ التفّ زرّاها: ${offRow.length}`).toBe(`${label} · بطاقاتٌ التفّ زرّاها: 0`);
      }
      expect(`القائمة ≤ ١٨٠: ${list.getBoundingClientRect().height <= 180.5} · اللوحة ≤ ٤٢٠: ${pop.getBoundingClientRect().height <= 420.5}`)
        .toBe('القائمة ≤ ١٨٠: true · اللوحة ≤ ٤٢٠: true');

      /*
       * ⚠️ **وفتحُ التفاصيل لا يقفز إلى المختار**: المختارُ آخرُ القائمة،
       *    والقائمةُ في أوّلها، ثمّ «i» على Anna — فتُرى **بطاقتُها** وتفاصيلُها
       *    (بأقلّ تمرير)، لا البطاقةُ المختارةُ في آخر القائمة.
       */
      infoBtn(pop, 'ru-long').click();
      pop.querySelector('[data-sh="qv-pick"][data-v="ru-long"]').click();
      list.scrollTop = 0;
      infoBtn(pop, 'ru-anna').click();
      const seen = (node) => {
        const lr = list.getBoundingClientRect();
        const r = node.getBoundingClientRect();
        return r.top >= lr.top - 1 && r.top < lr.bottom;
      };
      const anna = pop.querySelector('[data-sh="qv-pick"][data-v="ru-anna"]');
      const chosen = pop.querySelector('[data-sh="qv-pick"][data-v="ru-long"]');
      expect(`بعد «i»: بطاقةُ Anna تُرى ${seen(anna)} · تفاصيلُها تُرى ${seen(pop.querySelector('[data-qv-details]'))} · المختارُ يُرى ${seen(chosen)}`)
        .toBe('بعد «i»: بطاقةُ Anna تُرى true · تفاصيلُها تُرى true · المختارُ يُرى false');
    } finally {
      t.dispose();
      unstyle();
    }
  });
});

/** أسماءُ بطاقات قسمٍ بعينه (`favs` · `recent` · القائمة الكاملة `list`). */
const namesIn = (pop, where) => {
  const sel = where === 'list' ? '[data-qv-list]' : `[data-qv-${where}]`;
  return [...pop.querySelectorAll(`${sel} .sh-qv-card .sh-qv-name`)].map((n) => n.textContent);
};
const inList = (pop, where, sh, id) => {
  const sel = where === 'list' ? '[data-qv-list]' : `[data-qv-${where}]`;
  return pop.querySelector(`${sel} [data-sh="${sh}"][data-v="${id}"]`);
};
const sectionShown = (pop, name) => !pop.querySelector(`[data-qv-sec="${name}"]`).hidden;

describe('Voice Center V1.0C · المفضّلةُ والأخيرة في متصفّح الأصوات', () => {
  it('٢١ · النجمة: تُفضِّل وتنزع، تُرى، وتبقى بعد إعادة الفتح — ولا تختار', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      let pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      expect(`قبل: قسمٌ ${sectionShown(pop, 'favs') ? 'ظاهر' : 'مخفيّ'}`).toBe('قبل: قسمٌ مخفيّ');

      const star = () => inList(pop, 'list', 'qv-fav', 'ru-anna');
      expect(`${star().textContent} · ${star().getAttribute('aria-pressed')}`).toBe('☆ · false');
      star().click();
      expect(`${star().textContent} · ${star().getAttribute('aria-pressed')} · ${star().closest('.sh-qv-card').classList.contains('fav')}`)
        .toBe('★ · true · true');
      expect(`${sectionShown(pop, 'favs')} · ${namesIn(pop, 'favs').join(',')}`).toBe('true · Anna');

      /* ولا اختيار: السطرُ والمزوّدُ كما كانا، ولا بطاقةَ من المكتبة مختارة. */
      expect(pop.querySelector('[data-sh="qv-provider"]').value).toBe(BROWSER_ID);
      expect(pop.querySelectorAll('[data-qv-list] .sh-qv-card.on [data-p="qv-lib"]').length).toBe(0);

      /* ويبقى بعد إغلاق اللوحة وفتحها — في مخزن الإعدادات القائم. */
      t.$('[data-sh="qv"]').click();
      t.$('[data-sh="qv"]').click();
      pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      expect(`بعد إعادة الفتح: ${namesIn(pop, 'favs').join(',')} · ${star().textContent}`).toBe('بعد إعادة الفتح: Anna · ★');
      const { settings } = await import('../js/db/repositories.js');
      expect(await settings.get('shadow.voiceFavorites', null)).toEqual(['qv-lib|ru-anna']);

      star().click();
      expect(`نُزعت: ${star().textContent} · القسمُ ${sectionShown(pop, 'favs') ? 'ظاهر' : 'مخفيّ'}`).toBe('نُزعت: ☆ · القسمُ مخفيّ');
    } finally {
      t.dispose();
    }
  });

  it('٢٢ · «الأخيرة»: ما اختيرَ أو جُرِّب فعلًا، الأحدثُ أوّلًا بلا تكرار، وحدُّها خمسة', async () => {
    const lib = libraryProvider('qv-lib');
    const base = lib.provider.getVoices;
    lib.provider.getVoices = async () => [
      ...(await base()),
      { id: 'ru-d', name: 'Dasha', language: 'ru-RU' },
      { id: 'ru-e', name: 'Egor', language: 'ru-RU' },
      { id: 'ru-f', name: 'Fyodor', language: 'ru-RU' },
    ];
    /* بوّابةٌ نفتحها حين نشاء — لتبقى تجربةٌ «تعمل» ونحن نضغط ■. */
    let hold = false;
    let release = null;
    const realSynth = lib.provider.synthesize;
    lib.provider.synthesize = async (req) => {
      if (hold) await new Promise((r) => { release = r; });
      return realSynth(req);
    };
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      expect(`فارغة: ${sectionShown(pop, 'recent') ? 'ظاهرة' : 'مخفيّة'}`).toBe('فارغة: مخفيّة');

      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      inList(pop, 'list', 'qv-try', 'ru-anna').click();
      await until(() => lib.calls.length >= 1);
      inList(pop, 'list', 'qv-pick', 'en-carl').click();
      expect(namesIn(pop, 'recent')).toEqual(['Carl', 'Anna', 'Boris']);

      /* تكرارٌ يرفعه إلى الأوّل لا يضاعفه. */
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      expect(namesIn(pop, 'recent')).toEqual(['Boris', 'Carl', 'Anna']);

      /*
       * ⚠️ **والإيقافُ ليس تجربة**: تجربةُ Anna تعمل (البوّابةُ مغلقة)، ثمّ
       *    يُختار Carl فيصير الأوّل، ثمّ ■ على Anna — فلا يرفعها ترتيبًا.
       */
      hold = true;
      inList(pop, 'list', 'qv-try', 'en-carl').click();
      await until(() => release);
      expect(namesIn(pop, 'recent')).toEqual(['Carl', 'Boris', 'Anna']);
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      expect(namesIn(pop, 'recent')).toEqual(['Boris', 'Carl', 'Anna']);
      inList(pop, 'list', 'qv-try', 'en-carl').click();
      expect(`بعد ■: ${namesIn(pop, 'recent').join(',')}`).toBe('بعد ■: Boris,Carl,Anna');
      hold = false;
      release();

      for (const id of ['ru-d', 'ru-e', 'ru-f']) inList(pop, 'list', 'qv-pick', id).click();
      expect(namesIn(pop, 'recent')).toEqual(['Fyodor', 'Egor', 'Dasha', 'Boris', 'Carl']);

      /* والاختيارُ لا يُفضِّل. */
      expect(`مفضّلة: ${namesIn(pop, 'favs').length} · قسمٌ ${sectionShown(pop, 'favs') ? 'ظاهر' : 'مخفيّ'}`).toBe('مفضّلة: 0 · قسمٌ مخفيّ');

      /* ونزعُ النجمة لا يمسّ «الأخيرة». */
      inList(pop, 'list', 'qv-fav', 'ru-e').click();
      inList(pop, 'list', 'qv-fav', 'ru-e').click();
      expect(namesIn(pop, 'recent')).toEqual(['Fyodor', 'Egor', 'Dasha', 'Boris', 'Carl']);

      const { settings } = await import('../js/db/repositories.js');
      await new Promise((r) => setTimeout(r, 100));
      expect(await settings.get('shadow.voiceRecent', null))
        .toEqual(['qv-lib|ru-f', 'qv-lib|ru-e', 'qv-lib|ru-d', 'qv-lib|ru-boris', 'qv-lib|en-carl']);
    } finally {
      release?.();
      t.dispose();
    }
  });

  it('٢٣ · الاختيارُ من «المفضّلة» كالاختيار من القائمة: نفسُ الإعداد ونفسُ المحرّك', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'en-carl');
      inList(pop, 'list', 'qv-fav', 'en-carl').click();
      inList(pop, 'favs', 'qv-pick', 'en-carl').click();

      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · en-carl · متاح');
      expect(pop.querySelector('[data-sh="qv-provider"]').value).toBe('qv-lib');
      /* ونفسُ الصوت مختارٌ في كلّ مكانٍ يُرسَم فيه — لا نسخةٌ مستقلّة. */
      expect(`القائمة: ${inList(pop, 'list', 'qv-pick', 'en-carl').getAttribute('aria-pressed')} · المفضّلة: ${inList(pop, 'favs', 'qv-pick', 'en-carl').getAttribute('aria-pressed')}`)
        .toBe('القائمة: true · المفضّلة: true');
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions } = await import('../js/db/repositories.js');
      expect((await shadowSessions.get(t.session.id)).voiceByProvider?.['qv-lib']).toBe('en-carl');

      t.$('[data-sh="play"]').click();
      await until(() => lib.calls.length >= 1);
      expect(`المحرّك طلب: ${lib.calls[0].voiceId}`).toBe('المحرّك طلب: en-carl');
    } finally {
      t.dispose();
    }
  });

  it('٢٤ · والتجربةُ من «المفضّلة» بصوت بطاقتها — وحالُها يُرى في كلّ نسخة', async () => {
    const lib = libraryProvider('qv-lib');
    let release = null;
    const realSynth = lib.provider.synthesize;
    lib.provider.synthesize = async (req) => {
      await new Promise((r) => { release = r; });
      return realSynth(req);
    };
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      inList(pop, 'list', 'qv-fav', 'ru-anna').click();

      inList(pop, 'favs', 'qv-try', 'ru-anna').click();
      await until(() => release);
      const playing = (where) => inList(pop, where, 'qv-try', 'ru-anna').classList.contains('is-playing');
      expect(`تعمل: المفضّلة ${playing('favs')} · القائمة ${playing('list')} · المالك ${bus.audioOwner()}`)
        .toBe('تعمل: المفضّلة true · القائمة true · المالك speak');
      release();
      await until(() => lib.calls.length >= 1);
      expect(lib.calls[0]).toEqual({ text: 'Привет! Так звучит этот голос.', voiceId: 'ru-anna', speed: 0.8 });
      /* والمختارُ باقٍ. */
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');

      /*
       * والإيقافُ من المفضّلة يوقفها ويحرّر الناقل. (⚠️ التجربةُ الثانيةُ
       * لنفس الجملة والصوت تأتي من الذاكرة المشتركة لا من المزوّد — فلا
       * بوّابةَ تُنتظَر: الحالُ تُقرأ بعد الضغطة مباشرة.)
       */
      await until(() => !playing('favs'));
      inList(pop, 'favs', 'qv-try', 'ru-anna').click();
      expect(`تعمل ثانيةً: ${playing('favs')} · ${bus.audioOwner()}`).toBe('تعمل ثانيةً: true · speak');
      inList(pop, 'favs', 'qv-try', 'ru-anna').click();
      expect(`أُوقفت: ${playing('favs')} · ${bus.audioOwner() ?? 'لا مالك'}`).toBe('أُوقفت: false · لا مالك');
    } finally {
      release?.();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٢٥ · والنجمةُ لا تمسّ الصوتَ ولا المزوّدَ ولا الجلسة', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const changes = [];
    const unwatch = bus.watchAudio((owner) => changes.push(owner));
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      const { shadowSessions, settings } = await import('../js/db/repositories.js');
      const before = await shadowSessions.get(t.session.id);
      const info = pop.querySelector('[data-qv-info]').textContent;

      for (const id of ['ru-anna', 'ru-boris', 'en-carl', 'ru-boris']) inList(pop, 'list', 'qv-fav', id).click();
      inList(pop, 'favs', 'qv-fav', 'ru-anna').click();
      await new Promise((r) => setTimeout(r, 200));

      expect(`نطقٌ ${t.speech.spoken.length} · طلبٌ ${lib.calls.length} · تبدّلُ مالك ${changes.length}`)
        .toBe('نطقٌ 0 · طلبٌ 0 · تبدّلُ مالك 0');
      expect(`المزوّد: ${pop.querySelector('[data-sh="qv-provider"]').value} · السطر ثابت: ${pop.querySelector('[data-qv-info]').textContent === info}`)
        .toBe(`المزوّد: ${BROWSER_ID} · السطر ثابت: true`);
      const after = await shadowSessions.get(t.session.id);
      expect(JSON.stringify([after.voiceId, after.voiceByProvider ?? null])).toBe(JSON.stringify([before.voiceId, before.voiceByProvider ?? null]));
      expect(`الأخيرة: ${JSON.stringify(await settings.get('shadow.voiceRecent', []))}`).toBe('الأخيرة: []');
      expect(namesIn(pop, 'favs')).toEqual(['Carl']);
    } finally {
      unwatch();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });
});

/** جانبا المقارنة كما يُقرآن: أسماءٌ، و«فارغ» لخانةٍ تنتظر. */
const sidesOf = (pop) => [...pop.querySelectorAll('[data-qv-cmp] .sh-qv-slot')]
  .map((s) => (s.classList.contains('is-empty') ? 'فارغ' : s.querySelector('.sh-qv-name').textContent));
const slotTry = (pop, id) => pop.querySelector(`[data-qv-cmp] [data-sh="qv-try"][data-v="${id}"]`);
const cmpShown = (pop) => !pop.querySelector('[data-qv-sec="cmp"]').hidden;

/** مزوّدٌ بمكتبةٍ وتوليدٍ يقف عند بوّابةٍ نفتحها — تجربةٌ «تعمل» ما شئنا. */
function heldLibrary(id) {
  const lib = libraryProvider(id);
  const gates = [];
  const real = lib.provider.synthesize;
  lib.provider.synthesize = async (req) => {
    await new Promise((r) => { gates.push(r); });
    return real(req);
  };
  return { lib, openAll: () => gates.splice(0).forEach((r) => r()), gates };
}

describe('Voice Center V1.0C · المقارنةُ المصغّرة في متصفّح الأصوات', () => {
  it('٢٦ · «⇄» يضع صوتين في صفّ المقارنة — والثالثُ يُخرج أقدمَهما، و✕ يمحوها', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      expect(`مخفيّ: ${!cmpShown(pop)}`).toBe('مخفيّ: true');
      const cmp = (id) => inList(pop, 'list', 'qv-cmp', id);

      cmp('ru-anna').click();
      expect(`${cmpShown(pop)} · ${sidesOf(pop).join(' | ')} · ${cmp('ru-anna').getAttribute('aria-pressed')}`)
        .toBe('true · Anna | فارغ · true');
      cmp('ru-boris').click();
      expect(sidesOf(pop)).toEqual(['Anna', 'Boris']);
      cmp('en-carl').click();
      expect(sidesOf(pop)).toEqual(['Boris', 'Carl']);
      expect(`Anna خرجت: ${cmp('ru-anna').getAttribute('aria-pressed')}`).toBe('Anna خرجت: false');
      cmp('ru-boris').click();
      expect(sidesOf(pop)).toEqual(['Carl', 'فارغ']);

      pop.querySelector('[data-sh="qv-cmp-close"]').click();
      expect(`بعد ✕: ${cmpShown(pop) ? 'ظاهر' : 'مخفيّ'} · مضغوطة ${pop.querySelectorAll('[data-sh="qv-cmp"][aria-pressed="true"]').length}`)
        .toBe('بعد ✕: مخفيّ · مضغوطة 0');

      /* وحالٌ مؤقّتةٌ لا تُحفَظ: إغلاقُ اللوحة وفتحُها يبدأ بلا مقارنة. */
      cmp('ru-anna').click();
      t.$('[data-sh="qv"]').click();
      t.$('[data-sh="qv"]').click();
      const again = document.querySelector('.sh-qv-pop');
      await openBrowser(again, 'ru-anna');
      expect(`بعد إعادة الفتح: ${cmpShown(again) ? 'ظاهر' : 'مخفيّ'}`).toBe('بعد إعادة الفتح: مخفيّ');
    } finally {
      t.dispose();
    }
  });

  it('٢٧ · لكلّ جانبٍ تجربتُه بصوته — وواحدةٌ في كلّ لحظة، والثانيةُ تُسكِت الأولى', async () => {
    const { lib, openAll, gates } = heldLibrary('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-pick', 'en-carl').click();
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      inList(pop, 'list', 'qv-cmp', 'ru-boris').click();

      const state = () => ['ru-anna', 'ru-boris'].map((id) => `${id}:${slotTry(pop, id).textContent}`).join(' ');
      slotTry(pop, 'ru-anna').click();
      await until(() => gates.length >= 1);
      expect(`${state()} · ${bus.audioOwner()}`).toBe('ru-anna:■ ru-boris:▶ · speak');

      /* ⚠️ والثانيةُ والأولى ما زالت تعمل — فتُسكِتها. */
      slotTry(pop, 'ru-boris').click();
      expect(`${state()} · ${bus.audioOwner()}`).toBe('ru-anna:▶ ru-boris:■ · speak');
      expect(`تعمل في الصفّ: ${pop.querySelectorAll('[data-qv-cmp] .is-playing').length}`).toBe('تعمل في الصفّ: 1');

      /* ⚠️ الطلبُ الثاني يبلغ البوّابةَ بعد بحثٍ في الذاكرة المشتركة — يُنتظَر لا يُفترَض. */
      await until(() => gates.length >= 2);
      openAll();
      await until(() => lib.calls.length >= 2);
      expect(lib.calls.map((c) => c.voiceId)).toEqual(['ru-anna', 'ru-boris']);
      await until(() => !pop.querySelector('[data-qv-cmp] .is-playing'));
      expect(`بعدها: ${bus.audioOwner() ?? 'لا مالك'}`).toBe('بعدها: لا مالك');
    } finally {
      openAll();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٢٨ · والمقارنةُ لا تختار: المختارُ والسطرُ والمزوّدُ والجلسةُ كما كانت', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-pick', 'en-carl').click();
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions } = await import('../js/db/repositories.js');
      const before = await shadowSessions.get(t.session.id);
      const info = pop.querySelector('[data-qv-info]').textContent;

      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      inList(pop, 'list', 'qv-cmp', 'ru-boris').click();
      slotTry(pop, 'ru-anna').click();
      await until(() => lib.calls.length >= 1);
      slotTry(pop, 'ru-boris').click();
      await until(() => lib.calls.length >= 2);
      pop.querySelector('[data-sh="qv-cmp-close"]').click();
      await new Promise((r) => setTimeout(r, 150));

      expect(`السطر ثابت: ${pop.querySelector('[data-qv-info]').textContent === info} · ${info}`)
        .toBe('السطر ثابت: true · مزوّد المكتبة · en-carl · متاح');
      expect([...pop.querySelectorAll('[data-qv-list] .sh-qv-card.on .sh-qv-name')].map((n) => n.textContent)).toEqual(['Carl']);
      expect(pop.querySelector('[data-sh="qv-provider"]').value).toBe('qv-lib');
      const after = await shadowSessions.get(t.session.id);
      expect(JSON.stringify([after.voiceId, after.voiceByProvider])).toBe(JSON.stringify([before.voiceId, before.voiceByProvider]));
    } finally {
      t.dispose();
    }
  });

  it('٢٩ · ولا تسرّبَ بين المزوّدين: جانبٌ من مزوّدٍ غيرِ المفعَّل لا يُجرَّب ولا يبدّل المزوّد', async () => {
    const lib = libraryProvider('qv-lib');
    const other = libraryProvider('qv-other');
    other.provider.name = 'مزوّدٌ آخر';
    other.provider.getVoices = async () => [{ id: 'o-zoya', name: 'Zoya', language: 'ru-RU' }];
    const registry = await import('../js/services/shadow/tts/registry.js');
    registry.registerProvider(other.provider);
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'o-zoya');
      inList(pop, 'list', 'qv-pick', 'ru-anna').click();
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      inList(pop, 'list', 'qv-cmp', 'o-zoya').click();
      expect(sidesOf(pop)).toEqual(['Anna', 'Zoya']);

      const zoya = slotTry(pop, 'o-zoya');
      expect(`معطّل: ${zoya.disabled}`).toBe('معطّل: true');
      zoya.click();
      slotTry(pop, 'ru-anna').click();
      await until(() => lib.calls.length >= 1);
      await new Promise((r) => setTimeout(r, 150));
      expect(`المفعَّل طُلب: ${lib.calls.map((c) => c.voiceId).join(',')} · الآخر طُلب: ${other.calls.length}`)
        .toBe('المفعَّل طُلب: ru-anna · الآخر طُلب: 0');
      expect(pop.querySelector('[data-sh="qv-provider"]').value).toBe('qv-lib');
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-anna · متاح');
    } finally {
      t.dispose();
      registry.unregisterProvider('qv-other');
    }
  });

  it('٣٠ · والناقلُ كما هو: المقارنةُ صامتة، وتجربتُها توقف التدريب وتحرّر، و✕ يوقف تجربتَها وحدها', async () => {
    const { lib, openAll } = heldLibrary('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const changes = [];
    const unwatch = bus.watchAudio((owner) => changes.push(owner));
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-pick', 'en-carl').click();
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      inList(pop, 'list', 'qv-cmp', 'ru-boris').click();
      pop.querySelector('[data-sh="qv-cmp-close"]').click();
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      inList(pop, 'list', 'qv-cmp', 'ru-boris').click();
      expect(`صامتة: تبدّل ${changes.length} · طلب ${lib.calls.length} · نطق ${t.speech.spoken.length}`)
        .toBe('صامتة: تبدّل 0 · طلب 0 · نطق 0');

      /* التدريبُ يعمل — وتجربةُ جانبٍ تطالب فيقف. */
      t.$('[data-sh="play"]').click();
      await until(() => bus.audioOwner() === 'session');
      openAll();
      slotTry(pop, 'ru-anna').click();
      expect(`${bus.audioOwner()} · التدريبُ ${t.$('[data-sh="play"]').classList.contains('on') ? 'يعمل' : 'واقف'}`)
        .toBe('speak · التدريبُ واقف');

      /* ✕ أثناء تجربة أحد الصوتين: تتوقّف ويُحرَّر الناقل. */
      pop.querySelector('[data-sh="qv-cmp-close"]').click();
      expect(`بعد ✕: ${bus.audioOwner() ?? 'لا مالك'} · ${cmpShown(pop) ? 'ظاهر' : 'مخفيّ'}`).toBe('بعد ✕: لا مالك · مخفيّ');

      /* و✕ بلا تجربةٍ منها لا يمسّ تجربةً أخرى تعمل. */
      inList(pop, 'list', 'qv-cmp', 'ru-boris').click();
      inList(pop, 'list', 'qv-try', 'en-carl').click();
      expect(bus.audioOwner()).toBe('speak');
      pop.querySelector('[data-sh="qv-cmp-close"]').click();
      expect(`تجربةُ Carl باقية: ${bus.audioOwner()} · ${inList(pop, 'list', 'qv-try', 'en-carl').textContent}`)
        .toBe('تجربةُ Carl باقية: speak · ■');
    } finally {
      unwatch();
      openAll();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });
});

/** سطورُ «مصدر الصوت الحاليّ» كما تُقرأ. */
const provFacts = (pop) => [...pop.querySelectorAll('[data-qv-prov-dl] .sh-qv-fact')]
  .map((f) => `${f.querySelector('dt').textContent}=${f.querySelector('dd').textContent}`);

/** يزرع الذاكرةَ المولَّدة بالدالّة القائمة نفسِها — مقاطعُ بأحجامٍ معلومة. */
async function seedCache(sizes) {
  const { putGeneratedAudio } = await import('../js/services/shadow/tts/audio-cache.js');
  for (const [i, size] of sizes.entries()) {
    // eslint-disable-next-line no-await-in-loop -- زرعٌ متتابع
    await putGeneratedAudio({
      cacheKey: `test-cache-${i}`, normalizedText: `нормализованный текст ${i}`, providerId: 'qv-lib',
      voiceId: 'ru-anna', model: null, language: 'ru', settingsKey: 's1', mimeType: 'audio/wav',
      duration: 1, blob: new Blob([new Uint8Array(size)], { type: 'audio/wav' }), provenance: 'piper_generated',
    });
  }
}

async function openCacheSection(pop) {
  pop.querySelector('[data-qv-cache] > summary').click();
  await until(() => pop.querySelector('[data-qv-cache-stats]').dataset.items !== undefined);
}

describe('Voice Center V1.0C · مصدرُ الصوت وذاكرةُ الصوت المولَّد', () => {
  it('٣١ · «مصدرُ الصوت الحاليّ» ممّا أعلنه المزوّدُ نفسُه — ويتبع الاختيارَ والمزوّد', async () => {
    const lib = libraryProvider('qv-lib');
    lib.provider.modelId = 'ru_RU-denis-medium';
    lib.provider.modelVersion = '1.2.0';
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      /* المتصفّحُ أوّلًا: لا نموذجَ يعلنه — فلا سطرَ له. */
      const browser = provFacts(pop);
      expect(browser.filter((f) => /^(النموذج|الإصدار)=/.test(f))).toEqual([]);
      expect(browser.includes('النوع=نطقُ الجهاز (مباشر)')).toBe(true);
      expect(browser.includes('بثٌّ متدفّق=لا')).toBe(true);

      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      expect(provFacts(pop)).toEqual([
        'المزوّد=مزوّد المكتبة', 'النوع=Piper — نموذجٌ محلّيّ', 'الصوت=ru-boris',
        'النموذج=ru_RU-denis-medium', 'الإصدار=1.2.0', 'يعمل بلا إنترنت=نعم', 'بثٌّ متدفّق=لا',
      ]);

      /* ⚠️ ويتبع المزوّدَ حين يُبدَّل من منتقيه — لا يبقى على الأوّل. */
      const select = pop.querySelector('[data-sh="qv-provider"]');
      select.value = BROWSER_ID;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(`${provFacts(pop).some((f) => f.startsWith('النموذج='))} · ${provFacts(pop).includes('النوع=نطقُ الجهاز (مباشر)')}`)
        .toBe('false · true');
    } finally {
      t.dispose();
    }
  });

  it('٣٢ · وما لم يُعلَن يغيب سطرُه — لا «غير معروف» ولا قيمةٌ مفترَضة', async () => {
    const bare = libraryProvider('qv-bare');
    bare.provider.name = 'مزوّد بلا إعلان';
    bare.provider.type = 'mystery_engine';
    delete bare.provider.supportsStreaming;
    bare.provider.modelId = '   ';
    const t = await mountShadow({ provider: bare.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      const select = pop.querySelector('[data-sh="qv-provider"]');
      select.value = 'qv-bare';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      /* لم يُختَر له صوتٌ بعد — فلا سطرَ صوت؛ والنوعُ المجهولُ بحرفه. */
      expect(provFacts(pop)).toEqual(['المزوّد=مزوّد بلا إعلان', 'النوع=mystery_engine', 'يعمل بلا إنترنت=نعم']);
      expect(`لا «غير معروف»: ${!pop.querySelector('[data-qv-prov-dl]').textContent.includes('غير معروف')}`).toBe('لا «غير معروف»: true');
    } finally {
      t.dispose();
    }
  });

  it('٣٣ · أرقامُ الذاكرة هي أرقامُ `generatedCacheStats()` نفسِها', async () => {
    const t = await mountShadow();
    try {
      await seedCache([1000, 2500, 40000]);
      const { generatedCacheStats } = await import('../js/services/shadow/tts/audio-cache.js');
      const { formatBytes } = await import('../js/utils/dom.js');
      const stats = await generatedCacheStats();
      expect(`${stats.items} · ${stats.bytes}`).toBe('3 · 43500');

      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      /* ⚠️ تُقرأ حين يُفتَح قسمُها وحدَه. */
      expect(pop.querySelector('[data-qv-cache-stats]').textContent).toBe('…');
      await openCacheSection(pop);
      const out = pop.querySelector('[data-qv-cache-stats]');
      expect(out.textContent).toBe(`${stats.items} مقطع · ${formatBytes(stats.bytes)}`);
      expect(`${out.dataset.items} · ${out.dataset.bytes}`).toBe(`${stats.items} · ${stats.bytes}`);
      expect(`الزرّ ${pop.querySelector('[data-sh="qv-cache-clear"]').disabled ? 'معطّل' : 'متاح'}`).toBe('الزرّ متاح');
    } finally {
      t.dispose();
    }
  });

  it('٣٤ · «امسح الذاكرة» يمسحها بـ`clearGeneratedCache()` — والرقمُ يصير صفرًا', async () => {
    const t = await mountShadow();
    try {
      await seedCache([700, 900]);
      const audioCache = await import('../js/services/shadow/tts/audio-cache.js');
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openCacheSection(pop);
      expect(pop.querySelector('[data-qv-cache-stats]').dataset.items).toBe('2');

      pop.querySelector('[data-sh="qv-cache-clear"]').click();
      await until(() => pop.querySelector('[data-qv-cache-stats]').dataset.items === '0');
      const after = await audioCache.generatedCacheStats();
      expect(`${after.items} · ${after.bytes}`).toBe('0 · 0');
      expect(`الزرّ ${pop.querySelector('[data-sh="qv-cache-clear"]').disabled ? 'معطّل' : 'متاح'} · ${pop.querySelector('[data-qv-cache-stats]').textContent}`)
        .toBe('الزرّ معطّل · 0 مقطع · 0 بايت');
    } finally {
      t.dispose();
    }
  });

  it('٣٥ · والمسحُ لا يقطع صوتًا: التدريبُ يكمل ويبقى مالكَ الناقل', async () => {
    const t = await mountShadow();
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      await seedCache([500]);
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openCacheSection(pop);
      t.$('[data-sh="play"]').click();
      await until(() => t.speech.spoken.length >= 1);
      const changes = [];
      const unwatch = bus.watchAudio((owner) => changes.push(owner));

      pop.querySelector('[data-sh="qv-cache-clear"]').click();
      await until(() => pop.querySelector('[data-qv-cache-stats]').dataset.items === '0');
      const before = t.speech.spoken.length;
      await until(() => t.speech.spoken.length > before);
      unwatch();
      expect(`تبدّل ${changes.length} · ${bus.audioOwner()} · ${t.$('[data-sh="play"]').classList.contains('on') ? 'يعمل' : 'واقف'}`)
        .toBe('تبدّل 0 · session · يعمل');
    } finally {
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٣٦ · ولا يمسّ الإعدادات: الجلسةُ والمزوّدُ والمفضّلةُ والأخيرةُ كما كانت', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      inList(pop, 'list', 'qv-fav', 'ru-anna').click();
      await seedCache([300, 300, 300]);
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions, settings } = await import('../js/db/repositories.js');
      const snap = async () => {
        const row = await shadowSessions.get(t.session.id);
        return JSON.stringify({
          voiceId: row.voiceId, map: row.voiceByProvider, speed: row.speed, repeat: row.repeatCount, volume: row.volume,
          provider: await settings.get('shadow.ttsProvider', null),
          favs: await settings.get('shadow.voiceFavorites', null),
          recent: await settings.get('shadow.voiceRecent', null),
        });
      };
      const before = await snap();

      await openCacheSection(pop);
      pop.querySelector('[data-sh="qv-cache-clear"]').click();
      await until(() => pop.querySelector('[data-qv-cache-stats]').dataset.items === '0');
      await new Promise((r) => setTimeout(r, 150));
      expect(await snap()).toBe(before);
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');
    } finally {
      t.dispose();
    }
  });
});

/*
 * ══════════════════════════════════════════════════════════════════
 * «اختبر الصوت» — هو زرُّ ▶ بجانب منتقي الصوت (`qv-preview`)
 *
 * ⚠️ **لا زرَّ ثانٍ**: الطلبُ («Test Voice» بمسار speakScope، بالصوت والمزوّد
 *    والسرعة والارتفاع الحاليّة، وجملةٍ روسيّةٍ ثابتة، و▶/■، والإيقافُ بـ
 *    releaseAudio) هو ما يفعله هذا الزرُّ بالحرف منذ خطوة «جرّب الصوت».
 *    فالحرّاسُ هنا تثبّت الشروطَ الأربعةَ عليه — لا على نسخةٍ مكرَّرة.
 * ══════════════════════════════════════════════════════════════════ */
const testBtn = (pop) => pop.querySelector('[data-sh="qv-preview"]');
const SAMPLE = 'Привет! Так звучит этот голос.';

describe('Voice Center · «اختبر الصوت»', () => {
  it('٣٧ · يختبر الصوتَ المختارَ عند المزوّد المفعَّل وحده — ويتبع تغييرَه', async () => {
    const lib = libraryProvider('qv-lib');
    const other = libraryProvider('qv-other');
    other.provider.getVoices = async () => [{ id: 'o-zoya', name: 'Zoya', language: 'ru-RU' }];
    const registry = await import('../js/services/shadow/tts/registry.js');
    registry.registerProvider(other.provider);
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();

      testBtn(pop).click();
      await until(() => lib.calls.length >= 1);
      expect(lib.calls[0]).toEqual({ text: SAMPLE, voiceId: 'ru-boris', speed: 0.8 });
      await until(() => testBtn(pop).textContent === '▶');

      inList(pop, 'list', 'qv-pick', 'ru-anna').click();
      testBtn(pop).click();
      await until(() => lib.calls.length >= 2);
      expect(`${lib.calls[1].voiceId} · الآخر طُلب ${other.calls.length} · والجهاز نطق ${t.speech.spoken.length}`)
        .toBe('ru-anna · الآخر طُلب 0 · والجهاز نطق 0');
    } finally {
      t.dispose();
      registry.unregisterProvider('qv-other');
    }
  });

  it('٣٨ · ويحترم السرعةَ والارتفاعَ الحاليّين — كما ضُبطا في اللوحة نفسِها', async () => {
    const t = await mountShadow();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      drag(pop.querySelector('[data-tune-range="speed"]'), 1.3);
      drag(pop.querySelector('[data-tune-range="volume"]'), 35);

      testBtn(pop).click();
      await until(() => t.speech.spoken.length >= 1);
      const first = t.speech.spoken[t.speech.spoken.length - 1];
      expect(`${first.text} · ${first.rate} · ${first.volume}`).toBe(`${SAMPLE} · 1.3 · 0.35`);
      await until(() => testBtn(pop).textContent === '▶');

      drag(pop.querySelector('[data-tune-range="speed"]'), 0.6);
      drag(pop.querySelector('[data-tune-range="volume"]'), 80);
      const before = t.speech.spoken.length;
      testBtn(pop).click();
      await until(() => t.speech.spoken.length > before);
      const second = t.speech.spoken[t.speech.spoken.length - 1];
      expect(`${second.rate} · ${second.volume}`).toBe('0.6 · 0.8');
    } finally {
      t.dispose();
    }
  });

  it('٣٩ · يطالب بالناقل ويحرّره: ■ أثناءه، والإيقافُ بـreleaseAudio، والانتهاءُ يحرّر وحده', async () => {
    const t = await mountShadow();
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const log = [];
    const unwatch = bus.watchAudio((owner) => log.push(owner ?? '—'));
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      const btn = testBtn(pop);

      btn.click();
      expect(`${bus.audioOwner()} · ${btn.textContent} · ${btn.getAttribute('aria-pressed')} · ${btn.getAttribute('aria-label')}`)
        .toBe('speak · ■ · true · أوقف التجربة');
      await until(() => btn.textContent === '▶');
      expect(`انتهى وحده: ${bus.audioOwner() ?? 'لا مالك'}`).toBe('انتهى وحده: لا مالك');

      /* الإيقافُ من الزرّ نفسِه — والمالكُ يُمحى بالناقل لا بغيره. */
      btn.click();
      btn.click();
      expect(`أُوقف: ${bus.audioOwner() ?? 'لا مالك'} · ${btn.textContent} · ${btn.getAttribute('aria-label')}`)
        .toBe('أُوقف: لا مالك · ▶ · جرّب الصوت');
      /* وسجلُّ الناقل: مطالبةٌ ثمّ تحرير، مرّتين — لا مالكَ ثالثٌ ولا تحريرٌ زائد. */
      expect(log).toEqual(['speak', '—', 'speak', '—']);
    } finally {
      unwatch();
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٤٠ · ولا يغيّر حالَ التدريب: الجملةُ والعدّادُ والإعداداتُ كما هي، ولا استئنافَ من تلقاء نفسه', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      const { shadowSessions, settings } = await import('../js/db/repositories.js');
      const snapStore = async () => {
        const row = await shadowSessions.get(t.session.id);
        return JSON.stringify({
          voiceId: row.voiceId, map: row.voiceByProvider ?? null, speed: row.speed, volume: row.volume,
          repeat: row.repeatCount, provider: await settings.get('shadow.ttsProvider', null),
          favs: await settings.get('shadow.voiceFavorites', null), recent: await settings.get('shadow.voiceRecent', null),
        });
      };
      const line = () => t.main.querySelector('[data-line].current')?.dataset.line ?? '—';
      const counter = () => t.main.querySelector('[data-counter]')?.textContent ?? '—';

      /* التدريبُ يعمل حتّى تكرارٍ ثانٍ على الجملة الأولى. */
      t.$('[data-sh="play"]').click();
      await until(() => t.speech.spoken.length >= 2);
      const storeBefore = await snapStore();
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');

      /*
       * ⚠️ **اللقطةُ قبل الضغطة لا بعدها** — كُتبت أوّلًا بعدها فمرّت طفرةٌ
       *    تنقل التدريبَ إلى الجملة التالية مع الضغطة: كانت اللقطةُ نفسُها
       *    تقرأ الجملةَ الجديدة. ويُوقَف العدّادُ عند حدٍّ ثابت: التدريبُ
       *    يُوقَف مؤقّتًا بيد الناقل، فلا تكرارَ يتقدّم بين اللقطة والضغطة.
       */
      t.$('[data-sh="play"]').click();
      const atTest = { line: line(), counter: counter() };
      t.$('[data-sh="play"]').click();
      await until(() => t.$('[data-sh="play"]').classList.contains('on'));
      testBtn(pop).click();
      /* ⚠️ الناقلُ لا يسمح بصوتين: التدريبُ يقف — ولا يُمسّ موضعُه. */
      expect(`أثناءه: ${bus.audioOwner()} · التدريبُ ${t.$('[data-sh="play"]').classList.contains('on') ? 'يعمل' : 'واقف'}`)
        .toBe('أثناءه: speak · التدريبُ واقف');
      await until(() => testBtn(pop).textContent === '▶');
      await new Promise((r) => setTimeout(r, 300));

      expect(`بعده: الجملة ${line()} · العدّاد ${counter()} · ${t.$('[data-sh="play"]').classList.contains('on') ? 'يعمل' : 'واقف'}`)
        .toBe(`بعده: الجملة ${atTest.line} · العدّاد ${atTest.counter} · واقف`);
      expect(await snapStore()).toBe(storeBefore);

      /* وزرُّ التشغيل يستأنف من الجملة نفسِها. */
      t.$('[data-sh="play"]').click();
      expect(`استُؤنف: ${t.$('[data-sh="play"]').classList.contains('on')} · الجملة ${line()} · ${bus.audioOwner()}`)
        .toBe(`استُؤنف: true · الجملة ${atTest.line} · session`);
    } finally {
      t.dispose();
      bus.forgetAudioOwner();
    }
  });
});

/** الأقسامُ الثقيلة: أيُّها مفتوح الآن. */
const openSections = (pop) => [...pop.querySelectorAll('[data-qv-section]')].filter((d) => d.open).map((d) => d.dataset.qvSection);
const openSection = async (pop, name) => {
  const d = pop.querySelector(`[data-qv-section="${name}"]`);
  if (!d.open) d.querySelector('summary').click();
  /* ⚠️ `toggle` يُطلَق بعد مهمّة — فيُنتظَر أثرُه لا يُفترَض. */
  await until(() => openSections(pop).join() === name)
    .catch(() => { throw new Error(`القسم ${name}: المفتوح الآن ${openSections(pop).join() || 'لا شيء'}`); });
};

describe('Voice Center · تنظيمُ اللوحة', () => {
  it('٤١ · ترتيبٌ أوضح، والأقسامُ الثقيلةُ تُطوى — وواحدٌ مفتوحٌ في كلّ مرّة', async () => {
    const t = await mountShadow();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      /* الترتيب: الصوتُ الحاليّ ← الضوابطُ الخفيفة ← الأقسامُ الثقيلة ← المتقدّم. */
      const order = ['[data-sh="qv-provider"]', '[data-sh="voice-select"]', '[data-tune-range="speed"]',
        '[data-tune-range="repeat"]', '[data-qv-section="voices"]', '[data-qv-section="prov"]',
        '[data-qv-section="cache"]', '[data-sh="qv-advanced"]'].map((sel) => pop.querySelector(sel));
      const inOrder = order.every((n, i) => i === 0
        || (order[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING));
      expect(`بالترتيب: ${inOrder}`).toBe('بالترتيب: true');
      expect(`مطويّةٌ كلُّها: ${openSections(pop).length}`).toBe('مطويّةٌ كلُّها: 0');

      await openSection(pop, 'voices');
      await openSection(pop, 'prov');
      expect(openSections(pop)).toEqual(['prov']);
      await openSection(pop, 'cache');
      expect(openSections(pop)).toEqual(['cache']);
      pop.querySelector('[data-qv-section="cache"] > summary').click();
      await until(() => openSections(pop).length === 0);
      expect(openSections(pop)).toEqual([]);
    } finally {
      t.dispose();
    }
  });

  it('٤٢ · والطيُّ يحفظ ما في القسم: البحثُ والمقارنةُ والتفاصيلُ كما تُركت', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      inList(pop, 'list', 'qv-info', 'ru-boris').click();
      const search = pop.querySelector('[data-qv-search]');
      search.value = 'bor';
      search.dispatchEvent(new Event('input', { bubbles: true }));

      await openSection(pop, 'prov');
      await openSection(pop, 'voices');
      await until(() => inList(pop, 'list', 'qv-pick', 'ru-boris'));
      expect(`البحث: ${search.value} · القائمة: ${namesIn(pop, 'list').filter((n) => ['Anna', 'Boris', 'Carl'].includes(n)).join(',')}`)
        .toBe('البحث: bor · القائمة: Boris');
      expect(sidesOf(pop)).toEqual(['Anna', 'فارغ']);
      expect(`تفاصيلُ Boris: ${factsOf(pop, 'ru-boris')[0]}`).toBe('تفاصيلُ Boris: الاسم=Boris');
    } finally {
      t.dispose();
    }
  });

  it('٤٣ · ويُتذكَّر آخرُ قسمٍ مفتوح محلّيًّا — لا في الإعدادات', async () => {
    const t = await mountShadow();
    try {
      t.$('[data-sh="qv"]').click();
      let pop = document.querySelector('.sh-qv-pop');
      await openSection(pop, 'cache');
      expect(localStorage.getItem(QV_SECTION_KEY)).toBe('cache');

      t.$('[data-sh="qv"]').click();
      t.$('[data-sh="qv"]').click();
      pop = document.querySelector('.sh-qv-pop');
      await until(() => openSections(pop).join() === 'cache');
      /* ويعمل ما فيه كأنّه فُتح باليد: أرقامُ الذاكرة تُقرأ. */
      await until(() => pop.querySelector('[data-qv-cache-stats]').dataset.items !== undefined);
      expect(openSections(pop)).toEqual(['cache']);

      /* طيُّه يمحو التذكّر — فتُفتَح اللوحةُ التالية مطويّة. */
      pop.querySelector('[data-qv-section="cache"] > summary').click();
      await until(() => openSections(pop).length === 0);
      expect(localStorage.getItem(QV_SECTION_KEY)).toBe(null);
      t.$('[data-sh="qv"]').click();
      t.$('[data-sh="qv"]').click();
      pop = document.querySelector('.sh-qv-pop');
      await new Promise((r) => setTimeout(r, 100));
      expect(openSections(pop)).toEqual([]);

      /* ⚠️ ولا شيءَ في مخزن الإعدادات. */
      const { settings } = await import('../js/db/repositories.js');
      expect(await settings.get(QV_SECTION_KEY, 'غائب')).toBe('غائب');
    } finally {
      t.dispose();
    }
  });

  it('٤٤ · وفتحُ الأقسام وطيُّها صامت: لا صوت، ولا مالك، ولا إعداد، والمختارُ كما هو', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      inList(pop, 'list', 'qv-fav', 'ru-anna').click();
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions, settings } = await import('../js/db/repositories.js');
      const snap = async () => {
        const row = await shadowSessions.get(t.session.id);
        return JSON.stringify({
          voiceId: row.voiceId, map: row.voiceByProvider ?? null, speed: row.speed, volume: row.volume,
          repeat: row.repeatCount, provider: await settings.get('shadow.ttsProvider', null),
          favs: await settings.get('shadow.voiceFavorites', null), recent: await settings.get('shadow.voiceRecent', null),
        });
      };
      const before = await snap();
      const info = pop.querySelector('[data-qv-info]').textContent;
      const spoken = t.speech.spoken.length;
      const changes = [];
      const unwatch = bus.watchAudio((owner) => changes.push(owner));

      for (const name of ['prov', 'cache', 'voices', 'prov', 'voices', 'cache']) {
        // eslint-disable-next-line no-await-in-loop -- قسمٌ بعد قسم
        await openSection(pop, name);
      }
      pop.querySelector('[data-qv-section="cache"] > summary').click();
      await until(() => openSections(pop).length === 0);
      await new Promise((r) => setTimeout(r, 200));
      unwatch();

      expect(`نطق ${t.speech.spoken.length - spoken} · طلب ${lib.calls.length} · تبدّل ${changes.length} · مالك ${bus.audioOwner() ?? 'لا أحد'}`)
        .toBe('نطق 0 · طلب 0 · تبدّل 0 · مالك لا أحد');
      expect(await snap()).toBe(before);
      expect(pop.querySelector('[data-qv-info]').textContent).toBe(info);
      expect(pop.querySelector('[data-sh="qv-provider"]').value).toBe('qv-lib');
    } finally {
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٤٥ · والتخطيطُ محكومٌ بكلّ قسمٍ مفتوح — على عرض اللوحة (٢٨٠) وأضيقَ منه (٢٤٠)', async () => {
    const unstyle = await withAppStyles();
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      inList(pop, 'list', 'qv-cmp', 'ru-boris').click();
      for (const width of [null, 240]) {
        if (width) pop.style.inlineSize = `${width}px`;
        for (const name of ['voices', 'prov', 'cache']) {
          // eslint-disable-next-line no-await-in-loop -- قسمٌ بعد قسم
          await openSection(pop, name);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const label = `${width || Math.round(pop.getBoundingClientRect().width)}px/${name}`;
          const overflow = [pop, ...pop.querySelectorAll('.sh-qv-list, .sh-qv-info-dl, .sh-qv-cache, .sh-qv-cmp-row')]
            .some((n) => n.offsetParent && n.scrollWidth > n.clientWidth + 1);
          expect(`${label} · فيض ${overflow} · ارتفاع ≤ ٤٢٠ ${pop.getBoundingClientRect().height <= 420.5}`)
            .toBe(`${label} · فيض false · ارتفاع ≤ ٤٢٠ true`);
        }
      }
    } finally {
      t.dispose();
      unstyle();
    }
  });
});

/* ══════════════════════════════════════════════════════════════════
 * التكاملُ مع التدريب — هويّةُ صوتٍ واحدة بين الشاشة ومركز الصوت
 * ══════════════════════════════════════════════════════════════════ */
const lineOf = (t) => t.main.querySelector('[data-line].current')?.dataset.line ?? '—';
const repOf = (t) => Number((t.main.querySelector('[data-counter]')?.textContent || '0').split('/')[0].trim()) || 0;
const playing = (t) => t.$('[data-sh="play"]').classList.contains('on');

describe('Voice Center · التكاملُ مع تجربة التدريب', () => {
  it('٤٦ · فتحُ مركز الصوت من التدريب لا يمسّ الجملةَ ولا الموضعَ ولا التكرار — والتشغيلُ يكمل', async () => {
    const t = await mountShadow();
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    try {
      t.$('[data-sh="play"]').click();
      await until(() => t.speech.spoken.length >= 2);
      const line = lineOf(t);
      const rep = repOf(t);
      const said = t.speech.spoken.length;

      t.$('[data-sh="qv"]').click();
      expect(`فورًا: ${playing(t) ? 'يعمل' : 'واقف'} · الجملة ${lineOf(t)} · ${bus.audioOwner()}`)
        .toBe(`فورًا: يعمل · الجملة ${line} · session`);
      await until(() => t.speech.spoken.length > said);
      expect(`بعده: الجملة ${lineOf(t)} · التكرارُ لم يُصفَّر ${repOf(t) >= rep} · لم يُعَد من أوّله ${t.speech.spoken.length > said}`)
        .toBe(`بعده: الجملة ${line} · التكرارُ لم يُصفَّر true · لم يُعَد من أوّله true`);
      t.$('[data-sh="qv"]').click();
      expect(`بعد الإغلاق: ${playing(t) ? 'يعمل' : 'واقف'} · ${bus.audioOwner()}`).toBe('بعد الإغلاق: يعمل · session');
    } finally {
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٤٧ · الصوتُ الحاليّ يظهر بمزوّده ولغته وتوفّره — ويُركَّز عليه في «كلّ الأصوات»، و📍 تفتحه', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      let pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      /* زرُّ الشاشة يقول الصوتَ الحاليّ. */
      expect(t.$('[data-sh="qv"]').getAttribute('aria-label')).toBe('الصوت: ru-boris · مزوّد المكتبة');

      /* يُطوى القسم ويُعاد فتحُ المركز — ثمّ 📍. */
      pop.querySelector('[data-qv-section="voices"] > summary').click();
      await until(() => openSections(pop).length === 0);
      t.$('[data-sh="qv"]').click();
      t.$('[data-sh="qv"]').click();
      pop = document.querySelector('.sh-qv-pop');
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');
      pop.querySelector('[data-sh="qv-locate"]').click();
      await until(() => pop.querySelector('[data-qv-list] .sh-qv-card.is-focus'));
      const focused = pop.querySelector('[data-qv-list] .sh-qv-card.is-focus');
      expect(`${openSections(pop).join()} · ${focused.querySelector('.sh-qv-name').textContent} · مختارة ${focused.classList.contains('on')}`)
        .toBe('voices · Boris · مختارة true');
      const lr = pop.querySelector('[data-qv-list]').getBoundingClientRect();
      const cr = focused.getBoundingClientRect();
      expect(`تُرى: ${cr.top >= lr.top - 1 && cr.top < lr.bottom}`).toBe('تُرى: true');
      /* واللغةُ ممّا قاله getVoices() — الآن وقد جُلبت. */
      expect(pop.querySelector('[data-qv-lang]').textContent).toBe('ru-RU');
    } finally {
      t.dispose();
    }
  });

  it('٤٨ · الصوتُ يتزامن في الاتّجاهين: من المركز إلى التدريب، ومن مركز التدريب إلى المركز', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      /* من مركز التدريب (الدرج) ← المركز: صوتُ الجهاز. */
      const drawerSelect = t.$('[data-drawer] [data-sh="voice-select"]');
      if (![...drawerSelect.options].some((o) => o.value === 'Yuri')) drawerSelect.append(new Option('Yuri', 'Yuri'));
      drawerSelect.value = 'Yuri';
      drawerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      t.$('[data-sh="qv"]').click();
      let pop = document.querySelector('.sh-qv-pop');
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('المتصفّح (النطق الآلي) · Yuri · متاح');
      expect(t.$('[data-sh="qv"]').getAttribute('aria-label')).toBe('الصوت: Yuri · المتصفّح (النطق الآلي)');

      /* ومن المركز ← التدريب: المزوّدُ في الدرج يتبع، والمحرّكُ ينطق بالمختار. */
      await openBrowser(pop, 'ru-anna');
      inList(pop, 'list', 'qv-pick', 'ru-anna').click();
      expect(t.$('[data-drawer] [data-sh="tts-provider"].on')?.dataset.v).toBe('qv-lib');
      t.$('[data-sh="play"]').click();
      await until(() => lib.calls.length >= 1);
      expect(lib.calls[0].voiceId).toBe('ru-anna');
      t.$('[data-sh="play"]').click();

      /* وتبديلُ المزوّد من الدرج يصل إلى منتقي المركز. */
      t.$(`[data-drawer] [data-sh="tts-provider"][data-v="${BROWSER_ID}"]`).click();
      pop = document.querySelector('.sh-qv-pop');
      expect(pop.querySelector('[data-sh="qv-provider"]').value).toBe(BROWSER_ID);
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('المتصفّح (النطق الآلي) · Yuri · متاح');
    } finally {
      t.dispose();
    }
  });

  it('٤٩ · جرّب قبل أن تعتمد: التجربةُ لا تحفظ — والحاليّ موسومٌ، والبديلُ يعرض «استخدم هذا الصوت»', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      await new Promise((r) => setTimeout(r, 150));
      const { shadowSessions } = await import('../js/db/repositories.js');
      const saved = JSON.stringify((await shadowSessions.get(t.session.id)).voiceByProvider);

      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      pop.querySelector('[data-sh="qv-cmp-current"]').click();
      expect(sidesOf(pop)).toEqual(['Boris', 'Anna']);
      const slotOf = (id) => pop.querySelector(`[data-qv-cmp] [data-qv-slot="qv-lib|${id}"]`);
      expect(`الحاليّ: ${slotOf('ru-boris').classList.contains('is-current')} · بلا «استخدم» ${!slotOf('ru-boris').querySelector('[data-sh="qv-use"]')} · البديلُ يعرضها ${!!slotOf('ru-anna').querySelector('[data-sh="qv-use"]')}`)
        .toBe('الحاليّ: true · بلا «استخدم» true · البديلُ يعرضها true');
      expect(`${slotTry(pop, 'ru-boris').getAttribute('aria-label')} | ${slotTry(pop, 'ru-anna').getAttribute('aria-label')}`)
        .toBe('اسمع Boris | جرّب Anna');

      slotTry(pop, 'ru-anna').click();
      await until(() => lib.calls.length >= 1);
      expect(lib.calls[0].voiceId).toBe('ru-anna');
      await new Promise((r) => setTimeout(r, 150));
      expect(JSON.stringify((await shadowSessions.get(t.session.id)).voiceByProvider)).toBe(saved);
      expect(pop.querySelector('[data-qv-info]').textContent).toBe('مزوّد المكتبة · ru-boris · متاح');
    } finally {
      t.dispose();
    }
  });

  it('٥٠ · «استخدم هذا الصوت» يحفظ ويغيّر الجملةَ التالية وحدها — والجملةُ والسرعةُ والارتفاعُ والتكرارُ باقية، بلا إعادة تحميل', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      const app = t.main.querySelector('.shadow-app');
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      drag(pop.querySelector('[data-tune-range="repeat"]'), 60);
      drag(pop.querySelector('[data-tune-range="speed"]'), 1.1);
      drag(pop.querySelector('[data-tune-range="volume"]'), 55);
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      pop.querySelector('[data-sh="qv-cmp-current"]').click();

      /* ⚠️ تكرارُ الجملة نفسِها يأتي من الذاكرة المشتركة لا من المزوّد — فيُنتظَر العدّاد. */
      t.$('[data-sh="play"]').click();
      await until(() => lib.calls.length >= 1 && repOf(t) >= 1);
      /* ⚠️ إلى الجملة الثانية أوّلًا — فالبقاءُ على الأولى لا يثبت شيئًا (طفرةُ «ارجع للأولى» مرّت). */
      t.$('[data-sh="next"]').click();
      await until(() => lineOf(t) === '1' && repOf(t) >= 2);
      const line = lineOf(t);
      const repBefore = repOf(t);
      const before = lib.calls.length;
      pop.querySelector('[data-qv-cmp] [data-sh="qv-use"][data-v="ru-anna"]').click();
      await until(() => lib.calls.length > before);

      expect(lib.calls.slice(0, before).every((c) => c.voiceId === 'ru-boris')).toBe(true);
      expect(`التالية: ${lib.calls[before].voiceId} · بسرعة ${lib.calls[before].speed}`).toBe('التالية: ru-anna · بسرعة 1.1');
      expect(`الجملة ${lineOf(t)} · يعمل ${playing(t)} · نفسُ الشاشة ${t.main.querySelector('.shadow-app') === app} · التكرارُ لم يُصفَّر ${repOf(t) >= repBefore}`)
        .toBe(`الجملة ${line} · يعمل true · نفسُ الشاشة true · التكرارُ لم يُصفَّر true`);
      const { shadowSessions } = await import('../js/db/repositories.js');
      await new Promise((r) => setTimeout(r, 150));
      const row = await shadowSessions.get(t.session.id);
      expect({ voice: row.voiceByProvider?.['qv-lib'], speed: row.speed, volume: row.volume, repeat: row.repeatCount })
        .toEqual({ voice: 'ru-anna', speed: 1.1, volume: 0.55, repeat: 60 });
      /* والصفُّ يُعيد رسمَ نفسه: Anna الحاليّةُ الآن. */
      expect(pop.querySelector('[data-qv-cmp] [data-qv-slot="qv-lib|ru-anna"]').classList.contains('is-current')).toBe(true);
    } finally {
      t.dispose();
    }
  });

  it('٥١ · والمقارنةُ لا تمسّ التكرارَ ولا الجملة', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      drag(pop.querySelector('[data-tune-range="repeat"]'), 60);
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      t.$('[data-sh="play"]').click();
      await until(() => repOf(t) >= 3);
      t.$('[data-sh="play"]').click();
      const snap = { line: lineOf(t), rep: t.main.querySelector('[data-counter]').textContent };

      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      pop.querySelector('[data-sh="qv-cmp-current"]').click();
      slotTry(pop, 'ru-anna').click();
      await until(() => !pop.querySelector('[data-qv-cmp] .is-playing'));
      slotTry(pop, 'ru-boris').click();
      await until(() => !pop.querySelector('[data-qv-cmp] .is-playing'));
      pop.querySelector('[data-sh="qv-cmp-close"]').click();

      expect({ line: lineOf(t), rep: t.main.querySelector('[data-counter]').textContent, playing: playing(t) })
        .toEqual({ ...snap, playing: false });
    } finally {
      t.dispose();
    }
  });

  it('٥٢ · لوحةُ التسجيل تعرض صوتَ التعلّم الحاليّ مرجعًا — والمرجعُ يُنطَق به، والتسجيلُ لا يُمَسّ', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      t.$('[data-sh="qv"]').click();
      const { media } = await import('../js/db/repositories.js');
      const mediaBefore = (await media.getAll()).length;

      t.$('.sh-rec-btn').click();
      await until(() => document.querySelector('.overlay [data-vo-refvoice]'));
      const ref = document.querySelector('.overlay [data-vo-refvoice]');
      expect(ref.querySelector('bdi').textContent).toBe('ru-boris · مزوّد المكتبة');

      document.querySelector('.overlay [data-vo="ref"]').click();
      await until(() => lib.calls.length >= 1);
      expect(`المرجعُ بـ ${lib.calls[0].voiceId} · نصُّه جملةُ التدريب ${lib.calls[0].text !== SAMPLE}`)
        .toBe('المرجعُ بـ ru-boris · نصُّه جملةُ التدريب true');
      expect((await media.getAll()).length).toBe(mediaBefore);
    } finally {
      document.querySelector('.overlay [data-vo]')?.closest('.overlay')?.__close?.(null);
      t.dispose();
    }
  });

  it('٥٣ · ولا تنازعَ على الناقل: تدريبٌ ← تجربةٌ ← اعتمادٌ ← تدريب، بمالكٍ واحدٍ في كلّ لحظة', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    const log = [];
    try {
      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      pop.querySelector('[data-sh="qv-cmp-current"]').click();
      const unwatch = bus.watchAudio((owner) => log.push(owner ?? '—'));

      t.$('[data-sh="play"]').click();
      await until(() => lib.calls.length >= 1);
      slotTry(pop, 'ru-anna').click();
      expect(`${bus.audioOwner()} · التدريبُ ${playing(t) ? 'يعمل' : 'واقف'}`).toBe('speak · التدريبُ واقف');
      await until(() => !pop.querySelector('[data-qv-cmp] .is-playing'));
      pop.querySelector('[data-qv-cmp] [data-sh="qv-use"][data-v="ru-anna"]').click();
      expect(`الاعتمادُ صامت: ${bus.audioOwner() ?? 'لا مالك'}`).toBe('الاعتمادُ صامت: لا مالك');
      t.$('[data-sh="play"]').click();
      await until(() => lib.calls.some((c) => c.voiceId === 'ru-anna' && c.text !== SAMPLE));
      unwatch();
      expect(log).toEqual(['session', 'speak', '—', 'session']);
    } finally {
      t.dispose();
      bus.forgetAudioOwner();
    }
  });

  it('٥٤ · ولا إعداداتٍ مكرَّرة: لا مفتاحَ جديد ولا حقلَ صوتٍ ثانٍ — خريطةٌ واحدةٌ بمدخلٍ لكلّ مزوّد', async () => {
    const lib = libraryProvider('qv-lib');
    const t = await mountShadow({ provider: lib.provider });
    try {
      const { shadowSessions, settings } = await import('../js/db/repositories.js');
      const keysBefore = new Set(Object.keys(await settings.all()));
      const rowBefore = new Set(Object.keys(await shadowSessions.get(t.session.id)));
      const lsBefore = new Set(Object.keys(localStorage));

      t.$('[data-sh="qv"]').click();
      const pop = document.querySelector('.sh-qv-pop');
      await openBrowser(pop, 'ru-boris');
      inList(pop, 'list', 'qv-pick', 'ru-boris').click();
      inList(pop, 'list', 'qv-cmp', 'ru-anna').click();
      pop.querySelector('[data-sh="qv-cmp-current"]').click();
      slotTry(pop, 'ru-anna').click();
      await until(() => lib.calls.length >= 1);
      pop.querySelector('[data-qv-cmp] [data-sh="qv-use"][data-v="ru-anna"]').click();
      const drawerSelect = t.$('[data-drawer] [data-sh="voice-select"]');
      if (![...drawerSelect.options].some((o) => o.value === 'Yuri')) drawerSelect.append(new Option('Yuri', 'Yuri'));
      drawerSelect.value = 'Yuri';
      drawerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));

      const newKeys = Object.keys(await settings.all()).filter((k) => !keysBefore.has(k)).sort();
      const allowed = ['shadow.ttsProvider', 'shadow.voiceFavorites', 'shadow.voiceRecent'];
      expect(`مفاتيحُ جديدةٌ خارج نظام الصوت القائم: ${newKeys.filter((k) => !allowed.includes(k)).join(',') || 'لا شيء'}`)
        .toBe('مفاتيحُ جديدةٌ خارج نظام الصوت القائم: لا شيء');
      const row = await shadowSessions.get(t.session.id);
      const newFields = Object.keys(row).filter((k) => !rowBefore.has(k)).sort();
      expect(newFields).toEqual(['voiceByProvider']);
      expect(Object.entries(row.voiceByProvider).sort()).toEqual([[BROWSER_ID, 'Yuri'], ['qv-lib', 'ru-anna']].sort());
      expect(`القديمُ مرآةُ المتصفّح: ${row.voiceId}`).toBe('القديمُ مرآةُ المتصفّح: Yuri');
      const lsNew = Object.keys(localStorage).filter((k) => !lsBefore.has(k));
      expect(lsNew.every((k) => k === QV_SECTION_KEY)).toBe(true);
    } finally {
      t.dispose();
    }
  });
});

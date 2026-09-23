/**
 * LingoLife — Voice Center V1.0C · الخطوة ٣: ملكيّةُ مسارات الصوت
 *
 * ⚠️ **كلُّ عنصرٍ يُصدر صوتًا يجب أن يكون تحت مالكٍ في الناقل** — وإلّا
 *    فتسجيلٌ يبدأ لا يُسكِته، وهو لا يُسكِت ما يعمل: صوتان معًا.
 *
 * المساراتُ الأربعة المدقَّقة:
 *   · `humanEl`  (المحرّك · تسجيلٌ بشريّ)  ← مالكُه `session`
 *   · `audioEl`  (مُكيِّف النطق)           ← `session` حين يقوده المحرّك،
 *                                            و`speak` حين تنطق كلمةٌ بضغطة
 *   · مختبرُ الأصوات                      ← `voice-lab` (كان سليمًا)
 *   · معاينةُ التسجيل                      ← `voice-attempts`
 *
 * والعطبان اللذان وُجدا: المحرّكُ يبدأ من غير زرّ ▶ بلا مطالبة،
 * ومعاينةُ التسجيل تُستأنَف بلا مطالبة.
 */

import { describe, it, expect } from './test-runner.js';

/** يُسقط التعليقات — يُقرأ كودٌ لا شرح. */
const bare = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const until = async (check, ms = 4000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('انتهت المهلة');
    await new Promise((r) => setTimeout(r, 20));
  }
};

/** ثانيةُ صمتٍ WAV حقيقيّة — يشغّلها المتصفّح فعلًا. */
function silentWav(seconds = 2) {
  const rate = 8000;
  const n = rate * seconds;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  return new File([buf], 'silence.wav', { type: 'audio/wav' });
}

describe('Voice Center V1.0C · المحرّكُ لا يُصدر صوتًا إلّا بعد start أو resume', () => {
  it('١ · لا نطقَ ولا تسجيلَ بشريٌّ قبل أحدهما — فالمطالبةُ عندهما تكفي', async () => {
    /*
     * ⚠️ **هذه مقدّمةُ الإصلاح كلِّه، فتُقاس لا تُفترَض.** الشاشةُ تطالب
     *    بالناقل عند `start`/`resume`؛ فلو وُجد بابٌ في المحرّك يُصدر صوتًا
     *    بلا أحدهما لبقي بلا مالك. فيُحرَّك بكلّ بابٍ وهو واقفٌ وهو موقوف،
     *    ويُعَدّ ما خرج — ناطقٌ محقونٌ لـ`audioEl`، و`Audio` محقونٌ لـ`humanEl`.
     */
    const { createPlaybackController } = await import('../js/services/shadow/playback-controller.js');
    const log = [];
    const RealAudio = window.Audio;
    window.Audio = class {
      setAttribute() {}
      pause() {}
      play() { log.push('humanEl'); return new Promise(() => {}); }
    };
    let player = null;
    try {
      const make = (audioSource) => createPlaybackController({
        segments: [
          { id: 'a', text: 'Раз.', humanAudioUrl: 'blob:a' },
          { id: 'b', text: 'Два.', humanAudioUrl: 'blob:b' },
        ],
        settings: { repeatCount: 3, unit: 'ms', intervalMsValue: 0, autoAdvance: true, audioSource },
        onEvent: (e) => { if (e.type === 'start' || e.type === 'resume') log.push(e.type); },
        speaker: async () => { log.push('audioEl'); return new Promise(() => {}); },
        canceler: () => {},
      });
      const pokeAll = () => {
        player.goTo(1); player.next(); player.previous();
        player.selectWord(0); player.setSelection([0, 1]); player.updateSettings({ rate: 1 });
      };
      const tick = () => new Promise((r) => { setTimeout(r, 60); });

      for (const source of ['tts', 'mine']) {
        log.length = 0;
        player = make(source);
        pokeAll();
        await tick();
        expect(`${source} · واقفٌ: ${log.join(',') || '—'}`).toBe(`${source} · واقفٌ: —`);

        player.start();
        await tick();
        const sound = source === 'tts' ? 'audioEl' : 'humanEl';
        expect(`${source} · بعد start: ${log[0]} ثمّ ${log[1]}`).toBe(`${source} · بعد start: start ثمّ ${sound}`);

        player.pause();
        log.length = 0;
        pokeAll();
        await tick();
        expect(`${source} · موقوفٌ: ${log.join(',') || '—'}`).toBe(`${source} · موقوفٌ: —`);

        /* ⚠️ `selectWord` وهو موقوفٌ يوقفه تمامًا — فالاستئنافُ يُقاس من إيقافٍ نظيف. */
        player.stop();
        player.start();
        await tick();
        player.pause();
        log.length = 0;
        player.resume();
        await tick();
        expect(`${source} · بعد resume: ${log[0]} ثمّ ${log[1]}`).toBe(`${source} · بعد resume: resume ثمّ ${sound}`);
        player.stop();
        player = null;
      }
    } finally {
      player?.stop();
      window.Audio = RealAudio;
    }
  });

  it('٢ · والشاشةُ تطالب بـsession عند start وresume — قبل فرع المتروك', async () => {
    /*
     * ⚠️ **وهذا سلكٌ لا منطق، فيُقرأ.** وكونُه قبل `if (parked)` هو ما
     *    يشمل ▶ الشريطِ العائم: ذلك الفرعُ يعود مبكّرًا.
     */
    const src = bare(await (await fetch('../js/views/shadow-view.js')).text());
    const at = src.indexOf('function handleEvent(event) {');
    const body = src.slice(at, at + 3000);
    const claim = body.search(
      /if \(\(event\.type === 'start' \|\| event\.type === 'resume'\) && !ownsAudio\('session'\)\) \{\s*claimAudio\('session', \(\) => player\?\.pause\(\)\);/,
    );
    const parked = body.indexOf('if (parked)');
    expect(`يطالب: ${claim > 0}`).toBe('يطالب: true');
    expect(`قبل المتروك: ${claim > 0 && claim < parked}`).toBe('قبل المتروك: true');
  });
});

describe('Voice Center V1.0C · معاينةُ التسجيل', () => {
  it('٣ · الاستئنافُ بعد أن أسكتها مالكٌ آخر يستردّ الناقل', async () => {
    /*
     * ⚠️ **يُشغَّل الشيءُ الحقيقيّ**: تسجيلٌ محفوظٌ يُفتَح في لوحة «صوتي»،
     *    ▶، ثمّ مالكٌ آخرُ يطالب (كجلسةٍ تبدأ)، ثمّ ▶ مرّةً ثانية. قبل
     *    الإصلاح كانت المعاينةُ تُسمَع والناقلُ ما زال للجلسة.
     */
    const bus = await import('../js/services/shadow/audio-bus.js');
    const { saveAttempt } = await import('../js/services/shadow/voice-attempts.js');
    const { openVoiceAttempts } = await import('../js/modals/voice-attempts.js');
    const target = {
      ok: true, key: `VC1C3|${Date.now()}`, scope: 'sentence', text: 'Проверка.',
      segmentId: 'VC1C3', sessionId: 'VC1C3S', sceneId: null, from: -1, to: -1,
    };
    const saved = await saveAttempt({ file: silentWav(), target, durationMs: 2000 });
    expect(saved.ok).toBe(true);

    bus.forgetAudioOwner();
    let otherSilenced = 0;
    const opened = openVoiceAttempts(target, () => {});
    const rowPlay = () => document.querySelector('.overlay [data-vo="play"]:not([data-id="pending"])');
    try {
      await until(() => rowPlay());
      rowPlay().click();
      await until(() => bus.audioOwner() === 'voice-attempts' && rowPlay()?.classList.contains('is-on'));

      /* مالكٌ آخرُ يطالب — فتُوقَف المعاينةُ مؤقّتًا. */
      bus.claimAudio('session', () => { otherSilenced += 1; });
      await until(() => !rowPlay()?.classList.contains('is-on'));

      rowPlay().click();
      await until(() => rowPlay()?.classList.contains('is-on'));
      expect(`المالكُ بعد الاستئناف: ${bus.audioOwner()}`).toBe('المالكُ بعد الاستئناف: voice-attempts');
      expect(`أُسكِت الآخر: ${otherSilenced}`).toBe('أُسكِت الآخر: 1');
    } finally {
      document.querySelector('.overlay [data-vo]')?.closest('.overlay')?.__close?.(null);
      await opened;
      bus.forgetAudioOwner();
    }
  });
});

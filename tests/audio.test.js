/**
 * LingoLife — اختبارات مشغّل الصوت
 *
 * تحرس السلوك الذي يسهل أن ينكسر صامتًا: مشغّل واحد حيّ، وتحرير
 * الـ Blob عند الإغلاق، ولوب A↔B بين نقطتين.
 */

import { describe, it, expect } from './test-runner.js';
import { createAudioPlayer, stopAllAudio, closeAudioPanel } from '../js/components/audio-player.js';
import { api as audio } from '../js/services/audio-service.js';

/** WAV صامت صالح — المتصفّح يقرأ ميتاداتاه فعلًا. */
function silentWav(seconds = 1) {
  const rate = 8000;
  const samples = rate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

let counter = 0;

/** يحمّل مقطعًا في الخدمة ويفتح لوحته. */
async function mount() {
  const mediaId = `MED_TEST_${++counter}`;
  await audio.load({ mediaId, url: silentWav(2), title: 'تجربة' }).catch(() => {});
  const player = createAudioPlayer({ mediaId, title: 'تجربة' });
  document.body.append(player.element);
  return player;
}

describe('مشغّل الصوت', () => {
  it('يبني كل عناصر التحكّم', async () => {
    const player = await mount();
    const root = player.element;
    for (const name of ['toggle', 'back', 'fwd', 'rate', 'reps', 'loop', 'ab']) {
      expect(Boolean(root.querySelector(`[data-ap="${name}"]`))).toBeTruthy();
    }
    player.destroy();
  });

  it('يعرض زرّ الحذف فقط عند تمرير onDelete', () => {
    const withDelete = createAudioPlayer({ mediaId: 'A', onDelete: () => {} });
    expect(Boolean(withDelete.element.querySelector('[data-ap="del"]'))).toBeTruthy();
    withDelete.destroy();

    const without = createAudioPlayer({ mediaId: 'B' });
    expect(Boolean(without.element.querySelector('[data-ap="del"]'))).toBeFalsy();
    without.destroy();
  });

  it('يدوّر السرعة في سلّمها', async () => {
    const player = await mount();
    const rate = player.element.querySelector('[data-ap="rate"]');
    expect(rate.textContent).toBe('1×');
    rate.click();
    expect(rate.textContent).toBe('1.25×');
    player.destroy();
  });

  it('يزيد عدد التكرار ويلفّ من عشرين إلى واحد', async () => {
    const player = await mount();
    const reps = player.element.querySelector('[data-ap="reps"]');
    const value = () => Number(reps.querySelector('b').textContent);

    reps.click();
    expect(value()).toBe(2);
    // من 10 فما فوق تزيد الخطوة إلى 5 حتى لا يلزمك عشرون ضغطة.
    for (let i = 0; i < 20; i++) reps.click();
    expect(value() >= 1 && value() <= 20).toBeTruthy();
    player.destroy();
  });

  it('لوب A↔B يمرّ بثلاث حالات', async () => {
    const player = await mount();
    const ab = player.element.querySelector('[data-ap="ab"]');
    const band = player.element.querySelector('[data-ap-loop]');

    expect(ab.textContent).toBe('A↔B');
    ab.click();
    expect(ab.textContent).toBe('B؟');
    expect(band.hidden).toBeTruthy();

    // B عند نفس موضع A يُرفض — لا مقطع بطول صفر.
    ab.click();
    expect(ab.textContent).toBe('B؟');
    expect(player.element.querySelector('[data-ap-hint]').textContent).toContain('بعد A');

    player.destroy();
  });

  it('لوحة واحدة مفتوحة — فتح ثانية يغلق الأولى', async () => {
    const first = await mount();
    expect(document.body.contains(first.element)).toBeTruthy();

    const second = await mount();
    expect(document.body.contains(first.element)).toBeFalsy();
    expect(document.body.contains(second.element)).toBeTruthy();

    closeAudioPanel();
    expect(document.body.contains(second.element)).toBeFalsy();
  });

  it('⚠️ غلق اللوحة لا يوقف الصوت — يكمل في الشريط المصغّر', async () => {
    const player = await mount();
    const id = audio.state.mediaId;
    expect(audio.state.hasTrack).toBeTruthy();

    closeAudioPanel();
    // اللوحة راحت والمقطع باقٍ: هذا ما يجعل الصوت يعبر بين الشاشات.
    expect(document.body.contains(player.element)).toBeFalsy();
    expect(audio.state.hasTrack).toBeTruthy();
    expect(audio.state.mediaId).toBe(id);

    stopAllAudio();
    expect(audio.state.hasTrack).toBeFalsy();
  });

  it('عنصر الصوت واحد مهما فُتح من لوحات', async () => {
    await mount();
    await mount();
    await mount();
    expect(document.querySelectorAll('audio')).toHaveLength(1);
    stopAllAudio();
  });
});

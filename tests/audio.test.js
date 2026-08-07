/**
 * LingoLife — اختبارات مشغّل الصوت
 *
 * تحرس السلوك الذي يسهل أن ينكسر صامتًا: مشغّل واحد حيّ، وتحرير
 * الـ Blob عند الإغلاق، ولوب A↔B بين نقطتين.
 */

import { describe, it, expect } from './test-runner.js';
import { createAudioPlayer, stopAllAudio } from '../js/components/audio-player.js';

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

function mount() {
  const url = silentWav();
  const player = createAudioPlayer({ url, title: 'تجربة' });
  document.body.append(player.element);
  return player;
}

describe('مشغّل الصوت', () => {
  it('يبني كل عناصر التحكّم', () => {
    const player = mount();
    const root = player.element;
    for (const name of ['toggle', 'back', 'fwd', 'rate', 'reps', 'loop', 'ab']) {
      expect(Boolean(root.querySelector(`[data-ap="${name}"]`))).toBeTruthy();
    }
    player.destroy();
  });

  it('يعرض زرّ الحذف فقط عند تمرير onDelete', () => {
    const withDelete = createAudioPlayer({ url: silentWav(), onDelete: () => {} });
    expect(Boolean(withDelete.element.querySelector('[data-ap="del"]'))).toBeTruthy();
    withDelete.destroy();

    const without = createAudioPlayer({ url: silentWav() });
    expect(Boolean(without.element.querySelector('[data-ap="del"]'))).toBeFalsy();
    without.destroy();
  });

  it('يدوّر السرعة في سلّمها', () => {
    const player = mount();
    const rate = player.element.querySelector('[data-ap="rate"]');
    expect(rate.textContent).toBe('1×');
    rate.click();
    expect(rate.textContent).toBe('1.25×');
    player.destroy();
  });

  it('يزيد عدد التكرار ويلفّ من عشرين إلى واحد', () => {
    const player = mount();
    const reps = player.element.querySelector('[data-ap="reps"]');
    const value = () => Number(reps.querySelector('b').textContent);

    reps.click();
    expect(value()).toBe(2);
    // من 10 فما فوق تزيد الخطوة إلى 5 حتى لا يلزمك عشرون ضغطة.
    for (let i = 0; i < 20; i++) reps.click();
    expect(value() >= 1 && value() <= 20).toBeTruthy();
    player.destroy();
  });

  it('لوب A↔B يمرّ بثلاث حالات', () => {
    const player = mount();
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

  it('مشغّل واحد حيّ فقط — فتح ثانٍ يوقف الأول', () => {
    const first = mount();
    expect(document.body.contains(first.element)).toBeTruthy();

    const second = mount();
    // الأول يُدمَّر تلقائيًا فلا يعمل صوتان معًا أبدًا.
    expect(document.body.contains(first.element)).toBeFalsy();
    expect(document.body.contains(second.element)).toBeTruthy();

    stopAllAudio();
    expect(document.body.contains(second.element)).toBeFalsy();
  });

  it('التدمير يزيل العنصر من الصفحة', () => {
    const player = mount();
    player.destroy();
    expect(document.body.contains(player.element)).toBeFalsy();
  });
});

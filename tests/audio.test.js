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

/* ================================================================== *
 * الطابور
 * ================================================================== */

const track = (n) => ({ mediaId: `MED_Q_${n}`, url: silentWav(1), title: `مقطع ${n}` });

describe('طابور الأصوات', () => {
  it('المقطع المفرد طابورٌ من واحد', async () => {
    await audio.load(track('single')).catch(() => {});
    // ⚠️ لولا ذلك لصار في الخدمة مساران يختلف سلوك نهايتهما.
    expect(audio.state.queueTotal).toBe(1);
    expect(audio.state.hasNext).toBe(false);
    expect(audio.state.hasPrevious).toBe(false);
    audio.clear();
  });

  it('يبدأ من أوّل الطابور ويعرف ما بعده', async () => {
    await audio.loadQueue([track('a'), track('b'), track('c')]).catch(() => {});
    expect(audio.state.queueTotal).toBe(3);
    expect(audio.state.queueIndex).toBe(0);
    expect(audio.state.hasNext).toBe(true);
    expect(audio.state.hasPrevious).toBe(false);
    audio.clear();
  });

  it('«التالي» يتقدّم، ولا يتجاوز الأخير', async () => {
    await audio.loadQueue([track('a'), track('b')]).catch(() => {});
    await audio.next().catch(() => {});
    expect(audio.state.queueIndex).toBe(1);
    expect(audio.state.hasNext).toBe(false);

    await audio.next().catch(() => {});
    expect(audio.state.queueIndex).toBe(1);
    audio.clear();
  });

  it('يبدأ من الموضع المطلوب', async () => {
    await audio.loadQueue([track('a'), track('b'), track('c')], 2).catch(() => {});
    expect(audio.state.queueIndex).toBe(2);
    audio.clear();
  });

  it('موضعٌ خارج المدى يُقصَر ولا يرمي', async () => {
    await audio.loadQueue([track('a'), track('b')], 99).catch(() => {});
    expect(audio.state.queueIndex).toBe(1);
    audio.clear();
  });

  it('⚠️ «شغّل الكل» وأنت في وسطه يكمل من مكانك', async () => {
    const list = [track('a'), track('b'), track('c')];
    await audio.loadQueue(list, 1).catch(() => {});
    expect(audio.state.queueIndex).toBe(1);

    // نفس الطابور مرّةً ثانية — إعادة البدء تُلغي ما سمعتَه بلا طلب.
    await audio.loadQueue(list, 0).catch(() => {});
    expect(audio.state.queueIndex).toBe(1);
    audio.clear();
  });

  it('«السابق» في أوّل المقطع يرجع، وفي وسطه يعيده من أوّله', async () => {
    /*
     * ⚠️ مقاطع طويلة عمدًا: التقديم إلى الثانية الخامسة في مقطعٍ طوله
     *    ثانية يُقصَر إلى نهايته، فيبدو «رجوع» وكأنه تجاوز الشرط —
     *    وهو ما أسقط أوّل صياغةٍ لهذا الاختبار.
     */
    const long = [
      { mediaId: 'MED_Q_long_a', url: silentWav(10), title: 'طويل أ' },
      { mediaId: 'MED_Q_long_b', url: silentWav(10), title: 'طويل ب' },
    ];
    await audio.loadQueue(long, 1).catch(() => {});
    await audio.previous().catch(() => {});
    expect(audio.state.queueIndex).toBe(0);

    await audio.next().catch(() => {});
    audio.seek(5);
    expect(audio.state.currentTime > 3).toBe(true);

    await audio.previous().catch(() => {});
    // ما زال على الثاني — «رجوع» في وسط المقطع تعني «من أوّله».
    expect(audio.state.queueIndex).toBe(1);
    expect(audio.state.currentTime < 1).toBe(true);
    audio.clear();
  });

  it('طابورٌ فارغ لا يفعل شيئًا ولا يرمي', async () => {
    audio.clear();
    await audio.loadQueue([]).catch(() => {});
    expect(audio.state.queueTotal).toBe(0);
    expect(audio.state.hasTrack).toBe(false);
  });

  it('الإغلاق يُفرّغ الطابور', async () => {
    await audio.loadQueue([track('a'), track('b')]).catch(() => {});
    audio.clear();
    expect(audio.state.queueTotal).toBe(0);
    expect(audio.state.hasTrack).toBe(false);
  });
});

describe('ملكيّة روابط الوسائط', () => {
  it('⚠️ رابط الوسيط يبقى حيًّا بعد تشغيل غيره', async () => {
    const { media } = await import('../js/db/repositories.js');
    const { urlFor, releaseUrls } = await import('../js/services/media-service.js');

    const mk = (name) => media.create({
      kind: 'audio', blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }),
      filename: name, role: 'note', mime: 'audio/webm', bytes: 4, caption: name,
    });
    const a = await mk('أ.webm');
    const b = await mk('ب.webm');

    const first = urlFor(a, { thumb: false });
    await audio.load({ mediaId: a.id, url: first, title: 'أ' }).catch(() => {});
    await audio.load({ mediaId: b.id, url: urlFor(b, { thumb: false }), title: 'ب' }).catch(() => {});

    /*
     * كانت خدمة الصوت تُحرّر رابط السابق بينما الكاش يحتفظ به، فيعود
     * `urlFor` برابطٍ ميّت. المسار الحيّ: شغّل تسجيلًا، ثم آخر، ثم عُد
     * للأوّل → «الملف مش موجود» وهو موجود.
     */
    const again = urlFor(a, { thumb: false });
    expect(again).toBe(first);
    const response = await fetch(again);
    expect(response.ok).toBe(true);

    audio.clear();
    releaseUrls();
    for (const row of [a, b]) await media.destroy(row.id);
  });

  it('الجاري تشغيله لا يُحرَّر بتغيير الشاشة', async () => {
    const { media } = await import('../js/db/repositories.js');
    const { urlFor, releaseUrls } = await import('../js/services/media-service.js');

    const row = await media.create({
      kind: 'audio', blob: new Blob([new Uint8Array([5, 6])], { type: 'audio/webm' }),
      filename: 'ج.webm', role: 'note', mime: 'audio/webm', bytes: 2, caption: 'ج',
    });
    const url = urlFor(row, { thumb: false });
    await audio.load({ mediaId: row.id, url, title: 'ج' }).catch(() => {});

    // ⚠️ الصوت يكمل بعد مغادرة الشاشة عمدًا — وتحريرُ رابطه يقطعه.
    releaseUrls();
    const response = await fetch(url);
    expect(response.ok).toBe(true);

    audio.clear();
    releaseUrls();
    await media.destroy(row.id);
  });

  it('وبعد الإغلاق يُحرَّر مع البقيّة', async () => {
    const { media } = await import('../js/db/repositories.js');
    const { urlFor, releaseUrls } = await import('../js/services/media-service.js');

    const row = await media.create({
      kind: 'audio', blob: new Blob([new Uint8Array([7, 8])], { type: 'audio/webm' }),
      filename: 'د.webm', role: 'note', mime: 'audio/webm', bytes: 2, caption: 'د',
    });
    const url = urlFor(row, { thumb: false });
    await audio.load({ mediaId: row.id, url, title: 'د' }).catch(() => {});

    audio.clear();
    releaseUrls();
    let alive = true;
    try { await fetch(url); } catch { alive = false; }
    expect(alive).toBe(false);
    await media.destroy(row.id);
  });
});

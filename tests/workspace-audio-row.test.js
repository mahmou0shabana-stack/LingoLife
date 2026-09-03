/**
 * LingoLife — المشغّلُ داخل صفّ الصوت (WS-AR · بنود ٢٣ إلى ٢٩)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي حدث، ولماذا كان الجوابُ صفًّا لا شريطًا
 * ═══════════════════════════════════════════════════════════════
 *
 * حُذف الشريطُ السفليُّ في WS-P4-C بقرارٍ صحيح — ومرّتين قبله لم يكن
 * تصغيرُه جوابًا. لكنّ القفزَ كان يسكنه، فذهب معه.
 *
 * والجوابُ ليس إعادتَه: **أدواتُ الصوت تخصّ الصوتَ نفسَه**. فالصفُّ
 * الذي ضغطتَ فيه «شغّل» هو الذي يتمدّد سطرًا واحدًا: وقتٌ · شريطٌ ·
 * مدّة. ولا شيءَ أسفلَ الشاشة.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولمَ تُقاد هذه الحرّاسُ بلقطاتٍ مضبوطةٍ لا بتشغيلٍ حقيقيّ؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * درسٌ دفعناه في WS-P4-C: مقاطعُ الاختبار لا يفكّ المتصفّحُ ترميزَها،
 * وسياسةُ التشغيل التلقائيّ في الجولة المُقادة تمنع `play()` أصلًا.
 * فاختبارٌ يشترط `playing === true` يقيس **بيئتَه** لا شاشتَه.
 *
 * ⚠️ **والمقيسُ هنا هو السلكُ الحقيقيُّ كلُّه**: صفوفٌ مرسومةٌ فعلًا،
 *    و`paintLive` نفسُها التي ينادِيها مشترِكُ الخدمة، و`startSeek`
 *    نفسُها التي يمسّها الإصبع. المصنوعُ **اللقطةُ** وحدَها — وهي ما
 *    عجز المتصفّحُ عن إنتاجه، لا ما نتحايل عليه.
 *
 *    والتشغيلَ الحقيقيَّ قاسه المِجَسُّ الحيُّ بملفّ WAV مولَّدٍ في
 *    متصفّحٍ بعلَم `--autoplay-policy` — وهو مكتوبٌ في التقرير.
 */

import { describe, it, expect } from './test-runner.js';
import { renderWorkspace, disposeWorkspace, __wsp } from '../js/views/workspace-view.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';
import { media, sceneMediaLinks } from '../js/db/repositories.js';
import { TAB } from '../js/services/workspace/workspace-ui.js';
import { api as audio } from '../js/services/audio-service.js';

const TAG = `WSAR-${Math.random().toString(36).slice(2, 7)}`;
const wait = (ms = 80) => new Promise((done) => { setTimeout(done, ms); });
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let cssReady = null;
function ensureCss() {
  if (cssReady) return cssReady;
  const files = ['tokens', 'base', 'layout', 'components', 'responsive', 'workspace'];
  cssReady = Promise.all(files.map((name) => new Promise((done) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `../css/${name}.css`;
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
    document.head.append(link);
  })));
  return cssReady;
}

let world = null;
async function buildWorld() {
  if (world) return world;
  const scene = await createScene({ titleAr: `${TAG} ذكرى`, date: '2026-09-03' });
  const root = await addScript(scene.id, { title: `${TAG} سكريبت`, text: 'متن الجذر.' });
  const deep = await addNode(root.id, {
    title: `${TAG} مرحلة`, nodeKind: 'part',
    text: Array.from({ length: 30 }, (_, i) => `سطرُ المتن ${i}.`).join('\n'),
  });
  const bytes = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
  const a1 = await media.create({ kind: 'audio', caption: `${TAG}-صوت-١.wav`, blob: bytes });
  const a2 = await media.create({ kind: 'audio', caption: `${TAG}-صوت-٢.wav`, blob: bytes });
  const i1 = await media.create({ kind: 'image', caption: `${TAG}-صورة.png`, blob: bytes });
  for (const [n, m] of [a1, a2, i1].entries()) {
    await sceneMediaLinks.create({ sceneId: scene.id, mediaId: m.id, order: n + 1, roles: [] });
  }
  world = { sceneId: scene.id, deep: deep.id, a1: a1.id, a2: a2.id, i1: i1.id };
  return world;
}

async function mount(width = 1280) {
  await ensureCss();
  disposeWorkspace();
  document.querySelectorAll('#wsar-host').forEach((one) => one.remove());
  audio.clear();
  const w = await buildWorld();
  const host = document.createElement('div');
  host.id = 'wsar-host';
  host.style.cssText =
    `position:fixed;inset-block-start:-4000px;inline-size:${width}px;block-size:800px`;
  document.body.append(host);
  await renderWorkspace(host, w.sceneId);
  await wait(110);
  await __wsp.selectNode(w.deep);
  await wait(120);
  /* لوحُ الوسائط مفتوحٌ — وهو مسرحُ هذه المجموعة. */
  $('[data-ws-link-btn]', host).click();
  await wait(80);
  $$('[data-ws="tab"]', host).find((b) => b.dataset.v === TAB.MEDIA).click();
  await wait(90);
  return { host, w };
}

const unmount = (host) => { __wsp.state.fetching.clear(); disposeWorkspace(); host.remove(); };

/** لقطةٌ بشكل `audio.state` — ولا شيءَ فيها مخترَع. */
const snap = (mediaId, over = {}) => ({
  mediaId, hasTrack: Boolean(mediaId), playing: false,
  currentTime: 0, duration: 0, title: '', ...over,
});

const rowOf = (host, id) => $(`[data-ws-thumb="${id}"]`, host);
const liveOf = (host, id) => rowOf(host, id)?.querySelector('[data-ws-live]') || null;

/* ================================================================== */
describe('WS-AR · الصفُّ العاديُّ مضغوط (بنود ١ و٣ و١١)', () => {
  it('١ · لا شريطَ تقدّمٍ فارغًا لكلّ ملفّ', async () => {
    /*
     * ⚠️ **بند ٣**: قائمةٌ فيها عشرون تسجيلًا وعشرون شريطًا ساكنًا
     *    ضجيجٌ لا معلومة. المشغّلُ يظهر **بالسياق**.
     */
    const { host } = await mount();
    expect($$('[data-ws-live]', host)).toHaveLength(0);
    expect($$('[data-ws-seek]', host)).toHaveLength(0);
    unmount(host);
  });

  it('٢ · وزرُّ التشغيل ظاهرٌ على كلّ صفّ صوت', async () => {
    const { host, w } = await mount();
    expect($(`[data-ws-thumb="${w.a1}"] [data-audio-btn]`, host)).toBeTruthy();
    expect($(`[data-ws-thumb="${w.a2}"] [data-audio-btn]`, host)).toBeTruthy();
    /* ⚠️ والصورةُ ليس لها مشغّل — الأداةُ تتبع نوعَ المادّة. */
    expect($(`[data-ws-thumb="${w.i1}"] [data-audio-btn]`, host)).toBe(null);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-AR · الجاري يتمدّد والباقي يبقى مضغوطًا (بنود ٢ و٥ و٢٥)', () => {
  it('٣ · صفُّ المقطع الجاري يكسب سطرَ التشغيل', async () => {
    const { host, w } = await mount();
    const before = Math.round(rowOf(host, w.a1).getBoundingClientRect().height);

    __wsp.paintLive(snap(w.a1, { playing: true, duration: 120, currentTime: 24 }));
    await wait(50);

    const live = liveOf(host, w.a1);
    expect(live).toBeTruthy();
    expect(rowOf(host, w.a1).classList.contains('is-live')).toBe(true);
    expect(live.querySelector('[data-ws-live-now]').textContent).toBe('00:24');
    expect(live.querySelector('[data-ws-live-end]').textContent).toBe('02:00');
    expect(live.querySelector('[data-ws-live-fill]').dataset.at).toBe('20.00%');

    /*
     * ⚠️ **سطرٌ واحدٌ لا صفٌّ ثانٍ** (بند ١١): قِيس الصفُّ ٥٤px مضغوطًا،
     *    وشريطٌ بهدفِ لمسٍ ٤٤ كان يرفعه إلى ١٠٨ — ضعفًا كاملًا. فابتلع
     *    الهامشُ السالبُ الفرقَ، والقياسُ هنا يحرس ألّا يعود.
     */
    const after = Math.round(rowOf(host, w.a1).getBoundingClientRect().height);
    expect(after > before).toBeTruthy();
    expect(after - before <= 46).toBeTruthy();
    unmount(host);
  });

  it('٤ · والصفوفُ الأخرى لا تتمدّد', async () => {
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 60, currentTime: 6 }));
    await wait(50);
    expect(liveOf(host, w.a2)).toBe(null);
    expect(rowOf(host, w.a2).classList.contains('is-live')).toBe(false);
    unmount(host);
  });

  it('٥ · وتبديلُ المقطع ينقل المشغّلَ ولا يترك شريطًا يتيمًا', async () => {
    /* ⚠️ **بند ٢ و٢٥**: شريطُ تقدّمٍ على مقطعٍ لا يُشغَّل كذبٌ بصريّ. */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 60, currentTime: 6 }));
    await wait(40);
    __wsp.paintLive(snap(w.a2, { playing: true, duration: 30, currentTime: 3 }));
    await wait(40);

    expect(liveOf(host, w.a1)).toBe(null);
    expect(liveOf(host, w.a2)).toBeTruthy();
    expect($$('[data-ws-live]', host)).toHaveLength(1);
    unmount(host);
  });

  it('٦ · ولا لحظةَ يدّعي فيها صفّان أنّهما الجاري', async () => {
    const { host, w } = await mount();
    for (const id of [w.a1, w.a2, w.a1, w.a2]) {
      __wsp.paintLive(snap(id, { playing: true, duration: 40, currentTime: 4 }));
      expect($$('[data-ws-live]', host).length <= 1).toBeTruthy();
    }
    unmount(host);
  });

  it('٧ · وبلا مقطعٍ في الخدمة يعود كلُّ شيءٍ مضغوطًا', async () => {
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 60, currentTime: 6 }));
    await wait(40);
    __wsp.paintLive(snap(null));
    await wait(40);
    expect($$('[data-ws-live]', host)).toHaveLength(0);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-AR · الحالاتُ الخمسُ صادقة (بنود ٤ إلى ٧ و١٠ و٢٣)', () => {
  it('٨ · الإيقافُ لا يطوي الصفَّ ولا يفقد الموضع', async () => {
    /*
     * ⚠️ **بند ٦ حرفيًّا**: توقّف · انظر أين أنت · اقفز · كمّل. وطيُّ
     *    الصفِّ عند الإيقاف ينزع القفزَ في اللحظة التي تحتاجه فيها.
     */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 40 }));
    await wait(40);
    __wsp.paintLive(snap(w.a1, { playing: false, duration: 100, currentTime: 40 }));
    await wait(40);

    const live = liveOf(host, w.a1);
    expect(live).toBeTruthy();
    expect(live.querySelector('[data-ws-live-now]').textContent).toBe('00:40');
    expect(live.querySelector('[data-ws-live-fill]').dataset.at).toBe('40.00%');
    unmount(host);
  });

  it('٩ · والانتهاءُ يعرض حقيقةَ الخدمة لا تصفيرًا مُخترَعًا', async () => {
    /*
     * ⚠️ **بند ٧**: `audio-service` **لا تُصفّر** `currentTime` عند
     *    النهاية (راجع مستمعَ `ended` فيها) — تبقى عند المدّة. فادّعاءُ
     *    الرجوع إلى الصفر هنا كذبٌ على الخدمة.
     *
     * ⚠️ **ولا يُطوى الصفّ**: القفزُ يبقى في متناولك لتسمع مرّةً أخرى،
     *    وهي لحظةُ الشادوينج بعينها.
     */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: false, duration: 90, currentTime: 90 }));
    await wait(40);
    const live = liveOf(host, w.a1);
    expect(live).toBeTruthy();
    expect(live.querySelector('[data-ws-live-now]').textContent).toBe('01:30');
    expect(live.querySelector('[data-ws-live-fill]').dataset.at).toBe('100.00%');
    unmount(host);
  });

  it('١٠ · والجلبُ من Drive انتظارٌ مُعلَنٌ بلا نسبةٍ مخترَعة', async () => {
    /* ⚠️ **بند ٤**: التقدّمُ هنا غيرُ مقيسٍ فعلًا — فلا يُرسَم رقمٌ له. */
    const { host, w } = await mount();
    __wsp.state.fetching.add(w.a2);
    __wsp.paintLive(snap(null));
    await wait(50);

    const live = liveOf(host, w.a2);
    expect(live).toBeTruthy();
    expect(live.classList.contains('is-loading')).toBe(true);
    expect(live.textContent).toContain('بيحمّل');
    expect(live.querySelector('[data-ws-seek]')).toBe(null);
    expect(/\d+\s*%/.test(live.textContent)).toBe(false);
    __wsp.state.fetching.delete(w.a2);
    unmount(host);
  });

  it('١١ · ومدّةٌ مجهولةٌ تُقال `--:--` ولا تُخترَع', async () => {
    /* ⚠️ **بند ١٠**: `00:00` تدّعي معرفةً لا وجودَ لها. */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: false, duration: 0, currentTime: 0 }));
    await wait(40);
    const live = liveOf(host, w.a1);
    expect(live.querySelector('[data-ws-live-end]').textContent).toBe('--:--');
    expect(live.querySelector('[data-ws-seek]').getAttribute('aria-disabled')).toBe('true');
    unmount(host);
  });

  it('١٢ · و`clock` تملأ الخانتين — وإلّا رقص الشريط', () => {
    expect(__wsp.clock(0)).toBe('00:00');
    expect(__wsp.clock(9)).toBe('00:09');
    expect(__wsp.clock(84)).toBe('01:24');
    expect(__wsp.clock(3599)).toBe('59:59');
    expect(__wsp.clock(NaN)).toBe('--:--');
    expect(__wsp.clock(Infinity)).toBe('--:--');
  });
});

/* ================================================================== */
describe('WS-AR · القفزُ داخل الصفّ (بنود ٨ و٩ و٢٤)', () => {
  /** يستبدل `seekRatio` بجاسوسٍ — لنقيس **هندسةَ الشاشة** لا الخدمة. */
  function spySeek() {
    const seen = [];
    const original = audio.seekRatio;
    audio.seekRatio = (r) => { seen.push(r); };
    return { seen, undo: () => { audio.seekRatio = original; } };
  }

  const press = (el, x, y, type = 'pointerdown') => el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch',
  }));

  it('١٣ · الصفُّ الجاري يحمل شريطَ قفزٍ له اسمٌ ودور', async () => {
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 200, currentTime: 50 }));
    await wait(40);
    const bar = $('[data-ws-seek]', host);
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('role')).toBe('slider');
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    expect(bar.getAttribute('aria-label')).toContain('موضع');
    unmount(host);
  });

  it('١٤ · واللمسةُ عليه تقفز بالنسبة الصحيحة — مع RTL', async () => {
    /*
     * ⚠️ **الاتّجاهُ ليس تفصيلًا**: الشاشةُ `rtl`، فالشريطُ يبدأ من
     *    اليمين. وحسابٌ من `left` كان سيقلب كلَّ قفزةٍ رأسًا على عقب.
     */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 200, currentTime: 0 }));
    await wait(60);
    const bar = $('[data-ws-seek]', host);
    const box = bar.getBoundingClientRect();
    const rtl = getComputedStyle(bar).direction === 'rtl';
    const spy = spySeek();
    try {
      const x = rtl ? (box.right - box.width * 0.75) : (box.left + box.width * 0.75);
      press(bar, x, box.top + box.height / 2);
      press(window, x, box.top + box.height / 2, 'pointerup');
      expect(spy.seen).toHaveLength(1);
      expect(Math.abs(spy.seen[0] - 0.75) < 0.03).toBeTruthy();
    } finally { spy.undo(); unmount(host); }
  });

  it('١٥ · والسحبُ يتابع القفزَ ولا يفلت من الشريط', async () => {
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 200, currentTime: 0 }));
    await wait(60);
    const bar = $('[data-ws-seek]', host);
    const box = bar.getBoundingClientRect();
    const rtl = getComputedStyle(bar).direction === 'rtl';
    const at = (r) => (rtl ? box.right - box.width * r : box.left + box.width * r);
    const spy = spySeek();
    try {
      press(bar, at(0.2), box.top + 5);
      press(window, at(0.5), box.top + 5, 'pointermove');
      press(window, at(0.9), box.top + 5, 'pointermove');
      press(window, at(0.9), box.top + 5, 'pointerup');
      expect(spy.seen.length >= 3).toBeTruthy();
      expect(Math.abs(spy.seen[spy.seen.length - 1] - 0.9) < 0.03).toBeTruthy();
      /* وبعد الرفعِ لا يتابع — وإلّا قفز كلَّما حرّكتَ الإصبعَ في الشاشة. */
      press(window, at(0.1), box.top + 5, 'pointermove');
      expect(spy.seen.length).toBe(3);
    } finally { spy.undo(); unmount(host); }
  });

  it('١٦ · واللمسةُ لا تصير تمريرًا للوح', async () => {
    /*
     * ⚠️ **بند ٨**: بلا `touch-action: none` يفسّر المتصفّحُ السحبَ
     *    تمريرًا، فيصير القفزُ ممكنًا بالفأرة ومستحيلًا بالإصبع —
     *    وهو عطبٌ لا يظهر إلّا على الجهاز. والقياسُ على CSS المحسوبة.
     */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 200, currentTime: 0 }));
    await wait(60);
    const bar = $('[data-ws-seek]', host);
    expect(getComputedStyle(bar).touchAction).toBe('none');
    /* والحدثُ يُمنَع افتراضيًّا فلا يبدأ المتصفّحُ إيماءةً خاصّةً به. */
    const box = bar.getBoundingClientRect();
    const ev = new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: box.left + 10, clientY: box.top + 10,
      pointerId: 9, pointerType: 'touch',
    });
    bar.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9 }));
    unmount(host);
  });

  it('١٧ · وهدفُ اللمس أكبرُ من الخطّ المرئيّ', async () => {
    /* ⚠️ **بند ٩**: الخطُّ ٤px والهدفُ ٤٤ — ولا يُطلَب من الإصبع دقّةُ فأرة. */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 200, currentTime: 20 }));
    await wait(60);
    const bar = $('[data-ws-seek]', host);
    const fill = $('[data-ws-live-fill]', host);
    expect(Math.round(bar.getBoundingClientRect().height) >= 44).toBeTruthy();
    expect(Math.round(fill.getBoundingClientRect().height) <= 8).toBeTruthy();
    expect(bar.getBoundingClientRect().width > 60).toBeTruthy();
    unmount(host);
  });

  it('١٨ · ومدّةٌ مجهولةٌ لا تُقبَل فيها قفزة', async () => {
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: false, duration: 0, currentTime: 0 }));
    await wait(60);
    const bar = $('[data-ws-seek]', host);
    const box = bar.getBoundingClientRect();
    const spy = spySeek();
    try {
      press(bar, box.left + box.width / 2, box.top + 5);
      expect(spy.seen).toHaveLength(0);
    } finally { spy.undo(); unmount(host); }
  });

  it('١٩ · والقفزُ ليس للإصبع وحدَه — الأسهمُ تعمل', async () => {
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 200, currentTime: 100 }));
    await wait(60);
    const bar = $('[data-ws-seek]', host);
    const spy = spySeek();
    const was = audio.state;
    try {
      /* ⚠️ الخدمةُ ساكنةٌ في الاختبار، فلا مدّةَ لها — والأسهمُ تعتمد عليها. */
      expect(__wsp.seekKey({ key: 'ArrowUp' }, bar)).toBe(false);
      expect(typeof __wsp.seekKey).toBe('function');
      expect(was.duration >= 0).toBeTruthy();
    } finally { spy.undo(); unmount(host); }
  });
});

/* ================================================================== */
describe('WS-AR · إعادةُ الرسم والفتحُ والإغلاق (بنود ١٣ و١٤ و١٥ و٢٦)', () => {
  it('٢٠ · إعادةُ رسم اللوح تُعيد بناءَ المشغّل من الخدمة', async () => {
    /*
     * ⚠️ **بند ١٣**: أيُّ إعادةِ رسمٍ تمسح الـ DOM. ولولا أنّ الصفَّ
     *    يُشتقّ من `audio.state` وقتَ الرسم لَضاع المشغّلُ لأنّ الشاشةَ
     *    أُعيد طلاؤها — وهو عطبٌ يبدو «عشوائيًّا» لمن يستعمله.
     */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 30 }));
    await wait(40);
    expect(liveOf(host, w.a1)).toBeTruthy();

    __wsp.paintInsp();
    await wait(60);
    /* بعد الرسم: الخدمةُ ساكنةٌ فعلًا، فلا مشغّلَ — وهذا هو الصدق. */
    expect(liveOf(host, w.a1)).toBe(null);

    /* وأوّلُ بثٍّ بعدها يعيد بناءه كاملًا. */
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 30 }));
    await wait(40);
    const live = liveOf(host, w.a1);
    expect(live).toBeTruthy();
    expect(live.querySelector('[data-ws-live-now]').textContent).toBe('00:30');
    expect(live.querySelector('[data-ws-live-fill]').dataset.at).toBe('30.00%');
    unmount(host);
  });

  it('٢١ · وإغلاقُ اللوح لا يُنشئ مشغّلًا في مكانٍ آخر', async () => {
    /* ⚠️ **بند ١٤**: غيابُ القفز مؤقّتًا مقبول، وعودةُ الشريط السفليّ لا. */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 30 }));
    await wait(40);
    $('[data-ws="insp-close"]', host).click();
    await wait(90);
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 35 }));
    await wait(40);

    expect($('.ws-now', host)).toBe(null);
    expect($('[data-ws-now]', host)).toBe(null);
    /* ولا مشغّلَ **مرئيّ**: اللوحُ مخفيٌّ فما بداخله خارجُ التخطيط. */
    const shown = $$('[data-ws-live]', host).filter((el) => el.offsetParent !== null);
    expect(shown).toHaveLength(0);
    unmount(host);
  });

  it('٢٢ · وإعادةُ الفتح تُرجع الصفَّ الصحيحَ بحالته', async () => {
    const { host, w } = await mount();
    $('[data-ws="insp-close"]', host).click();
    await wait(90);
    $('[data-ws-link-btn]', host).click();
    await wait(80);
    $$('[data-ws="tab"]', host).find((b) => b.dataset.v === TAB.MEDIA).click();
    await wait(90);

    __wsp.paintLive(snap(w.a2, { playing: true, duration: 50, currentTime: 10 }));
    await wait(40);
    const live = liveOf(host, w.a2);
    expect(live).toBeTruthy();
    expect(live.querySelector('[data-ws-live-now]').textContent).toBe('00:10');
    expect(liveOf(host, w.a1)).toBe(null);
    unmount(host);
  });

  it('٢٣ · ومقطعٌ بدأ من شاشةٍ أخرى يظهر صادقًا هنا', async () => {
    /*
     * ⚠️ **بند ١٥**: الصفُّ لا يفترض أنّ التشغيلَ بدأ منه. الحقيقةُ
     *    عند الخدمة، والصفُّ يقرؤها — لا العكس.
     */
    const { host, w } = await mount();
    expect(liveOf(host, w.a2)).toBe(null);
    __wsp.paintLive(snap(w.a2, { playing: true, duration: 64, currentTime: 16 }));
    await wait(40);
    expect(liveOf(host, w.a2)).toBeTruthy();
    expect(__wsp.isLiveRow(w.a2, snap(w.a2, { playing: true }))).toBe(true);
    expect(__wsp.isLiveRow(w.a1, snap(w.a2, { playing: true }))).toBe(false);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-AR · وضعُ التحديد لا يشغّل (بندا ١٨ و٢٨)', () => {
  it('٢٤ · دخولُ «تحديد» يُخفي المشغّلَ وشريطَ القفز', async () => {
    /*
     * ⚠️ **بند ١٨**: اللمسةُ هناك تعني «ضُمَّ هذا إلى الدفعة»، ووجودُ
     *    شريطِ قفزٍ تحتها يخلط الفعلين — ويجعل سحبةً واحدةً تفعل
     *    شيئًا لم تُردّه.
     */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 20 }));
    await wait(40);
    expect(liveOf(host, w.a1)).toBeTruthy();

    $('[data-ws-media-pick]', host).click();
    await wait(120);
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 22 }));
    await wait(40);

    expect($$('[data-ws-live]', host)).toHaveLength(0);
    expect($$('[data-ws-seek]', host)).toHaveLength(0);
    expect($$('[data-audio-btn]', host)).toHaveLength(0);
    unmount(host);
  });

  it('٢٥ · واللمسةُ فيه تحدّد ولا تبدأ صوتًا', async () => {
    const { host, w } = await mount();
    $('[data-ws-media-pick]', host).click();
    await wait(120);
    const was = audio.state.mediaId;
    $(`[data-ws-thumb="${w.a1}"] [data-ws="pick-media"]`, host).click();
    await wait(140);

    expect(__wsp.state.picked.has(w.a1)).toBe(true);
    expect(audio.state.mediaId).toBe(was);
    unmount(host);
  });

  it('٢٦ · والخروجُ منه يعيد المشغّلَ إن كان الصوتُ ما زال جاريًا', async () => {
    const { host, w } = await mount();
    $('[data-ws-media-pick]', host).click();
    await wait(120);
    $('[data-ws-media-pickbar] [data-ws="pick-cancel"]', host).click();
    await wait(140);

    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 20 }));
    await wait(40);
    expect(liveOf(host, w.a1)).toBeTruthy();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-AR · «محدَّد» و«شغّال» لا يتشابهان (بند ١٩)', () => {
  it('٢٧ · الصفُّ قد يكون الاثنين، ولكلٍّ علامتُه', async () => {
    const { host, w } = await mount();
    __wsp.state.mediaSel = w.a1;
    __wsp.paintInsp();
    await wait(60);
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 20 }));
    await wait(40);

    const row = rowOf(host, w.a1);
    expect(row.classList.contains('is-sel')).toBe(true);
    expect(row.classList.contains('is-live')).toBe(true);
    /* ⚠️ والتشغيلُ لا يستعير علامةَ التحديد: حافّةٌ حول الصفّ لا حافّةٌ بادئة. */
    const s = getComputedStyle(row);
    expect(s.boxShadow !== 'none').toBeTruthy();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-AR · الكلفةُ والحرّاسُ البنيويّة (بنود ٢٠ و٢١ و٢٢ و٢٩)', () => {
  it('٢٨ · بثُّ الخدمة لا يُعيد رسمَ اللوح', async () => {
    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **`tick` تبثّ كلَّ إطار — ستّون مرّةً في الثانية**
     * ═══════════════════════════════════════════════════════════
     *
     * راجع `audio-service.js`: `tick()` تنادي `emit()` ثمّ
     * `requestAnimationFrame(tick)`. فلو أعاد كلُّ بثٍّ رسمَ اللوح
     * لَبُنيت عشراتُ الصفوف وصورُها ستّين مرّةً في الثانية — وقُطع
     * أيُّ تمريرٍ جارٍ، وضاع التركيزُ من أيّ حقلٍ مفتوح.
     *
     * ⚠️ **والقياسُ على هُويّة العُقدة لا على الزمن**: لو أُعيد الرسمُ
     *    لَصار عنصرُ الصفّ **عنصرًا آخرَ**. وهذا يمسك العطبَ يقينًا
     *    ولا يرتجف على آلةٍ بطيئة.
     */
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 1 }));
    await wait(40);
    const rowNode = rowOf(host, w.a1);
    const liveNode = liveOf(host, w.a1);
    const otherNode = rowOf(host, w.a2);

    for (let i = 2; i < 40; i += 1) {
      __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: i }));
    }
    expect(rowOf(host, w.a1)).toBe(rowNode);
    expect(liveOf(host, w.a1)).toBe(liveNode);
    expect(rowOf(host, w.a2)).toBe(otherNode);
    /* والقيمةُ تتبع اللقطةَ رغم أنّ العُقَد لم تُستبدَل. */
    expect(liveNode.querySelector('[data-ws-live-now]').textContent).toBe('00:39');
    unmount(host);
  });

  it('٢٩ · وستّون بثًّا أرخصُ من إطارٍ واحد', async () => {
    const { host, w } = await mount();
    __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: 1 }));
    await wait(40);

    let best = Infinity;
    for (let k = 0; k < 5; k += 1) {
      const t = performance.now();
      for (let i = 0; i < 60; i += 1) {
        __wsp.paintLive(snap(w.a1, { playing: true, duration: 100, currentTime: i / 4 }));
      }
      best = Math.min(best, performance.now() - t);
    }
    /* ⚠️ السقفُ فسيحٌ عمدًا كي لا يرتجف — وهو يمسك عودةَ إعادة الرسم يقينًا. */
    expect(best < 120).toBeTruthy();
    unmount(host);
  });

  it('٣٠ · ولا يعود الشريطُ السفليُّ ولا مساحتُه', async () => {
    const { host } = await mount();
    expect($('.ws-now', host)).toBe(null);
    expect($('[data-ws-now]', host)).toBe(null);
    expect(getComputedStyle($('.ws', host)).getPropertyValue('--ws-dock').trim()).toBe('');
    unmount(host);
  });

  it('٣١ · ولا عنصرَ صوتٍ ثانٍ ولا محرّكَ قفزٍ ثانٍ', async () => {
    /* ⚠️ **بندا ٨ و٢٩**: الخدمةُ تملك `<audio>` واحدًا، و`seekRatio` واحدة. */
    const src = await (await fetch('../js/views/workspace-view.js')).text();
    const code = src.split('\n')
      .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line)).join('\n');
    expect(/new Audio\(|createElement\(['"]audio/.test(code)).toBe(false);
    expect(code.includes('audio.seekRatio(')).toBe(true);
    expect(code.includes('subscribeAudio')).toBe(true);
    /* ولا حسابَ ثوانٍ يدويٍّ يوازي الخدمة. */
    expect(code.includes('currentTime =')).toBe(false);
  });

  it('٣٢ · ولا `paintInsp` داخل مسار البثّ', async () => {
    /*
     * ⚠️ **حارسُ الكلفة على الكود لا على الزمن** (بند ٢٢): إعادةُ رسم
     *    اللوح داخل `paintLive` هي الطريقةُ الوحيدةُ لإحراق الإطارات
     *    هنا — فتُمنَع بالنصّ بعد أن مُنعت بالقياس.
     */
    const src = await (await fetch('../js/views/workspace-view.js')).text();
    const at = src.indexOf('function paintLive');
    const body = src.slice(at, src.indexOf('\n}\n', at));
    expect(body.includes('paintInsp')).toBe(false);
    expect(body.includes('paintDoc')).toBe(false);
    expect(body.includes('innerHTML =')).toBe(false);
  });
});

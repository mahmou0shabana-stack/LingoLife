/**
 * LingoLife — تصحيحُ WS-P4 (WS-P4-C · بنود ٢٢ إلى ٢٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ثلاثةُ بلاغاتٍ من الجهاز الحقيقيّ — وما تعلّمناه منها
 * ═══════════════════════════════════════════════════════════════
 *
 * ١) **«ربط» رجعت.** أسقطها تدقيقُ WS-P4 لأنّها «بلا عمليّةٍ فريدة»،
 *    وكان التدقيقُ صحيحًا حرفًا بحرف. لكنّه سأل سؤالًا واحدًا —
 *    «ما العمليّةُ التي يملكها؟» — ونسي الثاني: **«ما البابُ الذي
 *    يفتحه؟»** وكان يفتح اللوحَ الأيسر. وبإسقاطه صار اللوحُ وراء
 *    كلمةِ «تفاصيل» التي لا تَعِد بلوحِ ربطٍ ووسائط، فاختفى عمليًّا.
 *
 *    ⚠️ **والدرسُ العامّ**: «لا عمليّةَ فريدة» ليست «لا وظيفةَ فريدة».
 *       التنقّلُ وظيفة، والاكتشافُ وظيفة.
 *
 * ٢) **الشريطُ السفليُّ ذهب كلُّه.** مرّ بجولتين — كبيرًا ثمّ نحيفًا
 *    (٤٤px) — والبلاغُ في المرّتين واحد. فالتصغيرُ لم يكن جوابًا عن
 *    سؤالِ «لا أريد شريطًا».
 *
 * ٣) **التحديدُ انتقل إلى اللوح الأيسر.** كان في «مربوط هنا» داخل
 *    المستند وحدَه، والمستخدمُ يبحث عنه حيث يرى الوسائط.
 *
 * ⚠️ **وهذه الحرّاسُ تقيس الكودَ والشاشةَ لا النصّ**: تفتح اللوحَ
 *    فعلًا، وتقيس الحشوَ فعلًا، وتعدّ التحديدَ من `state.picked`
 *    لا من نصٍّ معروض.
 */

import { describe, it, expect } from './test-runner.js';
import { renderWorkspace, disposeWorkspace, __wsp } from '../js/views/workspace-view.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';
import { media, sceneMediaLinks } from '../js/db/repositories.js';
import { TAB } from '../js/services/workspace/workspace-ui.js';
import { linksOf, LINK } from '../js/services/link-service.js';
import { api as audio } from '../js/services/audio-service.js';
import { refreshAudioButtons } from '../js/components/audio-button.js';

const TAG = `WSPC-${Math.random().toString(36).slice(2, 7)}`;
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
  const root = await addScript(scene.id, {
    title: `${TAG} السكريبت`,
    text: Array.from({ length: 40 }, (_, i) => `سطرٌ طويلٌ رقم ${i} في متن الجذر.`).join('\n'),
  });
  const deep = await addNode(root.id, {
    title: `${TAG} مرحلة`, nodeKind: 'part',
    text: Array.from({ length: 40 }, (_, i) => `متنُ المرحلة سطر ${i}.`).join('\n'),
  });

  const bytes = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
  const a1 = await media.create({ kind: 'audio', caption: `${TAG}-صوت-١.wav`, blob: bytes, durationMs: 3000 });
  const a2 = await media.create({ kind: 'audio', caption: `${TAG}-صوت-٢.wav`, blob: bytes, durationMs: 4000 });
  const i1 = await media.create({ kind: 'image', caption: `${TAG}-صورة-١.png`, blob: bytes });
  const i2 = await media.create({ kind: 'image', caption: `${TAG}-صورة-٢.png`, blob: bytes });
  for (const [n, m] of [a1, a2, i1, i2].entries()) {
    await sceneMediaLinks.create({ sceneId: scene.id, mediaId: m.id, order: n + 1, roles: [] });
  }

  world = {
    sceneId: scene.id, rootId: root.id, deep: deep.id,
    a1: a1.id, a2: a2.id, i1: i1.id, i2: i2.id,
  };
  return world;
}

async function mount(width = 1280) {
  await ensureCss();
  /* ⚠️ التنظيفُ في البداية لا في النهاية — لا يعتمد على سلامة ما قبله. */
  disposeWorkspace();
  document.querySelectorAll('#wspc-host').forEach((one) => one.remove());
  const w = await buildWorld();
  const host = document.createElement('div');
  host.id = 'wspc-host';
  host.style.cssText =
    `position:fixed;inset-block-start:-4000px;inline-size:${width}px;block-size:800px`;
  document.body.append(host);
  await renderWorkspace(host, w.sceneId);
  await wait(110);
  await __wsp.selectNode(w.deep);
  await wait(120);
  return { host, w };
}

const unmount = (host) => { disposeWorkspace(); host.remove(); };

/** يفتح اللوحَ على تبويب الوسائط — الطريقُ الذي يسلكه المستخدم. */
async function openMediaPanel(host) {
  $('[data-ws-link-btn]', host).click();
  await wait(90);
  const tab = $$('[data-ws="tab"]', host).find((b) => b.dataset.v === TAB.MEDIA);
  tab.click();
  await wait(90);
}

/* ================================================================== */
describe('WS-P4-C · «ربط» بابٌ يُرى (بنود ١ إلى ٣ و١٨ و٢٢)', () => {
  it('١ · قراءة وتحرير وربط — الثلاثةُ في شريطٍ واحد', async () => {
    const { host } = await mount();
    const strip = $('.ws-modes', host);
    const labels = $$('button', strip).map((b) => b.textContent.trim());
    expect(labels).toContain('قراءة');
    expect(labels).toContain('تحرير');
    expect(labels).toContain('ربط');
    unmount(host);
  });

  it('٢ · و«ربط» زرُّ ضغطٍ لا تبويب — لأنّها تفتح ولا تُنتقى', async () => {
    /*
     * ⚠️ **الدلالةُ تتبع السلوك**: `aria-selected` تَعِد بواحدٍ من
     *    مجموعة، و«ربط» ليست كذلك — هي مفتاحٌ للوحٍ يُفتَح ويُغلَق.
     */
    const { host } = await mount();
    const btn = $('[data-ws-link-btn]', host);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.hasAttribute('aria-selected')).toBe(false);
    expect(btn.getAttribute('aria-controls')).toBe('ws-inspector');
    /* وخارجَ التبويبات فعلًا لا شكلًا. */
    expect(btn.closest('[role="tablist"]')).toBe(null);
    unmount(host);
  });

  it('٣ · ولمستُها تفتح اللوحَ الأيسر', async () => {
    const { host } = await mount();
    expect($('.ws', host).dataset.insp).toBe('off');
    $('[data-ws-link-btn]', host).click();
    await wait(90);
    expect($('.ws', host).dataset.insp).toBe('on');
    expect($('[data-ws-link-btn]', host).getAttribute('aria-pressed')).toBe('true');
    unmount(host);
  });

  it('٤ · ولا تُزحزح ما تقرؤه ولا موضعَ تمريرك', async () => {
    /*
     * ⚠️ **بند ٢**: فتحُ لوحٍ ليس تنقّلًا. ولو فقدتَ موضعَك في نصٍّ
     *    طويلٍ كلَّما فتحتَ اللوحَ لَتجنّبتَ فتحَه.
     */
    const { host, w } = await mount();
    const doc = $('.ws-doc', host);
    doc.scrollTop = 120;
    await wait(40);
    const before = { node: __wsp.state.node, open: __wsp.state.open?.id, at: doc.scrollTop };

    $('[data-ws-link-btn]', host).click();
    await wait(90);

    expect(__wsp.state.node).toBe(before.node);
    expect(__wsp.state.open?.id).toBe(before.open);
    expect($('.ws-doc', host).scrollTop).toBe(before.at);
    expect(before.node).toBe(w.deep);
    unmount(host);
  });

  it('٥ · وإغلاقُ اللوح بـ ✕ يُطفئ حالةَ الزرّ', async () => {
    /*
     * ⚠️ **العطبُ الذي يمنعه هذا الحارس**: لو كانت الحالةُ وضعًا
     *    (`MODE.LINK`) لَبقيت مضاءةً بعد ✕ — فتقول الشاشةُ «أنت في
     *    الربط» ولا لوحَ مفتوح.
     */
    const { host } = await mount();
    $('[data-ws-link-btn]', host).click();
    await wait(90);
    $('[data-ws="insp-close"]', host).click();
    await wait(90);
    expect($('.ws', host).dataset.insp).toBe('off');
    expect($('[data-ws-link-btn]', host).getAttribute('aria-pressed')).toBe('false');
    unmount(host);
  });

  it('٦ · والتبويبُ الأخيرُ يعود عند إعادة الفتح', async () => {
    const { host } = await mount();
    await openMediaPanel(host);
    expect(__wsp.state.tab).toBe(TAB.MEDIA);
    $('[data-ws="insp-close"]', host).click();
    await wait(80);
    $('[data-ws-link-btn]', host).click();
    await wait(90);
    const on = $$('[data-ws="tab"]', host).find((b) => b.classList.contains('is-on'));
    expect(on.dataset.v).toBe(TAB.MEDIA);
    unmount(host);
  });

  it('٧ · واللوحُ يبقى بالطلب لا دائمًا — والمستندُ يستردّ عرضَه', async () => {
    /* ⚠️ بند ١٨: القياسُ على العرض الفعليّ لا على وجود العنصر. */
    const { host } = await mount();
    const doc = $('.ws-doc', host);
    const alone = doc.getBoundingClientRect().width;
    $('[data-ws-link-btn]', host).click();
    await wait(120);
    const shared = doc.getBoundingClientRect().width;
    expect(shared < alone).toBeTruthy();
    $('[data-ws="insp-close"]', host).click();
    await wait(120);
    expect(Math.round(doc.getBoundingClientRect().width)).toBe(Math.round(alone));
    unmount(host);
  });

  it('٨ · و«ربط» على الصفّ باقيةٌ — البابان لا يُلغي أحدُهما الآخر', async () => {
    /* ⚠️ بند ٤: فعلٌ مباشرٌ على العنصر، وبابٌ إلى اللوح — شيئان. */
    const { host, w } = await mount();
    await __wsp.commitLink([w.i1], w.deep);
    await wait(120);
    const row = $(`[data-ws-item="${w.i1}"]`, host);
    expect($('[data-ws="link-item"]', row)).toBeTruthy();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4-C · حقيقةُ الصوت على الصفّ (بندا ٨ و٢٤)', () => {
  it('٩ · صفُّ الصوت يعرض ▶ قبل التشغيل', async () => {
    audio.clear();
    await wait(60);
    const { host } = await mount();
    await openMediaPanel(host);
    const btn = $('[data-audio-btn]', host);
    expect(btn).toBeTruthy();
    expect(btn.dataset.audioState).toBe('ready');
    unmount(host);
  });

  it('١٠ · وصفٌّ واحدٌ فقط يقول ❚❚ — والباقي ▶', async () => {
    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **لماذا لقطةٌ مصنوعةٌ لا تشغيلٌ حقيقيّ — والفرقُ ليس تحايلًا**
     * ═══════════════════════════════════════════════════════════
     *
     * أوّلُ صياغةٍ شغّلت المقطعَ فعلًا ثمّ قاست الأزرار، فسقطت.
     * والتشخيصُ الحيُّ أظهر السبب: مقاطعُ الاختبار ٦٤ بايتًا لا
     * يفكّ المتصفّحُ ترميزَها، فتعطي `duration: 0` و`playing: false`.
     * و`playStateOf` تُرجع «جاهز» في تلك الحال **عن حقّ** — وهو قرارٌ
     * مكتوبٌ في WS-P2-ب: «مقطعٌ لم يبدأ أصلًا ليس موقوفًا».
     *
     * أي أنّ الشاشةَ كانت صادقةً والاختبارُ هو المخطئ.
     *
     * ⚠️ **والمقيسُ هنا هو نفسُ السلك الحقيقيّ**: أزرارُ اللوح
     *    المرسومةُ فعلًا، ودالّةُ `refreshAudioButtons` نفسُها التي
     *    ينادِيها مشترِكُ الخدمة. المصنوعُ هو **اللقطةُ** وحدَها —
     *    وهي ما كان المتصفّحُ عاجزًا عن إنتاجه، لا ما نتحايل عليه.
     */
    audio.clear();
    await wait(60);
    const { host, w } = await mount();
    await openMediaPanel(host);

    const feed = (snapshot) => refreshAudioButtons(host, snapshot, { loading: new Set() });
    const stateOf = (id) => $$(`[data-audio-btn="${id}"]`, host).map((b) => b.dataset.audioState);

    feed({ mediaId: w.a1, playing: true, duration: 30, currentTime: 4 });
    expect(stateOf(w.a1).every((one) => one === 'playing')).toBeTruthy();
    expect(stateOf(w.a2).every((one) => one === 'ready')).toBeTruthy();

    /* أُوقِف a1 فصار «كمّل»، وb لم يتغيّر. */
    feed({ mediaId: w.a1, playing: false, duration: 30, currentTime: 4 });
    expect(stateOf(w.a1).every((one) => one === 'paused')).toBeTruthy();
    expect(stateOf(w.a2).every((one) => one === 'ready')).toBeTruthy();

    /* انتقل الصوتُ إلى a2 — فعاد a1 «شغّل» وحدَه صار a2 «وقّف». */
    feed({ mediaId: w.a2, playing: true, duration: 20, currentTime: 1 });
    expect(stateOf(w.a1).every((one) => one === 'ready')).toBeTruthy();
    expect(stateOf(w.a2).every((one) => one === 'playing')).toBeTruthy();

    /* وانتهى a2 — والنهايةُ ليست إيقافًا مؤقّتًا (بند ٨). */
    feed({ mediaId: w.a2, playing: false, duration: 20, currentTime: 20 });
    expect(stateOf(w.a2).every((one) => one === 'ready')).toBeTruthy();

    audio.clear();
    unmount(host);
  });

  it('١١ · وإعادةُ رسم اللوح تُرطِّب الحالةَ من الخدمة لا من ذاكرةٍ محلّيّة', async () => {
    /*
     * ⚠️ **بند ٨**: أيُّ إعادةِ رسمٍ تُخرج أزرارًا بحالةٍ مأخوذةٍ من
     *    `audio.state` وقتَ الرسم. فلو خزّنت الشاشةُ «شغّال» عندها
     *    لَبقيت تقولها بعد أن يتوقّف الصوتُ من شاشةٍ أخرى.
     */
    audio.clear();
    await wait(60);
    const { host, w } = await mount();
    await openMediaPanel(host);

    /* الخدمةُ ساكنةٌ فعلًا — فأيُّ رسمٍ يجب أن يعطي «جاهز» لا غير. */
    refreshAudioButtons(host, { mediaId: w.a1, playing: true, duration: 30, currentTime: 2 });
    expect($(`[data-audio-btn="${w.a1}"]`, host).dataset.audioState).toBe('playing');

    __wsp.paintInsp();
    await wait(90);
    expect($(`[data-audio-btn="${w.a1}"]`, host).dataset.audioState)
      .toBe(audio.state.mediaId === w.a1 && audio.state.playing ? 'playing' : 'ready');
    unmount(host);
  });

  it('١٢ · ولا شريطَ سفليَّ يظهر مهما كانت حالةُ الصوت', async () => {
    /* ⚠️ بند ٢٣: الغيابُ مشروطٌ بأربع حالاتٍ لا بحالةِ السكون وحدَها. */
    const { host, w } = await mount();
    for (const step of ['idle', 'play', 'pause', 'switch']) {
      if (step === 'play') await __wsp.playItem(w.a1);
      if (step === 'pause') audio.pause();
      if (step === 'switch') await __wsp.playItem(w.a2);
      await wait(140);
      expect($('[data-ws-now]', host)).toBe(null);
      expect($('.ws-now', host)).toBe(null);
    }
    audio.clear();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4-C · تحديدُ الوسائط في اللوح الأيسر (بنود ١٠ إلى ١٣ و٢٥)', () => {
  it('١٣ · لمسُ صفٍّ في لوح الوسائط يحدّده محلّيًّا', async () => {
    const { host, w } = await mount();
    await openMediaPanel(host);
    const face = $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host);
    expect(face).toBeTruthy();
    face.click();
    await wait(140);
    expect(__wsp.state.mediaSel).toBe(w.i1);
    unmount(host);
  });

  it('١٤ · ولا يزحزح تحديدَ المُتصفِّح — حالتان لا حالة', async () => {
    /* ⚠️ **بند ١٠ حرفيًّا**: `state.node` لا تُمَسّ في هذا المسار. */
    const { host, w } = await mount();
    const before = __wsp.state.node;
    await openMediaPanel(host);
    $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host).click();
    await wait(140);
    expect(__wsp.state.node).toBe(before);
    unmount(host);
  });

  it('١٥ · والتحديدُ يتحرّك بين صورةٍ وصوت — واحدٌ في المرّة', async () => {
    const { host, w } = await mount();
    await openMediaPanel(host);
    $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host).click();
    await wait(140);
    await openMediaPanel(host);
    $(`[data-ws-thumb="${w.a1}"] [data-ws="pick-media"]`, host).click();
    await wait(140);
    expect(__wsp.state.mediaSel).toBe(w.a1);
    expect(__wsp.state.node).toBeTruthy();
    unmount(host);
  });

  it('١٦ · والمحدَّدُ يُرى — خلفيّةٌ وحافّةٌ لا لونُ نصٍّ وحدَه', async () => {
    const { host, w } = await mount();
    await openMediaPanel(host);
    __wsp.state.mediaSel = w.i1;
    __wsp.paintInsp();
    await wait(90);
    const row = $(`[data-ws-thumb="${w.i1}"]`, host);
    expect(row.classList.contains('is-sel')).toBe(true);
    const s = getComputedStyle(row);
    expect(s.borderInlineStartColor).toBe(s.borderInlineStartColor);
    expect(Number(s.borderInlineStartWidth.replace('px', '')) >= 3).toBeTruthy();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4-C · وضعُ «تحديد» والدفعة (بنود ١٢ إلى ١٦ و٢٦)', () => {
  it('١٧ · لا مربّعاتِ اختيارٍ قبل أن تطلبها', async () => {
    const { host } = await mount();
    await openMediaPanel(host);
    expect($$('.ws-thumb .ws-item-tick', host)).toHaveLength(0);
    expect($('[data-ws-media-pick]', host).textContent.trim()).toBe('تحديد');
    unmount(host);
  });

  it('١٨ · و«تحديد» تُظهرها وشريطَ الأفعال داخل اللوح نفسِه', async () => {
    /* ⚠️ بند ١٣: لا شريطَ أفعالٍ أسفلَ الشاشة كلِّها — الفعلُ حيث تنظر. */
    const { host } = await mount();
    await openMediaPanel(host);
    $('[data-ws-media-pick]', host).click();
    await wait(120);
    const bar = $('[data-ws-media-pickbar]', host);
    expect(bar).toBeTruthy();
    expect(bar.closest('.ws-insp')).toBeTruthy();
    expect($$('.ws-thumb .ws-item-tick', host).length > 0).toBeTruthy();
    unmount(host);
  });

  it('١٩ · والعددُ حقيقيٌّ من الحالة لا رقمٌ يُعرَض', async () => {
    const { host, w } = await mount();
    await openMediaPanel(host);
    $('[data-ws-media-pick]', host).click();
    await wait(120);

    $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host).click();
    await wait(100);
    $(`[data-ws-thumb="${w.a1}"] [data-ws="pick-media"]`, host).click();
    await wait(100);
    expect(__wsp.state.picked.size).toBe(2);
    expect($('[data-ws-media-pickbar] b', host).textContent).toContain('2');

    $(`[data-ws-thumb="${w.a1}"] [data-ws="pick-media"]`, host).click();
    await wait(100);
    expect(__wsp.state.picked.size).toBe(1);
    expect($('[data-ws-media-pickbar] b', host).textContent).toContain('1');
    unmount(host);
  });

  it('٢٠ · وفي وضع التحديد لا يُفتَح شيء', async () => {
    /*
     * ⚠️ **بند ١٣**: لو فتحت الصورةُ وأنت تجمع خمسًا لَخرجتَ من عملك
     *    خمسَ مرّات. والقياسُ على `state.open` — أي على ما فُتح فعلًا.
     */
    const { host, w } = await mount();
    const before = __wsp.state.open?.id;
    await openMediaPanel(host);
    $('[data-ws-media-pick]', host).click();
    await wait(120);
    $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host).click();
    await wait(140);
    expect(__wsp.state.open?.id).toBe(before);
    unmount(host);
  });

  it('٢١ · وصورةٌ وصوتٌ معًا يُربَطان بنوعَي علاقةٍ صحيحين', async () => {
    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **تدقيقُ البند ١٤ — أُجري ولم يُفترَض**
     * ═══════════════════════════════════════════════════════════
     *
     * `linkItemsTo` تشتقّ نوعَ العلاقة **لكلّ عنصرٍ على حدة**:
     * `linkKindFor(item.kind)` — صوتٌ ← AUDIO_SCRIPT، صورةٌ ←
     * IMAGE_SCRIPT. فالخلطُ مدعومٌ بنيويًّا ولا يُسقِط نوعًا بصمت.
     * وهذا الحارسُ يثبت ذلك على القاعدة لا على النيّة.
     */
    const { host, w } = await mount();
    __wsp.state.pickMode = true;
    __wsp.state.picked = new Set([w.a2, w.i2]);
    await __wsp.linkPicked();
    await wait(220);

    const au = await linksOf(w.a2, LINK.AUDIO_SCRIPT);
    const im = await linksOf(w.i2, LINK.IMAGE_SCRIPT);
    expect(au.some((one) => one.otherId === w.deep)).toBe(true);
    expect(im.some((one) => one.otherId === w.deep)).toBe(true);
    unmount(host);
  });

  it('٢٢ · والفشلُ الجزئيُّ يُقال بعددٍ حقيقيٍّ ولا يُلغى ما نجح', async () => {
    /*
     * ⚠️ **بند ١٥**: الحلقةُ متتابعةٌ لا ذرّيّة. ومعرِّفٌ ميّتٌ بين
     *    صحيحين يجب أن يترك الصحيحَ مربوطًا ويبقى هو محدَّدًا.
     *
     * ⚠️ **ولا يبقى معرِّفٌ ميّتٌ في التحديد** (بند ١٦): `reconcilePicks`
     *    تُسقطه لأنّه لم يعُد في اللوحة أصلًا — فلا يُعرَض عليك «أعِد
     *    المحاولة» على شيءٍ لا وجودَ له.
     */
    const { host, w } = await mount();
    __wsp.state.pickMode = true;
    __wsp.state.picked = new Set([w.i1, 'media_لا-وجود-له']);
    await __wsp.linkPicked();
    await wait(220);

    const im = await linksOf(w.i1, LINK.IMAGE_SCRIPT);
    expect(im.some((one) => one.otherId === w.deep)).toBe(true);
    expect(__wsp.state.picked.has(w.i1)).toBe(false);
    unmount(host);
  });

  it('٢٣ · و«إلغاء التحديد» يُخرِج من الوضع ويمسح الحالة', async () => {
    const { host, w } = await mount();
    await openMediaPanel(host);
    $('[data-ws-media-pick]', host).click();
    await wait(120);
    $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host).click();
    await wait(100);
    $('[data-ws-media-pickbar] [data-ws="pick-cancel"]', host).click();
    await wait(120);
    expect(__wsp.state.pickMode).toBe(false);
    expect(__wsp.state.picked.size).toBe(0);
    expect($$('.ws-thumb .ws-item-tick', host)).toHaveLength(0);
    unmount(host);
  });

  it('٢٤ · ولا يبقى تحديدٌ معلَّقٌ بعد تبديل ما تقرؤه', async () => {
    const { host, w } = await mount();
    await openMediaPanel(host);
    $('[data-ws-media-pick]', host).click();
    await wait(120);
    $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host).click();
    await wait(100);
    expect(__wsp.state.picked.size).toBe(1);

    await __wsp.selectNode(w.rootId);
    await wait(160);
    expect(__wsp.state.pickMode).toBe(false);
    expect(__wsp.state.picked.size).toBe(0);
    unmount(host);
  });

  it('٢٥ · ولا بعد إغلاق اللوح', async () => {
    const { host, w } = await mount();
    await openMediaPanel(host);
    $('[data-ws-media-pick]', host).click();
    await wait(120);
    $(`[data-ws-thumb="${w.i1}"] [data-ws="pick-media"]`, host).click();
    await wait(100);
    $('[data-ws="insp-close"]', host).click();
    await wait(120);
    expect(__wsp.state.pickMode).toBe(false);
    expect(__wsp.state.picked.size).toBe(0);
    unmount(host);
  });

  it('٢٦ · والقلمُ نزل تحت ⋯ — لا أيقونةَ تسميةٍ دائمةٌ في الصفّ', async () => {
    /* ⚠️ بند ١٧: المساحةُ الدائمةُ للتشغيل والربط، والتسميةُ فعلٌ نادر. */
    const { host } = await mount();
    await openMediaPanel(host);
    expect($$('.ws-thumb [data-ws="rename-media"]', host)).toHaveLength(0);
    expect($$('.ws-thumb [data-ws="item-menu"]', host).length > 0).toBeTruthy();
    const code = await (await fetch('../js/views/workspace-view.js')).text();
    expect(code.includes("data-m=\"rename\"")).toBeTruthy();
    unmount(host);
  });
});

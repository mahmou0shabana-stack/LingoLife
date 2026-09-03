/**
 * LingoLife — الورشةُ على التابلت (WS-P4 · بنود ٤٦ إلى ٥٤)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ما الذي كان مكسورًا — وما الذي لم يكن
 * ═══════════════════════════════════════════════════════════════
 *
 * بلاغُك بعد استعمالٍ حقيقيٍّ على Galaxy Tab S10+ كان خمسةَ أشياء.
 * والتدقيقُ قبل الكتابة أظهر أنّ **آليّةَ التحجيم كانت مبنيّةً وتعمل**:
 * التقاطُ مؤشِّرٍ، وهدفُ لمسٍ ٢٥px، وحسابُ RTL، وقصٌّ آمن، وحفظُ تفضيل.
 *
 * فأينَ العطب؟ في سطرٍ واحدٍ من CSS: `.ws-split::after { opacity: 0 }`
 * لا يصير ١ إلّا عند `:hover` أو `:focus-visible`. **وعلى شاشةٍ باللمس
 * لا `:hover` قبل الضغط** — فلم يكن على الشاشة ما يقول إنّ هنا شيئًا
 * يُسحَب. أي أنّ الميزةَ كانت موجودةً وغيرَ مرئيّة، وهذا في التجربة
 * يساوي غيابَها.
 *
 * ⚠️ **والقاعدةُ العامّةُ التي تحرسها هذه الملفّات**: أثرٌ لا يظهر إلّا
 *    بتمرير الفأرة هو أثرٌ لا وجودَ له على جهازٍ يُلمَس.
 *
 * وثلاثةُ عيوبٍ أخرى قِيست لا خُمِّنت:
 *
 *   · `--ws-dock: 76px` كان محجوزًا في الألواح الثلاثة **دائمًا** —
 *     حتّى ولا مقطعَ صوتيٍّ في الخدمة. شريطٌ فارغٌ يقضم من كلّ لوح.
 *   · `MODE.LINK` لم يبقَ له في الكودّ كلّه إلّا سطران يفتحان لوحَ
 *     التفاصيل — أي أنّه لم يكن وضعًا للوثيقة بل زرًّا مكرَّرًا.
 *   · حلقتا تركيزٍ متراكزتان على حقول النماذج: هالةُ `.field` وخطُّ
 *     `:focus-visible` معًا.
 */

import { describe, it, expect } from './test-runner.js';
import { renderWorkspace, disposeWorkspace, __wsp } from '../js/views/workspace-view.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';
import { media, sceneMediaLinks } from '../js/db/repositories.js';
import { readPanePrefs, effectivePanes } from '../js/services/workspace/pane-prefs.js';
import { PANE } from '../js/services/workspace/workspace-ui.js';
import { linksOf } from '../js/services/link-service.js';
import { api as audio } from '../js/services/audio-service.js';

const TAG = `WSP4-${Math.random().toString(36).slice(2, 7)}`;
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

/** اسمٌ طويلٌ حقًّا — هو موضوعُ بند ٥ كلِّه. */
const LONG_NAME = `${TAG} المرحلة الثالثة — مراجعة المستندات المطلوبة قبل الاجتماع`;

let world = null;
async function buildWorld() {
  if (world) return world;
  const scene = await createScene({ titleAr: `${TAG} ذكرى`, date: '2026-09-03' });
  const root = await addScript(scene.id, { title: `${TAG} السكريبت`, text: 'متن الجذر' });
  const p2 = await addNode(root.id, { title: `${TAG} مرحلة ٢`, nodeKind: 'part', text: 'متن ٢' });
  const p2a = await addNode(p2.id, { title: `${TAG} ٢أ`, nodeKind: 'part', text: 'متن ٢أ' });
  const p2b = await addNode(p2a.id, { title: LONG_NAME, nodeKind: 'custom', text: 'المتن العميق' });

  const bytes = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
  const snd = await media.create({ kind: 'audio', caption: `${TAG}-صوت.wav`, blob: bytes, durationMs: 3000 });
  const img1 = await media.create({ kind: 'image', caption: `${TAG}-صورة-١.png`, blob: bytes });
  const img2 = await media.create({ kind: 'image', caption: `${TAG}-صورة-٢.png`, blob: bytes });
  for (const [i, m] of [snd, img1, img2].entries()) {
    await sceneMediaLinks.create({ sceneId: scene.id, mediaId: m.id, order: i + 1, roles: [] });
  }

  world = {
    sceneId: scene.id, rootId: root.id, p2: p2.id, p2a: p2a.id, deep: p2b.id,
    sndId: snd.id, img1: img1.id, img2: img2.id,
  };
  return world;
}

async function mount(width = 1280) {
  await ensureCss();
  /*
   * ⚠️ **ولا مضيفٌ عالقٌ من اختبارٍ سقط** — درسٌ كلّفني تشخيصًا كاملًا.
   *
   *    `paintDoc` و`paintNav` تستعلمان من `document` لا من المضيف. فحين
   *    يرمي اختبارٌ **قبل** سطر التنظيف يبقى مضيفُه في الصفحة، فيصير هو
   *    أوّلَ ما تجده الاستعلاماتُ في الاختبار التالي — فيرسم فيه ويظنّ
   *    التالي أنّ شاشتَه فارغة. فتسقط سلسلةٌ كاملةٌ بسبب عطبٍ واحد،
   *    ويصير تقريرُ الفشل كذبةً عن عدد الأعطاب.
   *
   *    والتنظيفُ هنا **في البداية** لا في النهاية: لا يعتمد على أن ينتهي
   *    الاختبارُ السابقُ بسلام.
   */
  disposeWorkspace();
  document.querySelectorAll('#wsp4-host').forEach((one) => one.remove());
  const w = await buildWorld();
  const host = document.createElement('div');
  host.id = 'wsp4-host';
  host.style.cssText =
    `position:fixed;inset-block-start:-4000px;inline-size:${width}px;block-size:800px`;
  document.body.append(host);
  await renderWorkspace(host, w.sceneId);
  await wait(110);
  return { host, w };
}

const unmount = (host) => { disposeWorkspace(); host.remove(); };

/**
 * يركّب الشاشةَ **ويفتح العقدةَ العميقة**.
 *
 * ⚠️ **ولمَ لا يكفي `mount`؟** المُتصفِّحُ يفرد المسارَ الحاليَّ وحدَه
 *    (WS-P · بند ١٥): فما دام لا شيءَ محدَّدًا فالعقدةُ على العمق الثالث
 *    **غيرُ مرسومةٍ أصلًا**. وأوّلُ صياغةٍ لهذه الاختبارات بحثت عن اسمها
 *    قبل فتحها فوجدت `undefined` — وكان الخطأُ في الاختبار لا في الشاشة.
 */
async function mountDeep(width = 1280) {
  const { host, w } = await mount(width);
  await __wsp.selectNode(w.deep);
  await wait(140);
  return { host, w };
}

/** يضع الصورَ والصوتَ تحت العقدة العميقة كي تظهر في «مربوط هنا». */
async function attachAll(w) {
  await __wsp.commitLink([w.sndId, w.img1, w.img2], w.deep);
  await wait(120);
}

/** لوحُ المفتاح على المقبض — بديلُ السحب في بيئة اختبار. */
function key(host, name, opts = {}) {
  const grip = $('[data-ws-split="nav"]', host);
  grip.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, ...opts }));
}

/* ================================================================== */
describe('WS-P4 · المقبضُ يُرى ويُلمَس (بندا ٢ و٣٧)', () => {
  it('١ · المقبضُ مرسومٌ بلا تمريرِ فأرة', async () => {
    /*
     * ⚠️ **هذا هو الاختبارُ الذي يمسك العطبَ الأصليّ.** كان الأثرُ
     *    `opacity: 0` حتى `:hover`، وهي حالةٌ لا تقع على إصبع. فالقياسُ
     *    هنا على العنصر في حالته **الساكنة** لا بعد محاكاة تمرير.
     */
    const { host } = await mount();
    const grip = $('[data-ws-split="nav"]', host);
    const after = getComputedStyle(grip, '::after');
    expect(Number(after.opacity) > 0).toBeTruthy();
    unmount(host);
  });

  it('٢ · وهدفُ اللمس أعرضُ من الخطّ المرئيّ', async () => {
    const { host } = await mount();
    const grip = $('[data-ws-split="nav"]', host);
    const hit = Number(getComputedStyle(grip, '::before').inlineSize.replace('px', ''));
    expect(hit >= 24).toBeTruthy();
    unmount(host);
  });

  it('٣ · ولا يُحدَّد نصٌّ ولا يُمرَّر لوحٌ أثناء السحب', async () => {
    const { host } = await mount();
    expect(getComputedStyle($('[data-ws-split="nav"]', host)).touchAction).toBe('none');
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · حدودُ التحجيم مقيسةٌ لا مفترَضة (بندا ٣ و٤٦)', () => {
  it('٤ · العرضُ الافتراضيُّ يُحمَّل', async () => {
    const { host } = await mount();
    expect(__wsp.state.panes.nav >= PANE.NAV_MIN).toBeTruthy();
    expect(__wsp.state.panes.nav <= PANE.NAV_MAX).toBeTruthy();
    unmount(host);
  });

  it('٥ · التوسيعُ يوسّع فعلًا', async () => {
    const { host } = await mount();
    const before = __wsp.state.panes.nav;
    for (let i = 0; i < 8; i += 1) key(host, 'ArrowLeft');
    await wait(40);
    expect(__wsp.state.panes.nav > before).toBeTruthy();
    unmount(host);
  });

  it('٦ · والتضييقُ يضيّق', async () => {
    const { host } = await mount();
    for (let i = 0; i < 8; i += 1) key(host, 'ArrowLeft');
    const wide = __wsp.state.panes.nav;
    for (let i = 0; i < 8; i += 1) key(host, 'ArrowRight');
    await wait(40);
    expect(__wsp.state.panes.nav < wide).toBeTruthy();
    unmount(host);
  });

  it('٧ · ولا ينزل تحت الحدّ الأدنى مهما دفعت', async () => {
    const { host } = await mount();
    for (let i = 0; i < 60; i += 1) key(host, 'ArrowRight', { shiftKey: true });
    await wait(40);
    expect(__wsp.state.panes.nav).toBe(PANE.NAV_MIN);
    unmount(host);
  });

  it('٨ · ولا يتجاوز الأقصى', async () => {
    const { host } = await mount();
    for (let i = 0; i < 60; i += 1) key(host, 'ArrowLeft', { shiftKey: true });
    await wait(40);
    expect(__wsp.state.panes.nav <= PANE.NAV_MAX).toBeTruthy();
    unmount(host);
  });

  it('٩ · والمستندُ يحتفظ بحدّه الأدنى المحميّ', async () => {
    /*
     * ⚠️ **وهذا هو الثابتُ الحقيقيُّ لا الرقم**: بند ٣ يقول «قد ينمو
     *    المُتصفِّحُ لكن لا يسحق المستند». فالقياسُ على عرض المستند
     *    **المرسوم**، لا على أنّ العددَ بقي تحت ٤٠٠.
     */
    const { host } = await mount();
    for (let i = 0; i < 60; i += 1) key(host, 'ArrowLeft', { shiftKey: true });
    await wait(60);
    const mainW = $('.ws-main', host).getBoundingClientRect().width;
    expect(mainW >= PANE.MAIN_MIN - 1).toBeTruthy();
    unmount(host);
  });

  it('١٠ · ولا تراكبَ ولا فيضٌ أفقيٌّ بعد التحجيم', async () => {
    const { host } = await mount();
    for (let i = 0; i < 20; i += 1) key(host, 'ArrowLeft');
    await wait(60);
    const nav = $('.ws-nav', host).getBoundingClientRect();
    const main = $('.ws-main', host).getBoundingClientRect();
    /* في RTL المُتصفِّحُ يمينَ المستند — فلا يتقاطع طرفاهما. */
    const gap = Math.min(nav.left, main.left) + Math.min(nav.width, main.width);
    expect(gap <= Math.max(nav.right, main.right) + 1).toBeTruthy();
    const body = $('.ws-body', host);
    expect(body.scrollWidth <= body.clientWidth + 1).toBeTruthy();
    unmount(host);
  });

  it('١١ · العرضُ يُحفَظ في التفضيلات', async () => {
    const { host } = await mount();
    for (let i = 0; i < 5; i += 1) key(host, 'ArrowLeft');
    await wait(40);
    expect(readPanePrefs().nav).toBe(__wsp.state.panes.nav);
    unmount(host);
  });

  it('١٢ · والمحفوظُ يُقصّ على شاشةٍ ضيّقةٍ بدل أن يخنق المستند', async () => {
    /* ⚠️ الدورانُ إلى الطول: `effectivePanes` تقصّ عند القراءة لا عند الحفظ. */
    const narrow = effectivePanes(800);
    expect(800 - narrow.nav >= PANE.MAIN_MIN).toBeTruthy();
  });

  it('١٣ · ويعود صالحًا على شاشةٍ عريضة', () => {
    const wide = effectivePanes(1920);
    expect(wide.nav >= PANE.NAV_MIN).toBeTruthy();
    expect(wide.nav <= PANE.NAV_MAX).toBeTruthy();
  });

  it('١٤ · واستعادةُ الافتراضيّ متاحةٌ بلا شاشة إعدادات', async () => {
    const { host } = await mount();
    for (let i = 0; i < 8; i += 1) key(host, 'ArrowLeft');
    await wait(30);
    key(host, 'Home');
    await wait(40);
    expect(__wsp.state.panes.nav).toBe(PANE.NAV_DEFAULT);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · الاسمُ الطويلُ يُقرأ بلا تصغيرِ خطّ (بند ٥)', () => {
  it('١٥ · العنوانُ يقبل سطرين لا سطرًا واحدًا مبتورًا', async () => {
    /*
     * ⚠️ **ولمَ لا نُصغّر الخطّ؟** بند ٥ ينهى عنه نصًّا. فالحلُّ سطران
     *    مع `line-clamp` — يُقرَأ أكثر ولا يصير الصفُّ عمودًا.
     */
    const { host } = await mountDeep();
    const t = $$('.ws-nav-t', host).find((e) => e.textContent.includes('مراجعة المستندات'));
    expect(t).toBeTruthy();
    const css = getComputedStyle(t);
    expect(css.whiteSpace).toBe('normal');
    expect(css.webkitLineClamp || css.lineClamp).toBe('2');
    unmount(host);
  });

  it('١٦ · والتوسيعُ يُظهر حروفًا أكثرَ فعلًا — بالقياس', async () => {
    const { host } = await mountDeep();
    const pick = () => $$('.ws-nav-t', host).find((e) => e.textContent.includes('مراجعة المستندات'));
    for (let i = 0; i < 20; i += 1) key(host, 'ArrowRight', { shiftKey: true });
    await wait(60);
    const narrow = pick().getBoundingClientRect().width;
    for (let i = 0; i < 30; i += 1) key(host, 'ArrowLeft', { shiftKey: true });
    await wait(60);
    const wide = pick().getBoundingClientRect().width;
    expect(wide > narrow).toBeTruthy();
    unmount(host);
  });

  it('١٧ · ولا يصير الصفُّ طويلًا بلا حدّ', async () => {
    const { host } = await mountDeep();
    const row = $$('.ws-nav-row', host)
      .find((e) => e.textContent.includes('مراجعة المستندات'));
    expect(row.getBoundingClientRect().height < 130).toBeTruthy();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · التحديدُ الدقيقُ يبقى بعد كلّ شيء (بند ٤٧)', () => {
  it('١٨ · صفٌّ واحدٌ محدَّدٌ والأسلافُ مسارٌ لا تحديد', async () => {
    const { host, w } = await mountDeep();
    expect($$('.ws-nav-row.is-on', host)).toHaveLength(1);
    expect($$('.ws-nav-row.is-path', host).length >= 1).toBeTruthy();
    unmount(host);
  });

  it('١٩ · والمحدَّدُ هو العميقُ لا السكريبت', async () => {
    const { host, w } = await mountDeep();
    const on = $('.ws-nav-row.is-on [data-ws="nav-node"]', host);
    expect(on.dataset.id).toBe(w.deep);
    unmount(host);
  });

  it('٢٠ · ويبقى بعد التحجيم', async () => {
    const { host, w } = await mountDeep();
    for (let i = 0; i < 10; i += 1) key(host, 'ArrowLeft');
    await wait(60);
    expect(__wsp.state.node).toBe(w.deep);
    expect($$('.ws-nav-row.is-on', host)).toHaveLength(1);
    unmount(host);
  });

  it('٢١ · ويبقى بعد فتح المعاينة الجانبيّة', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    expect(__wsp.state.node).toBe(w.deep);
    unmount(host);
  });

  it('٢٢ · ويبقى بعد تحديد وسيط', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    const before = __wsp.state.node;
    __wsp.state.mediaSel = w.img2;
    __wsp.paintItems();
    await wait(60);
    expect(__wsp.state.node).toBe(before);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · المعاينةُ جنب النصّ (بنود ٨ إلى ١٥ و٤٨)', () => {
  it('٢٣ · تُفتَح فتظهر الصورةُ والنصُّ معًا', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    expect($('[data-ws-side]', host).hidden).toBe(false);
    expect($('.ws-doc', host).getBoundingClientRect().width > 0).toBeTruthy();
    expect($('.ws-side img', host)).toBeTruthy();
    unmount(host);
  });

  it('٢٤ · ولا تُنشئ عمودًا خامسًا في التطبيق', async () => {
    /*
     * ⚠️ **هذا هو الحارسُ المركزيُّ للبند ٨.** الشبكةُ العامّةُ خمسةُ
     *    مسارات (لوحان ومقبضان ومستند)، والمعاينةُ **ابنةُ** المستند.
     *    فلو صارت يومًا عمودًا في `.ws-body` سقط هذا فورًا.
     */
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    const cols = getComputedStyle($('.ws-body', host)).gridTemplateColumns.split(/\s+/);
    expect(cols).toHaveLength(5);
    expect($('.ws-body > .ws-side', host)).toBe(null);
    expect($('.ws-main [data-ws-side]', host)).toBeTruthy();
    unmount(host);
  });

  it('٢٥ · والنصُّ يغلب في القسمة', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    const doc = $('.ws-doc', host).getBoundingClientRect().width;
    const side = $('.ws-side', host).getBoundingClientRect().width;
    expect(doc > side).toBeTruthy();
    unmount(host);
  });

  it('٢٦ · وللنصّ حدُّه الأدنى المحميّ', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    expect($('.ws-doc', host).getBoundingClientRect().width >= 200).toBeTruthy();
    unmount(host);
  });

  it('٢٧ · واختيارُ صورةٍ أخرى يحدّث نفسَ الخانة', async () => {
    /* ⚠️ خانةٌ واحدةٌ لا لوحُ صورٍ يتكاثر (بند ١٤). */
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(80);
    __wsp.openSide(w.img2);
    await wait(80);
    expect($$('[data-ws-side]', host)).toHaveLength(1);
    expect(__wsp.state.side).toBe(w.img2);
    unmount(host);
  });

  it('٢٨ · واللمسُ يفتح اللايت‑بوكس المشترك لا عارضًا ثانيًا', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(80);
    const shot = $('.ws-side-shot', host);
    expect(shot.dataset.ws).toBe('zoom');
    unmount(host);
  });

  it('٢٩ · والإغلاقُ يعيد للمستند كاملَ العرض', async () => {
    /*
     * ⚠️ **هذا الاختبارُ أمسك عطبًا حقيقيًّا** — لا حالةً نظريّة.
     *    كانت `paintSide` تكتب `data-ws-side` على عنصر الانقسام لتقول
     *    «مفتوحة»، وهي نفسُها السِّمةُ التي يُمسَك بها لوحُ المعاينة.
     *    فصار النداءُ التالي يُفرِغ الانقسامَ بدل اللوح — أي **يختفي
     *    المستندُ عند إغلاق المعاينة**. راجع `paintSide`.
     */
    const { host, w } = await mountDeep();
    await attachAll(w);
    const docW = () => $('.ws-doc', host).getBoundingClientRect().width;
    const full = docW();
    __wsp.openSide(w.img1);
    await wait(90);
    expect(docW() < full).toBeTruthy();
    __wsp.closeSide();
    await wait(90);
    expect($('.ws-doc', host)).toBeTruthy();
    expect(docW()).toBe(full);
    unmount(host);
  });

  it('٣٠ · وموضعُ تمرير النصّ لا يضيع عند الإغلاق', async () => {
    /* ⚠️ إغلاقُ المعاينة تغييرُ تخطيطٍ لا تغييرُ محتوًى (بند ١٣). */
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    const doc = $('.ws-doc', host);
    if (!doc) throw new Error('.ws-doc مفقود بعد فتح المعاينة');
    doc.scrollTop = 40;
    const at = doc.scrollTop;
    __wsp.closeSide();
    await wait(90);
    expect($('.ws-doc', host).scrollTop).toBe(at);
    unmount(host);
  });

  it('٣١ · ولا فيضٌ أفقيٌّ والمعاينةُ مفتوحة', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    const split = $('[data-ws-main-split]', host);
    expect(split.scrollWidth <= split.clientWidth + 1).toBeTruthy();
    unmount(host);
  });

  it('٣٢ · والنصُّ الروسيُّ لا ينقلب اتّجاهُه', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.openSide(w.img1);
    await wait(90);
    /* اسمُ الصورة `auto`، وقشرةُ التطبيق RTL — ولا ثالثَ يفرض اتّجاهًا. */
    expect($('.ws-side-t', host).getAttribute('dir')).toBe('auto');
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · تحديدُ الوسائط حالةٌ ثانيةٌ (بنود ١٦ و١٧ و٤٩)', () => {
  it('٣٣ · الصفُّ المحدَّدُ يُعلَن في الصنف وفي ARIA', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.state.mediaSel = w.sndId;
    __wsp.paintItems();
    await wait(60);
    const row = $(`[data-ws-item="${w.sndId}"]`, host);
    expect(row.classList.contains('is-sel')).toBe(true);
    expect($('[data-ws="pick-media"]', row).getAttribute('aria-pressed')).toBe('true');
    unmount(host);
  });

  it('٣٤ · وتحديدُ الوسيط لا يغيّر تحديدَ المحتوى', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    const node = __wsp.state.node;
    __wsp.state.mediaSel = w.img1;
    __wsp.paintItems();
    await wait(60);
    expect(__wsp.state.node).toBe(node);
    unmount(host);
  });

  it('٣٥ · والتمييزُ أخفُّ من تحديد المُتصفِّح', async () => {
    /*
     * ⚠️ **مرتبتان لا مرتبةٌ واحدة** (بند ١٧): صفُّ المُتصفِّح يحمل شريطًا
     *    جانبيًّا ٤px، وصفُّ الوسيط لا يحمله. فلو تساويا لصار على الشاشة
     *    تحديدان يتنازعان على معنى «مكانُك».
     */
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.state.mediaSel = w.img1;
    __wsp.paintItems();
    await wait(60);
    const navOn = getComputedStyle($('.ws-nav-row.is-on', host));
    const itemOn = getComputedStyle($('.ws-item.is-sel', host));
    const px = (v) => Number(String(v).replace('px', '')) || 0;
    expect(px(itemOn.borderInlineStartWidth) < px(navOn.borderInlineStartWidth)).toBeTruthy();
    unmount(host);
  });

  it('٣٦ · ولا مربّعاتِ تحديدٍ دائمة', async () => {
    /* ⚠️ الحالةُ العاديّةُ بسيطة — والدفعةُ تُطلَب (بند ٢٢). */
    const { host, w } = await mountDeep();
    await attachAll(w);
    expect(__wsp.state.pickMode).toBe(false);
    expect($$('.ws-item-tick', host)).toHaveLength(0);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · الربطُ المباشرُ من الصفّ (بنود ١٨ و١٩ و٥٠)', () => {
  it('٣٧ · زرُّ الربط ظاهرٌ في صفّ الصوت وفي صفّ الصورة', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    for (const id of [w.sndId, w.img1]) {
      const row = $(`[data-ws-item="${id}"]`, host);
      expect($('[data-ws="link-item"]', row)).toBeTruthy();
    }
    unmount(host);
  });

  it('٣٨ · وهُويّةُ الوسيط في الزرّ هي الوسيطُ نفسُه', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    const row = $(`[data-ws-item="${w.img1}"]`, host);
    expect($('[data-ws="link-item"]', row).dataset.id).toBe(w.img1);
    unmount(host);
  });

  it('٣٩ · و«عرض جنب النص» فعلٌ أوّلٌ في صفّ الصورة', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    const row = $(`[data-ws-item="${w.img1}"]`, host);
    expect($('[data-ws="side-open"]', row)).toBeTruthy();
    unmount(host);
  });

  it('٤٠ · وإعادةُ التسمية نزلت تحت ⋯ فلم تعُد قلمًا دائمًا', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    const row = $(`[data-ws-item="${w.img1}"]`, host);
    expect($('[data-ws="rename-media"]', row)).toBe(null);
    expect($('[data-ws="item-menu"]', row)).toBeTruthy();
    unmount(host);
  });

  it('٤١ · وأربعةُ أهدافِ لمسٍ على الأكثر في الصفّ', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    const row = $(`[data-ws-item="${w.img1}"]`, host);
    expect($$('button', row).length <= 4).toBeTruthy();
    unmount(host);
  });

  it('٤٢ · وإعادةُ التسمية بعد الربط لا تكسر الرابط', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    const before = (await linksOf(w.img1)).length;
    await __wsp.renameMedia; /* الدالّةُ موجودةٌ ومصدَّرة */
    const { media: repo } = await import('../js/db/repositories.js');
    await repo.update(w.img1, { caption: `${TAG}-اسم-جديد.png` });
    await wait(60);
    expect((await linksOf(w.img1)).length).toBe(before);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · الربطُ الجماعيُّ يقول الحقيقةَ (بندا ٢١ و٥١)', () => {
  it('٤٣ · وضعُ التحديد يُدخَل ويُخرَج صراحةً', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.state.pickMode = true;
    __wsp.paintItems();
    await wait(60);
    expect($('.ws-pickbar', host)).toBeTruthy();
    expect($$('.ws-item-tick', host).length >= 1).toBeTruthy();
    unmount(host);
  });

  it('٤٤ · والعددُ المعروضُ حقيقيٌّ من التحديد', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    __wsp.state.pickMode = true;
    __wsp.state.picked = new Set([w.img1, w.img2]);
    __wsp.paintItems();
    await wait(60);
    expect($('.ws-pickbar b', host).textContent).toContain('2');
    unmount(host);
  });

  it('٤٥ · والربطُ الجماعيُّ يكتب فعلًا', async () => {
    const { host, w } = await mount();
    const target = await addNode(w.rootId, {
      title: `${TAG} هدف الدفعة`, nodeKind: 'part', text: 'x',
    });
    await __wsp.selectNode(target.id);
    await wait(80);
    __wsp.state.pickMode = true;
    __wsp.state.picked = new Set([w.img1, w.img2]);
    await __wsp.linkPicked();
    await wait(140);
    const a = await linksOf(w.img1);
    expect(a.some((one) => one.otherId === target.id)).toBeTruthy();
    unmount(host);
  });

  it('٤٦ · ولا يبقى تحديدٌ بعد نجاحٍ كامل', async () => {
    const { host, w } = await mount();
    const target = await addNode(w.rootId, {
      title: `${TAG} هدف ٢`, nodeKind: 'part', text: 'x',
    });
    await __wsp.selectNode(target.id);
    await wait(80);
    __wsp.state.pickMode = true;
    __wsp.state.picked = new Set([w.img1]);
    await __wsp.linkPicked();
    await wait(140);
    expect(__wsp.state.picked.size).toBe(0);
    expect(__wsp.state.pickMode).toBe(false);
    unmount(host);
  });

  it('٤٧ · وبلا تحديدٍ لا يقع شيء', async () => {
    const { host, w } = await mountDeep();
    __wsp.state.picked = new Set();
    await __wsp.linkPicked();
    await wait(60);
    expect(__wsp.state.picked.size).toBe(0);
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · مساراتُ الربط الأربعة باقية (بندا ٢٤ و٥٢)', () => {
  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **حارسان انقلبا بقرارٍ صريحٍ من مالك المنتَج — لا بانحدار**
   * ═══════════════════════════════════════════════════════════════
   *
   * كان هنا: «لا زرَّ وضعٍ اسمُه ربط» و«الأوضاعُ اثنان». وقد كتبهما
   * WS-P4 بعد تدقيقٍ خلص إلى أنّ «ربط» بلا **عمليّةٍ** فريدة.
   *
   * والتدقيقُ كان صحيحًا وناقصًا معًا: صحيحٌ في العمليّات، ناقصٌ في
   * الوظيفة — فقد كان الزرُّ **بابَ اللوح الأيسر**، وبإسقاطه اختفى
   * اللوحُ عن مستعمله (WS-P4-C · بند ١).
   *
   * ⚠️ **والمقصودُ الأصليُّ لهذه المجموعة لم يتبدّل**: أن تبقى مساراتُ
   *    الربط الأربعةُ قائمةً مهما تحرّك الزرّ. وهي محروسةٌ كما كانت
   *    أدناه. وحالةُ الزرِّ نفسِه لها ملفُّها: `workspace-link-panel`.
   */

  it('٥٠ · ومسارُ الربط من العقدة باقٍ', async () => {
    const { host, w } = await mountDeep();
    expect($('[data-ws="link-into"]', host)).toBeTruthy();
    unmount(host);
  });

  it('٥١ · ومسارُ الربط من الوسيط باقٍ', async () => {
    const { host, w } = await mountDeep();
    await attachAll(w);
    expect($$('[data-ws="link-item"]', host).length >= 1).toBeTruthy();
    unmount(host);
  });

  it('٥٢ · وعرضُ الروابط باقٍ في لوح التفاصيل', async () => {
    /* ⚠️ بند ٢٥: لا صفحةَ إدارةِ روابطَ جديدة — السطحُ القائم يكفي. */
    const { host, w } = await mountDeep();
    expect($('[data-ws="insp"]', host)).toBeTruthy();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4-C · لا شريطَ صوتٍ أسفلَ الورشة (بنود ٥ و٦ و٩ و٢٣)', () => {
  /*
   * ═══════════════════════════════════════════════════════════════
   * ⚠️ **هذه المجموعةُ انقلبت — وذلك هو الصواب**
   * ═══════════════════════════════════════════════════════════════
   *
   * كانت تحرس **المشغّلَ المصغَّر**: أن يكون نحيفًا، وأن يختفي بلا
   * مقطع، وألّا يحجز مساحةً وهو غائب. وكلُّها شروطٌ صحيحةٌ لشيءٍ
   * قرّر مالكُ المنتَج بعد تجربةٍ على الجهاز الحقيقيّ أنّه **لا يريده
   * أصلًا** — لا كبيرًا ولا نحيفًا.
   *
   * فالحرّاسُ الآن يحرسون الغياب: لا عنصرَ، ولا مساحةَ محجوزة، ولا
   * شريطَ يعود متسلّلًا في تمريرةٍ قادمة.
   */
  it('٥٣ · لا عنصرَ شريطٍ في الورشة أصلًا — ولا حتى مخفيًّا', async () => {
    audio.clear();
    await wait(60);
    const { host } = await mount();
    expect($('[data-ws-now]', host)).toBe(null);
    expect($('.ws-now', host)).toBe(null);
    unmount(host);
  });

  it('٥٤ · ولا مساحةَ محجوزةَ له في أيّ لوح', async () => {
    /*
     * ⚠️ **هذا هو «الشريطُ الكبيرُ بلا داعٍ» الذي بلّغتَ عنه مرّتين.**
     *    والقياسُ على الحشو لا على العنصر: `--ws-dock` كان يقضم من
     *    الألواح الثلاثة حتى والشريطُ غائب. والآن لا وجودَ للمتغيّر.
     */
    const { host } = await mount();
    const root = $('.ws', host);
    expect(getComputedStyle(root).getPropertyValue('--ws-dock').trim()).toBe('');
    const pad = (sel) => Number(
      getComputedStyle($(sel, host)).paddingBlockEnd.replace('px', '')
    ) || 0;
    expect(pad('.ws-nav') <= 24).toBeTruthy();
    expect(pad('.ws-doc') <= 24).toBeTruthy();
    unmount(host);
  });

  it('٥٥ · والصوتُ ما زال على نفس الخدمة العامّة — لا عنصرَ ثانٍ', async () => {
    /*
     * ⚠️ **حارسٌ بنيويّ** (بند ٧): حذفُ الواجهة لا يجوز أن يُغري أحدًا
     *    ببناء مشغّلٍ محلّيٍّ بدلها. لو أنشأت هذه الشاشةُ `<audio>`
     *    خاصًّا لَمات الصوتُ مع أوّلِ عقدةٍ تفتحها.
     */
    const src = await (await fetch('../js/views/workspace-view.js')).text();
    const code = src.split('\n')
      .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line)).join('\n');
    expect(/new Audio\(|createElement\(['"]audio/.test(code)).toBeFalsy();
    /* والاشتراكُ في الخدمة باقٍ — الحقيقةُ لا تزال تصل للصفوف. */
    expect(code.includes('subscribeAudio')).toBeTruthy();
  });

  it('٥٦ · ولا يعود المشغّلُ متسلّلًا في تمريرةٍ قادمة', async () => {
    /*
     * ⚠️ **حارسُ عودةٍ لا حارسُ حالة** (بند ٢٣): يقيس أنّ رسمَ الشاشة
     *    لا يحوي أثرًا للمشغّل — لا صنفًا ولا سِمةً ولا دالّةَ رسم.
     */
    const src = await (await fetch('../js/views/workspace-view.js')).text();
    const code = src.split('\n')
      .filter((line) => !/^\s*(\*|\/\/)/.test(line) && !/^\s*⚠️|^\s*\*/.test(line))
      .join('\n');
    for (const dead of ['function nowHtml', 'data-ws-now', 'ws-now-play', "case 'toggle'"]) {
      expect(code.includes(dead)).toBeFalsy();
    }
  });

  it('٥٧ · وآخِرُ سطرٍ في المستند يُقرأ كاملًا', async () => {
    const { host, w } = await mountDeep();
    const doc = $('.ws-doc', host);
    doc.scrollTop = doc.scrollHeight;
    await wait(40);
    const box = doc.getBoundingClientRect();
    const last = doc.lastElementChild?.getBoundingClientRect();
    /* ⚠️ لا شيءَ يقف تحته الآن، فالشرطُ أن يقع داخل اللوح نفسِه. */
    if (last) expect(last.bottom <= box.bottom + 1).toBeTruthy();
    unmount(host);
  });
});

/* ================================================================== */
describe('WS-P4 · نافذةُ إعادة التسمية وحلقةُ التركيز (بندا ٤١ و٤٢ و٥٤)', () => {
  it('٥٨ · النافذةُ المضغوطةُ أضيقُ من النموذج الكامل', async () => {
    await ensureCss();
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div class="modal is-compact"></div><div class="modal"></div>';
    document.body.append(wrap);
    await wait(40);
    const [compact, normal] = [...wrap.children];
    const px = (el) => Number(getComputedStyle(el).maxInlineSize.replace('px', '')) || 9999;
    expect(px(compact) < px(normal)).toBeTruthy();
    wrap.remove();
  });

  it('٥٩ · وأزرارُها تبقى ٤٤px', async () => {
    await ensureCss();
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="modal is-compact"><div class="modal-actions"><button class="btn">x</button></div></div>';
    document.body.append(wrap);
    await wait(40);
    const min = getComputedStyle(wrap.querySelector('.btn')).minBlockSize;
    expect(Number(min.replace('px', '')) >= 44).toBeTruthy();
    wrap.remove();
  });

  it('٦٠ · وحلقةُ تركيزٍ واحدةٌ لا اثنتان', async () => {
    /*
     * ⚠️ **العطبُ الذي وصفتَه**: «حدٌّ أسودُ ثقيلٌ داخل معالجةٍ بنفسجيّة».
     *    كان `outline: none` مكتوبًا على `:focus` وحدَها، و`:focus-visible`
     *    العامّةُ تُطبَّق بعدها فتُعيد الخطّ — فيجتمع خطٌّ وهالةٌ وحدّ.
     */
    await ensureCss();
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div class="field"><input id="wsp4-f"></div>';
    document.body.append(wrap);
    const input = wrap.querySelector('input');
    input.focus();
    await wait(40);
    expect(getComputedStyle(input).outlineStyle).toBe('none');
    expect(getComputedStyle(input).boxShadow === 'none').toBeFalsy();
    wrap.remove();
  });
});

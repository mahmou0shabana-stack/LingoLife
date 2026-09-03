/**
 * LingoLife — التحديدُ الدائم والربطُ المباشر (WS-P3 · بنود ٣ إلى ١٦ · ٢١ إلى ٢٣)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **العطبان اللذان يحرسهما هذا الملفّ**
 * ═══════════════════════════════════════════════════════════════
 *
 * **١ · التحديدُ كان يختفي.** كان الصفُّ المُبرَزُ في المُتصفِّح يُشتقُّ من
 *     `state.open` وحدَه — أي «ما تعرضه المساحة». فما إن تفتحَ صوتًا أو
 *     صورةً حتّى لا يبقى في الشجرة صفٌّ محدَّدٌ إطلاقًا: يختفي مكانُك في
 *     اللحظة التي تحتاجه فيها أكثر.
 *
 *     فصار `state.node` هُويّةَ التحديد، و`state.open` ما يُعرَض. وحالةُ
 *     «وسيطٌ داخل عقدة» حالةٌ فرعيّةٌ مصرَّحٌ بها لا حالةٌ ثالثة.
 *
 * **٢ · الربطُ كان خلف ثلاث خطوات.** المُفتِّش ← تبويب «الربط» ←
 *     «+ إضافة رابط». أي أنّ عليك أن تفكّر في **أداة** قبل أن تفعل شيئًا
 *     بالملفّ الذي في يدك. فصار لكلّ عنصرٍ زرُّ ربطٍ بجانبه.
 *
 * ⚠️ **وهذا مدخلٌ لا نظامُ ربطٍ ثانٍ** (بند ١٧). كلُّ الأزرار تنتهي إلى
 *    `linkSelection` نفسِها. والاختبارُ ٩ يثبت ذلك بالقاعدة: العلاقةُ
 *    المكتوبةُ من الزرّ الجديد هي عينُها التي تقرؤها اللوحةُ القديمة.
 *
 * ⚠️ **ولا يُقاس التحديدُ بصنفِ CSS وحدَه** (قاعدة ٧): يُقاس بـ`state.node`
 *    **و**بالصفّ المرسوم **و**باتّفاق الترويسة معه. ثلاثتُها أو لا شيء —
 *    فصنفٌ صحيحٌ فوق حالةٍ خاطئةٍ يمرّ من اختبارٍ يفحص الصنفَ وحدَه.
 */

import { describe, it, expect } from './test-runner.js';
import { renderWorkspace, disposeWorkspace, __wsp } from '../js/views/workspace-view.js';
import { workspaceBoard } from '../js/services/workspace/workspace-service.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';
import { media, sceneMediaLinks, relationships } from '../js/db/repositories.js';

const TAG = `WSS-${Math.random().toString(36).slice(2, 7)}`;
const wait = (ms = 70) => new Promise((done) => { setTimeout(done, ms); });
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const codeOnly = (src) => src.split('\n')
  .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line)).join('\n');

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
  const root = await addScript(scene.id, { title: `${TAG} المرحلة ١`, text: 'متن الجذر' });
  const partA = await addNode(root.id, { title: `${TAG} جزء أ`, nodeKind: 'part', text: 'متن أ' });
  const deep = await addNode(partA.id, { title: `${TAG} جولة عميقة`, nodeKind: 'custom', text: 'متن عميق' });
  const partB = await addNode(root.id, { title: `${TAG} جزء ب`, nodeKind: 'part', text: 'متن ب' });
  /* حشوٌ يدفع الصفَّ المحدَّد خارج النافذة — لاختبار «يبقى مرئيًّا». */
  for (let i = 0; i < 30; i += 1) {
    await addNode(root.id, { title: `${TAG} حشو ${i}`, nodeKind: 'part', text: 'x' });
  }

  const bytes = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
  const snd = await media.create({ kind: 'audio', caption: `${TAG}-voice.wav`, blob: bytes, durationMs: 2200 });
  const img = await media.create({ kind: 'image', caption: `${TAG}-لوحة.png`, blob: bytes });
  await sceneMediaLinks.create({ sceneId: scene.id, mediaId: snd.id, order: 1, roles: [] });
  await sceneMediaLinks.create({ sceneId: scene.id, mediaId: img.id, order: 2, roles: [] });

  world = {
    sceneId: scene.id, rootId: root.id, partA: partA.id, deep: deep.id,
    partB: partB.id, sndId: snd.id, imgId: img.id,
  };
  return world;
}

/**
 * عقدةٌ ووسائطُ **جديدةٌ لكلّ اختبارِ ربط**.
 *
 * ⚠️ **ولمَ لا تُستعمَل عُقَدُ العالَم المشترك؟** لأنّ الروابطَ تتراكم:
 *    اختبارٌ يربط، والذي بعده يجد الرابطَ قائمًا فتنهار عدّاداتُه.
 *    سقطت ثلاثةُ اختباراتٍ من هذه بالضبط («توقّعت ١ ووجدت ٢»)، وكانت
 *    **هي** المخطئةَ لا الشاشة. والعزلُ أصدقُ من ترتيبِ تنفيذٍ مفترَض.
 */
let seq = 0;
async function freshTarget(w) {
  seq += 1;
  const node = await addNode(w.rootId, {
    title: `${TAG} هدف ${seq}`, nodeKind: 'part', text: `متن ${seq}`,
  });
  const bytes = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
  const snd = await media.create({ kind: 'audio', caption: `${TAG}-صوت-${seq}.wav`, blob: bytes, durationMs: 1500 });
  const img = await media.create({ kind: 'image', caption: `${TAG}-صورة-${seq}.png`, blob: bytes });
  await sceneMediaLinks.create({ sceneId: w.sceneId, mediaId: snd.id, order: 10 + seq, roles: [] });
  await sceneMediaLinks.create({ sceneId: w.sceneId, mediaId: img.id, order: 20 + seq, roles: [] });
  return { nodeId: node.id, sndId: snd.id, imgId: img.id };
}

async function mount() {
  await ensureCss();
  const w = await buildWorld();
  const host = document.createElement('div');
  host.id = 'wss-host';
  host.style.cssText = 'position:fixed;inset-block-start:-4000px;inline-size:1280px;block-size:800px';
  document.body.append(host);
  await renderWorkspace(host, w.sceneId);
  await wait(100);
  return { host, w };
}

const unmount = (host) => { disposeWorkspace(); host.remove(); };

/** الصفوفُ المحدَّدةُ المرسومةُ فعلًا. */
const onRows = (host) => $$('.ws-nav-row.is-on', host);
const headTitle = (host) => $('.ws-doc-title h2', host)?.textContent.trim() || null;
const crumbTexts = (host) => $$('.ws-crumbs .ws-crumb', host).map((e) => e.textContent.trim());

/**
 * ⚠️ **الثابتُ الذي تنصّ عليه المواصفة نصًّا** (بند ١٤): «لا يقع أبدًا أن
 *    يُبرِز المتصفِّحُ «أ» بينما تعرض المساحةُ «ب»». فيُفحَص هنا بعد كلّ
 *    فعلٍ لا مرّةً واحدة.
 */
function agrees(host, board) {
  const sel = __wsp.state.node;
  const rows = onRows(host);
  if (!sel) return rows.length === 0 ? [] : ['صفٌّ مُبرَزٌ بلا هُويّة تحديد'];

  const bad = [];
  /* صفٌّ واحدٌ لا أكثر — والصفرُ مقبولٌ حين يُصفّيه البحث (يُعلَن بسطرٍ خاصّ). */
  if (rows.length > 1) bad.push(`${rows.length} صفوف مُبرَزة`);
  if (rows.length === 1) {
    const id = rows[0].querySelector('[data-ws="nav-node"]')?.dataset.id;
    if (id !== sel) bad.push(`الصفُّ المُبرَزُ ${id} والتحديدُ ${sel}`);
  }
  /*
   * والترويسةُ تحمل اسمَ العقدة المحدَّدة في مسارها — **في كلّ حال**،
   * حتّى وأنت تنظر إلى وسيطٍ من المكتبة. وهذا هو الثابتُ حرفيًّا: لا
   * حالةَ يُبرِز فيها المتصفِّحُ «أ» ولا تذكر الترويسةُ «أ» أصلًا.
   */
  const title = board.targetById.get(sel)?.title;
  if (title && !crumbTexts(host).includes(title)) bad.push(`المسارُ لا يذكر «${title}»`);
  return bad;
}

/* ================================================================== *
 * أ · التحديدُ يدوم (بنود ٣ إلى ٥ · ٢١)
 * ================================================================== */

describe('WS-P3 · أ · التحديدُ الدائم', () => {
  it('١ · صفٌّ واحدٌ محدَّدٌ بهُويّةٍ من الحالة — لا صفرَ ولا اثنان', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      expect(__wsp.state.node).toBe(w.deep);
      expect(onRows(host)).toHaveLength(1);
      expect(onRows(host)[0].querySelector('[data-ws="nav-node"]').dataset.id).toBe(w.deep);
    } finally { unmount(host); }
  });

  it('٢ · ⚠️ وفتحُ صوتٍ **لا** يمحو التحديد — وهو العطبُ بعينه', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      __wsp.openMedia(w.sndId, 'audio');
      await wait();
      /* المساحةُ تعرض الصوت… */
      expect(__wsp.state.open.kind).toBe('audio');
      expect(__wsp.state.open.id).toBe(w.sndId);
      /* …والشجرةُ ما زالت على مكانك. */
      expect(__wsp.state.node).toBe(w.deep);
      expect(onRows(host)).toHaveLength(1);
      expect(onRows(host)[0].querySelector('[data-ws="nav-node"]').dataset.id).toBe(w.deep);
    } finally { unmount(host); }
  });

  it('٣ · وفتحُ صورةٍ كذلك', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      await wait();
      __wsp.openMedia(w.imgId, 'image');
      await wait();
      expect(__wsp.state.node).toBe(w.partB);
      expect(onRows(host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('٤ · وتبديلُ الوضع ذهابًا وإيابًا', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      __wsp.setMode('edit');
      await wait();
      expect(__wsp.state.node).toBe(w.deep);
      __wsp.setMode('read');
      await wait();
      expect(__wsp.state.node).toBe(w.deep);
      expect(onRows(host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('٥ · وإعادةُ القراءة من القاعدة (`refresh`) لا تهدمه', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      await __wsp.refresh();
      await wait();
      expect(__wsp.state.node).toBe(w.deep);
      expect(onRows(host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('٦ · وفتحُ لوح التفاصيل وإغلاقُه', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      $('.ws-insp-toggle', host).click();
      await wait(120);
      expect(__wsp.state.node).toBe(w.deep);
      expect(onRows(host)).toHaveLength(1);
      $('[data-ws="insp-close"]', host)?.click();
      await wait(120);
      expect(__wsp.state.node).toBe(w.deep);
    } finally { unmount(host); }
  });

  it('٧ · والأسلافُ يُفرَدون، فالصفُّ المحدَّدُ مرسومٌ فعلًا لا مطويّ', async () => {
    const { host, w } = await mount();
    try {
      /* «جولة عميقة» تحت «جزء أ» تحت الجذر — طبقتان مطويّتان. */
      __wsp.selectNode(w.deep);
      await wait();
      expect(__wsp.state.expanded.has(w.partA)).toBe(true);
      expect(Boolean($(`[data-ws="nav-node"][data-id="${w.deep}"]`, host))).toBe(true);
    } finally { unmount(host); }
  });

  it('٨ · والصفُّ المحدَّدُ يبقى داخل نافذة اللوح — يُقاس لا يُفترَض', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      const pane = $('[data-ws-nav]', host);
      /* ندفعه خارجَ النافذة عمدًا ثمّ نعيد الرسم. */
      pane.scrollTop = pane.scrollHeight;
      await wait(40);
      __wsp.paintNav();
      await wait(60);
      const here = $('[data-ws-here]', host);
      expect(Boolean(here)).toBe(true);
      const box = pane.getBoundingClientRect();
      const at = here.getBoundingClientRect();
      expect(at.top >= box.top - 1 && at.bottom <= box.bottom + 1).toBe(true);
    } finally { unmount(host); }
  });

  it('٩ · وأسلافُ المحدَّد يأخذون أثرَ «الطريق» — ولا يُبرَزون مثلَه', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      const path = $$('.ws-nav-row.is-path', host);
      const ids = path.map((row) => row.querySelector('[data-ws="nav-node"]')?.dataset.id);
      expect(ids).toContain(w.partA);
      expect(ids).toContain(w.rootId);
      /* ولا واحدٌ منهم يحمل صنفَ التحديد — وإلّا صار على الشاشة ثلاثةُ «محدَّدين». */
      expect(path.every((row) => !row.classList.contains('is-on'))).toBe(true);
      expect(onRows(host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('١٠ · والتحديدُ سطحٌ وحدٌّ جانبيٌّ وثِقَلُ خطٍّ وحالةٌ معلَنة — لا لونٌ وحدَه', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      const row = onRows(host)[0];
      const css = getComputedStyle(row);
      const label = getComputedStyle(row.querySelector('.ws-nav-t'));
      expect(css.backgroundColor !== 'rgba(0, 0, 0, 0)').toBe(true);
      /* حدٌّ منطقيٌّ في البداية — ينقلب مع الاتّجاه وحدَه. */
      expect(parseFloat(css.borderInlineStartWidth) >= 3).toBe(true);
      expect(Number(label.fontWeight) >= 700).toBe(true);
      expect(row.querySelector('[data-ws="nav-node"]').getAttribute('aria-selected')).toBe('true');
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * ب · الترويسةُ لا تخالف المُتصفِّحَ أبدًا (بنود ١٤ إلى ١٦)
 * ================================================================== */

describe('WS-P3 · ب · اتّفاقُ الترويسة والمُتصفِّح', () => {
  it('١١ · بعد كلِّ فعلٍ في الدورة: مُتصفِّحٌ وترويسةٌ على العقدة نفسِها', async () => {
    const { host, w } = await mount();
    try {
      const board = await workspaceBoard(w.sceneId);
      const steps = [
        ['تحديد', async () => { __wsp.selectNode(w.deep); }],
        ['فتح صوت', async () => { __wsp.openMedia(w.sndId, 'audio'); }],
        ['رجوع للعقدة', async () => { __wsp.selectNode(w.deep); }],
        ['تحرير', async () => { __wsp.setMode('edit'); }],
        ['قراءة', async () => { __wsp.setMode('read'); }],
        ['تفاصيل', async () => { $('.ws-insp-toggle', host).click(); }],
        ['إعادة قراءة', async () => { await __wsp.refresh(); }],
        ['أخ آخر', async () => { __wsp.selectNode(w.partB); }],
      ];
      for (const [name, run] of steps) {
        await run();
        await wait(110);
        expect(`${name}: ${agrees(host, board).join(' / ')}`).toBe(`${name}: `);
      }
    } finally { unmount(host); }
  });

  it('١٢ · ووسيطٌ تحت العقدة يظهر **ذيلًا** للمسار لا بديلًا عنه (بند ١٦)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      await __wsp.commitLink([w.sndId], w.deep);
      await wait(140);
      __wsp.openMedia(w.sndId, 'audio');
      await wait(140);
      const crumbs = crumbTexts(host);
      /* العقدةُ ما زالت في المسار… */
      expect(crumbs.some((one) => one.includes('جولة عميقة'))).toBe(true);
      /* …والوسيطُ بعدها، وهو ما تعرضه المساحة. */
      expect(crumbs[crumbs.length - 1]).toContain('voice');
      expect(headTitle(host)).toContain('voice');
    } finally { unmount(host); }
  });

  /*
   * ⚠️ **هذا الاختبارُ هو الذي كشف عطبًا في تصميمي أنا.** أوّلُ صياغةٍ
   *    كتبتُها للترويسة أسقطت المسارَ كلَّه حين يكون الوسيطُ من المكتبة،
   *    فصار المتصفِّحُ يُبرِز «جزء ب» والترويسةُ لا تذكرها بحرف — أي عينُ
   *    ما نهى عنه البند ١٤. والصوابُ أن يُقال الاثنان معًا.
   */
  it('١٣ · ووسيطٌ **غيرُ** مربوطٍ بالعقدة يُعلَّم، ولا يُسقِط مكانَك من المسار', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      await wait();
      /* `imgId` غيرُ مربوطٍ بـ`partB` في هذه اللحظة. */
      const board = await workspaceBoard(w.sceneId);
      const own = board.ownMedia?.get(w.partB) || { audio: [], images: [] };
      expect([...own.audio, ...own.images].some((one) => one.id === w.imgId)).toBe(false);

      __wsp.openMedia(w.imgId, 'image');
      await wait(140);
      /* مكانُك ما زال في المسار — لا يختفي لأنّك تنظر إلى ملفّ. */
      expect(crumbTexts(host).some((one) => one.includes('جزء ب'))).toBe(true);
      /* والوسيطُ في شارةٍ تقول صراحةً إنّه من المكتبة لا من العقدة. */
      const loose = $('[data-ws-loose]', host);
      expect(Boolean(loose)).toBe(true);
      expect(loose.textContent).toContain('من الوسائط');
      /* ولا يُعرَض ذيلًا عاديًّا للمسار — وإلّا ادّعى نسبًا غيرَ قائم. */
      expect(__wsp.state.node).toBe(w.partB);
      expect(onRows(host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('١٤ · والبحثُ الذي يُصفّي صفَّك يقول أين أنت ويعطيك بابَ العودة', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      const find = $('[data-ws-nav-find]', host);
      find.value = 'حشو';
      find.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(220);
      /* الصفُّ غيرُ مرسومٍ — لأنّه لا يطابق البحث، وهذا صدقٌ لا عطب. */
      expect(onRows(host)).toHaveLength(0);
      /* لكنّ الهُويّةَ باقية، والشاشةُ تقولها بدل أن تصمت. */
      expect(__wsp.state.node).toBe(w.deep);
      expect(Boolean($('.ws-nav-away', host))).toBe(true);
      expect($('.ws-nav-away', host).textContent).toContain('جولة عميقة');
      /* ومسحُ البحث يعيد الصفَّ مُبرَزًا كما كان. */
      $('.ws-nav-away button', host).click();
      await wait(220);
      expect(onRows(host)).toHaveLength(1);
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * ج · الربطُ المباشر (بنود ٦ إلى ١٠ · ١٣ · ١٧ · ٢٢)
 * ================================================================== */

describe('WS-P3 · ج · «ربط» بجوار العنصر', () => {
  it('١٥ · العقدةُ المفتوحة تحمل زرَّ ربطٍ في ترويستها — بلا فتح أيّ لوح', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      await wait();
      /* لوحُ التفاصيل مقفولٌ، والزرُّ موجودٌ رغم ذلك. */
      expect(__wsp.state.inspector).toBe(false);
      const btn = $('.ws-doc-head [data-ws="link-into"]', host);
      expect(Boolean(btn)).toBe(true);
      expect(btn.dataset.id).toBe(w.partB);
    } finally { unmount(host); }
  });

  it('١٦ · وكلُّ عنصرٍ مربوطٍ يحمل زرَّ ربطٍ يعرف مصدرَه', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      await __wsp.refresh();
      __wsp.selectNode(t.nodeId);
      await wait();
      await __wsp.commitLink([t.sndId, t.imgId], t.nodeId);
      await wait(180);
      expect($$('.ws-item', host)).toHaveLength(2);
      const sources = $$('.ws-item [data-ws="link-item"]', host).map((b) => b.dataset.id);
      expect(sources).toContain(t.sndId);
      expect(sources).toContain(t.imgId);
    } finally { unmount(host); }
  });

  it('١٧ · والنتيجةُ تظهر في مكانها فورًا — بلا مغادرةِ العقدة والعودة', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      await __wsp.refresh();
      __wsp.selectNode(t.nodeId);
      await wait(120);
      expect($$('.ws-item', host)).toHaveLength(0);
      await __wsp.commitLink([t.imgId], t.nodeId);
      await wait(180);
      /* بلا `selectNode` جديدةٍ ولا إعادةِ تركيب. */
      expect($$('.ws-item', host)).toHaveLength(1);
      expect($('.ws-item-t', host).textContent).toContain('صورة');
    } finally { unmount(host); }
  });

  it('١٨ · والصفُّ لا يُحشَى — أربعةُ أفعالٍ على الأكثر', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      await __wsp.refresh();
      __wsp.selectNode(t.nodeId);
      await wait();
      await __wsp.commitLink([t.sndId], t.nodeId);
      await wait(180);
      const row = $('.ws-item', host);
      expect(Boolean(row)).toBe(true);
      /*
       * ⚠️ **الحدُّ سقفٌ لا عدد** (WS-P4 · بند ١٩). كان هذا يشترط أربعةً
       *    بالضبط لأنّ الصفَّ كان: تشغيل · ربط · تسمية · ⋯. ثمّ نزلت
       *    «إعادة التسمية» تحت `⋯` لأنّها فعلٌ نادر والربطُ هو المركزيّ،
       *    فصارت ثلاثة. والمقصدُ المحروسُ منذ البداية «لا يُحشى الصفّ»
       *    — وثلاثةٌ تحته لا فوقه.
       */
      expect([...row.querySelector('.ws-item-acts').children].length <= 4).toBe(true);
      /* والباقي خلف `⋯` لا في الصفّ. */
      expect(Boolean(row.querySelector('[data-ws="item-menu"]'))).toBe(true);
    } finally { unmount(host); }
  });

  it('١٩ · وأهدافُ اللمس ٤٤px — على تابلتٍ الخطأُ بينها كتابةٌ في القاعدة', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      await __wsp.refresh();
      __wsp.selectNode(t.nodeId);
      await wait();
      await __wsp.commitLink([t.sndId], t.nodeId);
      await wait(180);
      const small = $$('.ws-item-acts .ws-icon-btn', host)
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width < 44 || r.height < 44);
      expect(small).toHaveLength(0);
    } finally { unmount(host); }
  });

  it('٢٠ · وشارةُ عددِ الروابط من علاقاتٍ حقيقيّة — والواحدةُ لا تُرسَم أصلًا', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      const other = await freshTarget(w);
      await __wsp.refresh();
      __wsp.selectNode(t.nodeId);
      await wait();
      await __wsp.commitLink([t.sndId], t.nodeId);
      await wait(180);
      /* وجهةٌ واحدة: لا شارة على صفّ الصوت. */
      const row = $(`[data-ws-item="${t.sndId}"]`, host);
      expect(Boolean(row)).toBe(true);
      expect(row.querySelectorAll('.ws-item-link b')).toHaveLength(0);

      /* وجهتان: شارةٌ — والرقمُ من القاعدة لا من التصميم. */
      await __wsp.commitLink([t.sndId], other.nodeId);
      __wsp.selectNode(t.nodeId);
      await wait(220);
      const badge = $(`[data-ws-item="${t.sndId}"] .ws-item-link b`, host);
      expect(Boolean(badge)).toBe(true);
      const board = await workspaceBoard(w.sceneId);
      expect(badge.textContent.trim()).toBe(String(board.linkedTo.get(t.sndId).length));
    } finally { unmount(host); }
  });

  /*
   * ⚠️ **هذا هو حارسُ البند ١٧.** لا مخطَّطَ جديدٌ ولا معرِّفاتٌ جديدة:
   *    ما يكتبه الزرُّ الجديدُ هو **صفُّ العلاقة نفسُه** الذي كانت
   *    تكتبه الطريقُ القديمة، بنفس النوع وبنفس الطرفين.
   */
  it('٢١ · والمكتوبُ في القاعدة علاقةٌ من النموذج القائم لا شيءٌ جديد', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      await __wsp.refresh();
      const before = (await relationships.getAll()).length;
      __wsp.selectNode(t.nodeId);
      await wait();
      await __wsp.commitLink([t.sndId], t.nodeId);
      await wait(180);

      const rows = await relationships.getAll();
      const made = rows.filter((row) =>
        (row.fromId === t.sndId && row.toId === t.nodeId)
        || (row.toId === t.sndId && row.fromId === t.nodeId));
      expect(made).toHaveLength(1);
      /* صفٌّ واحدٌ لا أكثر: لا نسخةٌ موازيةٌ في مخزنٍ آخر. */
      expect(rows.length).toBe(before + 1);
      /* والنوعُ من القاموس القائم — لا سلسلةٌ اخترعها هذا المرور. */
      expect(String(made[0].kind || made[0].type)).toContain('audio');
    } finally { unmount(host); }
  });

  it('٢٢ · والربطُ مرّتين لا يصنع رابطين (حمايةُ التكرار قائمةٌ كما هي)', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      await __wsp.refresh();
      __wsp.selectNode(t.nodeId);
      await wait();
      await __wsp.commitLink([t.imgId], t.nodeId);
      await wait(180);
      const after1 = (await relationships.getAll()).length;
      expect($$('.ws-item', host)).toHaveLength(1);

      await __wsp.commitLink([t.imgId], t.nodeId);
      await wait(180);
      expect((await relationships.getAll()).length).toBe(after1);
      expect($$('.ws-item', host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('٢٣ · وعقدةٌ بلا مربوطٍ تعرض بابَ الربط لا فراغًا', async () => {
    const { host, w } = await mount();
    try {
      const t = await freshTarget(w);
      await __wsp.refresh();
      __wsp.selectNode(t.nodeId);
      await wait(140);
      const empty = $('.ws-attached.is-empty', host);
      expect(Boolean(empty)).toBe(true);
      expect(empty.querySelector('[data-ws="link-into"]').dataset.id).toBe(t.nodeId);
    } finally { unmount(host); }
  });

  /*
   * ⚠️ **ما الذي يدعمه الخلفُ بالضبط؟** (بند ٩) `linkItemsTo` تعمل على
   *    صفوف `media` وحدَها، و`linkKindFor` تقابل: صوتٌ → AUDIO_SCRIPT،
   *    وما عداه → IMAGE_SCRIPT. أي أنّ المصادرَ المدعومةَ **صوتٌ وصورة**
   *    (والتسجيلُ صوتٌ)، والهدفَ **عقدةُ نصّ**. ولا يوجد نصٌّ↔نصّ ولا
   *    صوتٌ↔صورة. ولذلك لا يُرسَم زرُّ «ربط» على صفوف الشجرة نفسِها:
   *    زرُّ العقدة معناه «اربط وسائطَ بها» — وهو الاتّجاه المدعوم.
   */
  it('٢٤ · ولا زرَّ ربطٍ على صفوف الشجرة — الخلفُ لا يربط نصًّا بنصّ', async () => {
    const { host } = await mount();
    try {
      expect($$('.ws-nav-row [data-ws="link-item"]', host)).toHaveLength(0);
      expect($$('.ws-nav-row [data-ws="link-into"]', host)).toHaveLength(0);
    } finally { unmount(host); }
  });

  it('٢٥ · ولا مسارَ ربطٍ ثانٍ في الكود — كلُّها تنتهي إلى `linkSelection`', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    /*
     * ⚠️ **المقصدُ: كلُّ ربطٍ يمرّ من الباب الواحد** — لا عددُ السطور.
     *    كانا اثنين (استيرادٌ ونداءٌ في `commitLink`)، وصاروا ثلاثةً
     *    بنداءِ `linkPicked` في WS-P4 — وهو **نفسُ الباب** لكن لكلّ
     *    عنصرٍ على حدة، كي يُقال الناجحُ والفاشلُ بصدقٍ (بند ٢١).
     *    والحارسُ الحقيقيُّ هو السطرُ الأخير: لا كتابةَ علاقاتٍ مباشرة.
     */
    expect((code.match(/linkSelection/g) || []).length).toBe(3);
    /* والمدخلان الجديدان يمرّان بـ`commitLink` نفسِها. */
    expect(code).toContain("case 'link-item': return pickTargetFor(id)");
    expect(code).toContain("case 'link-into': return pickMediaFor(id)");
    expect(code).toContain('return commitLink([mediaId], chosen)');
    /* ولا كتابةَ علاقاتٍ مباشرةً من الشاشة. */
    expect(/relationships\.create\s*\(/.test(code)).toBe(false);
  });
});

/* ================================================================== *
 * د · لوحُ التفاصيل نُحِّيَ عن المسار الأوّل (بندا ١١ و١٢ · ٢٣)
 * ================================================================== */

describe('WS-P3 · د · التفاصيلُ لا المُفتِّش', () => {
  it('٢٦ · لا كلمةَ «المُفتِّش» في أيّ نصٍّ يقرؤه المستعمل', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      $('.ws-insp-toggle', host).click();
      await wait(140);
      /* ⚠️ التعليقاتُ ليست نصًّا مرئيًّا — يُقاس `textContent` والتسميات. */
      expect(host.textContent.includes('المُفتِّش')).toBe(false);
      const labels = $$('[aria-label]', host).map((e) => e.getAttribute('aria-label'));
      expect(labels.some((one) => one.includes('المُفتِّش'))).toBe(false);
    } finally { unmount(host); }
  });

  it('٢٧ · والزرُّ يقول ما وراءه: «تفاصيل»', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      expect($('.ws-insp-toggle span', host).textContent.trim()).toBe('تفاصيل');
    } finally { unmount(host); }
  });

  it('٢٨ · ولم يعُد بابَ الربط: أيقونةُ السلسلة صارت تعني «اربط» وحدَها', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      /* زرُّ التفاصيل لا يحمل أيقونةَ السلسلة، وأزرارُ الربط تحملها. */
      const insp = $('.ws-insp-toggle', host);
      expect(insp.innerHTML.includes('link')).toBe(false);
      expect(Boolean($('[data-ws="link-into"] svg', host))).toBe(true);
    } finally { unmount(host); }
  });

  it('٢٩ · واللوحُ يبقى مقفولًا افتراضيًّا — ولا يُفتَح من تلقائه بالربط', async () => {
    const { host, w } = await mount();
    try {
      expect(__wsp.state.inspector).toBe(false);
      __wsp.selectNode(w.partB);
      await wait();
      await __wsp.commitLink([w.imgId], w.partB);
      await wait(160);
      expect(__wsp.state.inspector).toBe(false);
    } finally { unmount(host); }
  });

  it('٣٠ · وحين يُفتَح فهو ثلاثةُ تبويباتٍ للتفاصيل — لا نافذةُ ربطٍ إجباريّة', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.deep);
      await wait();
      $('.ws-insp-toggle', host).click();
      await wait(160);
      expect($$('.ws-insp-tab', host).length).toBe(3);
      /*
       * ⚠️ **الاسمُ على اللوح نفسِه لا على عنوانٍ داخليّ.** أوّلُ صياغةٍ
       *    فحصت `.ws-insp-title`، وهي لا تُرسَم إلّا في الحالة الفارغة —
       *    فسقط الاختبارُ على غيابِ عنصرٍ لا على اسمٍ خاطئ. والاسمُ الذي
       *    يقرؤه المستعملُ (وقارئُ الشاشة) هو `aria-label` اللوح.
       */
      expect($('[data-ws-insp]', host).getAttribute('aria-label')).toBe('تفاصيل العنصر');
    } finally { unmount(host); }
  });
});

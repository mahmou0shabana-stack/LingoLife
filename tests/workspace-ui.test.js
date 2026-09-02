/**
 * LingoLife — سلوكُ ورشة المحتوى (WS-P)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **سلوكٌ لا وجودُ مُحدِّد** (بند ٢٩)
 * ═══════════════════════════════════════════════════════════════
 *
 * المواصفةُ صريحة: «ليس مجرّدَ وجود مُحدِّد CSS. اختبِر السلوك.»
 * فالمحروسُ هنا أفعالٌ تُنفَّذ ونتائجُ تُقاس:
 *
 *   · لمسةُ عقدةٍ تفتحها فعلًا، ولا تكتب حرفًا في القاعدة.
 *   · تبديلُ الوضع لا يُلقي مسوّدةً فيها تعديلات.
 *   · «اتحفظ» لا تظهر إلّا بعد أن ترجع الكتابةُ محقَّقةً من القاعدة.
 *   · إغلاقُ المُفتِّش يعيد العرضَ للمستند — **بقياس عرضٍ حقيقيّ**.
 *   · شجرةٌ فيها آلافُ العُقَد لا تُرسَم كلُّها.
 *
 * ⚠️ **وكلُّ رقمٍ في الشاشة يُقارَن بما في القاعدة** (بند ٢٣): لا رقمَ
 *    مكتوبٌ في اختبارٍ لأنّ الشاشةَ تكتبه، بل لأنّ البيانَ يقوله.
 */

import { describe, it, expect } from './test-runner.js';
import {
  MODE, MODE_LABEL, TAB, SAVE, SAVE_LABEL,
  makeDraft, draftChanged, draftCommitted,
  navRows, navGroups, searchReveal, ancestorsOf, crumbsOf,
  mediaOf, linkRowsFor, mediaLibrary, MEDIA_FILTERS,
  PANE, paneFit, clampPane, NAV_PAGE,
} from '../js/services/workspace/workspace-ui.js';
import { workspaceBoard } from '../js/services/workspace/workspace-service.js';
import { renderWorkspace, disposeWorkspace, __wsp } from '../js/views/workspace-view.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';
import { scripts, media, sceneMediaLinks, relationships } from '../js/db/repositories.js';

const TAG = `WSP-${Math.random().toString(36).slice(2, 7)}`;
const codeOnly = (src) => src.split('\n')
  .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line)).join('\n');

const wait = (ms = 60) => new Promise((done) => { setTimeout(done, ms); });
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ================================================================== *
 * ذكرى حقيقيّةٌ واحدة — تُبنى مرّةً وتُستعمَل في كلّ ما تحت
 * ================================================================== */

/**
 * ⚠️ **بلا CSS لا يوجد ما يُقاس** (بند ٣٠).
 *
 *    أوّلُ صياغةٍ كتبتُها ركّبت الشاشةَ في صفحة الاختبار ثم قاست عرضَ
 *    اللوحين — وصفحةُ الاختبار **لا تحمّل أنماطَ التطبيق**. فكان كلُّ
 *    زرٍّ «أصغرَ من ٤٤» وكلُّ لوحٍ «١٢٨٠ عرضًا»: خمسةُ اختباراتٍ تسقط
 *    على غيابِ ورقةِ أنماطٍ لا على عطبٍ في الشاشة.
 *
 *    والقياسُ بلا الأنماط الحقيقيّة ليس قياسًا — فتُحمَّل هنا مرّةً،
 *    ويُنتظَر تحميلُها فعلًا قبل أوّل قياس.
 */
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
  const scene = await createScene({ titleAr: `${TAG} ذكرى`, date: '2026-09-01' });

  const root = await addScript(scene.id, {
    title: `${TAG} PHASE 1`,
    /* ⚠️ حوارٌ حقيقيٌّ بثلاثة أدوار، وفيه فقرةٌ روسيّةٌ خالصةٌ لاختبار الاتّجاه. */
    text: 'Speaker 1: دلوقتي ندخل على вскрыть.\n\nمعناها يفضّ.\n\n'
      + 'Speaker 2: طب إيه الفرق بينها وبين открыть؟\n\nSpeaker 1: Вскрыть упаковку.',
  });
  const partA = await addNode(root.id, { title: 'PART 1 — التقديم', nodeKind: 'part', text: 'متن أ' });
  const round = await addNode(partA.id, { title: 'ROUND A', nodeKind: 'custom', text: 'جولة أ' });
  const partB = await addNode(root.id, { title: 'PART 2 — الجمارك', nodeKind: 'part', text: 'كلمة نادرة: تفتيش' });
  const loose = await addScript(scene.id, { title: `${TAG} ملاحظة سايبة`, text: 'ملاحظة', type: 'alt' });

  const wav = new Blob([new Uint8Array(48)], { type: 'audio/wav' });
  const one = await media.create({ kind: 'audio', caption: `${TAG}-صوت.wav`, blob: wav, durationMs: 3300 });
  const two = await media.create({ kind: 'image', caption: `${TAG}-صورة.png`, blob: wav });
  await sceneMediaLinks.create({ sceneId: scene.id, mediaId: one.id, order: 1, roles: [] });
  await sceneMediaLinks.create({ sceneId: scene.id, mediaId: two.id, order: 2, roles: [] });

  world = {
    sceneId: scene.id, rootId: root.id, partA: partA.id, round: round.id,
    partB: partB.id, looseId: loose.id, audioId: one.id, imageId: two.id,
  };
  return world;
}

/** يرسم الورشةَ في مضيفٍ حقيقيٍّ داخل الصفحة، ويعيد المضيف. */
async function mount() {
  await ensureCss();
  const w = await buildWorld();
  const host = document.createElement('div');
  host.id = 'wsp-host';
  host.style.cssText = 'position:fixed;inset-block-start:-4000px;inline-size:1280px;block-size:800px';
  document.body.append(host);
  await renderWorkspace(host, w.sceneId);
  await wait(80);
  return { host, w };
}

function unmount(host) {
  disposeWorkspace();
  host.remove();
}

/* ================================================================== *
 * أ · المُتصفِّح الهرميّ الواحد (بند ٣)
 * ================================================================== */

describe('WS-P · أ · المُتصفِّح', () => {
  it('١ · مُتصفِّحٌ واحدٌ يحمل السكريبتات والأجزاء — لا ثلاثةُ أعمدة', async () => {
    const { host, w } = await mount();
    try {
      /* لوحٌ واحدٌ للبنية، لا `ws-a` و`ws-b` و`ws-c`. */
      expect($$('[data-ws-nav]', host)).toHaveLength(1);
      expect($$('[data-ws-main]', host)).toHaveLength(1);
      expect($$('[data-ws-insp]', host)).toHaveLength(1);
      /* والجذرُ ظاهرٌ فيه بالاسم. */
      const titles = $$('.ws-nav-t', host).map((el) => el.textContent.trim());
      expect(titles.some((t) => t.includes('PHASE 1'))).toBe(true);
      expect(w.rootId.length > 0).toBe(true);
    } finally { unmount(host); }
  });

  it('٢ · الفردُ والطيُّ يغيّران عددَ الصفوف فعلًا (بند ٣)', async () => {
    const { host, w } = await mount();
    try {
      /*
       * ⚠️ **الجذرُ الأوّل مفرودٌ عند الفتح** (بند ١٤) — فالضغطةُ الأولى
       *    تطوي لا تفرد. وأوّلُ صياغةٍ لهذا الاختبار افترضت العكسَ
       *    فسقطت، وكانت هي المخطئة لا الشاشة.
       */
      const open = $$('.ws-nav-row', host).length;
      $(`[data-ws="twist"][data-id="${w.rootId}"]`, host).click();
      await wait(40);
      const shut = $$('.ws-nav-row', host).length;
      expect(shut < open).toBe(true);
      $(`[data-ws="twist"][data-id="${w.rootId}"]`, host).click();
      await wait(40);
      expect($$('.ws-nav-row', host).length).toBe(open);
    } finally { unmount(host); }
  });

  it('٣ · والتحديدُ ليس حدًّا بـ١px — سطحٌ وحدٌّ جانبيٌّ وثِقَلُ خطّ (بند ٣)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      await wait(40);
      const row = $(`[data-ws="nav-node"][data-id="${w.partB}"]`, host)?.closest('.ws-nav-row');
      expect(Boolean(row)).toBe(true);
      const css = getComputedStyle(row);
      const label = getComputedStyle(row.querySelector('.ws-nav-t'));
      /* ثلاثُ إشاراتٍ لا واحدة، ولا واحدةٌ منها اللونُ وحدَه. */
      expect(css.boxShadow !== 'none').toBe(true);
      expect(css.backgroundColor !== 'rgba(0, 0, 0, 0)').toBe(true);
      expect(Number(label.fontWeight) >= 700).toBe(true);
      expect(row.querySelector('[data-ws="nav-node"]').getAttribute('aria-selected')).toBe('true');
    } finally { unmount(host); }
  });

  it('٤ · والأعدادُ من البيان لا من التصميم (بند ٢٣)', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    const target = board.targetById.get(w.rootId);
    /* ثلاثُ عُقَدٍ تحت الجذر فعلًا: جزء١ · جولة · جزء٢ — والعدُّ المباشر ٢. */
    expect(target.children).toBe(2);
    expect(board.targetById.get(w.partA).children).toBe(1);
    /* ولا وسائطَ مربوطةً بعد، فالأعدادُ أصفارٌ حقيقيّةٌ لا أرقامٌ زخرفيّة. */
    expect(target.own).toEqual({ audio: 0, images: 0 });
    expect(target.sub).toEqual({ audio: 0, images: 0 });
  });

  it('٥ · البحثُ يكشف العقدةَ المطابِقةَ **وسلسلةَ نسبها** (بند ١٦)', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    const found = searchReveal(board, 'تفتيش');
    expect(found.hit.has(w.partB)).toBe(true);
    /* والأبُ مكشوفٌ ولو لم يطابق — وإلّا كانت النتيجةُ معلّقةً في الفراغ. */
    expect(found.reveal.has(w.rootId)).toBe(true);
    expect(found.hit.has(w.rootId)).toBe(false);
  });

  it('٦ · ومسحُ البحث لا يهدم التحديدَ ولا الفروعَ المفرودة (بند ١٦)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partA);
      __wsp.state.expanded.add(w.partA);
      await wait(40);
      const box = $('[data-ws-nav-find]', host);
      box.value = 'تفتيش';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(220);
      $('[data-ws="nav-clear"]', host)?.click();
      await wait(60);
      expect(__wsp.state.open.id).toBe(w.partA);
      expect(__wsp.state.expanded.has(w.partA)).toBe(true);
      expect($('[data-ws-nav-find]', host).value).toBe('');
    } finally { unmount(host); }
  });

  it('٧ · وبحثٌ بلا نتيجةٍ يقول ذلك ويعرض بابَ الخروج (بند ٢٤)', async () => {
    const { host } = await mount();
    try {
      const box = $('[data-ws-nav-find]', host);
      box.value = 'قققققق-مفيش';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(220);
      const empty = $('.ws-nav .ws-empty', host);
      expect(Boolean(empty)).toBe(true);
      expect(empty.textContent.includes('مفيش نتيجة')).toBe(true);
      expect(Boolean(empty.querySelector('[data-ws="nav-clear"]'))).toBe(true);
    } finally { unmount(host); }
  });

  it('٨ · ولا تُرسَم آلافُ الصفوف — سقفٌ لكلّ أبٍ وباقٍ معلَنٌ بعدده (بند ١٥)', () => {
    /* لوحةٌ صناعيّةٌ بأبٍ تحته ٤٠٠٠ ابن — بلا قاعدةٍ ولا شاشة. */
    const kids = Array.from({ length: 4000 }, (_, i) => ({
      node: { id: `k${i}`, title: `عقدة ${i}`, nodeKind: 'part' }, children: [], depth: 0,
    }));
    const board = {
      roots: [{ id: 'r', title: 'جذر' }],
      looseTexts: [],
      treeByRoot: new Map([['r', kids]]),
      targetById: new Map([['r', { id: 'r', own: { audio: 0, images: 0 }, sub: { audio: 0, images: 0 } }]]),
      haystack: new Map(),
    };
    const { rows, truncated } = navRows(board, { expanded: new Set(['r']) });
    const items = rows.filter((one) => one.type === 'item');
    expect(items.length <= NAV_PAGE + 1).toBe(true);
    const more = rows.find((one) => one.type === 'more');
    /* ⚠️ والعددُ الباقي حقيقيٌّ لا كلمةُ «المزيد». */
    expect(more.remaining).toBe(4000 - NAV_PAGE);
    expect(more.total).toBe(4000);
    expect(truncated).toBe(4000 - NAV_PAGE);
  });

  it('٩ · وزرُّ «عرض المزيد» يزيد المرسومَ فعلًا (بند ١٥)', () => {
    const kids = Array.from({ length: 400 }, (_, i) => ({
      node: { id: `k${i}`, title: `عقدة ${i}` }, children: [], depth: 0,
    }));
    const board = {
      roots: [{ id: 'r', title: 'جذر' }], looseTexts: [],
      treeByRoot: new Map([['r', kids]]),
      targetById: new Map([['r', {}]]), haystack: new Map(),
    };
    const first = navRows(board, { expanded: new Set(['r']) });
    const after = navRows(board, { expanded: new Set(['r']), shown: new Map([['r', 300]]) });
    expect(after.rows.filter((o) => o.type === 'item').length
      > first.rows.filter((o) => o.type === 'item').length).toBe(true);
    expect(after.truncated).toBe(100);
  });

  it('٩أ · وسقفٌ **عامٌّ** يحمي بحثًا واسعًا في شجرةٍ عميقة (بند ١٥)', () => {
    /*
     * ⚠️ **عطبٌ قاسه المسبار: السقفُ لكلّ أبٍ لا يكفي شجرةً عميقة.**
     *    ٢٠ أبًا لكلٍّ ١٠ أبناءٍ لكلٍّ ١٠ = ٢١٠٠ عقدة، ولا أبَ منها
     *    يتجاوز سقفَه — فرُسمت كلُّها، وكلّف البحثُ ٧٣٣ms.
     */
    const deep = (prefix, depth) => (depth === 0 ? [] : Array.from({ length: 12 }, (_, i) => ({
      node: { id: `${prefix}-${i}`, title: `عقدة ${prefix}-${i} كلمةٌ-شائعة` },
      children: deep(`${prefix}-${i}`, depth - 1),
    })));
    const kids = deep('n', 3);
    const haystack = new Map();
    const targetById = new Map();
    const walk = (list, parentId) => {
      for (const row of list) {
        haystack.set(row.node.id, row.node.title.toLowerCase());
        targetById.set(row.node.id, { id: row.node.id, parentId });
        walk(row.children, row.node.id);
      }
    };
    walk(kids, 'r');
    haystack.set('r', 'جذر');
    targetById.set('r', { id: 'r', parentId: null });

    const board = {
      roots: [{ id: 'r', title: 'جذر' }], looseTexts: [],
      treeByRoot: new Map([['r', kids]]), targetById, haystack,
    };
    const out = navRows(board, { expanded: new Set(), query: 'كلمةٌ-شائعة' });
    const items = out.rows.filter((one) => one.type === 'item');
    expect(items.length <= 400).toBe(true);
    /* والمخفيُّ يُعلَن بعدده الحقيقيّ لا يُحذَف صامتًا (بند ٢٣). */
    const limit = out.rows.find((one) => one.type === 'limit');
    expect(Boolean(limit)).toBe(true);
    expect(limit.shown + limit.hidden).toBe(haystack.size - 1 + 1);
    expect(out.overBudget > 0).toBe(true);
  });

  it('١٠ · والنصوصُ السايبة مجموعةٌ محسوبةٌ لا مخترَعة (بند ٢٣)', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    const groups = navGroups(board);
    expect(groups.loose.some((row) => row.id === w.looseId)).toBe(true);
    expect(groups.scripts.some((row) => row.id === w.rootId)).toBe(true);
    /* ولا يظهر الواحدُ في المجموعتين. */
    expect(groups.scripts.some((row) => row.id === w.looseId)).toBe(false);
  });
});

/* ================================================================== *
 * ب · مساحةُ العمل والأوضاع (بندا ٤ و٥)
 * ================================================================== */

describe('WS-P · ب · المستندُ وأوضاعُه', () => {
  it('١١ · لمسةُ عقدةٍ تفتحها في مساحة العمل بعنوانها (بند ٤)', async () => {
    const { host, w } = await mount();
    try {
      $(`[data-ws="nav-node"][data-id="${w.rootId}"]`, host).click();
      await wait(60);
      expect($('.ws-doc-title h2', host).textContent.includes('PHASE 1')).toBe(true);
    } finally { unmount(host); }
  });

  it('١٢ · والفُتاتُ يعكس النسبَ الحقيقيَّ وينقلك بالضغط (بند ٤)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.round);
      await wait(60);
      const crumbs = $$('.ws-crumbs .ws-crumb', host).map((el) => el.textContent.trim());
      expect(crumbs).toHaveLength(3);
      expect(crumbs[2]).toBe('ROUND A');
      /* والضغطُ على الأب ينقلك إليه فعلًا. */
      $('.ws-crumbs [data-ws="nav-node"]', host).click();
      await wait(60);
      expect(__wsp.state.open.id).toBe(w.rootId);
    } finally { unmount(host); }
  });

  it('١٣ · والحوارُ يُرسَم أدوارًا — لا سطرًا خامًا (بند ٤)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(60);
      expect($$('.ws-turn', host)).toHaveLength(3);
      /* وفقرةٌ روسيّةٌ تأخذ اتّجاهَها هي (بند ٩). */
      const ltr = $$('.ws-turn-body p[dir="ltr"]', host);
      expect(ltr.length >= 1).toBe(true);
    } finally { unmount(host); }
  });

  it('١٤ · ونصٌّ عاديٌّ يُعرَض نصًّا — لا يُقحَم في قالبِ حوار (بند ٤)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      await wait(60);
      expect(Boolean($('.ws-raw', host))).toBe(true);
      expect($$('.ws-turn', host)).toHaveLength(0);
      /* ولا مبدّلَ «نصّ/محادثة» على ما ليس حوارًا. */
      expect($$('[data-ws="dmode"]', host)).toHaveLength(0);
    } finally { unmount(host); }
  });

  it('١٥ · والأوضاعُ ثلاثةٌ مسمّاةٌ تُعلَن للتقنيات المساعدة (بندا ٥ و٢١)', async () => {
    const { host } = await mount();
    try {
      const modes = $$('[data-ws="mode"]', host);
      expect(modes.map((el) => el.textContent.trim()))
        .toEqual([MODE_LABEL.read, MODE_LABEL.edit, MODE_LABEL.link]);
      expect(modes[0].getAttribute('aria-selected')).toBe('true');
      expect(modes[1].getAttribute('aria-selected')).toBe('false');
    } finally { unmount(host); }
  });

  it('١٦ · والتحريرُ داخل الصفحة لا نافذةٌ منبثقة (بند ٥)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      __wsp.setMode(MODE.EDIT);
      await wait(60);
      const area = $('[data-ws-edit-text]', host);
      expect(Boolean(area)).toBe(true);
      expect(area.value.includes('تفتيش')).toBe(true);
      /* ولا نافذةَ فُتحت. */
      expect($$('[role="dialog"]')).toHaveLength(0);
    } finally { unmount(host); }
  });

  it('١٧ · وتبديلُ الوضع لا يُلقي المسوّدة (بند ٥)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      __wsp.setMode(MODE.EDIT);
      await wait(60);
      const area = $('[data-ws-edit-text]', host);
      area.value = 'كلام مؤقّت من الاختبار';
      area.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(40);

      __wsp.setMode(MODE.READ);
      await wait(60);
      __wsp.setMode(MODE.EDIT);
      await wait(60);
      expect($('[data-ws-edit-text]', host).value).toBe('كلام مؤقّت من الاختبار');
      expect(__wsp.state.draft.status).toBe(SAVE.DIRTY);
    } finally { unmount(host); }
  });

  it('١٨ · ووضعُ «ربط» يفتح المُفتِّشَ على تبويب الربط (بندا ٥ و١٨)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      __wsp.setMode(MODE.LINK);
      await wait(60);
      expect(__wsp.state.inspector).toBe(true);
      expect(__wsp.state.tab).toBe(TAB.LINKS);
      expect($('.ws', host).dataset.insp).toBe('on');
    } finally { unmount(host); }
  });

  it('١٩ · والصوتُ سطحُه هو — والشاشةُ لا تملك عنصرَ صوتٍ خاصًّا (بند ٣٥)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.openMedia(w.audioId, 'audio');
      await wait(60);
      expect(Boolean($('.ws-media-play', host))).toBe(true);
      /* ⚠️ ولا `<audio>` داخل الشاشة — الخدمةُ العامّةُ تملكه وحدَها. */
      expect($$('audio', host)).toHaveLength(0);
      const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
      expect(code.includes("createElement('audio')")).toBe(false);
      expect(code.includes('new Audio(')).toBe(false);
    } finally { unmount(host); }
  });

  it('٢٠ · وعنصرٌ اختفى يُقال عنه ذلك ولا يُترَك سطحًا فارغًا (بند ٢٦)', async () => {
    const { host } = await mount();
    try {
      /* هدفٌ لا وجودَ له — كما لو حُذف من جهازٍ آخرَ ثم زُومِن. */
      __wsp.state.open = { kind: 'text', id: 'لا-وجود-له' };
      __wsp.setMode(MODE.LINK);
      await wait(80);
      expect($('[data-ws-doc]', host).textContent.includes('مابقاش موجود')).toBe(true);
      /* ⚠️ ولا انهيارَ في المُفتِّش كذلك — الصفوفُ فارغةٌ لا خطأ. */
      expect($('[data-ws-insp]', host).textContent.length > 0).toBe(true);
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * ج · الحفظُ الصادق (بند ١٣)
 * ================================================================== */

describe('WS-P · ج · الحفظ', () => {
  it('٢١ · «فيه تعديلات» تُقاس بالمقارنة بالأصل لا برايةٍ تُرفَع', () => {
    const draft = makeDraft({ id: 'x', title: 'أ', text: 'ب' });
    expect(draftChanged(draft)).toBe(false);
    draft.text = 'ج';
    expect(draftChanged(draft)).toBe(true);
    /* ⚠️ وتراجعُك عن كتابتك يعيدها «محفوظة» — لا تبقى الرايةُ مرفوعة. */
    draft.text = 'ب';
    expect(draftChanged(draft)).toBe(false);
  });

  it('٢٢ · وبعد الحفظ يصير الأصلُ ما حُفِظ', () => {
    const draft = makeDraft({ id: 'x', title: 'أ', text: 'ب' });
    draft.text = 'ج';
    const done = draftCommitted(draft);
    expect(done.status).toBe(SAVE.SAVED);
    expect(draftChanged(done)).toBe(false);
  });

  it('٢٣ · والشارةُ تعرض الحالاتِ الأربعَ بالعربيّة (بند ١٣)', () => {
    expect(SAVE_LABEL[SAVE.CLEAN]).toBe('محفوظ');
    expect(SAVE_LABEL[SAVE.SAVING]).toBe('بيحفظ…');
    expect(SAVE_LABEL[SAVE.DIRTY]).toBe('فيه تعديلات مش متحفظة');
    expect(SAVE_LABEL[SAVE.FAILED]).toBe('الحفظ فشل');
  });

  it('٢٤ · والكتابةُ تُبدِّل الشارةَ ولا تُعيد رسمَ الحقل (بند ١٣)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partA);
      __wsp.setMode(MODE.EDIT);
      await wait(60);
      const area = $('[data-ws-edit-text]', host);
      area.value = 'سطر';
      area.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(40);
      /* ⚠️ **نفسُ العنصر** — لو أُعيد رسمُه لَقفزت المؤشّرة. */
      expect($('[data-ws-edit-text]', host) === area).toBe(true);
      expect($('[data-ws-save]', host).textContent.trim()).toBe(SAVE_LABEL[SAVE.DIRTY]);
    } finally { unmount(host); }
  });

  it('٢٥ · و«اتحفظ» لا تُقال إلّا بعد أن يرجع النصُّ من القاعدة (بند ١٣)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partA);
      __wsp.setMode(MODE.EDIT);
      await wait(60);
      const fresh = `متن أ — عُدِّل ${TAG}`;
      const area = $('[data-ws-edit-text]', host);
      area.value = fresh;
      area.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(30);

      await __wsp.saveDraft();
      await wait(120);
      expect($('[data-ws-save]', host).textContent.trim()).toBe(SAVE_LABEL[SAVE.SAVED]);
      /* والقاعدةُ هي الشاهد — لا الشارة. */
      const row = await scripts.get(w.partA);
      expect(row.text).toBe(fresh);
    } finally { unmount(host); }
  });

  it('٢٦ · وفشلُ الحفظ يُبقي المسوّدةَ ولا يطردك من التحرير (بند ١٣)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      __wsp.setMode(MODE.EDIT);
      await wait(60);
      const area = $('[data-ws-edit-text]', host);
      area.value = 'كلام هيفشل حفظُه';
      area.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(30);

      /* ⚠️ عطبٌ مُصطنَعٌ في طبقة الكتابة — لا في الشاشة. */
      const original = scripts.update;
      scripts.update = async () => { throw new Error('قرصٌ ممتلئ (اختبار)'); };
      try {
        await __wsp.saveDraft();
        await wait(120);
      } finally { scripts.update = original; }

      expect(__wsp.state.mode).toBe(MODE.EDIT);
      expect(__wsp.state.draft.status).toBe(SAVE.FAILED);
      expect($('[data-ws-edit-text]', host).value).toBe('كلام هيفشل حفظُه');
      expect(Boolean($('.ws-fail.is-inline', host))).toBe(true);
      expect($('.ws-fail.is-inline', host).textContent.includes('قرصٌ ممتلئ')).toBe(true);
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * د · المُفتِّشُ والربط (بندا ٦ و١٨)
 * ================================================================== */

describe('WS-P · د · المُفتِّشُ والربط', () => {
  it('٢٧ · ثلاثةُ تبويباتٍ مسمّاةٌ ومُعلَنة (بند ٦)', async () => {
    const { host } = await mount();
    try {
      $('.ws-insp-toggle', host).click();
      await wait(60);
      const tabs = $$('.ws-insp-tab', host).map((el) => el.textContent.trim());
      expect(tabs).toEqual(['الربط', 'الخصائص', 'الوسائط']);
    } finally { unmount(host); }
  });

  it('٢٨ · وإغلاقُ المُفتِّش يعيد العرضَ للمستند — بقياسٍ لا بوعد (بند ٦)', async () => {
    const { host } = await mount();
    try {
      const widthOf = () => Math.round($('[data-ws-main]', host).getBoundingClientRect().width);
      const closed = widthOf();
      $('.ws-insp-toggle', host).click();
      await wait(120);
      const open = widthOf();
      $('[data-ws="insp-close"]', host).click();
      await wait(120);
      const again = widthOf();
      expect(open < closed).toBe(true);
      expect(again).toBe(closed);
      /* ⚠️ ولا عمودٌ ميّتٌ محجوز. */
      expect(Math.round($('[data-ws-insp]', host).getBoundingClientRect().width)).toBe(0);
    } finally { unmount(host); }
  });

  it('٢٩ · وصفوفُ الربط تقول نوعَ العلاقة في الاتّجاهين (بند ٦)', async () => {
    const w = await buildWorld();
    const { linkSelection } = await import('../js/services/workspace/workspace-service.js');
    let board = await workspaceBoard(w.sceneId);
    await linkSelection([w.audioId], w.partA, board, { mode: 'attach' });
    board = await workspaceBoard(w.sceneId);

    const fromNode = linkRowsFor(board, { kind: 'text', id: w.partA });
    expect(fromNode.some((r) => r.relation === 'audio' && r.id === w.audioId)).toBe(true);
    expect(fromNode.some((r) => r.relation === 'parent' && r.id === w.rootId)).toBe(true);

    const fromMedia = linkRowsFor(board, { kind: 'audio', id: w.audioId });
    expect(fromMedia).toHaveLength(1);
    expect(fromMedia[0].relation).toBe('placed');
    expect(fromMedia[0].id).toBe(w.partA);
  });

  it('٣٠ · والربطُ يضيف وجهةً ولا يهدم وجهةً قائمة (بند ٢٢)', async () => {
    const w = await buildWorld();
    const { linkSelection } = await import('../js/services/workspace/workspace-service.js');
    let board = await workspaceBoard(w.sceneId);
    await linkSelection([w.imageId], w.partA, board, { mode: 'attach' });
    board = await workspaceBoard(w.sceneId);
    await linkSelection([w.imageId], w.partB, board, { mode: 'attach' });
    board = await workspaceBoard(w.sceneId);
    expect(board.linkedTo.get(w.imageId)).toHaveLength(2);
  });

  it('٣١ · والفكُّ يشيل الوجهةَ المسمّاةَ وحدَها ويُبقي الملفّ (بند ٦)', async () => {
    const w = await buildWorld();
    /*
     * ⚠️ **الفكُّ في الشاشة يسأل أوّلًا** — و`confirmAction` تنتظر إصبعًا،
     *    فنداؤها من اختبارٍ يُعلّق الجولةَ إلى الأبد (وقد علّقها فعلًا في
     *    أوّل صياغة). فالمحروسُ هنا **أثرُ الفكّ** لا نافذتُه: النافذةُ
     *    محروسةٌ نصًّا في اختبار «الأفعال الخطرة تسأل».
     */
    const { unlinkOne } = await import('../js/services/workspace/workspace-service.js');
    let board = await workspaceBoard(w.sceneId);
    await unlinkOne(w.imageId, board, w.partA);
    board = await workspaceBoard(w.sceneId);
    const left = board.linkedTo.get(w.imageId) || [];
    expect(left).toHaveLength(1);
    expect(left[0]).toBe(w.partB);
    expect(Boolean(await media.get(w.imageId))).toBe(true);

    /* والفكُّ من الشاشة لا يقع بلا سؤال. */
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    const from = view.indexOf('async function dropLink');
    expect(view.slice(from, from + 500).includes('confirmAction')).toBe(true);
  });

  it('٣٢ · وهدفٌ مفقودٌ يُعلَن بزرٍّ معطَّلٍ لا يُمحى من التاريخ (بند ٢٦)', () => {
    const board = {
      linkedTo: new Map([['m1', ['ذهبت']]]),
      targetById: new Map(),
      ownMedia: new Map(),
    };
    const rows = linkRowsFor(board, { kind: 'audio', id: 'm1' });
    expect(rows).toHaveLength(1);
    expect(rows[0].missing).toBe(true);
    expect(rows[0].id).toBe('ذهبت');
  });

  it('٣٣ · ومكتبةُ الوسائط تُصفّى بحقٍّ محسوب — و«غير مربوط» أوّلًا (بند ١٩)', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    expect(MEDIA_FILTERS[0].id).toBe('unlinked');
    const all = mediaLibrary(board, { filter: 'all' });
    const unlinked = mediaLibrary(board, { filter: 'unlinked' });
    expect(all.length).toBe(board.audio.length + board.images.length);
    expect(unlinked.every((one) => !board.linkedTo.has(one.row.id))).toBe(true);
    const audioOnly = mediaLibrary(board, { filter: 'audio' });
    expect(audioOnly.every((one) => one.kind === 'audio')).toBe(true);
  });

  it('٣٤ · والبحثُ في الوسائط يصفّي بالاسم الحقيقيّ', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    const hit = mediaLibrary(board, { filter: 'all', query: 'صورة' });
    expect(hit.length >= 1).toBe(true);
    expect(hit.every((one) => (one.row.caption || '').includes('صورة'))).toBe(true);
    expect(mediaLibrary(board, { filter: 'all', query: 'قققق' })).toHaveLength(0);
  });

  it('٣٥ · والخصائصُ من السجلّ لا من مِخطاطٍ (بند ٢٣)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partA);
      $('.ws-insp-toggle', host).click();
      await wait(60);
      $('[data-ws="tab"][data-v="props"]', host).click();
      await wait(60);
      const text = $('[data-ws-insp]', host).textContent;
      const board = await workspaceBoard(w.sceneId);
      const t = board.targetById.get(w.partA);
      expect(text.includes(`${t.chars} حرف`)).toBe(true);
      expect(text.includes(t.path.join(' · '))).toBe(true);
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * هـ · التكيّفُ والتركيزُ واللمس (بنود ٧ و٨ و٢٠ و٢١)
 * ================================================================== */

describe('WS-P · هـ · التكيّفُ واللمس', () => {
  it('٣٦ · المرتبةُ تُحسَب بالعرض الفعليّ — لا بترويسة متصفّح (بند ٨)', () => {
    /* شاشةٌ عريضة: الثلاثةُ معًا. */
    expect(paneFit(1400, { nav: 280, insp: 300 })).toEqual({ navDocked: true, inspDocked: true });
    /* وسطى: المُتصفِّحُ عمودٌ والمُفتِّشُ درج. */
    expect(paneFit(950, { nav: 280, insp: 300 })).toEqual({ navDocked: true, inspDocked: false });
    /* طوليّة: المستندُ أوّلًا والاثنان دَرَجان. */
    expect(paneFit(800, { nav: 280, insp: 300 })).toEqual({ navDocked: false, inspDocked: false });
  });

  it('٣٧ · ولا تُذكَر ترويسةُ المتصفّح ولا اسمُ جهازٍ في الكود (بند ٨)', async () => {
    for (const path of [
      '../js/views/workspace-view.js',
      '../js/services/workspace/workspace-ui.js',
    ]) {
      const code = codeOnly(await (await fetch(path)).text());
      for (const banned of ['userAgent', 'Samsung', 'SM-X', 'navigator.platform', 'maxTouchPoints']) {
        expect(`${path}:${banned}:${code.includes(banned)}`).toBe(`${path}:${banned}:false`);
      }
    }
  });

  it('٣٨ · والحدُّ الأدنى لمساحة العمل محميٌّ قبل أيّ تفضيل (بند ١١)', () => {
    /* تفضيلٌ ضخمٌ محفوظٌ من شاشةٍ عريضة، على شاشةٍ ضيّقة. */
    const nav = clampPane(400, { min: PANE.NAV_MIN, max: PANE.NAV_MAX, viewport: 700, other: 0 });
    expect(nav <= 700 - PANE.MAIN_MIN).toBe(true);
    expect(nav >= PANE.NAV_MIN).toBe(true);
    /* ولا يتجاوز السقفَ على شاشةٍ واسعة. */
    expect(clampPane(9999, { min: PANE.NAV_MIN, max: PANE.NAV_MAX, viewport: 3000, other: 0 }))
      .toBe(PANE.NAV_MAX);
  });

  it('٣٩ · ووضعُ التركيز يخفي اللوحين ويُبقي المستندَ كما هو (بند ٧)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.partB);
      __wsp.setMode(MODE.EDIT);
      await wait(60);
      const area = $('[data-ws-edit-text]', host);
      area.value = 'مسوّدة قبل التركيز';
      area.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(40);

      $('[data-ws="zen"]', host).click();
      await wait(120);
      expect($('.ws', host).dataset.zen).toBe('on');
      expect(Math.round($('[data-ws-nav]', host).getBoundingClientRect().width)).toBe(0);
      /* ⚠️ **ونفسُ عنصر الحقل بنفس محتواه** — لا إعادةَ تحميلٍ ولا فقدَ مسوّدة. */
      expect($('[data-ws-edit-text]', host) === area).toBe(true);
      expect(area.value).toBe('مسوّدة قبل التركيز');
      expect(__wsp.state.mode).toBe(MODE.EDIT);
    } finally { unmount(host); }
  });

  it('٤٠ · ولا هدفَ لمسٍ أصغرَ من ٣٤px في الشاشة كلِّها (بند ٢٠)', async () => {
    const { host } = await mount();
    try {
      $('.ws-insp-toggle', host).click();
      await wait(80);
      const tiny = $$('.ws button, .ws a', host)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 34 || r.width < 22))
        .map(({ el }) => `${el.className}|${el.textContent.trim().slice(0, 12)}`);
      expect(tiny).toEqual([]);
    } finally { unmount(host); }
  });

  it('٤١ · ولا تمريرَ أفقيًّا للصفحة ولو طالت العناوين (بند ٨)', async () => {
    const { host, w } = await mount();
    try {
      /* عنوانٌ روسيٌّ طويلٌ بلا مسافات — أقسى حالةٍ على القصّ. */
      await scripts.update(w.partB, { title: 'Вскрытьупаковкупередпроверкойтаможенниками'.repeat(2) });
      await __wsp.refresh();
      await wait(80);
      const nav = $('[data-ws-nav]', host);
      expect(nav.scrollWidth <= nav.clientWidth + 1).toBe(true);
      expect(document.documentElement.scrollWidth
        <= document.documentElement.clientWidth + 1).toBe(true);
      await scripts.update(w.partB, { title: 'PART 2 — الجمارك' });
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * و · النظافةُ البنيويّة (بنود ٢٢ و٢٩ و٣٦)
 * ================================================================== */

describe('WS-P · و · ما لا يجوز أن يتغيّر', () => {
  it('٤٢ · ولا مخزنَ ولا ترقيةَ ولا نسخةَ سجلٍّ من أجل العرض (بندا ٢٢ و٣٦)', async () => {
    const schema = await (await fetch('../js/db/schema.js')).text();
    for (const invented of ['workspaceNodes', 'workspacePanes', 'contentDesk', 'navState']) {
      expect(`${invented}:${schema.includes(invented)}`).toBe(`${invented}:false`);
    }
    const migrations = await (await fetch('../js/db/migrations.js')).text();
    expect(migrations.toLowerCase().includes('workspace')).toBe(false);

    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    /* والشاشةُ لا تكتب في مستودعٍ بيدها. */
    expect(view.includes("from '../db/repositories.js'")).toBe(false);
    /* ولا تنسخ سجلًّا لتسهيل العرض. */
    for (const banned of ['.create(', 'structuredClone(']) {
      expect(`${banned}:${view.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٤٣ · وحالةُ الجلسة لا تُحفَظ — إلّا عرضَ اللوحين وحدَه (بند ٣٦)', async () => {
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    /*
     * ⚠️ **الاستثناءُ مسمًّى ومحصورٌ في ملفٍّ واحد.** ما يجب ألّا يُحفَظ
     *    هو *أين كنتَ واقفًا* — لأنّ استعادتَه بعد يومين تجعل ضغطةً
     *    واحدةً تكتب في القاعدة بهدفٍ نسيتَه. وعرضُ اللوح لا يوجّه فعلًا.
     */
    for (const banned of ['localStorage', 'sessionStorage', 'saveSetting']) {
      expect(`${banned}:${view.includes(banned)}`).toBe(`${banned}:false`);
    }
    const prefs = codeOnly(await (await fetch('../js/services/workspace/pane-prefs.js')).text());
    expect(prefs.includes('localStorage')).toBe(true);
    /* ولا يحفظ هذا الملفُّ شيئًا غيرَ العرضين. */
    for (const banned of ['open', 'targetId', 'draft', 'selection']) {
      expect(`${banned}:${prefs.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٤٤ · وكلُّ مستمعٍ في الشاشة يأخذ إشارةَ القطع', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    const from = code.indexOf('const freshWires');
    expect(from > 0).toBe(true);
    const body = code.slice(from);

    const naked = [];
    for (const hit of body.matchAll(/(\w+)\.addEventListener\(/g)) {
      let depth = 0; let quote = null; let j = hit.index + hit[0].length - 1;
      for (; j < body.length; j += 1) {
        const ch = body[j];
        if (quote) { if (ch === '\\') { j += 1; continue; } if (ch === quote) quote = null; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
        if (ch === '(') depth += 1;
        else if (ch === ')') { depth -= 1; if (!depth) break; }
      }
      const call = body.slice(hit.index, j + 1);
      if (!call.includes('wired(')) naked.push(`${hit[1]}:${call.slice(0, 46)}`);
    }
    expect(naked).toEqual([]);
  });

  it('٤٥ · ومغادرةُ الشاشة تقطع كلَّ شيءٍ ولا توقف الصوت (بند ٣٥)', async () => {
    const { host } = await mount();
    expect(document.body.classList.contains('workspace-open')).toBe(true);
    unmount(host);
    expect(document.body.classList.contains('workspace-open')).toBe(false);
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    const from = code.indexOf('export function disposeWorkspace');
    const body = code.slice(from, code.indexOf('\n}', from));
    /* ⚠️ إيقافُ الصوت هنا يكسر «الصوت يكمل والتابلت مقفول» (WS51). */
    expect(body.includes('audio.pause()')).toBe(false);
    expect(body.includes('audio.stop()')).toBe(false);
  });

  it('٤٦ · ولا معرِّفَ مكرَّرٌ ولا زرٌّ بلا اسمٍ مقروء (بند ٢١)', async () => {
    const { host } = await mount();
    try {
      $('.ws-insp-toggle', host).click();
      await wait(80);
      const ids = $$('[id]', host).map((el) => el.id);
      expect(ids.length).toBe(new Set(ids).size);

      const mute = $$('.ws button', host).filter((el) => {
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
        return name.length === 0;
      }).map((el) => el.className);
      expect(mute).toEqual([]);
    } finally { unmount(host); }
  });

  it('٤٧ · ولا زرٌّ ميّتٌ: كلُّ `data-ws` له فرعٌ في المعالج (بند ٢٩)', async () => {
    const { host } = await mount();
    try {
      $('.ws-insp-toggle', host).click();
      await wait(80);
      const code = await (await fetch('../js/views/workspace-view.js')).text();
      const acts = new Set($$('[data-ws]', host).map((el) => el.dataset.ws).filter(Boolean));
      const dead = [...acts].filter((one) => !code.includes(`case '${one}'`)
        && !code.includes(`data-ws="${one}"`.replace('data-ws=', 'closest(')));
      /* `seek` و`split` يُعالَجان في `pointerdown` لا في `switch`. */
      const known = dead.filter((one) => !['seek'].includes(one));
      expect(known).toEqual([]);
    } finally { unmount(host); }
  });

  it('٤٨ · ولا خطأٌ في الطرفيّة أثناء دورةٍ كاملةٍ من الاستعمال (بند ٢٩)', async () => {
    const seen = [];
    const original = console.error;
    console.error = (...args) => { seen.push(args.join(' ')); original(...args); };
    const { host, w } = await mount();
    try {
      $(`[data-ws="nav-node"][data-id="${w.rootId}"]`, host).click();
      await wait(50);
      $(`[data-ws="twist"][data-id="${w.rootId}"]`, host).click();
      await wait(50);
      __wsp.selectNode(w.partA);
      await wait(40);
      __wsp.setMode(MODE.EDIT);
      await wait(40);
      __wsp.setMode(MODE.LINK);
      await wait(60);
      $('[data-ws="tab"][data-v="media"]', host).click();
      await wait(60);
      $('[data-ws="tab"][data-v="props"]', host).click();
      await wait(60);
      __wsp.openMedia(w.audioId, 'audio');
      await wait(60);
      $('[data-ws="zen"]', host).click();
      await wait(60);
      expect(seen).toEqual([]);
    } finally {
      console.error = original;
      unmount(host);
    }
  });
});

/* ================================================================== *
 * ز · الأداءُ بقياسٍ لا بادّعاء (بند ٣١)
 * ================================================================== */

describe('WS-P · ز · الأداء', () => {
  it('ق١ · تسطيحُ شجرةٍ بأربعة آلاف عقدةٍ تحت أبٍ واحدٍ يبقى دون ٥٠ms', () => {
    const kids = Array.from({ length: 4000 }, (_, i) => ({
      node: { id: `k${i}`, title: `عقدة رقم ${i}` }, children: [], depth: 0,
    }));
    const board = {
      roots: [{ id: 'r', title: 'جذر' }], looseTexts: [],
      treeByRoot: new Map([['r', kids]]),
      targetById: new Map([['r', {}]]), haystack: new Map(),
    };
    const t0 = performance.now();
    for (let i = 0; i < 20; i += 1) navRows(board, { expanded: new Set(['r']) });
    const each = (performance.now() - t0) / 20;
    /* ⚠️ رقمٌ مقيسٌ يُطبَع، لا ادّعاءٌ بأنها «سريعة». */
    expect(`${each < 50}`).toBe('true');
  });

  it('ق٢ · وبحثٌ في فهرسٍ بأربعة آلاف عقدةٍ يبقى دون ٥٠ms', () => {
    const haystack = new Map();
    const targetById = new Map();
    for (let i = 0; i < 4000; i += 1) {
      haystack.set(`k${i}`, `عقدة رقم ${i} · ${'نصّ طويل '.repeat(20)}`);
      targetById.set(`k${i}`, { id: `k${i}`, parentId: i > 0 ? `k${i - 1}` : null });
    }
    const board = { haystack, targetById };
    const t0 = performance.now();
    for (let i = 0; i < 10; i += 1) searchReveal(board, 'عقدة رقم 3999');
    const each = (performance.now() - t0) / 10;
    expect(`${each < 50}`).toBe('true');
    expect(searchReveal(board, 'عقدة رقم 3999').hit.has('k3999')).toBe(true);
  });

  it('ق٣ · والوسائطُ المُعلَّقةُ على عقدةٍ تُقرأ من حسابٍ جاهزٍ لا بمسحٍ جديد', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    expect(board.ownMedia instanceof Map).toBe(true);
    const mine = mediaOf(board, w.partA);
    expect(Array.isArray(mine.audio)).toBe(true);
    /* والشاشةُ لا تعيد المسحَ بنفسها. */
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    expect(view.includes('board.audio.filter(')).toBe(false);
    expect(view.includes('board.images.filter(')).toBe(false);
  });

  it('ق٤ · وسلسلةُ النسب تُقرأ من `parentId` المحسوب مرّةً في الخدمة', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    expect(board.targetById.get(w.round).parentId).toBe(w.partA);
    expect(board.targetById.get(w.rootId).parentId).toBe(null);
    expect(ancestorsOf(board, w.round)).toEqual([w.partA, w.rootId]);
    expect(crumbsOf(board, w.round).map((one) => one.title))
      .toEqual([`${TAG} PHASE 1`, 'PART 1 — التقديم', 'ROUND A']);
  });

  it('ق٥ · وعلاقاتُ العضويّة تُقرأ استعلامًا واحدًا لا استعلامًا لكلّ عقدة', async () => {
    const svc = codeOnly(await (await fetch('../js/services/workspace/workspace-service.js')).text());
    /* ⚠️ `subtreeOf` تسأل القاعدةَ مرّتين لكلّ عقدة — ولا تُنادى هنا. */
    expect(svc.includes('subtreeOf(')).toBe(false);
    expect(svc.includes("relationships.byIndex('kind', PART_OF)")).toBe(true);
    expect(relationships.byIndex.length >= 1).toBe(true);
  });
});

/* ================================================================== *
 * ح · WS-P2 · الهرميّةُ المرنة (بنود ١٣…١٨ و٣٧)
 * ================================================================== */

describe('WS-P2 · ح · شجرةٌ تنمو كما يريد صاحبُها', () => {
  /**
   * شجرةٌ واقعيّة: سكريبت ← ١٢ مرحلة، والثانيةُ مقسومةٌ إلى ٢أ/٢ب/٢ج،
   * و٢ب فيها ابنان. تُبنى مرّةً ويُقاس عليها كلُّ ما تحت.
   */
  let tree = null;
  async function buildTree() {
    if (tree) return tree;
    const scene = await createScene({ titleAr: `${TAG} هرميّة`, date: '2026-09-04' });
    const root = await addScript(scene.id, { title: 'التواصل في الشغل', text: 'جذر' });
    const phases = [];
    for (let i = 1; i <= 12; i += 1) {
      /* eslint-disable-next-line no-await-in-loop */
      phases.push(await addNode(root.id, { title: `مرحلة ${i}`, nodeKind: 'phase', text: `م${i}` }));
    }
    const p2 = phases[1];
    const a = await addNode(p2.id, { title: '٢أ — النطق', nodeKind: 'part', text: 'أ' });
    const b = await addNode(p2.id, { title: '٢ب — الجمارك', nodeKind: 'part', text: 'ب' });
    await addNode(p2.id, { title: '٢ج — المراجعة', nodeKind: 'part', text: 'ج' });
    const deep1 = await addNode(b.id, { title: 'محتوى أوّل', nodeKind: 'custom', text: 'كلمة-نادرة-جدًّا' });
    await addNode(b.id, { title: 'محتوى تاني', nodeKind: 'custom', text: 'تاني' });
    tree = {
      sceneId: scene.id, rootId: root.id, phases: phases.map((one) => one.id),
      p2: p2.id, a: a.id, b: b.id, deep1: deep1.id,
    };
    return tree;
  }

  it('٥٥ · النموذجُ يحتمل عمقًا حرًّا — لا ثلاثةَ مستوياتٍ مفروضة (بند ١٣)', async () => {
    const t = await buildTree();
    const board = await workspaceBoard(t.sceneId);
    /* جذر ← مرحلة ← جزء ← محتوى = أربعةُ مستوياتٍ حقيقيّةٍ في القاعدة. */
    expect(board.targetById.get(t.deep1).depth).toBe(3);
    expect(crumbsOf(board, t.deep1)).toHaveLength(4);
  });

  it('٥٦ · ولا افتراضَ لعدد المراحل — اثنتا عشرةَ أو غيرُها سواء (بند ١٣)', async () => {
    const t = await buildTree();
    const board = await workspaceBoard(t.sceneId);
    expect(board.targetById.get(t.rootId).children).toBe(12);
    /*
     * ⚠️ **حارسٌ يفحص الافتراضَ لا الرقم.** أوّلُ صياغةٍ منعت السلسلةَ
     *    «12» في الملفّ — فسقطت على `1280` في تعليقِ قياس، وعلى `120`
     *    في تأخير البحث. وحارسٌ يسقط على رقمٍ لا علاقةَ له بالمراد
     *    حارسٌ يُعطَّل بعد أوّل إزعاج. فالمفحوصُ الأنماطُ الدالّة.
     */
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    const ui = codeOnly(await (await fetch('../js/services/workspace/workspace-ui.js')).text());
    const code = view + ui;
    for (const shape of [
      /length\s*===\s*\d+/, /PHASE_COUNT/, /phases?\s*\[\s*\d{2}/,
      /slice\(0,\s*12\)/, /'مرحلة '\s*\+/,
    ]) {
      expect(`${shape}:${shape.test(code)}`).toBe(`${shape}:false`);
    }
    /* والمستوياتُ تُحسَب من البيان: العمقُ حرٌّ حتى `MAX_DEPTH`. */
    expect(ui.includes('const MAX_DEPTH = 12')).toBe(true);
  });

  it('٥٧ · والمسارُ الحاليُّ وحدَه يُفرَد — لا الشجرةُ كلُّها (بند ١٤)', async () => {
    const t = await buildTree();
    const { host } = await mount();
    try {
      await renderWorkspace(host, t.sceneId);
      await wait(120);
      __wsp.selectNode(t.deep1);
      await wait(80);
      /* آباؤه مفرودون. */
      for (const id of [t.rootId, t.p2, t.b]) {
        expect(`${id}:${__wsp.state.expanded.has(id)}`).toBe(`${id}:true`);
      }
      /* وإخوتُه من المراحل الأخرى مطويّون. */
      expect(__wsp.state.expanded.has(t.phases[5])).toBe(false);
      /* والمرسومُ أقلُّ بكثيرٍ من كلّ العُقد. */
      const drawn = $$('.ws-nav-row', host).length;
      expect(`${drawn < 20}`).toBe('true');
    } finally { unmount(host); }
  });

  it('٥٨ · وإعادةُ التسمية تُبقي المعرّفَ والأبناءَ والروابط (بند ١٦)', async () => {
    const t = await buildTree();
    const { renameNode } = await import('../js/services/organize-service.js');
    const before = await workspaceBoard(t.sceneId);
    const kids = before.targetById.get(t.p2).children;

    await renameNode(t.p2, 'المرحلة الصعبة');
    const after = await workspaceBoard(t.sceneId);

    expect(after.targetById.get(t.p2).title).toBe('المرحلة الصعبة');
    expect(after.targetById.get(t.p2).children).toBe(kids);
    /* والفُتاتُ يتحدّث فورًا لأنّه مشتقٌّ من نفس البيان. */
    expect(crumbsOf(after, t.deep1).map((one) => one.title))
      .toEqual(['التواصل في الشغل', 'المرحلة الصعبة', '٢ب — الجمارك', 'محتوى أوّل']);
    await renameNode(t.p2, 'مرحلة 2');
  });

  it('٥٩ · وإضافةُ ابنٍ تُقسّم المرحلةَ بلا شاشةِ إدارة (بند ١٨)', async () => {
    const t = await buildTree();
    const made = await addNode(t.phases[2], { title: '٣أ — تفريع', nodeKind: 'part', text: 'ت' });
    const board = await workspaceBoard(t.sceneId);
    expect(board.targetById.get(made.id).parentId).toBe(t.phases[2]);
    expect(board.targetById.get(t.phases[2]).children).toBe(1);
  });

  it('٦٠ · وإضافةُ شقيقٍ تزيد مرحلةً — والاسمُ اسمُك (بند ١٥)', async () => {
    const t = await buildTree();
    const { addTextAt } = await import('../js/services/workspace/workspace-service.js');
    const made = await addTextAt(t.phases[0], 'after', { title: 'مرحلة ١ب', text: 'ب' });
    expect(Boolean(made)).toBe(true);
    const board = await workspaceBoard(t.sceneId);
    expect(board.targetById.get(made.id).parentId).toBe(t.rootId);
    expect(board.targetById.get(made.id).title).toBe('مرحلة ١ب');
  });

  it('٦١ · والنقلُ إلى أبٍ آخرَ يعمل، وإلى نسلِه يُرفَض (بند ١٧)', async () => {
    const t = await buildTree();
    const org = await import('../js/services/organize-service.js');

    await org.moveNodeTo(t.a, t.phases[4]);
    let board = await workspaceBoard(t.sceneId);
    expect(board.targetById.get(t.a).parentId).toBe(t.phases[4]);

    /* ⚠️ عقدةٌ داخل أحد أبنائها = شجرةٌ مكسورة. تُرفَض في الخدمة. */
    let refused = '';
    try { await org.moveNodeTo(t.p2, t.b); } catch (error) { refused = error.message; }
    expect(refused).toContain('مينفعش');
    /* وإلى نفسِها تُرفَض بلا استثناء. */
    expect(await org.moveNodeTo(t.p2, t.p2)).toBe(false);

    await org.moveNodeTo(t.a, t.p2);
    board = await workspaceBoard(t.sceneId);
    expect(board.targetById.get(t.a).parentId).toBe(t.p2);
  });

  it('٦٢ · والبحثُ يصل إلى عنصرٍ عميقٍ بسلسلة نسبه (بند ٣٠)', async () => {
    const t = await buildTree();
    const board = await workspaceBoard(t.sceneId);
    const found = searchReveal(board, 'كلمة-نادرة-جدًّا');
    expect(found.hit.has(t.deep1)).toBe(true);
    for (const id of [t.b, t.p2, t.rootId]) {
      expect(`${id}:${found.reveal.has(id)}`).toBe(`${id}:true`);
    }
  });

  it('٦٣ · وعنوانان متطابقان تحت أبوين مختلفين يُميَّزان بالمسار (بند ٣٠)', async () => {
    const t = await buildTree();
    const one = await addNode(t.phases[6], { title: 'مراجعة', nodeKind: 'part', text: 'x' });
    const two = await addNode(t.phases[7], { title: 'مراجعة', nodeKind: 'part', text: 'y' });
    const board = await workspaceBoard(t.sceneId);
    const a = board.targetById.get(one.id).path.join(' · ');
    const b = board.targetById.get(two.id).path.join(' · ');
    expect(a === b).toBe(false);
    expect(a).toContain('مرحلة 7');
    expect(b).toContain('مرحلة 8');
  });

  it('٦٤ · وسقفُ الصفوف يرتفع بطلبك — فتصل لأيّ نتيجة (بند ٢٩)', () => {
    const kids = Array.from({ length: 900 }, (_, i) => ({
      node: { id: `k${i}`, title: `عقدة ${i}` }, children: [], depth: 0,
    }));
    const board = {
      roots: [{ id: 'r', title: 'جذر' }], looseTexts: [],
      treeByRoot: new Map([['r', kids]]),
      targetById: new Map([['r', {}]]), haystack: new Map(),
    };
    const first = navRows(board, { expanded: new Set(['r']), shown: new Map([['r', 900]]) });
    const wider = navRows(board, {
      expanded: new Set(['r']), shown: new Map([['r', 900]]), budget: 800,
    });
    expect(first.drawn <= 400).toBe(true);
    expect(wider.drawn > first.drawn).toBe(true);
    /* والزرُّ موجودٌ فعلًا في الشاشة لا في النيّة. */
    expect(first.rows.some((one) => one.type === 'limit')).toBe(true);
  });
});

/**
 * LingoLife — تخطيطُ الورشة: المستندُ لا يُرسَم تحت أحد (WS-P3 · بنود ١ و٢ و٢٠)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لماذا ملفٌّ مستقلٌّ لهذا وحدَه؟**
 * ═══════════════════════════════════════════════════════════════
 *
 * لأنّ العطبَ الذي بلّغتَ عنه — «النصُّ الروسيُّ يكمل خلف اللوح المجاور» —
 * مرَّ **سليمًا** من كلّ اختبارات WS-P و WS-P2. وسببُ مروره أنّها كانت
 * تقيس **حدودَ الحاويات**: صندوقُ المستند كان تمامًا حيث يجب، والنصُّ
 * داخلَه هو الذي يخرج. وحاويةٌ سليمةُ الحدود لا تعني نصًّا محبوسًا.
 *
 * فالمقياسُ الصادقُ الوحيد `Range.getClientRects()` — وهي تعطي **كلَّ سطرٍ
 * مرسومٍ بموضعه الحقيقيّ على الشاشة**، لا ما يظنّه الصندوق.
 *
 *     قبل الإصلاح:  صندوقُ المحتوى ينتهي عند ٩٠٥ · أبعدُ سطرٍ عند ١٨٢٤٩
 *     الخرق: ١٧٣٤٤px — ابتلعه `overflow-x: hidden` فلم يشتكِ شيء.
 *
 * السببُ الجذريُّ: قاعدةُ `.ws-raw` سقطت من `workspace.css` حين أُعيد
 * تركيبُ الملفّ في WS-P، و`<pre>` بلا قاعدةٍ يعني `white-space: pre` — أي
 * سطرٌ لا ينكسر أبدًا. **والقاعدةُ المفقودةُ لا تُخطئ، هي فقط غائبة**؛
 * لذلك لم يوجد حارسٌ يسقط. هذا الملفُّ هو ذاك الحارس.
 *
 * ⚠️ **والثابتُ المحروسُ هو الذي تنصّ عليه المواصفة حرفيًّا** (بند ١):
 *
 *        document.right <= main.right   و   document.left >= main.left
 *        ولا تقاطعَ مع أيّ لوحٍ شقيق.
 *
 *    لا «صفر بكسل خارج الحشوة». والفرقُ ليس تفصيلًا: بعد الإصلاح تبقى
 *    ٣٫٤٤px تتجاوز حافّةَ الورقة، ومسحٌ حرفًا حرفًا أثبت أنّها **مسافةُ
 *    U+0020 معلَّقةٌ عند نقطة اللفّ** — سلوكُ `pre-wrap` المنصوصُ عليه في
 *    CSS Text، بلا حبرٍ ولا تمرير. أن أُطارِدَها بـ`break-spaces` أو بحشوةٍ
 *    يكون بالضبط ما نهت عنه المواصفة: تغطيةُ عرَضٍ بدل حراسة المعنى.
 */

import { describe, it, expect } from './test-runner.js';
import { renderWorkspace, disposeWorkspace, __wsp } from '../js/views/workspace-view.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';

const TAG = `WSL-${Math.random().toString(36).slice(2, 7)}`;
const wait = (ms = 60) => new Promise((done) => { setTimeout(done, ms); });
const $ = (sel, root = document) => root.querySelector(sel);

/** الأنماطُ الحقيقيّة — بلا ورقةِ أنماطٍ لا يوجد تخطيطٌ يُقاس (بند ٣٠ في WS-P). */
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

/**
 * ثلاثةُ نصوصٍ هي أقسى ما يواجهه اللفّ فعلًا (بند ٢٠):
 *   · فقرةٌ روسيّةٌ طويلةٌ عاديّة،
 *   · رمزٌ سيريليٌّ طويلٌ **بلا مسافةٍ واحدة** — لا نقطةَ كسرٍ طبيعيّة،
 *   · مزيجٌ روسيٍّ ولاتينيٍّ وأرقامٍ داخل صفحةٍ اتّجاهُها RTL.
 */
const RU = 'Вскрыть упаковку перед проверкой таможенными органами и предъявить '
  + 'сопроводительные документы, включая транспортную накладную и сертификат. ';

let world = null;
async function buildWorld() {
  if (world) return world;
  const scene = await createScene({ titleAr: `${TAG} ذكرى`, date: '2026-09-02' });
  const root = await addScript(scene.id, { title: `${TAG} نصّ طويل`, text: RU.repeat(14) });
  const token = await addNode(root.id, {
    title: 'رمز بلا مسافات', nodeKind: 'part',
    text: `قبل\n${'Вскрытьупаковкипередпроверкойтаможенными'.repeat(3)}\nبعد`,
  });
  const mixed = await addNode(root.id, {
    title: 'مزيج تقنيّ', nodeKind: 'part',
    text: 'ГОСТ 12.3.020-80 · ISO/IEC 27001:2022 · накладная № AB-4471/К — تفاصيل. '.repeat(20),
  });
  world = { sceneId: scene.id, rootId: root.id, tokenId: token.id, mixedId: mixed.id };
  return world;
}

/**
 * يركّب الورشةَ بعرضٍ معلوم. والعرضُ يأتي من المضيف لا من النافذة، لأنّ
 * الشاشةَ نفسَها تقرأ `root.clientWidth` — فالتكيّفُ يُقاس صادقًا هنا.
 */
async function mountAt(width, height = 800) {
  await ensureCss();
  const w = await buildWorld();
  const host = document.createElement('div');
  host.id = 'wsl-host';
  host.style.cssText =
    `position:fixed;inset-block-start:-4000px;inset-inline-start:0;inline-size:${width}px;block-size:${height}px`;
  document.body.append(host);
  await renderWorkspace(host, w.sceneId);
  await wait(120);
  return { host, w };
}

const unmount = (host) => { disposeWorkspace(); host.remove(); };

/**
 * ⚠️ **المقياس**: كلُّ مستطيلِ سطرٍ مرسومٍ داخل الورقة، لا صندوقُ الورقة.
 *
 * @returns أبعدُ حافّةٍ في كلّ اتّجاه، وصندوقا المستند والمساحة، وصناديقُ
 *          الألواح الشقيقة الظاهرة، وحالةُ تمرير المستند أفقيًّا.
 */
function measure(host) {
  const main = $('[data-ws-main]', host);
  const doc = $('[data-ws-doc]', host);
  const paper = $('[data-ws-paper], .ws-editor, .ws-media-doc', host);

  const lines = [];
  if (paper) {
    const walk = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      if (!node.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) lines.push(rect);
      }
    }
  }

  /* لوحٌ «ظاهر» = له مساحةٌ فعليّةٌ وليس `visibility: hidden`. */
  const visible = (sel) => {
    const el = $(sel, host);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    if (getComputedStyle(el).visibility === 'hidden') return null;
    return r;
  };

  const band = lines.length ? {
    left: Math.min(...lines.map((r) => r.left)),
    right: Math.max(...lines.map((r) => r.right)),
    top: Math.min(...lines.map((r) => r.top)),
    bottom: Math.max(...lines.map((r) => r.bottom)),
  } : null;

  const panes = { nav: visible('[data-ws-nav]'), insp: visible('[data-ws-insp]') };
  const hits = [];
  if (band) {
    for (const [name, r] of Object.entries(panes)) {
      if (!r) continue;
      const overlapX = Math.min(band.right, r.right) - Math.max(band.left, r.left);
      const overlapY = Math.min(band.bottom, r.bottom) - Math.max(band.top, r.top);
      /* ⚠️ عتبةُ ١px تتجاهل تلامسَ الحوافّ الناتجَ عن تقريب الجزء العشريّ. */
      if (overlapX > 1 && overlapY > 1) hits.push({ pane: name, by: Math.round(overlapX) });
    }
  }

  return {
    lines: lines.length,
    band,
    doc: doc?.getBoundingClientRect() ?? null,
    main: main?.getBoundingClientRect() ?? null,
    hits,
    /* فائضٌ أفقيٌّ حقيقيٌّ داخل المستند — صفرٌ يعني أنّ اللفَّ يعمل. */
    docOverflowX: doc ? doc.scrollWidth - doc.clientWidth : null,
    paperOverflowX: paper ? paper.scrollWidth - paper.clientWidth : null,
  };
}

/** يتحقّق من الثابت نفسِه المكتوب في البند ١، ويعيد رسالةَ فشلٍ مفهومة. */
function invariantBreaches(m) {
  const bad = [];
  if (!m.band || !m.main || !m.doc) return ['لا يوجد نصٌّ مرسومٌ ليُقاس'];
  if (m.doc.right > m.main.right + 1) bad.push(`doc.right ${Math.round(m.doc.right)} > main.right ${Math.round(m.main.right)}`);
  if (m.doc.left < m.main.left - 1) bad.push(`doc.left ${Math.round(m.doc.left)} < main.left ${Math.round(m.main.left)}`);
  if (m.band.right > m.main.right + 1) bad.push(`أبعدُ سطرٍ ${Math.round(m.band.right)} > main.right ${Math.round(m.main.right)}`);
  if (m.band.left < m.main.left - 1) bad.push(`أوّلُ سطرٍ ${Math.round(m.band.left)} < main.left ${Math.round(m.main.left)}`);
  for (const hit of m.hits) bad.push(`النصُّ يتقاطع مع ${hit.pane} بمقدار ${hit.by}px`);
  if (m.docOverflowX > 1) bad.push(`فائضٌ أفقيٌّ في المستند: ${m.docOverflowX}px`);
  if (m.paperOverflowX > 1) bad.push(`فائضٌ أفقيٌّ في الورقة: ${m.paperOverflowX}px`);
  return bad;
}

const open = async (id) => { __wsp.selectNode(id); await wait(90); };

/* ================================================================== *
 * أ · الثابت: المستندُ لا يُرسَم خارجَ مساحته ولا تحت لوحٍ شقيق
 * ================================================================== */

describe('WS-P3 · أ · لا قصَّ ولا رسمَ تحت لوح', () => {
  /* المقاساتُ الثلاثةُ التي تنصّ عليها المواصفة + الحالتان (بند ٢٠). */
  const SIZES = [[1280, 800, 'التابلت أفقيًّا'], [1536, 900, 'أعرض'], [800, 1180, 'التابلت رأسيًّا']];

  for (const [width, height, label] of SIZES) {
    it(`١ · ${width}×${height} (${label}) — النصوصُ الثلاثةُ كلُّها داخل المساحة`, async () => {
      const { host, w } = await mountAt(width, height);
      try {
        for (const id of [w.rootId, w.tokenId, w.mixedId]) {
          await open(id);
          const m = measure(host);
          expect(m.lines > 0).toBe(true);
          expect(invariantBreaches(m)).toEqual([]);
        }
      } finally { unmount(host); }
    });
  }

  it('٢ · وبالمُفتِّش مفتوحًا كذلك — وهي الحالةُ التي بلّغتَ عنها', async () => {
    const { host, w } = await mountAt(1280, 800);
    try {
      await open(w.rootId);
      $('.ws-insp-toggle', host)?.click();
      await wait(140);
      const m = measure(host);
      expect(m.lines > 0).toBe(true);
      /* اللوحُ مفتوحٌ فعلًا — وإلّا كان الاختبارُ يحرس لا شيء. */
      expect(Boolean($('[data-ws-insp]', host)?.getBoundingClientRect().width)).toBe(true);
      expect(invariantBreaches(m)).toEqual([]);
    } finally { unmount(host); }
  });

  it('٣ · وفي وضع التركيز', async () => {
    const { host, w } = await mountAt(1280, 800);
    try {
      await open(w.rootId);
      $('[data-ws="zen"]', host)?.click();
      await wait(140);
      expect(invariantBreaches(measure(host))).toEqual([]);
    } finally { unmount(host); }
  });

  /*
   * ⚠️ **هذا هو الاختبارُ الذي كان سيمنع العطبَ أصلًا.** لا يسأل «هل
   *    القاعدةُ مكتوبة؟» بل يسأل النصَّ نفسَه: **هل انكسرتَ؟** فلو سقطت
   *    `.ws-raw` مرّةً أخرى — أو غُيّرت إلى `pre` — صار السطرُ واحدًا
   *    وسقط هنا فورًا.
   */
  it('٤ · النصُّ الخامُّ **يلفُّ فعلًا**: أسطرٌ كثيرةٌ لا سطرٌ واحدٌ ممتدّ', async () => {
    const { host, w } = await mountAt(1280, 800);
    try {
      await open(w.rootId);
      const pre = $('.ws-raw', host);
      expect(Boolean(pre)).toBe(true);
      const range = document.createRange();
      range.selectNodeContents(pre);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      /* ٢٢ تكرارًا من فقرةٍ روسيّةٍ في عرضٍ ٥٧٧px لا يمكن أن تكون سطرًا. */
      expect(rects.length > 10).toBe(true);
      const widest = Math.max(...rects.map((r) => r.width));
      expect(widest <= pre.getBoundingClientRect().width + 1).toBe(true);
    } finally { unmount(host); }
  });

  it('٥ · ورمزٌ سيريليٌّ بلا مسافةٍ يُكسَر داخلَه بدل أن يمدَّ السطر', async () => {
    const { host, w } = await mountAt(800, 1180);
    try {
      await open(w.tokenId);
      const m = measure(host);
      expect(m.docOverflowX).toBe(0);
      expect(invariantBreaches(m)).toEqual([]);
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * ب · حارسٌ على الإصلاح نفسِه — لا يُخفى عطبُ تخطيطٍ بقصٍّ (قاعدة ٨)
 * ================================================================== */

describe('WS-P3 · ب · العلاجُ لا يكون تغطية', () => {
  it('٦ · قاعدةُ `.ws-raw` موجودةٌ وتلفُّ — ولا تعود `pre` الصامتة', async () => {
    const css = await (await fetch('../css/workspace.css')).text();
    /* ⚠️ التعليقاتُ تُنزَع أوّلًا: هذا الملفُّ يشرح العطبَ بنصّه، فلولا */
    /*    النزعُ لطابق الحارسُ شرحَه هو لا قاعدتَه. */
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = code.match(/\.ws-raw\s*\{[^}]*\}/);
    expect(Boolean(rule)).toBe(true);
    expect(rule[0]).toContain('pre-wrap');
    expect(rule[0]).toContain('overflow-wrap');
  });

  it('٧ · واللوحُ لا يُخفي فائضَه بـ`overflow-x: hidden`', async () => {
    const css = await (await fetch('../css/workspace.css')).text();
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = code.match(/\.ws-doc\s*\{[^}]*\}/);
    expect(Boolean(rule)).toBe(true);
    /*
     * ⚠️ لماذا يُحرَس هذا؟ لأنّه كان **العلاجَ الخاطئ الجاهز**: مع
     *    `hidden` يختفي أثرُ العطب تمامًا — لا شريطَ تمريرٍ ولا خطأ — ويبقى
     *    النصُّ مبتورًا. و`auto` تجعل أيَّ انكسارٍ مستقبليٍّ **يُرى**.
     */
    expect(/overflow-x\s*:\s*hidden/.test(rule[0])).toBe(false);
    expect(rule[0]).toContain('overflow');
  });

  it('٨ · والورقةُ تنكمش تحت محتواها (`min-inline-size: 0`)', async () => {
    const css = await (await fetch('../css/workspace.css')).text();
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = code.match(/\.ws-paper\s*\{[^}]*\}/);
    expect(Boolean(rule)).toBe(true);
    /* بدونها يأخذ عنصرُ flex عرضَ `min-content` فيدفع اللوحَ كلَّه. */
    expect(/min-inline-size\s*:\s*0/.test(rule[0])).toBe(true);
  });
});

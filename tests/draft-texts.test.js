/**
 * LingoLife — المسودّةُ في صفحة النصوص (WS-DR · بنود ١٤ إلى ٢٣ و٣٥)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ الحلقةُ التي كانت ناقصة
 * ═══════════════════════════════════════════════════════════════
 *
 * بلاغُك: «المسودّةُ المحفوظة يجب ألّا تكون مخبوءةً خلف "اتدرب على
 * المسودة" وحدَه. أريد أن أفتح النصَّ الأصليّ، وأرى أنّ له مسودّة،
 * وأفتحها، وأقرأ محتواها، وأعود».
 *
 * وكانت المسودّةُ تُكتَب في لوحة الظلّ وتُقرأ من هناك وحدَها — ولا
 * سبيلَ إليها من صفحة المحتوى إطلاقًا.
 *
 * ⚠️ **والخطرُ في هذه التمريرة كان أن تُنسَخ** (بند ١٥): أرخصُ طريقٍ
 *    لإظهارها في الشجرة أن نصنع لها `scripts` صفًّا. فيصير لها سجلّان،
 *    وتُعَدُّ مصدرًا أصيلًا وهي مادّةٌ مشتقّة. ولذلك يحرس الاختبارُ ٧
 *    عددَ السجلّات نفسَه لا الشاشةَ وحدَها.
 */

import { describe, it, expect } from './test-runner.js';
import { renderWorkspace, disposeWorkspace, __wsp } from '../js/views/workspace-view.js';
import { workspaceBoard } from '../js/services/workspace/workspace-service.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';
import { openDraft, saveDraftText, SUBJECT } from '../js/services/study-draft.js';
import { scripts, studyDrafts } from '../js/db/repositories.js';
import { STATE } from '../js/db/schema.js';

const TAG = `DRT-${Math.random().toString(36).slice(2, 7)}`;
const wait = (ms = 90) => new Promise((done) => { setTimeout(done, ms); });
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const RU = 'Та́кже мы обсуди́ли, что докуме́нты должны́ быть предста́влены зара́нее.';
const DRAFT_TEXT = [
  'مسودة — Core Chunks', '',
  'الجملة الأساسية:', '', RU, '', 'كذلك ناقشنا أن المستندات يجب أن تُقدَّم مسبقًا.', '',
  '━━━━━━━━━━━━━━', '',
  'содержа́ть', '', 'يحتوي على / يتضمن', '',
  'الإحساس:', '', 'ليس معرفة شيء جديد، بل إزالة عدم الوضوح.', '',
  'القالب:', '', 'должен / должны́ + быть + اسم مفعول', '',
  'أسئلة الاسترجاع:', '', 'أريد توضيح التفاصيل.', '', 'Я хочу́ уточни́ть де́тали.',
].join('\n');

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
  const scene = await createScene({ titleAr: `${TAG} اجتماع`, date: '2026-09-04' });
  const root = await addScript(scene.id, {
    title: `${TAG} محضر`,
    text: `Нача́ло встре́чи.\n\n${RU}`,
  });
  const part = await addNode(root.id, { title: `${TAG} جزء`, nodeKind: 'part', text: 'متن' });
  const draft = await openDraft(SUBJECT.SENTENCE, RU, { sceneId: scene.id });
  await saveDraftText(draft.id, DRAFT_TEXT);
  world = { sceneId: scene.id, rootId: root.id, partId: part.id, draftId: draft.id };
  return world;
}

async function mount() {
  await ensureCss();
  const w = await buildWorld();
  const host = document.createElement('div');
  host.id = 'drt-host';
  host.style.cssText = 'position:fixed;inset-block-start:-4000px;inline-size:1280px;block-size:800px';
  document.body.append(host);
  await renderWorkspace(host, w.sceneId);
  await wait(120);
  return { host, w };
}

const unmount = (host) => { disposeWorkspace(); host.remove(); };
const crumbs = (host) => $$('.ws-crumbs .ws-crumb', host).map((e) => e.textContent.trim());

/* ================================================================== *
 * أ · المسودّةُ تُرى وتُفتَح وتُقرأ (بنود ١٤ و١٧ و١٨ و٣٥)
 * ================================================================== */

describe('WS-DR · و · المسودّة في صفحة النصوص', () => {
  it('١ · اللوحةُ تعرف مسودّاتِ العقدة — بلا حقلٍ جديدٍ في المخطَّط', async () => {
    const w = await buildWorld();
    const board = await workspaceBoard(w.sceneId);
    /* النسبةُ محسوبةٌ من مفتاح الموضوع: جملةٌ داخل نصّ العقدة. */
    const here = board.draftsOf.get(w.rootId) || [];
    expect(here.map((one) => one.id)).toContain(w.draftId);
    expect(Boolean(board.draftById.get(w.draftId))).toBe(true);
  });

  it('٢ · والشجرةُ تقول إنّ للعقدة مسودّة (بند ١٦)', async () => {
    const { host, w } = await mount();
    try {
      const row = $(`[data-ws="nav-node"][data-id="${w.rootId}"]`, host)?.closest('.ws-nav-row');
      expect(Boolean(row?.querySelector('.ws-nav-draft'))).toBe(true);
      expect(row.querySelector('.ws-nav-draft').textContent).toContain('1');
      /* وعقدةٌ بلا مسودّةٍ لا تحمل شارة. */
      const bare = $(`[data-ws="nav-node"][data-id="${w.partId}"]`, host)?.closest('.ws-nav-row');
      expect(Boolean(bare?.querySelector('.ws-nav-draft'))).toBe(false);
    } finally { unmount(host); }
  });

  it('٣ · وفتحُ النصّ الأصليّ يُظهر بابَ المسودّة تحته', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      const rows = $$('.ws-drafts .ws-item', host);
      expect(rows).toHaveLength(1);
      expect($('.ws-drafts [data-ws="open-draft"]', host).dataset.id).toBe(w.draftId);
    } finally { unmount(host); }
  });

  /* ⚠️ **المحتوى الحقيقيّ لا «المسودّة موجودة»** (بند ١٧). */
  it('٤ · وفتحُها يعرض محتواها المُهيكَل لا بياناتٍ عنها', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);

      /* أقسامٌ بعناوينها. */
      const heads = $$('.ws-draft-head', host).map((e) => e.textContent.trim());
      expect(heads).toContain('الإحساس:');
      expect(heads).toContain('القالب:');
      /* ومقاطعُ بترجماتها. */
      const ru = $$('.ws-draft-ru', host).map((e) => e.textContent.trim());
      expect(ru).toContain('содержа́ть');
      /* وشرحٌ يُقرأ نثرًا لا زوجًا ناقصًا. */
      expect($$('.ws-draft-note', host)).toHaveLength(1);
      /* وقالبٌ نحويّ. */
      expect($$('.ws-draft-tpl', host)).toHaveLength(1);
      /* وسؤالُ استرجاعٍ معكوسُ الاتّجاه. */
      expect($$('.ws-draft-unit.is-recall', host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('٥ · والبدائلُ تُرى في القراءة (بند ٨)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);
      const alts = $$('.ws-draft-alts', host).map((e) => e.textContent.trim());
      expect(alts).toContain('يتضمن');
    } finally { unmount(host); }
  });

  /* ⚠️ نفسُ عهد WS-P3: المسودّةُ حالةٌ فرعيّةٌ لا مصدرٌ آخر. */
  it('٦ · والنسبةُ إلى الأصل ظاهرةٌ في المسار، والتحديدُ باقٍ (بندا ١٦ و٢٢)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);
      const path = crumbs(host);
      expect(path.some((one) => one.includes('محضر'))).toBe(true);
      expect(path[path.length - 1]).toBe('مسودّة');
      /* والمتصفِّحُ ما زال على العقدة — لم يضِع مكانك. */
      expect(__wsp.state.node).toBe(w.rootId);
      expect($$('.ws-nav-row.is-on', host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('٧ · ⚠️ ولا سجلَّ جديدٌ ولا مصدرٌ مزيّف (بند ١٥)', async () => {
    const { host, w } = await mount();
    try {
      const before = (await scripts.getAll()).filter((r) => r.state === STATE.ACTIVE).length;
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);

      const after = (await scripts.getAll()).filter((r) => r.state === STATE.ACTIVE).length;
      expect(after).toBe(before);
      /* والمسودّةُ صفٌّ واحدٌ كما كانت. */
      const rows = (await studyDrafts.getAll())
        .filter((r) => r.state === STATE.ACTIVE && r.id === w.draftId);
      expect(rows).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('٨ · والنصُّ الأصليُّ لا يُمَسّ (بند ٢٨)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);
      const root = await scripts.get(w.rootId);
      expect(root.text.includes(RU)).toBe(true);
      /* ولم يُستبدَل بمحتوى المسودّة. */
      expect(root.text.includes('الإحساس:')).toBe(false);
    } finally { unmount(host); }
  });

  it('٩ · والعودةُ للأصل لمسةٌ واحدةٌ تُرجع النصّ (بندا ١٩ و٢٠)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);
      expect(__wsp.state.open.kind).toBe('draft');

      $('[data-ws="draft-back"]', host).click();
      await wait(160);
      expect(__wsp.state.open.kind).toBe('text');
      expect(__wsp.state.open.id).toBe(w.rootId);
      /* والنصُّ ظاهرٌ من جديد، والمسودّةُ ما زالت مرئيّةً تحته. */
      expect(Boolean($('[data-ws-paper] .ws-raw', host))).toBe(true);
      expect($$('.ws-drafts .ws-item', host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  /* ⚠️ **مدخلٌ للبابِ القائم لا بابٌ جديد** (بند ٢١). */
  it('١٠ · و«اتدرب على المسودة» متاحٌ من سطح القراءة', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);
      const btn = $('[data-ws="draft-practice"]', host);
      expect(Boolean(btn)).toBe(true);
      expect(btn.textContent.trim()).toBe('اتدرب على المسودة');
      expect(btn.dataset.id).toBe(w.draftId);
    } finally { unmount(host); }
  });

  it('١١ · وسطحُ القراءة ليس شاشةَ مراجعة (بند ١٨)', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);
      /* لا مربّعاتِ اختيارٍ ولا أزرارَ ربطٍ وفكّ — تلك مهمّةُ الاستيراد. */
      expect($$('[data-pr-use]', host)).toHaveLength(0);
      expect($$('[data-pr-attach]', host)).toHaveLength(0);
      expect($$('[data-pr-detach]', host)).toHaveLength(0);
      /* ولا وضعَ «ربط» على مادّةٍ مشتقّة. */
      expect($$('[data-ws="mode"]', host)).toHaveLength(1);
    } finally { unmount(host); }
  });

  it('١٢ · وأرقامُ الترويسة محسوبةٌ من الوحدات لا مكتوبة', async () => {
    const { host, w } = await mount();
    try {
      __wsp.selectNode(w.rootId);
      await wait(140);
      $('.ws-drafts [data-ws="open-draft"]', host).click();
      await wait(160);
      const facts = $('.ws-doc-facts', host).textContent;
      expect(facts).toContain('مادّة مذاكرة مشتقّة');
      const board = await workspaceBoard(w.sceneId);
      const { draftPairs } = await import('../js/services/study-draft.js');
      const units = draftPairs(board.draftById.get(w.draftId));
      expect(facts).toContain(`${units.length} وحدة`);
    } finally { unmount(host); }
  });
});

/* ================================================================== *
 * ز · إعادةُ القراءة لا تهدم تصحيحاتك (بند ٤٠)
 * ================================================================== */

describe('WS-DR · ز · إعادةُ القراءة الآمنة', () => {
  it('١٣ · تُعيد التصحيحَ اليدويَّ بمطابقة النصّ لا بالفهرس', async () => {
    const { reparseDraft } = await import('../js/services/study-draft.js');
    const draft = {
      text: DRAFT_TEXT,
      pairs: [
        { ru: 'содержа́ть', ar: 'ترجمة أصلحتُها بيدي', status: 'paired_strong', manual: true },
        { ru: 'Я хочу́ уточни́ть де́тали.', ar: 'أريد توضيح التفاصيل.', status: 'recall', primary: 0 },
      ],
    };
    const { units, kept, lost } = reparseDraft(draft);
    expect(kept).toBe(1);
    expect(lost).toBe(0);
    const fixed = units.find((one) => one.ru === 'содержа́ть');
    expect(fixed.ar).toBe('ترجمة أصلحتُها بيدي');
    expect(fixed.manual).toBe(true);
  });

  it('١٤ · وتصحيحٌ لنصٍّ لم يعُد موجودًا يُعَدُّ مفقودًا صراحةً', async () => {
    const { reparseDraft } = await import('../js/services/study-draft.js');
    const { lost } = reparseDraft({
      text: DRAFT_TEXT,
      pairs: [{ ru: 'كلمة اختفت', ar: 'ترجمتها', status: 'paired_strong', manual: true }],
    });
    expect(lost).toBe(1);
  });

  it('١٥ · والحفظُ لا يُسقط دورَ الوحدة', async () => {
    const { saveDraftPairs, draftPairs } = await import('../js/services/study-draft.js');
    const w = await buildWorld();
    const before = draftPairs({ text: DRAFT_TEXT });
    await saveDraftPairs(w.draftId, before);
    const row = await studyDrafts.get(w.draftId);
    /*
     * ⚠️ كانت `saveDraftPairs` تُسقط كلَّ حقلٍ عدا `ru/ar/status/manual`،
     *    فيعود «الشرح» و«العنوان» بلا هُويّةٍ بعد أوّل حفظ — ويرجع
     *    الإنذارُ الكاذبُ من باب الحفظ لا من باب التحليل.
     */
    const note = row.pairs.find((one) => one.status === 'note');
    expect(Boolean(note)).toBe(true);
    expect(Boolean(note.section)).toBe(true);
    const tpl = row.pairs.find((one) => one.status === 'template');
    expect(Boolean(tpl.raw)).toBe(true);
    /* وإعادةُ القراءة من المحفوظ تعطي نفسَ الأدوار. */
    expect(draftPairs(row).filter((one) => one.status === 'note')).toHaveLength(1);
    /* ونصُّ المسودّة لم يُمَسّ (بند ٣٩). */
    expect(row.text).toBe(DRAFT_TEXT);
  });

  it('١٦ · واختيارُ الترجمة الأساسيّة يُحفَظ ولا يحذف البدائل (بند ٣٨)', async () => {
    const { saveDraftPairs, choosePrimary, pairTranslation } = await import('../js/services/study-draft.js');
    const w = await buildWorld();
    const units = choosePrimary(
      [{ ru: 'подтвержде́ние', ar: 'إثبات / تأكيد', status: 'paired_strong' }], 0, 1,
    );
    expect(pairTranslation(units[0]).primary).toBe('تأكيد');
    expect(pairTranslation(units[0]).alts).toEqual(['إثبات']);

    await saveDraftPairs(w.draftId, units);
    const row = await studyDrafts.get(w.draftId);
    expect(row.pairs[0].primary).toBe(1);
    /* والنصُّ المخزَّنُ ما زال يحمل البديلين — لا هجرةَ ولا حذف. */
    expect(row.pairs[0].ar).toBe('إثبات / تأكيد');
  });
});

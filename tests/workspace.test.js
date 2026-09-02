/**
 * LingoLife — ورشةُ المحتوى الموحَّدة (WS-F)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما تحرسه — وما لا يكفي
 * ═══════════════════════════════════════════════════════════════
 *
 * البندُ ١٢٦ صريح: لا يكفي أن توجد شجرةٌ وأن يكون للبطاقات أزرارُ
 * تشغيل. فالمحروسُ هنا **سلوكُ النموذج** لا نصُّ الشاشة:
 *
 *  · نحوُ العناوين: النثرُ لا يصير عنوانًا، والمجهولُ لا يُخمَّن،
 *    ولا حرفَ من المدخل يضيع.
 *  · المتحدّثون: دورٌ متعدّدُ الفقرات كتلةٌ واحدة، ولا عقدةَ شجرةٍ
 *    تُخلَق من «Speaker 1»، والقائمةُ المرقّمة ليست محادثة.
 *  · مصدرُ حقيقةٍ واحد: لا مخزنَ ثانٍ، ولا نموذجَ وسائطَ موازٍ.
 *  · العمقُ حرٌّ: «سكريبت ← جزء ← جولة» تُقرَأ بلا اشتراط «رحلة».
 *  · المراجعةُ قبل الالتزام: بابُ اللصق **لا يملك** أن يكتب.
 */

import { describe, it, expect } from './test-runner.js';
import {
  parsePaste, headingOf, looksLikeHeading, nestProposal, MARKERS,
} from '../js/services/workspace/paste-parser.js';
import {
  parseDialogue, speakerAt, looksLikeDialogue, speakersIn, dialogueAccounting,
  dirOf, conversationModel,
} from '../js/services/workspace/speaker-parser.js';
import {
  workspaceBoard, pathLabel, addLooseText, placeTextUnder, detachToLoose,
  commitPaste, conflictsFor, addTextAt, ITEM,
  linkSelection, unlinkOne, destinationsOf,
} from '../js/services/workspace/workspace-service.js';
import { createScene } from '../js/services/scene-service.js';
import { addScript } from '../js/services/content-service.js';
import { addNode } from '../js/services/organize-service.js';
import { scripts } from '../js/db/repositories.js';

const TAG = `WSF-${Math.random().toString(36).slice(2, 7)}`;
const codeOnly = (src) => src.split('\n')
  .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line)).join('\n');

/* ================================================================== *
 * نحوُ العناوين — حسابٌ خالص
 * ================================================================== */

describe('WS-F · نحوُ اللصق المنظَّم', () => {
  it('١ · الصيغُ المعروفة تُقرأ بمستوياتها (بندا ٢٨ و٢٩)', () => {
    expect(headingOf('PHASE 1 — المفردات').level).toBe(1);
    expect(headingOf('VERSION 2 — الروسية').level).toBe(2);
    expect(headingOf('PART 15 — الجمارك').level).toBe(3);
    expect(headingOf('ROUND 3').level).toBe(4);
    /* ⚠️ ولاحقةُ الحرف مقصودة: مراحلُك تحمل «1B» فعلًا. */
    expect(headingOf('PHASE 1B — تركيب المقاطع').number).toBe('1B');
  });

  it('٢ · والعربيّةُ والأرقامُ العربيّة كذلك', () => {
    expect(headingOf('مرحلة ١ — التغليف').level).toBe(1);
    expect(headingOf('جزء ٧ — الرطوبة').level).toBe(3);
    expect(headingOf('جزء ٧ — الرطوبة').number).toBe('7');
  });

  it('٣ · ⚠️ والعنوانُ هو السطرُ كما كتبتَه لا ما بعد الشرطة (بند ٢٨)', () => {
    expect(headingOf('PART 1 — التغليف والحماية').title).toBe('PART 1 — التغليف والحماية');
    expect(headingOf('## PART 1 — التغليف').title).toBe('PART 1 — التغليف');
  });

  it('٤ · ⚠️ والنثرُ لا يصير عنوانًا مهما بدأ بكلمةٍ ورقم', () => {
    /*
     * هذا الحارسُ وُلد من صياغةٍ أولى قبلت أيَّ «كلمة رقم بقيّة».
     * وبلا حدٍّ للكلمات كانت فقرةٌ تبدأ بـ«PART 1 is where…» تصير
     * عقدةً، فتتفتّت الرحلةُ إلى عناوينَ كاذبةٍ لا تُراجَع.
     */
    expect(headingOf('PART 1 is where we begin the whole story')).toBe(null);
    expect(headingOf('جزء ٣ من الشحنة وصل متأخّرًا وسبب ذلك التأخير')).toBe(null);
    /* والقصيرُ بفاصلٍ صريحٍ يمرّ. */
    expect(headingOf('PART 1 — التغليف') === null).toBe(false);
    /* وبلا فاصلٍ يمرّ إن كان قصيرًا. */
    expect(headingOf('PART 1 التغليف والحماية') === null).toBe(false);
  });

  it('٥ · وبلا رقمٍ فليس عنوانًا — الرقمُ شرطٌ لا زينة', () => {
    expect(headingOf('PART')).toBe(null);
    expect(headingOf('PHASE — المفردات')).toBe(null);
  });

  it('٦ · ⚠️ والمجهولُ يُعرَض ولا يُرقَّى تلقائيًّا (بند ٣٠)', () => {
    expect(looksLikeHeading('SOME STRANGE HEADING')).toBe(true);
    expect(looksLikeHeading('## عنوان ماركداون')).toBe(true);
    expect(looksLikeHeading('دي جملة عادية خالص فيها كلام كتير.')).toBe(false);

    const out = parsePaste('PHASE 1 — أ\nSTRANGE ONE\nنصّ');
    expect(out.unknown).toHaveLength(1);
    /* ولا عقدةَ له بلا إذنك — النصُّ يبقى نصًّا. */
    expect(out.counts.nodes).toBe(1);
  });
});

describe('WS-F · هيكلُ اللصق', () => {
  it('٧ · «مرحلة ← جزء» تشتغل بلا نسخةٍ بينهما (بند ٢٩)', () => {
    const out = parsePaste('PHASE 1 — أ\nPART 1 — ب\nنصّ\nPART 2 — ج\nنصّ');
    expect(out.counts.depth).toBe(2);
    expect(out.nodes[1].parentId).toBe(out.nodes[0].id);
    expect(out.nodes[2].parentId).toBe(out.nodes[0].id);
  });

  it('٨ · و«مرحلة ← نسخة ← جزء» كذلك (بند ٢٩)', () => {
    const out = parsePaste('PHASE 2\nVERSION 1\nPART 1\nنصّ\nVERSION 2\nPART 1\nنصّ');
    expect(out.counts.depth).toBe(3);
    const versions = out.nodes.filter((n) => n.marker === 'VERSION');
    expect(versions).toHaveLength(2);
    /* ⚠️ ولا تُسطَّح النسخُ تحت المرحلة (بند ٩٦). */
    expect(versions.every((v) => v.parentId === out.nodes[0].id)).toBe(true);
    const parts = out.nodes.filter((n) => n.marker === 'PART');
    expect(parts[0].parentId).toBe(versions[0].id);
    expect(parts[1].parentId).toBe(versions[1].id);
  });

  it('٩ · و«مرحلة ← جزء ← جولة» كذلك', () => {
    const out = parsePaste('PHASE 1\nPART 1\nنصّ\nROUND 1\nنصّ');
    expect(out.counts.depth).toBe(3);
  });

  it('١٠ · ⚠️ ولا حرفَ من المدخل يضيع (بند ٩٣)', () => {
    const text = 'تمهيد قبل أيّ عنوان.\nPHASE 1 — أ\nسطر ١\n\nسطر ٢\nPART 1 — ب\nسطر ٣';
    const out = parsePaste(text);
    expect(out.accounting.unassigned).toBe(0);
    expect(out.accounting.lines).toBe(
      out.accounting.headingLines + out.accounting.textLines + out.accounting.preambleLines
    );
    /* والتمهيدُ يُعرَض تمهيدًا لا يُبتلَع. */
    expect(out.preamble).toBe('تمهيد قبل أيّ عنوان.');
    expect(out.nodes[0].text).toContain('سطر ١');
    expect(out.nodes[0].text).toContain('سطر ٢');
    expect(out.nodes[1].text).toBe('سطر ٣');
  });

  it('١١ · وتكرارُ العنوان يُبلَّغ ولا يُدمَج (بند ٦٧)', () => {
    const out = parsePaste('PHASE 1\nPART 1 — أ\nنصّ\nPART 1 — أ\nنصّ تاني');
    expect(out.duplicates).toHaveLength(1);
    /* ⚠️ وعقدتان لا واحدة — الاسمُ وصفٌ لا هُويّة. */
    expect(out.nodes.filter((n) => n.title === 'PART 1 — أ')).toHaveLength(2);
  });

  it('١٢ · ⚠️ وبلا عناوينَ يُبلَّغ الفشلُ ويبقى الخام (بند ١١٨)', () => {
    const out = parsePaste('مجرّد نصّ\nبلا أيّ عنوان\nخالص');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no-headings');
    expect(out.raw).toContain('مجرّد نصّ');
  });

  it('١٣ · وقراراتُ المراجعة تُعيد اشتقاقَ الشجرة (بند ٣٢)', () => {
    const text = 'PHASE 1 — أ\nPART 1 — ب\nنصّ\nSTRANGE\nتابع';
    /* ترقيةُ مجهول */
    const up = parsePaste(text, { levels: { 3: 3 } });
    expect(up.counts.nodes).toBe(3);
    /* خفضُ معلومٍ إلى نصّ */
    const down = parsePaste(text, { demote: [1] });
    expect(down.counts.nodes).toBe(1);
    expect(down.nodes[0].text).toContain('PART 1 — ب');
    /* إعادةُ تسمية */
    const named = parsePaste(text, { renames: { 1: 'اسم جديد' } });
    expect(named.nodes[1].title).toBe('اسم جديد');
  });

  it('١٤ · ⚠️ وإزاحةُ المستوى تُزيح النوعَ معه', () => {
    /*
     * أوّلُ صياغةٍ أبقت النوعَ من الكلمة المكتوبة، فعقدةٌ نقلتَها إلى
     * مستوى «نسخة» كانت تُخزَّن `part`: عمقٌ في الشجرة ونوعٌ يكذّبه.
     */
    const out = parsePaste('PHASE 1\nPART 1\nنصّ', { levels: { 1: 2 } });
    expect(out.nodes[1].kind).toBe('version');
    expect(out.nodes[1].marker).toBe('VERSION');
  });

  it('١٥ · والتعشيشُ مشتقٌّ لا مخزَّن', () => {
    const out = parsePaste('PHASE 1\nPART 1\nنصّ\nPART 2\nنصّ');
    const tree = nestProposal(out.nodes);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
  });

  it('١٦ · وسُلَّمُ المستويات موثَّقٌ ومرتَّب (بند ٢٩)', () => {
    const levels = MARKERS.map((row) => row.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(MARKERS[0].marker).toBe('PHASE');
  });
});

/* ================================================================== *
 * المتحدّثون
 * ================================================================== */

describe('WS-F · محلّلُ المتحدّثين', () => {
  it('١٧ · ⚠️ الدَّورُ يمتدّ حتى المتحدّث التالي مهما تعدّدت فقراتُه (بند ٣٩)', () => {
    const text = [
      'Speaker 1: نبدأ...', '',
      'Упаковка يعني التغليف.', 'Защитная يعني حماية.', '',
      'فـ«الحماية» هنا صفة.', '',
      'Speaker 2: تمام.',
    ].join('\n');

    const turns = parseDialogue(text);
    expect(turns).toHaveLength(2);
    expect(turns[0].speaker).toBe('1');
    /* كلُّ الفقرات في دورٍ واحد — لا سطرٌ = دور. */
    expect(turns[0].text).toContain('Упаковка');
    expect(turns[0].text).toContain('فـ«الحماية» هنا صفة.');
    expect(turns[1].speaker).toBe('2');
  });

  it('١٨ · ⚠️ ولا يُخترَع راوٍ لِما قبل أوّلِ علامة (بند ٤٠)', () => {
    const turns = parseDialogue('مقدّمة بلا متحدّث.\nSpeaker 1: أهلًا.');
    expect(turns[0].speaker).toBe(null);
    expect(turns[0].text).toBe('مقدّمة بلا متحدّث.');
    /* ولا اسمَ مخترَعٌ في أيّ دور. */
    expect(turns.some((t) => t.speaker === 'narrator')).toBe(false);
  });

  it('١٩ · ⚠️ والقائمةُ المرقّمة ليست محادثة', () => {
    /*
     * صياغةٌ أولى قبلت «1:» و«2:» متحدّثَين، فكان:
     *     1: افتح الكرتونة
     *     2: افحص السيليكاجيل
     * يُرسَم «محادثةً» — زخرفةٌ فوق معنًى غير موجود.
     */
    expect(looksLikeDialogue('1: افتح الكرتونة\n2: افحص السيليكاجيل')).toBe(false);
    expect(speakerAt('1: افتح الكرتونة')).toBe(null);
    /* والصيغُ الصريحةُ تمرّ. */
    expect(speakerAt('Speaker 2: تمام').speaker).toBe('2');
    expect(speakerAt('المتحدث ١: أهلًا').speaker).toBe('1');
    expect(speakerAt('A: hello').speaker).toBe('1');
  });

  it('٢٠ · ومتحدّثٌ واحدٌ ليس محادثة', () => {
    expect(looksLikeDialogue('Speaker 1: شرح طويل بلا ردّ.')).toBe(false);
    expect(looksLikeDialogue('Speaker 1: أ\nSpeaker 2: ب')).toBe(true);
  });

  it('٢١ · ⚠️ ولا يضيع حرفٌ في الرسم (بند ٤١)', () => {
    const text = 'Speaker 1: أ\n\nب\nج\n\nSpeaker 2: د';
    const audit = dialogueAccounting(text);
    expect(audit.keptChars).toBe(audit.sourceChars);
    expect(audit.markers).toBe(2);
    expect(speakersIn(text)).toEqual(['1', '2']);
  });

  it('٢٢ · ⚠️ والمتحدّثون لا يصيرون عُقَدَ شجرة (بندا ٦٨ و٦٩)', () => {
    const out = parsePaste([
      'PART 1 — التغليف',
      'Speaker 1: أ', '', 'تابع', '',
      'Speaker 2: ب',
      'PART 2 — الفحص',
      'Speaker 1: ج',
    ].join('\n'));

    expect(out.counts.nodes).toBe(2);
    expect(out.nodes.some((n) => /speaker/i.test(n.title))).toBe(false);
    /* وأدوارُ الحوار باقيةٌ داخل نصّ الجزء — هذا هو الحمل. */
    expect(out.nodes[0].text).toContain('Speaker 1: أ');
    expect(out.nodes[0].text).toContain('Speaker 2: ب');
    expect(parseDialogue(out.nodes[0].text).filter((t) => t.speaker)).toHaveLength(2);
  });
});

/* ================================================================== *
 * الخدمة — على قاعدةٍ حقيقيّة
 * ================================================================== */

describe('WS-F · لوحةُ الورشة', () => {
  let sceneId = null;
  let rootB = null;
  let partId = null;

  it('٢٣ · ⚠️ تنزل بعمقٍ حرٍّ من كلّ جذر — بلا اشتراط «رحلة» (بند ٤)', async () => {
    /*
     * ⚠️ **هذه هي الثغرةُ التي وُجدت الخدمةُ لسدّها.** `organizeBoard`
     *    تنزل تحت عقدة الرحلة وحدَها، و`partsOf` لا تتعمّق. فبنيةُ
     *    «سكريبت ← مرحلة ← جزء ← جولة» كانت جولتُها لا تظهر هدفَ ربطٍ
     *    أصلًا — قِيس ذلك في المتصفّح قبل كتابة سطرٍ واحدٍ من العلاج.
     */
    const scene = await createScene({ titleAr: `${TAG} ذكرى`, date: '2026-08-26' });
    sceneId = scene.id;

    await addScript(sceneId, { title: `${TAG} أ`, text: 'نصّ مسطّح' });
    const b = await addScript(sceneId, { title: `${TAG} ب`, text: '' });
    rootB = b.id;
    const phase = await addNode(b.id, { title: 'PHASE 1', nodeKind: 'phase' });
    const part = await addNode(phase.id, { title: 'PART 1', nodeKind: 'part', text: 'نصّ' });
    partId = part.id;
    await addNode(part.id, { title: 'ROUND 1', nodeKind: 'round', text: 'جولة' });

    const board = await workspaceBoard(sceneId);
    const round = board.targets.find((t) => t.title === 'ROUND 1');
    expect(Boolean(round)).toBe(true);
    expect(round.depth).toBe(3);
    /* والمسارُ كاملٌ لا معرّف (بند ١٠). */
    expect(pathLabel(round)).toContain('PHASE 1');
    expect(pathLabel(round)).toContain('PART 1');
  });

  it('٢٤ · وأكثرُ من سكريبتٍ رئيسيٍّ في ذكرًى واحدة (بند ٥)', async () => {
    const board = await workspaceBoard(sceneId);
    expect(board.roots.length >= 2).toBe(true);
    /* وكلٌّ له شجرتُه. */
    expect(board.treeByRoot.has(rootB)).toBe(true);
  });

  it('٢٥ · ⚠️ والعدُّ المباشرُ متمايزٌ عن التراكميّ (بند ٥٤)', async () => {
    const board = await workspaceBoard(sceneId);
    const phase = board.targets.find((t) => t.title === 'PHASE 1');
    /* حقلان مسمّيان — لا رقمٌ واحدٌ ملتبس. */
    expect(typeof phase.own.audio).toBe('number');
    expect(typeof phase.sub.audio).toBe('number');
    expect('own' in phase && 'sub' in phase).toBe(true);
  });

  it('٢٦ · والسكريبتُ الأساسيُّ ليس «غير مربوط»', async () => {
    /*
     * أمسك هذا الفحصُ الميدانيُّ خطأً: كانت اللوحةُ تعدّ نصَّ الذكرى
     * الأساسيَّ ضمن الكومة المنتظِرة، فيقول الفلترُ «٥ لسّه ما
     * رتّبتهمش» وفيهم النصُّ الأصليّ — وهو ليس منتظِرًا شيئًا.
     */
    const board = await workspaceBoard(sceneId);
    const primary = board.roots.find((r) => r.isPrimary === 1);
    expect(Boolean(primary)).toBe(true);
    expect(board.looseTexts.some((t) => t.id === primary.id)).toBe(false);
  });

  it('٢٧ · والنصُّ السائبُ يدخل الشجرة ويخرج منها', async () => {
    const loose = await addLooseText(sceneId, { title: `${TAG} ملاحظة`, text: 'محتوى' });
    let board = await workspaceBoard(sceneId);
    expect(board.looseTexts.some((t) => t.id === loose.id)).toBe(true);

    await placeTextUnder(loose.id, partId);
    board = await workspaceBoard(sceneId);
    expect(board.targets.some((t) => t.id === loose.id && t.depth === 3)).toBe(true);
    /*
     * ⚠️ **ويُنزَع `sceneId` عند الدخول** — وهو بند ١١٣ بعينه: عقدةٌ
     *    داخل شجرةٍ يجب ألّا تظهر سكريبتًا مستقلًّا في الصفحة القديمة.
     */
    expect((await scripts.get(loose.id)).sceneId).toBe(null);

    await detachToLoose(loose.id, sceneId);
    expect((await scripts.get(loose.id)).sceneId).toBe(sceneId);
  });

  it('٢٨ · و«جوّه» و«بعد ده» موضعان مختلفان (بند ٢٥)', async () => {
    const inside = await addTextAt(partId, 'inside', { title: `${TAG} ابن` });
    const after = await addTextAt(partId, 'after', { title: `${TAG} شقيق` });
    const board = await workspaceBoard(sceneId);
    const p = board.targetById.get(partId);
    expect(board.targetById.get(inside.id).depth).toBe(p.depth + 1);
    expect(board.targetById.get(after.id).depth).toBe(p.depth);
  });

  it('٢٩ · والالتزامُ يُنشئ عُقَدًا عاديّةً تمامًا (بند ٣٥)', async () => {
    const proposal = parsePaste('PHASE 9 — مستورَدة\nPART 1 — أ\nنصّ أ\nPART 2 — ب\nنصّ ب');
    const { created, byId } = await commitPaste(rootB, proposal);
    expect(created).toBe(3);

    const madeId = byId.get(proposal.nodes[1].id);
    const row = await scripts.get(madeId);
    expect(row.nodeKind).toBe('part');
    expect(row.text).toBe('نصّ أ');
    /* ⚠️ ولا علامةَ «مستورَدة» تعاملها معاملةً خاصّة. */
    expect('importedAt' in row).toBe(false);
    expect('fromPaste' in row).toBe(false);
  });

  it('٣٠ · واستبعادُ أبٍ يُصعِد أبناءَه لا يُسقطهم', async () => {
    const proposal = parsePaste('PHASE 8\nPART 1 — باقٍ\nنصّ');
    const { created, byId } = await commitPaste(rootB, proposal, {
      excluded: [proposal.nodes[0].id],
    });
    expect(created).toBe(1);
    const kept = await scripts.get(byId.get(proposal.nodes[1].id));
    expect(kept.title).toBe('PART 1 — باقٍ');
  });

  it('٣١ · والتعارضُ يُبلَّغ قبل الكتابة (بند ٦٧)', async () => {
    const proposal = parsePaste('PHASE 9 — مستورَدة\nPART 1 — أ\nنصّ');
    const clashes = await conflictsFor(rootB, proposal);
    expect(clashes.length >= 1).toBe(true);
    expect(clashes[0].title).toBe('PHASE 9 — مستورَدة');
  });
});

/* ================================================================== *
 * حرّاسٌ نصّيّون — ما لا يُقاس بتشغيلٍ يُقاس بقراءة
 * ================================================================== */

describe('WS-F · مصدرُ حقيقةٍ واحد', () => {
  it('٣٢ · ⚠️ ولا مخزنَ ولا ترقيةَ من أجل الورشة (بندا ٧٩ و١١٢)', async () => {
    const svc = codeOnly(await (await fetch('../js/services/workspace/workspace-service.js')).text());
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());

    /* لا مخزنَ جديد. */
    const schema = await (await fetch('../js/db/schema.js')).text();
    for (const invented of ['workspaceNodes', 'workspaceLinks', 'contentDesk', 'textTree']) {
      expect(`${invented}:${schema.includes(invented)}`).toBe(`${invented}:false`);
    }
    /* ولا ترقيةَ باسم الورشة. */
    const migrations = await (await fetch('../js/db/migrations.js')).text();
    expect(migrations.toLowerCase().includes('workspace')).toBe(false);
    /* والشاشةُ لا تكتب في مستودعٍ بيدها. */
    expect(view.includes("from '../db/repositories.js'")).toBe(false);
    /* والخدمةُ تربط بـ`link-service` القائمة لا بمنطقٍ ثانٍ. */
    expect(svc.includes("from '../link-service.js'")).toBe(true);
    expect(svc.includes('linkItemsTo')).toBe(true);
  });

  it('٣٣ · ⚠️ ولا ذكاءَ اصطناعيَّ ولا نداءَ شبكةٍ في المحلّلات (بند ٩٠)', async () => {
    for (const path of [
      '../js/services/workspace/paste-parser.js',
      '../js/services/workspace/speaker-parser.js',
    ]) {
      const code = codeOnly(await (await fetch(path)).text());
      for (const banned of ['fetch(', 'openai', 'anthropic', 'XMLHttpRequest', 'import(']) {
        expect(`${path}:${banned}:${code.includes(banned)}`).toBe(`${path}:${banned}:false`);
      }
    }
  });

  it('٣٤ · ⚠️ وبابُ اللصق لا يملك أن يكتب (بند ٣١)', async () => {
    const code = codeOnly(await (await fetch('../js/modals/smart-paste.js')).text());
    /*
     * ⚠️ نفسُ انضباط بابِ تبادل الذاكرة (WS-C2): «الإلغاء صفرُ
     *    كتابات» **بنيةً لا وعدًا** — الملفُّ لا يستورد ما يكتب.
     */
    for (const banned of ['commitPaste', 'addNode', 'addScript', 'repositories.js', 'create(']) {
      expect(`${banned}:${code.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٣٥ · والتحريرُ يمرّ بتاريخ النُّسَخ لا يلتفّ عليه (بند ٦٠)', async () => {
    const svc = codeOnly(await (await fetch('../js/services/workspace/workspace-service.js')).text());
    expect(svc.includes('updateScript')).toBe(true);
    /* ⚠️ ولا كتابةَ نصٍّ مباشرةً على السجلّ — تلك تتخطّى التاريخ. */
    expect(/scripts\.update\([^)]*text/.test(svc)).toBe(false);
  });

  it('٣٦ · ⚠️ وكلُّ مستمعٍ في الشاشة يأخذ إشارةَ القطع', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    /*
     * ⚠️ **المرساةُ بشكلها هنا لا بشكلها في الظلّ.** نقلتُ هذا الحارسَ
     *    من `study-draft.test.js` حرفيًّا فبحث عن `function freshWires`،
     *    و`freshWires` هنا سهمٌ ثابت. فكان `indexOf` يعيد −1 والحارسُ
     *    يسقط على مرساته لا على ما يحرسه — أي حارسٌ لا يحرس شيئًا.
     */
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

  it('٣٧ · ⚠️ والشاشةُ لا تملك عنصرَ صوتٍ خاصًّا بها (بندا ٧٥ و٧٦)', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    /*
     * لو أنشأت الشاشةُ `<audio>` لَمات مع أوّل إعادة رسم — وهو بالضبط
     * ما يمنع التعرّفَ على صوتٍ مجهول وأنت تقلّب في النصوص.
     */
    expect(code.includes("createElement('audio')")).toBe(false);
    expect(code.includes('new Audio(')).toBe(false);
    /* بل تشترك في الخدمة العامّة. */
    expect(code.includes("from '../services/audio-service.js'")).toBe(true);
  });

  it('٣٨ · والأنواعُ الثلاثةُ وحدَها معروضة (بند ٢)', () => {
    expect(Object.values(ITEM).sort()).toEqual(['audio', 'image', 'text']);
  });

  it('٣٩ · ⚠️ والشريطُ العالميُّ يُخفى فلا يبتلع «اربط» (بندا ١٠٩ و١٢٢)', async () => {
    /*
     * `elementsFromPoint` أعطت السلسلة حرفيًّا في الفحص الميدانيّ:
     *     B > mp-info > mp-body > mini-player
     * أي أن المُشغّلَ العالميَّ (ثابتٌ بـz-index 55) كان يرقد فوق
     * زرِّ «اربط المحدد». يُرى ولا يُلمَس.
     */
    const css = await (await fetch('../css/workspace.css')).text();
    expect(css.includes('body.workspace-open .mini-player')).toBe(true);
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    expect(view.includes("classList.add('workspace-open')")).toBe(true);
    expect(view.includes("classList.remove('workspace-open')")).toBe(true);
  });

  it('٤١ · WS-F2 · التقسيمُ حدٌّ لا يأكل سطرًا (بندا ١٦ و٧١)', () => {
    const src = ['PART 1 — أ', ...Array.from({ length: 8 }, (_, i) => `سطر ${i + 1}`)].join('\n');
    const base = parsePaste(src);
    expect(base.nodes[0].bodyAt).toHaveLength(8);

    const cutAt = base.nodes[0].bodyAt[4];
    const out = parsePaste(src, { splits: { [cutAt]: { title: 'تكملة', level: 3 } } });
    expect(out.counts.nodes).toBe(2);
    expect(out.nodes[0].text.split('\n')).toHaveLength(4);
    expect(out.nodes[1].text.split('\n')).toHaveLength(4);
    /* ⚠️ عددُ أسطر العناوين لم يتغيّر — الحدُّ افتراضيٌّ لا سطرٌ مُستهلَك. */
    expect(out.accounting.headingLines).toBe(base.accounting.headingLines);
    expect(out.accounting.unassigned).toBe(0);
    /* والعنوانُ من عندك، ويُعلَن أنّه كذلك. */
    expect(out.nodes[1].synthetic).toBe(true);
    expect(out.nodes[1].title).toBe('تكملة');
  });

  it('٤٢ · ⚠️ وسلامةُ الأسطر تُقاس بالتعداد لا بالتفرّد (بند ٧٣)', () => {
    /*
     * ⚠️ أوّلُ صياغةٍ كتبتُها اشترطت أن يظهر كلُّ سطرٍ **مرّةً واحدة**،
     *    فسقطت — وكانت محقّةً وكنتُ مخطئًا: «نصّ» قد يتكرّر في المدخل
     *    نفسِه. والمقياسُ الصادق: تعدادُ كلّ سلسلةٍ في الخرج = تعدادُها
     *    في الدخل، لا أكثرَ ولا أقلّ.
     */
    const src = ['PHASE 1', 'PART 1 — أ', 'مكرَّر', 'واحد', 'مكرَّر',
      'PART 2 — ب', 'مكرَّر', 'اتنين'].join('\n');
    const base = parsePaste(src);
    const cutAt = base.nodes[1].bodyAt[1];
    const out = parsePaste(src, {
      splits: { [cutAt]: { title: 'مقسوم', level: 3 } },
      demote: [base.nodes[2].at],
    });

    const tally = (list) => list.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
    const isHead = (l) => /^(PHASE|PART)/.test(l);
    const inBody = tally(src.split('\n').map((l) => l.trim()).filter((l) => l && !isHead(l)));
    const outAll = tally(out.nodes.flatMap((n) => n.text.split('\n')).map((l) => l.trim()).filter(Boolean));

    for (const [line, n] of inBody) expect(`${line}:${outAll.get(line) || 0}`).toBe(`${line}:${n}`);
    expect(out.accounting.unassigned).toBe(0);
    /* ⚠️ وعنوانُ المدموج بقي سطرًا في المتن — لم يُحذَف (بند ٧٢). */
    expect(outAll.has('PART 2 — ب')).toBe(true);
  });

  it('٤٣ · والدمجُ هو الخفضُ نفسُه — لا آليّةَ ثالثة (بند ١٧)', () => {
    const src = ['PART 1 — أ', 'متن أ', 'PART 2 — ب', 'متن ب'].join('\n');
    const merged = parsePaste(src, { demote: [2] });
    expect(merged.counts.nodes).toBe(1);
    expect(merged.nodes[0].title).toBe('PART 1 — أ');
    expect(merged.nodes[0].text).toContain('متن أ');
    expect(merged.nodes[0].text).toContain('متن ب');
  });

  it('٤٤ · WS-F2 · اتّجاهُ الفقرة من محتواها لا من الكتلة (بند ٢٤)', () => {
    expect(dirOf('دلوقتي ندخل على: вскрыть.')).toBe('rtl');
    expect(dirOf('Отличный вопрос. Открыть كلمة عامة.')).toBe('ltr');
    expect(dirOf('123 — ...')).toBe('auto');
  });

  it('٤٥ · ونموذجُ المحادثة يُحسَب مرّةً ويحفظ الفقرات (بندا ٢٥ و٦٠)', () => {
    const real = [
      'Speaker 1: دلوقتي ندخل على أهم فعل: вскрыть.', '',
      'في السياق ده вскрыть معناها يفضّ.', '',
      'Speaker 2: طب إيه الفرق بينها وبين открыть؟', '',
      'Speaker 1: Отличный вопрос. Открыть كلمة عامة جدًا.', '',
      'لكن вскрыть بتدي إحساس إن الحاجة كانت مختومة.', '',
      'Speaker 2: Вскрыть упаковку.',
    ].join('\n');

    const model = conversationModel(real);
    expect(model).toHaveLength(4);
    expect(model.map((t) => t.speaker)).toEqual(['1', '2', '1', '2']);
    /* دورٌ واحدٌ بفقرتين — لا فقاعتان (بند ٢٥). */
    expect(model[0].paragraphs).toHaveLength(2);
    expect(model[2].paragraphs).toHaveLength(2);
    /* واتّجاهان مختلفان داخل الدَّور الواحد. */
    expect(model[2].paragraphs.map((p) => p.dir)).toEqual(['ltr', 'rtl']);
    /* ⚠️ وتكرارُ المتحدّث ٢ باقٍ — محتوًى تعليميٌّ لا حشو (بند ٢٧). */
    expect(model[3].paragraphs[0].text).toContain('Вскрыть упаковку');
  });

  it('٤٦ · WS-F2 · الربطُ يضيف ولا يهدم، والفكُّ مسمًّى (بندا ٣٩ و٤٠)', async () => {
    const scene = await createScene({ titleAr: `${TAG} وجهات`, date: '2026-08-26' });
    const root = await addScript(scene.id, { title: `${TAG} جذر`, text: '' });
    const a = await addNode(root.id, { title: 'A', nodeKind: 'part', text: 'أ' });
    const b = await addNode(root.id, { title: 'B', nodeKind: 'part', text: 'ب' });

    const { media, sceneMediaLinks } = await import('../js/db/repositories.js');
    const item = await media.create({ kind: 'audio', caption: `${TAG}.mp3`, blob: new Blob(['x']) });
    await sceneMediaLinks.create({ sceneId: scene.id, mediaId: item.id, order: 1, roles: [] });

    let board = await workspaceBoard(scene.id);
    await linkSelection([item.id], a.id, board, { mode: 'attach' });
    board = await workspaceBoard(scene.id);
    await linkSelection([item.id], b.id, board, { mode: 'attach' });
    board = await workspaceBoard(scene.id);

    /* ⚠️ وجهتان — لا واحدةٌ دهست الأخرى. */
    expect(destinationsOf(board, item.id)).toHaveLength(2);

    await unlinkOne(item.id, board, a.id);
    board = await workspaceBoard(scene.id);
    const left = destinationsOf(board, item.id);
    expect(left).toHaveLength(1);
    expect(left[0]).toBe(b.id);
    /* والملفُّ نفسُه باقٍ — الفكُّ يشيل علاقةً لا محتوًى (بند ٨٠-WS-F). */
    expect(Boolean(await media.get(item.id))).toBe(true);
  });

  it('٤٧ · ⚠️ ووضعُ «انقل» باقٍ للوضع القديم بلا تغيير (بند ١)', async () => {
    /*
     * WS56 يريد «انقل»: عنصرٌ في مكانٍ واحدٍ داخل الذكرى. والورشةُ
     * تريد «أضِف». فالافتراضُ بقي `move` حتى لا يتغيّر سلوكُ الوضع
     * القديم بحرف، والورشةُ وحدَها تمرّر `attach`.
     */
    const src = codeOnly(await (await fetch('../js/services/organize-service.js')).text());
    expect(src.includes("mode = 'move'")).toBe(true);
    const svc = codeOnly(await (await fetch('../js/services/workspace/workspace-service.js')).text());
    expect(svc.includes("mode = 'attach'")).toBe(true);
    const org = codeOnly(await (await fetch('../js/views/organize-view.js')).text());
    /* والوضعُ القديم لا يمرّر وضعًا أصلًا — فيأخذ الافتراض. */
    expect(org.includes("mode: 'attach'")).toBe(false);
  });

  it('٤٨ · ⚠️ لمسةُ الشجرة لا تنادي كاتبَ علاقةٍ أبدًا (بند ٣٨)', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    const from = code.indexOf('function selectNode');
    expect(from > 0).toBe(true);
    const body = code.slice(from, code.indexOf('\n}', from));
    for (const banned of ['linkSelection', 'linkItemsTo', 'link(', 'placeTextUnder']) {
      expect(`${banned}:${body.includes(banned)}`).toBe(`${banned}:false`);
    }

    /*
     * ⚠️ **الأسماءُ تغيّرت في WS-P، والمحروسُ لم يتغيّر.**
     *
     *    كان الربطُ فعلين اسمُهما `link-here` و`link-selected`: تمسك
     *    عنصرًا في شريطٍ سفليّ ثم تضغط زرًّا. وWS-P (بند ١٨) جعله
     *    مسارًا مقصودًا: تفتح العنصر ← وضع «ربط» ← المُفتِّش ←
     *    «+ إضافة رابط» ← بحثٌ ← معاينةٌ ← تأكيد.
     *
     *    فالحارسُ يحرس **المعنى** لا الاسم: لمسةُ الشجرة استكشافٌ لا
     *    تكتب، والربطُ فعلٌ مسمًّى منفصلٌ له حالتُه. ولو ثبّتُّ الاسمَ
     *    القديم لَكان الحارسُ يمنع إعادةَ التسمية لا يمنع الخلط.
     */
    expect(code.includes("case 'link-add'")).toBe(true);
    expect(code.includes("case 'unlink'")).toBe(true);
    /* والكتابةُ نفسُها في دالّةٍ واحدةٍ مسمّاةٍ لا مبعثرةٍ في المعالج. */
    expect(code.includes('async function commitLink')).toBe(true);
  });

  it('٤٩ · ⚠️ والممسوكُ والهدفُ حالةُ واجهةٍ لا تُحفَظ (بندا ٣٦ و٦٤)', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    /* لا مخزنَ ولا إعدادات ولا تخزينٌ محلّيّ لهما. */
    for (const banned of ['localStorage', 'sessionStorage', 'saveSetting', 'settings.']) {
      expect(`${banned}:${code.includes(banned)}`).toBe(`${banned}:false`);
    }
    const schema = await (await fetch('../js/db/schema.js')).text();
    for (const banned of ['workingItem', 'candidateTarget', 'previewScroll']) {
      expect(`${banned}:${schema.includes(banned)}`).toBe(`${banned}:false`);
    }
  });

  it('٥٠ · ⚠️ وتبديلُ نمط العرض لا يكتب نصًّا (بندا ٢١ و٦٧)', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    /* ⚠️ `pmode` صار `dmode` في WS-P — المعاينةُ صارت هي المستندَ نفسَه. */
    const from = code.indexOf("case 'dmode'");
    expect(from > 0).toBe(true);
    const body = code.slice(from, from + 400);
    for (const banned of ['saveNodeText', 'updateScript', 'scripts.update']) {
      expect(`${banned}:${body.includes(banned)}`).toBe(`${banned}:false`);
    }
    /* والرسمُ من `conversationModel` لا من كتابةٍ في المصدر. */
    expect(code.includes('conversationModel')).toBe(true);
  });

  it('٥١ · ⚠️ ومُمرِّرُ اللوح هو `.ws-col` — قِيس لا يُفترَض (بند ٥٧)', async () => {
    const css = await (await fetch('../css/workspace.css')).text();
    /* قفلُ الارتفاع هو ما يجعل اللوحَ مُمرِّرًا أصلًا. */
    expect(css.includes('body.workspace-open')).toBe(true);
    expect(css.includes('100dvh')).toBe(true);
    expect(css.includes('overflow-anchor: none')).toBe(true);

    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    expect(code.includes('const SCROLLERS')).toBe(true);

    /*
     * ⚠️ **مالكٌ واحدٌ لذاكرة الأنماط: المبدِّلُ يحفظ، والرسمُ يستعيد.**
     *
     *    قِيس العطبُ في WS-F2: كان الرسمُ يحفظ الموضعَ أيضًا، وبـ
     *    `docMode` **بعد** أن يكون المبدِّلُ غيّره — فيكتب موضعَ النمط
     *    المغادِر في خانة القادم ثم يستعيده. أي أنّ التبديلَ لا يبدّل
     *    شيئًا: خزّنتُ ١٢٠ في «محادثة» فرجعت ٦٠.
     *
     *    (كان اسمُه `paintPreview` و`previewScroll` قبل WS-P؛ صار
     *     `paintDoc` و`docScroll` لأن المعاينةَ صارت هي المستندَ.)
     */
    const from = code.indexOf('function paintDoc');
    expect(from > 0).toBe(true);
    const paint = code.slice(from, code.indexOf('const paintInsp', from));
    expect(paint.includes('state.docScroll[state.docMode] =')).toBe(false);
  });

  it('٥٢ · ولا يُنشَأ عارضُ صورٍ ثانٍ (بند ١٣ من ٨٠)', async () => {
    const code = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    expect(code.includes("from '../components/lightbox.js'")).toBe(true);
    expect(code.includes('openLightbox')).toBe(true);
  });

  it('٤٠ · والشاشاتُ القديمة لم تُمَسّ (بند ٧٨)', async () => {
    /*
     * ⚠️ **إضافةٌ لا استبدال.** الوضعُ القديم وصفحةُ الذكرى يبقيان
     *    يعملان؛ وكلُّ ما أُضيف إلى `scene-view` بابٌ واحد.
     */
    const scene = await (await fetch('../js/views/scene-view.js')).text();
    expect(scene.includes('workspace-scene')).toBe(true);
    expect(scene.includes('organize-scene')).toBe(true);
    const app = await (await fetch('../js/app.js')).text();
    expect(app.includes("route('/organize/:id'")).toBe(true);
    expect(app.includes("route('/workspace/:id'")).toBe(true);
    /* ⚠️ ودالّةُ الإنعاش لا تعيد الرسم من الصفر — الحالةُ تُحفَظ. */
    const ui = await (await fetch('../js/ui-state.js')).text();
    expect(ui.includes('reloadWorkspace')).toBe(true);
  });
});

/**
 * LingoLife — منطقُ ورشة المحتوى، مفصولًا عن رسمها (WS-P)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لماذا هذا الملفُّ موجودٌ أصلًا** (بند ٠)
 * ═══════════════════════════════════════════════════════════════
 *
 * الشاشةُ القديمة كانت أربعةَ أعمدةٍ يسكن **داخلَ** دوالِّ رسمها منطقٌ
 * لا علاقةَ له بالرسم: أيُّ عقدةٍ تطابق بحثًا، وأيُّ وسيطٍ مُعلَّقٌ على
 * أيّ عقدة، ومتى تصير المسوّدةُ «فيها تعديلاتٌ غيرُ محفوظة». وحذفُ
 * عمودٍ كان يعني حذفَ ذلك المنطق معه.
 *
 * وبند ٠ يقول حرفيًّا: **لا يُحذَف مكوّنٌ قديمٌ قبل أن يُستخرَج منه
 * منطقُ العمل ويُعاد استعماله.** فهذا الملفُّ هو المُستخرَج — دوالُّ
 * خالصةٌ لا تعرف DOM ولا تفتح قاعدةً، تُختبَر وحدَها، وتخدم أيَّ شكلٍ
 * تأخذه الشاشةُ بعد اليوم.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا مصدرَ حقيقةٍ ثانٍ هنا كذلك** (بندا ٢٢ و٣٦)
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ ما تحت تقرؤه من `board` — ناتجِ `workspaceBoard` — ولا يستورد
 * مستودعًا ولا يكتب حرفًا. فما لا يوجد في البيانات لا يظهر على الشاشة
 * (بند ٢٣)، وما يظهر لا يمكن أن يكون مخترَعًا.
 */

/* ================================================================== *
 * الأوضاع الثلاثة (بند ٥)
 * ================================================================== */

/**
 * ⚠️ **ثلاثةٌ صريحةٌ لا حالةٌ ضمنيّة.** الشاشةُ القديمة كانت «تحرِّر»
 *    بفتح نافذةٍ و«تربط» بمسك عنصرٍ في شريطٍ سفليّ — أي أن الوضعَ
 *    الحاليَّ كان يُستنتَج من وجود نافذةٍ أو امتلاء شريط. والوضعُ
 *    المُستنتَجُ لا يمكن عرضُه ولا حفظُه ولا اختبارُه.
 */
export const MODE = Object.freeze({ READ: 'read', EDIT: 'edit', LINK: 'link' });

export const MODE_LABEL = Object.freeze({
  [MODE.READ]: 'قراءة',
  [MODE.EDIT]: 'تحرير',
  [MODE.LINK]: 'ربط',
});

/** تبويباتُ المُفتِّش (بند ٦). */
export const TAB = Object.freeze({ LINKS: 'links', PROPS: 'props', MEDIA: 'media' });

export const TAB_LABEL = Object.freeze({
  [TAB.LINKS]: 'الربط',
  [TAB.PROPS]: 'الخصائص',
  [TAB.MEDIA]: 'الوسائط',
});

/* ================================================================== *
 * حالةُ الحفظ (بند ١٣)
 * ================================================================== */

/**
 * ⚠️ **«اتحفظ» لا تُقال قبل أن يرجع الوعدُ محقَّقًا** (بند ١٣). الشاشةُ
 *    القديمة كانت تُغلق النافذةَ ثم تقول «اتحفظ» — والإغلاقُ يسبق
 *    الكتابة. فلو فشلت الكتابةُ رأيتَ تأكيدًا كاذبًا وضاع ما كتبت.
 */
export const SAVE = Object.freeze({
  CLEAN: 'clean',
  DIRTY: 'dirty',
  SAVING: 'saving',
  SAVED: 'saved',
  FAILED: 'failed',
});

export const SAVE_LABEL = Object.freeze({
  [SAVE.CLEAN]: 'محفوظ',
  [SAVE.DIRTY]: 'فيه تعديلات مش متحفظة',
  [SAVE.SAVING]: 'بيحفظ…',
  [SAVE.SAVED]: 'اتحفظ',
  [SAVE.FAILED]: 'الحفظ فشل',
});

/**
 * مسوّدةٌ لعقدةٍ — العنوانُ والنصُّ كما هما في الحقول الآن.
 *
 * ⚠️ **والأصلُ محفوظٌ معها** (بند ٥): «فيه تعديلات» تُقاس بالمقارنة
 *    بما جاء من القاعدة، لا براية `dirty` تُرفَع عند أوّل ضغطةِ مفتاحٍ
 *    وتبقى مرفوعةً بعد أن تتراجع عن كتابتك حرفًا حرفًا.
 */
export function makeDraft(node) {
  if (!node) return null;
  return {
    id: node.id,
    title: node.title || '',
    text: node.text || '',
    baseTitle: node.title || '',
    baseText: node.text || '',
    status: SAVE.CLEAN,
    error: null,
  };
}

/** هل تغيّرت المسوّدةُ فعلًا عن أصلها؟ */
export function draftChanged(draft) {
  if (!draft) return false;
  return draft.title !== draft.baseTitle || draft.text !== draft.baseText;
}

/** بعد حفظٍ ناجح: الأصلُ يصير ما حفظتَه، فلا تبقى «فيه تعديلات». */
export function draftCommitted(draft) {
  if (!draft) return null;
  return {
    ...draft,
    baseTitle: draft.title,
    baseText: draft.text,
    status: SAVE.SAVED,
    error: null,
  };
}

/* ================================================================== *
 * المُتصفِّح — تسطيحُ الشجرة (بنود ٣ و١٥ و١٦)
 * ================================================================== */

/** كم صفًّا يُرسَم تحت أبٍ واحدٍ قبل «عرض المزيد» (بند ١٥). */
export const NAV_PAGE = 150;

/**
 * سقفُ **مجموع** الصفوف المرسومة — لا سقفُ كلّ أبٍ وحدَه (بند ١٥).
 *
 * ⚠️ **عطبٌ قاسه المسبار، ولم يكن ظاهرًا بالقراءة.** السقفُ لكلّ أبٍ
 *    وحدَه كافٍ لشجرةٍ عريضة، وعاجزٌ تمامًا عن شجرةٍ **عميقة**: بحثٌ
 *    عن كلمةٍ شائعةٍ في ٢١٢٢ عقدةً كشف ٢١١٠ منها، ولكلّ أبٍ عشرةُ
 *    أبناءٍ فقط — فلم يتجاوز أيُّ أبٍ سقفَه، ورُسمت الألفان كلُّها:
 *
 *        بحث (ضغطة + رسم): **٧٣٣ms** · صفوف مرسومة: **٢١١٠**
 *
 *    والباقي يُعلَن بعددِه الحقيقيّ — لا يُحذَف صامتًا (بند ٢٣).
 */
export const NAV_MAX_ROWS = 400;

/** أقصى عمقٍ يُمشى — نفسُ حارس `MAX_DEPTH` في الخدمة. */
const MAX_DEPTH = 12;

/**
 * العقَدُ المطابِقةُ لبحثٍ **وآباؤها** (بند ١٦).
 *
 * ⚠️ **والمطابقُ يُعرَض بسلسلة نسبه لا وحدَه.** نتيجةٌ معلّقةٌ في الفراغ
 *    لا تقول أين هي، وأنت تبحث لتصل لا لترى اسمًا.
 *
 * @returns {{hit:Set<string>, reveal:Set<string>}|null} `null` = لا بحث
 */
export function searchReveal(board, query) {
  const needle = (query || '').trim().toLowerCase();
  if (!needle) return null;

  const hit = new Set();
  /* ⚠️ فهرسٌ جاهزٌ من الخدمة — لا بناءَ سلاسلَ في كلّ ضغطةِ مفتاح. */
  for (const [id, hay] of board.haystack) {
    if (hay.includes(needle)) hit.add(id);
  }

  const reveal = new Set(hit);
  for (const id of hit) {
    let parent = board.targetById.get(id)?.parentId || null;
    let depth = 0;
    while (parent && !reveal.has(parent) && depth < MAX_DEPTH) {
      reveal.add(parent);
      parent = board.targetById.get(parent)?.parentId || null;
      depth += 1;
    }
  }
  return { hit, reveal };
}

/**
 * مجموعتا المُتصفِّح — **مشتقّتان من البيان لا مخترَعتان** (بند ٢٣).
 *
 * «السكريبتات» = جذورٌ لها بنيةٌ أو هي أساسُ الذكرى.
 * «نصوص سايبة» = `board.looseTexts` نفسُها: جذرٌ غيرُ أساسيٍّ بلا أبناء.
 *
 * ⚠️ **وليست هذه هرميّةً ثانيةً منافِسة** (بند ١٦): هي **نفسُ** الجذور،
 *    مقسومةً بحقيقةٍ محسوبةٍ من القاعدة، في **نفس** الشجرة.
 */
export function navGroups(board) {
  const loose = new Set(board.looseTexts.map((row) => row.id));
  return {
    scripts: board.roots.filter((row) => !loose.has(row.id)),
    loose: board.looseTexts,
  };
}

/**
 * يُسطِّح الشجرةَ إلى صفوفٍ جاهزةٍ للرسم.
 *
 * ⚠️ **ولا يُرسَم إلّا ما هو مفرودٌ فعلًا** (بند ١٥): جذرٌ مطويٌّ تحته
 *    أربعةُ آلافِ عقدةٍ يكلّف صفًّا واحدًا. والمفرودُ نفسُه له سقفٌ
 *    لكلّ أبٍ، وما زاد يُعلَن بعددِه الحقيقيّ لا بحذفٍ صامت.
 *
 * @param {object} board
 * @param {{expanded:Set<string>, query?:string, shown?:Map<string,number>}} opts
 * @returns {{rows:Array, hits:number, truncated:number}}
 */
export function navRows(board, {
  expanded, query = '', shown = new Map(), budget = NAV_MAX_ROWS,
} = {}) {
  const found = searchReveal(board, query);
  const groups = navGroups(board);
  const rows = [];
  let truncated = 0;
  let drawn = 0;
  let overBudget = 0;

  const visible = (id) => !found || found.reveal.has(id);
  const isOpen = (id) => (found ? found.reveal.has(id) : expanded.has(id));

  const pushKids = (kids, depth, parentId) => {
    const usable = kids.filter((row) => visible(row.node.id));
    const cap = shown.get(parentId) ?? NAV_PAGE;
    const slice = usable.slice(0, cap);

    for (const row of slice) {
      const id = row.node.id;
      const kidsHere = row.children.filter((one) => visible(one.node.id));
      const open = isOpen(id) && kidsHere.length > 0;

      /*
       * ⚠️ **وما يتجاوز الميزانيّةَ يُعَدّ ولا يُرسَم** (بند ٢٣): لو
       *    خرجنا من الحلقة لَما عرفنا كم بقي، فكتبنا «فيه كمان» بلا
       *    عدد — أو ما هو أسوأ: حذفناه صامتين. والعدُّ بلا إنشاء صفٍّ
       *    رخيصٌ، والرسمُ هو الغالي.
       */
      if (drawn >= budget) {
        overBudget += 1;
      } else {
        drawn += 1;
        rows.push({
          type: 'item',
          id,
          title: row.node.title,
          depth,
          kind: row.node.nodeKind || '',
          hidden: row.node.hidden === 1,
          hasKids: kidsHere.length > 0,
          open,
          hit: found ? found.hit.has(id) : false,
          target: board.targetById.get(id) || null,
        });
      }
      if (open && depth < MAX_DEPTH) pushKids(row.children, depth + 1, id);
    }

    if (usable.length > slice.length && drawn < budget) {
      truncated += usable.length - slice.length;
      rows.push({
        type: 'more',
        parentId,
        depth,
        remaining: usable.length - slice.length,
        total: usable.length,
      });
    }
  };

  const pushGroup = (key, label, list) => {
    const usable = list.filter((row) => visible(row.id));
    /*
     * ⚠️ **ومجموعةٌ فارغةٌ بسبب البحث لا تُعرَض** (بند ١٦): «نصوص سايبة
     *    (٠)» تحت بحثٍ لا يطابقها ضجيجٌ يزحم النتيجة.
     */
    if (found && !usable.length) return;
    rows.push({ type: 'group', key, label, count: list.length });

    for (const root of usable) {
      const kids = (board.treeByRoot.get(root.id) || []).filter((one) => visible(one.node.id));
      const open = isOpen(root.id) && kids.length > 0;
      if (drawn >= budget) {
        overBudget += 1;
      } else {
        drawn += 1;
        rows.push({
          type: 'item',
          id: root.id,
          title: root.title,
          depth: 0,
          kind: root.nodeKind || '',
          hidden: root.hidden === 1,
          hasKids: kids.length > 0,
          open,
          root: true,
          hit: found ? found.hit.has(root.id) : false,
          target: board.targetById.get(root.id) || null,
        });
      }
      if (open) pushKids(board.treeByRoot.get(root.id) || [], 1, root.id);
    }
  };

  pushGroup('scripts', 'السكريبتات', groups.scripts);
  if (groups.loose.length) pushGroup('loose', 'نصوص سايبة', groups.loose);

  if (overBudget) rows.push({ type: 'limit', shown: drawn, hidden: overBudget });

  return {
    rows, hits: found ? found.hit.size : 0, truncated, drawn, overBudget,
  };
}

/**
 * كلُّ آباء عقدةٍ حتى الجذر — لفردِ الطريق إليها بعد إنشاءٍ أو بحث.
 */
export function ancestorsOf(board, id) {
  const out = [];
  let parent = board.targetById.get(id)?.parentId || null;
  let depth = 0;
  while (parent && depth < MAX_DEPTH) {
    out.push(parent);
    parent = board.targetById.get(parent)?.parentId || null;
    depth += 1;
  }
  return out;
}

/* ================================================================== *
 * مساحةُ العمل — ما هو المستندُ المفتوح؟ (بند ٤)
 * ================================================================== */

/**
 * الوسائطُ المُعلَّقةُ على عقدةٍ — من حسابٍ جاهزٍ لا من مسحٍ جديد.
 *
 * ⚠️ **وهي «عليها هي» لا «تحتها»** (بند ٥٤ من WS-F): جزءٌ فيه ثلاثةُ
 *    أبناءٍ لكلٍّ صوتُه ليس جزءًا عليه ثلاثةُ أصوات.
 */
export function mediaOf(board, nodeId) {
  return board.ownMedia?.get(nodeId) || { audio: [], images: [] };
}

/** فُتاتُ الطريق — من `path` المحسوب في الخدمة (بند ٤). */
export function crumbsOf(board, id) {
  const target = board.targetById.get(id);
  if (!target) return [];
  const ids = [...ancestorsOf(board, id)].reverse();
  return [
    ...ids.map((one) => ({ id: one, title: board.targetById.get(one)?.title || '—' })),
    { id, title: target.title, current: true },
  ];
}

/**
 * صفوفُ الربط للمستند المفتوح — **في الاتّجاهين** (بند ٦).
 *
 * عقدةُ نصّ  → ما عُلِّق عليها من صوتٍ وصورة، ومَن هو أبوها.
 * وسيطٌ      → العُقَدُ التي عُلِّق عليها (وقد تكون أكثرَ من واحدة).
 *
 * ⚠️ **وكلُّ صفٍّ يقول نوعَ العلاقة** (بند ٦): «صوت على العقدة» غير
 *    «العقدة جزءٌ من»، وعرضُهما بلا اسمٍ يجعل زرَّ «فكّ» قمارًا.
 *
 * ⚠️ **والهدفُ المفقودُ يُعلَن ولا يُمحى** (بند ٢٦): علاقةٌ تشير إلى
 *    عقدةٍ اتشالت تبقى مكتوبةً «الهدف مابقاش موجود» بزرٍّ معطَّل — لا
 *    تُخفى كأنها لم تكن.
 */
export function linkRowsFor(board, open) {
  if (!open) return [];
  const rows = [];

  if (open.kind === 'text') {
    const mine = mediaOf(board, open.id);
    for (const row of mine.audio) {
      rows.push({
        relation: 'audio', label: 'صوت مربوط', id: row.id, item: row,
        at: open.id, removable: true, missing: false,
      });
    }
    for (const row of mine.images) {
      rows.push({
        relation: 'image', label: 'صورة مربوطة', id: row.id, item: row,
        at: open.id, removable: true, missing: false,
      });
    }
    const parentId = board.targetById.get(open.id)?.parentId || null;
    if (parentId) {
      const parent = board.targetById.get(parentId);
      rows.push({
        relation: 'parent', label: 'جزء من', id: parentId,
        title: parent?.title || null, path: parent?.path || [],
        removable: false, missing: !parent,
      });
    }
    return rows;
  }

  const at = board.linkedTo.get(open.id) || [];
  for (const one of at) {
    const target = board.targetById.get(one);
    rows.push({
      relation: 'placed', label: 'مربوط بـ', id: one,
      title: target?.title || null, path: target?.path || [],
      at: one, removable: true, missing: !target,
    });
  }
  return rows;
}

/* ================================================================== *
 * الوسائط داخل المُفتِّش — مكتبةُ الذكرى مصفّاةً (بند ١٩)
 * ================================================================== */

export const MEDIA_FILTERS = Object.freeze([
  { id: 'unlinked', label: 'غير مربوط' },
  { id: 'audio', label: 'صوت' },
  { id: 'image', label: 'صور' },
  { id: 'all', label: 'الكل' },
]);

/**
 * وسائطُ الذكرى مصفّاةً — بديلُ عمودِ «المحتوى» الدائم.
 *
 * ⚠️ **والكومةُ غيرُ المربوطة ليست تحذيرًا** (بند ٢١ من WS-F): هي أنفعُ
 *    حالةٍ في الشاشة كلِّها — ما لسّه ما رتّبتَه — فتبقى أوّلَ مصفاة.
 */
export function mediaLibrary(board, { filter = 'unlinked', query = '' } = {}) {
  const needle = (query || '').trim().toLowerCase();
  const hay = (row) => `${row.caption || ''} ${row.role || ''}`.toLowerCase();
  const ok = (row) => !needle || hay(row).includes(needle);

  const audio = board.audio.filter(ok).map((row) => ({ kind: 'audio', row }));
  const images = board.images.filter(ok).map((row) => ({ kind: 'image', row }));

  if (filter === 'audio') return audio;
  if (filter === 'image') return images;
  if (filter === 'unlinked') {
    return [...audio, ...images].filter((one) => !board.linkedTo.has(one.row.id));
  }
  return [...audio, ...images];
}

/* ================================================================== *
 * عرضُ الألواح — حدودٌ آمنة (بند ١١)
 * ================================================================== */

/**
 * ⚠️ **الحدُّ الأدنى لمساحة العمل محميٌّ قبل أيّ تفضيل** (بند ١١).
 *    تفضيلٌ محفوظٌ من شاشةٍ عريضةٍ يجب ألّا يخنق المستندَ على شاشةٍ
 *    أضيق — والمستندُ هو العنصرُ الأوّل، لا اللوحان حولَه.
 */
/*
 * ⚠️ **الأرقامُ هنا مقيسةٌ لا منقولةٌ من مواصفة** (بند ١١). المواصفةُ
 *    اقترحت مُتصفِّحًا ٢٨٠…٣٦٠ ومُفتِّشًا ٣٠٠…٣٨٠ وقالت صراحةً «لا
 *    تنقلها بلا قياس». والقياسُ الحقيقيُّ على الجهاز غيّرها:
 *
 *      شاشةُ التابلت ١٢٨٠ عرضًا — لكن شريطَ التطبيق يأخذ ~٢٥٢
 *      فلا يبقى للورشة إلّا **~١٠٣٥**.
 *
 *    فمُفتِّشٌ ٣٨٠ كان يترك للمستند ٣٥٥ — أي أسوأَ من الشاشة القديمة
 *    التي جئنا نصلحها. والأرقامُ تحت تعطي المستندَ ٤٥٥ والألواحُ
 *    ٥٨٠ — وهي الحدُّ الذي تحتمله هذه الشاشةُ فعلًا لا الذي نتمنّاه.
 */
export const PANE = Object.freeze({
  NAV_MIN: 240, NAV_MAX: 400, NAV_DEFAULT: 280,
  INSP_MIN: 270, INSP_MAX: 420, INSP_DEFAULT: 300,
  MAIN_MIN: 430,
  /*
   * ⚠️ **وتحت هذا العرض يصير المُتصفِّحُ درجًا مهما اتّسع الحساب**
   *    (بند ٨): التابلتُ طوليًّا ٨٠٠ عرضًا، والحسابُ وحدَه يقول إن
   *    ٨٠٠−٢٨٠ = ٥٢٠ «تكفي». لكنّ بند ٨ يسمّي الأولويّةَ في الطول
   *    صراحةً: **مساحةُ العمل أوّلًا**، والمُتصفِّحُ يُطلَب. فالعتبةُ
   *    قرارٌ معلَنٌ لا نتيجةُ حسابٍ عرَضيّة.
   */
  NAV_DOCK_AT: 900,
});

/**
 * يقصّ عرضًا مطلوبًا إلى ما تحتمله الشاشةُ فعلًا.
 *
 * @returns {number} العرضُ الآمن — وقد يساوي `min` إن ضاقت الشاشة.
 */
export function clampPane(want, { min, max, viewport, other = 0 }) {
  const room = viewport - other - PANE.MAIN_MIN;
  const ceiling = Math.min(max, Math.max(min, room));
  return Math.round(Math.max(min, Math.min(ceiling, want || min)));
}

/**
 * هل تتّسع الشاشةُ للوحٍ جانبيٍّ ثابتٍ أم يجب أن يصير درجًا؟ (بند ٨)
 *
 * ⚠️ **والقياسُ بعرضِ CSS الفعليّ لا بترويسة المتصفّح** (بند ٨): لا
 *    `userAgent` ولا اسمُ جهاز. الشاشةُ تتّسع أو لا تتّسع، والباقي تخمين.
 */
export function paneFit(viewport, { nav = PANE.NAV_DEFAULT, insp = PANE.INSP_DEFAULT } = {}) {
  const navDocked = viewport >= PANE.NAV_DOCK_AT && viewport - nav >= PANE.MAIN_MIN;
  const inspDocked = navDocked && (viewport - nav - insp >= PANE.MAIN_MIN);
  return { navDocked, inspDocked };
}

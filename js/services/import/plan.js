/**
 * LingoLife — خطّة الاستيراد وحلّ التكرار
 *
 * **الطبقة الدلاليّة**: `parse.js` تسأل «هل الحزمة سليمة الشكل؟»،
 * وهذه تسأل «ما علاقة ما فيها بما عندك؟». فتقرأ القاعدة ولا تكتب فيها
 * حرفًا واحدًا — الكتابة كلّها في `apply.js`.
 *
 * ═══════════════════════════════════════════════════════════════
 * ثلاث قواعد تحكم كل قرارٍ هنا
 * ═══════════════════════════════════════════════════════════════
 *
 * **١. نقترح ولا ندمج.**
 *
 * «أحمد» في الحزمة و«أحمد صلاح» عندك: الآلة ترى حرفين فرقًا، وأنت
 * ترى شخصين أو شخصًا واحدًا — وأنت وحدك تعرف. فالمتقارب يُنشَأ جديدًا
 * افتراضًا ويُعرَض عليك البديل، لا العكس. الدمج الخاطئ يفسد سجلّ
 * شخصين معًا، وفصلُ ما كان واحدًا تصلحه بضغطة.
 *
 * **٢. المتطابق ليس دمجًا بل هويّة.**
 *
 * «اجتماع» في الحزمة و«اجتماع» عندك ليسا اثنين نُقرّر دمجهما — هما
 * واحدٌ بالاسم المطبَّع نفسه، و`addPerson`/`addType` ترفض إنشاء
 * الثاني أصلًا. فالمطابقة التامّة تُستعمل، ولا تُعرَض كسؤال.
 *
 * **٣. لكل قرارٍ دليلٌ مكتوب.**
 *
 * كل مطابقةٍ تحمل `why` بالعربية تقول لماذا: «نفس الاسم بالضبط»،
 * «اسمٌ بديل عندك»، «الفرق حرف واحد». فما تقرأه في المعاينة تفهم
 * سببه، ولا تُطالَب بالثقة في رقمٍ بلا مصدر (بند 89).
 */

import { normalize, editDistance } from '../../utils/normalization.js';
import { listPeople } from '../person-service.js';
import { listTypes } from '../type-service.js';
import { listThreads } from '../thread-service.js';
import { scenes, expressions } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { packageCounts } from './parse.js';

/** أقصى فرقٍ نعدّه «متقاربًا» يستحقّ العرض. */
const NEAR = 2;

/**
 * ما يمكن أن يُقرَّر لكل عنصر.
 *
 * ⚠️ ليست قائمةً مفتوحة: `apply.js` تنفّذ هذه الأفعال وحدها، وأي فعلٍ
 *    آخر يُرفَض هناك صراحةً بدل أن يمرّ صامتًا.
 */
export const ACTION = Object.freeze({
  /** أنشئ كيانًا جديدًا. */
  CREATE: 'create',
  /** استعمل ما عندك ولا تُنشئ شيئًا. */
  USE_EXISTING: 'use-existing',
  /** اكتب محتوى الحزمة داخل ذكرى موجودة بدل ذكرى جديدة. */
  ATTACH: 'attach',
});

/* ------------------------------------------------------------------ *
 * المطابقة
 * ------------------------------------------------------------------ */

/**
 * يطابق اسمًا واردًا بقائمةٍ عندك.
 *
 * @param {string} incoming الاسم كما جاء في الحزمة
 * @param {object[]} rows الموجود عندك
 * @param {(row: object) => string[]} namesOf كل الأسماء التي يُعرَف بها الصفّ
 * @returns {{exact: object|null, near: {row: object, distance: number, why: string}[]}}
 */
function matchName(incoming, rows, namesOf) {
  const target = normalize(incoming || '');
  if (!target) return { exact: null, near: [] };

  const near = [];
  for (const row of rows) {
    const names = namesOf(row).filter(Boolean).map(normalize).filter(Boolean);
    if (!names.length) continue;

    // الاسم الأوّل هو الاسم؛ ما بعده أسماء بديلة — والفرق يُقال للقارئ.
    const hitIndex = names.indexOf(target);
    if (hitIndex === 0) return { exact: row, why: 'نفس الاسم بالضبط', near: [] };
    if (hitIndex > 0) return { exact: row, why: 'اسمٌ تاني للشخص/النوع ده عندك', near: [] };

    // المتقارب: نأخذ أقرب أسمائه لا أوّلها.
    let best = NEAR + 1;
    for (const name of names) {
      const distance = editDistance(target, name, NEAR);
      if (distance < best) best = distance;
    }
    // احتواءُ اسمٍ لآخر ليس تقاربًا مطبعيًّا بل تخصيصًا: «أحمد» و«أحمد
    // صلاح». وهو أجدر بالعرض من فرق حرفين، فنعرضه بسببه الخاصّ.
    const contains = names.some((n) => n.includes(target) || target.includes(n));
    if (best <= NEAR) {
      near.push({ row, distance: best, why: `الفرق ${best === 1 ? 'حرف واحد' : `${best} حروف`}` });
    } else if (contains) {
      near.push({ row, distance: NEAR + 1, why: 'الاسم ده جزءٌ من اسمٍ عندك' });
    }
  }

  near.sort((a, b) => a.distance - b.distance);
  return { exact: null, near };
}

/** قرارٌ واحد بالشكل الذي تقرؤه المعاينة وتنفّذه `apply.js`. */
function decision({ id, kind, label, action, targetId = null, why = '', alternatives = [], data = null, include = true }) {
  return { id, kind, label, include, action, targetId, why, alternatives, data };
}

/** بديلٌ معروض — بلا كائن الصفّ كاملًا: المعاينة تحتاج اسمًا ومعرّفًا. */
const alt = (id, label, why) => ({ id, label, why });

/* ------------------------------------------------------------------ *
 * الخطّة
 * ------------------------------------------------------------------ */

/**
 * يبني خطّة استيرادٍ من حزمةٍ مقروءة، مقارنةً بما في قاعدتك الآن.
 *
 * ⚠️ **لا تكتب شيئًا.** تُستدعى قبل المعاينة، وتُستدعى ثانيةً بعد كل
 *    تعديلٍ يدوي — فلا يجوز أن يكون لها أثر.
 *
 * @param {object} pkg مخرَج `parsePackage(...).pkg`
 * @returns {Promise<object>} الخطّة
 */
export async function planImport(pkg) {
  if (!pkg) throw new Error('مفيش حزمة نخطّط لها');

  const [existingPeople, existingTypes, existingThreads, allScenes] = await Promise.all([
    listPeople({ includeArchived: true }),
    listTypes({ includeArchived: true }),
    listThreads({ includeArchived: true }),
    scenes.getActive(),
  ]);

  /* ---- الذكرى ---- */

  const sceneTitle = normalize(pkg.scene.title);
  const duplicates = allScenes
    .filter((s) => normalize(s.titleAr || '') === sceneTitle)
    .map((s) => ({
      id: s.id,
      label: s.titleAr,
      date: s.date || '',
      why: pkg.scene.date && s.date === pkg.scene.date
        ? 'نفس العنوان ونفس التاريخ'
        : 'نفس العنوان بتاريخٍ تاني',
    }));

  /*
   * ردُّ طلبِ تحليل *(WS6-ب)* يحمل معرّف الذكرى التي خرج من أجلها.
   *
   * ⚠️ **وهذا استثناءٌ من «الافتراض إنشاء» بسببٍ لا بتساهل**: القاعدة
   *    موضوعةٌ لأن مطابقة الاسم تخمين — وذكريتان بنفس العنوان شيئان
   *    مختلفان. أمّا المعرّف فهو الذكرى نفسها التي ضغطتَ «حلّلها» وأنت
   *    فيها، فلا تخمينَ يُخشى.
   *
   *    ويبقى ظاهرًا في المعاينة قابلًا للتغيير، فلا شيء يتخطّى عينك.
   */
  const origin = pkg.forSceneId
    ? allScenes.find((s) => s.id === pkg.forSceneId)
    : null;

  const scene = decision({
    id: 'scene',
    kind: 'scene',
    label: pkg.scene.title,
    // ⚠️ الافتراض إنشاءٌ دائمًا فيما عدا ذلك. الكتابة داخل ذكرى موجودة
    //    قرارٌ لك، لأن حزمةً تُكتب في الذكرى الخطأ تخلط حياتين لا
    //    تُفرَّقان بعدها بسهولة.
    action: origin ? ACTION.ATTACH : ACTION.CREATE,
    targetId: origin ? origin.id : null,
    why: origin
      ? 'ده ردّ على طلب تحليل للذكرى دي — هيتكتب جوّاها'
      : duplicates.length
        ? `فيه ${duplicates.length === 1 ? 'ذكرى' : `${duplicates.length} ذكريات`} بنفس العنوان — بصّ قبل ما تكمّل`
        : 'ذكرى جديدة',
    alternatives: duplicates
      .filter((d) => d.id !== origin?.id)
      .map((d) => alt(d.id, `${d.label}${d.date ? ` · ${d.date}` : ''}`, d.why)),
    data: pkg.scene,
  });

  /* ---- نوع الحدث ---- */

  const eventType = planType(pkg.scene.eventType, existingTypes);

  /* ---- الأشخاص ---- */

  const people = pkg.people.map((person, index) =>
    planPerson(`people.${index}`, person, existingPeople, 'الحزمة عرّفته')
  );

  /*
   * متحدّثون تكلّموا ولم تُعرِّفهم الحزمة.
   *
   * لا شيء يضيع إن لم تُنشِئهم: اسم المتحدّث يُحفظ نصًّا كما هو اليوم،
   * والربط ممكن لاحقًا من «مين بيتكلم». فيدخلون الخطّة **غير
   * مُحدَّدين** — عرضٌ لا فرض.
   */
  const declared = new Set(people.map((p) => normalize(p.label)));
  const extraSpeakers = [];
  for (const part of pkg.conversationParts) {
    const name = (part.speaker || '').trim();
    if (!name || part.isMine) continue;
    const key = normalize(name);
    if (!key || declared.has(key)) continue;
    declared.add(key);
    const entry = planPerson(
      `speakers.${extraSpeakers.length}`,
      { name },
      existingPeople,
      'اتكلّم في المحادثة والحزمة ما عرّفتوش'
    );
    // المطابق التامّ يُستعمَل بلا سؤال؛ غير المطابق يُترك لك.
    if (entry.action === ACTION.CREATE) entry.include = false;
    extraSpeakers.push(entry);
  }

  /* ---- الخيط ---- */

  let eventThread = null;
  if (pkg.eventThread) {
    const { exact, why, near } = matchName(
      pkg.eventThread.title,
      existingThreads,
      (t) => [t.title]
    );
    eventThread = decision({
      id: 'eventThread',
      kind: 'eventThread',
      label: pkg.eventThread.title,
      action: exact ? ACTION.USE_EXISTING : ACTION.CREATE,
      targetId: exact ? exact.id : null,
      why: exact ? `${why} — الذكرى هتتضاف للخيط ده` : 'خيط جديد',
      alternatives: exact ? [] : near.map((n) => alt(n.row.id, n.row.title, n.why)),
      data: pkg.eventThread,
    });
  }

  /* ---- التعبيرات ---- */

  const expressionRows = (await expressions.getAll()).filter((e) => e.state === STATE.ACTIVE);
  const byNormalized = new Map(expressionRows.map((e) => [e.normalizedText, e]));

  const expressionPlans = pkg.expressions.map((expression, index) => {
    const key = normalize(expression.text);
    const hit = byNormalized.get(key);
    return decision({
      id: `expressions.${index}`,
      kind: 'expression',
      label: expression.text,
      /*
       * ⚠️ التعبير كيانٌ عالميّ واحد بحكم `normalizedText`: تكراره
       *    ظهورٌ جديد لا نسخةٌ ثانية. فليس هذا قرارًا نعرضه عليك بل
       *    نموذج التعبيرات نفسه — وهو ما يجعل حياة التعبير ممكنة.
       */
      action: hit ? ACTION.USE_EXISTING : ACTION.CREATE,
      targetId: hit ? hit.id : null,
      why: hit ? 'عندك بالفعل — هيتسجّل ظهورٌ جديد في الذكرى دي' : 'تعبير جديد',
      data: expression,
    });
  });

  /* ---- ما لا قرار فيه: أبناء الذكرى ---- */

  const scripts = pkg.scripts.map((script, index) =>
    decision({
      id: `scripts.${index}`,
      kind: 'script',
      label: script.title,
      action: ACTION.CREATE,
      why: 'جزء من الذكرى',
      data: script,
    })
  );

  const conversationParts = pkg.conversationParts.map((part, index) =>
    decision({
      id: `conversationParts.${index}`,
      kind: 'conversationPart',
      label: part.text,
      action: ACTION.CREATE,
      why: part.speaker ? `${part.isMine ? 'أنا' : part.speaker}` : 'جزء من المحادثة',
      data: part,
    })
  );

  const mistakes = pkg.mistakes.map((mistake, index) =>
    decision({
      id: `mistakes.${index}`,
      kind: 'mistake',
      label: `${mistake.wrong} ← ${mistake.natural}`,
      action: ACTION.CREATE,
      why: 'تصحيح',
      data: mistake,
    })
  );

  const plan = {
    scene,
    eventType,
    people,
    extraSpeakers,
    eventThread,
    scripts,
    conversationParts,
    mistakes,
    expressions: expressionPlans,
    /** ما أعلنت `parse.js` أننا لا نستوعبه — يُحمَل إلى المعاينة كما هو. */
    cannotAbsorb: pkg.skipped || [],
    counts: packageCounts(pkg),
  };

  plan.summary = summarize(plan);
  return plan;
}

/** قرار نوع الحدث — منفصلٌ لأن الاختبار يستدعيه وحده. */
function planType(incoming, existingTypes) {
  const label = (incoming || '').trim();
  if (!label) {
    return decision({
      id: 'eventType',
      kind: 'eventType',
      label: '',
      action: ACTION.USE_EXISTING,
      targetId: 'other',
      why: 'الحزمة ما ذكرتش نوعًا — «أخرى»',
    });
  }

  const { exact, why, near } = matchName(label, existingTypes, (t) => [t.label, ...(t.aliases || [])]);
  return decision({
    id: 'eventType',
    kind: 'eventType',
    label,
    action: exact ? ACTION.USE_EXISTING : ACTION.CREATE,
    targetId: exact ? exact.id : null,
    why: exact ? why : 'نوع جديد',
    alternatives: exact ? [] : near.map((n) => alt(n.row.id, n.row.label, n.why)),
    data: { label },
  });
}

/** قرار شخصٍ واحد. */
function planPerson(id, person, existingPeople, source) {
  const { exact, why, near } = matchName(person.name, existingPeople, (p) => [
    p.name, p.nameRu, p.nameAr, ...(p.aliases || []),
  ]);

  return decision({
    id,
    kind: 'person',
    label: person.name,
    action: exact ? ACTION.USE_EXISTING : ACTION.CREATE,
    targetId: exact ? exact.id : null,
    why: exact ? `${why} — ${source}` : `شخص جديد — ${source}`,
    /*
     * ⚠️ المتقارب بديلٌ معروض لا قرارٌ مُتَّخَذ. «أحمد» و«أحمد صلاح»
     *    قد يكونان واحدًا وقد لا يكونان، والآلة لا تعرف.
     */
    alternatives: exact ? [] : near.map((n) => alt(n.row.id, n.row.name, n.why)),
    data: person,
  });
}

/* ------------------------------------------------------------------ *
 * التعديل اليدوي
 * ------------------------------------------------------------------ */

/** كل القرارات في الخطّة مصفوفةً واحدة — للبحث والعدّ. */
export function allDecisions(plan) {
  return [
    plan.scene,
    plan.eventType,
    ...plan.people,
    ...plan.extraSpeakers,
    ...(plan.eventThread ? [plan.eventThread] : []),
    ...plan.scripts,
    ...plan.conversationParts,
    ...plan.mistakes,
    ...plan.expressions,
  ].filter(Boolean);
}

/**
 * يغيّر قرارًا واحدًا بمعرّفه.
 *
 * ⚠️ يعيد **خطّةً جديدة** ولا يعدّل القديمة: المعاينة تعرض حالةً
 *    واحدة في كل لحظة، والتعديل في المكان يجعل «تراجَع» مستحيلًا.
 *
 * @param {object} plan
 * @param {string} id معرّف القرار (`people.0`, `eventType`, `scene`…)
 * @param {{include?: boolean, action?: string, targetId?: string|null}} change
 */
export function decide(plan, id, change) {
  const target = allDecisions(plan).find((d) => d.id === id);
  if (!target) throw new Error(`مفيش قرار اسمه «${id}»`);

  if (change.action && !Object.values(ACTION).includes(change.action)) {
    throw new Error(`فعل مش معروف: «${change.action}»`);
  }
  if (change.action === ACTION.USE_EXISTING || change.action === ACTION.ATTACH) {
    const to = change.targetId ?? target.targetId;
    if (!to) throw new Error('لازم تحدّد على إيه بالظبط');
  }
  if (change.action === ACTION.ATTACH && target.kind !== 'scene') {
    throw new Error('الإلحاق للذكرى وحدها');
  }

  const next = { ...target, ...change };
  // فعلٌ صار إنشاءً لا هدف له.
  if (next.action === ACTION.CREATE) next.targetId = null;

  const replace = (d) => (d && d.id === id ? next : d);
  const plan2 = {
    ...plan,
    scene: replace(plan.scene),
    eventType: replace(plan.eventType),
    people: plan.people.map(replace),
    extraSpeakers: plan.extraSpeakers.map(replace),
    eventThread: replace(plan.eventThread),
    scripts: plan.scripts.map(replace),
    conversationParts: plan.conversationParts.map(replace),
    mistakes: plan.mistakes.map(replace),
    expressions: plan.expressions.map(replace),
  };

  plan2.summary = summarize(plan2);
  return plan2;
}

/* ------------------------------------------------------------------ *
 * الحصيلة
 * ------------------------------------------------------------------ */

/**
 * ماذا سيحدث فعلًا لو ضغطت «استورد» الآن.
 *
 * ⚠️ **يُحسَب من القرارات لا من الحزمة.** رقمٌ يقول «١٨ تعبيرًا» ثم
 *    يُكتب أحدَ عشر لأنك استبعدت سبعة هو كذبٌ مرقَّم (بند 89).
 */
export function summarize(plan) {
  const kept = allDecisions(plan).filter((d) => d.include);
  const created = {};
  const reused = {};

  for (const d of kept) {
    // الذكرى المُلحَقة ليست إنشاءً ولا إعادةَ استعمالٍ لكيان — هي وعاء.
    if (d.kind === 'scene' && d.action === ACTION.ATTACH) continue;
    const bucket = d.action === ACTION.CREATE ? created : reused;
    bucket[d.kind] = (bucket[d.kind] || 0) + 1;
  }

  const excluded = allDecisions(plan).filter((d) => !d.include).length;

  return {
    created,
    reused,
    excluded,
    /** هل في الخطّة ما يُكتب أصلًا؟ */
    empty: kept.length === 0,
    /** ما لا يستوعبه التطبيق — مُعلَنًا لا مبتلَعًا. */
    cannotAbsorb: plan.cannotAbsorb.length,
  };
}

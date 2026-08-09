/**
 * LingoLife — تنفيذ خطّة الاستيراد
 *
 * الطبقة الثالثة والأخيرة: `parse` تسأل عن الشكل، و`plan` تسأل عن
 * العلاقة بما عندك، وهذه **تكتب**. ولا تقرّر شيئًا: كل فعلٍ هنا مكتوبٌ
 * في الخطّة، وما ليس فيها لا يحدث.
 *
 * ═══════════════════════════════════════════════════════════════
 * ثلاث قواعد
 * ═══════════════════════════════════════════════════════════════
 *
 * **١. عبر الخدمات لا فوقها.**
 *
 * كل كتابةٍ تمرّ بـ`createScene` و`addPerson` و`addType` و`addScript`
 * و`addExpression`… لا بالمستودعات مباشرةً. لأن الخدمات تحمل ما لا
 * تراه: الذكرى تُنشئ معها كتلة النصّ الأصلي، والسكريبت يُنشئ نسخته
 * الأولى في التاريخ، والتعبير كيانٌ عالميّ يُسجَّل له ظهور. استيرادٌ
 * يكتب في المستودع مباشرةً يُنتج صفوفًا **ناقصةً بصمت** — تبدو سليمة
 * حتى تفتحها.
 *
 * **٢. إمّا كلّه وإمّا لا شيء.**
 *
 * IndexedDB هنا لا يعطينا معاملةً واحدة تلفّ عشرات الكتابات عبر
 * الخدمات. فنمسك **دفترًا** بكل ما كتبناه، وعند أي فشلٍ نتراجع عنه
 * بالعكس. والدفتر يسجّل ما أنشأناه نحن وحده — لا يُمحى صفٌّ كان
 * موجودًا قبلنا أبدًا.
 *
 * **٣. التقرير يقول ما حدث لا ما نويناه.**
 *
 * يُبنى من الدفتر — أي ممّا كُتب فعلًا — لا من الخطّة. فلو فشل نصف
 * الاستيراد فالتقرير يقوله (بند 89).
 */

import { createScene } from '../scene-service.js';
import { addPerson } from '../person-service.js';
import { addType } from '../type-service.js';
import {
  createThread, addSceneToThread, threadsOfScene, getThread,
  THREAD_STATUS, THREAD_STATUS_LABEL,
} from '../thread-service.js';
import {
  addScript,
  addConversationPart,
  addMistake,
  addExpression,
  ensureConversation,
  REGISTERS,
  MISTAKE_TYPES,
} from '../content-service.js';
import {
  scenes, people, eventTypes, eventThreads, scripts, scriptVersions,
  contentBlocks, conversations, conversationParts, mistakeComparisons,
  expressions, expressionOccurrences, relationships,
} from '../../db/repositories.js';
import { normalize } from '../../utils/normalization.js';
import { ACTION, allDecisions } from './plan.js';

/** المستودع الذي يملك كل نوعٍ في الدفتر — لا تخمين عند التراجع. */
const REPO = {
  scene: scenes,
  person: people,
  eventType: eventTypes,
  eventThread: eventThreads,
  script: scripts,
  scriptVersion: scriptVersions,
  contentBlock: contentBlocks,
  conversation: conversations,
  conversationPart: conversationParts,
  mistake: mistakeComparisons,
  expression: expressions,
  occurrence: expressionOccurrences,
  relationship: relationships,
};

/**
 * دفتر ما كُتب — أساس التراجع وأساس التقرير معًا.
 *
 * ⚠️ عمدًا شيءٌ واحد لا شيئان: تقريرٌ يُبنى من مصدرٍ غير الذي يُتراجَع
 *    عنه يفترقان عند أول خطأ، فيقول التقرير «كُتب» عمّا مُحي.
 */
function ledger() {
  const written = [];
  const restores = [];

  return {
    /** يسجّل صفًّا أنشأناه. */
    add(kind, id) {
      if (id) written.push({ kind, id });
      return id;
    },
    /** يسجّل حقلًا غيّرناه في صفٍّ **كان موجودًا** — بقيمته السابقة. */
    revert(kind, id, patch) {
      restores.push({ kind, id, patch });
    },
    get rows() {
      return written;
    },
    counts() {
      const out = {};
      for (const { kind } of written) out[kind] = (out[kind] || 0) + 1;
      return out;
    },
    ids(kind) {
      return written.filter((r) => r.kind === kind).map((r) => r.id);
    },
    /**
     * يمحو ما كتبناه بالعكس، ويعيد ما غيّرناه.
     *
     * ⚠️ `destroy` لا `trash`: هذه صفوفٌ لم توجد قبل دقيقة، ووضعها في
     *    السلة يعني أن استيرادًا فشل يترك لك قمامةً تنظّفها بيدك.
     */
    async rollback() {
      for (const { kind, id, patch } of restores) {
        await REPO[kind]?.update(id, patch).catch(() => {});
      }
      for (let i = written.length - 1; i >= 0; i--) {
        const { kind, id } = written[i];
        await REPO[kind]?.destroy(id).catch(() => {});
      }
      written.length = 0;
    },
  };
}

/** قيمةٌ من قائمةٍ معروفة أو الافتراضيّة — مع إعلان ما رُفض. */
function fromList(value, list, fallback, notes, what) {
  if (!value) return fallback;
  if (list.some((row) => row.id === value)) return value;
  // ⚠️ قيمةٌ مجهولة تُكتب كما هي تُنتج شارةً فارغة في الشاشة: تصنيفٌ
  //    بلا اسم. فنردّها للافتراضيّ ونقول ذلك.
  notes.push(`${what} «${value}» مش معروف عندنا — اتسجّل «${fallback}»`);
  return fallback;
}

/**
 * ينفّذ خطّةً.
 *
 * @param {object} plan مخرَج `planImport`
 * @param {object} [pkg] الحزمة الأصلية — لبيانات التحليل في التقرير فقط
 * @returns {Promise<object>} التقرير
 */
export async function applyImport(plan, pkg = null) {
  if (!plan) throw new Error('مفيش خطّة ننفّذها');

  const book = ledger();
  const notes = [];
  /** الاسم المطبَّع ← معرّف الشخص، لنسب أجزاء المحادثة. */
  const personByName = new Map();

  try {
    /* ---- ١. نوع الحدث: يُشار إليه فيُنشأ أوّلًا ---- */

    const typeDecision = plan.eventType;
    let typeId = 'other';
    if (typeDecision.include) {
      if (typeDecision.action === ACTION.CREATE) {
        const created = await addType({ label: typeDecision.label });
        typeId = book.add('eventType', created.id);
      } else {
        typeId = typeDecision.targetId || 'other';
      }
    }

    /* ---- ٢. الأشخاص ---- */

    for (const decision of [...plan.people, ...plan.extraSpeakers]) {
      if (!decision.include) continue;
      const key = normalize(decision.label);

      if (decision.action === ACTION.CREATE) {
        const person = await addPerson({
          name: decision.data.name,
          nameRu: decision.data.nameRu || '',
          role: decision.data.role || '',
          company: decision.data.company || '',
          isMe: Boolean(decision.data.isMine),
        });
        book.add('person', person.id);
        personByName.set(key, person.id);
      } else if (decision.targetId) {
        personByName.set(key, decision.targetId);
      }
    }

    /* ---- ٣. الذكرى ---- */

    let sceneId;
    if (plan.scene.action === ACTION.ATTACH) {
      sceneId = plan.scene.targetId;
      const target = await scenes.get(sceneId);
      // ⚠️ الخطّة بُنيت على القاعدة قبل لحظات؛ قد تكون الذكرى حُذفت
      //    بينهما. الكتابة في معرّفٍ لا صاحب له تُنتج أيتامًا لا تظهر
      //    في شاشة.
      if (!target) throw new Error('الذكرى اللي هتلحق بيها مش موجودة');
    } else {
      const scene = await createScene({
        titleAr: plan.scene.data.title,
        titleRu: plan.scene.data.titleRu || '',
        date: plan.scene.data.date || undefined,
        type: typeId,
        placeName: plan.scene.data.placeName || '',
        context: plan.scene.data.context || '',
      });
      sceneId = book.add('scene', scene.id);
      // `createScene` تُنشئ معها كتلة النصّ الأصلي — وهي من كتابتنا،
      // فتدخل الدفتر أو تبقى يتيمةً عند التراجع.
      for (const block of await contentBlocks.byIndex('sceneId', sceneId)) {
        book.add('contentBlock', block.id);
      }
    }

    /* ---- ٤. الخيط ---- */

    if (plan.eventThread?.include) {
      let threadId = plan.eventThread.targetId;

      /*
       * ⚠️ حزمةٌ تُلحَق بخيطٍ عندك وتحمل حالةً مخالفة لحالته.
       *
       * لا نغيّرها: إقفال قضيّةٍ لأن ملفًّا قال ذلك تغييرٌ في **معنى**
       *    حياتك لا إضافةٌ إليها، وهو خارج ما وافقتَ عليه في المعاينة
       *    («نقترح ولا ندمج»).
       *
       *    ولا نسكت عنها أيضًا: الصمت يجعلك تظنّ أن الخيط أُقفل وهو
       *    مفتوح، فيظلّ يظهر في «لسه مكمّلة» وأنت تحسبه منتهيًا. فتُقال
       *    في التقرير وتُقفلها بنفسك إن كان ذلك صحيحًا.
       */
      if (plan.eventThread.action === ACTION.USE_EXISTING && threadId) {
        const incoming = THREAD_STATUS[String(plan.eventThread.data.status || '').toUpperCase()];
        const current = await getThread(threadId);
        if (incoming && current && incoming !== current.status) {
          notes.push(
            `الخيط «${current.title}» عندك حالته «${THREAD_STATUS_LABEL[current.status]}» ` +
            `والحزمة بتقول «${THREAD_STATUS_LABEL[incoming]}» — ما غيّرناهاش، غيّرها بنفسك لو ده صح`
          );
        }
      }

      if (plan.eventThread.action === ACTION.CREATE) {
        const thread = await createThread({
          title: plan.eventThread.data.title,
          description: plan.eventThread.data.description || '',
          status: THREAD_STATUS[String(plan.eventThread.data.status || '').toUpperCase()]
            || THREAD_STATUS.ACTIVE,
          startDate: plan.scene.data.date || undefined,
        });
        threadId = book.add('eventThread', thread.id);
      }
      if (threadId) {
        // ⚠️ `link` تعيد الرابط الموجود إن وُجد. إلحاقٌ بذكرى هي أصلًا
        //    في الخيط يعني أننا لم نُنشئ شيئًا — وتسجيلها في الدفتر
        //    يعني محوَ عضويّةٍ سابقةٍ لنا عند التراجع.
        const before = await threadsOfScene(sceneId);
        const already = before.some((t) => t.id === threadId);
        const relation = await addSceneToThread(threadId, sceneId);
        // العضويّة علاقةٌ لا حقل — فالتراجع عنها محوُ العلاقة وحدها،
        // ولا يمسّ الذكرى ولا الخيط.
        if (!already) book.add('relationship', relation?.id);
      }
    }

    /* ---- ٥. السكريبتات ---- */

    for (const decision of plan.scripts) {
      if (!decision.include) continue;
      const script = await addScript(sceneId, {
        title: decision.data.title,
        text: decision.data.text,
        sceneType: typeId,
      });
      book.add('script', script.id);
      for (const version of await scriptVersions.byIndex('scriptId', script.id)) {
        book.add('scriptVersion', version.id);
      }
    }

    /* ---- ٦. المحادثة ---- */

    const wantsConversation = plan.conversationParts.some((d) => d.include);
    if (wantsConversation) {
      const existing = await conversations.oneByIndex('sceneId', sceneId);
      const conversation = await ensureConversation(sceneId);
      // لا نسجّلها في الدفتر إلا إن كنّا نحن مَن أنشأها: الإلحاق بذكرى
      // لها محادثة سابقة يجب ألّا يمحوها عند التراجع.
      if (!existing) book.add('conversation', conversation.id);
    }

    for (const decision of plan.conversationParts) {
      if (!decision.include) continue;
      const speaker = (decision.data.speaker || '').trim();
      const part = await addConversationPart(sceneId, {
        speaker,
        text: decision.data.text,
        translation: decision.data.translation || '',
        isMine: decision.data.isMine,
        // ⚠️ `speaker` يبقى نصًّا كما جاء حتى لو عرفنا صاحبه: الأوّل ما
        //    قيل، والثاني مَن نظنّه. راجع `addConversationPart`.
        personId: decision.data.isMine ? null : personByName.get(normalize(speaker)) || null,
      });
      book.add('conversationPart', part.id);
    }

    /* ---- ٧. التصحيحات ---- */

    for (const decision of plan.mistakes) {
      if (!decision.include) continue;
      const mistake = await addMistake(sceneId, {
        wrong: decision.data.wrong,
        natural: decision.data.natural,
        explanation: decision.data.explanation || '',
        mistakeType: fromList(
          decision.data.mistakeType, MISTAKE_TYPES, 'other', notes, 'نوع التصحيح'
        ),
      });
      book.add('mistake', mistake.id);
    }

    /* ---- ٨. التعبيرات ---- */

    for (const decision of plan.expressions) {
      if (!decision.include) continue;

      const meaning = decision.data.meaningAr || '';
      // تعبيرٌ عندك بلا معنًى مكتوب، والحزمة تحمل معنًى: `addExpression`
      // تملؤه. وهو تغييرٌ في صفٍّ سابقٍ لنا، فنحفظ قيمته للرجوع.
      if (decision.action === ACTION.USE_EXISTING && meaning && decision.targetId) {
        const current = await expressions.get(decision.targetId);
        if (current && !current.meaningAr) {
          book.revert('expression', current.id, { meaningAr: current.meaningAr || '' });
        }
      }

      const before = decision.action === ACTION.CREATE
        ? []
        : await expressionOccurrences.byIndex('sceneId', sceneId);

      const { expression, isNew } = await addExpression(sceneId, {
        text: decision.data.text,
        meaningAr: meaning,
        register: fromList(
          decision.data.register, REGISTERS, 'professional', notes, 'تصنيف التعبير'
        ),
        note: decision.data.note || '',
      });
      if (isNew) book.add('expression', expression.id);

      const seen = new Set(before.map((o) => o.id));
      for (const occurrence of await expressionOccurrences.byIndex('sceneId', sceneId)) {
        if (!seen.has(occurrence.id)) book.add('occurrence', occurrence.id);
      }
    }

    return report({ ok: true, plan, book, notes, sceneId, pkg });
  } catch (error) {
    /*
     * ⚠️ التراجع أوّلًا ثم الإبلاغ. فشلٌ في منتصف الاستيراد يترك ذكرى
     *    بنصف محادثةٍ وبلا تعبيرات — وهي أسوأ من لا شيء: تظنّها كاملة
     *    فلا تُعيد الاستيراد، ويضيع نصفها بلا أن تعرف.
     */
    const partial = book.counts();
    await book.rollback();
    return {
      ...report({ ok: false, plan, book, notes, sceneId: null, pkg }),
      failed: error.message || String(error),
      rolledBack: true,
      undone: partial,
    };
  }
}

/** تقريرٌ يُبنى من الدفتر — ممّا كُتب فعلًا لا ممّا نُوِيَ. */
function report({ ok, plan, book, notes, sceneId, pkg }) {
  const decisions = allDecisions(plan);
  return {
    ok,
    sceneId,
    /** كم صفًّا أُنشئ من كل نوع — من الدفتر. */
    written: book.counts(),
    /** ما استُعمل ممّا عندك بلا إنشاء. */
    reused: decisions
      .filter((d) => d.include && d.action === ACTION.USE_EXISTING)
      .reduce((out, d) => ({ ...out, [d.kind]: (out[d.kind] || 0) + 1 }), {}),
    /** ما استبعدته أنت. */
    excluded: decisions.filter((d) => !d.include).length,
    /** ما لا يستوعبه التطبيق — بأسبابه، كما أعلنتها القراءة. */
    cannotAbsorb: plan.cannotAbsorb || [],
    /** تنبيهات لا تمنع: قيمةٌ مجهولة رُدَّت لافتراضيّها. */
    notes,
    /**
     * بيانات التحليل تُحفظ **هنا** لا في القاعدة: هي معلوماتٌ عن
     * الاستيراد نفسه، لا عن ذكرياتك. راجع `NOT_SUPPORTED`.
     */
    analysisMetadata: pkg?.analysisMetadata || null,
    failed: null,
    rolledBack: false,
  };
}

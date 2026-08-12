/**
 * LingoLife — أوجه الإثراء: سجلٌّ لا قائمةُ حقول
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا سجلٌّ أصلًا، ولماذا هذا هو جوهر الاستوديو
 * ═══════════════════════════════════════════════════════════════
 *
 * النموذج يكبر. أُضيف «المشاركون» في WS9، وسيُضاف المكان ككيان،
 * والموضوع، والمشروع. وفي كل مرّة يحدث الشيء نفسه بالضبط:
 *
 *   **مئات الذكريات القديمة تصير ناقصةً بأثرٍ رجعيّ** — لا لأنك
 *   قصّرت، بل لأن التطبيق لم يكن يعرف أن يسأل.
 *
 * والحلّ الرديء أن تُكتب شاشةُ تعديلٍ جماعيّ تعرف حقولها بالاسم.
 * فتُضاف ميزةٌ فتُعدَّل الشاشة، وتُنسى مرّةً فيبقى الحقل فارغًا إلى
 * الأبد بلا أن يقول أحدٌ إنه فارغ.
 *
 * فالوجه هنا **إعلانٌ يُسجَّل**، لا حالةٌ في `switch`. وإعلانُه يجيب
 * عن أربعة أسئلة، ومَن يضيف حقلًا غدًا لا يحتاج أن يلمس شاشةً:
 *
 *  1. **متى دخل النموذج؟** (`since`) — فيُقال للمستخدم إن الفراغ
 *     أثرُ تطوّرٍ لا أثرُ إهمال. وهذا هو Part L حرفيًّا: التطبيق لا
 *     يقول «كان لازم تلتقط ده من الأول».
 *  2. **كيف يُكشف غيابه؟** (`missing`) — من عالمٍ مقروءٍ مرّةً
 *     واحدة، لا باستعلامٍ لكل ذكرى.
 *  3. **أيّ دليلٍ عندنا بالفعل؟** (`evidence`) — وهو ما يجعل ملء
 *     مئةِ ذكرى ممكنًا أصلًا: أن يأتيك السياق بدل أن تفتح كلَّ واحدة
 *     لتتذكّر ما فيها.
 *  4. **كيف يُملأ، وكيف يُتراجَع عنه؟** (`apply`) — والتراجع شرطٌ
 *     لا تحسين: الكتابة هنا تمسّ مئات الصفوف دفعةً واحدة.
 *
 * ═══════════════════════════════════════════════════════════════
 * وما لا يُملأ دفعةً — مُعلَنٌ لا مسكوتٌ عنه
 * ═══════════════════════════════════════════════════════════════
 *
 * على نفس مبدأ `NOT_SUPPORTED` في الاستيراد و`ABSENT_AXES` في الأطلس
 * و`UNBUILT` في اللغة و`NOT_MEASURED` في التحليل: ما نرفض فعله يُقال
 * **بسببه**. راجع `NOT_BULK_EDITABLE` في آخر الملف — واختبارٌ يمنع
 * دخول مدخلٍ فيه بلا سبب.
 */

import { STATE } from '../../db/schema.js';
import { updateScene } from '../scene-service.js';
import { SCENE_PERSON, addParticipant, removeParticipant } from '../participant-service.js';
import { THREAD_SCENE, addSceneToThread, removeSceneFromThread } from '../thread-service.js';
import { typeLabel } from '../type-service.js';

/**
 * كيف تُقرأ القيمة الجديدة:
 *
 *   `SET` — تحلّ محلّ القائم. المكان والنوع: للذكرى مكانٌ واحد.
 *   `ADD` — تُضاف إلى القائم. المشاركون والخيوط: عضويّاتٌ تتجمّع.
 *
 * ⚠️ والفرق ليس شكليًّا: التراجع عن `SET` إعادةُ القيمة القديمة،
 *    والتراجع عن `ADD` محوُ ما أضفناه **وحده**. خلطُهما يعني أن
 *    تراجعًا يمحو عضويّةً كانت عندك قبل أن نلمس شيئًا.
 */
export const FILL = Object.freeze({ SET: 'set', ADD: 'add' });

/* ------------------------------------------------------------------ *
 * السجلّ
 * ------------------------------------------------------------------ */

/**
 * وجهُ إثراءٍ واحد.
 *
 * @typedef {object} Aspect
 * @property {string} id
 * @property {string} label            ما يُعرض
 * @property {string} why              ماذا يفتح ملؤه — لا وعظًا بل أثرًا
 * @property {string} since            متى دخل النموذج
 * @property {string} fill             `FILL.SET` أو `FILL.ADD`
 * @property {boolean} bulk            هل يصحّ إعطاء قيمةٍ واحدةٍ للكلّ
 * @property {object} input            كيف تُلتقط القيمة
 * @property {(scene, world) => boolean} missing
 * @property {(scene, world) => string} current   للعرض في المعاينة
 * @property {(scene, world) => object[]} evidence
 */

/** ذكرياتٌ فيها متكلّمون — يُشتقّ مرّة ويُقرأ كثيرًا. */
function speakersOf(scene, world) {
  return world.speakersByScene.get(scene.id) || [];
}

export const ASPECTS = Object.freeze([
  {
    id: 'participants',
    label: 'مين كان معاك',
    why: 'الأطلس والكوكبة بيقروا منه. الذكرى بلا مشاركين بتقع برّه خريطة ناسك.',
    since: 'WS9',
    fill: FILL.ADD,
    bulk: true,
    input: { kind: 'people' },

    /*
     * ⚠️ الغياب هنا غيابُ **إعلان** لا غيابُ ناس. ذكرى تكلّم فيها
     *    إيجور ليس فيها إعلانُ مشاركة — ومارينا التي صمتت ليست فيها
     *    أصلًا. فالنقص حقيقيّ ولو ظهر فيها اسم.
     */
    missing: (scene, world) => !(world.declaredByScene.get(scene.id) || []).length,

    current: (scene, world) => (world.declaredByScene.get(scene.id) || [])
      .map((id) => world.personName.get(id))
      .filter(Boolean)
      .join('، '),

    evidence: (scene, world) => {
      const spoke = speakersOf(scene, world)
        .map((id) => world.personName.get(id))
        .filter(Boolean);
      const out = [];
      if (spoke.length) out.push({ icon: 'chat', text: `اتكلّم هنا: ${spoke.join('، ')}` });
      const threads = (world.threadsByScene.get(scene.id) || [])
        .map((id) => world.threadTitle.get(id))
        .filter(Boolean);
      if (threads.length) out.push({ icon: 'link', text: `في قصّة: ${threads.join('، ')}` });
      return out;
    },
  },

  {
    id: 'place',
    label: 'المكان',
    why: 'محورُ مكانٍ في الأطلس بيتبني من النصّ ده. الفاضي مالوش محور.',
    since: 'WS4',
    fill: FILL.SET,
    bulk: true,
    input: { kind: 'text', suggest: 'places', placeholder: 'المكتب، العيادة، المخزن…' },

    missing: (scene) => !String(scene.placeName || '').trim(),
    current: (scene) => String(scene.placeName || '').trim(),

    evidence: (scene, world) => {
      const out = [];
      const type = typeLabel(scene.type);
      if (type) out.push({ icon: 'tag', text: `نوعها: ${type}` });
      const spoke = speakersOf(scene, world)
        .map((id) => world.personName.get(id))
        .filter(Boolean);
      if (spoke.length) out.push({ icon: 'person', text: `مع: ${spoke.join('، ')}` });
      return out;
    },
  },

  {
    id: 'type',
    label: 'نوع الموقف',
    why: 'النوع بيرتّب حياتك وبيغذّي التحليل. «غير محدّد» بيخلّي الذكرى مالهاش باب.',
    since: 'WS1',
    fill: FILL.SET,
    bulk: true,
    input: { kind: 'select', source: 'types' },

    /*
     * ⚠️ `other` نقصٌ لا اختيار. هو الافتراضيّ الذي يُكتب حين لا
     *    تختار، فوجودُه على ذكرى يعني غالبًا أنك لم تُسأل — لا أنك
     *    قلت «أخرى» عن قصد. ولذلك يظهر في العدّ، ولك أن تتركه.
     */
    missing: (scene) => !scene.type || scene.type === 'other',
    current: (scene) => typeLabel(scene.type) || '',

    evidence: (scene, world) => {
      const out = [];
      const place = String(scene.placeName || '').trim();
      if (place) out.push({ icon: 'place', text: `في: ${place}` });
      const spoke = speakersOf(scene, world)
        .map((id) => world.personName.get(id))
        .filter(Boolean);
      if (spoke.length) out.push({ icon: 'person', text: `مع: ${spoke.join('، ')}` });
      return out;
    },
  },

  {
    id: 'thread',
    label: 'القصّة',
    why: 'الخيط بيوصل الذكريات المتفرّقة في حكاية. الذكرى بره كل الخيوط بتفضل نقطة.',
    since: 'WS1',
    fill: FILL.ADD,
    bulk: true,
    input: { kind: 'select', source: 'threads' },

    missing: (scene, world) => !(world.threadsByScene.get(scene.id) || []).length,

    current: (scene, world) => (world.threadsByScene.get(scene.id) || [])
      .map((id) => world.threadTitle.get(id))
      .filter(Boolean)
      .join('، '),

    evidence: (scene, world) => {
      const out = [];
      const spoke = speakersOf(scene, world)
        .map((id) => world.personName.get(id))
        .filter(Boolean);
      if (spoke.length) out.push({ icon: 'person', text: `مع: ${spoke.join('، ')}` });
      const place = String(scene.placeName || '').trim();
      if (place) out.push({ icon: 'place', text: `في: ${place}` });
      return out;
    },
  },

  {
    id: 'context',
    label: 'السياق',
    why: 'السطر اللي بيفكّرك الذكرى دي كانت بتحصل ليه. بيظهر في البحث وفي حزمة التحليل.',
    since: 'v1',
    fill: FILL.SET,
    /*
     * ⚠️ **ولا يُملأ دفعةً واحدة.** السياق نثرٌ عن ذكرى بعينها،
     *    وكتابةُ جملةٍ واحدةٍ على أربعين ذكرى تصنع أربعين كذبةً
     *    متطابقة — وأسوأ من الفراغ حقلٌ مملوءٌ بما ليس صحيحًا، لأنك
     *    تصدّقه بعد شهر.
     *
     *    فيبقى في العدّ لتراه، ويأخذك الاستوديو إلى الذكريات نفسها.
     */
    bulk: false,
    bulkReason: 'السياق نثر عن ذكرى بعينها — جملة واحدة على أربعين ذكرى بتبقى أربعين كذبة متطابقة',
    input: { kind: 'none' },

    missing: (scene) => !String(scene.context || '').trim(),
    current: (scene) => String(scene.context || '').trim(),
    evidence: (scene, world) => {
      const spoke = speakersOf(scene, world)
        .map((id) => world.personName.get(id))
        .filter(Boolean);
      return spoke.length ? [{ icon: 'person', text: `مع: ${spoke.join('، ')}` }] : [];
    },
  },
]);

/** وجهٌ بمعرّفه. */
export function aspectById(id) {
  return ASPECTS.find((row) => row.id === id) || null;
}

/** الأوجه التي تقبل قيمةً واحدةً لدفعة. */
export function bulkAspects() {
  return ASPECTS.filter((row) => row.bulk);
}

/* ------------------------------------------------------------------ *
 * الكتابة — ومعها ما يلزم للتراجع
 * ------------------------------------------------------------------ */

/**
 * يكتب قيمة وجهٍ على ذكرى، ويسجّل في الدفتر ما يلزم للتراجع.
 *
 * ⚠️ **لا شيء يُكتب بلا قيدٍ في الدفتر.** كتابةٌ بلا قيد تعني صفًّا
 *    لا يعود التراجع يعرفه — وفي دفعةٍ من مئتين يكفي واحدٌ كهذا
 *    ليصير «تراجَع» كذبًا.
 *
 * ⚠️ **ولا يُقيَّد ما لم يُكتب.** عضويّةٌ كانت موجودة قبلنا لا تُسجَّل،
 *    وإلّا محاها تراجعُنا وهي ليست لنا. (نفس درس `apply.js` مع
 *    `addSceneToThread`.)
 *
 * @returns {Promise<boolean>} هل تغيّر شيءٌ فعلًا
 */
export async function applyAspect(aspect, scene, value, world, book) {
  switch (aspect.id) {
    case 'participants': {
      const already = new Set(world.declaredByScene.get(scene.id) || []);
      let touched = false;
      for (const personId of asList(value)) {
        if (already.has(personId)) continue;
        const relation = await addParticipant(scene.id, personId);
        if (relation?.id) {
          book.undo(() => removeParticipant(scene.id, personId));
          touched = true;
        }
      }
      return touched;
    }

    case 'thread': {
      const threadId = String(value || '').trim();
      if (!threadId) return false;
      const already = new Set(world.threadsByScene.get(scene.id) || []);
      if (already.has(threadId)) return false;
      const relation = await addSceneToThread(threadId, scene.id);
      if (!relation?.id) return false;
      book.undo(() => removeSceneFromThread(threadId, scene.id));
      return true;
    }

    case 'place': {
      const next = String(value || '').trim();
      const before = String(scene.placeName || '');
      if (next === before.trim()) return false;
      book.undo(() => updateScene(scene.id, { placeName: before }));
      await updateScene(scene.id, { placeName: next });
      return true;
    }

    case 'type': {
      const next = String(value || '').trim();
      if (!next || next === scene.type) return false;
      const before = scene.type;
      /*
       * ⚠️ الحقلان معًا — `updateScene` تكتبهما. والتراجع يمرّ بها
       *    أيضًا لا بـ`scenes.update`، وإلّا رجع أحدهما دون الآخر
       *    فرأى قارئان من جيلين نوعين مختلفين لذكرى واحدة (§3.6).
       */
      book.undo(() => updateScene(scene.id, { type: before }));
      await updateScene(scene.id, { type: next });
      return true;
    }

    default:
      // وجهٌ بلا كاتب لا يُكتب بصمت — يُقال.
      throw new Error(`«${aspect.label}» مالوش طريقة كتابة في الاستوديو`);
  }
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

/* ------------------------------------------------------------------ *
 * ما لا يُملأ دفعةً — بسببه
 * ------------------------------------------------------------------ */

/**
 * ما يرفض الاستوديو تعديله جماعيًّا، **ولكلٍّ سببه**.
 *
 * ⚠️ ليست هذه قائمةَ «لسه ما اتعملش». هذه أشياء **لا يصحّ** أن
 *    تُعدَّل دفعةً، وأداةٌ تسمح بها تكون قد سهّلت عليك إفساد ذاكرتك
 *    في ضغطةٍ واحدة. واختبارٌ يمنع دخول مدخلٍ هنا بلا سبب مكتوب.
 */
export const NOT_BULK_EDITABLE = Object.freeze({
  expressions: {
    label: 'التعبيرات والتصحيحات',
    reason: 'دي محتوى مش وصف. لو حطّينا تعبير على خمسين ذكرى، بقى كل ظهور بيقول إنك اتعلمته هناك — وده مش صحيح، وحياة التعبير كلها بتتبني على الظهورات دي',
  },
  rawTranscript: {
    label: 'النصّ الأصلي',
    reason: 'مقفول بالتصميم من أول يوم (بند 27). النصّ اللي كتبته وقتها ما بيتلمسش — لا فرديًّا ولا جماعيًّا',
  },
  identity: {
    label: 'العنوان والتاريخ',
    reason: 'دول هويّة الذكرى، اللي بتعرفها بيهم في كل شاشة. تغييرهم دفعة معناه إنك تفتح «حياتي» وما تعرفش أي ذكرى في أي',
  },
  context: {
    label: 'السياق والملاحظات',
    reason: 'نثر شخصي عن لحظة بعينها. جملة واحدة على أربعين ذكرى بتبقى أربعين كذبة متطابقة — والاستوديو بيعدّها ويوَدّيك لها بدل ما يملاها',
  },
  media: {
    label: 'الصور والتسجيلات',
    reason: 'ملفّات مربوطة بلحظتها. ربط صورة بذكريات كتير معناه إنها بقت في كذا مكان في نفس الوقت',
  },
});

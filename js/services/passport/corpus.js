/**
 * LingoLife — حزمة الكوربوس (WS15 · الملحق F3–F6)
 *
 * كل ما قيل ووُصف بالروسيّة في حياتك، **بمصدر كلِّ سطر**.
 *
 * ═══════════════════════════════════════════════════════════════
 * ولماذا ليست هي التصدير ولا النسخة الاحتياطيّة؟
 * ═══════════════════════════════════════════════════════════════
 *
 * ثلاثة أشياء تخرج من هذا التطبيق، ولكلٍّ سؤالٌ مختلف:
 *
 * | | السؤال | الشكل |
 * |---|---|---|
 * | `.llife` | «رجّعني لو ضاع كل شيء» | أرشيفٌ ذرّيّ بالوسائط |
 * | تصدير JSON | «ورّيني الصفوف» | صورةُ القاعدة |
 * | **الكوربوس** | «**دي لغتي — اشتغل عليها**» | سطورٌ بمصادرها |
 *
 * فالكوربوس ليس نسخةً من القاعدة، بل **استخلاصٌ منها**: النصّ الروسيّ
 * وحده، مصفوفًا، ولكل سطرٍ من أين جاء ومتى ومَن قاله.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ F6 — بنيةُ الدليل تُهيَّأ، والرأيُ لا يُلفَّق
 * ═══════════════════════════════════════════════════════════════
 *
 * الملحق يطلب هذا نصًّا. فالكوربوس **يحمل شواهد ولا يحمل استنتاجًا**:
 * لا «مستواك B1»، ولا «أكثر ما تخطئ فيه»، ولا نسبةً من أي نوع.
 *
 * وما يُرفَض عرضُه مكتوبٌ في `NO_INSIGHT` — لا في وثيقةٍ وحدها بل في
 * الحزمة نفسها، فيقرؤه مَن يفتحها بعد سنة.
 */

import {
  scenes, conversationParts, scripts, expressions, expressionOccurrences,
  savedItems, contentBlocks,
} from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { typeLabel } from '../type-service.js';
import { people } from '../../db/repositories.js';
import { toISODate } from '../../utils/dates.js';

/** إصدار صيغة الكوربوس. */
export const CORPUS_VERSION = 1;

/* ------------------------------------------------------------------ *
 * ما لا تحمله الحزمة — وسببه
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **F6 حرفيًّا.** كلُّ ما يلي يمكن حسابُه من الكوربوس في سطرين —
 *    ولا يُحسَب، لأن الرقم بلا تعريفٍ دقيق ليس معرفةً بل طمأنينةً
 *    كاذبة. وهي نفس قائمة `NOT_MEASURED` مطبَّقةً على ما يخرج.
 */
export const NO_INSIGHT = Object.freeze([
  {
    id: 'level',
    label: 'مستواك (A2 / B1 / …)',
    why: 'المستوى يُقاس باختبارٍ مصمَّم، لا بعدّ ما كتبتَه. وحرفٌ زائد في الحزمة لا يرفع مستواك، ونقصانُه لا يخفضه.',
  },
  {
    id: 'vocabulary-size',
    label: 'حجم مفرداتك',
    why: 'ما تلتقطه هو الصعب والمميّز؛ وما صار عاديًّا عندك لا تلتقطه أصلًا. فالعدّ يقيس العكس.',
  },
  {
    id: 'error-rate',
    label: 'نسبة أخطائك',
    why: 'الكسر بلا مقام ليس نسبة: الحزمة تحمل ما صحّحتَه، ولا تعرف كم جملةً قلتَها صحيحة.',
  },
  {
    id: 'frequency-ranking',
    label: '«أكتر كلمة بتستعملها»',
    why: 'أكثر ما يتكرّر في الكوربوس هو أدوات الربط. وترتيبٌ يتصدّره «и» و«не» معلومةٌ عن الروسيّة لا عنك.',
  },
  {
    id: 'timeline-verdict',
    label: 'تحسُّنٌ عبر الزمن',
    why: 'الحزمة تُظهر متى كتبتَ لا متى تعلّمت. وشهرٌ مزدحمٌ بالكتابة ليس شهرًا أفضل في اللغة.',
  },
]);

/* ------------------------------------------------------------------ *
 * مصادر السطور
 * ------------------------------------------------------------------ */

/**
 * من أين يجيء النصّ الروسيّ — ولكلٍّ **دليلُ منشئه**.
 *
 * إضافة مصدرٍ غدًا مدخلٌ هنا. والسطر بلا مصدرٍ لا يدخل الحزمة:
 * نصٌّ لا تعرف من أين جاء لا يصلح دليلًا على شيء.
 */
const SOURCES = [
  {
    id: 'said',
    label: 'اللي اتقال',
    weight: 1,
    /* ⚠️ أقوى مادّةٍ عندك: جملٌ سمعتَها أو قلتَها في موقفٍ حقيقيّ. */
    read: (world) => world.parts.map((row) => ({
      ru: row.text,
      ar: row.translation || '',
      by: row.isMine ? 'أنا' : (row.speaker || 'المتحدث'),
      mine: Boolean(row.isMine),
      sceneId: row.sceneId,
    })),
  },
  {
    id: 'rehearsed',
    label: 'اللي اتمرّنت عليه',
    weight: 2,
    read: (world) => world.scripts.map((row) => ({
      ru: row.text,
      ar: row.translation || '',
      by: 'سكريبت',
      mine: true,
      sceneId: row.sceneId,
    })),
  },
  {
    id: 'kept',
    label: 'اللي لقطته',
    weight: 3,
    read: (world) => world.saved.map((row) => ({
      ru: row.text,
      ar: row.translation || row.note || '',
      by: row.kind === 'word' ? 'كلمة' : 'جملة',
      mine: false,
      sceneId: row.sceneId || '',
    })),
  },
  {
    id: 'expression',
    label: 'التعبيرات',
    weight: 4,
    read: (world) => world.expressions.map((row) => ({
      ru: row.text,
      ar: row.meaningAr || '',
      by: row.register || 'تعبير',
      mine: false,
      sceneId: world.firstSceneOf.get(row.id) || '',
    })),
  },
  {
    id: 'transcript',
    label: 'النصّ الأصلي',
    weight: 5,
    /*
     * ⚠️ النصّ الأصليّ **فقرةٌ لا سطر**، ويدخل كما هو بلا تقطيع:
     *    تقطيعُه بالنقطة يكسر الحوار، وبالسطر يكسر الفقرة. ومَن يريد
     *    تقطيعه يقطّعه بمعرفته لا بتخميننا.
     */
    read: (world) => world.rawBlocks.map((row) => ({
      ru: row.text,
      ar: '',
      by: 'نصّ أصلي',
      mine: false,
      sceneId: row.sceneId,
    })),
  },
];

export const CORPUS_SOURCES = Object.freeze(
  SOURCES.map(({ id, label }) => ({ id, label }))
);

/* ------------------------------------------------------------------ *
 * القراءة
 * ------------------------------------------------------------------ */

/**
 * قراءةٌ **ثابتة العدد** — سبعُ قراءاتٍ مهما كان حجم عالمك.
 * وهو نفس مبدأ `readWorld` في الاستوديو، ولنفس السبب.
 */
async function readAll() {
  const [sceneRows, partRows, scriptRows, expressionRows, occurrenceRows,
    savedRows, blockRows, personRows] = await Promise.all([
    scenes.getActive(),
    conversationParts.getAll(),
    scripts.getAll(),
    expressions.getAll(),
    expressionOccurrences.getAll(),
    savedItems.getActive(),
    contentBlocks.getAll(),
    people.getAll(),
  ]);

  const live = new Map(sceneRows.map((row) => [row.id, row]));
  const active = (rows) => rows.filter((row) => row.state === STATE.ACTIVE);

  /* أوّل ذكرى ظهر فيها كل تعبير — منشؤه. */
  const firstSceneOf = new Map();
  for (const row of active(occurrenceRows)) {
    if (!live.has(row.sceneId)) continue;
    if (!firstSceneOf.has(row.expressionId)) firstSceneOf.set(row.expressionId, row.sceneId);
  }

  return {
    live,
    parts: active(partRows).filter((row) => live.has(row.sceneId) && row.text),
    scripts: active(scriptRows).filter((row) => live.has(row.sceneId) && row.text),
    expressions: active(expressionRows).filter((row) => row.text),
    saved: savedRows.filter((row) => row.text),
    rawBlocks: active(blockRows).filter((row) =>
      row.kind === 'rawTranscript' && live.has(row.sceneId) && String(row.text || '').trim()),
    firstSceneOf,
    personName: new Map(personRows.map((row) => [row.id, row.name])),
  };
}

/** سياقُ الذكرى كما يُعلَّق على كل سطر. */
function sceneContext(world, sceneId) {
  const scene = world.live.get(sceneId);
  if (!scene) return null;
  return {
    id: scene.id,
    title: scene.titleAr || scene.titleRu || 'ذكرى بلا عنوان',
    date: toISODate(scene.date) || scene.date || '',
    situation: typeLabel(scene.type),
  };
}

/* ------------------------------------------------------------------ *
 * البناء
 * ------------------------------------------------------------------ */

/**
 * يبني الحزمة.
 *
 * ⚠️ **يقرأ ولا يكتب.**
 *
 * @param {{sources?: string[], from?: string, to?: string}} options
 *        `sources` لحصر المصادر، و`from`/`to` بتاريخ الذكرى
 */
export async function buildCorpus({ sources = null, from = '', to = '' } = {}) {
  const world = await readAll();
  const wanted = sources ? new Set(sources) : null;

  const lines = [];
  for (const source of SOURCES) {
    if (wanted && !wanted.has(source.id)) continue;
    for (const row of source.read(world)) {
      const text = String(row.ru || '').trim();
      if (!text) continue;

      const scene = row.sceneId ? sceneContext(world, row.sceneId) : null;
      /*
       * ⚠️ **سطرٌ بلا مصدرٍ لا يدخل** — إلا المحفوظات، وهي وحدها التي
       *    قد تُلتقَط خارج ذكرى، ويُقال ذلك في مصدرها لا يُسكَت عنه.
       */
      if (!scene && source.id !== 'kept') continue;
      if (from && scene && scene.date && scene.date < from) continue;
      if (to && scene && scene.date && scene.date > to) continue;

      lines.push({
        ru: text,
        ar: row.ar || '',
        source: source.id,
        sourceLabel: source.label,
        by: row.by,
        mine: row.mine,
        scene: scene || { id: '', title: 'خارج أي ذكرى', date: '', situation: '' },
      });
    }
  }

  /*
   * ⚠️ الترتيب بالتاريخ ثم بالمصدر ثم بالنصّ — **حتميّ**. حزمةٌ تُبنى
   *    مرّتين بترتيبين مختلفين لا تصلح للمقارنة ولا للتشخيص.
   */
  lines.sort((a, b) =>
    (a.scene.date || '').localeCompare(b.scene.date || '')
    || a.source.localeCompare(b.source)
    || a.ru.localeCompare(b.ru));

  return {
    lingolifeCorpus: CORPUS_VERSION,
    builtAt: new Date().toISOString(),
    range: { from: from || '', to: to || '' },
    /* ما رُفض عرضُه — **داخل الحزمة** لا في وثيقةٍ وحدها. */
    noInsight: NO_INSIGHT.map(({ label, why }) => ({ label, why })),
    counts: countOf(lines),
    lines,
  };
}

/** عدُّ السطور بمصادرها — لا رقمًا واحدًا مركَّبًا. */
function countOf(lines) {
  const bySource = {};
  for (const row of lines) bySource[row.source] = (bySource[row.source] || 0) + 1;
  return {
    total: lines.length,
    mine: lines.filter((row) => row.mine).length,
    scenes: new Set(lines.map((row) => row.scene.id).filter(Boolean)).size,
    bySource,
  };
}

/**
 * ما سيخرج — **قبل** أن يخرج.
 *
 * ⚠️ الكوربوس أكبر ما يخرج من هذا التطبيق نصًّا، وفيه أسماءُ مَن
 *    تكلّم وكلُّ ما قالوه. فيُقال بعدده وبمداه قبل الحفظ.
 */
export async function corpusSummary(options = {}) {
  const corpus = await buildCorpus(options);
  const dates = corpus.lines.map((row) => row.scene.date).filter(Boolean).sort();
  return {
    ...corpus.counts,
    chars: corpus.lines.reduce((sum, row) => sum + row.ru.length, 0),
    people: [...new Set(corpus.lines.map((row) => row.by).filter(Boolean))],
    first: dates[0] || '',
    last: dates[dates.length - 1] || '',
    sources: CORPUS_SOURCES
      .filter((source) => corpus.counts.bySource[source.id])
      .map((source) => ({ ...source, count: corpus.counts.bySource[source.id] })),
  };
}

/* ------------------------------------------------------------------ *
 * الصيغ
 * ------------------------------------------------------------------ */

/**
 * الكوربوس نصًّا مقروءًا.
 *
 * ⚠️ **مصفوفًا بالذكرى لا بالمصدر.** السطر خارج موقفه فقد نصف معناه،
 *    و«كل ما قيل في اجتماع الشحنة» أنفع من «كل السكريبتات».
 */
export function corpusMarkdown(corpus) {
  const out = ['# كوربوس LingoLife', ''];
  out.push(`${corpus.counts.total} سطر · ${corpus.counts.scenes} ذكرى · `
    + `${corpus.counts.mine} منها كلامك أنت`, '');

  const byScene = new Map();
  for (const row of corpus.lines) {
    const key = row.scene.id || '—';
    if (!byScene.has(key)) byScene.set(key, { scene: row.scene, rows: [] });
    byScene.get(key).rows.push(row);
  }

  for (const { scene, rows } of byScene.values()) {
    const head = [scene.date, scene.situation].filter(Boolean).join(' · ');
    out.push(`## ${scene.title}${head ? ` — ${head}` : ''}`, '');
    for (const row of rows) {
      out.push(`- **${row.by}:** ${row.ru}${row.ar ? `\n  - ${row.ar}` : ''}`
        + `\n  - _${row.sourceLabel}_`);
    }
    out.push('');
  }

  /* ⚠️ وما لا تحمله الحزمة مكتوبٌ فيها — يقرؤه مَن يفتحها بعد سنة. */
  out.push('---', '', '## اللي مش في الحزمة دي — وليه', '');
  for (const row of corpus.noInsight) out.push(`- **${row.label}** — ${row.why}`);

  return out.join('\n');
}

/**
 * النصّ الروسيّ وحده، سطرًا سطرًا.
 *
 * ⚠️ صيغةٌ لأدوات اللغة (تحليل صرفيّ، تكرار، تدريب) — وهي **الوحيدة
 *    التي تفقد المصدر**، فتُعلَن كذلك في اسمها وفي الشاشة. ومَن أرادها
 *    بمصادرها يأخذ `.md` أو `.json`.
 */
export function corpusPlainText(corpus) {
  return corpus.lines.map((row) => row.ru).join('\n');
}

/** اسم الملفّ — بلا محارف تكسر نظام الملفّات. */
export function corpusFilename(corpus, ext = 'md') {
  const stamp = new Date().toISOString().slice(0, 10);
  const range = corpus.range?.from || corpus.range?.to
    ? `-${corpus.range.from || 'البداية'}_${corpus.range.to || 'النهاية'}`
    : '';
  return `كوربوس${range}-${stamp}.${ext}`.replace(/[\\/:*?"<>|]/g, '');
}

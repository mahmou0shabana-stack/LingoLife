/**
 * LingoLife — فهرسةُ المواضع (WS-C، بنود ٣٢…٣٤ و٤٢ و٥٥…٥٦)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما يفعله هذا الملفّ — وما لا يفعله بالضبط
 * ═══════════════════════════════════════════════════════════════
 *
 * **يفعل**: يقرأ نصوصَك القائمة (سكريبتات ومسودّات) ويكتب صفًّا لكلّ
 * موضعِ كلمةٍ فيها: أين، وفي أيّ جملة، وبأيّ صورةٍ كُتبت.
 *
 * **لا يفعل**: لا يدّعي أنك قابلتَ الكلمةَ يومَ الفهرسة. الصفُّ يقول
 * «هذه الكلمةُ موجودةٌ في هذا الموضع من نصِّك» — وهي واقعةٌ عن **النصّ**
 * لا عن **يومك**. وبند ٦٧ يسمّي هذا بالاسم:
 *
 *     يجوز أن نقول: «هذه الصيغةُ في ٧ مواضعَ محفوظة».
 *     ولا يجوز أن نقول: «قابلتَها ٧ مرّاتٍ خلال العام».
 *
 * ولذلك **لا تاريخَ شخصيًّا في هذه الصفوف**: لا `occurredAt` ولا
 * `firstSeen`. التواريخُ الشخصيّةُ لها بيوتُها — `savedItems.createdAt`
 * (متى التقطتَها) و`practiceEvidence.practicedAt` (متى تدرّبتَ) —
 * وكلاهما وقائعُ حقيقيّةٌ سجّلها التطبيقُ لحظةَ وقوعها.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ ولماذا الفهرسُ أصلًا — العطبُ الذي يُصلحه
 * ═══════════════════════════════════════════════════════════════
 *
 * `wordLife` في `language-service.js` كانت تفعل هذا في كلّ نداء:
 *
 *     conversationParts.getAll() + scripts.getAll() + expressions.getAll()
 *
 * ثلاثةُ مسحٍ كاملٍ للمستودعات — لكلمةٍ واحدة. وبند ٤٢ يمنع ذلك
 * صراحةً لرقائق الظلّ: عشرون رقاقةً تعني ستّين مسحًا كاملًا في كلّ
 * جملةٍ تنتقل إليها. والفهرسُ يجعل السؤالَ فهرسًا واحدًا.
 */

import { memoryOccurrences, scripts, studyDrafts } from '../../db/repositories.js';
import { STATE } from '../../db/schema.js';
import { splitSentences, splitWords } from '../shadow/segmenter.js';
import {
  SOURCE_KIND, canonical, sourceKey, occurrenceId, wordPositions,
} from './identity.js';

/**
 * يبني صفوفَ مصدرٍ واحدٍ من نصِّه — **دالّةٌ خالصةٌ لا تلمس القاعدة**.
 *
 * فتُختبَر بلا متصفّح، ويُقاس ناتجُها حرفًا حرفًا.
 */
export function rowsForSource({ kind, id, title = '', text = '', sceneId = null }) {
  const sentences = splitSentences(text || '', { requireCyrillic: true });
  const src = sourceKey(kind, id);
  const out = [];

  sentences.forEach((sentence, sentenceIndex) => {
    for (const pos of wordPositions(sentence, splitWords)) {
      out.push({
        id: occurrenceId({
          canonical: pos.canonical, sourceKey: src, sentenceIndex, wordIndex: pos.wordIndex,
        }),
        canonical: pos.canonical,
        /* ⚠️ الصورةُ كما كُتبت — لا تُشتقّ من المفتاح أبدًا (بند ٤). */
        surface: pos.surface,
        sourceKey: src,
        kind,
        sourceId: id,
        sourceTitle: title || '',
        sceneId,
        sentenceIndex,
        wordIndex: pos.wordIndex,
        /* الجملةُ المحيطة — «أرِني السياق» بلا فتح المصدر (بند ٣٠). */
        sentence,
      });
    }
  });

  return out;
}

/** المصادرُ التي تُفهرَس اليوم — سجلٌّ لا شروطٌ متفرّقة. */
const SOURCES = [
  {
    kind: SOURCE_KIND.SCRIPT,
    async read() {
      const rows = await scripts.getAll();
      return rows
        .filter((row) => row.state === STATE.ACTIVE && (row.text || '').trim())
        .map((row) => ({
          kind: SOURCE_KIND.SCRIPT,
          id: row.id,
          title: row.title || 'سكريبت',
          text: row.text,
          sceneId: row.sceneId || null,
        }));
    },
  },
  {
    kind: SOURCE_KIND.DRAFT,
    async read() {
      const rows = await studyDrafts.getAll();
      return rows
        .filter((row) => row.state === STATE.ACTIVE && (row.text || '').trim())
        .map((row) => ({
          kind: SOURCE_KIND.DRAFT,
          id: row.id,
          title: row.subjectText || 'مسودّة',
          text: row.text,
          sceneId: row.sceneId || null,
        }));
    },
  },
];

/**
 * يُعيد فهرسةَ مصدرٍ واحد — **إضافيّة، لا تمسّ غيرَه** (بند ٣٣).
 *
 * ⚠️ **وتحذف قبل أن تكتب.** نصٌّ حُذفت منه جملةٌ يترك مواضعَها معلَّقةً
 *    لو اكتفينا بالكتابة: البصماتُ تتغيّر فتُكتَب صفوفٌ جديدةٌ وتبقى
 *    القديمةُ تشير إلى جملةٍ لم تعد موجودة. فالمصدرُ يُمسَح ويُعاد —
 *    وهو رخيصٌ لأنه مصدرٌ واحد.
 */
export async function indexSource(source) {
  const src = sourceKey(source.kind, source.id);
  const existing = await memoryOccurrences.byIndex('sourceKey', src);
  await memoryOccurrences.destroyMany(existing.map((row) => row.id));

  const rows = rowsForSource(source);
  /*
   * ⚠️ **`putManyRaw` لا `create`**: البصمةُ هي المعرِّف، فإعادةُ
   *    الفهرسة تستبدل ولا تُضيف. وهذا هو ضمانُ «فتحُ الجملة غدًا لا
   *    يُنشئ ظهورًا جديدًا» (بند ٣٤) — بحكم المخزن لا بحكم شرطٍ
   *    نتذكّره. و`create` كانت ستختم معرِّفًا جديدًا في كلّ مرّة،
   *    فتتضاعف الصفوفُ بصمت.
   */
  await memoryOccurrences.putManyRaw(rows);
  return rows.length;
}

/** يحذف مواضعَ مصدرٍ — يُنادى حين يُحذف المصدرُ نفسُه. */
export async function forgetSource(kind, id) {
  const rows = await memoryOccurrences.byIndex('sourceKey', sourceKey(kind, id));
  await memoryOccurrences.destroyMany(rows.map((row) => row.id));
  return rows.length;
}

/**
 * يعيد بناءَ الفهرس كلِّه من المصادر (بند ٥٦).
 *
 * ⚠️ **ولا يمسّ تاريخَك الشخصيّ**: لا `savedItems` ولا `practiceEvidence`
 *    ولا `mistakeComparisons`. فهرسٌ فاسدٌ لا يجوز أن يُكلّفك ذكرياتك.
 *
 * ⚠️ **وحتميّة**: نداءان متتاليان يُنتجان نفسَ العدد بالضبط — البصمةُ
 *    تضمن ذلك. وهو ما يفحصه اختبار «إعادةُ البناء لا تُضاعف».
 */
export async function rebuildIndex({ onProgress = null } = {}) {
  const all = await memoryOccurrences.getAll();
  await memoryOccurrences.destroyMany(all.map((row) => row.id));

  let written = 0;
  let sources = 0;
  for (const group of SOURCES) {
    /* eslint-disable-next-line no-await-in-loop -- مصدرٌ بعد مصدرٍ عمدًا */
    const list = await group.read();
    for (const source of list) {
      /* eslint-disable-next-line no-await-in-loop -- تسلسلٌ يحفظ الذاكرة */
      written += await indexSource(source);
      sources += 1;
      onProgress?.({ sources, written });
    }
  }
  return { sources, written };
}

/**
 * ملخّصٌ رخيصٌ عن حال الفهرس — للوحة «أعِد البناء».
 */
export async function indexStats() {
  const rows = await memoryOccurrences.getAll();
  return {
    positions: rows.length,
    forms: new Set(rows.map((row) => row.canonical)).size,
    sources: new Set(rows.map((row) => row.sourceKey)).size,
  };
}

/** أدواتٌ للاختبار — لا تستعملها الشاشة. */
export const __test = { SOURCES, canonical };

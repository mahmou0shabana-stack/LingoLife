/**
 * LingoLife — الـ Repositories المسمّاة
 *
 * نقطة الوصول الوحيدة للبيانات من طبقة الخدمات.
 * لا تستورد `database.js` مباشرة من أي مكان آخر.
 */

import { createRepository } from './repository.js';
import { PREFIX } from '../utils/ids.js';
import { withTx, req } from './database.js';
import { settingShared } from '../services/sync/sync-policy.js';
import { appendLocal, LOG_STORE, OP, sameValue } from '../services/sync/change-log.js';

/* ---- نواة المحتوى ---- */
export const scenes = createRepository('scenes', PREFIX.SCENE);
export const media = createRepository('media', PREFIX.MEDIA);
export const sceneMediaLinks = createRepository('sceneMediaLinks', PREFIX.LINK);
export const scripts = createRepository('scripts', PREFIX.SCRIPT);
export const scriptVersions = createRepository('scriptVersions', PREFIX.SCRIPT_VERSION);
export const contentBlocks = createRepository('contentBlocks', PREFIX.BLOCK);
export const contentVersions = createRepository('contentVersions', PREFIX.BLOCK_VERSION);
export const conversations = createRepository('conversations', PREFIX.CONVERSATION);
export const conversationParts = createRepository('conversationParts', PREFIX.CONV_PART);

/* ---- اللغة ---- */
export const expressions = createRepository('expressions', PREFIX.EXPRESSION);
export const expressionOccurrences = createRepository('expressionOccurrences', PREFIX.OCCURRENCE);
export const sentencePatterns = createRepository('sentencePatterns', PREFIX.PATTERN);
export const words = createRepository('words', PREFIX.WORD);
export const mistakeComparisons = createRepository('mistakeComparisons', PREFIX.MISTAKE);

/* ---- التنظيم ---- */
// أنواع الأحداث: المدمجة بمعرّفاتٍ ثابتة مقروءة (`meeting`), والمضافة
// بمعرّفٍ مولَّد. الاثنان في نفس المستودع لأنهما نفس الكيان.
export const eventTypes = createRepository('eventTypes', PREFIX.EVENT_TYPE);
export const audioRoles = createRepository('audioRoles', PREFIX.AUDIO_ROLE);
export const eventThreads = createRepository('eventThreads', PREFIX.THREAD);
export const people = createRepository('people', PREFIX.PERSON);
export const places = createRepository('places', PREFIX.PLACE);
export const journeys = createRepository('journeys', PREFIX.JOURNEY);
export const topics = createRepository('topics', PREFIX.TOPIC);
export const tags = createRepository('tags', PREFIX.TAG);
export const relationships = createRepository('relationships', PREFIX.RELATION);

/* ---- الشادوينج ---- */
export const shadowSessions = createRepository('shadowSessions', PREFIX.SHADOW_SESSION);
export const shadowSegments = createRepository('shadowSegments', PREFIX.SHADOW_SEGMENT);
export const practiceEvidence = createRepository('practiceEvidence', PREFIX.EVIDENCE);
export const savedItems = createRepository('savedItems', PREFIX.SAVED);
// مفتاحه الكلمة نفسها (`keyPath: 'word'`) لا معرّف مولَّد: الكلمة هي
// الهويّة هنا، فجلبها مرّتين يجب أن يصيب نفس السجل.
export const nativeAudio = createRepository('nativeAudio', PREFIX.NATIVE_AUDIO);
// مفتاحه هاش مركّب (`keyPath: 'cacheKey'`) من النصّ المطبَّع واللغة
// والمزوّد والصوت وإعداداته — نفس الصوت من أي مصدرٍ يصيب نفس السجل
// فلا يتكرّر التوليد (WS41).
export const generatedAudio = createRepository('generatedAudio', PREFIX.GENERATED_AUDIO);

/* ---- المراجعة ---- */
export const reviewItems = createRepository('reviewItems', PREFIX.REVIEW);
export const reviewHistory = createRepository('reviewHistory', PREFIX.REVIEW_LOG);

/* ---- التحليل ---- */
export const analysisRuns = createRepository('analysisRuns', PREFIX.ANALYSIS_RUN);
export const analysisProposals = createRepository('analysisProposals', PREFIX.PROPOSAL);

/* ---- النظام ---- */
export const syncQueue = createRepository('syncQueue', PREFIX.SYNC);
export const projectContext = createRepository('projectContext', PREFIX.CONTEXT);
export const promptVersions = createRepository('promptVersions', PREFIX.PROMPT);
export const backupHistory = createRepository('backupHistory', PREFIX.BACKUP);

/* مختبر التطوّر — v11 */
export const devIssues = createRepository('devIssues', PREFIX.DEV_ISSUE);
export const devBriefs = createRepository('devBriefs', PREFIX.DEV_BRIEF);
export const devEvents = createRepository('devEvents', PREFIX.DEV_EVENT);
export const devShots = createRepository('devShots', PREFIX.DEV_SHOT);

/** مسودّة المذاكرة — ما تكتبه عن جملةٍ أو كلمة (v12). */
export const studyDrafts = createRepository('studyDrafts', PREFIX.STUDY_DRAFT);

/** القواعد المهمّة — دفترُ المراجع الشخصيّ داخل الظلّ (v15، WS-B). */
export const referenceRules = createRepository('referenceRules', PREFIX.REFERENCE_RULE);
/**
 * فهرسُ مواضع ذاكرة اللغة (WS-C) — **مشتقٌّ يُعاد بناؤه**.
 * راجع الشرحَ فوق `memoryOccurrences` في `schema.js`.
 */
export const memoryOccurrences = createRepository('memoryOccurrences', PREFIX.MEMORY_OCCURRENCE);

/*
 * ذاكرةُ اللغة الحيّة v2 — سجلُّ المصادر وطبقةُ التحليل (WS-J).
 * الشرحُ الكاملُ فوق تعريفها في `schema.js`.
 */
export const memorySources = createRepository('memorySources', PREFIX.MEMORY_SOURCE);
export const analysisItems = createRepository('analysisItems', PREFIX.ANALYSIS_ITEM);
export const analysisEvidence = createRepository('analysisEvidence', PREFIX.ANALYSIS_EVIDENCE);

/**
 * الإعدادات — مفتاح/قيمة، بلا الحقول المشتركة.
 * أبسط من repository كامل ولا يحتاج rev ولا حالات.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **والمزامنةُ هنا بالمفتاح لا بالمخزن** (WS-G، بندا ٤٥ و٧٨)
 * ═══════════════════════════════════════════════════════════════
 *
 * `settings` مخزنٌ واحدٌ يحمل شيئين لا ثالثَ لهما: **بياناتٍ تملكها**
 * (قاموسُ النبر الذي كتبتَه، تصنيفاتُك، أحكامُ التشابه) و**حالةَ هذا
 * الجهاز** (نسبةُ انقسام الصفحة، آخرُ شاشة، مزوّدُ النطق المتاح هنا).
 *
 * ومزامنتُه كتلةً واحدةً تعني أن تفتح الموبايلَ فتجد شاشتَه مضبوطةً
 * على مقاس التابلت، وملفَّ PDF يشير إلى بايتاتٍ ليست عنده. فالقرارُ
 * **مفتاحٌ بمفتاح**، والافتراضُ **محلّيّ**، والقائمةُ في
 * `SETTING_SHARED` ومعها سببُ كلِّ سطر.
 */
export const settings = {
  async get(key, fallback = null) {
    const row = await withTx('settings', 'readonly', (tx) =>
      req(tx.objectStore('settings').get(key))
    );
    return row ? row.value : fallback;
  },

  async set(key, value) {
    const shared = settingShared(key);
    const stores = shared ? ['settings', LOG_STORE] : 'settings';
    await withTx(stores, 'readwrite', async (tx) => {
      const store = tx.objectStore('settings');
      const before = shared ? await req(store.get(key)) : null;
      const row = { key, value, updatedAt: Date.now() };
      await req(store.put(row));
      if (shared && !sameValue(before?.value, value)) {
        await appendLocal(tx, [{
          store: 'settings', recordId: key, op: OP.PUT, fields: ['value'],
        }]);
      }
    });
    return value;
  },

  async all() {
    const rows = await withTx('settings', 'readonly', (tx) =>
      req(tx.objectStore('settings').getAll())
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  async remove(key) {
    const shared = settingShared(key);
    const stores = shared ? ['settings', LOG_STORE] : 'settings';
    await withTx(stores, 'readwrite', async (tx) => {
      const store = tx.objectStore('settings');
      const before = shared ? await req(store.get(key)) : null;
      await req(store.delete(key));
      if (shared && before) {
        await appendLocal(tx, [{
          store: 'settings', recordId: key, op: OP.REMOVE, payload: before,
        }]);
      }
    });
  },
};

/** خريطة بالاسم — للتصدير والاستيراد والإحصاءات. */
export const ALL_REPOS = {
  memoryOccurrences,
  memorySources,
  analysisItems,
  analysisEvidence,
  scenes,
  media,
  sceneMediaLinks,
  scripts,
  scriptVersions,
  contentBlocks,
  contentVersions,
  conversations,
  conversationParts,
  expressions,
  expressionOccurrences,
  sentencePatterns,
  words,
  mistakeComparisons,
  eventTypes,
  audioRoles,
  eventThreads,
  people,
  places,
  journeys,
  topics,
  tags,
  relationships,
  shadowSessions,
  shadowSegments,
  practiceEvidence,
  savedItems,
  nativeAudio,
  generatedAudio,
  reviewItems,
  reviewHistory,
  analysisRuns,
  analysisProposals,
  syncQueue,
  projectContext,
  promptVersions,
  backupHistory,
  devIssues,
  devBriefs,
  devEvents,
  devShots,
  studyDrafts,
  referenceRules,
};

/**
 * LingoLife — الـ Repositories المسمّاة
 *
 * نقطة الوصول الوحيدة للبيانات من طبقة الخدمات.
 * لا تستورد `database.js` مباشرة من أي مكان آخر.
 */

import { createRepository } from './repository.js';
import { PREFIX } from '../utils/ids.js';
import { withTx, req } from './database.js';

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

/**
 * الإعدادات — مفتاح/قيمة، بلا الحقول المشتركة.
 * أبسط من repository كامل ولا يحتاج rev ولا حالات.
 */
export const settings = {
  async get(key, fallback = null) {
    const row = await withTx('settings', 'readonly', (tx) =>
      req(tx.objectStore('settings').get(key))
    );
    return row ? row.value : fallback;
  },

  async set(key, value) {
    await withTx('settings', 'readwrite', (tx) =>
      req(tx.objectStore('settings').put({ key, value, updatedAt: Date.now() }))
    );
    return value;
  },

  async all() {
    const rows = await withTx('settings', 'readonly', (tx) =>
      req(tx.objectStore('settings').getAll())
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  async remove(key) {
    await withTx('settings', 'readwrite', (tx) => req(tx.objectStore('settings').delete(key)));
  },
};

/** خريطة بالاسم — للتصدير والاستيراد والإحصاءات. */
export const ALL_REPOS = {
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
};

/**
 * LingoLife — البذور الأولى
 *
 * ما تبدأ به القاعدة قبل أن تكتب أنت شيئًا.
 *
 * ⚠️ **مكانها هنا لا في طبقة الخدمات.** الترقيات تحتاجها لتبذر بها،
 *    وطبقة الترقيات لا يجوز أن تعتمد على طبقة الخدمات: الخدمة تتغيّر
 *    مع الميزات، والترقية **لا تتغيّر أبدًا بعد نشرها**
 *    (docs/03-architecture.md §3.6). لو استوردت الترقية من الخدمة
 *    لتبدّل سلوكُها الماضي كلما عُدِّلت الخدمة اليوم.
 */

import { STATE } from './schema.js';

/**
 * أنواع الأحداث المدمجة.
 *
 * ⚠️ **المعرّفات مُجمَّدة إلى الأبد.** `scene.type` في كل ذكرى كتبتَها
 *    يحمل واحدًا منها، وهي نفسها التي تُبذَر بها `eventTypes` — وهذه
 *    هي الحيلة التي جعلت ترقية v7 بلا لمس مشهدٍ واحد. تغيير معرّفٍ
 *    هنا يفصل ذكرياتك عن أنواعها.
 *
 * والأسماء من واقع الحياة لا تصنيفات مجرّدة: «اجتماع شغل» أوضح من
 * «عمل»، لأن الذكرى حدث لا فئة.
 */
export const BUILT_IN_EVENT_TYPES = Object.freeze([
  { id: 'meeting', label: 'اجتماع شغل' },
  { id: 'inspection', label: 'فحص' },
  { id: 'phone', label: 'مكالمة' },
  { id: 'daily', label: 'موقف يومي' },
  { id: 'shopping', label: 'شراء وطلب' },
  { id: 'official', label: 'مصلحة حكومية' },
  { id: 'doctor', label: 'دكتور وصحّة' },
  { id: 'friends', label: 'قعدة أصحاب' },
  { id: 'travel', label: 'سفر ومواصلات' },
  { id: 'study', label: 'دراسة' },

  // أنواع النسخة القديمة. مؤرشفة: لا تظهر في قوائم الاختيار، لكن
  // المشاهد القديمة المحفوظة بها تبقى تعرض اسمًا مفهومًا بدل معرّف خام.
  { id: 'work', label: 'شغل', archived: true },
  { id: 'call', label: 'مكالمة (قديم)', archived: true },
  { id: 'personal', label: 'شخصي', archived: true },
  { id: 'other', label: 'أخرى', archived: true },
].map((type, index) => Object.freeze({
  parentId: null,
  aliases: [],
  icon: null,
  color: null,
  builtIn: true,
  archived: false,
  ...type,
  order: index,
  state: type.archived ? STATE.ARCHIVED : STATE.ACTIVE,
})));

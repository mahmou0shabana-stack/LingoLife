/**
 * LingoLife — إعدادات التطبيق الثابتة
 *
 * `__BUILD__` يُستبدل تلقائيًا برقم البناء في GitHub Action عند النشر.
 * محليًا يظل كما هو — وهذا مقبول.
 */

export const APP_NAME = 'LingoLife';
export const APP_TAGLINE = 'حياتك. لغتك. ذاكرتك.';
export const APP_VERSION = '0.7.0';
export const BUILD_ID = '__BUILD__';

/** مسار الجذر — يعمل تحت مسار فرعي في GitHub Pages. */
export const BASE_PATH = new URL('.', import.meta.url).pathname.replace(/js\/$/, '');

/** أنواع المشاهد المتاحة. */
export const SCENE_TYPES = [
  { id: 'work', label: 'عمل' },
  { id: 'meeting', label: 'اجتماع' },
  { id: 'travel', label: 'سفر' },
  { id: 'daily', label: 'يومي' },
  { id: 'study', label: 'دراسة' },
  { id: 'call', label: 'مكالمة' },
  { id: 'personal', label: 'شخصي' },
  { id: 'other', label: 'أخرى' },
];

export function sceneTypeLabel(id) {
  return SCENE_TYPES.find((t) => t.id === id)?.label || 'أخرى';
}

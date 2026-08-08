/**
 * LingoLife — إعدادات التطبيق الثابتة
 *
 * `__BUILD__` يُستبدل تلقائيًا برقم البناء في GitHub Action عند النشر.
 * محليًا يظل كما هو — وهذا مقبول.
 */

export const APP_NAME = 'LingoLife';
export const APP_TAGLINE = 'حياتك. لغتك. ذاكرتك.';
export const APP_VERSION = '0.11.0';
export const BUILD_ID = '__BUILD__';

/** مسار الجذر — يعمل تحت مسار فرعي في GitHub Pages. */
export const BASE_PATH = new URL('.', import.meta.url).pathname.replace(/js\/$/, '');

/*
 * أنواع المشاهد انتقلت إلى `js/services/type-service.js`.
 * كانت قائمة ثابتة هنا، والحياة لا تُستوعَب في قائمة ثابتة —
 * صارت بياناتٍ تُضاف وتُعدَّل وتتفرّع.
 */

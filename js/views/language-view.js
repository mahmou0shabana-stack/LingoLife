/**
 * LingoLife — شاشة "لغتي"
 *
 * صادقة عن حالتها: عالم اللغة يُبنى في المرحلة 2.
 * لا أرقام وهمية ولا أزرار لا تعمل (بند 58 و86).
 */

import { expressions, words, sentencePatterns, mistakeComparisons } from '../db/repositories.js';
import { html, raw } from '../utils/dom.js';
import { icon } from '../components/icons.js';

export async function renderLanguage(main) {
  // أرقام حقيقية من القاعدة — تساوي صفرًا الآن وهذا صحيح ومقصود.
  const [expCount, wordCount, patternCount, mistakeCount] = await Promise.all([
    expressions.count(),
    words.count(),
    sentencePatterns.count(),
    mistakeComparisons.count(),
  ]);

  const hasAny = expCount + wordCount + patternCount + mistakeCount > 0;

  main.innerHTML = html`
    <div class="view-head">
      <h1>لغتي</h1>
      <div class="sub">اللغة اللي اتكوّنت من مواقفك الحقيقية</div>
    </div>

    <div class="panel">
      <div class="kv-row"><span class="k">تعبيرات</span><span class="v num">${expCount}</span></div>
      <div class="kv-row"><span class="k">كلمات</span><span class="v num">${wordCount}</span></div>
      <div class="kv-row"><span class="k">أنماط جُمل</span><span class="v num">${patternCount}</span></div>
      <div class="kv-row"><span class="k">مقارنات خطأ/طبيعي</span><span class="v num">${mistakeCount}</span></div>
    </div>

    ${raw(
      hasAny
        ? ''
        : html`
            <div class="empty-state">
              <div class="glyph">${raw(icon('language'))}</div>
              <h2>عالم اللغة لسه فاضي</h2>
              <p>
                التعبيرات والكلمات والأنماط بتتولد من الذكريات نفسها — مش
                بتتكتب في قوائم منفصلة.
              </p>
            </div>`
    )}

    <div class="not-yet">
      ${raw(icon('info', 18))}
      <div>
        <strong>المرحلة 2 (عالم اللغة):</strong> Expression Life بخطه الزمني،
        تحليل التعبير الكامل، وكل رقم هنا هيبقى قابل للضغط ويفتح العناصر
        الفعلية — مش رقم للعرض.
      </div>
    </div>`;
}

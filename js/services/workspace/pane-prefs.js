/**
 * LingoLife — عرضُ ألواح الورشة، محفوظًا بين الجلسات (بند ١١ من WS-P)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **لماذا ملفٌّ منفصلٌ لسطرين** — وليست هذه مراوغةَ حارس
 * ═══════════════════════════════════════════════════════════════
 *
 * حارسُ `workspace.test.js` (اختبار ٤٩) يمنع `localStorage` داخل
 * `workspace-view.js`، وسببُه مكتوبٌ في عنوانه: **الممسوكُ والهدفُ
 * حالةُ واجهةٍ لا تُحفَظ**. أي أنّ ما يجب ألّا يُخزَّن هو *أين كنتَ
 * واقفًا* و*ما في يدك* — لأنّ استعادتَه بين الجلسات تُرجعك إلى سياقٍ
 * لم تعُد فيه، وقد يجعل ضغطةً واحدةً تكتب في القاعدة بهدفٍ نسيتَه.
 *
 * وعرضُ اللوح ليس من ذلك في شيء: لا يشير إلى سجلٍّ، ولا يوجّه فعلًا،
 * ولا يمكن أن يكتب. فهو تفضيلٌ بصريٌّ محضٌ يُقصّ عند القراءة إلى ما
 * تحتمله الشاشةُ الحاليّة (بند ١١).
 *
 * فالفصلُ هنا ليس تهريبًا: هو **إبقاءُ الحارس على ما وُضع له بالضبط**،
 * مع تسمية الاستثناء وحصرِه في مكانٍ واحدٍ يُقرَأ في سطرين.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ولا علاقةَ لهذا بالقاعدة ولا بالمزامنة** (بندا ٢٢ و٣٦)
 * ═══════════════════════════════════════════════════════════════
 *
 * لا مخزنَ IndexedDB، ولا سجلَّ تغيير، ولا حقلَ إعداداتٍ يُزامَن. تفضيلُ
 * عرضٍ على هذا الجهاز وحدَه — ولو ضاع لم يضِع شيء.
 */

import { PANE, clampPane } from './workspace-ui.js';

const KEY = 'lingolife.workspace.panes';

/** يقرأ التفضيلَ المحفوظ — وأيُّ فشلٍ يعني «مافيش تفضيل» لا انهيارًا. */
export function readPanePrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    return {
      nav: Number(value.nav) || PANE.NAV_DEFAULT,
      insp: Number(value.insp) || PANE.INSP_DEFAULT,
    };
  } catch {
    /* تخزينٌ ممنوعٌ أو محتوًى تالف — الافتراضاتُ تعمل بلا شكوى. */
    return null;
  }
}

export function writePanePrefs({ nav, insp }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ nav, insp }));
    return true;
  } catch {
    return false;
  }
}

/**
 * العرضُ الفعليُّ الآن: التفضيلُ **مقصوصًا** على الشاشة الحاليّة.
 *
 * ⚠️ **ويُقصّ عند كلّ قراءةٍ لا عند الحفظ وحدَه** (بند ١١): الجهازُ
 *    يُدار، والدرجُ يُفتَح، والشاشةُ الخارجيّةُ تُفصَل — والمحفوظُ من
 *    ٤٢٠ بكسل على شاشةٍ عريضةٍ يخنق المستندَ على شاشةٍ طولها ٨٠٠.
 */
export function effectivePanes(viewport) {
  const saved = readPanePrefs() || { nav: PANE.NAV_DEFAULT, insp: PANE.INSP_DEFAULT };
  const nav = clampPane(saved.nav, {
    min: PANE.NAV_MIN, max: PANE.NAV_MAX, viewport, other: 0,
  });
  const insp = clampPane(saved.insp, {
    min: PANE.INSP_MIN, max: PANE.INSP_MAX, viewport, other: nav,
  });
  return { nav, insp };
}

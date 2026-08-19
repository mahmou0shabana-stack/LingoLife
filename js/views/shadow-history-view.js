/**
 * LingoLife — كل جلسات الظلّ (WS42، بند 4)
 *
 * ═══════════════════════════════════════════════════════════════
 * بلاغُك
 * ═══════════════════════════════════════════════════════════════
 *
 * > «كمّل الظلّ» في شاشة دلوقتي يعرض آخر 3 فقط، وظننتُ أن القديم
 * >  ضاع. تاريخ الظلّ جزءٌ من تعلّمي طويل الأمد — احتفظ بكلّ الجلسات،
 * >  ووفّر بابًا يصلها كلّها.
 *
 * ⚠️ **الفحصُ أثبت أن لا فقدان بيانات أصلًا** — `resumableSessions(3)`
 *    تقرأ الكلَّ (`getAll()`) ثم تَقصّ للعرض فقط، وهذا سلوكٌ سليم
 *    لمعاينةٍ صغيرة. **لكن لم يكن هناك بابٌ إلى الباقي** — فهذه الشاشة
 *    هي ذلك الباب: `allShadowSessions()` (بلا `slice`) تُسرَد هنا كلّها.
 *
 * ⚠️ **بلا فلاترَ الآن** — بلاغُك نفسُه يقول «لا تُنشئ كل الفلاتر إلا
 *    عند الحاجة». فالبيانات (`status`، `sourceType`، `sceneId`) موجودةٌ
 *    في كل صفٍّ بالفعل، فحين يُطلَب الفرزُ لاحقًا لا حاجة لإعادة تصميم.
 */

import { html, raw } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { relativeTime } from '../utils/dates.js';
import { allShadowSessions, SESSION_STATUS } from '../services/shadow/shadow-session-service.js';
import { shadowSegments } from '../db/repositories.js';

async function rows() {
  const sessions = await allShadowSessions();
  return Promise.all(
    sessions.map(async (session) => ({
      id: session.id,
      title: session.title || 'جلسة ظلّ',
      currentSegmentIndex: session.currentSegmentIndex || 0,
      count: (await shadowSegments.byIndex('sessionId', session.id)).length,
      when: relativeTime(session.lastPracticedAt || session.createdAt),
      completed: session.status === SESSION_STATUS.COMPLETED,
    }))
  );
}

export async function renderShadowHistory(main) {
  const list = await rows();

  if (!list.length) {
    main.innerHTML = html`
      <div class="empty-state">
        <div class="glyph">${raw(icon('play'))}</div>
        <h2>لسه مفيش جلسات ظلّ</h2>
        <p>أوّل ما تبدأ تتدرّب على أيّ سكريبت، هتلاقي جلساتك كلّها هنا.</p>
      </div>`;
    return;
  }

  main.innerHTML = html`
    <div class="view-head">
      <h1>كل جلسات الظلّ</h1>
      <div class="sub">${list.length} جلسة · كلّها محفوظة، مفيش حاجة بتتنسى</div>
    </div>

    ${raw(
      list
        .map(
          (row) => html`
            <button class="resume-row" data-action="open-shadow" data-id="${row.id}">
              <span class="t">${row.title}</span>
              <span class="s">${row.completed ? '✓ خلصت' : `جملة ${row.currentSegmentIndex + 1} من ${row.count}`}</span>
              <span class="w">${row.when}</span>
            </button>`
        )
        .join('')
    )}`;
}

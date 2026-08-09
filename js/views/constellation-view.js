/**
 * LingoLife — الكوكبة: مين اتقابل مع مين
 *
 * ═══════════════════════════════════════════════════════════════
 * لماذا الأشخاص لا الذكريات؟
 * ═══════════════════════════════════════════════════════════════
 *
 * الشكل المتوقَّع من «كوكبة» أن ترسم كل ذكرى نقطةً في فضاء. جرّبتُه
 * ذهنيًّا فوجدته **سحابةً جميلةً لا تقول شيئًا**: عندك سبعُ ذكرياتٍ في
 * المكتب — فماذا؟ الشبكة تجيب سؤالًا لا تجيبه شاشةٌ أخرى في التطبيق:
 * **«مين اتقابل مع مين، وكام مرّة؟»** والخيط بين اسمين موقفٌ جمعهما،
 * وسُمكه عدد تلك المواقف.
 *
 * ⚠️ **ولا محاكاةَ فيزيائيّة.** الرسم دائريٌّ محسوب: الأشخاص على محيطٍ
 *    بترتيب عدد ذكرياتهم، والخيوط أوتارٌ بينهم. لا قوى تتنافر ولا
 *    إطاراتٌ تُحسَب — فالشكل **ثابتٌ بين الفتحات**، وموضع الاسم يصير
 *    شيئًا تتذكّره. ورسمٌ يقفز في كل مرّة جميلٌ مرّةً ومُربكٌ دائمًا.
 *
 * ⚠️ **والوصلة من المحادثة لا من الحضور** — نفس حدّ محور الشخص في
 *    الأطلس. شخصان في ذكرى واحدة ولم يتكلّم أحدهما لا خيطَ بينهما،
 *    وهذا مكتوبٌ في الشاشة لا مخبوء.
 */

import { html, raw, $ } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { formatDate } from '../utils/dates.js';
import { counted } from '../utils/plural.js';
import { constellation } from '../services/atlas-service.js';

/** الوتر المفتوح — يُعاد رسمه فيبقى مفتوحًا بعد إعادة العرض. */
let openPair = null;

export function resetConstellation() {
  openPair = null;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 118;

/** موضع العقدة على المحيط — محسوبٌ من ترتيبها لا من عشوائيّة. */
function positions(nodes) {
  const map = new Map();
  nodes.forEach((node, i) => {
    // نبدأ من الأعلى وندور: الأكثر ذكرياتٍ في القمّة.
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    map.set(node.id, {
      x: CENTER + Math.cos(angle) * RADIUS,
      y: CENTER + Math.sin(angle) * RADIUS,
      angle,
    });
  });
  return map;
}

function chart(nodes, links, pos) {
  const maxCount = Math.max(...nodes.map((n) => n.count), 1);
  const maxLink = Math.max(...links.map((l) => l.count), 1);

  const wires = links.map((link) => {
    const a = pos.get(link.a);
    const b = pos.get(link.b);
    const key = [link.a, link.b].sort().join('|');
    const active = key === openPair;
    return html`
      <line class="cn-wire${active ? ' is-open' : ''}"
            x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}"
            x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"
            stroke-width="${(1 + (link.count / maxLink) * 3).toFixed(1)}"
            data-action="cn-pair" data-pair="${key}"></line>`;
  });

  const dots = nodes.map((node) => {
    const p = pos.get(node.id);
    // المساحة تتناسب مع العدد لا القطر — وإلا بدا ضِعفٌ أربعةَ أضعاف.
    const r = 5 + Math.sqrt(node.count / maxCount) * 9;
    // الاسم خارج الدائرة دائمًا، وجهته حسب نصف المحيط.
    const outward = 1 + r / RADIUS + 0.06;
    const lx = CENTER + (p.x - CENTER) * outward;
    const ly = CENTER + (p.y - CENTER) * outward;
    /*
     * ⚠️ `text-anchor` **معكوسٌ هنا**، لأن النصّ `direction: rtl`:
     *    فـ`start` هو يمين النصّ لا يساره. فعقدةٌ في النصف الأيمن
     *    تحتاج `end` ليمتدّ اسمها يمينًا بعيدًا عن المركز.
     *
     *    بالمنطق اللاتيني كانت الأسماء تمتدّ نحو الداخل فتركب على
     *    دوائرها — ظهر ذلك في أوّل لقطة.
     */
    const anchor = Math.abs(p.x - CENTER) < 12 ? 'middle' : p.x > CENTER ? 'end' : 'start';

    return html`
      <g class="cn-node" data-action="river-by-person" data-id="${node.id}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}"></circle>
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"
              text-anchor="${anchor}" dominant-baseline="middle">${node.label}</text>
      </g>`;
  });

  return html`
    <svg class="cn-svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img"
         aria-label="شبكة الأشخاص — مين اتقابل مع مين">
      <g class="cn-wires">${raw(wires.join(''))}</g>
      <g class="cn-nodes">${raw(dots.join(''))}</g>
    </svg>`;
}

/** تفاصيل وترٍ مفتوح — المواقف التي جمعت الاثنين، بأسمائها. */
function pairPanel(link, nodes) {
  const name = (id) => nodes.find((n) => n.id === id)?.label || 'شخص';
  return html`
    <section class="cn-pair-panel">
      <h3>
        <bdi>${name(link.a)}</bdi> و<bdi>${name(link.b)}</bdi>
        <span class="cn-pair-count">${link.count}</span>
      </h3>
      ${raw(link.scenes.map((scene) => html`
        <button class="cn-scene" data-action="open-scene" data-id="${scene.id}">
          <bdi>${scene.title}</bdi>
          <span>${formatDate(scene.date)}</span>
        </button>`).join(''))}
    </section>`;
}

export async function renderConstellation(main) {
  const { nodes, links, scenesWithTwo } = await constellation();

  if (nodes.length < 2) {
    main.innerHTML = html`
      ${raw(head())}
      <div class="empty-state">
        <div class="glyph">${raw(icon('person'))}</div>
        <h2>لسه مفيش شبكة</h2>
        <p>
          الشبكة بتتبني من اللي اتكلّموا في محادثاتك. لازم يبقى فيه
          شخصين على الأقل مربوطين بجُمل عشان يبان خيط.
        </p>
        <button class="btn btn-ghost" data-action="go-facets">شوف المحاور</button>
      </div>`;
    return;
  }

  const pos = positions(nodes);
  const open = openPair
    ? links.find((link) => [link.a, link.b].sort().join('|') === openPair)
    : null;

  main.innerHTML = html`
    ${raw(head())}

    <div class="cn-wrap">${raw(chart(nodes, links, pos))}</div>

    <div class="cn-legend">
      <span>${counted(nodes.length, 'شخص', 'شخصان', 'أشخاص')}</span>
      <span>${counted(links.length, 'وصلة', 'وصلتان', 'وصلات')}</span>
      <!-- صفةٌ لا فعل: الفعل يحتاج مطابقةً تختلف مع كل عدد. -->
      <span>${counted(scenesWithTwo, 'موقف مشترك', 'موقفان مشتركان', 'مواقف مشتركة')}</span>
    </div>

    ${raw(open ? pairPanel(open, nodes) : html`
      <p class="cn-hint">
        دوس على اسم عشان تشوف ذكرياته في النهر، أو على خيط عشان تشوف
        المواقف اللي جمعت الاتنين.
      </p>`)}

    <details class="cn-absent">
      <summary>الشبكة دي مبنيّة على إيه بالظبط؟</summary>
      <p>
        الخيط بين اسمين معناه موقف اتكلّم فيه الاتنين — <strong>الكلام
        مش الحضور</strong>. حدّ حضر وما اتكلّمش مش هيبان، ومفيش مصدر في
        التطبيق يقول مين كان موجود من غير ما يتكلّم.
      </p>
      <p>
        وحجم الاسم على قد عدد ذكرياته، وسُمك الخيط على قد عدد المواقف
        اللي جمعت الاتنين. والرسم ثابت: نفس الترتيب في كل مرة تفتحها.
      </p>
    </details>`;
}

function head() {
  return html`
    <div class="view-head rv-head">
      <div>
        <h1>الكوكبة</h1>
        <div class="sub">مين اتقابل مع مين — من محادثاتك</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="go-river">
        ${raw(icon('life', 15))} النهر
      </button>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * الأفعال
 * ------------------------------------------------------------------ */

export async function handleConstellationAction(action, target) {
  if (action === 'go-constellation') {
    const { navigate } = await import('../router.js');
    navigate('/constellation');
    return true;
  }

  if (action === 'cn-pair') {
    const key = target?.dataset.pair;
    // ضغطةٌ ثانية على نفس الخيط تُغلقه — لا زرَّ إغلاقٍ منفصل.
    openPair = openPair === key ? null : key;
    const main = $('#app-main');
    if (main) await renderConstellation(main);
    return true;
  }

  return false;
}

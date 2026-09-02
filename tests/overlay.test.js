/**
 * LingoLife — الطبقات والصوت والتسمية (WS-P2)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **ما لا يُختبَر هنا — وقيلَ صراحةً**
 * ═══════════════════════════════════════════════════════════════
 *
 * تسرّبُ اللمسة عبر الطبقة **لا يُثبَت في هذا الملفّ**. سببُه أنّ
 * المتصفّحَ يولّد `click` من `touchend` بفحصٍ جديدٍ للنقطة، و`dispatchEvent`
 * من كودٍ لا يولّد شيئًا تلقائيًّا — فأيُّ اختبارٍ هنا سيمرّ سواءٌ أصلحنا
 * أم لم نصلح. وهذا أسوأُ أنواع الاختبارات: حارسٌ لا يحرس.
 *
 * فالإثباتُ الحقيقيُّ في مسبار Playwright بلمسٍ حقيقيّ (`touchscreen.tap`)،
 * ونتيجتُه مسجّلةٌ في `docs/11-workspace.md`:
 *
 *     بلا الحاجز: التسرّبُ ضغط `ws-icon-btn` **فأغلق المُفتِّش**
 *     مع الحاجز: لا تسرّب، والمُفتِّشُ باقٍ مفتوحًا
 *
 * والمحروسُ هنا ما **يمكن** أن يُقاس بلا لمسٍ حقيقيّ: العزلُ يُرفَع
 * ويُوضَع، والتركيزُ يُحبَس ويعود، والحاجزُ يُنصَب ويُرفَع بحدثٍ لا بمؤقّت.
 */

import { describe, it, expect } from './test-runner.js';
import {
  isolateBehind, swallowGestureTail, isIsolated,
} from '../js/components/overlay-guard.js';
import {
  PLAY_STATE, playStateOf, playIntent, audioButtonHtml, refreshAudioButtons,
} from '../js/components/audio-button.js';
import { setCaption } from '../js/services/media-service.js';
import { media } from '../js/db/repositories.js';

const codeOnly = (src) => src.split('\n')
  .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line)).join('\n');

const layer = (html = '<button class="a">أ</button><button class="b">ب</button>') => {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = html;
  document.body.append(el);
  return el;
};

/* ================================================================== *
 * أ · عزلُ الطبقة (بندا ٥ و٢٤)
 * ================================================================== */

describe('WS-P2 · أ · الطبقةُ تعزل ما تحتها', () => {
  it('١ · العزلُ يضع صنفَ `overlay-open` ويرفعه', () => {
    const box = layer();
    const release = isolateBehind(box);
    expect(document.body.classList.contains('overlay-open')).toBe(true);
    expect(isIsolated()).toBe(true);
    box.remove();
    release();
    expect(document.body.classList.contains('overlay-open')).toBe(false);
    expect(isIsolated()).toBe(false);
  });

  it('٢ · وطبقتان لا تُطفئان العزلَ عند إغلاق واحدةٍ منهما', () => {
    const a = layer();
    const b = layer();
    const dropA = isolateBehind(a);
    const dropB = isolateBehind(b);
    b.remove(); dropB();
    /* ⚠️ العدّادُ لا الرايةُ — نافذةٌ فوق نافذةٍ حالةٌ عاديّةٌ في التطبيق. */
    expect(document.body.classList.contains('overlay-open')).toBe(true);
    a.remove(); dropA();
    expect(document.body.classList.contains('overlay-open')).toBe(false);
  });

  it('٣ · وإغلاقٌ مكرَّرٌ لا يُنقص العدّادَ مرّتين', () => {
    const a = layer();
    const b = layer();
    const dropA = isolateBehind(a);
    const dropB = isolateBehind(b);
    dropB(); dropB(); dropB();
    expect(isIsolated()).toBe(true);
    dropA();
    expect(isIsolated()).toBe(false);
    a.remove(); b.remove();
  });

  it('٤ · والتركيزُ يعود إلى مَن فتح الطبقة (بند ٣١)', () => {
    const opener = document.createElement('button');
    opener.className = 'opener';
    document.body.append(opener);
    opener.focus();
    expect(document.activeElement.className).toBe('opener');

    const box = layer();
    const release = isolateBehind(box);
    expect(document.activeElement.className).toBe('a');
    box.remove();
    release();
    expect(document.activeElement.className).toBe('opener');
    opener.remove();
  });

  it('٥ · وTab يدور داخل الطبقة ولا يخرج منها (بند ٣١)', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const box = layer();
    const release = isolateBehind(box);

    const last = box.querySelector('.b');
    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(tab);
    /* ⚠️ من الآخِر يعود إلى الأوّل — لا يهرب إلى زرٍّ خلف الطبقة. */
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement.className).toBe('a');

    box.remove(); release(); outside.remove();
  });

  it('٦ · وحاجزُ الإيماءة يبتلع الضغطةَ الحقيقيّةَ ويرفع نفسَه', () => {
    const victim = document.createElement('button');
    let hits = 0;
    victim.addEventListener('click', () => { hits += 1; });
    document.body.append(victim);

    /*
     * ⚠️ `isTrusted` غيرُ قابلةٍ لإعادة التعريف بحكم المواصفة، فيُحقَن
     *    المِحَكُّ عبر المَنفذ المعلَن في الوحدة. والإثباتُ باللمس الحقيقيّ
     *    في المسبار لا هنا (راجع رأس الملفّ).
     */
    swallowGestureTail({ trusted: () => true });
    victim.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(hits).toBe(0);

    /* وبعد ابتلاع ضغطةٍ واحدةٍ يرفع نفسَه — فالتالية تمرّ. */
    victim.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(hits).toBe(1);
    victim.remove();
  });

  it('٧ · ولا يبتلع ما يُنقَر برمجيًّا — وإلّا كسر كلَّ زرٍّ يُنادى من كود', () => {
    const victim = document.createElement('button');
    let hits = 0;
    victim.addEventListener('click', () => { hits += 1; });
    document.body.append(victim);
    const lift = swallowGestureTail();
    /* الافتراضُ هو `isTrusted`، ونقرُ الكود ليس منه — فيمرّ. */
    victim.click();
    expect(hits).toBe(1);
    lift();
    victim.remove();
  });

  it('٨ · و`pointerdown` جديدٌ يرفع الحاجز — لا مؤقّتٌ مخترَع (بند ٥)', () => {
    const victim = document.createElement('button');
    let hits = 0;
    victim.addEventListener('click', () => { hits += 1; });
    document.body.append(victim);

    swallowGestureTail({ trusted: () => true });
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    /* الحاجزُ ارتفع بإيماءةٍ جديدة — لا بمرور زمن. */
    victim.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(hits).toBe(1);
    victim.remove();
  });

  it('٩ · والعارضُ والنوافذُ يستعملان نفسَ العازل — لا نسخةَ لكلّ شاشة (بند ٢٨)', async () => {
    const lb = codeOnly(await (await fetch('../js/components/lightbox.js')).text());
    const modal = codeOnly(await (await fetch('../js/components/modal.js')).text());
    for (const src of [lb, modal]) {
      expect(src.includes("from './overlay-guard.js'")).toBe(true);
      expect(src.includes('isolateBehind(')).toBe(true);
    }
  });

  it('١٠ · ولا مؤقّتٌ داخل العازل — الحدُّ إيماءةٌ لا زمن (بند ٥)', async () => {
    const src = codeOnly(await (await fetch('../js/components/overlay-guard.js')).text());
    for (const banned of ['setTimeout', 'setInterval', 'requestAnimationFrame']) {
      expect(`${banned}:${src.includes(banned)}`).toBe(`${banned}:false`);
    }
  });
});

/* ================================================================== *
 * ب · صدقُ زرِّ الصوت (بندا ٨ و٩ · بند ٣٥)
 * ================================================================== */

const snap = (over = {}) => ({
  mediaId: null, playing: false, currentTime: 0, duration: 0, hasTrack: false, ...over,
});

describe('WS-P2 · ب · زرُّ الصوت يقول الحقيقة', () => {
  it('١١ · زرٌّ لا يملك المقطعَ الحاليَّ يقول ▶ دائمًا', () => {
    const s = snap({ mediaId: 'A', playing: true, duration: 10, currentTime: 3 });
    expect(playStateOf(s, 'B')).toBe(PLAY_STATE.READY);
    expect(playStateOf(s, 'A')).toBe(PLAY_STATE.PLAYING);
  });

  it('١٢ · وواحدٌ فقط يعرض ❚❚ مهما كثرت الأزرار (بند ٨)', () => {
    const s = snap({ mediaId: 'B', playing: true, duration: 10, currentTime: 1 });
    const shown = ['A', 'B', 'C', 'D'].map((id) => playStateOf(s, id));
    expect(shown.filter((one) => one === PLAY_STATE.PLAYING)).toHaveLength(1);
  });

  it('١٣ · والإيقافُ يقول ▶، والضغطةُ التالية «كمّل» لا «ابدأ» (بند ٩)', () => {
    const paused = snap({ mediaId: 'A', playing: false, duration: 10, currentTime: 4 });
    expect(playStateOf(paused, 'A')).toBe(PLAY_STATE.PAUSED);
    expect(playIntent(paused, 'A')).toBe('resume');
  });

  it('١٤ · والنهايةُ تعود «جاهزًا» فتبدأ الضغطةُ من الأوّل (بند ٩)', () => {
    const ended = snap({ mediaId: 'A', playing: false, duration: 10, currentTime: 10 });
    expect(playStateOf(ended, 'A')).toBe(PLAY_STATE.READY);
    expect(playIntent(ended, 'A')).toBe('load');
  });

  it('١٥ · و«بيحمّل» ليست «بيشتغل» — ولا ❚❚ قبل أن يبدأ فعلًا (بند ٩)', () => {
    const s = snap({ mediaId: 'A', playing: false });
    expect(playStateOf(s, 'A', { loading: true })).toBe(PLAY_STATE.LOADING);
    expect(playIntent(s, 'A', { loading: true })).toBe('ignore');
  });

  it('١٦ · والفشلُ حالةٌ ظاهرةٌ لا صمت', () => {
    expect(playStateOf(snap(), 'A', { error: true })).toBe(PLAY_STATE.ERROR);
  });

  it('١٧ · وبدءُ مقطعٍ آخرَ يعيد الأوّلَ إلى ▶ فورًا (بند ٣٥)', () => {
    const host = document.createElement('div');
    host.innerHTML = audioButtonHtml({ mediaId: 'A', snapshot: snap({ mediaId: 'A', playing: true }) })
      + audioButtonHtml({ mediaId: 'B', snapshot: snap({ mediaId: 'A', playing: true }) });
    document.body.append(host);

    const [a, b] = host.querySelectorAll('[data-audio-btn]');
    expect(a.dataset.audioState).toBe(PLAY_STATE.PLAYING);
    expect(b.dataset.audioState).toBe(PLAY_STATE.READY);

    /* ب يأخذ الملكيّة. */
    refreshAudioButtons(host, snap({ mediaId: 'B', playing: true }));
    expect(a.dataset.audioState).toBe(PLAY_STATE.READY);
    expect(b.dataset.audioState).toBe(PLAY_STATE.PLAYING);
    host.remove();
  });

  it('١٨ · وإعادةُ الرسم لا تُنشئ عنصرًا جديدًا — تصحّح الموجود (بند ٢٩)', () => {
    const host = document.createElement('div');
    host.innerHTML = audioButtonHtml({ mediaId: 'A', snapshot: snap() });
    document.body.append(host);
    const before = host.querySelector('[data-audio-btn]');
    refreshAudioButtons(host, snap({ mediaId: 'A', playing: true }));
    expect(host.querySelector('[data-audio-btn]') === before).toBe(true);
    host.remove();
  });

  it('١٩ · والاسمُ المقروءُ يتبع الحالةَ ولا يكذب (بند ٣١)', () => {
    const host = document.createElement('div');
    host.innerHTML = audioButtonHtml({ mediaId: 'A', snapshot: snap(), name: 'تسجيل الجمارك' });
    document.body.append(host);
    const btn = host.querySelector('[data-audio-btn]');
    expect(btn.getAttribute('aria-label')).toContain('شغّل');
    refreshAudioButtons(host, snap({ mediaId: 'A', playing: true }));
    expect(btn.getAttribute('aria-label')).toContain('وقّف');
    host.remove();
  });

  it('٢٠ · ولا مشغّلَ ثانٍ ولا رايةَ محلّيّةٍ في العقد المشترك (بند ٨)', async () => {
    const src = codeOnly(await (await fetch('../js/components/audio-button.js')).text());
    for (const banned of ['new Audio(', "createElement('audio')", 'isPlaying =']) {
      expect(`${banned}:${src.includes(banned)}`).toBe(`${banned}:false`);
    }
    /* والورشةُ تستعمله بدل أن تحسب الحالةَ بيدها. */
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    expect(view.includes('audioButtonHtml(')).toBe(true);
    expect(view.includes('refreshAudioButtons(')).toBe(true);
    expect(view.includes('playIntent(')).toBe(true);
  });
});

/* ================================================================== *
 * ج · إعادةُ التسمية لا تمسّ الهُويّة (بندا ١٠ و٣٦)
 * ================================================================== */

describe('WS-P2 · ج · اسمٌ معروضٌ لا هُويّةٌ جديدة', () => {
  it('٢١ · التسميةُ تكتب `caption` وتُبقي المعرّفَ والبايتاتِ كما هي', async () => {
    const bytes = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' });
    const row = await media.create({ kind: 'image', caption: 'IMG_2026.png', blob: bytes });

    await setCaption(row.id, 'لافتة المستودع');
    const after = await media.get(row.id);

    expect(after.id).toBe(row.id);
    expect(after.caption).toBe('لافتة المستودع');
    expect(after.kind).toBe('image');
    expect(await after.blob.size).toBe(5);
    /* ⚠️ واسمُ الملفّ الأصليّ لا يُمَسّ — هو ما يُنزَّل (بند ١٠). */
    expect(after.filename === row.filename).toBe(true);
  });

  it('٢٢ · والاسمُ يُشذَّب ولا يُحفَظ بفراغاتٍ حوله', async () => {
    const row = await media.create({ kind: 'audio', caption: 'أ', blob: new Blob(['x']) });
    await setCaption(row.id, '   تسجيل الجمارك   ');
    expect((await media.get(row.id)).caption).toBe('تسجيل الجمارك');
  });

  it('٢٣ · ولا سجلَّ جديدٌ يُنشَأ لأجل التسمية (القاعدة ٥)', async () => {
    const src = codeOnly(await (await fetch('../js/services/media-service.js')).text());
    const from = src.indexOf('export async function setCaption');
    const body = src.slice(from, src.indexOf('\n}', from));
    for (const banned of ['media.create', 'destroy', 'filename']) {
      expect(`${banned}:${body.includes(banned)}`).toBe(`${banned}:false`);
    }
    expect(body.includes('media.update')).toBe(true);
  });

  it('٢٤ · والشاشةُ ترفض الاسمَ الفارغَ ولا تحفظه فراغًا (بند ١٠)', async () => {
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    const from = view.indexOf('async function renameMedia');
    expect(from > 0).toBe(true);
    const body = view.slice(from, view.indexOf('\n}\n', from));
    expect(body.includes('if (!name)')).toBe(true);
    expect(body.includes('setCaption(')).toBe(true);
  });
});

/* ================================================================== *
 * د · قشرةُ الورشة (بندا ٤ و١١)
 * ================================================================== */

describe('WS-P2 · د · الشريطُ يتنحّى', () => {
  it('٢٥ · تفضيلُ القشرة افتراضُه «مضغوط» و«بلا عائمات»', async () => {
    const { readChromePrefs, writeChromePrefs } = await import('../js/services/workspace/pane-prefs.js');
    localStorage.removeItem('lingolife.workspace.chrome');
    expect(readChromePrefs()).toEqual({ rail: 'compact', fabs: false });
    writeChromePrefs({ rail: 'full', fabs: true });
    expect(readChromePrefs()).toEqual({ rail: 'full', fabs: true });
    localStorage.removeItem('lingolife.workspace.chrome');
  });

  it('٢٦ · ولا وجهةَ تنقّلٍ تُحذَف — الكلماتُ تُخفى والأيقوناتُ تبقى (بند ٤)', async () => {
    const css = await (await fetch('../css/workspace.css')).text();
    /* المخفيُّ هو النصُّ داخل الزرّ لا الزرُّ نفسُه. */
    expect(css.includes('body.ws-rail-compact .nav-btn > span')).toBe(true);
    expect(css.includes('body.ws-rail-compact .nav-btn,')).toBe(true);
    /* ولا قاعدةٌ تُخفي `.nav-btn` كلَّه. */
    expect(/\.ws-rail-compact\s+\.nav-btn\s*\{[^}]*display:\s*none/.test(css)).toBe(false);
  });

  it('٢٧ · والعائماتُ تختفي في الورشة ما لم تُطلَب (بند ١١)', async () => {
    const css = await (await fetch('../css/workspace.css')).text();
    expect(css.includes('body.workspace-open .improve-fab')).toBe(true);
    expect(css.includes('body.ws-fabs-on.workspace-open .improve-fab')).toBe(true);
  });

  it('٢٨ · والقشرةُ تعود كما كانت عند مغادرة الورشة', async () => {
    const view = codeOnly(await (await fetch('../js/views/workspace-view.js')).text());
    const from = view.indexOf('export function disposeWorkspace');
    const body = view.slice(from, view.indexOf('\n}', from));
    expect(body.includes("classList.remove('ws-rail-compact', 'ws-fabs-on')")).toBe(true);
  });
});

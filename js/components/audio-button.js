/**
 * LingoLife — زرُّ تشغيلٍ يقول الحقيقة (WS-P2 · بندا ٨ و٩ · القاعدة ٢)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **القاعدةُ العامّة: الأيقونةُ ليست ذاكرةً، هي مِرآة**
 * ═══════════════════════════════════════════════════════════════
 *
 * كلُّ زرِّ تشغيلٍ في التطبيق يجب أن يشتقّ شكلَه من شيئين لا ثالثَ لهما:
 *
 *     ١. هُويّةُ المقطع الذي يملكه هذا الزرّ (`mediaId`)
 *     ٢. حالةُ `audio-service` الآن
 *
 * ولا رايةَ محلّيّة (`isPlaying = true`) — لأنّ المالكَ واحدٌ عالميّ،
 * وأيُّ نسخةٍ محلّيّةٍ من الحقيقة تنحرف عنها بعد أوّل تبديلِ مقطع:
 * يبدأ صوتٌ آخر، فيبقى الزرُّ الأوّل يعرض ❚❚ لمقطعٍ توقّف.
 *
 * ⚠️ **وواحدٌ فقط يعرض ❚❚ في الشاشة كلِّها** — بحكم البناء لا بالتنسيق:
 *    الشرطُ `snapshot.mediaId === mine`، ولا يصدق على اثنين.
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **و«بيحمّل» ليست «بيشتغل»** (بند ٩)
 * ═══════════════════════════════════════════════════════════════
 *
 * مقطعٌ على Drive وحدَه يحتاج جلبَ بايتاته أوّلًا. وعرضُ ❚❚ في تلك
 * اللحظة كذبةٌ صغيرةٌ لها ثمنٌ كبير: تضغط لتوقف ما لم يبدأ بعد.
 * فالحالةُ الرابعة قائمةٌ بذاتها، ويملكها المُستدعي لأنّه هو مَن يجلب.
 */

import { icon } from './icons.js';
import { esc } from '../utils/dom.js';

/** الحالاتُ الخمس التي قد يكون فيها زرُّ تشغيل. */
export const PLAY_STATE = Object.freeze({
  READY: 'ready',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ERROR: 'error',
});

const LABEL = Object.freeze({
  [PLAY_STATE.READY]: 'شغّل',
  [PLAY_STATE.LOADING]: 'بيحمّل…',
  [PLAY_STATE.PLAYING]: 'وقّف',
  [PLAY_STATE.PAUSED]: 'كمّل',
  [PLAY_STATE.ERROR]: 'حاوِل تاني',
});

/**
 * حالةُ زرٍّ بعينه — من لقطة الخدمة وهُويّة مقطعه.
 *
 * @param {object} snapshot لقطةُ `audio-service`
 * @param {string} mediaId المقطعُ الذي يملكه هذا الزرّ
 * @param {{loading?: boolean, error?: boolean}} [local] ما لا تعرفه الخدمة
 */
export function playStateOf(snapshot, mediaId, { loading = false, error = false } = {}) {
  if (error) return PLAY_STATE.ERROR;
  if (loading) return PLAY_STATE.LOADING;
  if (!mediaId || snapshot?.mediaId !== mediaId) return PLAY_STATE.READY;
  if (snapshot.playing) return PLAY_STATE.PLAYING;
  /*
   * ⚠️ **ومقطعٌ لم يبدأ أصلًا ليس «موقوفًا»** — عطبٌ كشفه التحقّقُ الحيّ:
   *    مقطعٌ حُمِّل ولم يُفكَّ ترميزُه يعطي `duration: 0` و`playing: false`،
   *    فكان الزرُّ يقول «كمّل» لشيءٍ لم يبدأ. و«كمّل» تَعِد باستئنافٍ
   *    من موضعٍ لا وجودَ له.
   */
  if (!snapshot.duration) return PLAY_STATE.READY;
  /*
   * ⚠️ **والنهايةُ ليست إيقافًا مؤقّتًا** (بند ٩): مقطعٌ انتهى يعود
   *    «جاهزًا» فالضغطةُ التالية تبدأ من أوّله. ومقطعٌ أُوقِف يعود
   *    «موقوفًا» فالضغطةُ تكمل من موضعه.
   */
  const ended = snapshot.currentTime >= snapshot.duration - 0.05;
  return ended ? PLAY_STATE.READY : PLAY_STATE.PAUSED;
}

/** ما يُرسَم داخل الزرّ لكلّ حالة. */
export function playFaceHtml(state, size = 16) {
  if (state === PLAY_STATE.LOADING) return '<span class="ws-spin" aria-hidden="true"></span>';
  return icon(state === PLAY_STATE.PLAYING ? 'pause' : 'play', size);
}

/**
 * زرُّ تشغيلٍ كاملًا — يُرسَم مرّةً ثم يُحدَّث في مكانه.
 *
 * ⚠️ **`data-audio-btn` هو العقد**: كلُّ زرٍّ يحمل هُويّةَ مقطعه في
 *    السمة، فيستطيع `refreshAudioButtons` أن يجدَه ويصحّحه بلا أن
 *    يعرف الشاشةُ التي رسمته شيئًا عن آلة الحالات.
 */
export function audioButtonHtml({
  mediaId, snapshot, loading = false, error = false,
  name = '', size = 16, className = '',
}) {
  const state = playStateOf(snapshot, mediaId, { loading, error });
  const label = `${LABEL[state]}${name ? ` ${name}` : ''}`;
  return `<button type="button" class="${className}" data-audio-btn="${esc(mediaId)}"
    data-audio-state="${state}" data-audio-size="${size}"
    aria-label="${esc(label)}" title="${esc(label)}"
    ${state === PLAY_STATE.LOADING ? 'disabled' : ''}
    >${playFaceHtml(state, size)}</button>`;
}

/**
 * يصحّح كلَّ أزرار التشغيل داخل جذرٍ — **بلا إعادة رسم اللوح**.
 *
 * ⚠️ **يُنادى من مشترِكٍ واحدٍ في الخدمة** (بند ٩): الخدمةُ تبثّ عدّةَ
 *    مرّاتٍ في الثانية أثناء التشغيل، وإعادةُ رسم القائمة مع كلّ بثٍّ
 *    تحرق الإطارات وتقطع أيَّ تمريرٍ جارٍ. وهذه تكتب سمةً ونصًّا فقط.
 *
 * @param {ParentNode} root
 * @param {object} snapshot
 * @param {{loading?: Set<string>, errors?: Set<string>}} [local]
 */
export function refreshAudioButtons(root, snapshot, { loading, errors } = {}) {
  if (!root) return;
  for (const btn of root.querySelectorAll('[data-audio-btn]')) {
    const id = btn.dataset.audioBtn;
    const next = playStateOf(snapshot, id, {
      loading: Boolean(loading?.has(id)),
      error: Boolean(errors?.has(id)),
    });
    if (btn.dataset.audioState === next) continue;
    const size = Number(btn.dataset.audioSize) || 16;
    btn.dataset.audioState = next;
    btn.innerHTML = playFaceHtml(next, size);
    btn.disabled = next === PLAY_STATE.LOADING;
    /* ⚠️ الاسمُ المقروء يتبع الحالةَ كذلك — وإلّا قال «شغّل» وهو يوقف. */
    const name = (btn.getAttribute('aria-label') || '').replace(/^\S+…?\s*/, '');
    btn.setAttribute('aria-label', `${LABEL[next]}${name ? ` ${name}` : ''}`);
  }
}

/**
 * ماذا تفعل ضغطةٌ على زرٍّ في حالته الحاليّة (بند ٩)؟
 *
 * ⚠️ **قرارٌ خالصٌ يُختبَر بلا متصفّح** — والتنفيذُ على المُستدعي لأنّه
 *    هو مَن يملك رابطَ المقطع وبياناته.
 *
 * @returns {'load'|'pause'|'resume'|'ignore'}
 */
export function playIntent(snapshot, mediaId, { loading = false } = {}) {
  if (loading) return 'ignore';
  const state = playStateOf(snapshot, mediaId);
  if (state === PLAY_STATE.PLAYING) return 'pause';
  if (state === PLAY_STATE.PAUSED) return 'resume';
  return 'load';
}

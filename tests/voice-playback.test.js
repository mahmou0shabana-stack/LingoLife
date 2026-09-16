/**
 * LingoLife — «اسمع تسجيلي»: التشغيل بعد بلاغ الجهاز الحقيقيّ (WS-O)
 *
 * ═══════════════════════════════════════════════════════════════
 * ⚠️ **زرٌّ حيٌّ بلا صوتٍ ولا رسالة — وثمانيةَ عشرَ اختبارًا لم يمسكوه**
 * ═══════════════════════════════════════════════════════════════
 *
 * سجّلتَ، وسمعتَ، ثم أعدتَ التسجيل لتحصل على لقطةٍ أفضل — وهو ما يفعله
 * كلُّ من يجرّب. ومن تلك اللحظة صار «▶ اسمع تسجيلي» لا ينطق شيئًا.
 *
 * والسببُ سطرٌ واحدٌ في خدمة الصوت:
 *
 *     if (current?.mediaId === track.mediaId) → بدّل التشغيل
 *
 * والمعاينةُ كانت تُحمَّل بمعرِّفٍ **ثابت** (`vo-preview`). فالتسجيلُ
 * الثاني — بلوبٌ آخرُ ورابطٌ آخر — يحمل نفسَ الاسم، فتقول الخدمةُ
 * «نفسُ المقطع» وتُبدّل التشغيل على الرابط **القديم** وقد أُبطِل.
 *
 * ⚠️ **ولم يكن اختبارٌ واحدٌ يشغّل شيئًا مرّتين بمصدرَين مختلفين.**
 *    كلُّها كانت تسأل «هل استُدعي المشغّل؟» — واستُدعي فعلًا. والذي
 *    كذب هو **الهُويّة** لا الاستدعاء.
 *
 * فهذا الملفُّ يختبر الظاهرةَ نفسَها: **مصدرٌ يتغيّر تحت معرِّفٍ ثابت**.
 */

import { describe, it, expect } from './test-runner.js';
import { api as audio, subscribe } from '../js/services/audio-service.js';

const modal = () => fetch('../js/modals/voice-attempts.js').then((r) => r.text());
const service = () => fetch('../js/services/audio-service.js').then((r) => r.text());
const shadowCss = () => fetch('../css/shadow.css').then((r) => r.text());

/** يجرّد التعليقات — الحارسُ يقيس الكودَ لا شرحَه. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*/g, '');

/** عنصرُ الصوت الوحيد الذي تملكه الخدمة. */
const el = () => document.querySelector('body > audio');

/**
 * نغمةٌ حقيقيّةٌ قصيرة — WAV بسيطٌ يفكّه كلُّ متصفّح.
 *
 * ⚠️ **وبايتاتٌ حقيقيّةٌ لا `blob:` مزيّف**: الاختبارُ يريد أن يعرف
 *    أن العنصرَ **حمّل** المصدرَ الجديد، ومصدرٌ لا يُفكّ ترميزُه يعطي
 *    `error` لا `loadedmetadata` — فيمرّ الاختبارُ على عطبٍ آخر.
 */
function tone(seconds = 0.4, freq = 440) {
  const rate = 8000;
  const frames = Math.round(rate * seconds);
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const ascii = (at, text) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i += 1) {
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** ينتظر شرطًا على عنصر الصوت — بمهلةٍ صريحةٍ لا بانتظارٍ ثابت. */
function until(check, ms = 3000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const spin = () => {
      let ok = false;
      try { ok = check(); } catch { ok = false; }
      if (ok) return resolve(true);
      if (Date.now() - started > ms) return reject(new Error('انتهت المهلة'));
      return setTimeout(spin, 25);
    };
    spin();
  });
}

/* ================================================================== *
 * أ…و — عقدُ الهُويّة والتبديل في خدمة الصوت (العطبُ الأصليّ)
 * ================================================================== */

describe('WS-O · مصدرٌ يتغيّر تحت معرِّفٍ ثابت', () => {
  it('أ · معاينةٌ غيرُ محفوظةٍ تُشغَّل من بايتاتها مباشرةً (بند ٥)', async () => {
    const url = URL.createObjectURL(tone());
    await audio.load({ mediaId: 'test:pending', url, title: 'معاينة' });
    await until(() => !el().paused);
    expect(el().paused).toBe(false);
    expect(el().src).toBe(url);
    audio.stop();
    URL.revokeObjectURL(url);
  });

  it('ب · ورابطٌ جديدٌ بنفس المعرِّف يُحمَّل — ولا يُبدَّل التشغيل', async () => {
    /*
     * ⚠️ **هذا هو الاختبارُ الذي كان غائبًا.** بلوبان مختلفان تحت
     *    معرِّفٍ واحد: القديمُ كان يبقى في العنصر، فيسمع المستعمِلُ
     *    لقطةً رماها — أو لا شيءَ إن أُبطل رابطُها.
     */
    const first = URL.createObjectURL(tone(0.4, 440));
    await audio.load({ mediaId: 'test:take', url: first });
    await until(() => el().src === first);

    const second = URL.createObjectURL(tone(0.6, 660));
    await audio.load({ mediaId: 'test:take', url: second });
    await until(() => el().src === second);

    expect(el().src).toBe(second);
    expect(el().src === first).toBe(false);
    audio.stop();
    URL.revokeObjectURL(first);
    URL.revokeObjectURL(second);
  });

  it('ج · ونفسُ الرابط بنفس المعرِّف يُبدِّل التشغيل ولا يُعيد التحميل', async () => {
    const url = URL.createObjectURL(tone(1.2));
    await audio.load({ mediaId: 'test:same', url });
    await until(() => !el().paused && el().currentTime > 0);
    const at = el().currentTime;

    await audio.load({ mediaId: 'test:same', url });          /* الضغطةُ الثانية */
    await until(() => el().paused);
    expect(el().paused).toBe(true);
    /* ⚠️ الموضعُ محفوظٌ — لم يُعَد التحميلُ من الصفر (بند ٢). */
    expect(el().currentTime >= at).toBe(true);
    expect(el().currentTime > 0).toBe(true);

    await audio.load({ mediaId: 'test:same', url });          /* الاستئناف */
    await until(() => !el().paused);
    expect(el().paused).toBe(false);
    audio.stop();
    URL.revokeObjectURL(url);
  });

  it('د · والإيقافُ المؤقّتُ يحفظ الموضعَ ثم يكمل منه (بندا ٢ و٤)', async () => {
    const url = URL.createObjectURL(tone(1.5));
    await audio.load({ mediaId: 'test:resume', url });
    await until(() => el().currentTime > 0.15);
    audio.pause();
    await until(() => el().paused);
    const at = el().currentTime;
    await new Promise((r) => setTimeout(r, 250));
    expect(el().currentTime).toBe(at);         /* لا يتحرّك وهو موقوف */

    await audio.play();
    await until(() => el().currentTime > at);
    expect(el().currentTime > at).toBe(true);  /* كمّل ولم يبدأ من الصفر */
    audio.stop();
    URL.revokeObjectURL(url);
  });

  it('هـ · والنهايةُ تُبلَّغ فتعود الحالةُ إلى «جاهز» (بند ٤)', async () => {
    const url = URL.createObjectURL(tone(0.35));
    await audio.load({ mediaId: 'test:end', url });
    await until(() => el().ended, 5000);
    const snapshot = audio.state;
    expect(snapshot.playing).toBe(false);
    expect(snapshot.duration > 0).toBe(true);
    expect(snapshot.currentTime >= snapshot.duration - 0.06).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('و · وفشلُ التشغيل يعود بسببٍ ولا يُبتلَع (بند ٨)', async () => {
    /*
     * ⚠️ **رفضٌ حقيقيٌّ لا مُلفَّق**: `load` بلا مقاطعَ لا تُعيّن مقطعًا،
     *    فـ`play()` لا تجد ما تشغّله. والمهمُّ أن يعود **سببٌ** لا
     *    `undefined` صامتة — وهي التي تركت الزرَّ ميّتًا بلا رسالة.
     */
    audio.clear();
    const outcome = await audio.play();
    expect(outcome.ok).toBe(false);
    expect(typeof outcome.reason).toBe('string');
  });

  it('ز · ومقطعان لا يشتغلان معًا — العنصرُ واحدٌ بنيويًّا (بند ١٢)', async () => {
    const a = URL.createObjectURL(tone(1.2, 440));
    const b = URL.createObjectURL(tone(1.2, 880));
    await audio.load({ mediaId: 'test:one', url: a });
    await until(() => !el().paused);
    await audio.load({ mediaId: 'test:two', url: b });
    await until(() => el().src === b);
    /* عنصرُ صوتٍ واحدٌ في المستند كلِّه — فالتزامنُ مستحيل. */
    expect(document.querySelectorAll('body > audio')).toHaveLength(1);
    expect(el().src).toBe(b);
    audio.stop();
    URL.revokeObjectURL(a);
    URL.revokeObjectURL(b);
  });

  it('ح · والمشتركون يقرؤون الحالةَ الحيّة (بند ١٠)', async () => {
    const seen = [];
    const off = subscribe((s) => seen.push(s.playing));
    const url = URL.createObjectURL(tone(0.8));
    await audio.load({ mediaId: 'test:watch', url });
    await until(() => seen.includes(true), 4000);
    expect(seen.includes(true)).toBe(true);
    off();
    audio.stop();
    URL.revokeObjectURL(url);
  });
});

/* ================================================================== *
 * ط…ف — عقدُ اللوحة: زرٌّ واحدٌ يتحوّل، وأخطاءٌ تُقال
 * ================================================================== */

describe('WS-O · لوحةُ «صوتي»: حالةُ تشغيلٍ صريحة', () => {
  it('ط · آلةُ حالاتِ تشغيلٍ مستقلّةٌ عن آلةِ التسجيل (بندا ٣ و٤)', async () => {
    const body = code(await modal());
    for (const state of ['READY', 'LOADING', 'PLAYING', 'PAUSED', 'ERROR']) {
      expect(body.includes(`${state}:`)).toBe(true);
    }
    /* ⚠️ و«وقف التسجيل» تبقى فعلًا آخرَ لا يُخلَط بالإيقاف المؤقّت. */
    expect(body.includes('⏹ وقّف التسجيل')).toBe(true);
    expect(body.includes('❚❚ إيقاف مؤقت')).toBe(true);
  });

  it('ي · وزرٌّ واحدٌ يتحوّل ▶ ↔ ❚❚ — لا زرَّان (بندا ٢ و١٥)', async () => {
    const body = code(await modal());
    /* نفسُ `data-vo="preview"` يحمل التسميتين — فالبقعةُ واحدة. */
    const main = body.slice(body.indexOf('function mainPlayHtml'));
    const block = main.slice(0, main.indexOf('function rowPlayHtml'));
    expect(block.includes('▶ اسمع تسجيلي')).toBe(true);
    expect(block.includes('❚❚ إيقاف مؤقت')).toBe(true);
    expect(block.includes('data-vo="preview"')).toBe(true);
    expect(block.includes('aria-pressed')).toBe(true);
  });

  it('ك · ولكلّ تسجيلٍ محفوظٍ زرُّه وحالتُه (بند ١٢)', async () => {
    const body = code(await modal());
    expect(body.includes('function rowPlayHtml')).toBe(true);
    expect(body.includes('isOn(mediaId)')).toBe(true);
    expect(body.includes('togglePlayback(id)')).toBe(true);
  });

  it('ل · والزمنُ يُكتَب في مكانه ولا يُعاد بناءُ اللوحة كلَّ إطار (بند ١٤)', async () => {
    const body = code(await modal());
    expect(body.includes('function paintClock')).toBe(true);
    expect(body.includes('data-vo-time')).toBe(true);
    /* ⚠️ والرسمُ الكاملُ **مشروطٌ بتغيّر الحالة** لا بكلّ بلاغ. */
    expect(/if \(changed\) paint\(\);\s*else paintClock\(\);/.test(body)).toBe(true);
  });

  it('م · والرابطُ لا يُبطَل والمشغّلُ يقرأ منه (بند ٧)', async () => {
    const body = code(await modal());
    expect(body.includes('liveUrls')).toBe(true);
    /* الإبطالُ مشروطٌ: إمّا ليس قيدَ التشغيل، وإمّا أُوقِف صراحةً. */
    expect(/if \(wasLive && !stopIfPlaying\) liveUrls\.add/.test(body)).toBe(true);
    expect(body.includes('for (const url of liveUrls) URL.revokeObjectURL(url)')).toBe(true);
  });

  it('ن · وفشلُ التشغيل يظهر بالعربيّة ومعه بابُ إعادة (بند ٨)', async () => {
    const body = code(await modal());
    expect(body.includes('تعذر تشغيل التسجيل')).toBe(true);
    expect(body.includes('جرّب تاني')).toBe(true);
    expect(body.includes('role="alert"')).toBe(true);
  });

  it('س · وتشغيلُ صوتك يُطالب بالناقل فيُسكِت المرجع (بند ٩)', async () => {
    const body = code(await modal());
    expect(body.includes('claimAudio(BUS')).toBe(true);
    expect(body.includes('releaseAudio(BUS)')).toBe(true);
  });

  it('ع · وتسجيلٌ على Drive وحدَه يمرّ بـ«بيحمّل» ثم يشتغل (بند ١٣)', async () => {
    const body = code(await modal());
    expect(body.includes('isCloudOnly(row)')).toBe(true);
    expect(body.includes('ensureBytes(id)')).toBe(true);
    expect(body.includes('PLAY.LOADING')).toBe(true);
    /* ⚠️ ولا نزّلُ كلَّ الوسائط: `ensureBytes` تأخذ مُعرِّفًا واحدًا. */
    expect(body.includes('ensureBytes(')).toBe(true);
  });

  it('ف · والعدّادُ يُقرأ من المحفوظ بعد نجاح الحفظ لا قبله (بند ١١)', async () => {
    const body = code(await modal());
    const commit = body.slice(body.indexOf('async function commit'));
    const block = commit.slice(0, commit.indexOf('function watchPlayback'));
    /* الفشلُ يخرج قبل أن يلمس السجلّ. */
    expect(block.includes('if (!result?.ok)')).toBe(true);
    const after = block.slice(block.indexOf('if (!result?.ok)'));
    expect(after.indexOf('return;') < after.indexOf('listAttempts')).toBe(true);
    expect(block.includes('attempts = await listAttempts(frozen.key)')).toBe(true);
  });

  it('ص · ولا مخزنَ تسجيلٍ ثالثٍ ولا مسجّلَ ثانٍ (بندا ٦ و١٦-O)', async () => {
    const body = code(await modal());
    expect(body.includes('new MediaRecorder')).toBe(false);
    expect(body.includes('getUserMedia')).toBe(false);
    expect(body.includes('indexedDB.open')).toBe(false);
    /* التخزينُ يمرّ بـ`saveAttempt` وحدَها — فوق media + practiceEvidence. */
    expect(body.includes('saveAttempt(')).toBe(true);
    /* ولا عنصرَ صوتٍ يملكه هذا الملفّ. */
    expect(body.includes("createElement('audio')")).toBe(false);
    expect(body.includes('new Audio(')).toBe(false);
  });

  it('ق · وخدمةُ الصوت تُعيد سببًا ولا تبتلع الرفض (بند ٨)', async () => {
    const body = code(await service());
    expect(/return \{ ok: false, reason: error\?\.name \|\| 'play-rejected' \}/.test(body)).toBe(true);
    /* والهُويّةُ زوجٌ: معرِّفٌ ورابط. */
    expect(body.includes("current?.url === track.url")).toBe(true);
  });

  it('ش · وتسجيلٌ على Drive وحدَه يُجلَب هو وحدَه ثم يصير قابلًا للتشغيل', async () => {
    /*
     * ⚠️ **اختبارُ سلوكٍ لا مسحُ نصّ**: نصنع صفًّا بلا بايتات كما يصل
     *    من جهازٍ آخر، ونُسجّل جالبًا يعدّ كم مرّةً نُودي وبأيّ مُعرِّف.
     *    فلو نزّلت اللوحةُ «كلَّ الوسائط» يومًا لَظهر العددُ فورًا.
     */
    const { media } = await import('../js/db/repositories.js');
    const { ensureBytes, isCloudOnly, setCloudFetcher, urlFor } = await import('../js/services/media-service.js');

    const here = await media.create({
      kind: 'audio', blob: tone(0.3), mime: 'audio/wav', filename: 'here.wav',
      bytes: 1, thumbBlob: null, durationMs: 300, caption: '', notes: '',
    });
    const away = await media.create({
      kind: 'audio', blob: null, blobPending: 1, mime: 'audio/wav', filename: 'away.wav',
      bytes: 1, thumbBlob: null, durationMs: 300, caption: '', notes: '',
    });

    expect(isCloudOnly(await media.get(away.id))).toBe(true);
    expect(urlFor(await media.get(away.id), { thumb: false })).toBe(null);

    const asked = [];
    setCloudFetcher(async (mediaId) => {
      asked.push(mediaId);
      await media.update(mediaId, { blob: tone(0.3), blobPending: 0 });
      return { ok: true };
    });

    const out = await ensureBytes(away.id);
    expect(out.ok).toBe(true);
    expect(asked).toEqual([away.id]);          /* واحدٌ فقط — لا الكلّ */
    expect(Boolean(out.record.blob)).toBe(true);
    expect(typeof urlFor(out.record, { thumb: false })).toBe('string');

    /* والمحلّيُّ لا يُنادى له جالبٌ أصلًا. */
    const local = await ensureBytes(here.id);
    expect(local.alreadyLocal).toBe(true);
    expect(asked).toHaveLength(1);

    setCloudFetcher(null);
  });

  it('ر · وزرُّ التشغيل يبقى كبيرًا على اللمس (بند ١٥)', async () => {
    const css = await shadowCss();
    expect(css.includes('.vo-play-mine { min-block-size: 64px')
      || /\.vo-play-mine\s*\{[^}]*min-block-size:\s*64px/.test(css)
      || /\.vo-rec,[\s\S]{0,80}\.vo-play-mine \{ min-block-size: 64px/.test(css)).toBe(true);
    expect(css.includes('.vo-row .btn-sm { min-width: 44px; min-height: 44px; }')).toBe(true);
  });
});

/* ================================================================== *
 * WS-VC1A — النطقُ المباشر يدخل التنسيق، والتسجيلُ يُعزَل             *
 * ================================================================== */
describe('WS-VC1A · لا صوتَ خارج التنسيق', () => {
  const view = () => fetch('../js/views/shadow-view.js').then((r) => r.text());
  const adapter = () => fetch('../js/services/shadow/tts/speaker-adapter.js').then((r) => r.text());

  it('١ · نطقُ الكلمة والمقطع صار مالكًا للصوت لا متطفّلًا', async () => {
    /*
     * ⚠️ **جردُ V0.1 وجد الثقب**: `speakScope` تنادي `ttsSpeaker.speak`
     *    مباشرةً — بلا محرّكٍ وبلا مطالبةٍ بالناقل. فلا تُسكِت أحدًا،
     *    ولا تُسكَت إلّا مصادفةً حين يكون المحرّكُ هو المالك.
     *
     * ⚠️ **والمحروسُ أربعةٌ معًا** — كلٌّ منها وحدَه يترك عطبًا:
     *    مطالبةٌ بالناقل · إلغاءٌ صريحٌ قبلها · حارسُ حلقةٍ · تحريرٌ
     *    مشروط. فلو مُطولِب بلا تذكرةٍ لَحرّر نطقٌ قديمٌ ملكيّةَ جديد.
     */
    const src = await view();
    const at = src.indexOf('async function speakScope');
    const body = src.slice(at, src.indexOf('\n}\n', at));
    expect(`يطالب: ${/claimAudio\(SPEAK_OWNER/.test(body)}`).toBe('يطالب: true');
    expect(`يُلغي قبلها: ${/speakTicket \+= 1;[\s\S]{0,120}ttsSpeaker\?\.cancel/.test(body)}`)
      .toBe('يُلغي قبلها: true');
    expect(`حارسُ الحلقة: ${/if \(myTicket !== speakTicket\) return;/.test(body)}`)
      .toBe('حارسُ الحلقة: true');
    expect(`تحريرٌ مشروط: ${/if \(myTicket === speakTicket\) releaseAudio\(SPEAK_OWNER\)/.test(body)}`)
      .toBe('تحريرٌ مشروط: true');
  });

  it('٢ · والمُطالِبُ لا يُسكِت نفسَه — نقرتان لا تُلغيان إحداهما الأخرى بالردّ', async () => {
    /*
     * ⚠️ **بندُك السابع**: «must not accidentally cancel itself through
     *    an ownership callback». والناقلُ يحميه بنيويًّا: `claimAudio`
     *    لا تنادي `silence` إلّا إن اختلف المُطالِبُ عن المالك. فيُقاس
     *    السلوكُ لا النيّة — مطالبتان بنفس الاسم، وصفرُ إسكات.
     */
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    let silenced = 0;
    bus.claimAudio('speak', () => { silenced += 1; });
    bus.claimAudio('speak', () => { silenced += 1; });
    expect(`أُسكِت ${silenced}`).toBe('أُسكِت 0');
    /* ومالكٌ مختلفٌ يُسكِت — وإلّا كان الحارسُ يقيس ناقلًا معطّلًا. */
    bus.claimAudio('session', () => {});
    expect(`بعد مالكٍ آخر ${silenced}`).toBe('بعد مالكٍ آخر 1');
    bus.forgetAudioOwner();
  });

  it('٣ · وتحريرٌ بائتٌ لا يسرق ملكيّةَ الأحدث', async () => {
    /*
     * ⚠️ **سباق د**: نطقٌ قديمٌ يعود بعد أن صار المالكُ غيرَه. لو حرّر
     *    بلا شرطٍ لأسكت الجديدَ — وهو عطبٌ يظهر كصمتٍ عشوائيّ.
     *    و`releaseAudio(id)` تتحقّق من الاسم؛ والتذكرةُ تتحقّق من
     *    الجيل. فيُقاس الأوّلُ هنا سلوكًا.
     */
    const bus = await import('../js/services/shadow/audio-bus.js');
    bus.forgetAudioOwner();
    bus.claimAudio('speak', () => {});
    bus.claimAudio('voice:x', () => {});
    bus.releaseAudio('speak');
    expect(`المالك ${bus.audioOwner()}`).toBe('المالك voice:x');
    bus.forgetAudioOwner();
  });

  it('٤ · وتوليدٌ يعود بعد الإلغاء لا يبدأ تشغيلًا', async () => {
    /*
     * ⚠️ **وهذا هو ما يُسرِّب المرجعَ إلى الميكروفون.** `cancel()` كانت
     *    تُلغي ما يُسمَع لا ما يُولَّد، وبين السطرين انتظارٌ قد يطول
     *    ثوانيَ عند مزوّدٍ مولِّد. فيبدأ الصوتُ **بعد** فتح الميكروفون.
     *
     * ⚠️ **ويُقاس ببوّابةٍ نتحكّم فيها** لا بمهلةٍ نرجوها: التوليدُ
     *    يقف حتّى نفتحه، فنُلغي وهو واقفٌ ثمّ نفتحه. فالسباقُ **مُنشأٌ
     *    حتمًا** لا مُنتظَر.
     */
    const { createTTSSpeaker } = await import('../js/services/shadow/tts/speaker-adapter.js');
    const { registerProvider, unregisterProvider } =
      await import('../js/services/shadow/tts/registry.js');

    let open = null;
    let reached = null;
    /*
     * ⚠️ **ولا دورانَ على المهامّ الدقيقة ولا مهلةٌ مقدَّرة.** جرّبتُ
     *    `await Promise.resolve()` في حلقةٍ حتّى تُفتَح البوّابة، فعلِق
     *    الاختبارُ إلى الأبد: طريقُ التوليد يمرّ بالذاكرة المشتركة
     *    (IndexedDB) وهي مهامُّ كبرى لا تتقدّم بدوران المهامّ الدقيقة.
     *    فبقيت `open` فارغةً، ولم يُفتَح شيءٌ، ولم يعُد الوعدُ أبدًا.
     *    والوعدُ أدناه **ينتظر الشرطَ نفسَه**: بلغ التوليدُ البوّابة.
     */
    const atGate = new Promise((resolve) => { reached = resolve; });
    let playedUrls = 0;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => { playedUrls += 1; return origCreate.call(URL, blob); };

    registerProvider({
      id: 'vc1a-slow', name: 'بطيء', type: 'piper',
      supportsOffline: true, supportsStreaming: false,
      supportsWord: true, supportsSentence: true, supportsLongText: true,
      async isAvailable() { return { available: true, status: 'ready_offline', reason: '' }; },
      async getVoices() { return []; },
      async synthesize() {
        await new Promise((resolve) => { open = resolve; reached(); });
        return {
          audioBlob: new Blob([new ArrayBuffer(44)], { type: 'audio/wav' }),
          audioUrl: null, playedDirectly: false, duration: 0,
          provider: 'vc1a-slow', voiceId: null, cacheKey: null,
          provenance: 'piper_generated', cached: false, error: null,
        };
      },
      cancel() {},
    });

    try {
      const speaker = createTTSSpeaker({ providerId: 'vc1a-slow' });
      const pending = speaker.speak('Прове́рка.', { rate: 1, volume: 0 });
      /* ينتظر حتّى يقف التوليدُ عند البوّابة فعلًا — ثمّ يُلغى وهو واقف. */
      await atGate;
      speaker.cancel();
      open();
      const out = await pending;
      expect(`شُغِّل: ${playedUrls}`).toBe('شُغِّل: 0');
      expect(`السبب ${out.reason} ونجاح ${out.ok}`).toBe('السبب aborted ونجاح false');
    } finally {
      URL.createObjectURL = origCreate;
      unregisterProvider('vc1a-slow');
    }
  });

  it('٥ · والمحوّلُ لا يطالب بالناقل — فدورةُ التكرار لا تُلغي نفسَها', async () => {
    /*
     * ⚠️ **بندُك الخامس**: «do not make every internal repetition appear
     *    to be a new competing foreground audio owner». المحرّكُ يطالب
     *    مرّةً عند ضغطة التشغيل، والتكرارُ داخلَه لا يطالب. فلو طالب
     *    المحوّلُ (وهو يُنادى مع كلّ تكرارة) لأسكتت الجلسةُ نفسَها كلَّ دورة.
     */
    const adapterSrc = await adapter();
    const bare = adapterSrc.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(`المحوّلُ يطالب: ${bare.includes('claimAudio')}`).toBe('المحوّلُ يطالب: false');
    const pc = await fetch('../js/services/shadow/playback-controller.js').then((r) => r.text());
    expect(`المحرّكُ يطالب: ${pc.replace(/\/\*[\s\S]*?\*\//g, '').includes('claimAudio')}`)
      .toBe('المحرّكُ يطالب: false');
  });

  it('٦ · ولوحةُ التسجيل تمنع المرجعَ ما دام الميكروفون مفتوحًا', async () => {
    /*
     * ⚠️ **حارسُ البدء وحدَه لا يكفي.** `releaseAudio()` تُسكِت المالكَ
     *    لحظةَ البدء — وصار النطقُ المباشرُ مالكًا فيُسكَت. لكنّ زرَّ
     *    «المرجع» يبقى معروضًا أثناء التسجيل، فضغطةٌ عليه **بعد** الحارس
     *    تُطلق صوتًا في أذن الميكروفون. فيُمنَع الفعلُ ما دام هناك مسجّل.
     *
     * ⚠️ **ومنعٌ لا إخفاء**: السماعُ خارجَ التسجيل لم يُمَسّ — وهو شرطُك
     *    «Do not permanently disable reference playback».
     */
    const src = await modal();
    expect(`زرُّ المرجع محروس: ${/action === 'ref'\) return recorder \? undefined : speakReference/.test(src)}`)
      .toBe('زرُّ المرجع محروس: true');
    expect(`والمقارنةُ كذلك: ${/async function playBoth\(\) \{[\s\S]{0,240}?if \(recorder\) return;/.test(src)}`)
      .toBe('والمقارنةُ كذلك: true');
    /* وحارسُ البدء القائمُ لم يُمَسّ. */
    expect(src).toContain('try { releaseAudio(); } catch');
  });

  it('٧ · ولم يُنشَأ مشغّلٌ ثانٍ ولا ناقلٌ ثانٍ', async () => {
    /*
     * ⚠️ **شرطُك السابع في معايير القبول**: «No second playback
     *    architecture has been introduced». فيُعَدُّ ما يُنشِئ صوتًا في
     *    الملفّات الثلاثة التي مُسَّت — العددُ كما كان قبل التمريرة.
     */
    const [viewSrc, adapterSrc, modalSrc] = await Promise.all([view(), adapter(), modal()]);
    const count = (s) => (s.replace(/\/\*[\s\S]*?\*\//g, '').match(/new Audio\(/g) || []).length;
    expect(`الشاشة ${count(viewSrc)}`).toBe('الشاشة 1');
    expect(`المحوّل ${count(adapterSrc)}`).toBe('المحوّل 1');
    expect(`اللوحة ${count(modalSrc)}`).toBe('اللوحة 0');
    /* ولا ناقلَ ثانٍ: المُصدِّرُ واحدٌ في المستودع. */
    const busSrc = await fetch('../js/services/shadow/audio-bus.js').then((r) => r.text());
    expect(busSrc).toContain('export function claimAudio');
  });
});

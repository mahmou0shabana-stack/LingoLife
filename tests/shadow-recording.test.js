/**
 * LingoLife — شاشةُ التدريب بعد بلاغ الجهاز الحقيقيّ (WS-M · أعطاب ١…٣)
 *
 * ⚠️ **ثلاثةُ أعطابٍ لم يُمسكها اختبارٌ واحدٌ قبل اليوم**، وكلُّها ظهرت
 *    في أوّل دقيقةٍ على تابلتٍ حقيقيّ. والدرسُ المشترك: كنّا نختبر
 *    **الخدمات** ولا نختبر **ما تصل إليه اليد**.
 *
 *   ١ · سطرُ «‹ SOURCE / SHADOWING ›» وسط سطح القراءة.
 *   ٢ · زرُّ نطقٍ ثانٍ للمقطع في السكّة، والرئيسيُّ ينطقه أصلًا.
 *   ٣ · زرُّ التسجيل **يُغلق اللوحة ولا يسجّل**: كلُّ زرٍّ في جسم
 *       النافذة بلا `type` هو `submit` لأن الجسمَ داخل `<form>` —
 *       فالضغطةُ تُرسِل النموذجَ وتُنهي اللوحة. وهذا يفسّر البلاغَ
 *       حرفيًّا: «مش عارف بدأ ولا لأ».
 *
 * ⚠️ **وهذه الأخيرةُ مصيدةٌ عامّةٌ في كلّ نوافذ التطبيق** — فحارسُها
 *    هنا يمسح كلَّ ملفّات `js/modals/` لا هذا الملفَّ وحدَه.
 */

import { describe, it, expect } from './test-runner.js';
import { resetDevices, on, TABLET } from './sync-devices.js';
import { practiceEvidence, media } from '../js/db/repositories.js';
import { saveAttempt, listAttempts, VOICE_PRACTICE_TYPE } from '../js/services/shadow/voice-attempts.js';

const view = () => fetch('../js/views/shadow-view.js').then((r) => r.text());
const modal = () => fetch('../js/modals/voice-attempts.js').then((r) => r.text());
const shadowCss = () => fetch('../css/shadow.css').then((r) => r.text());

/** يجرّد التعليقات — الحارسُ يقيس الكودَ لا شرحَه. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*/g, '');

/* ================================================================== *
 * أ · ب — سطرُ «المصدر / الظلّ» غادر سطحَ القراءة
 * ================================================================== */

describe('WS-M · سطحُ القراءة بلا لافتاتٍ عن نفسه', () => {
  it('أ · ولا سطرَ «SOURCE» داخل سطح التدريب', async () => {
    /*
     * ⚠️ **والمنزوعُ هو المُقلِّب، لا كلمةُ SOURCE أينما وقعت.** في
     *    شريط أدوات **الورقة اليسرى** زرّان («◂ SOURCE» / «TRANSCRIPT ▸»)
     *    يبدّلان بين النصّ الأصليّ وتفريغه — وهما فعلٌ حقيقيٌّ على
     *    سطحٍ آخر، لا لافتةٌ تسمّي الوضعَ الجاري. فالحارسُ يقيس ما
     *    كان داخل `.sh-book` فوق الصفحات: المُقلِّب.
     */
    const body = code(await view());
    expect(body.includes('data-pager')).toBe(false);
    expect(body.includes('sh-pager')).toBe(false);
    expect(body.includes('wirePager')).toBe(false);
  });

  it('ب · ولا زرَّ «SHADOWING» في المُقلِّب المنزوع', async () => {
    const body = code(await view());
    /*
     * ⚠️ **و«SHADOWING» في سكّة التنقّل شيءٌ آخر**: هي تسميةُ الشاشة
     *    الحاليّة في قائمة الشاشات (NOW · LIBRARY · SHADOWING · …)،
     *    وهي مكانُها الصحيح. المنزوعُ سطرٌ **داخل** سطح القراءة.
     */
    expect(body.includes('page-go')).toBe(false);
    expect(body.includes('SHADOWING ›')).toBe(false);
    expect(body.includes('‹ SOURCE')).toBe(false);
  });

  it('ب٢ · ولا فراغَ محجوزًا لمؤشّرٍ لم يعد موجودًا', async () => {
    /*
     * ⚠️ **نزعُ العنصر وحدَه يترك حفرة.** كان له `margin-block-end: 46px`
     *    على سطر التلميح يحجز مكانَه في وضع الصفحة الواحدة. فلو بقيت
     *    القاعدةُ لَرأيتَ فجوةً فارغةً بارتفاع ٤٦px — وهو ما نهى عنه
     *    البلاغ صراحةً.
     */
    /* ⚠️ ويُقاس الكودُ لا الشرح: تعليقُ النزع نفسُه يذكر ما نُزع. */
    const css = code(await shadowCss());
    expect(css.includes('.sh-pager')).toBe(false);
    if (/\.sh-hint\s*\{\s*margin-block-end:\s*46px/.test(css)) {
      throw new Error('الفراغُ المحجوز للمؤشّر ما زال');
    }
  });
});

/* ================================================================== *
 * ج · د — زرُّ نطقٍ واحدٌ للمقطع
 * ================================================================== */

describe('WS-M · فعلٌ واحدٌ بزرٍّ واحد', () => {
  it('ج · ولا أداةَ «اسمع المقطع» في السكّة', async () => {
    const text = await view();
    const at = text.indexOf('const TOOLS = [');
    const tools = code(text.slice(at, text.indexOf('\n];', at)));
    if (tools.includes('phrase-play')) throw new Error('أداةُ النطق المكرّرة ما زالت');
    if (tools.includes('اسمع المقطع')) throw new Error('تسميةُ النطق المكرّر ما زالت');
    /* وأخواتُها الحقيقيّاتُ الثانويّاتُ باقيات. */
    expect(tools).toContain('phrase-copy');
    expect(tools).toContain('phrase-save');
    expect(tools).toContain('phrase-exit');
  });

  it('د · ومسارُ النطق الوحيدُ هو المحرّك، ويعرف حدَّي المقطع', async () => {
    /*
     * ⚠️ **وهذا هو سببُ صحّة النزع.** `syncPhraseRange` تُعلم المحرّكَ
     *    بالمدى، فزرُّ ▶ ينطق المقطعَ لا الجملة. ولولا هذا السطرُ لكان
     *    النزعُ فقدانَ ميزةٍ لا إزالةَ تكرار.
     */
    const text = await view();
    expect(text).toContain('function syncPhraseRange');
    expect(text).toContain('phraseRange:');

    const at = text.indexOf('function togglePlay');
    const block = text.slice(at, text.indexOf('\n}', at));
    expect(block).toContain('player.toggle()');
    /* ولا نطقَ مباشرٌ يلتفّ حول المحرّك في زرّ التشغيل. */
    expect(code(block).includes('speakScope')).toBe(false);
  });
});

/* ================================================================== *
 * هـ … ك — آلةُ حالات التسجيل
 * ================================================================== */

describe('WS-M · التسجيل: أربعُ حالاتٍ صريحة', () => {
  it('هـ٠ · وكلُّ زرٍّ في جسم النافذة `type="button"` — وإلّا أغلقها', async () => {
    /*
     * ═══════════════════════════════════════════════════════════
     * ⚠️ **هذا هو العطبُ الثالثُ بعينه، وهذا حارسُه**
     * ═══════════════════════════════════════════════════════════
     * `showModal` يلفّ الجسمَ في `<form data-modal-form>`. وزرٌّ بلا
     * `type` داخل نموذجٍ هو `submit` بالمواصفة — فضغطةُ «🎙 سجّل صوتي»
     * كانت تُرسِل النموذجَ وتُغلق اللوحة. لا رسالةَ خطأ، ولا تسجيل،
     * ولا شيءَ في السجلّ: تضغط فتُغلَق النافذةُ في وجهك.
     *
     * والمصيدةُ عامّةٌ لكلّ نافذة، فالحارسُ يمسح `js/modals/` كلَّها.
     */
    const files = [
      'voice-attempts', 'language-history', 'memory-review',
    ];
    const bad = [];
    for (const name of files) {
      /* eslint-disable-next-line no-await-in-loop */
      const text = await fetch(`../js/modals/${name}.js`).then((r) => r.text());
      for (const [whole] of text.matchAll(/<button(?![^>]*\btype=)[^>]*>/g)) {
        bad.push(`${name}: ${whole.slice(0, 54)}`);
      }
    }
    if (bad.length) throw new Error(`زرٌّ بلا type داخل نموذج:\n  ${bad.join('\n  ')}`);
    expect(bad).toHaveLength(0);
  });

  it('هـ · وضغطةُ الميكروفون تدخل حالةَ تسجيلٍ معلَنة', async () => {
    const text = await modal();
    expect(text).toContain("data-vo=\"rec\"");
    expect(text).toContain('سجّل صوتي');
    /* والحالةُ مكتوبةٌ في السِّمة فتُقرأ من الخارج ومن الاختبار. */
    expect(text).toContain('data-vo-stage');
    expect(text).toContain("'recording'");
  });

  it('و · والحالةُ تعرض زمنًا يمشي بصيغة MM:SS', async () => {
    const text = await modal();
    expect(text).toContain('data-vo-clock');
    const at = text.indexOf('const clockOf');
    const block = text.slice(at, text.indexOf('};', at));
    /* خانتان للدقائق وخانتان للثواني — «٠٠:٠٧» لا «0:7». */
    expect(block).toContain("padStart(2, '0')");
    expect(text).toContain('جاري التسجيل');
  });

  it('ز · وفيها زرُّ إيقافٍ صريحٌ لا يُخبَّأ', async () => {
    const text = await modal();
    expect(text).toContain('data-vo="stop"');
    expect(text).toContain('وقّف التسجيل');
    /*
     * ⚠️ **وحجمُه يُقاس** (بند ٣-ح): زرٌّ صغيرٌ في زاوية «موجود» لكنه
     *    ليس «لا يُخطَأ». والقاعدةُ تعطيه ٦٤px بعرض اللوحة.
     */
    const css = await shadowCss();
    const at = css.indexOf('.vo-rec,\n.vo-stop');
    const block = css.slice(at, css.indexOf('}', at));
    expect(block).toContain('64px');
    expect(block).toContain('100%');
  });

  it('ح · والإيقافُ يخرج من الحالة إلى مراجعة', async () => {
    const text = await modal();
    expect(text).toContain('function endRecording');
    const at = text.indexOf('function endRecording');
    const block = code(text.slice(at, text.indexOf('\n  }', at)));
    /* يُصفّر المسجّل ويوقف الساعة والمقياس ثم يضع `pending`. */
    expect(block).toContain('recorder = null');
    expect(block).toContain('stopTicker()');
    expect(block).toContain('stopMeter()');
    expect(block).toContain('pending =');
  });

  it('ط · والمراجعةُ تعرض تشغيلَ تسجيلك ومدّتَه', async () => {
    const text = await modal();
    expect(text).toContain('data-vo="preview"');
    expect(text).toContain('اسمع تسجيلي');
    expect(text).toContain('formatDuration(pending.durationMs)');
  });

  it('ي · وإعادةُ التسجيل بابٌ صريح', async () => {
    const text = await modal();
    expect(text).toContain('data-vo="again"');
    expect(text).toContain('سجّل من جديد');
    /*
     * ⚠️ **والمدى يُقاس بالفرع لا بعدد الحروف.** كان `slice(at, at + 90)`،
     *    فلمّا تمدّد الفرعُ إلى أربعة أسطر (إسقاطُ المعاينة صار يوقف
     *    تشغيلَها أوّلًا) سقط الاختبارُ على **تنسيق** لا على سلوك.
     *    والحارسُ الذي يسقط على إعادة تنسيقٍ يُدرَّب المرءُ على تجاهله.
     */
    const at = text.indexOf("if (action === 'again')");
    const branch = text.slice(at, text.indexOf("if (action === 'discard')", at));
    expect(branch).toContain('beginRecording()');
  });

  it('ك · والعطبُ يبقى مكتوبًا ولا يختفي وحدَه', async () => {
    /*
     * ⚠️ **الـtoast يمرّ في ثوانٍ.** ومَن رفع إصبعَه ونظر بعدها لا يجد
     *    شيئًا فيظنّ أن الضغطة لم تصل — وهو نصفُ البلاغ الأصليّ.
     *    فالعطبُ يُكتَب في اللوحة نفسِها ومعه بابُ إعادةٍ حين تنفع.
     */
    const text = await modal();
    expect(text).toContain('vo-fail');
    expect(text).toContain("role=\"alert\"");
    for (const state of [
      'مديتش إذن الميكروفون',
      'مفيش ميكروفون متاح',
      'التسجيل اتقطع',
      'التسجيل طلع فاضي',
      'مقدرناش نحفظ التسجيل',
    ]) {
      if (!text.includes(state)) throw new Error(`حالةُ عطبٍ بلا رسالة: ${state}`);
    }
    /*
     * ⚠️ **وفشلُ الحفظ لا يمحو `pending`** — تسجيلُك يبقى لتعيد المحاولة
     *    بضغطةٍ بلا أن تنطق من جديد. والقياسُ على **جسم الشرط وحدَه**:
     *    `dropPending()` تقع بعده في مسار النجاح، فقصُّ ما بعد الشرط
     *    كلِّه يلتقطها ويكذب.
     */
    const at = text.indexOf('async function commit');
    const block = text.slice(at, text.indexOf('\n  }', at));
    const from = block.indexOf('if (!result?.ok)');
    const failBranch = block.slice(from, block.indexOf('\n    }', from));
    expect(failBranch).toContain('failure =');
    expect(failBranch).toContain('return');
    expect(failBranch.includes('dropPending')).toBe(false);
  });

  it('ك٢ · والمؤشّرُ يقرأ الميكروفونَ حقًّا أو لا يوجد', async () => {
    /*
     * ⚠️ **بند ٣-ز صريح**: لا رسمَ متحرّكٌ يتظاهر بأنه يسمع. فالقاعدةُ
     *    بلا `animation`، والعرضُ يُكتَب من `AnalyserNode` الحقيقيّة.
     */
    const text = await modal();
    expect(text).toContain('createAnalyser');
    expect(text).toContain('getByteTimeDomainData');
    expect(text).toContain('createMediaStreamSource');

    const css = await shadowCss();
    const at = css.indexOf('.vo-meter {');
    const block = css.slice(at, css.indexOf('.vo-meter > i', at) + 200);
    if (/animation:/.test(block)) throw new Error('المقياسُ يتحرّك بلا صوت');
  });

  it('ل · والمرجعُ يُسكَت قبل أن يفتح الميكروفون', async () => {
    /*
     * ⚠️ **بند ٣-ج**: لا شيءَ كان يوقف القراءةَ الآليّة عند بدء
     *    التسجيل، فيدخل صوتُها في تسجيلك من مكبّر الجهاز نفسِه.
     */
    const text = await modal();
    const at = text.indexOf('async function beginRecording');
    const before = text.slice(at, text.indexOf('startRecording()', at));
    expect(before).toContain('releaseAudio()');
    expect(before).toContain('audio.pause');
  });
});

/* ================================================================== *
 * م · ن · س — الحالةُ والهدفُ والمخزن
 * ================================================================== */

describe('WS-M · التسجيل داخل الجلسة لا فوقها', () => {
  it('م · ولا تلمس اللوحةُ جلسةَ التدريب ولا إعداداتِها', async () => {
    /*
     * ⚠️ **التسجيلُ تفاعلٌ داخل الجلسة لا جلسةٌ جديدة** (بند ٣-ط):
     *    الجملةُ والسرعةُ والتكرارُ والتحديدُ تبقى كما هي. والحارسُ
     *    بنيويّ: اللوحةُ لا تملك بابًا إلى حالة المشغّل أصلًا.
     */
    const body = code(await modal());
    for (const forbidden of [
      'shadowSessions', 'saveSessionSettings', 'player.', 'goTo(',
      'setPractice', 'updateSettings',
    ]) {
      if (body.includes(forbidden)) throw new Error(`اللوحةُ تمسّ الجلسة: ${forbidden}`);
    }
    expect(body).toContain('startRecording');
  });

  it('ن · والمحفوظُ مربوطٌ بالهدف بعينه — بلقطةٍ لا بقراءةٍ متأخّرة', async () => {
    await resetDevices();
    const saved = await on(TABLET, async () => {
      const file = new File([new Uint8Array(2048)], 'a.webm', { type: 'audio/webm' });
      const out = await saveAttempt({
        file,
        target: {
          ok: true,
          key: 'SHG_TEST|phrase',
          scope: 'phrase',
          text: 'до пятницы',
          segmentId: 'SHG_TEST',
          sessionId: 'SHS_TEST',
          sceneId: null,
          from: 3, to: 4,
        },
        durationMs: 1500,
      });
      return out;
    });
    expect(saved.ok).toBe(true);

    const rows = await on(TABLET, () => practiceEvidence.getAll());
    expect(rows).toHaveLength(1);
    /* ═══ الهدفُ بعينه: المفتاحُ والمدى والنصُّ كما نُطق ═══ */
    expect(rows[0].targetId).toBe('SHG_TEST|phrase');
    expect(rows[0].targetText).toBe('до пятницы');
    expect(rows[0].scope).toBe('phrase');
    expect(rows[0].rangeFrom).toBe(3);
    expect(rows[0].rangeTo).toBe(4);
    expect(rows[0].practiceType).toBe(VOICE_PRACTICE_TYPE);

    /* ⚠️ ولا يُقرأ إحصاءَ إتقان: تسجيلٌ ليس دليلَ استعمالٍ حقيقيّ. */
    expect(rows[0].impliesRealUsage).toBe(false);
    expect(rows[0].impliesMastery).toBe(false);

    const listed = await on(TABLET, () => listAttempts('SHG_TEST|phrase'));
    expect(listed).toHaveLength(1);
  });

  it('س · ولا مخزنَ تسجيلٍ ثالثٍ يُستحدَث', async () => {
    /*
     * ⚠️ **البايتاتُ في `media` والواقعةُ في `practiceEvidence`** — لا
     *    ثالثَ لهما. ومخزنٌ جديدٌ يعني تاريخًا يعيش خارج النسخ
     *    الاحتياطيّ والمزامنة معًا.
     */
    const { STORES } = await import('../js/db/schema.js');
    const names = Object.keys(STORES);
    for (const invented of ['recordings', 'voiceRecordings', 'attempts', 'voiceAttempts']) {
      if (names.includes(invented)) throw new Error(`مخزنٌ مستحدَث: ${invented}`);
    }
    const rows = await on(TABLET, () => media.getAll());
    expect(rows.length >= 1).toBe(true);

    /* والخدمةُ تكتب في الاثنين وحدَهما. */
    const service = code(await fetch('../js/services/shadow/voice-attempts.js').then((r) => r.text()));
    expect(service).toContain('practiceEvidence.create');
    expect(service).toContain('media');
  });
});

/**
 * LingoLife — Voice Center V1.0C · الخطوة ١: هُويّةُ الصوت بحسب المزوّد
 *
 * ⚠️ **والقديمُ والجديدُ يُحرَسان معًا.** كلُّ `voiceId` مخزَّنٍ حتّى اليوم
 *    يجب أن يُقرأ كما كان يُقرأ بالحرف، وأن يبقى في صفّه بعد أيّ كتابة؛
 *    والخريطةُ الجديدةُ يجب ألّا تُسلِّم صوتَ مزوّدٍ لمزوّدٍ آخر.
 *
 * ⚠️ **والوحدةُ تُشغَّل لا تُقرأ**: `voice-identity.js` خالصة، فتُستورَد
 *    وتُنادى على سجلّاتٍ بأشكال القاعدة الحقيقيّة. وأسلاكُ الشاشة وحدَها
 *    تُقرأ من المصدر — لأنّها سطورُ استدعاءٍ لا منطق.
 */

import { describe, it, expect } from './test-runner.js';
import {
  voiceMapOf, voiceFor, voicePatch, LEGACY_VOICE_PROVIDER,
} from '../js/services/shadow/voice-identity.js';
import { BROWSER_PROVIDER_ID } from '../js/services/shadow/tts/browser-provider.js';

const OTHER = 'piper';

/** يُسقط التعليقات — يُقرأ كودٌ لا شرح. */
const bare = (s) => s
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('Voice Center V1.0C · القديمُ يُقرأ كما كان', () => {
  it('١ · الحقلُ القديمُ صوتُ مزوّد المتصفّح — وهو ما يقرؤه كلُّ قارئٍ اليوم', () => {
    expect(LEGACY_VOICE_PROVIDER).toBe(BROWSER_PROVIDER_ID);
    const old = { voiceId: 'Milena' };
    expect(voiceFor(old)).toBe('Milena');
    expect(voiceFor(old, BROWSER_PROVIDER_ID)).toBe('Milena');
    expect(voiceMapOf(old)).toEqual({ [BROWSER_PROVIDER_ID]: 'Milena' });
  });

  it('٢ · والترحيلُ عند القراءة لا يمسّ السجلّ', () => {
    const old = { voiceId: 'Milena', speed: 0.8 };
    const snapshot = JSON.stringify(old);
    voiceMapOf(old);
    voiceFor(old);
    voicePatch(old, BROWSER_PROVIDER_ID, 'Yuri');
    expect(JSON.stringify(old)).toBe(snapshot);
  });

  it('٣ · وبلا صوتٍ مخزَّنٍ لا يُخترَع صوت', () => {
    expect(voiceFor({})).toBe(null);
    expect(voiceFor(null)).toBe(null);
    expect(voiceFor({ voiceId: null })).toBe(null);
    expect(voiceFor({ voiceId: '' })).toBe(null);
    expect(voiceMapOf({})).toEqual({});
  });

  it('٤ · والقديمُ لا يتسرّب إلى مزوّدٍ آخر', () => {
    /*
     * ⚠️ **وهذا سببُ الخطوة كلِّها**: اسمُ صوتٍ من الجهاز لا معنى له
     *    عند Piper. والحقلُ المسطَّحُ كان يسلّمه لأيّ محرّك.
     */
    expect(voiceFor({ voiceId: 'Milena' }, OTHER)).toBe(null);
  });

  it('٥ · وخريطةٌ فاسدةُ الشكل لا تُسقط القديم', () => {
    for (const bad of [[], 'x', 7, null]) {
      expect(voiceFor({ voiceId: 'Milena', voiceByProvider: bad })).toBe('Milena');
    }
  });
});

describe('Voice Center V1.0C · الجديدُ يغلب ولا يمحو', () => {
  it('٦ · مدخلُ الخريطة يغلب الحقلَ القديم', () => {
    const both = { voiceId: 'Old', voiceByProvider: { [BROWSER_PROVIDER_ID]: 'New' } };
    expect(voiceFor(both)).toBe('New');
  });

  it('٧ · و«الافتراضيّ» الصريحُ لا يُبعَث فوقه القديم', () => {
    /*
     * ⚠️ **`null` في الخريطة اختيارٌ لا غياب.** لو مُلئ من القديم لعاد
     *    صوتٌ اخترتَ تركَه — فالقديمُ يملأ **الغيابَ** وحدَه.
     */
    const chosenDefault = { voiceId: 'Old', voiceByProvider: { [BROWSER_PROVIDER_ID]: null } };
    expect(voiceFor(chosenDefault)).toBe(null);
  });

  it('٨ · وكلُّ مزوّدٍ بصوته', () => {
    const s = { voiceByProvider: { [BROWSER_PROVIDER_ID]: 'Milena', [OTHER]: 'ru_RU-irina-medium' } };
    expect(voiceFor(s)).toBe('Milena');
    expect(voiceFor(s, OTHER)).toBe('ru_RU-irina-medium');
  });
});

describe('Voice Center V1.0C · الكتابة', () => {
  it('٩ · صوتُ المتصفّح يُكتَب في الخريطة، والقديمُ معه مرآةً', () => {
    const patch = voicePatch({ voiceId: 'Old' }, BROWSER_PROVIDER_ID, 'New');
    expect(patch.voiceByProvider).toEqual({ [BROWSER_PROVIDER_ID]: 'New' });
    /* ⚠️ والمرآةُ هي ما يُبقي نسخةً أقدمَ ونسخةً احتياطيّةً وجهازًا ثانيًا يقرأ الصحيح. */
    expect(patch.voiceId).toBe('New');
  });

  it('١٠ · وصوتُ مزوّدٍ آخر لا يمسّ الحقلَ القديم', () => {
    const patch = voicePatch({ voiceId: 'Milena' }, OTHER, 'ru_RU-irina-medium');
    expect(`يمسّ القديم: ${'voiceId' in patch}`).toBe('يمسّ القديم: false');
    /* والقديمُ يُرحَّل إلى الخريطة لا يضيع منها. */
    expect(patch.voiceByProvider).toEqual({
      [BROWSER_PROVIDER_ID]: 'Milena', [OTHER]: 'ru_RU-irina-medium',
    });
  });

  it('١١ · والكتابةُ لا تحذف ما سبقها — دمجٌ لا استبدال', () => {
    /*
     * ⚠️ **وهذا شرطُ «لا تحذف القديم» بعد الكتابة لا قبلها فقط.**
     *    الرقعةُ تُدمَج في الصفّ (`update`)، فكلُّ حقلٍ لا تحمله يبقى.
     */
    const row = { voiceId: 'Milena', speed: 0.8 };
    const after = { ...row, ...voicePatch(row, OTHER, 'irina') };
    expect(after.voiceId).toBe('Milena');
    expect(after.speed).toBe(0.8);
    expect(voiceFor(after)).toBe('Milena');
    expect(voiceFor(after, OTHER)).toBe('irina');
  });

  it('١٢ · و«الافتراضيّ» يُكتَب null صريحًا في الطرفين', () => {
    const patch = voicePatch({ voiceId: 'Milena' }, BROWSER_PROVIDER_ID, '');
    expect(patch.voiceByProvider[BROWSER_PROVIDER_ID]).toBe(null);
    expect(patch.voiceId).toBe(null);
    expect(voiceFor({ voiceId: 'Milena', ...patch })).toBe(null);
  });
});

describe('Voice Center V1.0C · أسلاكُ الشاشة', () => {
  let SRC = '';
  const view = async () => {
    if (!SRC) SRC = bare(await (await fetch('../js/views/shadow-view.js')).text());
    return SRC;
  };

  it('١٣ · لا قراءةَ مسطَّحةً باقيةً للصوت في الشاشة', async () => {
    const src = await view();
    const flat = src.match(/session\??\.voiceId/g) || [];
    expect(`قراءاتٌ مسطَّحة: ${flat.length}`).toBe('قراءاتٌ مسطَّحة: 0');
    expect(`قراءاتٌ بالمزوّد: ${(src.match(/voiceFor\(/g) || []).length >= 8}`)
      .toBe('قراءاتٌ بالمزوّد: true');
  });

  it('١٤ · والكتابةُ الوحيدةُ رقعةُ مزوّد المتصفّح', async () => {
    const src = await view();
    expect(`كتابةٌ مسطَّحة: ${/saveSessionSettings\([^)]*\{\s*voiceId:/.test(src)}`)
      .toBe('كتابةٌ مسطَّحة: false');
    expect(`بالرقعة: ${/voicePatch\(ctx\.session, BROWSER_PROVIDER_ID, voiceName\)/.test(src)}`)
      .toBe('بالرقعة: true');
  });

  it('١٥ · والمحرّكُ يُعطى الصوتَ محلولًا ولا يُمَسّ', async () => {
    /*
     * ⚠️ **شرطُك: لا تغييرَ في سلوك التشغيل ولا في المزوّدين.** فالمحرّكُ
     *    باقٍ يقرأ settings.voiceId كما كان — والشاشةُ تحلّه له من الخريطة.
     */
    const src = await view();
    /*
     * ⚠️ **ويُحَلّ بصوت المزوّد المفعَّل** (متصفّح الأصوات، V1.0C) — وهو
     *    لمزوّد المتصفّح `voiceFor(session)` بالحرف، فلا يتغيّر شيءٌ لمن
     *    لم يغيّر المزوّد؛ وغيرُه يأخذ مدخلَه لا صوتَ الجهاز.
     */
    expect(`يُحَلّ عند البناء: ${/settings: \{ \.\.\.session, voiceId: activeVoiceName\(session\)/.test(src)}`)
      .toBe('يُحَلّ عند البناء: true');
    expect(`بمزوّده: ${/return voiceFor\(session, ctx\?\.ttsProviderId \|\| BROWSER_PROVIDER_ID\);/.test(src)}`)
      .toBe('بمزوّده: true');
    const engine = await (await fetch('../js/services/shadow/playback-controller.js')).text();
    expect(`المحرّكُ كما كان: ${/voiceName: settings\.voiceId \?\? null,/.test(engine)}`)
      .toBe('المحرّكُ كما كان: true');
    expect(`ولا يعرف الخريطة: ${/voiceByProvider|voice-identity/.test(bare(engine))}`)
      .toBe('ولا يعرف الخريطة: false');
  });
});

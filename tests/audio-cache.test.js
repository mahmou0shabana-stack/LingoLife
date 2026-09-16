/**
 * LingoLife — هويّةُ الصوت المولَّد (WS-VC1B)
 *
 * ═══════════════════════════════════════════════════════════════
 * ما يحرسه هذا الملفّ
 * ═══════════════════════════════════════════════════════════════
 *
 * مفتاحُ ذاكرة الصوت كان يمرّ بـ`normalizeRussian` — دالّةِ بحثٍ
 * تُسقط النبرَ وتطوي `ё` إلى `е`. فكان «قصرٌ» و«قُفل» ملفًّا واحدًا.
 *
 * ⚠️ **ولا يُقاس نصٌّ مطبَّعٌ هنا، بل مفاتيحُ محسوبة** — ومعها، حيث
 *    يلزم، **عددُ نداءات التوليد** و**الصفوفُ المخزَّنة فعلًا**.
 *    مقارنةُ التطبيع تحرس التنفيذَ الحاليّ؛ ومقارنةُ المفاتيح تحرس
 *    الوعدَ نفسَه: نطقان مختلفان لا يتقاسمان ملفًّا.
 *
 * ⚠️ **والبيئةُ هنا هي قاعدةُ الاختبار المعزولة** — صفحةُ الاختبارات
 *    تُفرِّغ القاعدةَ خلف بوّابةِ تحذيرٍ صريحة (راجع `tests/index.html`)،
 *    فالكتابةُ في `generatedAudio` هنا لا تلمس قاعدةَ مستخدمٍ حقيقيّ.
 */

import { describe, it, expect } from './test-runner.js';

const cache = () => import('../js/services/shadow/tts/audio-cache.js');
const repos = () => import('../js/db/repositories.js');

const BASE = {
  language: 'ru', providerId: 'p-test', voiceId: 'v-test', settingsKey: 'speed=1',
};

/** مفتاحٌ واحد بإعداداتٍ ثابتة — لا يتغيّر إلّا ما نغيّره عمدًا. */
async function keyOf(text, extra = {}) {
  const { computeCacheKey } = await cache();
  const { cacheKey } = await computeCacheKey({ ...BASE, text, ...extra });
  return cacheKey;
}

/**
 * مزوّدٌ محقونٌ يعدّ نداءاته ويُرجع بايتاتٍ تحمل نصَّها — فيُعرَف أيُّ
 * صوتٍ عاد، لا أنّ صوتًا ما عاد.
 */
function fakeProvider(id, overrides = {}) {
  const calls = [];
  return {
    calls,
    provider: {
      id, name: id, type: 'piper',
      supportsOffline: true, supportsStreaming: false,
      supportsWord: true, supportsSentence: true, supportsLongText: true,
      async isAvailable() { return { available: true, status: 'ready_offline', reason: '' }; },
      async getVoices() { return []; },
      async synthesize({ text, language, voiceId, speed }) {
        calls.push({ text, language, voiceId, speed });
        return {
          audioBlob: new Blob([text], { type: 'audio/wav' }),
          audioUrl: null, playedDirectly: false, duration: 0,
          provider: id, voiceId, cacheKey: null,
          provenance: 'piper_generated', cached: false, error: null,
        };
      },
      cancel() {},
      ...overrides,
    },
  };
}

describe('WS-VC1B · هويّةُ الصوت المولَّد — النبرُ لا يُمحى', () => {
  it('أ · «قصرٌ» و«قُفل» لا يتقاسمان ملفًّا', async () => {
    /*
     * ⚠️ **العطبُ قِيس قبل الإصلاح لا استُنتج**: المفتاحان كانا
     *    `d7f345cf56e4` بالحرف — لأن `normalizeRussian` تردّ كليهما
     *    إلى «замок». والكلمتان معنيان مختلفان ونبرتان مختلفتان.
     */
    const a = await keyOf('за́мок');
    const b = await keyOf('замо́к');
    expect(`متساويان: ${a === b}`).toBe('متساويان: false');
  });

  it('ب · و«كلُّ شيء» و«الجميع» كذلك — الـё ليست е', async () => {
    const a = await keyOf('всё');
    const b = await keyOf('все');
    expect(`متساويان: ${a === b}`).toBe('متساويان: false');
    /* وأصلُ الطيّ ما زال قائمًا حيث يجب: البحثُ يريدهما واحدًا. */
    const { normalizeRussian } = await import('../js/utils/normalization.js');
    expect(normalizeRussian('всё')).toBe(normalizeRussian('все'));
  });

  it('ج · وجملتان لا تختلفان إلّا في موضع النبر', async () => {
    const a = await keyOf('Э́то за́мок на горе́.');
    const b = await keyOf('Э́то замо́к на горе́.');
    expect(`متساويان: ${a === b}`).toBe('متساويان: false');
  });

  it('د · وهويّةٌ ثابتة: نفسُ الطلب يعطي نفسَ المفتاح', async () => {
    /*
     * ⚠️ **وهذا نصفُ العقد الآخر** (بند CRITICAL 11-14): لو تغيّر
     *    المفتاحُ بين نداءين لَولّد كلُّ تكرارةٍ ملفًّا جديدًا. فيُقاس
     *    الثباتُ صراحةً — مرّتان، ومعهما اختلافٌ لا يمسّ النطق.
     */
    const a = await keyOf('За́мок на горе́.');
    const b = await keyOf('За́мок на горе́.');
    expect(`متساويان: ${a === b}`).toBe('متساويان: true');
    /* المسافاتُ الزائدةُ والأطرافُ لا تغيّر نطقًا — ولا مفتاحًا. */
    const c = await keyOf('  За́мок   на горе́.  ');
    expect(`المسافاتُ لا تُغيّر: ${a === c}`).toBe('المسافاتُ لا تُغيّر: true');
  });

  it('هـ · وصوتان مختلفان لا يتقاسمان ملفًّا', async () => {
    const a = await keyOf('Приве́т.', { voiceId: 'ru-a' });
    const b = await keyOf('Приве́т.', { voiceId: 'ru-b' });
    expect(`متساويان: ${a === b}`).toBe('متساويان: false');
  });

  it('و · ومزوّدان مختلفان كذلك', async () => {
    const a = await keyOf('Приве́т.', { providerId: 'piper' });
    const b = await keyOf('Приве́т.', { providerId: 'xtts-bridge' });
    expect(`متساويان: ${a === b}`).toBe('متساويان: false');
  });

  it('ز · وسرعتان مختلفتان — عبر البابِ الحقيقيّ لا بالمفتاح مباشرةً', async () => {
    /*
     * ⚠️ **السرعةُ تدخل المفتاح عبر `settingsKey` الذي يبنيه المستدعي.**
     *    فلو قِيست بمفتاحين مبنيّين يدويًّا لَحرست كتابتي أنا لا الكود.
     *    فتُقاس من `synthesizeWithCache`: سرعتان ⇐ نداءا توليدٍ لا واحد.
     */
    const { synthesizeWithCache } = await cache();
    const f = fakeProvider('p-rate');
    await synthesizeWithCache({ provider: f.provider, text: 'Ско́рость.', speed: 1 });
    await synthesizeWithCache({ provider: f.provider, text: 'Ско́рость.', speed: 0.8 });
    expect(f.calls).toHaveLength(2);
    /* وثالثةٌ بنفس الأولى تُصيب الذاكرة فلا تولّد. */
    await synthesizeWithCache({ provider: f.provider, text: 'Ско́рость.', speed: 1 });
    expect(f.calls).toHaveLength(2);
  });

  it('ح · وإصداران من نموذجٍ واحد لا يتقاسمان صوتًا', async () => {
    /*
     * ⚠️ **وهويّةُ النموذج تُعلَن من المزوّد قبل التوليد** — لا تُقرأ من
     *    نتيجته. جردُ V0.1 وجد `result.metadata?.model` تُقرأ بعد
     *    التوليد، والعقدُ لا يحمل `metadata` أصلًا: قراءةٌ ميتةٌ في
     *    موضعٍ خاطئ.
     *
     * ⚠️ **ولا مزوّدٍ في هذا البناء يعلن إصدارًا اليوم** — فالحارسُ
     *    يقيس الآليّةَ بمزوّدٍ محقونٍ يعلنه، ويقيس كذلك الحالةَ
     *    الصادقةَ القائمة: بلا إعلانٍ، القيمةُ `null` لا مُختلَقة.
     */
    const v1 = await keyOf('Те́ст.', { model: 'silero', modelVersion: 'v4' });
    const v2 = await keyOf('Те́ст.', { model: 'silero', modelVersion: 'v5' });
    const other = await keyOf('Те́ст.', { model: 'piper-ru', modelVersion: 'v4' });
    expect(`إصداران: ${v1 === v2}`).toBe('إصداران: false');
    expect(`نموذجان: ${v1 === other}`).toBe('نموذجان: false');

    /* والمعلَنُ يُخزَّن كما دخل المفتاح — لا هويّةٌ تُقرأ من مكانٍ آخر. */
    const { synthesizeWithCache } = await cache();
    const { generatedAudio } = await repos();
    const declared = fakeProvider('p-model');
    declared.provider.modelId = 'silero';
    declared.provider.modelVersion = 'v5_cis_base';
    await synthesizeWithCache({ provider: declared.provider, text: 'Моде́ль.' });
    const rows = (await generatedAudio.getAll()).filter((r) => r.providerId === 'p-model');
    expect(rows).toHaveLength(1);
    expect(`${rows[0].model}/${rows[0].modelVersion}`).toBe('silero/v5_cis_base');

    /* وبلا إعلان: صفرٌ مُختلَق — `null` صريحة. */
    const silent = fakeProvider('p-nomodel');
    await synthesizeWithCache({ provider: silent.provider, text: 'Моде́ль.' });
    const bare = (await generatedAudio.getAll()).filter((r) => r.providerId === 'p-nomodel');
    expect(`${bare[0].model} · ${bare[0].modelVersion}`).toBe('null · null');
  });

  it('ط · وصفٌّ بالصيغة القديمة لا يُعاد كأنّه مطابقةُ نطقٍ موثوقة', async () => {
    /*
     * ⚠️ **وهذا هو شرطُ سلامةِ البيانات**: الصفوفُ القديمةُ وُلِّدت
     *    بمفتاحٍ يمحو النبر، فصفٌّ اسمُه «замок» قد يكون «قصرًا» أو
     *    «قُفلًا» — لا سبيلَ إلى معرفةِ أيِّهما. فلا يُحذَف ولا يُرقَّى،
     *    ولا يُصيبه البحثُ الجديد: البادئةُ تفصله بنيويًّا.
     *
     * ⚠️ **ويُبنى الصفُّ القديم بالخوارزميّة القديمة نفسِها** — لا
     *    بمفتاحٍ مخترَع: تطبيعُ البحث، ووصلُ الحقول، وهاشٌ عارٍ بلا
     *    بادئة. وإلّا كان الحارسُ يختبر فرضيّتي عن القديم لا القديمَ.
     */
    const { synthesizeWithCache } = await cache();
    const { generatedAudio } = await repos();
    const { normalizeRussian } = await import('../js/utils/normalization.js');

    const legacyRaw = [
      normalizeRussian('за́мок'), 'ru', 'p-legacy', '', 'v-test', 'speed=1',
    ].join('');
    const bytes = new TextEncoder().encode(legacyRaw);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const legacyKey = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');

    await generatedAudio.putRaw({
      cacheKey: legacyKey, normalizedText: 'замок', providerId: 'p-legacy',
      voiceId: 'v-test', model: null, language: 'ru', settingsKey: 'speed=1',
      mimeType: 'audio/wav', duration: null, size: 6,
      blob: new Blob(['LEGACY'], { type: 'audio/wav' }),
      provenance: 'piper_generated', createdAt: 1, lastUsedAt: 1,
    });

    const f = fakeProvider('p-legacy');
    const out = await synthesizeWithCache({
      provider: f.provider, text: 'за́мок', voiceId: 'v-test', speed: 1,
    });
    /* لم يُصِب القديمَ: ولّد من جديد. */
    expect(f.calls).toHaveLength(1);
    expect(`من الذاكرة: ${out.cached}`).toBe('من الذاكرة: false');
    expect(await out.blob.text()).toBe('за́мок');

    /* والقديمُ باقٍ كما هو — لا مُحِيَ ولا كُتِب فوقه. */
    const legacy = await generatedAudio.get(legacyKey);
    expect(await legacy.blob.text()).toBe('LEGACY');
    /* والجديدُ تحت بادئةٍ تميّزه في المخزن. */
    const fresh = (await generatedAudio.getAll())
      .filter((r) => r.providerId === 'p-legacy' && r.cacheKey !== legacyKey);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].cacheKey.slice(0, 3)).toBe('a2-');
  });

  it('ي · ولا يمسّ تسجيلاتِك ولا شواهدَ تدريبك', async () => {
    /*
     * ⚠️ **الذاكرةُ صوتٌ يُعاد توليده، وتسجيلُك أنت لا يُعاد.** فيُقاس
     *    أن مسارَ التوليد لا يكتب ولا يحذف في مخازنِ المستخدم — قبلَه
     *    وبعدَه، بالمحتوى لا بالعدد وحده.
     */
    const { synthesizeWithCache } = await cache();
    const { media, practiceEvidence, shadowSessions } = await repos();

    await media.putRaw({
      id: 'vc1b-media', kind: 'audio', blob: new Blob(['MINE'], { type: 'audio/webm' }),
      createdAt: 1, updatedAt: 1,
    });
    await practiceEvidence.putRaw({ id: 'vc1b-ev', sessionId: 's1', createdAt: 1, updatedAt: 1 });

    const before = {
      media: (await media.getAll()).length,
      evidence: (await practiceEvidence.getAll()).length,
      sessions: (await shadowSessions.getAll()).length,
    };
    const f = fakeProvider('p-safe');
    await synthesizeWithCache({ provider: f.provider, text: 'Сохрани́ моё.' });
    const after = {
      media: (await media.getAll()).length,
      evidence: (await practiceEvidence.getAll()).length,
      sessions: (await shadowSessions.getAll()).length,
    };
    expect(after).toEqual(before);
    expect(await (await media.get('vc1b-media')).blob.text()).toBe('MINE');
  });

  it('ك · وطلبان متزامنان بنطقين مختلفين لا يندمجان في نتيجةٍ واحدة', async () => {
    /*
     * ⚠️ **ولا يُفترَض وجودُ إدماجٍ للطلبات المتزامنة — ولا يُضاف.**
     *    قِيس التنفيذُ: لا خريطةَ «قيدَ التوليد» في هذا المسار، فكلُّ
     *    طلبٍ يولّد ويُخزّن تحت مفتاحه. فالمحروسُ أنّ المفتاحين
     *    مختلفان **فعلًا** تحت التزامن: نداءان، وصفّان، وكلُّ صوتٍ
     *    يعود إلى صاحبه لا إلى جاره.
     */
    const { synthesizeWithCache } = await cache();
    const { generatedAudio } = await repos();
    const f = fakeProvider('p-conc');
    const [a, b] = await Promise.all([
      synthesizeWithCache({ provider: f.provider, text: 'за́мок' }),
      synthesizeWithCache({ provider: f.provider, text: 'замо́к' }),
    ]);
    expect(f.calls).toHaveLength(2);
    expect(await a.blob.text()).toBe('за́мок');
    expect(await b.blob.text()).toBe('замо́к');
    const rows = (await generatedAudio.getAll()).filter((r) => r.providerId === 'p-conc');
    expect(rows).toHaveLength(2);
  });

  it('ل · وتمثيلان يونيكوديّان لنفس الحرف مفتاحُهما واحد', async () => {
    /*
     * ⚠️ **وهذا توحيدُ ترميزٍ لا توحيدُ نطق.** NFC تجمع «e روسيّة +
     *    U+0308» مع الحرف المركّب U+0451 — وهما حرفٌ واحدٌ بترميزين.
     *    ولو تُركا مختلفين لَولّد الجهازُ ملفَّين لنفس النطق.
     *
     * ⚠️ **والحدُّ المقابل يُقاس معه**: علامةُ النبر U+0301 **لا**
     *    تُدمَج بـNFC مع الحرف الروسيّ (لا مركَّبَ لها في يونيكود)،
     *    فتبقى فارقةً — وهو المطلوب.
     */
    const composed = await keyOf('всё');
    const decomposed = await keyOf('всё');
    expect(`متساويان: ${composed === decomposed}`).toBe('متساويان: true');

    const plain = await keyOf('е');
    const stressed = await keyOf('е́');
    expect(`النبرُ يفرّق: ${plain !== stressed}`).toBe('النبرُ يفرّق: true');
  });
});

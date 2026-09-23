/**
 * LingoLife — Voice Center V1.0C · الخطوة ٢: روابطُ الكائن في مختبر الأصوات
 *
 * ⚠️ **يُشغَّل المختبرُ الحقيقيُّ لا يُقرأ مصدرُه.** مزوّدٌ محقونٌ يُرجع
 *    صوتًا، وتُضغَط ▶ ثلاثًا، ثمّ يُغلَق — ويُعَدّ كلُّ رابطٍ أُنشئ وكلُّ
 *    رابطٍ حُرِّر. فحارسٌ يبحث عن كلمة `revokeObjectURL` في الملفّ كان
 *    سيمرّ على تحريرٍ في غير موضعه.
 */

import { describe, it, expect } from './test-runner.js';
import { openVoiceLab } from '../js/modals/voice-lab.js';
import { ensureTTSProvidersRegistered } from '../js/services/shadow/tts/bootstrap.js';
import { registerProvider, unregisterProvider } from '../js/services/shadow/tts/registry.js';

const ID = 'vl-url-test';

const provider = {
  id: ID, name: ID, type: 'piper',
  supportsOffline: true, supportsStreaming: false,
  supportsWord: true, supportsSentence: true, supportsLongText: true,
  async isAvailable() { return { available: true, status: 'ready_offline', reason: '' }; },
  async getVoices() { return []; },
  async synthesize({ text, voiceId }) {
    return {
      audioBlob: new Blob([text], { type: 'audio/wav' }),
      audioUrl: null, playedDirectly: false, duration: 0,
      provider: ID, voiceId, cacheKey: null,
      provenance: 'piper_generated', cached: false, error: null,
    };
  },
  cancel() {},
};

const until = async (check, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('انتهت المهلة');
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe('Voice Center V1.0C · مختبرُ الأصوات يحرّر روابطَه', () => {
  it('١ · كلُّ ضغطةٍ تحرّر سابقتَها، والإغلاقُ يحرّر الأخيرة', async () => {
    ensureTTSProvidersRegistered();
    registerProvider(provider);
    const created = [];
    const revoked = [];
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => {
      const url = realCreate.call(URL, blob);
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => { revoked.push(url); realRevoke.call(URL, url); };
    let closed = null;
    try {
      closed = openVoiceLab();
      await until(() => document.querySelector('[data-vl-provider="A"]'));
      const select = document.querySelector('[data-vl-provider="A"]');
      select.value = ID;
      select.dispatchEvent(new Event('change'));
      const status = document.querySelector('[data-vl-status="A"]');
      const play = document.querySelector('[data-vl-play="A"]');

      for (let i = 1; i <= 3; i += 1) {
        status.textContent = '';
        play.click();
        await until(() => status.textContent && status.textContent !== 'بيولّد…');
        /* ⚠️ الرابطُ الحاليُّ حيٌّ ما دام يُشغَّل — وكلُّ ما قبله حُرِّر. */
        expect(`ضغطة ${i}: أُنشئ ${created.length} · حُرِّر ${revoked.length}`)
          .toBe(`ضغطة ${i}: أُنشئ ${i} · حُرِّر ${i - 1}`);
        expect(revoked.includes(created[i - 1])).toBe(false);
      }

      select.closest('.overlay').__close(null);
      await closed;
      expect(`بعد الإغلاق: حُرِّر ${revoked.length} من ${created.length}`)
        .toBe('بعد الإغلاق: حُرِّر 3 من 3');
      expect([...revoked].sort()).toEqual([...created].sort());
    } finally {
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
      unregisterProvider(ID);
      document.querySelector('[data-vl-provider]')?.closest('.overlay')?.__close?.(null);
    }
  });
});

/**
 * LingoLife — ترميزُ WAV للصوت المولَّد محلّيًّا
 *
 * نُقل بحرفه من `piper-provider.js` ليتقاسمه مزوّدو ONNX المحلّيّون
 * (Piper، Supertonic): PCM ‏16-بت أحاديّ، بلا اعتماديّة خارجيّة — الصيغةُ
 * التي يشغّلها مسارُ الصوت القائم (`<audio>` في `speaker-adapter.js`).
 */

/** يغلّف عيّناتٍ عائمة (float32 PCM) بترويسة WAV — بلا اعتماديّة خارجية. */
export function pcmFloatToWavBlob(float32Data, sampleRate) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + float32Data.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + float32Data.length * bytesPerSample, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, float32Data.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < float32Data.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

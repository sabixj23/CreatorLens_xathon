import type { Evidence } from "../analysis/schemas";

export const SAMPLE_RATE = 16000;
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): ArrayBuffer {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (at: number, value: string) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => { const s = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true); });
  return bytes;
}
export function measureAudio(samples: Float32Array, duration: number): Evidence[] {
  const evidence: Evidence[] = [];
  for (let start = 0; start < duration; start++) {
    const end = Math.min(duration, start + 1);
    let squares = 0, peak = 0, clipped = 0;
    const from = Math.floor(start * SAMPLE_RATE), to = Math.min(samples.length, Math.floor(end * SAMPLE_RATE));
    for (let i = from; i < to; i++) { const s = samples[i]; squares += s * s; peak = Math.max(peak, Math.abs(s)); if (Math.abs(s) >= 0.999) clipped++; }
    const rms = Math.sqrt(squares / Math.max(1, to - from));
    const db = Math.max(-100, 20 * Math.log10(Math.max(rms, 0.00001)));
    evidence.push({ id: `a${evidence.length + 1}`, modality: "audio", start, end,
      content: `Mono RMS ${db.toFixed(1)} dBFS; peak ${peak.toFixed(4)}; near-silence=${db < -45} (threshold -45 dBFS); clipping-candidate=${clipped / Math.max(1, to - from) > 0.001} (samples >=0.999 exceed 0.1%). Measurements only, not perceived sound quality.` });
  }
  return evidence;
}
export function validateWav(bytes: ArrayBuffer) {
  if (bytes.byteLength < 46) throw new Error("Empty audio.");
  const v = new DataView(bytes);
  const text = (start: number, length: number) => new TextDecoder().decode(new Uint8Array(bytes, start, length));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE" || text(12, 4) !== "fmt " || text(36, 4) !== "data" ||
    v.getUint32(16, true) !== 16 || v.getUint16(20, true) !== 1 || v.getUint16(22, true) !== 1 ||
    v.getUint32(24, true) !== SAMPLE_RATE || v.getUint16(34, true) !== 16 ||
    v.getUint32(40, true) !== bytes.byteLength - 44 || (bytes.byteLength - 44) % 2 !== 0) throw new Error("Expected mono 16 kHz PCM WAV.");
  return (bytes.byteLength - 44) / (SAMPLE_RATE * 2);
}

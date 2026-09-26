import type { SampledFrame } from "../media";
import type { Evidence } from "../analysis/schemas";
import { encodeWav, measureAudio, SAMPLE_RATE } from "./audio";

export type PreparedVideo = {
  hash: string; duration: number; width: number; height: number; frames: SampledFrame[];
  evidence: Evidence[]; audioStatus: "available" | "no-audio" | "silent" | "unavailable";
  audioMessage: string; audio: { id: string; start: number; end: number; blob: Blob }[];
};
export async function hashFile(file: File) {
  if (file.size > 150 * 1024 * 1024) throw new Error("Choose a video smaller than 150 MB.");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export async function extractVideo(file: File, signal: AbortSignal, progress: (message: string) => void): Promise<PreparedVideo> {
  signal.throwIfAborted();
  progress("Inspecting and identifying your video…");
  const { Input, ALL_FORMATS, BlobSource, CanvasSink, AudioBufferSink } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const abort = () => input.dispose();
  signal.addEventListener("abort", abort, { once: true });
  try {
    const hash = await hashFile(file);
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration < 5 || duration > 90) throw new Error("Choose a video between 5 and 90 seconds.");
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error("This browser cannot decode the video. Try an H.264 MP4 in Chrome.");
    const width = await track.getDisplayWidth(), height = await track.getDisplayHeight();
    const firstTimestamp = await track.getFirstTimestamp();
    if (!width || !height || width * height > 3840 * 2160) throw new Error("Use a video with valid dimensions up to 4K.");
    const scale = Math.min(1, 960 / Math.max(width, height));
    const sink = new CanvasSink(track, { width: Math.round(width * scale), height: Math.round(height * scale), fit: "contain", poolSize: 1 });
    const canvas = document.createElement("canvas"); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    const thumb = document.createElement("canvas"); thumb.width = 32; thumb.height = 32;
    const thumbContext = thumb.getContext("2d", { willReadFrequently: true });
    if (!context || !thumbContext) throw new Error("Canvas extraction is unavailable.");
    const times = new Set<number>([0, Math.max(0, duration - 0.05)]);
    for (let t = 0; t < duration; t += t < 5 ? 0.5 : 1) times.add(t);
    const frames: SampledFrame[] = [];
    const seen = new Set<number>();
    let previous: Uint8ClampedArray | null = null;
    const extras: number[] = [];
    async function capture(t: number, detect: boolean) {
      signal.throwIfAborted();
      const wrapped = await sink.getCanvas(Math.max(firstTimestamp, t));
      if (!wrapped) throw new Error(`Could not decode a frame at ${t.toFixed(1)} seconds.`);
      const time = Math.max(0, wrapped.timestamp);
      if (seen.has(time)) return;
      context!.drawImage(wrapped.canvas, 0, 0);
      let image = canvas.toDataURL("image/jpeg", 0.72);
      if (image.length > 180_000) image = canvas.toDataURL("image/jpeg", 0.45);
      if (image.length > 180_000) throw new Error("A frame is too large. Try exporting the video at a lower resolution.");
      frames.push({ id: "pending", time, image }); seen.add(time);
      if (detect) {
        thumbContext!.drawImage(wrapped.canvas, 0, 0, 32, 32);
        const pixels = thumbContext!.getImageData(0, 0, 32, 32).data;
        if (previous) {
          let delta = 0;
          for (let i = 0; i < pixels.length; i += 4) delta += Math.abs(pixels[i] - previous[i]) + Math.abs(pixels[i + 1] - previous[i + 1]) + Math.abs(pixels[i + 2] - previous[i + 2]);
          if (delta / (32 * 32 * 3) > 35) extras.push(Math.max(0, t - 0.25), Math.min(duration - 0.05, t + 0.25));
        }
        previous = pixels;
      }
    }
    for (const time of [...times].sort((a, b) => a - b)) { await capture(time, true); progress(`Extracting frames on your device… ${frames.length}`); }
    // Cap per-window density as well as total image count to keep requests bounded.
    for (const time of extras) {
      if (frames.length >= 160) break;
      if (frames.filter(f => Math.abs(f.time - time) < 10).length >= 22) continue;
      await capture(time, false);
    }
    frames.sort((a, b) => a.time - b.time).forEach((f, i) => { f.id = `f${i + 1}`; });
    const evidence: Evidence[] = frames.map(f => ({ id: f.id, modality: "frame", start: f.time, end: f.time, content: "Sampled still frame; events between samples are unknown." }));
    let audioStatus: PreparedVideo["audioStatus"] = "no-audio", audioMessage = "No audio track. This will be a visual review.";
    const audio: PreparedVideo["audio"] = [];
    progress("Extracting audio and measuring levels on your device…");
    try {
      const audioTrack = await input.getPrimaryAudioTrack();
      if (audioTrack) {
        if (!(await audioTrack.canDecode())) throw new Error("Audio decoding is unavailable in this browser.");
        const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
        let decodedSamples = 0;
        for await (const { buffer, timestamp } of new AudioBufferSink(audioTrack).buffers(0, duration)) {
          signal.throwIfAborted();
          const start = Math.max(0, Math.ceil(timestamp * SAMPLE_RATE));
          const end = Math.min(samples.length, Math.floor((timestamp + buffer.duration) * SAMPLE_RATE));
          const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
          for (let i = start; i < end; i++) {
            const source = Math.max(0, Math.min(buffer.length - 1, Math.floor((i / SAMPLE_RATE - timestamp) * buffer.sampleRate)));
            samples[i] = channels.reduce((sum, channel) => sum + channel[source], 0) / channels.length;
          }
          decodedSamples += Math.max(0, end - start);
        }
        if (!decodedSamples) throw new Error("No audio samples could be decoded.");
        evidence.push(...measureAudio(samples, duration));
        let peak = 0;
        for (const s of samples) peak = Math.max(peak, Math.abs(s));
        if (peak < 0.0001) { audioStatus = "silent"; audioMessage = "The decoded audio is effectively silent. No audio is sent for transcription."; }
        else {
          audioStatus = "available";
          audioMessage = `The full ${duration.toFixed(1)}-second audio track will be sent for timestamped transcription.`;
          // A 90 s mono 16 kHz WAV is <2.9 MB: one chunk avoids artificial sentence boundaries.
          audio.push({ id: "c1", start: 0, end: duration, blob: new Blob([encodeWav(samples)], { type: "audio/wav" }) });
        }
      }
    } catch (error) {
      signal.throwIfAborted(); audioStatus = "unavailable";
      audioMessage = error instanceof Error ? error.message : "Audio extraction failed.";
    }
    signal.throwIfAborted();
    return { hash, duration, width, height, frames, evidence, audioStatus, audioMessage, audio };
  } finally { signal.removeEventListener("abort", abort); input.dispose(); }
}

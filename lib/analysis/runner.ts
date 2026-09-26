import { z } from "zod";
import type { Brief } from "../types";
import type { PreparedVideo } from "../media/extract";
import { VERSION, reviewOutputSchema, transcriptSchema, windowOutputSchema, type AnalysisResult, type Coverage, type Transcript, type Usage, type WindowOutput } from "./schemas";
import { makeWindows, mergeWindows, overlaps, validateReview, validateWindow } from "./evidence";

export class TranscriptionError extends Error {}
export class RequestError extends Error {
  constructor(message: string, public retryable: boolean, public retryAfterMs = 0) { super(message); }
}
export function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function withRetry<T>(operation: () => Promise<T>, signal: AbortSignal, wait = delay): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try { return await operation(); }
    catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof RequestError) || !error.retryable || attempt >= 2) throw error;
      await wait(Math.max(error.retryAfterMs, Math.min(8000, 1000 * 2 ** attempt + Math.random() * 500)), signal);
    }
  }
}
export async function parallelMap<T>(items: T[], concurrency: number, signal: AbortSignal, action: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { signal.throwIfAborted(); const item = items[cursor++]; await action(item); }
  }));
}
type CachedRun = { transcript?: Transcript[]; windows: Map<string, WindowOutput>; usage: Usage[]; result?: AnalysisResult };
const cache = new Map<string, CachedRun>();
export function clearAnalysisCache() { cache.clear(); }
const usageSchema = z.object({ model: z.string(), inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative(), latencyMs: z.number().nonnegative() });
export async function runAnalysis(args: {
  prepared: PreparedVideo; brief: Brief; signal: AbortSignal; progress: (message: string) => void;
  visualOnly?: boolean;
}): Promise<AnalysisResult> {
  const { prepared, brief, progress } = args;
  const signal = AbortSignal.any([args.signal, AbortSignal.timeout(6 * 60 * 1000)]);
  const started = Date.now();
  let requests = 0;
  async function request(path: string, body?: unknown, form?: FormData): Promise<unknown> {
    return withRetry(async () => {
      if (++requests > 42) throw new Error("Analysis request budget reached. Retry the remaining work.");
      let response: Response;
      try {
        response = await fetch(path, { method: body || form ? "POST" : "GET", signal, cache: "no-store",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: form || (body ? JSON.stringify(body) : undefined) });
      } catch { signal.throwIfAborted(); throw new RequestError("Could not connect to the analysis server.", true); }
      const data = await response.json().catch(() => { throw new RequestError("The server returned an unreadable response.", false); });
      if (!response.ok) throw new RequestError(data.error || "Analysis failed.", data.retryable === true,
        typeof data.retryAfterMs === "number" ? Math.max(0, Math.min(30000, data.retryAfterMs)) : 0);
      return data;
    }, signal);
  }
  const config = z.object({ provider: z.string(), model: z.string(), transcriptionModel: z.string(), version: z.string() }).parse(await request("/api/analyse/config"));
  const key = JSON.stringify([prepared.hash, VERSION, config, brief.platform, brief.topic.trim(), brief.audience.trim(), brief.goal,
    !!args.visualOnly, prepared.frames.map(f => [f.id, f.time]), prepared.audioStatus]);
  let cached = cache.get(key);
  if (!cached) {
    if (cache.size >= 3) cache.delete(cache.keys().next().value!);
    cached = { windows: new Map(), usage: [] }; cache.set(key, cached);
  }
  if (cached.result?.status === "ready") { signal.throwIfAborted(); return cached.result; }
  let audio: Coverage["audio"] = prepared.audioStatus === "available" ? "skipped" : prepared.audioStatus;
  if (!args.visualOnly && prepared.audio.length) {
    progress("Transcribing speech with timestamps…");
    if (!cached.transcript) {
      try {
        const segments: Transcript[] = [];
        for (const chunk of prepared.audio) {
          const form = new FormData(); form.set("file", chunk.blob, "evidence.wav");
          form.set("chunkId", chunk.id); form.set("offset", String(chunk.start)); form.set("duration", String(chunk.end - chunk.start));
          const data = z.object({ segments: z.array(transcriptSchema), usage: usageSchema }).parse(await request("/api/transcribe", undefined, form));
          if (data.segments.some(s => s.start < chunk.start || s.end > chunk.end)) throw new Error("Transcript timing exceeds its audio range.");
          segments.push(...data.segments); cached.usage.push(data.usage);
        }
        cached.transcript = segments;
      } catch (error) {
        signal.throwIfAborted();
        throw new TranscriptionError(`${error instanceof Error ? error.message : "Transcription failed."} Retry transcription or choose a visual-only review.`);
      }
    }
    audio = cached.transcript.length ? "transcribed" : "no-speech-detected";
  }
  const evidence = [...prepared.evidence, ...(cached.transcript || []).map(s => ({ id: s.id, modality: "speech" as const, start: s.start, end: s.end, content: s.text }))];
  const windows = makeWindows(prepared.duration);
  const errors: string[] = [];
  await parallelMap(windows.filter(w => !cached!.windows.has(w.id)), 3, signal, async window => {
    const windowFrames = prepared.frames.filter(f => f.time >= window.start && f.time < window.end);
    const input = { brief, window, frames: windowFrames, evidence: evidence.filter(e => overlaps(e, window)) };
    try {
      validateWindow(input);
      const data = z.object({ result: windowOutputSchema, usage: usageSchema }).parse(await request("/api/analyse/window", input));
      validateWindow(input, data.result); signal.throwIfAborted();
      cached!.windows.set(window.id, data.result); cached!.usage.push(data.usage);
    } catch (error) { signal.throwIfAborted(); errors.push(error instanceof Error ? error.message : "A window failed."); }
    progress(`Analysing scenes… ${cached!.windows.size}/${windows.length} windows complete`);
  });
  if (!cached.windows.size) throw new Error(errors[0] || "No visual windows could be analysed.");
  progress("Merging evidence and checking coverage…");
  const observations = mergeWindows(windows.filter(w => cached!.windows.has(w.id)).map(window => ({ window, result: cached!.windows.get(window.id)! })));
  if (!observations.length) throw new Error("No supported observations were returned. Try another clip or brief.");
  const coverage: Coverage = { totalWindows: windows.length, completedWindows: cached.windows.size,
    missing: windows.filter(w => !cached!.windows.has(w.id)), audio };
  // Synthesis receives only evidence referenced by validated observations; no image or audio bytes.
  const refs = new Set(observations.flatMap(o => o.evidenceIds));
  const input = { brief, duration: prepared.duration, evidence: evidence.filter(e => refs.has(e.id)), observations, coverage };
  validateReview(input);
  progress("Building your evidence-backed review…");
  const output = z.object({ result: reviewOutputSchema, usage: usageSchema }).parse(await request("/api/analyse/review", input));
  validateReview(input, output.result); signal.throwIfAborted(); cached.usage.push(output.usage);
  const partial = coverage.missing.length > 0 || ["unavailable", "skipped", "failed"].includes(audio);
  const result: AnalysisResult = { version: VERSION, runId: crypto.randomUUID(), hash: prepared.hash, duration: prepared.duration,
    createdAt: new Date().toISOString(), status: partial ? "partial" : "ready", review: output.result,
    evidence, observations, coverage, usage: [...cached.usage], elapsedMs: Date.now() - started };
  cached.result = result;
  return result;
}

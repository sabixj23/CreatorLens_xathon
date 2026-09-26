import test from "node:test";
import assert from "node:assert/strict";
import { makeWindows, mergeWindows, validateReview, validateWindow } from "./evidence";
import { normaliseTranscript } from "./transcript";
import { encodeWav, measureAudio, validateWav } from "../media/audio";
import { parallelMap, RequestError, withRetry } from "./runner";
import type { ReviewRequest, WindowRequest } from "./schemas";
import { reviewGenerationSchema, windowGenerationSchema } from "./schemas";

const brief = { platform: "TikTok" as const, topic: "Test", audience: "Beginners", goal: "Educate" as const };
const frame = { id: "f1", time: 0, image: "data:image/jpeg;base64,/9j/" };
const evidence = { id: "f1", modality: "frame" as const, start: 0, end: 0, content: "Frame" };
const input: WindowRequest = { brief, frames: [frame], evidence: [evidence], window: { id: "w1", start: 0, end: 10 } };
const observation = { category: "opening" as const, evidenceIds: ["f1"], description: "A title appears.", uncertainty: "" };

test("windows cover the ending without a redundant overlap-only window", () => {
  assert.deepEqual(makeWindows(10), [{ id: "w1", start: 0, end: 10 }]);
  assert.deepEqual(makeWindows(18).map(w => [w.start, w.end]), [[0, 10], [8, 18]]);
  assert.equal(makeWindows(90).at(-1)?.end, 90);
  assert.equal(makeWindows(90).length, 11);
  assert.throws(() => makeWindows(NaN)); assert.throws(() => makeWindows(91));
});
test("unknown, duplicate, out-of-window and mismatched image references are rejected", () => {
  validateWindow(input, { observations: [observation] });
  assert.throws(() => validateWindow(input, { observations: [{ ...observation, evidenceIds: ["f2"] }] }));
  assert.throws(() => validateWindow({ ...input, evidence: [evidence, evidence] }));
  assert.throws(() => validateWindow({ ...input, evidence: [{ ...evidence, start: 12, end: 12 }] }));
  assert.throws(() => validateWindow({ ...input, frames: [{ ...frame, time: 1 }] }));
  assert.throws(() => validateWindow(input, { observations: [{ ...observation, category: "speech" }] }));
  assert.throws(() => validateWindow(input, { observations: [{ ...observation, category: "alignment" }] }));
});
test("generation schemas restrict references to IDs supplied in this request", () => {
  const windowSchema = windowGenerationSchema(["f1"]);
  assert.equal(windowSchema.safeParse({ observations: [observation] }).success, true);
  assert.equal(windowSchema.safeParse({ observations: [{ ...observation, evidenceIds: ["f2"] }] }).success, false);
  const schema = reviewGenerationSchema(["o1"], ["f1"]);
  const review = { summary: "Review", findings: [{ kind: "strength", title: "Opening", observationIds: ["o1"], observation: "Title", whyItMatters: "Clarity", suggestion: "Keep it", priority: "low" }], ratings: [], exercise: "Test a title", cutOrder: [{ evidenceIds: ["f1"], reason: "Opening" }] };
  assert.equal(schema.safeParse(review).success, true);
  assert.equal(schema.safeParse({ ...review, findings: [{ ...review.findings[0], observationIds: ["f1"] }] }).success, false);
  assert.equal(schema.safeParse({ ...review, cutOrder: [{ evidenceIds: ["o1"], reason: "Wrong reference type" }] }).success, false);
});
test("merge retains provenance and distinct uncertainties", () => {
  const merged = mergeWindows([
    { window: input.window, result: { observations: [observation] } },
    { window: { id: "w2", start: 8, end: 18 }, result: { observations: [observation, { ...observation, uncertainty: "Text is blurry." }] } },
  ]);
  assert.equal(merged.length, 2); assert.deepEqual(merged[0].windowIds, ["w1", "w2"]);
});
test("synthesis rejects missing coverage, unsupported ratings and unknown findings", () => {
  const request: ReviewRequest = { brief, duration: 10, evidence: [evidence], observations: [{ ...observation, id: "o1", windowIds: ["w1"] }],
    coverage: { totalWindows: 1, completedWindows: 1, missing: [], audio: "no-audio" } };
  validateReview(request);
  assert.throws(() => validateReview({ ...request, coverage: { ...request.coverage, completedWindows: 0 } }));
  const review = { summary: "Review", findings: [{ kind: "strength" as const, title: "Title", observationIds: ["o9"], observation: "Title", whyItMatters: "Clarity", suggestion: "Keep it", priority: "low" as const }], ratings: [], exercise: "Try a new title", cutOrder: [] };
  assert.throws(() => validateReview(request, review));
  review.findings[0].observationIds = ["o1"]; validateReview(request, review);
  assert.throws(() => validateReview(request, { ...review, ratings: [{ component: "speech clarity", score: 4, reason: "Clear", observationIds: ["o1"] }] }));
});
test("transcription keeps segment timing and applies chunk offset", () => {
  const segments = normaliseTranscript({ segments: [{ start: 0.2, end: 1.5, text: "Hello world" }] }, "c2", 20, 10);
  assert.equal(segments[0].start, 20.2); assert.equal(segments[0].end, 21.5);
  assert.throws(() => normaliseTranscript({ segments: [{ start: 0, end: 50, text: "bad" }] }, "c1", 0, 10));
  assert.deepEqual(normaliseTranscript({ segments: [{ start: 0, end: 1, text: "Hallucination", no_speech_prob: 0.9, avg_logprob: -2 }] }, "c1", 0, 10), []);
});
test("WAV validates actual PCM duration and detects silence/clipping candidates", () => {
  const samples = new Float32Array(16000);
  assert.equal(validateWav(encodeWav(samples)), 1);
  assert.match(measureAudio(samples, 1)[0].content, /near-silence=true/);
  samples.fill(1); assert.match(measureAudio(samples, 1)[0].content, /clipping-candidate=true/);
  assert.throws(() => validateWav(new ArrayBuffer(50)));
});
test("transient failures retry twice; nonretryable errors do not", async () => {
  let attempts = 0;
  await assert.rejects(withRetry(async () => { attempts++; throw new RequestError("rate limited", true); }, new AbortController().signal, async () => {}));
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(withRetry(async () => { attempts++; throw new RequestError("credentials", false); }, new AbortController().signal, async () => {}));
  assert.equal(attempts, 1);
});
test("scheduler bounds concurrency and cancellation stops new work", async () => {
  let active = 0, max = 0;
  const controller = new AbortController();
  await parallelMap([1, 2, 3, 4, 5], 3, controller.signal, async () => {
    active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 5)); active--;
  });
  assert.equal(max, 3);
  let count = 0;
  await assert.rejects(parallelMap([1, 2, 3], 1, controller.signal, async () => { count++; controller.abort(); }));
  assert.equal(count, 1);
});

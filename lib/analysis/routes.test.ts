import test from "node:test";
import assert from "node:assert/strict";
import { POST as windowPost } from "../../app/api/analyse/window/route";
import { POST as transcribePost } from "../../app/api/transcribe/route";
import { encodeWav } from "../media/audio";
import { failure } from "../ai/http";

const brief = { platform: "TikTok", topic: "Synthetic test", audience: "Beginners", goal: "Educate" };
const input = { brief, window: { id: "w1", start: 0, end: 6 },
  frames: [{ id: "f1", time: 0, image: "data:image/jpeg;base64,/9j/" }],
  evidence: [{ id: "f1", modality: "frame", start: 0, end: 0, content: "Frame" }] };
const req = (body: unknown) => new Request("http://localhost/api/analyse/window", { method: "POST", body: JSON.stringify(body) });
test("window endpoint validates real request handling and provider failure modes", async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.equal(body.text.format.type, "json_schema"); assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      return Response.json({ status: "completed", model: "mock", output: [{ content: [{ type: "output_text", text: JSON.stringify({ observations: [{ category: "opening", evidenceIds: ["f1"], description: "A title", uncertainty: "" }] }) }] }] });
    };
    assert.equal((await windowPost(req(input))).status, 200); assert.equal(calls, 1);
    assert.equal((await windowPost(req({ ...input, evidence: [] }))).status, 400); assert.equal(calls, 1);
    globalThis.fetch = async () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ observations: [{ category: "opening", evidenceIds: ["invented"], description: "A title", uncertainty: "" }] }) }] }] });
    const invalidEvidence = await windowPost(req(input));
    assert.equal(invalidEvidence.status, 502);
    assert.equal((await invalidEvidence.json()).error, "Scene analysis: The AI cited unknown evidence.");
    globalThis.fetch = async () => Response.json({ status: "incomplete", output: [] });
    assert.equal((await windowPost(req(input))).status, 502);
    globalThis.fetch = async () => Response.json({ status: "completed", output: [{ content: [{ type: "refusal" }] }] });
    assert.equal((await windowPost(req(input))).status, 502);
    globalThis.fetch = async () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: "not JSON" }] }] });
    assert.equal((await windowPost(req(input))).status, 502);
    globalThis.fetch = async () => Response.json({ error: { code: "insufficient_quota" } }, { status: 429 });
    const quota = await windowPost(req(input)); assert.equal(quota.status, 503); assert.equal((await quota.json()).retryable, false);
    globalThis.fetch = async () => new Response("private provider error", { status: 401 });
    const auth = await windowPost(req(input)); assert.equal(auth.status, 503); assert.doesNotMatch(await auth.text(), /private provider error/);
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; }
});
test("transcription endpoint accepts bounded WAV, preserves offset and omits unsupported store", async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  try {
    globalThis.fetch = async (_url, init) => {
      const form = init?.body as FormData;
      assert.equal(form.get("model"), "whisper-1"); assert.equal(form.get("store"), null);
      assert.equal(form.get("timestamp_granularities[]"), "segment");
      return Response.json({ segments: [{ start: 0.1, end: 0.8, text: "Hello" }] });
    };
    const form = new FormData(); form.set("file", new Blob([encodeWav(new Float32Array(16000))], { type: "audio/wav" }), "synthetic.wav");
    form.set("offset", "2"); form.set("duration", "1"); form.set("chunkId", "c1");
    const response = await transcribePost(new Request("http://localhost/api/transcribe", { method: "POST", body: form }));
    assert.equal(response.status, 200); assert.equal((await response.json()).segments[0].start, 2.1);
    globalThis.fetch = async () => Response.json({ segments: [{ start: 0.1, end: 80, text: "Private transcript text" }] });
    const invalidTiming = await transcribePost(new Request("http://localhost/api/transcribe", { method: "POST", body: form }));
    assert.equal(invalidTiming.status, 502);
    const timingError = await invalidTiming.json();
    assert.match(timingError.error, /^Transcription: .*timestamps/);
    assert.doesNotMatch(timingError.error, /Private transcript/);
    form.set("duration", "80");
    assert.equal((await transcribePost(new Request("http://localhost/api/transcribe", { method: "POST", body: form }))).status, 400);
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; }
});
test("unexpected errors do not masquerade as evidence failures or expose private details", async () => {
  const response = failure(new Error("Secret provider or media content"), "Review synthesis");
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.stage, "Review synthesis");
  assert.match(body.error, /unexpected server error/);
  assert.doesNotMatch(body.error, /Secret|match its evidence/);
});

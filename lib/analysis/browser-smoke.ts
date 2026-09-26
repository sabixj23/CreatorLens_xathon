// Synthetic browser integration test. Default mocks AI; CREATORLENS_LIVE_AI=1 opts into paid server API calls.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto("http://127.0.0.1:3000");
    const makeFixture = (withAudio: boolean) => page.evaluate(async (withAudio) => {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext("2d")!;
      const audio = new AudioContext(); await audio.resume();
      const destination = audio.createMediaStreamDestination();
      const oscillator = audio.createOscillator(); const gain = audio.createGain(); gain.gain.value = 0.03;
      oscillator.connect(gain).connect(destination); oscillator.start();
      const stream = canvas.captureStream(10); if (withAudio) stream.addTrack(destination.stream.getAudioTracks()[0]);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
      const chunks: Blob[] = []; recorder.ondataavailable = event => chunks.push(event.data);
      const done = new Promise<Blob>(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })); });
      recorder.start();
      for (let i = 0; i < (withAudio ? 120 : 60); i++) {
        ctx.fillStyle = i < 60 ? "#172631" : "#de7045"; ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = "white"; ctx.font = "bold 42px sans-serif";
        ctx.fillText(i < 60 ? "SYNTHETIC DEMO" : "CLEAR PAYOFF", 70, 180);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      recorder.stop(); oscillator.stop(); stream.getTracks().forEach(track => track.stop()); await audio.close();
      return Array.from(new Uint8Array(await (await done).arrayBuffer()));
    }, withAudio);
    const fixture = await makeFixture(true);
    const file = { name: "synthetic.webm", mimeType: "video/webm", buffer: Buffer.from(fixture) };
    let windows = 0, transcripts = 0, syntheses = 0;
    let failSecond = true;
    const live = process.env.CREATORLENS_LIVE_AI === "1";
    if (!live) {
    await page.route("**/api/transcribe", route => {
      transcripts++;
      return route.fulfill({ json: { segments: [{ id: "s_c1_0", start: 1, end: 3, text: "Synthetic transcription fixture." }], usage: { model: "mock-transcription", inputTokens: 0, outputTokens: 0, latencyMs: 1 } } });
    });
    await page.route("**/api/analyse/window", route => {
      windows++;
      const input = route.request().postDataJSON();
      assert.ok(input.frames.length > 0 && input.frames.length <= 24);
      assert.ok(!JSON.stringify(input).includes("video/webm"));
      if (input.window.id === "w2" && failSecond) return route.fulfill({ status: 502, json: { error: "Synthetic failure", retryable: false } });
      return route.fulfill({ json: { result: { observations: [{ category: "text", evidenceIds: [input.frames[0].id], description: "The title is readable.", uncertainty: "Sampled stills only." }] }, usage: { model: "mock-vision", inputTokens: 1, outputTokens: 1, latencyMs: 1 } } });
    });
    await page.route("**/api/analyse/review", route => {
      syntheses++;
      const input = route.request().postDataJSON();
      assert.ok(!JSON.stringify(input).includes("data:image"));
      return route.fulfill({ json: { result: { summary: "A readable title introduces this synthetic clip.", findings: [{ kind: "strength", title: "Readable opening", observationIds: [input.observations[0].id], observation: "The title is visible.", whyItMatters: "Introduces the topic.", suggestion: "Keep the clear title.", priority: "low" }], ratings: [{ component: "visual clarity", score: 4, reason: "Readable title.", observationIds: [input.observations[0].id] }], exercise: "Test a shorter title.", cutOrder: [] }, usage: { model: "mock-review", inputTokens: 1, outputTokens: 1, latencyMs: 1 } } });
    });
    }
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByPlaceholder("e.g. a 30-second skincare routine").fill("Synthetic demonstration");
    await page.getByPlaceholder("e.g. beginners with sensitive skin").fill("New creators");
    await page.getByRole("button", { name: /Prepare analysis/ }).click();
    await page.getByRole("button", { name: /Send evidence for analysis/ }).waitFor({ timeout: 90000 });
    assert.match(await page.locator(".transfer-panel").innerText(), /full .*audio track/);
    assert.ok(await page.locator(".frame-strip img").count() >= 15);
    await page.getByRole("button", { name: /Send evidence for analysis/ }).click();
    if (live) {
      await page.waitForFunction(() => document.querySelector(".results") || document.querySelector('.error[role="alert"]'), undefined, { timeout: 360000 });
      if (await page.locator('.error[role="alert"]').count()) throw new Error(await page.locator('.error[role="alert"]').innerText());
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("creatorlens.reviews.v1") || "[]")[0]?.analysis);
      assert.ok(saved?.observations.length);
      console.log(JSON.stringify({ live: true, status: saved.status, coverage: saved.coverage, elapsedMs: saved.elapsedMs, usage: saved.usage, findings: saved.review.findings.length, note: "Synthetic title cards with tone audio; does not establish speech-recognition quality." }));
      return;
    }
    await page.getByText("PARTIAL REVIEW", { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(transcripts, 1); assert.equal(windows, 2); assert.equal(syntheses, 1);
    failSecond = false;
    await page.getByRole("button", { name: "Retry missing windows" }).click();
    await page.getByText("YOUR REVIEW", { exact: true }).waitFor();
    assert.equal(transcripts, 1); assert.equal(windows, 3); assert.equal(syntheses, 2);
    await page.locator(".evidence-links button").first().click();
    assert.ok((await page.locator("video").evaluate(v => (v as HTMLVideoElement).currentTime)) >= 0);
    await page.goto("http://127.0.0.1:3000/history");
    await page.getByRole("button", { name: /View review/ }).first().click();
    await page.locator('input[type="file"]').setInputFiles({ ...file, buffer: Buffer.from("wrong file") });
    await page.getByText(/does not match the analysed video/).waitFor();
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.locator("video").waitFor();
    // Silent/no-track video: no transcription call and a complete visual review.
    await page.goto("http://127.0.0.1:3000");
    const silent = { name: "silent.webm", mimeType: "video/webm", buffer: Buffer.from(await makeFixture(false)) };
    await page.locator('input[type="file"]').setInputFiles(silent);
    await page.getByPlaceholder("e.g. a 30-second skincare routine").fill("Silent demonstration");
    await page.getByPlaceholder("e.g. beginners with sensitive skin").fill("New creators");
    await page.getByRole("button", { name: /Prepare analysis/ }).click();
    await page.getByRole("button", { name: /Send evidence for analysis/ }).waitFor({ timeout: 30000 });
    assert.match(await page.locator(".transfer-panel").innerText(), /No audio track/);
    await page.getByRole("button", { name: /Send evidence for analysis/ }).click();
    await page.getByText("YOUR REVIEW", { exact: true }).waitFor();
    assert.equal(transcripts, 1);
    // A transcription failure requires an explicit visual-only continuation.
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole("button", { name: /Prepare analysis/ }).click();
    await page.getByRole("button", { name: /Send evidence for analysis/ }).waitFor({ timeout: 30000 });
    await page.unroute("**/api/transcribe");
    await page.route("**/api/transcribe", route => route.fulfill({ status: 502, json: { error: "Synthetic transcription failure", retryable: false } }));
    await page.getByRole("button", { name: /Send evidence for analysis/ }).click();
    await page.getByRole("button", { name: "Retry transcription", exact: true }).waitFor();
    assert.equal(await page.locator(".results").count(), 0);
    await page.getByRole("button", { name: "Continue without transcription" }).click();
    await page.getByText("PARTIAL REVIEW", { exact: true }).waitFor();
    assert.match(await page.locator(".coverage-note").innerText(), /skipped/);
    // A replacement file clears the old review immediately; cancellation cannot restore it.
    await page.locator('input[type="file"]').setInputFiles(silent);
    assert.equal(await page.locator(".results").count(), 0);
    await page.getByRole("button", { name: /Prepare analysis/ }).click();
    await page.getByRole("button", { name: /Send evidence for analysis/ }).waitFor({ timeout: 30000 });
    await page.unroute("**/api/analyse/window");
    await page.route("**/api/analyse/window", async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.fulfill({ status: 502, json: { error: "Delayed test response", retryable: false } }).catch(() => {}); });
    await page.getByRole("button", { name: /Send evidence for analysis/ }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByText(/Analysis cancelled/).waitFor();
    await page.waitForTimeout(1700);
    assert.equal(await page.locator(".results").count(), 0);
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ passed: true, frames: "15+", transcripts, windows, syntheses, checked: ["actual WebM video/audio decoding", "transfer preview", "partial coverage", "retry reuses successful windows and transcript", "review synthesis", "history", "file hash mismatch", "verified playback", "silent video", "transcription failure fallback", "cancellation and stale results"] }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

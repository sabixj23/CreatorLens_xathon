# Uploaded-video AI analysis pipeline

Status: core pipeline implemented; synthetic live OpenAI pipeline test passed. Real-video quality evaluation remains open.
Date: 26 September 2026.

## Implementation progress

- [x] Inspect existing code and verify provider documentation.
- [x] Shared schemas, evidence validation, window scheduling, and merging.
- [x] Browser frame/audio extraction and transfer preview.
- [x] Transcription and structured OpenAI window/review endpoints.
- [x] Run coordinator, retries, cancellation, and partial coverage.
- [x] Workspace integration and backward-compatible history.
- [x] Automated tests, typecheck, lint, build, and browser verification.
- [x] Live synthetic-media AI smoke test and measured results (pipeline execution; speech accuracy remains unverified).

Implementation notes: use `whisper-1` with `verbose_json` segment timestamps; keep `OPENAI_MODEL` for visual reasoning. Official sources: [transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Node.js was absent from the shell; verification used Node 22.14.0 downloaded into `/private/tmp` with approval.

Implemented: the new Home flow uses browser-only Mediabunny extraction, bounded PCM audio, three concurrent 10-second windows, validated merging and final synthesis. Run cache retains three metadata-only entries in memory and successful windows for retries; extraction is reused while the selected file remains open. Reviews persist in the existing localStorage format with an optional versioned analysis record, preserving legacy history and performance links. Storage quota failure keeps the review visible and provides a save retry. IndexedDB is deferred because raw media is not persisted and these bounded metadata records fit normal localStorage usage; history is never silently evicted. One <=90-second audio chunk avoids transcription boundary stitching and stays below 2.9 MB. Browser verification and remaining acceptance checks are recorded below.

### Verification record — 26 September 2026

- `npm test`: **12/12 passed** after the evidence-reference fix. Covers window boundaries through 90 seconds, invalid evidence IDs/modalities/timestamps, conservative merging, review coverage/rating checks, transcript offsets and invalid timing, WAV validation/audio measurements, retry bounds, concurrency/cancellation, provider refusal/incomplete/malformed responses, quota/auth failures, and transcription route handling.
- `npm run test:browser`: **passed in headless Google Chrome** with generated 12-second VP8/Opus WebM and six-second video without an audio track. Real local decoding/extraction, mocked AI responses. Verified transfer preview, transcript reuse, failed-window-only retry, partial-to-complete review, evidence seeking, local history, mismatched-file rejection, matching-file playback, silent-video path, explicit transcription-failure fallback, and cancellation without stale results. No page exceptions.
- `npm run typecheck`: **passed**.
- `npm run lint`: **passed**.
- `npm run build`: **passed** after integration; all new API routes compile. Home initial JS is approximately 141 kB, with media decoding loaded on demand.
- `git diff --check`: **passed**.
- **Live verification now passed:** `.env` now supplies the server key. After the fix below, `npm run test:live` completed against OpenAI: 2/2 windows, no missing visual intervals, five findings, 16,341 ms for analysis (excluding local extraction). Models: `whisper-1` and `gpt-4.1-mini-2025-04-14`; 14,534 reported image/text input tokens and 1,734 output tokens. This was a synthetic title-card clip with tone audio, not a speech-quality benchmark. Transcription returned segments despite the tone-only fixture, so non-speech hallucination handling requires further evaluation. No credentials or media were recorded in this plan.
- **Still to evaluate with real media/models:** spoken transcription accuracy, H.264/AAC browser compatibility, text-heavy/rapid-cut/90-second end-to-end clips, human review of finding support, and the under-two-minute target for a 60-second clip. These are not marked passed by mocked tests.

Implementation decisions: preserved the legacy `/api/review` endpoint, added `/api/transcribe` and `/api/analyse/{config,window,review}`, and kept raw media out of persistence. Public authentication/rate limiting and account spend controls remain deployment work. Coach, Post ideas, AI personalisation, and targeted follow-up inspection remain out of scope. The core implementation and synthetic live execution are verified; human quality evaluation and the representative-video acceptance gates below remain open.

## Objective and scope

Build the core analysis pipeline for a locally selected 5–90 second video, up to 150 MB. Produce a visual, speech, and audio-signal review with clickable evidence, explicit coverage, and actionable edits. Keep the original video on the device, as required by `project_spec.md`.

This milestone covers extraction, transcription, multi-window analysis, evidence merging, review generation, progress, cancellation, and saved results. Coach, Post ideas, search, trends, and AI personalisation are later consumers of the evidence record; they are not part of this implementation.

## Current baseline

- `lib/media.ts` validates browser playback and samples at most 12 JPEG frames.
- `app/api/review/route.ts` submits frames and the creator brief to OpenAI Responses, validates JSON and frame references, and sets `store: false`.
- `app/page.tsx` previews outgoing frames, runs one request, and saves clickable findings.
- `lib/types.ts` and `lib/storage.ts` support a frame-only review in localStorage.
- The API key is supplied according to the user. Its presence does not establish that a live request succeeds. Do not print credentials or copy them into the plan.

## Architecture

Browser file → inspect/hash → extract frames and audio → preview outgoing evidence → transcribe → analyse overlapping windows → validate/merge evidence → synthesise review → save locally.

Use a browser-owned run coordinator and small, stateless Next.js API requests. Do not introduce a server upload endpoint, persistent media store, or long-running server job for this slice. Keep provider credentials and all provider calls server-side. Preserve the existing frame-only route until the new path passes acceptance tests.

### 1. Define contracts and run state

Add shared Zod schemas and inferred TypeScript types for:

- Video: ID, SHA-256 content hash, duration, dimensions, audio/decode status.
- Evidence: stable ID, modality, application-owned start/end times, source reference, and observed content or measured value.
- Transcript segment: ID, text, start/end, source chunk, and timing precision.
- Observation: ID, category, evidence IDs, description, uncertainty, source window.
- Analysis run: ID, status, provider/model identifiers, prompt/schema/pipeline versions, stage progress, usage, successful/failed windows, and coverage gaps.
- Review: summary, up to three strengths and three priority improvements, component ratings, next-recording exercise, optional cut order, and coverage.

Represent `preparing`, `extracting`, `awaiting-transfer`, `transcribing`, `analysing`, `merging`, `building-review`, `ready`, `partial`, `failed`, and `cancelled`. Carry a run ID through asynchronous work so an old run cannot overwrite a new file's state.

### 2. Extract evidence locally

- Retain browser validation; also validate finite dimensions, actual decoding, and audio capability before paid calls.
- Compute the content hash locally. Keep the file and high-resolution re-extraction capability in memory; release object URLs and buffers when replaced or cancelled.
- Sample one frame/second, two/second in the opening five seconds, and bounded extra frames around detected scene changes. Deduplicate timestamps, include the ending, and cap initial extraction at 160 frames.
- Detect candidate scene changes using local frame differences. Label these as candidates, not definitive cuts or motion analysis.
- Resize JPEGs with explicit byte and dimension limits while preserving readable text. Keep frames ordered with stable IDs and application-generated timestamps.
- Prove a browser decoder/audio extractor on the demo browser first. Select a maintained browser media library only after verifying codec support, licensing, bundle cost, and memory behaviour. Do not assume an HTML video element alone exposes decoded audio samples.
- Extract mono PCM for local RMS/peak level, near-silence, and clipping-candidate measurements. Record thresholds and intervals; these measurements do not establish music masking speech or perceived audio quality.
- Encode bounded audio chunks for transcription. Preserve source offsets and handle chunk boundaries without invented word timing.
- Distinguish no audio track, no detected speech, unsupported audio decoding, and extraction failure. Silent clips continue visually; other failures are visible.

### 3. Show the transfer summary

Before any provider call, show actual frame thumbnails/timestamps, audio ranges and total duration, brief, and provider. If all audio is sent, say so explicitly. Explain that transcript text and measurements will be reused for scene analysis and review generation.

Keep raw media transient on the server and out of logs. Use `store: false` on applicable Responses calls; do not send it to unsupported endpoints. Update current UI wording that says no audio is sent. Retain the project's existing deployment data-control verification requirement; it is not a blocker to writing code or using synthetic fixtures.

### 4. Add timestamped transcription

Create `POST /api/transcribe` with bounded multipart audio input and a server-side provider adapter. Verify current official OpenAI documentation during implementation before selecting a model: require genuine segment timestamps or supported alignment, not merely transcript text. Configure transcription separately from the image/reasoning model.

Validate file type, byte size, chunk metadata, provider response, and timestamp bounds. Convert chunk-relative timestamps to video time, reconcile overlap, and retain provenance. Never spread words evenly to manufacture timestamps. Keep transcription below documented provider limits and actual deployment request limits.

On failure, offer retry or an explicitly labelled visual-only continuation. If no speech is detected, continue without inventing a transcript.

### 5. Analyse overlapping windows

Create windows of 10 seconds with approximately two seconds overlap (stride eight seconds), clipping the last window to the video duration. Assign frames, transcript segments, and audio measurements by interval overlap.

Create `POST /api/analyse/window`. Each request contains the brief, window bounds, ordered evidence, and a schema version. Use schema-constrained output where supported and validate again with Zod. Treat briefs, visible text, and transcripts as untrusted content rather than instructions.

Ask for observations about opening, framing, text, demonstrations, pacing cues, speech structure, audio measurements, alignment, payoff, and ending only where supported. Return supplied evidence references; resolve timestamps in application code. Reject unknown IDs and out-of-window references. Do not allow still frames to justify precise motion or lip-sync claims.

Schedule at most three concurrent analysis calls. Bound total requests, input bytes, images, tokens, and run duration. Retry transient failures at most twice with jittered backoff and provider retry guidance. Do not automatically retry invalid input or authentication failures. Preserve successful windows and retry only missing work.

### 6. Merge evidence and synthesise the review

Merge locally into a versioned event index. Deduplicate exact observations by category and evidence references, then conservatively reconcile overlapping descriptions. Preserve combined references, source windows, contradictions, and uncertainty; do not silently drop distinct observations.

Create `POST /api/analyse/review` receiving the compact index, brief, and coverage rather than resending images/audio. Generate priorities, audience relevance, practical edits, and an exercise. Define a component-rating rubric and return unavailable ratings for unsupported dimensions; do not predict retention or virality.

Validate every finding → observation → evidence reference, time range, rating, and optional cut-order interval before display. Derive clickable timestamps from evidence. A synthesis failure keeps the completed index available for retry. Missing visual windows produce a partial review with explicit gaps; complete visual failure must not produce a successful review.

### 7. Connect the workspace and persistence

Replace the single-call UI with stage progress, window counts, cancel, retry failed stages, partial coverage, and evidence-linked findings. Include transcript/audio evidence in seek behaviour instead of assuming every finding has a frame ID. Stop scheduling on cancel and abort active fetches where possible; do not promise cancellation reverses provider work already started.

Persist versioned review/index metadata locally using IndexedDB if the new record size exceeds sensible localStorage use. Keep old saved reviews readable through a versioned adapter; never erase existing history during migration. Do not persist raw video or audio by default. Require matching file hash when reselecting media for playback.

Cache extraction by video hash plus extraction version; cache analysis by hash, canonical brief, evidence digest, provider/model, and prompt/schema/pipeline versions. Reuse extraction when the brief changes, but regenerate brief-dependent analysis. Resume cached evidence only if it is still available or after matching file reselection. Add bounded cache eviction and quota-error handling.

## Proposed files

| Area | Files |
|---|---|
| Contracts | `lib/analysis/schemas.ts`, updates to `lib/types.ts` |
| Local media | `lib/media/inspect.ts`, `hash.ts`, `frames.ts`, `audio.ts` |
| Pipeline | `lib/analysis/windows.ts`, `runner.ts`, `merge.ts`, `validate.ts`, `cache.ts` |
| Provider | `lib/ai/openai.ts`, `transcription.ts`, `prompts.ts` |
| Endpoints | `app/api/transcribe/route.ts`, `app/api/analyse/window/route.ts`, `app/api/analyse/review/route.ts` |
| UI | `app/page.tsx`, `components/video/transfer-preview.tsx`, `analysis-progress.tsx`, `review-results.tsx` |
| Persistence/docs | `lib/storage.ts`, `app/history/page.tsx`, `.env.example`, `README.md` |

Names are proposed; keep modules small without splitting trivial helpers unnecessarily. Add configurable transcription model, request timeout, and run-budget settings. Keep secrets out of browser code. Enforce request limits server-side as well as client-side; use a restricted demo session or authentication, rate limits, and spend controls before public exposure.

## Delivery order and exit gates

1. **Contracts and visual proof:** shared schemas, provider adapter, denser local frames, and one real window returning a clickable finding about something absent from the transcript.
2. **Audio proof:** browser extraction, measurements, timestamped transcription, and silent-video/failure paths verified on fixture clips.
3. **Complete pipeline:** bounded window scheduling, retries/cancellation, evidence merge, and validated final synthesis.
4. **Product integration:** transfer preview, progress/partial states, history compatibility, local caching, and matching-file playback.
5. **Verification:** automated checks, end-to-end fixtures, live synthetic-media test, and recorded quality/latency/usage results.

## Validation and acceptance

- Unit-test window boundaries, timestamp offsets, evidence-reference rejection, overlap merge, cache invalidation, cancellation/stale-run handling, and retry limits.
- Mock provider responses for malformed JSON, refusal/incomplete output, unknown evidence, rate limits, timeout, transcription failure, and partial visual failure.
- Exercise supported speech, silent, music-only, text-heavy, rapid-cut, and 90-second clips; reject corrupt, oversized, unsupported, and out-of-range media before paid calls.
- Verify outgoing requests contain only disclosed evidence, no original video or exposed API key. Confirm logs exclude media/transcripts and full request bodies.
- Confirm strengths/improvements seek to supported moments, a human can verify their evidence, no-speech results contain no fabricated speech, and incomplete coverage remains visible.
- Confirm saved legacy reviews still open and wrong-file reselection is rejected.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` after integration, plus meaningful pipeline tests.
- Run a real OpenAI end-to-end test using a synthetic/non-private clip and the configured server key. Record models, versions, stage latency, usage, coverage, and timestamp accuracy without credentials or private content.
- Measure the specification's target of under two minutes for a 60-second clip on the demo setup; report actual measurements rather than claiming the target in advance.

Completion means the new end-to-end path is implemented and live-tested, with evidence-backed multimodal results and honest degraded states. This document alone does not mark any implementation milestone complete.


## Live-test error fix — 26 September 2026

- Reproduced the reported generic error during final synthesis: the generated review referenced an ID absent from the supplied evidence record. This confirms one cause of the message; it does not prove every previously failed user run had the same cause.
- Restricted generated reference fields to per-request ID enums in both window and review schemas. Findings/ratings can only name supplied observation IDs; proposed cuts can only name supplied evidence IDs. Kept independent runtime validation and bumped pipeline version to `video-v2.2` to invalidate stale run caches.
- Replaced the misleading catch-all error with stage-specific, application-authored validation messages. Unexpected failures now report a server error; transcription format/timing failures report transcription explicitly. Raw provider errors and private content remain hidden.
- Added regression coverage for reference namespaces, contextual error messages, invalid transcript timing, and private-error suppression. Fixed the live test selector to exclude Next.js's route announcer.
- Validation: 12 tests passed; production build (including type/lint checks) passed; real synthetic live run completed successfully in approximately 16.3 seconds. Refresh the application before retrying an uploaded video.

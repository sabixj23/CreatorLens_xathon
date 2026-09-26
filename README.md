# CreatorLENS

A first working slice of the short-video review app described in [project_spec.md](./project_spec.md).

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
3. `npm run dev` and open `http://localhost:3000`.

Use Node.js 22 or later. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` to verify the app. With the dev server running on port 3000 and Google Chrome installed, `npm run test:browser` generates synthetic video and exercises the UI with mocked AI responses (no paid calls).

The AI routes use `OPENAI_MODEL` (default `gpt-4.1-mini`). Timestamped transcription uses `OPENAI_TRANSCRIPTION_MODEL=whisper-1`; models without segment timestamps are rejected. `OPENAI_TIMEOUT_MS` defaults to 60000 and is bounded to 5–120 seconds per provider request.

With a configured server API key, `npm run test:live` exercises the same synthetic title-card video against real OpenAI endpoints and prints coverage, latency, usage, and finding count. It incurs API usage. This smoke test does not establish speech-recognition quality; evaluate a spoken clip separately.

## What this build does

- Home accepts a 5–90 second video up to 150 MB and 4K, checks browser decoding, and hashes it locally. Chrome with H.264/AAC MP4 or VP8/Opus WebM is the initial target; codec availability varies by browser.
- Browser extraction samples one frame/second, twice/second in the opening, the ending, and bounded extra frames around candidate scene changes (160 total maximum). Mediabunny is loaded on demand for local decoding; its MPL-2.0 license remains in the dependency.
- Before sending, the creator sees frame thumbnails, audio ranges, and the brief. The original video stays local. A mono 16 kHz WAV of the full audio track (under 2.9 MB for 90 seconds) is sent for timestamped transcription unless skipped or effectively silent. Local RMS, near-silence, and clipping-candidate measurements accompany visual analysis.
- The pipeline analyses overlapping 10-second windows, up to three concurrently, validates references, merges observations, then generates a review from the compact evidence index. Responses calls use `store: false`. Reviews include up to three strengths and three priority edits, subjective component ratings, a practice exercise, and an optional cut order.
- Speech, visual, and audio findings seek to their evidence timestamps. Missing windows and unavailable/skipped audio are labelled explicitly. Transcription failure offers retry or an explicit visual-only continuation. Audio levels do not establish perceived sound quality, and sampled frames cannot prove precise motion.
- Cancel stops scheduling and aborts active requests where possible. Transient requests retry at most twice with backoff. A six-minute attempt deadline and 42-request cap bound runs; server-side byte/schema limits bound individual calls. Successfully analysed windows and transcripts remain cached in memory for retry. Changing the brief regenerates analysis while reusing local extraction.
- Reviews and the metadata evidence index are saved in localStorage, without media. Legacy reviews remain readable. Storage quota errors preserve the visible result and offer save retry. History playback requires reselection of the exact original file, checked by SHA-256.
- History shows saved reviews and can delete them. Post Analysis stores manually entered, dated performance snapshots locally and compares reported views only for posts on the same platform measured at similar ages. Trends currently shows a clear unavailable state.

## Privacy and deployment

The route does not log request bodies or persist media. Browser history and reported performance metrics remain on the device. `store: false` prevents supported response storage but does not imply zero provider retention; see [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). Before processing creator data, the deployment owner must verify that the exact OpenAI API organisation and project have not enabled training-related data sharing. That account check is still pending.

This build is suited to local development. Add authentication or a restricted demo session, rate limits, and account spend limits before public deployment. The browser's run budget is not an abuse-control mechanism for publicly accessible endpoints. AI personalisation, Coach, Post ideas, trend integrations, and targeted follow-up inspection remain later milestones.

The current implementation and verification status are tracked in [the pipeline plan](temp/ai_video_analysis_plan.md). A live response requires a nonempty server API key; synthetic browser tests alone do not establish model quality or live latency.

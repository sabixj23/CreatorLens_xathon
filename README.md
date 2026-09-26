# CreatorLENS

A first working slice of the short-video review app described in [project_spec.md](./project_spec.md).

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.
3. `npm run dev` and open `http://localhost:3000`.

Use `npm run typecheck`, `npm run lint`, and `npm run build` to verify the app. The AI route uses `OPENAI_MODEL` if set, otherwise `gpt-4.1-mini`.

## What this build does

- Home accepts a 5–90 second video up to 150 MB, previews it locally, and samples up to 12 still frames in the browser.
- The creator sees every frame and timestamp before sending. The server sends those frames and the creator brief to OpenAI with `store: false`. The original video and audio are not sent. The first review therefore cannot assess speech, sound, or precise motion.
- Findings cite supplied frame IDs and seek to those moments in the browser video. Reviews, without raw media, are saved in browser local storage.
- History shows saved reviews and can delete them. Post Analysis stores manually entered, dated performance snapshots locally and compares reported views only for posts on the same platform measured at similar ages. Trends currently shows a clear unavailable state.

## Privacy and deployment

The route does not log request bodies or persist media. Browser history and reported performance metrics remain on the device. `store: false` prevents supported response storage but does not imply zero provider retention; see [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). Before processing creator data, the deployment owner must verify that the exact OpenAI API organisation and project have not enabled training-related data sharing. That account check is still pending.

This build is suited to local development. Add authentication or a restricted demo session, rate limits, and spend limits before public deployment. AI personalisation, transcription, richer frame sampling, trend integrations, and verified video reselection are later milestones.

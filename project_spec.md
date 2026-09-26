# CreatorLENS — Build Specification

## 1. Product objective

Build a Next.js application that helps emerging creators improve short videos before publishing to YouTube Shorts, Instagram Reels, or TikTok.

Creators upload a video of up to 90 seconds, specify their target audience and goal, and receive:

- A visual and audio review with clickable timestamps.
- Strong moments worth preserving.
- Weak moments with specific improvement suggestions.
- An interactive coach that understands the uploaded video.
- Relevant trend inspiration, caption ideas, and hashtags.
- Personal history containing previous reviews, saved advice, and trends used.
- Post-publishing analysis that uses actual video performance to personalise future coaching.

**Core promise:** Show creators what is happening in their video, explain how it supports or weakens their intended message, and help them make a better next version.

## 2. Product foundation:

Use sampled visual evidence, audio signals, and optional transcription into a shared event index. Search, review, coaching, and edit planning reuse this evidence, with validated references back to the footage.

### CreatorLENS adaptation
Timestamped record of shots, speech, text, demonstrations, and audio events
Creator review covering visual communication, hook, pacing, clarity, and payoff |
Ask Coach : Video-specific improvement advice and follow-up questions |
Attention : How well the video is based on: interesting, captivating, enriching etc
Moments search | Find strong openings, confusing sections, repetitions, and useful demonstrations |
Director’s Cut | Suggested cut order and revised opening |
Session experience | Saved reviews and ongoing creator history |
Post Analysis | Based on the actual performance of the video, our app can improve and personalise to the creator to help them cater to their audience better.

Build CreatorLENS as a creator-focused product.

## 3. Audience and supported content

Initial users are emerging creators making:

- Tips and educational explainers.
- Product demonstrations and reviews.
- Talking-head videos with supporting footage.
- Simple visual tutorials.
- Day in the life, Cooking, etc

Support one primary language initially: English.
Next scope: Tamil, Chinese etc

Accept videos between 5 and 90 seconds. Support portrait, square, and landscape footage, with the interface optimised for portrait video.

Proposed initial format: MP4 with H.264 video and optional AAC audio, up to 150 MB. Validate actual decoding support and duration before analysis.

Silent videos remain supported through visual analysis.

## 4. Application structure

Primary navigation:

**Home · Trends · History · Post Analysis**

Each video opens a workspace containing:

**Review · Coach · Post ideas**

### Home `/`

The main landing page and its main action is **Analyse your video, take a preflight**.

Collect:

- Video file.
- Intended platform.
- Topic or niche.
- Target audience.
- Goal: educate, entertain, encourage saves, or encourage follows.
- Optional concerns: “Does my opening catch attention?” - can have some suggested options buttons
- Optional preferences: “Keep my relaxed style.” - can have some suggested options buttons

Show recent analyses beneath the upload area.

The creator can preview the video and edit the brief before starting.

### Video workspace `/videos/[id]`

Desktop layout:

- Left: video player and clickable timeline.
- Right: review, coach, or post ideas.
- Below: evidence cards and improvement checklist.

On mobile, show the player above the selected panel.

Keep the player available when switching between review and coaching.

### Trends `/trends`

Display relevant examples and formats, with platform and niche filters.
Pull from relevant apis like youtube, tiktok, instagram if possible.

### History `/history`

Display previous videos, saved advice, action status, and trends the creator marked as used.

### Post Analysis `/personalise`

Help creators learn from how their published videos actually performed and use those results to personalise future reviews and coaching for their audience.

Page heading: **Post Analysis**

Page introduction: “See what resonated with your audience. Add your published video’s results to get personalised suggestions for your next video.”

Place this page immediately after History in the primary navigation. Allow creators to open it from a saved video in History with **Add performance**.

#### Add published results

Select a previously analysed video and record:

- Published post URL, platform, and publication date.
- Performance measurement date, so results have a clear observation window.
- Available views, likes, comments, shares, saves, and follows attributed to the post.
- Average watch time, completion rate, and audience-retention data, when available.
- Optional audience feedback and creator notes about changes made before publishing.
- Which saved suggestions were actually applied.

For the hackathon, support manual entry from the creator’s platform analytics. Label these results **Creator-reported**. Automated imports are a later feature, subject to verified platform access; do not imply that pasting a post URL retrieves private analytics.

Require a platform, publication date, measurement date, and at least one performance metric. Keep unavailable metrics empty rather than treating them as zero. Validate non-negative counts, percentages from 0–100, and a measurement date no earlier than publication. Allow additional dated snapshots without overwriting earlier results.

#### Page content

- **Performance overview:** Show the selected post’s reported metrics, source, measurement date, and time since publishing. Display a retention chart only when actual retention data is provided.
- **What resonated:** Relate available results and audience feedback to the video’s hook, pacing, topic, format, and payoff. Link video-specific observations to the original review evidence.
- **Audience patterns:** Compare the creator’s own posts on the same platform at similar times since publishing. Show the posts and metrics supporting each pattern; explain when there is too little comparable data.
- **Try in your next video:** Offer up to three practical experiments aligned with the creator’s goal, such as testing an earlier demonstration or a shorter opening. Let the creator save them as actions.
- **Your personalisation:** Show the audience preferences and content patterns proposed for future coaching. Let the creator confirm, edit, or remove them, and turn their use in future recommendations on or off.

Primary actions: **Add performance · Save results · Save next-video action**.

Empty state: “Published a video? Add its results to start learning what your audience responds to.” If History is empty, offer **Analyse your first video** linking to Home.

#### How personalisation works

Combine saved performance snapshots, the original review, the creator’s stated audience and goal, and confirmed applied changes to suggest what to test next. Use only creator-confirmed insights in future reviews, Coach responses, and Post ideas when personalisation is enabled.

Distinguish measured results from possible explanations. Aggregate views or watch time cannot establish a timestamped audience drop-off or prove that an edit caused an improvement. Treat patterns from limited data as tentative and do not promise future performance.

Keep the creator’s preferred style visible when suggesting changes. Each personalised recommendation should explain which saved results informed it.

## 5. Video analysis: mandatory capabilities

**A transcript-only review does not satisfy this specification.**

The analysis must examine visual evidence and its relationship to speech and audio timing.

| Dimension | What to inspect |
|---|---|
| Visual opening | What appears first; whether the subject, problem, or outcome is understandable |
| Framing | Subject visibility, distracting composition, cropped demonstrations |
| On-screen text | Readability, placement, visible wording, and approximate display duration |
| Visual storytelling | Whether footage demonstrates or supports the message |
| Editing and pacing | Shot changes, static stretches, repetition, and pauses |
| Speech | Message, structure, clarity, and repeated information |
| Audio signals | Silence, level changes, and potential clipping |
| Cross-modal alignment | Whether visible evidence matches what is being said |
| Payoff | Whether the promised result is shown or explained |
| Ending | Whether the video resolves its main point and provides a relevant next step |

Only make claims supported by the available evidence.

Sampled frames cannot establish precise motion, lip synchronisation, or everything that happened between samples. Flag uncertainty and request denser inspection when needed.

Audio levels alone cannot establish that music masks speech. Such a conclusion needs suitable audio analysis; otherwise describe only the measured level issue.

## 6. Analysis pipeline

### A. Inspect the file

Read duration, dimensions, orientation, audio presence, and decoding compatibility.

Reject invalid or oversized files before calling a paid API.

Generate a content hash for identifying the video and avoiding accidental duplicate analysis.

### B. Extract evidence in the browser

Use a browser media library, such as the approach demonstrated by UNSEEN, for local decoding and extraction.

Initial sampling policy:

- One baseline frame per second.
- Two frames per second during the opening five seconds.
- Additional frames around detected scene changes.
- Denser frames around selected moments that need clarification.
- Maximum 160 unique frames per video for the initial version.

Resize frames for efficient analysis while preserving readable text. Retain access to higher-resolution local frames for targeted inspection.

Extract:

- Timestamped JPEG frames.
- Basic audio-level and silence measurements.
- Audio chunks for transcription.
- A local thumbnail and video metadata.

Keep the original video local. Send only the frames, audio intervals, and supporting context needed for the requested analysis, following the privacy requirements in section 14. Show what will leave the device before sending it.

### C. Transcribe speech

Use a transcription adapter that returns timestamped segments.

Do not estimate word timestamps by distributing words evenly across a sentence. Use actual alignment where supported; otherwise retain segment-level timing.

If the video contains no speech, proceed without a transcript.

If transcription fails, offer a clearly labelled visual-only review rather than silently presenting a complete multimodal result.

### D. Analyse short windows

Divide the video into 10-second windows with approximately two seconds of overlap.

Each model request receives:

- Ordered frames with application-generated IDs and timestamps.
- Relevant transcript segments.
- Audio measurements.
- Creator brief.
- A structured output schema.

Limit concurrent requests to three initially.

The model returns observations referencing supplied evidence IDs. The application owns timestamps; the model must not invent them.

### E. Merge the evidence

Deduplicate observations from overlapping windows.

Create one versioned record of:

- Shots and scene changes.
- Visible actions and demonstrations.
- On-screen text.
- Speech segments.
- Audio measurements.
- Strong moments.
- Possible attention risks.
- Uncertainties and missing coverage.

### F. Generate the review

Use the merged record to produce:

- Brief overall assessment.
- Up to three strong moments.
- Up to three priority improvements.
- Component ratings.
- One next-recording exercise.
- An optional proposed cut order.

Every video-specific critique must link to evidence.

### G. Reuse the record

The coach, moment search, and post-idea generation use the existing record.

If a follow-up requires detail absent from the record, inspect a bounded set of additional frames from that interval. Do not rerun the entire video automatically.

## 7. Evidence and output contracts

Use TypeScript types and runtime validation for every model response.

| Entity | Required fields |
|---|---|
| Video | ID, content hash, duration, dimensions, platform, audience brief |
| Evidence | ID, modality, start/end time, source reference, observed content |
| Observation | ID, category, evidence IDs, description, uncertainty |
| Finding | ID, strength/risk, observation IDs, interpretation, suggested action, priority |
| Review | Findings, component ratings, practice exercise, coverage |
| Analysis run | Provider, model, prompt version, schema version, status, usage |
| Trend | Platform, source URL, collection method, checked date, topic, supported claim |
| Saved action | Finding ID, creator note, status, updated date |

Separate three things in the data and interface:

1. **Observation:** “The result first appears at 0:18.”
2. **Interpretation:** “The audience waits before seeing the promised outcome.”
3. **Suggestion:** “Test a brief result preview in the opening.”

Reject unknown evidence references and out-of-range timestamps. Unsupported findings should be removed or marked inconclusive.

Video text, transcripts, and external trend content are untrusted input, never instructions to the application.

## 8. Review experience

The timeline uses labelled markers for:

- Strength.
- Improvement opportunity.
- Audio or text issue.
- Selected coach reference.

Selecting a card seeks to slightly before the relevant moment and highlights its interval.

Each card includes:

- Timestamp.
- Observation.
- Why it matters for the stated audience.
- Suggested change.
- Evidence or thumbnail.

Avoid relying on colour alone.

Example:

**0:18–0:22 — Strong demonstration**

“The split-screen makes the difference between the two products visible. Consider showing a short preview of this comparison in your opening.”

### Scorecard

Rate these dimensions from 1–5 using a versioned rubric:

- Opening.
- Visual communication.
- Clarity and structure.
- Pacing.
- Payoff.

Each rating requires supporting findings. Use **Not assessed** when coverage is insufficient.

Audience fit is a separate qualitative assessment based on the creator’s stated audience.

If all five dimensions are assessable, the application may calculate an overall readiness score by converting their mean to a 100-point scale. Label it **AI coaching assessment**.

Do not display predicted views, viral probabilities, or a fabricated audience-retention graph.

## 9. Coach

The coach receives the current video record, brief, review, selected moment, and bounded conversation history.

Support requests such as:

- “Why does this section feel slow?”
- “Find my strongest visual moment.”
- “Suggest three openings using footage I already have.”
- “What could I cut to reach 30 seconds?”
- “How can I explain this for beginners?”
- “Help me adapt this saved trend.”

Video-specific statements must cite clickable moments.

Distinguish suggestions that use existing footage from those requiring a reshoot.

Allow creators to save advice as an action:

**To try · Applied · Skipped**

Previous history can inform coaching only through explicit saved information. Do not assume a creator implemented a suggestion merely because it was shown.

## 10. Captions, hashtags, and edit ideas

The Post ideas panel generates:

- Three post-caption options.
- Two alternative opening scripts.
- A small set of relevant hashtags.
- One suggested call to action.
- An optional cut list.

Label written post captions separately from on-screen subtitles.

Generated ideas must remain faithful to the video’s content. Do not invent product claims or promise performance improvements.

Only call a hashtag “trending” when there is current supporting source data.

The cut list contains valid source intervals and a proposed order. Editing and downloadable video export are stretch features.

## 11. Trends page

### Initial data strategy

**YouTube:** Use the Data API for topic-based discovery and available metadata.

**TikTok and Instagram:** Use a curated reference collection for the hackathon. Add automated providers later when access and coverage are verified.

Do not make unapproved cross-platform data access a launch dependency.

Each card includes:

- Title and platform.
- Topic or format.
- Example link.
- Source and date checked.
- Available metrics with their retrieval date.
- Collection label: API discovery or curated reference.
- Suggested adaptation for the selected video.

Actions:

**Save · Apply to my video · Mark as used**

“Apply to my video” opens the coach with the trend and current video evidence.

Metadata-only sources support topic and title analysis. They do not establish visual editing patterns or spoken hooks. Those claims require reviewed media or clearly attributed editorial notes.

A single popular example is not proof of a rising trend. Display growth only when comparable measurements support it.

If a source fails, show the last successful snapshot with its date. Never replace missing data with fabricated metrics.

## 12. Personal history

Persist:

- Video metadata and thumbnail.
- Brief and completed reviews.
- Evidence record.
- Coach conversations.
- Saved actions.
- Saved and used trends.
- Published post details and dated performance snapshots, including their source.
- Creator-confirmed audience insights and the personalisation preference.
- Analysis model and rubric version.

For the hackathon, use IndexedDB for same-browser persistence.

Do not persist raw videos by default. After reopening a saved review, ask the creator to reselect the original file for playback and verify its hash.

Explain that history is stored on this device and can be lost if browser data is cleared.

Provide delete-video and clear-history actions. Account-based cloud sync is a later feature.

Post Analysis uses the same device-local storage. Allow performance snapshots and confirmed insights to be edited or deleted. Deleting a video also removes its linked performance data and invalidates insights that depended on it; clearing history resets personalisation.

A revised video creates a new record linked to its predecessor. Never overwrite the original analysis.

## 13. Next.js implementation

Use:

- Next.js App Router.
- TypeScript.
- React client components for playback, extraction, timeline, and local storage.
- Tailwind CSS and accessible UI components.
- Next.js Route Handlers for AI and trend requests.
- Zod or an equivalent runtime schema validator.
- IndexedDB for local history.
- Provider-specific SDKs behind a shared application interface.

Suggested organisation:

| Area | Responsibility |
|---|---|
| `app/` | Pages, layouts, and API routes |
| `components/video/` | Player, upload, timeline, evidence cards |
| `components/coach/` | Chat and cited responses |
| `lib/media/` | Decode, sample frames, audio measurements, hashing |
| `lib/analysis/` | Window scheduling, merge, validation, scoring |
| `lib/ai/` | OpenAI and Anthropic adapters |
| `lib/trends/` | Sources, normalisation, caching |
| `lib/storage/` | Local history and migrations |
| `lib/schemas/` | Shared request and response contracts |

Suggested API routes:

- `POST /api/transcribe`
- `POST /api/analyse/window`
- `POST /api/analyse/review`
- `POST /api/coach`
- `POST /api/post-ideas`
- `GET /api/trends`

Keep work bounded per request. The browser coordinates windows and saves completed results so failed windows can be retried independently.

Configure payload limits below the chosen host’s limits. Send resized frames and bounded audio chunks, not the complete video in one Next.js request.

Public deployment requires authenticated access or a server-validated restricted demo session, rate limits, and spend limits. Local development may use a development-only bypass.

## 14. AI provider strategy

Create a shared interface for:

- Window analysis.
- Review generation.
- Coach responses.
- Post ideas.

Implement one provider first and keep the second interchangeable.

**OpenAI path:** Image-capable model for frame analysis and reasoning, plus a timestamp-capable transcription model.

**Claude path:** Image-capable model for frame analysis and reasoning, plus a separate transcription provider or locally hosted transcription service.

OpenAI and Claude both document image-input capabilities. This design uses timestamped frame sequences rather than assuming either selected model accepts and fully analyses an MP4 directly. See [OpenAI vision](https://developers.openai.com/api/docs/guides/images-vision), [OpenAI transcription](https://developers.openai.com/api/docs/guides/speech-to-text), and [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).

Choose exact model IDs after confirming available API credits and testing representative clips. Keep them configurable rather than embedded in application logic.

Run the same response validation regardless of provider. Switching providers creates a new analysis run and preserves the original.

Keep all provider keys on the server.

### Privacy and data handling

These requirements apply to initial analysis, retries, targeted follow-up inspection, Coach, Post ideas, and Post Analysis personalisation.

- **Original video stays local:** Never upload the original video to CreatorLENS servers or an AI provider. Decode and sample it in the browser. Send only the evidence needed for each task through the server to the named provider; reuse existing evidence rather than resending media unnecessarily.
- **Explain outgoing evidence:** Before the first analysis request, show a transfer summary with sampled-frame thumbnails and timestamps, audio time ranges and total duration, and the provider receiving each type of data. If transcription needs the full audio track in chunks, disclose that the full audio duration leaves the device. Include the brief and any relevant transcript, conversation context, performance metrics, or confirmed audience insights being sent. Show additional evidence transfers for follow-up inspection as well.
- **Disable response storage where supported:** Explicitly set `store: false` in the server-side OpenAI adapter for every applicable request, including retries and follow-ups. Do not pass unsupported parameters to transcription or other endpoints. Keep conversation state locally and send bounded context for each request.
- **Verify training-sharing settings:** Before using creator data, an organisation owner must verify the OpenAI API organisation’s Data controls and the settings applying to the exact CreatorLENS project. Confirm it has not opted into sharing inputs/outputs, feedback, or evaluation/fine-tuning data for model improvement. Record the organisation/project identifiers, verification date, verifier, and outcome without storing credentials. Recheck when changing the deployed organisation or project. ChatGPT account settings do not establish the API project’s settings.
- **Minimise server persistence:** Process evidence transiently; do not persist media or request/response bodies in server databases, logs, analytics, or error traces. Keep saved reviews and performance history in the browser as described in section 12. Log only operational metadata needed for usage and reliability.
- **Describe retention accurately:** `store: false` controls response storage; it is not a training opt-out or a guarantee of zero retention. OpenAI API data is not used for training by default unless sharing is explicitly enabled. Abuse-monitoring and endpoint-specific retention rules can still apply. Do not claim Zero Data Retention unless the deployed organisation/project has that approved configuration and the selected endpoints and features support it. Verify equivalent controls separately before enabling another provider.

Suggested notice beside **Analyse your video**:

“Your original video stays on this device. For this analysis, we send the frames and audio listed below, along with your brief, through CreatorLENS servers to the named AI providers. Your saved history stays in this browser. Provider retention policies apply.”

On `/personalise`, explain that saving performance results is local, while requesting AI-personalised advice sends the relevant results and confirmed insights to the named provider when personalisation is enabled.

Reference: [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data), checked 26 September 2026.

**Verification status:** Requirements documented; API organisation/project sharing settings have not yet been verified. Complete and record this check before processing creator data.

## 15. Reliability, cost, and state handling

Visible processing stages:

**Preparing video → Extracting evidence → Analysing scenes → Building review → Ready**

Also support:

**Partial result · Failed · Cancelled**

Requirements:

- Retry transient failures at most twice with backoff.
- Preserve successful windows.
- Allow cancellation; stop scheduling new work.
- Mark missing intervals visibly.
- Never show a successful complete review after silent visual-analysis failure.
- Cache by video hash, brief, model, and pipeline version.
- Reuse extracted evidence when only the brief changes.
- Bound coach history and output size.
- Log provider usage and latency without logging raw media or full private conversations.

Initial performance target: a 60-second clip reviewed in under two minutes on the demo machine and network. Measure this before presenting it as a product claim.

## 16. Build order

### Milestone 1 — Prove visual understanding

Upload, playback, frame extraction, one AI window, and a clickable visual finding.

Exit condition: detect a meaningful issue that is absent from the transcript.

### Milestone 2 — Complete the review

Multi-window processing, transcription, evidence merge, prioritised findings, and ratings.

### Milestone 3 — Connect the coach

Grounded follow-up questions, clickable references, saved advice, and post ideas.

### Milestone 4 — Add continuity and discovery

Persistent history, YouTube discovery, curated TikTok/Instagram references, and “Apply to my video.” Add Post Analysis at `/personalise` with manual performance entry, saved snapshots, and creator-confirmed personalisation.

### Milestone 5 — Verify the demo

Error states, budget controls, representative-video testing, and a clearly labelled previously analysed backup example.

Stretch: revision comparison and cut-sequence playback.

## 17. Acceptance criteria

The build is ready when:

1. A supported video up to 90 seconds completes analysis.
2. A silent video receives a useful visual review.
3. A fixture with irrelevant B-roll is recognised as visually mismatched to its speech.
4. A fixture with unreadable on-screen text produces a supported visual finding.
5. Every displayed critique links to valid evidence.
6. Timeline actions seek to the correct part of the video.
7. Coach responses stay within the selected video and relevant saved context.
8. Provider failure produces an honest error or partial result.
9. History survives refresh and offers verified file reselection for playback.
10. Trend sources, dates, and collection methods are visible.
11. Caption and hashtag suggestions remain grounded in the content.
12. API keys are absent from browser assets and network responses.
13. Post Analysis appears after History and saves validated, dated performance results linked to a reviewed video.
14. Personalised advice identifies its supporting results, respects the creator’s personalisation setting, and never fabricates missing metrics or retention data.
15. Network inspection confirms that original video files never leave the browser and outgoing frames, audio, and context match the displayed transfer summary, including follow-up requests.
16. Adapter checks confirm `store: false` on all applicable OpenAI requests, including retries, and no content-bearing server logs or persistent media storage.
17. The deployed OpenAI organisation/project has a recorded verification that training-related data sharing is disabled before creator data is processed.

Use a small evaluation set covering silent footage, talking-head content, rapid cuts, text-heavy clips, a product demonstration, noisy audio, and unsupported files.

Have a human reviewer check timestamp accuracy, evidence support, and whether the proposed edits are practical.

## 18. Demo narrative

Upload a creator’s draft containing:

- An opening that explains the topic before showing its value.
- A strong visual demonstration later in the video.
- One distracting or irrelevant shot.
- A repeated explanation.

CreatorLENS identifies these moments and links each finding to playback.

Ask the coach to improve the opening using existing footage. Apply a relevant trend reference, generate a caption, and save the suggested changes to history.

The proof is that CreatorLENS understood what viewers would see and hear—and turned that evidence into useful creative decisions.

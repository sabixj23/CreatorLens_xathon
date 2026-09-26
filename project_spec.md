# CreatorLENS — Complete Spec (everything discussed, full reasoning, full split)

## 0. What this document is

Every decision below was actually debated and resolved during planning — not just the "what," but the "why," because the why is what keeps two people building in parallel from drifting apart. Read this once fully before splitting up.

## 1. Product vision and positioning

One-liner: A human growth strategist costs SGD 800–2,500/month in Singapore. CreatorLENS gives a creator the analytical half of that job for ~SGD 30/month — plus something no human strategist offers: a simulated 12-week growth plan tested before the creator commits 8+ weeks of real effort to it.

Target user: plateaued creators, roughly 50k–200k subscribers, with 1–3 years of posting history. Explicitly not 0–10k creators (spec's own reasoning: too little data, too little willingness to pay) and not managed 1M+ creators (already have a real team).

### Why this specific stage, reasoned out fully

Getting from 50k–200k to 1M+ almost never comes from posting more of the same — whatever produced the initial growth (an early viral hit, a lucky format) has usually stopped working, which is why they've plateaued. The next step up requires a real strategic pivot (format shift, platform shift, audience shift), which is a genuinely risky decision at this size — a 150k-subscriber creator has a real audience to lose if the pivot is wrong, unlike a 5k creator who can experiment freely.

The product's core mechanism (a walk-forward backtest against the creator's own real history) requires 1–3 years of data to mean anything. A 5k-subscriber channel doesn't have enough history to backtest against; a 100k+ channel does. The target segment isn't arbitrary — it's the minimum viable segment for the model to be honest rather than a guess.

The "simulate before you commit" value proposition matters more here than at any other stage, because the cost of guessing wrong is highest here.

### Competitive positioning (from direct research into the current market)

- Analytics dashboards (vidIQ, TubeBuddy): tell you what already happened, not what to do.
- Hook/retention scorers (Go Viral, CopyBoss, SeenAI, OpusClip): judge one video in isolation, no ongoing strategy, and their virality scores are independently reported as unreliable (a 40-scored clip regularly outperforms an 85-scored one — nobody in this space publishes real accuracy numbers).
- Autopilot content generators (Klap, Opus): make content, not decisions.
- Named direct competitor: NEXORA — connects via OAuth, analyzes what happened, advises what to post next. We differ by projecting forward (simulation) instead of only analyzing backward, and by recalibrating against this creator's own real results instead of generic niche benchmarks.

Our actual differentiator, stated honestly: not "we use GPT," not "we predict virality" — it's the closed loop: real historical data → derive a strategy → simulate alternatives with stated trade-offs → creator posts → measure real results → recalibrate. Nobody else in this space closes that loop, and nobody else is willing to say "we will not display an accuracy number" when they don't have one yet.

### Business model reasoning

One human strategist serves ~10 clients; the model serves effectively unlimited clients at near-zero marginal cost — that's why SGD 30/month is viable against an SGD 800–2,500/month freelance rate (30–80× cheaper), sourced from real 2026 Singapore freelancer/agency rate data.

Position explicitly as augmentation, not replacement: we do performance analysis, content planning, platform mechanics, simulation+projection; the creator still owns brand negotiations, creative taste, community relationships, and the final call. This pre-empts the obvious "AI can't replace a strategist" objection rather than overclaiming and getting caught on it.

Team-fit note (needs your own input, not fabricated): the strongest "why us" material that's actually true right now is behavioral, not biographical — the team caught its own flawed assumption (that a 20-comparable-channel backtest was buildable, when the YouTube API can't actually provide that) before a judge could, deliberately pivoted off a working MVP when a bigger opportunity was clear, and repeatedly rejected flashier-but-dishonest options (a fabricated content score, a fake accuracy %) in favor of the harder, honest version. What's missing and only you can supply: does anyone on the team have real audience-growth, data/ML, or founder experience? Don't invent this for the deck — write down what's actually true.

## 2. Non-negotiable design principles (apply to every screen, both tracks)

This is the actual product philosophy, repeated because it's easy to erode under time pressure:

- Claim → Evidence → Recommendation. Never a bare claim.
- Every projection states its assumptions and its uncertainty. "A modelled trajectory based on your historical relationship between cadence, format mix, and growth" — explicitly labelled a scenario, not a forecast. Never a bare number like "you'll reach 150,000 subscribers."
- Every recommendation answers "why," with a real number behind it. "Because Format A generated 2.3× the subscriber conversion of your channel average across 27 videos" — not "make more of this."
- Never show a fabricated number. No virality scores, no invented percentages, no accuracy claim before it's measured. backtest is null until real — never a placeholder 0, because 0 reads as a claim of perfect accuracy. Every mocked element is visibly labelled, never presented as live.

## 3. Architecture — full reasoning, not just the diagram

Next.js (App Router) + TypeScript, one app, no separate backend service, no database. State lives in Auth.js JWT session cookies, a dedicated demo-unlock cookie readable by the API, and localStorage for the chosen path only.

Auth: Google OAuth via Auth.js (next-auth v5). Scopes: openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly, plus access_type=offline&prompt=consent so a refresh token is actually issued. Why this matters concretely: Auth.js v5 does not auto-refresh expired access tokens — someone has to write that into the jwt callback (check expires_at, call Google's token endpoint with the stored refresh_token), or a session prepared ahead of the demo silently dies by the time judges see it.

The key data-availability constraint that shaped the whole simulation design: YouTube Analytics API (real day-level watch time, subscribers gained/lost) only works for a channel the signed-in user owns. It is not available for comparable/competitor channels — there is no way to retrieve another channel's subscriber count from 3 months ago via any official API. This is why the original spec idea ("backtest against 20 real channels, predict month 4 from month 1") is not buildable as literally described — that historical data doesn't exist for channels you don't own.

Resolution: self-backtest against the creator's own real history instead. lib/simulation.ts walks forward week by week through the creator's own past data (not one fixed train/test split) — pick a past week, predict forward from it using the model fitted on earlier weeks, compare to what actually happened to them. This is both fully real and arguably a stronger, more personal demo line than "tested on 20 other channels."

Comparable channels (public Data API v3 only — channels.list + videos.list, no OAuth needed) supply only current snapshot metrics (views, likes, cadence, format mix) — used as descriptive support for a path's trade-off text ("channels in this niche that shifted this heavily toward Shorts show weaker long-form retention"), never as an input to a subscriber-count prediction.

Comparable data is precomputed once into a committed JSON fixture (lib/data/comparables.json, 5–8 channels in one niche) via a one-off script, not live-fetched per request — removes quota/latency risk from the live demo without making the model fake.

The 12-week horizon vs. short-term accuracy tension, resolved: the spec's stated differentiator is a 12-week simulation, and that's kept because content-strategy effects are slow-compounding — a 2-week window wouldn't show three strategies diverging meaningfully. But a regression fit on a small amount of a single creator's own weekly data can't honestly claim precision 12 weeks out. Resolution: show the 12-week chart with a widening confidence band — tight/specific for the next 1–2 weeks, visibly vaguer further out (same pattern as weather forecasting: precise for tomorrow, directional for day 10). The actionable, backtested claim only ever applies to the short range; the rest of the 12-week line is explicitly "where this path leads if nothing changes," not a guarantee.

AI calls are deliberately consolidated. /api/diagnose is one OpenAI call (store: false) that returns diagnosis, Content DNA, content ideas, and hook variants together, specifically to stay inside the ~30-second value window the spec requires and to avoid multiple round trips on the screen the demo lingers on. weeklyActions (the per-week action list) is templated, not LLM-generated, for the same reason — the frontend fetches all 3 paths in parallel on /dashboard/plan, and LLM-generated actions there would mean 3 OpenAI round-trips on that exact screen.

Trend-awareness is deliberately lightweight, not a separate system. A fuller architecture was proposed (a dedicated trend-ingestion engine across platforms, an LLM router tiered by task complexity, a RAG layer, per-video content analysis, multi-audience content remixing) — genuinely good long-term product thinking, but each piece is a multi-day build on its own and none of it fits the hackathon window. What ships: folding each comparable channel's recent top-performing video titles/topics into the diagnosis prompt as "what's working in this niche right now" context. The fuller vision is preserved as roadmap/pitch material (§13), explicitly separated from build scope so it's never mistaken for a commitment.

## 4. Complete feature list, with the reasoning behind each

- One-click YouTube connect (OAuth) — the funnel's entry point, must be one click per spec §6.
- Diagnosis — one sharp, non-obvious, evidence-cited reason growth stalled. Spec's own conversion condition: "post more consistently" doesn't convert, "your Shorts audience is 80% different from your long-form audience, so Shorts growth isn't feeding monetisation" does. Must appear within ~30 seconds or the funnel fails.
- "Your channel in one sentence" — a before/after contrast (channelInOneSentence.then / .now), e.g. "grew fastest when tutorials were paired with a 2× weekly cadence... but over the last 12 weeks, format mix shifted away from that combination." Added late in planning specifically because it's the highest emotional-impact, lowest-engineering-cost item in the whole plan — one more field in the same diagnosis call, no new request. Build it early.
- Content DNA ("Growth Memory") — the creator's real strongest topics/formats/hook-styles, computed by plain aggregation over their own real video history (no LLM needed for this part — sorting and grouping only). Reinforces "the AI knows your channel," which matters directly for the week-2 retention hook.
- Time-permitting only: splitting this into separate "most views" / "best subscriber conversion" / "best retention" rankings per format is genuinely buildable (YouTube Analytics API v2 reports.query with dimensions=video + metrics=subscribersGained,averageViewDuration is a real, documented report type for the channel owner) but is added API surface — sequence it behind the KPI scorecard/benchmark work.
- Content ideas + hook variants ("Hook Lab," reframed) — 2–3 next-post suggestions, each with trendRelevance/audienceFit as qualitative high/medium/low tags, never a numeric percentage (a fabricated "92% audience fit" would be exactly the dishonesty principle §2 exists to prevent), plus 2–3 stylistic hook-line variants per idea (bold/relatable/curiosity). Explicitly not per-video upload-and-edit tooling — these are read-only suggestions grounded in real Content DNA + trend context, generated in the same diagnosis call. Sequenced as "this week's content for your chosen path," placed after the 3-path fork, not floating as a generic idea list next to the diagnosis.
- 3-path 12-week growth simulation — the stated core differentiator. Three named strategies (e.g. "Double Down" / "Balanced" / "Experiment," not generic "Path A/B/C") each with an explicit one-line trade-off, never a claim that one path is simply "best." Full plan is shown free (see §5) — no teaser cutoff.
- KPI Scorecard — subscriber/view/watch-time trend tiles styled like a monthly business report tile, not a consumer app widget. Cheap: a restyle of data already computed.
- Benchmark table — this channel vs. the niche comparables on cadence and format mix, shown as a range ("You: 2.1 · Niche range: 1.5–2.4"), explicitly never a fake percentile ("better than 72% of creators") — there's no data to justify that specific a claim.
- Opportunity/trade-off matrix — a grid comparing the 3 paths on effort vs. projected growth vs. risk, replacing a plain card list specifically for this view.
- Executive-summary framing — the diagnosis renders as a one-page report (headline + supporting bullets), not a chat-style bubble. A deliberate design instruction, not a new component.
- Weekly recalibration — predicted vs. actual, using the same recalibrateWeek() function that powers the self-backtest (walk-forward retrospectively = the backtest; called on-demand for a scripted future week = the live demo mechanic). This is also the paywall's gating mechanism (see §5).
- Cross-platform view (Instagram/TikTok) — explicitly mocked, rendered through a shared `<MockLabel>` component, never presented as live. Building live integrations for these inside the hackathon window isn't realistic, and pretending otherwise would be worse than admitting it.
- In-app chat — grounded strictly in that session's own already-computed diagnosis/paths/backtest (server builds the system prompt from stored session data, never trusts the client's copy of it), told explicitly to say "I don't know" rather than invent anything about audience or platform data it wasn't given. Given suggested starter questions ("Why did my growth slow down?", "Which format should I make more of?", "Give me 3 ideas based on my Content DNA") instead of a blank "ask anything" box, so it reads as a contextual strategist tool, not a generic chatbot bolted on. This is the first thing cut if time is short — Content DNA + Ideas ship instead of chat, not in addition, because they're cheaper (one bounded call already piggybacking on /api/diagnose, plain card UI, no conversation state) and a stronger single demo beat.
- Sidebar navigation (Overview/Diagnosis/Content DNA/Strategy/Simulator/Ideas) — kept for the professional strategy-software look, but built as anchor navigation with scroll-spy highlighting over sections on the same two pages, not as 8 separate Next.js routes. Gets the polish essentially for free without the real cost of the routed version (a shared layout to avoid re-fetching /api/diagnose per page, route-based active-link logic, more surface area under time pressure) and without contradicting the earlier "keep the IA lean" decision — it's still one dashboard, just with a nice in-page nav aid.
- Visual design direction: Bloomberg Terminal × strategy consultancy, explicitly not TikTok × ChatGPT — dark navy/beige, large editorial type, very subtle card borders, minimal animation. This also reduces build risk (less animation work under time pressure), not just aesthetics.

## 5. Paywall and monetization — full design and reasoning

Evolution of this decision, kept because the reasoning matters: the original idea was an immediate paywall right after the diagnosis teaser (spec §6's literal design). That was revised after discussing a 15-day/2-week free-cycle hook idea — the insight being that a creator who sees the product actually work against real incoming data once is far more likely to pay than one who's asked to pay before seeing any real result. Since a hackathon demo can't show 15 real days passing, this was resolved into a mechanism that's real and demoable:

- Free tier: OAuth connect → diagnosis → Content DNA + ideas → the full initial 12-week 3-path plan (not a teaser cut off at week 1 — showing the complete plan free is deliberate, it's the "fork in the road" wow moment and gating it would undercut the demo) → one real recalibration at week 2. This is the hook: real data, real comparison, proof the model works, before any ask for payment.
- Paywall: sits immediately after the week-2 recalibration. Every recalibration after week 2 requires unlock. GET /api/recalibration?week=2 is always served regardless of unlock status; week=3 and beyond check the same unlock flag.
- Not real payment processing for the hackathon — `unlock()` in lib/storage.ts sets a plain, non-httpOnly `clx_unlocked=1; path=/` cookie and `isUnlocked()` reads it for immediate UI updates. The API reads the same cookie directly from the request to enforce week 3+ and chat. This is explicitly labelled as a demo boundary, not an entitlement system. Paywall copy frames it as a continuation of the story already shown ("Your first recalibration ✓ — your next one is ready to unlock. CreatorLENS Pro: weekly recalibration + cross-platform + deeper personalization, SGD 30/month") rather than a jarring generic upgrade interruption.
- Pricing: ~SGD 30/month target, explicitly flagged as needing validation with real creators — not confirmed, just the working assumption.

## 6. Shared API contract — the merge seam

Lives in lib/types.ts, imported by both tracks. Frontend builds entirely against this + a fixture; backend implements it exactly; when backend lands, only lib/api.ts changes.

```ts
// GET /api/diagnose — 401 JSON (not a redirect) when unauthenticated
type DiagnoseResponse = {
  channel: { title: string; subscriberCount: number; recentCadencePerWeek: number };
  diagnosis: { headline: string; explanation: string; evidence: string[] };
  channelInOneSentence: { then: string; now: string };
  contentDna: { topTopics: string[]; topFormats: string[]; topHookStyles: string[] };
  ideas: Array<{
    title: string;
    trendRelevance: "high" | "medium" | "low";
    audienceFit: "high" | "medium" | "low";
    hooks: Array<{ style: "bold" | "relatable" | "curiosity"; line: string }>;
  }>;
  paths: Array<{
    id: "A" | "B" | "C";
    name: string;                 // e.g. "Double Down" / "Balanced" / "Experiment"
    oneLiner: string;
    weekOnePlan: string[];
    projectedWeek12Subs: number;
    tradeOff: string;
  }>;
  backtest: { channelsTested: number; meanErrorPct: number } | null;  // null until real, never a placeholder 0
};

// GET /api/connect — backend-owned redirect calling signIn("google") server-side, so the
// frontend Connect button can be a plain <a>, no next-auth import. Verify first whether
// this route is even necessary: check if a bare GET /api/auth/signin/google redirects
// straight into Google's consent screen on the installed next-auth v5 version — if so,
// drop this route and point the anchor there directly.

// GET /api/plan?pathId=A — no unlock required, the full initial plan is free.
// /dashboard/plan also always renders; only week 3+ checkpoints lock inline.
type PlanResponse = {
  weeklyProjection: Array<{ week: number; subs: number }>;
  weeklyActions: Array<{ week: number; action: string }>;   // templated, not LLM-generated
  crossPlatform: { mocked: true; note: string; instagram: unknown; tiktok: unknown };
  kpiScorecard: Array<{ label: string; value: number; trend: "up" | "down" | "flat" }>;
  benchmark: Array<{ channelLabel: string; cadencePerWeek: number; formatMixPct: number; isMe: boolean }>;
  opportunityMatrix: Array<{
    pathId: "A" | "B" | "C";
    effort: "low" | "medium" | "high";
    projectedGrowth: number;
    risk: "low" | "medium" | "high";
  }>;
};

// GET /api/recalibration?week=N — week 2 always free; week 3+ checks clx_unlocked
// directly from the request cookie and returns 401 JSON when absent.
// Backed by the same recalibrateWeek() function used for the self-backtest.
type RecalibrationResponse = {
  week: number;
  predicted: number;
  actual: number;
  deltaPct: number;
  adjustedPlan: { note: string; changes: string[] };
  mocked: boolean;   // false for weeks that already really happened, true for scripted demo weeks
};

// POST /api/chat — checks the same clx_unlocked request cookie. First feature cut if time runs short.
// System prompt built server-side from the session's own stored diagnosis/paths/backtest —
// client sends only the conversation, never the analysis data itself.
type ChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;  // capped ~6 turns, not persisted
};
type ChatResponse = { reply: string };
```

Auth state the frontend needs: whether a session exists — inferred from /api/diagnose's 401, never a useSession()/next-auth import in frontend code.

Unlock mechanism: localStorage is browser-only, so it cannot enforce an API route. `lib/storage.ts` uses the `clx_unlocked` cookie for both `unlock()` and `isUnlocked()`; `/api/recalibration` for week 3+ and `/api/chat` read that cookie from the incoming request. `/dashboard/plan` never redirects based on unlock state because it contains the free plan and week-2 recalibration. Later weeks render locked placeholders inline until unlocked.

## 7. Backend track — complete, with reasoning for every item

- Owns: lib/auth.ts, lib/youtube.ts, lib/diagnosis.ts, lib/simulation.ts, lib/chat.ts, scripts/build-comparables.ts, app/api/auth/[...nextauth]/route.ts, app/api/diagnose/route.ts, app/api/plan/route.ts, app/api/recalibration/route.ts, app/api/chat/route.ts, app/api/connect/route.ts.
- New dependencies: next-auth (v5, App Router) for OAuth + refresh handling. simple-statistics for the regression — small, pure JS, no native deps, safe for serverless.
- New env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, YOUTUBE_API_KEY (server-side, public-data only). Keep existing OPENAI_API_KEY/OPENAI_MODEL.
- Auth (lib/auth.ts) — Google provider requesting openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly, access_type=offline&prompt=consent. JWT callback persists tokens and refreshes the access token when expired (check expires_at, call Google's token endpoint with the stored refresh_token — Auth.js v5 does not do this automatically). Without this, a session prepared ahead of the demo can silently die before judges see it.
- YouTube data (lib/youtube.ts) — getMyChannel (Data API v3 channels.list), getMyAnalyticsHistory (Analytics API v2 reports.query, dimensions=day, ~18 months — real history, own channel only), getMyRecentVideos (Data API v3 playlistItems.list + videos.list, classify Short vs. long-form by duration ≤60s, keep publishedAt + view/like counts — the only growth signal available for other channels).
- Comparables fixture (scripts/build-comparables.ts) — one-off script, YOUTUBE_API_KEY, pulls 5–8 public channels in one niche via Data API v3 only (channels.list + videos.list, no historical polling attempted since it's not possible), writes lib/data/comparables.json. Run once, well before the demo.
- Diagnosis (lib/diagnosis.ts) — one OpenAI call (store:false, same pattern as the old app/api/review/route.ts) returning { headline, explanation, evidence, contentDna, ideas, channelInOneSentence } in one structured response. Trend context: each comparable channel's recent top-performing video titles/topics folded into the prompt. contentDna is pure aggregation (no LLM) over getMyRecentVideos. ideas' trendRelevance/audienceFit must be emitted as "high"|"medium"|"low", never a numeric percentage.
- Time-permitting: per-format "best subscriber conversion"/"best retention" split via Analytics API dimensions=video + metrics=subscribersGained,averageViewDuration — real and buildable, but sequence behind KPI scorecard/benchmark.
- Simulation + recalibration (lib/simulation.ts) — fitGrowthModel(ownAnalyticsHistory) (regression via simple-statistics on real cadence/format-mix vs. real growth), recalibrateWeek(predicted, actual) (the core reusable function — delta + adjusted-plan note; used retrospectively for the backtest and on-demand for scripted demo weeks), backtest(model, ownAnalyticsHistory) (walks recalibrateWeek across every past week, returns { channelsTested: 1, meanErrorPct } — one channel walked forward, say so plainly, not "20 channels"), simulatePaths(myChannel, model, comparables) (3 named strategies 12 weeks out; comparables inform trade-off text only, never a subscriber-count input).
- Routes — /api/diagnose and /api/plan implement the contract exactly. /api/diagnose returns 401 JSON (never a redirect) when unauthenticated. backtest stays null until real — never channelsTested: 0 as a placeholder. /api/plan needs no unlock (free tier), and also computes kpiScorecard/benchmark/opportunityMatrix from data already fetched.
- GET /api/recalibration?week=N — week 2 always served; week 3+ reads `clx_unlocked` directly from the request cookie and returns 401 JSON if absent. Past weeks use real data (mocked:false); future weeks use scripted fixture data (mocked:true) — one code path for both. `/api/chat` enforces the same cookie.
- GET /api/connect — redirect route calling signIn("google", { redirectTo: "/dashboard" }) server-side. Confirm first whether it's actually needed (see contract note above) before building it.
- weeklyActions — templated, not LLM-generated, specifically to avoid 3 OpenAI round-trips when the frontend fetches all 3 paths in parallel. Memoize the fitted regression model at module scope (fit once per process, not per request) regardless.
- Chat (lib/chat.ts + route) — system prompt built server-side from that session's already-computed diagnosis/paths/backtest (looked up server-side, never trusted from client input), told to say "I don't know" rather than invent anything, history bounded to a handful of turns. First thing cut if time is short.
- Backend verification: npm run typecheck && npm run build; sign in with the test-user account, confirm /api/diagnose returns a headline citing real numbers and a 401 body when signed out; run backtest() standalone against a real trailing slice of history and print the mean error before the demo; leave a session idle past token expiry once and confirm the refresh logic keeps /api/diagnose working; clear `clx_unlocked` and confirm `/api/recalibration?week=3` returns 401 JSON while week 2 still succeeds.

## 8. Frontend track — complete, with reasoning for every item

- Owns: app/page.tsx, app/dashboard/page.tsx, app/dashboard/plan/page.tsx, app/layout.tsx, app/globals.css (full rewrite — existing file styles a UI being deleted, wrong theme entirely), lib/storage.ts (repurposed: cookie-backed isUnlocked()/unlock(), localStorage-backed getChosenPath()/setChosenPath()), lib/types.ts (repurposed to hold the contract types), lib/data/fixture.ts (a full fake DiagnoseResponse/PlanResponse pair), lib/api.ts (the only file that calls fetch — fixture until routes exist, error/401 fallback after), README.md.
- Delete (this branch only, not the teammate's separate video-analysis-pipeline branch): app/api/review/route.ts, app/history/page.tsx, app/personalise/page.tsx, app/trends/page.tsx, lib/media.ts.
- No next-auth import anywhere in the frontend. Session state inferred purely from /api/diagnose's 401 status — one source of truth, no drift between a session hook and the data.

### Design system — dark navy/beige, "Bloomberg Terminal × strategy consultancy"

- Tokens: --navy-900 (page background) → --navy-800 (cards) → --navy-700 (raised/hover) → --navy-600 (borders, inactive) → --beige (scarce — primary CTA/headline only) → --text-muted/--text-dim (body/labels) → three distinguishable series colors for the fork chart (solid/dashed/dotted, never color alone).
- Elevation via lightness, not shadow (shadows read as smudges on navy). Lighter display font weights (light-on-dark blooms optically). Real :focus-visible rings (default outline is nearly invisible on navy). prefers-reduced-motion disables chart draw-on animation. Minimal animation overall — the product should read as "we analyze your business," not "we are a fun AI toy."

### Page structure and flow

- app/page.tsx (landing, server component, client JS only for the path switcher) — hero ("See why your channel stalled," Connect YouTube + a "preview a demo channel" secondary CTA), an interactive fork/chart section, the problem framing (plateaued creator vs. creator-with-a-team, why each competitor category misses), a real diagnosis example, the backtest/proof panel (suppressed until real), the economics comparison (SGD 800–2,500 vs. SGD 30), the augmentation-not-replacement framing, honest scope disclosure, FAQ addressing "NEXORA already does this."
- app/dashboard/page.tsx (free tier) — on load, fetch("/api/diagnose") with staged progress copy, not a bare spinner ("Reading 18 months of analytics" → "214 videos analyzed" → "Clustering your audiences" — advances on its own timer, independent of the fetch, over skeleton cards in the final layout shape so nothing reflows on arrival). On 401: a connect state with a "preview with a demo channel" escape hatch. On error: render the fixture behind a visible "Demo channel" badge — never a blank screen or raw error on stage. When loaded: channel strip → ChannelInOneSentence (build early) → executive-summary-framed diagnosis card → ContentDnaBadges → 3-path fork with OpportunityMatrix (full 12-week plan already visible, no cliffhanger cutoff) → IdeaCards framed as "this week's content" for the selected path, each expandable to show hook variants.
- app/dashboard/plan/page.tsx (free plan plus gated later checkpoints) — always renders, with no page-level redirect. WeekTimeline steps through recalibration checkpoints (week 2 always free and real; week 3+ locked inline with a same-height placeholder and unlock CTA, not collapsed); KpiScorecard and BenchmarkTable; chat panel here if it shipped.
- Sidebar nav: Overview/Diagnosis/Content DNA/Strategy/Simulator/Ideas as anchor links with scroll-spy active-state highlighting over sections already on these two pages — not separate routes.
- Components to build: PathChart (inline SVG, 3 series, dash pattern + end labels, no chart library dependency), DiagnosisCard (executive-summary framed), ChannelInOneSentence, ContentDnaBadges, IdeaCard (expandable, hook-style variants, qualitative fit pills — never percentage bars), KpiScorecard, BenchmarkTable (range framing, not percentile), OpportunityMatrix, WeekTimeline, Paywall (framed as continuing the story, not a generic upgrade modal), MockLabel (shared, driven off every mocked:true field so labelling is structural, not remembered per-component), ChatPanel (if shipped — suggested starter questions, not a blank input, no streaming, capped/non-persisted history).
- Frontend verification: typecheck/lint/build clean; full click-through against the fixture with backend absent, then again against live routes with zero page-component changes beyond lib/api.ts; backtest:null → no accuracy claim anywhere; forced 500 on /api/diagnose → fixture renders with the demo badge; direct visit to /dashboard/plan with no unlock cookie renders the full free plan and week 2, with week 3+ locked inline; direct `/api/recalibration?week=3` without the cookie returns 401; keyboard-only pass on path tabs with a visible focus ring; 375px width has no horizontal scroll.

## 9. Cut order if time runs short — decide now, not mid-build

### Most disposable first

1. Chat — drop first. Content DNA + Ideas ship instead, not in addition.
2. Benchmark table and opportunity matrix — need new data-shaping, not just restyling.
3. Extra recalibration checkpoints beyond week 2 — fall back to the single free hook screen.
4. Simplify the simulation model further.

Never cut: OAuth connect, the real own-channel diagnosis, the full initial 12-week plan, one real accuracy number from the backtest. KPI scorecard, executive-summary framing, Content DNA, Ideas+Hooks, and ChannelInOneSentence are all cheap relative to their demo impact — keep them even under pressure.

## 10. Demo runbook (~3 minutes)

Before judges see it: sign in once with the demo test-user account ahead of time (don't do first-time OAuth consent live); pre-run backtest() so the accuracy number is known and speakable with the small-sample caveat already worked into the sentence; have the browser already on /dashboard, signed in, one click from a clean re-run, and double-check the session hasn't hit token expiry right before going on; have a recorded fallback (video/screenshots of the full happy path) in case live YouTube API calls fail or rate-limit during the actual demo.

### The script

1. Open already at the dashboard with the real creator channel loaded — mention OAuth exists, don't click through it live.
2. Diagnosis in executive-summary framing — read the headline aloud, point at the specific numbers, glance at the KPI scorecard and benchmark table.
3. Scroll to Content DNA and Ideas — open one idea, show its 3 hook-style variants. This is the "it knows my channel" beat.
4. Show the fork: 3 paths in the opportunity matrix, one-line trade-offs, the full 12-week plan already visible — no unlock needed yet.
5. Step the WeekTimeline to week 2: a real recalibration — say explicitly this one is real. Step further: locked, paywall appears. Unlock.
6. Step to the unlocked later week: another recalibration, say explicitly this one is scripted for the demo, then close with the real backtest number, phrased as directional ("walk-forward tested against this channel's own past weeks"), not a precise guarantee.
7. (if chat shipped) ask it a grounded follow-up question live — a strong closer, but only if it made the cut.
8. Say out loud, don't let a judge discover it: which parts are live (OAuth, own-channel diagnosis, week-2 recalibration, the backtest number, chat if shipped) vs. mocked (cross-platform card, the later scripted recalibration week).

## 11. Setup prerequisites (do before either track can run end-to-end)

Create a Google Cloud OAuth client (redirect http://localhost:3000/api/auth/callback/google), enable YouTube Data API v3 + YouTube Analytics API, set the OAuth consent screen to Testing status, and add the demo YouTube account as a test user — both youtube.readonly and yt-analytics.readonly are restricted scopes that won't authorize for anyone else until this is done.

## 12. Vision / roadmap — pitch material only, explicitly not build scope

The long-term version of this product: a full AI content-strategist pipeline — dedicated per-video content analysis, a trend-ingestion engine across platforms, an LLM router tiered by task complexity (cheap/fast model for simple tasks, a stronger model for deep strategy work), a RAG layer over the creator's own history and niche trend data, and eventually one piece of content repurposed into multiple audience-targeted versions. None of this is buildable in the hackathon window — the only piece that ships live is the lightweight trend-context folded into the diagnosis prompt (§7.4). Keep this section visibly separate from the build plan so nobody mistakes the roadmap for a commitment.

# CreatorLENS

A frontend for a YouTube growth-strategy workspace: diagnosis, Content DNA, three complete 12-week scenarios, ideas and hooks, and checkpoint recalibration. Built with Next.js App Router, TypeScript, and inline SVG charts.

## Run the frontend

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. No API keys or backend are needed for the demo.

- `/` — landing page with an illustrative strategy chart.
- `/dashboard?demo=1` — complete demo channel report.
- `/dashboard/plan?demo=1` — all 12 weeks and the recalibration flow.
- `/dashboard?connect=1` — connection entry screen while OAuth is being integrated.

The demo uses an invented channel, **The Everyday Table**. Its metrics, projections, and checkpoint results are illustrative. A persistent “Demo channel” notice identifies the report. Checkpoints say “Scripted demo,” cross-platform cards say “Mocked preview,” and `backtest` is `null`, so no measured accuracy is claimed.

The current build does not implement OAuth, YouTube/OpenAI calls, the growth model, or API entitlement checks. Those belong to the backend track. Chat is deferred until its route exists.

## Frontend behavior

The full initial plan is always free. A direct visit to `/dashboard/plan` renders normally without unlock. Week 2 is available; week 3 and later show an inline lock. **Unlock demo** sets the non-httpOnly session cookie `clx_unlocked=1; Path=/; SameSite=Lax`. No payment or subscription is created. Removing that cookie restores the locks on reload.

Only the selected path is saved to localStorage (`creatorlens.chosen-path.v1`). The report stays in memory while navigating between dashboard pages. Preview mode is explicit in the `demo=1` query string.

All frontend fetches live in `lib/api.ts`. Without `demo=1`, it requests the real routes. A diagnosis/session 401 shows the connection screen. A missing, failed, or invalid report returns the complete demo dataset with an explanatory notice; it never mixes a live channel with fixture projections. Live recalibration errors remain errors and never silently become scripted results.

The chart shows point scenarios and explains increasing uncertainty. It does not fabricate a numeric confidence band. Model-derived lower/upper bounds still need an agreed contract before a quantitative band can be displayed.

## Backend integration

Both tracks import the shared response types from `lib/types.ts`. The frontend consumes:

| Endpoint | Expected behavior |
| --- | --- |
| `GET /api/diagnose` | `DiagnoseResponse`, or JSON 401 when signed out. `backtest` stays `null` until measured. |
| `GET /api/plan?pathId=A`, `B`, `C` | Three parallel requests, each returning a complete `PlanResponse` with 12 projection points and 12 templated actions. No unlock required. |
| `GET /api/recalibration?week=N` | `RecalibrationResponse`. Week 2 is free. Week 3+ reads the `clx_unlocked` request cookie and returns JSON 401 when absent. |
| OAuth entry | Confirm the installed Auth.js behavior; use backend-owned `/api/connect` if a direct Auth.js GET does not start consent. |

When the OAuth entry is ready, add this to `.env.local` and restart the frontend:

```sh
NEXT_PUBLIC_CONNECT_PATH=/api/connect
```

The Connect YouTube links will then use that route. The frontend imports no auth library and does not handle Google tokens or secrets. The teammate owns OAuth setup, refresh handling, data fetching, the model, and enforcement of the demo cookie.

The UI labels KPI values with the API-provided labels. Include the metric period and unit there.

CreatorLENS focuses on YouTube Shorts. The whole channel is analysed (subscriber growth is channel-wide), but every path, idea and recommendation is about Shorts. Shorts are videos up to 180 seconds (`SHORTS_MAX_SECONDS` in `lib/youtube.ts`). The growth model fits weekly net subscribers against Shorts per week, with long-form per week as a control. Each path is a Shorts cadence plus how many Shorts test a new topic or hook versus staying on "proven topics": title keywords whose Shorts beat the channel's average Short on subscribers per 1k views (from the Analytics per-video report, falling back to average views). Channels with fewer than `MIN_SHORTS` Shorts get a notice on the dashboard. There is no comparison against other channels — the YouTube Analytics API only returns data for channels the signed-in user owns.

### Analysis and "did it work?"

All numbers come from deterministic code in `lib/analysis/` — the diagnosis LLM only narrates them (any number in its text that wasn't in its input is rejected and replaced with deterministic wording).

- **Data** (`weeks.ts`): complete Monday–Sunday UTC weeks only (the partial current week is dropped), shared boundaries across reports. Shorts vs long-form views and subscribers come from YouTube's own `creatorContentType` split (`day,creatorContentType` report); per-video type from the top-videos report. Missing metrics stay `null`, never 0.
- **Drivers** (`drivers.ts`): last 8 vs previous 8 complete weeks; sums before ratios; symmetric reach-vs-conversion split of the change in weekly net subscribers (arithmetic, not cause). Needs 16 complete weeks, otherwise a limited-history report.
- **Change detection, formats, outliers, hypotheses**: fixed rules with counter-checks; each hypothesis is `supported` / `mixed` / `not_supported` / `insufficient_data` with an evidence strength (not a probability).
- **Strategies** (`strategies.ts`, `experiments.ts`): Double Down / Balanced / Experiment, all Shorts-only (cadence, topics, hooks). Each card cites the hypotheses behind it (or is labelled exploratory) and carries a two-week test with a decision rule from the creator's own weekly variation (median ± MAD).
- **Projections** (`simulation.ts`): recent median weekly net subs + a conservative per-Short delta (half of the median attributed subs per Short), clamped to the channel's observed range, with a band that widens with √weeks. The regression is kept only as a walk-forward backtest, reported as mean absolute error in subscribers/week next to a trailing four-week-median baseline.
- **Closing the loop** (`evaluation.ts`, `/api/plan-start`, `/api/recalibration`): "Start this plan" freezes an 8-week baseline in a signed, httpOnly cookie (`clx_plan`, this browser only). Checkpoints at weeks 2, 4, 8 and 12 show adherence, before/after evidence, the reach/conversion split, a "carry on as before" range, and the two-week test. Verdicts: "Too early" before week 4; "Working" / "Not working" only outside the baseline's normal weekly swing; otherwise "Mixed / no clear change". **Look-back mode** treats the plan as started 4, 8 or 12 weeks ago so every number is real history.

Checkpoint requests do not include a selected path in the current contract. They compare the server's saved baseline. Exploring another path only changes the frontend scenario and weekly actions; it does not silently change the checkpoint baseline.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
```

Development uses `.next-dev`; production builds use `.next`. After removing routes, stale generated route types can be removed from those directories before rerunning checks.

The implementation and verification record is in [the frontend build plan](temp/frontend_build_plan.md). Live OAuth, actual channel data, token refresh, real backtest results, and server-side cookie enforcement require the teammate's backend and remain integration checks.

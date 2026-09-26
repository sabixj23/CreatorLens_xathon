# CreatorLENS — phased frontend build plan

Status: frontend implementation complete (26 September 2026). Live backend integration is pending the teammate’s routes.

## Progress tracker

| Phase | Status | Evidence / remaining work |
| --- | --- | --- |
| 0 — Contract and fixture | Complete | Exact shared types, validated API adapter, coherent demo responses, cookie unlock, chosen-path storage. |
| 1 — Visual system and landing | Complete | Navy/beige shell, labelled SVG scenarios, landing content and FAQ; desktop and mobile visuals inspected. |
| 2 — Dashboard | Complete | Diagnosis, Content DNA, full strategy fork, hooks, scroll-spy sidebar, shared report provider; selection and expansion verified. |
| 3 — Plan and recalibration | Complete | Twelve actions, full projections, free week 2, equal-height later locks, cookie unlock, scorecard and benchmark; reload persistence verified. |
| 4 — Frontend verification | Complete | Typecheck, lint, production build, browser walkthrough, 375px layout, keyboard interaction, error states and contrast checked; README updated. |
| Later — Live integration | Waiting for teammate | OAuth and real API routes, cookie enforcement, model-derived uncertainty bounds. |

Chat is deferred until its backend route exists, as specified in Phase 3.

Source of truth: `project_spec.md`, especially §§2, 5, 6, and 8. This plan covers the frontend track only. The teammate owns authentication, YouTube and OpenAI integration, simulation, and the API routes. We build against the shared contract and an explicitly labelled fixture, then connect the routes later.

## Scope and ownership

Frontend owns `app/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/plan/page.tsx`, `app/layout.tsx`, `app/globals.css`, `lib/storage.ts`, `lib/types.ts`, `lib/data/fixture.ts`, `lib/api.ts`, and `README.md`. Frontend components can live under `components/` or a dashboard component directory. `lib/api.ts` is the sole frontend fetch boundary; page components consume typed results and need no `next-auth` import.

The old video review UI leaves this branch during implementation: `app/api/review/route.ts`, `app/history/page.tsx`, `app/personalise/page.tsx`, `app/trends/page.tsx`, and `lib/media.ts`. Check imports before deletion. Do not edit the teammate's backend files or implement their API routes.

The first reviewable delivery is a complete fixture driven frontend: landing page, dashboard, full free plan, week-2 checkpoint, inline week-3 lock, demo unlock, and visible labels for mocked content. Live API integration is a separate final phase after the teammate's routes land.

## Product rules carried through every phase

- Render claim → evidence → recommendation. Diagnosis evidence and strategy trade-offs remain visible beside the claim.
- Label 12-week projections as scenarios based on historical cadence, format mix, and growth. Explain that uncertainty grows with the horizon; never present week-12 subscribers as a promise. The backtested claim applies only to the short range.
- `backtest: null` means no accuracy statement anywhere. When present, describe it as a walk-forward test on one creator's own history, using the returned value only. Never invent a percentage or use `channelsTested: 0` as a placeholder.
- Every fixture value and illustrative diagnosis is visibly marked “Demo channel” or “Illustrative example.” A backend error may switch to the fixture; a 401 instead shows a connect state with an explicit demo-preview action.
- The initial three-path 12-week plan and week-2 recalibration are free. `/dashboard/plan` always renders. Week 3+ lock inline until the demo cookie is set; no page redirect or week-1 teaser cutoff.
- `clx_unlocked=1; path=/` is a plain demo cookie. `unlock()` writes it, `isUnlocked()` reads it for immediate UI state. Only the chosen path uses localStorage. The teammate's API must read the same cookie to enforce week 3+ and chat.
- `mocked: true` content gets the shared `MockLabel`. The fixture's week 2 is also labelled demo; only a live, completed week with `mocked: false` may be called real.
- Ideas use qualitative high/medium/low relevance and fit, with bold/relatable/curiosity hooks. No fabricated scores, percentile, conversion number, or live cross-platform claim.

## Phase 0 — contract and fixture foundation

1. Replace the old review types in `lib/types.ts` with the exact `DiagnoseResponse`, `PlanResponse`, `RecalibrationResponse`, and optional chat types from spec §6. Preserve field names and nullability. Export `PathId` only as a convenience alias if useful.
2. Add `lib/data/fixture.ts` with coherent demo responses for all three paths, the three path projections and actions, KPI scorecard, benchmark, opportunity matrix, week 2, and a later scripted checkpoint. Keep `backtest: null` unless a real measured result is supplied. Mark the fixture at the presentation boundary with “Demo channel”; do not present fixture figures as measured outcomes.
3. Add `lib/api.ts` as the only frontend fetch wrapper for diagnosis, plans, and recalibration. Distinguish unauthenticated 401 from network/5xx failures. 401 yields a connect state; network/5xx may use the labelled fixture. During standalone frontend work, expose an explicit demo-preview mode that reads the fixture without depending on absent routes. Do not silently treat every missing route as live data.
4. Repurpose `lib/storage.ts` for the cookie-backed unlock and localStorage-backed chosen path. Make browser-only reads safe during server rendering.
5. Keep the connect destination in one frontend constant or helper. Use `/api/connect` once the teammate confirms it is needed; if the installed Auth.js route goes straight to Google on a GET, point the anchor there instead. No frontend auth package.

**Review point:** Types match spec §6; fixture is internally consistent and visibly demo; `backtest: null` is handled; the cookie name and 401 behavior are documented for the teammate.

## Phase 1 — visual system and landing page

1. Rewrite `app/globals.css` and `app/layout.tsx` for the dark navy/beige strategy-report look: `--navy-900` page, `--navy-800` surfaces, `--navy-700` raised rows, `--navy-600` borders, beige used sparingly for headings and primary actions. Use lightness rather than shadows, editorial type, subtle borders, and little animation.
2. Set chart series apart by both color and stroke pattern, with labels at the ends. Add visible `:focus-visible` rings and respect `prefers-reduced-motion`.
3. Build `app/page.tsx`: hero with Connect YouTube and Preview demo channel; interactive three-path fork; plateau/problem framing; clearly illustrative diagnosis example; proof panel suppressed while `backtest` is null; economics and augmentation framing; honest YouTube versus cross-platform scope; FAQ and closing CTA.
4. Make the landing fork explicitly illustrative because it uses fixture data. Show each path's trade-off and the scenario assumption. A marketing chart must not imply a measured 12-week forecast.

**Review point:** Landing page works without a backend, has no unsupported accuracy claim, and keeps keyboard access and 375px layout intact.

## Phase 2 — free dashboard and strategy fork

1. Build `app/dashboard/page.tsx` with staged, non-numeric loading copy and skeletons. Do not say “214 videos analyzed” before the API supplies that count. On 401 show Connect and Preview demo channel. On 5xx/network error show the fixture with a persistent Demo channel badge.
2. In loaded order render: channel strip; `ChannelInOneSentence` (“then”/“now”); executive-summary `DiagnosisCard` with explanation and evidence; `ContentDnaBadges`; three named strategy paths and `OpportunityMatrix`; then expandable `IdeaCard`s as “this week's content” for the chosen path.
3. Expose the complete initial plan for all three paths. Use `PathChart` for the 12-week scenarios, `weekOnePlan`, and trade-offs. Fetch `/api/plan?pathId=A|B|C` in parallel through `lib/api.ts` where detailed projections are needed. Selecting a path persists its ID in localStorage, but selection is not an unlock.
4. Add sidebar anchors for Overview, Diagnosis, Content DNA, Strategy, Simulator, and Ideas over the two pages, with scroll-spy highlighting. Use links between the dashboard and plan where a target section is on the other page; do not create six routes.

**Review point:** Fixture walkthrough reaches a full free strategy fork and ideas with all three hook styles. A signed-out 401 never masquerades as a live diagnosis.

## Phase 3 — free plan, recalibration, and demo unlock

1. Build `app/dashboard/plan/page.tsx` so a direct visit works with no unlock cookie. Show all three 12-week paths, the chosen path's templated weekly actions, KPI scorecard, benchmark range, and opportunity matrix.
2. Implement `WeekTimeline`: request and show week 2 without unlock; show week 3+ as same-height locked placeholders with a contextual CreatorLENS Pro SGD 30/month demo-unlock CTA. After `unlock()` sets the cookie, update UI immediately and request the later checkpoint. Label every `mocked: true` response “Scripted demo.”
3. Render cross-platform content only through `MockLabel`, with its `note` from `PlanResponse`. Keep it visibly mocked. Chat is the first feature cut; add `ChatPanel` only after the core flow works and the teammate's route exists. If added, use starter questions and bounded non-persisted history.
4. Clarify uncertainty on the 12-week visual. The present `PlanResponse.weeklyProjection` has point estimates only and no lower/upper bounds. Do not synthesize numeric confidence intervals in the frontend. Ask the teammate for model-derived bounds before drawing a quantitative widening band; until then, use clearly directional long-horizon styling and explanatory text. This is the one contract gap to settle during integration.

**Review point:** Without the cookie, `/dashboard/plan` still shows the full plan and week 2 while later weeks lock inline. Unlock changes only later checkpoints. The UI's lock is backed by an API check once routes are integrated.

## Phase 4 — verification and teammate integration

1. Verify the fixture flow first: landing → demo dashboard → Content DNA and hooks → three-path plan → free week 2 → locked week 3 → demo unlock → scripted later week.
2. Run `npm run typecheck`, `npm run lint`, and `npm run build`; fix issues in frontend-owned files. Check keyboard-only navigation, visible focus, reduced-motion behavior, 375px width with no horizontal page scroll, and readable chart/table labels.
3. Once backend routes arrive, connect through `lib/api.ts` and the single connect-link helper. Confirm live `/api/diagnose` renders real data, 401 shows connect, and a forced 5xx shows the labelled demo fixture. Confirm `backtest: null` hides accuracy language.
4. With backend available, verify direct `/dashboard/plan` without `clx_unlocked` shows free content; `/api/recalibration?week=2` succeeds; `/api/recalibration?week=3` without the cookie returns 401 JSON and succeeds after unlock. This API enforcement is the teammate's implementation, verified end to end here.
5. Update `README.md` for frontend demo mode, visual mock labels, the cookie boundary, route integration, and honest live-versus-scripted demo language. The teammate can add OAuth and API setup details when those exist.

**Review point:** Same page components serve fixture and live responses. All numerical claims on live screens come from actual API data; mocked sections remain labelled.

## Merge seam to confirm with the backend teammate

- `lib/types.ts` follows spec §6 exactly; `backtest` is `null` until measured, and `weeklyActions` are templated.
- `/api/diagnose` returns JSON 401 when signed out. The connect anchor targets either the verified Auth.js GET route or backend-owned `/api/connect`.
- Three `/api/plan` requests can run in parallel, one for each path; initial plan has no unlock requirement.
- The backend reads `clx_unlocked` from the request cookie for week 3+ and `/api/chat`, returning JSON 401 when absent. Week 2 remains free.
- The projection contract currently lacks model-derived uncertainty bounds despite the spec's widening-band requirement. Agree on a bounded response shape before showing a numeric band.

## Cut order if time is short

Cut chat first, then benchmark and opportunity matrix, then extra checkpoints beyond week 2. Keep OAuth connect UI, real diagnosis integration, channel-in-one-sentence, Content DNA, ideas and hooks, the full initial plan, KPI scorecard, executive-summary presentation, and a real backtest number when one has actually been measured.

Implementation was authorized by the user. Completion and verification evidence are recorded in the progress tracker above.

## Verification record — 26 September 2026

- TypeScript, ESLint, and production build pass. Routes generated: `/`, `/dashboard`, `/dashboard/plan`.
- Isolated Chromium walkthrough passed: demo entry, diagnosis, Content DNA, three hook variants, strategy selection, all 12 weekly actions, free week 2, locked week 3, demo unlock, and reload persistence.
- The chosen strategy persists in localStorage. The unlock uses a non-httpOnly `clx_unlocked` cookie at `/`; a simulated live request receives it through the browser’s cookie header.
- Direct plan visits without a cookie keep all free content visible. Locked checkpoint height matches the completed card at desktop and 375px widths. The mobile lock preserves the measured card height rather than collapsing.
- All three pages fit 375px with no horizontal page overflow. Charts, the comparison table, and mobile navigation scroll inside their own containers. A sidebar width issue found during verification was fixed.
- Intercepted API responses verified the UI: 401 shows the connection screen; 500 shows a whole demo report with its badge; valid contract responses work without page changes. Missing backend routes also produce the labelled fallback. These checks do not prove actual backend enforcement.
- Keyboard navigation reaches and selects strategy buttons; visible focus rings and reduced-motion styles work. Text color contrast against the three navy surfaces is at least 4.71:1. No browser runtime errors were observed in the walkthrough.
- Desktop landing/dashboard screenshots and mobile dashboard/checkpoint screenshots were visually inspected.
- A later preview check found stale generated development assets: the page HTML returned 200 while its stylesheet returned 404, producing an unstyled text view. After clearing `.next-dev` and restarting, the stylesheet returned 200 and a fresh browser verified the navy layout. `npm run dev` now clears that cache on startup.

## Integration handoff

- Set `NEXT_PUBLIC_CONNECT_PATH=/api/connect` (or the verified Auth.js entry) when OAuth is available. Until then, Connect opens a useful connection entry screen with a demo escape hatch.
- Keep `lib/api.ts` as the fetch boundary. The shared provider keeps one report in memory across dashboard pages; fixture and live values are never combined into one report.
- Backend work still required: actual OAuth, channel data, backtest, real week-2 results, token refresh, and request-cookie enforcement for week 3+ and chat. Numeric confidence bounds remain an agreed integration dependency.
- Chat remains intentionally deferred. No new application dependencies were added. Browser test tooling was installed only in a temporary folder.
- The checkpoint contract has no selected-path parameter, so the UI explicitly compares the saved baseline; browsing another scenario does not silently change it. The current benchmark labels `formatMixPct` as “Format mix” until the backend supplies an agreed metric definition.

import { addWeeks, weekEnd } from "../analysis/weeks";
import type { ChannelAnalysis, CheckpointResponse, DiagnoseResponse, Evidence, Experiment, PathId, PlanRecord, PlanResponse, PlanStartRequest } from "../types";

// Illustrative data only. Never merge these values into a live channel report.

const DEMO_LAST_WEEK = "2026-09-14"; // Monday of the demo channel's latest complete week
const W = (before: string, after: string) => ({ before, after });

function demoExperiment(id: PathId): Experiment {
  const copy: Record<PathId, { assumption: string; schedule: string[] }> = {
    A: { assumption: "More Shorts on your proven topics keep converting at your usual rate (no audience fatigue).", schedule: ["Weeks 1–2: 4 Shorts a week on proven topics (weeknight, dinner)"] },
    B: { assumption: "Moving one or two Shorts a week to a new topic or hook doesn't lower conversion.", schedule: ["Weeks 1–2: 3 Shorts a week on proven topics (weeknight, dinner)", "1 a week testing one new topic or hook — the same test both weeks"] },
    C: { assumption: "New topics or hooks can match your proven Shorts' conversion.", schedule: ["Weeks 1–2: 3 Shorts a week testing new topics or hooks"] },
  };
  return {
    ...copy[id],
    primaryMetric: { id: "shorts_net_subs_per_1k", label: "Shorts-attributed net subscribers per 1,000 Shorts views", scope: "Video-attributed activity on Shorts (creatorContentType = SHORTS)" },
    supportingMetrics: ["Views per week", "Watch minutes per view", "Net subscribers per week"],
    holdConstant: ["Posting days and times", "Shorts length and style", "Long-form output at its current level"],
    minimumData: "2 complete weeks and at least 1,000 Shorts views.",
    decisionRule: { metricId: "shorts_net_subs_per_1k", keepAbove: 2.6, dropBelow: 1.8, text: "Keep the path if the two-week figure is above 2.6; reconsider below 1.8; anything between is inconclusive — your normal weekly swing. This is an observational content test, not a randomised experiment — topic, timing and format can move together." },
  };
}

function ev(id: string, metric: string, before: number | null, after: number | null, unit: string, window: { before: string; after: string }, sampleSize = 8, source = "Analytics · day report", caveat?: string): Evidence {
  return { id, metric, before, after, unit, window, sampleSize, source, caveat };
}

function demoAnalysis(): ChannelAnalysis {
  const win = W("2026-05-25 to 2026-07-19", "2026-07-20 to 2026-09-13");
  const topicShare = ev("proven_topic_share", "Shorts on proven topics (weeknight, dinner)", 75, 30, "% of Shorts", win, 24, "Data API titles", "Topics are auto-detected title keywords.");
  const gap = ev("proven_vs_other", "Subscribers per 1k views: proven-topic vs other Shorts", 2.3, 5.2, "per 1k views (other → proven)", W("other Shorts", "proven-topic Shorts"), 142, "Analytics · top videos report");
  const views = ev("views_per_week", "Views per week", 212000, 205000, "views/week", win);
  const rate = ev("net_subs_per_1k_views", "Net subscribers per 1,000 views", 1.86, 1.12, "per 1k views", win);
  const shorts = ev("shorts_per_week", "Shorts posted per week", 4, 3, "Shorts/week", win, 8, "Data API uploads");
  return {
    dataThrough: weekEnd(DEMO_LAST_WEEK), completeWeeks: 72, limitedHistory: false, contentTypeAvailable: true,
    drivers: {
      windows: { before: win.before, after: win.after, weeksEach: 8 },
      statement: "Subscriber gains fell while views stayed similar; net subscribers per 1,000 views declined.",
      changes: [
        { id: "net_subs_per_week", label: "Net subscribers per week", before: 395, after: 230, unit: "subs/week", changePct: -42, absoluteChange: -165 },
        { id: "net_subs_per_1k_views", label: "Net subscribers per 1,000 views", before: 1.86, after: 1.12, unit: "per 1k views", changePct: -40, absoluteChange: -0.74 },
        { id: "shorts_per_week", label: "Shorts posted per week", before: 4, after: 3, unit: "Shorts/week", changePct: -25, absoluteChange: -1 },
        { id: "views_per_week", label: "Views per week", before: 212000, after: 205000, unit: "views/week", changePct: -3, absoluteChange: -7000 },
      ],
      decomposition: { reachEffect: -10, rateEffect: -155, totalChange: -165 },
      decompositionNote: null,
    },
    changePoints: [{ metric: "netSubs", weekStart: "2026-07-13", beforeMedian: 402, afterMedian: 236 }],
    formats: {
      available: true,
      shorts: { before: { views: 1380000, netSubs: 2390, netSubsPer1kViews: 1.73, uploads: 32 }, after: { views: 1350000, netSubs: 1270, netSubsPer1kViews: 0.94, uploads: 24 } },
      longForm: { before: { views: 316000, netSubs: 610, netSubsPer1kViews: 1.93, uploads: 3 }, after: { views: 290000, netSubs: 520, netSubsPer1kViews: 1.79, uploads: 3 } },
      reconciliationPct: 87,
      note: "Attributed activity by content type — accounts for 87% of channel net subscribers in these weeks. Subscriptions made away from a video page aren't attributed to a format.",
    },
    outliers: { cohort: "Shorts published 26–8 weeks before the latest complete week", n: 64, topCount: 7, subsShareOfTop: 28, viewsShareOfTop: 31, suppressed: false },
    hypotheses: [
      { id: "topic_shift", claim: "Recent Shorts moved away from the topics that convert best for this channel.", status: "supported", strength: "high", evidenceFor: [topicShare, gap], evidenceAgainst: [] },
      { id: "conversion", claim: "Views held up, but fewer viewers became (and stayed) subscribers.", status: "supported", strength: "high", evidenceFor: [views, rate], evidenceAgainst: [], note: "Of the change in weekly net subscribers, about -10 is from views (reach) and -155 from subscribers per view (conversion) — arithmetic, not proof of cause." },
      { id: "cadence", claim: "Posting fewer Shorts coincided with the slowdown.", status: "mixed", strength: "medium", evidenceFor: [shorts], evidenceAgainst: [shorts], note: "Shorts cadence fell, but each Short earned more views — cadence alone doesn't explain it." },
      { id: "format_mix", claim: "Views shifted toward Shorts, which convert fewer net subscribers per 1,000 views than long-form.", status: "not_supported", strength: "medium", evidenceFor: [], evidenceAgainst: [ev("shorts_view_share", "Shorts share of views", 81, 82, "%", win, 8, "Analytics · day × creatorContentType")] },
      { id: "outlier_dependence", claim: "Past growth leaned on a few hit Shorts rather than steady performance.", status: "not_supported", strength: "medium", evidenceFor: [], evidenceAgainst: [ev("top_decile_subs_share", "Share of video-attributed subscriber gains from the top 7 of 64 Shorts", null, 28, "%", W("—", "Shorts published 26–8 weeks before the latest complete week"), 64, "Analytics · top videos report")] },
    ],
    provenTopics: ["weeknight", "dinner", "one-pan"],
  };
}

export const demoDiagnosis: DiagnoseResponse = {
  channel: { title: "The Everyday Table", subscriberCount: 128400, recentShortsPerWeek: 3, shortsAnalysed: 142, enoughShorts: true },
  diagnosis: {
    headline: "Your Shorts drifted away from the dinners that built your audience.",
    explanation: "Weeknight-dinner Shorts are why viewers subscribe. Your recent Shorts chase quick snacks and trends — they still get views, but far fewer new subscribers. The opportunity is to bring your Shorts back to the dinners people follow you for.",
    evidence: [
      "Shorts on proven topics (weeknight, dinner): 75 → 30 % of Shorts",
      "Subscribers per 1k views: proven-topic vs other Shorts: 2.3 → 5.2 per 1k views (other → proven)",
      "Net subscribers per 1,000 views: 1.86 → 1.12 per 1k views",
    ],
  },
  channelInOneSentence: {
    then: "The go-to Shorts for fast, everyday weeknight dinners.",
    now: "Quick snack and trend Shorts, with fewer reasons to follow for dinner.",
  },
  contentDna: {
    topTopics: ["Weeknight dinners", "One-pan meals", "Budget staples"],
    topFormats: ["Shorts", "Long-form"],
    topHookStyles: ["The finished dish first", "A familiar kitchen problem", "One useful promise"],
  },
  ideas: [
    { title: "One pan, three dinners — in under a minute.", trendRelevance: "high", audienceFit: "high", hooks: [
      { style: "bold", line: "You don't need three pans tonight. You need one." },
      { style: "relatable", line: "7 pm, tired, nothing planned? Watch this." },
      { style: "curiosity", line: "This one pan covers dinner until Thursday." },
    ] },
    { title: "3 pantry staples that rescue any weeknight.", trendRelevance: "medium", audienceFit: "high", hooks: [
      { style: "bold", line: "Keep these three things and you'll never skip dinner." },
      { style: "relatable", line: "Full cupboard, nothing to eat? Start here." },
      { style: "curiosity", line: "The jar in your pantry that makes every dinner better." },
    ] },
    { title: "Hawker-style chicken rice, one pan, 20 minutes.", trendRelevance: "high", audienceFit: "medium", hooks: [
      { style: "bold", line: "Chicken rice at home. One pan. No excuses." },
      { style: "relatable", line: "When you want hawker comfort but can't leave the house." },
      { style: "curiosity", line: "One step makes this taste like the real thing." },
    ] },
  ],
  paths: [
    { id: "A", name: "Double Down", oneLiner: "More Shorts on the topics and hooks that already work for you.", weekOnePlan: ["4 Shorts on proven topics (weeknight, dinner)"], projectedWeek12Subs: 148920, tradeOff: "Your proven-topic Shorts earn 5.2 vs 2.3 subscribers per 1k views for your other Shorts. Reliable, but less room to find your next breakout topic.",
      thesis: "Your Shorts on weeknight, dinner convert best — make more of them.", evidenceIds: ["topic_shift"], exploratory: false,
      actions: ["Post 4 Shorts a week", "4 on proven topics (weeknight, dinner)", "Open with your best-performing hook style: The finished dish first"],
      assumption: "Your audience wants more of what already works, and it won't tire of it within 12 weeks.", mainRisk: "An audience ceiling: repeating proven topics can flatten reach over time.",
      effort: "medium", evidenceStrength: "high", shortsPerWeek: 4, testsPerWeek: 0, experiment: demoExperiment("A") },
    { id: "B", name: "Balanced", oneLiner: "More Shorts, with one or two a week testing a new topic or hook.", weekOnePlan: ["3 Shorts on proven topics (weeknight, dinner)", "1 Short testing a new topic or hook"], projectedWeek12Subs: 145200, tradeOff: "Keeps most Shorts on proven topics while testing new ones. Steadier, lower-risk growth, but slower to compound.",
      thesis: "Your recent Shorts drifted from the topics that convert best — bring most back while testing one new idea at a time.", evidenceIds: ["topic_shift"], exploratory: false,
      actions: ["Post 4 Shorts a week", "3 on weeknight, dinner", "1 testing one new topic or hook"],
      assumption: "Fixing the measured bottleneck with Shorts alone (cadence, hooks, topics) is enough to lift growth.", mainRisk: "The bottleneck may sit outside Shorts (e.g. seasonality) — the checkpoints will show it.",
      effort: "medium", evidenceStrength: "high", shortsPerWeek: 4, testsPerWeek: 1, experiment: demoExperiment("B") },
    { id: "C", name: "Experiment", oneLiner: "Keep your pace; most Shorts test new topics and hooks.", weekOnePlan: ["3 Shorts testing a new topic or hook"], projectedWeek12Subs: 139680, tradeOff: "Your Shorts outside proven topics earn 2.3 vs 5.2 subscribers per 1k views for proven ones. Higher upside if a new topic lands, lower certainty.",
      thesis: "Test adjacent topics and hooks to find new reach.", evidenceIds: [], exploratory: true,
      actions: ["Post 3 Shorts a week", "3 testing new topics or hooks", "Compare each test with your recent average Short"],
      assumption: "There's untapped reach next to your current topics.", mainRisk: "Higher effort and a real chance of lower conversion while you search.",
      effort: "high", evidenceStrength: "low", shortsPerWeek: 3, testsPerWeek: 3, experiment: demoExperiment("C") },
  ],
  backtest: { channelsTested: 1, weeksEvaluated: 52, maeSubsPerWeek: 88, baselineMaeSubsPerWeek: 131 },
  streak: { currentWeeks: 6, longestWeeks: 11 },
  analysis: demoAnalysis(),
};

const trajectories: Record<PathId, number[]> = {
  A: [128950,129650,130600,131850,133380,135090,136990,139060,141300,143710,146250,148920],
  B: [129250,130200,131280,132460,133780,135180,136660,138200,139840,141560,143340,145200],
  C: [129300,130200,131100,132000,132900,133800,134740,135700,136660,137650,138650,139680],
};
const actions: Record<PathId, string[]> = {
  A: ["Post 4 weeknight-dinner Shorts, each opening on the finished dish.", "Compare subscribers per 1k views across the four; keep the strongest hook.", "Turn the most-asked comment into this week's first Short.", "Post 4 Shorts on your one-pan series.", "Revisit your best-performing budget dinner with a tighter first second.", "Review six weeks of Shorts before adding a fifth per week.", "Keep 4 proven-topic Shorts a week in the rhythm.", "Use viewer questions to pick next week's dinners.", "Refresh a proven Short with a new opening line.", "Review subscriber conversion across the dinner series.", "Repeat the hook with the strongest response.", "Review the cycle and choose which topics to carry forward."],
  B: ["Post 3 weeknight-dinner Shorts and test 1 new hook.", "Review the test Short before reusing its hook.", "Test a pantry-staples Short alongside 3 dinner Shorts.", "Compare the test topic against your dinner-Shorts baseline.", "Repeat whichever test beat the baseline.", "Review six weeks; keep one test a week.", "Test a viewer-requested topic as this week's new Short.", "Check whether test Shorts bring subscribers, not just views.", "Keep 3 proven Shorts; sharpen the test Short's first second.", "Compare subscriber conversion: proven vs test Shorts.", "Give the most promising test a follow-up Short.", "Review the cycle and choose the next balanced mix."],
  C: ["Post 3 Shorts, each testing a new topic or hook.", "Review which test earned the most subscribers per 1k views.", "Test a pantry challenge series with 2 of this week's Shorts.", "Compare the tests with your proven dinner Shorts.", "Follow up the strongest test with a second episode.", "Review six weeks; retire tests that didn't convert.", "Test a new on-screen style within the promising series.", "Check whether dinner viewers follow the new series.", "Blend one proven dinner element into the new series.", "Review effort and subscriber conversion together.", "Post a final round of tests based on what worked.", "Choose whether to expand the new series or return to dinners."],
};
export const demoPlans = Object.fromEntries(demoDiagnosis.paths.map(path => [path.id, {
  weeklyProjection: trajectories[path.id].map((subs, i) => ({ week: i + 1, subs, low: Math.round(subs - 125 * Math.sqrt(i + 1)), high: Math.round(subs + 125 * Math.sqrt(i + 1)) })),
  weeklyActions: actions[path.id].map((action, i) => ({ week: i + 1, action })),
  crossPlatform: { mocked: true, note: "Illustrative cross-platform possibilities. No Instagram or TikTok account is connected.", instagram: null, tiktok: null },
  kpiScorecard: [
    { label: "Subscribers", value: 128400, trend: "up" },
    { label: "Views · last 28 days", value: 842600, trend: "down" },
    { label: "Watch hours · last 28 days", value: 28640, trend: "flat" },
    { label: "Shorts per week", value: 3, trend: "down" },
  ],
  opportunityMatrix: demoDiagnosis.paths.map((p, i) => ({ pathId: p.id, effort: "medium", risk: (["low", "medium", "high"] as const)[i], projectedGrowth: p.projectedWeek12Subs - demoDiagnosis.channel.subscriberCount })),
}])) as Record<PathId, PlanResponse>;

// ─── Demo "did it work" story ────────────────────────────────────────────────
// Illustrative checkpoints for the demo channel, in look-back mode: the plan is treated
// as having started N weeks ago. Numbers are invented but internally consistent.

const DEMO_BASELINE = { netSubsPerWeek: 236, netSubsMedian: 230, netSubsMad: 38, viewsPerWeek: 205000, shortsPerWeek: 3, netSubsPer1kViews: 1.15, shortsNetSubsPer1kShortsViews: 0.94, provenTopicShare: 30 };

export function demoPlanRecord(body: PlanStartRequest): PlanRecord {
  const path = demoDiagnosis.paths.find((p) => p.id === body.pathId)!;
  const back = body.mode === "lookback" ? body.lookbackWeeks ?? 12 : 0;
  const startWeek = addWeeks(DEMO_LAST_WEEK, 1 - back);
  return {
    v: 1, channelId: "demo", pathId: path.id, pathName: path.name, mode: body.mode, startWeek,
    plannedShortsPerWeek: path.shortsPerWeek, plannedTestsPerWeek: path.testsPerWeek, provenTopics: ["weeknight", "dinner", "one-pan"],
    baseline: { window: `${addWeeks(startWeek, -8)} to ${weekEnd(addWeeks(startWeek, -1))}`, weeks: 8, ...DEMO_BASELINE },
    createdAt: new Date().toISOString(),
  };
}

const STORY: Record<number, { netPerWeek: number; views: number; rate: number; shortsRate: number; posted: number; tests: number; topicShare: number; status: CheckpointResponse["verdict"]["status"]; label: string; reason: string; next: string }> = {
  2: { netPerWeek: 298, views: 207000, rate: 1.44, shortsRate: 2.9, posted: 8, tests: 2, topicShare: 75, status: "insufficient_data", label: "Too early to tell", reason: "Early signal is positive: the two-week test cleared its threshold. A verdict needs at least 4 weeks.", next: "Keep the plan unchanged until week 4 so the result stays readable." },
  4: { netPerWeek: 334, views: 209000, rate: 1.6, shortsRate: 3.1, posted: 16, tests: 4, topicShare: 75, status: "supported", label: "Working", reason: "Net subscribers averaged 334/week vs 236/week before — above your normal weekly swing (±38) and above what carrying on as before would have produced.", next: "Keep the plan as it is — next check at week 8." },
  8: { netPerWeek: 362, views: 214000, rate: 1.69, shortsRate: 3.3, posted: 31, tests: 8, topicShare: 74, status: "supported", label: "Working", reason: "Net subscribers averaged 362/week vs 236/week before — above your normal weekly swing (±38) and above what carrying on as before would have produced.", next: "Keep the plan as it is — next check at week 12." },
  12: { netPerWeek: 371, views: 219000, rate: 1.69, shortsRate: 3.3, posted: 47, tests: 12, topicShare: 74, status: "supported", label: "Working", reason: "Net subscribers averaged 371/week vs 236/week before — above your normal weekly swing (±38) and above what carrying on as before would have produced.", next: "Keep the plan; start the next 12-week cycle from this new baseline." },
};

export function demoCheckpoint(week: number, plan: PlanRecord): CheckpointResponse {
  const since = plan.mode === "lookback" ? Math.round((Date.parse(`${DEMO_LAST_WEEK}T00:00:00Z`) - Date.parse(`${plan.startWeek}T00:00:00Z`)) / (7 * 86400000)) + 1 : 0;
  const window = { before: plan.baseline.window, after: `${plan.startWeek} to ${weekEnd(addWeeks(plan.startWeek, week - 1))}` };
  const shell = { week, mode: plan.mode, pathName: plan.pathName, window, mocked: true };
  if (week > since) {
    const readyOn = weekEnd(addWeeks(plan.startWeek, week - 1));
    return { ...shell, available: false, availableFrom: readyOn, verdict: { status: "insufficient_data", label: "Not yet", reason: `Week ${week} of the plan completes on ${readyOn}. ${since} complete week${since === 1 ? "" : "s"} so far.` }, adherence: null, evidence: [], decomposition: null, decompositionNote: null, counterfactual: null, experiment: null, nextStep: "Keep following the weekly plan — this checkpoint fills in automatically once the week is complete.", caveats: [] };
  }
  const s = STORY[week];
  const b = DEMO_BASELINE;
  const planned = plan.plannedShortsPerWeek * week;
  const followedPct = Math.min(100, Math.round((s.posted / planned) * 100));
  const reach = Math.round((s.views - b.viewsPerWeek) * ((b.netSubsPerWeek / b.viewsPerWeek + s.netPerWeek / s.views) / 2));
  const expected = b.netSubsMedian * week;
  const spread = Math.round(b.netSubsMad * 1.4826 * Math.sqrt(week));
  return {
    ...shell, available: true, availableFrom: null,
    verdict: { status: s.status, label: s.label, reason: s.reason },
    adherence: { plannedShorts: planned, postedShorts: s.posted, plannedTests: plan.plannedTestsPerWeek * week, postedTests: s.tests, followedPct, status: followedPct >= 80 ? "followed" : followedPct >= 50 ? "partly" : "not_followed" },
    evidence: [
      ev("net_subs_per_week", "Net subscribers per week", b.netSubsPerWeek, s.netPerWeek, "subs/week", window, week),
      ev("views_per_week", "Views per week", b.viewsPerWeek, s.views, "views/week", window, week),
      ev("net_subs_per_1k_views", "Net subscribers per 1,000 views", b.netSubsPer1kViews, s.rate, "per 1k views", window, week),
      ev("shorts_per_week", "Shorts posted per week", b.shortsPerWeek, Math.round((s.posted / week) * 10) / 10, "Shorts/week", window, week, "Data API uploads"),
      ev("shorts_net_subs_per_1k", "Shorts-attributed net subs per 1,000 Shorts views", b.shortsNetSubsPer1kShortsViews, s.shortsRate, "per 1k Shorts views", window, week, "Analytics · day × creatorContentType", "Content-type figures are attributed activity; subscriptions made away from a video page aren't included."),
      ev("proven_topic_share", "Shorts on proven topics (weeknight, dinner, one-pan)", b.provenTopicShare, s.topicShare, "% of Shorts", window, s.posted, "Data API titles", "Topics are auto-detected title keywords."),
    ],
    decomposition: { reachEffect: reach, rateEffect: s.netPerWeek - b.netSubsPerWeek - reach, totalChange: s.netPerWeek - b.netSubsPerWeek },
    decompositionNote: null,
    counterfactual: { expected, low: expected - spread, high: expected + spread, actual: s.netPerWeek * week },
    experiment: { metricLabel: "Shorts-attributed net subscribers per 1,000 Shorts views", value: 2.9, keepAbove: 2.6, dropBelow: 1.8, outcome: "keep" },
    nextStep: s.next,
    caveats: [
      `Small sample: ${week} week${week === 1 ? "" : "s"} after vs 8 before.`,
      "Seasonality, a single viral Short, or YouTube-side changes can move these numbers; this compares periods, it doesn't prove cause.",
      "Shorts-attributed figures exclude subscriptions made away from a video page.",
      ...(plan.mode === "lookback" ? [`Look-back mode: the plan wasn't actually in place — this measures what happened after ${plan.startWeek}, against the plan it would have set.`] : []),
      "Illustrative demo channel — these numbers are invented.",
    ],
  };
}

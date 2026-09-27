import type { DiagnoseResponse, PathId, PlanResponse, RecalibrationResponse } from "../types";

// Illustrative data only. Never merge these values into a live channel report.
export const demoDiagnosis: DiagnoseResponse = {
  channel: { title: "The Everyday Table", subscriberCount: 128400, recentShortsPerWeek: 3, shortsAnalysed: 142, enoughShorts: true },
  diagnosis: {
    headline: "Your Shorts drifted away from the dinners that built your audience.",
    explanation: [
      "Weeknight-dinner Shorts are why viewers subscribe.",
      "Your recent Shorts chase quick snacks and trends instead.",
      "Those still get views, but far fewer new subscribers.",
      "The opportunity is to bring your Shorts back to the dinners people follow you for.",
    ],
    evidence: [
      "Shorts on weeknight dinners earn 5.2 subscribers per 1k views — 2.3× your other Shorts.",
      "Only 30% of your last 20 Shorts cover weeknight dinners, down from 75% in your strongest period.",
      "Shorts cadence fell from 4 to 3 per week over the last 12 weeks.",
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
    { id: "A", name: "Double Down", oneLiner: "More Shorts on the topics and hooks that already work for you.", weekOnePlan: ["4 Shorts on proven topics (weeknight dinners, one-pan)"], projectedWeek12Subs: 148920, tradeOff: "Your proven-topic Shorts earn 5.2 vs 2.3 subscribers per 1k views for your other Shorts. Reliable, but less room to find your next breakout topic." },
    { id: "B", name: "Balanced", oneLiner: "More Shorts, with one or two a week testing a new topic or hook.", weekOnePlan: ["3 Shorts on proven topics (weeknight dinners, one-pan)", "1 Short testing a new topic or hook"], projectedWeek12Subs: 145200, tradeOff: "Keeps most Shorts on proven topics while testing new ones. Steadier, lower-risk growth, but slower to compound." },
    { id: "C", name: "Experiment", oneLiner: "Keep your pace; most Shorts test new topics and hooks.", weekOnePlan: ["3 Shorts testing a new topic or hook"], projectedWeek12Subs: 139680, tradeOff: "Your Shorts outside proven topics earn 2.3 vs 5.2 subscribers per 1k views for proven ones. Higher upside if a new topic lands, lower certainty." },
  ],
  backtest: null,
  streak: { currentWeeks: 6, longestWeeks: 11 },
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
  weeklyProjection: trajectories[path.id].map((subs, i) => ({ week: i + 1, subs })),
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

// A deliberately escalating story across the four checkpoints CreatorLENS Pro
// actually offers (weeks 2, 4, 8, 12): a small early signal, a specific finding
// strong enough to pivot on, then the compounding payoff of having made that pivot. Each note cites the number behind it —
// same evidence-first standard as the diagnosis — so it reads as a model
// genuinely updating itself, not a static, cosmetic percentage.
const checkpoints: Record<number, { actual: number; note: string; changes: string[] }> = {
  2: {
    actual: 130550,
    note: "Your proven dinner Shorts held viewers 18% longer than the model assumed this week — a small but real early signal.",
    changes: ["Keep 3 dinner Shorts + 1 test Short for week 3.", "Open every dinner Short on the finished dish."],
  },
  4: {
    actual: 134900,
    note: "This week's test Short — a 'rescue a bad dinner' hook — earned 4.1 subscribers per 1k views, nearly double your average Short's 2.3 — strong enough on its own to reweight the plan for the remaining 8 weeks, not just this one.",
    changes: ["Shift weeks 5–12 to 2 rescue-hook Shorts + 2 dinner Shorts per week.", "Move the test slot to a new topic now that the hook question is answered."],
  },
  8: {
    actual: 144200,
    note: "Four weeks into the reweighted mix, growth is running 5.5% ahead of where the original, un-adjusted Balanced projection would have put you by now. The pivot from week 4 is compounding, not a one-off bump.",
    changes: ["Hold 2 rescue-hook + 2 dinner Shorts a week through week 12.", "Batch-film rescue-hook Shorts to speed up production."],
  },
  12: {
    actual: 156800,
    note: "At the original 12-week mark, the reweighted plan finished 8.0% ahead of the un-adjusted Balanced scenario from week 1. This is what CreatorLENS actually does — not one projection made once, but a Shorts plan that keeps updating as your real results come in.",
    changes: ["Start the next 12-week cycle from this channel's new baseline.", "Carry the rescue hook forward as a proven format, not an experiment."],
  },
};

export function demoRecalibration(week: number): RecalibrationResponse {
  const predicted = trajectories.B[week - 1];
  const checkpoint = checkpoints[week] ?? checkpoints[2];
  const actual = checkpoint.actual;
  return {
    week, predicted, actual, deltaPct: Number(((actual - predicted) / predicted * 100).toFixed(2)), mocked: true,
    adjustedPlan: { note: checkpoint.note, changes: checkpoint.changes },
  };
}

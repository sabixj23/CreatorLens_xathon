import type { DiagnoseResponse, PathId, PlanResponse, RecalibrationResponse } from "../types";

// Illustrative data only. Never merge these values into a live channel report.
export const demoDiagnosis: DiagnoseResponse = {
  channel: { title: "The Everyday Table", subscriberCount: 128400, recentCadencePerWeek: 1.5 },
  diagnosis: {
    headline: "Your audience came for the useful. You've been giving them the quick.",
    explanation: "Practical, long-form cooking guides are the reason viewers subscribe. Your recent shift toward quick recipe Shorts is bringing reach, but fewer reasons to come back. The opportunity is to reconnect those two formats.",
    evidence: [
      "27 practical cooking guides generated 2.3× the subscriber conversion of the channel average.",
      "Shorts account for 68% of recent uploads, compared with 35% in the earlier period.",
      "Publishing cadence fell from 2.2 to 1.5 videos per week over the last 12 weeks.",
    ],
  },
  channelInOneSentence: {
    then: "The trusted guide to making everyday meals a little better.",
    now: "A quick recipe stop, with fewer reasons to stay for the next meal.",
  },
  contentDna: {
    topTopics: ["Weeknight cooking", "One-pan meals", "Budget-friendly staples"],
    topFormats: ["Step-by-step guides", "Ingredient deep dives", "Short recipe previews"],
    topHookStyles: ["A familiar kitchen problem", "The finished dish first", "One useful promise"],
  },
  ideas: [
    { title: "One pan. Three dinners. A week that practically cooks itself.", trendRelevance: "high", audienceFit: "high", hooks: [
      { style: "bold", line: "You don't need more recipes. You need one pan and a better plan." },
      { style: "relatable", line: "It's 7 pm. You're tired. Here's dinner for the next three nights." },
      { style: "curiosity", line: "What if tonight's dinner did half the work for tomorrow?" },
    ] },
    { title: "The pantry ingredients worth keeping — and what to cook with them.", trendRelevance: "medium", audienceFit: "high", hooks: [
      { style: "bold", line: "A useful pantry beats a full pantry. Start with these staples." },
      { style: "relatable", line: "A cupboard full of food, and somehow nothing for dinner?" },
      { style: "curiosity", line: "These ordinary ingredients have a second job you might be missing." },
    ] },
    { title: "Can a hawker-style dinner fit into your weeknight routine?", trendRelevance: "high", audienceFit: "medium", hooks: [
      { style: "bold", line: "Your favourite comfort meal belongs in your weeknight rotation." },
      { style: "relatable", line: "For the evenings you want hawker comfort without leaving home." },
      { style: "curiosity", line: "Which step makes this simple rice dish taste like the real thing?" },
    ] },
  ],
  paths: [
    { id: "A", name: "Double Down", oneLiner: "Build on what made people stay.", weekOnePlan: ["Publish a practical weeknight cooking guide.", "Turn its strongest tip into a Short that leads back to the guide."], projectedWeek12Subs: 139680, tradeOff: "A familiar rhythm and lower production effort, with less room to discover a new audience." },
    { id: "B", name: "Balanced", oneLiner: "Keep your core. Make room to learn.", weekOnePlan: ["Publish one practical guide and a supporting Short.", "Test a new opening on a familiar recipe; compare the response."], projectedWeek12Subs: 145200, tradeOff: "Protects the core format while testing one variable at a time. Progress asks for a steadier cadence." },
    { id: "C", name: "Experiment", oneLiner: "Give your next chapter a real test.", weekOnePlan: ["Pilot a new weeknight cooking series.", "Use a companion Short to introduce the series, then review audience response."], projectedWeek12Subs: 148920, tradeOff: "More creative range and a wider possible outcome, with higher production effort and more audience uncertainty." },
  ],
  backtest: null,
};

const trajectories: Record<PathId, number[]> = {
  A: [129300,130200,131100,132000,132900,133800,134740,135700,136660,137650,138650,139680],
  B: [129250,130200,131280,132460,133780,135180,136660,138200,139840,141560,143340,145200],
  C: [128950,129650,130600,131850,133380,135090,136990,139060,141300,143710,146250,148920],
};
const actions: Record<PathId, string[]> = {
  A: ["Publish a practical cooking guide and its companion Short.", "Review the guide's subscriber conversion and keep the strongest hook.", "Build a follow-up around the most useful viewer question.", "Publish the next guide using the same format.", "Revisit a high-performing budget meal with a new example.", "Review the first six weeks before increasing output.", "Keep one guide and one supporting Short in the weekly rhythm.", "Use audience questions to choose the next practical topic.", "Refresh a proven weeknight recipe with a clearer opening.", "Review subscriber conversion across the guide series.", "Repeat the format with the strongest observed response.", "Review the cycle and decide which format to carry forward."],
  B: ["Publish a practical guide and test a new opening in a companion Short.", "Review results before carrying the opening into the next guide.", "Try an ingredient deep dive alongside the core cooking guide.", "Compare the new format with your practical-guide baseline.", "Repeat the better-supported format with a new recipe.", "Review the first six weeks and keep one experiment at a time.", "Test a viewer-requested weeknight cooking topic.", "Check whether the experiment brings returning viewers.", "Keep the core guide; refine the supporting Short's promise.", "Compare subscriber conversion across the two formats.", "Give the most promising experiment a follow-up.", "Review the cycle and choose the next balanced mix."],
  C: ["Pilot a new weeknight series with a companion Short.", "Review audience response before producing a second episode.", "Test a pantry challenge as the second series concept.", "Compare the two pilots with your established guides.", "Follow up the stronger pilot with one production improvement.", "Review the first six weeks and retire unsupported experiments.", "Test a new presentation style within the promising series.", "Check whether existing viewers return for the new series.", "Bring one familiar practical-guide element into the experiment.", "Review effort and subscriber conversion together.", "Publish a final pilot based on what the cycle taught you.", "Choose whether to expand the new series or return to the core."],
};
export const demoPlans = Object.fromEntries(demoDiagnosis.paths.map(path => [path.id, {
  weeklyProjection: trajectories[path.id].map((subs, i) => ({ week: i + 1, subs })),
  weeklyActions: actions[path.id].map((action, i) => ({ week: i + 1, action })),
  crossPlatform: { mocked: true, note: "Illustrative cross-platform possibilities. No Instagram or TikTok account is connected.", instagram: null, tiktok: null },
  kpiScorecard: [
    { label: "Subscribers", value: 128400, trend: "up" },
    { label: "Views · last 28 days", value: 842600, trend: "down" },
    { label: "Watch hours · last 28 days", value: 28640, trend: "flat" },
    { label: "Uploads per week", value: 1.5, trend: "down" },
  ],
  benchmark: [
    { channelLabel: "The Everyday Table", cadencePerWeek: 1.5, formatMixPct: 68, isMe: true },
    { channelLabel: "Demo comparable 1", cadencePerWeek: 1.8, formatMixPct: 35, isMe: false },
    { channelLabel: "Demo comparable 2", cadencePerWeek: 2.4, formatMixPct: 52, isMe: false },
    { channelLabel: "Demo comparable 3", cadencePerWeek: 2.1, formatMixPct: 44, isMe: false },
    { channelLabel: "Demo comparable 4", cadencePerWeek: 1.6, formatMixPct: 30, isMe: false },
    { channelLabel: "Demo comparable 5", cadencePerWeek: 2.2, formatMixPct: 48, isMe: false },
  ],
  opportunityMatrix: demoDiagnosis.paths.map((p, i) => ({ pathId: p.id, effort: (["low", "medium", "high"] as const)[i], risk: (["low", "medium", "high"] as const)[i], projectedGrowth: p.projectedWeek12Subs - demoDiagnosis.channel.subscriberCount })),
}])) as Record<PathId, PlanResponse>;

export function demoRecalibration(week: number): RecalibrationResponse {
  const predicted = trajectories.B[week - 1];
  const actual = predicted - (week === 2 ? 350 : 520);
  return {
    week, predicted, actual, deltaPct: Number(((actual - predicted) / predicted * 100).toFixed(2)), mocked: true,
    adjustedPlan: {
      note: "The original Balanced scenario is slightly ahead of this scripted result. Keep the practical guide; refine the supporting Short before adding more output.",
      changes: ["Keep one core guide in the next week.", "Make the companion Short's link to the full recipe explicit.", "Review the next checkpoint before increasing production."],
    },
  };
}

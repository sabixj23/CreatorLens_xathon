import type { Week } from "./analysis/weeks";
import { netSubs } from "./analysis/weeks";
import { mad, median, round } from "./analysis/stats";
import type { ShortsStats } from "./format-stats";
import { describeShortsGap } from "./format-stats";
import { fitOls } from "./regression";
import type { Backtest, KpiTile, OpportunityRow, PathId, Streak } from "./types";

// Weekly state derived from the canonical complete-week model (lib/analysis/weeks.ts).
export type WeeklyChannelState = {
  weekIndex: number;
  weekStart: string;
  cadencePerWeek: number; // all uploads
  shortsPct: number; // 0-1
  shortsPerWeek: number;
  longFormPerWeek: number;
  netSubs: number;
  views: number;
};

export function statesFromWeeks(weeks: Week[]): WeeklyChannelState[] {
  return weeks.map((w, i) => ({
    weekIndex: i,
    weekStart: w.start,
    cadencePerWeek: w.uploads,
    shortsPct: w.uploads > 0 ? w.shortsUploads / w.uploads : 0,
    shortsPerWeek: w.shortsUploads,
    longFormPerWeek: w.longUploads,
    netSubs: netSubs(w),
    views: w.views,
  }));
}

export type RecentAverages = { cadencePerWeek: number; shortsPct: number; shortsPerWeek: number; longFormPerWeek: number };

export function recentAverages(history: WeeklyChannelState[], weeks = 8): RecentAverages {
  const recent = history.slice(-weeks);
  if (recent.length === 0) return { cadencePerWeek: 1, shortsPct: 1, shortsPerWeek: 1, longFormPerWeek: 0 };
  const avg = (key: keyof RecentAverages) => recent.reduce((sum, w) => sum + w[key], 0) / recent.length;
  return { cadencePerWeek: avg("cadencePerWeek"), shortsPct: avg("shortsPct"), shortsPerWeek: avg("shortsPerWeek"), longFormPerWeek: avg("longFormPerWeek") };
}

// Real Shorts streak from real upload weeks — the most recent run of consecutive complete
// weeks with at least one Short, and the longest such run in the available history.
export function computeStreak(history: WeeklyChannelState[]): Streak {
  let currentWeeks = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].shortsPerWeek > 0) currentWeeks++;
    else break;
  }
  let longestWeeks = 0;
  let run = 0;
  for (const week of history) {
    if (week.shortsPerWeek > 0) {
      run++;
      longestWeeks = Math.max(longestWeeks, run);
    } else {
      run = 0;
    }
  }
  return { currentWeeks, longestWeeks };
}

// ─── Regression baseline (evaluated walk-forward; not used as a causal effect) ──

// Weekly net subscribers ≈ intercept + shortsCoef × Shorts/week + longFormCoef × long-form/week.
export type GrowthModel = { intercept: number; shortsCoef: number; longFormCoef: number };

const MIN_TRAINING_WEEKS = 8;

export function fitGrowthModel(history: WeeklyChannelState[]): GrowthModel {
  if (history.length < MIN_TRAINING_WEEKS) {
    return { intercept: median(history.map((w) => w.netSubs)), shortsCoef: 0, longFormCoef: 0 };
  }
  const features = history.map((w) => [1, w.shortsPerWeek, w.longFormPerWeek]);
  const [intercept, shortsCoef, longFormCoef] = fitOls(features, history.map((w) => w.netSubs));
  return { intercept, shortsCoef, longFormCoef };
}

export function predictWeek(model: GrowthModel, shortsPerWeek: number, longFormPerWeek: number): number {
  return model.intercept + model.shortsCoef * shortsPerWeek + model.longFormCoef * longFormPerWeek;
}

// Walk-forward self-backtest on ONE channel: for each week with enough earlier data, fit
// on the preceding complete weeks only and predict that week's net subscriber change.
// Reported as mean absolute error in subscribers/week, next to a naive baseline (median
// of the previous four weeks) over the same weeks. null until it can actually be run.
export function backtest(history: WeeklyChannelState[]): Backtest | null {
  if (history.length < MIN_TRAINING_WEEKS + 4) return null;
  const modelErrors: number[] = [];
  const baselineErrors: number[] = [];
  for (let cutoff = MIN_TRAINING_WEEKS; cutoff < history.length; cutoff++) {
    const train = history.slice(0, cutoff);
    const target = history[cutoff];
    const model = fitGrowthModel(train);
    modelErrors.push(Math.abs(predictWeek(model, target.shortsPerWeek, target.longFormPerWeek) - target.netSubs));
    baselineErrors.push(Math.abs(median(train.slice(-4).map((w) => w.netSubs)) - target.netSubs));
  }
  const mae = (errors: number[]) => round(errors.reduce((s, e) => s + e, 0) / errors.length, 0);
  return { channelsTested: 1, weeksEvaluated: modelErrors.length, maeSubsPerWeek: mae(modelErrors), baselineMaeSubsPerWeek: mae(baselineErrors) };
}

// ─── Shorts paths ────────────────────────────────────────────────────────────

export type PathPlan = {
  id: PathId;
  name: string;
  oneLiner: string;
  risk: OpportunityRow["risk"];
  shortsPerWeek: number;
  testsPerWeek: number; // Shorts testing a new topic or hook; the rest stay on proven topics
  weekOnePlan: string[];
  tradeOff: string;
  weeklyNetCentral: number;
  weeklyProjection: Array<{ week: number; subs: number; low: number; high: number }>;
  projectedWeek12Subs: number;
};

// Every path is a Shorts strategy: how many Shorts a week, and how many of those test a
// new topic or hook instead of staying on the channel's proven topics. Counts are
// defined directly (not as rounded percentages) so the three paths stay distinct even
// at 1–3 Shorts a week.
export const PATH_DEFS: Array<{
  id: PathId;
  name: string;
  oneLiner: string;
  risk: OpportunityRow["risk"];
  shorts: (current: number) => number;
  tests: (shorts: number) => number;
}> = [
  {
    id: "A", name: "Double Down", oneLiner: "More Shorts on the topics and hooks that already work for you.", risk: "low",
    shorts: (c) => Math.max(Math.round(c * 1.3), Math.round(c) + 1),
    tests: (n) => Math.floor(n * 0.2),
  },
  {
    id: "B", name: "Balanced", oneLiner: "More Shorts, with one or two a week testing a new topic or hook.", risk: "medium",
    shorts: (c) => Math.max(Math.round(c * 1.2), 1),
    tests: (n) => (n >= 2 ? Math.max(1, Math.round(n / 3)) : 0),
  },
  {
    id: "C", name: "Experiment", oneLiner: "Keep your pace; most Shorts test new topics and hooks.", risk: "high",
    shorts: (c) => Math.max(Math.round(c), 1),
    tests: (n) => n - Math.floor(n * 0.3),
  },
];

function tradeOffFor(id: PathId, stats: ShortsStats): string {
  const provenVsOther = describeShortsGap(stats.proven, stats.other, stats.basis);
  const otherVsProven = describeShortsGap(stats.other, stats.proven, stats.basis);
  switch (id) {
    case "A":
      return provenVsOther
        ? `Your proven-topic Shorts earn ${provenVsOther} for your other Shorts. Reliable, but less room to find your next breakout topic.`
        : "Stays on the topics that already work. Reliable, but less room to find your next breakout topic.";
    case "B":
      return "Keeps most Shorts on proven topics while testing new ones. Steadier, lower-risk growth, but slower to compound.";
    case "C":
      return stats.other.videos === 0
        ? "You haven't posted Shorts outside your proven topics yet — no history to lean on. Higher upside if a new topic lands, lower certainty."
        : otherVsProven
          ? `Your Shorts outside proven topics earn ${otherVsProven} for proven ones. Higher upside if a new topic lands, lower certainty.`
          : "Most Shorts test new topics. Higher upside if one lands, lower certainty.";
  }
}

export function weekMix(path: { shortsPerWeek: number; testsPerWeek: number }) {
  return { proven: path.shortsPerWeek - path.testsPerWeek, test: path.testsPerWeek };
}

// Inputs for the conservative scenario engine. Deliberately NOT the regression's
// coefficients — a correlation between posting volume and growth isn't the causal effect
// of posting more.
export type ProjectionInputs = {
  baselineWeeklyNet: number; // median weekly net subs, last 8 complete weeks
  baselineShortsPerWeek: number;
  baselineProvenShare: number; // 0-1, share of recent Shorts on proven topics
  perShortSubs: number | null; // median video-attributed subscriber gains per recent Short
  errorPerWeek: number; // for the band: best available weekly error (backtest MAE or MAD)
  histMin: number; // clamp range: observed weekly net subs
  histMax: number;
};

// Only half of a Short's observed subscriber gains are credited to an ADDED Short —
// an explicit assumption for diminishing returns, shown in the UI.
export const MARGINAL_SHORT_CREDIT = 0.5;

export function projectionInputs(weeks: Week[], perShortSubs: number | null, baselineProvenShare: number | null, errorPerWeek: number | null): ProjectionInputs {
  const recent = weeks.slice(-8);
  const nets = recent.map(netSubs);
  const history = weeks.slice(-52).map(netSubs);
  return {
    baselineWeeklyNet: median(nets),
    baselineShortsPerWeek: recent.length ? recent.reduce((s, w) => s + w.shortsUploads, 0) / recent.length : 0,
    baselineProvenShare: baselineProvenShare ?? 0.5,
    perShortSubs,
    // 1.4826 × MAD approximates a standard deviation for roughly normal noise.
    errorPerWeek: errorPerWeek ?? Math.max(1, mad(nets) * 1.4826),
    histMin: history.length ? Math.min(...history) : 0,
    histMax: history.length ? Math.max(...history) : 0,
  };
}

export function planPaths(currentSubs: number, inputs: ProjectionInputs, shortsStats: ShortsStats): PathPlan[] {
  const topics = shortsStats.provenTopics.slice(0, 2).join(", ");
  const qualityOf = (provenShare: number) => provenShare * shortsStats.provenRel + (1 - provenShare) * shortsStats.otherRel;
  const baselineAttributed = inputs.perShortSubs !== null ? inputs.baselineShortsPerWeek * inputs.perShortSubs * qualityOf(inputs.baselineProvenShare) : 0;

  return PATH_DEFS.map((def) => {
    const shortsPerWeek = def.shorts(inputs.baselineShortsPerWeek);
    const testsPerWeek = def.tests(shortsPerWeek);
    const { proven, test } = weekMix({ shortsPerWeek, testsPerWeek });
    const planAttributed = inputs.perShortSubs !== null ? shortsPerWeek * inputs.perShortSubs * qualityOf(proven / shortsPerWeek) : 0;
    const delta = MARGINAL_SHORT_CREDIT * (planAttributed - baselineAttributed);
    // Clamp to what this channel has actually done in a week — no implausible outputs.
    const weeklyNetCentral = Math.min(inputs.histMax, Math.max(inputs.histMin, inputs.baselineWeeklyNet + delta));

    const weeklyProjection = Array.from({ length: 12 }, (_, i) => {
      const week = i + 1;
      const subs = currentSubs + weeklyNetCentral * week;
      const spread = inputs.errorPerWeek * Math.sqrt(week); // widens with horizon
      return { week, subs: Math.round(subs), low: Math.round(subs - spread), high: Math.round(subs + spread) };
    });

    const weekOnePlan = [
      proven > 0 ? `${proven} Short${proven === 1 ? "" : "s"} on proven topics${topics ? ` (${topics})` : ""}` : null,
      test > 0 ? `${test} Short${test === 1 ? "" : "s"} testing a new topic or hook` : null,
    ].filter((x): x is string => x !== null);

    return {
      id: def.id, name: def.name, oneLiner: def.oneLiner, risk: def.risk, shortsPerWeek, testsPerWeek, weekOnePlan,
      tradeOff: tradeOffFor(def.id, shortsStats),
      weeklyNetCentral: round(weeklyNetCentral, 1),
      weeklyProjection,
      projectedWeek12Subs: weeklyProjection[11].subs,
    };
  });
}

// Templated, not LLM-generated — deliberately, so fetching all 3 paths in parallel on
// /dashboard/plan doesn't mean 3 OpenAI round-trips. Weeks 1–2 are the path's two-week test.
export function buildWeeklyActions(path: PathPlan): Array<{ week: number; action: string }> {
  const { proven, test } = weekMix(path);
  const parts = [proven > 0 ? `${proven} on proven topics` : null, test > 0 ? `${test} testing something new` : null].filter((x): x is string => x !== null);
  const base = `Post ${path.shortsPerWeek} Short${path.shortsPerWeek === 1 ? "" : "s"} — ${parts.join(", ")}`;
  return Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const note =
      week <= 2 ? " Two-week test: keep the mix exactly as planned so the week-2 checkpoint can judge it."
      : week === 4 || week === 8 || week === 12 ? " Checkpoint week: compare with your 8 weeks before the plan."
      : "";
    return { week, action: `${base} (${path.name}).${note}` };
  });
}

export function buildKpiScorecard(history: WeeklyChannelState[], currentSubs: number): KpiTile[] {
  const recent = history.slice(-4);
  const prior = history.slice(-8, -4);
  const avg = (weeks: WeeklyChannelState[], key: "views" | "netSubs" | "shortsPerWeek") =>
    weeks.length ? weeks.reduce((sum, w) => sum + w[key], 0) / weeks.length : 0;
  const trendOf = (curr: number, prev: number): "up" | "down" | "flat" => {
    if (prev === 0) return curr > 0 ? "up" : "flat";
    const change = (curr - prev) / Math.abs(prev);
    if (change > 0.05) return "up";
    if (change < -0.05) return "down";
    return "flat";
  };
  return [
    { label: "Subscribers", value: Math.round(currentSubs), trend: trendOf(avg(recent, "netSubs"), avg(prior, "netSubs")) },
    { label: "Avg weekly views (last 4 complete wks)", value: Math.round(avg(recent, "views")), trend: trendOf(avg(recent, "views"), avg(prior, "views")) },
    { label: "Avg net subs/week (last 4 complete wks)", value: Math.round(avg(recent, "netSubs")), trend: trendOf(avg(recent, "netSubs"), avg(prior, "netSubs")) },
    { label: "Shorts per week (last 4 complete wks)", value: round(avg(recent, "shortsPerWeek"), 1), trend: trendOf(avg(recent, "shortsPerWeek"), avg(prior, "shortsPerWeek")) },
  ];
}

export function buildOpportunityMatrix(paths: PathPlan[], currentSubs: number): OpportunityRow[] {
  return paths.map((path) => ({
    pathId: path.id,
    effort: path.shortsPerWeek >= 5 ? "high" : path.shortsPerWeek >= 3 ? "medium" : "low",
    projectedGrowth: Math.round(path.projectedWeek12Subs - currentSubs),
    risk: path.risk,
  }));
}

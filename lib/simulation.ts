import { fitOls } from "./regression";
import type { DailyAnalytics, OwnVideo } from "./youtube";
import type { ShortsStats } from "./format-stats";
import { describeShortsGap } from "./format-stats";
import type { Backtest, GrowthPath, KpiTile, OpportunityRow, PathId, Streak } from "./types";

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

// Aggregates real day-level Analytics data and real per-video Data API results into
// weekly buckets — cadence and format mix come from actual publish dates, growth comes
// from actual Analytics numbers. No estimation, no synthetic data.
export function buildWeeklyHistory(daily: DailyAnalytics[], videos: OwnVideo[]): WeeklyChannelState[] {
  if (daily.length === 0) return [];
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(sorted[0].date).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const weeks = new Map<number, { netSubs: number; views: number }>();
  for (const day of sorted) {
    const weekIndex = Math.floor((new Date(day.date).getTime() - start) / weekMs);
    const bucket = weeks.get(weekIndex) ?? { netSubs: 0, views: 0 };
    bucket.netSubs += day.subscribersGained - day.subscribersLost;
    bucket.views += day.views;
    weeks.set(weekIndex, bucket);
  }

  const videoWeeks = new Map<number, { count: number; shorts: number }>();
  for (const video of videos) {
    const weekIndex = Math.floor((new Date(video.publishedAt).getTime() - start) / weekMs);
    if (weekIndex < 0) continue;
    const bucket = videoWeeks.get(weekIndex) ?? { count: 0, shorts: 0 };
    bucket.count += 1;
    if (video.isShort) bucket.shorts += 1;
    videoWeeks.set(weekIndex, bucket);
  }

  const maxWeek = Math.max(0, ...weeks.keys());
  const result: WeeklyChannelState[] = [];
  for (let weekIndex = 0; weekIndex <= maxWeek; weekIndex++) {
    const analytics = weeks.get(weekIndex) ?? { netSubs: 0, views: 0 };
    const videoStats = videoWeeks.get(weekIndex) ?? { count: 0, shorts: 0 };
    result.push({
      weekIndex,
      weekStart: new Date(start + weekIndex * weekMs).toISOString().slice(0, 10),
      cadencePerWeek: videoStats.count,
      shortsPct: videoStats.count > 0 ? videoStats.shorts / videoStats.count : 0,
      shortsPerWeek: videoStats.shorts,
      longFormPerWeek: videoStats.count - videoStats.shorts,
      netSubs: analytics.netSubs,
      views: analytics.views,
    });
  }
  return result;
}

export type RecentAverages = { cadencePerWeek: number; shortsPct: number; shortsPerWeek: number; longFormPerWeek: number };

export function recentAverages(history: WeeklyChannelState[], weeks = 4): RecentAverages {
  const recent = history.slice(-weeks);
  if (recent.length === 0) return { cadencePerWeek: 1, shortsPct: 1, shortsPerWeek: 1, longFormPerWeek: 0 };
  const avg = (key: keyof RecentAverages) => recent.reduce((sum, w) => sum + w[key], 0) / recent.length;
  return { cadencePerWeek: avg("cadencePerWeek"), shortsPct: avg("shortsPct"), shortsPerWeek: avg("shortsPerWeek"), longFormPerWeek: avg("longFormPerWeek") };
}

// Real Shorts streak from real upload weeks — the most recent run of consecutive weeks
// with at least one Short, and the longest such run anywhere in the available history.
// Not a separately tracked counter, so it can never drift from what actually happened.
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

// Weekly net subscribers ≈ intercept + shortsCoef × Shorts/week + longFormCoef × long-form/week.
// Long-form stays in the model as a control (subscriber growth is channel-wide), but the
// app only ever advises on Shorts.
export type GrowthModel = { intercept: number; shortsCoef: number; longFormCoef: number };

const MIN_TRAINING_WEEKS = 4;

export function fitGrowthModel(history: WeeklyChannelState[]): GrowthModel {
  if (history.length < MIN_TRAINING_WEEKS) {
    const avg = history.length ? history.reduce((sum, w) => sum + w.netSubs, 0) / history.length : 0;
    return { intercept: avg, shortsCoef: 0, longFormCoef: 0 };
  }
  const features = history.map((w) => [1, w.shortsPerWeek, w.longFormPerWeek]);
  const targets = history.map((w) => w.netSubs);
  const [intercept, shortsCoef, longFormCoef] = fitOls(features, targets);
  return { intercept, shortsCoef, longFormCoef };
}

// `shortsQuality` scales each Short's contribution by how the planned topic mix has
// performed on this channel (1 = the channel's average Short; see simulatePaths).
export function predictWeek(model: GrowthModel, shortsPerWeek: number, longFormPerWeek: number, shortsQuality = 1): number {
  return model.intercept + model.shortsCoef * shortsPerWeek * shortsQuality + model.longFormCoef * longFormPerWeek;
}

export type RecalibrationResult = {
  predicted: number;
  actual: number;
  deltaPct: number;
  adjustedPlan: { note: string; changes: string[] };
};

// The core reusable function: used retrospectively across every past week for the
// walk-forward backtest, and on-demand for a scripted future week in the demo.
export function recalibrateWeek(predicted: number, actual: number): RecalibrationResult {
  const deltaPct = predicted === 0 ? 0 : ((actual - predicted) / Math.abs(predicted)) * 100;
  const changes: string[] = [];
  let note: string;
  if (Math.abs(deltaPct) < 10) {
    note = "Performance is tracking close to the model's expectation — no change to the plan.";
  } else if (deltaPct > 0) {
    note = "This week outperformed the model's expectation — the remaining weeks lean further into what's working.";
    changes.push("Make one more Short a week on the topic or hook that beat the plan.");
  } else {
    note = "This week underperformed the model's expectation — the plan adjusts for the remaining weeks.";
    changes.push("Swap one test Short a week back to a proven topic until the next checkpoint.");
  }
  return { predicted, actual, deltaPct: Math.round(deltaPct * 10) / 10, adjustedPlan: { note, changes } };
}

// Walk-forward self-backtest against the creator's OWN history: for each week after
// enough training data exists, fit on everything before it and predict that week.
// This is not "20 real channels" — YouTube's API can't provide historical subscriber
// counts for channels the signed-in user doesn't own, so this is the honest version:
// one channel, walked forward week by week. Say so plainly wherever this surfaces.
export function backtest(history: WeeklyChannelState[]): Backtest | null {
  if (history.length < MIN_TRAINING_WEEKS + 1) return null;

  const errors: number[] = [];
  for (let cutoff = MIN_TRAINING_WEEKS; cutoff < history.length; cutoff++) {
    const model = fitGrowthModel(history.slice(0, cutoff));
    const target = history[cutoff];
    const predicted = predictWeek(model, target.shortsPerWeek, target.longFormPerWeek);
    const denominator = Math.max(1, Math.abs(target.netSubs));
    errors.push((Math.abs(predicted - target.netSubs) / denominator) * 100);
  }
  if (errors.length === 0) return null;
  const meanErrorPct = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  return { channelsTested: 1, meanErrorPct: Math.round(meanErrorPct * 10) / 10 };
}

export type SimulatedPath = GrowthPath & {
  shortsPerWeek: number;
  testsPerWeek: number; // Shorts testing a new topic or hook; the rest stay on proven topics
  risk: OpportunityRow["risk"]; // how much the path rests on untested topics
  weeklyProjection: Array<{ week: number; subs: number }>;
};

// Every path is a Shorts strategy: how many Shorts a week, and how many of those test a
// new topic or hook instead of staying on the channel's proven topics. Counts are
// defined directly (not as rounded percentages) so the three paths stay distinct even
// at 1–3 Shorts a week. Long-form output is held at its current level in the
// projection — it isn't part of the advice.
const PATH_DEFS: Array<{
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

// Trade-off text grounded in the channel's own proven-topic vs other Shorts numbers.
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

function weekMix(path: { shortsPerWeek: number; testsPerWeek: number }) {
  return { proven: path.shortsPerWeek - path.testsPerWeek, test: path.testsPerWeek };
}

export function simulatePaths(
  currentSubs: number,
  recent: RecentAverages,
  model: GrowthModel,
  shortsStats: ShortsStats
): SimulatedPath[] {
  const topics = shortsStats.provenTopics.slice(0, 2).join(", ");

  return PATH_DEFS.map((def) => {
    const shortsPerWeek = def.shorts(recent.shortsPerWeek);
    const testsPerWeek = def.tests(shortsPerWeek);
    const { proven, test } = weekMix({ shortsPerWeek, testsPerWeek });
    // How this exact mix has performed on the channel, relative to its average Short.
    const quality = (proven * shortsStats.provenRel + test * shortsStats.otherRel) / shortsPerWeek;

    const weeklyProjection: Array<{ week: number; subs: number }> = [];
    let runningSubs = currentSubs;
    for (let week = 1; week <= 12; week++) {
      runningSubs += predictWeek(model, shortsPerWeek, recent.longFormPerWeek, quality);
      weeklyProjection.push({ week, subs: Math.round(runningSubs) });
    }

    const weekOnePlan = [
      proven > 0 ? `${proven} Short${proven === 1 ? "" : "s"} on proven topics${topics ? ` (${topics})` : ""}` : null,
      test > 0 ? `${test} Short${test === 1 ? "" : "s"} testing a new topic or hook` : null,
    ].filter((x): x is string => x !== null);

    return {
      id: def.id,
      name: def.name,
      oneLiner: def.oneLiner,
      shortsPerWeek,
      testsPerWeek,
      risk: def.risk,
      weekOnePlan,
      weeklyProjection,
      projectedWeek12Subs: weeklyProjection[11]?.subs ?? Math.round(currentSubs),
      tradeOff: tradeOffFor(def.id, shortsStats),
    };
  });
}

// Templated, not LLM-generated — deliberately, so fetching all 3 paths in parallel on
// /dashboard/plan doesn't mean 3 OpenAI round-trips on the screen the demo lingers on.
export function buildWeeklyActions(path: SimulatedPath): Array<{ week: number; action: string }> {
  const { proven, test } = weekMix(path);
  const parts = [
    proven > 0 ? `${proven} on proven topics` : null,
    test > 0 ? `${test} testing something new` : null,
  ].filter((x): x is string => x !== null);

  return Array.from({ length: 12 }, (_, i) => ({
    week: i + 1,
    action: `Post ${path.shortsPerWeek} Short${path.shortsPerWeek === 1 ? "" : "s"} this week — ${parts.join(", ")} (${path.name} strategy).`,
  }));
}

export function buildKpiScorecard(history: WeeklyChannelState[], currentSubs: number): KpiTile[] {
  const recent = history.slice(-4);
  const prior = history.slice(-8, -4);
  const avg = (weeks: WeeklyChannelState[], key: "views" | "netSubs") =>
    weeks.length ? weeks.reduce((sum, w) => sum + w[key], 0) / weeks.length : 0;

  const trendOf = (curr: number, prev: number): "up" | "down" | "flat" => {
    if (prev === 0) return curr > 0 ? "up" : "flat";
    const change = (curr - prev) / Math.abs(prev);
    if (change > 0.05) return "up";
    if (change < -0.05) return "down";
    return "flat";
  };

  const recentViews = avg(recent, "views");
  const priorViews = avg(prior, "views");
  const recentNetSubs = avg(recent, "netSubs");
  const priorNetSubs = avg(prior, "netSubs");

  return [
    { label: "Subscribers", value: Math.round(currentSubs), trend: trendOf(recentNetSubs, priorNetSubs) },
    { label: "Avg weekly views (last 4 wks)", value: Math.round(recentViews), trend: trendOf(recentViews, priorViews) },
    { label: "Avg net subs/week (last 4 wks)", value: Math.round(recentNetSubs), trend: trendOf(recentNetSubs, priorNetSubs) },
  ];
}

export function buildOpportunityMatrix(paths: SimulatedPath[], currentSubs: number): OpportunityRow[] {
  return paths.map((path) => ({
    pathId: path.id,
    effort: path.shortsPerWeek >= 5 ? "high" : path.shortsPerWeek >= 3 ? "medium" : "low",
    projectedGrowth: Math.round(path.projectedWeek12Subs - currentSubs),
    risk: path.risk,
  }));
}

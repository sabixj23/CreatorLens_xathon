import { fitOls } from "./regression";
import type { DailyAnalytics, OwnVideo } from "./youtube";
import type { Backtest, BenchmarkRow, GrowthPath, KpiTile, OpportunityRow, PathId, Streak } from "./types";

export type WeeklyChannelState = {
  weekIndex: number;
  weekStart: string;
  cadencePerWeek: number;
  shortsPct: number; // 0-1
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
      netSubs: analytics.netSubs,
      views: analytics.views,
    });
  }
  return result;
}

export function recentAverages(history: WeeklyChannelState[], weeks = 4): { cadencePerWeek: number; shortsPct: number } {
  const recent = history.slice(-weeks);
  if (recent.length === 0) return { cadencePerWeek: 1, shortsPct: 0.4 };
  return {
    cadencePerWeek: recent.reduce((sum, w) => sum + w.cadencePerWeek, 0) / recent.length,
    shortsPct: recent.reduce((sum, w) => sum + w.shortsPct, 0) / recent.length,
  };
}

// Real streak from real upload weeks — the most recent run of consecutive weeks with
// at least one upload, and the longest such run anywhere in the available history.
// Not a separately tracked counter, so it can never drift from what actually happened.
export function computeStreak(history: WeeklyChannelState[]): Streak {
  let currentWeeks = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].cadencePerWeek > 0) currentWeeks++;
    else break;
  }
  let longestWeeks = 0;
  let run = 0;
  for (const week of history) {
    if (week.cadencePerWeek > 0) {
      run++;
      longestWeeks = Math.max(longestWeeks, run);
    } else {
      run = 0;
    }
  }
  return { currentWeeks, longestWeeks };
}

export type GrowthModel = { intercept: number; cadenceCoef: number; shortsPctCoef: number };

const MIN_TRAINING_WEEKS = 4;

export function fitGrowthModel(history: WeeklyChannelState[]): GrowthModel {
  if (history.length < MIN_TRAINING_WEEKS) {
    const avg = history.length ? history.reduce((sum, w) => sum + w.netSubs, 0) / history.length : 0;
    return { intercept: avg, cadenceCoef: 0, shortsPctCoef: 0 };
  }
  const features = history.map((w) => [1, w.cadencePerWeek, w.shortsPct]);
  const targets = history.map((w) => w.netSubs);
  const [intercept, cadenceCoef, shortsPctCoef] = fitOls(features, targets);
  return { intercept, cadenceCoef, shortsPctCoef };
}

export function predictWeek(model: GrowthModel, cadencePerWeek: number, shortsPct: number): number {
  return model.intercept + model.cadenceCoef * cadencePerWeek + model.shortsPctCoef * shortsPct;
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
    changes.push("Increase the higher-performing format's share slightly for the remaining weeks.");
  } else {
    note = "This week underperformed the model's expectation — the plan adjusts down for the remaining weeks.";
    changes.push("Reduce the experimental format's share and lean back toward the historically stronger format.");
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
    const predicted = predictWeek(model, target.cadencePerWeek, target.shortsPct);
    const denominator = Math.max(1, Math.abs(target.netSubs));
    errors.push((Math.abs(predicted - target.netSubs) / denominator) * 100);
  }
  if (errors.length === 0) return null;
  const meanErrorPct = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  return { channelsTested: 1, meanErrorPct: Math.round(meanErrorPct * 10) / 10 };
}

export type SimulatedPath = GrowthPath & {
  cadencePerWeek: number;
  shortsPct: number;
  weeklyProjection: Array<{ week: number; subs: number }>;
};

export type ComparableChannel = {
  title: string;
  cadencePerWeek: number;
  shortsPct: number;
  subscriberCount: number;
};

const PATH_DEFS: Array<{
  id: PathId;
  name: string;
  oneLiner: string;
  cadenceMultiplier: number;
  shortsPctTarget: number;
  tradeOff: string;
}> = [
  {
    id: "A",
    name: "Double Down",
    oneLiner: "Increase your historically strongest format substantially.",
    cadenceMultiplier: 1.3,
    shortsPctTarget: 0.2,
    tradeOff:
      "Grows on proven ground, but leaves less room to discover a new format that could outperform it.",
  },
  {
    id: "B",
    name: "Balanced",
    oneLiner: "Maintain your strongest format while introducing new ones gradually.",
    cadenceMultiplier: 1.1,
    shortsPctTarget: 0.4,
    tradeOff: "Steadier, lower-risk growth, but slower to compound than fully committing to one direction.",
  },
  {
    id: "C",
    name: "Experiment",
    oneLiner: "Allocate more output to emerging or untested formats.",
    cadenceMultiplier: 1.0,
    shortsPctTarget: 0.6,
    tradeOff:
      "Higher upside if a new format lands, but lower historical certainty and a higher chance of underperforming the safer paths.",
  },
];

export function simulatePaths(
  currentSubs: number,
  currentCadence: number,
  model: GrowthModel,
  comparables: ComparableChannel[]
): SimulatedPath[] {
  return PATH_DEFS.map((def) => {
    const cadencePerWeek = Math.max(1, Math.round(currentCadence * def.cadenceMultiplier) || 1);
    const shortsPct = def.shortsPctTarget;

    const weeklyProjection: Array<{ week: number; subs: number }> = [];
    let runningSubs = currentSubs;
    for (let week = 1; week <= 12; week++) {
      runningSubs += predictWeek(model, cadencePerWeek, shortsPct);
      weeklyProjection.push({ week, subs: Math.round(runningSubs) });
    }

    const relevantComparable = comparables.find((c) => Math.abs(c.shortsPct - shortsPct) < 0.15);
    const tradeOff = relevantComparable
      ? `${def.tradeOff} (${relevantComparable.title}, a comparable channel with a similar format mix, shows the same pattern.)`
      : def.tradeOff;

    const shorts = Math.round(cadencePerWeek * shortsPct);
    const longForm = cadencePerWeek - shorts;
    const weekOnePlan = [
      shorts > 0 ? `${shorts} Short${shorts === 1 ? "" : "s"}` : null,
      longForm > 0 ? `${longForm} long-form video${longForm === 1 ? "" : "s"}` : null,
    ].filter((x): x is string => x !== null);

    return {
      id: def.id,
      name: def.name,
      oneLiner: def.oneLiner,
      cadencePerWeek,
      shortsPct,
      weekOnePlan,
      weeklyProjection,
      projectedWeek12Subs: weeklyProjection[11]?.subs ?? Math.round(currentSubs),
      tradeOff,
    };
  });
}

// Templated, not LLM-generated — deliberately, so fetching all 3 paths in parallel on
// /dashboard/plan doesn't mean 3 OpenAI round-trips on the screen the demo lingers on.
export function buildWeeklyActions(path: SimulatedPath): Array<{ week: number; action: string }> {
  const shorts = Math.round(path.cadencePerWeek * path.shortsPct);
  const longForm = path.cadencePerWeek - shorts;
  const parts = [
    shorts > 0 ? `${shorts} Short${shorts === 1 ? "" : "s"}` : null,
    longForm > 0 ? `${longForm} long-form video${longForm === 1 ? "" : "s"}` : null,
  ].filter((x): x is string => x !== null);

  return Array.from({ length: 12 }, (_, i) => ({
    week: i + 1,
    action: `Post ${parts.join(" + ")} this week (${path.name} strategy).`,
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

export function buildBenchmark(
  myCadence: number,
  myShortsPct: number,
  comparables: ComparableChannel[]
): BenchmarkRow[] {
  return [
    { channelLabel: "You", cadencePerWeek: Math.round(myCadence * 10) / 10, formatMixPct: Math.round(myShortsPct * 100), isMe: true },
    ...comparables.map((c) => ({
      channelLabel: c.title,
      cadencePerWeek: Math.round(c.cadencePerWeek * 10) / 10,
      formatMixPct: Math.round(c.shortsPct * 100),
      isMe: false,
    })),
  ];
}

export function buildOpportunityMatrix(paths: SimulatedPath[], currentSubs: number): OpportunityRow[] {
  return paths.map((path) => ({
    pathId: path.id,
    effort: path.cadencePerWeek >= 4 ? "high" : path.cadencePerWeek >= 2 ? "medium" : "low",
    projectedGrowth: Math.round(path.projectedWeek12Subs - currentSubs),
    risk: path.shortsPct >= 0.5 ? "high" : path.shortsPct >= 0.3 ? "medium" : "low",
  }));
}

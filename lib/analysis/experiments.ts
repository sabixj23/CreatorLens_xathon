import type { Experiment, PathId } from "../types";
import { mad, median, round, safeRatio } from "./stats";
import type { Week } from "./weeks";
import { netSubs, shortsNetSubs } from "./weeks";

export const EXPERIMENT_WEEKS = 2;
export const MIN_EXPERIMENT_SHORTS_VIEWS = 1000;

export type PrimaryMetric = { id: string; label: string; scope: string; weekly: (w: Week) => number | null; pooled: (weeks: Week[]) => number | null };

// The two-week test's primary outcome. Prefer Shorts-attributed conversion (the thing a
// Shorts strategy acts on) when YouTube's content-type split is available; otherwise the
// channel-level ratio, with the scope stated explicitly.
export function primaryMetric(contentTypeAvailable: boolean): PrimaryMetric {
  if (contentTypeAvailable) {
    return {
      id: "shorts_net_subs_per_1k",
      label: "Shorts-attributed net subscribers per 1,000 Shorts views",
      scope: "Video-attributed activity on Shorts (creatorContentType = SHORTS)",
      weekly: (w) => (w.shortsViews && w.shortsViews > 0 ? safeRatio(shortsNetSubs(w) ?? 0, w.shortsViews, 1000) : null),
      pooled: (weeks) => {
        const views = weeks.reduce((s, w) => s + (w.shortsViews ?? 0), 0);
        return views >= MIN_EXPERIMENT_SHORTS_VIEWS ? safeRatio(weeks.reduce((s, w) => s + (shortsNetSubs(w) ?? 0), 0), views, 1000) : null;
      },
    };
  }
  return {
    id: "net_subs_per_1k_views",
    label: "Channel net subscribers per 1,000 views",
    scope: "Whole channel (content-type split unavailable)",
    weekly: (w) => safeRatio(netSubs(w), w.views, 1000),
    pooled: (weeks) => safeRatio(weeks.reduce((s, w) => s + netSubs(w), 0), weeks.reduce((s, w) => s + w.views, 0), 1000),
  };
}

// Threshold from the creator's own recent variation: median ± MAD of the weekly metric
// over the 8 complete weeks before the test. Between the two → inconclusive.
export function decisionThresholds(baselineWeeks: Week[], metric: PrimaryMetric): { keepAbove: number | null; dropBelow: number | null } {
  const values = baselineWeeks.map(metric.weekly).filter((v): v is number => v !== null);
  if (values.length < 4) return { keepAbove: null, dropBelow: null };
  const m = median(values);
  const spread = mad(values);
  return { keepAbove: round(m + spread, 2), dropBelow: round(m - spread, 2) };
}

const COPY: Record<PathId, { assumption: string; schedule: (proven: number, tests: number, topics: string) => string[] }> = {
  A: {
    assumption: "More Shorts on your proven topics keep converting at your usual rate (no audience fatigue).",
    schedule: (proven, tests, topics) => [`Weeks 1–2: ${proven} Short${proven === 1 ? "" : "s"} a week on proven topics${topics ? ` (${topics})` : ""}`, ...(tests ? [`${tests} a week testing one new hook`] : [])],
  },
  B: {
    assumption: "Moving one or two Shorts a week to a new topic or hook doesn't lower conversion.",
    schedule: (proven, tests, topics) => [`Weeks 1–2: ${proven} Short${proven === 1 ? "" : "s"} a week on proven topics${topics ? ` (${topics})` : ""}`, `${tests} a week testing one new topic or hook — the same test both weeks`],
  },
  C: {
    assumption: "New topics or hooks can match your proven Shorts' conversion.",
    schedule: (proven, tests) => [`Weeks 1–2: ${tests} Short${tests === 1 ? "" : "s"} a week testing new topics or hooks`, ...(proven ? [`${proven} a week on a proven topic as the comparison`] : [])],
  },
};

export function buildExperiment(pathId: PathId, proven: number, tests: number, topics: string, metric: PrimaryMetric, thresholds: { keepAbove: number | null; dropBelow: number | null }): Experiment {
  const copy = COPY[pathId];
  const text = thresholds.keepAbove !== null && thresholds.dropBelow !== null
    ? `Keep the path if the two-week figure is above ${thresholds.keepAbove}; reconsider below ${thresholds.dropBelow}; anything between is inconclusive — your normal weekly swing.`
    : "Your recent weeks don't vary enough (or have too little data) to set a threshold — the result will be shown as inconclusive.";
  return {
    assumption: copy.assumption,
    schedule: copy.schedule(proven, tests, topics),
    primaryMetric: { id: metric.id, label: metric.label, scope: metric.scope },
    supportingMetrics: ["Views per week", "Watch minutes per view", "Net subscribers per week"],
    holdConstant: ["Posting days and times", "Shorts length and style", "Long-form output at its current level"],
    minimumData: `${EXPERIMENT_WEEKS} complete weeks and at least ${MIN_EXPERIMENT_SHORTS_VIEWS.toLocaleString("en-SG")} Shorts views.`,
    decisionRule: { metricId: metric.id, keepAbove: thresholds.keepAbove, dropBelow: thresholds.dropBelow, text: `${text} This is an observational content test, not a randomised experiment — topic, timing and format can move together.` },
  };
}

export function judgeExperiment(value: number | null, thresholds: { keepAbove: number | null; dropBelow: number | null }): "keep" | "drop" | "inconclusive" {
  if (value === null || thresholds.keepAbove === null || thresholds.dropBelow === null) return "inconclusive";
  if (value > thresholds.keepAbove) return "keep";
  if (value < thresholds.dropBelow) return "drop";
  return "inconclusive";
}

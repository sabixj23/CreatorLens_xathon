import { extractKeywords } from "../content-dna";
import { PATH_DEFS, weekMix } from "../simulation";
import type { Adherence, CheckpointResponse, Evidence, EvidenceStatus, PathId, PlanBaseline, PlanMode, PlanRecord } from "../types";
import { decompose, decompositionNote, evidenceFor, windowMetrics } from "./drivers";
import { decisionThresholds, judgeExperiment, primaryMetric, EXPERIMENT_WEEKS } from "./experiments";
import { provenShare } from "./hypotheses";
import { changePct, mad, mean, median, round } from "./stats";
import type { ChannelSnapshot, Week } from "./weeks";
import { addWeeks, describeRange, netSubs, weekEnd } from "./weeks";

// "Did the strategy work?" — the creator's channel in the 8 complete weeks before the
// plan started vs the complete weeks since, at checkpoints 2, 4, 8 and 12.

export const BASELINE_WEEKS = 8;
export const LOOKBACK_OPTIONS = [4, 8, 12] as const;
const MIN_WEEKS_FOR_VERDICT = 4;

const weeksBefore = (snapshot: ChannelSnapshot, startWeek: string) => snapshot.weeks.filter((w) => w.start < startWeek).slice(-BASELINE_WEEKS);
const weeksFrom = (snapshot: ChannelSnapshot, startWeek: string) => snapshot.weeks.filter((w) => w.start >= startWeek);

function shortsIn(snapshot: ChannelSnapshot, weeks: Week[]) {
  if (!weeks.length) return [];
  const from = Date.parse(`${weeks[0].start}T00:00:00Z`);
  const to = Date.parse(`${weeks[weeks.length - 1].start}T00:00:00Z`) + 7 * 86400000;
  return snapshot.videos.filter((v) => v.isShortResolved && Date.parse(v.publishedAt) >= from && Date.parse(v.publishedAt) < to);
}

function baselineOf(snapshot: ChannelSnapshot, weeks: Week[], provenTopics: string[]): PlanBaseline {
  const m = windowMetrics(weeks);
  const nets = weeks.map(netSubs);
  const share = provenShare(shortsIn(snapshot, weeks), provenTopics);
  return {
    window: describeRange(weeks),
    weeks: weeks.length,
    netSubsPerWeek: round(mean(nets), 1),
    netSubsMedian: round(median(nets), 1),
    netSubsMad: round(mad(nets), 1),
    viewsPerWeek: round(m.viewsPerWeek, 0),
    shortsPerWeek: round(m.shortsPerWeek, 1),
    netSubsPer1kViews: m.netSubsPer1kViews === null ? null : round(m.netSubsPer1kViews, 2),
    shortsNetSubsPer1kShortsViews: m.shortsNetSubsPer1k === null ? null : round(m.shortsNetSubsPer1k, 2),
    provenTopicShare: share === null ? null : round(share, 0),
  };
}

// Live: the plan starts this (in-progress) week. Look-back: it's treated as having
// started `lookbackWeeks` complete weeks ago, so every number shown is real history.
export function createPlanRecord(input: {
  snapshot: ChannelSnapshot;
  channelId: string;
  pathId: PathId;
  mode: PlanMode;
  lookbackWeeks?: number;
  provenTopics: string[];
}): PlanRecord {
  const { snapshot } = input;
  const last = snapshot.weeks[snapshot.weeks.length - 1];
  if (!last) throw new Error("No complete weeks of data yet.");
  const back = input.mode === "lookback" ? input.lookbackWeeks ?? 12 : 0;
  if (input.mode === "lookback" && !LOOKBACK_OPTIONS.includes(back as (typeof LOOKBACK_OPTIONS)[number])) throw new Error("Look-back must be 4, 8 or 12 weeks.");
  const startWeek = addWeeks(last.start, 1 - back);
  const baselineWeeks = weeksBefore(snapshot, startWeek);
  if (baselineWeeks.length < BASELINE_WEEKS) throw new Error(`Needs ${BASELINE_WEEKS} complete weeks before the start date (found ${baselineWeeks.length}).`);

  const baseline = baselineOf(snapshot, baselineWeeks, input.provenTopics);
  const def = PATH_DEFS.find((p) => p.id === input.pathId)!;
  const plannedShortsPerWeek = def.shorts(baseline.shortsPerWeek);
  return {
    v: 1,
    channelId: input.channelId,
    pathId: def.id,
    pathName: def.name,
    mode: input.mode,
    startWeek,
    plannedShortsPerWeek,
    plannedTestsPerWeek: def.tests(plannedShortsPerWeek),
    provenTopics: input.provenTopics,
    baseline,
    createdAt: new Date().toISOString(),
  };
}

const VERDICT_LABEL: Record<EvidenceStatus, string> = {
  supported: "Working",
  not_supported: "Not working",
  mixed: "Mixed / no clear change",
  insufficient_data: "Too early to tell",
};

export function evaluateCheckpoint(snapshot: ChannelSnapshot, record: PlanRecord, week: number): CheckpointResponse {
  const baselineWeeks = weeksBefore(snapshot, record.startWeek);
  const since = weeksFrom(snapshot, record.startWeek);
  const after = since.slice(0, week);
  const baseline = record.baseline;
  const windowText = { before: baseline.window, after: after.length ? describeRange(after) : `from ${record.startWeek}` };
  const shell = {
    week, mode: record.mode, pathName: record.pathName, window: windowText, mocked: false,
  };

  if (after.length < week) {
    const readyOn = weekEnd(addWeeks(record.startWeek, week - 1));
    return {
      ...shell, available: false, availableFrom: readyOn,
      verdict: { status: "insufficient_data", label: "Not yet", reason: `Week ${week} of the plan completes on ${readyOn}. ${since.length} complete week${since.length === 1 ? "" : "s"} so far.` },
      adherence: null, evidence: [], decomposition: null, decompositionNote: null, counterfactual: null, experiment: null,
      nextStep: "Keep following the weekly plan — this checkpoint fills in automatically once the week is complete.",
      caveats: [],
    };
  }

  // ── Adherence: did they actually run the plan? ──
  const shorts = shortsIn(snapshot, after);
  const postedTests = shorts.filter((v) => !extractKeywords(v.title).some((k) => record.provenTopics.includes(k))).length;
  const plannedShorts = record.plannedShortsPerWeek * week;
  const followedPct = plannedShorts > 0 ? Math.min(100, round((shorts.length / plannedShorts) * 100, 0)) : 100;
  const adherence: Adherence = {
    plannedShorts, postedShorts: shorts.length, plannedTests: record.plannedTestsPerWeek * week, postedTests,
    followedPct, status: followedPct >= 80 ? "followed" : followedPct >= 50 ? "partly" : "not_followed",
  };

  // ── Before vs after ──
  const before = windowMetrics(baselineWeeks);
  const now = windowMetrics(after);
  const afterShare = provenShare(shorts, record.provenTopics);
  const evidence: Evidence[] = [
    evidenceFor("net_subs_per_week", before, now),
    evidenceFor("views_per_week", before, now),
    evidenceFor("net_subs_per_1k_views", before, now),
    evidenceFor("shorts_per_week", before, now),
    snapshot.contentTypeAvailable ? evidenceFor("shorts_net_subs_per_1k", before, now) : null,
  ].filter((e): e is Evidence => e !== null);
  if (baseline.provenTopicShare !== null && afterShare !== null) {
    evidence.push({
      id: "proven_topic_share", metric: `Shorts on proven topics (${record.provenTopics.join(", ")})`, before: baseline.provenTopicShare, after: round(afterShare, 0),
      unit: "% of Shorts", window: windowText, sampleSize: shorts.length, source: "Data API titles", caveat: "Topics are auto-detected title keywords.",
    });
  }

  // ── Compared with carrying on as before ──
  const actual = after.reduce((s, w) => s + netSubs(w), 0);
  const expected = baseline.netSubsMedian * week;
  const spread = Math.max(1, baseline.netSubsMad * 1.4826 * Math.sqrt(week));
  const counterfactual = { expected: round(expected, 0), low: round(expected - spread, 0), high: round(expected + spread, 0), actual: round(actual, 0) };

  // ── Two-week test (first two weeks of the plan) ──
  const metric = primaryMetric(snapshot.contentTypeAvailable);
  const thresholds = decisionThresholds(baselineWeeks, metric);
  const testValue = metric.pooled(since.slice(0, EXPERIMENT_WEEKS));
  const experiment = { metricLabel: metric.label, value: testValue === null ? null : round(testValue, 2), ...thresholds, outcome: judgeExperiment(testValue, thresholds) };

  // ── Verdict ──
  const afterMedian = median(after.map(netSubs));
  const swing = Math.max(1, baseline.netSubsMad);
  const up = afterMedian > baseline.netSubsMedian + swing && actual > counterfactual.high;
  const down = afterMedian < baseline.netSubsMedian - swing && actual < counterfactual.low;
  const rate = changePct(baseline.netSubsPer1kViews, now.netSubsPer1kViews);
  let status: EvidenceStatus;
  let reason: string;
  if (week < MIN_WEEKS_FOR_VERDICT) {
    status = "insufficient_data";
    reason = experiment.outcome === "keep" ? "Early signal is positive: the two-week test cleared its threshold. A verdict needs at least 4 weeks."
      : experiment.outcome === "drop" ? "Early signal is negative: the two-week test fell below its threshold. A verdict needs at least 4 weeks."
      : "The two-week test is inconclusive — within your normal weekly swing. A verdict needs at least 4 weeks.";
  } else if (record.mode === "live" && adherence.status === "not_followed") {
    status = "insufficient_data";
    reason = `Only ${adherence.postedShorts} of ${adherence.plannedShorts} planned Shorts were posted, so this says nothing about the strategy itself.`;
  } else if (up && (rate === null || rate > -10)) {
    status = "supported";
    reason = `Net subscribers averaged ${round(now.netSubsPerWeek, 0)}/week vs ${round(baseline.netSubsPerWeek, 0)}/week before — above your normal weekly swing (±${round(swing, 0)}) and above what carrying on as before would have produced.`;
  } else if (down && (rate === null || rate < 10)) {
    status = "not_supported";
    reason = `Net subscribers averaged ${round(now.netSubsPerWeek, 0)}/week vs ${round(baseline.netSubsPerWeek, 0)}/week before — below your normal weekly swing and below the carry-on-as-before range.`;
  } else if (up || down) {
    status = "mixed";
    reason = "Subscriber totals and subscribers per 1,000 views moved in different directions — more reach, weaker conversion, or the reverse.";
  } else {
    status = "mixed";
    reason = `No clear change: weekly net subscribers stayed within your normal swing (±${round(swing, 0)}/week) of the ${round(baseline.netSubsMedian, 0)}/week baseline.`;
  }

  const nextCheckpoint = [2, 4, 8, 12].find((w) => w > week);
  const nextStep =
    status === "supported" ? `Keep the ${record.pathName} plan as it is${nextCheckpoint ? ` — next check at week ${nextCheckpoint}` : ""}.`
    : status === "not_supported" ? (record.pathId === "A" ? "Revisit the diagnosis: more of the same isn't lifting growth — try Balanced's bottleneck fix next." : "Pull the test slots back to proven topics (Double Down) and re-check in 4 weeks.")
    : week < MIN_WEEKS_FOR_VERDICT ? (experiment.outcome === "drop" ? "Consider swapping this week's test Short back to a proven topic, then re-check at week 4." : "Keep the plan unchanged until week 4 so the result stays readable.")
    : `Keep going${nextCheckpoint ? ` to week ${nextCheckpoint}` : ""} before changing course — one variable at a time.`;

  const caveats = [
    `Small sample: ${after.length} week${after.length === 1 ? "" : "s"} after vs ${baselineWeeks.length} before.`,
    "Seasonality, a single viral Short, or YouTube-side changes can move these numbers; this compares periods, it doesn't prove cause.",
    ...(snapshot.contentTypeAvailable ? ["Shorts-attributed figures exclude subscriptions made away from a video page."] : []),
    ...(record.mode === "lookback" ? [`Look-back mode: the plan wasn't actually in place — this measures what happened on your channel after ${record.startWeek}, against the plan it would have set.`] : []),
  ];

  return {
    ...shell, available: true, availableFrom: null,
    verdict: { status, label: VERDICT_LABEL[status], reason },
    adherence, evidence, decomposition: decompose(before, now), decompositionNote: decompositionNote(before, now), counterfactual, experiment, nextStep, caveats,
  };
}

export function plannedMix(record: PlanRecord) {
  return weekMix({ shortsPerWeek: record.plannedShortsPerWeek, testsPerWeek: record.plannedTestsPerWeek });
}

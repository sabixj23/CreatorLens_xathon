import { extractKeywords } from "../content-dna";
import type { ShortsStats } from "../format-stats";
import type { EvidenceStatus, Evidence, FormatComparison, Hypothesis, Level, OutlierSummary } from "../types";
import type { WindowMetrics } from "./drivers";
import { evidenceFor } from "./drivers";
import { changePct, round } from "./stats";
import type { ClassifiedVideo, Week } from "./weeks";
import { describeRange } from "./weeks";

export type HypothesisContext = {
  before: WindowMetrics | null;
  after: WindowMetrics | null;
  beforeWeeks: Week[];
  afterWeeks: Week[];
  formats: FormatComparison;
  outliers: OutlierSummary;
  shortsStats: ShortsStats;
  videos: ClassifiedVideo[];
};

const insufficient = (id: Hypothesis["id"], claim: string, note: string): Hypothesis => ({
  id, claim, status: "insufficient_data", strength: "low", evidenceFor: [], evidenceAgainst: [], note,
});

const ev = (e: Evidence | null): Evidence[] => (e ? [e] : []);

// Evidence strength from volume and agreement — not a probability of cause.
function strengthOf(weeks: number, agreeingChecks: number, volumeOk: boolean): Level {
  if (weeks >= 8 && agreeingChecks >= 2 && volumeOk) return "high";
  if (weeks >= 4 && agreeingChecks >= 1) return "medium";
  return "low";
}

// Fewer Shorts per week coincided with the slowdown.
function evaluateCadence(c: HypothesisContext): Hypothesis {
  const claim = "Posting fewer Shorts coincided with the slowdown.";
  if (!c.before || !c.after) return insufficient("cadence", claim, "Needs 16 complete weeks of history.");
  const cadence = changePct(c.before.shortsPerWeek, c.after.shortsPerWeek);
  const subsFell = c.after.netSubsPerWeek < c.before.netSubsPerWeek;
  const viewsPerShortBefore = c.before.shortsPerWeek > 0 && c.before.shortsViews !== null ? c.before.shortsViews / 8 / c.before.shortsPerWeek : null;
  const viewsPerShortAfter = c.after.shortsPerWeek > 0 && c.after.shortsViews !== null ? c.after.shortsViews / 8 / c.after.shortsPerWeek : null;
  const perShort = changePct(viewsPerShortBefore, viewsPerShortAfter);
  const perShortEvidence: Evidence | null = viewsPerShortBefore !== null && viewsPerShortAfter !== null ? {
    id: "shorts_views_per_short", metric: "Shorts views per Short posted", before: round(viewsPerShortBefore, 0), after: round(viewsPerShortAfter, 0),
    unit: "views/Short", window: { before: c.before.range, after: c.after.range }, sampleSize: 8, source: "Analytics · day × creatorContentType + uploads",
  } : null;

  let status: EvidenceStatus;
  if (cadence === null || c.before.shortsPerWeek < 0.5) status = "insufficient_data";
  else if (cadence <= -20 && subsFell) status = perShort !== null && perShort >= 20 ? "mixed" : "supported";
  else if (cadence <= -20 && !subsFell) status = "not_supported";
  else status = "not_supported";
  return {
    id: "cadence", claim, status,
    strength: status === "insufficient_data" ? "low" : strengthOf(8, status === "supported" ? 2 : 1, c.before.shortsPerWeek >= 1),
    evidenceFor: status === "supported" || status === "mixed" ? [...ev(evidenceFor("shorts_per_week", c.before, c.after)), ...ev(evidenceFor("net_subs_per_week", c.before, c.after))] : [],
    evidenceAgainst: status === "not_supported" || status === "mixed" ? [...ev(evidenceFor("shorts_per_week", c.before, c.after)), ...ev(perShortEvidence)] : [],
    note: status === "mixed" ? "Shorts cadence fell, but each Short earned more views — cadence alone doesn't explain it." : undefined,
  };
}

// The view mix moved toward Shorts while Shorts convert fewer net subscribers per view.
function evaluateFormatMix(c: HypothesisContext): Hypothesis {
  const claim = "Views shifted toward Shorts, which convert fewer net subscribers per 1,000 views than long-form.";
  if (!c.before || !c.after || !c.formats.available || !c.formats.shorts || !c.formats.longForm) {
    return insufficient("format_mix", claim, c.formats.available ? "Not enough Shorts and long-form volume to compare." : c.formats.note);
  }
  const shareBefore = c.before.shortsViewShare;
  const shareAfter = c.after.shortsViewShare;
  const shortsRate = c.formats.shorts.after.netSubsPer1kViews;
  const longRate = c.formats.longForm.after.netSubsPer1kViews;
  if (shareBefore === null || shareAfter === null || shortsRate === null || longRate === null) return insufficient("format_mix", claim, "Content-type rates unavailable.");
  const shareRose = shareAfter - shareBefore >= 5;
  const shortsConvertLower = shortsRate < longRate * 0.8;
  const totalRateFell = (changePct(c.before.netSubsPer1kViews, c.after.netSubsPer1kViews) ?? 0) <= -10;
  const agree = [shareRose, shortsConvertLower, totalRateFell].filter(Boolean).length;
  const status: EvidenceStatus = agree === 3 ? "supported" : agree === 2 ? "mixed" : "not_supported";
  const items = [...ev(evidenceFor("shorts_view_share", c.before, c.after)), ...ev(evidenceFor("shorts_net_subs_per_1k", c.before, c.after)), ...ev(evidenceFor("long_net_subs_per_1k", c.before, c.after))];
  return {
    id: "format_mix", claim, status, strength: strengthOf(8, agree, true),
    evidenceFor: status !== "not_supported" ? items : [],
    evidenceAgainst: status !== "supported" ? items : [],
  };
}

// Views held up but net subscribers per view fell — the problem is downstream of reach.
function evaluateConversion(c: HypothesisContext, decomposition: { reachEffect: number; rateEffect: number } | null): Hypothesis {
  const claim = "Views held up, but fewer viewers became (and stayed) subscribers.";
  if (!c.before || !c.after) return insufficient("conversion", claim, "Needs 16 complete weeks of history.");
  const views = changePct(c.before.viewsPerWeek, c.after.viewsPerWeek);
  const rate = changePct(c.before.netSubsPer1kViews, c.after.netSubsPer1kViews);
  if (views === null || rate === null) return insufficient("conversion", claim, "Rates couldn't be compared (near-zero earlier value).");
  const viewsHeld = views >= -10;
  const rateFell = rate <= -15;
  const reachDominates = decomposition ? Math.abs(decomposition.reachEffect) > Math.abs(decomposition.rateEffect) : false;
  const status: EvidenceStatus = viewsHeld && rateFell ? (reachDominates ? "mixed" : "supported") : rateFell ? "mixed" : "not_supported";
  const items = [...ev(evidenceFor("views_per_week", c.before, c.after)), ...ev(evidenceFor("net_subs_per_1k_views", c.before, c.after))];
  return {
    id: "conversion", claim, status, strength: strengthOf(8, status === "supported" ? 2 : 1, true),
    evidenceFor: status !== "not_supported" ? items : [],
    evidenceAgainst: status !== "supported" ? items : [],
    note: decomposition ? `Of the change in weekly net subscribers, about ${round(decomposition.reachEffect, 0)} is from views (reach) and ${round(decomposition.rateEffect, 0)} from subscribers per view (conversion) — arithmetic, not proof of cause.` : undefined,
  };
}

// The old baseline depended on a few hit Shorts.
function evaluateOutliers(c: HypothesisContext): Hypothesis {
  const claim = "Past growth leaned on a few hit Shorts rather than steady performance.";
  const o = c.outliers;
  if (o.suppressed || o.subsShareOfTop === null) return insufficient("outlier_dependence", claim, `Needs at least 10 Shorts in the cohort (found ${o.n}).`);
  const status: EvidenceStatus = o.subsShareOfTop >= 50 ? "supported" : o.subsShareOfTop >= 35 ? "mixed" : "not_supported";
  const e: Evidence = {
    id: "top_decile_subs_share", metric: `Share of video-attributed subscriber gains from the top ${o.topCount} of ${o.n} Shorts`,
    before: null, after: o.subsShareOfTop, unit: "%", window: { before: "—", after: o.cohort }, sampleSize: o.n,
    source: "Analytics · top videos report", caveat: "Per-video totals cover the whole Analytics window, so exposure time varies within the cohort.",
  };
  return { id: "outlier_dependence", claim, status, strength: o.n >= 30 ? "medium" : "low", evidenceFor: status !== "not_supported" ? [e] : [], evidenceAgainst: status !== "supported" ? [e] : [] };
}

export function provenShare(videos: ClassifiedVideo[], topics: string[]): number | null {
  if (videos.length === 0 || topics.length === 0) return null;
  const proven = videos.filter((v) => extractKeywords(v.title).some((k) => topics.includes(k))).length;
  return (proven / videos.length) * 100;
}

// Fewer Shorts on the channel's proven topics coincided with the change.
function evaluateTopicShift(c: HypothesisContext): Hypothesis {
  const claim = "Recent Shorts moved away from the topics that convert best for this channel.";
  const s = c.shortsStats;
  if (!c.beforeWeeks.length || !c.afterWeeks.length) return insufficient("topic_shift", claim, "Needs 16 complete weeks of history.");
  if (s.provenTopics.length === 0 || s.proven.videos < 5 || s.other.videos < 5) {
    return insufficient("topic_shift", claim, "Needs at least 5 Shorts both on and off the auto-detected proven topics.");
  }
  const inWindow = (weeks: Week[]) => {
    const from = Date.parse(`${weeks[0].start}T00:00:00Z`);
    const to = Date.parse(`${weeks[weeks.length - 1].start}T00:00:00Z`) + 7 * 86400000;
    return c.videos.filter((v) => v.isShortResolved && Date.parse(v.publishedAt) >= from && Date.parse(v.publishedAt) < to);
  };
  const beforeShorts = inWindow(c.beforeWeeks);
  const afterShorts = inWindow(c.afterWeeks);
  if (beforeShorts.length < 4 || afterShorts.length < 4) return insufficient("topic_shift", claim, "Too few Shorts in one of the windows.");
  const before = provenShare(beforeShorts, s.provenTopics)!;
  const after = provenShare(afterShorts, s.provenTopics)!;
  const shareFell = before - after >= 20;
  const provenConvertsBetter = s.provenRel >= 1.2 * s.otherRel;
  const status: EvidenceStatus = shareFell && provenConvertsBetter ? "supported" : shareFell || provenConvertsBetter ? "mixed" : "not_supported";
  const shareEvidence: Evidence = {
    id: "proven_topic_share", metric: `Shorts on proven topics (${s.provenTopics.join(", ")})`, before: round(before, 0), after: round(after, 0),
    unit: "% of Shorts", window: { before: describeRange(c.beforeWeeks), after: describeRange(c.afterWeeks) }, sampleSize: afterShorts.length,
    source: "Data API titles", caveat: "Topics are auto-detected title keywords, not hand-labelled.",
  };
  const gapEvidence: Evidence = {
    id: "proven_vs_other", metric: s.basis === "subscribers" ? "Subscribers per 1k views: proven-topic vs other Shorts" : "Average views: proven-topic vs other Shorts",
    before: s.basis === "subscribers" ? s.other.subsPerThousandViews : s.other.avgViews, after: s.basis === "subscribers" ? s.proven.subsPerThousandViews : s.proven.avgViews,
    unit: s.basis === "subscribers" ? "per 1k views (other → proven)" : "views (other → proven)", window: { before: "other Shorts", after: "proven-topic Shorts" },
    sampleSize: s.proven.videos + s.other.videos, source: s.basis === "subscribers" ? "Analytics · top videos report" : "Data API lifetime views",
    caveat: s.basis === "views" ? "Lifetime public views favour older videos." : undefined,
  };
  return {
    id: "topic_shift", claim, status, strength: strengthOf(8, [shareFell, provenConvertsBetter].filter(Boolean).length, afterShorts.length >= 8),
    evidenceFor: status !== "not_supported" ? [shareEvidence, gapEvidence] : [],
    evidenceAgainst: status !== "supported" ? [shareEvidence, gapEvidence] : [],
  };
}

const STATUS_RANK: Record<EvidenceStatus, number> = { supported: 0, mixed: 1, not_supported: 2, insufficient_data: 3 };
const STRENGTH_RANK: Record<Level, number> = { high: 0, medium: 1, low: 2 };

export function evaluateHypotheses(c: HypothesisContext, decomposition: { reachEffect: number; rateEffect: number } | null): Hypothesis[] {
  return [evaluateCadence(c), evaluateFormatMix(c), evaluateConversion(c, decomposition), evaluateOutliers(c), evaluateTopicShift(c)].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength]
  );
}

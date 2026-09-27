import type { DriverChange, DriverSummary, Evidence } from "../types";
import { changePct, round, safeRatio, sum } from "./stats";
import type { Week } from "./weeks";
import { describeRange, longNetSubs, netSubs, shortsNetSubs } from "./weeks";

export const DRIVER_WINDOW_WEEKS = 8;

// Sums first, then ratios — never an average of weekly averages.
export type WindowMetrics = {
  weeks: number;
  range: string;
  gained: number;
  lost: number;
  netSubs: number;
  netSubsPerWeek: number;
  viewsPerWeek: number;
  uploadsPerWeek: number;
  shortsPerWeek: number;
  netSubsPer1kViews: number | null; // channel-level ratio, not a per-video probability
  watchMinutesPerView: number | null;
  shortsViewShare: number | null; // % of content-type views that were Shorts
  shortsNetSubsPer1k: number | null; // content-type attributed
  longNetSubsPer1k: number | null;
  shortsViews: number | null;
  longViews: number | null;
};

export function windowMetrics(weeks: Week[]): WindowMetrics {
  const n = Math.max(1, weeks.length);
  const views = sum(weeks.map((w) => w.views));
  const net = sum(weeks.map(netSubs));
  const typed = weeks.length > 0 && weeks.every((w) => w.shortsViews !== null && w.longViews !== null);
  const shortsViews = typed ? sum(weeks.map((w) => w.shortsViews ?? 0)) : null;
  const longViews = typed ? sum(weeks.map((w) => w.longViews ?? 0)) : null;
  const shortsNet = typed ? sum(weeks.map((w) => shortsNetSubs(w) ?? 0)) : null;
  const longNet = typed ? sum(weeks.map((w) => longNetSubs(w) ?? 0)) : null;
  return {
    weeks: weeks.length,
    range: describeRange(weeks),
    gained: sum(weeks.map((w) => w.subscribersGained)),
    lost: sum(weeks.map((w) => w.subscribersLost)),
    netSubs: net,
    netSubsPerWeek: net / n,
    viewsPerWeek: views / n,
    uploadsPerWeek: sum(weeks.map((w) => w.uploads)) / n,
    shortsPerWeek: sum(weeks.map((w) => w.shortsUploads)) / n,
    netSubsPer1kViews: safeRatio(net, views, 1000),
    watchMinutesPerView: safeRatio(sum(weeks.map((w) => w.watchMinutes)), views),
    shortsViewShare: shortsViews !== null && longViews !== null ? safeRatio(shortsViews, shortsViews + longViews, 100) : null,
    shortsNetSubsPer1k: shortsViews !== null && shortsNet !== null ? safeRatio(shortsNet, shortsViews, 1000) : null,
    longNetSubsPer1k: longViews !== null && longNet !== null ? safeRatio(longNet, longViews, 1000) : null,
    shortsViews,
    longViews,
  };
}

// Symmetric decomposition of the change in weekly net subscribers:
//   netSubs/week = views/week × netSubs per view
// reachEffect + rateEffect = after − before exactly. Arithmetic attribution only.
export function decompositionNote(before: WindowMetrics, after: WindowMetrics): string | null {
  if (before.viewsPerWeek <= 0 || after.viewsPerWeek <= 0) return "No views in one of the periods, so the change can't be split into reach and conversion.";
  if (before.netSubsPerWeek <= 0 || after.netSubsPerWeek <= 0) return "Net subscribers per view is zero or negative in at least one period (as many or more unsubscribes as new subscribers), so splitting the change into reach vs conversion wouldn't mean anything. The raw changes are shown instead.";
  return null;
}

export function decompose(before: WindowMetrics, after: WindowMetrics): DriverSummary["decomposition"] {
  if (before.viewsPerWeek <= 0 || after.viewsPerWeek <= 0) return null;
  const rateBefore = before.netSubsPerWeek / before.viewsPerWeek;
  const rateAfter = after.netSubsPerWeek / after.viewsPerWeek;
  if (rateBefore <= 0 || rateAfter <= 0) return null; // no meaningful "rate" to split on
  const reachEffect = (after.viewsPerWeek - before.viewsPerWeek) * (rateBefore + rateAfter) / 2;
  const rateEffect = (rateAfter - rateBefore) * (before.viewsPerWeek + after.viewsPerWeek) / 2;
  return { reachEffect: round(reachEffect), rateEffect: round(rateEffect), totalChange: round(after.netSubsPerWeek - before.netSubsPerWeek) };
}

// kind "rate": a % change is only shown when both values are positive (a % change between
// negative rates reads as nonsense). minBase: below this earlier value a % change is noise
// (e.g. −1.25 → −0.9 subscribers/week is not "+25%"), so the absolute change is shown.
type MetricDef = { id: string; label: string; unit: string; get: (m: WindowMetrics) => number | null; digits: number; source: string; kind?: "rate"; minBase?: number };

export const METRICS: MetricDef[] = [
  { id: "net_subs_per_week", label: "Net subscribers per week", unit: "subs/week", get: (m) => m.netSubsPerWeek, digits: 0, source: "Analytics · day report", minBase: 5 },
  { id: "views_per_week", label: "Views per week", unit: "views/week", get: (m) => m.viewsPerWeek, digits: 0, source: "Analytics · day report", minBase: 50 },
  { id: "net_subs_per_1k_views", label: "Net subscribers per 1,000 views", unit: "per 1k views", get: (m) => m.netSubsPer1kViews, digits: 2, source: "Analytics · day report", kind: "rate" },
  { id: "shorts_per_week", label: "Shorts posted per week", unit: "Shorts/week", get: (m) => m.shortsPerWeek, digits: 1, source: "Data API uploads" },
  { id: "uploads_per_week", label: "All uploads per week", unit: "uploads/week", get: (m) => m.uploadsPerWeek, digits: 1, source: "Data API uploads" },
  { id: "shorts_view_share", label: "Shorts share of views", unit: "%", get: (m) => m.shortsViewShare, digits: 0, source: "Analytics · day × creatorContentType" },
  { id: "shorts_net_subs_per_1k", label: "Shorts-attributed net subs per 1,000 Shorts views", unit: "per 1k Shorts views", get: (m) => m.shortsNetSubsPer1k, digits: 2, source: "Analytics · day × creatorContentType", kind: "rate" },
  { id: "long_net_subs_per_1k", label: "Long-form-attributed net subs per 1,000 long-form views", unit: "per 1k long-form views", get: (m) => m.longNetSubsPer1k, digits: 2, source: "Analytics · day × creatorContentType", kind: "rate" },
  { id: "watch_minutes_per_view", label: "Watch minutes per view", unit: "min/view", get: (m) => m.watchMinutesPerView, digits: 2, source: "Analytics · day report" },
];

const ATTRIBUTION_CAVEAT = "Content-type figures are attributed activity; subscriptions made away from a video page aren't included.";

export function evidenceFor(id: string, before: WindowMetrics, after: WindowMetrics): Evidence | null {
  const def = METRICS.find((m) => m.id === id);
  if (!def) return null;
  const b = def.get(before);
  const a = def.get(after);
  return {
    id,
    metric: def.label,
    before: b === null ? null : round(b, def.digits),
    after: a === null ? null : round(a, def.digits),
    unit: def.unit,
    window: { before: before.range, after: after.range },
    sampleSize: after.weeks,
    source: def.source,
    caveat: def.source.includes("creatorContentType") ? ATTRIBUTION_CAVEAT : undefined,
  };
}

function metricPct(def: MetricDef, b: number | null, a: number | null): number | null {
  if (b === null || a === null) return null;
  if (def.kind === "rate" && (b <= 0 || a <= 0)) return null;
  if (def.minBase !== undefined && Math.abs(b) < def.minBase) return null;
  return changePct(b, a);
}

// A change in weekly net subscribers only counts if it's at least 3 subscribers a week
// AND at least 10% — so a channel hovering around zero isn't told it "rose".
const meaningfulSubsChange = (before: number, after: number) => Math.abs(after - before) >= Math.max(3, 0.1 * Math.abs(before));

function statement(before: WindowMetrics, after: WindowMetrics): string {
  const subsMoved = meaningfulSubsChange(before.netSubsPerWeek, after.netSubsPerWeek);
  const views = changePct(before.viewsPerWeek, after.viewsPerWeek);
  const rate = changePct(before.netSubsPer1kViews, after.netSubsPer1kViews);
  const subsDown = subsMoved && after.netSubsPerWeek < before.netSubsPerWeek;
  const subsUp = subsMoved && after.netSubsPerWeek > before.netSubsPerWeek;
  const viewsStable = views !== null && Math.abs(views) < 10;
  const viewsDown = views !== null && views <= -10;
  const rateDown = rate !== null && rate <= -10;
  if (subsDown && viewsStable && rateDown) return "Subscriber gains fell while views stayed similar; net subscribers per 1,000 views declined.";
  if (subsDown && viewsDown && !rateDown) return "Net subscribers fell mainly because views fell; net subscribers per 1,000 views held roughly steady.";
  if (subsDown && viewsDown && rateDown) return "Both reach and conversion fell: fewer views, and fewer net subscribers per 1,000 views.";
  if (subsDown) return "Net subscribers per week fell compared with the previous eight weeks.";
  if (subsUp) return "Net subscribers per week rose compared with the previous eight weeks.";
  const level = Math.round(after.netSubsPerWeek);
  const around = level === 0 ? "around zero" : `around ${level} a week`;
  if (views !== null && Math.abs(views) >= 10) {
    return `Views ${views > 0 ? "rose" : "fell"} (${Math.round(before.viewsPerWeek).toLocaleString("en-SG")} → ${Math.round(after.viewsPerWeek).toLocaleString("en-SG")} a week), but net subscribers stayed ${around}.`;
  }
  return `Net subscribers per week stayed ${around} — no meaningful change from the previous eight weeks.`;
}

// Most recent 8 complete weeks vs the 8 before. Needs 16 complete weeks; otherwise null
// (the report shows a limited-history notice and suppresses these claims).
export function analyseDrivers(weeks: Week[]): { summary: DriverSummary; before: WindowMetrics; after: WindowMetrics } | null {
  if (weeks.length < DRIVER_WINDOW_WEEKS * 2) return null;
  const before = windowMetrics(weeks.slice(-DRIVER_WINDOW_WEEKS * 2, -DRIVER_WINDOW_WEEKS));
  const after = windowMetrics(weeks.slice(-DRIVER_WINDOW_WEEKS));

  const changes: DriverChange[] = METRICS.map((def) => {
    const b = def.get(before);
    const a = def.get(after);
    return {
      id: def.id,
      label: def.label,
      before: b === null ? null : round(b, def.digits),
      after: a === null ? null : round(a, def.digits),
      unit: def.unit,
      changePct: metricPct(def, b, a) === null ? null : round(metricPct(def, b, a)!, 0),
      absoluteChange: b === null || a === null ? null : round(a - b, def.digits),
    };
  })
    .filter((c) => c.before !== null && c.after !== null)
    // Unchanged rows (e.g. 0 → 0 uploads) aren't "changes".
    .filter((c) => c.absoluteChange !== 0)
    // Rank by size of relative change; changes without a usable % go last.
    .sort((x, y) => Math.abs(y.changePct ?? 0) - Math.abs(x.changePct ?? 0));

  return {
    summary: {
      windows: { before: before.range, after: after.range, weeksEach: DRIVER_WINDOW_WEEKS },
      statement: statement(before, after),
      changes,
      decomposition: decompose(before, after),
      decompositionNote: decompositionNote(before, after),
    },
    before,
    after,
  };
}

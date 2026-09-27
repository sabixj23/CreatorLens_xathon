import type { FormatComparison, FormatWindow, OutlierSummary } from "../types";
import { round, safeRatio, sum } from "./stats";
import type { ChannelSnapshot, Week } from "./weeks";
import { longNetSubs, netSubs, shortsNetSubs } from "./weeks";

const MIN_VIEWS = 1000;
const MIN_WEEKS = 4;

function formatWindow(weeks: Week[], kind: "shorts" | "long"): FormatWindow {
  const views = sum(weeks.map((w) => (kind === "shorts" ? w.shortsViews : w.longViews) ?? 0));
  const net = sum(weeks.map((w) => (kind === "shorts" ? shortsNetSubs(w) : longNetSubs(w)) ?? 0));
  const per1k = safeRatio(net, views, 1000);
  return {
    views,
    netSubs: net,
    netSubsPer1kViews: per1k === null ? null : round(per1k, 2),
    uploads: sum(weeks.map((w) => (kind === "shorts" ? w.shortsUploads : w.longUploads))),
  };
}

// Shorts vs long-form over the same before/after windows as the driver tree, from
// YouTube's creatorContentType split. A format is compared only with real volume.
export function compareFormats(before: Week[], after: Week[], contentTypeAvailable: boolean): FormatComparison {
  if (!contentTypeAvailable || before.length < MIN_WEEKS || after.length < MIN_WEEKS) {
    return {
      available: false, shorts: null, longForm: null, reconciliationPct: null,
      note: contentTypeAvailable ? "Not enough complete weeks to compare formats." : "YouTube's content-type report wasn't available, so format figures are omitted rather than guessed.",
    };
  }
  const pair = (kind: "shorts" | "long") => {
    const b = formatWindow(before, kind);
    const a = formatWindow(after, kind);
    return b.views >= MIN_VIEWS && a.views >= MIN_VIEWS ? { before: b, after: a } : null;
  };
  const all = [...before, ...after];
  const channelNet = sum(all.map(netSubs));
  const attributed = sum(all.map((w) => (shortsNetSubs(w) ?? 0) + (longNetSubs(w) ?? 0)));
  const reconciliationPct = channelNet > 0 ? round((attributed / channelNet) * 100, 0) : null;
  return {
    available: true,
    shorts: pair("shorts"),
    longForm: pair("long"),
    reconciliationPct,
    note: `Attributed activity by content type${reconciliationPct !== null ? ` — accounts for ${reconciliationPct}% of channel net subscribers in these weeks` : ""}. Subscriptions made away from a video page aren't attributed to a format.`,
  };
}

// How concentrated video-attributed outcomes are in the top 10% of one cohort: Shorts
// published between 26 and 8 weeks before the data end, so each has had at least eight
// weeks of exposure. Per-video totals cover the shared Analytics window, so exposure
// still varies within the cohort. Suppressed below 10 videos.
export function analyseOutliers(snapshot: ChannelSnapshot): OutlierSummary {
  const end = Date.parse(`${snapshot.dataThrough}T00:00:00Z`);
  const from = end - 26 * 7 * 86400000;
  const to = end - 8 * 7 * 86400000;
  const stats = new Map(snapshot.videoAnalytics.map((v) => [v.videoId, v]));
  const cohort = snapshot.videos
    .filter((v) => v.isShortResolved)
    .filter((v) => {
      const t = Date.parse(v.publishedAt);
      return t >= from && t <= to;
    })
    .map((v) => stats.get(v.id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  const n = cohort.length;
  const topCount = Math.ceil(0.1 * n);
  const label = "Shorts published 26–8 weeks before the latest complete week";
  if (n < 10) return { cohort: label, n, topCount, subsShareOfTop: null, viewsShareOfTop: null, suppressed: true };

  const share = (key: "subscribersGained" | "views") => {
    const total = sum(cohort.map((v) => v[key]));
    const top = sum([...cohort].sort((a, b) => b[key] - a[key]).slice(0, topCount).map((v) => v[key]));
    return total > 0 ? round((top / total) * 100, 0) : null;
  };
  return { cohort: label, n, topCount, subsShareOfTop: share("subscribersGained"), viewsShareOfTop: share("views"), suppressed: false };
}

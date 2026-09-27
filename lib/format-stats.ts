import { extractKeywords, topTopics } from "./content-dna";
import { MIN_SHORTS } from "./types";
import type { OwnVideo, VideoAnalytics } from "./youtube";

// Computed only from the connected channel's own videos — no other channels.
// - FormatStats: Shorts vs long-form, as whole-channel context for the diagnosis.
// - ShortsStats: Shorts on the channel's proven topics vs its other Shorts — what the
//   three Shorts growth paths and their trade-offs are grounded in.

export type FormatName = "Shorts" | "Long-form";

export type FormatStat = {
  format: FormatName;
  videos: number;
  avgViews: number;
  // From the Analytics per-video report; null when that report wasn't available.
  subsPerThousandViews: number | null;
  avgViewDurationSec: number | null;
};

export type FormatStats = {
  shorts: FormatStat;
  longForm: FormatStat;
  // The format that performs better on this channel: subscriber conversion when the
  // Analytics report is available, otherwise average views. Null with no videos at all.
  stronger: FormatName | null;
  // How `stronger` was decided, so trade-off text can quote the right metric.
  basis: "subscribers" | "views" | null;
};

function statFor(format: FormatName, list: OwnVideo[], byId: Map<string, VideoAnalytics>): FormatStat {
  const views = list.reduce((sum, v) => sum + v.viewCount, 0);
  const matched = list.map((v) => byId.get(v.id)).filter((v): v is VideoAnalytics => Boolean(v));
  const matchedViews = matched.reduce((sum, v) => sum + v.views, 0);
  const subs = matched.reduce((sum, v) => sum + v.subscribersGained, 0);
  // View-weighted, so a long video with a handful of views doesn't dominate.
  const duration = matchedViews > 0 ? matched.reduce((sum, v) => sum + v.averageViewDurationSec * v.views, 0) / matchedViews : 0;
  return {
    format,
    videos: list.length,
    avgViews: list.length ? Math.round(views / list.length) : 0,
    subsPerThousandViews: matchedViews > 0 ? Math.round((subs / matchedViews) * 1000 * 10) / 10 : null,
    avgViewDurationSec: matchedViews > 0 ? Math.round(duration) : null,
  };
}

export function buildFormatStats(videos: OwnVideo[], videoAnalytics: VideoAnalytics[]): FormatStats {
  const byId = new Map(videoAnalytics.map((v) => [v.videoId, v]));
  const shorts = statFor("Shorts", videos.filter((v) => v.isShort), byId);
  const longForm = statFor("Long-form", videos.filter((v) => !v.isShort), byId);

  if (shorts.videos === 0 && longForm.videos === 0) return { shorts, longForm, stronger: null, basis: null };
  if (shorts.videos === 0) return { shorts, longForm, stronger: "Long-form", basis: "views" };
  if (longForm.videos === 0) return { shorts, longForm, stronger: "Shorts", basis: "views" };

  if (shorts.subsPerThousandViews !== null && longForm.subsPerThousandViews !== null) {
    return { shorts, longForm, stronger: shorts.subsPerThousandViews > longForm.subsPerThousandViews ? "Shorts" : "Long-form", basis: "subscribers" };
  }
  return { shorts, longForm, stronger: shorts.avgViews > longForm.avgViews ? "Shorts" : "Long-form", basis: "views" };
}

// One line per format for the diagnosis/chat prompts.
export function describeFormatStats(stats: FormatStats): string {
  const line = (s: FormatStat) => {
    if (s.videos === 0) return `${s.format}: no videos`;
    const extras = [
      s.subsPerThousandViews !== null ? `${s.subsPerThousandViews} subscribers per 1k views` : null,
      s.avgViewDurationSec !== null ? `${s.avgViewDurationSec}s average view duration` : null,
    ].filter(Boolean);
    return `${s.format}: ${s.videos} videos, ${s.avgViews} average views${extras.length ? `, ${extras.join(", ")}` : ""}`;
  };
  return `${line(stats.longForm)}; ${line(stats.shorts)}`;
}

// ─── Shorts: proven topics vs everything else ────────────────────────────────


export type ShortsGroup = { videos: number; avgViews: number; subsPerThousandViews: number | null };

export type ShortsStats = {
  count: number;
  enough: boolean;
  // Title keywords whose Shorts beat the channel's average Short (see pickProvenTopics).
  provenTopics: string[];
  proven: ShortsGroup; // Shorts whose title mentions a proven topic
  other: ShortsGroup; // every other Short
  basis: "subscribers" | "views";
  // Each group's performance relative to the channel's average Short (1 = average).
  // Unknown groups (no videos) count as average rather than inventing a number.
  provenRel: number;
  otherRel: number;
};

function group(list: OwnVideo[], byId: Map<string, VideoAnalytics>): ShortsGroup {
  const views = list.reduce((sum, v) => sum + v.viewCount, 0);
  const matched = list.map((v) => byId.get(v.id)).filter((v): v is VideoAnalytics => Boolean(v));
  const matchedViews = matched.reduce((sum, v) => sum + v.views, 0);
  const subs = matched.reduce((sum, v) => sum + v.subscribersGained, 0);
  return {
    videos: list.length,
    avgViews: list.length ? Math.round(views / list.length) : 0,
    subsPerThousandViews: matchedViews > 0 ? Math.round((subs / matchedViews) * 1000 * 10) / 10 : null,
  };
}

// A "proven topic" is a title keyword whose Shorts outperform the channel's average
// Short — not just the most frequent keyword. Words in most titles (a channel's
// recurring "recipe" or "quick") can't separate good Shorts from the rest, and words in
// only one or two Shorts are too thin to call proven, so both are skipped.
function pickProvenTopics(shorts: OwnVideo[], metric: (list: OwnVideo[]) => number, overall: number): string[] {
  const byKeyword = new Map<string, OwnVideo[]>();
  for (const video of shorts) {
    for (const keyword of new Set(extractKeywords(video.title))) {
      byKeyword.set(keyword, [...(byKeyword.get(keyword) ?? []), video]);
    }
  }
  const minCount = Math.max(3, Math.ceil(shorts.length * 0.05));
  const maxCount = Math.floor(shorts.length * 0.6);
  const scored = [...byKeyword.entries()]
    .filter(([, list]) => list.length >= minCount && list.length <= maxCount)
    .map(([keyword, list]) => ({ keyword, score: metric(list) }))
    .filter((k) => k.score > overall)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((k) => k.keyword);
}

export function buildShortsStats(videos: OwnVideo[], videoAnalytics: VideoAnalytics[]): ShortsStats {
  const byId = new Map(videoAnalytics.map((v) => [v.videoId, v]));
  const shorts = videos.filter((v) => v.isShort);
  const all = group(shorts, byId);

  // Subscriber conversion when the Analytics report covers these Shorts, else views.
  const bySubs = (all.subsPerThousandViews ?? 0) > 0;
  const metricOf = (g: ShortsGroup) => (bySubs ? g.subsPerThousandViews ?? 0 : g.avgViews);
  const overall = metricOf(all);

  // Fall back to the most-viewed keywords when no keyword clearly beats the average.
  const picked = pickProvenTopics(shorts, (list) => metricOf(group(list, byId)), overall);
  const provenTopics = picked.length ? picked : topTopics(shorts);
  const isProven = (v: OwnVideo) => extractKeywords(v.title).some((k) => provenTopics.includes(k));
  const proven = group(shorts.filter(isProven), byId);
  const other = group(shorts.filter((v) => !isProven(v)), byId);
  const rel = (g: ShortsGroup) => (g.videos > 0 && overall > 0 ? metricOf(g) / overall : 1);

  return {
    count: shorts.length,
    enough: shorts.length >= MIN_SHORTS,
    provenTopics,
    proven,
    other,
    basis: bySubs ? "subscribers" : "views",
    provenRel: Math.round(rel(proven) * 100) / 100,
    otherRel: Math.round(rel(other) * 100) / 100,
  };
}

const compact = (n: number) => new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// e.g. "6.8 vs 1.9 subscribers per 1k views" or "48.2K vs 31.6K average views"
export function describeShortsGap(a: ShortsGroup, b: ShortsGroup, basis: ShortsStats["basis"]): string | null {
  if (a.videos === 0 || b.videos === 0) return null;
  return basis === "subscribers"
    ? `${a.subsPerThousandViews} vs ${b.subsPerThousandViews} subscribers per 1k views`
    : `${compact(a.avgViews)} vs ${compact(b.avgViews)} average views`;
}

export function describeShortsStats(stats: ShortsStats): string {
  if (stats.count === 0) return "No Shorts posted yet.";
  const topics = stats.provenTopics.join(", ") || "none detected";
  const gap = describeShortsGap(stats.proven, stats.other, stats.basis);
  return `${stats.count} Shorts. Proven Shorts topics (title keywords whose Shorts beat this channel's average Short on ${stats.basis === "subscribers" ? "subscribers per 1k views" : "average views"}): ${topics}. Shorts on those topics: ${stats.proven.videos}; other Shorts: ${stats.other.videos}${gap ? ` — proven vs other: ${gap}` : ""}.`;
}

import type { ShortsStats } from "../format-stats";
import type { ChannelAnalysis } from "../types";
import { detectChangePoints } from "./change-detection";
import { analyseDrivers, DRIVER_WINDOW_WEEKS } from "./drivers";
import { analyseOutliers, compareFormats } from "./formats";
import { evaluateHypotheses, provenShare } from "./hypotheses";
import { median } from "./stats";
import type { ChannelSnapshot } from "./weeks";

// Deterministic channel analysis. Everything the diagnosis LLM sees comes from here; it
// may narrate these findings but never changes a status or a number.
export function analyseChannel(snapshot: ChannelSnapshot, shortsStats: ShortsStats): ChannelAnalysis {
  const weeks = snapshot.weeks;
  const drivers = analyseDrivers(weeks);
  const beforeWeeks = drivers ? weeks.slice(-DRIVER_WINDOW_WEEKS * 2, -DRIVER_WINDOW_WEEKS) : [];
  const afterWeeks = drivers ? weeks.slice(-DRIVER_WINDOW_WEEKS) : [];
  const formats = compareFormats(beforeWeeks, afterWeeks, snapshot.contentTypeAvailable);
  const outliers = analyseOutliers(snapshot);
  const hypotheses = evaluateHypotheses(
    { before: drivers?.before ?? null, after: drivers?.after ?? null, beforeWeeks, afterWeeks, formats, outliers, shortsStats, videos: snapshot.videos },
    drivers?.summary.decomposition ?? null
  );
  return {
    dataThrough: snapshot.dataThrough,
    completeWeeks: weeks.length,
    limitedHistory: drivers === null,
    contentTypeAvailable: snapshot.contentTypeAvailable,
    drivers: drivers?.summary ?? null,
    changePoints: detectChangePoints(weeks),
    formats,
    outliers,
    hypotheses,
    provenTopics: shortsStats.provenTopics,
  };
}

// Median video-attributed subscriber gains per Short, over Shorts with at least eight
// weeks of exposure (published 26–8 weeks before the data end). null below 5 Shorts.
export function perShortSubscribers(snapshot: ChannelSnapshot): number | null {
  const end = Date.parse(`${snapshot.dataThrough}T00:00:00Z`);
  const stats = new Map(snapshot.videoAnalytics.map((v) => [v.videoId, v]));
  const gains = snapshot.videos
    .filter((v) => v.isShortResolved)
    .filter((v) => {
      const age = end - Date.parse(v.publishedAt);
      return age >= 8 * 7 * 86400000 && age <= 26 * 7 * 86400000;
    })
    .map((v) => stats.get(v.id)?.subscribersGained)
    .filter((g): g is number => g !== undefined);
  return gains.length >= 5 ? median(gains) : null;
}

// Share (0-1) of the last 8 complete weeks' Shorts that were on proven topics.
export function recentProvenShare(snapshot: ChannelSnapshot, topics: string[]): number | null {
  const recent = snapshot.weeks.slice(-8);
  if (!recent.length) return null;
  const from = Date.parse(`${recent[0].start}T00:00:00Z`);
  const shorts = snapshot.videos.filter((v) => v.isShortResolved && Date.parse(v.publishedAt) >= from);
  const share = provenShare(shorts, topics);
  return share === null ? null : share / 100;
}

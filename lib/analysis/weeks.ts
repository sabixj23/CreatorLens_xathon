import type { DailyAnalytics, DailyContentTypeAnalytics, OwnVideo, VideoAnalytics } from "../youtube";

// Canonical weekly model. Every analysis works on COMPLETE weeks only, with fixed UTC
// Monday boundaries shared by every report, so before/after windows are comparable.

export type Week = {
  start: string; // Monday, YYYY-MM-DD (UTC)
  complete: true; // incomplete weeks are dropped, never kept with partial data
  views: number;
  subscribersGained: number;
  subscribersLost: number;
  watchMinutes: number;
  uploads: number;
  shortsUploads: number;
  longUploads: number;
  // From the creatorContentType report — null when that report was unavailable.
  shortsViews: number | null;
  shortsSubscribersGained: number | null;
  shortsSubscribersLost: number | null;
  longViews: number | null;
  longSubscribersGained: number | null;
  longSubscribersLost: number | null;
};

export type ClassifiedVideo = OwnVideo & { isShortResolved: boolean; typeSource: "analytics" | "duration" };

export type ChannelSnapshot = {
  weeks: Week[];
  videos: ClassifiedVideo[];
  videoAnalytics: VideoAnalytics[];
  dataThrough: string; // last day of data covered by the complete weeks
  retrievedAt: string;
  contentTypeAvailable: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);

// Monday 00:00 UTC of the week containing `ms`.
export function mondayOf(ms: number): number {
  const d = new Date(ms);
  const weekday = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - weekday * DAY_MS;
}

export const addWeeks = (weekStart: string, n: number) => iso(dayMs(weekStart) + n * WEEK_MS);
export const weekEnd = (weekStart: string) => iso(dayMs(weekStart) + 6 * DAY_MS);
export const describeRange = (weeks: Week[]) => (weeks.length ? `${weeks[0].start} to ${weekEnd(weeks[weeks.length - 1].start)}` : "no weeks");

// YouTube's own content type when the per-video report provided it; otherwise the
// duration rule (≤ 180 s). Live streams count as neither Short nor long-form upload.
function classify(videos: OwnVideo[], videoAnalytics: VideoAnalytics[]): ClassifiedVideo[] {
  const types = new Map(videoAnalytics.filter((v) => v.contentType).map((v) => [v.videoId, v.contentType as string]));
  const seen = new Set<string>();
  const out: ClassifiedVideo[] = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    const type = types.get(video.id);
    out.push(type
      ? { ...video, isShortResolved: type === "SHORTS", typeSource: "analytics" }
      : { ...video, isShortResolved: video.isShort, typeSource: "duration" });
  }
  return out;
}

export function buildSnapshot(input: {
  daily: DailyAnalytics[];
  contentType: DailyContentTypeAnalytics[] | null;
  videos: OwnVideo[];
  videosComplete: boolean;
  videoAnalytics: VideoAnalytics[];
}): ChannelSnapshot {
  const videos = classify(input.videos, input.videoAnalytics);
  const retrievedAt = new Date().toISOString();
  const empty: ChannelSnapshot = { weeks: [], videos, videoAnalytics: input.videoAnalytics, dataThrough: "", retrievedAt, contentTypeAvailable: input.contentType !== null };
  if (input.daily.length === 0) return empty;

  const dates = input.daily.map((d) => dayMs(d.date)).sort((a, b) => a - b);
  const firstDay = dates[0];
  const lastDay = dates[dates.length - 1];
  // First full week starts on the first Monday on/after the first day of data; the last
  // full week must end on or before the last day of data (drops the partial current week).
  let firstWeek = mondayOf(firstDay);
  if (firstWeek < firstDay) firstWeek += WEEK_MS;
  if (!input.videosComplete && videos.length) {
    // Weeks older than the oldest fetched upload would read as "0 uploads" — drop them.
    const oldest = Math.min(...videos.map((v) => Date.parse(v.publishedAt)));
    while (firstWeek < mondayOf(oldest) + WEEK_MS && firstWeek <= lastDay) firstWeek += WEEK_MS;
  }
  // Latest Monday whose Sunday is still covered by the data.
  let lastWeekStart = mondayOf(lastDay);
  if (lastWeekStart + 6 * DAY_MS > lastDay) lastWeekStart -= WEEK_MS;

  const weekIndex = (ms: number) => Math.floor((ms - firstWeek) / WEEK_MS);
  const count = lastWeekStart >= firstWeek ? weekIndex(lastWeekStart) + 1 : 0;
  if (count <= 0) return empty;

  const hasTypes = input.contentType !== null;
  const weeks: Week[] = Array.from({ length: count }, (_, i) => ({
    start: iso(firstWeek + i * WEEK_MS), complete: true,
    views: 0, subscribersGained: 0, subscribersLost: 0, watchMinutes: 0,
    uploads: 0, shortsUploads: 0, longUploads: 0,
    shortsViews: hasTypes ? 0 : null, shortsSubscribersGained: hasTypes ? 0 : null, shortsSubscribersLost: hasTypes ? 0 : null,
    longViews: hasTypes ? 0 : null, longSubscribersGained: hasTypes ? 0 : null, longSubscribersLost: hasTypes ? 0 : null,
  }));
  const at = (date: string) => {
    const i = weekIndex(dayMs(date));
    return i >= 0 && i < count ? weeks[i] : null;
  };

  for (const day of input.daily) {
    const w = at(day.date);
    if (!w) continue;
    w.views += day.views;
    w.subscribersGained += day.subscribersGained;
    w.subscribersLost += day.subscribersLost;
    w.watchMinutes += day.estimatedMinutesWatched;
  }
  for (const row of input.contentType ?? []) {
    const w = at(row.date);
    if (!w) continue;
    if (row.contentType === "SHORTS") {
      w.shortsViews! += row.views;
      w.shortsSubscribersGained! += row.subscribersGained;
      w.shortsSubscribersLost! += row.subscribersLost;
    } else if (row.contentType === "VIDEO_ON_DEMAND") {
      w.longViews! += row.views;
      w.longSubscribersGained! += row.subscribersGained;
      w.longSubscribersLost! += row.subscribersLost;
    }
  }
  for (const video of videos) {
    const w = at(video.publishedAt);
    if (!w) continue;
    w.uploads += 1;
    if (video.isShortResolved) w.shortsUploads += 1;
    else w.longUploads += 1;
  }

  return {
    weeks,
    videos,
    videoAnalytics: input.videoAnalytics,
    dataThrough: weekEnd(weeks[weeks.length - 1].start),
    retrievedAt,
    contentTypeAvailable: hasTypes,
  };
}

export const netSubs = (w: Week) => w.subscribersGained - w.subscribersLost;
export const shortsNetSubs = (w: Week) => (w.shortsSubscribersGained === null || w.shortsSubscribersLost === null ? null : w.shortsSubscribersGained - w.shortsSubscribersLost);
export const longNetSubs = (w: Week) => (w.longSubscribersGained === null || w.longSubscribersLost === null ? null : w.longSubscribersGained - w.longSubscribersLost);

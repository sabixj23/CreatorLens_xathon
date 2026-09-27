const DATA_API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

// YouTube has allowed Shorts up to 3 minutes since October 2024. The Data API has no
// "is Short" flag, so duration is the classifier; a rare 2–3 minute long-form upload
// will be counted as a Short.
export const SHORTS_MAX_SECONDS = 180;

export type OwnChannel = {
  id: string;
  title: string;
  subscriberCount: number;
  uploadsPlaylistId: string;
};

export type OwnVideo = {
  id: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  durationSeconds: number;
  isShort: boolean; // duration <= 180s — see SHORTS_MAX_SECONDS
};

export type DailyAnalytics = {
  date: string; // YYYY-MM-DD
  views: number;
  estimatedMinutesWatched: number;
  subscribersGained: number;
  subscribersLost: number;
};

async function youtubeFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`YouTube API request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

// Parses ISO-8601 durations as returned by videos.list contentDetails.duration
// (e.g. "PT45S", "PT1M30S", "PT10M5S") into total seconds.
export function parseIsoDuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}

export async function getMyChannel(accessToken: string): Promise<OwnChannel> {
  const data = await youtubeFetch<{
    items: Array<{
      id: string;
      snippet: { title: string };
      statistics: { subscriberCount: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  }>(`${DATA_API}/channels?part=snippet,statistics,contentDetails&mine=true`, accessToken);

  const channel = data.items[0];
  if (!channel) throw new Error("No YouTube channel found for this account.");

  return {
    id: channel.id,
    title: channel.snippet.title,
    subscriberCount: Number(channel.statistics.subscriberCount),
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  };
}

// Data API v3 only gives current lifetime totals per video — no historical time series.
// This "view count by video age" view (using publishedAt) is the only growth signal
// available for channels other than the signed-in user's own.
// `complete` is false when the cap was hit before the end of the uploads playlist — the
// weekly builder then drops weeks older than the oldest fetched upload, rather than
// reading them as "0 uploads". Duplicate IDs (the playlist can repeat) are removed.
export async function getMyRecentVideos(
  accessToken: string,
  uploadsPlaylistId: string,
  max = 250
): Promise<{ videos: OwnVideo[]; complete: boolean }> {
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  while (videoIds.length < max) {
    const url = new URL(`${DATA_API}/playlistItems`);
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("playlistId", uploadsPlaylistId);
    url.searchParams.set("maxResults", String(Math.min(50, max - videoIds.length)));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const page = await youtubeFetch<{
      items: Array<{ contentDetails: { videoId: string } }>;
      nextPageToken?: string;
    }>(url.toString(), accessToken);

    videoIds.push(...page.items.map((item) => item.contentDetails.videoId));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  const complete = !pageToken;
  const unique = [...new Set(videoIds)];
  if (unique.length === 0) return { videos: [], complete };

  // videos.list accepts at most 50 ids per call.
  type VideoItem = {
    id: string;
    snippet: { title: string; publishedAt: string };
    statistics: { viewCount?: string; likeCount?: string };
    contentDetails: { duration: string };
  };
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));
  const pages = await Promise.all(
    chunks.map((ids) => youtubeFetch<{ items: VideoItem[] }>(`${DATA_API}/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}`, accessToken))
  );

  const videos = pages.flatMap((page) => page.items).map((item) => {
    const durationSeconds = parseIsoDuration(item.contentDetails.duration);
    return {
      id: item.id,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      viewCount: Number(item.statistics.viewCount ?? 0),
      likeCount: Number(item.statistics.likeCount ?? 0),
      durationSeconds,
      isShort: durationSeconds <= SHORTS_MAX_SECONDS,
    };
  });
  return { videos, complete };
}

// ─── YouTube Analytics API (owned channel only) ──────────────────────────────

// Every Analytics query uses the same window, so week boundaries line up across reports.
export const ANALYTICS_MONTHS_BACK = 18;

function analyticsWindow(monthsBack = ANALYTICS_MONTHS_BACK) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);
  const format = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: format(start), endDate: format(end) };
}

type ReportRow = Record<string, string | number | null>;

// Rows keyed by column NAME (from columnHeaders), never by assumed array position.
// A requested metric that's missing from the response comes back as null, not 0.
async function analyticsReport(accessToken: string, params: Record<string, string>): Promise<ReportRow[]> {
  const url = new URL(`${ANALYTICS_API}/reports`);
  url.searchParams.set("ids", "channel==MINE");
  const { startDate, endDate } = analyticsWindow();
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const data = await youtubeFetch<{ columnHeaders: Array<{ name: string }>; rows?: (string | number)[][] }>(url.toString(), accessToken);
  const names = data.columnHeaders.map((header) => header.name);
  return (data.rows ?? []).map((row) => Object.fromEntries(names.map((name, i) => [name, row[i] ?? null])));
}

const num = (value: string | number | null | undefined): number | null => (value === null || value === undefined || value === "" ? null : Number(value));

export type VideoAnalytics = {
  videoId: string;
  views: number;
  subscribersGained: number;
  averageViewDurationSec: number;
  // YouTube's own classification (SHORTS, VIDEO_ON_DEMAND, LIVE_STREAM, …) when the
  // report could be split by creatorContentType; null otherwise.
  contentType: string | null;
};

// Per-video subscriber gains and watch time for the OWNED channel, over the shared
// window. The top-videos report requires a sort and maxResults, so it covers the
// channel's 200 most-viewed videos. creatorContentType is an optional dimension of
// this report; if YouTube rejects it, the report is re-requested without it.
export async function getMyVideoAnalytics(accessToken: string): Promise<VideoAnalytics[]> {
  const base = { metrics: "views,subscribersGained,averageViewDuration", sort: "-views", maxResults: "200" };
  let rows: ReportRow[];
  let typed = true;
  try {
    rows = await analyticsReport(accessToken, { ...base, dimensions: "video,creatorContentType" });
  } catch (error) {
    console.error("[youtube] per-video report with creatorContentType failed; retrying without:", error);
    rows = await analyticsReport(accessToken, { ...base, dimensions: "video" });
    typed = false;
  }
  return rows.map((row) => ({
    videoId: String(row.video),
    views: num(row.views) ?? 0,
    subscribersGained: num(row.subscribersGained) ?? 0,
    averageViewDurationSec: num(row.averageViewDuration) ?? 0,
    contentType: typed && row.creatorContentType ? String(row.creatorContentType) : null,
  }));
}

// Real day-level history for the OWNED channel only — this is not available for any
// channel the signed-in user doesn't have Analytics access to. A day with no row had no
// activity (a documented absent-zero), which the weekly builder treats as 0.
export async function getMyAnalyticsHistory(accessToken: string): Promise<DailyAnalytics[]> {
  const rows = await analyticsReport(accessToken, {
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost",
    dimensions: "day",
    sort: "day",
  });
  return rows.map((row) => ({
    date: String(row.day),
    views: num(row.views) ?? 0,
    estimatedMinutesWatched: num(row.estimatedMinutesWatched) ?? 0,
    subscribersGained: num(row.subscribersGained) ?? 0,
    subscribersLost: num(row.subscribersLost) ?? 0,
  }));
}

export type DailyContentTypeAnalytics = DailyAnalytics & { contentType: string };

// The same daily metrics split by YouTube's own content type (SHORTS, VIDEO_ON_DEMAND,
// LIVE_STREAM, STORY, UNSPECIFIED). Documented for day + creatorContentType with views,
// estimatedMinutesWatched, subscribersGained and subscribersLost, from 2019-01-01.
// Subscriptions that happen away from a video's watch page aren't attributed to a
// content type, so these rows won't sum exactly to the channel totals.
export async function getMyContentTypeHistory(accessToken: string): Promise<DailyContentTypeAnalytics[]> {
  const rows = await analyticsReport(accessToken, {
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost",
    dimensions: "day,creatorContentType",
    sort: "day",
  });
  return rows.map((row) => ({
    date: String(row.day),
    contentType: String(row.creatorContentType ?? "UNSPECIFIED"),
    views: num(row.views) ?? 0,
    estimatedMinutesWatched: num(row.estimatedMinutesWatched) ?? 0,
    subscribersGained: num(row.subscribersGained) ?? 0,
    subscribersLost: num(row.subscribersLost) ?? 0,
  }));
}

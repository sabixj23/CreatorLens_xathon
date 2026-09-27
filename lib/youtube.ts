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
export async function getMyRecentVideos(
  accessToken: string,
  uploadsPlaylistId: string,
  max = 50
): Promise<OwnVideo[]> {
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

  if (videoIds.length === 0) return [];

  const details = await youtubeFetch<{
    items: Array<{
      id: string;
      snippet: { title: string; publishedAt: string };
      statistics: { viewCount?: string; likeCount?: string };
      contentDetails: { duration: string };
    }>;
  }>(`${DATA_API}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}`, accessToken);

  return details.items.map((item) => {
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
}

export type VideoAnalytics = {
  videoId: string;
  views: number;
  subscribersGained: number;
  averageViewDurationSec: number;
};

// Per-video subscriber conversion and watch time for the OWNED channel, over the same
// window as the day-level history. This report type requires a sort and maxResults, so
// it covers the channel's most-viewed videos rather than every upload.
export async function getMyVideoAnalytics(accessToken: string, monthsBack = 18): Promise<VideoAnalytics[]> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);
  const format = (d: Date) => d.toISOString().slice(0, 10);

  const url = new URL(`${ANALYTICS_API}/reports`);
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", format(start));
  url.searchParams.set("endDate", format(end));
  url.searchParams.set("metrics", "views,subscribersGained,averageViewDuration");
  url.searchParams.set("dimensions", "video");
  url.searchParams.set("sort", "-views");
  url.searchParams.set("maxResults", "200");

  const data = await youtubeFetch<{
    columnHeaders: Array<{ name: string }>;
    rows?: (string | number)[][];
  }>(url.toString(), accessToken);

  const columns = data.columnHeaders.map((header) => header.name);
  const index = (name: string) => columns.indexOf(name);

  return (data.rows ?? []).map((row) => ({
    videoId: String(row[index("video")]),
    views: Number(row[index("views")] ?? 0),
    subscribersGained: Number(row[index("subscribersGained")] ?? 0),
    averageViewDurationSec: Number(row[index("averageViewDuration")] ?? 0),
  }));
}

// Real day-level history for the OWNED channel only — this is not available for any
// channel the signed-in user doesn't have Analytics access to.
export async function getMyAnalyticsHistory(
  accessToken: string,
  monthsBack = 18
): Promise<DailyAnalytics[]> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);
  const format = (d: Date) => d.toISOString().slice(0, 10);

  const url = new URL(`${ANALYTICS_API}/reports`);
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", format(start));
  url.searchParams.set("endDate", format(end));
  url.searchParams.set("metrics", "views,estimatedMinutesWatched,subscribersGained,subscribersLost");
  url.searchParams.set("dimensions", "day");
  url.searchParams.set("sort", "day");

  const data = await youtubeFetch<{
    columnHeaders: Array<{ name: string }>;
    rows?: (string | number)[][];
  }>(url.toString(), accessToken);

  const columns = data.columnHeaders.map((header) => header.name);
  const index = (name: string) => columns.indexOf(name);

  return (data.rows ?? []).map((row) => ({
    date: String(row[index("day")]),
    views: Number(row[index("views")] ?? 0),
    estimatedMinutesWatched: Number(row[index("estimatedMinutesWatched")] ?? 0),
    subscribersGained: Number(row[index("subscribersGained")] ?? 0),
    subscribersLost: Number(row[index("subscribersLost")] ?? 0),
  }));
}

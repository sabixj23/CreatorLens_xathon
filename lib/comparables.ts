import comparablesData from "./data/comparables.json";

export type ComparableChannelFixture = {
  title: string;
  subscriberCount: number;
  cadencePerWeek: number;
  shortsPct: number;
  recentTopVideos: Array<{ title: string; viewCount: number }>;
};

// Precomputed once via `npm run build-comparables`, not fetched live — see that script
// for why (Data API v3 has no historical data for channels you don't own, so there's
// nothing to gain from re-fetching this per request, only quota/latency risk).
export function loadComparables(): ComparableChannelFixture[] {
  return comparablesData as ComparableChannelFixture[];
}

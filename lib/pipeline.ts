import { buildContentDna } from "./content-dna";
import type { DiagnosisOutput } from "./diagnosis";
import { generateDiagnosis } from "./diagnosis";
import type { FormatStats, ShortsStats } from "./format-stats";
import { buildFormatStats, buildShortsStats } from "./format-stats";
import { getOrCompute } from "./session-cache";
import type { GrowthModel, SimulatedPath, WeeklyChannelState } from "./simulation";
import { backtest, buildWeeklyHistory, computeStreak, fitGrowthModel, recentAverages, simulatePaths } from "./simulation";
import type { Backtest, ContentDna, Streak } from "./types";
import type { OwnChannel, VideoAnalytics } from "./youtube";
import { getMyAnalyticsHistory, getMyChannel, getMyRecentVideos, getMyVideoAnalytics } from "./youtube";

export type ChannelBundle = {
  channel: OwnChannel;
  weeklyHistory: WeeklyChannelState[];
  contentDna: ContentDna;
  formatStats: FormatStats;
  shortsStats: ShortsStats;
  model: GrowthModel;
  paths: SimulatedPath[];
  backtestResult: Backtest | null;
  diagnosisOutput: DiagnosisOutput;
  streak: Streak;
};

// Everything an authenticated request needs, computed once per session and reused by
// /api/diagnose, /api/plan, and /api/recalibration — see lib/session-cache.ts for why.
export async function getChannelBundle(accessToken: string): Promise<ChannelBundle> {
  return getOrCompute(accessToken, async () => {
    const channel = await getMyChannel(accessToken);
    const [videos, daily, videoAnalytics] = await Promise.all([
      getMyRecentVideos(accessToken, channel.uploadsPlaylistId),
      getMyAnalyticsHistory(accessToken),
      // Optional enrichment (subscriber conversion + watch time per format). Without it
      // the format comparison falls back to average views, so a failure isn't fatal.
      getMyVideoAnalytics(accessToken).catch((error): VideoAnalytics[] => {
        console.error("[pipeline] per-video analytics unavailable:", error);
        return [];
      }),
    ]);

    const weeklyHistory = buildWeeklyHistory(daily, videos);
    const contentDna = buildContentDna(videos);
    const formatStats = buildFormatStats(videos, videoAnalytics);
    const shortsStats = buildShortsStats(videos, videoAnalytics);
    const model = fitGrowthModel(weeklyHistory);
    const paths = simulatePaths(channel.subscriberCount, recentAverages(weeklyHistory), model, shortsStats);
    const backtestResult = backtest(weeklyHistory);
    const streak = computeStreak(weeklyHistory);
    const diagnosisOutput = await generateDiagnosis({ channel, weeklyHistory, contentDna, formatStats, shortsStats });

    return { channel, weeklyHistory, contentDna, formatStats, shortsStats, model, paths, backtestResult, diagnosisOutput, streak };
  });
}

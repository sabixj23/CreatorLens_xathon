import type { ComparableChannelFixture } from "./comparables";
import { loadComparables } from "./comparables";
import { buildContentDna } from "./content-dna";
import type { DiagnosisOutput } from "./diagnosis";
import { generateDiagnosis } from "./diagnosis";
import { getOrCompute } from "./session-cache";
import type { GrowthModel, SimulatedPath, WeeklyChannelState } from "./simulation";
import { backtest, buildWeeklyHistory, computeStreak, fitGrowthModel, recentAverages, simulatePaths } from "./simulation";
import type { Backtest, ContentDna, Streak } from "./types";
import type { OwnChannel } from "./youtube";
import { getMyAnalyticsHistory, getMyChannel, getMyRecentVideos } from "./youtube";

export type ChannelBundle = {
  channel: OwnChannel;
  weeklyHistory: WeeklyChannelState[];
  contentDna: ContentDna;
  comparables: ComparableChannelFixture[];
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
    const [videos, daily] = await Promise.all([
      getMyRecentVideos(accessToken, channel.uploadsPlaylistId),
      getMyAnalyticsHistory(accessToken),
    ]);

    const weeklyHistory = buildWeeklyHistory(daily, videos);
    const contentDna = buildContentDna(videos);
    const comparables = loadComparables();
    const model = fitGrowthModel(weeklyHistory);
    const { cadencePerWeek } = recentAverages(weeklyHistory);
    const paths = simulatePaths(channel.subscriberCount, cadencePerWeek, model, comparables);
    const backtestResult = backtest(weeklyHistory);
    const streak = computeStreak(weeklyHistory);
    const diagnosisOutput = await generateDiagnosis({ channel, weeklyHistory, contentDna, comparables });

    return { channel, weeklyHistory, contentDna, comparables, model, paths, backtestResult, diagnosisOutput, streak };
  });
}

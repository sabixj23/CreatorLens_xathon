import { analyseChannel, perShortSubscribers, recentProvenShare } from "./analysis";
import type { PrimaryMetric } from "./analysis/experiments";
import { decisionThresholds, primaryMetric } from "./analysis/experiments";
import { buildStrategyCards } from "./analysis/strategies";
import type { ChannelSnapshot } from "./analysis/weeks";
import { buildSnapshot } from "./analysis/weeks";
import { buildContentDna } from "./content-dna";
import type { DiagnosisOutput } from "./diagnosis";
import { generateDiagnosis } from "./diagnosis";
import type { FormatStats, ShortsStats } from "./format-stats";
import { buildFormatStats, buildShortsStats } from "./format-stats";
import { getOrCompute } from "./session-cache";
import type { PathPlan, WeeklyChannelState } from "./simulation";
import { backtest, computeStreak, planPaths, projectionInputs, statesFromWeeks } from "./simulation";
import type { Backtest, ChannelAnalysis, ContentDna, GrowthPath, Streak } from "./types";
import type { DailyContentTypeAnalytics, OwnChannel, VideoAnalytics } from "./youtube";
import { getMyAnalyticsHistory, getMyChannel, getMyContentTypeHistory, getMyRecentVideos, getMyVideoAnalytics } from "./youtube";

export type ChannelBundle = {
  channel: OwnChannel;
  snapshot: ChannelSnapshot;
  weeklyHistory: WeeklyChannelState[];
  contentDna: ContentDna;
  formatStats: FormatStats;
  shortsStats: ShortsStats;
  analysis: ChannelAnalysis;
  plans: PathPlan[];
  paths: GrowthPath[];
  metric: PrimaryMetric;
  backtestResult: Backtest | null;
  diagnosisOutput: DiagnosisOutput;
  streak: Streak;
};

// Everything an authenticated request needs, computed once per session and reused by
// /api/diagnose, /api/plan, /api/plan-start, /api/recalibration and /api/chat.
export async function getChannelBundle(accessToken: string): Promise<ChannelBundle> {
  return getOrCompute(accessToken, async () => {
    const channel = await getMyChannel(accessToken);
    const [{ videos, complete }, daily, contentType, videoAnalytics] = await Promise.all([
      getMyRecentVideos(accessToken, channel.uploadsPlaylistId),
      getMyAnalyticsHistory(accessToken),
      // Shorts vs long-form from YouTube's own creatorContentType split. If it fails,
      // content-type fields become null — never a guess.
      getMyContentTypeHistory(accessToken).catch((error): DailyContentTypeAnalytics[] | null => {
        console.error("[pipeline] content-type report unavailable:", error);
        return null;
      }),
      getMyVideoAnalytics(accessToken).catch((error): VideoAnalytics[] => {
        console.error("[pipeline] per-video analytics unavailable:", error);
        return [];
      }),
    ]);

    const snapshot = buildSnapshot({ daily, contentType, videos, videosComplete: complete, videoAnalytics });
    // Downstream helpers read `isShort`; use the best classification available.
    const classified = snapshot.videos.map((v) => ({ ...v, isShort: v.isShortResolved }));
    const weeklyHistory = statesFromWeeks(snapshot.weeks);
    const contentDna = buildContentDna(classified);
    const formatStats = buildFormatStats(classified, videoAnalytics);
    const shortsStats = buildShortsStats(classified, videoAnalytics);
    const analysis = analyseChannel(snapshot, shortsStats);

    const backtestResult = backtest(weeklyHistory);
    const errorPerWeek = backtestResult ? Math.min(backtestResult.maeSubsPerWeek, backtestResult.baselineMaeSubsPerWeek) : null;
    const inputs = projectionInputs(snapshot.weeks, perShortSubscribers(snapshot), recentProvenShare(snapshot, shortsStats.provenTopics), errorPerWeek);
    const plans = planPaths(channel.subscriberCount, inputs, shortsStats);

    const metric = primaryMetric(snapshot.contentTypeAvailable);
    const thresholds = decisionThresholds(snapshot.weeks.slice(-8), metric);
    const paths = buildStrategyCards(plans, analysis.hypotheses, shortsStats, contentDna.topHookStyles[0] ?? null, metric, thresholds);

    const streak = computeStreak(weeklyHistory);
    const diagnosisOutput = await generateDiagnosis({ channel, contentDna, analysis, shortsStats });

    return { channel, snapshot, weeklyHistory, contentDna, formatStats, shortsStats, analysis, plans, paths, metric, backtestResult, diagnosisOutput, streak };
  });
}

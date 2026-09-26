export type PathId = "A" | "B" | "C";

export type DiagnoseResponse = {
  channel: { title: string; subscriberCount: number; recentCadencePerWeek: number };
  diagnosis: { headline: string; explanation: string; evidence: string[] };
  channelInOneSentence: { then: string; now: string };
  contentDna: { topTopics: string[]; topFormats: string[]; topHookStyles: string[] };
  ideas: Array<{
    title: string;
    trendRelevance: "high" | "medium" | "low";
    audienceFit: "high" | "medium" | "low";
    hooks: Array<{ style: "bold" | "relatable" | "curiosity"; line: string }>;
  }>;
  paths: Array<{
    id: PathId;
    name: string;
    oneLiner: string;
    weekOnePlan: string[];
    projectedWeek12Subs: number;
    tradeOff: string;
  }>;
  backtest: { channelsTested: number; meanErrorPct: number } | null;
};

export type PlanResponse = {
  weeklyProjection: Array<{ week: number; subs: number }>;
  weeklyActions: Array<{ week: number; action: string }>;
  crossPlatform: { mocked: true; note: string; instagram: unknown; tiktok: unknown };
  kpiScorecard: Array<{ label: string; value: number; trend: "up" | "down" | "flat" }>;
  benchmark: Array<{ channelLabel: string; cadencePerWeek: number; formatMixPct: number; isMe: boolean }>;
  opportunityMatrix: Array<{
    pathId: PathId;
    effort: "low" | "medium" | "high";
    projectedGrowth: number;
    risk: "low" | "medium" | "high";
  }>;
};

export type RecalibrationResponse = {
  week: number;
  predicted: number;
  actual: number;
  deltaPct: number;
  adjustedPlan: { note: string; changes: string[] };
  mocked: boolean;
};

export type ChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};
export type ChatResponse = { reply: string };

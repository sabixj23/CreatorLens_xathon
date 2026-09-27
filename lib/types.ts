// Shared API contract. Imported by both the backend routes and the frontend pages/fixture
// so a shape drift between them is a typecheck failure, not a runtime surprise at merge time.

export const UNLOCK_COOKIE_NAME = "clx_unlocked";
// Fewer Shorts than this and the proven-topic comparison is too thin to lean on.
export const MIN_SHORTS = 8;
// Server-set, httpOnly counter for free chat replies. Like the unlock cookie, a demo
// boundary rather than an entitlement system.
export const CHAT_USED_COOKIE_NAME = "clx_chat_used";
export const FREE_CHAT_MESSAGES = 5;

export type Diagnosis = {
  headline: string;
  explanation: string;
  evidence: string[];
};

export type ChannelInOneSentence = {
  then: string;
  now: string;
};

export type ContentDna = {
  topTopics: string[];
  topFormats: string[];
  topHookStyles: string[];
};

export type IdeaHookStyle = "bold" | "relatable" | "curiosity";

export type Idea = {
  title: string;
  trendRelevance: "high" | "medium" | "low";
  audienceFit: "high" | "medium" | "low";
  hooks: Array<{ style: IdeaHookStyle; line: string }>;
};

export type PathId = "A" | "B" | "C";

export type GrowthPath = {
  id: PathId;
  name: string; // e.g. "Double Down" / "Balanced" / "Experiment"
  oneLiner: string;
  weekOnePlan: string[];
  projectedWeek12Subs: number;
  tradeOff: string;
};

export type Backtest = {
  channelsTested: number;
  meanErrorPct: number;
};

// Computed from the creator's own real upload history (consecutive weeks with at
// least one upload) — not a separately tracked counter, so it can't drift from
// what actually happened on the channel.
export type Streak = {
  currentWeeks: number;
  longestWeeks: number;
};

// GET /api/diagnose — requires an authenticated session.
// Returns 401 JSON (never a redirect) when unauthenticated.
export type DiagnoseResponse = {
  channel: {
    title: string;
    subscriberCount: number;
    recentShortsPerWeek: number;
    shortsAnalysed: number;
    // false when the channel has too few Shorts for the topic comparison to mean much;
    // the dashboard says so instead of presenting thin numbers as a strategy.
    enoughShorts: boolean;
  };
  diagnosis: Diagnosis;
  channelInOneSentence: ChannelInOneSentence;
  contentDna: ContentDna;
  ideas: Idea[];
  paths: GrowthPath[];
  // null until the real backtest has run — never fabricate a 0, that reads as a claim
  // of perfect accuracy. Frontend suppresses every accuracy claim when this is null.
  backtest: Backtest | null;
  streak: Streak;
};

export type KpiTile = {
  label: string;
  value: number;
  trend: "up" | "down" | "flat";
};

export type OpportunityRow = {
  pathId: PathId;
  effort: "low" | "medium" | "high";
  projectedGrowth: number;
  risk: "low" | "medium" | "high";
};

// GET /api/plan?pathId=A — no unlock required, the initial plan is free.
// The /dashboard/plan PAGE also always renders regardless of unlock state — it holds
// free content (this plan, plus week 2 of the recalibration timeline).
export type PlanResponse = {
  weeklyProjection: Array<{ week: number; subs: number }>;
  weeklyActions: Array<{ week: number; action: string }>; // templated, not LLM-generated
  crossPlatform: { mocked: true; note: string; instagram: unknown; tiktok: unknown };
  kpiScorecard: KpiTile[];
  opportunityMatrix: OpportunityRow[];
};

// GET /api/recalibration?week=N — week 2 is always free (the hook). week > 2 requires
// the unlock cookie (UNLOCK_COOKIE_NAME), checked server-side. There is no page-level
// gate anywhere — only individual weeks beyond week 2 render/return locked.
export type RecalibrationResponse = {
  week: number;
  predicted: number;
  actual: number;
  deltaPct: number;
  adjustedPlan: { note: string; changes: string[] };
  // false for weeks that already really happened (computed from real Analytics data),
  // true for a scripted future week used in the demo.
  mocked: boolean;
};

// POST /api/chat — FREE_CHAT_MESSAGES free replies, then the same unlock cookie as
// /api/recalibration week 3+ (402 once the free replies are used).
export type ChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

// freeRemaining is null when the unlock cookie is set (unlimited).
export type ChatResponse = { reply: string; freeRemaining: number | null };

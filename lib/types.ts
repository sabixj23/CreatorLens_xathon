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
  explanation: string[]; // point-form observations, not a paragraph
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

export type Level = "low" | "medium" | "high";

// ─── Evidence (deterministic analysis — the LLM never alters these) ──────────

// One measured before/after comparison. `null` means unavailable, never "zero".
export type Evidence = {
  id: string;
  metric: string; // human label, e.g. "Net subscribers per week"
  before: number | null;
  after: number | null;
  unit: string; // e.g. "subs/week", "per 1k views", "%"
  window: { before: string; after: string }; // human-readable date ranges
  sampleSize: number; // weeks (or videos) behind the "after" value
  source: string; // which API report / computation it came from
  caveat?: string;
};

// Four-state verdict, shared by hypotheses and the "did it work" checkpoints.
// supported = the data backs it · mixed = signals disagree or the change is within
// normal variation · not_supported = the data points the other way ·
// insufficient_data = too little data (or too early) to say.
export type EvidenceStatus = "supported" | "mixed" | "not_supported" | "insufficient_data";

export type HypothesisId = "cadence" | "format_mix" | "conversion" | "outlier_dependence" | "topic_shift";

export type Hypothesis = {
  id: HypothesisId;
  claim: string;
  status: EvidenceStatus;
  // Strength of the evidence (completeness, volume, agreement) — not a probability of cause.
  strength: Level;
  evidenceFor: Evidence[];
  evidenceAgainst: Evidence[];
  note?: string;
};

export type DriverChange = {
  id: string;
  label: string;
  before: number | null;
  after: number | null;
  unit: string;
  changePct: number | null; // null when the earlier value is near zero
  absoluteChange: number | null;
};

export type DriverSummary = {
  windows: { before: string; after: string; weeksEach: number };
  statement: string;
  changes: DriverChange[];
  // Arithmetic split of the change in weekly net subscribers into "more/fewer views" vs
  // "more/fewer net subscribers per view". Descriptive, not proof of cause. null when a
  // rate is zero/negative or denominators are unstable.
  decomposition: { reachEffect: number; rateEffect: number; totalChange: number } | null;
  decompositionNote: string | null; // why the split was skipped, when it was
};

export type ChangePoint = {
  metric: "netSubs" | "views";
  weekStart: string; // approximate — never presented as a precise date
  beforeMedian: number;
  afterMedian: number;
};

export type FormatWindow = { views: number; netSubs: number; netSubsPer1kViews: number | null; uploads: number };

export type FormatComparison = {
  available: boolean; // false when the content-type report couldn't be fetched
  shorts: { before: FormatWindow; after: FormatWindow } | null;
  longForm: { before: FormatWindow; after: FormatWindow } | null;
  // Share of channel net subscribers that the content-type rows account for.
  reconciliationPct: number | null;
  note: string;
};

export type OutlierSummary = {
  cohort: string; // e.g. "Shorts published 26–8 weeks before the data end date"
  n: number;
  topCount: number; // ceil(0.1 × n)
  subsShareOfTop: number | null; // % of video-attributed subscriber gains from the top 10%
  viewsShareOfTop: number | null;
  suppressed: boolean; // n < 10
};

export type ChannelAnalysis = {
  dataThrough: string; // last complete day of data used
  completeWeeks: number;
  limitedHistory: boolean; // fewer than 16 complete weeks — claims are suppressed
  contentTypeAvailable: boolean;
  drivers: DriverSummary | null;
  changePoints: ChangePoint[];
  formats: FormatComparison;
  outliers: OutlierSummary;
  hypotheses: Hypothesis[];
  provenTopics: string[]; // auto-detected title keywords (see lib/format-stats.ts)
};

// ─── Strategies and the two-week test ────────────────────────────────────────

export type Experiment = {
  assumption: string;
  schedule: string[];
  primaryMetric: { id: string; label: string; scope: string };
  supportingMetrics: string[];
  holdConstant: string[];
  minimumData: string;
  // Derived from the creator's own recent weekly variation (median ± MAD).
  decisionRule: { metricId: string; keepAbove: number | null; dropBelow: number | null; text: string };
};

export type GrowthPath = {
  id: PathId;
  name: string; // "Double Down" / "Balanced" / "Experiment"
  oneLiner: string;
  weekOnePlan: string[];
  projectedWeek12Subs: number;
  tradeOff: string;
  // Strategy card
  thesis: string;
  evidenceIds: HypothesisId[]; // hypotheses this path rests on
  exploratory: boolean; // true when no supported/mixed evidence backs it
  actions: string[];
  assumption: string;
  mainRisk: string;
  effort: Level;
  evidenceStrength: Level;
  shortsPerWeek: number;
  testsPerWeek: number;
  experiment: Experiment;
};

// Walk-forward self-backtest on ONE channel. Errors are in subscribers per week.
export type Backtest = {
  channelsTested: number; // always 1 — many weeks of one channel, not many channels
  weeksEvaluated: number;
  maeSubsPerWeek: number; // model: mean absolute error, subscribers/week
  baselineMaeSubsPerWeek: number; // trailing four-week median, same weeks
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
  analysis: ChannelAnalysis;
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
  // subs = central scenario; low/high = band that widens with horizon.
  weeklyProjection: Array<{ week: number; subs: number; low: number; high: number }>;
  weeklyActions: Array<{ week: number; action: string }>; // templated, not LLM-generated
  crossPlatform: { mocked: true; note: string; instagram: unknown; tiktok: unknown };
  kpiScorecard: KpiTile[];
  opportunityMatrix: OpportunityRow[];
};

// ─── Closing the loop: did the strategy work? ────────────────────────────────

export const PLAN_COOKIE_NAME = "clx_plan";
export const CHECKPOINT_WEEKS = [2, 4, 8, 12] as const;
export type PlanMode = "live" | "lookback";

// Snapshot of the channel in the 8 complete weeks before the plan started.
export type PlanBaseline = {
  window: string;
  weeks: number;
  netSubsPerWeek: number;
  netSubsMedian: number;
  netSubsMad: number; // median absolute deviation — the channel's normal weekly swing
  viewsPerWeek: number;
  shortsPerWeek: number;
  netSubsPer1kViews: number | null;
  shortsNetSubsPer1kShortsViews: number | null;
  provenTopicShare: number | null; // % of Shorts on proven topics
};

// What the signed plan cookie holds (server-side view; returned to the client as-is).
export type PlanRecord = {
  v: 1;
  channelId: string;
  pathId: PathId;
  pathName: string;
  mode: PlanMode;
  startWeek: string; // Monday (UTC) of the first plan week
  plannedShortsPerWeek: number;
  plannedTestsPerWeek: number;
  provenTopics: string[];
  baseline: PlanBaseline;
  createdAt: string;
};

// GET/POST/DELETE /api/plan-start
export type PlanStartRequest = { pathId: PathId; mode: PlanMode; lookbackWeeks?: number };
export type PlanStartResponse = { plan: PlanRecord | null };

export type Adherence = {
  plannedShorts: number;
  postedShorts: number;
  plannedTests: number;
  postedTests: number; // Shorts not on proven topics
  followedPct: number; // posted ÷ planned Shorts, capped at 100
  status: "followed" | "partly" | "not_followed";
};

// GET /api/recalibration?week=N — needs a started plan (409 otherwise). Week 2 is free;
// week > 2 requires the unlock cookie (UNLOCK_COOKIE_NAME), checked server-side.
export type CheckpointResponse = {
  week: number;
  mode: PlanMode;
  available: boolean; // false until N complete weeks have passed since the start
  availableFrom: string | null; // date the checkpoint unlocks, when not yet available
  pathName: string;
  window: { before: string; after: string };
  verdict: { status: EvidenceStatus; label: string; reason: string };
  adherence: Adherence | null;
  evidence: Evidence[];
  decomposition: DriverSummary["decomposition"];
  decompositionNote: string | null;
  // "Carry on as before": what the baseline would have produced over the same weeks.
  counterfactual: { expected: number; low: number; high: number; actual: number } | null;
  experiment: { metricLabel: string; value: number | null; keepAbove: number | null; dropBelow: number | null; outcome: "keep" | "drop" | "inconclusive" } | null;
  nextStep: string;
  caveats: string[];
  mocked: boolean; // true only for the illustrative demo channel
};

// POST /api/chat — FREE_CHAT_MESSAGES free replies, then the same unlock cookie as
// /api/recalibration week 3+ (402 once the free replies are used).
export type ChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

// freeRemaining is null when the unlock cookie is set (unlimited).
export type ChatResponse = { reply: string; freeRemaining: number | null };

// POST /api/streak-email — sends a real email (via Resend) to the signed-in user's own
// account email, built from their real streak. Requires an authenticated session; there
// is no separate unlock gate on this one.
export type StreakEmailResponse = { sent: true; to: string };

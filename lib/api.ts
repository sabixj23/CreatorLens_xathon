import { z } from "zod";
import { demoCheckpoint, demoDiagnosis, demoPlanRecord, demoPlans } from "./data/fixture";
import type { ChatRequest, ChatResponse, CheckpointResponse, DiagnoseResponse, PathId, PlanRecord, PlanResponse, PlanStartRequest, PlanStartResponse } from "./types";

// Set this when the teammate's OAuth route is available; no page changes required.
export const CONNECT_HREF = process.env.NEXT_PUBLIC_CONNECT_PATH || "/dashboard?connect=1";
export const CONNECTION_AVAILABLE = Boolean(process.env.NEXT_PUBLIC_CONNECT_PATH);
const level = z.enum(["high", "medium", "low"]);
const pathId = z.enum(["A", "B", "C"]);
const count = z.number().finite().nonnegative();
const num = z.number().finite();
const maybe = num.nullable();
const status = z.enum(["supported", "mixed", "not_supported", "insufficient_data"]);

const evidence = z.object({
  id: z.string(), metric: z.string(), before: maybe, after: maybe, unit: z.string(),
  window: z.object({ before: z.string(), after: z.string() }), sampleSize: count, source: z.string(), caveat: z.string().optional(),
});
const decomposition = z.object({ reachEffect: num, rateEffect: num, totalChange: num }).nullable();
const formatWindow = z.object({ views: count, netSubs: num, netSubsPer1kViews: maybe, uploads: count });
const analysis = z.object({
  dataThrough: z.string(), completeWeeks: count, limitedHistory: z.boolean(), contentTypeAvailable: z.boolean(),
  drivers: z.object({
    windows: z.object({ before: z.string(), after: z.string(), weeksEach: count }), statement: z.string(),
    changes: z.array(z.object({ id: z.string(), label: z.string(), before: maybe, after: maybe, unit: z.string(), changePct: maybe, absoluteChange: maybe })),
    decomposition, decompositionNote: z.string().nullable(),
  }).nullable(),
  changePoints: z.array(z.object({ metric: z.enum(["netSubs", "views"]), weekStart: z.string(), beforeMedian: num, afterMedian: num })),
  formats: z.object({
    available: z.boolean(), shorts: z.object({ before: formatWindow, after: formatWindow }).nullable(), longForm: z.object({ before: formatWindow, after: formatWindow }).nullable(),
    reconciliationPct: maybe, note: z.string(),
  }),
  outliers: z.object({ cohort: z.string(), n: count, topCount: count, subsShareOfTop: maybe, viewsShareOfTop: maybe, suppressed: z.boolean() }),
  hypotheses: z.array(z.object({
    id: z.enum(["cadence", "format_mix", "conversion", "outlier_dependence", "topic_shift"]), claim: z.string(), status, strength: level,
    evidenceFor: z.array(evidence), evidenceAgainst: z.array(evidence), note: z.string().optional(),
  })),
  provenTopics: z.array(z.string()),
});
const experiment = z.object({
  assumption: z.string(), schedule: z.array(z.string()), primaryMetric: z.object({ id: z.string(), label: z.string(), scope: z.string() }),
  supportingMetrics: z.array(z.string()), holdConstant: z.array(z.string()), minimumData: z.string(),
  decisionRule: z.object({ metricId: z.string(), keepAbove: maybe, dropBelow: maybe, text: z.string() }),
});
const diagnosisSchema: z.ZodType<DiagnoseResponse> = z.object({
  channel: z.object({ title: z.string(), subscriberCount: count, recentShortsPerWeek: count, shortsAnalysed: count, enoughShorts: z.boolean() }),
  diagnosis: z.object({ headline: z.string(), explanation: z.string(), evidence: z.array(z.string()) }),
  channelInOneSentence: z.object({ then: z.string(), now: z.string() }),
  contentDna: z.object({ topTopics: z.array(z.string()), topFormats: z.array(z.string()), topHookStyles: z.array(z.string()) }),
  ideas: z.array(z.object({ title: z.string(), trendRelevance: level, audienceFit: level, hooks: z.array(z.object({ style: z.enum(["bold", "relatable", "curiosity"]), line: z.string() })) })),
  paths: z.array(z.object({
    id: pathId, name: z.string(), oneLiner: z.string(), weekOnePlan: z.array(z.string()), projectedWeek12Subs: count, tradeOff: z.string(),
    thesis: z.string(), evidenceIds: z.array(z.enum(["cadence", "format_mix", "conversion", "outlier_dependence", "topic_shift"])), exploratory: z.boolean(),
    actions: z.array(z.string()), assumption: z.string(), mainRisk: z.string(), effort: level, evidenceStrength: level,
    shortsPerWeek: count, testsPerWeek: count, experiment,
  })).refine(paths => paths.length === 3 && new Set(paths.map(p => p.id)).size === 3),
  backtest: z.object({ channelsTested: z.number().int().positive(), weeksEvaluated: count, maeSubsPerWeek: count, baselineMaeSubsPerWeek: count }).nullable(),
  streak: z.object({ currentWeeks: z.number().int().nonnegative(), longestWeeks: z.number().int().nonnegative() }),
  analysis,
});
const planSchema: z.ZodType<PlanResponse> = z.object({
  weeklyProjection: z.array(z.object({ week: z.number().int().min(1).max(12), subs: num, low: num, high: num })).length(12).refine(rows => new Set(rows.map(r => r.week)).size === 12),
  weeklyActions: z.array(z.object({ week: z.number().int().min(1).max(12), action: z.string() })).length(12).refine(rows => new Set(rows.map(r => r.week)).size === 12),
  crossPlatform: z.object({ mocked: z.literal(true), note: z.string(), instagram: z.unknown(), tiktok: z.unknown() }),
  kpiScorecard: z.array(z.object({ label: z.string(), value: num, trend: z.enum(["up", "down", "flat"]) })),
  opportunityMatrix: z.array(z.object({ pathId, effort: level, projectedGrowth: num, risk: level })),
});
const planRecord: z.ZodType<PlanRecord> = z.object({
  v: z.literal(1), channelId: z.string(), pathId, pathName: z.string(), mode: z.enum(["live", "lookback"]), startWeek: z.string(),
  plannedShortsPerWeek: count, plannedTestsPerWeek: count, provenTopics: z.array(z.string()),
  baseline: z.object({
    window: z.string(), weeks: count, netSubsPerWeek: num, netSubsMedian: num, netSubsMad: count, viewsPerWeek: count, shortsPerWeek: count,
    netSubsPer1kViews: maybe, shortsNetSubsPer1kShortsViews: maybe, provenTopicShare: maybe,
  }),
  createdAt: z.string(),
});
const planStartSchema: z.ZodType<PlanStartResponse> = z.object({ plan: planRecord.nullable() });
const checkpointSchema: z.ZodType<CheckpointResponse> = z.object({
  week: z.number().int(), mode: z.enum(["live", "lookback"]), available: z.boolean(), availableFrom: z.string().nullable(), pathName: z.string(),
  window: z.object({ before: z.string(), after: z.string() }),
  verdict: z.object({ status, label: z.string(), reason: z.string() }),
  adherence: z.object({ plannedShorts: count, postedShorts: count, plannedTests: count, postedTests: count, followedPct: count, status: z.enum(["followed", "partly", "not_followed"]) }).nullable(),
  evidence: z.array(evidence), decomposition, decompositionNote: z.string().nullable(),
  counterfactual: z.object({ expected: num, low: num, high: num, actual: num }).nullable(),
  experiment: z.object({ metricLabel: z.string(), value: maybe, keepAbove: maybe, dropBelow: maybe, outcome: z.enum(["keep", "drop", "inconclusive"]) }).nullable(),
  nextStep: z.string(), caveats: z.array(z.string()), mocked: z.boolean(),
});

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError"; }
}
export type Report = { diagnosis: DiagnoseResponse; plans: Record<PathId, PlanResponse>; source: "live" | "demo"; notice?: string };
export type ReportResult = { status: "ready"; report: Report } | { status: "unauthenticated" };
export const fixtureReport: Report = { diagnosis: demoDiagnosis, plans: demoPlans, source: "demo" };

async function request<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(45000);
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, body?.error || `Request failed (${response.status}).`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    console.error(`[api] ${url} returned an unexpected shape`, parsed.error);
    throw new ApiError(502, "The service returned an incomplete report.");
  }
  return parsed.data;
}
export async function loadReport(demo: boolean, signal?: AbortSignal): Promise<ReportResult> {
  if (demo) return { status: "ready", report: fixtureReport };
  try {
    const diagnosis = await request("/api/diagnose", diagnosisSchema, signal);
    const ids: PathId[] = ["A", "B", "C"];
    const values = await Promise.all(ids.map(id => request(`/api/plan?pathId=${id}`, planSchema, signal)));
    const plans = Object.fromEntries(ids.map((id, i) => [id, values[i]])) as Record<PathId, PlanResponse>;
    return { status: "ready", report: { diagnosis, plans, source: "live" } };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError && error.status === 401) return { status: "unauthenticated" };
    return { status: "ready", report: { ...fixtureReport, notice: "We couldn't load your channel. You're viewing an illustrative demo, not your analytics." } };
  }
}

// ─── Closing the loop ────────────────────────────────────────────────────────
// Live channels keep the started plan in a signed httpOnly cookie (read back via GET).
// The demo channel keeps it in memory only.

export async function getStartedPlan(demo: boolean, signal?: AbortSignal): Promise<PlanRecord | null> {
  if (demo) return null;
  return (await request("/api/plan-start", planStartSchema, signal)).plan;
}
export async function startPlan(body: PlanStartRequest, demo: boolean): Promise<PlanRecord> {
  if (demo) return demoPlanRecord(body);
  const result = await request("/api/plan-start", planStartSchema, undefined, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!result.plan) throw new ApiError(502, "The plan couldn't be started.");
  return result.plan;
}
export async function resetPlan(demo: boolean): Promise<void> {
  if (demo) return;
  await request("/api/plan-start", planStartSchema, undefined, { method: "DELETE" });
}
export async function getCheckpoint(week: number, demo: boolean, plan: PlanRecord | null, signal?: AbortSignal): Promise<CheckpointResponse> {
  if (demo) {
    if (!plan) throw new ApiError(409, "Start a plan first.");
    return demoCheckpoint(week, plan);
  }
  const result = await request(`/api/recalibration?week=${week}`, checkpointSchema, signal);
  if (result.week !== week) throw new ApiError(502, "The service returned a different checkpoint.");
  return result;
}

const chatSchema: z.ZodType<ChatResponse> = z.object({ reply: z.string(), freeRemaining: z.number().int().nonnegative().nullable() });
export async function sendChat(body: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  const timeout = AbortSignal.timeout(60000);
  const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status}).`);
  const parsed = chatSchema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError(502, "The service returned an incomplete reply.");
  return parsed.data;
}

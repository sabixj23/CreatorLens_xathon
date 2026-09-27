import { z } from "zod";
import { demoDiagnosis, demoPlans, demoRecalibration } from "./data/fixture";
import type { ChatRequest, ChatResponse, DiagnoseResponse, PathId, PlanResponse, RecalibrationResponse } from "./types";

// Set this when the teammate's OAuth route is available; no page changes required.
export const CONNECT_HREF = process.env.NEXT_PUBLIC_CONNECT_PATH || "/dashboard?connect=1";
export const CONNECTION_AVAILABLE = Boolean(process.env.NEXT_PUBLIC_CONNECT_PATH);
const level = z.enum(["high", "medium", "low"]);
const pathId = z.enum(["A", "B", "C"]);
const count = z.number().finite().nonnegative();
const diagnosisSchema: z.ZodType<DiagnoseResponse> = z.object({
  channel: z.object({ title: z.string(), subscriberCount: count, recentShortsPerWeek: count, shortsAnalysed: count, enoughShorts: z.boolean() }),
  diagnosis: z.object({ headline: z.string(), explanation: z.string(), evidence: z.array(z.string()) }),
  channelInOneSentence: z.object({ then: z.string(), now: z.string() }),
  contentDna: z.object({ topTopics: z.array(z.string()), topFormats: z.array(z.string()), topHookStyles: z.array(z.string()) }),
  ideas: z.array(z.object({ title: z.string(), trendRelevance: level, audienceFit: level, hooks: z.array(z.object({ style: z.enum(["bold", "relatable", "curiosity"]), line: z.string() })) })),
  paths: z.array(z.object({ id: pathId, name: z.string(), oneLiner: z.string(), weekOnePlan: z.array(z.string()), projectedWeek12Subs: count, tradeOff: z.string() })).refine(paths => paths.length === 3 && new Set(paths.map(p => p.id)).size === 3),
  backtest: z.object({ channelsTested: z.number().int().positive(), meanErrorPct: count }).nullable(),
  streak: z.object({ currentWeeks: z.number().int().nonnegative(), longestWeeks: z.number().int().nonnegative() }),
});
const planSchema: z.ZodType<PlanResponse> = z.object({
  weeklyProjection: z.array(z.object({ week: z.number().int().min(1).max(12), subs: count })).length(12).refine(rows => new Set(rows.map(r => r.week)).size === 12),
  weeklyActions: z.array(z.object({ week: z.number().int().min(1).max(12), action: z.string() })).length(12).refine(rows => new Set(rows.map(r => r.week)).size === 12),
  crossPlatform: z.object({ mocked: z.literal(true), note: z.string(), instagram: z.unknown(), tiktok: z.unknown() }),
  kpiScorecard: z.array(z.object({ label: z.string(), value: z.number().finite(), trend: z.enum(["up", "down", "flat"]) })),
  opportunityMatrix: z.array(z.object({ pathId, effort: level, projectedGrowth: z.number().finite(), risk: level })),
});
const recalibrationSchema: z.ZodType<RecalibrationResponse> = z.object({
  // predicted/actual are one week's NET new subscribers — negative on a stalled channel, so not `count`.
  week: z.number().int().min(2).max(12), predicted: z.number().finite(), actual: z.number().finite(), deltaPct: z.number().finite(),
  adjustedPlan: z.object({ note: z.string(), changes: z.array(z.string()) }), mocked: z.boolean(),
});
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError"; }
}
export type Report = { diagnosis: DiagnoseResponse; plans: Record<PathId, PlanResponse>; source: "live" | "demo"; notice?: string };
export type ReportResult = { status: "ready"; report: Report } | { status: "unauthenticated" };
export const fixtureReport: Report = { diagnosis: demoDiagnosis, plans: demoPlans, source: "demo" };

async function request<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(30000);
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status}).`);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError(502, "The service returned an incomplete report.");
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
export async function getRecalibration(week: number, demo: boolean, signal?: AbortSignal): Promise<RecalibrationResponse> {
  if (!Number.isInteger(week) || week < 2 || week > 12) throw new ApiError(400, "Choose a checkpoint between weeks 2 and 12.");
  if (demo) return demoRecalibration(week);
  const result = await request(`/api/recalibration?week=${week}`, recalibrationSchema, signal);
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

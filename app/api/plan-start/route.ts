import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPlanRecord, LOOKBACK_OPTIONS } from "@/lib/analysis/evaluation";
import { decodePlan, encodePlan, PLAN_COOKIE_MAX_AGE } from "@/lib/analysis/plan-cookie";
import { auth } from "@/lib/auth";
import { getChannelBundle } from "@/lib/pipeline";
import { PLAN_COOKIE_NAME } from "@/lib/types";
import type { PlanStartResponse } from "@/lib/types";

const bodySchema = z.object({
  pathId: z.enum(["A", "B", "C"]),
  mode: z.enum(["live", "lookback"]),
  lookbackWeeks: z.number().int().refine((n) => (LOOKBACK_OPTIONS as readonly number[]).includes(n)).optional(),
});

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: PLAN_COOKIE_MAX_AGE, secure: process.env.NODE_ENV === "production" };

// The started plan: which path, when it started, and the frozen 8-week baseline. Stored
// in a signed httpOnly cookie (this browser only), so GET is how the page reads it back.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body: PlanStartResponse = { plan: decodePlan(request.cookies.get(PLAN_COOKIE_NAME)?.value) };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan start request." }, { status: 400 });

  try {
    const bundle = await getChannelBundle(session.accessToken);
    const plan = createPlanRecord({
      snapshot: bundle.snapshot,
      channelId: bundle.channel.id,
      pathId: parsed.data.pathId,
      mode: parsed.data.mode,
      lookbackWeeks: parsed.data.lookbackWeeks,
      provenTopics: bundle.shortsStats.provenTopics,
    });
    const body: PlanStartResponse = { plan };
    const response = NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(PLAN_COOKIE_NAME, encodePlan(plan), cookieOptions);
    return response;
  } catch (error) {
    console.error("[api/plan-start]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The plan couldn't be started." }, { status: 422 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body: PlanStartResponse = { plan: null };
  const response = NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(PLAN_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

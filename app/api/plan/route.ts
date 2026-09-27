import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChannelBundle } from "@/lib/pipeline";
import { buildKpiScorecard, buildOpportunityMatrix, buildWeeklyActions } from "@/lib/simulation";
import type { PlanResponse } from "@/lib/types";

// No unlock required — the full initial plan is free (see plan doc, Context section).
// The /dashboard/plan PAGE also always renders regardless of unlock state; only individual
// recalibration weeks beyond week 2 are gated, in /api/recalibration.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pathId = searchParams.get("pathId");
  if (pathId !== "A" && pathId !== "B" && pathId !== "C") {
    return NextResponse.json({ error: "pathId must be A, B, or C." }, { status: 400 });
  }

  try {
    const bundle = await getChannelBundle(session.accessToken);
    const path = bundle.plans.find((p) => p.id === pathId);
    if (!path) return NextResponse.json({ error: "Path not found." }, { status: 404 });

    const body: PlanResponse = {
      weeklyProjection: path.weeklyProjection,
      weeklyActions: buildWeeklyActions(path),
      crossPlatform: {
        mocked: true,
        note: "Instagram and TikTok analytics require platform access not available in this build — pending platform integration.",
        instagram: null,
        tiktok: null,
      },
      kpiScorecard: buildKpiScorecard(bundle.weeklyHistory, bundle.channel.subscriberCount),
      opportunityMatrix: buildOpportunityMatrix(bundle.plans, bundle.channel.subscriberCount),
    };

    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/plan]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The plan could not be generated." },
      { status: 502 }
    );
  }
}

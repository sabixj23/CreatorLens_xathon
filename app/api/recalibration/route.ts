import { NextRequest, NextResponse } from "next/server";
import { evaluateCheckpoint } from "@/lib/analysis/evaluation";
import { decodePlan } from "@/lib/analysis/plan-cookie";
import { auth } from "@/lib/auth";
import { getChannelBundle } from "@/lib/pipeline";
import { CHECKPOINT_WEEKS, PLAN_COOKIE_NAME, UNLOCK_COOKIE_NAME } from "@/lib/types";
import type { CheckpointResponse } from "@/lib/types";

// "Did it work?" at checkpoint week N: the 8 complete weeks before the plan started vs
// the complete weeks since, from real Analytics data — in live mode as weeks pass, or in
// look-back mode against real history. Needs a started plan (409 otherwise).
// Week 2 is always free (the hook). Later weeks require the unlock cookie, checked here —
// the actual enforcement point, not the frontend's isUnlocked().
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const week = Number(request.nextUrl.searchParams.get("week"));
  if (!(CHECKPOINT_WEEKS as readonly number[]).includes(week)) {
    return NextResponse.json({ error: `week must be one of ${CHECKPOINT_WEEKS.join(", ")}.` }, { status: 400 });
  }
  if (week > 2 && request.cookies.get(UNLOCK_COOKIE_NAME)?.value !== "1") {
    return NextResponse.json({ error: "This checkpoint requires an unlock." }, { status: 401 });
  }

  const plan = decodePlan(request.cookies.get(PLAN_COOKIE_NAME)?.value);
  if (!plan) {
    return NextResponse.json({ error: "Start a plan first — checkpoints compare against the weeks before it began." }, { status: 409 });
  }

  try {
    const bundle = await getChannelBundle(session.accessToken);
    if (plan.channelId !== bundle.channel.id) {
      return NextResponse.json({ error: "The started plan belongs to a different channel. Start a new plan." }, { status: 409 });
    }
    const body: CheckpointResponse = evaluateCheckpoint(bundle.snapshot, plan, week);
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/recalibration]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The checkpoint could not be computed." },
      { status: 502 }
    );
  }
}

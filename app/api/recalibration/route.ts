import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChannelBundle } from "@/lib/pipeline";
import { fitGrowthModel, predictWeek, recalibrateWeek, recentAverages } from "@/lib/simulation";
import { UNLOCK_COOKIE_NAME } from "@/lib/types";
import type { RecalibrationResponse } from "@/lib/types";

// Week 2 is always free (the hook). Week 3+ requires the unlock cookie, checked directly
// off the request here — this is the actual enforcement point, not the frontend's
// isUnlocked() (which only decides whether to show the UI eagerly). localStorage would
// not work here at all: it's invisible to a server route.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const week = Number(request.nextUrl.searchParams.get("week"));
  if (!Number.isInteger(week) || week < 1 || week > 12) {
    return NextResponse.json({ error: "week must be an integer between 1 and 12." }, { status: 400 });
  }

  if (week > 2) {
    const unlocked = request.cookies.get(UNLOCK_COOKIE_NAME)?.value === "1";
    if (!unlocked) {
      return NextResponse.json({ error: "This recalibration requires an unlock." }, { status: 401 });
    }
  }

  try {
    const bundle = await getChannelBundle(session.accessToken);

    // The most recent weeks of the creator's OWN real history double as "week 1, 2, 3..."
    // of the recalibration timeline, since a fresh sign-up has no real future weeks yet.
    // This keeps early weeks genuinely real (mocked: false) using the same walk-forward
    // mechanism as the backtest; weeks beyond the real history are clearly scripted.
    const realDemoWeeks = Math.min(4, bundle.weeklyHistory.length);
    let predicted: number;
    let actual: number;
    let mocked: boolean;

    if (week <= realDemoWeeks && bundle.weeklyHistory.length > realDemoWeeks) {
      const historyIndex = bundle.weeklyHistory.length - realDemoWeeks + (week - 1);
      const trainingWindow = bundle.weeklyHistory.slice(0, historyIndex);
      const target = bundle.weeklyHistory[historyIndex];
      const weekModel = fitGrowthModel(trainingWindow);
      predicted = Math.round(predictWeek(weekModel, target.shortsPerWeek, target.longFormPerWeek));
      actual = Math.round(target.netSubs);
      mocked = false;
    } else {
      // Scripted for the demo — this week hasn't happened yet for this creator.
      // Deterministic (not random-per-request) so repeated calls are stable within a demo.
      const { shortsPerWeek, longFormPerWeek } = recentAverages(bundle.weeklyHistory);
      predicted = Math.round(predictWeek(bundle.model, shortsPerWeek, longFormPerWeek));
      const variance = 1 + (((week * 37) % 21) - 10) / 100;
      actual = Math.round(predicted * variance);
      mocked = true;
    }

    const result = recalibrateWeek(predicted, actual);
    const body: RecalibrationResponse = {
      week,
      predicted,
      actual,
      deltaPct: result.deltaPct,
      adjustedPlan: result.adjustedPlan,
      mocked,
    };

    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recalibration could not be computed." },
      { status: 502 }
    );
  }
}

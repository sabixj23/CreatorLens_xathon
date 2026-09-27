import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChannelBundle } from "@/lib/pipeline";
import { recentAverages } from "@/lib/simulation";
import type { DiagnoseResponse } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const bundle = await getChannelBundle(session.accessToken);
    const { shortsPerWeek } = recentAverages(bundle.weeklyHistory);

    const body: DiagnoseResponse = {
      channel: {
        title: bundle.channel.title,
        subscriberCount: bundle.channel.subscriberCount,
        recentShortsPerWeek: Math.round(shortsPerWeek * 10) / 10,
        shortsAnalysed: bundle.shortsStats.count,
        enoughShorts: bundle.shortsStats.enough,
      },
      diagnosis: bundle.diagnosisOutput.diagnosis,
      channelInOneSentence: bundle.diagnosisOutput.channelInOneSentence,
      contentDna: bundle.diagnosisOutput.contentDna,
      ideas: bundle.diagnosisOutput.ideas,
      paths: bundle.paths.map((path) => ({
        id: path.id,
        name: path.name,
        oneLiner: path.oneLiner,
        weekOnePlan: path.weekOnePlan,
        projectedWeek12Subs: path.projectedWeek12Subs,
        tradeOff: path.tradeOff,
      })),
      // null until real — never a placeholder 0, that reads as a claim of perfect accuracy.
      backtest: bundle.backtestResult,
      streak: bundle.streak,
    };

    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Diagnosis could not be completed." },
      { status: 502 }
    );
  }
}

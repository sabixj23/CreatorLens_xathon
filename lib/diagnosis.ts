import { z } from "zod";
import type { ComparableChannelFixture } from "./comparables";
import type { ChannelInOneSentence, ContentDna, Diagnosis, Idea } from "./types";
import type { OwnChannel } from "./youtube";
import type { WeeklyChannelState } from "./simulation";

const ideaSchema = z.object({
  title: z.string().min(1).max(120),
  trendRelevance: z.enum(["high", "medium", "low"]),
  audienceFit: z.enum(["high", "medium", "low"]),
  hooks: z
    .array(z.object({ style: z.enum(["bold", "relatable", "curiosity"]), line: z.string().min(1).max(140) }))
    .min(2)
    .max(3),
});

const diagnosisOutputSchema = z.object({
  headline: z.string().min(1).max(140),
  explanation: z.string().min(1).max(600),
  evidence: z.array(z.string().min(1).max(300)).min(1).max(6),
  channelInOneSentence: z.object({
    then: z.string().min(1).max(200),
    now: z.string().min(1).max(200),
  }),
  ideas: z.array(ideaSchema).min(2).max(3),
});

export type DiagnosisOutput = {
  diagnosis: Diagnosis;
  channelInOneSentence: ChannelInOneSentence;
  contentDna: ContentDna;
  ideas: Idea[];
};

function summariseWeeklyHistory(history: WeeklyChannelState[]): string {
  const recent = history.slice(-8);
  const earlier = history.slice(0, 8);
  const describe = (weeks: WeeklyChannelState[]) => {
    if (weeks.length === 0) return "no data";
    const avgCadence = weeks.reduce((sum, w) => sum + w.cadencePerWeek, 0) / weeks.length;
    const avgShortsPct = weeks.reduce((sum, w) => sum + w.shortsPct, 0) / weeks.length;
    const avgNetSubs = weeks.reduce((sum, w) => sum + w.netSubs, 0) / weeks.length;
    return `avg cadence ${avgCadence.toFixed(1)}/wk, ${Math.round(avgShortsPct * 100)}% Shorts, avg net subs/wk ${avgNetSubs.toFixed(0)}`;
  };
  return `Earliest available weeks: ${describe(earlier)}. Most recent 8 weeks: ${describe(recent)}.`;
}

export async function generateDiagnosis(input: {
  channel: OwnChannel;
  weeklyHistory: WeeklyChannelState[];
  contentDna: ContentDna;
  comparables: ComparableChannelFixture[];
}): Promise<DiagnosisOutput> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const trendContext = input.comparables
    .flatMap((c) => c.recentTopVideos.map((v) => `"${v.title}" (${c.title})`))
    .slice(0, 10)
    .join(", ");

  const prompt = [
    `Channel: ${input.channel.title}, ${input.channel.subscriberCount} subscribers.`,
    summariseWeeklyHistory(input.weeklyHistory),
    `Content DNA computed from this channel's own video history — top topics: ${input.contentDna.topTopics.join(", ") || "none detected"}; top formats by average views: ${input.contentDna.topFormats.join(", ") || "none detected"}; top hook styles by view-weighted frequency: ${input.contentDna.topHookStyles.join(", ") || "none detected"}.`,
    `What's working in this niche right now (recent top videos from comparable channels, for context only — never treat this as this channel's own performance): ${trendContext || "no comparable data available"}.`,
    "",
    "Find ONE sharp, non-obvious reason this channel's growth has stalled, grounded in the numbers above — not generic advice like 'post more consistently'. Cite specific numbers in the evidence array.",
    "Then write a short 'channel in one sentence' before/after contrast: what pattern historically drove growth (`then`), and how the recent period has drifted from it (`now`). Both must be grounded in the data given, not invented.",
    "Then suggest 2-3 next-post ideas. Each idea needs a title, a qualitative trendRelevance and audienceFit (high/medium/low — never a percentage, we don't have grounds for that precision), and 2-3 stylistic hook-line variants (bold, relatable, curiosity).",
    "The channel's video titles may be in any language (e.g. Tamil) — read them as given, but write your entire response in English regardless of the source language.",
    "Return JSON with keys: headline, explanation, evidence (array of strings), channelInOneSentence ({then, now}), ideas (array of {title, trendRelevance, audienceFit, hooks: [{style, line}]}).",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      max_output_tokens: 1400,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: { format: { type: "json_object" } },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Diagnosis generation failed (${response.status}): ${await response.text().catch(() => "")}`);
  }

  const data = await response.json();
  const outputText = (data.output || [])
    .flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
    .filter((item: { type: string }) => item.type === "output_text")
    .map((item: { text: string }) => item.text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("The AI returned an unreadable diagnosis response.");
  }

  const result = diagnosisOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Diagnosis response did not match the expected shape: ${result.error.message}`);
  }

  return {
    diagnosis: {
      headline: result.data.headline,
      explanation: result.data.explanation,
      evidence: result.data.evidence,
    },
    channelInOneSentence: result.data.channelInOneSentence,
    contentDna: input.contentDna,
    ideas: result.data.ideas,
  };
}

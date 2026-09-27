import { z } from "zod";
import type { FormatStats, ShortsStats } from "./format-stats";
import { describeFormatStats, describeShortsStats } from "./format-stats";
import type { ChannelInOneSentence, ContentDna, Diagnosis, Idea } from "./types";
import type { OwnChannel } from "./youtube";
import type { WeeklyChannelState } from "./simulation";

// The model routinely drifts on casing ("High") and length, even when told the rules —
// normalise and clamp rather than rejecting an otherwise-good diagnosis outright.
const clampedString = (max: number) =>
  z.string().trim().min(1).transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));

const level = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const s = value.trim().toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  if (s.includes("med") || s.includes("moderate")) return "medium";
  return s;
}, z.enum(["high", "medium", "low"]));

const hookStyle = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["bold", "relatable", "curiosity"])
);

const ideaSchema = z.object({
  title: clampedString(120),
  trendRelevance: level,
  audienceFit: level,
  hooks: z
    .array(z.object({ style: hookStyle, line: clampedString(140) }))
    .min(2)
    .transform((hooks) => hooks.slice(0, 3)),
});

const diagnosisOutputSchema = z.object({
  headline: clampedString(140),
  explanation: clampedString(600),
  evidence: z.array(clampedString(300)).min(1).transform((items) => items.slice(0, 6)),
  channelInOneSentence: z.object({
    then: clampedString(200),
    now: clampedString(200),
  }),
  ideas: z.array(ideaSchema).min(2).transform((ideas) => ideas.slice(0, 3)),
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
    const avg = (key: "shortsPerWeek" | "longFormPerWeek" | "netSubs") => weeks.reduce((sum, w) => sum + w[key], 0) / weeks.length;
    return `avg ${avg("shortsPerWeek").toFixed(1)} Shorts/wk, ${avg("longFormPerWeek").toFixed(1)} long-form/wk, avg net subs/wk ${avg("netSubs").toFixed(0)}`;
  };
  return `Earliest available weeks: ${describe(earlier)}. Most recent 8 weeks: ${describe(recent)}.`;
}

export async function generateDiagnosis(input: {
  channel: OwnChannel;
  weeklyHistory: WeeklyChannelState[];
  contentDna: ContentDna;
  formatStats: FormatStats;
  shortsStats: ShortsStats;
}): Promise<DiagnosisOutput> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const prompt = [
    `Channel: ${input.channel.title}, ${input.channel.subscriberCount} subscribers.`,
    summariseWeeklyHistory(input.weeklyHistory),
    `Content DNA computed from this channel's own video history — top topics: ${input.contentDna.topTopics.join(", ") || "none detected"}; top formats by average views: ${input.contentDna.topFormats.join(", ") || "none detected"}; top hook styles by view-weighted frequency: ${input.contentDna.topHookStyles.join(", ") || "none detected"}.`,
    `Shorts vs long-form on this channel (its own videos): ${describeFormatStats(input.formatStats)}.`,
    `This channel's Shorts: ${describeShortsStats(input.shortsStats)}`,
    "",
    "CreatorLENS is a YouTube Shorts growth strategist. Use the whole-channel numbers as context, but every recommendation must be about Shorts — never advise making more long-form videos.",
    "Find ONE sharp, non-obvious reason this channel's growth has stalled, framed around its Shorts strategy (topics, hooks, cadence) and grounded in the numbers above — not generic advice like 'post more consistently'. Cite specific numbers in the evidence array.",
    "Then write a short 'channel in one sentence' before/after contrast: what pattern historically drove growth (`then`), and how the recent period has drifted from it (`now`). Both must be grounded in the data given, not invented.",
    "Then suggest 2-3 next Shorts ideas (vertical, under 3 minutes). Each idea needs a title, a qualitative trendRelevance and audienceFit (high/medium/low — never a percentage, we don't have grounds for that precision), and 2-3 stylistic hook-line variants (bold, relatable, curiosity) — each hook is the line spoken or shown in the first 1-2 seconds of the Short.",
    "The channel's video titles may be in any language (e.g. Tamil) — read them as given, but write your entire response in English regardless of the source language.",
    "Return JSON with keys: headline, explanation, evidence (array of strings), channelInOneSentence ({then, now}), ideas (array of {title, trendRelevance, audienceFit, hooks: [{style, line}]}).",
    "Strict format rules: trendRelevance and audienceFit must be exactly one of the lowercase strings \"high\", \"medium\", \"low\". Hook style must be exactly \"bold\", \"relatable\" or \"curiosity\". Length limits in characters: headline 140, explanation 600, each evidence item 300 (max 6 items), then/now 200 each, idea title 120, hook line 140.",
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

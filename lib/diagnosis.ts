import { z } from "zod";
import type { ShortsStats } from "./format-stats";
import { describeShortsStats } from "./format-stats";
import type { ChannelAnalysis, ChannelInOneSentence, ContentDna, Diagnosis, Evidence, Hypothesis, Idea } from "./types";
import type { OwnChannel } from "./youtube";

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

const fmt = (n: number | null) => (n === null ? "n/a" : Number.isInteger(n) ? String(n) : String(n));

export function describeEvidence(e: Evidence): string {
  return `${e.metric}: ${fmt(e.before)} → ${fmt(e.after)} ${e.unit}`;
}

function describeHypothesis(h: Hypothesis): string {
  const evidence = [...h.evidenceFor, ...h.evidenceAgainst].map(describeEvidence).join("; ");
  return `- [${h.status}, evidence strength ${h.strength}] ${h.claim}${evidence ? ` Evidence: ${evidence}.` : ""}${h.note ? ` Note: ${h.note}` : ""}`;
}

// The top finding the diagnosis narrates: first supported, else first mixed hypothesis.
export function topFinding(analysis: ChannelAnalysis): Hypothesis | null {
  return analysis.hypotheses.find((h) => h.status === "supported") ?? analysis.hypotheses.find((h) => h.status === "mixed") ?? null;
}

// Deterministic evidence lines shown on the diagnosis card — never taken from the LLM.
export function diagnosisEvidence(analysis: ChannelAnalysis): string[] {
  const top = topFinding(analysis);
  const items = top ? top.evidenceFor : [];
  if (items.length) return items.slice(0, 4).map(describeEvidence);
  return (analysis.drivers?.changes ?? []).slice(0, 3).map((c) => `${c.label}: ${fmt(c.before)} → ${fmt(c.after)} ${c.unit}`);
}

function deterministicNarrative(analysis: ChannelAnalysis): { headline: string; explanation: string } {
  const top = topFinding(analysis);
  if (analysis.limitedHistory) return { headline: "Not enough history yet for a confident diagnosis.", explanation: "CreatorLENS needs 16 complete weeks to compare your recent Shorts with the period before. Until then, treat the paths as starting points." };
  if (!top) return { headline: "No single cause clearly explains the slowdown.", explanation: analysis.drivers?.statement ?? "The data doesn't point to one reason — test one change at a time." };
  return { headline: top.claim, explanation: analysis.drivers?.statement ?? top.claim };
}

// Every number in the LLM's headline/explanation must already appear in the prompt it was
// given — otherwise the narrative is replaced with the deterministic one.
function numbersAreGrounded(text: string, prompt: string): boolean {
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const normalise = (n: string) => n.replace(/,/g, "");
  const available = new Set((prompt.match(/\d+(?:[.,]\d+)?/g) ?? []).map(normalise));
  return numbers.every((n) => available.has(normalise(n)));
}

export async function generateDiagnosis(input: {
  channel: OwnChannel;
  contentDna: ContentDna;
  analysis: ChannelAnalysis;
  shortsStats: ShortsStats;
}): Promise<DiagnosisOutput> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  const { analysis } = input;
  const top = topFinding(analysis);

  const prompt = [
    `Channel: ${input.channel.title}, ${input.channel.subscriberCount} subscribers. Data through ${analysis.dataThrough} (${analysis.completeWeeks} complete weeks).`,
    analysis.drivers ? `Last 8 complete weeks (${analysis.drivers.windows.after}) vs the 8 before (${analysis.drivers.windows.before}): ${analysis.drivers.statement}` : "Limited history: fewer than 16 complete weeks, so no before/after comparison.",
    ...(analysis.drivers ? analysis.drivers.changes.map((c) => `- ${c.label}: ${fmt(c.before)} → ${fmt(c.after)} ${c.unit}`) : []),
    "Measured hypotheses (statuses are final — do not change them):",
    ...analysis.hypotheses.map(describeHypothesis),
    `Top finding to narrate: ${top ? top.claim : "none is supported — say plainly that no single cause is clearly supported"}.`,
    `Content DNA — top topics: ${input.contentDna.topTopics.join(", ") || "none detected"}; top hook styles: ${input.contentDna.topHookStyles.join(", ") || "none detected"}.`,
    `This channel's Shorts: ${describeShortsStats(input.shortsStats)}`,
    "",
    "CreatorLENS is a YouTube Shorts growth strategist. You NARRATE the measured findings above; you do not analyse the data yourself.",
    "Write a headline (under 14 words) and a 2-sentence explanation of the top finding. Use ONLY numbers that appear above — never compute, round or invent new figures. Don't claim causes the statuses don't support; 'mixed' means signals disagree.",
    "Every recommendation must be about Shorts — never advise making more long-form videos.",
    "Then write a short 'channel in one sentence' before/after contrast (`then` = what drove growth before, `now` = how the recent period drifted), each under 15 words, grounded in the data above.",
    "Then suggest 2-3 next Shorts ideas (vertical, under 3 minutes). Each idea needs a title, a qualitative trendRelevance and audienceFit (high/medium/low — never a percentage), and 2-3 hook-line variants (bold, relatable, curiosity) — each hook is the line spoken or shown in the first 1-2 seconds of the Short.",
    "The channel's video titles may be in any language (e.g. Tamil) — read them as given, but write your entire response in English.",
    "Return JSON with keys: headline, explanation, channelInOneSentence ({then, now}), ideas (array of {title, trendRelevance, audienceFit, hooks: [{style, line}]}).",
    "Strict format rules: trendRelevance and audienceFit must be exactly one of the lowercase strings \"high\", \"medium\", \"low\". Hook style must be exactly \"bold\", \"relatable\" or \"curiosity\". Length limits in characters: headline 140, explanation 600, then/now 200 each, idea title 120, hook line 140.",
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

  // The LLM narrates; the evidence lines are always the deterministic ones. If the
  // narrative introduces a number that wasn't in the prompt, fall back to deterministic text.
  const grounded = numbersAreGrounded(`${result.data.headline} ${result.data.explanation}`, prompt);
  const narrative = grounded ? { headline: result.data.headline, explanation: result.data.explanation } : deterministicNarrative(analysis);
  if (!grounded) console.warn("[diagnosis] LLM narrative contained ungrounded numbers; using deterministic text.");

  return {
    diagnosis: {
      headline: narrative.headline,
      explanation: narrative.explanation,
      evidence: diagnosisEvidence(analysis),
    },
    channelInOneSentence: result.data.channelInOneSentence,
    contentDna: input.contentDna,
    ideas: result.data.ideas,
  };
}

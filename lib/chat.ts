import { z } from "zod";
import type { ChannelBundle } from "./pipeline";

const MAX_HISTORY_TURNS = 6;

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
  .max(MAX_HISTORY_TURNS);

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  history: historySchema,
});

function buildSystemPrompt(bundle: ChannelBundle): string {
  return [
    "You are CreatorLENS's strategist chat, answering questions about ONE specific YouTube channel's growth analysis.",
    "Answer only from the data given below. If something isn't in this data, say you don't have that information — never invent audience, platform, or performance data you weren't given.",
    "This channel's content may be in any language — always reply in English regardless.",
    "CreatorLENS focuses on YouTube Shorts: frame every recommendation around Shorts (topics, hooks, cadence). Don't recommend making more long-form videos.",
    "",
    `Channel: ${bundle.channel.title}, ${bundle.channel.subscriberCount} subscribers.`,
    `Diagnosis headline: ${bundle.diagnosisOutput.diagnosis.headline}`,
    `Diagnosis explanation: ${bundle.diagnosisOutput.diagnosis.explanation}`,
    `Evidence: ${bundle.diagnosisOutput.diagnosis.evidence.join("; ")}`,
    `Content DNA — top topics: ${bundle.diagnosisOutput.contentDna.topTopics.join(", ") || "none detected"}; top formats: ${bundle.diagnosisOutput.contentDna.topFormats.join(", ") || "none detected"}; top hook styles: ${bundle.diagnosisOutput.contentDna.topHookStyles.join(", ") || "none detected"}.`,
    `Shorts: ${bundle.shortsStats.count} analysed; proven topics: ${bundle.shortsStats.provenTopics.join(", ") || "none detected"}; ${bundle.shortsStats.proven.videos} on proven topics, ${bundle.shortsStats.other.videos} on other topics.`,
    `Growth paths: ${bundle.paths.map((p) => `${p.name} (${p.thesis} Actions: ${p.actions.join("; ")}. Trade-off: ${p.tradeOff} Main risk: ${p.mainRisk} Two-week test: ${p.experiment.decisionRule.text} Projected week-12 subs: ${p.projectedWeek12Subs}${p.exploratory ? "; exploratory — no supporting evidence" : ""})`).join(" | ")}`,
    `Measured findings (statuses are final): ${bundle.analysis.hypotheses.map((h) => `${h.claim} [${h.status}, evidence strength ${h.strength}]`).join(" | ")}`,
    bundle.analysis.drivers ? `Last 8 complete weeks vs the 8 before: ${bundle.analysis.drivers.statement}` : "Limited history: fewer than 16 complete weeks.",
    bundle.backtestResult
      ? `Backtest: walk-forward tested against this channel's own past weeks, average error ${bundle.backtestResult.maeSubsPerWeek} subscribers/week over ${bundle.backtestResult.weeksEvaluated} weeks (a simple last-4-weeks median: ${bundle.backtestResult.baselineMaeSubsPerWeek}/week) — a directional signal, not a promise for the 12-week paths.`
      : "Backtest: not yet available — do not state or imply any accuracy number.",
  ].join("\n");
}

export async function generateChatReply(bundle: ChannelBundle, message: string, history: z.infer<typeof historySchema>): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      max_output_tokens: 500,
      input: [
        { role: "system", content: [{ type: "input_text", text: buildSystemPrompt(bundle) }] },
        ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
          role: turn.role,
          content: [{ type: "input_text" as const, text: turn.content }],
        })),
        { role: "user", content: [{ type: "input_text", text: message }] },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Chat reply failed (${response.status}): ${await response.text().catch(() => "")}`);
  }

  const data = await response.json();
  const reply = (data.output || [])
    .flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
    .filter((item: { type: string }) => item.type === "output_text")
    .map((item: { text: string }) => item.text)
    .join("");

  if (!reply) throw new Error("The AI returned an empty reply.");
  return reply;
}

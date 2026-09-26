import { windowGenerationSchema, windowOutputSchema, windowRequestSchema } from "@/lib/analysis/schemas";
import { validateWindow } from "@/lib/analysis/evidence";
import { structured, ApiError } from "@/lib/ai/openai";
import { failure, json, readJson } from "@/lib/ai/http";
import { windowPrompt } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = await readJson(request, windowRequestSchema, 4_000_000);
    try { validateWindow(input); } catch { throw new ApiError("Invalid window evidence references.", 400); }
    const output = await structured({ schema: windowOutputSchema, name: "video_window", instructions: windowPrompt,
      generationSchema: windowGenerationSchema(input.evidence.map(e => e.id)),
      context: { brief: input.brief, window: input.window, evidence: input.evidence }, frames: input.frames,
      signal: request.signal, maxTokens: 2400 });
    validateWindow(input, output.result);
    return json(output);
  } catch (error) { return failure(error, "Scene analysis"); }
}

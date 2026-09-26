import { reviewGenerationSchema, reviewOutputSchema, reviewRequestSchema } from "@/lib/analysis/schemas";
import { validateReview } from "@/lib/analysis/evidence";
import { structured, ApiError } from "@/lib/ai/openai";
import { failure, json, readJson } from "@/lib/ai/http";
import { reviewPrompt } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = await readJson(request, reviewRequestSchema, 500_000);
    try { validateReview(input); } catch { throw new ApiError("Invalid review evidence references or coverage.", 400); }
    const output = await structured({ schema: reviewOutputSchema, name: "video_review", instructions: reviewPrompt,
      generationSchema: reviewGenerationSchema(input.observations.map(o => o.id), input.evidence.map(e => e.id)),
      context: input, signal: request.signal, maxTokens: 3800 });
    validateReview(input, output.result);
    return json(output);
  } catch (error) { return failure(error, "Review synthesis"); }
}

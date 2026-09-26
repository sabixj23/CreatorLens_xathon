import { json } from "@/lib/ai/http";
import { modelName, transcriptionModel } from "@/lib/ai/openai";
import { VERSION } from "@/lib/analysis/schemas";
export function GET() {
  return json({ provider: "OpenAI", model: modelName(), transcriptionModel: transcriptionModel(), version: VERSION });
}

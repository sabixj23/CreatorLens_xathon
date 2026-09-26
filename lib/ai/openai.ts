import { z } from "zod";
import type { Usage } from "../analysis/schemas";

export class ApiError extends Error {
  constructor(message: string, public status = 502, public retryable = false, public retryAfterMs = 0) { super(message); }
}
export function modelName() { return process.env.OPENAI_MODEL || "gpt-4.1-mini"; }
export function transcriptionModel() { return process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"; }
export function timeoutMs() {
  const value = Number(process.env.OPENAI_TIMEOUT_MS || 60000);
  return Number.isFinite(value) ? Math.max(5000, Math.min(120000, value)) : 60000;
}
export async function providerFetch(path: string, body: string | FormData, signal: AbortSignal) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ApiError("AI analysis is not configured. Add OPENAI_API_KEY on the server.", 503);
  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) },
      body, signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs())]), cache: "no-store",
    });
  } catch {
    if (signal.aborted) throw new ApiError("Analysis cancelled.", 499);
    throw new ApiError("The AI request timed out or could not connect.", 504, true);
  }
  if (!response.ok) {
    // Never relay provider bodies: they can contain input data or credentials.
    if (response.status === 401 || response.status === 403) throw new ApiError("The server's OpenAI credentials or model access were rejected.", 503);
    if (response.status === 429) {
      const body = await response.json().catch(() => null);
      if (body?.error?.code === "insufficient_quota") throw new ApiError("The OpenAI project has insufficient quota. Check API billing and limits.", 503);
      const retryAfter = response.headers.get("retry-after");
      const wait = retryAfter ? (Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()) : 0;
      throw new ApiError("OpenAI is rate limited. Please retry shortly.", 429, true, Number.isFinite(wait) ? Math.max(0, Math.min(30000, wait)) : 0);
    }
    throw new ApiError("OpenAI could not process this analysis request.", 502, response.status >= 500);
  }
  return response;
}
export async function structured<T extends z.ZodType>(args: {
  schema: T; generationSchema?: z.ZodType; name: string; instructions: string; context: unknown;
  frames?: { id: string; time: number; image: string }[]; signal: AbortSignal; maxTokens: number;
}): Promise<{ result: z.infer<T>; usage: Usage }> {
  const started = Date.now();
  const schema = z.toJSONSchema(args.generationSchema || args.schema);
  const response = await providerFetch("responses", JSON.stringify({
    model: modelName(), store: false, max_output_tokens: args.maxTokens,
    instructions: args.instructions,
    input: [{ role: "user", content: [
      { type: "input_text", text: JSON.stringify(args.context) },
      ...(args.frames || []).flatMap(f => [
        { type: "input_text", text: `Frame ${f.id} at ${f.time.toFixed(3)} seconds` },
        { type: "input_image", image_url: f.image, detail: "high" },
      ]),
    ] }],
    text: { format: { type: "json_schema", name: args.name, strict: true, schema } },
  }), args.signal);
  const data = await response.json().catch(() => { throw new ApiError("OpenAI returned an unreadable response."); });
  if (data.status !== "completed") throw new ApiError("The AI response was incomplete. Retry this stage.");
  const content = (data.output || []).flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []);
  if (content.some((item: { type: string }) => item.type === "refusal")) throw new ApiError("The AI could not review this content.");
  const output = content.filter((item: { type: string }) => item.type === "output_text").map((item: { text?: string }) => item.text || "").join("");
  let parsed: unknown;
  try { parsed = JSON.parse(output); } catch { throw new ApiError("The AI returned an unreadable result."); }
  const result = args.schema.safeParse(parsed);
  if (!result.success) throw new ApiError("The AI result did not match the analysis format.");
  return { result: result.data, usage: {
    model: typeof data.model === "string" ? data.model : modelName(), inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0, latencyMs: Date.now() - started,
  } };
}

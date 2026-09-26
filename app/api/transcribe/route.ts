import { boundedBody, failure, json } from "@/lib/ai/http";
import { ApiError, providerFetch, transcriptionModel } from "@/lib/ai/openai";
import { validateWav } from "@/lib/media/audio";
import { normaliseTranscript } from "@/lib/analysis/transcript";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const bytes = await boundedBody(request, 3_000_000);
    const form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData().catch(() => { throw new ApiError("Invalid audio form.", 400); });
    const file = form.get("file"), offset = Number(form.get("offset")), declared = Number(form.get("duration"));
    const chunkId = String(form.get("chunkId") || "");
    if (!(file instanceof File) || file.size > 2_900_000 || file.type !== "audio/wav" ||
      !Number.isFinite(offset) || offset < 0 || !Number.isFinite(declared) || declared <= 0 || offset + declared > 90.01 || !/^c\d+$/.test(chunkId)) throw new ApiError("Invalid audio chunk.", 400);
    let duration: number;
    try { duration = validateWav(await file.arrayBuffer()); } catch { throw new ApiError("Unsupported audio encoding.", 400); }
    if (Math.abs(duration - declared) > 0.05) throw new ApiError("Audio duration does not match its evidence.", 400);
    if (transcriptionModel() !== "whisper-1") throw new ApiError("Timestamped transcription requires OPENAI_TRANSCRIPTION_MODEL=whisper-1.", 503);
    const outgoing = new FormData();
    outgoing.set("file", file, "evidence.wav"); outgoing.set("model", transcriptionModel());
    outgoing.set("response_format", "verbose_json"); outgoing.append("timestamp_granularities[]", "segment");
    const started = Date.now();
    const response = await providerFetch("audio/transcriptions", outgoing, request.signal);
    const data = await response.json().catch(() => { throw new ApiError("OpenAI returned unreadable transcription data."); });
    let segments;
    try { segments = normaliseTranscript(data, chunkId, offset, duration); }
    catch { throw new ApiError("The transcript contains invalid segments or timestamps outside the supplied audio. Retry transcription or continue without it."); }
    return json({ segments, usage: { model: transcriptionModel(), inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started } });
  } catch (error) { return failure(error, "Transcription"); }
}

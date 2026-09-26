import { z } from "zod";
import { transcriptSchema, type Transcript } from "./schemas";

const providerTranscriptSchema = z.object({ segments: z.array(z.object({
  start: z.number().finite(), end: z.number().finite(), text: z.string().max(1600),
  no_speech_prob: z.number().optional(), avg_logprob: z.number().optional(),
})).max(250) });
export function normaliseTranscript(data: unknown, chunkId: string, offset: number, duration: number): Transcript[] {
  const parsed = providerTranscriptSchema.parse(data);
  return parsed.segments.flatMap((s, index) => {
    if (!s.text.trim() || (s.no_speech_prob !== undefined && s.no_speech_prob > 0.6 && (s.avg_logprob ?? -2) < -1)) return [];
    if (s.start < 0 || s.end <= s.start || s.start >= duration || s.end > duration + 0.5) throw new Error("Invalid transcription timestamps.");
    return [transcriptSchema.parse({ id: `s_${chunkId}_${index}`, start: offset + s.start,
      end: Math.min(offset + duration, offset + s.end), text: s.text.trim() })];
  }).sort((a, b) => a.start - b.start);
}

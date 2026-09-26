import { z } from "zod";

export const VERSION = "video-v2.2";
export const briefSchema = z.object({
  platform: z.enum(["YouTube Shorts", "Instagram Reels", "TikTok"]),
  topic: z.string().trim().min(1).max(120), audience: z.string().trim().min(1).max(200),
  goal: z.enum(["Educate", "Entertain", "Encourage saves", "Encourage follows"]),
});
const time = z.number().finite().min(0).max(90);
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const intervalSchema = z.object({ start: time, end: time }).refine(v => v.end >= v.start);
export const evidenceSchema = z.object({
  id, modality: z.enum(["frame", "speech", "audio"]), start: time, end: time,
  content: z.string().max(1600),
}).refine(v => v.end >= v.start);
export const frameSchema = z.object({
  id, time, image: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/).max(180_000),
});
export const transcriptSchema = z.object({
  id, start: time, end: time, text: z.string().min(1).max(1600),
}).refine(v => v.end > v.start);
export const windowSchema = z.object({ id, start: time, end: time }).refine(v => v.end > v.start && v.end - v.start <= 10.01);
export const observationSchema = z.object({
  category: z.enum(["opening", "framing", "text", "demonstration", "pacing", "speech", "audio", "alignment", "payoff", "ending"]),
  evidenceIds: z.array(id).min(1).max(12), description: z.string().min(1).max(600),
  uncertainty: z.string().max(300),
});
export const windowOutputSchema = z.object({ observations: z.array(observationSchema).max(8) });
export const observationRecordSchema = observationSchema.extend({ id, windowIds: z.array(id).min(1).max(12) });
export const coverageSchema = z.object({
  totalWindows: z.number().int().min(1).max(12), completedWindows: z.number().int().min(0).max(12),
  missing: z.array(windowSchema).max(12),
  audio: z.enum(["transcribed", "no-speech-detected", "no-audio", "silent", "unavailable", "skipped", "failed"]),
});
export const findingSchema = z.object({
  kind: z.enum(["strength", "improvement"]), title: z.string().min(1).max(90),
  observationIds: z.array(id).min(1).max(8), observation: z.string().min(1).max(500),
  whyItMatters: z.string().min(1).max(400), suggestion: z.string().min(1).max(400),
  priority: z.enum(["high", "medium", "low"]),
});
export const reviewOutputSchema = z.object({
  summary: z.string().min(1).max(900), findings: z.array(findingSchema).min(1).max(6),
  ratings: z.array(z.object({
    component: z.enum(["opening", "visual clarity", "pacing", "speech clarity", "payoff"]),
    score: z.number().int().min(1).max(5).nullable(), reason: z.string().min(1).max(300),
    observationIds: z.array(id).max(8),
  })).max(5),
  exercise: z.string().min(1).max(500),
  cutOrder: z.array(z.object({ evidenceIds: z.array(id).min(1).max(8), reason: z.string().min(1).max(250) })).max(6),
});
export const windowRequestSchema = z.object({
  brief: briefSchema, window: windowSchema, frames: z.array(frameSchema).min(1).max(24),
  evidence: z.array(evidenceSchema).min(1).max(100),
});
export const reviewRequestSchema = z.object({
  brief: briefSchema, duration: z.number().min(5).max(90),
  evidence: z.array(evidenceSchema).min(1).max(500),
  observations: z.array(observationRecordSchema).min(1).max(96), coverage: coverageSchema,
});
// Enumerate the actual references in each request, instead of asking the model
// to generate arbitrary strings that might look like valid IDs.
function referenceEnum(ids: string[]) {
  if (!ids.length) throw new Error("Cannot build a reference schema without evidence.");
  return z.enum([...new Set(ids)] as [string, ...string[]]);
}
export function windowGenerationSchema(evidenceIds: string[]) {
  return windowOutputSchema.extend({ observations: z.array(observationSchema.extend({
    evidenceIds: z.array(referenceEnum(evidenceIds)).min(1).max(12),
  })).max(8) });
}
export function reviewGenerationSchema(observationIds: string[], evidenceIds: string[]) {
  const observations = referenceEnum(observationIds);
  return reviewOutputSchema.extend({
    findings: z.array(findingSchema.extend({ observationIds: z.array(observations).min(1).max(8) })).min(1).max(6),
    ratings: z.array(reviewOutputSchema.shape.ratings.element.extend({ observationIds: z.array(observations).max(8) })).max(5),
    cutOrder: z.array(reviewOutputSchema.shape.cutOrder.element.extend({ evidenceIds: z.array(referenceEnum(evidenceIds)).min(1).max(8) })).max(6),
  });
}
export type Evidence = z.infer<typeof evidenceSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
export type AnalysisWindow = z.infer<typeof windowSchema>;
export type WindowOutput = z.infer<typeof windowOutputSchema>;
export type Observation = z.infer<typeof observationRecordSchema>;
export type Coverage = z.infer<typeof coverageSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type WindowRequest = z.infer<typeof windowRequestSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type Usage = { model: string; inputTokens: number; outputTokens: number; latencyMs: number };
export type AnalysisResult = {
  version: typeof VERSION; runId: string; hash: string; duration: number; createdAt: string;
  status: "ready" | "partial"; review: ReviewOutput; evidence: Evidence[]; observations: Observation[];
  coverage: Coverage; usage: Usage[]; elapsedMs: number;
};

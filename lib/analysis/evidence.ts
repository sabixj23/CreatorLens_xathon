import type { AnalysisWindow, Evidence, Observation, ReviewOutput, ReviewRequest, WindowOutput, WindowRequest } from "./schemas";

// Only fixed, application-authored messages may be exposed to the client.
export class EvidenceValidationError extends Error {}

export function makeWindows(duration: number): AnalysisWindow[] {
  if (!Number.isFinite(duration) || duration < 5 || duration > 90) throw new EvidenceValidationError("Invalid video duration.");
  const windows: AnalysisWindow[] = [];
  for (let start = 0; start < duration; start += 8) {
    windows.push({ id: `w${windows.length + 1}`, start, end: Math.min(start + 10, duration) });
    if (start + 10 >= duration) break;
  }
  return windows;
}
export function overlaps(e: { start: number; end: number }, w: AnalysisWindow) {
  return e.end >= w.start && e.start < w.end;
}
export function assertUnique(items: { id: string }[]) {
  if (new Set(items.map(v => v.id)).size !== items.length) throw new EvidenceValidationError("Duplicate evidence IDs.");
}
export function validateWindow(input: WindowRequest, result?: WindowOutput) {
  assertUnique(input.frames); assertUnique(input.evidence);
  const evidence = new Map(input.evidence.map(e => [e.id, e]));
  if (input.evidence.some(e => !overlaps(e, input.window))) throw new EvidenceValidationError("Evidence lies outside its window.");
  if (input.frames.some(f => {
    const e = evidence.get(f.id);
    return !e || e.modality !== "frame" || e.start !== f.time || e.end !== f.time;
  })) throw new EvidenceValidationError("Frame evidence does not match supplied images.");
  if (input.evidence.some(e => e.modality === "frame" && !input.frames.some(f => f.id === e.id))) throw new EvidenceValidationError("Frame image is missing.");
  if (result?.observations.some(o => o.evidenceIds.some(id => !evidence.has(id)))) throw new EvidenceValidationError("The AI cited unknown evidence.");
  for (const o of result?.observations || []) {
    const modalities = o.evidenceIds.map(id => evidence.get(id)!.modality);
    if (o.category === "speech" && !modalities.includes("speech")) throw new EvidenceValidationError("Speech observation lacks speech evidence.");
    if (o.category === "audio" && !modalities.includes("audio")) throw new EvidenceValidationError("Audio observation lacks measured evidence.");
    if (o.category === "alignment" && !(modalities.includes("frame") && modalities.includes("speech"))) throw new EvidenceValidationError("Alignment lacks both visual and speech evidence.");
    if (["framing", "text", "demonstration"].includes(o.category) && !modalities.includes("frame")) throw new EvidenceValidationError("Visual observation lacks a frame.");
  }
}
export function mergeWindows(results: { window: AnalysisWindow; result: WindowOutput }[]): Observation[] {
  const merged: Observation[] = [];
  for (const { window, result } of [...results].sort((a, b) => a.window.start - b.window.start)) {
    for (const o of result.observations) {
      // Conservative merge: distinct interpretations or uncertainties remain visible.
      const match = merged.find(m => m.category === o.category &&
        m.description.trim().toLowerCase() === o.description.trim().toLowerCase() &&
        m.uncertainty === o.uncertainty && m.evidenceIds.some(id => o.evidenceIds.includes(id)) &&
        new Set([...m.evidenceIds, ...o.evidenceIds]).size <= 12);
      if (match) {
        match.evidenceIds = [...new Set([...match.evidenceIds, ...o.evidenceIds])];
        match.windowIds = [...new Set([...match.windowIds, window.id])];
      } else merged.push({ ...o, id: `o${merged.length + 1}`, windowIds: [window.id] });
    }
  }
  return merged;
}
export function validateReview(input: ReviewRequest, result?: ReviewOutput) {
  assertUnique(input.evidence); assertUnique(input.observations);
  const evidence = new Set(input.evidence.map(e => e.id));
  const observations = new Set(input.observations.map(o => o.id));
  const expected = makeWindows(input.duration);
  if (!input.coverage.completedWindows || input.coverage.totalWindows !== expected.length ||
    input.coverage.completedWindows + input.coverage.missing.length !== expected.length ||
    new Set(input.coverage.missing.map(w => w.id)).size !== input.coverage.missing.length ||
    input.coverage.missing.some(w => !expected.some(e => e.id === w.id && e.start === w.start && e.end === w.end))) throw new EvidenceValidationError("Invalid visual coverage.");
  if (input.evidence.some(e => e.end > input.duration)) throw new EvidenceValidationError("Evidence exceeds video duration.");
  if (!input.evidence.some(e => e.modality === "frame")) throw new EvidenceValidationError("Visual evidence is required.");
  if (input.observations.some(o => o.evidenceIds.some(id => !evidence.has(id)) ||
    o.windowIds.some(id => !expected.some(w => w.id === id) || input.coverage.missing.some(w => w.id === id)))) throw new EvidenceValidationError("Invalid observation references.");
  if (!result) return;
  if (result.findings.some(f => f.observationIds.some(id => !observations.has(id))) ||
    result.ratings.some(r => r.observationIds.some(id => !observations.has(id))) ||
    result.cutOrder.some(c => c.evidenceIds.some(id => !evidence.has(id)))) throw new EvidenceValidationError("The review cited unknown evidence.");
  for (const kind of ["strength", "improvement"]) if (result.findings.filter(f => f.kind === kind).length > 3) throw new EvidenceValidationError("Too many findings.");
  if (new Set(result.ratings.map(r => r.component)).size !== result.ratings.length) throw new EvidenceValidationError("Duplicate ratings.");
  if (result.ratings.some(r => r.score !== null && (!r.observationIds.length ||
    (r.component === "speech clarity" && !r.observationIds.some(id => input.observations.find(o => o.id === id)?.evidenceIds.some(eid => input.evidence.find(e => e.id === eid)?.modality === "speech")))))) throw new EvidenceValidationError("Unsupported rating.");
}
export function findingEvidence(ids: string[], observations: Observation[], evidence: Evidence[]) {
  const refs = new Set(observations.filter(o => ids.includes(o.id)).flatMap(o => o.evidenceIds));
  return evidence.filter(e => refs.has(e.id)).sort((a, b) => a.start - b.start);
}

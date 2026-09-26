"use client";
import { findingEvidence } from "@/lib/analysis/evidence";
import type { AnalysisResult } from "@/lib/analysis/schemas";
import { formatTime } from "@/lib/media";

export function ReviewResults({ result, seek }: { result: AnalysisResult; seek?: (time: number) => void }) {
  const { review, coverage } = result;
  return <div className="results">
    <div className="eyebrow dark">{result.status === "partial" ? "PARTIAL REVIEW" : "YOUR REVIEW"}</div>
    <h2>What your video communicates.</h2>
    <p className="review-summary">{review.summary}</p>
    <p className="coverage-note">Visual coverage: {coverage.completedWindows}/{coverage.totalWindows} windows. Speech: {coverage.audio.replaceAll("-", " ")}.</p>
    {coverage.missing.length > 0 && <p className="error">Missing visual analysis: {coverage.missing.map(w => `${formatTime(w.start)}–${formatTime(w.end)}`).join(", ")}. Retry to complete these intervals.</p>}
    <div className="findings">{review.findings.map((finding, index) => {
      const evidence = findingEvidence(finding.observationIds, result.observations, result.evidence);
      return <article className="finding" key={index}>
        <span className={`tag ${finding.kind}`}>{finding.kind === "strength" ? "Strength" : `${finding.priority} priority`}</span>
        <h3>{finding.title}</h3><p>{finding.observation}</p>
        <small><strong>Why it matters:</strong> {finding.whyItMatters}</small>
        <small><strong>Next cut:</strong> {finding.suggestion}</small>
        <div className="evidence-links">{evidence.map(e => <button key={e.id} className="muted-button" disabled={!seek} onClick={() => seek?.(e.start)} title={e.content}>{e.modality} · {formatTime(e.start)} ↗</button>)}</div>
        {result.observations.filter(o => finding.observationIds.includes(o.id) && o.uncertainty).map(o => <small key={o.id}>Uncertainty: {o.uncertainty}</small>)}
      </article>;
    })}</div>
    <div className="panel analysis-details"><h3>Component ratings</h3><p className="fine-print">Subjective 1–5 rubric: unclear → particularly clear. These are coaching judgments, not predicted performance.</p><div className="rating-grid">{review.ratings.map(r => <div key={r.component}><strong>{r.component}: {r.score === null ? "Not assessed" : `${r.score}/5`}</strong><p>{r.reason}</p></div>)}</div><h3>Try on your next recording</h3><p>{review.exercise}</p>
      {!!review.cutOrder.length && <><h3>Proposed cut order</h3><ol>{review.cutOrder.map((cut, index) => <li key={index}>{cut.evidenceIds.map(id => result.evidence.find(e => e.id === id)).filter(e => !!e).map(e => <button className="muted-button" key={e.id} disabled={!seek} onClick={() => seek?.(e.start)}>{formatTime(e.start)} ↗</button>)} {cut.reason}</li>)}</ol></>}
    </div>
    <details className="panel analysis-details"><summary>Transcript and evidence</summary>{result.evidence.filter(e => e.modality === "speech").length ? result.evidence.filter(e => e.modality === "speech").map(e => <p key={e.id}><button className="muted-button" disabled={!seek} onClick={() => seek?.(e.start)}>{formatTime(e.start)}–{formatTime(e.end)}</button> {e.content}</p>) : <p>No transcript available for this review.</p>}<p className="fine-print">{result.evidence.filter(e => e.modality === "frame").length} sampled frames · {result.evidence.filter(e => e.modality === "audio").length} measured audio intervals. Stills do not establish precise motion; audio levels do not establish perceived sound quality.</p><p className="fine-print">{(result.elapsedMs / 1000).toFixed(1)} seconds for this attempt · {Array.from(new Set(result.usage.map(u => u.model))).join(", ")} · {result.usage.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0).toLocaleString()} reported text/image tokens. Transcription usage is measured by audio duration, not included in this token total.</p></details>
  </div>;
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatTime, inspectVideo } from "@/lib/media";
import { extractVideo, type PreparedVideo } from "@/lib/media/extract";
import { runAnalysis, TranscriptionError, clearAnalysisCache } from "@/lib/analysis/runner";
import { findingEvidence } from "@/lib/analysis/evidence";
import type { AnalysisResult } from "@/lib/analysis/schemas";
import { ReviewResults } from "@/components/video/review-results";
import { getReviews, saveReview } from "@/lib/storage";
import type { Brief, SavedReview } from "@/lib/types";

const initialBrief: Brief = { platform: "YouTube Shorts", topic: "", audience: "", goal: "Educate" };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [prepared, setPrepared] = useState<PreparedVideo | null>(null);
  const [review, setReview] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [transcriptionFailed, setTranscriptionFailed] = useState(false);
  const [unsaved, setUnsaved] = useState<SavedReview | null>(null);
  const [recent, setRecent] = useState<SavedReview[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const frames = prepared?.frames || [];

  useEffect(() => { setRecent(getReviews().slice(0, 3)); return () => { controller.current?.abort(); clearAnalysisCache(); }; }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function cancel() { generation.current++; controller.current?.abort(); setStatus(""); setError("Analysis cancelled. Prepared evidence and completed windows remain available for retry while this page is open."); }
  function begin(message: string) {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const id = ++generation.current; setError(""); setStatus(message);
    return { abort, id };
  }
  async function selectFile(candidate?: File) {
    const { id } = begin("Inspecting video…");
    setReview(null); setPrepared(null); setFile(null); setUrl(""); setDuration(0); setTranscriptionFailed(false); setUnsaved(null); clearAnalysisCache();
    if (!candidate) { setStatus(""); return; }
    try {
      if (!candidate.type.startsWith("video/")) throw new Error("Choose a video file.");
      const metadata = await inspectVideo(candidate);
      if (id !== generation.current) return;
      setFile(candidate); setDuration(metadata.duration); setUrl(URL.createObjectURL(candidate));
    } catch (cause) { if (id === generation.current) setError(cause instanceof Error ? cause.message : "Could not open video."); }
    finally { if (id === generation.current) setStatus(""); }
  }
  async function prepare() {
    if (!file || !brief.topic.trim() || !brief.audience.trim()) { setError("Add a video, topic, and target audience first."); return; }
    const { abort, id } = begin("Preparing video…"); setReview(null); setTranscriptionFailed(false);
    try {
      const result = prepared || await extractVideo(file, AbortSignal.any([abort.signal, AbortSignal.timeout(120000)]), message => { if (id === generation.current) setStatus(message); });
      if (id === generation.current) { setPrepared(result); setDuration(result.duration); }
    } catch (cause) { if (id === generation.current) setError(cause instanceof Error ? cause.message : "Could not extract evidence."); }
    finally { if (id === generation.current) setStatus(""); }
  }
  function persist(saved: SavedReview) {
    try { saveReview(saved); setRecent(getReviews().slice(0, 3)); setUnsaved(null); }
    catch (cause) { setUnsaved(saved); setError(cause instanceof Error ? cause.message : "Could not save review."); }
  }
  async function analyse(visualOnly = false) {
    if (!file || !prepared) return;
    if (!brief.topic.trim() || !brief.audience.trim()) { setError("Add a topic and target audience first."); return; }
    const { abort, id } = begin("Starting analysis…"); setReview(null); setTranscriptionFailed(false); setUnsaved(null);
    const runBrief = { ...brief };
    try {
      const result = await runAnalysis({ prepared, brief: runBrief, signal: abort.signal, visualOnly,
        progress: message => { if (id === generation.current) setStatus(message); } });
      if (id !== generation.current) return;
      setReview(result);
      persist({ id: result.runId, createdAt: result.createdAt, fileName: file.name, duration: result.duration,
        brief: runBrief, summary: result.review.summary,
        findings: result.review.findings.map(f => ({ ...f, frameId: findingEvidence(f.observationIds, result.observations, result.evidence)[0]?.id || "" })),
        frames: result.evidence.map(e => ({ id: e.id, time: e.start })), analysis: result });
    } catch (cause) {
      if (id === generation.current) { setError(cause instanceof Error ? cause.message : "Review failed."); setTranscriptionFailed(cause instanceof TranscriptionError); }
    } finally { if (id === generation.current) setStatus(""); }
  }
  function seek(time: number) { if (videoRef.current) { videoRef.current.currentTime = time; void videoRef.current.play().catch(() => {}); } }

  return <>
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="dot"/> YOUR CREATIVE CO-PILOT</div><h1>Make the <em>next cut</em> count.</h1><p>See what your audience will see. Get useful, timestamped feedback before your short video goes live.</p><a className="button button-light" href="#analyse">Analyse your video <span>↗</span></a><div className="hero-proof"><span>01&nbsp; Upload</span><span>02&nbsp; Review</span><span>03&nbsp; Create better</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-card"><span className="art-play">▶</span><div className="art-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="art-caption">Find the moment that lands.</div></div><div className="art-sticker">✳ <strong>Sharper stories</strong><small>start here</small></div></div></section>
    <section id="analyse" className="section"><div className="section-heading"><div><div className="eyebrow dark">THE PREFLIGHT</div><h2>Your video, through a clearer lens.</h2></div><p>A practical review of your opening, visuals, speech, pacing cues, and payoff, grounded in timestamped evidence.</p></div>
      <div className="work-grid"><div className="panel upload-panel"><div className="panel-heading"><span className="step">01</span><h3>Bring your draft</h3></div><label className="drop-zone"><input type="file" accept="video/mp4,video/*" onChange={event => selectFile(event.target.files?.[0])}/><span className="upload-icon">↑</span><strong>{file ? file.name : "Drop in your video"}</strong><small>{file ? `${formatTime(duration)} · Ready to preview` : "or click to browse · 5–90 seconds · up to 150 MB"}</small></label>{url && <video ref={videoRef} src={url} controls playsInline className="video-preview"/>}<div className="privacy-note">⌁ The original video stays in your browser. It is not uploaded or saved.</div></div>
      <div className="panel brief-panel"><div className="panel-heading"><span className="step">02</span><h3>Set your intention</h3></div><div className="field-row"><label>Platform<select disabled={!!status} value={brief.platform} onChange={e => setBrief({ ...brief, platform: e.target.value as Brief["platform"] })}><option>YouTube Shorts</option><option>Instagram Reels</option><option>TikTok</option></select></label><label>Goal<select disabled={!!status} value={brief.goal} onChange={e => setBrief({ ...brief, goal: e.target.value as Brief["goal"] })}><option>Educate</option><option>Entertain</option><option>Encourage saves</option><option>Encourage follows</option></select></label></div><label>What is this video about?<input disabled={!!status} value={brief.topic} maxLength={120} onChange={e => setBrief({ ...brief, topic: e.target.value })} placeholder="e.g. a 30-second skincare routine"/></label><label>Who is it for?<input disabled={!!status} value={brief.audience} maxLength={200} onChange={e => setBrief({ ...brief, audience: e.target.value })} placeholder="e.g. beginners with sensitive skin"/></label><button className="button button-dark" onClick={prepare} disabled={!file || !!status}>Prepare analysis <span>→</span></button></div></div>
      {prepared && <div className="panel transfer-panel"><div className="panel-heading"><span className="step">03</span><div><h3>Review what leaves your device</h3><p>These {frames.length} sampled frames, your brief, and audio measurements pass through CreatorLENS to OpenAI. {prepared.audioMessage}</p><p>Transcript text is reused with frames for scene analysis. The original video stays on this device. Saved history stays in this browser. Provider retention policies apply.</p><p><strong>Brief:</strong> {brief.topic} · {brief.audience} · {brief.platform} · {brief.goal}</p></div></div><div className="frame-strip">{frames.map(frame => <figure key={frame.id}><img src={frame.image} alt={`Video frame at ${formatTime(frame.time)}`}/><figcaption>{formatTime(frame.time)}</figcaption></figure>)}</div>
        {prepared.audio.map(chunk => <p key={chunk.id}>Audio: {formatTime(chunk.start)}–{formatTime(chunk.end)} · {(chunk.blob.size / 1024 / 1024).toFixed(2)} MB · OpenAI transcription</p>)}
        <div className="analysis-actions"><button className="button button-accent" onClick={() => analyse()} disabled={!!status}>Send evidence for analysis ↗</button>{(transcriptionFailed || prepared.audioStatus === "available") && <button className="muted-button" onClick={() => analyse(true)} disabled={!!status}>Continue without transcription</button>}</div>
      </div>}
      {status && <div className="analysis-actions"><p className="status" role="status">{status}</p><button className="muted-button" onClick={cancel}>Cancel</button></div>}{error && <p className="error" role="alert">{error}</p>}
      {transcriptionFailed && !status && <button className="button button-dark" onClick={() => analyse()}>Retry transcription</button>}
      {unsaved && <button className="muted-button" onClick={() => persist(unsaved)}>Save review again</button>}
      {review && <><ReviewResults result={review} seek={seek}/>{review.coverage.missing.length > 0 && <button className="button button-dark" onClick={() => analyse(review.coverage.audio === "skipped")} disabled={!!status}>Retry missing windows</button>}</>}
    </section>
    <section className="section recent-section"><div className="section-heading"><div><div className="eyebrow dark">KEEP GROWING</div><h2>Your creative trail.</h2></div><Link className="text-link" href="/history">View history →</Link></div><div className="recent-grid">{recent.length ? recent.map(item => <div className="recent-card" key={item.id}><span>{new Date(item.createdAt).toLocaleDateString()}</span><h3>{item.brief.topic}</h3><p>{item.fileName}</p><Link href="/history">Open review ↗</Link></div>) : <div className="empty-card"><span>✳</span><h3>Every great video starts somewhere.</h3><p>Your completed reviews will appear here, saved on this device.</p></div>}</div></section>
  </>;
}

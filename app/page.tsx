"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatTime, inspectVideo, sampleFrames, type SampledFrame } from "@/lib/media";
import { getReviews, saveReview } from "@/lib/storage";
import type { Brief, Finding, SavedReview } from "@/lib/types";

const initialBrief: Brief = { platform: "YouTube Shorts", topic: "", audience: "", goal: "Educate" };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [frames, setFrames] = useState<SampledFrame[]>([]);
  const [review, setReview] = useState<{ summary: string; findings: Finding[] } | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<SavedReview[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { setRecent(getReviews().slice(0, 3)); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function selectFile(candidate?: File) {
    setError(""); setReview(null); setFrames([]);
    if (!candidate) return;
    if (!candidate.type.startsWith("video/")) { setError("Choose a video file."); return; }
    try {
      const metadata = await inspectVideo(candidate);
      setFile(candidate); setDuration(metadata.duration); setUrl(URL.createObjectURL(candidate));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open video."); }
  }

  async function prepare() {
    if (!file || !brief.topic.trim() || !brief.audience.trim()) { setError("Add a video, topic, and target audience first."); return; }
    setError(""); setStatus("Sampling frames on your device…");
    try { setFrames(await sampleFrames(file, duration)); setStatus(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sample frames."); setStatus(""); }
  }

  async function analyse() {
    if (!file || !frames.length) return;
    setError(""); setStatus("Reviewing selected frames…");
    try {
      const response = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, frames }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Review failed.");
      setReview(result);
      const saved: SavedReview = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), fileName: file.name, duration, brief, summary: result.summary, findings: result.findings, frames: frames.map(({ id, time }) => ({ id, time })) };
      saveReview(saved); setRecent(getReviews().slice(0, 3));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed."); }
    finally { setStatus(""); }
  }

  function seek(id: string) {
    const frame = frames.find(item => item.id === id);
    if (frame && videoRef.current) { videoRef.current.currentTime = frame.time; videoRef.current.play(); }
  }

  return <>
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="dot"/> YOUR CREATIVE CO-PILOT</div><h1>Make the <em>next cut</em> count.</h1><p>See what your audience will see. Get useful, timestamped feedback before your short video goes live.</p><a className="button button-light" href="#analyse">Analyse your video <span>↗</span></a><div className="hero-proof"><span>01&nbsp; Upload</span><span>02&nbsp; Review</span><span>03&nbsp; Create better</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-card"><span className="art-play">▶</span><div className="art-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="art-caption">Find the moment that lands.</div></div><div className="art-sticker">✳ <strong>Sharper stories</strong><small>start here</small></div></div></section>
    <section id="analyse" className="section"><div className="section-heading"><div><div className="eyebrow dark">THE PREFLIGHT</div><h2>Your video, through a clearer lens.</h2></div><p>A practical first look at your opening, visuals, pacing cues, and payoff—grounded in frames from your video.</p></div>
      <div className="work-grid"><div className="panel upload-panel"><div className="panel-heading"><span className="step">01</span><h3>Bring your draft</h3></div><label className="drop-zone"><input type="file" accept="video/mp4,video/*" onChange={event => selectFile(event.target.files?.[0])}/><span className="upload-icon">↑</span><strong>{file ? file.name : "Drop in your video"}</strong><small>{file ? `${formatTime(duration)} · Ready to preview` : "or click to browse · 5–90 seconds · up to 150 MB"}</small></label>{url && <video ref={videoRef} src={url} controls playsInline className="video-preview"/>}<div className="privacy-note">⌁ The original video stays in your browser. It is not uploaded or saved.</div></div>
      <div className="panel brief-panel"><div className="panel-heading"><span className="step">02</span><h3>Set your intention</h3></div><div className="field-row"><label>Platform<select value={brief.platform} onChange={e => setBrief({ ...brief, platform: e.target.value as Brief["platform"] })}><option>YouTube Shorts</option><option>Instagram Reels</option><option>TikTok</option></select></label><label>Goal<select value={brief.goal} onChange={e => setBrief({ ...brief, goal: e.target.value as Brief["goal"] })}><option>Educate</option><option>Entertain</option><option>Encourage saves</option><option>Encourage follows</option></select></label></div><label>What is this video about?<input value={brief.topic} maxLength={120} onChange={e => setBrief({ ...brief, topic: e.target.value })} placeholder="e.g. a 30-second skincare routine"/></label><label>Who is it for?<input value={brief.audience} maxLength={200} onChange={e => setBrief({ ...brief, audience: e.target.value })} placeholder="e.g. beginners with sensitive skin"/></label><button className="button button-dark" onClick={prepare} disabled={!file || !!status}>Prepare analysis <span>→</span></button></div></div>
      {frames.length > 0 && <div className="panel transfer-panel"><div className="panel-heading"><span className="step">03</span><div><h3>Review what leaves your device</h3><p>These {frames.length} sampled still frames and your brief will pass through CreatorLENS to OpenAI. No audio or original video is sent in this build.</p></div></div><div className="frame-strip">{frames.map(frame => <figure key={frame.id}><img src={frame.image} alt={`Video frame at ${formatTime(frame.time)}`}/><figcaption>{formatTime(frame.time)}</figcaption></figure>)}</div><button className="button button-accent" onClick={analyse} disabled={!!status}>Send frames for review <span>↗</span></button></div>}
      {status && <p className="status" role="status">{status}</p>}{error && <p className="error" role="alert">{error}</p>}
      {review && <div className="results"><div className="eyebrow dark">YOUR REVIEW</div><h2>What the frames reveal.</h2><p className="review-summary">{review.summary}</p><div className="findings">{review.findings.map((finding, index) => <button className="finding" onClick={() => seek(finding.frameId)} key={index}><span className={`tag ${finding.kind}`}>{finding.kind === "strength" ? "Strength" : "Try this"}</span><span className="finding-time">{formatTime(frames.find(f => f.id === finding.frameId)?.time || 0)} ↗</span><h3>{finding.title}</h3><p>{finding.observation}</p><small><strong>Why it matters:</strong> {finding.whyItMatters}</small><small><strong>Next cut:</strong> {finding.suggestion}</small></button>)}</div><p className="fine-print">This first review sees sampled still frames only. It cannot assess speech, sound, or motion between frames.</p></div>}
    </section>
    <section className="section recent-section"><div className="section-heading"><div><div className="eyebrow dark">KEEP GROWING</div><h2>Your creative trail.</h2></div><Link className="text-link" href="/history">View history →</Link></div><div className="recent-grid">{recent.length ? recent.map(item => <div className="recent-card" key={item.id}><span>{new Date(item.createdAt).toLocaleDateString()}</span><h3>{item.brief.topic}</h3><p>{item.fileName}</p><Link href="/history">Open review ↗</Link></div>) : <div className="empty-card"><span>✳</span><h3>Every great video starts somewhere.</h3><p>Your completed reviews will appear here, saved on this device.</p></div>}</div></section>
  </>;
}

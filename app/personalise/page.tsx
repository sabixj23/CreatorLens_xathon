"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deletePerformance, getPerformance, getReviews, savePerformance } from "@/lib/storage";
import type { Performance, SavedReview } from "@/lib/types";

const metricNames: { key: keyof Performance; label: string }[] = [
  { key: "views", label: "Views" }, { key: "likes", label: "Likes" }, { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" }, { key: "saves", label: "Saves" }, { key: "watchTime", label: "Average watch time (sec)" },
  { key: "completion", label: "Completion rate (%)" },
];

function today() { return new Date().toISOString().slice(0, 10); }

export default function Personalise() {
  const [reviews, setReviews] = useState<SavedReview[]>([]);
  const [snapshots, setSnapshots] = useState<Performance[]>([]);
  const [videoId, setVideoId] = useState("");
  const [url, setUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [measuredAt, setMeasuredAt] = useState(today());
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { const items = getReviews(); setReviews(items); setSnapshots(getPerformance()); setVideoId(new URLSearchParams(window.location.search).get("video") || items[0]?.id || ""); }, []);
  const selected = reviews.find(review => review.id === videoId);
  const selectedSnapshots = snapshots.filter(item => item.videoId === videoId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const latest = selectedSnapshots[0];
  const peers = snapshots.filter(item => item.videoId !== videoId && reviews.find(review => review.id === item.videoId)?.brief.platform === selected?.brief.platform && item.views !== undefined);
  const comparablePeers = latest ? peers.filter(item => {
    const age = (Date.parse(item.measuredAt) - Date.parse(item.publishedAt)) / 86_400_000;
    const selectedAge = (Date.parse(latest.measuredAt) - Date.parse(latest.publishedAt)) / 86_400_000;
    return Math.abs(age - selectedAge) <= 2;
  }) : [];
  const averagePeerViews = comparablePeers.length ? Math.round(comparablePeers.reduce((sum, item) => sum + (item.views || 0), 0) / comparablePeers.length) : null;

  function save(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!selected || !publishedAt || !measuredAt || measuredAt < publishedAt || !Object.values(metrics).some(value => value !== "")) { setError("Choose a reviewed video, valid dates, and at least one metric."); return; }
    const values: Record<string, number> = {};
    for (const { key } of metricNames) {
      const raw = metrics[key]; if (raw === undefined || raw === "") continue;
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 0 || (key === "completion" && number > 100) || (!["watchTime", "completion"].includes(key) && !Number.isInteger(number))) { setError("Check the metric values. Counts must be whole numbers; completion must be 0–100%."); return; }
      values[key] = number;
    }
    const item = { id: crypto.randomUUID(), videoId, url, publishedAt, measuredAt, note, ...values } as Performance;
    savePerformance(item); setSnapshots(getPerformance()); setMetrics({}); setNote("");
  }

  return <section className="section page-section"><div className="page-intro"><div className="eyebrow dark">LEARN FROM THE LIVE POST</div><h1>Post Analysis<span className="period">.</span></h1><p>See what resonated with your audience. Add your published video’s results to plan a better next one.</p></div>
    {reviews.length ? <div className="analysis-grid"><form className="panel metric-form" onSubmit={save}><div className="panel-heading"><span className="step">01</span><div><h2>Add performance</h2><p>Enter numbers from your platform analytics. Results are stored in this browser.</p></div></div><label>Reviewed video<select value={videoId} onChange={e => setVideoId(e.target.value)}>{reviews.map(review => <option key={review.id} value={review.id}>{review.brief.topic} · {review.brief.platform}</option>)}</select></label><label>Published post URL (optional)<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"/></label><div className="field-row"><label>Published on<input type="date" value={publishedAt} onChange={e => setPublishedAt(e.target.value)}/></label><label>Measured on<input type="date" value={measuredAt} onChange={e => setMeasuredAt(e.target.value)}/></label></div><div className="metric-fields">{metricNames.map(({ key, label }) => <label key={key}>{label}<input type="number" min="0" max={key === "completion" ? "100" : undefined} step={["watchTime", "completion"].includes(key) ? "any" : "1"} value={metrics[key] || ""} onChange={e => setMetrics({ ...metrics, [key]: e.target.value })} placeholder="—"/></label>)}</div><label>Audience feedback or creator note (optional)<textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="What did viewers say? Which changes did you make?"/></label><button className="button button-dark" type="submit">Save results →</button>{error && <p className="error" role="alert">{error}</p>}</form>
      <div className="analysis-side"><div className="panel insight-panel"><div className="eyebrow dark">02 / PERFORMANCE OVERVIEW</div><h2>{selected?.brief.topic || "Select a video"}</h2>{latest ? <><div className="meta">Creator-reported · measured {new Date(`${latest.measuredAt}T12:00:00`).toLocaleDateString()}</div><div className="stats">{metricNames.filter(({ key }) => latest[key] !== undefined).map(({ key, label }) => <div key={key}><strong>{latest[key]}</strong><span>{label}</span></div>)}</div><p>{latest.note || "No audience note added yet."}</p><p className="fine-print">These numbers describe the post. They do not show where viewers stopped watching or prove what caused performance.</p></> : <p className="soft-empty">Add your first snapshot to see the post’s actual results here.</p>}</div><div className="panel insight-panel"><div className="eyebrow dark">03 / NEXT VIDEO</div><h2>A practical next experiment.</h2>{latest ? <><p>{averagePeerViews !== null && latest.views !== undefined ? `This post has ${latest.views.toLocaleString()} reported views. ${comparablePeers.length} other ${selected?.brief.platform} post${comparablePeers.length === 1 ? "" : "s"} measured within two days of the same age averaged ${averagePeerViews.toLocaleString()} views. This is a small, descriptive comparison.` : "There is not enough comparable data yet to infer an audience pattern. A useful next step is to test one change and record another result."}</p><div className="experiment">✳ Try one opening that shows the promised result earlier, then compare its measured results after a similar time live.</div></> : <p className="soft-empty">Your next-video ideas will appear once you add results.</p>}</div></div></div> : <div className="empty-card roomy"><span>✳</span><h2>Published a video?</h2><p>Analyse a draft first, then return to add its results and learn what your audience responds to.</p><Link className="button button-dark" href="/">Analyse your first video →</Link></div>}
    {selectedSnapshots.length > 0 && <div className="snapshots"><h2>Saved snapshots</h2>{selectedSnapshots.map(item => <div className="snapshot" key={item.id}><div><strong>{new Date(`${item.measuredAt}T12:00:00`).toLocaleDateString()}</strong><span>{item.views !== undefined ? `${item.views.toLocaleString()} views` : "Views not supplied"} · Creator-reported</span></div><button className="muted-button" onClick={() => { deletePerformance(item.id); setSnapshots(getPerformance()); }}>Delete</button></div>)}</div>}
  </section>;
}

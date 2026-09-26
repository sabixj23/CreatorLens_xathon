"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTime } from "@/lib/media";
import { deleteReview, getReviews } from "@/lib/storage";
import type { SavedReview } from "@/lib/types";

export default function History() {
  const [reviews, setReviews] = useState<SavedReview[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { setReviews(getReviews()); }, []);
  function remove(id: string) { deleteReview(id); setReviews(getReviews()); if (openId === id) setOpenId(null); }
  return <section className="section page-section"><div className="page-intro"><div className="eyebrow dark">YOUR CREATIVE TRAIL</div><h1>History<span className="period">.</span></h1><p>Keep your lessons close. Reviews stay on this device, even after a refresh.</p></div>
    {reviews.length ? <div className="history-list">{reviews.map(review => <article className="history-card" key={review.id}><div className="history-main"><div className="history-index">◉</div><div><div className="meta">{review.brief.platform} · {new Date(review.createdAt).toLocaleDateString()} · {formatTime(review.duration)}</div><h2>{review.brief.topic}</h2><p>For {review.brief.audience} · {review.fileName}</p></div></div><div className="history-actions"><button className="text-link" onClick={() => setOpenId(openId === review.id ? null : review.id)}>{openId === review.id ? "Close" : "View review"} ↗</button><Link className="text-link" href={`/personalise?video=${review.id}`}>Add performance ↗</Link><button className="muted-button" onClick={() => remove(review.id)}>Delete</button></div>{openId === review.id && <div className="saved-review"><p>{review.summary}</p><div className="saved-findings">{review.findings.map((finding, index) => <div key={index}><span className={`tag ${finding.kind}`}>{finding.kind}</span><strong>{finding.title}</strong><p>{finding.observation}</p><small>{finding.suggestion}</small></div>)}</div><p className="fine-print">The original video was not saved. Reopen it from your device to play it.</p></div>}</article>)}</div> : <div className="empty-card roomy"><span>◌</span><h2>Your story starts with a first review.</h2><p>Analyse a video and its findings will be saved here in this browser.</p><Link className="button button-dark" href="/">Analyse a video →</Link></div>}
  </section>;
}

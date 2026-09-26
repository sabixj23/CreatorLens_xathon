"use client";
import { useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "@/lib/analysis/schemas";
import { hashFile } from "@/lib/media/extract";
import { ReviewResults } from "./review-results";

export function SavedAnalysis({ result }: { result: AnalysisResult }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const player = useRef<HTMLVideoElement>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function reselect(file?: File) {
    const id = ++generation.current; setError(""); setUrl("");
    if (!file) return;
    try {
      const hash = await hashFile(file);
      if (id !== generation.current) return;
      if (hash !== result.hash) throw new Error("This file does not match the analysed video. Select the original file.");
      setUrl(URL.createObjectURL(file));
    } catch (cause) { if (id === generation.current) setError(cause instanceof Error ? cause.message : "Could not verify this file."); }
  }
  return <div><label>Reselect the original video for playback<input type="file" accept="video/*" onChange={e => reselect(e.target.files?.[0])}/></label>
    {error && <p className="error" role="alert">{error}</p>}{url && <video className="video-preview" controls playsInline ref={player} src={url}/>}
    <ReviewResults result={result} seek={url ? time => { if (player.current) { player.current.currentTime = time; void player.current.play().catch(() => {}); } } : undefined}/>
  </div>;
}

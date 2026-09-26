"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getRecalibration } from "@/lib/api";
import { isUnlocked, unlock } from "@/lib/storage";
import { number } from "@/lib/format";
import type { RecalibrationResponse } from "@/lib/types";
import { Icon, MockLabel } from "./ui";

type Result = { status: "loading" } | { status: "ready"; data: RecalibrationResponse } | { status: "error"; message: string } | { status: "locked" };
export function WeekTimeline({ demo }: { demo: boolean }) {
  const [week, setWeek] = useState(2);
  const [unlocked, setUnlocked] = useState(false);
  const [result, setResult] = useState<Result>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [cookieError, setCookieError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [checkpointHeight, setCheckpointHeight] = useState<number>();
  const locked = week > 2 && (!unlocked || result.status === "locked");
  useEffect(() => {
    const element = bodyRef.current;
    if (!element || result.status !== "ready" || locked) return;
    const rememberHeight = () => setCheckpointHeight(element.getBoundingClientRect().height);
    rememberHeight();
    const observer = new ResizeObserver(rememberHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [result.status, locked]);
  useEffect(() => { setUnlocked(isUnlocked()); }, []);
  useEffect(() => {
    const sync = () => setUnlocked(isUnlocked());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (week > 2 && !unlocked) { setResult({ status: "locked" }); return () => controller.abort(); }
    setResult({ status: "loading" });
    getRecalibration(week, demo, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ status: "ready", data });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401 && week > 2) { setUnlocked(false); setResult({ status: "locked" }); }
      else setResult({ status: "error", message: error instanceof ApiError && error.status === 401 ? "Your session has expired. Reconnect your channel to view this checkpoint." : "This checkpoint couldn’t be loaded. Your free plan is still available above." });
    });
    return () => controller.abort();
  }, [week, demo, unlocked, attempt]);
  function handleUnlock() {
    if (!unlock()) { setCookieError("Your browser didn’t save the demo cookie. Allow cookies for this site and try again."); return; }
    setCookieError(""); setUnlocked(true); setAttempt(n => n + 1);
  }
  return <div className="timeline-panel panel"><div className="checkpoint-tabs" role="group" aria-label="Recalibration checkpoints">{[2, 3, 4, 8, 12].map(w => <button key={w} type="button" aria-pressed={week === w} onClick={() => setWeek(w)} className={week === w ? "active" : ""}><span>WEEK {String(w).padStart(2, "0")}</span><small>{w === 2 ? "First recalibration" : w > 2 && !unlocked ? <><Icon name="lock" size={12} />Locked</> : "Checkpoint"}</small></button>)}</div>
    <div ref={bodyRef} className="checkpoint-body" style={locked && checkpointHeight ? { minHeight: checkpointHeight } : undefined} aria-live="polite">
      {locked ? <div className="paywall"><span className="lock-badge"><Icon name="lock" size={24} /></span><div><p className="eyebrow">KEEP THE FEEDBACK LOOP GOING</p><h3>Your next recalibration is ready to unlock.</h3><p>Your first checkpoint is free. Continue comparing your plan with what actually happens, and adjust your next move.</p><div className="paywall-bottom"><div><strong>SGD 30<span> / month</span></strong><small>Proposed Pro pricing · to be validated</small></div><button type="button" className="button button-primary" onClick={handleUnlock}>Unlock demo<Icon name="arrow" size={17} /></button></div><p className="fine-print">Demo unlock only. No payment or subscription is created.</p>{cookieError && <p role="alert" className="error-note">{cookieError}</p>}</div></div> : result.status === "loading" || result.status === "locked" ? <div className="checkpoint-loading"><span className="loading-dot" />Loading week {week}…</div> : result.status === "error" ? <div className="checkpoint-error"><p>{result.message}</p><button className="button button-secondary" type="button" onClick={() => setAttempt(n => n + 1)}>Try again</button></div> : <>
        <div className="checkpoint-title"><div><p className="eyebrow">WEEK {String(week).padStart(2, "0")} / RECALIBRATION</p><h3>A plan gets better when it listens.</h3></div>{result.data.mocked ? <MockLabel label="Scripted demo" /> : <span className="live-label"><Icon name="check" size={14} />Actual channel results</span>}</div>
        <div className="checkpoint-metrics"><div><span>Predicted subscribers</span><strong>{number(result.data.predicted)}</strong></div><div><span>{result.data.mocked ? "Scripted actual subscribers" : "Actual subscribers"}</span><strong>{number(result.data.actual)}</strong></div><div><span>Difference from plan</span><strong className="delta">{result.data.deltaPct > 0 ? "+" : ""}{number(result.data.deltaPct)}%</strong></div></div><div className="adjustment"><span className="eyebrow">THE ADJUSTMENT</span><p>{result.data.adjustedPlan.note}</p><ul>{result.data.adjustedPlan.changes.map(change => <li key={change}><Icon name="check" size={15} />{change}</li>)}</ul></div><p className="fine-print">Compared with the saved baseline plan. Exploring another scenario above doesn’t change this checkpoint’s baseline.{result.data.mocked ? " These results illustrate the feedback loop; they are not measured channel performance." : ""}</p>
      </>}
    </div>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { ApiError, getCheckpoint, getStartedPlan, resetPlan, startPlan } from "@/lib/api";
import { isUnlocked, unlock } from "@/lib/storage";
import { number } from "@/lib/format";
import { CHECKPOINT_WEEKS, type CheckpointResponse, type PathId, type PlanMode, type PlanRecord } from "@/lib/types";
import { Decomposition, EvidenceTable } from "./report-cards";
import { Icon, MockLabel } from "./ui";

type Result = { status: "loading" } | { status: "ready"; data: CheckpointResponse } | { status: "error"; message: string } | { status: "locked" };
type PlanState = { status: "loading" } | { status: "ready"; plan: PlanRecord | null } | { status: "error"; message: string };

const LOOKBACK_WEEKS = [12, 8, 4];

// Closing the loop: did the recommended Shorts strategy actually work? Compares the 8
// complete weeks before the plan started with the complete weeks since, at weeks 2, 4, 8
// and 12. Live mode waits for real weeks to pass; look-back mode treats the plan as having
// started N weeks ago, so every number is from the channel's real history.
export function WeekTimeline({ demo, selected, pathName }: { demo: boolean; selected: PathId; pathName: string }) {
  const [planState, setPlanState] = useState<PlanState>({ status: "loading" });
  const [mode, setMode] = useState<PlanMode>("lookback");
  const [lookbackWeeks, setLookbackWeeks] = useState(12);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [week, setWeek] = useState(2);
  const [unlocked, setUnlocked] = useState(false);
  const [result, setResult] = useState<Result>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [cookieError, setCookieError] = useState("");
  const plan = planState.status === "ready" ? planState.plan : null;

  useEffect(() => { setUnlocked(isUnlocked()); }, []);
  useEffect(() => {
    const controller = new AbortController();
    getStartedPlan(demo, controller.signal)
      .then(p => { if (!controller.signal.aborted) setPlanState({ status: "ready", plan: p }); })
      .catch(error => { if (!controller.signal.aborted) setPlanState(error instanceof ApiError && error.status === 401 ? { status: "error", message: "Your session has expired. Reconnect your channel to track a plan." } : { status: "ready", plan: null }); });
    return () => controller.abort();
  }, [demo]);

  useEffect(() => {
    if (!plan) return;
    const controller = new AbortController();
    if (week > 2 && !unlocked) { setResult({ status: "locked" }); return () => controller.abort(); }
    setResult({ status: "loading" });
    getCheckpoint(week, demo, plan, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ status: "ready", data });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401 && week > 2) { setUnlocked(false); setResult({ status: "locked" }); }
      else setResult({ status: "error", message: error instanceof ApiError ? error.message : "This checkpoint couldn’t be loaded." });
    });
    return () => controller.abort();
  }, [plan, week, demo, unlocked, attempt]);

  async function handleStart() {
    setStarting(true); setStartError("");
    try {
      const started = await startPlan({ pathId: selected, mode, lookbackWeeks: mode === "lookback" ? lookbackWeeks : undefined }, demo);
      setPlanState({ status: "ready", plan: started });
      setWeek(2);
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : "The plan couldn't be started.");
    } finally {
      setStarting(false);
    }
  }
  async function handleReset() {
    await resetPlan(demo).catch(() => undefined);
    setPlanState({ status: "ready", plan: null });
  }
  function handleUnlock() {
    if (!unlock()) { setCookieError("Your browser didn’t save the demo cookie. Allow cookies for this site and try again."); return; }
    setCookieError(""); setUnlocked(true); setAttempt(n => n + 1);
  }

  if (planState.status === "loading") return <div className="timeline-panel panel"><div className="checkpoint-loading"><span className="loading-dot" />Checking for a started plan…</div></div>;
  if (planState.status === "error") return <div className="timeline-panel panel"><div className="checkpoint-error"><p>{planState.message}</p></div></div>;

  if (!plan) return <div className="timeline-panel panel plan-start">
    <div><p className="eyebrow">START THIS PLAN</p><h3>Measure whether {pathName} actually works for your channel.</h3><p>We freeze your last 8 complete weeks as the baseline, then compare every checkpoint against it: what you posted, net subscribers, views and conversion — plus what carrying on as before would have produced.</p></div>
    <fieldset className="mode-choice"><legend className="sr-only">How to start</legend>
      <label className={mode === "lookback" ? "is-selected" : ""}><input type="radio" name="plan-mode" checked={mode === "lookback"} onChange={() => setMode("lookback")} /><span><strong>Look back</strong><small>Treat the plan as started in the past and see real results now.</small></span></label>
      <label className={mode === "live" ? "is-selected" : ""}><input type="radio" name="plan-mode" checked={mode === "live"} onChange={() => setMode("live")} /><span><strong>Start this week</strong><small>Checkpoints fill in as your real weeks complete.</small></span></label>
    </fieldset>
    {mode === "lookback" && <div className="lookback-choice" role="group" aria-label="Look back how far">{LOOKBACK_WEEKS.map(n => <button type="button" key={n} aria-pressed={lookbackWeeks === n} className={lookbackWeeks === n ? "active" : ""} onClick={() => setLookbackWeeks(n)}>{n} weeks ago</button>)}</div>}
    <div className="plan-start-actions"><button type="button" className="button button-primary" onClick={handleStart} disabled={starting}>{starting ? "Starting…" : `Start ${pathName}`}<Icon name="arrow" size={17} /></button>{startError && <p role="alert" className="error-note">{startError}</p>}</div>
    <p className="fine-print">{demo ? "Demo channel: the started plan is kept in this page only." : "Stored in a signed cookie in this browser — it won't follow you to another device."}</p>
  </div>;

  const b = plan.baseline;
  return <div className="timeline-panel panel">
    <div className="plan-summary">
      <div><p className="eyebrow">{plan.mode === "lookback" ? "LOOK-BACK PLAN" : "LIVE PLAN"} · {plan.pathName.toUpperCase()}</p><p><strong>Started week of {plan.startWeek}</strong> · planned {plan.plannedShortsPerWeek} Shorts/week ({plan.plannedTestsPerWeek} testing something new)</p><p className="fine-print">Baseline ({b.window}): {number(b.netSubsPerWeek)} net subs/week, normal swing ±{number(b.netSubsMad)} · {number(b.shortsPerWeek)} Shorts/week{b.provenTopicShare !== null ? ` · ${b.provenTopicShare}% on proven topics` : ""}</p></div>
      <button type="button" className="text-link" onClick={handleReset}>Reset plan</button>
    </div>
    {plan.pathId !== selected && <p className="fine-print plan-mismatch">You&apos;re viewing a different path above; checkpoints track the started {plan.pathName} plan.</p>}
    <div className="checkpoint-tabs" role="group" aria-label="Checkpoints">{CHECKPOINT_WEEKS.map(w => <button key={w} type="button" aria-pressed={week === w} onClick={() => setWeek(w)} className={week === w ? "active" : ""}><span>WEEK {String(w).padStart(2, "0")}</span><small>{w === 2 ? "Two-week test · free" : !unlocked ? <><Icon name="lock" size={12} />Locked</> : "Checkpoint"}</small></button>)}</div>
    <div className="checkpoint-body" aria-live="polite">
      {result.status === "locked" ? <div className="paywall"><span className="lock-badge"><Icon name="lock" size={24} /></span><div><p className="eyebrow">KEEP THE FEEDBACK LOOP GOING</p><h3>Your next checkpoint is ready to unlock.</h3><p>Your first checkpoint is free. Keep comparing your channel before and after the plan, and adjust your next move.</p><div className="paywall-bottom"><div><strong>SGD 30<span> / month</span></strong><small>Proposed Pro pricing · to be validated</small></div><button type="button" className="button button-primary" onClick={handleUnlock}>Unlock demo<Icon name="arrow" size={17} /></button></div><p className="fine-print">Demo unlock only. No payment or subscription is created.</p>{cookieError && <p role="alert" className="error-note">{cookieError}</p>}</div></div>
        : result.status === "loading" ? <div className="checkpoint-loading"><span className="loading-dot" />Loading week {week}…</div>
        : result.status === "error" ? <div className="checkpoint-error"><p>{result.message}</p><button className="button button-secondary" type="button" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
        : <CheckpointView data={result.data} />}
    </div>
  </div>;
}

function CheckpointView({ data }: { data: CheckpointResponse }) {
  const cf = data.counterfactual;
  return <>
    <div className="checkpoint-title">
      <div><p className="eyebrow">WEEK {String(data.week).padStart(2, "0")} / DID IT WORK?</p><h3><span className={`status-badge status-${data.verdict.status}`}>{data.verdict.label}</span></h3><p className="verdict-reason">{data.verdict.reason}</p></div>
      {data.mocked ? <MockLabel label="Illustrative demo" /> : <span className="live-label"><Icon name="check" size={14} />{data.mode === "lookback" ? "Your real history (look-back)" : "Your real results"}</span>}
    </div>
    {data.available && <>
      {data.adherence && <p className={`adherence adherence-${data.adherence.status}`}><b>Did you follow the plan?</b> Posted {data.adherence.postedShorts} of {data.adherence.plannedShorts} planned Shorts ({data.adherence.followedPct}%), {data.adherence.postedTests} off proven topics vs {data.adherence.plannedTests} planned tests.</p>}
      <p className="fine-print window-note">Before: {data.window.before} · After: {data.window.after}</p>
      <EvidenceTable items={data.evidence} caption={`Week ${data.week}: before vs after`} />
      <div className="checkpoint-extras">
        <Decomposition value={data.decomposition} note={data.decompositionNote} />
        {cf && <div className="counterfactual"><p className="eyebrow">VS CARRYING ON AS BEFORE</p><p>Your baseline would have produced about <b>{number(cf.expected)}</b> net subscribers over these {data.week} weeks (likely range {number(cf.low)} to {number(cf.high)}). Actual: <b>{number(cf.actual)}</b>.</p></div>}
        {data.experiment && <div className="experiment-result"><p className="eyebrow">TWO-WEEK TEST</p><p>{data.experiment.metricLabel}: <b>{data.experiment.value ?? "—"}</b>{data.experiment.keepAbove !== null && data.experiment.dropBelow !== null ? ` (keep above ${data.experiment.keepAbove}, reconsider below ${data.experiment.dropBelow})` : ""} → <b className={`outcome-${data.experiment.outcome}`}>{data.experiment.outcome === "keep" ? "Keep" : data.experiment.outcome === "drop" ? "Reconsider" : "Inconclusive"}</b></p></div>}
      </div>
    </>}
    <div className="adjustment"><span className="eyebrow">NEXT STEP</span><p>{data.nextStep}</p>{data.caveats.length > 0 && <ul>{data.caveats.map(c => <li key={c}><Icon name="check" size={15} />{c}</li>)}</ul>}</div>
  </>;
}

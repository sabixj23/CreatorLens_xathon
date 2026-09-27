"use client";

import Link from "next/link";
import { useReport } from "./report-provider";
import { BacktestProof, CrossPlatform, IdeaCard, KpiScorecard } from "./report-cards";
import { StrategyFork } from "./strategy-fork";
import { WeekTimeline } from "./week-timeline";
import { WeeklyTimeline } from "./weekly-timeline";
import { SectionHeading } from "./ui";

// Page 2: Strategy, Simulator, Ideas — the "choose and act" half of the report.
// Overview/Diagnosis live on /dashboard (see dashboard-report.tsx).
export function PlanReport() {
  const { state, selected, select, href } = useReport();
  if (state.status !== "ready") return null;
  const { diagnosis, plans, source } = state.report;
  const plan = plans[selected];
  const path = diagnosis.paths.find(p => p.id === selected)!;
  return <>
    <section id="strategy" data-nav-section className="overview-section"><div className="page-heading"><div><p className="eyebrow">YOUR STRATEGIC FORK</p><h1>Three paths. Your call.</h1><p>Different trade-offs. One complete, free 12-week view.</p></div><Link className="text-link" href={href("/dashboard", "overview")}>← Back to your channel</Link></div><StrategyFork diagnosis={diagnosis} plans={plans} selected={selected} onSelect={select} /></section>
    <section id="simulator" data-nav-section className="report-section"><SectionHeading number="01" eyebrow="THE WEEKLY RHYTHM" title="Small steps. A considered direction."><span className="section-pill">{path.name}</span></SectionHeading><p className="section-intro">Click a week to see that week&apos;s action.</p><WeeklyTimeline actions={plan.weeklyActions} /></section>
    <section id="recalibration" className="report-section"><SectionHeading number="02" eyebrow="CLOSE THE LOOP" title="What changed? What comes next?"><p>Week 2 is free. Continue with Pro from week 3.</p></SectionHeading><WeekTimeline demo={source === "demo"} /><BacktestProof backtest={diagnosis.backtest} /></section>
    <section className="report-section" id="scorecard"><SectionHeading number="03" eyebrow="YOUR PERFORMANCE BRIEF" title="Keep the whole picture in view." /><KpiScorecard items={plan.kpiScorecard} /></section>
    <section id="ideas" data-nav-section className="report-section"><SectionHeading number="04" eyebrow="THIS WEEK’S CONTENT" title="Turn the strategy into a starting point."><span className="section-pill">Exploring {path.name}</span></SectionHeading><p className="section-intro">Channel-grounded ideas to consider alongside your chosen plan. Open one to explore three ways in.</p><div className="ideas-list">{diagnosis.ideas.map((idea, i) => <IdeaCard key={idea.title} idea={idea} index={i} />)}</div><p className="fine-print">Ideas come from your channel report. Changing paths changes the weekly actions; it doesn’t generate a new set of ideas.</p></section>
    <CrossPlatform data={plan.crossPlatform} />
  </>;
}

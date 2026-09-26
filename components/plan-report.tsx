"use client";

import Link from "next/link";
import { useReport } from "./report-provider";
import { BacktestProof, BenchmarkTable, CrossPlatform, KpiScorecard, OpportunityMatrix } from "./report-cards";
import { PathChart } from "./path-chart";
import { WeekTimeline } from "./week-timeline";
import { SectionHeading } from "./ui";

export function PlanReport() {
  const { state, selected, select, href } = useReport();
  if (state.status !== "ready") return null;
  const { diagnosis, plans, source } = state.report;
  const plan = plans[selected];
  const path = diagnosis.paths.find(p => p.id === selected)!;
  return <>
    <section id="simulator" data-nav-section className="overview-section"><div className="page-heading"><div><p className="eyebrow">FROM DIRECTION TO DOING</p><h1>The next 12 weeks.</h1><p>Your complete plan. A little more informed, every week.</p></div><Link className="text-link" href={href("/dashboard", "strategy")}>← Back to your strategy</Link></div><div className="plan-status"><span className={`series-dot series-${selected}`} /><strong>{path.name}</strong><span>{path.oneLiner}</span><span className="free-label">INITIAL PLAN · FREE</span></div><div className="panel fork-chart"><PathChart diagnosis={diagnosis} plans={plans} selected={selected} onSelect={select} /></div><OpportunityMatrix items={plan.opportunityMatrix} paths={diagnosis.paths} selected={selected} /></section>
    <section className="report-section" id="weekly-actions"><SectionHeading number="01" eyebrow="THE WEEKLY RHYTHM" title="Small steps. A considered direction."><span className="section-pill">{path.name}</span></SectionHeading><div className="weekly-grid">{[...plan.weeklyActions].sort((a, b) => a.week - b.week).map(item => <article className="weekly-action" key={item.week}><span className="week-number">{String(item.week).padStart(2, "0")}</span><div><span className="eyebrow">WEEK {item.week}</span><p>{item.action}</p></div></article>)}</div></section>
    <section id="recalibration" className="report-section"><SectionHeading number="02" eyebrow="CLOSE THE LOOP" title="What changed? What comes next?"><p>Week 2 is free. Continue with Pro from week 3.</p></SectionHeading><WeekTimeline demo={source === "demo"} /><BacktestProof backtest={diagnosis.backtest} /></section>
    <section className="report-section" id="scorecard"><SectionHeading number="03" eyebrow="YOUR PERFORMANCE BRIEF" title="Keep the whole picture in view." /><KpiScorecard items={plan.kpiScorecard} /></section>
    <section className="report-section" id="benchmark"><SectionHeading number="04" eyebrow="NICHE CONTEXT" title="Perspective, without the leaderboard."><p>Your channel alongside comparable channels.</p></SectionHeading><BenchmarkTable rows={plan.benchmark} /></section>
    <CrossPlatform data={plan.crossPlatform} />
  </>;
}

"use client";

import Link from "next/link";
import { number } from "@/lib/format";
import { useReport } from "./report-provider";
import { BacktestProof, ChannelInOneSentence, ContentDnaBadges, DiagnosisCard, IdeaCard, OpportunityMatrix } from "./report-cards";
import { StrategyFork } from "./strategy-fork";
import { Icon, SectionHeading } from "./ui";

export function DashboardReport() {
  const { state, selected, select, href } = useReport();
  if (state.status !== "ready") return null;
  const { diagnosis: data, plans } = state.report;
  const path = data.paths.find(p => p.id === selected)!;
  return <>
    <section id="overview" data-nav-section className="overview-section"><div className="page-heading"><div><p className="eyebrow">YOUR CHANNEL, IN FOCUS</p><h1>A clearer next move.</h1><p>The patterns behind your plateau. The possibilities ahead.</p></div><div className="report-edition"><span>CHANNEL BRIEF</span><strong>01 <span>/ STRATEGY</span></strong></div></div><div className="channel-strip"><div className="channel-avatar" aria-hidden="true">{data.channel.title.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("")}</div><div className="channel-name"><h2>{data.channel.title}</h2><span><Icon name="youtube" size={14} />YouTube channel</span></div><div className="channel-stat"><strong>{number(data.channel.subscriberCount)}</strong><span>subscribers</span></div><div className="channel-stat"><strong>{number(data.channel.recentCadencePerWeek)}</strong><span>uploads / week</span></div></div><ChannelInOneSentence value={data.channelInOneSentence} /></section>
    <section id="diagnosis" data-nav-section className="report-section"><SectionHeading number="01" eyebrow="THE DIAGNOSIS" title="The pattern beneath the plateau."><span className="section-pill">Evidence → insight</span></SectionHeading><DiagnosisCard diagnosis={data.diagnosis} /><BacktestProof backtest={data.backtest} /></section>
    <section id="content-dna" data-nav-section className="report-section"><SectionHeading number="02" eyebrow="CONTENT DNA" title="The things that make you, you."><p>Your strongest topics, formats, and opening styles.</p></SectionHeading><ContentDnaBadges dna={data.contentDna} /></section>
    <section id="strategy" data-nav-section className="report-section"><SectionHeading number="03" eyebrow="YOUR STRATEGIC FORK" title="Three paths. Your call."><p>Different trade-offs. One complete, free 12-week view.</p></SectionHeading><StrategyFork diagnosis={data} plans={plans} selected={selected} onSelect={select} /><OpportunityMatrix items={plans[selected].opportunityMatrix} paths={data.paths} selected={selected} /><div className="section-bottom"><p>You’re exploring <strong>{path.name}</strong>. You can change paths at any time.</p><Link className="button button-primary" href={href("/dashboard/plan", "simulator")}>Explore the weekly plan<Icon name="arrow" /></Link></div></section>
    <section id="ideas" data-nav-section className="report-section"><SectionHeading number="04" eyebrow="THIS WEEK’S CONTENT" title="Turn the strategy into a starting point."><span className="section-pill">Exploring {path.name}</span></SectionHeading><p className="section-intro">Channel-grounded ideas to consider alongside your chosen plan. Open one to explore three ways in.</p><div className="ideas-list">{data.ideas.map((idea, i) => <IdeaCard key={idea.title} idea={idea} index={i} />)}</div><p className="fine-print">Ideas come from your channel report. Changing paths changes the weekly actions; it doesn’t generate a new set of ideas.</p></section>
  </>;
}

"use client";

import Link from "next/link";
import { number } from "@/lib/format";
import { MIN_SHORTS } from "@/lib/types";
import { useReport } from "./report-provider";
import { ChannelInOneSentence, DiagnosisCard } from "./report-cards";
import { StreakBadge } from "./streak-badge";
import { Icon, SectionHeading } from "./ui";

// Page 1: Overview and Diagnosis, then a prompt onward. Strategy/Simulator/Ideas live on
// /dashboard/plan (see plan-report.tsx) — split into two pages instead of one long
// scroll, so a first-time visitor isn't asked to take in everything at once.
export function DashboardReport() {
  const { state, href } = useReport();
  if (state.status !== "ready") return null;
  const { diagnosis: data, source } = state.report;
  return <>
    <section id="overview" data-nav-section className="overview-section"><div className="page-heading"><div><p className="eyebrow">YOUR CHANNEL, IN FOCUS</p><h1>A clearer next move.</h1><p>The patterns behind your plateau. The possibilities ahead.</p></div><div className="report-edition"><span>CHANNEL BRIEF</span><strong>01 <span>/ STRATEGY</span></strong></div></div><div className="channel-strip"><div className="channel-avatar" aria-hidden="true">{data.channel.title.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("")}</div><div className="channel-name"><h2>{data.channel.title}</h2><span><Icon name="youtube" size={14} />YouTube channel</span></div><div className="channel-stat"><strong>{number(data.channel.subscriberCount)}</strong><span>subscribers</span></div><div className="channel-stat"><strong>{number(data.channel.recentShortsPerWeek)}</strong><span>Shorts / week</span></div></div>{!data.channel.enoughShorts && <div className="shorts-notice"><strong>Not enough Shorts yet</strong><p>We found {data.channel.shortsAnalysed} Short{data.channel.shortsAnalysed === 1 ? "" : "s"} on this channel. CreatorLENS builds its strategy from your Shorts history, so treat the paths below as a starting point until you have at least {MIN_SHORTS}.</p></div>}<StreakBadge streak={data.streak} demo={source === "demo"} /><ChannelInOneSentence value={data.channelInOneSentence} /></section>
    <section id="diagnosis" data-nav-section className="report-section"><SectionHeading number="01" eyebrow="THE DIAGNOSIS" title="The pattern beneath the plateau."><span className="section-pill">Evidence → insight</span></SectionHeading><DiagnosisCard diagnosis={data.diagnosis} /></section>
    <section className="report-section next-step"><div><p className="eyebrow">NEXT / YOUR CURATED STRATEGY</p><h2>See your three strategy paths, the week-by-week plan, and grounded content ideas next.</h2></div><Link className="button button-primary" href={href("/dashboard/plan", "strategy")}>Explore the weekly plan<Icon name="arrow" /></Link></section>
  </>;
}

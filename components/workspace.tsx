"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CONNECTION_AVAILABLE } from "@/lib/api";
import { ChatPanel } from "./chat-panel";
import { useReport } from "./report-provider";
import { ConnectLink, Icon, MockLabel } from "./ui";

const nav = [
  { label: "Overview", section: "overview", path: "/dashboard", icon: "grid" as const },
  { label: "Diagnosis", section: "diagnosis", path: "/dashboard", icon: "diagnosis" as const },
  { label: "Content DNA", section: "content-dna", path: "/dashboard", icon: "dna" as const },
  { label: "Strategy", section: "strategy", path: "/dashboard", icon: "paths" as const },
  { label: "Simulator", section: "simulator", path: "/dashboard/plan", icon: "chart" as const },
  { label: "Ideas", section: "ideas", path: "/dashboard", icon: "bulb" as const },
];
export function StagedLoader() {
  const [stage, setStage] = useState(0);
  const messages = ["Reading your channel history", "Looking for the patterns that matter", "Bringing your strategy into focus"];
  useEffect(() => { const timer = setInterval(() => setStage(s => Math.min(s + 1, 2)), 4500); return () => clearInterval(timer); }, []);
  return <div className="loading-report"><p className="eyebrow">A CLEARER PICTURE IS TAKING SHAPE</p><h1>Your history has a story.</h1><p role="status" aria-live="polite"><span className="loading-dot" />{messages[stage]}…</p><div className="skeleton skeleton-title" /><div className="skeleton skeleton-report" /><div className="dna-grid">{[1, 2, 3].map(n => <div className="skeleton skeleton-card" key={n} />)}</div></div>;
}
export function Workspace({ children }: { children: ReactNode }) {
  const { state, href, retry } = useReport();
  const pathname = usePathname();
  const [active, setActive] = useState(pathname.endsWith("/plan") ? "simulator" : "overview");
  useEffect(() => {
    setActive(pathname.endsWith("/plan") ? "simulator" : "overview");
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-100px 0px -55% 0px", threshold: 0 });
    document.querySelectorAll("[data-nav-section]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname, state.status]);
  if (state.status === "unauthenticated") {
    return <div className="signin-screen">
      <div className="signin-card">
        <div className="connect-orbit"><Icon name="youtube" size={36} /></div>
        <p className="eyebrow">YOUR CHANNEL. A CLEARER DIRECTION.</p>
        <h1>Sign in to see your strategy.</h1>
        <p>{CONNECTION_AVAILABLE ? "Connect the YouTube channel you own to turn your history into a strategy grounded in your actual results." : "Explore the complete strategy experience with a demo channel. YouTube connection will become available with the live service."}</p>
        <div className="button-row">{CONNECTION_AVAILABLE && <ConnectLink>Continue with Google</ConnectLink>}<Link className="button button-secondary" href="/dashboard?demo=1">Preview a demo channel<Icon name="arrow" /></Link></div>
        <p className="fine-print">Your initial 12-week plan and first recalibration are free.</p>
      </div>
    </div>;
  }
  return <div className="workspace"><aside className="sidebar"><p className="eyebrow sidebar-label">YOUR WORKSPACE</p><nav aria-label="Report sections">{nav.map(item => <Link key={item.section} href={href(item.path, item.section)} className={active === item.section && pathname === item.path ? "active" : ""} aria-current={active === item.section && pathname === item.path ? "location" : undefined}><Icon name={item.icon} size={18} /><span>{item.label}</span></Link>)}</nav><div className="sidebar-note"><span className="small-orbit" aria-hidden="true">◎</span><h3>Strategy is a loop.</h3><p>Understand. Choose.<br />Create. Recalibrate.</p><span className="sidebar-note-line" /></div><div className="sidebar-bottom"><Icon name="youtube" size={16} /><span>YouTube intelligence</span></div></aside><div className="report-content">
    {state.status === "loading" ? <StagedLoader /> : <>
      <div className="report-breadcrumb"><span>WORKSPACE <span aria-hidden="true">/</span> {pathname.endsWith("/plan") ? "YOUR GROWTH PLAN" : "CHANNEL OVERVIEW"}</span>{state.report.source === "demo" ? <MockLabel note="All channel figures in this report are illustrative." /> : <span className="live-label"><span className="status-dot" />Connected channel</span>}</div>
      {state.report.source === "demo" && <div className="demo-notice"><p>{state.report.notice || "You're exploring an illustrative channel. All metrics, ideas, and scenarios below are demo data."}</p>{state.report.notice ? <button onClick={retry} type="button">Retry live report ↗</button> : <Link href="/dashboard?connect=1">Use your channel ↗</Link>}</div>}
      {children}
      <ChatPanel />
    </>}
    <footer className="report-footer"><span>CreatorLENS / A clearer next move.</span><span>Evidence first. Your call, always.</span></footer>
  </div></div>;
}

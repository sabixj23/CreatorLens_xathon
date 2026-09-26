"use client";

import { useState } from "react";
import type { PathId } from "@/lib/types";
import { demoDiagnosis, demoPlans } from "@/lib/data/fixture";
import { PathChart } from "./path-chart";
import { MockLabel } from "./ui";

export function LandingFork() {
  const [selected, setSelected] = useState<PathId>("B");
  const path = demoDiagnosis.paths.find(p => p.id === selected)!;
  return <div className="landing-fork"><div className="brief-top"><span className="eyebrow">STRATEGY BRIEF / 001</span><MockLabel label="Illustrative example" /></div><div className="brief-title"><div><h2>Three ways forward.</h2><p>The Everyday Table · YouTube</p></div><span className="brief-horizon">12<span>WEEKS</span></span></div><PathChart diagnosis={demoDiagnosis} plans={demoPlans} selected={selected} onSelect={setSelected} showTable={false} /><div className={`brief-tradeoff series-${selected}`}><span className="eyebrow">{path.name} / THE TRADE-OFF</span><p>{path.tradeOff}</p></div><div className="brief-bottom"><span>YOUR HISTORY → YOUR OPTIONS</span><span>No single “best” path.</span></div></div>;
}

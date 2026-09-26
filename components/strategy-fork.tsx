"use client";

import type { DiagnoseResponse, PathId, PlanResponse } from "@/lib/types";
import { number } from "@/lib/format";
import { PathChart } from "./path-chart";
import { Icon } from "./ui";

export function StrategyFork({ diagnosis, plans, selected, onSelect }: { diagnosis: DiagnoseResponse; plans: Record<PathId, PlanResponse>; selected: PathId; onSelect: (id: PathId) => void }) {
  return <><div className="strategy-cards" role="group" aria-label="Choose your strategy">{diagnosis.paths.map((path, i) => <button type="button" className={`strategy-card series-${path.id} ${selected === path.id ? "is-selected" : ""}`} aria-pressed={selected === path.id} onClick={() => onSelect(path.id)} key={path.id}><span className="strategy-top"><span>PATH 0{i + 1}</span><span className="selection-indicator">{selected === path.id && <Icon name="check" size={12} />}</span></span><h3>{path.name}</h3><p>{path.oneLiner}</p><div className="strategy-outcome"><strong>{number(path.projectedWeek12Subs)}</strong><span>subscribers · week-12 scenario</span></div><div className="strategy-tradeoff">{path.tradeOff}</div></button>)}</div><div className="panel fork-chart"><PathChart diagnosis={diagnosis} plans={plans} selected={selected} onSelect={onSelect} /></div><div className="week-one panel"><div><p className="eyebrow">START HERE · WEEK 01</p><h3>{diagnosis.paths.find(p => p.id === selected)?.name}</h3></div><ul>{diagnosis.paths.find(p => p.id === selected)?.weekOnePlan.map(action => <li key={action}><Icon name="check" size={16} />{action}</li>)}</ul></div></>;
}

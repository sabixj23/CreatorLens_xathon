"use client";

import type { DiagnoseResponse, HypothesisId, PathId, PlanResponse } from "@/lib/types";
import { number } from "@/lib/format";
import { PathChart } from "./path-chart";
import { Icon } from "./ui";

const EVIDENCE_LABEL: Record<HypothesisId, string> = {
  cadence: "Shorts cadence",
  format_mix: "Format mix",
  conversion: "Conversion",
  outlier_dependence: "Hit dependence",
  topic_shift: "Topic drift",
};

export function StrategyFork({ diagnosis, plans, selected, onSelect }: { diagnosis: DiagnoseResponse; plans: Record<PathId, PlanResponse>; selected: PathId; onSelect: (id: PathId) => void }) {
  const path = diagnosis.paths.find(p => p.id === selected)!;
  const test = path.experiment;
  return <>
    <div className="strategy-cards" role="group" aria-label="Choose your strategy">{diagnosis.paths.map((p, i) => <button type="button" className={`strategy-card series-${p.id} ${selected === p.id ? "is-selected" : ""}`} aria-pressed={selected === p.id} onClick={() => onSelect(p.id)} key={p.id}>
      <span className="strategy-top"><span>PATH 0{i + 1}</span><span className="selection-indicator">{selected === p.id && <Icon name="check" size={12} />}</span></span>
      <h3>{p.name}</h3>
      <p>{p.thesis}</p>
      <span className={`evidence-badge ${p.exploratory ? "is-exploratory" : ""}`}>{p.exploratory ? "Exploratory — no supporting evidence yet" : `Backed by: ${p.evidenceIds.map(id => EVIDENCE_LABEL[id]).join(", ")} · ${p.evidenceStrength} strength`}</span>
      <div className="strategy-outcome"><strong>{number(p.projectedWeek12Subs)}</strong><span>subscribers · week-12 scenario</span></div>
      <div className="strategy-tradeoff">{p.tradeOff}</div>
    </button>)}</div>
    <div className="panel fork-chart"><PathChart diagnosis={diagnosis} plans={plans} selected={selected} onSelect={onSelect} /></div>
    <div className="path-detail panel">
      <div className="path-detail-main">
        <p className="eyebrow">{path.name.toUpperCase()} · WHAT YOU&apos;LL DO</p>
        <ul className="path-actions">{path.actions.map(action => <li key={action}><Icon name="check" size={16} />{action}</li>)}</ul>
        <dl className="path-facts">
          <div><dt>Key assumption</dt><dd>{path.assumption}</dd></div>
          <div><dt>Main risk</dt><dd>{path.mainRisk}</dd></div>
          <div><dt>Effort</dt><dd className="capitalize">{path.effort}</dd></div>
        </dl>
      </div>
      <div className="two-week-test">
        <p className="eyebrow">TWO-WEEK TEST</p>
        <h4>{test.assumption}</h4>
        <ul>{test.schedule.map(line => <li key={line}>{line}</li>)}</ul>
        <p><b>Primary measure:</b> {test.primaryMetric.label} <span className="fine-print">({test.primaryMetric.scope})</span></p>
        <p><b>Decision rule:</b> {test.decisionRule.text}</p>
        <p className="fine-print"><b>Hold roughly constant:</b> {test.holdConstant.join(" · ")}. <b>Minimum data:</b> {test.minimumData}</p>
      </div>
    </div>
  </>;
}

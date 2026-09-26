"use client";

import { useId } from "react";
import { compact, number } from "@/lib/format";
import type { DiagnoseResponse, PathId, PlanResponse } from "@/lib/types";

export function PathChart({ diagnosis, plans, selected, onSelect, showTable = true }: {
  diagnosis: DiagnoseResponse; plans: Record<PathId, PlanResponse>; selected: PathId; onSelect: (id: PathId) => void; showTable?: boolean;
}) {
  const id = useId();
  const initial = diagnosis.channel.subscriberCount;
  const values = [initial, ...Object.values(plans).flatMap(p => p.weeklyProjection.map(w => w.subs))];
  const range = Math.max(...values) - Math.min(...values) || Math.max(initial * 0.05, 100);
  const min = Math.max(0, Math.min(...values) - range * 0.13);
  const max = Math.max(...values) + range * 0.14;
  const x = (week: number) => 63 + week / 12 * 540;
  const y = (subs: number) => 236 - (subs - min) / (max - min) * 195;
  const styles = { A: { color: "var(--path-a)", glow: "var(--glow-a)", dash: undefined }, B: { color: "var(--path-b)", glow: "var(--glow-b)", dash: "7 4" }, C: { color: "var(--path-c)", glow: "var(--glow-c)", dash: "2 5" } };
  const gid = id.replace(/:/g, "");
  return <div className="path-chart">
    <div className="chart-toolbar"><span className="chart-unit">SUBSCRIBERS</span><div className="chart-legend" role="group" aria-label="Highlight a strategy">{diagnosis.paths.map(path => <button key={path.id} type="button" aria-pressed={selected === path.id} onClick={() => onSelect(path.id)} className={`legend-button series-${path.id}`}><span className={`legend-line line-${path.id}`} />{path.name}</button>)}</div></div>
    <figure aria-labelledby={`${id}-caption`}>
      <div className="chart-scroll" tabIndex={0} role="region" aria-label="12-week scenario chart, scroll horizontally on small screens">
        <svg viewBox="0 0 710 280" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
          <title id={`${id}-title`}>Three possible 12-week subscriber trajectories</title>
          <desc id={`${id}-desc`}>Modelled scenarios, not forecasts. {diagnosis.paths.map(p => `${p.name}: ${number(p.projectedWeek12Subs)} subscribers at week 12.`).join(" ")} Uncertainty increases further into the plan.</desc>
          <defs>{diagnosis.paths.map(path => <linearGradient key={path.id} id={`${gid}-area-${path.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={styles[path.id].color} stopOpacity=".22" /><stop offset="100%" stopColor={styles[path.id].color} stopOpacity="0" /></linearGradient>)}</defs>
          <rect x={x(2)} y="27" width={x(12) - x(2)} height="209" fill="currentColor" opacity=".018" />
          {[0, 1, 2, 3].map(i => { const value = min + (max - min) * i / 3; return <g key={i}><line x1="63" x2="608" y1={y(value)} y2={y(value)} className="chart-grid" /><text x="48" y={y(value) + 4} textAnchor="end" className="chart-tick">{compact(value)}</text></g>; })}
          {[0, 2, 4, 8, 12].map(week => <text key={week} x={x(week)} y="260" textAnchor="middle" className="chart-tick">{week === 0 ? "Now" : `W${week}`}</text>)}
          <line x1={x(2)} x2={x(2)} y1="27" y2="236" className="chart-grid" strokeDasharray="3 5" />
          <text x={x(2) + 12} y="19" className="chart-small">LONGER HORIZON · GREATER UNCERTAINTY</text>
          <g className="chart-series">{diagnosis.paths.map(path => {
            const points = [{ week: 0, subs: initial }, ...plans[path.id].weeklyProjection].sort((a, b) => a.week - b.week);
            const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.week)},${y(p.subs)}`).join(" ");
            const last = points[points.length - 1];
            const area = `${d} L${x(last.week)},236 L${x(0)},236 Z`;
            return <g key={path.id} className={`path-series${selected === path.id ? " is-active" : ""}`} opacity={selected === path.id ? 1 : 0.38} style={{ "--glow": styles[path.id].glow } as React.CSSProperties}>
              <path d={area} className="path-area" fill={`url(#${gid}-area-${path.id})`} />
              <path d={d} className="path-line" fill="none" stroke={styles[path.id].color} strokeWidth={selected === path.id ? 3 : 2} strokeDasharray={styles[path.id].dash} strokeLinecap="round" />
              <circle cx={x(12)} cy={y(last.subs)} r="4" className="path-end" fill={styles[path.id].color} />
              <text x={x(12) + 14} y={y(last.subs) + 5} fill={styles[path.id].color} className="chart-value">{compact(last.subs)}</text>
            </g>;
          })}</g>
          <circle cx={x(0)} cy={y(initial)} r="4" fill="var(--text)" />
        </svg>
      </div>
      <figcaption id={`${id}-caption`}><span className="scenario-dot" />Scenario, not a forecast. Assumes the historical relationship between cadence, format mix, and growth continues. Later weeks are more uncertain.</figcaption>
    </figure>
    {showTable && <details className="projection-details"><summary>View the weekly numbers<span aria-hidden="true">+</span></summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Weekly subscriber scenarios"><table><caption className="sr-only">Projected subscribers by strategy, all 12 weeks</caption><thead><tr><th scope="col">Week</th>{diagnosis.paths.map(p => <th scope="col" key={p.id}>{p.name}</th>)}</tr></thead><tbody>{Array.from({ length: 12 }, (_, i) => <tr key={i}><th scope="row">{i + 1}</th>{diagnosis.paths.map(p => <td key={p.id}>{number(plans[p.id].weeklyProjection.find(w => w.week === i + 1)?.subs ?? 0)}</td>)}</tr>)}</tbody></table></div></details>}
  </div>;
}

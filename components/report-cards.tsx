import { compact, number } from "@/lib/format";
import type { ChannelAnalysis, DiagnoseResponse, Evidence, EvidenceStatus, PathId, PlanResponse } from "@/lib/types";
import { MockLabel } from "./ui";

export function ChannelInOneSentence({ value }: { value: DiagnoseResponse["channelInOneSentence"] }) {
  return <div className="channel-sentence"><div><p className="eyebrow">THE CHANNEL THEY FOUND</p><p>{value.then}</p></div><span className="sentence-arrow" aria-hidden="true">→</span><div><p className="eyebrow">THE CHANNEL THEY SEE NOW</p><p>{value.now}</p></div></div>;
}
export function DiagnosisCard({ diagnosis }: { diagnosis: DiagnoseResponse["diagnosis"] }) {
  return <article className="diagnosis-card"><div className="diagnosis-main"><div className="eyebrow"><span className="status-dot" />THE STRATEGIC READ</div><h3>{diagnosis.headline}</h3><ul className="explanation-points">{diagnosis.explanation.map((point, i) => <li key={i}>{point}</li>)}</ul></div><div className="evidence"><p className="eyebrow">WHAT THE HISTORY SHOWS</p><ol>{diagnosis.evidence.map((item, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol></div></article>;
}
export function IdeaCard({ idea, index }: { idea: DiagnoseResponse["ideas"][number]; index: number }) {
  return <details className="idea-card"><summary><span className="idea-number">0{index + 1}</span><span className="idea-summary"><strong>{idea.title}</strong><span className="fit-pills"><span>Audience fit <b>{idea.audienceFit}</b></span><span>Trend relevance <b>{idea.trendRelevance}</b></span></span></span><span className="idea-expand"><span className="desktop-only">View hooks</span><span aria-hidden="true">+</span></span></summary><div className="hook-list">{idea.hooks.map(hook => <div className="hook" key={hook.style}><span className="eyebrow">{hook.style}</span><p>“{hook.line}”</p></div>)}</div></details>;
}
export function KpiScorecard({ items }: { items: PlanResponse["kpiScorecard"] }) {
  return <div className="kpi-grid">{items.map(item => <article className="kpi-card" key={item.label}><p>{item.label}</p><div><strong>{item.value < 100 ? number(item.value) : compact(item.value)}</strong><span className={`trend trend-${item.trend}`}><span aria-hidden="true">{item.trend === "up" ? "↗" : item.trend === "down" ? "↘" : "→"}</span> {item.trend}</span></div></article>)}</div>;
}
export function OpportunityMatrix({ items, paths, selected }: { items: PlanResponse["opportunityMatrix"]; paths: DiagnoseResponse["paths"]; selected: PathId }) {
  return <div className="matrix"><div className="table-scroll" tabIndex={0} role="region" aria-label="Strategy trade-off comparison"><table><caption>THE TRADE-OFF, AT A GLANCE</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Effort</th><th scope="col">Scenario growth</th><th scope="col">Risk</th></tr></thead><tbody>{items.map(item => <tr key={item.pathId} className={selected === item.pathId ? "selected-row" : ""}><th scope="row"><span className={`series-dot series-${item.pathId}`} />{paths.find(p => p.id === item.pathId)?.name || item.pathId}</th><td className={`capitalize level-${item.effort}`}><span className="level-dot" aria-hidden="true" />{item.effort}</td><td>{item.projectedGrowth >= 0 ? "+" : ""}{number(item.projectedGrowth)} subs</td><td className={`capitalize level-${item.risk}`}><span className="level-dot" aria-hidden="true" />{item.risk}</td></tr>)}</tbody></table></div></div>;
}
export function BacktestProof({ backtest }: { backtest: DiagnoseResponse["backtest"] }) {
  if (!backtest) return null;
  const beatsBaseline = backtest.maeSubsPerWeek < backtest.baselineMaeSubsPerWeek;
  return <div className="backtest-panel"><span className="eyebrow">TESTED AGAINST YOUR HISTORY</span><h3>±{number(backtest.maeSubsPerWeek)} subscribers/week average error</h3><p>Walk-forward self-backtest over {backtest.weeksEvaluated} past weeks of {backtest.channelsTested === 1 ? "your own channel" : `${backtest.channelsTested} channels`}: each week predicted using only the weeks before it. A simple &ldquo;median of the last 4 weeks&rdquo; guess was off by ±{number(backtest.baselineMaeSubsPerWeek)}/week over the same weeks{beatsBaseline ? "" : " — the model doesn't beat it here, so projections lean on your recent baseline"}. This is short-range error, not a promise for the 12-week paths.</p></div>;
}
export function CrossPlatform({ data }: { data: PlanResponse["crossPlatform"] }) {
  return <section className="cross-platform panel"><div><p className="eyebrow">BEYOND YOUTUBE</p><h3>One idea. More places to explore.</h3><p>{data.note}</p></div><MockLabel label="Mocked preview" /><div className="cross-options"><div><strong>Instagram</strong><span>Cross-post your best-performing Short as a Reel.</span></div><div><strong>TikTok</strong><span>Re-cut your top Short with a TikTok-native hook.</span></div></div></section>;
}

// ─── Deterministic analysis ──────────────────────────────────────────────────

export const STATUS_LABEL: Record<EvidenceStatus, string> = { supported: "Supported", mixed: "Mixed", not_supported: "Not supported", insufficient_data: "Not enough data" };

const fmtValue = (v: number | null) => (v === null ? "—" : Math.abs(v) >= 1000 ? compact(v) : number(v));

export function EvidenceTable({ items, caption }: { items: Evidence[]; caption: string }) {
  if (!items.length) return null;
  const caveats = [...new Set(items.map(e => e.caveat).filter(Boolean))];
  return <div className="table-scroll evidence-table" tabIndex={0} role="region" aria-label={caption}><table><caption className="sr-only">{caption}</caption><thead><tr><th scope="col">Measure</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Unit</th></tr></thead><tbody>{items.map(e => <tr key={e.id + e.metric}><th scope="row">{e.metric}</th><td>{fmtValue(e.before)}</td><td>{fmtValue(e.after)}</td><td className="unit">{e.unit}</td></tr>)}</tbody></table>{caveats.map(c => <p className="fine-print" key={c}>{c}</p>)}</div>;
}

export function Decomposition({ value, note }: { value: NonNullable<ChannelAnalysis["drivers"]>["decomposition"]; note?: string | null }) {
  if (!value) return note ? <div className="decomposition"><p className="eyebrow">WHERE THE CHANGE CAME FROM</p><p className="decomp-note">{note}</p></div> : null;
  const max = Math.max(Math.abs(value.reachEffect), Math.abs(value.rateEffect), 1);
  const bar = (label: string, v: number) => <div className="decomp-row"><span>{label}</span><div className="decomp-track"><i className={v >= 0 ? "pos" : "neg"} style={{ width: `${(Math.abs(v) / max) * 50}%`, [v >= 0 ? "left" : "right"]: "50%" }} /></div><strong>{v >= 0 ? "+" : ""}{number(v)}/wk</strong></div>;
  return <div className="decomposition"><p className="eyebrow">WHERE THE CHANGE CAME FROM</p>{bar("Views (reach)", value.reachEffect)}{bar("Subscribers per view (conversion)", value.rateEffect)}<p className="fine-print">Total change: {value.totalChange >= 0 ? "+" : ""}{number(value.totalChange)} net subscribers/week. Arithmetic split of views × subscribers-per-view — descriptive, not proof of cause.</p></div>;
}

export function AnalysisPanel({ analysis }: { analysis: ChannelAnalysis }) {
  const d = analysis.drivers;
  return <div className="analysis-panel panel">
    <div className="analysis-head"><div><p className="eyebrow">WHAT THE NUMBERS SAY</p><h3>{d ? d.statement : "Not enough history for a before/after comparison yet."}</h3>{d && <p className="fine-print">Last {d.windows.weeksEach} complete weeks ({d.windows.after}) vs the {d.windows.weeksEach} before ({d.windows.before}). Data through {analysis.dataThrough}.</p>}</div></div>
    {analysis.limitedHistory && <p className="shorts-notice-inline">CreatorLENS needs 16 complete weeks to compare periods; found {analysis.completeWeeks}. Claims below are suppressed until then.</p>}
    {d && <div className="analysis-grid">
      <div><p className="eyebrow">BIGGEST CHANGES</p><ul className="driver-list">{d.changes.slice(0, 6).map(c => <li key={c.id}><span>{c.label}</span><strong>{fmtValue(c.before)} → {fmtValue(c.after)}</strong><em className={c.changePct === null ? "" : c.changePct < 0 ? "down" : "up"}>{c.changePct === null ? `${c.absoluteChange !== null && c.absoluteChange >= 0 ? "+" : ""}${fmtValue(c.absoluteChange)} ${c.unit}` : `${c.changePct > 0 ? "+" : ""}${c.changePct}%`}</em></li>)}</ul></div>
      <Decomposition value={d.decomposition} note={d.decompositionNote} />
    </div>}
    {analysis.changePoints.length > 0 && <p className="fine-print">{analysis.changePoints.map(c => `${c.metric === "netSubs" ? "Weekly net subscribers" : "Weekly views"} shifted from a median of ${number(c.beforeMedian)} to ${number(c.afterMedian)} around the week of ${c.weekStart} (approximate).`).join(" ")}</p>}
    <div className="hypotheses"><p className="eyebrow">POSSIBLE CAUSES, CHECKED AGAINST YOUR DATA</p>{analysis.hypotheses.map(h => <details className={`hypothesis status-${h.status}`} key={h.id}><summary><span className={`status-badge status-${h.status}`}>{STATUS_LABEL[h.status]}</span><span className="hypothesis-claim">{h.claim}</span><span className="strength">Evidence strength: {h.strength}</span></summary>{h.note && <p className="fine-print">{h.note}</p>}<EvidenceTable items={[...h.evidenceFor, ...h.evidenceAgainst.filter(a => !h.evidenceFor.some(f => f.id === a.id))]} caption={h.claim} /></details>)}<p className="fine-print">Statuses come from fixed rules with counter-checks, not from the AI. Evidence strength reflects data volume and agreement — it isn&apos;t a probability of cause.</p></div>
    <p className="fine-print">{analysis.formats.note}{analysis.outliers.suppressed ? ` Outlier check skipped: needs 10 Shorts in the cohort (found ${analysis.outliers.n}).` : ` Top ${analysis.outliers.topCount} of ${analysis.outliers.n} recent Shorts account for ${analysis.outliers.subsShareOfTop ?? "—"}% of their attributed subscriber gains.`}</p>
  </div>;
}

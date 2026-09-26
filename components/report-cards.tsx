import { compact, number } from "@/lib/format";
import type { DiagnoseResponse, PathId, PlanResponse } from "@/lib/types";
import { Icon, MockLabel } from "./ui";

export function ChannelInOneSentence({ value }: { value: DiagnoseResponse["channelInOneSentence"] }) {
  return <div className="channel-sentence"><div><p className="eyebrow">THE CHANNEL THEY FOUND</p><p>{value.then}</p></div><span className="sentence-arrow" aria-hidden="true">→</span><div><p className="eyebrow">THE CHANNEL THEY SEE NOW</p><p>{value.now}</p></div></div>;
}
export function DiagnosisCard({ diagnosis }: { diagnosis: DiagnoseResponse["diagnosis"] }) {
  return <article className="diagnosis-card"><div className="diagnosis-main"><div className="eyebrow"><span className="status-dot" />THE STRATEGIC READ</div><h3>{diagnosis.headline}</h3><p>{diagnosis.explanation}</p></div><div className="evidence"><p className="eyebrow">WHAT THE HISTORY SHOWS</p><ol>{diagnosis.evidence.map((item, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol></div></article>;
}
export function ContentDnaBadges({ dna }: { dna: DiagnoseResponse["contentDna"] }) {
  const groups = [{ label: "Topics that resonate", value: dna.topTopics, icon: "bulb" as const }, { label: "Formats to build on", value: dna.topFormats, icon: "grid" as const }, { label: "Your opening language", value: dna.topHookStyles, icon: "dna" as const }];
  return <div className="dna-grid">{groups.map((g, i) => <article className="dna-card" key={g.label}><div className="dna-card-top"><Icon name={g.icon} /><span className="index-label">0{i + 1}</span></div><h3>{g.label}</h3><div className="dna-tags">{g.value.map(v => <span key={v}>{v}</span>)}</div></article>)}</div>;
}
export function IdeaCard({ idea, index }: { idea: DiagnoseResponse["ideas"][number]; index: number }) {
  return <details className="idea-card"><summary><span className="idea-number">0{index + 1}</span><span className="idea-summary"><strong>{idea.title}</strong><span className="fit-pills"><span>Audience fit <b>{idea.audienceFit}</b></span><span>Trend relevance <b>{idea.trendRelevance}</b></span></span></span><span className="idea-expand"><span className="desktop-only">View hooks</span><span aria-hidden="true">+</span></span></summary><div className="hook-list">{idea.hooks.map(hook => <div className="hook" key={hook.style}><span className="eyebrow">{hook.style}</span><p>“{hook.line}”</p></div>)}</div></details>;
}
export function KpiScorecard({ items }: { items: PlanResponse["kpiScorecard"] }) {
  return <div className="kpi-grid">{items.map(item => <article className="kpi-card" key={item.label}><p>{item.label}</p><div><strong>{item.value < 100 ? number(item.value) : compact(item.value)}</strong><span className={`trend trend-${item.trend}`}><span aria-hidden="true">{item.trend === "up" ? "↗" : item.trend === "down" ? "↘" : "→"}</span> {item.trend}</span></div></article>)}</div>;
}
export function BenchmarkTable({ rows }: { rows: PlanResponse["benchmark"] }) {
  const me = rows.find(r => r.isMe);
  const peers = rows.filter(r => !r.isMe);
  if (!me || peers.length === 0) return <p className="empty-note">Comparable channel data is not available yet.</p>;
  const range = (key: "cadencePerWeek" | "formatMixPct", suffix = "") => `${number(Math.min(...peers.map(r => r[key])))}–${number(Math.max(...peers.map(r => r[key])))}${suffix}`;
  return <div className="panel benchmark-panel"><div className="table-scroll"><table><caption className="sr-only">Your channel compared with the range among comparable channels</caption><thead><tr><th scope="col">Measure</th><th scope="col">You</th><th scope="col">Niche range</th></tr></thead><tbody><tr><th scope="row">Uploads / week</th><td>{number(me.cadencePerWeek)}</td><td>{range("cadencePerWeek")}</td></tr><tr><th scope="row">Format mix</th><td>{number(me.formatMixPct)}%</td><td>{range("formatMixPct", "%")}</td></tr></tbody></table></div><p className="fine-print">Current snapshots from {peers.length} comparable channels. Descriptive context, not a ranking or an input to your subscriber projection.</p></div>;
}
export function OpportunityMatrix({ items, paths, selected }: { items: PlanResponse["opportunityMatrix"]; paths: DiagnoseResponse["paths"]; selected: PathId }) {
  return <div className="matrix"><div className="table-scroll" tabIndex={0} role="region" aria-label="Strategy trade-off comparison"><table><caption>THE TRADE-OFF, AT A GLANCE</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Effort</th><th scope="col">Scenario growth</th><th scope="col">Risk</th></tr></thead><tbody>{items.map(item => <tr key={item.pathId} className={selected === item.pathId ? "selected-row" : ""}><th scope="row"><span className={`series-dot series-${item.pathId}`} />{paths.find(p => p.id === item.pathId)?.name || item.pathId}</th><td className="capitalize">{item.effort}</td><td>{item.projectedGrowth >= 0 ? "+" : ""}{number(item.projectedGrowth)} subs</td><td className="capitalize">{item.risk}</td></tr>)}</tbody></table></div></div>;
}
export function BacktestProof({ backtest }: { backtest: DiagnoseResponse["backtest"] }) {
  if (!backtest) return null;
  return <div className="backtest-panel"><span className="eyebrow">TESTED AGAINST YOUR HISTORY</span><h3>{number(backtest.meanErrorPct)}% mean error</h3><p>Walk-forward backtest across the past weeks of {backtest.channelsTested === 1 ? "your own channel" : `${backtest.channelsTested} channels`}. This measures short-range error, not 12-week accuracy.</p></div>;
}
export function CrossPlatform({ data }: { data: PlanResponse["crossPlatform"] }) {
  return <section className="cross-platform panel"><div><p className="eyebrow">BEYOND YOUTUBE</p><h3>One idea. More places to explore.</h3><p>{data.note}</p></div><MockLabel label="Mocked preview" /><div className="cross-options"><div><strong>Instagram</strong><span>A recipe carousel or a behind-the-scenes Reel.</span></div><div><strong>TikTok</strong><span>A useful moment from your next practical guide.</span></div></div></section>;
}

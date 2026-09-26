"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getChosenPath, setChosenPath } from "@/lib/storage";
import type { DiagnoseResponse, PathId } from "@/lib/types";

// Minimal free-tier dashboard — the frontend track owns the real executive-summary
// framing, staged loading copy, KPI scorecard, benchmark table, opportunity matrix,
// and anchor-nav sidebar. This wires the contract up end to end: diagnosis, Content DNA,
// ideas, and the full (free) 3-path plan, so the backend routes are exercisable.
export default function Dashboard() {
  const [data, setData] = useState<DiagnoseResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "unauthenticated" | "error" | "ready">("loading");
  const [selectedPath, setSelectedPath] = useState<PathId | null>(null);

  useEffect(() => {
    setSelectedPath(getChosenPath());
    fetch("/api/diagnose", { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          setStatus("unauthenticated");
          return;
        }
        if (!response.ok) {
          setStatus("error");
          return;
        }
        setData(await response.json());
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <p className="status">Reading your channel&apos;s history…</p>;

  if (status === "unauthenticated") {
    return (
      <section className="section">
        <p>Connect your YouTube channel to see your diagnosis.</p>
        <a className="button button-dark" href="/api/connect">
          Connect YouTube
        </a>
      </section>
    );
  }

  if (status === "error" || !data) {
    return <p className="error">The diagnosis could not be loaded. Try again shortly.</p>;
  }

  function choosePath(pathId: PathId) {
    setSelectedPath(pathId);
    setChosenPath(pathId);
  }

  return (
    <section className="section">
      <h1>{data.channel.title}</h1>
      <p>
        {data.channel.subscriberCount.toLocaleString()} subscribers · {data.channel.recentCadencePerWeek}/week recent cadence
      </p>

      <blockquote>
        <p>{data.channelInOneSentence.then}</p>
        <p>But over the last 12 weeks: {data.channelInOneSentence.now}</p>
      </blockquote>

      <article>
        <h2>{data.diagnosis.headline}</h2>
        <p>{data.diagnosis.explanation}</p>
        <ul>
          {data.diagnosis.evidence.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </article>

      <section>
        <h3>Content DNA</h3>
        <p>Top topics: {data.contentDna.topTopics.join(", ") || "not enough data yet"}</p>
        <p>Top formats: {data.contentDna.topFormats.join(", ") || "not enough data yet"}</p>
        <p>Top hook styles: {data.contentDna.topHookStyles.join(", ") || "not enough data yet"}</p>
      </section>

      <section>
        <h3>This week&apos;s content</h3>
        {data.ideas.map((idea, i) => (
          <div key={i}>
            <strong>{idea.title}</strong> — trend: {idea.trendRelevance}, audience fit: {idea.audienceFit}
            <ul>
              {idea.hooks.map((hook, j) => (
                <li key={j}>
                  [{hook.style}] {hook.line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h3>Your 12-week growth simulation</h3>
        {data.paths.map((path) => (
          <div key={path.id}>
            <h4>{path.name}</h4>
            <p>{path.oneLiner}</p>
            <p>Trade-off: {path.tradeOff}</p>
            <p>Modelled trajectory (a scenario, not a forecast) — projected week 12: {path.projectedWeek12Subs.toLocaleString()} subs</p>
            <button onClick={() => choosePath(path.id)} className={selectedPath === path.id ? "button button-accent" : "button"}>
              {selectedPath === path.id ? "Selected" : "Choose this path"}
            </button>
          </div>
        ))}
      </section>

      {data.backtest ? (
        <p className="fine-print">
          Backtest: walk-forward tested against this channel&apos;s own past weeks, mean error {data.backtest.meanErrorPct}% — directional, not a
          guarantee.
        </p>
      ) : (
        <p className="fine-print">Backtest not yet available — not enough historical data to measure accuracy yet.</p>
      )}

      <Link href="/dashboard/plan" className="button button-dark">
        View full plan and weekly recalibration →
      </Link>
    </section>
  );
}

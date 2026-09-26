"use client";

import { useEffect, useState } from "react";
import { getChosenPath, isUnlocked, unlock } from "@/lib/storage";
import type { PlanResponse, RecalibrationResponse } from "@/lib/types";

// Minimal paid-tier + recalibration page — the frontend track owns the real WeekTimeline,
// KpiScorecard, BenchmarkTable, OpportunityMatrix, MockLabel, and Paywall components.
// This page deliberately never redirects: it holds free content (the full plan, week 2's
// recalibration) — only individual weeks beyond week 2 render locked, inline, below.
export default function PlanPage() {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [week, setWeek] = useState(2);
  const [recalibration, setRecalibration] = useState<RecalibrationResponse | { locked: true } | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(isUnlocked());
    const pathId = getChosenPath() ?? "B";
    fetch(`/api/plan?pathId=${pathId}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setPlan)
      .catch(() => setPlan(null));
  }, []);

  useEffect(() => {
    fetch(`/api/recalibration?week=${week}`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          setRecalibration({ locked: true });
          return;
        }
        setRecalibration(response.ok ? await response.json() : null);
      })
      .catch(() => setRecalibration(null));
  }, [week, unlocked]);

  function handleUnlock() {
    unlock();
    setUnlocked(true);
  }

  if (!plan) return <p className="status">Loading plan…</p>;

  return (
    <section className="section">
      <h1>Your full 12-week plan</h1>

      <section>
        <h3>Weekly projection</h3>
        <table>
          <tbody>
            {plan.weeklyProjection.map((point) => (
              <tr key={point.week}>
                <td>Week {point.week}</td>
                <td>{point.subs.toLocaleString()} subs (modelled — a scenario, not a forecast)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Weekly actions</h3>
        <ul>
          {plan.weeklyActions.map((item) => (
            <li key={item.week}>
              Week {item.week}: {item.action}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>KPI scorecard</h3>
        {plan.kpiScorecard.map((tile) => (
          <p key={tile.label}>
            {tile.label}: {tile.value.toLocaleString()} ({tile.trend})
          </p>
        ))}
      </section>

      <section>
        <h3>Niche benchmark</h3>
        <table>
          <tbody>
            {plan.benchmark.map((row) => (
              <tr key={row.channelLabel} style={row.isMe ? { fontWeight: "bold" } : undefined}>
                <td>{row.channelLabel}</td>
                <td>{row.cadencePerWeek}/wk</td>
                <td>{row.formatMixPct}% Shorts</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Opportunity matrix</h3>
        {plan.opportunityMatrix.map((row) => (
          <p key={row.pathId}>
            Path {row.pathId}: effort {row.effort}, projected growth {row.projectedGrowth.toLocaleString()}, risk {row.risk}
          </p>
        ))}
      </section>

      <section>
        <p className="mock-label">Mocked — {plan.crossPlatform.note}</p>
      </section>

      <section>
        <h3>Weekly recalibration</h3>
        <div>
          {[1, 2, 3, 4, 5, 6].map((w) => (
            <button key={w} onClick={() => setWeek(w)} className={week === w ? "button button-accent" : "button"}>
              Week {w}
            </button>
          ))}
        </div>

        {recalibration && "locked" in recalibration ? (
          <div>
            <p>Week {week} is locked.</p>
            <button className="button button-dark" onClick={handleUnlock}>
              Unlock — CreatorLENS Pro, SGD 30/month (demo, no payment processed)
            </button>
          </div>
        ) : recalibration ? (
          <div>
            <p>
              Predicted: {recalibration.predicted.toLocaleString()} · Actual: {recalibration.actual.toLocaleString()} ({recalibration.deltaPct}%)
            </p>
            <p>{recalibration.adjustedPlan.note}</p>
            {recalibration.mocked && <p className="mock-label">Mocked — scripted for this demo, not this creator&apos;s real week {week}.</p>}
          </div>
        ) : (
          <p className="status">Loading recalibration…</p>
        )}
      </section>
    </section>
  );
}

"use client";

import { useState } from "react";
import type { DiagnoseResponse } from "@/lib/types";
import { Icon } from "./ui";

type SendState = { status: "idle" } | { status: "sending" } | { status: "sent"; to: string } | { status: "error"; message: string };

// The streak is real — computed from this channel's actual upload history, not a
// separate counter. Sending is one click, no preview step: the button calls
// /api/streak-email directly and reports whether it actually sent.
//
// Chosen over push notifications specifically because it needs no service worker or
// push-subscription backend — one API key (Resend) and a plain POST route. What it
// isn't: a scheduled, automatic reminder system — this build sends on request, not on
// a timer, since a real schedule needs a server-side cron trigger, not just an endpoint.
export function StreakBadge({ streak, demo = false }: { streak: DiagnoseResponse["streak"]; demo?: boolean }) {
  const [send, setSend] = useState<SendState>({ status: "idle" });

  async function sendReminder() {
    setSend({ status: "sending" });
    // Demo data has no real session behind it, so there's nothing for the live route to
    // send to or about — mirror how loadReport/getRecalibration bypass the API for demo.
    if (demo) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setSend({ status: "sent", to: "demo" });
      return;
    }
    try {
      const response = await fetch("/api/streak-email", { method: "POST", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send the reminder email.");
      setSend({ status: "sent", to: data.to });
    } catch (error) {
      setSend({ status: "error", message: error instanceof Error ? error.message : "Could not send the reminder email." });
    }
  }

  return (
    <div className="streak-badge">
      <div className="streak-badge-row">
        <span className="streak-flame" aria-hidden="true">🔥</span>
        <div className="streak-copy">
          <strong>{streak.currentWeeks}-week Shorts streak</strong>
          <span>Longest streak: {streak.longestWeeks} weeks · from your real upload history</span>
        </div>
        {send.status === "sent" ? (
          <span className="streak-reminder-on"><Icon name="check" size={14} />Email sent</span>
        ) : (
          <button type="button" className="button button-secondary" disabled={send.status === "sending"} onClick={sendReminder}>
            {send.status === "sending" ? "Sending…" : "Email me a reminder"}
          </button>
        )}
      </div>
      {send.status === "error" && <p role="alert" className="error-note streak-error">{send.message}</p>}
    </div>
  );
}

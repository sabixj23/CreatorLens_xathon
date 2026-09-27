"use client";

import { useState } from "react";
import { buildStreakReminderEmail } from "@/lib/email-template";
import type { DiagnoseResponse } from "@/lib/types";
import { Icon } from "./ui";

type SendState = { status: "idle" } | { status: "sending" } | { status: "sent"; to: string } | { status: "error"; message: string };

// The streak is real — computed from this channel's actual upload history, not a
// separate counter. The email preview below is built from the exact same template
// function the real send uses (lib/email-template.ts), so what's shown here is what
// would actually land in an inbox, not a separate hand-maintained mockup.
//
// Chosen over push notifications specifically because it needs no service worker or
// push-subscription backend — one API key (Resend) and a plain POST route. What it
// isn't: a scheduled, automatic reminder system — this build sends on request, not on
// a timer, since a real schedule needs a server-side cron trigger, not just an endpoint.
export function StreakBadge({ streak, channelTitle }: { streak: DiagnoseResponse["streak"]; channelTitle: string }) {
  const [showPreview, setShowPreview] = useState(false);
  const [send, setSend] = useState<SendState>({ status: "idle" });
  const { subject, html } = buildStreakReminderEmail(channelTitle, streak);

  async function sendReminder() {
    setSend({ status: "sending" });
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
          <strong>{streak.currentWeeks}-week streak</strong>
          <span>Longest streak: {streak.longestWeeks} weeks · from your real upload history</span>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setShowPreview(v => !v)}>
          {showPreview ? "Hide reminder email" : "Preview reminder email"}
        </button>
      </div>
      {showPreview && (
        <div className="streak-email-preview">
          <div className="streak-email-meta"><span>Subject</span><strong>{subject}</strong></div>
          <iframe title="Streak reminder email preview" srcDoc={html} className="streak-email-frame" />
          <div className="streak-email-actions">
            {send.status === "sent" ? (
              <span className="streak-reminder-on"><Icon name="check" size={14} />Sent to {send.to}</span>
            ) : (
              <button type="button" className="button button-primary" disabled={send.status === "sending"} onClick={sendReminder}>
                {send.status === "sending" ? "Sending…" : "Send me a real one"}
              </button>
            )}
            {send.status === "error" && <p role="alert" className="error-note">{send.message}</p>}
            <p className="fine-print">Sends to the email on this Google account. Requires a sending domain to be verified for any inbox other than the connected Resend account&apos;s own during testing.</p>
          </div>
        </div>
      )}
    </div>
  );
}

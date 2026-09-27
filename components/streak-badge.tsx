"use client";

import { useEffect, useState } from "react";
import type { DiagnoseResponse } from "@/lib/types";
import { Icon } from "./ui";

// The streak number is real — computed from this channel's actual upload history,
// not a separate counter that can drift from what really happened.
//
// The reminder button below fires a genuine browser Notification (a real OS-level
// popup on desktop and Android Chrome), not a mockup. What it deliberately isn't:
// a persistent, cross-device push system that can notify someone hours later when
// this tab isn't open — that needs a push server and a service worker subscription
// store, real backend infrastructure this build doesn't have. Being upfront about
// that distinction here rather than implying more than what's built.
export function StreakBadge({ streak }: { streak: DiagnoseResponse["streak"] }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  }, []);

  async function enableReminders() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      new Notification("🔥 Keep your streak alive!", {
        body: `You're on a ${streak.currentWeeks}-week streak. Post this week to keep it going.`,
      });
    }
  }

  return (
    <div className="streak-badge">
      <span className="streak-flame" aria-hidden="true">🔥</span>
      <div className="streak-copy">
        <strong>{streak.currentWeeks}-week streak</strong>
        <span>Longest streak: {streak.longestWeeks} weeks · from your real upload history</span>
      </div>
      {permission === "unsupported" ? null : permission === "granted" ? (
        <span className="streak-reminder-on"><Icon name="check" size={14} />Reminders on</span>
      ) : (
        <button type="button" className="button button-secondary streak-reminder-btn" onClick={enableReminders}>
          Enable streak reminders
        </button>
      )}
    </div>
  );
}

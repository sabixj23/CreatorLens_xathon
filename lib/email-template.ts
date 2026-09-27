import type { Streak } from "./types";

// Pure template builder — no env var access, safe to import from client components
// for the in-app preview as well as from the server-only send path in lib/email.ts.
// Keeping it in one place means the preview shown in the demo is exactly what would
// actually be sent, not a separate hand-maintained mockup that could drift from it.
export function buildStreakReminderEmail(channelTitle: string, streak: Streak) {
  const subject = streak.currentWeeks > 0
    ? `🔥 ${streak.currentWeeks}-week streak — keep it going, ${channelTitle}`
    : `Start a streak this week, ${channelTitle}`;

  const html = `
  <div style="font-family:'Avenir Next','Segoe UI',Arial,sans-serif;background:#030711;padding:32px;color:#e5e9ec;">
    <div style="max-width:420px;margin:0 auto;background:#080f1c;border:1px solid #152131;border-radius:12px;padding:32px;text-align:center;">
      <div style="font-size:40px;line-height:1;">🔥</div>
      <h1 style="font-size:22px;color:#eee4cf;margin:16px 0 4px;">${streak.currentWeeks}-week streak</h1>
      <p style="font-size:13px;color:#8494a6;margin:0 0 20px;">Longest streak: ${streak.longestWeeks} weeks</p>
      <p style="font-size:15px;line-height:1.6;color:#e5e9ec;margin:0 0 24px;">
        ${channelTitle} has posted ${streak.currentWeeks} week${streak.currentWeeks === 1 ? "" : "s"} in a row.
        Post again this week to keep the streak alive — a plan works far better when you actually run it.
      </p>
      <a href="#" style="display:inline-block;background:#eee4cf;color:#0f1a2b;font-weight:600;font-size:13px;padding:12px 24px;border-radius:24px;text-decoration:none;">Open your plan</a>
      <p style="font-size:11px;color:#8494a6;margin-top:24px;">CreatorLENS · Evidence first. Your call, always.</p>
    </div>
  </div>`.trim();

  return { subject, html };
}

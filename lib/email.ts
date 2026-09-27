import { buildStreakReminderEmail } from "./email-template";
import type { Streak } from "./types";

// Real email via Resend's REST API — chosen over Web Push because it needs no service
// worker, no VAPID keys, and no subscription-storage backend, just one API key.
//
// Constraint worth knowing: without a verified sending domain, Resend's sandbox sender
// (onboarding@resend.dev, used here) can only deliver to the email address the Resend
// account itself was signed up with. For anyone else's inbox, a verified domain is
// needed — a real setup step, not a code limitation.
export async function sendStreakReminderEmail(to: string, channelTitle: string, streak: Streak): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");

  const { subject, html } = buildStreakReminderEmail(channelTitle, streak);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CreatorLENS <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Streak reminder email failed (${response.status}): ${await response.text().catch(() => "")}`);
  }
}

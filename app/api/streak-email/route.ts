import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendStreakReminderEmail } from "@/lib/email";
import { getChannelBundle } from "@/lib/pipeline";
import type { StreakEmailResponse } from "@/lib/types";

// No unlock gate here on purpose — the streak/reminder loop is meant to pull a lapsed
// creator back in, so it shouldn't sit behind the same paywall as ongoing recalibration.
export async function POST() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const to = session.user?.email;
  if (!to) {
    return NextResponse.json({ error: "No email address on this account." }, { status: 400 });
  }

  try {
    const bundle = await getChannelBundle(session.accessToken);
    await sendStreakReminderEmail(to, bundle.channel.title, bundle.streak);
    const body: StreakEmailResponse = { sent: true, to };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the reminder email." },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatRequestSchema, generateChatReply } from "@/lib/chat";
import { getChannelBundle } from "@/lib/pipeline";
import { UNLOCK_COOKIE_NAME } from "@/lib/types";
import type { ChatResponse } from "@/lib/types";

// Requires the same unlock cookie as /api/recalibration week 3+ — checked first,
// before doing anything else.
export async function POST(request: NextRequest) {
  const unlocked = request.cookies.get(UNLOCK_COOKIE_NAME)?.value === "1";
  if (!unlocked) {
    return NextResponse.json({ error: "Chat requires an unlock." }, { status: 401 });
  }

  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  try {
    const bundle = await getChannelBundle(session.accessToken);
    const reply = await generateChatReply(bundle, parsed.data.message, parsed.data.history);
    const response: ChatResponse = { reply };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat reply failed." },
      { status: 502 }
    );
  }
}

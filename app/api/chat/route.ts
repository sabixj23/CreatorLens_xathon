import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatRequestSchema, generateChatReply } from "@/lib/chat";
import { getChannelBundle } from "@/lib/pipeline";
import { CHAT_USED_COOKIE_NAME, FREE_CHAT_MESSAGES, UNLOCK_COOKIE_NAME } from "@/lib/types";
import type { ChatResponse } from "@/lib/types";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// FREE_CHAT_MESSAGES free replies, then the same unlock cookie as /api/recalibration
// week 3+. The counter is an httpOnly cookie set here, so the page can't rewrite it —
// but clearing cookies resets it. Like the unlock itself, this is a demo boundary.
export async function POST(request: NextRequest) {
  const unlocked = request.cookies.get(UNLOCK_COOKIE_NAME)?.value === "1";
  const used = Math.max(0, Number.parseInt(request.cookies.get(CHAT_USED_COOKIE_NAME)?.value ?? "0", 10) || 0);

  if (!unlocked && used >= FREE_CHAT_MESSAGES) {
    return NextResponse.json({ error: "Free questions used. Unlock Pro to keep chatting.", freeRemaining: 0 }, { status: 402 });
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

    // Only a successful reply uses up a free question.
    const nowUsed = unlocked ? used : used + 1;
    const payload: ChatResponse = { reply, freeRemaining: unlocked ? null : Math.max(0, FREE_CHAT_MESSAGES - nowUsed) };
    const response = NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    if (!unlocked) {
      response.cookies.set(CHAT_USED_COOKIE_NAME, String(nowUsed), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: COOKIE_MAX_AGE_SECONDS,
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat reply failed." },
      { status: 502 }
    );
  }
}
